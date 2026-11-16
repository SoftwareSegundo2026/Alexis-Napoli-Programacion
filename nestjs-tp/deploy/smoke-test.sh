#!/usr/bin/env bash
# Casos límite de la spec 007 contra Docker REAL (RNF-3): lo corre el workflow
# docker.yml en GitHub Actions, donde el runner hace de "servidor".
#
# Uso:   smoke-test.sh <imagen local>
# Variables:
#   CANARY   texto que el workflow puso en un .env del contexto del build: no
#            puede aparecer en la imagen (caso 11). Opcional.
#
# Cada caso imprime "OK caso N: …"; el primero que falla corta con código 1.
# Usa `sudo systemctl restart docker` (caso 6): pensado para el runner, no
# para correrlo en una máquina propia.
set -euo pipefail

image="${1:?Uso: smoke-test.sh <imagen local>}"
root="$(cd "$(dirname "$0")/.." && pwd)"
repo_image="ghcr.io/softwaresegundo2026/alexis-napoli-programacion"

ok() { echo "OK caso $1: $2"; }
fail() {
  echo "FALLA caso $1: $2" >&2
  exit 1
}

# ── "Servidor": carpeta de despliegue con el compose, el script y un .env ──────
# El secreto se genera al azar en la corrida y nunca se versiona (RNF-7).
new_deploy_dir() {
  local dir
  dir="$(mktemp -d)"
  cp "$root/docker-compose.yml" "$root/deploy/deploy.sh" "$dir/"
  printf 'JWT_SECRET=%s\nLOG_LEVEL=log\n' "$(openssl rand -hex 32)" > "$dir/.env"
  echo "$dir"
}

server="$(new_deploy_dir)"
broken="$(new_deploy_dir)"
cleanup() {
  (cd "$server" && COMPOSE_PROJECT_NAME=chinook-ci docker compose down --volumes --timeout 5 >/dev/null 2>&1) || true
  (cd "$broken" && COMPOSE_PROJECT_NAME=chinook-broken docker compose down --volumes --timeout 5 >/dev/null 2>&1) || true
  docker volume rm chinook-broken_chinook-data >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Dos "versiones" publicadas de la misma imagen, para desplegar y volver atrás.
docker tag "$image" "$repo_image:ci-v1"
docker tag "$image" "$repo_image:ci-v2"

compose() { (cd "$server" && COMPOSE_PROJECT_NAME=chinook-ci docker compose "$@"); }
container_id() { compose ps --quiet api; }
health_of() { docker inspect --format '{{.State.Health.Status}}' "$1" 2>/dev/null || echo none; }
wait_healthy() {
  for _ in $(seq 1 60); do
    local id
    id="$(container_id)"
    if [[ -n "$id" && "$(health_of "$id")" == "healthy" ]]; then
      return 0
    fi
    sleep 2
  done
  return 1
}
deploy() { (cd "$server" && COMPOSE_PROJECT_NAME=chinook-ci PULL=0 ./deploy.sh "$1"); }
running_image() { docker inspect --format '{{.Config.Image}}' "$(container_id)"; }

# ── Caso 10: usuario no root y sin herramientas de build ──────────────────────
uid="$(docker run --rm --entrypoint id "$image" -u)"
[[ "$uid" != "0" ]] || fail 10 "el contenedor corre como root"
if docker run --rm --entrypoint sh "$image" -c \
  'command -v pnpm || command -v npm || command -v npx || command -v tsc || test -e /app/node_modules/typescript'; then
  fail 10 "la imagen trae herramientas de build"
fi
ok 10 "uid $uid (no root); sin pnpm, npm, npx ni TypeScript"

# ── Caso 11: ningún secreto ni .env en la imagen ──────────────────────────────
if docker run --rm --entrypoint sh "$image" -c 'ls -a /app | grep -qx ".env"'; then
  fail 11 "hay un .env en /app"
fi
if [[ -n "${CANARY:-}" ]]; then
  if docker history --no-trunc "$image" | grep -q "$CANARY"; then
    fail 11 "el secreto canario aparece en docker history"
  fi
  canary_container="$(docker create "$image")"
  if docker export "$canary_container" | grep -aq "$CANARY"; then
    docker rm -f "$canary_container" >/dev/null
    fail 11 "el secreto canario aparece en el sistema de archivos de la imagen"
  fi
  docker rm -f "$canary_container" >/dev/null
fi
ok 11 "sin .env en la imagen; el secreto canario no está ni en docker history ni en los archivos"

# ── Caso 5: variables mal seteadas → no arranca y nombra la variable ──────────
check_bad_env() {
  local variable="$1" output status=0
  shift
  output="$(docker run --rm "$@" "$image" 2>&1)" || status=$?
  [[ "$status" != "0" ]] || fail 5 "arrancó con $variable inválida"
  grep -q "$variable" <<<"$output" || fail 5 "el error no nombra $variable: $output"
}
check_bad_env JWT_SECRET -e JWT_SECRET=corto
check_bad_env LOG_LEVEL -e JWT_SECRET="$(openssl rand -hex 32)" -e LOG_LEVEL=loud
ok 5 "JWT_SECRET corto y LOG_LEVEL=loud: no arranca y el mensaje nombra la variable"

# ── Caso 12 (1/2): desplegar una versión con deploy.sh → healthy ──────────────
deploy ci-v1
[[ "$(running_image)" == "$repo_image:ci-v1" ]] || fail 12 "no quedó corriendo ci-v1"

# /health, X-Request-Id y logs JSON en la app desplegada (RF-5, RF-11, RF-13)
body="$(curl --silent --fail http://127.0.0.1:3300/health)"
[[ "$body" == '{"status":"ok","database":"up"}' ]] || fail 12 "/health respondió $body"
header="$(curl --silent --output /dev/null --dump-header - -H 'X-Request-Id: smoke-12' \
  http://127.0.0.1:3300/api/v1/genres | tr -d '\r' | grep -i '^x-request-id:')"
[[ "${header,,}" == "x-request-id: smoke-12" ]] || fail 12 "X-Request-Id: '$header'"
sleep 1
compose logs --no-log-prefix api | grep '"requestId":"smoke-12"' | jq --exit-status \
  'select(.level == "log" and .path == "/api/v1/genres" and .statusCode == 200)' >/dev/null \
  || fail 12 "no hay una línea JSON del pedido con su requestId"
ok 12 "deploy.sh ci-v1 → healthy; /health 200; X-Request-Id y log JSON con requestId"

# ── Caso 12 (2/2): otra versión y ROLLBACK a la anterior, sin reconstruir ─────
deploy ci-v2
[[ "$(running_image)" == "$repo_image:ci-v2" ]] || fail 12 "no quedó corriendo ci-v2"
deploy ci-v1
[[ "$(running_image)" == "$repo_image:ci-v1" ]] || fail 12 "el rollback no volvió a ci-v1"
ok 12 "deploy.sh ci-v2 y rollback a ci-v1: healthy con la versión pedida cada vez"

# ── Caso 6: el "servidor" (el daemon de Docker) se reinicia → vuelve solo ─────
before="$(container_id)"
sudo systemctl restart docker
wait_healthy || fail 6 "el servicio no volvió healthy después de reiniciar Docker"
[[ "$(container_id)" == "$before" ]] || fail 6 "no es el mismo contenedor (lo recreó alguien)"
ok 6 "tras reiniciar el daemon de Docker, el servicio volvió solo y quedó healthy (restart: always)"

# ── Caso 16: docker compose stop → apagado ordenado y código 0 ────────────────
id="$(container_id)"
compose stop api >/dev/null
exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$id")"
[[ "$exit_code" == "0" ]] || fail 16 "salió con código $exit_code"
logs="$(docker logs "$id" 2>&1)"
grep -q 'Apagado ordenado (SIGTERM)' <<<"$logs" || fail 16 "no registró el apagado ordenado"
grep -q 'Apagado completo' <<<"$logs" || fail 16 "no registró el fin del apagado"
ok 16 "SIGTERM → apagado ordenado registrado y código de salida 0"

# ── Casos 1 y 17: base que no es una base → nunca healthy; deploy.sh falla ────
# Se escribe basura en el volumen de otro proyecto antes de desplegar.
docker volume create chinook-broken_chinook-data >/dev/null
docker run --rm --user root -v chinook-broken_chinook-data:/data --entrypoint sh "$image" \
  -c 'echo "no soy una base de datos" > /data/chinook.db && chown node:node /data/chinook.db'
status=0
output="$(cd "$broken" && COMPOSE_PROJECT_NAME=chinook-broken API_PORT=3301 PULL=0 \
  WAIT_TIMEOUT=40 ./deploy.sh ci-v1 2>&1)" || status=$?
[[ "$status" != "0" ]] || fail 17 "deploy.sh terminó bien con la base rota"
grep -q 'no quedó healthy' <<<"$output" || fail 17 "deploy.sh no explicó la falla"
grep -q 'file is not a database' <<<"$output" || fail 1 "los logs no muestran el error de la base: $output"
grep -q '"level":"fatal"' <<<"$output" || fail 1 "el arranque fallido no se registró como fatal"
ok 1 "con un archivo que no es una base, la app termina con error claro (fatal) y nunca queda healthy"
ok 17 "deploy.sh falla (código $status) y muestra los logs del servicio"

echo "Todos los casos pasaron."

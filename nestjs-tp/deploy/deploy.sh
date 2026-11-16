#!/usr/bin/env bash
# Despliega (o vuelve atrás) la API a una versión de la imagen (spec 007 RF-9, RF-10).
#
# Uso:   ./deploy.sh <tag>        tag = sha del commit (o cualquier tag publicado)
# Corre en la carpeta de despliegue del servidor, que tiene que tener:
#   - docker-compose.yml   (lo copia el pipeline en cada despliegue)
#   - .env                 (lo crea el operador UNA vez; nunca sale del repo)
#
# Rollback = correrlo con el sha de una versión anterior: no reconstruye nada,
# solo levanta esa imagen ya publicada.
#
# Variables opcionales:
#   PULL=0          no bajar la imagen (prueba con una imagen local, en Actions)
#   DEPLOY_DIR      carpeta de despliegue (por defecto, la del script)
#   WAIT_TIMEOUT    segundos para quedar healthy (por defecto 60)
#
# Termina con 0 solo si el servicio quedó healthy con esa versión. Si no,
# muestra los últimos logs y termina con 1 (la corrida del pipeline queda en rojo).
set -euo pipefail

tag="${1:-}"
if [[ ! "$tag" =~ ^[A-Za-z0-9_.-]{1,128}$ ]]; then
  echo "Uso: deploy.sh <tag>  (letras, números, '.', '_' o '-'; recibido: '$tag')" >&2
  exit 2
fi

cd "${DEPLOY_DIR:-$(dirname "$0")}"
if [[ ! -f docker-compose.yml || ! -f .env ]]; then
  echo "Falta docker-compose.yml o .env en $(pwd) (ver README: preparar el servidor)" >&2
  exit 2
fi

export IMAGE_TAG="$tag"

if [[ "${PULL:-1}" != "0" ]]; then
  echo "Bajando la imagen $tag…"
  docker compose pull api
fi

echo "Levantando la versión $tag y esperando a que quede healthy…"
if ! docker compose up --detach --wait --wait-timeout "${WAIT_TIMEOUT:-60}" api; then
  echo "ERROR: la versión $tag no quedó healthy. Últimos logs del servicio:" >&2
  docker compose logs --no-log-prefix --tail 50 api >&2 || true
  exit 1
fi

echo "Desplegado: $(docker compose ps --format '{{.Image}} — {{.Status}}' api)"

#!/usr/bin/env bash
# Listado reproducible del contenido de una imagen (spec 007 RNF-1, caso 3).
#
# Uso:   image-manifest.sh <imagen>   → escribe el listado en la salida estándar
#
# Una línea por archivo con: hash SHA-256 del contenido, permisos, dueño y
# ruta; y una por carpeta o enlace con permisos, dueño y ruta (o destino).
# Las FECHAS no entran: cambian en cada build sin cambiar lo que hay adentro.
# Dos imágenes son "equivalentes" si sus listados son idénticos.
set -euo pipefail

image="${1:?Uso: image-manifest.sh <imagen>}"
work="$(mktemp -d)"
container="$(docker create "$image")"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true; rm -rf "$work"' EXIT

docker export "$container" > "$work/fs.tar"

# GNU tar llama a este comando con el contenido de cada archivo regular por la
# entrada estándar y sus datos en variables TAR_*.
cat > "$work/hash-file.sh" <<'EOF'
#!/bin/sh
printf 'f %s %s %s:%s %s\n' "$(sha256sum | cut -d' ' -f1)" "$TAR_MODE" "$TAR_UNAME" "$TAR_GNAME" "$TAR_FILENAME"
EOF
chmod +x "$work/hash-file.sh"

{
  tar -xf "$work/fs.tar" --to-command="$work/hash-file.sh"
  # Carpetas y enlaces: permisos, dueño y ruta (sin tamaño ni fecha).
  tar -tvf "$work/fs.tar" | awk '/^[dl]/ { $3 = ""; $4 = ""; $5 = ""; print }'
} | LC_ALL=C sort

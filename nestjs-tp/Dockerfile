# syntax=docker/dockerfile:1
#
# Imagen de la API (spec 007 RF-1, RF-2, RNF-1). Tres etapas:
#   build      → instala todo, compila y corre los 4 gates (si uno falla, no hay imagen)
#   prod-deps  → solo las dependencias de producción
#   runtime    → la imagen final: Node + dependencias de producción + dist/ + plantilla
# Solo la etapa runtime llega a la imagen publicada: pnpm, TypeScript, los
# tests y el código fuente se quedan en las etapas intermedias.

# Imagen base fijada por versión Y digest: dos builds del mismo commit parten
# exactamente de los mismos archivos (reproducibilidad). Es el mismo Node 24.14.1
# del entorno local y del CI. Debian slim (y no Alpine) porque better-sqlite3
# trae binarios precompilados para glibc: no hace falta compilar nada.
ARG NODE_IMAGE=node:24.14.1-bookworm-slim@sha256:b506e7321f176aae77317f99d67a24b272c1f09f1d10f1761f2773447d8da26c

# ── Base común de las etapas que instalan dependencias ────────────────────────
FROM ${NODE_IMAGE} AS base
# La misma versión de pnpm que "packageManager" en package.json.
RUN npm install --global pnpm@12.6.0
WORKDIR /app
# Primero solo los manifiestos: si no cambian, Docker reutiliza la instalación.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# ── build: compila y corre los gates ──────────────────────────────────────────
FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
# Los 4 gates de la constitución dentro del build (consigna TP-7, alcance 7).
RUN pnpm lint && pnpm build && pnpm test && pnpm test:e2e

# ── prod-deps: dependencias de producción ─────────────────────────────────────
FROM base AS prod-deps
# pnpm guarda en estos archivos la FECHA de la instalación: no hacen falta para
# correr y harían que dos builds nunca tuvieran el mismo contenido (RNF-1).
RUN pnpm install --prod --frozen-lockfile \
 && rm -f node_modules/.modules.yaml node_modules/.pnpm-workspace-state*.json

# ── runtime: la imagen que se publica ─────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime

# Vincula la imagen publicada en ghcr.io con el repositorio (hereda sus permisos).
LABEL org.opencontainers.image.source="https://github.com/SoftwareSegundo2026/Alexis-Napoli-Programacion" \
      org.opencontainers.image.description="API Chinook (NestJS) — spec 007"

# Sin herramientas para instalar paquetes: la imagen solo corre la app (RF-2).
# /var/lib/chinook es donde vive la base de trabajo (volumen): del usuario node.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
 && mkdir -p /var/lib/chinook \
 && chown node:node /var/lib/chinook

# Valores que no son secretos. JWT_SECRET y el resto llegan por el entorno (RF-3).
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/var/lib/chinook/chinook.db

WORKDIR /app
# Archivos de root y de solo lectura para la app: aunque alguien tomara el
# proceso, no podría modificar el código que corre.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# package.json hace falta en runtime: "type": "module" (dist/ es ESM).
COPY package.json ./
COPY data/chinook.template.db ./data/chinook.template.db

# Usuario sin privilegios que ya trae la imagen oficial de Node (RF-2).
USER node
EXPOSE 3000

# También sirve con `docker run` (el compose define el suyo). La imagen slim no
# trae curl: se usa el fetch de Node contra /health (RF-5).
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "dist/main.js"]

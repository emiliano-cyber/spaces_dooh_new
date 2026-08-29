# Imagen de SPACE OS: UN artefacto que corre cualquier instancia.
#
# El contexto de build es la RAIZ del monorepo, no apps/web. No es una
# preferencia: con npm workspaces (`apps/*`, `packages/*`) las dependencias
# quedan hoisted en el node_modules de la raiz, y por eso
# apps/web/next.config.mjs:17 apunta `outputFileTracingRoot` a `../../`. Desde
# apps/web el artefacto saldria sin la mitad de sus paquetes.
#
# Node 20, el mismo que usa el CI (.github/workflows/ci.yml:60): la imagen no es
# sitio para estrenar version de runtime.

# ---------------------------------------------------------------------------
# deps — el arbol de dependencias, cacheado aparte del codigo
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

# Los binarios nativos de Next (SWC) y de turbo estan compilados contra glibc.
# En Alpine, sin esta capa de compatibilidad, fallan al cargarse.
RUN apk add --no-cache libc6-compat

WORKDIR /repo

# Primero SOLO los manifiestos: mientras el lockfile no cambie, esta capa se
# reutiliza y el build no vuelve a bajar dependencias.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/types/package.json packages/types/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/ui/package.json packages/ui/
COPY packages/utils/package.json packages/utils/

# `npm ci` y NUNCA `npm install`: instala exactamente el arbol que dice el
# lockfile y falla si package.json y package-lock.json no estan en sync, en vez
# de arreglarlo por su cuenta y publicar una imagen construida sobre un arbol de
# dependencias que no probo nadie. El motivo esta escrito en
# .github/workflows/ci.yml:63-68.
RUN npm ci

# ---------------------------------------------------------------------------
# build — el standalone de Next
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build

RUN apk add --no-cache libc6-compat

WORKDIR /repo

ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1

# Se copia el arbol entero de `deps`, no solo /repo/node_modules: npm anida
# node_modules dentro de algunos workspaces cuando hay conflicto de versiones
# (hoy packages/eslint-config y packages/ui), y enumerarlos a mano se rompe
# callado el dia que aparezca uno nuevo.
COPY --from=deps /repo ./
COPY . .

RUN npx turbo run build --filter=web

# ---------------------------------------------------------------------------
# runtime — lo minimo para servir, sin repo y sin toolchain
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# El server.js del standalone lee las dos (server.js:8-9). HOSTNAME a 0.0.0.0 o
# el proceso solo escucha dentro del contenedor.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Sellado de la version en el artefacto. Lo consume /api/version (F6.1), que es
# lo que permite preguntarle a una instancia que esta corriendo sin entrar por
# ssh. Se pasa con `docker build --build-arg VERSION=vX.Y.Z`.
ARG VERSION=desconocida
ENV SPACE_OS_VERSION=$VERSION

# El servidor autocontenido. Con outputFileTracingRoot en la raiz del monorepo,
# el artefacto conserva la ruta apps/web/ dentro — de ahi el CMD.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./

# Next NUNCA mete estos dos dentro del standalone, por diseño. Sin ellos la app
# levanta pero el login se ve sin estilos: /spaces-dooh/_next/static/... da 404.
# Comprobado al cerrar F2.1.
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --chown=node:node apps/web/public ./apps/web/public

# El esquema y las migraciones viajan DENTRO de la imagen. Es lo que sostiene el
# invariante 1 del modelo de instancias: en el servidor de una instancia no hay
# repo clonado, asi que el runner de migraciones de la Fase 3 las lee de /app/db.
COPY --chown=node:node db/schema.sql ./db/schema.sql
COPY --chown=node:node db/migrations ./db/migrations

# next/image escribe las imagenes remotas optimizadas bajo .next/cache. Sin este
# directorio ya creado y con dueño, el usuario `node` no puede servirlas. Es el
# unico sitio donde el proceso escribe: la instancia no necesita volumen.
RUN mkdir -p ./apps/web/.next/cache && chown -R node:node ./apps/web/.next

# Sin privilegios: la app no instala nada ni escribe fuera de su cache.
USER node

EXPOSE 3000

CMD ["node", "apps/web/server.js"]

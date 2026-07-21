# `_archive/` — Código retirado del árbol activo (Hardening 1 · Bloque G)

Este directorio guarda código que **ya no forma parte del producto vivo** pero que
**no se borra** porque contiene lógica y diseño que sirven de referencia para
fases futuras. Nada de aquí se compila, se despliega ni se referencia desde el
código activo.

## Qué hay aquí

### `api/` — Backend Fastify (huérfano)
El API de `apps/api`: Fastify + Prisma + BullMQ + Redis + almacenamiento en
DigitalOcean Spaces. Estaba pensado como el backend "de producción", pero **nunca
se cableó al producto vivo ni se desplegó**. El backend real es el **BFF** dentro
de `apps/web/app/api/**` (Next.js Route Handlers sobre `db/schema.sql`), no este
Fastify.

Se conserva como referencia porque su diseño ya resuelve varias cosas que aún no
existen en el BFF:
- Conectores CMS (`src/connectors/`), incl. el `DoohmainConnector`.
- Worker de alertas de vencimiento por correo (BullMQ) — la notificación externa
  que el BFF todavía no tiene.
- Orquestación de traffic orders y la tabla `ConnectorConfig`.
- El schema Prisma completo (`prisma/schema.prisma`) como documentación del
  modelo de datos.

> Nota: `apps/api/.env` (con credenciales `DO_SPACES_*`) nunca estuvo en git y no
> se movió aquí. Las llaves siguen fuera del repo.

### `web-frontend-2/` — Segundo frontend (huérfano)
Los route groups `(comercial)`, `(inmuebles)`, `(operaciones)` y `admin` que
vivían en `apps/web/app/`. Eran la UI de ese segundo frontend, que consumía el
Fastify de `api/` (apagado). El frontend vivo es el shell **`/demo`** + los
**`/portal`** externos, servidos por el BFF.

## Por qué se archivó
La auditoría técnica integral confirmó dos pistas de arquitectura: la viva
(`/demo` + BFF sobre `db/schema.sql`) y esta, muerta (Fastify + segundo
frontend). Mantener el código muerto en el árbol activo confundía el build, el
grep y a quien llega nuevo. Se retira del camino sin perder la referencia.

## Cómo recuperar algo de aquí
- El estado del repo **antes** de archivar está marcado con el tag de git
  **`pre-hardening-1-archive`**. Ahí `apps/api` y los route groups están en su
  ubicación original con toda su historia.
- Los archivos se movieron con `git mv`, así que `git log --follow` sobre
  cualquier archivo de `_archive/` sigue mostrando su historia completa.

## Reactivar (si algún día se decide)
Si se decide levantar el Fastify en producción (p. ej. para el worker de correo o
los conectores), habría que: reinstalar dependencias en `_archive/api`, volver a
declararlo como workspace, apuntarle un proceso pm2 y reconectar el frontend. No
es un simple `git mv` de vuelta: el BFF ya cubre el flujo de negocio y habría que
decidir qué vive en cada lado.

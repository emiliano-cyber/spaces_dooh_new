# apps/api — Backend Fastify (NO conectado al demo)

> **Estado actual (verificado en Fase 0, ver `VERIFICACION_CIERRE.md`): HUÉRFANO.**
> Este backend **no es** el que sirve al demo y **no está cableado** al frontend.

## Qué es esto
Backend Fastify + Prisma + Redis/BullMQ preparado para producción (auth JWT,
multi-tenant schema-per-tenant, integraciones, jobs). Existe desde antes del
sprint de cierre, pero el **frontend del demo no lo consume**.

## Cuál es el backend VIVO
El demo (`/spaces-dooh/demo/**`) corre sobre el **BFF**: route handlers de Next en
`apps/web/app/api/**`, que hablan directo con Postgres (`apps/web/lib/server/*`).
La capa de datos del front (`apps/web/lib/data/estado-api.ts`) llama a
`/spaces-dooh/api/**` (el BFF), **no** a este Fastify (puerto 3001).

> Existe `NEXT_PUBLIC_API_URL=http://localhost:3001` en el `.env.local` del front,
> pero **no se usa** en el flujo actual del demo.

## Qué decidir (pendiente de arquitectura)
El destino de `apps/api` depende de la definición de arquitectura aún abierta:
1. **Promoverlo** a backend de producción y migrar el BFF para consumirlo, o
2. **Consolidar** todo en el BFF y archivar `apps/api`.

Hasta esa decisión: **no borrar, no asumir que es el backend vivo.**

## Notas
- `apps/api/.env` contiene credenciales (incluye `DO_SPACES_*`); **no está
  trackeado en git** (verificado). No commitear `.env`.
- TODO (seguridad): cuando se construya un **almacén de credenciales de
  integraciones** (AdMobilize/CMS/CFDI) en BD, debe **cifrarse en reposo**
  (AES con llave en secreto, nunca en repo). Hoy los conectores solo leen de
  variables de entorno (no hay almacén).

---
name: reconocimiento-space-os
description: Mapa mental de spaces_doohmain_nueva para reconocimiento - qué pista está viva, dónde vive cada capa, y el orden barato de exploración
metadata:
  type: project
---

**Hay DOS cosas vivas, no una: `apps/web` (Next 14 + BFF, el producto) y
`apps/flota` (el plano de control del PADRE). Todo lo demás es archivo o infraestructura.**

**Why:** el repo conserva restos de una arquitectura anterior de dos servicios, y desde
el 28/08 añadió un plano de control entero que **no viaja en la imagen** —el `Dockerfile`
construye con `--filter=web`, y ese filtro es lo único que lo garantiza—. Clasificar mal
cualquiera de los dos lleva a conclusiones falsas sobre qué corre un cliente.

**How to apply:** al explorar, clasifica cada hallazgo en VIVA (`apps/web`), CONTROL
(`apps/flota`, `infra/`) o LATENTE.

Latente y confirmado el 15/09: `_archive/api` (Fastify+Prisma+BullMQ),
`_archive/web-frontend-2`, `infra/nginx/spaces.conf`, `infra/apache/`, y el
**`README.md` de la raíz**, que sigue describiendo Fastify+Prisma+Redis y
`infra/scripts/new-tenant.sh`.

**Ya NO existen** (la memoria vieja los daba por vivos): `apps/web/lib/auth-context.tsx`,
`apps/web/app/_legacy/`. El `AuthProvider` muerto se retiró el 27/08.

## Orden barato de exploración

1. **`docs/Traspaso_*.md` MÁS RECIENTE** — es lo único que dice el estado *de hoy*.
   Empezar por el MOC hace perder tiempo: lleva cifras viejas.
2. `vault/07-Agentes/diario/` del día + `vault/07-Agentes/tablero.md` (enorme, leer solo
   la cabecera).
3. `vault/` por carpetas, para el contexto estructural.
4. El código, solo para verificar.

## Dónde vive cada capa (medido 2026-09-15)

- Endpoints: `apps/web/app/api/**/route.ts` — **92** archivos, **115** métodos.
- Capas del BFF: `route.ts` → `*-controller.ts` → `*-repo.ts` → `db.ts`.
- Pantallas: `app/(app)/(shell)/` (22, con chrome) y `app/(app)/` (9, sin chrome).
- Menú **y** control de acceso: `components/demo/shell/nav.ts`.
- Re-autenticación de dinero: `exigirCambioSensible` en `lib/server/cambios.ts:236` —
  8 endpoints la llevan.
- Esquema: `db/schema.sql` (28 tablas) + **80** migraciones (12 tablas más) = **40**.
  `schema.sql` crea RLS **permisiva**; el fail-closed llega por 8 migraciones.
- Orden de migraciones: `scripts/migrar.mjs:63` (`ANTES_DE`), declarado UNA vez.
- Guiones de instancia: `infra/scripts/` — `provision-instancia.sh` (administrado),
  `instalar-hijo.sh` (droplet del cliente, ADR 0032), `update.sh` (2341 líneas),
  y `base-instancia.sh` / `entorno-instancia.sh`, que los dos caminos **sourcean**.
- Licencias Ed25519: `apps/flota/licencia.mjs` firma, `update.sh:890-960` verifica,
  pública en `infra/licencias/space-os.pub`.
- Runbooks ejecutados: `DESPLIEGUE_*.txt` en la **raíz**, no en `docs/`.

Relacionadas: [[trampas-verificacion-boveda]] · [[codigo-muerto-alcanzable]]

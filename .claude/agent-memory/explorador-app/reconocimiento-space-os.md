---
name: reconocimiento-space-os
description: Mapa mental de spaces_doohmain_nueva para reconocimiento - qué pista está viva, dónde vive cada capa, y el orden barato de exploración
metadata:
  type: project
---

**El repo tiene una sola pista viva: `apps/web` (Next 14 + BFF integrado). Todo lo demás es infraestructura latente.**

**Why:** el repo conserva restos de una arquitectura anterior de dos servicios, y
confundirlos es el error más caro posible aquí — hay un `AuthProvider` JWT muerto
montado en el árbol de render que parece el sistema de sesión y no lo es.

**How to apply:** al explorar, clasifica siempre cada hallazgo en VIVA o LATENTE.

Latente: `_archive/api` (Fastify+Prisma+BullMQ, fuera de los workspaces npm),
`_archive/web-frontend-2`, `app/_legacy/` (7 páginas), `lib/auth-context.tsx` y sus
consumidores, `infra/nginx/spaces.conf`, `infra/apache/spaces.conf`, `README.md` raíz.

Ojo con dos premisas que circulan y son **falsas**: no existe `apps/` con más de un
workspace (solo `web`), y no existen grupos de ruta `(comercial)`/`(operaciones)`.
Los únicos grupos son `(app)`, `(app)/(shell)` y `_legacy/(auth)`.

## Orden barato de exploración

1. `vault/` completo — 39 notas curadas, cubre el 90 % y ahorra horas.
2. `vault/07-Agentes/diario/` más reciente + `git log --since` desde el `actualizado:`
   de las notas. Ahí está la deriva que ningún recuento detecta.
3. Después el código, solo para verificar.

## Dónde vive cada capa

- Endpoints: `apps/web/app/api/**/route.ts` (88 archivos, 110 métodos HTTP).
- Capas del BFF: `route.ts` (guard+HTTP) → `*-controller.ts` (zod+reglas) → `*-repo.ts` (SQL) → `db.ts`.
- Pantallas internas: `app/(app)/(shell)/` (22). Sin chrome: `app/(app)/` a secas (8).
- Menú **y** control de acceso: el mismo `components/demo/shell/nav.ts` (lo usa `AuthGate`).
- Esquema: `db/schema.sql` + 66 migraciones. `schema.sql` solo **no** es seguro: crea
  RLS permisiva y el fail-closed llega por migración.
- Correcciones de datos de producción: `docs/datos/` (con rollback), nunca en `db/migrations/`.
- Runbooks ejecutados: `DESPLIEGUE_*.txt` en la **raíz**, no en `docs/`.

Relacionadas: [[trampas-verificacion-boveda]] · [[codigo-muerto-alcanzable]]

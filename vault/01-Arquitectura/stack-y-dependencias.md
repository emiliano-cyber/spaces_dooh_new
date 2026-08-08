---
tipo: arquitectura
estado: verificado
actualizado: 2026-08-07
tags: [stack, dependencias, versiones]
archivos:
  - package.json
  - apps/web/package.json
  - apps/web/next.config.mjs
  - docs/DEPENDENCIAS.md
---

# Stack y dependencias

## Monorepo

npm workspaces + turbo. `package.json:25-28` declara `apps/*` y `packages/*`.

| Workspace | Estado | Contenido |
|---|---|---|
| `apps/web` | **El producto** | Next.js + BFF + toda la lógica |
| `packages/types` | En uso | `auth`, `campaign`, `site`, `tenant`, `events`… |
| `packages/utils` | En uso | `dates`, `permissions`, `readiness` |
| `packages/ui` | Marginal | 3 componentes (`button`, `card`, `code`) |
| `packages/eslint-config`, `packages/typescript-config` | Config | — |
| `_archive/api` | **Fuera de workspaces**, no se instala | Fastify 5 + Prisma 7 + BullMQ |

## Versiones reales

| Paquete | Versión | Nota |
|---|---|---|
| `next` | **14.2.29** | Pin exacto, sin `^` (`apps/web/package.json:17`) |
| `react` / `react-dom` | `^18.3.1`, forzado a **18.3.1** | `package.json:17-20` |
| `typescript` | `5.9.2` | Pin exacto en raíz y en web |
| `pg` | `^8.13.1` | Único acceso a datos |
| `bcryptjs` | `^2.4.3` | Único hash de contraseñas |
| `zod` | `^3.25.42` | Validación de entrada |
| `@tanstack/react-query` | `^5.80.5` | Data fetching cliente |
| `zustand` | `^5.0.5` | Un solo store (`lib/data/store.ts`) |
| `vitest` | `^4.1.3` | Unitarias + e2e |
| `node` | `>=18` (CI usa 20) | `package.json:21-23`, `ci.yml` |

> [!note] El `overrides` de React no es cosmético
> `package.json:16` documenta por qué: con dos majors de React en el monorepo,
> `styled-jsx` (dependencia de Next) queda en la raíz y encuentra la copia
> equivocada, produciendo `Cannot read properties of null (reading 'useContext')`
> al renderizar en servidor. Hay además un alias de webpack para lo mismo en
> `apps/web/next.config.mjs:47-56`. **No tocar ninguno de los dos por separado.**

## Lo que NO está instalado, y es deliberado

| Ausente | Por qué importa |
|---|---|
| ORM (Prisma, Drizzle) | Todo el SQL es a mano en `lib/server/*-repo.ts` |
| Librería de auth (NextAuth, iron-session) | Auth propia — ver [[autenticacion-y-sesion]] |
| Librería JWT (`jose`) | El ADR 0012 la evita a propósito (`lib/server/google-oauth.ts:5-13`) |
| Cliente de Resend | Se usa `fetch` directo "para no tocar el package-lock" (`lib/server/email.ts:3-4`) |
| Redis | `REDIS_URL` está declarada pero **ningún archivo la lee** |

## Regla del lockfile

`docs/DEPENDENCIAS.md` fija la norma: **nunca tocar `package.json` sin regenerar
`package-lock.json`**, y nada de rangos flotantes en lo crítico. El workflow
`lockfile-check.yml` lo hace cumplir con `npm ci --dry-run` en cada push y PR.

> [!warning] Añadir una dependencia es una decisión, no un detalle
> Este proyecto evita dependencias de forma sistemática y lo justifica por
> escrito cada vez. Antes de añadir una, léete la justificación de la que ya
> evitaron para el mismo problema.

## Relacionadas
[[vision-general]] · [[entorno-y-despliegue]] · [[convenciones]] ·
[[integraciones-externas]] · [[MOC-Proyecto]]

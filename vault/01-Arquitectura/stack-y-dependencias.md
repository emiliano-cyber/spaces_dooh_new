---
tipo: arquitectura
estado: verificado
actualizado: 2026-10-05
tags: [stack, dependencias, versiones]
archivos:
  - package.json
  - apps/web/package.json
  - apps/web/next.config.mjs
  - apps/web/lib/server/recibos-cfe/lector-pdf.ts
  - docs/DEPENDENCIAS.md
---

# Stack y dependencias

> [!note] 2026-10-05 · revalidada contra el código
> Todas las citas de `package.json` de la raíz estaban **una línea corridas**
> (el comentario `//overrides` ocupa la `:17`), y las de `next.config.mjs` y
> `release.yml` habían derivado bastante más. Corregidas abajo con la línea de
> hoy. Y faltaba una dependencia de producción que entró el 29/09:
> **`pdfjs-dist`**, la primera que se añade para leer documentos.

## Monorepo

npm workspaces + turbo. `package.json:26-29` declara `apps/*` y `packages/*`.

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
| `react` / `react-dom` | `^18.3.1`, forzado a **18.3.1** | `package.json:18-21` (`overrides`) |
| `typescript` | `5.9.2` | Pin exacto en raíz y en web |
| `pg` | `^8.13.1` | Único acceso a datos |
| `bcryptjs` | `^2.4.3` | Único hash de contraseñas |
| `zod` | `^3.25.42` | Validación de entrada |
| `@tanstack/react-query` | `^5.80.5` | Data fetching cliente |
| `zustand` | `^5.0.5` | Un solo store (`lib/data/store.ts`) |
| `pdfjs-dist` | `^4.10.38` | **Nueva (29/09, `a9815e09`).** Lee el texto del PDF del recibo de CFE. Vive aislada en un solo archivo, `lib/server/recibos-cfe/lector-pdf.ts`, que explica por qué no se lee a mano: los recibos mezclan fuentes `WinAnsiEncoding` e `Identity-H` en la misma página y solo el mapa `ToUnicode` de cada fuente los cruza bien. Ver [[02-Backend/recibos-cfe-pdf]] (`apps/web/package.json:38`) |
| `vitest` | `^4.1.3` | Unitarias + e2e |
| `node` | `>=18` declarado; **el CI usa dos versiones** | `package.json:22-24` — ver el aviso de abajo |

> [!note] El `overrides` de React no es cosmético
> `package.json:17` (la clave `//overrides`) documenta por qué: con dos majors de React en el monorepo,
> `styled-jsx` (dependencia de Next) queda en la raíz y encuentra la copia
> equivocada, produciendo `Cannot read properties of null (reading 'useContext')`
> al renderizar en servidor. Hay además un alias de webpack para lo mismo en
> `apps/web/next.config.mjs:250-256`. **No tocar ninguno de los dos por separado.**

> [!important] El hoisting del monorepo condiciona el artefacto de build (13/08)
> Desde F2.1 el build sale también en `output: 'standalone'`
> (`next.config.mjs:119`), y por el mismo hoisting que obliga al alias de arriba
> hace falta `experimental.outputFileTracingRoot` apuntando a la **raíz**
> (`next.config.mjs:124`): las dependencias de `apps/web` no viven en
> `apps/web/node_modules`, así que trazar desde ahí deja el artefacto incompleto.
> Detalle de las dos formas de arrancar en [[entorno-y-despliegue]].

## Lo que NO está instalado, y es deliberado

| Ausente | Por qué importa |
|---|---|
| ORM (Prisma, Drizzle) | Todo el SQL es a mano en `lib/server/*-repo.ts` |
| Librería de auth (NextAuth, iron-session) | Auth propia — ver [[autenticacion-y-sesion]] |
| Librería JWT (`jose`) | El ADR 0012 la evita a propósito (`lib/server/google-oauth.ts:8-12`) |
| Cliente de Resend | Se usa `fetch` directo "para no tocar el package-lock" (`lib/server/email.ts:5`) |
| Redis | `REDIS_URL` está declarada en `.env.example` y `.env.production.example` pero **ningún archivo de la aplicación la lee**; la única mención en código es `lib/entorno.test.ts:307-309`, que la lista como variable muerta |

## Regla del lockfile

`docs/DEPENDENCIAS.md` fija la norma: **nunca tocar `package.json` sin regenerar
`package-lock.json`**, y nada de rangos flotantes en lo crítico. El workflow
`lockfile-check.yml` lo hace cumplir con `npm ci --dry-run` en cada push y PR.

> [!danger] Tres workflows, DOS versiones de node — y el guardián no usa la del build
> Medido el 31/08; líneas y filas actualizadas el 05/10:
>
> | Workflow | node | Qué hace |
> |---|---|---|
> | `ci.yml:60` | **20** | typecheck → test → build |
> | `ci.yml:228` | **20** | el trabajo `e2e` (desde el 07/09, `e126130d`) |
> | `release.yml:152` | **20** | construye y publica la versión |
> | `lockfile-check.yml:18` | **22** | vigila que el lockfile no derive |
>
> **El que vigila el lockfile corre en una versión distinta de la que lo
> produce.** Y el PADRE también corre node 20: por eso el 28/08 un `npm install`
> allí **reescribió `package-lock.json`**, y el procedimiento de despliegue tuvo
> que añadir un `git checkout -- package-lock.json` para deshacerlo
> ([[entorno-y-despliegue]]).
>
> Esto no da error en rojo: da un lockfile distinto cada vez, en silencio. Y es
> justo lo que el modelo de instancias no puede permitirse — dos servidores
> construyendo «la misma versión» con dependencias distintas. Es uno de los
> argumentos del registry (decisión P4, [[modelo-instancias-soberanas]]): si la
> aplicación se **instala** ya empaquetada, deja de construirse en cada máquina y
> la pregunta desaparece.
>
> **2026-10-05:** el registry existe desde el 31/08 y las instancias hijas ya
> **instalan** la imagen en vez de construirla (DEMO desde el 02/09). Donde la
> diferencia de node sigue mordiendo es en el **PADRE**, que todavía construye
> desde el repositorio (`infra/systemd/spaces-web.service:83` arranca `next start`
> sobre `/var/www/Spaces`).

> [!warning] Añadir una dependencia es una decisión, no un detalle
> Este proyecto evita dependencias de forma sistemática y lo justifica por
> escrito cada vez. Antes de añadir una, léete la justificación de la que ya
> evitaron para el mismo problema.

## Relacionadas
[[vision-general]] · [[entorno-y-despliegue]] · [[convenciones]] ·
[[integraciones-externas]] · [[MOC-Proyecto]]

---
tipo: indice
estado: verificado
actualizado: 2026-10-05
tags: [frontend, indice]
archivos:
  - apps/web/app/
  - apps/web/components/
---

# Índice — Frontend

Next.js 14 **App Router**, React 18, Tailwind. **127 archivos en `app/` y 67
componentes**, medidos el 31/08 — el retiro de la pista archivada los bajó de 134 y
71 el 27/08. Hay un `pages/` pero solo con `_error.tsx` (shim); **no es Pages
Router en uso**.

> [!note] 2026-10-05 · remedido: 173 archivos en `app/` y 92 componentes
> `find apps/web/app -type f` da **173**, y `find apps/web/components -name
> '*.tsx'` da **92** (136 archivos en `components/` contando pruebas y módulos
> `.ts` puros). La nota no dejó escrito con qué mandato salieron el 127 y el 67
> del 31/08, así que la comparación con ellos es aproximada: lo seguro es la
> cifra de hoy y el mandato que la reproduce.

> [!note] El «130» que decía aquí no era el de ninguna fecha
> Se escribió el 07/08 y nunca se remidió. Al llegar el retiro del 27/08 el
> número real era **134**, así que la nota ya iba desfasada antes del cambio que
> parecía explicarla.

## Notas de este apartado

| Nota | Cubre |
|---|---|
| [[shell-y-navegacion]] | Layouts anidados, sidebar, topbar, guards de UI |
| [[acceso-y-sesion-ui]] | Login, recuperar contraseña, autoregistro |
| [[modulos-internos]] | Los 30 módulos dentro del shell (33 `page.tsx`) |
| [[pantalla-reportes]] | El tablero de rentabilidad: el límite con el endpoint, el 501 y los vacíos |
| [[comercial-opex]] | Prospección de arrendadores. **MAQUETA sin base**, y se solapa con Captación |
| [[paginas-publicas]] | Portal, firma, propuesta compartible, OT móvil |
| [[estado-y-data-fetching]] | React Query, zustand, el parche de `fetch` |
| [[idiomas-es-en]] | La aplicacion en espanol e ingles: deteccion, cambio manual, el dinero |

## Los tres niveles de layout

| Layout | Qué aporta |
|---|---|
| `app/layout.tsx` | HTML raíz, **las fuentes con `next/font`** (Source Serif 4 + Inter, desde el 28/08), `Providers` |
| `app/(app)/layout.tsx` | Tokens del design system (`.demo-root`), `demo.css`, Toaster |
| `app/(app)/(shell)/layout.tsx` | Sidebar + Topbar + sesión + guards |

Lo que **no** cuelga de `(shell)` va sin chrome: `login`, `recuperar/[token]`,
`contrato/[id]`, `firmar/[token]`, `m/ot/[id]`, `p/[id]`, `portal/[token]`,
`propuesta` y `bienvenida` (el cuestionario de razones sociales).

## Nota sobre nombres

El grupo de rutas se llama `(app)` pero internamente todo el CSS y los
componentes siguen diciendo **«demo»** (`components/demo/…`, `.demo-root`,
`demo.css`). Es histórico. El segmento `/demo` **ya no existe en las URLs**:
`middleware.ts:103-109` redirige `/demo/*` → `/*` con 308 permanente.

## `_legacy` — retirado

`app/_legacy/` contenía 7 páginas archivadas (portal de cliente viejo, login
viejo). **Se retiró el 2026-08-27** con el resto de la pista archivada: su
página de login importaba `useAuth` del `AuthProvider` muerto, y `tsconfig.json`
no excluye nada salvo `node_modules` — dejarla habría roto el typecheck.

Su historia sigue en git y el backend al que servía, en `_archive/api`.

## Cómo se explican estas pantallas a quien las usa

`/reportes`, `/razones-sociales`, `/energia` y `/bienvenida` —las cuatro nacidas el 17 y
el 18/09— están escritas para el usuario final en
[[08-Manuales/manual-usuario-2026-09-18]]. El resto de las pantallas, en
[[08-Manuales/manual-usuario-2026-09-18]].

## Relacionadas
[[MOC-Proyecto]] · [[02-Backend/_indice|Índice de Backend]] ·
[[vision-general]] · [[zonas-de-riesgo]] ·
[[08-Manuales/manual-usuario-2026-09-18]]

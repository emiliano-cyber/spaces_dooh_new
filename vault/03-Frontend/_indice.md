---
tipo: indice
estado: verificado
actualizado: 2026-08-07
tags: [frontend, indice]
archivos:
  - apps/web/app/
  - apps/web/components/
---

# Índice — Frontend

Next.js 14 **App Router**, React 18, Tailwind. 130 archivos en `app/`, 69
componentes. Hay un `pages/` pero solo con `_error.tsx` (shim); **no es Pages
Router en uso**.

## Notas de este apartado

| Nota | Cubre |
|---|---|
| [[shell-y-navegacion]] | Layouts anidados, sidebar, topbar, guards de UI |
| [[acceso-y-sesion-ui]] | Login, recuperar contraseña, autoregistro |
| [[modulos-internos]] | Las 22 pantallas dentro del shell |
| [[paginas-publicas]] | Portal, firma, propuesta compartible, OT móvil |
| [[estado-y-data-fetching]] | React Query, zustand, el parche de `fetch` |

## Los tres niveles de layout

| Layout | Qué aporta |
|---|---|
| `app/layout.tsx` | HTML raíz, **las fuentes con `next/font`** (Source Serif 4 + Inter, desde el 28/08), `Providers` |
| `app/(app)/layout.tsx` | Tokens del design system (`.demo-root`), `demo.css`, Toaster |
| `app/(app)/(shell)/layout.tsx` | Sidebar + Topbar + sesión + guards |

Lo que **no** cuelga de `(shell)` va sin chrome: `login`, `recuperar/[token]`,
`contrato/[id]`, `firmar/[token]`, `m/ot/[id]`, `p/[id]`, `portal/[token]`,
`propuesta`.

## Nota sobre nombres

El grupo de rutas se llama `(app)` pero internamente todo el CSS y los
componentes siguen diciendo **«demo»** (`components/demo/…`, `.demo-root`,
`demo.css`). Es histórico. El segmento `/demo` **ya no existe en las URLs**:
`middleware.ts:29-37` redirige `/demo/*` → `/*` con 308 permanente.

## `_legacy` — retirado

`app/_legacy/` contenía 7 páginas archivadas (portal de cliente viejo, login
viejo). **Se retiró el 2026-08-27** con el resto de la pista archivada: su
página de login importaba `useAuth` del `AuthProvider` muerto, y `tsconfig.json`
no excluye nada salvo `node_modules` — dejarla habría roto el typecheck.

Su historia sigue en git y el backend al que servía, en `_archive/api`.

## Relacionadas
[[MOC-Proyecto]] · [[02-Backend/_indice|Índice de Backend]] ·
[[vision-general]] · [[zonas-de-riesgo]]

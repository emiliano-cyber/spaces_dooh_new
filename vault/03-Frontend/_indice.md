---
tipo: indice
estado: verificado
actualizado: 2026-08-13
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
| `app/layout.tsx` | HTML raíz, las dos fuentes por `next/font` (`--font-display` = Source Serif 4, `--font-sans` = Inter), `Providers` |
| `app/(app)/layout.tsx` | Tokens del design system (`.demo-root`), `demo.css`, Toaster |
| `app/(app)/(shell)/layout.tsx` | Sidebar + Topbar + sesión + guards |

Lo que **no** cuelga de `(shell)` va sin chrome: `login`, `recuperar/[token]`,
`contrato/[id]`, `firmar/[token]`, `m/ot/[id]`, `p/[id]`, `portal/[token]`,
`propuesta`.

## Nota sobre nombres

El grupo de rutas se llama `(app)` pero internamente todo el CSS y los
componentes siguen diciendo **«demo»** (`components/demo/…`, `.demo-root`,
`demo.css`). Es histórico. El segmento `/demo` **ya no existe en las URLs**:
`middleware.ts:37-45` redirige `/demo/*` → `/*` con 308 permanente.

## `_legacy`

`app/_legacy/` contiene 7 páginas archivadas (portal de cliente viejo, login
antiguo). **Fuera del routing.** No tocar, no revivir.

## Relacionadas
[[MOC-Proyecto]] · [[02-Backend/_indice|Índice de Backend]] ·
[[vision-general]] · [[zonas-de-riesgo]]

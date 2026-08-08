---
tipo: modulo
estado: verificado
actualizado: 2026-08-07
tags: [frontend, publico, tokens, amarillo]
archivos:
  - apps/web/app/(app)/portal/[token]/
  - apps/web/app/(app)/firmar/[token]/
  - apps/web/app/(app)/p/[id]/
  - apps/web/app/(app)/m/ot/[id]/
  - apps/web/app/(app)/contrato/[id]/
  - apps/web/lib/server/portal-repo.ts
---

# Páginas públicas (sin sesión)

> [!warning] ZONA AMARILLA
> Son las únicas páginas que ve alguien **de fuera de la organización**. Un fallo
> aquí filtra datos a un tercero, no a un compañero.

## Las cuatro puertas sin sesión

| Página | Credencial | API | Quién la abre |
|---|---|---|---|
| `/portal/[token]` | `campanas.portal_token` | `GET /api/portal/[token]` | El cliente anunciante |
| `/firmar/[token]` | token de firma | `GET·POST /api/firma/[token]` | El arrendador |
| `/p/[id]` | `propuestas.token_publico` | `GET·POST /api/propuestas/publica/[id]` | El cliente/agencia |
| `/m/ot/[id]` | — (**sesión**, sin chrome) | `/api/ot/[id]` | La cuadrilla en campo |

Más `/contrato/[id]` (vista interna del contrato) y `/propuesta`.

## Cómo se resuelve el tenant sin sesión

**Nunca desde el cliente.** Postgres lo deriva del token con
`portal_tenant_por_token()` y `propuesta_tenant_por_token()`
(`20260720_hard1_rls_todas_tablas.sql`). Ver [[multi-tenancy-y-rls]].

## Qué se expone, y qué no

`lib/server/portal-repo.ts:10-12`: el portal devuelve **solo** lo de esa
campaña — nada de otros clientes ni datos financieros.

> [!danger] Al añadir un campo al portal, comprueba que no arrastre precio
> El repo mapea con `rowToCampana`/`rowToReserva`/`rowToSitio`, que son las
> **mismas** funciones del lado interno. Añadir un campo interno a esos mapeos
> lo publica en el portal sin que nadie lo note.

## Exención de CSRF

Estas rutas están exentas del double-submit (`middleware.ts:55-65`) porque **no
dependen de la cookie de sesión**: la credencial es el token del enlace. Si
alguna empezara a leer la cookie, la exención se vuelve un agujero.

## Marca en las páginas de cara al cliente

El portal y la hoja de firma pintan el **logo y el nombre de la organización que
presta el servicio**, no un nombre fijo (`docs/Registro_Cambios.md`, 06/08). Si
la organización no cargó logo, se quedan como estaban.

Se dejan fuera a propósito la **pantalla de acceso** y la de **consultar
propuesta por código**: ahí todavía no se sabe de qué organización es quien
mira, así que no hay logo correcto que poner.

El logo se sirve por `GET /api/logo/[token]` (público, token en
`config_negocio.logo_token`).

> [!note] La barra final del logo ya costó un redespliegue
> Commit `104c019`: *"la URL del logo termina en barra, o en el correo
> redirige"*. Ver [[entorno-y-despliegue]].

## Módulo móvil de OT

`/m/ot/[id]` va sin chrome para la cuadrilla. **Sí exige sesión** — no es
público, solo es una vista distinta.

> [!bug] `OTMovil.tsx` depende del `AuthProvider` muerto
> `components/operaciones/OTMovil.tsx:6,190`. Ver [[preguntas-abiertas]].

## Relacionadas
[[comercial-propuestas-campanas]] · [[arrendadores-y-contratos]] ·
[[multi-tenancy-y-rls]] · [[03-Frontend/_indice|Índice de Frontend]] ·
[[MOC-Proyecto]]

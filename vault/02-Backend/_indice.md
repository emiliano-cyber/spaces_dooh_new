---
tipo: indice
estado: verificado
actualizado: 2026-09-17
tags: [backend, indice]
archivos:
  - apps/web/app/api/
  - apps/web/lib/server/
---

# Índice — Backend

El backend es un **BFF dentro de la propia app Next**: **94** Route Handlers
sobre **97** archivos en `apps/web/lib/server/` —60 de módulo y 37 de prueba—.
No hay servicio aparte.

> [!tip] Recuento medido el 2026-09-17, no copiado
> `find app/api -name route.ts | wc -l` y `ls lib/server/*.ts | wc -l`. La
> medición anterior (27/08) decía 90 y 89: los dos números se habían quedado
> atrás, y este archivo es de los que más caro cuesta tener mal. Si lo necesitas
> exacto, vuelve a correr esas dos líneas en tu propio árbol — cada worktree está
> en una rama distinta y da un recuento distinto.

## Notas de este apartado

| Nota | Cubre |
|---|---|
| [[api-endpoints]] | Los 90 endpoints con método, guard y módulo |
| [[autenticacion-y-sesion]] | Cookie, sesión, CSRF, RBAC, reautenticación |
| [[multi-tenancy-y-rls]] | Aislamiento entre organizaciones |
| [[inventario-y-sitios]] | Pantallas, predios, modalidades, importación |
| [[arrendadores-y-contratos]] | Arrendadores, contratos, rentas, firma — la razón social de quien me **COBRA** |
| [[entidades-fiscales]] | Las razones sociales **PROPIAS** del owner: quien **PAGA**, compra activos, tramita licencias o vende |
| [[comercial-propuestas-campanas]] | Propuestas, reservas, campañas, creativos |
| [[operaciones-y-ot]] | Órdenes de trabajo, evidencias, imprenta, almacén |
| [[finanzas-y-cobranza]] | Facturación, candado, parcialidades |
| [[integraciones-externas]] | DOOHmain, Space Eye, S3, Resend, Google, cron |
| [[infraestructura-servidor]] | Pool, errores, folios, rate limit, subidas |

## Las tres capas

`route.ts` (guard + HTTP) → `*-controller.ts` (zod + reglas) → `*-repo.ts` (SQL).
Detalle en [[vision-general]] y [[convenciones]].

## Los archivos más grandes

Tamaño = superficie de conflicto entre agentes. Ver [[AGENTES]].

| Archivo | Líneas | Zona |
|---|---|---|
| `lib/server/arrendadores-repo.ts` | 1317 | [[arrendadores-y-contratos]] |
| `lib/server/campanas-repo.ts` | 1214 | [[comercial-propuestas-campanas]] |
| `lib/server/sitios-repo.ts` | 624 | [[inventario-y-sitios]] |
| `lib/server/propuestas-repo.ts` | 593 | [[comercial-propuestas-campanas]] |
| `lib/server/arrendadores-controller.ts` | 460 | [[arrendadores-y-contratos]] |
| `lib/server/firmas-repo.ts` | 336 | [[arrendadores-y-contratos]] |
| `lib/server/contratos-sitio.ts` | 336 | [[arrendadores-y-contratos]] |
| `lib/server/doohmain.ts` | 313 | [[integraciones-externas]] |
| `lib/server/finanzas-repo.ts` | 298 | [[finanzas-y-cobranza]] |
| `lib/server/google-oauth.ts` | 289 | [[autenticacion-y-sesion]] |

## Relacionadas
[[MOC-Proyecto]] · [[03-Frontend/_indice|Índice de Frontend]] · [[esquema]] ·
[[zonas-de-riesgo]]

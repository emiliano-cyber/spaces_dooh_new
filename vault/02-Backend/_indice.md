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

El backend es un **BFF dentro de la propia app Next**: los Route Handlers de
`apps/web/app/api/**/route.ts` sobre los archivos de `apps/web/lib/server/`. No
hay servicio aparte.

> [!warning] No copies de aquí un recuento — mídelo
> El párrafo anterior decía «90 route handlers sobre 89 archivos, medidos el
> 27/08». Esa cifra ya no vale: el 17/09 nació `/api/reportes/rentabilidad`
> ([[reportes-rentabilidad]]) y con él tres archivos de `lib/server/`. Si
> necesitas el número, cuéntalo — es el mismo aviso que `convenciones.md` da
> para las pruebas, y por el mismo motivo.

## Notas de este apartado

| Nota | Cubre |
|---|---|
| [[api-endpoints]] | Los 90 endpoints con método, guard y módulo |
| [[autenticacion-y-sesion]] | Cookie, sesión, CSRF, RBAC, reautenticación |
| [[multi-tenancy-y-rls]] | Aislamiento entre organizaciones |
| [[inventario-y-sitios]] | Pantallas, predios, modalidades, importación |
| [[arrendadores-y-contratos]] | Arrendadores, contratos, rentas, firma |
| [[comercial-propuestas-campanas]] | Propuestas, reservas, campañas, creativos |
| [[operaciones-y-ot]] | Órdenes de trabajo, evidencias, imprenta, almacén |
| [[finanzas-y-cobranza]] | Facturación, candado, parcialidades |
| [[reportes-rentabilidad]] | El límite `/api/reportes/*` y el prorrateo por periodo |
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
| `lib/server/reportes-repo.ts` | 159 | [[reportes-rentabilidad]] |

## Relacionadas
[[MOC-Proyecto]] · [[03-Frontend/_indice|Índice de Frontend]] · [[esquema]] ·
[[zonas-de-riesgo]]

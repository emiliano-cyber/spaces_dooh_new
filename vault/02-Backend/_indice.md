---
tipo: indice
estado: verificado
actualizado: 2026-09-21
tags: [backend, indice]
archivos:
  - apps/web/app/api/
  - apps/web/lib/server/
---

# Índice — Backend

El backend es un **BFF dentro de la propia app Next**: **99** Route Handlers
sobre **111** archivos en `apps/web/lib/server/`.
No hay servicio aparte.

> [!tip] Recuento medido el 2026-09-21, en esta rama, con `node scripts/recuentos.mjs`
> Decía 96/105 (18/09) y ya se había quedado atrás, otra vez, dos commits
> después de medirse. `find app/api -name route.ts | wc -l` y `ls lib/server/*.ts
> | wc -l` cuadran con lo que imprime el script. La medición del 27/08 decía 90 y
> 89, y las dos se habían quedado atrás. Y ojo con
> el modo en que este número engaña al fusionar: la rama de entidades midió 94 y
> la de reportes se negó a dar cifra, **y las dos tenían razón en su árbol** —
> juntas nacen `/api/entidades`, `/api/entidades/[id]` y
> `/api/reportes/rentabilidad`. Si lo necesitas exacto, corre esas dos líneas en
> TU árbol: cada worktree está en una rama distinta y da un recuento distinto.

## Notas de este apartado

| Nota | Cubre |
|---|---|
| [[api-endpoints]] | Los 96 endpoints con método, guard y módulo |
| [[autenticacion-y-sesion]] | Cookie, sesión, CSRF, RBAC, reautenticación |
| [[multi-tenancy-y-rls]] | Aislamiento entre organizaciones |
| [[inventario-y-sitios]] | Pantallas, predios, modalidades, importación |
| [[arrendadores-y-contratos]] | Arrendadores, contratos, rentas, firma — la razón social de quien me **COBRA** |
| [[entidades-fiscales]] | Las razones sociales **PROPIAS** del owner: quien **PAGA**, compra activos, tramita licencias o vende |
| [[comercial-propuestas-campanas]] | Propuestas, reservas, campañas, creativos |
| [[operaciones-y-ot]] | Órdenes de trabajo, evidencias, imprenta, almacén |
| [[finanzas-y-cobranza]] | Facturación, candado, parcialidades |
| [[reportes-rentabilidad]] | El límite `/api/reportes/*` y el prorrateo por periodo |
| [[reportes-dimensiones]] | Las cuatro dimensiones y la atribución **consciente del periodo** |
| [[reportes-por-razon-social]] | La sexta dimensión: cuánto pasa por cada razón social, y por qué no pinta margen |
| [[tarifa-publicada-vs-neta]] | La séptima: qué tarifa se **publicó** y qué entró de ella. Las dos convenciones de precio y el guard que las sobrevive |
| [[rejilla-franja-y-temporada]] | **ADR 0039, Fase 1**: el precio deja de ser un número y pasa a ser `f(pantalla, unidad, franja, fecha)`. Las dos decisiones de diseño, el congelado, y por qué la franja NO viaja al CMS |
| [[descuento-por-volumen]] | **ADR 0039, Fase 2**: «compra 50 spots y pagas 40». Por qué la escala cuelga de la organización y por qué los tramos son planos; si el volumen cuenta contra el tope; y cómo se congela |
| [[codigo-promocional]] | **ADR 0039, Fase 3**: «usa este código y ten un 20 % adicional». Cómo se resuelve **la carrera del último uso** con un `for update`; por qué el canje se cuenta al APLICAR y no al aprobar; por qué el cupón **no** cuenta contra el tope; y cómo se congela |
| [[paquete-cerrado]] | **ADR 0039, Fase 4**: «estas cinco pantallas, prime, un mes: 180 000». El único escalón que **sustituye** el precio en vez de modificarlo. Cómo se **reparte** entre las pantallas cuadrando al peso (mayor resto); por qué un paquete **no admite volumen** y solo admite cupón con su bandera; por qué sale con **raya** del reporte publicada vs neta; y cómo se congela |
| [[vendedor-en-propuesta]] | La octava: quién vendió y cuánto descuento concedió. El dato que faltaba, y el histórico que no se puede recuperar |
| [[cuestionario-bienvenida]] | El cuestionario que crea las razones sociales del owner al entrar |
| [[integraciones-externas]] | DOOHmain, Space Eye, S3, Resend, Google, cron |
| [[infraestructura-servidor]] | Pool, errores, folios, rate limit, subidas |
| [[actualizaciones-instancia]] | ADR 0037: cada instancia elige si toma la versión nueva — el mapa de las cuatro piezas |

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

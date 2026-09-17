---
tipo: modulo
estado: verificado
actualizado: 2026-09-17
tags: [backend, reportes, rentabilidad, finanzas, dinero, rojo]
archivos:
  - apps/web/app/api/reportes/rentabilidad/route.ts
  - apps/web/lib/server/reportes-controller.ts
  - apps/web/lib/server/reportes-repo.ts
  - apps/web/lib/data/reportes.ts
  - apps/web/lib/data/derive.ts
  - apps/web/lib/costos-ot.ts
  - apps/web/lib/server/config-repo.ts
  - db/migrations/20260917_costos_ot_por_tipo.sql
---

# Reportes de rentabilidad

`GET /api/reportes/rentabilidad` es el **límite** entre las pantallas de
reportes y el cálculo. Nació el **2026-09-17** con el módulo de rentabilidad.

> [!important] Los reportes NO pasan por el store, y esto es LO ÚNICO importante de esta nota
> Hoy **toda la analítica de SPACE OS se calcula en el navegador**.
> `GET /api/estado` devuelve **23 rebanadas de tablas completas**
> (`app/api/estado/route.ts:97-124`), el front las mete en el store de zustand
> ([[03-Frontend/estado-y-data-fetching]]) y deriva los márgenes con
> `useStoreMemo` (`lib/data/client.ts:329`).
>
> **Ese endpoint ya se descontroló una vez: 6.12 MB** —contratos 3.95 · sitios
> 1.0 · sitiosRed 1.0— **y el síntoma fue una pantalla en blanco de 6 a 12
> segundos, no un error.** Lo cuenta su propio código en
> `app/api/estado/route.ts:132-141`, junto al medidor que se dejó detrás de la
> bandera `MEDIR_ESTADO=1` precisamente para poder volver a mirarlo. Un
> `select *` con una columna nueva y grande basta para repetirlo.
>
> Los reportes de rentabilidad verán **historia de años** cuando haya clientes
> reales. Por ese camino no aguantan: el volumen crecería con la antigüedad de
> la cuenta, no con el periodo consultado.
>
> Por eso las pantallas de reportes hablan con `/api/reportes/*` **desde el día
> uno**. Detrás, esta primera versión reusa la lógica que ya existía
> ejecutándola en el **servidor**, así que el porte a agregación SQL real —que
> es lo que vendrá— **no tocará ni una pantalla**. Si el límite no naciera ahora
> costaría cero; nacer después costaría rehacer las cinco pantallas, y entonces
> ya no se haría.

## Las cuatro capas

`route.ts` (guard + HTTP) entra a `reportes-controller.ts` (zod + dimensión),
que llama a `reportes-repo.ts` (SQL), que usa `db.ts`. Más
`lib/data/reportes.ts`, que es la aritmética pura y **no la importa ninguna
pantalla**.

| Archivo | Qué hace |
|---|---|
| `app/api/reportes/rentabilidad/route.ts` | `exigir('finanzas','ver')`, `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `respuestaError(e)` |
| `lib/server/reportes-controller.ts:81` | `validarConsultaRentabilidad` — zod, enums cerrados |
| `lib/server/reportes-controller.ts:95` | `rentabilidadCtrl` — despacha por dimensión, 501 si no hay motor |
| `lib/server/reportes-repo.ts:50` | `datosRentabilidad` — las 5 consultas + el costo de OT |
| `lib/data/reportes.ts:300` | `rentabilidadPorSitio` — el prorrateo |
| `lib/data/reportes.ts:207` | `bucketsDelRango` — el eje de tiempo |
| `lib/data/reportes.ts:266` | `mesesEquivalentes` — días de calendario a meses de renta |

## Por qué `finanzas` y no `dashboard`

Un reporte de rentabilidad es **dinero**: enseña lo que se cobra por cada
pantalla y lo que se le paga a cada arrendador. No es un indicador de vitrina, y
con `dashboard` lo vería cualquier rol que pueda abrir el tablero. El guard de
`reportes-repo.aislamiento.test.ts` lo comprueba leyendo el `route.ts`, así que
cambiarlo a `dashboard` pone la suite roja.

## Los parámetros son ENUMS CERRADOS

```
GET /api/reportes/rentabilidad?dimension=sitio&granularidad=mes
                              &desde=2026-01-01&hasta=2026-03-31
```

| Parámetro | Valores | Nota |
|---|---|---|
| `dimension` | `sitio` · `trimestre` · `operacion` · `m2` | solo `sitio` tiene motor; las otras **501** |
| `granularidad` | `mes` · `trimestre` | `dia` y `semana` existen en `Granularidad` y **no valen aquí** |
| `desde` / `hasta` | `AAAA-MM-DD`, inclusive | **obligatorias**, sin valor por omisión |

> [!danger] Un agrupador como texto libre es inyección por la puerta de servicio
> `dimension` y `granularidad` acaban decidiendo **por qué se agrupa**. Se
> validan con `z.enum` antes de tocar la base, y **ninguna de las dos llega
> nunca al SQL**: el agrupado lo hace el motor puro. `reportes-repo.ts` no
> interpola nada y hay un guard que lo comprueba archivo en mano — ni una
> interpolación dentro de una consulta, ni una fecha literal.
>
> El schema es `.strict()`: un `?granularidadd=mes` con typo da **400** en vez
> de devolver el reporte de otro periodo del que se pidió sin que nadie lo note.
> Y **no hay por dónde mandar un tenant**: sale siempre de la sesión.

Las fechas **no tienen valor por omisión** a propósito. Un rango por omisión
sobre historia de años es una consulta sin límite disfrazada de comodidad, que
es exactamente el problema del que este endpoint nace.

El rango invertido se rechaza con 400, y se detecta con `diaComparable`
(`lib/server/fechas.ts`) y no comparando texto: `2026-9-1` va antes que
`2026-10-01` en el calendario y después como cadena. Ese defecto **ya se pagó
dos veces** en este repo, y rechazaba periodos correctos además de dejar pasar
los invertidos.

## Las tres dimensiones sin motor devuelven 501

No 404 y no 400. La dimensión **es** parte del contrato del endpoint, solo que
todavía no tiene implementación: un 404 diría «esto no existe» y un 400 «lo
pediste mal», y ninguna de las dos es verdad. El mensaje dice **cuál** falta
(«por metro cuadrado todavía no está disponible»), y el corte ocurre **antes de
leer la base**: pagar la consulta para tirarla no tiene sentido.

## Qué se reusa y qué es nuevo

> [!tip] La atribución de renta NO se rehizo — se movió, y no se copió
> `rentaAtribuidaPorSitio()` (`lib/data/derive.ts:1282`) reparte la renta del
> contrato de un predio entre las caras de sus pantallas y distingue el contrato
> de predio del contrato de pantalla suelta. Está pensada y probada
> (`derive.anclaje-contrato.test.ts`, `derive.pnl.test.ts`), y esas dos pruebas
> **pasan sin tocarse** tras este cambio.
>
> Lo único que cambió en ellas es la FIRMA: de `DemoState` a `DatosAtribucion`
> (`derive.ts:1239` y `:1282`), una interfaz con solo `sitios` y `contratos`.
> `DemoState` sigue encajando por estructura, así que ni un llamador de la UI se
> tocó, y el servidor puede reusarla sin fabricar un `DemoState` entero con
> veintitantas rebanadas vacías.
>
> La alternativa era copiar la atribución al servidor. Este repo documenta esa
> clase de error como su error de raíz (`lib/server/tenant.ts:87-89`): **dos
> implementaciones divergen**, y aquí divergir significa que el reporte y el
> dashboard darían dos costos distintos para la misma pantalla.

**Es nuevo el eje de tiempo.** `margenPorSitio()` (`derive.ts:1308`) es una
**foto de hoy**: filtra las reservas vigentes hoy (`derive.ts:1315`) y no sabe
de periodos.

También es nuevo `'trimestre'` en `Granularidad` (`derive.ts:1483`) y su
etiquetado, y `etiquetaBucket` pasó a **exportarse** (`derive.ts:1551`): dos
etiquetados del mismo bucket acabarían diciendo «T1» en una pantalla y «1er
trimestre» en la otra para el mismo periodo.

## El prorrateo — la fórmula y su porqué

### Ingreso: por DÍAS

```
ingreso = precio × (días de la reserva dentro del periodo / días totales de la reserva)
```

El precio de una reserva es el de **todo** su periodo —así se captura y así se
factura—, así que meterlo entero en el bucket donde empieza haría que una
campaña de marzo a abril pareciera ingreso de marzo. Se reparte por **días** y
no por meses porque el ingreso se devenga cada día que la pantalla exhibe.

La propiedad que lo hace usable: **no pierde ni inventa dinero.** Una reserva del
15/03 al 15/04 por 31 000 (32 días) aporta `31 000 × 17/32 = 16 468.75` al T1 y
`31 000 × 15/32 = 14 531.25` al T2 — y los dos suman 31 000 exactos. Está
calculado a mano en `lib/data/reportes.test.ts`.

### Costo del espacio: por MESES de calendario

```
costoEspacio = renta mensual atribuida × meses equivalentes del periodo
```

Un mes natural completo vale **1**, tenga 28, 30 o 31 días, y un trimestre vale
3. Dividir los días por un 30 fijo haría que febrero costara 28/30 de mes y
julio 31/30: **la renta se paga una vez por mes, no por día**. Un mes a medias
vale la fracción de *sus* días naturales, y eso hace la función aditiva — por eso
el desglose por periodo cuadra siempre con el total de la fila.

Se recorta a la **vigencia** del contrato. Sin ese recorte, el reporte de un
trimestre de 2025 cobraría un contrato firmado en 2026, y toda pantalla con
contrato aparecería con costo en cualquier rango que se pidiera.

### Costo de operación: por EVENTO

Una orden de trabajo **no se prorratea**: es un evento, y su costo entra completo
en el periodo en que se trabaja. El importe sale por **tipo** de OT desde
`config_negocio.costos_ot` — ver [[02-Backend/operaciones-y-ot]].

La fecha con la que una OT entra en un periodo es la de completada, si no la
programada, y si no la de creación (`lib/data/reportes.ts:295`). El costo se
devenga cuando el trabajo ocurre, y una OT pendiente ya tiene fecha prevista:
contarla por su creación la metería en el mes en que se capturó.

> [!warning] Esa prelación está escrita DOS veces, y por eso hay un guard
> El `where` de `reportes-repo.ts` decide qué OT **llegan**; `fechaDeOt()` decide
> en qué periodo **caen**. Si las dos difirieran, una OT quedaría fuera del
> reporte sin aparecer en ningún periodo y **sin dar error**.
> `reportes-repo.aislamiento.test.ts` compara las dos listas y se pone rojo si
> alguien cambia una sola.

## Reparto de responsabilidades entre el SQL y el motor

Deliberado, y conviene entenderlo antes de tocar el `where`:

- **El SQL acota por lo que es PARÁMETRO DEL REPORTE** —el rango de fechas— y no
  aplica ninguna regla de negocio. Ahí está el ahorro: reservas y órdenes de
  trabajo llegan ya recortadas al periodo.
- **Las reglas de negocio las decide el motor puro.** Qué estatus de reserva
  cuenta (`CANCELADA` no suma; `TENTATIVA` sí, el lugar ya está apartado), qué
  contrato está activo y cómo se atribuye la renta. Si el `where` repitiera esas
  reglas habría dos copias de cada una.

Una reserva entra si **solapa** el periodo, no si empieza dentro: una campaña
anual toca los cuatro trimestres y aporta su parte a cada uno.

## Aislamiento (R2)

Las cinco consultas usan `q()` —que fija `app.tenant_id` transaction-local— y
llevan **`and tenant_id = $1` explícito** como segunda capa sobre la RLS. Nunca
`qRaw()`. `reportes-repo.aislamiento.test.ts` lee el archivo y falla si
cualquier consulta pierde su filtro, si aparece un `qRaw` o si algo se interpola.

> [!danger] Ese guard es de CÓDIGO, no de base
> **Las pruebas unitarias no ven los fallos de RLS**: simulan la base. Los dos
> peores fallos de aislamiento de este proyecto pasaron las unitarias sin
> despeinarse. Lo que el guard comprueba es que el filtro **esté escrito**, que
> es exactamente lo que falló las dos veces. La otra mitad —que la RLS corte de
> verdad **con el rol de la aplicación**— la verifica
> `aislamiento.e2e.test.ts`, que **no se toca**. Ver [[multi-tenancy-y-rls]].

Las fechas de calendario salen del SQL como **texto**, con `to_char`, y no como
`Date` del driver: `pg` entrega un `date` como Date a medianoche local y el
`iso()` de los otros repos lo pasa por `toISOString()`, que la corre a UTC — en
México (UTC−6) eso devuelve el **día anterior**. Ese error ya se pagó aquí (ver
`diasHasta` en `derive.ts`), y en un reporte prorrateado por días desplazaría
dinero de un periodo a otro sin dar ningún síntoma.

## Lo que esta primera versión NO hace

Dicho aquí para que no sorprenda a quien lea los números:

1. **El costo usa el contrato vigente HOY.** La atribución que se reusa resuelve
   con `contratoActivo()` (`derive.ts:1133`), que solo acepta `VIGENTE`,
   `POR_VENCER` y `RENOVADO`. Consecuencia: un reporte de un trimestre pasado
   **no ve** un contrato que ya venció en ese trimestre, y un cambio de renta a
   mitad de año se aplica hacia atrás. Lo que sí respeta es la **vigencia** del
   contrato que encuentra. Arreglarlo pide una atribución consciente del periodo,
   y esa es la pieza que el porte a agregación SQL tiene que traer.
2. **No hay agregación en SQL.** El motor lee y suma en Node. El límite existe
   para que ese porte sea invisible desde las pantallas.
3. **`trimestre`, `operacion` y `m2` como dimensión devuelven 501.**
4. **Una pantalla sin ingreso, sin renta y sin OT en el rango no aparece.** Un
   reporte con quinientas filas a cero no se lee, y las que importan —las que
   cuestan sin vender— tienen costo, así que salen igual. De ahí que un rango sin
   movimiento dé **cero filas y no un error**.

El `margenPct` es **`null`** cuando no hubo ingreso, no 0: un «0 %» sobre una
pantalla con 15 000 de renta y cero ventas se lee como «no gana ni pierde», que
es lo contrario de lo que pasó.

Las filas salen ordenadas por **peor margen primero**: la pregunta que contesta
este reporte es «¿qué pantallas están perdiendo dinero?».

## Pruebas

| Archivo | Qué ancla |
|---|---|
| `lib/data/reportes.test.ts` | El prorrateo, los buckets, `mesesEquivalentes`, los negativos. **Todas las cifras calculadas a mano en los comentarios** |
| `lib/server/reportes-controller.test.ts` | Los enums cerrados, el rango invertido, el `.strict()`, el 501 sin leer la base |
| `lib/server/reportes-repo.aislamiento.test.ts` | `tenant_id` en toda consulta, nada de `qRaw`, cero interpolación, `finanzas` en el route, la no divergencia con el motor |
| `lib/costos-ot.test.ts` · `lib/data/derive.costos-ot.test.ts` | El costo de OT por tipo y su respaldo |

> [!warning] Lo que falta correr, y no se corrió a propósito
> Este trabajo se hizo con el puerto **3311** y la base **`spaces_e2e`**
> ocupados por otro agente, así que **no se corrió ninguna e2e**: colisionar
> habría dado rojos falsos a los dos. Cuando el arnés quede libre hay que correr
> `cd apps/web && npm run build && npm run test:e2e` —con el build ANTES, o
> fallan todas en falso— y en particular `aislamiento.e2e.test.ts`, que es la
> única que comprueba la RLS con el rol de la aplicación. **Falta además una e2e
> propia del endpoint**: dos organizaciones con reservas en el mismo periodo, y
> que el reporte de una no traiga ni una fila de la otra.

## Relacionadas
[[02-Backend/_indice]] · [[02-Backend/finanzas-y-cobranza]] ·
[[03-Frontend/estado-y-data-fetching]] · [[02-Backend/operaciones-y-ot]] ·
[[multi-tenancy-y-rls]] · [[arrendadores-y-contratos]] · [[zonas-de-riesgo]] ·
[[convenciones]] · [[MOC-Proyecto]]

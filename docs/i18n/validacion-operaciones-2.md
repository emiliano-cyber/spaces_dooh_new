# Validación · lote de inglés «operaciones (parte 2)»: OT, Creativos, Dashboard y Energía

- **Rama:** `feat/ingles-operaciones-2` (worktree `.claude/worktrees/ingles-operaciones-2`). Revisé `git diff 34022673..HEAD`: 6 commits (`54bad127`, `c330473b`, `30397534`, `2208c1b3`, `a3d273a1`, `538ba751`) y 34 archivos.
- **Fecha:** 2026-11-02 · **Validador:** agente independiente. No corrige código. Este informe es lo único que escribe y no lo commitea.

## Veredicto: **ÁMBAR**. Se puede integrar; conviene corregir antes lo de severidad media

Lo que comprobé de forma mecánica, no leyendo:

- **El Dashboard solo cambió texto.** Las cadenas `className` de `inicio/page.tsx`, `charts.tsx` e `indicadores.ts` son idénticas entre `34022673` y HEAD. La única diferencia es el renombre de la variable `t` → `tr` dentro de una de ellas. La secuencia de etiquetas JSX también es idéntica; solo se añaden tres genéricos de TypeScript (`Record<TipoAlerta, …>`). Los 7 estados del Dashboard en español salen idénticos byte a byte.
- **El español está intacto.** Los **42 de 42** estados son idénticos byte a byte (`cmp`) entre los componentes de `34022673` y los de HEAD. Además, **85 casos** de las funciones de `lib/` con idioma nuevo, versión vieja contra nueva, dan lo mismo sin idioma y con `'es'`. Entre ellos está el objeto **completo** de `dashboardMetrics`.
- **Typecheck y unitarias en verde.** De los 9 mutantes, mueren los 6 de texto. Sobreviven los 3 de clases CSS, y es un hueco conocido (§6).
- **No se tocó nada prohibido.** Ningún `desktop.ini`. Ni una cifra ni un símbolo de moneda en el diccionario.

El inglés se lee como software B2B y respeta el glosario: work order, crew, due date, assignee, Low/Normal/High/Urgent, «keep the billing lock closed», proof photo, location stamp, withdrawn, revenue, close rate, receivables by age, legal hold, trade name, Printing, «Power usage», «bill issued EVERY TWO MONTHS» y «electricity bill».

Hay **6 hallazgos de severidad media**:

- dos plurales rotos que se ven en el render de Energía («All 1 file were read», «the 1 months you declared»);
- un enum español pintado crudo en las alertas del Dashboard («vandalismo», «otro»);
- otro enum crudo posible en Creativos («HIBRIDA»);
- una frase que se lee al revés en Huecos («no client leaves»).

Hay además unos 10 de severidad baja. El inglés sigue apagado (`IDIOMA_INGLES` no se tocó), así que nada de esto bloquea.

---

## 1 · Hallazgos de sentido en contexto

La columna «archivo:línea» lleva primero la línea del valor `en` y después el punto de uso. Leí las 463 claves (202 `operaciones2`, 141 `inicio`, 120 `energia`) y el HTML inglés de los 42 estados, volcado con una copia temporal de las tres pruebas de pantallas. La copia ya está borrada.

| clave | archivo:línea | inglés actual | problema | propuesto | sev. |
|---|---|---|---|---|---|
| `energia.lectura.ok` (+ `.archivo.*`, `.renglon.*`) | energia.ts:294 · `recibos.ts:302` | `All {total} {archivos} were read and they produce {filas} {renglones}.` | **Visto en el render** (`energia-09`): «All 1 file were read and they produce 1 row.» El verbo no concuerda y «All 1» no se dice. | Partirlo en `.uno`/`.otros` por `total`: `.uno` → `The file was read and it produces {filas} {renglones}.` y `.otros` → `All {total} files were read and they produce {filas} {renglones}.` | media |
| `energia.lectura.desajuste.uno/.otros` y `energia.lectura.cubre.otros` | energia.ts:285-288 · `recibos.ts:327-340` | `{n} don’t match the {esperados} months you declared` · `{base}: all {n} cover {unico} calendar months` | **Visto en el render** (`energia-08`): «2 don’t match the 1 months you declared: all 2 cover 3 calendar months». `esperados` vale de 1 a 4, y con 1 sale «the 1 months». «All 2» por «both». El español arrastra el mismo «los 1 meses», pero en español no cambia nada. | `…the {esperados} month(s) you declared`, o un plural por `esperados`. `cubre.otros` → `{base}: they all cover {unico} calendar months` | media |
| (sin clave) tipo de incidencia en la alerta | `derive.ts:1042` | `Pantalla Reforma — vandalismo` · `Site — otro` | **Visto en el render** (`inicio-01`). `inc.tipo.toLowerCase()` pinta el enum `TipoIncidencia` (`types.ts:60`: CLIMA, MANTENIMIENTO, LEGAL, VANDALISMO, SUSPENSION_OPERATIVA, ACCIDENTE, OTRO). En inglés sale en español. La prueba lo da por bueno en `COMUNES` como «datos de prueba» (`pantallas-inicio.test.ts:350`), y **no es un dato: es un enum.** En español ya salía crudo, así que no hay regresión. | Un mapa `CLAVE_INCIDENCIA` → `inicio.incidencia.*` (Weather, Maintenance, Legal, Vandalism, Operational suspension, Accident, Other), solo cuando `idioma !== 'es'`. En español se queda `toLowerCase()`, como hoy. Quitar las dos frases de `COMUNES`. | media |
| (sin clave) tipo de campaña en la tarjeta | `creativos/page.tsx:553` | `CA-c1 · DIGITAL` | `campana.tipoCampana` se pinta crudo. El enum es `OOH`/`DOOH`/`HIBRIDA` (`db/schema.sql:47`). Una campaña híbrida tiene pantallas digitales y sale en Creativos como «HIBRIDA». Es el mismo caso que el validador de Campañas cazó en `campanas/page.tsx:145`. (Detalle: el estado de prueba usa `'DIGITAL'`, que no es un valor válido del enum, así que no lo ve.) | Reusar `campanas.tipo.*`, que ya está en la base. En español, el valor crudo como hoy. | media |
| `inicio.sale` + `inicio.sin-cliente` | inicio.ts:274-275 · `inicio/page.tsx:509` | `{cliente} leaves · {campana} · ends {fecha}` · `no client` | **Visto en el render**: «no client leaves · Otoño · ends Nov 20, 2026» se lee como «no se va ningún cliente», justo lo contrario. Con cliente se entiende («Cliente Uno leaves»), pero suena raro. | `Ending: {cliente} · {campana} · {fecha}`, con `sin-cliente` → `No client`. O bien `{cliente} · {campana} · ends {fecha}`. | media |
| `energia.lectura.alerta` | energia.ts:292 · `recibos.ts:287` | `{leidos} of {total} files were read and they produce {filas} rows.` | Sin plural: con un solo renglón saldría «1 rows», y con un archivo, «1 of 1 files». No se ve en el render porque el estado usa 2 y 3. | `filas` con `energia.lectura.renglon.*`, como hace `.ok`: `…and they produce {filas} {renglones}.` | baja |
| `operaciones2.ot.nueva.asignar` | operaciones2.ts:336 · `operaciones/page.tsx:574` | `Assign to (assignee)` | Redundante. El paréntesis del español («Asignar a (responsable)») explica el término, y en inglés repite lo mismo. | `Assign to` o `Assignee` | baja |
| `operaciones2.creativos.vacio.sin-digitales-detalle.uno` | operaciones2.ts:405 · `creativos/page.tsx:253` | `…Your {n} campaign is on static media…` | Visto en el render: «Your 1 campaign is on static media». | `…Your only campaign is on static media: its artwork is handled in Printing.` (sin `{n}`; habría que declarar el hueco distinto, o dejar `{n}` y aceptarlo) | baja |
| `operaciones2.creativos.eliminar.cuerpo` | operaciones2.ts:466 · `creativos/page.tsx:915` | `…If it is already published, its campaign is finished, but…` | «su campaña se finaliza» es una acción en DOOHmain, y «is finished» parece un estado ya dado. | `…If it is already published, its campaign in DOOHmain is ended, but…` | baja |
| `energia.sin-numero` | energia.ts:221 · `RejillaCaptura.tsx:112/115`, `captura.ts:397` | `no number` | aria-label «Delete the bill for meter no number» y confirmación «…for meter no number, for Jan 2026…». | `(no number)`, o «unnumbered» con la frase «Delete the bill for the unnumbered meter» | baja |
| `energia.puntos.uno/.otros` | energia.ts:183-184 · `energia/page.tsx` | `{n} point(s)` | «2 months · 3 points» no dice de qué son los puntos. | `{n} metering point(s)` (el término ya está en `energia.cargando-puntos`) | baja |
| `energia.leido.facturacion` | energia.ts:304 · `recibos.ts:363` | `billing {monto}` | Es el «Facturación del periodo» del recibo de CFE: un importe, no una acción. | `period charges {monto}` | baja |
| `inicio.huecos-sub` | inicio.ts:268 · `inicio/page.tsx:487` | `what is left without a campaign in the next {n} days` | Torpe. `huecos-nada` dice «Nothing becomes free in the next {n} days». | `what becomes free in the next {n} days` | baja |
| `inicio.tramo.d90` | inicio.ts:288 | `Over 90` | Los otros tramos llevan «days» y este se queda sin unidad. | `Over 90 days` | baja |
| `operaciones2.ot.kpi.frenan` / `creativos.kpi.frenan` | operaciones2.ts:303/390 | `they keep the billing lock closed` · `they hold back publishing` | Subtítulo de KPI con sujeto «they»; se entiende. | `keeping the billing lock closed` · `holding back publishing` | baja |

**Lo revisado que está bien**, para no repetirlo:

- **OT.** «Crew tasks · field tracking», «Assign a task to a crew», «Due date» (lista, ficha y alta), «Assignee» / «Unassigned», Overdue / Due soon, «due in 2 days or less», «1 overdue work order · 1 due soon — an open work order past its due date keeps the billing lock closed.», «Work orders 4 of 4», los filtros, «(options for a digital/static screen)», «This campaign has no booked sites.».
- **Ficha de la OT.** «Proof photo», «Take photo», «Location stamp» / «Capture location», «Close work order», «Complete the checklist, take a photo and capture the location.», «Actual cost of this visit» con «It *replaces* the per-type estimate…», «Once closed, the cost of MX$ 1,500.00 is final: it can’t be changed.», «Recorded cost: MX$ 2,300.00…», «Work order closed», «Closed on Oct 5, 2026, 10:30 AM».
- **«Billing lock open».** Es correcto aunque el español diga «encendido»: el icono es `LockOpen` en verde (`OTVista.tsx:762`), y en Campañas el candado «se abre» al cumplirse. Se tradujo el sentido y no la letra.
- **Creativos.** «Pending approval / they hold back publishing», «Withdrawn · pending in DOOHmain» y su `title`, «Replace the artwork», «sends DOOHmain the order to take down the previous artwork», el recordatorio de borrar la campaña anterior en DOOHmain, «Booked slots (n)», «2 creatives rotate», «Go to Printing».
- **Dashboard.**
  - KPIs: «November revenue» / «November margin» / «Won in November» (mes en inglés con `en-US`), «Open pipeline» con «1 proposal · 1 sent», «Close rate» con «approved out of those decided in 90 days», «Network occupancy · static 3/4».
  - Costos: Rent / Operations / Electricity / Printing (separate).
  - «Published rate charged», «1,234 space·days occupied out of 5,678 available».
  - Pipeline: «Won by sales rep», «Other sales reps» / «No sales rep».
  - Alertas: las de renta, contrato, licencia, cobertura, factura, pausa legal y OT, con plurales correctos con n=1 y n>1 (el español conserva su «1 días» y su «día(s)» de siempre).
  - Antigüedad: «Receivables by age», «Not yet due», los `title` con «in 1 installment» / «in 2 installments», «Overdue: MX$ 4,000.00».
  - Mapa: la leyenda «Free today / Occupied today / In a proposal».
- **Energía.**
  - Título y textos: «Power usage», «One bill per property per month. It is split among its screens the same way as the rent.», «Bills entered 3 of 6 in the period», «the report shows less electricity than the real figure», «Property or screen», «standalone screen», «Bill month», «Meter».
  - Subida: las cuatro opciones de meses (incluida «the usual for a bill issued EVERY TWO MONTHS»), el «Count the calendar months the period *touches*…».
  - Resúmenes: la cobertura en sus tres tonos, la confirmación de borrado, «not a CFE bill», «Bill total … (includes past-due balances and payments)», «street lighting».
- **Huecos y plurales.** Iguales en `es` y `en` en las 463 claves; los fija la prueba de cada archivo.
- **Excepciones de la costura.** Las dos nuevas son legítimas:
  - «Baja» es la prioridad «Low» frente al sitio «Decommissioned».
  - «{n} meses» es la rareza del singular de Comercial.

---

## 2 · Dashboard: solo texto, VERIFICADO

**a) Clases y estructura, medidas sobre el código.** De la versión de `34022673` y de HEAD de `inicio/page.tsx`, `charts.tsx` e `inicio/indicadores.ts` extraje, en orden, todas las cadenas `className=` (incluye `contentClassName`) y todas las etiquetas `<Xxx`.

```
page.tsx      clases: 1 linea distinta → className={cn(t.clave === …)} vs className={cn(tr.clave === …)}  (renombre de variable)
              etiquetas: solo +<TipoAlerta +<string +<string (genericos TS de los mapas nuevos)
charts.tsx    clases 3/3 iguales · etiquetas 24/24 iguales
indicadores.ts sin JSX · 5/5 iguales
```

En el diff no cambia el orden de ningún bloque. Los únicos cambios de forma son tres. En dos nodos, «Sale …» y «Vencido: …», el texto pasa por `interpolarNodos`. Eso deja el mismo HTML (verificado abajo); como mucho cambia cómo React parte los nodos de texto, y eso no se ve. El tercero es el renombre `t` → `ta`/`tr` de las variables locales de `TIPOS_ALERTA.map` y `tramos.map`, para no tapar el `t` del traductor; la lógica es la misma (`filter(ta.n > 0)`, `key={ta.tipo}`, `key={tr.clave}`, el ancho de la barra).

**b) HTML español byte a byte.** Los 7 estados de `pantallas-inicio` son idénticos (ver §3). Comprobé que el volcado detecta un cambio de clase: con M5 (la `h1` de `text-2xl` a `text-xl`), los 7 de 7 volcados difieren.

**c) `useDashboard(idioma)` (`lib/data/client.ts:318`).** Para el usuario en español no cambia nada:

- `dashboardMetrics(s, new Date(), idioma)` equivale a la llamada vieja `dashboardMetrics(s)`, porque `hoy = new Date()` era el valor por omisión.
- La memo pasa de `[state]` a `[state, idioma]`. Con `idioma` fijo en `'es'` recalcula exactamente lo mismo que antes; solo vuelve a calcular al cambiar de idioma.
- `idioma` solo llega a `construirAlertas`. Lo demostré comparando el objeto **entero** de `dashboardMetrics` entre la versión vieja y la nueva, sin idioma y con `'es'`, sobre `estado-alertas.fixture.ts` (más de 20 alertas) y sobre un estado vacío. Son iguales (`toEqual`).
- `useDashboard` tiene un solo llamador (`inicio/page.tsx:141`). `dashboardMetrics` no se usa en ninguna ruta del servidor.

`ReservasChart` (`charts.tsx`) no la monta ninguna página, como dice el commit; lo comprobé con grep.

---

## 3 · Español intacto: VERIFICADO de forma mecánica

**a) Render comparado con `34022673`, byte a byte.**

1. Volqué con `I18N_VOLCAR` el HTML español de los 42 estados (24 de operaciones2, 7 del Dashboard y 11 de energía) con los componentes de HEAD.
2. Hice `git checkout 34022673 --` sobre los 16 archivos fuente del lote que no son de `lib/i18n`: las cuatro páginas, `charts.tsx`, los cuatro `.tsx` y los dos `.ts` de energía, `indicadores.ts`, `OTVista.tsx`, `costo-ot-captura.ts`, `client.ts` y `derive.ts`. Volví a volcar con el mismo arnés.
3. Con el código viejo, las 42 pruebas españolas pasaron. Fallaron solo las inglesas, las del dinero y los barridos: 60, todas esperadas.
4. Restauré con `git checkout HEAD`. Comprobé que la restauración era real: `inicio/page.tsx` tiene 0 `t('` en la versión vieja y 66 en la nueva.

```
42 de 42 identicos (cmp -s head/X-es.html old/X-es.html; ninguna linea «DIFIERE»)
```

**b) Funciones de `lib/` con idioma nuevo: versión vieja contra nueva.** Copié las versiones de `34022673` de `costo-ot-captura.ts`, `energia/captura.ts`, `energia/recibos.ts`, `inicio/indicadores.ts` y `data/derive.ts` como módulos temporales, y escribí una prueba diferencial. Cada caso compara `viejo()` con `nuevo()` y con `nuevo(…, 'es')` mediante `toEqual`.

- Los casos cubren:
  - `motivoInvalido` (7);
  - `resumenDeCobertura` (7, con huérfanos de 1 y de 2 y sin puntos);
  - `etiquetaDeMes` (4);
  - `textoDeConfirmacionDeBorrado` (4);
  - `motivoInvalidoDelRecibo` (10);
  - `motivoNoConfirmable` (8);
  - `textoDeLoLeido` (4);
  - `resumenDeLectura` (11: los tres tonos, desajuste de 1, de 2 y mezclado, sin predio, repetidos, sin archivos);
  - `leerCostoOt` (15: vacío, negativo, «1,5», «1e999», «0x10», miles, etc.);
  - `avisoAntesDeCerrar` y `textoCostoDeCerrada` (5 + 5);
  - `pipelineComercial` (3, con «Otros vendedores», «Sin vendedor» y el nombre congelado);
  - `dashboardMetrics` completo (2).
- Una segunda prueba confirma que los casos no son triviales: más de 20 alertas, los tres tonos de lectura y las dos etiquetas de respaldo del pipeline.
- **Resultado: 87 de 87 en verde.** Los módulos temporales y la prueba ya están borrados.

**c) Las claves que no se rinden.** Un script toma cada valor de `ES_*`, lo parte en los trozos que hay entre huecos y busca cada trozo en el código viejo.

- **434 de 463** aparecen literales.
- Las **29** restantes son frases que el código viejo armaba con ternarios, plantillas o `conteo()`. Revisé a mano las que no cubre (b), por ejemplo `opciones-digital/fija` (= `(opciones de pantalla {digital ? 'digital' : 'fija'})`), `sin-digitales-detalle.*` (con su «Tus 1 campaña son» de siempre), `declaraste.*` y `kpi.sin-pantalla.*`.
- De las de energía, las alertas y el costo, el valor español lo ata además a los literales la prueba de cada archivo de `textos/`.

**d) El servidor sigue recibiendo español.**

- Las funciones con idioma solo las llaman componentes de cliente; grep sobre `app/`, `lib/` y `components/`.
- En el diff no cambia ningún `fetch`, `body` ni `JSON.stringify`. Los motivos de validación solo se pintan o deciden si un botón está activo; no se comparan como texto ni se envían.
- Lo único que viaja es el motivo de rechazo de un creativo: lo teclea el usuario, y solo cambió la pregunta del `window.prompt`.

**Observaciones sin efecto en español:**

- `OTVista` pasa el efecto del rastro de `[]` a `[t]`. Dentro del proveedor, `t` está memoizado (`contexto.tsx:117`), y el proveedor está en `app/layout.tsx`, así que no hay bucle; solo se repite al cambiar de idioma.
- `const t = trailFromLocation()` pasa a llamarse `rastro`, el mismo renombre forzado de los lotes anteriores.
- En Energía, `[recargar]` → `[recargar, t]`.

---

## 4 · Nada en español dentro del inglés

**Diccionario.** Ningún valor `en` lleva acentos, `ñ` ni signos de apertura (lo vigila la prueba de cada archivo). No hay «promo», «coupon», «rotation», «folio», «millar», «Tap» ni «press». Tampoco periodicidades en cifra ni «bimonthly».

**Render inglés de los 42 estados.** Lo que queda en español:

| texto visto | origen | ¿declarado? |
|---|---|---|
| «vandalismo», «otro» en las alertas | `inc.tipo.toLowerCase()`, `derive.ts:1042` | **no**: se da por «datos de prueba» y es un enum. Hallazgo medio, §1 |
| «clausura-municipal» | `s.motivoPausaLegal`, texto libre (`types.ts:218`) | sí, es un dato |
| «Revisar estructura 1», los puntos del checklist, nombres de sitios, campañas y cuadrillas | datos | sí |
| «error-del-servidor», «error-al-borrar» | el mensaje del servidor (I18N-05) | sí |
| los meses abreviados del eje de la gráfica de ocupación | `etiquetaBucket` (`derive.ts:1662`, `es-PE`), compartida con Reportes; aquí la gráfica está sustituida | sí |
| «(required)» | `Campo.tsx` (piloto) | traducido |

---

## 5 · Reglas

- **Dinero en el diccionario.** No hay `$`, `MXN`, `USD` ni cifras con miles en ninguno de los tres archivos.
- **`MX$` en inglés.**
  - Dashboard: todos los importes («MX$ 80,000.00», alertas, tramos, `title`).
  - OT: «Once closed, the cost of MX$ 1,500.00…», el adorno `MX$` del campo, «Saved: MX$1,500».
  - Energía: indicadores, rejilla y lectura.
  - El espacio va según la función de siempre. `formatMonto` pone «MX$ 4,500.50»; `formatearDinero` y el `toLocaleString` del costo guardado ponen «MX$50.00» y «MX$1,500». En español pasa lo mismo («$ 4,500.50» frente a «$50.00»), así que no es de este lote.
- **`desktop.ini`.** Ningún commit añade uno (`git diff --name-only 34022673..HEAD | grep -i desktop` sale vacío). En el árbol quedan 14, los mismos que en la base.
- **Archivos prohibidos.** El diff no toca `middleware.ts`, `nav.ts`, `db/schema.sql`, migraciones, `app/api`, `next.config.mjs`, `idiomas.ts`, `dinero.ts`, `aislamiento.e2e.test.ts` ni `servidor-e2e.ts`. `IDIOMA_INGLES` solo aparece como `process.env.IDIOMA_INGLES = '1'` en las tres pruebas de pantallas.
- **Renombres.** `ta`, `tr` y `rastro` son variables locales. Las usé al revisar el diff y el render español sale idéntico (§3a).
- **Commits.** Formato `feat|fix|docs(i18n)` en español sin acentos, con las 6 firmas `Co-Authored-By`.

### Tipos de OT frente a `etiquetaTipoOt` del lote de administración

La base del lote (`34022673`) aún no tiene `etiquetaTipoOt`, que llegó a `integra/ingles` después; por eso el lote crea `CLAVE_TIPO_OT` en `components/operaciones/claves.ts` y lo marca como provisional. Comparé su inglés con `admin.tipo-ot.*` de `integra/ingles` (`admin.ts:707-715`): **los 9 coinciden letra por letra** (Vinyl installation, Digital installation, Removal, Preventive maintenance, Corrective maintenance, Metalwork, Electrical, Inspection, Other). También coincide el español: los dos espejan `TIPO_OT_LABEL`. Las prioridades coinciden con `admin.tickets.prioridad.*` (Low, High, Urgent). **Al juntar, se puede sustituir `t(CLAVE_TIPO_OT[x])` por `etiquetaTipoOt(x, idioma)` sin que cambie ni una letra visible**, y quitar las 9 claves `operaciones2.tipo-ot.*`.

### Lo que verá la costura al juntar con `integra/ingles`

- `git merge-tree` da dos conflictos de contenido, los esperados: `lib/i18n/diccionario.ts` (las líneas de los spreads) y `textos/costura.test.ts` (los imports, la lista `LOTES` y `DISTINTOS_A_PROPOSITO`). La bóveda se fusiona sola.
- **Al resolver `DISTINTOS_A_PROPOSITO`, ojo con «Baja».** En `integra/ingles` ya existe con otro motivo: el sitio «Decommissioned» frente a la prioridad de un ticket, «Low». Este lote añade la prioridad de una OT, también «Low». Hay que dejar una sola entrada con los dos motivos.
- Comparé por script el español→inglés de las 463 claves contra los 2670 de `integra/ingles` (los 11 archivos de `textos/` y el diccionario base). Salen 5 choques y **todos están ya declarados**: «{n} meses» y «Baja» en esta rama; «{n} pantalla(s)» (`admin.loop`, «digital screen») y «Por vencer» en `integra/ingles`. No aparece ningún choque nuevo sin declarar.

---

## 6 · Pruebas (las corrí yo en este worktree)

```
cd apps/web && npm run typecheck                      →  tsc --noEmit, sin errores
cd apps/web && npx vitest run --testTimeout=60000     →  Test Files 344 passed (344) · Tests 5316 passed (5316)
```

Usé `--testTimeout=60000` por la indicación de memoria compartida. Ninguna prueba se acercó al límite.

**Las pruebas de pantallas importan la página ANTES de forzar `useState`.** Lo comprobé en los 42 bloques `pintar` (24 + 7 + 11): en todos, la primera línea es `const Pagina = await <pagina>()` y los `forzar(…)` van después.

Corrí los mutantes contra `lib/i18n`, `components/demo/inicio`, `components/demo/energia`, `components/operaciones`, `lib/data` y `lib/costo-ot-captura.test.ts` (71 archivos, 1753 pruebas). El M5 lo corrí además contra la suite entera. Restauré cada uno con `git checkout --` y comprobé el árbol con `git status` después de cada mutante.

| # | mutante | resultado |
|---|---|---|
| M1 | `es` de `operaciones2.ot.costo.negativo` (no se rinde): «negativa» | **MUERE** (instantánea ES y «el literal de siempre») |
| M2 | `en` de `inicio.alerta.cobertura.sin-fin` en español | **MUERE** (4 rojas: pantalla inglesa, barrido, instantánea EN e «igual al español») |
| M3 | quitar el idioma de las alertas en el llamador: `useDashboard(idioma)` → `useDashboard()` | **MUERE** (7 rojas: pantalla inglesa y dinero en inglés) |
| M3b | lo mismo un nivel abajo: `construirAlertas(state, idioma)` → `construirAlertas(state)` | **MUERE** (7 rojas) |
| M4 | el toast de crear OT usa otra clave (`no-crear` → `ficha.no-cerrar`) | **MUERE** («los avisos que no se rinden usan su clave») |
| M5 | clase CSS del Dashboard: `h1` de `text-2xl` a `text-xl` | **SOBREVIVE**, también en la suite entera (5316 en verde). El volcado sí lo ve: 7 de 7 distintos |
| M5b | clase CSS: el total de antigüedad de `text-[18px]` a `text-[20px]` | **SOBREVIVE** |
| M5c | clase CSS: la tarjeta «Ocupación» de `lg:col-span-2` a `lg:col-span-3` | **SOBREVIVE**, y **el volcado tampoco lo ve** (0 de 7 distintos) |
| M6 | toast de Creativos: «retirado» usa la clave de «eliminado» | **MUERE** (prueba de claves de avisos) |
| M7 | Energía: se cruzan los plurales `no-recibo.uno/.otros` | **MUERE** (pantalla inglesa) |
| M8 | OT cerrada: la insignia del candado usa la clave de «Work order closed» | **MUERE** (pantallas ES y EN) |

**El hueco de M5.** Las pruebas de pantallas comprueban frases con `includes`, no el HTML completo, así que ninguna prueba automática protege el diseño del Dashboard. Lo protege el volcado `I18N_VOLCAR` comparado a mano, y M5c enseña que ni eso alcanza para todo. El mock de `CardColapsable` (`pantallas-inicio.test.ts:73`) solo pasa `titulo`, `subtitulo`, `resumen`, `accion` y `children`, y **tira `className` y `contentClassName`**. Para este lote lo cubrí con la comparación estática de clases de §2a, que sale idéntica.

Si se quiere cerrar, hay dos opciones baratas, y ninguna bloquea:

- una instantánea `toMatchSnapshot()` del HTML español de los 7 estados;
- que el mock de `CardColapsable` pinte `className` y `contentClassName`.

**El árbol quedó limpio** salvo este informe. Los volcados, los textos ingleses, la prueba diferencial y los scripts quedaron en el scratchpad de la sesión, fuera del repositorio.

---

## 7 · Decisiones de glosario que le corresponden al dueño

1. **Pausa legal → «legal hold».** Se aplica bien y de forma coherente («Screen on legal hold»). En EE. UU., «legal hold» suele significar la retención de documentos por un litigio. Para una pantalla suspendida por una autoridad sería más claro «Screen suspended (legal)» o «Paused for legal reasons». Que elija el dueño.
2. **Cara libre → «free face».** Se entiende en OOH, pero «available face» es lo habitual en el sector.
3. **Las etiquetas de tipo de alerta espejan el español, que es más estrecho que su contenido.**
   - «Overdue rent» (Rentas vencidas) agrupa también «Rent due soon».
   - «Contracts expiring soon» agrupa también los vencidos, los incompletos y los que no cubren la campaña.

   No es un error de traducción. Si se quiere, en inglés podrían ser «Rent payments» y «Contracts»; el español no cambiaría.
4. **Dictamen estructural → «Structural report».** Es correcto. «Structural assessment» es la alternativa más técnica.
5. **«Spots» frente a «slots» en Creativos.** «Spots with no creative · of 4 booked spots» frente a «Booked slots (3)». Espeja el español del código («Spots sin creativo» / «Slots reservados»). Si en el negocio son lo mismo, convendría unificar en los dos idiomas, pero eso es del dueño.
6. **«Power usage» (título del menú) frente a «electricity bill» y «electricity cost» en el cuerpo.** Es coherente con la decisión del orquestador; solo lo apunto por si se prefiere «Electricity» también en el menú.

---

## Segunda pasada (2026-11-02): `git diff 538ba751..HEAD`, commits `e3de0bc3` y `7ba146cc`

### Veredicto: **VERDE**

Lo verifiqué todo por mi cuenta, sin apoyarme en el commit ni en la nota de la bóveda:

- los hallazgos de la tabla de §1 y las decisiones del orquestador están aplicados, y cada frase nueva tiene sentido en el HTML inglés rendido;
- el español sigue idéntico en los 42 estados, comparado con los mismos datos y el mismo arnés en los dos lados;
- la protección del Dashboard muerde: el mutante `lg:col-span-2` → `lg:col-span-3` ahora muere;
- typecheck y unitarias están en verde.

Queda una observación de severidad baja que no bloquea (al final).

### 1 · Hallazgos y decisiones, vistos en el render inglés

| hallazgo / decisión | estado | cómo se lee ahora |
|---|---|---|
| `energia.lectura.ok` («All 1 file were read») | resuelto | Partida en `.uno`/`.otros` por `r.total` (`recibos.ts:302`). Se lee «1 file was read and it produces 1 row.» El español de las dos formas es el literal de siempre. |
| `desajuste.*` / `cubre.otros` («the 1 months», «all 2 cover») | resuelto | «2 don’t match the number of months you declared (1): the number of calendar months covered by those 2 is 3». Un poco pesado, pero correcto con cualquier cifra. |
| `energia.lectura.alerta` («1 rows») | resuelto | «Files read: 2 of 3; rows: 2. Check before confirming: …». Ya no depende del plural. |
| tipo de incidencia crudo («vandalismo», «otro») | resuelto | `CLAVE_INCIDENCIA` (`derive.ts:369`). El inglés se lee «Pantalla Reforma — vandalism», «Site — other», «legal issue», «operational suspension». **El español sigue siendo el dato en minúsculas:** la rama `idioma === 'es'` conserva `inc.tipo.toLowerCase()` (`derive.ts:1056`), y las claves españolas, que no se pintan, valen ese mismo texto; lo fija la prueba nueva de `textos/inicio.test.ts`. «vandalismo» y «otro» salieron de `COMUNES`. |
| tipo de campaña crudo en Creativos | resuelto | `CLAVE_TIPO_CAMPANA` de Campañas solo cuando `idioma !== 'es'` (`creativos/page.tsx:322`). El inglés se lee «CA-c1 · Hybrid»; el español, «CA-c1 · HIBRIDA», el dato crudo de siempre. |
| `inicio.sale` («no client leaves») | resuelto | «Ending Nov 2, 2026: Verano (Cliente Uno)» y «Ending Nov 20, 2026: Otoño (no client)». El enlace de la campaña sigue siendo el mismo nodo. |
| bajas | resueltas | «Assign to» · «You have 1 campaign and it is on static media…» · «its campaign in DOOHmain is ended» · «Delete the bill for meter (no number)» · «2 months · 3 metering points» · «period charges MX$ 4,000.00» · «what becomes free in the next 30 days» · «Over 90 days» (también en el `title`) · «keeping the billing lock closed» · «holding back publishing» |
| pausa legal → «Screen under legal restriction» | cumplido | Título de la alerta. |
| cara libre → «available face» | cumplido | «Valla Norte · available face». |
| tipos de alerta más amplios | cumplido | «Rent issues · 5», «Contract issues · 7», «Blocked or paused sites · 3» en los contadores y en el menú de configurar alertas, que usa la misma clave. Los títulos de cada alerta siguen siendo concretos («Rent due soon», «Contract expired»…). |
| dictamen estructural → «Structural inspection report» | cumplido | «Location — Structural inspection report expires in 1 day». |
| slot frente a spot en Creativos | cumplido | «Slots with no creative · of 4 booked slots», «1/3 slots with a creative», «Booked slots (3)». No queda ningún «spot» en el inglés de Creativos. El español sigue diciendo «Spots sin creativo», sin cambios, como debe ser. |
| «Power usage» en el menú, «electricity» en el cuerpo | cumplido | Sin cambios respecto a la primera pasada: el título de `/energia` sale de `nav.energia` y el cuerpo dice «electricity bill» y «electricity cost». |

### 2 · Español intacto: VERIFICADO otra vez, con los mismos datos en los dos lados

**Los fixtures cambiaron, así que la comparación tenía que repetirse con el arnés nuevo en los dos lados.** Cambiaron tres cosas:

- **Creativos.** `camp()` pasa de `'DIGITAL'` a `'HIBRIDA'`, y eso sí cambia el español de los estados `op2-17`, `op2-18` y `op2-19`: «CA-c1 · DIGITAL» pasa a ser «CA-c1 · HIBRIDA». Lo medí: si en el volcado nuevo se cambia `HIBRIDA` por `DIGITAL`, sale idéntico al de la primera pasada, así que esa es la única diferencia.
- **Ficha de la OT.** `FICHA_CAMPANA` pasa de `'DIGITAL'` a `'DOOH'`. No cambia ningún volcado, porque la ficha no pinta el tipo.
- **Dashboard.** El mock de `CardColapsable` pinta ahora `className` y `contentClassName`. Eso cambia el HTML de los 7 estados, pero solo en los `<section>` y `<div>` del mock: quitándolos, los 7 son idénticos a la primera pasada.

**La comparación justa.** Volqué los 42 estados en español con las pruebas de HEAD (los fixtures y el mock nuevos) dos veces:

1. con los componentes de HEAD;
2. con los 16 archivos fuente de `34022673` (`git checkout 34022673 -- …`; comprobé la restauración: 0 → 66 `t('` en `inicio/page.tsx`).

```
0 distintos de 42 (cmp)
```

Con los componentes viejos, todas las pruebas españolas pasan, **incluida la instantánea nueva del HTML del Dashboard**: la instantánea congela el HTML de antes del lote. Fallaron solo las inglesas, las del dinero y los barridos, que es lo esperado.

**Funciones de `lib/`.** Repetí la prueba diferencial de la primera pasada (87 casos, viejo contra nuevo, sin idioma y con `'es'`) contra HEAD: **87 de 87 en verde**. Incluye el objeto completo de `dashboardMetrics` sobre el estado de alertas, que tiene incidencias VANDALISMO y OTRO.

### 3 · La protección del Dashboard

- **El mock** (`pantallas-inicio.test.ts:77`) pinta `className` en el `<section>` y `contentClassName` en un `<div>` que envuelve el contenido.
- **La instantánea nueva** (`DASHBOARD · el HTML espanol, congelado`, en `lib/i18n/__snapshots__/pantallas-inicio.test.ts.snap`) congela el HTML español entero de los 7 estados.
- **El mutante de la primera pasada ahora muere.** M9 (`lg:col-span-2` → `lg:col-span-3` en la tarjeta «Ocupación»): **MUERE**, con las 7 instantáneas en rojo. M10 (la `h1` de `text-2xl` a `text-xl`): **MUERE**, también las 7.
- **CI no la regenera.** Aparté el `.snap` y corrí `CI=1 npx vitest run lib/i18n/pantallas-inicio.test.ts`. Resultado: **«Snapshots 7 failed»**, y no se escribió ningún archivo. Con `CI` definido, Vitest no escribe instantáneas nuevas, y GitHub Actions define `CI=true`. Una instantánea que cambia falla siempre, salvo con `-u` explícito. Restauré el `.snap` y el árbol quedó limpio.

### 4 · Pruebas (corridas por mí)

```
cd apps/web && npm run typecheck                      →  tsc --noEmit, sin errores
cd apps/web && npx vitest run --testTimeout=60000     →  Test Files 344 passed (344) · Tests 5324 passed (5324)
```

Los mutantes van contra los mismos 71 archivos de la primera pasada (1761 pruebas). Restauré cada uno con `git checkout --` y comprobé el árbol con `git status` después de cada mutante.

| # | mutante | resultado |
|---|---|---|
| M9 | clase CSS del Dashboard: «Ocupación» de `lg:col-span-2` a `lg:col-span-3` (sobrevivía en la primera pasada) | **MUERE** (7 instantáneas) |
| M10 | clase CSS: la `h1` de `text-2xl` a `text-xl` (sobrevivía) | **MUERE** (7 instantáneas) |
| M11 | Creativos vuelve a pintar `campana.tipoCampana` crudo | **MUERE** (pantalla inglesa) |
| M12 | `en` de `inicio.incidencia.vandalismo` en español | **MUERE** (3 rojas) |
| M13 | `resumenDeLectura` usa siempre `energia.lectura.ok.otros` | **MUERE** (pantalla inglesa) |
| M14 | la alerta de incidencia vuelve a `inc.tipo.toLowerCase()` también en inglés | **MUERE** (pantalla inglesa y barrido) |

El árbol quedó limpio salvo esta sección. Los volcados y los scripts quedaron en el scratchpad de la sesión.

### 5 · Reglas

- **Archivos prohibidos.** `git diff --name-only 538ba751..HEAD` no toca `middleware.ts`, `nav.ts`, `db/schema.sql`, migraciones, `app/api` ni `IDIOMA_INGLES`.
- **Dinero.** No se añadió ninguna cifra ni símbolo de moneda al diccionario.
- **`desktop.ini`.** Los commits nuevos no añaden ninguno.
- **Claves.** Son 471: las 463, más 7 de `inicio.incidencia.*`, más 1 por partir `energia.lectura.ok`. Coincide con lo que dice la nota de la bóveda.

### Observación (baja, no bloquea)

1. **`energia.lectura.ok.uno`.** «1 file was read and it produces 1 row. **Check them** against the bill and confirm them…». Con un solo renglón, «them» no concuerda. El arreglo es «Check it against the bill and confirm it», o una frase neutra: «Check each row against the bill and confirm it».

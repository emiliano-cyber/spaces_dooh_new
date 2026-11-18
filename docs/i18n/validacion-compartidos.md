# Validación · lote de inglés «módulos compartidos»

- **Rama:** `feat/ingles-compartidos` (worktree `.claude/worktrees/ingles-compartidos`), `git diff integra/ingles...HEAD`: dos commits (`5e522b28`, `f4f7f367`), 27 archivos.
- **Fecha:** 2026-11-02 · **Validador:** agente independiente. No corrige código; este informe es lo único que escribe, sin commitear.

## Veredicto: **ÁMBAR** — se puede integrar; las correcciones son de redacción inglesa y una prueba que falta

El español está intacto en toda la app, comprobado de forma mecánica contra `integra/ingles` (2 905 728 comparaciones, cero diferencias). Typecheck y unitarias en verde, ninguna regla rota, el inglés sigue apagado. En las pantallas de Propuestas en inglés no queda ni un texto de interfaz en español (solo datos de prueba).

Lo que lo deja en ámbar:

- **3 hallazgos de severidad media en el inglés**: «2 thousands» (choca además con el «thousand» que ya fijó el piloto), «3 14-day periods» (dos cifras pegadas) y el selector de periodo («Quarter», «Year» junto a «This month»).
- **Un hueco de prueba (media)**: quitar el `idioma` de `previsualizarCalculadora` en el alta **sobrevive** (mutante M10). La bóveda dice que «los siete mutantes mueren», pero este no era uno de ellos. Hoy el código está bien; lo que falta es que una prueba lo vigile.
- Unos 8 retoques de severidad baja.

---

## 1 · Hallazgos de sentido en contexto

Las líneas son de `apps/web/lib/i18n/textos/compartidos.ts` (valor `en`), salvo que se indique otra cosa. Las salidas inglesas las saqué ejecutando las funciones reales con entradas normales y raras (ver §2c).

| clave | archivo:línea | inglés actual | problema | propuesto | sev. |
|---|---|---|---|---|---|
| `compartidos.unidad.cpm.otros` | textos:151 · `periodos.ts` `etiquetaCantidad` / `resumenContratacion` | `thousands` → «2 thousands × $ 1,000.00», «0 thousands», «1.5 thousands» | En inglés «thousand» no lleva plural tras un número. Además el piloto ya corrigió esto mismo a `thousand = {n} impressions` (`propuestas.alta.cpm.equivale`), así que la ficha y el alta dicen cosas distintas. | `thousand` (igual en `.uno` y `.otros`) | media |
| `compartidos.unidad.catorcenal.uno/.otros` | textos:135-136 · `propuestas/page.tsx:1584` (`{periodos} {unidadCorta(...)}`) | «1 14-day period», «3 14-day periods» | Dos cifras seguidas, y se lee como «314». Aparece en la duración del alta y en el resumen de la línea. | `two-week period` / `two-week periods` (o `fortnight(s)`: **decisión del dueño**, ver §6) | media |
| `compartidos.periodo.trimestre`, `.anio`, `.rango` | textos:199, 201, 202 · `TableroPropuestas.tsx:102/117` | `Quarter`, `Year`, `Range` junto a `This month` / `Last month` / `Last quarter` | «Quarter» suelto junto a «Last quarter» no dice que es el trimestre EN CURSO (`periodoDe('trimestre')` da el actual: «4.º trimestre 2026» el 02/11). «Range» solo es un rótulo de filtro poco natural. | `This quarter`, `This year`, `Custom range` | media |
| `compartidos.unidad.hora` | textos:146 · selector de modalidad (`etiquetaUnidad`) | `Hourly` | Es correcto, pero en la lista aparece junto a «CPS · cost per play» y «CPM · cost per thousand…». «Per hour» es paralelo a esas y al español «Por hora». | `Per hour` (opcional; **dueño**) | baja |
| `compartidos.calc.motivo.sin-loop` | textos:162 · `propuestas/page.tsx:1111/2018` | «The screen doesn't have its number of loop slots entered; enter it on the screen's page…» | Se entiende, pero suena traducido («doesn't have its number … entered»). | `This screen's number of loop slots hasn't been entered; add it on the screen's page before using the calculator.` | baja |
| `compartidos.calc.motivo.horas` | textos:170 | «Hours per day go from more than 0 up to 18: more hours than the screen broadcasts would be spots that never play.» | «go from more than 0 up to» es un calco. | `Hours per day must be greater than 0 and at most {max}: hours beyond what the screen broadcasts would be spots that never play.` | baja |
| `compartidos.calc.motivo.roadblock-libres` | textos:174 | «A Roadblock needs every loop slot free (6), and the screen has 3.» | «has 3» ¿qué? Falta «free». | `A Roadblock needs every loop slot free ({total}); the screen has {libres} free.` | baja |
| `compartidos.calc.motivo.cero-spots` | textos:173 | «With those slots and those hours, not a single spot plays in a day.» | Es correcto pero algo rígido. | `With these slots and hours, not a single spot would play per day.` | baja |
| `compartidos.mapa.indicacion` | textos:208 · `MapView.tsx` | «Tap the map to mark the area (min. 3 points)» | El piloto, en la ayuda del mismo mapa, ya usa «**Click** a point…» (`propuestas.alta.mapa.ayuda`). Son dos verbos distintos para el mismo gesto en la misma pantalla. | `Click the map to mark the area (at least 3 points)` | baja |
| `propuestas.tablero.subtitulo` + `etiquetaPeriodo` (rango) | `TableroPropuestas.tsx:83` | «Jan 5, 2026 to Mar 9, 2026 · Jan 5, 2026 to Mar 9, 2026» | Con «rango» la etiqueta YA son las fechas, y el subtítulo las repite idénticas. El español también las repite, pero con dos formatos distintos («2026-01-05 a 2026-03-09 · 05/01/2026 a 09/03/2026»); en inglés la duplicación se ve literal. | En inglés, para `tipo === 'rango'`, pintar solo una vez. No toca el español. | baja |
| `compartidos.frecuencia.uno/.otros` | `periodos.ts:178` | `0.5` → «1 plays per day» | El plural se elige con `n` crudo y la cifra sale redondeada. El español tiene el mismo defecto («1 pases al día»), así que no es una regresión. `spots_por_dia` es entero en la base, de modo que hoy no se alcanza. | (informativo) elegir el plural sobre la cifra ya formateada, si algún día admite decimales | info |
| `etiquetaPeriodo` (rango con fecha imposible) | `finanzas-periodo.ts:140` | «2026-02-30 a …» → «Mar 2, 2026 to …» | `formatFecha` desborda la fecha y el inglés pinta otro día, mientras el español deja el texto crudo. Solo pasaría si el servidor dejara pasar una fecha imposible. | (informativo) | info |

**Revisado y bien**, para no repetirlo:

- Plurales con contador: «1 month / 2 months / 0 months», «1 loop slot / 2 loop slots», «1 play per day», «1 screen with no location entered / 3 screens…», «You're asking for 1 loop slot / 3 loop slots…».
- `etiquetaCalculadora`: «Roadblock · 2 loop slots · 1.5 h per day · premium 12.5%». El orden «premium 12.5%» coincide con el piloto (` + premium {pct}%`).
- Periodicidades: Daily, Weekly, Every 14 days, **Twice a month**, Monthly, Every 2 months, Quarterly, Every 6 months, Yearly. «Every 2 months» y «Every 6 months» evitan bien la ambigüedad de «bimonthly» y «biannual». En la ficha salen en minúscula («$ 500.00 · every 14 days»).
- Código: «Pending approval», «Approved by {nombre}», «Approved».
- El aviso de la franja: se lee como nativo y usa «daypart».
- `(required)`, «This field is required», «Your password», `aria-label="Breadcrumb"` (el estándar WAI-ARIA), el candado («Your organization requires your password to confirm sensitive changes.», «Enter your password to confirm.», «Confirm»).
- «Close area ({n})» y «Clear area» (coherente con «Draw area» del piloto).
- «loop slot» es el término DOOH correcto para «espacio del loop», y ya lo usaba el piloto («Loop slots»).
- Sin espacio antes de `%` en todos los valores `en`. Sentence case en todos.

**Entradas raras de `etiquetaPeriodo`**, todas con resultado correcto o conservador:

- «Noviembre 2026» → «November 2026»
- «4.º trimestre 2026» → «Q4 2026»
- «2026» → «2026»
- «2026-01-31 a 2026-02-28» → «Jan 31, 2026 to Feb 28, 2026»
- Lo que no reconoce **se deja tal cual**: «enero 2026» en minúscula, «Mayo  2026» con doble espacio, « Noviembre 2026» con un espacio delante, «4.° trimestre» con el signo de grado y no el ordinal, «… al …», «Toto 2026» y la cadena vacía.
- «5.º trimestre» → «Q5» (el servidor nunca lo genera).
- Comprobé las seis salidas reales de `periodoDe` (`mes`, `mes-anterior`, `trimestre`, `trimestre-anterior`, `anio`, `rango`, con hoy = 2026-11-02): las seis se convierten bien.

---

## 2 · Español intacto en TODA la app: VERIFICADO de forma mecánica

**a) Las funciones de `lib/`, la vieja contra la nueva.**

Copié con `git show integra/ingles:` las versiones viejas de `periodos.ts`, `calculadora-spots.ts`, `renta-periodicidad.ts`, `codigo-aprobacion.ts` y `rejilla.ts` a un espejo temporal. Las importé junto a las nuevas en una prueba de vitest y comparé `viejo(x)` contra `nuevo(x)` y contra `nuevo(x, 'es')` (por `JSON.stringify`). Las entradas:

- `unidadCorta` / `etiquetaCantidad`: 11 unidades (las 7 más `MENSUAL`, `''`, `xyz`, `toString`) × 11 cantidades (0, ±1, 1.5, 0.5, NaN, Infinity…).
- `resumenContratacion`: lo mismo × 7 tarifas.
- `etiquetaFrecuencia`: 12 valores (null, undefined, 0, 1, 1.5, 6000, 1234567, −1, NaN, `'3'`, Infinity).
- `etiquetaUnidad`: contra el `label` de `UNIDADES`.
- `periodicidadLabel`: 17 valores (minúsculas, mayúsculas, legacy, desconocidos, null) × 3 formas del vacío.
- `etiquetaEstadoCodigo`: 3 estados × 5 aprobadores, incluidos `{nombre}` y `$&`.
- `avisoFranja()` contra la constante vieja.
- `etiquetaCalculadora`: 8 × 9 × 3 × 7 combinaciones.
- `previsualizarCalculadora` y `resolverCalculadora`: × digital, unidad, total, libres, días, duración y cantidad enviada.

```
COMPARACIONES 2905728 · Test Files 1 passed · Tests 6 passed
```

**Control de que el arnés muerde:** cambié «pases al día» por «pases al dia» en el diccionario y falló al instante con `frec 2: viejo="2 pases al día" nuevo="2 pases al dia"`. Restaurado. Borré el espejo.

**b) Los componentes de UI.** Cada valor `es` de las claves de UI aparece literal (una vez) en la versión de `integra/ingles` del componente que sustituye:

- `MapView`: «Cerrar zona (», «Limpiar zona», «Cancelar», la indicación y los dos textos de «sin ubicación».
- `Campo`: « (obligatorio)» y «Falta este dato».
- `CampoContrasena`: «Tu contraseña».
- `Breadcrumbs`: «Ruta de navegación».
- `candado`: las tres frases y «Confirmar».

`comun.cancelar` es «Cancelar». `OPCIONES_PERIODO` de `TableroPeriodo.tsx:22-29` coincide con `compartidos.periodo.*`. «Cerrar zona ({n})» va por `interpolarNodos`, así que el número sigue siendo un nodo aparte, como antes. `CampoContrasena` y `DialogoCandado` pasaron de un valor por omisión en el parámetro a `??`: el resultado es el mismo con `undefined` y con `''`.

**c) Llamadores que deben seguir en español** (grep de todas las llamadas fuera de pruebas):

- Servidor: `lib/server/propuestas-controller.ts:274` (`resolverCalculadora`, que fija `'es'` por dentro), `lib/contratos-export.ts:117` y `periodos.ts:161` (`resumenReserva`) no pasan idioma.
- Otras pantallas, que no son de este lote, tampoco pasan idioma, así que siguen igual: `arrendadores/page.tsx:410`, `campanas/[id]/page.tsx:403`, `CompromisoRentaCard`, `ContratoSheet:865`, `PagosRentaCard`, `SiteFicha:651`, `ContratoWizard:482`, `InventarioTabla:613` y `GestionVolumen:210`.
- No hay PDF ni correo que llame a estas funciones.
- La **constante** `AVISO_FRANJA_NO_VIAJA_AL_CMS`, que es la que se congela en el snapshot, no cambió.
- `AvisoFranjaCMS` pasa a `'use client'`. Fuera del proveedor, `useIdioma()` cae a `IDIOMA_POR_OMISION` (`contexto.tsx:141-145`), así que nadie se queda sin texto.

---

## 3 · Nada en español dentro del inglés

- **Diccionario:** 72 claves `es` y 72 `en`. Ningún valor `en` lleva acentos ni ñ (las únicas coincidencias del filtro eran un `·` y un comentario con «»).
- **Pantallas:** volqué el texto visible y los `title`/`aria-label`/`placeholder`/`alt` del HTML en inglés de **todos** los estados de `pantallas-propuestas.test.ts`, con un archivo temporal que reutiliza sus mocks y que borré después. Son 399 líneas distintas, y las filtré por acentos y por ~45 palabras españolas de estos módulos. Lo único que queda son **datos de prueba**: «Refrescos del Norte», «Campaña Navidad», «Pantalla Reforma», «Cuauhtémoc», «Benito Juárez», «Agencia Uno» y «Pago a 30 días.». No queda ninguna unidad, periodicidad, periodo, motivo ni rótulo de mapa o candado en español.
- La salida inglesa de las funciones (§1) tampoco tiene nada en español. La única excepción es un dato desconocido, que se devuelve tal cual (`periodicidadLabel('raro')` → «Raro», `unidadCorta('xyz')` → «xyz»), y es lo correcto: no inventa.

---

## 4 · Reglas

- **Dinero:** ningún `$`, `MXN`, `USD` ni importe en `compartidos.ts`. Solo hay cifras que no son dinero: «1 a {total}», «0 a 100%», «14 days», «2/6 months», «mín. 3 puntos», «1 pantalla». `formatMontoCorto` no se tocó.
- **Archivos prohibidos:** `git diff --name-only integra/ingles...HEAD` no incluye `middleware.ts`, `nav.ts`, `db/schema.sql`, `db/migrations/`, `app/api/`, `next.config.mjs`, `idiomas.ts` ni ningún `package.json`.
- `IDIOMA_INGLES` solo aparece como `process.env.IDIOMA_INGLES = '1'` dentro de las pruebas.
- **`desktop.ini`:** no hay ninguno en los dos commits. Los que salen en `git status` siguen sin seguimiento, como en el resto del repositorio.

---

## 5 · Pruebas (corridas por mí en este worktree)

```
cd apps/web && npm run typecheck   →  tsc --noEmit, sin errores
cd apps/web && npm test            →  Test Files 324 passed (324) · Tests 4282 passed (4282)
```

**Mutantes.** Cada uno se aplicó con `sed`, se corrió la suite **entera** y se restauró desde copia. Al terminar, `git status` sin cambios.

| # | mutante | resultado |
|---|---|---|
| M1 | una letra del `es`: `unidad.mensual.otros` «meses» → «mezes» | **muere** (2 rojas) |
| M2 | un `en` en español: `periodo.rango` «Range» → «Rango» | **muere** (3) |
| M3 | sin `idioma` en `etiquetaFrecuencia` (ficha) | **muere** (2) |
| M4 | un `en` que no se rinde en ninguna pantalla, en español: `calc.motivo.sin-dias` | **muere** (3, por la instantánea) |
| M5 | sin `idioma` en `etiquetaPeriodo` (tablero) | **muere** (1) |
| M6 | mes desfasado en `etiquetaPeriodo` (`indexOf + 1`) | **muere** (2) |
| M7 | plural invertido en la rama inglesa de `unidadCorta` | **muere** (4) |
| M8 | `AvisoFranjaCMS` sin `idioma` | **muere** (1) |
| M9 | el texto del candado escrito a mano en español | **muere** (1) |
| M10 | **sin `idioma` en `previsualizarCalculadora`** (`propuestas/page.tsx:901`) | **SOBREVIVE** |
| M11 | la renta de la ficha en crudo también en inglés | **muere** (1) |

**M10:** ningún estado rendido enseña un motivo de rechazo de la calculadora. Si alguien quita ese `idioma`, el inglés vuelve a enseñar «Los espacios del loop van de 1 a 6.» (`page.tsx:1111` y `:2018`) y no lo ve nadie. La corrección es añadir un estado en `pantallas-propuestas.test.ts` con la calculadora encendida y una línea inválida (por ejemplo, `espacios: '9'` con `totalSpots: 6`) que espere «Loop slots go from 1 to 6.» en inglés. La nota de la bóveda (§11, «Siete mutantes … mueren los siete») es cierta para los suyos, pero no cubre esta llamada.

---

## 6 · Decisiones de glosario para el dueño (aparte)

1. **«catorcena» como unidad contable:** el actual «14-day period» da «3 14-day periods». Hay dos opciones:
   - **«two-week period(s)»**: neutro y claro en EE. UU.
   - **«fortnight(s)»**: exacto y corto, pero suena británico.

   Como periodicidad, «Every 14 days» está bien en cualquier caso.
2. **«millar» (CPM) tras un número:** recomiendo **«thousand»** invariable, como el piloto (`alta.cpm.equivale`). El glosario de la §11 dice «millares → thousands»; conviene corregirlo a «thousand (impressions)» para que el próximo lote no lo repita.
3. **«quincenal» → «Twice a month»:** correcto, porque la quincena mexicana es el día 1 y el 15. La alternativa técnica es «Semimonthly». «Biweekly» **no** sirve: en EE. UU. significa cada dos semanas, que es la catorcena.
4. **«Por hora» → «Hourly» o «Per hour»** en el selector de modalidad (ver §1).
5. **Selector de periodo:** «This quarter / This year / Custom range» en vez de «Quarter / Year / Range». Afectará también a Finanzas (`TableroPeriodo`) cuando le toque su lote, así que conviene fijarlo ya.
6. **Verbo del mapa:** «Click» (escritorio, como el piloto) o «Tap». Que sea uno solo en toda la app.

---

## Segunda pasada (2026-11-02): `git diff f4f7f367..HEAD`, commits `1d0c5bf4` y `5b63c171`

### Veredicto: **VERDE**

Todos los hallazgos de severidad media y baja de la §1 están resueltos, y las frases nuevas tienen sentido en su contexto. El español no cambió en ninguna entrada, el M10 ahora muere y las reglas se cumplen.

### 1 · Hallazgos de la primera vuelta

| hallazgo | ahora | ¿resuelto? |
|---|---|---|
| `unidad.cpm.otros` «thousands» | `thousand` → «2,500 thousand», «2 thousand × $ 1,000.00» (las dos tienen prueba en `compartidos-idioma.test.ts`). Coincide con el `alta.cpm.equivale` del piloto | sí |
| catorcena «14-day period(s)» | `two-week period(s)`; unidad y periodicidad `Every two weeks` → «3 two-week periods», «$ 500.00 · every two weeks» en la ficha | sí, según el glosario fijado |
| selector «Quarter / Year / Range» | `This quarter`, `This year`, `Custom range`, con `This month` / `Last month` / `Last quarter` como antes | sí |
| `unidad.hora` «Hourly» | `Per hour` | sí |
| `calc.motivo.sin-loop`, `.horas`, `.roadblock-libres`, `.cero-spots` | las cuatro redacciones que propuse, palabra por palabra; «the screen has 3 free» lleva ya el «free» | sí |
| mapa «Tap» | «Click the map to mark the area (at least 3 points)». No queda ningún «Tap» en `lib/i18n/textos/` | sí |
| subtítulo del tablero con rango repetido | ver abajo | sí |
| M10 sobrevivía | estado nuevo «calculadora de spots con una linea invalida» que espera «Loop slots go from 1 to 8.» | sí: muere |
| `quincenal` | se queda «Twice a month» | sí, según el glosario fijado |
| los dos informativos (plural con `n` fraccionario, fecha imposible en el rango) | sin cambios | no exigidos: no se alcanzan con datos reales |

**`esEtiquetaRango()` y `TableroPropuestas`.** `esEtiquetaRango` es la MISMA regex que ya usaba `etiquetaPeriodo`, sacada a una constante (`RANGO_ETIQUETA`). El atajo del subtítulo se toma solo con `datos && idioma !== 'es' && esEtiquetaRango(...)`. Con `'es'` la condición es falsa siempre, de modo que la rama española es **la misma expresión** de `f4f7f367`, para cualquier etiqueta. Con `datos` nulo sigue saliendo «—».

En inglés y con un rango, el subtítulo pinta una sola vez «Jan 5, 2026 to Mar 9, 2026». En cualquier otro periodo sale el subtítulo de siempre. Las nuevas pruebas fijan el español «2026-01-05 a 2026-03-09 · 05/01/2026 a 09/03/2026» y comprueban que el inglés no repite las fechas.

### 2 · Español intacto: VERIFICADO otra vez, mecánicamente

- **El diccionario:** el bloque `ES_COMPARTIDOS` es **idéntico** entre `f4f7f367` y `HEAD` (`diff` vacío). Todas las líneas borradas de `compartidos.ts` son de `EN_COMPARTIDOS`.
- **Las funciones:** repetí el arnés de la primera vuelta, el viejo de `integra/ingles` contra el nuevo, sin idioma y con `'es'`, y lo amplié con `finanzas-periodo.ts`:
  - `etiquetaPeriodo` sin idioma y con `'es'` devuelve la etiqueta tal cual en 9 entradas: las cuatro formas, rangos imposibles, minúsculas, cadena vacía, `x a y` y un espacio al final.
  - `periodoDe` viejo y nuevo son idénticos en 5 fechas de hoy (incluido el 29/02) × 6 tipos × 4 formas del rango.
  - `esEtiquetaRango` funciona en los dos sentidos.

  ```
  COMPARACIONES 2905728 (las de la primera vuelta) + finanzas-periodo · Tests 7 passed (7)
  ```

  Después borré el espejo.
- **Los llamadores del servidor:** no cambió ninguno en estos commits. El diff solo toca `TableroPropuestas.tsx`, `finanzas-periodo.ts`, `compartidos.ts`, las pruebas, la instantánea y los documentos.
- Ningún valor `en` lleva acentos ni ñ.

### 3 · Pruebas

```
cd apps/web && npm run typecheck   →  tsc --noEmit, sin errores
cd apps/web && npm test            →  Test Files 324 passed (324) · Tests 4287 passed (4287)
```

Mutantes, con la suite entera por cada uno, y restaurados después:

| # | mutante | resultado |
|---|---|---|
| M10 | sin `idioma` en `previsualizarCalculadora` (`propuestas/page.tsx:901`) | **muere** (2 rojas). Antes sobrevivía |
| M12 | el atajo del rango también en español (quitar `idioma !== 'es'`) | **muere** (1) |
| M13 | sin el atajo (el inglés vuelve a repetir las fechas) | **muere** (1) |
| M14 | `cpm.otros` otra vez «thousands» | **muere** (3) |
| M15 | el mapa otra vez «Tap» | **muere** (2) |
| M16 | `RANGO_ETIQUETA` rota («a» → «al») | **muere** (1) |

`git status` limpio después de restaurar, salvo este informe.

### 4 · Reglas

- `git diff --name-only f4f7f367..HEAD` no toca `middleware.ts`, `nav.ts`, `db/schema.sql`, `db/migrations/`, `app/api/`, `next.config.mjs`, `idiomas.ts` ni ningún `package.json`.
- **Ningún `desktop.ini`** en los dos commits.
- `compartidos.ts` sigue sin dinero ni símbolos de moneda.
- El glosario de la bóveda (§11) recoge las decisiones del orquestador, «thousand» invariable incluido.

### Lo que queda para el dueño

Nada bloqueante. Las decisiones de glosario de la §6 las fijó el orquestador y el dueño puede cambiarlas: la bóveda lo dice así.

# Validación · lote de inglés «reportes» (3.ª oleada)

- **Rama:** `feat/ingles-reportes` (worktree `.claude/worktrees/ingles-reportes`), `git diff 00815aa3..HEAD`: dos commits (`c47f80e3`, `816530af`), 17 archivos.
- **Fecha:** 2026-11-02 · **Validador:** agente independiente. No corrige código. Este informe es lo único que escribe, y no se commitea.

## Veredicto: **ÁMBAR**: se puede integrar con las correcciones menores de abajo

Comprobé el español de forma mecánica y está intacto en los dos planos: en el HTML de los 16 estados y en las seis notas del motor (1825 combinaciones). Typecheck limpio y 5401 unitarias en verde. No se tocó nada prohibido.

Las notas que se rearman en inglés dicen lo mismo que la española en todos los casos menos uno: el importe de los recibos de luz sin destino. Esa diferencia es deliberada y está documentada (ver §1 y la decisión D1).

Hay **una corrección de severidad media en el texto**: «two-faced» significa «hipócrita» en inglés. Hay **un hueco de prueba de severidad media**: el idioma de `ocupacionSerie` y `useOcupacionSerie` no lo vigila ninguna prueba (dos mutantes sobreviven). El resto son de severidad baja. Ninguna toca el español, y el inglés sigue apagado.

---

## 1 · Las notas del motor (`lib/data/reportes.ts`)

**El servidor sigue mandando español.** `app/api/reportes/rentabilidad/route.ts:44` devuelve `rentabilidadCtrl(params)` tal cual. Los seis puntos de llamada del motor llaman sin idioma (`reportes.ts:2020`, `:2208`, `:2396`, `:2547`, `:2743`, `:2876`), y `etiquetaBucket` también (`:769`, `:1839`). El controlador no menciona `idioma`. `app/api` no está en el diff.

**Todo lo que la pantalla necesita para rearmar viaja en el JSON.** El motor construye cada objeto como `{ ...sinNota, nota: notaDeX(sinNota) }` (o `{ digitales, sinMedidas, nota }`, o `{ esperados, faltantes, recibosSinDestino, importeSinDestino, nota }`), y la ruta lo serializa entero, sin proyectar campos. Así que la nota española y la rearmada salen **de los mismos números**: no hay ningún dato que el servidor use y que no viaje. `total` en tarifas y vendedores se recalcula con dos campos que sí viajan (`reservasConX + reservasSinX`), igual que en el servidor.

**Comparación viejo contra nuevo.** Copié el `reportes.ts` de `00815aa3`, exporté sus seis `notaDe*` y las comparé con las nuevas en **1825 combinaciones**:
- costos de OT: real × estimada × 6 importes × 2;
- exclusiones: 5 × 5;
- atribución: 5 × 5 × 6;
- tarifas: 5 × 5 × 6;
- vendedores: 5 × 5 × 5 × 2 × 3, incluido `sinVendedor` mayor que la suma de las causas;
- luz: `faltantes ≤ esperados` × 5 × 6.

Los importes usados fueron 0, 350, 350.5, 12000, 1234567.891 y 0.1+0.2.

- **Sin idioma y con `'es'`: idéntico al viejo en las 1825.**
- **Inglés contra español, por el multiconjunto de cifras de la frase:** 180 divergencias. **Las 180, y solo ellas, son el importe de la luz sin destino** con decimales: `350.5` → `MX$351`, `1234567.891` → `MX$1,234,568`, `0.30000000000000004` → `MX$0`. Ninguna otra nota cambia ni una cifra al pasar al inglés.

Esa diferencia es la del defecto viejo (D1). En inglés el importe sale redondeado y con moneda, y en español sale crudo. El sentido es el mismo, pero la cifra no es literalmente la misma cuando hay centavos.

**Lo exportado sigue en español.** El motor arma por omisión en español, y en español la pantalla pinta `r.<x>.nota` verbatim (`tabla.ts:914`, `:981`, `:1012`, `:1034`, `:1058`, `:1102`). En el diff no hay CSV ni exportación de reportes: no existe ninguna en este módulo.

## 2 · `etiquetaBucket`, `ocupacionSerie` y `useOcupacionSerie`

- **`etiquetaBucket`, viejo (copia de `00815aa3`) contra nuevo:** 768 casos (2024–2027 × 12 meses × 4 días × `dia`/`semana`/`mes`/`trimestre`), sin idioma y con `'es'`. Idéntico en todos.
- **`ocupacionSerie`, viejo contra nuevo**, con un estado de una estática y una digital: el `JSON.stringify` es idéntico sin idioma y con `'es'` en las cuatro granularidades. En inglés solo cambian las etiquetas, no los números:
  - `02/11,09/11…` → `Nov 2,Nov 9…`
  - `T4 2026…` → `Q4 2026…`
  - `Nov,Dic,Ene` → `Nov,Dec,Jan`
  - el día queda igual.
- **El Dashboard no cambia:** `inicio/page.tsx:115` sigue llamando `useOcupacionSerie(gran)`, que va con `'es'` por omisión.
- **Pendiente de integración (no es de este lote):** `useOcupacionSerie(gran, idioma)` en `app/(app)/(shell)/inicio/page.tsx`, con operaciones parte 2. Hasta entonces, la gráfica del Dashboard en inglés pinta las etiquetas del eje en español. La bóveda lo anota (`idiomas-es-en.md:1441-1444`).
- **Hueco de prueba (H-T1):** quitar el idioma en `derive.ts` (`etiquetaBucket(bStart, gran)`) o en `client.ts` (`ocupacionSerie(s, gran)`) **sobrevive** (mutantes M3c y M3d). Ninguna prueba llama `ocupacionSerie(…, 'en')`.
- **Fuera del lote, preexistente e idéntico en los dos idiomas:** la serie mensual de la gráfica repite mes (`Nov,Dic,Ene,Ene,Mar,Abr` al 02/11). Los buckets avanzan 30 días y no por mes natural. Lo dejo anotado para quien lleve el Dashboard.

## 3 · Sentido en contexto

Leí las 148 claves en su punto de uso y en el HTML inglés de los 16 estados, que volqué yo mismo.

| clave | archivo:línea | inglés actual | problema | propuesto | sev. |
|---|---|---|---|---|---|
| `reportes.aviso.m2.todas-las-caras` y `…una-cara` | `textos/reportes.ts:393`, `:395` · `tabla.ts:1085` | «a **two-faced** 3 × 6 screen counts as 36 m²» | En inglés, *two-faced* significa «hipócrita». Es lo primero que lee un angloparlante. | «a **double-sided** 3 × 6 screen…» (y «ONE side» / «all the sides» si se quiere coherencia; «face» como término de columna puede quedarse) | **media** |
| `reportes.dim.vendedor.ayuda` | `:313` · `FiltrosRentabilidad.tsx` | «and it is stored since 2026-09-28» | Tiempo verbal incorrecto. | «and it has been recorded since 2026-09-28» | baja |
| `reportes.nota.ot.sin-visitas` | `:411` | «…not because it is missing.» | El español dice «no porque falte **capturarlo**». «is missing» pierde el matiz de dato sin capturar, que es el sentido de toda la familia de notas. | «…not because it hasn’t been recorded.» | baja |
| `reportes.nota.ot.reales.uno` | `:421` | «The period’s 1 visit goes in at its ACTUAL recorded cost» | «The period’s 1 visit» no es natural. | «The period’s only visit is at its ACTUAL recorded cost ({capturado})…» (sin `{total}`, como ya se aceptó en propuestas con `sin-coords.uno`) | baja |
| `reportes.nota.ot.estimacion.*` y `ot.reales.otros` | `:415-421` | «goes in at the per-type estimate» | Calco de «entra con». | «is costed at the per-type estimate (…) and {reales} at their actual cost» | baja |
| `reportes.nota.luz.completa.otros` | `:467` | «No bill is missing: all {esperados} for the period are recorded» | Le falta el sustantivo. | «…all {esperados} bills for the period are recorded…» | baja |
| `reportes.nota.m2.sin-medidas.*` | `:431` | «static screen with no width or height recorded» | Se puede leer como «sin los dos». El español dice «sin ancho **o** sin alto». | «static screen missing its width or height» | baja |
| `reportes.nota.vendedor.historicas` | `:454` | «when who made them was not stored yet» | Sintaxis forzada. | «when the proposal’s creator was not yet recorded» | baja |
| `reportes.aviso.en-curso.*` | `:387-389` | «touches {etiqueta}» · «billed at the close» | Los dos son calcos. | «overlaps {etiqueta}» · «billed when the period closes» | baja |
| `reportes.dim.luz` frente a `nav.energia` | `:304` · `diccionario.ts:377` | «By electricity consumption» frente al menú «Power usage» | Hay dos nombres para el mismo módulo (el español también difiere: «Por consumo de luz» / «Consumo de luz»). `costura.test.ts` no lo ve porque el español no es idéntico. | Alinear: o «By power usage», o cambiar el menú a «Electricity usage». Decisión de glosario (D3). | baja |
| `reportes.col.pct-publicada` | `:350` | «% of published» | Rótulo incompleto. | «% of published rate» | baja |
| (tooltip del desglose) | `TablaRentabilidad.tsx:318` | `title="2026-01-01 to 2026-01-28"` | En inglés el tooltip lleva fechas ISO y el título de la tarjeta «Jan 1, 2026 to Mar 31, 2026». No es ambiguo, pero sí incoherente. El español ya mezclaba ISO y dd/mm antes. | Opcional: `formatFecha(p.desde, idioma)` solo en inglés. | baja |

**Revisado y correcto.** Lo listo para que no se repita:
- **Términos:** profitability, revenue («Period revenue», «Revenue / m²», coherente con «Media owner revenue» de campañas), occupancy (no aparece en el lote; la serie es del Dashboard), gross margin y «Gross margin (%)» (columna, correcto), area (coherente con «Lot area» y «Face area» de comercial), face y «Faces» (comercial), attributed balance (es `ingreso − espacio`, a propósito no «margin»), published rate (igual que comercial), comparable net, list rate (igual que propuestas y catálogos), booking (glosario), rotating (igual que comercial: `exhibicion.rotativo`), owned (igual que «Owned screen»), «Legal name» en la columna y «legal entity» en la frase (igual que admin), y «Settings» y «Sales» (glosario).
- **Trimestre:** la excepción está bien justificada y declarada en `costura.test.ts` (`DISTINTOS_A_PROPOSITO`): «This quarter» es la opción del selector y «Quarter» la cabecera de una columna cuyas filas son trimestres. «Q1 2026» coincide con `compartidos.periodo.etiqueta.trimestre` («Q{n} {anio}»).
- **Plurales y concordancia:** las variantes `uno` / `una-de-varias` / `otros` dan «1 of the 5 bookings … has» y «3 of the 5 … have», y «1 of 1 bill». La «en curso» va con `corridos === 1`.
- **El mensaje de la red caída** ya no se guarda en el estado: lo pone `estadoDeReporte` con `status === 0`. En español sale la misma frase que antes, y en inglés no se queda fija en el idioma del momento del fallo.

## 4 · Español intacto: VERIFICADO (mecánicamente, por mí)

Copié a un espejo temporal (`apps/web/__valviejo/`) los seis archivos de `00815aa3`: `page.tsx`, `FiltrosRentabilidad.tsx`, `TablaRentabilidad.tsx`, `consulta.ts`, `estado.ts` y `tabla.ts`. Cambié sus importaciones para que también usaran el `derive.ts` y el `reportes.ts` **viejos**. Los rendí con el mismo arnés de `pantallas-reportes.test.ts`, con los mismos mocks y los mismos `useState` forzados, cambiando solo la importación de la página.

```
IGUAL 00-es.html 17317 · IGUAL 01-es.html 12629 · … · IGUAL 15-es.html 3143   (16/16, cmp -s)
```

Control de que el espejo era de verdad el código viejo: el mismo arnés en **inglés** con el espejo falla en **16 de 16** (pinta español). Las expectativas en español del arnés pasan también con el espejo viejo (16 de 16).

Después borré el espejo y los volcadores.

## 5 · Formato

`lib/i18n/guardias-ingles.ts` **no existe en esta base**. Lo comprobé a mano sobre los 16 HTML ingleses:

- **`$` sin `MX`:** ninguno. El dinero sale `MX$ 600.00` con `formatMonto` y `MX$12,000` con `formatearDineroRedondo`. La diferencia de espacio entre los dos formateadores es preexistente y la comparten los demás lotes (`MX$ 60,000` en otra prueba de pantallas).
- **`dd/mm/aaaa`:** ninguno. Las fechas salen «Jan 1, 2026 to Mar 31, 2026» y «Between Jan 1, 2025 and Mar 31, 2025». Solo quedan fechas ISO: `2026-09-28` en dos textos y el tooltip del desglose.
- **`%` con espacio:** ninguno (`55.0%`, `33.3%`). En español sigue `55.0 %`.
- **Español residual:** ningún acento ni «» en el texto. Lo único en español son datos de prueba: «Reforma», «Don Pepe», «Ejecutiva».

## 6 · Reglas

- **Dinero en el diccionario:** ninguno. El ejemplo de la herrería pasó a `{caro}` / `{barato}`. Solo quedan cifras que no son dinero: `24 meses`, `3 × 6`, `36 m²` y `2026-09-28`.
- **`desktop.ini`:** ninguno en el diff.
- **Archivos prohibidos:** `git diff --name-only 00815aa3..HEAD` no toca `middleware.ts`, `nav.ts`, `db/schema.sql`, migraciones, `app/api/**`, `idiomas.ts`, `dinero.ts`, `aislamiento.e2e.test.ts` ni `servidor-e2e.ts`. `IDIOMA_INGLES` solo aparece en la prueba y en la nota.
- **Tope de 24 meses:** el inglés de `reportes.motivo.tope` es letra por letra el del catálogo de errores (`errores-servidor.ts:363-364`).

## 7 · Pruebas (corridas por mí en este worktree)

```
cd apps/web && npm run typecheck                      → tsc --noEmit, sin errores
cd apps/web && npx vitest run --testTimeout=60000     → Test Files 346 passed (346) · Tests 5401 passed (5401)
```

**Mutantes.** Los corrí contra `pantallas-reportes`, `textos/*`, `diccionario`, `dinero`, `components/demo/reportes/*`, `lib/data/reportes*` y `lib/data/derive*` (60 archivos, 968 pruebas). Restauré cada uno con `git checkout --`.

| # | mutante | resultado | lo mata |
|---|---|---|---|
| M1 | `es` cambiado: «Además, {n} recibo por» → «Ademas, …» | **muere** | instantánea ES + «sin idioma, el motor no cambia» |
| M2 | `en` en español: `tabla.propia` = «propia» | **muere** | barrido de pantallas + «ninguna inglesa igual a la española» + instantánea EN |
| M2b | `en` en español: «Also, {n} bills for» → «Además, {n} recibos por» | **muere** | guardia de acentos + instantánea EN |
| M3a | `etiquetaDePeriodo` sin idioma en el mes (`tabla.ts`) | **muere** | pantallas EN (`>Jan<`) |
| M3b | `avanceDelTrimestreEnCurso` sin idioma (`consulta.ts`) | **muere** | pantallas EN (`Q1 2026`) |
| M3c | `ocupacionSerie` sin idioma en `etiquetaBucket` (`derive.ts`) | **SOBREVIVE** | — (H-T1) |
| M3d | `useOcupacionSerie` sin pasar idioma (`client.ts`) | **SOBREVIVE** | — (H-T1) |
| M4a | nota de luz rearmada con `esperados + 1` | **muere** | pantallas EN (luz) |
| M4b | exclusiones rearmadas con `digitales` y `sinMedidas` cruzados | **muere** | pantallas EN (m²) |
| M4c | `estimadas` = `visitasConCostoReal` en el motor | **muere** | `reportes.costo-ot.test.ts` + pantallas + variantes |
| M4d | vendedores rearmados con `reservasConVendedor + 1` | **muere** | pantallas EN (vendedor) |
| M4e | importe sin destino × 10 en el rearmado | **muere** | pantallas EN (luz) |
| M4f | atribución rearmada con `contratosSinEntidad: 0` | **muere** | pantallas EN (entidad) |
| M4g | tarifas rearmadas con `ingresoSinTarifa: 1` | **muere** | pantallas EN (tarifa) |
| M5a–f | el servidor arma cada una de las seis notas con `'en'` | **mueren las 6** | `reportes.costo-ot` / `dimensiones` / `entidad` / `tarifa` / `vendedor` / `luz` `.test.ts` |
| M5g | el motor etiqueta el bucket con `'en'` | **muere** | `reportes.test.ts` («UN bucket etiquetado T1») |

Una nota sobre M5: la ruta no tiene por dónde pasar idioma al motor (`rentabilidadCtrl(params)`), así que el mutante se puso donde el servidor arma la nota. Lo matan las pruebas del motor, **no** la prueba nueva «el servidor sigue mandando las notas en español». Esa prueba llama a las `notaDe*` sin idioma y vigila el valor por omisión, no el punto de llamada. Está bien así, porque la protección existe, pero conviene saber cuál es.

**Árbol final:** después de borrar el espejo, las copias viejas y las dos pruebas temporales, `git status` sale limpio (salvo los `desktop.ini` sin seguimiento que ya estaban) y `git diff` vacío.

---

## Correcciones pedidas antes de integrar

1. «two-faced» → «double-sided» en las dos convenciones del m² (severidad media).
2. Una prueba de `ocupacionSerie(s, gran, 'en')`: etiquetas inglesas y los mismos `pct` y `ocupados` que en español. Mata M3c. M3d (`client.ts`) necesita además que la pantalla lo use, cosa que llega con operaciones parte 2.
3. Las de severidad baja de la tabla del §3, a criterio del autor.

## Decisiones del dueño

- **D1 · El defecto viejo: la nota de luz pinta «por 350» sin moneda en español.** Lo confirmo y es peor de lo que parece. `energiaSinDestino.importe += c.importe` (`reportes.ts:1213`) suma flotantes sin redondear, así que con dos recibos de 1000.33 y 234.23 el español diría «por 1234.5600000000002». Lo reproduje con 0.1+0.2, que da «por 0.30000000000000004». No lleva moneda ni separador de miles, y es la única cifra de dinero de todo el reporte que sale así.
  - **Mi opinión:** el autor hizo bien en **no** tocarlo en este lote, porque la regla es que el español quede idéntico y esa frase la manda el servidor.
  - **Recomiendo arreglarlo aparte, con autorización explícita**, usando `formatearDineroRedondo(importe, 'es')` en el español, que es lo que ya hace el inglés y lo que usan las otras cinco notas. Hay que ajustar `reportes.luz.test.ts` y la instantánea. Al hacerlo, la única divergencia numérica entre las dos lenguas desaparece.
  - Mientras tanto, la diferencia es aceptable: el inglés dice la misma cantidad, redondeada y con moneda.
- **D2 · El trimestre:** «This quarter» (selector) frente a «Quarter» (columna). Está bien resuelto y declarado. Solo necesita el visto bueno.
- **D3 · El consumo eléctrico:** hay que elegir un solo término de módulo en inglés. El menú dice «Power usage» y el lote dice «electricity» en todo (dimensión, columnas, KPIs, notas). El lote de propuestas también dice «electricity». Propongo dejar «electricity» y cambiar el menú a «Electricity usage», o al revés, pero que sea uno solo.
- **Fuera del lote, preexistente:** en la dimensión `vendedor`, `notaDeArrendador` no excluye las filas de persona (`FILAS_QUE_NO_SON_PANTALLAS` solo tiene `trimestre` y `entidad`, `tabla.ts:482`), y el motor les pone `tieneContrato: false` (`reportes.ts:2678`). Una fila de vendedor real pintaría «Ejecutiva · sin contrato», y ahora en inglés «· no contract». El lote no lo introduce y el español es idéntico, pero vale una tarea propia.

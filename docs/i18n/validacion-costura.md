# Validación · lote de inglés «costura»

- **Rama:** `feat/ingles-costura` (worktree `.claude/worktrees/ingles-costura`). Diff revisado: `git diff f2e0a15f..HEAD` (`integra/ingles` → `7e42b3ce`). Son 13 commits y 36 archivos.
- **Fecha:** 2026-11-02. **Validador:** agente independiente. No corrige código. Este informe es lo único que escribe, y no está commiteado.

## Veredicto: **VERDE**, con correcciones menores recomendadas

Lo que se comprobó de forma mecánica:

- **El español está intacto.** Los 107 estados de las cuatro pruebas de pantallas se volcaron en HTML con los componentes de `f2e0a15f` y con los de HEAD, usando los mismos datos de prueba. Salen idénticos byte a byte: `diff -rq` vacío, 1,1 MB. `DICCIONARIOS.es` tiene **0 valores cambiados**, 6 claves retiradas (las `finanzas.periodo.<tipo>`) y 17 nuevas.
- **Las funciones de `lib/` dan lo mismo sin idioma y con `'es'`.** Son 5256 comparaciones de la versión vieja contra la nueva y no hay ninguna diferencia.
- **El selector de periodo tiene una sola fuente.** Las pruebas de paridad con `OPCIONES_PERIODO` siguen vivas.
- **No se tocó nada prohibido** y no hay dinero en el diccionario.
- **Pruebas en verde:** typecheck limpio y 4514 unitarias en verde.
- **Mutantes:** 9 de 11 mueren. Los 2 que sobreviven son huecos de cobertura **sin regresión**:
  - una rama de `SiteFicha` que ningún estado pinta;
  - los toasts de Comercial, que nunca tuvieron la prueba «gemela».

No hay hallazgos de severidad alta ni media que bloqueen. La tabla recoge **11 de severidad baja**. Uno de ellos es de inglés visible y conviene arreglarlo antes de encender `IDIOMA_INGLES`: el estado de cuenta vacío con un rango a mano.

---

## 1 · Tabla de hallazgos

| clave | archivo:línea | inglés actual | problema | propuesto | sev. |
|---|---|---|---|---|---|
| `finanzas.estado-cuenta.vacio` | `textos/finanzas.ts:368` · `EstadoCuenta.tsx:147` | `No invoices or payments in {periodo}.` | Desde la costura, con un rango a mano `{periodo}` vale `etiquetaPeriodo` en inglés y sale «**No invoices or payments in Nov 1, 2026 to Nov 30, 2026.**», que no es gramatical. Con mes, trimestre o año se lee bien. | Clave aparte para el rango: `No invoices or payments from {desde} to {hasta}.` (con `esEtiquetaRango`, como hace `TableroPeriodo`). El español no cambia. | baja (visible) |
| — (rama sin id de DOOHmain) | `SiteFicha.tsx:533` | `textoOrigenDoohmain(null, idioma)` | **Mutante superviviente M1b.** Si se quita el `idioma`, las 4514 pruebas siguen en verde. Ningún estado de `pantallas-comercial` tiene un sitio sin `doohmainEfectiva`. La función sí está probada en inglés (`doohmain-programacion.test.ts`); lo que falta es probar el llamador. | Añadir a `pantallas-comercial.test.ts` un sitio sin id de DOOHmain. | baja |
| `comercial.tarifas.guardadas` (y demás toasts de Comercial) | `SiteFicha.tsx:1032` | — | **Mutante superviviente M5b.** Cambiar la clave del toast por `comercial.ficha.galeria-guardada` pasa la suite entera. La costura añadió la gemela «qué clave usa cada toast» a Campañas, y Finanzas ya la tenía; Comercial se quedó sin ella. No es una regresión de la costura. | Una tercera gemela en `textos/comercial.test.ts` que lea el fuente de `SiteFicha` (y de los diálogos de Comercial) y fije la clave de cada toast. | baja |
| `finanzas.periodo.elige` / `propuestas.tablero.elige-fechas` | `textos/finanzas.ts:186,384` · `textos/propuestas.ts:466,965` | `Choose the start and end dates.` (las dos) | El selector ya tiene una sola fuente, pero los textos que lo rodean siguen duplicados entre los dos tableros: el «elige fechas», el aria `Period` (`finanzas.periodo.aria` / `propuestas.tablero.periodo`) y el «a»/«to» del rango (`propuestas.tablero.a`). Hoy son iguales y los vigila `costura.test.ts`, así que no pueden divergir sin que salte una prueba. | Llevarlos a `compartidos.periodo.*` en una tarea aparte, o dejarlos así y declararlo. | baja |
| — (comentario) | `textos/finanzas.ts:11-14` | — | La cabecera sigue diciendo que «las opciones de `OPCIONES_PERIODO`» van en este archivo con su clave. Desde la costura ya no van aquí. | Quitar `OPCIONES_PERIODO` de esa lista y apuntar a `compartidos.periodo.*`. | baja |
| `login.no-tienes-cuenta` | `diccionario.ts:290` | `Don't have an account? ` | Lleva el apóstrofo recto. `costura.test.ts` solo mira los seis `textos/*` y no el diccionario base, así que este se le escapa. | `Don’t have an account? ` e incluir `DICCIONARIOS.en` entero en la prueba del apóstrofo. | baja |
| `propuestas.comun.paquete-conjunto` | `textos/propuestas.ts:579` | `Bundle "{nombre}" — bundle price` | Lleva comillas rectas. El comentario de `costura.test.ts` afirma que «las comillas “ ” [son] de todos los lotes», y esta es la excepción. | `Bundle “{nombre}” — bundle price` (el español viejo también usa `"`, pero ese no se toca). | baja |
| `campanas.lista.buscar` | `textos/campanas.ts:587` | `Search by name, Internal ref. or client…` | «Internal ref.» va con mayúscula a media frase. Es un término del glosario, no un nombre propio. | `Search by name, internal ref. or client…` | baja |
| `campanas.extender.nota` | `textos/campanas.ts:787` | `…together with the Internal ref. of the new segment…` | El mismo problema de mayúscula. | `…together with the internal ref. of the new segment…` | baja |
| — (sangría) | `ComprobanteDialog.tsx:283-289` | — | El comentario y el `<Linea>` nuevos quedaron con una sangría distinta a la de sus hermanos. Es solo cosmético. | Volver a dar formato. | baja |
| — (bóveda) | `vault/03-Frontend/idiomas-es-en.md` (callout de Costura) | — | Dice «el emisor y la fecha de `armarComprobante`», pero la fecha se formatea en `ComprobanteDialog.tsx:286-289` y no en `armarComprobante`. | «el emisor de `armarComprobante` y la fecha en `ComprobanteDialog`». | baja |

Revisé y **no son hallazgos**:

- **Las cuotas** («twice-monthly / monthly / every 2 months / quarterly / every 6 months / yearly installments») están alineadas con `compartidos.periodicidad.*`: «Twice a month», «Every 2 months», «Every 6 months» y «Yearly».
- **«Payment frequency»** está igual en las dos claves de «Cada cuándo se paga» (`propuestas.alta.renta.cada-cuando` y `comercial.ficha.periodicidad`) y casa con «payment frequency» de `comercial.editar.renta.ayuda`.
- **«profile» para «ficha»** es uniforme: `compartidos.calc.motivo.sin-loop`, `compartidos.doohmain.origen.*`, `comercial.editar.doohmain.al-publicar` y `comercial.reserva.sin-cupo.ayuda`. «Spec sheet» queda solo para «Ficha técnica».
- **«Unassigned»** y **«(deactivated)»** coinciden con `comercial.editar.sin-asignar`, `campanas.horario.dada-de-baja` y `propuestas.ficha.tabla.usuario-baja`.
- **El horario en inglés** sale «07:30 to 09:00 · Mon, Tue». `miles()` sigue en `es-MX`, pero da «12,000», igual que en `en-US`.

---

## 2 · Evidencia por punto

### 2.1 · Selector de periodo con una sola fuente

- `grep -rnE "finanzas\.periodo\.(mes|mes-anterior|trimestre|trimestre-anterior|anio|rango)\b" app components lib` → **0 resultados**.
- `CLAVE_PERIODO` (`etiquetas.ts:28-35`) apunta a `compartidos.periodo.*`. `TableroPeriodo.tsx:120,…` y `TableroPropuestas.tsx:107,112` usan `t(CLAVE_PERIODO[o.tipo])`, y ya no queda la plantilla `` `compartidos.periodo.${o.tipo}` as ClaveTexto ``.
- Las pruebas de paridad siguen vivas:
  - `textos/finanzas.test.ts:71-74` (`OPCIONES_PERIODO` contra `CLAVE_PERIODO`);
  - `textos/compartidos.test.ts:77-79`;
  - la nueva de fuente única, `textos/finanzas.test.ts:76-84`.
- En el diccionario, las seis etiquetas «Este mes … Rango» y sus inglesas (This month … Custom range) solo existen bajo `compartidos.periodo.*`.
- Los duplicados que quedan **alrededor** del selector están en la tabla (aria, «a», «elige fechas»).

### 2.2 · Funciones de `lib/` con `idioma` nuevo

**Lista completa.** Salen del diff con `^\+.*export (function|const)` y de las firmas de varias líneas:

- `resumenReserva`, `textoHorario`, `textoReproducciones` y `textoOrigenDoohmain`;
- `etiquetaAsignacion` y `opcionesDeAsignacion`;
- `armarComprobante` y `armarListaFacturas`;
- en `SiteFicha`, el cambio de `UNIDAD_LABEL[u] ?? u` por `etiquetaUnidad(u, idioma)`.

`etiquetaFrecuencia`, `etiquetaPeriodo`, `periodicidadLabel` y `etiquetaUnidad` ya aceptaban `idioma` en `f2e0a15f`.

**Cómo se comparó.** Copié las versiones de `f2e0a15f` con `git show` a un directorio temporal y escribí una prueba que importa la vieja y la nueva a la vez. El directorio ya está borrado. La prueba compara, sin idioma y con `'es'`:

- `resumenReserva`: 11 unidades × 9 cantidades × 7 precios, incluidos NaN, negativos, decimales y unidades desconocidas;
- `etiquetaUnidad`: contra `UNIDAD_LABEL[u] ?? u`, la vieja `nombreUnidad`;
- `textoHorario` y `textoReproducciones`: 4 × 4 horas × 5 juegos de días × 6 cantidades;
- `textoOrigenDoohmain`: los 4 orígenes;
- `etiquetaAsignacion` y `opcionesDeAsignacion`: 6 listas × 9 ids × 3 roles, con entidades activas, de baja y desconocidas;
- `armarComprobante`: 120 facturas × 2 × 3;
- `armarListaFacturas`: 3 × 2 × 2 × 2.

Resultado: **5256 comparaciones, 0 diferencias**.

**Llamadores.** Los que siguen sin idioma, y por lo tanto en español:

- en Arrendadores: `ContratoSheet.tsx:206,510,842,865`, `CambiosContrato.tsx:484`, `CompromisoRentaCard.tsx:97` y `PagosRentaCard.tsx:247`;
- en Inventario: `InventarioTabla.tsx:613` y `ContratoWizard.tsx:482`;
- `arrendadores/page.tsx:410` y el CSV `lib/contratos-export.ts:117`.

Ninguna de estas funciones se llama desde `lib/server` ni desde `app/api`. Las rutas, el PDF y el correo no las usan.

### 2.3 · Sentido del inglés nuevo o cambiado

**32 claves cambiadas.** Las conté comparando `DICCIONARIOS.en` viejo contra el nuevo:

- 26 son solo el apóstrofo (de `'` a `’`);
- `compartidos.calc.motivo.sin-loop` combina el apóstrofo con el cambio de «page» a «profile»;
- las otras cinco cambian el sentido:
  - 4 cuotas: `quincenal`, `bimestral`, `semestral` y `anual`;
  - «Payment frequency»;
  - «proof photos».

Las 17 nuevas son `compartidos.doohmain.*` (7), `compartidos.dia.0-6` (7) y `compartidos.asignacion.*` (3). Las leí todas en su punto de uso y se entienden. «As many as fit» encaja en una columna «Per day / Campaign total».

**Las 8 excepciones de `costura.test.ts`.** Las ocho están justificadas: el mismo español nombra dos cosas distintas.

| Español | Inglés A | Inglés B | ¿Justificada? |
|---|---|---|---|
| Comercial | Sales (`nav.grupo.vender`) | Commercial (`campanas.ficha.comercial`, sección de importes) | Sí. Si «Commercial» a secas sirve como encabezado lo decide el dueño (ver §3). |
| Desde | From (`propuestas.comun.desde`, inicio de un periodo) | Since (`comercial.negociacion.competencia.desde-etiqueta`) | Sí |
| Folio | Internal ref. | Invoice no. | Sí, lo marca el glosario |
| Horario | Schedule (`campanas.doohmain.col.horario`) | Operating hours (`comercial.ficha.horario`) | Sí |
| Plazo | Payment terms | Term (de una oferta de renta) | Sí |
| Por vencer | Due soon (una cuota) | Expiring soon (un contrato) | Sí |
| Vencido | Overdue (`finanzas.periodo.vencido`) | Expired (`comercial.contrato-estatus.vencido`) | Sí |
| Vigencia | Validity (propuesta) | Term (contrato) | Sí, lo marca el glosario |

Además repetí la búsqueda de divergencias **dentro del mismo lote**, que `costura.test.ts` no mira. Solo aparecen pares singular/plural y `propuestas.tablero.col.aprobada` = «Approved on». Lo segundo está bien: es una columna de fechas.

**Apóstrofo.** No queda ningún `'` recto en los seis `textos/*`. Quedan dos casos en el diccionario completo:

- `login.no-tienes-cuenta` (diccionario base, en la tabla);
- las coordenadas `19°25'57"N` de `comercial.negociacion.buscar.ayuda`, que es correcto: son minutos.

### 2.4 · Coherencia global

Busqué en el inglés de los seis diccionarios y de `diccionario.ts`:

- «Tap», «press», «promo», «domain», «Hoarding», «14-day», «biweekly», «semi-monthly», «bimonthly» y «semiannual» → **0**.
- «Reserved» → solo `sidebar.derechos` («All rights reserved»), que es correcto.
- «thousands» → dos usos como separador de miles («commas separate thousands»), que es correcto, y `propuestas.alta.cpm.titulo` («in thousands»; ver §3).
- Espacio antes de `%` en inglés → **0**. Los ` %` que hay son del español, y es correcto.

Los términos del glosario son uniformes:

- Booked, Proof photos, Payment receipt, Submitted for publishing;
- loops/h, Invoice no., CFDI UUID, Internal ref.;
- Poster panel, Spec sheet, Limit reached;
- Per hour, «every two weeks».

Las mayúsculas incoherentes que encontré están en la tabla («Internal ref.» a media frase). No hay frases en español dentro del inglés: lo vigilan los barridos de las cuatro pruebas de pantallas, que están en verde.

### 2.5 · Español intacto

**Cómo se montó la comparación.** Copié en `apps/web/lib/<tmp>/old/` las 17 fuentes no-prueba que cambia el diff, en su versión de `f2e0a15f` y con los imports relativos pasados a `@/`. El directorio está borrado.

- Las cuatro pruebas de HEAD (`pantallas-{propuestas,compartidos,campanas-finanzas,comercial}.test.ts`) se copiaron con un `vi.mock` por módulo que redirige cada uno a su versión vieja. Eso incluye `textos/compartidos|finanzas|propuestas`, así que el diccionario viejo entra por `diccionario.ts`.
- Se volcó con `I18N_VOLCAR` (y `VOLCAR_HTML` en Comercial) en dos carpetas.
- Para comprobar que el espejo de verdad carga el código viejo: en la copia vieja fallan las aserciones **inglesas**, por ejemplo `'Todo el día (sin franja)'`, `'Sin asignar…'` y `'Cuauhtémoc · 1 mes · '`. Las españolas pasan todas.

**Resultado:**

```
propuestas 23 · compartidos 6 · campanas-finanzas 55 · comercial 23  (107 estados, 1 107 180 bytes)
diff -rq viejo nuevo → vacío
```

Como usé los **mismos datos de prueba** en los dos lados, no hay diferencias que se deban a datos nuevos.

**Cobertura de lo que tocó la costura en esos HTML** (archivos que lo contienen):

| Texto | Archivos |
|---|---|
| «Todo el día (sin franja)» | 1 |
| «07:30 a 09:00 · lun, mar» | presente |
| «Las que quepan» | 1 |
| «Sin asignar» | 8 |
| «dada de baja» | 1 |
| «Tarifa publicada (» | 6 |
| «no está escrita en la ficha» | 2 |
| «Fecha de emisión» | 2 |
| «Este mes» | 22 |
| «Trimestre pasado» | 20 |
| «cuotas quincenales» | 1 |
| «Cada cuándo se paga» | 5 |
| «1 mes · » | 1 |
| «Sin facturas ni pagos en» | 1 |
| «CPS · costo por salida» | 5 |

«escrita en esta ficha», «ninguna: al publicar…» y «Razon social no disponible» no aparecen en ningún estado. Esas tres quedan cubiertas por la comparación de funciones de §2.2.

**`DICCIONARIOS.es` antes y después:** 0 valores cambiados, 6 claves retiradas (`finanzas.periodo.{mes,mes-anterior,trimestre,trimestre-anterior,anio,rango}`) y 17 nuevas.

### 2.6 · Reglas

- **Ningún archivo prohibido en el diff.** `git diff --name-only f2e0a15f..HEAD` no toca `middleware.ts`, `nav.ts`, `db/schema.sql`, `db/migrations/`, `app/api/`, `dinero.ts`, `derive.ts` (`formatMonto`/`formatFecha`) ni `formatearDinero`.
- **`IDIOMA_INGLES`** solo aparece en pruebas y en `idiomas.ts`, que no se tocó.
- **`desktop.ini`:** `git log --name-only f2e0a15f..HEAD | grep -ci desktop` → 0.
- **Sin dinero en el diccionario:** buscar `\$ ?[0-9]|MXN|USD|[0-9],[0-9]{3}` en los valores de los dos idiomas da 0. La guardia de `dinero.test.ts` está en verde dentro de la suite.

### 2.7 · Pruebas y mutantes

```
cd apps/web && npm run typecheck   → tsc --noEmit, salida limpia (exit 0)
cd apps/web && npm test            → Test Files 331 passed (331) · Tests 4514 passed (4514)
```

**Mutantes.** Cada uno se aplicó con `perl -0pi`, se corrió la suite indicada y se restauró con `git checkout -- <archivo>`:

| # | Mutante | Suite | Resultado |
|---|---|---|---|
| M1 | Quitar `idioma` de `textoHorario(f.programacion, idioma)` (`ProgramacionDoohmain.tsx:283`) | pantallas-campanas-finanzas | **muere** (3 rojas) |
| M1b | Quitar `idioma` de `textoOrigenDoohmain(null, idioma)` (`SiteFicha.tsx:533`) | **suite entera** | **SOBREVIVE** (4514 en verde), ver tabla |
| M1b2 | Quitar `idioma` del otro `textoOrigenDoohmain` (`SiteFicha.tsx:532`) | pantallas-comercial | **muere** (3) |
| M1c | Quitar el `idioma` de `armarListaFacturas` (`finanzas/page.tsx:155`) | pantallas-campanas-finanzas | **muere** (1, el barrido de compartidos) |
| M2 | «Las que quepan» → «Las que quepen» en el literal de `doohmain-programacion.ts` | textos + pantallas + doohmain | **muere** (4) |
| M2b | «(dada de baja)» → «(dado de baja)» en `ES_COMPARTIDOS` | lib/i18n | **muere** (2: instantánea y paridad con `asignacion.ts`) |
| M3 | Poner en español el inglés `compartidos.asignacion.sin-asignar` | lib/i18n | **muere** (5) |
| M4 | Volver a duplicar `finanzas.periodo.mes` en ES y EN | lib/i18n | **muere** (3, incluida «UNA sola fuente») |
| M4b | `CLAVE_PERIODO.mes` → la clave de `trimestre` | lib/i18n + components | **muere** (5) |
| M5 | Toast de Finanzas: `finanzas.factura.generada` → `finanzas.recordatorio.enviado` | lib/i18n | **muere** (1) |
| M5b | Toast de Comercial: `comercial.tarifas.guardadas` → `comercial.ficha.galeria-guardada` | **suite entera** | **SOBREVIVE** (4514 en verde), ver tabla |

Después de los mutantes, `git status --short` sin los `desktop.ini` ajenos y sin este informe sale vacío, y `git diff --stat` también.

---

## 3 · Decisiones de glosario para el dueño

Ninguna bloquea la integración.

1. **«Comercial» como encabezado de sección** en la ficha de campaña (`campanas.ficha.comercial`, `textos/campanas.ts:645`) dice hoy «Commercial». Es correcto como excepción frente al menú «Sales», pero un encabezado «Commercial» a secas se entiende peor en inglés que «Commercial terms» o «Pricing». Decide el dueño.
2. **«thousand (invariable)»:** `propuestas.alta.cpm.titulo` dice `Impressions booked, in thousands (1 = {mil} impressions)`. «in thousands» es un modismo, no la unidad contada, y yo lo daría por válido. Si el glosario quiere el singular estricto, la forma sería `Impressions booked, per thousand (1 = {mil} impressions)`.
3. **Cifra o letra en las periodicidades.** El glosario fija «every two weeks» (en letra), y la costura dejó «every 2 months» / «every 6 months» (en cifra), igual que `compartidos.periodicidad.*`. Es coherente dentro de la aplicación, pero mezcla las dos formas. Conviene decidir una.
4. **Los textos alrededor del selector de periodo** (`elige`, aria, «a»/«to») siguen duplicados entre Finanzas y Propuestas. Hay que decidir si se llevan a `compartidos.periodo.*` o si se aceptan como textos de cada tablero.

---

## Segunda pasada (2026-11-02)

Revisé `git diff 36d7a210..HEAD`: 7 commits, de `e3421317` a `f79240b7`, y 20 archivos.

### Veredicto: **VERDE**. Se puede integrar.

Los 11 hallazgos están resueltos y se cumplen las cuatro decisiones del dueño. El español no cambia: 109 de 109 estados salen idénticos y no cambia ningún valor de `DICCIONARIOS.es`. Typecheck y unitarias en verde, y los 6 mutantes mueren, incluidos los dos que antes sobrevivían.

### 1 · Hallazgos de la primera pasada

| Hallazgo | Cómo quedó | ¿Resuelto? |
|---|---|---|
| Estado de cuenta vacío con rango | `EstadoCuenta.tsx:144-158`: en inglés y con `esEtiquetaRango`, usa `finanzas.estado-cuenta.vacio-rango`, que se pinta «No invoices or payments from Jan 5, 2026 to Mar 9, 2026.». Se lee bien. En español sigue la rama de siempre (el estado nuevo afirma «Sin facturas ni pagos en 2026-01-05 a 2026-03-09.»). La versión española de `vacio-rango` («del {desde} al {hasta}») no se pinta nunca, pero existe porque `ClaveTexto` sale del español, y es correcta si algún día se usa. | Sí |
| M1b: falta un estado sin id de DOOHmain | Hay un estado nuevo en `pantallas-comercial.test.ts`. M1b ahora **muere** (3 rojas). | Sí |
| M5b: los toasts de Comercial no estaban atados a su clave | Hay una gemela nueva en `textos/comercial.test.ts` (SiteFicha, la página de Comercial y GestionCodigos). M5b ahora **muere**. | Sí |
| Textos alrededor del selector | `compartidos.periodo.{aria,elige,desde,hasta,a}` sustituyen a `finanzas.periodo.{aria,elige}`, `finanzas.comun.{desde,hasta,a}` y `propuestas.tablero.{periodo,a,elige-fechas}`. Los dos tableros los usan, y ya no queda ninguna referencia a las claves viejas (solo la lista de «retiradas» de `finanzas.test.ts:94-95`). Siguen existiendo `Desde`/`Hasta` en `propuestas.comun.*` y `campanas.playlogs.*`, pero son campos de otros formularios, no del selector. | Sí |
| Comentario viejo en `textos/finanzas.ts` | Reescrito: ahora explica que el selector vive en `compartidos.periodo.*`. | Sí |
| `Don't` en `diccionario.ts` | Cambiado a `Don’t`. La prueba del apóstrofo ahora recorre `DICCIONARIOS.en` entero. | Sí |
| Comillas rectas en `paquete-conjunto` | Cambiadas a `“{nombre}”`. Hay una prueba nueva de comillas tipográficas en todo el diccionario; sigue respetando los segundos de las coordenadas (`57"N`). | Sí |
| «Internal ref.» a media frase | Cambiado a «internal ref.» en `campanas.lista.buscar` y `campanas.extender.nota`. Hay una prueba que lo vigila. | Sí |
| Sangría de `ComprobanteDialog.tsx` | Corregida (`:91-97`). | Sí |
| La bóveda atribuía la fecha a `armarComprobante` | La línea 749 de la bóveda ahora dice «el emisor de `armarComprobante` y la fecha en `ComprobanteDialog`». | Sí |

**Las decisiones del dueño:**
- **«Pricing»:** `campanas.ficha.comercial` vale `Pricing` y casa con su contexto (Subtotal (net), VAT). La excepción de `costura.test.ts` está actualizada.
- **«in thousands»:** sin cambios.
- **Periodicidades en letra:** «Every two months», «Every six months» e «installments every two/six months». Buscar `every \d` o `\d+-(week|month|day)` en todo el inglés da 0, y hay una prueba nueva que lo vigila.
- **Una sola fuente en `compartidos.periodo.*`:** ver la fila del selector en la tabla de arriba.

### 2 · Español intacto

Repetí el espejo de la primera pasada: las 19 fuentes no-prueba del diff `f2e0a15f..HEAD`, en su versión de `f2e0a15f`, con un `vi.mock` por módulo y las pruebas de pantallas de HEAD.

**Estados:** propuestas 23, compartidos 6, campañas y finanzas 56, comercial 24. Son **109 estados** y 1 140 543 bytes. `diff -rq viejo nuevo` sale **vacío**.

Para comprobar que el espejo carga el código viejo, corrí el inglés del espejo. Falla como se espera, por ejemplo con `'Todo el día (sin franja)'`, `'Sin asignar…'` y `'All clients · November 2026'`.

**`DICCIONARIOS.es` de f2e0a15f frente a HEAD**, con copias completas de los diccionarios viejos:
- **0 valores cambiados**;
- 14 claves retiradas, todas duplicados que pasaron a `compartidos.periodo.*`;
- 23 nuevas: 5 de `compartidos.periodo`, 17 de la primera pasada y `vacio-rango`.

En `DICCIONARIOS.en` cambiaron 38 valores. Los que no son solo el apóstrofo son los esperados: comillas, Payment frequency, profile, periodicidades en letra, internal ref., Pricing, cuotas y proof photos.

### 3 · Pruebas y mutantes

```
cd apps/web && npm run typecheck   → tsc --noEmit, limpio (exit 0)
cd apps/web && npm test            → Test Files 331 passed (331) · Tests 4529 passed (4529)
```

Todos los mutantes se corrieron contra la suite entera y se restauraron con `git checkout -- <archivo>`:

| # | Mutante | Resultado |
|---|---|---|
| M1b | Quitar `idioma` de `textoOrigenDoohmain(null, idioma)` (SiteFicha) | **muere** (3) |
| M5b | Toast `comercial.tarifas.guardadas` → `comercial.ficha.galeria-guardada` | **muere** (1, `comercial.test.ts`) |
| M6 | Quitar la rama `vacio-rango` de `EstadoCuenta` | **muere** (1) |
| M7 | `compartidos.periodo.elige` → otra clave en `TableroPropuestas` | **muere** (1) |
| M8 | «Every six months» → «Every 6 months» | **muere** (2) |
| M9 | «Pricing» → «Commercial» | **muere** (2) |

El árbol queda limpio: borré el directorio temporal y `git status --short`, sin los `desktop.ini` ajenos, solo muestra este informe. No usé `git stash`.

**Nota:** el autor commiteó la primera versión de este informe en `36d7a210`. Esta sección va añadida encima y está sin commitear.

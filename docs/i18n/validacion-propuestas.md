# Validación · lote piloto de inglés «propuestas»

- **Rama:** `feat/ingles-propuestas` (worktree `.claude/worktrees/ingles-propuestas`), `git diff main...HEAD`: dos commits (`c5df5c30`, `bea649a8`), 18 archivos.
- **Fecha:** 2026-11-02 · **Validador:** agente independiente (no corrige código; este informe es lo único que escribe, sin commitear).

## Veredicto: **ÁMBAR**: se puede integrar con las correcciones menores de abajo

El español está intacto: lo comprobé de forma mecánica contra `main` y no solo leyéndolo. Además, typecheck y unitarias están en verde, y no se tocó nada prohibido. El inglés se lee como software B2B en casi todo el lote. Hay **6 hallazgos de severidad media**: un actor imposible («Settings has to raise the cap»), una concordancia rota con el contador, un texto de ayuda que nombra un botón que sigue en español, una redundancia visible, un rótulo incompleto y un singular forzado. También hay unos 20 de severidad baja. Ninguno toca el español y el inglés sigue apagado (`IDIOMA_INGLES` no se tocó), así que nada bloquea la integración.

Hay **dos cosas que no son de este lote, pero que impiden ENCENDER el inglés** y no deben olvidarse:

1. Siguen en español los textos de los módulos compartidos. El lote los declara en la nota de la bóveda y en la cabecera de la prueba.
2. Las fechas siguen en formato `DD/MM/AAAA`, que un lector de EE. UU. interpreta mal.

Y una debilidad de la prueba: **121 de las 437 claves no se rinden en ninguno de los 20 estados**. Un cambio en ellas no lo atrapa ninguna prueba (lo demostré con 3 mutantes que sobreviven).

---

## 1 · Hallazgos de sentido en contexto

Las líneas son de `apps/web/lib/i18n/textos/propuestas.ts` (valor `en`) y del punto de uso.

| clave | archivo:línea | inglés actual | problema | inglés propuesto | sev. |
|---|---|---|---|---|---|
| `propuestas.ficha.descuento.tope-aviso` | textos:822 · `propuestas/[id]/page.tsx:660` | ` Your organization allows up to {tope}; for more, Settings has to raise the cap.` | «Administración» aquí es quien actúa. Con el glosario (módulo → Settings), una pantalla acaba siendo el sujeto que «tiene que subir el tope». Se lee mal. | ` Your organization allows up to {tope}; to go higher, an admin has to raise the cap in Settings.` | media |
| `propuestas.ficha.mapa.parcial` | textos:866 · `[id]/page.tsx:1027` | `{n} of {pantallas} have no coordinates and do not appear on the map.` | Con `n=1` sale «**1 of 2 screens have** … do not appear», visto en el render. El verbo no concuerda y el hueco no lo permite. | `Screens without coordinates (not shown on the map): {n} of {pantallas}.` | media |
| `propuestas.ficha.mapa.sin-coords.uno` | textos:864 · `[id]/page.tsx:1019` | `The {n} screen in this proposal has no coordinates entered.` | Solo se usa con n=1: «The 1 screen in this proposal…» no es natural. | `The only screen in this proposal ({n}) has no coordinates entered.` (o quitar el hueco, si la regla de huecos lo permite) | media |
| `propuestas.alta.mapa.ayuda` + `alta.mapa.dibujar` | textos:673/675 · `propuestas/page.tsx:1481` | `… Or use **Draw area** to keep only…` | El botón real lo pinta `MapView` y sigue diciendo «Dibujar zona» (`components/demo/MapView.tsx:403`, fuera del lote). La ayuda manda a pulsar un botón con un rótulo que no existe en pantalla. | Traducir el botón de `MapView` en el mismo lote, o que la ayuda reciba el rótulo desde `MapView`. | media |
| `propuestas.ficha.codigo-pendiente` | textos:807 · `[id]/page.tsx:598` | ` · promo code pending approval` | Va pegado a `comun.codigo-pct` y en pantalla sale «**Promo code** VERANO20 (20%) · **promo code** pending approval» (visto en el render). | ` · pending approval` | media |
| `propuestas.tablero.ganancia-por-aprobada` | textos:959 · `TableroPropuestas.tsx:176` | `Profit per approved` | Rótulo de KPI incompleto: le falta el sustantivo. | `Profit per approved proposal` | media |
| `propuestas.lista.sin-resultados` | textos:613 · `propuestas/page.tsx:300` | `… Clear the filter to see all {n}.` | Con n=1 sale «see all 1» (el español arrastra «ver las 1»). | `… Clear the filter to see all proposals ({n}).` | baja |
| `propuestas.codigo.quitado` / `codigo.quitar.ayuda` / `codigo.rechazado` | textos:872/888/875 · `BloqueCodigoPropuesta.tsx:151/262` | `Removing it returns its use to the promo code.` | Al unir cupón y código en «promo code», la frase dice que el código se devuelve el uso a sí mismo. | `Removing it gives the use back (it no longer counts against the code's limit).` / toast: `Promo code removed; its use was given back` | baja |
| `propuestas.codigo.ayuda` | textos:890 · `BloqueCodigoPropuesta.tsx:275` | `Applying it uses up one of its uses — removing it gives it back —` | «uses up one of its uses» se repite. Además, `20 %` lleva espacio, cosa que no se hace en inglés. | `Applying it consumes one of its uses (removing it gives it back) …` · `20% plus 20% leaves the client paying 64%, not 60%` | baja |
| `codigo.aplicado`, `codigo.opcion`, `calc.rb.prima`, `elegir-cliente.iva`, `ficha.descuento.tope` | textos:870/899/746/939/761 | `({pct} %)`, `{pct} % ·`, `premium {pct} %`, `(VAT {pct} %)`, `{tope} %` | El resto del lote usa `{pct}%` sin espacio (inconsistencia dentro del lote). En inglés no lleva espacio. | `{pct}%`, `VAT {pct}%`, `{tope}%` | baja |
| `propuestas.alta.cpm.titulo` | textos:681 · `page.tsx:1573` | `Thousands of impressions booked (1 thousand = {mil} impressions)` | «1 thousand» resulta torpe. En DOOH, lo que se compra son impresiones en miles (CPM). | `Impressions booked, in thousands (1 = {mil} impressions)` | baja |
| `propuestas.alta.cpm.equivale` | textos:684 · `page.tsx:1587` | `thousands = {n} impressions` | Va detrás del número del campo («2,500 thousands»). En inglés es «2,500 thousand». | `thousand = {n} impressions` | baja |
| `propuestas.calc.mensual` | textos:748 · `page.tsx:2000` | `… ÷ {spots} spots of one advertiser per month = …` | «spots of one advertiser» suena poco natural. | `… ÷ {spots} spots per advertiser per month = …` | baja |
| `fila.ninguno-aprobado`, `ficha.ninguno-aprobado`, `ficha.kpi.aprobado.ninguno` | textos:625/813/804 | `no site approved yet`, `No site approved yet`, `no site approved out of {n}` | En inglés natural va en plural tras «no». | `no sites approved yet` · `No sites approved yet` · `no sites approved (of {n})` | baja |
| `propuestas.lista.kpi.ganado.sub` | textos:599 · `page.tsx:211` | `{aprobadas} · lost {perdido} across {rechazadas}` | «across» sobra; sale «lost $ 3k across 1 rejected». | `{aprobadas} · {perdido} lost on {rechazadas}` | baja |
| `propuestas.tablero.aprobadas.sin-venta` | textos:950 · `TableroPropuestas.tsx:149` | `sales —, not calculated for these proposals` | Calco del español: la raya con coma es ilegible. | `sales not calculated for these proposals` | baja |
| `propuestas.tablero.col.aprobada` | textos:970 · `TableroPropuestas.tsx:232` | `Approved` | La columna contiene una FECHA. | `Approved on` | baja |
| `propuestas.codigo.lleva` | textos:877 · `BloqueCodigoPropuesta.tsx:215` | `… carries the promo code {codigo} at {pct}, which is already locked` | «at 20 %» es ambiguo, y «which» puede referirse al código o al porcentaje. | `This proposal has promo code {codigo} for {pct} off, locked in: if the code changes or is deleted, this price does not move.` | baja |
| `propuestas.condiciones.sin-vigencia` | textos:911 · `BloqueCondicionesVigencia.tsx:77` | `… using the number of days your organization has in Settings.` | «has in Settings» resulta torpe. | `It is set automatically when sent, using the default number of days in Settings.` | baja |
| `propuestas.condiciones.vencio` | textos:909 · `BloqueCondicionesVigencia.tsx:75` | `… the link no longer allows accepting it. …` | Calco del español. | `Expired on {fecha}: it can no longer be accepted through the link. Set a new date or send it again.` | baja |
| `propuestas.elegir-cliente.titulo` | textos:933 · `ElegirClienteDialog.tsx:58` | `Which client is billed?` | Es una pregunta de un diálogo para elegir, no un hecho. | `Which client should be billed?` | baja |
| `propuestas.alta.propia.texto` | textos:703 · `page.tsx:1705` | `no rent · its cost is power and operation` | «power and operation» suena poco natural. | `no rent · its costs are electricity and operations` | baja |
| `propuestas.ficha.folio.nota` | textos:781 · `[id]/page.tsx:412` | `· the client only gets access through the link (token)` | Suena forzado. | `· the client can only access it through the link (token)` | baja |
| `propuestas.alta.mapa.ayuda` | textos:673 | `Tap a point …` | En una pantalla de escritorio se dice «Click». | `Click a point …` | baja |
| `propuestas.codigo.motivo-falta` | textos:874 · `BloqueCodigoPropuesta.tsx:175` | `Write the reason for the rejection` | En formularios lo habitual es «Enter». | `Enter a reason for the rejection` | baja |
| `propuestas.comun.paquete-conjunto` | textos:569 · `[id]/page.tsx:572` | `Bundle "{nombre}" — price for the set` | Rótulo de fila del desglose. | `Bundle "{nombre}" — bundle price` | baja |
| `propuestas.documento.para` | textos:995 · `propuesta/[id]/page.tsx:92` | `To` | En la cabecera de una propuesta comercial impresa lo habitual es otra cosa. | `Prepared for` | baja |
| (comentario de cabecera de `EN_PROPUESTAS`) | textos:538-539 | — | El comentario dice «Title Case» para botones y cabeceras, pero el lote usa **sentence case** en todos (`Generate campaign`, `Sites and rent`), igual que el menú. La práctica es la buena y el comentario no la describe. | Corregir el comentario a «sentence case». | baja |

**Lo revisado y que está bien** (para no repetirlo): las frases con huecos de la lista sin resultados («No approved proposals for X matching “q”»), el orden de `calc.rb.hora` y `calc.spots-dia`, `fila.neto-aprobado`, `alta.periodo`, `ficha.paquete.vendido` y `ficha.paquete.ayuda` con sus negritas, los plurales que van por `conteo/plural` (sitio/s, propuesta/s, anunciante/s, día/s) y por claves `.uno/.otros` (`agregados`, `sin-costo`, `sin-coords`).

Términos de negocio: gross/net, VAT, incl./excl. VAT, agency commission, daypart, plays, impressions, Roadblock premium, close rate, funnel, Net to the media owner y Static para fija son correctos y coherentes. No encontré falsos amigos («actual», «eventually», «assist»…).

**Notas sobre `docs/i18n/revision-propuestas.md`:** la columna «qué es» no siempre cuadra con el uso real.

- `propuestas.estatus.*` apunta a `estatus.ts:33-36`, que es el mapa `CLAVE_ESTATUS`, no la pantalla.
- `propuestas.comun.cliente` figura solo como «aria-label», pero también es rótulo de `Campo` (`page.tsx:1297`, `ElegirClienteDialog.tsx:74`).

Por lo demás, las 437 claves de la tabla coinciden con las 437 del archivo.

---

## 2 · Español intacto: VERIFICADO (mecánicamente)

**a) Render comparado con `main`, byte a byte.**

Copié las 11 versiones de `main` de los archivos del lote, con `git show main:<ruta>`, a un espejo temporal (`apps/web/__valmain/`). Reescribí sus importaciones internas para que apuntaran al espejo y rendí con el mismo arnés de `pantallas-propuestas.test.ts` (los mismos mocks y los mismos `useState` forzados) los **20 estados**, en español, con los componentes de `main` y con los de la rama.

```
IGUAL 00-es.html 15868 … IGUAL 19-es.html 490      (20/20 idénticos, cmp -s)
```

Después borré el espejo y los volcadores.

**b) Fragmentos del diccionario contra el código de `main`.**

Usé un script con `tsx` que importa `ES_PROPUESTAS` y, para cada valor, busca cada trozo literal entre huecos en el código de `main` de los 11 archivos. Normalicé los saltos de línea de JSX a un espacio, como hace JSX.

- 424 de 437 claves aparecen literales.
- Las **13** restantes son frases que en `main` se armaban por ramas o en plantillas: `sin-resultados`, `agregados.otros`, `falta-propietario`, `falta-importe`, `calc.rb.hora`, `descuento.ayuda`, `paquete.vendido`, `sin-coords.uno/.otros`, `codigo.opcion`, `sin-costo.uno/.otros` y `documento.valida-hasta`. Las reconstruí una por una contra el JSX original, aplicando las reglas de espacios de JSX, y las **13 son exactas**.

Esto cubre también las 121 claves que no se rinden en ningún estado (toasts, `confirm` y ramas alternativas).

**c) Otras comprobaciones.**

- Los huecos son idénticos `es`↔`en` en las 437 claves.
- Los espacios al borde coinciden en las 437.
- `validacion.email` (ES) es igual a `EMAIL_INVALIDO` (lo prueba `diccionario.test.ts:141`).
- `comun.cancelar` = «Cancelar» y `comun.guardar` = «Guardar», que coinciden con los literales que sustituyen.

**Observación:** `TableroPropuestas.tsx:53` cambió de comportamiento. Si se rechaza con algo que no es `Error`, ahora guarda `''` y el texto se pinta después (`error !== null`). En español el resultado visible es el mismo, porque el estado inicial y el reinicio siguen siendo `null` (líneas 34 y 47).

---

## 3 · Nada en español dentro del inglés

**En el diccionario:** ningún valor `en` lleva acentos ni palabras españolas. Las únicas coincidencias del filtro eran nombres de hueco (`{sitio}`, `{cliente}`).

Hay 7 valores idénticos en los dos idiomas: `Error`, `Total`, `Digital`, `Divisor ({pct}%)`, `Total {monto}`, `{total} {propuestas}` y `{codigo} — {pct} % · {usos}`. Los siete son legítimos.

**En las pantallas en inglés (render de los 20 estados) quedan textos en español.** Todos vienen de fuera del archivo del lote:

| origen | ejemplo visto en el render | ¿declarado por el lote? |
|---|---|---|
| `lib/periodos.ts` (`unidadCorta`, `resumenContratacion`, `etiquetaFrecuencia`) y periodicidades | «1 mes × $ 1,000.00», «Mensual», «Catorcenal (cada 14 días)», «CPS · costo por salida», «día», «semana» | sí (bóveda §11) |
| Mezcla dentro de una frase traducida | tooltip `No. of salidas` (`alta.cantidad.titulo` con `unidadCorta`) | sí, de forma implícita |
| `etiquetaEstadoCodigo` | «Pendiente de aprobación» | sí |
| `OPCIONES_PERIODO` y `periodo.etiqueta` del servidor | «Este mes · 01/11/2026 to 30/11/2026», «Trimestre pasado», «Año» | sí |
| `AvisoFranjaCMS` | el párrafo «La franja horaria es un compromiso comercial…» | sí |
| `MapView` | botón «Dibujar zona», que choca con la ayuda ya traducida (ver §1) | sí, pero sin el choque |
| `components/demo/ui/Campo.tsx:58` | « (obligatorio)» (solo para lector de pantalla) | **no está declarado** |
| `formatFecha` | `01/12/2026` en inglés (EE. UU. lo lee como 12 de enero) | sí (bóveda, «decisión pendiente») |

En el código de los 11 archivos no quedan literales visibles en español fuera de comentarios. Lo busqué por acentos y por llamadas o atributos (`title`, `aria-label`, `placeholder`, `label`). Solo quedan `' min'`, `'spots/h'` y `'spots'`, que son términos que no se traducen.

---

## 4 · Reglas

- **Cifras y moneda en el diccionario:** ningún `$`, `MXN`, `USD`, `MX$` ni importe. Quedan números que no son dinero y que ya estaban así en `main`: `0`, `100`, `1` (validaciones), `18 h`, `20/64/60 %` (ejemplo didáctico) y los ejemplos `VERANO20`/`SUMMER20` y `PR-A0BC4F`. El «1,000» del CPM entra por hueco a propósito (GUARDIA 2).
- **Archivos prohibidos:** `git diff main...HEAD --name-only` no toca `middleware.ts`, `nav.ts`, `db/schema.sql`, migraciones, `app/api/**`, `next.config.mjs` ni `idiomas.ts`. `IDIOMA_INGLES` solo aparece en la prueba (`process.env.IDIOMA_INGLES='1'`) y en la nota.
- **Identificadores:** no se renombró nada exportado ni ninguna ruta. Hay un único renombre local en `propuestas/[id]/page.tsx:247`: `const t = trailFromLocation()` pasa a `rastro`, obligado porque `t` ahora es la función de traducción. Se quitó la importación de `EMAIL_INVALIDO` en `EnviarPropuestaDialog.tsx`; la constante sigue exportada.
- **Para revisar:** se añadieron dos `eslint-disable-next-line react-hooks/exhaustive-deps` (`propuestas/page.tsx:122` y `[id]/page.tsx:249`) porque ahora `t` se usa dentro de un efecto. Es inocuo hoy, pero merece un vistazo.

---

## 5 · Pruebas (corridas por mí en este worktree)

```
cd apps/web && npm run typecheck   →  tsc --noEmit, sin errores
cd apps/web && npm test            →  Test Files 319 passed (319) · Tests 4231 passed (4231)
```

**Mutantes** contra `lib/i18n/pantallas-propuestas.test.ts` y `diccionario.test.ts` (59 pruebas). Todos se restauraron con `git checkout -- apps/web/lib/i18n/textos/propuestas.ts` y el árbol quedó limpio.

| # | mutante | resultado |
|---|---|---|
| M1 | `en` de `fila.abrir` = «Abrir» | **MUERE** (1 roja: «en INGLES no queda…») |
| M2 | `es` de `lista.kpi.enviadas.sub`: «rechace» → «rechaze» | **MUERE** |
| M3 | `es` de `ficha.tabla.contratacion` sin tilde | **MUERE** |
| M4 | `es` de `alta.renta.falta-importe` con un espacio doble | **MUERE** |
| M5 | `en` de `calc.espacios.aria` copiado del español | **MUERE** (2 rojas) |
| M6 | `es` de `tablero.sin-costo.uno`: «alguna» → «algúna» | **SOBREVIVE** |
| M7 | `es` de `calc.rb.prima`: `{pct} %` → `{pct}%` | **SOBREVIVE** |
| M8 | `en` de `calc.rb.prima` puesto en español | **SOBREVIVE** |

**Por qué sobreviven:** medí qué claves salen en el HTML español de los 20 estados, y **121 de 437 (28 %) no aparecen en ninguno**: toasts, `window.confirm`, el Roadblock, n=1 y estados de carga. Para esas, la prueba solo garantiza que la clave inglesa EXISTA (el tipo `Record`); no garantiza que el español sea el de siempre ni que el inglés no esté en español.

La comprobación de §2b cubre hoy ese hueco. Pero es de este informe, no del repositorio. **Recomendación:** añadir una prueba barata sin render que compare cada `ES_PROPUESTAS[k]` con una instantánea congelada y cada `EN_PROPUESTAS[k]` contra la lista de frases españolas (el barrido de la línea 645 ya hace la segunda parte, pero solo sobre el HTML rendido).

---

## 6 · Decisión del dueño (glosario)

1. **«Códigos de negociación»: «Negotiation codes» (menú) o «promo code» (lote).** La nota ya lo marca. Añado que unir cupón y código en un solo término es lo que vuelve confusas `codigo.quitado`/`quitar.ayuda` («returns its use to the promo code»). Si se queda «promo code», esas frases deben redactarse sin el término; si se elige otro par (código = *negotiation code*, cupón = *coupon*), se resuelve solo.
2. **Administración → «Settings».** Funciona para el módulo («in Settings»), pero no cuando «Administración» es quien actúa (`descuento.tope-aviso`). Hay que decidir si en inglés el actor es «an admin».
3. **folio → «ref.» / «reference».** Conviven «Internal ref.:», «Ref.» (columna) y «Reference or name…» (búsqueda). Es aceptable, pero conviene elegir una forma visible.
4. **«rotations/h»** para rotaciones del loop. En DOOH también se usa «loops/h» o «plays/h». Es discutible, no un error.
5. **Formato de fecha y de moneda en inglés** (`DD/MM/AAAA`, `$ 1,234.50`). Ya está anotado como pendiente. Debe resolverse antes de encender `IDIOMA_INGLES`, no después.

---

## Segunda pasada (2026-11-02): `git diff bea649a8..HEAD`, commits `103d86ab`, `f7cc4767`, `2bfd1102`

### Veredicto: **ÁMBAR**

**El contenido está en VERDE.** Lo verifiqué todo por mi cuenta:
- los hallazgos de la primera vuelta están resueltos y las frases nuevas tienen sentido en su contexto;
- el español sigue idéntico a `main`;
- las fechas en español no cambian en ninguna parte de la app;
- `formatMonto` no se tocó;
- todas las pruebas están en verde y los 3 mutantes que sobrevivían ahora mueren.

**Lo que impide integrar tal cual es basura en el commit, no la traducción.** `2bfd1102` commitea **296 archivos `desktop.ini`** de OneDrive (`[.ShellClassInfo] IconResource=C:\Program Files\…`). **190 de ellos están dentro de `apps/web/app/api/**`**, que es zona prohibida para este lote. `main` ya arrastraba 14. No se ejecutan, pero ensucian el repositorio y el diff de la revisión.

**Corrección obligatoria antes del merge:** sacar del índice los `desktop.ini` que añade la rama (`git diff --name-only bea649a8..HEAD | grep 'desktop.ini$'` → `git rm --cached`) y añadir `desktop.ini` a `.gitignore`. Con eso el veredicto pasa a VERDE.

### 1 · Hallazgos de la primera vuelta

Comprobé los cambios en el diccionario y en el HTML inglés rendido de los 20 estados:

| hallazgo | estado | cómo se lee ahora en pantalla |
|---|---|---|
| `descuento.tope-aviso` | resuelto | «Your organization allows up to **30%**; to go higher, an admin has to raise the cap in Settings.» |
| `mapa.parcial` | resuelto | «Screens without coordinates (not shown on the map): 1 of 2 screens.» Es correcto con cualquier n. Repite «screens» dos veces: menor, aceptable. |
| `mapa.sin-coords.uno` | resuelto | «The only screen in this proposal has no coordinates entered.» El español pasa a la cifra literal «Ninguna de las 1 pantalla…», que es exactamente lo que `main` pintaba con n=1. |
| `alta.mapa.ayuda` / botón de `MapView` | resuelto | El botón de `MapView` usa la MISMA clave (`MapView.tsx:405`). Su español «Dibujar zona» es idéntico al literal de `main` (`MapView.tsx:403`), así que el resto de la app no cambia. Ahora dice «Click a point». |
| `ficha.codigo-pendiente` | resuelto | «Negotiation code VERANO20 (20%) · pending approval» |
| `tablero.ganancia-por-aprobada` | resuelto | «Profit per approved proposal» |
| `%` con espacio | resuelto | Se usa `{pct}%` en todo el inglés. La nueva clave `comun.pct` cubre los `<b>{x} %</b>` que estaban en JSX; en español sigue «{pct} %». |
| Las ~20 de severidad baja | resueltas | «$ 3k lost on 1 rejected», «sales not calculated…», «Approved on», «Prepared for», «Which client should be billed?», «Click», «Enter a reason…», «bundle price», «electricity and operations», «thousand = … impressions», «spots per advertiser per month» y «see all proposals ({n})». El comentario de cabecera ya dice sentence case. |
| «Devolver el uso» | resuelto, con sentido | Toast: «Negotiation code removed; the use it consumed is available again». Ayuda: «Removing it gives the use back (it no longer counts against the code's limit).» Explicación: «Applying it consumes one of its uses (removing it gives it back)…» Ninguna dice ya que el código se devuelve el uso a sí mismo. |
| Nuevas `.uno` / `.otros` | correctas | `alta.salidas.uno/.otros` dan «1 play» / «97,200 plays»; `paquete.opcion.uno/.otros` dan «1 screen» / «2 screens». En los dos casos el español queda igual en ambas formas («salidas», «pantallas»), que es lo que hacía `main`. |

**Mi opinión sobre «spots/h» en el Roadblock: es correcto dejarlo.**
- `rotacionesHora` es cuántas veces se reproduce el LOOP en una hora, así que «loops/h» es exacto.
- `spotsHoraRB = Math.floor(SEGUNDOS_POR_HORA / duracionSeg)` (`propuestas/page.tsx:1862`) cuenta SPOTS por hora: un Roadblock compra todos los espacios del loop. Ponerle «loops/h» daría un número falso con su unidad.

La decisión del dueño («spots por hora del loop → loops/h») se aplica bien solo a la primera cifra.

### 2 · Español intacto: VERIFICADO otra vez, mecánicamente

- **Render.** Volví a rendir los 20 estados en español con los componentes de `main` (espejo temporal, ya borrado) y con los de la rama: **20/20 idénticos** con `cmp`.
- **Diccionario contra el código de `main`.** Ahora hay 440 claves y comparé sus fragmentos contra los 11 archivos de `main` más `MapView.tsx`. Las 13 que no aparecen literales son las mismas 13 frases compuestas que ya reconcilié en la primera vuelta. `sin-coords.uno` ahora es literal y coincide con la salida de `main` para n=1. Los huecos y los bordes son iguales entre `es` y `en` en las 440.
- **`formatFecha` / `formatFechaHora` en TODA la app.** El diff de `derive.ts` solo añade el parámetro `idioma = 'es'` y la rama `en`; la rama española no se tocó.
  - Busqué los usos por referencia: `ComercialOpex.tsx:105` (`const fecha = formatFecha`) siempre llama con un solo argumento.
  - No hay ningún `.map(formatFecha)` ni nada parecido.
  - Además comparé la función de `main` (extraída con `git show`) con la de la rama, sin idioma y con `'es'`: 11 entradas raras más una fecha cada 7 h durante 2025–2026, en formato ISO y en fecha sola. **0 diferencias.**
  - En inglés: `Dec 1, 2026` y `Dec 1, 2026, 3:45 PM`.
- **Moneda.** `git diff main...HEAD` no toca `formatMonto`, `formato-numero.ts` ni `dinero.ts`. Los importes en inglés siguen saliendo como `$ 1,234.50`, que es lo esperado.

### 3 · Glosario en el inglés

- En `EN_PROPUESTAS` no hay ningún «promo», «coupon», «rotation» ni «Ref.» suelto.
- En los componentes del lote no hay «promo code».
- «Folio» se traduce como **«Internal ref.»** en los tres sitios: la búsqueda («Internal ref. or name…»), la ficha («Internal ref.:») y la columna del tablero.
- Quedan «Reference rent» y «Total ref. rent», pero traducen «renta de referencia», no el folio. Son correctas; si al dueño le chocan junto a «Internal ref.», podrían pasar a «Est. rent». Eso es decisión suya, no un defecto.
- Sigue en español lo ya declarado de los módulos compartidos («Este mes», «1 mes», «No. of salidas») y el « (obligatorio)» de `Campo` que solo oye el lector de pantalla. No bloquea mientras el inglés esté apagado.

### 4 · Pruebas (corridas por mí)

```
cd apps/web && npm run typecheck   →  tsc --noEmit, sin errores
cd apps/web && npm test            →  Test Files 321 passed (321) · Tests 4244 passed (4244)
```

Mutantes contra `lib/i18n/` y `lib/data/derive.fecha-idioma.test.ts`:

| # | mutante | resultado |
|---|---|---|
| M6 | `es` de `tablero.sin-costo.uno`: «algúna» | **MUERE** (instantánea ES) |
| M7 | `es` de `calc.rb.prima`: `{pct}%` | **MUERE** (instantánea ES) |
| M8 | `en` de `calc.rb.prima` puesto en español | **MUERE** (instantánea EN + «el inglés no está en español») |
| M9 | `en` de `alta.salidas.uno` = «{n} salidas» | **MUERE** (2 rojas) |
| M10 | `es` de `mapa.sin-coords.uno`: «de la 1 pantalla» | **MUERE** |
| M11 | rama española de `formatFecha`: `dd-mm-aaaa` | **MUERE** (6 rojas en `derive.fecha-idioma` y en las pantallas) |

Todos se restauraron con `git checkout`.

**Aviso menor.** Cuando falla la prueba de instantánea, vitest reescribe `__snapshots__/propuestas.test.ts.snap` con LF y git lo marca como modificado aunque el contenido sea el mismo (`core.autocrlf=true`). Lo restauré. Conviene añadir `*.snap text eol=lf` a `.gitattributes` para que no confunda a nadie.

El árbol quedó limpio salvo este informe.

### 5 · Reglas

- **Dinero en el diccionario.** No hay `$`, códigos de moneda ni importes. Las cifras que quedan no son dinero y ya existían, más el literal «1» de `sin-coords.uno`, que es copia del texto de `main`.
- **Archivos prohibidos, código.** Sin contar los `desktop.ini`, el diff solo toca los archivos del lote, `MapView.tsx`, `lib/data/derive.ts` (más su prueba nueva), las pruebas e instantáneas de i18n, la revisión, este informe y la nota de la bóveda. Nada en `middleware.ts`, `nav.ts`, `db/schema.sql`, migraciones, `next.config.mjs`, `idiomas.ts` ni `IDIOMA_INGLES`.
- **Archivos prohibidos, basura.** Los **190 `desktop.ini` dentro de `app/api/`** sí entran en zona prohibida aunque no sean rutas. Ver el veredicto.

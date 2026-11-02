# Validación · lote de inglés «campañas y finanzas»

- **Rama:** `feat/ingles-campanas-finanzas` (worktree `.claude/worktrees/ingles-campanas-finanzas`). Revisé `git diff integra/ingles...HEAD`: un commit (`614b6480`) y 35 archivos.
- **Fecha:** 2026-11-02 · **Validador:** agente independiente. No corrige código. Este informe es lo único que escribe y no lo commitea.

## Veredicto: **ÁMBAR**. Se puede integrar; conviene corregir antes lo de severidad media

Comprobé tres cosas de forma mecánica y no solo leyendo:

- el español está intacto (54 de 54 estados idénticos byte a byte a `integra/ingles`);
- typecheck y unitarias están en verde;
- no se tocó nada prohibido.

El inglés se lee como software B2B y respeta el glosario del piloto: negotiation code, Internal ref., daypart, work order, landlord, collections, VAT, Click, sentence case y `%` sin espacio.

Hay **6 hallazgos de severidad media**, todos de terminología de facturación:

- un botón que dice que el usuario paga cuando en realidad registra un cobro;
- dos documentos distintos que se llaman igual, «receipt»;
- «bimonthly», que en EE. UU. es ambiguo;
- «PO Internal ref.»;
- «Received by» en el receptor de la factura;
- «6 open of 6».

Hay además unos 12 de severidad baja. El inglés sigue apagado (`IDIOMA_INGLES` no se tocó), así que nada de esto bloquea.

---

## 1 · Hallazgos de sentido en contexto

La columna «archivo:línea» lleva primero la línea del valor `en` en `apps/web/lib/i18n/textos/{campanas,finanzas}.ts` y después el punto de uso. Leí las 568 claves (393 + 175) y el HTML inglés de los 54 estados.

| clave | archivo:línea | inglés actual | problema | propuesto | sev. |
|---|---|---|---|---|---|
| `finanzas.pago.liquidar` | finanzas.ts:348 · `finanzas/page.tsx:924` | `Pay in full` | Está en el diálogo «Record payment», junto a «Record partial payment». Quien lo pulsa **registra** que el cliente pagó todo; no está pagando él. En inglés se lee como un botón para pagar. | `Record full payment` | media |
| `finanzas.comprobante.titulo` / `comprobante.aviso` frente a `comprobante-pago.titulo` / `pagos.comprobante` | finanzas.ts:416/424 frente a 360/373 · `ComprobanteDialog.tsx:50` · `ComprobantePago.tsx:65` | `Receipt F-000` · `Payment receipt. It is NOT a CFDI…` frente a `Payment receipt` · `Receipt` | Un mismo término para dos documentos distintos. Uno es el comprobante imprimible de la FACTURA (emisor, receptor, uso CFDI, IVA). El otro es el archivo que el usuario ADJUNTA como prueba de que el cliente pagó. En el render, «Payment receipt» sale como rótulo en los dos sitios. | El adjunto como **`Proof of payment`** (`comprobante-pago.titulo`, `pagos.comprobante`, `pagos.sin-comprobante` → `No proof of payment`, «Payments and receipts» → `Payments and proof`). «Receipt» queda para el comprobante de la factura. Decisión del dueño, §6. | media |
| `finanzas.parcialidad.bimestral` | finanzas.ts:266 | `{n} bimonthly installments` | En EE. UU. «bimonthly» se entiende igual como «dos veces al mes» que como «cada dos meses». «Bimestral» es cada dos meses. | `{n} installments every two months` | media |
| `campanas.ficha.folio-odc` | campanas.ts:664 · `[id]/page.tsx` (Orden de compra) | `PO Internal ref.` | Queda pegado y la mayúscula a media frase choca. Sale justo encima de «PO number (client)». | `Internal PO ref.` | media |
| `finanzas.comprobante.la-recibe` | finanzas.ts:419 · `ComprobanteDialog.tsx:78` | `Received by` | En una factura, el receptor es a quien se le factura. «Received by» parece la persona que recibió el papel. | `Billed to` (y `comun.la-emite` → `Issued by` se queda) | media |
| `campanas.resumen.ot.uno/.otros` | campanas.ts:680-681 · `ResumenCampana.tsx:80` | `{n} open of {total}` | Visto en el render: «6 open of 6». El orden no es natural en inglés. | `{n} of {total} open` | media |
| `finanzas.comprobante.uso` | finanzas.ts:420 · `ComprobanteDialog.tsx:82` | `Use: {uso}` | «Use: G03» no dice qué uso es. En la ficha de facturación el mismo dato se llama «CFDI use». | `CFDI use: {uso}` | baja |
| `campanas.lista.hilo` | campanas.ts:598 · `campanas/page.tsx:306` | `common thread` | Es la insignia fija de la campaña de demostración (`c.id === 'camp-telco'`, `page.tsx:288`). En inglés «common thread» no dice nada como etiqueta. | `demo storyline` o `featured`. Decisión del dueño, §6. | baja |
| `campanas.lista.subtitulo` | campanas.ts:574 | `Each campaign moves through the company on its own · live pipeline` | Calco del español: «moves … on its own» suena a que se mueve sin nadie. | `Every campaign’s path through the company · live pipeline` | baja |
| `campanas.validacion.pendiente.uno/.otros` | campanas.ts:904/906 · `ValidacionPanel.tsx:338` | `You have {n} approved and ready.` | Le falta el sustantivo: «You have 1 approved and ready». | `You have {n} approved creative(s) ready.`, o `.uno` → `1 approved creative ready` y `.otros` → `{n} approved creatives ready` | baja |
| `campanas.validacion.no-validar` | campanas.ts:874 | `Could not review the publication` | Es el error de guardar la decisión (aprobar o rechazar), no de «revisar». | `Could not save the publication review` | baja |
| `campanas.horario.se-transmite` | campanas.ts:790 · `FranjaProgramadaCampana.tsx:114` | `Airs in` | Va seguido de una franja («Mañana · 06:00–12:00»). Con una franja horaria en inglés se dice «during». | `Airs during` | baja |
| `campanas.playlogs.tab.pantallas` | campanas.ts:808 | `History of its screens` | Rótulo de pestaña poco natural. | `Screen history` | baja |
| `finanzas.factura.la-que-vende` | finanzas.ts:324 | ` — the one that sells` | Sufijo de una opción del selector de razón social. | ` — selling entity` | baja |
| `finanzas.factura.plazo.informativo` | finanzas.ts:340 | `Collection term (for reference with installments)` | La parte entre paréntesis no se entiende. | `Payment term (for reference only when billing in installments)`. Ver §6 sobre «collection term». | baja |
| `finanzas.pago.al-cubrir` | finanzas.ts:354 | `…the collection becomes {pagada} and reminders stop.` | «the collection becomes Paid» resulta torpe. | `…this item is marked {pagada} and reminders stop.` | baja |
| `finanzas.pago.liquidada` | finanzas.ts:342 | `Collection paid in full` | Toast; se entiende, pero es largo. | `Paid in full` | baja |
| `finanzas.periodo.al-inicio` | finanzas.ts:401 | `at start: {monto}` | El estado de cuenta del mismo lote dice «Opening balance». | `opening: {monto}` | baja |

**Lo revisado que está bien**, para no repetirlo:

- **Cobranza y facturas:** Current / Due soon / Overdue / Paid, Voided, Issued, Installments, «Installment {n} of {total}», «{pagadas} of {total} installments paid», balance, partial payment, «Record partial payment», «Payment amount», «Date received», «The amount exceeds the balance… outstanding balance».
- **Estado de cuenta:** Account statement · Opening/Closing balance · Charge/Payment/Balance · Transaction.
- **Facturación de la campaña:** «Bill in installments», «{n}-month campaign» (`.uno`/`.otros` correctos), «billed in a single payment», Tax regime, Tax ZIP code, CFDI use, «RFC (tax ID)», Legal name (del cliente) frente a Legal entities (las del usuario, igual que el menú `nav.razones-sociales`).
- **El aviso fiscal:** «It is NOT a CFDI stamped with the SAT» es correcto y claro para un lector de EE. UU.
- **La validación de publicación:** «Publication review», «Pending review», «Awaiting publication review», «To review (6)» y el botón «Review» usan el mismo término en todas partes.
- **Creativos:** «Withdrawn» (retirado) frente a «Remove creative» (bajar) están bien separados, y los toasts los respetan.
- **Proof of play y evidencias:** «Plays (proof of play)» es la sección digital; «Photo evidence» y «Evidence is uploaded when the mobile work order is closed» son lo físico; «does not count as proof for this campaign» también está bien. Es coherente con lo que declara la nota de la bóveda.
- **Reportes:** «Delivery report» (cumplimiento) y «Publication report» (condición del candado) son dos conceptos distintos y quedan distinguidos.
- **Huecos y plurales:** las frases con huecos de negrita (`bajar.texto`, `aprobar.texto`, `republicar.texto`, `playlogs.pantallas.texto`) se leen bien en el render. En inglés, `bajar.texto` añade el espacio que el español no tiene antes de «(su API», y es correcto. Los plurales `.uno/.otros` (pausar, publicadas, fallidas, IA, sin presupuesto, facturas, enviados) dan bien con n=1 y con n>1.
- **Coherencia con Propuestas:** campaign, proposal, site, screen, landlord, client, daypart, VAT ({pct}%), «Static screens», «media owner» (Propuestas «Net to the media owner» frente a Campañas «Media owner revenue (net)»), «Go to Proposals» y «Generate…». No encontré ningún «promo», «coupon», «rotation», «folio», «millar» ni «Tap».

---

## 2 · Español intacto: VERIFICADO de forma mecánica

**a) Render comparado con `integra/ingles`, byte a byte.**

1. Volqué el HTML español de los 54 estados con los componentes de la rama, usando una copia de la prueba que también vuelca el inglés.
2. Hice `git checkout integra/ingles -- <los 22 .tsx del lote>` y volví a volcar con el mismo arnés: los mismos mocks y los mismos `useState` forzados. Con los componentes viejos, las 54 pruebas españolas pasaron.
3. Restauré con `git checkout HEAD`.
4. Comprobé que la restauración era real: `ValidacionPanel.tsx` tiene 1 `t('` en la versión vieja y 48 en la nueva.

```
identicos: 54          (cmp -s, head-es/NN-es.html frente a old-es/NN-es.html, 54/54)
control: 05-es.html y 05-en.html difieren (el volcado no es trivial)
```

**b) Las 94 claves que no se rinden en ningún estado.**

Las medí: son toasts, `window.prompt`, «Subiendo…», los estados de OT y de impresión que los datos no usan, y los singulares. Para cubrirlas, un script con `tsx` toma cada valor de `ES_CAMPANAS` y `ES_FINANZAS`, lo parte en los trozos que hay entre huecos y busca cada trozo en el código viejo de los 22 archivos (`git show integra/ingles:…`) y en los módulos compartidos que no cambiaron (`lib/`, `components/`). Los saltos de línea de JSX cuentan como un espacio.

- **533 de 568** aparecen literales: 492 en el código viejo y 41 en los módulos compartidos que traducen los mapas de `etiquetas.ts`.
- Las **35** restantes son frases que el código viejo armaba con ternarios o plantillas. Las reconstruí una por una contra el JSX viejo y **las 35 son exactas**. Entre ellas: `kpi.activas.sub.*` y `sin-presupuesto.*` (`conteo()` lleva `formatNumero`, igual que ahora), `ficha.ia.*`, `resumen.ot.*`, `pausar.texto.*` (las dos formas conservan «pantalla(s)»), `validacion.pendiente.sin/.uno/.otros`, `sello.*`, `bajar.texto` (sin espacio antes de «(su API», como el JSX viejo), `aprobar.texto`, `republicar.texto`, `franja.programada/.contratada`, `playlogs.pantallas.texto`, `parcialidad.*` (= «{n} cuotas » + `PERIODICIDAD_LABEL`), `factura.dura.*`, `factura.reparto`, `plazo.informativo`, `periodo.vencido.sub.*`, `periodo.renta.por-pagar`, `cobranza.enviados.*` y `comprobante.aviso` (= `AVISO_NO_ES_CFDI`).
- **Huecos:** son idénticos entre `es` y `en` en las 568 claves.
- **Espacios al borde:** coinciden en las 568.

**c) El cambio en `components/demo/candado-dinero-y-renovar.test.ts`.**

La expresión regular sigue anclada al BOTÓN: `onClick={() => void candado.reintentar()}` seguido, a menos de 160 caracteres, de su rótulo. Lo único que cambia es que el rótulo es ahora `t('finanzas.pago.confirmar')` en lugar del literal.

- Que esa clave diga «Confirmar y registrar» lo garantiza la instantánea de `textos/finanzas.test.ts`.
- La protección sigue siendo la misma, y lo demostré con el mutante M3: cambiar el botón (`finanzas/page.tsx:910`) por `pagar(true)` **lo hace fallar**.

**Observaciones sin efecto en español:**

- Se añadieron 6 `eslint-disable-next-line react-hooks/exhaustive-deps`, porque ahora `t` se usa dentro de efectos y callbacks. Revisé los arrays de dependencias y **ninguno cambió**.
- En la ficha, `const t = trailFromLocation()` pasa a llamarse `rastro`. Es el mismo renombre forzado que hubo en el piloto.

---

## 3 · Nada en español dentro del inglés

**Diccionario.**

- Ningún valor `en` lleva acentos, `ñ` ni signos de apertura.
- Hay 7 valores iguales en los dos idiomas y los 7 son legítimos: `Total` (×2), `Error`, `Pipeline`, `No`, `snapshot` y `Subtotal`.

**Código de los 22 componentes.**

- No queda ningún literal visible con acento fuera de comentarios. El único es `TableroPeriodo.tsx:30` `'Año'`, que es la verdad en español de `OPCIONES_PERIODO` y se traduce con `CLAVE_PERIODO`.
- No hay `toast`, `confirm`, `prompt` ni atributos `title`, `aria-label`, `placeholder`, `label` o `confirmLabel` con literal.
- Los `e.message` del servidor van por I18N-05.

**Render inglés de los 54 estados.** Lo que queda en español viene de fuera del lote:

| texto visto | origen | ¿declarado? |
|---|---|---|
| «1 mes» (`Cuauhtémoc · 1 mes · $ 1,000.00`) | `resumenReserva` / `lib/periodos.ts` | sí |
| «Noviembre 2026» | `etiqueta` del periodo que manda el servidor | sí |
| «Sin asignar», «Sin asignar…», «Issued by: Sin asignar» | `etiquetaAsignacion` / `opcionesDeAsignacion` | sí |
| «Todo el día (sin franja)» | `textoHorario` | sí |
| «La franja horaria es un compromiso comercial…» | `AVISO_FRANJA_NO_VIAJA_AL_CMS` | sí |
| « (obligatorio)» (solo lector de pantalla) | `components/demo/ui/Campo.tsx:58` | sí (piloto §11) |
| `2026-10-01` como fecha de emisión del comprobante; `2026-01-01 to 2026-01-05` en el rango de playlogs | `armarComprobante` (declarado) y el rango crudo de la consulta | el primero sí; el segundo es ISO también en español |
| **«HIBRIDA»** (`CA-010 · HIBRIDA`, cola «Por validar») | `c.tipoCampana` crudo, `campanas/page.tsx:145` | **no**. Es el enum pintado tal cual, también en español, así que no es una regresión, pero en inglés se ve. |

---

## 4 · Reglas

- **Dinero en el diccionario:** no hay `$`, `MXN`, `USD` ni importes. Los únicos dígitos fuera de huecos son los códigos SAT `G01`, `G03` y `P01`, y la fecha fija «Oct 8» de `pagos.historico` («08/10» en español, que ya estaba en el código).
- **Archivos prohibidos:** el diff no toca `middleware.ts`, `components/demo/shell/nav.ts`, `db/schema.sql`, `db/migrations/`, `app/api/**`, `next.config.mjs`, `idiomas.ts`, `derive.ts` ni nada de moneda (`formatMonto`, `dinero.ts`). Fuera de `lib/i18n/` no cambia nada en `lib/`. `IDIOMA_INGLES` solo aparece en la prueba (`process.env.IDIOMA_INGLES = '1'`).
- **`desktop.ini`:** el commit no añade ninguno (`git diff --name-status integra/ingles...HEAD | grep desktop` sale vacío). En el índice quedan 14, todos bajo `vault/`, que ya estaban en `integra/ingles` (14 en los dos). No son de este lote, pero siguen ahí.

---

## 5 · Pruebas (las corrí yo en este worktree)

```
cd apps/web && npm run typecheck   →  tsc --noEmit, sin errores
cd apps/web && npm test            →  Test Files 324 passed (324) · Tests 4379 passed (4379)
```

Corrí los mutantes contra `lib/i18n`, `components/demo/campanas`, `components/demo/finanzas` y `candado-dinero-y-renovar.test.ts` (386 pruebas). El M7 lo corrí además contra la suite entera. Restauré cada uno con `git checkout -- .` y comprobé el árbol con `git status` después de cada mutante.

| # | mutante | resultado |
|---|---|---|
| M1 | `en` de `campanas.validacion.motivo-prompt` (el `window.prompt` del rechazo, que no se rinde) en español | **MUERE** (3 rojas: instantánea EN, «igual al español», acentos) |
| M2 | `es` de `finanzas.pago.liquidada` (toast que no se rinde): «líquidada» | **MUERE** (instantánea ES) |
| M3 | el botón «Confirmar y registrar» llama a `pagar(true)` en vez de `candado.reintentar()` | **MUERE** (`candado-dinero-y-renovar` §6) |
| M4 | `es` de `campanas.estado.cancelada`: «Cancelado» | **MUERE** (4 rojas: paridad con `CAMPANA_LABEL`, instantánea y 2 pantallas) |
| M5 | `t()` olvidado en el `confirmLabel` del diálogo «Bajar creativo» (vuelve a `'Sí, bajar'`) | **MUERE** (2 rojas: pantalla inglesa y barrido del diccionario) |
| M6 | `en` de `finanzas.parcialidad.anual` (no se rinde) en español | **MUERE** (2 rojas) |
| M7 | el toast de liquidar usa la clave del abono (`finanzas/page.tsx:882`: `t('finanzas.pago.liquidada')` → `t('finanzas.pago.abono-registrado')`) | **SOBREVIVE**, también en la suite entera (4379 en verde) |

**Por qué sobrevive M7.** La instantánea protege el VALOR de cada clave, y el render protege las claves que se pintan. Pero no hay nada que proteja QUÉ clave usa cada sitio que no se rinde: los toasts y las ramas de `alLograr`. Ese mutante cambia el español visible: al liquidar, el usuario leería «Abono registrado». En la versión vieja ese texto también era un literal dentro de un ternario sin prueba, así que la cobertura no empeoró, pero tampoco mejoró. Es una recomendación baja, no un defecto del lote.

**El árbol quedó limpio** salvo este informe. Los volcados, el espejo y los scripts quedaron en el scratchpad de la sesión, fuera del repositorio.

---

## 6 · Decisiones de glosario que le corresponden al dueño

1. **«Enviada al dominio» → «Sent to the domain».** Se usa en el pipeline, el KPI, la cola, el botón «Send to the domain», «Fix and resend to the domain» y «Could not send to the domain». En el código, «dominio» es el CMS de destino («envía la campaña al dominio/CMS», `campanas-repo.ts:1238`). Un usuario de EE. UU. que lea «the domain» pensará en un dominio web. Hay dos opciones:
   - «Send to CMS» / «Sent to CMS», que coincide con la sección «Sent to the domain / CMS»;
   - «Submit for publishing» / «Submitted for publishing».

   No es un error de traducción: es un término de la casa que en inglés no se entiende solo.
2. **«Comprobante»: receipt o proof of payment.** Ver el hallazgo medio de §1. Propongo «Receipt» para el comprobante de la factura y «Proof of payment» para el archivo que se adjunta.
3. **Folio de una FACTURA → «Internal ref.»** La regla del piloto se aplicó bien. Pero en la tabla de facturas, «Internal ref. | Tax UUID» con «F-000» es justo donde un lector de EE. UU. espera «Invoice no.». ¿Se mantiene «Internal ref.» también aquí o, solo para facturas, «Invoice no.»?
4. **Folio fiscal → «Tax UUID».** Es correcto: el folio fiscal ES el UUID del CFDI. «CFDI UUID» sería más preciso para quien conoce el SAT, y «Tax UUID» más legible para quien no. Las dos sirven; que elija el dueño.
5. **Plazo de cobranza → «Collection term».** Se entiende y es coherente con «collections». En facturación de EE. UU. lo habitual es «Payment terms».
6. **«Hilo conductor» de la demo → «common thread».** Ver §1. Como etiqueta en inglés no funciona; proponer «demo storyline» o «featured».
7. **Testigos y fotografías comprobatorias → «Proof photos».** Los dos sitios usan el mismo término. Si en el negocio son lo mismo, está bien; si no, conviene separarlos.

---

## Segunda pasada (2026-11-02): `git diff 614b6480..HEAD`, commits `b2913ba1` y `cb7c1c1a`

### Veredicto: **VERDE**

Lo verifiqué todo por mi cuenta, sin apoyarme en lo que dice el commit:

- los 18 hallazgos de la primera vuelta y el de «HIBRIDA» están resueltos, y las frases nuevas tienen sentido en el HTML inglés rendido;
- se cumplen todas las decisiones del orquestador;
- el español sigue idéntico a `integra/ingles` (54 de 54 estados);
- typecheck y unitarias están en verde, y M7 ahora muere.

Quedan dos observaciones de severidad baja que no bloquean (ver el final de esta sección).

### 1 · Hallazgos y decisiones, vistos en el render inglés

| hallazgo / decisión | estado | cómo se lee ahora |
|---|---|---|
| enviada al dominio → «Submitted for publishing» | cumplido | Sale en el pipeline, el KPI («submitted for publishing»), la cola («Submitted for publishing, awaiting approval before going live»), los botones «Submit for publishing» y «Fix and resubmit for publishing», el error y la ficha («Submitted for publishing (CMS)»). No queda ningún «domain» en los dos diccionarios. **El dominio es el CMS de destino, y no siempre es DOOHmain:** `campanas-repo.ts:1238` dice «envía la campaña al dominio/CMS», y la validación ya distingue pantallas «la opera Broadsign / otro CMS». |
| comprobante de la factura frente a adjunto | cumplido | El comprobante de la factura es «Payment receipt F-000», con «Payment receipt. It is NOT a CFDI…», «View the payment receipt» y «The amounts on this payment receipt…». El adjunto es «Proof of payment» en el título, la columna y «No proof of payment», y el botón es «Payments and proof of payment». Ya no queda ningún «receipt» suelto. |
| folio de factura → «Invoice no.»; folio de campaña → «Internal ref.» | cumplido, y cada término en su sitio | `finanzas.comun.folio` = «Invoice no.». Se usa en las tablas de cobranza y de facturas (`finanzas/page.tsx:268/379`), en la columna del estado de cuenta, donde los movimientos son facturas y sus pagos (`EstadoCuenta.tsx:151`), y en la línea del comprobante de la factura (`ComprobanteDialog.tsx:87`). Las cuatro son folios de factura. Lo de campañas sigue diciendo «Internal ref.»: la búsqueda («Search by name, Internal ref. or client…»), la extensión («…the Internal ref. of the new segment») y la OC («Internal PO ref.»). |
| folio fiscal → «CFDI UUID» | cumplido | Columnas y comprobante. No queda «Tax UUID». |
| plazo de cobranza → «Payment terms» | cumplido | Columna de cobranza, campo de la factura y «Payment terms (for reference only when billing in installments)». |
| hilo conductor → «demo storyline» | cumplido | Insignia de la campaña de demostración. |
| testigos → «Proof photos» | cumplido | Sin cambios respecto a la primera vuelta, porque ya estaba así. |
| Reservada → «Booked» | cumplido | «Booked · 1/10» en el pipeline. Ver la observación 2. |
| selector de periodo | cumplido | This month / Last month / This quarter / Last quarter / This year / Custom range, en el resumen del periodo y en el estado de cuenta. |
| «Pay in full» | resuelto | «Record full payment». El toast dice «Paid in full». |
| «bimonthly» | resuelto | «{n} installments every two months». |
| «PO Internal ref.» | resuelto | «Internal PO ref.» |
| «Received by» / «Use:» | resuelto | «Billed to» · «CFDI use: G03» |
| «6 open of 6» | resuelto | «6 of 6 open» |
| bajas (subtítulo, aprobados, no-validar, Airs, pestaña, la que vende, al cubrir, opening) | resueltas | «Every campaign’s path through the company · live pipeline» · «You have 1 approved creative ready.» / «You have 2 approved creatives ready.» · «Could not save the publication review» · «Airs during» · «Screen history» · « — selling entity» · «this item is marked Paid and reminders stop» · «opening: {monto}» |
| HIBRIDA | resuelto | En inglés, «CA-010 · Hybrid». En español sale el valor crudo «CA-010 · HIBRIDA», lo exige la prueba de pantalla y `campanas.test.ts` lo compara con el enum. OOH y DOOH son siglas y salen iguales en los dos idiomas (declaradas). El tipo es un enum de la base (`db/schema.sql:47`: `'OOH','DOOH','HIBRIDA'`), así que el mapa no puede quedarse sin clave. |

### 2 · Español intacto: VERIFICADO otra vez, mecánicamente

- **Render.** Volví a rendir los 54 estados en español con los componentes de HEAD y los comparé con el volcado de la primera vuelta, que se hizo con los componentes de `integra/ingles`. Resultado: **54 de 54 idénticos** (`cmp`).
- **Diccionario.** La instantánea española solo **añade** las tres claves `campanas.tipo.*`, y su valor es el enum crudo. Ningún valor español existente cambió; todas las líneas modificadas de las instantáneas son del bloque inglés.
- **Código.** El único cambio en componentes es `campanas/page.tsx:145`, y su español lo cubre el render.

### 3 · Pruebas (corridas por mí)

```
cd apps/web && npm run typecheck   →  tsc --noEmit, sin errores
cd apps/web && npm test            →  Test Files 324 passed (324) · Tests 4383 passed (4383)
```

| # | mutante | resultado |
|---|---|---|
| M7 | el toast de liquidar usa la clave del abono (`finanzas/page.tsx:882`) | **MUERE** (prueba nueva de `textos/finanzas.test.ts`) |
| M8 | `en` de `campanas.tipo.hibrida` = «HIBRIDA» | **MUERE** (3 rojas) |
| M9 | `es` de `campanas.tipo.hibrida` = «Híbrida» | **MUERE** (3 rojas, incluida la que exige el valor crudo) |
| M10 | la lista pinta `c.tipoCampana` crudo otra vez | **MUERE** (pantalla inglesa) |
| M11 | el recordatorio de cobro avisa con la clave del error | **MUERE** (prueba nueva) |
| M12 | en `ValidacionPanel.tsx:139` se cambia el toast de «retirado» por el de «bajado» | **SOBREVIVE** (4383 en verde) |

Restauré cada uno con `git checkout -- .`. El árbol quedó limpio salvo esta sección.

### 4 · Reglas

- **Archivos.** `git diff --name-status 614b6480..HEAD` no toca `middleware.ts`, `nav.ts`, `db/schema.sql`, migraciones, `app/api`, `next.config.mjs` ni `idiomas.ts`. `IDIOMA_INGLES` solo aparece en el texto de este informe.
- **Dinero.** No se añadió ninguna cifra ni símbolo de moneda al diccionario.
- **`desktop.ini`.** Los commits nuevos no añaden ninguno. El índice sigue con los 14 de `vault/`, que ya existían antes del lote.

### Observaciones (baja, no bloquean)

1. **M12.** La prueba nueva fija qué clave usa cada aviso que no se rinde, **pero solo en `finanzas/page.tsx`**. En Campañas, los toasts que no se rinden (`ValidacionPanel`: retirado / bajado, publicada / parcial; `CreativosEnDoohmain`: pausado / reanudado) siguen sin esa protección. Antes del lote tampoco la tenían, así que no es una regresión. Si se quiere cerrar, la prueba gemela es barata.
2. **«Booked» frente a «Confirmed».** En el pipeline, «Booked» (reservada) va antes que «Confirmed». En inglés comercial «booked» suele implicar que ya está cerrado, así que alguien podría leer las dos etapas como lo mismo. Es la decisión tomada y se aplica de forma coherente. Si molesta, la alternativa es «On hold» o «Reserved», pero eso lo decide el dueño.

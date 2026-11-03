# Validación · lote L4 del italiano (Campañas, Finanzas, Clientes, Reportes y Dashboard)

**Fecha:** 2026-11-03 · **Rama:** `feat/italiano-l4-campanas` (`63f918d8`), sobre
`integra/idiomas` (`6fea374a`) · **Revisión del traductor:**
`docs/i18n/revision-italiano-l4.md` · **Validador:** sesión independiente; leí
el código, los diccionarios y el HTML que se rinde, no el razonamiento del
traductor.

## Veredicto: ÁMBAR

Lo mecánico está **en verde y medido por mí**: español e inglés idénticos,
1082 claves con italiano, 0 pendientes, 0 huellas de formato en el lote, suite,
typecheck y build limpios. El ámbar lo pone **una frase gramaticalmente mal**
(«Il immobile», §3 H1), que se arregla en una línea, y un puñado de frases que un
italiano no diría así (§3 H2–H8). Ninguna toca dinero ni el español/inglés.
Con H1 corregido el lote pasa a **VERDE**; H2 (las fechas con «il 8») es de
todos los lotes y conviene decidirlo en la costura.

## 1 · Lo que medí

| Medición | Cómo | Resultado |
|---|---|---|
| HTML es/en de TODAS las pruebas | `I18N_VOLCAR_TODO` con la suite entera en la base (`6fea374a`, worktree `integra-ingles`) y en la rama, cada una en su carpeta; `diff -rq` | base **3027** HTML, rama **3448**: **0 distintos, 0 desaparecidos**; los 421 nuevos son los estados italianos de las pruebas nuevas |
| `ES_*` y `EN_*` de los cinco ámbitos | volcados a TSV con `jiti` en base y rama; `cmp` de clave + es + en | **idénticos** (1082 filas) |
| Claves italianas | mismo volcado | **1082/1082** con italiano, 0 vacías; huecos `{…}` iguales al español en las 1082 |
| Copias del inglés/español | todas las claves donde `it == es` o `it == en` | 46 + 10 (las que `es == en`: OOH, DOOH, Pipeline, RFC, No, snapshot…): **todas cognados o anglicismos legítimos** |
| Tipografía | barrido de los 1082 valores | 0 apóstrofos rectos, 0 comillas inglesas, 0 espacios antes de `%` (salvo el encabezado «Margine lordo %», igual que el español) |
| Espejo italiano | `I18N_VOLCAR_IT`, suite entera | **326** huellas (358 → 326), **0** en los archivos del lote: comercial 24, spaceeyes 87, propuestas 191, inventario-arrendadores 24 |
| CSV del estado de cuenta | `estado-cuenta-csv-idioma.test.ts` leído y mutado | es/en sin tocar (el `.ts` del CSV no cambia en la rama); italiano con importe numérico, `MX$`/`US$` en el encabezado y el `'=Beta` neutralizado |
| Suite | `npx vitest run --testTimeout=60000` | **383 archivos, 7313 pruebas** en verde (la revisión dice 7309; la base da 6988) |
| `npm run typecheck` | en el worktree | limpio |
| `npm run build` | en una copia con `git archive HEAD` (`apps/web`, `packages`, `scripts`, `db`; sin tocar el `.next` del worktree) | **limpio** (solo los avisos de ESLint que ya traía la base) |

## 2 · Frases revisadas (muestra de 60)

✔ = correcta y natural · ~ = se entiende, mejorable · ✘ = error.

| Clave | Italiano | Veredicto |
|---|---|---|
| `campanas.kpi.activas.sub.uno/otros` | 1 confermata da avviare / 3 confermate da avviare | ✔ concuerda |
| `campanas.kpi.contratado.sin-presupuesto.*` | 1 attiva senza budget inserito / 3 attive … | ✔ |
| `campanas.ficha.ia.uno/otros` | Questa campagna include 1 schermo con IA · misurazione dell’audience | ✔ |
| `campanas.resumen.ot.uno/otros` | 1 aperto su 3 / 2 aperti su 3 | ✔ (ordini, masc.) |
| `campanas.etapa.oc-recibida` | OdA ricevuto | ✔ |
| `campanas.etapa.creativo-recibido` | Creatività ricevuta | ✔ |
| `campanas.etapa.instalada` | Installata / in onda | ✔ |
| `campanas.lista.subtitulo` | Ogni campagna fa il suo percorso in azienda · pipeline in tempo reale | ✔ |
| `campanas.lista.ocultas.texto` | Nasconderle le toglie solo dal tuo elenco in questo browser: restano attive per tutti. | ✔ |
| `campanas.lista.vencida.title` | Il periodo prenotato è già terminato. | ✔ |
| `campanas.kpi.contratado` | Contrattato in corso | ~ participio sustantivado raro; «Valore contrattato in corso» |
| `campanas.ficha.cumplimiento` | Report di erogazione | ✔ término del sector |
| `campanas.ficha.snapshot.title` | Snapshot economico congelato all’accettazione — … (IVA inclusa) | ✔ |
| `campanas.ficha.estimado.title` | Costo d’acquisto interno stimato — non legato a un contratto di locazione vigente | ✔ |
| `campanas.candado.se-abre` | Il lucchetto si apre quando queste condizioni sono soddisfatte. | ✔ |
| `campanas.candado.precargados` | Numero, importo e data sono precompilati dalla campagna; modificali se il cliente ne ha indicati altri. … | ✔ |
| `campanas.candado.monto-ilegible` | L’importo non si capisce: la virgola separa le migliaia e il punto i decimali (…) | ✔ dice la verdad del campo es-MX |
| `campanas.creativo.vacio` | Ancora nessuna creatività. Caricale direttamente qui. | ✔ concuerda (le) |
| `campanas.doohmain-ahora.pausado` | «X» è in pausa in DOOHmain | ✔ |
| `campanas.doohmain-ahora.no-cambiar` | Impossibile modificarlo in DOOHmain | ~ «lo» sin antecedente; «Impossibile applicare la modifica su DOOHmain» |
| `campanas.doohmain-ahora.pausar.texto.*` | La riproduzione di X si interrompe su 1 schermo di DOOHmain. La grafica resta nel suo elenco e si può riprendere quando vuoi. | ~ el sujeto de «si può riprendere» parece la grafica; «…e puoi riprenderla quando vuoi» (la riproduzione) |
| `campanas.validacion.pendiente.uno/otros` | Hai 1 creatività approvata pronta / Hai 3 creatività approvate pronte | ✔ invariable bien tratado |
| `campanas.validacion.bajar.texto` | Vuoi davvero rimuovere X? Se era pubblicata, la sua campagna termina, ma la grafica non si può togliere da DOOHmain (…): resterà segnata come «in sospeso in DOOHmain». | ✔ |
| `campanas.validacion.aprobar.texto` | Con l’approvazione, gli annunci vengono caricati su DOOHmain. … Continuare? | ✔ |
| `campanas.validacion.toast.publicada.*` | Pubblicata in DOOHmain: 1 schermo / 3 schermi | ✔ (mejor que el «pantalla(s)» del español) |
| `campanas.validacion.*` (varias) | «in DOOHmain» / «su DOOHmain» mezclados | ~ unificar en «su DOOHmain» (plataforma) |
| `campanas.horario.se-transmite` | Va in onda in | ~ es la etiqueta de un `<dt>` («Va in onda in · Mattina 06–12»); «Fascia in onda» |
| `campanas.doohmain.horario.de/a` | Dalle … alle … | ✔ |
| `campanas.playlogs.intro` | Quante volte la creatività è passata sugli schermi digitali, … si mostra esattamente ciò che risponde il fornitore. | ✔ |
| `campanas.playlogs.vacio.nota` | È normale finché la campagna non è andata in onda. Uno zero qui è ciò che dice il fornitore, non una nostra stima. | ✔ |
| `campanas.extensiones.termina` | Termina il {fecha}. | ✘ con día 8 u 11 (H2) |
| `campanas.validacion.aviso-pantalla` | Ricorda di non avere aperta la schermata nel sito di DOOHmain, perché il processo possa andare avanti: … | ~ correcto, algo pesado |
| `finanzas.cobranza.*` | In regola · In scadenza · Scaduta · Pagata | ✔ |
| `finanzas.vence.vencida/dias` | scaduta da 5 g · tra 5 g | ✔ |
| `finanzas.parcialidad.quincenal` | 6 rate due volte al mese | ~ H4 |
| `finanzas.parcialidad.bimestral/semestral` | rate ogni due mesi / ogni sei mesi | ~ correcto por glosario; «bimestrali/semestrali» es lo natural |
| `finanzas.listas.vacio` | Niente da fatturare per ora. Quando una campagna completa il suo lucchetto (OdA + foto + report) apparirà qui. | ✔ |
| `finanzas.factura.dura.uno` | Questa campagna dura 1 mese: … si incassa in un’unica soluzione. | ✔ muy natural |
| `finanzas.factura.reparto` | 4 rate da MX$ … (l’ultima assorbe l’arrotondamento) · totale … | ✔ |
| `finanzas.pago.excede` | ⚠ L’importo supera il saldo (…). Verrà applicato solo il saldo residuo. | ✔ |
| `finanzas.pago.al-cubrir` | Coprendo l’intero saldo, l’incasso passa a Pagata e i solleciti si fermano. | ✔ |
| `finanzas.pagos.historico` | · incassato prima dell’8 ott (approssimativo) | ✔ (elisión bien hecha a mano) |
| `finanzas.cobranza.vacia` | Nessuna fattura in incasso. | ~ «Nessuna fattura da incassare.» |
| `finanzas.comprobante.aviso` | Ricevuta di pagamento. NON è un CFDI timbrato presso il SAT: … | ✔ |
| `finanzas.estado-cuenta.col.cargo/abono` | Addebito / Accredito | ✔ (un contable diría «Dare/Avere»; aceptable) |
| `clientes.vacia.alta` | Registra il primo con «Nuovo cliente». | ✔ |
| `clientes.filtro.ninguno` + `con` + `entre-*` | Nessun cliente corrisponde a «zzz» tra le agenzie. Rimuovi il filtro per vedere tutti i 5. | ✔ con búsqueda; ~ sin búsqueda: «Nessun cliente corrisponde tra le agenzie» (H5) |
| `clientes.borrar.irreversible` | Eliminare un cliente è irreversibile, quindi serve la tua password. | ✔ |
| `clientes.form.iva.ayuda` | Si sceglie dal catalogo delle aliquote IVA (Impostazioni → Configurazione). … | ✔ |
| `clientes.captacion.subtitulo` | Clienti, locatori, immobili e impianti in lavorazione, ciascuno con il proprio registro. … | ✔ |
| `clientes.captacion.ya-existe` | Il {tipo} esiste già nel sistema. | ✘ **H1**: «Il immobile» |
| `clientes.captacion.al-aprobar.pantalla` | All’approvazione non viene ancora registrato nulla: l’impianto si completa in Inventario. | ✔ |
| `clientes.captacion.form.primera-nota.ejemplo` | Com’è nato questo prospect | ✔ |
| `reportes.subtitulo` | Quanto incassa e quanto costa ogni impianto nel periodo che scegli. | ✔ |
| `reportes.dim.luz.ayuda` | Quali impianti divorano l’energia. La bolletta dell’immobile si ripartisce tra i suoi impianti. | ✔ |
| `reportes.aviso.margen-bruto` | Il margine di questo report è LORDO: … non è nascosto in un’altra schermata. | ✔ |
| `reportes.aviso.m2.todas-las-caras` | … uno bifacciale da 3 × 6 conta 36 m², non 18. | ✔ |
| `reportes.aviso.en-curso.uno` | … è trascorso 1 dei suoi 90 giorni. L’affitto degli spazi ha già maturato quel 1 giorno intero … | ~ «quell’unico giorno» |
| `reportes.nota.ot.reales.uno` | L’unica visita del periodo è al suo costo REALE registrato | ✔ mejor que el español («Las 1 visita») |
| `reportes.nota.luz.sin-esperados` | Non ci sono bollette della luce da attendersi in questo periodo. | ~ «Non sono previste bollette della luce in questo periodo.» |
| `reportes.motivo.formato` | Usa date nel formato AAAA-MM-GG | ✔ |
| `inicio.ganado-en` / `nada-aprobado` | Vinto a novembre / Ancora nulla di approvato a novembre. | ✔ |
| `inicio.ocupacion-sub` | 1.234 spazi·giorno occupati su 5.678 disponibili | ✔ (cifras italianas, ver fuera de lista) |
| `inicio.alerta.*` (contrato, renta, OT) | Valla Centro — scade tra 1 giorno (MX$ 1.000,00) · scaduto da 13 giorni | ✔ |
| `inicio.alerta.incidencia` / `tipo-alerta.incidencia` | Sito bloccato per incidente / Siti bloccati per incidente | ✘ semántico (H3) |
| `inicio.tasa-sub` | approvate tra quelle decise in 30 giorni | ~ «negli ultimi 30 giorni» |

## 3 · Hallazgos

**H1 · ✘ «Il immobile esiste già nel sistema»** —
`apps/web/lib/i18n/textos/clientes.ts:704`. `Captacion.tsx:404` mete en `{tipo}`
el tipo en minúscula: cliente, locatore **o immobile**. Con un predio aprobado
sale «Il immobile», que es un error de artículo (es «L’immobile»). Corrección,
que vale para los tres tipos sin artículo variable:
`'clientes.captacion.ya-existe': 'Questo {tipo} esiste già nel sistema.'`
(«Questo cliente / locatore / immobile»). `al-aprobar.otro` (`:706`) solo recibe
cliente y locatore, así que «il {tipo}» ahí es correcto.

**H2 · ~ Fechas con artículo: «il 8 dic», «dal 11 nov»** — 15 claves ponen
«il / al / dal / Tra il» delante de una fecha (`campanas.extensiones.termina`,
`campanas.playlogs.rango`, `campanas.playlogs.fuente`, `campanas.doohmain.pie`,
`finanzas.estado-cuenta.vencido-al`, `…vacio-rango`, `finanzas.periodo.subtitulo`,
`finanzas.periodo.vencido.sub.*`, `clientes.captacion.detalle.para-el`,
`reportes.rango`, `reportes.vacio.detalle`, `inicio.sale`,
`inicio.alerta.cobertura.*`). Con el día 8 o el 11 el italiano pide elisión
(«l’8», «dall’11», «all’8»). El traductor lo hizo bien donde la fecha es fija
(«dell’8 ott»), pero en los huecos no se puede. No es exclusivo del L4: es de
la ola 0 (`formatearFecha`) y de todos los lotes. **Propuesta para la costura:**
o una ayuda que elida el artículo según el día, o redactar sin artículo
(«Termina: {fecha}», «{desde} – {hasta}»). No lo cuento contra el lote.

**H3 · ✘ «incidencia» → «incidente»** — `apps/web/lib/i18n/textos/inicio.ts:440`
y `:508`. En italiano «incidente» es un accidente (de tráfico, laboral), y el
mismo archivo traduce `inicio.incidencia.accidente` (`:514`) también como
«incidente», así que la lista de tipos dice «Siti bloccati per incidente» y
luego «incidente» como uno de sus tipos, junto a «meteo» o «manutenzione».
Propuesta: «Siti bloccati per anomalia» / «Sito bloccato per anomalia» (o
«segnalazione»), y dejar «incidente» solo para el accidente. Avisar al L3
(arrendadores tiene `…incidencia…` aún sin italiano) para que la costura no
choque.

**H4 · ~ «6 rate due volte al mese»** — `finanzas.ts:462`. Cumple el glosario
(«due volte al mese»), pero pegado a un número se lee ambiguo (¿6 cuotas, dos
cada mes?). Lo que diría un italiano es «6 rate quindicinali»; igual
«bimestrali» y «semestrali» en `:464` y `:466`, que en italiano no tienen la
ambigüedad del inglés *bimonthly*. **Para el dueño / L5**, que fija el
glosario de periodicidades.

**H5 · ~ «Nessun cliente corrisponde tra le agenzie»** — `clientes.ts:542-543`.
Con búsqueda sale bien («corrisponde a «zzz» tra le agenzie»); con solo el
filtro de tipo «corrisponde» se queda sin complemento. Propuesta:
`'clientes.filtro.ninguno': 'Nessun cliente trovato{busqueda}{tipo}. …'` y
`'clientes.filtro.con': ' per «{texto}»'`.

**H6 · ~ «Contrattato in corso»** — `campanas.ts:1087`. Propuesta: «Valore
contrattato in corso».

**H7 · ~ «Va in onda in»** — `campanas.ts:1258`, etiqueta de un `<dt>`
(`FranjaProgramadaCampana.tsx:114`). Propuesta: «Fascia in onda».

**H8 · ~ «in DOOHmain» y «su DOOHmain» mezclados** en `campanas.validacion.*` y
`campanas.doohmain*` («Pubblicata in DOOHmain» junto a «caricati su DOOHmain»).
Para una plataforma lo natural es «su»; unificar.

**Observaciones (no son del lote):**

- **CSV en una Excel italiana.** El CSV usa coma como separador y punto
  decimal, que es lo decidido («importe numérico») y lo que la prueba fija.
  Pero una Excel con configuración regional italiana espera `;` y coma decimal:
  abrirá todo en una columna y leerá `5000.5` como texto. Se resuelve
  importando, no con doble clic. Es una decisión del dueño, no un defecto.
- **`inicio/page.tsx` deja dos cifras sin formato**: `enviadas` (`:266`) y
  `sinTarifa` (`:338`) pasan el número crudo. Solo se nota a partir de 1000
  («1234» sin punto), y es igual en es/en; no lo cuento.
- **El campo de cifra lee es-MX en italiano** (lo declara la revisión §4):
  confirmado; es ROJO y de `compartidos`.

## 4 · Fuera de lista

| Archivo | Juicio |
|---|---|
| `app/(app)/(shell)/inicio/page.tsx` | **Correcto.** Solo añade `0, idioma` a 13 llamadas a `formatNumero`; ni clases ni nodos. `formatNumero` tiene `'es'` por omisión y es-MX y en-US escriben igual, así que es/en no cambian (medido: 0 HTML distintos y la instantánea congelada del Dashboard en verde) |
| `lib/i18n/catalogos-italiano.test.ts` | **Correcto.** La prueba de la ola 0 afirmaba que el CSV italiano salía con textos ingleses; ahora `finanzas` tiene italiano y la prueba lo dice, con el nombre de archivo `estratto-conto-…` |
| `lib/i18n/textos/costura.test.ts` | **Correcto y con sentido.** «Vencida» → «Scaduta» (la cobranza) / «Scaduto» (`campanas.listas.vencida`, que se pinta en la lista de OT, `ListasCampana.tsx:94`: «ordine», masc.). «Pantalla» → «Schermo» (columna de DOOHmain, digital) / «Impianto» (reportes, captación): es el glosario. Quitar la excepción de «Pantalla» tumba la costura (mutante M6) |
| `lib/test/barrido-italiano-l4.ts` | **Correcto.** El barrido busca los trozos fijos del inglés y del español de cada clave; descarta los ambiguos con otros lotes. `IGUALES_A_PROPOSITO_L4` (45) lo revisé una por una: todas cognados o anglicismos. Límite conocido: no ve un italiano a medias («Sin movimento…», M3) ni un inglés que no esté en el diccionario (M9) — eso lo cubre la lectura humana |

## 5 · Mutantes (10, distintos de los 13 del traductor)

Corridos contra `lib/i18n` y `components/demo/finanzas`; cada uno restaurado con
`git checkout` (`git status` limpio al terminar).

| # | Mutante | Resultado |
|---|---|---|
| M1 | `finanzas.csv.saldo-cierre` italiano = «Closing balance» | **muere** (CSV italiano, barrido de inglés y copias) |
| M2 | quitar `=` de `PELIGROSO` en `estado-cuenta-csv.ts` | **muere** (es, en e italiano) |
| M3 | `reportes.vacio.titulo` = «Sin movimento in questo periodo» (palabra española suelta) | **sobrevive** — límite del barrido por trozos; solo lo ve un lector |
| M4 | `reportes.cuenta.pantalla.otros` con `{m}` en vez de `{n}` | **muere** (cobertura: huecos) |
| M5 | `clientes.captacion.bitacora` italiano vacío | **muere** (cobertura) |
| M6 | quitar la excepción «Pantalla» de `costura.test.ts` | **muere** (costura) |
| M7 | `inicio/page.tsx:297`, `dCapacidad` sin `idioma` | **sobrevive** — el estado de prueba tiene < 1000 espacios digitales, así que la cifra es igual en los dos formatos. Hueco menor de datos de prueba |
| M8 | fechas del CSV italiano con locale `'en'` | **muere** |
| M9 | `clientes.filtro.entre-agencias` = « among the agencies only» (inglés que no está en el diccionario) | **sobrevive** — límite del barrido (busca el inglés del diccionario, no cualquier inglés) |
| M10 | `clientes.captacion.form.que-captas` = el español | **muere** (copias) |

**7 de 10 mueren**; los tres que sobreviven son límites conocidos del método
(no ven un italiano mal escrito ni una cifra que no llega a 1000), no pruebas
que no muerdan lo que dicen.

## 6 · Términos nuevos del traductor

| Término | Juicio |
|---|---|
| OdA / ordine d’acquisto (m.) | ✔ es la sigla de compras en Italia |
| lucchetto | ✔ conserva el icono del candado; en finanzas se diría «blocco di fatturazione», pero la metáfora visual manda |
| creatività (f., inv.) | ✔ el uso del sector («le creatività») |
| grafica | ✔ |
| tipografia | ✔ («in tipografia») |
| prove fotografiche | ✔ convive bien con «foto di verifica» del glosario |
| prospect | ✔ uso comercial corriente |
| registro | ✔ |
| immobile | ✔ para predio; ojo con el artículo (H1) |
| acquisizione | ✔ |
| luce / bolletta | ✔ |
| Configurazione | ✔ |
| schermata | ✔ y bien separado de schermo / impianto |
| Accredito (con Addebito) | ✔ estilo extracto bancario; «Dare/Avere» sería el contable |
| sollecito / Sollecita | ✔ exacto |
| «Finanza» (provisional) | ✔ aceptable para un módulo; lo fija L5 |
| T1 2026 (P2) | ✔ |

## 7 · Lo que no comprobé

- El navegador: no levanté servidores (regla del encargo). El texto de los
  Server Components cuyo idioma fija el simulacro no se ve en el espejo.
- El texto de las 15 claves de H2 con un día 8 u 11 real: lo deduzco del
  formato «1 dic 2026» de la ola 0, no lo rendí.
- Las e2e (no se tocan rutas, sesión, tenant ni dinero).

---
tipo: tablero
estado: en-curso
actualizado: 2026-11-04
tags: [frontend, i18n, italiano, olas, agentes, dinero]
archivos:
  - apps/web/lib/i18n/idiomas.ts
  - apps/web/lib/i18n/formato-idioma.ts
  - apps/web/lib/i18n/diccionario.ts
  - apps/web/lib/i18n/textos/
  - apps/web/lib/i18n/cobertura-italiano.ts
  - apps/web/lib/i18n/errores-servidor.ts
  - apps/web/lib/i18n/guardias-italiano.ts
  - apps/web/lib/i18n/textos/costura.test.ts
  - apps/web/lib/test/volcado-html.ts
  - apps/web/lib/test/espejo-italiano.ts
  - apps/web/lib/i18n/barrido-italiano.ts
  - apps/web/lib/i18n/parte-en-idioma.tsx
  - scripts/i18n-barrido-italiano.mjs
  - docs/i18n/revision-italiano-base.md
  - docs/i18n/revision-italiano-pulido.md
---

# La versión en italiano, ola por ola

Pedido del dueño el **2026-11-03**: «ahora versión en italiano». Esta nota es el
**tablero**: qué está hecho, en qué rama, qué falta y qué decidió el dueño. Cómo
funciona la maquinaria de idiomas —la regla de la cookie, las claves, el dinero,
los errores del servidor— está en [[idiomas-es-en]]; el método de trabajo por
lotes es el del inglés, en [[ingles-olas]]. Aquí no se repiten.

> [!important] Nada de esto está en `main`
> Todo vive en ramas separadas de `main`, como el inglés.
>
> - La rama de integración es **`integra/italiano`**, que sale de
>   `integra/ingles` (`a89bd217`, el inglés completo).
> - Cada lote trabaja en su `feat/italiano-<lote>`, que sale de `integra/italiano`.
> - No se ha empujado nada ni hay PR.

> [!warning] El italiano está APAGADO
> Su interruptor es **`IDIOMA_ITALIANO=1`**, propio y separado del inglés
> (`IDIOMA_INGLES`): encender uno no enciende el otro. Apagado —la omisión—,
> nadie ve italiano aunque su cookie o su navegador lo pidan, y el selector no
> ofrece «Italiano». No se enciende hasta cerrar los lotes y el recorrido en el
> navegador (§4).

## 1 · Cómo se trabaja cada lote

**Mismo rigor que el inglés** (decisión del dueño, 03/11): **traductor +
validador independiente por lote**, y **recorrido en el navegador al final**.

- El validador es otra sesión y recibe el código, no el razonamiento.
- **Español e inglés idénticos, medido:** el volcado completo
  (`I18N_VOLCAR_TODO=<carpeta>`, `lib/test/volcado-html.ts`) antes y después y
  `diff -rq` = 0; `DICCIONARIOS.es` y `.en` con 0 valores cambiados.
- **El italiano, mirado:** `I18N_VOLCAR_IT=<carpeta>` rinde en italiano cada
  estado que las pruebas de pantallas construyen en inglés y lo pasa por la
  guardia de formatos (`guardias-italiano.ts`); los hallazgos van a
  `<carpeta>/_guardias.jsonl`.
- **La cobertura, contada:** `cobertura-italiano.test.ts` imprime la tabla de §3
  (`npx vitest run lib/i18n/cobertura-italiano.test.ts --reporter=verbose`).
- Cada lote rellena **solo** su `IT_<AMBITO>` en `lib/i18n/textos/<ambito>.ts`.
  Al terminar, cambia su tipo de `Partial<Record<…>>` a `Record<…>`: desde ese
  momento `tsc` exige cada clave, como en el inglés.
- Deja `docs/i18n/revision-italiano-<lote>.md` y `docs/i18n/validacion-italiano-<lote>.md`.

### Mientras falta una clave, se pinta en INGLÉS

`DICCIONARIOS.it = conCaidaAlIngles(EN, IT)` (`diccionario.ts`): el inglés está
completo y es más legible para un italiano que el español. La caída vive en ese
único sitio; `traducir()` no sabe nada del italiano. Lo mismo para los errores
del servidor (`CATALOGO_ERRORES_IT` y compañía): un mensaje sale entero en
italiano o entero en inglés, nunca a medias.

## 2 · Las olas

### Ola 0 · La infraestructura

| Tarea | Rama | Veredicto | Notas |
|---|---|---|---|
| `it` como tercer idioma, formatos, catálogos, guardias, cobertura | `feat/italiano-base` | **Hecha, sin validar** | Sin traducir la interfaz. Detalle en `docs/i18n/revision-italiano-base.md` |

### Ola 1 · Los lotes de traducción (propuesta)

Partición en **5 lotes que no se pisan**: cada uno toca **solo sus archivos**
de `textos/` (y el L5, además, `diccionario.ts` y `errores-servidor.ts`).
Recuentos medidos el 03/11 con `coberturaItaliano()`.

| Lote | Ámbitos | Claves |
|---|---|---:|
| **L1 · Space Eyes y luz** | `spaceeyes` 1001 · `energia` 121 | **1122** |
| **L2 · Comercial y propuestas** | `comercial` 501 · `codigos` 59 · `propuestas` 437 · `catalogos` 194 | **1191** |
| **L3 · Inventario, arrendadores y operaciones** | `inventario` 360 · `arrendadores` 444 · `operaciones` 177 · `operaciones2` 205 | **1186** |
| **L4 · Campañas, finanzas, clientes, reportes y Dashboard** | `campanas` 396 · `finanzas` 170 · `clientes` 220 · `reportes` 148 · `inicio` 148 | **1082** |
| **L5 · Armazón, cuenta, administración y servidor** | base de `diccionario.ts` 108 · `shell` 58 · `cuenta` 115 · `admin` 542 · `compartidos` 109 · `notificaciones` 40 · `servidor` 32 · errores del servidor 305 (catálogo 201, campos 30, firma 12, patrones 62) | **1309** |
| | **Total pendiente** | **5890** |

Después, una **costura** (como la del inglés) con `costura.test.ts`, que ya
compara el italiano entre lotes, y el **recorrido en el navegador**.

> [!tip] El glosario se fija ANTES de repartir
> `compartidos` (L5) lo usan todas las pantallas y fija palabras de todos los
> lotes (periodos, catorcena, millar). Conviene que L5 entregue primero el
> glosario común —§3— y que los otros cuatro lo reciban en su encargo.

## 3 · Decisiones del dueño y pendientes

| # | Asunto | Estado |
|---|---|---|
| D1 | **Pesos en italiano: «MX$ 1.160,00»** —símbolo delante como en inglés, con espacio, separadores italianos— | **Decidido** (03/11). Vive en `FORMATO_IDIOMA.it` (`formato-idioma.ts`) |
| D2 | **Glosario: los anglicismos del sector se quedan en inglés** — spot, loop, DOOH… («codice di negoziazione», «loop/h») | **Decidido** (03/11). Para todos los lotes |
| D3 | Traductor + validador por lote y recorrido en navegador al final | **Decidido** (03/11) |
| D4 | Fechas «1 dic 2026», cifras «1.160,5», porcentaje «55,0%» | Propuesto en la ola 0, sin objeción. En `FORMATO_IDIOMA.it` |
| P1 | **Dólar de una instancia USD en italiano** — provisional «US$ 1.160,00» | **Pendiente del dueño** |
| P2 | Letra del trimestre en reportes — provisional «T1 2026» | Pendiente; lo confirma L4 |
| P3 | Comillas italianas: « » o “ ” | Pendiente; lo fija L5 en el glosario. El apóstrofo es el tipográfico (’), ya vigilado |
| P4 | **Idioma de la instancia para los contratos** (texto legal, cantidad con letra, constancia) en el idioma elegido al crear la instancia, como la moneda del ADR 0048 | **Hecho** en `feat/idioma-instancia` ([ADR 0049](../../docs/adr/0049-el-idioma-de-los-documentos-es-de-la-instancia.md)): `tenants.idioma_documentos`, `--idioma es\|en\|it`, contrato y constancia en italiano («IL LOCATORE / IL CONDUTTORE», «MILLEDUECENTOTRENTAQUATTRO PESOS 50/100 MXN»). **Revisión legal pendiente.** Ver [[idiomas-es-en]] §12. **Segunda vuelta (03/11):** también la propuesta impresa, `/p`, el portal, el comprobante y los correos (no el CSV del estado de cuenta). Sus claves italianas (L2 y siguientes) caían al inglés hasta integrarse: **cerrado al integrar (04/11, B67)**, ver §8 |

> [!note] El idioma de la interfaz NO se guardaba en la base — desde el 03/11, SÍ (por persona)
> Hasta la ola 0 era solo por dispositivo, en la cookie `spaces_idioma`
> (decisión del 30/09), y la ola 0 no necesitó migración. **El 03/11 el dueño
> lo amplió**: «el idioma de lo demás se debe poder configurar por usuario y
> navegador». Rama `feat/idioma-por-usuario` (IDIOMA-USUARIO): columna
> `usuarios.idioma_preferido` con CHECK `es`/`en`/`it` (ya incluye el italiano),
> «Mi cuenta → Idioma» y la precedencia `cuenta > cookie > navegador > español`.
> Ver [[03-Frontend/idiomas-es-en]] §1 y §4.
>
> **Cobertura:** las cinco claves nuevas (`idioma.cuenta.*`) van en `IT_BASE`
> y cuentan como traducidas en `coberturaItaliano()`. **Revisadas al integrar
> (04/11, §9)** con las reglas de L5, sin cambios de texto; les falta la pasada de
> un validador independiente, como la que tuvo cada lote (B65).

## 4 · Antes de encender `IDIOMA_ITALIANO`

- [ ] Los cinco lotes en **VERDE**, con su tipo `IT_<AMBITO>` ya en `Record` completo
- [ ] `coberturaItaliano()` con **0 pendientes** en todas las filas
- [ ] El espejo (`I18N_VOLCAR_IT`) sin hallazgos de formato (hoy 358, §5)
- [ ] La costura del italiano en verde
- [ ] El recorrido en el navegador, pantalla por pantalla — **hecho el 04/11
  (§10), pendiente de su validador**

## 5 · Lo que la ola 0 deja medido para los lotes

El espejo italiano sobre las pruebas de pantallas (2108 estados) da hoy **358
huellas de formato** en cinco archivos. Casi todas son de dos clases y ninguna es
de la maquinaria: **textos de ejemplo del diccionario** (que caen al inglés, «E.g.
12.9») y **Server Components** cuyo idioma lo fija el simulacro de la prueba
(`servidor.idioma`), que el espejo no puede cambiar. La lista por archivo está en
`docs/i18n/revision-italiano-base.md` §5: es el punto de partida de cada lote.

### Lote L3 · Inventario, arrendadores y operaciones

**Rama `feat/italiano-l3-inventario`** (sale de `integra/idiomas`, `6fea374a`).
**Validación ÁMBAR corregida, pendiente de revalidar** (`docs/i18n/validacion-italiano-l3.md`). Revisión clave por clave en
`docs/i18n/revision-italiano-l3.md`.

- **Cobertura:** `operaciones` 177/177, `operaciones2` 205/205, `inventario`
  360/360, `arrendadores` 431/444. Los **13 que faltan son la constancia de
  firmas** (`arrendadores.constancia.*`): van en el idioma de la instancia, tarea
  roja aparte (P4). El tipo lo decía:
  `Record<Exclude<ClaveArrendadores, 'arrendadores.constancia.…'>, string>`; los
  otros tres pasan a `Record` completo. **Desde el 04/11 (B67, §8) `arrendadores`
  también es `Record` completo, 444/444.** La lista por omisión de una OT
  (`checklist-ot.ts`) sale de `operaciones2` y ya pinta italiano.
- **Glosario propio** (además del común):

  | Español | Italiano | Por qué |
  |---|---|---|
  | pantalla (de inventario, en general) | **impianto** (masc.: «libero», «occupato», «{n} selezionati») | glosario común; una pantalla del inventario puede ser un espectacular |
  | pantalla digital | schermo digitale | glosario común |
  | artículo del almacén de tipo «Pantalla» | **schermo** | es un aparato; declarado en `costura.test.ts` (`DISTINTOS_A_PROPOSITO_IT`) |
  | predio | immobile | |
  | renta (al arrendador) | canone | |
  | arrendataria (nuestra empresa) | conduttrice | término legal italiano frente a «locatore» |
  | propia | di proprietà | |
  | alta manual / carga masiva / plantilla | inserimento manuale / caricamento massivo / modello | |
  | almacén · bodega · traslado | magazzino · deposito · trasferimento | |
  | dar de baja (almacén, definitiva) / (arrendador) | dismettere / disattivare | como el inglés (Decommission / Deactivate) |
  | imprenta (módulo) · proveedor | Stampa · tipografia | |
  | orden de impresión · prueba de color · montaje · arte | ordine di stampa · prova colore · montaggio · grafica | |
  | OT | **OdL** (ordine di lavoro, masc.: «Nuovo OdL», «OdL in ritardo») | glosario común |
  | cuadrilla · fecha compromiso · vencida (OT) · por vencer | squadra · data di scadenza · in ritardo · in scadenza | |
  | candado de facturación | blocco fatturazione («tengono bloccata la fatturazione»; abierto → «Fatturazione sbloccata») | validación H6 |
  | evidencia · sello de ubicación · costo real · estimación | prova · timbro di posizione · costo effettivo · stima | |
  | creativo | **creatività** (fem., invariable: «1 creatività», «3 creatività») | uso del sector |
  | emplazamiento · cuadre · incidencia | postazione · riconciliazione · **anomalia** | incidencia → anomalia en todo el italiano (orquestador, alineado con L4) |
  | P&L | conto economico | |
  | licencia vigente / contrato vigente | valida / in vigore | |

- **Regla para TODO el italiano (orquestador, validación H1): nunca artículo delante de una fecha.** «il 8» y «al 11» son errores (sería «l’8», «all’11»). Se escribe «in data {fecha}», «fino al giorno {fin}» o «Etichetta: {fecha}»; los rangos, con guion.
- **Días abreviados:** «gg» («tra 29 gg»). **Periodicidades** como adjetivo junto a un sustantivo («rate quindicinali / bimestrali / semestrali»): este lote no escribe ninguna; las pone L5 por hueco.
- **Prueba estática del diccionario** (`lib/i18n/textos/italiano-l3.test.ts`): ninguna clave igual al inglés ni al español salvo cognados declarados, y ningún `.uno` igual a su `.otros` salvo invariables declarados.
- **Arreglos de formato que solo se veían en italiano** (es/en idénticos):
  `NuevaPantallaForm.tsx` pintaba la renta con `'es-MX'` fijo («45,000») y
  `OTVista.tsx` pegaba el símbolo a la cifra («MX$1.500»; el italiano lleva
  espacio, D1). El espejo de la ola 0 no los veía: son estados FORZADOS que el
  espejo no reproduce; las pruebas del lote rinden cada estado en `it`.
- **Las 24 huellas de partida** de `pantallas-inventario-arrendadores` eran el
  navegador del firmante («Mozilla/5.0», un dato) y el documento del contrato
  (español por decisión del dueño, P4). Las pruebas del lote los apartan con el
  porqué y dan **0** en lo demás.
- **Pendiente para el dueño (nuevo):** el campo de cifra (`captura-cifra.ts`,
  compartido) lee la coma como millar y el punto como decimal en todos los
  idiomas, así que los ejemplos de captura en italiano siguen diciendo «65.50» y
  «212,500.50». Cambiar la convención de CAPTURA en italiano es una decisión
  aparte (y toca dinero).

### Lote L1 · Space Eyes y luz

**2026-11-03, rama `feat/italiano-l1-spaceeyes`** (sale de `integra/idiomas`,
`6fea374a`). **Validado ÁMBAR y corregido** (segunda vuelta, 03/11):
`docs/i18n/validacion-italiano-l1.md` · revisión: `docs/i18n/revision-italiano-l1.md`.

- **`IT_SPACEEYES` 1001 e `IT_ENERGIA` 121, completos**: el tipo pasa a
  `Record` y `tsc` exige cada clave. Cubre también `lib/i18n/donde-falla.ts`
  (dónde falló y los 8 nombres de falla del teléfono), que usa claves
  `spaceeyes.fallas.*`. Cobertura: 0 pendientes en las dos filas.
- **Las cifras del módulo, en italiano.** Las 87 huellas del espejo («1.2»,
  «0.00» de *Regola il testo*) y otras que ninguna prueba rendía en italiano
  («3.10 GB», «63.3 GB», «1,200», «8,000 µs») salían de `toFixed` y
  `formatNumero` sin idioma. Nuevos `fijo()` y `cifra()` en `piezas.tsx`: en es
  y en, `toFixed`/`String` tal cual; en it, coma decimal y punto de millar.
  Espejo de Space Eyes y energía: **0** huellas (el total baja de 358 a 271).
- **Un hallazgo de la ola 0 para quien lleve `dinero.ts`:** `formatearDinero`
  con **solo** `maximumFractionDigits` da «MX$ 3.400,5» y «MX$ 50» en italiano
  (`dineroSimboloDelante` no pone el mínimo de la moneda, que en es/en pone el
  estilo `currency`). Aquí se arregló en el llamador (`energia/captura.ts`, los
  dos límites); `dinero.ts` no se tocó.
- **Otro, de la guardia:** «0,812» (un SSIM italiano) cae en «cifra con coma de
  millar». La prueba de Space Eyes lo permite con `/^0,\d{3}$/`; la guardia
  podría excluir los millares que empiezan por «0,».

**Glosario del lote** (decisión del traductor; el dueño puede cambiarla):

| Español | Italiano |
|---|---|
| equipo / dispositivo | dispositivo |
| falla (abierta / recuperada / descartada) | guasto (aperto / risolto / scartato) |
| vista en vivo | vista in diretta |
| verificación | verifica |
| solicitud de activación | richiesta di attivazione |
| flota | parco dispositivi |
| gabinete | cabinet (invariable, como en el sector LED) |
| creativo / creatividad | creatività (femenino, invariable) |
| encuadre | inquadratura |
| vigilancia | monitoraggio |
| código de vinculación | codice di abbinamento |
| marca de la foto | sovrimpressione |
| captura | scatto |
| lente / cámara | obiettivo / fotocamera (telecamera IP en la PC) |
| pantalla | **schermo** la LED que mira el equipo; **impianto** la del inventario (asignada, asociada, su galería) |
| el padre | server padre |
| folio de un ticket | ticket |
| Administración › Configuración › Soporte | Impostazioni › Impostazioni aziendali › Supporto (como el inglés; **lo fija L5**) |
| «pide un toque» | serve una conferma sul telefono (en la web, siempre «Clicca») |
| recibo de luz · predio · medidor | bolletta (della luce) · **immobile** · contatore |
| punto de medición · pantalla suelta | punto di prelievo (POD) · impianto isolato |
| prueba de exhibición | Prova di messa in onda |
| capturar · hueco · tanda · renglón | registrare · buco / dato mancante · lotto · riga |
| alumbrado público · adeudos | illuminazione pubblica · arretrati |
| recibo bimestral | bolletta emessa ogni due mesi |
| reporte de rentabilidad | report di redditività |

> [!important] Regla para TODO el italiano: fechas SIN artículo delante
> Decisión del orquestador (03/11, validación de L1). «il 8 dic», «al 11 ott»,
> «del 8 dic» piden elisión («l’8», «all’11») y no la llevan, porque la fecha
> es un hueco. Se escribe sin artículo: «Inizio: {fecha}», «Scaduta: {fecha}»,
> «Non scatta prima di: {fecha}», «Valido fino a: {fecha}», «Scatto: {fecha}».
> L1 lo vigila en su diccionario (`textos/spaceeyes.test.ts`).

**Se queda igual, a propósito:** «Vincular» (botón de la app Android, solo en
español), la marca grabada en la foto (es-MX: es la evidencia; una prueba lo
fija también en italiano), el ticket de activación, el veredicto de la foto
(`comercial.eye.*`, es de L2).

### Lote L4 · Campañas, finanzas, clientes, reportes y Dashboard

Rama `feat/italiano-l4-campanas` (sobre `integra/idiomas`, `6fea374a`).
**Validación ÁMBAR, corregida** (`docs/i18n/validacion-italiano-l4.md`; correcciones en la revisión, §5). 1082 claves (`campanas` 396 · `finanzas` 170 ·
`clientes` 220 · `reportes` 148 · `inicio` 148), los cinco `IT_*` ya en
`Record` completo. Español e inglés idénticos (3020 HTML, `diff -rq` = 0); el
espejo pierde las 32 huellas del Dashboard (358 → 326). Detalle, pruebas y
mutantes (13/13 y 14/14 tras la validación) en `docs/i18n/revision-italiano-l4.md`.

Términos que el glosario no traía y fijó este lote: OC = **OdA** («ordine
d’acquisto», masc.) · candado = **blocco fatturazione** / «fatturazione sbloccata» (alineado con L3) · incidencia = **anomalia** (no «incidente») · creativo = **creatività**
(fem., invariable) · arte = **grafica** · imprenta = **tipografia** ·
evidencias = **prove fotografiche** · prospecto = **prospect** · bitácora =
**registro** · predio = **immobile** · captación = **acquisizione** · luz /
recibo = **luce / bolletta** · Configuración = **Configurazione** · pantalla de
la aplicación = **schermata** · Abono = **Accredito** · recordatorio de cobro
= **sollecito**. Finanzas (módulo) = «Finanza» provisional: **lo fija L5** con
el menú. **P2:** se confirma «T1 2026».

Costura: «Vencida» (Scaduta/Scaduto) y «Pantalla» (Schermo/Impianto) quedan
declaradas distintas a propósito en `costura.test.ts`.

> [!important] Regla para TODO el italiano: nunca un artículo delante de una fecha
> La fecha llega formateada («8 dic 2026», «11 nov 2026») y el artículo tendría
> que elidirse («l’8», «dall’11»), cosa que un hueco no puede hacer. Se escribe
> «in data {fecha}», «fino al giorno {fin}», «al giorno {fecha}», «{desde} –
> {hasta}» o «Etiqueta: {fecha}». Además, en este lote: DOOHmain siempre con
> «su» (salvo «Chiedi a DOOHmain»), cuotas en adjetivo («rate quindicinali /
> bimestrali / semestrali»). Lo vigila `reglasDelItaliano`
> (`lib/test/barrido-italiano-l4.ts`).

El CSV del estado de cuenta, **solo en italiano**, sale con «;» y coma decimal
(lo que abre una Excel italiana); español e inglés como siempre.

> [!warning] Pendiente para el dueño (dinero, ROJO)
> El campo de cifra lee **es-MX en todos los idiomas** (`lib/captura-cifra.ts`):
> un italiano que teclee «212.500,50» ve el rechazo. El aviso lo dice con verdad
> («la virgola separa le migliaia…»), pero leer el formato italiano es otra
> tarea, de `compartidos` y de dinero.

### Lote L2 · Comercial y propuestas

Rama `feat/italiano-l2-comercial` (sobre `integra/idiomas`, `6fea374a`) ·
**traducido, sin validar** · detalle en `docs/i18n/revision-italiano-l2-comercial.md`.
`comercial` 502, `codigos` 59, `propuestas` 439, `catalogos` 194: **0 pendientes**,
los cuatro `IT_*` ya son `Record`. Español e inglés: 0 HTML distintos, 0 valores
cambiados (3 claves nuevas, literales de «spots/slots» que el italiano no
pluraliza). Espejo del lote: de 215 huellas a 24, todas intencionadas.

Glosario que este lote fija (los demás lotes, si dicen lo mismo, igual):
pantalla de inventario → **impianto** (la digital, **schermo**) · predio →
**terreno** · renta → **canone** · OC → **OdA** · se compone → **si applica a
cascata** · el medio → **la concessionaria** · prima → **maggiorazione** ·
contratación → **acquisto** · gerente → **manager** · horario de transmisión →
**palinsesto** · rejilla → **griglia tariffaria** · tramo / escalón →
**scaglione / gradino** · precio cerrado → **prezzo fisso** · liga → **link** ·
correo → **Email** · Programático → **Programmatic** · vigente → **Attivo** ·
vencido → **Scaduto** (pago: **In ritardo**) · Próximo (código) → **In arrivo** ·
Vista (orientación) → **Orientamento** · Lista (vista) → **Elenco** (precio de
lista: **Listino**) · Eliminar → **Elimina**, Quitar → **Rimuovi**, Añadir /
Agregar → **Aggiungi**, Guardar → **Salva**, «No se pudo …» → **Impossibile …**.

> [!warning] P-L2-1 · La captura de cifras no es italiana (para el dueño)
> `CampoCifra` (`lib/captura-cifra.ts`) lee la coma como miles y el punto como
> decimal en todos los idiomas, y el alta de pantalla usa `Number()`. Un
> italiano que teclee «1.500,50» obtiene otra cifra. Los ejemplos del lote
> describen el formato que el campo ENTIENDE («Es. 12.9»). Decidirlo antes de
> encender el italiano. P-L2-2: el documento imprimible y `/p/[token]` se
> tradujeron sin cambiar su regla de idioma (la de la petición); si van en el
> idioma de la instancia, como el contrato, es P4.

## 6 · Glosario por lote

### Lote L5 · Armazón, cuenta, administración, compartidos y servidor

Rama `feat/italiano-l5-armazon` (sobre `integra/idiomas`, `6fea374a`). **Hecho,
sin validar.** Revisión: `docs/i18n/revision-italiano-l5.md`.

- **1309 claves nuevas, 0 pendientes:** base 113 (5 ya estaban), `compartidos` 109, `shell` 58,
  `cuenta` 115, `admin` 542, `notificaciones` 40, `servidor` 32, errores del
  servidor 305 (catálogo 201, campos 30, firma 12, patrones 62). Los `IT_*` de
  `textos/` del lote, ya `Record`.
- **El glosario común (`compartidos`) que copian los demás lotes:** unidades
  *Mensile · Ogni due settimane · Settimanale · Giornaliera · CPS · costo per
  passaggio · All’ora · CPM · costo per migliaio di impression*; contadores
  *mese/mesi · periodo/periodi di due settimane · settimana/e · giorno/i ·
  passaggio/i · ora/e · migliaio/migliaia*; periodicidades en letra
  *Giornaliera · Settimanale · Ogni due settimane · Due volte al mese · Mensile ·
  Ogni due mesi · Trimestrale · Ogni sei mesi · Annuale*; periodo *Questo mese ·
  Mese scorso · Questo trimestre · Trimestre scorso · Quest’anno · Intervallo
  personalizzato*, trimestre *T1 2026*, rango *{desde} – {hasta}*, *Dal / Al*;
  días *dom lun mar mer gio ven sab*; *slot del loop* (invariable),
  *maggiorazione* (prima del Roadblock), *Non assegnata*, *disattivata*.
- **Términos nuevos:** *immobile* (predio) · *impianto* para la pantalla de
  inventario genérico (mapa, propuesta pública, Network, cupo) y *schermo* para
  la digital (calculadora, loop, DOOHmain, franja) · *password*, *email* ·
  *Impostazioni dell’account* / *Impostazioni dell’attività* (las dos
  «Configuración») · *Tipografia* (rol) frente a *Stampa* (módulo) · *Team* ·
  *Passa a* (entrar a otra organización) · *Responsabile vendite*, *Direttore
  commerciale* · *Acquisizione siti* (Captación) · *Consumo elettrico* ·
  *Provvigioni* · *tetto di sconto* · *Assistenza* · *Vedi* · *Salvataggio…* ·
  papeles *AFFITTI · BENI · LICENZE · OPERATIVITÀ · VENDITE*.
- **P3 cerrada por este lote:** comillas *caporali* « ».
- **Infraestructura:** cerrados V5, V6 y V9 del validador de la ola 0, y la
  omisión de `permitidos` ya no deja pasar un italiano apagado
  (`idiomasPorOmision()`, el único cambio en `idiomas.ts`). Barrido común para
  las pantallas italianas: `lib/test/barrido-italiano.ts`.
- **Para el dueño:** `CampoCifra` lee las cifras a la mexicana también en
  italiano (sus mensajes lo dicen); teclear a la italiana sería otra tarea.

## 7 · Costura final (2026-11-04)

Con los cinco lotes juntos en `integra/idiomas` (`9c593b82`), `costura.test.ts`
encontró **30 textos españoles con dos italianos** según el lote y **4 frases
que también manda el servidor** dichas distinto en el campo y en el error; y
`pantallas-energia` veía «>Periodo<» como español (es la misma palabra en
italiano: va a `COMUNES_IT`). Se **unifican 24** y se **declaran distintos a
propósito 6**, con el porqué en `DISTINTOS_A_PROPOSITO_IT`. Español e inglés,
idénticos a `9c593b82` (5594 claves cada uno, comparadas por script); 34 claves
italianas y 4 mensajes del catálogo italiano del servidor cambian.

| Español | Antes | Decidido |
|---|---|---|
| Enviando… / Generando… / Verificando… | «Invio in corso…» (login), «Generazione / Verifica in corso…» (cuenta) frente a la forma corta | **Unificado**: «Invio…», «Generazione…», «Verifica…» (como «Salvataggio…» de L5) |
| Captación | Acquisizione (título de la página) | **Acquisizione siti**, como el menú |
| Comisiones | Commissioni (título de la página) | **Provvigioni**, como el menú. El cuerpo sigue diciendo «commissione d’agenzia», término de propuestas y reportes |
| Hasta | «A» en el selector de periodo | **Fino a** (par «Da / Fino a»; sustituye el «Dal / Al» del glosario de L5) |
| {desde} a {hasta} | «{desde}–{hasta}» en el horario de DOOHmain | **{desde} – {hasta}**, con espacios, como el resto |
| a | «–» entre fechas / «alle» entre horas | **Distinto a propósito**: «al» sería artículo ante fecha; entre horas, «dalle … alle» |
| Sin asignar | Non assegnata / Non assegnato | **Distinto a propósito** (concordancia): razón social, fem. (y la fila del reporte por razón social pasa a «Non assegnata»); responsable de OT o creativo, masc. |
| No se pudo leer el archivo · No se pudo guardar · No se pudo dar de baja | «Non è stato possibile …» en admin | **Impossibile leggere il file / salvare / disattivare** (glosario de L2) |
| En proceso | In lavorazione (tickets) | **In corso** |
| Limpiar filtros | Azzera i filtri (admin) | **Cancella i filtri** |
| Limpiar | Azzera (actividad) / Deseleziona (inventario) | **Azzera** en los dos: Arrendadores reusa la clave del inventario para quitar filtros, donde «Deseleziona» mentía; «Cancella» suelto, en la barra de acciones masivas, se leería «borrar» |
| evidencia (alt de una foto) | foto di verifica (shell) | **prova** (glosario de L3) |
| otra franja | altra fascia oraria (campañas) / un’altra fascia oraria (servidor) | **un’altra fascia oraria** en los dos |
| Abono registrado | Acconto registrato (finanzas) | **Pagamento parziale registrato**, como la notificación: un abono es un pago parcial, no un anticipo |
| Programático | Programmatico (admin) | **Programmatic** (anglicismo del sector) |
| En Network | Nella Network | **Nel Network**, y «il Network» en las 8 claves de la Network de Administración |
| Automática | Automatico / Automatica | **Distinto a propósito**: «rinnovo» masc. / «modalità» fem. |
| Guardar cambios | Salva le modifiche (admin) | **Salva modifiche** |
| Sin límite | Nessun limite (admin) | **Senza limite** |
| {n} de {total} | {n} su {total} (admin) | **{n} di {total}** |
| Operación | Operatività (familia de configuración) | **Operazioni** |
| Calle, número, colonia, CP, ciudad, estado | dos ejemplos de domicilio | **Via, numero civico, quartiere, CAP, città, provincia** en los dos |
| Nuevo · {n} nueva · {n} nuevas | Novità / Nuovo, novità / nuovo(i) | **Distinto a propósito**: tipo de las notas de versión («Novità», invariable) frente a un locatore o unos impianti nuevos |
| {libres} de {total} libres | Liberi: {libres} su {total} (shell) | **{libres} di {total} liberi** |
| Solo un gerente o superior… (servidor y campo) | «manager o superiore» en el servidor | **manager o un ruolo superiore** en los tres mensajes del servidor |
| Teléfono inválido… | Scrivi (servidor) / Inserisci (campo) | **Inserisci** |
| El reporte abarca como máximo 24 meses… | Accorcia (campo) / Riduci (servidor) | **Riduci l’intervallo di date** |

**Guardia nueva:** `costura.test.ts` prohíbe un artículo delante de una fecha
(`il|al|dal|del|nel|sul|l’|all’|dall’|dell’` + `{fecha|fin|desde|inicio|hasta|vence}`)
sobre **todo** `IT_PARCIAL`, con su prueba de que muerde. El barrido dio 0.

## 8 · Integración con el idioma de la instancia · B67 cerrado (2026-11-04)

`feat/idioma-instancia` (ADR 0049) fusionada en `integra/idiomas`. La rama traía
los papeles en el idioma de la instancia, pero el italiano de sus claves nuevas
caía al inglés: una instancia `it` mandaba el contrato en italiano y la
propuesta, `/p`, el portal, el comprobante y los correos en inglés (B67).

- **Claves italianas añadidas:** 6 `propuestas.correo.*`, 5
  `cuenta.correo.invitacion.*`, 7 `notificaciones.correo.*` y 3 mensajes del
  catálogo de errores del servidor (el idioma de los documentos al dar de alta).
  Registro «tu», sin artículo ante fecha («fino al giorno {fecha}»), «Rif.
  interno {folio}», «impianti», «link».
- **La constancia de firmas** (13 claves) ya venía traducida en la rama («IL
  LOCATORE / IL CONDUTTORE», como el contrato). Entra al final de
  `IT_ARRENDADORES`, que deja de excluirla y pasa a `Record<ClaveArrendadores,
  string>`. Una corrección: «sigillato il {fecha}» → «sigillato **in data**
  {fecha}» (la guardia de `costura.test.ts` la habría tumbado). «Browser:
  {navegador}» queda declarado cognado en `italiano-l3.test.ts`.
- **Cobertura:** 5920/5920, 0 pendientes en los 26 ámbitos.
- **Español e inglés:** `DICCIONARIOS.es/.en` son exactamente la unión de los
  dos padres (5612 claves cada uno, comparadas por script); la única clave
  distinta entre padres es `arrendadores.constancia.parte.arrendador` en
  inglés, y gana «THE LESSOR» de la rama (D15).
- **Pruebas nuevas:** el documento imprimible con instancia italiana y persona
  en español (papel en italiano, barra en español) y el texto italiano de los
  tres correos (`correos-idioma.test.ts`).
- **Una e2e que lo daba por pendiente:** `bootstrap.e2e.test.ts` esperaba la
  propuesta de una instancia `it` en INGLÉS («hasta que el lote L2 llegue») y
  cayó en rojo al integrar; ahora exige «PROPOSTA COMMERCIALE» y que no salga
  ni español ni inglés.
- **Medido sobre el árbol fusionado:** typecheck limpio; unitarias **8306/8306**
  (395 archivos); build; e2e con `spaces_idiomas_e2e` y puertos 3351/3352:
  **1206 en verde, 1 en rojo, 21 omitidas** — el rojo es `grants-rol-app`
  (`ECONNREFUSED :55471`, el Postgres efímero que esta máquina no levanta).

## 9 · Integración con el idioma por persona · B61, B63 y B64 cerrados (2026-11-04)

`feat/idioma-por-usuario` (IDIOMA-USUARIO, supervisor ÁMBAR) fusionada en
`integra/idiomas` (merge `afa2e490`): la preferencia de idioma de la interfaz en
la cuenta, «Mi cuenta → Idioma» y la precedencia `cuenta > cookie > navegador >
español`, filtrada por los idiomas encendidos (`idiomasPorOmision()` de L5).

- **Conflictos:** `diccionario.ts` (las claves de L5 y las 5 `idioma.cuenta.*`,
  juntas en `IT_BASE`) y `cobertura-italiano.test.ts` (la de L5, que no fija el
  número de traducidas); el resto, notas. `idiomas.ts` se fusionó solo.
- **Italiano:** las 5 `idioma.cuenta.*` revisadas con las reglas de L5 —registro
  «tu» («vedi», «accedi»), ’ tipográfico, «No se pudo …» = **Impossibile …**,
  «Lingua salvata» como «Configurazione salvata»— sin cambios. Error nuevo
  traducido: «Questa lingua non è disponibile su questo server.».
  **Cobertura: 5926/5926, 0 pendientes**; costura en verde. Falta la pasada de
  un validador independiente (B65).
- **B64:** al cerrar sesión, carga completa de la pantalla de entrar
  (`components/demo/shell/salir.ts`); ver [[idiomas-es-en]].
- **Español e inglés:** `DICCIONARIOS.es/.en` = unión exacta de los dos padres
  (5617 claves cada uno, 0 valores cambiados). Volcado completo
  (`I18N_VOLCAR_TODO`) contra `1d6c92ed`: difieren solo los 12 estados de
  `/configuracion` (2 es, 8 en, 2 it), por la tarjeta añadida y nada más.
- **Medido sobre el árbol fusionado:** typecheck limpio; unitarias **8353/8353**
  (400 archivos); build; e2e con `spaces_idiomas_e2e` y puertos 3351/3352:
  **1220 en verde, 1 en rojo, 21 omitidas** — el rojo es `grants-rol-app`
  (entorno). `aislamiento.e2e` e `idioma-por-usuario.e2e` (14) en verde, y el
  mutante «guardar con `qRaw`» muere con build delante.

## 10 · Recorrido en el navegador (2026-11-04)

Rama `feat/italiano-recorrido` (sale de `integra/idiomas`, `caef69f8`), **sin
validar**. Detalle pantalla por pantalla en
`docs/i18n/revision-italiano-recorrido.md`.

- **Cómo:** dos instancias propias en el 5433 —`spaces_demo_it` (documentos
  `it`) y `spaces_demo_es`— con las semillas de la demo y la del catálogo
  (`--ancla=2026-10-31`). Las semillas insertan la organización en `es` y el
  trigger de unicidad del idioma las rechaza aunque lleven `on conflict`: en la
  base `it` se apagó ese trigger solo mientras corrían. Se recorrieron
  `next start` con los dos idiomas encendidos, las 40 rutas del menú, 22
  diálogos (vacíos, con sus errores), las fichas, la campanita, «Mi cuenta →
  Idioma» (B64 comprobado) y Space Eyes con el doble del *scratchpad*. Cada
  pantalla se cotejó por script con 8514 trozos del español y del inglés que
  ningún texto italiano contiene.
- **Los papeles siguen a la instancia:** en la instancia `it`, la propuesta
  imprimible, `/p`, el portal, el contrato, la firma pública, la constancia
  (firmada de verdad) y el comprobante salen en italiano aunque la interfaz esté
  en español. En la instancia `es` salen en español aunque esté en italiano.
- **Ocho arreglos** (commit `b2de0501`, prueba `lib/i18n/recorrido-italiano.test.ts`,
  15/15 mutantes):
  - la paginación («Anterior / Siguiente / de / pagos»);
  - «Cargando…» y «Procesando…», que iban escritos a mano;
  - los papeles de razón social con acento (la base los guarda con acentos
    desde `20260921_corrige_acentos…` y el diccionario no);
  - los tres nombres cortos de falla que manda el backend de Space Eye;
  - el aviso de recuperar contraseña que manda el servidor;
  - el importe de la revisión previa a firma, «6.000,00 MXN» como el contrato
    italiano;
  - «acconto» → «pagamento parziale».
- **Español e inglés idénticos**: todo va por `idioma === 'it'`. El volcado
  completo da 10 estados distintos, todos italianos, y `DICCIONARIOS.es/.en`
  tienen 0 valores cambiados (4 claves nuevas, `compartidos.paginacion.*`).
- **El inglés tiene los seis primeros defectos** y se dejaron así por la regla.
  Arreglarlo es quitar la condición: las claves ya están. **Decisión del dueño.**
- **Para el abogado:** el contrato italiano dice «a l’installazione» (debe ser
  «all’installazione»), usa el apóstrofo recto y escribiría «dal 1 / dal 8 /
  dal 11» sin elidir. No hay ningún contrato italiano firmado.
- **Sin desbordes** a 390 px en las 30 pantallas del menú.
- **Versión local para el dueño:** `http://localhost:3600/spaces-dooh` (instancia
  `it`) y `:3601` (instancia `es`), con los tres idiomas. Usuarios y contraseña,
  en la revisión (§9).

- **Segunda vuelta, decisiones del orquestador (04/11):**
  - **el inglés** usa también sus claves en los seis primeros arreglos
    (`e2f79aa2`). El español sigue igual;
  - **el contrato italiano** lleva el apóstrofo tipográfico, «all’installazione»
    y fechas sin preposición articulada («a decorrere dal giorno … e fino al
    giorno …», «in data …»; `aedef548`). Los 14 hashes españoles siguen en
    verde y **D13 (abogado) sigue abierta**;
  - **la fecha del comprobante en español** sale como dd/mm/aaaa: es el único
    cambio del español, en 7 estados de una línea cada uno;
  - **lo demás**, en `docs/Supervision/ABIERTOS.md` como **B69–B74**.

  Revisión §11.

Con esto, la última casilla de §4 está hecha, **pendiente de su validador**.

## 11 · Pulido final (2026-11-04)

Rama `feat/italiano-pulido` (sale de `integra/idiomas`, `49eaf1e4`), **sin
validar**. Detalle en `docs/i18n/revision-italiano-pulido.md`. Cada arreglo
lleva su rojo en un commit propio y sus mutantes; ninguno toca lo que espera al
dueño (B68, B70, B71, B73, B74, P-L2-1, D13).

- **B69 cerrado:** el aviso «Idioma guardado» sale en el idioma AL QUE se pasa
  (`idiomaTrasGuardar` en `IdiomaCuenta.tsx`, con la regla de `resolverIdioma`
  para «Usar el idioma del navegador»). Sin cambio de idioma, el de siempre.
  8/8 mutantes.
- **B72 cerrado:** `ParteEnIdioma` (`lib/i18n/parte-en-idioma.tsx`) pone
  `<div lang style="display:contents">` en la propuesta imprimible, el contrato
  (dos partes: el panel de firmas queda fuera) y el comprobante, **solo** cuando
  el idioma del papel no es el de la persona. Volcado contra `49eaf1e4`: 23
  estados cambian, todos de idiomas distintos y solo por el envoltorio; los de
  idiomas iguales, ni un byte. 7/7 mutantes.
- **O2, O3, O5 de la validación del recorrido:** la paginación con millar
  («1.260», «1.001–1.020») mata los mutantes que pasan `'es'`; los espacios van
  en la misma cadena que la palabra y `renderToString` vuelve a dar el HTML
  español de `caef69f8` byte a byte (eran tres `<!-- -->` de más, no uno); los
  dos comentarios, al día.
- **Barrido global:** `node scripts/i18n-barrido-italiano.mjs <carpeta>` vuelca
  el HTML de todas las unitarias y lo barre con `barrido-italiano.test.ts`
  (7414 trozos ajenos del diccionario + huellas de formato; no barre los papeles
  con `lang` de otro idioma ni junta nodos). **3710 estados italianos, 646
  hallazgos, 646 declarados en `A_PROPOSITO_IT` con su motivo, 0 sin
  declarar.** Una pasada exploratoria de una palabra encontró un fallo real: el
  `alt="preview"` del alta manual, ahora «Anteprima» en italiano.
- **B65:** las cinco `idioma.cuenta.*` listadas en la revisión §5 para el
  validador; sin cambios.
- **Español e inglés:** `DICCIONARIOS` 0 valores cambiados (5621 claves); el
  HTML solo cambia en los 23 estados de B72. Cobertura 0 pendientes, costura en
  verde. Unitarias **8407 + 1 omitida** (402 archivos), typecheck y build en
  verde.

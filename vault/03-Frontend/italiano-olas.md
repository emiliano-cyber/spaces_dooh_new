---
tipo: tablero
estado: en-curso
actualizado: 2026-11-03
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
  - docs/i18n/revision-italiano-base.md
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
| P4 | **Idioma de la instancia para los contratos** (texto legal, cantidad con letra, constancia) en el idioma elegido al crear la instancia, como la moneda del ADR 0048 | **Decidido** (03/11) · **tarea ROJA aparte** (migración, firmas y hash, aprovisionamiento). Puntos de enganche en `docs/i18n/revision-italiano-base.md` §6 |

> [!note] El idioma de la interfaz NO se guarda en la base
> Es por dispositivo, en la cookie `spaces_idioma` (decisión del 30/09). No hay
> columna con un CHECK `es`/`en` que el italiano tuviera que ampliar: la ola 0
> no necesitó ninguna migración.

## 4 · Antes de encender `IDIOMA_ITALIANO`

- [ ] Los cinco lotes en **VERDE**, con su tipo `IT_<AMBITO>` ya en `Record` completo
- [ ] `coberturaItaliano()` con **0 pendientes** en todas las filas
- [ ] El espejo (`I18N_VOLCAR_IT`) sin hallazgos de formato (hoy 358, §5)
- [ ] La costura del italiano en verde
- [ ] El recorrido en el navegador, pantalla por pantalla

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
  roja aparte (P4). El tipo lo dice:
  `Record<Exclude<ClaveArrendadores, 'arrendadores.constancia.…'>, string>`; los
  otros tres pasan a `Record` completo. La lista por omisión de una OT
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

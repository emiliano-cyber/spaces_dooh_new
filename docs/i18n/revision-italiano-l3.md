# Revisión · Italiano, lote L3 · Inventario, arrendadores y operaciones

**Fecha:** 2026-11-03 · **Rama:** `feat/italiano-l3-inventario`, sobre
`integra/idiomas` (`6fea374a`) · **Tablero:** `vault/03-Frontend/italiano-olas.md`
(subsección «Lote L3») · **Estado:** hecho, sin validar.

## 1 · Qué se tradujo

| Ámbito | Archivo | Claves | Con italiano | Pendientes |
|---|---|---:|---:|---:|
| operaciones (disponibilidad, almacén, imprenta) | `lib/i18n/textos/operaciones.ts` | 177 | 177 | 0 |
| operaciones2 (OT, ficha de OT, creativos, lista por omisión de una OT) | `lib/i18n/textos/operaciones2.ts` | 205 | 205 | 0 |
| inventario | `lib/i18n/textos/inventario.ts` | 360 | 360 | 0 |
| arrendadores y contratos | `lib/i18n/textos/arrendadores.ts` | 444 | 431 | **13** |

Los 13 pendientes son **la constancia de firmas** (`arrendadores.constancia.*`).
Por decisión del dueño (03/11) el contrato y lo que se imprime con él van en el
**idioma de la instancia**: tarea roja aparte (firmas, hash, aprovisionamiento).
Mientras tanto, en `it` caen al inglés como cualquier clave sin italiano. El
tipo lo deja escrito: `IT_ARRENDADORES` es
`Record<Exclude<ClaveArrendadores, 'arrendadores.constancia.…'>, string>`
(`tsc` exige todas las demás); los otros tres pasan a `Record` completo.
`lib/contrato-documento.ts` y `ConstanciaFirmas.tsx` no se tocaron.

`lib/i18n/checklist-ot.ts` no necesitó cambios: sus tres puntos son claves de
`operaciones2` y ya salen en italiano (lo guardado sigue en español).

Traducido desde el ESPAÑOL; el inglés, solo para el sentido. Glosario propio del
lote en el tablero. Términos nuevos: **impianto** (pantalla de inventario,
masculino), **schermo** (el artículo de almacén de tipo pantalla, declarado en
la costura), **canone**, **immobile**, **conduttrice**, **OdL** (masculino),
**lucchetto della fatturazione**, **creatività** (femenino invariable),
**postazione**, **riconciliazione**, **conto economico**, **dismettere** /
**disattivare**.

Decisiones de estilo: «dal … al …» se cambió por un guion («1 mar 2026 – 14 mar
2026») porque «dal» se apostrofa ante 1, 8 y 11; «Proposta da: {parte}» y
«{parte}: firmato da {nombre}» porque `{parte}` llega con mayúscula («Il
locatore», «Noi»); los plurales con contador concuerdan con el sustantivo
italiano, no con el español («{n} riga letta», «1 codice esiste già», donde el
español dice «{n} filas leídas» / «código(s)»); «Attivi: {activos} su {total}»
en vez del «activo(s)» del español.

## 2 · Lo que se arregló en el código (solo se veía en italiano)

| Archivo | Antes, en italiano | Después | es / en |
|---|---|---|---|
| `components/demo/inventario/NuevaPantallaForm.tsx` | «Attualmente: 45,000.» (`toLocaleString('es-MX')` fijo) | «45.000» (`numeroEnIdioma`) | idénticos (`es-MX` y `en-US` escriben igual) |
| `components/operaciones/OTVista.tsx` | «Salvato: MX$1.500» (símbolo pegado) | «MX$ 1.500» (espacio solo si `posicionSimbolo === 'delante-con-espacio'`) | idénticos: un solo texto, y `renderToStaticMarkup` no mete separadores |

El espejo de la ola 0 no los veía: los dos salen en estados **forzados**, que el
espejo no reproduce (rinde el árbol sin forzar). Las pruebas del lote rinden
cada estado en `it`.

## 3 · Español e inglés idénticos — medido

| Medición | Resultado |
|---|---|
| HTML de TODAS las pruebas (`I18N_VOLCAR_TODO`), antes (`6fea374a`) y después | 3027 archivos antes; `diff -rq`: **0 distintos, 0 desaparecidos**; 266 nuevos, todos de las pruebas nuevas en `it` |
| `DICCIONARIOS.es` / `.en` | 5590 valores cada uno, **0 cambiados**, 0 quitados, 0 nuevos |
| `DICCIONARIOS.it` | 1163 valores cambian (los que antes caían al inglés) |

## 4 · El italiano, mirado

- **Pruebas del lote** (`pantallas-operaciones`, `pantallas-operaciones2`,
  `pantallas-inventario-arrendadores`): cada estado se rinde en `it` y se exige
  (e) **0 huellas** de formato español o inglés, (f) las frases italianas de los
  estados con lista (unas 400 frases en 69 estados), (g) el **barrido** del
  diccionario del lote contra el HTML italiano: ningún trozo inglés ni español
  de una clave del lote (helper `lib/test/italiano-l3.ts`). Y el símbolo de la
  moneda de la instancia en `it` (MXN y USD).
- **Lo que el barrido NO cuenta, y por qué:** un trozo inglés que también es el
  inglés de una clave AJENA aún sin italiano (los estatus de Comercial, las
  periodicidades de `compartidos`, los estados de OT de Campañas…): no se puede
  saber de cuál de las dos sale. La lista se calcula de `IT_PARCIAL`, así que se
  encoge sola cuando los otros lotes traduzcan. Los trozos españoles no tienen
  excepción. Los datos de prueba se quitan antes de barrer.
- **Lo apartado en la guardia, con su porqué:** el navegador del firmante
  («Mozilla/5.0», un dato); el documento del contrato (español por decisión del
  dueño); el importe que recita la revisión de firmas («$10,000.00 MXN», el dato
  que se congela, igual que en la guardia inglesa); y los EJEMPLOS de captura de
  cifras («212,500.50», «65.50», el `placeholder` «0.00»), porque el campo
  (`lib/captura-cifra.ts`) lee coma de millar y punto decimal en todos los
  idiomas. Esto último es una **decisión pendiente del dueño** (tablero).
- **Espejo de la ola 0** (`I18N_VOLCAR_IT`) sobre las pruebas del lote: siguen
  **24 huellas**, las mismas de partida y todas de las dos clases que no son del
  lote: «Mozilla/5.0» (dato de la prueba) y el documento del contrato en español
  (tarea roja). Bajarlas a 0 exige cambiar el dato de prueba —y con él el HTML
  es/en— o el espejo, que no es de este lote. En las pruebas del lote, 0.

## 5 · Pruebas y mutantes

- `npm run typecheck`: limpio.
- `npx vitest run`: **383 archivos, 7137 pruebas en verde** (antes 6988).
- `cobertura-italiano`: 0 pendientes en `operaciones`, `operaciones2` e
  `inventario`; 13 en `arrendadores` (la constancia, §1).
- `costura.test.ts`: verde. Excepción nueva declarada: «Pantalla» →
  «Impianto» / «Schermo».
- `catalogos-italiano.test.ts`: la lista por omisión de una OT deja de ser igual
  al inglés a propósito y se prueba en italiano (y que lo escrito por una
  persona sigue saliendo tal cual).

**Rojo de partida:** con los `IT_*` vacíos, el barrido de las tres pruebas
falla (mutantes M1–M4), y dos estados fallan por formato («45,000»,
«MX$1.500») antes del arreglo de §2.

**Mutantes: 15, mueren 15.** M11 sobrevivía en la primera medición —traducir
mal el rótulo «Di proprietà» del indicador no lo veía nadie, porque el chip y la
etiqueta de la fila dicen lo mismo y «Owned» es también el inglés de una clave
de Comercial—; la lista del estado se afinó al rótulo del indicador y ahora muere.

| # | Mutante | Resultado |
|---|---|---|
| M1–M4 | Cada `IT_*` del lote vacío | mueren (13, 21, 16 y 24 pruebas) |
| M5 | Una clave en inglés («New work order») | muere |
| M6 | Una clave en español («Almacén») | muere |
| M7 | Plural cambiado (`celda.libres.uno` = «liberi») | muere |
| M8 | Hueco perdido (`{spots}`) | muere (pantallas y cobertura) |
| M9 | La renta con `'es-MX'` fijo | muere |
| M10 | El símbolo pegado en la ficha de OT | muere |
| M11 | «Di proprietà» → «Owned» | muere (tras afinar la lista) |
| M12 | Un punto de la lista por omisión de OT sin italiano | muere |
| M13 | Concordancia («OdL chiusa») | muere |
| M14 | Quitar la excepción «Pantalla» de la costura | muere |
| M15 | Apóstrofo recto | muere |

Hueco conocido del barrido: si una clave del lote se deja con el MISMO texto
que el español, el barrido no la ve (el italiano «contiene» el trozo). Lo cubren
las listas de frases italianas de cada estado (M6).

## 6 · Lo que no se hizo y por qué

- La constancia de firmas y el documento del contrato (tarea roja, §1).
- Las claves de otros lotes que pintan estas pantallas (estatus de sitio y de
  contrato de Comercial, periodicidades y candado de `compartidos`, estados de OT
  de Campañas, `finanzas.comun.dias`…): siguen en inglés hasta que su lote las
  traduzca.
- Las fechas ISO que algunas pantallas pintan tal cual («2026-10-25» en el
  cuadre, «2026-06-01 → 2026-12-31» en el resumen del asistente) salen igual en
  español: no son de idioma.

## 7 · Tabla clave por clave

## Operaciones (disponibilidad, almacén, imprenta) · `textos/operaciones.ts` · 177 claves

| clave | español | inglés | italiano |
|---|---|---|---|
| `operaciones.slots.libres-de` | {disp} de {total} slots libres | {disp} of {total} slots free | {disp} di {total} slot liberi |
| `operaciones.slots.total` | {total} slots | {total} slots | {total} slot |
| `operaciones.slots.slots` | slots | slots | slot |
| `operaciones.clientes-badge.libres` | {libres} de {cupo} lugares de cliente libres | {libres} of {cupo} client openings left | {libres} di {cupo} posti cliente liberi |
| `operaciones.clientes-badge.lleno` | Cupo lleno: {cupo} clientes. Solo admite campañas de los que ya están. | Client cap reached: {cupo} clients. Only campaigns from clients already on this screen are accepted. | Limite clienti raggiunto: {cupo} clienti. Accetta solo campagne dei clienti già presenti. |
| `operaciones.clientes-badge.clientes` | clientes | clients | clienti |
| `operaciones.calendario.anterior` | Mes anterior | Previous month | Mese precedente |
| `operaciones.calendario.siguiente` | Mes siguiente | Next month | Mese successivo |
| `operaciones.calendario.dias` | L,M,M,J,V,S,D | M,T,W,T,F,S,S | L,M,M,G,V,S,D |
| `operaciones.calendario.confirmada` | confirmada | confirmed | confermata |
| `operaciones.calendario.en-propuesta` | en propuesta | in a proposal | in proposta |
| `operaciones.disponibilidad.titulo` | Disponibilidad | Availability | Disponibilità |
| `operaciones.disponibilidad.descripcion` | Ocupación futura por catorcena o mes: cruza las reservas confirmadas contra el inventario para ver qué tienes libre más adelante, y avisa qué está en una propuesta abierta. | Future occupancy by two-week period or month: it checks confirmed bookings against the inventory to show what you have free ahead, and flags what is in an open proposal. | Occupazione futura per quindicina o mese: incrocia le prenotazioni confermate con l’inventario per vedere cosa hai libero più avanti, e segnala cosa è in una proposta aperta. |
| `operaciones.disponibilidad.kpi.estaticas` | Estáticas libres | Free static screens | Impianti statici liberi |
| `operaciones.disponibilidad.kpi.de` | {n} de {total} | {n} of {total} | {n} di {total} |
| `operaciones.disponibilidad.kpi.en-periodo` | en {periodo} | in {periodo} | in {periodo} |
| `operaciones.disponibilidad.kpi.digitales` | Digitales con lugar | Digital screens with room | Digitali con spazio |
| `operaciones.disponibilidad.kpi.no-llenas` | no llenas en {periodo} | not full in {periodo} | non pieni in {periodo} |
| `operaciones.disponibilidad.kpi.slots` | Slots libres | Free slots | Slot liberi |
| `operaciones.disponibilidad.kpi.sumando` | sumando las digitales con lugar | across the digital screens with room | sommando i digitali con spazio |
| `operaciones.disponibilidad.kpi.ninguna-digital` | ninguna digital con lugar en el periodo | no digital screen has room in the period | nessun digitale con spazio nel periodo |
| `operaciones.disponibilidad.kpi.en-propuesta` | En propuesta | In a proposal | In proposta |
| `operaciones.disponibilidad.kpi.piden.uno` | pantallas que piden {n} propuesta abierta · no bloquean | screens requested by {n} open proposal · not blocking | impianti richiesti da {n} proposta aperta · non bloccano |
| `operaciones.disponibilidad.kpi.piden.otros` | pantallas que piden {n} propuestas abiertas · no bloquean | screens requested by {n} open proposals · not blocking | impianti richiesti da {n} proposte aperte · non bloccano |
| `operaciones.disponibilidad.kpi.ninguna-pide` | ninguna propuesta abierta las pide | no open proposal requests them | nessuna proposta aperta li richiede |
| `operaciones.disponibilidad.desde` | Desde | From | Da |
| `operaciones.disponibilidad.vista` | Vista | View | Vista |
| `operaciones.disponibilidad.catorcena` | Catorcena | Two-week period | Quindicina |
| `operaciones.disponibilidad.mes` | Mes | Month | Mese |
| `operaciones.disponibilidad.periodos` | Periodos | Periods | Periodi |
| `operaciones.disponibilidad.periodos-title` | Periodos a mostrar | Periods to show | Periodi da mostrare |
| `operaciones.disponibilidad.n-periodos` | {n} periodos | {n} periods | {n} periodi |
| `operaciones.disponibilidad.buscar-aria` | Buscar pantalla | Search screen | Cerca impianto |
| `operaciones.disponibilidad.buscar` | Buscar pantalla: nombre o clave… | Search screen: name or code… | Cerca impianto: nome o codice… |
| `operaciones.disponibilidad.solo-hueco` | Solo con hueco libre | Only with availability | Solo con spazio libero |
| `operaciones.disponibilidad.calendario` | Calendario por pantalla | Calendar by screen | Calendario per impianto |
| `operaciones.disponibilidad.calendario-sub` | Cada celda dice su estado; pasa el cursor para ver qué campaña la ocupa. | Each cell shows its status; hover over it to see which campaign takes it. | Ogni cella indica il suo stato; passa il cursore per vedere quale campagna la occupa. |
| `operaciones.disponibilidad.cargando` | Cargando disponibilidad… | Loading availability… | Caricamento della disponibilità… |
| `operaciones.disponibilidad.sin-coincidencias` | Sin pantallas que coincidan. | No matching screens. | Nessun impianto corrispondente. |
| `operaciones.disponibilidad.pantalla` | Pantalla | Screen | Impianto |
| `operaciones.disponibilidad.digital` | digital | digital | digitale |
| `operaciones.disponibilidad.libres-de` | {n} de {total} libres | {n} of {total} free | {n} di {total} liberi |
| `operaciones.disponibilidad.ocupante` | {campana} (confirmada) | {campana} (confirmed) | {campana} (confermata) |
| `operaciones.disponibilidad.ocupante-slots` | {campana} (confirmada, {spots} slots) | {campana} (confirmed, {spots} slots) | {campana} (confermata, {spots} slot) |
| `operaciones.disponibilidad.quedan` | Quedan {libres} de {total} slots | {libres} of {total} slots left | Restano {libres} di {total} slot |
| `operaciones.disponibilidad.libre-slots` | Libre: {n} slots | Free: {n} slots | Libero: {n} slot |
| `operaciones.disponibilidad.libre` | Libre | Free | Libero |
| `operaciones.disponibilidad.en-propuesta-titulo` | En propuesta {folio}{cliente} ({desde} a {hasta}{spots}) | In proposal {folio}{cliente} ({desde} to {hasta}{spots}) | In proposta {folio}{cliente} ({desde} – {hasta}{spots}) |
| `operaciones.disponibilidad.en-propuesta-spots` | , {n} spots | , {n} spots | , {n} spot |
| `operaciones.disponibilidad.celda.libres.uno` | {n} libre | {n} free | {n} libero |
| `operaciones.disponibilidad.celda.libres.otros` | {n} libres | {n} free | {n} liberi |
| `operaciones.disponibilidad.celda.lleno` | Lleno | Full | Pieno |
| `operaciones.disponibilidad.celda.en-propuesta` | En propuesta | In a proposal | In proposta |
| `operaciones.disponibilidad.celda.usados` | {n} usados | {n} used | {n} usati |
| `operaciones.disponibilidad.celda.ocupada` | Ocupada | Occupied | Occupato |
| `operaciones.disponibilidad.leyenda.libre` | Libre | Free | Libero |
| `operaciones.disponibilidad.leyenda.en-propuesta` | En propuesta (libre, pero una propuesta abierta la pide) | In a proposal (free, but an open proposal requests it) | In proposta (libero, ma una proposta aperta lo richiede) |
| `operaciones.disponibilidad.leyenda.parcial` | Parcial (digital: el número son los slots que quedan libres) | Partial (digital: the number is the slots still free) | Parziale (digitale: il numero indica gli slot ancora liberi) |
| `operaciones.disponibilidad.leyenda.ocupada` | Ocupada | Occupied | Occupato |
| `operaciones.almacen.titulo` | Almacén | Warehouse | Magazzino |
| `operaciones.almacen.descripcion` | Vehículos, herramientas, pantallas, cámaras y demás artículos, y sus traslados. | Vehicles, tools, screens, cameras and other items, and their transfers. | Veicoli, attrezzi, schermi, telecamere e altri articoli, e i loro trasferimenti. |
| `operaciones.almacen.registrar-articulo` | Registrar artículo | Register item | Registra articolo |
| `operaciones.almacen.estado.en-almacen` | En almacén | In warehouse | In magazzino |
| `operaciones.almacen.estado.instalado` | Instalado | Installed | Installato |
| `operaciones.almacen.estado.en-traslado` | En traslado | In transit | In trasferimento |
| `operaciones.almacen.estado.baja` | Baja | Decommissioned | Dismesso |
| `operaciones.almacen.mov.entrada` | Regresar a almacén | Return to warehouse | Riporta in magazzino |
| `operaciones.almacen.mov.salida` | Instalar en pantalla | Install on a screen | Installa su un impianto |
| `operaciones.almacen.mov.traslado` | Marcar en traslado | Mark in transit | Segna in trasferimento |
| `operaciones.almacen.mov.baja` | Dar de baja | Decommission | Dismetti |
| `operaciones.almacen.tipo.vehiculo` | Vehículo / camioneta | Vehicle / van | Veicolo / furgone |
| `operaciones.almacen.tipo.herramienta` | Herramienta | Tool | Attrezzo |
| `operaciones.almacen.tipo.pantalla` | Pantalla | Screen | Schermo |
| `operaciones.almacen.tipo.equipo` | Equipo electrónico | Electronic equipment | Apparecchiatura elettronica |
| `operaciones.almacen.tipo.camara` | Cámara | Camera | Telecamera |
| `operaciones.almacen.tipo.estructura` | Estructura | Structure | Struttura |
| `operaciones.almacen.tipo.lona` | Lona | Vinyl banner | Telo |
| `operaciones.almacen.tipo.otro` | Otro | Other | Altro |
| `operaciones.almacen.campo.marca` | Marca | Brand | Marca |
| `operaciones.almacen.campo.modelo` | Modelo | Model | Modello |
| `operaciones.almacen.campo.numero-serie` | Número de serie | Serial number | Numero di serie |
| `operaciones.almacen.campo.placas` | Placas | License plate | Targa |
| `operaciones.almacen.campo.vin` | Número de serie (VIN) | Serial number (VIN) | Numero di serie (VIN) |
| `operaciones.almacen.no-cargar` | No se pudo cargar el almacén | The warehouse could not be loaded | Impossibile caricare il magazzino |
| `operaciones.almacen.error-desconocido` | error desconocido | unknown error | errore sconosciuto |
| `operaciones.almacen.indicadores` | Indicadores | Indicators | Indicatori |
| `operaciones.almacen.kpi.articulos` | Artículos | Items | Articoli |
| `operaciones.almacen.kpi.baja.uno` | {n} dado de baja | {n} decommissioned | {n} dismesso |
| `operaciones.almacen.kpi.baja.otros` | {n} dados de baja | {n} decommissioned | {n} dismessi |
| `operaciones.almacen.kpi.ninguno-baja` | ninguno dado de baja | none decommissioned | nessuno dismesso |
| `operaciones.almacen.kpi.instalados` | Instalados | Installed | Installati |
| `operaciones.almacen.kpi.en-pantalla` | en una pantalla | on a screen | su un impianto |
| `operaciones.almacen.kpi.en-almacen` | En almacén | In warehouse | In magazzino |
| `operaciones.almacen.kpi.guardados` | guardados en bodega | stored in a depot | custoditi in deposito |
| `operaciones.almacen.kpi.en-traslado` | En traslado | In transit | In trasferimento |
| `operaciones.almacen.kpi.en-camino` | en camino | on the way | in viaggio |
| `operaciones.almacen.articulos` | Artículos | Items | Articoli |
| `operaciones.almacen.fallo` | No se pudo cargar el almacén — {error} | The warehouse could not be loaded — {error} | Impossibile caricare il magazzino — {error} |
| `operaciones.almacen.reintentar` | Reintentar | Retry | Riprova |
| `operaciones.almacen.vacio` | Aún no hay artículos. Registra vehículos, herramientas, pantallas o cámaras para seguir dónde está cada uno. | No items yet. Register vehicles, tools, screens or cameras to track where each one is. | Non ci sono ancora articoli. Registra veicoli, attrezzi, schermi o telecamere per sapere dove si trova ciascuno. |
| `operaciones.almacen.pide` | Pide a Operaciones que los registre. | Ask Operations to register them. | Chiedi a Operazioni di registrarli. |
| `operaciones.almacen.filtrar` | Filtrar por tipo | Filter by type | Filtra per tipo |
| `operaciones.almacen.todos` | Todos | All | Tutti |
| `operaciones.almacen.col.etiqueta` | Etiqueta | Tag | Etichetta |
| `operaciones.almacen.col.descripcion` | Descripción | Description | Descrizione |
| `operaciones.almacen.col.tipo` | Tipo | Type | Tipo |
| `operaciones.almacen.col.datos` | Datos | Details | Dati |
| `operaciones.almacen.col.estado` | Estado | Status | Stato |
| `operaciones.almacen.col.ubicacion` | Ubicación | Location | Posizione |
| `operaciones.almacen.en-pantalla` | En pantalla:␣ | On screen:␣ | Su impianto:␣ |
| `operaciones.almacen.bodega` | Bodega:␣ | Depot:␣ | Deposito:␣ |
| `operaciones.almacen.mover` | Mover | Move | Sposta |
| `operaciones.almacen.placas` | Placas {placas} | Plate {placas} | Targa {placas} |
| `operaciones.almacen.alta.registrado` | Activo registrado en almacén | Item registered in the warehouse | Articolo registrato in magazzino |
| `operaciones.almacen.alta.no-registrar` | No se pudo registrar | Could not register | Impossibile registrare |
| `operaciones.almacen.alta.subtitulo` | Entra al almacén | It goes into the warehouse | Entra in magazzino |
| `operaciones.almacen.alta.registrar` | Registrar | Register | Registra |
| `operaciones.almacen.alta.etiqueta` | Etiqueta / número de inventario | Tag / inventory number | Etichetta / numero di inventario |
| `operaciones.almacen.alta.etiqueta-ej` | Ej. INV-0231 | E.g. INV-0231 | Es. INV-0231 |
| `operaciones.almacen.alta.descripcion` | Descripción | Description | Descrizione |
| `operaciones.almacen.alta.descripcion-ej` | Ej. Camioneta Nissan NP300 / Pantalla LED 4x3 m | E.g. Nissan NP300 van / 4x3 m LED screen | Es. Furgone Nissan NP300 / Schermo LED 4x3 m |
| `operaciones.almacen.alta.tipo` | Tipo | Type | Tipo |
| `operaciones.almacen.alta.donde` | Dónde se guarda | Where it is stored | Dove è custodito |
| `operaciones.almacen.alta.donde-ej` | Ej. Bodega norte, anaquel 3 | E.g. North depot, shelf 3 | Es. Deposito nord, scaffale 3 |
| `operaciones.almacen.alta.notas` | Notas | Notes | Note |
| `operaciones.almacen.ej` | Ej. {ejemplo} | E.g. {ejemplo} | Es. {ejemplo} |
| `operaciones.almacen.mover.registrado` | Movimiento registrado | Movement recorded | Movimento registrato |
| `operaciones.almacen.mover.no-mover` | No se pudo mover | Could not move | Impossibile spostare |
| `operaciones.almacen.mover.titulo` | Mover activo | Move item | Sposta articolo |
| `operaciones.almacen.mover.registrar` | Registrar movimiento | Record movement | Registra movimento |
| `operaciones.almacen.mover.movimiento` | Movimiento | Movement | Movimento |
| `operaciones.almacen.mover.destino` | Pantalla destino | Destination screen | Impianto di destinazione |
| `operaciones.almacen.mover.elige` | — Elige — | — Choose — | — Scegli — |
| `operaciones.almacen.mover.motivo` | Motivo / nota | Reason / note | Motivo / nota |
| `operaciones.almacen.mover.motivo-ej` | Ej. Retiro por fin de contrato | E.g. Removed at the end of the contract | Es. Rimozione per fine contratto |
| `operaciones.imprenta.no-avanzar` | No se pudo avanzar la orden | The order could not be advanced | Impossibile far avanzare l’ordine |
| `operaciones.imprenta.titulo` | Imprenta | Printing | Stampa |
| `operaciones.imprenta.descripcion` | Órdenes de impresión · del arte al montaje | Print orders · from artwork to installation | Ordini di stampa · dalla grafica al montaggio |
| `operaciones.imprenta.nueva` | Nueva orden | New order | Nuovo ordine |
| `operaciones.imprenta.kpi.en-proceso` | En proceso | In progress | In corso |
| `operaciones.imprenta.kpi.en-proceso-sub` | aún no están listas para montaje | not ready to install yet | non ancora pronti per il montaggio |
| `operaciones.imprenta.kpi.prueba` | Prueba de color pendiente | Color proof pending | Prova colore in sospeso |
| `operaciones.imprenta.kpi.sin-aprobar` | sin aprobar | not approved | non approvata |
| `operaciones.imprenta.kpi.en-produccion` | En producción | In production | In produzione |
| `operaciones.imprenta.kpi.en-produccion-sub` | en producción o ya impresas | in production or already printed | in produzione o già stampati |
| `operaciones.imprenta.kpi.listas` | Listas para montaje | Ready to install | Pronti per il montaggio |
| `operaciones.imprenta.kpi.listas-sub` | pasan a una OT | they move on to a work order | passano a un OdL |
| `operaciones.imprenta.ordenes` | Órdenes de impresión | Print orders | Ordini di stampa |
| `operaciones.imprenta.orden.uno` | {n} orden | {n} order | {n} ordine |
| `operaciones.imprenta.orden.otros` | {n} ordenes | {n} orders | {n} ordini |
| `operaciones.imprenta.vacia` | Sin órdenes de impresión | No print orders | Nessun ordine di stampa |
| `operaciones.imprenta.vacia-detalle` | Crea una orden ligada a una campaña fija (OOH/híbrida) para llevar el proceso del arte al montaje. | Create an order linked to a fixed campaign (OOH/hybrid) to track the process from artwork to installation. | Crea un ordine collegato a una campagna fissa (OOH/ibrida) per seguire il processo dalla grafica al montaggio. |
| `operaciones.imprenta.sin-material` | Sin material | No material | Nessun materiale |
| `operaciones.imprenta.contenido-digital` | Contenido digital | Digital content | Contenuto digitale |
| `operaciones.imprenta.campana` | Campaña: {nombre} | Campaign: {nombre} | Campagna: {nombre} |
| `operaciones.imprenta.sin-campana` | Sin campaña | No campaign | Nessuna campagna |
| `operaciones.imprenta.paso` | Paso {n} de {total} | Step {n} of {total} | Passo {n} di {total} |
| `operaciones.imprenta.prueba-aprobada` | Prueba de color: Aprobada | Color proof: Approved | Prova colore: approvata |
| `operaciones.imprenta.prueba-pendiente` | Prueba de color: Pendiente | Color proof: Pending | Prova colore: in sospeso |
| `operaciones.imprenta.error` | Error | Error | Errore |
| `operaciones.imprenta.aprobar-prueba` | Aprobar prueba | Approve proof | Approva prova |
| `operaciones.imprenta.avanzando` | Avanzando… | Advancing… | Avanzamento… |
| `operaciones.imprenta.avanzar` | Avanzar | Advance | Avanza |
| `operaciones.imprenta.no-crear` | No se pudo crear la orden | The order could not be created | Impossibile creare l’ordine |
| `operaciones.imprenta.nueva-titulo` | Nueva orden de impresión | New print order | Nuovo ordine di stampa |
| `operaciones.imprenta.creando` | Creando… | Creating… | Creazione… |
| `operaciones.imprenta.crear` | Crear orden | Create order | Crea ordine |
| `operaciones.imprenta.campo.campana` | Campaña | Campaign | Campagna |
| `operaciones.imprenta.selecciona-campana` | Selecciona una campaña… | Select a campaign… | Seleziona una campagna… |
| `operaciones.imprenta.campo.sitio` | Sitio | Site | Sito |
| `operaciones.imprenta.campo.material` | Material | Material | Materiale |
| `operaciones.imprenta.campo.material-ej` | Lona front, vinil, contenido digital… | Front-lit vinyl, vinyl, digital content… | Telo frontlit, vinile, contenuto digitale… |
| `operaciones.imprenta.campo.ancho` | Ancho (m) | Width (m) | Larghezza (m) |
| `operaciones.imprenta.campo.alto` | Alto (m) | Height (m) | Altezza (m) |
| `operaciones.imprenta.campo.proveedor` | Proveedor | Supplier | Fornitore |
| `operaciones.imprenta.campo.proveedor-ej` | Imprenta proveedora | Print shop | Tipografia fornitrice |
| `operaciones.imprenta.digital-ayuda` | Deja ancho y alto en 0 para contenido digital. | Leave width and height at 0 for digital content. | Lascia larghezza e altezza a 0 per i contenuti digitali. |

## Operaciones 2 (OT, ficha de OT, creativos) · `textos/operaciones2.ts` · 205 claves

| clave | español | inglés | italiano |
|---|---|---|---|
| `operaciones2.comun.de` | {a} de {b} | {a} of {b} | {a} di {b} |
| `operaciones2.comun.campana` | Campaña | Campaign | Campagna |
| `operaciones2.comun.pantalla` | Pantalla | Screen | Impianto |
| `operaciones2.comun.descripcion` | Descripción | Description | Descrizione |
| `operaciones2.comun.tipo` | Tipo | Type | Tipo |
| `operaciones2.comun.prioridad` | Prioridad | Priority | Priorità |
| `operaciones2.comun.responsable` | Responsable | Assignee | Responsabile |
| `operaciones2.comun.sin-asignar` | Sin asignar | Unassigned | Non assegnato |
| `operaciones2.comun.vencida` | Vencida | Overdue | In ritardo |
| `operaciones2.comun.por-vencer` | Por vencer | Due soon | In scadenza |
| `operaciones2.comun.guardando` | Guardando… | Saving… | Salvataggio… |
| `operaciones2.comun.ver-todas` | Ver todas | Show all | Mostra tutti |
| `operaciones2.comun.ver-todas-n` | Ver todas ({n}) | Show all ({n}) | Mostra tutti ({n}) |
| `operaciones2.comun.ver-menos` | Ver menos | Show less | Mostra meno |
| `operaciones2.tipo-ot.montaje-lona` | Montaje de lona | Vinyl installation | Montaggio telo |
| `operaciones2.tipo-ot.montaje-digital` | Montaje digital | Digital installation | Montaggio digitale |
| `operaciones2.tipo-ot.desmontaje` | Desmontaje | Removal | Smontaggio |
| `operaciones2.tipo-ot.mantenimiento-preventivo` | Mantenimiento preventivo | Preventive maintenance | Manutenzione preventiva |
| `operaciones2.tipo-ot.mantenimiento-correctivo` | Mantenimiento correctivo | Corrective maintenance | Manutenzione correttiva |
| `operaciones2.tipo-ot.herreria` | Herrería | Metalwork | Carpenteria metallica |
| `operaciones2.tipo-ot.electrico` | Eléctrico | Electrical | Elettrico |
| `operaciones2.tipo-ot.inspeccion` | Inspección | Inspection | Ispezione |
| `operaciones2.tipo-ot.otro` | Otro | Other | Altro |
| `operaciones2.prioridad.baja` | Baja | Low | Bassa |
| `operaciones2.prioridad.normal` | Normal | Normal | Normale |
| `operaciones2.prioridad.alta` | Alta | High | Alta |
| `operaciones2.prioridad.urgente` | Urgente | Urgent | Urgente |
| `operaciones2.ot.descripcion` | Tareas de cuadrilla · seguimiento de campo | Crew tasks · field tracking | Attività delle squadre · monitoraggio sul campo |
| `operaciones2.ot.nueva` | Nueva OT | New work order | Nuovo OdL |
| `operaciones2.ot.filtro.todas` | Todas | All | Tutti |
| `operaciones2.ot.filtro.pendientes` | Pendientes | Pending | In attesa |
| `operaciones2.ot.filtro.asignadas` | Asignadas | Assigned | Assegnati |
| `operaciones2.ot.filtro.en-proceso` | En proceso | In progress | In corso |
| `operaciones2.ot.filtro.completadas` | Completadas | Completed | Completati |
| `operaciones2.ot.kpi.abiertas` | Abiertas | Open | Aperti |
| `operaciones2.ot.kpi.en-proceso` | {n} en proceso | {n} in progress | {n} in corso |
| `operaciones2.ot.kpi.vencidas` | Vencidas | Overdue | In ritardo |
| `operaciones2.ot.kpi.frenan` | frenan el candado de facturación | keeping the billing lock closed | tengono chiuso il lucchetto della fatturazione |
| `operaciones2.ot.kpi.compromiso` | compromiso en 2 días o menos | due in 2 days or less | in scadenza entro 2 giorni |
| `operaciones2.ot.kpi.sin-responsable` | abiertas sin responsable | open with no assignee | aperti senza responsabile |
| `operaciones2.ot.banner.vencidas.uno` | {n} OT vencida | {n} overdue work order | {n} OdL in ritardo |
| `operaciones2.ot.banner.vencidas.otros` | {n} OT vencidas | {n} overdue work orders | {n} OdL in ritardo |
| `operaciones2.ot.banner.por-vencer` | {n} por vencer | {n} due soon | {n} in scadenza |
| `operaciones2.ot.banner.explica` | — una OT abierta que pasó su fecha compromiso frena el candado de facturación. | — an open work order past its due date keeps the billing lock closed. | — un OdL aperto oltre la data di scadenza tiene chiuso il lucchetto della fatturazione. |
| `operaciones2.ot.lista` | Órdenes de trabajo | Work orders | Ordini di lavoro |
| `operaciones2.ot.vacio.filtro` | Ninguna OT en «{filtro}» | No work orders in “{filtro}” | Nessun OdL in «{filtro}» |
| `operaciones2.ot.vacio.filtro-detalle` | Las demás siguen en «Todas». | The rest are still under “All”. | Gli altri restano in «Tutti». |
| `operaciones2.ot.vacio.titulo` | Todavía no hay órdenes de trabajo | No work orders yet | Non ci sono ancora ordini di lavoro |
| `operaciones2.ot.vacio.detalle` | Crea la primera con «Nueva OT»: se liga a una campaña y a su pantalla. | Create the first one with “New work order”: it is linked to a campaign and its screen. | Crea il primo con «Nuovo OdL»: si collega a una campagna e al suo impianto. |
| `operaciones2.ot.abrir` | Abrir OT | Open work order | Apri OdL |
| `operaciones2.ot.ver` | Ver OT | View work order | Vedi OdL |
| `operaciones2.ot.fecha-compromiso` | Fecha compromiso | Due date | Data di scadenza |
| `operaciones2.ot.evidencias.uno` | {n} evidencia | {n} evidence photo | {n} prova |
| `operaciones2.ot.evidencias.otros` | {n} evidencias | {n} evidence photos | {n} prove |
| `operaciones2.ot.nueva.no-crear` | No se pudo crear la OT | Could not create the work order | Impossibile creare l’OdL |
| `operaciones2.ot.nueva.titulo` | Nueva orden de trabajo | New work order | Nuovo ordine di lavoro |
| `operaciones2.ot.nueva.subtitulo` | Asigna una tarea a cuadrilla | Assign a task to a crew | Assegna un’attività a una squadra |
| `operaciones2.ot.nueva.creando` | Creando… | Creating… | Creazione… |
| `operaciones2.ot.nueva.crear` | Crear OT | Create work order | Crea OdL |
| `operaciones2.ot.nueva.sin-campana` | — Sin campaña — | — No campaign — | — Nessuna campagna — |
| `operaciones2.ot.nueva.auto` | (auto por campaña) | (set by the campaign) | (automatico dalla campagna) |
| `operaciones2.ot.nueva.sin-pantalla` | — Sin pantalla — | — No screen — | — Nessun impianto — |
| `operaciones2.ot.nueva.opcion-digital` | · Digital | · Digital | · Digitale |
| `operaciones2.ot.nueva.opcion-fija` | · Fija | · Static | · Fisso |
| `operaciones2.ot.nueva.sin-sitios` | Esta campaña no tiene sitios reservados. | This campaign has no booked sites. | Questa campagna non ha siti prenotati. |
| `operaciones2.ot.nueva.tipo-tarea` | Tipo de tarea | Task type | Tipo di attività |
| `operaciones2.ot.nueva.opciones-digital` | (opciones de pantalla digital) | (options for a digital screen) | (opzioni per schermo digitale) |
| `operaciones2.ot.nueva.opciones-fija` | (opciones de pantalla fija) | (options for a static screen) | (opzioni per impianto fisso) |
| `operaciones2.ot.nueva.descripcion-ej` | p. ej. Montaje de lona en espectacular… | e.g. Vinyl installation on a billboard… | es. Montaggio telo su cartellone… |
| `operaciones2.ot.nueva.asignar` | Asignar a (responsable) | Assign to | Assegna a (responsabile) |
| `operaciones2.ot.nueva.sin-asignar` | — Sin asignar — | — Unassigned — | — Non assegnato — |
| `operaciones2.ficha.no-cargar` | No se pudo cargar la orden de trabajo. | Could not load the work order. | Impossibile caricare l’ordine di lavoro. |
| `operaciones2.ficha.inicia-sesion` | Inicia sesión para continuar | Sign in to continue | Accedi per continuare |
| `operaciones2.ficha.no-cerrar` | No se pudo cerrar la OT | Could not close the work order | Impossibile chiudere l’OdL |
| `operaciones2.ficha.sin-cambios` | No hay ningún cambio que guardar. | There are no changes to save. | Non c’è nessuna modifica da salvare. |
| `operaciones2.ficha.costo-borrado` | Costo borrado: esta visita vuelve a entrar al reporte con la estimación por tipo. | Cost cleared: this visit goes back into the report with the per-type estimate. | Costo eliminato: questa visita torna nel report con la stima per tipo. |
| `operaciones2.ficha.costo-guardado` | Costo guardado. El reporte de rentabilidad usará este importe en vez de la estimación. | Cost saved. The profitability report will use this amount instead of the estimate. | Costo salvato. Il report di redditività userà questo importo al posto della stima. |
| `operaciones2.ficha.no-guardar-costo` | No se pudo guardar el costo | Could not save the cost | Impossibile salvare il costo |
| `operaciones2.ficha.costo` | Costo real de esta visita | Actual cost of this visit | Costo effettivo di questa visita |
| `operaciones2.ficha.costo-explica` | Lo que de verdad costó. {sustituye} a la estimación por tipo de tarea que usa el reporte de rentabilidad, no se suma a ella. Déjalo vacío si no lo sabes: entonces el reporte sigue usando la estimación y te lo dice. | What it really cost. It {sustituye} the per-type estimate that the profitability report uses; it is not added to it. Leave it empty if you don’t know: the report keeps using the estimate and tells you so. | Quanto è costata davvero. {sustituye} la stima per tipo di attività usata dal report di redditività, non si somma a essa. Lascialo vuoto se non lo sai: allora il report continua a usare la stima e te lo segnala. |
| `operaciones2.ficha.costo-sustituye` | Sustituye | replaces | Sostituisce |
| `operaciones2.ficha.sin-capturar` | Sin capturar | Not entered | Non inserito |
| `operaciones2.ficha.guardar-costo` | Guardar costo | Save cost | Salva costo |
| `operaciones2.ficha.guardado-importe` | Guardado: {importe} | Saved: {importe} | Salvato: {importe} |
| `operaciones2.ficha.guardado-cero` | ␣— esta visita está capturada como que no costó nada. | ␣— this visit is recorded as having cost nothing. | ␣— questa visita risulta registrata come senza alcun costo. |
| `operaciones2.ficha.sin-capturar-reporte` | Sin capturar: el reporte usa la estimación por tipo de tarea. | Not entered: the report uses the per-type estimate. | Non inserito: il report usa la stima per tipo di attività. |
| `operaciones2.ficha.campana-de` | Campaña: {nombre} | Campaign: {nombre} | Campagna: {nombre} |
| `operaciones2.ficha.responsable-de` | Responsable: {nombre} | Assignee: {nombre} | Responsabile: {nombre} |
| `operaciones2.ficha.guardado` | Guardado | Saved | Salvato |
| `operaciones2.ficha.checklist` | Checklist | Checklist | Checklist |
| `operaciones2.ficha.error-guardar` | Error al guardar: {error}. Lo tachado se ve aquí pero aún NO está guardado. | Error while saving: {error}. What you checked off shows here but is NOT saved yet. | Errore durante il salvataggio: {error}. Le voci spuntate si vedono qui ma NON sono ancora salvate. |
| `operaciones2.ficha.reintentar` | Reintentar | Retry | Riprova |
| `operaciones2.ficha.solo-lectura` | Solo lectura: tu rol puede ver esta orden de trabajo, pero no marcar su checklist. | Read only: your role can see this work order but cannot check off its checklist. | Sola lettura: il tuo ruolo può vedere questo ordine di lavoro, ma non spuntarne la checklist. |
| `operaciones2.ficha.foto` | Fotografía comprobatoria | Proof photo | Foto di verifica |
| `operaciones2.ficha.tomar-foto` | Tomar foto | Take photo | Scatta foto |
| `operaciones2.ficha.sello` | Sello de ubicación | Location stamp | Timbro di posizione |
| `operaciones2.ficha.capturar-ubicacion` | Capturar ubicación | Capture location | Rileva posizione |
| `operaciones2.ficha.cerrando` | Cerrando… | Closing… | Chiusura… |
| `operaciones2.ficha.cerrar` | Cerrar OT | Close work order | Chiudi OdL |
| `operaciones2.ficha.completa` | Completa el checklist, toma una foto y captura la ubicación. | Complete the checklist, take a photo and capture the location. | Completa la checklist, scatta una foto e rileva la posizione. |
| `operaciones2.ficha.compromiso` | Compromiso | Due date | Scadenza |
| `operaciones2.ficha.candado.titulo` | Confirma con tu contraseña | Confirm with your password | Conferma con la tua password |
| `operaciones2.ficha.candado.subtitulo` | Capturar el costo de una orden de trabajo cambia el margen del reporte de rentabilidad: tu organización pide que vuelvas a identificarte. | Entering the cost of a work order changes the margin in the profitability report: your organization asks you to verify your identity again. | Inserire il costo di un ordine di lavoro cambia il margine del report di redditività: la tua organizzazione chiede di identificarti di nuovo. |
| `operaciones2.ficha.candado.confirmar` | Confirmar y guardar el costo | Confirm and save the cost | Conferma e salva il costo |
| `operaciones2.ficha.cerrada` | OT cerrada | Work order closed | OdL chiuso |
| `operaciones2.ficha.evidencia-enviada` | La evidencia se envió al pipeline de la campaña. | The evidence was sent to the campaign pipeline. | La prova è stata inviata alla pipeline della campagna. |
| `operaciones2.ficha.cerrada-el` | Cerrada el {fecha} | Closed on {fecha} | Chiuso il {fecha} |
| `operaciones2.ficha.checklist-cumplido` | Checklist cumplido | Checklist completed | Checklist completata |
| `operaciones2.checklist.omision.inspeccion` | Inspección de estructura y herrajes | Structure and hardware inspection | Ispezione della struttura e della ferramenta |
| `operaciones2.checklist.omision.montaje` | Montaje / ejecución | Installation / execution | Montaggio / esecuzione |
| `operaciones2.checklist.omision.foto` | Foto comprobatoria con geolocalización | Proof photo with geolocation | Foto di verifica con geolocalizzazione |
| `operaciones2.ficha.candado-encendido` | Candado de facturación encendido | Billing lock open | Lucchetto della fatturazione aperto |
| `operaciones2.ficha.evidencia-alt` | evidencia | evidence | prova |
| `operaciones2.ficha.puedes-cerrar` | Puedes cerrar esta ventana. La evidencia ya quedó registrada. | You can close this window. The evidence is already recorded. | Puoi chiudere questa finestra. La prova è già stata registrata. |
| `operaciones2.ot.costo.negativo` | El costo no puede ser negativo | The cost cannot be negative | Il costo non può essere negativo |
| `operaciones2.ot.costo.aviso-sin` | Esta OT no tiene costo capturado. Si la cierras, ya no podrás registrarlo después: el reporte de rentabilidad usará la estimación por tipo de tarea. | This work order has no cost entered. If you close it, you won’t be able to record it later: the profitability report will use the per-type estimate. | Questo OdL non ha un costo inserito. Se lo chiudi, non potrai più registrarlo: il report di redditività userà la stima per tipo di attività. |
| `operaciones2.ot.costo.aviso-con` | Al cerrarla, el costo de {importe} queda fijo: ya no se podrá cambiar. | Once closed, the cost of {importe} is final: it can’t be changed. | Alla chiusura, il costo di {importe} resta fisso: non si potrà più modificare. |
| `operaciones2.ot.costo.cerrada-sin` | Se cerró sin costo capturado: el reporte de rentabilidad usa la estimación por tipo de tarea. | It was closed with no cost entered: the profitability report uses the per-type estimate. | Chiuso senza costo inserito: il report di redditività usa la stima per tipo di attività. |
| `operaciones2.ot.costo.cerrada-con` | Costo registrado: {importe}. La OT está cerrada y ya no se puede cambiar. | Recorded cost: {importe}. The work order is closed and can no longer be changed. | Costo registrato: {importe}. L’OdL è chiuso e non si può più modificare. |
| `operaciones2.creativos.descripcion` | Sube y aprueba las imágenes de cada campaña, y asigna cuál va en cada slot reservado. | Upload and approve each campaign’s images, and assign which one goes in each booked slot. | Carica e approva le immagini di ogni campagna, e assegna quale va in ogni slot prenotato. |
| `operaciones2.creativos.kpi.por-aprobar` | Por aprobar | Pending approval | Da approvare |
| `operaciones2.creativos.kpi.frenan` | frenan la publicación | holding back publishing | bloccano la pubblicazione |
| `operaciones2.creativos.kpi.aprobados` | Aprobados | Approved | Approvate |
| `operaciones2.creativos.kpi.listos` | listos para asignar | ready to assign | pronte da assegnare |
| `operaciones2.creativos.kpi.rechazados` | Rechazados | Rejected | Rifiutate |
| `operaciones2.creativos.kpi.reemplazar` | hay que reemplazarlos | they need to be replaced | vanno sostituite |
| `operaciones2.creativos.kpi.sin-creativo` | Spots sin creativo | Slots with no creative | Spot senza creatività |
| `operaciones2.creativos.kpi.de-spots.uno` | de {n} spot reservado | of {n} booked slot | su {n} spot prenotato |
| `operaciones2.creativos.kpi.de-spots.otros` | de {n} spots reservados | of {n} booked slots | su {n} spot prenotati |
| `operaciones2.creativos.buscar` | Buscar por campaña, folio, cliente o nombre del creativo… | Search by campaign, internal ref., client or creative name… | Cerca per campagna, rif. interno, cliente o nome della creatività… |
| `operaciones2.creativos.filtro.todos` | Todos los creativos | All creatives | Tutte le creatività |
| `operaciones2.creativos.filtro.pendientes` | Con pendientes de aprobar | With creatives pending approval | Con creatività da approvare |
| `operaciones2.creativos.filtro.aprobados` | Con aprobados | With approved creatives | Con creatività approvate |
| `operaciones2.creativos.filtro.rechazados` | Con rechazados | With rejected creatives | Con creatività rifiutate |
| `operaciones2.creativos.filtro.sin` | Sin creativos todavía | No creatives yet | Ancora senza creatività |
| `operaciones2.creativos.vacio.sin-digitales` | Ninguna campaña tiene pantallas digitales | No campaign has digital screens | Nessuna campagna ha schermi digitali |
| `operaciones2.creativos.vacio.sin-digitales-detalle.uno` | Aquí solo se gestionan los creativos de pantallas digitales. Tus {n} campaña son de medios fijos: su arte se lleva en Imprenta. | Only creatives for digital screens are managed here. You have {n} campaign and it is on static media: its artwork is handled in Printing. | Qui si gestiscono solo le creatività degli schermi digitali. Hai {n} campagna, su mezzi statici: la sua grafica si gestisce in Stampa. |
| `operaciones2.creativos.vacio.sin-digitales-detalle.otros` | Aquí solo se gestionan los creativos de pantallas digitales. Tus {n} campañas son de medios fijos: su arte se lleva en Imprenta. | Only creatives for digital screens are managed here. Your {n} campaigns are on static media: their artwork is handled in Printing. | Qui si gestiscono solo le creatività degli schermi digitali. Hai {n} campagne, tutte su mezzi statici: la loro grafica si gestisce in Stampa. |
| `operaciones2.creativos.vacio.ir-imprenta` | Ir a Imprenta | Go to Printing | Vai a Stampa |
| `operaciones2.creativos.vacio.sin-campanas` | Sin campañas con slots o creativos | No campaigns with slots or creatives | Nessuna campagna con slot o creatività |
| `operaciones2.creativos.vacio.sin-campanas-detalle` | Reserva sitios en Comercial o sube un creativo para gestionarlos aquí. | Book sites in Sales or upload a creative to manage them here. | Prenota siti in Vendite o carica una creatività per gestirli qui. |
| `operaciones2.creativos.vacio.ninguna` | Ninguna campaña coincide | No campaign matches | Nessuna campagna corrisponde |
| `operaciones2.creativos.vacio.ninguna-detalle` | Prueba con otro texto de búsqueda o quita el filtro de estado. | Try a different search or remove the status filter. | Prova con un altro testo di ricerca o togli il filtro di stato. |
| `operaciones2.creativos.limpiar` | Limpiar filtros | Clear filters | Cancella filtri |
| `operaciones2.creativos.imagen-supera` | La imagen supera {mb} MB | The image exceeds {mb} MB | L’immagine supera {mb} MB |
| `operaciones2.creativos.no-subir` | No se pudo subir | Could not upload | Impossibile caricare |
| `operaciones2.creativos.no-guardar` | No se pudo guardar | Could not save | Impossibile salvare |
| `operaciones2.creativos.motivo-rechazo` | Motivo de rechazo (opcional): | Reason for rejection (optional): | Motivo del rifiuto (facoltativo): |
| `operaciones2.creativos.no-validar` | No se pudo validar | Could not save the review | Impossibile convalidare |
| `operaciones2.creativos.retirado-doohmain` | “{nombre}” se retiró. Su arte sigue en DOOHmain — quítalo en su panel | “{nombre}” was withdrawn. Its artwork is still in DOOHmain — remove it in its panel | «{nombre}» è stata ritirata. La sua grafica resta in DOOHmain — rimuovila dal suo pannello |
| `operaciones2.creativos.eliminado` | “{nombre}” se eliminó | “{nombre}” was deleted | «{nombre}» è stata eliminata |
| `operaciones2.creativos.no-eliminar` | No se pudo eliminar | Could not delete | Impossibile eliminare |
| `operaciones2.creativos.reemplazado-doohmain` | Arte reemplazado. En DOOHmain el anterior ya no se reproduce, pero sigue en la lista: elimina la campaña anterior en su panel (la que aparece como finalizada). Aprueba el nuevo para publicarlo. | Artwork replaced. In DOOHmain the previous one no longer plays, but it is still on the list: delete the previous campaign from its panel (the one shown as finished). Approve the new one to publish it. | Grafica sostituita. In DOOHmain la precedente non viene più riprodotta, ma resta nell’elenco: elimina la campagna precedente dal suo pannello (quella che risulta conclusa). Approva la nuova per pubblicarla. |
| `operaciones2.creativos.reemplazado` | Arte reemplazado. Apruébalo de nuevo para publicarlo. | Artwork replaced. Approve it again to publish it. | Grafica sostituita. Approvala di nuovo per pubblicarla. |
| `operaciones2.creativos.no-reemplazar` | No se pudo reemplazar | Could not replace | Impossibile sostituire |
| `operaciones2.creativos.no-asignar` | No se pudo asignar | Could not assign | Impossibile assegnare |
| `operaciones2.creativos.chip.por-aprobar` | {n} por aprobar | {n} pending approval | {n} da approvare |
| `operaciones2.creativos.chip.spots-con` | {con}/{total} spots con creativo | {con}/{total} slots with a creative | {con}/{total} spot con creatività |
| `operaciones2.creativos.imagen` | Imagen | Image | Immagine |
| `operaciones2.creativos.codigo` | Código | Code | Codice |
| `operaciones2.creativos.nombre` | Nombre del creativo | Creative name | Nome della creatività |
| `operaciones2.creativos.codigo-ej` | Pega aquí el código del creativo (HTML/UTF)… | Paste the creative’s code here (HTML/UTF)… | Incolla qui il codice della creatività (HTML/UTF)… |
| `operaciones2.creativos.guardar-codigo` | Guardar código | Save code | Salva codice |
| `operaciones2.creativos.lista` | Creativos ({n}) | Creatives ({n}) | Creatività ({n}) |
| `operaciones2.creativos.sin-creativos` | Sin creativos. Sube una imagen para aprobarla. | No creatives. Upload an image to approve it. | Nessuna creatività. Carica un’immagine per approvarla. |
| `operaciones2.creativos.etiqueta-codigo` | código | code | codice |
| `operaciones2.creativos.retirado-title` | Retirado del sistema; su arte sigue en DOOHmain (quítalo en su panel) | Withdrawn from the system; its artwork is still in DOOHmain (remove it in its panel) | Ritirata dal sistema; la sua grafica resta in DOOHmain (rimuovila dal suo pannello) |
| `operaciones2.creativos.retirado` | Retirado · pendiente en DOOHmain | Withdrawn · pending in DOOHmain | Ritirata · in sospeso in DOOHmain |
| `operaciones2.creativos.ver-html` | Ver HTML | View HTML | Vedi HTML |
| `operaciones2.creativos.ya-aprobado` | El creativo ya fue aprobado — reemplázalo o elimínalo para cambiarlo | This creative is already approved — replace or delete it to change it | La creatività è già stata approvata — sostituiscila o eliminala per cambiarla |
| `operaciones2.creativos.aprobar` | Aprobar | Approve | Approva |
| `operaciones2.creativos.rechazar` | Rechazar | Reject | Rifiuta |
| `operaciones2.creativos.reemplazar-de` | Reemplazar el arte de {nombre} | Replace the artwork of {nombre} | Sostituisci la grafica di {nombre} |
| `operaciones2.creativos.reemplazar` | Reemplazar el arte | Replace the artwork | Sostituisci la grafica |
| `operaciones2.creativos.eliminar-de` | Eliminar {nombre} | Delete {nombre} | Elimina {nombre} |
| `operaciones2.creativos.eliminar` | Eliminar | Delete | Elimina |
| `operaciones2.creativos.slots` | Slots reservados ({n}) | Booked slots ({n}) | Slot prenotati ({n}) |
| `operaciones2.creativos.sin-slots` | Sin slots reservados todavía. | No booked slots yet. | Ancora nessuno slot prenotato. |
| `operaciones2.creativos.sitio` | Sitio | Site | Sito |
| `operaciones2.creativos.sin-creativo` | Sin creativo | No creative | Nessuna creatività |
| `operaciones2.creativos.rotan.uno` | 1 creativo | 1 creative | 1 creatività |
| `operaciones2.creativos.rotan.otros` | {n} creativos rotan | {n} creatives rotate | {n} creatività a rotazione |
| `operaciones2.creativos.aprueba-uno` | Aprueba un creativo para asignarlo aquí. | Approve a creative to assign it here. | Approva una creatività per assegnarla qui. |
| `operaciones2.creativos.del-sitio` | Creativo del sitio | Site creative | Creatività del sito |
| `operaciones2.creativos.aprueba-al-menos` | Aprueba al menos un creativo para poder asignarlo a los slots. | Approve at least one creative to be able to assign it to the slots. | Approva almeno una creatività per poterla assegnare agli slot. |
| `operaciones2.creativos.creativo` | Creativo | Creative | Creatività |
| `operaciones2.creativos.creativo-min` | creativo | creative | creatività |
| `operaciones2.creativos.fuente.cargando` | {formato} · cargando… | {formato} · loading… | {formato} · caricamento… |
| `operaciones2.creativos.fuente.caracteres` | {formato} · {n} caracteres | {formato} · {n} characters | {formato} · {n} caratteri |
| `operaciones2.creativos.descargar` | Descargar .html | Download .html | Scarica .html |
| `operaciones2.creativos.fuente.cargando-texto` | Cargando la fuente… | Loading the source… | Caricamento del sorgente… |
| `operaciones2.creativos.fuente.no-cargar` | No se pudo cargar la fuente de este creativo. | Could not load this creative’s source. | Impossibile caricare il sorgente di questa creatività. |
| `operaciones2.creativos.eliminar.titulo` | Eliminar creativo | Delete creative | Elimina creatività |
| `operaciones2.creativos.eliminar.si` | Sí, eliminar | Yes, delete | Sì, elimina |
| `operaciones2.creativos.eliminar.cuerpo` | ¿Seguro que quieres bajar {nombre}? Si ya está publicado, su campaña se finaliza, pero {arte} (su API no lo permite): quedará marcado como “pendiente en DOOHmain” para que lo quites en su panel. | Are you sure you want to take down {nombre}? If it is already published, its campaign in DOOHmain is ended, but {arte} (its API does not allow it): it will be marked as “pending in DOOHmain” so you can remove it from its panel. | Vuoi davvero ritirare {nombre}? Se è già pubblicata, la sua campagna viene conclusa, ma {arte} (la sua API non lo consente): resterà segnata come «in sospeso in DOOHmain» perché tu la rimuova dal suo pannello. |
| `operaciones2.creativos.eliminar.arte` | el arte no se puede quitar de DOOHmain | the artwork cannot be removed from DOOHmain | la grafica non si può rimuovere da DOOHmain |
| `operaciones2.creativos.reemplazo.elegir` | Elegir el arte nuevo | Choose the new artwork | Scegli la nuova grafica |
| `operaciones2.creativos.reemplazo.cuerpo` | Si {nombre} ya está publicado, al reemplazarlo {orden}: deja de reproducirse en todas sus pantallas. El nuevo queda pendiente hasta que lo apruebes. | If {nombre} is already published, replacing it {orden}: it stops playing on all its screens. The new one stays pending until you approve it. | Se {nombre} è già pubblicata, sostituendola {orden}: smette di essere riprodotta su tutti i suoi schermi. La nuova resta in sospeso finché non la approvi. |
| `operaciones2.creativos.reemplazo.orden` | se manda a DOOHmain la orden de bajar el arte anterior | sends DOOHmain the order to take down the previous artwork | si invia a DOOHmain l’ordine di ritirare la grafica precedente |
| `operaciones2.creativos.reemplazo.recordatorio` | {recordatorio} después entra al panel de DOOHmain y {elimina}. DOOHmain no deja borrarla desde aquí, y la nueva lleva el mismo nombre: la anterior es la que aparece como finalizada. | {recordatorio} afterwards, go to the DOOHmain panel and {elimina}. DOOHmain doesn’t let you delete it from here, and the new one has the same name: the previous one is the one shown as finished. | {recordatorio} poi entra nel pannello di DOOHmain ed {elimina}. DOOHmain non permette di cancellarla da qui, e la nuova ha lo stesso nome: la precedente è quella che risulta conclusa. |
| `operaciones2.creativos.reemplazo.recordatorio-etiqueta` | Recordatorio: | Reminder: | Promemoria: |
| `operaciones2.creativos.reemplazo.elimina` | elimina la campaña anterior | delete the previous campaign | elimina la campagna precedente |
| `operaciones2.creativos.estado.pendiente` | Pendiente | Pending | In sospeso |
| `operaciones2.creativos.estado.validada` | Aprobado | Approved | Approvata |
| `operaciones2.creativos.estado.rechazada` | Rechazado | Rejected | Rifiutata |

## Inventario · `textos/inventario.ts` · 360 claves

| clave | español | inglés | italiano |
|---|---|---|---|
| `inventario.titulo` | Inventario | Inventory | Inventario |
| `inventario.sin-permiso` | Esta sección es exclusiva del Dueño y del administrador. | This section is only for the Owner and the administrator. | Questa sezione è riservata al Titolare e all’amministratore. |
| `inventario.sub.lista` | Consulta el inventario completo, o agrega pantallas por carga masiva o alta manual. | Browse the full inventory, or add screens by bulk upload or manual entry. | Consulta l’inventario completo, o aggiungi impianti con caricamento massivo o inserimento manuale. |
| `inventario.sub.contrato` | Alta de una pantalla junto con su contrato de arrendamiento. | Add a screen together with its lease agreement. | Inserimento di un impianto insieme al suo contratto di locazione. |
| `inventario.sub.masiva` | Carga masiva de pantallas desde la plantilla de Excel. | Bulk upload of screens from the Excel template. | Caricamento massivo di impianti dal modello Excel. |
| `inventario.sub.manual` | Alta manual de una pantalla. | Manual entry of one screen. | Inserimento manuale di un impianto. |
| `inventario.via.contrato` | Contrato + pantalla | Contract + screen | Contratto + impianto |
| `inventario.via.masiva` | Carga masiva | Bulk upload | Caricamento massivo |
| `inventario.via.manual` | Alta manual | Manual entry | Inserimento manuale |
| `inventario.toast.contrato-creado` | Contrato y pantalla "{nombre}" creados | Contract and screen “{nombre}” created | Contratto e impianto «{nombre}» creati |
| `inventario.toast.pantalla-agregada` | Pantalla "{nombre}" agregada al inventario | Screen “{nombre}” added to the inventory | Impianto «{nombre}» aggiunto all’inventario |
| `inventario.toast.importado` | Inventario importado: {partes} | Inventory imported: {partes} | Inventario importato: {partes} |
| `inventario.toast.nuevas.uno` | {n} nueva | {n} new | {n} nuovo |
| `inventario.toast.nuevas.otros` | {n} nuevas | {n} new | {n} nuovi |
| `inventario.toast.actualizadas.uno` | {n} actualizada | {n} updated | {n} aggiornato |
| `inventario.toast.actualizadas.otros` | {n} actualizadas | {n} updated | {n} aggiornati |
| `inventario.toast.con-advertencias` | {n} con advertencias | {n} with warnings | {n} con avvisi |
| `inventario.toast.sin-cambios` | sin cambios | no changes | nessuna modifica |
| `inventario.indicadores` | Indicadores | Indicators | Indicatori |
| `inventario.kpi.pantallas` | Pantallas | Screens | Impianti |
| `inventario.kpi.medios` | {digitales} digitales · {fijas} fijas | {digitales} digital · {fijas} static | {digitales} digitali · {fijas} fissi |
| `inventario.kpi.disponibles` | Disponibles | Available | Disponibili |
| `inventario.kpi.disponibles.sub` | de {total} | of {total} | su {total} |
| `inventario.kpi.disponibles.sub-parciales` | de {total} · {n} con slots vendidos | of {total} · {n} with slots sold | su {total} · {n} con slot venduti |
| `inventario.kpi.sin-contrato` | Sin contrato | No contract | Senza contratto |
| `inventario.kpi.sin-contrato.sub` | captúralo en Arrendadores | add it in Landlords | inseriscilo in Locatori |
| `inventario.kpi.sin-contrato.ninguno` | todas tienen contrato o son propias | all have a contract or are owned | tutti hanno un contratto o sono di proprietà |
| `inventario.kpi.propias` | Propias | Owned | Di proprietà |
| `inventario.kpi.propias.sub` | sin renta: su costo es luz y operación | no rent: their only costs are electricity and operations | senza canone: il loro costo è elettricità e gestione |
| `inventario.disp.verde` | Disponible | Available | Disponibile |
| `inventario.disp.ambar` | Con slots vendidos | With slots sold | Con slot venduti |
| `inventario.disp.rojo` | Ocupada | Occupied | Occupato |
| `inventario.disp.neutro` | Fuera de venta o sin dato | Not for sale or no data | Fuori vendita o senza dati |
| `inventario.chips.disponibilidad` | Disponibilidad | Availability | Disponibilità |
| `inventario.chips.medio` | Medio | Medium | Mezzo |
| `inventario.chips.contrato` | Contrato | Contract | Contratto |
| `inventario.chips.con-contrato` | Con contrato | With contract | Con contratto |
| `inventario.chips.propia` | Propia | Owned | Di proprietà |
| `inventario.medio.digital` | Digital | Digital | Digitale |
| `inventario.medio.fija` | Fija | Static | Fisso |
| `inventario.disponibilidad.sin-slots` | Sin slots capturados | No slots entered | Nessuno slot inserito |
| `inventario.disponibilidad.sin-libres` | Sin slots libres | No free slots | Nessuno slot libero |
| `inventario.disponibilidad.libres` | {libres} de {total} libres | {libres} of {total} free | {libres} di {total} liberi |
| `inventario.disponibilidad.ocupado` | Ocupado | Occupied | Occupato |
| `inventario.disponibilidad.disponible` | Disponible | Available | Disponibile |
| `inventario.lote.base` | Este cambio es sensible: tu organización pide que vuelvas a identificarte. | This change is sensitive: your organization asks you to confirm your identity again. | Questa modifica è sensibile: la tua organizzazione chiede di identificarti di nuovo. |
| `inventario.lote.uno-uno` | {frase} Confirmar aplica SOLO la que falta; la que ya cambió no se vuelve a tocar. {base} | {frase} Confirming applies ONLY the one left; the one already changed is not touched again. {base} | {frase} Confermando si applica SOLO a quello mancante; quello già modificato non viene ritoccato. {base} |
| `inventario.lote.uno-otros` | {frase} Confirmar aplica SOLO la que falta; las {ya} que ya cambiaron no se vuelven a tocar. {base} | {frase} Confirming applies ONLY the one left; the {ya} already changed are not touched again. {base} | {frase} Confermando si applica SOLO a quello mancante; i {ya} già modificati non vengono ritoccati. {base} |
| `inventario.lote.otros-uno` | {frase} Confirmar aplica SOLO las {faltan} que faltan; la que ya cambió no se vuelve a tocar. {base} | {frase} Confirming applies ONLY the {faltan} left; the one already changed is not touched again. {base} | {frase} Confermando si applica SOLO ai {faltan} mancanti; quello già modificato non viene ritoccato. {base} |
| `inventario.lote.otros-otros` | {frase} Confirmar aplica SOLO las {faltan} que faltan; las {ya} que ya cambiaron no se vuelven a tocar. {base} | {frase} Confirming applies ONLY the {faltan} left; the {ya} already changed are not touched again. {base} | {frase} Confermando si applica SOLO ai {faltan} mancanti; i {ya} già modificati non vengono ritoccati. {base} |
| `inventario.lote.frase` | Se aplicó en {ya} de {total} {unidad}; {faltan} sin cambiar. | Applied to {ya} of {total} {unidad}; {faltan} unchanged. | Applicato a {ya} di {total} {unidad}; {faltan} senza modifiche. |
| `inventario.lote.unidad.pantalla` | pantalla | screen | impianto |
| `inventario.lote.unidad.pantallas` | pantallas | screens | impianti |
| `inventario.lote.unidad.contrato` | contrato | contract | contratto |
| `inventario.lote.unidad.contratos` | contratos | contracts | contratti |
| `inventario.tabla.no-archivo` | No se pudo generar el archivo. Prueba a filtrar para descargar menos pantallas. | Could not generate the file. Try filtering to download fewer screens. | Impossibile generare il file. Prova a filtrare per scaricare meno impianti. |
| `inventario.tabla.cifra-ilegible` | La cifra no se entiende: la coma separa miles y el punto, decimales ({ejemplo}) | The figure can’t be read: the comma separates thousands and the period, decimals ({ejemplo}) | La cifra non si capisce: la virgola separa le migliaia e il punto i decimali ({ejemplo}) |
| `inventario.tabla.numero-valido` | Escribe un número válido | Enter a valid number | Scrivi un numero valido |
| `inventario.tabla.renta-negativa` | La renta no puede ser negativa | Rent can’t be negative | Il canone non può essere negativo |
| `inventario.tabla.tarifa-negativa` | La tarifa no puede ser negativa | The rate can’t be negative | La tariffa non può essere negativa |
| `inventario.tabla.fijar-tarifa-en` | fijar la tarifa en {monto} | set the rate to {monto} | fissare la tariffa a {monto} |
| `inventario.tabla.ajustar-tarifa` | ajustar la tarifa {pct}% | adjust the rate by {pct}% | adeguare la tariffa del {pct}% |
| `inventario.tabla.aplicar-pantallas.uno` | ¿Aplicar «{resumen}» a {n} pantalla? | Apply “{resumen}” to {n} screen? | Applicare «{resumen}» a {n} impianto? |
| `inventario.tabla.aplicar-pantallas.otros` | ¿Aplicar «{resumen}» a {n} pantallas? | Apply “{resumen}” to {n} screens? | Applicare «{resumen}» a {n} impianti? |
| `inventario.tabla.tarifa-actualizada.uno` | Tarifa actualizada en {n} pantalla | Rate updated on {n} screen | Tariffa aggiornata su {n} impianto |
| `inventario.tabla.tarifa-actualizada.otros` | Tarifa actualizada en {n} pantallas | Rate updated on {n} screens | Tariffa aggiornata su {n} impianti |
| `inventario.tabla.no-masivo` | No se pudo aplicar el cambio masivo | Could not apply the bulk change | Impossibile applicare la modifica massiva |
| `inventario.tabla.renta-mayor-cero` | La renta debe ser mayor que cero | Rent must be greater than zero | Il canone deve essere maggiore di zero |
| `inventario.tabla.sin-contrato-masivo` | Esas pantallas no tienen contrato todavía: captura la renta en Arrendadores. | Those screens don’t have a contract yet: enter the rent in Landlords. | Questi impianti non hanno ancora un contratto: inserisci il canone in Locatori. |
| `inventario.tabla.sin-importe-masivo` | No hay rentas que ajustar (las seleccionadas no tienen importe capturado). | There are no rents to adjust (the selected ones have no amount entered). | Non ci sono canoni da adeguare (quelli selezionati non hanno un importo inserito). |
| `inventario.tabla.fijar-renta-en` | fijar la renta en {monto} | set the rent to {monto} | fissare il canone a {monto} |
| `inventario.tabla.ajustar-renta` | ajustar la renta {pct}% | adjust the rent by {pct}% | adeguare il canone del {pct}% |
| `inventario.tabla.aplicar-contratos.uno` | ¿Aplicar «{resumen}» a {n} contrato? | Apply “{resumen}” to {n} contract? | Applicare «{resumen}» a {n} contratto? |
| `inventario.tabla.aplicar-contratos.otros` | ¿Aplicar «{resumen}» a {n} contratos? | Apply “{resumen}” to {n} contracts? | Applicare «{resumen}» a {n} contratti? |
| `inventario.tabla.alcance-extra.uno` | OJO: son contratos de predio compartidos. El cambio alcanza también a {n} pantalla que NO seleccionaste. | CAREFUL: these are shared property contracts. The change also reaches {n} screen you did NOT select. | ATTENZIONE: sono contratti di immobili condivisi. La modifica riguarda anche {n} impianto che NON hai selezionato. |
| `inventario.tabla.alcance-extra.otros` | OJO: son contratos de predio compartidos. El cambio alcanza también a {n} pantallas que NO seleccionaste. | CAREFUL: these are shared property contracts. The change also reaches {n} screens you did NOT select. | ATTENZIONE: sono contratti di immobili condivisi. La modifica riguarda anche {n} impianti che NON hai selezionato. |
| `inventario.tabla.omitir-sin-contrato.uno` | {n} pantalla sin contrato se omitirá. | {n} screen without a contract will be skipped. | {n} impianto senza contratto verrà escluso. |
| `inventario.tabla.omitir-sin-contrato.otros` | {n} pantallas sin contrato se omitirán. | {n} screens without a contract will be skipped. | {n} impianti senza contratto verranno esclusi. |
| `inventario.tabla.omitir-sin-importe.uno` | {n} contrato sin importe capturado se omitirá: no hay sobre qué aplicar el porcentaje. | {n} contract without an amount will be skipped: there is nothing to apply the percentage to. | {n} contratto senza importo inserito verrà escluso: non c’è nulla su cui applicare la percentuale. |
| `inventario.tabla.omitir-sin-importe.otros` | {n} contratos sin importe capturado se omitirán: no hay sobre qué aplicar el porcentaje. | {n} contracts without an amount will be skipped: there is nothing to apply the percentage to. | {n} contratti senza importo inserito verranno esclusi: non c’è nulla su cui applicare la percentuale. |
| `inventario.tabla.renta-actualizada.uno` | Renta actualizada en {n} contrato | Rent updated on {n} contract | Canone aggiornato in {n} contratto |
| `inventario.tabla.renta-actualizada.otros` | Renta actualizada en {n} contratos | Rent updated on {n} contracts | Canone aggiornato in {n} contratti |
| `inventario.tabla.no-masivo-renta` | No se pudo aplicar el cambio masivo de renta | Could not apply the bulk rent change | Impossibile applicare la modifica massiva del canone |
| `inventario.tabla.de` | {n} de {total} | {n} of {total} | {n} di {total} |
| `inventario.tabla.excel-title` | Descargar en Excel, con el mismo formato que la plantilla de carga | Download in Excel, in the same format as the upload template | Scarica in Excel, nello stesso formato del modello di caricamento |
| `inventario.tabla.csv-title` | Descargar en CSV, con el mismo formato que la plantilla de carga | Download in CSV, in the same format as the upload template | Scarica in CSV, nello stesso formato del modello di caricamento |
| `inventario.tabla.buscar` | Buscar pantalla, código, distrito… | Search screen, code, district… | Cerca impianto, codice, distretto… |
| `inventario.tabla.quitar-filtros` | Quitar filtros | Clear filters | Rimuovi filtri |
| `inventario.tabla.seleccionadas.uno` | {n} seleccionada | {n} selected | {n} selezionato |
| `inventario.tabla.seleccionadas.otros` | {n} seleccionadas | {n} selected | {n} selezionati |
| `inventario.tabla.tarifa` | Tarifa | Rate | Tariffa |
| `inventario.tabla.renta` | Renta | Rent | Canone |
| `inventario.tabla.fijar-renta` | Fijar renta | Set rent | Fissa canone |
| `inventario.tabla.fijar-tarifa` | Fijar tarifa | Set rate | Fissa tariffa |
| `inventario.tabla.ajustar` | Ajustar % | Adjust (%) | Adegua % |
| `inventario.tabla.ph-ajuste` | p. ej. 10 o -5 | e.g. 10 or -5 | es. 10 o -5 |
| `inventario.tabla.ph-renta` | Nueva renta | New rent | Nuovo canone |
| `inventario.tabla.ph-tarifa` | Nueva tarifa | New rate | Nuova tariffa |
| `inventario.tabla.aplicando` | Aplicando… | Applying… | Applicazione… |
| `inventario.tabla.aplicar` | Aplicar | Apply | Applica |
| `inventario.tabla.limpiar` | Limpiar | Clear | Deseleziona |
| `inventario.tabla.seleccionar-todo` | Seleccionar todo | Select all | Seleziona tutto |
| `inventario.tabla.col.pantalla` | Pantalla | Screen | Impianto |
| `inventario.tabla.col.tipo` | Tipo | Type | Tipo |
| `inventario.tabla.col.ubicacion` | Ubicación | Location | Posizione |
| `inventario.tabla.col.medio` | Medio | Medium | Mezzo |
| `inventario.tabla.col.disponibilidad` | Disponibilidad | Availability | Disponibilità |
| `inventario.tabla.col.arrendador` | Arrendador | Landlord | Locatore |
| `inventario.tabla.vacio.busqueda` | Ningún sitio coincide con «{q}». | No sites match “{q}”. | Nessun sito corrisponde a «{q}». |
| `inventario.tabla.vacio.busqueda-filtros` | Ningún sitio coincide con «{q}» y los filtros elegidos. | No sites match “{q}” and the chosen filters. | Nessun sito corrisponde a «{q}» e ai filtri scelti. |
| `inventario.tabla.vacio.filtros` | Ninguna pantalla coincide con los filtros elegidos. | No screens match the chosen filters. | Nessun impianto corrisponde ai filtri scelti. |
| `inventario.tabla.vacio.inventario` | Todavía no hay pantallas en el inventario. Agrégalas una a una o por carga masiva. | There are no screens in the inventory yet. Add them one by one or by bulk upload. | Non ci sono ancora impianti nell’inventario. Aggiungili uno alla volta o con caricamento massivo. |
| `inventario.tabla.doohmain-title` | Id en DOOHmain: {id} | DOOHmain ID: {id} | ID in DOOHmain: {id} |
| `inventario.tabla.doohmain-title-servidor` | Id en DOOHmain: {id} (lo pone el servidor; no está escrito en la ficha) | DOOHmain ID: {id} (set by the server; not written in the profile) | ID in DOOHmain: {id} (lo imposta il server; non è scritto nella scheda) |
| `inventario.tabla.doohmain-servidor` | ␣· servidor | ␣· server | ␣· server |
| `inventario.tabla.confirma` | Confirma con tu contraseña | Confirm with your password | Conferma con la tua password |
| `inventario.tabla.confirmar-aplicar` | Confirmar y aplicar | Confirm and apply | Conferma e applica |
| `inventario.renta.ilegible` | La renta no se entiende: no se guardó. La coma separa miles y el punto, decimales. | The rent can’t be read: it wasn’t saved. The comma separates thousands and the period, decimals. | Il canone non si capisce: non è stato salvato. La virgola separa le migliaia e il punto i decimali. |
| `inventario.renta.compartida-confirm` | Esta renta es del contrato del predio y la comparten {n} pantallas. Cambiarla a {monto} aplica a todas. ¿Continuar? | This rent belongs to the property’s contract and is shared by {n} screens. Changing it to {monto} applies to all of them. Continue? | Questo canone è del contratto dell’immobile ed è condiviso da {n} impianti. Cambiarlo a {monto} vale per tutti. Continuare? |
| `inventario.renta.predio-actualizada` | Renta del predio actualizada ({n} pantallas) | Property rent updated ({n} screens) | Canone dell’immobile aggiornato ({n} impianti) |
| `inventario.renta.actualizada` | Renta de "{nombre}" actualizada | Rent for “{nombre}” updated | Canone di «{nombre}» aggiornato |
| `inventario.renta.no-actualizar` | No se pudo actualizar la renta | Could not update the rent | Impossibile aggiornare il canone |
| `inventario.renta.sensible` | Cambiar la renta de "{nombre}" es un cambio sensible: tu organización pide que vuelvas a identificarte. | Changing the rent for “{nombre}” is a sensitive change: your organization asks you to confirm your identity again. | Cambiare il canone di «{nombre}» è una modifica sensibile: la tua organizzazione chiede di identificarti di nuovo. |
| `inventario.renta.title-compartida` | Renta del contrato del predio — la comparten {n} pantallas | Property contract rent — shared by {n} screens | Canone del contratto dell’immobile — condiviso da {n} impianti |
| `inventario.renta.title` | Editar la renta que se le paga al arrendador | Edit the rent paid to the landlord | Modifica il canone pagato al locatore |
| `inventario.tarifa.ilegible` | La tarifa no se entiende: no se guardó. La coma separa miles y el punto, decimales. | The rate can’t be read: it wasn’t saved. The comma separates thousands and the period, decimals. | La tariffa non si capisce: non è stata salvata. La virgola separa le migliaia e il punto i decimali. |
| `inventario.tarifa.actualizada` | Tarifa de "{nombre}" actualizada | Rate for “{nombre}” updated | Tariffa di «{nombre}» aggiornata |
| `inventario.tarifa.no-actualizar` | No se pudo actualizar la tarifa | Could not update the rate | Impossibile aggiornare la tariffa |
| `inventario.tarifa.sensible` | Cambiar la tarifa de "{nombre}" es un cambio sensible: tu organización pide que vuelvas a identificarte. | Changing the rate for “{nombre}” is a sensitive change: your organization asks you to confirm your identity again. | Cambiare la tariffa di «{nombre}» è una modifica sensibile: la tua organizzazione chiede di identificarti di nuovo. |
| `inventario.tarifa.title` | Editar tarifa | Edit rate | Modifica tariffa |
| `inventario.propia.title` | Pantalla propia: sin renta ni contrato; su costo es luz y operación | Owned screen: no rent or contract; its costs are electricity and operations | Impianto di proprietà: senza canone né contratto; il suo costo è elettricità e gestione |
| `inventario.sin-arrendador` | Sin arrendador | No landlord | Senza locatore |
| `inventario.sin-arrendador.opcion` | — Sin arrendador — | — No landlord — | — Senza locatore — |
| `inventario.arrendador.actualizado` | Arrendador actualizado en "{nombre}" | Landlord updated on “{nombre}” | Locatore aggiornato in «{nombre}» |
| `inventario.arrendador.quitado` | Arrendador quitado de "{nombre}" | Landlord removed from “{nombre}” | Locatore rimosso da «{nombre}» |
| `inventario.arrendador.no-actualizar` | No se pudo actualizar el arrendador | Could not update the landlord | Impossibile aggiornare il locatore |
| `inventario.arrendador.sensible` | Cambiar el arrendador de "{nombre}" es un cambio sensible: decide a quién se le paga la renta, así que tu organización pide que vuelvas a identificarte. | Changing the landlord of “{nombre}” is a sensitive change: it decides who the rent is paid to, so your organization asks you to confirm your identity again. | Cambiare il locatore di «{nombre}» è una modifica sensibile: decide a chi si paga il canone, quindi la tua organizzazione chiede di identificarti di nuovo. |
| `inventario.arrendador.asignar` | Asignar arrendador | Assign landlord | Assegna locatore |
| `inventario.wizard.paso.arrendador` | Arrendador y predio | Landlord and property | Locatore e immobile |
| `inventario.wizard.paso.contrato` | Contrato | Contract | Contratto |
| `inventario.wizard.paso.pantalla` | Pantalla | Screen | Impianto |
| `inventario.tipo.espectacular` | Espectacular | Billboard | Cartellone |
| `inventario.tipo.pantalla-digital` | Pantalla digital | Digital screen | Schermo digitale |
| `inventario.tipo.muro` | Muro | Wall | Muro |
| `inventario.tipo.valla` | Valla | Poster panel | Poster |
| `inventario.tipo.mobiliario` | Mobiliario urbano | Street furniture | Arredo urbano |
| `inventario.tipo.mobiliario-detalle` | Mobiliario urbano (parabús/mupi/publitienda) | Street furniture (bus shelter/mupi/store display) | Arredo urbano (pensiline/mupi/espositori nei negozi) |
| `inventario.tipo.puente` | Puente | Bridge | Ponte |
| `inventario.tipo.otro` | Otro | Other | Altro |
| `inventario.wizard.renta-ilegible` | La renta no se entiende: la coma separa miles y el punto, decimales ({ejemplo}). | The rent can’t be read: the comma separates thousands and the period, decimals ({ejemplo}). | Il canone non si capisce: la virgola separa le migliaia e il punto i decimali ({ejemplo}). |
| `inventario.wizard.fin-antes` | La fecha de fin no puede ser anterior a la de inicio. | The end date cannot be earlier than the start date. | La data di fine non può essere precedente a quella di inizio. |
| `inventario.wizard.arrendado-hasta` | Ese espacio estuvo arrendado hasta el {fin}. El contrato nuevo debe empezar el {desde} o después. | That space was leased until {fin}. The new contract must start on {desde} or later. | Quello spazio è stato in locazione fino al {fin}. Il nuovo contratto deve iniziare il {desde} o dopo. |
| `inventario.wizard.renta-negativa` | Captura la renta (no negativa). | Enter the rent (not negative). | Inserisci il canone (non negativo). |
| `inventario.wizard.pdf-tipo` | El documento debe ser un PDF | The document must be a PDF | Il documento deve essere un PDF |
| `inventario.wizard.pdf-tamano` | El PDF supera 8 MB | The PDF is over 8 MB | Il PDF supera 8 MB |
| `inventario.wizard.pdf-leer` | No se pudo leer el PDF | Could not read the PDF | Impossibile leggere il PDF |
| `inventario.wizard.ok.predio` | Pantalla agregada al predio | Screen added to the property | Impianto aggiunto all’immobile |
| `inventario.wizard.ok.asignada` | Contrato creado y pantalla asignada | Contract created and screen assigned | Contratto creato e impianto assegnato |
| `inventario.wizard.ok.creados` | Contrato y pantalla creados | Contract and screen created | Contratto e impianto creati |
| `inventario.wizard.no-crear` | No se pudo crear el contrato | Could not create the contract | Impossibile creare il contratto |
| `inventario.wizard.p1.intro` | ¿A quién le rentas este espacio? Elige el arrendador ya registrado o da de alta uno nuevo. | Who are you renting this space from? Choose a registered landlord or add a new one. | Da chi prendi in locazione questo spazio? Scegli un locatore già registrato o aggiungine uno nuovo. |
| `inventario.wizard.existente` | Existente | Existing | Esistente |
| `inventario.wizard.nuevo` | Nuevo | New | Nuovo |
| `inventario.wizard.arrendador` | Arrendador | Landlord | Locatore |
| `inventario.wizard.selecciona` | — Selecciona — | — Select — | — Seleziona — |
| `inventario.wizard.sin-arrendadores` | No hay arrendadores aún. Cambia a “Nuevo” para dar de alta uno. | No landlords yet. Switch to “New” to add one. | Non ci sono ancora locatori. Passa a «Nuovo» per registrarne uno. |
| `inventario.wizard.nombre-razon` | Nombre / razón social | Name / legal name | Nome / ragione sociale |
| `inventario.wizard.rfc` | RFC | RFC (tax ID) | RFC |
| `inventario.wizard.telefono` | Teléfono | Phone | Telefono |
| `inventario.wizard.correo` | Correo | Email | Email |
| `inventario.wizard.p1.predio` | ¿Qué predio se renta? El contrato y la renta pertenecen al predio: si varias pantallas están en el mismo predio, elige el que ya existe y la renta se reparte entre ellas. | Which property is rented? The contract and the rent belong to the property: if several screens are on the same property, choose the existing one and the rent is split among them. | Quale immobile si prende in locazione? Il contratto e il canone appartengono all’immobile: se più impianti sono nello stesso immobile, scegli quello che esiste già e il canone si ripartisce tra loro. |
| `inventario.wizard.predio-existente` | Predio existente | Existing property | Immobile esistente |
| `inventario.wizard.predio-nuevo` | Predio nuevo | New property | Nuovo immobile |
| `inventario.wizard.predio` | Predio | Property | Immobile |
| `inventario.wizard.predio-con-contrato` | Este predio ya tiene un contrato vigente de {monto} ({periodicidad}). No se firma otro: la pantalla se agrega al predio y comparte esa renta con las demás. Para cambiar la renta, edita el contrato. | This property already has an active contract of {monto} ({periodicidad}). No other one is signed: the screen is added to the property and shares that rent with the others. To change the rent, edit the contract. | Questo immobile ha già un contratto in vigore di {monto} ({periodicidad}). Non se ne firma un altro: l’impianto si aggiunge all’immobile e condivide quel canone con gli altri. Per cambiare il canone, modifica il contratto. |
| `inventario.wizard.importe-por-definir` | importe por definir | amount to be defined | importo da definire |
| `inventario.wizard.nombre-predio` | Nombre del predio | Property name | Nome dell’immobile |
| `inventario.wizard.direccion-predio` | Dirección del predio | Property address | Indirizzo dell’immobile |
| `inventario.wizard.direccion-predio-ph` | Se toma la de la pantalla si lo dejas vacío | The screen’s address is used if you leave it empty | Si usa quello dell’impianto se lo lasci vuoto |
| `inventario.wizard.p2.intro` | Condiciones del arrendamiento. {pasadas} para registrar contratos ya firmados. | Lease terms. {pasadas} to record contracts that are already signed. | Condizioni della locazione. {pasadas} per registrare contratti già firmati. |
| `inventario.wizard.p2.pasadas` | Puedes usar fechas pasadas | You can use past dates | Puoi usare date passate |
| `inventario.wizard.inicio-vigencia` | Inicio de vigencia | Start date | Inizio validità |
| `inventario.wizard.fin-vigencia` | Fin de vigencia | End date | Fine validità |
| `inventario.wizard.historial` | Este espacio estuvo arrendado hasta el {fin}. El contrato nuevo empieza el {desde} o después. | This space was leased until {fin}. The new contract starts on {desde} or later. | Questo spazio è stato in locazione fino al {fin}. Il nuovo contratto inizia il {desde} o dopo. |
| `inventario.wizard.no-antes-inicio` | No puede ser anterior al inicio | Can’t be earlier than the start | Non può essere precedente all’inizio |
| `inventario.wizard.renta` | Renta | Rent | Canone |
| `inventario.wizard.cifra` | No se entiende la cifra | The figure can’t be read | La cifra non si capisce |
| `inventario.wizard.periodicidad` | Periodicidad del pago | Payment frequency | Periodicità del pagamento |
| `inventario.wizard.renovacion` | Renovación automática | Automatic renewal | Rinnovo automatico |
| `inventario.wizard.documento` | Documento del contrato (PDF) | Contract document (PDF) | Documento del contratto (PDF) |
| `inventario.wizard.quitar` | Quitar | Remove | Rimuovi |
| `inventario.wizard.adjuntar-pdf` | Adjuntar PDF del contrato firmado (máx. 8 MB) | Attach the signed contract PDF (max. 8 MB) | Allega il PDF del contratto firmato (max 8 MB) |
| `inventario.wizard.p3.intro` | ¿Qué pantalla ampara este contrato? Si ya está en tu inventario, elígela y no captures nada: se le asigna el arrendador y el predio. | Which screen does this contract cover? If it’s already in your inventory, choose it and don’t enter anything: the landlord and the property are assigned to it. | Quale impianto copre questo contratto? Se è già nel tuo inventario, sceglilo e non inserire nulla: gli si assegnano il locatore e l’immobile. |
| `inventario.wizard.del-inventario` | Del inventario | From inventory | Dall’inventario |
| `inventario.wizard.pantalla-nueva` | Pantalla nueva | New screen | Nuovo impianto |
| `inventario.wizard.pantalla-libres` | Pantalla ({n} sin arrendador) | Screen ({n} without landlord) | Impianto ({n} senza locatore) |
| `inventario.wizard.pantalla-historial` | Esta pantalla estuvo arrendada hasta el {fin}. La vigencia que capturaste empieza el {inicio}: regresa al paso 2 y muévela al {desde} o después. | This screen was leased until {fin}. The term you entered starts on {inicio}: go back to step 2 and move it to {desde} or later. | Questo impianto è stato in locazione fino al {fin}. La validità che hai inserito inizia il {inicio}: torna al passo 2 e spostala al {desde} o dopo. |
| `inventario.wizard.todas-asignadas` | Todas tus pantallas ya están asignadas a un predio. Cambia a “Pantalla nueva”. | All your screens are already assigned to a property. Switch to “New screen”. | Tutti i tuoi impianti sono già assegnati a un immobile. Passa a «Nuovo impianto». |
| `inventario.wizard.datos-que-tiene` | Datos que ya tiene | Data it already has | Dati che ha già |
| `inventario.wizard.caras` | Caras | Faces | Facce |
| `inventario.wizard.tarifa-publicada` | Tarifa publicada | Published rate | Tariffa pubblicata |
| `inventario.wizard.direccion` | Dirección | Address | Indirizzo |
| `inventario.wizard.se-ligara` | Se ligará al predio del contrato. Para cambiar estos datos, edita la pantalla en Inventario. | It will be linked to the contract’s property. To change this data, edit the screen in Inventory. | Verrà collegato all’immobile del contratto. Per cambiare questi dati, modifica l’impianto in Inventario. |
| `inventario.wizard.nombre-pantalla` | Nombre de la pantalla | Screen name | Nome dell’impianto |
| `inventario.wizard.tipo-medio` | Tipo de medio | Media type | Tipo di mezzo |
| `inventario.wizard.distrito` | Distrito / alcaldía | District / borough | Distretto / municipio |
| `inventario.wizard.ciudad` | Ciudad | City | Città |
| `inventario.wizard.slots` | Slots (digital) | Slots (digital screen) | Slot (digitale) |
| `inventario.wizard.duracion-slot` | Duración por slot (s) | Slot length (s) | Durata per slot (s) |
| `inventario.wizard.resumen.solo-pantalla` | La pantalla “{nombre}” se agregará al predio, que ya tiene contrato vigente. Su renta se repartirá entre las pantallas del predio. | The screen “{nombre}” will be added to the property, which already has an active contract. Its rent will be split among the property’s screens. | L’impianto «{nombre}» verrà aggiunto all’immobile, che ha già un contratto in vigore. Il suo canone si ripartirà tra gli impianti dell’immobile. |
| `inventario.wizard.resumen.asignar` | Se creará el contrato ({inicio} → {fin}, renta {monto} {periodicidad}) y se asignará la pantalla “{nombre}”, todo vinculado al arrendador. | The contract will be created ({inicio} → {fin}, rent {monto} {periodicidad}) and the screen “{nombre}” will be assigned, all linked to the landlord. | Verrà creato il contratto ({inicio} → {fin}, canone {monto} {periodicidad}) e verrà assegnato l’impianto «{nombre}», tutto collegato al locatore. |
| `inventario.wizard.resumen.crear` | Se creará el contrato ({inicio} → {fin}, renta {monto} {periodicidad}) y se creará la pantalla “{nombre}”, todo vinculado al arrendador. | The contract will be created ({inicio} → {fin}, rent {monto} {periodicidad}) and the screen “{nombre}” will be created, all linked to the landlord. | Verrà creato il contratto ({inicio} → {fin}, canone {monto} {periodicidad}) e verrà creato l’impianto «{nombre}», tutto collegato al locatore. |
| `inventario.wizard.atras` | Atrás | Back | Indietro |
| `inventario.wizard.siguiente` | Siguiente | Next | Avanti |
| `inventario.wizard.creando` | Creando… | Creating… | Creazione… |
| `inventario.wizard.confirmar-crear` | Confirmar y crear | Confirm and create | Conferma e crea |
| `inventario.wizard.crear` | Crear contrato y pantalla | Create contract and screen | Crea contratto e impianto |
| `inventario.alta.estado.disponible` | Disponible | Available | Disponibile |
| `inventario.alta.estado.ocupada` | Ocupada | Occupied | Occupato |
| `inventario.alta.estado.mantenimiento` | Mantenimiento | Maintenance | Manutenzione |
| `inventario.alta.modalidad.mensual` | Mensual | Monthly | Mensile |
| `inventario.alta.modalidad.catorcenal` | Catorcenal | Every two weeks | Ogni due settimane |
| `inventario.alta.imagen-tamano` | La imagen supera 5MB | The image is over 5MB | L’immagine supera 5MB |
| `inventario.alta.imagen-leer` | No se pudo leer la imagen | Could not read the image | Impossibile leggere l’immagine |
| `inventario.alta.falta-admobilize` | ID AdMobilize requerido (pestaña IA/Vision) | AdMobilize ID required (AI/Vision tab) | ID AdMobilize obbligatorio (scheda IA/Vision) |
| `inventario.alta.falta-imagen` | Imagen obligatoria (pestaña Imágenes) | Image required (Images tab) | Immagine obbligatoria (scheda Immagini) |
| `inventario.alta.falta-basico` | Faltan datos obligatorios (pestaña Básico) | Required fields missing (Basics tab) | Mancano dati obbligatori (scheda Base) |
| `inventario.alta.falta-ubicacion` | Latitud y longitud obligatorias (pestaña Ubicación) | Latitude and longitude required (Location tab) | Latitudine e longitudine obbligatorie (scheda Posizione) |
| `inventario.alta.cifra-roja` | Hay una cifra en rojo que no se entiende (renta, tarifa, precio por m² o slots) | There is a figure in red that can’t be read (rent, rate, price per m² or slots) | C’è una cifra in rosso che non si capisce (canone, tariffa, prezzo per m² o slot) |
| `inventario.alta.guardar` | Guardar pantalla | Save screen | Salva impianto |
| `inventario.alta.tab.basico` | Básico | Basics | Base |
| `inventario.alta.tab.specs` | Especificaciones | Specifications | Specifiche |
| `inventario.alta.tab.ia` | IA/Vision | AI/Vision | IA/Vision |
| `inventario.alta.tab.precios` | Precios | Prices | Prezzi |
| `inventario.alta.tab.imagenes` | Imágenes | Images | Immagini |
| `inventario.alta.info-basica` | Información básica | Basic information | Informazioni di base |
| `inventario.alta.arrendador` | Arrendador (dueño del espacio) | Landlord (space owner) | Locatore (proprietario dello spazio) |
| `inventario.alta.elige-arrendador` | Elige un arrendador… | Choose a landlord… | Scegli un locatore… |
| `inventario.alta.renta` | Renta al arrendador | Rent to landlord | Canone al locatore |
| `inventario.alta.renta-ayuda` | Lo que se le paga al arrendador, no lo que se le cobra al cliente. Puedes dejarlo vacío y capturarlo después: el contrato queda pendiente en Arrendadores. | What is paid to the landlord, not what the client is charged. You can leave it empty and enter it later: the contract stays pending in Landlords. | Ciò che si paga al locatore, non ciò che si fa pagare al cliente. Puoi lasciarlo vuoto e inserirlo dopo: il contratto resta da completare in Locatori. |
| `inventario.alta.exhibicion` | Exhibición | Display | Esposizione |
| `inventario.alta.fija` | Fija (impresa) | Static (printed) | Fissa (stampata) |
| `inventario.alta.digital` | Digital (pantalla) | Digital (screen) | Digitale (schermo) |
| `inventario.alta.ayuda-digital` | Pantalla digital: se comercializa por slots (ver pestaña Especificaciones). | Digital screen: sold by slots (see the Specifications tab). | Schermo digitale: si vende a slot (vedi la scheda Specifiche). |
| `inventario.alta.ayuda-fija` | Pantalla fija: se imprime y se comercializa por periodo. | Static screen: printed and sold by period. | Impianto fisso: si stampa e si vende a periodo. |
| `inventario.alta.latitud` | Latitud | Latitude | Latitudine |
| `inventario.alta.longitud` | Longitud | Longitude | Longitudine |
| `inventario.alta.fuera-rango` | Coordenadas fuera de rango | Coordinates out of range | Coordinate fuori intervallo |
| `inventario.alta.tipo-pantalla` | Tipo de pantalla | Screen type | Tipo di impianto |
| `inventario.alta.estado` | Estado | Status | Stato |
| `inventario.alta.specs` | Especificaciones técnicas | Technical specifications | Specifiche tecniche |
| `inventario.alta.res-ancho` | Resolución ancho (px) | Resolution width (px) | Risoluzione larghezza (px) |
| `inventario.alta.res-alto` | Resolución alto (px) | Resolution height (px) | Risoluzione altezza (px) |
| `inventario.alta.modalidades` | Modalidades de contratación | Sales modes | Modalità di vendita |
| `inventario.alta.config-slots` | Configuración de slots | Slot setup | Configurazione degli slot |
| `inventario.alta.total-slots` | Total slots | Total slots | Slot totali |
| `inventario.alta.slots-disponibles` | Slots disponibles | Available slots | Slot disponibili |
| `inventario.alta.admobilize` | {marca} permite detectar y contabilizar vehículos y personas que pasan frente a la pantalla utilizando tecnología de Computer Vision. | {marca} detects and counts the vehicles and people passing in front of the screen using Computer Vision technology. | {marca} permette di rilevare e contare veicoli e persone che passano davanti allo schermo con la tecnologia Computer Vision. |
| `inventario.alta.cv` | Esta pantalla cuenta con tecnología de Computer Vision (IA) | This screen has Computer Vision (AI) technology | Questo schermo dispone di tecnologia Computer Vision (IA) |
| `inventario.alta.cv-ayuda` | Actívala si tu pantalla usa AdMobilize para el conteo de audiencia | Turn it on if your screen uses AdMobilize for audience counting | Attivala se il tuo schermo usa AdMobilize per il conteggio dell’audience |
| `inventario.alta.admobilize-id` | ID del dispositivo AdMobilize | AdMobilize device ID | ID del dispositivo AdMobilize |
| `inventario.alta.admobilize-id-ayuda` | Identificador único del dispositivo instalado en esta pantalla. | Unique identifier of the device installed on this screen. | Identificativo univoco del dispositivo installato su questo schermo. |
| `inventario.alta.deteccion-vivo` | Vista de detección en vivo | Live detection view | Vista del rilevamento in diretta |
| `inventario.alta.deteccion-previa` | Vista previa de la detección de vehículos y personas por Computer Vision. | Preview of vehicle and people detection by Computer Vision. | Anteprima del rilevamento di veicoli e persone con Computer Vision. |
| `inventario.alta.ver-ia` | Ver imagen de detección IA | View AI detection image | Vedi immagine del rilevamento IA |
| `inventario.alta.costo` | El costo de esta pantalla es la {renta}, que se captura en la pestaña {basico}. {estado} | The cost of this screen is the {renta}, which is entered in the {basico} tab. {estado} | Il costo di questo impianto è il {renta}, che si inserisce nella scheda {basico}. {estado} |
| `inventario.alta.costo-renta` | renta al arrendador | rent to the landlord | canone al locatore |
| `inventario.alta.costo-actual` | Actualmente: {n}. | Currently: {n}. | Attualmente: {n}. |
| `inventario.alta.costo-sin` | Aún sin capturar. | Not entered yet. | Non ancora inserito. |
| `inventario.alta.precio-m2` | Precio por m² (estáticas) | Price per m² (static) | Prezzo per m² (statici) |
| `inventario.alta.precio-m2-ph` | Se aplica a las estáticas del lote | Applied to the batch’s static screens | Si applica agli impianti statici del lotto |
| `inventario.alta.imagen` | Imagen promocional | Promotional image | Immagine promozionale |
| `inventario.alta.imagen-formato` | JPG o PNG · máximo 5MB | JPG or PNG · max. 5MB | JPG o PNG · massimo 5MB |
| `inventario.alta.cambiar-imagen` | Cambiar imagen | Change image | Cambia immagine |
| `inventario.alta.subir-imagen` | Subir imagen | Upload image | Carica immagine |
| `inventario.alta.ia-titulo` | Detección por Computer Vision | Computer Vision detection | Rilevamento con Computer Vision |
| `inventario.alta.ia-sub` | Vista de muestra del conteo de vehículos y personas (AdMobilize) | Sample view of vehicle and people counting (AdMobilize) | Vista di esempio del conteggio di veicoli e persone (AdMobilize) |
| `inventario.alta.ia-alt` | Detección de vehículos y personas por IA | AI detection of vehicles and people | Rilevamento di veicoli e persone con IA |
| `inventario.alta.ia-nota` | Las cajas y métricas (velocidad, conteo por zona) las genera el módulo de Computer Vision en tiempo real. | The boxes and metrics (speed, count by area) are generated by the Computer Vision module in real time. | I riquadri e le metriche (velocità, conteggio per zona) sono generati in tempo reale dal modulo di Computer Vision. |
| `inventario.alta.titulo` | Nueva pantalla | New screen | Nuovo impianto |
| `inventario.alta.sub` | Alta manual de una sola pantalla | Manual entry of a single screen | Inserimento manuale di un solo impianto |
| `inventario.carga.no-leer` | No se pudo leer el archivo. Verifica que sea .xlsx o .csv válido. | Could not read the file. Check that it is a valid .xlsx or .csv. | Impossibile leggere il file. Verifica che sia un .xlsx o .csv valido. |
| `inventario.carga.no-importar` | No se pudo importar | Could not import | Impossibile importare |
| `inventario.carga.falta-arrendador` | Falta elegir el arrendador | Choose the landlord | Manca la scelta del locatore |
| `inventario.carga.filas.uno` | {n} filas leídas | {n} row read | {n} riga letta |
| `inventario.carga.filas.otros` | {n} filas leídas | {n} rows read | {n} righe lette |
| `inventario.carga.sin-archivo` | Sin archivo | No file | Nessun file |
| `inventario.carga.cerrar` | Cerrar | Close | Chiudi |
| `inventario.carga.procesando` | Procesando… | Processing… | Elaborazione… |
| `inventario.carga.procesar` | Procesar importación | Process import | Elabora importazione |
| `inventario.carga.primera-vez` | ¿Primera vez cargando inventario? | First time uploading inventory? | Primo caricamento dell’inventario? |
| `inventario.carga.descarga-plantilla` | Descarga la plantilla con el formato correcto | Download the template with the right format | Scarica il modello con il formato corretto |
| `inventario.carga.descargar-plantilla` | Descargar plantilla | Download template | Scarica modello |
| `inventario.carga.propias` | Son pantallas propias | They are owned screens | Sono impianti di proprietà |
| `inventario.carga.propias-ayuda` | De la empresa: sin renta ni contrato. Se pueden vender y su costo es solo luz y operación. Si les pones un predio, será un lugar propio. | Company-owned: no rent or contract. They can be sold and their only costs are electricity and operations. If you give them a property, it will be an owned location. | Dell’azienda: senza canone né contratto. Si possono vendere e il loro costo è solo elettricità e gestione. Se gli assegni un immobile, sarà un luogo di proprietà. |
| `inventario.carga.arrendador` | Arrendador de estas pantallas | Landlord of these screens | Locatore di questi impianti |
| `inventario.carga.arrendador-predio` | El predio y su contrato se abrirán a nombre de este arrendador | The property and its contract will be opened in this landlord’s name | L’immobile e il suo contratto saranno aperti a nome di questo locatore |
| `inventario.carga.arrendador-sueltas` | A cada pantalla se le abrirá un contrato pendiente con este arrendador | Each screen will get a pending contract with this landlord | Per ogni impianto si aprirà un contratto da completare con questo locatore |
| `inventario.carga.requiere` | {titulo} Elige el arrendador de estas pantallas para poder importarlas: sin él no se puede abrir su contrato de arrendamiento, y una pantalla sin contrato no se puede vender. | {titulo} Choose the landlord of these screens to be able to import them: without one their lease agreement can’t be opened, and a screen without a contract can’t be sold. | {titulo} Scegli il locatore di questi impianti per poterli importare: senza di lui non si può aprire il loro contratto di locazione, e un impianto senza contratto non si può vendere. |
| `inventario.carga.requiere-titulo` | Se requiere el arrendador. | The landlord is required. | Il locatore è obbligatorio. |
| `inventario.carga.predio` | Predio | Property | Immobile |
| `inventario.carga.predio-existente` | Se añadirán al predio que ya existe, bajo su contrato. | They will be added to the existing property, under its contract. | Verranno aggiunti all’immobile che esiste già, sotto il suo contratto. |
| `inventario.carga.predio-nuevo` | Se creará el predio y todas compartirán UN solo contrato. | The property will be created and all of them will share ONE contract. | Verrà creato l’immobile e tutti condivideranno UN solo contratto. |
| `inventario.carga.predio-sin` | Sin nombre entran como pantallas sueltas, cada una con su contrato. | Without a name they come in as individual screens, each with its own contract. | Senza nome entrano come impianti singoli, ognuno con il suo contratto. |
| `inventario.carga.predio-ph` | Nombre del predio | Property name | Nome dell’immobile |
| `inventario.carga.lejos-una` | Una pantalla no parece estar en este predio. | One screen doesn’t seem to be on this property. | Un impianto non sembra trovarsi in questo immobile. |
| `inventario.carga.lejos-varias` | {n} pantallas no parecen estar en este predio. | {n} screens don’t seem to be on this property. | {n} impianti non sembrano trovarsi in questo immobile. |
| `inventario.carga.lejos-explica` | Un predio es un solo inmueble y su renta se reparte entre sus pantallas, así que una que está lejos abarataría a las demás. Puedes continuar si sabes que es correcto. | A property is a single building and its rent is split among its screens, so one that is far away would make the others cheaper. You can continue if you know it’s correct. | Un immobile è un solo stabile e il suo canone si ripartisce tra i suoi impianti, quindi uno che è lontano renderebbe più economici gli altri. Puoi continuare se sai che è corretto. |
| `inventario.carga.lejos-mas` | · …y {n} más | · …and {n} more | · …e altri {n} |
| `inventario.carga.sin-arrendadores` | No hay arrendadores dados de alta. Crea al menos uno en {arrendadores} antes de importar inventario: sin arrendador no se puede abrir el contrato de la pantalla. | There are no landlords yet. Create at least one in {arrendadores} before importing inventory: without a landlord the screen’s contract can’t be opened. | Non ci sono locatori registrati. Creane almeno uno in {arrendadores} prima di importare l’inventario: senza locatore non si può aprire il contratto dell’impianto. |
| `inventario.carga.arrendadores` | Arrendadores | Landlords | Locatori |
| `inventario.carga.precio-m2` | Precio de impresión por m² (pantallas estáticas) | Printing price per m² (static screens) | Prezzo di stampa per m² (impianti statici) |
| `inventario.carga.precio-m2-ayuda` | Este valor se aplicará a todas las pantallas estáticas | This value will apply to all static screens | Questo valore si applicherà a tutti gli impianti statici |
| `inventario.carga.precio-m2-ilegible` | El precio por m² no se entiende: la coma separa miles y el punto, decimales (65.50). | The price per m² can’t be read: the comma separates thousands and the period, decimals (65.50). | Il prezzo per m² non si capisce: la virgola separa le migliaia e il punto i decimali (65.50). |
| `inventario.carga.hoja` | Sube el archivo usando la hoja {hoja} de la plantilla. El sistema lee solo esa hoja, {limpia} y {agrupa}: una fila por modalidad de venta → un sitio con varias modalidades. Requeridos: nombre, exhibición, unidad y tarifa. | Upload the file using the {hoja} sheet of the template. The system reads only that sheet, {limpia} and {agrupa}: one row per sales mode → one site with several modes. Required: name, display, unit and rate. | Carica il file usando il foglio {hoja} del modello. Il sistema legge solo quel foglio, {limpia} e {agrupa}: una riga per modalità di vendita → un sito con più modalità. Obbligatori: nome, esposizione, unità e tariffa. |
| `inventario.carga.hoja-limpia` | limpia automáticamente los encabezados | cleans up the headers automatically | ripulisce automaticamente le intestazioni |
| `inventario.carga.hoja-agrupa` | agrupa por código de proveedor | groups by supplier code | raggruppa per codice fornitore |
| `inventario.carga.costo` | El costo de una pantalla es {uno}: la columna {renta}, lo que se le paga al dueño del espacio. No es la tarifa, que es lo que se le cobra al cliente. Si tu archivo trae la columna vieja {costo}, su importe se registra como la renta —es el mismo dinero— y se te avisa fila por fila. Si no viene ninguna de las dos, el contrato queda pendiente de completar en Arrendadores y la pantalla no se podrá reservar. | A screen has {uno} cost: the {renta} column, what is paid to the owner of the space. It isn’t the rate, which is what the client is charged. If your file has the old {costo} column, its amount is recorded as the rent —it is the same money— and you are warned row by row. If neither of the two comes, the contract stays pending in Landlords and the screen can’t be booked. | Il costo di un impianto è {uno}: la colonna {renta}, ciò che si paga al proprietario dello spazio. Non è la tariffa, che è ciò che si fa pagare al cliente. Se il tuo file ha la vecchia colonna {costo}, il suo importo viene registrato come canone —è lo stesso denaro— e ti viene segnalato riga per riga. Se non c’è nessuna delle due, il contratto resta da completare in Locatori e l’impianto non si potrà prenotare. |
| `inventario.carga.costo-uno` | uno solo | just one | uno solo |
| `inventario.carga.codificacion` | Codificación del archivo | File encoding | Codifica del file |
| `inventario.carga.codificacion-ayuda` | El sistema intentará detectar automáticamente la codificación correcta si la seleccionada no funciona. | The system will try to detect the right encoding automatically if the selected one doesn’t work. | Il sistema proverà a rilevare automaticamente la codifica corretta se quella selezionata non funziona. |
| `inventario.carga.archivo` | Archivo | File | File |
| `inventario.carga.leyendo` | Leyendo… | Reading… | Lettura… |
| `inventario.carga.arrastra` | Arrastra un archivo o selecciónalo | Drag a file or select it | Trascina un file o selezionalo |
| `inventario.carga.formatos` | .xlsx o .csv | .xlsx or .csv | .xlsx o .csv |
| `inventario.carga.imagenes` | Imágenes (bulk) | Images (bulk) | Immagini (bulk) |
| `inventario.carga.imagenes-cargadas.uno` | {n} imágenes cargadas | {n} image uploaded | {n} immagine caricata |
| `inventario.carga.imagenes-cargadas.otros` | {n} imágenes cargadas | {n} images uploaded | {n} immagini caricate |
| `inventario.carga.subir-imagenes` | Subir imágenes (JPG/PNG ≤5MB) | Upload images (JPG/PNG ≤5MB) | Carica immagini (JPG/PNG ≤5MB) |
| `inventario.carga.nombra` | Nombra cada archivo con el {codigo}: {a} (principal) o {b}, {c}… para varias por pantalla. | Name each file with the {codigo}: {a} (main) or {b}, {c}… for several per screen. | Dai a ogni file il nome del {codigo}: {a} (principale) o {b}, {c}… per averne più di una per impianto. |
| `inventario.carga.codigo-proveedor` | código de proveedor | supplier code | codice fornitore |
| `inventario.carga.duplicados.uno` | {n} código(s) ya existen | {n} code already exists | {n} codice esiste già |
| `inventario.carga.duplicados.otros` | {n} código(s) ya existen | {n} codes already exist | {n} codici esistono già |
| `inventario.carga.como-proceder` | Elige cómo proceder antes de importar: | Choose how to proceed before importing: | Scegli come procedere prima di importare: |
| `inventario.carga.actualizar` | {accion} campos modificados (conserva la imagen anterior si no se sube una nueva) | {accion} the changed fields (keeps the previous image if no new one is uploaded) | {accion} i campi modificati (mantiene l’immagine precedente se non se ne carica una nuova) |
| `inventario.carga.actualizar-accion` | Actualizar | Update | Aggiorna |
| `inventario.carga.nueva` | {accion} con sufijo -v2, -v3… | {accion} with suffix -v2, -v3… | {accion} con il suffisso -v2, -v3… |
| `inventario.carga.nueva-accion` | Crear nueva | Create new | Crea nuovo |
| `inventario.carga.resumen.creadas` | Creadas | Created | Creati |
| `inventario.carga.resumen.actualizadas` | Actualizadas | Updated | Aggiornati |
| `inventario.carga.resumen.advertencias` | Advertencias | Warnings | Avvisi |
| `inventario.carga.resumen.errores` | Errores | Errors | Errori |
| `inventario.carga.ver-info` | Ver información añadida ({n}) | View added information ({n}) | Vedi le informazioni aggiunte ({n}) |
| `inventario.carga.titulo` | Carga masiva de inventario | Bulk inventory upload | Caricamento massivo dell’inventario |
| `inventario.carga.sub` | Sube tu inventario por archivo o agrega una sola pantalla | Upload your inventory by file or add a single screen | Carica il tuo inventario da file o aggiungi un solo impianto |
| `inventario.carga.vista-previa` | Vista previa | Preview | Anteprima |
| `inventario.carga.estado.valida` | válida | valid | valida |
| `inventario.carga.estado.creado` | creado | created | creato |
| `inventario.carga.estado.actualizado` | actualizado | updated | aggiornato |
| `inventario.carga.estado.advertencia` | advertencia | warning | avviso |
| `inventario.carga.estado.error` | error | failed | errore |
| `inventario.info.titulo` | Información añadida | Added information | Informazioni aggiunte |
| `inventario.info.sub.uno` | {n} pantalla en el inventario | {n} screen in the inventory | {n} impianto nell’inventario |
| `inventario.info.sub.otros` | {n} pantallas en el inventario | {n} screens in the inventory | {n} impianti nell’inventario |
| `inventario.info.vacio` | No hay pantallas para mostrar. | There are no screens to show. | Non ci sono impianti da mostrare. |
| `inventario.info.coords` | ␣· coords por verificar | ␣· coordinates to verify | ␣· coordinate da verificare |
| `inventario.info.modalidades.uno` | {n} modalidad | {n} sales mode | {n} modalità |
| `inventario.info.modalidades.otros` | {n} modalidades | {n} sales modes | {n} modalità |
| `inventario.agregar.titulo` | Agregar inventario | Add inventory | Aggiungi inventario |
| `inventario.agregar.sub` | Carga masiva por Excel/CSV con plantilla, o alta manual de una pantalla. | Bulk upload by Excel/CSV with a template, or manual entry of one screen. | Caricamento massivo da Excel/CSV con modello, o inserimento manuale di un impianto. |

## Arrendadores y contratos · `textos/arrendadores.ts` · 444 claves

| clave | español | inglés | italiano |
|---|---|---|---|
| `arrendadores.titulo` | Arrendadores | Landlords | Locatori |
| `arrendadores.comun.arrendador` | Arrendador | Landlord | Locatore |
| `arrendadores.comun.pantalla` | Pantalla | Screen | Impianto |
| `arrendadores.comun.renta` | Renta | Rent | Canone |
| `arrendadores.comun.contratos` | Contratos | Contracts | Contratti |
| `arrendadores.comun.predios` | Predios | Properties | Immobili |
| `arrendadores.comun.estatus` | Estatus | Status | Stato |
| `arrendadores.comun.cada-cuando` | Cada cuándo | Frequency | Ogni quanto |
| `arrendadores.comun.vence-contrato` | Vence | Expires | Scadenza |
| `arrendadores.comun.renta-mensual` | Renta mensual | Monthly rent | Canone mensile |
| `arrendadores.comun.razon-social` | Razón social | Legal name | Ragione sociale |
| `arrendadores.comun.razones-sociales` | Razones sociales | Legal entities | Ragioni sociali |
| `arrendadores.comun.regimen` | Régimen fiscal | Tax regime | Regime fiscale |
| `arrendadores.comun.domicilio` | Domicilio | Address | Domicilio |
| `arrendadores.comun.por-definir` | Por definir | To be defined | Da definire |
| `arrendadores.comun.completar` | Completar | Complete | Completa |
| `arrendadores.comun.completar-informacion` | Completar información | Complete information | Completa le informazioni |
| `arrendadores.comun.agregar` | Agregar | Add | Aggiungi |
| `arrendadores.comun.no-guardar-contrato` | No se pudo guardar el contrato | Could not save the contract | Impossibile salvare il contratto |
| `arrendadores.comun.revisa-rojo` | Revisa los campos marcados en rojo. | Review the fields marked in red. | Controlla i campi segnati in rosso. |
| `arrendadores.comun.sin-razon` | Sin razón social | No legal entity | Senza ragione sociale |
| `arrendadores.comun.la-paga` | La paga | Paid by | Chi paga |
| `arrendadores.comun.la-que-arrienda` | ␣— la que arrienda | ␣— recommended | ␣— quella che prende in locazione |
| `arrendadores.comun.con-cual-se-paga` | Con cuál de tus razones sociales se paga | Which of your legal entities pays it | Con quale delle tue ragioni sociali si paga |
| `arrendadores.comun.periodicidad` | Periodicidad | Frequency | Periodicità |
| `arrendadores.comun.vigencia` | Vigencia | Term | Durata |
| `arrendadores.comun.deposito` | Depósito | Security deposit | Deposito cauzionale |
| `arrendadores.comun.motivo` | «{motivo}» | “{motivo}” | «{motivo}» |
| `arrendadores.comun.hoy` | hoy | today | oggi |
| `arrendadores.comun.en-dias` | en {n} d | in {n} d | tra {n} g |
| `arrendadores.comun.mes` | /mes | /mo | /mese |
| `arrendadores.comun.monto-mes` | {monto}/mes | {monto}/mo | {monto}/mese |
| `arrendadores.comun.confirmar-renovar` | Confirmar y renovar | Confirm and renew | Conferma e rinnova |
| `arrendadores.falta.arrendador` | arrendador | landlord | locatore |
| `arrendadores.falta.vigencia` | vigencia | term | durata |
| `arrendadores.falta.importe` | importe | amount | importo |
| `arrendadores.falta.periodicidad` | periodicidad | frequency | periodicità |
| `arrendadores.falta.y` | {lista} y {ultimo} | {lista} and {ultimo} | {lista} e {ultimo} |
| `arrendadores.vence.hoy` | hoy | today | oggi |
| `arrendadores.vence.en.uno` | en {n} día | in {n} day | tra {n} giorno |
| `arrendadores.vence.en.otros` | en {n} días | in {n} days | tra {n} giorni |
| `arrendadores.vence.hace.uno` | hace {n} día | {n} day ago | {n} giorno fa |
| `arrendadores.vence.hace.otros` | hace {n} días | {n} days ago | {n} giorni fa |
| `arrendadores.subtitulo` | El otro lado de la red · contratos, rentas y vencimientos | The other side of the network · contracts, rents and expirations | L’altro lato della rete · contratti, canoni e scadenze |
| `arrendadores.descarga.ninguno` | No hay contratos vigentes que descargar | There are no active contracts to download | Non ci sono contratti in vigore da scaricare |
| `arrendadores.descarga.hecha.uno` | Descargados {n} contrato vigente | Downloaded {n} active contract | Scaricato {n} contratto in vigore |
| `arrendadores.descarga.hecha.otros` | Descargados {n} contratos vigentes | Downloaded {n} active contracts | Scaricati {n} contratti in vigore |
| `arrendadores.descarga.error` | No se pudo generar el archivo | Could not generate the file | Impossibile generare il file |
| `arrendadores.nuevo` | Nuevo arrendador | New landlord | Nuovo locatore |
| `arrendadores.nuevo-contrato` | Nuevo contrato | New contract | Nuovo contratto |
| `arrendadores.buscar` | Buscar arrendador, pantalla o RFC… | Search landlord, screen or RFC… | Cerca locatore, impianto o RFC… |
| `arrendadores.todos` | Todos los arrendadores | All landlords | Tutti i locatori |
| `arrendadores.contratos-todos` | Contratos: todos | Contracts: all | Contratti: tutti |
| `arrendadores.filtrados` | {n} de {total} contratos | {n} of {total} contracts | {n} di {total} contratti |
| `arrendadores.kpi.por-capturar` | + {n} por capturar | + {n} to enter | + {n} da inserire |
| `arrendadores.kpi.activos.uno` | {n} contrato activo | {n} active contract | {n} contratto attivo |
| `arrendadores.kpi.activos.otros` | {n} contratos activos | {n} active contracts | {n} contratti attivi |
| `arrendadores.kpi.de-arrendadores.uno` | de {n} arrendador | from {n} landlord | di {n} locatore |
| `arrendadores.kpi.de-arrendadores.otros` | de {n} arrendadores | from {n} landlords | di {n} locatori |
| `arrendadores.kpi.por-vencer` | Por vencer | Expiring soon | In scadenza |
| `arrendadores.kpi.por-vencer.sub` | contratos que hay que renovar o terminar | contracts to renew or end | contratti da rinnovare o chiudere |
| `arrendadores.kpi.renta-vencida` | Renta vencida | Overdue rent | Canoni scaduti |
| `arrendadores.kpi.renta-vencida.sub` | pagos de renta vencidos | overdue rent payments | pagamenti di canone scaduti |
| `arrendadores.incompletos.uno` | La renta mensual no incluye {n} contrato incompleto, así que el costo real es mayor. | The monthly rent doesn’t include {n} incomplete contract, so the real cost is higher. | Il canone mensile non include {n} contratto incompleto, quindi il costo reale è maggiore. |
| `arrendadores.incompletos.otros` | La renta mensual no incluye {n} contratos incompletos, así que el costo real es mayor. | The monthly rent doesn’t include {n} incomplete contracts, so the real cost is higher. | Il canone mensile non include {n} contratti incompleti, quindi il costo reale è maggiore. |
| `arrendadores.incompletos.falta.uno` | La renta mensual no incluye {n} contrato incompleto: falta capturar {falta}, así que el costo real es mayor. | The monthly rent doesn’t include {n} incomplete contract (still missing: {falta}), so the real cost is higher. | Il canone mensile non include {n} contratto incompleto (da inserire: {falta}), quindi il costo reale è maggiore. |
| `arrendadores.incompletos.falta.otros` | La renta mensual no incluye {n} contratos incompletos: falta capturar {falta}, así que el costo real es mayor. | The monthly rent doesn’t include {n} incomplete contracts (still missing: {falta}), so the real cost is higher. | Il canone mensile non include {n} contratti incompleti (da inserire: {falta}), quindi il costo reale è maggiore. |
| `arrendadores.contratos.titulo` | Contratos de arrendamiento | Lease agreements | Contratti di locazione |
| `arrendadores.contratos.excel` | Vigentes en Excel | Export active (Excel) | In vigore in Excel |
| `arrendadores.contratos.excel-title` | Descargar los contratos vigentes en Excel | Download the active contracts in Excel | Scarica i contratti in vigore in Excel |
| `arrendadores.contratos.sitio` | Sitio | Site | Sito |
| `arrendadores.contratos.vendida-en` | Vendida en {lista} | Sold in {lista} | Venduto in {lista} |
| `arrendadores.contratos.vendida-item` | «{nombre}» | “{nombre}” | «{nombre}» |
| `arrendadores.nuevo-contrato.titulo` | Nuevo contrato de arrendamiento | New lease agreement | Nuovo contratto di locazione |
| `arrendadores.nuevo-contrato.sub` | Arrendador → contrato (fechas pasadas permitidas) → pantalla | Landlord → contract (past dates allowed) → screen | Locatore → contratto (date passate consentite) → impianto |
| `arrendadores.alta.razon-fallo` | Arrendador creado, pero su razón social no: {error}. Agrégala desde su ficha. | Landlord created, but not their legal name: {error}. Add it from their profile. | Locatore creato, ma la sua ragione sociale no: {error}. Aggiungila dalla sua scheda. |
| `arrendadores.alta.error-desconocido` | error desconocido | unknown error | errore sconosciuto |
| `arrendadores.alta.agregado` | Propietario agregado | Landlord added | Locatore aggiunto |
| `arrendadores.alta.sub` | Alta de arrendador (dueño del predio) | Add a landlord (owner of the property) | Registrazione di un locatore (proprietario dell’immobile) |
| `arrendadores.alta.crear-igual` | Crear de todos modos | Create anyway | Crea comunque |
| `arrendadores.alta.repetido` | Si te equivocaste, cierra y búscalo en la lista; si de verdad es otro propietario distinto, vuelve a pulsar. | If it was a mistake, close and look for it in the list; if it really is a different landlord, click again. | Se hai sbagliato, chiudi e cercalo nell’elenco; se è davvero un altro locatore, premi di nuovo. |
| `arrendadores.alta.rfc-malo` | Formato inválido. Son 3 letras (empresa) o 4 (persona), fecha AAMMDD y 3 caracteres de homoclave. | Invalid format. It’s 3 letters (company) or 4 (person), a YYMMDD date and 3 homoclave characters. | Formato non valido. Sono 3 lettere (azienda) o 4 (persona), la data AAMMGG e 3 caratteri di omoclave. |
| `arrendadores.alta.domicilio-ph` | Calle, número, colonia, CP, ciudad, estado | Street, number, neighborhood, postal code, city, state | Via, numero, quartiere, CAP, città, stato |
| `arrendadores.alta.domicilio-ayuda` | El contrato de arrendamiento lo necesita para las notificaciones. Sin él, el documento sale con ese hueco en blanco. | The lease agreement needs it for notices. Without it, the document comes out with that gap left blank. | Il contratto di locazione ne ha bisogno per le notifiche. Senza, il documento esce con quello spazio in bianco. |
| `arrendadores.alta.fiscales` | Datos fiscales | Tax details | Dati fiscali |
| `arrendadores.alta.fiscales-ayuda` | Es a quien se le factura la renta. Si lo dejas en blanco, el arrendador queda dado de alta igual y puedes capturarlo después desde su ficha. | It’s who the rent is invoiced to. If you leave it blank, the landlord is added anyway and you can enter it later from their profile. | È il soggetto a cui si fattura il canone. Se lo lasci in bianco, il locatore viene registrato comunque e puoi inserirlo dopo dalla sua scheda. |
| `arrendadores.alta.regimen-ayuda` | Se habilita al capturar la razón social: el régimen es de ella. | It’s enabled once you enter the legal name: the regime belongs to it. | Si abilita inserendo la ragione sociale: il regime è suo. |
| `arrendadores.por-razon.titulo` | Por razón social | By legal entity | Per ragione sociale |
| `arrendadores.por-razon.vacio` | — Sin razones sociales dadas de alta. | — No legal names added. | — Nessuna ragione sociale registrata. |
| `arrendadores.por-razon.pagos-vencidos` | Pagos vencidos | Overdue payments | Pagamenti scaduti |
| `arrendadores.rentabilidad.titulo` | Rentabilidad por pantalla | Profitability by screen | Redditività per impianto |
| `arrendadores.rentabilidad.sub` | Margen mensual = ingreso de reservas vigentes − renta del arrendador. Las de margen negativo son candidatas a renegociar o dar de baja. | Monthly margin = revenue from active bookings − landlord rent. Those with a negative margin are candidates to renegotiate or drop. | Margine mensile = ricavi delle prenotazioni in vigore − canone del locatore. Quelli con margine negativo sono candidati alla rinegoziazione o alla dismissione. |
| `arrendadores.rentabilidad.sin-filtro` | Ninguna pantalla coincide con el filtro. | No screens match the filter. | Nessun impianto corrisponde al filtro. |
| `arrendadores.rentabilidad.vacio` | Sin contratos ni reservas activas todavía. | No contracts or active bookings yet. | Ancora nessun contratto né prenotazione attiva. |
| `arrendadores.rentabilidad.ingreso` | Ingreso/mes | Revenue/mo | Ricavi/mese |
| `arrendadores.rentabilidad.renta` | Renta/mes | Rent/mo | Canone/mese |
| `arrendadores.rentabilidad.margen` | Margen/mes | Margin/mo | Margine/mese |
| `arrendadores.rentabilidad.sin-contrato` | sin contrato de renta | no rent contract | senza contratto di locazione |
| `arrendadores.lista.rfc-malo` | El RFC no tiene un formato válido | The RFC doesn’t have a valid format | L’RFC non ha un formato valido |
| `arrendadores.lista.actualizado` | Propietario actualizado | Landlord updated | Locatore aggiornato |
| `arrendadores.lista.sub` | Dueños de predio dados de alta. | Property owners on record. | Proprietari di immobili registrati. |
| `arrendadores.lista.sin-filtro` | Ningún arrendador coincide con el filtro. | No landlords match the filter. | Nessun locatore corrisponde al filtro. |
| `arrendadores.lista.vacio` | Aún no hay arrendadores. Usa {boton} para dar de alta uno. | There are no landlords yet. Use {boton} to add one. | Non ci sono ancora locatori. Usa {boton} per registrarne uno. |
| `arrendadores.lista.vacio-boton` | “Nuevo arrendador” | “New landlord” | «Nuovo locatore» |
| `arrendadores.lista.contacto` | Contacto | Contact | Contatto |
| `arrendadores.lista.domicilio-ph` | Calle, número, colonia, CP, ciudad | Street, number, neighborhood, postal code, city | Via, numero, quartiere, CAP, città |
| `arrendadores.lista.falta` | Falta | Missing | Manca |
| `arrendadores.lista.activos-title` | {activos} activo(s) de {total}. Solo los activos impiden dar de baja. | {activos} active out of {total}. Only active ones prevent deactivation. | Attivi: {activos} su {total}. Solo quelli attivi impediscono la disattivazione. |
| `arrendadores.lista.predios-title` | Un propietario con predios a su nombre no se puede dar de baja. | A landlord with properties in their name can’t be deactivated. | Un locatore con immobili a suo nome non si può disattivare. |
| `arrendadores.baja.aria` | Dar de baja a {nombre} | Deactivate {nombre} | Disattiva {nombre} |
| `arrendadores.baja.boton` | Dar de baja | Deactivate | Disattiva |
| `arrendadores.baja.hecha` | Propietario dado de baja | Landlord deactivated | Locatore disattivato |
| `arrendadores.baja.error` | No se pudo dar de baja al propietario | Could not deactivate the landlord | Impossibile disattivare il locatore |
| `arrendadores.baja.sub` | Deja de aparecer en la aplicación y no se puede reactivar desde aquí | Stops appearing in the app and can’t be reactivated from here | Smette di comparire nell’applicazione e non si può riattivare da qui |
| `arrendadores.baja.dando` | Dando de baja… | Deactivating… | Disattivazione… |
| `arrendadores.baja.confirmar` | Confirmar y dar de baja | Confirm and deactivate | Conferma e disattiva |
| `arrendadores.baja.pide-clave` | Dar de baja a un propietario no se puede deshacer desde la aplicación, así que hace falta tu contraseña. | Deactivating a landlord can’t be undone from the app, so your password is needed. | La disattivazione di un locatore non si può annullare dall’applicazione, quindi serve la tua password. |
| `arrendadores.baja.tu-clave` | Tu contraseña | Your password | La tua password |
| `arrendadores.baja.dejara` | {nombre} dejará de aparecer en Arrendadores y no podrá elegirse en contratos nuevos. | {nombre} will stop appearing in Landlords and can’t be chosen for new contracts. | {nombre} non comparirà più in Locatori e non potrà essere scelto per nuovi contratti. |
| `arrendadores.baja.conserva` | Sus contratos y pagos anteriores se conservan. Para volver a verlo hace falta alguien con acceso a la base de datos. | Their past contracts and payments are kept. Bringing them back requires someone with database access. | I suoi contratti e pagamenti precedenti vengono conservati. Per rivederlo serve qualcuno con accesso al database. |
| `arrendadores.razones.agregada.uno` | Razón social agregada · se asignó a {n} contrato que no tenía ninguna | Legal entity added · assigned to {n} contract that had none | Ragione sociale aggiunta · assegnata a {n} contratto che non ne aveva nessuna |
| `arrendadores.razones.agregada.otros` | Razón social agregada · se asignó a {n} contratos que no tenían ninguna | Legal entity added · assigned to {n} contracts that had none | Ragione sociale aggiunta · assegnata a {n} contratti che non ne avevano nessuna |
| `arrendadores.razones.agregada` | Razón social agregada | Legal entity added | Ragione sociale aggiunta |
| `arrendadores.razones.actualizada` | Razón social actualizada | Legal entity updated | Ragione sociale aggiornata |
| `arrendadores.razones.eliminada` | Razón social eliminada | Legal entity deleted | Ragione sociale eliminata |
| `arrendadores.razones.no-eliminar` | No se pudo eliminar | Could not delete | Impossibile eliminare |
| `arrendadores.razones.nombre-ph` | Nombre o denominación fiscal | Name or registered business name | Nome o denominazione fiscale |
| `arrendadores.razones.rfc-malo` | El RFC no tiene un formato válido (3–4 letras, 6 dígitos de fecha y 3 caracteres). | The RFC doesn’t have a valid format (3–4 letters, 6 date digits and 3 characters). | L’RFC non ha un formato valido (3–4 lettere, 6 cifre di data e 3 caratteri). |
| `arrendadores.razones.sub` | A nombre de quién factura cada arrendador. Un mismo arrendador puede tener varias; el contrato elige cuál usa. | Whose name each landlord invoices under. One landlord can have several; the contract chooses which one it uses. | A nome di chi fattura ogni locatore. Uno stesso locatore può averne diverse; il contratto sceglie quale usare. |
| `arrendadores.razones.sin-n` | {n} sin razón social | {n} without a legal entity | {n} senza ragione sociale |
| `arrendadores.razones.sin-arrendadores` | Aún no hay arrendadores dados de alta. | There are no landlords yet. | Non ci sono ancora locatori registrati. |
| `arrendadores.razones.aviso-varios` | Sin razón social, los contratos de estos arrendadores no podrán anclar a quién se factura. | Without a legal entity, these landlords’ contracts can’t pin down who is invoiced. | Senza ragione sociale, i contratti di questi locatori non potranno indicare a chi si fattura. |
| `arrendadores.razones.agregar-flecha` | Agregar → | Add → | Aggiungi → |
| `arrendadores.razones.aviso-uno` | Sin razón social. Los contratos de este arrendador no podrán anclar a quién se factura. | No legal entity. This landlord’s contracts can’t pin down who is invoiced. | Senza ragione sociale. I contratti di questo locatore non potranno indicare a chi si fattura. |
| `arrendadores.razones.regimen` | Régimen: | Regime: | Regime: |
| `arrendadores.razones.falta` | falta | missing | manca |
| `arrendadores.razones.facturan.uno` | {n} contrato factura aquí | {n} contract billed to this legal entity | {n} contratto fattura qui |
| `arrendadores.razones.facturan.otros` | {n} contratos facturan aquí | {n} contracts billed to this legal entity | {n} contratti fatturano qui |
| `arrendadores.razones.no-borrar` | Hay contratos que facturan a esta razón social | There are contracts invoiced to this legal entity | Ci sono contratti che fatturano a questa ragione sociale |
| `arrendadores.incidencia.legal` | Legal / permiso | Legal / permit | Legale / permesso |
| `arrendadores.incidencia.mantenimiento` | Mantenimiento | Maintenance | Manutenzione |
| `arrendadores.incidencia.vandalismo` | Vandalismo | Vandalism | Vandalismo |
| `arrendadores.incidencia.clima` | Clima | Weather | Meteo |
| `arrendadores.incidencia.suspension` | Suspensión operativa | Operational suspension | Sospensione operativa |
| `arrendadores.incidencia.accidente` | Accidente | Accident | Incidente |
| `arrendadores.incidencia.otro` | Otro | Other | Altro |
| `arrendadores.ficha.contrato` | Contrato | Contract | Contratto |
| `arrendadores.ficha.reportar` | Reportar incidencia | Report incident | Segnala problema |
| `arrendadores.ficha.renovacion-iniciada` | Renovación iniciada | Renewal started | Rinnovo avviato |
| `arrendadores.ficha.no-renovar` | No se pudo iniciar la renovación | Could not start the renewal | Impossibile avviare il rinnovo |
| `arrendadores.ficha.renovar` | Renovar | Renew | Rinnova |
| `arrendadores.ficha.incompleto` | Este contrato se abrió automáticamente al vender la pantalla, para que no quedara sin registro. Falta capturar el arrendador, el importe de la renta, la periodicidad y la fecha de fin. Mientras tanto no cuenta como costo en el P&L ni genera calendario de pagos. | This contract was opened automatically when the screen was sold, so it wouldn’t be left unrecorded. The landlord, the rent amount, the payment frequency and the end date still have to be entered. Until then it doesn’t count as a cost in the P&L and doesn’t generate a payment schedule. | Questo contratto è stato aperto automaticamente alla vendita dell’impianto, perché non restasse senza registrazione. Mancano il locatore, l’importo del canone, la periodicità e la data di fine. Nel frattempo non conta come costo nel conto economico né genera il calendario dei pagamenti. |
| `arrendadores.ficha.contrato-arrendamiento` | Contrato de arrendamiento | Lease agreement | Contratto di locazione |
| `arrendadores.ficha.por-definir` | por definir | to be defined | da definire |
| `arrendadores.ficha.tiempo-restante` | Tiempo restante | Time remaining | Tempo rimanente |
| `arrendadores.ficha.vencido` | Vencido | Expired | Scaduto |
| `arrendadores.ficha.renovacion` | Renovación automática | Automatic renewal | Rinnovo automatico |
| `arrendadores.ficha.cambiar` | Cambiar | Change | Cambia |
| `arrendadores.ficha.generar` | Generar contrato | Generate contract | Genera contratto |
| `arrendadores.ficha.ver-firmado` | Ver documento firmado (PDF) | View signed document (PDF) | Vedi documento firmato (PDF) |
| `arrendadores.ficha.pagos` | Pagos de renta | Rent payments | Pagamenti del canone |
| `arrendadores.ficha.sin-pagos` | Sin pagos registrados. | No payments recorded. | Nessun pagamento registrato. |
| `arrendadores.ficha.factura` | Factura | Invoice | Fattura |
| `arrendadores.ficha.comprobante` | Comprobante | Proof of payment | Ricevuta |
| `arrendadores.ficha.adjuntos` | Adjuntos | Attachments | Allegati |
| `arrendadores.ficha.registrar` | Registrar | Record | Registra |
| `arrendadores.ficha.ruc` | RUC | RUC (tax ID) | RUC |
| `arrendadores.ficha.correo` | Correo | Email | Email |
| `arrendadores.ficha.incidencia-reportada` | Incidencia reportada · {nombre} bloqueado en Comercial | Incident reported · {nombre} blocked in Sales | Problema segnalato · {nombre} bloccato in Vendite |
| `arrendadores.ficha.renovar-sensible` | Renovar un contrato es un cambio sensible: tu organización pide que vuelvas a identificarte. | Renewing a contract is a sensitive change: your organization asks you to confirm your identity again. | Rinnovare un contratto è una modifica sensibile: la tua organizzazione chiede di identificarti di nuovo. |
| `arrendadores.pagadora.asignada` | Razón social asignada al contrato | Legal entity assigned to the contract | Ragione sociale assegnata al contratto |
| `arrendadores.pagadora.sin` | El contrato quedó sin razón social asignada | The contract was left without an assigned legal entity | Il contratto è rimasto senza ragione sociale assegnata |
| `arrendadores.pagadora.sub` | Solo cambia a nombre de quién sale esta renta. No toca el importe. | It only changes whose name this rent is paid under. It doesn’t touch the amount. | Cambia solo a nome di chi esce questo canone. Non tocca l’importo. |
| `arrendadores.pagadora.sin-entidades` | Todavía no tienes razones sociales capturadas. Se dan de alta en Razones sociales. | You don’t have any legal entities yet. They are added in Legal entities. | Non hai ancora ragioni sociali inserite. Si registrano in Ragioni sociali. |
| `arrendadores.pagadora.sin-asignar` | Dejarlo sin asignar es legítimo: el contrato es un acuerdo real aunque todavía no se haya decidido con qué sociedad se paga. | Leaving it unassigned is legitimate: the contract is a real agreement even if it hasn’t been decided yet which company pays it. | Lasciarlo senza assegnazione è legittimo: il contratto è un accordo reale anche se non si è ancora deciso con quale società si paga. |
| `arrendadores.completar.falta-razon` | razón social | legal name | ragione sociale |
| `arrendadores.completar.falta-rfc` | RFC | RFC (tax ID) | RFC |
| `arrendadores.completar.falta-regimen` | régimen fiscal | tax regime | regime fiscale |
| `arrendadores.completar.hecho` | Contrato completado · se generó su calendario de pagos | Contract completed · its payment schedule was generated | Contratto completato · è stato generato il suo calendario dei pagamenti |
| `arrendadores.completar.titulo` | Completar contrato de arrendamiento | Complete lease agreement | Completa il contratto di locazione |
| `arrendadores.completar.sub` | Los cuatro datos que faltan para que cuente como acuerdo real | The four details missing for it to count as a real agreement | I quattro dati che mancano perché conti come accordo reale |
| `arrendadores.completar.guardar` | Guardar contrato | Save contract | Salva contratto |
| `arrendadores.completar.elige` | Elige el arrendador… | Choose the landlord… | Scegli il locatore… |
| `arrendadores.completar.varias` | Tiene {n} razones sociales; se muestra la primera. Cuál factura este contrato se elige en su ficha. | It has {n} legal names; the first one is shown. Choose which one this contract is billed to in their profile. | Ha {n} ragioni sociali; si mostra la prima. Quale fattura questo contratto si sceglie nella sua scheda. |
| `arrendadores.completar.le-falta` | Le falta {lista}. Puedes guardar el contrato igual, pero sin eso no se le podrá facturar la renta cuando toque pagarle. | It’s missing {lista}. You can save the contract anyway, but without it the rent can’t be invoiced when it’s time to pay. | Gli manca: {lista}. Puoi salvare il contratto comunque, ma senza questi dati non gli si potrà fatturare il canone quando toccherà pagarlo. |
| `arrendadores.completar.importe` | Importe de la renta | Rent amount | Importo del canone |
| `arrendadores.completar.importe-cero` | Captura un importe mayor que cero | Enter an amount greater than zero | Inserisci un importo maggiore di zero |
| `arrendadores.completar.cada-cuando` | Cada cuándo se paga | Payment frequency | Ogni quanto si paga |
| `arrendadores.completar.desde` | Desde | From | Da |
| `arrendadores.completar.hasta` | Hasta | To | Fino a |
| `arrendadores.completar.antes-inicio` | No puede ser anterior al inicio ({fecha}) | Can’t be earlier than the start ({fecha}) | Non può essere precedente all’inizio ({fecha}) |
| `arrendadores.completar.sin-entidades` | Todavía no tienes razones sociales capturadas. Se pueden dar de alta en Razones sociales, y el contrato se guarda igual mientras tanto. | You don’t have any legal entities yet. They can be added in Legal entities, and the contract is saved anyway in the meantime. | Non hai ancora ragioni sociali inserite. Si possono registrare in Ragioni sociali, e nel frattempo il contratto si salva comunque. |
| `arrendadores.completar.sin-asignar` | Se puede dejar sin asignar: el contrato es un acuerdo real aunque todavía no se haya decidido con qué sociedad se paga. | It can be left unassigned: the contract is a real agreement even if it hasn’t been decided yet which company pays it. | Si può lasciare senza assegnazione: il contratto è un accordo reale anche se non si è ancora deciso con quale società si paga. |
| `arrendadores.completar.al-guardar` | Al guardar, el contrato deja de estar incompleto: empieza a contar como costo de renta en el P&L y se genera su calendario de pagos. | When you save, the contract stops being incomplete: it starts counting as a rent cost in the P&L and its payment schedule is generated. | Al salvataggio, il contratto smette di essere incompleto: inizia a contare come costo di locazione nel conto economico e si genera il suo calendario dei pagamenti. |
| `arrendadores.completar.al-guardar-per` | Al guardar, el contrato deja de estar incompleto: empieza a contar como costo de renta en el P&L y se genera su calendario de pagos {periodicidad}. | When you save, the contract stops being incomplete: it starts counting as a rent cost in the P&L and its payment schedule ({periodicidad}) is generated. | Al salvataggio, il contratto smette di essere incompleto: inizia a contare come costo di locazione nel conto economico e si genera il suo calendario dei pagamenti {periodicidad}. |
| `arrendadores.adjunto.tipo` | Debe ser un PDF o una imagen (PNG, JPG o WebP) | It must be a PDF or an image (PNG, JPG or WebP) | Deve essere un PDF o un’immagine (PNG, JPG o WebP) |
| `arrendadores.adjunto.tamano` | El archivo supera {mb} MB | The file exceeds {mb} MB | Il file supera {mb} MB |
| `arrendadores.adjunto.leer` | No se pudo leer el archivo | Could not read the file | Impossibile leggere il file |
| `arrendadores.adjunto.listo` | Archivo listo | File ready | File pronto |
| `arrendadores.adjunto.quitar` | Quitar | Remove | Rimuovi |
| `arrendadores.adjunto.reemplazar` | Reemplazar | Replace | Sostituisci |
| `arrendadores.adjunto.adjuntar` | Adjuntar | Attach | Allega |
| `arrendadores.adjunto.ver` | Ver | View | Vedi |
| `arrendadores.metodo.transferencia` | Transferencia | Bank transfer | Bonifico |
| `arrendadores.metodo.efectivo` | Efectivo | Cash | Contanti |
| `arrendadores.metodo.cheque` | Cheque | Check | Assegno |
| `arrendadores.metodo.tarjeta` | Tarjeta | Card | Carta |
| `arrendadores.metodo.otro` | Otro | Other | Altro |
| `arrendadores.pago.adjuntos-guardados` | Adjuntos guardados | Attachments saved | Allegati salvati |
| `arrendadores.pago.registrado` | Pago registrado | Payment recorded | Pagamento registrato |
| `arrendadores.pago.adjuntos-titulo` | Adjuntos del pago | Payment attachments | Allegati del pagamento |
| `arrendadores.pago.guardar-adjuntos` | Guardar adjuntos | Save attachments | Salva allegati |
| `arrendadores.pago.pagado-el` | Pagado el {fecha}{metodo}. Aquí solo se adjuntan los documentos: el pago no se vuelve a registrar. | Paid on {fecha}{metodo}. Only the documents are attached here: the payment isn’t recorded again. | Pagato il {fecha}{metodo}. Qui si allegano solo i documenti: il pagamento non viene registrato di nuovo. |
| `arrendadores.pago.fecha` | Fecha de pago | Payment date | Data di pagamento |
| `arrendadores.pago.metodo` | Método de pago | Payment method | Metodo di pagamento |
| `arrendadores.pago.factura` | Factura del arrendador | Landlord’s invoice | Fattura del locatore |
| `arrendadores.pago.comprobante` | Comprobante de pago | Proof of payment | Ricevuta di pagamento |
| `arrendadores.pago.observaciones` | Observaciones | Notes | Osservazioni |
| `arrendadores.pago.formato` | PDF o imagen, hasta {mb} MB por archivo. | PDF or image, up to {mb} MB per file. | PDF o immagine, fino a {mb} MB per file. |
| `arrendadores.incidencia.bloquear` | Reportar y bloquear sitio | Report and block site | Segnala e blocca il sito |
| `arrendadores.incidencia.tipo` | Tipo | Type | Tipo |
| `arrendadores.incidencia.descripcion` | Descripción | Description | Descrizione |
| `arrendadores.incidencia.descripcion-ph` | Describe la incidencia… | Describe the incident… | Descrivi il problema… |
| `arrendadores.incidencia.aviso` | Al reportar, el sitio pasa a {bloqueado} y aparece en rojo en el mapa de Comercial al instante. | When you report it, the site becomes {bloqueado} and shows up in red on the Sales map instantly. | Segnalandolo, il sito diventa {bloqueado} e appare subito in rosso sulla mappa di Vendite. |
| `arrendadores.incidencia.bloqueado` | bloqueado | blocked | bloccato |
| `arrendadores.parte.arrendador` | El arrendador | The landlord | Il locatore |
| `arrendadores.parte.arrendatario` | Nosotros | Us | Noi |
| `arrendadores.cambios.no-historial` | No se pudo leer el historial | Could not read the history | Impossibile leggere lo storico |
| `arrendadores.cambios.titulo` | Cambios al contrato | Contract changes | Modifiche al contratto |
| `arrendadores.cambios.editar` | Editar términos | Edit terms | Modifica termini |
| `arrendadores.cambios.ya-firmado` | Ya está firmado. Si cambias sus términos, esta versión se archiva tal como se firmó y el contrato se vuelve a firmar con los datos actuales. | It’s already signed. If you change its terms, this version is archived exactly as it was signed and the contract is signed again with the current data. | È già firmato. Se ne cambi i termini, questa versione viene archiviata così come è stata firmata e il contratto si firma di nuovo con i dati attuali. |
| `arrendadores.cambios.vacio` | Sin cambios registrados desde que se dio de alta. | No changes recorded since it was created. | Nessuna modifica registrata da quando è stato inserito. |
| `arrendadores.cambios.lo-propuso` | Lo propuso {parte} | Proposed by {parte} | Proposta da: {parte} |
| `arrendadores.cambios.interna` | Captura interna | Internal entry | Inserimento interno |
| `arrendadores.cambios.registro` | ␣· lo registró {nombre} | ␣· recorded by {nombre} | ␣· registrata da {nombre} |
| `arrendadores.cambios.vacio-valor` | vacío | empty | vuoto |
| `arrendadores.cambios.archivada` | Estaba firmado: se archivó como versión firmada {n} y se anularon sus firmas. | It was signed: it was archived as signed version {n} and its signatures were voided. | Era firmato: è stato archiviato come versione firmata {n} e le sue firme sono state annullate. |
| `arrendadores.cambios.envio-anulado` | Ya se había enviado a firma: ese enlace dejó de servir y hubo que reenviarlo. | It had already been sent for signature: that link stopped working and had to be sent again. | Era già stato inviato per la firma: quel link non è più valido ed è stato necessario reinviarlo. |
| `arrendadores.versiones.no-leer` | No se pudo leer la versión firmada | Could not read the signed version | Impossibile leggere la versione firmata |
| `arrendadores.versiones.titulo` | Versiones firmadas anteriores | Previous signed versions | Versioni firmate precedenti |
| `arrendadores.versiones.version` | Versión {n} | Version {n} | Versione {n} |
| `arrendadores.versiones.archivada` | ␣· archivada {fecha} | ␣· archived {fecha} | ␣· archiviata il {fecha} |
| `arrendadores.versiones.ver` | Ver texto firmado | View signed text | Vedi testo firmato |
| `arrendadores.versiones.firmo` | {parte} firmó {nombre} | {parte} signed by {nombre} | {parte}: firmato da {nombre} |
| `arrendadores.versiones.firmo-el` | {parte} firmó {nombre} el {fecha} | {parte} signed by {nombre} on {fecha} | {parte}: firmato da {nombre} il {fecha} |
| `arrendadores.versiones.modal` | Versión firmada {n} | Signed version {n} | Versione firmata {n} |
| `arrendadores.versiones.sello` | Sello SHA-256: {hash} | SHA-256 seal: {hash} | Sigillo SHA-256: {hash} |
| `arrendadores.editar.no-guardar` | No se pudo guardar el cambio | Could not save the change | Impossibile salvare la modifica |
| `arrendadores.editar.hecho-firmado` | Cambio guardado · la versión firmada quedó archivada; envía el contrato a firma otra vez | Change saved · the signed version was archived; send the contract for signature again | Modifica salvata · la versione firmata è stata archiviata; invia di nuovo il contratto per la firma |
| `arrendadores.editar.hecho-enviado` | Cambio guardado · vuelve a enviar el contrato a firma | Change saved · send the contract for signature again | Modifica salvata · invia di nuovo il contratto per la firma |
| `arrendadores.editar.hecho` | Cambio guardado en el historial | Change saved in the history | Modifica salvata nello storico |
| `arrendadores.editar.titulo` | Editar términos del contrato | Edit contract terms | Modifica i termini del contratto |
| `arrendadores.editar.sub-firmado` | Ya firmado: la versión firmada se archiva y se vuelve a firmar. | Already signed: the signed version is archived and it is signed again. | Già firmato: la versione firmata viene archiviata e si firma di nuovo. |
| `arrendadores.editar.sub` | Antes de firmarse. Cada cambio queda en el historial con quién lo pidió. | Before signing. Each change stays in the history with who asked for it. | Prima della firma. Ogni modifica resta nello storico con chi l’ha chiesta. |
| `arrendadores.editar.guardar` | Guardar cambio | Save change | Salva modifica |
| `arrendadores.editar.aviso-firmado` | Este contrato {firmado}. Si guardas un cambio, la versión firmada se archiva tal como se firmó —texto y firmas— y las firmas actuales se anulan. Después tendrás que enviarlo a firma otra vez, con los datos actuales, para que las dos partes lo revisen y lo firmen de nuevo. Escribe el motivo: queda en el historial. | This contract {firmado}. If you save a change, the signed version is archived exactly as it was signed —text and signatures— and the current signatures are voided. Then you’ll have to send it for signature again, with the current data, so both parties review and re-sign it. Write the reason: it stays in the history. | Questo contratto {firmado}. Se salvi una modifica, la versione firmata viene archiviata così come è stata firmata —testo e firme— e le firme attuali vengono annullate. Dopo dovrai inviarlo di nuovo per la firma, con i dati attuali, perché le due parti lo rivedano e lo firmino di nuovo. Scrivi il motivo: resta nello storico. |
| `arrendadores.editar.aviso-firmado-b` | ya está firmado | is already signed | è già firmato |
| `arrendadores.editar.aviso-enviado` | Este contrato {enviado}. Si guardas un cambio, el enlace que tiene el arrendador deja de servir y tendrás que enviarlo otra vez con el texto nuevo. | This contract {enviado}. If you save a change, the link the landlord has stops working and you’ll have to send it again with the new text. | Questo contratto {enviado}. Se salvi una modifica, il link che ha il locatore non sarà più valido e dovrai inviarlo di nuovo con il nuovo testo. |
| `arrendadores.editar.aviso-enviado-b` | ya se envió a firma | was already sent for signature | è già stato inviato per la firma |
| `arrendadores.editar.quien` | ¿Quién propuso el cambio? | Who proposed the change? | Chi ha proposto la modifica? |
| `arrendadores.editar.motivo` | Motivo | Reason | Motivo |
| `arrendadores.editar.motivo-ph` | Ej. pidió bajar la renta a cambio de un plazo más largo | E.g. asked to lower the rent in exchange for a longer term | Es. ha chiesto di abbassare il canone in cambio di una durata più lunga |
| `arrendadores.editar.razon-arrendador` | Razón social del arrendador | Landlord’s legal name | Ragione sociale del locatore |
| `arrendadores.editar.inicio` | Inicio | Start | Inizio |
| `arrendadores.editar.fin` | Fin | End | Fine |
| `arrendadores.editar.mayor-cero` | Tiene que ser mayor que cero | It must be greater than zero | Deve essere maggiore di zero |
| `arrendadores.editar.moneda` | Moneda | Currency | Valuta |
| `arrendadores.editar.negativo` | No puede ser negativo | It cannot be negative | Non può essere negativo |
| `arrendadores.licencias.vencio` | Venció hace {n} d | Expired {n} d ago | Scaduta da {n} g |
| `arrendadores.licencias.vence-en` | Vence en {n} d | Expires in {n} d | Scade tra {n} g |
| `arrendadores.licencias.vigente` | Vigente | Valid | Valida |
| `arrendadores.licencias.titulo` | Licencias y permisos | Permits and licenses | Licenze e permessi |
| `arrendadores.licencias.amparan` | Amparan a todas las pantallas de este predio. | They cover all the screens on this property. | Coprono tutti gli impianti di questo immobile. |
| `arrendadores.licencias.vacio` | Sin licencias registradas. Al capturar la vigencia, el sistema avisa con {n} días de anticipación. | No permits recorded. Once the expiration date is entered, the system warns {n} days ahead. | Nessuna licenza registrata. Inserendo la scadenza, il sistema avvisa con {n} giorni di anticipo. |
| `arrendadores.licencias.vence` | vence {fecha} | expires {fecha} | scade il {fecha} |
| `arrendadores.licencias.borrar` | Borrar licencia | Delete permit | Elimina licenza |
| `arrendadores.licencias.borrada` | Licencia borrada | Permit deleted | Licenza eliminata |
| `arrendadores.licencias.registrada` | Licencia registrada | Permit recorded | Licenza registrata |
| `arrendadores.licencias.alta` | Registrar licencia o permiso | Record a license or permit | Registra licenza o permesso |
| `arrendadores.licencias.alta-sub` | La fecha de vencimiento es lo que dispara el aviso | The expiration date is what triggers the warning | La data di scadenza è ciò che fa scattare l’avviso |
| `arrendadores.licencias.folio` | Folio | Permit number | Numero |
| `arrendadores.licencias.autoridad` | Autoridad que la expide | Issuing authority | Autorità che la rilascia |
| `arrendadores.licencias.expedicion` | Expedición | Issue date | Rilascio |
| `arrendadores.licencias.vencimiento` | Vencimiento | Expiration | Scadenza |
| `arrendadores.licencias.antes-expedicion` | No puede ser anterior a la expedición | Cannot be earlier than the issue date | Non può essere precedente al rilascio |
| `arrendadores.licencias.invertidas` | La licencia no puede vencer antes de expedirse. | The permit cannot expire before it is issued. | La licenza non può scadere prima di essere rilasciata. |
| `arrendadores.licencia.municipal` | Licencia municipal | Municipal license | Licenza comunale |
| `arrendadores.licencia.ambiental` | Permiso ambiental | Environmental permit | Permesso ambientale |
| `arrendadores.licencia.estructural` | Dictamen estructural | Structural inspection report | Perizia strutturale |
| `arrendadores.licencia.otro` | Permiso | Permit | Permesso |
| `arrendadores.cuadre.titulo` | Cuadre de renta por arrendador | Rent reconciliation by landlord | Riconciliazione dei canoni per locatore |
| `arrendadores.cuadre.sub` | Qué se le debe a cada uno y qué ya se le pagó. Primero quien tiene vencidos. | What is owed to each one and what has already been paid. Those with overdue payments first. | Quanto si deve a ciascuno e quanto è già stato pagato. Prima chi ha pagamenti scaduti. |
| `arrendadores.cuadre.vacio` | — Sin pagos de renta generados todavía: se calculan al capturar el importe del contrato. | — No rent payments generated yet: they are calculated when the contract amount is entered. | — Ancora nessun pagamento di canone generato: si calcolano inserendo l’importo del contratto. |
| `arrendadores.cuadre.col.arrendador` | Arrendador / emplazamiento | Landlord / placement | Locatore / postazione |
| `arrendadores.cuadre.col.vencido` | Vencido | Overdue | Scaduto |
| `arrendadores.cuadre.col.pendiente` | Pendiente | Pending | In sospeso |
| `arrendadores.cuadre.col.pagado` | Pagado | Paid | Pagato |
| `arrendadores.cuadre.col.proximo` | Próximo | Next | Prossimo |
| `arrendadores.cuadre.emplazamientos.uno` | {n} emplazamiento | {n} placement | {n} postazione |
| `arrendadores.cuadre.emplazamientos.otros` | {n} emplazamientos | {n} placements | {n} postazioni |
| `arrendadores.cuadre.predio` | Predio | Property | Immobile |
| `arrendadores.cuadre.suelta` | Pantalla suelta | Standalone screen | Impianto singolo |
| `arrendadores.cuadre.contratos.uno` | {n} contrato | {n} contract | {n} contratto |
| `arrendadores.cuadre.contratos.otros` | {n} contratos | {n} contracts | {n} contratti |
| `arrendadores.cuadre.sin-arrendador` | Sin arrendador asignado | No landlord assigned | Nessun locatore assegnato |
| `arrendadores.pagos.pagado` | Pagado | Paid | Pagato |
| `arrendadores.pagos.vencido` | Vencido | Overdue | Scaduto |
| `arrendadores.pagos.por-vencer` | Por vencer | Due soon | In scadenza |
| `arrendadores.pagos.programado` | Programado | Scheduled | Programmato |
| `arrendadores.pagos.vencidas.uno` | {n} vencida ({monto}) ·␣ | {n} overdue ({monto}) ·␣ | {n} rata scaduta ({monto}) ·␣ |
| `arrendadores.pagos.vencidas.otros` | {n} vencidas ({monto}) ·␣ | {n} overdue ({monto}) ·␣ | {n} rate scadute ({monto}) ·␣ |
| `arrendadores.pagos.por-vencer-n` | {n} por vencer ·␣ | {n} due soon ·␣ | {n} in scadenza ·␣ |
| `arrendadores.pagos.por-pagar` | {monto} por pagar | {monto} to pay | {monto} da pagare |
| `arrendadores.pagos.sin-importe.uno` | No se puede calcular lo que hay que pagar: {n} contrato sin importe capturado. {enlace} y el calendario de pagos se genera solo. | Can’t calculate what has to be paid: {n} contract without an amount. {enlace} and the payment schedule is generated automatically. | Non si può calcolare quanto c’è da pagare: {n} contratto senza importo inserito. {enlace} e il calendario dei pagamenti si genera da solo. |
| `arrendadores.pagos.sin-importe.otros` | No se puede calcular lo que hay que pagar: {n} contratos sin importe capturado. {enlace} y el calendario de pagos se genera solo. | Can’t calculate what has to be paid: {n} contracts without an amount. {enlace} and the payment schedule is generated automatically. | Non si può calcolare quanto c’è da pagare: {n} contratti senza importo inserito. {enlace} e il calendario dei pagamenti si genera da solo. |
| `arrendadores.pagos.completalo` | Complétalo en Arrendadores | Complete it in Landlords | Completalo in Locatori |
| `arrendadores.pagos.sin-pendientes` | No hay rentas pendientes de pago. | There is no rent pending payment. | Non ci sono canoni da pagare. |
| `arrendadores.pagos.vacio` | Sin pagos de renta registrados. | No rent payments recorded. | Nessun pagamento di canone registrato. |
| `arrendadores.pagos.col.vence` | Vence | Due | Scadenza |
| `arrendadores.pagos.col.monto` | Monto | Amount | Importo |
| `arrendadores.pagos.col.contrato-hasta` | Contrato hasta | Contract until | Contratto fino al |
| `arrendadores.pagos.col.pagado-el` | Pagado el | Paid on | Pagato il |
| `arrendadores.pagos.registrando` | Registrando… | Recording… | Registrazione… |
| `arrendadores.pagos.sensible` | Dar por pagada una renta es un cambio sensible: tu organización pide que vuelvas a identificarte. | Marking a rent as paid is a sensitive change: your organization asks you to confirm your identity again. | Segnare un canone come pagato è una modifica sensibile: la tua organizzazione chiede di identificarti di nuovo. |
| `arrendadores.pagos.confirmar` | Confirmar y registrar el pago | Confirm and record the payment | Conferma e registra il pagamento |
| `arrendadores.compromiso.titulo` | Renta comprometida a arrendadores | Rent committed to landlords | Canoni impegnati con i locatori |
| `arrendadores.compromiso.vacio` | No hay contratos con importe capturado todavía. | There are no contracts with an amount yet. | Non ci sono ancora contratti con importo inserito. |
| `arrendadores.compromiso.equivale` | Equivale a | Equivalent to | Equivale a |
| `arrendadores.compromiso.incompletos.uno` | El total no incluye {n} contrato incompleto: el costo real es mayor. | The total doesn’t include {n} incomplete contract: the real cost is higher. | Il totale non include {n} contratto incompleto: il costo reale è maggiore. |
| `arrendadores.compromiso.incompletos.otros` | El total no incluye {n} contratos incompletos: el costo real es mayor. | The total doesn’t include {n} incomplete contracts: the real cost is higher. | Il totale non include {n} contratti incompleti: il costo reale è maggiore. |
| `arrendadores.compromiso.incompletos-falta.uno` | El total no incluye {n} contrato incompleto (falta {falta}): el costo real es mayor. | The total doesn’t include {n} incomplete contract (missing {falta}): the real cost is higher. | Il totale non include {n} contratto incompleto (da inserire: {falta}): il costo reale è maggiore. |
| `arrendadores.compromiso.incompletos-falta.otros` | El total no incluye {n} contratos incompletos (falta {falta}): el costo real es mayor. | The total doesn’t include {n} incomplete contracts (missing {falta}): the real cost is higher. | Il totale non include {n} contratti incompleti (da inserire: {falta}): il costo reale è maggiore. |
| `arrendadores.compromiso.vencidos.uno` | Se listan {n} contrato vencido para que se vean, pero no suman al total: ya no devengan renta. Renuévalos en Arrendadores o quedarán sin cobertura. | {n} expired contract is listed so it can be seen, but it doesn’t add to the total: it no longer accrues rent. Renew it in Landlords or it will be left without coverage. | Si elenca {n} contratto scaduto perché sia visibile, ma non si somma al totale: non matura più canone. Rinnovalo in Locatori o resterà senza copertura. |
| `arrendadores.compromiso.vencidos.otros` | Se listan {n} contratos vencidos para que se vean, pero no suman al total: ya no devengan renta. Renuévalos en Arrendadores o quedarán sin cobertura. | {n} expired contracts are listed so they can be seen, but they don’t add to the total: they no longer accrue rent. Renew them in Landlords or they will be left without coverage. | Si elencano {n} contratti scaduti perché siano visibili, ma non si sommano al totale: non maturano più canone. Rinnovali in Locatori o resteranno senza copertura. |
| `arrendadores.firmas.parte.arrendador` | El arrendador (dueño del espacio) | The landlord (owner of the space) | Il locatore (proprietario dello spazio) |
| `arrendadores.firmas.parte.arrendatario` | Tu empresa (arrendataria) | Your company (lessee) | La tua azienda (conduttrice) |
| `arrendadores.firmas.no-accion` | No se pudo completar la acción | Could not complete the action | Impossibile completare l’azione |
| `arrendadores.firmas.enviado` | Documento congelado y enviado a firma | Document frozen and sent for signature | Documento congelato e inviato per la firma |
| `arrendadores.firmas.firmado` | Firmado | Signed | Firmato |
| `arrendadores.firmas.copiado` | Enlace copiado. Envíaselo al arrendador. | Link copied. Send it to the landlord. | Link copiato. Invialo al locatore. |
| `arrendadores.firmas.no-copiar` | No se pudo copiar. El enlace es: {url} | Could not copy. The link is: {url} | Impossibile copiare. Il link è: {url} |
| `arrendadores.firmas.titulo` | Firma del contrato | Contract signature | Firma del contratto |
| `arrendadores.firmas.nota` | Al enviar a firma, el sistema {congela} el texto exacto de este contrato y lo sella con SHA-256. A partir de ese momento, lo que se firma es esa versión y no «lo que diga la base de datos». Si después se edita el contrato, las firmas se marcan como invalidadas. | When you send it for signature, the system {congela} the exact text of this contract and seals it with SHA-256. From then on, what gets signed is that version and not “whatever the database says”. If the contract is edited afterwards, the signatures are marked as invalidated. | Inviando per la firma, il sistema {congela} il testo esatto di questo contratto e lo sigilla con SHA-256. Da quel momento ciò che si firma è quella versione e non «quello che dice il database». Se poi il contratto viene modificato, le firme vengono segnate come invalidate. |
| `arrendadores.firmas.congela` | congela | freezes | congela |
| `arrendadores.firmas.faltan` | No se puede enviar a firma mientras falten datos por capturar (ver arriba). | It can’t be sent for signature while there is data missing (see above). | Non si può inviare per la firma finché mancano dati da inserire (vedi sopra). |
| `arrendadores.firmas.enviar` | Enviar a firma | Send for signature | Invia per la firma |
| `arrendadores.firmas.congelado` | Documento congelado el {fecha}. Sello SHA-256: {hash} | Document frozen on {fecha}. SHA-256 seal: {hash} | Documento congelato il {fecha}. Sigillo SHA-256: {hash} |
| `arrendadores.firmas.ya-tiene` | {titulo} Si hay que modificar renta, vigencia o cualquier otra condición, edítalo desde «Editar términos» en su ficha: esta versión se archiva tal como se firmó —texto y firmas— y el contrato se vuelve a enviar a firma con los datos actuales. | {titulo} If the rent, the term or any other condition has to change, edit it from “Edit terms” in its profile: this version is archived exactly as it was signed —text and signatures— and the contract is sent for signature again with the current data. | {titulo} Se bisogna modificare canone, durata o qualsiasi altra condizione, fallo da «Modifica termini» nella sua scheda: questa versione viene archiviata così come è stata firmata —testo e firme— e il contratto viene inviato di nuovo per la firma con i dati attuali. |
| `arrendadores.firmas.ya-tiene-titulo` | Este contrato ya tiene firmas. | This contract already has signatures. | Questo contratto ha già delle firme. |
| `arrendadores.firmas.desfasado` | {titulo} Las firmas ya no corresponden al texto actual. Vuelve a enviar a firma para sellar la versión nueva y recabar las firmas otra vez. | {titulo} The signatures no longer match the current text. Send it for signature again to seal the new version and collect new signatures. | {titulo} Le firme non corrispondono più al testo attuale. Invialo di nuovo per la firma per sigillare la nuova versione e raccogliere di nuovo le firme. |
| `arrendadores.firmas.desfasado-titulo` | El contrato cambió después de congelarse. | The contract changed after it was frozen. | Il contratto è cambiato dopo essere stato congelato. |
| `arrendadores.firmas.invalidada` | Firma invalidada (el documento cambió) | Signature invalidated (the document changed) | Firma invalidata (il documento è cambiato) |
| `arrendadores.firmas.firmada` | Firmada | Signed | Firmata |
| `arrendadores.firmas.firmo` | Firmó: {nombre} · {fecha} | Signed by: {nombre} · {fecha} | Ha firmato: {nombre} · {fecha} |
| `arrendadores.firmas.ip` | IP: {ip} · Navegador: {navegador} | IP: {ip} · Browser: {navegador} | IP: {ip} · Browser: {navegador} |
| `arrendadores.firmas.documento` | Documento firmado: {hash} | Signed document: {hash} | Documento firmato: {hash} |
| `arrendadores.firmas.pendiente` | Pendiente | Pending | In sospeso |
| `arrendadores.firmas.pendiente-de` | Pendiente — se espera la firma de {nombre} | Pending — waiting for {nombre} to sign | In sospeso — si attende la firma di {nombre} |
| `arrendadores.firmas.firmando` | Firmando… | Signing… | Firma in corso… |
| `arrendadores.firmas.firmar-arrendataria` | Firmar como arrendataria | Sign as lessee | Firma come conduttrice |
| `arrendadores.firmas.copiar` | Copiar enlace de firma | Copy signature link | Copia link di firma |
| `arrendadores.firmas.envia` | Envíaselo al arrendador. Vence el {fecha}. Quien tenga el enlace puede firmar, así que trátalo como una credencial. | Send it to the landlord. It expires on {fecha}. Anyone with the link can sign, so treat it like a credential. | Invialo al locatore. Scade il {fecha}. Chi ha il link può firmare, quindi trattalo come una credenziale. |
| `arrendadores.firmas.anula` | Las firmas actuales se anulan. La versión firmada queda archivada tal como se firmó. | The current signatures are voided. The signed version stays archived exactly as it was signed. | Le firme attuali vengono annullate. La versione firmata resta archiviata così come è stata firmata. |
| `arrendadores.firmas.reenviar-archiva` | Volver a enviar a firma (archiva las firmas actuales) | Send it again for signature (archives the current signatures) | Invia di nuovo per la firma (archivia le firme attuali) |
| `arrendadores.firmas.reenviar-reinicia` | Volver a enviar a firma (reinicia las firmas) | Send it again for signature (restarts the signatures) | Invia di nuovo per la firma (azzera le firme) |
| `arrendadores.revision.domicilio-fiscal` | Domicilio fiscal | Tax address | Domicilio fiscale |
| `arrendadores.revision.representante` | Representante legal | Legal representative | Rappresentante legale |
| `arrendadores.revision.nombre` | Nombre | Name | Nome |
| `arrendadores.revision.espacio` | El espacio | The space | Lo spazio |
| `arrendadores.revision.direccion` | Dirección | Address | Indirizzo |
| `arrendadores.revision.terminos` | Términos | Terms | Termini |
| `arrendadores.revision.rango` | {desde} a {hasta} | {desde} to {hasta} | {desde} – {hasta} |
| `arrendadores.revision.titulo` | Revisa los datos que llevará el contrato | Review the data the contract will include | Controlla i dati che conterrà il contratto |
| `arrendadores.revision.nota` | Son los datos actuales. Si alguno está mal, corrígelo antes de enviar: los de tu empresa en Administración, los del arrendador en su ficha y los términos con «Editar términos». | This is the current data. If anything is wrong, fix it before sending: your company’s in Settings, the landlord’s in their profile and the terms with “Edit terms”. | Sono i dati attuali. Se qualcuno è sbagliato, correggilo prima di inviare: quelli della tua azienda in Impostazioni, quelli del locatore nella sua scheda e i termini con «Modifica termini». |
| `arrendadores.revision.fila` | {campo}: {valor} | {campo}: {valor} | {campo}: {valor} |
| `arrendadores.revision.sin-capturar` | sin capturar | not entered | non inserito |
| `arrendadores.revision.congelando` | Congelando… | Freezing… | Congelamento… |
| `arrendadores.revision.correctos` | Los datos son correctos, enviar a firma | The data is correct, send for signature | I dati sono corretti, invia per la firma |
| `arrendadores.revision.corregir` | Corregir antes | Fix it first | Correggi prima |
| `arrendadores.constancia.titulo` | Constancia de firma electrónica | Electronic signature certificate | *(constancia: tarea roja del idioma de la instancia; cae al inglés)* |
| `arrendadores.constancia.alerta` | ATENCIÓN: el contrato fue modificado después de firmarse. Las firmas marcadas abajo no corresponden al texto de este documento y no deben tenerse por válidas. | WARNING: the contract was modified after it was signed. The signatures marked below don’t match the text of this document and must not be considered valid. | *(constancia: tarea roja del idioma de la instancia; cae al inglés)* |
| `arrendadores.constancia.intro` | Este documento fue sellado el {fecha} y firmado electrónicamente por las partes que se indican. El sello SHA-256 permite verificar que el texto no ha sido alterado desde su firma. | This document was sealed on {fecha} and electronically signed by the parties listed. The SHA-256 seal makes it possible to verify that the text hasn’t been altered since it was signed. | *(constancia: tarea roja del idioma de la instancia; cae al inglés)* |
| `arrendadores.constancia.parte.arrendador` | EL ARRENDADOR | THE LANDLORD | *(constancia: tarea roja del idioma de la instancia; cae al inglés)* |
| `arrendadores.constancia.parte.arrendatario` | EL ARRENDATARIO | THE LESSEE | *(constancia: tarea roja del idioma de la instancia; cae al inglés)* |
| `arrendadores.constancia.invalidada` | ␣— FIRMA INVALIDADA | ␣— SIGNATURE INVALIDATED | *(constancia: tarea roja del idioma de la instancia; cae al inglés)* |
| `arrendadores.constancia.fecha` | Fecha y hora: {fecha} | Date and time: {fecha} | *(constancia: tarea roja del idioma de la instancia; cae al inglés)* |
| `arrendadores.constancia.ip` | Dirección IP: {ip} | IP address: {ip} | *(constancia: tarea roja del idioma de la instancia; cae al inglés)* |
| `arrendadores.constancia.ip-no` | no registrada | not recorded | *(constancia: tarea roja del idioma de la instancia; cae al inglés)* |
| `arrendadores.constancia.navegador` | Navegador: {navegador} | Browser: {navegador} | *(constancia: tarea roja del idioma de la instancia; cae al inglés)* |
| `arrendadores.constancia.navegador-no` | no registrado | not recorded | *(constancia: tarea roja del idioma de la instancia; cae al inglés)* |
| `arrendadores.constancia.sello` | Sello del documento firmado: {hash} | Seal of the signed document: {hash} | *(constancia: tarea roja del idioma de la instancia; cae al inglés)* |
| `arrendadores.constancia.nota` | Firma electrónica simple. La dirección IP y el navegador son datos que aporta el propio equipo del firmante y se conservan como indicios; no constituyen por sí solos prueba de identidad. Esta constancia no incluye certificado de e.firma del SAT ni constancia de conservación NOM-151. | Simple electronic signature. The IP address and the browser are data supplied by the signer’s own device and are kept as circumstantial evidence; on their own they are not proof of identity. This certificate doesn’t include an e.firma certificate from the SAT or a NOM-151 preservation certificate. | *(constancia: tarea roja del idioma de la instancia; cae al inglés)* |
| `arrendadores.campo.arrendador-id` | Arrendador | Landlord | Locatore |
| `arrendadores.campo.razon-social-id` | Razón social del arrendador | Landlord’s legal name | Ragione sociale del locatore |
| `arrendadores.campo.entidad-id` | Razón social que paga | Paying legal entity | Ragione sociale che paga |
| `arrendadores.campo.fecha-inicio` | Fecha de inicio | Start date | Data di inizio |
| `arrendadores.campo.fecha-fin` | Fecha de fin | End date | Data di fine |
| `arrendadores.campo.monto-renta` | Renta | Rent | Canone |
| `arrendadores.campo.periodicidad` | Periodicidad | Frequency | Periodicità |
| `arrendadores.campo.moneda` | Moneda | Currency | Valuta |
| `arrendadores.campo.deposito` | Depósito | Security deposit | Deposito cauzionale |
| `arrendadores.campo.auto-renovable` | Renovación automática | Automatic renewal | Rinnovo automatico |
| `arrendadores.campo.documento-url` | PDF del contrato | Contract PDF | PDF del contratto |
| `arrendadores.faltante.razon-empresa` | Razón social de tu empresa | Your company’s legal name | Ragione sociale della tua azienda |
| `arrendadores.faltante.rfc-empresa` | RFC de tu empresa | Your company’s RFC (tax ID) | RFC della tua azienda |
| `arrendadores.faltante.domicilio-empresa` | Domicilio fiscal de tu empresa | Your company’s tax address | Domicilio fiscale della tua azienda |
| `arrendadores.faltante.representante` | Representante legal de tu empresa | Your company’s legal representative | Rappresentante legale della tua azienda |
| `arrendadores.faltante.nombre-arrendador` | Nombre del arrendador | Landlord’s name | Nome del locatore |
| `arrendadores.faltante.rfc-arrendador` | RFC del arrendador | Landlord’s RFC (tax ID) | RFC del locatore |
| `arrendadores.faltante.domicilio-arrendador` | Domicilio del arrendador | Landlord’s address | Domicilio del locatore |
| `arrendadores.faltante.direccion-espacio` | Dirección del espacio | Address of the space | Indirizzo dello spazio |
| `arrendadores.faltante.fecha-inicio` | Fecha de inicio | Start date | Data di inizio |
| `arrendadores.faltante.fecha-fin` | Fecha de fin | End date | Data di fine |
| `arrendadores.faltante.importe` | Importe de la renta | Rent amount | Importo del canone |
| `arrendadores.faltante.periodicidad` | Periodicidad del pago | Payment frequency | Periodicità del pagamento |
| `arrendadores.donde.admin` | Administración › Datos fiscales de la empresa | Settings › Company tax details | Impostazioni › Dati fiscali dell’azienda |
| `arrendadores.donde.ficha` | Arrendadores › ficha del arrendador | Landlords › landlord profile | Locatori › scheda del locatore |
| `arrendadores.donde.contrato` | la ficha de este contrato | this contract’s profile | la scheda di questo contratto |
| `arrendadores.donde.inventario` | Inventario › ficha de la pantalla o del predio | Inventory › screen or property profile | Inventario › scheda dell’impianto o dell’immobile |
| `arrendadores.barra.nota` | En el diálogo de impresión elige «Guardar como PDF» como destino. | In the print dialog choose “Save as PDF” as the destination. | Nella finestra di stampa scegli «Salva come PDF» come destinazione. |
| `arrendadores.barra.faltan.uno` | Faltan {n} dato por capturar. | {n} field is missing. | Manca {n} dato da inserire. |
| `arrendadores.barra.faltan.otros` | Faltan {n} datos por capturar. | {n} fields are missing. | Mancano {n} dati da inserire. |
| `arrendadores.barra.en-blanco` | El documento los deja marcados en blanco en vez de inventarlos. | The document leaves them marked blank instead of making them up. | Il documento li lascia segnati in bianco invece di inventarli. |
| `arrendadores.barra.en` | En {donde}: | In {donde}: | In {donde}: |
| `arrendadores.documento.sin-permiso` | No tienes permiso para ver este contrato. | You don’t have permission to view this contract. | Non hai il permesso di vedere questo contratto. |
| `arrendadores.documento.falta-title` | Dato pendiente de capturar | Data still to be entered | Dato da inserire |
| `arrendadores.publica.no-valido` | Enlace no válido | Invalid link | Link non valido |
| `arrendadores.publica.no-valido-texto` | Este enlace de firma no existe o fue reemplazado por uno nuevo. Pide al remitente que te envíe el enlace vigente. | This signature link doesn’t exist or was replaced by a new one. Ask the sender to send you the current link. | Questo link di firma non esiste o è stato sostituito da uno nuovo. Chiedi al mittente di inviarti il link valido. |
| `arrendadores.publica.no-firmar` | No se pudo firmar | Could not sign | Impossibile firmare |
| `arrendadores.publica.firmado` | {titulo} Se registró tu firma con la fecha y hora de este momento. Puedes guardar una copia con Ctrl+P → «Guardar como PDF». | {titulo} Your signature was recorded with the date and time of this moment. You can save a copy with Ctrl+P → “Save as PDF”. | {titulo} La tua firma è stata registrata con la data e l’ora di questo momento. Puoi salvarne una copia con Ctrl+P → «Salva come PDF». |
| `arrendadores.publica.firmado-titulo` | Contrato firmado. | Contract signed. | Contratto firmato. |
| `arrendadores.publica.ya-firmada` | Este contrato ya fue firmado con este enlace. | This contract was already signed with this link. | Questo contratto è già stato firmato con questo link. |
| `arrendadores.publica.expiro` | {titulo} Pide al remitente que te envíe uno nuevo. | {titulo} Ask the sender to send you a new one. | {titulo} Chiedi al mittente di inviartene uno nuovo. |
| `arrendadores.publica.expiro-titulo` | El enlace expiró. | The link expired. | Il link è scaduto. |
| `arrendadores.publica.lee` | Lee el contrato completo. Al final encontrarás el espacio para firmarlo electrónicamente. | Read the whole contract. At the end you’ll find the space to sign it electronically. | Leggi il contratto completo. Alla fine troverai lo spazio per firmarlo elettronicamente. |
| `arrendadores.publica.expiro-h1` | El enlace expiró | The link has expired | Il link è scaduto |
| `arrendadores.publica.expiro-texto` | Por seguridad, el texto del contrato ya no se muestra desde este enlace. Pide al remitente que te envíe uno nuevo y podrás leerlo y firmarlo. | For security, the contract text is no longer shown from this link. Ask the sender to send you a new one and you’ll be able to read and sign it. | Per sicurezza, il testo del contratto non viene più mostrato da questo link. Chiedi al mittente di inviartene uno nuovo e potrai leggerlo e firmarlo. |
| `arrendadores.publica.firmar-titulo` | Firmar electrónicamente | Sign electronically | Firma elettronicamente |
| `arrendadores.publica.enviado-a` | Este contrato se envió a firma de {nombre}. | This contract was sent to {nombre} for signature. | Questo contratto è stato inviato per la firma a {nombre}. |
| `arrendadores.publica.nombre` | Escribe tu nombre completo | Type your full name | Scrivi il tuo nome completo |
| `arrendadores.publica.nombre-ph` | Nombre y apellidos | First and last name | Nome e cognome |
| `arrendadores.publica.acepto` | He leído el contrato en su totalidad y manifiesto mi voluntad de obligarme en sus términos. Acepto que mi firma electrónica producirá los mismos efectos que la firma autógrafa. | I have read the whole contract and state my will to be bound by its terms. I accept that my electronic signature will have the same effects as a handwritten signature. | Ho letto il contratto nella sua interezza e manifesto la mia volontà di obbligarmi secondo i suoi termini. Accetto che la mia firma elettronica produca gli stessi effetti della firma autografa. |
| `arrendadores.publica.firmar` | Firmar contrato | Sign contract | Firma contratto |
| `arrendadores.publica.nota` | Al firmar se registrará la fecha y hora, tu dirección IP y el navegador desde el que firmas, junto con un sello digital (SHA-256) del texto exacto que estás firmando. Ese sello permite demostrar después que el documento no se modificó. | When you sign, the date and time, your IP address and the browser you sign from will be recorded, together with a digital seal (SHA-256) of the exact text you are signing. That seal makes it possible to prove later that the document wasn’t modified. | Al momento della firma verranno registrati la data e l’ora, il tuo indirizzo IP e il browser da cui firmi, insieme a un sigillo digitale (SHA-256) del testo esatto che stai firmando. Quel sigillo permette di dimostrare in seguito che il documento non è stato modificato. |

# Tabla de revisión · lote de inglés «operaciones y clientes», ámbito operaciones

Generada el 2026-11-02 (regenerada tras la segunda vuelta de la validación ÁMBAR) a partir de `apps/web/lib/i18n/textos/operaciones.ts` y
de los usos en el código (búsqueda literal de la clave). **177 claves**
`operaciones.*`. Pantallas: `/disponibilidad` con las piezas compartidas
`SlotsBadge`, `ClientesBadge` y `CalendarioDisponibilidad` (que pinta también
Comercial), `/almacen` e `/imprenta`.

**No están en esta tabla porque no se hicieron** (siguen en español):
`/operaciones` y la ficha de la OT, `/creativos`, el Dashboard (`/inicio`),
Consumo de luz (`/energia`) y Reportes (`/reportes`).

- **español** es la copia literal de lo que decía el componente antes del lote,
  comprobado comparando el HTML rendido de **12 estados de pantalla** antes
  (fuentes de `HEAD` antes de cada commit) y después: idénticos byte a byte
  (`diff -rq`; ver `lib/i18n/pantallas-operaciones.test.ts`, con
  `I18N_VOLCAR=<carpeta>`). Incluye un español raro que se conserva tal cual:
  `operaciones.imprenta.orden.otros` es «{n} ordenes», sin tilde, como pintaba
  la pantalla.
- `␣` marca un espacio al principio o al final: es intencional.
- **Espejos:** `operaciones.almacen.tipo.*` y `operaciones.almacen.campo.*`
  reproducen `ETIQUETA_TIPO_ACTIVO` y `ETIQUETA_CAMPO` (`lib/almacen-tipos.ts`);
  lo exige `textos/operaciones.test.ts`. Las etapas de impresión reusan
  `campanas.impresion.*` (`CLAVE_IMPRESION`) y no salen aquí.
- `operaciones.calendario.dias` son las iniciales de lunes a domingo separadas
  por coma: en español el calendario sigue pintando su arreglo `DIAS`; la clave
  solo se lee en inglés.
- «qué es» lo asigna una heurística sobre cada línea de uso; si discrepa de lo
  que se ve en pantalla, manda la pantalla.

| clave | archivo:línea donde se usa | qué es | español | inglés |
|---|---|---|---|---|
| `operaciones.slots.libres-de` | `components/demo/SlotsBadge.tsx:46` | título / tooltip | {disp} de {total} slots libres | {disp} of {total} slots free |
| `operaciones.slots.total` | `components/demo/SlotsBadge.tsx:46` | título / tooltip | {total} slots | {total} slots |
| `operaciones.slots.slots` | `components/demo/SlotsBadge.tsx:50` | texto en pantalla | slots | slots |
| `operaciones.clientes-badge.libres` | `components/demo/ClientesBadge.tsx:39` | texto en pantalla | {libres} de {cupo} lugares de cliente libres | {libres} of {cupo} client openings left |
| `operaciones.clientes-badge.lleno` | `components/demo/ClientesBadge.tsx:40` | texto en pantalla | Cupo lleno: {cupo} clientes. Solo admite campañas de los que ya están. | Client cap reached: {cupo} clients. Only campaigns from clients already on this screen are accepted. |
| `operaciones.clientes-badge.clientes` | `components/demo/ClientesBadge.tsx:47` | texto en pantalla | clientes | clients |
| `operaciones.calendario.anterior` | `components/demo/CalendarioDisponibilidad.tsx:75` | etiqueta accesible (aria-label) | Mes anterior | Previous month |
| `operaciones.calendario.siguiente` | `components/demo/CalendarioDisponibilidad.tsx:88` | etiqueta accesible (aria-label) | Mes siguiente | Next month |
| `operaciones.calendario.dias` | `components/demo/CalendarioDisponibilidad.tsx:94` | texto en pantalla | L,M,M,J,V,S,D | M,T,W,T,F,S,S |
| `operaciones.calendario.confirmada` | `components/demo/CalendarioDisponibilidad.tsx:127` | texto en pantalla | confirmada | confirmed |
| `operaciones.calendario.en-propuesta` | `components/demo/CalendarioDisponibilidad.tsx:130` | texto en pantalla | en propuesta | in a proposal |
| `operaciones.disponibilidad.titulo` | `app/(app)/(shell)/disponibilidad/page.tsx:115` | texto en pantalla | Disponibilidad | Availability |
| `operaciones.disponibilidad.descripcion` | `app/(app)/(shell)/disponibilidad/page.tsx:117` | texto en pantalla | Ocupación futura por catorcena o mes: cruza las reservas confirmadas contra el inventario para ver qué tienes libre más adelante, y avisa qué está en una propuesta abierta. | Future occupancy by two-week period or month: it checks confirmed bookings against the inventory to show what you have free ahead, and flags what is in an open proposal. |
| `operaciones.disponibilidad.kpi.estaticas` | `app/(app)/(shell)/disponibilidad/page.tsx:136` | rótulo / encabezado | Estáticas libres | Free static screens |
| `operaciones.disponibilidad.kpi.de` | `app/(app)/(shell)/disponibilidad/page.tsx:137` | texto en pantalla | {n} de {total} | {n} of {total} |
| `operaciones.disponibilidad.kpi.en-periodo` | `app/(app)/(shell)/disponibilidad/page.tsx:138` | texto en pantalla | en {periodo} | in {periodo} |
| `operaciones.disponibilidad.kpi.digitales` | `app/(app)/(shell)/disponibilidad/page.tsx:143` | rótulo / encabezado | Digitales con lugar | Digital screens with room |
| `operaciones.disponibilidad.kpi.no-llenas` | `app/(app)/(shell)/disponibilidad/page.tsx:145` | texto en pantalla | no llenas en {periodo} | not full in {periodo} |
| `operaciones.disponibilidad.kpi.slots` | `app/(app)/(shell)/disponibilidad/page.tsx:150` | rótulo / encabezado | Slots libres | Free slots |
| `operaciones.disponibilidad.kpi.sumando` | `app/(app)/(shell)/disponibilidad/page.tsx:154` | texto en pantalla | sumando las digitales con lugar | across the digital screens with room |
| `operaciones.disponibilidad.kpi.ninguna-digital` | `app/(app)/(shell)/disponibilidad/page.tsx:155` | texto en pantalla | ninguna digital con lugar en el periodo | no digital screen has room in the period |
| `operaciones.disponibilidad.kpi.en-propuesta` | `app/(app)/(shell)/disponibilidad/page.tsx:160` | rótulo / encabezado | En propuesta | In a proposal |
| `operaciones.disponibilidad.kpi.piden.uno` | `app/(app)/(shell)/disponibilidad/page.tsx:166` | texto en pantalla | pantallas que piden {n} propuesta abierta · no bloquean | screens requested by {n} open proposal · not blocking |
| `operaciones.disponibilidad.kpi.piden.otros` | `app/(app)/(shell)/disponibilidad/page.tsx:167` | etiqueta de un valor (mapa de claves) | pantallas que piden {n} propuestas abiertas · no bloquean | screens requested by {n} open proposals · not blocking |
| `operaciones.disponibilidad.kpi.ninguna-pide` | `app/(app)/(shell)/disponibilidad/page.tsx:170` | texto en pantalla | ninguna propuesta abierta las pide | no open proposal requests them |
| `operaciones.disponibilidad.desde` | `app/(app)/(shell)/disponibilidad/page.tsx:185`<br>`app/(app)/(shell)/disponibilidad/page.tsx:186` | etiqueta accesible (aria-label) · título / tooltip | Desde | From |
| `operaciones.disponibilidad.vista` | `app/(app)/(shell)/disponibilidad/page.tsx:192` | etiqueta accesible (aria-label) | Vista | View |
| `operaciones.disponibilidad.catorcena` | `app/(app)/(shell)/disponibilidad/page.tsx:205` | texto en pantalla | Catorcena | Two-week period |
| `operaciones.disponibilidad.mes` | `app/(app)/(shell)/disponibilidad/page.tsx:205` | texto en pantalla | Mes | Month |
| `operaciones.disponibilidad.periodos` | `app/(app)/(shell)/disponibilidad/page.tsx:211` | etiqueta accesible (aria-label) | Periodos | Periods |
| `operaciones.disponibilidad.periodos-title` | `app/(app)/(shell)/disponibilidad/page.tsx:212` | título / tooltip | Periodos a mostrar | Periods to show |
| `operaciones.disponibilidad.n-periodos` | `app/(app)/(shell)/disponibilidad/page.tsx:219` | texto en pantalla | {n} periodos | {n} periods |
| `operaciones.disponibilidad.buscar-aria` | `app/(app)/(shell)/disponibilidad/page.tsx:227` | etiqueta accesible (aria-label) | Buscar pantalla | Search screen |
| `operaciones.disponibilidad.buscar` | `app/(app)/(shell)/disponibilidad/page.tsx:230` | texto de ejemplo (placeholder) | Buscar pantalla: nombre o clave… | Search screen: name or code… |
| `operaciones.disponibilidad.solo-hueco` | `app/(app)/(shell)/disponibilidad/page.tsx:250` | texto en pantalla | Solo con hueco libre | Only with availability |
| `operaciones.disponibilidad.calendario` | `app/(app)/(shell)/disponibilidad/page.tsx:258` | rótulo / encabezado | Calendario por pantalla | Calendar by screen |
| `operaciones.disponibilidad.calendario-sub` | `app/(app)/(shell)/disponibilidad/page.tsx:259` | rótulo / encabezado | Cada celda dice su estado; pasa el cursor para ver qué campaña la ocupa. | Each cell shows its status; hover over it to see which campaign takes it. |
| `operaciones.disponibilidad.cargando` | `app/(app)/(shell)/disponibilidad/page.tsx:264` | texto en pantalla | Cargando disponibilidad… | Loading availability… |
| `operaciones.disponibilidad.sin-coincidencias` | `app/(app)/(shell)/disponibilidad/page.tsx:268` | texto en pantalla | Sin pantallas que coincidan. | No matching screens. |
| `operaciones.disponibilidad.pantalla` | `app/(app)/(shell)/disponibilidad/page.tsx:276` | texto en pantalla | Pantalla | Screen |
| `operaciones.disponibilidad.digital` | `app/(app)/(shell)/disponibilidad/page.tsx:301` | texto en pantalla | digital | digital |
| `operaciones.disponibilidad.libres-de` | `app/(app)/(shell)/disponibilidad/page.tsx:306` | texto en pantalla | {n} de {total} libres | {n} of {total} free |
| `operaciones.disponibilidad.ocupante` | `app/(app)/(shell)/disponibilidad/page.tsx:321` | texto en pantalla | {campana} (confirmada) | {campana} (confirmed) |
| `operaciones.disponibilidad.ocupante-slots` | `app/(app)/(shell)/disponibilidad/page.tsx:320` | texto en pantalla | {campana} (confirmada, {spots} slots) | {campana} (confirmed, {spots} slots) |
| `operaciones.disponibilidad.quedan` | `app/(app)/(shell)/disponibilidad/page.tsx:325` | texto en pantalla | Quedan {libres} de {total} slots | {libres} of {total} slots left |
| `operaciones.disponibilidad.libre-slots` | `app/(app)/(shell)/disponibilidad/page.tsx:328` | texto en pantalla | Libre: {n} slots | Free: {n} slots |
| `operaciones.disponibilidad.libre` | `app/(app)/(shell)/disponibilidad/page.tsx:329`<br>`app/(app)/(shell)/disponibilidad/page.tsx:361` | texto en pantalla | Libre | Free |
| `operaciones.disponibilidad.en-propuesta-titulo` | `app/(app)/(shell)/disponibilidad/page.tsx:331` | texto en pantalla | En propuesta {folio}{cliente} ({desde} a {hasta}{spots}) | In proposal {folio}{cliente} ({desde} to {hasta}{spots}) |
| `operaciones.disponibilidad.en-propuesta-spots` | `app/(app)/(shell)/disponibilidad/page.tsx:336` | texto en pantalla | , {n} spots | , {n} spots |
| `operaciones.disponibilidad.celda.libres.uno` | `app/(app)/(shell)/disponibilidad/page.tsx:353` | texto en pantalla | {n} libre | {n} free |
| `operaciones.disponibilidad.celda.libres.otros` | `app/(app)/(shell)/disponibilidad/page.tsx:354` | etiqueta de un valor (mapa de claves) | {n} libres | {n} free |
| `operaciones.disponibilidad.celda.lleno` | `app/(app)/(shell)/disponibilidad/page.tsx:357` | texto en pantalla | Lleno | Full |
| `operaciones.disponibilidad.celda.en-propuesta` | `app/(app)/(shell)/disponibilidad/page.tsx:360` | texto en pantalla | En propuesta | In a proposal |
| `operaciones.disponibilidad.celda.usados` | `app/(app)/(shell)/disponibilidad/page.tsx:363` | texto en pantalla | {n} usados | {n} used |
| `operaciones.disponibilidad.celda.ocupada` | `app/(app)/(shell)/disponibilidad/page.tsx:364` | texto en pantalla | Ocupada | Occupied |
| `operaciones.disponibilidad.leyenda.libre` | `app/(app)/(shell)/disponibilidad/page.tsx:381` | texto en pantalla | Libre | Free |
| `operaciones.disponibilidad.leyenda.en-propuesta` | `app/(app)/(shell)/disponibilidad/page.tsx:384` | texto en pantalla | En propuesta (libre, pero una propuesta abierta la pide) | In a proposal (free, but an open proposal requests it) |
| `operaciones.disponibilidad.leyenda.parcial` | `app/(app)/(shell)/disponibilidad/page.tsx:387` | texto en pantalla | Parcial (digital: el número son los slots que quedan libres) | Partial (digital: the number is the slots still free) |
| `operaciones.disponibilidad.leyenda.ocupada` | `app/(app)/(shell)/disponibilidad/page.tsx:390` | texto en pantalla | Ocupada | Occupied |
| `operaciones.almacen.titulo` | `app/(app)/(shell)/almacen/page.tsx:137` | texto en pantalla | Almacén | Warehouse |
| `operaciones.almacen.descripcion` | `app/(app)/(shell)/almacen/page.tsx:138` | texto en pantalla | Vehículos, herramientas, pantallas, cámaras y demás artículos, y sus traslados. | Vehicles, tools, screens, cameras and other items, and their transfers. |
| `operaciones.almacen.registrar-articulo` | `app/(app)/(shell)/almacen/page.tsx:141`<br>`app/(app)/(shell)/almacen/page.tsx:196`<br>`app/(app)/(shell)/almacen/page.tsx:313` | texto en pantalla · título / tooltip | Registrar artículo | Register item |
| `operaciones.almacen.estado.en-almacen` | `app/(app)/(shell)/almacen/page.tsx:69` | rótulo / encabezado | En almacén | In warehouse |
| `operaciones.almacen.estado.instalado` | `app/(app)/(shell)/almacen/page.tsx:70` | rótulo / encabezado | Instalado | Installed |
| `operaciones.almacen.estado.en-traslado` | `app/(app)/(shell)/almacen/page.tsx:71` | rótulo / encabezado | En traslado | In transit |
| `operaciones.almacen.estado.baja` | `app/(app)/(shell)/almacen/page.tsx:72` | rótulo / encabezado | Baja | Decommissioned |
| `operaciones.almacen.mov.entrada` | `app/(app)/(shell)/almacen/page.tsx:83` | etiqueta de un valor (mapa de claves) | Regresar a almacén | Return to warehouse |
| `operaciones.almacen.mov.salida` | `app/(app)/(shell)/almacen/page.tsx:84` | etiqueta de un valor (mapa de claves) | Instalar en pantalla | Install on a screen |
| `operaciones.almacen.mov.traslado` | `app/(app)/(shell)/almacen/page.tsx:85` | etiqueta de un valor (mapa de claves) | Marcar en traslado | Mark in transit |
| `operaciones.almacen.mov.baja` | `app/(app)/(shell)/almacen/page.tsx:86` | etiqueta de un valor (mapa de claves) | Dar de baja | Decommission |
| `operaciones.almacen.tipo.vehiculo` | `app/(app)/(shell)/almacen/page.tsx:41` | etiqueta de un valor (mapa de claves) | Vehículo / camioneta | Vehicle / van |
| `operaciones.almacen.tipo.herramienta` | `app/(app)/(shell)/almacen/page.tsx:42` | etiqueta de un valor (mapa de claves) | Herramienta | Tool |
| `operaciones.almacen.tipo.pantalla` | `app/(app)/(shell)/almacen/page.tsx:43` | etiqueta de un valor (mapa de claves) | Pantalla | Screen |
| `operaciones.almacen.tipo.equipo` | `app/(app)/(shell)/almacen/page.tsx:44` | etiqueta de un valor (mapa de claves) | Equipo electrónico | Electronic equipment |
| `operaciones.almacen.tipo.camara` | `app/(app)/(shell)/almacen/page.tsx:45` | etiqueta de un valor (mapa de claves) | Cámara | Camera |
| `operaciones.almacen.tipo.estructura` | `app/(app)/(shell)/almacen/page.tsx:46` | etiqueta de un valor (mapa de claves) | Estructura | Structure |
| `operaciones.almacen.tipo.lona` | `app/(app)/(shell)/almacen/page.tsx:47` | etiqueta de un valor (mapa de claves) | Lona | Vinyl banner |
| `operaciones.almacen.tipo.otro` | `app/(app)/(shell)/almacen/page.tsx:48` | etiqueta de un valor (mapa de claves) | Otro | Other |
| `operaciones.almacen.campo.marca` | `app/(app)/(shell)/almacen/page.tsx:51` | etiqueta de un valor (mapa de claves) | Marca | Brand |
| `operaciones.almacen.campo.modelo` | `app/(app)/(shell)/almacen/page.tsx:52` | etiqueta de un valor (mapa de claves) | Modelo | Model |
| `operaciones.almacen.campo.numero-serie` | `app/(app)/(shell)/almacen/page.tsx:53` | etiqueta de un valor (mapa de claves) | Número de serie | Serial number |
| `operaciones.almacen.campo.placas` | `app/(app)/(shell)/almacen/page.tsx:54` | etiqueta de un valor (mapa de claves) | Placas | License plate |
| `operaciones.almacen.campo.vin` | `app/(app)/(shell)/almacen/page.tsx:334` | rótulo / encabezado | Número de serie (VIN) | Serial number (VIN) |
| `operaciones.almacen.no-cargar` | `app/(app)/(shell)/almacen/page.tsx:121` | aviso (toast) | No se pudo cargar el almacén | The warehouse could not be loaded |
| `operaciones.almacen.error-desconocido` | `app/(app)/(shell)/almacen/page.tsx:126` | mensaje de error | error desconocido | unknown error |
| `operaciones.almacen.indicadores` | `app/(app)/(shell)/almacen/page.tsx:149` | rótulo / encabezado | Indicadores | Indicators |
| `operaciones.almacen.kpi.articulos` | `app/(app)/(shell)/almacen/page.tsx:158` | rótulo / encabezado | Artículos | Items |
| `operaciones.almacen.kpi.baja.uno` | `app/(app)/(shell)/almacen/page.tsx:162` | etiqueta de un valor (mapa de claves) | {n} dado de baja | {n} decommissioned |
| `operaciones.almacen.kpi.baja.otros` | `app/(app)/(shell)/almacen/page.tsx:162` | etiqueta de un valor (mapa de claves) | {n} dados de baja | {n} decommissioned |
| `operaciones.almacen.kpi.ninguno-baja` | `app/(app)/(shell)/almacen/page.tsx:163` | texto en pantalla | ninguno dado de baja | none decommissioned |
| `operaciones.almacen.kpi.instalados` | `app/(app)/(shell)/almacen/page.tsx:167` | rótulo / encabezado | Instalados | Installed |
| `operaciones.almacen.kpi.en-pantalla` | `app/(app)/(shell)/almacen/page.tsx:167` | rótulo / encabezado | en una pantalla | on a screen |
| `operaciones.almacen.kpi.en-almacen` | `app/(app)/(shell)/almacen/page.tsx:168` | rótulo / encabezado | En almacén | In warehouse |
| `operaciones.almacen.kpi.guardados` | `app/(app)/(shell)/almacen/page.tsx:168` | rótulo / encabezado | guardados en bodega | stored in a depot |
| `operaciones.almacen.kpi.en-traslado` | `app/(app)/(shell)/almacen/page.tsx:169` | rótulo / encabezado | En traslado | In transit |
| `operaciones.almacen.kpi.en-camino` | `app/(app)/(shell)/almacen/page.tsx:169` | rótulo / encabezado | en camino | on the way |
| `operaciones.almacen.articulos` | `app/(app)/(shell)/almacen/page.tsx:181` | rótulo / encabezado | Artículos | Items |
| `operaciones.almacen.fallo` | `app/(app)/(shell)/almacen/page.tsx:187` | texto en pantalla | No se pudo cargar el almacén — {error} | The warehouse could not be loaded — {error} |
| `operaciones.almacen.reintentar` | `app/(app)/(shell)/almacen/page.tsx:188` | texto en pantalla | Reintentar | Retry |
| `operaciones.almacen.vacio` | `app/(app)/(shell)/almacen/page.tsx:193` | texto en pantalla | Aún no hay artículos. Registra vehículos, herramientas, pantallas o cámaras para seguir dónde está cada uno. | No items yet. Register vehicles, tools, screens or cameras to track where each one is. |
| `operaciones.almacen.pide` | `app/(app)/(shell)/almacen/page.tsx:198` | texto en pantalla | Pide a Operaciones que los registre. | Ask Operations to register them. |
| `operaciones.almacen.filtrar` | `app/(app)/(shell)/almacen/page.tsx:203` | etiqueta accesible (aria-label) | Filtrar por tipo | Filter by type |
| `operaciones.almacen.todos` | `app/(app)/(shell)/almacen/page.tsx:204` | rótulo / encabezado | Todos | All |
| `operaciones.almacen.col.etiqueta` | `app/(app)/(shell)/almacen/page.tsx:213` | rótulo / encabezado | Etiqueta | Tag |
| `operaciones.almacen.col.descripcion` | `app/(app)/(shell)/almacen/page.tsx:214` | rótulo / encabezado | Descripción | Description |
| `operaciones.almacen.col.tipo` | `app/(app)/(shell)/almacen/page.tsx:215` | rótulo / encabezado | Tipo | Type |
| `operaciones.almacen.col.datos` | `app/(app)/(shell)/almacen/page.tsx:216` | rótulo / encabezado | Datos | Details |
| `operaciones.almacen.col.estado` | `app/(app)/(shell)/almacen/page.tsx:217` | rótulo / encabezado | Estado | Status |
| `operaciones.almacen.col.ubicacion` | `app/(app)/(shell)/almacen/page.tsx:218` | rótulo / encabezado | Ubicación | Location |
| `operaciones.almacen.en-pantalla` | `app/(app)/(shell)/almacen/page.tsx:236` | texto en pantalla | En pantalla:␣ | On screen:␣ |
| `operaciones.almacen.bodega` | `app/(app)/(shell)/almacen/page.tsx:236` | texto en pantalla | Bodega:␣ | Depot:␣ |
| `operaciones.almacen.mover` | `app/(app)/(shell)/almacen/page.tsx:247` | texto en pantalla | Mover | Move |
| `operaciones.almacen.placas` | `app/(app)/(shell)/almacen/page.tsx:423` | texto en pantalla | Placas {placas} | Plate {placas} |
| `operaciones.almacen.alta.registrado` | `app/(app)/(shell)/almacen/page.tsx:304` | aviso (toast) | Activo registrado en almacén | Item registered in the warehouse |
| `operaciones.almacen.alta.no-registrar` | `app/(app)/(shell)/almacen/page.tsx:307` | aviso (toast) | No se pudo registrar | Could not register |
| `operaciones.almacen.alta.subtitulo` | `app/(app)/(shell)/almacen/page.tsx:313` | título / tooltip | Entra al almacén | It goes into the warehouse |
| `operaciones.almacen.alta.registrar` | `app/(app)/(shell)/almacen/page.tsx:318` | texto en pantalla | Registrar | Register |
| `operaciones.almacen.alta.etiqueta` | `app/(app)/(shell)/almacen/page.tsx:324` | texto de ejemplo (placeholder) | Etiqueta / número de inventario | Tag / inventory number |
| `operaciones.almacen.alta.etiqueta-ej` | `app/(app)/(shell)/almacen/page.tsx:324` | texto de ejemplo (placeholder) | Ej. INV-0231 | E.g. INV-0231 |
| `operaciones.almacen.alta.descripcion` | `app/(app)/(shell)/almacen/page.tsx:325` | texto de ejemplo (placeholder) | Descripción | Description |
| `operaciones.almacen.alta.descripcion-ej` | `app/(app)/(shell)/almacen/page.tsx:325` | texto de ejemplo (placeholder) | Ej. Camioneta Nissan NP300 / Pantalla LED 4x3 m | E.g. Nissan NP300 van / 4x3 m LED screen |
| `operaciones.almacen.alta.tipo` | `app/(app)/(shell)/almacen/page.tsx:326` | rótulo / encabezado | Tipo | Type |
| `operaciones.almacen.alta.donde` | `app/(app)/(shell)/almacen/page.tsx:346` | texto de ejemplo (placeholder) | Dónde se guarda | Where it is stored |
| `operaciones.almacen.alta.donde-ej` | `app/(app)/(shell)/almacen/page.tsx:346` | texto de ejemplo (placeholder) | Ej. Bodega norte, anaquel 3 | E.g. North depot, shelf 3 |
| `operaciones.almacen.alta.notas` | `app/(app)/(shell)/almacen/page.tsx:347` | rótulo / encabezado | Notas | Notes |
| `operaciones.almacen.ej` | `app/(app)/(shell)/almacen/page.tsx:340` | texto de ejemplo (placeholder) | Ej. {ejemplo} | E.g. {ejemplo} |
| `operaciones.almacen.mover.registrado` | `app/(app)/(shell)/almacen/page.tsx:371` | aviso (toast) | Movimiento registrado | Movement recorded |
| `operaciones.almacen.mover.no-mover` | `app/(app)/(shell)/almacen/page.tsx:374` | aviso (toast) | No se pudo mover | Could not move |
| `operaciones.almacen.mover.titulo` | `app/(app)/(shell)/almacen/page.tsx:380` | título / tooltip | Mover activo | Move item |
| `operaciones.almacen.mover.registrar` | `app/(app)/(shell)/almacen/page.tsx:384` | texto en pantalla | Registrar movimiento | Record movement |
| `operaciones.almacen.mover.movimiento` | `app/(app)/(shell)/almacen/page.tsx:389` | rótulo / encabezado | Movimiento | Movement |
| `operaciones.almacen.mover.destino` | `app/(app)/(shell)/almacen/page.tsx:395` | rótulo / encabezado | Pantalla destino | Destination screen |
| `operaciones.almacen.mover.elige` | `app/(app)/(shell)/almacen/page.tsx:397` | opción de lista | — Elige — | — Choose — |
| `operaciones.almacen.mover.motivo` | `app/(app)/(shell)/almacen/page.tsx:402` | texto de ejemplo (placeholder) | Motivo / nota | Reason / note |
| `operaciones.almacen.mover.motivo-ej` | `app/(app)/(shell)/almacen/page.tsx:402` | texto de ejemplo (placeholder) | Ej. Retiro por fin de contrato | E.g. Removed at the end of the contract |
| `operaciones.imprenta.no-avanzar` | `app/(app)/(shell)/imprenta/page.tsx:66` | aviso (toast) | No se pudo avanzar la orden | The order could not be advanced |
| `operaciones.imprenta.titulo` | `app/(app)/(shell)/imprenta/page.tsx:77` | texto en pantalla | Imprenta | Printing |
| `operaciones.imprenta.descripcion` | `app/(app)/(shell)/imprenta/page.tsx:78` | texto en pantalla | Órdenes de impresión · del arte al montaje | Print orders · from artwork to installation |
| `operaciones.imprenta.nueva` | `app/(app)/(shell)/imprenta/page.tsx:82`<br>`app/(app)/(shell)/imprenta/page.tsx:164` | texto en pantalla | Nueva orden | New order |
| `operaciones.imprenta.kpi.en-proceso` | `app/(app)/(shell)/imprenta/page.tsx:100` | rótulo / encabezado | En proceso | In progress |
| `operaciones.imprenta.kpi.en-proceso-sub` | `app/(app)/(shell)/imprenta/page.tsx:102` | texto en pantalla | aún no están listas para montaje | not ready to install yet |
| `operaciones.imprenta.kpi.prueba` | `app/(app)/(shell)/imprenta/page.tsx:105` | rótulo / encabezado | Prueba de color pendiente | Color proof pending |
| `operaciones.imprenta.kpi.sin-aprobar` | `app/(app)/(shell)/imprenta/page.tsx:107` | texto en pantalla | sin aprobar | not approved |
| `operaciones.imprenta.kpi.en-produccion` | `app/(app)/(shell)/imprenta/page.tsx:111` | rótulo / encabezado | En producción | In production |
| `operaciones.imprenta.kpi.en-produccion-sub` | `app/(app)/(shell)/imprenta/page.tsx:113` | texto en pantalla | en producción o ya impresas | in production or already printed |
| `operaciones.imprenta.kpi.listas` | `app/(app)/(shell)/imprenta/page.tsx:116` | rótulo / encabezado | Listas para montaje | Ready to install |
| `operaciones.imprenta.kpi.listas-sub` | `app/(app)/(shell)/imprenta/page.tsx:118` | texto en pantalla | pasan a una OT | they move on to a work order |
| `operaciones.imprenta.ordenes` | `app/(app)/(shell)/imprenta/page.tsx:141` | rótulo / encabezado | Órdenes de impresión | Print orders |
| `operaciones.imprenta.orden.uno` | `app/(app)/(shell)/imprenta/page.tsx:145` | etiqueta de un valor (mapa de claves) | {n} orden | {n} order |
| `operaciones.imprenta.orden.otros` | `app/(app)/(shell)/imprenta/page.tsx:145` | etiqueta de un valor (mapa de claves) | {n} ordenes | {n} orders |
| `operaciones.imprenta.vacia` | `app/(app)/(shell)/imprenta/page.tsx:159` | rótulo / encabezado | Sin órdenes de impresión | No print orders |
| `operaciones.imprenta.vacia-detalle` | `app/(app)/(shell)/imprenta/page.tsx:160` | texto en pantalla | Crea una orden ligada a una campaña fija (OOH/híbrida) para llevar el proceso del arte al montaje. | Create an order linked to a fixed campaign (OOH/hybrid) to track the process from artwork to installation. |
| `operaciones.imprenta.sin-material` | `app/(app)/(shell)/imprenta/page.tsx:186` | texto en pantalla | Sin material | No material |
| `operaciones.imprenta.contenido-digital` | `app/(app)/(shell)/imprenta/page.tsx:191` | texto en pantalla | Contenido digital | Digital content |
| `operaciones.imprenta.campana` | `app/(app)/(shell)/imprenta/page.tsx:201`<br>`app/(app)/(shell)/imprenta/page.tsx:204` | texto en pantalla | Campaña: {nombre} | Campaign: {nombre} |
| `operaciones.imprenta.sin-campana` | `app/(app)/(shell)/imprenta/page.tsx:207` | texto en pantalla | Sin campaña | No campaign |
| `operaciones.imprenta.paso` | `app/(app)/(shell)/imprenta/page.tsx:219` | texto en pantalla | Paso {n} de {total} | Step {n} of {total} |
| `operaciones.imprenta.prueba-aprobada` | `app/(app)/(shell)/imprenta/page.tsx:233` | texto en pantalla | Prueba de color: Aprobada | Color proof: Approved |
| `operaciones.imprenta.prueba-pendiente` | `app/(app)/(shell)/imprenta/page.tsx:233` | texto en pantalla | Prueba de color: Pendiente | Color proof: Pending |
| `operaciones.imprenta.error` | `app/(app)/(shell)/imprenta/page.tsx:243` | aviso (toast) | Error | Error |
| `operaciones.imprenta.aprobar-prueba` | `app/(app)/(shell)/imprenta/page.tsx:246` | texto en pantalla | Aprobar prueba | Approve proof |
| `operaciones.imprenta.avanzando` | `app/(app)/(shell)/imprenta/page.tsx:256` | texto en pantalla | Avanzando… | Advancing… |
| `operaciones.imprenta.avanzar` | `app/(app)/(shell)/imprenta/page.tsx:256` | texto en pantalla | Avanzar | Advance |
| `operaciones.imprenta.no-crear` | `app/(app)/(shell)/imprenta/page.tsx:305` | aviso (toast) | No se pudo crear la orden | The order could not be created |
| `operaciones.imprenta.nueva-titulo` | `app/(app)/(shell)/imprenta/page.tsx:314` | título / tooltip | Nueva orden de impresión | New print order |
| `operaciones.imprenta.creando` | `app/(app)/(shell)/imprenta/page.tsx:319` | texto en pantalla | Creando… | Creating… |
| `operaciones.imprenta.crear` | `app/(app)/(shell)/imprenta/page.tsx:319` | texto en pantalla | Crear orden | Create order |
| `operaciones.imprenta.campo.campana` | `app/(app)/(shell)/imprenta/page.tsx:325` | rótulo / encabezado | Campaña | Campaign |
| `operaciones.imprenta.selecciona-campana` | `app/(app)/(shell)/imprenta/page.tsx:331` | opción de lista | Selecciona una campaña… | Select a campaign… |
| `operaciones.imprenta.campo.sitio` | `app/(app)/(shell)/imprenta/page.tsx:339` | rótulo / encabezado | Sitio | Site |
| `operaciones.imprenta.campo.material` | `app/(app)/(shell)/imprenta/page.tsx:351` | rótulo / encabezado | Material | Material |
| `operaciones.imprenta.campo.material-ej` | `app/(app)/(shell)/imprenta/page.tsx:355` | texto de ejemplo (placeholder) | Lona front, vinil, contenido digital… | Front-lit vinyl, vinyl, digital content… |
| `operaciones.imprenta.campo.ancho` | `app/(app)/(shell)/imprenta/page.tsx:360` | rótulo / encabezado | Ancho (m) | Width (m) |
| `operaciones.imprenta.campo.alto` | `app/(app)/(shell)/imprenta/page.tsx:367` | rótulo / encabezado | Alto (m) | Height (m) |
| `operaciones.imprenta.campo.proveedor` | `app/(app)/(shell)/imprenta/page.tsx:375` | rótulo / encabezado | Proveedor | Supplier |
| `operaciones.imprenta.campo.proveedor-ej` | `app/(app)/(shell)/imprenta/page.tsx:379` | texto de ejemplo (placeholder) | Imprenta proveedora | Print shop |
| `operaciones.imprenta.digital-ayuda` | `app/(app)/(shell)/imprenta/page.tsx:383` | texto en pantalla | Deja ancho y alto en 0 para contenido digital. | Leave width and height at 0 for digital content. |

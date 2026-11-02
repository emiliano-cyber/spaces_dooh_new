# Tabla de revisión · lote de inglés «servidor» (ola 4)

Generada el 2026-11-02 en la rama `feat/ingles-servidor` (sale de
`integra/ingles` en `0ceacb0b`), leyendo `apps/web/lib/i18n/textos/servidor.ts`,
`PATRONES_ERROR` de `apps/web/lib/i18n/errores-servidor.ts` y los usos en el
código (búsqueda literal de la clave). **31 claves y 38 patrones nuevos.**

- **español** es la copia literal de lo que ya decía el módulo o el
  `new AppError(...)`; no se tocó ni una letra. Lo comprueban
  `lib/i18n/textos/servidor.test.ts` (el diccionario contra el módulo) y
  `lib/i18n/errores-servidor-plantillas.test.ts` (cada plantilla del árbol
  armada con valores de ejemplo: `traducirError(m, 'es') === m`).
- Además, el HTML de las cuatro pruebas de pantallas (**109 estados**) volcado
  con los archivos de `0ceacb0b` y con los de la rama: `diff -rq` vacío.
- Los **patrones** reconocen el mensaje YA ARMADO en español y lo rearman en
  inglés. `$n` es el hueco n, conservado; `{n|uno|otros}` es su plural. La
  columna «huecos con tabla» dice qué huecos traen español armado por el
  servidor y se traducen con una tabla cerrada (periodicidad, etapa, faltantes,
  bloqueos de un cliente, «sin fecha», la pantalla y el predio lejanos).
- Las claves sin huecos alimentan `CATALOGO_LIB`: el servidor dice en inglés
  exactamente lo que la pantalla.
- Lo que es REGISTRO (Actividad, `acciones`, bitácora) **no** se tradujo.

## Las claves (`textos/servidor.ts`)

| clave | español | inglés | dónde |
|---|---|---|---|
| `servidor.negociacion.etapa-no-existe` | Esa etapa de la búsqueda del responsable no existe | That stage of finding the decision-maker does not exist | lib/negociacion.ts:89 |
| `servidor.negociacion.falta-quien-firma` | Para confirmar al responsable legal, marca primero qué contacto firma | To confirm the legal representative, first mark which contact signs | lib/negociacion.ts:95 |
| `servidor.negociacion.quitar-quien-firma` | Es quien firma y el responsable legal ya está confirmado: marca antes a otro contacto que firme, o baja la etapa | This is the contact who signs and the legal representative is already confirmed: first mark another contact who signs, or move the stage back | lib/negociacion.ts:119 |
| `servidor.negociacion.presupuesto` | El mínimo del presupuesto no puede ser mayor que el máximo | The minimum budget cannot be greater than the maximum | lib/negociacion.ts:126 |
| `servidor.negociacion.oferta-cerrada.aceptada` | Esa oferta ya está aceptada: haz una nueva versión | That offer is already accepted: make a new version | lib/negociacion.ts:143 |
| `servidor.negociacion.oferta-cerrada.rechazada` | Esa oferta ya está rechazada: haz una nueva versión | That offer is already rejected: make a new version | lib/negociacion.ts:143 |
| `servidor.negociacion.perdido` | El espacio está perdido: ya solo admite notas | The space is lost: it only accepts notes now | lib/negociacion.ts:164 |
| `servidor.negociacion.en-revision` | Está en revisión: espera la decisión antes de cambiar la ficha | It is in review: wait for the decision before changing the spec sheet | lib/negociacion.ts:167 |
| `servidor.horario.formato` | Las horas van como HH:mm, por ejemplo 07:30 | Times go as HH:mm, for example 07:30 | lib/doohmain-programacion.ts:68 |
| `servidor.horario.iguales` | La hora de inicio y la de fin no pueden ser iguales | The start time and the end time cannot be the same | lib/doohmain-programacion.ts:69 |
| `servidor.horario.sin-dias` | Elige al menos un día, o ninguno para que sean todos | Choose at least one day, or none so that it runs every day | lib/doohmain-programacion.ts:71 |
| `servidor.horario.dia-no-existe` | Ese día de la semana no existe | That day of the week does not exist | lib/doohmain-programacion.ts:72 |
| `servidor.horario.dia-repetido` | Hay un día repetido | A day is repeated | lib/doohmain-programacion.ts:73 |
| `servidor.ubicacion.vacio` | Escribe una dirección, pega unas coordenadas (19.4326, -99.1332) o un enlace de Google Maps | Enter an address, paste coordinates (19.4326, -99.1332) or a Google Maps link | `lib/interpretar-ubicacion.ts` (`CLAVE_DEL_MOTIVO`) y `CATALOGO_LIB` |
| `servidor.ubicacion.otro-dominio` | Solo se aceptan enlaces de Google Maps (google.com/maps o maps.app.goo.gl) | Only Google Maps links are accepted (google.com/maps or maps.app.goo.gl) | `lib/interpretar-ubicacion.ts` (`CLAVE_DEL_MOTIVO`) y `CATALOGO_LIB` |
| `servidor.ubicacion.sin-coordenadas` | Ese enlace de Google Maps no trae coordenadas. En Google Maps toca el lugar, copia las coordenadas que salen arriba y pégalas aquí | That Google Maps link has no coordinates. In Google Maps click the place, copy the coordinates shown at the top and paste them here | `lib/interpretar-ubicacion.ts` (`CLAVE_DEL_MOTIVO`) y `CATALOGO_LIB` |
| `servidor.ubicacion.enlace-corto` | Ese enlace corto no es de Google Maps, o le falta el final | That short link is not from Google Maps, or its ending is missing | `lib/interpretar-ubicacion.ts` (`CLAVE_DEL_MOTIVO`) y `CATALOGO_LIB` |
| `servidor.ubicacion.latitud` | La latitud va de -90 a 90. ¿Están al revés? Primero va la latitud (en México, alrededor de 14 a 33) | Latitude goes from -90 to 90. Are they reversed? Latitude comes first (in Mexico, around 14 to 33) | `lib/interpretar-ubicacion.ts` (`CLAVE_DEL_MOTIVO`) y `CATALOGO_LIB` |
| `servidor.ubicacion.longitud` | La longitud va de -180 a 180 | Longitude goes from -180 to 180 | `lib/interpretar-ubicacion.ts` (`CLAVE_DEL_MOTIVO`) y `CATALOGO_LIB` |
| `servidor.ubicacion.cero` | El punto (0, 0) está en el mar: no es una ubicación | The point (0, 0) is in the ocean: it is not a location | `lib/interpretar-ubicacion.ts` (`CLAVE_DEL_MOTIVO`) y `CATALOGO_LIB` |
| `servidor.ubicacion.minutos` | Los minutos y los segundos van de 0 a 59 | Minutes and seconds go from 0 to 59 | `lib/interpretar-ubicacion.ts` (`CLAVE_DEL_MOTIVO`) y `CATALOGO_LIB` |
| `servidor.ubicacion.orden` | Primero va la latitud (N o S) y después la longitud (E u O) | Latitude (N or S) comes first, then longitude (E or W) | `lib/interpretar-ubicacion.ts` (`CLAVE_DEL_MOTIVO`) y `CATALOGO_LIB` |
| `servidor.franja.aviso` | Se vendió como {vendida} ({pantallas}) y se programa en «{programada}». El precio y lo contratado no cambian; confirma con el cliente que el horario de transmisión es el acordado. | Sold as {vendida} ({pantallas}) and scheduled in “{programada}”. The price and what was contracted do not change; confirm with the client that the broadcast schedule is the one agreed. | lib/franja-programada.ts:105 |
| `servidor.franja.vendida` | «{nombre}» | “{nombre}” | lib/franja-programada.ts:106 |
| `servidor.franja.otra` | otra franja | another daypart | lib/franja-programada.ts:106 |
| `servidor.franja.pantallas.uno` | {n} pantalla | {n} screen | lib/franja-programada.ts:107 |
| `servidor.franja.pantallas.otros` | {n} pantallas | {n} screens | lib/franja-programada.ts:107 |
| `servidor.codigo.aprobar-con-pendiente` | Primero aprueba o rechaza el código promocional: está pendiente de aprobación y el cliente todavía no lo ve. | First approve or reject the negotiation code: it is pending approval and the client cannot see it yet. | app/(app)/(shell)/propuestas/page.tsx:414, app/(app)/(shell)/propuestas/[id]/page.tsx:322 |
| `servidor.periodo.invalido` | Periodo inválido | Invalid period | solo `CATALOGO_LIB` (servidor) |
| `servidor.periodo.rango` | El rango necesita fecha de inicio y de fin (AAAA-MM-DD) | The range needs a start date and an end date (YYYY-MM-DD) | solo `CATALOGO_LIB` (servidor) |
| `servidor.periodo.cliente-invalido` | Cliente inválido | Invalid client | solo `CATALOGO_LIB` (servidor) |

## Los patrones nuevos (`PATRONES_ERROR`, lote servidor)

Los 15 anteriores (zod, calculadora, paquete y cupón, la liga vencida) no
cambian; al de la calculadora solo se le añadió el hueco `$5` («ninguna» →
«none»).

| # | patrón (el español literal, con sus huecos) | inglés | huecos con tabla |
|---|---|---|---|
| 1 | `^Los meses esperados tienen que ser (.+)\.$` | The expected months must be $1. | — |
| 2 | `^Son (\d+) archivos y el maximo por tanda es (\d+)\.$` | There are $1 files and the maximum per batch is $2. | — |
| 3 | `^Son (\d+) archivos y el maximo por tanda es (\d+)\. Subelos en varias veces\.$` | There are $1 files and the maximum per batch is $2. Upload them in several batches. | — |
| 4 | `^«(.+)» pesa demasiado para ser un recibo de CFE\.$` | “$1” is too large to be a CFE bill. | — |
| 5 | `^El PDF tiene (\d+) paginas y un recibo de CFE tiene 2\. Sube los recibos por separado\.$` | The PDF has $1 {1\|page\|pages} and a CFE bill has 2. Upload the bills separately. | — |
| 6 | `^No se puede borrar: el arrendador tiene (\d+) predio\(s\) y (\d+) contrato\(s\) activo\(s\)\. Reasigna o cancela sus contratos primero\.$` | Cannot delete: the landlord has $1 {1\|property\|properties} and $2 active {2\|contract\|contracts}. Reassign or cancel their contracts first. | — |
| 7 | `^La fecha de fin \((.+)\) no puede ser anterior a la de inicio \((.+)\)\.$` | The end date ($1) cannot be earlier than the start date ($2). | — |
| 8 | `^La nueva fecha de fin debe ser posterior a la vigencia actual \((.+)\)\.$` | The new end date must be after the current term ($1). | — |
| 9 | `^Este periodo ya está pagado \((.+)\)\. Cancélalo antes de volver a registrarlo\.$` | This period is already paid ($1). Cancel it before recording it again. | $1 |
| 10 | `^No se puede eliminar: (\d+) contratos? facturan? a esta razón social\. Cámbiala en esos contratos primero\.$` | Cannot delete: $1 {1\|contract bills\|contracts bill} to this legal entity. Change it in {1\|that contract\|those contracts} first. | — |
| 11 | `^La vigencia del contrato genera más de (\d+) pagos con periodicidad (.+)\. Revisa la fecha de fin: con esa cadencia el calendario no puede cubrir un plazo tan largo\.$` | The contract term generates more than $1 payments billed $2. Check the end date: at that frequency the schedule cannot cover such a long term. | $2 |
| 12 | `^Ese espacio ya estuvo arrendado hasta el (.+)\. El contrato nuevo debe empezar el (.+) o después, para no traslapar la vigencia anterior\.$` | That space was already leased until $1. The new contract must start on $2 or later, so it does not overlap the previous term. | — |
| 13 | `^Esta campana llega hasta el (.+)\. Extender solo puede alargarla: elige una fecha posterior\.$` | This campaign runs until $1. Extending can only make it longer: choose a later date. | — |
| 14 | `^No se puede editar un prospecto (.+)$` | This prospect cannot be edited: it is $1 | $1 |
| 15 | `^Para enviarlo a revisión falta: (.+)$` | To send it for review, this is missing: $1 | $1 |
| 16 | `^No se puede borrar: el cliente tiene (.+)\. Quítalos o reasígnalos antes de borrarlo\.$` | Cannot delete: the client has $1. Remove or reassign them before deleting it. | $1 |
| 17 | `^(.+?) está a (.+?) de (.+)\. Un predio es un solo inmueble y su renta se reparte entre las pantallas que cuelgan de él, así que una que está lejos abarataría a las demás\. Revisa la dirección o las coordenadas, o dale su propio predio\. \(El límite son (\d+) m\.\)$` | $1 is $2 from $3. A property is a single premises and its rent is split among the screens attached to it, so one that is far away would lower the cost for the others. Check the address or the coordinates, or give it its own property. (The limit is $4 m.) | $1, $3 |
| 18 | `^"(.+)" todavía no se puede vender: su contrato de arrendamiento está incompleto\. Complétalo en Arrendadores \(arrendador, vigencia, importe y periodicidad\) antes de reservarla\.$` | “$1” cannot be sold yet: its lease is incomplete. Complete it in Landlords (landlord, term, amount and frequency) before booking it. | — |
| 19 | `^El rol (.+) viene repetido$` | The role $1 is repeated | — |
| 20 | `^Estos roles no existen en el catalogo: (.+)\. Los disponibles son: (.+)\.$` | These roles do not exist in the catalog: $1. The available ones are: $2. | — |
| 21 | `^No se puede enviar a firma: faltan (\d+) datos por capturar \((.+)\)\.$` | Cannot send for signature: $1 {1\|field is\|fields are} still missing ($2). | $2 |
| 22 | `^El nombre no puede pasar de (\d+) caracteres\.$` | The name cannot be longer than $1 characters. | — |
| 23 | `^Esta campaña ya tiene franja horaria \((.+), (.+) a (.+)\): ese es el horario que se manda a DOOHmain y no lleva otro\.$` | This campaign already has a daypart ($1, $2 to $3): that is the schedule sent to DOOHmain, and it cannot have another one. | — |
| 24 | `^La franja horaria "(.+)" no existe en esta organización o está desactivada\.$` | The daypart “$1” does not exist in this organization or is deactivated. | — |
| 25 | `^La temporada "(.+)" no existe en esta organización o está desactivada\.$` | The season “$1” does not exist in this organization or is deactivated. | — |
| 26 | `^La misma combinación de unidad, franja y temporada viene dos veces \((.+)\)\.$` | The same combination of unit, daypart and season appears twice ($1). | — |
| 27 | `^La combinación (.+) viene a la vez para guardar y para quitar\.$` | The combination $1 is sent both to save and to remove. | — |
| 28 | `^La unidad "(.+)" viene repetida\.$` | The unit “$1” is repeated. | — |
| 29 | `^La unidad "(.+)" se manda a guardar y a quitar a la vez: decide una\.$` | The unit “$1” is sent to be saved and removed at the same time: choose one. | — |
| 30 | `^(.*?)No se recibió ningún archivo$` | $1No file was received | — |
| 31 | `^(.*?)El archivo debe venir como data URL en base64 \((.+)\)$` | $1The file must come as a base64 data URL ($2) | — |
| 32 | `^(.*?)Tipo de archivo no permitido aquí\. Se aceptan: (.+)$` | $1File type not allowed here. Accepted: $2 | — |
| 33 | `^(.*?)El archivo supera el límite de (.+) MB$` | $1The file exceeds the $2 MB limit | — |
| 34 | `^(.*?)El archivo está corrupto o mal codificado$` | $1The file is corrupt or badly encoded | — |
| 35 | `^(.*?)El archivo está vacío$` | $1The file is empty | — |
| 36 | `^(.*?)El contenido del archivo no corresponde a un (.+) real$` | $1The file content is not a real $2 | — |
| 37 | `^(.*?)El contenido del archivo no es texto válido$` | $1The file content is not valid text | — |
| 38 | `^(.*?)El SVG contiene código ejecutable \(scripts o manejadores de eventos\) y no se puede aceptar$` | $1The SVG contains executable code (scripts or event handlers) and cannot be accepted | — |

## Las tablas de los huecos

| hueco | de dónde sale | español → inglés |
|---|---|---|
| periodicidad | `c.periodicidad.toLowerCase()` (`arrendadores-repo.ts`) | diaria → daily · semanal → weekly · catorcenal → every two weeks · quincenal → twice a month · mensual → monthly · bimestral → every two months · trimestral → quarterly · semestral → every six months · anual → yearly |
| etapa del prospecto | `ETIQUETA_ETAPA[…].toLowerCase()` (`lib/captacion.ts`) | prospecto → a prospect · contactado → contacted · visita → at the visit stage · negociación → in negotiation · en revisión → in review · aprobado → approved · rechazado → rejected · perdido → lost |
| faltantes para revisión | `faltantesParaRevision()` (`lib/captacion.ts`) | un teléfono o un correo de contacto → a contact phone number or email · la dirección → the address · el dueño: un arrendador existente o el nombre y teléfono del contacto → the owner: an existing landlord or the contact’s name and phone number |
| faltantes para firmar | las etiquetas de `exigir(...)` (`lib/contrato-documento.ts`; las del mensaje, NO el texto legal) | Razón social de tu empresa → Your company’s legal name · RFC de tu empresa → Your company’s RFC · Domicilio fiscal de tu empresa → Your company’s tax address · Representante legal de tu empresa → Your company’s legal representative · Nombre del arrendador → Landlord’s name · RFC del arrendador → Landlord’s RFC · Domicilio del arrendador → Landlord’s address · Dirección del espacio → Space address · Fecha de inicio → Start date · Fecha de fin → End date · Importe de la renta → Rent amount · Periodicidad del pago → Payment frequency |
| bloqueos de un cliente | `motivosDeBloqueo()` (`clientes-controller.ts`) | N campaña(s) → N campaign(s) · N factura(s) → N invoice(s) · N cliente(s) que lo tienen como agencia → N client(s) that has/have it as its/their agency · N propuesta(s) … → N proposal(s) …; « y » → « and » |
| la pantalla lejana | `contratos-sitio.ts` | La pantalla → The screen · "X" → “X” · el predio "X" → the property “X” · "Y", que ya está en el predio "X" → “Y”, which is already on the property “X” |
| periodo pagado | `{ yaPagado: 'sin fecha' }` (`arrendadores-repo.ts`) | sin fecha → no date |
| cantidad enviada | `e.cantidadEnviada ?? 'ninguna'` (`calculadora-spots.ts`) | ninguna → none |

## Calculadora: el inglés del servidor, unificado con el de la pantalla

| clave de la pantalla | inglés que decía el servidor | inglés que dice ahora (el de la pantalla) |
|---|---|---|
| `compartidos.calc.motivo.sin-loop` | The screen does not record how many slots its loop has; enter it on its record before using the calculator. | This screen’s number of loop slots hasn’t been entered; add it on the screen’s profile before using the calculator. |
| `compartidos.calc.motivo.roadblock-todos` | A Roadblock buys all $1 slots of the loop, not $2. | A Roadblock buys every loop slot ($1), not $2. |
| `compartidos.calc.motivo.rango-prima` | The Roadblock premium goes from 0 to 100 %. | The Roadblock premium goes from 0 to 100%. |
| `compartidos.calc.motivo.horas` | Hours per day go from more than 0 to $1: more hours than the screen broadcasts would be spots that never air. | Hours per day must be greater than 0 and at most $1: hours beyond what the screen broadcasts would be spots that never play. |
| `compartidos.calc.motivo.cero-spots` | With those slots and hours not even one spot a day comes out. | With these slots and hours, not a single spot would play per day. |
| `compartidos.calc.motivo.roadblock-libres` | A Roadblock needs all $1 loop slots free, and the screen has $2. | A Roadblock needs every loop slot free ($1); the screen has $2 free. |
| `compartidos.calc.motivo.pocos-libres.uno` / `.otros` | You ask for $1 loop slots and the screen only has $2 free. | You’re asking for $1 loop {1\|slot\|slots} and the screen only has $2 free. |
| `propuestas.calc.prima.no-puede` | Only a manager or above can put a premium on a Roadblock. | Only a manager or above can add a premium to a Roadblock. |

Al juntar con `feat/pesos-neutral`, se quita la excepción de
`compartidos.calc.motivo.*` y `propuestas.calc.*` de su prueba de `costura.test.ts`.

## Lo que NO se tradujo, y por qué

| texto | por qué |
|---|---|
| `textoReactivacion`, `textoAprobacion`, `textoRechazo`, `textoQuitadoAlAceptar` (`lib/codigo-aprobacion.ts`), `textoAccionProgramacion` | Se GUARDAN en `acciones`: son la bitácora. Lo que es registro se queda en español (§8 de `idiomas-es-en.md`). |
| `{ error: e.message }` que responden a mano siete rutas de `app/api` | No pasan por `respuestaError()` y este lote no toca `app/api`. El cupón pendiente se resolvió en el cliente porque trae bandera (`codigoPendiente`). |
| ~108 mensajes que llegan por variable (clases de dominio y funciones `motivo*`) | Medidos con un barrido aproximado: no son plantillas ni están en la lista de este lote. Siguiente ola. |
| «Fecha de hoy inválida: …» (`periodoDe`) | Es la fecha de la propia base, no del usuario: un fallo interno. |
| «Punto del enlace de Google Maps», «Coordenadas …» (`geo-buscar.ts`) | Dato de respuesta, no error; no estaba en la lista del lote. |

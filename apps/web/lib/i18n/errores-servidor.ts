import { IDIOMA_POR_OMISION, type Idioma } from './idiomas'

// ============================================================================
//  lib/i18n/errores-servidor.ts — LOS ERRORES DEL SERVIDOR, EN DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  I18N-05 (2026-09-30). Hasta hoy, quien usaba la aplicacion en ingles veia el
//  formulario en ingles y el fallo en espanol — justo en el peor momento.
//
//  ─── EL DISENO, Y POR QUE NO EL OTRO ───────────────────────────────────────
//
//  Hay 253 `new AppError(...)` en 42 archivos. La via de libro —una clave en
//  cada sitio— toca 253 lugares Y obliga a reescribir el espanol. Eso ultimo es
//  lo que la descarta: hay once archivos de prueba que afirman el TEXTO EXACTO
//  en espanol, y esa red es lo que impide que, al traducir, se cambie sin
//  querer lo que un error DICE.
//
//  Asi que la traduccion ocurre EN LA SALIDA — `respuestaError()`, el unico
//  embudo por donde pasan los 253— y el catalogo va del ESPANOL CANONICO al
//  ingles. **El espanol es la fuente y no se toca ni una letra.**
//
//  ─── «PERO SI LA FRASE NO SE USA DE CLAVE» ─────────────────────────────────
//
//  En I18N-01 se razono lo contrario para la interfaz, y sigue siendo cierto
//  alli. Lo que hace peligroso usar la frase de clave no es la frase: es que la
//  deriva ocurre EN SILENCIO — se retoca una redaccion y la traduccion queda
//  huerfana sin que nadie se entere.
//
//  Aqui ese silencio esta quitado. `errores-servidor.test.ts` recorre el
//  repositorio, saca todos los mensajes literales de `new AppError(...)` y
//  exige que cada uno este en este catalogo o declarado en `SIN_TRADUCIR`. Un
//  mensaje nuevo, o uno reescrito, pone la prueba EN ROJO.
//
//  ─── LO QUE NO SE TRADUCE, Y ES A PROPOSITO ────────────────────────────────
//
//  Solo se traduce lo que viaja al CLIENTE en el cuerpo de la respuesta. Lo que
//  va al log del servidor (`console.error`), a la bitacora de acciones o a un
//  expediente **se queda en espanol**: un registro escrito en dos idiomas segun
//  quien provoco el fallo es un registro inservible, porque quien lo lee despues
//  no puede saber si «Not found» y «No encontrado» son el mismo suceso.
//
//  Por construccion sale gratis: este modulo solo lo usa `respuestaError()`
//  para armar el JSON, y los `console.error` de ese mismo archivo quedan
//  intactos. Hay prueba que lo vigila.
//
//  ─── ESTE ARCHIVO SE GENERO LEYENDO EL CODIGO ──────────────────────────────
//
//  Las claves en espanol NO se teclearon: se extrajeron del arbol y se
//  comprobo, una por una, que cada traduccion corresponde a un mensaje que de
//  verdad se lanza y que no falta ninguno. Un typo en el espanol es una entrada
//  que nunca casa y que no da error — el fallo mas caro que podia tener este
//  archivo.
// ============================================================================

/** Lo que se le dice al cliente cuando no hay nada mejor. */
const SIN_MENSAJE = ''

/**
 * Mensajes que **a sabiendas** se quedan sin traducir.
 *
 * Esta vacia hoy, y es el sitio donde declarar un mensaje nuevo que todavia no
 * se quiera traducir. Lo importante es que exista: sin ella, la unica forma de
 * no traducir algo seria que la prueba no lo viera.
 */
export const SIN_TRADUCIR: readonly string[] = []


// ─── EL CATALOGO · espanol canonico -> ingles ───────────────────────────────
//
// 115 mensajes de `new AppError('...')` + 27 del embudo, del mapa de
// Postgres, de zod y de las constantes compartidas.
export const CATALOGO_ERRORES: Record<string, string> = {
  // 1 sitio · lib/server/arrendadores-controller.ts:376
  'Adjunto inválido':
    'Invalid attachment',
  // 1 sitio · lib/server/arrendadores-controller.ts:378
  'Adjunto no encontrado':
    'Attachment not found',
  // 1 sitio · lib/server/programacion-controller.ts:59
  'Alguna de las campañas elegidas no existe en esta organización; no se programó ninguna.':
    'One of the selected campaigns does not exist in this organization; none were scheduled.',
  // 3 sitios · lib/server/arrendadores-controller.ts:124
  'Arrendador no encontrado':
    'Landlord not found',
  // 8 sitios · lib/server/campanas-controller.ts:24
  'Otra persona acaba de extender esta campaña más lejos. Recarga para ver la fecha nueva.':
    'Someone else just extended this campaign further. Reload to see the new date.',
  'Campaña no encontrada':
    'Campaign not found',
  // 2 sitios · lib/server/clientes-controller.ts:116
  'Cliente no encontrado':
    'Client not found',
  // 1 sitio · lib/server/finanzas-controller.ts:35
  'Cobranza no encontrada':
    'Receivable not found',
  // 1 sitio · lib/server/finanzas-repo.ts:310 (ADR 0046)
  'Esta cobranza ya está pagada':
    'This receivable is already paid',
  // 1 sitio · lib/server/finanzas-repo.ts:316 (ADR 0046)
  'La fecha del pago no puede ser futura':
    'The payment date cannot be in the future',
  // 2 sitios · lib/server/arrendadores-controller.ts:265
  'Contrato no encontrado':
    'Contract not found',
  // 1 sitio · lib/server/arrendadores-controller.ts:294
  'Contrato no encontrado o ya cancelado':
    'Contract not found or already cancelled',
  // 1 sitio · lib/server/clientes-controller.ts:86
  'Correo de contacto inválido':
    'Invalid contact email',
  // 1 sitio · lib/server/arrendadores-controller.ts:183
  'Correo del arrendatario inválido':
    'Invalid tenant email',
  // 4 sitios · lib/server/arrendadores-controller.ts:62
  'Correo inválido':
    'Invalid email',
  // 1 sitio · lib/server/arrendadores-controller.ts:209
  'CURP inválida':
    'Invalid CURP',
  // 1 sitio · lib/server/perfil-controller.ts:84
  'Debes ingresar tu contraseña actual para confirmar el cambio':
    'You must enter your current password to confirm the change',
  // 1 sitio · lib/server/recibos-cfe/lector-pdf.ts:76
  'El archivo esta vacio.':
    'The file is empty.',
  // 1 sitio · lib/server/recibos-cfe/lector-pdf.ts:78
  'El archivo pesa demasiado para ser un recibo de CFE.':
    'The file is too large to be a CFE bill.',
  // 1 sitio · lib/server/captacion-controller.ts:290
  'El arrendador de ese predio no existe en esta organización':
    'The landlord of that property does not exist in this organization',
  // 1 sitio · lib/server/contratos-sitio.ts:40
  'El arrendador elegido no existe.':
    'The selected landlord does not exist.',
  // 2 sitios · lib/server/arrendadores-repo.ts:461
  'El arrendador no existe':
    'The landlord does not exist',
  // 1 sitio · app/api/energia/recibos/route.ts:93
  'El campo `archivos` tiene que traer archivos, no texto.':
    'The `archivos` field must carry files, not text.',
  // 1 sitio · lib/server/ot-repo.ts:178
  'El checklist de esta orden de trabajo cambió. Recarga la página y vuelve a marcarlo':
    'The checklist for this work order changed. Reload the page and check it again',
  // 1 sitio · lib/server/arrendadores-controller.ts:276
  'El contrato está CANCELADO; crea uno nuevo en su lugar':
    'The contract is CANCELLED; create a new one instead',
  // 3 sitios · lib/server/firmas-repo.ts:72
  'El contrato no existe.':
    'The contract does not exist.',
  // 1 sitio · lib/server/firmas-repo.ts:205
  'El contrato todavía no se ha enviado a firma.':
    'The contract has not been sent for signature yet.',
  // 1 sitio · lib/server/firmas-repo.ts:315
  'El enlace de firma expiró. Pide uno nuevo.':
    'The signing link expired. Request a new one.',
  // 1 sitio · lib/server/password-reset-repo.ts:133
  'El enlace expiró. Solicita uno nuevo.':
    'The link expired. Request a new one.',
  // 1 sitio · lib/server/password-reset-repo.ts:131
  'El enlace no es válido.':
    'The link is not valid.',
  // 1 sitio · lib/server/ot-repo.ts:226
  'El montaje digital ya no es una tarea de OT: el arte se sube con "Subir a producción" en la campaña':
    'Digital setup is no longer a work-order task: artwork is uploaded with "Send to production" in the campaign',
  // 1 sitio · lib/server/contratos-sitio.ts:68
  'El predio elegido no existe o pertenece a otro arrendador.':
    'The selected property does not exist or belongs to another landlord.',
  // 2 sitios · lib/server/arrendadores-repo.ts:481
  'El predio no existe':
    'The property does not exist',
  // 1 sitio · lib/server/contratos-sitio.ts:74
  'El predio nuevo necesita un nombre.':
    'The new property needs a name.',
  // 1 sitio · lib/server/arrendadores-repo.ts:483
  'El predio pertenece a otro arrendador':
    'The property belongs to another landlord',
  // 1 sitio · lib/server/arrendadores-repo.ts:489
  'El predio ya tiene un contrato activo. Agrega la pantalla al predio en vez de crear otro contrato, o cancela/vence el contrato anterior primero.':
    'The property already has an active contract. Add the screen to the property instead of creating another contract, or cancel/expire the previous contract first.',
  // 1 sitio · lib/server/tickets-repo.ts:211
  'El ticket esta CERRADO: ya no admite respuesta ni cambio de estado':
    'The ticket is CLOSED: it no longer accepts replies or status changes',
  // 1 sitio · lib/server/contratos-sitio.ts:31
  'Elige el arrendador de la pantalla: sin propietario no se puede abrir su contrato de arrendamiento.':
    'Choose the landlord for the screen: without an owner its lease contract cannot be opened.',
  // 2 sitios · lib/server/firmas-repo.ts:314
  'Enlace de firma no válido.':
    'Invalid signing link.',
  // 1 sitio · lib/server/google-oauth.ts:278
  'Esa cuenta de Google no tiene el correo verificado.':
    'That Google account does not have a verified email.',
  // 1 sitio · lib/server/entidades-controller.ts:103
  'Esa entidad ya tiene ese rol asignado.':
    'That entity already has that role assigned.',
  // 2 sitios · lib/server/firmas-repo.ts:216
  'Esa firma ya no está pendiente.':
    'That signature is no longer pending.',
  // 2 sitios · lib/server/rejilla-controller.ts:102
  'Esa franja no existe en esta organización':
    'That daypart does not exist in this organization',
  // 1 sitio · lib/server/programacion-controller.ts:57
  'Esa franja no existe en esta organización o está dada de baja.':
    'That daypart does not exist in this organization or has been deactivated.',
  // 1 sitio · lib/server/rejilla-controller.ts:260
  'Esa pantalla no existe':
    'That screen does not exist',
  // 2 sitios · lib/server/codigos-controller.ts (COD-03: decidir y leer el cupón)
  'Esa propuesta no existe en esta organizacion':
    'That proposal does not exist in this organization',
  // 1 sitio · lib/server/codigos-controller.ts:138
  'Esa propuesta no tiene ningun codigo aplicado':
    'That proposal has no promo code applied',
  // 1 sitio · lib/server/paquetes-controller.ts:126
  'Esa propuesta no tiene paquete aplicado':
    'That proposal has no bundle applied',
  // 1 sitio · lib/server/ot-repo.ts:238
  'Esa tarea no aplica a una pantalla digital (no lleva lona ni herrería)':
    'That task does not apply to a digital screen (no banner or ironwork involved)',
  // 2 sitios · lib/server/rejilla-controller.ts:129
  'Esa temporada no existe en esta organización':
    'That season does not exist in this organization',
  // 1 sitio · lib/server/firmas-repo.ts:318
  'Escribe tu nombre completo para firmar.':
    'Type your full name to sign.',
  // 2 sitios · lib/server/codigos-controller.ts:95
  'Ese codigo no existe en esta organizacion':
    'That code does not exist in this organization',
  // 1 sitio · lib/server/perfil-controller.ts:94
  'Ese correo ya está en uso':
    'That email is already in use',
  // 1 sitio · lib/server/cuentas-controller.ts:61
  'Ese correo ya está registrado':
    'That email is already registered',
  // 1 sitio · lib/server/actualizaciones-repo.ts:73
  'Ese digest ya no es el disponible: se publico una version nueva mientras tanto':
    'That digest is no longer the available one: a new version was published in the meantime',
  // 1 sitio · lib/server/energia-controller.ts:214
  'Ese mes todavía no ha terminado: no puede haber recibo.':
    'That month has not ended yet: there cannot be a bill.',
  // 2 sitios · lib/server/paquetes-controller.ts:95
  'Ese paquete no existe en esta organización':
    'That bundle does not exist in this organization',
  // 1 sitio · lib/server/entidades-controller.ts:106
  'Ese rol no existe en el catalogo.':
    'That role does not exist in the catalog.',
  // 2 sitios · lib/server/volumen-controller.ts:85
  'Ese tramo no existe en esta organización':
    'That tier does not exist in this organization',
  // 1 sitio · lib/server/cuentas-controller.ts:110
  'Esta alta no lleva contraseña: el Dueño entra con Google (ADR 0028). Quita `password` del cuerpo. Si estás siguiendo una tarjeta que la genera, esa tarjeta es anterior al 2026-09-07.':
    'This sign-up does not take a password: the Owner signs in with Google (ADR 0028). Remove `password` from the body. If you are following a card that generates one, that card predates 2026-09-07.',
  // 1 sitio · app/api/campanas/[id]/playlogs/route.ts:43
  'Esta campaña no está publicada en DOOHmain: no hay reproducciones que consultar.':
    'This campaign is not published on DOOHmain: there are no plays to look up.',
  // 1 sitio · lib/server/ot-repo.ts:176
  'Esta orden de trabajo ya está cerrada: su checklist ya no se puede cambiar':
    'This work order is already closed: its checklist can no longer be changed',
  // 1 sitio · lib/server/arrendadores-controller.ts:310
  'Este contrato está incompleto: falta el arrendador, el importe de la renta y la periodicidad. Complétalo antes de renovarlo.':
    'This contract is incomplete: the landlord, the rent amount and the payment frequency are missing. Complete it before renewing it.',
  // 1 sitio · lib/server/arrendadores-controller.ts:278
  'Este contrato ya está firmado y su información no cambia: lo firmado dejaría de coincidir con lo acordado. Si hay que modificar las condiciones, crea un contrato nuevo.':
    'This contract is already signed and its information does not change: what was signed would stop matching what was agreed. If the terms need changing, create a new contract.',
  // 1 sitio · lib/server/firmas-repo.ts:316
  'Este contrato ya fue firmado con este enlace.':
    'This contract was already signed with this link.',
  // 1 sitio · lib/server/password-reset-repo.ts:132
  'Este enlace ya se usó. Solicita uno nuevo.':
    'This link has already been used. Request a new one.',
  // 1 sitio · lib/server/captacion-repo.ts:408
  'Este prospecto ya se decidió':
    'This prospect has already been decided',
  // 1 sitio · app/api/tickets/route.ts:123
  'Falta el id del ticket':
    'The ticket id is missing',
  // 1 sitio · lib/server/energia-controller.ts:245
  'Falta el recibo a borrar':
    'The bill to delete is missing',
  // 1 sitio · app/api/campanas/[id]/playlogs/route.ts:38
  'Fechas inválidas (se espera YYYY-MM-DD)':
    'Invalid dates (YYYY-MM-DD expected)',
  // 1 sitio · lib/server/google-oauth.ts:275
  'Google devolvió la verificación del correo en un formato inesperado.':
    'Google returned the email verification in an unexpected format.',
  // 1 sitio · lib/server/google-oauth.ts:206
  'Google no devolvió una identidad utilizable.':
    'Google did not return a usable identity.',
  // 1 sitio · lib/server/propuestas-controller.ts
  'Ítem no encontrado':
    'Item not found',
  // 1 sitio · lib/server/propuestas-controller.ts (PRECIO-01, 2026-10-01)
  'Solo un gerente o superior puede cambiar la tarifa de una pantalla.':
    "Only a manager or above can change a screen's rate.",
  // 1 sitio · lib/server/propuestas-controller.ts (PRECIO-01, 2026-10-01)
  'Esta pantalla no tiene una tarifa calculada para esa unidad. Pide a un gerente o superior que le ponga precio.':
    'This screen has no calculated rate for that unit. Ask a manager or above to set its price.',
  // ADR 0042 · la calculadora de spots (2026-10-01). Las dos primeras son
  // literales del controller; las demás salen de `lib/calculadora-spots.ts`
  // (`resolverCalculadora`) y llegan al cliente por `AppError(r.motivo)`, así
  // que la GUARDIA no las ve: se declaran aquí a mano para que el inglés no
  // pinte español. Las que llevan números van en `PATRONES_ERROR`.
  'La calculadora de spots necesita la tarifa por spot de la línea.':
    "The spot calculator needs the line's per-spot rate.",
  'Solo un gerente o superior puede poner prima a un Roadblock.':
    'Only a manager or above can put a premium on a Roadblock.',
  'La calculadora de spots solo aplica a pantallas digitales vendidas por spot.':
    'The spot calculator only applies to digital screens sold per spot.',
  'La pantalla no tiene capturado cuántos espacios tiene su loop; captúralo en su ficha antes de usar la calculadora.':
    'The screen does not record how many slots its loop has; enter it on its record before using the calculator.',
  'La prima de Roadblock va de 0 a 100 %.':
    'The Roadblock premium goes from 0 to 100 %.',
  'La prima de Roadblock solo aplica a una línea marcada como Roadblock.':
    'The Roadblock premium only applies to a line marked as Roadblock.',
  'Con esos espacios y esas horas no sale ni un spot al día.':
    'With those slots and hours not even one spot a day comes out.',
  'La línea no tiene días: revisa las fechas.':
    'The line has no days: check the dates.',
  // 1 sitio · lib/server/impresion-controller.ts:14
  'La campaña es requerida':
    'The campaign is required',
  // 1 sitio · lib/server/perfil-controller.ts:88
  'La contraseña actual no es correcta':
    'The current password is not correct',
  // 2 sitios · lib/server/arrendadores-controller.ts:180
  'La fecha de fin no puede ser anterior a la de inicio':
    'The end date cannot be earlier than the start date',
  // 1 sitio · lib/server/arrendadores-controller.ts:347
  'La fecha de pago no puede ser futura':
    'The payment date cannot be in the future',
  // 1 sitio · app/api/campanas/[id]/playlogs/route.ts:39
  'La fecha final no puede ser anterior a la inicial':
    'The final date cannot be earlier than the initial one',
  // 1 sitio · lib/server/google-oauth.ts:256
  'La identidad de Google expiró. Vuelve a intentarlo.':
    'The Google identity expired. Please try again.',
  // 1 sitio · lib/server/google-oauth.ts:244
  'La identidad de Google llegó vacía.':
    'The Google identity arrived empty.',
  // 1 sitio · lib/server/google-oauth.ts:252
  'La identidad de Google no es para esta aplicación.':
    'The Google identity is not for this application.',
  // 1 sitio · lib/server/google-oauth.ts:226
  'La identidad de Google no se pudo leer.':
    'The Google identity could not be read.',
  // 1 sitio · lib/server/google-oauth.ts:222
  'La identidad de Google no tiene el formato esperado.':
    'The Google identity does not have the expected format.',
  // 1 sitio · lib/server/google-oauth.ts:285
  'La identidad de Google no trae correo.':
    'The Google identity does not carry an email.',
  // 1 sitio · lib/server/google-oauth.ts:282
  'La identidad de Google no trae identificador.':
    'The Google identity does not carry an identifier.',
  // 1 sitio · lib/server/google-oauth.ts:247
  'La identidad no la emitió Google.':
    'The identity was not issued by Google.',
  // 1 sitio · lib/server/arrendadores-controller.ts:456
  'La licencia no puede vencer antes de expedirse.':
    'The permit cannot expire before it is issued.',
  // 1 sitio · lib/server/arrendadores-repo.ts:891
  'La pantalla no existe':
    'The screen does not exist',
  // 1 sitio · lib/server/contratos-sitio.ts:253
  'La pantalla no existe.':
    'The screen does not exist.',
  // 1 sitio · lib/server/arrendadores-repo.ts:893
  'La pantalla ya pertenece a otro predio':
    'The screen already belongs to another property',
  // 1 sitio · lib/server/arrendadores-repo.ts:1215
  'La razon social elegida no existe o es de otra organizacion.':
    'The selected legal entity does not exist or belongs to another organization.',
  // 1 sitio · lib/server/arrendadores-repo.ts:1195
  'La razón social elegida no existe o es de otro arrendador.':
    'The selected legal entity does not exist or belongs to another landlord.',
  // 1 sitio · lib/server/finanzas-controller.ts:104
  'La razon social emisora no existe o es de otra organizacion.':
    'The issuing legal entity does not exist or belongs to another organization.',
  // 1 sitio · lib/server/google-oauth.ts:261
  'La respuesta de Google no corresponde a esta solicitud.':
    'Google’s response does not match this request.',
  // 1 sitio · app/api/energia/recibos/route.ts:100
  'La tanda entera pesa demasiado. Subela en varias veces.':
    'The whole batch is too large. Upload it in several goes.',
  // 3 sitios · lib/server/arrendadores-controller.ts:491
  'Licencia no encontrada':
    'Permit not found',
  // 1 sitio · app/api/energia/recibos/route.ts:50
  'Manda los PDF como formulario, en el campo `archivos`.':
    'Send the PDFs as a form, in the `archivos` field.',
  // 4 sitios · lib/server/arrendadores-controller.ts:412
  'No encontrada':
    'Not found',
  // 9 sitios · lib/server/errores.ts:17
  'No encontrado':
    'Not found',
  // 2 sitios · lib/server/ot-repo.ts:122
  'No encontramos esa orden de trabajo':
    'We could not find that work order',
  // 2 sitios · lib/server/perfil-controller.ts:75
  'No hay cambios que guardar':
    'There are no changes to save',
  // 1 sitio · lib/server/actualizaciones-repo.ts:47
  'No hay fila de actualizaciones: falta la migracion 20260921':
    'There is no updates row: migration 20260921 is missing',
  // 1 sitio · lib/server/arrendadores-controller.ts:486
  'No hay nada que actualizar.':
    'There is nothing to update.',
  // 1 sitio · lib/server/arrendadores-controller.ts:369
  'No hay nada que guardar':
    'There is nothing to save',
  // 2 sitios · app/api/energia/recibos/route.ts:81
  'No llego ningun archivo.':
    'No file arrived.',
  // 1 sitio · lib/server/usuarios-controller.ts:240
  'No puedes eliminar tu propio usuario':
    'You cannot delete your own user',
  // 1 sitio · lib/server/usuarios-controller.ts:198
  'No puedes modificar tu propio usuario. Cambia tu contraseña en Configuración.':
    'You cannot modify your own user. Change your password in Settings.',
  // 1 sitio · lib/server/recibos-cfe/lector-pdf.ts:114
  'No se pudo abrir el archivo: no parece un PDF valido.':
    'The file could not be opened: it does not look like a valid PDF.',
  // 1 sitio · lib/server/google-oauth.ts:202
  'No se pudo completar el acceso con Google.':
    'The Google sign-in could not be completed.',
  // 1 sitio · lib/server/sitios-controller.ts:162
  'No se puede eliminar: la pantalla tiene reservas u órdenes asociadas.':
    'It cannot be deleted: the screen has bookings or orders attached.',
  // 2 sitios · lib/server/impresion-controller.ts:26
  'Orden no encontrada':
    'Order not found',
  // 2 sitios · lib/server/arrendadores-controller.ts:350
  'Pago no encontrado':
    'Payment not found',
  // 1 sitio · lib/server/usuarios-controller.ts:223
  'Para cambiar tu propia contraseña usa Configuración.':
    'To change your own password use Settings.',
  // 1 sitio · lib/server/arrendadores-controller.ts:160
  'Predio no encontrado':
    'Property not found',
  // 1 sitio · lib/server/energia-controller.ts:250
  'Recibo no encontrado':
    'Bill not found',
  // 1 sitio · lib/server/creativos-controller.ts:127
  'Reserva no encontrada':
    'Booking not found',
  // 7 sitios · lib/server/arrendadores-controller.ts:61
  'RFC inválido':
    'Invalid RFC',
  // 1 sitio · lib/server/arrendadores-repo.ts:1436
  'Una licencia ampara un predio O una pantalla suelta, no ambos ni ninguno.':
    'A permit covers either a property OR a single screen, not both and not neither.',
  // 1 sitio · lib/server/usuarios-controller.ts:137
  'Ya existe un usuario con ese correo':
    'A user with that email already exists',
  // 1 sitio · lib/server/usuarios-controller.ts:118 (ADR 0044)
  'Elige una sola forma de acceso: invitación, contraseña o Google.':
    'Choose a single way to sign in: invitation, password or Google.',

  // ── Centrales: no salen de un `new AppError('...')` literal ──
  'Dato con formato inválido':
    'Data with an invalid format',
  'Fecha inválida':
    'Invalid date',
  'Fecha fuera de rango':
    'Date out of range',
  'Un valor excede la longitud permitida':
    'A value exceeds the allowed length',
  'Falta un dato obligatorio':
    'A required field is missing',
  'Un valor no cumple las reglas de la tabla':
    'A value does not meet the table rules',
  'El registro ya existe':
    'The record already exists',
  'El registro está referenciado por otro':
    'The record is referenced by another one',
  'Sin acceso a ese registro':
    'No access to that record',
  'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.':
    'The service is unavailable right now. Please try again in a few minutes.',
  'Error interno':
    'Internal error',
  'Datos inválidos':
    'Invalid data',
  'Este dato es obligatorio':
    'This field is required',
  'El valor tiene un formato inválido':
    'The value has an invalid format',
  'Selecciona una opción válida':
    'Select a valid option',
  'El texto tiene un formato inválido':
    'The text has an invalid format',
  'El valor no es válido':
    'The value is not valid',
  'Ese prospecto no existe':
    'That prospect does not exist',
  'Tu organizacion ya tiene razones sociales registradas, asi que el cuestionario ya se contesto. Para cambiarlas, usa la pantalla de Administracion.':
    'Your organization already has legal entities registered, so the questionnaire has already been answered. To change them, use the Settings screen.',
  'Las tarifas por unidad se guardan en su propia ruta (PATCH /api/sitios/:id/modalidades), que siempre pide la contraseña.':
    'Per-unit rates are saved on their own route (PATCH /api/sitios/:id/modalidades), which always asks for the password.',
  'Código postal inválido (5 dígitos)':
    'Invalid postal code (5 digits)',
  'Teléfono inválido. Escribe 10 dígitos (p. ej. 55 1234 5678)':
    'Invalid phone number. Enter 10 digits (e.g. 55 1234 5678)',
  'Correo inválido. Usa el formato ejemplo@correo.com':
    'Invalid email. Use the format example@email.com',
  'La contraseña debe tener al menos 8 caracteres':
    'The password must be at least 8 characters long',
  'La contraseña debe incluir al menos una letra':
    'The password must include at least one letter',
  'La contraseña debe incluir al menos un número':
    'The password must include at least one number',
  'La contraseña no puede contener espacios':
    'The password cannot contain spaces',
}


// ─── Las etiquetas de campo ─────────────────────────────────────────────────
//
// `validar()` compone `${Etiqueta}: ${motivo}` — «Correo: Este dato es
// obligatorio». Un catalogo de frases enteras no lo cubre, porque la
// combinatoria es campos x motivos. Se traduce por PARTES, y esto es la mitad
// izquierda: el espejo de `CAMPO_ES` (`lib/server/errores.ts`).
export const CAMPO_EN: Record<string, string> = {
  'Nombre': 'Name',
  'Correo': 'Email',
  'Contraseña': 'Password',
  'Contraseña actual': 'Current password',
  'RFC': 'RFC',
  'Razón social': 'Legal name',
  'Régimen fiscal': 'Tax regime',
  'Uso de CFDI': 'CFDI use',
  'CP fiscal': 'Tax postal code',
  'Fecha de inicio': 'Start date',
  'Fecha de fin': 'End date',
  'Fecha': 'Date',
  'Comisión': 'Commission',
  'Cliente': 'Client',
  'Agencia': 'Agency',
  'Sitio': 'Site',
  'Spots por día': 'Spots per day',
  'Cantidad': 'Quantity',
  'Tarifa': 'Rate',
  'Precio': 'Price',
  'Unidad': 'Unit',
  'Monto': 'Amount',
  'Renta': 'Rent',
  'Contrato': 'Contract',
  'Orden de compra': 'Purchase order',
  'Documento': 'Document',
  'Logo': 'Logo',
  'Archivo': 'File',
  'Código': 'Code',
}


// ─── Los motivos de zod que llevan un NUMERO dentro ─────────────────────────
//
// El numero sale del esquema, asi que no cabe en un catalogo de frases: va por
// patron y se conserva tal cual. Son los de `mapaZodEs`
// (`lib/server/errores.ts`), uno por uno.
export const PATRONES_ERROR: ReadonlyArray<{ re: RegExp; en: string }> = [
  { re: /^Debe tener al menos (\d+) caracteres$/, en: 'Must be at least $1 characters' },
  { re: /^No puede tener más de (\d+) caracteres$/, en: 'Must not have more than $1 characters' },
  { re: /^Agrega al menos (\d+)$/, en: 'Add at least $1' },
  { re: /^Debe ser mayor o igual a (\d+(?:\.\d+)?)$/, en: 'Must be greater than or equal to $1' },
  { re: /^Debe ser mayor que (\d+(?:\.\d+)?)$/, en: 'Must be greater than $1' },
  { re: /^No puede ser mayor que (\d+(?:\.\d+)?)$/, en: 'Must not be greater than $1' },
  // ADR 0042 · los de `resolverCalculadora` (`lib/calculadora-spots.ts`): el
  // número sale de la pantalla y de la línea, no del esquema, pero el problema
  // es el mismo — no cabe en un catálogo de frases.
  { re: /^Un Roadblock compra los (\d+) espacios del loop, no (\d+)\.$/, en: 'A Roadblock buys all $1 slots of the loop, not $2.' },
  { re: /^Los espacios del loop van de 1 a (\d+)\.$/, en: 'Loop slots go from 1 to $1.' },
  {
    re: /^Las horas al día van de más de 0 a ([\d.,]+): más horas de las que transmite la pantalla serían spots que no salen\.$/,
    en: 'Hours per day go from more than 0 to $1: more hours than the screen broadcasts would be spots that never air.',
  },
  {
    re: /^La cantidad de spots no cuadra con la calculadora: con (\d+) espacios, ([\d.,]+) h al día y (\d+) días son (\d+) spots, no (.+)\.$/,
    en: 'The spot quantity does not match the calculator: with $1 slots, $2 h a day and $3 days it is $4 spots, not $5.',
  },
  {
    re: /^Un Roadblock necesita los (\d+) espacios del loop libres, y la pantalla tiene (\d+)\.$/,
    en: 'A Roadblock needs all $1 loop slots free, and the screen has $2.',
  },
  { re: /^Pides (\d+) espacios del loop y la pantalla solo tiene (\d+) libres\.$/, en: 'You ask for $1 loop slots and the screen only has $2 free.' },
  // 2026-10-05 · regla 2 del ADR 0039, las dos direcciones: el canje sobre un
  // paquete de precio final (`canjearCodigo`) y el paquete sobre un cupón ya
  // canjeado (`aplicarPaquete`). Llevan el nombre del paquete y del cupón, y
  // viajan por variable (`new AppError(e.message, …)`), así que la guardia de
  // literales no las ve: van por patrón, como las del ADR 0042.
  {
    re: /^El paquete "(.+)" de esta propuesta es precio final y no admite codigos promocionales\. Quita el paquete, o cambialo por uno que si los admita, antes de aplicar el codigo\.$/,
    en: 'The package "$1" on this proposal is a final price and does not accept promo codes. Remove the package, or swap it for one that does, before applying the code.',
  },
  {
    re: /^El paquete "(.+)" es precio final y no admite codigos promocionales\. Quita el codigo "(.+)" antes de aplicarlo, o usa un paquete que si los admita\.$/,
    en: 'The package "$1" is a final price and does not accept promo codes. Remove the code "$2" before applying it, or use a package that does.',
  },
]

// Una pieza suelta: el motivo, sin la etiqueta de campo delante.
function traducirMotivo(motivo: string): string {
  const exacto = CATALOGO_ERRORES[motivo]
  if (exacto !== undefined) return exacto
  for (const p of PATRONES_ERROR) {
    if (p.re.test(motivo)) return motivo.replace(p.re, p.en)
  }
  return motivo
}

/**
 * El mensaje de un error, en el idioma pedido.
 *
 * En espanol devuelve EXACTAMENTE lo que entro: el espanol es la fuente, no una
 * traduccion mas. Lo que no conoce lo devuelve tal cual, en espanol — que es
 * peor que traducirlo y mucho mejor que pintar una clave cruda o un hueco.
 */
export function traducirError(mensaje: string, idioma: Idioma): string {
  if (typeof mensaje !== 'string') return SIN_MENSAJE
  if (idioma === IDIOMA_POR_OMISION) return mensaje

  const exacto = CATALOGO_ERRORES[mensaje]
  if (exacto !== undefined) return exacto

  // `Campo: motivo`. Se parte SOLO si la izquierda es una etiqueta de campo
  // conocida; de lo contrario un mensaje normal con dos puntos dentro —y hay
  // varios— se trocearia mal.
  const corte = mensaje.indexOf(': ')
  if (corte > 0) {
    const campo = mensaje.slice(0, corte)
    const enCampo = CAMPO_EN[campo]
    if (enCampo !== undefined) {
      return `${enCampo}: ${traducirMotivo(mensaje.slice(corte + 2))}`
    }
  }

  return traducirMotivo(mensaje)
}

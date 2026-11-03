import { IDIOMA_POR_OMISION, type Idioma } from './idiomas'
import { ES_SERVIDOR, EN_SERVIDOR, IT_SERVIDOR, type ClaveServidor } from './textos/servidor'

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
  // ADR 0048 (02/11) · la moneda de la instancia se elige al crearla y no se cambia.
  'La moneda debe ser MXN o USD':
    'The currency must be MXN or USD',
  'La moneda de la instancia ya está fijada: una organización nueva nace en la misma que las demás':
    'The instance currency is already set: a new organization is created in the same currency as the others',
  'La moneda no se puede cambiar: se eligió al crear la instancia y los importes guardados no la llevan':
    'The currency cannot be changed: it was chosen when the instance was created, and stored amounts do not carry it',
  'La moneda de la instancia solo se elige al darla de alta':
    'The instance currency can only be chosen when the instance is created',
  'Un contrato va en la moneda de la instancia: no se puede capturar en otra':
    'A contract is in the instance currency: it cannot be entered in another one',
  // PROP-COMPLETA (29/10) · enviar, borrar, agregar y quitar sitios, vigencia.
  'Propuesta no encontrada':
    'Proposal not found',
  'Solo se agregan sitios a una propuesta en borrador o enviada':
    'Sites can only be added to a draft or sent proposal',
  'Sitio de la propuesta no encontrado':
    'Proposal site not found',
  'Solo se envía una propuesta en borrador o ya enviada':
    'Only a draft or already sent proposal can be sent',
  'Esta propuesta no tiene liga; vuelve a guardarla':
    'This proposal has no link; save it again',
  'No se pudo enviar el correo. La propuesta no cambió: inténtalo de nuevo o copia la liga y mándala tú.':
    'The email could not be sent. The proposal did not change: try again or copy the link and send it yourself.',
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
  // 1 sitio · lib/server/campanas-controller.ts (EXT-CONTRATO, 29/10)
  'Para extender la campaña adjunta el contrato firmado de la extensión':
    "To extend the campaign, attach the extension's signed contract",
  'Campaña no encontrada':
    'Campaign not found',
  // 2 sitios · lib/server/clientes-controller.ts:116
  'Cliente no encontrado':
    'Client not found',
  // 2 sitios · lib/server/finanzas-controller.ts:45 y :59
  'Cobranza no encontrada':
    'Receivable not found',
  // 1 sitio · lib/server/finanzas-controller.ts:65 (COB-COMP)
  'Falta el comprobante':
    'The receipt is missing',
  // 1 sitio · lib/server/finanzas-controller.ts:74 (COB-COMP)
  'Comprobante no encontrado':
    'Receipt not found',
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
  // 1 sitio · lib/server/perfil-controller.ts:87
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
    'That proposal has no negotiation code applied',
  // 1 sitio · lib/server/paquetes-controller.ts:126
  'Esa propuesta no tiene paquete aplicado':
    'That proposal has no bundle applied',
  // 1 sitio · lib/server/ot-repo.ts:238
  'Esa tarea no aplica a una pantalla digital (no lleva lona ni herrería)':
    'That task does not apply to a digital screen (no banner or ironwork involved)',
  // 2 sitios · lib/server/rejilla-controller.ts:129
  'Esa temporada no existe en esta organización':
    'That season does not exist in this organization',
  // 1 sitio · app/api/contratos/[id]/versiones/route.ts:24
  'Esa versión firmada no existe':
    'That signed version does not exist',
  // 1 sitio · lib/server/firmas-repo.ts:318
  'Escribe tu nombre completo para firmar.':
    'Type your full name to sign.',
  // 2 sitios · lib/server/codigos-controller.ts:95
  'Ese codigo no existe en esta organizacion':
    'That code does not exist in this organization',
  // 1 sitio · lib/server/perfil-controller.ts:97
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
  'Esta campaña no está publicada en ninguna pantalla de DOOHmain.':
    'This campaign is not published on any DOOHmain screen.',
  // 1 sitio · lib/server/ot-repo.ts:176
  'Esta orden de trabajo ya está cerrada: su checklist ya no se puede cambiar':
    'This work order is already closed: its checklist can no longer be changed',
  // 1 sitio · lib/server/arrendadores-controller.ts:310
  'Este contrato está incompleto: falta el arrendador, el importe de la renta y la periodicidad. Complétalo antes de renovarlo.':
    'This contract is incomplete: the landlord, the rent amount and the payment frequency are missing. Complete it before renewing it.',
  // 1 sitio · lib/server/arrendadores-controller.ts:295
  'Este contrato ya está firmado. Escribe el motivo del cambio: la versión firmada se archivará y habrá que volver a firmarlo.':
    'This contract is already signed. Write the reason for the change: the signed version will be archived and it will have to be signed again.',
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
    'Only a manager or above can add a premium to a Roadblock.',
  'La calculadora de spots solo aplica a pantallas digitales vendidas por spot.':
    'The spot calculator only applies to digital screens sold per spot.',
  'La pantalla no tiene capturado cuántos espacios tiene su loop; captúralo en su ficha antes de usar la calculadora.':
    'This screen’s number of loop slots hasn’t been entered; add it on the screen’s profile before using the calculator.',
  'La prima de Roadblock va de 0 a 100 %.':
    'The Roadblock premium goes from 0 to 100%.',
  'La prima de Roadblock solo aplica a una línea marcada como Roadblock.':
    'The Roadblock premium only applies to a line marked as Roadblock.',
  'Con esos espacios y esas horas no sale ni un spot al día.':
    'With these slots and hours, not a single spot would play per day.',
  'La línea no tiene días: revisa las fechas.':
    'The line has no days: check the dates.',
  // 1 sitio · lib/server/impresion-controller.ts:14
  'La campaña es requerida':
    'The campaign is required',
  // 1 sitio · lib/server/perfil-controller.ts:91
  'La contraseña actual no es correcta':
    'The current password is not correct',
  // 1 sitio · lib/server/reportes-controller.ts (D6, 2026-10-29)
  'El reporte abarca como máximo 24 meses por consulta. Acorta el rango de fechas.':
    'The report covers at most 24 months per query. Shorten the date range.',
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
  // 1 sitio · lib/server/firmas-repo.ts:229
  'Los datos del contrato cambiaron mientras los revisabas. Recarga la página, revísalos otra vez y vuelve a enviarlo.':
    'The contract details changed while you were reviewing them. Reload the page, review them again and send it again.',
  // 1 sitio · app/api/energia/recibos/route.ts:50
  'Manda los PDF como formulario, en el campo `archivos`.':
    'Send the PDFs as a form, in the `archivos` field.',
  // 1 sitio · lib/server/config-repo.ts (guardarIdentidadFiscal)
  'Esa razón social no existe o está dada de baja.':
    'That legal entity does not exist or has been deactivated.',
  // 1 sitio · lib/server/entidades-repo.ts (noEsPrincipalEnTx)
  'Es la razón social principal de la empresa. Elige otra en Administración → Identidad de la empresa antes de darla de baja.':
    "It is the company's main legal entity. Choose another one in Administration → Company identity before deactivating it.",
  // 4 sitios · lib/server/arrendadores-controller.ts:412
  'No encontrada':
    'Not found',
  // 9 sitios · lib/server/errores.ts:17
  'No encontrado':
    'Not found',
  // 2 sitios · lib/server/ot-repo.ts
  'No encontramos esa orden de trabajo':
    'We could not find that work order',
  // 1 sitio · lib/server/ot-repo.ts (una OT cerrada ya no admite costo, 08/10)
  'Esta orden de trabajo ya está cerrada: su costo ya no se puede registrar ni cambiar.':
    'This work order is already closed: its cost can no longer be recorded or changed.',
  // 2 sitios · lib/server/perfil-controller.ts:78
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
  // 1 sitio · lib/server/firmas-repo.ts:109
  'No se encontró el texto firmado de este contrato; no se puede archivar su versión firmada.':
    'The signed text of this contract was not found; its signed version cannot be archived.',
  // 1 sitio · app/api/contratos/[id]/versiones/route.ts:22
  'Versión inválida':
    'Invalid version',
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
  // v0.12.3 · pantallas y lugares propios.
  'El lugar elegido no existe o no es propio.':
    'The chosen location does not exist or is not owned.',
  '«Propia» es sí o no':
    '«Owned» is yes or no',
  'Esta pantalla tiene un contrato de renta vigente: termínalo en Arrendadores antes de marcarla como propia.':
    'This screen has an active lease: end it in Landlords before marking it as owned.',
  // 22/10 · el horario individual de una campaña en DOOHmain.
  'Esa campaña no existe':
    'That campaign does not exist',
  // NEG-01 · el buscador de direcciones de Comercial negociación (22/10).
  'Llevas muchas búsquedas seguidas: espera unos minutos':
    'You have run many searches in a row: wait a few minutes',
  'Escribe una dirección de entre 3 y 200 letras':
    'Enter an address between 3 and 200 characters long',
  'El buscador está ocupado: vuelve a intentar en un segundo':
    'The search is busy: try again in a second',
  'El buscador de direcciones no respondió. Puedes marcar el punto directamente en el mapa':
    'The address search did not respond. You can mark the point directly on the map',
  // UBIC-01 · coordenadas, enlaces de Google Maps y el buscador de Google (29/10).
  'El buscador de Google no respondió. Puedes pegar coordenadas o marcar el punto en el mapa':
    'The Google search did not respond. You can paste coordinates or mark the point on the map',
  'El buscador de Google rechazó la búsqueda (revisa la clave de Google de la instancia). Puedes pegar coordenadas o marcar el punto en el mapa':
    "Google's search rejected the request (check this instance's Google key). You can paste coordinates or mark the point on the map",
  'No se pudo abrir el enlace de Google Maps. Pega las coordenadas o marca el punto directamente en el mapa':
    'The Google Maps link could not be opened. Paste the coordinates or mark the point directly on the map',
  'Ese enlace no lleva a un lugar de Google Maps':
    'That link does not lead to a Google Maps place',
  'Ese enlace de Google Maps no trae coordenadas. En Google Maps toca el lugar, copia las coordenadas que salen arriba y pégalas aquí':
    'That Google Maps link has no coordinates. In Google Maps click the place, copy the coordinates shown at the top and paste them here',
  'Escribe una dirección, pega unas coordenadas (19.4326, -99.1332) o un enlace de Google Maps':
    'Enter an address, paste coordinates (19.4326, -99.1332) or a Google Maps link',
  'Solo se aceptan enlaces de Google Maps (google.com/maps o maps.app.goo.gl)':
    'Only Google Maps links are accepted (google.com/maps or maps.app.goo.gl)',
  'Ese enlace corto no es de Google Maps, o le falta el final':
    'That short link is not from Google Maps, or its ending is missing',
  'La latitud va de -90 a 90. ¿Están al revés? Primero va la latitud (en México, alrededor de 14 a 33)':
    'Latitude goes from -90 to 90. Are they reversed? Latitude comes first (in Mexico, around 14 to 33)',
  'La longitud va de -180 a 180':
    'Longitude goes from -180 to 180',
  'El punto (0, 0) está en el mar: no es una ubicación':
    'The point (0, 0) is in the ocean: it is not a location',
  'Los minutos y los segundos van de 0 a 59':
    'Minutes and seconds go from 0 to 59',
  'Primero va la latitud (N o S) y después la longitud (E u O)':
    'Latitude (N or S) comes first, then longitude (E or W)',
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


// ─── Los motivos de `lib/` que comparten servidor y pantalla ────────────────
//
// Lote servidor (2026-11-02). Las reglas puras de `lib/negociacion.ts`,
// `motivoHorarioInvalido`, `interpretarUbicacion` y `MSJ_APROBAR_CON_PENDIENTE`
// devuelven una frase que la pantalla PINTA y que el servidor LANZA por
// variable (`new AppError(motivo)`). El ingles se escribe una sola vez, en el
// diccionario (`textos/servidor.ts`), y de ahi sale este catalogo: asi el mismo
// fallo dice lo mismo lo detecte el navegador o el servidor.
//
// Va APARTE de `CATALOGO_ERRORES` a proposito: aquel lo vigila la guardia de
// entradas muertas de `errores-servidor.test.ts`, que solo ve literales; estas
// viajan por variable y su prueba es `textos/servidor.test.ts`. Se excluyen las
// que llevan huecos `{…}` (el aviso de la franja no es un error y se arma en
// el servidor con el idioma de la peticion).
export const CATALOGO_LIB: Record<string, string> = Object.fromEntries(
  (Object.keys(ES_SERVIDOR) as ClaveServidor[])
    .filter((k) => !ES_SERVIDOR[k].includes('{'))
    .map((k) => [ES_SERVIDOR[k], EN_SERVIDOR[k]]),
)


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
  // Lote servidor (02/11) · `periodo` no esta en `CAMPO_ES`: `humanizarCampo`
  // lo deja en «Periodo», y sin esto «Periodo: Periodo inválido» no se partia.
  'Periodo': 'Period',
}


// ─── Los HUECOS que traen español dentro (lote servidor, 2026-11-02) ────────
//
// Casi todos los huecos de una plantilla son cifras, fechas o nombres que el
// usuario escribio, y se conservan tal cual. Unos pocos traen ESPAÑOL armado
// por el propio servidor —la periodicidad en minuscula, la etapa de un
// prospecto, la lista de datos que faltan—, y dejarlos asi daria «payments
// billed mensual». Esos se traducen pieza por pieza con estas tablas, cerradas
// y sacadas del codigo que las produce. Lo que no esta en la tabla se conserva
// (un nombre propio, una etiqueta nueva): mejor un hueco en español que uno
// inventado.

/** Comillas rectas del español → curvas del ingles (glosario). */
const curvas = (v: string) => v.replace(/"([^"]*)"/g, '“$1”')

// `c.periodicidad.toLowerCase()` (`arrendadores-repo.ts`). En letra, como
// manda el glosario: «billed every two weeks», nunca «billed biweekly».
const PERIODICIDAD_EN: Record<string, string> = {
  diaria: 'daily',
  semanal: 'weekly',
  catorcenal: 'every two weeks',
  quincenal: 'twice a month',
  mensual: 'monthly',
  bimestral: 'every two months',
  trimestral: 'quarterly',
  semestral: 'every six months',
  anual: 'yearly',
}

// `ETIQUETA_ETAPA[...].toLowerCase()` (`lib/captacion.ts`); el ingles es el de
// `comercial.negociacion.etapa.*`, en minuscula.
const ETAPA_EN: Record<string, string> = {
  prospecto: 'a prospect',
  contactado: 'contacted',
  visita: 'at the visit stage',
  negociación: 'in negotiation',
  'en revisión': 'in review',
  aprobado: 'approved',
  rechazado: 'rejected',
  perdido: 'lost',
}

// `faltantesParaRevision()` (`lib/captacion.ts`).
const FALTA_REVISION_EN: Record<string, string> = {
  'un teléfono o un correo de contacto': 'a contact phone number or email',
  'la dirección': 'the address',
  'el dueño: un arrendador existente o el nombre y teléfono del contacto':
    'the owner: an existing landlord or the contact’s name and phone number',
}

// Las etiquetas de `exigir(...)` (`lib/contrato-documento.ts`). Son las del
// mensaje de error, NO el texto legal del contrato: ese no se traduce nunca.
export const FALTA_FIRMA_EN: Record<string, string> = {
  'Razón social de tu empresa': 'Your company’s legal name',
  'RFC de tu empresa': 'Your company’s RFC',
  'Domicilio fiscal de tu empresa': 'Your company’s tax address',
  'Representante legal de tu empresa': 'Your company’s legal representative',
  'Nombre del arrendador': 'Landlord’s name',
  'RFC del arrendador': 'Landlord’s RFC',
  'Domicilio del arrendador': 'Landlord’s address',
  'Dirección del espacio': 'Space address',
  'Fecha de inicio': 'Start date',
  'Fecha de fin': 'End date',
  'Importe de la renta': 'Rent amount',
  'Periodicidad del pago': 'Payment frequency',
}

// ─── ITALIANO · ola 0 (2026-11-03) ──────────────────────────────────────────
//
// Los mismos catalogos, del espanol canonico al italiano. Nacen VACIOS y los
// rellena el lote del servidor (`vault/03-Frontend/italiano-olas.md`). La
// regla de la caida es la de la interfaz (`diccionario.ts`): lo que no tiene
// italiano sale en INGLES. Y un mensaje no sale nunca a medias: un «Campo:
// motivo» o un patron con un hueco traducido solo va en italiano si TODAS sus
// piezas lo tienen; si no, entero en ingles.
//
// Lote L5 (2026-11-03): COMPLETO, en el orden de `CATALOGO_ERRORES`. Lo que
// tambien dice la interfaz (validacion, calculadora, ubicacion) se dice igual
// que su clave del diccionario: lo vigila `textos/costura.test.ts`.
export const CATALOGO_ERRORES_IT: Partial<Record<string, string>> = {
  'La moneda debe ser MXN o USD':
    'La valuta deve essere MXN o USD',
  'La moneda de la instancia ya está fijada: una organización nueva nace en la misma que las demás':
    'La valuta dell’istanza è già fissata: una nuova organizzazione nasce nella stessa valuta delle altre',
  'La moneda no se puede cambiar: se eligió al crear la instancia y los importes guardados no la llevan':
    'La valuta non si può cambiare: è stata scelta alla creazione dell’istanza e gli importi salvati non la riportano',
  'La moneda de la instancia solo se elige al darla de alta':
    'La valuta dell’istanza si sceglie solo alla sua creazione',
  'Un contrato va en la moneda de la instancia: no se puede capturar en otra':
    'Un contratto è nella valuta dell’istanza: non si può inserire in un’altra',
  'Propuesta no encontrada':
    'Proposta non trovata',
  'Solo se agregan sitios a una propuesta en borrador o enviada':
    'Si possono aggiungere siti solo a una proposta in bozza o inviata',
  'Sitio de la propuesta no encontrado':
    'Sito della proposta non trovato',
  'Solo se envía una propuesta en borrador o ya enviada':
    'Si può inviare solo una proposta in bozza o già inviata',
  'Esta propuesta no tiene liga; vuelve a guardarla':
    'Questa proposta non ha un link; salvala di nuovo',
  'No se pudo enviar el correo. La propuesta no cambió: inténtalo de nuevo o copia la liga y mándala tú.':
    'Non è stato possibile inviare l’email. La proposta non è cambiata: riprova o copia il link e invialo tu.',
  'Adjunto inválido':
    'Allegato non valido',
  'Adjunto no encontrado':
    'Allegato non trovato',
  'Alguna de las campañas elegidas no existe en esta organización; no se programó ninguna.':
    'Una delle campagne scelte non esiste in questa organizzazione; non ne è stata programmata nessuna.',
  'Arrendador no encontrado':
    'Locatore non trovato',
  'Otra persona acaba de extender esta campaña más lejos. Recarga para ver la fecha nueva.':
    'Un’altra persona ha appena esteso questa campagna più in là. Ricarica per vedere la nuova data.',
  'Para extender la campaña adjunta el contrato firmado de la extensión':
    'Per estendere la campagna allega il contratto firmato dell’estensione',
  'Campaña no encontrada':
    'Campagna non trovata',
  'Cliente no encontrado':
    'Cliente non trovato',
  'Cobranza no encontrada':
    'Incasso non trovato',
  'Falta el comprobante':
    'Manca la ricevuta',
  'Comprobante no encontrado':
    'Ricevuta non trovata',
  'Esta cobranza ya está pagada':
    'Questo incasso è già pagato',
  'La fecha del pago no puede ser futura':
    'La data del pagamento non può essere futura',
  'Contrato no encontrado':
    'Contratto non trovato',
  'Contrato no encontrado o ya cancelado':
    'Contratto non trovato o già annullato',
  'Correo de contacto inválido':
    'Email di contatto non valida',
  'Correo del arrendatario inválido':
    'Email del conduttore non valida',
  'Correo inválido':
    'Email non valida',
  'CURP inválida':
    'CURP non valido',
  'Debes ingresar tu contraseña actual para confirmar el cambio':
    'Devi inserire la tua password attuale per confermare la modifica',
  'El archivo esta vacio.':
    'Il file è vuoto.',
  'El archivo pesa demasiado para ser un recibo de CFE.':
    'Il file è troppo pesante per essere una bolletta CFE.',
  'El arrendador de ese predio no existe en esta organización':
    'Il locatore di quell’immobile non esiste in questa organizzazione',
  'El arrendador elegido no existe.':
    'Il locatore scelto non esiste.',
  'El arrendador no existe':
    'Il locatore non esiste',
  'El campo `archivos` tiene que traer archivos, no texto.':
    'Il campo `archivos` deve contenere file, non testo.',
  'El checklist de esta orden de trabajo cambió. Recarga la página y vuelve a marcarlo':
    'La checklist di questo ordine di lavoro è cambiata. Ricarica la pagina e spuntala di nuovo',
  'El contrato está CANCELADO; crea uno nuevo en su lugar':
    'Il contratto è ANNULLATO; creane uno nuovo al suo posto',
  'El contrato no existe.':
    'Il contratto non esiste.',
  'El contrato todavía no se ha enviado a firma.':
    'Il contratto non è ancora stato inviato alla firma.',
  'El enlace de firma expiró. Pide uno nuevo.':
    'Il link per la firma è scaduto. Chiedine uno nuovo.',
  'El enlace expiró. Solicita uno nuevo.':
    'Il link è scaduto. Richiedine uno nuovo.',
  'El enlace no es válido.':
    'Il link non è valido.',
  'El montaje digital ya no es una tarea de OT: el arte se sube con "Subir a producción" en la campaña':
    'Il montaggio digitale non è più un intervento di OdL: la grafica si carica con «Invia in produzione» nella campagna',
  'El predio elegido no existe o pertenece a otro arrendador.':
    'L’immobile scelto non esiste o appartiene a un altro locatore.',
  'El predio no existe':
    'L’immobile non esiste',
  'El predio nuevo necesita un nombre.':
    'Il nuovo immobile ha bisogno di un nome.',
  'El predio pertenece a otro arrendador':
    'L’immobile appartiene a un altro locatore',
  'El predio ya tiene un contrato activo. Agrega la pantalla al predio en vez de crear otro contrato, o cancela/vence el contrato anterior primero.':
    'L’immobile ha già un contratto attivo. Aggiungi l’impianto all’immobile invece di creare un altro contratto, oppure annulla o fai scadere prima il contratto precedente.',
  'El ticket esta CERRADO: ya no admite respuesta ni cambio de estado':
    'Il ticket è CHIUSO: non accetta più risposte né cambi di stato',
  'Elige el arrendador de la pantalla: sin propietario no se puede abrir su contrato de arrendamiento.':
    'Scegli il locatore dell’impianto: senza proprietario non si può aprire il suo contratto di locazione.',
  'Enlace de firma no válido.':
    'Link per la firma non valido.',
  'Esa cuenta de Google no tiene el correo verificado.':
    'Questo account Google non ha l’email verificata.',
  'Esa entidad ya tiene ese rol asignado.':
    'Questa entità ha già quel ruolo assegnato.',
  'Esa firma ya no está pendiente.':
    'Questa firma non è più in sospeso.',
  'Esa franja no existe en esta organización':
    'Questa fascia oraria non esiste in questa organizzazione',
  'Esa franja no existe en esta organización o está dada de baja.':
    'Questa fascia oraria non esiste in questa organizzazione o è stata disattivata.',
  'Esa pantalla no existe':
    'Questo impianto non esiste',
  'Esa propuesta no existe en esta organizacion':
    'Questa proposta non esiste in questa organizzazione',
  'Esa propuesta no tiene ningun codigo aplicado':
    'Questa proposta non ha nessun codice di negoziazione applicato',
  'Esa propuesta no tiene paquete aplicado':
    'Questa proposta non ha nessun pacchetto applicato',
  'Esa tarea no aplica a una pantalla digital (no lleva lona ni herrería)':
    'Questo intervento non si applica a uno schermo digitale (non ci sono teli né carpenteria metallica)',
  'Esa temporada no existe en esta organización':
    'Questa stagione non esiste in questa organizzazione',
  'Esa versión firmada no existe':
    'Questa versione firmata non esiste',
  'Escribe tu nombre completo para firmar.':
    'Scrivi il tuo nome completo per firmare.',
  'Ese codigo no existe en esta organizacion':
    'Questo codice non esiste in questa organizzazione',
  'Ese correo ya está en uso':
    'Questa email è già in uso',
  'Ese correo ya está registrado':
    'Questa email è già registrata',
  'Ese digest ya no es el disponible: se publico una version nueva mientras tanto':
    'Questo digest non è più quello disponibile: nel frattempo è stata pubblicata una nuova versione',
  'Ese mes todavía no ha terminado: no puede haber recibo.':
    'Quel mese non è ancora finito: non può esserci una bolletta.',
  'Ese paquete no existe en esta organización':
    'Questo pacchetto non esiste in questa organizzazione',
  'Ese rol no existe en el catalogo.':
    'Questo ruolo non esiste nel catalogo.',
  'Ese tramo no existe en esta organización':
    'Questo scaglione non esiste in questa organizzazione',
  'Esta alta no lleva contraseña: el Dueño entra con Google (ADR 0028). Quita `password` del cuerpo. Si estás siguiendo una tarjeta que la genera, esa tarjeta es anterior al 2026-09-07.':
    'Questa registrazione non richiede una password: il Titolare accede con Google (ADR 0028). Togli `password` dal corpo. Se stai seguendo una scheda che la genera, quella scheda è anteriore al 2026-09-07.',
  'Esta campaña no está publicada en DOOHmain: no hay reproducciones que consultar.':
    'Questa campagna non è pubblicata su DOOHmain: non ci sono passaggi da consultare.',
  'Esta campaña no está publicada en ninguna pantalla de DOOHmain.':
    'Questa campagna non è pubblicata su nessuno schermo di DOOHmain.',
  'Esta orden de trabajo ya está cerrada: su checklist ya no se puede cambiar':
    'Questo ordine di lavoro è già chiuso: la sua checklist non si può più modificare',
  'Este contrato está incompleto: falta el arrendador, el importe de la renta y la periodicidad. Complétalo antes de renovarlo.':
    'Questo contratto è incompleto: mancano il locatore, l’importo dell’affitto e la periodicità. Completalo prima di rinnovarlo.',
  'Este contrato ya está firmado. Escribe el motivo del cambio: la versión firmada se archivará y habrá que volver a firmarlo.':
    'Questo contratto è già firmato. Scrivi il motivo della modifica: la versione firmata verrà archiviata e bisognerà firmarlo di nuovo.',
  'Este contrato ya fue firmado con este enlace.':
    'Questo contratto è già stato firmato con questo link.',
  'Este enlace ya se usó. Solicita uno nuevo.':
    'Questo link è già stato usato. Richiedine uno nuovo.',
  'Este prospecto ya se decidió':
    'Questo prospect è già stato deciso',
  'Falta el id del ticket':
    'Manca l’id del ticket',
  'Falta el recibo a borrar':
    'Manca la bolletta da eliminare',
  'Fechas inválidas (se espera YYYY-MM-DD)':
    'Date non valide (formato atteso AAAA-MM-GG)',
  'Google devolvió la verificación del correo en un formato inesperado.':
    'Google ha restituito la verifica dell’email in un formato inatteso.',
  'Google no devolvió una identidad utilizable.':
    'Google non ha restituito un’identità utilizzabile.',
  'Ítem no encontrado':
    'Voce non trovata',
  'Solo un gerente o superior puede cambiar la tarifa de una pantalla.':
    'Solo un responsabile o superiore può cambiare la tariffa di un impianto.',
  'Esta pantalla no tiene una tarifa calculada para esa unidad. Pide a un gerente o superior que le ponga precio.':
    'Questo impianto non ha una tariffa calcolata per quell’unità. Chiedi a un responsabile o superiore di assegnargli un prezzo.',
  'La calculadora de spots necesita la tarifa por spot de la línea.':
    'Il calcolatore di spot ha bisogno della tariffa per spot della riga.',
  'Solo un gerente o superior puede poner prima a un Roadblock.':
    'Solo un responsabile o superiore può applicare una maggiorazione a un Roadblock.',
  'La calculadora de spots solo aplica a pantallas digitales vendidas por spot.':
    'Il calcolatore di spot si applica solo agli schermi digitali venduti a spot.',
  'La pantalla no tiene capturado cuántos espacios tiene su loop; captúralo en su ficha antes de usar la calculadora.':
    'Per questo schermo non è stato inserito il numero di slot del loop: inseriscilo nella sua scheda prima di usare il calcolatore.',
  'La prima de Roadblock va de 0 a 100 %.':
    'La maggiorazione Roadblock va da 0 a 100%.',
  'La prima de Roadblock solo aplica a una línea marcada como Roadblock.':
    'La maggiorazione Roadblock si applica solo a una riga contrassegnata come Roadblock.',
  'Con esos espacios y esas horas no sale ni un spot al día.':
    'Con questi slot e queste ore non va in onda nemmeno uno spot al giorno.',
  'La línea no tiene días: revisa las fechas.':
    'La riga non ha giorni: controlla le date.',
  'La campaña es requerida':
    'La campagna è obbligatoria',
  'La contraseña actual no es correcta':
    'La password attuale non è corretta',
  'El reporte abarca como máximo 24 meses por consulta. Acorta el rango de fechas.':
    'Il report copre al massimo 24 mesi per richiesta. Riduci l’intervallo di date.',
  'La fecha de fin no puede ser anterior a la de inicio':
    'La data di fine non può essere precedente a quella di inizio',
  'La fecha de pago no puede ser futura':
    'La data di pagamento non può essere futura',
  'La fecha final no puede ser anterior a la inicial':
    'La data finale non può essere precedente a quella iniziale',
  'La identidad de Google expiró. Vuelve a intentarlo.':
    'L’identità di Google è scaduta. Riprova.',
  'La identidad de Google llegó vacía.':
    'L’identità di Google è arrivata vuota.',
  'La identidad de Google no es para esta aplicación.':
    'L’identità di Google non è per questa applicazione.',
  'La identidad de Google no se pudo leer.':
    'Non è stato possibile leggere l’identità di Google.',
  'La identidad de Google no tiene el formato esperado.':
    'L’identità di Google non ha il formato atteso.',
  'La identidad de Google no trae correo.':
    'L’identità di Google non contiene l’email.',
  'La identidad de Google no trae identificador.':
    'L’identità di Google non contiene l’identificativo.',
  'La identidad no la emitió Google.':
    'L’identità non è stata emessa da Google.',
  'La licencia no puede vencer antes de expedirse.':
    'La licenza non può scadere prima di essere rilasciata.',
  'La pantalla no existe':
    'L’impianto non esiste',
  'La pantalla no existe.':
    'L’impianto non esiste.',
  'La pantalla ya pertenece a otro predio':
    'L’impianto appartiene già a un altro immobile',
  'La razon social elegida no existe o es de otra organizacion.':
    'La ragione sociale scelta non esiste o è di un’altra organizzazione.',
  'La razón social elegida no existe o es de otro arrendador.':
    'La ragione sociale scelta non esiste o è di un altro locatore.',
  'La razon social emisora no existe o es de otra organizacion.':
    'La ragione sociale emittente non esiste o è di un’altra organizzazione.',
  'La respuesta de Google no corresponde a esta solicitud.':
    'La risposta di Google non corrisponde a questa richiesta.',
  'La tanda entera pesa demasiado. Subela en varias veces.':
    'L’intero lotto è troppo pesante. Caricalo in più volte.',
  'Licencia no encontrada':
    'Licenza non trovata',
  'Los datos del contrato cambiaron mientras los revisabas. Recarga la página, revísalos otra vez y vuelve a enviarlo.':
    'I dati del contratto sono cambiati mentre li controllavi. Ricarica la pagina, controllali di nuovo e invialo di nuovo.',
  'Manda los PDF como formulario, en el campo `archivos`.':
    'Invia i PDF come modulo, nel campo `archivos`.',
  'Esa razón social no existe o está dada de baja.':
    'Questa ragione sociale non esiste o è stata disattivata.',
  'Es la razón social principal de la empresa. Elige otra en Administración → Identidad de la empresa antes de darla de baja.':
    'È la ragione sociale principale dell’azienda. Scegline un’altra in Impostazioni → Identità dell’azienda prima di disattivarla.',
  'No encontrada':
    'Non trovata',
  'No encontrado':
    'Non trovato',
  'No encontramos esa orden de trabajo':
    'Non abbiamo trovato quell’ordine di lavoro',
  'Esta orden de trabajo ya está cerrada: su costo ya no se puede registrar ni cambiar.':
    'Questo ordine di lavoro è già chiuso: il suo costo non si può più registrare né modificare.',
  'No hay cambios que guardar':
    'Non ci sono modifiche da salvare',
  'No hay fila de actualizaciones: falta la migracion 20260921':
    'Non c’è la riga degli aggiornamenti: manca la migrazione 20260921',
  'No hay nada que actualizar.':
    'Non c’è nulla da aggiornare.',
  'No hay nada que guardar':
    'Non c’è nulla da salvare',
  'No llego ningun archivo.':
    'Non è arrivato nessun file.',
  'No puedes eliminar tu propio usuario':
    'Non puoi eliminare il tuo utente',
  'No puedes modificar tu propio usuario. Cambia tu contraseña en Configuración.':
    'Non puoi modificare il tuo utente. Cambia la tua password in Impostazioni dell’account.',
  'No se pudo abrir el archivo: no parece un PDF valido.':
    'Non è stato possibile aprire il file: non sembra un PDF valido.',
  'No se pudo completar el acceso con Google.':
    'Non è stato possibile completare l’accesso con Google.',
  'No se encontró el texto firmado de este contrato; no se puede archivar su versión firmada.':
    'Non è stato trovato il testo firmato di questo contratto; non si può archiviare la sua versione firmata.',
  'Versión inválida':
    'Versione non valida',
  'No se puede eliminar: la pantalla tiene reservas u órdenes asociadas.':
    'Non si può eliminare: l’impianto ha prenotazioni o ordini associati.',
  'Orden no encontrada':
    'Ordine non trovato',
  'Pago no encontrado':
    'Pagamento non trovato',
  'Para cambiar tu propia contraseña usa Configuración.':
    'Per cambiare la tua password usa Impostazioni dell’account.',
  'Predio no encontrado':
    'Immobile non trovato',
  'Recibo no encontrado':
    'Bolletta non trovata',
  'Reserva no encontrada':
    'Prenotazione non trovata',
  'RFC inválido':
    'RFC non valido',
  'Una licencia ampara un predio O una pantalla suelta, no ambos ni ninguno.':
    'Una licenza copre un immobile O un singolo impianto, non entrambi né nessuno dei due.',
  'Ya existe un usuario con ese correo':
    'Esiste già un utente con questa email',
  'Elige una sola forma de acceso: invitación, contraseña o Google.':
    'Scegli un solo modo di accesso: invito, password o Google.',
  'Dato con formato inválido':
    'Dato con formato non valido',
  'Fecha inválida':
    'Data non valida',
  'Fecha fuera de rango':
    'Data fuori intervallo',
  'Un valor excede la longitud permitida':
    'Un valore supera la lunghezza consentita',
  'Falta un dato obligatorio':
    'Manca un dato obbligatorio',
  'Un valor no cumple las reglas de la tabla':
    'Un valore non rispetta le regole della tabella',
  'El registro ya existe':
    'Il record esiste già',
  'El registro está referenciado por otro':
    'Il record è referenziato da un altro',
  'Sin acceso a ese registro':
    'Nessun accesso a questo record',
  'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.':
    'Il servizio non è disponibile in questo momento. Riprova tra qualche minuto.',
  'Error interno':
    'Errore interno',
  'Datos inválidos':
    'Dati non validi',
  'Este dato es obligatorio':
    'Dato obbligatorio',
  'El valor tiene un formato inválido':
    'Il valore ha un formato non valido',
  'Selecciona una opción válida':
    'Seleziona un’opzione valida',
  'El texto tiene un formato inválido':
    'Il testo ha un formato non valido',
  'El valor no es válido':
    'Il valore non è valido',
  'Ese prospecto no existe':
    'Questo prospect non esiste',
  'El lugar elegido no existe o no es propio.':
    'Il luogo scelto non esiste o non è di proprietà.',
  '«Propia» es sí o no':
    '«Di proprietà» è sì o no',
  'Esta pantalla tiene un contrato de renta vigente: termínalo en Arrendadores antes de marcarla como propia.':
    'Questo impianto ha un contratto di affitto in vigore: chiudilo in Locatori prima di contrassegnarlo come di proprietà.',
  'Esa campaña no existe':
    'Questa campagna non esiste',
  'Llevas muchas búsquedas seguidas: espera unos minutos':
    'Hai fatto molte ricerche di seguito: attendi qualche minuto',
  'Escribe una dirección de entre 3 y 200 letras':
    'Scrivi un indirizzo tra 3 e 200 caratteri',
  'El buscador está ocupado: vuelve a intentar en un segundo':
    'Il motore di ricerca è occupato: riprova tra un secondo',
  'El buscador de direcciones no respondió. Puedes marcar el punto directamente en el mapa':
    'Il motore di ricerca degli indirizzi non ha risposto. Puoi segnare il punto direttamente sulla mappa',
  'El buscador de Google no respondió. Puedes pegar coordenadas o marcar el punto en el mapa':
    'Il motore di ricerca di Google non ha risposto. Puoi incollare le coordinate o segnare il punto sulla mappa',
  'El buscador de Google rechazó la búsqueda (revisa la clave de Google de la instancia). Puedes pegar coordenadas o marcar el punto en el mapa':
    'Il motore di ricerca di Google ha rifiutato la richiesta (controlla la chiave Google dell’istanza). Puoi incollare le coordinate o segnare il punto sulla mappa',
  'No se pudo abrir el enlace de Google Maps. Pega las coordenadas o marca el punto directamente en el mapa':
    'Non è stato possibile aprire il link di Google Maps. Incolla le coordinate o segna il punto direttamente sulla mappa',
  'Ese enlace no lleva a un lugar de Google Maps':
    'Questo link non porta a un luogo di Google Maps',
  'Ese enlace de Google Maps no trae coordenadas. En Google Maps toca el lugar, copia las coordenadas que salen arriba y pégalas aquí':
    'Questo link di Google Maps non contiene coordinate. In Google Maps clicca sul luogo, copia le coordinate che compaiono in alto e incollale qui',
  'Escribe una dirección, pega unas coordenadas (19.4326, -99.1332) o un enlace de Google Maps':
    'Scrivi un indirizzo, incolla delle coordinate (19.4326, -99.1332) o un link di Google Maps',
  'Solo se aceptan enlaces de Google Maps (google.com/maps o maps.app.goo.gl)':
    'Si accettano solo link di Google Maps (google.com/maps o maps.app.goo.gl)',
  'Ese enlace corto no es de Google Maps, o le falta el final':
    'Questo link breve non è di Google Maps, oppure manca la parte finale',
  'La latitud va de -90 a 90. ¿Están al revés? Primero va la latitud (en México, alrededor de 14 a 33)':
    'La latitudine va da -90 a 90. Sono invertite? Prima va la latitudine (in Messico, circa da 14 a 33)',
  'La longitud va de -180 a 180':
    'La longitudine va da -180 a 180',
  'El punto (0, 0) está en el mar: no es una ubicación':
    'Il punto (0, 0) è in mare: non è una posizione',
  'Los minutos y los segundos van de 0 a 59':
    'I minuti e i secondi vanno da 0 a 59',
  'Primero va la latitud (N o S) y después la longitud (E u O)':
    'Prima va la latitudine (N o S) e poi la longitudine (E o O)',
  'Tu organizacion ya tiene razones sociales registradas, asi que el cuestionario ya se contesto. Para cambiarlas, usa la pantalla de Administracion.':
    'La tua organizzazione ha già ragioni sociali registrate, quindi il questionario ha già una risposta. Per modificarle, usa la schermata Impostazioni.',
  'Las tarifas por unidad se guardan en su propia ruta (PATCH /api/sitios/:id/modalidades), que siempre pide la contraseña.':
    'Le tariffe per unità si salvano nella loro rotta (PATCH /api/sitios/:id/modalidades), che chiede sempre la password.',
  'Código postal inválido (5 dígitos)':
    'CAP non valido (5 cifre)',
  'Teléfono inválido. Escribe 10 dígitos (p. ej. 55 1234 5678)':
    'Telefono non valido. Scrivi 10 cifre (es. 55 1234 5678)',
  'Correo inválido. Usa el formato ejemplo@correo.com':
    'Email non valida. Usa il formato esempio@email.com',
  'La contraseña debe tener al menos 8 caracteres':
    'La password deve avere almeno 8 caratteri',
  'La contraseña debe incluir al menos una letra':
    'La password deve contenere almeno una lettera',
  'La contraseña debe incluir al menos un número':
    'La password deve contenere almeno un numero',
  'La contraseña no puede contener espacios':
    'La password non può contenere spazi',
}

/** El de `lib/` sale del diccionario, como `CATALOGO_LIB`: se escribe una vez, en `textos/servidor.ts`. */
export const CATALOGO_LIB_IT: Partial<Record<string, string>> = Object.fromEntries(
  (Object.keys(IT_SERVIDOR) as ClaveServidor[])
    .filter((k) => !ES_SERVIDOR[k].includes('{') && typeof IT_SERVIDOR[k] === 'string' && IT_SERVIDOR[k] !== '')
    .map((k) => [ES_SERVIDOR[k], IT_SERVIDOR[k] as string]),
)

/** El espejo de `CAMPO_EN`. */
export const CAMPO_IT: Partial<Record<string, string>> = {
  'Nombre': 'Nome',
  'Correo': 'Email',
  'Contraseña': 'Password',
  'Contraseña actual': 'Password attuale',
  'RFC': 'RFC',
  'Razón social': 'Ragione sociale',
  'Régimen fiscal': 'Regime fiscale',
  'Uso de CFDI': 'Uso del CFDI',
  'CP fiscal': 'CAP fiscale',
  'Fecha de inicio': 'Data di inizio',
  'Fecha de fin': 'Data di fine',
  'Fecha': 'Data',
  'Comisión': 'Provvigione',
  'Cliente': 'Cliente',
  'Agencia': 'Agenzia',
  'Sitio': 'Sito',
  'Spots por día': 'Spot al giorno',
  'Cantidad': 'Quantità',
  'Tarifa': 'Tariffa',
  'Precio': 'Prezzo',
  'Unidad': 'Unità',
  'Monto': 'Importo',
  'Renta': 'Affitto',
  'Contrato': 'Contratto',
  'Orden de compra': 'Ordine d’acquisto',
  'Documento': 'Documento',
  'Logo': 'Logo',
  'Archivo': 'File',
  'Código': 'Codice',
  'Periodo': 'Periodo',
}

/** El espejo de `FALTA_FIRMA_EN` (para los `huecosIt` de los patrones de la firma). */
export const FALTA_FIRMA_IT: Partial<Record<string, string>> = {
  'Razón social de tu empresa': 'Ragione sociale della tua azienda',
  'RFC de tu empresa': 'RFC della tua azienda',
  'Domicilio fiscal de tu empresa': 'Domicilio fiscale della tua azienda',
  'Representante legal de tu empresa': 'Rappresentante legale della tua azienda',
  'Nombre del arrendador': 'Nome del locatore',
  'RFC del arrendador': 'RFC del locatore',
  'Domicilio del arrendador': 'Domicilio del locatore',
  'Dirección del espacio': 'Indirizzo dello spazio',
  'Fecha de inicio': 'Data di inizio',
  'Fecha de fin': 'Data di fine',
  'Importe de la renta': 'Importo dell’affitto',
  'Periodicidad del pago': 'Periodicità del pagamento',
}

const deTabla = (tabla: Record<string, string>) => (v: string) => tabla[v] ?? v
const lista = (tabla: Record<string, string>) => (v: string) =>
  v.split(', ').map(deTabla(tabla)).join(', ')

// `motivosDeBloqueo(r).join(' y ')` (`clientes-controller.ts`): «1 campaña y
// 3 clientes que lo tienen como agencia». Cada pieza lleva su plural.
function bloqueoClienteEn(v: string): string {
  return v
    .split(' y ')
    .map((pieza) => {
      const m = /^(\d+) (campañas?|facturas?|clientes?|propuestas?)( que lo tienen como agencia)?$/.exec(pieza)
      if (!m) return pieza
      const uno = m[1] === '1'
      const cosa = { campaña: 'campaign', factura: 'invoice', cliente: 'client', propuesta: 'proposal' }[
        m[2].replace(/s$/, '') as 'campaña'
      ]
      const agencia = m[3] ? (uno ? ' that has it as its agency' : ' that have it as their agency') : ''
      return `${m[1]} ${cosa}${uno ? '' : 's'}${agencia}`
    })
    .join(' and ')
}

// `contratos-sitio.ts` · quien esta lejos y de que.
function pantallaLejosEn(v: string): string {
  return v === 'La pantalla' ? 'The screen' : curvas(v)
}
function referenciaPredioEn(v: string): string {
  const yaEsta = /^"(.*)", que ya está en el predio "(.*)"$/.exec(v)
  if (yaEsta) return `“${yaEsta[1]}”, which is already on the property “${yaEsta[2]}”`
  const predio = /^el predio "(.*)"$/.exec(v)
  if (predio) return `the property “${predio[1]}”`
  return curvas(v)
}

/**
 * Un patron de error: reconoce el mensaje YA ARMADO en español y lo rearma en
 * ingles.
 *
 *  · `$n` en `en` es el hueco n, conservado (o pasado por `huecos[n]`).
 *  · `{n|uno|otros}` es el plural del hueco n: «uno» si vale 1, «otros» si no.
 *    Es la regla de los plurales con contador del glosario, que un `$1` solo
 *    no puede cumplir («1 pages»).
 */
export type PatronError = {
  re: RegExp
  en: string
  huecos?: Record<number, (valor: string) => string>
  /**
   * Ola 0 del italiano (2026-11-03): la plantilla italiana, con la misma
   * sintaxis que `en`. La rellena el lote del servidor. Sin ella, el mensaje
   * sale en ingles.
   */
  it?: string
  /**
   * Los huecos que en ingles pasan por una funcion (`huecos`) necesitan la
   * suya en italiano: sin ella el hueco quedaria en espanol o en ingles dentro
   * de una frase italiana, y en ese caso el mensaje entero sale en ingles.
   */
  huecosIt?: Record<number, (valor: string) => string>
}

// ─── Los motivos de zod que llevan un NUMERO dentro ─────────────────────────
//
// El numero sale del esquema, asi que no cabe en un catalogo de frases: va por
// patron y se conserva tal cual. Son los de `mapaZodEs`
// (`lib/server/errores.ts`), uno por uno.
export const PATRONES_ERROR: ReadonlyArray<PatronError> = [
  // PROP-COMPLETA (29/10) · la liga de una propuesta vencida lleva la fecha.
  {
    re: /^Esta propuesta venció el (\d{2}\/\d{2}\/\d{4})\. Pide una actualizada a quien te la envió\.$/,
    en: 'This proposal expired on $1. Ask whoever sent it for an updated one.',
  },
  { re: /^Debe tener al menos (\d+) caracteres$/, en: 'Must be at least $1 characters' },
  { re: /^No puede tener más de (\d+) caracteres$/, en: 'Must not have more than $1 characters' },
  { re: /^Agrega al menos (\d+)$/, en: 'Add at least $1' },
  { re: /^Debe ser mayor o igual a (\d+(?:\.\d+)?)$/, en: 'Must be greater than or equal to $1' },
  { re: /^Debe ser mayor que (\d+(?:\.\d+)?)$/, en: 'Must be greater than $1' },
  { re: /^No puede ser mayor que (\d+(?:\.\d+)?)$/, en: 'Must not be greater than $1' },
  // ADR 0042 · los de `resolverCalculadora` (`lib/calculadora-spots.ts`): el
  // número sale de la pantalla y de la línea, no del esquema, pero el problema
  // es el mismo — no cabe en un catálogo de frases.
  { re: /^Un Roadblock compra los (\d+) espacios del loop, no (\d+)\.$/, en: 'A Roadblock buys every loop slot ($1), not $2.' },
  { re: /^Los espacios del loop van de 1 a (\d+)\.$/, en: 'Loop slots go from 1 to $1.' },
  {
    re: /^Las horas al día van de más de 0 a ([\d.,]+): más horas de las que transmite la pantalla serían spots que no salen\.$/,
    en: 'Hours per day must be greater than 0 and at most $1: hours beyond what the screen broadcasts would be spots that never play.',
  },
  {
    re: /^La cantidad de spots no cuadra con la calculadora: con (\d+) espacios, ([\d.,]+) h al día y (\d+) días son (\d+) spots, no (.+)\.$/,
    en: 'The spot quantity does not match the calculator: with $1 slots, $2 h a day and $3 days it is $4 spots, not $5.',
    // Sin cantidad enviada el servidor escribe «ninguna» (lote servidor).
    huecos: { 5: (v) => (v === 'ninguna' ? 'none' : v) },
  },
  {
    re: /^Un Roadblock necesita los (\d+) espacios del loop libres, y la pantalla tiene (\d+)\.$/,
    en: 'A Roadblock needs every loop slot free ($1); the screen has $2 free.',
  },
  { re: /^Pides (\d+) espacios del loop y la pantalla solo tiene (\d+) libres\.$/, en: 'You’re asking for $1 loop {1|slot|slots} and the screen only has $2 free.' },
  // 2026-10-05 · regla 2 del ADR 0039, las dos direcciones: el canje sobre un
  // paquete de precio final (`canjearCodigo`) y el paquete sobre un cupón ya
  // canjeado (`aplicarPaquete`). Llevan el nombre del paquete y del cupón, y
  // viajan por variable (`new AppError(e.message, …)`), así que la guardia de
  // literales no las ve: van por patrón, como las del ADR 0042.
  {
    re: /^El paquete "(.+)" de esta propuesta es precio final y no admite codigos promocionales\. Quita el paquete, o cambialo por uno que si los admita, antes de aplicar el codigo\.$/,
    en: 'The bundle “$1” on this proposal is a final price and does not accept negotiation codes. Remove the bundle, or swap it for one that does, before applying the code.',
  },
  {
    re: /^El paquete "(.+)" es precio final y no admite codigos promocionales\. Quita el codigo "(.+)" antes de aplicarlo, o usa un paquete que si los admita\.$/,
    en: 'The bundle “$1” is a final price and does not accept negotiation codes. Remove the code “$2” before applying it, or use a bundle that does.',
  },

  // ── LOTE SERVIDOR (ola 4, 2026-11-02) · las `new AppError(`…${x}…`)` ──────
  //
  // Una por plantilla del arbol, en el orden de `errores-servidor-plantillas
  // .test.ts`, que es quien exige que no falte ninguna. La regex es el español
  // LITERAL del sitio con cada `${…}` cambiado por un grupo.

  // app/api/energia/recibos/route.ts y lib/server/recibos-cfe/controller.ts
  { re: /^Los meses esperados tienen que ser (.+)\.$/, en: 'The expected months must be $1.' },
  {
    re: /^Son (\d+) archivos y el maximo por tanda es (\d+)\.$/,
    en: 'There are $1 files and the maximum per batch is $2.',
  },
  {
    re: /^Son (\d+) archivos y el maximo por tanda es (\d+)\. Subelos en varias veces\.$/,
    en: 'There are $1 files and the maximum per batch is $2. Upload them in several batches.',
  },
  { re: /^«(.+)» pesa demasiado para ser un recibo de CFE\.$/, en: '“$1” is too large to be a CFE bill.' },
  // lib/server/recibos-cfe/lector-pdf.ts
  {
    re: /^El PDF tiene (\d+) paginas y un recibo de CFE tiene 2\. Sube los recibos por separado\.$/,
    en: 'The PDF has $1 {1|page|pages} and a CFE bill has 2. Upload the bills separately.',
  },
  // lib/server/arrendadores-controller.ts
  {
    re: /^No se puede borrar: el arrendador tiene (\d+) predio\(s\) y (\d+) contrato\(s\) activo\(s\)\. Reasigna o cancela sus contratos primero\.$/,
    en: 'Cannot delete: the landlord has $1 {1|property|properties} and $2 active {2|contract|contracts}. Reassign or cancel their contracts first.',
  },
  {
    re: /^La fecha de fin \((.+)\) no puede ser anterior a la de inicio \((.+)\)\.$/,
    en: 'The end date ($1) cannot be earlier than the start date ($2).',
  },
  {
    re: /^La nueva fecha de fin debe ser posterior a la vigencia actual \((.+)\)\.$/,
    en: 'The new end date must be after the current term ($1).',
  },
  {
    re: /^Este periodo ya está pagado \((.+)\)\. Cancélalo antes de volver a registrarlo\.$/,
    en: 'This period is already paid ($1). Cancel it before recording it again.',
    huecos: { 1: (v) => (v === 'sin fecha' ? 'no date' : v) },
  },
  {
    re: /^No se puede eliminar: (\d+) contratos? facturan? a esta razón social\. Cámbiala en esos contratos primero\.$/,
    en: 'Cannot delete: $1 {1|contract bills|contracts bill} to this legal entity. Change it in {1|that contract|those contracts} first.',
  },
  // lib/server/arrendadores-repo.ts
  {
    re: /^La vigencia del contrato genera más de (\d+) pagos con periodicidad (.+)\. Revisa la fecha de fin: con esa cadencia el calendario no puede cubrir un plazo tan largo\.$/,
    en: 'The contract term generates more than $1 payments billed $2. Check the end date: at that frequency the schedule cannot cover such a long term.',
    huecos: { 2: deTabla(PERIODICIDAD_EN) },
  },
  {
    re: /^Ese espacio ya estuvo arrendado hasta el (.+)\. El contrato nuevo debe empezar el (.+) o después, para no traslapar la vigencia anterior\.$/,
    en: 'That space was already leased until $1. The new contract must start on $2 or later, so it does not overlap the previous term.',
  },
  // lib/server/campanas-repo.ts
  {
    re: /^Esta campana llega hasta el (.+)\. Extender solo puede alargarla: elige una fecha posterior\.$/,
    en: 'This campaign runs until $1. Extending can only make it longer: choose a later date.',
  },
  // lib/server/captacion-repo.ts
  {
    re: /^No se puede editar un prospecto (.+)$/,
    en: 'This prospect cannot be edited: it is $1',
    huecos: { 1: deTabla(ETAPA_EN) },
  },
  {
    re: /^Para enviarlo a revisión falta: (.+)$/,
    en: 'To send it for review, it still needs: $1',
    huecos: { 1: lista(FALTA_REVISION_EN) },
  },
  // lib/server/clientes-controller.ts
  {
    re: /^No se puede borrar: el cliente tiene (.+)\. Quítalos o reasígnalos antes de borrarlo\.$/,
    en: 'Cannot delete: the client has $1. Remove or reassign them before deleting it.',
    huecos: { 1: bloqueoClienteEn },
  },
  // lib/server/contratos-sitio.ts
  {
    re: /^(.+?) está a (.+?) de (.+)\. Un predio es un solo inmueble y su renta se reparte entre las pantallas que cuelgan de él, así que una que está lejos abarataría a las demás\. Revisa la dirección o las coordenadas, o dale su propio predio\. \(El límite son (\d+) m\.\)$/,
    en: '$1 is $2 from $3. A property is a single premises and its rent is split among the screens attached to it, so one that is far away would lower the cost for the others. Check the address or the coordinates, or give it its own property. (The limit is $4 m.)',
    huecos: { 1: pantallaLejosEn, 3: referenciaPredioEn },
  },
  {
    re: /^"(.+)" todavía no se puede vender: su contrato de arrendamiento está incompleto\. Complétalo en Arrendadores \(arrendador, vigencia, importe y periodicidad\) antes de reservarla\.$/,
    en: '“$1” cannot be sold yet: its lease is incomplete. Complete it in Landlords (landlord, term, amount and frequency) before booking it.',
  },
  // lib/server/entidades-controller.ts
  { re: /^El rol (.+) viene repetido$/, en: 'The role $1 is repeated' },
  {
    re: /^Estos roles no existen en el catalogo: (.+)\. Los disponibles son: (.+)\.$/,
    en: 'These roles do not exist in the catalog: $1. The available ones are: $2.',
  },
  // lib/server/firmas-repo.ts
  {
    re: /^No se puede enviar a firma: faltan (\d+) datos por capturar \((.+)\)\.$/,
    en: 'Cannot send for signature: $1 {1|field is|fields are} still missing ($2).',
    huecos: { 2: lista(FALTA_FIRMA_EN) },
  },
  { re: /^El nombre no puede pasar de (\d+) caracteres\.$/, en: 'The name cannot be longer than $1 characters.' },
  // lib/server/horario-doohmain.ts
  {
    re: /^Esta campaña ya tiene franja horaria \((.+), (.+) a (.+)\): ese es el horario que se manda a DOOHmain y no lleva otro\.$/,
    en: 'This campaign already has a daypart ($1, $2 to $3): that is the schedule sent to DOOHmain, and it cannot have another one.',
  },
  // lib/server/propuestas-controller.ts y lib/server/rejilla-controller.ts
  {
    re: /^La franja horaria "(.+)" no existe en esta organización o está desactivada\.$/,
    en: 'The daypart “$1” does not exist in this organization or is deactivated.',
  },
  {
    re: /^La temporada "(.+)" no existe en esta organización o está desactivada\.$/,
    en: 'The season “$1” does not exist in this organization or is deactivated.',
  },
  {
    re: /^La misma combinación de unidad, franja y temporada viene dos veces \((.+)\)\.$/,
    en: 'The same combination of unit, daypart and season appears twice ($1).',
  },
  {
    re: /^La combinación (.+) viene a la vez para guardar y para quitar\.$/,
    en: 'The combination $1 is sent both to save and to remove.',
  },
  // lib/server/sitios-controller.ts
  { re: /^La unidad "(.+)" viene repetida\.$/, en: 'The unit “$1” is repeated.' },
  {
    re: /^La unidad "(.+)" se manda a guardar y a quitar a la vez: decide una\.$/,
    en: 'The unit “$1” is sent to be saved and removed at the same time: choose one.',
  },
  // lib/server/uploads.ts · todas llevan delante `${campo}`: «Logo: », vacio,
  // o el nombre de la propiedad («arte: »). El grupo 1 lo conserva; con un
  // campo de `CAMPO_EN` ya llega partido por `traducirError` y vale ''.
  { re: /^(.*?)No se recibió ningún archivo$/, en: '$1No file was received' },
  {
    re: /^(.*?)El archivo debe venir como data URL en base64 \((.+)\)$/,
    en: '$1The file must come as a base64 data URL ($2)',
  },
  {
    re: /^(.*?)Tipo de archivo no permitido aquí\. Se aceptan: (.+)$/,
    en: '$1File type not allowed here. Accepted: $2',
  },
  { re: /^(.*?)El archivo supera el límite de (.+) MB$/, en: '$1The file exceeds the $2 MB limit' },
  { re: /^(.*?)El archivo está corrupto o mal codificado$/, en: '$1The file is corrupt or badly encoded' },
  { re: /^(.*?)El archivo está vacío$/, en: '$1The file is empty' },
  {
    re: /^(.*?)El contenido del archivo no corresponde a un (.+) real$/,
    en: '$1The file content is not a real $2',
  },
  { re: /^(.*?)El contenido del archivo no es texto válido$/, en: '$1The file content is not valid text' },
  {
    re: /^(.*?)El SVG contiene código ejecutable \(scripts o manejadores de eventos\) y no se puede aceptar$/,
    en: '$1The SVG contains executable code (scripts or event handlers) and cannot be accepted',
  },

  // ── CONFIRMACIONES DE APROBAR (2026-11-02, `feat/ingles-confirmaciones`) ──
  //
  // TOPE-03 · `mensajeTopeVigente` (`lib/descuento.ts`): aprobar con un
  // descuento que ya no cabe en el tope VIGENTE. La ruta
  // `PATCH /api/propuestas/[id]` lo responde a mano (409 con
  // `descuentoSobreTope`) y lo pasa por `traducirError`: las cuatro cifras
  // solo las tiene el servidor, asi que la pantalla no puede pintar su clave.
  // Tres formas alcanzables: sin volumen, con volumen, y con el volumen solo
  // por encima del tope (que implica volumen > 0, asi que siempre nombra el
  // total). Las cifras salen de `pct()`: enteros o hasta dos decimales.
  {
    re: /^El descuento de esta propuesta, (\d+(?:\.\d+)?) %, supera el tope vigente de tu organización, (\d+(?:\.\d+)?) %: el tope se bajó después de guardarlo\. Ajusta el descuento antes de aprobarla \(cabe hasta (\d+(?:\.\d+)?) % comercial\), o pídele a Administración que suba el tope\.$/,
    en:
      'The discount on this proposal, $1%, is over your organization’s current discount cap, $2%: the cap was lowered ' +
      'after it was saved. Adjust the discount before approving it (the commercial discount can go up to $3%), ' +
      'or ask an admin to raise the cap in Settings.',
  },
  {
    re: /^El descuento de esta propuesta, (\d+(?:\.\d+)?) % \((\d+(?:\.\d+)?) % en total con el (\d+(?:\.\d+)?) % por volumen\), supera el tope vigente de tu organización, (\d+(?:\.\d+)?) %: el tope se bajó después de guardarlo\. Ajusta el descuento antes de aprobarla \(cabe hasta (\d+(?:\.\d+)?) % comercial\), o pídele a Administración que suba el tope\.$/,
    en:
      'The discount on this proposal, $1% ($2% in total with the $3% volume discount), is over your organization’s ' +
      'current discount cap, $4%: the cap was lowered after it was saved. Adjust the discount before approving it ' +
      '(the commercial discount can go up to $5%), or ask an admin to raise the cap in Settings.',
  },
  {
    re: /^El descuento de esta propuesta, (\d+(?:\.\d+)?) % \((\d+(?:\.\d+)?) % en total con el (\d+(?:\.\d+)?) % por volumen\), supera el tope vigente de tu organización, (\d+(?:\.\d+)?) %: el tope se bajó después de guardarlo\. El descuento por volumen \((\d+(?:\.\d+)?) %\) ya supera el tope \((\d+(?:\.\d+)?) %\): deja el descuento comercial en 0 % o pide a Administración que suba el tope\.$/,
    en:
      'The discount on this proposal, $1% ($2% in total with the $3% volume discount), is over your organization’s ' +
      'current discount cap, $4%: the cap was lowered after it was saved. The volume discount ($5%) is already ' +
      'over the cap ($6%): leave the commercial discount at 0% or ask an admin to raise the cap in Settings.',
  },

  // ── OLA 6 (2026-11-03, `feat/ingles-ola6`) · los dos que dejo la ola 4 ──
  //
  // TOPE-02/04 · `DescuentoSobreTope` (`lib/descuento.ts`): EDITAR el descuento
  // por encima del tope. La ruta `PATCH /api/propuestas/[id]` lo responde a
  // mano y ahora lo pasa por `traducirError`. Tres formas: sin volumen, con
  // volumen, y con el volumen solo por encima del tope (la misma frase que
  // cierra el patron de arriba, aqui sola). Mismo glosario que la ola 4:
  // discount cap, commercial / volume discount, «an admin … in Settings».
  {
    re: /^El descuento máximo que autoriza tu organización es (\d+(?:\.\d+)?) %, y se pidió (\d+(?:\.\d+)?) %\. Cabe hasta (\d+(?:\.\d+)?) % comercial\. Pídele a Administración que lo suba si hace falta\.$/,
    en:
      'The maximum discount your organization allows is $1%, and $2% was requested. The commercial discount can go up ' +
      'to $3%. Ask an admin to raise it in Settings if needed.',
  },
  {
    re: /^El descuento máximo que autoriza tu organización es (\d+(?:\.\d+)?) %\. Esta propuesta ya lleva (\d+(?:\.\d+)?) % por volumen, así que un (\d+(?:\.\d+)?) % comercial deja un (\d+(?:\.\d+)?) % en total \(los descuentos se componen, no se suman\)\. Cabe hasta (\d+(?:\.\d+)?) % comercial\. Pídele a Administración que lo suba si hace falta\.$/,
    en:
      'The maximum discount your organization allows is $1%. This proposal already has a $2% volume discount, so a $3% ' +
      'commercial discount leaves $4% in total (discounts compound, they don’t add up). The commercial discount can go ' +
      'up to $5%. Ask an admin to raise it in Settings if needed.',
  },
  {
    re: /^El descuento por volumen \((\d+(?:\.\d+)?) %\) ya supera el tope \((\d+(?:\.\d+)?) %\): deja el descuento comercial en 0 % o pide a Administración que suba el tope\.$/,
    en:
      'The volume discount ($1%) is already over the cap ($2%): leave the commercial discount at 0% or ask an admin to ' +
      'raise the cap in Settings.',
  },
  // La negociacion con la agencia sin validar (`propuestas-repo.ts`). Al CREAR
  // llega por `respuestaError()`; al APROBAR, por el 400 a mano del `PATCH`.
  // El nombre puede venir vacio (`bloq.nombre ?? ''`): de ahi el `.*`.
  {
    re: /^La negociación con la agencia (.*) no está validada; valídala antes de crear la propuesta$/,
    en: 'The negotiation with the agency $1 is not validated; validate it before creating the proposal',
  },
  {
    re: /^La negociación con la agencia (.*) no está validada; no se puede aprobar la propuesta$/,
    en: 'The negotiation with the agency $1 is not validated; the proposal can’t be approved',
  },
  // Ola 7 · `PaqueteImposible` al QUITAR un paquete (`paquetes-repo.ts`). La
  // frase ENVUELVE el mensaje del tope (`DescuentoSobreTope`, los tres patrones
  // de arriba): el hueco 2 se traduce a su vez con `traducirMotivo`, y si no se
  // reconoce se queda en espanol SOLO esa pieza. El nombre del paquete es dato.
  // `.+?` en el tope y el cierre literal anclado: el nombre puede llevar comillas.
  {
    re: /^No se puede quitar el paquete "(.*)": sin el paquete vuelve a aplicarse el descuento por volumen de las lineas\. (.+?) Baja primero el descuento comercial y vuelve a quitar el paquete\.$/,
    en:
      'The bundle “$1” can’t be removed: without the bundle, the volume discount of the lines applies again. $2 ' +
      'Lower the commercial discount first, then remove the bundle again.',
    huecos: { 2: (v) => traducirMotivo(v) },
  },
]

// ─── ITALIANO DE LOS PATRONES · lote L5 (2026-11-03) ────────────────────────
//
// Una entrada por patron, con la plantilla `en` de su patron como clave: es
// lo que se lee al revisar y no cambia si se retoca la regex. Se cuelga de
// cada patron al cargar el modulo (abajo). Si la clave no casa con ningun
// patron, `errores-servidor-italiano.test.ts` lo dice; si a un patron le
// falta su italiano, lo cuenta la cobertura (fila «errores · patrones»).
//
// Las cifras que el servidor escribe a la mexicana («2.5», «1,000») pasan
// por `cifraIt` («2,5», «1.000»); los nombres entre comillas rectas, a
// caporali; y los huecos con espanol armado, por sus tablas de arriba.

/** «2.5» → «2,5», «1,000.5» → «1.000,5». Lo que no es una cifra, tal cual. */
function cifraIt(v: string): string {
  if (!/^-?\d[\d,]*(\.\d+)?$/.test(v)) return v
  return v.replace(/[.,]/g, (c) => (c === '.' ? ',' : '.'))
}
/** Una distancia «350 m» / «1.2 km»: solo la cifra. */
const distanciaIt = (v: string) => v.replace(/^(\d[\d,]*(?:\.\d+)?)/, (c) => cifraIt(c))
// Marca de «esta pieza no tiene italiano»: si aparece en el mensaje armado,
// `motivoEnItaliano` lo descarta entero y cae al ingles.
const SIN_ITALIANO = '\u0000sin-italiano\u0000'
const caporali = (v: string) => v.replace(/"([^"]*)"/g, '«$1»')

const PERIODICIDAD_IT: Record<string, string> = {
  diaria: 'giornaliera',
  semanal: 'settimanale',
  catorcenal: 'ogni due settimane',
  quincenal: 'due volte al mese',
  mensual: 'mensile',
  bimestral: 'ogni due mesi',
  trimestral: 'trimestrale',
  semestral: 'ogni sei mesi',
  anual: 'annuale',
}

const ETAPA_IT: Record<string, string> = {
  prospecto: 'un prospect',
  contactado: 'contattato',
  visita: 'in fase di visita',
  negociación: 'in negoziazione',
  'en revisión': 'in revisione',
  aprobado: 'approvato',
  rechazado: 'rifiutato',
  perdido: 'perso',
}

const FALTA_REVISION_IT: Record<string, string> = {
  'un teléfono o un correo de contacto': 'un telefono o un’email di contatto',
  'la dirección': 'l’indirizzo',
  'el dueño: un arrendador existente o el nombre y teléfono del contacto':
    'il proprietario: un locatore esistente o il nome e il telefono del contatto',
}

function bloqueoClienteIt(v: string): string {
  return v
    .split(' y ')
    .map((pieza) => {
      const m = /^(\d+) (campañas?|facturas?|clientes?|propuestas?)( que lo tienen como agencia)?$/.exec(pieza)
      if (!m) return pieza
      const uno = m[1] === '1'
      const [singular, plural] = {
        campaña: ['campagna', 'campagne'],
        factura: ['fattura', 'fatture'],
        cliente: ['cliente', 'clienti'],
        propuesta: ['proposta', 'proposte'],
      }[m[2].replace(/s$/, '') as 'campaña']
      const agencia = m[3] ? (uno ? ' che lo ha come agenzia' : ' che lo hanno come agenzia') : ''
      return `${m[1]} ${uno ? singular : plural}${agencia}`
    })
    .join(' e ')
}

function pantallaLejosIt(v: string): string {
  return v === 'La pantalla' ? 'Lo schermo' : caporali(v)
}
function referenciaPredioIt(v: string): string {
  const yaEsta = /^"(.*)", que ya está en el predio "(.*)"$/.exec(v)
  if (yaEsta) return `«${yaEsta[1]}», che è già nell’immobile «${yaEsta[2]}»`
  const predio = /^el predio "(.*)"$/.exec(v)
  if (predio) return `l’immobile «${predio[1]}»`
  return caporali(v)
}

const PCT2 = { 1: cifraIt, 2: cifraIt }
const PCT3 = { ...PCT2, 3: cifraIt }
const PCT5 = { ...PCT3, 4: cifraIt, 5: cifraIt }
const PCT6 = { ...PCT5, 6: cifraIt }

const PATRONES_IT: Record<string, { it: string; huecosIt?: Record<number, (valor: string) => string> }> = {
  'This proposal expired on $1. Ask whoever sent it for an updated one.': {
    it: 'Questa proposta è scaduta il $1. Chiedine una aggiornata a chi te l’ha inviata.',
  },
  'Must be at least $1 characters': { it: 'Deve avere almeno $1 caratteri' },
  'Must not have more than $1 characters': { it: 'Non può avere più di $1 caratteri' },
  'Add at least $1': { it: 'Aggiungine almeno $1' },
  'Must be greater than or equal to $1': { it: 'Deve essere maggiore o uguale a $1', huecosIt: { 1: cifraIt } },
  'Must be greater than $1': { it: 'Deve essere maggiore di $1', huecosIt: { 1: cifraIt } },
  // Igual que `compartidos.cifra.mayor` (lo pinta tambien CampoCifra).
  'Must not be greater than $1': { it: 'Non può essere maggiore di $1', huecosIt: { 1: cifraIt } },
  // Los de la calculadora, iguales a `compartidos.calc.motivo.*`.
  'A Roadblock buys every loop slot ($1), not $2.': {
    it: 'Un Roadblock acquista tutti gli slot del loop ($1), non $2.',
  },
  'Loop slots go from 1 to $1.': { it: 'Gli slot del loop vanno da 1 a $1.' },
  'Hours per day must be greater than 0 and at most $1: hours beyond what the screen broadcasts would be spots that never play.':
    {
      it: 'Le ore al giorno devono essere più di 0 e al massimo $1: le ore oltre quelle che lo schermo trasmette sarebbero spot che non vanno mai in onda.',
      huecosIt: { 1: cifraIt },
    },
  'The spot quantity does not match the calculator: with $1 slots, $2 h a day and $3 days it is $4 spots, not $5.': {
    it: 'La quantità di spot non corrisponde al calcolatore: con $1 slot, $2 h al giorno e $3 giorni sono $4 spot, non $5.',
    huecosIt: { 2: cifraIt, 5: (v) => (v === 'ninguna' ? 'nessuna' : v) },
  },
  'A Roadblock needs every loop slot free ($1); the screen has $2 free.': {
    it: 'Un Roadblock richiede liberi tutti gli slot del loop ($1); lo schermo ne ha liberi $2.',
  },
  'You’re asking for $1 loop {1|slot|slots} and the screen only has $2 free.': {
    it: 'Chiedi $1 slot del loop e lo schermo ne ha liberi solo $2.',
  },
  'The bundle “$1” on this proposal is a final price and does not accept negotiation codes. Remove the bundle, or swap it for one that does, before applying the code.':
    {
      it: 'Il pacchetto «$1» di questa proposta è a prezzo finale e non ammette codici di negoziazione. Togli il pacchetto, o sostituiscilo con uno che li ammetta, prima di applicare il codice.',
    },
  'The bundle “$1” is a final price and does not accept negotiation codes. Remove the code “$2” before applying it, or use a bundle that does.':
    {
      it: 'Il pacchetto «$1» è a prezzo finale e non ammette codici di negoziazione. Togli il codice «$2» prima di applicarlo, oppure usa un pacchetto che li ammetta.',
    },
  'The expected months must be $1.': { it: 'I mesi attesi devono essere $1.' },
  'There are $1 files and the maximum per batch is $2.': { it: 'Sono $1 file e il massimo per lotto è $2.' },
  'There are $1 files and the maximum per batch is $2. Upload them in several batches.': {
    it: 'Sono $1 file e il massimo per lotto è $2. Caricali in più volte.',
  },
  '“$1” is too large to be a CFE bill.': { it: '«$1» è troppo pesante per essere una bolletta CFE.' },
  'The PDF has $1 {1|page|pages} and a CFE bill has 2. Upload the bills separately.': {
    it: 'Il PDF ha $1 {1|pagina|pagine} e una bolletta CFE ne ha 2. Carica le bollette separatamente.',
  },
  'Cannot delete: the landlord has $1 {1|property|properties} and $2 active {2|contract|contracts}. Reassign or cancel their contracts first.':
    {
      it: 'Non si può eliminare: il locatore ha $1 {1|immobile|immobili} e $2 {2|contratto attivo|contratti attivi}. Riassegna o annulla prima i suoi contratti.',
    },
  'The end date ($1) cannot be earlier than the start date ($2).': {
    it: 'La data di fine ($1) non può essere precedente a quella di inizio ($2).',
  },
  'The new end date must be after the current term ($1).': {
    it: 'La nuova data di fine deve essere successiva alla durata attuale ($1).',
  },
  'This period is already paid ($1). Cancel it before recording it again.': {
    it: 'Questo periodo è già pagato ($1). Annullalo prima di registrarlo di nuovo.',
    huecosIt: { 1: (v) => (v === 'sin fecha' ? 'senza data' : v) },
  },
  'Cannot delete: $1 {1|contract bills|contracts bill} to this legal entity. Change it in {1|that contract|those contracts} first.':
    {
      it: 'Non si può eliminare: $1 {1|contratto fattura|contratti fatturano} a questa ragione sociale. Cambiala prima in {1|quel contratto|quei contratti}.',
    },
  'The contract term generates more than $1 payments billed $2. Check the end date: at that frequency the schedule cannot cover such a long term.':
    {
      it: 'La durata del contratto genera più di $1 pagamenti (periodicità: $2). Controlla la data di fine: con questa cadenza il calendario non può coprire una durata così lunga.',
      huecosIt: { 2: deTabla(PERIODICIDAD_IT) },
    },
  'That space was already leased until $1. The new contract must start on $2 or later, so it does not overlap the previous term.':
    {
      it: 'Quello spazio era già affittato fino al $1. Il nuovo contratto deve iniziare il $2 o dopo, per non sovrapporsi alla durata precedente.',
    },
  'This campaign runs until $1. Extending can only make it longer: choose a later date.': {
    it: 'Questa campagna dura fino al $1. Estenderla può solo allungarla: scegli una data successiva.',
  },
  'This prospect cannot be edited: it is $1': {
    it: 'Non si può modificare questo prospect: è $1',
    huecosIt: { 1: deTabla(ETAPA_IT) },
  },
  'To send it for review, it still needs: $1': {
    it: 'Per inviarlo in revisione manca ancora: $1',
    huecosIt: { 1: lista(FALTA_REVISION_IT) },
  },
  'Cannot delete: the client has $1. Remove or reassign them before deleting it.': {
    it: 'Non si può eliminare: il cliente ha $1. Rimuovili o riassegnali prima di eliminarlo.',
    huecosIt: { 1: bloqueoClienteIt },
  },
  '$1 is $2 from $3. A property is a single premises and its rent is split among the screens attached to it, so one that is far away would lower the cost for the others. Check the address or the coordinates, or give it its own property. (The limit is $4 m.)':
    {
      it: '$1 è a $2 da $3. Un immobile è un unico bene e il suo affitto si divide tra gli schermi che ne dipendono, quindi uno lontano abbasserebbe il costo degli altri. Controlla l’indirizzo o le coordinate, oppure assegnagli un immobile proprio. (Il limite è $4 m.)',
      huecosIt: { 1: pantallaLejosIt, 2: distanciaIt, 3: referenciaPredioIt, 4: cifraIt },
    },
  '“$1” cannot be sold yet: its lease is incomplete. Complete it in Landlords (landlord, term, amount and frequency) before booking it.':
    {
      it: '«$1» non si può ancora vendere: il suo contratto di locazione è incompleto. Completalo in Locatori (locatore, durata, importo e periodicità) prima di prenotarlo.',
    },
  'The role $1 is repeated': { it: 'Il ruolo $1 è ripetuto' },
  'These roles do not exist in the catalog: $1. The available ones are: $2.': {
    it: 'Questi ruoli non esistono nel catalogo: $1. Quelli disponibili sono: $2.',
  },
  'Cannot send for signature: $1 {1|field is|fields are} still missing ($2).': {
    it: 'Non si può inviare alla firma: {1|manca ancora $1 dato|mancano ancora $1 dati} ($2).',
    huecosIt: { 2: lista(FALTA_FIRMA_IT as Record<string, string>) },
  },
  'The name cannot be longer than $1 characters.': { it: 'Il nome non può superare $1 caratteri.' },
  'This campaign already has a daypart ($1, $2 to $3): that is the schedule sent to DOOHmain, and it cannot have another one.':
    {
      it: 'Questa campagna ha già una fascia oraria ($1, $2–$3): è l’orario che si invia a DOOHmain e non può averne un altro.',
    },
  'The daypart “$1” does not exist in this organization or is deactivated.': {
    it: 'La fascia oraria «$1» non esiste in questa organizzazione o è disattivata.',
  },
  'The season “$1” does not exist in this organization or is deactivated.': {
    it: 'La stagione «$1» non esiste in questa organizzazione o è disattivata.',
  },
  'The same combination of unit, daypart and season appears twice ($1).': {
    it: 'La stessa combinazione di unità, fascia oraria e stagione compare due volte ($1).',
  },
  'The combination $1 is sent both to save and to remove.': {
    it: 'La combinazione $1 viene inviata sia da salvare sia da rimuovere.',
  },
  'The unit “$1” is repeated.': { it: 'L’unità «$1» è ripetuta.' },
  'The unit “$1” is sent to be saved and removed at the same time: choose one.': {
    it: 'L’unità «$1» viene inviata da salvare e da rimuovere allo stesso tempo: scegli una delle due.',
  },
  '$1No file was received': { it: '$1Non è stato ricevuto nessun file' },
  '$1The file must come as a base64 data URL ($2)': { it: '$1Il file deve arrivare come data URL in base64 ($2)' },
  '$1File type not allowed here. Accepted: $2': { it: '$1Tipo di file non consentito qui. Accettati: $2' },
  '$1The file exceeds the $2 MB limit': { it: '$1Il file supera il limite di $2 MB', huecosIt: { 2: cifraIt } },
  '$1The file is corrupt or badly encoded': { it: '$1Il file è danneggiato o codificato male' },
  '$1The file is empty': { it: '$1Il file è vuoto' },
  '$1The file content is not a real $2': { it: '$1Il contenuto del file non è un vero $2' },
  '$1The file content is not valid text': { it: '$1Il contenuto del file non è testo valido' },
  '$1The SVG contains executable code (scripts or event handlers) and cannot be accepted': {
    it: '$1L’SVG contiene codice eseguibile (script o gestori di eventi) e non può essere accettato',
  },
  'The discount on this proposal, $1%, is over your organization’s current discount cap, $2%: the cap was lowered after it was saved. Adjust the discount before approving it (the commercial discount can go up to $3%), or ask an admin to raise the cap in Settings.':
    {
      it:
        'Lo sconto di questa proposta, $1%, supera il tetto di sconto attuale della tua organizzazione, $2%: il tetto è stato abbassato dopo il salvataggio. ' +
        'Correggi lo sconto prima di approvarla (lo sconto commerciale può arrivare fino al $3%), oppure chiedi a un amministratore di alzare il tetto in Impostazioni.',
      huecosIt: PCT3,
    },
  'The discount on this proposal, $1% ($2% in total with the $3% volume discount), is over your organization’s current discount cap, $4%: the cap was lowered after it was saved. Adjust the discount before approving it (the commercial discount can go up to $5%), or ask an admin to raise the cap in Settings.':
    {
      it:
        'Lo sconto di questa proposta, $1% ($2% in totale con lo sconto per volume del $3%), supera il tetto di sconto attuale della tua organizzazione, $4%: ' +
        'il tetto è stato abbassato dopo il salvataggio. Correggi lo sconto prima di approvarla (lo sconto commerciale può arrivare fino al $5%), ' +
        'oppure chiedi a un amministratore di alzare il tetto in Impostazioni.',
      huecosIt: PCT5,
    },
  'The discount on this proposal, $1% ($2% in total with the $3% volume discount), is over your organization’s current discount cap, $4%: the cap was lowered after it was saved. The volume discount ($5%) is already over the cap ($6%): leave the commercial discount at 0% or ask an admin to raise the cap in Settings.':
    {
      it:
        'Lo sconto di questa proposta, $1% ($2% in totale con lo sconto per volume del $3%), supera il tetto di sconto attuale della tua organizzazione, $4%: ' +
        'il tetto è stato abbassato dopo il salvataggio. Lo sconto per volume ($5%) supera già il tetto ($6%): lascia lo sconto commerciale allo 0% ' +
        'oppure chiedi a un amministratore di alzare il tetto in Impostazioni.',
      huecosIt: PCT6,
    },
  'The maximum discount your organization allows is $1%, and $2% was requested. The commercial discount can go up to $3%. Ask an admin to raise it in Settings if needed.':
    {
      it:
        'Lo sconto massimo che la tua organizzazione autorizza è il $1%, ed è stato richiesto il $2%. Lo sconto commerciale può arrivare fino al $3%. ' +
        'Se serve, chiedi a un amministratore di alzarlo in Impostazioni.',
      huecosIt: PCT3,
    },
  'The maximum discount your organization allows is $1%. This proposal already has a $2% volume discount, so a $3% commercial discount leaves $4% in total (discounts compound, they don’t add up). The commercial discount can go up to $5%. Ask an admin to raise it in Settings if needed.':
    {
      it:
        'Lo sconto massimo che la tua organizzazione autorizza è il $1%. Questa proposta ha già uno sconto per volume del $2%, quindi uno sconto commerciale del $3% ' +
        'lascia il $4% in totale (gli sconti si compongono, non si sommano). Lo sconto commerciale può arrivare fino al $5%. ' +
        'Se serve, chiedi a un amministratore di alzarlo in Impostazioni.',
      huecosIt: PCT5,
    },
  'The volume discount ($1%) is already over the cap ($2%): leave the commercial discount at 0% or ask an admin to raise the cap in Settings.':
    {
      it:
        'Lo sconto per volume ($1%) supera già il tetto ($2%): lascia lo sconto commerciale allo 0% ' +
        'oppure chiedi a un amministratore di alzare il tetto in Impostazioni.',
      huecosIt: PCT2,
    },
  'The negotiation with the agency $1 is not validated; validate it before creating the proposal': {
    it: 'La negoziazione con l’agenzia $1 non è convalidata; convalidala prima di creare la proposta',
  },
  'The negotiation with the agency $1 is not validated; the proposal can’t be approved': {
    it: 'La negoziazione con l’agenzia $1 non è convalidata; la proposta non si può approvare',
  },
  // El tope que envuelve va por `motivoEnItaliano`; si no se reconoce, el
  // mensaje entero cae al ingles (la regla de nunca a medias).
  'The bundle “$1” can’t be removed: without the bundle, the volume discount of the lines applies again. $2 Lower the commercial discount first, then remove the bundle again.':
    {
      it: 'Non si può rimuovere il pacchetto «$1»: senza il pacchetto torna ad applicarsi lo sconto per volume delle righe. $2 Abbassa prima lo sconto commerciale, poi rimuovi di nuovo il pacchetto.',
      huecosIt: { 2: (v) => motivoEnItaliano(v) ?? SIN_ITALIANO },
    },
}

for (const p of PATRONES_ERROR) {
  const t = PATRONES_IT[p.en]
  if (!t) continue
  p.it = t.it
  if (t.huecosIt) p.huecosIt = t.huecosIt
}

/** Las claves de `PATRONES_IT` que no casan con ningun patron (para la prueba). */
export function patronesItSinPatron(): string[] {
  const ens = new Set(PATRONES_ERROR.map((p) => p.en))
  return Object.keys(PATRONES_IT).filter((k) => !ens.has(k))
}

// Rearma un patron con los huecos del mensaje: `$n` (pasado por su funcion de
// `huecos`, si tiene) y `{n|uno|otros}`. No se usa `String.replace` con la
// cadena `en` como antes porque `$n` solo sabe copiar: ni traduce un hueco ni
// elige un plural.
function armar(p: PatronError, grupos: string[]): string {
  return armarCon(p.en, p.huecos, grupos)
}

function armarCon(
  plantilla: string,
  huecos: Record<number, (valor: string) => string> | undefined,
  grupos: string[],
): string {
  return plantilla
    .replace(/\{(\d)\|([^|}]*)\|([^}]*)\}/g, (_, n: string, uno: string, otros: string) =>
      grupos[Number(n) - 1] === '1' ? uno : otros,
    )
    .replace(/\$(\d)/g, (_, n: string) => {
      const v = grupos[Number(n) - 1] ?? ''
      const f = huecos?.[Number(n)]
      return f ? f(v) : v
    })
}

// El italiano de un motivo suelto, o `null` si no lo hay ENTERO.
function motivoEnItaliano(motivo: string): string | null {
  const exacto = CATALOGO_ERRORES_IT[motivo] ?? CATALOGO_LIB_IT[motivo]
  if (exacto !== undefined) return exacto
  for (const p of PATRONES_ERROR) {
    const m = p.re.exec(motivo)
    if (!m) continue
    // El primer patron que casa es el que manda, igual que en ingles: si no
    // tiene italiano, no se sigue buscando otro.
    if (p.it === undefined) return null
    const sinItaliano = Object.keys(p.huecos ?? {}).some((n) => !p.huecosIt?.[Number(n)])
    if (sinItaliano) return null
    // Un hueco italiano que no se pudo traducir deja su marca: entero al ingles.
    const armado = armarCon(p.it, p.huecosIt, m.slice(1))
    return armado.includes(SIN_ITALIANO) ? null : armado
  }
  return null
}

// El italiano de un mensaje entero, o `null` si alguna pieza no lo tiene.
function errorEnItaliano(mensaje: string): string | null {
  const exacto = CATALOGO_ERRORES_IT[mensaje] ?? CATALOGO_LIB_IT[mensaje]
  if (exacto !== undefined) return exacto
  const corte = mensaje.indexOf(': ')
  if (corte > 0 && CAMPO_EN[mensaje.slice(0, corte)] !== undefined) {
    const campo = CAMPO_IT[mensaje.slice(0, corte)]
    const motivo = motivoEnItaliano(mensaje.slice(corte + 2))
    return campo !== undefined && motivo !== null ? `${campo}: ${motivo}` : null
  }
  return motivoEnItaliano(mensaje)
}

// Una pieza suelta: el motivo, sin la etiqueta de campo delante.
function traducirMotivo(motivo: string): string {
  const exacto = CATALOGO_ERRORES[motivo] ?? CATALOGO_LIB[motivo]
  if (exacto !== undefined) return exacto
  for (const p of PATRONES_ERROR) {
    const m = p.re.exec(motivo)
    if (m) return armar(p, m.slice(1))
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
  if (idioma === 'it') {
    const italiano = errorEnItaliano(mensaje)
    if (italiano !== null) return italiano
    // Sin italiano completo, sigue abajo: el ingles.
  }

  const exacto = CATALOGO_ERRORES[mensaje] ?? CATALOGO_LIB[mensaje]
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

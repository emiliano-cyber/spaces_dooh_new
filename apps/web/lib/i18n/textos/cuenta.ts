// ============================================================================
//  lib/i18n/textos/cuenta.ts — LOS TEXTOS DEL AMBITO «cuenta».
// ----------------------------------------------------------------------------
//  Lote «administracion, cuenta y shell» de la version en ingles (2026-11-02).
//  Mismas reglas que los demas archivos de `textos/`: claves en espanol con el
//  prefijo `cuenta.`, espanol LITERAL (copiado del componente letra por letra),
//  `EN_CUENTA` como `Record` (una clave que falte no compila), ni dinero ni
//  moneda, frases con negritas ENTERAS y con huecos (`interpolarNodos`).
//
//  Cubre: los codigos de recuperacion, restablecer / elegir la contrasena
//  (`/recuperar/[token]`), la bienvenida y su cuestionario, el portal del
//  cliente (`/portal/[token]`) y la propuesta publica (`/p/[id]`). Lo que la
//  propuesta publica comparte con la ficha y el documento imprimible de
//  Propuestas (los renglones del desglose, los rotulos de la cabecera) usa las
//  claves `propuestas.*` que ya existen, para que el cliente lea lo mismo que
//  el vendedor.
//
//  ZONA SENSIBLE: recuperar la contrasena y los codigos de recuperacion. Aqui
//  solo hay TEXTO; la logica de esas pantallas no cambio. Los mensajes que
//  manda el servidor siguen por I18N-05 y los de la contrasena por
//  `password.*` (`motivoPassword`), como el login.
// ============================================================================

export const ES_CUENTA = {
  // ── ADR 0049 · los correos van en el idioma de los DOCUMENTOS de la instancia ──
  // (`lib/server/email.ts`, `htmlCorreoInvitacion`). Mismo texto que la
  // plantilla literal espanola (lo ata `correos-idioma.test.ts`).
  'cuenta.correo.invitacion.asunto': 'Te dieron acceso a Space OS · elige tu contraseña',
  'cuenta.correo.invitacion.titulo': 'Te dieron acceso a Space OS',
  'cuenta.correo.invitacion.cuerpo':
    'Hola {nombre}, se creó una cuenta para ti en Space OS. Haz clic en el botón para elegir tu contraseña. Este enlace vence en 72 horas y solo se puede usar una vez.',
  'cuenta.correo.invitacion.boton': 'Elegir mi contraseña',
  'cuenta.correo.invitacion.pie':
    'Si el enlace venció, pide a quien te dio de alta que te envíe otro. Si el botón no funciona, copia y pega este enlace:',
  // Cierre de idiomas (04/11): el de RESTABLECER la contrasena
  // (`/api/auth/forgot`, `htmlCorreoReset`). Igual: el espanol es la plantilla
  // literal, que sigue saliendo tal cual.
  'cuenta.correo.reset.asunto': 'Restablece tu contraseña · Space OS',
  'cuenta.correo.reset.titulo': 'Restablecer tu contraseña',
  'cuenta.correo.reset.cuerpo':
    'Hola {nombre}, recibimos una solicitud para restablecer la contraseña de tu cuenta en Space OS. Haz clic en el botón para elegir una nueva. Este enlace vence en 1 hora y solo se puede usar una vez.',
  'cuenta.correo.reset.boton': 'Restablecer contraseña',
  'cuenta.correo.reset.pie':
    'Si no solicitaste esto, puedes ignorar este correo; tu contraseña no cambiará. Si el botón no funciona, copia y pega este enlace:',
  // ── Comunes de este ambito ──
  'cuenta.comun.enlace-invalido': 'Enlace no válido',
  'cuenta.comun.ir-inicio': 'Ir al inicio',
  'cuenta.comun.nueva-contrasena': 'Nueva contraseña',
  'cuenta.comun.confirmar-contrasena': 'Confirmar contraseña',
  'cuenta.comun.no-coinciden': 'Las contraseñas no coinciden.',
  'cuenta.comun.guardar-contrasena': 'Guardar contraseña',
  'cuenta.comun.restablecer-contrasena': 'Restablecer contraseña',

  // ── Codigos de recuperacion (`/codigos-recuperacion`) ──
  'cuenta.codigos.titulo': 'Códigos de recuperación',
  'cuenta.codigos.titulo.guardar': 'Guarda tus códigos de recuperación',
  'cuenta.codigos.subtitulo': 'Tu forma de volver a entrar si algún día pierdes el acceso a tu cuenta.',
  'cuenta.codigos.ya-tienes':
    'Ya tienes tus códigos guardados. Si los perdiste, puedes generar otros: los anteriores dejarán de funcionar.',
  'cuenta.codigos.generar-nuevos': 'Generar códigos nuevos',
  'cuenta.codigos.volver': 'Volver',
  'cuenta.codigos.teclea': 'Teclea tu contraseña para confirmar. Los códigos que tengas guardados{dejaran} en cuanto se generen los nuevos.',
  'cuenta.codigos.teclea.dejaran': ' dejarán de funcionar',
  'cuenta.codigos.tu-contrasena': 'Tu contraseña',
  'cuenta.codigos.verificando': 'Verificando…',
  'cuenta.codigos.confirmar-generar': 'Confirmar y generar',
  'cuenta.codigos.google':
    'Entras con Google, así que {sin} con la que volver. Estos códigos son la única forma de entrar si algún día pierdes el acceso a esa cuenta.',
  'cuenta.codigos.google.sin': 'no tienes contraseña',
  'cuenta.codigos.una-vez': 'Cada uno sirve {vez}. Guárdalos donde no se pierdan.',
  'cuenta.codigos.una-vez.vez': 'una sola vez',
  'cuenta.codigos.generando': 'Generando…',
  'cuenta.codigos.mostrar': 'Mostrar mis códigos',
  'cuenta.codigos.aviso':
    '{una} Cópialos o imprímelos antes de continuar: en cuanto salgas de esta pantalla no vuelven a mostrarse.',
  'cuenta.codigos.aviso.una': 'Se muestran una sola vez.',
  'cuenta.codigos.tus.uno': 'Tus {n} códigos',
  'cuenta.codigos.tus.otros': 'Tus {n} códigos',
  'cuenta.codigos.copiar': 'Copiar',
  'cuenta.codigos.ya-guarde': 'Ya los guardé en un lugar seguro',
  'cuenta.codigos.guardando': 'Guardando…',
  'cuenta.codigos.continuar': 'Continuar',
  // Avisos emergentes (no se rinden: los fija `textos/cuenta.test.ts`).
  'cuenta.codigos.copiados': 'Copiados',
  'cuenta.codigos.no-copiados': 'No se pudieron copiar; cópialos a mano',
  'cuenta.codigos.error.generar': 'No se pudieron generar',
  'cuenta.codigos.error.verificar': 'No se pudo verificar la contraseña',
  'cuenta.codigos.error.confirmar': 'No se pudo confirmar',

  // ── Restablecer / elegir la contrasena (`/recuperar/[token]`) ──
  'cuenta.recuperar.bienvenida': 'Bienvenida',
  'cuenta.recuperar.verificando': 'Verificando el enlace…',
  'cuenta.recuperar.invalido': 'Enlace inválido o expirado',
  'cuenta.recuperar.invalido.bienvenida':
    'La invitación ya se usó o venció. Pide a quien te dio de alta que te envíe otra.',
  'cuenta.recuperar.invalido.restablecer': 'El enlace ya se usó o venció. Solicita uno nuevo desde el login.',
  'cuenta.recuperar.ir-login': 'Ir a iniciar sesión',
  'cuenta.recuperar.creada': 'Contraseña creada',
  'cuenta.recuperar.actualizada': 'Contraseña actualizada',
  'cuenta.recuperar.listo.bienvenida': 'Ya puedes iniciar sesión con tu contraseña.',
  'cuenta.recuperar.listo.restablecer': 'Ya puedes iniciar sesión con tu nueva contraseña.',
  'cuenta.recuperar.elige.bienvenida': 'Elige tu contraseña',
  'cuenta.recuperar.elige.restablecer': 'Elige una nueva contraseña',
  'cuenta.recuperar.regla': 'Mínimo 8 caracteres, con al menos una letra y un número.',
  'cuenta.recuperar.guardando': 'Guardando…',
  'cuenta.recuperar.error': 'No se pudo restablecer la contraseña',

  // ── Bienvenida (`/bienvenida`) y su cuestionario ──
  'cuenta.bienvenida.titulo': 'Antes de empezar',
  'cuenta.bienvenida.intro':
    'Tres preguntas sobre las razones sociales de tu empresa. Con ellas el sistema sabe a nombre de quién se paga una renta y quién emite un comprobante.',
  'cuenta.bienvenida.error.cargar': 'No se pudo cargar el cuestionario',
  'cuenta.bienvenida.ya.uno': 'Tu empresa ya tiene una razón social registrada, así que este cuestionario ya se contestó.',
  'cuenta.bienvenida.ya.otros':
    'Tu empresa ya tiene {n} razones sociales registradas, así que este cuestionario ya se contestó.',
  'cuenta.bienvenida.sin-roles': 'sin roles',
  'cuenta.bienvenida.de-baja': ' (dada de baja)',
  'cuenta.bienvenida.cambiar': 'Para cambiarlas, añadir otra o dar una de baja, ve a {enlace}.',
  'cuenta.bienvenida.ir-razones': 'Ir a Razones sociales',
  'cuenta.cuestionario.p1': '¿Tu empresa tiene varias razones sociales?',
  'cuenta.cuestionario.p1.ayuda':
    'Casi todas las empresas de medios reparten su operación entre varias. Si tienes una sola, con esto te ahorras el resto.',
  'cuenta.cuestionario.p2': '¿La operación está en la misma razón social que comercializa o factura las ventas?',
  'cuenta.cuestionario.p2.ayuda':
    'Suelen coincidir, y por eso se pregunta: si es tu caso, el paso siguiente te pide un dato menos.',
  'cuenta.cuestionario.p3.una': 'Indica tu razón social',
  'cuenta.cuestionario.p3.varias': 'Indica las razones sociales para cada rol dentro de tu empresa',
  'cuenta.cuestionario.p3.una.ayuda': 'Se le asignarán todos los roles. Después puedes separarlos en Razones sociales.',
  'cuenta.cuestionario.p3.varias.ayuda':
    'Una misma razón social puede llevar varios roles: escribe el mismo nombre y se agrupan en una sola. Lo que no sepas todavía, déjalo en blanco.',
  'cuenta.cuestionario.razon-social': 'Razón social',
  'cuenta.cuestionario.se-crearan.uno': 'Se crearán 1 razón social:',
  'cuenta.cuestionario.se-crearan.otros': 'Se crearán {n} razones sociales:',
  'cuenta.cuestionario.guardando': 'Guardando…',
  'cuenta.cuestionario.guardar': 'Guardar y continuar',
  'cuenta.cuestionario.mas-tarde': 'Lo hago más tarde',
  'cuenta.cuestionario.si': 'Sí',
  'cuenta.cuestionario.no': 'No',
  // Avisos emergentes (no se rinden).
  'cuenta.cuestionario.contesta': 'Contesta las preguntas antes de continuar.',
  'cuenta.cuestionario.error.guardar': 'No se pudo guardar el cuestionario',
  'cuenta.cuestionario.listo': 'Listo: {resumen}',

  // ── Portal del cliente (`/portal/[token]`) ──
  'cuenta.portal.no-corresponde': 'Este enlace de portal no corresponde a ninguna campaña activa.',
  'cuenta.portal.subtitulo': 'Portal del cliente',
  'cuenta.portal.seguimiento': 'Seguimiento de campaña',
  'cuenta.portal.avance': 'Avance de tu campaña',
  'cuenta.portal.ubicaciones': 'Ubicaciones',
  'cuenta.portal.evidencias': 'Evidencias de instalación',
  'cuenta.portal.pie': '{org} · portal de seguimiento',

  // ── Propuesta publica (`/p/[id]`) ──
  'cuenta.publica.no-corresponde': 'Esta liga no corresponde a ninguna propuesta.',
  'cuenta.publica.subtitulo': 'Propuesta comercial',
  'cuenta.publica.aceptada': 'Aceptada',
  'cuenta.publica.pendiente': 'Pendiente de tu aprobación',
  'cuenta.publica.vencida': 'Propuesta vencida',
  'cuenta.publica.solo-lectura': 'Solo lectura',
  'cuenta.publica.vencio-el': 'venció el {fecha}',
  'cuenta.publica.valida-hasta': 'válida hasta el {fecha}',
  'cuenta.publica.kpi.sitios': 'Sitios',
  'cuenta.publica.sitios': 'Sitios de la propuesta',
  'cuenta.publica.sin-ubicacion': 'Ubicación no capturada',
  'cuenta.publica.mapa.parcial.uno':
    '{faltan} de {n} pantalla no tienen coordenadas registradas; su dirección está en la lista de sitios.',
  'cuenta.publica.mapa.parcial.otros':
    '{faltan} de {n} pantallas no tienen coordenadas registradas; su dirección está en la lista de sitios.',
  'cuenta.publica.mapa.ninguna':
    'Las pantallas de esta propuesta aún no tienen coordenadas registradas. Consulta la dirección de cada una en la lista de sitios.',
  'cuenta.publica.aceptada.titulo': 'Propuesta aceptada',
  'cuenta.publica.aceptada.detalle': 'Aceptada el {fecha}. El equipo comercial fue notificado.',
  'cuenta.publica.aceptada.detalle-por': 'Aceptada por {quien} el {fecha}. El equipo comercial fue notificado.',
  'cuenta.publica.aceptas': '¿Aceptas esta propuesta?',
  'cuenta.publica.al-aceptar.uno':
    'Al aceptar confirmas las {n} pantalla y el total de {total}. Queda registrada tu aceptación con fecha y hora.',
  'cuenta.publica.al-aceptar.otros':
    'Al aceptar confirmas las {n} pantallas y el total de {total}. Queda registrada tu aceptación con fecha y hora.',
  'cuenta.publica.tu-nombre': 'Tu nombre y cargo',
  'cuenta.publica.aceptando': 'Aceptando…',
  'cuenta.publica.aceptar': 'Aceptar propuesta',
  'cuenta.publica.vencida.detalle':
    'Esta propuesta venció el {fecha} y ya no se puede aceptar desde aquí. Pide una actualizada a quien te la envió.',
  'cuenta.publica.pie': 'Spaces · propuesta comercial',
  'cuenta.publica.pie.solo-lectura': ' · este enlace es de solo lectura',
  // Avisos que no se rinden en los estados de la prueba.
  'cuenta.publica.error.nombre': 'Escribe tu nombre para aceptar',
  'cuenta.publica.error.aceptar': 'No se pudo aceptar. Reintenta.',
} as const

export type ClaveCuenta = keyof typeof ES_CUENTA

export const EN_CUENTA: Record<ClaveCuenta, string> = {
  // ── ADR 0049 · los correos van en el idioma de los DOCUMENTOS de la instancia ──
  'cuenta.correo.invitacion.asunto': 'You’ve been given access to Space OS · choose your password',
  'cuenta.correo.invitacion.titulo': 'You’ve been given access to Space OS',
  'cuenta.correo.invitacion.cuerpo':
    'Hi {nombre}, an account was created for you in Space OS. Click the button to choose your password. This link expires in 72 hours and can only be used once.',
  'cuenta.correo.invitacion.boton': 'Choose my password',
  'cuenta.correo.invitacion.pie':
    'If the link expired, ask whoever added you to send you another one. If the button doesn’t work, copy and paste this link:',
  'cuenta.correo.reset.asunto': 'Reset your password · Space OS',
  'cuenta.correo.reset.titulo': 'Reset your password',
  'cuenta.correo.reset.cuerpo':
    'Hi {nombre}, we received a request to reset the password for your Space OS account. Click the button to choose a new one. This link expires in 1 hour and can only be used once.',
  'cuenta.correo.reset.boton': 'Reset password',
  'cuenta.correo.reset.pie':
    'If you didn’t request this, you can ignore this email; your password won’t change. If the button doesn’t work, copy and paste this link:',
  'cuenta.comun.enlace-invalido': 'Invalid link',
  'cuenta.comun.ir-inicio': 'Go to the home page',
  'cuenta.comun.nueva-contrasena': 'New password',
  'cuenta.comun.confirmar-contrasena': 'Confirm password',
  'cuenta.comun.no-coinciden': 'The passwords don’t match.',
  'cuenta.comun.guardar-contrasena': 'Save password',
  'cuenta.comun.restablecer-contrasena': 'Reset password',

  'cuenta.codigos.titulo': 'Recovery codes',
  'cuenta.codigos.titulo.guardar': 'Save your recovery codes',
  'cuenta.codigos.subtitulo': 'Your way back in if you ever lose access to your account.',
  'cuenta.codigos.ya-tienes':
    'You already have your codes saved. If you lost them, you can generate new ones: the old ones will stop working.',
  'cuenta.codigos.generar-nuevos': 'Generate new codes',
  'cuenta.codigos.volver': 'Back',
  'cuenta.codigos.teclea': 'Enter your password to confirm. Any codes you have saved{dejaran} as soon as the new ones are generated.',
  'cuenta.codigos.teclea.dejaran': ' will stop working',
  'cuenta.codigos.tu-contrasena': 'Your password',
  'cuenta.codigos.verificando': 'Verifying…',
  'cuenta.codigos.confirmar-generar': 'Confirm and generate',
  'cuenta.codigos.google':
    'You sign in with Google, so {sin} to fall back on. These codes are the only way in if you ever lose access to that account.',
  'cuenta.codigos.google.sin': 'you have no password',
  'cuenta.codigos.una-vez': 'Each one works {vez}. Keep them somewhere they won’t get lost.',
  'cuenta.codigos.una-vez.vez': 'only once',
  'cuenta.codigos.generando': 'Generating…',
  'cuenta.codigos.mostrar': 'Show my codes',
  'cuenta.codigos.aviso':
    '{una} Copy or print them before you continue: once you leave this screen they won’t be shown again.',
  'cuenta.codigos.aviso.una': 'They are shown only once.',
  'cuenta.codigos.tus.uno': 'Your {n} code',
  'cuenta.codigos.tus.otros': 'Your {n} codes',
  'cuenta.codigos.copiar': 'Copy',
  'cuenta.codigos.ya-guarde': 'I’ve saved them somewhere safe',
  'cuenta.codigos.guardando': 'Saving…',
  'cuenta.codigos.continuar': 'Continue',
  'cuenta.codigos.copiados': 'Copied',
  'cuenta.codigos.no-copiados': 'They couldn’t be copied; copy them by hand',
  'cuenta.codigos.error.generar': 'The codes could not be generated',
  'cuenta.codigos.error.verificar': 'The password could not be verified',
  'cuenta.codigos.error.confirmar': 'Could not confirm',

  'cuenta.recuperar.bienvenida': 'Welcome',
  'cuenta.recuperar.verificando': 'Checking the link…',
  'cuenta.recuperar.invalido': 'Invalid or expired link',
  'cuenta.recuperar.invalido.bienvenida':
    'The invitation was already used or has expired. Ask whoever added you to send you another one.',
  'cuenta.recuperar.invalido.restablecer':
    'The link was already used or has expired. Request a new one from the sign-in page.',
  'cuenta.recuperar.ir-login': 'Go to sign in',
  'cuenta.recuperar.creada': 'Password created',
  'cuenta.recuperar.actualizada': 'Password updated',
  'cuenta.recuperar.listo.bienvenida': 'You can now sign in with your password.',
  'cuenta.recuperar.listo.restablecer': 'You can now sign in with your new password.',
  'cuenta.recuperar.elige.bienvenida': 'Choose your password',
  'cuenta.recuperar.elige.restablecer': 'Choose a new password',
  'cuenta.recuperar.regla': 'At least 8 characters, with at least one letter and one number.',
  'cuenta.recuperar.guardando': 'Saving…',
  'cuenta.recuperar.error': 'The password could not be reset',

  'cuenta.bienvenida.titulo': 'Before you start',
  'cuenta.bienvenida.intro': 'Three questions about your company’s legal entities. With them the system knows who pays each rent and who issues invoices.',
  'cuenta.bienvenida.error.cargar': 'The questionnaire could not be loaded',
  'cuenta.bienvenida.ya.uno':
    'Your company already has one legal entity registered, so this questionnaire has already been answered.',
  'cuenta.bienvenida.ya.otros':
    'Your company already has {n} legal entities registered, so this questionnaire has already been answered.',
  'cuenta.bienvenida.sin-roles': 'no roles',
  'cuenta.bienvenida.de-baja': ' (deactivated)',
  'cuenta.bienvenida.cambiar': 'To change them, add another one or deactivate one, go to {enlace}.',
  'cuenta.bienvenida.ir-razones': 'Go to Legal entities',
  'cuenta.cuestionario.p1': 'Does your company have several legal entities?',
  'cuenta.cuestionario.p1.ayuda':
    'Most media companies split their operations across several. If you have only one, this saves you the rest.',
  'cuenta.cuestionario.p2': 'Do operations run under the same legal entity that sells or invoices?',
  'cuenta.cuestionario.p2.ayuda':
    'They usually match, which is why we ask: if that’s your case, the next step asks you for one thing less.',
  'cuenta.cuestionario.p3.una': 'Enter your legal entity',
  'cuenta.cuestionario.p3.varias': 'Enter the legal entity for each role within your company',
  'cuenta.cuestionario.p3.una.ayuda': 'It will be given every role. You can split them later in Legal entities.',
  'cuenta.cuestionario.p3.varias.ayuda':
    'One legal entity can hold several roles: type the same name and they are grouped into one. Leave blank whatever you don’t know yet.',
  'cuenta.cuestionario.razon-social': 'Legal name',
  'cuenta.cuestionario.se-crearan.uno': '1 legal entity will be created:',
  'cuenta.cuestionario.se-crearan.otros': '{n} legal entities will be created:',
  'cuenta.cuestionario.guardando': 'Saving…',
  'cuenta.cuestionario.guardar': 'Save and continue',
  'cuenta.cuestionario.mas-tarde': 'I’ll do it later',
  'cuenta.cuestionario.si': 'Yes',
  'cuenta.cuestionario.no': 'No',
  'cuenta.cuestionario.contesta': 'Answer the questions before you continue.',
  'cuenta.cuestionario.error.guardar': 'The questionnaire could not be saved',
  'cuenta.cuestionario.listo': 'Done: {resumen}',

  'cuenta.portal.no-corresponde': 'This portal link doesn’t match any active campaign.',
  'cuenta.portal.subtitulo': 'Client portal',
  'cuenta.portal.seguimiento': 'Campaign tracking',
  'cuenta.portal.avance': 'Your campaign’s progress',
  'cuenta.portal.ubicaciones': 'Locations',
  'cuenta.portal.evidencias': 'Installation evidence',
  'cuenta.portal.pie': '{org} · tracking portal',

  'cuenta.publica.no-corresponde': 'This link doesn’t match any proposal.',
  'cuenta.publica.subtitulo': 'Sales proposal',
  'cuenta.publica.aceptada': 'Accepted',
  'cuenta.publica.pendiente': 'Awaiting your approval',
  'cuenta.publica.vencida': 'Proposal expired',
  'cuenta.publica.solo-lectura': 'Read only',
  'cuenta.publica.vencio-el': 'expired on {fecha}',
  'cuenta.publica.valida-hasta': 'valid until {fecha}',
  'cuenta.publica.kpi.sitios': 'Sites',
  'cuenta.publica.sitios': 'Sites in the proposal',
  'cuenta.publica.sin-ubicacion': 'Location not entered',
  'cuenta.publica.mapa.parcial.uno': 'Screens without coordinates: {faltan} of {n}. Their addresses are in the list of sites.',
  'cuenta.publica.mapa.parcial.otros': 'Screens without coordinates: {faltan} of {n}. Their addresses are in the list of sites.',
  'cuenta.publica.mapa.ninguna':
    'The screens in this proposal don’t have coordinates entered yet. Check the address of each one in the list of sites.',
  'cuenta.publica.aceptada.titulo': 'Proposal accepted',
  'cuenta.publica.aceptada.detalle': 'Accepted on {fecha}. The sales team was notified.',
  'cuenta.publica.aceptada.detalle-por': 'Accepted by {quien} on {fecha}. The sales team was notified.',
  'cuenta.publica.aceptas': 'Do you accept this proposal?',
  'cuenta.publica.al-aceptar.uno':
    'By accepting you confirm the {n} screen and the total of {total}. Your acceptance is recorded with the date and time.',
  'cuenta.publica.al-aceptar.otros':
    'By accepting you confirm the {n} screens and the total of {total}. Your acceptance is recorded with the date and time.',
  'cuenta.publica.tu-nombre': 'Your name and title',
  'cuenta.publica.aceptando': 'Accepting…',
  'cuenta.publica.aceptar': 'Accept proposal',
  'cuenta.publica.vencida.detalle':
    'This proposal expired on {fecha} and can no longer be accepted here. Ask whoever sent it to you for an updated one.',
  'cuenta.publica.pie': 'Spaces · sales proposal',
  'cuenta.publica.pie.solo-lectura': ' · this link is read-only',
  'cuenta.publica.error.nombre': 'Enter your name to accept',
  'cuenta.publica.error.aceptar': 'Could not accept. Please try again.',
}

// ─── ITALIANO · lote L5 (2026-11-03) ────────────────────────────────────────
// COMPLETO: `Record`, asi que una clave nueva sin italiano no compila, como
// en el ingles. Traducido desde el ESPANOL (el ingles, solo de apoyo), con
// el glosario de `vault/03-Frontend/italiano-olas.md`.
export const IT_CUENTA: Record<ClaveCuenta, string> = {
  // ── ADR 0049 · el correo de invitacion, en el idioma de los DOCUMENTOS de la
  // instancia (`lib/server/email.ts`). B67, al integrar con el italiano
  // (2026-11-04): sin estas claves una instancia `it` lo mandaba en ingles.
  'cuenta.correo.invitacion.asunto': 'Ti è stato dato accesso a Space OS · scegli la tua password',
  'cuenta.correo.invitacion.titulo': 'Ti è stato dato accesso a Space OS',
  'cuenta.correo.invitacion.cuerpo':
    'Ciao {nombre}, è stato creato un account per te su Space OS. Fai clic sul pulsante per scegliere la tua password. Questo link scade tra 72 ore e si può usare una sola volta.',
  'cuenta.correo.invitacion.boton': 'Scegli la mia password',
  'cuenta.correo.invitacion.pie':
    'Se il link è scaduto, chiedi a chi ti ha registrato di inviartene un altro. Se il pulsante non funziona, copia e incolla questo link:',
  // Cierre de idiomas (04/11): el de restablecer la contrasena. «Reimposta la
  // password», como el boton de `/recuperar` (`cuenta.comun.restablecer-contrasena`).
  'cuenta.correo.reset.asunto': 'Reimposta la tua password · Space OS',
  'cuenta.correo.reset.titulo': 'Reimposta la tua password',
  'cuenta.correo.reset.cuerpo':
    'Ciao {nombre}, abbiamo ricevuto una richiesta di reimpostare la password del tuo account su Space OS. Fai clic sul pulsante per sceglierne una nuova. Questo link scade tra 1 ora e si può usare una sola volta.',
  'cuenta.correo.reset.boton': 'Reimposta la password',
  'cuenta.correo.reset.pie':
    'Se non hai fatto tu questa richiesta, puoi ignorare questa email; la tua password non cambierà. Se il pulsante non funziona, copia e incolla questo link:',

  'cuenta.comun.enlace-invalido': 'Link non valido',
  'cuenta.comun.ir-inicio': 'Vai alla home',
  'cuenta.comun.nueva-contrasena': 'Nuova password',
  'cuenta.comun.confirmar-contrasena': 'Conferma la password',
  'cuenta.comun.no-coinciden': 'Le password non coincidono.',
  'cuenta.comun.guardar-contrasena': 'Salva la password',
  'cuenta.comun.restablecer-contrasena': 'Reimposta la password',

  'cuenta.codigos.titulo': 'Codici di recupero',
  'cuenta.codigos.titulo.guardar': 'Salva i tuoi codici di recupero',
  'cuenta.codigos.subtitulo': 'Il modo per rientrare se un giorno perdi l’accesso al tuo account.',
  'cuenta.codigos.ya-tienes':
    'Hai già salvato i tuoi codici. Se li hai persi, puoi generarne altri: i precedenti smetteranno di funzionare.',
  'cuenta.codigos.generar-nuevos': 'Genera nuovi codici',
  'cuenta.codigos.volver': 'Indietro',
  'cuenta.codigos.teclea':
    'Inserisci la tua password per confermare. I codici che hai salvato{dejaran} appena verranno generati quelli nuovi.',
  'cuenta.codigos.teclea.dejaran': ' smetteranno di funzionare',
  'cuenta.codigos.tu-contrasena': 'La tua password',
  'cuenta.codigos.verificando': 'Verifica…',
  'cuenta.codigos.confirmar-generar': 'Conferma e genera',
  'cuenta.codigos.google':
    'Accedi con Google, quindi {sin} per rientrare. Questi codici sono l’unico modo per accedere se un giorno perdi l’accesso a quell’account.',
  'cuenta.codigos.google.sin': 'non hai una password',
  'cuenta.codigos.una-vez': 'Ognuno vale {vez}. Conservali dove non si perdano.',
  'cuenta.codigos.una-vez.vez': 'una sola volta',
  'cuenta.codigos.generando': 'Generazione…',
  'cuenta.codigos.mostrar': 'Mostra i miei codici',
  'cuenta.codigos.aviso':
    '{una} Copiali o stampali prima di continuare: appena esci da questa schermata non verranno più mostrati.',
  'cuenta.codigos.aviso.una': 'Vengono mostrati una sola volta.',
  'cuenta.codigos.tus.uno': 'I tuoi codici ({n})',
  'cuenta.codigos.tus.otros': 'I tuoi codici ({n})',
  'cuenta.codigos.copiar': 'Copia',
  'cuenta.codigos.ya-guarde': 'Li ho salvati in un posto sicuro',
  'cuenta.codigos.guardando': 'Salvataggio…',
  'cuenta.codigos.continuar': 'Continua',
  'cuenta.codigos.copiados': 'Copiati',
  'cuenta.codigos.no-copiados': 'Non è stato possibile copiarli; copiali a mano',
  'cuenta.codigos.error.generar': 'Non è stato possibile generarli',
  'cuenta.codigos.error.verificar': 'Non è stato possibile verificare la password',
  'cuenta.codigos.error.confirmar': 'Non è stato possibile confermare',

  'cuenta.recuperar.bienvenida': 'Ti diamo il benvenuto',
  'cuenta.recuperar.verificando': 'Verifica del link…',
  'cuenta.recuperar.invalido': 'Link non valido o scaduto',
  'cuenta.recuperar.invalido.bienvenida':
    'L’invito è già stato usato o è scaduto. Chiedi a chi ti ha registrato di inviartene un altro.',
  'cuenta.recuperar.invalido.restablecer':
    'Il link è già stato usato o è scaduto. Richiedine uno nuovo dalla pagina di accesso.',
  'cuenta.recuperar.ir-login': 'Vai all’accesso',
  'cuenta.recuperar.creada': 'Password creata',
  'cuenta.recuperar.actualizada': 'Password aggiornata',
  'cuenta.recuperar.listo.bienvenida': 'Ora puoi accedere con la tua password.',
  'cuenta.recuperar.listo.restablecer': 'Ora puoi accedere con la tua nuova password.',
  'cuenta.recuperar.elige.bienvenida': 'Scegli la tua password',
  'cuenta.recuperar.elige.restablecer': 'Scegli una nuova password',
  'cuenta.recuperar.regla': 'Almeno 8 caratteri, con almeno una lettera e un numero.',
  'cuenta.recuperar.guardando': 'Salvataggio…',
  'cuenta.recuperar.error': 'Non è stato possibile reimpostare la password',

  'cuenta.bienvenida.titulo': 'Prima di iniziare',
  'cuenta.bienvenida.intro':
    'Tre domande sulle ragioni sociali della tua azienda. Con queste il sistema sa a nome di chi si paga un affitto e chi emette una fattura.',
  'cuenta.bienvenida.error.cargar': 'Non è stato possibile caricare il questionario',
  'cuenta.bienvenida.ya.uno':
    'La tua azienda ha già una ragione sociale registrata, quindi questo questionario ha già una risposta.',
  'cuenta.bienvenida.ya.otros':
    'La tua azienda ha già {n} ragioni sociali registrate, quindi questo questionario ha già una risposta.',
  'cuenta.bienvenida.sin-roles': 'senza ruoli',
  'cuenta.bienvenida.de-baja': ' (disattivata)',
  'cuenta.bienvenida.cambiar': 'Per modificarle, aggiungerne un’altra o disattivarne una, vai a {enlace}.',
  'cuenta.bienvenida.ir-razones': 'Vai a Ragioni sociali',
  'cuenta.cuestionario.p1': 'La tua azienda ha più ragioni sociali?',
  'cuenta.cuestionario.p1.ayuda':
    'Quasi tutte le aziende del settore media distribuiscono la loro attività tra più ragioni sociali. Se ne hai una sola, così ti risparmi il resto.',
  'cuenta.cuestionario.p2': 'L’operatività è nella stessa ragione sociale che vende o fattura?',
  'cuenta.cuestionario.p2.ayuda':
    'Di solito coincidono, ed è per questo che lo chiediamo: se è il tuo caso, il passo successivo ti chiede un dato in meno.',
  'cuenta.cuestionario.p3.una': 'Indica la tua ragione sociale',
  'cuenta.cuestionario.p3.varias': 'Indica le ragioni sociali per ogni ruolo all’interno della tua azienda',
  'cuenta.cuestionario.p3.una.ayuda': 'Le verranno assegnati tutti i ruoli. Potrai separarli in seguito in Ragioni sociali.',
  'cuenta.cuestionario.p3.varias.ayuda':
    'Una stessa ragione sociale può avere più ruoli: scrivi lo stesso nome e verranno raggruppati in una sola. Quello che ancora non sai, lascialo vuoto.',
  'cuenta.cuestionario.razon-social': 'Ragione sociale',
  'cuenta.cuestionario.se-crearan.uno': 'Verrà creata 1 ragione sociale:',
  'cuenta.cuestionario.se-crearan.otros': 'Verranno create {n} ragioni sociali:',
  'cuenta.cuestionario.guardando': 'Salvataggio…',
  'cuenta.cuestionario.guardar': 'Salva e continua',
  'cuenta.cuestionario.mas-tarde': 'Lo faccio più tardi',
  'cuenta.cuestionario.si': 'Sì',
  'cuenta.cuestionario.no': 'No',
  'cuenta.cuestionario.contesta': 'Rispondi alle domande prima di continuare.',
  'cuenta.cuestionario.error.guardar': 'Non è stato possibile salvare il questionario',
  'cuenta.cuestionario.listo': 'Fatto: {resumen}',

  'cuenta.portal.no-corresponde': 'Questo link del portale non corrisponde a nessuna campagna attiva.',
  'cuenta.portal.subtitulo': 'Portale del cliente',
  'cuenta.portal.seguimiento': 'Monitoraggio della campagna',
  'cuenta.portal.avance': 'Avanzamento della tua campagna',
  'cuenta.portal.ubicaciones': 'Posizioni',
  'cuenta.portal.evidencias': 'Prove di installazione',
  'cuenta.portal.pie': '{org} · portale di monitoraggio',

  // La propuesta publica lleva cualquier medio: «impianti», no solo schermi.
  'cuenta.publica.no-corresponde': 'Questo link non corrisponde a nessuna proposta.',
  'cuenta.publica.subtitulo': 'Proposta commerciale',
  'cuenta.publica.aceptada': 'Accettata',
  'cuenta.publica.pendiente': 'In attesa della tua approvazione',
  'cuenta.publica.vencida': 'Proposta scaduta',
  'cuenta.publica.solo-lectura': 'Sola lettura',
  'cuenta.publica.vencio-el': 'scaduta in data {fecha}',
  'cuenta.publica.valida-hasta': 'valida fino al giorno {fecha}',
  'cuenta.publica.kpi.sitios': 'Siti',
  'cuenta.publica.sitios': 'Siti della proposta',
  'cuenta.publica.sin-ubicacion': 'Posizione non inserita',
  'cuenta.publica.mapa.parcial.uno':
    'Impianti senza coordinate: {faltan} su {n}. Il loro indirizzo è nell’elenco dei siti.',
  'cuenta.publica.mapa.parcial.otros':
    'Impianti senza coordinate: {faltan} su {n}. Il loro indirizzo è nell’elenco dei siti.',
  'cuenta.publica.mapa.ninguna':
    'Gli impianti di questa proposta non hanno ancora coordinate registrate. Controlla l’indirizzo di ognuno nell’elenco dei siti.',
  'cuenta.publica.aceptada.titulo': 'Proposta accettata',
  'cuenta.publica.aceptada.detalle': 'Accettata in data {fecha}. Il team commerciale è stato avvisato.',
  'cuenta.publica.aceptada.detalle-por': 'Accettata da {quien} in data {fecha}. Il team commerciale è stato avvisato.',
  'cuenta.publica.aceptas': 'Accetti questa proposta?',
  'cuenta.publica.al-aceptar.uno':
    'Accettando confermi {n} impianto e il totale di {total}. La tua accettazione viene registrata con data e ora.',
  'cuenta.publica.al-aceptar.otros':
    'Accettando confermi i {n} impianti e il totale di {total}. La tua accettazione viene registrata con data e ora.',
  'cuenta.publica.tu-nombre': 'Il tuo nome e ruolo',
  'cuenta.publica.aceptando': 'Accettazione…',
  'cuenta.publica.aceptar': 'Accetta la proposta',
  'cuenta.publica.vencida.detalle':
    'Questa proposta è scaduta in data {fecha} e non può più essere accettata da qui. Chiedine una aggiornata a chi te l’ha inviata.',
  'cuenta.publica.pie': 'Spaces · proposta commerciale',
  'cuenta.publica.pie.solo-lectura': ' · questo link è in sola lettura',
  'cuenta.publica.error.nombre': 'Scrivi il tuo nome per accettare',
  'cuenta.publica.error.aceptar': 'Non è stato possibile accettare. Riprova.',
}

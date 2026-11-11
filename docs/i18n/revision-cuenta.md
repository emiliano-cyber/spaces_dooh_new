# Tabla de revisión · lote de inglés «cuenta (ámbito `cuenta`)»

Generada el 2026-11-02 a partir de `apps/web/lib/i18n/textos/cuenta.ts` y de los usos en el código
(búsqueda literal de la clave). **115 claves.** Rama `feat/ingles-administracion`.

**Pantallas:** Códigos de recuperación, restablecer / elegir la contraseña (`/recuperar/[token]`), la bienvenida y su cuestionario, el portal del cliente (`/portal/[token]`) y la propuesta pública (`/p/[id]`).

- **español** es la copia literal de lo que decía el componente antes del lote,
  comprobado comparando el HTML rendido de **60 estados de pantalla** (28 de
  `lib/i18n/pantallas-admin.test.ts` y 32 de `lib/i18n/pantallas-cuenta-shell.test.ts`)
  con las fuentes de `integra/ingles` (`ec427a66`) y con las del lote:
  idénticos byte a byte (`diff -rq`; las dos pruebas vuelcan el HTML español con
  `I18N_VOLCAR=<carpeta>`).
- `␣` marca un espacio al principio o al final: es intencional, el texto va
  pegado a otro nodo.
- Los huecos `{nombre}` se rellenan en tiempo de ejecución con datos, cifras ya
  formateadas o elementos (`interpolarNodos`). Ninguna cifra con miles ni
  símbolo de moneda vive en el diccionario (el «12,345» del ejemplo de la
  escritura entra por hueco).
- «clave armada en el código» = la clave se compone con un prefijo y un valor
  (`admin.rol.<rol>`, `admin.tipo-ot.<tipo>`, `admin.modulo.<módulo>`, los
  plurales `.uno`/`.otros`): por eso la búsqueda literal no la encuentra.
- Las claves que el lote REUTILIZA de otros archivos (`comun.*`,
  `password.regla`, `validacion.email`, `nav.*`, `login.titulo.login`,
  `sidebar.logo-alt`, las `propuestas.*` de la liga pública, `campanas.etapa.*`
  en `PipelineView`, `comercial.sitio-estatus.*` y `comercial.tipo-medio.*`)
  ya estaban traducidas y no salen en esta tabla.

| clave | archivo:línea donde se usa | español | inglés |
|---|---|---|---|
| `cuenta.comun.enlace-invalido` | `app/(app)/p/[id]/page.tsx:155`<br>`app/(app)/portal/[token]/page.tsx:58` | Enlace no válido | Invalid link |
| `cuenta.comun.ir-inicio` | `app/(app)/bienvenida/page.tsx:94`<br>`app/(app)/bienvenida/page.tsx:142` | Ir al inicio | Go to the home page |
| `cuenta.comun.nueva-contrasena` | `app/(app)/recuperar/[token]/page.tsx:124` | Nueva contraseña | New password |
| `cuenta.comun.confirmar-contrasena` | `app/(app)/recuperar/[token]/page.tsx:128` | Confirmar contraseña | Confirm password |
| `cuenta.comun.no-coinciden` | `app/(app)/recuperar/[token]/page.tsx:55` | Las contraseñas no coinciden. | The passwords don’t match. |
| `cuenta.comun.guardar-contrasena` | `app/(app)/recuperar/[token]/page.tsx:134` | Guardar contraseña | Save password |
| `cuenta.comun.restablecer-contrasena` | `app/(app)/recuperar/[token]/page.tsx:79`<br>`app/(app)/recuperar/[token]/page.tsx:134` | Restablecer contraseña | Reset password |
| `cuenta.codigos.titulo` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:152` | Códigos de recuperación | Recovery codes |
| `cuenta.codigos.titulo.guardar` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:218` | Guarda tus códigos de recuperación | Save your recovery codes |
| `cuenta.codigos.subtitulo` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:153`<br>`app/(app)/(shell)/codigos-recuperacion/page.tsx:219` | Tu forma de volver a entrar si algún día pierdes el acceso a tu cuenta. | Your way back in if you ever lose access to your account. |
| `cuenta.codigos.ya-tienes` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:158` | Ya tienes tus códigos guardados. Si los perdiste, puedes generar otros: los anteriores dejarán de funcionar. | You already have your codes saved. If you lost them, you can generate new ones: the old ones will stop working. |
| `cuenta.codigos.generar-nuevos` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:163` | Generar códigos nuevos | Generate new codes |
| `cuenta.codigos.volver` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:166` | Volver | Back |
| `cuenta.codigos.teclea` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:176` | Teclea tu contraseña para confirmar. Los códigos que tengas guardados{dejaran} en cuanto se generen los nuevos. | Enter your password to confirm. Any codes you have saved{dejaran} as soon as the new ones are generated. |
| `cuenta.codigos.teclea.dejaran` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:176` | ␣dejarán de funcionar | ␣will stop working |
| `cuenta.codigos.tu-contrasena` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:179`<br>`app/(app)/(shell)/codigos-recuperacion/page.tsx:187` | Tu contraseña | Your password |
| `cuenta.codigos.verificando` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:192` | Verificando… | Verifying… |
| `cuenta.codigos.confirmar-generar` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:192` | Confirmar y generar | Confirm and generate |
| `cuenta.codigos.google` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:227` | Entras con Google, así que {sin} con la que volver. Estos códigos son la única forma de entrar si algún día pierdes el acceso a esa cuenta. | You sign in with Google, so {sin} to fall back on. These codes are the only way in if you ever lose access to that account. |
| `cuenta.codigos.google.sin` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:227` | no tienes contraseña | you have no password |
| `cuenta.codigos.una-vez` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:229` | Cada uno sirve {vez}. Guárdalos donde no se pierdan. | Each one works {vez}. Keep them somewhere they won’t get lost. |
| `cuenta.codigos.una-vez.vez` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:229` | una sola vez | only once |
| `cuenta.codigos.generando` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:231` | Generando… | Generating… |
| `cuenta.codigos.mostrar` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:231` | Mostrar mis códigos | Show my codes |
| `cuenta.codigos.aviso` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:241` | {una} Cópialos o imprímelos antes de continuar: en cuanto salgas de esta pantalla no vuelven a mostrarse. | {una} Copy or print them before you continue: once you leave this screen they won’t be shown again. |
| `cuenta.codigos.aviso.una` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:241` | Se muestran una sola vez. | They are shown only once. |
| `cuenta.codigos.tus.uno` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:247` | Tus {n} códigos | Your {n} code |
| `cuenta.codigos.tus.otros` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:247` | Tus {n} códigos | Your {n} codes |
| `cuenta.codigos.copiar` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:259` | Copiar | Copy |
| `cuenta.codigos.ya-guarde` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:285` | Ya los guardé en un lugar seguro | I’ve saved them somewhere safe |
| `cuenta.codigos.guardando` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:289` | Guardando… | Saving… |
| `cuenta.codigos.continuar` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:289` | Continuar | Continue |
| `cuenta.codigos.copiados` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:253` | Copiados | Copied |
| `cuenta.codigos.no-copiados` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:254` | No se pudieron copiar; cópialos a mano | They couldn’t be copied; copy them by hand |
| `cuenta.codigos.error.generar` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:86` | No se pudieron generar | The codes could not be generated |
| `cuenta.codigos.error.verificar` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:108` | No se pudo verificar la contraseña | The password could not be verified |
| `cuenta.codigos.error.confirmar` | `app/(app)/(shell)/codigos-recuperacion/page.tsx:126` | No se pudo confirmar | Could not confirm |
| `cuenta.recuperar.bienvenida` | `app/(app)/recuperar/[token]/page.tsx:79` | Bienvenida | Welcome |
| `cuenta.recuperar.verificando` | `app/(app)/recuperar/[token]/page.tsx:86` | Verificando el enlace… | Checking the link… |
| `cuenta.recuperar.invalido` | `app/(app)/recuperar/[token]/page.tsx:93` | Enlace inválido o expirado | Invalid or expired link |
| `cuenta.recuperar.invalido.bienvenida` | `app/(app)/recuperar/[token]/page.tsx:96` | La invitación ya se usó o venció. Pide a quien te dio de alta que te envíe otra. | The invitation was already used or has expired. Ask whoever added you to send you another one. |
| `cuenta.recuperar.invalido.restablecer` | `app/(app)/recuperar/[token]/page.tsx:97` | El enlace ya se usó o venció. Solicita uno nuevo desde el login. | The link was already used or has expired. Request a new one from the sign-in page. |
| `cuenta.recuperar.ir-login` | `app/(app)/recuperar/[token]/page.tsx:102` | Ir a iniciar sesión | Go to sign in |
| `cuenta.recuperar.creada` | `app/(app)/recuperar/[token]/page.tsx:110` | Contraseña creada | Password created |
| `cuenta.recuperar.actualizada` | `app/(app)/recuperar/[token]/page.tsx:110` | Contraseña actualizada | Password updated |
| `cuenta.recuperar.listo.bienvenida` | `app/(app)/recuperar/[token]/page.tsx:111` | Ya puedes iniciar sesión con tu contraseña. | You can now sign in with your password. |
| `cuenta.recuperar.listo.restablecer` | `app/(app)/recuperar/[token]/page.tsx:111` | Ya puedes iniciar sesión con tu nueva contraseña. | You can now sign in with your new password. |
| `cuenta.recuperar.elige.bienvenida` | `app/(app)/recuperar/[token]/page.tsx:120` | Elige tu contraseña | Choose your password |
| `cuenta.recuperar.elige.restablecer` | `app/(app)/recuperar/[token]/page.tsx:120` | Elige una nueva contraseña | Choose a new password |
| `cuenta.recuperar.regla` | `app/(app)/recuperar/[token]/page.tsx:121` | Mínimo 8 caracteres, con al menos una letra y un número. | At least 8 characters, with at least one letter and one number. |
| `cuenta.recuperar.guardando` | `app/(app)/recuperar/[token]/page.tsx:134` | Guardando… | Saving… |
| `cuenta.recuperar.error` | `app/(app)/recuperar/[token]/page.tsx:64`<br>`app/(app)/recuperar/[token]/page.tsx:67` | No se pudo restablecer la contraseña | The password could not be reset |
| `cuenta.bienvenida.titulo` | `app/(app)/bienvenida/page.tsx:81` | Antes de empezar | Before you start |
| `cuenta.bienvenida.intro` | `app/(app)/bienvenida/page.tsx:83` | Tres preguntas sobre las razones sociales de tu empresa. Con ellas el sistema sabe a nombre de quién se paga una renta y quién emite un comprobante. | Three questions about your company’s legal entities. With them the system knows who pays each rent and who issues invoices. |
| `cuenta.bienvenida.error.cargar` | `app/(app)/bienvenida/page.tsx:63`<br>`app/(app)/bienvenida/page.tsx:68` | No se pudo cargar el cuestionario | The questionnaire could not be loaded |
| `cuenta.bienvenida.ya.uno` | `app/(app)/bienvenida/page.tsx:108` | Tu empresa ya tiene una razón social registrada, así que este cuestionario ya se contestó. | Your company already has one legal entity registered, so this questionnaire has already been answered. |
| `cuenta.bienvenida.ya.otros` | `app/(app)/bienvenida/page.tsx:109` | Tu empresa ya tiene {n} razones sociales registradas, así que este cuestionario ya se contestó. | Your company already has {n} legal entities registered, so this questionnaire has already been answered. |
| `cuenta.bienvenida.sin-roles` | `app/(app)/bienvenida/page.tsx:118` | sin roles | no roles |
| `cuenta.bienvenida.de-baja` | `app/(app)/bienvenida/page.tsx:119` | ␣(dada de baja) | ␣(deactivated) |
| `cuenta.bienvenida.cambiar` | `app/(app)/bienvenida/page.tsx:130` | Para cambiarlas, añadir otra o dar una de baja, ve a {enlace}. | To change them, add another one or deactivate one, go to {enlace}. |
| `cuenta.bienvenida.ir-razones` | `app/(app)/bienvenida/page.tsx:139` | Ir a Razones sociales | Go to Legal entities |
| `cuenta.cuestionario.p1` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:125` | ¿Tu empresa tiene varias razones sociales? | Does your company have several legal entities? |
| `cuenta.cuestionario.p1.ayuda` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:126` | Casi todas las empresas de medios reparten su operación entre varias. Si tienes una sola, con esto te ahorras el resto. | Most media companies split their operations across several. If you have only one, this saves you the rest. |
| `cuenta.cuestionario.p2` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:142` | ¿La operación está en la misma razón social que comercializa o factura las ventas? | Do operations run under the same legal entity that sells or invoices? |
| `cuenta.cuestionario.p2.ayuda` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:143` | Suelen coincidir, y por eso se pregunta: si es tu caso, el paso siguiente te pide un dato menos. | They usually match, which is why we ask: if that’s your case, the next step asks you for one thing less. |
| `cuenta.cuestionario.p3.una` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:159` | Indica tu razón social | Enter your legal entity |
| `cuenta.cuestionario.p3.varias` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:160` | Indica las razones sociales para cada rol dentro de tu empresa | Enter the legal entity for each role within your company |
| `cuenta.cuestionario.p3.una.ayuda` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:164` | Se le asignarán todos los roles. Después puedes separarlos en Razones sociales. | It will be given every role. You can split them later in Legal entities. |
| `cuenta.cuestionario.p3.varias.ayuda` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:165` | Una misma razón social puede llevar varios roles: escribe el mismo nombre y se agrupan en una sola. Lo que no sepas todavía, déjalo en blanco. | One legal entity can hold several roles: type the same name and they are grouped into one. Leave blank whatever you don’t know yet. |
| `cuenta.cuestionario.razon-social` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:171`<br>`components/demo/bienvenida/CuestionarioRazonesSociales.tsx:194` | Razón social | Legal name |
| `cuenta.cuestionario.se-crearan.uno` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:206` | Se crearán 1 razón social: | 1 legal entity will be created: |
| `cuenta.cuestionario.se-crearan.otros` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:206` | Se crearán {n} razones sociales: | {n} legal entities will be created: |
| `cuenta.cuestionario.guardando` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:229` | Guardando… | Saving… |
| `cuenta.cuestionario.guardar` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:229` | Guardar y continuar | Save and continue |
| `cuenta.cuestionario.mas-tarde` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:236` | Lo hago más tarde | I’ll do it later |
| `cuenta.cuestionario.si` | `components/demo/bienvenida/PreguntaSiNo.tsx:63` | Sí | Yes |
| `cuenta.cuestionario.no` | `components/demo/bienvenida/PreguntaSiNo.tsx:64` | No | No |
| `cuenta.cuestionario.contesta` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:98` | Contesta las preguntas antes de continuar. | Answer the questions before you continue. |
| `cuenta.cuestionario.error.guardar` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:109` | No se pudo guardar el cuestionario | The questionnaire could not be saved |
| `cuenta.cuestionario.listo` | `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:110` | Listo: {resumen} | Done: {resumen} |
| `cuenta.portal.no-corresponde` | `app/(app)/portal/[token]/page.tsx:60` | Este enlace de portal no corresponde a ninguna campaña activa. | This portal link doesn’t match any active campaign. |
| `cuenta.portal.subtitulo` | `app/(app)/portal/[token]/page.tsx:98` | Portal del cliente | Client portal |
| `cuenta.portal.seguimiento` | `app/(app)/portal/[token]/page.tsx:101` | Seguimiento de campaña | Campaign tracking |
| `cuenta.portal.avance` | `app/(app)/portal/[token]/page.tsx:132` | Avance de tu campaña | Your campaign’s progress |
| `cuenta.portal.ubicaciones` | `app/(app)/portal/[token]/page.tsx:142` | Ubicaciones | Locations |
| `cuenta.portal.evidencias` | `app/(app)/portal/[token]/page.tsx:164` | Evidencias de instalación | Installation evidence |
| `cuenta.portal.pie` | `app/(app)/portal/[token]/page.tsx:179` | {org} · portal de seguimiento | {org} · tracking portal |
| `cuenta.publica.no-corresponde` | `app/(app)/p/[id]/page.tsx:156` | Esta liga no corresponde a ninguna propuesta. | This link doesn’t match any proposal. |
| `cuenta.publica.subtitulo` | `app/(app)/p/[id]/page.tsx:210` | Propuesta comercial | Sales proposal |
| `cuenta.publica.aceptada` | `app/(app)/p/[id]/page.tsx:215` | Aceptada | Accepted |
| `cuenta.publica.pendiente` | `app/(app)/p/[id]/page.tsx:219` | Pendiente de tu aprobación | Awaiting your approval |
| `cuenta.publica.vencida` | `app/(app)/p/[id]/page.tsx:219` | Propuesta vencida | Proposal expired |
| `cuenta.publica.solo-lectura` | `app/(app)/p/[id]/page.tsx:219` | Solo lectura | Read only |
| `cuenta.publica.vencio-el` | `app/(app)/p/[id]/page.tsx:234` | venció el {fecha} | expired on {fecha} |
| `cuenta.publica.valida-hasta` | `app/(app)/p/[id]/page.tsx:234` | válida hasta el {fecha} | valid until {fecha} |
| `cuenta.publica.kpi.sitios` | `app/(app)/p/[id]/page.tsx:259` | Sitios | Sites |
| `cuenta.publica.sitios` | `app/(app)/p/[id]/page.tsx:266` | Sitios de la propuesta | Sites in the proposal |
| `cuenta.publica.sin-ubicacion` | `app/(app)/p/[id]/page.tsx:294` | Ubicación no capturada | Location not entered |
| `cuenta.publica.mapa.parcial.uno` | `app/(app)/p/[id]/page.tsx:342` | {faltan} de {n} pantalla no tienen coordenadas registradas; su dirección está en la lista de sitios. | Screens without coordinates: {faltan} of {n}. Their addresses are in the list of sites. |
| `cuenta.publica.mapa.parcial.otros` | `app/(app)/p/[id]/page.tsx:342` | {faltan} de {n} pantallas no tienen coordenadas registradas; su dirección está en la lista de sitios. | Screens without coordinates: {faltan} of {n}. Their addresses are in the list of sites. |
| `cuenta.publica.mapa.ninguna` | `app/(app)/p/[id]/page.tsx:351` | Las pantallas de esta propuesta aún no tienen coordenadas registradas. Consulta la dirección de cada una en la lista de sitios. | The screens in this proposal don’t have coordinates entered yet. Check the address of each one in the list of sites. |
| `cuenta.publica.aceptada.titulo` | `app/(app)/p/[id]/page.tsx:440` | Propuesta aceptada | Proposal accepted |
| `cuenta.publica.aceptada.detalle` | `app/(app)/p/[id]/page.tsx:444` | Aceptada el {fecha}. El equipo comercial fue notificado. | Accepted on {fecha}. The sales team was notified. |
| `cuenta.publica.aceptada.detalle-por` | `app/(app)/p/[id]/page.tsx:443` | Aceptada por {quien} el {fecha}. El equipo comercial fue notificado. | Accepted by {quien} on {fecha}. The sales team was notified. |
| `cuenta.publica.aceptas` | `app/(app)/p/[id]/page.tsx:453` | ¿Aceptas esta propuesta? | Do you accept this proposal? |
| `cuenta.publica.al-aceptar.uno` | `app/(app)/p/[id]/page.tsx:457` | Al aceptar confirmas las {n} pantalla y el total de {total}. Queda registrada tu aceptación con fecha y hora. | By accepting you confirm the {n} screen and the total of {total}. Your acceptance is recorded with the date and time. |
| `cuenta.publica.al-aceptar.otros` | `app/(app)/p/[id]/page.tsx:457` | Al aceptar confirmas las {n} pantallas y el total de {total}. Queda registrada tu aceptación con fecha y hora. | By accepting you confirm the {n} screens and the total of {total}. Your acceptance is recorded with the date and time. |
| `cuenta.publica.tu-nombre` | `app/(app)/p/[id]/page.tsx:466` | Tu nombre y cargo | Your name and title |
| `cuenta.publica.aceptando` | `app/(app)/p/[id]/page.tsx:470` | Aceptando… | Accepting… |
| `cuenta.publica.aceptar` | `app/(app)/p/[id]/page.tsx:470` | Aceptar propuesta | Accept proposal |
| `cuenta.publica.vencida.detalle` | `app/(app)/p/[id]/page.tsx:480` | Esta propuesta venció el {fecha} y ya no se puede aceptar desde aquí. Pide una actualizada a quien te la envió. | This proposal expired on {fecha} and can no longer be accepted here. Ask whoever sent it to you for an updated one. |
| `cuenta.publica.pie` | `app/(app)/p/[id]/page.tsx:487` | Spaces · propuesta comercial | Spaces · sales proposal |
| `cuenta.publica.pie.solo-lectura` | `app/(app)/p/[id]/page.tsx:487` | ␣· este enlace es de solo lectura | ␣· this link is read-only |
| `cuenta.publica.error.nombre` | `app/(app)/p/[id]/page.tsx:120` | Escribe tu nombre para aceptar | Enter your name to accept |
| `cuenta.publica.error.aceptar` | `app/(app)/p/[id]/page.tsx:133`<br>`app/(app)/p/[id]/page.tsx:138` | No se pudo aceptar. Reintenta. | Could not accept. Please try again. |

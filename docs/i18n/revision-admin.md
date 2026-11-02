# Tabla de revisión · lote de inglés «administración (ámbito `admin`)»

Generada el 2026-11-02 a partir de `apps/web/lib/i18n/textos/admin.ts` y de los usos en el código
(búsqueda literal de la clave). **525 claves.** Rama `feat/ingles-administracion`.

**Pantallas:** Administración (usuarios, roles y permisos, control de cambios, configuración del negocio y de la instancia, organizaciones, actualizaciones, soporte), Configuración (Mi cuenta / Empresa), Integraciones, Network, Novedades, Actividad y Razones sociales.

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
| `admin.rol.dueno` | clave armada en el código (prefijo + valor) | Dueño | Owner |
| `admin.rol.administrador` | clave armada en el código (prefijo + valor) | Administrador | Administrator |
| `admin.rol.director_comercial` | clave armada en el código (prefijo + valor) | Director comercial | Sales director |
| `admin.rol.gerente_ventas` | clave armada en el código (prefijo + valor) | Gerente de ventas | Sales manager |
| `admin.rol.vendedor` | clave armada en el código (prefijo + valor) | Vendedor | Sales rep |
| `admin.rol.operaciones` | clave armada en el código (prefijo + valor) | Operaciones | Operations |
| `admin.rol.imprenta` | clave armada en el código (prefijo + valor) | Imprenta | Printing |
| `admin.rol.finanzas` | clave armada en el código (prefijo + valor) | Finanzas | Finance |
| `admin.tipo-ot.montaje-lona` | clave armada en el código (prefijo + valor) | Montaje de lona | Vinyl installation |
| `admin.tipo-ot.montaje-digital` | clave armada en el código (prefijo + valor) | Montaje digital | Digital installation |
| `admin.tipo-ot.desmontaje` | clave armada en el código (prefijo + valor) | Desmontaje | Removal |
| `admin.tipo-ot.mantenimiento-preventivo` | clave armada en el código (prefijo + valor) | Mantenimiento preventivo | Preventive maintenance |
| `admin.tipo-ot.mantenimiento-correctivo` | clave armada en el código (prefijo + valor) | Mantenimiento correctivo | Corrective maintenance |
| `admin.tipo-ot.herreria` | clave armada en el código (prefijo + valor) | Herrería | Metalwork |
| `admin.tipo-ot.electrico` | clave armada en el código (prefijo + valor) | Eléctrico | Electrical |
| `admin.tipo-ot.inspeccion` | clave armada en el código (prefijo + valor) | Inspección | Inspection |
| `admin.tipo-ot.otro` | clave armada en el código (prefijo + valor) | Otro | Other |
| `admin.cap.ver` | `components/demo/admin/permisos.ts:52` | Ver | View |
| `admin.cap.crear` | `components/demo/admin/permisos.ts:53` | Crear | Create |
| `admin.cap.aprobar` | `components/demo/admin/permisos.ts:54` | Aprobar | Approve |
| `admin.cap.facturar` | `components/demo/admin/permisos.ts:55` | Facturar | Invoice |
| `admin.cap.costear` | `components/demo/admin/permisos.ts:56` | Costear | Cost |
| `admin.modulo.dashboard` | clave armada en el código (prefijo + valor) | Dashboard | Dashboard |
| `admin.modulo.comercial` | clave armada en el código (prefijo + valor) | Comercial | Sales |
| `admin.modulo.arrendadores` | clave armada en el código (prefijo + valor) | Arrendadores | Landlords |
| `admin.modulo.precios` | clave armada en el código (prefijo + valor) | Precios y descuentos | Pricing and discounts |
| `admin.modulo.operaciones` | clave armada en el código (prefijo + valor) | Operaciones | Operations |
| `admin.modulo.imprenta` | clave armada en el código (prefijo + valor) | Imprenta | Printing |
| `admin.modulo.finanzas` | clave armada en el código (prefijo + valor) | Finanzas | Finance |
| `admin.modulo.network` | clave armada en el código (prefijo + valor) | Network | Network |
| `admin.modulo.administracion` | clave armada en el código (prefijo + valor) | Administración | Settings |
| `admin.area.space-eyes` | `app/(app)/(shell)/administracion/page.tsx:675` | Space Eyes (cámaras, fotos, vivo y órdenes a los equipos) | Space Eyes (cameras, photos, live view and device commands) |
| `admin.comun.guardando` | `app/(app)/(shell)/administracion/page.tsx:408`<br>`app/(app)/(shell)/administracion/page.tsx:1387`<br>`app/(app)/(shell)/administracion/page.tsx:1599` | Guardando… | Saving… |
| `admin.comun.creando` | `app/(app)/(shell)/administracion/page.tsx:589`<br>`components/demo/admin/OrganizacionesPanel.tsx:287` | Creando… | Creating… |
| `admin.comun.agregar` | `app/(app)/(shell)/administracion/page.tsx:1112`<br>`app/(app)/(shell)/administracion/page.tsx:1133`<br>`app/(app)/(shell)/administracion/page.tsx:1678` | Agregar | Add |
| `admin.comun.quitar` | `app/(app)/(shell)/administracion/page.tsx:1036`<br>`app/(app)/(shell)/administracion/page.tsx:1678` | Quitar | Remove |
| `admin.comun.activo` | `app/(app)/(shell)/administracion/page.tsx:166`<br>`components/demo/admin/OrganizacionesPanel.tsx:127` | Activo | Active |
| `admin.comun.inactivo` | `app/(app)/(shell)/administracion/page.tsx:166` | Inactivo | Inactive |
| `admin.comun.no-se-pudo-guardar` | `app/(app)/(shell)/administracion/page.tsx:886`<br>`app/(app)/(shell)/configuracion/page.tsx:94`<br>`app/(app)/(shell)/configuracion/page.tsx:183` | No se pudo guardar | Could not save |
| `admin.comun.n-de` | `app/(app)/(shell)/actividad/page.tsx:86`<br>`app/(app)/(shell)/integraciones/page.tsx:83` | {n} de {total} | {n} of {total} |
| `admin.titulo` | `app/(app)/(shell)/administracion/page.tsx:68` | Administración | Settings |
| `admin.subtitulo` | `app/(app)/(shell)/administracion/page.tsx:69` | Usuarios, roles y configuración del negocio | Users, roles and business settings |
| `admin.tab.usuarios` | `app/(app)/(shell)/administracion/page.tsx:75` | Usuarios | Users |
| `admin.tab.roles` | `app/(app)/(shell)/administracion/page.tsx:76` | Roles y permisos | Roles and permissions |
| `admin.tab.config` | `app/(app)/(shell)/administracion/page.tsx:77` | Configuración | Configuration |
| `admin.usuarios.toast.rol` | `app/(app)/(shell)/administracion/page.tsx:124` | {nombre}: rol cambiado a {rol} | {nombre}: role changed to {rol} |
| `admin.usuarios.toast.desactivado` | `app/(app)/(shell)/administracion/page.tsx:130` | {nombre}: desactivado | {nombre}: deactivated |
| `admin.usuarios.toast.activado` | `app/(app)/(shell)/administracion/page.tsx:130` | {nombre}: activado | {nombre}: activated |
| `admin.usuarios.rol-de` | `app/(app)/(shell)/administracion/page.tsx:153` | Rol de {nombre} | Role of {nombre} |
| `admin.usuarios.estatus-propio` | `app/(app)/(shell)/administracion/page.tsx:167` | No puedes cambiar tu propio estatus | You can’t change your own status |
| `admin.usuarios.pulsa-desactivar` | `app/(app)/(shell)/administracion/page.tsx:171` | Pulsa para desactivar a {nombre} | Click to deactivate {nombre} |
| `admin.usuarios.pulsa-activar` | `app/(app)/(shell)/administracion/page.tsx:171` | Pulsa para activar a {nombre} | Click to activate {nombre} |
| `admin.usuarios.cambiar-mia` | `app/(app)/(shell)/administracion/page.tsx:184` | Cambiar la mía | Change mine |
| `admin.usuarios.cambiar` | `app/(app)/(shell)/administracion/page.tsx:184` | Cambiar | Change |
| `admin.usuarios.tu` | `app/(app)/(shell)/administracion/page.tsx:187` | tú | you |
| `admin.usuarios.equipo` | `app/(app)/(shell)/administracion/page.tsx:193` | Equipo | Team |
| `admin.usuarios.n-usuarios.uno` | clave armada en el código (prefijo + valor) | {n} usuario | {n} user |
| `admin.usuarios.n-usuarios.otros` | clave armada en el código (prefijo + valor) | {n} usuarios | {n} users |
| `admin.usuarios.n-activos.uno` | clave armada en el código (prefijo + valor) | {n} activo | {n} active |
| `admin.usuarios.n-activos.otros` | clave armada en el código (prefijo + valor) | {n} activos | {n} active |
| `admin.usuarios.n-inactivos.uno` | clave armada en el código (prefijo + valor) | {n} inactivo | {n} inactive |
| `admin.usuarios.n-inactivos.otros` | clave armada en el código (prefijo + valor) | {n} inactivos | {n} inactive |
| `admin.usuarios.invitar` | `app/(app)/(shell)/administracion/page.tsx:203` | Invitar usuario | Invite user |
| `admin.usuarios.sin-usuarios` | `app/(app)/(shell)/administracion/page.tsx:208` | Sin usuarios. | No users. |
| `admin.usuarios.col.usuario` | `app/(app)/(shell)/administracion/page.tsx:216` | Usuario | User |
| `admin.usuarios.col.rol` | `app/(app)/(shell)/administracion/page.tsx:217` | Rol | Role |
| `admin.usuarios.col.estatus` | `app/(app)/(shell)/administracion/page.tsx:218` | Estatus | Status |
| `admin.usuarios.col.contrasena` | `app/(app)/(shell)/administracion/page.tsx:219` | Contraseña | Password |
| `admin.usuarios.toast.invitacion` | `app/(app)/(shell)/administracion/page.tsx:275` | Invitación enviada a {nombre} | Invitation sent to {nombre} |
| `admin.usuarios.toast.creado` | `app/(app)/(shell)/administracion/page.tsx:275` | Usuario {nombre} creado | User {nombre} created |
| `admin.usuarios.toast.tu-contrasena` | `app/(app)/(shell)/administracion/page.tsx:282` | Tu contraseña se actualizó | Your password was updated |
| `admin.usuarios.toast.contrasena-de` | `app/(app)/(shell)/administracion/page.tsx:282` | Contraseña de {nombre} actualizada | Password for {nombre} updated |
| `admin.password.error.corta` | `app/(app)/(shell)/administracion/page.tsx:333` | La contraseña debe tener al menos 8 caracteres, con letra y número. | The password must be at least 8 characters long, with a letter and a number. |
| `admin.password.error.no-coinciden` | `app/(app)/(shell)/administracion/page.tsx:334` | Las contraseñas no coinciden. | The passwords don’t match. |
| `admin.password.error.actual` | `app/(app)/(shell)/administracion/page.tsx:335` | Ingresa tu contraseña actual para confirmar. | Enter your current password to confirm. |
| `admin.password.error.cambiar` | `app/(app)/(shell)/administracion/page.tsx:344`<br>`app/(app)/(shell)/administracion/page.tsx:347` | No se pudo cambiar la contraseña | The password could not be changed |
| `admin.password.error.restablecer` | `app/(app)/(shell)/administracion/page.tsx:362`<br>`app/(app)/(shell)/administracion/page.tsx:382` | No se pudo restablecer | Could not reset |
| `admin.password.titulo.mia` | `app/(app)/(shell)/administracion/page.tsx:391` | Cambiar mi contraseña | Change my password |
| `admin.password.titulo.de` | `app/(app)/(shell)/administracion/page.tsx:391` | Restablecer la contraseña de {nombre} | Reset the password for {nombre} |
| `admin.password.subtitulo.mia` | `app/(app)/(shell)/administracion/page.tsx:392` | Confirma con tu contraseña actual | Confirm with your current password |
| `admin.password.ya-copie` | `app/(app)/(shell)/administracion/page.tsx:396` | Ya la copié | I’ve copied it |
| `admin.password.confirmando` | `app/(app)/(shell)/administracion/page.tsx:401` | Confirmando… | Confirming… |
| `admin.password.confirmar-restablecer` | `app/(app)/(shell)/administracion/page.tsx:401` | Confirmar y restablecer | Confirm and reset |
| `admin.password.guardar` | `app/(app)/(shell)/administracion/page.tsx:408` | Guardar contraseña | Save password |
| `admin.password.restableciendo` | `app/(app)/(shell)/administracion/page.tsx:415` | Restableciendo… | Resetting… |
| `admin.password.restablecer` | `app/(app)/(shell)/administracion/page.tsx:415` | Restablecer contraseña | Reset password |
| `admin.password.temporal-de` | `app/(app)/(shell)/administracion/page.tsx:426` | Contraseña temporal de {nombre}. Entrégasela por un medio seguro: | Temporary password for {nombre}. Hand it over through a secure channel: |
| `admin.password.no-se-ve` | `app/(app)/(shell)/administracion/page.tsx:434` | No se puede volver a ver: en la base solo queda su huella. Se cerraron las sesiones abiertas de {nombre} y el sistema le pedirá cambiarla en cuanto entre. | It can’t be shown again: only its hash stays in the database. {nombre}’s open sessions were closed, and the system will ask them to change it as soon as they sign in. |
| `admin.password.confirma-tu` | `app/(app)/(shell)/administracion/page.tsx:441` | Confirma con {tu} contraseña. Vas a cambiar el acceso de {nombre}, y la bitácora tiene que poder probar que fuiste tú. | Confirm with {tu} password. You’re about to change {nombre}’s access, and the audit log has to be able to prove it was you. |
| `admin.password.tu` | `app/(app)/(shell)/administracion/page.tsx:441` | tu | your |
| `admin.password.tu-contrasena` | `app/(app)/(shell)/administracion/page.tsx:443` | Tu contraseña | Your password |
| `admin.password.actual` | `app/(app)/(shell)/administracion/page.tsx:452` | Contraseña actual | Current password |
| `admin.password.nueva` | `app/(app)/(shell)/administracion/page.tsx:455` | Nueva contraseña | New password |
| `admin.password.confirmar` | `app/(app)/(shell)/administracion/page.tsx:458` | Confirmar contraseña | Confirm password |
| `admin.password.se-generara` | `app/(app)/(shell)/administracion/page.tsx:464` | Se generará una contraseña {temporal} para {nombre}, se cerrarán sus sesiones abiertas y tendrá que cambiarla al entrar. Tú no eliges la contraseña ni conservas una que siga sirviendo. | A {temporal} password will be generated for {nombre}, their open sessions will be closed and they’ll have to change it when they sign in. You don’t choose the password or keep one that still works. |
| `admin.password.temporal` | `app/(app)/(shell)/administracion/page.tsx:464` | temporal | temporary |
| `admin.alta.cargo-omision` | `app/(app)/(shell)/administracion/page.tsx:549` | Miembro del equipo | Team member |
| `admin.alta.error` | `app/(app)/(shell)/administracion/page.tsx:569` | No se pudo invitar | Could not invite |
| `admin.alta.sub.enlace` | `app/(app)/(shell)/administracion/page.tsx:582` | Comparte el enlace con la persona | Share the link with the person |
| `admin.alta.sub.invitar` | `app/(app)/(shell)/administracion/page.tsx:583` | Recibirá un enlace para elegir su contraseña | They’ll get a link to choose their password |
| `admin.alta.sub.google` | `app/(app)/(shell)/administracion/page.tsx:584` | Entrará con su cuenta de Google | They’ll sign in with their Google account |
| `admin.alta.sub.password` | `app/(app)/(shell)/administracion/page.tsx:585` | Define su acceso y contraseña | Set their access and password |
| `admin.alta.listo` | `app/(app)/(shell)/administracion/page.tsx:588` | Listo | Done |
| `admin.alta.crear-invitar` | `app/(app)/(shell)/administracion/page.tsx:589` | Crear e invitar | Create and invite |
| `admin.alta.crear` | `app/(app)/(shell)/administracion/page.tsx:589` | Crear usuario | Create user |
| `admin.alta.titulo` | `app/(app)/(shell)/administracion/page.tsx:592` | Crear usuario | Create user |
| `admin.alta.fallo-correo` | `app/(app)/(shell)/administracion/page.tsx:598` | La cuenta se creó, pero el correo no se pudo enviar. Pásale este enlace por otro medio. | The account was created, but the email could not be sent. Give them this link some other way. |
| `admin.alta.sin-correo` | `app/(app)/(shell)/administracion/page.tsx:602` | La cuenta de {nombre} está creada. Este servidor no tiene correo configurado, así que pásale este enlace por un medio seguro: con él elige su contraseña. | {nombre}’s account has been created. This server has no email configured, so give them this link through a secure channel: with it they choose their password. |
| `admin.alta.vence` | `app/(app)/(shell)/administracion/page.tsx:607` | Vence en 72 horas y sirve una sola vez. No se volverá a mostrar. | It expires in 72 hours and works only once. It won’t be shown again. |
| `admin.alta.copiado` | `app/(app)/(shell)/administracion/page.tsx:608` | Copiado | Copied |
| `admin.alta.copiar` | `app/(app)/(shell)/administracion/page.tsx:608` | Copiar enlace | Copy link |
| `admin.alta.nombre` | `app/(app)/(shell)/administracion/page.tsx:613` | Nombre | Name |
| `admin.alta.correo` | `app/(app)/(shell)/administracion/page.tsx:614` | Correo | Email |
| `admin.alta.ejemplo-correo` | `app/(app)/(shell)/administracion/page.tsx:614`<br>`components/demo/admin/OrganizacionesPanel.tsx:258` | correo@empresa.com | email@company.com |
| `admin.alta.cargo` | `app/(app)/(shell)/administracion/page.tsx:615` | Cargo | Job title |
| `admin.alta.rol` | `app/(app)/(shell)/administracion/page.tsx:616` | Rol | Role |
| `admin.alta.acceso` | `app/(app)/(shell)/administracion/page.tsx:618` | Acceso | Access |
| `admin.alta.invitar.titulo` | `app/(app)/(shell)/administracion/page.tsx:621` | Enviar invitación | Send invitation |
| `admin.alta.invitar.detalle` | `app/(app)/(shell)/administracion/page.tsx:622` | Recibe un enlace para elegir su propia contraseña. Nadie más la conoce. | They get a link to choose their own password. Nobody else knows it. |
| `admin.alta.fijar.titulo` | `app/(app)/(shell)/administracion/page.tsx:626` | Fijar la contraseña yo | Set the password myself |
| `admin.alta.fijar.detalle` | `app/(app)/(shell)/administracion/page.tsx:627` | Tú la escribes y se la entregas por un medio seguro. | You type it and hand it over through a secure channel. |
| `admin.alta.google.titulo` | `app/(app)/(shell)/administracion/page.tsx:632` | Entra con su cuenta de Google | Signs in with their Google account |
| `admin.alta.google.detalle` | `app/(app)/(shell)/administracion/page.tsx:633` | Su correo de Google debe ser el mismo que escribiste arriba. | Their Google email must be the same one you entered above. |
| `admin.alta.contrasena` | `app/(app)/(shell)/administracion/page.tsx:641` | Contraseña | Password |
| `admin.matriz.sin-api` | `app/(app)/(shell)/administracion/page.tsx:699` | Sin API propia: el permiso lo aplica /api/estado | No API of its own: the permission is enforced by /api/estado |
| `admin.matriz.titulo` | `app/(app)/(shell)/administracion/page.tsx:719` | Permisos por rol y módulo | Permissions by role and module |
| `admin.matriz.leyenda-sin-api` | `app/(app)/(shell)/administracion/page.tsx:727` | * el área no tiene API propia: su permiso lo aplica /api/estado | * the area has no API of its own: its permission is enforced by /api/estado |
| `admin.matriz.error` | `app/(app)/(shell)/administracion/page.tsx:732` | No se pudo cargar la matriz de permisos. | The permission matrix could not be loaded. |
| `admin.matriz.col.modulo` | `app/(app)/(shell)/administracion/page.tsx:741` | Módulo · qué abre | Module · what it opens |
| `admin.cambios.no-coinciden` | `components/demo/admin/ControlCambiosPanel.tsx:66` | Las dos contraseñas no coinciden | The two passwords don’t match |
| `admin.cambios.toast.actualizada` | `components/demo/admin/ControlCambiosPanel.tsx:74` | Contraseña de cambios actualizada | Change-control password updated |
| `admin.cambios.toast.asignada` | `components/demo/admin/ControlCambiosPanel.tsx:74` | Contraseña de cambios asignada | Change-control password set |
| `admin.cambios.confirmar-activar` | `components/demo/admin/ControlCambiosPanel.tsx:88` | A partir de ahora, TODOS —tú incluido— tendrán que volver a teclear su propia contraseña para los cambios que mueven dinero o el catálogo. ¿Activar? | From now on, EVERYONE —you included— will have to type their own password again for changes that move money or the catalog. Turn it on? |
| `admin.cambios.confirmar-desactivar` | `components/demo/admin/ControlCambiosPanel.tsx:94` | ¿Desactivar? Los cambios sensibles dejarán de pedir contraseña a nadie. | Turn it off? Sensitive changes will no longer ask anyone for a password. |
| `admin.cambios.toast.activado` | `components/demo/admin/ControlCambiosPanel.tsx:103` | Control de cambios activado | Change control turned on |
| `admin.cambios.toast.desactivado` | `components/demo/admin/ControlCambiosPanel.tsx:103` | Control de cambios desactivado | Change control turned off |
| `admin.cambios.titulo` | `components/demo/admin/ControlCambiosPanel.tsx:115` | Control de cambios | Change control |
| `admin.cambios.explica` | `components/demo/admin/ControlCambiosPanel.tsx:120` | Actívalo y los cambios que mueven dinero o el catálogo —tarifas, rentas, contratos, pagos, facturación y borrar pantallas, clientes o arrendadores— pedirán una contraseña: la propia de quien los hace, o la que asignes aquí abajo para todo el equipo. El trabajo diario —crear campañas, subir creatividades, cerrar órdenes— sigue sin fricción. | Turn it on and changes that move money or the catalog —rates, rents, contracts, payments, invoicing and deleting screens, clients or landlords— will ask for a password: the person’s own, or the one you set below for the whole team. Day-to-day work —creating campaigns, uploading creatives, closing work orders— stays frictionless. |
| `admin.cambios.aplica-a-ti` | `components/demo/admin/ControlCambiosPanel.tsx:123` | Aplica también a ti. | It applies to you too. |
| `admin.cambios.antes-exento` | `components/demo/admin/ControlCambiosPanel.tsx:123` | Antes el Dueño estaba exento y una sesión suya olvidada abierta podía facturar sin que nadie confirmara nada. | The Owner used to be exempt, and a session of theirs left open could invoice without anyone confirming anything. |
| `admin.cambios.activo` | `components/demo/admin/ControlCambiosPanel.tsx:132` | Activo. Al teclear una contraseña válida, la sesión queda desbloqueada {minutos} minutos y luego se vuelve a pedir. | On. After a valid password is typed, the session stays unlocked for {minutos} minutes and then asks again. |
| `admin.cambios.desactivar` | `components/demo/admin/ControlCambiosPanel.tsx:135` | Desactivar el control | Turn off change control |
| `admin.cambios.activar` | `components/demo/admin/ControlCambiosPanel.tsx:140` | Activar el control de cambios | Turn on change control |
| `admin.cambios.contrasena` | `components/demo/admin/ControlCambiosPanel.tsx:148` | Contraseña del control de cambios | Change-control password |
| `admin.cambios.independiente` | `components/demo/admin/ControlCambiosPanel.tsx:151` | Independiente de la contraseña de acceso de cada persona. Sirve para desbloquear cambios sensibles, pero {no} para restablecer la contraseña de otra persona — eso siempre exige la contraseña propia de quien lo hace. | Separate from each person’s sign-in password. It unlocks sensitive changes, but {no} resetting another person’s password — that always requires the password of the person doing it. |
| `admin.cambios.no` | `components/demo/admin/ControlCambiosPanel.tsx:151` | no | not |
| `admin.cambios.ya-hay` | `components/demo/admin/ControlCambiosPanel.tsx:157` | Ya hay una contraseña asignada. | A password has already been set. |
| `admin.cambios.ninguna` | `components/demo/admin/ControlCambiosPanel.tsx:157` | Todavía no se ha asignado ninguna. | None has been set yet. |
| `admin.cambios.cambiarla` | `components/demo/admin/ControlCambiosPanel.tsx:160` | Cambiarla | Change it |
| `admin.cambios.asignar` | `components/demo/admin/ControlCambiosPanel.tsx:160` | Asignar contraseña | Set password |
| `admin.cambios.nueva` | `components/demo/admin/ControlCambiosPanel.tsx:165` | Contraseña nueva ({regla}) | New password ({regla}) |
| `admin.cambios.repetirla` | `components/demo/admin/ControlCambiosPanel.tsx:174` | Repetirla | Repeat it |
| `admin.cfg.familia.empresa` | `app/(app)/(shell)/administracion/page.tsx:794`<br>`app/(app)/(shell)/administracion/page.tsx:964`<br>`app/(app)/(shell)/administracion/page.tsx:965` | Empresa | Company |
| `admin.cfg.familia.comercial` | `app/(app)/(shell)/administracion/page.tsx:795`<br>`app/(app)/(shell)/administracion/page.tsx:1088`<br>`app/(app)/(shell)/administracion/page.tsx:1089` | Comercial | Sales |
| `admin.cfg.familia.operacion` | `app/(app)/(shell)/administracion/page.tsx:796`<br>`app/(app)/(shell)/administracion/page.tsx:1219`<br>`app/(app)/(shell)/administracion/page.tsx:1220` | Operación | Operations |
| `admin.cfg.familia.instancia` | `app/(app)/(shell)/administracion/page.tsx:797`<br>`app/(app)/(shell)/administracion/page.tsx:1287`<br>`app/(app)/(shell)/administracion/page.tsx:1288` | Instancia | Instance |
| `admin.cfg.secciones` | `app/(app)/(shell)/administracion/page.tsx:955` | Secciones de la configuración | Configuration sections |
| `admin.tope.invalido` | `app/(app)/(shell)/administracion/page.tsx:855` | El tope de descuento tiene que ser un número entre 0 y 100 | The discount cap has to be a number between 0 and 100 |
| `admin.tope.sin-tope` | `app/(app)/(shell)/administracion/page.tsx:862` | Sin tope de descuento | No discount cap |
| `admin.tope.toast` | `app/(app)/(shell)/administracion/page.tsx:862` | Tope de descuento: {v} % | Discount cap: {v}% |
| `admin.tope.error` | `app/(app)/(shell)/administracion/page.tsx:864` | No se pudo guardar el tope de descuento | The discount cap could not be saved |
| `admin.tope.titulo` | `app/(app)/(shell)/administracion/page.tsx:1144` | Tope de descuento comercial | Commercial discount cap |
| `admin.tope.maximo` | `app/(app)/(shell)/administracion/page.tsx:1148` | Descuento máximo (%) | Maximum discount (%) |
| `admin.tope.guardar` | `app/(app)/(shell)/administracion/page.tsx:1164`<br>`app/(app)/(shell)/administracion/page.tsx:1178` | Guardar tope | Save cap |
| `admin.tope.explica` | `app/(app)/(shell)/administracion/page.tsx:1168` | El descuento más alto que se puede aplicar a una propuesta. Por encima de este número la propuesta {noSeGuarda} y quien vende ve cuál es el tope. Déjalo en {cien} para no limitar nada, que es como nace la organización. Lo que ya está pactado no cambia: bajar el tope no toca las propuestas que ya lo superan, solo impide volver a teclear ese descuento. | The highest discount that can be applied to a proposal. Above this number the proposal {noSeGuarda}, and the sales rep sees what the cap is. Leave it at {cien} to limit nothing, which is how the organization starts. What has already been agreed doesn’t change: lowering the cap doesn’t touch proposals that already exceed it, it only prevents typing that discount again. |
| `admin.tope.no-se-guarda` | `app/(app)/(shell)/administracion/page.tsx:1168` | no se guarda | is not saved |
| `admin.tope.contrasena` | `app/(app)/(shell)/administracion/page.tsx:1171` | Cambiarlo pide tu contraseña: es el control que limita cuánto dinero se puede regalar en una venta, no un ajuste más. | Changing it asks for your password: it’s the control that limits how much money can be given away in a sale, not just another setting. |
| `admin.tope.candado.titulo` | `app/(app)/(shell)/administracion/page.tsx:1176` | Confirma el tope de descuento | Confirm the discount cap |
| `admin.tope.candado.subtitulo` | `app/(app)/(shell)/administracion/page.tsx:1177` | Estás cambiando cuánto descuento puede aplicar tu equipo en una propuesta. | You’re changing how much discount your team can apply to a proposal. |
| `admin.logo.tipo` | `app/(app)/(shell)/administracion/page.tsx:913` | El logo debe ser PNG, JPG, WebP o SVG | The logo must be PNG, JPG, WebP or SVG |
| `admin.logo.peso` | `app/(app)/(shell)/administracion/page.tsx:914` | El logo supera {mb} MB | The logo is over {mb} MB |
| `admin.logo.ilegible` | `app/(app)/(shell)/administracion/page.tsx:919` | No se pudo leer el archivo | Could not read the file |
| `admin.logo.no-imagen` | `app/(app)/(shell)/administracion/page.tsx:921` | El archivo no es una imagen válida | The file is not a valid image |
| `admin.logo.actualizado` | `app/(app)/(shell)/administracion/page.tsx:924` | Logo actualizado: ya se ve en el menú | Logo updated: it now shows in the menu |
| `admin.logo.quitado` | `app/(app)/(shell)/administracion/page.tsx:1034` | Logo quitado | Logo removed |
| `admin.logo.campo` | `app/(app)/(shell)/administracion/page.tsx:978` | Logo | Logo |
| `admin.logo.subiendo` | `app/(app)/(shell)/administracion/page.tsx:1020` | Subiendo… | Uploading… |
| `admin.logo.subir` | `app/(app)/(shell)/administracion/page.tsx:1020` | Subir logo | Upload logo |
| `admin.logo.ayuda` | `app/(app)/(shell)/administracion/page.tsx:1042` | Se usa en el menú lateral, en el contrato impreso, en la propuesta que ve el cliente y en los correos de aviso. PNG, JPG, WebP o SVG, máx. {mb} MB. | Used in the side menu, the printed contract, the proposal the client sees and notification emails. PNG, JPG, WebP or SVG, up to {mb} MB. |
| `admin.identidad.titulo` | `app/(app)/(shell)/administracion/page.tsx:973` | Identidad de la empresa | Company identity |
| `admin.identidad.nombre` | `app/(app)/(shell)/administracion/page.tsx:1054`<br>`app/(app)/(shell)/configuracion/page.tsx:121` | Nombre de la empresa | Company name |
| `admin.identidad.nombre-toast` | `app/(app)/(shell)/administracion/page.tsx:1057` | Nombre actualizado | Name updated |
| `admin.identidad.nombre-ayuda` | `app/(app)/(shell)/administracion/page.tsx:1059` | Es el que aparece en el menú lateral. | It’s the one shown in the side menu. |
| `admin.identidad.moneda` | `app/(app)/(shell)/administracion/page.tsx:1065` | Moneda | Currency |
| `admin.identidad.moneda-ayuda` | `app/(app)/(shell)/administracion/page.tsx:1068` | Se eligió al crear la instancia y no se puede cambiar. | It was chosen when the instance was created and can’t be changed. |
| `admin.identidad.comercial` | `app/(app)/(shell)/administracion/page.tsx:1074` | Nombre comercial | Trade name |
| `admin.identidad.comercial-ejemplo` | `app/(app)/(shell)/administracion/page.tsx:1075` | p. ej. PIXELED | e.g. PIXELED |
| `admin.identidad.comercial-toast` | `app/(app)/(shell)/administracion/page.tsx:1077` | Nombre comercial actualizado | Trade name updated |
| `admin.identidad.dashboard` | `app/(app)/(shell)/administracion/page.tsx:1080` | Se muestran en el encabezado del Dashboard. | They’re shown in the Dashboard header. |
| `admin.iva.titulo` | `app/(app)/(shell)/administracion/page.tsx:1093` | IVA(s) con los que trabaja | VAT rates you work with |
| `admin.iva.agregado` | `app/(app)/(shell)/administracion/page.tsx:1110` | IVA {n}% agregado | VAT {n}% added |
| `admin.iva.ayuda` | `app/(app)/(shell)/administracion/page.tsx:1115` | Las tasas disponibles para facturar. El IVA aplicado se elige por cliente. | The rates available for invoicing. The VAT applied is chosen per client. |
| `admin.plazos.titulo` | `app/(app)/(shell)/administracion/page.tsx:1118` | Plazos de cobranza (días) | Payment terms (days) |
| `admin.plazos.dias` | `app/(app)/(shell)/administracion/page.tsx:1127` | días | days |
| `admin.plazos.agregado` | `app/(app)/(shell)/administracion/page.tsx:1131` | Plazo {n} días agregado | {n}-day term added |
| `admin.cupo.titulo` | `app/(app)/(shell)/administracion/page.tsx:1187` | Cupo de clientes por pantalla | Client cap per screen |
| `admin.cupo.maximo` | `app/(app)/(shell)/administracion/page.tsx:1191` | Máximo de clientes (default) | Maximum clients (default) |
| `admin.cupo.sin-limite` | `app/(app)/(shell)/administracion/page.tsx:1195` | Sin límite | No limit |
| `admin.cupo.desactivado` | `app/(app)/(shell)/administracion/page.tsx:1204` | Cupo de clientes desactivado | Client cap turned off |
| `admin.cupo.toast` | `app/(app)/(shell)/administracion/page.tsx:1204` | Cupo de clientes: {v} | Client cap: {v} |
| `admin.cupo.ayuda` | `app/(app)/(shell)/administracion/page.tsx:1212` | Cuántos anunciantes distintos pueden compartir una pantalla a la vez, además del límite de slots. Déjalo vacío para no aplicar ningún cupo. Un cliente que ya está en la pantalla puede seguir metiendo campañas mientras le queden slots; el cupo solo frena al cliente nuevo. Cada pantalla puede llevar su propio valor desde su ficha en Comercial. | How many different advertisers can share a screen at the same time, on top of the slot limit. Leave it empty to apply no cap. A client already on the screen can keep adding campaigns while there are slots left; the cap only stops a new client. Each screen can carry its own value from its profile in Sales. |
| `admin.loop.titulo` | `app/(app)/(shell)/administracion/page.tsx:1224` | Reproducción digital (loop) | Digital playback (loop) |
| `admin.loop.tamano` | `app/(app)/(shell)/administracion/page.tsx:1228` | Tamaño del loop (seg) | Loop length (sec) |
| `admin.loop.toast` | `app/(app)/(shell)/administracion/page.tsx:1230` | Loop actualizado | Loop updated |
| `admin.loop.duracion` | `app/(app)/(shell)/administracion/page.tsx:1232` | Duración por slot (seg) | Length per slot (sec) |
| `admin.loop.slot-toast` | `app/(app)/(shell)/administracion/page.tsx:1234` | Slot actualizado | Slot updated |
| `admin.loop.slots` | `app/(app)/(shell)/administracion/page.tsx:1236` | Slots por loop | Slots per loop |
| `admin.loop.referencia` | `app/(app)/(shell)/administracion/page.tsx:1241` | Es la estructura de {referencia} (loop ÷ slot). Lo que se aparta en una campaña son los slots que tiene cada pantalla, no éstos: una pantalla con su propio número manda sobre este valor. | It’s the {referencia} structure (loop ÷ slot). What a campaign books is the slots each screen has, not these: a screen with its own number overrides this value. |
| `admin.loop.referencia-palabra` | `app/(app)/(shell)/administracion/page.tsx:1241` | referencia | reference |
| `admin.loop.propios.uno` | `app/(app)/(shell)/administracion/page.tsx:1246` | {n} de {pantallas} digitales tienen un número propio distinto de {slots} ({lista} slots). Se edita en cada pantalla, desde Inventario. | {n} of {pantallas} has its own number other than {slots} ({lista} slots). It’s edited on each screen, from Inventory. |
| `admin.loop.propios.otros` | `app/(app)/(shell)/administracion/page.tsx:1246` | {n} de {pantallas} digitales tienen un número propio distinto de {slots} ({lista} slots). Se edita en cada pantalla, desde Inventario. | {n} of {pantallas} have their own number other than {slots} ({lista} slots). It’s edited on each screen, from Inventory. |
| `admin.loop.pantallas.uno` | `app/(app)/(shell)/administracion/page.tsx:1247` | {n} pantalla | {n} digital screen |
| `admin.loop.pantallas.otros` | `app/(app)/(shell)/administracion/page.tsx:1247` | {n} pantallas | {n} digital screens |
| `admin.tareas.titulo` | `app/(app)/(shell)/administracion/page.tsx:1263` | Tipos de tarea de cuadrilla | Crew task types |
| `admin.tareas.ayuda` | `app/(app)/(shell)/administracion/page.tsx:1265` | Los fija el sistema, no se editan: cuáles aplican depende del tipo de pantalla y esa regla la comprueba el servidor al crear la orden. | They’re set by the system and can’t be edited: which ones apply depends on the screen type, and the server checks that rule when the order is created. |
| `admin.tareas.solo-fija` | `app/(app)/(shell)/administracion/page.tsx:1276` | solo pantalla fija | static screen only |
| `admin.tareas.fija-digital` | `app/(app)/(shell)/administracion/page.tsx:1276` | fija y digital | static and digital |
| `admin.costos.toast` | `app/(app)/(shell)/administracion/page.tsx:1360` | Costos de mano de obra actualizados | Labor costs updated |
| `admin.costos.titulo` | `app/(app)/(shell)/administracion/page.tsx:1367` | Costo de mano de obra por tipo de orden de trabajo | Labor cost by work order type |
| `admin.costos.ayuda` | `app/(app)/(shell)/administracion/page.tsx:1372` | Se usa para calcular el margen en el dashboard y en los reportes de rentabilidad. Deja un campo en blanco para que ese tipo use el valor de respaldo, el mismo que aplicaba a todas las OT antes de que existiera esta tarjeta. | Used to calculate the margin on the dashboard and in the profitability reports. Leave a field blank for that type to use the fallback value, the same one that applied to every work order before this card existed. |
| `admin.costos.respaldo` | `app/(app)/(shell)/administracion/page.tsx:1378` | Usa el respaldo | Uses the fallback |
| `admin.fiscal.razon-social` | `app/(app)/(shell)/administracion/page.tsx:1404`<br>`app/(app)/(shell)/administracion/page.tsx:1429` | Razón social | Legal name |
| `admin.fiscal.rfc` | `app/(app)/(shell)/administracion/page.tsx:1405`<br>`app/(app)/(shell)/administracion/page.tsx:1504` | RFC | RFC (tax ID) |
| `admin.fiscal.domicilio` | `app/(app)/(shell)/administracion/page.tsx:1406`<br>`app/(app)/(shell)/administracion/page.tsx:1507` | Domicilio fiscal | Tax address |
| `admin.fiscal.representante` | `app/(app)/(shell)/administracion/page.tsx:1407`<br>`app/(app)/(shell)/administracion/page.tsx:1505` | Representante legal | Legal representative |
| `admin.fiscal.razon-toast` | `app/(app)/(shell)/administracion/page.tsx:1432` | Razón social actualizada | Legal entity updated |
| `admin.fiscal.elige` | `app/(app)/(shell)/administracion/page.tsx:1433` | Elige la razón social de la empresa | Choose the company’s legal entity |
| `admin.fiscal.sin-razones` | `app/(app)/(shell)/administracion/page.tsx:1440` | Todavía no hay razones sociales | There are no legal entities yet |
| `admin.fiscal.agregar-editar` | `app/(app)/(shell)/administracion/page.tsx:1444` | + Agregar o editar en Razones sociales | + Add or edit in Legal entities |
| `admin.fiscal.titulo` | `app/(app)/(shell)/administracion/page.tsx:1486` | Datos fiscales para contratos | Tax details for contracts |
| `admin.fiscal.comparece` | `app/(app)/(shell)/administracion/page.tsx:1491` | Con estos datos comparece tu empresa como {parte} en los contratos de arrendamiento que genera el sistema. Se capturan una vez y valen para todos. | With these details your company appears as the {parte} in the lease contracts the system generates. They’re entered once and apply to all of them. |
| `admin.fiscal.parte` | `app/(app)/(shell)/administracion/page.tsx:1491` | parte arrendataria | lessee |
| `admin.fiscal.falta.uno` | `app/(app)/(shell)/administracion/page.tsx:1498` | Falta {campos}. Sin esto el contrato sale con huecos y no se puede enviar a firma. | {campos} is missing. Without it the contract comes out with gaps and can’t be sent for signature. |
| `admin.fiscal.falta.otros` | `app/(app)/(shell)/administracion/page.tsx:1498` | Faltan {campos}. Sin esto el contrato sale con huecos y no se puede enviar a firma. | {campos} are missing. Without them the contract comes out with gaps and can’t be sent for signature. |
| `admin.fiscal.rfc-ejemplo` | `app/(app)/(shell)/administracion/page.tsx:1504` | p. ej. RGB140101AB1 | e.g. RGB140101AB1 |
| `admin.fiscal.rfc-toast` | `app/(app)/(shell)/administracion/page.tsx:1504` | RFC actualizado | RFC updated |
| `admin.fiscal.representante-ejemplo` | `app/(app)/(shell)/administracion/page.tsx:1505` | Nombre de quien firma | Name of the signatory |
| `admin.fiscal.representante-toast` | `app/(app)/(shell)/administracion/page.tsx:1505` | Representante legal actualizado | Legal representative updated |
| `admin.fiscal.domicilio-ejemplo` | `app/(app)/(shell)/administracion/page.tsx:1507` | Calle, número, colonia, CP, ciudad, estado | Street, number, neighborhood, ZIP code, city, state |
| `admin.fiscal.domicilio-toast` | `app/(app)/(shell)/administracion/page.tsx:1507` | Domicilio fiscal actualizado | Tax address updated |
| `admin.fiscal.constitucion` | `app/(app)/(shell)/administracion/page.tsx:1508` | Datos de constitución | Incorporation details |
| `admin.fiscal.constitucion-ejemplo` | `app/(app)/(shell)/administracion/page.tsx:1510` | p. ej. escritura pública {escritura} del 3 de marzo de 2014, ante el notario 45 de Guadalajara, Jalisco | e.g. public deed {escritura} dated March 3, 2014, before notary public 45 of Guadalajara, Jalisco |
| `admin.fiscal.constitucion-toast` | `app/(app)/(shell)/administracion/page.tsx:1511` | Datos de constitución actualizados | Incorporation details updated |
| `admin.fiscal.rfc-principal` | `app/(app)/(shell)/administracion/page.tsx:1513` | El RFC es el de la razón social principal: cambiarlo aquí lo cambia también en «Razones sociales». La razón social se elige arriba, en «Identidad de la empresa». | The RFC is the main legal entity’s: changing it here also changes it in “Legal entities”. The legal entity is chosen above, in “Company identity”. |
| `admin.propuestas.vigencia-toast` | `app/(app)/(shell)/administracion/page.tsx:1570` | Vigencia de propuestas: {v} días | Proposal validity: {v} days |
| `admin.propuestas.titulo` | `app/(app)/(shell)/administracion/page.tsx:1552` | Propuestas: vigencia y condiciones | Proposals: validity and terms |
| `admin.propuestas.vigencia` | `app/(app)/(shell)/administracion/page.tsx:1557` | Vigencia (días) | Validity (days) |
| `admin.propuestas.cuentan` | `app/(app)/(shell)/administracion/page.tsx:1576` | Se cuentan desde que la propuesta se {envia}. Vencida, el cliente ya no puede aceptarla desde su liga; por dentro se le pone otra fecha o se vuelve a enviar. | They count from when the proposal is {envia}. Once expired, the client can no longer accept it from their link; internally it gets a new date or is sent again. |
| `admin.propuestas.envia` | `app/(app)/(shell)/administracion/page.tsx:1576` | envía | sent |
| `admin.propuestas.plantilla` | `app/(app)/(shell)/administracion/page.tsx:1578` | Plantilla de términos y condiciones | Terms and conditions template |
| `admin.propuestas.sin-condiciones` | `app/(app)/(shell)/administracion/page.tsx:1583` | Sin condiciones: las propuestas no llevan este bloque. | No terms: proposals don’t carry this block. |
| `admin.propuestas.plantilla-toast` | `app/(app)/(shell)/administracion/page.tsx:1595` | Plantilla de condiciones guardada | Terms template saved |
| `admin.propuestas.guardar` | `app/(app)/(shell)/administracion/page.tsx:1599` | Guardar plantilla | Save template |
| `admin.propuestas.se-copia` | `app/(app)/(shell)/administracion/page.tsx:1601` | Se copia a cada propuesta nueva; las ya creadas conservan las suyas. | It’s copied to every new proposal; existing ones keep their own. |
| `admin.correo.actualizado` | `app/(app)/(shell)/administracion/page.tsx:1632` | Correo de avisos actualizado | Notification email updated |
| `admin.correo.quitado` | `app/(app)/(shell)/administracion/page.tsx:1632` | Correo de avisos quitado | Notification email removed |
| `admin.correo.titulo` | `app/(app)/(shell)/administracion/page.tsx:1654` | Correo de avisos | Notification email |
| `admin.correo.campo` | `app/(app)/(shell)/administracion/page.tsx:1658` | Correo de la organización | Organization email |
| `admin.correo.ejemplo` | `app/(app)/(shell)/administracion/page.tsx:1665` | p. ej. avisos@tuempresa.com | e.g. notices@yourcompany.com |
| `admin.correo.actualizar` | `app/(app)/(shell)/administracion/page.tsx:1678` | Actualizar | Update |
| `admin.correo.ayuda` | `app/(app)/(shell)/administracion/page.tsx:1683` | A esta dirección responden los avisos de operación que el sistema envía a tu equipo. Las contraseñas y las invitaciones no salen de aquí: esas las manda la plataforma. | Replies to the operations notices the system sends your team go to this address. Passwords and invitations don’t go out from here: the platform sends those. |
| `admin.correo.sin-correo` | `app/(app)/(shell)/administracion/page.tsx:1690` | Sin correo configurado, los avisos salen sin dirección de respuesta: quien los reciba no tendrá a quién contestarle. | With no email configured, notices go out without a reply-to address: whoever gets them won’t have anyone to reply to. |
| `admin.correo.modal.titulo` | `app/(app)/(shell)/administracion/page.tsx:1699` | Antes de guardar este correo | Before saving this email |
| `admin.correo.modal.subtitulo` | `app/(app)/(shell)/administracion/page.tsx:1700` | Cómo se va a usar la dirección que acabas de escribir | How the address you just typed will be used |
| `admin.correo.modal.entendido` | `app/(app)/(shell)/administracion/page.tsx:1707` | Entendido, guardar | Got it, save |
| `admin.correo.modal.no-desde` | `app/(app)/(shell)/administracion/page.tsx:1720` | Los avisos {noDesde} esta dirección: salen del servidor de correo de la plataforma, a nombre de {org}, y {respuestas}. En la bandeja de enviados de esta cuenta no vas a ver nada. | Notices {noDesde} this address: they go out from the platform’s mail server, on behalf of {org}, and {respuestas}. You won’t see anything in this account’s sent folder. |
| `admin.correo.modal.no-desde-palabras` | `app/(app)/(shell)/administracion/page.tsx:1721` | no se envían desde | are not sent from |
| `admin.correo.modal.tu-organizacion` | `app/(app)/(shell)/administracion/page.tsx:1722` | tu organización | your organization |
| `admin.correo.modal.respuestas` | `app/(app)/(shell)/administracion/page.tsx:1723` | las respuestas llegan aquí | replies arrive here |
| `admin.correo.modal.dns` | `app/(app)/(shell)/administracion/page.tsx:1731` | Es así porque para enviar desde tu propio dominio hace falta autorizarlo en los registros DNS de ese dominio. Sin esa autorización, un correo que dijera venir de tu dominio lo marcarían como suplantación y acabaría en spam. {avisanos} | That’s because sending from your own domain requires authorizing it in that domain’s DNS records. Without that authorization, an email claiming to come from your domain would be flagged as spoofing and end up in spam. {avisanos} |
| `admin.correo.modal.avisanos` | `app/(app)/(shell)/administracion/page.tsx:1731` | Si quieres que salgan desde tu dominio, avísanos y lo configuramos. | If you want them to go out from your domain, let us know and we’ll set it up. |
| `admin.correo.modal.afecta` | `app/(app)/(shell)/administracion/page.tsx:1738` | Afecta a los avisos de operación —hoy, el resumen diario de contratos que necesitan atención—. Las contraseñas y las invitaciones seguirán saliendo del correo de la plataforma. | It affects operations notices —today, the daily summary of contracts that need attention—. Passwords and invitations will keep going out from the platform’s email. |
| `admin.correo.modal.revisa` | `app/(app)/(shell)/administracion/page.tsx:1743` | Revisa que esté bien escrita: si la dirección no existe, las respuestas de tus clientes se pierden sin que nadie se entere. | Check that it’s spelled correctly: if the address doesn’t exist, your clients’ replies get lost without anyone noticing. |
| `admin.orgs.titulo` | `components/demo/admin/OrganizacionesPanel.tsx:75`<br>`components/demo/admin/OrganizacionesPanel.tsx:97` | Organizaciones (CRMs) | Organizations (CRMs) |
| `admin.orgs.reservado` | `components/demo/admin/OrganizacionesPanel.tsx:77` | Reservado al administrador de la plataforma | Reserved for the platform administrator |
| `admin.orgs.reservado-texto` | `components/demo/admin/OrganizacionesPanel.tsx:81` | Crear organizaciones y cambiar entre ellas está reservado al{admin}. Tu usuario administra su propia organización, no el conjunto. | Creating organizations and switching between them is reserved for the{admin}. Your user manages its own organization, not the whole set. |
| `admin.orgs.admin-plataforma` | `components/demo/admin/OrganizacionesPanel.tsx:82` | ␣administrador de la plataforma | ␣platform administrator |
| `admin.orgs.pidesela` | `components/demo/admin/OrganizacionesPanel.tsx:85` | Si necesitas una organización nueva, pídesela a quien administre Space OS. | If you need a new organization, ask whoever administers Space OS. |
| `admin.orgs.entrar` | `components/demo/admin/OrganizacionesPanel.tsx:135` | Entrar | Enter |
| `admin.orgs.sin-orgs` | `components/demo/admin/OrganizacionesPanel.tsx:142` | Sin organizaciones. | No organizations. |
| `admin.orgs.volver` | `components/demo/admin/OrganizacionesPanel.tsx:148` | Volver a mi CRM | Back to my CRM |
| `admin.orgs.error` | `components/demo/admin/OrganizacionesPanel.tsx:223`<br>`components/demo/admin/OrganizacionesPanel.tsx:229` | No se pudo crear la organización | The organization could not be created |
| `admin.orgs.nueva` | `components/demo/admin/OrganizacionesPanel.tsx:241`<br>`components/demo/admin/OrganizacionesPanel.tsx:249` | Nueva organización | New organization |
| `admin.orgs.nombre` | `components/demo/admin/OrganizacionesPanel.tsx:250` | Nombre de la organización | Organization name |
| `admin.orgs.nombre-ejemplo` | `components/demo/admin/OrganizacionesPanel.tsx:251` | Mi Empresa SA de CV | My Company Inc. |
| `admin.orgs.nombre-dueno` | `components/demo/admin/OrganizacionesPanel.tsx:254` | Nombre del Dueño | Owner’s name |
| `admin.orgs.su-correo` | `components/demo/admin/OrganizacionesPanel.tsx:257` | Su correo | Their email |
| `admin.orgs.google.titulo` | `components/demo/admin/OrganizacionesPanel.tsx:266` | El Dueño entra con su cuenta de Google | The Owner signs in with their Google account |
| `admin.orgs.google.detalle` | `components/demo/admin/OrganizacionesPanel.tsx:268` | No tendrás que inventar ni enviarle ninguna contraseña. Su correo de Google debe ser el mismo que escribiste arriba. | You won’t have to make up or send them any password. Their Google email must be the same one you entered above. |
| `admin.orgs.contrasena-dueno` | `components/demo/admin/OrganizacionesPanel.tsx:277` | Contraseña del Dueño | Owner’s password |
| `admin.orgs.crear` | `components/demo/admin/OrganizacionesPanel.tsx:287` | Crear organización | Create organization |
| `admin.act.nunca` | `components/demo/admin/ActualizacionesPanel.tsx:171` | nunca | never |
| `admin.act.modo.automatica` | `components/demo/admin/ActualizacionesPanel.tsx:86` | Modo cambiado a automática | Mode changed to automatic |
| `admin.act.modo.aprobacion` | `components/demo/admin/ActualizacionesPanel.tsx:86` | Modo cambiado a con aprobación | Mode changed to with approval |
| `admin.act.error.modo` | `components/demo/admin/ActualizacionesPanel.tsx:88` | No se pudo cambiar el modo | The mode could not be changed |
| `admin.act.aprobada` | `components/demo/admin/ActualizacionesPanel.tsx:98` | Instalación aprobada: se instalará en los próximos minutos | Installation approved: it will be installed in the next few minutes |
| `admin.act.error.aprobar` | `components/demo/admin/ActualizacionesPanel.tsx:101` | No se pudo aprobar la instalación | The installation could not be approved |
| `admin.act.titulo` | `components/demo/admin/ActualizacionesPanel.tsx:112`<br>`components/demo/admin/ActualizacionesPanel.tsx:133` | Actualizaciones | Updates |
| `admin.act.reservado` | `components/demo/admin/ActualizacionesPanel.tsx:123` | Ver y decidir la actualización de esta instancia está reservado a quien tenga el permiso de {permiso}. Pídeselo a quien administre los roles y permisos de tu organización. | Viewing and deciding on this instance’s update is reserved for whoever has the {permiso} permission. Ask whoever manages your organization’s roles and permissions. |
| `admin.act.permiso` | `components/demo/admin/ActualizacionesPanel.tsx:123`<br>`components/demo/admin/TicketsPanel.tsx:145` | Administración → ver | Settings → view |
| `admin.act.error` | `components/demo/admin/ActualizacionesPanel.tsx:140` | No se pudo cargar el estado de la actualización. | The update status could not be loaded. |
| `admin.act.instalada` | `components/demo/admin/ActualizacionesPanel.tsx:158` | Instalada: | Installed: |
| `admin.act.disponible` | `components/demo/admin/ActualizacionesPanel.tsx:161` | Disponible: | Available: |
| `admin.act.migraciones` | `components/demo/admin/ActualizacionesPanel.tsx:168` | Migraciones: | Migrations: |
| `admin.act.comprobado` | `components/demo/admin/ActualizacionesPanel.tsx:171` | Comprobado: | Checked: |
| `admin.act.modo` | `components/demo/admin/ActualizacionesPanel.tsx:176` | Modo | Mode |
| `admin.act.con-aprobacion` | `components/demo/admin/ActualizacionesPanel.tsx:185` | Con aprobación | With approval |
| `admin.act.automatica` | `components/demo/admin/ActualizacionesPanel.tsx:194` | Automática | Automatic |
| `admin.act.modo-ayuda` | `components/demo/admin/ActualizacionesPanel.tsx:198` | Con aprobación, tú decides cuándo instalar. Automática la instala sola en la ventana de madrugada en cuanto se publica. | With approval, you decide when to install. Automatic installs it by itself in the overnight window as soon as it’s published. |
| `admin.act.instalar-version` | `components/demo/admin/ActualizacionesPanel.tsx:224`<br>`components/demo/admin/ActualizacionesPanel.tsx:236` | Instalar {version} | Install {version} |
| `admin.act.instalar` | `components/demo/admin/ActualizacionesPanel.tsx:239` | Instalar | Install |
| `admin.act.estado.sin-comprobar` | `components/demo/admin/actualizaciones-ui.ts:51` | Esta instancia todavía no se ha comprobado contra el registro: no se sabe si hay una versión nueva. | This instance hasn’t been checked against the registry yet: it’s not known whether there is a new version. |
| `admin.act.estado.sin-digest` | `components/demo/admin/actualizaciones-ui.ts:58` | Se comprobó contra el registro, pero el actualizador no pudo leer el digest de la imagen: no hay nada que aprobar y esta instancia no puede instalar una versión nueva hasta que se revise. Avisa a quien opera el servidor. | It was checked against the registry, but the updater could not read the image digest: there is nothing to approve, and this instance can’t install a new version until it’s looked into. Let whoever runs the server know. |
| `admin.act.estado.al-dia` | `components/demo/admin/actualizaciones-ui.ts:65` | Al día: corre {version}, la misma que hay disponible. | Up to date: running {version}, the same one that is available. |
| `admin.act.estado.la-instalada` | `components/demo/admin/actualizaciones-ui.ts:65` | la versión instalada | the installed version |
| `admin.act.estado.una-nueva` | `components/demo/admin/actualizaciones-ui.ts:69` | una versión nueva | a new version |
| `admin.act.estado.automatica` | `components/demo/admin/actualizaciones-ui.ts:74` | Hay {version} disponible. Se instalará sola en la próxima ventana automática, de madrugada ({hora}). | {version} is available. It will install by itself in the next automatic window, overnight ({hora}). |
| `admin.act.estado.otra-aprobada` | `components/demo/admin/actualizaciones-ui.ts:81` | Lo que aprobaste ya no es lo disponible: salió una versión más nueva, {version}. Aprueba de nuevo para instalarla. | What you approved is no longer what’s available: a newer version came out, {version}. Approve again to install it. |
| `admin.act.estado.aprobada` | `components/demo/admin/actualizaciones-ui.ts:88` | Aprobaste {version}: se instalará en los próximos minutos, o de madrugada ({hora}) a más tardar. | You approved {version}: it will be installed in the next few minutes, or overnight ({hora}) at the latest. |
| `admin.act.estado.esperando` | `components/demo/admin/actualizaciones-ui.ts:94` | Hay una versión nueva disponible: {version}. Esperando tu aprobación para instalarla. | A new version is available: {version}. Waiting for your approval to install it. |
| `admin.act.la-disponible` | `components/demo/admin/actualizaciones-ui.ts:110`<br>`components/demo/admin/actualizaciones-ui.ts:132`<br>`components/demo/admin/actualizaciones-ui.ts:140` | la versión disponible | the available version |
| `admin.act.mig.sin-contar` | `components/demo/admin/actualizaciones-ui.ts:114` | No se pudo contar cuántas migraciones trae | It couldn’t be counted how many migrations it brings |
| `admin.act.mig.ninguna` | `components/demo/admin/actualizaciones-ui.ts:116` | No trae migraciones pendientes | It brings no pending migrations |
| `admin.act.mig.uno` | `components/demo/admin/actualizaciones-ui.ts:117` | Trae {n} migración pendiente | It brings {n} pending migration |
| `admin.act.mig.otros` | `components/demo/admin/actualizaciones-ui.ts:117` | Trae {n} migraciones pendientes | It brings {n} pending migrations |
| `admin.act.confirmar` | `components/demo/admin/actualizaciones-ui.ts:119` | Vas a instalar {version}. {migraciones}.{sinNotas} El servicio se corta mientras dura la instalación. | You’re about to install {version}. {migraciones}.{sinNotas} The service goes down while the installation runs. |
| `admin.act.confirmar-sin-notas` | `components/demo/admin/actualizaciones-ui.ts:118` | ␣No llegaron sus notas: no sabes qué trae. | ␣Its notes didn’t arrive: you don’t know what it brings. |
| `admin.act.aviso-sin-notas` | `components/demo/admin/actualizaciones-ui.ts:133` | No llegaron las notas de {version}, así que aquí no puedes ver qué trae. Avisa a soporte antes de aprobarla: casi siempre es el actualizador del servidor, no la versión. | The notes for {version} didn’t arrive, so you can’t see here what it brings. Let support know before approving it: it’s almost always the server’s updater, not the version. |
| `admin.act.que-trae` | `components/demo/admin/actualizaciones-ui.ts:140` | Qué trae {version} | What {version} brings |
| `admin.tickets.estado.abierto` | `components/demo/admin/TicketsPanel.tsx:49` | Abierto | Open |
| `admin.tickets.estado.en-proceso` | `components/demo/admin/TicketsPanel.tsx:50` | En proceso | In progress |
| `admin.tickets.estado.resuelto` | `components/demo/admin/TicketsPanel.tsx:51` | Resuelto | Resolved |
| `admin.tickets.estado.cerrado` | `components/demo/admin/TicketsPanel.tsx:52` | Cerrado | Closed |
| `admin.tickets.prioridad.baja` | `components/demo/admin/TicketsPanel.tsx:61` | Baja | Low |
| `admin.tickets.prioridad.normal` | `components/demo/admin/TicketsPanel.tsx:62` | Normal | Normal priority |
| `admin.tickets.prioridad.alta` | `components/demo/admin/TicketsPanel.tsx:63` | Alta | High |
| `admin.tickets.prioridad.urgente` | `components/demo/admin/TicketsPanel.tsx:64` | Urgente | Urgent |
| `admin.tickets.toast.abierto` | `components/demo/admin/TicketsPanel.tsx:128` | Ticket abierto: {folio} | Ticket opened: {folio} |
| `admin.tickets.error.abrir` | `components/demo/admin/TicketsPanel.tsx:130` | No se pudo abrir el ticket | The ticket could not be opened |
| `admin.tickets.titulo` | `components/demo/admin/TicketsPanel.tsx:141`<br>`components/demo/admin/TicketsPanel.tsx:156` | Soporte | Support |
| `admin.tickets.reservado` | `components/demo/admin/TicketsPanel.tsx:145` | Ver y abrir tickets de soporte está reservado a quien tenga el permiso de {permiso}. Pídeselo a quien administre los roles y permisos de tu organización. | Viewing and opening support tickets is reserved for whoever has the {permiso} permission. Ask whoever manages your organization’s roles and permissions. |
| `admin.tickets.error` | `components/demo/admin/TicketsPanel.tsx:163` | No se pudieron cargar tus tickets de soporte. | Your support tickets could not be loaded. |
| `admin.tickets.nuevo` | `components/demo/admin/TicketsPanel.tsx:173` | Nuevo ticket | New ticket |
| `admin.tickets.asunto` | `components/demo/admin/TicketsPanel.tsx:177` | Asunto | Subject |
| `admin.tickets.cuerpo` | `components/demo/admin/TicketsPanel.tsx:180` | Cuéntanos qué pasa | Tell us what’s happening |
| `admin.tickets.prioridad` | `components/demo/admin/TicketsPanel.tsx:189` | Prioridad | Priority |
| `admin.tickets.abrir` | `components/demo/admin/TicketsPanel.tsx:207` | Abrir ticket | Open ticket |
| `admin.tickets.vacio` | `components/demo/admin/TicketsPanel.tsx:215` | Aquí verás tus tickets en cuanto abras el primero. | You’ll see your tickets here as soon as you open the first one. |
| `admin.tickets.respuesta` | `components/demo/admin/TicketsPanel.tsx:238` | Respuesta de AS OOH · {fecha} | Reply from AS OOH · {fecha} |
| `admin.tickets.esperando` | `components/demo/admin/TicketsPanel.tsx:243` | Esperando respuesta de AS OOH. | Waiting for a reply from AS OOH. |
| `admin.tickets.estado-ninguno` | `components/demo/admin/tickets-ui.ts:35` | Todavia no has abierto ningun ticket de soporte. | You haven’t opened any support tickets yet. |
| `admin.tickets.estado-esperando.uno` | `components/demo/admin/tickets-ui.ts:44` | Tienes {n} ticket esperando respuesta. | You have {n} ticket waiting for a reply. |
| `admin.tickets.estado-esperando.otros` | `components/demo/admin/tickets-ui.ts:44` | Tienes {n} tickets esperando respuesta. | You have {n} tickets waiting for a reply. |
| `admin.tickets.estado-todos` | `components/demo/admin/tickets-ui.ts:50` | Todos tus tickets estan contestados. | All your tickets have been answered. |
| `admin.novedades.sin-notas` | `components/demo/novedades/NotasDeVersion.tsx:44` | Esta versión no trae notas | This version has no notes |
| `admin.novedades.tipo.nuevo` | `components/demo/novedades/NotasDeVersion.tsx:37` | Nuevo | New |
| `admin.novedades.tipo.ajustado` | `components/demo/novedades/NotasDeVersion.tsx:38` | Ajustado | Adjusted |
| `admin.novedades.tipo.corregido` | `components/demo/novedades/NotasDeVersion.tsx:39` | Corregido | Fixed |
| `admin.novedades.titulo` | `app/(app)/(shell)/novedades/page.tsx:43` | Novedades | What’s new |
| `admin.novedades.subtitulo` | `app/(app)/(shell)/novedades/page.tsx:44` | Lo que trajo cada versión de SPACE OS, de la más nueva a la más vieja. | What each SPACE OS version brought, from newest to oldest. |
| `admin.novedades.version-instalada` | `app/(app)/(shell)/novedades/page.tsx:48` | Versión instalada: | Installed version: |
| `admin.novedades.error` | `app/(app)/(shell)/novedades/page.tsx:55` | No se pudieron cargar las novedades. | The release notes could not be loaded. |
| `admin.novedades.vacio` | `app/(app)/(shell)/novedades/page.tsx:59` | Todavía no hay notas de versión. | There are no release notes yet. |
| `admin.novedades.instalada` | `app/(app)/(shell)/novedades/page.tsx:81` | Instalada | Installed |
| `admin.novedades.n-nuevas.uno` | clave armada en el código (prefijo + valor) | {n} nueva | {n} new |
| `admin.novedades.n-nuevas.otros` | clave armada en el código (prefijo + valor) | {n} nuevas | {n} new |
| `admin.novedades.n-ajustes.uno` | clave armada en el código (prefijo + valor) | {n} ajuste | {n} adjustment |
| `admin.novedades.n-ajustes.otros` | clave armada en el código (prefijo + valor) | {n} ajustes | {n} adjustments |
| `admin.novedades.n-correcciones.uno` | clave armada en el código (prefijo + valor) | {n} corrección | {n} fix |
| `admin.novedades.n-correcciones.otros` | clave armada en el código (prefijo + valor) | {n} correcciones | {n} fixes |
| `admin.cuenta.titulo` | `app/(app)/(shell)/configuracion/page.tsx:46` | Configuración | Configuration |
| `admin.cuenta.sub.empresa` | `app/(app)/(shell)/configuracion/page.tsx:48` | Nombre de la empresa y datos de tu cuenta. | Company name and your account details. |
| `admin.cuenta.sub.cuenta` | `app/(app)/(shell)/configuracion/page.tsx:48` | Cambia el correo y la contraseña de tu cuenta. | Change your account’s email and password. |
| `admin.cuenta.temporal` | `app/(app)/(shell)/configuracion/page.tsx:59` | {tuContrasena} Cámbiala aquí abajo para volver a entrar al resto del sistema. Mientras tanto los demás módulos están cerrados, por seguridad: una contraseña temporal la conoce quien te la entregó. | {tuContrasena} Change it below to get back into the rest of the system. In the meantime the other modules are closed, for security: a temporary password is known by whoever gave it to you. |
| `admin.cuenta.temporal-negrita` | `app/(app)/(shell)/configuracion/page.tsx:59` | Tu contraseña es temporal. | Your password is temporary. |
| `admin.cuenta.empresa.toast` | `app/(app)/(shell)/configuracion/page.tsx:96` | Nombre de la empresa actualizado | Company name updated |
| `admin.cuenta.error` | `app/(app)/(shell)/configuracion/page.tsx:98`<br>`app/(app)/(shell)/configuracion/page.tsx:192` | Error | Error |
| `admin.cuenta.empresa.titulo` | `app/(app)/(shell)/configuracion/page.tsx:108` | Empresa | Company |
| `admin.cuenta.empresa.ayuda` | `app/(app)/(shell)/configuracion/page.tsx:113` | Este nombre aparece en el menú de la izquierda. También se cambia en {enlace}, junto con el logo y los datos fiscales. | This name appears in the menu on the left. It can also be changed in {enlace}, along with the logo and the tax details. |
| `admin.cuenta.empresa.enlace` | `app/(app)/(shell)/configuracion/page.tsx:116` | Administración → Configuración | Settings → Configuration |
| `admin.cuenta.corta` | `app/(app)/(shell)/configuracion/page.tsx:164` | La contraseña debe tener al menos 8 caracteres | The password must be at least 8 characters long |
| `admin.cuenta.toast` | `app/(app)/(shell)/configuracion/page.tsx:190` | Cuenta actualizada | Account updated |
| `admin.cuenta.mi-cuenta` | `app/(app)/(shell)/configuracion/page.tsx:203` | Mi cuenta | My account |
| `admin.cuenta.con-google` | `app/(app)/(shell)/configuracion/page.tsx:214` | Entraste con Google | You signed in with Google |
| `admin.cuenta.con-contrasena` | `app/(app)/(shell)/configuracion/page.tsx:214` | Entraste con contraseña | You signed in with a password |
| `admin.cuenta.ayuda` | `app/(app)/(shell)/configuracion/page.tsx:218` | Cambia tu correo y/o contraseña. Solo afecta a tu cuenta. | Change your email and/or password. It only affects your account. |
| `admin.cuenta.correo` | `app/(app)/(shell)/configuracion/page.tsx:220` | Correo | Email |
| `admin.cuenta.correo-ejemplo` | `app/(app)/(shell)/configuracion/page.tsx:221` | tu@correo.com | you@email.com |
| `admin.cuenta.nueva` | `app/(app)/(shell)/configuracion/page.tsx:223` | Nueva contraseña | New password |
| `admin.cuenta.nueva-ayuda` | `app/(app)/(shell)/configuracion/page.tsx:224` | Déjala en blanco para no cambiarla (mín. 8) | Leave it blank to keep it (at least 8) |
| `admin.cuenta.sin-anterior` | `app/(app)/(shell)/configuracion/page.tsx:229` | Entraste con Google y aún no tienes contraseña propia, así que no hace falta la anterior. Al guardarla podrás usarla también para confirmar cambios sensibles. | You signed in with Google and don’t have a password of your own yet, so the previous one isn’t needed. Once saved, you can also use it to confirm sensitive changes. |
| `admin.cuenta.actual` | `app/(app)/(shell)/configuracion/page.tsx:234` | Contraseña actual | Current password |
| `admin.cuenta.para-confirmar` | `app/(app)/(shell)/configuracion/page.tsx:234` | (para confirmar) | (to confirm) |
| `admin.cuenta.actual-ejemplo` | `app/(app)/(shell)/configuracion/page.tsx:238` | Tu contraseña actual | Your current password |
| `admin.cuenta.guardar-cambios` | `app/(app)/(shell)/configuracion/page.tsx:242` | Guardar cambios | Save changes |
| `admin.integ.titulo` | `app/(app)/(shell)/integraciones/page.tsx:56` | Integraciones | Integrations |
| `admin.integ.subtitulo` | `app/(app)/(shell)/integraciones/page.tsx:57` | Conectores externos · listos para enchufar credenciales | External connectors · ready to plug in credentials |
| `admin.integ.aviso` | `app/(app)/(shell)/integraciones/page.tsx:68` | Hay conectores sin credenciales: devuelven datos {simulados} hasta que se configuren en el servidor. | Some connectors have no credentials: they return {simulados} data until they’re configured on the server. |
| `admin.integ.simulados` | `app/(app)/(shell)/integraciones/page.tsx:68` | simulados | simulated |
| `admin.integ.conectores` | `app/(app)/(shell)/integraciones/page.tsx:77` | Conectores | Connectors |
| `admin.integ.conectados.uno` | `app/(app)/(shell)/integraciones/page.tsx:82` | {cifras} conectado | {cifras} connected |
| `admin.integ.conectados.otros` | `app/(app)/(shell)/integraciones/page.tsx:82` | {cifras} conectados | {cifras} connected |
| `admin.integ.sin-credenciales-n` | `app/(app)/(shell)/integraciones/page.tsx:87` | {n} sin credenciales | {n} without credentials |
| `admin.integ.vacio` | `app/(app)/(shell)/integraciones/page.tsx:100` | No hay conectores que mostrar | There are no connectors to show |
| `admin.integ.vacio-detalle` | `app/(app)/(shell)/integraciones/page.tsx:101` | Si esperabas verlos, puede que la consulta haya fallado: recarga la página. | If you expected to see them, the request may have failed: reload the page. |
| `admin.integ.conectado` | `app/(app)/(shell)/integraciones/page.tsx:118` | Conectado | Connected |
| `admin.integ.sin-credenciales` | `app/(app)/(shell)/integraciones/page.tsx:118` | Sin credenciales | No credentials |
| `admin.integ.cargadas` | `app/(app)/(shell)/integraciones/page.tsx:124` | Credenciales cargadas · responde el proveedor real. | Credentials loaded · the real provider responds. |
| `admin.integ.simula` | `app/(app)/(shell)/integraciones/page.tsx:125` | Devuelve datos simulados. | Returns simulated data. |
| `admin.integ.probar` | `app/(app)/(shell)/integraciones/page.tsx:140` | Probar AdMobilize | Test AdMobilize |
| `admin.integ.probar-sub` | `app/(app)/(shell)/integraciones/page.tsx:142` | Diagnóstico · devuelve datos simulados sin credenciales | Diagnostics · returns simulated data without credentials |
| `admin.integ.dispositivo` | `app/(app)/(shell)/integraciones/page.tsx:147` | ID del dispositivo | Device ID |
| `admin.integ.consultando` | `app/(app)/(shell)/integraciones/page.tsx:155` | Consultando… | Querying… |
| `admin.integ.consultar` | `app/(app)/(shell)/integraciones/page.tsx:155` | Consultar métricas | Query metrics |
| `admin.integ.vehiculos` | `app/(app)/(shell)/integraciones/page.tsx:160` | Vehículos | Vehicles |
| `admin.integ.personas` | `app/(app)/(shell)/integraciones/page.tsx:161` | Personas | People |
| `admin.integ.velocidad` | `app/(app)/(shell)/integraciones/page.tsx:162` | Vel. prom. | Avg. speed |
| `admin.integ.ventana` | `app/(app)/(shell)/integraciones/page.tsx:163` | Ventana | Window |
| `admin.integ.datos-simulados` | `app/(app)/(shell)/integraciones/page.tsx:166` | Datos simulados (sin credenciales) | Simulated data (no credentials) |
| `admin.integ.donde` | `app/(app)/(shell)/integraciones/page.tsx:176` | Dónde está lo demás | Where everything else is |
| `admin.integ.donde.doohmain` | `app/(app)/(shell)/integraciones/page.tsx:204` | Publicación en DOOHmain | Publishing to DOOHmain |
| `admin.integ.donde.doohmain-detalle` | `app/(app)/(shell)/integraciones/page.tsx:204` | Desde la ficha de cada campaña | From each campaign’s profile |
| `admin.integ.donde.cms` | `app/(app)/(shell)/integraciones/page.tsx:205` | CMS de cada pantalla | Each screen’s CMS |
| `admin.integ.donde.cms-detalle` | `app/(app)/(shell)/integraciones/page.tsx:205` | En Network, pantalla por pantalla | In Network, screen by screen |
| `admin.integ.donde.actualizaciones` | `app/(app)/(shell)/integraciones/page.tsx:206` | Actualizaciones de SPACE OS | SPACE OS updates |
| `admin.integ.donde.actualizaciones-detalle` | `app/(app)/(shell)/integraciones/page.tsx:206` | En Administración → Configuración → Instancia | In Settings → Configuration → Instance |
| `admin.network.cms-otros` | `app/(app)/(shell)/network/page.tsx:38` | Otros | Other |
| `admin.network.subtitulo` | `app/(app)/(shell)/network/page.tsx:68` | Inventario sin vender compartible a la Network · decides qué espacios incluir | Unsold inventory that can be shared to the Network · you decide which spaces to include |
| `admin.network.indicadores` | `app/(app)/(shell)/network/page.tsx:76` | Indicadores | Indicators |
| `admin.network.en-network` | `app/(app)/(shell)/network/page.tsx:84`<br>`app/(app)/(shell)/network/page.tsx:129` | En la Network | On the Network |
| `admin.network.de-espacios` | `app/(app)/(shell)/network/page.tsx:84` | de {total} espacios | of {total} spaces |
| `admin.network.sin-compartir` | `app/(app)/(shell)/network/page.tsx:85`<br>`app/(app)/(shell)/network/page.tsx:132` | Sin compartir | Not shared |
| `admin.network.disponibles` | `app/(app)/(shell)/network/page.tsx:85` | disponibles para la Network | available for the Network |
| `admin.network.programaticos` | `app/(app)/(shell)/network/page.tsx:86` | Programáticos | Programmatic |
| `admin.network.automatizada` | `app/(app)/(shell)/network/page.tsx:86` | venta automatizada | automated sales |
| `admin.network.tradicionales` | `app/(app)/(shell)/network/page.tsx:87` | Tradicionales | Traditional |
| `admin.network.directa` | `app/(app)/(shell)/network/page.tsx:87` | venta directa | direct sales |
| `admin.network.cms-en` | `app/(app)/(shell)/network/page.tsx:98` | CMS en la Network: | CMS on the Network: |
| `admin.network.ninguno` | `app/(app)/(shell)/network/page.tsx:100` | — ningún espacio digital compartido aún. | — no digital space shared yet. |
| `admin.network.reglas` | `app/(app)/(shell)/network/page.tsx:114` | Reglas de comercialización por pantalla | Sales rules by screen |
| `admin.network.todas` | `app/(app)/(shell)/network/page.tsx:126` | Todas | All |
| `admin.network.programatico` | `app/(app)/(shell)/network/page.tsx:137`<br>`app/(app)/(shell)/network/page.tsx:172` | Programático | Programmatic |
| `admin.network.tradicional` | `app/(app)/(shell)/network/page.tsx:140`<br>`app/(app)/(shell)/network/page.tsx:174` | Tradicional | Traditional |
| `admin.network.col.pantalla` | `app/(app)/(shell)/network/page.tsx:148`<br>`app/(app)/(shell)/network/page.tsx:251` | Pantalla | Screen |
| `admin.network.col.comercializacion` | `app/(app)/(shell)/network/page.tsx:149` | Comercialización | Sales model |
| `admin.network.col.estatus` | `app/(app)/(shell)/network/page.tsx:151` | Estatus | Status |
| `admin.network.col.en-network` | `app/(app)/(shell)/network/page.tsx:152` | En Network | On the Network |
| `admin.network.ninguna` | `app/(app)/(shell)/network/page.tsx:159` | Ninguna pantalla coincide con el filtro. | No screen matches the filter. |
| `admin.network.compartir` | `app/(app)/(shell)/network/page.tsx:192` | Compartir {nombre} a la Network | Share {nombre} to the Network |
| `admin.network.toast.quitada` | `app/(app)/(shell)/network/page.tsx:195` | {nombre} quitada de la Network | {nombre} removed from the Network |
| `admin.network.toast.compartida` | `app/(app)/(shell)/network/page.tsx:195` | {nombre} compartida a la Network | {nombre} shared to the Network |
| `admin.network.compartida` | `app/(app)/(shell)/network/page.tsx:205` | Compartida | Shared |
| `admin.network.no` | `app/(app)/(shell)/network/page.tsx:205` | No | No |
| `admin.network.red` | `app/(app)/(shell)/network/page.tsx:223` | Red de pantallas · toda la plataforma | Screen network · the whole platform |
| `admin.network.red-sub` | `app/(app)/(shell)/network/page.tsx:224` | Catálogo de todas las pantallas registradas. Solo el operador dueño puede editarlas. | Catalog of every registered screen. Only the owning operator can edit them. |
| `admin.network.red-vacia` | `app/(app)/(shell)/network/page.tsx:232` | Aún no hay pantallas en la red. | There are no screens in the network yet. |
| `admin.network.todas-tuyas` | `app/(app)/(shell)/network/page.tsx:237` | Todas las pantallas de la red son tuyas ({n}); aquí aparecerán las de otros operadores. | All the screens in the network are yours ({n}); other operators’ screens will appear here. |
| `admin.network.ver-todas` | `app/(app)/(shell)/network/page.tsx:243` | Ver todas ({n}) → | See all ({n}) → |
| `admin.network.col.operador` | `app/(app)/(shell)/network/page.tsx:252` | Operador | Operator |
| `admin.network.col.tipo` | `app/(app)/(shell)/network/page.tsx:253` | Tipo | Type |
| `admin.network.col.ubicacion` | `app/(app)/(shell)/network/page.tsx:254` | Ubicación | Location |
| `admin.network.col.tarifa` | `app/(app)/(shell)/network/page.tsx:255` | Tarifa | Rate |
| `admin.network.tuya` | `app/(app)/(shell)/network/page.tsx:267` | Tuya | Yours |
| `admin.network.otro-operador` | `app/(app)/(shell)/network/page.tsx:269` | Otro operador | Another operator |
| `admin.actividad.titulo` | `app/(app)/(shell)/actividad/page.tsx:65` | Actividad | Activity log |
| `admin.actividad.subtitulo` | `app/(app)/(shell)/actividad/page.tsx:67` | Bitácora de acciones · quién hizo qué y cuándo | Log of actions · who did what and when |
| `admin.actividad.registro` | `app/(app)/(shell)/actividad/page.tsx:81` | Registro de acciones | Action log |
| `admin.actividad.fecha` | `app/(app)/(shell)/actividad/page.tsx:94` | Fecha | Date |
| `admin.actividad.hora` | `app/(app)/(shell)/actividad/page.tsx:98` | Hora | Time |
| `admin.actividad.toda-hora` | `app/(app)/(shell)/actividad/page.tsx:100` | Toda hora | Any time |
| `admin.actividad.quien` | `app/(app)/(shell)/actividad/page.tsx:107` | Quién | Who |
| `admin.actividad.todos` | `app/(app)/(shell)/actividad/page.tsx:109` | Todos | All |
| `admin.actividad.limpiar` | `app/(app)/(shell)/actividad/page.tsx:119` | Limpiar | Clear |
| `admin.actividad.vacio` | `app/(app)/(shell)/actividad/page.tsx:133` | Sin actividad todavía | No activity yet |
| `admin.actividad.vacio-detalle` | `app/(app)/(shell)/actividad/page.tsx:134` | Las acciones (reservar, confirmar, cerrar OT, facturar…) aparecerán aquí con su usuario y fecha. | Actions (booking, confirming, closing work orders, invoicing…) will show up here with their user and date. |
| `admin.actividad.sin-coincidencias` | `app/(app)/(shell)/actividad/page.tsx:140` | Ninguna acción coincide con los filtros. | No action matches the filters. |
| `admin.actividad.limpiar-filtros` | `app/(app)/(shell)/actividad/page.tsx:144` | Limpiar filtros | Clear filters |
| `admin.actividad.acciones` | `app/(app)/(shell)/actividad/page.tsx:190` | acciones | actions |
| `admin.actividad.hoy` | `app/(app)/(shell)/actividad/page.tsx:162` | Hoy | Today |
| `admin.actividad.ayer` | `app/(app)/(shell)/actividad/page.tsx:162` | Ayer | Yesterday |
| `admin.razones.sin-acceso` | `app/(app)/(shell)/razones-sociales/page.tsx:69` | Tu rol no tiene acceso a la administración de la organización. | Your role doesn’t have access to the organization’s administration. |
| `admin.razones.error` | `app/(app)/(shell)/razones-sociales/page.tsx:70`<br>`app/(app)/(shell)/razones-sociales/page.tsx:77` | No se pudieron cargar las razones sociales | The legal entities could not be loaded |
| `admin.razones.titulo` | `app/(app)/(shell)/razones-sociales/page.tsx:92`<br>`components/demo/razones-sociales/GestionEntidadesFiscales.tsx:335` | Razones sociales | Legal entities |
| `admin.razones.subtitulo` | `app/(app)/(shell)/razones-sociales/page.tsx:94` | Las de tu empresa · con cuál pagas las rentas, compras los activos, tramitas licencias y vendes | Your company’s · which one pays the rents, buys the assets, handles permits and sells |
| `admin.razones.toast.agregada` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:158` | Razón social agregada | Legal entity added |
| `admin.razones.toast.actualizada` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:161` | Razón social actualizada | Legal entity updated |
| `admin.razones.toast.baja` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:178` | Razón social dada de baja · los documentos que la nombran se conservan | Legal entity deactivated · the documents that name it are kept |
| `admin.razones.error.baja` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:181` | No se pudo dar de baja | Could not deactivate |
| `admin.razones.toast.reactivada` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:191` | Razón social reactivada | Legal entity reactivated |
| `admin.razones.error.reactivar` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:194` | No se pudo reactivar | Could not reactivate |
| `admin.razones.razon-social` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:205` | Razón social | Legal name |
| `admin.razones.razon-ejemplo` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:210` | Denominación fiscal, como aparece en la constancia | Registered name, as it appears on the tax certificate |
| `admin.razones.regimen` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:223` | Régimen fiscal | Tax regime |
| `admin.razones.cp` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:232` | CP fiscal | Tax ZIP code |
| `admin.razones.serie` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:241` | Serie de folios | Invoice series |
| `admin.razones.papel` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:256` | Qué papel juega esta razón social | What role this legal entity plays |
| `admin.razones.sin-papel-ok` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:283` | Sin ningún papel también se guarda: cuál juega se puede decidir después. | It can be saved with no role too: which one it plays can be decided later. |
| `admin.razones.huerfanos` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:312` | Ninguna razón social activa tiene {papeles}. Los documentos de ese tipo van a nacer sin razón social hasta que se lo asignes a alguna. | No active legal entity has {papeles}. Documents of that type will be created without a legal entity until you assign it to one. |
| `admin.razones.compartidos` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:320` | {papeles} lo tienen dos o más. Cuando hay varias con el mismo papel el sistema no propone ninguna, así que habrá que elegirla a mano en cada contrato o comprobante. | {papeles} is held by two or more. When several share the same role the system doesn’t suggest any, so it has to be chosen by hand on each contract or receipt. |
| `admin.razones.n-activas.uno` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:339` | {n} activa | {n} active |
| `admin.razones.n-activas.otros` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:339` | {n} activas | {n} active |
| `admin.razones.de-baja` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:340` | {n} de baja | {n} deactivated |
| `admin.razones.n-avisos.uno` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:343` | {n} aviso | {n} warning |
| `admin.razones.n-avisos.otros` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:343` | {n} avisos | {n} warnings |
| `admin.razones.nueva` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:349`<br>`components/demo/razones-sociales/GestionEntidadesFiscales.tsx:367` | Nueva razón social | New legal entity |
| `admin.razones.vacio` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:360` | Todavía no hay ninguna razón social registrada. | No legal entity has been registered yet. |
| `admin.razones.vacio-detalle` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:361` | Es la identidad fiscal del negocio: con cuál pagas las rentas, con cuál compras los activos, con cuál tramitas licencias y con cuál vendes. Pueden ser varias, y es lo normal. | It’s the business’s tax identity: which one pays the rents, which one buys the assets, which one handles permits and which one sells. There can be several, and that’s normal. |
| `admin.razones.cuestionario` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:371` | Si prefieres capturarlas contestando tres preguntas, el {enlace} las crea de una vez con sus papeles. | If you’d rather enter them by answering three questions, the {enlace} creates them all at once with their roles. |
| `admin.razones.cuestionario-enlace` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:374` | cuestionario de bienvenida | welcome questionnaire |
| `admin.razones.principal-title` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:403` | Sale en contratos y en el Dashboard · se cambia en Administración → Configuración | Shown on contracts and on the Dashboard · changed in Settings → Configuration |
| `admin.razones.principal` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:404` | Principal | Main |
| `admin.razones.dada-de-baja` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:407` | Dada de baja | Deactivated |
| `admin.razones.sin-rfc` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:410` | sin RFC | no RFC |
| `admin.razones.cp-n` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:412` | ␣· CP {cp} | ␣· ZIP {cp} |
| `admin.razones.serie-n` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:413` | ␣· serie {serie} | ␣· series {serie} |
| `admin.razones.sin-papel` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:417` | Sin papel asignado | No role assigned |
| `admin.razones.editar` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:433` | Editar | Edit |
| `admin.razones.reactivar` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:442` | Reactivar | Reactivate |
| `admin.razones.dar-de-baja` | `components/demo/razones-sociales/GestionEntidadesFiscales.tsx:451` | Dar de baja | Deactivate |
| `admin.razones.falta.nombre` | `components/demo/razones-sociales/gestion.ts:80` | Captura la razon social: es el nombre con el que la empresa firma y factura. | Enter the legal name: it’s the name the company signs and invoices with. |
| `admin.razones.falta.largo` | `components/demo/razones-sociales/gestion.ts:82` | La razon social no puede pasar de {n} caracteres. | The legal name can’t be longer than {n} characters. |
| `admin.razones.falta.baja` | `components/demo/razones-sociales/gestion.ts:104` | Ya tienes «{nombre}», que es la misma razon social y esta dada de baja. Reactivala en vez de crear otra. | You already have “{nombre}”, which is the same legal entity and is deactivated. Reactivate it instead of creating another one. |
| `admin.razones.falta.duplicada` | `components/demo/razones-sociales/gestion.ts:105` | Ya tienes «{nombre}», que es la misma razon social escrita de otra forma. | You already have “{nombre}”, which is the same legal entity written differently. |
| `admin.razones.falta.rfc` | `components/demo/razones-sociales/gestion.ts:113` | El RFC «{rfc}» no tiene una forma valida. Dejalo vacio si todavia no lo tienes. | The RFC “{rfc}” doesn’t have a valid format. Leave it empty if you don’t have it yet. |
| `admin.razones.falta.papel` | `components/demo/razones-sociales/gestion.ts:127` | El papel «{papel}» no existe. Los que hay son: {validos}. | The role “{papel}” doesn’t exist. The available ones are: {validos}. |

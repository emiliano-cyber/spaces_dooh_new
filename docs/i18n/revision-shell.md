# Tabla de revisión · lote de inglés «shell (ámbito `shell`)»

Generada el 2026-11-02 a partir de `apps/web/lib/i18n/textos/shell.ts` y de los usos en el código
(búsqueda literal de la clave). **58 claves.** Rama `feat/ingles-administracion`.

**Pantallas:** Los layouts (la descripción de la página), el 404, el error global, el `_error` del Pages Router, la barra superior, el candado de cambios, la campanita, la banda de la licencia, las novedades de la versión, el error de carga, el módulo en construcción, y las piezas compartidas `ConfirmDialog`, `FotoUploaderMock`, `PipelineView` y `disponibilidadInventario` (`StatusBadge.tsx`).

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
| `shell.meta.descripcion` | `app/layout.tsx:19`<br>`app/(app)/layout.tsx:63` | Gestión de espacios publicitarios DOOH | DOOH advertising space management |
| `shell.404.titulo` | `app/not-found.tsx:49` | Esta página no existe | This page doesn’t exist |
| `shell.404.detalle` | `app/not-found.tsx:51` | La dirección es incorrecta o el registro que buscas ya no está disponible. | The address is wrong or the record you’re looking for is no longer available. |
| `shell.404.otra-seccion` | `app/not-found.tsx:54`<br>`app/not-found.tsx:56` | Ir a otra sección | Go to another section |
| `shell.404.volver` | `app/not-found.tsx:84` | Volver al inicio | Back to home |
| `shell.error-global.titulo` | `app/global-error.tsx:54` | El sistema no está disponible en este momento | The system is not available right now |
| `shell.error-global.detalle` | `app/global-error.tsx:56` | No pudimos conectar con la base de datos. Tus datos no se han perdido: vuelve a intentarlo en unos minutos. Si sigue igual, avisa a quien administra el sistema. | We couldn’t connect to the database. Your data has not been lost: please try again in a few minutes. If it keeps happening, tell whoever manages the system. |
| `shell.error-global.reintentar` | `app/global-error.tsx:70` | Intentar de nuevo | Try again |
| `shell.error.no-encontrada` | `pages/_error.tsx:57` | Página no encontrada | Page not found |
| `shell.error.servidor` | `pages/_error.tsx:57` | Error del servidor | Server error |
| `shell.error.volver` | `pages/_error.tsx:60` | ← Volver al inicio | ← Back to home |
| `shell.topbar.abrir-menu` | `components/demo/shell/Topbar.tsx:45` | Abrir menú | Open menu |
| `shell.topbar.cerrar-menu` | `components/demo/shell/Topbar.tsx:45` | Cerrar menú | Close menu |
| `shell.topbar.vista-de` | `components/demo/shell/Topbar.tsx:53` | Vista de {rol} | Viewing as {rol} |
| `shell.topbar.notificaciones` | `components/demo/shell/Topbar.tsx:70`<br>`components/demo/shell/Topbar.tsx:88` | Notificaciones | Notifications |
| `shell.topbar.borrar-todas` | `components/demo/shell/Topbar.tsx:101` | Borrar todas | Clear all |
| `shell.topbar.sin-notificaciones` | `components/demo/shell/Topbar.tsx:107` | Sin notificaciones | No notifications |
| `shell.topbar.cuenta` | `components/demo/shell/Topbar.tsx:133` | Cuenta | Account |
| `shell.topbar.configuracion` | `components/demo/shell/Topbar.tsx:156` | Configuración | Configuration |
| `shell.topbar.codigos` | `components/demo/shell/Topbar.tsx:169` | Códigos de recuperación | Recovery codes |
| `shell.topbar.cerrar-sesion` | `components/demo/shell/Topbar.tsx:176` | Cerrar sesión | Sign out |
| `shell.notificacion.borrar-aria` | `components/demo/shell/ItemNotificacion.tsx:65` | Borrar la notificación {titulo} | Delete the notification {titulo} |
| `shell.notificacion.borrar-title` | `components/demo/shell/ItemNotificacion.tsx:66` | Borrar esta notificación | Delete this notification |
| `shell.candado.title.abierto` | `components/demo/shell/DesbloqueoCambios.tsx:91` | Cambios desbloqueados {min} min más · clic para bloquear | Changes unlocked for {min} more min · click to lock |
| `shell.candado.title.cerrado` | `components/demo/shell/DesbloqueoCambios.tsx:92` | Los cambios de dinero y catálogo necesitan una contraseña | Changes to money and the catalog need a password |
| `shell.candado.abierto` | `components/demo/shell/DesbloqueoCambios.tsx:102` | Desbloqueado {min} min | Unlocked for {min} min |
| `shell.candado.cerrado` | `components/demo/shell/DesbloqueoCambios.tsx:102` | Cambios bloqueados | Changes locked |
| `shell.candado.titulo` | `components/demo/shell/DesbloqueoCambios.tsx:108` | Desbloquear cambios | Unlock changes |
| `shell.candado.subtitulo` | `components/demo/shell/DesbloqueoCambios.tsx:109` | Tu contraseña, o la del control de cambios | Your password, or the change-control password |
| `shell.candado.explicacion` | `components/demo/shell/DesbloqueoCambios.tsx:121` | Los cambios que mueven dinero o el catálogo —tarifas, rentas, contratos, pagos, facturación y borrados— necesitan una contraseña. Sirve {propia}, o la contraseña del control de cambios que haya asignado el Dueño. Al teclear cualquiera de las dos quedas desbloqueado un rato y no te la vuelve a pedir. | Changes that move money or the catalog (rates, rents, contracts, payments, invoicing and deletions) need a password. Either {propia} works, or the change-control password the Owner assigned. Typing either one unlocks you for a while, and you won’t be asked again. |
| `shell.candado.explicacion.propia` | `components/demo/shell/DesbloqueoCambios.tsx:121` | tu propia contraseña de acceso | your own sign-in password |
| `shell.candado.contrasena` | `components/demo/shell/DesbloqueoCambios.tsx:124` | Contraseña | Password |
| `shell.candado.desbloquear` | `components/demo/shell/DesbloqueoCambios.tsx:114` | Desbloquear | Unlock |
| `shell.candado.error` | `components/demo/shell/DesbloqueoCambios.tsx:74` | No se pudo desbloquear | Could not unlock |
| `shell.licencia.gracia` | `components/demo/shell/BandaLicencia.tsx:41` | Tu licencia de SPACE OS venció el {vence}. El sistema dejará de funcionar el {finGracia}. | Your SPACE OS license expired on {vence}. The system will stop working on {finGracia}. |
| `shell.licencia.aviso` | `components/demo/shell/BandaLicencia.tsx:44` | Tu licencia de SPACE OS vence el {vence}. | Your SPACE OS license expires on {vence}. |
| `shell.licencia.renovar` | `components/demo/shell/BandaLicencia.tsx:46` | Para renovarla, contacta con tu proveedor. | To renew it, contact your provider. |
| `shell.novedades.titulo` | `components/demo/shell/NovedadesDeVersion.tsx:94` | Qué hay de nuevo en {version} | What’s new in {version} |
| `shell.novedades.subtitulo` | `components/demo/shell/NovedadesDeVersion.tsx:95` | Esta instancia se actualizó. Esto es lo que cambió ({fecha}). | This instance was updated. Here’s what changed ({fecha}). |
| `shell.novedades.ver-todas` | `components/demo/shell/NovedadesDeVersion.tsx:107` | Ver todas las novedades | See all release notes |
| `shell.novedades.entendido` | `components/demo/shell/NovedadesDeVersion.tsx:111` | Entendido | Got it |
| `shell.carga.titulo` | `components/demo/shell/AuthGate.tsx:50` | No se pudieron cargar los datos | The data could not be loaded |
| `shell.carga.detalle` | `components/demo/shell/AuthGate.tsx:52` | La información no llegó del servidor. No es que no existan datos: no se pudieron leer. | The information didn’t arrive from the server. It’s not that there is no data: it couldn’t be read. |
| `shell.carga.reintentar` | `components/demo/shell/AuthGate.tsx:60` | Reintentar | Retry |
| `shell.carga.reintentando` | `components/demo/shell/AuthGate.tsx:60` | Reintentando… | Retrying… |
| `shell.placeholder.titulo` | `components/demo/shell/ModuloPlaceholder.tsx:29` | Módulo en construcción ({fase}) | Module under construction ({fase}) |
| `shell.placeholder.detalle` | `components/demo/shell/ModuloPlaceholder.tsx:30` | Los cimientos y la capa de datos ya están listos; esta pantalla se arma en la fase indicada. | The foundations and the data layer are ready; this screen is built in the phase shown. |
| `shell.confirmar.confirmar` | `components/demo/ui/ConfirmDialog.tsx:51` | Confirmar | Confirm |
| `shell.confirmar.procesando` | `components/demo/ui/ConfirmDialog.tsx:83` | Procesando… | Processing… |
| `shell.confirmar.escribe` | `components/demo/ui/ConfirmDialog.tsx:103` | Escribe {texto} para confirmar | Type {texto} to confirm |
| `shell.fotos.agregar` | `components/demo/FotoUploaderMock.tsx:34` | Agregar foto | Add photo |
| `shell.fotos.alt` | `components/demo/FotoUploaderMock.tsx:93` | evidencia | evidence |
| `shell.fotos.quitar` | `components/demo/FotoUploaderMock.tsx:98` | Quitar foto | Remove photo |
| `shell.fotos.cargando.uno` | `components/demo/FotoUploaderMock.tsx:132` | Cargando foto… | Loading photo… |
| `shell.fotos.cargando.otros` | `components/demo/FotoUploaderMock.tsx:132` | Cargando {n} fotos… | Loading {n} photos… |
| `shell.disponibilidad.sin-capturar` | `components/demo/StatusBadge.tsx:123` | Sin slots capturados | No slots entered |
| `shell.disponibilidad.sin-libres` | `components/demo/StatusBadge.tsx:125` | Sin slots libres | No free slots |
| `shell.disponibilidad.libres` | `components/demo/StatusBadge.tsx:127` | {libres} de {total} libres | {libres} of {total} free |

// ============================================================================
//  lib/i18n/textos/shell.ts — LOS TEXTOS DEL AMBITO «shell».
// ----------------------------------------------------------------------------
//  Lote «administracion, cuenta y shell» de la version en ingles (2026-11-02).
//  Mismas reglas que los demas archivos de `textos/`: claves en espanol con el
//  prefijo `shell.`, espanol LITERAL (copiado del componente letra por letra),
//  `EN_SHELL` como `Record` (una clave que falte no compila), ni dinero ni
//  moneda, frases con negritas ENTERAS y con huecos (`interpolarNodos`).
//
//  Cubre lo que rodea a TODAS las pantallas: el 404, la pagina de error global
//  (sin proveedor de idioma), el `_error` del Pages Router, la descripcion de
//  la pagina (layouts), la barra superior, el candado de cambios, la campanita,
//  la banda de la licencia, las novedades de la version, el error de carga del
//  shell, y las piezas compartidas que nadie habia traducido: `ConfirmDialog`,
//  `FotoUploaderMock`, `ModuloPlaceholder` y `disponibilidadInventario`.
//
//  Los ROLES (`Vista de Dueño`) NO viven aqui: `rolLabel(rol, idioma)` los
//  traduce con las claves `admin.rol.*` de `textos/admin.ts`.
// ============================================================================

export const ES_SHELL = {
  // ── Metadatos de la pagina (`app/layout.tsx`, `app/(app)/layout.tsx`) ──
  'shell.meta.descripcion': 'Gestión de espacios publicitarios DOOH',

  // ── 404 (`app/not-found.tsx`) ──
  'shell.404.titulo': 'Esta página no existe',
  'shell.404.detalle': 'La dirección es incorrecta o el registro que buscas ya no está disponible.',
  'shell.404.otra-seccion': 'Ir a otra sección',
  'shell.404.volver': 'Volver al inicio',

  // ── Error global (`app/global-error.tsx`) ──
  'shell.error-global.titulo': 'El sistema no está disponible en este momento',
  'shell.error-global.detalle':
    'No pudimos conectar con la base de datos. Tus datos no se han perdido: vuelve a intentarlo en unos minutos. Si sigue igual, avisa a quien administra el sistema.',
  'shell.error-global.reintentar': 'Intentar de nuevo',

  // ── `_error` del Pages Router (`pages/_error.tsx`) ──
  'shell.error.no-encontrada': 'Página no encontrada',
  'shell.error.servidor': 'Error del servidor',
  'shell.error.volver': '← Volver al inicio',

  // ── Barra superior (`Topbar`) ──
  'shell.topbar.abrir-menu': 'Abrir menú',
  'shell.topbar.cerrar-menu': 'Cerrar menú',
  'shell.topbar.vista-de': 'Vista de {rol}',
  'shell.topbar.notificaciones': 'Notificaciones',
  'shell.topbar.borrar-todas': 'Borrar todas',
  'shell.topbar.sin-notificaciones': 'Sin notificaciones',
  'shell.topbar.cuenta': 'Cuenta',
  'shell.topbar.configuracion': 'Configuración',
  'shell.topbar.codigos': 'Códigos de recuperación',
  'shell.topbar.cerrar-sesion': 'Cerrar sesión',

  // ── Una notificacion de la campanita (`ItemNotificacion`) ──
  'shell.notificacion.borrar-aria': 'Borrar la notificación {titulo}',
  'shell.notificacion.borrar-title': 'Borrar esta notificación',
  // El boton del aviso emergente (`SondeoNotificaciones`), que no se rinde.

  // ── Candado de cambios (`DesbloqueoCambios`) ──
  'shell.candado.title.abierto': 'Cambios desbloqueados {min} min más · clic para bloquear',
  'shell.candado.title.cerrado': 'Los cambios de dinero y catálogo necesitan una contraseña',
  'shell.candado.abierto': 'Desbloqueado {min} min',
  'shell.candado.cerrado': 'Cambios bloqueados',
  'shell.candado.titulo': 'Desbloquear cambios',
  'shell.candado.subtitulo': 'Tu contraseña, o la del control de cambios',
  'shell.candado.explicacion':
    'Los cambios que mueven dinero o el catálogo —tarifas, rentas, contratos, pagos, facturación y borrados— necesitan una contraseña. Sirve {propia}, o la contraseña del control de cambios que haya asignado el Dueño. Al teclear cualquiera de las dos quedas desbloqueado un rato y no te la vuelve a pedir.',
  'shell.candado.explicacion.propia': 'tu propia contraseña de acceso',
  'shell.candado.contrasena': 'Contraseña',
  'shell.candado.desbloquear': 'Desbloquear',
  'shell.candado.error': 'No se pudo desbloquear',

  // ── Banda de la licencia (`BandaLicencia`) ──
  'shell.licencia.gracia':
    'Tu licencia de SPACE OS venció el {vence}. El sistema dejará de funcionar el {finGracia}.',
  'shell.licencia.aviso': 'Tu licencia de SPACE OS vence el {vence}.',
  'shell.licencia.renovar': 'Para renovarla, contacta con tu proveedor.',

  // ── Novedades de la version (`NovedadesDeVersion`) ──
  'shell.novedades.titulo': 'Qué hay de nuevo en {version}',
  'shell.novedades.subtitulo': 'Esta instancia se actualizó. Esto es lo que cambió ({fecha}).',
  'shell.novedades.ver-todas': 'Ver todas las novedades',
  'shell.novedades.entendido': 'Entendido',

  // ── Error de carga del shell (`AuthGate`) ──
  'shell.carga.titulo': 'No se pudieron cargar los datos',
  'shell.carga.detalle': 'La información no llegó del servidor. No es que no existan datos: no se pudieron leer.',
  'shell.carga.reintentar': 'Reintentar',
  'shell.carga.reintentando': 'Reintentando…',

  // ── Modulo en construccion (`ModuloPlaceholder`) ──
  'shell.placeholder.titulo': 'Módulo en construcción ({fase})',
  'shell.placeholder.detalle':
    'Los cimientos y la capa de datos ya están listos; esta pantalla se arma en la fase indicada.',

  // ── `ConfirmDialog` (sus rotulos por omision) ──
  'shell.confirmar.confirmar': 'Confirmar',
  'shell.confirmar.procesando': 'Procesando…',
  'shell.confirmar.escribe': 'Escribe {texto} para confirmar',

  // ── `FotoUploaderMock` ──
  'shell.fotos.agregar': 'Agregar foto',
  'shell.fotos.alt': 'evidencia',
  'shell.fotos.quitar': 'Quitar foto',
  'shell.fotos.cargando.uno': 'Cargando foto…',
  'shell.fotos.cargando.otros': 'Cargando {n} fotos…',

  // ── `disponibilidadInventario` (`StatusBadge.tsx`) ──
  'shell.disponibilidad.sin-capturar': 'Sin slots capturados',
  'shell.disponibilidad.sin-libres': 'Sin slots libres',
  'shell.disponibilidad.libres': '{libres} de {total} libres',
} as const

export type ClaveShell = keyof typeof ES_SHELL

export const EN_SHELL: Record<ClaveShell, string> = {
  'shell.meta.descripcion': 'DOOH advertising space management',

  'shell.404.titulo': 'This page doesn’t exist',
  'shell.404.detalle': 'The address is wrong or the record you’re looking for is no longer available.',
  'shell.404.otra-seccion': 'Go to another section',
  'shell.404.volver': 'Back to home',

  'shell.error-global.titulo': 'The system is not available right now',
  'shell.error-global.detalle':
    'We couldn’t connect to the database. Your data has not been lost: please try again in a few minutes. If it keeps happening, tell whoever manages the system.',
  'shell.error-global.reintentar': 'Try again',

  'shell.error.no-encontrada': 'Page not found',
  'shell.error.servidor': 'Server error',
  'shell.error.volver': '← Back to home',

  'shell.topbar.abrir-menu': 'Open menu',
  'shell.topbar.cerrar-menu': 'Close menu',
  'shell.topbar.vista-de': 'Viewing as {rol}',
  'shell.topbar.notificaciones': 'Notifications',
  'shell.topbar.borrar-todas': 'Clear all',
  'shell.topbar.sin-notificaciones': 'No notifications',
  'shell.topbar.cuenta': 'Account',
  // Igual que `admin.cuenta.titulo` (la pantalla a la que lleva).
  'shell.topbar.configuracion': 'Account settings',
  'shell.topbar.codigos': 'Recovery codes',
  'shell.topbar.cerrar-sesion': 'Sign out',

  'shell.notificacion.borrar-aria': 'Delete the notification {titulo}',
  'shell.notificacion.borrar-title': 'Delete this notification',

  'shell.candado.title.abierto': 'Changes unlocked for {min} more min · click to lock',
  'shell.candado.title.cerrado': 'Changes to money and the catalog need a password',
  'shell.candado.abierto': 'Unlocked for {min} min',
  'shell.candado.cerrado': 'Changes locked',
  'shell.candado.titulo': 'Unlock changes',
  'shell.candado.subtitulo': 'Your password, or the change-control password',
  'shell.candado.explicacion':
    'Changes that move money or the catalog (rates, rents, contracts, payments, invoicing and deletions) need a password. Either {propia} works, or the change-control password the Owner assigned. Typing either one unlocks you for a while, and you won’t be asked again.',
  'shell.candado.explicacion.propia': 'your own sign-in password',
  'shell.candado.contrasena': 'Password',
  'shell.candado.desbloquear': 'Unlock',
  'shell.candado.error': 'Could not unlock',

  'shell.licencia.gracia':
    'Your SPACE OS license expired on {vence}. The system will stop working on {finGracia}.',
  'shell.licencia.aviso': 'Your SPACE OS license expires on {vence}.',
  'shell.licencia.renovar': 'To renew it, contact your provider.',

  'shell.novedades.titulo': 'What’s new in {version}',
  'shell.novedades.subtitulo': 'This instance was updated. Here’s what changed ({fecha}).',
  'shell.novedades.ver-todas': 'See all release notes',
  'shell.novedades.entendido': 'Got it',

  'shell.carga.titulo': 'The data could not be loaded',
  'shell.carga.detalle': 'The information didn’t arrive from the server. It’s not that there is no data: it couldn’t be read.',
  'shell.carga.reintentar': 'Retry',
  'shell.carga.reintentando': 'Retrying…',

  'shell.placeholder.titulo': 'Module under construction ({fase})',
  'shell.placeholder.detalle': 'The foundations and the data layer are ready; this screen is built in the phase shown.',

  'shell.confirmar.confirmar': 'Confirm',
  'shell.confirmar.procesando': 'Processing…',
  'shell.confirmar.escribe': 'Type {texto} to confirm',

  'shell.fotos.agregar': 'Add photo',
  'shell.fotos.alt': 'evidence',
  'shell.fotos.quitar': 'Remove photo',
  'shell.fotos.cargando.uno': 'Loading photo…',
  'shell.fotos.cargando.otros': 'Loading {n} photos…',

  'shell.disponibilidad.sin-capturar': 'No slots entered',
  'shell.disponibilidad.sin-libres': 'No free slots',
  'shell.disponibilidad.libres': '{libres} of {total} free',
}

// ─── ITALIANO · ola 0 (2026-11-03) ──────────────────────────────────────────
// PARCIAL a proposito: lo rellena el lote de traduccion de este ambito
// (`vault/03-Frontend/italiano-olas.md`). Mientras falte una clave, la
// pantalla la pinta en INGLES (`diccionario.ts`, `DICCIONARIOS.it`) y la
// prueba de cobertura (`cobertura-italiano.test.ts`) la cuenta como pendiente.
// Cuando el lote termine, el tipo pasa a `Record<ClaveShell, string>` y `tsc`
// vuelve a exigir cada clave, como en el ingles.
export const IT_SHELL: Partial<Record<ClaveShell, string>> = {}

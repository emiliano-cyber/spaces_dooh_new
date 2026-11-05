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
  // El rotulo de encima del titulo: era un literal en `app/not-found.tsx`.
  'shell.404.codigo': 'Error 404',
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

  'shell.404.codigo': 'Error 404',
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

// ─── ITALIANO · lote L5 (2026-11-03) ────────────────────────────────────────
// COMPLETO: `Record`, asi que una clave nueva sin italiano no compila, como
// en el ingles. Traducido desde el ESPANOL (el ingles, solo de apoyo), con
// el glosario de `vault/03-Frontend/italiano-olas.md`.
export const IT_SHELL: Record<ClaveShell, string> = {
  'shell.meta.descripcion': 'Gestione degli spazi pubblicitari DOOH',

  'shell.404.codigo': 'Errore 404',
  'shell.404.titulo': 'Questa pagina non esiste',
  'shell.404.detalle': 'L’indirizzo è sbagliato o il record che cerchi non è più disponibile.',
  'shell.404.otra-seccion': 'Vai a un’altra sezione',
  'shell.404.volver': 'Torna alla home',

  'shell.error-global.titulo': 'Il sistema non è disponibile in questo momento',
  'shell.error-global.detalle':
    'Non siamo riusciti a connetterci al database. I tuoi dati non sono andati persi: riprova tra qualche minuto. Se continua così, avvisa chi amministra il sistema.',
  'shell.error-global.reintentar': 'Riprova',

  'shell.error.no-encontrada': 'Pagina non trovata',
  'shell.error.servidor': 'Errore del server',
  'shell.error.volver': '← Torna alla home',

  'shell.topbar.abrir-menu': 'Apri il menu',
  'shell.topbar.cerrar-menu': 'Chiudi il menu',
  'shell.topbar.vista-de': 'Vista come {rol}',
  'shell.topbar.notificaciones': 'Notifiche',
  'shell.topbar.borrar-todas': 'Cancella tutte',
  'shell.topbar.sin-notificaciones': 'Nessuna notifica',
  'shell.topbar.cuenta': 'Account',
  'shell.topbar.configuracion': 'Impostazioni dell’account',
  'shell.topbar.codigos': 'Codici di recupero',
  'shell.topbar.cerrar-sesion': 'Esci',

  'shell.notificacion.borrar-aria': 'Elimina la notifica {titulo}',
  'shell.notificacion.borrar-title': 'Elimina questa notifica',

  'shell.candado.title.abierto': 'Modifiche sbloccate per altri {min} min · clicca per bloccare',
  'shell.candado.title.cerrado': 'Le modifiche a denaro e catalogo richiedono una password',
  'shell.candado.abierto': 'Sbloccato per {min} min',
  'shell.candado.cerrado': 'Modifiche bloccate',
  'shell.candado.titulo': 'Sblocca le modifiche',
  'shell.candado.subtitulo': 'La tua password, o quella del controllo modifiche',
  'shell.candado.explicacion':
    'Le modifiche che toccano denaro o catalogo (tariffe, affitti, contratti, pagamenti, fatturazione ed eliminazioni) richiedono una password. Va bene {propia}, oppure la password del controllo modifiche assegnata dal Titolare. Inserendo una delle due resti sbloccato per un po’ e non ti verrà richiesta di nuovo.',
  'shell.candado.explicacion.propia': 'la tua password di accesso',
  'shell.candado.contrasena': 'Password',
  'shell.candado.desbloquear': 'Sblocca',
  'shell.candado.error': 'Non è stato possibile sbloccare',

  'shell.licencia.gracia':
    'La tua licenza di SPACE OS è scaduta in data {vence}. Il sistema smetterà di funzionare in data {finGracia}.',
  'shell.licencia.aviso': 'La tua licenza di SPACE OS scade in data {vence}.',
  'shell.licencia.renovar': 'Per rinnovarla, contatta il tuo fornitore.',

  'shell.novedades.titulo': 'Novità della versione {version}',
  'shell.novedades.subtitulo': 'Questa istanza è stata aggiornata. Ecco cosa è cambiato ({fecha}).',
  'shell.novedades.ver-todas': 'Vedi tutte le novità',
  'shell.novedades.entendido': 'Ho capito',

  'shell.carga.titulo': 'Non è stato possibile caricare i dati',
  'shell.carga.detalle':
    'Le informazioni non sono arrivate dal server. Non è che non ci siano dati: non è stato possibile leggerli.',
  'shell.carga.reintentar': 'Riprova',
  'shell.carga.reintentando': 'Nuovo tentativo…',

  'shell.placeholder.titulo': 'Modulo in costruzione ({fase})',
  'shell.placeholder.detalle':
    'Le fondamenta e il livello dei dati sono pronti; questa schermata viene costruita nella fase indicata.',

  'shell.confirmar.confirmar': 'Conferma',
  'shell.confirmar.procesando': 'Elaborazione…',
  'shell.confirmar.escribe': 'Scrivi {texto} per confermare',

  'shell.fotos.agregar': 'Aggiungi foto',
  'shell.fotos.alt': 'prova',
  'shell.fotos.quitar': 'Rimuovi foto',
  'shell.fotos.cargando.uno': 'Caricamento della foto…',
  'shell.fotos.cargando.otros': 'Caricamento di {n} foto…',

  'shell.disponibilidad.sin-capturar': 'Nessuno slot inserito',
  'shell.disponibilidad.sin-libres': 'Nessuno slot libero',
  'shell.disponibilidad.libres': '{libres} di {total} liberi',
}

// ─── PORTUGUES (pt-BR) · lote L5 (2026-11-05) ────────────────────────────────
// COMPLETO: el tipo es `Record` y `tsc` exige cada clave. Brasil, «voce»,
// el glosario comun de `vault/03-Frontend/portugues-olas.md` (§2 bis) y lo no
// obvio, clave por clave, en `docs/i18n/revision-portugues-l5.md`. La prueba
// estatica es `textos/portugues-l5.test.ts`.
export const PT_SHELL: Record<ClaveShell, string> = {
  'shell.meta.descripcion': 'Gestão de espaços publicitários DOOH',
  'shell.404.codigo': 'Erro 404',
  'shell.404.titulo': 'Esta página não existe',
  'shell.404.detalle': 'O endereço está errado ou o registro que você procura não está mais disponível.',
  'shell.404.otra-seccion': 'Ir para outra seção',
  'shell.404.volver': 'Voltar ao início',
  'shell.error-global.titulo': 'O sistema não está disponível no momento',
  'shell.error-global.detalle':
    'Não conseguimos conectar ao banco de dados. Seus dados não foram perdidos: tente de novo em alguns minutos. Se continuar assim, avise quem administra o sistema.',
  'shell.error-global.reintentar': 'Tentar de novo',
  'shell.error.no-encontrada': 'Página não encontrada',
  'shell.error.servidor': 'Erro do servidor',
  'shell.error.volver': '← Voltar ao início',
  'shell.topbar.abrir-menu': 'Abrir menu',
  'shell.topbar.cerrar-menu': 'Fechar menu',
  'shell.topbar.vista-de': 'Visão de {rol}',
  'shell.topbar.notificaciones': 'Notificações',
  'shell.topbar.borrar-todas': 'Apagar todas',
  'shell.topbar.sin-notificaciones': 'Nenhuma notificação',
  'shell.topbar.cuenta': 'Conta',
  'shell.topbar.configuracion': 'Configurações da conta',
  'shell.topbar.codigos': 'Códigos de recuperação',
  'shell.topbar.cerrar-sesion': 'Sair',
  'shell.notificacion.borrar-aria': 'Apagar a notificação {titulo}',
  'shell.notificacion.borrar-title': 'Apagar esta notificação',
  'shell.candado.title.abierto': 'Alterações desbloqueadas por mais {min} min · clique para bloquear',
  'shell.candado.title.cerrado': 'As alterações de dinheiro e de catálogo precisam de uma senha',
  'shell.candado.abierto': 'Desbloqueado por {min} min',
  'shell.candado.cerrado': 'Alterações bloqueadas',
  'shell.candado.titulo': 'Desbloquear alterações',
  'shell.candado.subtitulo': 'Sua senha ou a do controle de alterações',
  'shell.candado.explicacion':
    'As alterações que mexem com dinheiro ou com o catálogo —tarifas, aluguéis, contratos, pagamentos, faturamento e exclusões— precisam de uma senha. Vale {propia} ou a senha do controle de alterações que o Proprietário definiu. Ao digitar qualquer uma das duas, você fica desbloqueado por um tempo e ela não é pedida de novo.',
  'shell.candado.explicacion.propia': 'a sua própria senha de acesso',
  'shell.candado.contrasena': 'Senha',
  'shell.candado.desbloquear': 'Desbloquear',
  'shell.candado.error': 'Não foi possível desbloquear',
  // Sin preposicion delante de la fecha (glosario): «desde {vence}», «a partir de {finGracia}».
  'shell.licencia.gracia':
    'Sua licença do SPACE OS está vencida desde {vence}. O sistema deixará de funcionar a partir de {finGracia}.',
  'shell.licencia.aviso': 'Vencimento da sua licença do SPACE OS: {vence}.',
  'shell.licencia.renovar': 'Para renová-la, fale com o seu fornecedor.',
  'shell.novedades.titulo': 'Novidades da versão {version}',
  'shell.novedades.subtitulo': 'Esta instância foi atualizada. Veja o que mudou ({fecha}).',
  'shell.novedades.ver-todas': 'Ver todas as novidades',
  'shell.novedades.entendido': 'Entendi',
  'shell.carga.titulo': 'Não foi possível carregar os dados',
  'shell.carga.detalle': 'As informações não chegaram do servidor. Não é que não existam dados: não foi possível lê-los.',
  'shell.carga.reintentar': 'Tentar de novo',
  'shell.carga.reintentando': 'Tentando de novo…',
  'shell.placeholder.titulo': 'Módulo em construção ({fase})',
  'shell.placeholder.detalle': 'As fundações e a camada de dados já estão prontas; esta página é montada na fase indicada.',
  'shell.confirmar.confirmar': 'Confirmar',
  'shell.confirmar.procesando': 'Processando…',
  'shell.confirmar.escribe': 'Digite {texto} para confirmar',
  'shell.fotos.agregar': 'Adicionar foto',
  'shell.fotos.alt': 'foto de comprovação',
  'shell.fotos.quitar': 'Remover foto',
  'shell.fotos.cargando.uno': 'Carregando foto…',
  'shell.fotos.cargando.otros': 'Carregando {n} fotos…',
  'shell.disponibilidad.sin-capturar': 'Sem slots cadastrados',
  'shell.disponibilidad.sin-libres': 'Sem slots livres',
  'shell.disponibilidad.libres': '{libres} de {total} livres',
}

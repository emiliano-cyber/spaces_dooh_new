import { IDIOMA_POR_OMISION, type Idioma } from './idiomas'

// ============================================================================
//  lib/i18n/diccionario.ts — LOS TEXTOS, Y LA CONVENCION DE CLAVES.
// ----------------------------------------------------------------------------
//  LA CONVENCION, con su porque (que es lo que se pidio justificar):
//
//  1 · LAS CLAVES VAN EN ESPANOL, `ambito.elemento[.matiz]`, en minusculas,
//      sin acentos y separadas por puntos: `login.titulo`,
//      `nav.grupo.patrimonio`, `password.sin-numero`.
//
//      Porque una clave ES CODIGO —se teclea, se busca con grep, se lee en un
//      diff— y este repositorio escribe el codigo en espanol a proposito
//      (`vault/06-Operacion/convenciones.md`, §4 de `CLAUDE.md`). Un archivo
//      lleno de `login.title` / `nav.group.inventory` seria el unico rincon del
//      arbol que piensa en ingles, y seria ademas una invitacion al renombrado
//      que esta tarea tiene prohibido. Sin acentos por el mismo motivo por el
//      que los mensajes de commit de este repo van sin ellos.
//
//      **TRADUCIR LA INTERFAZ NO ES TRADUCIR EL CODIGO.** El espanol sigue
//      siendo el idioma del repositorio; el ingles es una capa de presentacion
//      que entra por aqui y no sale de aqui.
//
//  2 · LA CLAVE NO ES EL TEXTO EN ESPANOL. Es `login.titulo`, no
//      `'Iniciar sesion'`.
//
//      Es la decision que mas cuesta y la que mas paga. Usar la frase como
//      clave es comodo el primer dia; despues, cada retoque de redaccion —una
//      coma, una tilde— deja huerfana la traduccion EN SILENCIO: el ingles
//      sigue ahi, apuntando a una frase que ya no existe, y la pantalla se cae
//      al espanol sin avisar a nadie.
//
//      Y este repositorio tiene el caso documentado, no supuesto:
//      `components/demo/shell/nav.ts` cuenta que UN grupo del menu se llamo
//      «Vender», luego «Ventas» y hoy «Comercial» —tres renombrados— y que las
//      claves internas (`vender`) se dejaron quietas justamente por esto. Se
//      copia esa disciplina tal cual.
//
//  3 · EL ESPANOL MANDA, Y `tsc` LO OBLIGA. `ClaveTexto` se DERIVA de `ES`, y
//      `EN` se declara como `Record<ClaveTexto, string>`. Consecuencia: una
//      clave inglesa que falte NO es un hueco que se descubra en produccion —
//      es un error de compilacion. `diccionario.test.ts` es el cinturon sobre
//      ese tirante.
//
//  4 · NI UN NUMERO DE DINERO AQUI DENTRO. Ninguna cifra, ningun simbolo de
//      moneda, ningun codigo ISO. El dinero se formatea con `dinero.ts` a
//      partir del dato; una cifra escrita en un diccionario es una cifra que
//      nadie recalcula y que se queda congelada en un idioma y no en el otro.
//      Lo vigila la GUARDIA 2 de `dinero.test.ts`.
//
//  5 · LOS DATOS NO SE TRADUCEN. Nombres de clientes, de sitios, de
//      arrendadores y de organizaciones son datos: salen de la base tal como se
//      capturaron y no pasan por aqui. «Space OS» tampoco: es una marca.
// ============================================================================

// ─── ESPANOL · la fuente de verdad ──────────────────────────────────────────
// El orden de este objeto es el orden en que se leen las pantallas, no
// alfabetico: se edita mucho mas a menudo de lo que se consulta suelto.
const ES = {
  // ── Comun a toda la aplicacion ──
  'comun.cancelar': 'Cancelar',
  'comun.guardar': 'Guardar',
  'comun.cerrar': 'Cerrar',
  'comun.cargando': 'Cargando…',
  'comun.o': 'o',

  // ── Selector de idioma ──
  // Cada idioma se nombra EN SI MISMO («Espanol», «English») y no traducido,
  // que es la regla de todo selector de idioma que funciona: quien no entiende
  // la pantalla en la que esta tiene que poder reconocer el suyo.
  'idioma.etiqueta': 'Idioma',
  'idioma.es': 'Español',
  'idioma.en': 'English',
  'idioma.cambiar': 'Cambiar idioma',

  // ── Marca (no se traduce el nombre; si el descriptivo) ──
  'marca.descriptivo': 'Gestión de espacios publicitarios',

  // ── Acceso · titulos y subtitulos ──
  'login.titulo.login': 'Iniciar sesión',
  'login.titulo.signup': 'Crear cuenta',
  'login.titulo.forgot': 'Recuperar contraseña',
  'login.subtitulo.login': 'Accede con tu cuenta.',
  'login.subtitulo.signup': 'Registra tu organización y tu usuario. Tendrás tu propio CRM.',
  'login.subtitulo.forgot':
    'Escribe tu correo y te enviaremos un enlace para elegir una nueva contraseña.',

  // ── Acceso · campos ──
  'login.campo.organizacion': 'Organización',
  'login.campo.nombre': 'Tu nombre',
  'login.campo.correo': 'Correo',
  'login.campo.password': 'Contraseña',
  // Los ejemplos de los marcadores de posicion SON datos inventados, y se
  // adaptan: «Ana López» no le dice nada a quien lee en ingles, igual que
  // «Jane Doe» no le diria nada a quien lee en espanol.
  'login.ejemplo.organizacion': 'Ej. Media Norte',
  'login.ejemplo.nombre': 'Ej. Ana López',
  'login.ejemplo.correo': 'tu@correo.com',

  // ── Acceso · botones ──
  'login.boton.entrar': 'Entrar',
  'login.boton.crear': 'Crear cuenta',
  'login.boton.enviar-enlace': 'Enviar enlace',
  'login.boton.entrando': 'Entrando…',
  'login.boton.creando': 'Creando cuenta…',
  'login.boton.enviando': 'Enviando…',

  // ── Acceso · enlaces y cambios de modo ──
  'login.olvidaste': '¿Olvidaste tu contraseña?',
  'login.ya-tienes-cuenta': '¿Ya tienes cuenta? ',
  'login.no-tienes-cuenta': '¿No tienes cuenta? ',
  'login.volver': '← Volver a ',
  'login.volver.enlace': 'iniciar sesión',
  'login.enlace-dev': 'Enlace (solo en desarrollo):',
  'login.aviso-generico': 'Si el correo está registrado, te enviamos un enlace.',

  // ── Acceso · Google ──
  'login.google.continuar': 'Continuar con Google',
  'login.google.crear': 'Crear empresa con Google',
  'login.google.falta-organizacion':
    'Escribe el nombre de tu organización antes de continuar con Google.',
  'login.google.error.no_disponible': 'El acceso con Google no está disponible en este momento.',
  'login.google.error.cancelado': 'Cancelaste el acceso con Google.',
  'login.google.error.invalido': 'No se pudo completar el acceso con Google. Vuelve a intentarlo.',
  'login.google.error.no_registrado':
    'Esa cuenta de Google no está dada de alta. Pide a tu administrador que te agregue.',
  'login.google.error.inactivo':
    'Tu usuario está desactivado. Pide a tu administrador que lo reactive.',
  'login.google.error.ya_vinculada':
    'Tu usuario ya tiene otra cuenta de Google vinculada. Pide a tu administrador que la revise.',
  'login.google.error.generico': 'No se pudo entrar con Google.',

  // ── Acceso · fallos ──
  // Solo los que escribe EL NAVEGADOR cuando el servidor no manda texto. Lo que
  // sí manda el servidor sigue llegando en español: ver el informe I18N-01.
  'login.error.enviar-enlace': 'No se pudo enviar el enlace',
  'login.error.crear-cuenta': 'No se pudo crear la cuenta',
  'login.error.iniciar-sesion': 'No se pudo iniciar sesión',

  // ── Validacion compartida con el servidor ──
  // Estos DUPLICAN a proposito el texto de `lib/validacion.ts` y
  // `lib/password.ts`, que los comparte el servidor y no tiene idioma. Hay una
  // prueba que impide que las dos copias se despeguen.
  'validacion.email': 'Correo inválido. Usa el formato ejemplo@correo.com',
  'password.regla': 'mínimo 8, con letra y número',
  'password.corta': 'La contraseña debe tener al menos 8 caracteres',
  'password.sin-letra': 'La contraseña debe incluir al menos una letra',
  'password.sin-numero': 'La contraseña debe incluir al menos un número',
  'password.con-espacios': 'La contraseña no puede contener espacios',

  // ── Menu lateral · el armazon (lo que no es una entrada) ──
  'sidebar.expandir': 'Expandir menú',
  'sidebar.colapsar': 'Colapsar menú',
  'sidebar.logo-alt': 'logo',
  'sidebar.abrir-portal': 'Abrir portal',
  'sidebar.solo-portal': 'Como cliente externo sólo tienes acceso a tu portal.',
  'sidebar.derechos': 'Derechos reservados',

  // ── Menu lateral · encabezados de grupo ──
  // Las claves salen de `GRUPOS[].key` en `components/demo/shell/nav.ts`, que
  // NO se toca (archivo de alto contacto). Ojo con la trampa que el propio
  // `nav.ts` documenta: la clave `vender` rotula «Comercial» y `entregar`
  // rotula «Operaciones». Las claves son internas y los rotulos cambian.
  'nav.grupo.patrimonio': 'Inventario',
  'nav.grupo.ojos': 'Space Eyes',
  'nav.grupo.vender': 'Comercial',
  'nav.grupo.entregar': 'Operaciones',
  'nav.grupo.cobrar': 'Finanzas',
  'nav.grupo.sistema': 'Sistema',

  // ── Menu lateral · entradas ──
  // Una por cada `NAV[].key`. Se traducen por la clave que la entrada YA tiene,
  // asi que `nav.ts` no cambia ni una linea.
  'nav.dashboard': 'Dashboard',
  'nav.inventario': 'Inventario',
  'nav.arrendadores': 'Arrendadores',
  'nav.network': 'Network',
  'nav.almacen': 'Almacén',
  'nav.space-eyes': 'Equipos',
  'nav.space-eyes-galeria': 'Galería',
  'nav.space-eyes-graficas': 'Gráficas',
  'nav.space-eyes-texto': 'Ajustar texto',
  'nav.space-eyes-programacion': 'Programación',
  'nav.space-eyes-campanas': 'Campañas',
  'nav.space-eyes-verificacion': 'Verificación',
  'nav.space-eyes-fallas': 'Fallas',
  'nav.clientes': 'Clientes',
  'nav.comercial': 'Comercial',
  'nav.disponibilidad': 'Disponibilidad',
  'nav.propuestas': 'Propuestas',
  'nav.captacion': 'Captación',
  'nav.comercial-opex': 'Comercial OPEX',
  'nav.franjas-y-temporadas': 'Franjas y temporadas',
  'nav.descuentos-por-volumen': 'Descuentos por volumen',
  'nav.codigos-promocionales': 'Codigos promocionales',
  'nav.paquetes': 'Paquetes cerrados',
  'nav.creativos': 'Creativos',
  'nav.campanas': 'Campañas',
  'nav.imprenta': 'Imprenta',
  'nav.operaciones': 'Operaciones',
  'nav.energia': 'Consumo de luz',
  'nav.finanzas': 'Finanzas',
  'nav.reportes': 'Reportes',
  'nav.comisiones': 'Comisiones',
  'nav.integraciones': 'Integraciones',
  'nav.razones-sociales': 'Razones sociales',
  'nav.actividad': 'Actividad',
  'nav.administracion': 'Administración',
} as const

export type ClaveTexto = keyof typeof ES

// ─── INGLES ─────────────────────────────────────────────────────────────────
//
// INGLES DE ESTADOS UNIDOS. **DECIDIDO POR EL DUENO el 2026-09-30**, y por eso
// esta escrito aqui: hasta ese dia era una suposicion de quien escribio el
// archivo —la menos mala, porque el mercado del producto es Mexico y su vecino
// y `Intl` ya formatea con `en-US`— y una suposicion que nadie marca como tal
// se acaba reabriendo cada pocas semanas.
//
// **No se vuelve a preguntar.** Si algun dia cambia a britanico, es un repaso
// de este objeto y una linea en `LOCALE_DE_IDIOMA` (`dinero.ts`): la diferencia
// real en una interfaz como esta es de media docena de palabras.
//
// El registro es el mismo que el del espanol: tuteo directo, frases cortas, sin
// mayusculas de titulo en las frases (solo en los rotulos de menu y botones,
// que es lo que espera quien usa una aplicacion de trabajo en ingles).
const EN: Record<ClaveTexto, string> = {
  'comun.cancelar': 'Cancel',
  'comun.guardar': 'Save',
  'comun.cerrar': 'Close',
  'comun.cargando': 'Loading…',
  'comun.o': 'or',

  'idioma.etiqueta': 'Language',
  // Cada idioma, en si mismo. No se traducen.
  'idioma.es': 'Español',
  'idioma.en': 'English',
  'idioma.cambiar': 'Change language',

  'marca.descriptivo': 'Advertising space management',

  'login.titulo.login': 'Sign in',
  'login.titulo.signup': 'Create account',
  'login.titulo.forgot': 'Reset your password',
  'login.subtitulo.login': 'Sign in with your account.',
  'login.subtitulo.signup': 'Register your organization and your user. You will get your own CRM.',
  'login.subtitulo.forgot':
    'Enter your email and we will send you a link to choose a new password.',

  'login.campo.organizacion': 'Organization',
  'login.campo.nombre': 'Your name',
  'login.campo.correo': 'Email',
  'login.campo.password': 'Password',
  'login.ejemplo.organizacion': 'e.g. Media Norte',
  'login.ejemplo.nombre': 'e.g. Jane Doe',
  'login.ejemplo.correo': 'you@email.com',

  'login.boton.entrar': 'Sign in',
  'login.boton.crear': 'Create account',
  'login.boton.enviar-enlace': 'Send link',
  'login.boton.entrando': 'Signing in…',
  'login.boton.creando': 'Creating account…',
  'login.boton.enviando': 'Sending…',

  'login.olvidaste': 'Forgot your password?',
  'login.ya-tienes-cuenta': 'Already have an account? ',
  'login.no-tienes-cuenta': "Don't have an account? ",
  'login.volver': '← Back to ',
  'login.volver.enlace': 'sign in',
  'login.enlace-dev': 'Link (development only):',
  'login.aviso-generico': 'If that email is registered, we sent you a link.',

  'login.google.continuar': 'Continue with Google',
  'login.google.crear': 'Create company with Google',
  'login.google.falta-organizacion':
    'Enter your organization name before continuing with Google.',
  'login.google.error.no_disponible': 'Google sign-in is not available right now.',
  'login.google.error.cancelado': 'You cancelled the Google sign-in.',
  'login.google.error.invalido': 'The Google sign-in could not be completed. Please try again.',
  'login.google.error.no_registrado':
    'That Google account is not registered. Ask your administrator to add you.',
  'login.google.error.inactivo':
    'Your user is deactivated. Ask your administrator to reactivate it.',
  'login.google.error.ya_vinculada':
    'Your user already has another Google account linked. Ask your administrator to check it.',
  'login.google.error.generico': 'Could not sign in with Google.',

  'login.error.enviar-enlace': 'The link could not be sent',
  'login.error.crear-cuenta': 'The account could not be created',
  'login.error.iniciar-sesion': 'Could not sign in',

  'validacion.email': 'Invalid email. Use the format example@email.com',
  'password.regla': 'at least 8, with a letter and a number',
  'password.corta': 'The password must be at least 8 characters long',
  'password.sin-letra': 'The password must include at least one letter',
  'password.sin-numero': 'The password must include at least one number',
  'password.con-espacios': 'The password cannot contain spaces',

  'sidebar.expandir': 'Expand menu',
  'sidebar.colapsar': 'Collapse menu',
  'sidebar.logo-alt': 'logo',
  'sidebar.abrir-portal': 'Open portal',
  'sidebar.solo-portal': 'As an external client you only have access to your portal.',
  'sidebar.derechos': 'All rights reserved',

  'nav.grupo.patrimonio': 'Inventory',
  'nav.grupo.ojos': 'Space Eyes',
  'nav.grupo.vender': 'Sales',
  'nav.grupo.entregar': 'Operations',
  'nav.grupo.cobrar': 'Finance',
  'nav.grupo.sistema': 'System',

  'nav.dashboard': 'Dashboard',
  'nav.inventario': 'Inventory',
  'nav.arrendadores': 'Landlords',
  // «Network» ya es la palabra inglesa y es como se llama el modulo: no se
  // traduce a «Red», que en este dominio significaria otra cosa.
  'nav.network': 'Network',
  'nav.almacen': 'Warehouse',
  'nav.space-eyes': 'Devices',
  'nav.space-eyes-galeria': 'Gallery',
  'nav.space-eyes-graficas': 'Charts',
  'nav.space-eyes-texto': 'Photo label',
  'nav.space-eyes-programacion': 'Scheduling',
  'nav.space-eyes-campanas': 'Campaigns',
  'nav.space-eyes-verificacion': 'Verification',
  'nav.space-eyes-fallas': 'Faults',
  'nav.clientes': 'Clients',
  'nav.comercial': 'Sales',
  'nav.disponibilidad': 'Availability',
  'nav.propuestas': 'Proposals',
  'nav.captacion': 'Prospecting',
  'nav.comercial-opex': 'Commercial OPEX',
  'nav.franjas-y-temporadas': 'Dayparts and seasons',
  'nav.descuentos-por-volumen': 'Volume discounts',
  'nav.codigos-promocionales': 'Promo codes',
  'nav.paquetes': 'Bundles',
  'nav.creativos': 'Creatives',
  'nav.campanas': 'Campaigns',
  'nav.imprenta': 'Printing',
  'nav.operaciones': 'Operations',
  'nav.energia': 'Power usage',
  'nav.finanzas': 'Finance',
  'nav.reportes': 'Reports',
  'nav.comisiones': 'Commissions',
  'nav.integraciones': 'Integrations',
  'nav.razones-sociales': 'Legal entities',
  'nav.actividad': 'Activity',
  'nav.administracion': 'Settings',
}

export const DICCIONARIOS: Record<Idioma, Record<ClaveTexto, string>> = {
  es: ES,
  en: EN,
}

export const CLAVES = Object.keys(ES) as ClaveTexto[]

/**
 * Sustituye los huecos `{nombre}` por su valor.
 *
 * Un hueco sin valor se deja TAL CUAL en vez de pintarse como «undefined»: un
 * `{n}` a la vista se ve raro y se arregla; un «undefined» parece un defecto
 * del programa y manda a alguien a depurar donde no hay nada.
 */
export function interpolar(texto: string, valores: Record<string, string | number> = {}): string {
  return texto.replace(/\{(\w+)\}/g, (crudo, nombre: string) =>
    nombre in valores ? String(valores[nombre]) : crudo,
  )
}

/**
 * El texto de una clave en un idioma.
 *
 * El respaldo al espanol no deberia poder dispararse nunca —`tsc` obliga a que
 * `EN` este completo— pero existe porque la alternativa en produccion seria
 * pintar la clave cruda («login.titulo.login») en la pantalla de alguien.
 *
 * `diccionarios` es un parametro para poder ejercer ese respaldo en una prueba
 * sin tocar el modulo; en la aplicacion nadie lo pasa.
 */
export function traducir(
  idioma: Idioma,
  clave: ClaveTexto,
  valores?: Record<string, string | number>,
  diccionarios: Record<Idioma, Record<ClaveTexto, string>> = DICCIONARIOS,
): string {
  const texto =
    diccionarios[idioma]?.[clave] ?? diccionarios[IDIOMA_POR_OMISION]?.[clave] ?? clave
  return valores ? interpolar(texto, valores) : texto
}

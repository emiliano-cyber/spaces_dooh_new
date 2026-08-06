// ============================================================================
//  lib/email-remitente.ts — Construcción de la cabecera `From` de los correos.
//
//  Hay DOS canales de correo y esta es la costura entre ellos:
//
//    · SISTEMA (contraseñas, invitaciones): sale tal cual con `EMAIL_FROM`.
//      Es la plataforma hablando. Además ocurre PRE-sesión: en «olvidé mi
//      contraseña» todavía no se sabe de qué organización es quien escribe, así
//      que no hay ningún nombre de empresa correcto que poner — mismo
//      razonamiento por el que el ADR 0011 quitó «RGB Catorce» del login.
//
//    · OPERACIÓN (contratos y lo que venga): sale del MISMO dominio verificado,
//      pero a nombre de la organización, y con su correo en `Reply-To`.
//
//  Por qué el nombre va en `From` y el correo de la organización en `Reply-To`,
//  que es la parte que sorprende: el proveedor (Resend) verifica DOMINIOS por
//  DNS, no direcciones. Poner `cliente@sudominio.com` en `From` sin que ese
//  dominio publique SPF/DKIM no manda «desde» su dominio — manda algo que los
//  filtros leen como suplantación y va a spam. Lo que sí se puede hacer sin
//  pedirle DNS a nadie es firmar con el dominio propio y presentarse con el
//  nombre del cliente. Quien lo recibe ve «G500» como remitente y al responder
//  le contesta a G500.
// ============================================================================

// Extrae la dirección de una cabecera que puede venir en cualquiera de las dos
// formas admitidas: «Nombre <buzon@dominio>» o «buzon@dominio» a secas.
export function direccionDe(from: string): string {
  const m = /<([^>]+)>/.exec(from ?? '')
  return (m ? m[1] : (from ?? '')).trim()
}

// Escapa el nombre para que quepa en la cabecera sin romperla.
//
// Se cita SIEMPRE en vez de decidir si hace falta. La regla de RFC 5322 es que
// los caracteres «especiales» —entre ellos la coma y el punto— obligan a citar,
// y las razones sociales mexicanas los llevan de serie: «G500, S.A. de C.V.»
// necesita comillas y «RGB Catorce» no. Citar siempre es correcto en los dos
// casos y evita tener que mantener la lista de qué carácter obliga a qué.
//
// Los caracteres de control se quitan, no se escapan: un CR o un LF dentro de
// una cabecera de correo es inyección de cabeceras. La API de Resend recibe
// JSON y serializa por su cuenta, así que hoy no hay un hueco explotable por
// aquí — pero el saneado va donde se construye la cabecera y no donde
// casualmente hoy no hace daño.
function nombreCitado(nombre: string): string {
  const limpio = (nombre ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .trim()
  return limpio ? `"${limpio}"` : ''
}

// `From` para los avisos de OPERACIÓN: el buzón verificado de la plataforma,
// presentado con el nombre de la organización.
//
// Si el nombre viene vacío se devuelve `from` intacto en vez de fabricar unas
// comillas vacías, que darían una cabecera como `"" <buzon@dominio>` — válida
// pero fea, y visible en el cliente de correo de quien la recibe.
export function remitenteConNombre(from: string, nombre: string): string {
  const dir = direccionDe(from)
  if (!dir) return from ?? ''
  const citado = nombreCitado(nombre)
  return citado ? `${citado} <${dir}>` : dir
}

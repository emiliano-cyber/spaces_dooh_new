import { traducir, type ClaveTexto } from './diccionario'
import { formatearDineroRedondo } from './dinero'
import { traducirError } from './errores-servidor'
import { IDIOMA_POR_OMISION, type Idioma } from './idiomas'
import { ES_NOTIFICACIONES } from './textos/notificaciones'

// ============================================================================
//  LOS AVISOS DE LA CAMPANITA, EN EL IDIOMA DE QUIEN LOS LEE (ola 6).
// ----------------------------------------------------------------------------
//  El servidor GUARDA cada notificacion en espanol, como dato, al crearla
//  (`notificar()`, `notificaciones-repo.ts`, y tres `insert` a mano). Eso no
//  cambia: un aviso guardado en dos idiomas segun quien provoco el suceso
//  seria ilegible para el resto del equipo, y las que ya estan en la base
//  seguirian en espanol de todos modos.
//
//  Lo que hace este modulo es REconocer el texto guardado y rearmarlo en
//  ingles AL PINTARLO, como `traducirError` con los errores del servidor:
//
//   · cada titulo conocido es una plantilla de `textos/notificaciones.ts`, y
//     lleva la lista de plantillas que puede tener su detalle (una frase de OT
//     no se reconoce bajo el titulo de una propuesta);
//   · los huecos (folio, nombre, cliente) se conservan tal cual: son datos;
//   · la cifra de dias elige el plural ingles; el saldo se vuelve a formatear
//     con el formato ingles (`MX$`);
//   · lo que no casa se pinta COMO ESTA, en espanol. Mejor el texto original
//     que uno inventado.
//
//  En espanol devuelve el aviso tal cual: el texto guardado es la fuente.
// ============================================================================

const ES = ES_NOTIFICACIONES as Record<string, string>

/** Una plantilla: una clave suelta, o la base de un plural (`.uno` / `.otros`). */
interface Forma {
  clave: string
  plural?: true
}

interface Aviso {
  titulo: Forma
  /** Las plantillas que puede tener el detalle de este titulo. */
  detalles?: Forma[]
  /** El detalle es el mensaje de un error del servidor: va por `traducirError`. */
  detalleEsError?: true
}

const f = (clave: string): Forma => ({ clave })
const plural = (clave: string): Forma => ({ clave, plural: true })

const AVISOS: Aviso[] = [
  { titulo: f('notificaciones.propuesta.aprobada') },
  { titulo: f('notificaciones.propuesta.rechazada') },
  { titulo: f('notificaciones.propuesta.aceptada'), detalles: [f('notificaciones.propuesta.aceptada.detalle')] },
  { titulo: f('notificaciones.campana.generada') },
  { titulo: f('notificaciones.campana.no-generada'), detalleEsError: true },
  { titulo: f('notificaciones.campana.por-validar'), detalles: [f('notificaciones.campana.por-validar.detalle')] },
  { titulo: f('notificaciones.publicacion.aprobada'), detalles: [f('notificaciones.publicacion.aprobada.detalle')] },
  {
    titulo: f('notificaciones.publicacion.rechazada'),
    detalles: [f('notificaciones.publicacion.rechazada.motivo'), f('notificaciones.publicacion.rechazada.detalle')],
  },
  { titulo: f('notificaciones.factura.emitida') },
  { titulo: f('notificaciones.odc.registrada') },
  { titulo: f('notificaciones.pago.liquidada'), detalles: [f('notificaciones.pago.sin-folio')] },
  { titulo: f('notificaciones.pago.abono'), detalles: [f('notificaciones.pago.sin-folio')] },
  {
    titulo: f('notificaciones.cobranza.vencida'),
    detalles: [plural('notificaciones.cobranza.vencida.detalle')],
  },
  {
    titulo: f('notificaciones.cobranza.recordatorio'),
    detalles: [plural('notificaciones.cobranza.vence.detalle')],
  },
  {
    titulo: f('notificaciones.ot.vencida'),
    detalles: [f('notificaciones.ot.vencida.sin-asignar'), f('notificaciones.ot.vencida.detalle')],
  },
  { titulo: f('notificaciones.contrato.sin-capturar'), detalles: [f('notificaciones.contrato.sin-capturar.detalle')] },
  { titulo: f('notificaciones.contrato.vencido'), detalles: [plural('notificaciones.contrato.vencido.detalle')] },
  { titulo: f('notificaciones.contrato.vence-hoy'), detalles: [f('notificaciones.contrato.por-vencer.detalle')] },
  { titulo: plural('notificaciones.contrato.vence-en'), detalles: [f('notificaciones.contrato.por-vencer.detalle')] },
]

// Lo que puede valer cada hueco. Casi todos son datos libres; la cifra de dias
// y el saldo se acotan para no casar con cualquier cosa.
const HUECO: Record<string, string> = {
  n: '(\\d+)',
  saldo: '((?:US)?\\$-?[\\d,]+)',
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const cacheRe = new Map<string, { re: RegExp; nombres: string[] }>()

/** El patron que reconoce el texto que escribe la plantilla espanola. */
function patron(es: string): { re: RegExp; nombres: string[] } {
  const hecho = cacheRe.get(es)
  if (hecho) return hecho
  const nombres: string[] = []
  const partes = es.split(/\{(\w+)\}/)
  let fuente = ''
  partes.forEach((p, i) => {
    if (i % 2 === 0) fuente += escapar(p)
    else {
      nombres.push(p)
      fuente += HUECO[p] ?? '([\\s\\S]+?)'
    }
  })
  const r = { re: new RegExp(`^${fuente}$`), nombres }
  cacheRe.set(es, r)
  return r
}

function casar(forma: Forma, texto: string): Record<string, string> | null {
  const variantes = forma.plural ? [`${forma.clave}.uno`, `${forma.clave}.otros`] : [forma.clave]
  for (const clave of variantes) {
    const es = ES[clave]
    if (es === undefined) continue
    const { re, nombres } = patron(es)
    const m = re.exec(texto)
    if (m) return Object.fromEntries(nombres.map((n, i) => [n, m[i + 1]]))
  }
  return null
}

// Los huecos que el servidor escribe con formato o con palabras suyas.
function convertir(valores: Record<string, string>, idioma: Idioma): Record<string, string> {
  const r = { ...valores }
  if (r.saldo !== undefined) {
    // `simboloMoneda() + Math.round(v).toLocaleString('es-MX')` (`finanzas-repo.ts`):
    // solo enteros con comas. La moneda es la de la instancia, que no cambia.
    r.saldo = formatearDineroRedondo(Number(r.saldo.replace(/^(?:US)?\$/, '').replace(/,/g, '')), idioma)
  }
  if (r.contrato !== undefined) {
    // `queEs()` (`recordatorios-contratos.ts`) escribe «un espacio» cuando el
    // contrato no tiene predio ni pantalla. Solo ESO se traduce; un nombre que
    // empiece igual es dato.
    const sin = ES['notificaciones.contrato.un-espacio']
    if (r.contrato === sin || r.contrato.startsWith(`${sin} · `)) {
      r.contrato = traducir(idioma, 'notificaciones.contrato.un-espacio') + r.contrato.slice(sin.length)
    }
  }
  return r
}

// La forma del plural que toca a la cifra. Con 0, la variante `.cero` si la
// plantilla la tiene («due today» en vez de «due in 0 days», ola 7); si no, el
// plural de siempre.
function formaDePlural(base: string, n: string | undefined): string {
  if (n === '0' && ES[`${base}.cero`] !== undefined) return `${base}.cero`
  return `${base}.${n === '1' ? 'uno' : 'otros'}`
}

function armar(forma: Forma, valores: Record<string, string>, idioma: Idioma): string {
  const clave = forma.plural ? formaDePlural(forma.clave, valores.n) : forma.clave
  return traducir(idioma, clave as ClaveTexto, convertir(valores, idioma))
}

/**
 * Un aviso de la campanita en el idioma de quien lo lee. Devuelve el mismo
 * aviso con `titulo` y `detalle` rearmados; en espanol, o si no se reconoce,
 * los deja como estan.
 */
export function traducirNotificacion<T extends { titulo: string; detalle: string | null }>(
  n: T,
  idioma: Idioma,
): T {
  if (idioma === IDIOMA_POR_OMISION) return n
  for (const aviso of AVISOS) {
    const vt = casar(aviso.titulo, n.titulo)
    if (!vt) continue
    const titulo = armar(aviso.titulo, vt, idioma)
    let detalle = n.detalle
    if (detalle) {
      if (aviso.detalleEsError) detalle = traducirError(detalle, idioma)
      for (const forma of aviso.detalles ?? []) {
        const vd = casar(forma, detalle)
        if (vd) {
          detalle = armar(forma, vd, idioma)
          break
        }
      }
    }
    return { ...n, titulo, detalle }
  }
  return n
}

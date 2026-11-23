import { DICCIONARIOS, traducir, interpolar, type ClaveTexto } from './diccionario'
import { formatearDinero, formatearNumero } from './dinero'
import { IDIOMA_POR_OMISION, type Idioma } from './idiomas'
import { ES_ACTIVIDAD, EN_ACTIVIDAD, IT_ACTIVIDAD, PT_ACTIVIDAD, type ClaveActividad } from './textos/actividad'

// ============================================================================
//  LA BITACORA DE ACTIVIDAD, EN EL IDIOMA DE QUIEN LA LEE (revision 18/11).
// ----------------------------------------------------------------------------
//  El servidor GUARDA cada renglon en espanol (`registrarAccion()`), y eso no
//  cambia: es registro (vault/03-Frontend/idiomas-es-en.md §8). Este modulo
//  hace con la bitacora lo que `notificaciones.ts` hace con la campanita:
//  reconoce el texto guardado contra las plantillas de `textos/actividad.ts`
//  y lo rearma en el idioma de quien lee.
//
//   · los huecos (folio, nombre, codigo, motivo) se conservan: son datos;
//   · la cifra de un plural elige la forma; los importes se reformatean con
//     el formato del idioma (`MX$` en ingles); los estatus que el servidor
//     escribe en mayusculas (`ENVIADA`, `EN_PRODUCCION`) salen con su nombre;
//   · el « (vN)» del final de los renglones de propuesta se quita para casar
//     y se vuelve a poner;
//   · lo que no casa se pinta COMO ESTA. Mejor el original que uno inventado.
//
//  En espanol devuelve el texto tal cual: el dato guardado es la fuente.
// ============================================================================

const TEXTOS: Record<Idioma, Record<ClaveActividad, string>> = {
  es: ES_ACTIVIDAD,
  en: EN_ACTIVIDAD,
  it: IT_ACTIVIDAD,
  pt: PT_ACTIVIDAD,
}

// Lo que puede valer cada hueco. Casi todos son datos libres; las cifras, los
// importes y los estatus se acotan para no casar con cualquier cosa.
const HUECO: Record<string, string> = {
  n: '(\\d[\\d,]*)',
  m: '(\\d[\\d,]*)',
  v: '(\\d+)',
  fechaA: '(\\d{4}-\\d{2}-\\d{2}\\S*)',
  fechaB: '(\\d{4}-\\d{2}-\\d{2}\\S*)',
  pct: '(\\d[\\d,]*(?:\\.\\d+)?)',
  monto: '((?:[A-Z]{2})?\\$-?\\d[\\d,]*(?:\\.\\d+)?)',
  monto2: '((?:[A-Z]{2})?\\$-?\\d[\\d,]*(?:\\.\\d+)?)',
  estatus: '([A-Z_]+)',
  motivo: '((?: por Roadblock con prima del \\d[\\d,]*(?:\\.\\d+)? %)?)',
}

// Los estatus que el servidor escribe tal cual (`Propuesta → ENVIADA`,
// `Avanzó impresión → EN_PRODUCCION`), con la clave que ya los nombra.
const ESTATUS: Record<string, ClaveTexto> = {
  BORRADOR: 'propuestas.estatus.borrador',
  ENVIADA: 'propuestas.estatus.enviada',
  APROBADA: 'propuestas.estatus.aprobada',
  RECHAZADA: 'propuestas.estatus.rechazada',
  ARTE_RECIBIDO: 'campanas.impresion.arte-recibido',
  VALIDADO: 'campanas.impresion.validado',
  EN_PRODUCCION: 'campanas.impresion.en-produccion',
  IMPRESO: 'campanas.impresion.impreso',
  LISTO_MONTAJE: 'campanas.impresion.listo-montaje',
}

/**
 * Las plantillas de la ACCION (no las de la entidad, ni la de quien, ni la
 * pieza del motivo), de la que mas texto fijo tiene a la que menos: un hueco
 * libre es perezoso pero llega hasta el final, y «Fijó el horario en
 * DOOHmain: 08:00 a 12:00 (días 1,2)» casaria con la plantilla sin días,
 * con «12:00 (días 1,2)» de hora de fin.
 */
const fijo = (k: ClaveActividad) => ES_ACTIVIDAD[k].replace(/\{\w+\}/g, '').length
const ACCIONES = (Object.keys(ES_ACTIVIDAD) as ClaveActividad[])
  .filter((k) => !k.startsWith('actividad.entidad.') && !k.startsWith('actividad.quien.') && k !== 'actividad.motivo-roadblock')
  .sort((a, b) => fijo(b) - fijo(a))
const ENTIDADES = (Object.keys(ES_ACTIVIDAD) as ClaveActividad[])
  .filter((k) => k.startsWith('actividad.entidad.'))
  .sort((a, b) => fijo(b) - fijo(a))
const QUIEN = (Object.keys(ES_ACTIVIDAD) as ClaveActividad[]).filter((k) => k.startsWith('actividad.quien.'))

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const cacheRe = new Map<string, { re: RegExp; nombres: string[] }>()

function patron(es: string): { re: RegExp; nombres: string[] } {
  const hecho = cacheRe.get(es)
  if (hecho) return hecho
  const nombres: string[] = []
  let fuente = ''
  es.split(/\{(\w+)\}/).forEach((p, i) => {
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

/** La cifra que escribio el servidor con formato es-MX («1,532», «12.5»). */
const cifra = (s: string) => Number(s.replace(/,/g, ''))
const importe = (s: string) => Number(s.replace(/^(?:[A-Z]{2})?\$/, '').replace(/,/g, ''))

function convertir(valores: Record<string, string>, idioma: Idioma): Record<string, string> {
  const r = { ...valores }
  const decimales = { minimumFractionDigits: 0, maximumFractionDigits: 2 }
  if (r.n !== undefined) r.n = formatearNumero(cifra(r.n), idioma)
  if (r.m !== undefined) r.m = formatearNumero(cifra(r.m), idioma)
  if (r.pct !== undefined) r.pct = formatearNumero(cifra(r.pct), idioma, decimales)
  if (r.monto !== undefined) r.monto = formatearDinero(importe(r.monto), idioma, decimales)
  if (r.monto2 !== undefined) r.monto2 = formatearDinero(importe(r.monto2), idioma, decimales)
  if (r.estatus !== undefined && ESTATUS[r.estatus]) r.estatus = traducir(idioma, ESTATUS[r.estatus])
  if (r.motivo) {
    const m = /(\d[\d,]*(?:\.\d+)?)/.exec(r.motivo)
    r.motivo = interpolar(TEXTOS[idioma]['actividad.motivo-roadblock'], {
      pct: m ? formatearNumero(cifra(m[1]), idioma, decimales) : '',
    })
  }
  return r
}

/** La plantilla que toca: en un plural, la forma que pide la cifra. */
function claveFinal(clave: ClaveActividad, valores: Record<string, string>): ClaveActividad {
  const m = /^(.*)\.(uno|otros)$/.exec(clave)
  if (!m) return clave
  return `${m[1]}.${cifra(valores.n ?? '') === 1 ? 'uno' : 'otros'}` as ClaveActividad
}

function casarCon(claves: readonly ClaveActividad[], texto: string, idioma: Idioma): string | null {
  for (const clave of claves) {
    const { re, nombres } = patron(ES_ACTIVIDAD[clave])
    const m = re.exec(texto)
    if (!m) continue
    const valores = Object.fromEntries(nombres.map((n, i) => [n, m[i + 1]]))
    const destino = TEXTOS[idioma][claveFinal(clave, valores)]
    return interpolar(destino, convertir(valores, idioma))
  }
  return null
}

/** La accion guardada, en el idioma de quien lee. Lo que no reconoce, tal cual. */
export function traducirAccion(texto: string, idioma: Idioma): string {
  if (idioma === IDIOMA_POR_OMISION || !texto) return texto
  const directo = casarCon(ACCIONES, texto, idioma)
  if (directo !== null) return directo
  // «Agregó 2 sitios a la propuesta (v3)»: la version se queda como esta.
  const v = /^([\s\S]+) (\(v\d+\))$/.exec(texto)
  if (v) {
    const base = casarCon(ACCIONES, v[1], idioma)
    if (base !== null) return `${base} ${v[2]}`
  }
  return texto
}

/** La entidad, solo cuando es una frase del servidor; un nombre es dato. */
export function traducirEntidadAccion(texto: string, idioma: Idioma): string {
  if (idioma === IDIOMA_POR_OMISION || !texto) return texto
  const frase = casarCon(ENTIDADES, texto, idioma)
  if (frase !== null) return frase
  // «Movió una oportunidad» guarda `${nombre} · ${etapa}` con la etapa en
  // mayusculas (`app/api/oportunidades/[id]/etapa/route.ts`): la etapa sale
  // con su nombre (`crm.etapa.*`), el nombre queda como esta.
  const etapa = / · ([A-Z_]+)$/.exec(texto)
  if (etapa) {
    const clave = `crm.etapa.${etapa[1].toLowerCase().replace(/_/g, '-')}`
    if (clave in DICCIONARIOS.es) {
      return `${texto.slice(0, etapa.index)} · ${traducir(idioma, clave as ClaveTexto)}`
    }
  }
  return texto
}

/** Quien lo hizo, cuando no es una persona de la organizacion («Sistema», el cliente por la liga). */
export function traducirQuienAccion(texto: string, idioma: Idioma): string {
  if (idioma === IDIOMA_POR_OMISION || !texto) return texto
  return casarCon(QUIEN, texto, idioma) ?? texto
}

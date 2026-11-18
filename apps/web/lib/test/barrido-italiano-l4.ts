// ============================================================================
//  lib/test/barrido-italiano-l4.ts — EL BARRIDO ITALIANO DEL LOTE L4.
// ----------------------------------------------------------------------------
//  Lote L4 del italiano (Campanas, Finanzas, Clientes, Reportes y Dashboard,
//  2026-11-03). Lo usan las cuatro pruebas de pantallas del lote para mirar el
//  HTML ITALIANO que ya construyen para el ingles:
//
//    · `fugasItaliano`: de cada clave de los diccionarios del lote se sacan
//      los trozos fijos (lo que hay entre huecos) del INGLES y del ESPANOL, y
//      se buscan en el texto italiano. Un trozo ingles a la vista es una clave
//      que cayo al ingles (`conCaidaAlIngles`, `diccionario.ts`) —la caida es
//      silenciosa, y esto la hace ruidosa—; uno espanol es un texto que se
//      pinto sin pasar por `t()`. Un trozo que el italiano de ESA clave
//      tambien contiene («DOOHmain», «Pipeline») no cuenta.
//    · `legible`: solo lo que se LEE (nodos de texto y `title`, `aria-label`,
//      `placeholder`, `alt`), sin los `value` de los campos ni las clases.
//
//  Lleva el nombre del lote para no pisar el que escriban los otros lotes en
//  paralelo; la costura del italiano puede unificarlos.
// ============================================================================

import { DICCIONARIOS, IT_PARCIAL } from '../i18n/diccionario'

export type Diccionarios = [Record<string, string>, Record<string, string>, Partial<Record<string, string>>]

function entidades(s: string): string {
  return s
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

/** El texto que se lee de un HTML rendido: nodos de texto y atributos visibles. */
export function legible(crudo: string): string {
  const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
  return entidades(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
}

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const trozos = (s: string, min: number) =>
  s.split(/\{\w+\}/).map((t) => t.trim()).filter((t) => t.length >= min)

/**
 * El ingles de las claves de OTROS lotes que todavia no tienen italiano: lo
 * que la pantalla pinta en ingles por la caida y que no es de este lote (la
 * etapa de Comercial negociacion en Captacion, el aviso de la franja de
 * `compartidos`). Un trozo ingles nuestro que tambien este ahi es ambiguo
 * —«Approved» es de los dos— y no se cuenta; uno que solo es nuestro, si.
 */
export function inglesDeOtrosLotes(mios: Diccionarios[]): string[] {
  const propias = new Set(mios.flatMap(([es]) => Object.keys(es)))
  const en = DICCIONARIOS.en as Record<string, string>
  const it = IT_PARCIAL as Partial<Record<string, string>>
  return Object.keys(en).filter((k) => !propias.has(k) && !it[k]).map((k) => en[k])
}

/**
 * Las claves del lote cuyo ingles o espanol se ve en el texto italiano.
 * `min` es el largo minimo del trozo (los cortos chocan con datos y palabras
 * sueltas); `ajenos` son datos de prueba que se quitan antes de buscar.
 */
export function fugasItaliano(
  textoIt: string,
  dicc: Diccionarios[],
  opciones: { min?: number; ajenos?: string[] } = {},
): string[] {
  const min = opciones.min ?? 8
  let todo = textoIt
  for (const a of opciones.ajenos ?? []) todo = todo.split(a).join('\n')
  const deOtros = inglesDeOtrosLotes(dicc)
  const fugas: string[] = []
  for (const [es, en, it] of dicc) {
    for (const clave of Object.keys(es)) {
      const italiano = it[clave] ?? ''
      for (const [idioma, frase] of [['en', en[clave]], ['es', es[clave]]] as const) {
        for (const t of trozos(frase, min)) {
          if (italiano.includes(t)) continue
          if (idioma === 'en' && deOtros.some((o) => o.includes(t))) continue
          if (new RegExp(`(^|[^\\p{L}])${escapar(t)}($|[^\\p{L}])`, 'u').test(todo)) {
            fugas.push(`${clave} · ${idioma} «${t}»`)
          }
        }
      }
    }
  }
  return [...new Set(fugas)]
}

/**
 * Las claves cuyo italiano es COPIA del ingles o del espanol (y esos dos
 * difieren). El barrido de arriba no las ve —si el italiano de una clave ES el
 * ingles, su trozo «esta en el italiano» y no cuenta—, asi que un ingles o un
 * espanol pegado en `IT_*` pasaria. Hay copias legitimas (cognados:
 * «Cliente», «IVA», «Tipo»; anglicismos: «Email», «In pipeline»): van en
 * `IGUALES_A_PROPOSITO_L4` con su clave.
 */
export function copiasDeOtroIdioma(dicc: Diccionarios[]): string[] {
  const copias: string[] = []
  for (const [es, en, it] of dicc) {
    for (const k of Object.keys(es)) {
      if (en[k] === es[k]) continue
      if (it[k] === en[k]) copias.push(`en ${k}`)
      if (it[k] === es[k]) copias.push(`es ${k}`)
    }
  }
  return copias
}

/** Copias que SON el italiano correcto (medido el 2026-11-03, una por una). */
export const IGUALES_A_PROPOSITO_L4 = new Set([
  // Cognados del espanol.
  'es campanas.ficha.iva-pct', 'es campanas.ficha.documento', 'es campanas.ficha.seccion.completo',
  'es campanas.facturacion.cliente', 'es campanas.facturacion.rfc', 'es campanas.facturacion.uso',
  'es campanas.facturacion.iva', 'es campanas.evidencia.foto', 'es campanas.doohmain.dia.1',
  'es campanas.doohmain.dia.2', 'es campanas.doohmain.dia.0', 'es campanas.doohmain.cliente',
  'es campanas.validacion.motivo',
  'es finanzas.comun.cliente', 'es finanzas.comun.iva-pct', 'es finanzas.cobranza.saldo', 'es finanzas.pago.subtitulo',
  'es finanzas.estado-cuenta.col.saldo', 'es finanzas.csv.periodo', 'es finanzas.csv.archivo.cliente',
  'es finanzas.comprobante.serie', 'es finanzas.comprobante.iva',
  'es clientes.lista.cliente.uno', 'es clientes.col.cliente', 'es clientes.col.tipo', 'es clientes.form.tipo',
  'es clientes.form.iva', 'es clientes.comisiones.col.cliente', 'es clientes.captacion.tipo.cliente',
  'es clientes.captacion.campo.tipo-pantalla', 'es clientes.captacion.solo-nota', 'es clientes.captacion.col.tipo',
  'es reportes.periodos.palabra.uno', 'es reportes.col.trimestre', 'es reportes.col.superficie', 'es reportes.col.consumo',
  'es reportes.col.costo-kwh', 'es reportes.desglose.periodo', 'es reportes.tabla.visitas.uno', 'es reportes.cuenta.trimestre.uno',
  'es inicio.margen-sub', 'es inicio.urgentes.uno', 'es inicio.incidencia.vandalismo',
  // Anglicismos que el italiano usa tal cual.
  'en clientes.col.pipeline', 'en clientes.captacion.form.correo',
])

/**
 * Las reglas de estilo del italiano que la validacion del L4 (03/11) fijo y
 * que se pueden comprobar en el diccionario. Devuelve `clave · regla`.
 *
 *  · NUNCA un articulo delante de una fecha (H2): la fecha llega formateada
 *    («8 dic 2026», «11 nov 2026») y el articulo tendria que elidirse («l’8»,
 *    «dall’11»), cosa que un hueco no puede hacer. Se escribe «in data
 *    {fecha}», «fino al giorno {fin}» o «Etiqueta: {fecha}».
 *  · DOOHmain va con «su» (H8): «su DOOHmain», no «in»/«a». La unica
 *    excepcion es dirigirse a el («Chiedi a DOOHmain»).
 *  · El candado de facturacion es «blocco fatturazione» (alineado con L3), no
 *    «lucchetto».
 *  · «incidente» es un accidente: solo para `*.incidencia.accidente`; la
 *    incidencia es «anomalia» (H3).
 *  · Las periodicidades de las cuotas van en adjetivo (H4): «rate
 *    quindicinali / bimestrali / semestrali».
 */
const ARTICULO_ANTES_DE_FECHA =
  /(?:^|[^\p{L}’])(?:il|lo|la|l’|al|allo|alla|dal|dallo|dalla|del|dello|della|nel|sul|tra il|fra il|entro il)\s*\{(?:fecha|desde|hasta|fin|inicio|corte|periodo)\}/iu

export function reglasDelItaliano(dicc: Diccionarios[]): string[] {
  const malas: string[] = []
  for (const [es, , it] of dicc) {
    for (const k of Object.keys(es)) {
      const v = it[k] ?? ''
      if (ARTICULO_ANTES_DE_FECHA.test(v)) malas.push(`${k} · articulo delante de una fecha`)
      if (/\b(?:in|a) DOOHmain\b/.test(v.replace(/Chiedi(?: di nuovo)? a DOOHmain/g, ''))) malas.push(`${k} · DOOHmain sin «su»`)
      if (/lucchett/i.test(v)) malas.push(`${k} · «lucchetto» (es «blocco fatturazione»)`)
      if (/incident/i.test(v) && !k.endsWith('.incidencia.accidente')) malas.push(`${k} · «incidente» (es «anomalia»)`)
      if (/rate (?:due volte al mese|ogni due mesi|ogni sei mesi)/.test(v)) malas.push(`${k} · periodicidad en letra`)
    }
  }
  return malas
}

/**
 * Palabras ESPANOLAS frecuentes que no existen en italiano. El barrido por
 * trozos no ve un italiano a medias («Sin movimento in questo periodo»: ni el
 * espanol ni el ingles enteros estan a la vista); esto si. Se busca palabra
 * entera, sin distinguir mayusculas, en el texto italiano ya sin datos de
 * prueba.
 */
export const PALABRAS_ESPANOLAS = [
  'sin', 'los', 'las', 'el', 'y', 'pero', 'aquí', 'está', 'están', 'también', 'todavía', 'ningún', 'ninguna', 'hay',
  'desde', 'hasta', 'cuando', 'según', 'fecha', 'pantalla', 'pantallas', 'campaña', 'campañas', 'factura', 'facturas',
  'cobranza', 'renta', 'vencida', 'vencido', 'monto', 'pago', 'pagos', 'reporte', 'sitio', 'sitios', 'tarifa',
  'movimiento', 'guardar', 'cancelar', 'buscar', 'nuevo', 'nueva', 'borrar', 'editar', 'ver', 'mes', 'meses', 'días',
]
export function palabrasEspanolas(texto: string, ajenos: string[] = []): string[] {
  let todo = texto
  for (const a of ajenos) todo = todo.split(a).join('\n')
  const vistas = new Set<string>()
  for (const p of PALABRAS_ESPANOLAS) {
    const m = todo.match(new RegExp(`(?:^|[^\\p{L}])(${p})(?=$|[^\\p{L}])`, 'iu'))
    if (m) {
      const i = m.index ?? 0
      vistas.add(`«${p}» en «${todo.slice(Math.max(0, i - 25), i + p.length + 25).replace(/\s+/g, ' ').trim()}»`)
    }
  }
  return [...vistas]
}

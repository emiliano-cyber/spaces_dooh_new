import { DICCIONARIOS } from './diccionario'
import { textoLegible } from './guardias-ingles'
import { huellasEnItaliano } from './guardias-italiano'

// ============================================================================
//  lib/i18n/barrido-italiano.ts — EL BARRIDO GLOBAL DEL HTML ITALIANO.
// ----------------------------------------------------------------------------
//  Pulido del italiano (2026-11-04). Cada lote traia su propio barrido, con
//  sus listas de frases y solo sobre sus pantallas. Esto barre TODO el HTML
//  italiano que rinden las pruebas (`I18N_VOLCAR_IT` y los estados italianos
//  de `I18N_VOLCAR_TODO`) contra el diccionario ENTERO:
//
//    · una FRASE ajena: un trozo de un texto espanol o ingles del diccionario
//      que ningun texto italiano contiene. Si asoma en el HTML italiano, o es
//      un texto olvidado o es un dato (y se declara);
//    · una HUELLA de formato: lo que ya mira `huellasEnItaliano`.
//
//  Lo que se pinta dentro de un papel con `lang` de otro idioma (B68, B72) se
//  quita antes de barrer: un papel de una instancia espanola va en espanol a
//  proposito (ADR 0049).
//
//  Lo corre `barrido-italiano.test.ts` con `I18N_BARRIDO_IT=<carpetas>`
//  (`scripts/i18n-barrido-italiano.mjs` lo prepara entero). Las frases que
//  salen y son a proposito van en `A_PROPOSITO_IT`, con su porque.
// ============================================================================

export interface TrozoAjeno {
  trozo: string
  idioma: 'es' | 'en'
  clave: string
}

const PALABRA = /\p{L}{2,}/gu

/** Normaliza para comparar: minusculas, apostrofos y espacios unificados. */
export function normalizar(s: string): string {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()
}

// El texto de la pantalla, normalizado SIN juntar nodos: `textoLegible` deja
// un salto de linea entre nodos y se conserva, para que «CMS DOOHmain» + «ID in
// DOOHmain» no se lea como el «DOOHmain ID» del ingles.
function normalizarPantalla(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n\s*/g, '\n')
    .trim()
}

/**
 * Los trozos de los textos espanoles e ingleses del diccionario que NINGUN
 * texto italiano contiene. Un texto se parte por sus huecos `{…}` (lo que va
 * en el hueco es dato) y se queda con los trozos de al menos dos palabras y
 * ocho letras: «de», «Total» o «Email» son de los tres idiomas y no dicen
 * nada.
 */
export function trozosAjenos(
  dic: { es: Record<string, string>; en: Record<string, string>; it: Record<string, string> } = DICCIONARIOS,
): TrozoAjeno[] {
  const italiano = Object.values(dic.it).map(normalizar).join('\n')
  const vistos = new Set<string>()
  const out: TrozoAjeno[] = []
  for (const idioma of ['es', 'en'] as const) {
    for (const [clave, valor] of Object.entries(dic[idioma])) {
      for (const crudo of valor.split(/\{\w+\}/)) {
        const trozo = crudo.replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '')
        if (trozo.length < 8 || (trozo.match(PALABRA) ?? []).length < 2) continue
        const n = normalizar(trozo)
        if (vistos.has(n) || italiano.includes(n)) continue
        vistos.add(n)
        out.push({ trozo, idioma, clave })
      }
    }
  }
  return out
}

/**
 * Quita lo que va dentro de un `<div lang="es|en" style="display:contents">`
 * (B68, B72): un papel en el idioma de otra instancia no es un olvido.
 */
export function sinPartesEnOtroIdioma(html: string): string {
  const abre = /<div lang="(?:es|en)" style="display:contents">/g
  let salida = html
  for (;;) {
    abre.lastIndex = 0
    const m = abre.exec(salida)
    if (!m) return salida
    let i = m.index + m[0].length
    let nivel = 1
    const etiqueta = /<(\/?)div\b[^>]*>/g
    etiqueta.lastIndex = i
    for (let t = etiqueta.exec(salida); t; t = etiqueta.exec(salida)) {
      nivel += t[1] ? -1 : 1
      if (nivel === 0) {
        i = t.index + t[0].length
        break
      }
    }
    if (nivel !== 0) i = salida.length
    salida = salida.slice(0, m.index) + salida.slice(i)
  }
}

/** Las frases ajenas que aparecen en un HTML italiano, con su contexto. */
export function frasesAjenas(html: string, trozos: readonly TrozoAjeno[]): { trozo: TrozoAjeno; contexto: string }[] {
  const texto = textoLegible(sinPartesEnOtroIdioma(html))
  const plano = normalizarPantalla(texto)
  const palabras = new Set(plano.match(PALABRA) ?? [])
  const out: { trozo: TrozoAjeno; contexto: string }[] = []
  for (const t of trozos) {
    const n = normalizar(t.trozo)
    const primera = n.match(PALABRA)?.[0]
    if (primera && !palabras.has(primera)) continue
    let i = plano.indexOf(n)
    while (i !== -1) {
      // Bordes de palabra: «guardar» no es «guardarla».
      const antes = plano[i - 1]
      const despues = plano[i + n.length]
      const borde = (c: string | undefined) => c === undefined || !/[\p{L}\p{N}]/u.test(c)
      if (borde(antes) && borde(despues)) {
        out.push({ trozo: t, contexto: plano.slice(Math.max(0, i - 40), i + n.length + 40).replace(/\n/g, ' ') })
        break
      }
      i = plano.indexOf(n, i + 1)
    }
  }
  return out
}

/**
 * Lo que sale y es A PROPOSITO, con su porque. Se prueba contra el trozo
 * (normalizado), contra el contexto donde aparece (normalizado) o contra el
 * nombre del estado (`archivo`: `<prueba>/<estado>/<n>.html`).
 */
export interface Excepcion {
  patron: RegExp
  en: 'trozo' | 'contexto' | 'archivo'
  /** Solo frases o solo huellas de formato; sin decir, las dos. */
  tipo?: 'frase' | 'formato'
  motivo: string
}

const ESPEJO_SC =
  'espejo de un Server Component: el texto se resolvio con la persona en ingles ANTES de que el espejo cambiara el idioma, asi que en italiano repite el ingles. El italiano de esas claves lo fijan las pruebas italianas del lote'
const CIFRAS =
  'P-L2-1: captura de cifras a la mexicana (`lib/captura-cifra.ts`), decision ROJA pendiente del dueno; no se toca en el pulido'

export const A_PROPOSITO_IT: readonly Excepcion[] = [
  // ── Datos de las pruebas (lo que escribio una persona o trae la base) ──
  { en: 'contexto', tipo: 'frase', patron: /litigio del predio/, motivo: 'dato: el motivo de la pausa legal lo escribe una persona («litigio del predio»)' },
  { en: 'contexto', tipo: 'frase', patron: /pago registrado/, motivo: 'dato: el titulo de una notificacion simulada (`DATOS_IT` de pantallas-cuenta-shell)' },
  { en: 'contexto', tipo: 'frase', patron: /error del servidor/, motivo: 'dato: el mensaje que la prueba fuerza en InvitarModal (`DATOS` de pantallas-admin)' },
  { en: 'contexto', tipo: 'formato', patron: /mozilla\/5\.0|10\.0\.0\.1/, motivo: 'dato: el navegador y la IP de una firma (constancia)' },
  { en: 'contexto', tipo: 'formato', patron: /ca-0001\.1/, motivo: 'dato: folio de una extension de campaña (CA-0001.1)' },
  { en: 'contexto', tipo: 'formato', patron: /millar «0,\d{3}»/, motivo: 'falso positivo de la guardia: «0,812» es el decimal italiano del SSIM (Space Eyes), no un millar: ninguna cifra con millar empieza por 0' },
  { en: 'contexto', patron: /contrato que celebran las partes|declara el arrendador|da en arrendamiento el espacio|ciudad de méxico, a 2 de noviembre de 2026|contrato de arrendamiento texto legal/, motivo: 'dato: el cuerpo del contrato simulado de pantallas-inventario-arrendadores (documento y firma publica) va en español sea cual sea el idioma del documento (el texto real lo arma `contrato-documento.ts`, con su propia prueba)' },
  { en: 'archivo', patron: /espejo-italiano\.test\.ts/, motivo: 'la prueba de la propia guardia: pinta una fecha inglesa a proposito para ver que muerde' },
  { en: 'archivo', tipo: 'formato', patron: /papeles-idioma-instancia\.test\.ts/, motivo: 'dato: la prueba del comprobante pasa un `formatMonto` de juguete (`$${n}`)' },
  // ── SAT ──
  { en: 'trozo', tipo: 'frase', patron: /^(g01 · adquisición de mercancías|g03 · gastos en general|p01 · por definir|por definir)$/, motivo: 'catalogo del SAT (uso del CFDI): va en español en todos los idiomas, como los regimenes fiscales' },
  // ── La marca de la foto de Space Eyes ──
  { en: 'archivo', tipo: 'formato', patron: /pantallas-spaceeyes\.test\.ts.*(texto_con_foto_capturando|la_marca_de_la_foto|barrido_italiano_con_el_diccionario_entero.*086)/, motivo: 'la marca de agua de la foto va en es-MX en todos los idiomas: es la evidencia, se graba en la imagen (lote SPACE EYES)' },
  // ── Captura de cifras (P-L2-1) ──
  { en: 'contexto', tipo: 'formato', patron: /212,500\.50|15,000\.50|65\.50|180,000|es\. 12\.9|es\. 7\.2|0\.00/, motivo: CIFRAS },
  // ── Espejos de Server Components ──
  { en: 'archivo', patron: /pantallas-inventario-arrendadores\.test\.ts.*(documento_del_contrato|firma_p_blica|B72_el_documento_del_contrato|barrido_con_el_diccionario_entero.*[\\/]07[2-7]\.html|ningun_estado_ingles_las_llev[\\/]07[2-7]\.html)/, motivo: `${ESPEJO_SC} (el documento del contrato, sin permiso y la firma publica; el cuerpo del contrato simulado va en español)` },
  { en: 'archivo', patron: /pantallas-propuestas\.test\.ts.*B72_la_propuesta_imprimible/, motivo: `${ESPEJO_SC} (la propuesta imprimible)` },
  { en: 'archivo', patron: /pantallas-cuenta-shell\.test\.ts.*(shell_404|barrido_con_los_diccionarios_enteros.*[\\/]001\.html)/, motivo: `${ESPEJO_SC} (el 404 del armazon)` },
]

export interface Hallazgo {
  archivo: string
  tipo: 'frase' | 'formato'
  detalle: string
  clave?: string
  aProposito?: string
}

function excepcion(tipo: 'frase' | 'formato', archivo: string, trozo: string, contexto: string): string | undefined {
  return A_PROPOSITO_IT.find(
    (a) =>
      (!a.tipo || a.tipo === tipo) &&
      a.patron.test(a.en === 'archivo' ? archivo : a.en === 'trozo' ? normalizar(trozo) : contexto),
  )?.motivo
}

export function barrerHtml(archivo: string, html: string, trozos: readonly TrozoAjeno[]): Hallazgo[] {
  const out: Hallazgo[] = []
  for (const { trozo, contexto } of frasesAjenas(html, trozos)) {
    const motivo = excepcion('frase', archivo, trozo.trozo, contexto)
    out.push({
      archivo,
      tipo: 'frase',
      detalle: `${trozo.idioma} «${trozo.trozo}» en «${contexto}»`,
      clave: trozo.clave,
      aProposito: motivo,
    })
  }
  const limpio = sinPartesEnOtroIdioma(html)
  // La moneda de la instancia con la que se rindio: hay pruebas USD.
  const moneda = /\bMX\$/.test(limpio) ? 'MXN' : /\bUS\$/.test(limpio) ? 'USD' : 'MXN'
  for (const h of huellasEnItaliano(limpio, { moneda })) {
    out.push({ archivo, tipo: 'formato', detalle: h, aProposito: excepcion('formato', archivo, h, normalizar(h)) })
  }
  return out
}

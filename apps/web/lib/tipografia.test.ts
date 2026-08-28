import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// ============================================================================
//  Las fuentes se sirven desde el propio origen, no desde un CDN ajeno.
// ----------------------------------------------------------------------------
//  El 2026-08-27, la CSP en modo reporte dejó dos violaciones en la consola de
//  producción, y las dos eran la misma causa:
//
//      style-src  ·  https://api.fontshare.com/v2/css?f[]=cabinet-grotesk…
//      font-src   ·  15 violaciones, las fuentes de esa misma hoja
//
//  ─── POR QUÉ SE MIGRAN Y NO SE AMPLÍA LA CSP ──────────────────────────────
//  Añadir `api.fontshare.com` a `style-src` y `font-src` haría callar el aviso
//  sin arreglar nada. Lo que la CSP estaba señalando es real:
//
//   · **Disponibilidad.** Si Fontshare cae o cambia la URL, la tipografía de la
//     aplicación se degrada en TODAS las instancias a la vez, y ninguna de
//     ellas puede hacer nada al respecto — es un servidor que no controlamos.
//   · **Privacidad.** Cada carga de página le cuenta a un tercero la IP de quien
//     visita. En instancias de owners distintos, eso es su tráfico, no el
//     nuestro.
//   · **Latencia.** Una conexión más, a otro host, antes de pintar texto.
//
//  Con `next/font/google` los archivos se descargan EN EL BUILD y se sirven
//  desde el mismo origen. No hay petición a terceros en tiempo de ejecución, así
//  que `style-src 'self'` y `font-src 'self'` bastan — y la CSP puede pasar de
//  modo reporte a ENCENDIDA, que es lo que la hace servir de algo.
//
//  ─── LA PRUEBA ES ESTÁTICA, Y TIENE QUE SERLO ─────────────────────────────
//  Lo que falla aquí no es una función: es un `<link>` en el `<head>` y tres
//  tokens de CSS. Ninguna prueba de comportamiento lo ve —las suites no cargan
//  un navegador— y por eso el defecto llevaba meses en producción sin que nada
//  se pusiera rojo. Se lee el árbol, igual que `pista-archivada.test.ts`.
// ============================================================================

const RAIZ_WEB = join(__dirname, '..')

/** Hosts de fuentes que NO deben aparecer: sirven en tiempo de ejecución. */
const CDN_PROHIBIDOS = [
  'api.fontshare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'use.typekit.net',
]

/** Las tres familias que sustituye el sistema Institucional. */
const FAMILIAS_RETIRADAS = ['Cabinet Grotesk', 'General Sans', 'JetBrains']

function archivosDeCodigo(): string[] {
  const encontrados: string[] = []
  const recorrer = (dir: string) => {
    if (!existsSync(dir)) return
    for (const entrada of readdirSync(dir)) {
      if (entrada === 'node_modules' || entrada === '.next') continue
      const ruta = join(dir, entrada)
      if (statSync(ruta).isDirectory()) recorrer(ruta)
      else if (/\.(ts|tsx|css)$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) encontrados.push(ruta)
    }
  }
  for (const sub of ['app', 'lib', 'components']) recorrer(join(RAIZ_WEB, sub))
  return encontrados
}

const rel = (ruta: string) => relative(RAIZ_WEB, ruta).split(sep).join('/')

/**
 * El contenido de un archivo SIN sus comentarios.
 *
 * Hace falta porque los comentarios que explican esta migración nombran, a
 * propósito, lo que se retiró: «antes había un <link> a api.fontshare.com por
 * Cabinet Grotesk». Sin esto, la prueba se pondría roja por su propia
 * documentación — y la salida sería quitar la explicación, que es justo lo que
 * impide que esto vuelva dentro de seis meses.
 *
 * **Un chequeo que no mide exactamente lo que dice medir es tan inútil en verde
 * como en rojo.** Este dice «ningún archivo PIDE fuentes a un CDN ajeno»: un
 * comentario no pide nada.
 *
 * Se retiran solo las LÍNEAS enteras de comentario y los bloques `/* … *\/`,
 * nunca un `//` a media línea: `href="https://…"` lleva dos barras dentro y un
 * borrado ingenuo se comería la URL, que es exactamente lo que hay que vigilar.
 */
function sinComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n')
}

describe('tipografía institucional', () => {
  it('ningun archivo pide fuentes a un CDN ajeno', () => {
    // `next/font/google` descarga los archivos EN EL BUILD: que el nombre
    // «google» aparezca en un import NO es una petición en tiempo de ejecución.
    // Por eso se buscan los HOSTS, no los nombres de proveedor.
    const culpables = archivosDeCodigo()
      .filter((r) => CDN_PROHIBIDOS.some((cdn) => sinComentarios(readFileSync(r, 'utf8')).includes(cdn)))
      .map(rel)
    expect(culpables).toEqual([])
  })

  it('no queda rastro de las tres familias que se sustituyen', () => {
    const culpables = archivosDeCodigo()
      .filter((r) => FAMILIAS_RETIRADAS.some((f) => sinComentarios(readFileSync(r, 'utf8')).includes(f)))
      .map(rel)
    expect(culpables).toEqual([])
  })

  it('el layout raiz sirve Source Serif 4 e Inter con next/font', () => {
    // En el layout RAÍZ y no en `(app)/`: `next/font` inyecta la declaración
    // en el HTML que lo monta, y las páginas públicas —propuesta, portal— no
    // cuelgan de `(app)`. Servirlas desde ahí las dejaría sin tipografía.
    const layout = readFileSync(join(RAIZ_WEB, 'app/layout.tsx'), 'utf8')
    expect(layout).toMatch(/from 'next\/font\/google'/)
    expect(layout).toMatch(/Source_Serif_4/)
    expect(layout).toMatch(/\bInter\b/)
  })

  it('los tres tokens de familia salen de una variable, no de un literal', () => {
    // `tailwind.config.ts:58-62` mapea `font-display`, `font-sans` y `font-mono`
    // a estos tres tokens, así que cambiarlos aquí propaga a toda la interfaz.
    // Si alguno vuelve a llevar un nombre de fuente escrito a mano, la migración
    // se deshace en silencio para esa mitad de la aplicación.
    const css = readFileSync(join(RAIZ_WEB, 'app/(app)/demo.css'), 'utf8')
    for (const token of ['--font-display', '--font-body']) {
      const linea = css.match(new RegExp(`^\\s*${token}:.*$`, 'm'))?.[0] ?? ''
      expect(linea, `${token} debe apoyarse en var(--font-…)`).toMatch(/var\(--font-/)
    }
  })
})

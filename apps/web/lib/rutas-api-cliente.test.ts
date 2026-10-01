import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// ============================================================================
//  Toda llamada del NAVEGADOR a la API lleva el basePath `/spaces-dooh`.
// ----------------------------------------------------------------------------
//  `next.config.mjs` declara `basePath: '/spaces-dooh'`, y NO hay ningún parche
//  de `window.fetch` que lo añada. Una ruta escrita `/api/...` sale hacia el
//  ORIGEN, no hacia la app, y lo que vuelve es el 404 de Next con cuerpo HTML:
//  la pantalla se queda vacía o dice «no se pudo cargar», sin ningún error útil.
//
//  Pasó el 2026-09-18 en Reportes, y el 2026-09-30 apareció en SEIS módulos a
//  la vez —franjas y temporadas, la rejilla de cada pantalla, códigos
//  promocionales, paquetes, descuentos por volumen, la franja programada— más
//  la subida de recibos de luz. Ninguna prueba lo veía: las e2e llaman a la API
//  con el prefijo ya puesto, y las unitarias no ejecutan las pantallas. Lo vio
//  el dueño abriendo Franjas y temporadas: «no funciona».
//
//  Esta prueba lee el código del cliente y falla si alguna cadena empieza por
//  `/api/`. Los comentarios se ignoran: citan rutas a propósito.
// ============================================================================

const RAIZ = join(__dirname, '..')
const CARPETAS = ['lib', 'components', 'app']
// Código de servidor y pruebas: ahí `/api/` es legítimo (rutas, arnés e2e).
const EXCLUIDO = [
  `lib${sep}server${sep}`,
  `lib${sep}test${sep}`,
  `app${sep}api${sep}`,
]

function archivos(dir: string): string[] {
  const out: string[] = []
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) {
      if (n === 'node_modules' || n === '.next') continue
      out.push(...archivos(p))
    } else if (/\.(ts|tsx)$/.test(n) && !/\.test\.(ts|tsx)$/.test(n)) {
      out.push(p)
    }
  }
  return out
}

/** Quita comentarios de línea y de bloque, conservando los saltos de línea. */
function sinComentarios(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

function infractores(): string[] {
  const out: string[] = []
  for (const carpeta of CARPETAS) {
    for (const f of archivos(join(RAIZ, carpeta))) {
      const rel = relative(RAIZ, f)
      if (EXCLUIDO.some((e) => rel.startsWith(e))) continue
      sinComentarios(readFileSync(f, 'utf8'))
        .split('\n')
        .forEach((linea, i) => {
          if (/['"`]\/api\//.test(linea)) out.push(`${rel.split(sep).join('/')}:${i + 1}  ${linea.trim()}`)
        })
    }
  }
  return out
}

describe('las llamadas del navegador a la API llevan /spaces-dooh', () => {
  it('ninguna cadena del código del cliente empieza por «/api/»', () => {
    expect(infractores()).toEqual([])
  })

  it('el detector muerde: una ruta sin prefijo SÍ cuenta, un comentario NO', () => {
    const codigo = "const r = await fetch('/api/x/')\n// fetch('/api/en-comentario')"
    const lineas = sinComentarios(codigo).split('\n').filter((l) => /['"`]\/api\//.test(l))
    expect(lineas).toHaveLength(1)
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

// ============================================================================
//  GUARDIA · el estándar de la coma de miles (08/10) no se vuelve a romper.
//
//  Toda cifra que se muestra lleva coma cada tres dígitos, al estilo es-MX. No
//  hay forma de cazar con un grep cada `{n}` crudo en un JSX —eso lo dice la
//  convención (`vault/06-Operacion/convenciones.md`)—, pero sí las dos formas
//  de romperlo que ya pasaron y se ven en el fuente:
//
//   · Un `toLocaleString` sin locale o con otro que no sea es-MX. Sin locale
//     manda el navegador, y en 'es'/'es-ES' 2500 sale SIN separador y 12500
//     con PUNTO. Inicio tenía un 'es-PE'.
//   · El eje «`${v / 1000}k`», que pintaba «2500k» en la gráfica de Inicio.
//
//  Lee el FUENTE, sin comentarios, igual que las otras guardias del repo.
// ============================================================================

const RAIZ = join(__dirname, '..')
const CARPETAS = ['app', 'components', 'lib']

function archivos(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === 'test') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) archivos(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
}

const FUENTES = CARPETAS.flatMap((c) => archivos(join(RAIZ, c))).map((f) => ({
  ruta: relative(RAIZ, f).replace(/\\/g, '/'),
  lineas: sinComentarios(readFileSync(f, 'utf8')).split('\n'),
}))

function buscar(re: RegExp): string[] {
  const hallados: string[] = []
  for (const { ruta, lineas } of FUENTES) {
    lineas.forEach((l, i) => {
      if (re.test(l)) hallados.push(`${ruta}:${i + 1}  ${l.trim()}`)
    })
  }
  return hallados
}

describe('GUARDIA · coma de miles', () => {
  it('se leen archivos de verdad (la guardia no está mirando a un sitio vacío)', () => {
    expect(FUENTES.length).toBeGreaterThan(300)
  })

  it('ningún toLocaleString sin locale o con uno distinto de es-MX', () => {
    expect(buscar(/toLocaleString\(\s*(\)|undefined|'(?!es-MX')[^']*'|"(?!es-MX")[^"]*")/)).toEqual([])
  })

  it('ningún eje «${v / 1000}k» a mano: para dinero, formatMontoCorto', () => {
    expect(buscar(/\/\s*1000\s*\}k/)).toEqual([])
  })

  it('NEGATIVO: la guardia SÍ caza las dos formas (si no, estaría en verde por no mirar)', () => {
    const re1 = /toLocaleString\(\s*(\)|undefined|'(?!es-MX')[^']*'|"(?!es-MX")[^"]*")/
    expect(re1.test("n.toLocaleString('es-PE')")).toBe(true)
    expect(re1.test('n.toLocaleString()')).toBe(true)
    expect(re1.test("n.toLocaleString('es-MX', { maximumFractionDigits: 0 })")).toBe(false)
    expect(/\/\s*1000\s*\}k/.test('`${v / 1000}k`')).toBe(true)
  })
})

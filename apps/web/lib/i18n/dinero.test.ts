import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import {
  MONEDA,
  LOCALE_DE_IDIOMA,
  formatearDinero,
  formatearDineroRedondo,
  formatearNumero,
  formatearFecha,
} from './dinero'
import { IDIOMAS } from './idiomas'
import { DICCIONARIOS } from './diccionario'

// ============================================================================
//  I18N-02 · TRADUCIR NO PUEDE MOVER EL DINERO.
// ----------------------------------------------------------------------------
//  Decision del dueno (2026-09-30): «el sistema se rige 100% en pesos mexicanos
//  por ahora, despues lo moveremos». UNA moneda, declarada UNA vez.
//
//  Lo que se prueba aqui no es que el texto salga de una forma concreta —eso
//  depende de la version de ICU que traiga Node y se rompe solo—, sino la
//  INVARIANTE que importa:
//
//      el mismo importe, en los dos idiomas, VALE LO MISMO
//      y LLEVA LA MISMA MONEDA.
//
//  El modo de fallo que esto ataca no da error y no se ve en una captura: basta
//  que alguien, traduciendo una pantalla, escriba `currency: 'USD'` o cambie un
//  `es-MX` por un `en-US` dejando la moneda suelta, y la MISMA pantalla afirma
//  otro precio segun el idioma. Un numero creible y equivocado.
// ============================================================================

// Lee el numero que un humano veria en el texto formateado. Deliberadamente
// tonta: si el formateo aplicara un factor de conversion, esto lo veria.
function numeroLeido(texto: string): number {
  const sinMoneda = texto.replace(/[^\d.,-]/g, '')
  // En los dos idiomas soportados (es-MX y en-US) el decimal es el PUNTO y el
  // de miles la COMA, asi que basta con quitar las comas.
  return Number(sinMoneda.replace(/,/g, ''))
}

const IMPORTES = [0, 1, 99.99, 1234.5, 1_000_000, 45_678_901.23, -250.75, 0.01]

describe('MONEDA · una sola, y en un solo sitio', () => {
  it('es el peso mexicano', () => {
    expect(MONEDA).toBe('MXN')
  })

  it('coincide con el respaldo de totalizarMoneda', () => {
    // `lib/data/derive.ts:282` hace `|| 'MXN'` cuando una fila no trae moneda.
    // Si las dos se despegaran, el total y su etiqueta discreparian en la misma
    // pantalla.
    expect(MONEDA).toBe('MXN')
  })

  it('hay un locale por idioma, y el locale NO es una moneda', () => {
    expect(LOCALE_DE_IDIOMA.es).toBe('es-MX')
    expect(LOCALE_DE_IDIOMA.en).toBe('en-US')
    for (const i of IDIOMAS) expect(typeof LOCALE_DE_IDIOMA[i]).toBe('string')
  })

  it('`formatearDinero` NO acepta una moneda: no se puede pasar la equivocada', () => {
    // La firma es la defensa. Si algun dia alguien le anade un tercer
    // parametro, esta prueba obliga a venir aqui a explicarlo.
    expect(formatearDinero.length).toBe(2)
    expect(formatearDineroRedondo.length).toBe(2)
  })
})

describe('LA PRUEBA NEGATIVA · el mismo importe vale lo mismo en los dos idiomas', () => {
  it.each(IMPORTES)('%s se lee igual en espanol y en ingles', (monto) => {
    const es = formatearDinero(monto, 'es')
    const en = formatearDinero(monto, 'en')

    // 1) Los dos idiomas dan el MISMO numero.
    expect(numeroLeido(es)).toBe(numeroLeido(en))
    // 2) Y ese numero es el del dato de origen: ninguno aplica un factor.
    expect(numeroLeido(es)).toBeCloseTo(monto, 2)
    expect(numeroLeido(en)).toBeCloseTo(monto, 2)
  })

  it.each(IMPORTES)('%s lleva la MISMA moneda en los dos idiomas', (monto) => {
    const es = formatearDinero(monto, 'es')
    const en = formatearDinero(monto, 'en')

    // Ninguno de los dos puede hablar de otra divisa.
    for (const texto of [es, en]) {
      expect(texto).not.toMatch(/USD/)
      expect(texto).not.toMatch(/US\$/)
      expect(texto).not.toMatch(/EUR|€|GBP|£|¥/)
    }

    // Y lo que `Intl` resuelve de verdad —no lo que le pedimos— es MXN en los
    // dos idiomas. Si alguien colara otra moneda por detras, esto lo veria.
    const resueltas = IDIOMAS.map(
      (idioma) =>
        new Intl.NumberFormat(LOCALE_DE_IDIOMA[idioma], { style: 'currency', currency: MONEDA })
          .resolvedOptions().currency,
    )
    expect(new Set(resueltas)).toEqual(new Set(['MXN']))
  })

  it('el ingles DESAMBIGUA el peso en vez de convertirlo', () => {
    // En `es-MX` el peso se escribe `$`, que un lector anglosajon lee como
    // dolar. En `en-US`, ICU escribe `MX$`: sigue siendo el MISMO importe en
    // pesos, y encima lo dice. Por eso no se fuerza el locale mexicano en la
    // rama inglesa.
    const en = formatearDinero(1234.5, 'en')
    const es = formatearDinero(1234.5, 'es')
    expect(en).toMatch(/MX\$/)
    expect(es).toMatch(/^\$/)
    expect(numeroLeido(en)).toBe(numeroLeido(es))
  })

  it('la separacion anglosajona de miles se respeta, y no cambia el valor', () => {
    expect(formatearDinero(45678901.23, 'en')).toMatch(/45,678,901\.23/)
    expect(formatearDinero(45678901.23, 'es')).toMatch(/45,678,901\.23/)
  })

  it('dos decimales en los dos idiomas', () => {
    expect(formatearDinero(1234.5, 'es')).toMatch(/1,234\.50/)
    expect(formatearDinero(1234.5, 'en')).toMatch(/1,234\.50/)
  })

  it('la version redonda tampoco cambia de valor ni de moneda con el idioma', () => {
    for (const monto of [0, 1500, 1_000_000]) {
      const es = formatearDineroRedondo(monto, 'es')
      const en = formatearDineroRedondo(monto, 'en')
      expect(numeroLeido(es)).toBe(monto)
      expect(numeroLeido(en)).toBe(monto)
      expect(en).not.toMatch(/USD|US\$/)
    }
  })

  it('un monto que no es un numero no pinta «NaN» en la pantalla', () => {
    // Un `null` de la base o un campo vacio acaban aqui antes o despues.
    // Ensenar «$NaN» es peor que ensenar un guion.
    for (const idioma of IDIOMAS) {
      expect(formatearDinero(Number.NaN, idioma)).toBe('—')
      expect(formatearDinero(Number.POSITIVE_INFINITY, idioma)).toBe('—')
      expect(formatearDinero(null as unknown as number, idioma)).toBe('—')
      expect(formatearDinero(undefined as unknown as number, idioma)).toBe('—')
    }
  })
})

describe('formatearNumero · las cantidades sin moneda tampoco cambian de valor', () => {
  it.each([0, 7, 1500, 1_234_567, 12.75])('%s se lee igual en los dos idiomas', (n) => {
    expect(numeroLeido(formatearNumero(n, 'es'))).toBe(n)
    expect(numeroLeido(formatearNumero(n, 'en'))).toBe(n)
  })

  it('no lleva simbolo de moneda en ningun idioma', () => {
    for (const idioma of IDIOMAS) {
      expect(formatearNumero(1500, idioma)).not.toMatch(/\$|€|£/)
    }
  })
})

describe('formatearFecha · cambia como se escribe, no que dia es', () => {
  it('el mismo instante en los dos idiomas', () => {
    const d = new Date('2026-09-30T12:00:00Z')
    const es = formatearFecha(d, 'es')
    const en = formatearFecha(d, 'en')
    // No se compara el texto —depende de ICU— sino que los dos nombran el
    // mismo dia y el mismo ano.
    expect(es).toMatch(/2026/)
    expect(en).toMatch(/2026/)
    expect(es).toMatch(/30/)
    expect(en).toMatch(/30/)
  })

  it('una fecha ilegible no pinta «Invalid Date»', () => {
    for (const idioma of IDIOMAS) {
      expect(formatearFecha('no es una fecha', idioma)).toBe('—')
    }
  })
})

// ─── Las redes de seguridad para los LOTES QUE FALTAN ───────────────────────
//
// Las de arriba protegen el ayudante. Estas protegen las decenas de pantallas
// que quedan por traducir, que es donde de verdad puede colarse el fallo:
// todas pasan por encima de codigo que pinta dinero.

const RAIZ = path.resolve(__dirname, '..', '..')
const ESTE = 'lib/i18n/dinero.test.ts'
// Recorrido propio del disco en vez de `git ls-files`: la prueba no debe
// depender de que exista `git` en la maquina que la corre (ni en CI ni en la
// imagen). Se podan a mano las carpetas que no son fuente.
const PODAR = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo', '.git'])

function fuentes(dir: string = RAIZ, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (PODAR.has(e.name)) continue
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) fuentes(abs, acc)
    else if (/\.tsx?$/.test(e.name)) acc.push(path.relative(RAIZ, abs).replace(/\\/g, '/'))
  }
  return acc
}

describe('GUARDIA 1 · en todo apps/web, formatear moneda es formatear MXN', () => {
  it('encuentra archivos que revisar (el arnes no esta vacio)', () => {
    // Sin esto, un fallo del recorrido dejaria las dos pruebas de abajo en
    // verde por no mirar nada — el clasico arnes que no muerde.
    const todos = fuentes()
    expect(todos.length).toBeGreaterThan(100)
    expect(todos).toContain('lib/i18n/dinero.ts')
  })

  it('todo `style: currency` declara `currency: MXN` en la misma llamada', () => {
    const culpables: string[] = []
    for (const rel of fuentes()) {
      if (rel === ESTE) continue
      const texto = readFileSync(path.join(RAIZ, rel), 'utf8')
      const re = /style:\s*['"]currency['"]/g
      let m: RegExpExecArray | null
      while ((m = re.exec(texto)) !== null) {
        // Ventana de 200 caracteres: cubre de sobra un objeto de opciones y no
        // se estira hasta el siguiente formateo.
        const ventana = texto.slice(m.index, m.index + 200)
        // Se admite el literal 'MXN' o la constante `MONEDA`, que es el unico
        // sitio donde ese literal puede vivir.
        if (!/currency:\s*(['"]MXN['"]|MONEDA\b)/.test(ventana)) {
          const linea = texto.slice(0, m.index).split('\n').length
          culpables.push(`${rel}:${linea}`)
        }
      }
    }
    expect(culpables).toEqual([])
  })

  it('ningun `currency:` se decide con un ternario sobre el idioma o el locale', () => {
    // El fallo exacto que se teme, escrito: `currency: idioma === 'en' ? … : …`.
    // Si alguna vez aparece se lee aqui, y no en la pantalla de un cliente.
    const culpables: string[] = []
    for (const rel of fuentes()) {
      if (rel === ESTE) continue
      const texto = readFileSync(path.join(RAIZ, rel), 'utf8')
      if (/currency:\s*[^,\n}]*\b(idioma|locale|lang)\b/.test(texto)) culpables.push(rel)
    }
    expect(culpables).toEqual([])
  })
})

describe('GUARDIA 2 · ningun diccionario puede llevar dinero dentro', () => {
  it('ni un simbolo de moneda, ni un codigo, ni una cifra con separador de miles', () => {
    // Un traductor NUNCA debe poder escribir «$1,000» en el diccionario: seria
    // una cifra que no sale de la base, que nadie recalcula, y que quedaria
    // congelada en un idioma y no en el otro.
    const culpables: string[] = []
    for (const idioma of IDIOMAS) {
      for (const [clave, valor] of Object.entries(DICCIONARIOS[idioma])) {
        if (/[$€£¥]/.test(valor)) culpables.push(`${idioma}:${clave} · simbolo de moneda`)
        if (/\b\d{1,3}(,\d{3})+\b/.test(valor)) culpables.push(`${idioma}:${clave} · cifra con miles`)
        if (/\b(MXN|USD|EUR|PEN)\b/.test(valor)) culpables.push(`${idioma}:${clave} · codigo de moneda`)
      }
    }
    expect(culpables).toEqual([])
  })
})

describe('GUARDIA 3 · ninguna pantalla deja ELEGIR moneda', () => {
  // Puesto el 2026-09-30, cuando el dueno decidio «deja todo en pesos» y salio
  // el selector MXN/USD del alta de contratos (`ContratoWizard.tsx`).
  //
  // No es una regla de estilo: desde ese mismo dia el dinero se formatea con UNA
  // constante, asi que un contrato guardado en USD se PINTARIA como pesos --el
  // mismo numero, otra divisa-- sin dar ningun error. Mil dolares leidos como
  // mil pesos se equivocan por veinte veces, y nada en la pantalla lo delata.
  //
  // Por eso el guard mira la PUERTA DE ENTRADA y no el almacen: las columnas
  // `moneda` siguen existiendo a proposito --quitarlas perderia el dato de
  // cualquier fila que ya este en otra divisa--. Lo que no puede volver es que
  // alguien capture una.
  it('no hay un `<option value="USD">` ni ningun otro codigo de moneda ofrecido', () => {
    const culpables: string[] = []
    for (const rel of fuentes()) {
      if (rel.startsWith('lib/i18n/')) continue // este archivo habla DE monedas
      const src = readFileSync(path.join(RAIZ, rel), 'utf8')
      for (const m of src.matchAll(/<option[^>]*value=["'](USD|EUR|PEN|GBP|MXN)["']/g)) {
        culpables.push(`${rel} · ofrece ${m[1]}`)
      }
    }
    expect(culpables).toEqual([])
  })

  it('y el arnes mira de verdad: el patron encuentra el caso que vino a prohibir', () => {
    // Sin esto, un error en la expresion dejaria la prueba de arriba en verde
    // sin mirar nada. Es el mismo fallo que CLAUDE.md documenta: una
    // comprobacion por ausencia pasa sola.
    const comoEra = `<option value="USD">USD (dólar)</option>`
    expect([...comoEra.matchAll(/<option[^>]*value=["'](USD|EUR|PEN|GBP|MXN)["']/g)]).toHaveLength(1)
  })
})

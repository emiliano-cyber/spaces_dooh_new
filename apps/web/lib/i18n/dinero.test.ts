import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import {
  MONEDAS,
  MONEDA_POR_OMISION,
  monedaInstancia,
  fijarMonedaInstancia,
  simboloMoneda,
  nombreMoneda,
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
//  ADR 0048 (2026-11-02) · Y LA MONEDA ES DE LA INSTANCIA, NO DEL CODIGO.
// ----------------------------------------------------------------------------
//  Hasta el 02/11 habia una constante `MONEDA = 'MXN'`. Desde ese dia cada
//  instancia elige MXN o USD al nacer y NO la puede cambiar. Lo que se prueba
//  aqui sigue siendo la INVARIANTE, no un texto concreto:
//
//      el mismo importe, en los dos idiomas, VALE LO MISMO
//      y LLEVA LA MISMA MONEDA — la de la instancia, para las dos.
//
//  Y una nueva, que es la que pidio el dueno: una instancia MXN en espanol
//  se ve EXACTAMENTE como antes del 02/11. Se mide contra una copia literal de
//  la implementacion anterior, no contra lo que uno cree recordar.
// ============================================================================

// Cada prueba que cambie la moneda la deja como estaba: el valor es de modulo,
// y una prueba que lo olvidara pintaria dolares en las que corren despues.
afterEach(() => fijarMonedaInstancia(MONEDA_POR_OMISION))

// Lee el numero que un humano veria en el texto formateado. Deliberadamente
// tonta: si el formateo aplicara un factor de conversion, esto lo veria.
function numeroLeido(texto: string): number {
  const sinMoneda = texto.replace(/[^\d.,-]/g, '')
  // En los dos idiomas soportados (es-MX y en-US) el decimal es el PUNTO y el
  // de miles la COMA, asi que basta con quitar las comas.
  return Number(sinMoneda.replace(/,/g, ''))
}

const IMPORTES = [0, 1, 99.99, 1234.5, 1_000_000, 45_678_901.23, -250.75, 0.01]

describe('LA MONEDA DE LA INSTANCIA · una sola, elegida al nacer', () => {
  it('solo hay dos posibles, MXN y USD, y por omision es MXN', () => {
    expect([...MONEDAS]).toEqual(['MXN', 'USD'])
    expect(MONEDA_POR_OMISION).toBe('MXN')
    // Sin que nadie la fije, una instancia pinta pesos: es en lo que se quedan
    // todas las que existian antes del 02/11.
    expect(monedaInstancia()).toBe('MXN')
  })

  it('fijarla a USD cambia la de todos los formateadores', () => {
    fijarMonedaInstancia('USD')
    expect(monedaInstancia()).toBe('USD')
    expect(formatearDinero(1, 'en')).toBe('$1.00')
  })

  it.each(['EUR', 'PEN', 'usd', '', 'MXN ', null, undefined, 1])(
    'una moneda que no es MXN ni USD (%s) LANZA y deja la vigente como estaba',
    (mala) => {
      fijarMonedaInstancia('USD')
      expect(() => fijarMonedaInstancia(mala as unknown as string)).toThrow(/no soportada/)
      // Caer a MXN en silencio seria pintar pesos en una instancia en dolares.
      expect(monedaInstancia()).toBe('USD')
    },
  )

  it('hay un locale por idioma, y el locale NO es una moneda', () => {
    expect(LOCALE_DE_IDIOMA.es).toBe('es-MX')
    expect(LOCALE_DE_IDIOMA.en).toBe('en-US')
    for (const i of IDIOMAS) expect(typeof LOCALE_DE_IDIOMA[i]).toBe('string')
  })

  it('`formatearDinero` NO acepta una moneda: no se puede pasar la equivocada', () => {
    // La firma es la defensa. El tercer parametro son SOLO los decimales y
    // tiene valor por omision, asi que `length` sigue siendo 2. Si algun dia
    // alguien le anade una moneda, esta prueba obliga a venir aqui.
    expect(formatearDinero.length).toBe(2)
    expect(formatearDineroRedondo.length).toBe(2)
  })
})

describe('LA TABLA · el simbolo segun idioma y moneda', () => {
  // El `$` a secas es la moneda LOCAL del lector: el peso en espanol, el dolar
  // en ingles. La otra lleva prefijo. Nunca un `$` que se lea como la otra.
  const TABLA: Array<[string, 'es' | 'en', string, string]> = [
    ['MXN', 'es', '$1,234.50', '$'],
    ['MXN', 'en', 'MX$1,234.50', 'MX$'],
    ['USD', 'es', 'US$1,234.50', 'US$'],
    ['USD', 'en', '$1,234.50', '$'],
  ]
  it.each(TABLA)('%s en %s se escribe %s', (moneda, idioma, esperado, simbolo) => {
    fijarMonedaInstancia(moneda)
    expect(formatearDinero(1234.5, idioma)).toBe(esperado)
    expect(simboloMoneda(idioma)).toBe(simbolo)
  })

  it('los negativos llevan el signo delante del simbolo, en las cuatro', () => {
    fijarMonedaInstancia('USD')
    expect(formatearDinero(-1234.5, 'es')).toBe('-US$1,234.50')
    expect(formatearDinero(-1234.5, 'en')).toBe('-$1,234.50')
    fijarMonedaInstancia('MXN')
    expect(formatearDinero(-1234.5, 'es')).toBe('-$1,234.50')
    expect(formatearDinero(-1234.5, 'en')).toBe('-MX$1,234.50')
  })

  it('el nombre de la moneda para Administracion', () => {
    expect(nombreMoneda('es')).toBe('Peso mexicano (MXN)')
    fijarMonedaInstancia('USD')
    expect(nombreMoneda('es')).toBe('Dólar estadounidense (USD)')
    expect(nombreMoneda('en')).toBe('US dollar (USD)')
  })
})

// ─── PARIDAD · una instancia MXN se ve EXACTAMENTE como antes ───────────────
//
// Copia LITERAL de la implementacion que habia hasta el 02/11 (`27047bfe`,
// `lib/i18n/dinero.ts:76-101`). No se importa de ningun sitio a proposito:
// es la foto del comportamiento que el dueno pidio no mover.
function formatearDineroAntes(monto: number, idioma: 'es' | 'en'): string {
  if (!(typeof monto === 'number' && Number.isFinite(monto))) return '—'
  return new Intl.NumberFormat(LOCALE_DE_IDIOMA[idioma], {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto)
}
function formatearDineroRedondoAntes(monto: number, idioma: 'es' | 'en'): string {
  if (!(typeof monto === 'number' && Number.isFinite(monto))) return '—'
  return new Intl.NumberFormat(LOCALE_DE_IDIOMA[idioma], {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(monto)
}

// Una muestra ancha y reproducible: los bordes de siempre mas 2000 importes
// pseudoaleatorios con semilla fija, de centavos a cientos de millones y con
// signo.
function muestra(): number[] {
  const fijos = [0, -0, 0.004, 0.005, 0.01, 1, 9.995, 99.99, 999.999, 1000, 1234.5, 999_999.995,
    1_000_000, 45_678_901.23, -250.75, -0.01, -1_000_000.5, 123_456_789.12]
  let s = 20261102
  const azar = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  const otros = Array.from({ length: 2000 }, () => {
    const signo = azar() < 0.15 ? -1 : 1
    return signo * Math.round(azar() * 10 ** Math.floor(azar() * 9) * 100) / 100
  })
  return [...fijos, ...otros]
}

describe('PARIDAD · MXN se escribe igual que antes del 02/11, en los dos idiomas', () => {
  const IMPORTES_PARIDAD = muestra()

  it('formatearDinero: idéntico, importe por importe', () => {
    const distintos = IMPORTES_PARIDAD.flatMap((m) =>
      IDIOMAS.flatMap((i) =>
        formatearDinero(m, i) === formatearDineroAntes(m, i)
          ? []
          : [`${m} ${i}: ${formatearDineroAntes(m, i)} -> ${formatearDinero(m, i)}`],
      ),
    )
    expect(distintos).toEqual([])
    expect(IMPORTES_PARIDAD.length).toBeGreaterThan(2000)
  })

  it('formatearDineroRedondo: idéntico, importe por importe', () => {
    const distintos = IMPORTES_PARIDAD.flatMap((m) =>
      IDIOMAS.flatMap((i) =>
        formatearDineroRedondo(m, i) === formatearDineroRedondoAntes(m, i)
          ? []
          : [`${m} ${i}: ${formatearDineroRedondoAntes(m, i)} -> ${formatearDineroRedondo(m, i)}`],
      ),
    )
    expect(distintos).toEqual([])
  })
})

describe('LA PRUEBA NEGATIVA · el mismo importe vale lo mismo en los dos idiomas', () => {
  it.each(MONEDAS.flatMap((m) => IMPORTES.map((i) => [m, i] as const)))(
    'en una instancia %s, %s se lee igual en espanol y en ingles',
    (moneda, monto) => {
      fijarMonedaInstancia(moneda)
      const es = formatearDinero(monto, 'es')
      const en = formatearDinero(monto, 'en')

      // 1) Los dos idiomas dan el MISMO numero.
      expect(numeroLeido(es)).toBe(numeroLeido(en))
      // 2) Y ese numero es el del dato de origen: ninguno aplica un factor.
      expect(numeroLeido(es)).toBeCloseTo(monto, 2)
      expect(numeroLeido(en)).toBeCloseTo(monto, 2)
    },
  )

  it.each(IMPORTES)('en una instancia MXN, %s nunca habla de dolares', (monto) => {
    for (const texto of [formatearDinero(monto, 'es'), formatearDinero(monto, 'en')]) {
      expect(texto).not.toMatch(/USD|US\$/)
      expect(texto).not.toMatch(/EUR|€|GBP|£|¥/)
    }
  })

  it.each(IMPORTES)('en una instancia USD, %s nunca habla de pesos', (monto) => {
    fijarMonedaInstancia('USD')
    for (const texto of [formatearDinero(monto, 'es'), formatearDinero(monto, 'en')]) {
      expect(texto).not.toMatch(/MXN|MX\$/)
      expect(texto).not.toMatch(/EUR|€|GBP|£|¥/)
    }
    // Y en espanol el dolar NUNCA sale con el `$` a secas, que un lector
    // mexicano leeria como peso.
    if (Number.isFinite(monto)) expect(formatearDinero(monto, 'es')).toMatch(/US\$/)
  })

  it('lo que `Intl` resuelve de verdad es la moneda de la instancia, en los dos idiomas', () => {
    for (const moneda of MONEDAS) {
      fijarMonedaInstancia(moneda)
      const resueltas = IDIOMAS.map(
        (idioma) =>
          new Intl.NumberFormat(LOCALE_DE_IDIOMA[idioma], { style: 'currency', currency: monedaInstancia() })
            .resolvedOptions().currency,
      )
      expect(new Set(resueltas)).toEqual(new Set([moneda]))
    }
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
    for (const moneda of MONEDAS) {
      fijarMonedaInstancia(moneda)
      for (const monto of [0, 1500, 1_000_000]) {
        expect(numeroLeido(formatearDineroRedondo(monto, 'es'))).toBe(monto)
        expect(numeroLeido(formatearDineroRedondo(monto, 'en'))).toBe(monto)
      }
    }
    fijarMonedaInstancia('USD')
    expect(formatearDineroRedondo(1500, 'es')).toBe('US$1,500')
    expect(formatearDineroRedondo(1500, 'en')).toBe('$1,500')
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

describe('GUARDIA 1 · en todo apps/web, formatear moneda es formatear la de la instancia', () => {
  it('encuentra archivos que revisar (el arnes no esta vacio)', () => {
    // Sin esto, un fallo del recorrido dejaria las dos pruebas de abajo en
    // verde por no mirar nada — el clasico arnes que no muerde.
    const todos = fuentes()
    expect(todos.length).toBeGreaterThan(100)
    expect(todos).toContain('lib/i18n/dinero.ts')
  })

  it('`style: currency` solo existe en dinero.ts, y ahi declara la moneda de la instancia', () => {
    // Hasta el 02/11 se admitia `currency: 'MXN'` en cualquier archivo. Ya no:
    // un 'MXN' escrito a mano en un reporte pintaria pesos en una instancia en
    // dolares, sin error. Y tampoco basta con `currency: monedaInstancia()`
    // fuera de aqui: en `es-MX` ICU escribe el dolar «USD 1,234», no `US$`. El
    // unico sitio que sabe poner el simbolo de la tabla es `formatearDinero`.
    const culpables: string[] = []
    let enDinero = 0
    for (const rel of fuentes()) {
      if (rel === ESTE) continue
      const texto = readFileSync(path.join(RAIZ, rel), 'utf8')
      const re = /style:\s*['"]currency['"]/g
      let m: RegExpExecArray | null
      while ((m = re.exec(texto)) !== null) {
        const linea = texto.slice(0, m.index).split('\n').length
        if (rel !== 'lib/i18n/dinero.ts') {
          culpables.push(`${rel}:${linea} · formatea moneda por su cuenta`)
          continue
        }
        enDinero++
        // Ventana de 200 caracteres: cubre de sobra un objeto de opciones y no
        // se estira hasta el siguiente formateo.
        const ventana = texto.slice(m.index, m.index + 200)
        if (!/currency:\s*monedaInstancia\(\)/.test(ventana)) culpables.push(`${rel}:${linea}`)
      }
    }
    expect(culpables).toEqual([])
    // Y el arnes mira: dinero.ts SI formatea moneda, una vez.
    expect(enDinero).toBe(1)
  })

  it('ningun archivo de la app escribe una moneda a mano en un `currency:`', () => {
    const culpables: string[] = []
    for (const rel of fuentes()) {
      // dinero.ts se salta: su cabecera CITA el fallo (`currency: 'USD'`), y su
      // unico formateo ya lo mira la prueba de arriba.
      if (rel === ESTE || rel === 'lib/i18n/dinero.ts') continue
      const texto = readFileSync(path.join(RAIZ, rel), 'utf8')
      if (/currency:\s*['"][A-Z]{3}['"]/.test(texto)) culpables.push(rel)
    }
    expect(culpables).toEqual([])
  })

  it('solo dos sitios FIJAN la moneda: el lector del servidor y el proveedor del navegador', () => {
    // Un tercero que la fijara —con un valor de prueba, con una constante—
    // cambiaria la de TODA la instancia desde una pantalla.
    const permitidos = new Set([
      'lib/i18n/dinero.ts',
      'lib/i18n/moneda-cliente.tsx',
      'lib/server/moneda-instancia.ts',
    ])
    const culpables: string[] = []
    for (const rel of fuentes()) {
      if (rel === ESTE || /\.test\.tsx?$/.test(rel) || permitidos.has(rel)) continue
      const texto = readFileSync(path.join(RAIZ, rel), 'utf8')
      if (/fijarMonedaInstancia\s*\(/.test(texto)) culpables.push(rel)
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

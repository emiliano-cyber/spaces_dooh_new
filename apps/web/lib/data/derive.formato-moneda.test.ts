import { describe, it, expect, afterEach } from 'vitest'
import { formatMonto, formatMontoCorto } from './derive'
import { fijarMonedaInstancia } from '@/lib/i18n/dinero'

// ============================================================================
//  M9 de la auditoría del 04/08/2026: formato de moneda inconsistente.
//  Los dos casos citados textualmente en el informe son «$ 4897.5k» junto a
//  «$ 2,505,600.00» en la misma tarjeta, y «$ -156,986.66» sin formato contable.
//
//  Ojo: derive.moneda.test.ts es OTRA cosa — la moneda del tenant y la suma
//  entre monedas distintas. Esto es solo cómo se escribe una cifra.
// ============================================================================

describe('formatMonto', () => {
  it('separa miles y fija dos decimales', () => {
    expect(formatMonto(2505600)).toBe('$ 2,505,600.00')
    expect(formatMonto(0)).toBe('$ 0.00')
  })

  it('pone los negativos entre paréntesis, sin signo suelto', () => {
    expect(formatMonto(-156986.66)).toBe('($ 156,986.66)')
  })
})

describe('formatMontoCorto', () => {
  it('abrevia millones con unidad, no en miles de miles', () => {
    // El caso exacto del informe: 4,897,500 salía como «$ 4897.5k».
    expect(formatMontoCorto(4897500)).toBe('$ 4.9M')
  })

  it('conserva la abreviatura en miles por debajo del millón', () => {
    expect(formatMontoCorto(18500)).toBe('$ 18.5k')
    expect(formatMontoCorto(45000)).toBe('$ 45k')
  })

  it('no arrastra decimales que no aportan', () => {
    expect(formatMontoCorto(5_000_000)).toBe('$ 5M')
    expect(formatMontoCorto(1_000)).toBe('$ 1k')
  })

  it('separa miles cuando la cifra abreviada aún los tiene', () => {
    expect(formatMontoCorto(1_234_500_000)).toBe('$ 1,234.5M')
  })

  it('sube de escala cuando el redondeo desborda, en vez de escribir 1,000.0k', () => {
    // El borde: 999,999 cae en el tramo de miles pero redondea a 1000, y
    // «$ 1,000.0k» es el mismo defecto que este formateador vino a quitar.
    expect(formatMontoCorto(999_999)).toBe('$ 1M')
    expect(formatMontoCorto(999_950)).toBe('$ 1M')
  })

  it('no deja un decimal que el redondeo volvió cero', () => {
    expect(formatMontoCorto(4_999_999)).toBe('$ 5M')
  })

  it('deja las cantidades pequeñas sin abreviar', () => {
    expect(formatMontoCorto(850)).toBe('$ 850')
    expect(formatMontoCorto(0)).toBe('$ 0')
  })

  it('usa el mismo criterio contable en negativos', () => {
    expect(formatMontoCorto(-4897500)).toBe('($ 4.9M)')
  })
})

// ============================================================================
//  ADR 0048 (02/11) · la moneda es la de la INSTANCIA.
//
//  `formatMonto` y `formatMontoCorto` son las ~250 llamadas de la app, y por
//  eso no reciben moneda: la toman de `lib/i18n/dinero.ts`. Lo que se prueba
//  aqui es lo que pidio el dueno —una instancia MXN se ve IDENTICA a como se
//  veia— y que una USD nunca pinta el `$` a secas en espanol.
// ============================================================================

// Copia LITERAL de la implementacion anterior (`27047bfe`,
// `lib/data/derive.ts:1425-1460`). Es la foto que no se puede mover.
function formatMontoAntes(n: number): string {
  const cifra = Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `($ ${cifra})` : `$ ${cifra}`
}
function formatMontoCortoAntes(n: number): string {
  const abs = Math.abs(n)
  const ESCALAS: [number, string][] = [[1, ''], [1_000, 'k'], [1_000_000, 'M']]
  let i = 0
  while (i < ESCALAS.length - 1 && abs >= ESCALAS[i + 1][0]) i++
  const redondear = (indice: number) => Math.round((abs / ESCALAS[indice][0]) * 10) / 10
  if (redondear(i) >= 1000 && i < ESCALAS.length - 1) i++
  const valor = redondear(i)
  const sufijo = ESCALAS[i][1]
  const decimales = sufijo && valor % 1 !== 0 ? 1 : 0
  const cifra = valor.toLocaleString('es-MX', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
  return n < 0 ? `($ ${cifra}${sufijo})` : `$ ${cifra}${sufijo}`
}

function muestraAmplia(): number[] {
  const fijos = [0, -0, 0.004, 0.005, 0.01, 1, 850, 999.95, 1000, 18500, 45000, 999_950, 999_999,
    1_000_000, 4_897_500, 4_999_999, 5_000_000, 1_234_500_000, -156986.66, -4897500]
  let s = 1102
  const azar = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  return [...fijos, ...Array.from({ length: 2000 }, () => {
    const signo = azar() < 0.15 ? -1 : 1
    return signo * Math.round(azar() * 10 ** Math.floor(azar() * 10) * 100) / 100
  })]
}

describe('formatMonto · moneda de la instancia', () => {
  afterEach(() => fijarMonedaInstancia('MXN'))

  it('PARIDAD: en una instancia MXN, cada importe sale IDENTICO al de antes', () => {
    const distintos = muestraAmplia().flatMap((n) => [
      ...(formatMonto(n) === formatMontoAntes(n) ? [] : [`formatMonto ${n}: ${formatMontoAntes(n)} -> ${formatMonto(n)}`]),
      ...(formatMontoCorto(n) === formatMontoCortoAntes(n) ? [] : [`corto ${n}: ${formatMontoCortoAntes(n)} -> ${formatMontoCorto(n)}`]),
      // Y pedirlo en espanol a proposito es lo mismo que no pedir idioma.
      ...(formatMonto(n, 'es') === formatMontoAntes(n) ? [] : [`formatMonto es ${n}`]),
    ])
    expect(distintos).toEqual([])
  })

  it('USD en espanol lleva `US$`: el `$` a secas un lector mexicano lo lee como peso', () => {
    fijarMonedaInstancia('USD')
    expect(formatMonto(2505600)).toBe('US$ 2,505,600.00')
    expect(formatMonto(-156986.66)).toBe('(US$ 156,986.66)')
    expect(formatMontoCorto(4897500)).toBe('US$ 4.9M')
    expect(formatMontoCorto(-4897500)).toBe('(US$ 4.9M)')
  })

  it('en ingles: el peso lleva `MX$` y el dolar el `$` a secas', () => {
    expect(formatMonto(1234.5, 'en')).toBe('MX$ 1,234.50')
    expect(formatMontoCorto(18500, 'en')).toBe('MX$ 18.5k')
    fijarMonedaInstancia('USD')
    expect(formatMonto(1234.5, 'en')).toBe('$ 1,234.50')
    expect(formatMontoCorto(18500, 'en')).toBe('$ 18.5k')
  })

  it('cambiar de moneda NO cambia la cifra: el mismo numero, otro simbolo', () => {
    const mxn = formatMonto(45678901.23)
    fijarMonedaInstancia('USD')
    const usd = formatMonto(45678901.23)
    expect(mxn.replace(/^\$ /, '')).toBe(usd.replace(/^US\$ /, ''))
  })
})

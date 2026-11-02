import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ES_FINANZAS, EN_FINANZAS } from './finanzas'
import { DICCIONARIOS, traducir, type ClaveTexto } from '../diccionario'
import { COBRANZA_LABEL } from '@/components/demo/StatusBadge'
import { OPCIONES_PERIODO } from '@/components/demo/finanzas/TableroPeriodo'
import { PERIODICIDAD_LABEL, type PeriodicidadCuota } from '@/lib/finanzas-calculo'
import { etiquetaVencimiento } from '@/components/demo/finanzas/vencimiento-cuota'
import { AVISO_NO_ES_CFDI } from '@/components/demo/finanzas/comprobante'
import {
  CLAVE_COBRANZA,
  CLAVE_PERIODO,
  CLAVE_PARCIALIDAD,
  textoVencimiento,
} from '@/components/demo/finanzas/etiquetas'
import type { EstCobranza } from '@/lib/data/types'

// ============================================================================
//  EL DICCIONARIO DE FINANZAS ENTERO, CONGELADO — y atado a sus fuentes.
//  Mismo porque que `textos/campanas.test.ts`.
// ============================================================================

describe('diccionario de finanzas · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_FINANZAS).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_FINANZAS).toMatchSnapshot()
  })
})

describe('diccionario de finanzas · el ingles no esta en espanol', () => {
  const IGUALES = new Set<string>([
    'finanzas.comun.total', // «Total»
    'finanzas.comprobante.subtotal', // «Subtotal»
  ])

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    const iguales = Object.keys(ES_FINANZAS).filter(
      (k) => ES_FINANZAS[k as keyof typeof ES_FINANZAS] === EN_FINANZAS[k as keyof typeof EN_FINANZAS],
    )
    expect(iguales.filter((k) => !IGUALES.has(k))).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    expect(Object.entries(EN_FINANZAS).filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('en ingles ningun porcentaje lleva espacio antes del «%»', () => {
    expect(Object.entries(EN_FINANZAS).filter(([, v]) => /\s%/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    const distintos = Object.keys(ES_FINANZAS).filter(
      (k) => huecos(ES_FINANZAS[k as keyof typeof ES_FINANZAS]) !== huecos(EN_FINANZAS[k as keyof typeof EN_FINANZAS]),
    )
    expect(distintos).toEqual([])
  })
})

describe('diccionario de finanzas · el espanol reproduce EXACTAMENTE su modulo', () => {
  const es = (clave: ClaveTexto) => DICCIONARIOS.es[clave]

  it('COBRANZA_LABEL', () => {
    expect(Object.keys(CLAVE_COBRANZA).sort()).toEqual(Object.keys(COBRANZA_LABEL).sort())
    for (const [k, v] of Object.entries(COBRANZA_LABEL)) expect(es(CLAVE_COBRANZA[k as EstCobranza])).toBe(v)
  })

  it('OPCIONES_PERIODO (que tambien pinta el tablero de Propuestas)', () => {
    expect(Object.keys(CLAVE_PERIODO).sort()).toEqual(OPCIONES_PERIODO.map((o) => o.tipo).sort())
    for (const o of OPCIONES_PERIODO) expect(es(CLAVE_PERIODO[o.tipo])).toBe(o.label)
  })

  it('«{n} cuotas » + PERIODICIDAD_LABEL, la frase que pintaba la opcion', () => {
    for (const p of Object.keys(PERIODICIDAD_LABEL) as PeriodicidadCuota[]) {
      expect(traducir('es', CLAVE_PARCIALIDAD[p], { n: 3 })).toBe(`3 cuotas ${PERIODICIDAD_LABEL[p]}`)
    }
  })

  it('textoVencimiento repite etiquetaVencimiento en espanol, rama por rama', () => {
    const t = (clave: ClaveTexto, valores?: Record<string, string | number>) => traducir('es', clave, valores)
    const casos: [EstCobranza, number][] = [['PAGADA', -5], ['PAGADA', 10], ['VENCIDA', -12], ['POR_VENCER', 7], ['AL_CORRIENTE', 40], ['POR_VENCER', 0]]
    for (const [estado, dias] of casos) {
      expect(textoVencimiento(estado, dias, t)).toBe(etiquetaVencimiento(estado, dias).texto)
    }
  })

  it('AVISO_NO_ES_CFDI', () => {
    expect(es('finanzas.comprobante.aviso')).toBe(AVISO_NO_ES_CFDI)
  })
})

// ============================================================================
//  QUE CLAVE usa cada mensaje que NO se rinde.
// ----------------------------------------------------------------------------
//  La instantanea protege el VALOR de cada clave y las pantallas protegen las
//  que se pintan, pero nada protegia QUE clave elige un toast. El validador lo
//  demostro (docs/i18n/validacion-campanas-finanzas.md §5, M7): cambiar el
//  aviso de «liquidar» por el del abono sobrevivia a la suite entera, y al
//  liquidar el usuario habria leido «Abono registrado». Se lee el fuente, como
//  `candado-dinero-y-renovar.test.ts`: lo que se fija es la RAMA del ternario.
// ============================================================================
describe('finanzas · los avisos que no se rinden usan su clave', () => {
  const fuente = readFileSync(path.join(__dirname, '../../../app/(app)/(shell)/finanzas/page.tsx'), 'utf8')

  it('liquidar avisa «Cobranza liquidada» y abonar «Abono registrado», no al reves', () => {
    expect(fuente).toMatch(
      /alLograr: \(\) => onDone\(total \|\| num >= cob\.saldo \? t\('finanzas\.pago\.liquidada'\) : t\('finanzas\.pago\.abono-registrado'\)\)/,
    )
  })

  it('el recordatorio avisa enviado al lograrlo y el error al fallar', () => {
    expect(fuente).toMatch(/await recordarCobranzaApi\(id\)\s*\n\s*notify\(t\('finanzas\.recordatorio\.enviado'\)\)/)
    expect(fuente).toMatch(/e\.message : t\('finanzas\.recordatorio\.no-enviar'\)/)
  })

  it('emitir avisa «Factura generada» y su fallo «No se pudo generar la factura»', () => {
    expect(fuente).toMatch(/onDone=\{\(\) => notify\(t\('finanzas\.factura\.generada'\)\)\}/)
    expect(fuente).toMatch(/mensajeSiFalla: t\('finanzas\.factura\.no-generar'\)/)
    expect(fuente).toMatch(/mensajeSiFalla: t\('finanzas\.pago\.no-registrar'\)/)
  })
})

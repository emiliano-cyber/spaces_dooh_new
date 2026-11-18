import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { etiquetaDePapel, codigoDePapel, PAPELES_FIJOS } from './papeles'
import { textoDeFila } from '@/components/demo/reportes/tabla'

// ============================================================================
//  OLA 6 · LOS CINCO PAPELES DE UNA RAZON SOCIAL, EN EL IDIOMA DE QUIEN LEE.
// ----------------------------------------------------------------------------
//  Salen de `catalogo_roles_entidad` (sin tenant: iguales para toda la flota)
//  y se GUARDAN en espanol. La pantalla los traduce al pintarlos:
//
//   · la ETIQUETA («Compra los activos y el equipo») solo si es EXACTAMENTE la
//     del catalogo de partida. Si una instancia la renombro, su texto es dato
//     y se pinta como esta;
//   · el CODIGO (ACTIVOS), que la bienvenida pinta tal cual, por su nombre
//     ingles.
//
//  En espanol todo sale como hoy, letra por letra.
// ============================================================================

const RAIZ = path.join(__dirname, '../../../..')
const MIGRACION = readFileSync(path.join(RAIZ, 'db/migrations/20260917_entidades_fiscales.sql'), 'utf8')

const ESPERADO: Record<string, [string, string, string]> = {
  ARRENDAMIENTOS: ['Paga las rentas a los arrendadores', 'Pays rent to landlords', 'RENT'],
  ACTIVOS: ['Compra los activos y el equipo', 'Buys assets and equipment', 'ASSETS'],
  LICENCIAS: ['Tramites y licencias con gobierno', 'Government permits and licenses', 'PERMITS'],
  OPERACION: ['Operacion y nomina', 'Operations and payroll', 'OPERATIONS'],
  VENTAS: ['Vende publicidad', 'Sells advertising', 'SALES'],
}

describe('papeles · el catalogo de partida es el de la migracion', () => {
  it('los cinco codigos y sus etiquetas, letra por letra', () => {
    const filas = [...MIGRACION.matchAll(/\('([A-Z]+)',\s*'([^']+)',\s*\d+\)/g)].map((m) => [m[1], m[2]])
    expect(Object.fromEntries(filas)).toEqual(Object.fromEntries(Object.entries(ESPERADO).map(([k, v]) => [k, v[0]])))
    expect(PAPELES_FIJOS).toEqual(Object.keys(ESPERADO))
  })
})

describe('papeles · la etiqueta', () => {
  for (const [rol, [es, en]] of Object.entries(ESPERADO)) {
    it(`${rol}: en espanol la de siempre, en ingles «${en}»`, () => {
      expect(etiquetaDePapel(es, 'es')).toBe(es)
      expect(etiquetaDePapel(es)).toBe(es)
      expect(etiquetaDePapel(es, 'en')).toBe(en)
    })
  }

  it('una etiqueta renombrada en la instancia es dato: no se traduce', () => {
    expect(etiquetaDePapel('Ventas', 'en')).toBe('Ventas')
    expect(etiquetaDePapel('Compra los activos', 'en')).toBe('Compra los activos')
    expect(etiquetaDePapel('compra los activos y el equipo', 'en')).toBe('compra los activos y el equipo')
  })
})

describe('papeles · el codigo', () => {
  for (const [rol, [, , codigo]] of Object.entries(ESPERADO)) {
    it(`${rol} → ${codigo}`, () => {
      expect(codigoDePapel(rol, 'es')).toBe(rol)
      expect(codigoDePapel(rol)).toBe(rol)
      expect(codigoDePapel(rol, 'en')).toBe(codigo)
    })
  }
  it('un codigo que no es de los cinco se pinta tal cual', () => {
    expect(codigoDePapel('RENTAS', 'en')).toBe('RENTAS')
  })
})

describe('papeles · el reporte por razon social', () => {
  const fila = {
    clave: 'e1',
    etiqueta: 'Medios Norte SA',
    detalle: 'Paga las rentas a los arrendadores · Vende publicidad',
  }
  it('en espanol el detalle es el de siempre', () => {
    expect(textoDeFila('entidad', fila, 'es')).toEqual({ etiqueta: fila.etiqueta, detalle: fila.detalle })
  })
  it('en ingles cada papel del detalle sale en ingles', () => {
    expect(textoDeFila('entidad', fila, 'en')).toEqual({
      etiqueta: 'Medios Norte SA',
      detalle: 'Pays rent to landlords · Sells advertising',
    })
  })
  it('un papel renombrado se queda como esta', () => {
    expect(textoDeFila('entidad', { ...fila, detalle: 'Vende publicidad · Rentas' }, 'en').detalle).toBe(
      'Sells advertising · Rentas',
    )
  })
  it('en otra dimension el detalle no se toca', () => {
    expect(textoDeFila('sitio', { ...fila, detalle: 'Vende publicidad' }, 'en').detalle).toBe('Vende publicidad')
  })
})

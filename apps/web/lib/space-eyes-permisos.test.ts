import { describe, it, expect } from 'vitest'
import { NAV } from '@/components/demo/shell/nav'
import { AREAS, areasDeModulo } from '@/lib/modulos'

// ============================================================================
//  Lo que abre la casilla «Inventario» tiene que decirlo (ADR 0010).
// ----------------------------------------------------------------------------
//  Las ocho pantallas de Space Eyes —equipos, galería, vivo, programación,
//  campañas, verificación, fallas— exigen `inventario.ver` / `inventario.crear`,
//  pero `AREAS` no las mencionaba: quien repartía permisos veía «Inventario» y
//  no sabía que con eso abría las cámaras y las fotos de los espectaculares.
//  Es exactamente el defecto que el ADR 0010 existe para evitar.
// ============================================================================

describe('Space Eyes en la matriz de permisos', () => {
  it('hay un área de Space Eyes, gobernada por inventario', () => {
    const area = AREAS.find((a) => a.clave === 'space-eyes')
    expect(area?.modulo).toBe('inventario')
    expect(area?.apiPropia).toBe(true)
  })

  it('aparece bajo Inventario, que es donde mira quien reparte permisos', () => {
    expect(areasDeModulo('inventario').map((a) => a.clave)).toContain('space-eyes')
  })

  it('y cubre TODO el grupo del menú, también lo que se añada después', () => {
    // El guard que faltaba: si mañana entra otra pantalla al grupo `ojos` con
    // otro prefijo, esto falla en vez de dejarla fuera en silencio.
    const ojos = NAV.filter((n) => n.grupo === 'ojos')
    expect(ojos.length).toBeGreaterThan(0)
    for (const n of ojos) expect(n.href.startsWith('/space-eyes')).toBe(true)
  })
})

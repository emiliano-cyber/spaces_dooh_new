import { describe, it, expect } from 'vitest'
import { AREAS, areasDeModulo } from '@/lib/modulos'
import { NAV } from '@/components/demo/shell/nav'

// ============================================================================
//  Reportes está DECLARADO: el ADR 0010 existe para que nadie esconda qué abre
//  cada permiso.
// ----------------------------------------------------------------------------
//  La matriz de Administración mostraba 8 módulos y parecía completa, pero el
//  producto tiene 18 áreas: marcar `comercial` abría además Clientes,
//  Propuestas y Campañas sin que nada lo dijera. Un área nueva que no se
//  declara repite exactamente eso — y peor aquí, porque lo que abre es dinero.
// ============================================================================

const areaReportes = () => AREAS.find((a) => a.clave === 'reportes')
const navReportes = () => NAV.find((n) => n.key === 'reportes')
const navFinanzas = () => NAV.find((n) => n.key === 'finanzas')

describe('1 · el área está declarada y bajo el módulo del dinero', () => {
  it('existe el área `reportes` en el catálogo', () => {
    expect(areaReportes()).toBeDefined()
  })

  it('la gobierna `finanzas`, NO `dashboard`', () => {
    // Un reporte de rentabilidad enseña lo que se cobra por cada pantalla y lo
    // que se le paga a cada arrendador. Con `dashboard` lo vería cualquier rol
    // que pueda abrir el tablero. El `route.ts` ya exige `finanzas.ver`, así que
    // declararla en otro módulo sería declarar una mentira.
    expect(areaReportes()?.modulo).toBe('finanzas')
  })

  it('tiene API propia, y eso es lo que la protege', () => {
    // No se sirve de `/api/estado` como Disponibilidad o Creativos: habla con
    // `/api/reportes/rentabilidad`, que lleva su propio `exigir()`.
    expect(areaReportes()?.apiPropia).toBe(true)
  })

  it('aparece entre las áreas que abre marcar `finanzas`', () => {
    // Es lo único que hace el ADR 0010: que la casilla diga qué concede.
    expect(areasDeModulo('finanzas').map((a) => a.clave)).toContain('reportes')
  })
})

describe('2 · el menú y el guard del endpoint no pueden divergir', () => {
  it('existe la entrada de menú y apunta a /reportes', () => {
    expect(navReportes()?.href).toBe('/reportes')
  })

  it('va en el grupo del dinero, después de Finanzas', () => {
    const nav = NAV.map((n) => n.key)
    expect(navReportes()?.grupo).toBe('cobrar')
    expect(nav.indexOf('finanzas')).toBeLessThan(nav.indexOf('reportes'))
  })

  it('la ven EXACTAMENTE los mismos roles que ven Finanzas', () => {
    // Las dos las autoriza `finanzas`. Si los roles divergieran, un rol vería
    // la entrada en el menú y se comería un 403 de `exigir('finanzas','ver')`
    // sin que nada le dijera por qué — el encierro que ya se documentó dos
    // veces en este repo (contraseña temporal y códigos de recuperación).
    expect([...(navReportes()?.roles ?? [])].sort()).toEqual([...(navFinanzas()?.roles ?? [])].sort())
  })

  it('y el rol FINANZAS la ve: sin eso el área no la abriría nadie de su área', () => {
    expect(navReportes()?.roles).toContain('FINANZAS')
  })
})

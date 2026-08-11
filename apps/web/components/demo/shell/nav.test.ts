import { describe, it, expect } from 'vitest'
import { NAV, GRUPOS, type GrupoNav } from './nav'
import type { RolDemo } from '@/lib/data/types'

// ============================================================================
//  El menú cuenta el proceso — y estas pruebas fijan lo que se pidió.
// ----------------------------------------------------------------------------
//  Un menú se reordena a mano y se desordena igual de fácil: alguien añade un
//  módulo y lo pega al final «por ahora», y en dos meses Administración ya no
//  cierra la lista. Esto lo convierte en algo que se rompe en CI en vez de
//  descubrirse mirando una captura.
// ============================================================================

const ROLES: RolDemo[] = ['DUENO', 'COMERCIAL', 'OPERACIONES', 'IMPRENTA', 'FINANZAS']
const paraRol = (rol: RolDemo) => NAV.filter((n) => n.roles.includes(rol))

describe('1 · lo que se pidió expresamente', () => {
  it('Dashboard es SIEMPRE el primero', () => {
    expect(NAV[0].key).toBe('dashboard')
  })

  it('Actividad y Administración son SIEMPRE los dos últimos, en ese orden', () => {
    expect(NAV.slice(-2).map((n) => n.key)).toEqual(['actividad', 'administracion'])
  })

  it('y siguen siéndolo para el rol que los ve', () => {
    // Lo de arriba mira el arreglo; esto mira lo que de verdad se pinta. Un
    // módulo nuevo solo para Dueño colado al final rompería esta y no aquélla.
    const dueno = paraRol('DUENO')
    expect(dueno[0].key).toBe('dashboard')
    expect(dueno.slice(-2).map((n) => n.key)).toEqual(['actividad', 'administracion'])
  })
})

describe('2 · el orden cuenta el proceso', () => {
  const posicion = (key: string) => NAV.findIndex((n) => n.key === key)

  it('primero se vende y después se entrega: Propuestas ANTES que Campañas', () => {
    // Éste era el desorden de fondo. Campañas salía TERCERA, tres puestos por
    // encima de Propuestas — y una campaña nace justo de aprobar una propuesta.
    expect(posicion('propuestas')).toBeLessThan(posicion('campanas'))
  })

  it('primero se tiene y después se vende: Inventario ANTES que Comercial', () => {
    expect(posicion('inventario')).toBeLessThan(posicion('comercial'))
  })

  it('los dueños de las pantallas van con el inventario, no en medio de la venta', () => {
    // Una pantalla no es tuya: es de alguien que te la renta, y ese contrato es
    // lo que te deja venderla (ADR 0003).
    expect(posicion('arrendadores')).toBeLessThan(posicion('clientes'))
  })

  it('primero se entrega y después se cobra: Campañas ANTES que Finanzas', () => {
    expect(posicion('campanas')).toBeLessThan(posicion('finanzas'))
  })
})

describe('3 · los grupos son coherentes', () => {
  it('cada entrada pertenece a un grupo declarado', () => {
    const conocidos = new Set<GrupoNav>(GRUPOS.map((g) => g.key))
    for (const n of NAV) {
      expect(conocidos.has(n.grupo), `«${n.label}» está en el grupo «${n.grupo}», que no existe`).toBe(true)
    }
  })

  it('las entradas de un grupo van SEGUIDAS, sin colarse otra en medio', () => {
    // Si se rompe, el menú pinta el mismo título dos veces con otra fase en
    // medio — que es peor que no agrupar.
    const orden = NAV.map((n) => n.grupo)
    const vistos = new Set<GrupoNav>()
    let anterior: GrupoNav | null = null
    for (const g of orden) {
      if (g !== anterior) {
        expect(vistos.has(g), `el grupo «${g}» aparece en dos tramos separados`).toBe(false)
        vistos.add(g)
        anterior = g
      }
    }
  })

  it('los grupos salen en el orden declarado en GRUPOS', () => {
    const enNav = NAV.map((n) => n.grupo).filter((g, i, a) => g !== a[i - 1])
    const declarado = GRUPOS.map((g) => g.key).filter((k) => enNav.includes(k))
    expect(enNav).toEqual(declarado)
  })

  it('ningún grupo declarado se queda vacío', () => {
    // Un grupo sin entradas es un título que nunca se pinta: sobra.
    for (const g of GRUPOS) {
      expect(NAV.some((n) => n.grupo === g.key), `el grupo «${g.key}» no tiene entradas`).toBe(true)
    }
  })

  it('«inicio» es el único grupo sin título, y lleva una sola entrada', () => {
    const sinTitulo = GRUPOS.filter((g) => g.titulo === null)
    expect(sinTitulo.map((g) => g.key)).toEqual(['inicio'])
    expect(NAV.filter((n) => n.grupo === 'inicio')).toHaveLength(1)
  })
})

describe('4 · lo que ya se cumplía y no debe romperse al reordenar', () => {
  it('no hay claves ni rutas repetidas', () => {
    expect(new Set(NAV.map((n) => n.key)).size).toBe(NAV.length)
    expect(new Set(NAV.map((n) => n.href)).size).toBe(NAV.length)
  })

  it('todos los roles ven al menos un módulo', () => {
    // Un rol sin nada visible entra a un shell vacío sin saber por qué.
    for (const rol of ROLES) {
      expect(paraRol(rol).length, `el rol ${rol} no ve ningún módulo`).toBeGreaterThan(0)
    }
  })

  it('cada ruta empieza por / y no acaba en /', () => {
    // `AuthGate` compara `path === n.href || path.startsWith(n.href + '/')`: una
    // barra final rompería el emparejamiento y dejaría la ruta sin módulo, o
    // sea sin control de acceso.
    for (const n of NAV) {
      expect(n.href.startsWith('/'), n.key).toBe(true)
      expect(n.href.endsWith('/'), n.key).toBe(false)
    }
  })
})

import { describe, it, expect } from 'vitest'
import { NAV, GRUPOS, type GrupoNav } from './nav'
import { ROLES_ASIGNABLES } from '@/lib/roles'
import type { RolDemo } from '@/lib/data/types'

// ============================================================================
//  El menú cuenta el proceso — y estas pruebas fijan lo que se pidió.
// ----------------------------------------------------------------------------
//  Un menú se reordena a mano y se desordena igual de fácil: alguien añade un
//  módulo y lo pega al final «por ahora», y en dos meses Administración ya no
//  cierra la lista. Esto lo convierte en algo que se rompe en CI en vez de
//  descubrirse mirando una captura.
// ============================================================================

// Los roles que el producto ofrece al dar de alta a alguien. Sale de la lista
// canónica (`lib/roles.ts`) y no de una copia escrita aquí: una copia haría que
// un rol nuevo entrara al producto sin que ninguna de estas pruebas lo mirara,
// que es justo lo que pasó con COMERCIAL hasta el ADR 0040.
const ROLES: RolDemo[] = ROLES_ASIGNABLES.map((r) => r.value)
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

describe('3 bis · Creativos cuelga de OPERACIONES (2026-09-30)', () => {
  // Del 28/09 al 30/09 estuvo en «Comercial», porque un dueño preguntó si podía
  // programar las pautas desde ventas. El 30/09 el dueño pidió literalmente
  // «el menu de creativo muevelo a operaciones». Se movió de grupo y NO de
  // roles: quien vende lo sigue viendo, ahora bajo el encabezado de Campañas.
  const creativos = NAV.find((n) => n.key === 'creativos')

  it('la entrada existe y la ve quien vende', () => {
    // Los roles no se tocaron al moverla: `lib/modulos.ts` la autoriza con el
    // módulo `comercial`, y un rol OPERACIONES que la viera se comería un 403.
    expect(creativos).toBeDefined()
    expect(creativos?.roles).toEqual([
      'DUENO',
      'ADMINISTRADOR',
      'DIRECTOR_COMERCIAL',
      'GERENTE_VENTAS',
      'VENDEDOR',
    ])
  })

  it('cuelga del grupo «Operaciones», que es el que rotula «entregar»', () => {
    expect(creativos?.grupo).toBe('entregar')
    expect(GRUPOS.find((g) => g.key === 'entregar')?.titulo).toBe('Operaciones')
  })

  it('va justo DESPUÉS de Campañas: la pauta se arma sobre una campaña', () => {
    const posicion = (key: string) => NAV.findIndex((n) => n.key === key)
    expect(posicion('creativos')).toBe(posicion('campanas') + 1)
  })

  it('un VENDEDOR lo sigue viendo, ahora en Operaciones y no en Comercial', () => {
    const grupoDe = (g: string) => paraRol('VENDEDOR').filter((n) => n.grupo === g).map((n) => n.key)
    expect(grupoDe('entregar')).toContain('creativos')
    expect(grupoDe('vender')).not.toContain('creativos')
  })
})

describe('3 ter · los cuatro roles del ADR 0040 (2026-09-29)', () => {
  const claves = (rol: string) => paraRol(rol as RolDemo).map((n) => n.key)

  it('el ADMINISTRADOR ve EXACTAMENTE lo mismo que el Dueño', () => {
    // «puede hacer las mismas cosas que él» (dictado del 29/09). En el menú eso
    // es literal; lo que NO copia son los cuatro sitios donde 'DUENO' está
    // escrito a mano, y ésos se prueban aparte.
    expect(claves('ADMINISTRADOR')).toEqual(claves('DUENO'))
  })

  it('COMERCIAL ya no ve nada: el rol se retiró de uso', () => {
    // El valor sigue en el enum de Postgres —no se puede quitar— pero deja de
    // tener puerta. Si alguien le devolviera una entrada del menú, vería la
    // pantalla y se comería un 403: la migración le quitó sus permisos.
    expect(claves('COMERCIAL')).toEqual([])
  })

  it('los tres roles de venta ven el ciclo comercial entero', () => {
    for (const rol of ['DIRECTOR_COMERCIAL', 'GERENTE_VENTAS', 'VENDEDOR']) {
      const suyas = claves(rol)
      for (const pantalla of ['clientes', 'comercial', 'disponibilidad', 'propuestas', 'campanas']) {
        expect(suyas, `${rol} no ve ${pantalla}`).toContain(pantalla)
      }
    }
  })

  it('el VENDEDOR NO ve las cuatro pantallas del catálogo de precio', () => {
    // El vendedor APLICA códigos y paquetes; no los crea. Enseñarle la pantalla
    // de gestión sería el «encierro» que este repositorio ya documentó dos
    // veces: el servidor niega lo que la pantalla ofrece.
    const suyas = claves('VENDEDOR')
    for (const pantalla of [
      'franjas-y-temporadas',
      'descuentos-por-volumen',
      'codigos-promocionales',
      'paquetes',
    ]) {
      expect(suyas, `el vendedor NO debería ver ${pantalla}`).not.toContain(pantalla)
    }
  })

  it('el director comercial y el gerente de ventas SÍ las ven', () => {
    for (const rol of ['DIRECTOR_COMERCIAL', 'GERENTE_VENTAS']) {
      const suyas = claves(rol)
      for (const pantalla of [
        'franjas-y-temporadas',
        'descuentos-por-volumen',
        'codigos-promocionales',
        'paquetes',
      ]) {
        expect(suyas, `${rol} no ve ${pantalla}`).toContain(pantalla)
      }
    }
  })

  it('FINANZAS ve Operaciones — sin esa entrada no llega a costear la OT', () => {
    // No es cosmética. `AuthGate` empareja la ruta con el NAV y rebota al rol
    // que no está en `roles`, así que darle `operaciones.ver` en la base y no
    // ponerlo aquí sería el «encierro» al revés: el servidor le deja leer la OT
    // y la pantalla no le deja llegar. La tarjeta donde se captura el costo vive
    // dentro de esa vista.
    expect(claves('FINANZAS')).toContain('operaciones')
  })

  it('pero NO ve Almacén ni Consumo de luz', () => {
    // Las dos cuelgan del mismo módulo `operaciones`, así que su permiso las
    // abre por API. Lo que no se le abre es la PUERTA: Finanzas entra a la OT
    // porque tiene que costearla, no a gestionar el almacén. La ampliación por
    // API está dicha con todas las letras en la migración.
    expect(claves('FINANZAS')).not.toContain('almacen')
    expect(claves('FINANZAS')).not.toContain('energia')
  })

  it('el DIRECTOR COMERCIAL ve Finanzas y Reportes, y el gerente NO', () => {
    // Decisión del dueño del 29/09 (pregunta 3 del ADR): aprobar un descuento
    // sin ver el margen es firmar a ciegas. Es la ÚNICA diferencia entre el
    // director y el gerente hoy, así que se fija por los dos lados: si alguien
    // se la da también al gerente, la decisión se habría diluido sin que nadie
    // la tomara.
    expect(claves('DIRECTOR_COMERCIAL')).toContain('finanzas')
    expect(claves('DIRECTOR_COMERCIAL')).toContain('reportes')
    expect(claves('GERENTE_VENTAS')).not.toContain('finanzas')
    expect(claves('GERENTE_VENTAS')).not.toContain('reportes')
    expect(claves('VENDEDOR')).not.toContain('finanzas')
  })

  it('ningún rol de venta ve Administración ni Inventario', () => {
    // Dar de alta usuarios y reestructurar el patrimonio no son trabajo de
    // vender. El Inventario es «exclusivo del Dueño» y desde hoy también del
    // administrador — de nadie más.
    for (const rol of ['DIRECTOR_COMERCIAL', 'GERENTE_VENTAS', 'VENDEDOR']) {
      expect(claves(rol), rol).not.toContain('administracion')
      expect(claves(rol), rol).not.toContain('inventario')
      expect(claves(rol), rol).not.toContain('arrendadores')
    }
  })

  it('los grupos siguen SEGUIDOS para cada rol nuevo', () => {
    // El reparto de roles no reordena nada, pero esta prueba lo fija: si
    // alguien mueve una entrada para «agrupar lo del vendedor», el menú pinta
    // el mismo título dos veces con otra fase en medio.
    for (const rol of ROLES) {
      const orden = paraRol(rol).map((n) => n.grupo)
      const vistos = new Set<GrupoNav>()
      let anterior: GrupoNav | null = null
      for (const g of orden) {
        if (g === anterior) continue
        expect(vistos.has(g), `${rol}: el grupo «${g}» aparece en dos tramos`).toBe(false)
        vistos.add(g)
        anterior = g
      }
    }
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

describe('Captación, OCULTA del menú por ahora (2026-09-30)', () => {
  // Pedido del dueño: «elimina captación por ahora u ocúltalo». Se solapaba con
  // Comercial OPEX, que es la forma que prefiere. Se OCULTA y no se borra: sus
  // tablas y su API siguen, y el módulo de permisos `captacion` también, para
  // poder traerla de vuelta sin migración.
  it('no hay entrada de Captación en el menú', () => {
    expect(NAV.find((n) => n.key === 'captacion')).toBeUndefined()
    expect(NAV.find((n) => n.href === '/captacion')).toBeUndefined()
  })
  it('Comercial OPEX sigue en el grupo Comercial', () => {
    expect(NAV.find((n) => n.key === 'comercial-opex')?.grupo).toBe('vender')
  })
})

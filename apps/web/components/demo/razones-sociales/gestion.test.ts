import { describe, it, expect } from 'vitest'
import {
  BORRADOR_VACIO,
  LIMITE_RAZON_SOCIAL,
  entidadesOrdenadas,
  loQueFaltaEnElBorrador,
  rolesCompartidos,
  rolesSinDueno,
  type BorradorEntidad,
  type EntidadUI,
} from './gestion'

// ============================================================================
//  La pantalla de razones sociales — su parte que decide algo.
// ----------------------------------------------------------------------------
//  Los negativos son el corazón, como en el cuestionario: lo que esta pantalla
//  tiene que impedir es capturar dos veces la misma sociedad con el nombre
//  escrito distinto. Ese duplicado no da error —da dos identidades fiscales
//  para una sola empresa— y es exactamente el fallo que el cuestionario de
//  bienvenida existe para evitar en el alta; sería absurdo dejarlo entrar por
//  la pantalla que lo administra.
// ============================================================================

const CATALOGO = ['ARRENDAMIENTOS', 'ACTIVOS', 'LICENCIAS', 'OPERACION', 'VENTAS']

const ent = (over: Partial<EntidadUI> & { id: string; razonSocial: string }): EntidadUI => ({
  rfc: null,
  regimen: null,
  cpFiscal: null,
  serieFolios: null,
  roles: [],
  activo: true,
  ...over,
})

const bor = (over: Partial<BorradorEntidad>): BorradorEntidad => ({ ...BORRADOR_VACIO, ...over })

const ctx = (existentes: EntidadUI[], editando?: string | null) => ({
  existentes,
  editando: editando ?? null,
  catalogo: CATALOGO,
})

// ─── 1 · lo que impide guardar ──────────────────────────────────────────────
describe('1 · loQueFaltaEnElBorrador', () => {
  it('un borrador correcto se puede guardar', () => {
    expect(
      loQueFaltaEnElBorrador(bor({ razonSocial: 'Acme SA de CV', roles: ['VENTAS'] }), ctx([])),
    ).toBeNull()
  })

  it('sin razon social no se guarda, y lo dice', () => {
    const falta = loQueFaltaEnElBorrador(bor({ razonSocial: '   ' }), ctx([]))
    expect(falta).toMatch(/razon social/i)
  })

  it('una razon social mas larga que el limite se rechaza', () => {
    const falta = loQueFaltaEnElBorrador(
      bor({ razonSocial: 'A'.repeat(LIMITE_RAZON_SOCIAL + 1) }),
      ctx([]),
    )
    expect(falta).toMatch(new RegExp(String(LIMITE_RAZON_SOCIAL)))
  })

  it('NEGATIVO CLAVE · el duplicado escrito distinto NO entra', () => {
    // «ACME, S.A. de C.V.» y «Acme SA de CV» son la misma empresa teclada dos
    // veces. La comparacion ignora mayusculas, acentos, puntos y comas, y la
    // hace `claveRazonSocial` — la MISMA funcion del cuestionario, no una copia.
    const falta = loQueFaltaEnElBorrador(
      bor({ razonSocial: 'Acme SA de CV' }),
      ctx([ent({ id: 'E1', razonSocial: 'ACME, S.A. de C.V.' })]),
    )
    expect(falta).toMatch(/ya tienes/i)
    expect(falta).toContain('ACME, S.A. de C.V.')
  })

  it('NEGATIVO CLAVE · y tampoco si la que ya existe esta DADA DE BAJA', () => {
    // Si el duplicado se colara por aqui, el owner acabaria con dos filas para
    // la misma sociedad y sin forma de saber cual de las dos pagan los
    // contratos. La baja es LOGICA: la fila sigue ahi sosteniendo documentos.
    const falta = loQueFaltaEnElBorrador(
      bor({ razonSocial: 'Acme SA de CV' }),
      ctx([ent({ id: 'E1', razonSocial: 'Acme SA de CV', activo: false })]),
    )
    expect(falta).toMatch(/baja/i)
  })

  it('editando la propia fila, su nombre NO es un duplicado de si mismo', () => {
    expect(
      loQueFaltaEnElBorrador(
        bor({ razonSocial: 'Acme SA de CV' }),
        ctx([ent({ id: 'E1', razonSocial: 'Acme SA de CV' })], 'E1'),
      ),
    ).toBeNull()
  })

  it('un RFC mal escrito se rechaza antes de gastar el viaje', () => {
    const falta = loQueFaltaEnElBorrador(
      bor({ razonSocial: 'Acme SA de CV', rfc: 'NOESUNRFC' }),
      ctx([]),
    )
    expect(falta).toMatch(/rfc/i)
  })

  it('pero el RFC puede FALTAR: el expediente nace incompleto (ADR 0001)', () => {
    expect(
      loQueFaltaEnElBorrador(bor({ razonSocial: 'Acme SA de CV', rfc: '' }), ctx([])),
    ).toBeNull()
  })

  it('NEGATIVO CLAVE · un rol que no esta en el catalogo se rechaza nombrando los que hay', () => {
    // El catalogo es una tabla, no una constante del codigo: si la pantalla
    // ofreciera un rol inventado, el 400 del servidor llegaria sin explicar.
    const falta = loQueFaltaEnElBorrador(
      bor({ razonSocial: 'Acme SA de CV', roles: ['NOMINA'] }),
      ctx([]),
    )
    expect(falta).toMatch(/NOMINA/)
    expect(falta).toMatch(/VENTAS/)
  })

  it('sin ningun rol SI se puede guardar: el papel se puede decidir despues', () => {
    expect(
      loQueFaltaEnElBorrador(bor({ razonSocial: 'Acme SA de CV', roles: [] }), ctx([])),
    ).toBeNull()
  })
})

// ─── 2 · el orden del listado ───────────────────────────────────────────────
describe('2 · entidadesOrdenadas', () => {
  it('las activas primero y las dadas de baja al final', () => {
    const r = entidadesOrdenadas([
      ent({ id: 'B', razonSocial: 'Beta', activo: false }),
      ent({ id: 'A', razonSocial: 'Alfa' }),
    ])
    expect(r.map((e) => e.id)).toEqual(['A', 'B'])
  })

  it('y alfabetico DENTRO de cada grupo, ignorando acentos y mayusculas', () => {
    const r = entidadesOrdenadas([
      ent({ id: '3', razonSocial: 'ómicron' }),
      ent({ id: '1', razonSocial: 'Álfa' }),
      ent({ id: '2', razonSocial: 'beta' }),
    ])
    expect(r.map((e) => e.id)).toEqual(['1', '2', '3'])
  })

  it('no muta el arreglo que recibe', () => {
    const dentro = [ent({ id: 'B', razonSocial: 'Beta' }), ent({ id: 'A', razonSocial: 'Alfa' })]
    entidadesOrdenadas(dentro)
    expect(dentro.map((e) => e.id)).toEqual(['B', 'A'])
  })
})

// ─── 3 · los papeles sin dueño y los compartidos ────────────────────────────
// Esto es lo que hace la pantalla algo mas que un CRUD: un papel sin dueño
// significa que ningun documento de ese tipo se va a preasignar, y un papel
// compartido significa que el selector NO va a proponer nada. Las dos cosas se
// dicen en pantalla, porque las dos se notan despues y en otro sitio.
describe('3 · rolesSinDueno y rolesCompartidos', () => {
  it('sin ninguna entidad, TODOS los roles del catalogo estan sin dueño', () => {
    expect(rolesSinDueno([], CATALOGO)).toEqual(CATALOGO)
  })

  it('nombra solo los que nadie tiene', () => {
    const e = [ent({ id: 'A', razonSocial: 'Alfa', roles: ['VENTAS', 'OPERACION'] })]
    expect(rolesSinDueno(e, CATALOGO)).toEqual(['ARRENDAMIENTOS', 'ACTIVOS', 'LICENCIAS'])
  })

  it('una entidad DADA DE BAJA no cuenta como dueño de su papel', () => {
    // Es el caso que muerde: se da de baja la que vendia y el papel VENTAS se
    // queda huerfano sin que nada avise. Desde ese momento ningun comprobante
    // se preasigna, y eso no da error.
    const e = [ent({ id: 'A', razonSocial: 'Alfa', roles: ['VENTAS'], activo: false })]
    expect(rolesSinDueno(e, CATALOGO)).toContain('VENTAS')
  })

  it('compartido = lo tienen DOS o mas activas, y entonces no hay omision', () => {
    const e = [
      ent({ id: 'A', razonSocial: 'Alfa', roles: ['VENTAS'] }),
      ent({ id: 'B', razonSocial: 'Beta', roles: ['VENTAS', 'ACTIVOS'] }),
    ]
    expect(rolesCompartidos(e, CATALOGO)).toEqual(['VENTAS'])
  })

  it('una sola no es compartido', () => {
    const e = [ent({ id: 'A', razonSocial: 'Alfa', roles: ['VENTAS'] })]
    expect(rolesCompartidos(e, CATALOGO)).toEqual([])
  })
})

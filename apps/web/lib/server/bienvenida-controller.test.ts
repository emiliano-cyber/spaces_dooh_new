import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  El cuestionario de bienvenida — la capa que decide si se escribe.
// ----------------------------------------------------------------------------
//  El repo abre un pool de Postgres al importarse, así que se mockea: aquí solo
//  se ejercita lo que se decide ANTES de tocar la base, que es lo que un `curl`
//  se salta si la comprobación se deja en la pantalla.
//
//  Lo que estas pruebas defienden, y por qué importa más de lo que parece: el
//  cuestionario no es una encuesta. De sus tres respuestas salen las razones
//  sociales del negocio y sus papeles. Contestarlo dos veces no puede duplicar
//  la identidad fiscal del owner, y una respuesta contradictoria no puede
//  resolverse eligiendo en silencio: lo que se escriba aquí decide a nombre de
//  quién se paga una renta y quién emite un comprobante.
// ============================================================================

const ENTIDADES_CREADAS = [
  { id: 'E1', razonSocial: 'Inmuebles del Norte SA de CV', roles: ['ARRENDAMIENTOS'] },
  { id: 'E2', razonSocial: 'Operadora Comercial SA de CV', roles: ['OPERACION', 'VENTAS'] },
]

// Los cinco que siembra `20260917_entidades_fiscales.sql:76`. Son la ENTRADA de
// las pruebas, no una lista que el código conozca.
const CATALOGO = [
  { rol: 'ARRENDAMIENTOS', etiqueta: 'Paga las rentas a los arrendadores' },
  { rol: 'ACTIVOS', etiqueta: 'Compra los activos y el equipo' },
  { rol: 'LICENCIAS', etiqueta: 'Tramites y licencias con gobierno' },
  { rol: 'OPERACION', etiqueta: 'Operacion y nomina' },
  { rol: 'VENTAS', etiqueta: 'Vende publicidad' },
]

// Los mocks devuelven `any` a propósito: hay casos que fuerzan la forma de
// fallo del repo (`{ ok: false, yaHabia }`), y tipar el doble con la firma
// buena obligaría a pelearse con el compilador en cada uno de ellos.
const repo = {
  // El catálogo sale de la BASE (`catalogo_roles_entidad`), no de una constante
  // del código: la lista de roles es una decisión de negocio abierta y tiene
  // que poder cambiar con un `insert`, sin migración ni despliegue.
  catalogoRolesConEtiqueta: vi.fn(async (): Promise<any> => CATALOGO),
  contarEntidadesDelTenant: vi.fn(async (): Promise<any> => 0),
  crearEntidadesDelCuestionario: vi.fn(
    async (_plan: unknown): Promise<any> => ({ ok: true, entidades: ENTIDADES_CREADAS }),
  ),
  listarEntidadesConRoles: vi.fn(async (): Promise<any> => ENTIDADES_CREADAS),
}
vi.mock('./bienvenida-repo', () => repo)

const { contestarCuestionarioCtrl, estadoCuestionarioCtrl } = await import(
  './bienvenida-controller'
)

// `clearAllMocks` borra las llamadas pero NO la implementación que dejó un
// `mockResolvedValue`, así que los dobles se reponen a mano: sin esto, el caso
// que cambia el catálogo se lo deja cambiado a los siguientes.
beforeEach(() => {
  vi.clearAllMocks()
  repo.catalogoRolesConEtiqueta.mockResolvedValue(CATALOGO)
  repo.contarEntidadesDelTenant.mockResolvedValue(0)
  repo.crearEntidadesDelCuestionario.mockResolvedValue({ ok: true, entidades: ENTIDADES_CREADAS })
  repo.listarEntidadesConRoles.mockResolvedValue(ENTIDADES_CREADAS)
})

const RESPUESTAS_BUENAS = {
  variasRazonesSociales: true,
  operacionYVentasJuntas: true,
  razonSocialPorRol: {
    ARRENDAMIENTOS: 'Inmuebles del Norte SA de CV',
    OPERACION: 'Operadora Comercial SA de CV',
  },
}

/** El plan con el que se llamó al repo, para no repetir el casting en cada caso. */
const planEnviado = () =>
  repo.crearEntidadesDelCuestionario.mock.calls[0][0] as { razonSocial: string; roles: string[] }[]

// ─────────────────────────────────────────────────────────────────────────────
describe('1 · el cuestionario MATERIALIZA las entidades, no las encuesta', () => {
  it('las respuestas llegan al repo convertidas en entidades con sus roles', async () => {
    const r = await contestarCuestionarioCtrl(RESPUESTAS_BUENAS)
    expect(repo.crearEntidadesDelCuestionario).toHaveBeenCalledTimes(1)
    const plan = planEnviado()
    expect(plan).toHaveLength(2)
    expect(plan[0].razonSocial).toBe('Inmuebles del Norte SA de CV')
    // La pregunta 2 contestada «sí» le da los dos papeles a la misma sociedad
    // aunque la pantalla solo mandara uno de los dos.
    expect(plan[1].roles).toEqual(['OPERACION', 'VENTAS'])
    expect(r.entidades).toHaveLength(2)
  })

  it('devuelve el resumen que la ruta escribe en la bitácora', async () => {
    const r = await contestarCuestionarioCtrl(RESPUESTAS_BUENAS)
    expect(r.resumen).toContain('2')
    expect(r.resumen).toContain('OPERACION, VENTAS')
  })

  it('se manda UNA sola llamada al repo: o quedan todas, o ninguna', async () => {
    // La atomicidad la garantiza `withTenantTx` dentro del repo. Lo que se fija
    // aquí es que el controller no la rompa repartiendo el plan en una llamada
    // por entidad — que es cómo se acaba con media identidad fiscal escrita.
    await contestarCuestionarioCtrl(RESPUESTAS_BUENAS)
    expect(repo.crearEntidadesDelCuestionario).toHaveBeenCalledTimes(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('2 · contestarlo dos veces no duplica nada', () => {
  it('con entidades ya creadas responde 409 y NO escribe', async () => {
    repo.contarEntidadesDelTenant.mockResolvedValue(2)
    await expect(contestarCuestionarioCtrl(RESPUESTAS_BUENAS)).rejects.toMatchObject({
      status: 409,
    })
    expect(repo.crearEntidadesDelCuestionario).not.toHaveBeenCalled()
  })

  it('si dos peticiones entran a la vez, la que pierde también da 409', async () => {
    // El recuento de fuera y el insert no son la misma transacción, así que la
    // comprobación de verdad vive DENTRO de ella y el repo la reporta como
    // `yaHabia`. Sin este camino, dos pestañas duplicarían las razones sociales
    // del negocio y las dos parecerían correctas.
    repo.crearEntidadesDelCuestionario.mockResolvedValue({ ok: false, yaHabia: 2 })
    await expect(contestarCuestionarioCtrl(RESPUESTAS_BUENAS)).rejects.toMatchObject({
      status: 409,
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('3 · nada se escribe con respuestas inválidas', () => {
  it('«una sola razón social» con cinco distintas: 400 y ni una fila', async () => {
    await expect(
      contestarCuestionarioCtrl({
        variasRazonesSociales: false,
        razonSocialUnica: 'Espacios del Centro SA de CV',
        razonSocialPorRol: {
          ARRENDAMIENTOS: 'Una SA de CV',
          ACTIVOS: 'Dos SA de CV',
          LICENCIAS: 'Tres SA de CV',
          OPERACION: 'Cuatro SA de CV',
          VENTAS: 'Cinco SA de CV',
        },
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(repo.crearEntidadesDelCuestionario).not.toHaveBeenCalled()
  })

  it('un rol fuera del catálogo: 400 y ni una fila', async () => {
    await expect(
      contestarCuestionarioCtrl({
        variasRazonesSociales: true,
        operacionYVentasJuntas: false,
        razonSocialPorRol: { TESORERIA: 'Tesoreria SA de CV' },
      }),
    ).rejects.toThrow(/TESORERIA/)
    expect(repo.crearEntidadesDelCuestionario).not.toHaveBeenCalled()
  })

  it('el catálogo se CONSULTA: no hay lista de roles escrita en el código', async () => {
    // Si un día alguien añade un rol con un `insert`, el cuestionario tiene que
    // aceptarlo sin desplegar nada. Esta prueba se pone roja si el controller
    // deja de preguntarle a la base y se trae la lista dentro.
    repo.catalogoRolesConEtiqueta.mockResolvedValue([{ rol: 'TESORERIA', etiqueta: 'Paga y cobra' }])
    await contestarCuestionarioCtrl({
      variasRazonesSociales: true,
      operacionYVentasJuntas: true,
      razonSocialPorRol: { TESORERIA: 'Tesoreria SA de CV' },
    })
    expect(repo.catalogoRolesConEtiqueta).toHaveBeenCalled()
    expect(planEnviado()[0].roles).toEqual(['TESORERIA'])
  })

  it('contradicción entre la pregunta 2 y el mapa: 400 y ni una fila', async () => {
    await expect(
      contestarCuestionarioCtrl({
        variasRazonesSociales: true,
        operacionYVentasJuntas: true,
        razonSocialPorRol: { OPERACION: 'Operadora SA de CV', VENTAS: 'Comercial SA de CV' },
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(repo.crearEntidadesDelCuestionario).not.toHaveBeenCalled()
  })

  it('un cuerpo que no es un objeto: 400 y ni una fila', async () => {
    await expect(contestarCuestionarioCtrl('hola')).rejects.toMatchObject({ status: 400 })
    expect(repo.crearEntidadesDelCuestionario).not.toHaveBeenCalled()
  })

  it('una respuesta de sí/no que llega como texto: 400 y ni una fila', async () => {
    // Un `curl` manda `"no"` y una pantalla manda `false`. Aceptar la cadena
    // haría que `"no"` fuera verdadero, que es el peor tipo de fallo:
    // silencioso y con el sentido invertido.
    await expect(
      contestarCuestionarioCtrl({
        variasRazonesSociales: 'no',
        razonSocialUnica: 'Espacios SA de CV',
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(repo.crearEntidadesDelCuestionario).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('4 · el estado se DERIVA, no se guarda en ninguna columna', () => {
  it('sin entidades, el cuestionario está pendiente', async () => {
    repo.contarEntidadesDelTenant.mockResolvedValue(0)
    const e = await estadoCuestionarioCtrl()
    expect(e.pendiente).toBe(true)
    expect(e.roles.map((r: { rol: string }) => r.rol)).toContain('VENTAS')
  })

  it('con entidades no se vuelve a ofrecer', async () => {
    repo.contarEntidadesDelTenant.mockResolvedValue(3)
    const e = await estadoCuestionarioCtrl()
    expect(e.pendiente).toBe(false)
  })

  it('devuelve las entidades que ya existen, para poder volver y verlas', async () => {
    repo.contarEntidadesDelTenant.mockResolvedValue(2)
    const e = await estadoCuestionarioCtrl()
    expect(e.entidades).toHaveLength(2)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Validación del alta y la edición de entidades fiscales del owner.
// ----------------------------------------------------------------------------
//  El repo abre un pool de Postgres al importarse: se mockea porque aquí solo
//  se ejercita la VALIDACIÓN, igual que en `clientes-controller.test.ts`.
//
//  Lo que estas pruebas defienden es lo que aprendió la auditoría del 26/08 con
//  los clientes: la UI valida y el servidor se fía de ella, y un `curl` se salta
//  la UI entera. Aquí el dato es fiscal —a nombre de quién paga y factura el
//  negocio—, así que un RFC con un mes 13 o un rol inventado no se quedan en un
//  detalle cosmético.
// ============================================================================

const repo = {
  crearEntidad: vi.fn(async (i: unknown) => ({ id: 'E1', roles: [], ...(i as object) })),
  editarEntidad: vi.fn(async (id: string, i: unknown) => ({ id, roles: [], ...(i as object) })),
  desactivarEntidad: vi.fn(async (_id: string) => true),
  obtenerEntidad: vi.fn(async (id: string) => ({ id, razonSocial: 'ACME SA de CV', roles: [] })),
  listarEntidades: vi.fn(async () => []),
  rolesDeEntidad: vi.fn(async () => [] as string[]),
  // El catálogo sale de la BASE (tabla `catalogo_roles_entidad`), no de una
  // constante del código: la lista de roles es una decisión de negocio abierta y
  // tiene que poder cambiar con una fila, sin migración ni despliegue.
  catalogoRolesEntidad: vi.fn(async () => [
    'ARRENDAMIENTOS', 'ACTIVOS', 'LICENCIAS', 'OPERACION', 'VENTAS',
  ]),
}
vi.mock('./entidades-repo', () => repo)

const { crearEntidadCtrl, editarEntidadCtrl, desactivarEntidadCtrl } = await import(
  './entidades-controller',
)

beforeEach(() => vi.clearAllMocks())

describe('control · el alta corriente llega al repo', () => {
  // Sin este caso, cualquier rotura del módulo haría pasar los negativos por el
  // motivo equivocado.
  it('una razón social con su RFC entra', async () => {
    const e = await crearEntidadCtrl({
      razonSocial: 'Arrendamientos del Centro SA de CV',
      rfc: 'XAXX010101000',
    })
    expect(repo.crearEntidad).toHaveBeenCalledTimes(1)
    expect(e.razonSocial).toBe('Arrendamientos del Centro SA de CV')
  })

  it('recorta la razón social: un espacio de más no es otra empresa', async () => {
    await crearEntidadCtrl({ razonSocial: '   ACME SA de CV   ' })
    expect(repo.crearEntidad.mock.calls[0][0]).toMatchObject({ razonSocial: 'ACME SA de CV' })
  })
})

describe('la razón social es obligatoria', () => {
  it('vacía se rechaza y no escribe nada', async () => {
    await expect(crearEntidadCtrl({ razonSocial: '   ' })).rejects.toThrow()
    expect(repo.crearEntidad).not.toHaveBeenCalled()
  })

  it('ausente se rechaza', async () => {
    await expect(crearEntidadCtrl({})).rejects.toThrow()
    expect(repo.crearEntidad).not.toHaveBeenCalled()
  })
})

describe('el RFC pasa por el calendario, como en clientes y arrendadores', () => {
  it('rechaza el mes 13', async () => {
    await expect(
      crearEntidadCtrl({ razonSocial: 'Con RFC imposible', rfc: 'XAXX021301000' }),
    ).rejects.toThrow('RFC inválido')
    expect(repo.crearEntidad).not.toHaveBeenCalled()
  })

  it('el mismo control en la edición', async () => {
    // El mismo RFC de 13 caracteres, no una cadena cualquiera: un texto más
    // largo lo rechaza antes el `max(13)` del schema y la prueba pasaría sin
    // haber ejercitado el calendario. Medido al escribirla — daba
    // «RFC: No puede tener más de 13 caracteres».
    await expect(editarEntidadCtrl('E1', { rfc: 'XAXX021301000' })).rejects.toThrow(
      'RFC inválido',
    )
    expect(repo.editarEntidad).not.toHaveBeenCalled()
  })
})

describe('varios roles es el caso NORMAL, no la excepción', () => {
  it('operación y ventas en la misma entidad', async () => {
    // Es lo que hace el negocio de verdad: la sociedad que opera suele ser la
    // que vende. Una entidad con un solo rol sería el caso raro.
    await crearEntidadCtrl({
      razonSocial: 'Operadora y Ventas SA de CV',
      roles: ['OPERACION', 'VENTAS'],
    })
    expect(repo.crearEntidad.mock.calls[0][0]).toMatchObject({
      roles: ['OPERACION', 'VENTAS'],
    })
  })

  it('los cinco roles sembrados se aceptan', async () => {
    await crearEntidadCtrl({
      razonSocial: 'Todo en una SA de CV',
      roles: ['ARRENDAMIENTOS', 'ACTIVOS', 'LICENCIAS', 'OPERACION', 'VENTAS'],
    })
    expect(repo.crearEntidad).toHaveBeenCalledTimes(1)
  })

  it('sin roles también entra: la entidad existe antes de saber qué hace', async () => {
    await crearEntidadCtrl({ razonSocial: 'Sin papel todavía SA de CV' })
    expect(repo.crearEntidad).toHaveBeenCalledTimes(1)
  })
})

describe('el rol duplicado se rechaza ANTES de llegar a la base', () => {
  it('el mismo rol dos veces en el alta', async () => {
    // La base ya lo impide con `unique (entidad_id, rol)`, pero ahí llega como
    // un 23505 sin mensaje útil. Se dice cuál viene repetido.
    await expect(
      crearEntidadCtrl({ razonSocial: 'Repetida SA de CV', roles: ['VENTAS', 'VENTAS'] }),
    ).rejects.toThrow(/VENTAS/)
    expect(repo.crearEntidad).not.toHaveBeenCalled()
  })

  it('y en la edición', async () => {
    await expect(
      editarEntidadCtrl('E1', { roles: ['ACTIVOS', 'ACTIVOS'] }),
    ).rejects.toThrow(/ACTIVOS/)
    expect(repo.editarEntidad).not.toHaveBeenCalled()
  })

  it('un choque en la base se traduce a 409, no a un 500 crudo', async () => {
    repo.crearEntidad.mockRejectedValueOnce(
      Object.assign(new Error('duplicate key'), { code: '23505' }),
    )
    await expect(
      crearEntidadCtrl({ razonSocial: 'Choque SA de CV', roles: ['VENTAS'] }),
    ).rejects.toMatchObject({ status: 409 })
  })
})

describe('un rol que no está en el catálogo no se inventa', () => {
  it('se rechaza nombrándolo', async () => {
    await expect(
      crearEntidadCtrl({ razonSocial: 'Con rol inventado SA de CV', roles: ['NOMINA'] }),
    ).rejects.toThrow(/NOMINA/)
    expect(repo.crearEntidad).not.toHaveBeenCalled()
  })

  it('el catálogo se CONSULTA, no se cablea', async () => {
    // Si mañana el negocio añade NOMINA con un insert, esto tiene que pasar sin
    // tocar código. La prueba lo fija: el controller pregunta al repo.
    repo.catalogoRolesEntidad.mockResolvedValueOnce(['NOMINA'])
    await crearEntidadCtrl({ razonSocial: 'Nómina SA de CV', roles: ['NOMINA'] })
    expect(repo.catalogoRolesEntidad).toHaveBeenCalled()
    expect(repo.crearEntidad).toHaveBeenCalledTimes(1)
  })
})

describe('editar y desactivar lo que no existe es 404, no un éxito silencioso', () => {
  it('la edición de una entidad ajena o inexistente', async () => {
    // Importa por lo que significa: el repo devuelve null cuando el `where` con
    // `tenant_id` no encuentra nada, y eso incluye el caso «existe, pero es de
    // otra organización». Tiene que verse como no encontrada.
    repo.editarEntidad.mockResolvedValueOnce(null as never)
    await expect(editarEntidadCtrl('E9', { razonSocial: 'Ajena SA de CV' })).rejects.toMatchObject({
      status: 404,
    })
  })

  it('desactivar lo que no existe', async () => {
    repo.desactivarEntidad.mockResolvedValueOnce(false)
    await expect(desactivarEntidadCtrl('E9')).rejects.toMatchObject({ status: 404 })
  })

  it('desactivar lo propio responde sin error', async () => {
    await expect(desactivarEntidadCtrl('E1')).resolves.not.toThrow()
    expect(repo.desactivarEntidad).toHaveBeenCalledWith('E1')
  })
})

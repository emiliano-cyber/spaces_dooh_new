import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  ASIGNAR la razón social propia a un documento, por la ruta de la aplicación.
// ----------------------------------------------------------------------------
//  `contratos_arrendamiento.entidad_id` existe desde el 2026-09-17 y ningún
//  endpoint la escribía. Éste es el primero, y esto lo comprueba POR HTTP: con
//  sesión, con el guard de cambio sensible por medio y con la RLS puesta, que
//  es lo único que demuestra que la columna se puede usar de verdad.
//
//  Lo que las unitarias NO pueden ver y aquí sí:
//   · que el 404 de la entidad ajena llega como 404 al cliente y no como el 500
//     que produciría el 23503 de la clave ajena compuesta;
//   · que la fila de la otra organización sigue intacta después del intento;
//   · que `/api/estado` devuelve `entidadId`, que es lo que la pantalla pinta.
//
//  `entidad_id` NO ES UNA FRONTERA DE SEGURIDAD. La única es `tenant_id`.
// ============================================================================

let orgA: Awaited<ReturnType<typeof sembrarTenant>>
let orgB: Awaited<ReturnType<typeof sembrarTenant>>
let a: Cliente
let entidadDeA: string
let entidadDeB: string
let contratoDeA: string

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  orgA = await sembrarTenant('docenta')
  orgB = await sembrarTenant('docentb')

  const p = poolTest()
  const alta = async (tenantId: string, razon: string, rol: string) => {
    const id = (
      await p.query(
        `insert into entidades_fiscales (tenant_id, razon_social) values ($1,$2) returning id`,
        [tenantId, razon],
      )
    ).rows[0].id as string
    await p.query(
      `insert into entidad_roles (entidad_id, rol, tenant_id) values ($1,$2,$3)`,
      [id, rol, tenantId],
    )
    return id
  }
  entidadDeA = await alta(orgA.id, 'La de A SA de CV', 'ARRENDAMIENTOS')
  entidadDeB = await alta(orgB.id, 'La de B SA de CV', 'ARRENDAMIENTOS')

  contratoDeA = (
    await p.query('select id from contratos_arrendamiento where tenant_id = $1 limit 1', [orgA.id])
  ).rows[0].id

  await arrancarServidor()
  a = new Cliente()
  await a.entrar(orgA.usuarioEmail, PASSWORD_DEMO)
  await desbloquear(a)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// El PATCH del contrato es CAMBIO SENSIBLE (dinero): exige el permiso del rol y,
// si la organizacion tiene el control de cambios encendido, que la sesion este
// desbloqueada con la contrasena del Dueno. No se apaga para probar — apagarlo
// dejaria sin probar una proteccion real. Se desbloquea, como en produccion.
//
// Y deja un hallazgo dicho: asignar la razon social que paga es un dato FISCAL,
// no un importe, pero viaja por el mismo endpoint que el monto de la renta, asi
// que hereda su guard. Es la decision conservadora y aqui solo se constata.
async function desbloquear(cl: Cliente): Promise<void> {
  const r = await cl.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
}

const enBase = async (id: string) =>
  (await poolTest().query('select entidad_id from contratos_arrendamiento where id = $1', [id]))
    .rows[0]

describe('1 · asignar la razon social que PAGA la renta', () => {
  it('arranca «sin asignar», y eso es legitimo', async () => {
    // La semilla crea el contrato sin entidad, igual que todas las filas
    // anteriores al 2026-09-17.
    expect((await enBase(contratoDeA)).entidad_id).toBeNull()
  })

  it('el PATCH la escribe', async () => {
    const r = await a.pedir(`/api/contratos/${contratoDeA}/`, {
      metodo: 'PATCH',
      cuerpo: { entidadId: entidadDeA },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.entidadId).toBe(entidadDeA)
    expect((await enBase(contratoDeA)).entidad_id).toBe(entidadDeA)
  })

  it('/api/estado la devuelve, que es lo que la pantalla pinta', async () => {
    const r = await a.pedir('/api/estado/')
    expect(r.status).toBe(200)
    const c = (r.datos.contratos ?? []).find((x: any) => x.id === contratoDeA)
    expect(c, 'el contrato no viajó en el estado').toBeDefined()
    expect(c.entidadId).toBe(entidadDeA)
  })

  it('y se puede DESASIGNAR con null explicito', async () => {
    // «Sin asignar» tiene que poder volver a ponerse: si no, un clic equivocado
    // dejaría el contrato atado a una sociedad para siempre.
    const r = await a.pedir(`/api/contratos/${contratoDeA}/`, {
      metodo: 'PATCH',
      cuerpo: { entidadId: null },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect((await enBase(contratoDeA)).entidad_id).toBeNull()
  })

  it('editar OTRA cosa no borra la entidad asignada', async () => {
    // `undefined` es «no la toques». Si el UPDATE la incluyera siempre, tocar el
    // importe de la renta borraría la razón social que la paga, en silencio.
    await a.pedir(`/api/contratos/${contratoDeA}/`, {
      metodo: 'PATCH',
      cuerpo: { entidadId: entidadDeA },
    })
    const r = await a.pedir(`/api/contratos/${contratoDeA}/`, {
      metodo: 'PATCH',
      cuerpo: { montoRenta: 31000 },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect((await enBase(contratoDeA)).entidad_id).toBe(entidadDeA)
  })
})

describe('2 · aislamiento', () => {
  it('PRUEBA NEGATIVA CLAVE · la entidad de B da 404 desde A, y no un 500', async () => {
    // El 500 es lo que produciría dejarlo caer en la clave ajena compuesta: un
    // error del driver sobre un contrato que no se editó, sin nada que decirle
    // a quien lo intentó. La validación explícita lo convierte en un 404 con
    // mensaje, y la FK sigue detrás como red.
    const antes = (await enBase(contratoDeA)).entidad_id
    const r = await a.pedir(`/api/contratos/${contratoDeA}/`, {
      metodo: 'PATCH',
      cuerpo: { entidadId: entidadDeB },
    })
    expect(r.status).toBe(404)
    expect(String(r.datos?.error ?? '')).toMatch(/razon social/i)
    expect((await enBase(contratoDeA)).entidad_id).toBe(antes)
  })

  it('y la entidad de B sigue intacta: el intento no la tocó', async () => {
    const { rows } = await poolTest().query(
      'select tenant_id, activo from entidades_fiscales where id = $1',
      [entidadDeB],
    )
    expect(rows[0].tenant_id).toBe(orgB.id)
    expect(rows[0].activo).toBe(true)
  })

  it('un entidadId que no es un uuid da 400, no un error de base', async () => {
    const r = await a.pedir(`/api/contratos/${contratoDeA}/`, {
      metodo: 'PATCH',
      cuerpo: { entidadId: 'la-mia' },
    })
    expect(r.status).toBe(400)
  })
})

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  VAL-03 · dos altas del mismo cliente, ni un aviso.
// ----------------------------------------------------------------------------
//  La auditoría del 2026-08-26 dio de alta el mismo cliente dos veces —mismo
//  nombre y mismo RFC— y las dos respondieron 201. Es exactamente el defecto
//  que el módulo de arrendadores resolvió en agosto (A5 / INC-07) y que aquí
//  seguía abierto: dos redes distintas para dos problemas distintos.
//
//    · RFC — regla dura, la pone un índice único por organización. Dos clientes
//      con el mismo RFC son el mismo contribuyente, sin excepción posible… con
//      UNA salvedad que arrendadores no tenía: los RFC genéricos del SAT
//      (`XAXX010101000` público en general, `XEXX010101000` extranjeros) son
//      compartidos por diseño. Una organización factura a «público en general»
//      decenas de veces, y un índice que los incluyera haría imposible el
//      segundo.
//
//    · NOMBRE — aviso con salida. Dos empresas distintas pueden llamarse igual,
//      así que se avisa y, si quien da el alta confirma, pasa.
//
//  Va por HTTP y contra Postgres real porque la mitad de la protección ES un
//  índice: un mock nunca produce un 23505 y la carrera —dos altas a la vez— no
//  existe fuera de un servidor de verdad. Mismo criterio que
//  `arrendador-duplicado.e2e.test.ts`, del que esto es el espejo.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let ajena: Awaited<ReturnType<typeof sembrarTenant>>
let c: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('dupcli')
  ajena = await sembrarTenant('dupcliajena')
  await arrancarServidor()
  c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  // `sembrarTenant` deja un cliente por organización; se conservan.
  await poolTest().query(`delete from clientes where nombre not like 'Cliente %'`)
})

const alta = (cuerpo: Record<string, unknown>) => c.pedir('/api/clientes/', { cuerpo })

const cuantos = async (where: string, params: unknown[] = []): Promise<number> =>
  Number((await poolTest().query(`select count(*)::int n from clientes where ${where}`, params)).rows[0].n)

// ─── RFC · regla dura, la pone la base ──────────────────────────────────────

describe('1 · el mismo RFC no puede ser de dos clientes', () => {
  it('la segunda alta responde 409 y dice DE QUIÉN es ese RFC', async () => {
    const a = await alta({ nombre: 'Telcel', rfc: 'AGI990422EL7' })
    expect(a.status, JSON.stringify(a.datos)).toBe(201)

    const b = await alta({ nombre: 'Radiomovil Dipsa', rfc: 'AGI990422EL7' })
    expect(b.status, JSON.stringify(b.datos)).toBe(409)
    expect(b.datos.motivo).toBe('rfc')
    // Nombrar al dueño del RFC es la diferencia entre «ya existe» —que obliga a
    // buscarlo a mano en la lista— y poder ir directo.
    expect(b.datos.error).toContain('Telcel')
    expect(b.datos.existente?.id).toBe(a.datos.id)
    expect(await cuantos(`rfc = 'AGI990422EL7'`)).toBe(1)
  })

  it('no se salta escribiéndolo en minúsculas ni con espacios', async () => {
    await alta({ nombre: 'Bimbo', rfc: 'SJI8003047D4' })
    const b = await alta({ nombre: 'Bimbo SA', rfc: ' sji8003047d4 ' })
    expect(b.status).toBe(409)
    expect(b.datos.motivo).toBe('rfc')
    expect(await cuantos(`upper(btrim(rfc)) = 'SJI8003047D4'`)).toBe(1)
  })

  it('NO se puede saltar confirmando: un RFC es de un solo contribuyente', async () => {
    await alta({ nombre: 'Cemex', rfc: 'SDA071023MV0' })
    const b = await alta({ nombre: 'Cemex 2', rfc: 'SDA071023MV0', confirmaNombreRepetido: true })
    expect(b.status).toBe(409)
    expect(b.datos.motivo).toBe('rfc')
    expect(await cuantos(`upper(btrim(rfc)) = 'SDA071023MV0'`)).toBe(1)
  })

  it('sin RFC se pueden dar de alta varios: el índice es parcial', async () => {
    // El RFC es opcional: un cliente entra antes de tener sus datos fiscales.
    // Un índice sin el filtro habría bloqueado la segunda alta sin RFC y
    // frenado altas legítimas.
    expect((await alta({ nombre: 'Sin papeles uno' })).status).toBe(201)
    expect((await alta({ nombre: 'Sin papeles dos' })).status).toBe(201)
    expect((await alta({ nombre: 'Sin papeles tres', rfc: '' })).status).toBe(201)
    expect(await cuantos(`nombre like 'Sin papeles%'`)).toBe(3)
  })

  it('los RFC GENÉRICOS del SAT sí se repiten: son compartidos por diseño', async () => {
    // La diferencia con arrendadores, y la razón de que este caso exista. Si el
    // índice los incluyera, el segundo «público en general» sería imposible de
    // dar de alta y no habría forma de saltárselo.
    expect((await alta({ nombre: 'Mostrador norte', rfc: 'XAXX010101000' })).status).toBe(201)
    expect((await alta({ nombre: 'Mostrador sur', rfc: 'XAXX010101000' })).status).toBe(201)
    expect((await alta({ nombre: 'Turista uno', rfc: 'XEXX010101000' })).status).toBe(201)
    expect((await alta({ nombre: 'Turista dos', rfc: 'xexx010101000' })).status).toBe(201)
  })

  it('dos altas A LA VEZ con el mismo RFC dejan UNA sola fila', async () => {
    // La carrera que ninguna guarda de navegador cubre: dos pestañas, dos
    // dispositivos, un reintento de red. Aquí es donde el índice se gana el sitio.
    const [r1, r2] = await Promise.all([
      alta({ nombre: 'Carrera A', rfc: 'IUIA680222AE1' }),
      alta({ nombre: 'Carrera B', rfc: 'IUIA680222AE1' }),
    ])
    expect([r1.status, r2.status].sort()).toEqual([201, 409])
    expect(await cuantos(`upper(btrim(rfc)) = 'IUIA680222AE1'`)).toBe(1)
  })

  it('otra organización SÍ puede tener ese mismo RFC', async () => {
    // La unicidad es por tenant. El mismo anunciante puede ser cliente de dos
    // empresas del sistema, y ninguna debe enterarse de la otra.
    await alta({ nombre: 'Compartido', rfc: 'AGA960830CW6' })
    const otro = new Cliente()
    await otro.entrar(ajena.usuarioEmail, PASSWORD_DEMO)
    const r = await otro.pedir('/api/clientes/', { cuerpo: { nombre: 'Compartido', rfc: 'AGA960830CW6' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(await cuantos(`upper(btrim(rfc)) = 'AGA960830CW6'`)).toBe(2)
  })
})

// ─── NOMBRE · aviso que se puede responder ──────────────────────────────────

describe('2 · el mismo nombre avisa, pero no prohíbe', () => {
  it('la segunda alta responde 409 pidiendo confirmación', async () => {
    const a = await alta({ nombre: 'GRUPO MODELO' })
    expect(a.status).toBe(201)

    const b = await alta({ nombre: 'GRUPO MODELO' })
    expect(b.status).toBe(409)
    expect(b.datos.motivo).toBe('nombre')
    expect(b.datos.existente?.id).toBe(a.datos.id)
    expect(await cuantos(`nombre = 'GRUPO MODELO'`)).toBe(1)
  })

  it('avisa aunque cambien las mayúsculas o sobren espacios entre palabras', async () => {
    // El criterio de normalización es el MISMO que ya usa el alta de campaña
    // desde una reserva para no crear una ficha nueva por cada «Telcel»
    // tecleado (`campanas-repo.ts`). Dos criterios distintos para «el mismo
    // cliente» sería peor que ninguno.
    await alta({ nombre: 'Coca  Cola' })
    const b = await alta({ nombre: '  coca cola ' })
    expect(b.status).toBe(409)
    expect(b.datos.motivo).toBe('nombre')
  })

  it('confirmando SÍ entra: dos clientes distintos pueden llamarse igual', async () => {
    await alta({ nombre: 'Farmacias del Centro' })
    const b = await alta({ nombre: 'Farmacias del Centro', confirmaNombreRepetido: true })
    expect(b.status, JSON.stringify(b.datos)).toBe(201)
    expect(await cuantos(`nombre = 'Farmacias del Centro'`)).toBe(2)
  })

  it('confirmar NO es la opción por omisión: hay que pedirlo', async () => {
    await alta({ nombre: 'Repetible' })
    expect((await alta({ nombre: 'Repetible', confirmaNombreRepetido: false })).status).toBe(409)
    expect((await alta({ nombre: 'Repetible' })).status).toBe(409)
    expect(await cuantos(`nombre = 'Repetible'`)).toBe(1)
  })

  it('también avisa si el que ya existe está dado de baja', async () => {
    const a = await alta({ nombre: 'Dado de baja' })
    await poolTest().query('update clientes set activo = false where id = $1', [a.datos.id])
    const b = await alta({ nombre: 'Dado de baja' })
    expect(b.status).toBe(409)
    expect(b.datos.error).toContain('dado de baja')
  })

  it('un nombre de OTRA organización no dispara el aviso', async () => {
    const otro = new Cliente()
    await otro.entrar(ajena.usuarioEmail, PASSWORD_DEMO)
    await otro.pedir('/api/clientes/', { cuerpo: { nombre: 'Solo de la otra' } })
    expect((await alta({ nombre: 'Solo de la otra' })).status).toBe(201)
  })
})

// ─── Nada de esto puede romper el alta normal ───────────────────────────────

describe('3 · el camino corriente sigue igual', () => {
  it('un cliente nuevo con RFC nuevo se crea a la primera', async () => {
    const r = await alta({ nombre: 'Cliente nuevo del dia', rfc: 'RUOY030311T87' })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(r.datos.nombre).toBe('Cliente nuevo del dia')
  })

  it('un RFC mal formado sigue siendo 400 y no un 409 confuso', async () => {
    const r = await alta({ nombre: 'Con RFC malo', rfc: 'NO-ES-UN-RFC' })
    expect(r.status).toBe(400)
  })

  it('un RFC con mes 13 —el de la auditoría— es 400 por HTTP', async () => {
    // La regla del calendario vive en `lib/rfc.ts` y se prueba en unitarias;
    // esto comprueba que llega hasta la ruta y no se queda a medio camino.
    const r = await alta({ nombre: 'Con mes trece', rfc: 'XAXX021301000' })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(await cuantos(`nombre = 'Con mes trece'`)).toBe(0)
  })

  it('un nombre de 5 000 caracteres es 400 por HTTP', async () => {
    const r = await alta({ nombre: 'A'.repeat(5000) })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
  })

  it('un correo inválido en la raíz del cuerpo es 400, no 201', async () => {
    const r = await alta({ nombre: 'Correo malo', email: 'no-es-un-correo' })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(await cuantos(`nombre = 'Correo malo'`)).toBe(0)
  })

  it('un correo válido en la raíz se guarda en el contacto', async () => {
    const r = await alta({ nombre: 'Correo bueno', email: 'x@ejemplo.com' })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    const { rows } = await poolTest().query('select contacto from clientes where id = $1', [r.datos.id])
    expect(rows[0].contacto?.email).toBe('x@ejemplo.com')
  })
})

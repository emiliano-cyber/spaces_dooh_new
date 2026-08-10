import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  A5 / INC-07 · dos altas del mismo propietario.
// ----------------------------------------------------------------------------
//  Por HTTP y contra Postgres real, porque la mitad de la protección ES un
//  índice de la base: un mock nunca produce un 23505 y la carrera —dos altas a
//  la vez— no existe fuera de un servidor de verdad.
//
//  El caso que motivó todo esto está en la bitácora de producción: «Creó
//  propietario · ADMINISTRADORA DE GASOLINERAS INTERLOMAS» dos veces, con 71
//  SEGUNDOS de diferencia. No fue un doble clic; fue una persona repitiendo. Por
//  eso hay dos reglas distintas y se prueban por separado.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let ajena: Awaited<ReturnType<typeof sembrarTenant>>
let c: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('dupli')
  ajena = await sembrarTenant('dupliajena')
  await arrancarServidor()
  c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  // `sembrarTenant` deja un arrendador por organización; se conservan.
  await poolTest().query(`delete from arrendadores where nombre not like 'Arrendador %'`)
})

const alta = (cuerpo: Record<string, unknown>) => c.pedir('/api/arrendadores/', { cuerpo })

const cuantos = async (where: string, params: unknown[] = []): Promise<number> =>
  Number((await poolTest().query(`select count(*)::int n from arrendadores where ${where}`, params)).rows[0].n)

// ─── RFC · regla dura, la pone la base ──────────────────────────────────────

describe('1 · el mismo RFC no puede ser de dos arrendadores', () => {
  it('la segunda alta responde 409 y dice DE QUIÉN es ese RFC', async () => {
    const a = await alta({ nombre: 'Gasolineras Interlomas', rfc: 'AGI990422EL7' })
    expect(a.status, JSON.stringify(a.datos)).toBe(201)

    const b = await alta({ nombre: 'Otro nombre distinto', rfc: 'AGI990422EL7' })
    expect(b.status).toBe(409)
    expect(b.datos.motivo).toBe('rfc')
    // Nombrar al dueño del RFC es la diferencia entre «ya existe» —que obliga a
    // buscar a mano en la lista— y poder ir directo.
    expect(b.datos.error).toContain('Gasolineras Interlomas')
    expect(b.datos.existente?.id).toBe(a.datos.id)
    expect(await cuantos(`rfc = 'AGI990422EL7'`)).toBe(1)
  })

  it('no se salta escribiéndolo en minúsculas ni con espacios', async () => {
    // El índice normaliza con `upper(btrim(...))`. Sin eso, un copiar y pegar
    // con un espacio de más colaría el duplicado — que es justo como se cuela.
    await alta({ nombre: 'Servicio Jinetes', rfc: 'SJI8003047D4' })
    const b = await alta({ nombre: 'Servicio Jinetes SA', rfc: ' sji8003047d4 ' })
    expect(b.status).toBe(409)
    expect(b.datos.motivo).toBe('rfc')
    expect(await cuantos(`upper(btrim(rfc)) = 'SJI8003047D4'`)).toBe(1)
  })

  it('NO se puede saltar confirmando: un RFC es de un solo contribuyente', async () => {
    // La confirmación existe para el nombre, no para el RFC. Si el `confirma`
    // valiera para todo, la red dura dejaría de serlo.
    await alta({ nombre: 'Servicio Daniela', rfc: 'SDA071023MV0' })
    const b = await alta({ nombre: 'Servicio Daniela 2', rfc: 'SDA071023MV0', confirmaNombreRepetido: true })
    expect(b.status).toBe(409)
    expect(b.datos.motivo).toBe('rfc')
    expect(await cuantos(`upper(btrim(rfc)) = 'SDA071023MV0'`)).toBe(1)
  })

  it('sin RFC se pueden dar de alta varios: el índice es parcial', async () => {
    // El RFC es opcional (ADR 0001, el contrato puede nacer con datos fiscales
    // pendientes). Un índice sin el filtro habría bloqueado la segunda alta sin
    // RFC y frenado altas legítimas.
    expect((await alta({ nombre: 'Sin papeles uno' })).status).toBe(201)
    expect((await alta({ nombre: 'Sin papeles dos' })).status).toBe(201)
    expect((await alta({ nombre: 'Sin papeles tres', rfc: '' })).status).toBe(201)
    expect(await cuantos(`nombre like 'Sin papeles%'`)).toBe(3)
  })

  it('dos altas A LA VEZ con el mismo RFC dejan UNA sola fila', async () => {
    // La carrera que ninguna guarda de navegador cubre: dos pestañas, dos
    // dispositivos, un reintento de red. Aquí es donde el índice se gana el
    // sitio.
    const [r1, r2] = await Promise.all([
      alta({ nombre: 'Carrera A', rfc: 'IUIA680222AE1' }),
      alta({ nombre: 'Carrera B', rfc: 'IUIA680222AE1' }),
    ])
    const codigos = [r1.status, r2.status].sort()
    expect(codigos).toEqual([201, 409])
    expect(await cuantos(`upper(btrim(rfc)) = 'IUIA680222AE1'`)).toBe(1)
  })

  it('otra organización SÍ puede tener ese mismo RFC', async () => {
    // La unicidad es por tenant. Un mismo arrendador puede trabajar con dos
    // empresas distintas del sistema, y ninguna debe enterarse de la otra.
    await alta({ nombre: 'Compartido', rfc: 'AGA960830CW6' })
    const otro = new Cliente()
    await otro.entrar(ajena.usuarioEmail, PASSWORD_DEMO)
    const r = await otro.pedir('/api/arrendadores/', { cuerpo: { nombre: 'Compartido', rfc: 'AGA960830CW6' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(await cuantos(`upper(btrim(rfc)) = 'AGA960830CW6'`)).toBe(2)
  })
})

// ─── NOMBRE · aviso que se puede responder ──────────────────────────────────

describe('2 · el mismo nombre avisa, pero no prohíbe', () => {
  it('la segunda alta responde 409 pidiendo confirmación', async () => {
    // El caso de las 19:56: mismos datos, un minuto después.
    const a = await alta({ nombre: 'ADMINISTRADORA DE GASOLINERAS INTERLOMAS' })
    expect(a.status).toBe(201)

    const b = await alta({ nombre: 'ADMINISTRADORA DE GASOLINERAS INTERLOMAS' })
    expect(b.status).toBe(409)
    expect(b.datos.motivo).toBe('nombre')
    expect(b.datos.existente?.id).toBe(a.datos.id)
    expect(await cuantos(`nombre = 'ADMINISTRADORA DE GASOLINERAS INTERLOMAS'`)).toBe(1)
  })

  it('avisa aunque cambie el uso de mayúsculas o sobren espacios', async () => {
    await alta({ nombre: 'Juan Pérez' })
    const b = await alta({ nombre: '  juan pérez ' })
    expect(b.status).toBe(409)
    expect(b.datos.motivo).toBe('nombre')
  })

  it('confirmando SÍ entra: dos propietarios distintos pueden llamarse igual', async () => {
    // Esta es la razón de no poner un índice único sobre el nombre. Con uno, un
    // segundo «Juan Pérez» —otra persona, otro predio— sería imposible de dar
    // de alta y no habría forma de saltárselo.
    await alta({ nombre: 'Juan Pérez' })
    const b = await alta({ nombre: 'Juan Pérez', confirmaNombreRepetido: true })
    expect(b.status, JSON.stringify(b.datos)).toBe(201)
    expect(await cuantos(`upper(btrim(nombre)) = 'JUAN PÉREZ'`)).toBe(2)
  })

  it('confirmar NO es la opción por omisión: hay que pedirlo', async () => {
    // Si el aviso se saltara solo, no serviría de nada. `false` explícito y
    // omitirlo tienen que comportarse igual.
    await alta({ nombre: 'Repetible' })
    expect((await alta({ nombre: 'Repetible', confirmaNombreRepetido: false })).status).toBe(409)
    expect((await alta({ nombre: 'Repetible' })).status).toBe(409)
    expect(await cuantos(`nombre = 'Repetible'`)).toBe(1)
  })

  it('también avisa si el que ya existe está dado de baja', async () => {
    // Un nombre que reaparece suele ser alguien recuperando lo que borró. Sin
    // esto, el sistema crearía un segundo registro y el historial del primero
    // quedaría colgando de nadie.
    const a = await alta({ nombre: 'Dado de baja' })
    await poolTest().query('update arrendadores set activo = false where id = $1', [a.datos.id])
    const b = await alta({ nombre: 'Dado de baja' })
    expect(b.status).toBe(409)
    expect(b.datos.error).toContain('dado de baja')
  })

  it('un nombre de OTRA organización no dispara el aviso', async () => {
    const otro = new Cliente()
    await otro.entrar(ajena.usuarioEmail, PASSWORD_DEMO)
    await otro.pedir('/api/arrendadores/', { cuerpo: { nombre: 'Solo de la otra' } })
    expect((await alta({ nombre: 'Solo de la otra' })).status).toBe(201)
  })
})

// ─── Nada de esto puede romper el alta normal ───────────────────────────────

describe('3 · el camino corriente sigue igual', () => {
  it('un arrendador nuevo con RFC nuevo se crea a la primera', async () => {
    const r = await alta({ nombre: 'Propietario nuevo', rfc: 'RUOY030311T87', telefono: '5512345678' })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(r.datos.nombre).toBe('Propietario nuevo')
  })

  it('un RFC mal formado sigue siendo 400 y no un 409 confuso', async () => {
    const r = await alta({ nombre: 'Con RFC malo', rfc: 'NO-ES-UN-RFC' })
    expect(r.status).toBe(400)
  })
})

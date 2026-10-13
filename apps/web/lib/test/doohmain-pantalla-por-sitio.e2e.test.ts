import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  «Pantalla en DOOHmain» se captura en la ficha de cada pantalla.
// ----------------------------------------------------------------------------
//  Pedido por el dueño el 13/10. Hasta hoy la única forma de decir a qué
//  pantalla de DOOHmain va cada pantalla de SPACE OS era `DOOHMAIN_SCREEN_MAP`,
//  un JSON en el `.env` del servidor: cada pantalla nueva era una edición del
//  servidor y un reinicio. Y lo que no estaba en el mapa se iba en silencio a
//  `DOOHMAIN_DEFAULT_SCREEN` — en la máquina de desarrollo, `adv_004`.
//
//  Y el campo «CMS» de la ficha no se miraba al publicar: una pantalla marcada
//  como Broadsign también se mandaba a DOOHmain.
//
//  El arnés publica con un intérprete que no existe (`servidor-e2e.ts`): cada
//  envío falla al arrancar el proceso, pero la fila del resultado ya lleva la
//  pantalla de DOOHmain elegida. Ahí se mira. `DOOHMAIN_DEFAULT_SCREEN` es
//  `pantalla_de_prueba` y el mapa está vacío.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let c: Cliente
const CLAVE = 'PANTALLAS-001'

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('pantallas')
  await arrancarServidor()
  c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  await poolTest().query('delete from creatividades')
  await poolTest().query('delete from reservas')
  await poolTest().query('delete from campanas')
  await poolTest().query(`update sitios set doohmain_pantalla = null, cms = null where id = $1`, [org.sitioId])
})

const editar = (cuerpo: Record<string, unknown>) =>
  c.pedir(`/api/sitios/${org.sitioId}/`, { metodo: 'PATCH', cuerpo })
const enBase = async () =>
  (await poolTest().query('select doohmain_pantalla from sitios where id=$1', [org.sitioId])).rows[0]
    .doohmain_pantalla

describe('1 · se captura en la ficha', () => {
  it('se guarda sin los espacios de los extremos, y vuelve en el listado', async () => {
    const r = await editar({ doohmainPantalla: '  adv_004  ' })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.doohmainPantalla).toBe('adv_004')
    expect(await enBase()).toBe('adv_004')

    const lista = await c.pedir('/api/sitios/')
    expect(lista.datos.find((s: any) => s.id === org.sitioId).doohmainPantalla).toBe('adv_004')
  })

  it('vacío lo quita: vuelve a mandar el mapa del servidor', async () => {
    await editar({ doohmainPantalla: 'adv_004' })
    expect((await editar({ doohmainPantalla: '   ' })).status).toBe(200)
    expect(await enBase()).toBeNull()
  })

  it('un nombre absurdo de largo se rechaza con un mensaje, no con un 500', async () => {
    const r = await editar({ doohmainPantalla: 'x'.repeat(121) })
    expect(r.status).toBe(400)
    expect(r.datos.error).toMatch(/DOOHmain/)
  })

  it('la base tampoco acepta espacios en los extremos, aunque se escriba a mano', async () => {
    await expect(
      poolTest().query(`update sitios set doohmain_pantalla = ' adv_004' where id = $1`, [org.sitioId]),
    ).rejects.toThrow(/sitios_doohmain_pantalla_ck/)
  })
})

describe('2 · al publicar', () => {
  async function publicar(): Promise<any[]> {
    const camp = await poolTest().query(
      `insert into campanas (nombre, cliente_id, tipo_campana, fecha_inicio, fecha_fin, estado_comercial, tenant_id)
       values ('Campaña de pantallas',$1,'DOOH',$2,$3,'CONFIRMADA',$4) returning id`,
      [org.clienteId, enDias(-1), enDias(30), org.id],
    )
    const id = camp.rows[0].id
    await poolTest().query(
      `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, estatus, spots_reservados, tenant_id)
       values ($1,$2,$3,$4,45000,'CONFIRMADA',6,$5)`,
      [id, org.sitioId, enDias(-1), enDias(30), org.id],
    )
    const cr = await poolTest().query(
      `insert into creatividades (campana_id, nombre, archivo_url, formato, estatus_validacion, tenant_id)
       values ($1,'Pieza','data:image/png;base64,iVBORw0KGgo=','png','PENDIENTE',$2) returning id`,
      [id, org.id],
    )
    await c.pedir(`/api/creatividades/${cr.rows[0].id}/`, { metodo: 'PATCH', cuerpo: { aprobar: true } })
    expect((await c.pedir(`/api/campanas/${id}/enviar-dominio/`, { cuerpo: {} })).status).toBe(200)
    const r = await c.pedir(`/api/campanas/${id}/validar/`, { cuerpo: { aprobar: true } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    return r.datos.doohmain
  }

  it('la pantalla de la ficha manda sobre la del servidor', async () => {
    await editar({ doohmainPantalla: 'adv_777' })
    const [fila] = await publicar()
    expect(fila.sitio).toBe(CLAVE)
    expect(fila.screen).toBe('adv_777')
  })

  it('sin pantalla en la ficha, sigue usando lo del servidor (como hasta hoy)', async () => {
    const [fila] = await publicar()
    expect(fila.screen).toBe('pantalla_de_prueba')
  })

  it('una pantalla de OTRO CMS no se manda a DOOHmain, y se dice', async () => {
    await editar({ cms: 'BROADSIGN', doohmainPantalla: 'adv_777' })
    const [fila] = await publicar()
    expect(fila.ok).toBe(true)
    expect(fila.estado).toBe('otro_cms')
    expect(fila.cms).toBe('BROADSIGN')
    expect(fila.screen).toBeNull()
  })

  it('marcada como Doohmain se publica igual que sin marcar', async () => {
    await editar({ cms: 'DOOHMAIN' })
    const [fila] = await publicar()
    expect(fila.screen).toBe('pantalla_de_prueba')
    expect(fila.estado).not.toBe('otro_cms')
  })
})

describe('3 · la lista de pantallas de DOOHmain para elegir', () => {
  it('responde aunque DOOHmain no conteste: lista vacía y el motivo', async () => {
    // En el arnés el intérprete no existe: es el caso «no se pudo preguntar».
    const r = await c.pedir('/api/integraciones/doohmain/pantallas/')
    expect(r.status).toBe(200)
    expect(r.datos.habilitado).toBe(true)
    expect(r.datos.pantallas).toEqual([])
    expect(typeof r.datos.error).toBe('string')
  })

  it('sin sesión, 401', async () => {
    expect((await new Cliente().pedir('/api/integraciones/doohmain/pantallas/')).status).toBe(401)
  })
})

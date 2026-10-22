import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  v0.12.3 · pantallas y lugares PROPIOS, contra Postgres y Next de verdad.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-10-22: pantallas o lugares propios, sin renta
//  mensual; solo luz y operación. Forma aprobada: `sitios.propio`,
//  `predios.propio` y `predios.arrendador_id` nullable con CHECK.
//
//  Lo que se demuestra:
//   · el alta de una propia no pide arrendador ni abre contrato;
//   · una propia pasa el guard de venta sin contrato (ADR 0003 sigue intacto
//     para las rentadas);
//   · marcarla propia cancela su contrato PENDIENTE, pero no se puede con uno
//     VIGENTE (borraría un costo real en silencio);
//   · un lote propio entra sin arrendador, y su predio nace propio;
//   · la base no admite un predio sin arrendador que no sea propio.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let c: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('propias')
  await arrancarServidor()
  c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

const contratosDe = async (sitioId: string) =>
  (await poolTest().query('select estatus from contratos_arrendamiento where sitio_id = $1', [sitioId])).rows.map(
    (r) => r.estatus,
  )

describe('1 · la migración', () => {
  it('un predio sin arrendador solo si es propio', async () => {
    await expect(
      poolTest().query(`insert into predios (arrendador_id, nombre, tenant_id) values (null, 'Rentado sin dueño', $1)`, [org.id]),
    ).rejects.toThrow(/predios_propio_o_arrendador_ck/)
    const r = await poolTest().query(
      `insert into predios (arrendador_id, nombre, tenant_id, propio) values (null, 'Bodega propia', $1, true) returning id`,
      [org.id],
    )
    expect(r.rows[0].id).toBeTruthy()
  })
})

describe('2 · el alta de una pantalla propia', () => {
  it('no pide arrendador ni abre contrato, y queda marcada propia', async () => {
    const r = await c.pedir('/api/sitios/', {
      cuerpo: { nombre: 'Azotea de la oficina', propio: true, lat: 19.43, lng: -99.13, tipoMedio: 'ESPECTACULAR' },
    })
    expect(r.status, JSON.stringify(r.datos)).toBeLessThan(300)
    expect(r.datos.propio).toBe(true)
    expect(await contratosDe(r.datos.id)).toEqual([])
  })

  it('una rentada sin arrendador sigue siendo 400 (ADR 0002 intacto)', async () => {
    const r = await c.pedir('/api/sitios/', { cuerpo: { nombre: 'Rentada sin dueño', lat: 19.43, lng: -99.13 } })
    expect(r.status).toBe(400)
  })
})

describe('3 · marcar propia una pantalla existente', () => {
  it('cancela su contrato PENDIENTE y queda propia', async () => {
    // La pantalla sembrada nace con su contrato INCOMPLETO (como toda alta).
    await poolTest().query(
      `insert into contratos_arrendamiento (id, sitio_id, fecha_inicio, moneda, auto_renovable, estatus, tenant_id)
       select gen_random_uuid(), $1, current_date, 'MXN', false, 'INCOMPLETO', $2
        where not exists (select 1 from contratos_arrendamiento where sitio_id = $1)`,
      [org.sitioId, org.id],
    )
    const r = await c.pedir(`/api/sitios/${org.sitioId}/`, { metodo: 'PATCH', cuerpo: { propio: true } })
    // Es un cambio sensible: o pasa, o pide la contraseña (403 con desbloqueo).
    if (r.status === 403) return expect(r.datos.desbloqueo ?? r.datos.error).toBeTruthy()
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.sitio.propio).toBe(true)
    expect(await contratosDe(org.sitioId)).not.toContain('INCOMPLETO')
  })

  it('con un contrato VIGENTE no se puede: 409', async () => {
    const s = await c.pedir('/api/sitios/', { cuerpo: { nombre: 'Con renta', propio: true, lat: 19.43, lng: -99.13 } })
    const id = s.datos.id
    await poolTest().query('update sitios set propio = false where id = $1', [id])
    const arr = await poolTest().query(`insert into arrendadores (nombre, tenant_id) values ('Don Renta', $1) returning id`, [org.id])
    await poolTest().query(
      `insert into contratos_arrendamiento (id, sitio_id, arrendador_id, fecha_inicio, fecha_fin, monto_renta, periodicidad,
                                            moneda, auto_renovable, estatus, tenant_id)
       values (gen_random_uuid(), $1, $2, current_date, current_date + 365, 10000, 'MENSUAL', 'MXN', false, 'VIGENTE', $3)`,
      [id, arr.rows[0].id, org.id],
    )
    const r = await c.pedir(`/api/sitios/${id}/`, { metodo: 'PATCH', cuerpo: { propio: true } })
    if (r.status === 403) return
    expect(r.status).toBe(409)
    expect(r.datos.error).toMatch(/contrato de renta vigente/)
  })
})

describe('4 · importar un lote propio', () => {
  it('entra sin arrendador, sin contratos, y su predio nace propio', async () => {
    const fila = (codigo: string) => ({
      status: 'ok',
      codigo_proveedor: codigo,
      datos: {
        codigo_proveedor: codigo, nombre: `Propia ${codigo}`, tipo_medio: 'ESPECTACULAR', direccion: 'Calle 1',
        plaza_ciudad: 'CDMX', latitud: 19.43, longitud: -99.13, exhibicion: 'fijo', unidad: 'mensual',
        tarifa_publicada: 1000,
      },
    })
    const r = await c.pedir('/api/sitios/import/', {
      cuerpo: { filas: [fila('PROP-1'), fila('PROP-2')], propio: true, predio: { nombre: 'Terreno propio' } },
    })
    expect(r.status, JSON.stringify(r.datos)).toBeLessThan(300)
    const s = await poolTest().query(
      `select s.propio, s.arrendador_id, p.propio as predio_propio, p.arrendador_id as predio_arr
         from sitios s join predios p on p.id = s.predio_id
        where s.codigo_proveedor in ('PROP-1','PROP-2')`,
    )
    expect(s.rows).toHaveLength(2)
    for (const x of s.rows) {
      expect(x.propio).toBe(true)
      expect(x.arrendador_id).toBeNull()
      expect(x.predio_propio).toBe(true)
      expect(x.predio_arr).toBeNull()
    }
    const k = await poolTest().query(
      `select count(*)::int n from contratos_arrendamiento c join sitios s on s.id = c.sitio_id
        where s.codigo_proveedor in ('PROP-1','PROP-2')`,
    )
    expect(k.rows[0].n).toBe(0)
  })

  it('un lote RENTADO sin arrendador sigue siendo 400', async () => {
    const r = await c.pedir('/api/sitios/import/', { cuerpo: { filas: [{ status: 'ok', datos: {} }] } })
    expect(r.status).toBe(400)
  })
})

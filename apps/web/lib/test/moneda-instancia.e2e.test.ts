import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { numeroALetras } from '../contrato-documento'
import { join } from 'node:path'
import { recrearEsquema, cerrarPool, poolTest, comoTenant } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  ADR 0048 · LA MONEDA DE LA INSTANCIA NO SE CAMBIA — las dos capas.
//
//  Decision del dueno (02/11): la moneda (MXN o USD) se elige al crear la
//  instancia y despues NO se puede cambiar. Los importes guardados no llevan
//  moneda propia: cambiarla los reinterpretaria sin convertirlos.
//
//  Dos capas, y aqui se prueban las dos POR LO QUE IMPIDEN:
//
//    1. La BASE (`20261102_moneda_inmutable_por_instancia.sql`): CHECK, un
//       trigger que impide el UPDATE y otro que impide una segunda moneda.
//       Se prueba con el superusuario y con el rol de la app: un trigger no
//       es un permiso, y tiene que parar a los dos.
//    2. La API: `PATCH /api/config` rechaza `moneda` con un 400 que dice por
//       que, antes de guardar nada.
//
//  Y el positivo que pidio el dueno: una instancia que ya existe sigue en MXN.
//  La creacion (elegir USD, rechazar EUR) va en `bootstrap.e2e.test.ts`, que
//  es donde se puede vaciar la base y entrar por la puerta de un solo uso.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente

const MIGRACION = join(process.cwd(), '..', '..', 'db', 'migrations', '20261102_moneda_inmutable_por_instancia.sql')

async function monedaDe(tabla: 'tenants' | 'config_negocio', id: string): Promise<string> {
  const col = tabla === 'tenants' ? 'id' : 'tenant_id'
  const r = await poolTest().query(`select moneda from ${tabla} where ${col} = $1`, [id])
  return r.rows[0]?.moneda
}

/** Ejecuta y devuelve el mensaje del error, o `null` si NO fallo. */
async function falla(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (e) {
    return (e as Error).message
  }
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('monedaalfa')
  await arrancarServidor()
  ca = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  // Los contratos son cambio sensible: sin desbloquear, el 403 del candado
  // taparia el 400 de la moneda y las pruebas pasarian por el motivo equivocado.
  const d = await ca.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
  expect(d.status, JSON.stringify(d.datos)).toBe(200)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('una instancia que YA existe se queda en MXN', () => {
  it('toda organizacion y toda configuracion siguen en MXN tras la migracion', async () => {
    // `recrearEsquema()` aplica las migraciones SOBRE una base que ya tiene
    // organizacion (`semilla-desarrollo.sql`), que es el caso del droplet.
    const t = await poolTest().query('select distinct moneda from tenants')
    const c = await poolTest().query('select distinct moneda from config_negocio')
    expect(t.rows.map((r) => r.moneda)).toEqual(['MXN'])
    expect(c.rows.map((r) => r.moneda)).toEqual(['MXN'])
  })

  it('y la app la sirve como MXN', async () => {
    const r = await ca.pedir('/api/config/')
    expect(r.status).toBe(200)
    expect(r.datos.moneda).toBe('MXN')
  })

  it('la migracion es idempotente: aplicarla otra vez no rompe ni cambia nada', async () => {
    await poolTest().query(readFileSync(MIGRACION, 'utf8'))
    expect(await monedaDe('tenants', alfa.id)).toBe('MXN')
    const trig = await poolTest().query(
      `select count(*)::int n from pg_trigger where tgname in
        ('trg_tenants_moneda_inmutable','trg_tenants_moneda_unica',
         'trg_config_negocio_moneda_inmutable','trg_config_negocio_moneda_espejo')`,
    )
    expect(trig.rows[0].n).toBe(4)
  })
})

describe('CAPA 1 · la base no deja cambiarla', () => {
  it('NEGATIVO · UPDATE de tenants.moneda falla, incluso con el superusuario', async () => {
    const error = await falla(() =>
      poolTest().query("update tenants set moneda = 'USD' where id = $1", [alfa.id]),
    )
    expect(error).toMatch(/moneda de la instancia no se puede cambiar/)
    expect(await monedaDe('tenants', alfa.id)).toBe('MXN')
  })

  it('NEGATIVO · UPDATE de config_negocio.moneda falla', async () => {
    const error = await falla(() =>
      poolTest().query("update config_negocio set moneda = 'USD' where tenant_id = $1", [alfa.id]),
    )
    expect(error).toMatch(/moneda de la instancia no se puede cambiar/)
    expect(await monedaDe('config_negocio', alfa.id)).toBe('MXN')
  })

  it('NEGATIVO · y con el rol de la APP, dentro de su organizacion, tampoco', async () => {
    // El rol de la app SI puede escribir `config_negocio` de su tenant (es lo
    // que hace `PATCH /api/config`). Lo que la para es el trigger, no un permiso.
    const error = await falla(() =>
      comoTenant(alfa.id, (q) => q("update config_negocio set moneda = 'USD' where tenant_id = $1", [alfa.id])),
    )
    expect(error).toMatch(/moneda de la instancia no se puede cambiar/)
    expect(await monedaDe('config_negocio', alfa.id)).toBe('MXN')
  })

  it('reescribir el MISMO valor si pasa (los upserts de las semillas lo hacen)', async () => {
    await poolTest().query("update tenants set moneda = 'MXN', nombre = nombre where id = $1", [alfa.id])
    await poolTest().query("update config_negocio set moneda = 'MXN' where tenant_id = $1", [alfa.id])
    expect(await monedaDe('tenants', alfa.id)).toBe('MXN')
  })

  it('NEGATIVO · una organizacion nueva en OTRA moneda no nace (una moneda por instancia)', async () => {
    const error = await falla(() =>
      poolTest().query("insert into tenants (nombre, slug, moneda) values ('Dolares', 'dolares-e2e', 'USD')"),
    )
    expect(error).toMatch(/trabaja en MXN/)
    const r = await poolTest().query("select count(*)::int n from tenants where slug = 'dolares-e2e'")
    expect(r.rows[0].n).toBe(0)
  })

  it('NEGATIVO · una moneda que no es MXN ni USD no entra, ni siquiera sin la regla de unicidad', async () => {
    // Con organizaciones en MXN, el trigger de unicidad salta ANTES que el
    // CHECK. Para ver el CHECK solo, se apaga ese trigger dentro de una
    // transaccion que se deshace: lo que se mide es la segunda red.
    const c = await poolTest().connect()
    try {
      await c.query('begin')
      await c.query('alter table tenants disable trigger trg_tenants_moneda_unica')
      const error = await falla(() =>
        c.query("insert into tenants (nombre, slug, moneda) values ('Euros', 'euros-e2e', 'EUR')"),
      )
      expect(error).toMatch(/tenants_moneda_ck/)
    } finally {
      await c.query('rollback')
      c.release()
    }
    const trig = await poolTest().query(
      "select tgenabled from pg_trigger where tgname = 'trg_tenants_moneda_unica'",
    )
    expect(trig.rows[0].tgenabled).toBe('O') // sigue encendido
  })

  it('config_negocio nace con la moneda de su organizacion, venga lo que venga en el INSERT', async () => {
    // `obtenerConfigRow()` crea la fila perezosamente con los DEFAULT. Sin el
    // espejo, en una instancia USD habria nacido en MXN.
    const beta = await poolTest().query(
      "insert into tenants (nombre, slug) values ('Beta', 'moneda-beta-e2e') returning id",
    )
    const id = beta.rows[0].id
    await poolTest().query("insert into config_negocio (tenant_id, moneda) values ($1, 'USD')", [id])
    expect(await monedaDe('config_negocio', id)).toBe('MXN')
  })
})

describe('CAPA 2 · la API no deja cambiarla', () => {
  it('NEGATIVO · PATCH /api/config con otra moneda es un 400 que dice por que, y no guarda nada', async () => {
    const r = await ca.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { moneda: 'USD', loopSeg: 45 } })
    expect(r.status).toBe(400)
    expect(r.datos.error).toBe(
      'La moneda no se puede cambiar: se eligió al crear la instancia y los importes guardados no la llevan',
    )
    expect(await monedaDe('config_negocio', alfa.id)).toBe('MXN')
    // Y el campo que venia al lado NO se guardo: el rechazo va antes de todo.
    const cfg = await poolTest().query('select loop_seg from config_negocio where tenant_id = $1', [alfa.id])
    expect(Number(cfg.rows[0].loop_seg)).toBe(60)
  })

  it('NEGATIVO · tambien con la MISMA moneda: el campo no se acepta, no se compara', async () => {
    const r = await ca.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { moneda: 'MXN' } })
    expect(r.status).toBe(400)
  })

  it('NEGATIVO · y con una que ni existe (EUR), el mismo 400', async () => {
    const r = await ca.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { moneda: 'EUR' } })
    expect(r.status).toBe(400)
    expect(await monedaDe('config_negocio', alfa.id)).toBe('MXN')
  })

  it('el resto de la configuracion se sigue guardando como siempre', async () => {
    const r = await ca.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { loopSeg: 45 } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.loopSeg).toBe(45)
    expect(r.datos.moneda).toBe('MXN')
  })
})

// ─── Contratos: van en la moneda de la instancia ───────────────────────────
describe('CAPA 2 · los contratos tampoco entran en otra moneda', () => {
  const MSJ = 'Un contrato va en la moneda de la instancia: no se puede capturar en otra'

  async function idsDeAlfa() {
    const r = await poolTest().query(
      'select id, arrendador_id, predio_id, moneda from contratos_arrendamiento where sitio_id = $1',
      [alfa.sitioId],
    )
    return r.rows[0]
  }

  it('NEGATIVO · dar de alta un contrato en USD es 400 y no crea nada', async () => {
    const c = await idsDeAlfa()
    const antes = (await poolTest().query('select count(*)::int n from contratos_arrendamiento')).rows[0].n
    const r = await ca.pedir('/api/contratos/', {
      cuerpo: {
        arrendador: { id: c.arrendador_id },
        predio: { id: c.predio_id },
        sitio: { nombre: 'Pantalla en dolares' },
        contrato: { fechaInicio: '2026-01-01', fechaFin: '2026-12-31', montoRenta: 1000, moneda: 'USD' },
      },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(r.datos.error).toBe(MSJ)
    expect((await poolTest().query('select count(*)::int n from contratos_arrendamiento')).rows[0].n).toBe(antes)
  })

  it('NEGATIVO · editar un contrato a USD es 400 y su moneda no cambia', async () => {
    const c = await idsDeAlfa()
    const r = await ca.pedir(`/api/contratos/${c.id}/`, { metodo: 'PATCH', cuerpo: { moneda: 'USD' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(r.datos.error).toBe(MSJ)
    expect((await idsDeAlfa()).moneda).toBe('MXN')
  })
})

// ─── /api/tenants: una organizacion nueva hereda la moneda ──────────────────
describe('CAPA 2 · /api/tenants no deja crear una organizacion en otra moneda', () => {
  const EMAIL_PLATAFORMA = 'duena-plataforma@moneda.test'
  let plataforma: Cliente

  beforeAll(async () => {
    // `puedeCambiarCrm()` exige el Dueno del tenant MAS ANTIGUO, que es el `rgb`
    // de `semilla-desarrollo.sql` (mismo patron que `alta-organizacion.e2e`).
    const t = await poolTest().query('select id from tenants order by creado_en asc limit 1')
    await poolTest().query(
      `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
       values ('Duena plataforma', $1, 'DUENO', $2, true, $3) on conflict do nothing`,
      [EMAIL_PLATAFORMA, await bcrypt.hash(PASSWORD_DEMO, 4), t.rows[0].id],
    )
    plataforma = new Cliente()
    await plataforma.entrar(EMAIL_PLATAFORMA, PASSWORD_DEMO)
  })

  const alta = (slug: string, extra: Record<string, unknown> = {}) =>
    plataforma.pedir('/api/tenants/', {
      cuerpo: {
        nombre: `Org ${slug}`,
        slug,
        admin: { nombre: 'Duena', email: `duena@${slug}.test`, password: 'UnaClaveLarga123' },
        ...extra,
      },
    })

  it('NEGATIVO · pedir USD en una instancia MXN es 400 y no nace nada', async () => {
    const r = await alta('dolares-api', { moneda: 'USD' })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(r.datos.error).toBe(
      'La moneda de la instancia ya está fijada: una organización nueva nace en la misma que las demás',
    )
    const n = await poolTest().query("select count(*)::int n from tenants where slug = 'dolares-api'")
    expect(n.rows[0].n).toBe(0)
  })

  it('NEGATIVO · y EUR, que ni existe, tambien 400', async () => {
    const r = await alta('euros-api', { moneda: 'EUR' })
    expect(r.status).toBe(400)
    expect(r.datos.error).toBe('La moneda debe ser MXN o USD')
  })

  it('sin moneda nace, y hereda la de la instancia', async () => {
    const r = await alta('hereda-api')
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    const m = await poolTest().query("select moneda from tenants where slug = 'hereda-api'")
    expect(m.rows[0].moneda).toBe('MXN')
  })
})

// ─── Firmas: lo congelado antes del ADR 0048 sigue valido ──────────────────
//
// Hasta el 02/11 la letra decia «PESOS … M.N.» para CUALQUIER moneda. Un
// contrato en USD (de cuando existia el selector) congelado entonces tiene ESE
// texto sellado. Con la letra nueva su hash ya no coincidiria y sus firmas
// aparecerian alteradas sin que nadie tocara nada. Aqui se reproduce: se firma,
// y se reescribe lo congelado con la regla de antes, como lo habria dejado la
// version anterior.
describe('FIRMAS · un contrato en USD congelado con la letra de antes NO aparece alterado', () => {
  let contratoId: string

  beforeAll(async () => {
    const p = poolTest()
    contratoId = (await p.query('select id from contratos_arrendamiento where sitio_id = $1', [alfa.sitioId])).rows[0].id
    // Lo que el documento exige para poder enviarse (como en `contrato-firmado-editable.e2e`).
    await p.query(
      `update tenants set rfc = 'OFA010101AAA', domicilio_fiscal = 'Av. Reforma 1, CDMX',
                          representante_legal = 'Ana Directora' where id = $1`,
      [alfa.id],
    )
    await p.query(
      `update arrendadores set rfc = 'ARR010101BBB', direccion = 'Calle del Dueño 5, CDMX' where tenant_id = $1`,
      [alfa.id],
    )
    await p.query(`update predios set direccion = 'Insurgentes 100, CDMX' where tenant_id = $1`, [alfa.id])
    // Un contrato que quedo en USD de antes del 30/09. La moneda de un CONTRATO
    // no la protege ningun trigger (es almacen); la API ya no deja ponerla.
    await p.query(`update contratos_arrendamiento set moneda = 'USD', monto_renta = 20000 where id = $1`, [contratoId])

    const estado = await ca.pedir(`/api/contratos/${contratoId}/firma/`)
    const e = await ca.pedir(`/api/contratos/${contratoId}/firma/`, {
      cuerpo: { accion: 'enviar', huellaRevisada: estado.datos.huellaDatos },
    })
    expect(e.status, JSON.stringify(e.datos)).toBe(200)
    const f = await ca.pedir(`/api/contratos/${contratoId}/firma/`, { cuerpo: { accion: 'firmar' } })
    expect(f.status, JSON.stringify(f.datos)).toBe(200)

    // Lo que habria sellado la version anterior: la misma letra, en PESOS.
    const c = (
      await p.query('select documento_congelado, monto_renta, deposito from contratos_arrendamiento where id = $1', [
        contratoId,
      ])
    ).rows[0]
    let viejo: string = c.documento_congelado
    for (const n of [c.monto_renta, c.deposito].filter((x) => x != null).map(Number)) {
      viejo = viejo.split(numeroALetras(n, 'USD')).join(numeroALetras(n, 'MXN'))
    }
    expect(viejo).not.toBe(c.documento_congelado) // el arnes cambio algo de verdad
    expect(viejo).not.toMatch(/DÓLAR/)
    const hashViejo = createHash('sha256').update(viejo, 'utf8').digest('hex')
    await p.query('update contratos_arrendamiento set documento_congelado = $2, documento_hash = $3 where id = $1', [
      contratoId,
      viejo,
      hashViejo,
    ])
    await p.query("update contrato_firmas set documento_hash = $2 where contrato_id = $1 and estatus = 'FIRMADA'", [
      contratoId,
      hashViejo,
    ])
  })

  it('el hash vigente es el que se firmo, y ninguna firma queda invalidada', async () => {
    const r = await ca.pedir(`/api/contratos/${contratoId}/firma/`)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.hashActual).toBe(r.datos.hashCongelado)
    const firmadas = r.datos.firmas.filter((x: any) => x.estatus === 'FIRMADA')
    expect(firmadas.length).toBeGreaterThan(0)
    expect(firmadas.every((x: any) => x.invalidada === false)).toBe(true)
  })

  it('NEGATIVO · y si un dato cambia, SI aparece alterada (la compatibilidad no ciega)', async () => {
    await poolTest().query('update contratos_arrendamiento set monto_renta = 21000 where id = $1', [contratoId])
    const r = await ca.pedir(`/api/contratos/${contratoId}/firma/`)
    expect(r.datos.hashActual).not.toBe(r.datos.hashCongelado)
    expect(r.datos.firmas.some((x: any) => x.estatus === 'FIRMADA' && x.invalidada)).toBe(true)
  })
})

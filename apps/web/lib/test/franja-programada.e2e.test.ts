import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  PROG-01 · la franja PROGRAMADA de una campaña, contra Postgres de verdad.
// ----------------------------------------------------------------------------
//  Decisión del dueño (2026-09-30): «es para horario transmisión ya que el
//  precio ya debe de estar en la campaña después de la propuesta». Programar
//  una franja NO es venderla: lo vendido está en `reservas.franja_id` y
//  congelado en `propuestas.snapshot_economico`, y esto no lo toca.
//
//  Es migración + tenant, así que va aquí y no solo en unitarias, que simulan
//  la base y no ven ninguna de las cuatro cosas que esta fase arriesga:
//
//   1. **La migración**: la columna existe, la FK es COMPUESTA con el tenant y
//      la tabla sigue con RLS forzada.
//   2. **R2**: una franja o una campaña de OTRA organización no existe para
//      ésta —404, y nada escrito—, también cuando se manda por la red.
//   3. **Atomicidad en bloque**: si UNA de las campañas del lote no es de la
//      organización, no se programa NINGUNA.
//   4. **Lo contratado no se mueve**: precio, snapshot y `reservas.franja_id`
//      salen idénticos después de programar.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente
let cop: Cliente

const franja: Record<string, string> = {}
const campana: Record<string, string> = {}

async function sembrarFranja(tenantId: string, nombre: string, desde: string, hasta: string, orden: number) {
  const r = await poolTest().query(
    `insert into franjas_horarias (tenant_id, nombre, hora_inicio, hora_fin, orden)
     values ($1,$2,$3,$4,$5) returning id`,
    [tenantId, nombre, desde, hasta, orden],
  )
  return r.rows[0].id as string
}

/**
 * Una campaña nacida de una propuesta APROBADA con su snapshot congelado y una
 * reserva que HEREDÓ la franja contratada. Se siembra con el pool de pruebas
 * (superusuario) porque lo que se mide aquí no es cómo nace, sino que
 * programarla no la toca.
 */
async function sembrarCampana(
  org: { id: string; slug: string; clienteId: string; sitioId: string },
  nombre: string,
  franjaContratada: string | null,
) {
  const p = poolTest()
  const snap = {
    porSitio: [{ sitioId: org.sitioId, lista: 1800, neto: 1800, tarifaUnitaria: 1800, franja: franjaContratada ? { id: franjaContratada, nombre: 'Prime' } : null }],
  }
  const prop = await p.query(
    `insert into propuestas (folio, nombre, estatus, tenant_id, snapshot_economico)
     values ($1,$2,'APROBADA',$3,$4::jsonb) returning id`,
    [`PRO-${org.slug}-${nombre}`, `Propuesta ${nombre}`, org.id, JSON.stringify(snap)],
  )
  const c = await p.query(
    `insert into campanas (folio, nombre, cliente_id, fecha_inicio, fecha_fin, estado_comercial,
                           propuesta_id, tenant_id, presupuesto_neto)
     values ($1,$2,$3,$4,$5,'ACTIVA',$6,$7,1800) returning id`,
    [`CMP-${org.slug}-${nombre}`, nombre, org.clienteId, enDias(1), enDias(30), prop.rows[0].id, org.id],
  )
  await p.query(
    `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, estatus, tenant_id, franja_id)
     values ($1,$2,$3,$4,1800,'CONFIRMADA',$5,$6)`,
    [c.rows[0].id, org.sitioId, enDias(1), enDias(30), org.id, franjaContratada],
  )
  return c.rows[0].id as string
}

/** Lo que NO se puede mover al programar: precio, snapshot y franja contratada. */
async function contratado(campanaId: string) {
  const r = await poolTest().query(
    `select c.presupuesto_neto, p.snapshot_economico,
            json_agg(json_build_object('precio', r.precio, 'franja', r.franja_id) order by r.id) as reservas
       from campanas c
       join propuestas p on p.id = c.propuesta_id
       join reservas r on r.campana_id = c.id
      where c.id = $1
      group by c.presupuesto_neto, p.snapshot_economico`,
    [campanaId],
  )
  return r.rows[0]
}

async function programadaDe(campanaId: string): Promise<string | null> {
  const r = await poolTest().query('select franja_programada_id from campanas where id = $1', [campanaId])
  return r.rows[0].franja_programada_id
}

const RUTA = '/api/campanas/franja-programada/'

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('progalfa')
  beta = await sembrarTenant('progbeta')
  // OPERACIONES tiene `comercial.ver` pero NO `comercial.crear`: lee la
  // programación y no puede cambiarla.
  const op = await sembrarTenant('progop', { rol: 'OPERACIONES' })

  franja.alfaPrime = await sembrarFranja(alfa.id, 'Prime', '06:00', '10:00', 1)
  franja.alfaNoche = await sembrarFranja(alfa.id, 'Noche', '20:00', '23:00', 2)
  franja.alfaBaja = await sembrarFranja(alfa.id, 'Madrugada', '00:00', '05:00', 0)
  await poolTest().query('update franjas_horarias set activo = false where id = $1', [franja.alfaBaja])
  franja.betaPrime = await sembrarFranja(beta.id, 'Prime', '06:00', '10:00', 1)

  campana.alfa1 = await sembrarCampana(alfa, 'uno', franja.alfaPrime)
  campana.alfa2 = await sembrarCampana(alfa, 'dos', null)
  campana.beta1 = await sembrarCampana(beta, 'uno', franja.betaPrime)
  campana.op1 = await sembrarCampana(op, 'uno', null)

  await arrancarServidor()
  ca = new Cliente()
  cb = new Cliente()
  cop = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cb.entrar(beta.usuarioEmail, PASSWORD_DEMO)
  await cop.entrar(op.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// ─── 1 · LA MIGRACIÓN ───────────────────────────────────────────────────────

describe('1 · la migración dejó el esquema como se pidió', () => {
  it('`campanas.franja_programada_id` es uuid, NULLABLE y SIN default', async () => {
    const r = await poolTest().query(
      `select data_type, is_nullable, column_default from information_schema.columns
        where table_name = 'campanas' and column_name = 'franja_programada_id'`,
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].data_type).toBe('uuid')
    // Sin DEFAULT: ninguna campaña de hoy queda «programada» por la migración.
    expect(r.rows[0].is_nullable).toBe('YES')
    expect(r.rows[0].column_default).toBeNull()
  })

  it('la FK es COMPUESTA (franja, tenant) y `restrict`', async () => {
    const r = await poolTest().query(
      `select array_length(conkey, 1) as columnas, confdeltype, confrelid::regclass::text as destino
         from pg_constraint where conname = 'campanas_franja_programada_fkey'`,
    )
    expect(r.rows).toHaveLength(1)
    expect(Number(r.rows[0].columnas)).toBe(2)
    expect(r.rows[0].confdeltype).toBe('r')
    expect(r.rows[0].destino).toBe('franjas_horarias')
  })

  it('la FK corta en la BASE una franja de otra organización, aunque nadie la valide', async () => {
    // Es la capa que queda el día que alguien añada otra ruta y olvide validar.
    await expect(
      poolTest().query('update campanas set franja_programada_id = $1 where id = $2', [
        franja.betaPrime,
        campana.alfa1,
      ]),
    ).rejects.toThrow(/campanas_franja_programada_fkey|foreign key/i)
  })

  it('`campanas` sigue con RLS ENABLE y FORCE', async () => {
    const r = await poolTest().query(
      `select relrowsecurity, relforcerowsecurity from pg_class where relname = 'campanas'`,
    )
    expect(r.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true })
  })

  it('nace sin ninguna campaña programada', async () => {
    const r = await poolTest().query(
      'select count(*)::int as n from campanas where franja_programada_id is not null',
    )
    expect(r.rows[0].n).toBe(0)
  })
})

// ─── 2 · ASIGNAR EN BLOQUE ──────────────────────────────────────────────────

describe('2 · se programa una franja en VARIAS campañas de una vez', () => {
  it('asigna Noche a las dos campañas de alfa en una sola operación', async () => {
    const r = await ca.pedir(RUTA, {
      metodo: 'PUT',
      cuerpo: { franjaId: franja.alfaNoche, campanaIds: [campana.alfa1, campana.alfa2] },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(await programadaDe(campana.alfa1)).toBe(franja.alfaNoche)
    expect(await programadaDe(campana.alfa2)).toBe(franja.alfaNoche)
  })

  it('queda en la bitácora de acciones, con la franja y los folios', async () => {
    const r = await poolTest().query(
      `select accion, entidad from acciones where tenant_id = $1 and accion like 'Programó%'
        order by "timestamp" desc limit 1`,
      [alfa.id],
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].accion).toMatch(/Noche/)
    expect(r.rows[0].entidad).toContain('CMP-progalfa-uno')
  })

  it('la lectura devuelve el AVISO «se vendió como Prime y se programa en Noche»', async () => {
    const r = await ca.pedir(`${RUTA}?campanaId=${campana.alfa1}`)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.campanas).toHaveLength(1)
    const c = r.datos.campanas[0]
    expect(c.franjaProgramadaId).toBe(franja.alfaNoche)
    expect(c.avisos).toHaveLength(1)
    expect(c.avisos[0].texto).toMatch(/«Prime».*«Noche»/)
  })

  it('la campaña vendida SIN franja no avisa aunque esté programada', async () => {
    const r = await ca.pedir(`${RUTA}?campanaId=${campana.alfa2}`)
    expect(r.datos.campanas[0].avisos).toEqual([])
  })

  it('se QUITA con franjaId null', async () => {
    const r = await ca.pedir(RUTA, { metodo: 'PUT', cuerpo: { franjaId: null, campanaIds: [campana.alfa2] } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(await programadaDe(campana.alfa2)).toBeNull()
    // La otra no se tocó: quitar es por campaña, no por franja.
    expect(await programadaDe(campana.alfa1)).toBe(franja.alfaNoche)
  })

  it('una franja DADA DE BAJA no se puede programar: 404 y nada escrito', async () => {
    const r = await ca.pedir(RUTA, {
      metodo: 'PUT',
      cuerpo: { franjaId: franja.alfaBaja, campanaIds: [campana.alfa2] },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(404)
    expect(await programadaDe(campana.alfa2)).toBeNull()
  })
})

// ─── 3 · ATOMICIDAD ─────────────────────────────────────────────────────────

describe('3 · todo o nada: si una campaña no es de la organización, no se programa NINGUNA', () => {
  it('lote con una campaña de beta → 404, y la de alfa queda como estaba', async () => {
    const antes = await programadaDe(campana.alfa1)
    const r = await ca.pedir(RUTA, {
      metodo: 'PUT',
      cuerpo: { franjaId: franja.alfaPrime, campanaIds: [campana.alfa1, campana.beta1] },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(404)
    expect(String(r.datos.error)).toMatch(/ninguna/i)
    // La de alfa NO se movió a Prime: el lote entero se rechazó.
    expect(await programadaDe(campana.alfa1)).toBe(antes)
    // Y la de beta tampoco, que es la que de verdad importa.
    expect(await programadaDe(campana.beta1)).toBeNull()
  })

  it('un id que no existe en ningún sitio tampoco deja nada a medias', async () => {
    const r = await ca.pedir(RUTA, {
      metodo: 'PUT',
      cuerpo: {
        franjaId: franja.alfaPrime,
        campanaIds: [campana.alfa2, '99999999-9999-4999-8999-999999999999'],
      },
    })
    expect(r.status).toBe(404)
    expect(await programadaDe(campana.alfa2)).toBeNull()
  })
})

// ─── 4 · R2 · AISLAMIENTO ───────────────────────────────────────────────────

describe('4 · lo de otra organización no existe para ésta', () => {
  it('alfa NO puede programar la franja de beta en su campaña: 404', async () => {
    const r = await ca.pedir(RUTA, {
      metodo: 'PUT',
      cuerpo: { franjaId: franja.betaPrime, campanaIds: [campana.alfa2] },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(404)
    expect(await programadaDe(campana.alfa2)).toBeNull()
  })

  it('alfa NO puede programar la campaña de beta ni con una franja de beta', async () => {
    const r = await ca.pedir(RUTA, {
      metodo: 'PUT',
      cuerpo: { franjaId: franja.betaPrime, campanaIds: [campana.beta1] },
    })
    expect(r.status).toBe(404)
    expect(await programadaDe(campana.beta1)).toBeNull()
  })

  it('la lectura de alfa no trae ni campañas ni franjas de beta', async () => {
    const r = await ca.pedir(RUTA)
    expect(r.status).toBe(200)
    const ids = (r.datos.campanas as { id: string }[]).map((c) => c.id)
    expect(ids).toContain(campana.alfa1)
    expect(ids).not.toContain(campana.beta1)
    const fr = (r.datos.franjas as { id: string }[]).map((f) => f.id)
    expect(fr).toContain(franja.alfaPrime)
    expect(fr).not.toContain(franja.betaPrime)
    // Pedir la de beta por id da una lista vacía, no la campaña.
    const rb = await ca.pedir(`${RUTA}?campanaId=${campana.beta1}`)
    expect(rb.datos.campanas).toEqual([])
  })

  it('y beta sí ve lo suyo, que es lo que prueba que el vacío es aislamiento', async () => {
    const r = await cb.pedir(`${RUTA}?campanaId=${campana.beta1}`)
    expect(r.datos.campanas).toHaveLength(1)
  })
})

// ─── 5 · PERMISO ────────────────────────────────────────────────────────────

describe('5 · programar exige `comercial.crear`', () => {
  it('OPERACIONES lee (comercial.ver) pero NO programa: 403 y nada escrito', async () => {
    const lee = await cop.pedir(RUTA)
    expect(lee.status, JSON.stringify(lee.datos)).toBe(200)
    const r = await cop.pedir(RUTA, { metodo: 'PUT', cuerpo: { franjaId: null, campanaIds: [campana.op1] } })
    expect(r.status, JSON.stringify(r.datos)).toBe(403)
  })

  it('sin sesión: 401', async () => {
    const anon = new Cliente()
    const r = await anon.pedir(RUTA)
    expect(r.status).toBe(401)
  })
})

// ─── 6 · LO CONTRATADO NO SE MUEVE ──────────────────────────────────────────

describe('6 · programar NO toca precio, snapshot ni la franja contratada', () => {
  it('programar y desprogramar deja lo contratado IDÉNTICO', async () => {
    const antes = await contratado(campana.alfa1)
    expect(antes.reservas[0].franja).toBe(franja.alfaPrime)

    const a = await ca.pedir(RUTA, { metodo: 'PUT', cuerpo: { franjaId: franja.alfaNoche, campanaIds: [campana.alfa1] } })
    expect(a.status).toBe(200)
    const b = await ca.pedir(RUTA, { metodo: 'PUT', cuerpo: { franjaId: null, campanaIds: [campana.alfa1] } })
    expect(b.status).toBe(200)

    const despues = await contratado(campana.alfa1)
    expect(despues).toEqual(antes)
    // `reservas.franja_id` sigue siendo la VENDIDA, no la programada.
    expect(despues.reservas[0].franja).toBe(franja.alfaPrime)
  })
})

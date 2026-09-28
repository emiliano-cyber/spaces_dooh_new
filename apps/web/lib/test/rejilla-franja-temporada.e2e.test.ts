import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  REJILLA-01 · la rejilla de precios contra Postgres de verdad. ADR 0039.
// ----------------------------------------------------------------------------
//  Es ROJO por triple —migración, tenant y dinero— y por eso estas pruebas
//  existen: las unitarias SIMULAN la base, así que hay tres cosas que no pueden
//  ver, y las tres son exactamente lo que esta fase arriesga.
//
//   1. **Que la migración se aplicó.** Media docena de consultas nuevas hacen
//      `left join franjas_horarias`. Si la tabla no existiera, las unitarias
//      seguirían en verde y el detalle de propuestas devolvería un 500.
//   2. **Que la FK COMPUESTA corta de verdad.** `franja_id` entra por el CUERPO
//      de la petición —la elige el vendedor—, y una FK plana se comprueba con
//      los privilegios del dueño de la tabla y ELUDE la RLS. Aquí se manda una
//      franja AJENA por la red y se mira qué quedó escrito. Es la diferencia
//      entre «el controller lo valida» y «el atacante no lo consigue».
//   3. **Que una propuesta APROBADA no cambia de precio.** El congelado es el
//      invariante más importante del ADR y su modo de fallo NO DA ERROR: la
//      propuesta se leería perfectamente bien, solo que con el precio de hoy en
//      vez de con el que el cliente aceptó.
//
//  Y la cuarta, que no es de seguridad pero es la que protege a los clientes de
//  hoy: **vender SIN franja tiene que seguir funcionando**. Hay inventario
//  cargado y propuestas vivas; si la rejilla se volviera obligatoria, la fase
//  estaría mal hecha por muy bien que calcule.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente

/** La franja «Prime» de cada organización, sembrada con el pool de pruebas. */
const franjas: Record<string, string> = {}

async function sembrarFranja(org: { id: string; slug: string }): Promise<string> {
  const r = await poolTest().query(
    `insert into franjas_horarias (tenant_id, nombre, hora_inicio, hora_fin, orden)
     values ($1, $2, '06:00', '10:00', 1) returning id`,
    [org.id, `Prime ${org.slug}`],
  )
  return r.rows[0].id as string
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('rejalfa')
  beta = await sembrarTenant('rejbeta')
  franjas.alfa = await sembrarFranja(alfa)
  franjas.beta = await sembrarFranja(beta)

  await arrancarServidor()
  ca = new Cliente()
  cb = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cb.entrar(beta.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

/** El candado de las tarifas: la ruta entera es sensible. */
async function desbloquear(c: Cliente) {
  const r = await c.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
}

// ─── 1 · LA MIGRACIÓN ───────────────────────────────────────────────────────

describe('1 · la migración dejó el esquema como se pidió', () => {
  it('las tres tablas existen con RLS ENABLE y FORCE', async () => {
    const r = await poolTest().query(
      `select relname, relrowsecurity, relforcerowsecurity from pg_class
        where relname in ('franjas_horarias','temporadas','sitio_tarifas')`,
    )
    expect(r.rows).toHaveLength(3)
    for (const fila of r.rows) {
      expect(fila.relrowsecurity, `${fila.relname} sin RLS`).toBe(true)
      // FORCE es lo que hace que la política aplique también al DUEÑO de la
      // tabla. Sin él, el rol que corre las migraciones la ve entera.
      expect(fila.relforcerowsecurity, `${fila.relname} sin FORCE`).toBe(true)
    }
  })

  it('las cuatro FK hacia franja/temporada son COMPUESTAS con el tenant', async () => {
    // Una FK plana solo exigiría que la franja existiera EN ALGÚN SITIO, y se
    // comprueba con los privilegios del dueño de la tabla, así que elude la RLS.
    // Es el agujero que se midió el 18/09 con `entidad_id`.
    const r = await poolTest().query(
      `select conname, array_length(conkey, 1) as columnas, confdeltype
         from pg_constraint
        where conname in ('sitio_tarifas_franja_fkey','sitio_tarifas_temporada_fkey',
                          'propuesta_items_franja_fkey','reservas_franja_fkey')`,
    )
    expect(r.rows).toHaveLength(4)
    for (const fila of r.rows) {
      expect(Number(fila.columnas), `${fila.conname} no es compuesta`).toBe(2)
    }
    // Lo contratado no se puede borrar por debajo: 'r' = restrict.
    const items = r.rows.find((f) => f.conname === 'propuesta_items_franja_fkey')
    expect(items.confdeltype).toBe('r')
  })

  it('`propuesta_items.franja_id` es uuid, NULLABLE y SIN default', async () => {
    const r = await poolTest().query(
      `select data_type, is_nullable, column_default from information_schema.columns
        where table_name = 'propuesta_items' and column_name = 'franja_id'`,
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].data_type).toBe('uuid')
    // Sin DEFAULT: rellenar lo histórico con «la primera franja» convertiría
    // una laguna en una afirmación falsa sobre lo que un cliente aceptó.
    expect(r.rows[0].is_nullable).toBe('YES')
    expect(r.rows[0].column_default).toBeNull()
  })

  it('el único de `sitio_tarifas` impide DOS filas «sin franja» de la misma unidad', async () => {
    // La trampa de PostgreSQL 14 que esta migración esquiva con COALESCE: un
    // `unique` corriente NO deduplica NULLs —`nulls not distinct` es de la 15 y
    // g500 corre 14.24—, así que entrarían dos precios para la misma venta y
    // ganaría el que el `order by` quisiera.
    const p = poolTest()
    const c = await p.connect()
    try {
      await c.query('begin')
      const meter = () =>
        c.query(
          `insert into sitio_tarifas (tenant_id, sitio_id, unidad, tarifa_publicada)
           values ($1,$2,'spot',100)`,
          [alfa.id, alfa.sitioId],
        )
      await meter()
      await expect(meter()).rejects.toThrow(/duplicate key|idx_sitio_tarifas_rejilla/i)
    } finally {
      await c.query('rollback')
      c.release()
    }
  })
})

// ─── 2 · R2 · EL AISLAMIENTO, QUE ES LO QUE NO DA ERROR ─────────────────────

describe('2 · una franja de OTRA organización no existe para ésta', () => {
  it('el catálogo de alfa NO trae la franja de beta', async () => {
    const r = await ca.pedir('/api/rejilla/franjas/')
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const ids = (r.datos.franjas as { id: string }[]).map((f) => f.id)
    expect(ids).toContain(franjas.alfa)
    expect(ids).not.toContain(franjas.beta)
  })

  it('NO se puede CONTRATAR la franja de beta desde alfa, y el fallo se explica', async () => {
    const r = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Propuesta con franja ajena',
        fechaInicio: enDias(1),
        fechaFin: enDias(20),
        items: [
          {
            sitioId: alfa.sitioId,
            unidad: 'spot',
            tarifaUnitaria: 1000,
            cantidad: 5,
            franjaId: franjas.beta,
          },
        ],
      },
    })
    // 400 con una frase, no un 500 de restricción: quien lo lea tiene que saber
    // qué pasó. Y sobre todo: NO SE ESCRIBIÓ NADA.
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(String(r.datos.error)).toMatch(/franja/i)

    const filas = await poolTest().query(
      'select count(*)::int as n from propuesta_items where franja_id = $1',
      [franjas.beta],
    )
    expect(filas.rows[0].n).toBe(0)
  })

  it('NO se puede colgar una TARIFA de alfa de la franja de beta', async () => {
    await desbloquear(ca)
    const r = await ca.pedir(`/api/sitios/${alfa.sitioId}/rejilla/`, {
      metodo: 'PATCH',
      cuerpo: {
        guardar: [
          { unidad: 'spot', franjaId: franjas.beta, temporadaId: null, tarifaPublicada: 999 },
        ],
      },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    const filas = await poolTest().query(
      'select count(*)::int as n from sitio_tarifas where franja_id = $1',
      [franjas.beta],
    )
    expect(filas.rows[0].n).toBe(0)
  })

  it('la rejilla de una pantalla de beta NO se ve desde alfa', async () => {
    await poolTest().query(
      `insert into sitio_tarifas (tenant_id, sitio_id, unidad, franja_id, tarifa_publicada)
       values ($1,$2,'spot',$3,7777)`,
      [beta.id, beta.sitioId, franjas.beta],
    )
    const r = await ca.pedir(`/api/sitios/${beta.sitioId}/rejilla/`)
    expect(r.status).toBe(200)
    // Cero filas, no un 403: la RLS hace que la pantalla ajena simplemente no
    // exista. Lo que NO puede pasar es que salga el 7777.
    expect(JSON.stringify(r.datos)).not.toContain('7777')
    // Y beta sí la ve, que es lo que demuestra que el cero de arriba es
    // aislamiento y no que la siembra fallara.
    const rb = await cb.pedir(`/api/sitios/${beta.sitioId}/rejilla/`)
    expect(JSON.stringify(rb.datos)).toContain('7777')
  })
})

// ─── 3 · EL SOLAPE ──────────────────────────────────────────────────────────

describe('3 · una franja que se solapa no se guarda', () => {
  it('RECHAZA el solape por la red, y NOMBRA la franja con la que choca', async () => {
    await desbloquear(ca)
    const r = await ca.pedir('/api/rejilla/franjas/', {
      cuerpo: { nombre: 'Media mañana', horaInicio: '09:00', horaFin: '12:00' },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(String(r.datos.error)).toMatch(/solapa/i)
    expect(String(r.datos.error)).toMatch(/Prime rejalfa/)
  })

  it('una que se TOCA con la anterior SÍ entra: el fin es exclusivo', async () => {
    await desbloquear(ca)
    const r = await ca.pedir('/api/rejilla/franjas/', {
      cuerpo: { nombre: 'Tarde', horaInicio: '10:00', horaFin: '14:00', orden: 2 },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
  })

  it('el solape se mide contra el catálogo de la PROPIA organización', async () => {
    // beta puede crear su «Media mañana» aunque alfa tenga un «Prime» a esas
    // horas: si el solape se midiera sin contexto de tenant, esto fallaría — y
    // el síntoma sería «no puedo crear mi franja» sin ninguna explicación.
    await desbloquear(cb)
    const r = await cb.pedir('/api/rejilla/franjas/', {
      cuerpo: { nombre: 'Media mañana', horaInicio: '10:00', horaFin: '12:00', orden: 2 },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
  })
})

// ─── 4 · INVARIANTE 1 · VENDER SIN FRANJA SIGUE FUNCIONANDO ─────────────────

describe('4 · lo que no tiene franja se sigue vendiendo igual', () => {
  it('una propuesta SIN franja se crea, se lee y llega a APROBADA', async () => {
    const creada = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Propuesta de toda la vida',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(30),
        items: [{ sitioId: alfa.sitioId, unidad: 'mensual', tarifaUnitaria: 5000, cantidad: 1 }],
      },
    })
    expect(creada.status, JSON.stringify(creada.datos)).toBe(201)
    const id = creada.datos.id as string

    const fila = await poolTest().query(
      'select franja_id from propuesta_items where propuesta_id = $1',
      [id],
    )
    expect(fila.rows).toHaveLength(1)
    expect(fila.rows[0].franja_id).toBeNull()

    const aprob = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(aprob.status, JSON.stringify(aprob.datos)).toBe(200)

    const snap = await poolTest().query('select snapshot_economico from propuestas where id = $1', [id])
    const s = snap.rows[0].snapshot_economico
    expect(s).not.toBeNull()
    expect(s.porSitio[0].franja).toBeNull()
    expect(s.porSitio[0].temporada).toBeNull()
    // Sin franjas vendidas no hay nada que advertir: el aviso NO se pone, para
    // que cuando aparezca signifique algo.
    expect(s.avisoFranja).toBeUndefined()
  })

  it('una pantalla SIN rejilla se cotiza con su tarifa base', async () => {
    const r = await ca.pedir(`/api/sitios/${alfa.sitioId}/rejilla/`)
    expect(r.status).toBe(200)
    expect(r.datos.rejilla).toEqual([])
  })
})

// ─── 5 · INVARIANTE 2 · EL CONGELADO, QUE ES EL QUE DECIDE ──────────────────

describe('5 · una propuesta APROBADA no cambia cuando se mueve la tarifa', () => {
  it('congela la franja con su NOMBRE y su horario, y no los relee después', async () => {
    // 1) Se captura la rejilla: el prime de esta pantalla cuesta 1 800.
    await desbloquear(ca)
    const rej = await ca.pedir(`/api/sitios/${alfa.sitioId}/rejilla/`, {
      metodo: 'PATCH',
      cuerpo: {
        guardar: [
          { unidad: 'spot', franjaId: franjas.alfa, temporadaId: null, tarifaPublicada: 1800 },
        ],
      },
    })
    expect(rej.status, JSON.stringify(rej.datos)).toBe(200)

    // 2) Se vende el prime a ese precio y se aprueba.
    const creada = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Venta de prime',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(10),
        items: [
          {
            sitioId: alfa.sitioId,
            unidad: 'spot',
            tarifaUnitaria: 1800,
            cantidad: 1,
            franjaId: franjas.alfa,
          },
        ],
      },
    })
    expect(creada.status, JSON.stringify(creada.datos)).toBe(201)
    const id = creada.datos.id as string

    const aprob = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(aprob.status, JSON.stringify(aprob.datos)).toBe(200)

    const antes = (
      await poolTest().query('select snapshot_economico from propuestas where id = $1', [id])
    ).rows[0].snapshot_economico
    expect(antes.porSitio[0].franja).toMatchObject({
      id: franjas.alfa,
      nombre: 'Prime rejalfa',
      horaInicio: '06:00',
      horaFin: '10:00',
    })
    expect(antes.porSitio[0].tarifaUnitaria).toBe(1800)
    // El aviso viaja DENTRO del congelado: es lo que queda cuando las pantallas
    // hayan cambiado.
    expect(String(antes.avisoFranja)).toMatch(/CMS/)

    // 3) EL DUEÑO SUBE EL PRIME y encima RENOMBRA la franja.
    await desbloquear(ca)
    const subida = await ca.pedir(`/api/sitios/${alfa.sitioId}/rejilla/`, {
      metodo: 'PATCH',
      cuerpo: {
        guardar: [
          { unidad: 'spot', franjaId: franjas.alfa, temporadaId: null, tarifaPublicada: 2500 },
        ],
      },
    })
    expect(subida.status, JSON.stringify(subida.datos)).toBe(200)
    const renombre = await ca.pedir(`/api/rejilla/franjas/${franjas.alfa}/`, {
      metodo: 'PATCH',
      cuerpo: { nombre: 'Prime renombrado', horaInicio: '06:00', horaFin: '09:00', orden: 1 },
    })
    expect(renombre.status, JSON.stringify(renombre.datos)).toBe(200)

    // 4) LA PROPUESTA FIRMADA NO SE ENTERA. Ni el precio, ni el nombre, ni el
    //    horario: es lo que el cliente aceptó, y eso ya no se puede reescribir.
    const despues = (
      await poolTest().query('select snapshot_economico from propuestas where id = $1', [id])
    ).rows[0].snapshot_economico
    expect(despues).toEqual(antes)
    expect(despues.porSitio[0].tarifaUnitaria).toBe(1800)
    expect(despues.porSitio[0].franja.nombre).toBe('Prime rejalfa')
    expect(despues.porSitio[0].franja.horaFin).toBe('10:00')

    // 5) Y la rejilla de HOY sí cambió, que es lo que demuestra que el punto 4
    //    es congelado y no que el paso 3 no hiciera nada.
    const hoy = await ca.pedir(`/api/sitios/${alfa.sitioId}/rejilla/`)
    expect(hoy.datos.rejilla[0].tarifaPublicada).toBe(2500)
  })
})

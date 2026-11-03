import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  ADR 0049 · EL IDIOMA DE LOS DOCUMENTOS ES DE LA INSTANCIA — base y app.
//
//  Decision del dueno (03/11): «el idioma de papeles y contratos es fijo al
//  crearse la app en cada server». Aqui se prueba, POR LO QUE IMPIDE:
//
//    1. La BASE (`20261103_idioma_documentos_por_instancia.sql`): toda
//       instancia que ya existe queda en `es`; CHECK es/en/it; un trigger que
//       impide el UPDATE y otro que impide un segundo idioma.
//    2. La APP con una instancia INGLESA de verdad: el contrato se redacta,
//       se congela, se firma y se COTEJA en ingles, y la constancia sale en
//       ingles aunque la persona mire la aplicacion en espanol.
//
//  Para tener una instancia inglesa sin vaciar la base se hace lo que haria
//  una correccion de datos (`docs/datos/`): deshabilitar los triggers A
//  PROPOSITO, cambiar, y volver a encenderlos. Va ANTES de arrancar el
//  servidor: el proceso cachea el idioma (`idioma-instancia.ts`), igual que
//  una instancia real tras una correccion necesita reiniciar.
//
//  La eleccion por la puerta de un solo uso va en `bootstrap.e2e.test.ts`.
//  Que el contrato ESPANOL no cambio ni un byte lo prueban los hashes de
//  `contrato-documento-idioma.test.ts` y, de punta a punta, las FIRMAS de
//  `contrato-firmado-editable.e2e` y `moneda-instancia.e2e`, que corren en
//  instancias `es` con este mismo codigo.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>

const MIGRACION = join(process.cwd(), '..', '..', 'db', 'migrations', '20261103_idioma_documentos_por_instancia.sql')

async function idiomasDeLaBase(): Promise<string[]> {
  const r = await poolTest().query('select distinct idioma_documentos from tenants order by 1')
  return r.rows.map((x) => x.idioma_documentos)
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
  alfa = await sembrarTenant('idiomaalfa')
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('una instancia que YA existe se queda en espanol', () => {
  it('toda organizacion queda en es tras la migracion (g500 y DEMO no cambian)', async () => {
    // `recrearEsquema()` aplica las migraciones sobre una base que ya tiene
    // organizacion (`semilla-desarrollo.sql`), que es el caso del droplet.
    expect(await idiomasDeLaBase()).toEqual(['es'])
  })

  it('la migracion es idempotente: aplicarla otra vez no rompe ni cambia nada', async () => {
    await poolTest().query(readFileSync(MIGRACION, 'utf8'))
    expect(await idiomasDeLaBase()).toEqual(['es'])
    const trig = await poolTest().query(
      `select count(*)::int n from pg_trigger where tgname in
        ('trg_tenants_idioma_documentos_inmutable','trg_tenants_idioma_documentos_unico')`,
    )
    expect(trig.rows[0].n).toBe(2)
  })
})

describe('CAPA 1 · la base no deja cambiarlo', () => {
  it('NEGATIVO · UPDATE de tenants.idioma_documentos falla, incluso con el superusuario', async () => {
    const error = await falla(() =>
      poolTest().query("update tenants set idioma_documentos = 'en' where id = $1", [alfa.id]),
    )
    expect(error).toMatch(/idioma de los documentos de la instancia no se puede cambiar/)
    expect(await idiomasDeLaBase()).toEqual(['es'])
  })

  it('reescribir el MISMO valor si pasa (los upserts de las semillas lo hacen)', async () => {
    await poolTest().query("update tenants set idioma_documentos = 'es', nombre = nombre where id = $1", [alfa.id])
    expect(await idiomasDeLaBase()).toEqual(['es'])
  })

  it('NEGATIVO · una organizacion nueva en OTRO idioma no nace (uno por instancia)', async () => {
    const error = await falla(() =>
      poolTest().query("insert into tenants (nombre, slug, idioma_documentos) values ('Ingles', 'ingles-e2e', 'en')"),
    )
    expect(error).toMatch(/se redactan en es/)
    const r = await poolTest().query("select count(*)::int n from tenants where slug = 'ingles-e2e'")
    expect(r.rows[0].n).toBe(0)
  })

  it('NEGATIVO · un idioma que no es es/en/it no entra, ni siquiera sin la regla de unicidad', async () => {
    const c = await poolTest().connect()
    try {
      await c.query('begin')
      await c.query('alter table tenants disable trigger trg_tenants_idioma_documentos_unico')
      const error = await falla(() =>
        c.query("insert into tenants (nombre, slug, idioma_documentos) values ('Frances', 'fr-e2e', 'fr')"),
      )
      expect(error).toMatch(/tenants_idioma_documentos_ck/)
    } finally {
      await c.query('rollback')
      c.release()
    }
    const trig = await poolTest().query(
      "select tgenabled from pg_trigger where tgname = 'trg_tenants_idioma_documentos_unico'",
    )
    expect(trig.rows[0].tgenabled).toBe('O') // sigue encendido
  })

  it('una organizacion nueva sin decir nada nace en es (el DEFAULT)', async () => {
    await poolTest().query("insert into tenants (nombre, slug) values ('Beta', 'idioma-beta-e2e')")
    const r = await poolTest().query("select idioma_documentos from tenants where slug = 'idioma-beta-e2e'")
    expect(r.rows[0].idioma_documentos).toBe('es')
  })
})

// ─── Una instancia INGLESA de punta a punta ─────────────────────────────────
describe('una instancia con documentos en INGLES: redacta, congela, firma y coteja en ingles', () => {
  let ca: Cliente
  let contratoId: string

  beforeAll(async () => {
    const p = poolTest()
    // La «correccion de datos»: triggers fuera A PROPOSITO, en una transaccion.
    const c = await p.connect()
    try {
      await c.query('begin')
      await c.query('alter table tenants disable trigger trg_tenants_idioma_documentos_inmutable')
      await c.query("update tenants set idioma_documentos = 'en'")
      await c.query('alter table tenants enable trigger trg_tenants_idioma_documentos_inmutable')
      await c.query('commit')
    } finally {
      c.release()
    }
    expect(await idiomasDeLaBase()).toEqual(['en'])

    contratoId = (await p.query('select id from contratos_arrendamiento where sitio_id = $1', [alfa.sitioId])).rows[0].id
    // Lo que el documento exige para poder enviarse (como en `moneda-instancia.e2e`).
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
    await p.query(`update contratos_arrendamiento set monto_renta = 21000 where id = $1`, [contratoId])

    await arrancarServidor()
    ca = new Cliente()
    await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
    const d = await ca.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
    expect(d.status, JSON.stringify(d.datos)).toBe(200)
  }, 180_000)

  it('el documento imprimible sale en ingles, y la barra (interfaz) sigue en el idioma de la persona', async () => {
    const r = await ca.pedir(`/contrato/${contratoId}/`)
    expect(r.status).toBe(200)
    const html = String(r.datos)
    expect(html).toContain('ADVERTISING SPACE LEASE AGREEMENT')
    expect(html).toContain('RECITALS')
    expect(html).toContain('TWENTY-ONE THOUSAND PESOS 00/100 MXN')
    expect(html).not.toContain('DECLARACIONES')
    expect(html).not.toContain('CONTRATO DE ARRENDAMIENTO')
    // La interfaz es de la persona: aqui, espanol (el ingles de la interfaz va
    // apagado en las e2e). Lo que NO se imprime no sigue al documento.
    expect(html).toContain('Imprimir o guardar como PDF')
  })

  it('se congela en ingles, se firma, y el cotejo da las firmas por buenas', async () => {
    const estado = await ca.pedir(`/api/contratos/${contratoId}/firma/`)
    const e = await ca.pedir(`/api/contratos/${contratoId}/firma/`, {
      cuerpo: { accion: 'enviar', huellaRevisada: estado.datos.huellaDatos },
    })
    expect(e.status, JSON.stringify(e.datos)).toBe(200)
    const f = await ca.pedir(`/api/contratos/${contratoId}/firma/`, { cuerpo: { accion: 'firmar' } })
    expect(f.status, JSON.stringify(f.datos)).toBe(200)

    const c = (await poolTest().query('select documento_congelado from contratos_arrendamiento where id = $1', [contratoId]))
      .rows[0]
    expect(c.documento_congelado.startsWith('ADVERTISING SPACE LEASE AGREEMENT\n')).toBe(true)
    expect(c.documento_congelado).not.toMatch(/ARRENDADOR|CLÁUSULAS/)

    const r = await ca.pedir(`/api/contratos/${contratoId}/firma/`)
    expect(r.datos.hashActual).toBe(r.datos.hashCongelado)
    const firmadas = r.datos.firmas.filter((x: any) => x.estatus === 'FIRMADA')
    expect(firmadas.length).toBeGreaterThan(0)
    expect(firmadas.every((x: any) => x.invalidada === false)).toBe(true)
  })

  it('la constancia de firmas sale en INGLES (idioma de la instancia), no en el de la persona', async () => {
    const html = String((await ca.pedir(`/contrato/${contratoId}/`)).datos)
    expect(html).toContain('Electronic signature certificate')
    expect(html).toContain('ELECTRONICALLY SIGNED')
    expect(html).not.toContain('Constancia de firma electrónica')
  })

  it('NEGATIVO · si un dato cambia, la firma SI aparece alterada', async () => {
    await poolTest().query('update contratos_arrendamiento set monto_renta = 22000 where id = $1', [contratoId])
    const r = await ca.pedir(`/api/contratos/${contratoId}/firma/`)
    expect(r.datos.hashActual).not.toBe(r.datos.hashCongelado)
    expect(r.datos.firmas.some((x: any) => x.estatus === 'FIRMADA' && x.invalidada)).toBe(true)
  })

  describe('/api/tenants: una organizacion nueva hereda el idioma de documentos', () => {
    const EMAIL_PLATAFORMA = 'duena-plataforma@idioma.test'
    let plataforma: Cliente

    beforeAll(async () => {
      // `puedeCambiarCrm()` exige el Dueno del tenant MAS ANTIGUO (patron de
      // `moneda-instancia.e2e`).
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

    it('NEGATIVO · pedir es en una instancia en es un 400 y no nace nada', async () => {
      const r = await alta('espanol-api', { idiomaDocumentos: 'es' })
      expect(r.status, JSON.stringify(r.datos)).toBe(400)
      expect(r.datos.error).toBe(
        'El idioma de los documentos de la instancia ya está fijado: una organización nueva nace en el mismo que las demás',
      )
      const n = await poolTest().query("select count(*)::int n from tenants where slug = 'espanol-api'")
      expect(n.rows[0].n).toBe(0)
    })

    it('NEGATIVO · y fr, que ni existe, tambien 400', async () => {
      const r = await alta('frances-api', { idiomaDocumentos: 'fr' })
      expect(r.status).toBe(400)
      expect(r.datos.error).toBe('El idioma de los documentos debe ser es, en o it')
    })

    it('sin idioma nace, y hereda el de la instancia (en, no el DEFAULT es)', async () => {
      const r = await alta('hereda-idioma-api')
      expect(r.status, JSON.stringify(r.datos)).toBe(201)
      const m = await poolTest().query("select idioma_documentos from tenants where slug = 'hereda-idioma-api'")
      expect(m.rows[0].idioma_documentos).toBe('en')
    })
  })
})

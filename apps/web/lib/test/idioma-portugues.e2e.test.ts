import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  P3 DEL PORTUGUES (05/11) · la base y la app saben `pt`.
//
//  Tarea ROJA aprobada por el dueno el 05/11 («Si, igual que italiano»). Se
//  prueba contra Postgres y un Next de verdad:
//
//    1. La MIGRACION `20261105_idioma_portugues.sql`: abre los dos CHECK a
//       `pt`, es idempotente, y sigue rechazando lo demas (`fr`, `pt-BR`). Los
//       triggers del ADR 0049 siguen en pie.
//    2. La CUENTA: con `IDIOMA_PORTUGUES` apagado, `PUT {idioma:'pt'}` es 400 y
//       no guarda nada; encendido, se guarda y la siguiente pagina sale en
//       portugues (H1 de la validacion de la ola 0, cerrado).
//    3. Una instancia con documentos en PORTUGUES: el contrato se redacta, se
//       congela, se firma y se COTEJA en portugues; la constancia y la
//       propuesta imprimible tambien, aunque la interfaz siga apagada.
//
//  Que el contrato es/en/it no cambio ni un byte lo fijan los hashes de
//  `contrato-documento-portugues.test.ts`; de punta a punta, las firmas de
//  `idioma-instancia.e2e` (ingles) y `contrato-firmado-editable.e2e` (espanol).
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
const portuguesAntes = process.env.IDIOMA_PORTUGUES

const MIGRACION = join(process.cwd(), '..', '..', 'db', 'migrations', '20261105_idioma_portugues.sql')

async function falla(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (e) {
    return (e as Error).message
  }
}

async function preferida(email: string): Promise<string | null> {
  return (await poolTest().query('select idioma_preferido from usuarios where email = $1', [email])).rows[0].idioma_preferido
}

async function lang(c: Cliente, ruta = '/inicio/'): Promise<string> {
  const r = await c.pedir(ruta)
  expect(r.status).toBe(200)
  const m = /<html[^>]*\slang="([a-z-]+)"/i.exec(String(r.datos))
  expect(m, 'la pagina no trae <html lang>').not.toBeNull()
  return m![1]
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('portuguesalfa')
  delete process.env.IDIOMA_PORTUGUES
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
  if (portuguesAntes === undefined) delete process.env.IDIOMA_PORTUGUES
  else process.env.IDIOMA_PORTUGUES = portuguesAntes
})

describe('1 · la migracion abre los dos CHECK a pt, y nada mas', () => {
  it('es idempotente: aplicarla dos veces mas deja lo mismo', async () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    await poolTest().query(sql)
    await poolTest().query(sql)
    const r = await poolTest().query(
      `select conname, pg_get_constraintdef(oid) d from pg_constraint
        where conname in ('usuarios_idioma_preferido_valido', 'tenants_idioma_documentos_ck') order by 1`,
    )
    expect(r.rows.map((x) => x.conname)).toEqual(['tenants_idioma_documentos_ck', 'usuarios_idioma_preferido_valido'])
    for (const x of r.rows) expect(x.d, x.conname).toMatch(/'pt'/)
    const trig = await poolTest().query(
      `select count(*)::int n from pg_trigger where tgname in
        ('trg_tenants_idioma_documentos_inmutable','trg_tenants_idioma_documentos_unico')`,
    )
    expect(trig.rows[0].n).toBe(2)
  })

  it('las instancias que ya existen siguen en es (ninguna fila cambia)', async () => {
    const r = await poolTest().query('select distinct idioma_documentos from tenants')
    expect(r.rows.map((x) => x.idioma_documentos)).toEqual(['es'])
    const u = await poolTest().query('select count(*)::int n from usuarios where idioma_preferido is not null')
    expect(u.rows[0].n).toBe(0)
  })

  it('una cuenta puede guardar pt en la base; NEGATIVO · fr y pt-BR no', async () => {
    await poolTest().query(`update usuarios set idioma_preferido = 'pt' where email = $1`, [alfa.usuarioEmail])
    expect(await preferida(alfa.usuarioEmail)).toBe('pt')
    for (const malo of ['fr', 'pt-BR', 'PT']) {
      const e = await falla(() =>
        poolTest().query(`update usuarios set idioma_preferido = $2 where email = $1`, [alfa.usuarioEmail, malo]),
      )
      expect(e, malo).toMatch(/usuarios_idioma_preferido_valido/)
    }
    await poolTest().query(`update usuarios set idioma_preferido = null where email = $1`, [alfa.usuarioEmail])
  })

  it('una organizacion puede nacer en pt (sin la regla de unicidad); NEGATIVO · fr y pt-BR no', async () => {
    const c = await poolTest().connect()
    try {
      await c.query('begin')
      await c.query('alter table tenants disable trigger trg_tenants_idioma_documentos_unico')
      await c.query("insert into tenants (nombre, slug, idioma_documentos) values ('Brasil', 'pt-e2e', 'pt')")
      for (const malo of ['fr', 'pt-BR']) {
        await c.query('savepoint s')
        const e = await falla(() =>
          c.query("insert into tenants (nombre, slug, idioma_documentos) values ('X', $1, $2)", [`x-${malo}-e2e`, malo]),
        )
        expect(e, malo).toMatch(/tenants_idioma_documentos_ck/)
        await c.query('rollback to savepoint s')
      }
    } finally {
      await c.query('rollback')
      c.release()
    }
  })

  it('NEGATIVO · los triggers del ADR 0049 siguen: una organizacion en pt no nace en una instancia es', async () => {
    const e = await falla(() =>
      poolTest().query("insert into tenants (nombre, slug, idioma_documentos) values ('Brasil', 'pt2-e2e', 'pt')"),
    )
    expect(e).toMatch(/se redactan en es/)
  })
})

describe('2 · la preferencia de la cuenta (H1)', () => {
  it('NEGATIVO · con el portugues APAGADO, PUT pt es 400 y no se guarda; la pagina sigue en es', async () => {
    delete process.env.IDIOMA_PORTUGUES
    await arrancarServidor()
    const c = new Cliente()
    await c.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/perfil/idioma/', { metodo: 'PUT', cuerpo: { idioma: 'pt' } })
    expect(r.status).toBe(400)
    expect(await preferida(alfa.usuarioEmail)).toBeNull()
    expect((await c.pedir('/api/perfil/idioma/')).datos.disponibles).not.toContain('pt')
    // Ni con el navegador en portugues: apagado es apagado.
    expect(await lang(c)).toBe('es')
    await pararServidor()
  }, 120_000)

  it('con el portugues ENCENDIDO, se guarda pt y la siguiente pagina sale en portugues', async () => {
    process.env.IDIOMA_PORTUGUES = '1'
    try {
      await arrancarServidor()
      const c = new Cliente()
      await c.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
      expect((await c.pedir('/api/perfil/idioma/')).datos.disponibles).toContain('pt')
      const r = await c.pedir('/api/perfil/idioma/', { metodo: 'PUT', cuerpo: { idioma: 'pt' } })
      expect(r.status, JSON.stringify(r.datos)).toBe(200)
      expect(r.datos.preferido).toBe('pt')
      expect(await preferida(alfa.usuarioEmail)).toBe('pt')
      expect(await lang(c)).toMatch(/^pt/)
      // NEGATIVO · la etiqueta o las mayusculas no se adivinan.
      for (const malo of ['pt-BR', 'PT']) {
        const m = await c.pedir('/api/perfil/idioma/', { metodo: 'PUT', cuerpo: { idioma: malo } })
        expect(m.status, malo).toBe(400)
      }
      expect(await preferida(alfa.usuarioEmail)).toBe('pt')
    } finally {
      await poolTest().query(`update usuarios set idioma_preferido = null where email = $1`, [alfa.usuarioEmail])
      await pararServidor()
      delete process.env.IDIOMA_PORTUGUES
    }
  }, 120_000)
})

describe('3 · una instancia con documentos en PORTUGUES (interfaz apagada)', () => {
  let ca: Cliente
  let contratoId: string

  beforeAll(async () => {
    const p = poolTest()
    // La «correccion de datos» (`docs/datos/`): el trigger fuera A PROPOSITO.
    const c = await p.connect()
    try {
      await c.query('begin')
      await c.query('alter table tenants disable trigger trg_tenants_idioma_documentos_inmutable')
      await c.query("update tenants set idioma_documentos = 'pt'")
      await c.query('alter table tenants enable trigger trg_tenants_idioma_documentos_inmutable')
      await c.query('commit')
    } finally {
      c.release()
    }
    contratoId = (await p.query('select id from contratos_arrendamiento where sitio_id = $1', [alfa.sitioId])).rows[0].id
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
    await p.query(`update contratos_arrendamiento set monto_renta = 1234.5 where id = $1`, [contratoId])

    await arrancarServidor()
    ca = new Cliente()
    await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
    const d = await ca.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
    expect(d.status, JSON.stringify(d.datos)).toBe(200)
  }, 180_000)

  it('el documento imprimible sale en portugues; la barra, en el idioma de la persona', async () => {
    const r = await ca.pedir(`/contrato/${contratoId}/`)
    expect(r.status).toBe(200)
    const html = String(r.datos)
    expect(html).toContain('CONTRATO DE LOCAÇÃO DE ESPAÇO PUBLICITÁRIO')
    expect(html).toContain('DECLARAÇÕES')
    expect(html).toContain('MIL DUZENTOS E TRINTA E QUATRO PESOS 50/100 MXN')
    expect(html).not.toContain('DECLARACIONES')
    expect(html).not.toContain('CONTRATO DE ARRENDAMIENTO')
    expect(html).toContain('Imprimir o guardar como PDF')
  })

  it('se congela en portugues, se firma, y el cotejo da las firmas por buenas', async () => {
    const estado = await ca.pedir(`/api/contratos/${contratoId}/firma/`)
    const e = await ca.pedir(`/api/contratos/${contratoId}/firma/`, {
      cuerpo: { accion: 'enviar', huellaRevisada: estado.datos.huellaDatos },
    })
    expect(e.status, JSON.stringify(e.datos)).toBe(200)
    const f = await ca.pedir(`/api/contratos/${contratoId}/firma/`, { cuerpo: { accion: 'firmar' } })
    expect(f.status, JSON.stringify(f.datos)).toBe(200)

    const c = (await poolTest().query('select documento_congelado from contratos_arrendamiento where id = $1', [contratoId]))
      .rows[0]
    expect(c.documento_congelado.startsWith('CONTRATO DE LOCAÇÃO DE ESPAÇO PUBLICITÁRIO\n')).toBe(true)
    expect(c.documento_congelado).not.toMatch(/ARRENDADOR|DECLARACIONES/)

    const r = await ca.pedir(`/api/contratos/${contratoId}/firma/`)
    expect(r.datos.hashActual).toBe(r.datos.hashCongelado)
    const firmadas = r.datos.firmas.filter((x: any) => x.estatus === 'FIRMADA')
    expect(firmadas.length).toBeGreaterThan(0)
    expect(firmadas.every((x: any) => x.invalidada === false)).toBe(true)
  })

  it('la constancia de firmas sale en portugues', async () => {
    const html = String((await ca.pedir(`/contrato/${contratoId}/`)).datos)
    expect(html).toContain('Comprovante de assinatura eletrônica')
    expect(html).toContain('ASSINADO ELETRONICAMENTE')
    expect(html).not.toContain('Constancia de firma electrónica')
  })

  it('la propuesta imprimible tambien sale en portugues; su barra, en el idioma de la persona', async () => {
    const p = await poolTest().query(
      `insert into propuestas (folio, nombre, tenant_id, token_publico)
       values ('P-PT-E2E', 'Proposta', $1, 'token-propuesta-pt-e2e-p3') returning id`,
      [alfa.id],
    )
    try {
      const r = await ca.pedir(`/propuesta/${p.rows[0].id}/`)
      expect(r.status).toBe(200)
      const html = String(r.datos)
      expect(html).toContain('PROPOSTA COMERCIAL')
      expect(html).toContain('ACEITE DO CLIENTE')
      expect(html).not.toContain('PROPUESTA COMERCIAL')
      expect(html).toContain('Volver a la propuesta')
    } finally {
      await poolTest().query('delete from propuestas where id = $1', [p.rows[0].id])
    }
  })

  it('NEGATIVO · si un dato cambia, la firma SI aparece alterada', async () => {
    await poolTest().query('update contratos_arrendamiento set monto_renta = 2000 where id = $1', [contratoId])
    const r = await ca.pedir(`/api/contratos/${contratoId}/firma/`)
    expect(r.datos.hashActual).not.toBe(r.datos.hashCongelado)
    expect(r.datos.firmas.some((x: any) => x.estatus === 'FIRMADA' && x.invalidada)).toBe(true)
  })

  it('NEGATIVO · el idioma de la instancia sigue sin poder cambiarse', async () => {
    const e = await falla(() => poolTest().query("update tenants set idioma_documentos = 'es' where id = $1", [alfa.id]))
    expect(e).toMatch(/no se puede cambiar/)
  })
})

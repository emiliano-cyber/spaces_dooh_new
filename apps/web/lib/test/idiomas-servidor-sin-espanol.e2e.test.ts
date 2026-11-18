import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  IDIOMAS-SIN-ES (18/11) · «Idiomas del servidor» ya no obliga al espanol.
//
//  Tarea ROJA (R3) aprobada por el dueno el 18/11. Contra Postgres y un Next
//  de verdad:
//
//    1. La MIGRACION `20261118_idiomas_servidor_sin_espanol_obligatorio.sql`:
//       idempotente, acepta `['en','pt']` y sigue rechazando la lista vacia y
//       un idioma que no existe.
//    2. La APLICACION: el Dueno guarda `['en','pt']`, la pantalla de entrar
//       sale en ingles (el primero de los elegidos) y solo ofrece esos dos; una
//       lista vacia es 400 y no cambia nada.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>

const MIGRACION = join(
  process.cwd(), '..', '..', 'db', 'migrations', '20261118_idiomas_servidor_sin_espanol_obligatorio.sql',
)

async function falla(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (e) {
    return (e as Error).message
  }
}

async function guardados(): Promise<string[] | null> {
  return (await poolTest().query('select idiomas from apariencia_instancia where id = true')).rows[0].idiomas
}

function langDe(html: string): string {
  const m = /<html[^>]*\slang="([a-z-]+)"/i.exec(html)
  expect(m, 'la pagina no trae <html lang>').not.toBeNull()
  return m![1]
}

function opcionesDelSelector(html: string): string[] {
  return [...html.matchAll(/<option value="(\w+)"/g)].map((m) => m[1])
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('sinespanol')
}, 180_000)

afterAll(async () => {
  await poolTest().query('update apariencia_instancia set idiomas = null where id = true').catch(() => {})
  await pararServidor()
  await cerrarPool()
})

describe('1 · la migracion: al menos un idioma, sin exigir el espanol', () => {
  it('es idempotente y el CHECK ya no menciona el espanol obligatorio', async () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    await poolTest().query(sql)
    await poolTest().query(sql)
    const r = await poolTest().query(
      `select pg_get_constraintdef(oid) d from pg_constraint where conname = 'apariencia_instancia_idiomas_ck'`,
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].d).not.toMatch(/'es'::text = ANY/)
    expect(r.rows[0].d).toMatch(/cardinality/)
  })

  it('acepta una lista SIN espanol, y null', async () => {
    await poolTest().query(`update apariencia_instancia set idiomas = array['en','pt'] where id = true`)
    expect(await guardados()).toEqual(['en', 'pt'])
    await poolTest().query(`update apariencia_instancia set idiomas = null where id = true`)
    expect(await guardados()).toBeNull()
  })

  it('NEGATIVO · rechaza la lista vacia y un idioma que no existe', async () => {
    for (const malo of [[], ['en', 'fr']]) {
      const e = await falla(() =>
        poolTest().query('update apariencia_instancia set idiomas = $1::text[] where id = true', [malo]),
      )
      expect(e, JSON.stringify(malo)).toMatch(/apariencia_instancia_idiomas_ck/)
    }
    expect(await guardados()).toBeNull()
  })
})

describe('2 · la aplicacion con solo ingles y portugues', () => {
  it('el Dueno guarda [en, pt]; la pantalla de entrar sale en ingles y solo ofrece esos dos', async () => {
    await arrancarServidor()
    const dueno = new Cliente()
    await dueno.entrar(alfa.usuarioEmail, PASSWORD_DEMO)

    const r = await dueno.pedir('/api/idiomas-servidor/', { metodo: 'PUT', cuerpo: { idiomas: ['pt', 'en'] } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos).toEqual({ idiomas: ['en', 'pt'], activos: ['en', 'pt'] })
    expect(await guardados()).toEqual(['en', 'pt'])

    // Alguien sin sesion ni cookie: el primero de los elegidos, NO el espanol.
    const anonimo = new Cliente()
    const login = await anonimo.pedir('/login/')
    expect(login.status).toBe(200)
    const html = String(login.datos)
    expect(langDe(html)).toBe('en')
    expect(opcionesDelSelector(html)).toEqual(['en', 'pt'])

    // Y lo que «Mi cuenta» deja elegir.
    expect((await dueno.pedir('/api/perfil/idioma/')).datos.disponibles).toEqual(['en', 'pt'])
    // NEGATIVO · el espanol apagado no se puede guardar como preferencia.
    expect((await dueno.pedir('/api/perfil/idioma/', { metodo: 'PUT', cuerpo: { idioma: 'es' } })).status).toBe(400)
  }, 120_000)

  it('NEGATIVO · una lista vacia es 400 y no cambia lo guardado', async () => {
    const dueno = new Cliente()
    await dueno.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
    const r = await dueno.pedir('/api/idiomas-servidor/', { metodo: 'PUT', cuerpo: { idiomas: [] } })
    expect(r.status).toBe(400)
    expect(await guardados()).toEqual(['en', 'pt'])
  }, 60_000)

  it('volver a «servidor» (null) devuelve el espanol de siempre', async () => {
    const dueno = new Cliente()
    await dueno.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
    const r = await dueno.pedir('/api/idiomas-servidor/', { metodo: 'PUT', cuerpo: { idiomas: null } })
    expect(r.status).toBe(200)
    expect(r.datos.idiomas).toBeNull()
    expect(langDe(String((await new Cliente().pedir('/login/')).datos))).toBe('es')
    await pararServidor()
  }, 60_000)
})

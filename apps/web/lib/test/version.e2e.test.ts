import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { asegurarPermisos } from './semillas-e2e'
import { arrancarServidor, pararServidor, BASE } from './servidor-e2e'

// ============================================================================
//  F6.1 — cada instancia dice qué versión corre, y NADA MÁS.
//
//  El panel de flota necesita saber qué versión lleva cada owner. La instancia
//  de un owner no le debe al panel ni un dato de su negocio: ni cuántas
//  organizaciones tiene, ni cuántos usuarios, ni cómo se llaman.
//
//  ─── Por qué la versión va tras token ─────────────────────────────────────
//  Publicar la versión exacta le ahorra el trabajo a quien busca una
//  vulnerabilidad conocida de esa versión. El plan lo dice y deja la puerta
//  abierta a hacerla pública (P6); mientras no se decida, va cerrada.
//
//  ─── Y por qué el cuerpo SIN token también toca la base ───────────────────
//  Esta ruta pasa a ser el `SALUD_URL` del actualizador. La anterior era
//  `/api/auth/metodos/`, que solo lee variables de entorno: contesta 200
//  aunque Postgres esté muerto.
//
//  Eso no es hipotético. El PADRE estuvo CUATRO DÍAS sirviendo un login
//  perfecto sin poder autenticar a nadie porque le faltaba `DATABASE_URL`, y
//  las cinco comprobaciones que se hacían salían verdes. Si el actualizador
//  usara una salud que no toca la base, aprobaría un despliegue roto y
//  seguiría adelante.
//
//  Por eso `ok` significa «la base me contesta», y no «el proceso arrancó».
//  No revela nada: arriba o abajo es lo que cualquiera ve de todos modos.
// ============================================================================

const TOKEN = 'token-de-flota-para-pruebas-f61'

let contadorIp = 60
async function pedirVersion(opts: { token?: string } = {}) {
  const cabeceras: Record<string, string> = { 'x-forwarded-for': `10.9.2.${contadorIp++}` }
  if (opts.token !== undefined) cabeceras['x-flota-token'] = opts.token
  const r = await fetch(`${BASE}/api/version/`, { headers: cabeceras, redirect: 'manual' })
  const datos = await r.json().catch(() => ({}))
  return { status: r.status, datos, cacheControl: r.headers.get('cache-control') }
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  process.env.FLOTA_TOKEN = TOKEN
  process.env.SPACE_OS_VERSION = 'v9.9.9-prueba'
  process.env.CANAL = 'estable'
  await arrancarServidor()
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('F6.1 · sin token, la instancia solo dice que esta viva', () => {
  it('devuelve 200 y EXACTAMENTE la clave `ok`, nada mas', async () => {
    const r = await pedirVersion()

    expect(r.status).toBe(200)
    // Se afirman las claves EXACTAS y no solo la ausencia de `version`. Una
    // clave nueva que alguien añada mañana —`hostname`, `tenants`, lo que sea—
    // tiene que romper esta prueba, no colarse.
    expect(Object.keys(r.datos).sort()).toEqual(['ok'])
    expect(r.datos.ok).toBe(true)
  })

  it('no se cachea: una salud cacheada es una salud que miente', async () => {
    expect((await pedirVersion()).cacheControl).toContain('no-store')
  })
})

describe('F6.1 · con token, el panel obtiene lo suyo', () => {
  it('devuelve el contrato completo y NI UN dato de negocio', async () => {
    const r = await pedirVersion({ token: TOKEN })

    expect(r.status).toBe(200)
    expect(Object.keys(r.datos).sort()).toEqual([
      'base',
      'canal',
      'ok',
      'ultimaMigracion',
      'uptime',
      'version',
    ])
    expect(r.datos.version).toBe('v9.9.9-prueba')
    expect(r.datos.base).toBe('ok')
    expect(r.datos.canal).toBe('estable')
    expect(typeof r.datos.uptime).toBe('number')

    // `ultimaMigracion` es el nombre del archivo, no su contenido.
    expect(r.datos.ultimaMigracion).toMatch(/^\d{8}_.+\.sql$/)
  })

  it('el cuerpo no menciona ninguna organizacion de la base', async () => {
    // El caso que de verdad importa: la base de pruebas TIENE organizaciones
    // sembradas. Si alguna se colara en la respuesta, aquí se ve.
    const slugs = await poolTest().query('select slug, nombre from tenants')
    expect(slugs.rows.length).toBeGreaterThan(0)

    const cuerpo = JSON.stringify((await pedirVersion({ token: TOKEN })).datos)
    for (const t of slugs.rows) {
      expect(cuerpo).not.toContain(t.slug)
      expect(cuerpo).not.toContain(t.nombre)
    }
  })
})

describe('F6.1 · con token equivocado no se filtra la version', () => {
  it('devuelve el cuerpo reducido, igual que un desconocido', async () => {
    const r = await pedirVersion({ token: 'token-que-no-es' })

    expect(r.status).toBe(200)
    expect(Object.keys(r.datos).sort()).toEqual(['ok'])
    expect(JSON.stringify(r.datos)).not.toContain('v9.9.9-prueba')
  })

  it('tampoco con el token vacio', async () => {
    const r = await pedirVersion({ token: '' })
    expect(Object.keys(r.datos).sort()).toEqual(['ok'])
  })
})

describe('F6.1 · `ok` significa que la BASE contesta, no que el proceso arranco', () => {
  it('con la base inalcanzable NO dice ok:true', async () => {
    // Se le quita la tabla de debajo y se devuelve en el `finally`. Es la
    // única forma de simular una base caída sin tirar Postgres entero.
    await poolTest().query('alter table schema_migrations rename to schema_migrations_apartada')
    try {
      const r = await pedirVersion()

      // Lo que NO puede pasar: contestar 200 con ok:true. Da igual si el
      // camino elegido es un 503 o un `ok:false`; lo que se prohíbe es el
      // verde falso que costó cuatro días.
      expect(r.datos.ok).not.toBe(true)
      expect(r.status).toBe(503)
    } finally {
      await poolTest().query('alter table schema_migrations_apartada rename to schema_migrations')
    }
  })
})

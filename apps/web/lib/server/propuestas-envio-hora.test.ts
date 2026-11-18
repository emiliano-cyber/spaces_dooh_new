import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'

// ============================================================================
//  B89 (05/11) · LA FECHA DEL CORREO DE «ENVIAR» SE CUENTA CON EL DIA DEL NEGOCIO.
// ----------------------------------------------------------------------------
//  `enviarPropuestaCtrl` lee el reloj en dos sitios: para saber si la
//  vigencia que ya tenia la propuesta sigue en pie (`vencida`, en la consulta)
//  y para calcular la fecha nueva que promete el correo. Los dos tienen que
//  ser `hoyDeVigencia()`, el mismo dia que usa `cambiarEstatusPropuesta` al
//  guardar. El supervisor midio que leer el dia con `toISOString()` (el dia
//  UTC) en cualquiera de los dos sobrevivia a todas las unitarias.
//
//  Reloj fijo a las 19:00 de Mexico del 04/11, que en UTC ya es el 05/11. La
//  base simulada contesta `vencida` comparando con el dia que la consulta le
//  pase: si le llega el dia UTC, se equivoca igual que se equivocaria la real.
// ============================================================================

const A_LAS_19_DE_MEXICO = new Date('2026-11-05T01:00:00Z')

const h = vi.hoisted(() => ({
  enviar: vi.fn(async (_o: any) => {}),
  cambiar: vi.fn(async (_id: string, _e: string) => ({ id: 'P1', nombre: 'Prop', estatus: 'ENVIADA' })),
  vigenteHasta: null as string | null,
  consultas: [] as { sql: string; params: unknown[] }[],
}))

vi.mock('./db', () => ({
  q1: vi.fn(async (sql: string, params: unknown[] = []) => {
    h.consultas.push({ sql, params })
    if (!sql.includes('from propuestas')) return { nombre: 'Medios Sol', email_remitente: 'ventas@sol.mx', logo_token: null }
    const m = sql.match(/vigente_hasta\s*<\s*\$(\d+)::date/)
    const hoy = m ? String(params[Number(m[1]) - 1]) : 'SIN-DIA'
    return {
      estatus: 'ENVIADA',
      nombre: 'Verano',
      folio: 'PR-2026-0001',
      token_publico: 'tok123',
      vigente_hasta: h.vigenteHasta,
      vencida: h.vigenteHasta == null ? null : h.vigenteHasta < hoy,
    }
  }),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))
vi.mock('./config-repo', () => ({ vigenciaPropuestaDelTenant: vi.fn(async () => 30) }))
vi.mock('./propuestas-repo', () => ({
  cambiarEstatusPropuesta: (id: string, e: string) => h.cambiar(id, e),
  PropuestaError: class PropuestaError extends Error {},
}))
vi.mock('./idioma-instancia', () => ({ idiomaDeLaInstancia: async () => 'es' }))
vi.mock('./email', async () => {
  const real = await vi.importActual<typeof import('./email')>('./email')
  return {
    ...real,
    emailHabilitado: () => true,
    enviarEmail: (o: any) => h.enviar(o),
    remitenteDeOrganizacion: (n: string) => `${n} <no-reply@plataforma.test>`,
  }
})

import { enviarPropuestaCtrl } from './propuestas-envio'
import { formatFecha } from '@/lib/data/derive'
import { hoyDeVigencia } from '@/lib/propuesta-vigencia'

const CTX = { baseUrl: 'https://app.test/', remitente: { nombre: 'Ana', email: 'ana@sol.mx' } }

let tzAntes: string | undefined
beforeAll(() => {
  tzAntes = process.env.TZ
  process.env.TZ = 'America/Mexico_City'
})
afterAll(() => {
  if (tzAntes === undefined) delete process.env.TZ
  else process.env.TZ = tzAntes
})
beforeEach(() => {
  h.enviar.mockClear()
  h.consultas.length = 0
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(A_LAS_19_DE_MEXICO)
})
afterEach(() => {
  vi.useRealTimers()
})

async function correoDe(vigente: string | null): Promise<string> {
  h.vigenteHasta = vigente
  await enviarPropuestaCtrl('P1', { para: 'cliente@ejemplo.mx' }, CTX)
  expect(h.enviar).toHaveBeenCalledTimes(1)
  return h.enviar.mock.calls[0]![0].html as string
}

describe('B89 · «Enviar» a las 19:00 de Mexico (ya es manana en UTC)', () => {
  it('la consulta de `vencida` recibe el dia del negocio', async () => {
    await correoDe('2026-11-04')
    const c = h.consultas.find((x) => x.sql.includes('from propuestas'))!
    expect(hoyDeVigencia()).toBe('2026-11-04')
    expect(c.params).toContain('2026-11-04')
    expect(c.params).not.toContain('2026-11-05')
  })

  it('una vigencia que vence HOY se respeta: el correo promete hoy, no la renueva', async () => {
    const html = await correoDe('2026-11-04')
    expect(html).toContain(formatFecha('2026-11-04', 'es'))
    expect(html).not.toContain(formatFecha('2026-12-04', 'es'))
  })

  it('sin vigencia, el correo promete hoy + 30 contando desde el dia de Mexico', async () => {
    const html = await correoDe(null)
    expect(html).toContain(formatFecha('2026-12-04', 'es'))
    expect(html).not.toContain(formatFecha('2026-12-05', 'es'))
  })

  it('NEGATIVO · la que vencio AYER se renueva desde hoy (Mexico), no desde manana (UTC)', async () => {
    const html = await correoDe('2026-11-03')
    expect(html).toContain(formatFecha('2026-12-04', 'es'))
    expect(html).not.toContain(formatFecha('2026-11-03', 'es'))
  })
})

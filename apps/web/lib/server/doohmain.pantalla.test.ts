import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  A qué pantalla de DOOHmain va cada pantalla, y en qué orden se decide.
// ----------------------------------------------------------------------------
//  La e2e (`doohmain-pantalla-por-sitio.e2e.test.ts`) corre con el mapa del
//  servidor VACÍO, así que no puede ver si la ficha gana también sobre el mapa.
//  Aquí se fijan las tres capas a la vez y se mira el `--screen` que de verdad
//  recibe el SDK: ficha → DOOHMAIN_SCREEN_MAP → DOOHMAIN_DEFAULT_SCREEN.
// ============================================================================

process.env.DOOHMAIN_SCREEN_MAP = JSON.stringify({ 'CON-MAPA': 'DEL-MAPA' })
process.env.DOOHMAIN_DEFAULT_SCREEN = 'POR-OMISION'

const llamadas: string[][] = []
vi.mock('node:child_process', () => ({
  execFile: (_py: string, args: string[], _o: unknown, cb: (e: unknown, r: unknown) => void) => {
    llamadas.push(args)
    cb(null, { stdout: JSON.stringify({ ok: true, estado: 'published', auth: 'A', media_id: 1 }) })
  },
}))

let filas: any[] = []
vi.mock('./db', () => ({
  q: vi.fn(async (sql: string) => (sql.includes('not exists') ? [] : filas)),
  q1: vi.fn(async (sql: string) =>
    sql.includes('from campanas')
      ? { id: 'c1', folio: 'PR-1', nombre: 'Campaña', cliente_id: 'k', fecha_inicio: '2026-10-01', fecha_fin: '2026-10-31' }
      : { nombre: 'Cliente' },
  ),
}))

const { publicarCampanaEnDoohmain } = await import('./doohmain')

const fila = (clave: string, extra: Record<string, unknown> = {}) => ({
  reserva_id: 'r-' + clave, clave_interna: clave, sitio_nombre: clave, spots_por_dia: null,
  creativo_id: 'cr-' + clave, creativo_nombre: 'pieza', formato: 'png', veces: 1,
  archivo_url: 'data:image/png;base64,iVBORw0KGgo=', codigo: null,
  doohmain_pantalla: null, cms: null, ...extra,
})
const pantallaDe = (args: string[]) => args[args.indexOf('--screen') + 1]

beforeEach(() => {
  llamadas.length = 0
})

describe('la pantalla de DOOHmain', () => {
  it('la ficha gana incluso a una pantalla que SÍ está en el mapa del servidor', async () => {
    filas = [fila('CON-MAPA', { doohmain_pantalla: 'DE-LA-FICHA' })]
    const [r] = await publicarCampanaEnDoohmain('c1')
    expect(r.screen).toBe('DE-LA-FICHA')
    expect(pantallaDe(llamadas[0])).toBe('DE-LA-FICHA')
  })

  it('sin ficha, el mapa; sin mapa, la pantalla por omisión', async () => {
    filas = [fila('CON-MAPA'), fila('SIN-MAPA')]
    const r = await publicarCampanaEnDoohmain('c1')
    expect(r.map((x) => x.screen)).toEqual(['DEL-MAPA', 'POR-OMISION'])
    expect(llamadas.map(pantallaDe)).toEqual(['DEL-MAPA', 'POR-OMISION'])
  })

  it('una pantalla de otro CMS no llama al SDK, aunque tenga ficha y mapa', async () => {
    filas = [fila('CON-MAPA', { cms: 'BROADSIGN', doohmain_pantalla: 'DE-LA-FICHA' })]
    const [r] = await publicarCampanaEnDoohmain('c1')
    expect(r).toMatchObject({ ok: true, estado: 'otro_cms', cms: 'BROADSIGN', screen: null })
    expect(llamadas).toHaveLength(0)
  })
})

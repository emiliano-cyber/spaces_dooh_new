import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as XLSX from 'xlsx'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'

// ============================================================================
//  GET /api/space-eyes/campanas/excel — el reporte de campañas detectadas.
// ----------------------------------------------------------------------------
//  Con sesión real y permisos reales. Lo que se comprueba aquí y no en la
//  unitaria es la PUERTA: quién lo baja (los mismos roles que ven Space Eyes →
//  Campañas en el menú: Dueño, Administrador y venta) y que lo que sale por
//  HTTP es un .xlsx que se abre, no un JSON con otro nombre.
//
//  El servidor de pruebas no tiene SPACE_EYE_BASE_URL/SPACE_EYE_KEY, así que
//  el reporte sale con los datos de DEMOSTRACIÓN — que es justo lo que tiene
//  que funcionar en una demo, y lo que el archivo tiene que confesar.
// ============================================================================

let mando: Awaited<ReturnType<typeof sembrarTenant>>
let vendedor: Awaited<ReturnType<typeof sembrarTenant>>
let imprenta: Awaited<ReturnType<typeof sembrarTenant>>
let operaciones: Awaited<ReturnType<typeof sembrarTenant>>

const conSpaceEyeReal = Boolean(process.env.SPACE_EYE_BASE_URL && process.env.SPACE_EYE_KEY)

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  // La fila REAL del vendedor (`20260929_roles_de_venta_matriz.sql:212`):
  // `asegurarPermisos()` solo siembra DUENO y COMERCIAL.
  await poolTest().query(
    `insert into rol_permisos (rol, modulo, accion) values ('VENDEDOR','inventario','ver') on conflict do nothing`,
  )
  mando = await sembrarTenant('sexlsm')
  vendedor = await sembrarTenant('sexlsv', { rol: 'VENDEDOR' })
  imprenta = await sembrarTenant('sexlsi', { rol: 'IMPRENTA' })
  operaciones = await sembrarTenant('sexlso', { rol: 'OPERACIONES' })
  await arrancarServidor()
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// `Cliente.pedir` lee el cuerpo como texto y un .xlsx no sobrevive a eso: se
// pide aparte con la sesión y la IP del mismo cliente (como en
// comprobante-cobranza.e2e.test.ts).
async function bajar(cliente: Cliente, ruta: string) {
  const interno = cliente as unknown as { cookies: Map<string, string>; ip: string }
  const cookie = [...interno.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
  const r = await fetch(`${BASE}${ruta}`, { headers: { cookie, 'x-forwarded-for': interno.ip }, redirect: 'manual' })
  return {
    status: r.status,
    tipo: r.headers.get('content-type'),
    disposicion: r.headers.get('content-disposition'),
    bytes: Buffer.from(await r.arrayBuffer()),
  }
}

async function entrar(t: { usuarioEmail: string }) {
  const c = new Cliente()
  await c.entrar(t.usuarioEmail, PASSWORD_DEMO)
  return c
}

const RUTA = '/api/space-eyes/campanas/excel/'

describe('reporte en Excel de campañas detectadas', () => {
  it('sin sesión: 401', async () => {
    const r = await new Cliente().pedir(RUTA)
    expect(r.status).toBe(401)
  })

  // Imprenta no tiene ni `inventario.ver`: la para la primera llave, `exigir()`.
  it('un rol que no ve Space Eyes → Campañas (Imprenta): 403', async () => {
    const r = await bajar(await entrar(imprenta), RUTA)
    expect(r.status).toBe(403)
  })

  // El caso que de verdad prueba la SEGUNDA llave: OPERACIONES sí tiene
  // `inventario.ver` (lo trae la base desde `20260804_modulo_inventario.sql`),
  // así que `exigir()` lo deja pasar; lo para que la entrada del menú no es suya.
  // Mutado el 19/11 (sin la comprobación de `NAV` en la ruta): da 200 y esto falla.
  it('Operaciones, que tiene inventario.ver pero no ve Space Eyes → Campañas: 403', async () => {
    const r = await bajar(await entrar(operaciones), RUTA)
    expect(r.status).toBe(403)
  })

  it('el Dueño baja un .xlsx de verdad, con su nombre y el rango', async () => {
    const r = await bajar(await entrar(mando), `${RUTA}?desde=2026-11-01&hasta=2026-11-10`)
    expect(r.status).toBe(200)
    expect(r.tipo).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(r.disposicion).toContain('attachment')
    expect(r.disposicion).toContain('2026-11-01-a-2026-11-10')
    // Un .xlsx es un ZIP: empieza por «PK».
    expect(r.bytes.subarray(0, 2).toString('latin1')).toBe('PK')
    const libro = XLSX.read(r.bytes, { type: 'buffer' })
    expect(libro.SheetNames.length).toBe(2)
  })

  it('un vendedor también lo baja; sin Space Eye configurado, sale la DEMOSTRACIÓN y lo dice', async () => {
    const r = await bajar(await entrar(vendedor), `${RUTA}?desde=2026-11-01&hasta=2026-11-05`)
    expect(r.status).toBe(200)
    const libro = XLSX.read(r.bytes, { type: 'buffer' })
    const filas = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[libro.SheetNames[0]], { header: 1, defval: null })
    const arriba = filas.slice(0, 6).map((f) => String(f[0] ?? ''))
    if (conSpaceEyeReal) return
    expect(r.disposicion).toContain('demostracion')
    expect(arriba.some((x) => /DEMOSTRACI/.test(x))).toBe(true)
    // Y trae detecciones con fecha numérica.
    const iCab = filas.findIndex((f) => f[0] === 'Fecha')
    expect(iCab).toBeGreaterThan(0)
    expect(typeof filas[iCab + 1][0]).toBe('number')
  })

  it('fechas mal escritas: 400 con el motivo, no un Excel vacío', async () => {
    const c = await entrar(mando)
    const r = await c.pedir(`${RUTA}?desde=2026-11-10&hasta=2026-11-01`)
    expect(r.status).toBe(400)
    expect(typeof r.datos.error).toBe('string')
  })
})

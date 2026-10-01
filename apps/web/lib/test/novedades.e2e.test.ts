import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'

// ============================================================================
//  GET /api/novedades — las notas de la version INSTALADA, para todos.
// ----------------------------------------------------------------------------
//  Pedido del dueno (2026-10-01): TODO usuario ve, una vez despues de
//  instalarse una version, que trae. El dialogo pide esto al montar el shell.
//
//  Lo que importa probar:
//   · CUALQUIER usuario con sesion lo ve -- aqui uno de IMPRENTA, que no
//     tiene ni un permiso de `administracion`. Si este endpoint se colgara de
//     un modulo, el dialogo se quedaria mudo para media plantilla sin error.
//   · NEGATIVO: SIN sesion, 401. La version que corre la instancia va tras
//     token en `/api/version` (P6); este endpoint no puede ser la puerta de
//     atras para preguntarla sin entrar.
//   · La version sale del proceso (`SPACE_OS_VERSION`, sellada en la imagen)
//     y las notas, del `novedades.json` empaquetado en el build.
// ============================================================================

const VERSION = 'v0.9.2'
const EMAIL_IMPRENTA = 'imprenta@novedades.test'
const ARCHIVO = JSON.parse(readFileSync(join(process.cwd(), 'novedades.json'), 'utf8'))
let versionAntes: string | undefined
let org: Awaited<ReturnType<typeof sembrarTenant>>

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('novedad')
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ('Imprenta novedades',$1,'IMPRENTA',$2,true,$3)`,
    [EMAIL_IMPRENTA, await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
  // El servidor hereda el entorno de este proceso (`servidor-e2e.ts`). Se
  // restaura al final: las e2e corren en serie en el mismo proceso, y una
  // version sellada que se quedara puesta cambiaria lo que ven las demas.
  versionAntes = process.env.SPACE_OS_VERSION
  process.env.SPACE_OS_VERSION = VERSION
  await arrancarServidor()
}, 180_000)

afterAll(async () => {
  await pararServidor()
  if (versionAntes === undefined) delete process.env.SPACE_OS_VERSION
  else process.env.SPACE_OS_VERSION = versionAntes
  await cerrarPool()
})

describe('GET /api/novedades', () => {
  it('NEGATIVO: sin sesion, 401 -- y no dice la version', async () => {
    const r = await fetch(`${BASE}/api/novedades/`, { redirect: 'manual' })
    expect(r.status).toBe(401)
    const cuerpo = await r.text()
    expect(cuerpo).not.toContain(VERSION)
  })

  it('cualquier usuario con sesion (IMPRENTA, sin administracion) ve las notas de la instalada', async () => {
    const c = new Cliente()
    await c.entrar(EMAIL_IMPRENTA, PASSWORD_DEMO)
    const r = await c.pedir('/api/novedades/')
    expect(r.status).toBe(200)
    expect(r.datos.version).toBe(VERSION)
    expect(r.datos.notas).toEqual(ARCHIVO.find((e: { version: string }) => e.version === VERSION))
    // Y la lista entera, para la pagina de Novedades.
    expect(r.datos.novedades).toEqual(ARCHIVO)
  })

  it('el Dueno ve lo mismo', async () => {
    const c = new Cliente()
    await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/novedades/')
    expect(r.status).toBe(200)
    expect(r.datos.version).toBe(VERSION)
    expect(r.datos.notas?.version).toBe(VERSION)
  })
})

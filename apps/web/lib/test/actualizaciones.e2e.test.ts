import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  Tarea 3 · GET/PATCH /api/actualizaciones — ADR 0037.
// ----------------------------------------------------------------------------
//  Los casos que importan son los NEGATIVOS:
//
//  · quien no es Dueño no puede tocar nada (403) — solo el catálogo le da
//    `administracion` al Dueño (`20260820_catalogo_permisos_completo.sql`).
//  · una aprobación para un digest que YA NO es el disponible no se guarda
//    (409). Es la pieza central del ADR: un cliente viejo, o una pestaña
//    abierta desde ayer, mandaría el digest de ayer, y aceptarlo instalaría
//    algo que el dueño nunca miró. Se defiende EN EL SERVIDOR, no solo
//    ocultando el botón — por eso la prueba entra por HTTP y no llama al repo.
//  · `.strict()` rechaza un campo que le toca al actualizador
//    (`digestDisponible`, que la app no puede ni debe escribir).
//
//  Por HTTP y no llamando al repo: `exigir()` resuelve el permiso desde la
//  sesión (cookie), y eso es justo lo que las pruebas de permiso verifican.
//  Simularlo a pelo sería un mock más complejo que lo probado.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
const EMAIL_SIN_ADMINISTRACION = 'imprenta@actualizaciones.test'

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('actualiz')
  // IMPRENTA: el catálogo vigente no le da NINGÚN permiso de `administracion`
  // (solo `DUENO` los tiene). Mismo criterio que estado-campanas.e2e.test.ts.
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ('Imprenta actualizaciones',$1,'IMPRENTA',$2,true,$3)`,
    [EMAIL_SIN_ADMINISTRACION, await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
  await arrancarServidor()
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// La fila es ÚNICA (`id = true`, ver la migración `20260921_...`): se resetea
// entre pruebas en vez de recrear el esquema entero, que reaplicaría la
// cadena completa de migraciones por cada caso.
beforeEach(async () => {
  await poolTest().query(
    `update actualizaciones_instancia
        set modo = 'aprobacion', aprobado_digest = null, aprobado_por = null,
            aprobado_en = null, digest_disponible = null, version_disponible = null,
            digest_instalado = null, version_instalada = null, migraciones_pendientes = null
      where id = true`,
  )
})

async function comoDueno(): Promise<Cliente> {
  const c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
  return c
}

async function comoOtroRol(): Promise<Cliente> {
  const c = new Cliente()
  await c.entrar(EMAIL_SIN_ADMINISTRACION, PASSWORD_DEMO)
  return c
}

// Simula lo que escribe `update.sh --comprobar`: el actualizador anota lo que
// vio en el registry. Va por el pool ADMIN (superusuario, se salta el GRANT
// por columna) a propósito: es el otro escritor, no la app.
async function sembrarDisponible(digest: string): Promise<void> {
  await poolTest().query(
    `update actualizaciones_instancia
        set digest_disponible = $1, version_disponible = 'v-test', comprobado_en = now()
      where id = true`,
    [digest],
  )
}

describe('GET/PATCH /api/actualizaciones', () => {
  it('NEGATIVO: quien no es Dueno no puede cambiar el modo', async () => {
    const c = await comoOtroRol()
    const r = await c.pedir('/api/actualizaciones/', { metodo: 'PATCH', cuerpo: { modo: 'automatica' } })
    expect(r.status).toBe(403)
  })

  it('NEGATIVO: no se puede aprobar un digest que no es el disponible', async () => {
    // Es el ADR 0037 defendido en el servidor y no solo en la pantalla: un
    // cliente viejo, o una pestaña abierta desde ayer, mandaría el digest de
    // ayer. Aceptarlo instalaría algo que nadie miró.
    await sembrarDisponible('sha256:nuevo')
    const c = await comoDueno()
    const r = await c.pedir('/api/actualizaciones/', {
      metodo: 'PATCH',
      cuerpo: { aprobarDigest: 'sha256:de-ayer' },
    })
    expect(r.status).toBe(409)
    const fila = await poolTest().query('select aprobado_digest from actualizaciones_instancia where id = true')
    expect(fila.rows[0].aprobado_digest).toBeNull()
  })

  it('NEGATIVO: el PATCH no puede escribir lo que le toca al actualizador', async () => {
    const c = await comoDueno()
    const r = await c.pedir('/api/actualizaciones/', {
      metodo: 'PATCH',
      cuerpo: { digestDisponible: 'sha256:mio' },
    })
    expect(r.status).toBe(400) // `.strict()` del schema
  })

  it('aprobar el digest disponible lo guarda con quien y cuando', async () => {
    await sembrarDisponible('sha256:nuevo')
    const c = await comoDueno()
    const r = await c.pedir('/api/actualizaciones/', {
      metodo: 'PATCH',
      cuerpo: { aprobarDigest: 'sha256:nuevo' },
    })
    expect(r.status).toBe(200)
    const fila = await poolTest().query(
      'select aprobado_digest, aprobado_por, aprobado_en from actualizaciones_instancia where id = true',
    )
    expect(fila.rows[0].aprobado_digest).toBe('sha256:nuevo')
    expect(fila.rows[0].aprobado_por).not.toBeNull()
    expect(fila.rows[0].aprobado_en).not.toBeNull()
  })

  it('NEGATIVO: modo y aprobarDigest juntos se rechazan SIN escribir nada', async () => {
    // Ronda de revision 1: el PATCH original no era atomico entre las dos
    // escrituras -- si `modo` se guardaba y despues `aprobarDigest` reventaba
    // con 409 por digest caducado, el cambio de modo sobrevivia a una
    // respuesta de error. Un efecto secundario que sobrevive a un fallo es la
    // familia de defectos que este repositorio persigue.
    //
    // El tipo del brief (`{ modo? } | { aprobarDigest: string }`) ya decia que
    // son alternativas: el schema ahora lo IMPONE con un XOR, asi que la
    // peticion se rechaza ANTES de tocar la base -- no hay nada que revertir
    // porque no hay nada que escribir.
    await sembrarDisponible('sha256:nuevo')
    const c = await comoDueno()
    const r = await c.pedir('/api/actualizaciones/', {
      metodo: 'PATCH',
      cuerpo: { modo: 'automatica', aprobarDigest: 'sha256:de-ayer' },
    })
    expect(r.status).toBe(400)
    const fila = await poolTest().query(
      'select modo, aprobado_digest from actualizaciones_instancia where id = true',
    )
    // El modo NO cambio -- se quedo en el default de aprobacion del beforeEach.
    expect(fila.rows[0].modo).toBe('aprobacion')
    expect(fila.rows[0].aprobado_digest).toBeNull()
  })

  it('GET devuelve el estado, y hayNovedad compara el digest disponible contra el instalado', async () => {
    await sembrarDisponible('sha256:nuevo')
    const c = await comoDueno()
    const r = await c.pedir('/api/actualizaciones/')
    expect(r.status).toBe(200)
    expect(r.datos.digestDisponible).toBe('sha256:nuevo')
    expect(r.datos.hayNovedad).toBe(true)
    expect(r.datos.modo).toBe('aprobacion')
  })
})

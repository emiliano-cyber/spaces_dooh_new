import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest, poolApp } from './db-e2e'
import { sembrarTenant, asegurarPermisos } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  Recuperar contraseña con `password_resets` bajo RLS (07/08).
//
//  La tabla pasó a fail-closed + FORCE, y el repo tuvo que dejar de leerla con
//  `qRaw`. El riesgo de ese cambio NO es que falle ruidosamente: es que se
//  rompa EN SILENCIO — sin `app.tenant_id` la consulta devuelve cero filas, así
//  que todos los enlaces pasarían a ser «inválidos» sin un solo error en el
//  log. Es el modo de fallo exacto que dejó el desbloqueo roto un despliegue
//  entero (43f9284), y es lo que estas pruebas existen para cazar.
//
//  Por eso se ejerce el flujo ENTERO por HTTP, y además se comprueba el
//  aislamiento con el rol real de la app.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('reset')
  await arrancarServidor()
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// El token no viaja en la respuesta: el servidor de pruebas corre con
// NODE_ENV=production, así que no devuelve el `enlaceDev` de desarrollo. Se lee
// de la base, que además prueba que la fila SE ESCRIBIÓ de verdad.
async function tokenDe(email: string): Promise<string | null> {
  const r = await poolTest().query(
    `select pr.token from password_resets pr
       join usuarios u on u.id = pr.usuario_id
      where lower(u.email) = lower($1) and pr.usado_en is null
      order by pr.creado_en desc limit 1`,
    [email],
  )
  return r.rows[0]?.token ?? null
}

describe('1 · el flujo completo sigue funcionando con la tabla bajo RLS', () => {
  it('pedir el enlace ESCRIBE la fila (el INSERT pasa el WITH CHECK)', async () => {
    // Con `qRaw` este insert fallaría el WITH CHECK de la política. Que la fila
    // exista es la prueba de que la escritura va con contexto de tenant.
    const c = new Cliente()
    const r = await c.pedir('/api/auth/forgot/', { cuerpo: { email: org.usuarioEmail } })
    expect(r.status).toBe(200)
    expect(await tokenDe(org.usuarioEmail)).toBeTruthy()
  })

  it('el token recién emitido se reconoce como VÁLIDO', async () => {
    // Aquí es donde se rompería en silencio: leyendo sin tenant, la función
    // devolvería vacío y el enlace saldría «inválido» sin ningún error.
    const token = await tokenDe(org.usuarioEmail)
    const c = new Cliente()
    const r = await c.pedir(`/api/auth/reset/?token=${token}`)
    expect(r.status).toBe(200)
    expect(r.datos?.valido).toBe(true)
  })

  it('consumirlo cambia la contraseña, y la nueva sirve para entrar', async () => {
    const token = await tokenDe(org.usuarioEmail)
    const c = new Cliente()
    const r = await c.pedir('/api/auth/reset/', { cuerpo: { token, password: 'NuevaClave123' } })
    expect(r.status).toBe(200)

    // La prueba de verdad no es el 200: es que la contraseña nueva ENTRA.
    const c2 = new Cliente()
    const login = await c2.pedir('/api/auth/login/', {
      cuerpo: { email: org.usuarioEmail, password: 'NuevaClave123' },
    })
    expect(login.status).toBe(200)
  })

  it('el mismo enlace no se puede usar dos veces', async () => {
    const r = await poolTest().query(
      `select token from password_resets order by creado_en desc limit 1`,
    )
    const c = new Cliente()
    const usado = await c.pedir('/api/auth/reset/', {
      cuerpo: { token: r.rows[0].token, password: 'OtraClave123' },
    })
    expect(usado.status).toBe(400)
  })

  it('un token inventado no es válido y no rompe nada', async () => {
    const c = new Cliente()
    const r = await c.pedir('/api/auth/reset/?token=no-existe-este-token')
    expect(r.status).toBe(200)
    expect(r.datos?.valido).toBe(false)
  })
})

describe('2 · la tabla está de verdad aislada', () => {
  it('el rol de la app NO ve ninguna fila sin fijar el tenant', async () => {
    // Se SIEMBRA antes de comprobar: un cero no distingue «aislado» de «vacío».
    // Y se usa el pool de la app (NOSUPERUSER, NOBYPASSRLS), no el de admin —
    // con el superusuario del contenedor la RLS no aplica y esta prueba pasaría
    // sin probar nada.
    const hay = await poolTest().query('select count(*)::int as n from password_resets')
    expect(hay.rows[0].n).toBeGreaterThan(0)

    const sinTenant = await poolApp().query('select count(*)::int as n from password_resets')
    expect(sinTenant.rows[0].n).toBe(0)
  })

  it('pero la función SECURITY DEFINER sí resuelve el token', async () => {
    // Es la excepción acotada que hace que el flujo pre-sesión siga funcionando.
    const r = await poolTest().query('select token from password_resets limit 1')
    const viaDefiner = await poolApp().query(
      'select usuario_id from auth_reset_por_token($1)',
      [r.rows[0].token],
    )
    expect(viaDefiner.rows.length).toBe(1)
  })

  it('ninguna tabla con tenant_id se quedó sin RLS+FORCE', async () => {
    // El invariante que 20260720_hard1_rls_todas_tablas.sql documenta y que
    // `password_resets` llevaba rompiendo desde el 23/07. Aquí queda vigilado en
    // cada corrida, que es lo que faltaba: el ASSERT de aquella migración no ve
    // las tablas creadas después.
    const r = await poolTest().query(`
      select c.relname from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and exists (select 1 from information_schema.columns col
                      where col.table_name = c.relname and col.column_name = 'tenant_id')
         and (not c.relrowsecurity or not c.relforcerowsecurity)`)
    expect(r.rows.map((x) => x.relname)).toEqual([])
  })
})

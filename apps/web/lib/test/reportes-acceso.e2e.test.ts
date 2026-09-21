import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'
import { RUTA_RENTABILIDAD, DIMENSIONES_UI } from '@/components/demo/reportes/consulta'

// ============================================================================
//  La pantalla de reportes: la ruta que pide y el rol que la puede pedir.
// ----------------------------------------------------------------------------
//  Las dos pruebas que `vault/03-Frontend/pantalla-reportes.md` dejó anotadas
//  como pendientes el 2026-09-18, cuando el puerto 3311 lo tenía otro agente:
//
//   · que un rol SIN `finanzas.ver` no alcance el reporte — las unitarias
//     comprueban que el `NAV` lo dice; que el SERVIDOR lo cumpla con el rol
//     real, leído de `rol_permisos` en una base de verdad, solo lo ve una e2e;
//   · que la ruta que construye la pantalla —`/spaces-dooh/api/reportes/
//     rentabilidad/`, CON `basePath` y CON barra final— recibe 200.
//
//  ─── Por qué esta segunda prueba necesita un cliente HTTP propio ──────────
//  `Cliente` de `servidor-e2e.ts` antepone `BASE`, que YA LLEVA el basePath.
//  Usarlo aquí probaría una ruta reconstruida por el arnés, no la cadena que la
//  pantalla manda al navegador. Y la cadena es justo lo que falló: escrita como
//  `/api/reportes/rentabilidad`, la petición sale hacia el ORIGEN y lo que
//  vuelve NO es un error de red, es el 404 de Next con cuerpo HTML — que la
//  pantalla habría pintado como «no se pudo calcular el reporte» sin decir nada
//  de la causa. Por eso el cliente de abajo pide sobre el ORIGEN pelado y la
//  constante `RUTA_RENTABILIDAD` se IMPORTA del módulo de la pantalla: si
//  alguien le quita el `basePath` o la barra, esta prueba es la que se cae.
// ============================================================================

const ORIGEN = BASE.replace(/\/spaces-dooh$/, '')

/**
 * Cliente contra el ORIGEN pelado, sin basePath añadido por nadie.
 *
 * Es deliberadamente tonto —tarro de cookies y poco más—: su único trabajo es
 * mandar la cadena EXACTA que se le pase, que es lo que aquí se está probando.
 */
class ClienteCrudo {
  private cookies = new Map<string, string>()
  // IP propia, igual que `Cliente`: los limitadores van por IP y sin esto un
  // fichero con varios inicios de flujo empieza a recibir 429 por un motivo que
  // no tiene nada que ver con lo que se prueba.
  private ip = '10.0.9.9'

  async pedirCrudo(ruta: string): Promise<{ status: number; texto: string; tipo: string | null }> {
    const cabeceras: Record<string, string> = { 'x-forwarded-for': this.ip }
    if (this.cookies.size) {
      cabeceras.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    }
    const r = await fetch(`${ORIGEN}${ruta}`, { headers: cabeceras, redirect: 'manual' })
    this.guardarCookies(r)
    return { status: r.status, texto: await r.text(), tipo: r.headers.get('content-type') }
  }

  async entrar(email: string, password: string): Promise<void> {
    const r = await fetch(`${ORIGEN}/spaces-dooh/api/auth/login/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': this.ip },
      body: JSON.stringify({ email, password }),
      redirect: 'manual',
    })
    if (r.status !== 200) throw new Error(`Login de ${email} falló (${r.status})`)
    this.guardarCookies(r)
  }

  private guardarCookies(r: Response) {
    for (const [nombre, valor] of r.headers) {
      if (nombre.toLowerCase() !== 'set-cookie') continue
      for (const trozo of valor.split(/,(?=\s*[^;=]+=)/)) {
        const [par] = trozo.trim().split(';')
        const i = par.indexOf('=')
        if (i > 0) this.cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim())
      }
    }
  }
}

let org: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente
let comercial: Cliente
let duenoCrudo: ClienteCrudo

const RANGO = () => ({ desde: enDias(-30), hasta: enDias(0) })

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('repacc')

  // El rol sin `finanzas` va en la MISMA organización: así el 403 solo puede
  // venir del permiso y no del tenant, que serían dos cosas distintas dando el
  // mismo número.
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ($1,$2,'COMERCIAL',$3,true,$4)`,
    ['Comercial Acc', 'comercial@repacc.test', await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )

  await arrancarServidor()
  dueno = new Cliente()
  comercial = new Cliente()
  duenoCrudo = new ClienteCrudo()
  await dueno.entrar(org.usuarioEmail, PASSWORD_DEMO)
  await comercial.entrar('comercial@repacc.test', PASSWORD_DEMO)
  await duenoCrudo.entrar(org.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

const consulta = () =>
  new URLSearchParams({ ...RANGO(), dimension: 'sitio', granularidad: 'mes' }).toString()

// ─── 1 · la ruta que construye la pantalla ─────────────────────────────────
describe('1 · la pantalla pide `/spaces-dooh/api/reportes/rentabilidad/` y recibe 200', () => {
  it('la constante de la pantalla lleva el basePath y la barra final', async () => {
    // `next.config.mjs` declara `basePath: '/spaces-dooh'` y
    // `trailingSlash: true`. Los dos tienen que estar EN LA CONSTANTE, porque
    // es lo que se manda tal cual.
    expect(RUTA_RENTABILIDAD).toBe('/spaces-dooh/api/reportes/rentabilidad/')
  })

  it('esa cadena EXACTA, desde el origen pelado, devuelve 200 y un reporte JSON', async () => {
    const r = await duenoCrudo.pedirCrudo(`${RUTA_RENTABILIDAD}?${consulta()}`)
    expect(r.status, r.texto.slice(0, 300)).toBe(200)
    expect(r.tipo ?? '').toContain('application/json')
    const d = JSON.parse(r.texto)
    expect(d.dimension).toBe('sitio')
    expect(Array.isArray(d.filas)).toBe(true)
    expect(d.totales).toBeDefined()
  })

  it('SIN el basePath NO es un error de red: es el 404 de Next con cuerpo HTML', async () => {
    // El defecto exacto que documenta la nota. Esta prueba es la que hace que
    // la de arriba no sea vacua: demuestra que el basePath está haciendo algo.
    const r = await duenoCrudo.pedirCrudo(`/api/reportes/rentabilidad/?${consulta()}`)
    expect(r.status).toBe(404)
    expect(r.tipo ?? '').toContain('text/html')
    // Y lo más importante: lo que vuelve NO es un reporte. Si la pantalla lo
    // tomara por bueno, pintaría un error genérico sin decir la causa.
    expect(r.texto.trimStart().startsWith('{')).toBe(false)
  })

  it('SIN la barra final no devuelve el reporte: redirige', async () => {
    // `trailingSlash: true` hace que la ruta canónica lleve barra. Un 308 no es
    // un fallo —el navegador lo sigue—, pero la respuesta de esta petición no
    // es el reporte, y por eso la constante la lleva escrita.
    const r = await duenoCrudo.pedirCrudo(`/spaces-dooh/api/reportes/rentabilidad?${consulta()}`)
    expect(r.status).toBe(308)
    expect(r.texto.trimStart().startsWith('{')).toBe(false)
  })

  it('las CINCO dimensiones del selector calculan por esa misma ruta', async () => {
    // El selector ya no miente sobre su propia aplicación —el campo `conMotor`
    // se retiró el 18/09—, así que las cinco que ofrece tienen que contestar.
    // Si mañana se añade una al selector sin motor, esta prueba lo dice.
    for (const { valor } of DIMENSIONES_UI) {
      const qs = new URLSearchParams({ ...RANGO(), dimension: valor, granularidad: 'mes' })
      const r = await duenoCrudo.pedirCrudo(`${RUTA_RENTABILIDAD}?${qs}`)
      expect(r.status, `${valor}: ${r.texto.slice(0, 200)}`).toBe(200)
      expect(JSON.parse(r.texto).dimension).toBe(valor)
    }
  })
})

// ─── 2 · el rol sin `finanzas.ver` ─────────────────────────────────────────
describe('2 · un rol sin `finanzas.ver` no alcanza el reporte', () => {
  it('el permiso NO está en `rol_permisos` — el escenario es real, no supuesto', async () => {
    // Sin esta comprobación, un 403 no distinguiría «el guard funciona» de «la
    // semilla se olvidó de sembrar los permisos de COMERCIAL». Es el mismo
    // error que ya se cometió en este arnés con un cero.
    const sin = await poolTest().query(
      `select count(*)::int n from rol_permisos where rol = 'COMERCIAL' and modulo = 'finanzas'`,
    )
    expect(sin.rows[0].n).toBe(0)
    const con = await poolTest().query(
      `select count(*)::int n from rol_permisos where rol = 'DUENO' and modulo = 'finanzas' and accion = 'ver'`,
    )
    expect(con.rows[0].n).toBe(1)
  })

  it('las CINCO dimensiones responden 403, incluida `luz`', async () => {
    // La quinta nació el 18/09 y no estaba cubierta: una dimensión nueva que
    // llegara colgando de otra ruta se saltaría el guard sin que nada lo dijera.
    for (const { valor } of DIMENSIONES_UI) {
      const r = await comercial.pedir(
        `/api/reportes/rentabilidad/?${new URLSearchParams({ ...RANGO(), dimension: valor, granularidad: 'mes' })}`,
      )
      expect(r.status, `${valor}: ${JSON.stringify(r.datos)}`).toBe(403)
      // Y el mensaje de error no filtra ni una cifra ni una clave.
      const texto = JSON.stringify(r.datos)
      expect(texto).not.toContain(org.sitioId)
      expect(texto).not.toContain('ingreso')
    }
  })

  it('el Dueño de la misma organización SÍ lo abre — el 403 es del permiso', async () => {
    // El control positivo. Sin él, un 403 en las cinco podría venir de que la
    // ruta esté rota para todo el mundo.
    const r = await dueno.pedir(
      `/api/reportes/rentabilidad/?${new URLSearchParams({ ...RANGO(), dimension: 'luz', granularidad: 'mes' })}`,
    )
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
  })

  it('el enlace directo a /reportes NO le entrega ni una cifra', async () => {
    // LO QUE ESTO MIDE, Y LO QUE NO. `middleware.ts:174-179` solo compuerta por
    // PRESENCIA de sesión, así que la página se sirve con 200 y el desvío del
    // rol lo hace `AuthGate` en el navegador. La afirmación que sí se puede
    // sostener desde el servidor —y la que de verdad protege el dinero— es
    // ésta: el HTML que llega por el enlace directo no trae ningún dato del
    // reporte, porque la pantalla los pide al endpoint y el endpoint le
    // responde 403. Ver la nota del informe sobre este punto.
    const r = await comercial.pedir('/reportes/')
    expect(r.status).toBe(200)
    const html = String(r.datos)
    expect(html).not.toContain(org.sitioId)
    expect(html).not.toContain('costoEspacio')
    expect(html).not.toContain('margenPct')
  })

  it('y `/api/estado` tampoco le lleva el reporte por la puerta de atrás', async () => {
    // La pantalla de reportes NO se cuelga del store, y esto lo fija: si un día
    // alguien metiera las cifras en `/api/estado` «para que cargue más rápido»,
    // llegarían a un rol que no puede verlas.
    const r = await comercial.pedir('/api/estado/')
    expect(r.status).toBe(200)
    expect(r.datos).not.toHaveProperty('rentabilidad')
    expect(r.datos).not.toHaveProperty('consumosEnergia')
  })

  it('sin sesión el enlace directo manda al login, no a la pantalla', async () => {
    const anonimo = new Cliente()
    const r = await anonimo.pedir('/reportes/')
    expect(r.status).toBe(307)
    expect(r.ubicacion ?? '').toContain('/login')
  })
})

import { spawn, type ChildProcess } from 'node:child_process'
import { URL_APP } from './db-e2e'
import { CLIENT_ID_PRUEBA, CLIENT_SECRET_PRUEBA, ENDPOINT_DOBLE } from './doble-google'

// ============================================================================
//  lib/test/servidor-e2e.ts — El servidor de Next, de verdad, contra la BD de
//  prueba.
// ----------------------------------------------------------------------------
//  Por qué HTTP y no llamar a los repos directamente: `tenantActual()` resuelve
//  el tenant desde `cookies()` de next/headers y desde la sesión. Fuera de una
//  petición no hay ni cookies ni sesión, así que un repo llamado a pelo no
//  sabría de quién es lo que consulta — y la mitad de estas pruebas van
//  justamente de eso. Simularlo seria construir un mock mas complejo que lo
//  probado, que es la señal de subir de nivel.
//
//  Por HTTP entra ademas el `middleware` (el gate de sesión) y el orden real en
//  que componen los guards, que es donde vive lo que se quiere verificar.
//
//  Se REUTILIZA el build existente: `DATABASE_URL` se lee en tiempo de
//  ejecución, así que basta arrancar con otra. Lo único horneado en el bundle
//  son las `NEXT_PUBLIC_*`, que aquí no importan.
// ============================================================================

const PUERTO = Number(process.env.PUERTO_E2E ?? 3311)
export const BASE = `http://127.0.0.1:${PUERTO}/spaces-dooh`

let proceso: ChildProcess | null = null

export async function arrancarServidor(): Promise<void> {
  if (proceso) return
  proceso = spawn('npx', ['next', 'start', '-p', String(PUERTO)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      // ¡EL ROL IMPORTA! Con el superusuario del contenedor la RLS NO se
      // aplica, y la app quedaría sin su capa de aislamiento — una prueba de
      // «beta no puede tocar lo de alfa» pasaría o fallaría por el motivo
      // equivocado. En produccion la app conecta como `spaces_user`
      // (NOSUPERUSER, NOBYPASSRLS); aquí, como `spaces_app`, su equivalente.
      DATABASE_URL: URL_APP,
      NODE_ENV: 'production',
      // Las pruebas hablan por http, y una cookie `Secure` no se guardaría:
      // el login daría 200 y la sesión se perderia, que es el fallo que ya
      // ocurrió en el droplet cuando prod iba sin TLS.
      COOKIE_SECURE: '0',
      // Mismas banderas que produccion: el autoregistro CERRADO (A6). Se
      // comprueba en el servidor, no solo ocultando el boton, asi que la
      // prueba necesita el mismo valor para verificar el guard de verdad.
      NEXT_PUBLIC_AUTOREGISTRO: '0',

      // ─── ADR 0012 · acceso con Google ───────────────────────────────────
      // Encendido en las pruebas aunque en producción hoy esté apagado: sin
      // esto las rutas responden 503 y el flujo no se puede ejercer. El resto
      // de ficheros no lo toca.
      GOOGLE_OAUTH: '1',
      GOOGLE_CLIENT_ID: CLIENT_ID_PRUEBA,
      GOOGLE_CLIENT_SECRET: CLIENT_SECRET_PRUEBA,
      // El canje va al doble local, NO a Google. Es la razón de que esta
      // variable exista.
      GOOGLE_TOKEN_ENDPOINT: ENDPOINT_DOBLE,
      // Explícita, como se recomienda en producción: deducirla del request
      // detrás de un proxy es donde se cuelan las diferencias que Google
      // rechaza con `redirect_uri_mismatch`. Con barra final (trailingSlash).
      GOOGLE_REDIRECT_URI: `${BASE}/api/auth/google/callback/`,

      // ─── DOOHmain (M14 / INC-02) ────────────────────────────────────────
      // ENCENDIDO, con un intérprete que NO EXISTE. Suena raro y es a
      // propósito: lo que hay que probar es QUÉ SE MANDA —qué pieza, a qué
      // pantalla y con cuántos pases al día—, no lo que conteste el CMS.
      //
      // Con el flag apagado, `publicarCampanaEnDoohmain` ni se llama y el
      // reparto por pantalla se queda sin probar. Con él encendido, cada
      // intento falla al arrancar el proceso y `ejecutarPublish` devuelve
      // `{ok:false, category:'network'}` — pero ANTES ha construido la fila del
      // resultado con el sitio, el creativo y `cantDia`. Ahí es donde se mira.
      //
      // No hay riesgo de tocar un DOOHmain real: el binario no existe.
      DOOHMAIN_PUBLISH_ENABLED: '1',
      DOOHMAIN_PY: 'python-que-no-existe-en-las-pruebas',
      DOOHMAIN_DEFAULT_SCREEN: 'pantalla_de_prueba',
      DOOHMAIN_SCREEN_MAP: '{}',
    },
    shell: process.platform === 'win32',
    stdio: 'ignore',
  })

  // Espera por CONDICIÓN, no por reloj: un `sleep` fijo produce fallos
  // intermitentes en cuanto la máquina va cargada.
  const limite = Date.now() + 60_000
  while (Date.now() < limite) {
    try {
      const r = await fetch(`${BASE}/login/`, { redirect: 'manual' })
      if (r.status > 0) return
    } catch {
      // todavía no escucha
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`El servidor de pruebas no respondió en ${BASE} tras 60 s`)
}

export async function pararServidor(): Promise<void> {
  if (!proceso) return
  const pid = proceso.pid
  proceso = null
  if (!pid) return
  if (process.platform === 'win32') {
    // En Windows `kill()` mata el shell, no el árbol: `next start` sobrevive,
    // se queda con el puerto y —lo peor— CONSERVA el limitador de intentos de
    // login en memoria. La siguiente corrida se conecta a ese servidor viejo y
    // el login empieza a dar 429, con un fallo que no señala nada de esto.
    const { spawnSync } = await import('node:child_process')
    spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' })
  } else {
    try { process.kill(-pid, 'SIGTERM') } catch { try { process.kill(pid, 'SIGTERM') } catch { /* ya murió */ } }
  }
}

// ─── Cliente HTTP con tarro de cookies ──────────────────────────────────────
// Cada sesión es un cliente. Dos clientes = dos organizaciones distintas
// hablando a la vez, que es como se prueba el aislamiento sin trampas.
let contadorClientes = 0

export class Cliente {
  private cookies = new Map<string, string>()
  // Cada cliente simula una IP distinta, como usuarios distintos en producción.
  //
  // Hace falta porque los limitadores (`limitar()`) van POR IP: sin esto, un
  // fichero con más de diez inicios de flujo empieza a recibir 429 y el fallo
  // no señala nada del código que se está probando.
  //
  // Es fiel y no una trampa: en producción nginx pone
  // `X-Forwarded-For $remote_addr` —comprobado en
  // infra/nginx/demo.space-os.io.conf:123—, o sea que REEMPLAZA la cabecera en
  // vez de añadir a la que mande el cliente. Un usuario no puede elegir su
  // cubo de rate limit; aquí no hay nginx delante, así que la ponemos nosotros.
  private ip = `10.0.0.${(contadorClientes++ % 250) + 1}`

  // Devuelve también `ubicacion` (la cabecera Location). Hace falta para el
  // flujo de Google, donde TODO ocurre por redirecciones: el resultado de un
  // callback no está en el cuerpo, está en a dónde te manda.
  async pedir(
    ruta: string,
    opts: { metodo?: string; cuerpo?: unknown } = {},
  ): Promise<{ status: number; datos: any; ubicacion: string | null }> {
    const cabeceras: Record<string, string> = { 'x-forwarded-for': this.ip }
    if (this.cookies.size) {
      cabeceras.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    }
    if (opts.cuerpo !== undefined) cabeceras['content-type'] = 'application/json'

    const metodo = opts.metodo ?? (opts.cuerpo !== undefined ? 'POST' : 'GET')
    // Double-submit anti-CSRF (Hardening 1 · Bloque E): el middleware exige que
    // toda mutación autenticada lleve `x-csrf-token` igual a la cookie
    // `spaces_csrf`. En el navegador lo hace un parche de `window.fetch`; aquí
    // se replica, porque saltárselo obligaría a apagar una protección real
    // durante las pruebas — y entonces dejaría de estar probada.
    const tokenCsrf = this.cookies.get('spaces_csrf')
    if (tokenCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(metodo)) {
      cabeceras['x-csrf-token'] = decodeURIComponent(tokenCsrf)
    }

    const r = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: opts.cuerpo !== undefined ? JSON.stringify(opts.cuerpo) : undefined,
      redirect: 'manual',
    })

    for (const [nombre, valor] of r.headers) {
      if (nombre.toLowerCase() !== 'set-cookie') continue
      // `getSetCookie` no está en todos los runtimes; el split por coma falla
      // con `Expires=..., dd Mon`, así que se parte solo por el primer `=`.
      for (const trozo of valor.split(/,(?=\s*[^;=]+=)/)) {
        const [par] = trozo.trim().split(';')
        const i = par.indexOf('=')
        if (i > 0) this.cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim())
      }
    }

    const texto = await r.text()
    let datos: any = null
    try { datos = texto ? JSON.parse(texto) : null } catch { datos = texto }
    return { status: r.status, datos, ubicacion: r.headers.get('location') }
  }

  // ¿Está puesta esta cookie? Para comprobar que las de un solo uso del flujo
  // de Google se borran, y que la de sesión aparece cuando debe.
  tieneCookie(nombre: string): boolean {
    const v = this.cookies.get(nombre)
    return v !== undefined && v !== ''
  }

  async entrar(email: string, password: string): Promise<void> {
    const r = await this.pedir('/api/auth/login/', { cuerpo: { email, password } })
    if (r.status !== 200) {
      throw new Error(`Login de ${email} falló (${r.status}): ${JSON.stringify(r.datos)}`)
    }
    // El login deja la cookie CSRF; si por lo que sea no llegó, `/api/auth/me`
    // la crea (lo hace para las sesiones abiertas antes de Hardening 1). Sin
    // ella, la primera mutación se iría en 403 y el fallo apuntaría al sitio
    // equivocado.
    if (!this.cookies.has('spaces_csrf')) await this.pedir('/api/auth/me/')
  }
}

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { opcionesDeProceso, vigilarErrores, esperarMuerte } from './proceso-e2e'

// ============================================================================
//  El login con la BASE CAÍDA, contra un `next start` de verdad.
// ----------------------------------------------------------------------------
//  Reproducido el 2026-09-30 con Postgres apagado: `/api/auth/metodos` daba
//  200, `/api/auth/me` 401 con JSON, y `POST /api/auth/login` un 500 CON EL
//  CUERPO VACÍO — que la pantalla convertía en «Failed to execute 'json' on
//  'Response': Unexpected end of JSON input».
//
//  La unitaria (`lib/server/auth-base-caida.test.ts`) simula la base. Ésta no
//  simula nada: arranca la aplicación apuntada a un puerto donde no escucha
//  nadie, que es exactamente lo que ve un servidor cuando Postgres se cae. Lo
//  que añade sobre la unitaria es lo que la unitaria no puede ver: el error
//  REAL de `pg` con el pool de verdad, y lo que Next hace con él por fuera del
//  handler (el middleware, el `trailingSlash`, el 500 sin cuerpo).
//
//  ─── Por qué un servidor propio y no el del arnés ──────────────────────────
//  `servidor-e2e.ts` apunta a la base de pruebas y no se toca. Apagar esa base
//  a mitad de corrida rompería a todos los archivos que vienen detrás. Este
//  servidor vive solo mientras corre este archivo, con su propio puerto.
// ============================================================================

// Uno por encima del arnés por omisión (3311), y fuera del doble de Google
// (3312) y del servidor sin Google de `bootstrap.e2e.test.ts` (3313).
const PUERTO = Number(process.env.PUERTO_E2E_SIN_BASE ?? 3314)
const BASE = `http://127.0.0.1:${PUERTO}/spaces-dooh`

// Un puerto donde NO hay Postgres. El 1 está reservado (tcpmux) y en la práctica
// nunca escucha: la conexión se rechaza en el acto, que es la forma más común
// de «la base está caída» (el contenedor parado).
const URL_SIN_BASE = 'postgresql://spaces_app:nada@127.0.0.1:1/spaces_sin_base'

const MENSAJE = 'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.'

let proc: import('node:child_process').ChildProcess | null = null

beforeAll(async () => {
  const { spawn } = await import('node:child_process')
  proc = spawn('npx', ['next', 'start', '-p', String(PUERTO)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: URL_SIN_BASE,
      NODE_ENV: 'production',
      COOKIE_SECURE: '0',
    },
    stdio: 'ignore',
    ...opcionesDeProceso(),
  })
  vigilarErrores(proc)

  // `/api/auth/metodos/` no toca la base: si contesta, el servidor está vivo.
  const limite = Date.now() + 60_000
  for (;;) {
    try {
      const r = await fetch(`${BASE}/api/auth/metodos/`, { redirect: 'manual' })
      if (r.status > 0) break
    } catch {
      if (Date.now() > limite) throw new Error(`el servidor sin base no respondió en ${BASE} tras 60 s`)
      await new Promise((r) => setTimeout(r, 400))
    }
  }
}, 120_000)

afterAll(async () => {
  if (!proc?.pid) return
  const muriendo = proc
  const pid = proc.pid
  proc = null
  if (process.platform === 'win32') {
    const { spawnSync } = await import('node:child_process')
    spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' })
  } else {
    try {
      process.kill(-pid, 'SIGTERM')
    } catch {
      try { process.kill(pid, 'SIGTERM') } catch { /* ya murió */ }
    }
  }
  await esperarMuerte(muriendo)
})

describe('login con la base caída (next start real)', () => {
  it('POST /api/auth/login responde 503 con JSON legible, no un 500 vacío', async () => {
    const r = await fetch(`${BASE}/api/auth/login/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.31.0.1' },
      body: JSON.stringify({ email: 'nadie@ejemplo.mx', password: 'lo-que-sea' }),
      redirect: 'manual',
    })
    const texto = await r.text()
    expect(r.status).toBe(503)
    expect(r.headers.get('content-type') ?? '').toMatch(/application\/json/)
    expect(JSON.parse(texto)).toEqual({ error: MENSAJE })
    // Nada de la conexión llega al navegador.
    expect(texto).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|spaces_app|spaces_sin_base/)
  })

  it('GET /api/auth/me con una cookie de sesión responde 503 con JSON', async () => {
    const r = await fetch(`${BASE}/api/auth/me/`, {
      headers: { cookie: 'spaces_sesion=token-cualquiera' },
      redirect: 'manual',
    })
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual({ error: MENSAJE })
  })

  it('y lo que no toca la base sigue igual: /api/auth/metodos da 200', async () => {
    const r = await fetch(`${BASE}/api/auth/metodos/`)
    expect(r.status).toBe(200)
  })
})

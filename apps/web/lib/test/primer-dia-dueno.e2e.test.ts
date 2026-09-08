import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'
import {
  arrancarDoble,
  pararDoble,
  prepararIdToken,
  idTokenFalso,
  claimsBuenos,
} from './doble-google'

// ============================================================================
//  El primer día del Dueño de una instancia nueva.  (ADR 0028 · B5)
// ----------------------------------------------------------------------------
//  Esta prueba no ejercita una pieza: ejercita la CADENA, que es lo único que
//  nadie había medido. Cada eslabón tiene su prueba propia; que existan los seis
//  no demuestra que se puedan recorrer seguidos, y B5 pedía exactamente eso
//  antes de encender el candado por omisión.
//
//  La condición que la hace realista: desde `20260828_reautenticacion_por_defecto.sql`
//  el DEFAULT de `tenants.exigir_reautenticacion` es `true`, así que una
//  organización recién nacida **exige la contraseña para los cambios de dinero**.
//  Y desde B3 el Dueño puede tener cerrada la entrada por contraseña. Si la
//  cadena estuviera rota, el Dueño de cada instancia nueva entraría con Google y
//  **no podría facturar nunca** — y eso no se ve probando las piezas por
//  separado, porque cada una pasa.
//
//  El recorrido, en el orden en que le ocurre a una persona:
//
//    1. entra con Google (única puerta: `solo_google`)
//    2. el cerrojo de B2 lo manda a guardar sus códigos
//    3. fija su primera contraseña sin teclear la temporal (ADR 0018)
//    4. desbloquea los cambios con ESA contraseña
//    5. y el cambio de dinero pasa
//
//  ─── Y esto lo encontró esta prueba: son DOS cerrojos, no uno ─────────────
//  `exigir()` corta por la contraseña temporal en `auth.ts:204` y por los
//  códigos en `:230`, **en ese orden**. El `AuthGate` de la interfaz lleva al
//  usuario en el orden contrario: primero los códigos. No es un fallo —las dos
//  pantallas están exentas del guard a propósito, así que ninguna se bloquea a
//  sí misma— pero significa que confirmar los códigos NO abre la aplicación:
//  sigue cerrada, ahora por la otra razón. Aquí se comprueban las dos, porque
//  esperar un 200 a mitad de camino habría dado un rojo que no señala nada.
//
//  El eslabón 4 es el que más fácil se rompe sin avisar: la contraseña que el
//  operador generó en el alta NO la conoce el Dueño, así que si el paso 3 no
//  funcionara, el 4 le pediría algo que nadie tiene.
// ============================================================================

const MIA = 'LaMiaQueSiSe123'

let org: Awaited<ReturnType<typeof sembrarTenant>>

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('primerdia')
  await arrancarDoble()
  await arrancarServidor()
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await pararDoble()
  await cerrarPool()
})

/** Deja al Dueño exactamente como lo deja el alta de una instancia. */
async function comoLoDejaElAlta() {
  await poolTest().query(
    `update usuarios
        set debe_cambiar_password = true,
            codigos_vistos_en = null,
            solo_google = true,
            activo = true
      where lower(email) = lower($1)`,
    [org.usuarioEmail],
  )
  await poolTest().query(`delete from identidades_externas`)
  await poolTest().query(`delete from codigos_recuperacion`)
}

async function entrarConGoogle(): Promise<Cliente> {
  const c = new Cliente()
  const r0 = await c.pedir('/api/auth/google/inicio/')
  const destino = new URL(r0.ubicacion!)
  const state = destino.searchParams.get('state')!
  const nonce = destino.searchParams.get('nonce')!
  prepararIdToken(idTokenFalso(claimsBuenos({ sub: 'sub-primerdia', email: org.usuarioEmail, nonce })))
  const r = await c.pedir(`/api/auth/google/callback/?code=codigo-bueno&state=${encodeURIComponent(state)}`)
  expect(new URL(r.ubicacion!).searchParams.get('google')).toBeNull()
  expect(c.tieneCookie('spaces_sesion')).toBe(true)
  return c
}

/** Un cambio de DINERO: a dónde se le paga la renta al arrendador. */
async function cambioDeDinero(c: Cliente) {
  // El id es inventado a propósito. `exigirCambioSensible` corre ANTES de buscar
  // la fila (`arrendadores/[id]/route.ts:35`), así que esto interroga al candado
  // sin necesitar datos sembrados — y la respuesta distingue con nitidez: 403
  // con `requiereDesbloqueo` es el candado; cualquier otra cosa es que pasó.
  return c.pedir('/api/arrendadores/00000000-0000-0000-0000-000000000000/', {
    metodo: 'PATCH',
    cuerpo: { cuentaBancaria: '0000000000' },
  })
}

describe('el primer día del Dueño, de punta a punta', () => {
  it('una organización recién nacida exige la contraseña para los cambios', async () => {
    // Es la premisa de todo lo demás. Si el default se hubiera quedado en
    // `false`, esta prueba pasaría en verde midiendo un candado abierto.
    const r = await poolTest().query('select exigir_reautenticacion as e from tenants where id = $1', [
      org.id,
    ])
    expect(r.rows[0].e).toBe(true)
  })

  it('recorre los cinco pasos y acaba pudiendo tocar el dinero', async () => {
    await comoLoDejaElAlta()

    // ── 1. Entra con Google ────────────────────────────────────────────────
    const c = await entrarConGoogle()

    // ── 2. El cerrojo de B2 lo tiene cortado hasta que guarde sus códigos ──
    const cortado = await c.pedir('/api/estado/')
    expect(cortado.status).toBe(403)

    const lote = await c.pedir('/api/perfil/codigos-recuperacion/', { cuerpo: {} })
    expect(lote.status).toBe(201)
    expect(lote.datos.codigos).toHaveLength(10)
    await c.pedir('/api/perfil/codigos-recuperacion/?ya=1', { cuerpo: {} })

    // Confirmar los códigos NO abre la aplicación: queda el otro cerrojo, el de
    // la contraseña temporal. Se comprueba por el MENSAJE y no solo por el 403,
    // porque los dos cerrojos devuelven 403 y confundirlos dejaría esta prueba
    // en verde con el de los códigos todavía cerrado.
    const aunCerrado = await c.pedir('/api/estado/')
    expect(aunCerrado.status).toBe(403)
    expect(aunCerrado.datos.error).toContain('temporal')

    // ── 3. Fija su primera contraseña SIN teclear la temporal (ADR 0018) ───
    // Este es el eslabón que sostiene todo: la contraseña que generó el
    // operador del alta el Dueño no la conoce, y con `solo_google` tampoco le
    // sirve para entrar. Sin esta excepción, el paso 4 le pediría algo que no
    // existe para él.
    const fijar = await c.pedir('/api/perfil/', { metodo: 'PATCH', cuerpo: { password: MIA } })
    expect(fijar.status).toBe(200)

    // Con los dos cerrojos abiertos, la aplicación por fin responde.
    expect((await c.pedir('/api/estado/')).status).toBe(200)

    // ── El candado de dinero está PUESTO, y esto es lo que hay que ver ─────
    // Se sondea AQUÍ y no antes, y eso lo enseñó un rojo: puesto antes de fijar
    // la contraseña, el 403 que devolvía era del cerrojo de la temporal —el
    // guard de rol corre primero (`arrendadores/[id]/route.ts:19`)— y no traía
    // `requiereDesbloqueo`. O sea que la prueba habría estado midiendo el
    // cerrojo equivocado y dando por cerrado un candado que no había tocado.
    //
    // Sin esta comprobación, el paso 5 podría estar en verde porque el candado
    // de cambios nunca cerró.
    const antes = await cambioDeDinero(c)
    expect(antes.status).toBe(403)
    expect(antes.datos.requiereDesbloqueo).toBe(true)

    // ── 4. Desbloquea los cambios con ESA contraseña ───────────────────────
    const desbloqueo = await c.pedir('/api/cambios/desbloquear/', { cuerpo: { password: MIA } })
    expect(desbloqueo.status).toBe(200)

    // ── 5. Y el cambio de dinero ya no choca contra el candado ─────────────
    const despues = await cambioDeDinero(c)
    expect(despues.datos?.requiereDesbloqueo).toBeUndefined()
    expect(despues.status).not.toBe(403)
  })

  it('y la contraseña que fijó SIGUE sin abrirle la puerta, porque el candado de B3 no se movió', async () => {
    // Fijar la primera contraseña es para CAMBIAR cosas, no para ENTRAR. Son las
    // dos preguntas del ADR 0028, y confundirlas aquí devolvería en silencio la
    // puerta que B3 cerró.
    const r = await fetch(`${BASE}/api/auth/login/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.11.0.9' },
      body: JSON.stringify({ email: org.usuarioEmail, password: MIA }),
      redirect: 'manual',
    })
    expect(r.status).toBe(403)
  })
})

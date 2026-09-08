import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'

// ============================================================================
//  Regenerar los códigos: la misma ruta, dos operaciones distintas.  (B6)
// ----------------------------------------------------------------------------
//  `POST /api/perfil/codigos-recuperacion` hace dos cosas según quién llame:
//
//   · Si el usuario NO ha confirmado ningún lote todavía, es la SALIDA del
//     cerrojo de B2. No pide nada, porque pedirle la contraseña lo encerraría —
//     con el ADR 0028 puede ser alguien que entró con Google y no tiene ninguna.
//   · Si YA confirmó uno, es un CAMBIO: invalida en silencio los códigos que su
//     dueño tiene guardados en papel. Pide la contraseña.
//
//  La prueba que manda sobre todas las demás es la tercera: **un intento
//  rechazado no puede haber borrado nada**. Un 403 que ya destruyó el lote sería
//  peor que no tener candado — el atacante no entra, y el dueño se queda fuera
//  igualmente. Ese es el orden que se está verificando aquí, no el mensaje.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('regenerar')
  await arrancarServidor()
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

let ip = 90

/** Deja al Dueño como si nunca hubiera confirmado códigos. */
async function sinConfirmar() {
  await poolTest().query(
    `update usuarios set codigos_vistos_en = null where lower(email) = lower($1)`,
    [org.usuarioEmail],
  )
}

async function entrarConCodigo(codigo: string) {
  const r = await fetch(`${BASE}/api/auth/codigo/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${ip++}` },
    body: JSON.stringify({ codigo }),
    redirect: 'manual',
  })
  return r.status
}

/** Entra, pide el primer lote y lo confirma. Deja al usuario "con códigos". */
async function conLoteConfirmado(): Promise<{ cliente: Cliente; codigos: string[] }> {
  await sinConfirmar()
  const cliente = new Cliente()
  await cliente.entrar(org.usuarioEmail, PASSWORD_DEMO)
  const r = await cliente.pedir('/api/perfil/codigos-recuperacion/', { cuerpo: {} })
  await cliente.pedir('/api/perfil/codigos-recuperacion/?ya=1', { cuerpo: {} })
  return { cliente, codigos: r.datos.codigos as string[] }
}

describe('regenerar los códigos de recuperación', () => {
  it('el PRIMER lote no pide contraseña: es la salida del cerrojo', async () => {
    // Si esto pidiera contraseña, un Dueño que entró con Google y todavía no
    // tiene ninguna quedaría encerrado: cortado por no tener códigos, y sin
    // forma de conseguirlos.
    await sinConfirmar()
    const c = new Cliente()
    await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/perfil/codigos-recuperacion/', { cuerpo: {} })
    expect(r.status).toBe(201)
    expect(r.datos.codigos).toHaveLength(10)
  })

  it('pedir OTRO lote sin teclear la contraseña se rechaza', async () => {
    const { cliente } = await conLoteConfirmado()
    const r = await cliente.pedir('/api/perfil/codigos-recuperacion/', { cuerpo: {} })
    expect(r.status).toBe(403)
    // La marca que hace que la pantalla pida la contraseña en vez de enseñar un
    // error rojo. Sin ella el usuario ve un "prohibido" sin salida.
    expect(r.datos.requiereDesbloqueo).toBe(true)
  })

  it('y ese rechazo NO destruye los códigos que ya tenía', async () => {
    // La que manda. Si el borrado ocurriera antes del guard, un 403 dejaría al
    // dueño sin códigos válidos y sin saberlo: la peor combinación posible.
    const { cliente, codigos } = await conLoteConfirmado()
    expect((await cliente.pedir('/api/perfil/codigos-recuperacion/', { cuerpo: {} })).status).toBe(403)
    expect(await entrarConCodigo(codigos[0])).toBe(200)
  })

  it('con la contraseña tecleada sí regenera, y los viejos dejan de valer', async () => {
    const { cliente, codigos } = await conLoteConfirmado()

    const d = await cliente.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
    expect(d.status).toBe(200)

    const r = await cliente.pedir('/api/perfil/codigos-recuperacion/', { cuerpo: {} })
    expect(r.status).toBe(201)
    const nuevos = r.datos.codigos as string[]
    expect(nuevos).toHaveLength(10)

    // Prueba negativa de B6: los anteriores mueren. Sin esto, "regenerar" sería
    // "añadir", y una lista filtrada seguiría abriendo la cuenta para siempre.
    expect(await entrarConCodigo(codigos[1])).toBe(401)
    expect(await entrarConCodigo(nuevos[0])).toBe(200)
  })

  it('con la contraseña EQUIVOCADA no regenera nada', async () => {
    const { cliente, codigos } = await conLoteConfirmado()
    const d = await cliente.pedir('/api/cambios/desbloquear/', { cuerpo: { password: 'NoEsLaMia123' } })
    expect(d.status).toBe(403)
    expect((await cliente.pedir('/api/perfil/codigos-recuperacion/', { cuerpo: {} })).status).toBe(403)
    expect(await entrarConCodigo(codigos[2])).toBe(200)
  })

  it('queda anotado en la bitácora, y sin los códigos dentro', async () => {
    // Regenerar es lo primero que haría quien se llevara una sesión abierta. El
    // dueño legítimo tiene que poder reconocer el "yo no hice eso" — y el
    // registro NO puede contener el secreto que acaba de emitirse.
    const { cliente } = await conLoteConfirmado()
    await cliente.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
    const r = await cliente.pedir('/api/perfil/codigos-recuperacion/', { cuerpo: {} })
    const nuevos = r.datos.codigos as string[]

    const filas = await poolTest().query(
      `select accion, entidad from acciones where accion ilike '%digos de recuperaci%'`,
    )
    expect(filas.rowCount).toBeGreaterThan(0)
    const texto = JSON.stringify(filas.rows)
    for (const c of nuevos) expect(texto).not.toContain(c)
  })
})

import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { exigirReautenticacionSiempre, respuestaDesbloqueo } from '@/lib/server/cambios'
import {
  actualizarClienteCtrl,
  borrarClienteCtrl,
  PropuestasHuerfanas,
} from '@/lib/server/clientes-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/clientes/[id] → edición de cliente / datos fiscales.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = await req.json().catch(() => ({}))
    const cliente = await actualizarClienteCtrl(params.id, body)
    await registrarAccion(g.usuario, 'Editó cliente', cliente.nombre)
    return NextResponse.json(cliente)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/clientes/[id] → borrado REAL del cliente (CRUD-01).
//
// La auditoría del 2026-08-26 dejó diez clientes de prueba que nadie podía
// quitar: este archivo solo exportaba PATCH. Se borra la fila de verdad, no se
// archiva; lo que la base no permita se responde 409 diciendo QUÉ lo impide y
// CUÁNTO hay, nunca un 500 del driver. El detalle de qué bloquea y por qué está
// en `clientes-repo.ts`, sobre `borrarCliente`.
//
// ─── Por qué pide MÁS que crear o editar un cliente ────────────────────────
// Nació con `comercial:crear`, el mismo permiso que el alta y la edición, y se
// dejó anotado que su catálogo espejo era más estricto. Jochelo lo resolvió el
// 2026-08-26: sube a `aprobar` **y con reautenticación**.
//
// La asimetría que lo justifica: borrar un arrendador es un SOFT-delete —la
// fila sigue ahí y se puede revertir— y aun así exige `arrendadores:aprobar`
// más la contraseña. Aquí el borrado es REAL e irreversible. Pedir menos que su
// espejo para hacer algo más grave era exactamente al revés de como debe ser.
//
// ─── Por qué NO se usa `exigirCambioSensible`, que es lo que hace el espejo ──
// Porque no habría pedido la contraseña. `exigirCambioSensible` llama a
// `exigirDesbloqueo()`, y esa función mira el interruptor
// `tenants.exigir_reautenticacion` (`cambios.ts:202`) y **deja pasar sin pedir
// nada si está apagado** — que es como está por defecto y como está en los
// cinco tenants de producción, según el propio comentario de `cambios.ts:214`.
//
// O sea que copiar el espejo habría dado una reautenticación decorativa: el
// código la nombra y el usuario no la ve nunca. Se usa
// `exigirReautenticacionSiempre()`, el mismo camino que restablecer la
// contraseña de un tercero (`usuarios/[id]/restablecer/route.ts:38`), donde ya
// se decidió que hay cosas que no deben depender de un interruptor.
//
// Borrar un cliente de forma irreversible es una de ellas.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  // El permiso primero: no tiene sentido pedirle la contraseña a quien de todas
  // formas no puede borrar.
  const g = await exigir('comercial', 'aprobar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const d = await exigirReautenticacionSiempre()
  if (!d.ok) return respuestaDesbloqueo(d)
  try {
    // Un DELETE normalmente viaja sin cuerpo; el `catch` lo convierte en `{}`.
    // El cuerpo solo transporta la confirmación de las propuestas huérfanas.
    const body = await req.json().catch(() => ({}))
    const cliente = await borrarClienteCtrl(params.id, body)
    // El borrado es irreversible y la tabla `acciones` es append-only: sin esta
    // línea no quedaría rastro de quién se llevó al cliente.
    await registrarAccion(g.usuario, 'Borró cliente', cliente.nombre)
    return NextResponse.json({ ok: true, cliente })
  } catch (e) {
    // El 409 por propuestas huérfanas lleva ADEMÁS `motivo` y la cuenta, porque
    // este caso TIENE salida (reenviar confirmando) y la pantalla necesita
    // distinguirlo del 409 que no la tiene. Mismo contrato que el duplicado del
    // alta en `../route.ts`.
    if (e instanceof PropuestasHuerfanas) {
      return NextResponse.json(
        { error: e.message, motivo: e.motivo, propuestas: e.propuestas },
        { status: e.status },
      )
    }
    return respuestaError(e)
  }
}

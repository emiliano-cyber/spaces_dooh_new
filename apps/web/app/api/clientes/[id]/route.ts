import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
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
// Mismo permiso que el alta y la edición (`comercial:crear`), que es el camino
// que ya protege las demás mutaciones de clientes. Ojo: el borrado de
// arrendadores —el catálogo espejo— es más estricto (`arrendadores:aprobar` y
// además reautenticación con `exigirCambioSensible`) y es un soft-delete. Que
// aquí el borrado sea REAL y pida menos que su espejo es una diferencia
// deliberada de este cambio, no un descuido: está anotada para revisarse.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
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

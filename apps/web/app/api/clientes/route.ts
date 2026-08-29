import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearClienteCtrl } from '@/lib/server/clientes-controller'
import { ClienteDuplicado } from '@/lib/server/clientes-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/clientes → alta de cliente con datos fiscales.
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const cliente = await crearClienteCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Creó cliente', cliente.nombre)
    return NextResponse.json(cliente, { status: 201 })
  } catch (e) {
    // El 409 por duplicado lleva ADEMÁS el cliente que ya estaba (VAL-03). Sin
    // él la pantalla solo puede decir «ya existe» y deja al usuario buscándolo
    // a mano en una lista; con él puede llevarlo hasta su ficha. `motivo`
    // distingue el RFC —que no se puede saltar— del nombre, que sí se puede
    // confirmar. Mismo contrato de respuesta que `/api/arrendadores`, para que
    // la pantalla trate los dos duplicados igual.
    if (e instanceof ClienteDuplicado) {
      return NextResponse.json(
        { error: e.message, motivo: e.motivo, existente: e.existente },
        { status: e.status },
      )
    }
    return respuestaError(e)
  }
}

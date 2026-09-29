import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { aplicarCodigoCtrl, quitarCodigoCtrl } from '@/lib/server/codigos-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/propuestas/:id/codigo — APLICAR o QUITAR un código promocional.
//  ADR 0039, Fase 3.
// ----------------------------------------------------------------------------
//  ⚠️ EL CUERPO LLEVA EL CÓDIGO TECLEADO Y NADA MÁS.
//
//  Ni el porcentaje, ni el importe, ni un «ya validado». El servidor busca el
//  cupón bajo RLS, comprueba la vigencia con `current_date` de Postgres, cuenta
//  los canjes con la fila BLOQUEADA y decide él el porcentaje. Es el invariante
//  número uno de esta fase, y no es una preferencia de estilo: el vencimiento y
//  el tope de usos de un cupón son un reloj y un contador, y **un contador que
//  vive en el navegador no es un contador**.
//
//  El hallazgo B40 dice que la cadena de precio de la Fase 1 sí vive entera en
//  el navegador. Esta fase no lo arregla —es la decisión D11, del dueño— pero
//  tampoco lo amplía.
//
//  ─── POR QUÉ ES UNA RUTA APARTE Y NO UN CAMPO DEL PATCH DE LA PROPUESTA ───
//  Porque canjear es una TRANSACCIÓN con un bloqueo dentro, y meterla en el
//  PATCH general la mezclaría con el guardado del nombre y las notas. Un
//  guardado de notas que se queda esperando el bloqueo de un cupón —o que gasta
//  un uso sin querer— es exactamente la clase de acoplamiento que después nadie
//  encuentra. Aparte, además, el registro de Actividad puede decir qué pasó.
//
//  ─── EL PERMISO ES `comercial.crear`, Y NO EL DE ADMINISTRACIÓN ───────────
//  Aplicar un cupón es parte de vender. CREARLO es otra cosa y vive en
//  `/api/codigos-promocionales`, con `exigirCambioSensible('inventario', …)`.
//  Si fueran el mismo permiso, quien vende podría crearse su propio cupón del
//  50 % y aplicárselo — y el cupón dejaría de ser una decisión del dueño.
// ============================================================================

// POST → aplica el código. Cuenta un canje EN ESE MOMENTO, no al aprobar.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const r = await aplicarCodigoCtrl(params.id, await req.json().catch(() => ({})))
    // La bitácora DICE EL CÓDIGO Y EL PORCENTAJE. Un «aplicó un código» pelado
    // no permitiría explicar seis meses después por qué esa venta salió más
    // barata; es el mismo criterio con el que TOPE-02 escribe el descuento.
    await registrarAccion(
      g.usuario,
      'Aplicó un código promocional a la propuesta',
      `${r.codigo}: ${r.descuentoPct} %`,
    )
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE → quita el código y DEVUELVE EL USO al cupón.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const r = await quitarCodigoCtrl(params.id)
    await registrarAccion(g.usuario, 'Quitó el código promocional de la propuesta', params.id)
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}

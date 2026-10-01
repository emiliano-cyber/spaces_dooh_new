import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { decidirCodigoCtrl } from '@/lib/server/codigos-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/propuestas/:id/codigo/decision — APROBAR o RECHAZAR el cupón
//  PENDIENTE de una propuesta.  COD-03, decisión 3 del dueño (2026-09-30):
//  «si se asigna, no se muestra al cliente hasta que un admin o gerente lo
//  apruebe».
// ----------------------------------------------------------------------------
//  ─── EL PERMISO ES `comercial.aprobar`, Y NO `comercial.crear` ───────────
//  `comercial.crear` lo tiene el VENDEDOR, que es quien aplica el cupón; si
//  decidir pidiera lo mismo, el vendedor se aprobaría su propio cupón y la
//  aprobación no serviría de nada. `comercial.aprobar` lo tienen DUENO,
//  ADMINISTRADOR, DIRECTOR_COMERCIAL y GERENTE_VENTAS — «los cuatro», en
//  palabras del dueño—. Se usa el permiso que ya existe, sin inventar uno: la
//  matriz de Administración sigue mandando y no hace falta migración. Es el
//  mismo criterio que PROG-01 (`/api/campanas/franja-programada`).
//
//  ─── POR QUÉ NO PIDE LA CONTRASEÑA (`exigirCambioSensible`) ──────────────
//  Crear el cupón sí la pide: es decidir cuánto se regala y a cuánta gente.
//  Aprobarlo es decidir si ESTA venta lo lleva, sobre un cupón que ya autorizó
//  el dueño al crearlo. Es la misma frontera que aprobar la propuesta, que
//  tampoco la pide.
//
//  El cuerpo es `{ decision: 'APROBAR' }` o `{ decision: 'RECHAZAR', motivo }`,
//  con `.strict()` (ver `decisionSchema` en `codigos-controller.ts`). La línea
//  de Actividad la escribe el repo DENTRO de la transacción, con el motivo.
// ============================================================================

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'aprobar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const r = await decidirCodigoCtrl(params.id, await req.json().catch(() => ({})))
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}

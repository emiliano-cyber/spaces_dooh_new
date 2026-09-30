import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { marcarPuntoChecklistCtrl } from '@/lib/server/ot-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  PATCH /api/ot/:id/checklist  { indice, label, hecho }        OT-CHECK-01
// ----------------------------------------------------------------------------
//  Marca o desmarca UN punto del checklist, en el momento del clic (pedido del
//  dueño, 2026-09-30). Antes el checklist solo existía en la pantalla y se
//  perdía al recargar.
//
//  ─── EL PERMISO ES `operaciones.crear`, EL MISMO QUE CERRAR ───────────────
//  Tachar el checklist es parte del trabajo de campo, igual que cerrar la OT
//  con la foto (`POST /api/ot/:id/cerrar`). Quien solo tiene `operaciones.ver`
//  —FINANZAS, IMPRENTA— ve la OT y no marca. `GET /api/ot/:id` devuelve
//  `puedeEditar` con este mismo permiso para que la pantalla lo muestre de
//  solo lectura, pero la puerta es ESTA: la pantalla no protege nada.
//
//  ─── SIN CANDADO DE CAMBIOS ───────────────────────────────────────────────
//  No es dinero: no cambia el estado de la OT, no destraba facturación y no
//  toca `costo_real`. Pedir contraseña a la cuadrilla en la calle por tachar
//  una casilla es la fricción que `costo/route.ts` explica por qué se evita.
//
//  ─── SIN BITÁCORA POR CLIC ────────────────────────────────────────────────
//  Cada casilla tachada sería una fila de `acciones`: una OT de tres puntos
//  marcada y corregida llenaría la bitácora de ruido. Lo que la bitácora tiene
//  que poder reconstruir —quién cerró la OT y con qué testigo— lo sigue
//  escribiendo `cerrar`.
// ============================================================================
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('operaciones', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const ot = await marcarPuntoChecklistCtrl(params.id, await req.json().catch(() => undefined))
    return NextResponse.json(ot)
  } catch (e) {
    return respuestaError(e)
  }
}

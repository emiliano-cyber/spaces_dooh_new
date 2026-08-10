import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { archivarTodasNotificaciones } from '@/lib/server/notificaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/notificaciones/archivar-todas → vacía el panel de notificaciones.
//
// Sustituye a `leer-todas`, que solo ponía `leida=true`: el panel lista también
// las leídas, así que aquello dejaba la lista igual de larga y solo se atenuaba.
//
// Archiva, NO borra: la fila se conserva con la fecha. Por eso no exige
// reautenticación ni permiso de módulo, solo sesión — no destruye nada y cada
// quien vacía su propia organización.
export async function POST() {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const archivadas = await archivarTodasNotificaciones()
  return NextResponse.json({ ok: true, archivadas })
}

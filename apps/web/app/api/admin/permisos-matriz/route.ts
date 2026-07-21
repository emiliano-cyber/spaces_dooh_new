import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { matrizPermisosUI } from '@/lib/server/usuarios-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/permisos-matriz → matriz completa para la pestaña de roles:
// módulos (filas), roles (columnas) y celdas, TODO derivado de rol_permisos
// (mismo origen que exigir()). Hardening 1 · Bloque F: la UI ya no lee de una
// copia hardcodeada, así que un cambio en BD se refleja sin desplegar.
export async function GET() {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await matrizPermisosUI())
}

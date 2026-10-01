import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { novedadesDeLaInstancia } from '@/lib/server/novedades'

export const runtime = 'nodejs'
// En tiempo de peticion: la version la sella la imagen en el entorno del
// proceso, igual que en `/api/version`.
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/novedades → { version, notas, novedades }
// ----------------------------------------------------------------------------
//  Las notas de la version INSTALADA (pedido del dueno, 2026-10-01): el
//  dialogo que TODO usuario ve una vez tras una instalacion, y la pagina de
//  Novedades.
//
//  `exigir()` A SECAS, sin modulo, a proposito: lo ve cualquiera con sesion.
//  Colgarlo de un permiso dejaria el dialogo mudo para quien no lo tenga, sin
//  un solo error. Pero CON sesion, siempre: la version que corre la instancia
//  va tras token en `/api/version` (P6), y esta ruta no puede ser la puerta
//  de atras para preguntarla sin entrar.
//
//  Sin controller ni repo: no toca la base ni recibe entrada; todo lo que
//  decide es puro y vive en `lib/novedades.ts`, con sus pruebas.
// ============================================================================
export async function GET() {
  try {
    const g = await exigir()
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
    return NextResponse.json(novedadesDeLaInstancia(), { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return respuestaError(e)
  }
}

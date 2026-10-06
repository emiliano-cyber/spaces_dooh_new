import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import {
  spaceEyeHabilitado,
  esTipoInstalador,
  bajarInstalador,
  INSTALADORES,
} from '@/lib/server/space-eye'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/space-eyes/descarga/<apk|agente-pc|agente-pi|ffmpeg>
// ----------------------------------------------------------------------------
//  Los instaladores de Space Eye, servidos por esta aplicación para que el
//  navegador los baje por HTTPS y no directo de Space Eye por HTTP plano. El
//  porqué completo está junto a `INSTALADORES` en `lib/server/space-eye.ts`.
//
//  El tipo elige una entrada de una lista cerrada; nunca se pega a una ruta.
//  Ver los instaladores es parte de consultar el inventario, como en
//  `/api/space-eyes/alta` sin el testigo.
// ============================================================================

type Ctx = { params: { tipo: string } }

export async function GET(_req: Request, { params }: Ctx) {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  if (!esTipoInstalador(params.tipo)) {
    return NextResponse.json({ error: 'Instalador desconocido' }, { status: 404 })
  }
  if (!spaceEyeHabilitado()) {
    return NextResponse.json({ error: 'La integración con Space Eye no está configurada' }, { status: 503 })
  }

  try {
    const r = await bajarInstalador(params.tipo)
    if (!r.ok || !r.body) {
      // El código de Space Eye tal cual: «no publicado» es un 404 suyo, no un
      // error nuestro.
      return NextResponse.json({ error: 'Space Eye no tiene ese instalador' }, { status: r.ok ? 502 : r.status })
    }
    const salida = new Headers({
      'Content-Type': r.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${INSTALADORES[params.tipo].archivo}"`,
      'Cache-Control': 'no-store',
    })
    const largo = r.headers.get('content-length')
    if (largo) salida.set('Content-Length', largo)
    return new Response(r.body, { status: 200, headers: salida })
  } catch {
    return NextResponse.json({ error: 'No se pudo hablar con Space Eye' }, { status: 502 })
  }
}

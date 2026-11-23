import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { NAV } from '@/components/demo/shell/nav'
import { idiomaDeLaPeticion } from '@/lib/i18n/servidor'
import { reporteDeCampanasDetectadas } from '@/lib/server/space-eyes-reporte-controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/space-eyes/campanas/excel?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
//                                    &equipo=<id>&campana=<id>
// ----------------------------------------------------------------------------
//  El reporte en Excel de las campañas que Space Eye detectó al aire, con fecha
//  y hora de cada detección (pedido del dueño, 19/11/2026). Todo el porqué está
//  en `lib/server/space-eyes-reporte-controller.ts`.
//
//  QUIÉN. Dos llaves, las dos necesarias:
//    · `inventario.ver`, el permiso de TODO Space Eyes en el servidor (ver
//      `app/api/space-eyes/route.ts`): quien no lo tiene no mira las cámaras;
//    · y los roles de la entrada «Space Eyes → Campañas» del menú (hoy Dueño,
//      Administrador y venta). Hace falta porque `inventario.ver` lo tienen
//      también roles que NO ven esa pantalla (Operaciones, por ejemplo), y un
//      reporte no puede llegar a quien no ve la pantalla que lo ofrece. Se lee
//      de `NAV` y no se copia: si mañana la entrada cambia de roles, la
//      descarga cambia con ella.
// ============================================================================

const ENTRADA = NAV.find((n) => n.key === 'space-eyes-campanas')

export async function GET(req: Request) {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!ENTRADA || !(ENTRADA.roles as string[]).includes(g.usuario.rol)) {
    return NextResponse.json({ error: 'Tu rol no tiene acceso a Space Eyes → Campañas' }, { status: 403 })
  }

  const url = new URL(req.url)
  const r = await reporteDeCampanasDetectadas({
    desde: url.searchParams.get('desde'),
    hasta: url.searchParams.get('hasta'),
    equipo: url.searchParams.get('equipo'),
    campana: url.searchParams.get('campana'),
    idioma: idiomaDeLaPeticion(),
  })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })

  return new Response(r.bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${r.nombre}"`,
      'Content-Length': String(r.bytes.byteLength),
      'Cache-Control': 'no-store',
    },
  })
}

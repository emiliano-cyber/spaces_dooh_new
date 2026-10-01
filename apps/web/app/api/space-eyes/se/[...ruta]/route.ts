import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { spaceEyeHabilitado, reenviarASpaceEye } from '@/lib/server/space-eye'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/space-eyes/se/<ruta de Space Eye> — la puerta del módulo completo.
// ----------------------------------------------------------------------------
//  Desde el ADR 0041 cada instancia tiene SU Space Eye en el mismo droplet, y
//  SPACE OS es su único panel: equipos, galería, gráficas, marca de las fotos,
//  programación, campañas, verificación y fallas. En vez de una ruta por cada
//  una de las ~40 operaciones del panel, esta puerta reenvía a Space Eye con la
//  llave de la instancia.
//
//  QUIÉN PUEDE: mirar (GET) pide `inventario.ver`; cambiar algo (POST, PUT,
//  DELETE) pide `inventario.crear`. La empresa la pone la llave, no el
//  navegador: Space Eye solo contesta por los equipos de su dueño.
//
//  QUÉ NO PASA: solo rutas de la lista de abajo. Usuarios y llaves de Space Eye
//  quedan fuera aquí y también en Space Eye.
// ============================================================================

const PERMITIDAS = [
  /^devices(\/\d+(\/(command|logs|telemetry(\/export)?|camera|overlay|stream-rotation|stream-status|pantalla|salud|creativos(\/reaprender)?))?)?$/,
  /^photos(\/\d+)?$/,
  /^fallas(\/\d+)?$/,
  /^creativos\/\d+$/,
  /^schedules(\/\d+)?$/,
  /^campaigns(\/\d+(\/creative)?)?$/,
  /^verifications$/,
  /^capture$/,
  /^ice-servers$/,
  /^app\/version$/,
]

async function puerta(req: Request, ruta: string[]) {
  const lee = req.method === 'GET' || req.method === 'HEAD'
  const g = await exigir('inventario', lee ? 'ver' : 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!spaceEyeHabilitado()) {
    return NextResponse.json({ error: 'La integración con Space Eye no está configurada' }, { status: 503 })
  }
  const camino = ruta.join('/')
  if (!PERMITIDAS.some((r) => r.test(camino))) {
    return NextResponse.json({ error: 'Ruta de Space Eye no permitida' }, { status: 404 })
  }
  try {
    return await reenviarASpaceEye(req, camino)
  } catch {
    return NextResponse.json({ error: 'No se pudo hablar con Space Eye' }, { status: 502 })
  }
}

type Ctx = { params: { ruta: string[] } }
export const GET = (req: Request, { params }: Ctx) => puerta(req, params.ruta)
export const POST = (req: Request, { params }: Ctx) => puerta(req, params.ruta)
export const PUT = (req: Request, { params }: Ctx) => puerta(req, params.ruta)
export const DELETE = (req: Request, { params }: Ctx) => puerta(req, params.ruta)

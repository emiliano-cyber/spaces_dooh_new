import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { spaceEyeHabilitado, reenviarASpaceEye } from '@/lib/server/space-eye'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/space-eyes/se/<ruta de Space Eye> — la puerta del módulo completo.
// ----------------------------------------------------------------------------
//  Desde el ADR 0045 cada instancia tiene SU Space Eye en el mismo droplet, y
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
  /^devices(\/\d+(\/(command|logs|telemetry(\/export)?|camera|overlay|stream-rotation|stream-status|camera-control|pantalla|salud|creativos(\/reaprender)?))?)?$/,
  /^photos(\/\d+)?$/,
  /^fallas(\/\d+)?$/,
  /^creativos\/\d+$/,
  /^schedules(\/\d+)?$/,
  /^campaigns(\/\d+(\/creative)?)?$/,
  /^verifications$/,
  /^capture$/,
  /^ice-servers$/,
  /^app\/version$/,
  // Codigos de vinculacion de equipos nuevos (Agregar dispositivo).
  /^vinculaciones(\/[A-Za-z0-9-]{8,9})?$/,
]

// ─── Las órdenes a un equipo (revisión del 06/10) ───────────────────────────
//
// `devices/<id>/command` reenviaba el cuerpo tal cual, así que el TIPO de orden
// lo elegía el navegador. El botón «Reiniciar equipo» solo aparece para una
// Raspberry, pero eso lo decide la pantalla: el servidor dejaba pasar cualquier
// orden que Space Eye entendiera, a cualquier equipo, sin dejar rastro.
//
// Pasan solo las que la interfaz manda de verdad. Una nueva entra AQUÍ, a
// propósito y con su prueba (`space-eyes-ordenes.test.ts`), no por accidente.
const ORDENES = new Set(['TAKE_PHOTO', 'START_STREAM', 'STOP_STREAM', 'REBOOT_APP', 'UPDATE_APP', 'REBOOT_DEVICE'])

// Las que dejan un equipo SIN SERVICIO un rato. Quedan en la bitácora con quién
// y a qué equipo, como «Pidió una foto»: un espectacular que deja de reportar a
// las tres de la tarde tiene que poder explicarse. La foto y el vivo no, porque
// son de todos los días y ahogarían lo que importa.
const ACCION_DE_ORDEN: Record<string, string> = {
  REBOOT_DEVICE: 'Reinició un equipo de Space Eyes',
  REBOOT_APP: 'Reinició la app de un equipo de Space Eyes',
  UPDATE_APP: 'Actualizó la app de un equipo de Space Eyes',
}

const ES_ORDEN = /^devices\/(\d+)\/command$/

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
  const orden = req.method === 'POST' ? ES_ORDEN.exec(camino) : null
  let cuerpo: ArrayBuffer | undefined
  let tipo: string | null = null
  if (orden) {
    cuerpo = await req.arrayBuffer()
    try {
      const datos = JSON.parse(new TextDecoder().decode(cuerpo)) as { command_type?: unknown }
      tipo = typeof datos?.command_type === 'string' ? datos.command_type : null
    } catch {
      tipo = null
    }
    if (!tipo || !ORDENES.has(tipo)) {
      return NextResponse.json({ error: 'Orden no permitida para un equipo' }, { status: 400 })
    }
  }
  try {
    const r = await reenviarASpaceEye(req, camino, g.usuario.email, cuerpo)
    // Solo se registra lo que Space Eye ACEPTÓ: una orden rechazada no reinició
    // nada, y apuntarla como hecha sería mentir en la bitácora.
    if (orden && tipo && r.ok && ACCION_DE_ORDEN[tipo]) {
      await registrarAccion(g.usuario, ACCION_DE_ORDEN[tipo], `equipo ${orden[1]}`)
    }
    return r
  } catch {
    return NextResponse.json({ error: 'No se pudo hablar con Space Eye' }, { status: 502 })
  }
}

type Ctx = { params: { ruta: string[] } }
export const GET = (req: Request, { params }: Ctx) => puerta(req, params.ruta)
export const POST = (req: Request, { params }: Ctx) => puerta(req, params.ruta)
export const PUT = (req: Request, { params }: Ctx) => puerta(req, params.ruta)
export const DELETE = (req: Request, { params }: Ctx) => puerta(req, params.ruta)

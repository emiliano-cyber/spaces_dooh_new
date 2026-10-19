import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { spaceEyeHabilitado, reenviarASpaceEye } from '@/lib/server/space-eye'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { puedeEncuadrar } from '@/lib/roles'

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
//  Y el ENCUADRE, además, solo el Dueño (ver `ENCUADRE` más abajo).
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

// ─── El encuadre, solo del Dueño (19/10/2026) ───────────────────────────────
//
// Lo que estas cuatro rutas escriben es lo que la cámara VE: el lente y el zoom
// y el recorte (`camera`), el color y el enfoque que se dejan desde el visor
// —que NO son temporales: se guardan en `camera_ajustes` y viajan en cada foto—
// (`camera-control`), la orientación fija (`stream-rotation`) y las cuatro
// esquinas con las que se marca la pantalla (`pantalla`).
//
// Hasta hoy bastaba `inventario.crear`, que tienen el Dueño, el ADMINISTRADOR y
// OPERACIONES. Resultado medido en G500 el 19-oct: el encuadre torcido en tres
// pantallas porque varias personas movieron el zoom desde el visor. No es un
// ajuste de vista: el catálogo de creativos que el equipo aprendió vale para UN
// encuadre y al cambiarlo se tira entero, así que el sitio pasa un día sin
// reconocer nada — y si la pantalla queda más chica dentro de la foto, deja de
// reconocer para siempre (AUTOPISTA: 14 % de la foto, reconoce 1 de 16).
//
// El porqué y el quién viven en `lib/roles.ts` (`puedeEncuadrar`), con pruebas.
// Aquí solo se dice QUÉ rutas son. Space Eye lo exige además por su lado
// (`requireRole('admin')`): esta puerta le habla con la llave de la instancia,
// que es de admin, así que si esta regla no estuviera, Space Eye no la salvaría.
const ENCUADRE = /^devices\/\d+\/(camera|camera-control|stream-rotation|pantalla)$/

// Quién tocó el encuadre de qué equipo. Va a la bitácora como los reinicios, y
// por el mismo motivo: el día que una pantalla deje de reconocer creativos, lo
// primero que hay que poder contestar es quién la movió y cuándo.
const ES_ENCUADRE_DE = /^devices\/(\d+)\//

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
  // El encuadre, solo el Dueño. Se mira DESPUÉS de la lista de rutas (para no
  // decir «no tienes permiso» de algo que ni existe) y antes de hablar con
  // Space Eye. Los GET quedan fuera: mirar el encuadre no lo mueve.
  const encuadre = !lee && ENCUADRE.test(camino)
  if (encuadre && !puedeEncuadrar(g.usuario.rol)) {
    return NextResponse.json(
      {
        error:
          'Solo el Dueño puede cambiar el encuadre de un equipo (lente, zoom, color, ' +
          'orientación y las esquinas de la pantalla): moverlo borra lo que el equipo ' +
          'aprendió y lo deja un día sin reconocer los creativos.',
      },
      { status: 403 },
    )
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
    if (encuadre && r.ok) {
      await registrarAccion(
        g.usuario,
        'Cambió el encuadre de un equipo de Space Eyes',
        `equipo ${ES_ENCUADRE_DE.exec(camino)?.[1] ?? '?'}`,
      )
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

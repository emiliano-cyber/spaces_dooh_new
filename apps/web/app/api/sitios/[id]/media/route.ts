import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { q1 } from '@/lib/server/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/sitios/:id/media — La galería de la pantalla, bajo demanda.
// ----------------------------------------------------------------------------
//  POR QUÉ EXISTE: las fotos se guardan como data URL base64 dentro de un
//  `text[]`, y `listarSitios()` las metía en `/api/estado`. Medido en
//  producción: 1.0 MB en doce pantallas — y DOS VECES, porque `sitiosRed` es la
//  misma lista otra vez. Se descargaban en cada F5 para pintar una tabla y un
//  mapa que no enseñan ninguna foto; la única pantalla que las usa es la ficha,
//  y solo cuando alguien la abre.
//
//  Devuelve JSON y no bytes, al revés que `/api/creativos/:id/arte`: la galería
//  son VARIAS imágenes y la ficha las maneja como lista de data URLs (así puede
//  reordenarlas y volver a guardarlas sin subirlas de nuevo). Servirlas como
//  archivos sueltos obligaría a una ruta por índice y a cambiar el formato con
//  el que se guardan, que es justo lo que este arreglo NO quiere tocar.
//
//  Permiso `network.ver`: es el mismo con el que la rebanada `sitios` viaja en
//  `/api/estado` (`si('network', listarSitios)`), así que quien tiene la
//  pantalla en su store puede pedir su galería, y nadie más. Pedirle un permiso
//  distinto sería enseñar una ficha cuya galería responde 403.
// ============================================================================

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('network', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  // `q1` y no `qRaw`: `sitios` lleva `tenant_id` y la consulta va bajo el GUC.
  const r = await q1<{ fotos: string[] | null; imagen_promocional: string | null }>(
    'select fotos, imagen_promocional from sitios where id = $1',
    [params.id],
  )
  if (!r) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  return NextResponse.json(
    { fotos: r.fotos ?? [], imagenPromocional: r.imagen_promocional ?? null },
    // Privada y corta: son fotos de un activo detrás de sesión, y la ficha las
    // reescribe al guardar la galería. Un minuto evita la ráfaga de al abrir y
    // cerrar la ficha sin servir nada rancio después de editar.
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  )
}

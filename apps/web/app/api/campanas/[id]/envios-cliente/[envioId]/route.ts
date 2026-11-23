import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { archivoDeEnvio } from '@/lib/server/envios-cliente-repo'
import { aprobarEnvioCtrl, exigirQuienAprueba, rechazarEnvioCtrl } from '@/lib/server/envios-cliente-controller'
import { decodificarDataUrl } from '@/lib/data-url'
import { textoAccionPublicacion } from '@/lib/doohmain-resultado'
import { conteo } from '@/lib/plural'
import { avisarPendientesImpresion } from '@/lib/server/pendientes-creativo-controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ENVIO-CLIENTE (18/11) · un creativo que mandó el cliente desde su liga.
// Las dos con sesión, `comercial.crear` Y `puedeAprobarEnCampana` (Dueño y
// Administrador, la regla de ACT-CAMP): ver el archivo de un cliente y
// decidir sobre él es lo mismo que aprobarlo.

// GET /api/campanas/:id/envios-cliente/:envioId → la imagen, para la vista previa.
export async function GET(_req: Request, { params }: { params: { id: string; envioId: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    exigirQuienAprueba(g.usuario?.rol)
  } catch (e) {
    return respuestaError(e)
  }
  const img = decodificarDataUrl(await archivoDeEnvio(params.id, params.envioId))
  if (!img) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(img.bytes), {
    status: 200,
    headers: {
      'Content-Type': img.tipo,
      // Lo subió alguien de fuera: el mismo blindaje que el arte de un creativo.
      'Content-Security-Policy': "default-src 'none'; img-src data:; sandbox",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}

// POST /api/campanas/:id/envios-cliente/:envioId  { accion: 'aprobar' } | { accion: 'rechazar', motivo? }
export async function POST(req: Request, { params }: { params: { id: string; envioId: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    exigirQuienAprueba(g.usuario?.rol)
    const body = await req.json().catch(() => ({}))
    if (body?.accion === 'aprobar') {
      const r = await aprobarEnvioCtrl(params.id, params.envioId)
      // Solo bitácora. Hasta el 20/11 este texto servía además para DEDUCIR
      // que el creativo era del cliente; desde CREA-ORIGEN el origen se guarda
      // en `creatividades.origen` al crearlo y esta línea ya no decide nada.
      await registrarAccion(g.usuario, 'Aprobó creativo enviado por el cliente', r.creativo.nombre)
      await avisarPendientesImpresion(params.id)
      if (r.autoasignadas > 0) {
        await registrarAccion(
          g.usuario,
          r.soloSuPantalla
            ? 'Se asignó solo a la pantalla que eligió el cliente'
            : `Se asignó automáticamente a ${conteo(r.autoasignadas, 'pantalla')}: los creativos aprobados rotan en partes iguales`,
          r.creativo.nombre,
        )
      }
      if (r.publicacion.tipo === 'publicada') {
        await registrarAccion(
          g.usuario,
          textoAccionPublicacion(r.publicacion.doohmain as Parameters<typeof textoAccionPublicacion>[0], 'reintento'),
          r.campanaNombre,
        )
      }
      // Space Eyes: un creativo aprobado cambia lo que esperan ver los equipos.
      try {
        await (await import('@/lib/server/space-eyes-campanas')).avisarCambioDeCampanas()
      } catch {
        /* sin Space Eyes no hay nada que avisar */
      }
      return NextResponse.json(r)
    }
    if (body?.accion === 'rechazar') {
      const r = await rechazarEnvioCtrl(params.id, params.envioId, body, g.usuario?.nombre ?? 'Sistema')
      await registrarAccion(g.usuario, 'Rechazó creativo enviado por el cliente', r.nombre)
      return NextResponse.json(r)
    }
    return NextResponse.json({ error: 'Falta la acción: aprobar o rechazar' }, { status: 400 })
  } catch (e) {
    return respuestaError(e)
  }
}

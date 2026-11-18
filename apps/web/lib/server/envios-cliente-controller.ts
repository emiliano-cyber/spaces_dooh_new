import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { crearCreatividadCtrl } from './creativos-controller'
import { validarCreatividad, eliminarCreatividad } from './creativos-repo'
import { reintentarPublicacionCtrl } from './campanas-controller'
import { doohmainHabilitado, publicarCampanaEnDoohmain } from './doohmain'
import {
  campanaParaEnvio,
  devolverEnvio,
  rechazarEnvio,
  tomarEnvioPendiente,
} from './envios-cliente-repo'
import { imagenAHtml } from '@/lib/creativo-html'
import { puedeAprobarEnCampana } from '@/lib/roles'

// ============================================================================
//  lib/server/envios-cliente-controller.ts — Aprobar o rechazar, desde la
//  ficha de campaña, el creativo que mandó el cliente (ENVIO-CLIENTE, 18/11).
// ----------------------------------------------------------------------------
//  Pedido del dueño: «solo mandar el archivo para que lo vean los usuarios
//  permitidos, y ellos al aprobarlo se apruebe automáticamente y ahora sí se
//  guarde y se suba el creativo a DOOHmain».
//
//  QUIÉN: la regla de ACT-CAMP (18/11), sin cambiarla — `puedeAprobarEnCampana`,
//  o sea Dueño y Administrador. Se exige aquí, no solo escondiendo los botones:
//  la API se puede llamar sin la ficha.
//
//  APROBAR, en un paso y reusando las piezas de siempre:
//   1. Se TOMA el envío (se borra; un segundo clic ya no lo encuentra).
//   2. `crearCreatividadCtrl` — el alta normal, con sus validaciones.
//   3. `validarCreatividad(id, true)` — la aprobación normal, que hace la
//      autoasignación a las pantallas digitales.
//   4. Publicar: el mismo camino que «Volver a publicar»
//      (`reintentarPublicacionCtrl` + `publicarCampanaEnDoohmain`), y SOLO si
//      la campaña es digital y su publicación ya está aprobada. Si aún no lo
//      está, el creativo entra cuando se apruebe la publicación (que publica
//      todo lo aprobado). Una OOH no va a DOOHmain: su arte queda aprobado
//      para Imprenta.
//  Si 2 o 3 fallan, se deshace (se borra el creativo a medias y se devuelve el
//  envío). Si falla 4, el creativo YA queda aprobado y se dice que falta
//  publicar: el botón «Volver a publicar» de la ficha lo reintenta.
// ============================================================================

export function exigirQuienAprueba(rol: string | null | undefined): void {
  if (!puedeAprobarEnCampana(rol)) {
    throw new AppError('Solo el Dueño o un Administrador pueden revisar los creativos que envía el cliente', 403)
  }
}

export type PublicacionTrasAprobar =
  | { tipo: 'imprenta' }
  | { tipo: 'sin-publicacion' }
  | { tipo: 'apagada' }
  | { tipo: 'publicada'; doohmain: unknown }
  | { tipo: 'fallo'; error: string }

export interface ResultadoAprobacion {
  creativo: { id: string; nombre: string; estatusValidacion: string }
  campanaNombre: string
  autoasignadas: number
  publicacion: PublicacionTrasAprobar
}

export async function aprobarEnvioCtrl(campanaId: string, envioId: string): Promise<ResultadoAprobacion> {
  const camp = await campanaParaEnvio(campanaId)
  if (!camp) throw new AppError('Envío no encontrado', 404)
  const e = await tomarEnvioPendiente(campanaId, envioId)
  if (!e) throw new AppError('Envío no encontrado', 404)

  let creadoId: string | null = null
  let aprobado: Awaited<ReturnType<typeof validarCreatividad>>
  try {
    const crea = await crearCreatividadCtrl({
      campanaId,
      nombre: e.nombreArchivo,
      codigo: imagenAHtml(e.contenido, e.nombreArchivo),
      formato: 'text/html',
      resolucion: e.anchoPx && e.altoPx ? `${e.anchoPx}x${e.altoPx}` : null,
    })
    creadoId = crea.id
    aprobado = await validarCreatividad(crea.id, true)
    if (!aprobado) throw new AppError('No se pudo aprobar el creativo', 500)
  } catch (err) {
    // A medias no se queda nada: ni un creativo pendiente que nadie pidió, ni
    // el envío perdido. El cliente sigue viéndolo «en revisión».
    if (creadoId) await eliminarCreatividad(creadoId).catch(() => {})
    await devolverEnvio(e).catch(() => {})
    throw err
  }

  const digital = camp.tipo === 'DOOH' || camp.tipo === 'HIBRIDA'
  let publicacion: PublicacionTrasAprobar
  if (!digital) publicacion = { tipo: 'imprenta' }
  else if (!camp.publicacionAprobada) publicacion = { tipo: 'sin-publicacion' }
  else if (!doohmainHabilitado()) publicacion = { tipo: 'apagada' }
  else {
    try {
      await reintentarPublicacionCtrl(campanaId)
      publicacion = { tipo: 'publicada', doohmain: await publicarCampanaEnDoohmain(campanaId) }
    } catch (err) {
      publicacion = { tipo: 'fallo', error: err instanceof Error ? err.message : 'Fallo al publicar en DOOHmain' }
    }
  }

  return {
    creativo: { id: aprobado.id, nombre: aprobado.nombre, estatusValidacion: aprobado.estatusValidacion },
    campanaNombre: camp.nombre,
    autoasignadas: (aprobado as { autoasignadas?: number }).autoasignadas ?? 0,
    publicacion,
  }
}

const rechazoSchema = z.object({ motivo: z.string().trim().max(300, 'El motivo es muy largo').nullish() })

export async function rechazarEnvioCtrl(
  campanaId: string,
  envioId: string,
  body: unknown,
  revisor: string,
): Promise<{ nombre: string }> {
  const d = validar(rechazoSchema, body ?? {})
  const nombre = await rechazarEnvio(campanaId, envioId, d.motivo || null, revisor)
  if (!nombre) throw new AppError('Envío no encontrado', 404)
  return { nombre }
}

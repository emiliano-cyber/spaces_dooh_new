import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { leerImprentaVisible, guardarImprentaVisible } from './imprenta-visible-repo'
import { puedeCambiarImprentaVisible } from '@/lib/seguimiento-campana'

// ============================================================================
//  lib/server/imprenta-visible-controller.ts — CONTROLLER del interruptor de la
//  imprenta en la liga del cliente. El permiso del módulo (`comercial`) lo
//  revisa la ruta; aquí va la regla FINA del dueño: solo el vendedor que creó
//  la propuesta o un superior (`puedeCambiarImprentaVisible`).
// ============================================================================

const cuerpo = z.object({ visible: z.boolean({ required_error: 'Indica si la imprenta es visible' }) })

/** Para pintar el interruptor: el valor y si quien mira lo puede mover. */
export async function imprentaVisibleCtrl(propuestaId: string, usuario: { id: string; rol: string }) {
  const e = await leerImprentaVisible(propuestaId)
  if (!e) throw new AppError('Propuesta no encontrada', 404)
  return { imprentaVisible: e.imprentaVisible, puedeCambiar: puedeCambiarImprentaVisible(usuario, e) }
}

export async function cambiarImprentaVisibleCtrl(
  propuestaId: string,
  usuario: { id: string; rol: string },
  body: unknown,
) {
  const d = validar(cuerpo, body ?? {})
  const e = await leerImprentaVisible(propuestaId)
  if (!e) throw new AppError('Propuesta no encontrada', 404)
  if (!puedeCambiarImprentaVisible(usuario, e)) {
    throw new AppError('Solo el vendedor que creó la propuesta o un superior puede mostrar la imprenta al cliente', 403)
  }
  const visible = await guardarImprentaVisible(propuestaId, d.visible)
  if (visible == null) throw new AppError('Propuesta no encontrada', 404)
  return { imprentaVisible: visible, puedeCambiar: true }
}

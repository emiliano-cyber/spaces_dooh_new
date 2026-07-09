import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { esEmailValido } from '@/lib/validacion'
import { crearArrendador, iniciarRenovacion, registrarPagoRenta } from './arrendadores-repo'

// ============================================================================
//  lib/server/arrendadores-controller.ts — Alta de propietarios/arrendadores.
//  Valida nombre (obligatorio), RFC y correo de contacto antes del model.
// ============================================================================

const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i

const crearSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  rfc: z.string().trim().max(13).nullish(),
  telefono: z.string().trim().max(30).nullish(),
  email: z.string().trim().nullish(),
  notas: z.string().trim().nullish(),
})

export async function crearArrendadorCtrl(body: unknown) {
  const d = validar(crearSchema, body)
  if (d.rfc && !RFC_RE.test(d.rfc)) throw new AppError('RFC inválido', 400)
  if (d.email && !esEmailValido(d.email)) throw new AppError('Correo inválido', 400)
  return crearArrendador(d)
}

// Renovación de contrato (acción por id, sin body).
export async function iniciarRenovacionCtrl(id: string) {
  const c = await iniciarRenovacion(id)
  if (!c) throw new AppError('Contrato no encontrado', 404)
  return c
}

// Registro de pago de renta (acción por id, sin body).
export async function registrarPagoRentaCtrl(id: string) {
  const p = await registrarPagoRenta(id)
  if (!p) throw new AppError('Pago no encontrado', 404)
  return p
}

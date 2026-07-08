import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { generarFactura, registrarPagoCobranza, FacturaError } from './finanzas-repo'

// ============================================================================
//  lib/server/finanzas-controller.ts — Capa controller de dinero (facturación
//  y pagos). Valida montos y plazos con zod antes de tocar el model; el backend
//  además acota el abono al saldo pendiente.
// ============================================================================

const pagoSchema = z.object({
  // Abono opcional (>0). Ausente/null = liquidar el saldo completo.
  monto: z.coerce.number().positive('El monto del abono debe ser mayor a 0').nullish(),
})

export async function registrarPagoCtrl(cobranzaId: string, body: unknown) {
  const d = validar(pagoSchema, body ?? {})
  const c = await registrarPagoCobranza(cobranzaId, d.monto ?? null)
  if (!c) throw new AppError('Cobranza no encontrada', 404)
  return c
}

const facturaSchema = z.object({
  plazoDias: z.coerce
    .number()
    .refine((v) => [60, 90, 120].includes(v), 'Plazo inválido (60, 90 o 120 días)')
    .default(90),
})

export async function generarFacturaCtrl(campanaId: string, body: unknown) {
  const d = validar(facturaSchema, body ?? {})
  try {
    return await generarFactura(campanaId, d.plazoDias as 60 | 90 | 120)
  } catch (e) {
    if (e instanceof FacturaError) {
      throw new AppError(e.message, /no encontrada/i.test(e.message) ? 404 : 400)
    }
    throw e
  }
}

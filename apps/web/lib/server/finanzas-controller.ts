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
  // Cobro en parcialidades (opcional; sin esto, cobro único como siempre).
  // Los IMPORTES no se aceptan del cliente: los calcula el servidor a partir del
  // total de la factura. Admitirlos permitiría facturar 100 000 y programar
  // cuotas por 10.
  plan: z
    .object({
      cuotas: z.coerce.number().int().min(2, 'Mínimo 2 cuotas').max(36, 'Máximo 36 cuotas'),
      periodicidad: z.enum(['QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL']),
      primerVencimiento: z.string().min(1, 'Falta la fecha del primer vencimiento'),
    })
    .strict()
    .nullish(),
})

export async function generarFacturaCtrl(campanaId: string, body: unknown) {
  const d = validar(facturaSchema, body ?? {})
  try {
    return await generarFactura(campanaId, d.plazoDias as 60 | 90 | 120, d.plan ?? null)
  } catch (e) {
    if (e instanceof FacturaError) {
      // A-1: "ya tiene factura" (incluida la carrera que rebota en el índice
      // único) es un conflicto de estado → 409, no un 400 de validación.
      const status = /no encontrada/i.test(e.message)
        ? 404
        : /ya tiene factura/i.test(e.message)
          ? 409
          : 400
      throw new AppError(e.message, status)
    }
    throw e
  }
}

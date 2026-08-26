import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { plazosCobranzaDelTenant, plazoPorDefecto } from './config-repo'
import { fechaZod } from './fechas'
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

// «60, 90 o 120» — la enumeración como la diría una persona. El mensaje de
// error tiene que recitar los plazos REALES de la organización: el de antes
// («Plazo inválido (60, 90 o 120 días)») estaba a fuego y le recitaba a quien
// hubiera configurado 45 y 75 tres plazos que no existían en su empresa.
function enumerar(plazos: number[]): string {
  if (plazos.length <= 1) return String(plazos[0] ?? '')
  return `${plazos.slice(0, -1).join(', ')} o ${plazos[plazos.length - 1]}`
}

// El schema se construye POR PETICIÓN porque la lista válida es un dato de la
// organización, no una constante del código (CFG-01). Se le pasan ya
// resueltos: `validar()` es síncrono y la config se lee de la base.
function facturaSchemaDe(plazos: number[]) {
  return z.object({
    plazoDias: z.coerce
      .number()
      .refine((v) => plazos.includes(v), `Plazo inválido (${enumerar(plazos)} días)`)
      .default(plazoPorDefecto(plazos)),
    // Cobro en parcialidades (opcional; sin esto, cobro único como siempre).
    // Ni el NÚMERO DE CUOTAS ni los IMPORTES se aceptan del cliente: los deriva
    // el servidor de la duración de la campaña y del total de la factura.
    // Admitirlos permitiría facturar 100 000 y programar cuotas por 10, o pedir
    // 40 mensualidades en una campaña de dos meses.
    plan: z
      .object({
        periodicidad: z.enum(['QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL']),
        // De esta fecha salen los vencimientos de TODAS las cuotas
        // (`finanzas-repo.ts:238`, `$3::date + i * intervalo`). Con el
        // `z.string().min(1)` de antes, «manana» no daba un 400 sino un error
        // del driver: un 500 sin nada que le diga al usuario que escribio mal.
        primerVencimiento: fechaZod('Falta la fecha del primer vencimiento'),
      })
      .strict()
      .nullish(),
  })
}

export async function generarFacturaCtrl(campanaId: string, body: unknown) {
  // La lista válida sale de la configuración de ESTA organización (CFG-01), por
  // el camino con tenant de config-repo. Se lee ANTES de validar porque el
  // mensaje de error tiene que nombrarla.
  const plazos = await plazosCobranzaDelTenant()
  const d = validar(facturaSchemaDe(plazos), body ?? {})
  try {
    // El cast sigue aquí porque `generarFactura` y `Cobranza.plazoDias` todavía
    // declaran la unión `60 | 90 | 120`, heredada de cuando la lista estaba a
    // fuego. Es solo tipo: el valor ya viene validado contra la configuración,
    // y la columna `cobranzas.plazo_dias` es un `integer` cualquiera. Ensanchar
    // esos tipos toca `finanzas-repo.ts`, `lib/data/types.ts` y
    // `lib/data/estado-api.ts`, que no son de este cambio.
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

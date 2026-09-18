import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { plazosCobranzaDelTenant, plazoPorDefecto } from './config-repo'
import { fechaZod } from './fechas'
import { generarFactura, registrarPagoCobranza, FacturaError } from './finanzas-repo'
import { obtenerEntidad } from './entidades-repo'

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
    // CUAL DE MIS RAZONES SOCIALES EMITE el comprobante. Es lo unico que este
    // campo hace: no toca ningun importe.
    //
    // `nullish` y no `optional`: ausente y `null` significan lo mismo aqui —«sin
    // asignar»— y el servidor NO adivina. La derivacion por roles
    // (`emisorPorOmision`) es una sugerencia de la pantalla; elegirla aqui seria
    // emitir a nombre de una sociedad que nadie eligio, y sin que quedara claro
    // quien lo decidio.
    entidadEmisoraId: z
      .string()
      .uuid('La razon social emisora no es un identificador valido')
      .nullish(),
  })
    // `.strict()` PUESTO, y es un endurecimiento deliberado: esto emite dinero.
    // Sin el, un campo desconocido —un `subtotal` o un `monto` colado en el
    // cuerpo— se ignoraba EN SILENCIO, y quien lo mandara creeria que se aplico.
    // Los importes se derivan en el servidor desde el presupuesto de la campana
    // y la tasa del cliente, y ahora un intento de mandarlos se rechaza con 400
    // en vez de pasar desapercibido.
    .strict()
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
    // La entidad emisora se valida CONTRA EL TENANT antes de emitir. No es
    // redundante con la FK compuesta de `20260918_entidad_tenant_compuesto.sql`:
    // la base rechazaria la ajena, pero por el camino del 23503, que llega al
    // usuario como un 500 sin nada que corregir sobre un comprobante que no se
    // emitio. Se REUTILIZA `obtenerEntidad`, que ya lee por id Y tenant y
    // devuelve `null` cuando es de otra organizacion.
    if (d.entidadEmisoraId) {
      if (!(await obtenerEntidad(d.entidadEmisoraId))) {
        throw new AppError('La razon social emisora no existe o es de otra organizacion.', 404)
      }
    }
    return await generarFactura(
      campanaId,
      d.plazoDias as 60 | 90 | 120,
      d.plan ?? null,
      d.entidadEmisoraId ?? null,
    )
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

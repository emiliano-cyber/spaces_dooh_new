import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { fechaZod } from './fechas'
import { LIMITES, uploadOUrlZod } from './uploads'
import { crearOrdenCompra } from './ordenes-compra-repo'

// ============================================================================
//  lib/server/ordenes-compra-controller.ts — Alta de la orden de compra del
//  cliente (ODC).
// ----------------------------------------------------------------------------
//  Este archivo no existía. `app/api/ordenes-compra/route.ts` era la única ruta
//  de DINERO que se saltaba la capa de controlador: comprobaba que viniera
//  `campanaId` y le pasaba al model `monto`, `fecha`, `numeroOc`,
//  `documentoUrl` y `notas` tal como llegaron por HTTP.
//
//  Está por delante del resto de lo que encontró el barrido del 26/08 por una
//  razón concreta: **una ODC no se puede corregir ni borrar desde la
//  aplicación**. No hay PATCH ni DELETE en `/api/ordenes-compra`, así que el
//  importe equivocado se queda — y registrarla además pone `oc_recibida = true`
//  y puede pasar la campaña a `LISTA_FACTURAR`, o sea que abre el candado de
//  facturación con el dato malo dentro.
// ============================================================================

// `ordenes_compra.monto` es `numeric(14,2)` SIN CHECK (`db/schema.sql:416`): la
// base no frena un negativo. 12 enteros + 2 decimales, así que el tope real es
// 10^12; se corta antes para que un dedazo con notación científica dé un 400
// legible en vez de un «numeric field overflow» del driver.
//
// El CERO sí vale y no es un descuido: el model ya usaba 0 como valor por
// defecto de la columna, y una ODC de cortesía o de ajuste existe.
const MAX_MONTO = 999_999_999_999.99

// Topes de texto. Mismo criterio que el `MAX_NOMBRE` de clientes (VAL-02): no
// son límites del negocio, son el ancho que la pantalla y el documento pueden
// pintar sin romperse. `numero_oc` es un folio del cliente; `notas`, una nota.
const MAX_NUMERO_OC = 60
const MAX_NOTAS = 1000

const crearSchema = z.object({
  campanaId: z.string().min(1, 'Falta la campaña'),
  numeroOc: z.string().trim().max(MAX_NUMERO_OC).nullish(),
  monto: z.coerce
    .number()
    .nonnegative('El monto de la ODC no puede ser negativo')
    .max(MAX_MONTO, 'El monto de la ODC es demasiado grande')
    .nullish(),
  // Sin esto, «mañana» llegaba a `coalesce($5::date, current_date)` y volvía
  // como un 500 del driver. Es el defecto de UX-01 en otra ruta.
  fecha: fechaZod('Falta la fecha de la ODC').nullish(),
  // MISMA regla que usa la campana para el MISMO documento
  // (`campanas-controller.ts:78`), y no un tope de largo inventado aqui. La
  // pantalla manda `documentoUrl: camp.contratoUrl` (`CandadoPanel.tsx:55`), y
  // `campanas.contrato_url` puede ser un `data:` URL con el PDF del contrato
  // dentro: un `.max(2000)` habria dejado de registrar la ODC de toda campana
  // con contrato subido. Ademas asi el adjunto pasa por la allowlist de tipos
  // en vez de entrar como cadena cruda a la columna.
  documentoUrl: uploadOUrlZod(LIMITES.contratoPdf.allowlist, LIMITES.contratoPdf.maxMB, 'documentoUrl').nullish(),
  notas: z.string().trim().max(MAX_NOTAS).nullish(),
})

export async function crearOrdenCompraCtrl(body: unknown) {
  const d = validar(crearSchema, body ?? {})
  const odc = await crearOrdenCompra(d.campanaId, {
    numeroOc: d.numeroOc ?? null,
    // `?? null` y no `|| null`: un monto de 0 es un monto, y con `||` se
    // convertía en «no lo mandaron» y el model lo sustituía por el presupuesto
    // bruto de la campaña — justo lo contrario de lo que se pidió.
    monto: d.monto ?? null,
    fecha: d.fecha ?? null,
    documentoUrl: d.documentoUrl ?? null,
    notas: d.notas ?? null,
  })
  if (!odc) throw new AppError('Campaña no encontrada', 404)
  return odc
}

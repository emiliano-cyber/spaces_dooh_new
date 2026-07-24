import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { esEmailValido } from '@/lib/validacion'
import { LIMITES, uploadOUrlZod, uploadZod } from './uploads'
import {
  crearArrendador, iniciarRenovacion, registrarPagoRenta, crearContratoConSitio,
  editarArrendador, borrarArrendador, editarContrato, cancelarContrato,
  crearRazonSocial, crearPredio, editarPredio, agregarPantallaAPredio,
  adjuntarAPago, obtenerAdjuntoPago,
} from './arrendadores-repo'
import { otRetiroPorCancelacion, otMontajePorAlta } from './operaciones-eventos'

// ============================================================================
//  lib/server/arrendadores-controller.ts — Alta de propietarios/arrendadores.
//  Valida nombre (obligatorio), RFC y correo de contacto antes del model.
// ============================================================================

const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i
const CURP_RE = /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i

// Fecha que Postgres pueda castear de verdad. Sin esto, un valor como "mañana"
// llegaba crudo a `$1::date` y salía como error del driver (500) en vez de 400.
const fecha = z
  .string()
  .trim()
  .min(1, 'La fecha es obligatoria')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida')

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

// ─── Alta unificada: arrendatario → contrato → pantalla ─────────────────────
const PERIODICIDADES = ['SEMANAL', 'CATORCENAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'] as const

const arrendadorRef = z.union([
  z.object({ id: z.string().min(1) }),
  z.object({
    nombre: z.string().trim().min(1, 'El nombre del arrendatario es obligatorio'),
    rfc: z.string().trim().max(13).nullish(),
    telefono: z.string().trim().max(30).nullish(),
    email: z.string().trim().nullish(),
    notas: z.string().trim().nullish(),
  }),
])

const contratoSchema = z.object({
  fechaInicio: z.string().min(1, 'Falta la fecha de inicio'),
  fechaFin: z.string().min(1, 'Falta la fecha de fin'),
  montoRenta: z.coerce.number().nonnegative('La renta no puede ser negativa'),
  periodicidad: z.enum(PERIODICIDADES).default('MENSUAL'),
  moneda: z.string().trim().default('MXN'),
  autoRenovable: z.boolean().default(false),
  // PDF del contrato: 10 MB, magic bytes %PDF (Bloque D).
  documentoUrl: uploadOUrlZod(LIMITES.contratoPdf.allowlist, LIMITES.contratoPdf.maxMB, 'documentoUrl').nullish(),
})

// ─── Predio (entidad central del módulo) ────────────────────────────────────
const ESTADOS_PREDIO = ['PROSPECTO', 'EN_NEGOCIACION', 'DISPONIBLE', 'OCUPADO', 'SUSPENDIDO', 'PROBLEMA_LEGAL', 'FUERA_DE_SERVICIO'] as const

const lat = z.coerce.number().min(-90, 'Latitud fuera de rango').max(90, 'Latitud fuera de rango')
const lng = z.coerce.number().min(-180, 'Longitud fuera de rango').max(180, 'Longitud fuera de rango')

const predioNuevoSchema = z.object({
  nombre: z.string().trim().min(1, 'El predio necesita un nombre'),
  direccion: z.string().trim().nullish(),
  lat: lat.nullish(),
  lng: lng.nullish(),
  tipoUbicacion: z.string().trim().max(60).nullish(),
  estado: z.enum(ESTADOS_PREDIO).default('DISPONIBLE'),
})

// En el alta unificada el arrendador viene del payload padre, no del predio.
const predioRef = z.union([z.object({ id: z.string().uuid('Predio inválido') }), predioNuevoSchema])

const crearPredioSchema = predioNuevoSchema.extend({
  arrendadorId: z.string().uuid('Arrendador inválido'),
})

export async function crearPredioCtrl(body: unknown) {
  const d = validar(crearPredioSchema, body)
  const p = await crearPredio(d)
  if (!p) throw new AppError('Arrendador no encontrado', 404)
  return p
}

// Pantalla de un alta: una del inventario por id, o una nueva por sus datos.
const sitioRef = z.union([
  z.object({ id: z.string().uuid('Pantalla inválida') }),
  z.object({ nombre: z.string().trim().min(1, 'La pantalla necesita un nombre') }).passthrough(),
])

// Agrega una pantalla al predio SIN contrato nuevo (el del predio ya define la
// renta). {sitioId} liga una pantalla existente; si no, se crea una nueva (el
// insert whitelistea columnas, igual que el alta manual).
const agregarPantallaSchema = z.union([
  z.object({ sitioId: z.string().uuid('Pantalla inválida') }),
  z.object({ nombre: z.string().trim().min(1, 'La pantalla necesita un nombre') }).passthrough(),
])

export async function agregarPantallaAPredioCtrl(predioId: string, body: unknown) {
  const d = validar(agregarPantallaSchema, body)
  const sitio = 'sitioId' in d ? { id: d.sitioId } : d
  return agregarPantallaAPredio(predioId, sitio)
}

const editarPredioSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').optional(),
  direccion: z.string().trim().nullish(),
  lat: lat.nullish(),
  lng: lng.nullish(),
  tipoUbicacion: z.string().trim().max(60).nullish(),
  estado: z.enum(ESTADOS_PREDIO).optional(),
}).strict()

export async function editarPredioCtrl(id: string, body: unknown) {
  const d = editarPredioSchema.parse(body ?? {})
  const p = await editarPredio(id, d)
  if (!p) throw new AppError('Predio no encontrado', 404)
  return p
}

const crearContratoSchema = z.object({
  arrendador: arrendadorRef,
  // El predio es OBLIGATORIO: el P&L atribuye la renta por predio, así que un
  // contrato sin predio no costaría nada e inflaría el margen (derive.ts).
  predio: predioRef,
  contrato: contratoSchema,
  // {id} liga una pantalla que ya existe en el inventario (lo normal: el dueño
  // ya las tiene cargadas y solo les asigna arrendador y predio). Si no, se da
  // de alta una nueva y se valida de forma laxa (el insert whitelistea columnas).
  sitio: sitioRef,
})

export async function crearContratoCtrl(body: unknown) {
  const d = validar(crearContratoSchema, body)
  // Regla de negocio: fin no puede ser anterior al inicio (fechas pasadas SÍ se permiten).
  if (d.contrato.fechaFin < d.contrato.fechaInicio) {
    throw new AppError('La fecha de fin no puede ser anterior a la de inicio', 400)
  }
  if ('email' in d.arrendador && d.arrendador.email && !esEmailValido(d.arrendador.email)) {
    throw new AppError('Correo del arrendatario inválido', 400)
  }
  const res = await crearContratoConSitio(d as Parameters<typeof crearContratoConSitio>[0])
  // Fase 2 (Arrendadores → Operaciones): alta de pantalla nueva dispara una OT de
  // montaje/instalación (solo fijas). Mejor esfuerzo: no bloquea el alta.
  await otMontajePorAlta((res as { sitio?: { id?: string } })?.sitio?.id ?? null)
  return res
}

// ─── Editar / borrar arrendador ─────────────────────────────────────────────
const editarArrendadorSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').optional(),
  rfc: z.string().trim().max(13).nullish(),
  telefono: z.string().trim().max(30).nullish(),
  email: z.string().trim().nullish(),
  notas: z.string().trim().nullish(),
  curp: z.string().trim().max(18).nullish(),
  direccion: z.string().trim().nullish(),
  cuentaBancaria: z.string().trim().max(34).nullish(),
  formaPago: z.string().trim().max(40).nullish(),
  observaciones: z.string().trim().nullish(),
}).strict()

export async function editarArrendadorCtrl(id: string, body: unknown) {
  const d = editarArrendadorSchema.parse(body ?? {})
  if (d.rfc && !RFC_RE.test(d.rfc)) throw new AppError('RFC inválido', 400)
  if (d.curp && !CURP_RE.test(d.curp)) throw new AppError('CURP inválida', 400)
  if (d.email && !esEmailValido(d.email)) throw new AppError('Correo inválido', 400)
  const arr = await editarArrendador(id, d)
  if (!arr) throw new AppError('Arrendador no encontrado', 404)
  return arr
}

export async function borrarArrendadorCtrl(id: string) {
  const r = await borrarArrendador(id)
  if (r.bloqueado) {
    throw new AppError(
      `No se puede borrar: el arrendador tiene ${r.predios} predio(s) y ${r.contratos} contrato(s) activo(s). ` +
      `Reasigna o cancela sus contratos primero.`,
      409,
    )
  }
  if (!r.arrendador) throw new AppError('Arrendador no encontrado', 404)
  return r.arrendador
}

// ─── Editar / cancelar contrato ─────────────────────────────────────────────
const editarContratoSchema = z.object({
  fechaInicio: z.string().min(1).optional(),
  fechaFin: z.string().min(1).optional(),
  montoRenta: z.coerce.number().nonnegative('La renta no puede ser negativa').optional(),
  periodicidad: z.enum(PERIODICIDADES).optional(),
  moneda: z.string().trim().optional(),
  deposito: z.coerce.number().nonnegative('El depósito no puede ser negativo').nullish(),
  // PDF del contrato: 10 MB, magic bytes %PDF (Bloque D).
  documentoUrl: uploadOUrlZod(LIMITES.contratoPdf.allowlist, LIMITES.contratoPdf.maxMB, 'documentoUrl').nullish(),
  autoRenovable: z.boolean().optional(),
  razonSocialId: z.string().uuid().nullish(),
}).strict()

export async function editarContratoCtrl(id: string, body: unknown) {
  const d = editarContratoSchema.parse(body ?? {})
  const fi = d.fechaInicio, ff = d.fechaFin
  if (fi && ff && ff < fi) throw new AppError('La fecha de fin no puede ser anterior a la de inicio', 400)
  const r = await editarContrato(id, d)
  if ('noEncontrado' in r) throw new AppError('Contrato no encontrado', 404)
  if ('cancelado' in r) throw new AppError('El contrato está CANCELADO; crea uno nuevo en su lugar', 409)
  return r.contrato
}

const cancelarContratoSchema = z.object({
  motivo: z.string().trim().min(1, 'El motivo de cancelación es obligatorio'),
})

export async function cancelarContratoCtrl(id: string, body: unknown) {
  const d = validar(cancelarContratoSchema, body)
  const c = await cancelarContrato(id, d.motivo)
  if (!c) throw new AppError('Contrato no encontrado o ya cancelado', 404)
  // Fase 2 (Arrendadores → Operaciones): cancelar el contrato dispara una OT de
  // retiro (desmontaje) de su pantalla. Mejor esfuerzo: no bloquea la cancelación.
  await otRetiroPorCancelacion(c.sitioId)
  return c
}

// Renovación de contrato (acción por id). Fecha de fin opcional (configurable);
// si no se indica, el model usa +365 días.
const renovarSchema = z.object({ nuevaFechaFin: fecha.nullish() }).strict()
export async function iniciarRenovacionCtrl(id: string, body?: unknown) {
  const d = renovarSchema.parse(body ?? {})
  const r = await iniciarRenovacion(id, d.nuevaFechaFin ?? null)
  if ('noEncontrado' in r) throw new AppError('Contrato no encontrado', 404)
  // Renovar es EXTENDER la vigencia: una fecha anterior a la actual generaría
  // periodos ya vencidos y acortaría el contrato en silencio.
  if ('fechaNoPosterior' in r) {
    throw new AppError(
      `La nueva fecha de fin debe ser posterior a la vigencia actual (${r.fechaNoPosterior}).`,
      400,
    )
  }
  return r.contrato
}

// ─── Adjuntos de pago (factura / comprobante) ───────────────────────────────
// Se guardan como data URL base64 (mismo patrón que el PDF del contrato). El
// cliente no es fuente de verdad: aquí se valida el tipo real declarado y el
// tamaño, porque el límite del navegador se salta con un curl.
// Este era el ÚNICO punto de subida que ya validaba. Ahora usa el mismo helper
// que los otros seis, así que además del tipo declarado comprueba los magic
// bytes reales: un .exe renombrado a .pdf ya no pasa (Bloque D).
const adjunto = uploadZod(LIMITES.adjuntoPago.allowlist, LIMITES.adjuntoPago.maxMB)

// Registro de pago de renta: PAGADO + adjuntos opcionales (factura/comprobante).
const pagarSchema = z.object({
  fechaPago: fecha.nullish(),
  metodoPago: z.string().trim().max(40).nullish(),
  facturaUrl: adjunto.nullish(),
  comprobanteUrl: adjunto.nullish(),
  observaciones: z.string().trim().max(500).nullish(),
}).strict()
export async function registrarPagoRentaCtrl(id: string, body?: unknown) {
  const d = pagarSchema.parse(body ?? {})
  // Un pago no puede registrarse con fecha futura: aún no ha ocurrido.
  if (d.fechaPago && Date.parse(d.fechaPago) > Date.now() + 86_400_000) {
    throw new AppError('La fecha de pago no puede ser futura', 400)
  }
  const r = await registrarPagoRenta(id, d)
  if ('noEncontrado' in r) throw new AppError('Pago no encontrado', 404)
  // Re-registrar un pago ya PAGADO sobrescribía su fecha sin dejar rastro.
  if ('yaPagado' in r) {
    throw new AppError(`Este periodo ya está pagado (${r.yaPagado}). Cancélalo antes de volver a registrarlo.`, 409)
  }
  return r.pago
}

// Adjuntar/reemplazar factura y comprobante de un pago, sin re-sellar el pago:
// la factura suele llegar días después. `null` borra el adjunto.
const adjuntarSchema = z.object({
  facturaUrl: adjunto.nullable().optional(),
  comprobanteUrl: adjunto.nullable().optional(),
  metodoPago: z.string().trim().max(40).nullable().optional(),
  observaciones: z.string().trim().max(500).nullable().optional(),
}).strict()

export async function adjuntarAPagoCtrl(id: string, body: unknown) {
  const d = validar(adjuntarSchema, body)
  if (!Object.keys(d).length) throw new AppError('No hay nada que guardar', 400)
  const p = await adjuntarAPago(id, d)
  if (!p) throw new AppError('Pago no encontrado', 404)
  return p
}

export async function obtenerAdjuntoPagoCtrl(id: string, tipo: string) {
  if (tipo !== 'factura' && tipo !== 'comprobante') throw new AppError('Adjunto inválido', 400)
  const url = await obtenerAdjuntoPago(id, tipo)
  if (!url) throw new AppError('Adjunto no encontrado', 404)
  return url
}

// ─── Razón social del arrendador ────────────────────────────────────────────
const crearRazonSocialSchema = z.object({
  arrendadorId: z.string().uuid('Arrendador inválido'),
  razonSocial: z.string().trim().min(1, 'La razón social es obligatoria'),
  rfc: z.string().trim().max(13).nullish(),
  regimen: z.string().trim().max(120).nullish(),
})
export async function crearRazonSocialCtrl(body: unknown) {
  const d = validar(crearRazonSocialSchema, body)
  if (d.rfc && !RFC_RE.test(d.rfc)) throw new AppError('RFC inválido', 400)
  return crearRazonSocial(d)
}

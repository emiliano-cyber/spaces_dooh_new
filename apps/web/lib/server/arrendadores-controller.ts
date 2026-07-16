import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { esEmailValido } from '@/lib/validacion'
import {
  crearArrendador, iniciarRenovacion, registrarPagoRenta, crearContratoConSitio,
  editarArrendador, borrarArrendador, editarContrato, cancelarContrato,
} from './arrendadores-repo'

// ============================================================================
//  lib/server/arrendadores-controller.ts — Alta de propietarios/arrendadores.
//  Valida nombre (obligatorio), RFC y correo de contacto antes del model.
// ============================================================================

const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i
const CURP_RE = /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i

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
  documentoUrl: z.string().trim().nullish(),
})

const crearContratoSchema = z.object({
  arrendador: arrendadorRef,
  contrato: contratoSchema,
  // El sitio se valida de forma laxa aquí (el model/insert whitelistea columnas);
  // solo exigimos un nombre para la pantalla.
  sitio: z.object({ nombre: z.string().trim().min(1, 'La pantalla necesita un nombre') }).passthrough(),
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
  return crearContratoConSitio(d as Parameters<typeof crearContratoConSitio>[0])
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
  documentoUrl: z.string().trim().nullish(),
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
  return c
}

// Renovación de contrato (acción por id). Fecha de fin opcional (configurable).
const renovarSchema = z.object({ nuevaFechaFin: z.string().min(1).nullish() })
export async function iniciarRenovacionCtrl(id: string, body?: unknown) {
  const d = renovarSchema.parse(body ?? {})
  const c = await iniciarRenovacion(id, d.nuevaFechaFin ?? null)
  if (!c) throw new AppError('Contrato no encontrado', 404)
  return c
}

// Registro de pago de renta (acción por id, sin body).
export async function registrarPagoRentaCtrl(id: string) {
  const p = await registrarPagoRenta(id)
  if (!p) throw new AppError('Pago no encontrado', 404)
  return p
}

import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { esEmailValido } from '@/lib/validacion'
import { crearArrendador, iniciarRenovacion, registrarPagoRenta, crearContratoConSitio } from './arrendadores-repo'

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

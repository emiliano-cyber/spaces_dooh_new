import { z } from 'zod'

const TipoMedioEnum = z.enum([
  'ESPECTACULAR',
  'PANTALLA_DIGITAL',
  'PUENTE_PEATONAL',
  'MOBILIARIO_URBANO',
  'MURAL',
  'VALLA',
  'OTRO',
])

const EstComercialEnum = z.enum([
  'DISPONIBLE',
  'RESERVADO',
  'OCUPADO',
  'BLOQUEADO',
  'EN_MANTENIMIENTO',
  'BAJA',
])

const EstLegalEnum = z.enum([
  'EN_ORDEN',
  'PERMISO_VENCIDO',
  'EN_TRAMITE',
  'SUSPENDIDO',
  'SIN_PERMISO',
])

const EstOperativoEnum = z.enum(['ACTIVO', 'EN_MANTENIMIENTO', 'APAGADO', 'DAÑADO', 'BAJA'])

const TipoIncidenciaEnum = z.enum([
  'CLIMA',
  'MANTENIMIENTO',
  'LEGAL',
  'VANDALISMO',
  'SUSPENSION_OPERATIVA',
  'ACCIDENTE',
  'OTRO',
])

export const CreateSitioSchema = z.object({
  claveInterna: z.string().min(1),
  nombre: z.string().min(1),
  tipoMedio: TipoMedioEnum,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  direccion: z.string().min(1),
  alcaldia: z.string().optional(),
  ciudad: z.string().min(1),
  estado: z.string().min(1),
  pais: z.string().default('MX'),
  alto: z.number().positive().optional(),
  ancho: z.number().positive().optional(),
  iluminado: z.boolean().default(false),
  orientacion: z.string().optional(),
  notas: z.string().optional(),
})

export const UpdateSitioSchema = z.object({
  nombre: z.string().min(1).optional(),
  tipoMedio: TipoMedioEnum.optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  direccion: z.string().min(1).optional(),
  alcaldia: z.string().optional(),
  ciudad: z.string().optional(),
  estado: z.string().optional(),
  alto: z.number().positive().optional(),
  ancho: z.number().positive().optional(),
  iluminado: z.boolean().optional(),
  orientacion: z.string().optional(),
  notas: z.string().optional(),
  estatusComercial: EstComercialEnum.optional(),
  estatusLegal: EstLegalEnum.optional(),
  estatusOperativo: EstOperativoEnum.optional(),
})

export const CreateContratoSchema = z.object({
  arrendadorId: z.string().min(1),
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date(),
  montoRenta: z.number().positive(),
  periodicidad: z.string().min(1),
  moneda: z.string().default('MXN'),
  autoRenovable: z.boolean().default(false),
  clausulasJson: z.record(z.string(), z.unknown()).optional(),
  documentoUrl: z.string().url().optional(),
})

export const CreateIncidenciaSchema = z.object({
  tipo: TipoIncidenciaEnum,
  descripcion: z.string().min(1),
  impactaComercial: z.boolean(),
  fechaInicio: z.coerce.date(),
  notas: z.string().optional(),
})

export const CreateLicenciaSchema = z.object({
  tipo: z.string().min(1),
  folio: z.string().optional(),
  autoridad: z.string().optional(),
  fechaInicio: z.coerce.date(),
  fechaVencimiento: z.coerce.date(),
  documentoUrl: z.string().url().optional(),
  notas: z.string().optional(),
})

export type CreateSitioInput = z.infer<typeof CreateSitioSchema>
export type UpdateSitioInput = z.infer<typeof UpdateSitioSchema>
export type CreateContratoInput = z.infer<typeof CreateContratoSchema>
export type CreateIncidenciaInput = z.infer<typeof CreateIncidenciaSchema>
export type CreateLicenciaInput = z.infer<typeof CreateLicenciaSchema>

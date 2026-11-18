import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import type { UsuarioSesion } from './auth'
import { obtenerProspectoCtrl, soloDe } from './captacion-controller'
import { obtenerProspecto } from './captacion-repo'
import { esUuid } from './notificaciones-ids'
import { buscarDireccion } from './geo-buscar'
import {
  borrarCompetidor,
  borrarContacto,
  crearCompetidor,
  crearContacto,
  crearNota,
  crearOferta,
  editarCompetidor,
  editarContacto,
  editarFicha,
  editarOferta,
  listarNotas,
} from './negociacion-repo'
import { puntoUtil } from '@/lib/coordenadas'
import { ESTADOS_OFERTA, ETAPAS_RESPONSABLE, ORIGENES_UBICACION, VISIBILIDADES } from '@/lib/negociacion'

// ============================================================================
//  lib/server/negociacion-controller.ts — La forma de entrada de Comercial
//  negociación, y quién toca qué.  NEG-01.
// ----------------------------------------------------------------------------
//  ⚠️ NINGÚN ESQUEMA ACEPTA quién lo hizo: ni el autor de una nota, ni quien
//  fijó la ubicación, ni quien dio de alta un contacto o una oferta. Salen de la
//  sesión. Ni la VERSIÓN de una oferta, que la pone el repo. Todos son
//  `.strict()`: un campo de más es un 400, no un campo que se ignora y alguien
//  cree haber guardado.
//
//  ─── QUIÉN TOCA QUÉ: la misma regla que el prospecto ──────────────────────
//  `soloDe()` de `captacion-controller.ts`: quien puede aprobar trabaja todos
//  los espacios de la organización; quien no, solo los suyos. Uno ajeno, de
//  otro vendedor o de otra organización, es 404 —no 403— en TODAS las rutas
//  hijas, porque decir «existe pero no es tuyo» ya cuenta algo.
//
//  Un id que no es uuid también es 404: llegaría a Postgres como un error de
//  sintaxis y saldría como 500.
// ============================================================================

const NO_EXISTE = 'Ese espacio no existe'
const NO_EXISTE_HIJO = 'Eso ya no existe en este espacio'

function exigirIds(...ids: string[]) {
  if (!ids.every(esUuid)) throw new AppError(NO_EXISTE, 404)
}

const texto = (max: number) => z.string().trim().max(max)
const opcional = (max: number) =>
  texto(max)
    .nullish()
    .transform((v) => (v == null || v === '' ? null : v))
const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va como AAAA-MM-DD')
  .or(z.literal(''))
  .nullish()
  .transform((v) => (v ? v : null))
const medida = (max: number) => z.number().finite().positive('Las medidas son mayores que cero').max(max).nullable()
const importe = z.number().finite().min(0).max(1_000_000_000).nullable()

// ─── Ficha ──────────────────────────────────────────────────────────────────

const ubicacionSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    // GPS NO está: el dueño lo dejó pendiente (22/10). La base ya lo admite.
    origen: z.enum(ORIGENES_UBICACION),
    placeId: z.string().trim().max(300).nullish(),
  })
  .strict()
  // El (0,0) es como llega «sin capturar» (lib/coordenadas.ts): no es un sitio.
  .refine((u) => puntoUtil(u.lat, u.lng) != null, 'Esa ubicación no es válida: marca el punto en el mapa')

const fichaSchema = z
  .object({
    tipoEspacio: opcional(80).optional(),
    etapaResponsable: z.number().int().min(1).max(ETAPAS_RESPONSABLE.length).nullable().optional(),
    visibilidad: z.enum(VISIBILIDADES).nullable().optional(),
    anchoM: medida(1_000).optional(),
    altoM: medida(1_000).optional(),
    superficieM2: medida(10_000_000).optional(),
    presupuestoMin: importe.optional(),
    presupuestoMax: importe.optional(),
    presupuestoAutoriza: opcional(120).optional(),
    ubicacion: ubicacionSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (f) => f.presupuestoMin == null || f.presupuestoMax == null || f.presupuestoMin <= f.presupuestoMax,
    'El mínimo del presupuesto no puede ser mayor que el máximo',
  )

export async function editarFichaCtrl(u: UsuarioSesion, id: string, body: unknown) {
  exigirIds(id)
  const d = validar(fichaSchema, body) as z.output<typeof fichaSchema>
  const ok = await editarFicha(
    id,
    { ...d, ubicacion: d.ubicacion === undefined ? undefined : d.ubicacion && { ...d.ubicacion, placeId: d.ubicacion.placeId ?? null } },
    u.id,
    await soloDe(u),
  )
  if (!ok) throw new AppError(NO_EXISTE, 404)
  return obtenerProspectoCtrl(u, id)
}

// ─── Contactos ──────────────────────────────────────────────────────────────

const email = z
  .string()
  .trim()
  .max(200)
  .email('El correo no parece válido')
  .or(z.literal(''))
  .nullish()
  .transform((v) => (v ? v : null))

const contactoSchema = z
  .object({
    nombre: z.string().trim().min(1, 'Ponle un nombre').max(200),
    papel: opcional(80),
    telefono: opcional(40),
    email,
    esLegal: z.boolean().default(false),
  })
  .strict()

const contactoCambioSchema = z
  .object({
    nombre: z.string().trim().min(1, 'Ponle un nombre').max(200).optional(),
    papel: opcional(80).optional(),
    telefono: opcional(40).optional(),
    email: email.optional(),
    esLegal: z.boolean().optional(),
  })
  .strict()

export async function crearContactoCtrl(u: UsuarioSesion, id: string, body: unknown) {
  exigirIds(id)
  const d = validar(contactoSchema, body) as z.output<typeof contactoSchema>
  if (!(await crearContacto(id, d, u.id, await soloDe(u)))) throw new AppError(NO_EXISTE, 404)
  return obtenerProspectoCtrl(u, id)
}

export async function editarContactoCtrl(u: UsuarioSesion, id: string, contactoId: string, body: unknown) {
  exigirIds(id, contactoId)
  const d = validar(contactoCambioSchema, body) as z.output<typeof contactoCambioSchema>
  if (!(await editarContacto(id, contactoId, d, await soloDe(u)))) throw new AppError(NO_EXISTE_HIJO, 404)
  return obtenerProspectoCtrl(u, id)
}

export async function borrarContactoCtrl(u: UsuarioSesion, id: string, contactoId: string) {
  exigirIds(id, contactoId)
  if (!(await borrarContacto(id, contactoId, await soloDe(u)))) throw new AppError(NO_EXISTE_HIJO, 404)
  return obtenerProspectoCtrl(u, id)
}

// ─── Ofertas ────────────────────────────────────────────────────────────────

const ofertaSchema = z
  .object({
    fecha,
    importeMensual: z.number().finite().positive('El importe es mayor que cero').max(1_000_000_000),
    plazoMeses: z.number().int().min(1, 'El plazo es de al menos un mes').max(240),
    estado: z.enum(ESTADOS_OFERTA).default('ENVIADA'),
    notas: opcional(2000),
  })
  .strict()

// Solo estado y notas: el importe y el plazo no se reescriben. Si cambian, es
// otra versión — esa historia es la negociación.
const ofertaCambioSchema = z
  .object({
    estado: z.enum(ESTADOS_OFERTA).optional(),
    notas: opcional(2000).optional(),
  })
  .strict()

export async function crearOfertaCtrl(u: UsuarioSesion, id: string, body: unknown) {
  exigirIds(id)
  const d = validar(ofertaSchema, body) as z.output<typeof ofertaSchema>
  if (!(await crearOferta(id, d, u.id, await soloDe(u)))) throw new AppError(NO_EXISTE, 404)
  return obtenerProspectoCtrl(u, id)
}

export async function editarOfertaCtrl(u: UsuarioSesion, id: string, ofertaId: string, body: unknown) {
  exigirIds(id, ofertaId)
  const d = validar(ofertaCambioSchema, body) as z.output<typeof ofertaCambioSchema>
  if (!(await editarOferta(id, ofertaId, d, await soloDe(u)))) throw new AppError(NO_EXISTE_HIJO, 404)
  return obtenerProspectoCtrl(u, id)
}

// ─── Competencia ────────────────────────────────────────────────────────────

const competidorSchema = z
  .object({
    nombre: z.string().trim().min(1, 'Ponle un nombre').max(200),
    nota: opcional(2000),
    desde: fecha,
  })
  .strict()

const competidorCambioSchema = z
  .object({
    nombre: z.string().trim().min(1, 'Ponle un nombre').max(200).optional(),
    nota: opcional(2000).optional(),
    desde: fecha.optional(),
  })
  .strict()

export async function crearCompetidorCtrl(u: UsuarioSesion, id: string, body: unknown) {
  exigirIds(id)
  const d = validar(competidorSchema, body) as z.output<typeof competidorSchema>
  if (!(await crearCompetidor(id, d, u.id, await soloDe(u)))) throw new AppError(NO_EXISTE, 404)
  return obtenerProspectoCtrl(u, id)
}

export async function editarCompetidorCtrl(u: UsuarioSesion, id: string, competidorId: string, body: unknown) {
  exigirIds(id, competidorId)
  const d = validar(competidorCambioSchema, body) as z.output<typeof competidorCambioSchema>
  if (!(await editarCompetidor(id, competidorId, d, await soloDe(u)))) throw new AppError(NO_EXISTE_HIJO, 404)
  return obtenerProspectoCtrl(u, id)
}

export async function borrarCompetidorCtrl(u: UsuarioSesion, id: string, competidorId: string) {
  exigirIds(id, competidorId)
  if (!(await borrarCompetidor(id, competidorId, await soloDe(u)))) throw new AppError(NO_EXISTE_HIJO, 404)
  return obtenerProspectoCtrl(u, id)
}

// ─── Notas ──────────────────────────────────────────────────────────────────

const notaSchema = z
  .object({ texto: z.string().trim().min(1, 'Escribe la nota').max(4000) })
  .strict()

export async function listarNotasCtrl(u: UsuarioSesion, id: string) {
  exigirIds(id)
  // Primero se comprueba que el espacio es de quien pregunta: `listarNotas` no
  // filtra por vendedor.
  if (!(await obtenerProspecto(id, await soloDe(u)))) throw new AppError(NO_EXISTE, 404)
  return { notas: await listarNotas(id) }
}

export async function crearNotaCtrl(u: UsuarioSesion, id: string, body: unknown) {
  exigirIds(id)
  const d = validar(notaSchema, body) as z.output<typeof notaSchema>
  if (!(await crearNota(id, d.texto, u.id, await soloDe(u)))) throw new AppError(NO_EXISTE, 404)
  return obtenerProspectoCtrl(u, id)
}

// ─── Buscador de direcciones ────────────────────────────────────────────────

export async function buscarDireccionCtrl(u: UsuarioSesion, params: URLSearchParams) {
  return buscarDireccion(params.get('q') ?? '', u.id)
}

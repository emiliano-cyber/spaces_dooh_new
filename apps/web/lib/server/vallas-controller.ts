import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import {
  crearValla,
  actualizarValla,
  borrarValla,
  crearGrupo,
  actualizarGrupo,
  borrarGrupo,
  crearCategoria,
  actualizarCategoria,
  contextoParaVerificar,
  ocupacionDeVallas,
  VallaError,
  VALLA_NO_ENCONTRADA,
  GRUPO_NO_ENCONTRADO,
  CATEGORIA_NO_ENCONTRADA,
} from './vallas-repo'
import { MODOS_GRUPO, type Valla } from '@/lib/vallas/tipos'
import { evaluarReglas, type ResultadoReglas } from '@/lib/vallas/reglas'

// ============================================================================
//  lib/server/vallas-controller.ts — VALLAS (esqueleto, 19/11). Valida con zod
//  lo que entra y mapea los errores del repo a HTTP.
// ============================================================================

const uuid = z.string().uuid()
const metros = z.coerce.number().positive('La medida debe ser mayor que cero').max(999)
const numero = z.string().trim().min(1, 'El número es requerido').max(40, 'El número no puede pasar de 40 caracteres')
const notas = z.string().trim().max(1000).nullable()
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

const vallaSchema = z
  .object({
    sitioId: uuid,
    numero,
    ancho: metros,
    alto: metros,
    cara: z.coerce.number().int().min(1).max(50).nullable(),
    notas,
    activo: z.boolean(),
  })
  .partial({ cara: true, notas: true, activo: true })
  .strict()

const grupoSchema = z
  .object({
    numero,
    nombre: z.string().trim().max(120).nullable(),
    modo: z.enum(MODOS_GRUPO),
    ancho: metros.nullable(),
    alto: metros.nullable(),
    notas,
    activo: z.boolean(),
    vallaIds: z.array(uuid).max(200),
  })
  .partial({ nombre: true, ancho: true, alto: true, notas: true, activo: true, vallaIds: true })
  .strict()

const categoriaSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es requerido').max(120, 'El nombre no puede pasar de 120 caracteres'),
    marcas: z.array(z.string().max(120)).max(100),
    activo: z.boolean(),
  })
  .partial({ activo: true })
  .strict()

const verificarSchema = z
  .object({
    marca: z.string().trim().min(1, 'La marca es requerida').max(120),
    fechaInicio: fecha,
    fechaFin: fecha,
    vallaIds: z.array(uuid).max(500).optional(),
    sitioIds: z.array(uuid).max(500).optional(),
    excluirCampanaId: uuid.nullable().optional(),
  })
  .strict()
  .refine((d) => d.fechaInicio <= d.fechaFin, { message: 'La fecha de fin no puede ser anterior a la de inicio', path: ['fechaFin'] })

// Una fecha que EXISTE: `2026-13-40` pasa el patrón y Postgres la rechazaría
// al hacer `::date`, con un 500 en vez de un 400.
const fechaReal = fecha.refine((s) => {
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}, 'Fecha inválida')

const ocupacionSchema = z
  .object({ desde: fechaReal, hasta: fechaReal })
  .strict()
  .refine((d) => d.desde <= d.hasta, { message: 'La fecha de fin no puede ser anterior a la de inicio', path: ['hasta'] })

function mapear(e: unknown): never {
  if (e instanceof VallaError) throw new AppError(e.message, e.status)
  throw e
}

const cuerpo = (b: unknown) => b ?? {}

export async function crearVallaCtrl(body: unknown) {
  const d = validar(vallaSchema, cuerpo(body))
  try {
    return await crearValla(d)
  } catch (e) {
    mapear(e)
  }
}

export async function actualizarVallaCtrl(id: string, body: unknown) {
  const d = validar(vallaSchema.partial(), cuerpo(body))
  try {
    const r = await actualizarValla(id, d)
    if (!r) throw new AppError(VALLA_NO_ENCONTRADA, 404)
    return r
  } catch (e) {
    mapear(e)
  }
}

export async function borrarVallaCtrl(id: string) {
  if (!(await borrarValla(id))) throw new AppError(VALLA_NO_ENCONTRADA, 404)
  return { ok: true }
}

export async function crearGrupoCtrl(body: unknown) {
  const d = validar(grupoSchema, cuerpo(body))
  try {
    return await crearGrupo(d)
  } catch (e) {
    mapear(e)
  }
}

export async function actualizarGrupoCtrl(id: string, body: unknown) {
  const d = validar(grupoSchema.partial(), cuerpo(body))
  try {
    const r = await actualizarGrupo(id, d)
    if (!r) throw new AppError(GRUPO_NO_ENCONTRADO, 404)
    return r
  } catch (e) {
    mapear(e)
  }
}

export async function borrarGrupoCtrl(id: string) {
  if (!(await borrarGrupo(id))) throw new AppError(GRUPO_NO_ENCONTRADO, 404)
  return { ok: true }
}

export async function crearCategoriaCtrl(body: unknown) {
  const d = validar(categoriaSchema, cuerpo(body))
  try {
    return await crearCategoria(d)
  } catch (e) {
    mapear(e)
  }
}

export async function actualizarCategoriaCtrl(id: string, body: unknown) {
  const d = validar(categoriaSchema.partial(), cuerpo(body))
  try {
    const r = await actualizarCategoria(id, d)
    if (!r) throw new AppError(CATEGORIA_NO_ENCONTRADA, 404)
    return r
  } catch (e) {
    mapear(e)
  }
}

/**
 * Corre TODAS las reglas de vallas sobre una marca, unas fechas y unas vallas
 * (o sitios, que se expanden a sus vallas). La comparten
 * `POST /api/vallas/verificar` y, desde el 20/11, las propuestas
 * (`propuestas-competencia.ts`): UNA sola puerta a `contextoParaVerificar` +
 * `evaluarReglas`, para que la propuesta no tenga su copia de la regla.
 *
 * Devuelve también las vallas del contexto, para que quien llama sepa en qué
 * SITIO cae cada hallazgo (`datos.vallaId` → `sitioId`) sin volver a leerlas.
 */
export async function verificarCompetencia(c: {
  marca: string
  fechaInicio: string
  fechaFin: string
  vallaIds?: string[]
  sitioIds?: string[]
  excluirCampanaId?: string | null
}): Promise<ResultadoReglas & { vallas: Valla[] }> {
  const ctx = await contextoParaVerificar({
    marca: c.marca,
    inicio: c.fechaInicio,
    fin: c.fechaFin,
    vallaIds: c.vallaIds,
    sitioIds: c.sitioIds,
    excluirCampanaId: c.excluirCampanaId ?? null,
  })
  return { ...evaluarReglas(ctx), vallas: ctx.vallas }
}

/** Corre todas las reglas de vallas sobre la candidata. Solo informa. */
export async function verificarVallasCtrl(body: unknown): Promise<ResultadoReglas> {
  const d = validar(verificarSchema, cuerpo(body))
  const { hallazgos, bloquea } = await verificarCompetencia(d)
  return { hallazgos, bloquea }
}

/**
 * Para el plano (`GET /api/vallas/ocupacion?desde&hasta`): qué campañas ocupan
 * cada sitio con vallas en esas fechas. Las dos son obligatorias: las por
 * omisión (hoy → +30) las pone la pantalla, que sabe en qué día está quien mira.
 */
export async function ocupacionVallasCtrl(params: URLSearchParams) {
  const d = validar(ocupacionSchema, { desde: params.get('desde') ?? '', hasta: params.get('hasta') ?? '' })
  return { desde: d.desde, hasta: d.hasta, ocupaciones: await ocupacionDeVallas(d.desde, d.hasta) }
}

/** Un id que no es uuid haría fallar el cast de Postgres con un 500. */
export const esUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s)

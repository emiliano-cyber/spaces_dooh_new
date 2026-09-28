import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import {
  motivoFranjaInvalida,
  motivoTemporadaInvalida,
  type FranjaHoraria,
  type Temporada,
} from '@/lib/rejilla'
import {
  listarFranjas,
  listarTemporadas,
  guardarFranja,
  guardarTemporada,
  desactivarFranja,
  desactivarTemporada,
  rejillaDeSitio,
  actualizarRejilla,
  type CambiosRejilla,
} from './rejilla-repo'

// ============================================================================
//  lib/server/rejilla-controller.ts — La forma de entrada del catálogo de
//  franjas y temporadas, y la aplicación de sus reglas.  ADR 0039, Fase 1.
// ----------------------------------------------------------------------------
//  Las REGLAS viven en `lib/rejilla.ts`, que es puro y no sabe nada de la base.
//  Lo que vive aquí es quién le pasa «las otras» para comparar — y ése es
//  exactamente el punto donde un olvido deja entrar dos franjas que se pisan.
//
//  NINGÚN `tenantId` entra por el cuerpo. El repo lo saca de la sesión. Si
//  viajara en el JSON se podría escribir el catálogo de otra organización con
//  un `curl`, y no daría ningún error: la fila escrita sería coherente consigo
//  misma, así que el `with check` de la RLS la aprobaría. Es el mismo candado
//  que `PropuestaInput` con el vendedor, y aquí también lo vigila una prueba.
// ============================================================================

// El FORMATO no se valida aquí, sino en `motivoFranjaInvalida`, a propósito:
// así el usuario lee «se escribe HH:MM en 24 horas, de 00:00 a 23:59» —una
// frase que dice qué hacer— y no el mensaje genérico de zod. El `max` es solo
// para que nada desmedido llegue a ese mensaje, que devuelve el valor recibido.
const HORA = z.string().trim().min(1, 'La hora es obligatoria').max(20)

// Los nombres se acotan porque acaban en un selector y en un documento que lee
// un cliente: 120 caracteres es más de lo que cabe en «Prime · 06:00–10:00».
const franjaSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  nombre: z.string().trim().min(1, 'La franja necesita un nombre').max(120),
  horaInicio: HORA,
  horaFin: HORA,
  orden: z.coerce.number().int().min(0).max(999).optional(),
  activo: z.boolean().optional(),
})

const temporadaSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  nombre: z.string().trim().min(1, 'La temporada necesita un nombre').max(120),
  desde: z.string().trim().min(1, 'La fecha de inicio es obligatoria').max(10),
  hasta: z.string().trim().min(1, 'La fecha de fin es obligatoria').max(10),
  activo: z.boolean().optional(),
})

export async function listarCatalogoCtrl(op?: { incluirInactivas?: boolean }) {
  const [franjas, temporadas] = await Promise.all([
    listarFranjas(op),
    listarTemporadas(op),
  ])
  return { franjas, temporadas }
}

/**
 * Alta o edición de una franja.
 *
 * SE COMPARA CONTRA TODAS, INCLUIDAS LAS DESACTIVADAS, y es deliberado. Si solo
 * mirara las activas se podría guardar una franja que se solapa con una
 * apagada, y el día que alguien la reactivara quedarían dos precios para la
 * misma hora — sin error y sin poder saber desde cuándo. El solape es una
 * propiedad del catálogo, no de lo que esté encendido hoy.
 */
export async function guardarFranjaCtrl(body: unknown) {
  const d = validar(franjaSchema, body)
  const candidata: FranjaHoraria = {
    id: d.id ?? '',
    nombre: d.nombre,
    horaInicio: d.horaInicio,
    horaFin: d.horaFin,
  }
  const otras = await listarFranjas({ incluirInactivas: true })
  const motivo = motivoFranjaInvalida(
    candidata,
    otras.map((f) => ({ id: f.id, nombre: f.nombre, horaInicio: f.horaInicio, horaFin: f.horaFin })),
  )
  if (motivo) throw new AppError(motivo, 400)

  const guardada = await guardarFranja({
    id: d.id,
    nombre: d.nombre,
    horaInicio: d.horaInicio,
    horaFin: d.horaFin,
    orden: d.orden ?? 0,
    activo: d.activo ?? true,
  })
  if (!guardada) throw new AppError('Esa franja no existe en esta organización', 404)
  return guardada
}

/** Alta o edición de una temporada. Mismo criterio que la franja. */
export async function guardarTemporadaCtrl(body: unknown) {
  const d = validar(temporadaSchema, body)
  const candidata: Temporada = {
    id: d.id ?? '',
    nombre: d.nombre,
    desde: d.desde,
    hasta: d.hasta,
  }
  const otras = await listarTemporadas({ incluirInactivas: true })
  const motivo = motivoTemporadaInvalida(
    candidata,
    otras.map((t) => ({ id: t.id, nombre: t.nombre, desde: t.desde, hasta: t.hasta })),
  )
  if (motivo) throw new AppError(motivo, 400)

  const guardada = await guardarTemporada({
    id: d.id,
    nombre: d.nombre,
    desde: d.desde,
    hasta: d.hasta,
    activo: d.activo ?? true,
  })
  if (!guardada) throw new AppError('Esa temporada no existe en esta organización', 404)
  return guardada
}

/**
 * Baja LÓGICA. No hay borrado real: una franja contratada es un hecho, y
 * `propuesta_items_franja_fkey` es `on delete restrict`, así que un borrado
 * devolvería un 500 sin explicar nada. Ver `rejilla-repo.ts`.
 */
export async function desactivarFranjaCtrl(id: string) {
  const ok = await desactivarFranja(id)
  if (!ok) throw new AppError('Esa franja no existe en esta organización', 404)
  return { ok: true }
}

export async function desactivarTemporadaCtrl(id: string) {
  const ok = await desactivarTemporada(id)
  if (!ok) throw new AppError('Esa temporada no existe en esta organización', 404)
  return { ok: true }
}

// ─── La rejilla de una pantalla ─────────────────────────────────────────────

// Los identificadores son UUID. Se acotan a 64 y no se validan como `uuid()` a
// secas por una razón concreta: el mensaje de rechazo los NOMBRA para poder
// diagnosticar, y sin tope alguien podría hacer que el servidor devolviera de
// vuelta un megabyte que él mismo mandó. `uuid()` estricto haría el rechazo más
// temprano, pero cambiaría el mensaje que lee una persona por uno de formato.
const ID = z.string().trim().min(1).max(64)

const filaSchema = z.object({
  unidad: z.string().trim().min(1, 'Elige la unidad de venta').max(40),
  // `nullish` y no `optional`: el front manda `null` para «cualquier franja»,
  // y `null` es un valor con significado aquí —la fila que aplica a todo el
  // día—, no la ausencia de un dato.
  franjaId: ID.nullish(),
  temporadaId: ID.nullish(),
  tarifaPublicada: z.coerce
    .number({ invalid_type_error: 'La tarifa tiene que ser un número' })
    .finite('La tarifa tiene que ser un número')
    .nonnegative('La tarifa no puede ser negativa'),
})

const bajaSchema = z.object({
  unidad: z.string().trim().min(1).max(40),
  franjaId: ID.nullish(),
  temporadaId: ID.nullish(),
})

export const rejillaSchema = z.object({
  guardar: z.array(filaSchema).default([]),
  quitar: z.array(bajaSchema).default([]),
})

/**
 * Aplica un diff sobre la rejilla de una pantalla.
 *
 * La franja y la temporada se comprueban contra el catálogo ACTIVO de esta
 * organización antes de escribir. La FK compuesta de la base ya rechazaría una
 * ajena —y es la que de verdad cierra el agujero R2, porque una validación es
 * algo que alguien puede olvidar en la siguiente ruta—; esto es para que se lea
 * una frase en vez de un error de restricción.
 *
 * Una fila con la MISMA clave repetida dentro del mismo envío se rechaza: con
 * `on conflict do update` la segunda pisaría a la primera en silencio y se
 * guardaría un precio que el usuario no vio ganar.
 */
export async function actualizarRejillaCtrl(sitioId: string, body: unknown) {
  const d = validar(rejillaSchema, body)

  // `?? []` sobre los `.default([])` de zod: el tipo inferido los deja
  // `| undefined` aunque en ejecución nunca lo sean. Es el mismo detalle que
  // `actualizarModalidadesCtrl` ya documenta.
  const guardar = (d.guardar ?? []).map((g) => ({
    unidad: String(g.unidad).trim().toLowerCase(),
    franjaId: g.franjaId ?? null,
    temporadaId: g.temporadaId ?? null,
    tarifaPublicada: g.tarifaPublicada,
  }))
  const quitar = (d.quitar ?? []).map((r) => ({
    unidad: String(r.unidad).trim().toLowerCase(),
    franjaId: r.franjaId ?? null,
    temporadaId: r.temporadaId ?? null,
  }))

  const clave = (f: { unidad: string; franjaId: string | null; temporadaId: string | null }) =>
    `${f.unidad}|${f.franjaId ?? ''}|${f.temporadaId ?? ''}`
  const vistas = new Set<string>()
  for (const g of guardar) {
    if (vistas.has(clave(g))) {
      throw new AppError(
        `La misma combinación de unidad, franja y temporada viene dos veces (${g.unidad}).`,
        400,
      )
    }
    vistas.add(clave(g))
  }
  for (const r of quitar) {
    if (vistas.has(clave(r))) {
      throw new AppError(
        `La combinación ${r.unidad} viene a la vez para guardar y para quitar.`,
        400,
      )
    }
  }

  const usados = [...guardar, ...quitar]
  if (usados.some((f) => f.franjaId) || usados.some((f) => f.temporadaId)) {
    const [franjas, temporadas] = await Promise.all([listarFranjas(), listarTemporadas()])
    const okF = new Set(franjas.map((f) => f.id))
    const okT = new Set(temporadas.map((t) => t.id))
    const malaF = usados.find((f) => f.franjaId && !okF.has(f.franjaId))?.franjaId
    if (malaF) {
      throw new AppError(
        `La franja horaria "${malaF}" no existe en esta organización o está desactivada.`,
        400,
      )
    }
    const malaT = usados.find((f) => f.temporadaId && !okT.has(f.temporadaId))?.temporadaId
    if (malaT) {
      throw new AppError(
        `La temporada "${malaT}" no existe en esta organización o está desactivada.`,
        400,
      )
    }
  }

  if (!guardar.length && !quitar.length) {
    return { rejilla: await rejillaDeSitio(sitioId), guardadas: 0, quitadas: 0 }
  }
  const rejilla = await actualizarRejilla(sitioId, { guardar, quitar } as CambiosRejilla)
  if (rejilla === null) throw new AppError('Esa pantalla no existe', 404)
  return { rejilla, guardadas: guardar.length, quitadas: quitar.length }
}

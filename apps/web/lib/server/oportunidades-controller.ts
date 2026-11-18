import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { tienePermiso, type UsuarioSesion } from './auth'
import { soloDe as soloDeCaptacion } from './captacion-controller'
import {
  listarOportunidades,
  obtenerOportunidad,
  crearOportunidad,
  editarOportunidad,
  cambiarEtapa,
  registrarActividad,
  leerCambiosDePropuestas,
  type DatosOportunidad,
} from './oportunidades-repo'
import { obtenerProspecto } from './captacion-repo'
import { ETAPAS_OPORTUNIDAD, TIPOS_ACTIVIDAD_MANUAL, TIPOS_MEDIO, problemaFechas, problemaPresupuesto } from '@/lib/crm'

// ============================================================================
//  lib/server/oportunidades-controller.ts — La forma de entrada de las
//  oportunidades, y quién ve qué.  ADR 0051 §1, §2 y §5.
// ----------------------------------------------------------------------------
//  ⚠️ NINGÚN ESQUEMA ACEPTA `usuarioId`, `etapa` (salvo en su ruta),
//  `ganadaEn`, `perdidaEn` NI `usuarioNombre`.
//   · el vendedor y el autor salen de la sesión: si vinieran en el cuerpo,
//     cualquiera podría dar de alta o reasignar a nombre de otro (VEND-01);
//   · la etapa solo cambia por `POST …/etapa`, que pasa por la regla de
//     `lib/crm.ts` con la fila bloqueada y deja su fila en la línea de tiempo;
//   · las fechas de cierre las pone el repo.
//  Los esquemas son `.strict()`: un campo no declarado es un 400, no un campo
//  que se ignora en silencio y alguien cree haber guardado.
//
//  ─── QUIÉN VE TODO ────────────────────────────────────────────────────────
//  `comercial.aprobar`, NO el nombre del rol — igual que Captación con
//  `captacion.aprobar`. Así la matriz de Administración sigue siendo la única
//  que manda. El prospecto del que cuelga una oportunidad se comprueba con la
//  regla de CAPTACIÓN (ADR 0051 §5: no se abre un segundo sistema de permisos).
// ============================================================================

export async function soloDe(u: UsuarioSesion): Promise<string | null> {
  return (await tienePermiso(u.rol, 'comercial', 'aprobar')) ? null : u.id
}

const NO_EXISTE = 'Esa oportunidad no existe'

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v == null || v === '' ? null : v))
const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .or(z.literal(''))
  .nullish()
  .transform((v) => (v ? v : null))
const monto = z.coerce.number().finite().min(0).max(999_999_999_999).nullish().transform((v) => v ?? null)

const campos = {
  nombre: z.string().trim().min(1).max(200),
  presupuestoMin: monto,
  presupuestoMax: monto,
  fechaInicioDeseada: fecha,
  fechaFinDeseada: fecha,
  fechaDecision: fecha,
  plazas: opcional(1000),
  tiposMedio: z
    .array(z.enum(TIPOS_MEDIO))
    .max(TIPOS_MEDIO.length)
    .nullish()
    .transform((v) => [...new Set(v ?? [])]),
  objetivo: opcional(2000),
}

const altaSchema = z
  .object({
    ...campos,
    prospectoId: z.string().uuid().nullish().transform((v) => v ?? null),
    clienteId: z.string().uuid().nullish().transform((v) => v ?? null),
    nota: opcional(2000),
  })
  .strict()

const edicionSchema = z.object(campos).partial().strict()

function revisarRangos(d: Partial<DatosOportunidad>) {
  if (problemaPresupuesto(d.presupuestoMin ?? null, d.presupuestoMax ?? null)) {
    throw new AppError('El presupuesto mínimo no puede ser mayor que el máximo', 400)
  }
  if (problemaFechas(d.fechaInicioDeseada ?? null, d.fechaFinDeseada ?? null)) {
    throw new AppError('La fecha de inicio no puede ir después de la de fin', 400)
  }
}

const autorDe = (u: UsuarioSesion) => ({ id: u.id, nombre: u.nombre })

const filtroSchema = z.object({
  etapas: z.array(z.enum(ETAPAS_OPORTUNIDAD)).max(ETAPAS_OPORTUNIDAD.length).nullish(),
  clienteId: z.string().uuid().nullish(),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(50),
})

export async function listarOportunidadesCtrl(u: UsuarioSesion, params: URLSearchParams) {
  const f = validar<z.output<typeof filtroSchema>>(filtroSchema as never, {
    etapas: params.get('etapas') ? params.get('etapas')!.split(',') : null,
    clienteId: params.get('clienteId') || null,
    pagina: params.get('pagina') ?? undefined,
    porPagina: params.get('porPagina') ?? undefined,
  })
  const solo = await soloDe(u)
  const r = await listarOportunidades({
    soloDe: solo,
    etapas: f.etapas ?? null,
    clienteId: f.clienteId ?? null,
    limite: f.porPagina,
    desplazamiento: (f.pagina - 1) * f.porPagina,
  })
  return { ...r, pagina: f.pagina, porPagina: f.porPagina, veTodas: solo === null }
}

/**
 * La ficha: la oportunidad, sus actividades, sus cotizaciones y —para la
 * línea de tiempo unida (ADR 0051 §2)— los cambios de esas cotizaciones y la
 * bitácora del prospecto del que salió. Esta última, SOLO si quien mira puede
 * ver ese prospecto con la regla de Captación: el gerente comercial que ve la
 * oportunidad de un vendedor no hereda por eso el permiso de leer sus leads.
 */
export async function obtenerOportunidadCtrl(u: UsuarioSesion, id: string) {
  const solo = await soloDe(u)
  const o = await obtenerOportunidad(id, solo)
  if (!o) throw new AppError(NO_EXISTE, 404)
  const [cambios, prospecto] = await Promise.all([
    leerCambiosDePropuestas(id, solo),
    o.prospectoId ? obtenerProspecto(o.prospectoId, await soloDeCaptacion(u)) : null,
  ])
  return {
    ...o,
    cambios,
    avancesProspecto: (prospecto?.avances ?? []).map((a) => ({
      id: a.id,
      usuarioNombre: a.usuarioNombre,
      etapaAnterior: a.etapaAnterior,
      etapaNueva: a.etapaNueva,
      nota: a.nota,
      canal: a.canal,
      creadoEn: a.creadoEn,
    })),
  }
}

export async function crearOportunidadCtrl(u: UsuarioSesion, body: unknown) {
  const v = validar(altaSchema, body)
  // `nullish().transform()` deja la clave opcional en el tipo: se normaliza
  // aquí a null para que el repo reciba siempre la forma completa.
  const d = {
    nombre: v.nombre,
    presupuestoMin: v.presupuestoMin ?? null,
    presupuestoMax: v.presupuestoMax ?? null,
    fechaInicioDeseada: v.fechaInicioDeseada ?? null,
    fechaFinDeseada: v.fechaFinDeseada ?? null,
    fechaDecision: v.fechaDecision ?? null,
    plazas: v.plazas ?? null,
    tiposMedio: v.tiposMedio ?? [],
    objetivo: v.objetivo ?? null,
    prospectoId: v.prospectoId ?? null,
    clienteId: v.clienteId ?? null,
    nota: v.nota ?? null,
  }
  if (!d.prospectoId && !d.clienteId) throw new AppError('Elige el cliente o el prospecto', 400)
  revisarRangos(d)
  const id = await crearOportunidad(d, autorDe(u), await soloDeCaptacion(u))
  return obtenerOportunidadCtrl(u, id)
}

export async function editarOportunidadCtrl(u: UsuarioSesion, id: string, body: unknown) {
  const d = validar(edicionSchema, body) as Partial<DatosOportunidad>
  revisarRangos(d)
  const ok = await editarOportunidad(id, d, await soloDe(u))
  if (!ok) throw new AppError(NO_EXISTE, 404)
  return obtenerOportunidadCtrl(u, id)
}

const etapaSchema = z
  .object({
    etapa: z.enum(ETAPAS_OPORTUNIDAD),
    nota: opcional(2000),
    motivoPerdida: opcional(2000),
  })
  .strict()

export async function cambiarEtapaCtrl(u: UsuarioSesion, id: string, body: unknown) {
  const d = validar(etapaSchema, body)
  const ok = await cambiarEtapa(
    id,
    { etapa: d.etapa, nota: d.nota ?? null, motivoPerdida: d.motivoPerdida ?? null },
    autorDe(u),
    await soloDe(u),
  )
  if (!ok) throw new AppError(NO_EXISTE, 404)
  return obtenerOportunidadCtrl(u, id)
}

const actividadSchema = z
  .object({
    tipo: z.enum(TIPOS_ACTIVIDAD_MANUAL),
    nota: z.string().trim().min(1).max(2000),
    siguientePaso: opcional(300),
    siguientePasoFecha: fecha,
  })
  .strict()

export async function registrarActividadCtrl(u: UsuarioSesion, id: string, body: unknown) {
  const d = validar(actividadSchema, body)
  const ok = await registrarActividad(
    id,
    {
      tipo: d.tipo,
      nota: d.nota,
      siguientePaso: d.siguientePaso ?? null,
      siguientePasoFecha: d.siguientePasoFecha ?? null,
    },
    autorDe(u),
    await soloDe(u),
  )
  if (!ok) throw new AppError(NO_EXISTE, 404)
  return obtenerOportunidadCtrl(u, id)
}

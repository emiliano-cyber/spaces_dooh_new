import type { Etapa } from './captacion'

// ============================================================================
//  lib/prospectos-nuevos.ts — «Prospectos nuevos» del Resumen de Propuestas
//  (19/11, pedido del dueño: «que se vean los prospectos nuevos»).
// ----------------------------------------------------------------------------
//  Nuevo = dado de alta en los últimos DIAS_NUEVO días. Una semana porque es
//  el ciclo con el que el equipo revisa lo que entró: con «hoy» solo, el lunes
//  no se vería lo del viernes; con un mes, «nuevo» deja de significar algo.
//  Se enseñan MAX_NUEVOS (dos filas de tres en pantalla ancha) y el total, para
//  que «y 4 más» lleve a la pestaña Prospectos en vez de alargar el Resumen.
//
//  Fuera los PERDIDO y RECHAZADO: el bloque es para que alguien les dé
//  seguimiento, y esos ya no tienen nada que trabajar (el mismo criterio que
//  Seguimiento con los prospectos sueltos).
//
//  La consulta (`propuestas-resumen-repo.ts`) ya filtra igual en la base; aquí
//  se vuelve a filtrar porque es lo que se prueba sin base, y es barato.
// ============================================================================

export const DIAS_NUEVO = 7
export const MAX_NUEVOS = 6
export const ETAPAS_FUERA_DE_NUEVOS: Etapa[] = ['PERDIDO', 'RECHAZADO']

const DIA_MS = 86_400_000

export interface FilaProspectoNuevo {
  id: string
  nombre: string
  etapa: Etapa
  /** Quien lo tiene asignado (`prospectos.usuario_id`); null si nadie. */
  vendedor: string | null
  /** ISO, con hora: «hace 2 días» se cuenta desde el instante del alta. */
  creadoEn: string
  contactoNombre: string | null
  telefono: string | null
  email: string | null
  razonSocial: string | null
}

export interface ProspectoNuevo extends FilaProspectoNuevo {
  /** Días completos desde el alta: 0 = hoy (menos de 24 h). */
  dias: number
}

export interface ProspectosNuevos {
  dias: number
  total: number
  lista: ProspectoNuevo[]
}

/** Días completos entre el alta y `ahora`; nunca negativo (relojes desfasados). */
export function diasDesde(iso: string, ahora: Date): number {
  return Math.max(0, Math.floor((ahora.getTime() - Date.parse(iso)) / DIA_MS))
}

export function prospectosNuevos(filas: FilaProspectoNuevo[], ahora: Date): ProspectosNuevos {
  const limite = ahora.getTime() - DIAS_NUEVO * DIA_MS
  const nuevos = filas
    .filter((f) => Date.parse(f.creadoEn) >= limite && !ETAPAS_FUERA_DE_NUEVOS.includes(f.etapa))
    .sort((a, b) => Date.parse(b.creadoEn) - Date.parse(a.creadoEn) || a.id.localeCompare(b.id))
  return {
    dias: DIAS_NUEVO,
    total: nuevos.length,
    lista: nuevos.slice(0, MAX_NUEVOS).map((f) => ({ ...f, dias: diasDesde(f.creadoEn, ahora) })),
  }
}

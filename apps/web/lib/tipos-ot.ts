// ============================================================================
//  lib/tipos-ot.ts — Tipos de tarea de cuadrilla (órdenes de trabajo).
// ----------------------------------------------------------------------------
//  Fuente ÚNICA de qué tareas existen y a qué pantalla aplica cada una.
//
//  Antes esto vivía en tres sitios que decían lo mismo de tres formas:
//   · `TIPO_OT_LABEL` + `TIPO_OT_DIGITAL/FIJA` en la pantalla de Operaciones,
//   · `OT_SOLO_FIJA` en `lib/server/ot-repo.ts` (la validación del servidor),
//   · y un editor de texto libre en Administración → Configuración
//     (`config_negocio.tipos_tarea`) que NO LO LEÍA NADIE.
//
//  Ese tercero es el hallazgo M15 de la auditoría del 04/08/2026: el catálogo
//  aparecía vacío mientras Operaciones tenía una OT de «Montaje de lona». La
//  recomendación era sembrarlo, pero sembrarlo habría sido peor: seguiría sin
//  gobernar nada y encima parecería que sí. La aplicabilidad por tipo de
//  pantalla es una REGLA del producto (una digital no lleva lona ni herrería),
//  no una preferencia que cada organización configure a su gusto.
//
//  Así que el catálogo pasa a ser de solo lectura y sale de aquí, que es lo que
//  el servidor aplica de verdad.
// ============================================================================

import type { TipoOT } from '@/lib/data/types'

export const TIPO_OT_LABEL: Record<TipoOT, string> = {
  MONTAJE_LONA: 'Montaje de lona',
  MONTAJE_DIGITAL: 'Montaje digital',
  DESMONTAJE: 'Desmontaje',
  MANTENIMIENTO_PREVENTIVO: 'Mantenimiento preventivo',
  MANTENIMIENTO_CORRECTIVO: 'Mantenimiento correctivo',
  HERRERIA: 'Herrería',
  ELECTRICO: 'Eléctrico',
  INSPECCION: 'Inspección',
  OTRO: 'Otro',
}

// Tareas que solo tienen sentido en una pantalla FIJA: lona y estructura de
// espectacular. Una digital no las lleva porque no hay ni lona ni herrería.
export const TIPO_OT_SOLO_FIJA: readonly TipoOT[] = ['MONTAJE_LONA', 'HERRERIA']

// `MONTAJE_DIGITAL` quedó OBSOLETO y no se ofrece en ninguna pantalla: el arte
// de una digital se sube por «Subir a producción» (DOOHmain) desde la campaña,
// no por una OT de montaje. Se conserva en el enum porque hay OT históricas con
// ese tipo y borrarlo las dejaría sin etiqueta.
export const TIPO_OT_OBSOLETO: readonly TipoOT[] = ['MONTAJE_DIGITAL']

export const TODOS_TIPOS_OT = Object.keys(TIPO_OT_LABEL) as TipoOT[]

// Tipos ofrecibles para una pantalla. `digital = null` → todavía no se eligió
// pantalla, así que se ofrecen todos los vigentes.
export function tiposOtPara(digital: boolean | null): TipoOT[] {
  const vigentes = TODOS_TIPOS_OT.filter((t) => !TIPO_OT_OBSOLETO.includes(t))
  if (digital == null) return vigentes
  return digital ? vigentes.filter((t) => !TIPO_OT_SOLO_FIJA.includes(t)) : vigentes
}

// ¿Este tipo aplica a esta pantalla? Es la pregunta que hace el servidor al
// crear una OT; se expresa con la MISMA tabla que usa la UI para ofrecerlas,
// para que no puedan discrepar.
export function tipoOtAplica(tipo: string, digital: boolean): boolean {
  if (TIPO_OT_OBSOLETO.includes(tipo as TipoOT)) return false
  if (digital && TIPO_OT_SOLO_FIJA.includes(tipo as TipoOT)) return false
  return tipo in TIPO_OT_LABEL
}

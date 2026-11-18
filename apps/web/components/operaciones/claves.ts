import type { ClaveTexto } from '@/lib/i18n/diccionario'
import type { Prioridad, TipoOT } from '@/lib/data/types'

// ============================================================================
//  components/operaciones/claves.ts — la clave de cada tipo y prioridad de OT.
// ----------------------------------------------------------------------------
//  I18N (lote operaciones parte 2, 2026-11-02). `TIPO_OT_LABEL`
//  (`lib/tipos-ot.ts`) sigue siendo la verdad en espanol, y la usa el
//  servidor; las pantallas de Operaciones pintan con estas claves y
//  `textos/operaciones2.test.ts` exige que su espanol sea IDENTICO a la tabla.
//  Cuando llegue `etiquetaTipoOt(tipo, idioma)` del lote de administracion, se
//  sustituye este mapa sin tocar el espanol.
// ============================================================================

export const CLAVE_TIPO_OT: Record<TipoOT, ClaveTexto> = {
  MONTAJE_LONA: 'operaciones2.tipo-ot.montaje-lona',
  MONTAJE_DIGITAL: 'operaciones2.tipo-ot.montaje-digital',
  DESMONTAJE: 'operaciones2.tipo-ot.desmontaje',
  MANTENIMIENTO_PREVENTIVO: 'operaciones2.tipo-ot.mantenimiento-preventivo',
  MANTENIMIENTO_CORRECTIVO: 'operaciones2.tipo-ot.mantenimiento-correctivo',
  HERRERIA: 'operaciones2.tipo-ot.herreria',
  ELECTRICO: 'operaciones2.tipo-ot.electrico',
  INSPECCION: 'operaciones2.tipo-ot.inspeccion',
  OTRO: 'operaciones2.tipo-ot.otro',
}

// Las prioridades no tienen tabla compartida: la pantalla de Operaciones y la
// ficha de la OT tenian cada una su copia (`PRIORIDAD_LABEL`,
// `PRIORIDAD_LABEL_OT`), que se quedan como estaban.
export const CLAVE_PRIORIDAD: Record<Prioridad, ClaveTexto> = {
  BAJA: 'operaciones2.prioridad.baja',
  NORMAL: 'operaciones2.prioridad.normal',
  ALTA: 'operaciones2.prioridad.alta',
  URGENTE: 'operaciones2.prioridad.urgente',
}

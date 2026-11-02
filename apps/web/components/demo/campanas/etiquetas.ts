import type { ClaveTexto } from '@/lib/i18n/diccionario'
import type {
  TipoCampana,
  EstComercialCampana,
  EtapaPipeline,
  EstValidacionPublicacion,
  EstValidacionCreatividad,
  EstReserva,
  EstOT,
  EstOrdenImpresion,
} from '@/lib/data/types'
import type { EstadoRemoto } from '@/lib/doohmain-estado'

// ============================================================================
//  La CLAVE del diccionario de cada etiqueta de estado que pintan las
//  pantallas de Campanas (lote de ingles, 2026-11-02).
// ----------------------------------------------------------------------------
//  Las etiquetas viven en modulos COMPARTIDOS con otras pantallas
//  (`StatusBadge.tsx`, `lib/data/derive.ts`, `lib/doohmain-estado.ts`), que
//  este lote no toca: siguen siendo la verdad en espanol. Aqui solo se dice
//  que clave traduce cada valor, y `textos/campanas.test.ts` exige que el
//  espanol del diccionario sea IDENTICO al de su modulo. Si alguien cambia
//  «Lista para facturar» alli, la prueba obliga a traerlo aqui. Mismo patron
//  que `CLAVE_ESTATUS` de Propuestas.
// ============================================================================

/** El tipo de campana. Su espanol es el valor crudo que ya se pintaba («HIBRIDA»). */
export const CLAVE_TIPO_CAMPANA: Record<TipoCampana, ClaveTexto> = {
  OOH: 'campanas.tipo.ooh',
  DOOH: 'campanas.tipo.dooh',
  HIBRIDA: 'campanas.tipo.hibrida',
}

export const CLAVE_ESTADO_CAMPANA: Record<EstComercialCampana, ClaveTexto> = {
  DRAFT: 'campanas.estado.draft',
  COTIZACION: 'campanas.estado.cotizacion',
  CONFIRMADA: 'campanas.estado.confirmada',
  ACTIVA: 'campanas.estado.activa',
  COMPLETADA: 'campanas.estado.completada',
  CANCELADA: 'campanas.estado.cancelada',
  LISTA_FACTURAR: 'campanas.estado.lista-facturar',
}

export const CLAVE_ETAPA: Record<EtapaPipeline, ClaveTexto> = {
  reservada: 'campanas.etapa.reservada',
  confirmada: 'campanas.etapa.confirmada',
  oc_recibida: 'campanas.etapa.oc-recibida',
  creativo_recibido: 'campanas.etapa.creativo-recibido',
  creativo_validado: 'campanas.etapa.creativo-validado',
  enviada_dominio: 'campanas.etapa.enviada-dominio',
  publicada: 'campanas.etapa.publicada',
  en_imprenta: 'campanas.etapa.en-imprenta',
  en_produccion: 'campanas.etapa.en-produccion',
  instalada: 'campanas.etapa.instalada',
  reporte_generado: 'campanas.etapa.reporte-generado',
  lista_facturar: 'campanas.etapa.lista-facturar',
  facturada: 'campanas.etapa.facturada',
}

export const CLAVE_VALIDACION_PUB: Record<EstValidacionPublicacion, ClaveTexto> = {
  PENDIENTE: 'campanas.validacion-pub.pendiente',
  APROBADA: 'campanas.validacion-pub.aprobada',
  RECHAZADA: 'campanas.validacion-pub.rechazada',
}

export const CLAVE_CREATIVIDAD: Record<EstValidacionCreatividad, ClaveTexto> = {
  PENDIENTE: 'campanas.creatividad.pendiente',
  VALIDADA: 'campanas.creatividad.validada',
  RECHAZADA: 'campanas.creatividad.rechazada',
}

export const CLAVE_RESERVA: Record<EstReserva, ClaveTexto> = {
  TENTATIVA: 'campanas.reserva.tentativa',
  CONFIRMADA: 'campanas.reserva.confirmada',
  CANCELADA: 'campanas.reserva.cancelada',
}

export const CLAVE_OT: Record<EstOT, ClaveTexto> = {
  PENDIENTE: 'campanas.ot.pendiente',
  ASIGNADA: 'campanas.ot.asignada',
  EN_PROCESO: 'campanas.ot.en-proceso',
  BLOQUEADA: 'campanas.ot.bloqueada',
  EN_REVISION: 'campanas.ot.en-revision',
  COMPLETADA: 'campanas.ot.completada',
  RECHAZADA: 'campanas.ot.rechazada',
  CANCELADA: 'campanas.ot.cancelada',
}

export const CLAVE_IMPRESION: Record<EstOrdenImpresion, ClaveTexto> = {
  ARTE_RECIBIDO: 'campanas.impresion.arte-recibido',
  VALIDADO: 'campanas.impresion.validado',
  EN_PRODUCCION: 'campanas.impresion.en-produccion',
  IMPRESO: 'campanas.impresion.impreso',
  LISTO_MONTAJE: 'campanas.impresion.listo-montaje',
}

export const CLAVE_ESTADO_REMOTO: Record<EstadoRemoto, ClaveTexto> = {
  active: 'campanas.remoto.active',
  pause: 'campanas.remoto.pause',
  finished: 'campanas.remoto.finished',
  pending: 'campanas.remoto.pending',
  vencida: 'campanas.remoto.vencida',
  programada: 'campanas.remoto.programada',
  eliminada: 'campanas.remoto.eliminada',
  no_encontrada: 'campanas.remoto.no-encontrada',
}

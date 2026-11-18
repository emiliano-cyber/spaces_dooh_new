import type { ClaveTexto } from '@/lib/i18n/diccionario'
import type { EstComercial, EstContrato, EstPagoRenta, TipoMedio } from '@/lib/data/types'

// ============================================================================
//  La CLAVE de traduccion de cada etiqueta compartida que pintan las pantallas
//  del lote «comercial» (version en ingles, 2026-11-02).
// ----------------------------------------------------------------------------
//  `SITIO_LABEL`, `CONTRATO_LABEL`, `PAGO_LABEL` (`StatusBadge.tsx`) y
//  `TIPO_MEDIO_LABEL` (`lib/tipo-medio.ts`) los usan muchas pantallas que NO son
//  de este lote, y siguen siendo la verdad en espanol: no se tocan. Las
//  pantallas del lote pintan `t(CLAVE_…[valor])`, y
//  `lib/i18n/pantallas-comercial.test.ts` exige que el espanol del diccionario
//  reproduzca EXACTAMENTE la etiqueta original. Si alguien cambia una alla, esa
//  prueba obliga a traerla aqui — el mismo patron que `CLAVE_ESTATUS` de
//  propuestas con `EST`, y que el menu con `nav.ts`.
//
//  Si un dia esas etiquetas se traducen en su propio lote, estas claves se
//  pueden sustituir por las suyas sin cambiar nada en espanol.
// ============================================================================

export const CLAVE_SITIO_ESTATUS: Record<EstComercial, ClaveTexto> = {
  DISPONIBLE: 'comercial.sitio-estatus.disponible',
  RESERVADO: 'comercial.sitio-estatus.reservado',
  OCUPADO: 'comercial.sitio-estatus.ocupado',
  BLOQUEADO: 'comercial.sitio-estatus.bloqueado',
  EN_MANTENIMIENTO: 'comercial.sitio-estatus.en-mantenimiento',
  BAJA: 'comercial.sitio-estatus.baja',
}

export const CLAVE_TIPO_MEDIO: Record<TipoMedio, ClaveTexto> = {
  ESPECTACULAR: 'comercial.tipo-medio.espectacular',
  PANTALLA_DIGITAL: 'comercial.tipo-medio.pantalla-digital',
  PUENTE_PEATONAL: 'comercial.tipo-medio.puente-peatonal',
  MOBILIARIO_URBANO: 'comercial.tipo-medio.mobiliario-urbano',
  MURAL: 'comercial.tipo-medio.mural',
  VALLA: 'comercial.tipo-medio.valla',
  OTRO: 'comercial.tipo-medio.otro',
}

export const CLAVE_CONTRATO_ESTATUS: Record<EstContrato, ClaveTexto> = {
  VIGENTE: 'comercial.contrato-estatus.vigente',
  POR_VENCER: 'comercial.contrato-estatus.por-vencer',
  VENCIDO: 'comercial.contrato-estatus.vencido',
  RENOVADO: 'comercial.contrato-estatus.renovado',
  CANCELADO: 'comercial.contrato-estatus.cancelado',
  INCOMPLETO: 'comercial.contrato-estatus.incompleto',
}

export const CLAVE_PAGO_ESTATUS: Record<EstPagoRenta, ClaveTexto> = {
  PAGADO: 'comercial.pago-estatus.pagado',
  PENDIENTE: 'comercial.pago-estatus.pendiente',
  VENCIDO: 'comercial.pago-estatus.vencido',
}

/** La etiqueta de un tipo de medio en el idioma vigente; uno desconocido cae
 *  a `etiquetaTipoMedio` (`lib/tipo-medio.ts`), que lo pinta como siempre. */
export function claveTipoMedio(tipo: string | null | undefined): ClaveTexto | null {
  return tipo && tipo in CLAVE_TIPO_MEDIO ? CLAVE_TIPO_MEDIO[tipo as TipoMedio] : null
}

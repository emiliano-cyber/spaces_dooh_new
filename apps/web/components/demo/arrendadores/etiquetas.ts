import type { ClaveTexto } from '@/lib/i18n/diccionario'
import type { TipoIncidencia } from '@/lib/data/types'
import { faltantesDeContrato } from '@/lib/data/derive'

// ============================================================================
//  Etiquetas de Arrendadores en el idioma de quien mira (lote de ingles,
//  2026-11-02).
//
//  `textoVencimiento` (`lib/renta-periodicidad.ts`), `faltaEnContratos` y
//  `LICENCIA_LABEL` (`lib/data/derive.ts`) devuelven espanol y los usan otros
//  modulos (Finanzas, el Dashboard, las alertas). No se tocan: aqui se repite
//  su decision con claves, y `textos/arrendadores.test.ts` exige que en espanol
//  digan EXACTAMENTE lo mismo, caso por caso.
// ============================================================================

type T = (clave: ClaveTexto, valores?: Record<string, string | number>) => string

/** Lo que pinta `textoVencimiento(dias)`: «hoy», «en 3 días», «hace 1 día». */
export function textoVencimientoRel(dias: number, t: T): string {
  if (dias === 0) return t('arrendadores.vence.hoy')
  if (dias > 0) return t(dias === 1 ? 'arrendadores.vence.en.uno' : 'arrendadores.vence.en.otros', { n: dias })
  const atraso = Math.abs(dias)
  return t(atraso === 1 ? 'arrendadores.vence.hace.uno' : 'arrendadores.vence.hace.otros', { n: atraso })
}

// El orden de `FALTANTES_ORDEN` (`derive.ts`), que no se exporta.
const ORDEN_FALTANTES = ['arrendador', 'vigencia', 'importe', 'periodicidad'] as const
const CLAVE_FALTANTE: Record<(typeof ORDEN_FALTANTES)[number], ClaveTexto> = {
  arrendador: 'arrendadores.falta.arrendador',
  vigencia: 'arrendadores.falta.vigencia',
  importe: 'arrendadores.falta.importe',
  periodicidad: 'arrendadores.falta.periodicidad',
}

/** Lo que pinta `faltaEnContratos(contratos)`: «vigencia y periodicidad». */
export function textoFaltaEnContratos(contratos: Parameters<typeof faltantesDeContrato>[0][], t: T): string {
  const set = new Set<string>()
  for (const c of contratos) for (const f of faltantesDeContrato(c)) set.add(f)
  const l = ORDEN_FALTANTES.filter((f) => set.has(f)).map((f) => t(CLAVE_FALTANTE[f]))
  if (!l.length) return ''
  if (l.length === 1) return l[0]
  return t('arrendadores.falta.y', { lista: l.slice(0, -1).join(', '), ultimo: l[l.length - 1] })
}

/** La clave de cada `LICENCIA_LABEL`. Un tipo desconocido es «Permiso». */
export const CLAVE_LICENCIA: Record<string, ClaveTexto> = {
  MUNICIPAL: 'arrendadores.licencia.municipal',
  AMBIENTAL: 'arrendadores.licencia.ambiental',
  ESTRUCTURAL: 'arrendadores.licencia.estructural',
  OTRO: 'arrendadores.licencia.otro',
}

export const CLAVE_INCIDENCIA: Record<TipoIncidencia, ClaveTexto> = {
  LEGAL: 'arrendadores.incidencia.legal',
  MANTENIMIENTO: 'arrendadores.incidencia.mantenimiento',
  VANDALISMO: 'arrendadores.incidencia.vandalismo',
  CLIMA: 'arrendadores.incidencia.clima',
  SUSPENSION_OPERATIVA: 'arrendadores.incidencia.suspension',
  ACCIDENTE: 'arrendadores.incidencia.accidente',
  OTRO: 'arrendadores.incidencia.otro',
} as Record<TipoIncidencia, ClaveTexto>

/** El metodo de pago se GUARDA en mayusculas; se pinta con su clave. */
export const CLAVE_METODO_PAGO: Record<string, ClaveTexto> = {
  TRANSFERENCIA: 'arrendadores.metodo.transferencia',
  EFECTIVO: 'arrendadores.metodo.efectivo',
  CHEQUE: 'arrendadores.metodo.cheque',
  TARJETA: 'arrendadores.metodo.tarjeta',
  OTRO: 'arrendadores.metodo.otro',
}

/** La etiqueta de cada campo del historial (`CAMPOS`, lib/contrato-cambios.ts). */
export const CLAVE_CAMPO_CONTRATO: Record<string, ClaveTexto> = {
  arrendadorId: 'arrendadores.campo.arrendador-id',
  razonSocialId: 'arrendadores.campo.razon-social-id',
  entidadId: 'arrendadores.campo.entidad-id',
  fechaInicio: 'arrendadores.campo.fecha-inicio',
  fechaFin: 'arrendadores.campo.fecha-fin',
  montoRenta: 'arrendadores.campo.monto-renta',
  periodicidad: 'arrendadores.campo.periodicidad',
  moneda: 'arrendadores.campo.moneda',
  deposito: 'arrendadores.campo.deposito',
  autoRenovable: 'arrendadores.campo.auto-renovable',
  documentoUrl: 'arrendadores.campo.documento-url',
}

/** Lo que falta en el documento y DONDE se captura, tal como lo redacta
 *  `lib/contrato-documento.ts` (que no se toca): la barra los traduce. */
export const CLAVE_FALTANTE_DOC: Record<string, ClaveTexto> = {
  'Razón social de tu empresa': 'arrendadores.faltante.razon-empresa',
  'RFC de tu empresa': 'arrendadores.faltante.rfc-empresa',
  'Domicilio fiscal de tu empresa': 'arrendadores.faltante.domicilio-empresa',
  'Representante legal de tu empresa': 'arrendadores.faltante.representante',
  'Nombre del arrendador': 'arrendadores.faltante.nombre-arrendador',
  'RFC del arrendador': 'arrendadores.faltante.rfc-arrendador',
  'Domicilio del arrendador': 'arrendadores.faltante.domicilio-arrendador',
  'Dirección del espacio': 'arrendadores.faltante.direccion-espacio',
  'Fecha de inicio': 'arrendadores.faltante.fecha-inicio',
  'Fecha de fin': 'arrendadores.faltante.fecha-fin',
  'Importe de la renta': 'arrendadores.faltante.importe',
  'Periodicidad del pago': 'arrendadores.faltante.periodicidad',
}
export const CLAVE_DONDE_DOC: Record<string, ClaveTexto> = {
  'Administración › Datos fiscales de la empresa': 'arrendadores.donde.admin',
  'Arrendadores › ficha del arrendador': 'arrendadores.donde.ficha',
  'la ficha de este contrato': 'arrendadores.donde.contrato',
  'Inventario › ficha de la pantalla o del predio': 'arrendadores.donde.inventario',
}

export const CLAVE_PARTE: Record<'ARRENDADOR' | 'ARRENDATARIO', ClaveTexto> = {
  ARRENDADOR: 'arrendadores.parte.arrendador',
  ARRENDATARIO: 'arrendadores.parte.arrendatario',
}

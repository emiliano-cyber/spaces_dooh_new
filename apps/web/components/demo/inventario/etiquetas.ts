import type { ClaveTexto } from '@/lib/i18n/diccionario'
import type { TipoMedio } from '@/lib/data/types'
import type { Sitio } from '@/lib/data/client'
import { esDigital, SITIO_LABEL } from '@/components/demo/StatusBadge'
import { CLAVE_SITIO_ESTATUS, claveTipoMedio } from '@/components/demo/comercial/claves'
import { etiquetaTipoMedio } from '@/lib/tipo-medio'

// ============================================================================
//  Etiquetas del inventario en el idioma de quien mira (lote de ingles,
//  2026-11-02).
//
//  `medioLabel` (`lib/data/derive.ts`) y `disponibilidadInventario`
//  (`StatusBadge.tsx`) devuelven espanol y los usa mas gente (Comercial, el
//  Dashboard, la exportacion a Excel). No se tocan: aqui se repite su DECISION
//  con claves, y `textos/inventario.test.ts` exige que en espanol estas
//  funciones digan EXACTAMENTE lo mismo que aquellas, caso por caso. Si alguien
//  cambia una regla alla, la prueba obliga a traerla aqui.
// ============================================================================

type T = (clave: ClaveTexto, valores?: Record<string, string | number>) => string

/** Lo que pinta `medioLabel(s)`: «Digital» o «Fija». */
export function textoMedio(s: Pick<Sitio, 'tipoMedio' | 'esRotativo' | 'exhibicion'>, t: T): string {
  const digital =
    s.tipoMedio === 'PANTALLA_DIGITAL' || !!s.esRotativo || s.exhibicion === 'digital' || s.exhibicion === 'rotativo'
  return t(digital ? 'inventario.medio.digital' : 'inventario.medio.fija')
}

/** El texto de `disponibilidadInventario(s)`, rama por rama. */
export function textoDisponibilidad(s: Parameters<typeof esDigital>[0] & {
  estatusComercial: keyof typeof SITIO_LABEL
  totalSpots?: number | null
  spotsDisponibles?: number | null
}, t: T): string {
  if (s.estatusComercial === 'BLOQUEADO' || s.estatusComercial === 'EN_MANTENIMIENTO' || s.estatusComercial === 'BAJA') {
    return t(CLAVE_SITIO_ESTATUS[s.estatusComercial])
  }
  if (esDigital(s)) {
    const total = s.totalSpots ?? null
    const libres = s.spotsDisponibles ?? null
    if (total == null || libres == null) return t('inventario.disponibilidad.sin-slots')
    if (libres <= 0) return t('inventario.disponibilidad.sin-libres')
    return t('inventario.disponibilidad.libres', { libres, total })
  }
  const ocupada = s.estatusComercial === 'OCUPADO' || s.estatusComercial === 'RESERVADO'
  return t(ocupada ? 'inventario.disponibilidad.ocupado' : 'inventario.disponibilidad.disponible')
}

/** El tipo de medio con la clave de Comercial; uno desconocido, como siempre. */
export function textoTipoMedio(tipo: string | null | undefined, t: T): string {
  const k = claveTipoMedio(tipo)
  return k ? t(k) : etiquetaTipoMedio(tipo as TipoMedio)
}

/** Los tipos que ofrecen el asistente de contrato y el alta manual. */
export const CLAVE_TIPO_PANTALLA: Partial<Record<TipoMedio, ClaveTexto>> = {
  ESPECTACULAR: 'inventario.tipo.espectacular',
  PANTALLA_DIGITAL: 'inventario.tipo.pantalla-digital',
  MURAL: 'inventario.tipo.muro',
  VALLA: 'inventario.tipo.valla',
  MOBILIARIO_URBANO: 'inventario.tipo.mobiliario',
  PUENTE_PEATONAL: 'inventario.tipo.puente',
  OTRO: 'inventario.tipo.otro',
}

/** Como se pinta el estado de una fila de la carga masiva. */
export const CLAVE_ESTADO_FILA: Record<'ok' | 'creado' | 'actualizado' | 'advertencia' | 'error', ClaveTexto> = {
  ok: 'inventario.carga.estado.valida',
  creado: 'inventario.carga.estado.creado',
  actualizado: 'inventario.carga.estado.actualizado',
  advertencia: 'inventario.carga.estado.advertencia',
  error: 'inventario.carga.estado.error',
}

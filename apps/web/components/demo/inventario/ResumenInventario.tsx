'use client'

import { Monitor, CheckCircle2, FileWarning, Home } from 'lucide-react'
import { cn } from '@/lib/cn'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { KPICard } from '@/components/demo/KPICard'
import { disponibilidadInventario, esDigital, type Tono } from '@/components/demo/StatusBadge'
import type { Sitio } from '@/lib/data/client'
import { useTexto } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'

// ============================================================================
//  Resumen del inventario: los cuatro indicadores y los chips de filtro que van
//  encima de la tabla (rediseño del 26/10, con el lenguaje del Dashboard).
//
//  Vive en SU archivo y no dentro de `InventarioTabla.tsx` a propósito:
//  `candado-inventario-y-fichas.test.ts` recorta cada celda de ese archivo
//  hasta la siguiente `function` y cuenta sus `return (`. Una pieza visual más
//  ahí dentro cambiaría esas cuentas sin cambiar nada de lo que vigilan.
//
//  Todo son cuentas sobre lo que la tabla YA tiene en memoria; no hay
//  endpoint nuevo ni cálculo de negocio. Los filtros solo deciden qué filas se
//  pintan: la tabla los aplica sobre su misma lista `filtrados`, así que la
//  descarga, «Seleccionar todo» y el cambio masivo siguen operando sobre lo
//  que se ve.
// ============================================================================

/** De quién depende el costo de la pantalla: contrato de renta, ninguno, o propia. */
export type ClaseContrato = 'con' | 'sin' | 'propia'
export type ClaseMedio = 'digital' | 'fija'

/**
 * Misma resolución que la columna Arrendador/Renta de la tabla: una pantalla
 * propia no tiene contrato a propósito (su costo es luz y operación); una que
 * no es propia y no tiene contrato es un pendiente.
 */
export function claseContrato(s: Pick<Sitio, 'propio'>, tieneContrato: boolean): ClaseContrato {
  if (s.propio) return 'propia'
  return tieneContrato ? 'con' : 'sin'
}

export function claseMedio(s: Sitio): ClaseMedio {
  return esDigital(s) ? 'digital' : 'fija'
}

/** El tono de `disponibilidadInventario` agrupa la disponibilidad que ya se pinta en la fila. */
export function tonoDisponibilidad(s: Sitio): Tono {
  return disponibilidadInventario(s).tono
}

// I18N (2026-11-02) · la clave de cada etiqueta; el espanol es el de siempre.
const ETIQUETA_DISP: Partial<Record<Tono, ClaveTexto>> = {
  verde: 'inventario.disp.verde',
  ambar: 'inventario.disp.ambar',
  rojo: 'inventario.disp.rojo',
  neutro: 'inventario.disp.neutro',
}

export type FiltrosInventario = {
  disp: Tono | null
  medio: ClaseMedio | null
  contrato: ClaseContrato | null
}
export const FILTROS_VACIOS: FiltrosInventario = { disp: null, medio: null, contrato: null }

function cuenta<T extends string>(lista: T[]): Map<T, number> {
  const m = new Map<T, number>()
  for (const k of lista) m.set(k, (m.get(k) ?? 0) + 1)
  return m
}

// ─── Indicadores ────────────────────────────────────────────────────────────

export const IndicadoresInventario = ({
  sitios,
  tieneContrato,
}: {
  sitios: Sitio[]
  tieneContrato: (s: Sitio) => boolean
}) => {
  const t = useTexto()
  const medios = cuenta(sitios.map(claseMedio))
  const disp = cuenta(sitios.map(tonoDisponibilidad))
  const contratos = cuenta(sitios.map((s) => claseContrato(s, tieneContrato(s))))
  const total = sitios.length
  const disponibles = disp.get('verde') ?? 0
  const parciales = disp.get('ambar') ?? 0
  const sinContrato = contratos.get('sin') ?? 0
  const propias = contratos.get('propia') ?? 0
  return (
    <CardColapsable id="inventario.indicadores" titulo={t('inventario.indicadores')}>
      {/* Misma rejilla que el Dashboard: 4 columnas solo desde xl, porque entre
          1024 y 1279 el sidebar deja cada tarjeta demasiado angosta. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label={t('inventario.kpi.pantallas')}
          value={String(total)}
          sub={t('inventario.kpi.medios', { digitales: medios.get('digital') ?? 0, fijas: medios.get('fija') ?? 0 })}
          icon={<Monitor className="h-4 w-4" />}
        />
        {/* Disponibles = las que se venden enteras hoy. Una digital con parte
            de sus slots vendidos sigue siendo vendible, pero no «disponible»:
            se cuenta aparte en la aclaración para no esconderla. */}
        <KPICard
          label={t('inventario.kpi.disponibles')}
          value={String(disponibles)}
          sub={
            parciales
              ? t('inventario.kpi.disponibles.sub-parciales', { total, n: parciales })
              : t('inventario.kpi.disponibles.sub', { total })
          }
          tono={disponibles > 0 ? 'verde' : 'neutro'}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <KPICard
          label={t('inventario.kpi.sin-contrato')}
          value={String(sinContrato)}
          sub={sinContrato > 0 ? t('inventario.kpi.sin-contrato.sub') : t('inventario.kpi.sin-contrato.ninguno')}
          tono={sinContrato > 0 ? 'ambar' : 'neutro'}
          icon={<FileWarning className="h-4 w-4" />}
        />
        <KPICard
          label={t('inventario.kpi.propias')}
          value={String(propias)}
          sub={t('inventario.kpi.propias.sub')}
          icon={<Home className="h-4 w-4" />}
        />
      </div>
    </CardColapsable>
  )
}

// ─── Chips de filtro ────────────────────────────────────────────────────────

const Chip = ({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={activo}
    className={cn(
      // `bg-transparent` explícito en el inactivo: sin preflight, un <button>
      // sin fondo hereda el gris del sistema operativo (ver inventario/page.tsx).
      'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      activo
        ? 'border-accent bg-accent-soft font-medium text-ink'
        : 'border-border bg-transparent text-muted hover:text-ink',
    )}
  >
    {children}
  </button>
)

const Grupo = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className="text-[11px] text-muted">{titulo}:</span>
    {children}
  </div>
)

/**
 * Los chips cuentan sobre el inventario COMPLETO, no sobre lo ya filtrado: así
 * el número dice cuántas hay de cada cosa, y no cambia de valor al pulsar otro
 * chip. Pulsar el chip activo lo quita.
 */
export const ChipsFiltroInventario = ({
  sitios,
  tieneContrato,
  filtros,
  onCambio,
}: {
  sitios: Sitio[]
  tieneContrato: (s: Sitio) => boolean
  filtros: FiltrosInventario
  onCambio: (f: FiltrosInventario) => void
}) => {
  const t = useTexto()
  const disp = cuenta(sitios.map(tonoDisponibilidad))
  const medios = cuenta(sitios.map(claseMedio))
  const contratos = cuenta(sitios.map((s) => claseContrato(s, tieneContrato(s))))
  const alternar = <K extends keyof FiltrosInventario>(k: K, v: FiltrosInventario[K]) =>
    onCambio({ ...filtros, [k]: filtros[k] === v ? null : v })
  const ORDEN_DISP: Tono[] = ['verde', 'ambar', 'rojo', 'neutro']
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <Grupo titulo={t('inventario.chips.disponibilidad')}>
        {/* Solo los grupos que existen: un chip con (0) no filtra nada útil. */}
        {ORDEN_DISP.filter((tono) => (disp.get(tono) ?? 0) > 0).map((tono) => (
          <Chip key={tono} activo={filtros.disp === tono} onClick={() => alternar('disp', tono)}>
            {t(ETIQUETA_DISP[tono]!)} <span className="demo-num">({disp.get(tono)})</span>
          </Chip>
        ))}
      </Grupo>
      <Grupo titulo={t('inventario.chips.medio')}>
        <Chip activo={filtros.medio === 'digital'} onClick={() => alternar('medio', 'digital')}>
          {t('inventario.medio.digital')} <span className="demo-num">({medios.get('digital') ?? 0})</span>
        </Chip>
        <Chip activo={filtros.medio === 'fija'} onClick={() => alternar('medio', 'fija')}>
          {t('inventario.medio.fija')} <span className="demo-num">({medios.get('fija') ?? 0})</span>
        </Chip>
      </Grupo>
      <Grupo titulo={t('inventario.chips.contrato')}>
        <Chip activo={filtros.contrato === 'con'} onClick={() => alternar('contrato', 'con')}>
          {t('inventario.chips.con-contrato')} <span className="demo-num">({contratos.get('con') ?? 0})</span>
        </Chip>
        <Chip activo={filtros.contrato === 'sin'} onClick={() => alternar('contrato', 'sin')}>
          {t('inventario.kpi.sin-contrato')} <span className="demo-num">({contratos.get('sin') ?? 0})</span>
        </Chip>
        <Chip activo={filtros.contrato === 'propia'} onClick={() => alternar('contrato', 'propia')}>
          {t('inventario.chips.propia')} <span className="demo-num">({contratos.get('propia') ?? 0})</span>
        </Chip>
      </Grupo>
    </div>
  )
}

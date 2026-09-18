'use client'

import { AlertTriangle } from 'lucide-react'
import {
  DIMENSIONES_UI,
  GRANULARIDADES_UI,
  type DimensionUI,
  type FiltrosReporte,
  type GranularidadUI,
} from './consulta'

// ============================================================================
//  Los tres controles del reporte: dimensión, rango y granularidad.
// ----------------------------------------------------------------------------
//  Es UN tablero con un selector de dimensión, no cinco pantallas. El dueño
//  pidió rentabilidad por sitio, por m², por trimestre, por consumo de luz y
//  por operación: son cinco preguntas sobre los MISMOS números agrupados de
//  otra forma, así que cinco secciones serían cinco copias de la misma tabla.
//
//  Este componente no decide nada: la validación del rango y la construcción
//  de la petición viven en `consulta.ts`, que sí se prueba (aquí no llega
//  vitest, que no monta jsdom). Lo único que hace es pintar y avisar.
// ============================================================================

const campoCls =
  'h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function FiltrosRentabilidad({
  filtros,
  motivo,
  onCambio,
}: {
  filtros: FiltrosReporte
  /** El porqué del rango inválido, o `null`. */
  motivo: string | null
  onCambio: (f: FiltrosReporte) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted">Agrupar</span>
          <select
            className={campoCls}
            value={filtros.dimension}
            onChange={(e) => onCambio({ ...filtros, dimension: e.target.value as DimensionUI })}
          >
            {/* Las cuatro, a secas. Tres llevaban «(en preparación)» desde que
                la pantalla nació con ellas devolviendo 501; la ola 2 cerró las
                tres motores y la etiqueta se quedó, así que el desplegable
                ofrecía «Por trimestre (en preparación)» y al elegirla calculaba
                perfectamente. Es un texto: no rompe nada y no lo ve ninguna
                prueba — apareció al abrir la app en un navegador. */}
            {DIMENSIONES_UI.map((d) => (
              <option key={d.valor} value={d.valor}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted">Desde</span>
          <input
            type="date"
            className={campoCls}
            value={filtros.desde}
            onChange={(e) => onCambio({ ...filtros, desde: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted">Hasta</span>
          <input
            type="date"
            className={campoCls}
            value={filtros.hasta}
            onChange={(e) => onCambio({ ...filtros, hasta: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted">Periodos</span>
          <select
            className={campoCls}
            value={filtros.granularidad}
            onChange={(e) => onCambio({ ...filtros, granularidad: e.target.value as GranularidadUI })}
          >
            {GRANULARIDADES_UI.map((g) => (
              <option key={g.valor} value={g.valor}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-[12px] text-muted">
        {DIMENSIONES_UI.find((d) => d.valor === filtros.dimension)?.ayuda}
      </p>

      {/* El motivo se pinta pegado a los controles que lo causan, no arriba en
          una banda: quien acaba de escribir una fecha mala tiene que verlo sin
          buscarlo. */}
      {motivo ? (
        <p className="flex items-center gap-1.5 text-[13px] text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {motivo}
        </p>
      ) : null}
    </div>
  )
}

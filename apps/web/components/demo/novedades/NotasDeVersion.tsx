import { agruparPorTipo, type EntradaNovedades, type TipoNovedad } from '@/lib/novedades'

// ============================================================================
//  NotasDeVersion — las notas de UNA version, agrupadas por tipo.
//  Lo pintan tres sitios: el dialogo de despues de instalar, la pagina de
//  Novedades y el panel de Actualizaciones (antes de instalar). Una sola
//  forma de pintarlas, con su prueba (`NotasDeVersion.test.ts`).
//
//  Sin hooks y sin 'use client': no tiene estado, asi que sirve igual dentro
//  de un componente de cliente y en `renderToStaticMarkup` de la prueba. El
//  texto va como hijo de React, nunca como HTML: lo escribio un desarrollador,
//  pero lo de `notas_disponibles` llega desde otra imagen.
// ============================================================================

export const SIN_NOTAS = 'Esta versión no trae notas'

const CLASE_TIPO: Record<TipoNovedad, string> = {
  NUEVO: 'bg-success/10 text-success',
  AJUSTADO: 'bg-accent/10 text-accent',
  CORREGIDO: 'bg-warning/10 text-warning',
}

export function NotasDeVersion({ notas }: { notas: EntradaNovedades | null }) {
  if (!notas) return <p className="text-[12px] text-muted">{SIN_NOTAS}</p>
  return (
    <div className="space-y-3">
      {agruparPorTipo(notas.items).map((g) => (
        <div key={g.tipo} className="space-y-1">
          <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${CLASE_TIPO[g.tipo]}`}>
            {g.etiqueta}
          </span>
          <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink">
            {g.textos.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

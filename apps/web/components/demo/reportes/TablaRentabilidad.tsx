'use client'

import { useCallback, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { FilaRentabilidad, ReporteRentabilidad } from '@/lib/data/reportes'
import {
  COLUMNAS_DESGLOSE,
  columnasDeDimension,
  desgloseDeFila,
  formatoCelda,
  ordenarFilas,
  resumenVisitasPorTipo,
  totalDeColumna,
  valorDeColumna,
  type ColumnaReporte,
  type DefinicionColumna,
  type Orden,
} from './tabla'

// ============================================================================
//  La tabla del reporte. Pinta LAS COLUMNAS DE SU DIMENSIÓN, y ordena.
// ----------------------------------------------------------------------------
//  Pintaba siempre las siete de `sitio`, y por eso «Por operación» calculaba
//  bien sin enseñar ni una visita ni una hora. El juego de columnas, el
//  encabezado de la primera y el orden inicial salen de `tabla.ts`, que sí se
//  prueba: aquí no llega vitest (no monta jsdom), así que este archivo no
//  decide nada — recorre lo que la dimensión declara.
// ============================================================================

function Celda({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-2 py-2 align-middle', className)}>{children}</td>
}

// Rojo si pierde, verde si gana. El color lo pone quien pinta, no el
// formateador (`formatMonto` ya mete los negativos entre paréntesis, que es la
// convención contable: «$ -156,986.66» se lee mal en una columna de cifras).
const tonoMargen = (n: number) => (n < 0 ? 'text-error' : n > 0 ? 'text-success' : 'text-ink')

// Solo las columnas de margen se colorean. Pintar de rojo un costo alto diría
// que gastar es un fallo, y el ingreso ya se lee por su magnitud.
const COLOREADAS: ReadonlySet<ColumnaReporte> = new Set<ColumnaReporte>([
  'margen',
  'margenPct',
  'margenPorM2',
])

// El porqué de la raya, en el título de la celda: sin él, una celda con «—» se
// lee como un dato que falta por un fallo. Son los dos `null` con significado
// que devuelve el motor.
const MOTIVO_RAYA: Partial<Record<ColumnaReporte, string>> = {
  margenPct: 'Sin ingreso en el rango: no hay porcentaje que calcular',
  costoOperacionPct: 'Sin ingreso en el rango: no hay proporción que calcular',
  horasEnSitio: 'Ninguna visita del rango tiene registradas sus dos marcas de tiempo',
}

export function TablaRentabilidad({
  reporte,
  orden,
  onOrdenar,
}: {
  reporte: ReporteRentabilidad
  orden: Orden
  onOrdenar: (columna: ColumnaReporte) => void
}) {
  const columnas = columnasDeDimension(reporte.dimension)
  const filas = ordenarFilas(reporte.filas, orden, reporte.dimension)
  const t = reporte.totales
  // Qué filas tienen abierto su desglose por periodo. Es estado de PRESENTACIÓN
  // y vive aquí: no cambia lo que se le pide al endpoint.
  const [abiertas, setAbiertas] = useState<ReadonlySet<string>>(new Set())
  const alternar = useCallback((clave: string) => {
    setAbiertas((previas) => {
      const siguientes = new Set(previas)
      if (!siguientes.delete(clave)) siguientes.add(clave)
      return siguientes
    })
  }, [])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
            {columnas.map((c) => (
              <th
                key={c.clave}
                // `whitespace-nowrap` en las numéricas: con nueve columnas, la
                // celda de una cifra se estrecha hasta partir «$ 144,000.00» en
                // dos renglones, y una cifra partida no se lee de un vistazo
                // —esto se presenta en un proyector—. La tabla ya tiene
                // `overflow-x-auto`, así que el ancho que falte se desplaza.
                className={cn('px-2 py-2 font-medium', c.numerica && 'whitespace-nowrap text-right')}
              >
                <button
                  type="button"
                  onClick={() => onOrdenar(c.clave)}
                  className={cn(
                    'inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink',
                    orden.columna === c.clave && 'text-ink',
                  )}
                >
                  {c.label}
                  {/* La flecha solo en la columna activa: una flecha en cada
                      cabecera no dice por cuál está ordenada la tabla. */}
                  {orden.columna === c.clave ? (
                    orden.direccion === 'asc' ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )
                  ) : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filas.map((f: FilaRentabilidad) => {
            const periodos = desgloseDeFila(f)
            const abierta = abiertas.has(f.clave)
            return (
              <FilaTabla
                key={f.clave}
                fila={f}
                columnas={columnas}
                dimension={reporte.dimension}
                periodos={periodos}
                abierta={abierta}
                onAlternar={alternar}
              />
            )
          })}
        </tbody>
        <tfoot>
          {/* El total viene del SERVIDOR (`reporte.totales`) y no se suma aquí:
              dos sumas de lo mismo divergen, y la del servidor es la que cuadra
              con el desglose por periodo. Las columnas que `Totales` no trae
              salen en blanco a propósito — ver `TOTALIZABLES` en `tabla.ts`:
              promediar un cociente por fila daría una cifra que no es de nadie. */}
          <tr className="border-t-2 border-border-strong font-medium">
            {columnas.map((c) => {
              if (c.clave === 'etiqueta') {
                return (
                  <Celda key={c.clave} className="text-ink">
                    Total ({filas.length})
                  </Celda>
                )
              }
              const v = totalDeColumna(t as unknown as Record<string, number | null>, c)
              return (
                <Celda
                  key={c.clave}
                  className={cn(
                    'demo-num whitespace-nowrap text-right',
                    c.totalizable && COLOREADAS.has(c.clave) && v != null && tonoMargen(v),
                  )}
                >
                  {c.totalizable ? formatoCelda(v, c.formato) : ''}
                </Celda>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function FilaTabla({
  fila,
  columnas,
  dimension,
  periodos,
  abierta,
  onAlternar,
}: {
  fila: FilaRentabilidad
  columnas: DefinicionColumna[]
  dimension: ReporteRentabilidad['dimension']
  periodos: ReturnType<typeof desgloseDeFila>
  abierta: boolean
  onAlternar: (clave: string) => void
}) {
  const hayDesglose = periodos.length > 1
  return (
    <>
      <tr className="hover:bg-surface-2">
        {columnas.map((c) => {
          if (c.clave === 'etiqueta') {
            return (
              <Celda key={c.clave}>
                <div className="flex items-start gap-1">
                  {/* El desglose se ofrece solo cuando hay más de un bucket: con
                      uno, la fila desplegable repetiría la fila de arriba. */}
                  {hayDesglose ? (
                    <button
                      type="button"
                      onClick={() => onAlternar(fila.clave)}
                      aria-expanded={abierta}
                      className="mt-0.5 text-muted hover:text-ink"
                      title={abierta ? 'Ocultar el desglose por periodo' : 'Ver el desglose por periodo'}
                    >
                      {abierta ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  ) : (
                    <span className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>
                    <span className="text-ink">{fila.etiqueta}</span>
                    {/* El detalle desambigua nombres repetidos, y el arrendador dice
                        a quién se le paga la renta que sale en «costo del espacio».
                        En `trimestre` NO se dice «sin contrato»: ahí `tieneContrato`
                        significa «hubo renta en el trimestre» y la fila no es una
                        pantalla, así que esa etiqueta afirmaría algo que no existe. */}
                    <span className="block text-[11px] text-muted">
                      {[
                        fila.detalle || null,
                        dimension === 'trimestre' ? null : fila.tieneContrato ? fila.arrendador : 'sin contrato',
                        // Las visitas por tipo van bajo el nombre y no en una
                        // columna: son un objeto tipo→conteo, y una columna con
                        // «Herrería 3 · Inspección 1» no se puede ordenar.
                        resumenVisitasPorTipo(fila.visitasPorTipo) || null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </div>
              </Celda>
            )
          }
          const v = valorDeColumna(fila, c)
          const raya = v == null ? MOTIVO_RAYA[c.clave] : undefined
          return (
            <Celda
              key={c.clave}
              className={cn(
                'demo-num whitespace-nowrap text-right',
                c.clave === 'margen' && 'font-medium',
                v == null && 'text-muted',
                v != null && COLOREADAS.has(c.clave) && tonoMargen(Number(v)),
              )}
            >
              <span title={raya}>{formatoCelda(v, c.formato)}</span>
              {/* El denominador de las horas, pegado a la cifra: «12.5 h» sobre
                  cuatro visitas y sobre una no dicen lo mismo, y `horasEnSitio`
                  solo mide las que tienen las dos marcas de tiempo. */}
              {c.clave === 'horasEnSitio' && v != null && fila.visitasConDuracion != null ? (
                <span className="block text-[10px] text-muted">
                  de {fila.visitasConDuracion} {fila.visitasConDuracion === 1 ? 'visita' : 'visitas'}
                </span>
              ) : null}
            </Celda>
          )
        })}
      </tr>
      {abierta ? (
        <tr className="bg-surface-2">
          <td colSpan={columnas.length} className="px-6 py-2">
            {/* El desglose por bucket que el motor ya devuelve en `periodos[]`
                para toda dimensión. En el orden del SERVIDOR: es una serie de
                tiempo, y reordenarla por importe la hace ilegible. */}
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-muted">
                  {COLUMNAS_DESGLOSE.map((c) => (
                    <th
                      key={String(c.clave)}
                      className={cn('px-2 py-1 font-medium', c.formato !== 'texto' && 'text-right')}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periodos.map((p) => (
                  <tr key={p.clave}>
                    {COLUMNAS_DESGLOSE.map((c) => (
                      <td
                        key={String(c.clave)}
                        className={cn(
                          'px-2 py-1',
                          c.formato === 'texto' ? 'text-ink' : 'demo-num whitespace-nowrap text-right',
                          c.clave === 'margen' && tonoMargen(p.margen),
                        )}
                        title={c.clave === 'etiqueta' ? `Del ${p.desde} al ${p.hasta}` : undefined}
                      >
                        {formatoCelda(p[c.clave] as string | number | null, c.formato)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      ) : null}
    </>
  )
}

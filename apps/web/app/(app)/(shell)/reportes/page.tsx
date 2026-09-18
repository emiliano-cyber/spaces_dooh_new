'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarSearch, Hammer, ServerCrash, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/demo/ui/Card'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { EmptyState } from '@/components/demo/EmptyState'
import { formatMonto } from '@/lib/data/derive'
import type { ReporteRentabilidad } from '@/lib/data/reportes'
import { FiltrosRentabilidad } from '@/components/demo/reportes/FiltrosRentabilidad'
import { TablaRentabilidad } from '@/components/demo/reportes/TablaRentabilidad'
import {
  construirConsulta,
  motivoInvalido,
  rangoDelTrimestreDe,
  type FiltrosReporte,
} from '@/components/demo/reportes/consulta'
import { debePedir, estadoDeReporte, type RespuestaReporte } from '@/components/demo/reportes/estado'
import {
  ORDEN_INICIAL,
  advertenciasDelReporte,
  formatoPorcentaje,
  siguienteOrden,
  type ColumnaReporte,
  type Orden,
} from '@/components/demo/reportes/tabla'

// ============================================================================
//  /reportes — Rentabilidad. UN tablero con selector de dimensión.
// ----------------------------------------------------------------------------
//  LA REGLA QUE MANDA AQUÍ: esta pantalla pide sus números a
//  `/api/reportes/rentabilidad`. NUNCA al store.
//
//  El resto de la analítica de SPACE OS se calcula en el navegador:
//  `/api/estado` se trae 23 rebanadas de tablas completas y el front deriva los
//  márgenes con `useStoreMemo`. Ese camino ya reventó una vez —6.12 MB y
//  pantalla en blanco de 6 a 12 segundos, sin dar ningún error
//  (`app/api/estado/route.ts:132-141`)— y un reporte de rentabilidad verá
//  historia de AÑOS: su volumen crecería con la antigüedad de la cuenta, no con
//  el periodo consultado. Colgar esta pantalla del store obligaría a rehacerla
//  entera cuando el cálculo se porte a agregación SQL, y entonces ya no se
//  haría. El contrato del endpoint está en
//  `vault/02-Backend/reportes-rentabilidad.md`.
//
//  Y es UNA pantalla, no cinco. «Por sitio», «por m²», «por trimestre» y «por
//  operación» son la misma pregunta —¿qué gana y qué cuesta cada cosa?—
//  agrupada distinto: cinco secciones serían cinco copias de la misma tabla,
//  divergiendo a la primera corrección.
//
//  Toda la lógica que puede equivocarse sin dar error vive fuera de este
//  archivo, en `components/demo/reportes/{consulta,estado,tabla}.ts`, con 62
//  pruebas. `vitest.config.ts` no monta jsdom a propósito, así que lo que se
//  escribe dentro de un `.tsx` no lo prueba nadie — es por lo que la compuerta
//  del shell salió a `compuerta.ts` y aparecieron nueve casos en rojo.
// ============================================================================

export default function ReportesPage() {
  // Abre con el trimestre en curso. No es un valor por omisión del endpoint
  // —allí las fechas son obligatorias a propósito, porque un rango por omisión
  // sobre años de historia es una consulta sin límite disfrazada de comodidad—:
  // es lo que la pantalla escribe en sus dos campos para no arrancar en blanco.
  const [filtros, setFiltros] = useState<FiltrosReporte>(() => ({
    dimension: 'sitio',
    granularidad: 'mes',
    ...rangoDelTrimestreDe(new Date()),
  }))
  const [cargando, setCargando] = useState(false)
  const [respuesta, setRespuesta] = useState<RespuestaReporte | null>(null)
  const [reporte, setReporte] = useState<ReporteRentabilidad | null>(null)
  const [orden, setOrden] = useState<Orden>(ORDEN_INICIAL)

  const motivo = motivoInvalido(filtros)

  useEffect(() => {
    if (!debePedir(filtros)) return
    // El `AbortController` no es adorno: cambiar de dimensión dos veces rápido
    // deja dos peticiones en vuelo, y la que conteste ÚLTIMA gana el `setState`
    // aunque sea la vieja. El resultado es una tabla que no corresponde a los
    // filtros que se ven en pantalla, y no da ningún error.
    const control = new AbortController()
    setCargando(true)
    void (async () => {
      try {
        const r = await fetch(construirConsulta(filtros), { cache: 'no-store', signal: control.signal })
        // El cuerpo se lee con `catch` propio: un 500 detrás de nginx puede
        // devolver HTML, y ahí `r.json()` revienta. Sin esto, un error del
        // servidor saldría por el `catch` de abajo como si fuera un fallo de
        // red, y el mensaje diría algo falso.
        const cuerpo = (await r.json().catch(() => null)) as
          | (ReporteRentabilidad & { error?: string })
          | null
        if (control.signal.aborted) return
        if (!r.ok) {
          setReporte(null)
          setRespuesta({ status: r.status, mensaje: cuerpo?.error ?? null, filas: 0 })
          return
        }
        setReporte(cuerpo ?? null)
        setRespuesta({ status: r.status, mensaje: null, filas: cuerpo?.filas?.length ?? 0 })
      } catch {
        if (control.signal.aborted) return
        setReporte(null)
        // `status: 0` = la petición no llegó a tener respuesta. La máquina de
        // estados lo trata como error y NO como «sin datos»: un cero filas
        // encima de un cable desconectado afirmaría que no hubo movimiento.
        setRespuesta({ status: 0, mensaje: 'No se pudo contactar al servidor. Revisa la conexión y vuelve a intentar.', filas: 0 })
      } finally {
        // En el `finally`, y esto es lo que impide el spinner infinito: pase lo
        // que pase —200, 501, JSON roto o red caída— `cargando` vuelve a false.
        if (!control.signal.aborted) setCargando(false)
      }
    })()
    return () => control.abort()
  }, [filtros])

  const estado = estadoDeReporte({
    motivoInvalido: motivo,
    cargando,
    dimension: filtros.dimension,
    respuesta,
  })

  // Al cambiar de filtros se vuelve al orden del servidor (peor margen
  // primero): conservar un «ordenado por nombre» de la consulta anterior
  // esconde la respuesta a la pregunta que el reporte contesta.
  const cambiarFiltros = useCallback((f: FiltrosReporte) => {
    setFiltros(f)
    setOrden(ORDEN_INICIAL)
  }, [])

  const avisos = useMemo(() => advertenciasDelReporte(reporte?.filas ?? []), [reporte])

  const hayDatos = estado.fase === 'datos' && reporte

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#0a66ff1a] text-info">
          <TrendingUp className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-2xl text-ink">Reportes de rentabilidad</h1>
          <p className="text-[13px] text-muted">
            Qué ingresa y qué cuesta cada pantalla en el periodo que elijas.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <FiltrosRentabilidad filtros={filtros} motivo={motivo} onCambio={cambiarFiltros} />
        </CardContent>
      </Card>

      {/* ─── Los KPI de cabecera ──────────────────────────────────────────────
          KPICard está pensada para leerse «a 3 metros (proyector)», y eso
          importa de verdad: esto se presenta en un escenario. Mientras carga se
          pintan esqueletos y no ceros: un «$ 0.00» que luego cambia es una
          cifra falsa enseñada a una sala. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {estado.fase === 'cargando' ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : hayDatos ? (
          <>
            <KPICard label="Ingreso del periodo" value={formatMonto(reporte.totales.ingreso)} tono="azul" />
            <KPICard
              label="Costo total"
              value={formatMonto(reporte.totales.costoTotal)}
              sub={`Espacio ${formatMonto(reporte.totales.costoEspacio)} · Operación ${formatMonto(reporte.totales.costoOperacion)}`}
            />
            <KPICard
              label="Margen"
              value={formatMonto(reporte.totales.margen)}
              tono={reporte.totales.margen < 0 ? 'rojo' : 'verde'}
            />
            <KPICard
              label="Margen sobre ingreso"
              value={formatoPorcentaje(reporte.totales.margenPct)}
              sub={`${reporte.filas.length} pantallas con movimiento`}
              tono={
                reporte.totales.margenPct == null ? 'neutro' : reporte.totales.margenPct < 0 ? 'rojo' : 'verde'
              }
            />
          </>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted" />
            <CardTitle>
              {hayDatos
                ? `Del ${reporte.desde} al ${reporte.hasta}`
                : 'Resultado'}
            </CardTitle>
          </div>
          {hayDatos ? (
            <span className="text-[11px] uppercase tracking-wide text-muted">
              {reporte.periodos.length} {reporte.periodos.length === 1 ? 'periodo' : 'periodos'}
            </span>
          ) : null}
        </CardHeader>
        <CardContent>
          {estado.fase === 'cargando' ? (
            <div className="h-48 w-full animate-pulse rounded-md bg-surface-2" />
          ) : estado.fase === 'sin-motor' ? (
            /* La degradación con elegancia del 501. NO es un error y no se
               pinta como uno: la dimensión es parte del contrato del endpoint y
               su motor está escribiéndose. Cuando aterrice, esta pantalla
               funciona sin tocarse. */
            <EmptyState
              icon={Hammer}
              titulo="Esta dimensión aún no está disponible"
              detalle={estado.mensaje ?? undefined}
            />
          ) : estado.fase === 'error' ? (
            <EmptyState
              icon={ServerCrash}
              titulo="No se pudo calcular el reporte"
              detalle={estado.mensaje ?? undefined}
            />
          ) : estado.fase === 'invalido' ? (
            <EmptyState icon={CalendarSearch} titulo="Revisa el periodo" detalle={estado.mensaje ?? undefined} />
          ) : estado.fase === 'vacio' ? (
            /* Vacío HONESTO: se dice qué se preguntó y por qué puede salir
               vacío, en vez de un «no hay datos» que deja a quien lo lee sin
               saber si el problema son sus fechas o su inventario. */
            <EmptyState
              icon={CalendarSearch}
              titulo="Sin movimiento en este periodo"
              detalle={`Entre el ${filtros.desde} y el ${filtros.hasta} ninguna pantalla registró ingreso, renta ni órdenes de trabajo. Una pantalla sin nada de eso no aparece en el reporte; prueba con un rango más amplio.`}
            />
          ) : hayDatos ? (
            <div className="space-y-3">
              {/* Lo que el reporte NO mide, dicho encima de la tabla en vez de
                  escondido detrás de cifras que parecen completas. */}
              {avisos.sinContrato > 0 || avisos.sinIngreso > 0 ? (
                <ul className="space-y-1 rounded-md border border-dashed border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
                  {avisos.sinContrato > 0 ? (
                    <li>
                      <span className="font-medium text-ink">{avisos.sinContrato}</span>{' '}
                      {avisos.sinContrato === 1 ? 'pantalla no tiene' : 'pantallas no tienen'} contrato de
                      arrendamiento vigente: su costo del espacio sale en cero porque falta el dato, no
                      porque sea gratis, y su margen se lee mejor de lo que es.
                    </li>
                  ) : null}
                  {avisos.sinIngreso > 0 ? (
                    <li>
                      <span className="font-medium text-ink">{avisos.sinIngreso}</span>{' '}
                      {avisos.sinIngreso === 1 ? 'pantalla costó' : 'pantallas costaron'} sin vender nada en
                      el periodo, así que no tienen margen porcentual (la columna sale con «—»).
                    </li>
                  ) : null}
                </ul>
              ) : null}
              <TablaRentabilidad
                reporte={reporte}
                orden={orden}
                onOrdenar={(c: ColumnaReporte) => setOrden((o) => siguienteOrden(o, c))}
              />
            </div>
          ) : (
            <EmptyState icon={CalendarSearch} titulo="Elige un periodo" detalle="El reporte se calcula al elegir las fechas." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

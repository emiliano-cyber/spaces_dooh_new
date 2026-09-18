'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, BarChart3, CalendarSearch, Info, ServerCrash, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/demo/ui/Card'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { EmptyState } from '@/components/demo/EmptyState'
import { formatMonto } from '@/lib/data/derive'
import type { ReporteRentabilidad } from '@/lib/data/reportes'
import { FiltrosRentabilidad } from '@/components/demo/reportes/FiltrosRentabilidad'
import { TablaRentabilidad } from '@/components/demo/reportes/TablaRentabilidad'
import {
  filtrosDesdeUrl,
  construirConsulta,
  cuenta,
  motivoInvalido,
  type FiltrosReporte,
} from '@/components/demo/reportes/consulta'
import { debePedir, estadoDeReporte, type RespuestaReporte } from '@/components/demo/reportes/estado'
import {
  avisosDelReporte,
  formatoPorcentaje,
  ordenInicialDe,
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
//  `/api/estado` se trae 24 rebanadas de tablas completas y el front deriva los
//  márgenes con `useStoreMemo`. Ese camino ya reventó una vez —6.12 MB y
//  pantalla en blanco de 6 a 12 segundos, sin dar ningún error
//  (`app/api/estado/route.ts:142-146`)— y un reporte de rentabilidad verá
//  historia de AÑOS: su volumen crecería con la antigüedad de la cuenta, no con
//  el periodo consultado. Colgar esta pantalla del store obligaría a rehacerla
//  entera cuando el cálculo se porte a agregación SQL, y entonces ya no se
//  haría. El contrato del endpoint está en
//  `vault/02-Backend/reportes-rentabilidad.md`.
//
//  Y es UNA pantalla, no cinco. «Por sitio», «por m²», «por trimestre», «por
//  operación» y «por consumo de luz» son la misma pregunta —¿qué gana y qué
//  cuesta cada cosa?— agrupada distinto: cinco secciones serían cinco copias de
//  la misma tabla, divergiendo a la primera corrección. Con `luz` cerrada el
//  2026-09-18 están las CINCO que pidió el dueño, y la pantalla no creció: ganó
//  una entrada en el selector.
//
//  Toda la lógica que puede equivocarse sin dar error vive fuera de este
//  archivo, en `components/demo/reportes/{consulta,estado,tabla}.ts`.
//  `vitest.config.ts` no monta jsdom a propósito, así que lo que se escribe
//  dentro de un `.tsx` no lo prueba nadie — es por lo que la compuerta del
//  shell salió a `compuerta.ts` y aparecieron nueve casos en rojo.
//
//  Y por lo que las COLUMNAS salen de `tabla.ts`: hasta el 18/09 esta pantalla
//  pintaba siempre las siete de `sitio`, así que «Por operación» calculaba bien
//  y no enseñaba ni visitas ni horas. No lo vio nada automático —los campos que
//  faltaban son opcionales en el contrato— y solo apareció al mirarla.
// ============================================================================

export default function ReportesPage() {
  // Abre en el trimestre EN CURSO, **por decisión del dueño del 2026-09-18** y
  // no por omisión. Un trimestre a medias se lee peor de lo que es, y eso no se
  // arregla aquí: se dice en pantalla, con el aviso `periodo-en-curso` de
  // `avisosDelReporte`. El porqué entero —y cómo se vuelve atrás en una línea si
  // cambia de opinión— está en `RANGO_DE_APERTURA` (`consulta.ts`).
  // La direccion puede traer los filtros, para poder dejar un enlace preparado
  // con el reporte ya filtrado. Sin esto habia que teclear dos fechas en vivo.
  //
  // Se lee UNA sola vez, en el inicializador del `useState`: a partir de ahi
  // manda lo que el usuario toque. Si se releyera en cada render, cambiar un
  // filtro con el mismo `searchParams` en la barra lo devolveria al de la URL y
  // la pantalla pelearia contra su propio usuario.
  //
  // Lo que la dirección NO puede hacer es dejar la pantalla en un estado que su
  // selector no sepa pintar — eso lo garantiza `filtrosDesdeUrl`, que ignora lo
  // que no encaja. Ver su cabecera en `consulta.ts`.
  const params = useSearchParams()
  const [filtros, setFiltros] = useState<FiltrosReporte>(() =>
    filtrosDesdeUrl(new URLSearchParams(params?.toString() ?? ''), new Date()),
  )
  const [cargando, setCargando] = useState(false)
  const [respuesta, setRespuesta] = useState<RespuestaReporte | null>(null)
  const [reporte, setReporte] = useState<ReporteRentabilidad | null>(null)
  const [orden, setOrden] = useState<Orden>(() => ordenInicialDe(filtros.dimension))

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

  const estado = estadoDeReporte({ motivoInvalido: motivo, cargando, respuesta })

  // Al cambiar de filtros se vuelve al orden DEL SERVIDOR PARA ESA DIMENSIÓN
  // —peor margen en `sitio`, más costo de operación en `operacion`, peor margen
  // por metro en `m2` y CRONOLÓGICO en `trimestre`—. Conservar un «ordenado por
  // nombre» de la consulta anterior esconde la respuesta que el reporte
  // contesta; y conservar «margen ascendente» al pasar a trimestral ordenaba
  // una serie de tiempo por importe, que es ilegible.
  const cambiarFiltros = useCallback((f: FiltrosReporte) => {
    setFiltros(f)
    setOrden(ordenInicialDe(f.dimension))
  }, [])

  // Lo que el reporte no mide, lo que deja fuera, con qué convención cuenta el
  // metro cuadrado y —el primero de todos— si el periodo que se está viendo
  // todavía no ha cerrado. Los textos se arman en `tabla.ts` porque uno de
  // ellos era FALSO en trimestral y nada se quejaba: ahí `tieneContrato`
  // significa «hubo renta en el trimestre», no que la fila sea una pantalla con
  // contrato.
  //
  // El rango sale de `reporte` y NO de `filtros`: es el que el servidor
  // confirma haber calculado. Con el de los filtros, un aviso podría hablar de
  // un periodo que el usuario acaba de escribir y cuyo reporte no ha llegado.
  // Y `hoy` se INYECTA para que la decisión sea pura y se pueda probar.
  const avisos = useMemo(
    () =>
      reporte
        ? avisosDelReporte({
            dimension: reporte.dimension,
            desde: reporte.desde,
            hasta: reporte.hasta,
            hoy: new Date(),
            filas: reporte.filas,
            excluidas: reporte.excluidas,
            convencionM2: reporte.convencionM2,
            // Solo llega en `luz`. Es el aviso que dice cuántos recibos del
            // periodo faltan: sin él, el reporte suma lo capturado y lo
            // presenta como el total de la energía, que es mentir sin error.
            cobertura: reporte.cobertura,
          })
        : [],
    [reporte],
  )

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
            {/* Las TRES fuentes de costo, y las tres a la vista. El día que la
                energía entró en `costoTotal` (2026-09-18) este subtítulo se
                quedaba con dos: el KPI habría enseñado un total que no es la
                suma de lo que dice debajo, en el sitio más grande de la
                pantalla y sin nada que lo explicara. */}
            <KPICard
              label="Costo total"
              value={formatMonto(reporte.totales.costoTotal)}
              sub={`Espacio ${formatMonto(reporte.totales.costoEspacio)} · Operación ${formatMonto(reporte.totales.costoOperacion)} · Luz ${formatMonto(reporte.totales.costoEnergia)}`}
            />
            <KPICard
              label="Margen"
              value={formatMonto(reporte.totales.margen)}
              tono={reporte.totales.margen < 0 ? 'rojo' : 'verde'}
            />
            <KPICard
              label="Margen sobre ingreso"
              value={formatoPorcentaje(reporte.totales.margenPct)}
              /* «N pantallas con movimiento» en TODA dimensión: en trimestral
                 las filas son trimestres. El sustantivo lo declara
                 `sustantivoFila` una sola vez, y lo leen también la tabla y los
                 avisos. */
              sub={`${cuenta(reporte.filas.length, reporte.dimension)} con movimiento`}
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
          {/* La rama del 501 («esta dimensión aún no está disponible») se
              retiró: las cinco dimensiones calculan desde el 18/09 y ese
              camino es inalcanzable — medido antes de borrarlo, ver la cabecera
              de `estado.ts`. */}
          {estado.fase === 'cargando' ? (
            <div className="h-48 w-full animate-pulse rounded-md bg-surface-2" />
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
              {/* Lo que el reporte NO mide y lo que deja FUERA, dicho encima de
                  la tabla en vez de escondido detrás de cifras que parecen
                  completas. En `m2` esto incluye las exclusiones —cuántas
                  digitales y cuántas sin medidas quedaron fuera del ranking, con
                  la nota que redacta el propio motor— y la convención con la que
                  se contó el metro cuadrado: una cifra por metro cuadrado sin
                  decir qué cuenta como metro cuadrado no se concilia con nada. */}
              {avisos.length > 0 ? (
                <ul className="space-y-1.5 rounded-md border border-dashed border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
                  {avisos.map((a) => {
                    // ÁMBAR con triángulo, o gris con la «i». La distinción no
                    // es de estilo: los grises cuentan lo que el reporte no
                    // mide, y los ámbar dicen que las cifras que se están
                    // viendo TODAVÍA NO SON las definitivas —el periodo que no
                    // ha cerrado, y los recibos de luz que faltan—. Sin eso, un
                    // margen incompleto se lee como una pérdida real.
                    //
                    // El tono lo decide `avisosDelReporte` y NO este archivo.
                    // Hasta el 2026-09-18 estaba escrito aquí como
                    // `a.clave === 'periodo-en-curso'`, y `vitest.config.ts` no
                    // monta jsdom a propósito: una decisión dentro de un `.tsx`
                    // no la prueba nadie. Al llegar el segundo aviso que
                    // necesita ámbar, esa condición habría crecido justo donde
                    // ninguna prueba la ve.
                    //
                    // Y el ámbar no se gasta, que es la objeción de siempre en
                    // este repo: los dos salen solo cuando hay algo que decir
                    // —el rango toca el trimestre vivo, o falta algún recibo—,
                    // así que sobre un reporte completo y cerrado la caja
                    // vuelve a ser toda gris.
                    const alerta = a.tono === 'alerta'
                    const Icono = alerta ? AlertTriangle : Info
                    return (
                      <li
                        key={a.clave}
                        className={cn('flex items-start gap-1.5', alerta && 'font-medium text-warning')}
                      >
                        <Icono className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{a.texto}</span>
                      </li>
                    )
                  })}
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

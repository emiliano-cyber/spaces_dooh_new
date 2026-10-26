import { construirConsulta } from '@/components/demo/reportes/consulta'
import type { Totales } from '@/lib/data/reportes'

// ============================================================================
//  components/demo/inicio/pnl-del-mes.ts — El ingreso, los costos y el margen
//  del MES que enseña el Dashboard.
// ----------------------------------------------------------------------------
//  DASH-PERIODO (26/10). Hasta hoy los calculaba `dashboardMetrics` en el
//  navegador, y los tres números estaban mal sin dar ningún error:
//
//   · «Ingreso contratado del mes» sumaba el precio de TODAS las reservas
//     confirmadas que han existido. Una reserva confirmada nunca deja de serlo,
//     así que era el acumulado histórico con la etiqueta del mes.
//   · La renta de una pantalla entraba UNA VEZ POR CADA RESERVA que tuvo en su
//     vida, y la impresión y las OT eran todas las que han existido.
//   · Un rol sin `finanzas:ver` recibe esas tablas vacías de `/api/estado`, así
//     que un vendedor veía costo $0 y «margen 100 %» en verde.
//
//  Ahora se le piden al MISMO motor que Reportes → Rentabilidad, con el mes en
//  curso. Decisión del dueño (26/10): un solo número para el mismo margen, en
//  vez de dos fórmulas que nunca cuadrarían. Eso trae el criterio del motor: el
//  ingreso se prorratea por días, la renta es la de TODA pantalla con contrato
//  vigente —vendida o vacía, porque se paga igual— y entra la luz. La impresión
//  no está en el motor: el Dashboard la enseña aparte.
//
//  Y el permiso lo pone el endpoint (`finanzas:ver`): quien no lo tiene recibe
//  403 y aquí eso es «sin acceso», nunca un cero.
//
//  Vive fuera del `.tsx` porque `vitest.config.ts` no monta jsdom: es el mismo
//  motivo que `components/demo/reportes/estado.ts`.
// ============================================================================

const dosCifras = (n: number) => String(n).padStart(2, '0')

// Desde las PARTES LOCALES de la fecha, no desde `toISOString`: a las 00:00 del
// 1.º en México, UTC ya va en el día anterior y el rango caería en el mes que
// terminó. Misma trampa que `rangoDelTrimestreDe` en `reportes/consulta.ts`.
export function rangoDelMesDe(hoy: Date): { desde: string; hasta: string } {
  const anio = hoy.getFullYear()
  const mes = hoy.getMonth()
  // Día 0 del mes siguiente = último día de éste, sin tabla de 28/30/31.
  const ultimo = new Date(anio, mes + 1, 0).getDate()
  return {
    desde: `${anio}-${dosCifras(mes + 1)}-01`,
    hasta: `${anio}-${dosCifras(mes + 1)}-${dosCifras(ultimo)}`,
  }
}

// `trimestre` con el rango de UN mes da una sola fila con TODAS las pantallas, y
// sus `totales` son el estado de resultados del mes. Con `sitio` saldrían las
// mismas cifras pero con una fila por pantalla que aquí nadie lee.
export function consultaPnlDelMes(hoy: Date): string {
  return construirConsulta({ dimension: 'trimestre', granularidad: 'mes', ...rangoDelMesDe(hoy) })
}

// El mismo mes abierto en Reportes, por pantalla: de dónde sale cada cifra. Sin
// basePath, porque es para `next/link`, que lo pone solo.
export function rutaReportesDelMes(hoy: Date): string {
  const p = new URLSearchParams({ dimension: 'sitio', granularidad: 'mes', ...rangoDelMesDe(hoy) })
  return `/reportes?${p.toString()}`
}

export type PnlDelMes =
  | { fase: 'cargando' }
  | { fase: 'datos'; totales: Totales }
  | { fase: 'sin-acceso' }
  | { fase: 'error' }

const CAMPOS: (keyof Totales)[] = ['ingreso', 'costoEspacio', 'costoOperacion', 'costoEnergia', 'costoTotal', 'margenBruto']

export function pnlDesdeRespuesta(status: number, cuerpo: unknown): PnlDelMes {
  if (status === 401 || status === 403) return { fase: 'sin-acceso' }
  if (status < 200 || status >= 300) return { fase: 'error' }
  // Un 2xx sin totales con forma de números es un cuerpo roto (un proxy que
  // contesta HTML, por ejemplo). Pintarlo como ceros afirmaría un mes sin
  // ingreso ni costo.
  const t = (cuerpo as { totales?: Record<string, unknown> } | null)?.totales
  if (!t || !CAMPOS.every((k) => typeof t[k] === 'number')) return { fase: 'error' }
  return { fase: 'datos', totales: t as unknown as Totales }
}

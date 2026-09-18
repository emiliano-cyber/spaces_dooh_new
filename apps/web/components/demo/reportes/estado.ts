import { motivoInvalido, type FiltrosReporte } from './consulta'

// ============================================================================
//  components/demo/reportes/estado.ts — Qué se pinta, y por qué.
// ----------------------------------------------------------------------------
//  SEIS salidas. Tuvo siete: había una —`sin-motor`— para el 501 que
//  devolvían las tres dimensiones sin motor. Desde el 18/09 las cuatro
//  calculan y ese camino quedó INALCANZABLE, así que se retiró.
//
//  Y se midió antes de borrarlo, porque quitar el manejo de un error que sí
//  puede ocurrir es peor que dejarlo de sobra:
//
//   · `grep` de `status: 501` sobre `apps/web/lib` y `apps/web/app`, sin
//     pruebas: CERO líneas.
//   · `MOTORES` (`lib/server/reportes-controller.ts:114`) es un `Record`
//     EXHAUSTIVO sobre el enum de dimensiones, así que declarar una dimensión
//     sin su motor NO COMPILA. Lo que el tipo garantiza no necesita además un
//     error en tiempo de ejecución.
//   · los demás caminos de error del endpoint están enumerados y ninguno da
//     501: `AppError` (400 por omisión), zod (400, o el status que pida el
//     issue), los códigos de Postgres de `errores.ts:105-114` (400/403/409), el
//     500 de respaldo y el 401/403 de `exigir`.
//
//  Si un 501 llegara de todos modos ya no podría venir de una dimensión sin
//  motor: sería un intermediario —nginx, un proxy— diciendo que no implementa
//  el método, y eso SÍ es un fallo que hay que ver. Cae por el corte de abajo
//  como error, que es donde le toca.
//
//  Vive fuera del `.tsx` porque sus dos modos de fallo son SILENCIOSOS: un
//  spinner que no termina nunca y un vacío puesto encima de un fallo de red.
//  Ninguno da error, y `vitest.config.ts` no monta jsdom, así que dentro del
//  componente no los probaría nadie. Es el mismo motivo por el que la compuerta
//  del shell salió a `compuerta.ts`, donde aparecieron nueve casos en rojo.
// ============================================================================

export type FaseReporte = 'inicial' | 'cargando' | 'invalido' | 'error' | 'vacio' | 'datos'

export interface RespuestaReporte {
  status: number
  /** El `{ error }` del servidor, si vino. */
  mensaje: string | null
  filas: number
}

// `dimension` estaba aquí y salió con el 501: era su único uso. Un campo de
// entrada que ya nadie lee es lo primero que se queda desfasado, y de paso deja
// escrito lo que de verdad pasa hoy — la fase NO depende de la dimensión.
export interface EntradaEstado {
  motivoInvalido: string | null
  cargando: boolean
  /** `null` = todavía no se ha pedido nada. */
  respuesta: RespuestaReporte | null
}

export interface EstadoReporte {
  fase: FaseReporte
  mensaje: string | null
}

// Lo ÚNICO que corta es un rango que no se puede mandar. La dimensión no entra
// en la decisión, y por eso el día que el contrato gane una quinta esta pantalla
// no se toca: se pide, y lo que conteste el servidor manda.
export function debePedir(f: FiltrosReporte): boolean {
  return motivoInvalido(f) === null
}

export function estadoDeReporte(e: EntradaEstado): EstadoReporte {
  // Manda sobre `cargando` a propósito: un rango que se sabe malo no se pide,
  // así que no puede haber nada en vuelo que valga la pena esperar.
  if (e.motivoInvalido) return { fase: 'invalido', mensaje: e.motivoInvalido }

  // El orden de estas dos líneas es lo que impide el spinner infinito: en
  // cuanto hay respuesta, `cargando` es false (lo pone el `finally` de quien
  // pide) y ninguna rama de abajo devuelve 'cargando'.
  if (e.cargando) return { fase: 'cargando', mensaje: null }
  if (!e.respuesta) return { fase: 'inicial', mensaje: null }

  const { status, mensaje, filas } = e.respuesta

  // SOLO el 2xx trae reporte, y el corte se escribe así —no como
  // `status >= 400`— por un caso que no tiene status HTTP: cuando la petición
  // no llega (red caída, servidor apagado) no hay respuesta ni cuerpo, y quien
  // pide lo representa con `status: 0`. Con el corte en 400, ese caso caía por
  // debajo y, con cero filas, se pintaba «no hubo movimiento en el rango»:
  // una afirmación FALSA sobre el negocio encima de un cable desconectado.
  // Es el hallazgo C1 de la auditoría QA otra vez —el sistema vacío
  // indistinguible del no cargado—, y no da ningún error.
  if (status < 200 || status >= 300) {
    // Nunca un mensaje vacío: un error sin texto se pinta como una caja gris y
    // manda al usuario a revisar sus filtros por un problema que no es suyo.
    return {
      fase: 'error',
      mensaje: mensaje ?? 'No se pudo calcular el reporte. La petición no llegó a buen término.',
    }
  }

  // Cero filas es un resultado, no un fallo: una pantalla sin ingreso, sin
  // renta y sin OT en el rango no aparece en el reporte, así que un periodo sin
  // movimiento devuelve cero filas y un 200.
  if (filas === 0) return { fase: 'vacio', mensaje: null }

  return { fase: 'datos', mensaje: null }
}

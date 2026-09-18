import { etiquetaDimension, motivoInvalido, type DimensionUI, type FiltrosReporte } from './consulta'

// ============================================================================
//  components/demo/reportes/estado.ts — Qué se pinta, y por qué.
// ----------------------------------------------------------------------------
//  Siete salidas, y la que importa es que UNA DE ELLAS NO ES UN ERROR: tres de
//  las cuatro dimensiones del contrato devuelven 501 mientras su motor se
//  escribe. Un 501 pintado como error manda a buscar un fallo que no existe;
//  pintado como «no hay datos» afirma algo falso —no es que no haya, es que no
//  se calcularon—.
//
//  Vive fuera del `.tsx` porque sus dos modos de fallo son SILENCIOSOS: un
//  spinner que no termina nunca y un vacío puesto encima de un fallo de red.
//  Ninguno da error, y `vitest.config.ts` no monta jsdom, así que dentro del
//  componente no los probaría nadie. Es el mismo motivo por el que la compuerta
//  del shell salió a `compuerta.ts`, donde aparecieron nueve casos en rojo.
// ============================================================================

export type FaseReporte = 'inicial' | 'cargando' | 'invalido' | 'sin-motor' | 'error' | 'vacio' | 'datos'

export interface RespuestaReporte {
  status: number
  /** El `{ error }` del servidor, si vino. */
  mensaje: string | null
  filas: number
}

export interface EntradaEstado {
  motivoInvalido: string | null
  cargando: boolean
  dimension: DimensionUI
  /** `null` = todavía no se ha pedido nada. */
  respuesta: RespuestaReporte | null
}

export interface EstadoReporte {
  fase: FaseReporte
  mensaje: string | null
}

// Solo se deja de pedir por un rango que no se puede mandar. Una dimensión sin
// motor SÍ se pide: el 501 lo decide el servidor, y si la pantalla se negara a
// preguntar, el día que aterrice el motor habría que volver a tocarla — que es
// exactamente lo que este límite existe para evitar.
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

  // El 501 se mira ANTES del error genérico. Si se mirara después caería en
  // `status >= 400` y se pintaría como fallo.
  if (status === 501) {
    return {
      fase: 'sin-motor',
      mensaje:
        mensaje ??
        `El reporte de rentabilidad por ${etiquetaDimension(e.dimension)} todavía no está disponible. Por ahora solo «Por pantalla».`,
    }
  }

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

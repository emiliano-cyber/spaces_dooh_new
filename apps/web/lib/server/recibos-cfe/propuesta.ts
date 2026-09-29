import { repartirEnMeses, type ReciboCfe } from './interprete'

// ============================================================================
//  lib/server/recibos-cfe/propuesta.ts — De un recibo leido a lo que se PROPONE
//  capturar. Puro: recibe lo que ya se consulto, no consulta nada.
// ----------------------------------------------------------------------------
//  ─── LA REGLA QUE NO SE NEGOCIA: PROPONER, NO GUARDAR ────────────────────
//  Nada de este archivo escribe. Devuelve renglones para que una persona los
//  mire con el recibo delante y los confirme uno por uno. Un recibo mal leido
//  que se guarda solo mete un costo falso en el reporte de rentabilidad, y ahi
//  **ya no se distingue de uno bueno**: no hay marca, no hay error, y el margen
//  sale peor o mejor de lo que es sin que nadie pueda saber por que.
//
//  Por eso la propuesta viaja con `lectura` entera dentro —el desglose
//  completo, el Total impreso, la tarifa, el periodo real— y no solo con las
//  cuatro cifras que se van a guardar: la pantalla enseña lo que entendio CON
//  EL VALOR ORIGINAL AL LADO.
//
//  ─── POR QUE EL `medidor` QUE SE GUARDA ES EL NUMERO DE SERVICIO ─────────
//  El recibo trae DOS numeros que no son lo mismo:
//
//   · `NO. DE SERVICIO` (12 digitos) — el contrato de suministro. Identifica el
//     PUNTO donde llega la luz. No cambia.
//   · `NO. MEDIDOR` (`A000AA`) — el aparato. CFE lo sustituye cuando se
//     estropea o toca renovarlo, y el servicio sigue siendo el mismo.
//
//  `consumos_energia.medidor` existe para UNA cosa, y su migracion lo dice:
//  para que un predio con DOS medidores pueda tener sus dos recibos del mismo
//  mes sin chocar con el indice unico
//  (`20260918_consumos_energia.sql`, `consumos_energia_predio_uq`). El numero
//  de servicio hace ese trabajo —en estos 72 recibos, «PLAN DE SAN LUIS» tiene
//  el 370220602321 y el 370220602330, dos servicios en el mismo predio— y
//  ademas es ESTABLE. El numero de aparato no: el dia que CFE cambie el
//  medidor, la clave unica cambiaria con el y el recibo de ese mes entraria
//  duplicado sin dar error.
//
//  El numero de aparato no se pierde: va en `notas`, junto con la tarifa y el
//  periodo REAL del recibo, que es informacion que la tabla no tiene donde
//  guardar y quien audite va a necesitar.
//
//  ─── Y POR ESO NO HIZO FALTA TOCAR EL ESQUEMA ───────────────────────────
//  El emparejamiento se aprende del historial: se busca un recibo YA capturado
//  con ese mismo numero de servicio y se reusa su predio. La primera vez de
//  cada servicio la elige una persona; de ahi en adelante sale solo. Con los 72
//  recibos del cliente eso son 29 elecciones manuales —los 29 servicios
//  distintos— y 43 automaticas.
//
//  La alternativa era una tabla nueva de servicios por predio. Se descarto
//  porque cuesta una migracion y un mantenimiento —alta, baja, quien lo
//  teclea— para dar exactamente lo mismo que ya da la primera captura.
// ============================================================================

/** Un recibo que YA esta capturado para ese servicio. */
export interface ConsumoYaCapturado {
  id: string
  predioId: string | null
  sitioId: string | null
  /** `AAAA-MM-DD`, dia 1. */
  periodo: string
  medidor: string | null
  kwh: number
  importe: number
}

export interface RenglonPropuesto {
  /** `AAAA-MM-01`. */
  periodo: string
  kwh: number | null
  importe: number | null
  /** Dias del periodo facturado que caen en ese mes. Se enseña. */
  dias: number
  /**
   * El recibo que YA existe para ese servicio y ese mes, si lo hay. No se
   * bloquea la propuesta: se enseña, con sus cifras, para que quien confirma
   * decida. Volver a capturarlo DUPLICA el costo de la luz de ese mes y no da
   * ningun error — da un margen peor de lo que es.
   */
  yaCapturado: ConsumoYaCapturado | null
}

export type Emparejamiento = 'historial' | 'sin-historial'

export interface PropuestaDeRecibo {
  /** El nombre del archivo que subieron. Es como la persona lo reconoce. */
  archivo: string
  esRecibo: boolean
  /** Todo lo leido, para enseñarlo al lado de lo propuesto. */
  lectura: ReciboCfe
  /** A que predio se propone anclarlo. `null` = lo elige una persona. */
  predioId: string | null
  sitioId: string | null
  emparejamiento: Emparejamiento
  /** Lo que iria en `consumos_energia.medidor`: el numero de SERVICIO. */
  medidor: string | null
  /** Lo que iria en `consumos_energia.notas`. */
  notas: string | null
  renglones: RenglonPropuesto[]
  /** Lo que hay que mirar antes de confirmar. Se enseña, no se esconde. */
  avisos: string[]
}

/**
 * La propuesta de UN recibo.
 *
 * `yaCapturados` son los recibos que la base ya tiene para ESTE numero de
 * servicio, en este tenant. Se pasan ya consultados a proposito: asi esta
 * funcion no toca la base y se prueba entera sin montar nada.
 */
export function construirPropuesta(
  archivo: string,
  lectura: ReciboCfe,
  yaCapturados: ConsumoYaCapturado[],
): PropuestaDeRecibo {
  const avisos = [...lectura.avisos]

  if (!lectura.esRecibo) {
    return {
      archivo,
      esRecibo: false,
      lectura,
      predioId: null,
      sitioId: null,
      emparejamiento: 'sin-historial',
      medidor: null,
      notas: null,
      renglones: [],
      avisos,
    }
  }

  // El anclaje se hereda del recibo MAS RECIENTE de ese servicio: si el predio
  // cambio de manos o la pantalla se movio, lo ultimo que se capturo es lo que
  // vale. El orden lo garantiza `energia-repo`.
  const previo = yaCapturados[0] ?? null
  const predioId = previo?.predioId ?? null
  const sitioId = previo?.sitioId ?? null
  const emparejamiento: Emparejamiento = previo ? 'historial' : 'sin-historial'

  if (!previo) {
    avisos.push(
      `Es la primera vez que se sube un recibo del servicio ${lectura.numeroServicio}: ` +
        'elige a que predio o pantalla corresponde. Los siguientes saldran solos.',
    )
  }

  const porPeriodo = new Map(yaCapturados.map((c) => [c.periodo, c]))
  const renglones: RenglonPropuesto[] = repartirEnMeses(
    lectura.desde,
    lectura.hasta,
    lectura.kwh,
    lectura.importe,
  ).map((r) => ({ ...r, yaCapturado: porPeriodo.get(r.periodo) ?? null }))

  const repetidos = renglones.filter((r) => r.yaCapturado)
  if (repetidos.length > 0) {
    avisos.push(
      `Ya hay recibo capturado para ${repetidos.map((r) => r.periodo.slice(0, 7)).join(', ')} ` +
        'en este servicio. Capturarlo otra vez DUPLICA el costo de la luz de ese mes.',
    )
  }

  if (renglones.length > 1) {
    avisos.push(
      `El periodo facturado (${lectura.desde} a ${lectura.hasta}) cubre ${renglones.length} ` +
        'meses de calendario. El recibo se reparte entre ellos por sus dias; la suma es ' +
        'exactamente el recibo.',
    )
  }

  return {
    archivo,
    esRecibo: true,
    lectura,
    predioId,
    sitioId,
    emparejamiento,
    medidor: lectura.numeroServicio,
    notas: notasDelRecibo(lectura),
    renglones,
    avisos,
  }
}

/**
 * Lo que NO cabe en las columnas de `consumos_energia` y hace falta para
 * auditar: el aparato, la tarifa y el periodo REAL del recibo.
 *
 * El periodo real importa mas de lo que parece: la tabla guarda el mes, asi que
 * sin esta linea nada dice que ese renglon salio de un recibo del 3 de
 * noviembre al 5 de enero, ni cuantos dias de ese recibo le tocaron.
 */
export function notasDelRecibo(lectura: ReciboCfe): string {
  const partes = [`Recibo CFE, servicio ${lectura.numeroServicio}`]
  if (lectura.medidorFisico) partes.push(`medidor ${lectura.medidorFisico}`)
  if (lectura.tarifa) partes.push(`tarifa ${lectura.tarifa}`)
  if (lectura.desde && lectura.hasta) partes.push(`periodo ${lectura.desde} a ${lectura.hasta}`)
  if (lectura.alumbradoPublico != null) {
    partes.push(`alumbrado publico ${lectura.alumbradoPublico.toFixed(2)} incluido`)
  }
  return partes.join(', ') + '.'
}

// ============================================================================
//  components/demo/energia/recibos.ts — La logica de la pantalla de subir PDF.
// ----------------------------------------------------------------------------
//  Todo lo que puede equivocarse vive aqui y no en el `.tsx`: `vitest.config.ts`
//  no monta jsdom a proposito, asi que **lo que se escribe dentro de un `.tsx`
//  no lo prueba nadie**. Es la misma regla que sigue `captura.ts`.
//
//  LA REGLA QUE ORDENA ESTE ARCHIVO, otra vez: **proponer, no guardar**. Nada
//  de aqui llama a la red. Lo que hace es convertir la propuesta del servidor
//  en renglones que la pantalla enseña CON EL VALOR ORIGINAL AL LADO, y decir
//  cuales todavia NO se pueden confirmar y por que.
// ============================================================================

export const RUTA_RECIBOS = '/api/energia/recibos'

/** Espejo de `lib/server/recibos-cfe/interprete.ts`. */
export interface LecturaRecibo {
  esRecibo: boolean
  numeroServicio: string | null
  medidorFisico: string | null
  tarifa: string | null
  desde: string | null
  hasta: string | null
  kwh: number | null
  kwhLeido: number | null
  facturacionPeriodo: number | null
  alumbradoPublico: number | null
  importe: number | null
  importeLeido: number | null
  totalDelRecibo: number | null
  conceptos: { etiqueta: string; monto: number }[]
  avisos: string[]
}

export interface ConsumoYaCapturadoUI {
  id: string
  periodo: string
  medidor: string | null
  kwh: number
  importe: number
}

export interface RenglonPropuestoUI {
  periodo: string
  kwh: number | null
  importe: number | null
  dias: number
  yaCapturado: ConsumoYaCapturadoUI | null
}

export interface PropuestaUI {
  archivo: string
  esRecibo: boolean
  lectura: LecturaRecibo
  predioId: string | null
  sitioId: string | null
  emparejamiento: 'historial' | 'sin-historial'
  medidor: string | null
  notas: string | null
  renglones: RenglonPropuestoUI[]
  avisos: string[]
}

export interface RespuestaRecibosUI {
  propuestas: PropuestaUI[]
  leidos: number
  total: number
}

/**
 * Un renglon de la tabla de confirmacion: UN mes de UN recibo.
 *
 * Se aplana a proposito. La unidad que una persona confirma es la fila que se
 * va a guardar, no el archivo: un recibo bimestral produce tres filas y las
 * tres se miran por separado, porque una puede estar ya capturada y las otras
 * dos no.
 */
export interface FilaDeConfirmacion {
  /** `<archivo>|<periodo>`, estable dentro de la tanda. */
  clave: string
  archivo: string
  /** `P:<id>` o `S:<id>`, la MISMA clave que usa la rejilla de captura. */
  punto: string
  periodo: string
  /** Lo que va a `consumos_energia.medidor`: el numero de SERVICIO. */
  medidor: string | null
  /** Texto editable, como en el formulario de captura. Vacio = no se leyo. */
  kwh: string
  importe: string
  dias: number
  notas: string | null
  lectura: LecturaRecibo
  yaCapturado: ConsumoYaCapturadoUI | null
}

/** `''` cuando no hay cifra. VACIO, nunca `'0'`: un cero afirma que no hubo consumo. */
const aTexto = (n: number | null): string => (n == null ? '' : String(n))

export function filasDeConfirmacion(propuestas: PropuestaUI[]): FilaDeConfirmacion[] {
  const filas: FilaDeConfirmacion[] = []
  for (const p of propuestas) {
    if (!p.esRecibo) continue
    for (const r of p.renglones) {
      filas.push({
        clave: `${p.archivo}|${r.periodo}`,
        archivo: p.archivo,
        punto: p.predioId ? `P:${p.predioId}` : p.sitioId ? `S:${p.sitioId}` : '',
        periodo: r.periodo.slice(0, 7),
        medidor: p.medidor,
        kwh: aTexto(r.kwh),
        importe: aTexto(r.importe),
        dias: r.dias,
        notas: p.notas,
        lectura: p.lectura,
        yaCapturado: r.yaCapturado,
      })
    }
  }
  return filas
}

/**
 * Por que NO se puede confirmar todavia este renglon. `null` = se puede.
 *
 * Es deliberadamente igual de duro que el servidor —`cifraDeRecibo` corta el
 * cero y el negativo— porque si aqui se dejara pasar, la persona daria a
 * guardar y recibiria un 400 con el recibo ya cerrado. Pero **la puerta es el
 * servidor**, no esto: a `POST /api/energia/consumos` se le puede llamar sin
 * pasar por esta pantalla.
 */
export function motivoNoConfirmable(f: FilaDeConfirmacion): string | null {
  if (!f.punto) return 'Elige a qué predio o pantalla corresponde este recibo'
  const kwh = cifraInvalida(f.kwh, 'los kWh')
  if (kwh) return kwh
  const importe = cifraInvalida(f.importe, 'el importe')
  if (importe) return importe
  return null
}

function cifraInvalida(v: string, etiqueta: string): string | null {
  const t = v.trim()
  if (!t) return `Escribe ${etiqueta}: no se pudieron leer del PDF`
  const n = Number(t)
  if (!Number.isFinite(n)) return `${etiqueta} tiene que ser un número`
  // Cero y negativo fuera, por la regla del dueño del 2026-09-29: un cero no
  // dice «no sé», dice «no consumió luz», y en el reporte de rentabilidad esos
  // dos hechos son el mismo número.
  if (n <= 0) return `${etiqueta} tiene que ser mayor que cero`
  return null
}

/** El cuerpo de `POST /api/energia/consumos` para este renglon. */
export function cuerpoDeAlta(f: FilaDeConfirmacion): Record<string, unknown> {
  const [tipo, id] = f.punto.split(':')
  return {
    predioId: tipo === 'P' ? id : null,
    sitioId: tipo === 'S' ? id : null,
    periodo: f.periodo,
    medidor: f.medidor?.trim() || null,
    kwh: f.kwh.trim(),
    importe: f.importe.trim(),
    notas: f.notas,
  }
}

export interface ResumenDeLectura {
  texto: string
  tono: 'ok' | 'alerta' | 'neutro'
}

/**
 * La frase de arriba. Dice lo que NO salio bien antes que lo que si: quien sube
 * 40 archivos necesita saber cuantos tiene que mirar a mano, no cuantos
 * funcionaron.
 */
export function resumenDeLectura(r: RespuestaRecibosUI): ResumenDeLectura {
  const noLeidos = r.total - r.leidos
  const filas = filasDeConfirmacion(r.propuestas)
  const sinPunto = filas.filter((f) => !f.punto).length
  const repetidos = filas.filter((f) => f.yaCapturado).length
  const sinCifra = filas.filter((f) => !f.kwh || !f.importe).length

  const pegas: string[] = []
  if (noLeidos > 0) {
    pegas.push(`${noLeidos} ${noLeidos === 1 ? 'archivo no es' : 'archivos no son'} un recibo de CFE`)
  }
  if (sinPunto > 0) pegas.push(`${sinPunto} sin predio: eligelo tú`)
  if (sinCifra > 0) pegas.push(`${sinCifra} con una cifra que no se pudo leer`)
  if (repetidos > 0) pegas.push(`${repetidos} ya capturados: volver a guardarlos DUPLICA el costo`)

  if (pegas.length > 0) {
    return {
      tono: 'alerta',
      texto:
        `Se leyeron ${r.leidos} de ${r.total} archivos y salen ${filas.length} renglones. ` +
        `Revisa antes de confirmar: ${pegas.join('; ')}.`,
    }
  }
  if (filas.length === 0) {
    return { tono: 'neutro', texto: 'No salió ningún renglón de estos archivos.' }
  }
  return {
    tono: 'ok',
    texto:
      `Se leyeron los ${r.total} ${r.total === 1 ? 'archivo' : 'archivos'} y salen ` +
      `${filas.length} ${filas.length === 1 ? 'renglón' : 'renglones'}. ` +
      'Míralos contra el recibo y confírmalos: nada se guarda hasta que le des a guardar.',
  }
}

/**
 * Lo leido, en una linea, para enseñarlo AL LADO de lo propuesto.
 *
 * Es la mitad que hace util la pantalla: sin el valor original delante, quien
 * confirma esta aprobando un numero que no puede comprobar.
 */
export function textoDeLoLeido(l: LecturaRecibo): string {
  const partes: string[] = []
  if (l.numeroServicio) partes.push(`servicio ${l.numeroServicio}`)
  if (l.medidorFisico) partes.push(`medidor ${l.medidorFisico}`)
  if (l.tarifa) partes.push(l.tarifa)
  if (l.desde && l.hasta) partes.push(`periodo ${l.desde} → ${l.hasta}`)
  // El cero LEIDO se enseña aunque no se acepte como dato: es la unica forma de
  // que quien captura entienda por que el campo salio vacio.
  if (l.kwh == null && l.kwhLeido != null) partes.push(`el PDF dice ${l.kwhLeido} kWh`)
  else if (l.kwhLeido != null) partes.push(`${l.kwhLeido} kWh`)
  if (l.facturacionPeriodo != null) partes.push(`facturación ${l.facturacionPeriodo.toFixed(2)}`)
  if (l.alumbradoPublico != null) partes.push(`alumbrado ${l.alumbradoPublico.toFixed(2)}`)
  // El Total se enseña SIEMPRE y marcado como lo que es: es el numero grande
  // del recibo, el que una persona buscaria, y NO es lo que se captura — lleva
  // adeudos, pagos y depositos de otros meses.
  if (l.totalDelRecibo != null) {
    partes.push(`Total del recibo ${l.totalDelRecibo.toFixed(2)} (incluye adeudos y pagos)`)
  }
  return partes.join(' · ')
}

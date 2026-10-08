import { formatNumero } from '@/lib/formato-numero'
import { formatMonto } from '@/lib/data/derive'
// ============================================================================
//  lib/server/recibos-cfe/interprete.ts — Del texto de un recibo de CFE a los
//  campos de `consumos_energia`. PURO: ni red, ni base, ni PDF.
// ----------------------------------------------------------------------------
//  Lo que convierte el PDF en las lineas que entran aqui vive en
//  `lector-pdf.ts`. La separacion no es estetica: **de bytes a campos hay dos
//  problemas distintos**, y solo uno de ellos necesita una dependencia de 3 MB.
//  Este, que es donde se decide cuanto dinero y cuanta energia se capturan, se
//  prueba con seis recibos reales anonimizados y sin montar nada.
//
//  ─── LA REGLA QUE MANDA SOBRE TODAS ──────────────────────────────────────
//  Decidida por el dueño el 2026-09-29, y son DOS reglas, no una:
//
//   1. Un campo que no se pudo leer sale `null`. **Nunca cero.** Un `kwh: 0`
//      AFIRMA que el medidor no giro, y una vez guardado no hay forma de
//      distinguirlo de un hueco: el reporte de rentabilidad lo suma como un
//      consumo real de cero y el margen sale mejor de lo que es, sin dar ningun
//      error. Es el mismo defecto que el `?? 0` del mapa, que convertia «no se
//      donde esta» en un punto concreto del oceano.
//
//   2. **Y un cero o un negativo LEIDO del PDF se rechaza igual que un
//      ilegible.** No es un dato: es una lectura fallida. Sale `null`, con su
//      motivo en `avisos`, y quien captura lo escribe a mano si el recibo de
//      verdad dice cero.
//
//  La segunda regla tiene un coste MEDIDO y conviene tenerlo escrito: de los 72
//  recibos del cliente, **10 traen `kWh` impreso en cero** con un importe que
//  no lo es —el cargo fijo se cobra igual—, repartidos en 5 numeros de servicio
//  (`TJN VIA RAPIDA ORIENTE`, `GDL PLAZA GALERIAS`, `CDMX CUCHILLA`,
//  `CDMX VDQ 2008` y `CDMX RIO CONSULADO 2334`). Esos 10 salen con el campo
//  vacio y marcado, a proposito: el dueño prefiere teclearlos a que un cero
//  automatico entre al reporte sin que nadie lo mire.
//
//  Lo leido NO se tira: va en `kwhLeido` e `importeLeido`, que es lo que la
//  pantalla enseña al lado («el PDF dice 0»).
//
//  ─── QUE IMPORTE SE PROPONE, Y POR QUE NO EL `Total` ─────────────────────
//  El `Total` del recibo NO es el costo de la luz del periodo: lleva dentro el
//  adeudo anterior, los pagos hechos y, en 8 de los 72 recibos medidos, un
//  `Deposito` en garantia. En `pdbtConDeposito` la luz del periodo son 994.64 y
//  el Total son 4,309.64 — capturar el Total multiplicaria por 4.3 el costo de
//  ese predio, y nadie lo notaria porque sale un numero creible.
//
//  Se propone `Facturacion del Periodo` + el alumbrado publico (`DSAP` o
//  `DAP((2))`, que son la misma cosa con dos etiquetas). El alumbrado se incluye
//  porque es un cargo del periodo, de ese medidor, que el negocio paga; queda
//  ademas visible por separado en `conceptos` para que quien confirma lo vea.
//
//  ─── LA COMPROBACION QUE CONVIERTE ESTO EN ALGO FIABLE ───────────────────
//  El propio recibo se comprueba a si mismo: `Facturacion del Periodo` mas
//  todos los conceptos que van DESPUES de el tiene que dar exactamente el
//  `Total` impreso. Si no cierra, alguna cifra se leyo mal y se dice, en vez de
//  devolver numeros creibles y falsos. Medido el 2026-09-29 sobre los 72
//  recibos del cliente: cierra en los 72, al centavo.
// ============================================================================

export interface ConceptoRecibo {
  /** La etiqueta tal como esta impresa: `DSAP`, `Deposito`, `Su Pago`… */
  etiqueta: string
  monto: number
}

export interface ReciboCfe {
  /** `false` si el archivo no es un recibo de CFE. Con `false`, todo va `null`. */
  esRecibo: boolean
  /**
   * `NO. DE SERVICIO`. Es el identificador del PUNTO DE SUMINISTRO y el que se
   * propone guardar en `consumos_energia.medidor` — ver `propuesta.ts`.
   */
  numeroServicio: string | null
  /**
   * `NO. MEDIDOR`. Es el aparato fisico, y CFE lo cambia sin que el servicio
   * cambie: no sirve para identificar al predio a lo largo del tiempo.
   */
  medidorFisico: string | null
  tarifa: string | null
  /** Primer dia del periodo facturado, `AAAA-MM-DD`. */
  desde: string | null
  /** Ultimo dia del periodo facturado, `AAAA-MM-DD`, incluido. */
  hasta: string | null
  /** Los kWh ACEPTADOS. `null` si no se leyeron o si salieron <= 0. */
  kwh: number | null
  /**
   * Lo que el PDF dice, tal cual, incluido un 0. Existe para enseñarlo al lado
   * —«el recibo dice 0»— sin que eso lo convierta en un dato capturable.
   */
  kwhLeido: number | null
  /** `Fac. del Periodo` / `Facturacion del Periodo`, sin alumbrado publico. */
  facturacionPeriodo: number | null
  /** `DSAP` o `DAP((2))`. `null` si el recibo no lo trae. */
  alumbradoPublico: number | null
  /** El importe ACEPTADO. `null` si no se leyo o si salio <= 0. */
  importe: number | null
  /** El importe calculado tal cual, incluido un 0 o un negativo. */
  importeLeido: number | null
  /** El `Total` impreso. NO es el costo del periodo. Se guarda para enseñarlo. */
  totalDelRecibo: number | null
  /** El desglose entero, en el orden del papel. */
  conceptos: ConceptoRecibo[]
  /** Lo que no se pudo leer o no cuadra. Se enseña, no se esconde. */
  avisos: string[]
}

export interface RenglonDeMes {
  /** `AAAA-MM-01`, que es lo que exige el CHECK de `consumos_energia`. */
  periodo: string
  kwh: number | null
  importe: number | null
  /** Dias del periodo facturado que caen en ese mes. Se enseña. */
  dias: number
}

const MESES: Record<string, number> = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12,
}

const VACIO = (): ReciboCfe => ({
  esRecibo: false,
  numeroServicio: null,
  medidorFisico: null,
  tarifa: null,
  desde: null,
  hasta: null,
  kwh: null,
  kwhLeido: null,
  facturacionPeriodo: null,
  alumbradoPublico: null,
  importe: null,
  importeLeido: null,
  totalDelRecibo: null,
  conceptos: [],
  avisos: [],
})

/** Dos decimales, que es la precision de `numeric(12,2)` y `numeric(14,2)`. */
const dosDecimales = (n: number): number => Math.round(n * 100) / 100

const aNumero = (s: string): number => Number(s.replace(/,/g, ''))

/**
 * Lo que se acepta como cifra LEIDA: un numero finito y **estrictamente mayor
 * que cero**.
 *
 * El «mayor que cero» lo decidio el dueño el 2026-09-29 y es mas duro que el
 * CHECK de la base, que admite el cero (`consumo_energia_cifras_ck`). El motivo
 * es que este camino no lo teclea una persona: lo propone una maquina que puede
 * haberse equivocado, y **un cero automatico no dice «no se», dice «no consumio
 * luz»**. Dentro del reporte de rentabilidad esos dos hechos son el mismo
 * numero y ya no hay forma de separarlos.
 *
 * Un negativo tampoco: en un recibo eso es una nota de credito, y sumado como
 * consumo RESTARIA costo y mejoraria el margen sin que nada lo dijera.
 */
function aceptable(valor: number | null): number | null {
  if (valor == null || !Number.isFinite(valor)) return null
  return valor > 0 ? valor : null
}

const esMonto = (s: string): boolean => /^-?[\d,]+\.\d{2}$/.test(s)
const esCifra = (s: string): boolean => /^-?[\d,]+(\.\d+)?$/.test(s)

const fechaIso = (dia: string, mes: string, anio: string): string | null => {
  const m = MESES[mes.toUpperCase()]
  if (!m) return null
  const d = Number(dia)
  if (!(d >= 1 && d <= 31)) return null
  return `${2000 + Number(anio)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * El desglose del importe, leido SIN mirar coordenadas.
 *
 * El PDF pinta dos columnas, y una linea de texto trae las dos pegadas:
 * `Transmisión 0.00 0.00 497.11 497.11 Subtotal 7,257.97`. Lo que interesa es
 * el par de la derecha, y se saca leyendo la linea DE DERECHA A IZQUIERDA: el
 * ultimo componente es el monto, y la etiqueta son las palabras que lo
 * preceden hasta topar con otra cifra.
 *
 * Se hace asi y no por la posicion `x` de cada trozo a proposito: la `x` de la
 * columna cambia entre las tres plantillas (PDBT, GDMTO, GDMTH) y con ella se
 * rompen las tres a la vez el dia que CFE mueva un milimetro. La forma
 * «palabras, luego numero, y antes otro numero» es la misma en las tres.
 */
export function conceptosDelDesglose(lineas: string[]): ConceptoRecibo[] {
  const salida: ConceptoRecibo[] = []
  for (const linea of lineas) {
    const tk = linea.trim().split(/\s+/)
    if (tk.length < 2) continue
    const monto = tk[tk.length - 1]
    if (!esMonto(monto)) continue
    const etiqueta: string[] = []
    for (let i = tk.length - 2; i >= 0; i--) {
      if (esCifra(tk[i])) break
      etiqueta.unshift(tk[i])
    }
    if (etiqueta.length === 0) continue
    // La etiqueta tiene que LLEVAR alguna letra. Sin esto, un renglon cuyo
    // penultimo componente sea un simbolo suelto entraria como concepto con una
    // etiqueta que no significa nada.
    //
    // Hasta el 2026-09-29 esto exigia EMPEZAR por letra, y estaba MAL: se
    // comio `2% Baja Tension((3))`, que es un concepto de verdad de los recibos
    // de media tension (12 de los 72 del cliente lo traen). Lo encontro una
    // mutacion que sobrevivio — la prueba no miraba ese concepto — y el mutante
    // superviviente era el defecto, como suele pasar.
    if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(etiqueta.join(' '))) continue
    salida.push({ etiqueta: etiqueta.join(' '), monto: aNumero(monto) })
  }
  return salida
}

const ES_FACTURACION = /^Fac(?:turacion|\.) del Periodo$/
const ES_ALUMBRADO = /^D(?:S)?AP(?:\(\(\d\)\))?$/

export function interpretarRecibo(lineas: string[]): ReciboCfe {
  const r = VACIO()
  const texto = lineas.join('\n')

  // Que ESTO es un recibo de CFE se decide con dos señales y no con una: el
  // numero de servicio solo, en un PDF cualquiera, seria un numero de doce
  // cifras al lado de unas palabras. Sin las dos, un contrato de arrendamiento
  // con un `Total` acabaria proponiendo un consumo de luz.
  const servicio = texto.match(/NO\. DE SERVICIO:\s*(\d{8,14})/)
  const esCfe = /Comisi[óo]n Federal de Electricidad|CFE370814QI0/i.test(texto)
  if (!servicio || !esCfe) {
    r.avisos.push('El archivo no parece un recibo de CFE: no se encontro el numero de servicio.')
    return r
  }

  r.esRecibo = true
  r.numeroServicio = servicio[1]
  r.medidorFisico = texto.match(/NO\. MEDIDOR:\s*([A-Z0-9-]+)/)?.[1] ?? null
  r.tarifa = texto.match(/TARIFA:\s*([A-Z0-9-]+)/)?.[1] ?? null

  const periodo = texto.match(
    /PERIODO FACTURADO:\s*(\d{1,2})\s+([A-ZÁÉÍÓÚ]{3})\s+(\d{2})\s*-\s*(\d{1,2})\s+([A-ZÁÉÍÓÚ]{3})\s+(\d{2})/,
  )
  if (periodo) {
    r.desde = fechaIso(periodo[1], periodo[2], periodo[3])
    r.hasta = fechaIso(periodo[4], periodo[5], periodo[6])
  }
  if (!r.desde || !r.hasta) {
    r.desde = null
    r.hasta = null
    r.avisos.push('No se pudo leer el periodo facturado del recibo.')
  }

  r.kwhLeido = leerKwh(texto)
  r.kwh = aceptable(r.kwhLeido)
  if (r.kwhLeido == null) {
    r.avisos.push('No se pudieron leer los kWh del recibo: capturalos a mano.')
  } else if (r.kwh == null) {
    r.avisos.push(
      `El recibo dice ${formatNumero(r.kwhLeido)} kWh, y un valor de cero o negativo no se acepta ` +
        'como lectura: escribelo a mano si el recibo de verdad dice eso.',
    )
  }

  r.conceptos = conceptosDelDesglose(lineas)
  const iFac = r.conceptos.findIndex((c) => ES_FACTURACION.test(c.etiqueta))
  const iTotal = ultimoIndice(r.conceptos, (c) => c.etiqueta === 'Total')

  if (iFac >= 0) {
    r.facturacionPeriodo = r.conceptos[iFac].monto
    const alumbrado = r.conceptos.find((c) => ES_ALUMBRADO.test(c.etiqueta))
    r.alumbradoPublico = alumbrado ? alumbrado.monto : null
    r.importeLeido = dosDecimales(r.facturacionPeriodo + (r.alumbradoPublico ?? 0))
    r.importe = aceptable(r.importeLeido)
    if (r.importe == null) {
      r.avisos.push(
        `El importe del periodo se leyo como ${formatMonto(r.importeLeido)}, y un valor de ` +
          'cero o negativo no se acepta como lectura: escribelo a mano.',
      )
    }
  } else {
    r.avisos.push('No se pudo leer el importe del periodo (Facturacion del Periodo).')
  }

  if (iTotal != null) r.totalDelRecibo = r.conceptos[iTotal].monto

  // La comprobacion del propio recibo. Solo tiene sentido con las dos anclas.
  if (iFac >= 0 && iTotal != null && iTotal > iFac) {
    const posteriores = r.conceptos.slice(iFac + 1, iTotal)
    const suma = posteriores.reduce((a, c) => a + c.monto, r.conceptos[iFac].monto)
    if (Math.abs(suma - r.conceptos[iTotal].monto) > 0.02) {
      r.avisos.push(
        `La aritmetica del recibo no cuadra: ${formatMonto(suma)} contra un Total de ` +
          `${formatMonto(r.conceptos[iTotal].monto)}. Alguna cifra se leyo mal; revisa el PDF.`,
      )
    }
  }

  return r
}

/**
 * Los kWh, que cambian de sitio segun la tarifa. Las tres formas que aparecen
 * en los 72 recibos medidos, en el orden en que se intentan:
 *
 *  · PDBT (57): `Energía (kWh) 74,978 72,230 2,748` — lectura actual, lectura
 *    anterior y CONSUMO. La buena es la tercera: quedarse con la primera daria
 *    un costo por kWh 27 veces menor, y seguiria pareciendo un numero normal.
 *  · GDMTO (12): `kWh B000BB 48,285 41,176 7,109 7,109` — el numero de medidor
 *    va DENTRO del renglon. La buena es la ultima.
 *  · GDMTH (3): no hay total. Hay `kWh base`, `kWh intermedia` y `kWh punta`, y
 *    se suman. Quedarse con una sola declararia menos de un cuarto del consumo.
 */
function leerKwh(texto: string): number | null {
  const pdbt = texto.match(/Energ[íi]a \(kWh\)\s+(-?[\d,]+)\s+(-?[\d,]+)\s+(-?[\d,]+)/)
  if (pdbt) return aNumero(pdbt[3])

  const gdmto = texto.match(/^kWh\s+[A-Z0-9-]+\s+-?[\d,]+\s+-?[\d,]+\s+-?[\d,]+\s+(-?[\d,]+)\s*$/m)
  if (gdmto) return aNumero(gdmto[1])

  const base = texto.match(/^kWh base\s+(-?[\d,]+)\s*$/m)
  const intermedia = texto.match(/^kWh intermedia\s+(-?[\d,]+)\s*$/m)
  const punta = texto.match(/^kWh punta\s+(-?[\d,]+)\s*$/m)
  // Las TRES o ninguna: con dos de las tres el total saldria corto y creible.
  if (base && intermedia && punta) {
    return aNumero(base[1]) + aNumero(intermedia[1]) + aNumero(punta[1])
  }
  return null
}

function ultimoIndice<T>(xs: T[], pred: (x: T) => boolean): number | null {
  for (let i = xs.length - 1; i >= 0; i--) if (pred(xs[i])) return i
  return null
}

// ============================================================================
//  El reparto en meses de calendario.
// ----------------------------------------------------------------------------
//  `consumos_energia.periodo` es el dia 1 de UN mes y lo exige un CHECK. Pero un
//  recibo de CFE no es mensual: de los 72 del cliente, medidos el 2026-09-29,
//  **solo UNO cabe dentro de un mes de calendario**. 19 tocan dos meses, 49
//  tocan tres y 3 tocan cuatro.
//
//  Meter un recibo bimestral entero en un mes hace DOS daños a la vez, y
//  ninguno da error: ese mes queda con el doble de costo del que tuvo, y el mes
//  de al lado queda vacio — que el reporte declara como «falta recibo» para
//  siempre, porque nunca va a llegar uno.
//
//  Repartir por los dias que caen en cada mes es ademas lo que ya hace el motor
//  del reporte con un recibo mensual cuando el bucket lo corta a la mitad
//  (`lib/data/reportes.ts`, «COSTO DE LA ENERGIA»): aqui se aplica la misma
//  regla un nivel antes, al recibo entero.
//
//  **Esto NO se guarda solo.** Devuelve renglones PROPUESTOS, con sus dias a la
//  vista, para que una persona los mire antes de confirmarlos.
// ============================================================================

export function repartirEnMeses(
  desde: string | null,
  hasta: string | null,
  kwh: number | null,
  importe: number | null,
): RenglonDeMes[] {
  if (!desde || !hasta) return []
  const [a1, m1, d1] = desde.split('-').map(Number)
  const [a2, m2, d2] = hasta.split('-').map(Number)
  if (!a1 || !a2) return []
  if (a2 * 10000 + m2 * 100 + d2 < a1 * 10000 + m1 * 100 + d1) return []

  const tramos: { periodo: string; dias: number }[] = []
  let a = a1
  let m = m1
  while (a < a2 || (a === a2 && m <= m2)) {
    const ultimoDelMes = diasDelMes(a, m)
    const primerDia = a === a1 && m === m1 ? d1 : 1
    const ultimoDia = a === a2 && m === m2 ? d2 : ultimoDelMes
    tramos.push({
      periodo: `${a}-${String(m).padStart(2, '0')}-01`,
      // Inclusivo por los dos lados: del 3 al 30 de noviembre son 28 dias de
      // consumo, no 27. El medidor giro los dos.
      dias: ultimoDia - primerDia + 1,
    })
    m += 1
    if (m > 12) { m = 1; a += 1 }
  }

  const total = tramos.reduce((s, t) => s + t.dias, 0)
  return tramos.map((t, i) => ({
    periodo: t.periodo,
    dias: t.dias,
    // El ULTIMO renglon absorbe el redondeo, y por eso se calcula restando en
    // vez de multiplicando: sin esto, repartir 7,940.44 entre tres meses deja
    // unos centavos fuera del reporte cada vez y nadie los busca nunca.
    kwh: repartir(kwh, t.dias, total, i === tramos.length - 1, tramos, i),
    importe: repartir(importe, t.dias, total, i === tramos.length - 1, tramos, i),
  }))
}

function repartir(
  valor: number | null,
  dias: number,
  total: number,
  esUltimo: boolean,
  tramos: { dias: number }[],
  indice: number,
): number | null {
  // `null` se propaga como `null`. Repartir un dato que no se leyo en ceros por
  // mes seria fabricar tres afirmaciones falsas a partir de una ausencia.
  if (valor == null) return null
  if (total <= 0) return null
  if (!esUltimo) return dosDecimales((valor * dias) / total)
  let acumulado = 0
  for (let i = 0; i < indice; i++) acumulado += dosDecimales((valor * tramos[i].dias) / total)
  return dosDecimales(valor - acumulado)
}

function diasDelMes(anio: number, mes: number): number {
  if (mes === 2) return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0 ? 29 : 28
  return [4, 6, 9, 11].includes(mes) ? 30 : 31
}

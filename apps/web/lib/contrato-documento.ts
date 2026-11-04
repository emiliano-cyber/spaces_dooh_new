// ============================================================================
//  lib/contrato-documento.ts — Redacta el contrato de arrendamiento de espacio
//  publicitario a partir de los datos que ya vive el sistema.
//
//  Estructura mexicana estándar: DECLARACIONES (quién es cada parte y con qué
//  personalidad comparece) seguidas de CLÁUSULAS numeradas en ordinal femenino.
//  Se modeló sobre contratos reales de arrendamiento de espacio publicitario
//  —espectaculares y pantallas— publicados en portales de transparencia.
//
//  Es una función PURA: entra el expediente, sale la estructura del documento.
//  Sin fetch, sin fecha del sistema (la fecha de firma entra como dato), para
//  que sea reproducible y testeable.
//
//  IMPORTANTE: esto redacta un BORRADOR a partir de cláusulas de uso común. No
//  sustituye la revisión de un abogado, y así lo advierte el propio documento.
//
//  ─── ADR 0049 · EN EL IDIOMA DE LA INSTANCIA (2026-11-03) ──────────────────
//  El contrato sale en el idioma de los DOCUMENTOS de la instancia (`es`, `en`
//  o `it`), elegido al crearla e inmutable (`tenants.idioma_documentos`). NO
//  en el de quien mira la pantalla: el texto se sella con SHA-256, y dos
//  personas viendo el mismo contrato en dos idiomas verían dos documentos con
//  dos hashes distintos.
//
//  · El ESPANOL es el texto de siempre, byte a byte: el camino de `es` de
//    `generarContrato` no se tocó, y `contrato-documento-idioma.test.ts` fija
//    los hashes medidos ANTES de este cambio.
//  · El INGLES y el ITALIANO (`redactarEnOtroIdioma`, al final) son una
//    traducción fiel del español, cláusula por cláusula. **REQUIEREN REVISIÓN
//    DE UN ABOGADO antes de usarse con clientes**: son el mismo contrato de
//    derecho mexicano (RFC, CFDI, Código Civil) puesto en otro idioma, no un
//    contrato adaptado a otra jurisdicción.
// ============================================================================

import type { Idioma } from '@/lib/i18n/idiomas'

export type Periodicidad =
  | 'SEMANAL' | 'CATORCENAL' | 'QUINCENAL' | 'MENSUAL'
  | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'

export interface DatosArrendatario {
  razonSocial: string | null
  rfc: string | null
  domicilioFiscal: string | null
  representanteLegal: string | null
  datosConstitucion: string | null
}

export interface DatosArrendador {
  nombre: string | null
  rfc: string | null
  curp: string | null
  direccion: string | null
  nacionalidad: string | null
  razonSocial: string | null
}

export interface DatosEspacio {
  nombre: string | null
  codigo: string | null
  tipoMedio: string | null
  direccion: string | null
  ciudad: string | null
  ancho: number | null
  alto: number | null
  predio: string | null
}

export interface DatosTerminos {
  fechaInicio: string | null
  fechaFin: string | null
  montoRenta: number | null
  periodicidad: Periodicidad | null
  moneda: string
  deposito: number | null
  diaPago: number | null
  incrementoAnualPct: number | null
  usoPermitido: string | null
  autoRenovable: boolean
  ciudadFirma: string | null
}

export interface Clausula {
  ordinal: string
  titulo: string
  parrafos: string[]
}

export interface DocumentoContrato {
  titulo: string
  preambulo: string
  declaraciones: { encabezado: string; incisos: string[] }[]
  clausulas: Clausula[]
  lugarYFecha: string
  // `parte` (ADR 0049): para emparejar cada firma con su sello sin leer el
  // `rol` —«EL ARRENDADOR», «THE LESSOR», «IL LOCATORE»—. NO entra en
  // `documentoATexto`, así que no cambia ningún hash.
  firmas: { rol: string; nombre: string; parte: 'ARRENDADOR' | 'ARRENDATARIO' }[]
  /** ADR 0049 · el idioma en que está redactado (el de la instancia). */
  idioma: Idioma
  // Datos que el expediente no tiene. El documento los deja marcados en vez de
  // inventarlos: un contrato con un dato falso es peor que uno con un hueco.
  //
  // Cada uno dice DÓNDE se captura. Sin eso, el aviso nombra cuatro datos y deja
  // al usuario buscándolos por la aplicación — y tres viven en Administración
  // mientras el cuarto está en la ficha del arrendador, que no es adivinable.
  faltantes: Faltante[]
}

export interface Faltante {
  etiqueta: string
  /** Dónde se captura, en palabras de la propia aplicación. */
  donde: string
}

// Marcador visible de dato ausente. Se busca literalmente en la UI para
// resaltarlo, así que no cambiarlo sin actualizar la página del documento.
export const FALTA = '_______________'

const ORDINALES = [
  'PRIMERA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA', 'SEXTA', 'SÉPTIMA',
  'OCTAVA', 'NOVENA', 'DÉCIMA', 'DÉCIMA PRIMERA', 'DÉCIMA SEGUNDA',
  'DÉCIMA TERCERA', 'DÉCIMA CUARTA', 'DÉCIMA QUINTA', 'DÉCIMA SEXTA',
  'DÉCIMA SÉPTIMA', 'DÉCIMA OCTAVA', 'DÉCIMA NOVENA', 'VIGÉSIMA',
]

const CADA: Record<Periodicidad, string> = {
  SEMANAL: 'cada semana',
  CATORCENAL: 'cada catorce días',
  QUINCENAL: 'cada quincena',
  MENSUAL: 'cada mes',
  BIMESTRAL: 'cada dos meses',
  TRIMESTRAL: 'cada tres meses',
  SEMESTRAL: 'cada seis meses',
  ANUAL: 'cada año',
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// ─── Número a letras (es-MX) ────────────────────────────────────────────────
// Los contratos mexicanos escriben el importe en letra además de en cifra, y la
// discrepancia entre ambos es causa clásica de disputa. Se genera, no se pide.
const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
  'DIECIOCHO', 'DIECINUEVE', 'VEINTE']
const DECENAS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

function centenasALetras(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'
  const c = Math.floor(n / 100)
  const resto = n % 100
  const partes: string[] = []
  if (c) partes.push(CENTENAS[c])
  if (resto <= 20) {
    if (resto) partes.push(UNIDADES[resto])
  } else if (resto < 30) {
    // 21–29 se escriben en una sola palabra y tres llevan acento.
    const VEINTI = ['', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO',
      'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
    partes.push(VEINTI[resto - 20])
  } else {
    const d = Math.floor(resto / 10)
    const u = resto % 10
    partes.push(u ? `${DECENAS[d]} Y ${UNIDADES[u]}` : DECENAS[d])
  }
  return partes.join(' ')
}

// Apócope: ante sustantivo masculino, "UNO" se abrevia a "UN" (treinta y UN
// pesos, ciento UN pesos, UN millón). Sin esto el importe en letra queda mal
// escrito, y en un contrato la letra es la que prevalece sobre la cifra.
function apocopar(s: string): string {
  return s === 'UNO' ? 'UN' : s.replace(/ UNO$/, ' UN')
}

// ADR 0048 · la letra va en la moneda del importe. Hasta el 02/11 decia PESOS
// siempre, y en un contrato la letra es la que prevalece sobre la cifra: un
// contrato en dolares habria dicho una cosa en numero y otra en letra. Sin
// moneda, MXN, que es lo de siempre (y el texto que se firma no cambia).
const LETRA_MONEDA: Record<string, { uno: string; varios: string; cierre: string }> = {
  MXN: { uno: 'PESO', varios: 'PESOS', cierre: 'M.N.' },
  USD: { uno: 'DÓLAR', varios: 'DÓLARES', cierre: 'USD' },
}

/**
 * La cantidad con letra. `idioma` (ADR 0049) es el del DOCUMENTO; sin él, el
 * español de siempre. En inglés e italiano cierra con el código ISO (`MXN`,
 * `USD`): «M.N.» (moneda nacional) solo tiene sentido en español.
 */
export function numeroALetras(monto: number, moneda: string = 'MXN', idioma: Idioma = 'es'): string {
  if (idioma === 'en') return letrasIngles(monto, moneda)
  if (idioma === 'it') return letrasItaliano(monto, moneda)
  const m = LETRA_MONEDA[moneda] ?? LETRA_MONEDA.MXN
  const entero = Math.floor(Math.abs(monto))
  const centavos = Math.round((Math.abs(monto) - entero) * 100)
  const cent = String(centavos).padStart(2, '0')
  if (entero === 0) return `CERO ${m.varios} ${cent}/100 ${m.cierre}`

  const millones = Math.floor(entero / 1_000_000)
  const miles = Math.floor((entero % 1_000_000) / 1000)
  const resto = entero % 1000

  const partes: string[] = []
  if (millones === 1) partes.push('UN MILLÓN')
  else if (millones > 1) partes.push(`${apocopar(centenasALetras(millones))} MILLONES`)
  if (miles === 1) partes.push('MIL')
  else if (miles > 1) partes.push(`${apocopar(centenasALetras(miles))} MIL`)
  if (resto) partes.push(apocopar(centenasALetras(resto)))

  const plural = entero === 1 ? m.uno : m.varios
  return `${partes.join(' ')} ${plural} ${cent}/100 ${m.cierre}`
}

// Serializa el documento a texto plano. Es LO QUE SE FIRMA: sobre esta cadena
// se calcula el SHA-256 que sella la versión firmada, así que su formato es
// parte del contrato de datos. Cambiarlo invalida todas las firmas existentes
// (los hashes dejarían de coincidir), igual que reimprimir el papel con otro
// texto. Es determinista a propósito: mismas entradas, misma cadena, mismo hash.
//
// ADR 0049: los dos encabezados salen de `encabezadosDocumento(doc.idioma)`,
// la MISMA tabla que pinta la página `/contrato/[id]`. En español son los
// literales de siempre.
export function documentoATexto(doc: DocumentoContrato): string {
  const e = encabezadosDocumento(doc.idioma ?? 'es')
  const lineas: string[] = [doc.titulo, '', doc.preambulo, '', e.declaraciones]
  for (const d of doc.declaraciones) {
    lineas.push('', d.encabezado, ...d.incisos)
  }
  lineas.push('', e.clausulas)
  for (const c of doc.clausulas) {
    lineas.push('', `${c.ordinal}. ${c.titulo}.`, ...c.parrafos)
  }
  lineas.push('', doc.lugarYFecha, '')
  for (const f of doc.firmas) {
    lineas.push(`${f.rol}: ${f.nombre.replace(/\n/g, ' ')}`)
  }
  return lineas.join('\n')
}

// ─── Formato ────────────────────────────────────────────────────────────────
// Normaliza a 'YYYY-MM-DD' lo que `pg` devuelve de una columna `date`, que NO es
// una cadena sino un objeto Date en hora local. Sin esto, `String(fecha)` da
// "Fri Jul 31 2026 …" y el parseo de abajo falla en silencio: el contrato salía
// con la vigencia en blanco sin que nada lo reportara.
//
// Se compone de las partes LOCALES y no con toISOString(), porque el Date viene
// a medianoche local: en husos positivos (UTC+X) el UTC cae el día anterior y la
// fecha del contrato retrocedería 24 h.
export function fechaISO(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    const mm = String(v.getMonth() + 1).padStart(2, '0')
    const dd = String(v.getDate()).padStart(2, '0')
    return `${v.getFullYear()}-${mm}-${dd}`
  }
  const s = String(v).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

export function fechaEnLetra(iso: string | null, idioma: Idioma = 'es'): string {
  if (!iso) return FALTA
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!a || !m || !d) return FALTA
  // ADR 0049. Se escribe a mano y no con `Intl` por lo mismo que el español:
  // es parte del texto sellado, y no puede depender de la versión de ICU.
  if (idioma === 'en') return `${MONTHS[m - 1]} ${d}, ${a}`
  if (idioma === 'it') return `${d} ${MESI[m - 1]} ${a}`
  return `${d} de ${MESES[m - 1]} de ${a}`
}

/**
 * Cómo se escribe la cantidad con letra. `'en-su-moneda'` es la regla desde el
 * ADR 0048 (02/11): «DÓLARES … /100 USD» para un contrato en USD.
 * `'pesos-siempre'` es la regla ANTERIOR —«PESOS … M.N.» fuera cual fuera la
 * moneda— y existe solo para REGENERAR, byte a byte, lo que se congeló con ella
 * (ver `hashParaCotejar`). En MXN las dos dan el mismo texto.
 */
export type ReglaLetra = 'en-su-moneda' | 'pesos-siempre'

function importe(n: number | null, moneda: string, letra: ReglaLetra): string {
  if (n == null) return FALTA
  const cifra = n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `$${cifra} ${moneda} (${numeroALetras(n, letra === 'pesos-siempre' ? 'MXN' : moneda)})`
}

const v = (x: string | null | undefined): string => (x && String(x).trim() ? String(x).trim() : FALTA)

// ─── Redacción ──────────────────────────────────────────────────────────────
export function generarContrato(args: {
  arrendatario: DatosArrendatario
  arrendador: DatosArrendador
  espacio: DatosEspacio
  terminos: DatosTerminos
  fechaFirma: string | null
  /** Solo para regenerar lo congelado antes del ADR 0048. Por omisión, la regla de hoy. */
  letra?: ReglaLetra
  /**
   * ADR 0049 · el idioma de los documentos de la INSTANCIA
   * (`idiomaDeLaInstancia()`), nunca el de la petición. Por omisión `es`.
   */
  idioma?: Idioma
}): DocumentoContrato {
  const { arrendatario, arrendador, espacio, terminos, fechaFirma } = args
  const letra: ReglaLetra = args.letra ?? 'en-su-moneda'
  const idioma: Idioma = args.idioma ?? 'es'
  const faltantes: Faltante[] = []
  const exigir = (valor: string | number | null | undefined, etiqueta: string, donde: string) => {
    if (valor == null || String(valor).trim() === '') faltantes.push({ etiqueta, donde })
  }

  // Los datos fiscales de TU empresa son los mismos para todos los contratos: se
  // capturan una vez y sirven para siempre. Los del arrendador, una vez por
  // arrendador. Decirlo evita que se busquen contrato por contrato.
  const ADMIN = 'Administración › Datos fiscales de la empresa'
  const FICHA = 'Arrendadores › ficha del arrendador'
  const CONTRATO = 'la ficha de este contrato'

  exigir(arrendatario.razonSocial, 'Razón social de tu empresa', ADMIN)
  exigir(arrendatario.rfc, 'RFC de tu empresa', ADMIN)
  exigir(arrendatario.domicilioFiscal, 'Domicilio fiscal de tu empresa', ADMIN)
  exigir(arrendatario.representanteLegal, 'Representante legal de tu empresa', ADMIN)
  exigir(arrendador.nombre, 'Nombre del arrendador', FICHA)
  exigir(arrendador.rfc, 'RFC del arrendador', FICHA)
  exigir(arrendador.direccion, 'Domicilio del arrendador', FICHA)
  exigir(espacio.direccion, 'Dirección del espacio', 'Inventario › ficha de la pantalla o del predio')
  exigir(terminos.fechaInicio, 'Fecha de inicio', CONTRATO)
  exigir(terminos.fechaFin, 'Fecha de fin', CONTRATO)
  exigir(terminos.montoRenta, 'Importe de la renta', CONTRATO)
  exigir(terminos.periodicidad, 'Periodicidad del pago', CONTRATO)

  // ADR 0049 · los faltantes de arriba son INTERFAZ (la barra del documento
  // los traduce a quien mira) y son los mismos en todo idioma. Lo que sigue
  // es el TEXTO: el español se queda en este camino, intacto.
  if (idioma !== 'es') return { ...redactarEnOtroIdioma(idioma, args), faltantes, idioma }

  const ARR = 'EL ARRENDADOR'
  const ATA = 'EL ARRENDATARIO'
  const ciudad = v(terminos.ciudadFirma ?? espacio.ciudad)

  const medidas =
    espacio.ancho && espacio.alto
      ? `${espacio.ancho} m de ancho por ${espacio.alto} m de alto (${(espacio.ancho * espacio.alto).toFixed(2)} m²)`
      : FALTA

  const descripcionEspacio =
    `${v(espacio.nombre)}${espacio.codigo ? ` (clave ${espacio.codigo})` : ''}, ` +
    `ubicado en ${v(espacio.direccion)}${espacio.predio ? `, dentro del predio denominado «${espacio.predio}»` : ''}`

  const cada = terminos.periodicidad ? CADA[terminos.periodicidad] : FALTA
  const uso = v(
    terminos.usoPermitido ??
      'la instalación, operación y explotación comercial de una estructura publicitaria',
  )

  const clausulas: Clausula[] = []
  const add = (titulo: string, parrafos: string[]) =>
    clausulas.push({ ordinal: ORDINALES[clausulas.length] ?? `${clausulas.length + 1}ª`, titulo, parrafos })

  add('OBJETO', [
    `${ARR} otorga en arrendamiento a ${ATA}, y este último lo recibe a su entera satisfacción, ` +
      `el espacio identificado como ${descripcionEspacio}, con una superficie útil de ${medidas} ` +
      `(en lo sucesivo, «EL ESPACIO»).`,
    `${ATA} destinará EL ESPACIO exclusivamente a ${uso}. Cualquier uso distinto requiere ` +
      `autorización previa y por escrito de ${ARR}.`,
  ])

  add('VIGENCIA', [
    `El presente contrato estará vigente del ${fechaEnLetra(terminos.fechaInicio)} al ` +
      `${fechaEnLetra(terminos.fechaFin)}, plazo que ambas partes reconocen como forzoso.`,
    terminos.autoRenovable
      ? `Concluido el plazo, el contrato se prorrogará automáticamente por periodos iguales, salvo que ` +
        `cualquiera de las partes comunique a la otra su voluntad de no renovarlo, por escrito y con al ` +
        `menos treinta (30) días naturales de anticipación a su vencimiento.`
      : `El contrato NO se renueva de forma automática. Su continuación requiere un nuevo acuerdo escrito ` +
        `entre las partes.`,
  ])

  const parrafosRenta = [
    `${ATA} pagará a ${ARR} la cantidad de ${importe(terminos.montoRenta, terminos.moneda, letra)} ` +
      `${cada}, por concepto de renta de EL ESPACIO.`,
    `El pago se realizará ${terminos.diaPago ? `dentro de los primeros ${terminos.diaPago} días naturales de cada periodo` : 'dentro de los primeros cinco (5) días naturales de cada periodo'}, ` +
      `mediante transferencia electrónica a la cuenta que ${ARR} designe por escrito. ${ARR} se obliga a ` +
      `entregar el Comprobante Fiscal Digital por Internet (CFDI) correspondiente como requisito previo al pago.`,
  ]
  if (terminos.incrementoAnualPct != null) {
    parrafosRenta.push(
      `La renta se incrementará anualmente en un ${terminos.incrementoAnualPct}% sobre el monto vigente ` +
        `al momento del ajuste, en la fecha aniversario del inicio de vigencia.`,
    )
  }
  if (terminos.deposito != null && terminos.deposito > 0) {
    parrafosRenta.push(
      `A la firma de este contrato, ${ATA} entrega a ${ARR} la cantidad de ` +
        `${importe(terminos.deposito, terminos.moneda, letra)} por concepto de depósito en garantía, que será ` +
        `devuelta dentro de los treinta (30) días naturales siguientes a la terminación del contrato, ` +
        `previa verificación del estado de EL ESPACIO.`,
    )
  }
  add('RENTA Y FORMA DE PAGO', parrafosRenta)

  add('OBLIGACIONES DE EL ARRENDATARIO', [
    `a) Pagar la renta en los términos pactados.`,
    `b) Tramitar y mantener vigentes, por su cuenta y costo, las licencias, permisos y autorizaciones ` +
      `que la autoridad competente exija para la instalación y operación de la estructura publicitaria.`,
    `c) Mantener la estructura en condiciones adecuadas de seguridad y conservación, y responder por los ` +
      `daños que su instalación, operación o retiro causen a EL ESPACIO o a terceros.`,
    `d) Contratar y mantener vigente una póliza de seguro de responsabilidad civil que ampare daños a ` +
      `terceros derivados de la estructura.`,
    `e) Cubrir el consumo de energía eléctrica que la estructura demande, mediante medidor independiente ` +
      `cuando ello sea técnicamente posible.`,
    `f) Retirar la estructura y restituir EL ESPACIO en las condiciones en que lo recibió, salvo el ` +
      `deterioro por uso normal, dentro de los quince (15) días naturales siguientes a la terminación.`,
  ])

  add('OBLIGACIONES DE EL ARRENDADOR', [
    `a) Garantizar a ${ATA} el uso pacífico de EL ESPACIO durante toda la vigencia.`,
    `b) Permitir el acceso del personal de ${ATA} para la instalación, cambio de imagen, mantenimiento ` +
      `y retiro de la estructura, en horarios razonables y previo aviso.`,
    `c) Abstenerse de instalar o autorizar a terceros la instalación de publicidad que obstruya la ` +
      `visibilidad de la estructura de ${ATA}.`,
    `d) Entregar el CFDI correspondiente a cada pago de renta.`,
    `e) Mantener al corriente los impuestos y contribuciones que graven el inmueble.`,
  ])

  add('PROPIEDAD DE LA ESTRUCTURA', [
    `La estructura publicitaria, sus anclajes, sistemas de iluminación, equipos electrónicos y cualquier ` +
      `elemento instalado por ${ATA} son propiedad exclusiva de éste, no se consideran accesorios del ` +
      `inmueble y podrán ser retirados libremente a la terminación del contrato.`,
  ])

  add('PERMISOS Y AUTORIZACIONES', [
    `La obtención de los permisos es responsabilidad de ${ATA}. Si la autoridad competente niega, revoca ` +
      `o no renueva el permiso necesario para operar la estructura por causa no imputable a ${ATA}, ` +
      `cualquiera de las partes podrá dar por terminado el contrato sin responsabilidad alguna, mediante ` +
      `aviso por escrito, quedando ${ATA} obligado únicamente al pago de la renta devengada hasta esa fecha.`,
  ])

  add('CESIÓN', [
    `Ninguna de las partes podrá ceder los derechos y obligaciones derivados de este contrato sin el ` +
      `consentimiento previo y por escrito de la otra. Se exceptúa la cesión que ${ATA} realice a favor ` +
      `de sociedades de su mismo grupo, bastando aviso por escrito.`,
  ])

  add('RESCISIÓN', [
    `Serán causas de rescisión, sin necesidad de declaración judicial previa:`,
    `a) La falta de pago de dos (2) periodos consecutivos de renta.`,
    `b) El uso de EL ESPACIO para un fin distinto del pactado.`,
    `c) El incumplimiento de cualquiera de las obligaciones pactadas, si no se subsana dentro de los ` +
      `quince (15) días naturales siguientes al requerimiento por escrito.`,
    `La parte que rescinda deberá notificarlo por escrito, surtiendo efectos a partir de su recepción.`,
  ])

  add('CASO FORTUITO O FUERZA MAYOR', [
    `Ninguna de las partes será responsable por el incumplimiento derivado de caso fortuito o fuerza ` +
      `mayor. Si el evento impide el uso de EL ESPACIO por más de sesenta (60) días naturales, cualquiera ` +
      `de las partes podrá dar por terminado el contrato sin responsabilidad.`,
  ])

  add('DOMICILIOS Y NOTIFICACIONES', [
    `Para todos los efectos de este contrato, las partes señalan como domicilios:`,
    `${ARR}: ${v(arrendador.direccion)}.`,
    `${ATA}: ${v(arrendatario.domicilioFiscal)}.`,
    `Todo aviso deberá constar por escrito y entregarse con acuse de recibo en los domicilios señalados. ` +
      `Cualquier cambio deberá notificarse con diez (10) días naturales de anticipación; de lo contrario, ` +
      `las notificaciones surtirán efectos en el último domicilio conocido.`,
  ])

  add('LEGISLACIÓN APLICABLE Y JURISDICCIÓN', [
    `Este contrato se rige por el Código Civil aplicable en ${ciudad} y demás disposiciones relativas. ` +
      `Para la interpretación y cumplimiento del mismo, las partes se someten expresamente a la ` +
      `jurisdicción de los tribunales competentes de ${ciudad}, renunciando a cualquier otro fuero que ` +
      `pudiera corresponderles por razón de sus domicilios presentes o futuros.`,
  ])

  return {
    titulo: 'CONTRATO DE ARRENDAMIENTO DE ESPACIO PUBLICITARIO',
    preambulo:
      `Contrato de arrendamiento de espacio publicitario que celebran, por una parte, ` +
      `${v(arrendador.razonSocial ?? arrendador.nombre)}, a quien en lo sucesivo se le denominará ` +
      `«${ARR}»; y por la otra, ${v(arrendatario.razonSocial)}, representada en este acto por ` +
      `${v(arrendatario.representanteLegal)}, a quien en lo sucesivo se le denominará «${ATA}»; ` +
      `al tenor de las siguientes declaraciones y cláusulas:`,
    declaraciones: [
      {
        encabezado: `I. Declara ${ARR}:`,
        incisos: [
          `a) Ser persona ${arrendador.razonSocial ? 'moral legalmente constituida' : 'física'} de nacionalidad ${v(arrendador.nacionalidad ?? 'mexicana')}, con plena capacidad jurídica para obligarse en los términos del presente contrato.`,
          `b) Estar inscrito en el Registro Federal de Contribuyentes con la clave ${v(arrendador.rfc)}${arrendador.curp ? `, y contar con la Clave Única de Registro de Población ${arrendador.curp}` : ''}.`,
          `c) Ser legítimo propietario o poseedor, con facultades suficientes de disposición, del inmueble donde se ubica EL ESPACIO materia de este contrato, y que dicho inmueble se encuentra libre de gravamen que impida el arrendamiento.`,
          `d) Señalar como su domicilio el ubicado en ${v(arrendador.direccion)}.`,
          `e) Que es su voluntad celebrar el presente contrato en los términos aquí pactados.`,
        ],
      },
      {
        encabezado: `II. Declara ${ATA}:`,
        incisos: [
          `a) Ser una sociedad mercantil legalmente constituida conforme a las leyes de los Estados Unidos Mexicanos, según consta en ${v(arrendatario.datosConstitucion)}.`,
          `b) Que su representante, ${v(arrendatario.representanteLegal)}, cuenta con las facultades suficientes para obligarla en los términos de este contrato, las cuales no le han sido revocadas ni limitadas en forma alguna.`,
          `c) Estar inscrita en el Registro Federal de Contribuyentes con la clave ${v(arrendatario.rfc)}.`,
          `d) Que dentro de su objeto social se encuentra la explotación de publicidad exterior, y que requiere EL ESPACIO para ${uso}.`,
          `e) Señalar como su domicilio el ubicado en ${v(arrendatario.domicilioFiscal)}.`,
        ],
      },
      {
        encabezado: 'III. Declaran AMBAS PARTES:',
        incisos: [
          `a) Que se reconocen mutuamente la personalidad con la que comparecen.`,
          `b) Que en la celebración del presente contrato no existe error, dolo, mala fe, violencia, lesión ni vicio alguno del consentimiento que pudiera invalidarlo.`,
          `c) Que es su voluntad obligarse en los términos de las siguientes:`,
        ],
      },
    ],
    clausulas,
    lugarYFecha:
      `Leído que fue el presente contrato y enteradas las partes de su contenido y alcance legal, lo ` +
      `firman por duplicado en ${ciudad}, el ${fechaEnLetra(fechaFirma)}.`,
    firmas: [
      { rol: ARR, nombre: v(arrendador.razonSocial ?? arrendador.nombre), parte: 'ARRENDADOR' },
      {
        rol: ATA,
        nombre: arrendatario.representanteLegal
          ? `${v(arrendatario.razonSocial)}\nP.p. ${arrendatario.representanteLegal}`
          : v(arrendatario.razonSocial),
        parte: 'ARRENDATARIO',
      },
    ],
    faltantes,
    idioma: 'es',
  }
}

// ─── ADR 0048 · cotejar un contrato YA CONGELADO ───────────────────────────
//
// El hash con el que se compara lo firmado tiene que salir del MISMO texto que
// se firmó. Hasta el 02/11 la letra decía «PESOS … M.N.» para cualquier moneda,
// así que un contrato en USD congelado entonces tiene sellado ESE texto; con la
// letra nueva su hash ya no coincidiría y sus firmas aparecerían alteradas sin
// que nadie tocara nada (`firmas-repo.ts`, `firmasDeContrato`).
//
// Por qué por CONTENIDO y no por una fecha de corte: no hay forma de saber en
// el código cuándo llegó esta versión a cada instancia. Se regenera con la
// regla de hoy; si no coincide, con la anterior; y solo si ESA coincide se
// devuelve su hash. No ciega la detección: un dato tocado cambia los dos textos
// y ninguno coincide. Y no puede «perdonar» un contrato congelado con la regla
// nueva, porque la anterior nunca produce su texto (difieren en la letra).
//
// `hash` se inyecta para que este archivo, que también usa el navegador, no
// arrastre `node:crypto`.
export function hashParaCotejar(
  args: Parameters<typeof generarContrato>[0],
  hashGuardado: string | null,
  hash: (texto: string) => string,
): string {
  const hoy = hash(documentoATexto(generarContrato({ ...args, letra: 'en-su-moneda' })))
  if (!hashGuardado || hoy === hashGuardado) return hoy
  // ADR 0049 · la regla vieja de la letra solo existió en español: ningún
  // contrato en inglés o italiano se congeló con ella. Probarla ahí solo
  // abriría un segundo texto aceptable sin ningún motivo.
  if ((args.idioma ?? 'es') !== 'es') return hoy
  const antes = hash(documentoATexto(generarContrato({ ...args, letra: 'pesos-siempre' })))
  return antes === hashGuardado ? antes : hoy
}

// ════════════════════════════════════════════════════════════════════════════
//  ADR 0049 · EL CONTRATO EN INGLÉS Y EN ITALIANO
// ────────────────────────────────────────────────────────────────────────────
//  Traducción fiel del español de arriba, cláusula por cláusula y párrafo por
//  párrafo (la prueba compara el número de cláusulas, incisos y párrafos).
//
//  ⚠ REQUIERE REVISIÓN DE UN ABOGADO ANTES DE USARSE CON CLIENTES. Es el MISMO
//  contrato de derecho mexicano —RFC, CURP, CFDI, Código Civil, tribunales de
//  la ciudad— escrito en otro idioma; no es un contrato adaptado a la ley de
//  otro país. Lo que diga el abogado se cambia AQUÍ, y como el idioma de una
//  instancia no cambia nunca, solo afecta a lo que se congele después. PERO lo
//  ya congelado se coteja regenerando ESTE texto: en una instancia que ya
//  firmó contratos en/it, cambiarlo los haría aparecer «alterados». Antes de
//  tocarlo ahí hay que hacer lo mismo que el ADR 0048 hizo con la letra:
//  conservar la redacción anterior para cotejar (`hashParaCotejar`).
// ════════════════════════════════════════════════════════════════════════════

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

// ─── Lo que la página imprime alrededor del texto, por idioma ───────────────
// Los dos encabezados entran en `documentoATexto` (se sellan); el resto
// —sello de firma y aviso del pie— solo se imprime. Todo en una tabla para que
// la página y el texto sellado no puedan decir cosas distintas. El español son
// los literales de siempre.
export interface EncabezadosDocumento {
  declaraciones: string
  clausulas: string
  selloFirmado: string
  selloInvalidada: string
  aviso: string
}

const ENCABEZADOS: Record<Idioma, EncabezadosDocumento> = {
  es: {
    declaraciones: 'DECLARACIONES',
    clausulas: 'CLÁUSULAS',
    selloFirmado: 'FIRMADO ELECTRÓNICAMENTE',
    selloInvalidada: 'FIRMA INVALIDADA',
    aviso:
      'Documento generado automáticamente por SPACE OS a partir del expediente del contrato. ' +
      'Es un BORRADOR basado en cláusulas de uso común; debe ser revisado y validado por un ' +
      'abogado antes de su firma.',
  },
  en: {
    declaraciones: 'RECITALS',
    clausulas: 'CLAUSES',
    selloFirmado: 'ELECTRONICALLY SIGNED',
    selloInvalidada: 'SIGNATURE INVALIDATED',
    aviso:
      'Document automatically generated by SPACE OS from the contract file. It is a DRAFT based ' +
      'on commonly used clauses; it must be reviewed and validated by a lawyer before signing.',
  },
  it: {
    declaraciones: 'PREMESSE',
    clausulas: 'CLAUSOLE',
    selloFirmado: 'FIRMATO ELETTRONICAMENTE',
    selloInvalidada: 'FIRMA INVALIDATA',
    aviso:
      'Documento generato automaticamente da SPACE OS a partire dal fascicolo del contratto. È una ' +
      'BOZZA basata su clausole di uso comune; deve essere rivista e convalidata da un avvocato ' +
      'prima della firma.',
  },
}

export function encabezadosDocumento(idioma: Idioma): EncabezadosDocumento {
  return ENCABEZADOS[idioma] ?? ENCABEZADOS.es
}

// ─── Número a letras: INGLÉS ────────────────────────────────────────────────
// Estilo estadounidense de cheques y contratos: sin «AND» («ONE HUNDRED ONE»),
// con guion de 21 a 99 («TWENTY-ONE»).
const EN_UNIDADES = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN']
const EN_DECENAS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']

function centenasIngles(n: number): string {
  const c = Math.floor(n / 100)
  const resto = n % 100
  const partes: string[] = []
  if (c) partes.push(`${EN_UNIDADES[c]} HUNDRED`)
  if (resto) {
    if (resto < 20) partes.push(EN_UNIDADES[resto])
    else {
      const d = EN_DECENAS[Math.floor(resto / 10)]
      const u = resto % 10
      partes.push(u ? `${d}-${EN_UNIDADES[u]}` : d)
    }
  }
  return partes.join(' ')
}

const EN_MONEDA: Record<string, { uno: string; varios: string; cierre: string }> = {
  MXN: { uno: 'PESO', varios: 'PESOS', cierre: 'MXN' },
  USD: { uno: 'DOLLAR', varios: 'DOLLARS', cierre: 'USD' },
}

function letrasIngles(monto: number, moneda: string): string {
  const m = EN_MONEDA[moneda] ?? EN_MONEDA.MXN
  const entero = Math.floor(Math.abs(monto))
  const cent = String(Math.round((Math.abs(monto) - entero) * 100)).padStart(2, '0')
  let palabras = 'ZERO'
  if (entero > 0) {
    const millones = Math.floor(entero / 1_000_000)
    const miles = Math.floor((entero % 1_000_000) / 1000)
    const resto = entero % 1000
    const partes: string[] = []
    if (millones) partes.push(`${centenasIngles(millones)} MILLION`)
    if (miles) partes.push(`${centenasIngles(miles)} THOUSAND`)
    if (resto) partes.push(centenasIngles(resto))
    palabras = partes.join(' ')
  }
  return `${palabras} ${entero === 1 ? m.uno : m.varios} ${cent}/100 ${m.cierre}`
}

// ─── Número a letras: ITALIANO ──────────────────────────────────────────────
// Reglas que hay que acertar:
//  · Hasta 999 999 se escribe en UNA palabra: «MILLEDUECENTOTRENTAQUATTRO».
//  · La decena pierde la vocal ante UNO y OTTO: «VENTUNO», «TRENTOTTO»; y
//    «CENTO» ante OTTO/OTTANTA: «CENTOTTANTA».
//  · Acaba en -TRÉ con acento si es compuesto: «VENTITRÉ», «MILLETRÉ»; pero no
//    dentro de la palabra: «VENTITREMILA».
//  · «UNO» se apocopa ante MILA y MILIONI: «VENTUNMILA», «VENTUN MILIONI».
//  · 1 000 es «MILLE», 1 000 000 «UN MILIONE»; los millones van en palabra
//    aparte: «UN MILIONE DUECENTOCINQUANTAMILA…».
//  · Con un solo peso: «UN PESO», igual que el español apocopa «UN PESO».
const IT_UNIDADES = ['ZERO', 'UNO', 'DUE', 'TRE', 'QUATTRO', 'CINQUE', 'SEI', 'SETTE', 'OTTO', 'NOVE',
  'DIECI', 'UNDICI', 'DODICI', 'TREDICI', 'QUATTORDICI', 'QUINDICI', 'SEDICI', 'DICIASSETTE', 'DICIOTTO', 'DICIANNOVE']
const IT_DECENAS = ['', '', 'VENTI', 'TRENTA', 'QUARANTA', 'CINQUANTA', 'SESSANTA', 'SETTANTA', 'OTTANTA', 'NOVANTA']

// 1–999 en una palabra, SIN el acento final (lo pone quien sabe si es final).
function centenasItaliano(n: number): string {
  const c = Math.floor(n / 100)
  const resto = n % 100
  let decenas = ''
  if (resto < 20) decenas = resto ? IT_UNIDADES[resto] : ''
  else {
    const d = IT_DECENAS[Math.floor(resto / 10)]
    const u = resto % 10
    decenas = u === 0 ? d : (u === 1 || u === 8 ? d.slice(0, -1) : d) + IT_UNIDADES[u]
  }
  if (!c) return decenas
  const cento = c === 1 ? 'CENTO' : `${IT_UNIDADES[c]}CENTO`
  return (decenas.startsWith('OTT') ? cento.slice(0, -1) : cento) + decenas
}

const acentoFinal = (s: string) => (s.length > 3 && s.endsWith('TRE') ? `${s.slice(0, -3)}TRÉ` : s)
const apocopeUno = (s: string) => (s.endsWith('UNO') ? s.slice(0, -1) : s)

const IT_MONEDA: Record<string, { uno: string; varios: string; cierre: string }> = {
  MXN: { uno: 'PESO', varios: 'PESOS', cierre: 'MXN' },
  USD: { uno: 'DOLLARO', varios: 'DOLLARI', cierre: 'USD' },
}

function letrasItaliano(monto: number, moneda: string): string {
  const m = IT_MONEDA[moneda] ?? IT_MONEDA.MXN
  const entero = Math.floor(Math.abs(monto))
  const cent = String(Math.round((Math.abs(monto) - entero) * 100)).padStart(2, '0')
  let palabras = 'ZERO'
  if (entero === 1) palabras = 'UN'
  else if (entero > 0) {
    const millones = Math.floor(entero / 1_000_000)
    const miles = Math.floor((entero % 1_000_000) / 1000)
    const resto = entero % 1000
    const partes: string[] = []
    if (millones === 1) partes.push('UN MILIONE')
    else if (millones > 1) partes.push(`${acentoFinal(apocopeUno(centenasItaliano(millones)))} MILIONI`)
    let palabra = ''
    if (miles === 1) palabra = 'MILLE'
    else if (miles > 1) palabra = `${apocopeUno(centenasItaliano(miles))}MILA`
    if (resto) palabra += centenasItaliano(resto)
    if (palabra) partes.push(acentoFinal(palabra))
    palabras = partes.join(' ')
  }
  return `${palabras} ${entero === 1 ? m.uno : m.varios} ${cent}/100 ${m.cierre}`
}

// ─── La redacción en inglés e italiano ──────────────────────────────────────
const ORDINALES_EN = [
  'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH',
  'ELEVENTH', 'TWELFTH', 'THIRTEENTH', 'FOURTEENTH', 'FIFTEENTH', 'SIXTEENTH', 'SEVENTEENTH',
  'EIGHTEENTH', 'NINETEENTH', 'TWENTIETH',
]
// «Clausola» es femenino, como «cláusula».
const ORDINALES_IT = [
  'PRIMA', 'SECONDA', 'TERZA', 'QUARTA', 'QUINTA', 'SESTA', 'SETTIMA', 'OTTAVA', 'NONA', 'DECIMA',
  'UNDICESIMA', 'DODICESIMA', 'TREDICESIMA', 'QUATTORDICESIMA', 'QUINDICESIMA', 'SEDICESIMA',
  'DICIASSETTESIMA', 'DICIOTTESIMA', 'DICIANNOVESIMA', 'VENTESIMA',
]

const CADA_EN: Record<Periodicidad, string> = {
  SEMANAL: 'every week', CATORCENAL: 'every fourteen days', QUINCENAL: 'every fortnight', MENSUAL: 'every month',
  BIMESTRAL: 'every two months', TRIMESTRAL: 'every three months', SEMESTRAL: 'every six months', ANUAL: 'every year',
}
const CADA_IT: Record<Periodicidad, string> = {
  SEMANAL: 'ogni settimana', CATORCENAL: 'ogni quattordici giorni', QUINCENAL: 'ogni quindicina', MENSUAL: 'ogni mese',
  BIMESTRAL: 'ogni due mesi', TRIMESTRAL: 'ogni tre mesi', SEMESTRAL: 'ogni sei mesi', ANUAL: 'ogni anno',
}

// Cifras escritas a mano: el texto se sella, y no puede depender de la versión
// de ICU del servidor (ni de que `it-IT` agrupe o no las cifras de 4 dígitos).
function cifra(n: number, decimales: number | null, idioma: 'en' | 'it'): string {
  const [ent, dec] = (decimales == null ? String(n) : n.toFixed(decimales)).split('.')
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, idioma === 'en' ? ',' : '.')
  return dec ? `${miles}${idioma === 'en' ? '.' : ','}${dec}` : miles
}

function redactarEnOtroIdioma(
  idioma: 'en' | 'it',
  args: Parameters<typeof generarContrato>[0],
): Omit<DocumentoContrato, 'faltantes' | 'idioma'> {
  const { arrendatario, arrendador, espacio, terminos, fechaFirma } = args
  const en = idioma === 'en'
  const fecha = (iso: string | null) => fechaEnLetra(iso, idioma)
  const importe = (n: number | null): string => {
    if (n == null) return FALTA
    const c = cifra(n, 2, idioma)
    return `${en ? `$${c}` : c} ${terminos.moneda} (${numeroALetras(n, terminos.moneda, idioma)})`
  }
  const ciudad = v(terminos.ciudadFirma ?? espacio.ciudad)
  const medidas =
    espacio.ancho && espacio.alto
      ? en
        ? `${espacio.ancho} m wide by ${espacio.alto} m high (${(espacio.ancho * espacio.alto).toFixed(2)} m²)`
        : `${cifra(espacio.ancho, null, 'it')} m di larghezza per ${cifra(espacio.alto, null, 'it')} m di altezza ` +
          `(${cifra(espacio.ancho * espacio.alto, 2, 'it')} m²)`
      : FALTA
  const cada = terminos.periodicidad ? (en ? CADA_EN : CADA_IT)[terminos.periodicidad] : FALTA
  const uso = v(
    terminos.usoPermitido ??
      (en
        ? 'the installation, operation and commercial exploitation of an advertising structure'
        : "l'installazione, la gestione e lo sfruttamento commerciale di una struttura pubblicitaria"),
  )
  const moral = Boolean(arrendador.razonSocial)
  const nombreArr = v(arrendador.razonSocial ?? arrendador.nombre)
  const ordinales = en ? ORDINALES_EN : ORDINALES_IT
  const clausulas: Clausula[] = []
  const add = (titulo: string, parrafos: string[]) =>
    clausulas.push({ ordinal: ordinales[clausulas.length] ?? `${clausulas.length + 1}.`, titulo, parrafos })
  const pct = terminos.incrementoAnualPct

  if (en) {
    const ARR = 'THE LESSOR'
    const ATA = 'THE LESSEE'
    const descripcion =
      `${v(espacio.nombre)}${espacio.codigo ? ` (code ${espacio.codigo})` : ''}, ` +
      `located at ${v(espacio.direccion)}${espacio.predio ? `, within the property known as “${espacio.predio}”` : ''}`

    add('PURPOSE', [
      `${ARR} grants in lease to ${ATA}, and the latter receives it to its entire satisfaction, ` +
        `the space identified as ${descripcion}, with a usable surface of ${medidas} ` +
        `(hereinafter, “THE SPACE”).`,
      `${ATA} shall use THE SPACE exclusively for ${uso}. Any other use requires the prior written ` +
        `authorization of ${ARR}.`,
    ])
    add('TERM', [
      `This agreement shall be in force from ${fecha(terminos.fechaInicio)} to ${fecha(terminos.fechaFin)}, ` +
        `a term that both parties acknowledge as mandatory.`,
      terminos.autoRenovable
        ? `Upon expiration of the term, the agreement shall be automatically extended for equal periods, unless ` +
          `either party notifies the other in writing of its intention not to renew it, at least thirty (30) ` +
          `calendar days prior to its expiration.`
        : `The agreement does NOT renew automatically. Its continuation requires a new written agreement ` +
          `between the parties.`,
    ])
    const renta = [
      `${ATA} shall pay ${ARR} the amount of ${importe(terminos.montoRenta)} ${cada}, as rent for THE SPACE.`,
      `Payment shall be made ${terminos.diaPago ? `within the first ${terminos.diaPago} calendar days of each period` : 'within the first five (5) calendar days of each period'}, ` +
        `by electronic transfer to the account that ${ARR} designates in writing. ${ARR} undertakes to ` +
        `deliver the corresponding Digital Tax Receipt (CFDI) as a condition prior to payment.`,
    ]
    if (pct != null) {
      renta.push(
        `The rent shall increase annually by ${pct}% over the amount in force at the time of the adjustment, ` +
          `on the anniversary date of the commencement of the term.`,
      )
    }
    if (terminos.deposito != null && terminos.deposito > 0) {
      renta.push(
        `Upon execution of this agreement, ${ATA} delivers to ${ARR} the amount of ${importe(terminos.deposito)} ` +
          `as a security deposit, which shall be returned within thirty (30) calendar days following the ` +
          `termination of the agreement, after verification of the condition of THE SPACE.`,
      )
    }
    add('RENT AND PAYMENT TERMS', renta)
    add('OBLIGATIONS OF THE LESSEE', [
      `a) To pay the rent under the agreed terms.`,
      `b) To obtain and keep in force, at its own cost and expense, the licenses, permits and authorizations ` +
        `required by the competent authority for the installation and operation of the advertising structure.`,
      `c) To keep the structure in adequate conditions of safety and maintenance, and to be liable for any ` +
        `damage that its installation, operation or removal causes to THE SPACE or to third parties.`,
      `d) To take out and keep in force a civil liability insurance policy covering damage to third parties ` +
        `arising from the structure.`,
      `e) To pay for the electric power consumed by the structure, through an independent meter whenever ` +
        `technically possible.`,
      `f) To remove the structure and return THE SPACE in the condition in which it was received, except for ` +
        `normal wear and tear, within fifteen (15) calendar days following termination.`,
    ])
    add('OBLIGATIONS OF THE LESSOR', [
      `a) To guarantee ${ATA} the peaceful use of THE SPACE throughout the term.`,
      `b) To allow access to the personnel of ${ATA} for the installation, change of artwork, maintenance ` +
        `and removal of the structure, at reasonable hours and with prior notice.`,
      `c) To refrain from installing, or authorizing third parties to install, advertising that obstructs the ` +
        `visibility of the structure of ${ATA}.`,
      `d) To deliver the corresponding CFDI for each rent payment.`,
      `e) To keep current the taxes and contributions levied on the property.`,
    ])
    add('OWNERSHIP OF THE STRUCTURE', [
      `The advertising structure, its anchors, lighting systems, electronic equipment and any element ` +
        `installed by ${ATA} are the exclusive property of the latter, are not considered accessories of the ` +
        `property, and may be freely removed upon termination of the agreement.`,
    ])
    add('PERMITS AND AUTHORIZATIONS', [
      `Obtaining the permits is the responsibility of ${ATA}. If the competent authority denies, revokes or ` +
        `does not renew the permit required to operate the structure for reasons not attributable to ${ATA}, ` +
        `either party may terminate the agreement without any liability, by written notice, ${ATA} being ` +
        `obliged only to pay the rent accrued up to that date.`,
    ])
    add('ASSIGNMENT', [
      `Neither party may assign the rights and obligations arising from this agreement without the prior ` +
        `written consent of the other. Assignment by ${ATA} to companies of its same group is excepted, ` +
        `written notice being sufficient.`,
    ])
    add('RESCISSION', [
      `The following shall be grounds for rescission, without the need for a prior judicial declaration:`,
      `a) Failure to pay two (2) consecutive rent periods.`,
      `b) Use of THE SPACE for a purpose other than the one agreed.`,
      `c) Breach of any of the agreed obligations, if not cured within fifteen (15) calendar days following ` +
        `the written demand.`,
      `The rescinding party shall give written notice thereof, effective upon receipt.`,
    ])
    add('ACTS OF GOD OR FORCE MAJEURE', [
      `Neither party shall be liable for non-performance arising from acts of God or force majeure. If the ` +
        `event prevents the use of THE SPACE for more than sixty (60) calendar days, either party may ` +
        `terminate the agreement without liability.`,
    ])
    add('ADDRESSES AND NOTICES', [
      `For all purposes of this agreement, the parties designate the following addresses:`,
      `${ARR}: ${v(arrendador.direccion)}.`,
      `${ATA}: ${v(arrendatario.domicilioFiscal)}.`,
      `All notices shall be in writing and delivered with acknowledgment of receipt at the designated ` +
        `addresses. Any change shall be notified ten (10) calendar days in advance; otherwise, notices shall ` +
        `take effect at the last known address.`,
    ])
    add('GOVERNING LAW AND JURISDICTION', [
      `This agreement is governed by the Civil Code applicable in ${ciudad} and other related provisions. ` +
        `For the interpretation and performance hereof, the parties expressly submit to the jurisdiction of ` +
        `the competent courts of ${ciudad}, waiving any other jurisdiction that may correspond to them by ` +
        `reason of their present or future domiciles.`,
    ])

    return {
      titulo: 'ADVERTISING SPACE LEASE AGREEMENT',
      preambulo:
        `Advertising space lease agreement entered into by and between, on the one part, ${nombreArr}, ` +
        `hereinafter referred to as “${ARR}”; and, on the other part, ${v(arrendatario.razonSocial)}, ` +
        `represented herein by ${v(arrendatario.representanteLegal)}, hereinafter referred to as “${ATA}”; ` +
        `pursuant to the following recitals and clauses:`,
      declaraciones: [
        {
          encabezado: `I. ${ARR} declares:`,
          incisos: [
            `a) That it is a ${moral ? 'legal entity duly incorporated' : 'natural person'} of ${v(arrendador.nacionalidad ?? 'Mexican')} nationality, with full legal capacity to be bound under the terms of this agreement.`,
            `b) That it is registered with the Federal Taxpayer Registry (RFC) under tax ID ${v(arrendador.rfc)}${arrendador.curp ? `, and holds the Unique Population Registry Code (CURP) ${arrendador.curp}` : ''}.`,
            `c) That it is the lawful owner or possessor, with sufficient powers of disposition, of the property where THE SPACE subject to this agreement is located, and that said property is free of any encumbrance that would prevent its lease.`,
            `d) That it designates as its address the one located at ${v(arrendador.direccion)}.`,
            `e) That it is its will to enter into this agreement under the terms agreed herein.`,
          ],
        },
        {
          encabezado: `II. ${ATA} declares:`,
          incisos: [
            `a) That it is a commercial company duly incorporated under the laws of the United Mexican States, as evidenced by ${v(arrendatario.datosConstitucion)}.`,
            `b) That its representative, ${v(arrendatario.representanteLegal)}, has sufficient powers to bind it under the terms of this agreement, which have not been revoked or limited in any way.`,
            `c) That it is registered with the Federal Taxpayer Registry (RFC) under tax ID ${v(arrendatario.rfc)}.`,
            `d) That its corporate purpose includes the operation of outdoor advertising, and that it requires THE SPACE for ${uso}.`,
            `e) That it designates as its address the one located at ${v(arrendatario.domicilioFiscal)}.`,
          ],
        },
        {
          encabezado: 'III. BOTH PARTIES declare:',
          incisos: [
            `a) That they mutually acknowledge the capacity in which they appear.`,
            `b) That in entering into this agreement there is no error, fraud, bad faith, duress, lesion or any other defect of consent that could invalidate it.`,
            `c) That it is their will to be bound under the terms of the following:`,
          ],
        },
      ],
      clausulas,
      lugarYFecha:
        `Having read this agreement, and the parties being aware of its content and legal scope, they sign it ` +
        `in duplicate in ${ciudad}, on ${fecha(fechaFirma)}.`,
      firmas: [
        { rol: ARR, nombre: nombreArr, parte: 'ARRENDADOR' },
        {
          rol: ATA,
          nombre: arrendatario.representanteLegal
            ? `${v(arrendatario.razonSocial)}\nBy: ${arrendatario.representanteLegal}`
            : v(arrendatario.razonSocial),
          parte: 'ARRENDATARIO',
        },
      ],
    }
  }

  // ─── Italiano ─────────────────────────────────────────────────────────────
  // Las partes NO se interpolan como en español: el italiano contrae artículo
  // y preposición («al CONDUTTORE», «dello SPAZIO»), y «a IL CONDUTTORE»
  // sería un error en un contrato. Por eso cada frase las escribe en su forma.
  const descripcion =
    `${v(espacio.nombre)}${espacio.codigo ? ` (codice ${espacio.codigo})` : ''}, ` +
    `situato in ${v(espacio.direccion)}${espacio.predio ? `, all'interno del fondo denominato «${espacio.predio}»` : ''}`

  add('OGGETTO', [
    `IL LOCATORE concede in locazione al CONDUTTORE, che lo riceve di sua piena soddisfazione, ` +
      `lo spazio identificato come ${descripcion}, con una superficie utile di ${medidas} ` +
      `(di seguito, «LO SPAZIO»).`,
    `IL CONDUTTORE destinerà LO SPAZIO esclusivamente a ${uso}. Qualsiasi uso diverso richiede ` +
      `l'autorizzazione preventiva e scritta del LOCATORE.`,
  ])
  add('DURATA', [
    `Il presente contratto avrà validità dal ${fecha(terminos.fechaInicio)} al ${fecha(terminos.fechaFin)}, ` +
      `termine che entrambe le parti riconoscono come vincolante.`,
    terminos.autoRenovable
      ? `Alla scadenza, il contratto si rinnoverà automaticamente per periodi di uguale durata, salvo che una ` +
        `delle parti comunichi all'altra la propria volontà di non rinnovarlo, per iscritto e con almeno trenta ` +
        `(30) giorni di calendario di preavviso rispetto alla scadenza.`
      : `Il contratto NON si rinnova automaticamente. La sua prosecuzione richiede un nuovo accordo scritto ` +
        `tra le parti.`,
  ])
  const canone = [
    `IL CONDUTTORE pagherà al LOCATORE l'importo di ${importe(terminos.montoRenta)} ${cada}, a titolo di ` +
      `canone di locazione dello SPAZIO.`,
    `Il pagamento sarà effettuato ${terminos.diaPago ? `entro i primi ${terminos.diaPago} giorni di calendario di ciascun periodo` : 'entro i primi cinque (5) giorni di calendario di ciascun periodo'}, ` +
      `mediante bonifico elettronico sul conto che IL LOCATORE indicherà per iscritto. IL LOCATORE si obbliga ` +
      `a consegnare la corrispondente Ricevuta Fiscale Digitale via Internet (CFDI) come requisito preliminare ` +
      `al pagamento.`,
  ]
  if (pct != null) {
    canone.push(
      `Il canone sarà aumentato annualmente di una percentuale pari a ${cifra(pct, null, 'it')}% sull'importo vigente al momento ` +
        `dell'adeguamento, alla data di anniversario dell'inizio della validità.`,
    )
  }
  if (terminos.deposito != null && terminos.deposito > 0) {
    canone.push(
      `Alla firma del presente contratto, IL CONDUTTORE consegna al LOCATORE l'importo di ` +
        `${importe(terminos.deposito)} a titolo di deposito cauzionale, che sarà restituito entro i trenta (30) ` +
        `giorni di calendario successivi alla cessazione del contratto, previa verifica dello stato dello SPAZIO.`,
    )
  }
  add('CANONE E MODALITÀ DI PAGAMENTO', canone)
  add('OBBLIGHI DEL CONDUTTORE', [
    `a) Pagare il canone nei termini pattuiti.`,
    `b) Ottenere e mantenere in vigore, a proprie spese, le licenze, i permessi e le autorizzazioni richiesti ` +
      `dall'autorità competente per l'installazione e la gestione della struttura pubblicitaria.`,
    `c) Mantenere la struttura in condizioni adeguate di sicurezza e conservazione, e rispondere dei danni che ` +
      `la sua installazione, gestione o rimozione causino allo SPAZIO o a terzi.`,
    `d) Stipulare e mantenere in vigore una polizza assicurativa di responsabilità civile che copra i danni a ` +
      `terzi derivanti dalla struttura.`,
    `e) Sostenere il consumo di energia elettrica richiesto dalla struttura, mediante contatore indipendente ` +
      `quando ciò sia tecnicamente possibile.`,
    `f) Rimuovere la struttura e restituire LO SPAZIO nelle condizioni in cui lo ha ricevuto, salvo il normale ` +
      `deterioramento d'uso, entro i quindici (15) giorni di calendario successivi alla cessazione.`,
  ])
  add('OBBLIGHI DEL LOCATORE', [
    `a) Garantire al CONDUTTORE il pacifico godimento dello SPAZIO per tutta la durata.`,
    `b) Consentire l'accesso al personale del CONDUTTORE per l'installazione, il cambio di immagine, la ` +
      `manutenzione e la rimozione della struttura, in orari ragionevoli e previo avviso.`,
    `c) Astenersi dall'installare o dall'autorizzare terzi a installare pubblicità che ostruisca la visibilità ` +
      `della struttura del CONDUTTORE.`,
    `d) Consegnare il CFDI corrispondente a ciascun pagamento del canone.`,
    `e) Mantenere in regola le imposte e i contributi che gravano sull'immobile.`,
  ])
  add('PROPRIETÀ DELLA STRUTTURA', [
    `La struttura pubblicitaria, i suoi ancoraggi, i sistemi di illuminazione, le apparecchiature elettroniche ` +
      `e qualsiasi elemento installato dal CONDUTTORE sono di sua esclusiva proprietà, non sono considerati ` +
      `accessori dell'immobile e potranno essere rimossi liberamente alla cessazione del contratto.`,
  ])
  add('PERMESSI E AUTORIZZAZIONI', [
    `L'ottenimento dei permessi è responsabilità del CONDUTTORE. Se l'autorità competente nega, revoca o non ` +
      `rinnova il permesso necessario per gestire la struttura per causa non imputabile al CONDUTTORE, ciascuna ` +
      `delle parti potrà risolvere il contratto senza alcuna responsabilità, mediante comunicazione scritta, ` +
      `restando IL CONDUTTORE obbligato unicamente al pagamento del canone maturato fino a tale data.`,
  ])
  add('CESSIONE', [
    `Nessuna delle parti potrà cedere i diritti e gli obblighi derivanti dal presente contratto senza il previo ` +
      `consenso scritto dell'altra. È eccettuata la cessione che IL CONDUTTORE effettui a favore di società del ` +
      `suo stesso gruppo, essendo sufficiente una comunicazione scritta.`,
  ])
  add('RISOLUZIONE', [
    `Costituiscono causa di risoluzione, senza necessità di previa dichiarazione giudiziale:`,
    `a) Il mancato pagamento di due (2) periodi consecutivi di canone.`,
    `b) L'uso dello SPAZIO per un fine diverso da quello pattuito.`,
    `c) L'inadempimento di uno qualsiasi degli obblighi pattuiti, se non sanato entro i quindici (15) giorni ` +
      `di calendario successivi alla diffida scritta.`,
    `La parte che risolve il contratto dovrà notificarlo per iscritto, con effetto dal momento della ricezione.`,
  ])
  add('CASO FORTUITO O FORZA MAGGIORE', [
    `Nessuna delle parti sarà responsabile dell'inadempimento derivante da caso fortuito o forza maggiore. Se ` +
      `l'evento impedisce l'uso dello SPAZIO per più di sessanta (60) giorni di calendario, ciascuna delle parti ` +
      `potrà risolvere il contratto senza responsabilità.`,
  ])
  add('DOMICILI E COMUNICAZIONI', [
    `Per tutti gli effetti del presente contratto, le parti eleggono i seguenti domicili:`,
    `IL LOCATORE: ${v(arrendador.direccion)}.`,
    `IL CONDUTTORE: ${v(arrendatario.domicilioFiscal)}.`,
    `Ogni comunicazione dovrà essere effettuata per iscritto e consegnata con ricevuta di ritorno ai domicili ` +
      `indicati. Qualsiasi variazione dovrà essere notificata con dieci (10) giorni di calendario di anticipo; ` +
      `in caso contrario, le comunicazioni avranno effetto all'ultimo domicilio conosciuto.`,
  ])
  add('LEGGE APPLICABILE E FORO COMPETENTE', [
    `Il presente contratto è regolato dal Codice Civile applicabile in ${ciudad} e dalle altre disposizioni ` +
      `pertinenti. Per l'interpretazione e l'esecuzione dello stesso, le parti si sottomettono espressamente ` +
      `alla giurisdizione dei tribunali competenti di ${ciudad}, rinunciando a qualsiasi altro foro che potesse ` +
      `loro spettare in ragione dei loro domicili presenti o futuri.`,
  ])

  return {
    titulo: 'CONTRATTO DI LOCAZIONE DI SPAZIO PUBBLICITARIO',
    preambulo:
      `Contratto di locazione di spazio pubblicitario stipulato tra ${nombreArr}, di seguito denominato ` +
      `«IL LOCATORE», da una parte; e ${v(arrendatario.razonSocial)}, rappresentata in questo atto da ` +
      `${v(arrendatario.representanteLegal)}, di seguito denominata «IL CONDUTTORE», dall'altra parte; ` +
      `secondo le seguenti premesse e clausole:`,
    declaraciones: [
      {
        encabezado: 'I. Dichiara IL LOCATORE:',
        incisos: [
          `a) Di essere persona ${moral ? 'giuridica regolarmente costituita' : 'fisica'} di nazionalità ${v(arrendador.nacionalidad ?? 'messicana')}, con piena capacità giuridica di obbligarsi ai sensi del presente contratto.`,
          `b) Di essere iscritto al Registro Federale dei Contribuenti (RFC) con il codice ${v(arrendador.rfc)}${arrendador.curp ? `, e di essere titolare del Codice Unico di Registrazione della Popolazione (CURP) ${arrendador.curp}` : ''}.`,
          `c) Di essere legittimo proprietario o possessore, con sufficienti facoltà di disposizione, dell'immobile in cui si trova LO SPAZIO oggetto del presente contratto, e che detto immobile è libero da gravami che ne impediscano la locazione.`,
          `d) Di eleggere il proprio domicilio in ${v(arrendador.direccion)}.`,
          `e) Che è sua volontà stipulare il presente contratto alle condizioni qui pattuite.`,
        ],
      },
      {
        encabezado: 'II. Dichiara IL CONDUTTORE:',
        incisos: [
          `a) Di essere una società commerciale regolarmente costituita secondo le leggi degli Stati Uniti Messicani, come risulta da ${v(arrendatario.datosConstitucion)}.`,
          `b) Che il suo rappresentante, ${v(arrendatario.representanteLegal)}, dispone dei poteri sufficienti per obbligarla ai sensi del presente contratto, poteri che non gli sono stati revocati né limitati in alcun modo.`,
          `c) Di essere iscritta al Registro Federale dei Contribuenti (RFC) con il codice ${v(arrendatario.rfc)}.`,
          `d) Che il suo oggetto sociale comprende lo sfruttamento della pubblicità esterna, e che necessita dello SPAZIO per ${uso}.`,
          `e) Di eleggere il proprio domicilio in ${v(arrendatario.domicilioFiscal)}.`,
        ],
      },
      {
        encabezado: 'III. Dichiarano ENTRAMBE LE PARTI:',
        incisos: [
          `a) Di riconoscersi reciprocamente la qualità con cui intervengono.`,
          `b) Che nella stipulazione del presente contratto non sussiste errore, dolo, mala fede, violenza, lesione né alcun altro vizio del consenso che possa invalidarlo.`,
          `c) Che è loro volontà obbligarsi ai sensi delle seguenti:`,
        ],
      },
    ],
    clausulas,
    lugarYFecha:
      `Letto il presente contratto e rese edotte le parti del suo contenuto e della sua portata legale, lo ` +
      `sottoscrivono in duplice copia a ${ciudad}, il ${fecha(fechaFirma)}.`,
    firmas: [
      { rol: 'IL LOCATORE', nombre: nombreArr, parte: 'ARRENDADOR' },
      {
        rol: 'IL CONDUTTORE',
        nombre: arrendatario.representanteLegal
          ? `${v(arrendatario.razonSocial)}\nP.p. ${arrendatario.representanteLegal}`
          : v(arrendatario.razonSocial),
        parte: 'ARRENDATARIO',
      },
    ],
  }
}

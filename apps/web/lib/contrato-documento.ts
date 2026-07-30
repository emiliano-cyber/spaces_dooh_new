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
// ============================================================================

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
  firmas: { rol: string; nombre: string }[]
  // Datos que el expediente no tiene. El documento los deja marcados en vez de
  // inventarlos: un contrato con un dato falso es peor que uno con un hueco.
  faltantes: string[]
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

export function numeroALetras(monto: number): string {
  const entero = Math.floor(Math.abs(monto))
  const centavos = Math.round((Math.abs(monto) - entero) * 100)
  const cent = String(centavos).padStart(2, '0')
  if (entero === 0) return `CERO PESOS ${cent}/100 M.N.`

  const millones = Math.floor(entero / 1_000_000)
  const miles = Math.floor((entero % 1_000_000) / 1000)
  const resto = entero % 1000

  const partes: string[] = []
  if (millones === 1) partes.push('UN MILLÓN')
  else if (millones > 1) partes.push(`${apocopar(centenasALetras(millones))} MILLONES`)
  if (miles === 1) partes.push('MIL')
  else if (miles > 1) partes.push(`${apocopar(centenasALetras(miles))} MIL`)
  if (resto) partes.push(apocopar(centenasALetras(resto)))

  const plural = entero === 1 ? 'PESO' : 'PESOS'
  return `${partes.join(' ')} ${plural} ${cent}/100 M.N.`
}

// Serializa el documento a texto plano. Es LO QUE SE FIRMA: sobre esta cadena
// se calcula el SHA-256 que sella la versión firmada, así que su formato es
// parte del contrato de datos. Cambiarlo invalida todas las firmas existentes
// (los hashes dejarían de coincidir), igual que reimprimir el papel con otro
// texto. Es determinista a propósito: mismas entradas, misma cadena, mismo hash.
export function documentoATexto(doc: DocumentoContrato): string {
  const lineas: string[] = [doc.titulo, '', doc.preambulo, '', 'DECLARACIONES']
  for (const d of doc.declaraciones) {
    lineas.push('', d.encabezado, ...d.incisos)
  }
  lineas.push('', 'CLÁUSULAS')
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

export function fechaEnLetra(iso: string | null): string {
  if (!iso) return FALTA
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!a || !m || !d) return FALTA
  return `${d} de ${MESES[m - 1]} de ${a}`
}

function importe(n: number | null, moneda: string): string {
  if (n == null) return FALTA
  const cifra = n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `$${cifra} ${moneda} (${numeroALetras(n)})`
}

const v = (x: string | null | undefined): string => (x && String(x).trim() ? String(x).trim() : FALTA)

// ─── Redacción ──────────────────────────────────────────────────────────────
export function generarContrato(args: {
  arrendatario: DatosArrendatario
  arrendador: DatosArrendador
  espacio: DatosEspacio
  terminos: DatosTerminos
  fechaFirma: string | null
}): DocumentoContrato {
  const { arrendatario, arrendador, espacio, terminos, fechaFirma } = args
  const faltantes: string[] = []
  const exigir = (valor: string | number | null | undefined, etiqueta: string) => {
    if (valor == null || String(valor).trim() === '') faltantes.push(etiqueta)
  }

  exigir(arrendatario.razonSocial, 'Razón social de tu empresa')
  exigir(arrendatario.rfc, 'RFC de tu empresa')
  exigir(arrendatario.domicilioFiscal, 'Domicilio fiscal de tu empresa')
  exigir(arrendatario.representanteLegal, 'Representante legal de tu empresa')
  exigir(arrendador.nombre, 'Nombre del arrendador')
  exigir(arrendador.rfc, 'RFC del arrendador')
  exigir(arrendador.direccion, 'Domicilio del arrendador')
  exigir(espacio.direccion, 'Dirección del espacio')
  exigir(terminos.fechaInicio, 'Fecha de inicio')
  exigir(terminos.fechaFin, 'Fecha de fin')
  exigir(terminos.montoRenta, 'Importe de la renta')
  exigir(terminos.periodicidad, 'Periodicidad del pago')

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
    `${ATA} pagará a ${ARR} la cantidad de ${importe(terminos.montoRenta, terminos.moneda)} ` +
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
        `${importe(terminos.deposito, terminos.moneda)} por concepto de depósito en garantía, que será ` +
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
      { rol: ARR, nombre: v(arrendador.razonSocial ?? arrendador.nombre) },
      {
        rol: ATA,
        nombre: arrendatario.representanteLegal
          ? `${v(arrendatario.razonSocial)}\nP.p. ${arrendatario.representanteLegal}`
          : v(arrendatario.razonSocial),
      },
    ],
    faltantes,
  }
}

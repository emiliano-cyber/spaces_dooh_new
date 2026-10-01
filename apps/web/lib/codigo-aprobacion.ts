// ============================================================================
//  lib/codigo-aprobacion.ts — El cupón aplicado necesita APROBACIÓN.  COD-03.
//  Módulo PURO: sin `fetch`, sin React, sin BD. Hermano de
//  `codigo-promocional.ts`.
// ----------------------------------------------------------------------------
//  DECISIONES DEL DUEÑO (2026-09-30), textuales:
//
//   1. «En propuesta se debe de poder poner un cupón si fue rechazada para
//      volverla a activar» → canjear sobre una RECHAZADA la pasa a BORRADOR
//      (`estatusTrasCanje`), en la MISMA transacción del canje.
//   2. «Si está en borrador, asignar un cupón existente» → selector de los
//      vigentes (`vigentesParaSelector`), además de poder teclearlo.
//   3. «Si se asigna, no se muestra al cliente hasta que un admin o gerente lo
//      apruebe» → todo cupón nace PENDIENTE; deciden quienes tienen
//      `comercial.aprobar` (DUENO, ADMINISTRADOR, DIRECTOR_COMERCIAL,
//      GERENTE_VENTAS). El VENDEDOR aplica y no decide.
//   4. Opción B: con PENDIENTE el cliente ve la propuesta SIN el descuento y
//      puede aceptarla así (`filaParaCliente`).
//
//  REGLAS DERIVADAS (las propuso la sesión principal para que el dinero
//  cuadre; NO son palabras del dueño y se dejan marcadas como tales):
//
//   · Si el CLIENTE acepta con el cupón PENDIENTE, acepta el precio que vio:
//     el cupón se quita y su uso se devuelve dentro de la transacción de la
//     aceptación, antes de congelar el snapshot. Lo firmado nunca lleva un
//     descuento no aprobado.
//   · Aprobar la propuesta por DENTRO con el cupón PENDIENTE es 409
//     (`MSJ_APROBAR_CON_PENDIENTE`).
//   · Rechazar el cupón lo quita y devuelve el uso, con motivo obligatorio.
//
//  ─── FAIL-CLOSED, Y POR QUÉ ───────────────────────────────────────────────
//  Todo lo que no se entienda se lee PENDIENTE. Enseñarle al cliente un
//  descuento de más no se arregla —ya lo leyó—; enseñárselo de menos lo
//  arregla un gerente con un clic.
// ============================================================================

export const ESTADOS_CODIGO = ['PENDIENTE', 'APROBADO'] as const
export type EstadoCodigo = (typeof ESTADOS_CODIGO)[number]

/** Lo mínimo de una fila de `propuestas` para saber en qué estado está su cupón. */
type FilaCodigo = { codigo_texto?: string | null; codigo_estado?: string | null }

/**
 * El estado del cupón de una fila. `null` = no hay cupón.
 *
 * Con cupón, solo `'APROBADO'` EXACTO cuenta como aprobado: un `null`, un
 * `'aprobado'` en minúsculas o cualquier otra cosa se lee PENDIENTE. La base
 * ya lo impide con dos CHECK (`20261003_codigo_aprobacion.sql`); esto es la
 * segunda red para lo que la base no ve — un objeto armado a mano, un mock,
 * una fila de una base a la que no le corrió la migración.
 */
export function estadoCodigoDeFila(f: FilaCodigo): EstadoCodigo | null {
  if (f.codigo_texto == null) return null
  return f.codigo_estado === 'APROBADO' ? 'APROBADO' : 'PENDIENTE'
}

/** El cliente solo ve un cupón APROBADO. */
export function codigoVisibleParaCliente(estado: EstadoCodigo | null): boolean {
  return estado === 'APROBADO'
}

/**
 * La fila de la propuesta tal como la puede ver el CLIENTE: si el cupón no
 * está aprobado, sin cupón — texto, porcentaje y momento—, como si no se
 * hubiera aplicado. Así el total que arma `armarPropuesta` sale sin él y el
 * texto no llega al JSON.
 *
 * Se filtra la FILA y no el objeto ya armado a propósito: el objeto público se
 * arma A MANO, campo por campo (`obtenerPropuestaPublica`), y un filtro a la
 * salida tendría que acordarse de cada campo que dependa del cupón —el monto,
 * la base, el neto, el IVA, el total, los «aprobados»—. Quitándolo a la
 * entrada, ninguno de ellos puede llevarlo.
 *
 * No muta la fila recibida.
 */
export function filaParaCliente<T extends FilaCodigo>(fila: T): T {
  if (codigoVisibleParaCliente(estadoCodigoDeFila(fila))) return fila
  return {
    ...fila,
    codigo_texto: null,
    codigo_descuento_pct: 0,
    codigo_canjeado_en: null,
    codigo_estado: null,
    codigo_aprobado_por: null,
    codigo_aprobado_en: null,
  }
}

/** Decisión 1 del dueño: un cupón sobre una RECHAZADA la reactiva a BORRADOR. */
export function estatusTrasCanje(estatus: string): string {
  return estatus === 'RECHAZADA' ? 'BORRADOR' : estatus
}

/** Dónde se ofrece el bloque del cupón. Nunca en APROBADA: es inmutable. */
export const ESTATUS_ADMITEN_CUPON = ['BORRADOR', 'ENVIADA', 'RECHAZADA'] as const
export function admiteCupon(estatus: string): boolean {
  return (ESTATUS_ADMITEN_CUPON as readonly string[]).includes(estatus)
}

/**
 * Por qué no se puede decidir sobre este cupón, o `null` si se puede.
 *
 * Solo se decide sobre PENDIENTE. Y nunca sobre una propuesta APROBADA: no
 * debería existir una APROBADA con el cupón pendiente —el paso a APROBADA lo
 * impide por los dos caminos—, pero si existiera, rechazarlo cambiaría un
 * documento firmado.
 */
export function motivoDecisionImposible(p: {
  estatus: string
  codigoEstado: EstadoCodigo | null
}): string | null {
  if (p.estatus === 'APROBADA') {
    return 'La propuesta ya esta aprobada y es inmutable; un cambio va como adenda.'
  }
  if (p.codigoEstado == null) return 'Esta propuesta no tiene ningun codigo promocional aplicado.'
  if (p.codigoEstado === 'APROBADO') return 'Ese codigo ya esta aprobado; no hay nada que decidir.'
  return null
}

/** Regla derivada: aprobar la propuesta con el cupón PENDIENTE está bloqueado. */
export function bloqueaAprobacion(estado: EstadoCodigo | null): boolean {
  return estado === 'PENDIENTE'
}

export const MSJ_APROBAR_CON_PENDIENTE =
  'Primero aprueba o rechaza el código promocional: está pendiente de aprobación y el cliente todavía no lo ve.'

/** La etiqueta de la pantalla interna. `null` = no hay cupón. */
export function etiquetaEstadoCodigo(
  estado: EstadoCodigo | null,
  aprobadoPor: string | null,
): string | null {
  if (estado == null) return null
  if (estado === 'PENDIENTE') return 'Pendiente de aprobación'
  // APROBADO sin aprobador = el backfill de la migración (se veía solo por la
  // regla de antes) o un aprobador dado de baja. No se inventa un nombre.
  return aprobadoPor ? `Aprobado por ${aprobadoPor}` : 'Aprobado'
}

// ─── Lo que queda en Actividad (`acciones`) ────────────────────────────────
// Cada línea NOMBRA EL CÓDIGO: seis meses después, «aprobó un código» no
// permite explicar por qué esa venta salió más barata.

export const textoReactivacion = (codigo: string) =>
  `Reactivó la propuesta con el código ${codigo}`

export const textoAprobacion = (codigo: string, pct: number) =>
  `Aprobó el código promocional ${codigo} (${pct} %)`

export const textoRechazo = (codigo: string, motivo: string) =>
  `Rechazó el código promocional ${codigo} — motivo: ${motivo}`

export const textoQuitadoAlAceptar = (codigo: string) =>
  `El cliente aceptó la propuesta sin el código ${codigo}: estaba pendiente de aprobación, se quitó y su uso volvió al cupón`

// ─── El selector de cupones existentes (decisión 2) ────────────────────────

type CuponListado = {
  codigo: string
  vigenteDesde: string
  vigenteHasta: string
  usosMaximos: number | null
  usos: number
}

/**
 * Los cupones que vale la pena OFRECER en el selector: vigentes en `hoy` y con
 * usos libres, por orden de código.
 *
 * Es solo una comodidad de la pantalla y NO decide nada: el canje lo vuelve a
 * comprobar todo contra el reloj de Postgres y con la fila bloqueada
 * (`codigos-repo.ts:canjearCodigo`). Por eso `hoy` puede ser la fecha del
 * navegador sin que importe: si se equivoca, el servidor dice que no con una
 * frase. Sin `hoy` legible no se ofrece nada, en vez de ofrecerlo todo.
 */
export function vigentesParaSelector<T extends CuponListado>(lista: T[], hoy: string): T[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hoy)) return []
  return lista
    .filter(
      (c) =>
        c.vigenteDesde <= hoy &&
        hoy <= c.vigenteHasta &&
        (c.usosMaximos == null || c.usos < c.usosMaximos),
    )
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
}

/**
 * Las propuestas a las que se puede ASIGNAR un cupón desde la pantalla de
 * Códigos promocionales. Pedido del dueño el 2026-09-30: «en códigos
 * promocionales debe de estar la opción de asignarse a alguna propuesta».
 *
 * Es el MISMO canje que el bloque de la propuesta —mismo endpoint, mismo
 * PENDIENTE, misma reactivación de una RECHAZADA—, solo que se elige desde el
 * otro lado. Por eso la regla de qué estatus admiten cupón no se repite aquí:
 * es `admiteCupon`.
 *
 * Se dejan fuera las que ya llevan un cupón: el servidor rechaza el segundo, y
 * ofrecerlas sería ofrecer un botón que falla. Como en `vigentesParaSelector`,
 * esto es comodidad; quien decide es el servidor.
 */
export function propuestasParaAsignar<
  T extends { folio: string; estatus: string; codigoTexto: string | null },
>(lista: T[] | undefined): T[] {
  return (lista ?? [])
    .filter((p) => admiteCupon(p.estatus) && p.codigoTexto == null)
    .sort((a, b) => a.folio.localeCompare(b.folio))
}

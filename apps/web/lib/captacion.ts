// ============================================================================
//  lib/captacion.ts — Las reglas de la bitácora de captación.  CAP-01.
// ----------------------------------------------------------------------------
//  Un PROSPECTO es algo que un vendedor intenta traer a la organización: un
//  cliente que anuncie, un arrendador que rente, un predio donde poner pantallas
//  o una pantalla concreta. Cada avance queda escrito en su bitácora, y cuando
//  está listo lo revisa alguien con `captacion.aprobar` (gerente, director,
//  administrador o Dueño), que lo aprueba —y entonces se crea el registro de
//  verdad— o lo rechaza con motivo.
//
//  Este archivo NO toca base ni red a propósito: lo usan el servidor
//  (`captacion-controller.ts`, `captacion-repo.ts`) y la pantalla, y una regla
//  escrita dos veces diverge. La pantalla la usa para no ofrecer un botón que el
//  servidor va a negar; el servidor la vuelve a aplicar con la fila bloqueada,
//  que es la comprobación que cuenta.
//
//  Las etapas son `text` con CHECK en la base y NO un enum de Postgres: un valor
//  de enum no se puede quitar nunca (zona A5 de `zonas-de-riesgo.md`), y una
//  lista de etapas de venta es justo lo que el negocio va a querer retocar.
// ============================================================================

export const TIPOS_PROSPECTO = ['CLIENTE', 'ARRENDADOR', 'PREDIO', 'PANTALLA'] as const
export type TipoProspecto = (typeof TIPOS_PROSPECTO)[number]

export const ETAPAS = [
  'PROSPECTO',
  'CONTACTADO',
  'VISITA',
  'NEGOCIACION',
  'EN_REVISION',
  'APROBADO',
  'RECHAZADO',
  'PERDIDO',
] as const
export type Etapa = (typeof ETAPAS)[number]

/** Las que el vendedor mueve a su gusto, hacia delante y hacia atrás. */
export const ETAPAS_DE_TRABAJO = ['PROSPECTO', 'CONTACTADO', 'VISITA', 'NEGOCIACION'] as const

export const ETIQUETA_TIPO: Record<TipoProspecto, string> = {
  CLIENTE: 'Cliente',
  ARRENDADOR: 'Arrendador',
  PREDIO: 'Predio',
  PANTALLA: 'Pantalla',
}

export const ETIQUETA_ETAPA: Record<Etapa, string> = {
  PROSPECTO: 'Prospecto',
  CONTACTADO: 'Contactado',
  VISITA: 'Visita',
  NEGOCIACION: 'Negociación',
  EN_REVISION: 'En revisión',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  PERDIDO: 'Perdido',
}

const esEtapa = (e: string): e is Etapa => (ETAPAS as readonly string[]).includes(e)
const esDeTrabajo = (e: string) => (ETAPAS_DE_TRABAJO as readonly string[]).includes(e)

/**
 * APROBADO y PERDIDO son finales. RECHAZADO NO lo es: vuelve al vendedor para
 * que corrija lo que le pidieron, y la bitácora sigue.
 */
export function etapaCerrada(e: Etapa): boolean {
  return e === 'APROBADO' || e === 'PERDIDO'
}

/**
 * ¿Se puede registrar un avance que lleve el prospecto de `actual` a `nueva`?
 * Devuelve la frase que dice por qué no, o null si se puede.
 *
 * Quedarse en la misma etapa es un avance válido: es una nota («llamé, no
 * contestó»), y es lo más frecuente en una venta real.
 */
export function motivoAvanceInvalido(actual: Etapa, nueva: Etapa): string | null {
  if (!esEtapa(nueva)) return `La etapa «${String(nueva)}» no existe`
  if (etapaCerrada(actual)) {
    return 'El prospecto está cerrado: ya no admite avances'
  }
  // Aprobar y rechazar NO son avances: los decide otra persona, por otra ruta y
  // con otro permiso. Si un avance pudiera llevar a APROBADO, el vendedor se
  // aprobaría solo y el registro real nacería sin que nadie lo revisara.
  if (nueva === 'APROBADO' || nueva === 'RECHAZADO') {
    return 'Aprobar o rechazar se hace desde la revisión, no con un avance'
  }
  if (actual === nueva) return null
  // En revisión el prospecto está esperando a quien decide. Moverlo de etapa
  // mientras tanto le cambiaría lo que está revisando bajo los pies.
  if (actual === 'EN_REVISION') {
    return 'Está en revisión: espera la decisión, o agrega una nota sin cambiar de etapa'
  }
  if (esDeTrabajo(actual) || actual === 'RECHAZADO') {
    if (esDeTrabajo(nueva) || nueva === 'EN_REVISION' || nueva === 'PERDIDO') return null
  }
  return `No se puede pasar de ${ETIQUETA_ETAPA[actual]} a ${ETIQUETA_ETAPA[nueva]}`
}

/** Solo se decide sobre lo que está EN_REVISION. */
export function motivoDecisionInvalida(actual: Etapa): string | null {
  if (actual === 'EN_REVISION') return null
  if (actual === 'APROBADO' || actual === 'RECHAZADO') {
    return `Este prospecto ya se decidió: está ${ETIQUETA_ETAPA[actual].toLowerCase()}`
  }
  return 'Solo se puede aprobar o rechazar un prospecto enviado a revisión'
}

export interface ContactoProspecto {
  nombre?: string | null
  telefono?: string | null
  email?: string | null
}

/** Lo mínimo que la regla de revisión necesita saber de un prospecto. */
export interface ProspectoParaRevision {
  tipo: TipoProspecto
  nombre: string
  contacto: ContactoProspecto
  direccion: string | null
  datos: { arrendadorId?: string | null } & Record<string, unknown>
}

const lleno = (v: unknown) => typeof v === 'string' && v.trim() !== ''

/**
 * Lo que le falta a un prospecto para poder enviarse a revisión. Lista vacía =
 * listo. Se pide lo mínimo para que quien aprueba pueda CREAR el registro real
 * sin tener que volver a preguntarle nada al vendedor.
 */
export function faltantesParaRevision(p: ProspectoParaRevision): string[] {
  const faltan: string[] = []
  const c = p.contacto ?? {}
  const contactable = lleno(c.telefono) || lleno(c.email)
  if (p.tipo === 'CLIENTE' || p.tipo === 'ARRENDADOR') {
    if (!contactable) faltan.push('un teléfono o un correo de contacto')
  }
  if (p.tipo === 'PREDIO' || p.tipo === 'PANTALLA') {
    if (!lleno(p.direccion)) faltan.push('la dirección')
  }
  if (p.tipo === 'PREDIO') {
    // Un predio siempre cuelga de un arrendador (`predios.arrendador_id not
    // null`). O ya existe, o el contacto es el dueño y se da de alta al aprobar.
    const conDueno = lleno(p.datos?.arrendadorId) || (lleno(c.nombre) && contactable)
    if (!conDueno) {
      faltan.push('el dueño: un arrendador existente o el nombre y teléfono del contacto')
    }
  }
  return faltan
}

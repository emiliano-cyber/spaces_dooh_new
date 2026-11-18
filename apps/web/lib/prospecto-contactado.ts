import type { Etapa, TipoProspecto } from '@/lib/captacion'
import type { EtapaOportunidad } from '@/lib/crm'

// ============================================================================
//  Un prospecto de tipo cliente que avanza de Contactado en adelante: ¿sigue
//  como prospecto o se convierte en oportunidad?  18/11, pedido del dueño.
// ----------------------------------------------------------------------------
//  «Si el prospecto ya entró a Contactado se convierte; si no, sigue como
//  prospecto.» Y al preguntarle cómo: que lo decida el vendedor. Sus
//  respuestas del mismo día afinaron tres cosas:
//   1. Convertir ABRE el formulario de la oportunidad (presupuesto, fechas…)
//      ya con el prospecto elegido; no la crea a ciegas.
//   2. Se pregunta al entrar a CUALQUIER etapa de Contactado en adelante
//      (nunca a Perdido ni Rechazado), si no tiene oportunidad ABIERTA.
//   3. El servidor no deja abrir una segunda mientras haya una abierta
//      (`oportunidades-repo.ts`, `crearOportunidad`): 409.
//
//  El avance se guarda al ELEGIR «Seguir como prospecto», o —si se eligió
//  convertir— cuando la oportunidad ya se creó. Así cancelar el cuadro o el
//  formulario deja todo como estaba.
//
//  Todo con las APIs que ya existían —`POST /api/captacion/<id>/avances` y
//  `POST /api/oportunidades` con `prospectoId`—. Aquí solo se decide QUÉ
//  preguntar y qué hace cada salida; es puro para probarlo sin DOM
//  (`vitest.config.ts`).
// ============================================================================

export type EleccionContactado = 'prospecto' | 'oportunidad' | 'cancelar'

/** Las etapas «de Contactado en adelante» a las que entrar hace preguntar. */
export const ETAPAS_QUE_PREGUNTAN: readonly Etapa[] = ['CONTACTADO', 'VISITA', 'NEGOCIACION', 'EN_REVISION', 'APROBADO']

/**
 * Si al guardar el avance hay que preguntar. Solo un CLIENTE (los espacios de
 * Prospección no tienen oportunidades: el servidor las negaría), solo al
 * ENTRAR a una etapa de Contactado en adelante (una nota sin cambiar de etapa
 * no pregunta), solo si no tiene una oportunidad abierta, y solo a quien puede
 * crearlas (`comercial.crear`): a quien no, el avance se guarda como siempre.
 */
export function preguntarAlContactar(c: {
  tipo: TipoProspecto
  etapaActual: Etapa
  etapaNueva: Etapa
  tieneOportunidadAbierta: boolean
  puedeConvertir: boolean
}): boolean {
  return (
    c.puedeConvertir &&
    c.tipo === 'CLIENTE' &&
    ETAPAS_QUE_PREGUNTAN.includes(c.etapaNueva) &&
    c.etapaNueva !== c.etapaActual &&
    !c.tieneOportunidadAbierta
  )
}

/**
 * Si alguna de las oportunidades que llegaron cuelga de ese prospecto y sigue
 * abierta. Con todas cerradas (GANADA o PERDIDA) se puede abrir otra: es la
 * misma regla que aplica el servidor.
 */
export const tieneOportunidadAbierta = (
  prospectoId: string,
  ops: { prospectoId: string | null; etapa: EtapaOportunidad }[],
) => ops.some((o) => o.prospectoId === prospectoId && o.etapa !== 'GANADA' && o.etapa !== 'PERDIDA')

/**
 * Lo que hace cada salida del cuadro. «Seguir como prospecto» guarda el
 * avance (si falla, el error sube). «Convertir» solo abre el formulario: el
 * avance se guarda después, cuando la oportunidad ya existe. Cancelar no hace
 * nada. Devuelve el prospecto guardado, o null si no se guardó nada todavía.
 */
export async function aplicarEleccion<P>(
  eleccion: EleccionContactado,
  acciones: { guardarAvance: () => Promise<P>; abrirFormulario: () => void },
): Promise<P | null> {
  if (eleccion === 'prospecto') return acciones.guardarAvance()
  if (eleccion === 'oportunidad') acciones.abrirFormulario()
  return null
}

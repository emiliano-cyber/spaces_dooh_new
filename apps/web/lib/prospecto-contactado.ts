import type { Etapa, TipoProspecto } from '@/lib/captacion'

// ============================================================================
//  Un prospecto de tipo cliente que pasa a Contactado: ¿sigue como prospecto o
//  se convierte en oportunidad?  18/11, pedido del dueño.
// ----------------------------------------------------------------------------
//  «Si el prospecto ya entró a Contactado se convierte; si no, sigue como
//  prospecto.» Y al preguntarle cómo: que lo decida el vendedor. Así que al
//  registrar el avance a CONTACTADO la pantalla pregunta, con dos salidas:
//  seguir como prospecto (solo el avance) o convertir (el avance y DESPUÉS el
//  alta de la oportunidad). Cancelar no manda nada.
//
//  Todo con las dos APIs que ya existían —`POST /api/captacion/<id>/avances`
//  y `POST /api/oportunidades` con `prospectoId`—, sin tocar el servidor: él
//  sigue comprobando que el prospecto sea de tipo cliente y que quien crea la
//  oportunidad lo pueda ver. Aquí solo se decide QUÉ preguntar; es puro para
//  poder probarlo sin DOM (`vitest.config.ts`).
// ============================================================================

export type EleccionContactado = 'prospecto' | 'oportunidad' | 'cancelar'

/**
 * Si al guardar el avance hay que preguntar. Solo un CLIENTE (los espacios de
 * Prospección no tienen oportunidades: el servidor las negaría), solo al
 * ENTRAR a Contactado (no al dejar otra nota estando ya ahí), solo si aún no
 * tiene oportunidad, y solo a quien puede crearlas (`comercial.crear`): a quien
 * no, el avance se guarda como siempre.
 */
export function preguntarAlContactar(c: {
  tipo: TipoProspecto
  etapaActual: Etapa
  etapaNueva: Etapa
  tieneOportunidad: boolean
  puedeConvertir: boolean
}): boolean {
  return (
    c.puedeConvertir &&
    c.tipo === 'CLIENTE' &&
    c.etapaNueva === 'CONTACTADO' &&
    c.etapaActual !== 'CONTACTADO' &&
    !c.tieneOportunidad
  )
}

/** Si alguna de las oportunidades que llegaron cuelga de ese prospecto. */
export const tieneOportunidad = (prospectoId: string, ops: { prospectoId: string | null }[]) =>
  ops.some((o) => o.prospectoId === prospectoId)

/**
 * El alta de la oportunidad, con lo único que hace falta: el nombre (el del
 * prospecto, que el vendedor puede cambiar en la ficha) y el prospecto. Nada
 * de presupuesto ni fechas: no se inventan; se capturan en la ficha.
 */
export function altaDesdeProspecto(p: { id: string; nombre: string }) {
  return {
    nombre: p.nombre.trim().slice(0, 200),
    presupuestoMin: null,
    presupuestoMax: null,
    fechaInicioDeseada: null,
    fechaFinDeseada: null,
    fechaDecision: null,
    plazas: null,
    tiposMedio: [] as string[],
    objetivo: null,
    clienteId: null,
    prospectoId: p.id,
    nota: null,
  }
}

/**
 * Lo que hace cada salida del cuadro. El avance va PRIMERO: si el servidor lo
 * niega, no nace una oportunidad de un prospecto que no llegó a Contactado (el
 * error sube). Si el avance entra y la oportunidad no, el avance se queda —ya
 * está guardado— y se devuelve el motivo para decirlo en pantalla.
 */
export async function aplicarEleccion<P, O>(
  eleccion: EleccionContactado,
  acciones: { guardarAvance: () => Promise<P>; crearOportunidad: () => Promise<O> },
): Promise<{ prospecto: P | null; oportunidad: O | null; errorOportunidad: string | null }> {
  if (eleccion === 'cancelar') return { prospecto: null, oportunidad: null, errorOportunidad: null }
  const prospecto = await acciones.guardarAvance()
  if (eleccion === 'prospecto') return { prospecto, oportunidad: null, errorOportunidad: null }
  try {
    return { prospecto, oportunidad: await acciones.crearOportunidad(), errorOportunidad: null }
  } catch (e) {
    return { prospecto, oportunidad: null, errorOportunidad: e instanceof Error ? e.message : String(e) }
  }
}

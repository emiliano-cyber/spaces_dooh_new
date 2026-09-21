export const MODOS = ['automatica', 'aprobacion']

/**
 * Si esta instancia debe tomar la version disponible, y por que.
 *
 * EL ORDEN DE LAS PREGUNTAS ES LA DECISION, y conviene leerlo entero antes de
 * tocarlo:
 *
 *  1. `automatica` se resuelve ANTES de mirar la aprobacion. Si se mirara
 *     primero, una aprobacion vieja colgando congelaria a quien eligio
 *     automatica — y nadie lo veria, porque no da error.
 *  2. La aprobacion se compara contra el digest DISPONIBLE, no contra el
 *     nombre de la version. Es el ADR 0037: el dueno aprueba lo que vio.
 *  3. Lo desconocido no actualiza. Actualizar corta el servicio y migra la
 *     base; ante la duda, la respuesta segura es no.
 */
export function decidirActualizacion({
  modo,
  corrida,
  digestInstalado,
  digestDisponible,
  aprobadoDigest,
}) {
  if (!digestDisponible) return { actualizar: false, motivo: 'sin-disponible' }
  if (digestDisponible === digestInstalado) return { actualizar: false, motivo: 'sin-cambios' }

  if (modo === 'automatica') {
    return corrida === 'programada'
      ? { actualizar: true, motivo: 'automatica' }
      : { actualizar: false, motivo: 'automatica-espera-madrugada' }
  }

  if (modo !== 'aprobacion') return { actualizar: false, motivo: 'modo-desconocido' }

  if (aprobadoDigest && aprobadoDigest === digestDisponible) {
    return { actualizar: true, motivo: 'aprobada' }
  }
  if (aprobadoDigest) return { actualizar: false, motivo: 'aprobacion-caduca' }
  return { actualizar: false, motivo: 'esperando-aprobacion' }
}

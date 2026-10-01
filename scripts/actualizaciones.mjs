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

// ─── Notas de version (pedido del dueno, 2026-10-01) ───────────────────────

/**
 * Donde vive `novedades.json` DENTRO de la imagen. El `Dockerfile` lo copia
 * aqui de forma EXPLICITA: hoy el standalone tambien lo trae, pero solo porque
 * el trazado de Next sigue el `import` de la app (ver el `Dockerfile`), y eso
 * no es un contrato. Una prueba (`scripts/actualizaciones.test.ts`) exige que
 * la COPY y esta ruta casen.
 */
export const RUTA_NOVEDADES = '/app/apps/web/novedades.json'

/**
 * La entrada de `version` en el texto de `novedades.json`, o `null`.
 *
 * NUNCA LANZA, y es lo unico que importa de esta funcion: la llama la sonda
 * de estado de `update.sh`, y LAS NOTAS NO PUEDEN TUMBAR UNA ACTUALIZACION.
 * Archivo ausente, JSON roto, version sin entrada, o una "version" que es el
 * nombre del canal (`VERSION_NUEVA="$CANAL"` en `update.sh` cuando la imagen
 * no trae SPACE_OS_VERSION): todo es `null`, y la sonda sigue.
 *
 * Solo comprueba la FORMA minima, a proposito. La validacion de verdad
 * (`apps/web/lib/novedades-reglas.mjs`) la hace la aplicacion al LEER la
 * columna, y descarta lo que no sirva. No se importa aqui porque ese archivo
 * no viaja suelto en la imagen, y un `import` que falle en este modulo
 * arrastraria a `decidirActualizacion`: la sonda entera moriria por un dato
 * informativo. Una precandidata (`v0.9.2-rc1`) lee las notas de su version.
 */
export function notasParaVersion(texto, version) {
  try {
    const m = /^(v\d+\.\d+\.\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(typeof version === 'string' ? version : '')
    if (!m || typeof texto !== 'string') return null
    const lista = JSON.parse(texto)
    if (!Array.isArray(lista)) return null
    const e = lista.find((x) => x && typeof x === 'object' && x.version === m[1])
    return e && Array.isArray(e.items) ? e : null
  } catch {
    return null
  }
}

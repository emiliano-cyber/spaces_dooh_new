import type { EstadoActualizacion } from '@/lib/data/actualizaciones-api'
import { conteo } from '@/lib/plural'

// ============================================================================
//  actualizaciones-ui.ts — Las frases y el tono de la tarjeta de
//  Administracion (ADR 0037). `vitest.config.ts` no monta jsdom a proposito
//  (ver CLAUDE.md), asi que nada de lo que se escriba dentro del `.tsx` lo
//  prueba nadie: por eso vive aqui, con sus pruebas, y el `.tsx` solo pinta lo
//  que estas funciones deciden. Es la misma leccion de B32 y B33.
// ============================================================================

export type TonoEstado = 'ok' | 'alerta' | 'info'

// La hora del cron de la 04:17 (ADR 0037, `infra/scripts/instalar-hijo.sh:867`
// y `provision-instancia.sh:834`). No se lee de ninguna parte porque no hay
// vista que la sirva: es la unica ventana automatica que existe hoy.
const HORA_VENTANA_AUTOMATICA = '04:17'

// El texto y el tono que enseña la tarjeta, segun el estado que devuelve
// GET /api/actualizaciones. EL ORDEN DE LAS PREGUNTAS ES LA DECISION, igual
// que en `decidirActualizacion` (scripts/actualizaciones.mjs):
//
//  1. Si nunca se comprobo, se dice: fingir que esta al dia seria mentir con
//     un dato que no existe.
//  2. Si no hay novedad, es la unica frase en verde.
//  3. Con novedad y modo automatica, la aprobacion NO importa (igual que en
//     `decidirActualizacion`): se dice cuando entra, nunca "pronto".
//  4. Con novedad y modo aprobacion, se distingue una aprobacion vigente de
//     una CADUCA (digest que ya no es el disponible) — ese es el caso
//     negativo que el ADR 0037 existe para impedir: pintarla como "ya
//     aprobaste" dejaria esperando algo que nunca va a pasar.
export function textoDeEstado(e: EstadoActualizacion): { tono: TonoEstado; texto: string } {
  if (!e.comprobadoEn) {
    return {
      tono: 'info',
      texto: 'Esta instancia todavia no se ha comprobado contra el registro: no se sabe si hay una version nueva.',
    }
  }

  if (!e.hayNovedad) {
    return {
      tono: 'ok',
      texto: `Al dia: corre ${e.versionInstalada ?? 'la version instalada'}, la misma que hay disponible.`,
    }
  }

  const version = e.versionDisponible ?? 'una version nueva'

  if (e.modo === 'automatica') {
    return {
      tono: 'info',
      texto: `Hay ${version} disponible. Se instalara sola en la proxima ventana automatica, de madrugada (${HORA_VENTANA_AUTOMATICA}).`,
    }
  }

  if (e.aprobadoDigest && e.aprobadoDigest !== e.digestDisponible) {
    return {
      tono: 'alerta',
      texto: `Lo que aprobaste ya no es lo disponible: salio una version mas nueva, ${version}. Aprueba de nuevo para instalarla.`,
    }
  }

  if (e.aprobadoDigest && e.aprobadoDigest === e.digestDisponible) {
    return {
      tono: 'info',
      texto: `Aprobaste ${version}: se instalara en los proximos minutos, o de madrugada (${HORA_VENTANA_AUTOMATICA}) a mas tardar.`,
    }
  }

  return {
    tono: 'alerta',
    texto: `Hay una version nueva disponible: ${version}. Esperando tu aprobacion para instalarla.`,
  }
}

// El texto del ConfirmDialog del boton "Instalar". Instalar corta el
// servicio y migra la base (ADR 0037): el dialogo tiene que decir CUANTAS
// migraciones trae y que va a haber un corte, nunca un clic suelto.
export function textoConfirmarInstalar(e: EstadoActualizacion): string {
  const version = e.versionDisponible ?? 'la version disponible'
  const n = e.migracionesPendientes ?? 0
  const migraciones = n === 0 ? 'No trae migraciones pendientes' : `Trae ${conteo(n, 'migracion', 'migraciones')} pendiente${n === 1 ? '' : 's'}`
  return `Vas a instalar ${version}. ${migraciones}. El servicio se corta mientras dura la instalacion.`
}

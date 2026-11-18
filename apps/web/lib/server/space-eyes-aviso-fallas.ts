import 'server-only'
import { listarEquipos } from './space-eye'
import { notificar } from './notificaciones-repo'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/space-eyes-aviso-fallas.ts — Que una pantalla caída SALTE.
// ----------------------------------------------------------------------------
//  Hasta aquí, una pantalla apagada avisaba de dos formas, y las dos piden que
//  alguien ya esté mirando: un correo —que de madrugada no lee nadie— y el
//  aviso en la lista de Space Eyes, que solo ve quien entra a Space Eyes.
//
//  Esto es la tercera: la notificación del propio SPACE OS. Sale como aviso
//  emergente encima de CUALQUIER pantalla de la aplicación y se queda en la
//  campanita. Quien está en Propuestas a las nueve de la mañana se entera de
//  que un espectacular lleva la noche apagado sin haber entrado a mirarlo.
//
//  POR QUÉ CUELGA DEL SONDEO Y NO DE UN TRABAJO PROPIO. SPACE OS no tiene un
//  planificador: lo que se repite solo, se repite porque `/api/estado` lo
//  dispara, que es lo que ya hace `sincronizarCampanasEyes`. Así que esto va
//  igual —sin esperarlo, sin lanzar nunca— y hereda su respiro por empresa:
//  la consulta a Space Eye se hace como mucho una vez cada dos minutos por
//  empresa, da igual cuánta gente tenga la pestaña abierta.
//
//  NO SE REPITE. El `notificar()` de esta casa no deja dos veces el mismo
//  hecho el mismo día: mismo tipo, título, detalle y enlace. Como el detalle
//  lleva la HORA en que se detectó la falla, cada falla avisa una vez — y si la
//  misma pantalla vuelve a caerse por la tarde, eso sí es otro hecho y vuelve a
//  saltar, que es justo lo que se quiere.
// ============================================================================

const RESPIRO_MS = 2 * 60 * 1000
const ultima = new Map<string, number>()
const enCurso = new Map<string, Promise<void>>()

/**
 * Avisa por el centro de notificaciones de las pantallas que están fallando
 * AHORA. Nunca lanza: si Space Eye no contesta, no pasa nada y se reintenta en
 * el siguiente sondeo.
 *
 * Sin `tenant`, el de la sesión. Resuélvelo ANTES si vas a llamarla sin
 * esperarla (`void avisarFallasEyes({ tenant })`), porque para entonces puede
 * que ya no haya petición de la que sacarlo.
 */
export async function avisarFallasEyes(opts: { tenant?: string | null } = {}): Promise<void> {
  try {
    const tenant = opts.tenant ?? (await tenantActual())
    if (!tenant) return
    if (Date.now() - (ultima.get(tenant) ?? 0) < RESPIRO_MS) return
    const curso = enCurso.get(tenant)
    if (curso) return await curso
    ultima.set(tenant, Date.now())
    const p = avisarAhora()
    enCurso.set(tenant, p)
    try {
      await p
    } finally {
      enCurso.delete(tenant)
    }
  } catch (e) {
    console.error('[space-eyes] avisar fallas:', e instanceof Error ? e.message : e)
  }
}

async function avisarAhora(): Promise<void> {
  // Se reaprovecha la misma lectura que pinta la lista: ya trae la falla
  // abierta más antigua de cada equipo y ya tolera que Space Eye no conteste.
  const equipos = await listarEquipos()
  for (const e of equipos) {
    if (!e.falla) continue
    const cuantas = e.falla.cuantas > 1 ? ` (y ${e.falla.cuantas - 1} más)` : ''
    await notificar({
      tipo: 'space_eyes_falla',
      nivel: 'warn',
      titulo: `Pantalla con falla: ${e.nombre}`,
      // La hora va en el detalle a propósito: es lo que distingue una caída de
      // otra para el filtro de repetidos, y es lo primero que se pregunta.
      detalle: `${e.falla.nombre}${cuantas} · ${e.falla.donde} · desde ${hora(e.falla.desde)}`,
      link: `/space-eyes/${e.id}`,
    })
  }
}

/** La hora de la detección, corta y en el formato de la casa. */
function hora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

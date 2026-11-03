// ============================================================================
//  Space Eyes · ¿el equipo se actualiza solo o necesita a alguien en sitio?
// ----------------------------------------------------------------------------
//  Lo reporta el propio teléfono desde la app 0.16.4 (actualiza_sola + motivo,
//  ver AppUpdater.decidir en space-eye/android). Para las versiones de antes se
//  deduce: desde la 0.10.0 (código 11) tienen actualizador pero no el permiso de
//  instalar sin toque, así que la próxima pide un toque y de ahí en adelante ya
//  no; antes de la 0.10.0 no se actualizan a distancia.
//
//  Raspberry y PC siempre se actualizan solas (las instala su propio agente).
// ============================================================================

import { traducir, type ClaveTexto } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'

export type ComoSeActualiza = {
  sola: boolean
  /** Lo que se le muestra al usuario, en una frase. */
  texto: string
  tono: 'ok' | 'aviso' | 'visita'
}

export type EquipoParaActualizar = {
  app_version: string | null
  app_version_code: number | null
  device_owner: number | boolean | null
  app_actualiza_sola?: number | boolean | null
  app_actualiza_motivo?: string | null
}

const CODIGO_CON_ACTUALIZADOR = 11 // 0.10.0

// El texto sale del diccionario (`spaceeyes.actualizacion.*`). `idioma` va al
// final con 'es' por omision: el servidor (`lib/server/space-eye.ts`, que lo
// manda en la lista de equipos) no lo pasa y sigue en español, letra por letra
// lo de siempre (lo fija `space-eyes-actualizacion.test.ts`).
export function comoSeActualiza(e: EquipoParaActualizar, idioma: Idioma = 'es'): ComoSeActualiza {
  const r = (sola: boolean, clave: ClaveTexto, tono: ComoSeActualiza['tono']): ComoSeActualiza => ({
    sola,
    texto: traducir(idioma, clave),
    tono,
  })
  const v = String(e.app_version || '')
  if (/^(pi|pc)-agent/i.test(v)) return r(true, 'spaceeyes.actualizacion.sola', 'ok')
  if (e.device_owner === 1 || e.device_owner === true) return r(true, 'spaceeyes.actualizacion.kiosco', 'ok')
  if (e.app_actualiza_sola === 1 || e.app_actualiza_sola === true) return r(true, 'spaceeyes.actualizacion.sin-tocar', 'ok')

  switch (e.app_actualiza_motivo) {
    case 'android_viejo':
      return r(false, 'spaceeyes.actualizacion.android-viejo', 'aviso')
    case 'sin_instalar_apps':
      return r(false, 'spaceeyes.actualizacion.sin-instalar-apps', 'aviso')
    case 'otro_dueno':
      return r(false, 'spaceeyes.actualizacion.otro-dueno', 'aviso')
    case 'sin_permiso':
      return r(false, 'spaceeyes.actualizacion.proxima', 'aviso')
  }

  // Versión anterior a la 0.16.4: no lo reporta.
  const codigo = Number(e.app_version_code) || 0
  if (codigo > 0 && codigo < CODIGO_CON_ACTUALIZADOR) return r(false, 'spaceeyes.actualizacion.visita', 'visita')
  return r(false, 'spaceeyes.actualizacion.proxima', 'aviso')
}

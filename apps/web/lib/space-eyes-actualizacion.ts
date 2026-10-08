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

export function comoSeActualiza(e: EquipoParaActualizar): ComoSeActualiza {
  const v = String(e.app_version || '')
  if (/^(pi|pc)-agent/i.test(v)) return { sola: true, texto: 'Se actualiza sola.', tono: 'ok' }
  if (e.device_owner === 1 || e.device_owner === true)
    return { sola: true, texto: 'Se actualiza sola (modo kiosco).', tono: 'ok' }
  if (e.app_actualiza_sola === 1 || e.app_actualiza_sola === true)
    return { sola: true, texto: 'Se actualiza sola, sin tocar el teléfono.', tono: 'ok' }

  switch (e.app_actualiza_motivo) {
    case 'android_viejo':
      return {
        sola: false,
        texto: 'Pide un toque en el teléfono en cada actualización: tiene Android 11 o anterior.',
        tono: 'aviso',
      }
    case 'sin_instalar_apps':
      return {
        sola: false,
        texto: 'Pide un toque: en el teléfono está apagado «Instalar apps desconocidas» para Space Eye.',
        tono: 'aviso',
      }
    case 'otro_dueno':
      return { sola: false, texto: 'Pide un toque: otra tienda administra sus actualizaciones.', tono: 'aviso' }
    case 'sin_permiso':
      return {
        sola: false,
        texto: 'La próxima actualización pide un toque en el teléfono; después se actualiza sola.',
        tono: 'aviso',
      }
  }

  // Versión anterior a la 0.16.4: no lo reporta.
  const codigo = Number(e.app_version_code) || 0
  if (codigo > 0 && codigo < CODIGO_CON_ACTUALIZADOR)
    return {
      sola: false,
      texto: 'Necesita una visita: esta versión no se puede actualizar a distancia.',
      tono: 'visita',
    }
  return {
    sola: false,
    texto: 'La próxima actualización pide un toque en el teléfono; después se actualiza sola.',
    tono: 'aviso',
  }
}

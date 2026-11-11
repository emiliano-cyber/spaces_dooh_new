import type { EstPropuesta } from '@/lib/data/client'
import type { ClaveTexto } from '@/lib/i18n/diccionario'

// ============================================================================
//  Etiqueta y tono del chip de estatus de una propuesta.
// ----------------------------------------------------------------------------
//  Vivía copiado en la lista (`propuestas/page.tsx`) y en el detalle
//  (`propuestas/[id]/page.tsx`): dos copias de la misma tabla son como
//  divergen dos pantallas que deberían decir lo mismo. Se extrae en el
//  rediseño del 26/10 sin cambiar ni un texto.
//
//  El verde de «Aprobada» es el oscuro que ya usaba (#0f7a55) y no
//  `text-success`: el token (#1da850) sobre blanco no llega al contraste mínimo
//  a 10-11 px, que es el tamaño del chip. Los bordes tintados son los mismos
//  que usan las pastillas del Dashboard.
// ============================================================================

export const EST: Record<EstPropuesta, { label: string; cls: string }> = {
  BORRADOR: { label: 'Borrador', cls: 'border-border text-muted' },
  ENVIADA: { label: 'Enviada', cls: 'border-[#0a66ff40] text-info' },
  APROBADA: { label: 'Aprobada', cls: 'border-[#10b98140] text-[#0f7a55]' },
  RECHAZADA: { label: 'Rechazada', cls: 'border-[#ef444440] text-error' },
}

/**
 * La clave del diccionario de cada estatus (lote de ingles, 2026-11-02). Las
 * pantallas pintan `t(CLAVE_ESTATUS[e])` y no `EST[e].label`, que se queda
 * como la verdad en espanol: `pantallas-propuestas.test.ts` exige que el
 * espanol del diccionario reproduzca EXACTAMENTE este `label`, igual que se
 * hace con el menu y `nav.ts`.
 */
export const CLAVE_ESTATUS: Record<EstPropuesta, ClaveTexto> = {
  BORRADOR: 'propuestas.estatus.borrador',
  ENVIADA: 'propuestas.estatus.enviada',
  APROBADA: 'propuestas.estatus.aprobada',
  RECHAZADA: 'propuestas.estatus.rechazada',
}

/** El orden de los chips de filtro de la lista: el del ciclo de vida. */
export const ORDEN_ESTATUS: EstPropuesta[] = ['BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA']

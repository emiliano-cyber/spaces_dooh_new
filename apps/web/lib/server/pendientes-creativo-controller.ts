import 'server-only'
import { derivarPendientes, soloImpresion, type Pendiente } from '@/lib/pendientes-creativo'
import { leerDatosPendientes } from './pendientes-creativo-repo'
import { notificar } from './notificaciones-repo'

// ============================================================================
//  lib/server/pendientes-creativo-controller.ts — La «tarea 1» (FLUJO-CREA,
//  20/11): listar lo que falta confirmar y avisar a Imprenta.
// ----------------------------------------------------------------------------
//  Las rutas exigen el permiso; aquí solo se arma la respuesta:
//   · `GET /api/impresion/pendientes` (imprenta.ver) → solo IMPRIMIR.
//   · `GET /api/creativos/pendientes` (comercial.ver) → todo: por aprobar,
//     imprimir y programar.
//  «Mandar a impresión» NO tiene ruta propia: es `POST /api/impresion` con el
//  sitio, que crea la orden (y con ella el pendiente se va solo).
// ============================================================================

export async function pendientesDeImpresionCtrl(): Promise<Pendiente[]> {
  return soloImpresion(derivarPendientes(await leerDatosPendientes()))
}

export async function pendientesDeCreativosCtrl(): Promise<Pendiente[]> {
  return derivarPendientes(await leerDatosPendientes())
}

// Tipo de la notificación. Solo la ven quienes tienen `imprenta.ver`
// (`tiposOcultosPara` en `notificaciones-repo.ts`): es trabajo de Imprenta.
export const TIPO_AVISO_IMPRESION = 'IMPRESION'

/**
 * Tras aprobar un creativo: si su campaña tiene sitios fijos por mandar a
 * impresión, deja UN aviso en la bandeja. `notificar` ya no repite el mismo
 * aviso el mismo día, y nunca rompe la aprobación (traga sus errores; esto
 * también).
 *
 * El detalle es la plantilla `notificaciones.impresion.por-mandar.detalle.*`
 * para que la campanita lo pinte en el idioma de quien lo lee.
 */
export async function avisarPendientesImpresion(campanaId: string): Promise<number> {
  try {
    const p = soloImpresion(derivarPendientes(await leerDatosPendientes(campanaId)))
    if (p.length === 0) return 0
    const c = p[0]
    const campana = `${c.campanaFolio ? `${c.campanaFolio} · ` : ''}${c.campanaNombre}`
    await notificar({
      tipo: TIPO_AVISO_IMPRESION,
      nivel: 'info',
      titulo: 'Por mandar a impresión',
      detalle:
        p.length === 1
          ? `${campana} — ${p.length} sitio fijo con creativo aprobado, sin orden de impresión`
          : `${campana} — ${p.length} sitios fijos con creativo aprobado, sin orden de impresión`,
      link: '/imprenta',
    })
    return p.length
  } catch {
    return 0
  }
}

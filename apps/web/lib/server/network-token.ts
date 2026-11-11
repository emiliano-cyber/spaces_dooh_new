import 'server-only'
import { tokenCoincide } from './flota'

// ============================================================================
//  ¿Viene esta petición de la app de Network? (11/11)
// ----------------------------------------------------------------------------
//  Un secreto PROPIO, `NETWORK_TOKEN`, y no el `FLOTA_TOKEN` del panel: son
//  dos terceros distintos —el panel es de AS OOH; la app de Network ve el
//  inventario comercial— y cada uno tiene que poder revocarse sin cortar al
//  otro. La comparación es la de `flota.ts`, importada y no copiada: dos
//  comparaciones en tiempo constante acaban divergiendo.
//
//  Sin `NETWORK_TOKEN` configurado, NADIE es la app: ausente significa cerrado,
//  igual que el panel, el autoregistro y el arranque.
// ============================================================================

export function esLaAppNetwork(req: Request): boolean {
  const esperado = process.env.NETWORK_TOKEN
  if (!esperado) return false
  const recibido = req.headers.get('x-network-token')
  if (!recibido) return false
  return tokenCoincide(recibido, esperado)
}

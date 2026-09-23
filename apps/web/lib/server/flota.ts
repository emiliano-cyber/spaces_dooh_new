import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'

// ============================================================================
//  lib/server/flota.ts — quién es el PANEL de flota, decidido en un solo sitio.
// ----------------------------------------------------------------------------
//  Estas dos funciones nacieron dentro de `app/api/version/route.ts` (F6.1),
//  cuando solo había una ruta que el panel de AS OOH consumía. Salen aquí al
//  llegar la segunda —`GET /api/tickets` con `x-flota-token`, ADR 0038— porque
//  la única alternativa era copiarlas, y una comparación en tiempo constante
//  copiada acaba divergiendo: la copia que se queda atrás es justo la que nadie
//  mira. El comportamiento no cambia ni una coma, y el contrato de
//  `/api/version` lo sigue afirmando su e2e clave a clave.
//
//  Lo que este módulo decide es SOLO «¿habla el panel?». Qué ve el panel una vez
//  identificado lo decide cada ruta, y a propósito: `/api/version` no cuenta ni
//  una cifra del negocio del owner, y `/api/tickets` sí manda el texto que el
//  cliente escribió PARA que AS OOH lo lea. Son dos decisiones distintas y no
//  conviene que compartan más que la puerta.
// ============================================================================

/** Igual que en `/api/bootstrap`: SHA-256 para que los buffers midan siempre lo mismo. */
export function tokenCoincide(recibido: string, esperado: string): boolean {
  const a = createHash('sha256').update(recibido).digest()
  const b = createHash('sha256').update(esperado).digest()
  return timingSafeEqual(a, b)
}

/**
 * ¿Viene esta petición del panel de flota?
 *
 * Sin `FLOTA_TOKEN` configurado, NADIE es el panel. Ausente significa cerrado,
 * igual que el autoregistro y que el arranque: un `.env` que se quedó corto no
 * puede abrir ninguna puerta.
 */
export function esElPanel(req: Request): boolean {
  const esperado = process.env.FLOTA_TOKEN
  if (!esperado) return false
  const recibido = req.headers.get('x-flota-token')
  if (!recibido) return false
  return tokenCoincide(recibido, esperado)
}

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  El epílogo de `infra/scripts/setup-droplet.sh` no puede mandar al modelo
//  muerto.
// ----------------------------------------------------------------------------
//  Defecto ④ del arranque del PADRE (2026-08-21). Al terminar, el script
//  imprime «pasos siguientes» y los suyos describían un producto que ya no
//  existe:
//
//    · `cp .env.example apps/api/.env` — el backend Fastify, ARCHIVADO en
//      `_archive/api` desde que quedó una sola pista viva (`apps/web`).
//    · `/var/www/spaces-dooh` — la ruta real es `/var/www/Spaces`.
//    · `certbot --nginx -d '*.{slug}.spaces.com'` — un certificado COMODÍN por
//      tenant, del modelo de subdominios que murió el 2026-08-12 y que el plan
//      v3 descarta explícitamente (T9).
//
//  No es cosmético: este es el script que en la Fase 5 se convierte en
//  `provision-instancia.sh`, o sea que lo último que una persona lee al
//  aprovisionar una instancia son instrucciones que no llevan a ninguna parte.
//  Y un `nginx -t` sobre lo que salga de ahí diría «ok» igual — la lección del
//  defecto ⑧ del mismo día.
//
//  Esta prueba lee el texto, no lo ejecuta: el fallo era lo que el script DICE.
//
//  Y mira SOLO las líneas que imprime, no el archivo entero. El comentario que
//  explica este defecto nombra `apps/api` y el comodín a propósito —en este
//  repo los comentarios documentan el fallo que motivó la decisión, y son lo
//  único que impide que vuelva—, así que un grep sobre todo el archivo se
//  pondría rojo por la explicación de por qué está arreglado.
// ============================================================================

const RAIZ = join(process.cwd(), '..', '..')
const GUION = readFileSync(join(RAIZ, 'infra', 'scripts', 'setup-droplet.sh'), 'utf8')

/** Lo que el guion IMPRIME: las líneas `echo`, sin comentarios. */
const IMPRIME = GUION.split('\n')
  .filter((l) => /^\s*echo\b/.test(l))
  .join('\n')

describe('setup-droplet.sh no describe el modelo muerto', () => {
  it('no manda al backend Fastify archivado', () => {
    expect(IMPRIME).not.toMatch(/apps\/api/)
  })

  it('no pide un certificado comodín por tenant', () => {
    // El modelo de subdominios por tenant (T9) se descartó el 12/08. Lo que
    // sobrevive es el certificado normal por HTTP-01, uno por instancia.
    expect(IMPRIME).not.toMatch(/\*\.\{slug\}/)
    expect(IMPRIME).not.toMatch(/spaces\.com/)
  })

  it('no usa la ruta vieja /var/www/spaces-dooh', () => {
    expect(IMPRIME).not.toMatch(/spaces-dooh/)
  })

  // ─── Contrafactual: sin esto, borrar el epílogo entero pasaría la prueba.
  it('sigue diciendo a dónde va el código y cómo se arranca', () => {
    expect(IMPRIME).toMatch(/\/var\/www\/Spaces/)
    expect(IMPRIME).toMatch(/pm2/)
    expect(IMPRIME).toMatch(/certbot/)
  })
})

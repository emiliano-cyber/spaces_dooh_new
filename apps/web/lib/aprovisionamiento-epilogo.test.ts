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

  // ─── 2026-09-02 · el epílogo describía OTRO modelo muerto, y esta prueba lo
  //     exigía. Es el mismo defecto ④ una vuelta más tarde.
  //
  //  Los tres casos de arriba cazaron el modelo Fastify/subdominios. Lo que se
  //  colaba por debajo era el modelo **pm2 + repo clonado**: el epílogo mandaba
  //  a `git clone`, `npm ci`, `npm run build` y `pm2 start ecosystem.config.js`.
  //  Y el contrafactual de esta prueba **exigía que apareciera `pm2`**, así que
  //  la prueba no solo lo permitía: lo obligaba. Sobrevivió al
  //  [ADR 0019](../../../docs/adr/0019-demo-arranca-con-systemd.md), que sacó a
  //  pm2 del PADRE, y al modelo de contenedores que F3.5 demostró el 02/09.
  //
  //  UNA INSTANCIA NO CLONA EL REPO Y NO USA pm2: corre un contenedor que
  //  `update.sh` levanta desde la imagen del registro. `/var/www/Spaces` no
  //  existe en la máquina de un cliente — existe en el PADRE.
  //
  //  Y hay una razón por la que esto era peor que un texto viejo:
  //  `provision-instancia.sh:330` mete este guion por `bash -s` en medio de su
  //  propio recorrido, así que el epílogo se imprime **entre el paso 1 y el 2**,
  //  con los pasos 2 a 7 a punto de correr solos. Mandaba a hacer a mano, y por
  //  el camino equivocado, lo que el script hacía él segundos después.
  it('no manda al modelo de pm2 con el repositorio clonado', () => {
    expect(IMPRIME).not.toMatch(/pm2/)
    expect(IMPRIME).not.toMatch(/git clone/)
    expect(IMPRIME).not.toMatch(/npm ci|npm run build/)
    expect(IMPRIME).not.toMatch(/ecosystem\.config/)
  })

  it('no manda a crear un .env.production, que es del modelo viejo', () => {
    // El entorno de una instancia son `/etc/space-os/{app,instancia}.env`, y los
    // escribe el paso 4 de `provision-instancia.sh`, no una persona con `nano`.
    expect(IMPRIME).not.toMatch(/\.env\.production/)
  })

  // ─── Contrafactual: sin esto, borrar el epílogo entero pasaría la prueba.
  it('sigue diciendo qué dejó instalado y quién sigue', () => {
    // Lo que instala, que es su único trabajo y lo que el resto da por hecho.
    expect(IMPRIME).toMatch(/[Dd]ocker/)
    expect(IMPRIME).toMatch(/certbot/i)
    // s3cmd entró el 02/09: sin él el respaldo y el log no salen del droplet.
    expect(IMPRIME).toMatch(/s3cmd/)
    // Y a dónde sigue el recorrido de verdad.
    expect(IMPRIME).toMatch(/provision-instancia\.sh/)
  })
})

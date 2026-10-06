import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  infra/nginx/space-os.io.conf — el nginx del PADRE (zona R6).
// ----------------------------------------------------------------------------
//  Prueba ESTÁTICA: lee el archivo del repo, no habla con ningún nginx. No
//  sustituye a `nginx -t` ni a las comprobaciones con `curl` en el servidor;
//  solo impide que vuelva un defecto concreto que ningún `nginx -t` ve, porque
//  la configuración vieja era sintácticamente perfecta.
//
//  El defecto (05/10): el catch-all `default_server` del 80 redirigía a
//  `https://space-os.io`. Desde el 01/10 el ápice resuelve a OTRA máquina
//  (67.207.88.243, ver el bloque 6 del archivo y `e3524eb0`/`c1b4a1f9`), así
//  que cualquiera que llegara al PADRE por la IP o por un nombre desconocido
//  acababa mandado —con un 301, que el navegador guarda— a un servidor ajeno.
//
//  Por eso la prueba no se conforma con «no apunta al ápice»: exige que el
//  catch-all NO redirija a ningún nombre. Un 301 a un nombre fijo caduca el
//  día que ese nombre se muda, y el PADRE ya se mudó de nombre una vez.
// ============================================================================

const RUTA = join(__dirname, '..', '..', '..', 'infra', 'nginx', 'space-os.io.conf')

/** Las líneas activas: sin comentarios `#` (enteros o al final de la línea). */
function activas(texto: string): string {
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, ''))
    .filter((l) => l.trim() !== '')
    .join('\n')
}

/** Los cuerpos de cada `server { ... }` de primer nivel, con llaves anidadas. */
function bloquesServer(texto: string): string[] {
  const bloques: string[] = []
  const re = /(^|\n)\s*server\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(texto)) !== null) {
    let i = m.index + m[0].length
    let prof = 1
    const inicio = i
    while (i < texto.length && prof > 0) {
      if (texto[i] === '{') prof++
      else if (texto[i] === '}') prof--
      i++
    }
    bloques.push(texto.slice(inicio, i - 1))
  }
  return bloques
}

const conf = activas(readFileSync(RUTA, 'utf8'))
const servers = bloquesServer(conf)
const catchAll80 = servers.filter((b) => /listen\s+80\s+default_server\s*;/.test(b))

describe('R6 · infra/nginx/space-os.io.conf — el catch-all del PADRE', () => {
  it('el archivo se lee y trae sus bloques `server` (si no, lo de abajo no mide nada)', () => {
    expect(servers.length).toBeGreaterThanOrEqual(6)
    expect(catchAll80).toHaveLength(1)
  })

  it('el catch-all del 80 NO redirige al ápice `space-os.io`, que ya es otra máquina', () => {
    expect(catchAll80[0]).not.toMatch(/return\s+30[1278]\s+https?:\/\/space-os\.io\b/)
  })

  it('ni a ningún otro nombre: un host desconocido se corta con 444', () => {
    expect(catchAll80[0]).not.toMatch(/return\s+30[1278]\b/)
    expect(catchAll80[0]).toMatch(/return\s+444\s*;/)
  })

  it('conserva el hueco de ACME, que va ANTES del corte', () => {
    expect(catchAll80[0]).toMatch(/location\s+\^~\s+\/\.well-known\/acme-challenge\//)
  })

  it('ningún bloque del archivo redirige a mano al ápice `space-os.io`', () => {
    // El HTTP→HTTPS de los nombres conocidos usa `$host`, que es lo correcto:
    // devuelve a cada uno a su propio nombre. Lo que no puede haber es el ápice
    // escrito a mano como destino.
    expect(conf).not.toMatch(/return\s+30[1278]\s+https?:\/\/space-os\.io\b/)
  })
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ============================================================================
//  La puerta de `release.yml`: no se publica una version sin sus notas.
// ----------------------------------------------------------------------------
//  Se prueba como PROCESO, igual que el runner de migraciones
//  (`migraciones.e2e.test.ts`): lo que corre en el CI es
//  `node scripts/verificar-novedades.mjs "$VERSION"`, y lo unico que mira el
//  `set -e` del paso es el codigo de salida. Probar las funciones sueltas no
//  diria si el script sale con 1 cuando tiene que salir con 1.
// ============================================================================

const SCRIPT = join(__dirname, 'verificar-novedades.mjs')
let dir: string

function archivo(nombre: string, contenido: unknown): string {
  const p = join(dir, nombre)
  writeFileSync(p, typeof contenido === 'string' ? contenido : JSON.stringify(contenido))
  return p
}

function correr(args: string[]) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })
  return { codigo: r.status, salida: `${r.stdout}${r.stderr}` }
}

const ENTRADA = { version: 'v0.9.2', fecha: '2026-10-01', items: [{ tipo: 'NUEVO', texto: 'Algo nuevo.' }] }

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'novedades-'))
})
afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('scripts/verificar-novedades.mjs', () => {
  it('sale con 0 si la version tiene su entrada', () => {
    const r = correr(['v0.9.2', '--archivo', archivo('ok.json', [ENTRADA])])
    expect(r.codigo).toBe(0)
    expect(r.salida).toContain('v0.9.2')
  })

  it('una precandidata (v0.9.2-rc1) pasa con la entrada de v0.9.2', () => {
    expect(correr(['v0.9.2-rc1', '--archivo', archivo('rc.json', [ENTRADA])]).codigo).toBe(0)
  })

  it('NEGATIVO: sin entrada para la version, sale con 1 y dice que falta y donde', () => {
    const r = correr(['v0.9.3', '--archivo', archivo('falta.json', [ENTRADA])])
    expect(r.codigo).toBe(1)
    expect(r.salida).toMatch(/v0\.9\.3/)
    // Nombra el archivo que hay que editar.
    expect(r.salida).toMatch(/falta\.json/)
  })

  it('NEGATIVO: un archivo invalido sale con 1 aunque la version este, y lista los errores', () => {
    const r = correr([
      'v0.9.2',
      '--archivo',
      archivo('malo.json', [{ ...ENTRADA, items: [{ tipo: 'OTRO', texto: '' }] }]),
    ])
    expect(r.codigo).toBe(1)
    expect(r.salida).toMatch(/tipo/)
    expect(r.salida).toMatch(/texto/)
  })

  it('NEGATIVO: un JSON roto sale con 1, no con una traza de node', () => {
    const r = correr(['v0.9.2', '--archivo', archivo('roto.json', '[{"version": ')])
    expect(r.codigo).toBe(1)
    expect(r.salida).toMatch(/no es JSON/i)
  })

  it('NEGATIVO: sin archivo sale con 1', () => {
    const r = correr(['v0.9.2', '--archivo', join(dir, 'no-existe.json')])
    expect(r.codigo).toBe(1)
    expect(r.salida).toMatch(/no se pudo leer/i)
  })

  it('NEGATIVO: una version que no es vX.Y.Z (o sin version) es un error de uso: sale con 2', () => {
    expect(correr(['estable', '--archivo', archivo('x.json', [ENTRADA])]).codigo).toBe(2)
    expect(correr([]).codigo).toBe(2)
  })

  it('release.yml lo corre con el tag, en el job de pruebas y ANTES del npm ci', () => {
    // Leer el workflow es lo unico que se puede hacer desde aqui: no se lanza
    // un run de GitHub en `npm test`. Pero atrapa los dos olvidos baratos:
    // quitar el paso, o moverlo detras de la suite (45 min para descubrir que
    // faltaba un parrafo).
    const yml = readFileSync(join(__dirname, '..', '.github', 'workflows', 'release.yml'), 'utf8')
    const paso = yml.indexOf('node scripts/verificar-novedades.mjs "$VERSION"')
    expect(paso, 'release.yml no corre verificar-novedades.mjs').toBeGreaterThan(-1)
    // La version entra como variable de entorno, nunca como `${{ }}` en el texto.
    const bloque = yml.slice(yml.lastIndexOf('- name:', paso), paso)
    expect(bloque).toMatch(/VERSION: \$\{\{ github\.ref_name \}\}/)
    // En el job `pruebas` (antes de `imagen:`) y antes del `npm ci`.
    const jobPruebas = yml.indexOf('\n  pruebas:')
    expect(paso).toBeGreaterThan(jobPruebas)
    expect(paso).toBeLessThan(yml.indexOf('\n  imagen:'))
    expect(paso).toBeLessThan(yml.indexOf('run: npm ci', jobPruebas))
  })

  it('sin --archivo lee el de verdad, apps/web/novedades.json, que trae v0.9.2', () => {
    expect(correr(['v0.9.2']).codigo).toBe(0)
    // Y el error, sin --archivo, nombra la ruta del repo con barras normales.
    expect(correr(['v99.0.0']).salida).toContain('apps/web/novedades.json')
  })
})

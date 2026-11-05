#!/usr/bin/env node
// ============================================================================
//  scripts/i18n-barrido-italiano.mjs — EL BARRIDO GLOBAL DEL HTML ITALIANO.
// ----------------------------------------------------------------------------
//  Pulido del italiano (2026-11-04). Dos pasos, los dos con vitest y sin
//  servidor ni base:
//
//    1. Corre TODAS las unitarias volcando el HTML: `I18N_VOLCAR_IT` (el espejo
//       italiano de cada estado ingles) e `I18N_VOLCAR_TODO` (todo, con los
//       estados italianos apuntados en `_italiano.txt`).
//    2. Barre ese HTML con `lib/i18n/barrido-italiano.test.ts`: frases
//       espanolas o inglesas del diccionario y huellas de formato. Lo que sale
//       y es a proposito esta en `A_PROPOSITO_IT` (`barrido-italiano.ts`), con
//       su porque; lo demas tumba la prueba.
//
//  Uso (desde la raiz o desde apps/web):
//    node scripts/i18n-barrido-italiano.mjs <carpeta-de-trabajo>
//    node scripts/i18n-barrido-italiano.mjs <carpeta> --sin-volcar   # reusa el volcado
//
//  Deja `<carpeta>/barrido.json` con el resumen y cada hallazgo.
// ============================================================================
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web')
const args = process.argv.slice(2)
const carpeta = args.find((a) => !a.startsWith('--'))
if (!carpeta) {
  console.error('Uso: node scripts/i18n-barrido-italiano.mjs <carpeta-de-trabajo> [--sin-volcar]')
  process.exit(2)
}
const raiz = path.resolve(carpeta)
const dirIt = path.join(raiz, 'it')
const dirTodo = path.join(raiz, 'todo')
const salida = path.join(raiz, 'barrido.json')

function vitest(env, archivos = []) {
  const r = spawnSync('npx', ['vitest', 'run', '--testTimeout=60000', ...archivos], {
    cwd: WEB,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  return r.status ?? 1
}

if (!args.includes('--sin-volcar')) {
  rmSync(dirIt, { recursive: true, force: true })
  rmSync(dirTodo, { recursive: true, force: true })
  mkdirSync(raiz, { recursive: true })
  const st = vitest({ I18N_VOLCAR_IT: dirIt, I18N_VOLCAR_TODO: dirTodo })
  if (st !== 0) {
    console.error('Las unitarias no pasaron: el volcado no es fiable.')
    process.exit(st)
  }
}
if (!existsSync(dirIt) || !existsSync(dirTodo)) {
  console.error(`No hay volcado en ${raiz}`)
  process.exit(2)
}
const st = vitest(
  { I18N_BARRIDO_IT: `${dirIt};${dirTodo}`, I18N_BARRIDO_SALIDA: salida },
  ['lib/i18n/barrido-italiano.test.ts'],
)
if (existsSync(salida)) {
  const { resumen, hallazgos } = JSON.parse(readFileSync(salida, 'utf8'))
  console.log('\nBarrido italiano:', resumen)
  const porMotivo = new Map()
  for (const h of hallazgos) {
    const k = h.aProposito ? `a proposito · ${h.aProposito.slice(0, 70)}` : `SIN DECLARAR · ${h.tipo}`
    porMotivo.set(k, (porMotivo.get(k) ?? 0) + 1)
  }
  for (const [k, n] of [...porMotivo].sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(5), k)
}
process.exit(st)

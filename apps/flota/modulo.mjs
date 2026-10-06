#!/usr/bin/env node
// ============================================================================
//  modulo.mjs — activar o desactivar un modulo vendido aparte (Space Eyes) en
//  una instancia, con UNA orden. (ADR 0041, etapa 4)
// ----------------------------------------------------------------------------
//    node modulo.mjs --instancia pixeled --activar space-eyes
//    node modulo.mjs --instancia pixeled --desactivar space-eyes
//
//  Toma la licencia VIGENTE de la instancia (la que el padre le entrega en
//  <dir>/<instancia>/), la vuelve a firmar con el modulo puesto o quitado y
//  todo lo demas igual (dominio, vencimiento, avisos), y deja una linea en la
//  bitacora de esa instancia: quien, cuando, que. La instancia la baja sola en
//  su siguiente corrida de update.sh (cada 15 minutos) y el modulo aparece o
//  vuelve a la demostracion. Desactivar NO borra equipos ni historial.
//
//  ─── Por que no es un boton del panel ─────────────────────────────────────
//  El panel no tiene credenciales a proposito (ADR 0027): un panel
//  comprometido solo puede escribir una solicitud. Firmar necesita la llave
//  privada y su frase de paso, asi que lo hace una persona con esta orden. El
//  panel muestra el estado de cada instancia y la orden exacta para cambiarlo.
// ============================================================================
import { createPrivateKey } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

import { MODULOS, NOMBRE_VALIDO_INSTANCIA, construirLicencia, firmar } from './licencia.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
export const DIR_LICENCIAS = process.env.FLOTA_DIR_LICENCIAS ?? join(AQUI, 'licencias')

/**
 * La licencia nueva a partir de la vigente: el mismo dominio, vencimiento y
 * avisos, con el modulo puesto o quitado y emitida hoy. Pura: se prueba sin
 * llaves ni frases.
 */
export function licenciaConModulo(jsonVigente, { modulo, activar, hoy }) {
  if (!MODULOS.includes(modulo)) throw new Error(`modulo desconocido: ${modulo} (hay: ${MODULOS.join(', ')})`)
  const v = JSON.parse(jsonVigente)
  const actuales = Array.isArray(v.modulos) ? v.modulos : []
  const modulos = activar ? [...actuales, modulo] : actuales.filter((m) => m !== modulo)
  return construirLicencia({
    instancia: v.instancia,
    dominio: v.dominio,
    vence: v.vence,
    avisoDias: v.aviso_dias,
    graciaDias: v.gracia_dias,
    emitida: hoy,
    modulos,
  })
}

/** Los modulos que tiene encendidos una instancia, segun su licencia en el padre. */
export function modulosDe(instancia, dir = DIR_LICENCIAS) {
  try {
    const l = JSON.parse(readFileSync(join(dir, instancia, 'licencia.json'), 'utf8'))
    return { licencia: true, modulos: Array.isArray(l.modulos) ? l.modulos : [] }
  } catch {
    return { licencia: false, modulos: [] }
  }
}

/** La orden exacta que el panel le muestra a quien administra. */
export const ordenPara = (instancia, modulo, activar) =>
  `node apps/flota/modulo.mjs --instancia ${instancia} --${activar ? 'activar' : 'desactivar'} ${modulo}`

function pedirFrase() {
  return new Promise((resolver) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = () => {}
    process.stdout.write('Frase de paso de la llave privada: ')
    rl.question('', (r) => {
      rl.close()
      process.stdout.write('\n')
      resolver(r)
    })
  })
}

async function principal() {
  const arg = (n, def) => {
    const i = process.argv.indexOf(`--${n}`)
    return i === -1 || i === process.argv.length - 1 ? def : process.argv[i + 1]
  }
  const instancia = arg('instancia')
  const activa = arg('activar')
  const desactiva = arg('desactivar')
  const modulo = activa || desactiva
  const dir = arg('dir', DIR_LICENCIAS)
  const rutaLlave = arg('llave', '/etc/space-os/llaves/space-os.key.pem')
  if (!instancia || !NOMBRE_VALIDO_INSTANCIA.test(instancia) || !modulo || (activa && desactiva)) {
    console.error('uso: modulo.mjs --instancia <n> (--activar|--desactivar) space-eyes [--dir <licencias>] [--llave <ruta>]')
    process.exit(64)
  }
  const carpeta = join(dir, instancia)
  const rutaJson = join(carpeta, 'licencia.json')
  if (!existsSync(rutaJson)) {
    console.error(`modulo: ${instancia} no tiene licencia en ${carpeta}. Firmala primero con firmar-licencia.mjs --salida ${carpeta}`)
    process.exit(66)
  }
  let json
  try {
    json = licenciaConModulo(readFileSync(rutaJson, 'utf8'), { modulo, activar: !!activa, hoy: new Date().toISOString().slice(0, 10) })
  } catch (e) {
    console.error(`modulo: ${e.message}`)
    process.exit(64)
  }
  if (json === readFileSync(rutaJson, 'utf8')) {
    console.log(`${instancia} ya ${activa ? 'tiene' : 'no tiene'} ${modulo}: nada que firmar.`)
    return
  }
  if (!existsSync(rutaLlave)) {
    console.error(`modulo: no existe la llave privada en ${rutaLlave}`)
    process.exit(66)
  }
  let llave
  try {
    llave = createPrivateKey({ key: readFileSync(rutaLlave, 'utf8'), format: 'pem', passphrase: await pedirFrase() })
  } catch {
    console.error(`modulo: no se pudo abrir la llave privada en ${rutaLlave}`)
    console.error('  o la frase de paso no es la correcta, o el archivo no es una llave.')
    process.exit(1)
  }
  // La firma primero y el JSON al final, cada uno por renombre: mientras tanto
  // la instancia baja una pareja que no valida y la descarta (sigue con la
  // suya), nunca una a medias.
  mkdirSync(carpeta, { recursive: true })
  writeFileSync(join(carpeta, '.licencia.firma.nueva'), firmar(json, llave))
  writeFileSync(join(carpeta, '.licencia.json.nueva'), json, 'utf8')
  renameSync(join(carpeta, '.licencia.firma.nueva'), join(carpeta, 'licencia.firma'))
  renameSync(join(carpeta, '.licencia.json.nueva'), join(carpeta, 'licencia.json'))
  const quien = process.env.SUDO_USER || process.env.USER || process.env.USERNAME || 'desconocido'
  appendFileSync(join(carpeta, 'bitacora.jsonl'),
    JSON.stringify({ cuando: new Date().toISOString(), quien, accion: activa ? 'activar' : 'desactivar', modulo }) + '\n')
  console.log(`\n${modulo} ${activa ? 'ACTIVADO' : 'DESACTIVADO'} para ${instancia}.`)
  console.log('La instancia baja la licencia nueva en su siguiente corrida de update.sh (15 min o menos).')
  if (!activa) console.log('Sus equipos y su historial NO se borran: vuelven a verse al activarlo de nuevo.')
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  principal().catch((e) => {
    console.error(`ERROR modulo: ${e?.message ?? e}`)
    process.exit(1)
  })
}

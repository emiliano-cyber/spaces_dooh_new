#!/usr/bin/env node
// ============================================================================
//  firmar-licencia.mjs — emitir o renovar la licencia de un hijo.
// ----------------------------------------------------------------------------
//  Lo corre UNA PERSONA en el PADRE. No entra en la maquina de estados
//  desatendida del ADR 0029, y la razon es la misma por la que su punto 5 dejo
//  fuera el bootstrap: firmar dice «este cliente pago, hasta esta fecha», y eso
//  es un acto comercial. Con licencias mensuales o anuales son un punado de
//  firmas al ano.
//
//  Uso:
//    node firmar-licencia.mjs --instancia pixeled \
//         --dominio pixeled.ejemplo.com --vence 2027-09-10
//
//  La frase de paso se pide por la TERMINAL y nunca por argumento: un argumento
//  acaba en el historial del shell y en `ps`.
// ============================================================================

import { createPrivateKey } from 'node:crypto'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

import { construirLicencia, firmar } from './licencia.mjs'

function argumento(nombre, porOmision = undefined) {
  const i = process.argv.indexOf(`--${nombre}`)
  if (i === -1 || i === process.argv.length - 1) return porOmision
  return process.argv[i + 1]
}

function hoyUTC() {
  return new Date().toISOString().slice(0, 10)
}

/** Lee la frase de paso sin hacerla eco en la pantalla. */
function pedirFrase() {
  return new Promise((resolver) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    // `_writeToOutput` vacio: readline sigue leyendo, pero no imprime nada. Sin
    // esto la frase queda en el scrollback de la terminal, que es casi tan malo
    // como tenerla en un archivo.
    rl._writeToOutput = () => {}
    process.stdout.write('Frase de paso de la llave privada: ')
    rl.question('', (respuesta) => {
      rl.close()
      process.stdout.write('\n')
      resolver(respuesta)
    })
  })
}

const instancia = argumento('instancia')
const dominio = argumento('dominio')
const vence = argumento('vence')
const avisoDias = Number(argumento('aviso-dias', '30'))
const graciaDias = Number(argumento('gracia-dias', '15'))
const rutaLlave = argumento('llave', '/etc/space-os/llaves/space-os.key.pem')
const salida = argumento('salida', '.')

if (!instancia || !dominio || !vence) {
  console.error('uso: firmar-licencia.mjs --instancia <n> --dominio <d> --vence <YYYY-MM-DD>')
  console.error('     [--aviso-dias 30] [--gracia-dias 15] [--llave <ruta>] [--salida <dir>]')
  process.exit(64)
}

// Se construye ANTES de pedir la frase de paso: si los datos estan mal, que
// falle sin haber descifrado nada.
let json
try {
  json = construirLicencia({
    instancia, dominio, vence, avisoDias, graciaDias, emitida: hoyUTC(),
  })
} catch (error) {
  console.error(`firmar-licencia: ${error.message}`)
  process.exit(64)
}

// Que la llave EXISTA se comprueba ANTES de pedir la frase de paso, y no es un
// detalle de comodidad. El mensaje de mas abajo es ambiguo a proposito --«o la
// frase no es la correcta, o el archivo no es una llave»-- para no ayudar a
// quien esta probando frases. Contra el operador, esa misma ambiguedad
// convierte un dedazo en `--llave` en un susto de credencial comprometida, a
// las dos de la manana y la primera vez que se usa esto. Una ruta que no existe
// no es un secreto para nadie: se dice claro y se para sin haber pedido nada.
if (!existsSync(rutaLlave)) {
  console.error(`firmar-licencia: no existe la llave privada en ${rutaLlave}`)
  console.error('  No es un problema de la frase de paso: el archivo no esta ahi.')
  console.error('  Revisa la ruta de `--llave` (por omision /etc/space-os/llaves/space-os.key.pem)')
  console.error('  o corre antes `docs/evidencias/llaves-de-licencia.txt`, que es quien la crea.')
  process.exit(66)
}

const frase = await pedirFrase()

let llavePrivada
try {
  llavePrivada = createPrivateKey({
    key: readFileSync(rutaLlave, 'utf8'),
    format: 'pem',
    passphrase: frase,
  })
} catch (error) {
  // Sin detalles del error: distinguir «frase mal» de «archivo corrupto» le da
  // informacion a quien esta probando frases.
  console.error(`firmar-licencia: no se pudo abrir la llave privada en ${rutaLlave}`)
  console.error('  o la frase de paso no es la correcta, o el archivo no es una llave.')
  process.exit(1)
}

mkdirSync(salida, { recursive: true })
const destinoJson = join(salida, 'licencia.json')
const destinoFirma = join(salida, 'licencia.firma')
writeFileSync(destinoJson, json, 'utf8')
writeFileSync(destinoFirma, firmar(json, llavePrivada))

const sha = (ruta) => createHash('sha256').update(readFileSync(ruta)).digest('hex')

console.log('')
console.log(json.trimEnd())
console.log('')
console.log(`  ${destinoJson}`)
console.log(`    sha256 ${sha(destinoJson)}`)
console.log(`  ${destinoFirma}`)
console.log(`    sha256 ${sha(destinoFirma)}`)
console.log('')
console.log('Los dos archivos van al hijo, a /etc/space-os/licencia/.')
console.log('Las sumas son para que quien los reciba compruebe que llegaron enteros.')

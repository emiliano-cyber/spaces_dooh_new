import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { NOMBRE_VALIDO_INSTANCIA, construirLicencia, firmar, verificar } from './licencia.mjs'

const par = () => generateKeyPairSync('ed25519')
const otro = () => generateKeyPairSync('ed25519')

const datos = {
  instancia: 'pixeled',
  dominio: 'pixeled.ejemplo.invalid',
  vence: '2027-01-01',
  avisoDias: 30,
  graciaDias: 15,
  emitida: '2026-09-10',
}

describe('construirLicencia', () => {
  it('produce un JSON legible por una persona', () => {
    const json = construirLicencia(datos)
    expect(JSON.parse(json)).toEqual({
      instancia: 'pixeled',
      dominio: 'pixeled.ejemplo.invalid',
      emitida: '2026-09-10',
      vence: '2027-01-01',
      aviso_dias: 30,
      gracia_dias: 15,
    })
    // Con saltos de linea dentro: el cliente puede abrirlo y leerlo. Un archivo
    // opaco no compraria nada -- lo que lo sujeta es la firma, no la ofuscacion.
    expect(json).toContain('\n')
  })

  // Los bytes firmados tienen que ser SIEMPRE los mismos para los mismos datos.
  // Si `construirLicencia` reordenara claves o cambiara el espaciado entre dos
  // corridas, la firma dejaria de validar sin que nadie hubiera tocado nada.
  it('es reproducible byte a byte', () => {
    expect(construirLicencia(datos)).toBe(construirLicencia({ ...datos }))
  })

  it('rechaza un nombre de instancia que el receptor no aceptaria', () => {
    expect(() => construirLicencia({ ...datos, instancia: 'Pixeled S.A.' })).toThrow()
    expect(NOMBRE_VALIDO_INSTANCIA.test('pixeled')).toBe(true)
    expect(NOMBRE_VALIDO_INSTANCIA.test('Pixeled')).toBe(false)
  })

  it('rechaza una fecha que no tiene forma de fecha', () => {
    expect(() => construirLicencia({ ...datos, vence: '01/01/2027' })).toThrow()
  })
})

describe('firmar y verificar', () => {
  it('ida y vuelta: lo que se firma, valida', () => {
    const { privateKey, publicKey } = par()
    const json = construirLicencia(datos)
    expect(verificar(json, firmar(json, privateKey), publicKey)).toBe(true)
  })

  // LOS TRES NEGATIVOS, que son la razon de que exista la firma.
  it('un solo caracter cambiado invalida la firma', () => {
    const { privateKey, publicKey } = par()
    const json = construirLicencia(datos)
    const f = firmar(json, privateKey)
    const manipulado = json.replace('2027-01-01', '2099-01-01')
    expect(verificar(manipulado, f, publicKey)).toBe(false)
  })

  it('cambiar la instancia invalida la firma: no se puede copiar a otra maquina', () => {
    const { privateKey, publicKey } = par()
    const json = construirLicencia(datos)
    const f = firmar(json, privateKey)
    expect(verificar(json.replace('pixeled', 'otracosa'), f, publicKey)).toBe(false)
  })

  it('otra llave no vale: firmarse una licencia uno mismo no funciona', () => {
    const mia = par()
    const suya = otro()
    const json = construirLicencia(datos)
    expect(verificar(json, firmar(json, suya.privateKey), mia.publicKey)).toBe(false)
  })

  it('una firma corrupta no revienta: devuelve false', () => {
    const { privateKey, publicKey } = par()
    const json = construirLicencia(datos)
    const f = Buffer.from(firmar(json, privateKey))
    f[0] = f[0] ^ 0xff
    expect(verificar(json, f, publicKey)).toBe(false)
    expect(verificar(json, Buffer.alloc(0), publicKey)).toBe(false)
  })
})

import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { NOMBRE_VALIDO_INSTANCIA, construirLicencia, firmar, leerModulos, verificar } from './licencia.mjs'

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

  // JavaScript desborda las fechas imposibles en vez de rechazarlas, asi que
  // `Date.parse` a secas no sirve de guard. Y esto importa porque la otra mitad
  // del mecanismo es `date -u -d` en bash, que SI las rechaza: una licencia con
  // una fecha asi apagaria la instancia de un cliente al corriente.
  it('una fecha que no existe en el calendario se rechaza, no se desborda', () => {
    expect(() => construirLicencia({ ...datos, vence: '2027-02-30' })).toThrow()
    expect(() => construirLicencia({ ...datos, vence: '2027-04-31' })).toThrow()
    expect(() => construirLicencia({ ...datos, vence: '2026-02-29' })).toThrow()
    // Y el 29 de febrero de un bisiesto de verdad SI se acepta.
    expect(() => construirLicencia({ ...datos, vence: '2028-02-29' })).not.toThrow()
  })
})

describe('modulos vendidos aparte (Space Eyes)', () => {
  it('sin decir modulos, la licencia queda byte a byte como las de antes', () => {
    // Las licencias ya firmadas no traen `modulos`: si este cambio alterara sus
    // bytes, todas dejarian de validar y se apagarian instancias al corriente.
    expect(construirLicencia(datos)).not.toContain('modulos')
    expect(construirLicencia({ ...datos, modulos: undefined })).toBe(construirLicencia(datos))
  })

  // Sin el campo, la licencia NO decide (manda la configuracion, como antes de
  // la etapa 4). Por eso apagar tiene que escribirse: `modulos: []` es «firmado
  // sin Space Eyes», y no puede confundirse con una licencia de antes.
  it('una lista vacia se firma tal cual: es apagar, no «como antes»', () => {
    const json = construirLicencia({ ...datos, modulos: [] })
    expect(JSON.parse(json).modulos).toEqual([])
    expect(json).not.toBe(construirLicencia(datos))
  })

  it('con Space Eyes, lo lleva al final, ordenado y sin repetir', () => {
    const json = construirLicencia({ ...datos, modulos: ['space-eyes', 'space-eyes'] })
    expect(JSON.parse(json).modulos).toEqual(['space-eyes'])
    expect(Object.keys(JSON.parse(json)).at(-1)).toBe('modulos')
  })

  it('un modulo que no existe se rechaza al firmar', () => {
    expect(() => construirLicencia({ ...datos, modulos: ['spaceyes'] })).toThrow(/solo puede llevar/)
  })

  it('agregar o quitar un modulo invalida la firma anterior', () => {
    const { privateKey, publicKey } = par()
    const sin = construirLicencia(datos)
    const con = construirLicencia({ ...datos, modulos: ['space-eyes'] })
    expect(verificar(con, firmar(sin, privateKey), publicKey)).toBe(false)
    expect(verificar(con, firmar(con, privateKey), publicKey)).toBe(true)
  })
})

describe('leerModulos (--modulos de firmar-licencia)', () => {
  it('sin la bandera: la licencia no dice nada de modulos', () => {
    expect(leerModulos(undefined)).toBeUndefined()
  })
  it('«ninguno» firma el modulo apagado', () => {
    expect(leerModulos('ninguno')).toEqual([])
  })
  it('una lista separada por comas', () => {
    expect(leerModulos(' space-eyes , ')).toEqual(['space-eyes'])
  })
  it('vacia es un error, no un apagado por accidente', () => {
    expect(() => leerModulos('')).toThrow(/ninguno/)
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

import { describe, it, expect } from 'vitest'
import { etiquetaDeHost } from './host'

// ============================================================================
//  F1.4 del plan de instancias soberanas: entrar por la IP desnuda del droplet
//  (209.97.146.136) hacía que el middleware creyera ver el subdominio «209» y
//  reescribiera la ruta. La única razón de que no rompiera nada es que «209» no
//  está en el moduleMap; el día que alguien añada un módulo llamado como el
//  primer octeto de una IP, la app cambia de ruta sola.
// ============================================================================

describe('etiquetaDeHost', () => {
  it('una IPv4 desnuda no es un subdominio (el caso del informe)', () => {
    expect(etiquetaDeHost('209.97.146.136')).toBe(null)
  })

  it('el loopback con puerto tampoco', () => {
    expect(etiquetaDeHost('127.0.0.1:3000')).toBe(null)
  })

  it('un host con subdominio de verdad sí lo devuelve', () => {
    expect(etiquetaDeHost('portal.space-os.pixeled.com.mx')).toBe('portal')
  })

  it('el dominio raíz no tiene etiqueta que devolver', () => {
    expect(etiquetaDeHost('space-os.io')).toBe(null)
  })

  it('localhost no tiene puntos: no hay subdominio', () => {
    expect(etiquetaDeHost('localhost:3000')).toBe(null)
  })

  // El criterio de aceptación exige que NADA cambie para el host de DEMO.
  it('demo.space-os.io sigue devolviendo su etiqueta, como hoy', () => {
    expect(etiquetaDeHost('demo.space-os.io')).toBe('demo')
  })

  it('IPv6 literal entre corchetes tampoco es un subdominio', () => {
    expect(etiquetaDeHost('[::1]:3000')).toBe(null)
    expect(etiquetaDeHost('[2001:db8::1]')).toBe(null)
  })

  it('un host vacío o basura no revienta: devuelve null', () => {
    expect(etiquetaDeHost('')).toBe(null)
    expect(etiquetaDeHost('...')).toBe(null)
  })

  it('el puerto no altera la etiqueta y las mayúsculas no cuentan', () => {
    expect(etiquetaDeHost('Portal.space-os.io:3311')).toBe('portal')
  })
})

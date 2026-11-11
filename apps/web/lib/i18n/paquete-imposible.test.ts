import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DescuentoSobreTope } from '@/lib/descuento'
import { traducirError, PATRONES_ERROR } from './errores-servidor'

// ============================================================================
//  Ola 7 · `PaqueteImposible` al QUITAR un paquete (`paquetes-repo.ts`).
// ----------------------------------------------------------------------------
//  El servidor envuelve el mensaje del tope (`DescuentoSobreTope`) dentro de su
//  propia frase. La frase de fuera va por un patron; la de dentro, por los
//  patrones del tope que ya existian (ola 6). En espanol, la misma frase.
// ============================================================================

// La frase EXACTA que arma `quitarPaquete`, con el mensaje del tope dentro.
// La prueba de abajo la ata al literal del repo.
const envolver = (nombre: string, tope: string) =>
  `No se puede quitar el paquete "${nombre}": sin el paquete vuelve a ` +
  `aplicarse el descuento por volumen de las lineas. ${tope} ` +
  'Baja primero el descuento comercial y vuelve a quitar el paquete.'

const SIN_VOLUMEN = new DescuentoSobreTope(30, 20, 0).message
const CON_VOLUMEN = new DescuentoSobreTope(12.5, 20, 10).message
const VOLUMEN_SOBRE_TOPE = new DescuentoSobreTope(5, 8, 10).message

describe('paquete imposible · al quitar un paquete, en ingles por patron', () => {
  it('la frase de fuera se ata al literal de `paquetes-repo.ts`', () => {
    const fuente = readFileSync(join(process.cwd(), 'lib/server/paquetes-repo.ts'), 'utf8')
    expect(fuente).toContain('`No se puede quitar el paquete "${prop.paquete_nombre}": sin el paquete vuelve a ` +')
    expect(fuente).toContain('`aplicarse el descuento por volumen de las lineas. ${e.message} ` +')
    expect(fuente).toContain("'Baja primero el descuento comercial y vuelve a quitar el paquete.',")
  })

  it('sin volumen: la frase de fuera y la del tope, las dos en ingles', () => {
    expect(traducirError(envolver('Verano 5 pantallas', SIN_VOLUMEN), 'en')).toBe(
      'The bundle “Verano 5 pantallas” can’t be removed: without the bundle, the volume discount of the lines applies again. ' +
        'The maximum discount your organization allows is 20%, and 30% was requested. The commercial discount can go up to 20%. ' +
        'Ask an admin to raise it in Settings if needed. ' +
        'Lower the commercial discount first, then remove the bundle again.',
    )
  })

  it('con volumen: la cuenta del tope, en ingles dentro de la frase', () => {
    const en = traducirError(envolver('P', CON_VOLUMEN), 'en')
    expect(en).toContain('This proposal already has a 10% volume discount, so a 12.5% commercial discount leaves 21.25% in total')
    expect(en).toMatch(/^The bundle “P” can’t be removed: /)
    expect(en).toMatch(/Lower the commercial discount first, then remove the bundle again\.$/)
  })

  it('el volumen solo ya pasa el tope', () => {
    const en = traducirError(envolver('P', VOLUMEN_SOBRE_TOPE), 'en')
    expect(en).toContain('The volume discount (10%) is already over the cap (8%)')
  })

  it('en ingles no queda ni una palabra del espanol', () => {
    for (const tope of [SIN_VOLUMEN, CON_VOLUMEN, VOLUMEN_SOBRE_TOPE]) {
      const en = traducirError(envolver('Paquete Norte', tope), 'en')
      expect(en.replace('Paquete Norte', '')).not.toMatch(/descuento|paquete|tope|Administración|Baja|líneas|lineas| % /)
    }
  })

  it('el nombre del paquete es dato: con comillas o «$1» dentro, sale tal cual', () => {
    expect(traducirError(envolver('Combo "VIP" $1', SIN_VOLUMEN), 'en')).toMatch(/^The bundle “Combo "VIP" \$1” can’t be removed: /)
  })

  it('un tope que no se reconoce se queda en espanol, pero solo esa pieza', () => {
    const en = traducirError(envolver('P', 'Frase libre.'), 'en')
    expect(en).toContain(' Frase libre. ')
    expect(en).toMatch(/^The bundle “P” can’t be removed: /)
  })

  it('en espanol devuelve el mensaje tal cual', () => {
    for (const tope of [SIN_VOLUMEN, CON_VOLUMEN, VOLUMEN_SOBRE_TOPE]) {
      const m = envolver('Paquete Norte', tope)
      expect(traducirError(m, 'es')).toBe(m)
    }
  })

  it('el patron nuevo no casa con ningun otro patron (no se pisa con la frase del tope sola)', () => {
    const solo = PATRONES_ERROR.filter((p) => p.re.test(SIN_VOLUMEN))
    expect(solo).toHaveLength(1)
  })
})

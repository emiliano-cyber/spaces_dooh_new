import { describe, it, expect } from 'vitest'
import type { Idioma } from './i18n/idiomas'
import { leerCifra, type OpcionesCifra } from './captura-cifra'
import { parcheSlots, valorCampoSlots, slotsIlegibles, type SlotsEnFormulario } from './slots-reserva'
import { sesionCampoCifra, azarConSemilla } from './test/sesion-campo-cifra'

// ============================================================================
//  B93 (05/11) · el gemelo de H1 en la RESERVA de pantallas digitales: cuántos
//  slots se reservan en cada pantalla. `ReservaDialog` convertía lo que no se
//  entendía en 0 (`Number(crudo) || 0`) y el campo repintaba ese 0 a media
//  escritura, igual que la cantidad de la propuesta repintaba la última buena:
//  el separador desaparecía y las cifras siguientes se pegaban al 0. No es
//  dinero, pero sí inventario: se reservaban otros slots que los tecleados.
//
//  Lo que sigue igual, y a propósito: una cifra VÁLIDA por encima de los
//  disponibles se acota a ellos y el campo lo repinta (lo dice su comentario
//  en CampoCifra.tsx: «la reserva no pasa de los slots libres»).
//
//  Sin DOM: el bucle lo reproduce `lib/test/sesion-campo-cifra.ts`.
// ============================================================================

const opcionesDe = (idioma: Idioma): OpcionesCifra => ({ decimales: 0, minimo: 0, idioma })

const sesion = (idioma: Idioma, disp: number, inicial = disp) =>
  sesionCampoCifra<SlotsEnFormulario>(idioma, opcionesDe(idioma), {
    inicial: { slots: inicial },
    alCambiar: (form, lectura) => ({ ...form, ...parcheSlots(lectura, disp) }),
    valor: valorCampoSlots,
  })

describe('slots de la reserva · lo tecleado es lo que se reserva, o no se reserva', () => {
  it('5 de 12: se teclea 5 y se reservan 5 (lo que ya funcionaba)', () => {
    const s = sesion('es', 12).reemplazar('5').salir()
    expect(s.form.slots).toBe(5)
    expect(slotsIlegibles(s.form)).toBe(false)
  })

  it('lo válido por encima de los disponibles se sigue acotando y se ve: 15 de 12 → 12', () => {
    const s = sesion('es', 12).reemplazar('15').salir()
    expect(s.form.slots).toBe(12)
    expect(s.texto).toBe('12')
    expect(slotsIlegibles(s.form)).toBe(false)
  })

  for (const [idioma, tecleado] of [
    ['es', '1.5'],
    ['es', '2.0'],
    ['en', '1.5'],
    ['it', '1,5'],
    ['it', '2.5'],
  ] as [Idioma, string][]) {
    it(`NEGATIVO · ${idioma} «${tecleado}» queda ILEGIBLE: no se reservan otros slots y el campo no se lo come`, () => {
      const s = sesion(idioma, 6000).reemplazar(tecleado)
      expect(s.repintadosSobreIlegible).toBe(0)
      expect(s.texto).toBe(tecleado)
      expect(slotsIlegibles(s.form)).toBe(true)
      s.salir()
      expect(s.texto).toBe(tecleado)
      expect(slotsIlegibles(s.form)).toBe(true)
    })
  }

  it('NEGATIVO · borrar para teclear otra cifra: 6 → borrar → 4 da 4, no 04 ni 0', () => {
    const s = sesion('es', 12, 6).borrar().teclear('4').salir()
    expect(s.repintadosSobreIlegible).toBe(0)
    expect(s.form.slots).toBe(4)
    expect(s.texto).toBe('4')
  })

  it('el campo vacío al salir no reserva 0 en silencio: queda pendiente y bloquea', () => {
    const s = sesion('es', 12, 6).borrar().salir()
    expect(s.texto).toBe('')
    expect(slotsIlegibles(s.form)).toBe(true)
  })

  it('0 tecleado a propósito es válido: no se reserva ningún slot en esa pantalla', () => {
    const s = sesion('es', 12, 6).reemplazar('0').salir()
    expect(s.form.slots).toBe(0)
    expect(slotsIlegibles(s.form)).toBe(false)
  })

  it('NEGATIVO · 3000 sesiones al azar por idioma: nunca se come lo tecleado y lo reservado es lo que se ve', () => {
    const azar = azarConSemilla()
    const teclas = '0123456789.,'
    for (const idioma of ['es', 'en', 'it'] as Idioma[]) {
      for (let k = 0; k < 3000; k++) {
        const disp = 1 + azar(5000)
        const s = sesion(idioma, disp, azar(disp + 1))
        const pasos = 1 + azar(9)
        for (let p = 0; p < pasos; p++) {
          if (azar(6) === 0) s.borrar()
          else s.teclear(teclas[azar(teclas.length)])
        }
        expect(s.repintadosSobreIlegible).toBe(0)
        s.salir()
        const lectura = leerCifra(s.texto, opcionesDe(idioma))
        if (lectura.ok && lectura.valor != null) {
          expect(slotsIlegibles(s.form)).toBe(false)
          expect(s.form.slots).toBe(Math.min(disp, lectura.valor))
        } else {
          expect(slotsIlegibles(s.form)).toBe(true)
        }
      }
    }
  })
})

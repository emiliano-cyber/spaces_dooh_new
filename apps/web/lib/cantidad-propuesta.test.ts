import { describe, it, expect } from 'vitest'
import type { Idioma } from './i18n/idiomas'
import { leerCifra, type OpcionesCifra } from './captura-cifra'
import { parcheCantidad, valorCampoCantidad, cantidadIlegible, type CantidadEnFormulario } from './cantidad-propuesta'
import { sesionCampoCifra, azarConSemilla } from './test/sesion-campo-cifra'

// ============================================================================
//  H1 (validación de las cifras del portugués, 05/11) · DINERO, en la v0.12.6
//  publicada. En la cantidad manual de una línea de propuesta, «1.500»
//  tecleado en español se guardaba como 100, y en italiano «1,500» como 100,
//  «2.5» como 25 y «1.5000» como 15 000, sin aviso: el campo va con
//  `mostrarError={false}`. Es la cantidad que multiplica la tarifa; en CPM, un
//  ×10 cobra diez veces más.
//
//  El mecanismo: el formulario se quedaba con el ÚLTIMO VALOR VÁLIDO cuando lo
//  tecleado no se entendía, en vez de guardar «ilegible» como pide el contrato
//  de `CampoCifra` (CampoCifra.tsx:28-33). El campo, al ver que el formulario
//  guarda otra cosa, repinta ESE valor a mitad del tecleo; el separador
//  desaparece y las cifras siguientes se pegan a lo de antes.
//
//  Sin DOM: el bucle campo↔formulario lo reproduce `lib/test/sesion-campo-cifra.ts`
//  con las funciones REALES de `captura-cifra.ts`.
// ============================================================================

const opcionesDe = (idioma: Idioma): OpcionesCifra => ({ decimales: 0, minimo: 0, idioma })

// El formulario de la propuesta, tal como lo conecta `propuestas/page.tsx`.
const sesion = (idioma: Idioma, inicial = 1) =>
  sesionCampoCifra<CantidadEnFormulario>(idioma, opcionesDe(idioma), {
    inicial: { cantidadManual: inicial },
    alCambiar: (form, lectura) => ({ ...form, ...parcheCantidad(lectura) }),
    valor: valorCampoCantidad,
  })

describe('cantidad manual de la propuesta · lo tecleado es lo que se guarda, o no se guarda', () => {
  it('es · «1,500» guarda 1500 (lo que ya funcionaba)', () => {
    const s = sesion('es').reemplazar('1,500').salir()
    expect(s.form.cantidadManual).toBe(1500)
    expect(cantidadIlegible(s.form)).toBe(false)
    expect(s.texto).toBe('1,500')
  })

  it('it · «1.500» guarda 1500 (lo que ya funcionaba)', () => {
    const s = sesion('it').reemplazar('1.500').salir()
    expect(s.form.cantidadManual).toBe(1500)
    expect(cantidadIlegible(s.form)).toBe(false)
  })

  // Los casos de H1, uno por uno. Antes: es «1.500» → 100; it «1,500» → 100,
  // «2.5» → 25, «1.5000» → 15000. Ahora: ilegible, el formulario no guarda y
  // el campo enseña lo tecleado tal cual.
  for (const [idioma, tecleado] of [
    ['es', '1.500'],
    ['en', '1.500'],
    ['es', '2.5'],
    ['es', '1,5000'],
    ['it', '1,500'],
    ['it', '2.5'],
    ['it', '1.5000'],
  ] as [Idioma, string][]) {
    it(`NEGATIVO · ${idioma} «${tecleado}» queda ILEGIBLE: no se guarda otra cantidad y el campo no se lo come`, () => {
      const s = sesion(idioma).reemplazar(tecleado)
      expect(s.repintadosSobreIlegible).toBe(0)
      expect(s.texto).toBe(tecleado)
      expect(cantidadIlegible(s.form)).toBe(true)
      s.salir()
      // Al salir tampoco se repinta la cantidad de antes: se queda lo tecleado,
      // en rojo, y el botón de guardar bloqueado (`errCifras`).
      expect(s.texto).toBe(tecleado)
      expect(cantidadIlegible(s.form)).toBe(true)
    })
  }

  it('NEGATIVO · borrar la cantidad para teclear otra: 5 → borrar → 8 da 8, no 58', () => {
    const s = sesion('es', 5).borrar().teclear('8')
    expect(s.repintadosSobreIlegible).toBe(0)
    expect(s.texto).toBe('8')
    expect(s.form.cantidadManual).toBe(8)
    expect(cantidadIlegible(s.form)).toBe(false)
  })

  it('corregir lo ilegible lo desbloquea: es «1.500» → borrar 4 → «,500» guarda 1500', () => {
    const s = sesion('es').reemplazar('1.500').borrar(4).teclear(',500').salir()
    expect(s.form.cantidadManual).toBe(1500)
    expect(cantidadIlegible(s.form)).toBe(false)
    expect(s.texto).toBe('1,500')
  })

  it('un 0 válido se sigue subiendo a 1, y eso sí se repinta (es la cantidad mínima)', () => {
    const s = sesion('es', 5).reemplazar('0').salir()
    expect(s.form.cantidadManual).toBe(1)
    expect(s.texto).toBe('1')
  })

  it('el campo vacío al salir no se guarda como nada: queda ilegible y bloquea', () => {
    const s = sesion('es', 5).borrar().salir()
    expect(s.texto).toBe('')
    expect(cantidadIlegible(s.form)).toBe(true)
  })

  // Lo general, con sesiones al azar (semilla fija): EN NINGÚN idioma el campo
  // repinta a mitad de tecleo la cantidad guardada encima de algo ilegible, y
  // al salir lo que se ve y lo que se guarda son la misma cifra, o el
  // formulario está bloqueado.
  it('NEGATIVO · 3000 sesiones al azar por idioma: nunca se come lo tecleado y lo guardado es lo que se ve', () => {
    const azar = azarConSemilla()
    const teclas = '0123456789.,'
    for (const idioma of ['es', 'en', 'it'] as Idioma[]) {
      for (let k = 0; k < 3000; k++) {
        const s = sesion(idioma, 1 + azar(20))
        const pasos = 1 + azar(9)
        for (let p = 0; p < pasos; p++) {
          if (azar(6) === 0) s.borrar()
          else s.teclear(teclas[azar(teclas.length)])
        }
        expect(s.repintadosSobreIlegible).toBe(0)
        s.salir()
        const lectura = leerCifra(s.texto, opcionesDe(idioma))
        // Vacío (`ok` con valor null) bloquea igual que lo ilegible.
        if (lectura.ok && lectura.valor != null) {
          expect(cantidadIlegible(s.form)).toBe(false)
          expect(s.form.cantidadManual).toBe(Math.max(1, lectura.valor))
        } else {
          expect(cantidadIlegible(s.form)).toBe(true)
        }
      }
    }
  })
})

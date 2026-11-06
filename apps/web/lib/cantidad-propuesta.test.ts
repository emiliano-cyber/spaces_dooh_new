import { describe, it, expect } from 'vitest'
import type { Idioma } from './i18n/idiomas'
import {
  leerCifra,
  crudoDeLectura,
  pintarCrudo,
  teclearCifra,
  cifraAMedias,
  textoAlSalir,
  type OpcionesCifra,
} from './captura-cifra'
import { parcheCantidad, valorCampoCantidad, cantidadIlegible, type CantidadEnFormulario } from './cantidad-propuesta'

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
//  No hay DOM en las pruebas (vitest.config.ts), así que `sesion` reproduce el
//  bucle campo↔formulario con las funciones REALES de `captura-cifra.ts`, en el
//  orden de `CampoCifra.tsx`: `onChange` (teclearCifra → leerCifra → onCambio),
//  y el efecto de resincronización (`:138-147`). Si ese efecto cambia, este
//  espejo tiene que cambiar con él.
// ============================================================================

const opcionesDe = (idioma: Idioma): OpcionesCifra => ({ decimales: 0, minimo: 0, idioma })

function aCrudo(v: string | number): string {
  return typeof v === 'number' ? String(v) : v
}

function sesion(idioma: Idioma, inicial = 1) {
  const opc = opcionesDe(idioma)
  let form: CantidadEnFormulario = { cantidadManual: inicial }
  let texto = pintarCrudo(aCrudo(valorCampoCantidad(form)), idioma).texto
  let comasPropias = false
  let escribiendo = false
  let ultimoEmitido = aCrudo(valorCampoCantidad(form))
  // Cuántas veces el campo repintó a mitad de tecleo lo que guardaba el
  // formulario EN VEZ de lo que la persona acababa de teclear.
  let repintadosSobreIlegible = 0

  const efecto = () => {
    const crudoProp = aCrudo(valorCampoCantidad(form))
    const aMedias = escribiendo && cifraAMedias(texto, idioma)
    if (crudoProp !== ultimoEmitido && !aMedias) {
      if (escribiendo && !leerCifra(texto, opc).ok) repintadosSobreIlegible++
      ultimoEmitido = crudoProp
      texto = pintarCrudo(crudoProp, idioma).texto
      comasPropias = false
    }
  }
  const cambio = (nuevo: string, tipoEntrada: string) => {
    const r = teclearCifra({ texto, comasPropias }, { nuevo, cursor: nuevo.length, tipoEntrada }, idioma)
    texto = r.texto
    comasPropias = r.comasPropias
    escribiendo = true
    const lectura = leerCifra(texto, opc)
    ultimoEmitido = crudoDeLectura(lectura)
    form = { ...form, ...parcheCantidad(lectura) }
    efecto()
  }

  const api = {
    teclear(s: string) {
      for (const ch of s) cambio(texto + ch, 'insertText')
      return api
    },
    // Seleccionar todo y teclear encima: la primera tecla sustituye el texto.
    reemplazar(s: string) {
      const [primera, ...resto] = [...s]
      cambio(primera, 'insertText')
      for (const ch of resto) cambio(texto + ch, 'insertText')
      return api
    },
    borrar(n = 1) {
      for (let i = 0; i < n; i++) cambio(texto.slice(0, -1), 'deleteContentBackward')
      return api
    },
    salir() {
      texto = textoAlSalir(texto, opc)
      escribiendo = false
      efecto()
      return api
    },
    get texto() {
      return texto
    },
    get form() {
      return form
    },
    get repintadosSobreIlegible() {
      return repintadosSobreIlegible
    },
  }
  return api
}

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
    let x = 0x5eed2611
    const azar = (n: number) => {
      x ^= x << 13
      x >>>= 0
      x ^= x >>> 17
      x ^= x << 5
      x >>>= 0
      return x % n
    }
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

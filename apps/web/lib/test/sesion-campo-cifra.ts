import type { Idioma } from '../i18n/idiomas'
import {
  leerCifra,
  crudoDeLectura,
  pintarCrudo,
  teclearCifra,
  cifraAMedias,
  textoAlSalir,
  type LecturaCifra,
  type OpcionesCifra,
} from '../captura-cifra'

// ============================================================================
//  El bucle `CampoCifra` ↔ formulario, tecla a tecla y SIN DOM.
// ----------------------------------------------------------------------------
//  No hay DOM en las pruebas (vitest.config.ts). Esto reproduce lo que hace
//  `components/demo/ui/CampoCifra.tsx` con las funciones REALES de
//  `captura-cifra.ts` y en su orden: `onChange` (teclearCifra → leerCifra →
//  onCambio del formulario) y el efecto de resincronización (`:138-147`), que
//  repinta lo que guarda el formulario si no coincide con lo que el campo
//  emitió. Si ese efecto cambia, este espejo tiene que cambiar con él.
//
//  Nació con H1 (05/11, DINERO): un formulario que se queda con el último
//  valor válido hace que el campo repinte ESE valor a media escritura y el
//  separador desaparezca («1.500» → 100). `repintadosSobreIlegible` cuenta
//  justo eso: las veces que el campo pisó lo tecleado por la persona.
// ============================================================================

export interface FormularioDeCifra<F> {
  inicial: F
  /** Lo que el formulario guarda al recibir una lectura (su `onCambio`). */
  alCambiar: (form: F, lectura: LecturaCifra, crudo: string) => F
  /** Lo que el formulario le pasa al campo como `valor`. */
  valor: (form: F) => string | number
}

function aCrudo(v: string | number): string {
  return typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : v
}

export function sesionCampoCifra<F>(idioma: Idioma, opc: OpcionesCifra, f: FormularioDeCifra<F>) {
  let form = f.inicial
  let texto = pintarCrudo(aCrudo(f.valor(form)), idioma).texto
  let comasPropias = false
  let escribiendo = false
  let ultimoEmitido = aCrudo(f.valor(form))
  let repintadosSobreIlegible = 0

  const efecto = () => {
    const crudoProp = aCrudo(f.valor(form))
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
    form = f.alCambiar(form, lectura, ultimoEmitido)
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

/** Generador xorshift32 con semilla fija, para las sesiones al azar. */
export function azarConSemilla(semilla = 0x5eed2611) {
  let x = semilla >>> 0
  return (n: number) => {
    x ^= x << 13
    x >>>= 0
    x ^= x >>> 17
    x ^= x << 5
    x >>>= 0
    return x % n
  }
}

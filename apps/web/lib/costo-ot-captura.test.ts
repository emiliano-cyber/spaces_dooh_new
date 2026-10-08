import { describe, it, expect } from 'vitest'
import { leerCostoOt, hayQueGuardarCosto, textoDeCosto, avisoAntesDeCerrar, textoCostoDeCerrada } from './costo-ot-captura'

// ============================================================================
//  OT-COSTO-01 · lo que el campo «Costo real» de la OT entiende de lo tecleado.
// ----------------------------------------------------------------------------
//  Vive FUERA del `.tsx` a propósito, y no es estilo: `vitest.config.ts` no
//  monta jsdom, así que **una decisión escrita dentro de un componente no la
//  prueba nadie**. Este repositorio ya pagó ese defecto con el tono de los
//  avisos del reporte (`tabla.ts`), que vivía en el `.tsx` hasta el 18/09.
//
//  Y aquí lo que se decide es dinero: si el campo vacío significa «cero» o
//  «bórralo», y si un guion o una coma se convierten en un número. Las dos
//  preguntas tienen una respuesta equivocada que no da ningún error.
// ============================================================================

describe('leerCostoOt · del texto tecleado al importe', () => {
  it('un número normal se lee', () => {
    expect(leerCostoOt('12000')).toEqual({ ok: true, valor: 12000 })
  })

  it('acepta decimales y espacios alrededor', () => {
    expect(leerCostoOt('  1250.50  ')).toEqual({ ok: true, valor: 1250.5 })
  })

  it('CERO se lee como cero, no como vacío', () => {
    // Una inspección que hace el propio dueño no paga cuadrilla, y eso es un
    // dato real que el usuario quiere capturar.
    expect(leerCostoOt('0')).toEqual({ ok: true, valor: 0 })
  })

  it('VACÍO significa BORRAR el costo, no cero', () => {
    // La distinción entera del cambio. Si el vacío fuera 0, dejar el campo en
    // blanco afirmaría que la visita fue gratis y el reporte dejaría de usar la
    // estimación por tipo — bajando el costo de operación sin que nadie lo
    // pidiera.
    expect(leerCostoOt('')).toEqual({ ok: true, valor: null })
    expect(leerCostoOt('   ')).toEqual({ ok: true, valor: null })
  })

  it('NEGATIVO · un importe negativo se rechaza con un motivo legible', () => {
    const r = leerCostoOt('-500')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/negativ/i)
  })

  it('NEGATIVO · lo que no es un número se rechaza', () => {
    // '1,5' sigue fuera también desde el 08/10: es una coma MAL puesta (¿1.5 o
    // 15?), y eso no se adivina.
    for (const basura of ['abc', '12a', '--', '1,5', '1 200', '0x10', '2.500,50']) {
      expect(leerCostoOt(basura).ok, basura).toBe(false)
    }
  })

  it('la coma de miles BIEN puesta se acepta (fase 2, 08/10)', () => {
    // Hasta el 08/10 se rechazaba porque la pantalla no la producía. Ahora el
    // campo pinta 12,000 mientras se teclea, así que la regla tiene que
    // entender lo que la propia pantalla enseña.
    expect(leerCostoOt('12,000')).toEqual({ ok: true, valor: 12000 })
    expect(leerCostoOt('$ 1,250.50')).toEqual({ ok: true, valor: 1250.5 })
  })

  it('NEGATIVO · «2.500» no se lee como 2,500 ni se guarda como 2.5 en silencio', () => {
    const r = leerCostoOt('2.500')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/punto es decimal/i)
  })

  it('NEGATIVO · `Infinity` y notación rara no pasan', () => {
    expect(leerCostoOt('Infinity').ok).toBe(false)
    expect(leerCostoOt('1e999').ok).toBe(false)
  })
})

describe('hayQueGuardarCosto · no se manda lo que no cambió', () => {
  it('teclear lo mismo que ya había no manda nada', () => {
    // Sin esto, abrir la OT y cerrarla escribiría en la bitácora un cambio de
    // dinero que nadie hizo, y pediría la contraseña del candado por nada.
    expect(hayQueGuardarCosto(12000, 12000)).toBe(false)
    expect(hayQueGuardarCosto(null, null)).toBe(false)
  })

  it('pasar de sin capturar a un importe SÍ se manda', () => {
    expect(hayQueGuardarCosto(null, 12000)).toBe(true)
  })

  it('pasar de un importe a CERO se manda — no es «sin cambios»', () => {
    // El caso que un `!nuevo` rompería en silencio.
    expect(hayQueGuardarCosto(12000, 0)).toBe(true)
  })

  it('BORRAR un importe capturado se manda', () => {
    expect(hayQueGuardarCosto(12000, null)).toBe(true)
  })

  it('cero contra cero no se manda', () => {
    expect(hayQueGuardarCosto(0, 0)).toBe(false)
  })

  it('NEGATIVO · cero y «sin capturar» NO son lo mismo', () => {
    // Si se confundieran, borrar un costo de cero no haría nada y la visita se
    // quedaría afirmando que fue gratis para siempre.
    expect(hayQueGuardarCosto(0, null)).toBe(true)
    expect(hayQueGuardarCosto(null, 0)).toBe(true)
  })
})

describe('textoDeCosto · lo que se precarga en el campo', () => {
  it('sin capturar, el campo arranca VACÍO y no en cero', () => {
    // Un 0 precargado convertiría «no se sabe» en una afirmación en cuanto el
    // usuario guardara cualquier otra cosa de la pantalla.
    expect(textoDeCosto(null)).toBe('')
  })

  it('un cero capturado sí se enseña como 0', () => {
    expect(textoDeCosto(0)).toBe('0')
  })

  it('un importe se precarga sin separadores de miles: es el valor del formulario, no lo que se ve', () => {
    // Desde el 08/10 las comas las pone CampoCifra al PINTARLO; el valor que
    // guarda el formulario (y lo que devuelve el campo al teclear) va sin ellas.
    expect(textoDeCosto(12000)).toBe('12000')
  })
})

// ─── Una OT cerrada ya no admite costo (decisión del dueño, 08/10) ──────────
describe('avisoAntesDeCerrar', () => {
  it('sin costo: avisa que después ya no se podrá registrar y que entra la estimación', () => {
    const t = avisoAntesDeCerrar(null)
    expect(t).toMatch(/ya no (podrás|se podrá) registrar/i)
    expect(t).toMatch(/estimación/i)
  })

  it('con costo: dice el importe, con coma de miles, y que queda fijo', () => {
    const t = avisoAntesDeCerrar(12500)
    expect(t).toContain('$ 12,500.00')
    expect(t).toMatch(/fijo|ya no se podrá cambiar/i)
  })

  it('CERO es un costo capturado, no «sin costo»', () => {
    expect(avisoAntesDeCerrar(0)).toContain('$ 0.00')
  })
})

describe('textoCostoDeCerrada', () => {
  it('con costo: el importe y que ya no se cambia', () => {
    const t = textoCostoDeCerrada(3000)
    expect(t).toContain('$ 3,000.00')
    expect(t).toMatch(/cerrada/i)
  })

  it('sin costo: que se cerró sin él y el reporte usa la estimación', () => {
    const t = textoCostoDeCerrada(null)
    expect(t).toMatch(/sin costo/i)
    expect(t).toMatch(/estimación/i)
  })
})

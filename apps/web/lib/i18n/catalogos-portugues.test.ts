import { describe, it, expect } from 'vitest'
import { DICCIONARIOS } from './diccionario'
import { mensajeDeAcceso } from './errores-acceso'
import { traducirNotificacion } from './notificaciones'
import { etiquetaDePapel, codigoDePapel, PAPELES_FIJOS } from './papeles'
import { etiquetaDePuntoOT, CHECKLIST_OT_POR_OMISION } from './checklist-ot'
import { dondeDeFallaEnIdioma, nombreDeFallaEnIdioma } from './donde-falla'
import { textoDeItem } from '../novedades'
import { haceSinPrefijo } from '../../components/demo/space-eyes/piezas'

// ============================================================================
//  Ola 0 del portugues (2026-11-05) · LOS CATALOGOS FUERA DE `textos/`.
// ----------------------------------------------------------------------------
//  Los mismos que el italiano (`catalogos-italiano.test.ts`). Todos aceptan
//  `pt` y, mientras su lote no escriba el portugues, dicen lo mismo que el
//  ESPANOL (decision del dueno del 05/11), nunca el ingles. Cuando un lote
//  traduzca un ambito, la igualdad se rompe A PROPOSITO para esas claves.
//
//  Lo que SI cambia ya es el formato: el saldo de la campanita sale «MX$».
// ============================================================================

const ES = DICCIONARIOS.es as Record<string, string>

describe('catalogos fuera de textos/ · portugues = espanol mientras falte', () => {
  it('errores de acceso', () => {
    expect(mensajeDeAcceso('Correo o contraseña inválidos', 'pt')).toBe('Correo o contraseña inválidos')
    expect(mensajeDeAcceso('Demasiados intentos. Espera 30s.', 'pt')).toBe('Demasiados intentos. Espera 30s.')
    expect(mensajeDeAcceso('raro', 'pt')).toBe('raro')
  })

  it('papeles', () => {
    expect(PAPELES_FIJOS.map((r) => codigoDePapel(r, 'pt'))).toEqual(PAPELES_FIJOS.map((r) => codigoDePapel(r, 'es')))
    expect(etiquetaDePapel(ES['admin.papel.ventas'], 'pt')).toBe(ES['admin.papel.ventas'])
  })

  it('checklist de OT', () => {
    for (const l of CHECKLIST_OT_POR_OMISION) expect(etiquetaDePuntoOT(l, 'pt')).toBe(etiquetaDePuntoOT(l, 'es'))
  })

  it('nombres y lugares de falla de Space Eyes', () => {
    expect(dondeDeFallaEnIdioma('Gabinete 3 (fila 1, columna 2)', 'pt')).toBe('Gabinete 3 (fila 1, columna 2)')
    const nombre = ES['spaceeyes.fallas.nombre.zona-apagada']
    expect(nombreDeFallaEnIdioma(nombre, 'pt')).toBe(nombre)
  })

  it('la campanita: el texto en espanol, el saldo con el formato portugues', () => {
    expect(traducirNotificacion({ titulo: 'Factura emitida', detalle: 'F-1 · 1,000' }, 'pt').titulo).toBe(
      'Factura emitida',
    )
    const vencida = { titulo: 'Cobranza vencida', detalle: 'F-7 — vencida hace 3 día(s) · saldo $1,234' }
    const pt = traducirNotificacion(vencida, 'pt')
    expect(pt.titulo).toBe('Cobranza vencida')
    expect(pt.detalle).toContain('MX$ 1.234')
  })

  it('las notas de version: el texto espanol, no el ingles ni el italiano', () => {
    expect(textoDeItem({ tipo: 'nuevo', texto: 'Hola', en: 'Hello', it: 'Ciao' } as never, 'pt')).toBe('Hola')
  })

  it('el «hace» de Space Eyes se quita tambien en portugues (cae al espanol)', () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(haceSinPrefijo(iso, 'pt')).toBe(haceSinPrefijo(iso, 'es'))
    expect(haceSinPrefijo(iso, 'pt')).not.toMatch(/^hace /)
  })
})

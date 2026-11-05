import { describe, it, expect } from 'vitest'
import { DICCIONARIOS, PT_PARCIAL } from '../diccionario'
import { CATALOGO_ERRORES_PT, FALTA_REVISION_PT, traducirError } from '../errores-servidor'

// ============================================================================
//  PORTUGUES · LO COMUN A LOS CINCO LOTES (costura, 2026-11-05).
// ----------------------------------------------------------------------------
//  Cada lote (L1 Space Eyes y luz, L2 comercial, L3 inventario, L4 campanas,
//  L5 armazon) tiene su prueba estatica (`portugues-l<n>.test.ts`) y vigila
//  SUS claves. Lo que vale para todo el portugues —las decisiones del dueno
//  que cruzan lotes y las guardias de forma— vive aqui y mira todo
//  `PT_PARCIAL` y los catalogos del servidor juntos. Glosario comun final en
//  `vault/03-Frontend/portugues-olas.md` §2 bis.
// ============================================================================

const ES = DICCIONARIOS.es as Record<string, string>
const PT = PT_PARCIAL as Record<string, string>

describe('portugues · decisiones del dueno del 05/11 (costura)', () => {
  it('Captacion se llama «Captação» a secas: menu y titulo de la pagina', () => {
    // Sustituye a «Captação de pontos» del glosario de la tarde: la pagina
    // lleva tambien clientes, no solo pontos (validacion del L4, duda 1).
    expect(PT['nav.captacion']).toBe('Captação')
    expect(PT['clientes.captacion.titulo']).toBe('Captação')
  })

  it('la reserva tentativa es «Pré-reserva», en todos los lotes (L2, L4)', () => {
    // Sustituye a «Provisória». Lo que se oye en la mídia brasileña.
    expect(PT['campanas.reserva.tentativa']).toBe('Pré-reserva')
    expect(PT['inicio.grafica.tentativas']).toBe('Pré-reservas')
    expect(PT['comercial.reserva.reservar']).toBe('Pré-reservar')
    const tentativas = Object.keys(ES).filter((k) => /tentativ/i.test(ES[k]))
    expect(tentativas.length).toBeGreaterThanOrEqual(3)
    for (const k of tentativas) expect(PT[k], k).toMatch(/pré-reserv/i)
    expect(Object.entries(PT).filter(([, v]) => /provis[óo]ri/i.test(v)).map(([k]) => k)).toEqual([])
  })

  it('el dueno del terreno que se capta es «o dono do terreno», en la pantalla y en el error del servidor', () => {
    // El mismo texto lo arma el cliente (`faltantesParaRevision`, L4) y el
    // servidor (`FALTA_REVISION_PT`, L5). Decia «o proprietário» en el
    // servidor; «proprietário» ademas chocaba con el rol Dueño = Titular.
    const es = 'el dueño: un arrendador existente o el nombre y teléfono del contacto'
    expect(FALTA_REVISION_PT[es]).toBe(PT['clientes.captacion.falta.dueno'])
    expect(PT['clientes.captacion.falta.dueno']).toMatch(/^o dono do terreno: /)
  })

  it('el CP fiscal es «CEP» en el rotulo y en el error, en la pantalla y en el servidor (H9 del L4)', () => {
    // El rotulo decia «CEP fiscal» y el error «Código postal inválido»: la
    // misma cosa con dos nombres. Queda «CEP» en los dos; «(5 dígitos)» dice
    // que es el codigo mexicano, no el CEP brasileño de 8.
    expect(PT['clientes.form.cp']).toBe('CEP fiscal')
    expect(PT['clientes.form.cp-invalido']).toBe('CEP inválido (5 dígitos)')
    expect(CATALOGO_ERRORES_PT['Código postal inválido (5 dígitos)']).toBe(PT['clientes.form.cp-invalido'])
    expect(traducirError('Código postal inválido (5 dígitos)', 'pt')).toBe('CEP inválido (5 dígitos)')
  })

  it('«o app», en masculino (validacion del L1): nunca «a app», que es de Portugal', () => {
    const malas = Object.entries(PT).filter(([, v]) => /\b(a|da|na|pela|à) app\b/i.test(v)).map(([k]) => k)
    expect(malas).toEqual([])
    expect(Object.values(PT).some((v) => /\b(o|do|no|pelo|ao) app\b/i.test(v))).toBe(true)
  })
})

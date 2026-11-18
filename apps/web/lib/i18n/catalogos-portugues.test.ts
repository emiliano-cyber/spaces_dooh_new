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

describe('catalogos fuera de textos/ · portugues = espanol mientras falte (los de L5, ya en portugues)', () => {
  // Lote L5 (05/11): acceso, papeles y campanita ya tienen portugues. Lo que
  // no se reconoce sigue saliendo tal cual (en espanol).
  it('errores de acceso (lote L5: en portugues)', () => {
    expect(mensajeDeAcceso('Correo o contraseña inválidos', 'pt')).toBe('E-mail ou senha inválidos')
    expect(mensajeDeAcceso('Demasiados intentos. Espera 30s.', 'pt')).toBe('Muitas tentativas. Aguarde 30s.')
    expect(mensajeDeAcceso('raro', 'pt')).toBe('raro')
  })

  it('papeles (lote L5: en portugues; la etiqueta con acentos de la base tambien)', () => {
    expect(PAPELES_FIJOS.map((r) => codigoDePapel(r, 'pt'))).toEqual(['LOCAÇÕES', 'ATIVOS', 'LICENÇAS', 'OPERAÇÃO', 'VENDAS'])
    expect(etiquetaDePapel(ES['admin.papel.ventas'], 'pt')).toBe('Vende publicidade')
    expect(etiquetaDePapel('Operación y nómina', 'pt')).toBe('Operação e folha de pagamento')
    expect(etiquetaDePapel('Un papel renombrado', 'pt')).toBe('Un papel renombrado')
  })

  // Lote L3 (05/11): la lista por omision de una OT sale de `operaciones2`, ya en
  // portugues. Lo guardado por una persona sigue saliendo tal cual.
  it('checklist de OT (lote L3: en portugues)', () => {
    expect(CHECKLIST_OT_POR_OMISION.map((l) => etiquetaDePuntoOT(l, 'pt'))).toEqual([
      'Inspeção da estrutura e das ferragens',
      'Instalação / execução',
      'Foto de comprovação com geolocalização',
    ])
    expect(etiquetaDePuntoOT('Inspección de estructura', 'pt')).toBe('Inspección de estructura')
  })

  // Lote L1 (05/11): la igualdad con el espanol se rompe a proposito.
  it('nombres y lugares de falla de Space Eyes (lote L1: en portugues)', () => {
    expect(dondeDeFallaEnIdioma('Gabinete 3 (fila 1, columna 2)', 'pt')).toBe('Gabinete 3 (linha 1, coluna 2)')
    expect(dondeDeFallaEnIdioma('Gabinetes 1, 2 (2 de 8)', 'pt')).toBe('Gabinetes 1, 2 (2 de 8)')
    expect(dondeDeFallaEnIdioma(ES['spaceeyes.fallas.donde.toda'], 'pt')).toBe('A tela inteira')
    const nombre = ES['spaceeyes.fallas.nombre.zona-apagada']
    expect(nombreDeFallaEnIdioma(nombre, 'pt')).toBe('Possível gabinete apagado ou tampado')
  })

  it('la campanita (lote L5): el texto en portugues, el saldo con el formato portugues', () => {
    expect(traducirNotificacion({ titulo: 'Factura emitida', detalle: 'F-1 · 1,000' }, 'pt').titulo).toBe(
      'Fatura emitida',
    )
    const vencida = { titulo: 'Cobranza vencida', detalle: 'F-7 — vencida hace 3 día(s) · saldo $1,234' }
    const pt = traducirNotificacion(vencida, 'pt')
    expect(pt.titulo).toBe('Cobrança vencida')
    expect(pt.detalle).toMatch(/^F-7 — vencida há 3 dias · saldo MX\$ 1\.234/)
    // El dia del vencimiento, sin «0 dias»; y un dia, en singular.
    const vence = (n: number) =>
      traducirNotificacion({ titulo: 'Recordatorio de cobro', detalle: `F-7 — vence en ${n} día(s) · saldo $10` }, 'pt')
    expect(vence(0).detalle).toMatch(/^F-7 — vence hoje · saldo MX\$ 10/)
    expect(vence(1).detalle).toMatch(/^F-7 — vence em 1 dia · saldo MX\$ 10/)
    // Un aviso que no casa con ninguna plantilla se pinta tal cual, en espanol.
    expect(traducirNotificacion({ titulo: 'Algo nuevo', detalle: 'x' }, 'pt').titulo).toBe('Algo nuevo')
  })

  it('las notas de version: el texto espanol, no el ingles ni el italiano', () => {
    expect(textoDeItem({ tipo: 'nuevo', texto: 'Hola', en: 'Hello', it: 'Ciao' } as never, 'pt')).toBe('Hola')
  })

  it('el «há» de Space Eyes se quita tambien en portugues (lote L1)', () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(haceSinPrefijo(iso, 'pt')).toBe('5 min')
    expect(haceSinPrefijo(iso, 'pt')).not.toMatch(/^(?:há|hace) /)
  })
})

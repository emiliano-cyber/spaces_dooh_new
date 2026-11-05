import { describe, it, expect } from 'vitest'
import { DICCIONARIOS } from './diccionario'
import { mensajeDeAcceso } from './errores-acceso'
import { traducirError } from './errores-servidor'
import { traducirNotificacion } from './notificaciones'
import { etiquetaDePapel, codigoDePapel, PAPELES_FIJOS } from './papeles'
import { etiquetaDePuntoOT, CHECKLIST_OT_POR_OMISION } from './checklist-ot'
import { dondeDeFallaEnIdioma, nombreDeFallaEnIdioma } from './donde-falla'
import { csvEstadoCuenta, nombreArchivoEstadoCuenta } from '../../components/demo/finanzas/estado-cuenta-csv'
import type { RespuestaResumen } from '../data/finanzas-periodo-api'

// ============================================================================
//  Ola 0 del italiano (2026-11-03) · LOS CATALOGOS FUERA DE `textos/`.
// ----------------------------------------------------------------------------
//  Todos pasan por `traducir()` o `traducirError()` cuando el idioma no es el
//  espanol, asi que aceptan `it` sin tocarlos y caen al INGLES mientras su
//  lote no escriba el italiano. Esta prueba lo fija: hoy, `it` dice lo mismo
//  que `en` en cada uno. Cuando un lote traduzca un ambito, la igualdad se
//  rompe A PROPOSITO para esas claves y la prueba se ajusta en ese lote.
//
//  Lo que SI cambia ya en italiano es el formato (fechas, cifras, simbolo):
//  el CSV del estado de cuenta lo muestra abajo.
// ============================================================================

const ES = DICCIONARIOS.es as Record<string, string>

describe('catalogos fuera de textos/ · italiano = ingles mientras falte', () => {
  // Lote L5 (2026-11-03): los de acceso ya tienen italiano (base de
  // `diccionario.ts`); lo que no conocen sigue por `traducirError`.
  it('errores de acceso, en italiano', () => {
    expect(mensajeDeAcceso('Correo o contraseña inválidos', 'it')).toBe('Email o password non validi')
    expect(mensajeDeAcceso('Demasiados intentos. Espera 30s.', 'it')).toBe('Troppi tentativi. Attendi 30s.')
    expect(mensajeDeAcceso('Demasiados intentos. Espera 30s e intenta de nuevo.', 'it')).toBe(
      'Troppi tentativi. Attendi 30s e riprova.',
    )
    expect(mensajeDeAcceso('No encontrado', 'it')).toBe(traducirError('No encontrado', 'it'))
    expect(mensajeDeAcceso('raro', 'it')).toBe('raro')
  })

  // Lote L5 (2026-11-03): los papeles ya tienen italiano (`admin.papel.*`).
  it('papeles, en italiano', () => {
    expect(PAPELES_FIJOS.map((r) => codigoDePapel(r, 'it'))).toEqual(['AFFITTI', 'BENI', 'LICENZE', 'OPERATIVITÀ', 'VENDITE'])
    expect(etiquetaDePapel(ES['admin.papel.ventas'], 'it')).toBe('Vende pubblicità')
    // Una etiqueta renombrada por la instancia es dato: sale tal cual.
    expect(etiquetaDePapel('Vende espectaculares', 'it')).toBe('Vende espectaculares')
    expect(codigoDePapel('OTRO', 'it')).toBe('OTRO')
  })

  // Lote L3 (2026-11-03): la lista por omision de una OT ya tiene italiano. Lo
  // guardado sigue siendo el espanol; al pintarlo en `it` sale el italiano, y
  // lo que escribio una persona sigue saliendo tal cual.
  it('checklist de OT · ya en italiano (lote L3)', () => {
    expect(CHECKLIST_OT_POR_OMISION.map((l) => etiquetaDePuntoOT(l, 'it'))).toEqual([
      'Ispezione della struttura e della ferramenta',
      'Montaggio / esecuzione',
      'Foto di verifica con geolocalizzazione',
    ])
    for (const l of CHECKLIST_OT_POR_OMISION) expect(etiquetaDePuntoOT(l, 'it')).not.toBe(etiquetaDePuntoOT(l, 'en'))
    expect(etiquetaDePuntoOT('Inspección de estructura', 'it')).toBe('Inspección de estructura')
  })

  // Lote L1 (2026-11-03): Space Eyes ya tiene italiano, asi que aqui la
  // igualdad con el ingles se rompe a proposito. El detalle, en
  // `donde-falla.test.ts`.
  it('nombres y lugares de falla de Space Eyes · YA en italiano (lote L1)', () => {
    expect(dondeDeFallaEnIdioma('Gabinete 3 (fila 1, columna 2)', 'it')).toBe('Cabinet 3 (riga 1, colonna 2)')
    expect(dondeDeFallaEnIdioma('Gabinetes 1, 2 (2 de 8)', 'it')).toBe('Cabinet 1, 2 (2 di 8)')
    expect(dondeDeFallaEnIdioma(ES['spaceeyes.fallas.donde.toda'], 'it')).toBe('Tutto lo schermo')
    const nombre = ES['spaceeyes.fallas.nombre.zona-apagada']
    expect(nombreDeFallaEnIdioma(nombre, 'it')).toBe('Possibile cabinet spento')
  })

  // Lote L5 (2026-11-03): la campanita ya tiene italiano; el saldo sale con
  // el formato italiano y, con 0 dias, «scade oggi».
  it('la campanita, en italiano', () => {
    expect(traducirNotificacion({ titulo: 'Factura emitida', detalle: 'F-1 · 1,000' }, 'it')).toEqual({
      titulo: 'Fattura emessa',
      detalle: 'F-1 · 1,000',
    })
    const vencida = { titulo: 'Cobranza vencida', detalle: 'F-7 — vencida hace 3 día(s) · saldo $1,234' }
    expect(traducirNotificacion(vencida, 'it')).toEqual({
      titulo: 'Incasso scaduto',
      detalle: 'F-7 — scaduto da 3 giorni · saldo MX$ 1.234',
    })
    const una = { titulo: 'Recordatorio de cobro', detalle: 'F-7 — vence en 1 día(s) · saldo $10' }
    expect(traducirNotificacion(una, 'it').detalle).toBe('F-7 — scade tra 1 giorno · saldo MX$ 10')
    const hoy = { titulo: 'Recordatorio de cobro', detalle: 'F-7 — vence en 0 día(s) · saldo $10' }
    expect(traducirNotificacion(hoy, 'it').detalle).toBe('F-7 — scade oggi · saldo MX$ 10')
    const contrato = { titulo: 'Contrato vence en 0 días: un espacio', detalle: null }
    expect(traducirNotificacion(contrato, 'it').titulo).toBe('Il contratto scade OGGI: uno spazio')
  })
})

// Lote L4 (2026-11-03): `finanzas` ya tiene italiano, asi que los textos del
// CSV dejan de caer al ingles. La prueba completa, byte a byte, vive con las
// del espanol y el ingles en `estado-cuenta-csv-idioma.test.ts`.
describe('el CSV del estado de cuenta en italiano · textos y formatos italianos', () => {
  const datos = {
    periodo: { desde: '2026-09-01', hasta: '2026-09-30', etiqueta: 'Septiembre 2026' },
    hoy: '2026-10-06',
    resumen: {
      facturado: { monto: 23200, facturas: 1 }, cobrado: 5000.5, saldoInicial: 11600, saldoFinal: 29800,
      vencido: { monto: 6600, facturas: 1 }, corte: '2026-09-30', renta: null, abonosSinFecha: 0,
    },
    movimientos: [{ fecha: '2026-09-10', tipo: 'factura', folio: 'F2', clienteId: 'c1', cargo: 23200, abono: 0, saldo: 34800 }],
  } as unknown as RespuestaResumen

  it('fechas «10 set 2026», periodo «settembre 2026», MX$ en el encabezado, importes como numero', () => {
    const csv = csvEstadoCuenta(datos, 'Acme', () => 'Acme', false, 'it')
    expect(csv).toContain('Periodo;settembre 2026;1 set 2026;30 set 2026')
    expect(csv).toContain('Saldo iniziale (MX$);11600')
    expect(csv).toContain('\n10 set 2026;Fattura;F2;23200;;34800')
    expect(nombreArchivoEstadoCuenta('2026-09-01', false, 'it')).toBe('estratto-conto-2026-09.csv')
  })
})

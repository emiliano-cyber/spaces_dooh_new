import { describe, it, expect } from 'vitest'
import { DICCIONARIOS } from './diccionario'
import { mensajeDeAcceso } from './errores-acceso'
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
  it('errores de acceso', () => {
    for (const m of ['Correo o contraseña inválidos', 'Demasiados intentos. Espera 30s.', 'No encontrado', 'raro']) {
      expect(mensajeDeAcceso(m, 'it')).toBe(mensajeDeAcceso(m, 'en'))
    }
  })

  it('papeles', () => {
    for (const r of PAPELES_FIJOS) {
      const etiqueta = ES[`admin.papel.${r.toLowerCase()}`]
      expect(etiquetaDePapel(etiqueta, 'it')).toBe(etiquetaDePapel(etiqueta, 'en'))
      expect(codigoDePapel(r, 'it')).toBe(codigoDePapel(r, 'en'))
    }
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

  it('la campanita', () => {
    const n = { titulo: 'Factura emitida', detalle: 'F-1 · 1,000' }
    expect(traducirNotificacion(n, 'it')).toEqual(traducirNotificacion(n, 'en'))
  })
})

describe('el CSV del estado de cuenta en italiano · textos en ingles, formatos italianos', () => {
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
    expect(csv).toContain('Period,settembre 2026,1 set 2026,30 set 2026')
    expect(csv).toContain('Opening balance (MX$),11600')
    expect(csv).toContain('\n10 set 2026,Invoice,F2,23200,,34800')
    expect(nombreArchivoEstadoCuenta('2026-09-01', false, 'it')).toBe(nombreArchivoEstadoCuenta('2026-09-01', false, 'en'))
  })
})

// ============================================================================
//  lib/i18n/estado-alertas.fixture.ts — UN ESTADO DE DEMO QUE DISPARA TODAS LAS
//  RAMAS DE `construirAlertas` (lib/data/derive.ts).
// ----------------------------------------------------------------------------
//  Lo usan `pantallas-inicio.test.ts` (el Dashboard rendido en los dos idiomas)
//  y `textos/inicio.test.ts` (el espanol de cada alerta, identico con y sin
//  `idioma`). Las fechas estan pensadas para HOY = 2026-11-02: las pruebas fijan
//  el reloj. No es una prueba: no lleva `describe`.
// ============================================================================

const contrato = (id: string, sitioId: string, extra: Record<string, unknown>) => ({
  id, sitioId, arrendadorId: 'a1', fechaInicio: '2026-01-01', fechaFin: '2027-12-31', montoRenta: 1000, periodicidad: 'MENSUAL',
  moneda: 'MXN', autoRenovable: false, documentoUrl: null, estatus: 'VIGENTE', predioId: null, razonSocialId: null, deposito: null,
  motivoCancelacion: null, creadoEn: '2026-01-01', ...extra,
})
const pago = (id: string, contratoId: string, periodo: string, estatus: string) => ({ id, contratoId, periodo, monto: 1000, estatus })
// Un estado que dispara TODAS las ramas de `construirAlertas`.
export const ESTADO_ALERTAS = {
  sitios: [
    { id: 'S1', nombre: 'Pantalla Reforma', caras: 1, predioId: null, estatusComercial: 'DISPONIBLE' },
    { id: 'S2', nombre: 'Pantalla Sur', caras: 1, predioId: null, estatusComercial: 'DISPONIBLE', pausaLegal: true, motivoPausaLegal: 'clausura-municipal' },
    { id: 'S3', nombre: 'Valla Norte', caras: 1, predioId: null, estatusComercial: 'DISPONIBLE' },
    { id: 'S4', nombre: 'Valla Centro', caras: 1, predioId: null, estatusComercial: 'DISPONIBLE' },
  ],
  contratos: [
    contrato('C1', 'S1', {}),
    contrato('C2', 'S2', {}),
    contrato('C3', 'S3', { estatus: 'INCOMPLETO', fechaFin: null, montoRenta: null, arrendadorId: null }),
    contrato('C4', 'S4', { estatus: 'POR_VENCER', fechaFin: '2026-11-03' }),
    contrato('C5', 'S4', { estatus: 'POR_VENCER', fechaFin: '2026-11-22' }),
    contrato('C6', 'S2', { estatus: 'VENCIDO', fechaFin: '2026-11-01' }),
    contrato('C7', 'S2', { estatus: 'VENCIDO', fechaFin: '2026-10-20' }),
    contrato('C8', 'S1', { fechaFin: '2026-12-31' }),
  ],
  pagosRenta: [
    pago('P1', 'C1', '2026-09-01', 'VENCIDO'), pago('P2', 'C1', '2026-10-01', 'VENCIDO'), pago('P3', 'C2', '2026-10-01', 'VENCIDO'),
    pago('P4', 'C4', '2026-11-02', 'PENDIENTE'), pago('P5', 'C5', '2026-11-03', 'PENDIENTE'), pago('P6', 'C8', '2026-11-06', 'PENDIENTE'),
  ],
  licencias: [
    { id: 'L1', tipo: 'MUNICIPAL', folio: 'LM-1', predioId: null, sitioId: 'S1', fechaVencimiento: '2026-11-01' },
    { id: 'L2', tipo: 'AMBIENTAL', folio: null, predioId: null, sitioId: 'S3', fechaVencimiento: '2026-10-01' },
    { id: 'L3', tipo: 'ESTRUCTURAL', folio: null, predioId: null, sitioId: 'S9', fechaVencimiento: '2026-11-03' },
    { id: 'L4', tipo: 'OTRO', folio: 'X', predioId: null, sitioId: 'S1', fechaVencimiento: '2026-12-20' },
  ],
  reservas: [
    { id: 'R1', sitioId: 'S1', campanaId: 'K1', estatus: 'CONFIRMADA', fechaInicio: '2026-10-01', fechaFin: '2028-03-01', precio: 1 },
    { id: 'R2', sitioId: 'S3', campanaId: 'K9', estatus: 'CONFIRMADA', fechaInicio: '2026-10-01', fechaFin: '2028-03-01', precio: 1 },
  ],
  campanas: [{ id: 'K1', nombre: 'Verano' }],
  cobranzas: [
    { id: 'B1', facturaId: 'F1', estatus: 'PENDIENTE', fechaVencimiento: '2026-10-01' },
    { id: 'B2', facturaId: 'F9', estatus: 'PENDIENTE', fechaVencimiento: '2026-11-20' },
  ],
  facturas: [{ id: 'F1', folio: 'A-101', monto: 5000 }],
  incidencias: [
    { id: 'I1', sitioId: 'S1', estatus: 'ABIERTA', impactaComercial: true, tipo: 'VANDALISMO' },
    { id: 'I2', sitioId: 'S9', estatus: 'ABIERTA', impactaComercial: true, tipo: 'OTRO' },
  ],
  ordenesTrabajo: [
    { id: 'O1', folio: 'OT-1', sitioId: 'S1', estatus: 'PENDIENTE', fechaProgramada: '2026-11-01', asignadoAUserId: null },
    { id: 'O2', folio: 'OT-2', sitioId: null, estatus: 'ASIGNADA', fechaProgramada: '2026-10-20', asignadoAUserId: 'u1' },
    { id: 'O3', folio: 'OT-3', sitioId: 'S3', estatus: 'PENDIENTE', fechaProgramada: '2026-11-03', asignadoAUserId: null },
    { id: 'O4', folio: 'OT-4', sitioId: 'S3', estatus: 'PENDIENTE', fechaProgramada: '2026-11-04', asignadoAUserId: 'u1' },
  ],
  arrendadores: [], clientes: [], propuestas: [], ordenesCompra: [], ordenesImpresion: [], creatividades: [], evidencias: [],
  notificaciones: [], acciones: [], reservasTentativas: [], predios: [], sitiosRed: [],
}

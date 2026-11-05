// Expedientes de prueba del contrato, compartidos por las pruebas de idioma
// (copiados de `contrato-documento-idioma.test.ts`, que conserva los suyos).
import type { Periodicidad } from './contrato-documento'

export const completo = {
  arrendatario: {
    razonSocial: 'RGB Catorce S de RL de CV',
    rfc: 'RGB210101AAA',
    domicilioFiscal: 'Av. Siempre Viva 100, CDMX',
    representanteLegal: 'José López',
    datosConstitucion: 'escritura 1234 ante el notario 56 de la CDMX',
  },
  arrendador: {
    nombre: 'Juan Pérez',
    rfc: 'PEJJ800101AAA',
    curp: 'PEJJ800101HDFRRN01',
    direccion: 'Calle Falsa 123, CDMX',
    nacionalidad: 'mexicana',
    razonSocial: null,
  },
  espacio: {
    nombre: 'Pantalla LED Reforma 222',
    codigo: 'DIG-001',
    tipoMedio: 'ESPECTACULAR',
    direccion: 'Paseo de la Reforma 222, CDMX',
    ciudad: 'Ciudad de México',
    ancho: 12.5,
    alto: 6,
    predio: 'Torre Reforma 222',
  },
  terminos: {
    fechaInicio: '2026-08-01',
    fechaFin: '2028-07-31',
    montoRenta: 1234567.89,
    periodicidad: 'MENSUAL' as Periodicidad,
    moneda: 'MXN',
    deposito: 50000,
    diaPago: 5,
    incrementoAnualPct: 8,
    usoPermitido: null,
    autoRenovable: true,
    ciudadFirma: 'Ciudad de México',
  },
  fechaFirma: '2026-07-29' as string | null,
}

export const otro = {
  arrendatario: { razonSocial: 'Medios SA de CV', rfc: 'MED010101AAA', domicilioFiscal: 'Insurgentes 1, CDMX', representanteLegal: null, datosConstitucion: null },
  arrendador: { nombre: 'Ana Ruiz', rfc: 'RUAA800101AAA', curp: null, direccion: 'Juárez 9, Monterrey', nacionalidad: null, razonSocial: 'Inmobiliaria Ruiz SA de CV' },
  espacio: { nombre: 'Unipolar 41', codigo: null, tipoMedio: 'ESPECTACULAR', direccion: 'Carretera 57 km 3', ciudad: 'Monterrey', ancho: null, alto: 8, predio: null },
  terminos: {
    fechaInicio: '2026-01-01', fechaFin: '2026-12-31', montoRenta: 21, periodicidad: 'ANUAL' as Periodicidad, moneda: 'MXN',
    deposito: 0, diaPago: null, incrementoAnualPct: null, usoPermitido: 'la exhibición de anuncios luminosos', autoRenovable: false, ciudadFirma: null,
  },
  fechaFirma: null as string | null,
}

export const vacio = {
  arrendatario: { razonSocial: null, rfc: null, domicilioFiscal: null, representanteLegal: null, datosConstitucion: null },
  arrendador: { nombre: null, rfc: null, curp: null, direccion: null, nacionalidad: null, razonSocial: null },
  espacio: { nombre: null, codigo: null, tipoMedio: null, direccion: null, ciudad: null, ancho: null, alto: null, predio: null },
  terminos: {
    fechaInicio: null, fechaFin: null, montoRenta: null, periodicidad: null, moneda: 'MXN', deposito: null, diaPago: null,
    incrementoAnualPct: null, usoPermitido: null, autoRenovable: false, ciudadFirma: null,
  },
  fechaFirma: null as string | null,
}

export const usd = { ...completo, terminos: { ...completo.terminos, moneda: 'USD' } }

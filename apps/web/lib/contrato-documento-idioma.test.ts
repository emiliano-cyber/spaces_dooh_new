import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import {
  generarContrato,
  numeroALetras,
  fechaEnLetra,
  documentoATexto,
  hashParaCotejar,
  encabezadosDocumento,
  type Periodicidad,
} from './contrato-documento'

// ============================================================================
//  ADR 0049 · el contrato en el idioma de la INSTANCIA.
//
//  Lo que este archivo protege, por orden de lo caro que sale equivocarlo:
//
//   1. El contrato ESPANOL no cambia ni un byte. Los hashes de abajo se
//      midieron sobre `feat/italiano-base` (6779321d), ANTES de tocar
//      `contrato-documento.ts`. Toda instancia que existe hoy es `es`, y sus
//      contratos congelados se cotejan regenerando este texto: si cambiara,
//      todas sus firmas aparecerian ALTERADAS sin que nadie tocara nada.
//   2. La cantidad con letra en ingles e italiano (prevalece sobre la cifra).
//   3. Que un contrato en/it no arrastre ni una palabra del espanol.
// ============================================================================

const sha = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex')
const hashDe = (args: Parameters<typeof generarContrato>[0]) => sha(documentoATexto(generarContrato(args)))

const completo = {
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

const otro = {
  arrendatario: { razonSocial: 'Medios SA de CV', rfc: 'MED010101AAA', domicilioFiscal: 'Insurgentes 1, CDMX', representanteLegal: null, datosConstitucion: null },
  arrendador: { nombre: 'Ana Ruiz', rfc: 'RUAA800101AAA', curp: null, direccion: 'Juárez 9, Monterrey', nacionalidad: null, razonSocial: 'Inmobiliaria Ruiz SA de CV' },
  espacio: { nombre: 'Unipolar 41', codigo: null, tipoMedio: 'ESPECTACULAR', direccion: 'Carretera 57 km 3', ciudad: 'Monterrey', ancho: null, alto: 8, predio: null },
  terminos: {
    fechaInicio: '2026-01-01', fechaFin: '2026-12-31', montoRenta: 21, periodicidad: 'ANUAL' as Periodicidad, moneda: 'MXN',
    deposito: 0, diaPago: null, incrementoAnualPct: null, usoPermitido: 'la exhibición de anuncios luminosos', autoRenovable: false, ciudadFirma: null,
  },
  fechaFirma: null as string | null,
}

const vacio = {
  arrendatario: { razonSocial: null, rfc: null, domicilioFiscal: null, representanteLegal: null, datosConstitucion: null },
  arrendador: { nombre: null, rfc: null, curp: null, direccion: null, nacionalidad: null, razonSocial: null },
  espacio: { nombre: null, codigo: null, tipoMedio: null, direccion: null, ciudad: null, ancho: null, alto: null, predio: null },
  terminos: {
    fechaInicio: null, fechaFin: null, montoRenta: null, periodicidad: null, moneda: 'MXN', deposito: null, diaPago: null,
    incrementoAnualPct: null, usoPermitido: null, autoRenovable: false, ciudadFirma: null,
  },
  fechaFirma: null as string | null,
}

const usd = { ...completo, terminos: { ...completo.terminos, moneda: 'USD' } }

// Medidos sobre el codigo de ANTES (6779321d). No se recalculan: si uno de
// estos cambia, el espanol cambio, y eso invalida firmas reales.
const HASH_ES = {
  completo: 'fc94ef817d35e3ed85e65740348baae93d9e4c7bea7759ba383d9dd63878fbbc',
  otro: 'a62cf977f6ec6eece5369cf7d956c22f0c2dae14e447e974ac399f9f5d243f3a',
  vacio: '3855015c7c5e9e1012add7399a08d21f423d78caaa04014d2e1ee75d8d162419',
  usd: 'd19db10d6ad50e85119aaa9fe8646677e743833156821a4906a75f24160fba88',
  usdPesosSiempre: '84b04613f8876a74d8cce685a922f2bd17a3d98dbd275ca6cabfb3aa57406d35',
  huella: '48116cd61c5be14fef3a6afe66b7a2ed968590954bcf7212469c785073ca8398',
  periodicidad: {
    SEMANAL: '3e91af9b107da2e3a4ef04599531b78a429a44f0c6415dec5fff2b99597e46ac',
    CATORCENAL: '570abbd6ab367c86af9d0cebfaa34b8ab2024e4210f8177935e8ec910d1129bb',
    QUINCENAL: '27be248d7803bff4f48f856b8792eadfadb48316115f8f288ac0f069c203e6c5',
    MENSUAL: '7793484a753598d723f8e89a7c34be4b28ad684b8e54af5fab327fdf79e226fd',
    BIMESTRAL: '3bf1b314391c77ba27ad481ca88a5b52c290be8c53e446ad878de2edba8bc55d',
    TRIMESTRAL: '5e5b23a172d38be44462dfbac3a54fec3d69d8569e2b016103dc9201c51e6c66',
    SEMESTRAL: '402a55d8069533fbfc44cc0685b0aa6cd5b22d3668f4bd9035c83da91aa16a29',
    ANUAL: 'a62cf977f6ec6eece5369cf7d956c22f0c2dae14e447e974ac399f9f5d243f3a',
  } as Record<Periodicidad, string>,
}

describe('ADR 0049 · el contrato ESPANOL no cambia ni un byte', () => {
  it.each([
    ['completo', completo],
    ['otro (persona moral, sin deposito ni incremento, no renovable)', otro],
    ['vacio (todos los huecos)', vacio],
    ['en USD', usd],
  ] as const)('%s: mismo hash que antes, sin idioma y con idioma es', (_n, datos) => {
    const clave = _n.split(' ')[0] === 'en' ? 'usd' : (_n.split(' ')[0] as 'completo' | 'otro' | 'vacio')
    expect(hashDe(datos)).toBe(HASH_ES[clave])
    expect(hashDe({ ...datos, idioma: 'es' })).toBe(HASH_ES[clave])
  })

  it('la regla de letra anterior al ADR 0048 tambien sigue igual', () => {
    expect(hashDe({ ...usd, letra: 'pesos-siempre' })).toBe(HASH_ES.usdPesosSiempre)
  })

  it('la huella de revision (sin fecha de firma) sigue igual', () => {
    expect(hashDe({ ...completo, fechaFirma: null, idioma: 'es' })).toBe(HASH_ES.huella)
  })

  it.each(Object.keys(HASH_ES.periodicidad) as Periodicidad[])('periodicidad %s sigue igual', (p) => {
    expect(hashDe({ ...otro, terminos: { ...otro.terminos, periodicidad: p } })).toBe(HASH_ES.periodicidad[p])
  })

  it('un contrato espanol congelado se coteja con su hash original', () => {
    expect(hashParaCotejar({ ...completo, idioma: 'es' }, HASH_ES.completo, sha)).toBe(HASH_ES.completo)
    expect(hashParaCotejar({ ...usd, idioma: 'es' }, HASH_ES.usdPesosSiempre, sha)).toBe(HASH_ES.usdPesosSiempre)
  })
})

describe('numeroALetras en INGLES', () => {
  it.each([
    [0, 'ZERO PESOS 00/100 MXN'],
    [1, 'ONE PESO 00/100 MXN'],
    [2, 'TWO PESOS 00/100 MXN'],
    [13, 'THIRTEEN PESOS 00/100 MXN'],
    [21, 'TWENTY-ONE PESOS 00/100 MXN'],
    [40, 'FORTY PESOS 00/100 MXN'],
    [99, 'NINETY-NINE PESOS 00/100 MXN'],
    [100, 'ONE HUNDRED PESOS 00/100 MXN'],
    [101, 'ONE HUNDRED ONE PESOS 00/100 MXN'],
    [115, 'ONE HUNDRED FIFTEEN PESOS 00/100 MXN'],
    [1000, 'ONE THOUSAND PESOS 00/100 MXN'],
    [1001, 'ONE THOUSAND ONE PESOS 00/100 MXN'],
    [21_000, 'TWENTY-ONE THOUSAND PESOS 00/100 MXN'],
    [1_000_000, 'ONE MILLION PESOS 00/100 MXN'],
    [2_000_001, 'TWO MILLION ONE PESOS 00/100 MXN'],
    [1_250_500, 'ONE MILLION TWO HUNDRED FIFTY THOUSAND FIVE HUNDRED PESOS 00/100 MXN'],
    [999_999_999, 'NINE HUNDRED NINETY-NINE MILLION NINE HUNDRED NINETY-NINE THOUSAND NINE HUNDRED NINETY-NINE PESOS 00/100 MXN'],
  ])('%d → %s', (n, esperado) => {
    expect(numeroALetras(n, 'MXN', 'en')).toBe(esperado)
  })

  it('centavos sobre 100, redondeados, y en dolares', () => {
    expect(numeroALetras(1234.5, 'MXN', 'en')).toBe('ONE THOUSAND TWO HUNDRED THIRTY-FOUR PESOS 50/100 MXN')
    expect(numeroALetras(5.01, 'USD', 'en')).toBe('FIVE DOLLARS 01/100 USD')
    expect(numeroALetras(1, 'USD', 'en')).toBe('ONE DOLLAR 00/100 USD')
    expect(numeroALetras(0.99, 'USD', 'en')).toBe('ZERO DOLLARS 99/100 USD')
  })
})

describe('numeroALetras en ITALIANO', () => {
  it.each([
    [0, 'ZERO PESOS 00/100 MXN'],
    [1, 'UN PESO 00/100 MXN'],
    [3, 'TRE PESOS 00/100 MXN'],
    [17, 'DICIASSETTE PESOS 00/100 MXN'],
    [21, 'VENTUNO PESOS 00/100 MXN'],
    [23, 'VENTITRÉ PESOS 00/100 MXN'],
    [28, 'VENTOTTO PESOS 00/100 MXN'],
    [100, 'CENTO PESOS 00/100 MXN'],
    [101, 'CENTOUNO PESOS 00/100 MXN'],
    [180, 'CENTOTTANTA PESOS 00/100 MXN'],
    [1000, 'MILLE PESOS 00/100 MXN'],
    [1001, 'MILLEUNO PESOS 00/100 MXN'],
    [1003, 'MILLETRÉ PESOS 00/100 MXN'],
    [2000, 'DUEMILA PESOS 00/100 MXN'],
    [21_000, 'VENTUNMILA PESOS 00/100 MXN'],
    [23_000, 'VENTITREMILA PESOS 00/100 MXN'],
    [1_000_000, 'UN MILIONE PESOS 00/100 MXN'],
    [2_000_000, 'DUE MILIONI PESOS 00/100 MXN'],
    [21_000_000, 'VENTUN MILIONI PESOS 00/100 MXN'],
    [1_250_500, 'UN MILIONE DUECENTOCINQUANTAMILACINQUECENTO PESOS 00/100 MXN'],
  ])('%d → %s', (n, esperado) => {
    expect(numeroALetras(n, 'MXN', 'it')).toBe(esperado)
  })

  it('centavos sobre 100, redondeados, y en dolares', () => {
    expect(numeroALetras(1234.5, 'MXN', 'it')).toBe('MILLEDUECENTOTRENTAQUATTRO PESOS 50/100 MXN')
    expect(numeroALetras(1, 'USD', 'it')).toBe('UN DOLLARO 00/100 USD')
    expect(numeroALetras(5.01, 'USD', 'it')).toBe('CINQUE DOLLARI 01/100 USD')
  })
})

describe('numeroALetras en espanol: la firma de siempre', () => {
  it('sin idioma es el espanol, byte a byte', () => {
    expect(numeroALetras(1234.5)).toBe('MIL DOSCIENTOS TREINTA Y CUATRO PESOS 50/100 M.N.')
    expect(numeroALetras(1234.5, 'MXN', 'es')).toBe(numeroALetras(1234.5))
    expect(numeroALetras(1, 'USD', 'es')).toBe('UN DÓLAR 00/100 USD')
  })
})

describe('fechaEnLetra por idioma', () => {
  it('es, en, it', () => {
    expect(fechaEnLetra('2026-08-01')).toBe('1 de agosto de 2026')
    expect(fechaEnLetra('2026-08-01', 'es')).toBe('1 de agosto de 2026')
    expect(fechaEnLetra('2026-08-01', 'en')).toBe('August 1, 2026')
    expect(fechaEnLetra('2026-12-31', 'it')).toBe('31 dicembre 2026')
  })
})

// Palabras que delatarian un contrato a medio traducir. Son de la PLANTILLA,
// no de los datos (los datos del expediente —nombres, direcciones— van tal cual).
const ESPANOL_DE_PLANTILLA = [
  'ARRENDADOR', 'ARRENDATARIO', 'DECLARACIONES', 'CLÁUSULAS', 'PRIMERA', 'VIGENCIA', 'RENTA Y FORMA DE PAGO', 'M.N.',
  ' de agosto de ', 'cada mes', 'Declara', 'Contrato de arrendamiento', 'firman por duplicado', 'Registro Federal de Contribuyentes',
]

describe('ADR 0049 · el contrato en INGLES', () => {
  const texto = documentoATexto(generarContrato({ ...completo, idioma: 'en' }))

  it('no arrastra ni una palabra de la plantilla espanola', () => {
    for (const p of ESPANOL_DE_PLANTILLA) expect(texto, p).not.toContain(p)
  })

  it('las partes, los encabezados, la cifra, la letra y las fechas, en ingles', () => {
    expect(texto).toContain('ADVERTISING SPACE LEASE AGREEMENT')
    expect(texto).toContain('THE LESSOR')
    expect(texto).toContain('THE LESSEE')
    expect(texto).toContain('\nRECITALS\n')
    expect(texto).toContain('\nCLAUSES\n')
    expect(texto).toContain('FIRST. PURPOSE.')
    expect(texto).toContain('$1,234,567.89 MXN (ONE MILLION TWO HUNDRED THIRTY-FOUR THOUSAND FIVE HUNDRED SIXTY-SEVEN PESOS 89/100 MXN)')
    expect(texto).toContain('from August 1, 2026 to July 31, 2028')
    expect(texto).toContain('every month')
    expect(texto).toContain('12.5 m wide by 6 m high (75.00 m²)')
    expect(texto).toContain('July 29, 2026')
  })

  it('el encabezado del texto sellado sale de la misma tabla que pinta la pagina', () => {
    expect(encabezadosDocumento('en')).toMatchObject({ declaraciones: 'RECITALS', clausulas: 'CLAUSES' })
    expect(encabezadosDocumento('es')).toMatchObject({ declaraciones: 'DECLARACIONES', clausulas: 'CLÁUSULAS' })
  })
})

describe('ADR 0049 · el contrato en ITALIANO', () => {
  const texto = documentoATexto(generarContrato({ ...completo, idioma: 'it' }))

  it('no arrastra ni una palabra de la plantilla espanola', () => {
    for (const p of ESPANOL_DE_PLANTILLA) expect(texto, p).not.toContain(p)
  })

  it('le parti, le intestazioni, la cifra, la lettera e le date, in italiano', () => {
    expect(texto).toContain('CONTRATTO DI LOCAZIONE DI SPAZIO PUBBLICITARIO')
    expect(texto).toContain('IL LOCATORE')
    expect(texto).toContain('IL CONDUTTORE')
    expect(texto).toContain('\nPREMESSE\n')
    expect(texto).toContain('\nCLAUSOLE\n')
    expect(texto).toContain('PRIMA. OGGETTO.')
    expect(texto).toContain('1.234.567,89 MXN (UN MILIONE DUECENTOTRENTAQUATTROMILACINQUECENTOSESSANTASETTE PESOS 89/100 MXN)')
    expect(texto).toContain('a decorrere dal giorno 1 agosto 2026 e fino al giorno 31 luglio 2028')
    expect(texto).toContain('12,5 m di larghezza per 6 m di altezza (75,00 m²)')
    expect(texto).toContain('29 luglio 2026')
  })
})

// Recorrido del italiano (04/11), decision del orquestador. El texto legal
// italiano sigue pendiente de abogado (D13); esto corrige solo la lengua.
describe('ADR 0049 · el contrato en ITALIANO, corregido en el recorrido', () => {
  const texto = documentoATexto(generarContrato({ ...completo, idioma: 'it' }))
  it('apostrofo tipografico en todo el texto (nunca el recto)', () => {
    expect(texto).not.toContain("'")
    expect(texto).toContain('l’autorizzazione preventiva')
  })
  it('«all’installazione», no «a l’installazione»', () => {
    expect(texto).toContain('esclusivamente all’installazione, alla gestione e allo sfruttamento commerciale')
    expect(texto).not.toMatch(/a l[’']/)
  })
  it('un uso escrito por una persona no se contrae con la preposicion', () => {
    const conUso = documentoATexto(generarContrato({ ...completo, idioma: 'it', terminos: { ...completo.terminos, usoPermitido: 'l’esposizione di insegne luminose' } }))
    expect(conUso).toContain('esclusivamente al seguente uso: l’esposizione di insegne luminose')
  })
  it('ninguna fecha con preposicion articulada delante (1, 8 y 11 pedirian elision)', () => {
    for (const [ini, fin, firma] of [['2026-08-01', '2027-08-08', '2026-07-11'], ['2026-11-11', '2027-01-08', '2026-10-01']]) {
      const t = documentoATexto(generarContrato({ ...completo, idioma: 'it', terminos: { ...completo.terminos, fechaInicio: ini, fechaFin: fin }, fechaFirma: firma }))
      expect(t).not.toMatch(/(il|al|dal|del|nel|sul|all’|dall’|dell’|l’)s?d{1,2} (gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/)
      expect(t).toContain('in data ')
    }
  })
})

describe('ADR 0049 · lo que NO depende del idioma', () => {
  it('mismas clausulas y mismos faltantes en los tres idiomas', () => {
    const es = generarContrato({ ...vacio, idioma: 'es' })
    for (const idioma of ['en', 'it'] as const) {
      const d = generarContrato({ ...vacio, idioma })
      expect(d.clausulas.map((c) => c.parrafos.length)).toEqual(es.clausulas.map((c) => c.parrafos.length))
      expect(d.declaraciones.map((x) => x.incisos.length)).toEqual(es.declaraciones.map((x) => x.incisos.length))
      // Los faltantes son INTERFAZ (la barra del documento los traduce al
      // idioma de quien mira), no texto del contrato.
      expect(d.faltantes).toEqual(es.faltantes)
    }
  })

  it('cada firma dice su PARTE, para emparejarla sin leer el rol en un idioma', () => {
    for (const idioma of ['es', 'en', 'it'] as const) {
      const d = generarContrato({ ...completo, idioma })
      expect(d.firmas.map((f) => f.parte)).toEqual(['ARRENDADOR', 'ARRENDATARIO'])
      expect(d.idioma).toBe(idioma)
    }
    expect(generarContrato(completo).idioma).toBe('es')
  })

  it('los datos del expediente van tal cual en cualquier idioma', () => {
    for (const idioma of ['en', 'it'] as const) {
      const t = documentoATexto(generarContrato({ ...completo, idioma }))
      expect(t).toContain('Calle Falsa 123, CDMX')
      expect(t).toContain('PEJJ800101AAA')
    }
  })
})

describe('ADR 0049 · cotejar un contrato en/it', () => {
  it('se coteja contra el texto de SU idioma', () => {
    for (const idioma of ['en', 'it'] as const) {
      const guardado = hashDe({ ...usd, idioma })
      expect(hashParaCotejar({ ...usd, idioma }, guardado, sha)).toBe(guardado)
    }
  })

  it('NEGATIVO · si cambia un dato, aparece alterado (en/it no tienen regla vieja que lo tape)', () => {
    for (const idioma of ['en', 'it'] as const) {
      const guardado = hashDe({ ...usd, idioma })
      const tocado = { ...usd, idioma, terminos: { ...usd.terminos, montoRenta: 1 } }
      expect(hashParaCotejar(tocado, guardado, sha)).not.toBe(guardado)
    }
  })

  it('NEGATIVO · el mismo contrato en otro idioma tiene otro hash: el idioma es parte de lo firmado', () => {
    const es = hashDe({ ...completo, idioma: 'es' })
    expect(hashDe({ ...completo, idioma: 'en' })).not.toBe(es)
    expect(hashDe({ ...completo, idioma: 'it' })).not.toBe(es)
    // Y cotejar un congelado espanol con datos en ingles NO lo da por bueno.
    expect(hashParaCotejar({ ...completo, idioma: 'en' }, es, sha)).not.toBe(es)
  })
})

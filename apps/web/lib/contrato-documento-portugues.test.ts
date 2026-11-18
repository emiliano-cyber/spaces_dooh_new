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
import { completo, otro, vacio, usd } from './contrato-documento.datos-prueba'

// ============================================================================
//  P3 del portugues (05/11) · EL CONTRATO EN PORTUGUES (pt-BR), y que NINGUN
//  contrato ya firmado cambia un byte.
//
//  Tarea ROJA aprobada por el dueno el 05/11 («Si, igual que italiano»). El
//  contrato en portugues es una PLANTILLA DE EJEMPLO, como el ingles y el
//  italiano (D13 y D17: en un servidor en/it/pt el contrato que vale es el que
//  el cliente sube; el texto generado es un ejemplo).
//
//  Lo que este archivo protege, por orden de lo caro que sale equivocarlo:
//
//   1. Los hashes de los contratos en ESPANOL, INGLES e ITALIANO no cambian.
//      El espanol ya lo fija `contrato-documento-idioma.test.ts` (medido sobre
//      6779321d). El ingles y el italiano NO estaban fijados por hash en
//      ninguna prueba: se midieron AQUI sobre `integra/portugues` (e018b1bb),
//      ANTES de tocar `contrato-documento.ts`. Si uno cambia, una instancia
//      en/it que ya firmo veria sus firmas «alteradas».
//   2. La cantidad con letra en portugues (prevalece sobre la cifra).
//   3. Que un contrato en portugues no arrastre la plantilla espanola.
// ============================================================================

const sha = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex')
const hashDe = (args: Parameters<typeof generarContrato>[0]) => sha(documentoATexto(generarContrato(args)))

type Huellas = {
  completo: string
  otro: string
  vacio: string
  usd: string
  huella: string
  periodicidad: Record<Periodicidad, string>
}

// Medidos sobre e018b1bb, ANTES de este cambio. No se recalculan.
const ANTES: Record<'es' | 'en' | 'it', Huellas> = {
  es: {
    completo: 'fc94ef817d35e3ed85e65740348baae93d9e4c7bea7759ba383d9dd63878fbbc',
    otro: 'a62cf977f6ec6eece5369cf7d956c22f0c2dae14e447e974ac399f9f5d243f3a',
    vacio: '3855015c7c5e9e1012add7399a08d21f423d78caaa04014d2e1ee75d8d162419',
    usd: 'd19db10d6ad50e85119aaa9fe8646677e743833156821a4906a75f24160fba88',
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
    },
  },
  en: {
    completo: '6164b837c386f513e81a33152e7bec2898aae8863a239d83b4c6a5b1c9f6ba96',
    otro: 'dcd0cc291382413565874e1632c4d2586ad3c56f1eddc249a8fe12b1bccf108e',
    vacio: '1dc69c1398fdff32dd6f169dfed3c98be589fd63eb288d730a436997aae870d7',
    usd: '11b7802b816664d980a2757e769a52a6281d7bfb470a4cb62020cd87fd803ea5',
    huella: '1158ad83faafec12c20330ea95eb55b0a033b10bbf589333d25731e3064081cd',
    periodicidad: {
      SEMANAL: '74aa52b122ce7d554d2a780f4dd4a46b8c4eef782212e45da281a49e9c5248cf',
      CATORCENAL: 'e478c1834a8734f5efae7f7a605517d7592b9f98aba022696d1846b7f6080457',
      QUINCENAL: '1dfa305cda11b9c5a40bba7cbdfb3c564d6eb432cfb3d175f4a2c054add27bca',
      MENSUAL: '13360c2ae84ef7b0b7bd5da0422936c27f87c68f8cd596b5e3abf4df5d26a71b',
      BIMESTRAL: '48abd6725120c60d4366058f54b7bc529ab2afc5aaf5d7215f04e42d745a9f22',
      TRIMESTRAL: '1cae854b37749cfdaea841b5bc65d04c2c8662c0ec768c805bbf14084d9628ca',
      SEMESTRAL: 'ba7a9eb2eca1d2a493b46bf5f2bd32e4d66f2368c05c61089130b994b2ac1ca1',
      ANUAL: 'dcd0cc291382413565874e1632c4d2586ad3c56f1eddc249a8fe12b1bccf108e',
    },
  },
  it: {
    completo: 'be67a63857c514b76a0de240fe6b67382d3f0cb3587753e7cc67ae652745e21e',
    otro: '07bb6e67fb9bf3118c7f8ed8e80eebef601fa0f4ad9f74eece25a4f09ca43bfa',
    vacio: '1376ca061bfcba92760460a83f34c00db2a8c954d6187fa719c80b0aa8595701',
    usd: '61705997a11b164be28f8dc7d264599c66461c5da14ed9199f2f19aea3d02047',
    huella: '7f5e66102b813da7fcf5df43c67ae77f74d73a22a50628abbe3d5b483397a5f0',
    periodicidad: {
      SEMANAL: 'e91c0341da524d6de47aa27ed8cbe5fc472030396c0e6a308c1cf530569c3e71',
      CATORCENAL: '22d42f69a954c97c89d875b79f8c3e0202fb99a6ffa5c000cfa298fe33a365a6',
      QUINCENAL: 'd9bfb2e177a99d9a94a8718c09fb376b4d800c28e9c9993557c5e2c4813c0867',
      MENSUAL: 'acce5584b319d1317d352e580c7db18a0753b51ce5a8e1ee9085a316ebbd216d',
      BIMESTRAL: '80b12c60800aa18637fa658d399db52b940d147c1bd087efd3a50a41f5b9c2c6',
      TRIMESTRAL: '4edc80ece0db267e0d57afbe96a19ba6307c0e04897532b4b5eab6c623b7acf7',
      SEMESTRAL: '43c2652b0b01d525b7d65ddc479142f9f154b8b554c5bde92e3c60a8e57ad14d',
      ANUAL: '07bb6e67fb9bf3118c7f8ed8e80eebef601fa0f4ad9f74eece25a4f09ca43bfa',
    },
  },
}

describe.each(['es', 'en', 'it'] as const)('P3 · el contrato en %s NO cambia ni un byte', (idioma) => {
  const h = ANTES[idioma]
  it('completo, persona moral, todos los huecos, USD y la huella de revision', () => {
    expect(hashDe({ ...completo, idioma })).toBe(h.completo)
    expect(hashDe({ ...otro, idioma })).toBe(h.otro)
    expect(hashDe({ ...vacio, idioma })).toBe(h.vacio)
    expect(hashDe({ ...usd, idioma })).toBe(h.usd)
    expect(hashDe({ ...completo, fechaFirma: null, idioma })).toBe(h.huella)
  })
  it.each(Object.keys(h.periodicidad) as Periodicidad[])('periodicidad %s', (p) => {
    expect(hashDe({ ...otro, idioma, terminos: { ...otro.terminos, periodicidad: p } })).toBe(h.periodicidad[p])
  })
  it('un congelado se sigue cotejando con su hash original', () => {
    expect(hashParaCotejar({ ...completo, idioma }, h.completo, sha)).toBe(h.completo)
  })
})

// ─── La cantidad con letra en portugues de Brasil ───────────────────────────
// Reglas (gramatica normativa del portugues; la de cheques y contratos en Brasil):
//  · «e» entre centenas, decenas y unidades: CENTO E VINTE E TRES.
//  · 100 es CEM; 101–199, CENTO E …
//  · 1 000 es MIL (nunca «UM MIL»); entre el millar y lo que sigue va «e»
//    solo si lo que sigue es menor que 100 o centenas cerradas
//    (MIL E CEM, MIL E CINQUENTA, pero MIL DUZENTOS E TRINTA E QUATRO).
//  · Lo mismo entre millones y millares: UM MILHAO E DUZENTOS MIL.
//  · Millones cerrados llevan «DE» ante la moneda: UM MILHAO DE PESOS.
describe('numeroALetras en PORTUGUES (pt-BR)', () => {
  it.each([
    [0, 'ZERO PESOS 00/100 MXN'],
    [1, 'UM PESO 00/100 MXN'],
    [2, 'DOIS PESOS 00/100 MXN'],
    [3, 'TRÊS PESOS 00/100 MXN'],
    [10, 'DEZ PESOS 00/100 MXN'],
    [14, 'QUATORZE PESOS 00/100 MXN'],
    [16, 'DEZESSEIS PESOS 00/100 MXN'],
    [17, 'DEZESSETE PESOS 00/100 MXN'],
    [19, 'DEZENOVE PESOS 00/100 MXN'],
    [21, 'VINTE E UM PESOS 00/100 MXN'],
    [40, 'QUARENTA PESOS 00/100 MXN'],
    [99, 'NOVENTA E NOVE PESOS 00/100 MXN'],
    [100, 'CEM PESOS 00/100 MXN'],
    [101, 'CENTO E UM PESOS 00/100 MXN'],
    [115, 'CENTO E QUINZE PESOS 00/100 MXN'],
    [123, 'CENTO E VINTE E TRÊS PESOS 00/100 MXN'],
    [200, 'DUZENTOS PESOS 00/100 MXN'],
    [500, 'QUINHENTOS PESOS 00/100 MXN'],
    [1000, 'MIL PESOS 00/100 MXN'],
    [1001, 'MIL E UM PESOS 00/100 MXN'],
    [1050, 'MIL E CINQUENTA PESOS 00/100 MXN'],
    [1100, 'MIL E CEM PESOS 00/100 MXN'],
    [1200, 'MIL E DUZENTOS PESOS 00/100 MXN'],
    [1234, 'MIL DUZENTOS E TRINTA E QUATRO PESOS 00/100 MXN'],
    [2000, 'DOIS MIL PESOS 00/100 MXN'],
    [21_000, 'VINTE E UM MIL PESOS 00/100 MXN'],
    [100_000, 'CEM MIL PESOS 00/100 MXN'],
    [101_000, 'CENTO E UM MIL PESOS 00/100 MXN'],
    [1_000_000, 'UM MILHÃO DE PESOS 00/100 MXN'],
    [2_000_000, 'DOIS MILHÕES DE PESOS 00/100 MXN'],
    [2_000_001, 'DOIS MILHÕES E UM PESOS 00/100 MXN'],
    [1_001_000, 'UM MILHÃO E MIL PESOS 00/100 MXN'],
    [1_200_000, 'UM MILHÃO E DUZENTOS MIL PESOS 00/100 MXN'],
    [1_250_500, 'UM MILHÃO DUZENTOS E CINQUENTA MIL E QUINHENTOS PESOS 00/100 MXN'],
    [
      999_999_999,
      'NOVECENTOS E NOVENTA E NOVE MILHÕES NOVECENTOS E NOVENTA E NOVE MIL NOVECENTOS E NOVENTA E NOVE PESOS 00/100 MXN',
    ],
  ])('%d → %s', (n, esperado) => {
    expect(numeroALetras(n, 'MXN', 'pt')).toBe(esperado)
  })

  it('el ejemplo del encargo: 1234.50', () => {
    expect(numeroALetras(1234.5, 'MXN', 'pt')).toBe('MIL DUZENTOS E TRINTA E QUATRO PESOS 50/100 MXN')
  })

  it('centavos sobre 100, redondeados, y en dolares', () => {
    expect(numeroALetras(5.01, 'USD', 'pt')).toBe('CINCO DÓLARES 01/100 USD')
    expect(numeroALetras(1, 'USD', 'pt')).toBe('UM DÓLAR 00/100 USD')
    expect(numeroALetras(0.99, 'USD', 'pt')).toBe('ZERO DÓLARES 99/100 USD')
    expect(numeroALetras(3_000_000, 'USD', 'pt')).toBe('TRÊS MILHÕES DE DÓLARES 00/100 USD')
  })

  it('NEGATIVO · sin «UM MIL», sin «CEM E», sin «M.N.» (eso es del espanol)', () => {
    for (const n of [1000, 1100, 100_100, 1_001_000, 123_456.78]) {
      const t = numeroALetras(n, 'MXN', 'pt')
      expect(t, String(n)).not.toMatch(/\bUM MIL\b|\bCEM E\b|M\.N\./)
    }
  })

  it('el espanol sigue siendo el de siempre', () => {
    expect(numeroALetras(1234.5)).toBe('MIL DOSCIENTOS TREINTA Y CUATRO PESOS 50/100 M.N.')
  })
})

describe('fechaEnLetra en portugues', () => {
  it('«1º de agosto de 2026», el resto sin ordinal, mes en minuscula', () => {
    expect(fechaEnLetra('2026-08-01', 'pt')).toBe('1º de agosto de 2026')
    expect(fechaEnLetra('2026-12-31', 'pt')).toBe('31 de dezembro de 2026')
    expect(fechaEnLetra('2026-03-02', 'pt')).toBe('2 de março de 2026')
    expect(fechaEnLetra(null, 'pt')).toBe('_______________')
  })
})

// Palabras de la PLANTILLA espanola que no comparte el portugues. («CLÁUSULAS»
// y « de agosto de » se escriben igual en los dos idiomas: no sirven.)
const ESPANOL_DE_PLANTILLA = [
  'ARRENDADOR', 'ARRENDATARIO', 'DECLARACIONES', 'PRIMERA', 'VIGENCIA', 'RENTA Y FORMA DE PAGO', 'M.N.',
  'cada mes', 'Declara EL', 'Contrato de arrendamiento', 'firman por duplicado', 'Registro Federal de Contribuyentes',
  ' Y ', 'EL ESPACIO', 'días naturales',
]

describe('P3 · el contrato en PORTUGUES', () => {
  const doc = generarContrato({ ...completo, idioma: 'pt' })
  const texto = documentoATexto(doc)

  it('no arrastra ni una palabra de la plantilla espanola', () => {
    for (const p of ESPANOL_DE_PLANTILLA) expect(texto, p).not.toContain(p)
  })

  it('las partes, los encabezados, la cifra, la letra y las fechas, en portugues', () => {
    expect(texto.startsWith('CONTRATO DE LOCAÇÃO DE ESPAÇO PUBLICITÁRIO\n')).toBe(true)
    expect(texto).toContain('LOCADOR')
    expect(texto).toContain('LOCATÁRIO')
    expect(texto).toContain('\nDECLARAÇÕES\n')
    expect(texto).toContain('\nCLÁUSULAS\n')
    expect(texto).toContain('PRIMEIRA. OBJETO.')
    expect(texto).toContain(
      '1.234.567,89 MXN (UM MILHÃO DUZENTOS E TRINTA E QUATRO MIL QUINHENTOS E SESSENTA E SETE PESOS 89/100 MXN)',
    )
    expect(texto).toContain('de 1º de agosto de 2026 a 31 de julho de 2028')
    expect(texto).toContain('a cada mês')
    expect(texto).toContain('12,5 m de largura por 6 m de altura (75,00 m²)')
    expect(texto).toContain('em 29 de julho de 2026')
    expect(texto).toContain('reajustado anualmente em 8%')
    expect(doc.idioma).toBe('pt')
  })

  it('H4 (validacion de P3) · crase en «à sua inteira satisfação»', () => {
    expect(texto).toContain('que o recebe à sua inteira satisfação')
    expect(texto).not.toContain(' a sua inteira')
  })

  it('las contracciones con las partes: «ao LOCATÁRIO», «do ESPAÇO», nunca «a o»/«de o»', () => {
    expect(texto).toContain('ao LOCATÁRIO')
    expect(texto).toContain('do ESPAÇO')
    expect(texto).not.toMatch(/\b(a|de|em|por) o (LOCADOR|LOCATÁRIO|ESPAÇO)\b/)
    expect(texto).not.toMatch(/\b(a|de|em|por) O (LOCADOR|LOCATÁRIO|ESPAÇO)\b/)
  })

  it('el uso por omision va contraido; uno escrito por una persona va tras dos puntos', () => {
    expect(texto).toContain('exclusivamente à instalação, à operação e à exploração comercial de uma estrutura publicitária')
    const conUso = documentoATexto(
      generarContrato({ ...completo, idioma: 'pt', terminos: { ...completo.terminos, usoPermitido: 'a exibição de anúncios luminosos' } }),
    )
    expect(conUso).toContain('exclusivamente ao seguinte uso: a exibição de anúncios luminosos')
  })

  it('el encabezado sellado y lo que la pagina imprime salen de la misma tabla', () => {
    expect(encabezadosDocumento('pt')).toMatchObject({
      declaraciones: 'DECLARAÇÕES',
      clausulas: 'CLÁUSULAS',
      selloFirmado: 'ASSINADO ELETRONICAMENTE',
      selloInvalidada: 'ASSINATURA INVALIDADA',
    })
    expect(encabezadosDocumento('pt').aviso).toMatch(/^Documento gerado automaticamente pelo SPACE OS/)
  })

  it('persona moral, sin representante: «pessoa jurídica» y la firma sin «P.p.»', () => {
    const t = documentoATexto(generarContrato({ ...otro, idioma: 'pt' }))
    expect(t).toContain('pessoa jurídica legalmente constituída')
    expect(t).toContain('NÃO se renova automaticamente')
    expect(t).not.toContain('P.p.')
  })
})

describe('P3 · lo que NO depende del idioma, tambien en portugues', () => {
  it('mismas clausulas, mismos incisos y mismos faltantes que el espanol', () => {
    for (const datos of [vacio, completo, otro]) {
      const es = generarContrato({ ...datos, idioma: 'es' })
      const pt = generarContrato({ ...datos, idioma: 'pt' })
      expect(pt.clausulas.map((c) => c.parrafos.length)).toEqual(es.clausulas.map((c) => c.parrafos.length))
      expect(pt.declaraciones.map((x) => x.incisos.length)).toEqual(es.declaraciones.map((x) => x.incisos.length))
      expect(pt.faltantes).toEqual(es.faltantes)
    }
  })

  it('cada firma dice su PARTE', () => {
    const d = generarContrato({ ...completo, idioma: 'pt' })
    expect(d.firmas.map((f) => f.parte)).toEqual(['ARRENDADOR', 'ARRENDATARIO'])
    expect(d.firmas.map((f) => f.rol)).toEqual(['O LOCADOR', 'O LOCATÁRIO'])
  })

  it('los datos del expediente van tal cual', () => {
    const t = documentoATexto(generarContrato({ ...completo, idioma: 'pt' }))
    expect(t).toContain('Calle Falsa 123, CDMX')
    expect(t).toContain('PEJJ800101AAA')
    expect(t).toContain('nacionalidade mexicana')
  })
})

// El contrato PORTUGUES fijado por hash desde el 05/11, tras H4 de la
// validacion de P3 («à sua inteira satisfação»), cuando aun no habia ningun
// contrato pt congelado. A partir de aqui, cambiar su texto es cambiar lo que
// se firma: se actualiza a proposito y conservando la redaccion anterior para
// cotejar si ya hay contratos pt congelados (`hashParaCotejar`).
const HASH_PT: Huellas = {
  completo: '9028c240c097dd9792cee4aab0b951bc12fb3909711a716cdd01846ac0562ef5',
  otro: 'db2b3f2cf73bcd33f9556917a1b30f948ea67cbd97aafda9848d503be7a7e1ec',
  vacio: '192098f1b8c68c4378bb8418fb66d555cb88d77699e0993262d29a937af86514',
  usd: 'c0fb22f57d062e8730b5d372cbf52b76dcbe86c3ab1880d1a0a2888285c81e1f',
  huella: 'c819a11bac2a8c69a265e35e9699116482876f41853693feb9d94fd3afc1ae07',
  periodicidad: {
    SEMANAL: '01f51d40095f8e1807dda21de4c6c1518181c0d01d6bc757898ce7e264988fc6',
    CATORCENAL: '4726071c2d782188ded6ddb1ecd466b42f347952d7841855e6c412da8e58d32b',
    QUINCENAL: '24136bbbc1d33de10b43dd2b8b6405530fcc8422557b598d8f88b3270bf46dfd',
    MENSUAL: 'bba4c26a066db7b971b984786031730d5aab514a2ad39cb79c1a7c32026f9033',
    BIMESTRAL: '2f557db9d0d678c73f0e231aec13dd3145e431f6cf3004a2da93b84cae6e56fe',
    TRIMESTRAL: '02960f355674e5e0149884b2257201589f1e984ee375352f966095a8e159f064',
    SEMESTRAL: '698a05e0e6db07c64729634e06f0ac87512c924da448829f6ae08a8f5bf3e2b2',
    ANUAL: 'db2b3f2cf73bcd33f9556917a1b30f948ea67cbd97aafda9848d503be7a7e1ec',
  },
}

describe('P3 · el contrato en PORTUGUES, fijado por hash', () => {
  it('completo, persona moral, todos los huecos, USD y la huella de revision', () => {
    expect(hashDe({ ...completo, idioma: 'pt' })).toBe(HASH_PT.completo)
    expect(hashDe({ ...otro, idioma: 'pt' })).toBe(HASH_PT.otro)
    expect(hashDe({ ...vacio, idioma: 'pt' })).toBe(HASH_PT.vacio)
    expect(hashDe({ ...usd, idioma: 'pt' })).toBe(HASH_PT.usd)
    expect(hashDe({ ...completo, fechaFirma: null, idioma: 'pt' })).toBe(HASH_PT.huella)
  })
  it.each(Object.keys(HASH_PT.periodicidad) as Periodicidad[])('periodicidad %s', (p) => {
    expect(hashDe({ ...otro, idioma: 'pt', terminos: { ...otro.terminos, periodicidad: p } })).toBe(HASH_PT.periodicidad[p])
  })
})

describe('P3 · cotejar un contrato en portugues', () => {
  it('se coteja contra el texto de SU idioma', () => {
    const guardado = hashDe({ ...usd, idioma: 'pt' })
    expect(hashParaCotejar({ ...usd, idioma: 'pt' }, guardado, sha)).toBe(guardado)
  })

  it('NEGATIVO · si cambia un dato, aparece alterado (pt no tiene regla vieja que lo tape)', () => {
    const guardado = hashDe({ ...usd, idioma: 'pt' })
    const tocado = { ...usd, idioma: 'pt' as const, terminos: { ...usd.terminos, montoRenta: 1 } }
    expect(hashParaCotejar(tocado, guardado, sha)).not.toBe(guardado)
  })

  it('NEGATIVO · el mismo contrato en portugues tiene otro hash que en los otros tres', () => {
    const pt = hashDe({ ...completo, idioma: 'pt' })
    for (const i of ['es', 'en', 'it'] as const) expect(pt).not.toBe(ANTES[i].completo)
    expect(hashParaCotejar({ ...completo, idioma: 'pt' }, ANTES.es.completo, sha)).not.toBe(ANTES.es.completo)
  })

  it('es determinista: mismas entradas, mismo hash', () => {
    expect(hashDe({ ...completo, idioma: 'pt' })).toBe(hashDe({ ...completo, idioma: 'pt' }))
  })
})

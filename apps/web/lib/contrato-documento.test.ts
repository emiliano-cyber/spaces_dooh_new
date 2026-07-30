import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { generarContrato, numeroALetras, fechaEnLetra, fechaISO, documentoATexto, FALTA } from './contrato-documento'

describe('numeroALetras', () => {
  // El importe en letra es el que prevalece si discrepa de la cifra, así que
  // estos casos son la parte del documento que más caro sale equivocar.
  it.each([
    [0, 'CERO PESOS 00/100 M.N.'],
    [1, 'UN PESO 00/100 M.N.'],
    [21, 'VEINTIÚN PESOS 00/100 M.N.'],
    [26, 'VEINTISÉIS PESOS 00/100 M.N.'],
    [31, 'TREINTA Y UN PESOS 00/100 M.N.'],
    [100, 'CIEN PESOS 00/100 M.N.'],
    [101, 'CIENTO UN PESOS 00/100 M.N.'],
    [1000, 'MIL PESOS 00/100 M.N.'],
    [2000, 'DOS MIL PESOS 00/100 M.N.'],
    [25000, 'VEINTICINCO MIL PESOS 00/100 M.N.'],
    [1_000_000, 'UN MILLÓN PESOS 00/100 M.N.'],
    [1_250_500, 'UN MILLÓN DOSCIENTOS CINCUENTA MIL QUINIENTOS PESOS 00/100 M.N.'],
  ])('%d → %s', (n, esperado) => {
    expect(numeroALetras(n as number)).toBe(esperado)
  })

  it('escribe los centavos sobre 100 y los redondea', () => {
    expect(numeroALetras(1234.5)).toBe('MIL DOSCIENTOS TREINTA Y CUATRO PESOS 50/100 M.N.')
    expect(numeroALetras(99.99)).toBe('NOVENTA Y NUEVE PESOS 99/100 M.N.')
    // Un centavo suelto debe quedar 01/100, no 1/100.
    expect(numeroALetras(5.01)).toContain('01/100')
  })
})

describe('fechaISO', () => {
  // Regresión: `pg` devuelve una columna `date` como objeto Date, no como
  // cadena. Con String(fecha).slice(0,10) salía "Fri Jul 3" y el contrato se
  // imprimía con la vigencia EN BLANCO sin que nada lo reportara.
  it('normaliza el objeto Date que devuelve pg', () => {
    expect(fechaISO(new Date(2026, 7, 1))).toBe('2026-08-01')
    expect(fechaISO(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('usa las partes LOCALES, no UTC: medianoche local no debe retroceder un día', () => {
    // El Date llega a medianoche local. Con toISOString() en husos positivos
    // (UTC+X) el instante UTC cae el día anterior y la fecha retrocedería.
    const d = new Date(2026, 0, 1, 0, 0, 0)
    expect(fechaISO(d)).toBe('2026-01-01')
  })

  it('deja pasar una cadena ISO y rechaza lo que no lo sea', () => {
    expect(fechaISO('2026-08-01')).toBe('2026-08-01')
    expect(fechaISO('2026-08-01T00:00:00.000Z')).toBe('2026-08-01')
    expect(fechaISO('Fri Jul 31 2026')).toBeNull()
    expect(fechaISO(null)).toBeNull()
    expect(fechaISO(new Date('no-es-fecha'))).toBeNull()
  })
})

describe('fechaEnLetra', () => {
  it('escribe la fecha en prosa y sin desfase de zona horaria', () => {
    // Con `new Date('2026-01-01')` en UTC-6 saldría 31 de diciembre. Se parsea
    // la cadena a mano justamente para evitarlo.
    expect(fechaEnLetra('2026-01-01')).toBe('1 de enero de 2026')
    expect(fechaEnLetra('2026-12-31')).toBe('31 de diciembre de 2026')
  })
  it('marca la fecha ausente en vez de inventarla', () => {
    expect(fechaEnLetra(null)).toBe(FALTA)
  })
})

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
    ancho: 12,
    alto: 6,
    predio: 'Torre Reforma 222',
  },
  terminos: {
    fechaInicio: '2026-08-01',
    fechaFin: '2028-07-31',
    montoRenta: 25000,
    periodicidad: 'MENSUAL' as const,
    moneda: 'MXN',
    deposito: 50000,
    diaPago: 5,
    incrementoAnualPct: 8,
    usoPermitido: null,
    autoRenovable: true,
    ciudadFirma: 'Ciudad de México',
  },
  fechaFirma: '2026-07-29',
}

describe('generarContrato', () => {
  it('con el expediente completo no reporta faltantes', () => {
    expect(generarContrato(completo).faltantes).toEqual([])
  })

  it('numera las cláusulas en ordinal femenino y sin huecos', () => {
    const d = generarContrato(completo)
    expect(d.clausulas[0].ordinal).toBe('PRIMERA')
    expect(d.clausulas[1].ordinal).toBe('SEGUNDA')
    expect(d.clausulas[9].ordinal).toBe('DÉCIMA')
    expect(d.clausulas[10].ordinal).toBe('DÉCIMA PRIMERA')
    expect(new Set(d.clausulas.map((c) => c.ordinal)).size).toBe(d.clausulas.length)
  })

  it('lleva las tres declaraciones de un contrato mexicano', () => {
    const d = generarContrato(completo)
    expect(d.declaraciones).toHaveLength(3)
    expect(d.declaraciones[0].encabezado).toContain('EL ARRENDADOR')
    expect(d.declaraciones[1].encabezado).toContain('EL ARRENDATARIO')
    expect(d.declaraciones[2].encabezado).toContain('AMBAS PARTES')
  })

  it('escribe la renta en cifra Y en letra', () => {
    const renta = generarContrato(completo).clausulas.find((c) => c.titulo.includes('RENTA'))!
    expect(renta.parrafos[0]).toContain('$25,000.00 MXN')
    expect(renta.parrafos[0]).toContain('VEINTICINCO MIL PESOS 00/100 M.N.')
    expect(renta.parrafos[0]).toContain('cada mes')
  })

  it('incluye depósito e incremento solo cuando se pactaron', () => {
    const con = generarContrato(completo).clausulas.find((c) => c.titulo.includes('RENTA'))!
    expect(con.parrafos.join(' ')).toContain('depósito en garantía')
    expect(con.parrafos.join(' ')).toContain('8%')

    const sin = generarContrato({
      ...completo,
      terminos: { ...completo.terminos, deposito: null, incrementoAnualPct: null },
    }).clausulas.find((c) => c.titulo.includes('RENTA'))!
    expect(sin.parrafos.join(' ')).not.toContain('depósito en garantía')
    expect(sin.parrafos.join(' ')).not.toContain('incrementará')
  })

  it('la vigencia refleja si hay o no renovación automática', () => {
    const auto = generarContrato(completo).clausulas.find((c) => c.titulo === 'VIGENCIA')!
    expect(auto.parrafos[1]).toContain('prorrogará automáticamente')

    const manual = generarContrato({
      ...completo,
      terminos: { ...completo.terminos, autoRenovable: false },
    }).clausulas.find((c) => c.titulo === 'VIGENCIA')!
    expect(manual.parrafos[1]).toContain('NO se renueva')
  })

  it('marca los datos ausentes en vez de inventarlos', () => {
    const d = generarContrato({
      ...completo,
      arrendatario: { ...completo.arrendatario, rfc: null, domicilioFiscal: null },
      terminos: { ...completo.terminos, montoRenta: null },
    })
    expect(d.faltantes).toContain('RFC de tu empresa')
    expect(d.faltantes).toContain('Domicilio fiscal de tu empresa')
    expect(d.faltantes).toContain('Importe de la renta')
    // Y el hueco es visible en el cuerpo del documento, no silencioso.
    expect(d.declaraciones[1].incisos.join(' ')).toContain(FALTA)
  })

  it('describe al arrendador persona moral como tal', () => {
    const d = generarContrato({
      ...completo,
      arrendador: { ...completo.arrendador, razonSocial: 'Predios del Norte SA de CV' },
    })
    expect(d.declaraciones[0].incisos[0]).toContain('moral legalmente constituida')
    expect(d.preambulo).toContain('Predios del Norte SA de CV')
  })

  it('la jurisdicción cae a la ciudad del espacio si no se fijó ciudad de firma', () => {
    const d = generarContrato({
      ...completo,
      terminos: { ...completo.terminos, ciudadFirma: null },
    })
    const jur = d.clausulas.find((c) => c.titulo.includes('JURISDICCIÓN'))!
    expect(jur.parrafos[0]).toContain('Ciudad de México')
  })
})


describe('documentoATexto (lo que se sella con SHA-256)', () => {
  const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex')

  it('es determinista: mismas entradas → misma cadena → mismo hash', () => {
    const a = documentoATexto(generarContrato(completo))
    const b = documentoATexto(generarContrato(completo))
    expect(a).toBe(b)
    expect(sha(a)).toBe(sha(b))
  })

  it('cambiar la renta cambia el hash: es lo que detecta una firma invalidada', () => {
    const base = sha(documentoATexto(generarContrato(completo)))
    const otra = sha(
      documentoATexto(
        generarContrato({ ...completo, terminos: { ...completo.terminos, montoRenta: 26000 } }),
      ),
    )
    expect(otra).not.toBe(base)
  })

  it('cambiar un dato del ARRENDADOR también cambia el hash', () => {
    // El cambio puede venir de otra tabla: si el domicilio del arrendador se
    // edita, el texto del contrato cambia aunque el contrato no se toque.
    const base = sha(documentoATexto(generarContrato(completo)))
    const otra = sha(
      documentoATexto(
        generarContrato({
          ...completo,
          arrendador: { ...completo.arrendador, direccion: 'Otra calle 456, CDMX' },
        }),
      ),
    )
    expect(otra).not.toBe(base)
  })

  it('la fecha de firma forma parte del texto sellado', () => {
    // Por eso el congelado fija la fecha: si siguiera siendo "hoy", el hash
    // cambiaría al pasar la medianoche y toda firma se invalidaría sola.
    const a = sha(documentoATexto(generarContrato(completo)))
    const b = sha(documentoATexto(generarContrato({ ...completo, fechaFirma: '2026-07-30' })))
    expect(a).not.toBe(b)
  })

  it('incluye declaraciones, cláusulas y firmas', () => {
    const t = documentoATexto(generarContrato(completo))
    expect(t).toContain('DECLARACIONES')
    expect(t).toContain('CLÁUSULAS')
    expect(t).toContain('PRIMERA. OBJETO.')
    expect(t).toContain('EL ARRENDADOR:')
    expect(t).toContain('EL ARRENDATARIO:')
  })
})

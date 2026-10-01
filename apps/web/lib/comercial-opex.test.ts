import { describe, it, expect } from 'vitest'
import {
  DIAS_ENFRIADO,
  ESPACIOS,
  ETAPAS_RESPONSABLE,
  diasSinContacto,
  enfriados,
  resumen,
  ultimoAvance,
  espacioElegido,
  iniciales,
  type Espacio,
} from './comercial-opex'

// ============================================================================
//  Prospección de arrendadores · la maqueta NO tiene base, pero SÍ tiene cuentas
// ----------------------------------------------------------------------------
//  Es una maqueta y no hace falta probar que pinta bonito. Lo que sí hace falta
//  probar es lo único que aquí se CALCULA: cuántos días lleva un espacio sin
//  contacto y cuáles hay que retomar. Una cuenta sin prueba se equivoca en
//  silencio, y el día que esto deje de ser maqueta la cuenta se queda.
// ============================================================================

const HOY = new Date('2026-09-30T12:00:00Z')

const base = (): Espacio => ({
  id: 'x',
  nombre: 'X',
  tipo: 'Muro',
  direccion: '',
  estado: 'negociacion',
  etapa: 0,
  desde: '2026-01-01',
  negociante: 'Quien sea',
  medidas: '',
  presupuesto: { min: 0, max: 0, autoriza: '' },
  contactos: [],
  competencia: [],
  bitacora: [],
  ofertas: [],
  multimedia: [],
})

describe('1 · los días sin contacto', () => {
  it('sale del avance MÁS RECIENTE, no del primero de la lista', () => {
    const e = base()
    // A propósito desordenado: si se tomara el primero, daría 300 y pico.
    e.bitacora = [
      { fecha: '2025-12-01', contacto: 'a', canal: 'Llamada', resumen: '', siguiente: '' },
      { fecha: '2026-09-20', contacto: 'b', canal: 'Llamada', resumen: '', siguiente: '' },
    ]
    expect(ultimoAvance(e)?.fecha).toBe('2026-09-20')
    expect(diasSinContacto(e, HOY)).toBe(10)
  })

  it('sin bitácora devuelve NULL, y null NO es cero', () => {
    // «Nunca se ha hablado» y «se habló hoy» son cosas distintas. Pintar un 0
    // donde no se sabe es el `?? 0` del mapa otra vez.
    const e = base()
    expect(diasSinContacto(e, HOY)).toBeNull()
    expect(diasSinContacto(e, HOY)).not.toBe(0)
  })
})

describe('2 · cuáles hay que retomar', () => {
  it('uno EN NEGOCIACIÓN pasado el umbral entra', () => {
    const e = base()
    e.bitacora = [{ fecha: '2026-07-01', contacto: 'a', canal: 'Llamada', resumen: '', siguiente: '' }]
    expect(enfriados([e], HOY)).toHaveLength(1)
  })

  it('justo EN el umbral todavía NO entra: es «más de 30», no «30 o más»', () => {
    const e = base()
    const hace30 = new Date(HOY)
    hace30.setUTCDate(hace30.getUTCDate() - DIAS_ENFRIADO)
    e.bitacora = [
      { fecha: hace30.toISOString().slice(0, 10), contacto: 'a', canal: 'Llamada', resumen: '', siguiente: '' },
    ]
    expect(diasSinContacto(e, HOY)).toBe(DIAS_ENFRIADO)
    expect(enfriados([e], HOY)).toHaveLength(0)
  })

  it('un ACTIVO no entra aunque lleve un año: está contratado, no perseguido', () => {
    const e = base()
    e.estado = 'activo'
    e.bitacora = [{ fecha: '2025-01-01', contacto: 'a', canal: 'Correo', resumen: '', siguiente: '' }]
    expect(enfriados([e], HOY)).toHaveLength(0)
  })

  it('un INACTIVO tampoco: nadie lo está trabajando', () => {
    const e = base()
    e.estado = 'inactivo'
    e.bitacora = [{ fecha: '2025-01-01', contacto: 'a', canal: 'Correo', resumen: '', siguiente: '' }]
    expect(enfriados([e], HOY)).toHaveLength(0)
  })

  it('uno SIN bitácora no entra: no se puede afirmar que se enfrió', () => {
    expect(enfriados([base()], HOY)).toHaveLength(0)
  })
})

describe('3 · los datos de la maqueta son coherentes', () => {
  it('toda etapa cae dentro de las cinco declaradas', () => {
    for (const e of ESPACIOS) {
      expect(e.etapa, e.nombre).toBeGreaterThanOrEqual(0)
      expect(e.etapa, e.nombre).toBeLessThan(ETAPAS_RESPONSABLE.length)
    }
  })

  it('el resumen suma lo mismo que la lista', () => {
    const r = resumen(ESPACIOS, HOY)
    expect(r.total).toBe(ESPACIOS.length)
    expect(r.enNegociacion + r.activos).toBeLessThanOrEqual(r.total)
    expect(r.enfriados).toBeLessThanOrEqual(r.enNegociacion)
  })

  it('un espacio en la última etapa tiene a alguien que FIRMA', () => {
    // La etapa 4 se llama «Responsable legal confirmado». Si ningún contacto
    // lleva `legal`, la etapa está mintiendo.
    for (const e of ESPACIOS.filter((x) => x.etapa === ETAPAS_RESPONSABLE.length - 1)) {
      expect(e.contactos.some((c) => c.legal), e.nombre).toBe(true)
    }
  })
})

describe('espacioElegido · qué espacio se detalla (2026-09-30)', () => {
  // La maqueta pasó a dos columnas: lista a la izquierda, detalle a la derecha.
  // Elegir cuál ver no guarda nada; solo cambia lo que se pinta.
  it('devuelve el elegido por su id', () => {
    const otro = ESPACIOS[ESPACIOS.length - 1]
    expect(espacioElegido(ESPACIOS, otro.id)).toBe(otro)
  })
  it('sin elección, o con un id que no existe, el PRIMERO — nunca una pantalla vacía', () => {
    expect(espacioElegido(ESPACIOS, null)).toBe(ESPACIOS[0])
    expect(espacioElegido(ESPACIOS, 'no-existe')).toBe(ESPACIOS[0])
  })
  it('sin espacios, null', () => {
    expect(espacioElegido([], 'x')).toBeNull()
  })
})

describe('iniciales · el círculo de cada contacto (2026-09-30)', () => {
  it('quita el tratamiento y toma dos iniciales', () => {
    expect(iniciales('Ing. Roberto Salinas')).toBe('RS')
    expect(iniciales('Lic. Andrea Ruiz')).toBe('AR')
  })
  it('ignora paréntesis, números y signos: «C(» se colaba en la primera versión', () => {
    expect(iniciales('Sra. Carmen (vecina 1418)')).toBe('CV')
  })
  it('un nombre vacío no revienta', () => {
    expect(iniciales('')).toBe('')
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ES_CATALOGOS } from './catalogos'
import { traducir, type ClaveTexto } from '../diccionario'
import { motivoPaqueteInvalido } from '@/lib/paquete'
import { motivoFranjaInvalida, motivoTemporadaInvalida } from '@/lib/rejilla'
import { motivoTramoInvalido } from '@/lib/volumen'

// ============================================================================
//  Los MOTIVOS de rechazo: el espanol del diccionario es el literal del modulo.
// ----------------------------------------------------------------------------
//  `motivoPaqueteInvalido`, `motivoFranjaInvalida`, `motivoTemporadaInvalida` y
//  `motivoTramoInvalido` los usa TAMBIEN el servidor, que no pasa idioma. Se
//  recorre cada rama: en espanol tiene que salir lo de siempre (el literal del
//  modulo, que es lo que manda el servidor), y en ingles su clave con los
//  mismos huecos rellenos. Si alguien retoca un literal sin tocar el
//  diccionario —o al reves—, cae aqui.
// ============================================================================

type Caso = [string, (idioma: 'es' | 'en') => string | null, ClaveTexto, Record<string, string | number>?]
const PRIME = { id: 'a', nombre: 'Prime', horaInicio: '18:00', horaFin: '22:00' }
const BF = { id: 'a', nombre: 'Buen Fin', desde: '2026-11-13', hasta: '2026-11-16' }
const T50 = { id: 'a', unidad: 'spot', desdeCantidad: 50, descuentoPct: 10 }
const DOS = ['a', 'b']

const CASOS: Caso[] = [
  ['paquete sin nombre', (i) => motivoPaqueteInvalido({ nombre: ' ', precioCerrado: 1, sitios: DOS }, i), 'catalogos.motivo.paquete.nombre'],
  ['paquete nombre largo', (i) => motivoPaqueteInvalido({ nombre: 'x'.repeat(121), precioCerrado: 1, sitios: DOS }, i), 'catalogos.motivo.paquete.nombre-largo'],
  ['paquete precio no numero', (i) => motivoPaqueteInvalido({ nombre: 'P', precioCerrado: 'abc' as never, sitios: DOS }, i), 'catalogos.motivo.paquete.precio-numero'],
  ['paquete precio cero', (i) => motivoPaqueteInvalido({ nombre: 'P', precioCerrado: 0, sitios: DOS }, i), 'catalogos.motivo.paquete.precio-cero'],
  ['paquete con centavos', (i) => motivoPaqueteInvalido({ nombre: 'P', precioCerrado: 1.5, sitios: DOS }, i), 'catalogos.motivo.paquete.precio-entero'],
  ['paquete de una pantalla', (i) => motivoPaqueteInvalido({ nombre: 'P', precioCerrado: 1, sitios: ['a'] }, i), 'catalogos.motivo.paquete.dos-pantallas'],
  ['paquete repetida', (i) => motivoPaqueteInvalido({ nombre: 'P', precioCerrado: 1, sitios: ['a', 'a'] }, i), 'catalogos.motivo.paquete.repetida'],
  ['franja sin nombre', (i) => motivoFranjaInvalida({ ...PRIME, nombre: '' }, [], i), 'catalogos.motivo.franja.nombre'],
  ['franja hora mala', (i) => motivoFranjaInvalida({ ...PRIME, horaInicio: '25:00' }, [], i), 'catalogos.motivo.franja.hora', { nombre: 'Prime' }],
  ['franja misma hora', (i) => motivoFranjaInvalida({ ...PRIME, horaFin: '18:00' }, [], i), 'catalogos.motivo.franja.misma-hora', { nombre: 'Prime' }],
  [
    'franja solape',
    (i) => motivoFranjaInvalida(PRIME, [{ id: 'b', nombre: 'Tarde', horaInicio: '17:00', horaFin: '19:00' }], i),
    'catalogos.motivo.franja.solape',
    { nombre: 'Prime', inicio: '18:00', fin: '22:00', otra: 'Tarde', otraInicio: '17:00', otraFin: '19:00' },
  ],
  ['temporada sin nombre', (i) => motivoTemporadaInvalida({ ...BF, nombre: '' }, [], i), 'catalogos.motivo.temporada.nombre'],
  ['temporada fecha mala', (i) => motivoTemporadaInvalida({ ...BF, desde: '13/11/2026' }, [], i), 'catalogos.motivo.temporada.fecha', { nombre: 'Buen Fin' }],
  ['temporada al reves', (i) => motivoTemporadaInvalida({ ...BF, hasta: '2026-11-01' }, [], i), 'catalogos.motivo.temporada.al-reves', { nombre: 'Buen Fin' }],
  [
    'temporada solape',
    (i) => motivoTemporadaInvalida(BF, [{ id: 'b', nombre: 'Noviembre', desde: '2026-11-01', hasta: '2026-11-30' }], i),
    'catalogos.motivo.temporada.solape',
    { nombre: 'Buen Fin', desde: '2026-11-13', hasta: '2026-11-16', otra: 'Noviembre', otraDesde: '2026-11-01', otraHasta: '2026-11-30' },
  ],
  ['tramo sin unidad', (i) => motivoTramoInvalido({ ...T50, unidad: '' }, [], i), 'catalogos.motivo.tramo.unidad'],
  ['tramo cantidad no numero', (i) => motivoTramoInvalido({ ...T50, desdeCantidad: 'x' as never }, [], i), 'catalogos.motivo.tramo.cantidad-entera'],
  ['tramo cantidad de otro tipo', (i) => motivoTramoInvalido({ ...T50, desdeCantidad: null as never }, [], i), 'catalogos.motivo.tramo.cantidad-entera'],
  ['tramo fraccion', (i) => motivoTramoInvalido({ ...T50, desdeCantidad: 2.5 }, [], i), 'catalogos.motivo.tramo.sin-fracciones'],
  ['tramo desde 1', (i) => motivoTramoInvalido({ ...T50, desdeCantidad: 1 }, [], i), 'catalogos.motivo.tramo.desde-dos'],
  ['tramo pct no numero', (i) => motivoTramoInvalido({ ...T50, descuentoPct: 'x' as never }, [], i), 'catalogos.motivo.tramo.pct-numero'],
  ['tramo pct de otro tipo', (i) => motivoTramoInvalido({ ...T50, descuentoPct: null as never }, [], i), 'catalogos.motivo.tramo.pct-numero'],
  ['tramo pct cero', (i) => motivoTramoInvalido({ ...T50, descuentoPct: 0 }, [], i), 'catalogos.motivo.tramo.pct-cero'],
  ['tramo pct > 100', (i) => motivoTramoInvalido({ ...T50, descuentoPct: 101 }, [], i), 'catalogos.motivo.tramo.pct-cien'],
  ['tramo mismo umbral', (i) => motivoTramoInvalido(T50, [{ ...T50, id: 'b', descuentoPct: 12 }], i), 'catalogos.motivo.tramo.mismo-umbral', { n: 50, pct: 12 }],
  [
    'tramo mas y menos',
    (i) => motivoTramoInvalido(T50, [{ ...T50, id: 'b', desdeCantidad: 20, descuentoPct: 15 }], i),
    'catalogos.motivo.tramo.mas-y-menos',
    { otroDesde: 20, otroPct: 15, n: 50, pct: 10 },
  ],
  [
    'tramo menos y mas',
    (i) => motivoTramoInvalido(T50, [{ ...T50, id: 'b', desdeCantidad: 100, descuentoPct: 5 }], i),
    'catalogos.motivo.tramo.menos-y-mas',
    { otroDesde: 100, otroPct: 5, n: 50, pct: 10 },
  ],
]

describe('catalogos · los motivos de rechazo, rama por rama', () => {
  it('cubren TODAS las claves `catalogos.motivo.*`', () => {
    const usadas = new Set<string>(CASOS.map((c) => c[2]))
    expect(Object.keys(ES_CATALOGOS).filter((k) => k.startsWith('catalogos.motivo.') && !usadas.has(k))).toEqual([])
  })

  for (const [nombre, motivo, clave, valores] of CASOS) {
    it(nombre, () => {
      expect(motivo('es')).toBe(traducir('es', clave, valores))
      expect(motivo('en')).toBe(traducir('en', clave, valores))
      expect(motivo('en')).not.toBe(motivo('es'))
      expect(motivo('en')).not.toMatch(/\{\w+\}/)
    })
  }

  it('el servidor, que no pasa idioma, recibe el espanol de siempre', () => {
    expect(motivoPaqueteInvalido({ nombre: '', precioCerrado: 1, sitios: [] })).toBe('El paquete necesita un nombre.')
    expect(motivoFranjaInvalida({ ...PRIME, nombre: '' }, [])).toBe('La franja necesita un nombre.')
    expect(motivoTemporadaInvalida({ ...BF, nombre: '' }, [])).toBe('La temporada necesita un nombre.')
    expect(motivoTramoInvalido({ ...T50, unidad: '' }, [])).toBe('El tramo necesita una unidad de venta.')
  })
})

// ============================================================================
//  QUE CLAVE usa cada aviso que NO se rinde (el toast, `mensajeSiFalla`, los
//  `setError` de los `catch`). Mismo metodo que `finanzas.test.ts`: se lee el
//  fuente y se fija la rama, porque ni la instantanea ni las pantallas ven QUE
//  clave elige un aviso.
// ============================================================================
describe('catalogos · los avisos que no se rinden usan su clave', () => {
  const leer = (f: string) => readFileSync(path.join(__dirname, '../../..', f), 'utf8').replace(/\r\n/g, '\n')

  it('tarifas por franja: «guardadas» al lograrlo, su fallo al fallar, y el de leer', () => {
    const s = leer('components/demo/rejilla/RejillaDialog.tsx')
    expect(s).toMatch(/alLograr: \(\) => \{\s*toast\.success\(t\('catalogos\.tarifas\.guardadas'\)\)/)
    expect(s).toMatch(/mensajeSiFalla: t\('catalogos\.tarifas\.no-guardar'\)/)
    expect(s).toMatch(/e\.message : t\('catalogos\.tarifas\.no-leer'\)/)
  })

  it('franjas y temporadas: guardar (dos) y dar de baja, cada uno con el suyo', () => {
    const s = leer('components/demo/rejilla/GestionRejilla.tsx')
    expect(s.match(/mensajeSiFalla: t\('catalogos\.comun\.no-guardar'\)/g)).toHaveLength(2)
    expect(s).toMatch(/mensajeSiFalla: t\('catalogos\.rejilla\.no-dar-de-baja'\)/)
    expect(s).toMatch(/e\.message : t\('catalogos\.rejilla\.no-leer'\)/)
  })

  it('paquetes: leer, guardar, cambiar y eliminar no se cruzan', () => {
    const s = leer('components/demo/paquetes/GestionPaquetes.tsx')
    expect(s).toMatch(/setPaquetes\(await paquetesApi\(\)\)[\s\S]{0,160}t\('catalogos\.paquetes\.no-leer'\)/)
    expect(s).toMatch(/admiteCodigo: nuevo\.admiteCodigo,[\s\S]{0,300}t\('catalogos\.paquetes\.no-guardar'\)/)
    expect(s).toMatch(/activo: !p\.activo \}\)[\s\S]{0,160}t\('catalogos\.paquetes\.no-cambiar'\)/)
    expect(s).toMatch(/borrarPaqueteApi\(id\)[\s\S]{0,160}t\('catalogos\.paquetes\.no-eliminar'\)/)
  })

  it('volumen y horario de transmision', () => {
    const v = leer('components/demo/volumen/GestionVolumen.tsx')
    expect(v).toMatch(/escalasVolumenApi\(\)\)[\s\S]{0,160}t\('catalogos\.volumen\.no-leer'\)/)
    expect(v).toMatch(/descuentoPct: Number\(nuevo\.descuentoPct\),[\s\S]{0,300}t\('catalogos\.comun\.no-guardar'\)/)
    expect(v).toMatch(/borrarTramoVolumenApi\(id\)[\s\S]{0,160}t\('catalogos\.comun\.no-eliminar'\)/)
    const p = leer('components/demo/rejilla/ProgramacionPorFranja.tsx')
    expect(p).toMatch(/setPuede\([\s\S]{0,200}t\('catalogos\.programacion\.no-leer'\)/)
    expect(p).toMatch(/await cargar\(\)[\s\S]{0,120}t\('catalogos\.programacion\.no-programar'\)/)
  })

  it('las pantallas pasan su idioma a los motivos', () => {
    expect(leer('components/demo/paquetes/GestionPaquetes.tsx')).toMatch(/motivoPaqueteInvalido\([\s\S]{0,220}idioma,\s*\)/)
    const r = leer('components/demo/rejilla/GestionRejilla.tsx')
    expect(r).toMatch(/motivoFranjaInvalida\(\{ id: '', \.\.\.nuevaF \}, franjas, idioma\)/)
    expect(r).toMatch(/motivoTemporadaInvalida\(\{ id: '', \.\.\.nuevaT \}, temporadas, idioma\)/)
    expect(leer('components/demo/volumen/GestionVolumen.tsx')).toMatch(/motivoTramoInvalido\(\{ id: '', \.\.\.candidato \}, tramos, idioma\)/)
  })
})

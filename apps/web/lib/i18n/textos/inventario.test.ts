import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ES_INVENTARIO, EN_INVENTARIO } from './inventario'
import { traducir, type ClaveTexto } from '../diccionario'
import { medioLabel } from '@/lib/data/derive'
import { disponibilidadInventario } from '@/components/demo/StatusBadge'
import { textoDisponibilidad, textoMedio } from '@/components/demo/inventario/etiquetas'

// ============================================================================
//  EL DICCIONARIO DE INVENTARIO ENTERO, CONGELADO — y atado a sus fuentes.
// ----------------------------------------------------------------------------
//  Mismo motivo que `textos/comercial.test.ts`: muchas claves no salen en
//  ningun estado de `pantallas-inventario-arrendadores.test.ts` (avisos
//  emergentes, `window.confirm`, singulares). La INSTANTANEA de los dos idiomas
//  impide cambiar una letra sin que se vea (`npx vitest run -u` la regenera y
//  el diff de `__snapshots__/` lo enseña).
// ============================================================================

describe('diccionario de inventario · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_INVENTARIO).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_INVENTARIO).toMatchSnapshot()
  })
})

describe('diccionario de inventario · el ingles no esta en espanol', () => {
  // Las que coinciden A PROPOSITO en los dos idiomas.
  const IGUALES = new Set([
    'inventario.medio.digital', // «Digital»
  ])

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    const iguales = Object.keys(ES_INVENTARIO).filter(
      (k) => ES_INVENTARIO[k as keyof typeof ES_INVENTARIO] === EN_INVENTARIO[k as keyof typeof EN_INVENTARIO],
    )
    expect(iguales.filter((k) => !IGUALES.has(k))).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    expect(Object.entries(EN_INVENTARIO).filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    const distintos = Object.keys(ES_INVENTARIO).filter(
      (k) => huecos(ES_INVENTARIO[k as keyof typeof ES_INVENTARIO]) !== huecos(EN_INVENTARIO[k as keyof typeof EN_INVENTARIO]),
    )
    expect(distintos).toEqual([])
  })

  it('ningun porcentaje ingles lleva espacio antes del «%»', () => {
    expect(Object.entries(EN_INVENTARIO).filter(([, v]) => /\S %/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('ni comillas rectas ni apostrofos rectos en ingles', () => {
    expect(Object.entries(EN_INVENTARIO).filter(([, v]) => /"|[A-Za-z]'[A-Za-z]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('ni «Tap» ni «press»: siempre «click»', () => {
    expect(Object.entries(EN_INVENTARIO).filter(([, v]) => /\b(tap|press)\b/i.test(v)).map(([k]) => k)).toEqual([])
  })
})

describe('diccionario de inventario · el espanol reproduce EXACTAMENTE su modulo', () => {
  const t = (clave: ClaveTexto, valores?: Record<string, string | number>) => traducir('es', clave, valores)

  it('textoMedio dice lo mismo que `medioLabel`', () => {
    const casos = [
      { tipoMedio: 'PANTALLA_DIGITAL', esRotativo: false, exhibicion: 'fijo' },
      { tipoMedio: 'ESPECTACULAR', esRotativo: true, exhibicion: 'fijo' },
      { tipoMedio: 'ESPECTACULAR', esRotativo: false, exhibicion: 'digital' },
      { tipoMedio: 'ESPECTACULAR', esRotativo: false, exhibicion: 'rotativo' },
      { tipoMedio: 'VALLA', esRotativo: false, exhibicion: 'fijo' },
    ] as Parameters<typeof medioLabel>[0][]
    for (const s of casos) expect(textoMedio(s, t)).toBe(medioLabel(s))
  })

  it('textoDisponibilidad dice lo mismo que `disponibilidadInventario`, rama por rama', () => {
    const base = { tipoMedio: 'ESPECTACULAR', esRotativo: false, exhibicion: 'fijo' }
    const dig = { tipoMedio: 'PANTALLA_DIGITAL', esRotativo: true, exhibicion: 'digital' }
    const casos = [
      { ...base, estatusComercial: 'BLOQUEADO' },
      { ...base, estatusComercial: 'EN_MANTENIMIENTO' },
      { ...base, estatusComercial: 'BAJA' },
      { ...base, estatusComercial: 'OCUPADO' },
      { ...base, estatusComercial: 'RESERVADO' },
      { ...base, estatusComercial: 'DISPONIBLE' },
      { ...dig, estatusComercial: 'DISPONIBLE', totalSpots: null, spotsDisponibles: null },
      { ...dig, estatusComercial: 'DISPONIBLE', totalSpots: 8, spotsDisponibles: 0 },
      { ...dig, estatusComercial: 'DISPONIBLE', totalSpots: 8, spotsDisponibles: 3 },
      { ...dig, estatusComercial: 'OCUPADO', totalSpots: 8, spotsDisponibles: 8 },
    ] as Parameters<typeof disponibilidadInventario>[0][]
    for (const s of casos) expect(textoDisponibilidad(s, t)).toBe(disponibilidadInventario(s).texto)
  })
})

// ============================================================================
//  QUE CLAVE usa cada aviso que NO se rinde (la cuarta gemela, despues de
//  Finanzas, Campanas y Comercial). Se lee el fuente.
// ============================================================================
describe('inventario · los avisos que no se rinden usan su clave', () => {
  const leer = (archivo: string) =>
    readFileSync(path.join(__dirname, '../../..', archivo), 'utf8').replace(/\r\n/g, '\n')
  const tabla = leer('components/demo/inventario/InventarioTabla.tsx')
  const wizard = leer('components/demo/inventario/ContratoWizard.tsx')
  const alta = leer('components/demo/inventario/NuevaPantallaForm.tsx')
  const carga = leer('components/demo/inventario/ImportarInventarioDialog.tsx')
  const pagina = leer('app/(app)/(shell)/inventario/page.tsx')

  it('el lote de tarifas avisa «tarifa actualizada» y el de rentas «renta actualizada», no al reves', () => {
    expect(tabla).toMatch(/aplicar: actualizarTarifasApi[\s\S]{0,300}?'inventario\.tabla\.tarifa-actualizada\.uno' : 'inventario\.tabla\.tarifa-actualizada\.otros'/)
    expect(tabla).toMatch(/aplicar: actualizarRentasApi[\s\S]{0,300}?'inventario\.tabla\.renta-actualizada\.uno' : 'inventario\.tabla\.renta-actualizada\.otros'/)
    expect(tabla).toMatch(/mensajeSiFalla: t\('inventario\.tabla\.no-masivo'\)/)
    expect(tabla).toMatch(/mensajeSiFalla: t\('inventario\.tabla\.no-masivo-renta'\)/)
  })

  it('el confirm del lote de tarifas habla de pantallas y el de rentas de contratos', () => {
    expect(tabla).toMatch(/'inventario\.tabla\.aplicar-pantallas\.uno' : 'inventario\.tabla\.aplicar-pantallas\.otros'/)
    expect(tabla).toMatch(/'inventario\.tabla\.aplicar-contratos\.uno' : 'inventario\.tabla\.aplicar-contratos\.otros'/)
  })

  it('cada celda avisa lo suyo: renta, tarifa y arrendador', () => {
    expect(tabla).toMatch(/\? t\('inventario\.renta\.predio-actualizada', \{ n: hermanas \}\)\s*\n\s*: t\('inventario\.renta\.actualizada'/)
    expect(tabla).toMatch(/mensajeSiFalla: t\('inventario\.renta\.no-actualizar'\)/)
    expect(tabla).toMatch(/alLograr: \(\) => onSaved\(t\('inventario\.tarifa\.actualizada'/)
    expect(tabla).toMatch(/mensajeSiFalla: t\('inventario\.tarifa\.no-actualizar'\)/)
    expect(tabla).toMatch(/nuevo\s*\n\s*\? t\('inventario\.arrendador\.actualizado'[\s\S]{0,80}?: t\('inventario\.arrendador\.quitado'/)
  })

  it('el asistente: predio, asignada o creados, en ese orden; y sus errores', () => {
    expect(wizard).toMatch(
      /soloPantalla\s*\n\s*\? t\('inventario\.wizard\.ok\.predio'\)\s*\n\s*: delInventario\s*\n\s*\? t\('inventario\.wizard\.ok\.asignada'\)\s*\n\s*: t\('inventario\.wizard\.ok\.creados'\)/,
    )
    expect(wizard).toMatch(/mensajeSiFalla: t\('inventario\.wizard\.no-crear'\)/)
    expect(wizard).toMatch(/toast\.error\(t\('inventario\.wizard\.pdf-tipo'\)\)/)
    expect(wizard).toMatch(/toast\.error\(t\('inventario\.wizard\.pdf-tamano'\)\)/)
  })

  it('el alta manual y la carga masiva avisan sus errores de archivo', () => {
    expect(alta).toMatch(/toast\.error\(t\('inventario\.alta\.imagen-tamano'\)\)/)
    expect(alta).toMatch(/reader\.onerror = \(\) => toast\.error\(t\('inventario\.alta\.imagen-leer'\)\)/)
    expect(carga).toMatch(/toast\.error\(t\('inventario\.carga\.no-leer'\)\)/)
    expect(carga).toMatch(/e\.message : t\('inventario\.carga\.no-importar'\)/)
  })

  it('la pagina: contrato creado, pantalla agregada e inventario importado', () => {
    expect(pagina).toMatch(/onCreado=\{\(s\) => alInventario\(t\('inventario\.toast\.contrato-creado'/)
    expect(pagina).toMatch(/onCreado=\{\(s\) => alInventario\(t\('inventario\.toast\.pantalla-agregada'/)
    expect(pagina).toMatch(/alInventario\(t\('inventario\.toast\.importado'/)
  })
})

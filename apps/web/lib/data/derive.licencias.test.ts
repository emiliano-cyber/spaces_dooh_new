import { describe, it, expect } from 'vitest'
import { dashboardMetrics, DIAS_AVISO_LICENCIA } from './derive'

// ============================================================================
//  Alertas de licencias y permisos (F-2 de la auditoría).
//
//  La auditoría dejó R5.1 en PARCIAL porque no existía dónde guardar la vigencia
//  de un permiso, así que su alerta no podía existir. Esto la fija.
//
//  Regla de negocio: un permiso vencido AVISA pero NO bloquea la venta. Aquí se
//  protege que avise; que no bloquee se protege comprobando que el inventario
//  no se toca.
// ============================================================================

function hoyMas(dias: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

const BASE: any = {
  sitios: [{ id: 'S1', nombre: 'Pantalla suelta', predioId: null, caras: 1, estatusComercial: 'DISPONIBLE' }],
  predios: [{ id: 'P1', nombre: 'Predio Centro' }],
  contratos: [], reservas: [], campanas: [], facturas: [], cobranzas: [],
  ordenesTrabajo: [], creatividades: [], ordenesImpresion: [], evidencias: [],
  incidencias: [], pagosRenta: [], arrendadores: [], clientes: [], propuestas: [],
  ordenesCompra: [], notificaciones: [], acciones: [], sitiosRed: [],
  razonesSociales: [], licencias: [],
}

const lic = (over: any) => ({
  id: 'L1', predioId: 'P1', sitioId: null, tipo: 'MUNICIPAL', folio: 'ABC-123',
  autoridad: 'Alcaldía', fechaExpedicion: null, documentoUrl: null, notas: null,
  creadoEn: '2026-01-01', ...over,
})

const alertasLicencia = (estado: any) =>
  dashboardMetrics(estado).alertas.filter((a: any) => a.tipo === 'licencia')

describe('licencia vencida', () => {
  const estado = { ...BASE, licencias: [lic({ fechaVencimiento: hoyMas(-12) })] }

  it('genera alerta roja', () => {
    const a = alertasLicencia(estado)
    expect(a).toHaveLength(1)
    expect(a[0].titulo).toBe('Licencia vencida')
    expect(a[0].nivel).toBe('rojo')
  })

  it('dice dónde y cuánto hace que venció', () => {
    expect(alertasLicencia(estado)[0].detalle).toContain('Predio Centro')
    expect(alertasLicencia(estado)[0].detalle).toContain('12 días')
  })

  it('NO bloquea la venta: el inventario sigue disponible', () => {
    // La decisión del dueño del producto fue avisar, no bloquear: un permiso ya
    // renovado pero sin capturar frenaría ventas sin motivo.
    expect(estado.sitios[0].estatusComercial).toBe('DISPONIBLE')
  })
})

describe('licencia por vencer', () => {
  it('a 30 días o menos, es roja', () => {
    const a = alertasLicencia({ ...BASE, licencias: [lic({ fechaVencimiento: hoyMas(20) })] })
    expect(a[0].titulo).toBe('Licencia por vencer')
    expect(a[0].nivel).toBe('rojo')
  })

  it('entre 31 días y el margen de aviso, es ámbar', () => {
    const a = alertasLicencia({ ...BASE, licencias: [lic({ fechaVencimiento: hoyMas(90) })] })
    expect(a[0].nivel).toBe('ambar')
  })

  it('más allá del margen de aviso, no molesta', () => {
    const lejos = hoyMas(DIAS_AVISO_LICENCIA + 10)
    expect(alertasLicencia({ ...BASE, licencias: [lic({ fechaVencimiento: lejos })] })).toHaveLength(0)
  })

  it('justo en el borde del margen, sí avisa', () => {
    const borde = hoyMas(DIAS_AVISO_LICENCIA)
    expect(alertasLicencia({ ...BASE, licencias: [lic({ fechaVencimiento: borde })] })).toHaveLength(1)
  })
})

describe('a quién ampara', () => {
  it('la de un predio se reporta con el nombre del predio', () => {
    const a = alertasLicencia({ ...BASE, licencias: [lic({ fechaVencimiento: hoyMas(-1) })] })
    expect(a[0].detalle).toContain('Predio Centro')
  })

  it('la de una pantalla suelta, con el nombre de la pantalla', () => {
    const a = alertasLicencia({
      ...BASE,
      licencias: [lic({ predioId: null, sitioId: 'S1', fechaVencimiento: hoyMas(-1) })],
    })
    expect(a[0].detalle).toContain('Pantalla suelta')
  })

  it('nombra el tipo de permiso, no solo "licencia"', () => {
    const a = alertasLicencia({
      ...BASE,
      licencias: [lic({ tipo: 'AMBIENTAL', folio: 'AMB-9', fechaVencimiento: hoyMas(-1) })],
    })
    expect(a[0].detalle).toContain('Permiso ambiental')
    expect(a[0].detalle).toContain('AMB-9')
  })
})

describe('varios permisos a la vez', () => {
  it('cada uno da su propia alerta', () => {
    // Un mismo emplazamiento puede necesitar municipal + ambiental, y que uno
    // esté vigente no salva al otro.
    const a = alertasLicencia({
      ...BASE,
      licencias: [
        lic({ id: 'L1', tipo: 'MUNICIPAL', fechaVencimiento: hoyMas(-5) }),
        lic({ id: 'L2', tipo: 'AMBIENTAL', fechaVencimiento: hoyMas(10) }),
        lic({ id: 'L3', tipo: 'ESTRUCTURAL', fechaVencimiento: hoyMas(400) }),
      ],
    })
    expect(a).toHaveLength(2) // el tercero está lejos
    expect(a.map((x: any) => x.titulo).sort()).toEqual(['Licencia por vencer', 'Licencia vencida'])
  })
})

describe('sin licencias', () => {
  it('no inventa alertas', () => {
    expect(alertasLicencia(BASE)).toHaveLength(0)
  })

  it('un estado sin la lista siquiera no rompe', () => {
    // Defensa para estados viejos en caché del navegador, anteriores a esta
    // función: sin el `?? []` el tablero entero reventaría al cargar.
    const sinCampo = { ...BASE }
    delete (sinCampo as any).licencias
    expect(() => dashboardMetrics(sinCampo)).not.toThrow()
  })
})

import { describe, it, expect } from 'vitest'
import {
  planSemilla,
  datosDeRentabilidad,
  sentenciasDelPlan,
  sentenciaOrganizacion,
  SITIO_TLALPAN,
  SITIO_SANTA_MONICA,
  COSTOS_OT_DEMO,
} from './semilla-demo.mjs'
import { rentabilidadPorSitio } from '@/lib/data/reportes'

// ============================================================================
//  El GUION de la demo, probado sin Postgres.
// ----------------------------------------------------------------------------
//  Lo que esta semilla existe para evitar es un riesgo de PRESENTACIÓN: el
//  14 de octubre el módulo de rentabilidad estará construido, y un reporte
//  trimestral sobre una base con tres semanas de datos dibuja una sola barra.
//  El dueño tiene además una frase concreta que el reporte tiene que poder
//  enseñar:
//
//    «Tlalpan G500 es menos rentable que G500 Santa Mónica. Han tenido las
//     mismas campañas, pero a una van a cada rato a arreglarla.»
//
//  Eso no es un volcado de datos aleatorios: es una AFIRMACIÓN, y una
//  afirmación se prueba. Estas pruebas son el guion escrito como aserción.
//
//  ─── Por qué usan el motor de verdad ─────────────────────────────────────
//  `rentabilidadPorSitio()` (`lib/data/reportes.ts`) es el mismo código que
//  corre detrás de `GET /api/reportes/rentabilidad`. Si la prueba reimplantara
//  la aritmética, comprobaría que la semilla cuadra con la copia de la prueba
//  y no con lo que el reporte va a dibujar en el escenario — que es la única
//  pregunta que importa aquí.
//
//  No necesita base: el motor es puro, y la semilla se declara como un PLAN
//  antes de convertirse en SQL. Por eso corre en `npm test` y no en las e2e.
//  El include de `apps/web/vitest.config.ts` alcanza `../../scripts/**` a
//  propósito, igual que con `migrar.test.ts`.
// ============================================================================

// Ancla FIJA, no `new Date()`. Una prueba cuyas fechas dependen del día en que
// se corre es una prueba que falla sola un martes, y este repo ya documenta esa
// clase de error con las fechas de calendario (`reportes.ts`, cabecera de
// «Fechas de CALENDARIO»).
const ANCLA = '2026-09-18'

const plan = () => planSemilla({ ancla: ANCLA })

/** El rango que cubre TODO el histórico sembrado, para pedirle el reporte. */
function rangoDelPlan(p: any) {
  return {
    desde: p.trimestres[0].desde,
    hasta: p.trimestres[p.trimestres.length - 1].hasta,
    granularidad: 'trimestre' as const,
  }
}

function filaDe(rep: any, clave: string) {
  const f = rep.filas.find((x: any) => x.detalle === clave)
  if (!f) throw new Error(`el reporte no trae fila para ${clave}`)
  return f
}

/** La pantalla del plan, o un fallo que la nombra. */
function sitioDe(p: any, clave: string) {
  const s = p.sitios.find((x: any) => x.clave === clave)
  if (!s) throw new Error(`el plan no trae la pantalla ${clave}`)
  return s
}

/** La renta mensual del contrato que cubre a esa pantalla. */
function rentaDe(p: any, clave: string): number {
  const c = p.contratos.find((x: any) => x.sitioClave === clave)
  if (!c) throw new Error(`el plan no trae contrato para ${clave}`)
  return c.montoRenta
}

describe('planSemilla() — la historia que necesita un reporte trimestral', () => {
  it('siembra al menos TRES trimestres, y todos con reservas y con órdenes', () => {
    // Es el motivo de la tarea: sin historia el reporte no tiene nada que
    // enseñar. Tres es el mínimo para que una tendencia se vea como tendencia
    // y no como dos puntos unidos por una recta.
    const p = plan()
    expect(p.trimestres.length).toBeGreaterThanOrEqual(3)

    for (const t of p.trimestres) {
      const reservas = p.reservas.filter((r: any) => r.trimestre === t.clave)
      const ots = p.ordenesTrabajo.filter((o: any) => o.trimestre === t.clave)
      expect(reservas.length, `trimestre ${t.clave} sin reservas`).toBeGreaterThan(0)
      expect(ots.length, `trimestre ${t.clave} sin órdenes de trabajo`).toBeGreaterThan(0)
    }
  })

  it('los trimestres son CERRADOS y anteriores al del ancla', () => {
    // Un trimestre a medias sale con menos ingreso y menos renta que los
    // demás, y en la gráfica se lee como una caída del negocio en vez de como
    // un periodo incompleto. El guion se queda en trimestres naturales ya
    // terminados.
    const p = plan()
    for (const t of p.trimestres) expect(t.hasta < ANCLA).toBe(true)
  })

  it('no asume ninguna organización: la crea, y el slug es parámetro', () => {
    // La deriva que este repo ya pagó fue etiquetar como 'rgb' filas de otras
    // empresas. Una semilla que diera el tenant por supuesto la repetiría.
    const p = planSemilla({ ancla: ANCLA, slug: 'otra-demo' })
    expect(p.organizacion.slug).toBe('otra-demo')
    expect(plan().organizacion.slug).not.toBe('rgb')
    // Y cada fila sembrada sabe a qué organización pertenece: el SQL lo lleva.
    const sql = sentenciaOrganizacion(p).sql
    expect(sql).toMatch(/insert\s+into\s+tenants/i)
  })
})

describe('el guion: Tlalpan sale menos rentable, y por la OPERACIÓN', () => {
  it('el reporte de verdad pone a Tlalpan por debajo de Santa Mónica', () => {
    const p = plan()
    const rep = rentabilidadPorSitio(datosDeRentabilidad(p) as any, rangoDelPlan(p))
    const tlalpan = filaDe(rep, SITIO_TLALPAN)
    const santaMonica = filaDe(rep, SITIO_SANTA_MONICA)
    expect(tlalpan.margen).toBeLessThan(santaMonica.margen)
  })

  it('la diferencia NO viene de las ventas: el ingreso de las dos es el mismo', () => {
    // «Han tenido las mismas campañas». Si el ingreso difiriera, la conclusión
    // del reporte seguiría siendo cierta pero dejaría de demostrar nada: el
    // dueño podría atribuirla a que una se vende peor.
    const p = plan()
    const rep = rentabilidadPorSitio(datosDeRentabilidad(p) as any, rangoDelPlan(p))
    expect(filaDe(rep, SITIO_TLALPAN).ingreso).toBe(filaDe(rep, SITIO_SANTA_MONICA).ingreso)
  })

  it('la diferencia la explica el costo de operación, no el del espacio', () => {
    // La renta de las dos es PARECIDA a propósito (predios distintos, contratos
    // distintos), así que el costo del espacio no puede explicar la brecha. La
    // explica que a una van a cada rato a arreglarla.
    const p = plan()
    const rep = rentabilidadPorSitio(datosDeRentabilidad(p) as any, rangoDelPlan(p))
    const t = filaDe(rep, SITIO_TLALPAN)
    const s = filaDe(rep, SITIO_SANTA_MONICA)

    const brecha = s.margen - t.margen
    const porOperacion = t.costoOperacion - s.costoOperacion
    const porEspacio = t.costoEspacio - s.costoEspacio

    expect(porOperacion).toBeGreaterThan(0)
    // La operación explica la mayor parte de la brecha, y con margen de sobra:
    // si alguna vez dejara de hacerlo, el guion habría dejado de contar lo que
    // dice contar.
    expect(porOperacion).toBeGreaterThan(brecha * 0.75)
    expect(Math.abs(porEspacio)).toBeLessThan(porOperacion / 2)
  })

  it('las dos son comparables: mismo tipo de medio, medidas y renta parecidas', () => {
    const p = plan()
    const t = sitioDe(p, SITIO_TLALPAN)
    const s = sitioDe(p, SITIO_SANTA_MONICA)
    expect(t.tipoMedio).toBe(s.tipoMedio)
    expect(t.ancho).toBe(s.ancho)
    expect(t.alto).toBe(s.alto)
    // Predios DISTINTOS, con su arrendador y su contrato: si compartieran
    // predio compartirían contrato y la renta se repartiría entre las dos,
    // que es otro escenario.
    expect(t.predioClave).not.toBe(s.predioClave)

    const rt = rentaDe(p, SITIO_TLALPAN)
    const rs = rentaDe(p, SITIO_SANTA_MONICA)
    expect(Math.abs(rt - rs) / Math.max(rt, rs)).toBeLessThan(0.1)
  })

  it('Tlalpan acumula más órdenes, y con mezcla de tipos', () => {
    const p = plan()
    const deTlalpan = p.ordenesTrabajo.filter((o: any) => o.sitioClave === SITIO_TLALPAN)
    const deSantaMonica = p.ordenesTrabajo.filter((o: any) => o.sitioClave === SITIO_SANTA_MONICA)
    expect(deTlalpan.length).toBeGreaterThan(deSantaMonica.length)
    // Con mezcla de `tipo_ot`, que es lo que ahora decide el costo: si todas
    // fueran del mismo tipo, la semilla no ejercitaría `config_negocio.costos_ot`.
    expect(new Set(deTlalpan.map((o: any) => o.tipo)).size).toBeGreaterThanOrEqual(3)
  })

  it('el deterioro se ve trimestre a trimestre, que es para lo que sirve el reporte', () => {
    // Una brecha plana se enseña igual con un solo periodo. Lo que justifica un
    // reporte TRIMESTRAL es que el margen de Tlalpan va cayendo mientras el de
    // Santa Mónica se sostiene.
    const p = plan()
    const rep = rentabilidadPorSitio(datosDeRentabilidad(p) as any, rangoDelPlan(p))
    const t = filaDe(rep, SITIO_TLALPAN)
    const primero = t.periodos[0].margen
    const ultimo = t.periodos[t.periodos.length - 1].margen
    expect(ultimo).toBeLessThan(primero)
  })

  it('configura costos_ot y ninguno queda en cero', () => {
    // `costoDeOt()` cae al respaldo ante cualquier hueco y NUNCA devuelve 0 por
    // omisión. La semilla captura los nueve tipos para que el guion no dependa
    // de ese respaldo.
    const valores = Object.values(COSTOS_OT_DEMO)
    expect(valores.length).toBe(9)
    for (const v of valores) expect(v).toBeGreaterThan(0)
  })
})

describe('el reporte de m²: lo que excluye se cuenta, no se esconde', () => {
  it('siembra estáticas SIN medidas a propósito, y salen en el reporte', () => {
    const p = plan()
    const sinMedidas = p.sitios.filter((s: any) => s.ancho == null && s.alto == null)
    expect(sinMedidas.length).toBeGreaterThanOrEqual(2)

    // Y tienen actividad: una fila sin ingreso, sin renta y sin OT no aparece
    // en el reporte (`reportes.ts`), así que una pantalla sin medidas que
    // tampoco tuviera movimiento no demostraría nada.
    const rep = rentabilidadPorSitio(datosDeRentabilidad(p) as any, rangoDelPlan(p))
    for (const s of sinMedidas) {
      expect(rep.filas.some((f: any) => f.detalle === s.clave), `${s.clave} no sale`).toBe(true)
    }
  })
})

describe('idempotencia', () => {
  it('el plan es DETERMINISTA: dos llamadas con la misma ancla son idénticas', () => {
    // Si el plan trajera `new Date()`, `Math.random()` o un uuid, la segunda
    // corrida del script no podría reconocer lo que sembró la primera.
    expect(planSemilla({ ancla: ANCLA })).toEqual(planSemilla({ ancla: ANCLA }))
  })

  it('las claves naturales no se repiten dentro del plan', () => {
    // Son las que hacen reconocible una fila ya sembrada. Un duplicado aquí
    // convierte el `on conflict do nothing` en pérdida silenciosa de una fila.
    const p = plan()
    const unicas = (xs: string[], que: string) =>
      expect(new Set(xs).size, `${que} repetidas`).toBe(xs.length)
    unicas(p.sitios.map((s: any) => s.clave), 'claves de sitio')
    unicas(p.sitios.map((s: any) => s.codigoProveedor), 'códigos de proveedor')
    unicas(p.campanas.map((c: any) => c.folio), 'folios de campaña')
    unicas(p.ordenesTrabajo.map((o: any) => o.folio), 'folios de OT')
    unicas(p.predios.map((x: any) => x.nombre), 'nombres de predio')
    unicas(p.arrendadores.map((a: any) => a.rfc), 'RFC de arrendador')
    unicas(p.clientes.map((c: any) => c.rfc), 'RFC de cliente')
  })

  it('NINGUNA sentencia inserta sin guard contra la segunda corrida', () => {
    // El invariante mecánico. Es el que impide que alguien añada una tabla al
    // guion y deje un `insert` a pelo: la segunda corrida duplicaría esas filas
    // y el reporte enseñaría el doble de ingreso sin dar el menor error.
    const TENANT = '00000000-0000-4000-8000-000000000001'
    const sentencias = [sentenciaOrganizacion(plan()), ...sentenciasDelPlan(plan(), TENANT)]
    expect(sentencias.length).toBeGreaterThan(0)

    for (const s of sentencias) {
      if (!/insert\s+into/i.test(s.sql)) continue
      const guardada = /on\s+conflict/i.test(s.sql) || /not\s+exists/i.test(s.sql)
      expect(guardada, `sin guard: ${s.etiqueta}`).toBe(true)
    }
  })

  it('NINGÚN insert a una tabla con tenant_id lo deja fuera', () => {
    // R2: el fallo de aislamiento de este repo no da error, deja filas de una
    // empresa etiquetadas como de otra. `tenants` es la única sin columna.
    const TENANT = '00000000-0000-4000-8000-000000000001'
    for (const s of sentenciasDelPlan(plan(), TENANT)) {
      if (!/insert\s+into/i.test(s.sql)) continue
      expect(/tenant_id/i.test(s.sql), `sin tenant_id: ${s.etiqueta}`).toBe(true)
    }
  })

  it('ningún valor real viaja quemado en el guion', () => {
    // Ni dominios, ni IPs, ni RFC verdaderos. Todo lo que se siembra tiene que
    // ser evidentemente de demostración: esto se va a proyectar en una
    // pantalla delante de gente.
    const texto = JSON.stringify(plan())
    expect(texto).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)
    expect(texto).not.toMatch(/space-os\.io|digitalocean|registryspaces/i)
    for (const a of plan().arrendadores) expect(a.rfc).toMatch(/^DMO/)
    for (const c of plan().clientes) expect(c.rfc).toMatch(/^DMO/)
  })
})

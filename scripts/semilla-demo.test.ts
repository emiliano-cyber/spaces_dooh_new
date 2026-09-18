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
import { rentabilidadPorSitio, rentabilidadPorM2, rentabilidadPorLuz } from '@/lib/data/reportes'

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

// ============================================================================
//  LO QUE LA BASE DE DEMOSTRACIÓN NO PODÍA ENSEÑAR — 2026-09-18
// ----------------------------------------------------------------------------
//  Medido sobre `spaces_ver2` el 18/09, que es la base con la que se ensaya el
//  14 de octubre:
//
//    · recibos de luz .................. 0   → la quinta dimensión, vacía
//    · pantallas con más de una cara ... 0   → la decisión del m² por caras,
//                                              tomada el 18/09, INVISIBLE
//    · contratos con razón social ...... 1 de 3, y las dos entidades se habían
//                                              creado a mano desde la interfaz:
//                                              el guion NO las sembraba
//
//  Tres de las cinco cosas construidas no se podían enseñar sobre una base
//  recién sembrada. Estas pruebas son ese hueco escrito como aserción.
// ============================================================================

// Los CINCO papeles del catálogo. Son FIJOS por decisión del dueño del
// 2026-09-18 (`vault/02-Backend/multi-entidad-en-uso`), y se escriben aquí para
// que inventar un sexto en la semilla salga en rojo: `entidad_roles.rol` es una
// FK contra `catalogo_roles_entidad`, así que un papel inventado revienta
// contra la base — y eso se ve corriendo el script, no leyendo el plan.
const ROLES_DEL_CATALOGO = ['ARRENDAMIENTOS', 'ACTIVOS', 'LICENCIAS', 'OPERACION', 'VENTAS']

/** Los meses `AAAA-MM-01` que cubre el histórico del plan. */
function mesesDelPlan(p: any): string[] {
  const out: string[] = []
  const [a0, m0] = p.trimestres[0].desde.slice(0, 7).split('-').map(Number)
  const ultimo = p.trimestres[p.trimestres.length - 1].hasta.slice(0, 7)
  for (let i = 0; i < 240; i++) {
    const d = new Date(Date.UTC(a0, m0 - 1 + i, 1))
    const clave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    out.push(`${clave}-01`)
    if (clave === ultimo) break
  }
  return out
}

describe('razones sociales: sembradas, con sus papeles, y EN USO', () => {
  it('siembra al menos DOS razones sociales propias del owner', () => {
    // Hasta hoy el guion no sembraba ninguna: las dos de `spaces_ver2` se
    // habían tecleado a mano en la interfaz, así que una base recién sembrada
    // no podía enseñar ni la pantalla de razones sociales ni la asignación.
    const p = plan()
    expect(p.entidades.length).toBeGreaterThanOrEqual(2)
    for (const e of p.entidades) {
      expect(e.razonSocial, 'razón social vacía').toBeTruthy()
      expect(e.rfc, `RFC de ${e.razonSocial} no es de demostración`).toMatch(/^DMO/)
    }
  })

  it('ningún papel inventado, y los CINCO del catálogo tienen dueño', () => {
    // El catálogo es global y fijo. Un papel que no esté en él no es un dato
    // discutible: es un 23503 contra `catalogo_roles_entidad` al sembrar.
    const p = plan()
    const asignados = p.entidades.flatMap((e: any) => e.roles)
    for (const rol of asignados) expect(ROLES_DEL_CATALOGO).toContain(rol)
    for (const rol of ROLES_DEL_CATALOGO) {
      expect(asignados.filter((r: string) => r === rol).length, `papel ${rol}`).toBe(1)
    }
  })

  it('los contratos llevan su PAGADORA, y uno queda SIN ASIGNAR a propósito', () => {
    // «Sin asignar» es un estado que el producto sabe pintar («La paga: sin
    // asignar»), y no se puede enseñar si la semilla los asigna todos.
    const p = plan()
    const conEntidad = p.contratos.filter((c: any) => c.entidadClave != null)
    const sinEntidad = p.contratos.filter((c: any) => c.entidadClave == null)
    expect(conEntidad.length).toBeGreaterThanOrEqual(2)
    expect(sinEntidad.length).toBe(1)

    // Y la que paga es la que tiene el papel de ARRENDAMIENTOS: si fuera otra,
    // el aviso de «papel sin dueño» de la pantalla no diría nada.
    const paga = p.entidades.find((e: any) => e.roles.includes('ARRENDAMIENTOS'))
    for (const c of conEntidad) expect(c.entidadClave).toBe(paga.clave)
  })

  it('los comprobantes llevan su EMISORA, y es la que vende', () => {
    const p = plan()
    expect(p.comprobantes.length).toBeGreaterThan(0)
    const vende = p.entidades.find((e: any) => e.roles.includes('VENTAS'))
    for (const f of p.comprobantes) expect(f.entidadClave).toBe(vende.clave)
    // Uno por campaña: `facturas_campana_uq` es único por campaña, así que dos
    // comprobantes de la misma campaña no serían un dato feo sino un error.
    const folios = p.comprobantes.map((f: any) => f.campanaFolio)
    expect(new Set(folios).size).toBe(folios.length)
  })
})

describe('recibos de luz: los cuatro trimestres, con huecos a propósito', () => {
  it('siembra un recibo por predio y por mes del histórico, menos los huecos', () => {
    const p = plan()
    const meses = mesesDelPlan(p)
    expect(meses.length).toBe(p.trimestres.length * 3)

    const esperados = p.predios.length * meses.length
    expect(p.consumosEnergia.length).toBeGreaterThan(0)
    expect(p.consumosEnergia.length).toBeLessThan(esperados)

    // Todos caen en el día 1 de un mes del histórico: la base lo exige con un
    // CHECK, y una fila a mitad de mes se repartiría como si el mes empezara
    // ese día.
    for (const c of p.consumosEnergia) {
      expect(meses, `periodo fuera del histórico: ${c.periodo}`).toContain(c.periodo)
      expect(c.kwh).toBeGreaterThan(0)
      expect(c.importe).toBeGreaterThan(0)
    }
    // Y ninguno repetido: el índice único es (tenant, predio, periodo, medidor),
    // y un recibo capturado dos veces DUPLICA el costo de la luz sin dar error.
    const claves = p.consumosEnergia.map((c: any) => `${c.predioClave}|${c.periodo}|${c.medidor}`)
    expect(new Set(claves).size).toBe(claves.length)
  })

  it('el reporte de luz DECLARA los huecos, que es la mitad del reporte', () => {
    // Una pantalla sin recibo sale con `costoEnergia: 0`, indistinguible de una
    // que de verdad no gasta luz. La rejilla en ámbar y este aviso existen para
    // eso, y no se pueden enseñar sobre una base completa.
    const p = plan()
    const rep = rentabilidadPorLuz(datosDeRentabilidad(p) as any, rangoDelPlan(p))
    expect(rep.cobertura!.esperados).toBe(p.predios.length * p.trimestres.length * 3)
    expect(rep.cobertura!.faltantes).toBeGreaterThan(0)
    expect(rep.cobertura!.recibosSinDestino).toBe(0)
    // Y la luz llega a las pantallas: si el reparto no diera nada a nadie, el
    // dinero desaparecería del reporte sin error.
    expect(rep.totales.costoEnergia).toBeGreaterThan(0)
  })

  it('la luz NO explica la brecha del guion: las dos protagonistas pierden el MISMO mes', () => {
    // Si a Tlalpan le faltara un recibo que a Santa Mónica no, la brecha de
    // margen del guion tendría una segunda causa y dejaría de ser atribuible a
    // la operación, que es lo único que este guion existe para demostrar.
    const p = plan()
    const mesesDe = (clave: string) =>
      p.consumosEnergia
        .filter((c: any) => c.predioClave === clave)
        .map((c: any) => c.periodo)
        .sort()
    expect(mesesDe('PRE-TLP')).toEqual(mesesDe('PRE-STM'))

    const rep = rentabilidadPorSitio(datosDeRentabilidad(p) as any, rangoDelPlan(p))
    const t = filaDe(rep, SITIO_TLALPAN)
    const s = filaDe(rep, SITIO_SANTA_MONICA)
    const brecha = s.margen - t.margen
    expect(t.costoOperacion - s.costoOperacion).toBeGreaterThan(brecha * 0.75)
    expect(Math.abs(t.costoEnergia - s.costoEnergia)).toBeLessThan(brecha * 0.25)
  })
})

describe('caras: la decisión del m² deja de ser invisible', () => {
  it('las dos protagonistas se quedan en UNA cara', () => {
    // Sus cifras están escritas en `docs/Guion_Summit_20261014.md` y en dos
    // notas de la bóveda, y el dueño ya las validó. `rentaAtribuidaPorSitio()`
    // reparte la renta del predio ENTRE LAS CARAS de sus pantallas: tocarles
    // las caras les mueve la renta, el margen y todos los totales.
    const p = plan()
    expect(sitioDe(p, SITIO_TLALPAN).caras).toBe(1)
    expect(sitioDe(p, SITIO_SANTA_MONICA).caras).toBe(1)
  })

  it('hay pantallas con MÁS de una cara, y con medidas capturadas', () => {
    const p = plan()
    const conVariasCaras = p.sitios.filter((s: any) => s.caras > 1)
    expect(conVariasCaras.length).toBeGreaterThan(0)
    for (const s of conVariasCaras) {
      expect(s.ancho, `${s.clave} sin ancho: el m² la excluiría`).not.toBeNull()
      expect(s.alto, `${s.clave} sin alto: el m² la excluiría`).not.toBeNull()
    }
  })

  it('el reporte por m² compara pantallas de DISTINTO número de caras', () => {
    // Sin esto, «los m² los define cada pantalla igual que cada cara» es una
    // decisión que no se puede enseñar: todas las filas del ranking contarían
    // una sola cara y el reporte se leería igual con la convención contraria.
    const p = plan()
    const rep = rentabilidadPorM2(datosDeRentabilidad(p) as any, rangoDelPlan(p))
    expect(rep.convencionM2).toBe('todas-las-caras')

    const porClave = new Map<string, any>(p.sitios.map((s: any) => [s.clave, s]))
    const caras = rep.filas.map((f: any) => porClave.get(f.detalle)?.caras)
    expect(new Set(caras).size, 'todas las filas del m² tienen las mismas caras').toBeGreaterThan(1)

    // Y el m² de una de dos caras es el doble de su superficie física: es la
    // comprobación de que la convención llega hasta la fila.
    const dobles = rep.filas.filter((f: any) => porClave.get(f.detalle)!.caras === 2)
    expect(dobles.length).toBeGreaterThan(0)
    for (const f of dobles) {
      const s = porClave.get(f.detalle)!
      expect(f.m2).toBeCloseTo(Number(s.ancho) * Number(s.alto) * 2, 2)
    }
  })

  it('cambiar las caras de las DEMÁS no mueve el margen de las protagonistas', () => {
    // El invariante que protege el guion. Se mide mutando el dato: si alguien
    // metiera a Tlalpan o a Santa Mónica en un predio compartido, la renta
    // empezaría a repartirse y esta prueba se pondría roja — que es donde hay
    // que verlo, y no en el escenario.
    const p = plan()
    const base: any = datosDeRentabilidad(p)
    const rango = rangoDelPlan(p)
    const antes = rentabilidadPorSitio(base, rango)

    const protagonistas: string[] = [SITIO_TLALPAN, SITIO_SANTA_MONICA]
    const mutado = {
      ...base,
      sitios: base.sitios.map((s: any) =>
        protagonistas.includes(s.claveInterna) ? s : { ...s, caras: s.caras * 3 },
      ),
    }
    const despues = rentabilidadPorSitio(mutado, rango)

    for (const clave of protagonistas) {
      const a = filaDe(antes, clave)
      const d = filaDe(despues, clave)
      expect(d.costoEspacio, `${clave} costoEspacio`).toBe(a.costoEspacio)
      expect(d.costoEnergia, `${clave} costoEnergia`).toBe(a.costoEnergia)
      expect(d.margen, `${clave} margen`).toBe(a.margen)
    }
  })
})

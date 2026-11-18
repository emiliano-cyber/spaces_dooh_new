import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'

// ============================================================================
//  SEG-CLIENTE · el SEGUIMIENTO de la campaña en la liga pública de la
//  propuesta (`GET /api/propuestas/publica/<token>/seguimiento`), contra
//  Postgres y Next reales (17/11).
//
//   · Mientras la propuesta no es campaña: `{hayCampana:false}`. Aceptarla por
//     la liga NO genera la campaña; generarla sí enciende el seguimiento.
//   · Una OOH recorre: esperando arte → imprenta «1 de 2 lonas» → montaje →
//     lista para su fecha → al aire. Todo por las RUTAS reales (impresión, OT,
//     cierre con testigo); lo único que se mueve en la base es la fecha de
//     arranque, porque no hay ruta que adelante una campaña al pasado.
//   · El NOMBRE de la imprenta sale oculto por omisión, y se busca en el TEXTO
//     CRUDO de la respuesta, no en un campo: lo que importa es que no viaje.
//   · Solo el vendedor que creó la propuesta o un superior lo enciende.
//   · R2 (negativo): el token de una organización no ve nada de la otra, y un
//     token inventado da 404.
//   · Nada de dinero, OC ni folios de factura en el JSON público.
// ============================================================================

const FOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let lonaAlfa: string
let lonaBeta: string
let dueno: Cliente // DUENO de alfa: imprenta y operaciones
let vendedor: Cliente // VENDEDOR de alfa: CREA las propuestas de la OOH
let otroVendedor: Cliente
let gerente: Cliente
let finanzas: Cliente
let duenoBeta: Cliente
const anonimo = () => new Cliente()

/** Una lona (ESPECTACULAR) con contrato COMPLETO (ADR 0003), para que la campaña sea OOH. */
async function sembrarLona(org: Awaited<ReturnType<typeof sembrarTenant>>, nombre: string): Promise<string> {
  const p = poolTest()
  const arr = await p.query(`insert into arrendadores (nombre, tenant_id) values ($1,$2) returning id`, [
    `Arrendador ${nombre}`,
    org.id,
  ])
  const predio = await p.query(
    `insert into predios (nombre, arrendador_id, tenant_id) values ($1,$2,$3) returning id`,
    [`Predio ${nombre}`, arr.rows[0].id, org.id],
  )
  const clave = `${org.slug.toUpperCase()}-LONA-${randomBytes(2).toString('hex')}`
  const s = await p.query(
    `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                         alcaldia, ciudad, tarifa_publicada, tarifa_mensual, predio_id, tenant_id, exhibicion)
     values ($1,$2,$3,'ESPECTACULAR','DISPONIBLE','Cuauhtémoc','CDMX',30000,30000,$4,$5,'fijo')
     returning id`,
    [nombre, clave, `${clave}-PROV`, predio.rows[0].id, org.id],
  )
  await p.query(
    `insert into contratos_arrendamiento
       (arrendador_id, predio_id, sitio_id, fecha_inicio, fecha_fin, monto_renta, periodicidad, estatus, tenant_id)
     values ($1,$2,$3,$4,$5,15000,'MENSUAL','VIGENTE',$6)`,
    [arr.rows[0].id, predio.rows[0].id, s.rows[0].id, enDias(-30), enDias(365), org.id],
  )
  return s.rows[0].id
}

async function sembrarUsuario(org: Awaited<ReturnType<typeof sembrarTenant>>, email: string, rol: string) {
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ($1,$2,$3::rol_demo,$4,true,$5)`,
    [`${rol} ${email}`, email, rol, await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('segalfa')
  beta = await sembrarTenant('segbeta')
  lonaAlfa = await sembrarLona(alfa, 'Lona Periférico Alfa')
  lonaBeta = await sembrarLona(beta, 'Lona Reforma Beta')
  await sembrarUsuario(alfa, 'vendedor@segalfa.test', 'VENDEDOR')
  await sembrarUsuario(alfa, 'otro@segalfa.test', 'VENDEDOR')
  await sembrarUsuario(alfa, 'gerente@segalfa.test', 'GERENTE_VENTAS')
  await sembrarUsuario(alfa, 'finanzas@segalfa.test', 'FINANZAS')

  await arrancarServidor()
  dueno = new Cliente()
  vendedor = new Cliente()
  otroVendedor = new Cliente()
  gerente = new Cliente()
  finanzas = new Cliente()
  duenoBeta = new Cliente()
  await dueno.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await vendedor.entrar('vendedor@segalfa.test', PASSWORD_DEMO)
  await otroVendedor.entrar('otro@segalfa.test', PASSWORD_DEMO)
  await gerente.entrar('gerente@segalfa.test', PASSWORD_DEMO)
  await finanzas.entrar('finanzas@segalfa.test', PASSWORD_DEMO)
  await duenoBeta.entrar(beta.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

/** El seguimiento como lo pide el navegador del cliente: SIN sesión. Devuelve también el texto crudo. */
async function seguimiento(token: string) {
  const r = await fetch(`${BASE}/api/propuestas/publica/${token}/seguimiento/`)
  const texto = await r.text()
  let datos: any = null
  try { datos = JSON.parse(texto) } catch { datos = texto }
  return { status: r.status, datos, texto }
}

/** Crea, envía y hace aceptar por la liga una propuesta; devuelve id y token, aún SIN campaña. */
async function propuestaAceptada(c: Cliente, org: Awaited<ReturnType<typeof sembrarTenant>>, sitioId: string, nombre: string, precio: number) {
  const r = await c.pedir('/api/propuestas/', {
    cuerpo: {
      clienteId: org.clienteId,
      nombre,
      fechaInicio: enDias(7),
      fechaFin: enDias(37),
      items: [{
        sitioId, precio, unidad: 'mensual', tarifaUnitaria: precio, cantidad: 1,
        rentaMonto: 15000, rentaPeriodicidad: 'MENSUAL', rentaInicio: enDias(0),
      }],
    },
  })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  const { id, tokenPublico } = r.datos as { id: string; tokenPublico: string }

  const env = await c.pedir(`/api/propuestas/${id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
  expect(env.status, JSON.stringify(env.datos)).toBe(200)

  // Antes de aceptar: la liga existe, pero no hay nada que seguir.
  const antes = await seguimiento(tokenPublico)
  expect(antes.status).toBe(200)
  expect(antes.datos).toEqual({ hayCampana: false })

  const acep = await anonimo().pedir(`/api/propuestas/publica/${tokenPublico}/`, { cuerpo: { nombre: 'Cliente de la liga' } })
  expect(acep.status, JSON.stringify(acep.datos)).toBe(200)
  return { id, token: tokenPublico }
}

async function generar(c: Cliente, propuestaId: string): Promise<string> {
  const g = await c.pedir(`/api/propuestas/${propuestaId}/generar-campana/`, { cuerpo: {} })
  expect(g.status, JSON.stringify(g.datos)).toBe(201)
  return g.datos.id as string
}

const pasoDe = (s: any, clave: string) => (s.pasos as any[]).find((p) => p.clave === clave)

// Estado compartido de la OOH de alfa, que se recorre en orden.
let ooh: { id: string; token: string; campanaId: string }
let oiNorte: string
let oiSegunda: string

describe('1 · de propuesta a campaña: el seguimiento se enciende al generar', () => {
  it('aceptada por la liga todavía NO es campaña; generada, sí', async () => {
    const p = await propuestaAceptada(vendedor, alfa, lonaAlfa, 'Campaña Lona Seguimiento', 30000)

    // Aceptar no genera la campaña (solo el PATCH a APROBADA con sesión lo hace).
    const tras = await seguimiento(p.token)
    expect(tras.status).toBe(200)
    expect(tras.datos).toEqual({ hayCampana: false })

    const campanaId = await generar(vendedor, p.id)
    ooh = { ...p, campanaId }

    const s = await seguimiento(p.token)
    expect(s.status).toBe(200)
    expect(s.datos.hayCampana).toBe(true)
    expect(s.datos.seguimiento.tipo).toBe('OOH')
    expect(s.datos.seguimiento.nombre).toBe('Campaña Lona Seguimiento')
  })
})

describe('2 · una OOH recorre su línea por las rutas reales', () => {
  it('sin orden de imprenta: «esperando arte», en el paso de material', async () => {
    const s = (await seguimiento(ooh.token)).datos.seguimiento
    expect(s.pasoActual).toBe('material')
    expect(s.mensaje).toBe('material.esperando-arte')
    expect(pasoDe(s, 'aceptada').estado).toBe('hecho')
    expect(pasoDe(s, 'aceptada').fecha).not.toBeNull() // la aceptación por la liga deja su fecha
    expect(pasoDe(s, 'confirmada').estado).toBe('hecho')
    expect(pasoDe(s, 'material').estado).toBe('actual')
    expect(s.imprenta).toEqual([])
    expect(s.retrasada).toBe(false)
  })

  it('dos órdenes de imprenta, una impresa: «1 de 2 lonas»', async () => {
    const a = await dueno.pedir('/api/impresion/', {
      cuerpo: { campanaId: ooh.campanaId, sitioId: lonaAlfa, material: 'Lona front', alto: 7.2, ancho: 12.9, proveedor: 'Imprenta Norte' },
    })
    expect(a.status, JSON.stringify(a.datos)).toBe(201)
    oiNorte = a.datos.id
    const b = await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: ooh.campanaId, sitioId: lonaAlfa, material: 'Vinil' } })
    expect(b.status, JSON.stringify(b.datos)).toBe(201)
    oiSegunda = b.datos.id

    // ARTE_RECIBIDO → VALIDADO → EN_PRODUCCION → IMPRESO
    for (const esperado of ['VALIDADO', 'EN_PRODUCCION', 'IMPRESO']) {
      const r = await dueno.pedir(`/api/impresion/${oiNorte}/`, { metodo: 'PATCH', cuerpo: {} })
      expect(r.status, JSON.stringify(r.datos)).toBe(200)
      expect(r.datos.estatus).toBe(esperado)
    }

    const s = (await seguimiento(ooh.token)).datos.seguimiento
    expect(s.pasoActual).toBe('material')
    expect(s.mensaje).toBe('material.imprenta')
    expect(s.imprenta).toHaveLength(2)
    expect(s.imprentaListas).toBe(1)
    const norte = s.imprenta.find((o: any) => o.estatus === 'IMPRESO')
    expect(norte.avance).toBeCloseTo(0.8)
    expect(norte.sitioNombre).toBe('Lona Periférico Alfa')
    expect(s.imprenta.find((o: any) => o.estatus === 'ARTE_RECIBIDO').avance).toBeCloseTo(0.2)
  })

  it('las dos impresas pasan a instalación; el montaje completado la cumple', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await dueno.pedir(`/api/impresion/${oiSegunda}/`, { metodo: 'PATCH', cuerpo: {} })
      expect(r.status, JSON.stringify(r.datos)).toBe(200)
    }
    let s = (await seguimiento(ooh.token)).datos.seguimiento
    expect(s.imprentaListas).toBe(2)
    expect(pasoDe(s, 'material').estado).toBe('hecho')
    expect(s.pasoActual).toBe('instalacion')
    expect(s.mensaje).toBe('instalacion.montaje')

    // Un MANTENIMIENTO de la campaña no es avance de montaje: no cumple nada.
    const mant = await dueno.pedir('/api/ot/', {
      cuerpo: { tipo: 'MANTENIMIENTO_PREVENTIVO', descripcion: 'Revisión', fechaProgramada: enDias(1), sitioId: lonaAlfa, campanaId: ooh.campanaId },
    })
    expect(mant.status, JSON.stringify(mant.datos)).toBe(201)
    expect((await dueno.pedir(`/api/ot/${mant.datos.id}/cerrar/`, { cuerpo: { fotoUrl: FOTO } })).status).toBe(200)
    s = (await seguimiento(ooh.token)).datos.seguimiento
    expect(s.pasoActual).toBe('instalacion')

    const ot = await dueno.pedir('/api/ot/', {
      cuerpo: { tipo: 'MONTAJE_LONA', descripcion: 'Montaje de la lona', fechaProgramada: enDias(1), sitioId: lonaAlfa, campanaId: ooh.campanaId },
    })
    expect(ot.status, JSON.stringify(ot.datos)).toBe(201)
    s = (await seguimiento(ooh.token)).datos.seguimiento
    expect(s.pasoActual, 'una OT abierta no cuenta como montada').toBe('instalacion')

    const cierre = await dueno.pedir(`/api/ot/${ot.datos.id}/cerrar/`, { cuerpo: { fotoUrl: FOTO } })
    expect(cierre.status, JSON.stringify(cierre.datos)).toBe(200)

    s = (await seguimiento(ooh.token)).datos.seguimiento
    expect(pasoDe(s, 'instalacion').estado).toBe('hecho')
    expect(pasoDe(s, 'instalacion').fecha).not.toBeNull()
    // Arranca en 7 días: montada pero esperando su fecha — NO «al aire».
    expect(s.pasoActual).toBe('al_aire')
    expect(s.mensaje).toBe('lista')
  })

  it('con la fecha de arranque ya pasada, la campaña está al aire (y no «terminó»)', async () => {
    // Sin ruta que mueva una campaña al pasado: se ajusta en la base.
    await poolTest().query(`update campanas set fecha_inicio = $2::date where id = $1`, [ooh.campanaId, enDias(-3)])
    const s = (await seguimiento(ooh.token)).datos.seguimiento
    // El «Ahora» va en «Al aire» mientras corre, no en «Campaña terminada».
    expect(pasoDe(s, 'al_aire').estado).toBe('actual')
    expect(pasoDe(s, 'finalizada').estado).toBe('pendiente')
    expect(s.pasoActual).toBe('al_aire')
    expect(s.mensaje).toBe('al_aire')
    expect(s.retrasada).toBe(false)
  })
})

describe('3 · el nombre de la imprenta: oculto por omisión, lo enciende el creador', () => {
  it('por omisión el texto crudo NO contiene «Imprenta Norte»', async () => {
    const f = await poolTest().query(`select imprenta_visible from propuestas where id = $1`, [ooh.id])
    expect(f.rows[0].imprenta_visible).toBe(false)
    const r = await seguimiento(ooh.token)
    expect(r.texto).not.toContain('Imprenta Norte')
    expect(r.texto).not.toMatch(/Norte/i)
    expect(r.datos.seguimiento.proveedores).toEqual([])
    for (const o of r.datos.seguimiento.imprenta) expect(o.proveedor).toBeNull()
  })

  it('el creador lo ve con permiso; el PATCH del creador lo enciende y aparece en la liga', async () => {
    const g = await vendedor.pedir(`/api/propuestas/${ooh.id}/imprenta-visible/`)
    expect(g.status, JSON.stringify(g.datos)).toBe(200)
    expect(g.datos).toEqual({ imprentaVisible: false, puedeCambiar: true })

    const p = await vendedor.pedir(`/api/propuestas/${ooh.id}/imprenta-visible/`, { metodo: 'PATCH', cuerpo: { visible: true } })
    expect(p.status, JSON.stringify(p.datos)).toBe(200)
    expect(p.datos.imprentaVisible).toBe(true)

    const r = await seguimiento(ooh.token)
    expect(r.texto).toContain('Imprenta Norte')
    expect(r.datos.seguimiento.proveedores).toEqual(['Imprenta Norte'])

    // Y apagarlo lo vuelve a esconder.
    const off = await vendedor.pedir(`/api/propuestas/${ooh.id}/imprenta-visible/`, { metodo: 'PATCH', cuerpo: { visible: false } })
    expect(off.status).toBe(200)
    expect((await seguimiento(ooh.token)).texto).not.toContain('Imprenta Norte')
  })

  // ADR 0051 (Fase 3): un vendedor solo ve SUS propuestas, y una ajena es 404
  // en TODA ruta por id. Esta ruta nació en otra rama (SEG-CLIENTE) antes de que
  // existiera esa regla, y al integrarse contestaba 200 al GET (delataba que la
  // propuesta existe y el valor del interruptor) y 403 al PATCH (lo mismo). Lo
  // encontró el 18/11 la siembra de casos locales con dos vendedores.
  it('NEGATIVO · otro VENDEDOR: la propuesta ajena es 404 al leer y al cambiar, y el valor no cambia', async () => {
    const g = await otroVendedor.pedir(`/api/propuestas/${ooh.id}/imprenta-visible/`)
    expect(g.status, JSON.stringify(g.datos)).toBe(404)

    const p = await otroVendedor.pedir(`/api/propuestas/${ooh.id}/imprenta-visible/`, { metodo: 'PATCH', cuerpo: { visible: true } })
    expect(p.status, JSON.stringify(p.datos)).toBe(404)
    const f = await poolTest().query(`select imprenta_visible from propuestas where id = $1`, [ooh.id])
    expect(f.rows[0].imprenta_visible).toBe(false)
    expect((await seguimiento(ooh.token)).texto).not.toContain('Imprenta Norte')
  })

  it('NEGATIVO · FINANZAS: 403 y el valor no cambia', async () => {
    const p = await finanzas.pedir(`/api/propuestas/${ooh.id}/imprenta-visible/`, { metodo: 'PATCH', cuerpo: { visible: true } })
    expect(p.status, JSON.stringify(p.datos)).toBe(403)
    const f = await poolTest().query(`select imprenta_visible from propuestas where id = $1`, [ooh.id])
    expect(f.rows[0].imprenta_visible).toBe(false)
  })

  it('un GERENTE_VENTAS (superior del vendedor) sí puede: 200', async () => {
    const g = await gerente.pedir(`/api/propuestas/${ooh.id}/imprenta-visible/`)
    expect(g.datos.puedeCambiar).toBe(true)
    const p = await gerente.pedir(`/api/propuestas/${ooh.id}/imprenta-visible/`, { metodo: 'PATCH', cuerpo: { visible: true } })
    expect(p.status, JSON.stringify(p.datos)).toBe(200)
    expect((await seguimiento(ooh.token)).texto).toContain('Imprenta Norte')
  })

  it('NEGATIVO · un cuerpo sin `visible` booleano da 400, no un cambio', async () => {
    const p = await vendedor.pedir(`/api/propuestas/${ooh.id}/imprenta-visible/`, { metodo: 'PATCH', cuerpo: { visible: 'si' } })
    expect(p.status).toBe(400)
  })
})

describe('4 · una DOOH con el creativo rechazado se marca en alerta', () => {
  it('esperando arte → rechazado (alerta) → aprobado sigue a publicación', async () => {
    const p = await propuestaAceptada(dueno, alfa, alfa.sitioId, 'Campaña Pantalla Seguimiento', 45000)
    const campanaId = await generar(dueno, p.id)

    let s = (await seguimiento(p.token)).datos.seguimiento
    expect(s.tipo).toBe('DOOH')
    expect(s.mensaje).toBe('material.esperando-arte')

    const crea = await dueno.pedir('/api/creatividades/', {
      cuerpo: { campanaId, nombre: 'Arte 1920x1080', archivoUrl: FOTO, formato: 'png', resolucion: '1920x1080' },
    })
    expect(crea.status, JSON.stringify(crea.datos)).toBe(201)
    s = (await seguimiento(p.token)).datos.seguimiento
    expect(s.mensaje).toBe('material.revision')

    const rech = await dueno.pedir(`/api/creatividades/${crea.datos.id}/`, {
      metodo: 'PATCH',
      cuerpo: { aprobar: false, motivo: 'MOTIVO-INTERNO-NO-SE-VE' },
    })
    expect(rech.status, JSON.stringify(rech.datos)).toBe(200)
    const r = await seguimiento(p.token)
    s = r.datos.seguimiento
    expect(s.mensaje).toBe('material.rechazado')
    expect(pasoDe(s, 'material').estado).toBe('alerta')
    expect(s.creativos[0].estatus).toBe('RECHAZADA')
    expect(s.imprenta).toEqual([])
    // El motivo del rechazo es interno y la URL del archivo no se lee.
    expect(r.texto).not.toContain('MOTIVO-INTERNO-NO-SE-VE')
    expect(r.texto).not.toContain('base64')
  })
})

describe('5 · el JSON público no lleva dinero, OC ni facturas', () => {
  it('con una OC y una factura registradas, ninguna cifra ni folio viaja', async () => {
    const p = poolTest()
    // Sembradas en la base: lo que se mira es que el seguimiento NO las lea,
    // no el flujo de facturación (que tiene su propia suite).
    await p.query(
      `insert into ordenes_compra (folio, numero_oc, campana_id, monto, tenant_id)
       values ('OC-SEG-FOLIO-9931', 'NUMOC-SECRETO-4471', $1, 34567.89, $2)`,
      [ooh.campanaId, alfa.id],
    )
    await p.query(
      `insert into facturas (folio, campana_id, cliente_id, subtotal, igv, monto, moneda, serie, folio_fiscal, tenant_id)
       values ('FAC-SEG-5518', $1, $2, 29800.00, 4768.00, 34568.00, 'MXN', 'SEGX', 'UUID-FISCAL-SEG-7781', $3)`,
      [ooh.campanaId, alfa.clienteId, alfa.id],
    )

    const r = await seguimiento(ooh.token)
    expect(r.status).toBe(200)
    for (const prohibido of [
      'OC-SEG-FOLIO-9931', 'NUMOC-SECRETO-4471', '34567', 'FAC-SEG-5518', 'UUID-FISCAL-SEG-7781', 'SEGX',
      '29800', '4768', '34568', '30000', '15000',
    ]) {
      expect(r.texto, `el seguimiento filtró «${prohibido}»`).not.toContain(prohibido)
    }
    // Y ninguna CLAVE con nombre de dinero, a cualquier profundidad.
    const claves: string[] = []
    const recorrer = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(recorrer)
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { claves.push(k); recorrer(x) }
    }
    recorrer(r.datos)
    // (`^renta` y no `renta`: «imprenta» la contiene y no es dinero.)
    const dinero = /monto|precio|importe|total|^iva|igv|tarifa|^renta|factur|^oc|numeroOc|cobr|pago|candado|costo|comision/i
    expect(claves.filter((k) => dinero.test(k))).toEqual([])
  })
})

describe('6 · R2 · el token de una organización no ve nada de la otra', () => {
  let tokenBeta: string
  let tokenAlfaSinCampana: string

  beforeAll(async () => {
    // Beta tiene SU campaña OOH con su imprenta VISIBLE y nombres que no se
    // pueden confundir con los de alfa.
    const pb = await propuestaAceptada(duenoBeta, beta, lonaBeta, 'Campaña SECRETA de Beta', 30000)
    const cb = await generar(duenoBeta, pb.id)
    const oi = await duenoBeta.pedir('/api/impresion/', { cuerpo: { campanaId: cb, sitioId: lonaBeta, proveedor: 'Imprenta Beta Reservada' } })
    expect(oi.status, JSON.stringify(oi.datos)).toBe(201)
    const vis = await duenoBeta.pedir(`/api/propuestas/${pb.id}/imprenta-visible/`, { metodo: 'PATCH', cuerpo: { visible: true } })
    expect(vis.status).toBe(200)
    tokenBeta = pb.token

    // Y alfa una propuesta aceptada SIN campaña: con campañas de beta en la
    // base, no puede «encontrar» ninguna.
    tokenAlfaSinCampana = (await propuestaAceptada(vendedor, alfa, lonaAlfa, 'Alfa sin campaña', 30000)).token
  }, 60_000)

  it('el token de beta ve SU campaña y su imprenta', async () => {
    const r = await seguimiento(tokenBeta)
    expect(r.datos.seguimiento.nombre).toBe('Campaña SECRETA de Beta')
    expect(r.texto).toContain('Imprenta Beta Reservada')
  })

  it('NEGATIVO · los tokens de alfa no devuelven nada de beta', async () => {
    for (const t of [ooh.token, tokenAlfaSinCampana]) {
      const r = await seguimiento(t)
      expect(r.status).toBe(200)
      expect(r.texto).not.toContain('Beta')
      expect(r.texto).not.toContain('SECRETA')
    }
    expect((await seguimiento(tokenAlfaSinCampana)).datos).toEqual({ hayCampana: false })
    expect((await seguimiento(ooh.token)).datos.seguimiento.nombre).toBe('Campaña Lona Seguimiento')
  })

  it('NEGATIVO · beta no puede mover el interruptor de una propuesta de alfa (404, sin cambio)', async () => {
    const antes = (await poolTest().query(`select imprenta_visible from propuestas where id = $1`, [ooh.id])).rows[0].imprenta_visible
    const p = await duenoBeta.pedir(`/api/propuestas/${ooh.id}/imprenta-visible/`, { metodo: 'PATCH', cuerpo: { visible: !antes } })
    expect(p.status).toBe(404)
    const despues = (await poolTest().query(`select imprenta_visible from propuestas where id = $1`, [ooh.id])).rows[0].imprenta_visible
    expect(despues).toBe(antes)
  })

  it('NEGATIVO · un token inventado de 48 hex da 404; uno mal formado, también', async () => {
    const inventado = randomBytes(24).toString('hex')
    expect(inventado).toHaveLength(48)
    const r = await seguimiento(inventado)
    expect(r.status).toBe(404)
    expect(r.texto).not.toContain('Beta')
    expect(r.texto).not.toContain('Lona')
    expect((await seguimiento('abc')).status).toBe(404)
    expect((await seguimiento(`${ooh.token}'--`)).status).toBe(404)
  })
})

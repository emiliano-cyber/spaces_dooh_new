import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  VEND-01 · el VENDEDOR de una propuesta se toma de la SESIÓN, y el reporte
//  por vendedor no cruza organizaciones.
// ----------------------------------------------------------------------------
//  Es ROJO por triple: lleva migración, toca tenant y toca dinero por el lado de
//  la atribución de descuentos. Las tres cosas que las unitarias NO pueden ver:
//
//   1. **La migración se aplicó de verdad.** `reportes-repo` hace un `join`
//      contra `propuestas.usuario_id`. Si la columna no existiera, la unitaria
//      seguiría en verde —simula la base— y el endpoint devolvería un 500.
//   2. **El vendedor no se puede mandar por la red.** La unitaria comprueba el
//      contrato entre controller y repo; aquí se manda un `usuarioId` AJENO
//      dentro del JSON de una petición real y se lee la fila que quedó escrita.
//      Es la diferencia entre «zod lo recorta» y «el atacante no lo consigue».
//   3. **Que la RLS corte de verdad**, con el rol de la aplicación y no con el
//      superusuario de las semillas. Los dos peores fallos de aislamiento de
//      este repo pasaron las unitarias sin despeinarse, y un reporte con el
//      vendedor de otra empresa dentro SE LEE PERFECTAMENTE BIEN: no da error,
//      da una persona de más en una tabla de dinero.
//
//  Las dos organizaciones venden lo MISMO en el MISMO periodo a propósito: si el
//  aislamiento fallara, el síntoma sería el total al doble, no un nombre raro.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente
let cVendedor: Cliente

interface Sembrado {
  /** El usuario COMERCIAL de esta organización: su vendedor. */
  vendedorId: string
  vendedorEmail: string
  vendedorNombre: string
  sitioId: string
  /** La campaña nacida de una propuesta CON vendedor. */
  campanaConVendedor: string
  /** La campaña nacida de una propuesta HISTÓRICA (usuario_id nulo). */
  campanaHistorica: string
}

// Siembra, para una organización, lo que la dimensión `vendedor` necesita:
// un vendedor, una pantalla, y DOS ventas —una atribuida y una histórica— con
// su snapshot económico congelado para poder medir el descuento.
//
// Se inserta con el pool de pruebas (superusuario) y no por la API porque lo que
// se prueba aquí es la LECTURA con RLS: montar el camino comercial completo
// metería media aplicación en medio y el rojo dejaría de señalar el reporte. El
// camino de ESCRITURA se prueba aparte, y por la red, más abajo.
async function sembrarVentas(org: Awaited<ReturnType<typeof sembrarTenant>>): Promise<Sembrado> {
  const p = poolTest()
  const nombreVendedor = `Vendedora ${org.slug}`
  const emailVendedor = `vendedora@${org.slug}.test`
  const u = await p.query(
    `insert into usuarios (nombre, email, cargo, rol, password_hash, activo, tenant_id)
     values ($1,$2,'Ejecutiva de cuenta','COMERCIAL',$3,true,$4) returning id`,
    [nombreVendedor, emailVendedor, await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
  const vendedorId = u.rows[0].id as string

  const sitio = await p.query(
    `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, exhibicion,
                         es_rotativo, ancho, alto, caras, alcaldia, ciudad, tenant_id)
     values ($1,$2,$3,'VALLA','fijo',false,6,3,1,'Tlalpan','CDMX',$4)
     returning id`,
    [
      `Valla vend ${org.slug}`,
      `${org.slug.toUpperCase()}-VEND-1`,
      `${org.slug.toUpperCase()}-PROV-VEND-1`,
      org.id,
    ],
  )
  const sitioId = sitio.rows[0].id as string

  // Una venta con vendedor y su snapshot: lista 100 000, neto 72 000 (20 % de
  // descuento y 10 % de comisión: 100 000 × 0.8 × 0.9 = 72 000).
  const conVendedor = await sembrarVenta(org.id, {
    sufijo: 'CON',
    sitioId,
    clienteId: org.clienteId,
    usuarioId: vendedorId,
    lista: 100_000,
    neto: 72_000,
  })
  // Y la HISTÓRICA: mismo snapshot, `usuario_id` NULO. Es el caso que da nombre
  // a todo esto — la propuesta se capturó antes del 2026-09-28.
  const historica = await sembrarVenta(org.id, {
    sufijo: 'HIS',
    sitioId,
    clienteId: org.clienteId,
    usuarioId: null,
    lista: 50_000,
    neto: 40_000,
  })

  return {
    vendedorId,
    vendedorEmail: emailVendedor,
    vendedorNombre: nombreVendedor,
    sitioId,
    campanaConVendedor: conVendedor,
    campanaHistorica: historica,
  }
}

async function sembrarVenta(
  tenantId: string,
  v: {
    sufijo: string
    sitioId: string
    clienteId: string
    usuarioId: string | null
    lista: number
    neto: number
  },
): Promise<string> {
  const p = poolTest()
  const prop = await p.query(
    `insert into propuestas (folio, nombre, cliente_id, usuario_id, snapshot_economico, tenant_id)
     values ($1,$2,$3,$4,$5::jsonb,$6) returning id`,
    [
      `PROP-${v.sufijo}-${tenantId.slice(0, 8)}`,
      `Propuesta ${v.sufijo}`,
      v.clienteId,
      v.usuarioId,
      JSON.stringify({ porSitio: [{ sitioId: v.sitioId, lista: v.lista, neto: v.neto }] }),
      tenantId,
    ],
  )
  const campana = await p.query(
    `insert into campanas (nombre, cliente_id, fecha_inicio, fecha_fin, estado_comercial, propuesta_id, tenant_id)
     values ($1,$2,$3,$4,'ACTIVA',$5,$6) returning id`,
    [`Campana ${v.sufijo}`, v.clienteId, enDias(-20), enDias(-10), prop.rows[0].id, tenantId],
  )
  // El precio de la reserva ES el neto congelado: eso es lo que la hace
  // COMPARABLE (las dos convenciones de precio de `reservas.precio`).
  await p.query(
    `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, estatus, tenant_id)
     values ($1,$2,$3,$4,$5,'CONFIRMADA',$6)`,
    [campana.rows[0].id, v.sitioId, enDias(-20), enDias(-10), v.neto, tenantId],
  )
  return campana.rows[0].id
}

let datosAlfa: Sembrado
let datosBeta: Sembrado

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('vendalfa')
  beta = await sembrarTenant('vendbeta')
  datosAlfa = await sembrarVentas(alfa)
  datosBeta = await sembrarVentas(beta)

  await arrancarServidor()
  ca = new Cliente()
  cb = new Cliente()
  cVendedor = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cb.entrar(beta.usuarioEmail, PASSWORD_DEMO)
  await cVendedor.entrar(datosAlfa.vendedorEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

const RANGO = () => ({ desde: enDias(-30), hasta: enDias(0) })

async function reporte(c: Cliente, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    ...RANGO(),
    dimension: 'vendedor',
    granularidad: 'mes',
    ...extra,
  })
  const r = await c.pedir(`/api/reportes/rentabilidad/?${params}`)
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
  return r.datos
}

// ─── 1 · LA MIGRACIÓN ───────────────────────────────────────────────────────

describe('la migración dejó la columna como se pidió', () => {
  it('`propuestas.usuario_id` existe, es uuid y es NULLABLE', async () => {
    const r = await poolTest().query(
      `select data_type, is_nullable, column_default
         from information_schema.columns
        where table_name = 'propuestas' and column_name = 'usuario_id'`,
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].data_type).toBe('uuid')
    // NULLABLE y SIN DEFAULT, y es la decisión que más importa: rellenar el
    // histórico con «alguien» convertiría una laguna en una afirmación falsa
    // sobre dinero — le acreditaría a una persona las ventas de todos.
    expect(r.rows[0].is_nullable).toBe('YES')
    expect(r.rows[0].column_default).toBeNull()
  })

  it('la clave ajena es `on delete set null`, no `restrict`', async () => {
    const r = await poolTest().query(
      `select confdeltype from pg_constraint
        where conname = 'propuestas_usuario_id_fkey'
          and conrelid = 'propuestas'::regclass`,
    )
    expect(r.rows).toHaveLength(1)
    // 'n' = set null. Con 'r' (restrict) el primer vendedor que hiciera una
    // propuesta quedaría IMBORRABLE y `borrarUsuario()` devolvería un 500.
    expect(r.rows[0].confdeltype).toBe('n')
  })

  it('borrar al vendedor NO borra su propuesta: la deja «sin vendedor»', async () => {
    // El comportamiento que la decisión de `on delete set null` compra, medido
    // contra Postgres y no deducido del DDL. Se hace en una transacción que se
    // deshace para no tocar lo que siembran las demás pruebas.
    const p = poolTest()
    const c = await p.connect()
    try {
      await c.query('begin')
      await c.query('delete from usuarios where id = $1', [datosAlfa.vendedorId])
      const r = await c.query(
        `select usuario_id from propuestas where tenant_id = $1 and folio like 'PROP-CON-%'`,
        [alfa.id],
      )
      expect(r.rows).toHaveLength(1)
      expect(r.rows[0].usuario_id).toBeNull()
    } finally {
      await c.query('rollback')
      c.release()
    }
  })
})

// ─── 2 · EL CASO NEGATIVO QUE DA NOMBRE A LA TAREA ──────────────────────────

describe('el vendedor NO se puede falsear desde el cliente', () => {
  it('un `usuarioId` ajeno en el cuerpo se ignora: queda el de la SESIÓN', async () => {
    // La propuesta la crea LA VENDEDORA de alfa, y el cuerpo intenta
    // atribuírsela al DUEÑO. Si esto pasara, cualquiera con `comercial.crear`
    // podría cargarle a otro un descuento del 80 % con un `curl` — y no daría
    // ningún error: la propuesta se crearía igual.
    const duenoAlfa = await poolTest().query(
      'select id from usuarios where email = $1',
      [alfa.usuarioEmail],
    )
    const idAjeno = duenoAlfa.rows[0].id as string

    const r = await cVendedor.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Propuesta con vendedor inyectado',
        fechaInicio: enDias(1),
        fechaFin: enDias(30),
        items: [{ sitioId: datosAlfa.sitioId, precio: 10_000 }],
        // El intento, por sus tres nombres plausibles.
        usuarioId: idAjeno,
        usuario_id: idAjeno,
        vendedorId: idAjeno,
      },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)

    const fila = await poolTest().query('select usuario_id from propuestas where id = $1', [
      r.datos.id,
    ])
    expect(fila.rows).toHaveLength(1)
    expect(fila.rows[0].usuario_id).toBe(datosAlfa.vendedorId)
    expect(fila.rows[0].usuario_id).not.toBe(idAjeno)
  })

  it('sin inyectar nada, la propuesta queda a nombre de quien la creó', async () => {
    // Control positivo. Sin él, un repo que escribiera siempre `null` pasaría la
    // prueba de arriba sin hacer nada.
    const r = await cVendedor.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Propuesta limpia',
        fechaInicio: enDias(1),
        fechaFin: enDias(30),
        items: [{ sitioId: datosAlfa.sitioId, precio: 5_000 }],
      },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    const fila = await poolTest().query('select usuario_id from propuestas where id = $1', [
      r.datos.id,
    ])
    expect(fila.rows[0].usuario_id).toBe(datosAlfa.vendedorId)
  })

  it('y el dueño de alfa crea las suyas a SU nombre, no al de la vendedora', async () => {
    // Dos sesiones vivas a la vez sobre la misma organización: lo que decide la
    // atribución es la cookie de cada una, no la última que escribió.
    const duenoAlfa = await poolTest().query('select id from usuarios where email = $1', [
      alfa.usuarioEmail,
    ])
    const r = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Propuesta del dueno',
        fechaInicio: enDias(1),
        fechaFin: enDias(30),
        items: [{ sitioId: datosAlfa.sitioId, precio: 5_000 }],
      },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    const fila = await poolTest().query('select usuario_id from propuestas where id = $1', [
      r.datos.id,
    ])
    expect(fila.rows[0].usuario_id).toBe(duenoAlfa.rows[0].id)
    expect(fila.rows[0].usuario_id).not.toBe(datosAlfa.vendedorId)
  })
})

// ─── 3 · R2 · EL AISLAMIENTO ────────────────────────────────────────────────

describe('R2 · el vendedor de una organización no se lee desde otra', () => {
  it('el reporte de alfa trae a SU vendedora y ni el nombre ni el id de la de beta', async () => {
    const d = await reporte(ca)
    const claves = d.filas.map((f: any) => f.clave)
    expect(claves).toContain(datosAlfa.vendedorId)
    expect(claves).not.toContain(datosBeta.vendedorId)
    // Un reporte filtrado a medias podría traer la etiqueta sin la clave: se
    // comprueba el JSON entero, que es donde se vería.
    const texto = JSON.stringify(d)
    expect(texto).toContain(datosAlfa.vendedorNombre)
    expect(texto).not.toContain(datosBeta.vendedorNombre)
    expect(texto).not.toContain('vendbeta')
    expect(texto).not.toContain(beta.id)
  })

  it('y el de beta no trae ni uno de alfa — el corte va en las dos direcciones', async () => {
    const d = await reporte(cb)
    const claves = d.filas.map((f: any) => f.clave)
    expect(claves).toContain(datosBeta.vendedorId)
    expect(claves).not.toContain(datosAlfa.vendedorId)
    expect(JSON.stringify(d)).not.toContain('vendalfa')
  })

  it('el ingreso de la vendedora es 72 000 y NO 144 000', async () => {
    // El síntoma que un fallo de aislamiento daría de verdad. Las dos
    // organizaciones venden lo mismo, en el mismo periodo, con el mismo
    // descuento: un total al doble es lo único que se vería.
    for (const [c, datos] of [
      [ca, datosAlfa],
      [cb, datosBeta],
    ] as const) {
      const d = await reporte(c)
      const fila = d.filas.find((f: any) => f.clave === datos.vendedorId)
      expect(fila, JSON.stringify(d.filas)).toBeTruthy()
      expect(fila.ingreso).toBe(72_000)
      expect(fila.ingresoLista).toBe(100_000)
      expect(fila.descuentoYComision).toBe(28_000)
      expect(fila.descuentoYComisionPct).toBe(28)
    }
  })
})

// ─── 4 · EL HISTÓRICO, CONTRA POSTGRES ──────────────────────────────────────

describe('el histórico sale con su importe, y con RAYA donde no se sabe', () => {
  it('«Sin vendedor» trae el dinero de la propuesta sin `usuario_id`', async () => {
    const d = await reporte(ca)
    const sin = d.filas.find((f: any) => f.clave === '')
    expect(sin, JSON.stringify(d.filas)).toBeTruthy()
    expect(sin.etiqueta).toBe('Sin vendedor')
    // La venta histórica: neto 40 000 sobre lista 50 000.
    expect(sin.ingreso).toBe(40_000)
    expect(sin.ingresoLista).toBe(50_000)
    expect(sin.descuentoYComision).toBe(10_000)
  })

  it('y va la ÚLTIMA: no compite por el primer puesto del ranking', async () => {
    const d = await reporte(ca)
    expect(d.filas[d.filas.length - 1].clave).toBe('')
  })

  it('el aviso de cobertura dice cuánto es y que NO se puede recuperar', async () => {
    const d = await reporte(ca)
    expect(d.vendedores).toBeTruthy()
    expect(d.vendedores.reservasConVendedor).toBe(1)
    expect(d.vendedores.reservasSinVendedor).toBe(1)
    expect(d.vendedores.reservasDePropuestaSinVendedor).toBe(1)
    expect(d.vendedores.ingresoSinVendedor).toBe(40_000)
    expect(d.vendedores.nota).toMatch(/no se puede recuperar/i)
  })

  it('NINGUNA cifra de la tabla es un cero que debería ser una raya', async () => {
    // El corazón de la doctrina, comprobado sobre la respuesta real: un 0 en
    // «Descuento y comisión» afirmaría que esa persona no concedió ninguno.
    // Aquí todas las filas SÍ tienen comparación, así que ninguna puede traer
    // un cero en esas columnas — y si alguna lo trajera, sería el bug.
    const d = await reporte(ca)
    for (const f of d.filas) {
      expect([f.ingresoLista, f.ingresoComparable, f.descuentoYComision], f.etiqueta).not.toContain(
        0,
      )
    }
  })
})

// ─── 5 · EL CONTRATO DEL ENDPOINT ───────────────────────────────────────────

describe('la dimensión es parte del contrato, no un extra', () => {
  it('los TOTALES no cambian al cambiar de agrupador', async () => {
    // 72 000 + 40 000 de las dos ventas de alfa.
    const porVendedor = await reporte(ca)
    const porSitio = await reporte(ca, { dimension: 'sitio' })
    expect(porVendedor.totales.ingreso).toBe(112_000)
    expect(porVendedor.totales).toEqual(porSitio.totales)
  })

  it('un rol sin `finanzas` no ve este reporte: es dinero, no vitrina', async () => {
    // La vendedora es COMERCIAL. Puede CREAR propuestas —lo hace dos veces más
    // arriba— y NO puede ver cuánto descuento concedió cada quien. Que el
    // reporte exista no abre una puerta nueva.
    const r = await cVendedor.pedir(
      `/api/reportes/rentabilidad/?${new URLSearchParams({ ...RANGO(), dimension: 'vendedor', granularidad: 'mes' })}`,
    )
    expect(r.status).toBe(403)
  })

  it('sin sesión, 401 — y ni el nombre de un vendedor se filtra', async () => {
    const anonimo = new Cliente()
    const r = await anonimo.pedir(
      `/api/reportes/rentabilidad/?${new URLSearchParams({ ...RANGO(), dimension: 'vendedor', granularidad: 'mes' })}`,
    )
    expect(r.status).toBe(401)
    expect(JSON.stringify(r.datos)).not.toContain(datosAlfa.vendedorNombre)
  })
})

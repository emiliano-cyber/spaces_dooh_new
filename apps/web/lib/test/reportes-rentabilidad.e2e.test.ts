import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  R2 · el reporte de rentabilidad de una organización NO trae ni una fila de
//  la otra — contra Postgres de verdad y con el rol de la aplicación.
// ----------------------------------------------------------------------------
//  Esta prueba la dejó anotada como pendiente la nota de la bóveda el 17/09
//  («Falta además una e2e propia del endpoint»): el módulo nació con el arnés
//  ocupado por otro agente y no se corrió ninguna e2e.
//
//  Lo que NO puede probar `reportes-repo.aislamiento.test.ts`, que es lo que
//  aquí importa:
//
//   · Ese guard lee el CÓDIGO y comprueba que el `and tenant_id` esté ESCRITO.
//     Que la RLS corte de verdad, con el rol de la aplicación y no con el
//     superusuario de las semillas, solo se ve contra Postgres.
//   · Las unitarias simulan la base, y los dos peores fallos de aislamiento de
//     este repo las pasaron sin despeinarse.
//   · Y el caso que da miedo en un reporte: el fallo de aislamiento NO DA
//     ERROR. Devuelve filas de más —o cero filas— y un reporte con el dinero de
//     otra empresa se lee perfectamente bien.
//
//  Las dos organizaciones tienen reservas EN EL MISMO PERIODO y por el MISMO
//  importe a propósito: si el aislamiento fallara, el total saldría al doble en
//  vez de con nombres raros, que es un síntoma que nadie notaría.
//
//  Se prueba además, contra la base real, la atribución CONSCIENTE DEL PERIODO
//  (el contrato que cuenta es el que solapa el rango, aunque hoy esté VENCIDO),
//  porque depende de columnas `date` que el driver de `pg` convierte a `Date`
//  local: es exactamente el tipo de cosa que una unitaria con datos de mentira
//  no puede sostener.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente
let ccom: Cliente

// La superficie de la estática que se siembra: 6 × 3 = 18 m² de UNA cara.
const ANCHO = 6
const ALTO = 3

interface Sembrado {
  sitioEstatico: string
  contratoVencido: string
}

// Siembra, para una organización, lo que el reporte necesita para tener filas:
// una pantalla ESTÁTICA con medidas (la de `sembrarTenant` es digital, y el
// reporte por m² la excluye a propósito), dos contratos en relevo —uno ya
// VENCIDO y otro VIGENTE—, una reserva y una orden de trabajo con duración real.
//
// Se inserta con el pool de pruebas (superusuario) y no por la API porque lo que
// se está probando es la LECTURA con RLS: montar el camino comercial completo
// metería media aplicación en el medio y el rojo dejaría de señalar el reporte.
async function sembrarDatosDeReporte(org: Awaited<ReturnType<typeof sembrarTenant>>): Promise<Sembrado> {
  const p = poolTest()
  const arr = await p.query('select id from arrendadores where tenant_id = $1 limit 1', [org.id])
  const arrendadorId = arr.rows[0].id as string

  // Pantalla SUELTA (sin predio): su contrato es íntegro suyo y no hay que
  // repartir la renta entre caras para saber qué esperar.
  const sitio = await p.query(
    `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, exhibicion,
                         es_rotativo, ancho, alto, caras, alcaldia, ciudad, tenant_id)
     values ($1,$2,$3,'VALLA','fijo',false,$4,$5,1,'Tlalpan','CDMX',$6)
     returning id`,
    [
      `Valla ${org.slug}`, `${org.slug.toUpperCase()}-EST-1`, `${org.slug.toUpperCase()}-PROV-EST-1`,
      ANCHO, ALTO, org.id,
    ],
  )
  const sitioId = sitio.rows[0].id as string

  // El contrato que YA VENCIÓ. Antes de este cambio el reporte de su periodo lo
  // ignoraba —`contratoActivo()` solo acepta VIGENTE/POR_VENCER/RENOVADO— y la
  // pantalla salía a costo cero en un trimestre que sí se pagó.
  const vencido = await p.query(
    `insert into contratos_arrendamiento
       (arrendador_id, sitio_id, fecha_inicio, fecha_fin, monto_renta, periodicidad, estatus, tenant_id)
     values ($1,$2,$3,$4,6000,'MENSUAL','VENCIDO',$5) returning id`,
    [arrendadorId, sitioId, enDias(-400), enDias(-200), org.id],
  )
  // Y el que gobierna hoy, con OTRA renta: si la atribución no fuera consciente
  // del periodo, esta sería la que se cobraría también hacia atrás.
  await p.query(
    `insert into contratos_arrendamiento
       (arrendador_id, sitio_id, fecha_inicio, fecha_fin, monto_renta, periodicidad, estatus, tenant_id)
     values ($1,$2,$3,$4,9000,'MENSUAL','VIGENTE',$5)`,
    [arrendadorId, sitioId, enDias(-199), enDias(365), org.id],
  )

  const campana = await p.query(
    `insert into campanas (nombre, cliente_id, fecha_inicio, fecha_fin, estado_comercial, tenant_id)
     values ($1,$2,$3,$4,'ACTIVA',$5) returning id`,
    [`Campana ${org.slug}`, org.clienteId, enDias(-20), enDias(-10), org.id],
  )
  // MISMO periodo y MISMO importe en las dos organizaciones: un total al doble
  // es el único síntoma que un fallo de aislamiento daría aquí.
  await p.query(
    `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, estatus, tenant_id)
     values ($1,$2,$3,$4,30000,'CONFIRMADA',$5)`,
    [campana.rows[0].id, sitioId, enDias(-20), enDias(-10), org.id],
  )

  // Una visita con duración REAL medida: dos horas.
  await p.query(
    `insert into ordenes_trabajo
       (tipo, sitio_id, descripcion, estatus, fecha_inicio, fecha_completada, tenant_id)
     values ('MANTENIMIENTO_CORRECTIVO',$1,'Reparacion de estructura','COMPLETADA',
             $2::date + time '09:00', $2::date + time '11:00', $3)`,
    [sitioId, enDias(-15), org.id],
  )

  return { sitioEstatico: sitioId, contratoVencido: vencido.rows[0].id }
}

let datosAlfa: Sembrado
let datosBeta: Sembrado

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('repalfa')
  beta = await sembrarTenant('repbeta')
  datosAlfa = await sembrarDatosDeReporte(alfa)
  datosBeta = await sembrarDatosDeReporte(beta)

  // Un usuario de la MISMA organización sin el módulo `finanzas`. Se pone aquí y
  // no en otra organización a propósito: así el 403 solo puede venir del rol, no
  // del tenant.
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ($1,$2,'COMERCIAL',$3,true,$4)`,
    ['Comercial Alfa', 'comercial@repalfa.test', await bcrypt.hash(PASSWORD_DEMO, 4), alfa.id],
  )

  await arrancarServidor()
  ca = new Cliente()
  cb = new Cliente()
  ccom = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cb.entrar(beta.usuarioEmail, PASSWORD_DEMO)
  await ccom.entrar('comercial@repalfa.test', PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

function ruta(params: Record<string, string>): string {
  return `/api/reportes/rentabilidad/?${new URLSearchParams(params)}`
}

async function reporte(c: Cliente, params: Record<string, string>) {
  const r = await c.pedir(ruta(params))
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
  return r.datos
}

// El rango que cubre la reserva y la OT de las dos organizaciones.
const AHORA = () => ({ desde: enDias(-30), hasta: enDias(0) })
// El rango del contrato que YA VENCIÓ.
const PASADO = () => ({ desde: enDias(-380), hasta: enDias(-350) })

describe('R2 · dos organizaciones con reservas en el mismo periodo', () => {
  it('el reporte por sitio de alfa no trae NI UNA fila de beta', async () => {
    const d = await reporte(ca, { ...AHORA(), dimension: 'sitio', granularidad: 'mes' })
    const claves = d.filas.map((f: any) => f.clave)
    expect(claves).toContain(datosAlfa.sitioEstatico)
    expect(claves).not.toContain(datosBeta.sitioEstatico)
    // Y ni un nombre de la otra: el id es lo que se compara, pero un reporte
    // filtrado a medias podría traer la etiqueta sin la clave.
    const texto = JSON.stringify(d)
    expect(texto).not.toContain('repbeta')
    expect(texto).not.toContain(beta.id)
  })

  it('y el de beta no trae ni una de alfa — el corte va en las dos direcciones', async () => {
    const d = await reporte(cb, { ...AHORA(), dimension: 'sitio', granularidad: 'mes' })
    const claves = d.filas.map((f: any) => f.clave)
    expect(claves).toContain(datosBeta.sitioEstatico)
    expect(claves).not.toContain(datosAlfa.sitioEstatico)
    expect(JSON.stringify(d)).not.toContain('repalfa')
  })

  // El síntoma que un fallo de aislamiento daría de verdad: no un error, un
  // total al doble. Las dos organizaciones tienen 30 000 en el mismo periodo.
  it('el total de ingreso es 30 000 y no 60 000', async () => {
    for (const c of [ca, cb]) {
      const d = await reporte(c, { ...AHORA(), dimension: 'sitio', granularidad: 'mes' })
      expect(d.totales.ingreso).toBe(30000)
    }
  })

  it('las CUATRO dimensiones aislan, no solo la que ya existia', async () => {
    for (const dimension of ['sitio', 'trimestre', 'operacion', 'm2']) {
      const d = await reporte(ca, { ...AHORA(), dimension, granularidad: 'trimestre' })
      expect(d.dimension, dimension).toBe(dimension)
      const texto = JSON.stringify(d)
      expect(texto, dimension).not.toContain('repbeta')
      expect(texto, dimension).not.toContain(datosBeta.sitioEstatico)
      expect(texto, dimension).not.toContain(beta.id)
    }
  })

  it('la dimension trimestre de alfa suma SOLO el dinero de alfa', async () => {
    const d = await reporte(ca, { ...AHORA(), dimension: 'trimestre', granularidad: 'mes' })
    expect(d.totales.ingreso).toBe(30000)
    expect(d.filas.length).toBeGreaterThan(0)
  })

  it('la dimension operacion cuenta UNA visita, la suya', async () => {
    const d = await reporte(ca, { ...AHORA(), dimension: 'operacion', granularidad: 'trimestre' })
    const fila = d.filas.find((f: any) => f.clave === datosAlfa.sitioEstatico)
    expect(fila, JSON.stringify(d.filas)).toBeTruthy()
    expect(fila.visitas).toBe(1)
    expect(fila.visitasPorTipo).toEqual({ MANTENIMIENTO_CORRECTIVO: 1 })
    // Dos horas, medidas con las dos marcas de tiempo reales de la OT.
    expect(fila.horasEnSitio).toBe(2)
    expect(d.totales.costoOperacion).toBe(1500)
  })

  it('la dimension m2 trae la estatica con sus 18 m2 y excluye la digital', async () => {
    const d = await reporte(ca, { ...AHORA(), dimension: 'm2', granularidad: 'trimestre' })
    const fila = d.filas.find((f: any) => f.clave === datosAlfa.sitioEstatico)
    expect(fila, JSON.stringify(d)).toBeTruthy()
    // La estática se siembra con `caras = 1`, así que su superficie es la misma
    // con las dos convenciones: `6 × 3 × 1`. Lo que sí cambió el 2026-09-18, por
    // decisión del dueño, es la convención que el reporte DECLARA — ahora suma
    // todas las caras de cada pantalla (`MULTIPLICAR_M2_POR_CARAS`).
    expect(fila.m2).toBe(ANCHO * ALTO)
    expect(d.convencionM2).toBe('todas-las-caras')
    // La pantalla que siembra `sembrarTenant` es PANTALLA_DIGITAL y tiene
    // contrato vigente por su predio, así que tiene movimiento en el rango: es
    // una exclusión de verdad y el reporte lo dice.
    expect(d.excluidas.digitales).toBeGreaterThanOrEqual(1)
    expect(d.filas.map((f: any) => f.clave)).not.toContain(alfa.sitioId)
  })
})

describe('la atribucion del costo es del PERIODO, contra la base real', () => {
  // El defecto que hacía deshonesto cualquier reporte de un periodo pasado. Aquí
  // el contrato de ese periodo está VENCIDO en la base de verdad, con columnas
  // `date` de Postgres y no con cadenas de una unitaria.
  it('un rango pasado cobra la renta del contrato que ya vencio', async () => {
    const d = await reporte(ca, { ...PASADO(), dimension: 'sitio', granularidad: 'mes' })
    const fila = d.filas.find((f: any) => f.clave === datosAlfa.sitioEstatico)
    expect(fila, `el contrato VENCIDO no se cobro: ${JSON.stringify(d)}`).toBeTruthy()
    expect(fila.costoEspacio).toBeGreaterThan(0)
    expect(fila.tieneContrato).toBe(true)
    // Sin ingreso en ese rango, el margen es todo negativo y sin porcentaje.
    expect(fila.margen).toBeLessThan(0)
    expect(fila.margenPct).toBeNull()
  })

  it('y ese rango sigue aislado: ni una fila de beta', async () => {
    const d = await reporte(ca, { ...PASADO(), dimension: 'sitio', granularidad: 'mes' })
    expect(JSON.stringify(d)).not.toContain(datosBeta.sitioEstatico)
  })

  it('un rango anterior a todos los contratos da cero filas, no un error', async () => {
    const d = await reporte(ca, { desde: enDias(-900), hasta: enDias(-880), dimension: 'sitio', granularidad: 'mes' })
    expect(d.filas).toEqual([])
    expect(d.totales.ingreso).toBe(0)
  })
})

describe('NEGATIVOS del endpoint — el guard y la validacion', () => {
  // Un reporte de rentabilidad es DINERO: enseña lo que se cobra por cada
  // pantalla y lo que se le paga a cada arrendador. Un rol sin `finanzas` no lo
  // ve, y da igual qué dimensión pida.
  it('un rol sin finanzas recibe 403 en las cuatro dimensiones', async () => {
    for (const dimension of ['sitio', 'trimestre', 'operacion', 'm2']) {
      const r = await ccom.pedir(ruta({ ...AHORA(), dimension, granularidad: 'mes' }))
      expect(r.status, `${dimension}: ${JSON.stringify(r.datos)}`).toBe(403)
      // Y no se filtra ni un dato por el mensaje de error.
      expect(JSON.stringify(r.datos)).not.toContain(datosAlfa.sitioEstatico)
    }
  })

  it('sin sesion es 401, no 200 con un reporte vacio', async () => {
    const r = await new Cliente().pedir(ruta({ ...AHORA(), dimension: 'sitio', granularidad: 'mes' }))
    expect(r.status).toBe(401)
  })

  it('una dimension fuera del enum es 400', async () => {
    const r = await ca.pedir(ruta({ ...AHORA(), dimension: 'arrendador', granularidad: 'mes' }))
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
  })

  it('un group by inyectado por la dimension es 400, no 500', async () => {
    const r = await ca.pedir(ruta({
      ...AHORA(), dimension: 'sitio; drop table reservas--', granularidad: 'mes',
    }))
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    // Y la tabla sigue ahí, que es lo que de verdad se está comprobando.
    const n = await poolTest().query('select count(*)::int n from reservas')
    expect(n.rows[0].n).toBeGreaterThan(0)
  })

  it('un rango invertido es 400 y un parametro de mas tambien', async () => {
    const invertido = await ca.pedir(ruta({
      desde: enDias(0), hasta: enDias(-30), dimension: 'sitio', granularidad: 'mes',
    }))
    expect(invertido.status).toBe(400)
    const sobra = await ca.pedir(ruta({
      ...AHORA(), dimension: 'sitio', granularidad: 'mes', tenantId: beta.id,
    }))
    expect(sobra.status, 'un tenantId por parametro tiene que morir en la validacion').toBe(400)
  })
})

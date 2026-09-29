import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  OT-COSTO-01 · el costo REAL de una orden de trabajo, contra Postgres real.
// ----------------------------------------------------------------------------
//  Lo que estas pruebas miden y las unitarias NO pueden:
//
//   1. **Que la columna existe y el runner la creó.** El motor de reportes se
//      prueba con objetos en memoria: un `costo_real` que nunca llegara a la
//      tabla daría las unitarias en verde y el reporte en blanco.
//   2. **El AISLAMIENTO.** El costo de una visita es dinero que baja el margen.
//      Si una organización pudiera escribir el costo de la OT de otra, el
//      síntoma sería el margen ajeno cambiado, sin un solo error en ningún log.
//      Las unitarias simulan la base y no ven la RLS — este repositorio ya pagó
//      dos veces esa lección.
//   3. **Que el CHECK de la base muerde.** Un costo negativo SUBE el margen,
//      porque entra restando. El zod lo para en la ruta; esto comprueba que la
//      tabla lo pararía igual si alguien entrara por otro lado.
//   4. **Que el reporte de verdad lo usa**, de punta a punta: capturar un costo
//      y ver cambiar el `costoOperacion` y el aviso de cobertura del reporte.
//
//  Las dos organizaciones usan LA MISMA cifra a propósito: con importes
//  distintos, un fallo de aislamiento saldría como un número que no reconozco
//  —algo que se nota al leer—. Con el mismo, sale como un costo AL DOBLE, que
//  es indistinguible de haber trabajado el doble. Mismo criterio que
//  `energia-consumos.e2e.test.ts`.
// ============================================================================

let orgA: Awaited<ReturnType<typeof sembrarTenant>>
let orgB: Awaited<ReturnType<typeof sembrarTenant>>
let a: Cliente
let b: Cliente
// El rol de ejemplo SIN `operaciones`. Era COMERCIAL hasta el 2026-09-29; el
// ADR 0040 lo retiro de uso --se quedo sin ni una fila de `rol_permisos`-- asi
// que seguir usandolo aqui daria el 403 correcto por el motivo equivocado: no
// por faltarle `operaciones`, sino por no tener NADA. VENDEDOR es el rol que
// hoy hace ese trabajo y tiene permisos de sobra en lo suyo.
let vendedor: Cliente
// FINANZAS: el rol del encargo del 29/09. Recibe la factura de la cuadrilla, y
// desde hoy puede capturar el costo con `operaciones.costear`.
let finanzas: Cliente
let otA: string
let otB: string

// El costo capturado, y el respaldo por tipo al que sustituye. 1500 es
// `COSTOS_OT_RESPALDO`, y 12000 se eligió BIEN distinto: si el reporte siguiera
// usando la estimación, la diferencia sería imposible de confundir con un
// redondeo.
const COSTO_REAL = 12000
const ESTIMACION = 1500

// Un rango que contiene a la OT. Se usa `creado_en` (hoy) como fecha de la OT,
// así que el rango es el mes en curso completo — `fechaDeOt` cae en él.
function mesEnCurso(): { desde: string; hasta: string } {
  const h = new Date()
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return {
    desde: iso(new Date(h.getFullYear(), h.getMonth(), 1)),
    hasta: iso(new Date(h.getFullYear(), h.getMonth() + 1, 0)),
  }
}
const MES = mesEnCurso()

/** Crea una OT directamente en la tabla, con su sitio y fecha dentro del rango. */
async function sembrarOT(org: Awaited<ReturnType<typeof sembrarTenant>>): Promise<string> {
  const { rows } = await poolTest().query(
    `insert into ordenes_trabajo (folio, tipo, sitio_id, descripcion, fecha_programada, estatus, tenant_id)
     values ($1,'HERRERIA',$2,'Herreria de prueba', now(), 'PENDIENTE', $3)
     returning id`,
    [`OT-COSTO-${org.id.slice(0, 8)}`, org.sitioId, org.id],
  )
  return rows[0].id as string
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  orgA = await sembrarTenant('otca')
  orgB = await sembrarTenant('otcb')
  otA = await sembrarOT(orgA)
  otB = await sembrarOT(orgB)

  // Un usuario de la MISMA organización SIN el módulo `operaciones`. En la
  // misma a propósito: así el 403 solo puede venir del rol y no del tenant, que
  // serían dos causas distintas dando el mismo número.
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ($1,$2,'VENDEDOR',$3,true,$4)`,
    ['Vendedor OT', 'vendedor@otca.test', await bcrypt.hash(PASSWORD_DEMO, 4), orgA.id],
  )
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ($1,$2,'FINANZAS',$3,true,$4)`,
    ['Finanzas OT', 'finanzas@otca.test', await bcrypt.hash(PASSWORD_DEMO, 4), orgA.id],
  )

  await arrancarServidor()
  a = new Cliente()
  b = new Cliente()
  vendedor = new Cliente()
  finanzas = new Cliente()
  await a.entrar(orgA.usuarioEmail, PASSWORD_DEMO)
  await b.entrar(orgB.usuarioEmail, PASSWORD_DEMO)
  await vendedor.entrar('vendedor@otca.test', PASSWORD_DEMO)
  await finanzas.entrar('finanzas@otca.test', PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

const fijarCosto = (cli: Cliente, id: string, costoReal: unknown) =>
  cli.pedir(`/api/ot/${id}/costo/`, { metodo: 'PATCH', cuerpo: { costoReal } })

// El candado de cambios está ENCENDIDO en el entorno de integración, así que
// una sesión recién abierta NO puede tocar dinero hasta desbloquearla. Vale 15
// minutos (`DESBLOQUEO_MINUTOS`), de sobra para una corrida.
async function desbloquear(cl: Cliente): Promise<void> {
  const r = await cl.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
  if (r.status !== 200) throw new Error(`no se pudo desbloquear: ${JSON.stringify(r.datos)}`)
}

const reporteOperacion = (cli: Cliente) =>
  cli.pedir(
    `/api/reportes/rentabilidad/?${new URLSearchParams({
      desde: MES.desde,
      hasta: MES.hasta,
      dimension: 'operacion',
      granularidad: 'mes',
    })}`,
  )

// ─── 1 · antes de capturar nada: la ESTIMACIÓN, y el reporte lo dice ────────
describe('1 · sin costo capturado el reporte usa la estimación, y lo declara', () => {
  it('el costo de operación es el del TIPO, no cero', async () => {
    const r = await reporteOperacion(a)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.totales.costoOperacion).toBe(ESTIMACION)
  })

  it('el aviso de cobertura cuenta esa visita como ESTIMADA', async () => {
    const c = (await reporteOperacion(a)).datos.costosReales
    expect(c.visitasConEstimacion).toBe(1)
    expect(c.visitasConCostoReal).toBe(0)
    expect(c.costoEstimado).toBe(ESTIMACION)
    expect(c.nota).toContain('estimación')
  })
})

// ─── 2 · EL CANDADO DE DINERO, antes de nada ────────────────────────────────
//
// Va aquí arriba y no entre los negativos del final porque es lo que separa
// esta ruta de `POST /api/ot` y de `cerrar`: capturar un costo es un cambio
// SENSIBLE y una sesión recién abierta no puede hacerlo, aunque su rol sí tenga
// `operaciones.crear`. Sin esta prueba, retirar `exigirCambioSensible` de la
// ruta y dejar `exigir` a secas dejaría todo lo demás en verde.
describe('2 · NEGATIVO · el candado de dinero muerde antes que nada', () => {
  it('con la sesión BLOQUEADA, capturar el costo da 403 y pide la contraseña', async () => {
    const r = await fijarCosto(a, otA, COSTO_REAL)
    expect(r.status).toBe(403)
    expect(r.datos.requiereDesbloqueo).toBe(true)
  })

  it('y NO escribió nada: la OT sigue sin costo capturado', async () => {
    // Un 403 con la escritura ya hecha daría el mismo número en la respuesta.
    const { rows } = await poolTest().query(
      'select costo_real from ordenes_trabajo where id = $1',
      [otA],
    )
    expect(rows[0].costo_real).toBeNull()
  })
})

// ─── 3 · capturar el costo: SUSTITUYE, y el reporte cambia ──────────────────
describe('3 · el costo capturado sustituye la estimación de punta a punta', () => {
  beforeAll(async () => {
    await desbloquear(a)
    await desbloquear(b)
  })

  it('la ruta lo guarda y la columna de la base lo tiene', async () => {
    const r = await fijarCosto(a, otA, COSTO_REAL)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.costoReal).toBe(COSTO_REAL)

    const { rows } = await poolTest().query(
      'select costo_real from ordenes_trabajo where id = $1',
      [otA],
    )
    expect(Number(rows[0].costo_real)).toBe(COSTO_REAL)
  })

  it('el reporte pasa a usar ESE importe, no la suma de los dos', async () => {
    // El caso que separa «sustituye» de «suma»: sumando daría 13 500.
    const r = await reporteOperacion(a)
    expect(r.datos.totales.costoOperacion).toBe(COSTO_REAL)
  })

  it('y el aviso de cobertura pasa a contarla como REAL', async () => {
    const c = (await reporteOperacion(a)).datos.costosReales
    expect(c.visitasConCostoReal).toBe(1)
    expect(c.visitasConEstimacion).toBe(0)
    expect(c.costoRealCapturado).toBe(COSTO_REAL)
    expect(c.costoEstimado).toBe(0)
  })

  it('CERO se guarda como cero y el costo de operación baja a cero', async () => {
    // El caso que un `costoReal || estimacion` rompería en silencio, cobrando
    // 1 500 por una visita que costó nada.
    const r = await fijarCosto(a, otA, 0)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect((await reporteOperacion(a)).datos.totales.costoOperacion).toBe(0)
  })

  it('BORRARLO con `null` devuelve la visita a la estimación', async () => {
    const r = await fijarCosto(a, otA, null)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.costoReal).toBeNull()
    const rep = await reporteOperacion(a)
    expect(rep.datos.totales.costoOperacion).toBe(ESTIMACION)
    expect(rep.datos.costosReales.visitasConEstimacion).toBe(1)
  })
})

// ─── 4 · AISLAMIENTO: el costo de la OT de otra organización ────────────────
describe('4 · NEGATIVO · no se puede tocar el costo de la OT de otra organización', () => {
  it('la organización A no puede fijar el costo de la OT de B', async () => {
    const r = await fijarCosto(a, otB, 99999)
    // 404 y no 403: desde dentro de A esa OT NO EXISTE. Un 403 confirmaría que
    // existe, que ya es una filtración — el mismo criterio que el resto del repo.
    expect(r.status).toBe(404)
  })

  it('y la OT de B sigue SIN costo capturado', async () => {
    // La comprobación que de verdad cierra el caso: un 404 con la escritura ya
    // hecha daría exactamente el mismo número.
    const { rows } = await poolTest().query(
      'select costo_real from ordenes_trabajo where id = $1',
      [otB],
    )
    expect(rows[0].costo_real).toBeNull()
  })

  it('el costo de A no aparece en el reporte de B', async () => {
    await fijarCosto(a, otA, COSTO_REAL)
    const rep = await reporteOperacion(b)
    // B tiene UNA visita y ninguna capturada: su costo es la estimación. Si
    // viera la de A, saldría 13 500 o 12 000.
    expect(rep.datos.totales.costoOperacion).toBe(ESTIMACION)
    expect(rep.datos.costosReales.visitasConCostoReal).toBe(0)
  })
})

// ─── 5 · NEGATIVOS del guard y de la base ───────────────────────────────────
describe('5 · NEGATIVO · lo que la ruta y la tabla rechazan', () => {
  it('un costo NEGATIVO se rechaza con 400', async () => {
    const r = await fijarCosto(a, otA, -500)
    expect(r.status).toBe(400)
  })

  it('el CHECK de la base lo rechaza también por debajo de la ruta', async () => {
    // Si el zod se retirara algún día, esto seguiría parando el negativo. Es la
    // segunda capa, y se comprueba que existe de verdad y no solo en el archivo.
    await expect(
      poolTest().query('update ordenes_trabajo set costo_real = -1 where id = $1', [otA]),
    ).rejects.toThrow(/costo_real_no_negativo/)
  })

  it('un texto se rechaza, no se convierte en número', async () => {
    const r = await fijarCosto(a, otA, '12000')
    expect(r.status).toBe(400)
  })

  it('un rol SIN `operaciones` no puede capturar el costo (403)', async () => {
    const r = await fijarCosto(vendedor, otA, 500)
    expect(r.status).toBe(403)
  })

  it('FINANZAS SI puede capturar el costo — es quien recibe la factura', async () => {
    // El encargo del 2026-09-29. Hasta hoy FINANZAS tenia CUATRO filas y ni una
    // de `operaciones`, asi que esta ruta le contestaba 403 a quien de verdad
    // sabe lo que costo la visita.
    await desbloquear(finanzas)
    const r = await fijarCosto(finanzas, otA, 7777)
    expect(r.status).toBe(200)
    expect(Number(r.datos?.costoReal)).toBe(7777)
    // Se deja como estaba: las pruebas del reporte cuentan con COSTO_REAL.
    await fijarCosto(a, otA, COSTO_REAL)
  })

  it('pero FINANZAS NO puede crear ni cerrar una orden de trabajo', async () => {
    // La razon entera por la que `costear` existe en vez de darles
    // `operaciones.crear`. Si esto devolviera 200, el atajo se habria colado y
    // Finanzas estaria cerrando ordenes de campo.
    const crear = await finanzas.pedir('/api/ot/', {
      cuerpo: { tipo: 'HERRERIA', sitioId: orgA.sitioId, descripcion: 'No deberia' },
    })
    expect(crear.status).toBe(403)
    const cerrar = await finanzas.pedir(`/api/ot/${otA}/cerrar/`, { cuerpo: {} })
    expect(cerrar.status).toBe(403)
  })

  it('y tampoco puede capturar el costo de la OT de OTRA organizacion', async () => {
    // El permiso nuevo no toca el aislamiento, y eso hay que medirlo: un rol
    // nuevo en una ruta de dinero es justo donde se cuela un IDOR.
    const r = await fijarCosto(finanzas, otB, 999)
    expect(r.status).toBe(404)
  })

  it('sin sesión no se puede capturar el costo (401)', async () => {
    const anon = new Cliente()
    const r = await fijarCosto(anon, otA, 500)
    expect(r.status).toBe(401)
  })
})

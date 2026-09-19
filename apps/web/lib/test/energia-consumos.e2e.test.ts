import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest, poolApp, comoTenant } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  El consumo de luz contra Postgres real y con el rol de la aplicación.
// ----------------------------------------------------------------------------
//  Las tres pruebas que `vault/02-Backend/energia-consumos.md` dejó sin
//  escribir el 2026-09-18 porque el puerto 3311 y `spaces_e2e` los tenía otro
//  agente: el aislamiento del consumo entre organizaciones, los negativos del
//  guard (403 sin `operaciones`, 401 sin sesión) y el 409 del recibo duplicado
//  contra el índice único de verdad.
//
//  ─── Por qué las dos organizaciones capturan EL MISMO IMPORTE ─────────────
//  Es el encargo, y es lo que separa esta prueba de una que no mide nada. Con
//  importes distintos, un fallo de aislamiento saldría como una lista de
//  nombres que no son los míos — algo que alguien nota al leerlo. Con el MISMO
//  periodo y el MISMO importe sale como un total AL DOBLE: el costo de la luz
//  de la otra empresa sumado al mío, un margen peor de lo que es, y ni un error
//  en ningún log. Una prueba que solo comparara nombres no caza ese fallo.
//
//  ─── Y la regla que decide si esto vale algo ──────────────────────────────
//  Todo lo que comprueba aislamiento va por `comoTenant()`, que usa
//  `poolApp()`: el rol `spaces_app` es NOSUPERUSER y NOBYPASSRLS. Con el pool
//  de administración (`spaces` es superusuario) la RLS no se aplica aunque la
//  tabla tenga FORCE, y la prueba pasaría POR CASUALIDAD. `poolTest()` se usa
//  solo para montar el escenario y para MIRAR las dos organizaciones a la vez,
//  que es precisamente lo que la RLS impide hacer desde dentro.
// ============================================================================

let orgA: Awaited<ReturnType<typeof sembrarTenant>>
let orgB: Awaited<ReturnType<typeof sembrarTenant>>
let predioA: string
let predioB: string
let a: Cliente
let b: Cliente
let comercial: Cliente

// El MISMO periodo y el MISMO importe en las dos organizaciones. Ver la
// cabecera: un total al doble es el único síntoma que un fallo daría aquí.
const IMPORTE = 3100
const KWH = 1550

// El mes ANTERIOR completo. Dos motivos, los dos medidos:
//  · el controller rechaza un recibo del mes en curso («ese mes todavía no ha
//    terminado»), que es la defensa contra el año mal tecleado;
//  · con el rango cubriendo el mes ENTERO, la fracción temporal del reparto es
//    exactamente 1 y el total esperado es el importe del recibo sin redondeos.
//    Así un `toBe(3100)` afirma el aislamiento y no la aritmética del prorrateo.
function mesAnterior(): { periodo: string; desde: string; hasta: string } {
  const h = new Date()
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const ini = new Date(h.getFullYear(), h.getMonth() - 1, 1)
  const fin = new Date(h.getFullYear(), h.getMonth(), 0)
  return { periodo: iso(ini), desde: iso(ini), hasta: iso(fin) }
}

const MES = mesAnterior()

async function predioDe(org: Awaited<ReturnType<typeof sembrarTenant>>): Promise<string> {
  const { rows } = await poolTest().query('select predio_id from sitios where id = $1', [
    org.sitioId,
  ])
  return rows[0].predio_id as string
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  orgA = await sembrarTenant('luza')
  orgB = await sembrarTenant('luzb')
  predioA = await predioDe(orgA)
  predioB = await predioDe(orgB)

  // Un usuario de la MISMA organización sin el módulo `operaciones`. Va en la
  // misma organización a propósito: así el 403 solo puede venir del rol y no
  // del tenant, que serían dos cosas distintas dando el mismo número.
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ($1,$2,'COMERCIAL',$3,true,$4)`,
    ['Comercial Luz', 'comercial@luza.test', await bcrypt.hash(PASSWORD_DEMO, 4), orgA.id],
  )

  await arrancarServidor()
  a = new Cliente()
  b = new Cliente()
  comercial = new Cliente()
  await a.entrar(orgA.usuarioEmail, PASSWORD_DEMO)
  await b.entrar(orgB.usuarioEmail, PASSWORD_DEMO)
  await comercial.entrar('comercial@luza.test', PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

const capturar = (cli: Cliente, cuerpo: Record<string, unknown>) =>
  cli.pedir('/api/energia/consumos/', { cuerpo })

const reporteLuz = (cli: Cliente) =>
  cli.pedir(
    `/api/reportes/rentabilidad/?${new URLSearchParams({
      desde: MES.desde,
      hasta: MES.hasta,
      dimension: 'luz',
      granularidad: 'mes',
    })}`,
  )

const tablero = (cli: Cliente) =>
  cli.pedir(
    `/api/energia/consumos/?${new URLSearchParams({ desde: MES.desde, hasta: MES.hasta })}`,
  )

let reciboA: string
let reciboB: string

// ─── 1 · el escenario: el MISMO recibo en las dos organizaciones ───────────
describe('1 · las dos organizaciones capturan el mismo recibo', () => {
  it('cada una lo captura con 201 y la fila nace con SU tenant', async () => {
    const rA = await capturar(a, {
      predioId: predioA,
      periodo: MES.periodo.slice(0, 7),
      medidor: 'RPU-0001',
      kwh: KWH,
      importe: IMPORTE,
    })
    expect(rA.status, JSON.stringify(rA.datos)).toBe(201)
    reciboA = rA.datos.id

    // MISMO periodo, MISMO medidor, MISMO importe. Que la segunda organización
    // pueda capturarlo es parte del contrato: el índice único lleva
    // `tenant_id` dentro, así que el recibo de otro owner no me bloquea.
    const rB = await capturar(b, {
      predioId: predioB,
      periodo: MES.periodo.slice(0, 7),
      medidor: 'RPU-0001',
      kwh: KWH,
      importe: IMPORTE,
    })
    expect(rB.status, JSON.stringify(rB.datos)).toBe(201)
    reciboB = rB.datos.id

    const { rows } = await poolTest().query(
      'select id, tenant_id, to_char(periodo, $2) as periodo from consumos_energia where id = any($1::uuid[])',
      [[reciboA, reciboB], 'YYYY-MM-DD'],
    )
    const porId = new Map(rows.map((r: any) => [r.id, r]))
    expect(porId.get(reciboA).tenant_id).toBe(orgA.id)
    expect(porId.get(reciboB).tenant_id).toBe(orgB.id)
    // El periodo se normaliza al día 1, que es lo que exige el CHECK de la base.
    expect(porId.get(reciboA).periodo).toBe(MES.periodo)
  })

  it('el `tenantId` del cuerpo no elige la organización de destino', async () => {
    // El schema es `.strict()`, así que un `tenantId` de más muere en la
    // validación en vez de ignorarse en silencio. Ignorarlo también sería
    // correcto; lo que no puede es OBEDECERLO.
    const r = await capturar(a, {
      predioId: predioA,
      periodo: MES.periodo.slice(0, 7),
      medidor: 'INTENTO',
      kwh: 1,
      importe: 1,
      tenantId: orgB.id,
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    const n = await poolTest().query(
      'select count(*)::int n from consumos_energia where tenant_id = $1',
      [orgB.id],
    )
    expect(n.rows[0].n).toBe(1)
  })
})

// ─── 2 · EL CORAZON: el consumo de una organización no suma en la otra ─────
describe('2 · aislamiento del consumo — el síntoma sería un total AL DOBLE', () => {
  it('el reporte de luz de A carga 3100, no 6200', async () => {
    const r = await reporteLuz(a)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.totales.costoEnergia).toBe(IMPORTE)
    const fila = r.datos.filas.find((f: any) => f.clave === orgA.sitioId)
    expect(fila, JSON.stringify(r.datos.filas)).toBeTruthy()
    expect(fila.costoEnergia).toBe(IMPORTE)
    expect(fila.kwh).toBe(KWH)

    // Y LA COBERTURA, que es donde un recibo ajeno se delata aunque el total no
    // se mueva. Se añadió DESPUÉS de una mutación que lo enseñó: quitando el
    // `and tenant_id` de la consulta de `reportes-repo.ts`, el total siguió
    // dando 3 100 — porque el recibo de B cuelga de un predio que no es de A y
    // el reparto por caras no tiene a quién dárselo. Lo que sí cambia es esto:
    // ese importe pasa a contarse como «sin destino». Sin estas tres líneas, la
    // prueba de arriba no habría cazado esa mutación.
    expect(r.datos.cobertura.recibosSinDestino).toBe(0)
    expect(r.datos.cobertura.importeSinDestino).toBe(0)
    expect(r.datos.cobertura.faltantes).toBe(0)
  })

  it('y el de B también carga 3100 — el corte va en las dos direcciones', async () => {
    const r = await reporteLuz(b)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.totales.costoEnergia).toBe(IMPORTE)
  })

  it('ni una clave de la otra organización aparece en el reporte', async () => {
    const r = await reporteLuz(a)
    const texto = JSON.stringify(r.datos)
    expect(texto).not.toContain(orgB.id)
    expect(texto).not.toContain(orgB.sitioId)
    expect(texto).not.toContain(predioB)
    expect(texto).not.toContain('luzb')
  })

  it('la energía entra en el costoTotal y en el margen, también aislada', async () => {
    // `costoEnergia` es la CUARTA fuente de costo, no una columna decorativa:
    // si `sitio` no la contara, `sitio` y `luz` darían dos márgenes distintos
    // para la misma pantalla. Y si no aislara, el margen de A pagaría la luz
    // de B.
    const r = await a.pedir(
      `/api/reportes/rentabilidad/?${new URLSearchParams({
        desde: MES.desde, hasta: MES.hasta, dimension: 'sitio', granularidad: 'mes',
      })}`,
    )
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.totales.costoEnergia).toBe(IMPORTE)
    const t = r.datos.totales
    // Redondeado a CENTAVOS en los dos lados, y no `toBe` sobre la suma cruda.
    //
    // El servidor devuelve `costoTotal = centavos(espacio + operacion + luz)`
    // (`lib/data/reportes.ts`, `totalesDeFilas`), porque un total de dinero se
    // redondea; la suma en coma flotante de los tres, en cambio, arrastra su
    // residuo. Con los importes que siembra esta prueba son
    // **10 841.94 contra 10 841.939999999999**, y `toBe` usa `Object.is`: la
    // prueba fallaba por el residuo del binario, no porque la luz se quedara
    // fuera del total.
    //
    // Lo que esta prueba tiene que demostrar es que la energia ESTA DENTRO del
    // costo total —que no es una columna decorativa—, y eso se demuestra igual
    // comparando dinero con dinero al centavo. Un guard que falla por el
    // ultimo bit de un `double` no protege nada y ensucia el rojo de los que si.
    const centavos = (v: number) => Math.round(v * 100) / 100
    expect(t.costoTotal).toBe(centavos(t.costoEspacio + t.costoOperacion + t.costoEnergia))
    // Y que de verdad la lleva dentro: sin la luz, el total seria menor.
    expect(t.costoTotal).toBeGreaterThan(centavos(t.costoEspacio + t.costoOperacion))
  })

  it('la rejilla de captura de A no enseña el recibo ni el predio de B', async () => {
    const r = await tablero(a)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const texto = JSON.stringify(r.datos)
    expect(texto).not.toContain(reciboB)
    expect(texto).not.toContain(predioB)
    // Y sí el suyo: sin el control positivo, un «no contiene» no distingue
    // «aislado» de «la consulta no devolvió nada».
    expect(texto).toContain(reciboA)
    expect(r.datos.puntos.map((p: any) => p.clave)).toEqual([`P:${predioA}`])
  })

  it('PRUEBA NEGATIVA CLAVE · filtrar SOLO por id no alcanza el recibo de B', async () => {
    // Escrita a propósito sin `and tenant_id`: es la consulta que escribiría
    // quien creyera que el uuid ya aísla. Va por `poolApp()` dentro de
    // `comoTenant`, nunca por el superusuario.
    const desdeA = await comoTenant(orgA.id, (q) =>
      q('select id, importe from consumos_energia where id = $1', [reciboB]),
    )
    expect(desdeA).toEqual([])
    const desdeB = await comoTenant(orgB.id, (q) =>
      q('select id from consumos_energia where id = $1', [reciboB]),
    )
    expect(desdeB).toHaveLength(1)
  })

  it('PRUEBA NEGATIVA CLAVE · ni sumando por periodo, que es como lo lee el reporte', async () => {
    // La consulta del motor, pero sin su `and tenant_id`. Es el modo de fallo
    // real: no un error, una SUMA al doble.
    const total = await comoTenant(orgA.id, (q) =>
      q(`select coalesce(sum(importe),0)::float8 as t from consumos_energia where periodo = $1::date`, [
        MES.periodo,
      ]),
    )
    expect(Number(total[0].t)).toBe(IMPORTE)
  })

  it('sin contexto de tenant, la tabla CON DATOS devuelve cero filas', async () => {
    const hay = await poolTest().query('select count(*)::int n from consumos_energia')
    expect(hay.rows[0].n).toBeGreaterThanOrEqual(2)
    const sinTenant = await poolApp().query('select count(*)::int n from consumos_energia')
    expect(sinTenant.rows[0].n).toBe(0)
  })

  it('y no se puede ESCRIBIR un recibo en la organización de otro', async () => {
    // El `with check` de la política. Sin él, una organización podría insertar
    // filas con el `tenant_id` de otra y no verlas nunca — pero el reporte de
    // la otra sí, con el costo de una luz que no es suya.
    await expect(
      comoTenant(orgA.id, (q) =>
        q(
          `insert into consumos_energia (tenant_id, predio_id, periodo, kwh, importe)
           values ($1, $2, $3::date, 1, 1)`,
          [orgB.id, predioB, MES.periodo],
        ),
      ),
    ).rejects.toThrow()
  })

  it('borrar el recibo de B desde la sesión de A da 404 y NO lo borra', async () => {
    // Un `ok` silencioso aquí sería lo peor de los dos mundos: quien lo pidió
    // creería que borró algo y el recibo seguiría inflando el costo del otro.
    const r = await a.pedir(`/api/energia/consumos/${reciboB}/`, { metodo: 'DELETE' })
    expect(r.status, JSON.stringify(r.datos)).toBe(404)
    const n = await poolTest().query('select count(*)::int n from consumos_energia where id = $1', [
      reciboB,
    ])
    expect(n.rows[0].n).toBe(1)
  })
})

// ─── 3 · el guard: quién teclea el recibo ──────────────────────────────────
describe('3 · la captura la hace operaciones, y el servidor lo cumple', () => {
  const CUERPO = () => ({
    predioId: predioA,
    periodo: MES.periodo.slice(0, 7),
    medidor: 'NO-DEBERIA-ENTRAR',
    kwh: 10,
    importe: 10,
  })

  it('un rol sin `operaciones` recibe 403 al capturar, y no escribe nada', async () => {
    const antes = await poolTest().query(
      'select count(*)::int n from consumos_energia where tenant_id = $1',
      [orgA.id],
    )
    const r = await capturar(comercial, CUERPO())
    expect(r.status, JSON.stringify(r.datos)).toBe(403)
    const despues = await poolTest().query(
      'select count(*)::int n from consumos_energia where tenant_id = $1',
      [orgA.id],
    )
    expect(despues.rows[0].n).toBe(antes.rows[0].n)
  })

  it('y tampoco puede LEER la rejilla', async () => {
    const r = await tablero(comercial)
    expect(r.status, JSON.stringify(r.datos)).toBe(403)
    expect(JSON.stringify(r.datos)).not.toContain(reciboA)
  })

  it('sin sesión es 401, no 201 ni 403', async () => {
    // El 401 y el 403 son respuestas distintas a preguntas distintas: «no sé
    // quién eres» y «sé quién eres y no puedes». Confundirlos manda al usuario
    // a la pantalla equivocada.
    const anonimo = new Cliente()
    expect((await capturar(anonimo, CUERPO())).status).toBe(401)
    expect((await tablero(anonimo)).status).toBe(401)
  })

  it('borrar pide `aprobar`, que el Dueño tiene y el comercial no', async () => {
    const r = await comercial.pedir(`/api/energia/consumos/${reciboA}/`, { metodo: 'DELETE' })
    expect(r.status, JSON.stringify(r.datos)).toBe(403)
    const n = await poolTest().query('select count(*)::int n from consumos_energia where id = $1', [
      reciboA,
    ])
    expect(n.rows[0].n).toBe(1)
  })
})

// ─── 4 · el duplicado, contra el índice único de verdad ────────────────────
describe('4 · el mismo recibo capturado dos veces es 409, no una fila más', () => {
  it('mismo predio, mismo mes y mismo medidor → 409 y sigue habiendo UNA fila', async () => {
    // Es el negativo más caro de la tabla: un recibo capturado dos veces
    // DUPLICA el costo de la luz de ese mes y no da ningún error — da un margen
    // peor de lo que es.
    const r = await capturar(a, {
      predioId: predioA,
      periodo: MES.periodo.slice(0, 7),
      medidor: 'RPU-0001',
      kwh: KWH,
      importe: IMPORTE,
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    const n = await poolTest().query(
      `select count(*)::int n from consumos_energia
        where tenant_id = $1 and predio_id = $2 and periodo = $3::date and medidor = 'RPU-0001'`,
      [orgA.id, predioA, MES.periodo],
    )
    expect(n.rows[0].n).toBe(1)
  })

  it('y con OTRO importe también: el duplicado se decide por la clave, no por las cifras', async () => {
    // Si el corte dependiera del importe, el error más común —teclear un cero
    // de más y volver a capturar— entraría como una segunda fila.
    const r = await capturar(a, {
      predioId: predioA,
      periodo: MES.periodo.slice(0, 7),
      medidor: 'RPU-0001',
      kwh: 1,
      importe: 99999,
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    const total = await reporteLuz(a)
    expect(total.datos.totales.costoEnergia).toBe(IMPORTE)
  })

  it('EL CASO QUE EL `coalesce` VIENE A CUBRIR · dos recibos SIN medidor', async () => {
    // En Postgres los NULL son DISTINTOS entre sí dentro de un índice único, así
    // que con la columna a secas las dos filas entrarían — y es el caso MÁS
    // COMÚN: el predio con un solo medidor cuyo número nadie anotó. El índice
    // va sobre `coalesce(medidor,'')` justamente por esto.
    const primero = await capturar(a, {
      predioId: predioA,
      periodo: MES.periodo.slice(0, 7),
      kwh: 10,
      importe: 500,
    })
    expect(primero.status, JSON.stringify(primero.datos)).toBe(201)
    expect(primero.datos.medidor).toBeNull()

    const segundo = await capturar(a, {
      predioId: predioA,
      periodo: MES.periodo.slice(0, 7),
      kwh: 10,
      importe: 500,
    })
    expect(segundo.status, JSON.stringify(segundo.datos)).toBe(409)

    const n = await poolTest().query(
      `select count(*)::int n from consumos_energia
        where tenant_id = $1 and predio_id = $2 and periodo = $3::date and medidor is null`,
      [orgA.id, predioA, MES.periodo],
    )
    expect(n.rows[0].n).toBe(1)
  })

  it('una cadena vacía y un medidor ausente son el MISMO recibo', async () => {
    // El controller recorta y convierte `''` en `null` a propósito: guardarlos
    // distinto rompería el índice, que compara `coalesce(medidor,'')`.
    const r = await capturar(a, {
      predioId: predioA,
      periodo: MES.periodo.slice(0, 7),
      medidor: '   ',
      kwh: 10,
      importe: 500,
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
  })

  it('OTRO medidor del mismo predio y mes SÍ entra — un predio puede tener varios', async () => {
    // El contrapeso de la prueba anterior: sin el medidor dentro de la clave,
    // el segundo recibo REAL del mes sería imposible de capturar y quien
    // captura acabaría sumando los dos a mano en una sola fila.
    const r = await capturar(a, {
      predioId: predioA,
      periodo: MES.periodo.slice(0, 7),
      medidor: 'RPU-0002',
      kwh: 100,
      importe: 200,
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
  })

  it('el índice único está en la base y no solo en el controller', async () => {
    // El último cerrojo: si un día una ruta nueva insertara sin pasar por el
    // controller, esto sigue en pie.
    await expect(
      poolTest().query(
        `insert into consumos_energia (tenant_id, predio_id, periodo, medidor, kwh, importe)
         values ($1, $2, $3::date, 'RPU-0002', 1, 1)`,
        [orgA.id, predioA, MES.periodo],
      ),
    ).rejects.toMatchObject({ code: '23505' })
  })

  it('el borrado deja volver a capturar el recibo corregido', async () => {
    // Es el motivo de que el DELETE exista: sin él, un importe con un cero de
    // más sería PERMANENTE, porque el índice impide recapturar ese recibo.
    const { rows } = await poolTest().query(
      `select id from consumos_energia
        where tenant_id = $1 and predio_id = $2 and periodo = $3::date and medidor = 'RPU-0002'`,
      [orgA.id, predioA, MES.periodo],
    )
    const borrado = await a.pedir(`/api/energia/consumos/${rows[0].id}/`, { metodo: 'DELETE' })
    expect(borrado.status, JSON.stringify(borrado.datos)).toBe(200)
    const otra = await capturar(a, {
      predioId: predioA,
      periodo: MES.periodo.slice(0, 7),
      medidor: 'RPU-0002',
      kwh: 100,
      importe: 250,
    })
    expect(otra.status, JSON.stringify(otra.datos)).toBe(201)
  })
})

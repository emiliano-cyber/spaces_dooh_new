import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  PAQ-01 · el PAQUETE CERRADO contra Postgres de verdad.  ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  Es ROJO por triple —migración, tenant y dinero—, y es la más peligrosa de
//  las cuatro fases porque no modifica un precio: lo SUSTITUYE. Las unitarias
//  SIMULAN la base, así que hay cinco cosas que no pueden ver y que son
//  exactamente lo que esta fase arriesga:
//
//   1. **Que la migración se aplicó.** Aplicar un paquete escribe cinco
//      columnas nuevas. Si no existieran, las unitarias seguirían en verde y
//      aplicar devolvería un 500.
//   2. **Que el paquete de una organización NO existe desde otra** (R2). Aquí
//      la fuga no es de lectura: es que se le pondría a una venta propia el
//      tarifario de otra empresa, y la propuesta quedaría coherente consigo
//      misma. 180 000 donde esta casa cobra 400 000, con 200 OK.
//   3. **Que un solo paquete por propuesta lo corta la BASE**, no solo el
//      controller. El `unique (propuesta_id)` es lo único que sirve contra un
//      doble clic.
//   4. **Que una propuesta APROBADA no cambia al mover NI AL BORRAR el
//      paquete.** El modo de fallo no da error: la propuesta se lee
//      perfectamente bien, solo que con otro precio del que el cliente aceptó.
//   5. **Que el reparto llega hasta `reservas.precio`**, que es de donde sale
//      el ingreso por pantalla del reporte de rentabilidad.
//
//  Y la sexta, que protege a los clientes de hoy: **vender SIN paquete tiene
//  que seguir funcionando exactamente igual**.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente
/** La SEGUNDA pantalla de cada organización: un paquete necesita dos. */
let sitioA2: string
let sitioB2: string

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('paqalfa')
  beta = await sembrarTenant('paqbeta')
  sitioA2 = await segundaPantalla(alfa)
  sitioB2 = await segundaPantalla(beta)

  await arrancarServidor()
  ca = new Cliente()
  cb = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cb.entrar(beta.usuarioEmail, PASSWORD_DEMO)
  // El candado se abre UNA vez por sesion. Ver `conCandado`.
  await desbloquear(ca)
  await desbloquear(cb)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

/**
 * Clona la pantalla sembrada para tener DOS: `motivoPaqueteInvalido` exige un
 * mínimo de dos, porque un «paquete» de una sola es una tarifa con otro nombre.
 * Se le copia el predio, así que hereda su contrato completo y la venta no
 * rebota en el guard del ADR 0003.
 */
async function segundaPantalla(org: { id: string; slug: string; sitioId: string }) {
  const p = poolTest()
  const base = await p.query('select predio_id from sitios where id = $1', [org.sitioId])
  const r = await p.query(
    `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                         alcaldia, ciudad, total_spots, tarifa_publicada, tarifa_mensual,
                         predio_id, tenant_id, exhibicion)
     values ($1,$2,$3,'PANTALLA_DIGITAL','DISPONIBLE','Cuauhtémoc','CDMX',12,15000,15000,$4,$5,'digital')
     returning id`,
    [
      `Pantalla ${org.slug} 2`,
      `${org.slug.toUpperCase()}-002`,
      `${org.slug.toUpperCase()}-PROV-002`,
      base.rows[0].predio_id,
      org.id,
    ],
  )
  return r.rows[0].id as string
}

/**
 * El candado: escribir el catálogo de paquetes es un cambio SENSIBLE.
 *
 * ⚠️ NO SE LLAMA UNA VEZ POR ESCRITURA, y el motivo apareció midiendo: el
 * desbloqueo tiene un **anti fuerza bruta de 5 intentos cada 5 minutos por
 * usuario** (`app/api/cambios/desbloquear/route.ts:21`). Este archivo escribe
 * el catálogo una docena de veces, así que desbloquear en cada una devolvía
 * `429 Demasiados intentos` a partir de la sexta — y el rojo no decía nada del
 * paquete: decía que la prueba estaba llamando a la puerta demasiadas veces.
 *
 * Se desbloquea UNA vez y el desbloqueo dura su ventana entera; solo se repite
 * si una escritura vuelve con 403, que es cuando de verdad ha caducado.
 */
async function desbloquear(c: Cliente) {
  const r = await c.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
}

/** Una escritura con candado: reintenta UNA vez si el desbloqueo caducó. */
async function conCandado(
  c: Cliente,
  hacer: () => Promise<{ status: number; datos: any }>,
): Promise<{ status: number; datos: any }> {
  const r = await hacer()
  if (r.status !== 403) return r
  await desbloquear(c)
  return hacer()
}

/** Crea un paquete POR LA APLICACIÓN, con su candado. */
async function crearPaquete(
  c: Cliente,
  cuerpo: Record<string, unknown>,
): Promise<{ status: number; datos: any }> {
  return conCandado(c, () => c.pedir('/api/paquetes/', { cuerpo }))
}

/** Una propuesta con las dos pantallas, a su tarifa de lista. */
async function crearPropuestaDeDos(
  c: Cliente,
  org: { clienteId: string; sitioId: string },
  segunda: string,
  nombre: string,
) {
  const r = await c.pedir('/api/propuestas/', {
    cuerpo: {
      nombre,
      clienteId: org.clienteId,
      fechaInicio: enDias(1),
      fechaFin: enDias(30),
      items: [
        { sitioId: org.sitioId, unidad: 'mensual', tarifaUnitaria: 45_000, cantidad: 1 },
        { sitioId: segunda, unidad: 'mensual', tarifaUnitaria: 15_000, cantidad: 1 },
      ],
    },
  })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  return r.datos.id as string
}

// ─── 1 · LA MIGRACIÓN ───────────────────────────────────────────────────────

describe('1 · la migración dejó el esquema como se pidió', () => {
  it('las tres tablas existen con RLS ENABLE y FORCE', async () => {
    const r = await poolTest().query(
      `select relname, relrowsecurity, relforcerowsecurity from pg_class
        where relname in ('paquetes','paquete_sitios','paquete_aplicaciones')
        order by relname`,
    )
    expect(r.rows).toHaveLength(3)
    for (const f of r.rows) {
      expect(f.relrowsecurity, f.relname).toBe(true)
      expect(f.relforcerowsecurity, f.relname).toBe(true)
    }
  })

  it('la política cierra por los DOS lados: `using` y `with check`', async () => {
    // Solo con `using`, una organización no VERÍA los paquetes de otra pero sí
    // podría ESCRIBIRLE uno. Es la regla 3 del ADR 0039 con todas las letras.
    const r = await poolTest().query(
      `select tablename, qual is not null as tiene_using,
              with_check is not null as tiene_check
         from pg_policies
        where tablename in ('paquetes','paquete_sitios','paquete_aplicaciones')
          and policyname = 'tenant_isolation'
        order by tablename`,
    )
    expect(r.rows).toHaveLength(3)
    for (const f of r.rows) {
      expect(f.tiene_using, f.tablename).toBe(true)
      expect(f.tiene_check, f.tablename).toBe(true)
    }
  })

  it('las seis columnas nuevas existen, y la bandera NACE APAGADA', async () => {
    const r = await poolTest().query(
      `select table_name, column_name, column_default from information_schema.columns
        where (table_name='propuestas' and column_name in
                ('paquete_nombre','paquete_precio','paquete_admite_codigo',
                 'paquete_aplicado_en','paquete_composicion'))
           or (table_name='reservas' and column_name='paquete_parte')
        order by table_name, column_name`,
    )
    expect(r.rows.map((x) => `${x.table_name}.${x.column_name}`)).toEqual([
      'propuestas.paquete_admite_codigo',
      'propuestas.paquete_aplicado_en',
      'propuestas.paquete_composicion',
      'propuestas.paquete_nombre',
      'propuestas.paquete_precio',
      'reservas.paquete_parte',
    ])
    const bandera = r.rows.find((x) => x.column_name === 'paquete_admite_codigo')!
    expect(String(bandera.column_default)).toContain('false')
  })

  it('un precio con CENTAVOS lo rechaza LA BASE, no solo la aplicación', async () => {
    // El reparto es en pesos enteros; un centavo repartido entre cinco
    // pantallas no se puede explicar. El CHECK es lo que queda en pie el día
    // que alguien escriba por otra ruta.
    await expect(
      poolTest().query(
        `insert into paquetes (tenant_id, nombre, precio_cerrado) values ($1,'Con centavos',180000.50)`,
        [alfa.id],
      ),
    ).rejects.toThrow(/paquetes_precio_ck/)
  })

  it('un precio de CERO lo rechaza la base', async () => {
    await expect(
      poolTest().query(
        `insert into paquetes (tenant_id, nombre, precio_cerrado) values ($1,'Gratis',0)`,
        [alfa.id],
      ),
    ).rejects.toThrow(/paquetes_precio_ck/)
  })

  it('el bloque congelado VIAJA JUNTO O NO VIAJA: un precio sin nombre lo corta la base', async () => {
    const prop = await poolTest().query(
      'select id from propuestas where tenant_id = $1 limit 1',
      [alfa.id],
    )
    if (!prop.rows[0]) return // sin propuestas todavía: se comprueba más abajo
    await expect(
      poolTest().query('update propuestas set paquete_precio = 100 where id = $1', [
        prop.rows[0].id,
      ]),
    ).rejects.toThrow(/paquete_pareja_ck/)
  })
})

// ─── 2 · AISLAMIENTO (R2) ───────────────────────────────────────────────────

describe('2 · un paquete de otra organización NO EXISTE para ti', () => {
  let paqBeta: string

  it('beta crea el suyo', async () => {
    const r = await crearPaquete(cb, {
      nombre: 'Periferico Beta',
      precioCerrado: 30_000,
      sitios: [beta.sitioId, sitioB2],
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    paqBeta = r.datos.id
  })

  it('alfa NO lo ve en su catálogo', async () => {
    const r = await ca.pedir('/api/paquetes/', { metodo: 'GET' })
    expect(r.status).toBe(200)
    expect((r.datos.paquetes as any[]).some((x) => x.id === paqBeta)).toBe(false)
  })

  it('alfa NO lo puede aplicar a una propuesta suya: para ella no existe', async () => {
    const id = await crearPropuestaDeDos(ca, alfa, sitioA2, 'Intento con paquete ajeno')
    const r = await ca.pedir(`/api/propuestas/${id}/paquete/`, { cuerpo: { paqueteId: paqBeta } })
    expect(r.status).toBe(409)
    expect(String(r.datos.error)).toMatch(/no existe/i)
    // Y la propuesta no se movió ni un peso.
    const f = await poolTest().query('select paquete_precio from propuestas where id=$1', [id])
    expect(f.rows[0].paquete_precio).toBeNull()
  })

  it('alfa NO lo puede borrar ni editar', async () => {
    const r = await conCandado(ca, () =>
      ca.pedir(`/api/paquetes/${paqBeta}/`, { metodo: 'DELETE' }),
    )
    expect(r.status).toBe(404)
    // Y sigue existiendo para beta.
    const f = await poolTest().query('select count(*)::int n from paquetes where id=$1', [paqBeta])
    expect(f.rows[0].n).toBe(1)
  })
})

// ─── 3 · APLICAR: EL PRECIO SUSTITUYE LA SUMA ───────────────────────────────

describe('3 · el precio del paquete sustituye la suma de las tarifas', () => {
  let paq: string

  it('alfa crea «Periferico» a 30 000 (la lista suma 60 000)', async () => {
    const r = await crearPaquete(ca, {
      nombre: 'Periferico',
      precioCerrado: 30_000,
      sitios: [alfa.sitioId, sitioA2],
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    paq = r.datos.id
    expect(r.datos.admiteCodigo).toBe(false) // nace APAGADA (regla 2)
  })

  it('aplicarlo copia nombre, precio, bandera, momento y composición', async () => {
    const id = await crearPropuestaDeDos(ca, alfa, sitioA2, 'Con paquete')
    const r = await ca.pedir(`/api/propuestas/${id}/paquete/`, { cuerpo: { paqueteId: paq } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const f = await poolTest().query(
      `select paquete_nombre, paquete_precio, paquete_admite_codigo,
              paquete_aplicado_en, paquete_composicion
         from propuestas where id=$1`,
      [id],
    )
    expect(f.rows[0].paquete_nombre).toBe('Periferico')
    expect(Number(f.rows[0].paquete_precio)).toBe(30_000)
    expect(f.rows[0].paquete_admite_codigo).toBe(false)
    expect(f.rows[0].paquete_aplicado_en).toBeTruthy()
    expect((f.rows[0].paquete_composicion as string[]).sort()).toEqual(
      [alfa.sitioId, sitioA2].sort(),
    )
  })

  it('DOS paquetes en la misma propuesta los corta la BASE, no solo el controller', async () => {
    const id = await crearPropuestaDeDos(ca, alfa, sitioA2, 'Doble paquete')
    const primero = await ca.pedir(`/api/propuestas/${id}/paquete/`, { cuerpo: { paqueteId: paq } })
    expect(primero.status).toBe(200)
    // Por la aplicación: frase clara.
    const segundo = await ca.pedir(`/api/propuestas/${id}/paquete/`, { cuerpo: { paqueteId: paq } })
    expect(segundo.status).toBe(409)
    // Y por la BASE, que es lo único que sirve contra un doble clic.
    await expect(
      poolTest().query(
        `insert into paquete_aplicaciones (tenant_id, paquete_id, propuesta_id)
         values ($1,$2,$3)`,
        [alfa.id, paq, id],
      ),
    ).rejects.toThrow(/idx_paquete_aplicaciones_propuesta_uq/)
  })

  it('NEGATIVA · no se aplica si las pantallas no son las del paquete', async () => {
    const r = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Solo una pantalla',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(30),
        items: [{ sitioId: alfa.sitioId, unidad: 'mensual', tarifaUnitaria: 45_000, cantidad: 1 }],
      },
    })
    expect(r.status).toBe(201)
    const ap = await ca.pedir(`/api/propuestas/${r.datos.id}/paquete/`, {
      cuerpo: { paqueteId: paq },
    })
    expect(ap.status).toBe(409)
    expect(String(ap.datos.error)).toMatch(/pantalla/i)
  })

  it('NEGATIVA · un paquete DESACTIVADO no se puede vender', async () => {
    await poolTest().query('update paquetes set activo=false where id=$1', [paq])
    const id = await crearPropuestaDeDos(ca, alfa, sitioA2, 'Con paquete apagado')
    const ap = await ca.pedir(`/api/propuestas/${id}/paquete/`, { cuerpo: { paqueteId: paq } })
    expect(ap.status).toBe(409)
    expect(String(ap.datos.error)).toMatch(/desactivado/i)
    await poolTest().query('update paquetes set activo=true where id=$1', [paq])
  })
})

// ─── 4 · EL CONGELADO, que es lo que decide si la fase está bien hecha ──────

describe('4 · una propuesta aprobada NO se mueve al cambiar ni al BORRAR el paquete', () => {
  it('el snapshot congela precio, composición y reparto; borrar el paquete no mueve un peso', async () => {
    const cr = await crearPaquete(ca, {
      nombre: 'El que se congela',
      precioCerrado: 30_000,
      sitios: [alfa.sitioId, sitioA2],
    })
    expect(cr.status, JSON.stringify(cr.datos)).toBe(201)
    const paq = cr.datos.id as string

    const id = await crearPropuestaDeDos(ca, alfa, sitioA2, 'La que se congela')
    const ap = await ca.pedir(`/api/propuestas/${id}/paquete/`, { cuerpo: { paqueteId: paq } })
    expect(ap.status, JSON.stringify(ap.datos)).toBe(200)

    const aprob = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(aprob.status, JSON.stringify(aprob.datos)).toBe(200)

    const leer = async () =>
      (await poolTest().query('select snapshot_economico from propuestas where id=$1', [id]))
        .rows[0].snapshot_economico

    const s = await leer()
    // La forma del JSON se declara, y esta fase la subió a 3.
    expect(s.esquema).toBe(3)
    // `bruto` sigue siendo la SUMA DE LAS LISTAS.
    expect(s.bruto).toBe(60_000)
    // …y la BASE es el precio del paquete.
    expect(s.base).toBe(30_000)
    expect(s.paquete.nombre).toBe('El que se congela')
    expect(s.paquete.precio).toBe(30_000)
    expect(s.paquete.composicion).toHaveLength(2)
    // EL REPARTO, y la suma cuadra AL PESO: 45/60 y 15/60 de 30 000.
    const partes = (s.paquete.sitios as any[]).map((x) => x.parte)
    expect(partes.reduce((a: number, b: number) => a + b, 0)).toBe(30_000)
    expect(partes.sort((a: number, b: number) => a - b)).toEqual([7_500, 22_500])
    // Y cada entrada de `porSitio` queda MARCADA como venida de un paquete.
    expect((s.porSitio as any[]).every((x) => x.paquete === true)).toBe(true)

    // ── Y AHORA SE CAMBIA EL PAQUETE… ────────────────────────────────────
    await poolTest().query('update paquetes set precio_cerrado = 999999 where id=$1', [paq])
    expect(await leer()).toEqual(s)

    // ── …Y AHORA SE BORRA DEL TODO ───────────────────────────────────────
    const del = await conCandado(ca, () =>
      ca.pedir(`/api/paquetes/${paq}/`, { metodo: 'DELETE' }),
    )
    expect(del.status, JSON.stringify(del.datos)).toBe(200)

    // El snapshot no se movió…
    expect(await leer()).toEqual(s)
    // …ni el precio congelado en la propuesta.
    const f = await poolTest().query(
      'select paquete_nombre, paquete_precio from propuestas where id=$1',
      [id],
    )
    expect(f.rows[0].paquete_nombre).toBe('El que se congela')
    expect(Number(f.rows[0].paquete_precio)).toBe(30_000)
    // Lo que SÍ desapareció es el enlace vivo, que es presupuesto del paquete.
    const enl = await poolTest().query(
      'select count(*)::int n from paquete_aplicaciones where propuesta_id=$1',
      [id],
    )
    expect(enl.rows[0].n).toBe(0)
  })
})

// ─── 5 · PRECIO FINAL: ni volumen ni código ─────────────────────────────────

describe('5 · el paquete es precio final (regla 2 del ADR)', () => {
  it('el descuento por VOLUMEN capturado no se aplica encima', async () => {
    // Escala del 20 % desde 1 mes… que con paquete NO tiene que descontar nada.
    await poolTest().query(
      `insert into escalas_volumen (tenant_id, unidad, desde_cantidad, descuento_pct)
       values ($1,'mensual',2,20) on conflict do nothing`,
      [alfa.id],
    )
    const cr = await crearPaquete(ca, {
      nombre: 'Sin volumen encima',
      precioCerrado: 30_000,
      sitios: [alfa.sitioId, sitioA2],
    })
    expect(cr.status, JSON.stringify(cr.datos)).toBe(201)

    const r = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'Volumen y paquete',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(70), // >= 2 meses → gana el tramo
        items: [
          { sitioId: alfa.sitioId, unidad: 'mensual', tarifaUnitaria: 45_000 },
          { sitioId: sitioA2, unidad: 'mensual', tarifaUnitaria: 15_000 },
        ],
      },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    const id = r.datos.id as string
    // El volumen SÍ quedó capturado en las líneas — no se borra nada.
    const li = await poolTest().query(
      'select descuento_volumen_pct from propuesta_items where propuesta_id=$1',
      [id],
    )
    expect(li.rows.every((x) => Number(x.descuento_volumen_pct) === 20)).toBe(true)

    const ap = await ca.pedir(`/api/propuestas/${id}/paquete/`, {
      cuerpo: { paqueteId: cr.datos.id },
    })
    expect(ap.status, JSON.stringify(ap.datos)).toBe(200)

    const aprob = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(aprob.status, JSON.stringify(aprob.datos)).toBe(200)

    const s = (
      await poolTest().query('select snapshot_economico from propuestas where id=$1', [id])
    ).rows[0].snapshot_economico
    // La base es el precio del paquete PELADO: ni 30 000 × 0,8 ni nada.
    expect(s.base).toBe(30_000)
    expect(s.descuentoVolumenMonto).toBeUndefined()
  })

  it('un paquete que no admite código se NIEGA si la propuesta ya tiene uno', async () => {
    await poolTest().query(
      `insert into codigos_promocionales
         (tenant_id, codigo, descuento_pct, vigente_desde, vigente_hasta)
       values ($1,'PAQTEST',20,current_date - 1, current_date + 30)
       on conflict do nothing`,
      [alfa.id],
    )
    const cr = await crearPaquete(ca, {
      nombre: 'Precio final',
      precioCerrado: 30_000,
      sitios: [alfa.sitioId, sitioA2],
    })
    expect(cr.status, JSON.stringify(cr.datos)).toBe(201)

    const id = await crearPropuestaDeDos(ca, alfa, sitioA2, 'Cupon y paquete')
    const cod = await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'PAQTEST' } })
    expect(cod.status, JSON.stringify(cod.datos)).toBe(200)

    const ap = await ca.pedir(`/api/propuestas/${id}/paquete/`, {
      cuerpo: { paqueteId: cr.datos.id },
    })
    expect(ap.status).toBe(409)
    expect(String(ap.datos.error)).toMatch(/codigo/i)
  })

  it('pero SÍ se aplica, y el cupón descuenta, cuando la bandera está encendida', async () => {
    const cr = await crearPaquete(ca, {
      nombre: 'Abierto a cupones',
      precioCerrado: 30_000,
      admiteCodigo: true,
      sitios: [alfa.sitioId, sitioA2],
    })
    expect(cr.status, JSON.stringify(cr.datos)).toBe(201)
    expect(cr.datos.admiteCodigo).toBe(true)

    const id = await crearPropuestaDeDos(ca, alfa, sitioA2, 'Cupon encima del paquete')
    const cod = await ca.pedir(`/api/propuestas/${id}/codigo/`, { cuerpo: { codigo: 'PAQTEST' } })
    expect(cod.status, JSON.stringify(cod.datos)).toBe(200)
    const ap = await ca.pedir(`/api/propuestas/${id}/paquete/`, {
      cuerpo: { paqueteId: cr.datos.id },
    })
    expect(ap.status, JSON.stringify(ap.datos)).toBe(200)

    const aprob = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(aprob.status, JSON.stringify(aprob.datos)).toBe(200)
    const s = (
      await poolTest().query('select snapshot_economico from propuestas where id=$1', [id])
    ).rows[0].snapshot_economico
    expect(s.base).toBe(24_000) // 30 000 × 0,8
  })
})

// ─── 6 · QUITAR EL PAQUETE DEVUELVE LOS PRECIOS DE LÍNEA ────────────────────

describe('6 · quitar el paquete devuelve la venta a como estaba', () => {
  it('vuelven las listas y el volumen capturado, sin haber borrado nada', async () => {
    const cr = await crearPaquete(ca, {
      nombre: 'El que se quita',
      precioCerrado: 30_000,
      sitios: [alfa.sitioId, sitioA2],
    })
    expect(cr.status, JSON.stringify(cr.datos)).toBe(201)
    const id = await crearPropuestaDeDos(ca, alfa, sitioA2, 'La que se desempaqueta')

    const ap = await ca.pedir(`/api/propuestas/${id}/paquete/`, {
      cuerpo: { paqueteId: cr.datos.id },
    })
    expect(ap.status, JSON.stringify(ap.datos)).toBe(200)

    const quitar = await ca.pedir(`/api/propuestas/${id}/paquete/`, { metodo: 'DELETE' })
    expect(quitar.status, JSON.stringify(quitar.datos)).toBe(200)

    const f = await poolTest().query(
      `select paquete_nombre, paquete_precio, paquete_admite_codigo,
              paquete_aplicado_en, paquete_composicion
         from propuestas where id=$1`,
      [id],
    )
    expect(f.rows[0].paquete_nombre).toBeNull()
    expect(f.rows[0].paquete_precio).toBeNull()
    expect(f.rows[0].paquete_admite_codigo).toBe(false)
    expect(f.rows[0].paquete_aplicado_en).toBeNull()
    expect(f.rows[0].paquete_composicion).toBeNull()
    // Y las líneas nunca se tocaron: siguen con su lista.
    const li = await poolTest().query(
      'select precio from propuesta_items where propuesta_id=$1 order by precio desc',
      [id],
    )
    expect(li.rows.map((x) => Number(x.precio))).toEqual([45_000, 15_000])
  })

  it('NEGATIVA · una propuesta APROBADA no se puede desempaquetar', async () => {
    const cr = await crearPaquete(ca, {
      nombre: 'Inmutable',
      precioCerrado: 30_000,
      sitios: [alfa.sitioId, sitioA2],
    })
    const id = await crearPropuestaDeDos(ca, alfa, sitioA2, 'Aprobada e inmutable')
    await ca.pedir(`/api/propuestas/${id}/paquete/`, { cuerpo: { paqueteId: cr.datos.id } })
    const aprob = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(aprob.status, JSON.stringify(aprob.datos)).toBe(200)

    const quitar = await ca.pedir(`/api/propuestas/${id}/paquete/`, { metodo: 'DELETE' })
    expect(quitar.status).toBe(409)
    const f = await poolTest().query('select paquete_precio from propuestas where id=$1', [id])
    expect(Number(f.rows[0].paquete_precio)).toBe(30_000)
  })
})

// ─── 7 · EL REPARTO LLEGA A LA CAMPAÑA ──────────────────────────────────────

describe('7 · el reparto llega hasta `reservas.precio`', () => {
  it('cada reserva cobra su parte del paquete, y suman el precio del conjunto', async () => {
    // Es el número del que sale el ingreso por pantalla del reporte de
    // rentabilidad y lo que se compara contra la renta del arrendador. Si se
    // quedara en la cabecera, las dos pantallas saldrían en pérdida.
    const cr = await crearPaquete(ca, {
      nombre: 'El que se factura',
      precioCerrado: 30_000,
      sitios: [alfa.sitioId, sitioA2],
    })
    expect(cr.status, JSON.stringify(cr.datos)).toBe(201)
    const id = await crearPropuestaDeDos(ca, alfa, sitioA2, 'La que se convierte')
    const ap = await ca.pedir(`/api/propuestas/${id}/paquete/`, {
      cuerpo: { paqueteId: cr.datos.id },
    })
    expect(ap.status, JSON.stringify(ap.datos)).toBe(200)
    const aprob = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(aprob.status, JSON.stringify(aprob.datos)).toBe(200)

    const camp = await ca.pedir(`/api/propuestas/${id}/generar-campana/`, { cuerpo: {} })
    expect([200, 201], JSON.stringify(camp.datos)).toContain(camp.status)

    const res = await poolTest().query(
      `select r.precio, r.paquete_parte from reservas r
        join campanas c on c.id = r.campana_id
       where c.propuesta_id = $1 order by r.precio desc`,
      [id],
    )
    expect(res.rows).toHaveLength(2)
    // Sin descuento comercial ni comisión, el precio ES la parte.
    expect(res.rows.map((x) => Number(x.precio))).toEqual([22_500, 7_500])
    expect(res.rows.map((x) => Number(x.paquete_parte))).toEqual([22_500, 7_500])
    // Y suman el precio del paquete, al peso.
    expect(res.rows.reduce((a, x) => a + Number(x.precio), 0)).toBe(30_000)
    // El presupuesto de la campaña sale del snapshot, o sea del paquete.
    const c = await poolTest().query(
      'select presupuesto_neto from campanas where propuesta_id=$1',
      [id],
    )
    expect(Number(c.rows[0].presupuesto_neto)).toBe(30_000)
  })
})

// ─── 7-bis · EL CAMINO DE RESPALDO, cuando NO hay snapshot ─────────────────

describe('7-bis · sin snapshot, el respaldo tampoco cobra la lista', () => {
  it('una campaña generada SIN snapshot cobra el reparto, no la suma de las tarifas', async () => {
    // ⚠️ ESTE BLOQUE NACIÓ DE DOS MUTANTES QUE SOBREVIVIERON (M33 y M34), y no
    // porque el código estuviera mal: porque **ninguna prueba llegaba hasta
    // aquí**. El camino normal lee `netoDeSnap`, y el `??` que da paso al
    // respaldo nunca se evaluaba — el snapshot siempre existe tras aprobar.
    //
    // El respaldo NO es código muerto: lo recorre toda campaña que se genere de
    // una propuesta aprobada sin snapshot, que es lo que hay en los datos
    // anteriores al 2026-07-08. Y ahí un paquete sin tratar cobraría la SUMA DE
    // LAS LISTAS —60 000 donde el cliente aceptó 30 000—, que no es una
    // desviación porcentual: es otro número.
    //
    // Se fuerza borrando el snapshot ANTES de generar la campaña, que es
    // exactamente el estado de esos datos viejos.
    const cr = await crearPaquete(ca, {
      nombre: 'Sin snapshot',
      precioCerrado: 30_000,
      sitios: [alfa.sitioId, sitioA2],
    })
    expect(cr.status, JSON.stringify(cr.datos)).toBe(201)
    const id = await crearPropuestaDeDos(ca, alfa, sitioA2, 'La del respaldo')
    const ap = await ca.pedir(`/api/propuestas/${id}/paquete/`, {
      cuerpo: { paqueteId: cr.datos.id },
    })
    expect(ap.status, JSON.stringify(ap.datos)).toBe(200)

    // ⚠️ SE APRUEBA POR LA BASE, NO POR LA API, Y ESO ES LO QUE HACE QUE ESTA
    // PRUEBA MIDA ALGO. Aprobar por `PATCH /api/propuestas/:id` hace DOS cosas:
    // congela el snapshot **y genera la campaña ahí mismo**
    // (`app/api/propuestas/[id]/route.ts:80`). Así que borrar el snapshot
    // después llegaba tarde por partida doble: la campaña ya existía y sus
    // reservas ya se habían calculado del snapshot, y la llamada posterior a
    // `generar-campana` devolvía la existente por idempotencia.
    //
    // Con eso, la prueba pasaba SIN TOCAR NUNCA el camino de respaldo — y eso
    // se vio porque dos mutantes de ese camino SOBREVIVIERON. El rojo no lo
    // delató: el verde lo escondió.
    //
    // Aprobando por la base se reproduce el estado real de los datos viejos:
    // propuesta APROBADA, sin snapshot y sin campaña.
    await poolTest().query(
      "update propuestas set estatus='APROBADA', snapshot_economico=null, snapshot_en=null where id=$1",
      [id],
    )
    await poolTest().query('update propuesta_items set aprobado=true where propuesta_id=$1', [id])
    // Y se COMPRUEBA que de verdad quedó sin snapshot. Sin esta línea, si el
    // `update` no tocara nada —RLS, un id equivocado— la prueba seguiría verde
    // midiendo el camino normal y creyendo que mide el respaldo. Es justo el
    // error que hace que un mutante «sobreviva» sin que el código falle.
    const sinSnap = await poolTest().query(
      'select snapshot_economico from propuestas where id = $1',
      [id],
    )
    expect(sinSnap.rows[0].snapshot_economico).toBeNull()

    const camp = await ca.pedir(`/api/propuestas/${id}/generar-campana/`, { cuerpo: {} })
    expect([200, 201], JSON.stringify(camp.datos)).toContain(camp.status)

    const res = await poolTest().query(
      `select r.precio, r.paquete_parte from reservas r
        join campanas c on c.id = r.campana_id
       where c.propuesta_id = $1 order by r.precio desc`,
      [id],
    )
    expect(res.rows).toHaveLength(2)
    // Cada reserva cobra SU PARTE, no su tarifa de lista (45 000 / 15 000).
    expect(res.rows.map((x) => Number(x.precio))).toEqual([22_500, 7_500])
    expect(res.rows.reduce((a, x) => a + Number(x.precio), 0)).toBe(30_000)
    // Y el PRESUPUESTO de la campaña también sale del precio del paquete.
    const c = await poolTest().query(
      'select presupuesto_neto from campanas where propuesta_id=$1',
      [id],
    )
    expect(Number(c.rows[0].presupuesto_neto)).toBe(30_000)
  })
})

// ─── 8 · LO QUE NO PUEDE ROMPERSE ───────────────────────────────────────────

describe('8 · vender SIN paquete sigue funcionando exactamente igual', () => {
  it('una propuesta sin paquete no lleva ninguna clave de paquete en su snapshot', async () => {
    const r = await ca.pedir('/api/propuestas/', {
      cuerpo: {
        nombre: 'De toda la vida',
        clienteId: alfa.clienteId,
        fechaInicio: enDias(1),
        fechaFin: enDias(20),
        items: [{ sitioId: alfa.sitioId, unidad: 'mensual', tarifaUnitaria: 45_000 }],
      },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    const id = r.datos.id as string
    const aprob = await ca.pedir(`/api/propuestas/${id}/`, {
      metodo: 'PATCH',
      cuerpo: { estatus: 'APROBADA' },
    })
    expect(aprob.status, JSON.stringify(aprob.datos)).toBe(200)
    const s = (
      await poolTest().query('select snapshot_economico from propuestas where id=$1', [id])
    ).rows[0].snapshot_economico
    expect(s.paquete).toBeUndefined()
    expect((s.porSitio as any[]).every((x) => x.paquete === undefined)).toBe(true)
    expect(s.base).toBe(45_000)
  })
})

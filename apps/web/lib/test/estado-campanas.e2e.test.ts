import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  INC-03 · el estado de la campaña sigue al calendario.
// ----------------------------------------------------------------------------
//  Se ejerce por HTTP, no llamando al repo: `recomputarEstadoCampanas()` corre
//  dentro de `GET /api/estado`, y el tenant sale de la cookie de sesión. Ir por
//  la ruta prueba además EL CABLEADO —que el barrido esté enganchado y detrás
//  del permiso de comercial—, que es justo la mitad que se puede romper sin que
//  el SQL cambie.
//
//  Lo que más importa aquí son los NO: qué NO se mueve. Un barrido que mueve de
//  más cambia datos de negocio sin que nadie lo pida, y en un sistema donde el
//  estado abre el candado de facturación eso es peor que no correrlo.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let ajena: Awaited<ReturnType<typeof sembrarTenant>>
let c: Cliente

// Segundo usuario de la MISMA organización, con un rol que no ve comercial.
//
// Era OPERACIONES hasta el 2026-08-20. Dejó de servir: al cerrar ROJO-2 el
// catálogo pasó a darle `comercial: ver` A PROPÓSITO —Operaciones necesita ver
// lo que va a instalar— y con eso esta prueba dejaba de medir lo que dice.
// IMPRENTA sí carece de `comercial` en el catálogo vigente
// (`20260820_catalogo_permisos_completo.sql`): ve y crea sus trabajos y mira
// operaciones, nada más.
const EMAIL_SIN_COMERCIAL = 'imprenta@estados.test'

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('estados')
  ajena = await sembrarTenant('estadosajena')
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ('Imprenta estados',$1,'IMPRENTA',$2,true,$3)`,
    [EMAIL_SIN_COMERCIAL, await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
  await arrancarServidor()
  c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// La bitácora es APPEND-ONLY —un trigger prohíbe el DELETE, y está bien que así
// sea— así que entre pruebas no se puede vaciar. Lo que se hace en su lugar es
// darle a cada campaña un nombre único y leer la bitácora cruzándola con las
// campañas VIVAS: como `campanas` sí se vacía, solo quedan las de la prueba en
// curso y los apuntes de las anteriores no cuentan.
let contadorCampanas = 0

beforeEach(async () => {
  await poolTest().query('delete from ordenes_trabajo')
  await poolTest().query('delete from campanas')
})

const dia = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// Se siembra con el pool de admin a propósito: aquí se están preparando estados
// que la propia API no deja construir (una CONFIRMADA vencida es justo el atasco
// que INC-03 limpia, y ningún endpoint la crea).
async function sembrarCampana(over: {
  estado: string
  inicio: string
  fin: string
  tipo?: string
  enviada?: boolean
  validacion?: string
  nombre?: string
  de?: { id: string; clienteId: string }
}): Promise<string> {
  const duena = over.de ?? org
  const r = await poolTest().query(
    `insert into campanas
       (nombre, cliente_id, tipo_campana, fecha_inicio, fecha_fin, estado_comercial,
        enviada_dominio, validacion_estatus, tenant_id)
     values ($1,$2,$3::tipo_campana,$4,$5,$6::est_comercial_campana,$7,$8,$9)
     returning id`,
    [
      over.nombre ?? `Campaña ${over.estado} #${++contadorCampanas}`,
      duena.clienteId,
      over.tipo ?? 'DOOH',
      over.inicio,
      over.fin,
      over.estado,
      over.enviada ?? false,
      over.validacion ?? 'PENDIENTE',
      duena.id,
    ],
  )
  return r.rows[0].id
}

async function sembrarOT(campanaId: string, tipo: string, estatus: string): Promise<void> {
  await poolTest().query(
    `insert into ordenes_trabajo (tipo, campana_id, sitio_id, descripcion, estatus, tenant_id)
     values ($1::tipo_ot,$2,$3,'Montaje de prueba',$4::est_ot,$5)`,
    [tipo, campanaId, org.sitioId, estatus, org.id],
  )
}

// Dispara el barrido como lo dispara la app: hidratando el shell.
async function barrer(): Promise<void> {
  const r = await c.pedir('/api/estado/')
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
}

const estadoDe = async (id: string): Promise<string> =>
  (await poolTest().query('select estado_comercial from campanas where id=$1', [id]))
    .rows[0].estado_comercial

// Solo las anotaciones que este barrido dejó SOBRE LAS CAMPAÑAS DE ESTA PRUEBA:
// la misma petición dispara los otros tres barridos, el login ya dejó su rastro
// y los apuntes de las pruebas anteriores siguen ahí (append-only).
const bitacoraDelBarrido = async (): Promise<{ accion: string; entidad: string; usuario_nombre: string }[]> =>
  (await poolTest().query(
    `select a.accion, a.entidad, a.usuario_nombre
       from acciones a
      where a.accion like 'Campaña %automáticamente%'
        and exists (select 1 from campanas c where c.nombre = a.entidad)
      order by a.accion`,
  )).rows

// ─── Regla 1 · el periodo terminó → COMPLETADA ──────────────────────────────

describe('1 · una campaña cuyo periodo ya terminó se completa sola', () => {
  it('ACTIVA con fin AYER pasa a COMPLETADA', async () => {
    const id = await sembrarCampana({ estado: 'ACTIVA', inicio: dia(-30), fin: dia(-1) })
    await barrer()
    expect(await estadoDe(id)).toBe('COMPLETADA')
  })

  it('ACTIVA con fin HOY NO se completa: el último día todavía cuenta', async () => {
    // El borde que más fácil se equivoca. Con `<=` en vez de `<`, esto apagaría
    // campañas que siguen al aire su último día contratado — y con el estado se
    // va el candado de facturación.
    const id = await sembrarCampana({ estado: 'ACTIVA', inicio: dia(-30), fin: dia(0) })
    await barrer()
    expect(await estadoDe(id)).toBe('ACTIVA')
  })

  it('ACTIVA con fin FUTURO no se toca', async () => {
    const id = await sembrarCampana({ estado: 'ACTIVA', inicio: dia(-5), fin: dia(30) })
    await barrer()
    expect(await estadoDe(id)).toBe('ACTIVA')
  })

  it('una CONFIRMADA publicada que ya terminó también se completa', async () => {
    // El atasco que INC-03 viene a limpiar: salió al aire, terminó, y nadie la
    // avanzó nunca a mano. Sin esta rama se quedaría en CONFIRMADA para siempre.
    const id = await sembrarCampana({
      estado: 'CONFIRMADA', inicio: dia(-40), fin: dia(-2),
      enviada: true, validacion: 'APROBADA',
    })
    await barrer()
    expect(await estadoDe(id)).toBe('COMPLETADA')
  })

  it('una CONFIRMADA que NUNCA salió al aire no se completa aunque haya vencido', async () => {
    // No es lo mismo «terminó» que «nunca ocurrió». Completarla diría que se
    // publicó, y de ésta lo único que se sabe es que se quedó parada.
    const id = await sembrarCampana({ estado: 'CONFIRMADA', inicio: dia(-40), fin: dia(-2) })
    await barrer()
    expect(await estadoDe(id)).toBe('CONFIRMADA')
  })

  it('deja constancia en la bitácora, a nombre del Sistema y con la campaña', async () => {
    await sembrarCampana({ estado: 'ACTIVA', inicio: dia(-30), fin: dia(-1), nombre: 'La que vence' })
    await barrer()
    const filas = await bitacoraDelBarrido()
    expect(filas.length).toBe(1)
    expect(filas[0].accion).toContain('completada automáticamente')
    expect(filas[0].entidad).toBe('La que vence')
    expect(filas[0].usuario_nombre).toBe('Sistema')
  })
})

// ─── Regla 2 · empezó, sigue vigente y está publicada → ACTIVA ──────────────

describe('2 · una CONFIRMADA que ya empezó y está publicada pasa a ACTIVA', () => {
  it('DOOH enviada al dominio y APROBADA, con inicio pasado', async () => {
    const id = await sembrarCampana({
      estado: 'CONFIRMADA', inicio: dia(-1), fin: dia(30),
      enviada: true, validacion: 'APROBADA',
    })
    await barrer()
    expect(await estadoDe(id)).toBe('ACTIVA')
  })

  it('con inicio HOY también entra: el primer día ya cuenta', async () => {
    const id = await sembrarCampana({
      estado: 'CONFIRMADA', inicio: dia(0), fin: dia(30),
      enviada: true, validacion: 'APROBADA',
    })
    await barrer()
    expect(await estadoDe(id)).toBe('ACTIVA')
  })

  it('una HÍBRIDA entra por la misma puerta que la DOOH', async () => {
    const id = await sembrarCampana({
      estado: 'CONFIRMADA', inicio: dia(-1), fin: dia(30), tipo: 'HIBRIDA',
      enviada: true, validacion: 'APROBADA',
    })
    await barrer()
    expect(await estadoDe(id)).toBe('ACTIVA')
  })

  it('NO se activa si todavía no está publicada, aunque haya empezado', async () => {
    // La transición REFLEJA lo publicado; no lo provoca. Sin esta condición el
    // barrido pondría «Activa» a campañas que no han salido al aire.
    const id = await sembrarCampana({ estado: 'CONFIRMADA', inicio: dia(-5), fin: dia(30) })
    await barrer()
    expect(await estadoDe(id)).toBe('CONFIRMADA')
  })

  it('NO se activa si está enviada pero la validación sigue PENDIENTE', async () => {
    const id = await sembrarCampana({
      estado: 'CONFIRMADA', inicio: dia(-5), fin: dia(30),
      enviada: true, validacion: 'PENDIENTE',
    })
    await barrer()
    expect(await estadoDe(id)).toBe('CONFIRMADA')
  })

  it('NO se activa si la validación fue RECHAZADA', async () => {
    const id = await sembrarCampana({
      estado: 'CONFIRMADA', inicio: dia(-5), fin: dia(30),
      enviada: true, validacion: 'RECHAZADA',
    })
    await barrer()
    expect(await estadoDe(id)).toBe('CONFIRMADA')
  })

  it('NO se activa si aún no ha llegado su fecha de inicio', async () => {
    const id = await sembrarCampana({
      estado: 'CONFIRMADA', inicio: dia(5), fin: dia(30),
      enviada: true, validacion: 'APROBADA',
    })
    await barrer()
    expect(await estadoDe(id)).toBe('CONFIRMADA')
  })
})

// ─── El medio físico tiene su propia idea de «publicada» ────────────────────

describe('3 · una OOH sale al aire cuando se instala, no cuando se envía', () => {
  it('con la OT de MONTAJE_LONA COMPLETADA, se activa', async () => {
    const id = await sembrarCampana({ estado: 'CONFIRMADA', inicio: dia(-2), fin: dia(30), tipo: 'OOH' })
    await sembrarOT(id, 'MONTAJE_LONA', 'COMPLETADA')
    await barrer()
    expect(await estadoDe(id)).toBe('ACTIVA')
  })

  it('con la OT de montaje TODAVÍA EN PROCESO, no se activa', async () => {
    const id = await sembrarCampana({ estado: 'CONFIRMADA', inicio: dia(-2), fin: dia(30), tipo: 'OOH' })
    await sembrarOT(id, 'MONTAJE_LONA', 'EN_PROCESO')
    await barrer()
    expect(await estadoDe(id)).toBe('CONFIRMADA')
  })

  it('una OT de otro tipo completada no cuenta como instalación', async () => {
    // Una inspección completada no es una lona colgada.
    const id = await sembrarCampana({ estado: 'CONFIRMADA', inicio: dia(-2), fin: dia(30), tipo: 'OOH' })
    await sembrarOT(id, 'INSPECCION', 'COMPLETADA')
    await barrer()
    expect(await estadoDe(id)).toBe('CONFIRMADA')
  })

  it('una OOH NO se activa por las banderas digitales', async () => {
    // Una campaña física no sale al aire por estar «enviada al dominio». Sin el
    // filtro por tipo, una OOH con esas banderas puestas se daría por publicada
    // sin que nadie hubiera ido a instalarla.
    const id = await sembrarCampana({
      estado: 'CONFIRMADA', inicio: dia(-5), fin: dia(30), tipo: 'OOH',
      enviada: true, validacion: 'APROBADA',
    })
    await barrer()
    expect(await estadoDe(id)).toBe('CONFIRMADA')
  })
})

// ─── Lo que el barrido no debe tocar nunca ──────────────────────────────────

describe('4 · estados que no dependen del calendario', () => {
  it('CANCELADA, DRAFT y COTIZACION se quedan como están, aunque estén vencidas', async () => {
    const ids: Record<string, string> = {}
    for (const e of ['CANCELADA', 'DRAFT', 'COTIZACION']) {
      ids[e] = await sembrarCampana({ estado: e, inicio: dia(-60), fin: dia(-30) })
    }
    await barrer()
    for (const e of Object.keys(ids)) {
      expect(await estadoDe(ids[e]), `${e} no debe moverse`).toBe(e)
    }
  })

  it('COMPLETADA con fin FUTURO no se revierte a ACTIVA', async () => {
    // El cierre anticipado es legítimo —una cancelación de facto— y el barrido
    // no debe deshacer una decisión que tomó una persona.
    const id = await sembrarCampana({ estado: 'COMPLETADA', inicio: dia(-5), fin: dia(30) })
    await barrer()
    expect(await estadoDe(id)).toBe('COMPLETADA')
  })

  it('LISTA_FACTURAR vencida no retrocede a COMPLETADA', async () => {
    // Va DESPUÉS de completada en el flujo: volver a moverla desharía trabajo.
    const id = await sembrarCampana({ estado: 'LISTA_FACTURAR', inicio: dia(-60), fin: dia(-30) })
    await barrer()
    expect(await estadoDe(id)).toBe('LISTA_FACTURAR')
  })
})

// ─── Converge y no acumula ──────────────────────────────────────────────────

describe('5 · corre en cada hidratación, así que no puede acumular', () => {
  it('la segunda y la tercera pasada no cambian nada ni duplican la bitácora', async () => {
    // Es lo que más veces va a ocurrir: el barrido se dispara en CADA carga del
    // shell. Si anotara en cada pasada, ahogaría el historial en una semana.
    await sembrarCampana({ estado: 'ACTIVA', inicio: dia(-30), fin: dia(-1) })
    await barrer()
    await barrer()
    await barrer()
    expect((await bitacoraDelBarrido()).length).toBe(1)
  })

  it('una CONFIRMADA publicada y vencida llega a COMPLETADA en UNA sola pasada', async () => {
    // Fija la propiedad, no la implementación: la campaña atascada termina en
    // COMPLETADA con UN solo apunte. Si algún día se invirtiera el orden de las
    // dos reglas, ésta se activaría hoy y se completaría mañana, con dos
    // apuntes que se contradicen — y esta prueba se pondría roja.
    const id = await sembrarCampana({
      estado: 'CONFIRMADA', inicio: dia(-40), fin: dia(-2),
      enviada: true, validacion: 'APROBADA', nombre: 'Atascada',
    })
    await barrer()
    expect(await estadoDe(id)).toBe('COMPLETADA')
    const filas = await bitacoraDelBarrido()
    expect(filas.length).toBe(1)
    expect(filas[0].accion).toContain('completada automáticamente')
  })
})

// ─── El barrido va detrás del permiso ───────────────────────────────────────

describe('6 · solo lo dispara quien puede ver comercial', () => {
  it('un rol sin comercial hidrata el shell sin mover ninguna campaña', async () => {
    // El barrido escribe. Un rol que no ve el módulo no debe provocar escrituras
    // en él, ni siquiera de rebote al cargar su propia pantalla.
    //
    // El usuario es del MISMO tenant a propósito. Con uno de otra organización
    // la prueba pasaría sola por la RLS y no diría nada del permiso, que es lo
    // único que aquí se quiere comprobar.
    const id = await sembrarCampana({ estado: 'ACTIVA', inicio: dia(-30), fin: dia(-1) })

    const otro = new Cliente()
    await otro.entrar(EMAIL_SIN_COMERCIAL, PASSWORD_DEMO)
    const r = await otro.pedir('/api/estado/')
    expect(r.status).toBe(200)
    // Se comprueba que el filtro por permiso está actuando de verdad: si este
    // rol viera comercial, la aserción de abajo no probaría nada.
    expect(r.datos.campanas).toEqual([])

    expect(await estadoDe(id)).toBe('ACTIVA')
    expect(await bitacoraDelBarrido()).toEqual([])
  })

  it('no se lleva por delante las campañas de OTRA organización', async () => {
    // Esto es lo más caro que puede salir mal aquí: el barrido ESCRIBE, y su
    // alcance no lo pone ningún `where tenant_id` — lo pone la RLS. Es el estilo
    // de la casa (el barrido de arrendadores hace lo mismo), pero conviene que
    // haya una prueba que lo diga, porque el modo de fallo de esta base es
    // justamente que sin contexto de tenant las cosas pasan en silencio.
    const mia = await sembrarCampana({ estado: 'ACTIVA', inicio: dia(-30), fin: dia(-1) })
    const suya = await sembrarCampana({
      estado: 'ACTIVA', inicio: dia(-30), fin: dia(-1), de: ajena, nombre: 'De la otra organización',
    })

    await barrer()

    expect(await estadoDe(mia)).toBe('COMPLETADA')
    expect(await estadoDe(suya), 'la campaña ajena no se toca').toBe('ACTIVA')
    // Y tampoco le aparece un apunte en su bitácora.
    const suApunte = await poolTest().query(
      `select 1 from acciones where entidad = 'De la otra organización'`,
    )
    expect(suApunte.rowCount).toBe(0)
  })
})

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'
import { diasDeCampana } from '../doohmain-programacion'

// ============================================================================
//  M14 / INC-02 · qué pieza va en qué pantalla.
// ----------------------------------------------------------------------------
//  La auditoría encontró campañas Publicadas con TODOS sus slots en «Sin
//  asignar». No era solo un hueco de captura: la publicación mandaba cada
//  creativo validado a cada pantalla, así que no existía tal cosa como «la
//  pieza de esta pantalla», y el reporte al cliente no podía probar qué se
//  exhibió.
//
//  Se prueba por HTTP contra Postgres real: lo que cambia son consultas con
//  `jsonb_array_elements` y un `join` contra `creatividades`, y ahí lo que
//  falla es el SQL. La publicación en sí NO se dispara —`DOOHMAIN_PUBLISH_
//  ENABLED` está apagado en el arnés— y eso es deliberado: estas pruebas fijan
//  la REGLA (quién puede publicar, con qué asignación y con cuántos pases),
//  no la respuesta del CMS: el arnés apunta DOOHmain a un intérprete que no
//  existe, así que cada envío falla al arrancar el proceso — pero la fila del
//  resultado ya se construyó, y ahí es donde se mira.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let c: Cliente
let sitioB: string
// Las claves internas: la del tenant sembrado la pone `sembrarTenant` a partir
// del slug, y la segunda la crea este fichero. Se nombran para no repetirlas.
const CLAVE_A = 'CREATIVOS-001'
const CLAVE_B = 'CRE-002'

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('creativos')
  // Una segunda pantalla digital, para poder distinguir «una asignada y otra
  // no» — que es el caso que la auditoría encontró.
  const p = await poolTest().query('select predio_id from sitios where id=$1', [org.sitioId])
  const s = await poolTest().query(
    `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                         alcaldia, ciudad, total_spots, tarifa_publicada, tarifa_mensual,
                         predio_id, tenant_id, exhibicion)
     values ('Pantalla B',$3,'CRE-PROV-002','PANTALLA_DIGITAL','DISPONIBLE','Cuauhtémoc','CDMX',
             12,45000,45000,$1,$2,'digital') returning id`,
    [p.rows[0].predio_id, org.id, CLAVE_B],
  )
  sitioB = s.rows[0].id
  await arrancarServidor()
  c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  await poolTest().query('delete from creatividades')
  await poolTest().query('delete from reservas')
  await poolTest().query('delete from campanas')
})

// Campaña con sus reservas, montada directo en la base: llegar hasta aquí por
// la API son cinco pasos que ya cubre `flujo-critico`, y repetirlos aquí
// mezclaría lo que se está probando con lo que no.
async function sembrarCampana(opts: {
  tipo?: string
  sitios?: { id: string; spots: number | null }[]
} = {}): Promise<string> {
  const r = await poolTest().query(
    `insert into campanas (nombre, cliente_id, tipo_campana, fecha_inicio, fecha_fin,
                           estado_comercial, tenant_id)
     values ('Campaña de creativos',$1,$2::tipo_campana,$3,$4,'CONFIRMADA',$5) returning id`,
    [org.clienteId, opts.tipo ?? 'DOOH', enDias(-1), enDias(30), org.id],
  )
  const campanaId = r.rows[0].id
  for (const s of opts.sitios ?? [{ id: org.sitioId, spots: 6 }]) {
    await poolTest().query(
      `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio,
                             estatus, spots_reservados, spots_por_dia, tenant_id)
       values ($1,$2,$3,$4,45000,'CONFIRMADA',$5,$5,$6)`,
      [campanaId, s.id, enDias(-1), enDias(30), s.spots, org.id],
    )
  }
  return campanaId
}

async function sembrarCreativo(campanaId: string, nombre: string): Promise<string> {
  const r = await poolTest().query(
    `insert into creatividades (campana_id, nombre, archivo_url, formato, estatus_validacion, tenant_id)
     values ($1,$2,'data:image/png;base64,iVBORw0KGgo=','png','PENDIENTE',$3) returning id`,
    [campanaId, nombre, org.id],
  )
  return r.rows[0].id
}

const aprobar = (creativoId: string) =>
  c.pedir(`/api/creatividades/${creativoId}/`, { metodo: 'PATCH', cuerpo: { aprobar: true } })
const rechazar = (creativoId: string) =>
  c.pedir(`/api/creatividades/${creativoId}/`, { metodo: 'PATCH', cuerpo: { aprobar: false, motivo: 'no sirve' } })

const asignaciones = async (campanaId: string): Promise<{ sitio: string; creativos: any[] }[]> =>
  (await poolTest().query(
    `select s.nombre as sitio, r.creativos
       from reservas r join sitios s on s.id = r.sitio_id
      where r.campana_id = $1 order by s.nombre`,
    [campanaId],
  )).rows

// ─── Autoasignación del creativo único ──────────────────────────────────────

describe('1 · con UN solo creativo aprobado no hay nada que decidir', () => {
  it('se asigna solo a todas las pantallas, con los spots de cada una', async () => {
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 6 }, { id: sitioB, spots: 10 }] })
    const cr = await sembrarCreativo(camp, 'La única pieza')

    expect((await aprobar(cr)).status).toBe(200)

    const porSitio = Object.fromEntries((await asignaciones(camp)).map((f) => [f.sitio, f.creativos]))
    // `veces` no es 1 ni un número inventado: es el loop de CADA pantalla. Con
    // un solo creativo se lo lleva entero, y las pantallas no tienen los mismos
    // spots (M12) — copiar el mismo número a las dos dejaría una corta y la
    // otra pasada.
    expect(porSitio['Pantalla B']).toEqual([{ creatividadId: cr, veces: 10 }])
    expect(porSitio['Pantalla creativos']).toEqual([{ creatividadId: cr, veces: 6 }])
  })

  it('queda en la bitácora, a nombre de quien aprobó', async () => {
    // Cambia filas que el usuario no pidió tocar. Sin el apunte, «yo no puse
    // eso» no tiene respuesta.
    const camp = await sembrarCampana()
    await aprobar(await sembrarCreativo(camp, 'Con rastro'))
    // Filtrado por entidad: la bitácora es append-only y `beforeEach` no puede
    // vaciarla, así que los apuntes de las pruebas anteriores siguen ahí.
    const r = await poolTest().query(
      `select accion, entidad, usuario_nombre from acciones
        where accion ilike '%automáticamente%' and entidad = 'Con rastro'`,
    )
    expect(r.rows.length).toBe(1)
    expect(r.rows[0].accion).toContain('1 pantalla')
    expect(r.rows[0].entidad).toBe('Con rastro')
    expect(r.rows[0].usuario_nombre).not.toBe('Sistema')
  })

  // v0.12.3 · DECISIÓN DEL DUEÑO (22/10): «debe de ser autoseleccionable ya que
  // pueden ser varios creativos», y eligió que TODOS roten en partes iguales.
  // Hasta aquí la regla era «exactamente uno» y con dos o más no se tocaba nada;
  // estas dos pruebas fijaban ese comportamiento y se reescriben con el nuevo.
  it('al aprobar un SEGUNDO creativo, entra en la rotación de los spots que llenó el sistema', async () => {
    const camp = await sembrarCampana()
    const a = await sembrarCreativo(camp, 'Pieza A')
    const b = await sembrarCreativo(camp, 'Pieza B')
    await aprobar(a)
    await aprobar(b)
    expect((await asignaciones(camp))[0].creativos).toEqual([
      { creatividadId: a, veces: 3 },
      { creatividadId: b, veces: 3 },
    ])
  })

  it('con MENOS spots que creativos, todos entran y rotan: no hay que escribir «2 de 1»', async () => {
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 1 }] })
    const a = await sembrarCreativo(camp, 'Rota A')
    const b = await sembrarCreativo(camp, 'Rota B')
    await aprobar(a)
    await aprobar(b)
    expect((await asignaciones(camp))[0].creativos).toEqual([
      { creatividadId: a, veces: 1 },
      { creatividadId: b, veces: 1 },
    ])
  })

  it('un slot VACÍO —aunque se vaciara a mano— recibe todos los aprobados al aprobar el siguiente', async () => {
    // Era la prueba de «un slot vaciado a mano no se vuelve a llenar». Con la
    // regla nueva, el dueño eligió que un spot digital vacío reciba TODOS los
    // aprobados: vacío ya no es una decisión que se respete, es un hueco que se
    // llena. Lo que sigue sin pisarse es un reparto AJUSTADO a mano (abajo).
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 6 }, { id: sitioB, spots: 10 }] })
    const a = await sembrarCreativo(camp, 'Pieza A')
    const b = await sembrarCreativo(camp, 'Pieza B')
    await aprobar(a)
    const res = await poolTest().query(
      `select r.id from reservas r join sitios s on s.id=r.sitio_id
        where r.campana_id=$1 and s.nombre='Pantalla B'`,
      [camp],
    )
    await c.pedir(`/api/reservas/${res.rows[0].id}/creativo/`, { metodo: 'PATCH', cuerpo: { creativos: [] } })

    await aprobar(b)

    const porSitio = Object.fromEntries((await asignaciones(camp)).map((f) => [f.sitio, f.creativos]))
    expect(porSitio['Pantalla B']).toEqual([
      { creatividadId: a, veces: 5 },
      { creatividadId: b, veces: 5 },
    ])
    expect(porSitio['Pantalla creativos']).toEqual([
      { creatividadId: a, veces: 3 },
      { creatividadId: b, veces: 3 },
    ])
  })

  it('reemplazar uno PUBLICADO con DOOHmain sin responder: 502 y no se reemplaza nada', async () => {
    // v0.12.3 · antes el reemplazo seguía aunque DOOHmain no confirmara que
    // finalizó el arte viejo, y la pantalla decía «Arte reemplazado». En el
    // arnés el intérprete de DOOHmain no existe, así que retirar SIEMPRE falla:
    // es exactamente el caso.
    const camp = await sembrarCampana()
    const cr = await sembrarCreativo(camp, 'Ya publicado')
    await poolTest().query(
      `insert into doohmain_remote_campaigns (version, auth, name, anunciante) values ($1,'AUTH-PRUEBA','x','x')`,
      [cr],
    )
    const r = await c.pedir(`/api/creatividades/${cr}/`, {
      metodo: 'PUT', cuerpo: { nombre: 'Nuevo arte', codigo: '<p>Arte nuevo</p>', formato: 'HTML' },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(502)
    expect(r.datos.error).toMatch(/No se reemplazó nada/)
    const sigue = await poolTest().query('select nombre from creatividades where id=$1', [cr])
    expect(sigue.rows[0].nombre).toBe('Ya publicado')
  })

  it('reemplazar uno que NUNCA se publicó no pregunta a DOOHmain: se reemplaza', async () => {
    const camp = await sembrarCampana()
    const cr = await sembrarCreativo(camp, 'Nunca publicado')
    const r = await c.pedir(`/api/creatividades/${cr}/`, {
      metodo: 'PUT', cuerpo: { nombre: 'Arte nuevo', codigo: '<p>Arte nuevo</p>', formato: 'HTML' },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.nombre).toBe('Arte nuevo')
  })

  it('borrar o reemplazar con un id que no es uuid es 404 antes de tocar DOOHmain', async () => {
    expect((await c.pedir('/api/creatividades/no-es-uuid/', { metodo: 'DELETE' })).status).toBe(404)
    expect(
      (await c.pedir('/api/creatividades/00000000-0000-0000-0000-000000000000/', {
        metodo: 'PUT', cuerpo: { nombre: 'x', codigo: '<p>x</p>', formato: 'HTML' },
      })).status,
    ).toBe(404)
  })

  it('un reparto AJUSTADO a mano no se pisa al aprobar otro creativo', async () => {
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 6 }] })
    const a = await sembrarCreativo(camp, 'Pieza A')
    const b = await sembrarCreativo(camp, 'Pieza B')
    await aprobar(a)
    const res = await poolTest().query('select id from reservas where campana_id=$1', [camp])
    await c.pedir(`/api/reservas/${res.rows[0].id}/creativo/`, {
      metodo: 'PATCH', cuerpo: { creativos: [{ creatividadId: a, veces: 2 }] },
    })
    await aprobar(b)
    expect((await asignaciones(camp))[0].creativos).toEqual([{ creatividadId: a, veces: 2 }])
  })

  it('no pisa una asignación puesta a mano', async () => {
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 6 }, { id: sitioB, spots: 10 }] })
    const a = await sembrarCreativo(camp, 'Pieza A')
    await aprobar(a)
    // Se cambia a mano el reparto de una de las dos…
    const res = await poolTest().query(
      `select r.id from reservas r join sitios s on s.id=r.sitio_id where r.campana_id=$1 and s.nombre='Pantalla B'`,
      [camp],
    )
    await c.pedir(`/api/reservas/${res.rows[0].id}/creativo/`, {
      metodo: 'PATCH', cuerpo: { creativos: [{ creatividadId: a, veces: 3 }] },
    })
    // …y al aprobar otra vez el mismo creativo, ese 3 sobrevive.
    await aprobar(a)
    const filas = await asignaciones(camp)
    expect(filas.find((f) => f.sitio === 'Pantalla B')!.creativos).toEqual([{ creatividadId: a, veces: 3 }])
  })

  it('una campaña OOH no se toca', async () => {
    // El segmento fijo lleva lona y su trazabilidad va por la OT de montaje.
    const fijo = await poolTest().query(
      `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                           alcaldia, ciudad, tarifa_publicada, tarifa_mensual, predio_id, tenant_id, exhibicion)
       select 'Espectacular','CRE-003','CRE-PROV-003','ESPECTACULAR','DISPONIBLE','Cuauhtémoc','CDMX',
              45000,45000,predio_id,$1,'fijo' from sitios where id=$2 returning id`,
      [org.id, org.sitioId],
    )
    const camp = await sembrarCampana({ tipo: 'OOH', sitios: [{ id: fijo.rows[0].id, spots: null }] })
    await aprobar(await sembrarCreativo(camp, 'Lona'))
    expect((await asignaciones(camp))[0].creativos).toEqual([])
  })
})

// ─── El guard, en los DOS pasos ─────────────────────────────────────────────

describe('2 · no se publica una pantalla sin pieza', () => {
  it('enviar al dominio rebota, y NOMBRA la pantalla que falta', async () => {
    // Con la autoasignación puesta, llegar aquí exige que alguien haya VACIADO
    // un slot a mano — que es el camino que queda. Antes se llegaba solo.
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 6 }, { id: sitioB, spots: 10 }] })
    const a = await sembrarCreativo(camp, 'Pieza A')
    await aprobar(a)
    const res = await poolTest().query(
      `select r.id from reservas r join sitios s on s.id=r.sitio_id
        where r.campana_id=$1 and s.nombre='Pantalla B'`,
      [camp],
    )
    await c.pedir(`/api/reservas/${res.rows[0].id}/creativo/`, {
      metodo: 'PATCH', cuerpo: { creativos: [] },
    })

    const r = await c.pedir(`/api/campanas/${camp}/enviar-dominio/`, { cuerpo: {} })
    expect(r.status).toBe(409)
    // Nombrarlas importa: en una campaña de doce, «asigna los creativos» a
    // secas obliga a buscarlas una por una.
    expect(r.datos.error).toContain('Pantalla B')
    expect(r.datos.error).not.toContain('Pantalla creativos')
  })

  it('con todo asignado, pasa', async () => {
    const camp = await sembrarCampana()
    await aprobar(await sembrarCreativo(camp, 'La única'))
    const r = await c.pedir(`/api/campanas/${camp}/enviar-dominio/`, { cuerpo: {} })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
  })

  it('APROBAR también rebota si la asignación se perdió por el camino', async () => {
    // El hueco que quedaba: entre enviar y aprobar hay una revisión humana que
    // puede tardar días. Si en medio se rechaza el creativo —que se desasigna
    // solo—, aprobar publicaba una pantalla a oscuras.
    const camp = await sembrarCampana()
    const cr = await sembrarCreativo(camp, 'La única')
    await aprobar(cr)
    expect((await c.pedir(`/api/campanas/${camp}/enviar-dominio/`, { cuerpo: {} })).status).toBe(200)

    await rechazar(cr) // se desasigna solo

    const r = await c.pedir(`/api/campanas/${camp}/validar/`, { cuerpo: { aprobar: true } })
    expect(r.status).toBe(409)
    expect(r.datos.error).toContain('sin creativo aprobado asignado')
  })

  it('RECHAZAR la publicación no exige nada: se rechaza justo cuando algo falta', async () => {
    const camp = await sembrarCampana()
    const cr = await sembrarCreativo(camp, 'La única')
    await aprobar(cr)
    await c.pedir(`/api/campanas/${camp}/enviar-dominio/`, { cuerpo: {} })
    await rechazar(cr)
    const r = await c.pedir(`/api/campanas/${camp}/validar/`, { cuerpo: { aprobar: false, motivo: 'arte equivocado' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
  })

  it('una campaña OOH pasa sin pedir asignación ninguna', async () => {
    const fijo = await poolTest().query(
      `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                           alcaldia, ciudad, tarifa_publicada, tarifa_mensual, predio_id, tenant_id, exhibicion)
       select 'Espectacular 2','CRE-004','CRE-PROV-004','ESPECTACULAR','DISPONIBLE','Cuauhtémoc','CDMX',
              45000,45000,predio_id,$1,'fijo' from sitios where id=$2 returning id`,
      [org.id, org.sitioId],
    )
    const camp = await sembrarCampana({ tipo: 'OOH', sitios: [{ id: fijo.rows[0].id, spots: null }] })
    await sembrarCreativo(camp, 'Lona')
    const r = await c.pedir(`/api/campanas/${camp}/enviar-dominio/`, { cuerpo: {} })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
  })

  it('una HÍBRIDA solo exige su segmento digital', async () => {
    const fijo = await poolTest().query(
      `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                           alcaldia, ciudad, tarifa_publicada, tarifa_mensual, predio_id, tenant_id, exhibicion)
       select 'Espectacular 3','CRE-005','CRE-PROV-005','ESPECTACULAR','DISPONIBLE','Cuauhtémoc','CDMX',
              45000,45000,predio_id,$1,'fijo' from sitios where id=$2 returning id`,
      [org.id, org.sitioId],
    )
    const camp = await sembrarCampana({
      tipo: 'HIBRIDA',
      sitios: [{ id: org.sitioId, spots: 6 }, { id: fijo.rows[0].id, spots: null }],
    })
    // Un solo creativo → se autoasigna a la digital, y la fija se queda sin
    // nada a propósito. Aun así pasa.
    await aprobar(await sembrarCreativo(camp, 'La única'))
    const filas = await asignaciones(camp)
    expect(filas.find((f) => f.sitio.startsWith('Espectacular'))!.creativos).toEqual([])
    const r = await c.pedir(`/api/campanas/${camp}/enviar-dominio/`, { cuerpo: {} })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
  })
})

// ─── Lo que de verdad se le manda al CMS ────────────────────────────────────

describe('4 · la publicación manda a cada pantalla LO SUYO', () => {
  // El arnés enciende DOOHmain con un intérprete inexistente: cada intento
  // falla al arrancar el proceso, pero la fila del resultado ya se construyó
  // con el sitio, el creativo y los pases. Eso es lo que se inspecciona — la
  // respuesta del CMS no es lo que este cambio toca.
  async function publicar(campanaId: string) {
    await c.pedir(`/api/campanas/${campanaId}/enviar-dominio/`, { cuerpo: {} })
    const r = await c.pedir(`/api/campanas/${campanaId}/validar/`, { cuerpo: { aprobar: true } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    return (r.datos.doohmain ?? []) as any[]
  }

  it('una pieza por pantalla, con los pases de ESA pantalla', async () => {
    // Antes esto mandaba el producto cruzado y `cantDia` era el total de la
    // pantalla PARA CADA creativo: dos piezas en una de 8 pedían 16 pases en un
    // loop de 8. Ahora `veces` manda.
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 6 }, { id: sitioB, spots: 10 }] })
    const cr = await sembrarCreativo(camp, 'La única')
    await aprobar(cr)

    const res = await publicar(camp)
    expect(res.length).toBe(2)
    const porSitio = Object.fromEntries(res.map((r) => [r.sitio, r]))
    expect(porSitio[CLAVE_A].cantDia).toBe(6)
    expect(porSitio[CLAVE_B].cantDia).toBe(10)
    for (const r of res) expect(r.creativoId).toBe(cr)
  })

  it('con dos piezas repartidas, cada una lleva SU parte del loop', async () => {
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 6 }] })
    const a = await sembrarCreativo(camp, 'Pieza A')
    const b = await sembrarCreativo(camp, 'Pieza B')
    await aprobar(a); await aprobar(b)
    const res = await poolTest().query('select id from reservas where campana_id=$1', [camp])
    await c.pedir(`/api/reservas/${res.rows[0].id}/creativo/`, {
      metodo: 'PATCH',
      cuerpo: { creativos: [{ creatividadId: a, veces: 4 }, { creatividadId: b, veces: 2 }] },
    })

    const out = await publicar(camp)
    // Dos envíos a la MISMA pantalla, uno por pieza, y los pases suman el loop
    // —no lo doblan—.
    expect(out.length).toBe(2)
    expect(out.reduce((s, r) => s + (r.cantDia ?? 0), 0)).toBe(6)
    expect(new Set(out.map((r) => r.creativoId))).toEqual(new Set([a, b]))
    expect(new Set(out.map((r) => r.sitio))).toEqual(new Set([CLAVE_A]))
  })

  it('una pieza NO asignada a una pantalla no se le manda', async () => {
    // El corazón del hallazgo: antes iban todas a todas.
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 6 }, { id: sitioB, spots: 10 }] })
    const a = await sembrarCreativo(camp, 'Pieza A')
    const b = await sembrarCreativo(camp, 'Pieza B')
    // v0.12.3 · al aprobar B ya rota con A en las dos (decisión del dueño), así
    // que la asignación se fija A MANO en cada una: la regla que esto vigila —una
    // pieza que no está asignada a una pantalla no se le manda— no cambió.
    await aprobar(a); await aprobar(b)
    const res = await poolTest().query(
      `select r.id, s.nombre from reservas r join sitios s on s.id=r.sitio_id where r.campana_id=$1`, [camp],
    )
    const reservaDe = (nombre: string) => res.rows.find((r) => r.nombre === nombre).id
    await c.pedir(`/api/reservas/${reservaDe('Pantalla creativos')}/creativo/`, {
      metodo: 'PATCH', cuerpo: { creativos: [{ creatividadId: a, veces: 6 }] },
    })
    await c.pedir(`/api/reservas/${reservaDe('Pantalla B')}/creativo/`, {
      metodo: 'PATCH', cuerpo: { creativos: [{ creatividadId: b, veces: 10 }] },
    })

    const out = await publicar(camp)
    const porSitio = Object.fromEntries(out.map((r) => [r.sitio, r]))
    expect(porSitio[CLAVE_A].creativoId).toBe(a)
    expect(porSitio[CLAVE_B].creativoId).toBe(b)
    expect(out.length).toBe(2)
  })

  it('sin programación diaria contratada NO dicta una cuota', async () => {
    // Las 16 reservas digitales de producción tienen `spots_por_dia` en NULL:
    // no hay pauta pactada, y hasta hoy la bandera `--cant-dia` no se mandaba,
    // así que el CMS ponía los pases que cupieran.
    //
    // La asignación guarda `veces: 1` ahí como marca de «esta pieza va aquí».
    // Si ese 1 viajara como cuota, esas campañas pasarían de la pauta completa
    // a UN pase al día — una caída de exhibición de la que nadie se enteraría
    // hasta ver el proof of play.
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: null }] })
    const cr = await sembrarCreativo(camp, 'Sin pauta diaria')
    await aprobar(cr)

    const out = await publicar(camp)
    expect(out.length).toBe(1)
    expect(out[0].creativoId).toBe(cr)
    expect(out[0].cantDia).toBeNull()
  })

  // 22/10 · lo demás que DOOHmain recibe: el total del periodo y, SOLO si la
  // campaña tiene franja, su horario. Pedido del dueño: «la franja de tiempo
  // solo la debe de mandar si es que tiene una; si no, mandamos lo que
  // actualmente se manda». La regla está en `lib/doohmain-programacion.ts`;
  // aquí se fija que el SQL encuentra la franja correcta.
  const diasDe = async (campanaId: string) => {
    const r = await poolTest().query(
      `select to_char(fecha_inicio,'YYYY-MM-DD') fi, to_char(fecha_fin,'YYYY-MM-DD') ff from campanas where id=$1`,
      [campanaId],
    )
    return diasDeCampana(r.rows[0].fi, r.rows[0].ff)
  }
  const franja = async (nombre: string, inicio: string, fin: string) =>
    (await poolTest().query(
      `insert into franjas_horarias (tenant_id, nombre, hora_inicio, hora_fin) values ($1,$2,$3,$4) returning id`,
      [org.id, nombre, inicio, fin],
    )).rows[0].id as string

  it('sin franja: el horario NO viaja, y sí el total del periodo', async () => {
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 6 }] })
    await aprobar(await sembrarCreativo(camp, 'Sin franja'))
    const [r] = await publicar(camp)
    expect(r.horaInicio).toBeNull()
    expect(r.horaFin).toBeNull()
    expect(r.cantDia).toBe(6)
    expect(r.cantTotal).toBe(6 * (await diasDe(camp)))
  })

  it('con franja PROGRAMADA en la campaña: viaja su horario', async () => {
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 8 }] })
    const prime = await franja('Prime programada', '18:00', '22:00')
    await poolTest().query('update campanas set franja_programada_id=$1 where id=$2', [prime, camp])
    await aprobar(await sembrarCreativo(camp, 'Con franja programada'))
    const [r] = await publicar(camp)
    expect([r.horaInicio, r.horaFin]).toEqual(['18:00', '22:00'])
    expect(r.cantTotal).toBe(8 * (await diasDe(camp)))
  })

  it('la VISTA PREVIA enseña lo mismo que luego se publica, sin publicar nada', async () => {
    // Pedido del dueño (22/10): ver la franja y las repeticiones en la campaña
    // ANTES de subirla. Sale de la misma consulta que publica (`leerPlan()`); si
    // algún día se separaran, esta prueba es la que lo nota.
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 5 }] })
    const tarde = await franja('Tarde vista previa', '15:00', '19:00')
    await poolTest().query('update campanas set franja_programada_id=$1 where id=$2', [tarde, camp])
    await aprobar(await sembrarCreativo(camp, 'Antes de publicar'))

    const v = await c.pedir(`/api/campanas/${camp}/programacion-doohmain/`)
    expect(v.status).toBe(200)
    expect(v.datos.filas).toHaveLength(1)
    const [f] = v.datos.filas
    expect(f.creativoNombre).toBe('Antes de publicar')
    expect([f.programacion.horaInicio, f.programacion.horaFin]).toEqual(['15:00', '19:00'])
    expect(f.programacion.cantDia).toBe(5)
    expect(v.datos.cliente.nombre).toBeTruthy()

    const [r] = await publicar(camp)
    expect([r.horaInicio, r.horaFin, r.cantDia, r.cantTotal]).toEqual([
      f.programacion.horaInicio, f.programacion.horaFin, f.programacion.cantDia, f.programacion.cantTotal,
    ])
  })

  it('el horario INDIVIDUAL de una campaña SIN franja viaja, con sus días', async () => {
    // Pedido del dueño (22/10, noche): una franja de tiempo individual en la
    // campaña que se mande a DOOHmain.
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 3 }] })
    await aprobar(await sembrarCreativo(camp, 'Con horario individual'))

    const h = await c.pedir(`/api/campanas/${camp}/horario-doohmain/`, {
      metodo: 'PATCH', cuerpo: { horario: { horaInicio: '07:30', horaFin: '09:00', dias: [5, 1, 3] } },
    })
    expect(h.status, JSON.stringify(h.datos)).toBe(200)

    const v = await c.pedir(`/api/campanas/${camp}/programacion-doohmain/`)
    expect(v.datos.horarioIndividual).toEqual({ horaInicio: '07:30', horaFin: '09:00', dias: [1, 3, 5] })
    expect(v.datos.franjaCampana).toBeNull()
    const [r] = await publicar(camp)
    expect([r.horaInicio, r.horaFin]).toEqual(['07:30', '09:00'])

    // Quitarlo devuelve a «todo el día».
    expect((await c.pedir(`/api/campanas/${camp}/horario-doohmain/`, { metodo: 'PATCH', cuerpo: { horario: null } })).status).toBe(200)
    const v2 = await c.pedir(`/api/campanas/${camp}/programacion-doohmain/`)
    expect(v2.datos.horarioIndividual).toBeNull()
    expect(v2.datos.filas[0].programacion.horaInicio).toBeNull()
  })

  // 23/10 · regla del dueño: «si la campaña ya tiene franja de horario no debe
  // de tener la opción de añadir otra opción de horario». Hasta el 22/10 el
  // individual se ponía encima de la franja y ganaba.
  it('con franja PROGRAMADA no se le pone otro horario: 409 que la nombra, y no se guarda nada', async () => {
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 3 }] })
    const prog = await franja('Prime que manda', '18:00', '22:00')
    await poolTest().query('update campanas set franja_programada_id=$1 where id=$2', [prog, camp])
    await aprobar(await sembrarCreativo(camp, 'Con franja programada y sin otro'))

    const h = await c.pedir(`/api/campanas/${camp}/horario-doohmain/`, {
      metodo: 'PATCH', cuerpo: { horario: { horaInicio: '07:30', horaFin: '09:00' } },
    })
    expect(h.status).toBe(409)
    expect(h.datos.error).toMatch(/ya tiene franja horaria \(Prime que manda, 18:00 a 22:00\)/)

    const v = await c.pedir(`/api/campanas/${camp}/programacion-doohmain/`)
    expect(v.datos.horarioIndividual).toBeNull()
    expect(v.datos.franjaCampana).toEqual({ nombre: 'Prime que manda', horaInicio: '18:00', horaFin: '22:00', origen: 'programada' })
    const [r] = await publicar(camp)
    expect([r.horaInicio, r.horaFin]).toEqual(['18:00', '22:00'])
  })

  it('con franja CONTRATADA en una pantalla tampoco', async () => {
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 3 }] })
    const manana = await franja('Mañana que manda', '07:00', '10:00')
    await poolTest().query('update reservas set franja_id=$1 where campana_id=$2', [manana, camp])
    const h = await c.pedir(`/api/campanas/${camp}/horario-doohmain/`, {
      metodo: 'PATCH', cuerpo: { horario: { horaInicio: '12:00', horaFin: '13:00' } },
    })
    expect(h.status).toBe(409)
    const v = await c.pedir(`/api/campanas/${camp}/programacion-doohmain/`)
    expect(v.datos.franjaCampana).toMatchObject({ nombre: 'Mañana que manda', origen: 'contratada' })
  })

  it('la franja de una reserva CANCELADA no cuenta', async () => {
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 3 }] })
    const vieja = await franja('De una reserva cancelada', '07:00', '10:00')
    await poolTest().query(`update reservas set franja_id=$1, estatus='CANCELADA' where campana_id=$2`, [vieja, camp])
    const h = await c.pedir(`/api/campanas/${camp}/horario-doohmain/`, {
      metodo: 'PATCH', cuerpo: { horario: { horaInicio: '12:00', horaFin: '13:00' } },
    })
    expect(h.status, JSON.stringify(h.datos)).toBe(200)
  })

  it('una campaña que ya tenía los DOS, de antes de la regla, puede quitar el individual y queda la franja', async () => {
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 3 }] })
    const prog = await franja('Programada de antes', '18:00', '22:00')
    await poolTest().query(
      `update campanas set franja_programada_id=$1, doohmain_hora_inicio='07:30', doohmain_hora_fin='09:00' where id=$2`,
      [prog, camp],
    )
    await aprobar(await sembrarCreativo(camp, 'Con los dos de antes'))
    expect((await c.pedir(`/api/campanas/${camp}/horario-doohmain/`, { metodo: 'PATCH', cuerpo: { horario: null } })).status).toBe(200)
    const [r] = await publicar(camp)
    expect([r.horaInicio, r.horaFin]).toEqual(['18:00', '22:00'])
  })

  it('el horario individual: lo que no se acepta', async () => {
    const camp = await sembrarCampana()
    const patch = (cuerpo: unknown) => c.pedir(`/api/campanas/${camp}/horario-doohmain/`, { metodo: 'PATCH', cuerpo })
    expect((await patch({ horario: { horaInicio: '7:30', horaFin: '09:00' } })).status).toBe(400)
    expect((await patch({ horario: { horaInicio: '09:00', horaFin: '09:00' } })).status).toBe(400)
    expect((await patch({ horario: { horaInicio: '07:30', horaFin: '09:00', dias: [7] } })).status).toBe(400)
    expect((await patch({ horario: { horaInicio: '07:30', horaFin: '09:00' }, extra: 1 })).status).toBe(400)
    expect((await c.pedir('/api/campanas/no-es-uuid/horario-doohmain/', { metodo: 'PATCH', cuerpo: { horario: null } })).status).toBe(404)
    // Y la base lo vuelve a exigir aunque alguien se salte la API.
    await expect(
      poolTest().query(`update campanas set doohmain_hora_inicio='07:30', doohmain_hora_fin=null where id=$1`, [camp]),
    ).rejects.toThrow(/campanas_doohmain_horario_par_ck/)
  })

  it('la vista previa: un id que no es uuid, o una campaña que no existe, es 404', async () => {
    expect((await c.pedir('/api/campanas/no-es-uuid/programacion-doohmain/')).status).toBe(404)
    expect((await c.pedir('/api/campanas/00000000-0000-0000-0000-000000000000/programacion-doohmain/')).status).toBe(404)
  })

  it('sin programada, la CONTRATADA de la pantalla; y la programada gana si hay las dos', async () => {
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 4 }] })
    const manana = await franja('Mañana contratada', '07:00', '10:00')
    await poolTest().query('update reservas set franja_id=$1 where campana_id=$2', [manana, camp])
    await aprobar(await sembrarCreativo(camp, 'Con franja contratada'))
    let [r] = await publicar(camp)
    expect([r.horaInicio, r.horaFin]).toEqual(['07:00', '10:00'])

    const noche = await franja('Noche programada', '20:00', '23:00')
    await poolTest().query('update campanas set franja_programada_id=$1 where id=$2', [noche, camp])
    const re = await c.pedir(`/api/campanas/${camp}/reintentar-publicacion/`, { cuerpo: {} })
    expect(re.status, JSON.stringify(re.datos)).toBe(200)
    ;[r] = re.datos.doohmain
    expect([r.horaInicio, r.horaFin]).toEqual(['20:00', '23:00'])
  })

  it('NO manda al aire una pieza que no está aprobada, aunque figure asignada', async () => {
    // Defensa en profundidad, y se prueba forzando el estado a mano porque el
    // flujo normal no lo produce: rechazar, reemplazar o retirar un creativo lo
    // desasignan. Si alguna vez esas tres se desalinearan —o alguien tocara la
    // base—, lo que NO puede pasar es que salga al aire arte que nadie revisó.
    // Y la pantalla no se omite en silencio: se reporta como hueco.
    const camp = await sembrarCampana()
    const cr = await sembrarCreativo(camp, 'Aprobada y luego no')
    await aprobar(cr)
    // Se envía al dominio ANTES de romper el estado: si no, `validar` rebotaría
    // por «no se ha enviado» y la prueba pasaría por el motivo equivocado.
    expect((await c.pedir(`/api/campanas/${camp}/enviar-dominio/`, { cuerpo: {} })).status).toBe(200)
    await poolTest().query(
      `update creatividades set estatus_validacion='PENDIENTE' where id=$1`, [cr],
    )

    const r = await c.pedir(`/api/campanas/${camp}/validar/`, { cuerpo: { aprobar: true } })
    // El guard de aprobación lo caza antes incluso de publicar: para él, un slot
    // cuya única pieza no está aprobada está tan vacío como uno sin nada.
    expect(r.status).toBe(409)
    expect(r.datos.error).toContain('sin creativo aprobado asignado')
  })

  it('una campaña OOH no manda nada al CMS', async () => {
    const fijo = await poolTest().query(
      `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                           alcaldia, ciudad, tarifa_publicada, tarifa_mensual, predio_id, tenant_id, exhibicion)
       select 'Espectacular 4','CRE-006','CRE-PROV-006','ESPECTACULAR','DISPONIBLE','Cuauhtémoc','CDMX',
              45000,45000,predio_id,$1,'fijo' from sitios where id=$2 returning id`,
      [org.id, org.sitioId],
    )
    const camp = await sembrarCampana({ tipo: 'OOH', sitios: [{ id: fijo.rows[0].id, spots: null }] })
    await sembrarCreativo(camp, 'Lona')
    expect(await publicar(camp)).toEqual([])
  })
})

// ─── Al rechazar, se desasigna solo lo suyo ─────────────────────────────────

describe('3 · rechazar un creativo no toca las campañas de al lado', () => {
  it('desasigna en SU campaña y deja intacta la otra', async () => {
    // El `update` iba sin `where`: reescribía la columna `creativos` de TODAS
    // las reservas del tenant en cada rechazo. Salía igual, pero era una
    // escritura masiva sobre filas ajenas en cada clic.
    const campA = await sembrarCampana()
    const campB = await sembrarCampana({ sitios: [{ id: sitioB, spots: 10 }] })
    const crA = await sembrarCreativo(campA, 'Pieza de A')
    const crB = await sembrarCreativo(campB, 'Pieza de B')
    await aprobar(crA)
    await aprobar(crB)

    await rechazar(crA)

    expect((await asignaciones(campA))[0].creativos).toEqual([])
    expect((await asignaciones(campB))[0].creativos).toEqual([{ creatividadId: crB, veces: 10 }])
  })
})

// ─── Reintentar la publicación ya aprobada ──────────────────────────────────

describe('5 · reintentar la publicación en DOOHmain', () => {
  // Pedido por el dueño el 13/10. Aprobada la publicación, la ficha no ofrecía
  // ningún botón: si DOOHmain fallaba —tablas rotas, una pantalla sin mapa, la
  // red—, no había forma de volver a mandarla. El reintento SOLO publica: no
  // toca estado, fechas ni el candado de facturación, que ya decidió `validar`.
  const reintentar = (campanaId: string, cli = c) =>
    cli.pedir(`/api/campanas/${campanaId}/reintentar-publicacion/`, { cuerpo: {} })

  async function aprobada(): Promise<string> {
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 6 }, { id: sitioB, spots: 10 }] })
    await aprobar(await sembrarCreativo(camp, 'La única'))
    expect((await c.pedir(`/api/campanas/${camp}/enviar-dominio/`, { cuerpo: {} })).status).toBe(200)
    expect((await c.pedir(`/api/campanas/${camp}/validar/`, { cuerpo: { aprobar: true } })).status).toBe(200)
    return camp
  }

  it('vuelve a mandar cada pantalla y devuelve el resultado de cada una', async () => {
    const camp = await aprobada()
    const r = await reintentar(camp)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(new Set(r.datos.doohmain.map((f: any) => f.sitio))).toEqual(new Set([CLAVE_A, CLAVE_B]))
  })

  it('no cambia el estado, la aprobación ni el candado de facturación', async () => {
    const camp = await aprobada()
    const antes = (await poolTest().query(
      `select estado_comercial, validacion_estatus, validacion_en, validacion_por, reporte_publicacion
         from campanas where id=$1`, [camp])).rows[0]
    await reintentar(camp)
    const despues = (await poolTest().query(
      `select estado_comercial, validacion_estatus, validacion_en, validacion_por, reporte_publicacion
         from campanas where id=$1`, [camp])).rows[0]
    expect(despues).toEqual(antes)
  })

  it('queda en Actividad, nombrando las pantallas que fallaron', async () => {
    const camp = await aprobada()
    await reintentar(camp)
    // En el arnés el intérprete no existe: las dos pantallas fallan.
    const r = await poolTest().query(
      `select accion from acciones where accion like 'Reintento de publicación en DOOHmain%' order by timestamp desc limit 1`,
    )
    expect(r.rows[0]?.accion).toContain(CLAVE_A)
    expect(r.rows[0]?.accion).toContain(CLAVE_B)
  })

  it('una campaña cuya publicación NO está aprobada rebota: primero se aprueba', async () => {
    const camp = await sembrarCampana()
    await aprobar(await sembrarCreativo(camp, 'La única'))
    await c.pedir(`/api/campanas/${camp}/enviar-dominio/`, { cuerpo: {} })
    const r = await reintentar(camp)
    expect(r.status).toBe(409)
    expect(r.datos.error).toContain('aprobada')
  })

  it('también exige que cada pantalla tenga su pieza, como aprobar', async () => {
    const camp = await aprobada()
    const res = await poolTest().query(
      `select r.id from reservas r join sitios s on s.id=r.sitio_id where r.campana_id=$1 and s.nombre='Pantalla B'`,
      [camp],
    )
    await c.pedir(`/api/reservas/${res.rows[0].id}/creativo/`, { metodo: 'PATCH', cuerpo: { creativos: [] } })
    const r = await reintentar(camp)
    expect(r.status).toBe(409)
    expect(r.datos.error).toContain('Pantalla B')
  })

  it('sin permiso de comercial, 403; y la de otra organización no existe', async () => {
    const camp = await aprobada()
    const imprenta = await sembrarTenant('reintento-imprenta', { rol: 'IMPRENTA' })
    const ci = new Cliente()
    await ci.entrar(imprenta.usuarioEmail, PASSWORD_DEMO)
    expect((await reintentar(camp, ci)).status).toBe(403)

    const ajena = await sembrarTenant('reintento-ajena')
    const ca = new Cliente()
    await ca.entrar(ajena.usuarioEmail, PASSWORD_DEMO)
    expect((await reintentar(camp, ca)).status).toBe(404)
  })
})

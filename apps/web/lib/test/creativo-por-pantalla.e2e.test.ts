import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

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

  it('al aprobar un SEGUNDO creativo, el primero conserva su sitio y el nuevo no entra solo', async () => {
    // Consecuencia deliberada, y conviene tenerla escrita porque no es obvia.
    //
    // Cuando se aprobó A era el único, así que ocupar el loop entero era la
    // única respuesta posible. Al aprobar B la situación pasa a ser ambigua —
    // qué pieza en qué pantalla y con cuántos pases— y ahí el sistema NO
    // decide: ni adivina un reparto ni deshace el de A. Borrar lo de A para
    // «dejarlo neutro» destruiría una asignación que era correcta, y repartir
    // a medias entre las dos sería inventar una decisión de negocio.
    //
    // OJO CON EL EFECTO: B se queda sin salir en ninguna pantalla, y ya no como
    // antes, cuando la publicación mandaba todo a todas partes. Quien apruebe
    // una segunda pieza tiene que asignarla; la pantalla de Creativos lo enseña
    // slot a slot con su contador de spots usados.
    const camp = await sembrarCampana()
    const a = await sembrarCreativo(camp, 'Pieza A')
    const b = await sembrarCreativo(camp, 'Pieza B')
    await aprobar(a)
    await aprobar(b)
    expect((await asignaciones(camp))[0].creativos).toEqual([{ creatividadId: a, veces: 6 }])
  })

  it('un slot VACIADO a mano no se vuelve a llenar solo al aprobar otra pieza', async () => {
    // Vaciar un slot es una decisión: «esta pantalla, por ahora, no lleva
    // nada». Si al aprobar la siguiente pieza el sistema lo rellenara, estaría
    // deshaciendo esa decisión en silencio — y como ya hay dos aprobadas, ni
    // siquiera sabría cuál poner. La regla es «exactamente uno», no «al menos
    // uno», y esta prueba es la que lo distingue.
    const camp = await sembrarCampana({ sitios: [{ id: org.sitioId, spots: 6 }, { id: sitioB, spots: 10 }] })
    const a = await sembrarCreativo(camp, 'Pieza A')
    const b = await sembrarCreativo(camp, 'Pieza B')
    await aprobar(a) // autoasigna A a las dos
    const res = await poolTest().query(
      `select r.id from reservas r join sitios s on s.id=r.sitio_id
        where r.campana_id=$1 and s.nombre='Pantalla B'`,
      [camp],
    )
    await c.pedir(`/api/reservas/${res.rows[0].id}/creativo/`, { metodo: 'PATCH', cuerpo: { creativos: [] } })

    await aprobar(b) // ya hay DOS aprobadas: no debe tocar nada

    const porSitio = Object.fromEntries((await asignaciones(camp)).map((f) => [f.sitio, f.creativos]))
    expect(porSitio['Pantalla B']).toEqual([])
    expect(porSitio['Pantalla creativos']).toEqual([{ creatividadId: a, veces: 6 }])
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
    await aprobar(a); await aprobar(b) // A queda en las dos por autoasignación
    const res = await poolTest().query(
      `select r.id from reservas r join sitios s on s.id=r.sitio_id
        where r.campana_id=$1 and s.nombre='Pantalla B'`, [camp],
    )
    // En la B se cambia A por B.
    await c.pedir(`/api/reservas/${res.rows[0].id}/creativo/`, {
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

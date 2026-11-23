import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest, poolApp } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'

// ============================================================================
//  ENVIO-CLIENTE (18/11) · el cliente manda su creativo desde la liga y NO es
//  creativo hasta que un Dueño o Administrador lo aprueba en la ficha.
//  Contra Postgres y Next reales.
//
//   · La ruta pública escribe SOLO en `envios_creativo_cliente`: la cuenta de
//     `creatividades` no se mueve.
//   · Negativos de la puerta pública: token inventado o mal formado (404),
//     propuesta sin campaña (409), tipo (400), tamaño (413), bytes que no son
//     lo que dicen (422), pantalla ajena (400), tope del día (429).
//   · R2: el token y la sesión de OTRA organización no ven ni tocan el envío,
//     y la RLS lo esconde también al rol de la aplicación directo.
//   · Solo Dueño y Administrador revisan: un VENDEDOR recibe 403.
//   · Aprobar crea el creativo YA APROBADO en la campaña y el tenant correctos,
//     borra el envío y, con la publicación aprobada, publica por el camino de
//     «Volver a publicar» (DOOHmain simulado por el arnés: el binario no existe).
//   · Rechazar deja el motivo para la liga y BORRA el archivo.
// ============================================================================

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

// Un PNG con la cabecera de la medida que se pida: la validación de contenido
// mira la firma, y la de proporción lee el ancho y el alto de IHDR. Así se
// prueba la regla sin cargar imágenes de megas.
function pngDe(w: number, h: number): string {
  const b = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12, 'ascii')
  b.writeUInt32BE(w, 16)
  b.writeUInt32BE(h, 20)
  b[24] = 8
  b[25] = 6
  return `data:image/png;base64,${b.toString('base64')}`
}
const VERTICAL = pngDe(1080, 1920)

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente
let duenoBeta: Cliente
let vendedor: Cliente
let sitioB: string
let ipN = 0

/** Cada petición pública con su propia IP: el límite por IP no es lo que se prueba aquí. */
async function enviar(token: string, cuerpo: unknown, ip?: string) {
  ipN += 1
  const r = await fetch(`${BASE}/api/propuestas/publica/${token}/creativos/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip ?? `10.77.${Math.floor(ipN / 200)}.${ipN % 200}` },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  })
  const texto = await r.text()
  let datos: any = null
  try { datos = JSON.parse(texto) } catch { datos = texto }
  return { status: r.status, datos, texto }
}

async function seguimiento(token: string) {
  const r = await fetch(`${BASE}/api/propuestas/publica/${token}/seguimiento/`)
  return (await r.json()) as any
}

const contar = async (sql: string, params: unknown[] = []) => Number((await poolTest().query(sql, params)).rows[0].n)
const creatividades = () => contar('select count(*)::int as n from creatividades')

/** Una propuesta con su token y, si se pide, la campaña que nació de ella (sembrada). */
async function propuesta(c: Cliente, org: Awaited<ReturnType<typeof sembrarTenant>>, nombre: string) {
  const r = await c.pedir('/api/propuestas/', {
    cuerpo: {
      clienteId: org.clienteId,
      nombre,
      fechaInicio: enDias(7),
      fechaFin: enDias(37),
      items: [{
        sitioId: org.sitioId, precio: 45000, unidad: 'mensual', tarifaUnitaria: 45000, cantidad: 1,
        rentaMonto: 20000, rentaPeriodicidad: 'MENSUAL', rentaInicio: enDias(0),
      }],
    },
  })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  return { id: r.datos.id as string, token: r.datos.tokenPublico as string }
}

async function campanaDe(
  org: Awaited<ReturnType<typeof sembrarTenant>>,
  propuestaId: string,
  opts: { tipo?: string; sitios?: string[]; inicio?: string; estado?: string } = {},
): Promise<string> {
  const r = await poolTest().query(
    `insert into campanas (nombre, cliente_id, tipo_campana, fecha_inicio, fecha_fin,
                           estado_comercial, propuesta_id, tenant_id)
     values ('Campaña del cliente',$1,$2::tipo_campana,$3,$4,$5,$6,$7) returning id`,
    [org.clienteId, opts.tipo ?? 'DOOH', opts.inicio ?? enDias(7), enDias(37), opts.estado ?? 'CONFIRMADA', propuestaId, org.id],
  )
  const id = r.rows[0].id as string
  for (const s of opts.sitios ?? [org.sitioId]) {
    await poolTest().query(
      `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio,
                             estatus, spots_reservados, spots_por_dia, tenant_id)
       values ($1,$2,$3,$4,45000,'CONFIRMADA',6,6,$5)`,
      [id, s, opts.inicio ?? enDias(7), enDias(37), org.id],
    )
  }
  return id
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('envalfa')
  beta = await sembrarTenant('envbeta')
  const p = await poolTest().query('select predio_id from sitios where id=$1', [alfa.sitioId])
  const s = await poolTest().query(
    `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                         alcaldia, ciudad, total_spots, tarifa_publicada, tarifa_mensual,
                         predio_id, tenant_id, exhibicion, resolucion_px)
     values ('Pantalla Vertical','ENVALFA-002','ENVALFA-PROV-002','PANTALLA_DIGITAL','DISPONIBLE','Cuauhtémoc','CDMX',
             12,45000,45000,$1,$2,'digital','1080x1920') returning id`,
    [p.rows[0].predio_id, alfa.id],
  )
  sitioB = s.rows[0].id
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ('Vendedora','vendedora@envalfa.test','VENDEDOR',$1,true,$2)`,
    [await bcrypt.hash(PASSWORD_DEMO, 4), alfa.id],
  )
  await arrancarServidor()
  dueno = new Cliente()
  duenoBeta = new Cliente()
  vendedor = new Cliente()
  await dueno.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await duenoBeta.entrar(beta.usuarioEmail, PASSWORD_DEMO)
  await vendedor.entrar('vendedora@envalfa.test', PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

let prop: { id: string; token: string }
let camp: string

describe('1 · la puerta pública', () => {
  it('token inventado o mal formado: 404', async () => {
    expect((await enviar('a'.repeat(32), { archivo: PNG })).status).toBe(404)
    expect((await enviar('mal..formado', { archivo: PNG })).status).toBe(404)
  })

  it('propuesta que todavía no es campaña: 409, y nada guardado', async () => {
    const p = await propuesta(dueno, alfa, 'Sin campaña todavía')
    const r = await enviar(p.token, { archivo: PNG, nombre: 'arte.png' })
    expect(r.status, r.texto).toBe(409)
    expect(await contar('select count(*)::int as n from envios_creativo_cliente')).toBe(0)
  })

  it('tipo no permitido 400, demasiado grande 413, bytes falsos 422', async () => {
    prop = await propuesta(dueno, alfa, 'Con campaña')
    camp = await campanaDe(alfa, prop.id, { sitios: [alfa.sitioId, sitioB] })
    const base = { nombre: 'x', sitioId: alfa.sitioId }
    expect((await enviar(prop.token, { ...base, archivo: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' })).status).toBe(400)
    expect((await enviar(prop.token, { ...base, archivo: 'data:application/pdf;base64,JVBERi0=' })).status).toBe(400)
    expect((await enviar(prop.token, { ...base, archivo: 'https://ejemplo.com/a.png' })).status).toBe(400)
    const grande = 'data:image/png;base64,' + 'A'.repeat(Math.ceil((4 * 1024 * 1024 * 4) / 3) + 400)
    expect((await enviar(prop.token, { ...base, archivo: grande })).status).toBe(413)
    const falso = 'data:image/png;base64,' + Buffer.from('esto no es un png de verdad').toString('base64')
    expect((await enviar(prop.token, { ...base, archivo: falso })).status).toBe(422)
    expect((await enviar(prop.token, '{no es json')).status).toBe(400)
    expect(await contar('select count(*)::int as n from envios_creativo_cliente')).toBe(0)
  })

  it('con dos pantallas hay que elegir, y solo una de ESA campaña', async () => {
    expect((await enviar(prop.token, { archivo: PNG, nombre: 'a.png' })).status).toBe(400)
    // La pantalla de OTRA organización (y una que no es de la campaña) no vale.
    expect((await enviar(prop.token, { archivo: PNG, nombre: 'a.png', sitioId: beta.sitioId })).status).toBe(400)
  })

  it('el envío bueno: 201 mínimo, PENDIENTE en su campaña y tenant, y NINGÚN creativo', async () => {
    const antes = await creatividades()
    const r = await enviar(
      prop.token,
      // El navegador dice 10×10; manda la cabecera del archivo (1080×1920).
      { archivo: VERTICAL, nombre: '../../etc/arte "final".png', sitioId: sitioB, ancho: 10, alto: 10 },
      '201.141.22.87',
    )
    expect(r.status, r.texto).toBe(201)
    expect(r.datos).toEqual({ ok: true, nombre: 'arte final .png', estatus: 'PENDIENTE' })
    // Nada interno en la respuesta.
    expect(r.texto).not.toContain(camp)
    expect(r.texto).not.toContain(alfa.id)
    expect(await creatividades()).toBe(antes)

    const fila = (await poolTest().query('select * from envios_creativo_cliente')).rows
    expect(fila).toHaveLength(1)
    expect(fila[0]).toMatchObject({
      campana_id: camp,
      tenant_id: alfa.id,
      sitio_id: sitioB,
      estatus: 'PENDIENTE',
      tipo_mime: 'image/png',
      ancho_px: 1080,
      alto_px: 1920,
      ip_truncada: '201.141.22.0',
    })
    expect(fila[0].contenido).toBe(VERTICAL)
    // El equipo se entera: aviso en la campana y renglón de bitácora.
    expect(await contar(`select count(*)::int as n from notificaciones where tenant_id=$1 and link=$2`, [alfa.id, `/campanas/${camp}`])).toBe(1)
    expect(await contar(`select count(*)::int as n from acciones where tenant_id=$1 and usuario_nombre='Cliente (liga pública)'`, [alfa.id])).toBe(1)
  })

  it('la liga lo enseña «en revisión», sin nada interno', async () => {
    const s = await seguimiento(prop.token)
    expect(s.seguimiento.puedeSubirCreativo).toBe(true)
    expect(s.seguimiento.envios).toEqual([
      expect.objectContaining({ nombre: 'arte final .png', estatus: 'PENDIENTE', motivo: null, sitioNombre: 'Pantalla Vertical' }),
    ])
    const crudo = JSON.stringify(s)
    expect(crudo).not.toContain('201.141')
    expect(crudo).not.toContain('base64')
    expect(s.seguimiento.pantallas.map((p: any) => p.nombre).sort()).toEqual(['Pantalla Vertical', 'Pantalla envalfa'])
  })

  it('tope del día por campaña: 429', async () => {
    const p = await propuesta(dueno, alfa, 'Tope diario')
    const c = await campanaDe(alfa, p.id)
    for (let i = 0; i < 10; i++) {
      await poolTest().query(
        `insert into envios_creativo_cliente (tenant_id, campana_id, nombre_archivo, tipo_mime, tamano_bytes, contenido)
         values ($1,$2,'x.png','image/png',70,$3)`,
        [alfa.id, c, PNG],
      )
    }
    expect((await enviar(p.token, { archivo: PNG, nombre: 'once.png' })).status).toBe(429)
    await poolTest().query('delete from envios_creativo_cliente where campana_id=$1', [c])
  })

  it('una campaña cancelada ya no recibe: 409', async () => {
    const p = await propuesta(dueno, alfa, 'Cancelada')
    await campanaDe(alfa, p.id, { estado: 'CANCELADA' })
    expect((await enviar(p.token, { archivo: PNG, nombre: 'a.png' })).status).toBe(409)
  })
})

// 18/11 · decisión del dueño: «sí, rechazar» el envío cuya proporción no
// coincide con la del sitio elegido. Tolerancia: la de la valoración del arte
// (3 %). La medida se lee del ARCHIVO, no de lo que diga el navegador.
describe('1b · la proporción del sitio', () => {
  let p43: { id: string; token: string }
  let sitio43: string
  beforeAll(async () => {
    const pr = await poolTest().query('select predio_id from sitios where id=$1', [alfa.sitioId])
    sitio43 = (
      await poolTest().query(
        `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                             alcaldia, ciudad, total_spots, tarifa_publicada, tarifa_mensual,
                             predio_id, tenant_id, exhibicion, resolucion_px)
         values ('Pantalla 4:3','ENVALFA-043','ENVALFA-PROV-043','PANTALLA_DIGITAL','DISPONIBLE','Cuauhtémoc','CDMX',
                 12,45000,45000,$1,$2,'digital','1024x768') returning id`,
        [pr.rows[0].predio_id, alfa.id],
      )
    ).rows[0].id
    p43 = await propuesta(dueno, alfa, 'Proporción')
    await campanaDe(alfa, p43.id, { sitios: [sitio43, alfa.sitioId] })
  })
  const enviosDe = () =>
    contar(
      `select count(*)::int as n from envios_creativo_cliente e join campanas c on c.id = e.campana_id where c.propuesta_id = $1`,
      [p43.id],
    )

  it('16:9 en un sitio 4:3: 422 y nada guardado, aunque el navegador diga otra medida', async () => {
    const r = await enviar(p43.token, { archivo: pngDe(1920, 1080), nombre: 'ancha.png', sitioId: sitio43 })
    expect(r.status, r.texto).toBe(422)
    expect(r.datos.error).toContain('proporción')
    const mentira = await enviar(p43.token, { archivo: pngDe(1920, 1080), nombre: 'ancha.png', sitioId: sitio43, ancho: 1024, alto: 768 })
    expect(mentira.status).toBe(422)
    expect(await enviosDe()).toBe(0)
  })

  it('dentro de la tolerancia: 201 (4:3 exacto y 1450×1080, a 0,7 %)', async () => {
    expect((await enviar(p43.token, { archivo: pngDe(1440, 1080), nombre: 'exacta.png', sitioId: sitio43 })).status).toBe(201)
    expect((await enviar(p43.token, { archivo: pngDe(1450, 1080), nombre: 'casi.png', sitioId: sitio43 })).status).toBe(201)
    expect(await enviosDe()).toBe(2)
  })

  it('un sitio SIN medida no rechaza por proporción', async () => {
    const r = await enviar(p43.token, { archivo: pngDe(1920, 1080), nombre: 'libre.png', sitioId: alfa.sitioId })
    expect(r.status, r.texto).toBe(201)
    expect(await enviosDe()).toBe(3)
  })
})

describe('2 · R2: nadie de fuera lo ve ni lo toca', () => {
  let envioId: string
  beforeAll(async () => {
    envioId = (await poolTest().query(`select id from envios_creativo_cliente where campana_id=$1`, [camp])).rows[0].id
  })

  it('el rol de la aplicación, directo contra la base: solo con SU tenant', async () => {
    const app = poolApp()
    const ver = async (tenant: string | null) => {
      const cli = await app.connect()
      try {
        await cli.query('begin')
        if (tenant) await cli.query(`select set_config('app.tenant_id', $1, true)`, [tenant])
        const n = Number((await cli.query('select count(*)::int as n from envios_creativo_cliente where campana_id = $1', [camp])).rows[0].n)
        await cli.query('rollback')
        return n
      } finally {
        cli.release()
      }
    }
    expect(await ver(alfa.id)).toBe(1)
    expect(await ver(beta.id)).toBe(0)
    expect(await ver(null)).toBe(0)
  })

  it('el Dueño de OTRA organización: lista vacía, archivo 404, aprobar 404', async () => {
    const l = await duenoBeta.pedir(`/api/campanas/${camp}/envios-cliente/`, { metodo: 'GET' })
    expect(l.status).toBe(200)
    expect(l.datos).toEqual([])
    expect((await duenoBeta.pedir(`/api/campanas/${camp}/envios-cliente/${envioId}/`, { metodo: 'GET' })).status).toBe(404)
    const ap = await duenoBeta.pedir(`/api/campanas/${camp}/envios-cliente/${envioId}/`, { cuerpo: { accion: 'aprobar' } })
    expect(ap.status).toBe(404)
    expect(await contar('select count(*)::int as n from envios_creativo_cliente where id=$1', [envioId])).toBe(1)
  })

  it('un VENDEDOR de la misma organización: 403 al ver, al pedir el archivo y al aprobar', async () => {
    expect((await vendedor.pedir(`/api/campanas/${camp}/envios-cliente/`, { metodo: 'GET' })).status).toBe(403)
    expect((await vendedor.pedir(`/api/campanas/${camp}/envios-cliente/${envioId}/`, { metodo: 'GET' })).status).toBe(403)
    expect((await vendedor.pedir(`/api/campanas/${camp}/envios-cliente/${envioId}/`, { cuerpo: { accion: 'aprobar' } })).status).toBe(403)
    expect((await vendedor.pedir(`/api/campanas/${camp}/envios-cliente/${envioId}/`, { cuerpo: { accion: 'rechazar' } })).status).toBe(403)
    expect(await contar('select count(*)::int as n from creatividades where campana_id=$1', [camp])).toBe(0)
  })

  it('un envío de otra campaña de la misma organización no se aprueba desde esta: 404', async () => {
    const p = await propuesta(dueno, alfa, 'Otra campaña')
    const otra = await campanaDe(alfa, p.id)
    expect((await dueno.pedir(`/api/campanas/${otra}/envios-cliente/${envioId}/`, { cuerpo: { accion: 'aprobar' } })).status).toBe(404)
  })
})

describe('3 · el Dueño revisa en la ficha', () => {
  it('ve el envío con su vista previa', async () => {
    const l = await dueno.pedir(`/api/campanas/${camp}/envios-cliente/`, { metodo: 'GET' })
    expect(l.status).toBe(200)
    expect(l.datos).toHaveLength(1)
    expect(l.datos[0]).toMatchObject({ nombreArchivo: 'arte final .png', sitioNombre: 'Pantalla Vertical', anchoPx: 1080, altoPx: 1920 })
    expect(JSON.stringify(l.datos)).not.toContain('base64')
    const img = await dueno.pedir(`/api/campanas/${camp}/envios-cliente/${l.datos[0].id}/`, { metodo: 'GET' })
    expect(img.status).toBe(200)
    // Los bytes del PNG, no un JSON: la firma «PNG» va al principio.
    expect(String(img.datos)).toContain('PNG')
  })

  it('APROBAR sin la publicación aprobada: creativo VALIDADA en su campaña y tenant, envío borrado, sin publicar', async () => {
    const id = (await poolTest().query(`select id from envios_creativo_cliente where campana_id=$1`, [camp])).rows[0].id
    const r = await dueno.pedir(`/api/campanas/${camp}/envios-cliente/${id}/`, { cuerpo: { accion: 'aprobar' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.publicacion).toEqual({ tipo: 'sin-publicacion' })
    const cr = (await poolTest().query('select * from creatividades where campana_id=$1', [camp])).rows
    expect(cr).toHaveLength(1)
    expect(cr[0]).toMatchObject({ tenant_id: alfa.id, estatus_validacion: 'VALIDADA', nombre: 'arte final .png', formato: 'text/html', resolucion: '1080x1920' })
    expect(cr[0].codigo).toContain(VERTICAL)
    expect(await contar('select count(*)::int as n from envios_creativo_cliente where id=$1', [id])).toBe(0)
    // 19/11 · decisión del dueño: va SOLO a la pantalla que eligió el cliente
    // (la Vertical), no a todas las digitales vacías de la campaña. Hasta hoy
    // la autoasignación de siempre lo ponía en las dos.
    const res = (await poolTest().query('select sitio_id, creativos from reservas where campana_id=$1', [camp])).rows
    expect(res).toHaveLength(2)
    const deSitio = (s: string) => JSON.stringify(res.find((x: any) => x.sitio_id === s)!.creativos)
    expect(deSitio(sitioB)).toContain(cr[0].id)
    expect(deSitio(alfa.sitioId)).not.toContain(cr[0].id)
    expect(r.datos.autoasignadas).toBe(1)
    // Un segundo clic ya no encuentra nada.
    expect((await dueno.pedir(`/api/campanas/${camp}/envios-cliente/${id}/`, { cuerpo: { accion: 'aprobar' } })).status).toBe(404)
  })

  it('APROBAR con la publicación ya aprobada: lo publica por «Volver a publicar»', async () => {
    // Con el creativo solo en la Vertical, la otra pantalla está «Sin asignar»
    // y el guard de M14 no deja publicar: el Dueño la llena como siempre, con
    // el reparto de Creativos, solo en las vacías.
    const arte = (await poolTest().query('select id from creatividades where campana_id=$1', [camp])).rows[0].id
    const rep = await dueno.pedir(`/api/campanas/${camp}/creativos/repartir/`, { cuerpo: { creatividadIds: [arte], soloVacias: true } })
    expect(rep.status, JSON.stringify(rep.datos)).toBe(200)
    expect((await dueno.pedir(`/api/campanas/${camp}/enviar-dominio/`, { cuerpo: {} })).status).toBe(200)
    expect((await dueno.pedir(`/api/campanas/${camp}/validar/`, { cuerpo: { aprobar: true } })).status).toBe(200)
    // Publicada y esperando su fecha: la liga todavía recibe (digital).
    const r1 = await enviar(prop.token, { archivo: PNG, nombre: 'segunda.png', sitioId: alfa.sitioId })
    expect(r1.status, r1.texto).toBe(201)
    const id = (await poolTest().query(`select id from envios_creativo_cliente where campana_id=$1`, [camp])).rows[0].id
    const r = await dueno.pedir(`/api/campanas/${camp}/envios-cliente/${id}/`, { cuerpo: { accion: 'aprobar' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.publicacion.tipo).toBe('publicada')
    // Una fila por pantalla, como la republicación: el arnés no tiene DOOHmain,
    // así que cada una falla al arrancar — pero se intentó, que es lo que se mira.
    expect(Array.isArray(r.datos.publicacion.doohmain)).toBe(true)
    expect(r.datos.publicacion.doohmain.length).toBeGreaterThan(0)
    expect(await contar(`select count(*)::int as n from creatividades where campana_id=$1 and estatus_validacion='VALIDADA'`, [camp])).toBe(2)
    // Y esta segunda, mandada para la otra pantalla, entra SOLO en ésa (rota
    // con lo que el Dueño ya había puesto ahí) y NO se mete en la Vertical.
    const ids = Object.fromEntries(
      (await poolTest().query('select nombre, id from creatividades where campana_id=$1', [camp])).rows.map((x: any) => [x.nombre, x.id]),
    )
    const res = (await poolTest().query('select sitio_id, creativos from reservas where campana_id=$1', [camp])).rows
    const deSitio = (s: string) => (res.find((x: any) => x.sitio_id === s)!.creativos as any[]).map((c) => c.creatividadId)
    expect(deSitio(alfa.sitioId).sort()).toEqual([ids['arte final .png'], ids['segunda.png']].sort())
    expect(deSitio(sitioB)).toEqual([ids['arte final .png']])
  })

  it('RECHAZAR: queda el motivo para la liga, el archivo se borra y no hay creativo', async () => {
    const r1 = await enviar(prop.token, { archivo: PNG, nombre: 'tercera.png', sitioId: alfa.sitioId })
    expect(r1.status).toBe(201)
    const id = (await poolTest().query(`select id from envios_creativo_cliente where campana_id=$1 and estatus='PENDIENTE'`, [camp])).rows[0].id
    const antes = await creatividades()
    const r = await dueno.pedir(`/api/campanas/${camp}/envios-cliente/${id}/`, { cuerpo: { accion: 'rechazar', motivo: 'Falta el logo' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(await creatividades()).toBe(antes)
    const f = (await poolTest().query('select * from envios_creativo_cliente where id=$1', [id])).rows[0]
    expect(f).toMatchObject({ estatus: 'RECHAZADO', motivo_rechazo: 'Falta el logo', contenido: null })
    expect((await dueno.pedir(`/api/campanas/${camp}/envios-cliente/${id}/`, { metodo: 'GET' })).status).toBe(404)
    const s = await seguimiento(prop.token)
    expect(s.seguimiento.envios).toEqual([
      expect.objectContaining({ nombre: 'tercera.png', estatus: 'RECHAZADO', motivo: 'Falta el logo' }),
    ])
    // Rechazado ya no se aprueba.
    expect((await dueno.pedir(`/api/campanas/${camp}/envios-cliente/${id}/`, { cuerpo: { accion: 'aprobar' } })).status).toBe(404)
  })
})

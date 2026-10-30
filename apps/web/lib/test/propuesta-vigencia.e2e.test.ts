import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  PROP-COMPLETA · VIGENCIA Y CONDICIONES de la propuesta, contra Postgres y por
//  la red (decisiones del dueño del 29/10).
//
//   · La vigencia se pone al ENVIAR: hoy + los días de la organización (30).
//   · Vencida, la liga pública NO deja aceptar (409) — y es la BASE la que
//     decide «vencida», no el reloj de quien llama.
//   · Las condiciones se COPIAN de la plantilla al crear: cambiar la plantilla
//     después no toca las ya creadas.
//   · R2: la plantilla y los días de una organización no se cuelan en otra.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente
const anonimo = () => new Cliente()

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('vigalfa')
  beta = await sembrarTenant('vigbeta')
  await arrancarServidor()
  ca = new Cliente()
  cb = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cb.entrar(beta.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

async function crear(c: Cliente, sitioId: string, nombre = 'Propuesta vigencia') {
  const r = await c.pedir('/api/propuestas/', {
    cuerpo: { nombre, fechaInicio: enDias(5), fechaFin: enDias(34), items: [{ sitioId, precio: 45_000 }] },
  })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  return r.datos as { id: string; tokenPublico: string; condiciones: string | null }
}

async function fila(id: string) {
  return (
    await poolTest().query(
      `select to_char(vigente_hasta, 'YYYY-MM-DD') as vigente_hasta,
              (vigente_hasta - current_date) as dias, condiciones, estatus
         from propuestas where id = $1`,
      [id],
    )
  ).rows[0]
}

describe('la vigencia se pone al ENVIAR, con los días de la organización', () => {
  it('un borrador no tiene vigencia; al enviarlo, hoy + 30', async () => {
    const p = await crear(ca, alfa.sitioId)
    expect((await fila(p.id)).vigente_hasta).toBeNull()
    const r = await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(Number((await fila(p.id)).dias)).toBe(30)
  })

  it('con 10 días configurados en Administración, hoy + 10 — y beta sigue en 30 (R2)', async () => {
    const cfg = await ca.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { vigenciaPropuestaDias: 10 } })
    expect(cfg.status, JSON.stringify(cfg.datos)).toBe(200)

    const pa = await crear(ca, alfa.sitioId)
    await ca.pedir(`/api/propuestas/${pa.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    expect(Number((await fila(pa.id)).dias)).toBe(10)

    const pb = await crear(cb, beta.sitioId)
    await cb.pedir(`/api/propuestas/${pb.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    expect(Number((await fila(pb.id)).dias)).toBe(30)
  })

  it('NEGATIVO · días fuera de 1–365 se rechazan con 400 y no se guardan', async () => {
    for (const malo of [0, 366, 2.5]) {
      const r = await ca.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { vigenciaPropuestaDias: malo } })
      expect(r.status, `vigencia ${malo}`).toBe(400)
    }
  })
})

describe('vencida, la liga pública NO deja aceptar', () => {
  it('la liga dice «vencida» y aceptar da 409 sin tocar la propuesta', async () => {
    const p = await crear(ca, alfa.sitioId)
    await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    // Ayer: la decide la BASE (`vigente_hasta < current_date`).
    await poolTest().query(`update propuestas set vigente_hasta = current_date - 1 where id = $1`, [p.id])

    const leida = await anonimo().pedir(`/api/propuestas/publica/${p.tokenPublico}/`)
    expect(leida.status).toBe(200)
    expect(leida.datos.vencida).toBe(true)

    const acep = await anonimo().pedir(`/api/propuestas/publica/${p.tokenPublico}/`, { cuerpo: { nombre: 'Cliente' } })
    expect(acep.status).toBe(409)
    expect(acep.datos.error).toMatch(/venció/)
    expect((await fila(p.id)).estatus).toBe('ENVIADA')
  })

  it('el ÚLTIMO día todavía vale: con vigencia de hoy se acepta', async () => {
    const p = await crear(ca, alfa.sitioId)
    await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    await poolTest().query(`update propuestas set vigente_hasta = current_date where id = $1`, [p.id])
    const acep = await anonimo().pedir(`/api/propuestas/publica/${p.tokenPublico}/`, { cuerpo: { nombre: 'Cliente' } })
    expect(acep.status, JSON.stringify(acep.datos)).toBe(200)
    expect((await fila(p.id)).estatus).toBe('APROBADA')
  })

  it('poner otra fecha por dentro la reabre; reenviarla vencida también', async () => {
    const p = await crear(ca, alfa.sitioId)
    await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    await poolTest().query(`update propuestas set vigente_hasta = current_date - 3 where id = $1`, [p.id])

    const nueva = enDias(7)
    const r = await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { vigenteHasta: nueva } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.vencida).toBe(false)
    expect((await fila(p.id)).vigente_hasta).toBe(nueva)

    await poolTest().query(`update propuestas set vigente_hasta = current_date - 3 where id = $1`, [p.id])
    await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    expect(Number((await fila(p.id)).dias)).toBeGreaterThan(0)
  })

  it('sin vigencia (lo enviado antes del 29/10) se sigue aceptando como siempre', async () => {
    const p = await crear(ca, alfa.sitioId)
    await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    await poolTest().query(`update propuestas set vigente_hasta = null where id = $1`, [p.id])
    const acep = await anonimo().pedir(`/api/propuestas/publica/${p.tokenPublico}/`, { cuerpo: { nombre: 'Cliente' } })
    expect(acep.status, JSON.stringify(acep.datos)).toBe(200)
  })

  it('NEGATIVO · una fecha que no existe da 400, no un 500', async () => {
    const p = await crear(ca, alfa.sitioId)
    const r = await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { vigenteHasta: '2026-02-31' } })
    expect(r.status).toBe(400)
  })
})

describe('las condiciones se COPIAN de la plantilla al crear', () => {
  it('la propuesta nueva nace con la plantilla; cambiarla después no la toca', async () => {
    await ca.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { condicionesPropuesta: 'Pago a 30 días.' } })
    const p = await crear(ca, alfa.sitioId)
    expect(p.condiciones).toBe('Pago a 30 días.')

    await ca.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { condicionesPropuesta: 'Pago de contado.' } })
    expect((await fila(p.id)).condiciones).toBe('Pago a 30 días.')
  })

  it('R2 · la plantilla de alfa NO aparece en una propuesta de beta', async () => {
    const pb = await crear(cb, beta.sitioId)
    expect(pb.condiciones).toBeNull()
  })

  it('se editan por propuesta, viajan a la liga, y vaciarlas las quita', async () => {
    const p = await crear(ca, alfa.sitioId)
    const r = await ca.pedir(`/api/propuestas/${p.id}/`, {
      metodo: 'PATCH',
      cuerpo: { condiciones: 'Solo para este cliente.' },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const pub = await anonimo().pedir(`/api/propuestas/publica/${p.tokenPublico}/`)
    expect(pub.datos.condiciones).toBe('Solo para este cliente.')

    await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { condiciones: '   ' } })
    expect((await fila(p.id)).condiciones).toBeNull()
  })
})

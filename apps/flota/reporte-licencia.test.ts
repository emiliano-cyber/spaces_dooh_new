import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { crearServidor } from './reporte.mjs'

// La instancia baja su licencia del padre (ADR 0041, etapa 4). Lo que no puede
// fallar: que cada instancia reciba SOLO la suya, que sin token no reciba nada,
// y que los bytes lleguen exactos (la firma los cubre).
const dir = mkdtempSync(join(tmpdir(), 'licencias-'))
for (const n of ['pixeled', 'otra']) {
  mkdirSync(join(dir, n))
  writeFileSync(join(dir, n, 'licencia.json'), `{"instancia":"${n}"}\n`)
  writeFileSync(join(dir, n, 'licencia.firma'), Buffer.from([0, 1, 2, 250, 255]))
}

process.env.FLOTA_TOKEN_PIXELED = 'token-pixeled'
process.env.FLOTA_TOKEN_OTRA = 'token-otra'
process.env.FLOTA_TOKEN_SIN_LICENCIA = 'token-sin'
const instancias = [{ nombre: 'pixeled' }, { nombre: 'otra' }, { nombre: 'sin-licencia' }]

let base = ''
const servidor = crearServidor({ instancias, dirEstado: dir, dirLicencias: dir })
beforeAll(() => new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', () => {
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
  ok()
})))
afterAll(() => new Promise<void>((ok) => servidor.close(() => ok())))

const pedir = (ruta: string, token?: string) => fetch(base + ruta, { headers: token ? { 'x-flota-token': token } : {} })

describe('GET /flota/licencia.json y .firma', () => {
  it('cada instancia recibe la SUYA, segun su token', async () => {
    const r = await pedir('/flota/licencia.json', 'token-otra')
    expect(r.status).toBe(200)
    expect(await r.text()).toBe('{"instancia":"otra"}\n')
  })

  it('la firma llega con sus bytes exactos', async () => {
    const r = await pedir('/flota/licencia.firma', 'token-pixeled')
    expect(Buffer.from(await r.arrayBuffer())).toEqual(Buffer.from([0, 1, 2, 250, 255]))
  })

  it('sin token o con uno falso: 401 y nada', async () => {
    expect((await pedir('/flota/licencia.json')).status).toBe(401)
    expect((await pedir('/flota/licencia.json', 'inventado')).status).toBe(401)
  })

  it('una instancia sin licencia firmada: 404 sin_licencia', async () => {
    const r = await pedir('/flota/licencia.json', 'token-sin')
    expect(r.status).toBe(404)
    expect(await r.json()).toEqual({ ok: false, motivo: 'sin_licencia' })
  })

  it('otro archivo de la carpeta no se puede pedir', async () => {
    expect((await pedir('/flota/../licencias/otra/licencia.json', 'token-pixeled')).status).toBe(404)
    expect((await pedir('/flota/licencia.pem', 'token-pixeled')).status).toBe(404)
  })

  it('el reporte de siempre sigue igual: solo POST', async () => {
    expect((await pedir('/flota/reporte', 'token-pixeled')).status).toBe(404)
  })
})

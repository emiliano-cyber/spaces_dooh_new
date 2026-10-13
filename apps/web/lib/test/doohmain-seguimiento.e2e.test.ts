import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recrearEsquema, cerrarPool, poolTest, poolApp } from './db-e2e'

// ============================================================================
//  Las tablas de seguimiento de DOOHmain aceptan lo que el SDK escribe.
// ----------------------------------------------------------------------------
//  Encontrado el 13/10 publicando una campaña de punta a punta contra un
//  DOOHmain simulado: en una base levantada desde las migraciones, el SDK
//  revienta en su primer registro con «there is no unique or exclusion
//  constraint matching the ON CONFLICT specification». La culpable es
//  `20260805_objetos_solo_en_prod.sql`, que crea las tres tablas SIN las únicas
//  y con un `id` sin identidad; `20260901_doohmain_tracking.sql` las define bien
//  pero con `create table if not exists`, y no hace nada.
//
//  Lo caro: el fallo llega DESPUÉS de `create_campaign`. Cada intento dejaba una
//  campaña vacía en DOOHmain y ningún arte ni spot.
//
//  Las sentencias de abajo son las de `doohmain_sdk/db.py`, copiadas tal cual y
//  corridas con el rol de la aplicación, que es con el que conecta el SDK.
// ============================================================================

const MIGRACION = join(process.cwd(), '..', '..', 'db', 'migrations', '20261013_doohmain_seguimiento_unicas.sql')

const sdk = {
  campana: (version: string, auth: string) =>
    poolApp().query(
      `INSERT INTO doohmain_remote_campaigns (version, auth, name, anunciante)
       VALUES ($1, $2, 'Campaña', 'Anunciante')
       ON CONFLICT (version) DO UPDATE SET last_synced_at = now()`,
      [version, auth],
    ),
  lista: (pantalla: string, mediaId: number) =>
    poolApp().query(
      `INSERT INTO doohmain_remote_lists (screen_name, list_name, campaign_auth, media_id)
       VALUES ($1, 'PR-2026-0001', 'AUTH-1', $2)
       ON CONFLICT (screen_name, list_name, media_id) DO UPDATE SET last_synced_at = now()`,
      [pantalla, mediaId],
    ),
  arte: (version: string, mediaId: number) =>
    poolApp().query(
      `INSERT INTO media_uploads
           (version, media_id, file_hash, filename, local_path, ancho, alto, extension, source_mtime, source_size)
       VALUES ($1, $2, 'h', 'a.png', '/tmp/a.png', null, null, 'png', 1, 10)
       ON CONFLICT (version) DO UPDATE SET media_id = EXCLUDED.media_id`,
      [version, mediaId],
    ),
}

// Con un cliente propio: si la migración aborta, su transacción no se queda
// abierta en una conexión del pool que luego usaría otra aserción.
async function aplicar() {
  const c = await poolTest().connect()
  try {
    await c.query(readFileSync(MIGRACION, 'utf8'))
  } finally {
    await c.query('rollback').catch(() => {})
    c.release()
  }
}

const cuenta = async (tabla: string) =>
  Number((await poolTest().query(`select count(*)::int as n from ${tabla}`)).rows[0].n)

// Deja las tres tablas como las deja `20260805` en una base sin la corrección:
// sin identidad y sin únicas. Es el estado de toda instancia instalada desde el
// repositorio antes del 13/10.
async function dejarComoAntes() {
  for (const t of ['doohmain_remote_campaigns', 'doohmain_remote_lists', 'media_uploads']) {
    await poolTest().query(`truncate ${t}`)
    await poolTest().query(`alter table ${t} alter column id drop identity if exists`)
  }
  await poolTest().query(`alter table doohmain_remote_campaigns drop constraint if exists uniq_version`)
  await poolTest().query(`alter table doohmain_remote_lists drop constraint if exists uniq_screen_list_media`)
  await poolTest().query(`alter table media_uploads drop constraint if exists uniq_media_version`)
}

beforeAll(async () => {
  await recrearEsquema()
}, 120_000)

afterAll(async () => {
  await cerrarPool()
})

describe('seguimiento de DOOHmain', () => {
  it('el SDK registra campaña, spot y arte, y repetirlo no duplica', async () => {
    for (let i = 0; i < 2; i++) {
      await sdk.campana('creativo-1', 'AUTH-1')
      await sdk.lista('DM-REFORMA-01', 1005)
      await sdk.lista('DM-PERIFERICO-02', 1005)
      await sdk.arte('creativo-1', 1005)
    }
    expect(await cuenta('doohmain_remote_campaigns')).toBe(1)
    expect(await cuenta('doohmain_remote_lists')).toBe(2)
    expect(await cuenta('media_uploads')).toBe(1)
  })

  it('corrige una base que ya tenía filas, y los id nuevos siguen después del mayor', async () => {
    await dejarComoAntes()
    // Filas con id puestos a mano, como las de una base anterior.
    await poolTest().query(
      `insert into doohmain_remote_campaigns (id, version, auth) values (50, 'viejo', 'AUTH-0')`,
    )
    await aplicar()

    await sdk.campana('creativo-2', 'AUTH-2')
    const ids = (await poolTest().query(`select id from doohmain_remote_campaigns order by id`)).rows
    expect(ids.map((r) => Number(r.id))).toEqual([50, 51])
  })

  it('aplicarla dos veces no cambia nada', async () => {
    await aplicar()
    await sdk.campana('creativo-2', 'AUTH-2')
    expect(await cuenta('doohmain_remote_campaigns')).toBe(2)
  })

  it('con registros repetidos ABORTA y dice cuáles, en vez de borrar alguno', async () => {
    await dejarComoAntes()
    await poolTest().query(
      `insert into doohmain_remote_campaigns (id, version, auth)
       values (1, 'repetido', 'AUTH-A'), (2, 'repetido', 'AUTH-B')`,
    )
    await expect(aplicar()).rejects.toThrow(/repetido \(2 veces\)/)
    // Nada se tocó: la transacción entera se deshizo.
    expect(await cuenta('doohmain_remote_campaigns')).toBe(2)
  })
})

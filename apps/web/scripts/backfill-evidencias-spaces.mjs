// ============================================================================
//  backfill-evidencias-spaces.mjs — Migra las evidencias guardadas como data URL
//  (base64 en BD) a DigitalOcean Spaces, llenando `foto_key` y vaciando `foto_url`.
//
//  NO se ejecuta automáticamente. Requiere confirmación humana y las env vars:
//    DATABASE_URL, DO_SPACES_KEY, DO_SPACES_SECRET, DO_SPACES_ENDPOINT, DO_SPACES_BUCKET
//
//  Uso (dry-run por defecto):
//    node scripts/backfill-evidencias-spaces.mjs          # solo cuenta, no escribe
//    node scripts/backfill-evidencias-spaces.mjs --apply  # migra de verdad
// ============================================================================
import pg from 'pg'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const APPLY = process.argv.includes('--apply')
const { DATABASE_URL, DO_SPACES_KEY, DO_SPACES_SECRET, DO_SPACES_ENDPOINT, DO_SPACES_BUCKET } = process.env

if (!DATABASE_URL || !DO_SPACES_KEY || !DO_SPACES_SECRET || !DO_SPACES_ENDPOINT || !DO_SPACES_BUCKET) {
  console.error('Faltan env vars (DATABASE_URL y DO_SPACES_*). Aborta.')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const s3 = new S3Client({
  endpoint: DO_SPACES_ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: DO_SPACES_KEY, secretAccessKey: DO_SPACES_SECRET },
})

const rows = (await pool.query(
  `select id, ot_id, foto_url from evidencias_ot where foto_key is null and foto_url like 'data:%'`,
)).rows
console.log(`Evidencias base64 por migrar: ${rows.length} ${APPLY ? '(APLICANDO)' : '(dry-run)'}`)

let ok = 0
for (const r of rows) {
  if (!APPLY) continue
  const m = /^data:([^;]+);base64,(.*)$/.exec(r.foto_url)
  if (!m) continue
  const key = `evidencias/${r.ot_id}/${r.id}.jpg`
  await s3.send(new PutObjectCommand({
    Bucket: DO_SPACES_BUCKET, Key: key, Body: Buffer.from(m[2], 'base64'), ContentType: m[1], ACL: 'private',
  }))
  await pool.query(`update evidencias_ot set foto_key=$2, foto_url='' where id=$1`, [r.id, key])
  ok++
}
console.log(APPLY ? `Migradas: ${ok}` : 'Dry-run: nada escrito. Usa --apply para migrar.')
await pool.end()

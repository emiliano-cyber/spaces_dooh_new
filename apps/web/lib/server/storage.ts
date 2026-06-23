import 'server-only'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// ============================================================================
//  lib/server/storage.ts — Almacenamiento de evidencias en DigitalOcean Spaces
//  (S3-compatible). GATEADO por entorno: solo se activa si TODAS las variables
//  DO_SPACES_* están definidas. Si no, `habilitado()` es false y el llamador
//  hace fallback al guardado actual (data URL base64 en BD), sin romper nada.
// ============================================================================

const KEY = process.env.DO_SPACES_KEY
const SECRET = process.env.DO_SPACES_SECRET
const ENDPOINT = process.env.DO_SPACES_ENDPOINT
const BUCKET = process.env.DO_SPACES_BUCKET
const CDN = process.env.DO_SPACES_CDN_URL

export function storageHabilitado(): boolean {
  return !!(KEY && SECRET && ENDPOINT && BUCKET)
}

let _client: S3Client | null = null
function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      endpoint: ENDPOINT,
      region: 'us-east-1', // Spaces ignora la región pero el SDK la exige
      credentials: { accessKeyId: KEY!, secretAccessKey: SECRET! },
      forcePathStyle: false,
    })
  }
  return _client
}

// Sube un data URL (base64) a Spaces y devuelve la key del objeto.
export async function subirDataUrl(key: string, dataUrl: string): Promise<string> {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  const contentType = m?.[1] ?? 'application/octet-stream'
  const body = Buffer.from(m?.[2] ?? '', 'base64')
  await client().send(
    new PutObjectCommand({ Bucket: BUCKET!, Key: key, Body: body, ContentType: contentType, ACL: 'private' }),
  )
  return key
}

// URL firmada de lectura (privada, expira). Si hay CDN definido y el objeto
// fuera público se podría servir por CDN, pero por defecto firmamos.
export async function urlFirmada(key: string, segundos = 3600): Promise<string> {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: BUCKET!, Key: key }), { expiresIn: segundos })
}

export const cdnBase = CDN ?? null

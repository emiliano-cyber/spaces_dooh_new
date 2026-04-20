import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const bucket = process.env.DO_SPACES_BUCKET ?? 'spaces-dooh'
const isDev = process.env.NODE_ENV !== 'production'
const hasCredentials = Boolean(process.env.DO_SPACES_KEY)

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.DO_SPACES_ENDPOINT,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY ?? '',
    secretAccessKey: process.env.DO_SPACES_SECRET ?? '',
  },
  forcePathStyle: false,
})

export function buildKey(
  tenantId: string,
  modulo: string,
  entidadId: string,
  filename: string,
): string {
  return `${tenantId}/${modulo}/${entidadId}/${Date.now()}-${filename}`
}

export async function getPresignedUpload(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  if (isDev && !hasCredentials) {
    return `https://placeholder.storage/${bucket}/${key}?upload=1`
  }
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType })
  return getSignedUrl(s3, command, { expiresIn })
}

export async function getPresignedGet(key: string, expiresIn = 3600): Promise<string> {
  if (isDev && !hasCredentials) {
    return `https://placeholder.storage/${bucket}/${key}`
  }
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  return getSignedUrl(s3, command, { expiresIn })
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  if (isDev && !hasCredentials) {
    console.log(`[Storage] putObject (mock): ${key} (${contentType}, ${body.length} bytes)`)
    return `https://placeholder.storage/${bucket}/${key}`
  }
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }))
  const endpoint = process.env.DO_SPACES_ENDPOINT ?? `https://${bucket}.nyc3.digitaloceanspaces.com`
  return `${endpoint}/${key}`
}

export async function deleteObject(key: string): Promise<void> {
  if (isDev && !hasCredentials) {
    console.log(`[Storage] deleteObject (mock): ${key}`)
    return
  }
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

// backend/src/services/photoStorage.service.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { env } from '../config/env';
import { pool } from '../config/database';
import { verificationQueue } from './verification.service';
import { estaTransmitiendo } from '../utils/streamWatchdog';
import { firmar } from '../utils/firmaArchivos';

const s3 = new S3Client({
  endpoint: env.SPACES_ENDPOINT,
  region: env.SPACES_REGION,
  credentials: { accessKeyId: env.SPACES_KEY, secretAccessKey: env.SPACES_SECRET },
  forcePathStyle: false,
});

// Directorio raiz para fotos en modo local (servido por Express en /storage).
const STORAGE_ROOT = path.resolve(process.cwd(), env.STORAGE_DIR);

// Guarda un objeto y devuelve la ruta/URL que se almacenara en la BD y usara el frontend.
async function putObject(key: string, body: Buffer, contentType: string): Promise<string> {
  if (env.STORAGE_DRIVER === 'local') {
    const dest = path.join(STORAGE_ROOT, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);
    // Ruta relativa servida por el backend: <img src="/storage/...">
    return `/storage/${key}`;
  }
  await s3.send(new PutObjectCommand({
    Bucket: env.SPACES_BUCKET, Key: key, Body: body, ContentType: contentType,
  }));
  return key;
}

// Guarda un buffer arbitrario (p.ej. el PDF de evidencia o las imagenes
// alineada/diff generadas por el ai-worker) y devuelve su ruta/URL almacenable.
export async function storeBuffer(key: string, body: Buffer, contentType: string): Promise<string> {
  return putObject(key, body, contentType);
}

// Borra un objeto almacenado (foto o thumbnail) tanto en local como en Spaces.
// Silencioso: si el archivo ya no existe no es un error.
export async function deleteStored(storagePath: string): Promise<void> {
  try {
    if (storagePath.startsWith('/storage/')) {
      const key = storagePath.replace(/^\/storage\//, '');
      await fs.unlink(path.join(STORAGE_ROOT, key)).catch(() => {});
    } else if (env.STORAGE_DRIVER === 'spaces') {
      await s3.send(new DeleteObjectCommand({ Bucket: env.SPACES_BUCKET, Key: storagePath }));
    }
  } catch {
    /* borrado best-effort */
  }
}

// Convierte una storage_path guardada en BD a una URL descargable por el worker.
// - Ya es http(s): se devuelve tal cual.
// - Empieza con '/': modo local, se antepone PUBLIC_BASE_URL.
// - En otro caso: se asume clave de Spaces/S3 y se construye la URL publica.
export function resolveStorageUrl(storagePath: string): string {
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  // El ai-worker descarga esto con un GET pelado, sin cabeceras, asi que la
  // autorizacion tiene que ir DENTRO de la URL. Vigencia larga a proposito: la
  // verificacion pasa por una cola y puede tardar en salir de ella.
  if (storagePath.startsWith('/')) return `${env.PUBLIC_BASE_URL}${firmar(storagePath, 24 * 3600)}`;
  return `${env.SPACES_ENDPOINT}/${env.SPACES_BUCKET}/${storagePath}`;
}

interface UploadParams {
  deviceId: number;
  fileBuffer: Buffer;
  mimetype: string;
  taken_at: Date;
  command_id?: number;
  schedule_id?: number;
  campaign_id?: number;
  gps_lat?: number;
  gps_lng?: number;
  source: string;
  watermark_baked?: boolean;
  phash?: string;
}

/**
 * Cuanto habria que girar ESTA foto al mostrarla. No se toca el archivo.
 *
 * Solo se aplica a las fotos que llegan SIN vista en vivo: con el visor abierto
 * la app ya las entrega derechas. Por eso el mismo equipo necesita giro en la
 * foto programada y no en la que se toma desde la ficha.
 */
async function giroAlMostrar(deviceId: number): Promise<number> {
  try {
    if (estaTransmitiendo(deviceId)) return 0;
    const [filas] = await pool.query<any[]>(
      `SELECT photo_rotation FROM devices WHERE id = ?`,
      [deviceId]
    );
    const giro = Number((filas as any[])[0]?.photo_rotation) || 0;
    return [90, 180, 270].includes(giro) ? giro : 0;
  } catch {
    return 0; // ante la duda, no se gira
  }
}

export async function uploadPhoto(p: UploadParams) {
  // El origen lo decide el servidor, no el equipo. La APK manda "on_demand"
  // siempre (esta escrito fijo en CommandHandler), asi que una foto por horario
  // llegaba etiquetada como manual y el historial quedaba inservible para
  // distinguir la evidencia programada. Si la foto trae schedule_id, vino de una
  // programacion: punto. Asi queda bien tambien en los equipos que no se pueden
  // actualizar por red.
  const source = p.schedule_id ? 'scheduled' : p.source;

  const id = randomUUID();
  const date = p.taken_at.toISOString().slice(0, 10);
  const ext = p.mimetype === 'image/jpeg' ? 'jpg' : 'png';
  const fullPath = `photos/${date}/${p.deviceId}/${id}.${ext}`;
  const thumbPath = `thumbs/${date}/${p.deviceId}/${id}.jpg`;

  const meta = await sharp(p.fileBuffer).metadata();
  const thumb = await sharp(p.fileBuffer).resize(400, 400, { fit: 'inside' }).jpeg({ quality: 70 }).toBuffer();

  const [storedFull, storedThumb] = await Promise.all([
    putObject(fullPath, p.fileBuffer, p.mimetype),
    putObject(thumbPath, thumb, 'image/jpeg'),
  ]);

  const [result] = await pool.query<any>(
    `INSERT INTO photos
     (device_id, campaign_id, command_id, schedule_id, storage_path, thumbnail_path,
      file_size_bytes, width, height, taken_at, gps_lat, gps_lng, source, watermark_baked, phash,
      display_rotation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.deviceId, p.campaign_id ?? null, p.command_id ?? null, p.schedule_id ?? null,
     storedFull, storedThumb, p.fileBuffer.length, meta.width, meta.height, p.taken_at,
     p.gps_lat ?? null, p.gps_lng ?? null, source, p.watermark_baked ?? true,
     p.phash ? p.phash.toLowerCase() : null,
     await giroAlMostrar(p.deviceId)]
  );

  if (p.campaign_id) {
    const [c] = await pool.query<any[]>(
      `SELECT verification_enabled FROM campaigns WHERE id = ?`,
      [p.campaign_id]
    );
    if ((c as any[])[0]?.verification_enabled) {
      await verificationQueue.add('verify', { photo_id: (result as any).insertId });
      await pool.query(`UPDATE photos SET verification_status='queued' WHERE id=?`, [(result as any).insertId]);
    }
  }
  return { photo_id: (result as any).insertId, storage_path: storedFull };
}

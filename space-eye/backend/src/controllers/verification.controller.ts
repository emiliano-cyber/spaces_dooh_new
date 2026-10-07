// backend/src/controllers/verification.controller.ts
// Endpoints internos consumidos por el ai-worker (autenticados con requireWorker).
import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/database';
import { storeBuffer, resolveStorageUrl } from '../services/photoStorage.service';

// GET /api/internal/verification/:photoId/context
// Devuelve todo lo que el worker necesita para verificar la foto y marca la
// foto como 'running'. Responde 404 si la foto/campaña no existen y 422 si la
// campaña no tiene creatividad de referencia.
export async function getVerificationContext(req: Request, res: Response) {
  const photoId = Number(req.params.photoId);
  if (!Number.isInteger(photoId) || photoId <= 0) {
    return res.status(400).json({ error: 'invalid_photo_id' });
  }

  const [rows] = await pool.query<any[]>(
    `SELECT p.id, p.storage_path, p.campaign_id,
            d.name AS device_name,
            c.name AS campaign_name, c.creative_path, c.expected_text,
            c.min_ssim_score, c.max_phash_distance
     FROM photos p
     JOIN campaigns c ON p.campaign_id = c.id
     JOIN devices d ON p.device_id = d.id
     WHERE p.id = ? LIMIT 1`,
    [photoId]
  );
  const row = (rows as any[])[0];
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (!row.creative_path) {
    return res.status(422).json({ error: 'campaign_missing_creative' });
  }

  await pool.query(
    `UPDATE photos SET verification_status = 'running' WHERE id = ?`,
    [photoId]
  );

  res.json({
    photo_id: row.id,
    campaign_id: row.campaign_id,
    device_name: row.device_name,
    campaign_name: row.campaign_name,
    photo_url: resolveStorageUrl(row.storage_path),
    creative_url: resolveStorageUrl(row.creative_path),
    expected_text: row.expected_text || null,
    min_ssim_score: Number(row.min_ssim_score),
    max_phash_distance: Number(row.max_phash_distance),
  });
}

const resultSchema = z.object({
  is_correct: z.coerce.boolean(),
  confidence: z.coerce.number(),
  ssim_score: z.coerce.number().nullable().optional(),
  histogram_score: z.coerce.number().nullable().optional(),
  phash_distance: z.coerce.number().nullable().optional(),
  ocr_text: z.string().nullable().optional(),
  ocr_match: z.coerce.boolean().nullable().optional(),
  ocr_confidence: z.coerce.number().nullable().optional(),
  reason: z.string().nullable().optional(),
  processing_ms: z.coerce.number().nullable().optional(),
  // Si el worker no pudo procesar (imagen ilegible, timeout, etc.) manda `error`
  // y la foto se marca 'failed' sin crear fila en verifications.
  error: z.string().optional(),
});

// POST /api/internal/verification/:photoId/result
// multipart/form-data:
//   - result:   string JSON con los campos de resultSchema
//   - evidence: PDF de evidencia (opcional)
//   - aligned:  imagen alineada (opcional)
//   - diff:     imagen de diferencias (opcional)
export async function submitVerificationResult(req: Request, res: Response) {
  const photoId = Number(req.params.photoId);
  if (!Number.isInteger(photoId) || photoId <= 0) {
    return res.status(400).json({ error: 'invalid_photo_id' });
  }

  let raw: unknown;
  try {
    raw = JSON.parse((req.body?.result as string) ?? '{}');
  } catch {
    return res.status(400).json({ error: 'invalid_result_json' });
  }
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  }
  const data = parsed.data;

  const [prows] = await pool.query<any[]>(
    `SELECT campaign_id FROM photos WHERE id = ? LIMIT 1`,
    [photoId]
  );
  const photo = (prows as any[])[0];
  if (!photo) return res.status(404).json({ error: 'photo_not_found' });
  if (!photo.campaign_id) return res.status(422).json({ error: 'photo_has_no_campaign' });

  // El worker reporto un fallo de procesamiento.
  if (data.error) {
    await pool.query(
      `UPDATE photos SET verification_status = 'failed' WHERE id = ?`,
      [photoId]
    );
    return res.json({ ok: true, status: 'failed' });
  }

  // Almacena los artefactos adjuntos (si vienen).
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const storeIf = async (field: string, ext: string, contentType: string): Promise<string | null> => {
    const f = files?.[field]?.[0];
    if (!f) return null;
    return storeBuffer(`evidence/${photoId}/${field}.${ext}`, f.buffer, contentType);
  };
  const [evidencePdf, alignedPath, diffPath] = await Promise.all([
    storeIf('evidence', 'pdf', 'application/pdf'),
    storeIf('aligned', 'jpg', 'image/jpeg'),
    storeIf('diff', 'jpg', 'image/jpeg'),
  ]);

  // UPSERT: verifications.photo_id es UNIQUE, asi el reintento de un job
  // sobrescribe el resultado en vez de fallar por clave duplicada.
  await pool.query(
    `INSERT INTO verifications
       (photo_id, campaign_id, ssim_score, phash_distance, histogram_score,
        ocr_text, ocr_match, ocr_confidence, is_correct, confidence, reason,
        aligned_path, diff_path, evidence_pdf, processing_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       ssim_score = VALUES(ssim_score),
       phash_distance = VALUES(phash_distance),
       histogram_score = VALUES(histogram_score),
       ocr_text = VALUES(ocr_text),
       ocr_match = VALUES(ocr_match),
       ocr_confidence = VALUES(ocr_confidence),
       is_correct = VALUES(is_correct),
       confidence = VALUES(confidence),
       reason = VALUES(reason),
       aligned_path = VALUES(aligned_path),
       diff_path = VALUES(diff_path),
       evidence_pdf = VALUES(evidence_pdf),
       processing_ms = VALUES(processing_ms),
       processed_at = CURRENT_TIMESTAMP`,
    [
      photoId, photo.campaign_id, data.ssim_score ?? null, data.phash_distance ?? null,
      data.histogram_score ?? null, data.ocr_text ?? null, data.ocr_match ?? null,
      data.ocr_confidence ?? null, data.is_correct, data.confidence, data.reason ?? null,
      alignedPath, diffPath, evidencePdf, data.processing_ms ?? null,
    ]
  );

  await pool.query(
    `UPDATE photos SET verification_status = 'verified', is_correct = ?, verification_score = ?
     WHERE id = ?`,
    [data.is_correct, data.confidence, photoId]
  );

  res.json({ ok: true, status: 'verified', is_correct: data.is_correct });
}

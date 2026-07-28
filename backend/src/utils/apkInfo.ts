// backend/src/utils/apkInfo.ts
// Datos del APK publicado en /space-eye.apk.
//
// El equipo necesita saber QUE version le toca y con que huella verificarla antes
// de instalar: el APK viaja por HTTP en claro, asi que la huella es la unica
// defensa real contra que le metan otro archivo.
//
// El numero de version no se puede leer del APK sin parsearlo, asi que se toma de
// `space-eye.json`, que se publica junto al APK al compilar. Si ese archivo no
// existe, igual se sirve tamaño y huella: se puede actualizar, solo que sin poder
// comparar versiones.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// OJO con la profundidad: este archivo compila a dist/utils/, un nivel MAS
// adentro que app.ts (dist/), asi que lleva un ".." extra para llegar al mismo
// frontend/public.
const PUBLIC = path.join(__dirname, '../../../frontend/public');
const APK = path.join(PUBLIC, 'space-eye.apk');
const META = path.join(PUBLIC, 'space-eye.json');

export interface ApkInfo {
  disponible: boolean;
  version?: string;
  version_code?: number;
  sha256?: string;
  bytes?: number;
  modificado?: string;
}

// La huella cuesta leer 50 MB: se cachea contra la fecha de modificacion para no
// recalcularla en cada consulta del dashboard.
let cache: { mtimeMs: number; info: ApkInfo } | null = null;

export function apkInfo(): ApkInfo {
  if (!fs.existsSync(APK)) return { disponible: false };

  const st = fs.statSync(APK);
  if (cache && cache.mtimeMs === st.mtimeMs) return cache.info;

  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(APK)).digest('hex');

  let version: string | undefined;
  let version_code: number | undefined;
  try {
    // Se quita el BOM: PowerShell escribe los archivos UTF-8 con marca de orden
    // de bytes y JSON.parse no la tolera (el archivo se leia pero fallaba).
    const meta = JSON.parse(fs.readFileSync(META, 'utf8').replace(/^﻿/, ''));
    version = meta.version;
    version_code = Number(meta.version_code) || undefined;
  } catch { /* sin metadatos: se sirve igual */ }

  const info: ApkInfo = {
    disponible: true,
    version,
    version_code,
    sha256,
    bytes: st.size,
    modificado: st.mtime.toISOString(),
  };
  cache = { mtimeMs: st.mtimeMs, info };
  return info;
}

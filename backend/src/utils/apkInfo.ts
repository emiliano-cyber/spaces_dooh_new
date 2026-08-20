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

// El agente de las PCs con camara IP se publica igual que el APK: el binario y
// un JSON con su version al lado. Es lo que permite actualizar esos sitios sin
// que nadie vaya. Ver `pc-agent/src/actualizar.js`.
const AGENTE_PC = path.join(PUBLIC, 'SpaceEyeAgente.exe');
const AGENTE_PC_META = path.join(PUBLIC, 'space-eye-agente.json');

// La huella cuesta leer 50-80 MB: se cachea contra la fecha de modificacion para
// no recalcularla en cada consulta del dashboard.
const cache = new Map<string, { mtimeMs: number; info: ApkInfo }>();

/** Huella, tamaño y version de un binario publicado en frontend/public. */
function publicado(archivo: string, meta: string): ApkInfo {
  if (!fs.existsSync(archivo)) return { disponible: false };

  const st = fs.statSync(archivo);
  const enCache = cache.get(archivo);
  if (enCache && enCache.mtimeMs === st.mtimeMs) return enCache.info;

  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(archivo)).digest('hex');

  let version: string | undefined;
  let version_code: number | undefined;
  try {
    // Se quita el BOM: PowerShell escribe los archivos UTF-8 con marca de orden
    // de bytes y JSON.parse no la tolera (el archivo se leia pero fallaba).
    const datos = JSON.parse(fs.readFileSync(meta, 'utf8').replace(/^﻿/, ''));
    version = datos.version;
    version_code = Number(datos.version_code) || undefined;
  } catch { /* sin metadatos: se sirve igual */ }

  const info: ApkInfo = {
    disponible: true,
    version,
    version_code,
    sha256,
    bytes: st.size,
    modificado: st.mtime.toISOString(),
  };
  cache.set(archivo, { mtimeMs: st.mtimeMs, info });
  return info;
}

export function apkInfo(): ApkInfo {
  return publicado(APK, META);
}

export function agentePcInfo(): ApkInfo {
  return publicado(AGENTE_PC, AGENTE_PC_META);
}

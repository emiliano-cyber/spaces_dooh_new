// frontend/src/js/photo-utils.js
// Utilidades de fotos: descargar una foto (respetando la rotacion del visor) y
// descargar un album como .zip, grabando dentro de la imagen una marca con la
// ubicacion, la fecha y la hora (lado navegador).

function _triggerDownload(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function _loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url; // mismo origen (servido por el backend) -> el canvas no se "tinta"
  });
}

// Dibuja una barra inferior semitransparente con las lineas de texto dadas.
function _drawOverlay(ctx, canvas, lines) {
  lines = (lines || []).filter(Boolean);
  if (!lines.length) return;
  const fs = Math.max(18, Math.round(canvas.width / 46));
  const pad = Math.round(fs * 0.7);
  const lh = Math.round(fs * 1.35);
  const barH = lines.length * lh + pad * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, canvas.height - barH, canvas.width, barH);
  ctx.fillStyle = '#ffffff';
  ctx.font = fs + 'px Arial, Helvetica, sans-serif';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 3;
  let y = canvas.height - barH + pad;
  for (const line of lines) {
    ctx.fillText(line, pad, y);
    y += lh;
  }
  ctx.shadowBlur = 0;
}

// Renderiza la foto girada `rotation` grados con la marca `overlayLines` y
// devuelve un Blob JPEG.
async function _renderPhoto(url, rotation, overlayLines) {
  const img = await _loadImage(url);
  const r = ((Number(rotation) % 360) + 360) % 360;
  const swap = r === 90 || r === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? img.naturalHeight : img.naturalWidth;
  canvas.height = swap ? img.naturalWidth : img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((r * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0); // vuelve a coords del canvas final
  _drawOverlay(ctx, canvas, overlayLines);
  return await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
}

// Descarga una foto girada `rotation` grados, con la marca `overlayLines`.
async function downloadRotatedImage(url, rotation, filename, overlayLines) {
  const blob = await _renderPhoto(url, rotation, overlayLines);
  const objUrl = URL.createObjectURL(blob);
  _triggerDownload(objUrl, filename);
  setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
}

// Descarga una lista de fotos como .zip. `makeLines(photo)` (opcional) devuelve
// las lineas de marca a grabar en cada foto. onProgress(hechas, total).
async function downloadAlbumZip(photos, zipName, onProgress, makeLines) {
  const zip = new JSZip();
  let done = 0;
  for (const p of photos) {
    try {
      let blob;
      if (makeLines) {
        blob = await _renderPhoto(p.storage_path, 0, makeLines(p));
      } else {
        blob = await (await fetch(p.storage_path)).blob();
      }
      const base = (p.storage_path.split('/').pop() || ('photo_' + p.id + '.jpg'));
      zip.file(base, blob);
    } catch (e) {
      /* omitir la que falle */
    }
    done++;
    if (onProgress) onProgress(done, photos.length);
  }
  const content = await zip.generateAsync({ type: 'blob' });
  const objUrl = URL.createObjectURL(content);
  _triggerDownload(objUrl, zipName);
  setTimeout(() => URL.revokeObjectURL(objUrl), 8000);
}

// Helper para armar las lineas de marca (ubicacion / fecha-hora / GPS).
function photoOverlayLines(photo, siteText) {
  const dt = photo.taken_at ? new Date(photo.taken_at).toLocaleString('es-MX') : '';
  const gps = (photo.gps_lat && photo.gps_lng)
    ? ('GPS: ' + Number(photo.gps_lat).toFixed(5) + ', ' + Number(photo.gps_lng).toFixed(5))
    : null;
  return [siteText || photo.device_name || 'SPACE EYE', dt, gps].filter(Boolean);
}

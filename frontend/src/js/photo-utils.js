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

// Dibuja la marca de informacion en una caja centrada en pos={x,y} (en %, 0-100)
// del canvas. Fondo semitransparente redondeado + sombra = legible sobre cualquier
// fondo. Si pos es null, cae a una barra inferior (compatibilidad).
function _drawOverlay(ctx, canvas, lines, pos) {
  lines = (lines || []).filter(Boolean);
  if (!lines.length) return;
  const W = canvas.width, H = canvas.height;
  const fs = Math.max(16, Math.round(W / 46));
  const padX = Math.round(fs * 0.9);
  const padY = Math.round(fs * 0.6);
  const lh = Math.round(fs * 1.3);

  ctx.font = 'bold ' + fs + 'px Arial, Helvetica, sans-serif';
  ctx.textBaseline = 'top';
  let boxW = 0;
  for (const l of lines) boxW = Math.max(boxW, ctx.measureText(l).width);
  boxW += padX * 2;
  const boxH = lines.length * lh + padY * 2;

  // Centro de la caja en (x%,y%), acotado para que no se salga.
  let cx = ((pos && pos.x != null) ? pos.x : 50) / 100 * W;
  let cy = ((pos && pos.y != null) ? pos.y : 92) / 100 * H;
  let bx = Math.min(Math.max(cx - boxW / 2, 6), W - boxW - 6);
  let by = Math.min(Math.max(cy - boxH / 2, 6), H - boxH - 6);

  // Fondo redondeado semitransparente.
  const r = Math.round(fs * 0.4);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + boxW, by, bx + boxW, by + boxH, r);
  ctx.arcTo(bx + boxW, by + boxH, bx, by + boxH, r);
  ctx.arcTo(bx, by + boxH, bx, by, r);
  ctx.arcTo(bx, by, bx + boxW, by, r);
  ctx.closePath();
  ctx.fill();

  // Texto blanco con sombra.
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 4;
  let ty = by + padY;
  for (const line of lines) { ctx.fillText(line, bx + padX, ty); ty += lh; }
  ctx.shadowBlur = 0;
}

// Lineas de la marca configurable: Nombre · Fecha · Hora, tomando la fecha/hora
// de CAPTURA (taken_at), no la de descarga.
function overlayInfoLines(photo, deviceName) {
  const name = deviceName || photo.device_name || 'SPACE EYE';
  const d = photo.taken_at ? new Date(photo.taken_at) : null;
  const fecha = d ? d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const hora = d ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  return [name, fecha, hora].filter(Boolean);
}

// Renderiza la foto girada `rotation` grados con la marca `overlayLines` y
// devuelve un Blob JPEG.
async function _renderPhoto(url, rotation, overlayLines, pos) {
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
  _drawOverlay(ctx, canvas, overlayLines, pos);
  return await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
}

// Descarga una foto girada `rotation` grados, con la marca `overlayLines` en pos {x,y}%.
async function downloadRotatedImage(url, rotation, filename, overlayLines, pos) {
  const blob = await _renderPhoto(url, rotation, overlayLines, pos);
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

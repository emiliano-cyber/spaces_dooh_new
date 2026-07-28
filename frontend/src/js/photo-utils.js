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

// Dibuja la marca de informacion en una caja centrada en pos={x,y} (%,0-100) del
// canvas, con el estilo `style` (tamaño, peso, color, sombra, fondo, alineacion,
// espaciado). Fondo/sombra = legible sobre cualquier fondo.
function _drawOverlay(ctx, canvas, lines, pos, style) {
  lines = (lines || []).filter(Boolean);
  if (!lines.length) return;
  const W = canvas.width, H = canvas.height;
  const st = style || {};
  const fs = Math.max(12, Math.round((W / 42) * (Number(st.size) || 1.2)));
  const weight = st.weight === 'normal' ? '' : 'bold ';
  const color = st.color || '#ffffff';
  const align = st.align || 'left';
  const lh = Math.round(fs * (Number(st.lineSpacing) || 1.3));
  const letterSp = Number(st.letterSpacing) || 0;
  const useBg = st.bg !== false;
  const useShadow = st.shadow !== false;
  const padX = Math.round(fs * 0.9);
  const padY = Math.round(fs * 0.6);

  ctx.font = weight + fs + 'px Arial, Helvetica, sans-serif';
  ctx.textBaseline = 'top';
  try { ctx.letterSpacing = (letterSp * fs) + 'px'; } catch (_) {}

  let textW = 0;
  for (const l of lines) textW = Math.max(textW, ctx.measureText(l).width);
  const boxW = textW + padX * 2;
  const boxH = lines.length * lh + padY * 2;

  let cx = ((pos && pos.x != null) ? pos.x : 50) / 100 * W;
  let cy = ((pos && pos.y != null) ? pos.y : 92) / 100 * H;
  let bx = Math.min(Math.max(cx - boxW / 2, 6), Math.max(6, W - boxW - 6));
  let by = Math.min(Math.max(cy - boxH / 2, 6), Math.max(6, H - boxH - 6));

  if (useBg) {
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
  }

  ctx.fillStyle = color;
  if (useShadow) { ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4; }
  ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
  const tx = align === 'center' ? bx + boxW / 2 : align === 'right' ? bx + boxW - padX : bx + padX;
  let ty = by + padY;
  for (const line of lines) { ctx.fillText(line, tx, ty); ty += lh; }
  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';
  try { ctx.letterSpacing = '0px'; } catch (_) {}
}

// Devuelve {lines, pos, style} para dibujar la marca de una foto, o nulos si la
// foto ya trae marca quemada (APK vieja) o el overlay esta desactivado. Usa los
// campos que trae /api/photos (device_name, watermark_baked, overlay_x/y/enabled/style).
function photoOverlayArgs(photo) {
  const clean = photo.watermark_baked === 0 || photo.watermark_baked === false;
  const enabled = photo.overlay_enabled !== 0 && photo.overlay_enabled !== false;
  if (!clean || !enabled) return { lines: null, pos: null, style: null };
  let style = photo.overlay_style;
  if (typeof style === 'string') { try { style = JSON.parse(style); } catch (_) { style = null; } }
  return {
    lines: overlayInfoLines(photo, photo.device_name),
    pos: { x: Number(photo.overlay_x != null ? photo.overlay_x : 50), y: Number(photo.overlay_y != null ? photo.overlay_y : 92) },
    style: style || null,
  };
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
async function _renderPhoto(url, rotation, overlayLines, pos, style) {
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
  _drawOverlay(ctx, canvas, overlayLines, pos, style);
  return await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
}

// Descarga una foto girada `rotation` grados, con la marca `overlayLines` en pos {x,y}% y `style`.
async function downloadRotatedImage(url, rotation, filename, overlayLines, pos, style) {
  const blob = await _renderPhoto(url, rotation, overlayLines, pos, style);
  const objUrl = URL.createObjectURL(blob);
  _triggerDownload(objUrl, filename);
  setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
}

// Descarga una lista de fotos como .zip, aplicando a cada foto su marca configurable
// (nombre/fecha/hora en la posicion/estilo del dispositivo) si esta limpia. onProgress(hechas, total).
async function downloadAlbumZip(photos, zipName, onProgress) {
  const zip = new JSZip();
  let done = 0;
  for (const p of photos) {
    try {
      let blob;
      const o = photoOverlayArgs(p);
      if (o.lines) {
        blob = await _renderPhoto(p.storage_path, 0, o.lines, o.pos, o.style);
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

// frontend/src/js/photo-utils.js
// Utilidades de fotos: descargar una foto (respetando la rotacion del visor)
// y descargar un album completo como .zip (lado navegador).

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

// Descarga la imagen de `url` girada `rotation` grados (0/90/180/270) como JPEG.
async function downloadRotatedImage(url, rotation, filename) {
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
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
  const objUrl = URL.createObjectURL(blob);
  _triggerDownload(objUrl, filename);
  setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
}

// Descarga una lista de fotos como .zip. onProgress(hechas, total).
async function downloadAlbumZip(photos, zipName, onProgress) {
  const zip = new JSZip();
  let done = 0;
  for (const p of photos) {
    try {
      const resp = await fetch(p.storage_path);
      const blob = await resp.blob();
      const base = (p.storage_path.split('/').pop() || `photo_${p.id}.jpg`);
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

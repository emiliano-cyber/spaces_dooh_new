// Convierte una imagen subida (data URL) en un creativo HTML para el player DOOH.
// Adaptativo a cualquier pantalla: la imagen completa (contain) va al centro sin
// recorte, y las franjas se rellenan con la MISMA imagen difuminada de fondo → sin
// barras negras y sin perder nada. Responsivo (llena el contenedor a cualquier
// tamaño/proporción). El <img src="data:image…"> se conserva para que la extracción
// a DOOHmain y los previews sigan encontrando la imagen.
//
// Helper compartido: lo usan la pantalla de Creativos y el alta rápida desde la
// ficha de campaña, para que ambos produzcan exactamente el mismo HTML.
export function imagenAHtml(dataUrl: string, nombre: string): string {
  const alt = (nombre || 'creativo').replace(/[<>&"]/g, ' ').trim()
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>' +
    'html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}' +
    '.dooh-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}' +
    `.dooh-bg{position:absolute;inset:0;background:#000 center/cover no-repeat url("${dataUrl}");` +
    'filter:blur(28px) brightness(.55);transform:scale(1.15)}' +
    '.dooh-fg{position:relative;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block}' +
    '</style></head>' +
    '<body><div class="dooh-wrap">' +
    '<div class="dooh-bg"></div>' +
    `<img class="dooh-fg" src="${dataUrl}" alt="${alt}"/>` +
    '</div></body></html>'
  )
}

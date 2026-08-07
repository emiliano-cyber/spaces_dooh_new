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

// La operación inversa: si un creativo HTML es una imagen ENVUELTA por
// `imagenAHtml`, devuelve su data URL. null si es HTML de verdad.
//
// Vive aquí, junto a la función que lo genera, y no copiada en cada consumidor:
// son las dos mitades de la misma convención, y si una cambia el `<img>` la otra
// tiene que enterarse. La pantalla de Creativos tenía su propia copia de esta
// expresión; ahora la importa.
//
// POR QUÉ IMPORTA EN EL SERVIDOR: la miniatura de la rejilla necesita una
// IMAGEN, no el documento. Pintar el HTML entero cuesta ~1 MB y un desenfoque de
// 28 px por creativo — con once en pantalla, el navegador se atasca. Extraer la
// imagen es lo que la interfaz venía haciendo del lado del cliente cuando el
// arte viajaba en el payload; al dejar de mandarlo, esa extracción tiene que
// ocurrir donde ahora está el contenido: en el servidor.
export function imagenDeHtml(codigo?: string | null): string | null {
  if (!codigo) return null
  const m = codigo.match(/<img[^>]+src="(data:image\/[^"]+)"/i)
  return m ? m[1] : null
}

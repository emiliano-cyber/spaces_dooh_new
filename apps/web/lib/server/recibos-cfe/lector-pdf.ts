import 'server-only'
import { AppError } from '../errores'

// ============================================================================
//  lib/server/recibos-cfe/lector-pdf.ts — De los bytes de un PDF a sus lineas.
// ----------------------------------------------------------------------------
//  Es lo UNICO de este modulo que necesita una dependencia, y por eso esta
//  solo: `interprete.ts`, que es donde se decide cuanto dinero se captura, se
//  prueba sin montar nada.
//
//  ─── POR QUE `pdfjs-dist` Y NO LEER EL PDF A MANO ────────────────────────
//  Los recibos de CFE son PDF de TEXTO —72 objetos de fuente, 8 fuentes
//  incrustadas, ningun escaneo—, asi que no hace falta OCR. Pero **mezclan dos
//  codificaciones en la misma pagina**, y ahi esta la trampa:
//
//   · Parte del texto usa fuentes Type1 con `WinAnsiEncoding`. Sale legible al
//     sacar las cadenas del stream tal cual.
//   · Y parte usa fuentes Type0 con `Identity-H`, cuyos codigos NO son
//     Unicode. En estos recibos el desplazamiento es de **-29**, asi que
//     `NO DE SERVICIO` sale crudo como ` 1 2   ' (  6 ( 5 9 , & , 2 `.
//
//  Una extraccion ingenua devuelve una cosa o la otra, **nunca las dos**, y lo
//  que devuelve PARECE texto valido. No falla: miente. Y no se arregla
//  restando 29 a todo, porque entonces se rompe la mitad WinAnsi.
//
//  Lo que resuelve el cruce es el mapa `ToUnicode` de cada fuente, que el PDF
//  trae dentro (3 mapas para las 8 fuentes: los otros 5 son WinAnsi y no lo
//  necesitan). `pdfjs-dist` lo aplica por fuente, que es justo lo que hace
//  falta. Escribir eso a mano significa implementar xref streams, object
//  streams, CMaps y descompresion — dias de trabajo para reimplementar mal una
//  libreria que ya existe. Medido el 2026-09-29 sobre los 72 recibos del
//  cliente: los 72 se leen enteros y correctos.
//
//  ─── ESTE CODIGO LEE ARCHIVOS QUE SUBE UN DESCONOCIDO ────────────────────
//  De ahi las tres defensas, y ninguna es decorativa:
//
//   · `isEvalSupported: false` — pdf.js compila fuentes con `eval()` si se le
//     deja. Un PDF hostil es entrada no confiable y no tiene por que ejecutar
//     nada. (Ademas la CSP de esta app no lleva `unsafe-eval`, asi que en el
//     navegador ni arrancaria; aqui corre en el servidor, donde no hay CSP que
//     lo pare.)
//   · `MAXIMO_BYTES` — un PDF de 500 MB, o una bomba de descompresion, tumba el
//     proceso de la instancia entera. Se corta ANTES de pasarselo a la
//     libreria.
//   · `MAXIMO_PAGINAS` — un recibo tiene 2. Un PDF con 50 000 paginas vacias
//     pesa poco y tarda una eternidad en recorrerse.
//
//  Y `useSystemFonts: false` + `disableFontFace: true` para que no salga a
//  buscar fuentes al sistema ni a la red: aqui solo se quiere el texto.
// ============================================================================

/** 20 MB. El mayor de los 72 recibos del cliente pesa 0.3 MB. */
export const MAXIMO_BYTES = 20 * 1024 * 1024
/** Un recibo de CFE tiene 2 paginas. */
export const MAXIMO_PAGINAS = 30

/**
 * Cuanto puede separarse verticalmente un trozo de texto del anterior y seguir
 * siendo el MISMO renglon. En estos recibos las etiquetas y sus cifras no
 * comparten `y` exacta —la etiqueta va un par de puntos mas abajo—, asi que con
 * tolerancia cero `NO. DE SERVICIO:` y `900000000001` quedarian en renglones
 * distintos y ninguna expresion los volveria a juntar.
 */
const TOLERANCIA_RENGLON = 2.5

/**
 * Las lineas de texto del PDF, en orden de lectura, de todas sus paginas.
 *
 * Un renglon se arma agrupando por `y` y ordenando por `x`, que es lo que
 * reconstruye «etiqueta: valor» a partir de los trozos sueltos que devuelve la
 * libreria. No se usan las `x` para nada mas: las columnas del desglose las
 * resuelve `interprete.ts` por la forma del texto, que no cambia entre las tres
 * plantillas de CFE, y una coordenada si.
 */
export async function leerPaginasDePdf(datos: Uint8Array): Promise<string[]> {
  if (datos.byteLength === 0) throw new AppError('El archivo esta vacio.', 400)
  if (datos.byteLength > MAXIMO_BYTES) {
    throw new AppError('El archivo pesa demasiado para ser un recibo de CFE.', 413)
  }

  // Import dinamico y no estatico: `pdfjs-dist` son ~3 MB de JavaScript que
  // solo hacen falta cuando alguien sube un PDF. Con un import de arriba, cada
  // arranque de la instancia los carga aunque nadie abra esta pantalla.
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')

  // El worker, IMPORTADO A MANO aunque aqui no se use la referencia.
  //
  // pdf.js lo carga solo, con un `import('./pdf.worker.mjs')` que lleva un
  // `webpackIgnore` dentro: ninguna herramienta de empaquetado puede seguir esa
  // linea, asi que el worker NO viaja en el artefacto y la subida falla SOLO EN
  // PRODUCCION con «Setting up fake worker failed». Este import es literal, el
  // trazado si lo sigue, y el modulo queda en la cache — cuando pdf.js lo pida,
  // ya esta. Medido el 2026-09-29 contra el servidor construido.
  //
  // Sin tipos: `pdf.worker.mjs` no publica `.d.ts` porque nadie lo importa a
  // mano — es justo lo que aqui hace falta hacer.
  // @ts-expect-error -- el worker no trae declaraciones y no se usa su export
  await import('pdfjs-dist/legacy/build/pdf.worker.mjs')

  let doc
  try {
    doc = await getDocument({
      data: datos,
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      // Sin esto, un PDF puede pedir recursos fuera. Aqui no hay nada fuera.
      disableAutoFetch: true,
      disableStream: true,
    }).promise
  } catch {
    // El mensaje de la libreria habla de estructuras de PDF. Quien sube un
    // archivo necesita saber que HACER, no que objeto no resolvio.
    throw new AppError('No se pudo abrir el archivo: no parece un PDF valido.', 400)
  }

  try {
    if (doc.numPages > MAXIMO_PAGINAS) {
      throw new AppError(
        `El PDF tiene ${doc.numPages} paginas y un recibo de CFE tiene 2. ` +
          'Sube los recibos por separado.',
        400,
      )
    }

    const lineas: string[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n)
      const contenido = await pagina.getTextContent()
      // `items` mezcla trozos de texto con marcas de contenido estructural
      // (`TextMarkedContent`), que no llevan ni `str` ni `transform`.
      const trozos: { x: number; y: number; texto: string }[] = []
      for (const i of contenido.items) {
        if (!('str' in i) || !('transform' in i)) continue
        if (i.str.trim() === '') continue
        trozos.push({ x: i.transform[4], y: i.transform[5], texto: i.str })
      }

      // De arriba abajo y de izquierda a derecha, que es el orden de lectura.
      trozos.sort((a, b) => b.y - a.y || a.x - b.x)

      const renglones: { y: number; trozos: typeof trozos }[] = []
      for (const t of trozos) {
        const ultimo = renglones[renglones.length - 1]
        if (ultimo && Math.abs(ultimo.y - t.y) <= TOLERANCIA_RENGLON) {
          ultimo.trozos.push(t)
          ultimo.y = (ultimo.y + t.y) / 2
        } else {
          renglones.push({ y: t.y, trozos: [t] })
        }
      }

      for (const r of renglones) {
        lineas.push(
          r.trozos
            .sort((a, b) => a.x - b.x)
            .map((t) => t.texto)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim(),
        )
      }
    }
    return lineas
  } finally {
    // Sin esto, cada PDF leido deja su worker vivo. Con 72 archivos en una
    // sesion eso es memoria que no vuelve.
    await doc.destroy().catch(() => {})
  }
}

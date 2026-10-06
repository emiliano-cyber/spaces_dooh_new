import { beforeAll, describe, expect, it } from 'vitest'
import { MAXIMO_BYTES, leerPaginasDePdf } from './lector-pdf'

// ============================================================================
//  El lector de PDF, contra LA TRAMPA de los recibos de CFE.
// ----------------------------------------------------------------------------
//  Los PDF de prueba de este archivo se construyen aqui, byte a byte, y no son
//  recibos reales: los recibos del cliente llevan razon social, domicilio, RFC
//  y los sellos del CFDI, asi que no se versionan (su texto anonimizado esta en
//  `casos.ts`).
//
//  Lo que estos PDF sinteticos reproducen es lo unico que el lector tiene que
//  resolver y no se ve en un texto ya extraido: **las DOS codificaciones en la
//  misma pagina**. Una fuente `WinAnsiEncoding`, cuyos bytes son el texto, y
//  una fuente `Identity-H` cuyos codigos estan desplazados **-29** y solo se
//  descifran con su mapa `ToUnicode` — que es exactamente lo que hacen los
//  recibos reales, medido sobre los 72 del cliente.
//
//  La prueba que importa es la tercera: un lector que se quede con una sola de
//  las dos codificaciones **no falla, devuelve texto**. Por eso no basta con
//  comprobar que el PDF se abre.
// ============================================================================

const DESPLAZAMIENTO = 29

/** El texto tal como lo codifica una fuente Identity-H desplazada -29. */
function aIdentityH(texto: string): string {
  return (
    '<' +
    [...texto]
      .map((c) => (c.charCodeAt(0) - DESPLAZAMIENTO).toString(16).padStart(4, '0'))
      .join('') +
    '>'
  )
}

const CMAP_MENOS_29 = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
1 beginbfrange
<0003> <0062> <0020>
endbfrange
endcmap
CMapName currentdict /CMap defineresource pop
end
end`

/**
 * Un PDF de una pagina con DOS fuentes: una WinAnsi y una Identity-H con su
 * `ToUnicode`. `renglones` es una lista de `[y, fuente, texto]`.
 */
function pdfDePrueba(renglones: [number, 'ansi' | 'cid', string][]): Uint8Array {
  const contenido = renglones
    .map(([y, fuente, texto]) =>
      fuente === 'ansi'
        ? `BT /F1 10 Tf 25 ${y} Td (${texto.replace(/([()\\])/g, '\\$1')}) Tj ET`
        : `BT /F2 10 Tf 25 ${y} Td ${aIdentityH(texto)} Tj ET`,
    )
    .join('\n')

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 8 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type0 /BaseFont /Sintetica /Encoding /Identity-H ' +
      '/DescendantFonts [6 0 R] /ToUnicode 7 0 R >>',
    '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Sintetica ' +
      '/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> ' +
      '/FontDescriptor 9 0 R /DW 600 >>',
    `<< /Length ${CMAP_MENOS_29.length} >>\nstream\n${CMAP_MENOS_29}\nendstream`,
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /FontDescriptor /FontName /Sintetica /Flags 4 ' +
      '/FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 800 /Descent -200 ' +
      '/CapHeight 700 /StemV 80 >>',
  ]

  let pdf = '%PDF-1.5\n'
  const posiciones: number[] = []
  objetos.forEach((cuerpo, i) => {
    posiciones.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`
  })
  const inicioXref = pdf.length
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (const p of posiciones) pdf += `${String(p).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`
  return new Uint8Array(Buffer.from(pdf, 'latin1'))
}

describe('leerPaginasDePdf', () => {
  // La carga en frio de `pdfjs-dist`, FUERA de las pruebas y con su propio plazo.
  //
  // `lector-pdf.ts` importa pdf.js y su worker con `import()` dinamico, asi que
  // los ~3 MB de JavaScript se cargan en la PRIMERA llamada — y la pagaba entera
  // la primera prueba de este archivo. Medido el 2026-10-05 en la suite completa
  // (241 archivos en paralelo): 218-604 ms la primera prueba, 1-6 ms cada una de
  // las demas. En una corrida anterior, con la maquina saturada, esa carga se
  // paso de los 5 s y fallo «lee el texto de una fuente WinAnsi» por timeout,
  // sin que el lector tuviera nada mal.
  //
  // Se precargan aqui los MISMOS dos especificadores que importa el lector: el
  // modulo queda en la cache y su `import()` ya no cuesta nada. Asi el plazo de
  // 5 s de cada prueba sigue midiendo el comportamiento, y no la cola del disco.
  // Subir el timeout de las pruebas habria tapado tambien un lector lento de
  // verdad.
  beforeAll(async () => {
    await import('pdfjs-dist/legacy/build/pdf.mjs')
    // @ts-expect-error -- el worker no publica `.d.ts` (ver `lector-pdf.ts`)
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  }, 60_000)

  it('lee el texto de una fuente WinAnsi', async () => {
    const lineas = await leerPaginasDePdf(
      pdfDePrueba([[700, 'ansi', 'Comision Federal de Electricidad']]),
    )
    expect(lineas).toContain('Comision Federal de Electricidad')
  })

  it('DESCIFRA la fuente Identity-H con su ToUnicode, en vez de devolver los codigos', async () => {
    const lineas = await leerPaginasDePdf(
      pdfDePrueba([[700, 'cid', 'NO. DE SERVICIO: 900000000001']]),
    )
    expect(lineas).toContain('NO. DE SERVICIO: 900000000001')
    // Y lo que NO puede pasar: devolver el texto crudo, desplazado -29. Esa
    // salida parece texto valido y no da ningun error — es la forma en que este
    // PDF miente.
    expect(lineas.join('\n')).not.toContain('12')
  })

  it('lee las DOS codificaciones en la misma pagina — que es el caso real', async () => {
    // Un lector que resuelva una sola de las dos pasa las dos pruebas de
    // arriba por separado y falla esta, que es la que describe el recibo.
    const lineas = await leerPaginasDePdf(
      pdfDePrueba([
        [700, 'ansi', 'Este grafico refleja tu nivel de consumo.'],
        [680, 'cid', 'NO. DE SERVICIO: 900000000001'],
        [660, 'cid', 'TARIFA: PDBT'],
        [640, 'ansi', 'Total 7,941.35'],
      ]),
    )
    expect(lineas).toContain('Este grafico refleja tu nivel de consumo.')
    expect(lineas).toContain('NO. DE SERVICIO: 900000000001')
    expect(lineas).toContain('TARIFA: PDBT')
    expect(lineas).toContain('Total 7,941.35')
  })

  it('junta en UN renglon los trozos que comparten linea, en orden de izquierda a derecha', async () => {
    // `NO. DE SERVICIO:` y su numero son dos trozos con `y` distinta por dos
    // puntos. Sin agruparlos, ninguna expresion del interprete los vuelve a
    // juntar y el numero de servicio se pierde en los 72 recibos.
    const lineas = await leerPaginasDePdf(
      pdfDePrueba([
        [700, 'ansi', 'TARIFA: PDBT'],
        [699, 'ansi', 'NO. MEDIDOR: A000AA'],
      ]),
    )
    expect(lineas[0]).toBe('TARIFA: PDBT NO. MEDIDOR: A000AA')
  })

  it('devuelve los renglones de arriba abajo', async () => {
    const lineas = await leerPaginasDePdf(
      pdfDePrueba([
        [600, 'ansi', 'abajo'],
        [700, 'ansi', 'arriba'],
      ]),
    )
    expect(lineas).toEqual(['arriba', 'abajo'])
  })

  it('rechaza un archivo vacio', async () => {
    await expect(leerPaginasDePdf(new Uint8Array(0))).rejects.toThrow(/vacio/i)
  })

  it('rechaza lo que no es un PDF, con un mensaje que habla de archivos', async () => {
    const noEsPdf = new Uint8Array(Buffer.from('esto es un .xlsx, no un recibo', 'utf8'))
    await expect(leerPaginasDePdf(noEsPdf)).rejects.toThrow(/no parece un PDF/i)
  })

  it('rechaza un archivo enorme ANTES de pasarselo a la libreria', async () => {
    // Se corta por tamaño y no por confiar en que la libreria aguante: una
    // bomba de descompresion tumba el proceso de la instancia entera, y en este
    // producto una instancia es un cliente.
    const enorme = new Uint8Array(MAXIMO_BYTES + 1)
    await expect(leerPaginasDePdf(enorme)).rejects.toThrow(/pesa demasiado/i)
  })
})

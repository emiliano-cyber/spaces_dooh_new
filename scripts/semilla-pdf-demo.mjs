// ============================================================================
//  semilla-pdf-demo.mjs — PDF inventados para los documentos de la demo.
// ----------------------------------------------------------------------------
//  Lo usa `semilla-catalogo-modulos.mjs`: el contrato de una extensión, la
//  orden de compra del cliente, el comprobante de un abono y el documento de
//  un contrato de arrendamiento se guardan en la base como data URL
//  (`application/pdf`), igual que cuando una persona los sube.
//
//  Un PDF 1.4 de una página, con Helvetica y texto plano, escrito a mano con su
//  tabla `xref` correcta: cualquier visor lo abre. Sin dependencias y
//  determinista (ni fecha de creación ni identificador aleatorio), para que
//  la segunda corrida de la semilla produzca los mismos bytes.
// ============================================================================

function escapar(t) {
  // Solo ASCII imprimible: Helvetica estándar sin tabla de codificación no
  // pinta acentos, y un carácter fuera de rango rompe el visor más quisquilloso.
  return String(t)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/([\\()])/g, '\\$1')
}

/** Bytes de un PDF de una página con un título y líneas de texto. */
export function pdfDeTexto(titulo, lineas) {
  const cuerpo = [
    'BT /F1 18 Tf 56 780 Td (' + escapar(titulo) + ') Tj ET',
    'BT /F1 9 Tf 56 760 Td (DOCUMENTO DE DEMOSTRACION - SIN VALIDEZ) Tj ET',
    ...lineas.map((l, i) => `BT /F1 11 Tf 56 ${730 - i * 18} Td (${escapar(l)}) Tj ET`),
  ].join('\n')
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(cuerpo, 'latin1')} >>\nstream\n${cuerpo}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

export function dataUrlDePdf(titulo, lineas) {
  return `data:application/pdf;base64,${pdfDeTexto(titulo, lineas).toString('base64')}`
}

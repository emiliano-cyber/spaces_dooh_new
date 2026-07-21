export function validateUpload(
  file: { mimetype: string },
  buffer: Buffer,
  allowedTypes: string[],
  maxMB: number,
): void {
  if (!allowedTypes.includes(file.mimetype)) {
    const err = Object.assign(
      new Error(`Formato no permitido. Acepta: ${allowedTypes.join(', ')}`),
      { statusCode: 400 },
    )
    throw err
  }
  const sizeMB = buffer.length / (1024 * 1024)
  if (sizeMB > maxMB) {
    const err = Object.assign(
      new Error(`El archivo excede el límite de ${maxMB}MB`),
      { statusCode: 400 },
    )
    throw err
  }
}

import { describe, it, expect } from 'vitest'
import { validarUpload, LIMITES } from './uploads'

// ============================================================================
//  Hardening 1 · Bloque D — el servidor no confía en el MIME declarado.
//  Cubre lo que pide el GATE D sin necesitar la BD ni el servidor levantado:
//  binario arbitrario disfrazado, payload gigante, y subida legítima.
// ============================================================================

const dataUrl = (mime: string, bytes: number[] | string) =>
  `data:${mime};base64,${Buffer.from(typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : bytes).toString('base64')}`

// Firmas reales de cada formato.
const PNG = dataUrl('image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const JPG = dataUrl('image/jpeg', [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46])
const WEBP = dataUrl('image/webp', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0])
const PDF = dataUrl('application/pdf', '%PDF-1.4\n1 0 obj\n')
// MZ = cabecera de un ejecutable de Windows.
const EXE_BYTES = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00]

const IMAGEN = { allowlist: ['image/jpeg', 'image/png', 'image/webp'] as const, maxMB: 8 }

describe('validarUpload · subidas legítimas', () => {
  it('acepta PNG, JPG y WebP reales', () => {
    for (const v of [PNG, JPG, WEBP]) {
      expect(validarUpload({ base64: v, ...IMAGEN }).tamanoBytes).toBeGreaterThan(0)
    }
  })

  it('acepta un PDF real donde se esperan PDFs', () => {
    const r = validarUpload({ base64: PDF, allowlist: ['application/pdf'], maxMB: 10 })
    expect(r.mime).toBe('application/pdf')
  })
})

describe('validarUpload · binario disfrazado (GATE D)', () => {
  it('rechaza un ejecutable declarado como image/jpeg', () => {
    // Esto es exactamente "un binario arbitrario renombrado .jpg".
    const disfrazado = dataUrl('image/jpeg', EXE_BYTES)
    expect(() => validarUpload({ base64: disfrazado, ...IMAGEN })).toThrow(/no corresponde a un JPG real/)
  })

  it('rechaza un ejecutable declarado como PDF', () => {
    expect(() =>
      validarUpload({ base64: dataUrl('application/pdf', EXE_BYTES), allowlist: ['application/pdf'], maxMB: 10 }),
    ).toThrow(/no corresponde a un PDF real/)
  })

  it('rechaza un PNG real donde solo se aceptan PDFs', () => {
    expect(() => validarUpload({ base64: PNG, allowlist: ['application/pdf'], maxMB: 10 })).toThrow(/no permitido/)
  })

  it('rechaza un tipo que no está en ninguna allowlist', () => {
    expect(() => validarUpload({ base64: dataUrl('application/x-msdownload', EXE_BYTES), ...IMAGEN }))
      .toThrow(/no permitido/)
  })

  it('rechaza lo que no es un data URL', () => {
    expect(() => validarUpload({ base64: 'https://evil.example/foto.jpg', ...IMAGEN })).toThrow(/data URL/)
  })

  it('rechaza un archivo vacío', () => {
    expect(() => validarUpload({ base64: 'data:image/png;base64,', ...IMAGEN })).toThrow(/vacío|data URL/)
  })
})

describe('validarUpload · tamaño (GATE D)', () => {
  it('rechaza un payload muy por encima del límite sin decodificarlo entero', () => {
    // ~50 MB de base64 contra un límite de 8 MB.
    const gigante = 'data:image/png;base64,' + 'A'.repeat(67_000_000)
    expect(() => validarUpload({ base64: gigante, ...IMAGEN })).toThrow(/supera el límite de 8 MB/)
  })

  it('aplica el límite propio de cada punto de subida', () => {
    // Un PNG válido de ~3 MB pasa en creativos (15 MB) y no en el logo (2 MB).
    const relleno = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(3 * 1024 * 1024, 0x41),
    ])
    const png3mb = `data:image/png;base64,${relleno.toString('base64')}`
    expect(() =>
      validarUpload({
        base64: png3mb,
        allowlist: LIMITES.creatividadImagen.allowlist,
        maxMB: LIMITES.creatividadImagen.maxMB,
      }),
    ).not.toThrow()
    expect(() =>
      validarUpload({
        base64: png3mb,
        allowlist: LIMITES.logoEmpresa.allowlist,
        maxMB: LIMITES.logoEmpresa.maxMB,
      }),
    ).toThrow(/supera el límite de 2 MB/)
  })
})

describe('validarUpload · SVG ejecutable (logo)', () => {
  const svg = (cuerpo: string) => dataUrl('image/svg+xml', cuerpo)
  const LOGO = { allowlist: LIMITES.logoEmpresa.allowlist, maxMB: LIMITES.logoEmpresa.maxMB }

  it('acepta un SVG limpio', () => {
    expect(() => validarUpload({ base64: svg('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'), ...LOGO }))
      .not.toThrow()
  })

  it('rechaza un SVG con <script>', () => {
    expect(() => validarUpload({ base64: svg('<svg><script>alert(1)</script></svg>'), ...LOGO }))
      .toThrow(/código ejecutable/)
  })

  it('rechaza un SVG con manejador de eventos', () => {
    expect(() => validarUpload({ base64: svg('<svg onload="fetch(\'/api/usuarios\')"></svg>'), ...LOGO }))
      .toThrow(/código ejecutable/)
  })

  it('rechaza un binario declarado como SVG', () => {
    expect(() => validarUpload({ base64: dataUrl('image/svg+xml', EXE_BYTES), ...LOGO })).toThrow(/no es texto|SVG real/)
  })
})

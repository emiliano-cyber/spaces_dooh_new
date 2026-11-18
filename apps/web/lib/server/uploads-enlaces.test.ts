import { describe, it, expect } from 'vitest'
import { uploadOUrlZod, LIMITES } from './uploads'

// ============================================================================
//  SEG-21OCT · A3 — un enlace a documento solo puede ser un data URL validado
//  o una URL http(s). Nada de `javascript:`.
// ----------------------------------------------------------------------------
//  Auditoría del 2026-10-21. `uploadOUrlZod` hacía
//  `if (!v.startsWith('data:')) return`: todo lo que NO fuera un data URL
//  pasaba sin mirar. Esos campos (`contratoUrl`, `ocUrl`, `documentoUrl`)
//  vuelven al navegador tal cual y se pintan como `href` en «Ver contrato»
//  (`DatosFacturacion.tsx`, `ContratoSheet.tsx`). React 18 solo AVISA en
//  consola ante un `javascript:`, no lo bloquea, y la CSP permite
//  `'unsafe-inline'`.
//
//  El escenario: un vendedor guarda `javascript:fetch(...)` como contrato de
//  su campaña, y el código corre con la sesión del Dueño cuando éste lo abre.
//
//  Y de paso, un data URL en MAYÚSCULAS (`DATA:text/html,…`) se saltaba la
//  validación del tipo, porque la comparación distinguía mayúsculas.
// ============================================================================

const esquema = uploadOUrlZod(LIMITES.contratoPdf.allowlist, LIMITES.contratoPdf.maxMB, 'contratoUrl')
const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n%prueba\n').toString('base64')

describe('A3 · lo que se rechaza', () => {
  it.each([
    ['javascript:', 'javascript:alert(document.domain)'],
    ['JavaScript: con mayúsculas', 'JavaScript:alert(1)'],
    ['javascript: con espacios delante', '   javascript:alert(1)'],
    ['javascript: con un tabulador dentro', 'java\tscript:alert(1)'],
    ['vbscript:', 'vbscript:msgbox(1)'],
    ['data: en mayúsculas con HTML', 'DATA:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
    ['una ruta suelta', '../../api/usuarios'],
    ['un host sin esquema', '//evil.example/x.pdf'],
    ['ftp', 'ftp://evil.example/x.pdf'],
  ])('rechaza %s', (_n, valor) => {
    expect(esquema.safeParse(valor).success).toBe(false)
  })

  it('rechaza una URL desmesurada', () => {
    expect(esquema.safeParse('https://ejemplo.mx/' + 'a'.repeat(3000)).success).toBe(false)
  })
})

describe('A3 · lo que sigue entrando', () => {
  it('un data URL de PDF válido', () => {
    expect(esquema.safeParse(PDF).success).toBe(true)
  })

  it('una URL https de un documento hospedado fuera', () => {
    expect(esquema.safeParse('https://drive.ejemplo.mx/contrato.pdf').success).toBe(true)
  })

  it('y una http, que ya podía haber en la base (no es un XSS, solo un enlace)', () => {
    expect(esquema.safeParse('http://intranet.ejemplo.mx/contrato.pdf').success).toBe(true)
  })

  it('la cadena vacía, que es «sin documento» y ya pasaba antes', () => {
    expect(esquema.safeParse('').success).toBe(true)
  })

  it('con espacios alrededor, que el esquema recorta', () => {
    expect(esquema.safeParse('  https://ejemplo.mx/c.pdf  ').success).toBe(true)
  })
})

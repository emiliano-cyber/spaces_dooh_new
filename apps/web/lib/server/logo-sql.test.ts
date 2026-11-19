import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sqlTokenLogoServible } from './logo-sql'

// ============================================================================
//  Hallazgo B del 19/11 · el logo roto en la cabecera de la liga pública.
//
//  `config_negocio.logo_token` es NOT NULL desde 20260805 (cada organización
//  nace con uno), pero `logo_url` no: una organización sin logo cargado tiene
//  token igual. Los membretes construían `/api/logo/<token>` solo con el token,
//  y esa ruta responde 404 cuando no hay imagen → icono de imagen rota en lo
//  que ve el cliente. El token solo debe salir de la base cuando hay logo.
// ============================================================================

describe('sqlTokenLogoServible', () => {
  it('sin alias: el token solo si logo_url es una imagen data:', () => {
    const s = sqlTokenLogoServible()
    expect(s).toContain('logo_url')
    expect(s).toContain('logo_token')
    expect(s).toMatch(/case when/i)
    expect(s).toMatch(/as logo_token$/)
  })

  it('con alias: califica las dos columnas', () => {
    const s = sqlTokenLogoServible('c')
    expect(s).toContain('c.logo_url')
    expect(s).toContain('c.logo_token')
  })
})

// Los sitios que arman la URL del logo. Ninguno puede leer el token «a pelo»:
// es exactamente el patrón que pintó el logo roto.
const LECTORES = [
  'lib/server/propuestas-repo.ts',
  'lib/server/portal-repo.ts',
  'lib/server/firmas-repo.ts',
  'lib/server/propuestas-envio.ts',
  'lib/server/avisos-sql.ts',
  'app/api/recordatorios/route.ts',
]

describe('ningún membrete lee logo_token sin comprobar que hay logo', () => {
  for (const archivo of LECTORES) {
    it(archivo, () => {
      const texto = readFileSync(join(__dirname, '..', '..', archivo), 'utf8')
      // Literales SQL que seleccionan `logo_token` sin interpolar el helper.
      const sql = texto.match(/`[^`]*`|'[^']*'/g) ?? []
      const malos = sql.filter((s) => /\blogo_token\b/.test(s) && /\bselect\b/i.test(s) && !s.includes('${'))
      expect(malos, `${archivo}: ${malos.join(' | ')}`).toEqual([])
      expect(texto).toContain('sqlTokenLogoServible')
    })
  }
})

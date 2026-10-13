import { describe, it, expect } from 'vitest'
import { resumirPublicacion, textoAccionPublicacion } from './doohmain-resultado'

const ok = (sitio: string, estado = 'published') => ({ sitio, screen: `DM-${sitio}`, ok: true, estado })
const mal = (sitio: string, error: string) => ({ sitio, screen: null, ok: false, error })

describe('resumirPublicacion', () => {
  it('sin el campo doohmain: la integración está apagada, no «todo bien»', () => {
    expect(resumirPublicacion(undefined).tipo).toBe('apagada')
  })

  it('un error general (el SDK ni arrancó) no se confunde con cero pantallas', () => {
    const r = resumirPublicacion({ error: 'Fallo al publicar en DOOHmain' })
    expect(r.tipo).toBe('error')
    expect(r.error).toBe('Fallo al publicar en DOOHmain')
  })

  it('una lista vacía dice que no había pantallas digitales que subir', () => {
    expect(resumirPublicacion([]).tipo).toBe('sin-pantallas')
  })

  it('cuenta publicadas, ya publicadas y fallidas por separado', () => {
    const r = resumirPublicacion([ok('A'), ok('B', 'already_published'), mal('C', 'sitio sin pantalla DOOHmain mapeada')])
    expect(r).toMatchObject({ tipo: 'parcial', publicadas: 1, yaEstaban: 1, fallidas: 1 })
    expect(r.filas).toHaveLength(3)
  })

  it('todas bien es «ok»; todas mal es «error»', () => {
    expect(resumirPublicacion([ok('A'), ok('B')]).tipo).toBe('ok')
    expect(resumirPublicacion([mal('A', 'x')]).tipo).toBe('error')
  })
})

describe('textoAccionPublicacion', () => {
  it('nombra las pantallas que fallaron y por qué, para que Actividad sirva de algo', () => {
    const t = textoAccionPublicacion([ok('A'), mal('CAT-D11', 'sitio sin pantalla DOOHmain mapeada')])
    expect(t).toBe('Publicación en DOOHmain con 1 error(es): CAT-D11 (sitio sin pantalla DOOHmain mapeada)')
  })

  it('sin errores, el texto de siempre', () => {
    expect(textoAccionPublicacion([ok('A')])).toBe('Publicó campaña en DOOHmain')
  })

  it('un reintento se distingue de la primera publicación', () => {
    expect(textoAccionPublicacion([ok('A')], 'reintento')).toBe('Reintento de publicación en DOOHmain sin errores')
    expect(textoAccionPublicacion([mal('B', 'x')], 'reintento')).toBe(
      'Reintento de publicación en DOOHmain con 1 error(es): B (x)',
    )
  })
})

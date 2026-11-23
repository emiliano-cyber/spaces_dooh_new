import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import type { PlanoVallasLiga } from '@/lib/vallas/plano-publico'

// ============================================================================
//  LIGA DEL CLIENTE (dueño, 20/11) · «Así se ven tus vallas». Se rinde el
//  componente REAL en los cuatro idiomas: cada cuadro dice «Tu valla» (nada de
//  Libre/Ocupada ni marcas), sin campos de fecha, y sin pedir nada al servidor
//  (la ocupación es de la organización, no del cliente).
// ============================================================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/p/x',
}))

const fetchEspia = vi.fn(() => new Promise(() => {}))
beforeEach(() => {
  fetchEspia.mockClear()
  vi.stubGlobal('fetch', fetchEspia)
})

const LIGA: PlanoVallasLiga = {
  sitios: [{ id: 'S1', nombre: 'Periférico Sur 4500' }],
  vallas: [
    { id: 'v1', sitioId: 'S1', numero: 'V-001', cara: null, ancho: 6, alto: 3, grupoId: 'g1', posicion: 1, dobla: null },
    { id: 'v2', sitioId: 'S1', numero: 'V-002', cara: null, ancho: 6, alto: 3, grupoId: 'g1', posicion: 2, dobla: null },
    { id: 'v3', sitioId: 'S1', numero: 'V-003', cara: null, ancho: 12, alto: 3, grupoId: null, posicion: null, dobla: null },
  ],
  grupos: [{ id: 'g1', numero: 'G-001', nombre: null, modo: 'una_imagen', sigueFuera: true }],
}

const TEXTO: Record<Idioma, { titulo: string; tuya: string; aria: string; cruza: string; libre: string; ocupada: string }> = {
  es: { titulo: 'Así se ven tus vallas', tuya: 'Tu valla', aria: 'Valla V-003, 12 × 3 m, Tu valla', cruza: 'sigue en otro sitio', libre: 'Libre', ocupada: 'Ocupada' },
  en: { titulo: 'How your poster panels look', tuya: 'Your panel', aria: 'Poster panel V-003, 12 × 3 m, Your panel', cruza: 'continues at another site', libre: 'Free', ocupada: 'Occupied' },
  it: { titulo: 'Ecco come appaiono i tuoi poster', tuya: 'Il tuo poster', aria: 'Poster V-003, 12 × 3 m, Il tuo poster', cruza: 'continua in un altro sito', libre: 'Libero', ocupada: 'Occupato' },
  pt: { titulo: 'Assim ficam seus outdoors', tuya: 'Seu outdoor', aria: 'Outdoor V-003, 12 × 3 m, Seu outdoor', cruza: 'continua em outro ponto', libre: 'Livre', ocupada: 'Ocupado' },
}

const escapar = (s: string) => s.replace(/'/g, '&#x27;')

async function pintar(idioma: Idioma) {
  const { PlanoVallasCliente } = await import('./PlanoVallas')
  return renderToStaticMarkup(createElement(ProveedorIdioma, { idioma }, createElement(PlanoVallasCliente, { plano: LIGA })))
}

describe.each(['es', 'en', 'it', 'pt'] as Idioma[])('el plano de la liga del cliente en %s', (idioma) => {
  it('título, cada cuadro con número, medida y «Tu valla» en texto', async () => {
    const html = await pintar(idioma)
    const tx = TEXTO[idioma]
    expect(html).toContain(escapar(tx.titulo))
    for (const n of ['V-001', 'V-002', 'V-003']) expect(html).toContain(`>${n}<`)
    expect(html).toContain('>12 × 3 m<')
    expect(html.split(`>${escapar(tx.tuya)}<`).length - 1).toBe(3)
    expect(html).toContain(`aria-label="${escapar(tx.aria)}"`)
  })

  it('NEGATIVO · ni Libre ni Ocupada, ni la leyenda, ni campos de fecha', async () => {
    const html = await pintar(idioma)
    const tx = TEXTO[idioma]
    expect(html).not.toContain(`>${tx.libre}<`)
    expect(html).not.toContain(tx.ocupada)
    expect(html).not.toContain('type="date"')
  })

  it('el grupo que sigue fuera de la propuesta lo dice, sin nombrar el otro sitio', async () => {
    expect(await pintar(idioma)).toContain(escapar(TEXTO[idioma].cruza))
  })
})

it('NEGATIVO · no pide nada al servidor (ni la ocupación ni los sitios)', async () => {
  await pintar('es')
  expect(fetchEspia).not.toHaveBeenCalled()
})

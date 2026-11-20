import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import { armarPlano } from '@/lib/vallas/plano'
import type { Valla, GrupoVallas } from '@/lib/vallas/tipos'

// ============================================================================
//  PLANO DE LAS VALLAS (dueño, 20/11) · se rinde el componente REAL, en los
//  cuatro idiomas, con el boceto que aprobó el dueño:
//
//    Sitio: Periférico Sur 4500
//    │ V-001 6x3 Libre │ V-002 6x3 Pepsi │ V-003 12x3 Libre │
//    └─ G-001 (una imagen) ─┘
//
//  (Aquí las reservas son por sitio: con Pepsi, el sitio entero sale ocupado.)
// ============================================================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/vallas',
}))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

const v = (p: Partial<Valla> & { id: string; numero: string }): Valla => ({
  sitioId: 'S1',
  cara: null,
  ancho: 6,
  alto: 3,
  grupoId: null,
  posicion: null,
  notas: null,
  activo: true,
  ...p,
})

const VALLAS = [
  v({ id: 'a', numero: 'V-001', grupoId: 'g1', posicion: 1 }),
  v({ id: 'b', numero: 'V-002', grupoId: 'g1', posicion: 2 }),
  v({ id: 'c', numero: 'V-003', ancho: 12 }),
]
const GRUPOS: GrupoVallas[] = [
  { id: 'g1', numero: 'G-001', nombre: null, modo: 'una_imagen', ancho: 12, alto: 3, notas: null, activo: true },
]
const SITIOS = [{ id: 'S1', nombre: 'Periférico Sur 4500' }]

const TEXTO: Record<Idioma, { sitio: string; libre: string; modo: string; cuadro: string; ocupada: string }> = {
  es: { sitio: 'Sitio: Periférico Sur 4500', libre: 'Libre', modo: 'G-001 (Una sola imagen)', cuadro: 'Valla V-003, 12 × 3 m, Libre', ocupada: 'Valla V-001, 6 × 3 m, Ocupada por Pepsi, Telcel' },
  en: { sitio: 'Site: Periférico Sur 4500', libre: 'Free', modo: 'G-001 (Single image)', cuadro: 'Poster panel V-003, 12 × 3 m, Free', ocupada: 'Poster panel V-001, 6 × 3 m, Occupied by Pepsi, Telcel' },
  it: { sitio: 'Sito: Periférico Sur 4500', libre: 'Libero', modo: 'G-001 (Immagine unica)', cuadro: 'Poster V-003, 12 × 3 m, Libero', ocupada: 'Poster V-001, 6 × 3 m, Occupato da Pepsi, Telcel' },
  pt: { sitio: 'Ponto: Periférico Sur 4500', libre: 'Livre', modo: 'G-001 (Imagem única)', cuadro: 'Outdoor V-003, 12 × 3 m, Livre', ocupada: 'Outdoor V-001, 6 × 3 m, Ocupado por Pepsi, Telcel' },
}

async function pintar(idioma: Idioma, ocupado: boolean): Promise<string> {
  const { PlanoDeSitio } = await import('./PlanoVallas')
  const [sitio] = armarPlano({
    vallas: VALLAS,
    grupos: GRUPOS,
    sitios: SITIOS,
    ocupaciones: ocupado
      ? [
          { sitioId: 'S1', marca: 'Pepsi', campanaId: 'k1', campanaNombre: 'Pepsi Navidad', inicio: '2026-11-20', fin: '2026-12-20' },
          { sitioId: 'S1', marca: 'Telcel', campanaId: 'k2', campanaNombre: 'Telcel', inicio: '2026-11-25', fin: '2026-12-20' },
        ]
      : [],
  })
  return renderToStaticMarkup(createElement(ProveedorIdioma, { idioma }, createElement(PlanoDeSitio, { sitio })))
}

const escapar = (s: string) => s.replace(/'/g, '&#x27;')

describe.each(['es', 'en', 'it', 'pt'] as Idioma[])('el plano de un sitio en %s', (idioma) => {
  it('dice el sitio, cada número con su medida y «Libre» en TEXTO (no solo color)', async () => {
    const html = await pintar(idioma, false)
    expect(html).toContain(escapar(TEXTO[idioma].sitio))
    for (const n of ['V-001', 'V-002', 'V-003']) expect(html).toContain(`>${n}<`)
    expect(html).toContain('>6 × 3 m<')
    expect(html).toContain('>12 × 3 m<')
    expect(html.split(`>${TEXTO[idioma].libre}<`).length - 1).toBe(3)
  })

  it('marca el grupo con su número y su modo', async () => {
    const html = await pintar(idioma, false)
    expect(html).toContain(escapar(TEXTO[idioma].modo))
  })

  it('cada cuadro lleva aria-label con número, medida y estado', async () => {
    expect(await pintar(idioma, false)).toContain(`aria-label="${escapar(TEXTO[idioma].cuadro)}"`)
    expect(await pintar(idioma, true)).toContain(`aria-label="${escapar(TEXTO[idioma].ocupada)}"`)
  })

  it('ocupado: la primera marca y «+n»', async () => {
    const html = await pintar(idioma, true)
    expect(html).toContain('>Pepsi<')
    expect(html).toContain('>+1<')
    expect(html).not.toContain(`>${TEXTO[idioma].libre}<`)
  })
})

describe('el cuadro se dibuja a escala', () => {
  it('el ancho de cada cuadro va en proporción a sus metros', async () => {
    const html = await pintar('es', false)
    // V-001 y V-002 miden 6 m; V-003, 12: el doble de crecimiento.
    expect(html).toMatch(/flex-grow:6[^"]*"[^>]*aria-label="Valla V-001/)
    expect(html).toMatch(/flex-grow:12[^"]*"[^>]*aria-label="Valla V-003/)
  })
})

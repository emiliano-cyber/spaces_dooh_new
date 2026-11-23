import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  VALLAS · LA ESQUINA (dueño, 20/11) · lo que el controller deja pasar al
//  repo en `dobla`: solo 'izquierda', 'derecha' o null (no dobla). Cualquier
//  otra cosa es un 400 ANTES de tocar la base, para que el CHECK
//  `vallas_dobla_ck` no tenga que dar un 500.
// ============================================================================

const { creada, editada } = vi.hoisted(() => ({ creada: vi.fn(), editada: vi.fn() }))

vi.mock('./vallas-repo', () => ({
  crearValla: creada,
  actualizarValla: editada,
  borrarValla: vi.fn(),
  crearGrupo: vi.fn(),
  actualizarGrupo: vi.fn(),
  borrarGrupo: vi.fn(),
  crearCategoria: vi.fn(),
  actualizarCategoria: vi.fn(),
  contextoParaVerificar: vi.fn(),
  ocupacionDeVallas: vi.fn(),
  VallaError: class extends Error {},
  VALLA_NO_ENCONTRADA: 'Valla no encontrada',
  GRUPO_NO_ENCONTRADO: 'Grupo de vallas no encontrado',
  CATEGORIA_NO_ENCONTRADA: 'Categoría de competencia no encontrada',
}))

const { crearVallaCtrl, actualizarVallaCtrl } = await import('./vallas-controller')

const SITIO = '7f1c2a54-3b1e-4c8e-9a51-1b2c3d4e5f60'
const BASE = { sitioId: SITIO, numero: 'V-001', ancho: 6, alto: 3 }

beforeEach(() => {
  creada.mockReset().mockImplementation(async (d: unknown) => ({ id: 'x', ...(d as object) }))
  editada.mockReset().mockImplementation(async (_id: string, d: unknown) => ({ id: 'x', ...(d as object) }))
})

describe('dobla en el alta y la edición de una valla', () => {
  it.each(['izquierda', 'derecha', null] as const)('acepta %s y lo pasa al repo', async (dobla) => {
    await crearVallaCtrl({ ...BASE, dobla })
    expect(creada.mock.calls[0][0].dobla).toBe(dobla)
    await actualizarVallaCtrl('x', { dobla })
    expect(editada.mock.calls[0][1].dobla).toBe(dobla)
  })

  it('sin `dobla` en el cuerpo no se toca (undefined): editar otra cosa no borra la esquina', async () => {
    await actualizarVallaCtrl('x', { notas: 'n' })
    expect(editada.mock.calls[0][1]).not.toHaveProperty('dobla')
  })

  it.each(['arriba', 'Derecha', '', 1, true])('rechaza %j con 400 sin llegar al repo', async (dobla) => {
    await expect(crearVallaCtrl({ ...BASE, dobla })).rejects.toMatchObject({ status: 400 })
    await expect(actualizarVallaCtrl('x', { dobla })).rejects.toMatchObject({ status: 400 })
    expect(creada).not.toHaveBeenCalled()
    expect(editada).not.toHaveBeenCalled()
  })
})

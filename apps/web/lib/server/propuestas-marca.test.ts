import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  PROP-MARCA (20/11) · el campo «Marca» de la propuesta, en el CONTRATO entre
//  el controller y el repo. Opcional, recortado, máximo 120, vacío → null (que
//  es «cuenta el cliente»). El repo se simula entero por el mismo motivo que en
//  `propuestas-vendedor.test.ts`: el real arrastra `tenant.ts` y `cache()`.
// ============================================================================

const { crearPropuestaMock } = vi.hoisted(() => ({
  crearPropuestaMock: vi.fn(async (input: unknown) => ({ id: 'P1', input })),
}))

vi.mock('./propuestas-repo', () => ({
  crearPropuesta: (input: unknown) => crearPropuestaMock(input),
  aprobarItem: vi.fn(),
  PropuestaError: class PropuestaError extends Error {},
  validarRangoFechas: vi.fn(),
}))
vi.mock('./volumen-repo', () => ({ listarEscalasVolumen: vi.fn(async () => []) }))
vi.mock('./rejilla-repo', () => ({ listarFranjas: vi.fn(async () => []), listarTemporadas: vi.fn(async () => []) }))
vi.mock('./tarifas-repo', () => ({
  datosParaTarifar: vi.fn(async () => ({ sitios: new Map(), temporadas: [] })),
}))
vi.mock('./auth', () => ({
  usuarioActual: vi.fn(async () => ({ id: 'U-DUENO', rol: 'DUENO' })),
  tienePermiso: vi.fn(async () => true),
}))

import { crearPropuestaCtrl } from './propuestas-controller'

const CUERPO = {
  nombre: 'Campaña de prueba',
  fechaInicio: '2026-02-01',
  fechaFin: '2026-02-28',
  items: [{ sitioId: 'S1', precio: 1000 }],
}
const marcaEnviada = () => (crearPropuestaMock.mock.calls[0][0] as { marca?: string | null }).marca

beforeEach(() => crearPropuestaMock.mockClear())

describe('crear propuesta · la marca', () => {
  it('llega al repo recortada', async () => {
    await crearPropuestaCtrl({ ...CUERPO, marca: '  Pepsi  ' })
    expect(marcaEnviada()).toBe('Pepsi')
  })

  it('vacía o en blanco → null (cuenta el cliente)', async () => {
    await crearPropuestaCtrl({ ...CUERPO, marca: '   ' })
    expect(marcaEnviada()).toBeNull()
  })

  it('ausente → null', async () => {
    await crearPropuestaCtrl(CUERPO)
    expect(marcaEnviada()).toBeNull()
  })

  it('más de 120 caracteres → 400 y no se guarda nada', async () => {
    await expect(crearPropuestaCtrl({ ...CUERPO, marca: 'x'.repeat(121) })).rejects.toMatchObject({ status: 400 })
    expect(crearPropuestaMock).not.toHaveBeenCalled()
  })
})

// Guards de fuente: el repo persiste la marca al crear y al editar, y la
// campaña la hereda. Se quitan los comentarios para que un guard no case con
// su propia advertencia.
function sinComentarios(f: string): string {
  return f
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
}
const REPO = sinComentarios(readFileSync(join(__dirname, 'propuestas-repo.ts'), 'utf8'))
const CAMPANAS = sinComentarios(readFileSync(join(__dirname, 'campanas-repo.ts'), 'utf8'))

describe('guards de fuente', () => {
  it('el INSERT de la propuesta escribe la columna marca', () => {
    expect(REPO).toMatch(/insert into propuestas \([^)]*\bmarca\b/)
  })

  it('editar la propuesta puede poner o quitar la marca', () => {
    expect(REPO).toMatch(/sets\.push\(`marca=\$\$\{i\+\+\}`\)/)
  })

  it('la campaña generada desde la propuesta hereda la marca', () => {
    const gen = CAMPANAS.slice(CAMPANAS.indexOf('export async function generarCampanaDesdePropuesta'))
    expect(gen).toMatch(/insert into campanas \([^)]*\bmarca\b/)
  })
})

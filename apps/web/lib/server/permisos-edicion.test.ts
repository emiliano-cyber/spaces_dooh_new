import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  PERMISOS-EDITABLES (11/11) · el Dueño cambia la matriz desde Administración.
// ----------------------------------------------------------------------------
//  Lo que se defiende, y los negativos son el corazón:
//   · solo el DUEÑO cambia permisos (ni el Administrador);
//   · la columna del Dueño no se toca: siempre lo tiene todo, para que nadie
//     deje la instalación sin quien la administre;
//   · solo pares módulo/acción que existen (los que tiene el Dueño);
//   · ni roles retirados ni inventados;
//   · con VARIAS organizaciones en el servidor, no: la tabla es del servidor
//     entero y el Dueño de una cambiaría los permisos de las demás.
// ============================================================================

const sql: { texto: string; params: unknown[] }[] = []
let organizaciones = 1
vi.mock('./db', () => ({
  qRaw: vi.fn(async (texto: string, params: unknown[] = []) => {
    sql.push({ texto, params })
    if (/count\(\*\).*from tenants/i.test(texto)) return [{ n: organizaciones }]
    if (/from rol_permisos where rol = 'DUENO'/i.test(texto))
      return [
        { modulo: 'comercial', accion: 'ver' },
        { modulo: 'comercial', accion: 'crear' },
        { modulo: 'finanzas', accion: 'facturar' },
        { modulo: 'administracion', accion: 'crear' },
      ]
    return []
  }),
}))

const { cambiarPermiso } = await import('./permisos-edicion')
const DUENO = { id: 'u1', rol: 'DUENO' }

const escrituras = () => sql.filter((s) => /^\s*(insert|delete)/i.test(s.texto))

beforeEach(() => {
  sql.length = 0
  organizaciones = 1
})

describe('cambiarPermiso', () => {
  it('el Dueño CONCEDE: inserta la fila, idempotente', async () => {
    await cambiarPermiso({ rol: 'VENDEDOR', modulo: 'comercial', accion: 'crear', permitido: true }, DUENO)
    const w = escrituras()
    expect(w).toHaveLength(1)
    expect(w[0].texto).toMatch(/insert into rol_permisos/i)
    expect(w[0].texto).toMatch(/on conflict/i)
    expect(w[0].params).toEqual(['VENDEDOR', 'comercial', 'crear'])
  })

  it('el Dueño QUITA: borra solo esa fila', async () => {
    await cambiarPermiso({ rol: 'FINANZAS', modulo: 'finanzas', accion: 'facturar', permitido: false }, DUENO)
    const w = escrituras()
    expect(w).toHaveLength(1)
    expect(w[0].texto).toMatch(/delete from rol_permisos where rol = \$1 and modulo = \$2 and accion = \$3/i)
    expect(w[0].params).toEqual(['FINANZAS', 'finanzas', 'facturar'])
  })

  it('NEGATIVO · el Administrador no cambia permisos (403) y no escribe nada', async () => {
    await expect(
      cambiarPermiso({ rol: 'VENDEDOR', modulo: 'comercial', accion: 'crear', permitido: true }, { id: 'u2', rol: 'ADMINISTRADOR' }),
    ).rejects.toMatchObject({ status: 403 })
    expect(escrituras()).toHaveLength(0)
  })

  it('NEGATIVO · la columna del Dueño no se toca, ni para quitar ni para poner', async () => {
    for (const permitido of [false, true]) {
      await expect(
        cambiarPermiso({ rol: 'DUENO', modulo: 'administracion', accion: 'crear', permitido }, DUENO),
      ).rejects.toMatchObject({ status: 400 })
    }
    expect(escrituras()).toHaveLength(0)
  })

  it('NEGATIVO · un módulo o una acción que no existen no se crean', async () => {
    await expect(
      cambiarPermiso({ rol: 'VENDEDOR', modulo: 'inventado', accion: 'ver', permitido: true }, DUENO),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      cambiarPermiso({ rol: 'VENDEDOR', modulo: 'comercial', accion: 'facturar', permitido: true }, DUENO),
    ).rejects.toMatchObject({ status: 400 })
    expect(escrituras()).toHaveLength(0)
  })

  it('NEGATIVO · roles retirados (COMERCIAL, CLIENTE) o inventados no se aceptan', async () => {
    for (const rol of ['COMERCIAL', 'CLIENTE', 'SUPERADMIN']) {
      await expect(
        cambiarPermiso({ rol, modulo: 'comercial', accion: 'ver', permitido: true }, DUENO),
      ).rejects.toMatchObject({ status: 400 })
    }
    expect(escrituras()).toHaveLength(0)
  })

  it('NEGATIVO · con varias organizaciones en el servidor se rechaza (409) sin escribir', async () => {
    organizaciones = 2
    await expect(
      cambiarPermiso({ rol: 'VENDEDOR', modulo: 'comercial', accion: 'crear', permitido: true }, DUENO),
    ).rejects.toMatchObject({ status: 409 })
    expect(escrituras()).toHaveLength(0)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  El VENDEDOR de una propuesta se toma de la SESIÓN. Nunca del cuerpo.
// ----------------------------------------------------------------------------
//  Es la mitad de seguridad de esta tarea, y el modo de fallo es de dinero: si
//  el `usuario_id` viajara en el JSON de la petición, cualquiera con permiso de
//  `comercial.crear` podría atribuirse una venta ajena —o cargarle a otro un
//  descuento del 80 %— con un `curl`. No daría ningún error: la propuesta se
//  crearía igual y solo cambiaría el nombre de la tabla del reporte.
//
//  Se prueba en DOS planos, y hacen falta los dos:
//
//   1. El CONTRATO de entrada (aquí, con el repo simulado). Lo que el controller
//      le pasa al repo no puede traer un `usuarioId` que venga de fuera. Zod ya
//      recorta lo que no declara su esquema, pero eso es un comportamiento por
//      omisión que una `.passthrough()` futura desactivaría en silencio.
//   2. Contra POSTGRES y por la red, en `vendedor-en-propuesta.e2e.test.ts`:
//      una petición real con `usuarioId` de OTRO usuario dentro, y la fila leída
//      de la base.
//
//  Y un guard de fuente para lo que no se puede simular: que el repo tome el id
//  de `usuarioActual()` y no de su argumento.
// ============================================================================

// El repo se sustituye ENTERO y no con `importActual`: el módulo real arrastra
// `tenant.ts`, que llama a `cache()` de React y no existe fuera de una request.
// Lo que aquí se mide es el CONTRATO entre controller y repo, no el repo.
const { crearPropuestaMock } = vi.hoisted(() => ({
  crearPropuestaMock: vi.fn(async (input: unknown) => ({ id: 'P1', input })),
}))

vi.mock('./propuestas-repo', () => ({
  crearPropuesta: (input: unknown) => crearPropuestaMock(input),
  aprobarItem: vi.fn(),
  PropuestaError: class PropuestaError extends Error {},
  validarRangoFechas: vi.fn(),
}))

// `rejilla-repo` se sustituye por el MISMO motivo que `propuestas-repo` arriba,
// y no porque esta prueba tenga nada que ver con las franjas: desde REJILLA-01
// el controller lo importa para validar la franja contratada, y el módulo real
// arrastra `tenant.ts`, que llama a `cache()` de React y no existe fuera de una
// request. Sin esto el archivo entero deja de cargar con `cache is not a
// function`, que no dice nada de lo que aquí se mide.
vi.mock('./rejilla-repo', () => ({
  listarFranjas: vi.fn(async () => []),
  listarTemporadas: vi.fn(async () => []),
}))

import { crearPropuestaCtrl } from './propuestas-controller'

// Lo mínimo que `crearSchema` acepta.
const CUERPO_VALIDO = {
  nombre: 'Campaña de prueba',
  fechaInicio: '2026-02-01',
  fechaFin: '2026-02-28',
  items: [{ sitioId: 'S1', precio: 1000 }],
}

beforeEach(() => {
  crearPropuestaMock.mockClear()
})

describe('el vendedor NO se puede mandar desde el cliente', () => {
  it('un `usuarioId` en el cuerpo NO llega al repo', async () => {
    await crearPropuestaCtrl({ ...CUERPO_VALIDO, usuarioId: 'VENDEDOR-AJENO' })
    expect(crearPropuestaMock).toHaveBeenCalledTimes(1)
    const enviado = crearPropuestaMock.mock.calls[0][0] as Record<string, unknown>
    // Ni con ese nombre ni con ninguna variante: lo que se comprueba es que el
    // identificador ajeno NO esté en ninguna parte de lo que se va a persistir.
    expect(JSON.stringify(enviado)).not.toContain('VENDEDOR-AJENO')
    expect(Object.keys(enviado)).not.toContain('usuarioId')
    expect(Object.keys(enviado)).not.toContain('usuario_id')
    expect(Object.keys(enviado)).not.toContain('vendedorId')
  })

  it('tampoco escondido dentro de un ítem', async () => {
    await crearPropuestaCtrl({
      ...CUERPO_VALIDO,
      items: [{ sitioId: 'S1', precio: 1000, usuarioId: 'VENDEDOR-AJENO' }],
    })
    const enviado = crearPropuestaMock.mock.calls[0][0]
    expect(JSON.stringify(enviado)).not.toContain('VENDEDOR-AJENO')
  })

  it('el cuerpo legítimo sigue llegando entero (control positivo)', async () => {
    // Sin esto, un controller que devolviera un objeto vacío pasaría las dos
    // pruebas de arriba sin hacer nada.
    await crearPropuestaCtrl(CUERPO_VALIDO)
    const enviado = crearPropuestaMock.mock.calls[0][0] as any
    expect(enviado.nombre).toBe('Campaña de prueba')
    expect(enviado.items).toHaveLength(1)
    expect(enviado.items[0].sitioId).toBe('S1')
  })
})

// ─── Guards de fuente ───────────────────────────────────────────────────────
//
// Normalizan los finales de línea antes de mirar, y quitan los comentarios: es
// la lección del 2026-09-18 de `reportes-repo.aislamiento.test.ts`. Un guard que
// casa con su propio comentario de advertencia se arregla borrando la
// advertencia, que es exactamente lo que no debe pasar.
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
}

const REPO = sinComentarios(readFileSync(join(__dirname, 'propuestas-repo.ts'), 'utf8'))
const CONTROLLER = sinComentarios(readFileSync(join(__dirname, 'propuestas-controller.ts'), 'utf8'))

describe('el repo toma el vendedor de la sesión, no de su argumento', () => {
  it('`crearPropuesta` estampa `usuario_id` en el INSERT', () => {
    const insert = REPO.replace(/\s+/g, ' ').match(/insert into propuestas \([^)]*\)/i)
    expect(insert, 'no se encuentra el INSERT de propuestas').toBeTruthy()
    expect(insert![0]).toContain('usuario_id')
  })

  it('el valor sale de `usuarioActual()`, que lee la COOKIE de sesión', () => {
    // Es el mismo camino que `tenantActual()`, y por la misma razón: lo que
    // decide quién eres no puede entrar por el cuerpo de la petición.
    expect(REPO).toMatch(/usuarioActual\(\)/)
    expect(REPO).toMatch(/import .*usuarioActual.* from '\.\/auth'/)
  })

  it('`PropuestaInput` NO declara ningún campo de usuario: no hay por dónde', () => {
    // El guard que hace que el typecheck sea la otra mitad del candado. Si el
    // tipo de entrada admitiera `usuarioId`, el día que alguien lo pase el
    // compilador diría que sí.
    const input = REPO.match(/export interface PropuestaInput \{[\s\S]*?\n\}/)
    expect(input, 'no se encuentra PropuestaInput').toBeTruthy()
    expect(input![0]).not.toMatch(/usuarioId|usuario_id|vendedorId/)
  })

  it('el esquema zod del controller NO declara usuario ni hace passthrough', () => {
    expect(CONTROLLER).not.toMatch(/usuarioId|usuario_id|vendedorId/)
    // `.passthrough()` desactivaría el recorte de zod y volvería a abrir el
    // agujero sin tocar ninguna otra línea.
    expect(CONTROLLER).not.toMatch(/\.passthrough\(\)/)
  })
})

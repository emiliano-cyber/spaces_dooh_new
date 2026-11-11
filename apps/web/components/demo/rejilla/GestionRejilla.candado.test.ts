import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { confirmarConCandado } from '@/lib/cambios-candado'
import { MENSAJE_DESBLOQUEO } from '@/lib/cambios-mensajes'
import { guardarFranjaApi, bajaTemporadaApi } from '@/lib/data/rejilla-api'

// ============================================================================
//  B41 · `/franjas-y-temporadas` con el candado de cambios ENCENDIDO.
// ----------------------------------------------------------------------------
//  EL DEFECTO, para que no vuelva. Las seis rutas que usa la pantalla
//  (`app/api/rejilla/franjas/**` y `app/api/rejilla/temporadas/**`) pasan por
//  `exigirCambioSensible`. Su hermana de la ficha de pantalla
//  (`RejillaDialog.tsx`) monta `useCandado` + `PasoContrasena`; ésta NO montaba
//  nada: sus tres manejadores hacían `setError(e.message)` y punto. Con
//  `tenants.exigir_reautenticacion = true` el dueño veía el texto del 403 en
//  rojo y NINGÚN sitio donde teclear la contraseña — la única pantalla del
//  producto sin salida.
//
//  QUÉ SE AFIRMA. La sección 1 corre la secuencia REAL con el cliente real de
//  `rejilla-api` y `fetch` espiado: el 403 del candado tiene que llegar como
//  «pide la contraseña» y no como un error rojo. La 2 lee el fuente, porque el
//  cuadro vive en un `Dialog.Portal` de Radix que en servidor no rinde — mismo
//  método que `candado-inventario-y-fichas.test.ts`.
//
//  LO QUE NO AFIRMA: no hay navegador. No se prueba que al pulsar «Añadir»
//  aparezca el cuadro ni dónde cae el foco.
// ============================================================================

const RAIZ = join(__dirname, '..', '..', '..')
const GESTION = readFileSync(join(RAIZ, 'components/demo/rejilla/GestionRejilla.tsx'), 'utf8')

const fetchOriginal = globalThis.fetch
afterEach(() => {
  globalThis.fetch = fetchOriginal
})

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
}

function espiarRed(responder: () => Response) {
  const llamadas: string[] = []
  globalThis.fetch = vi.fn(async (u: unknown) => {
    llamadas.push(String(u))
    return responder()
  }) as unknown as typeof fetch
  return llamadas
}

const BLOQUEADO = () => json({ error: MENSAJE_DESBLOQUEO, requiereDesbloqueo: true }, 403)

describe('1 · el 403 del candado llega como «pide la contraseña», no como error', () => {
  it('alta de franja bloqueada → `pedir-contrasena`, sin desbloquear nada todavía', async () => {
    espiarRed(BLOQUEADO)
    const desbloquear = vi.fn(async () => {})
    const r = await confirmarConCandado({
      reautenticando: false,
      contrasena: '',
      desbloquear,
      guardar: () => guardarFranjaApi({ nombre: 'Prime', horaInicio: '06:00', horaFin: '10:00', orden: 0 }),
    })
    expect(r).toEqual({ estado: 'pedir-contrasena', error: null })
    expect(desbloquear).not.toHaveBeenCalled()
  })

  it('con la contraseña: desbloquea PRIMERO y después repite la MISMA baja', async () => {
    const orden: string[] = []
    globalThis.fetch = vi.fn(async (u: unknown) => {
      orden.push(String(u))
      return json({})
    }) as unknown as typeof fetch
    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: 'secreta',
      desbloquear: async () => {
        orden.push('desbloquear')
      },
      guardar: () => bajaTemporadaApi('T-1'),
    })
    expect(r).toEqual({ estado: 'hecho' })
    expect(orden[0]).toBe('desbloquear')
    expect(orden[1]).toMatch(/\/api\/rejilla\/temporadas\/T-1\//)
  })
})

describe('2 · la pantalla MONTA el candado (lee el fuente)', () => {
  it('usa `useCandado` y pinta un cuadro donde teclear la contraseña', () => {
    expect(GESTION).toMatch(/useCandado\(\)/)
    // Los botones de esta pantalla son de UN CLIC, sin cuadro propio: la regla
    // de `ui/candado.tsx` es que el 403 ABRA uno atado a esa acción exacta.
    expect(GESTION).toMatch(/<DialogoCandado\b/)
  })

  it('las TRES escrituras pasan por `candado.ejecutar`, ninguna va directa', () => {
    for (const api of ['guardarFranjaApi', 'guardarTemporadaApi', 'bajaFranjaApi', 'bajaTemporadaApi']) {
      // `await guardarFranjaApi(...)` a pelo, fuera del candado, es el defecto.
      expect(GESTION, `${api} se llama sin pasar por el candado`).not.toMatch(new RegExp(`await ${api}\\(`))
    }
    const usos = GESTION.match(/candado\.ejecutar\(/g) ?? []
    expect(usos.length).toBeGreaterThanOrEqual(3)
  })

  it('un error que NO es el candado sigue saliendo en el hueco de error de la pantalla', () => {
    // `alFallar` es la única salida de un fallo cuando el cuadro no está a la
    // vista; sin él, un 409 por solape se perdería sin decir nada.
    const fallos = GESTION.match(/alFallar:\s*\(?\w*\)?\s*=>\s*setError/g) ?? []
    expect(fallos.length).toBeGreaterThanOrEqual(3)
  })
})

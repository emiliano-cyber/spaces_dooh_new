import 'server-only'
import { leerVallasDePropuestaPorToken } from './vallas-publicas-repo'
import { MINIMO_VALLAS_PLANO_LIGA, type PlanoVallasLiga } from '@/lib/vallas/plano-publico'
import { DOBLECES, MODOS_GRUPO, type Dobla, type ModoGrupo } from '@/lib/vallas/tipos'

// ============================================================================
//  lib/server/vallas-publicas-controller.ts — CONTROLLER del plano de vallas
//  en la liga pública (dueño, 20/11: «si es valla, cómo se ven las pantallas
//  que rentará, si es más de 1; si solo es una, sin tema»).
// ----------------------------------------------------------------------------
//  Decide (MÁS de una valla activa entre todos los sitios de la propuesta) y
//  arma la respuesta con LISTA BLANCA y con ids OPACOS: la liga nunca expuso
//  ids de vallas ni de grupos, y no va a empezar aquí. Con 0 o 1 valla
//  devuelve `null` y la ruta no añade NADA al JSON: la liga queda igual que
//  antes, byte a byte.
//
//  Si la lectura falla, `null` y un `console.error`: la liga es lo que el
//  cliente abre para aceptar, y un plano roto no puede tumbarla.
// ============================================================================

const TOKEN_VALIDO = /^[A-Za-z0-9_-]{16,128}$/

export async function planoVallasDeLiga(token: string): Promise<PlanoVallasLiga | null> {
  const tok = (token ?? '').trim()
  if (!TOKEN_VALIDO.test(tok)) return null

  let leido: Awaited<ReturnType<typeof leerVallasDePropuestaPorToken>>
  try {
    leido = await leerVallasDePropuestaPorToken(tok)
  } catch (e) {
    console.error('[liga] no se pudo leer el plano de vallas', e)
    return null
  }
  if (!leido || leido.vallas.length < MINIMO_VALLAS_PLANO_LIGA) return null

  const idGrupo = new Map<string, string>()
  for (const v of leido.vallas) {
    if (v.grupoId && !idGrupo.has(v.grupoId)) idGrupo.set(v.grupoId, `g${idGrupo.size + 1}`)
  }

  return {
    sitios: leido.sitios.map((s) => ({ id: s.id, nombre: s.nombre })),
    vallas: leido.vallas.map((v, i) => ({
      id: `v${i + 1}`,
      sitioId: v.sitioId,
      numero: v.numero,
      cara: v.cara ?? null,
      ancho: v.ancho,
      alto: v.alto,
      grupoId: v.grupoId ? (idGrupo.get(v.grupoId) ?? null) : null,
      posicion: v.posicion ?? null,
      dobla: (DOBLECES as readonly string[]).includes(v.dobla ?? '') ? (v.dobla as Dobla) : null,
    })),
    // Solo los grupos con vallas en la propuesta, en el orden en que se
    // numeraron arriba.
    grupos: leido.grupos
      .filter((g) => idGrupo.has(g.id))
      .map((g) => ({
        id: idGrupo.get(g.id)!,
        numero: g.numero,
        nombre: g.nombre ?? null,
        modo: ((MODOS_GRUPO as readonly string[]).includes(g.modo) ? g.modo : 'separadas') as ModoGrupo,
        sigueFuera: g.sigueFuera === true,
      }))
      .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1))),
  }
}

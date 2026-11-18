import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { tienePermiso, type UsuarioSesion } from './auth'
import { filasConteoDiario } from './propuestas-resumen-repo'
import { hoyDeVigencia, zonaDelNegocio } from '@/lib/propuesta-vigencia'
import { conteoPorDia, diasEntre, ventanaDeDias, type ConteoDiario } from '@/lib/propuestas-por-dia'

// ============================================================================
//  lib/server/propuestas-conteo-controller.ts — CONTEO-DIA (17/11): las
//  campañas que creó y las que le aprobaron a cada vendedor, día por día.
//  No conoce HTTP. Plan: `docs/Plan_Conteo_Campanas_Por_Dia.md`.
//
//  QUIÉN VE QUÉ: quien puede aprobar en Comercial (Dueño, Administrador,
//  Director comercial, Gerente de ventas) ve a todos; quien no, solo lo suyo.
//  Es la regla de `soloDe()` de Captación, con el permiso de Comercial.
// ============================================================================

/** Sin fechas, el bloque del Dashboard: los últimos 30 días. */
export const DIAS_POR_OMISION = 30
/** Un trimestre con holgura: más es un reporte, no un tablero por día. */
export const MAX_DIAS = 92

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
const schema = z.object({ desde: FECHA.optional(), hasta: FECHA.optional() })

/**
 * null = ve a todos. Un id = solo ese vendedor. Sale de la SESIÓN: no hay
 * parámetro de la URL que lo cambie (`conteo-diario.e2e.test.ts`).
 */
export async function soloVendedorDe(u: UsuarioSesion): Promise<string | null> {
  return (await tienePermiso(u.rol, 'comercial', 'aprobar')) ? null : u.id
}

function esDia(d: string): boolean {
  const t = new Date(`${d}T00:00:00Z`)
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d
}

export async function conteoDiarioCtrl(
  u: UsuarioSesion,
  query: Record<string, string | undefined>,
): Promise<{ desde: string; hasta: string; soloPropio: boolean; conteo: ConteoDiario }> {
  const d = validar(schema, query)
  const { desde, hasta } =
    d.desde && d.hasta ? { desde: d.desde, hasta: d.hasta } : ventanaDeDias(hoyDeVigencia(), DIAS_POR_OMISION)
  // `2026-02-31` pasa la expresión y no es un día. `Date.parse` tampoco lo
  // caza: V8 lo acepta y lo corre al 3 de marzo. Se valida de ida y vuelta.
  // Los mensajes son los que ya están en el catálogo de los cuatro idiomas.
  if (!esDia(desde) || !esDia(hasta)) throw new AppError('Fecha inválida', 400)
  const n = diasEntre(desde, hasta).length
  if (n === 0 || n > MAX_DIAS) throw new AppError('Fecha fuera de rango', 400)

  const solo = await soloVendedorDe(u)
  const filas = await filasConteoDiario({ zona: zonaDelNegocio(), desde, hasta, soloUsuario: solo })
  return { desde, hasta, soloPropio: solo !== null, conteo: conteoPorDia(filas, desde, hasta) }
}

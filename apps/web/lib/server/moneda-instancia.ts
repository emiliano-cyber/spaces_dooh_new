import 'server-only'
// `tenants` NO tiene RLS fail-closed (igual que en `tenant.ts:hayAlgunTenant`):
// leer la moneda de la instancia no necesita sesion ni GUC, y el layout raiz
// la pide tambien en /login, donde no hay ninguna de las dos. Es uno de los
// pocos sitios donde `qRaw` es lo correcto y no el fallo R2.
import { unstable_noStore as noStore } from 'next/cache'
import { qRaw1 } from './db'
import { esMoneda, fijarMonedaInstancia, MONEDA_POR_OMISION, type Moneda } from '@/lib/i18n/dinero'

// ============================================================================
//  lib/server/moneda-instancia.ts — DE DONDE SALE LA MONEDA (ADR 0048).
// ----------------------------------------------------------------------------
//  La moneda es de la INSTANCIA: se elige al crearla y la base impide
//  cambiarla (`20261102_moneda_inmutable_por_instancia.sql`). Esta funcion la
//  lee y la deja fijada en `lib/i18n/dinero.ts` para el modulo del servidor que
//  la llame; el navegador la recibe por `ProveedorMoneda` desde el layout raiz.
//
//  ─── POR QUE NO SE CACHEA ─────────────────────────────────────────────────
//  Seria lo natural —es inmutable—, pero una instancia SIN organizacion no
//  tiene moneda todavia, y la primera que nace puede ser USD. Una cache puesta
//  antes del bootstrap pintaria pesos hasta reiniciar el proceso. La consulta
//  es una fila de una tabla diminuta; no vale el riesgo.
//
//  ─── QUIEN TIENE QUE LLAMARLA ─────────────────────────────────────────────
//  Todo codigo de SERVIDOR que formatee dinero (`formatMonto`,
//  `formatearDinero`, `simboloMoneda`) antes de formatear: el layout raiz, el
//  documento imprimible de la propuesta y las rutas que escriben importes en
//  la bitacora o en un mensaje. Next arma el layout y la pagina EN PARALELO y
//  en capas de modulos distintas, asi que lo que fije el layout no le llega a
//  una pagina de servidor ni a una ruta: cada una la pide.
// ============================================================================

/**
 * La moneda de esta instancia, ya fijada para los formateadores del servidor.
 *
 * - Sin ninguna organizacion: MXN, que es en la que nacera si nadie elige.
 * - Con un valor que no es MXN ni USD en la base: LANZA. El CHECK de la
 *   migracion lo impide; si aun asi aparece, pintar pesos en silencio seria
 *   peor que un error.
 */
export async function monedaDeLaInstancia(): Promise<Moneda> {
  // Una pagina que pinta dinero NO puede ser estatica: la moneda se lee de la
  // base y una instancia recien nacida la cambia de «ninguna» (MXN) a la que
  // elija el bootstrap. Sin esto, `next build` prerenderizaba `/_not-found`
  // —que cuelga del layout raiz— y consultaba la base EN EL BUILD: rojo en
  // una maquina sin Postgres (CI, la imagen), y una moneda horneada en todas.
  noStore()
  // La mas antigua, que es la de todas: el trigger `tenants_moneda_unica`
  // impide que una organizacion nazca en otra.
  const r = await qRaw1<{ moneda: string }>('select moneda from tenants order by creado_en asc limit 1')
  const m = r?.moneda ?? MONEDA_POR_OMISION
  if (!esMoneda(m)) throw new Error(`La instancia tiene una moneda no soportada en la base: ${JSON.stringify(m)}`)
  fijarMonedaInstancia(m)
  return m
}

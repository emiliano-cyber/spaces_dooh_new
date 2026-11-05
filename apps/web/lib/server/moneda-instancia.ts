import 'server-only'
// `tenants` NO tiene RLS fail-closed (igual que en `tenant.ts:hayAlgunTenant`):
// leer la moneda de la instancia no necesita sesion ni GUC, y el layout raiz
// la pide tambien en /login, donde no hay ninguna de las dos. Es uno de los
// pocos sitios donde `qRaw` es lo correcto y no el fallo R2.
import { unstable_noStore as noStore } from 'next/cache'
import { qRaw1 } from './db'
import {
  esMoneda,
  fijarMonedaInstancia,
  monedaInstancia,
  MONEDA_POR_OMISION,
  type Moneda,
} from '@/lib/i18n/dinero'

// ============================================================================
//  lib/server/moneda-instancia.ts — DE DONDE SALE LA MONEDA (ADR 0048).
// ----------------------------------------------------------------------------
//  La moneda es de la INSTANCIA: se elige al crearla y la base impide
//  cambiarla (`20261102_moneda_inmutable_por_instancia.sql`). Esta funcion la
//  lee y la deja fijada en `lib/i18n/dinero.ts`, que la guarda en
//  `globalThis`: UNA por proceso, la vean las rutas, las paginas o el layout
//  (cada uno tiene su propia copia empaquetada de `dinero.ts`).
//
//  ─── QUIEN LA LLAMA ───────────────────────────────────────────────────────
//  · `tenantActual()` (`tenant.ts`), que corre en practicamente toda peticion
//    con sesion. Es el punto comun: no hay una envoltura de handlers en este
//    repo, y ruta por ruta eran ~60 rutas que llegan a algo que formatea
//    dinero (medido con un grafo de imports el 02/11). Una ruta nueva no tiene
//    que acordarse.
//  · El layout raiz (todas las paginas, tambien las publicas sin sesion) y el
//    documento imprimible de la propuesta, que no esperan a nadie.
//  · Las rutas que escriben importes en la bitacora la piden explicitamente
//    ademas: sale gratis (va cacheada) y no dependen de en que orden corran
//    sus consultas.
//
//  ─── POR QUE SE CACHEA, Y CUANDO NO ───────────────────────────────────────
//  Es inmutable en la base, asi que basta leerla UNA vez por proceso. Pero
//  solo cuando ya existe una organizacion: una instancia sin ninguna todavia
//  no tiene moneda, y la primera que nazca puede ser USD. Por eso sin
//  organizaciones NO se cachea, y el alta (`cuentas-controller.ts`) la recuerda
//  en cuanto la crea. Consecuencia que hay que saber: tras una correccion de
//  datos que cambie la moneda (el unico camino, ADR 0048), hay que REINICIAR
//  la aplicacion.
// ============================================================================

const LEIDA = Symbol.for('space-os.moneda-instancia.leida-de-la-base')
const marca = globalThis as unknown as { [LEIDA]?: boolean }

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
  if (marca[LEIDA]) return monedaInstancia()
  // La mas antigua, que es la de todas: el trigger `tenants_moneda_unica`
  // impide que una organizacion nazca en otra.
  const r = await qRaw1<{ moneda: string }>('select moneda from tenants order by creado_en asc limit 1')
  if (!r) {
    fijarMonedaInstancia(MONEDA_POR_OMISION)
    return MONEDA_POR_OMISION
  }
  if (!esMoneda(r.moneda)) {
    throw new Error(`La instancia tiene una moneda no soportada en la base: ${JSON.stringify(r.moneda)}`)
  }
  recordarMonedaDeLaInstancia(r.moneda)
  return r.moneda
}

/**
 * La deja fijada y marcada como leida. La llama el alta en cuanto nace una
 * organizacion: si la cache del proceso tenia el MXN «de nadie» de antes del
 * bootstrap, aqui se sustituye por la que se eligio.
 */
export function recordarMonedaDeLaInstancia(m: Moneda): void {
  fijarMonedaInstancia(m)
  marca[LEIDA] = true
}

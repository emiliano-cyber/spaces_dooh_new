import 'server-only'
// `tenants` NO tiene RLS fail-closed (como en `moneda-instancia.ts`): leer el
// idioma de la instancia no necesita sesion ni GUC — la pagina publica de
// firma tambien acaba aqui. Es uno de los pocos sitios donde `qRaw` es lo
// correcto y no el fallo R2.
import { qRaw1 } from './db'
import { IDIOMAS, IDIOMA_POR_OMISION, type Idioma } from '@/lib/i18n/idiomas'

// ============================================================================
//  lib/server/idioma-instancia.ts — EN QUE IDIOMA SE REDACTAN LOS DOCUMENTOS
//  (ADR 0049).
// ----------------------------------------------------------------------------
//  El idioma de los DOCUMENTOS (contrato y constancia de firmas) es de la
//  INSTANCIA: se elige al crearla y la base impide cambiarlo
//  (`20261103_idioma_documentos_por_instancia.sql`). No tiene nada que ver con
//  el idioma de la interfaz, que es de cada persona (`lib/i18n/servidor.ts`).
//
//  ─── QUIEN LO LLAMA ───────────────────────────────────────────────────────
//  `datosContrato()` (`contrato-expediente.ts`), que es la UNICA puerta por la
//  que pasan los datos del contrato antes de redactarlo: la pagina imprimible,
//  la huella de revision, el congelado al enviar a firma y el cotejo de las
//  firmas (`firmas-repo.ts`). Asi, los cuatro redactan en el mismo idioma sin
//  que ninguno tenga que acordarse.
//
//  ─── CACHE, Y FAIL-CLOSED ─────────────────────────────────────────────────
//  Como la moneda (ADR 0048): inmutable en la base, asi que se lee UNA vez por
//  proceso, en `globalThis` (el build empaqueta este modulo varias veces).
//  Sin organizaciones NO se cachea: la primera puede nacer en otro idioma, y
//  el alta lo recuerda en cuanto la crea.
//
//  Y si la base no contesta, LANZA. Caer al espanol en silencio redactaria el
//  contrato de una instancia inglesa en espanol: su hash no coincidiria con el
//  congelado y todas sus firmas aparecerian ALTERADAS por una caida de la base.
//  Tras una correccion de datos que lo cambiara (ADR 0049), hay que REINICIAR.
// ============================================================================

const CLAVE = Symbol.for('space-os.idioma-documentos-instancia')
const almacen = globalThis as unknown as { [CLAVE]?: Idioma }

// Contra `IDIOMAS`: es lo que acepta el CHECK de la columna desde
// `20261105_idioma_portugues.sql` (P3 del portugues, 05/11).
function esIdioma(x: string): x is Idioma {
  return (IDIOMAS as readonly string[]).includes(x)
}

/**
 * El idioma de los documentos de ESTA instancia.
 *
 * - Sin ninguna organizacion: `es`, que es en el que nacera si nadie elige.
 * - Con un valor que no es de `IDIOMAS` en la base: LANZA (el CHECK lo impide).
 * - Si la base no contesta: LANZA (fail-closed).
 */
export async function idiomaDeLaInstancia(): Promise<Idioma> {
  const cacheado = almacen[CLAVE]
  if (cacheado) return cacheado
  // La mas antigua, que es la de todas: el trigger
  // `tenants_idioma_documentos_unico` impide que una nazca en otro.
  const r = await qRaw1<{ idioma_documentos: string }>(
    'select idioma_documentos from tenants order by creado_en asc limit 1',
  )
  if (!r) return IDIOMA_POR_OMISION
  if (!esIdioma(r.idioma_documentos)) {
    throw new Error(
      `La instancia tiene un idioma de documentos no soportado en la base: ${JSON.stringify(r.idioma_documentos)}`,
    )
  }
  recordarIdiomaDeLaInstancia(r.idioma_documentos)
  return r.idioma_documentos
}

/** La llama el alta en cuanto nace la primera organizacion. */
export function recordarIdiomaDeLaInstancia(idioma: Idioma): void {
  almacen[CLAVE] = idioma
}

import 'server-only'
// `apariencia_instancia` NO tiene `tenant_id` ni RLS: describe el SERVIDOR
// (ver la cabecera de `db/migrations/20261110_idiomas_del_servidor.sql`). Se
// lee con `qRaw` a proposito, como `actualizaciones-repo.ts`, y el layout raiz
// la pide tambien en /login, donde no hay sesion. No es el fallo R2.
import { qRaw, qRaw1 } from './db'
import { fijarIdiomasDeLaInstancia, IDIOMAS, type Idioma } from '@/lib/i18n/idiomas'

// ============================================================================
//  lib/server/idiomas-servidor.ts — LOS IDIOMAS QUE OFRECE ESTE SERVIDOR.
// ----------------------------------------------------------------------------
//  Lo elegido en «Administracion → Configuracion → Idiomas del servidor».
//  Se lee UNA vez por proceso y se deja en `globalThis` (cada paquete de Next
//  tiene su copia de este modulo; con `Symbol.for` todos ven la misma). Al
//  guardar se actualiza en el acto, asi que el `router.refresh()` de la
//  tarjeta ya sale con lo nuevo. Un servidor = un proceso.
//
//  Para que el resto del codigo no cambie, lo leido se entrega a
//  `fijarIdiomasDeLaInstancia()` (`lib/i18n/idiomas.ts`), y desde ahi
//  `idiomasActivos()` —que ya usan el layout, `servidor.ts`, `_error`, el
//  login y «Mi cuenta»— lo prefiere a las variables `IDIOMA_*`.
//
//  ─── SI LA BASE NO CONTESTA, MANDAN LAS VARIABLES ─────────────────────────
//  Al reves que la moneda (fail-closed, `moneda-instancia.ts`): un idioma de
//  mas o de menos en el selector no cambia ningun importe ni ningun documento.
//  Tumbar /login por esto seria peor. Y no se cachea el fallo: la siguiente
//  peticion lo vuelve a intentar.
// ============================================================================

const CLAVE = Symbol.for('space-os.idiomas-servidor-leidos')
const almacen = globalThis as unknown as { [CLAVE]?: { idiomas: Idioma[] | null } }

function deFila(idiomas: string[] | null | undefined): Idioma[] | null {
  return idiomas ? IDIOMAS.filter((i) => idiomas.includes(i)) : null
}

function recordar(idiomas: Idioma[] | null): Idioma[] | null {
  almacen[CLAVE] = { idiomas }
  fijarIdiomasDeLaInstancia(idiomas)
  return idiomas
}

/** Lo elegido en el servidor, o `null` si mandan las variables. */
export async function idiomasDelServidor(): Promise<Idioma[] | null> {
  const leidos = almacen[CLAVE]
  if (leidos) return leidos.idiomas
  try {
    const f = await qRaw1<{ idiomas: string[] | null }>(
      'select idiomas from apariencia_instancia where id = true',
    )
    return recordar(deFila(f?.idiomas))
  } catch {
    return null
  }
}

export async function guardarIdiomasDelServidor(
  idiomas: Idioma[] | null,
  usuarioId: string,
): Promise<Idioma[] | null> {
  const filas = await qRaw<{ idiomas: string[] | null }>(
    `update apariencia_instancia
        set idiomas = $1::text[], actualizado_por = $2, actualizado_en = now()
      where id = true
  returning idiomas`,
    [idiomas, usuarioId],
  )
  // Sin fila no hay donde guardar: la migracion la crea y la app no puede
  // borrarla. Si faltara, es un fallo de instalacion y se dice.
  if (!filas[0]) throw new Error('Falta la fila de apariencia_instancia (migracion 20261110).')
  return recordar(deFila(filas[0].idiomas))
}

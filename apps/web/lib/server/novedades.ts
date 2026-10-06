import 'server-only'
import archivo from '@/novedades.json'
import { validarNovedades, notasDe, versionInstaladaDe, type EntradaNovedades } from '@/lib/novedades'

// ============================================================================
//  lib/server/novedades.ts — Las notas de version de ESTE build.
// ----------------------------------------------------------------------------
//  El `novedades.json` se IMPORTA aqui, en `server-only`, y en ningun otro
//  sitio: importado desde un modulo de cliente acabaria en el bundle del
//  navegador, que se descarga sin sesion, y el archivo dice que version corre
//  la instancia -- que va tras token en `/api/version` (P6)--. Se sirve por
//  `GET /api/novedades`, que exige sesion.
//
//  Se valida UNA vez, al cargar el modulo. Si el archivo empaquetado no fuera
//  valido no se ensena nada (lista vacia) y se dice en el log: la puerta de
//  `release.yml` (`scripts/verificar-novedades.mjs`) existe para que eso no
//  llegue nunca a una imagen, pero un build local no pasa por ella.
// ============================================================================

const resultado = validarNovedades(archivo)
if (!resultado.ok) {
  console.error(`[novedades] novedades.json empaquetado NO es valido; no se ensenan notas:\n  · ${resultado.errores.join('\n  · ')}`)
}
const NOVEDADES: EntradaNovedades[] = resultado.ok ? resultado.novedades : []

export interface NovedadesDeLaInstancia {
  // La version sellada en la imagen, o null en desarrollo / sin version.
  version: string | null
  // Las notas de esa version, o null si no trae.
  notas: EntradaNovedades | null
  // Todas, de la mas nueva a la mas vieja, para la pagina de Novedades.
  novedades: EntradaNovedades[]
}

// La version se lee en CADA peticion, no al cargar el modulo: el mismo motivo
// por el que `/api/version` es `force-dynamic`.
export function novedadesDeLaInstancia(): NovedadesDeLaInstancia {
  const version = versionInstaladaDe(process.env.SPACE_OS_VERSION, process.env.NODE_ENV)
  return { version, notas: notasDe(version, NOVEDADES), novedades: NOVEDADES }
}

import 'server-only'
import { idiomasDelServidor } from './idiomas-servidor'
import { idiomasActivos, normalizarIdioma, type Idioma } from '@/lib/i18n/idiomas'

// ============================================================================
//  lib/server/idioma-al-entrar.ts — el idioma de la CUENTA al iniciar sesion.
// ----------------------------------------------------------------------------
//  Lo usan las tres entradas (contrasena, codigo de recuperacion y Google),
//  para el cuerpo de la respuesta Y para la cookie del idioma de la cuenta.
//
//  El fallo que motivo sacarlo aqui (18/11, g500): cada ruta llamaba a
//  `normalizarIdioma(valor)` para la cookie SIN la lista de idiomas, y por
//  omision esa funcion solo acepta lo que encienden las VARIABLES `IDIOMA_*`.
//  En g500 el portugues se encendio desde la base («Idiomas del servidor»),
//  sin variable, y al entrar la preferencia «pt» se tiraba: el selector
//  ofrecia Português y la app seguia en espanol. El cuerpo si pasaba la lista,
//  dos lineas mas arriba; por eso la regla vive ahora en un solo sitio.
//
//  `idiomasDelServidor()` va antes A PROPOSITO: `idiomasActivos()` lee lo que
//  ya se cargo de la base en este proceso, y un login justo despues de
//  reiniciar podria llegar antes que cualquier pagina que lo cargue.
// ============================================================================

export async function idiomaDeLaCuentaAlEntrar(valor: string | null | undefined): Promise<Idioma | null> {
  await idiomasDelServidor()
  return normalizarIdioma(valor, idiomasActivos())
}

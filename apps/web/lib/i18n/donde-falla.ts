import { traducir } from './diccionario'
import type { Idioma } from './idiomas'

// ============================================================================
//  DONDE FALLO UNA PANTALLA, EN EL IDIOMA DE QUIEN MIRA (ola 7 del ingles).
// ----------------------------------------------------------------------------
//  `pantallaDeEquipo()` (`lib/server/space-eye.ts`, `dondeDeFalla`) manda el
//  `donde` de cada falla ya escrito, en espanol: «Gabinete 8 (fila 2, columna
//  3)», «Gabinetes 2, 5, 8 (3 de 15)», «Toda la pantalla». La pantalla de la
//  flota (`FallasFlota.tsx`) lo arma ella misma con `spaceeyes.fallas.donde.*`;
//  la ficha del equipo lo pintaba tal cual y en ingles salia en espanol.
//
//  Aqui se RECONOCEN esas tres formas y se rearman con las mismas claves que
//  usa la flota, asi las dos pantallas dicen lo mismo. Lo que no casa se pinta
//  como llega. En espanol devuelve el texto tal cual.
// ============================================================================

const GABINETE = /^Gabinete (\d+) \(fila (\d+), columna (\d+)\)$/
// La lista puede venir cortada a 12 con «…» al final; el total es opcional.
const GABINETES = /^Gabinetes (\d+(?:, \d+)*…?)(?: \((\d+) de (\d+)\))?$/

export function dondeDeFallaEnIdioma(donde: string, idioma: Idioma): string {
  if (idioma === 'es') return donde
  const uno = GABINETE.exec(donde)
  if (uno) return traducir(idioma, 'spaceeyes.fallas.donde.gabinete', { n: uno[1], fila: uno[2], columna: uno[3] })
  const varios = GABINETES.exec(donde)
  if (varios) {
    const [, lista, n, total] = varios
    const cuantos = n ? Number(n) : lista.split(', ').length
    const base = traducir(idioma, cuantos === 1 ? 'spaceeyes.fallas.donde.gabinetes.uno' : 'spaceeyes.fallas.donde.gabinetes.otros', { lista })
    return total ? base + traducir(idioma, 'spaceeyes.fallas.donde.de', { n: n!, total }) : base
  }
  if (donde === traducir('es', 'spaceeyes.fallas.donde.toda')) return traducir(idioma, 'spaceeyes.fallas.donde.toda')
  return donde
}

// El NOMBRE de una falla lo escribe el telefono (`Monitor.kt`: NOMBRES y los
// dos de grupo), en espanol, porque la app solo esta en espanol. Se reconoce el
// texto EXACTO del catalogo (`spaceeyes.fallas.nombre.*`); cualquier otro se
// pinta como llega. En espanol, tal cual.
const CLAVES_NOMBRE = [
  'spaceeyes.fallas.nombre.zona-apagada',
  'spaceeyes.fallas.nombre.zona-congelada',
  'spaceeyes.fallas.nombre.pantalla-apagada',
  'spaceeyes.fallas.nombre.pantalla-congelada',
  'spaceeyes.fallas.nombre.camara-movida',
  'spaceeyes.fallas.nombre.sin-imagen',
  'spaceeyes.fallas.nombre.varios-apagados',
  'spaceeyes.fallas.nombre.varios-congelados',
] as const

// Pero el BACKEND (`space-eye/backend/src/controllers/monitoreo.controller.ts`,
// NOMBRES) escribe tres de ellos mas cortos que el telefono, y son los que
// llegan cuando la falla la detecta el servidor. Visto en el recorrido del
// italiano (04/11): «Pantalla congelada» salia en espanol con la interfaz en
// italiano. Solo el italiano los reconoce; el ingles se deja como estaba, por
// la regla de esta pasada (anotado en docs/i18n/revision-italiano-recorrido.md).
const NOMBRES_CORTOS_DEL_BACKEND: Record<string, (typeof CLAVES_NOMBRE)[number]> = {
  'Pantalla congelada': 'spaceeyes.fallas.nombre.pantalla-congelada',
  'Cámara movida': 'spaceeyes.fallas.nombre.camara-movida',
  'Sin imagen': 'spaceeyes.fallas.nombre.sin-imagen',
}

export function nombreDeFallaEnIdioma(nombre: string, idioma: Idioma): string {
  if (idioma === 'es') return nombre
  if (idioma === 'it' && NOMBRES_CORTOS_DEL_BACKEND[nombre]) return traducir(idioma, NOMBRES_CORTOS_DEL_BACKEND[nombre])
  const clave = CLAVES_NOMBRE.find((k) => traducir('es', k) === nombre)
  return clave ? traducir(idioma, clave) : nombre
}

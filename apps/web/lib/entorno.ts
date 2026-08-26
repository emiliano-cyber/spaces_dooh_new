// ============================================================================
//  Banderas del despliegue que se deciden AL ARRANCAR, no al compilar.
// ----------------------------------------------------------------------------
//  Existe porque una sola imagen tiene que servir a DEMO y a cada instancia de
//  owner. Una bandera con prefijo NEXT_PUBLIC_ no puede hacerlo: Next la
//  INLINEA en el build, así que cambiarla exige recompilar y publicar otro
//  artefacto. Es el mismo tratamiento que ya recibió `GOOGLE_OAUTH` por la
//  decisión 5 de la ADR 0012.
// ============================================================================

// Auto-registro público («Crear cuenta» en el login, y el alta de empresa con
// Google, que cuelga del mismo interruptor).
//
// SIN prefijo NEXT_PUBLIC_ a propósito: con él, el valor viajaría horneado en
// el bundle del cliente y `AUTOREGISTRO=1` en el `.env` de una instancia no
// tendría ningún efecto. El precio es que el cliente no puede leerla y tiene
// que preguntar por HTTP (`/api/auth/metodos/`).
//
// FAIL-CLOSED, y es una inversión deliberada respecto a la bandera vieja
// (`NEXT_PUBLIC_AUTOREGISTRO !== '0'`, o sea ENCENDIDO cuando faltaba): la
// flota son muchas instancias con `.env` escritos a mano, y la que se quede
// corta tiene que quedarse sin registro público, no con la puerta abierta.
// Solo `'1'` enciende: un `AUTOREGISTRO=true` o `=si` deja el registro cerrado
// a propósito, porque el error se nota (nadie puede registrarse) mientras que
// el contrario no se notaría hasta que alguien creara una organización.
export function autoregistroActivo(): boolean {
  return process.env.AUTOREGISTRO === '1'
}

// ────────────────────────────────────────────────────────────────────────────
//  El nombre con el que la instancia se presenta (UI-01, auditoría 26/08/2026).
//
//  El `<title>` decía «Spaces — Demo» EN PRODUCCIÓN, y se veía en dos sitios
//  que no son internos: la pestaña del navegador del owner y la liga pública de
//  propuesta que el owner manda a SU cliente. Con una instancia por owner,
//  «Demo» no es solo feo, es falso.
//
//  Mismo tratamiento que `AUTOREGISTRO` y por la misma razón: sin prefijo
//  `NEXT_PUBLIC_`, para que la marca no viaje horneada en el artefacto — el
//  artefacto es idéntico para toda la flota (invariante 3 del plan v3).
//
//  FAIL-SAFE, y aquí sí es lo contrario de la bandera de arriba: una instancia
//  con el `.env` corto tiene que seguir teniendo un título correcto, no una
//  pestaña en blanco. Por eso una variable ausente, vacía o en blanco cae al
//  nombre del producto, que es cierto para cualquier instancia.
//
//  > [!warning] Hoy esto NO llega al `<title>` de las páginas prerenderizadas
//  > Medido el 2026-08-26: `next build` deja 22 páginas en
//  > `.next/server/app/*.html` con su `<title>` ya escrito dentro, porque
//  > `generateMetadata()` corre en el BUILD para todo lo que Next genera
//  > estáticamente. Es exactamente la trampa que documenta
//  > `app/api/auth/metodos/route.ts:29-38` con el botón «Crear cuenta».
//  >
//  > O sea: `ORG_NOMBRE` se lee de verdad en cada arranque, pero solo cambia el
//  > título de las rutas que se renderizan por petición. Para que mande en
//  > TODAS haría falta sacar el subárbol `(app)` del render estático, y eso es
//  > una decisión de una persona, no un efecto colateral de arreglar un título.
//  > Mientras no se tome, el valor que ve casi todo el mundo es el de abajo.
export const MARCA_POR_OMISION = 'SPACE OS'

export function nombreDeMarca(): string {
  const declarado = (process.env.ORG_NOMBRE ?? '').trim()
  return declarado === '' ? MARCA_POR_OMISION : declarado
}

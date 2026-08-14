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

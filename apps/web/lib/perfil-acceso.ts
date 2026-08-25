// ============================================================================
//  lib/perfil-acceso.ts — ¿hay que pedir la contraseña anterior? (ADR 0018)
// ----------------------------------------------------------------------------
//  LA REGLA DE VERDAD VIVE EN EL SERVIDOR, en `lib/server/perfil-controller.ts`
//  (`puedeFijarSinAnterior`). Esta función NO la sustituye: solo permite que la
//  pantalla tome la misma decisión y no exija un dato que el servidor no va a
//  pedir.
//
//  Existe porque faltó, y el fallo fue exactamente ese: la regla se implementó
//  en el servidor y `configuracion/page.tsx:119` seguía cortando el envío en el
//  navegador, así que era correcta e INALCANZABLE desde la interfaz.
//
//  Es el mismo defecto que ya documenta `lib/auth-real.ts:21-26` sobre
//  `debeCambiarPassword`: «el servidor lo MANDA desde el ADR 0009, pero este
//  tipo no lo declaraba y por tanto nadie lo miraba». Un dato que el servidor
//  envía y el cliente no declara es un dato que no existe.
//
//  ─── Por qué en un módulo propio y no dentro del componente ────────────────
//  Este proyecto no tiene arnés de pruebas de UI. Una condición de seguridad
//  escrita dentro de un `.tsx` no se puede probar; aquí sí. Mismo motivo que
//  `lib/entorno.ts`, `lib/host.ts` y `lib/clic-unico.ts`.
// ============================================================================

export function puedeFijarPasswordSinAnterior(e: {
  debeCambiarPassword?: boolean
  metodoSesion?: 'password' | 'google'
  cambiaEmail: boolean
  cambiaPassword: boolean
}): boolean {
  // Se comparan contra `true` / `'google'` de forma explícita: `undefined` es
  // «no se sabe» —una sesión abierta antes de la migración no trae el método— y
  // no se sabe NUNCA puede significar «adelante». Falla cerrado.
  if (!e.cambiaPassword || e.cambiaEmail) return false
  if (e.debeCambiarPassword !== true) return false
  return e.metodoSesion === 'google'
}

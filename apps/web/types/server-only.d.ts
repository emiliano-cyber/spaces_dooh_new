// ============================================================================
//  types/server-only.d.ts — Declaración ambient para los marcadores
//  `server-only` / `client-only`.
// ----------------------------------------------------------------------------
//  Varios módulos del servidor importan `import 'server-only'` como marcador
//  (impide que el código se incluya en el bundle del cliente). El bundler de
//  Next resuelve ese módulo por su alias interno, pero el chequeo de tipos de
//  `next build` necesita una declaración o falla con "Cannot find module or
//  type declarations for side-effect import of 'server-only'".
//
//  El paquete real `server-only` es solo un marcador sin exports, así que esta
//  declaración es fiel: solo afecta el tipado (se borra en compilación) y no
//  cambia el runtime, el bundler ni el comportamiento del front.
// ============================================================================

declare module 'server-only'
declare module 'client-only'

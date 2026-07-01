// ============================================================================
//  types/css.d.ts — Declaración ambient para hojas de estilo globales.
// ----------------------------------------------------------------------------
//  La app importa CSS como side-effect (`import './globals.css'`,
//  `import './demo.css'`, `import 'maplibre-gl/dist/maplibre-gl.css'`). El
//  chequeo de tipos de `next build` exige una declaración de módulo para esos
//  imports; sin ella falla con "Cannot find module or type declarations for
//  side-effect import".
//
//  El proyecto NO usa CSS Modules (no hay `*.module.css`), así que declarar
//  `*.css` de forma amplia es seguro: solo afecta el tipado (se borra en
//  compilación), no el runtime, el bundler ni el front.
// ============================================================================

declare module '*.css'

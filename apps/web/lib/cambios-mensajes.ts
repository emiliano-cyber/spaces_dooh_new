// ============================================================================
//  lib/cambios-mensajes.ts — El texto con el que la UI reconoce «falta
//  desbloquear». Módulo PURO: lo importan el servidor (que lo emite) y el
//  cliente (que lo detecta).
// ----------------------------------------------------------------------------
//  El servidor responde 403 con `{ requiereDesbloqueo: true }`, pero los
//  clientes API ya existentes lanzan `Error(d.error)` y por el camino se pierde
//  esa marca; lo único que sobrevive es el mensaje. Así que la UI lo compara por
//  TEXTO para decidir si abre el modal de contraseña o pinta un error rojo.
//
//  Vivía duplicado —el literal en `cambios.ts` y una copia en `cambios-api.ts`—
//  y al reescribir el mensaje para el ADR 0009 la copia se quedó atrás: el
//  candado habría seguido funcionando, pero el usuario habría visto un error en
//  rojo en vez del modal, sin forma de continuar. Una constante compartida hace
//  que eso no pueda pasar.
// ============================================================================

export const MENSAJE_DESBLOQUEO = 'Este cambio necesita que vuelvas a teclear tu contraseña.'

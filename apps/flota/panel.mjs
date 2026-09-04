// ============================================================================
//  panel.mjs — arranca el panel de flota.  (ADR 0026)
//
//  Punto de entrada y nada mas: toda la decision vive en `servidor.mjs`, que se
//  prueba sin abrir ningun puerto. Aqui solo se escucha.
//
//  Escucha en 127.0.0.1 a proposito: quien llega es nginx, no internet.
// ============================================================================

import { crearServidorPanel } from './servidor.mjs'

const PUERTO = Number(process.env.PANEL_PUERTO ?? 3002)
const INTERFAZ = process.env.PANEL_INTERFAZ ?? '127.0.0.1'

crearServidorPanel().listen(PUERTO, INTERFAZ, () => {
  console.log(JSON.stringify({ evento: 'panel-flota', arrancado: `${INTERFAZ}:${PUERTO}` }))
})

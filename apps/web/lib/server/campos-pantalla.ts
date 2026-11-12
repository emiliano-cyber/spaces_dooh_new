import 'server-only'
import { leerCamposOcultos, type CampoPantalla } from '@/lib/campos-pantalla'

// Lee `PANTALLA_CAMPOS_OCULTOS` del entorno EN TIEMPO DE PETICIÓN, no de
// build: la imagen es la misma para toda la flota y el valor es de cada
// servidor (CAMPOS-PANTALLA, 11/11). Un nombre desconocido —puesto a mano en
// `app.env`, porque el alta lo rechaza— no oculta nada y se avisa UNA vez en
// el log, en vez de quedarse en silencio.
let avisado = false
export function camposOcultosPantalla(): CampoPantalla[] {
  const { ocultos, desconocidos } = leerCamposOcultos(process.env.PANTALLA_CAMPOS_OCULTOS)
  if (desconocidos.length && !avisado) {
    avisado = true
    console.warn(`[campos-pantalla] PANTALLA_CAMPOS_OCULTOS trae campos que no existen y se ignoran: ${desconocidos.join(', ')}`)
  }
  return ocultos
}

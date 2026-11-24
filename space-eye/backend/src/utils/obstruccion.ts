// backend/src/utils/obstruccion.ts
//
// Que hacer con el parecido que mide `obstruccionEnFoto` (creativos.controller).
// Vive aparte para poder probarlo sin base ni secretos: es la decision que mas
// cara sale tener mal, y la que menos se ve.
//
// LA REGLA ORIGINAL: si una parte buena de la pantalla sigue siendo un creativo
// conocido (parecido entre 0.45 y 0.95), lo que cambio esta DELANTE y la foto
// no entra al catalogo.
//
// LO QUE DIJO LA MEDICION (24/11, g500, `scripts/medir-obstruccion.ts`): de 64
// anuncios de verdad, 32 caian en esa banda. Los parecidos de anuncios reales
// iban del 16 % al 89 %: ningun umbral los separa de un camion, y de camiones
// habia 4 muestras. Descartar con esta regla dejaba de registrar media campana
// nueva -y abria una falla de «algo tapando la pantalla» que no era cierta-.
//
// Por eso, por omision, la banda solo se ANOTA (el parecido queda en el
// registro del equipo) y el creativo sigue su camino. `OBSTRUCCION_DESCARTA=si`
// devuelve la regla original, para cuando haya un umbral medido de verdad.

// 0.45 sale de la geometria (un vehiculo tapa entre un cuarto y la mitad de la
// pantalla), NO de un conteo. No moverlo sin volver a medir.
export const PARECIDO_OBSTRUIDO = 0.45;
// Por encima es la MISMA imagen: eso ya lo caza la huella y no es asunto de aqui.
export const PARECIDO_ES_LA_MISMA = 0.95;

export type VeredictoObstruccion = 'descartar' | 'anotar' | 'nada';

export function veredictoObstruccion(parecido: number, descarta: boolean): VeredictoObstruccion {
  const enBanda = parecido >= PARECIDO_OBSTRUIDO && parecido < PARECIDO_ES_LA_MISMA;
  if (!enBanda) return 'nada';
  return descarta ? 'descartar' : 'anotar';
}

// backend/scripts/prueba-avisos.ts
//
// Lo que decide si una falla llega a un buzon -y si una "camara movida" se cree
// o no-, sin levantar nada: son funciones puras y se prueban como tales.
//
//   npm run prueba:avisos
//
// No toca la base ni manda correo. Lo de punta a punta (el equipo reporta, sale
// el correo) se prueba con el backend en marcha: npm run prueba:monitoreo.
import { areaDeLaPantalla } from '../src/controllers/monitoreo.controller';
import { GRAVES } from '../src/controllers/avisos.controller';
import { correoDeFallas, destinatariosDe, esc, pistaDeLlave, remitenteValido } from '../src/services/correo.service';

let fallos = 0;
function afirmar(ok: boolean, texto: string, extra = '') {
  if (!ok) { fallos++; console.log(`  FALLA  ${texto}  ${extra}`); }
  else console.log(`  ok     ${texto}`);
}

function cuadro(margen: number): [number, number][] {
  const a = margen, b = 1 - margen;
  return [[a, a], [b, a], [b, b], [a, b]];
}

console.log('\nCuanto de la foto ocupa la pantalla');
afirmar(areaDeLaPantalla(cuadro(0.25)) === 0.25, 'un cuadro a media foto es 0.25');
afirmar(Math.abs(areaDeLaPantalla(cuadro(0.005)) - 0.9801) < 1e-9, 'uno pegado al borde, 0.98 (el caso TLALPAN)');
// Las esquinas llegan en el orden en que se marcaron; el area no puede cambiar
// de signo por eso (la formula del cordon da negativo al reves).
afirmar(areaDeLaPantalla([[0.1, 0.1], [0.1, 0.9], [0.9, 0.9], [0.9, 0.1]]) === 0.64,
  'marcadas al reves da lo mismo');
afirmar(areaDeLaPantalla([[0.2, 0.2], [0.8, 0.3], [0.8, 0.7], [0.2, 0.6]]) > 0,
  'una pantalla vista en diagonal tambien');

console.log('\nA quien se le manda');
afirmar(destinatariosDe('a@b.com, c@d.mx').join('|') === 'a@b.com|c@d.mx', 'separados por coma');
afirmar(destinatariosDe(' a@b.com \n c@d.mx ').length === 2, 'por renglones y con espacios de sobra');
afirmar(destinatariosDe('a@b.com; c@d.mx').length === 2, 'y por punto y coma');
afirmar(destinatariosDe('pepe, @nada, a@b').length === 0, 'lo que no es una direccion se cae');
afirmar(destinatariosDe('').length === 0, 'vacio es vacio, no una direccion en blanco');

console.log('\nQue merece correo');
afirmar(GRAVES.includes('pantalla_apagada' as any), 'la pantalla apagada si');
afirmar(!(GRAVES as readonly string[]).includes('zona_apagada'), 'un gabinete suelto no');
// La que tenia a TLALPAN avisando cada noche: aunque se abriera, no es de correo.
afirmar(!(GRAVES as readonly string[]).includes('camara_movida'), 'la camara movida tampoco');

console.log('\nLa cuenta de correo');
// La llave se escribe, no se lee: del panel solo pueden salir los ultimos
// cuatro, los justos para reconocer cual esta puesta.
afirmar(pistaDeLlave('re_AbCdEfGhIjKlMnOp') === '\u2022\u2022\u2022\u2022MnOp', 'de la llave solo salen los ultimos 4');
afirmar(pistaDeLlave('') === '', 'sin llave no hay pista que ensenar');
afirmar(!pistaDeLlave('re_AbCdEfGhIjKlMnOp').includes('AbCdEf'), 'y nunca el principio');
afirmar(remitenteValido('avisos@empresa.com'), 'un correo pelado vale');
afirmar(remitenteValido('Space Eye <avisos@empresa.com>'), 'y con nombre delante');
afirmar(!remitenteValido('Space Eye'), 'un nombre sin correo no');
afirmar(!remitenteValido('avisos@empresa'), 'ni un dominio sin punto');
afirmar(!remitenteValido(''), 'ni vacio');

console.log('\nEl correo');
const una = correoDeFallas('TLALPAN', [
  { id: 1, device_id: 17, tipo: 'pantalla_apagada', fila: null, gabinete: null, detectada_en: '2026-11-06T21:00:00Z' },
]);
afirmar(una.asunto === 'Space Eye — TLALPAN: pantalla apagada en horario', 'una sola falla se nombra en el asunto', una.asunto);
const varias = correoDeFallas('TLALPAN', [
  { id: 1, device_id: 17, tipo: 'pantalla_apagada', fila: null, gabinete: null, detectada_en: '2026-11-06T21:00:00Z' },
  { id: 2, device_id: 17, tipo: 'sin_imagen', fila: null, gabinete: null, detectada_en: '2026-11-06T21:05:00Z' },
]);
afirmar(varias.asunto === 'Space Eye — TLALPAN: 2 fallas', 'varias se cuentan', varias.asunto);
afirmar(varias.html.includes('Pantalla apagada en horario') && varias.html.includes('Sin imagen'),
  'y van las dos en el cuerpo, con su nombre de persona');

// Un nombre de equipo lo escribe una persona: si entra crudo, basta llamar a un
// equipo `<b>` para deformar el correo de todos los que lo reciban.
const travieso = correoDeFallas('<script>x</script>', [
  { id: 1, device_id: 17, tipo: 'sin_imagen', fila: null, gabinete: null, detectada_en: '2026-11-06T21:00:00Z' },
]);
afirmar(!travieso.html.includes('<script>'), 'el nombre del equipo va escapado');
afirmar(esc(`<a href="x">&'`) === '&lt;a href=&quot;x&quot;&gt;&amp;&#39;', 'y el escape cubre las cinco');

console.log(fallos ? `\n${fallos} FALLAS` : '\nTodo en orden');
process.exit(fallos ? 1 : 0);

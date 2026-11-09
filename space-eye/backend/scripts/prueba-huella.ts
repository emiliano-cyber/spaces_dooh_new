// backend/scripts/prueba-huella.ts
//
// La huella del servidor tiene que ser IDENTICA a la del telefono.
//
//   npm run prueba:huella
//
// No es una comprobacion de estilo: el servidor compara las huellas de todos
// los agentes entre si para decidir si un creativo ya se conocia. Si este port
// se desviara en un bit, el servidor empezaria a ver "creativos nuevos" donde
// el telefono ve el de siempre, y cada uno costaria una foto de datos moviles.
//
// Las imagenes son las MISMAS que usan las pruebas del telefono y las de la
// Raspberry -dos fotos reales del espectacular de MANUEL DUBLAN, el mismo
// creativo con 53 segundos de diferencia-, leidas de android/ sin copiarlas
// para que los tres lados se prueben siempre contra lo mismo.
import { readFileSync } from 'fs';
import { join } from 'path';
import { calcular, distancia, BITS, TOLERANCIA } from '../src/utils/huella';

const RECURSOS = join(__dirname, '..', '..', 'android', 'app', 'src', 'test', 'resources');
const gris = (nombre: string) => readFileSync(join(RECURSOS, nombre));

let fallos = 0;
function afirmar(ok: boolean, texto: string, extra = '') {
  if (!ok) { fallos++; console.log(`  FALLA  ${texto}  ${extra}`); }
  else console.log(`  ok     ${texto}  ${extra}`);
}

console.log('\n1) La huella es la misma que calcula el telefono');
const a = calcular(gris('pantalla_a_320x180.gris'), 320, 180);
const b = calcular(gris('pantalla_b_320x180.gris'), 320, 180);
afirmar(a === '1d60dd00fa00fe70fe00fc44fc40f830f000f000f000f011f300e300fb00f900',
  'pantalla A, bit por bit', String(a));
afirmar(b === '1d60d900fa00fe70fe00fc44fc40f810f000f000f000f031f300e300fb00f900',
  'pantalla B, bit por bit', String(b));

console.log('\n2) El mismo creativo queda dentro de la tolerancia');
afirmar(distancia(a, b) === 3, 'A y B difieren en 3 bits', `${distancia(a, b)}`);
afirmar(distancia(a, b) <= TOLERANCIA, 'y eso es el mismo creativo');

console.log('\n3) Una imagen lisa no es un creativo');
// Pantalla apagada o lente tapada: no debe gastar una foto.
afirmar(calcular(new Array(320 * 180).fill(40), 320, 180) === null, 'sin contraste -> null');

console.log('\n4) La distancia cuenta bits');
afirmar(distancia('0f', '0f') === 0, 'iguales -> 0');
afirmar(distancia('0f', '00') === 4, 'cuatro bits de diferencia');
afirmar(distancia('0f', null) === BITS, 'contra nada -> el maximo');
afirmar(distancia('0f', '0ff') === BITS, 'largos distintos -> el maximo');

console.log('\n5) Entradas rotas no truenan');
afirmar(calcular([], 0, 0) === null, 'imagen vacia -> null');
afirmar(calcular(new Array(10).fill(0), 320, 180) === null, 'menos pixeles de los que dice -> null');

console.log(fallos === 0 ? '\nTODO BIEN\n' : `\n${fallos} FALLAS\n`);
process.exit(fallos === 0 ? 0 : 1);

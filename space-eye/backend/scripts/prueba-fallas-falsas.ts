// backend/scripts/prueba-fallas-falsas.ts
//
// Las reglas con las que el servidor deja de creerse un aviso, contra los casos
// REALES de g500 (oct-nov 2026). Las horas van en UTC, como estan en la base.
//
//   npm run prueba:fallas-falsas
//
// No toca la base de datos ni la red: son cuentas puras.
import { fueraDeHorario, minutoDelSitio, hhmm, zonaFueContenido } from '../src/utils/fallasFalsas';

let fallos = 0;
function afirmar(ok: boolean, texto: string) {
  if (!ok) { fallos++; console.log(`  FALLA  ${texto}`); }
  else console.log(`  ok     ${texto}`);
}

const H = { inicio: '06:00', fin: '24:00' };   // el horario de AUTOPISTA
const d = (s: string) => new Date(s);

console.log('Hora del sitio');
afirmar(hhmm(minutoDelSitio(d('2026-11-11T11:11:17Z'))) === '05:11', '11:11 UTC son las 05:11 en Mexico');
afirmar(hhmm(minutoDelSitio(d('2026-11-12T05:30:00Z'))) === '23:30', '05:30 UTC son las 23:30 del dia anterior');

console.log('AUTOPISTA: las «pantalla apagada» de cada manana, antes de las 6');
for (const t of ['2026-11-11T11:11:17Z', '2026-11-08T11:20:00Z', '2026-10-29T10:10:25Z', '2026-10-14T10:43:00Z']) {
  afirmar(fueraDeHorario(d(t), H), `${t} (${hhmm(minutoDelSitio(d(t)))}) queda fuera de 06:00-24:00`);
}

console.log('Lo que SI debe entrar');
// Las de la tarde-noche de AUTOPISTA: dentro del horario, son otra historia.
afirmar(!fueraDeHorario(d('2026-11-04T21:18:00Z'), H), '15:18 entra');
afirmar(!fueraDeHorario(d('2026-11-03T21:47:00Z'), H), '15:47 entra');
afirmar(!fueraDeHorario(d('2026-11-09T01:24:36Z'), H), 'la grua de las 19:24 entra');
afirmar(!fueraDeHorario(d('2026-11-11T12:15:00Z'), H), '06:15 entra');
afirmar(!fueraDeHorario(d('2026-11-11T11:57:00Z'), H), '05:57 entra por la tolerancia (reloj y red)');
afirmar(fueraDeHorario(d('2026-11-11T11:54:00Z'), H), '05:54 ya no');
afirmar(!fueraDeHorario(d('2026-11-12T06:03:00Z'), H), '00:03 entra (fin 24:00 con tolerancia)');
afirmar(fueraDeHorario(d('2026-11-12T06:10:00Z'), H), '00:10 no');

console.log('Horarios que no dejan nada fuera');
afirmar(!fueraDeHorario(d('2026-11-11T09:00:00Z'), { inicio: '00:00', fin: '24:00' }), 'todo el dia');
afirmar(!fueraDeHorario(d('2026-11-11T09:00:00Z'), null), 'sin horario');
afirmar(!fueraDeHorario(d('2026-11-11T09:00:00Z'), undefined), 'sin pantalla');

console.log('Horario que cruza la medianoche (18:00 a 02:00)');
const N = { inicio: '18:00', fin: '02:00' };
afirmar(!fueraDeHorario(d('2026-11-12T07:00:00Z'), N), '01:00 entra');
afirmar(!fueraDeHorario(d('2026-11-12T01:00:00Z'), N), '19:00 entra');
afirmar(fueraDeHorario(d('2026-11-11T18:00:00Z'), N), '12:00 no');

console.log('Gabinetes que se arreglan solos');
// MAGNOCENTRO y PATRIOTISMO, 13-20 oct: 10, 10, 10, 15, 20, 25, 30 min
for (const m of [10, 15, 20, 25, 30]) afirmar(zonaFueContenido('zona_congelada', m), `congelado ${m} min: contenido`);
afirmar(!zonaFueContenido('zona_congelada', 240), 'congelado 4 h: puede ser de verdad');
afirmar(!zonaFueContenido('zona_apagada', 771), 'la grua (12 h 51 min): no se toca');
afirmar(zonaFueContenido('zona_apagada', 12), 'apagado 12 min: contenido');
afirmar(!zonaFueContenido('pantalla_apagada', 10), 'una pantalla entera no es un gabinete (tiene su propia regla)');
afirmar(!zonaFueContenido('zona_congelada', -1), 'sin hora de cierre no se juzga');

console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTodo en orden');
process.exit(fallos ? 1 : 0);

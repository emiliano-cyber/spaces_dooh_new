// backend/scripts/prueba-obstruccion.ts
//
// El portero de «algo delante de la pantalla» ANOTA y no DESCARTA, salvo que
// la instancia lo pida.
//
//   npm run prueba:obstruccion
//
// POR QUE. El 24/11 se midio el umbral (0.45) contra el catalogo real de g500
// con `scripts/medir-obstruccion.ts`: de 64 anuncios de verdad, 32 caian en la
// banda de «obstruido» (0.45-0.95) y no habrian entrado al catalogo. Iban del
// 16 % al 89 % de parecido: NINGUN umbral los separaba. Y de camiones solo
// habia 4 muestras. Descartar con esa regla deja de registrar media campana
// nueva, y la falla que abre dice algo que no es.
//
// Asi que por omision el portero solo deja constancia (el parecido medido en
// el registro del equipo) y el creativo sigue su camino. Con esa constancia se
// junta la muestra que falta para fijar un umbral de verdad.
import { veredictoObstruccion, PARECIDO_OBSTRUIDO, PARECIDO_ES_LA_MISMA } from '../src/utils/obstruccion';

let fallos = 0;
function afirmar(ok: boolean, texto: string, extra = '') {
  if (!ok) { fallos++; console.log(`  FALLA  ${texto}  ${extra}`); }
  else console.log(`  ok     ${texto}  ${extra}`);
}

console.log('\n1) Por omision (descarta = no) NUNCA se descarta');
for (const p of [0, 0.2, PARECIDO_OBSTRUIDO, 0.53, 0.89, PARECIDO_ES_LA_MISMA, 1]) {
  const v = veredictoObstruccion(p, false);
  afirmar(v !== 'descartar', `parecido ${p} no se descarta`, v);
}

console.log('\n2) Por omision, lo que cae en la banda se ANOTA');
afirmar(veredictoObstruccion(PARECIDO_OBSTRUIDO, false) === 'anotar', 'justo en el umbral (0.45) se anota');
afirmar(veredictoObstruccion(0.53, false) === 'anotar', '0.53, la mediana de los anuncios reales, se anota');
afirmar(veredictoObstruccion(0.89, false) === 'anotar', '0.89 se anota');

console.log('\n3) Fuera de la banda no hay nada que anotar');
afirmar(veredictoObstruccion(0.44, false) === 'nada', 'por debajo del umbral: nada');
afirmar(veredictoObstruccion(PARECIDO_ES_LA_MISMA, false) === 'nada', '0.95 ya es la misma imagen: nada');
afirmar(veredictoObstruccion(1, false) === 'nada', '1.0: nada');

console.log('\n4) Con descarta = si, la banda vuelve a descartar (la regla de antes)');
afirmar(veredictoObstruccion(0.53, true) === 'descartar', '0.53 se descarta');
afirmar(veredictoObstruccion(0.44, true) === 'nada', 'por debajo del umbral sigue sin hacer nada');
afirmar(veredictoObstruccion(PARECIDO_ES_LA_MISMA, true) === 'nada', 'la misma imagen tampoco se descarta');

console.log('\n5) Las cotas son las de la medicion, no se movieron a ciegas');
afirmar(PARECIDO_OBSTRUIDO === 0.45, 'umbral 0.45', String(PARECIDO_OBSTRUIDO));
afirmar(PARECIDO_ES_LA_MISMA === 0.95, 'misma imagen 0.95', String(PARECIDO_ES_LA_MISMA));

console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTodo en verde');
process.exit(fallos ? 1 : 0);

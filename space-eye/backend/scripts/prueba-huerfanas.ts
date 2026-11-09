// backend/scripts/prueba-huerfanas.ts
//
// A que creativo le toca cada foto suelta.
//
//   npm run prueba:huerfanas
//
// No toca la base ni la red: `casarHuerfanas` es una funcion pura y es la
// parte del rescate que puede equivocarse EN SILENCIO. Las dos formas de
// fallar no son igual de graves: dejar un creativo sin foto se nota y se
// arregla; colgarle la foto de OTRO anuncio no se nota y el dashboard acaba
// ensenando como evidencia algo que nunca estuvo en esa pantalla. Por eso la
// regla es la mas parecida, no la primera que pase la tolerancia.
import { casarHuerfanas, type Huerfana, type SinFoto } from '../src/controllers/creativos.controller';

let fallos = 0;
function afirmar(ok: boolean, texto: string, extra = '') {
  if (!ok) { fallos++; console.log(`  FALLA  ${texto}  ${extra}`); }
  else console.log(`  ok     ${texto}  ${extra}`);
}

// Huellas de 64 hex. `h(n)` cambia n bits del primer caracter respecto a BASE.
const BASE = '0'.repeat(64);
const h = (hex: string) => hex + '0'.repeat(63);
const c = (phash: string): SinFoto => ({ phash });
const f = (id: number, phash: string, taken_at: string | null): Huerfana => ({ id, phash, taken_at });

console.log('\n1) Un creativo sin foto adopta la que se le parece');
let r = casarHuerfanas([c(BASE)], [f(10, BASE, '2026-10-20 10:00:00')], 24);
afirmar(r.length === 1 && r[0].primera === 10, 'la toma como foto del hallazgo');
afirmar(r[0].ultima === null, 'y sin segunda toma, que solo hay una');

console.log('\n2) Con varias suyas, la mas vieja es el hallazgo y la mas nueva es "hoy"');
r = casarHuerfanas([c(BASE)], [
  f(11, BASE, '2026-10-25 10:00:00'),
  f(10, BASE, '2026-10-20 10:00:00'),
  f(12, BASE, '2026-10-28 10:00:00'),
], 24);
afirmar(r[0].primera === 10, 'la del 20 es "aparecio"');
afirmar(r[0].ultima === 12, 'la del 28 es "ahora"');

console.log('\n3) Una foto que no se parece a nada no se le cuelga a nadie');
// 'f' = 1111 contra '0' = 0000 en cada uno de los 64 caracteres: 256 bits.
r = casarHuerfanas([c(BASE)], [f(10, 'f'.repeat(64), '2026-10-20 10:00:00')], 24);
afirmar(r.length === 0, 'se queda suelta');

console.log('\n4) Gana la MAS parecida, no la primera que pase');
// '1' = 0001 -> 1 bit; '3' = 0011 -> 2 bits. Las dos dentro de 24.
r = casarHuerfanas([c(BASE)], [
  f(10, h('3'), '2026-10-20 10:00:00'),
  f(11, h('1'), '2026-10-21 10:00:00'),
], 24);
afirmar(r[0].primera === 11, 'se queda con la de 1 bit, aunque llegue despues');

console.log('\n5) Una foto no puede ser de dos creativos a la vez');
r = casarHuerfanas([c(BASE), c(h('1'))], [f(10, BASE, '2026-10-20 10:00:00')], 24);
afirmar(r.length === 1 && r[0].phash === BASE, 'se la lleva el primero y el otro se queda sin ella');

console.log('\n6) La tolerancia es la misma vara que usa el reconocimiento');
afirmar(casarHuerfanas([c(BASE)], [f(10, h('f'), null)], 24).length === 1, '4 bits entran con tolerancia 24');
afirmar(casarHuerfanas([c(BASE)], [f(10, h('f'), null)], 3).length === 0, '4 bits NO entran con tolerancia 3');

console.log('\n7) Nada que repartir no truena');
afirmar(casarHuerfanas([], [f(10, BASE, null)], 24).length === 0, 'sin creativos -> nada');
afirmar(casarHuerfanas([c(BASE)], [], 24).length === 0, 'sin fotos -> nada');

console.log('\n8) Una foto sin fecha no rompe el orden');
r = casarHuerfanas([c(BASE)], [f(10, BASE, null), f(11, BASE, '2026-10-20 10:00:00')], 24);
afirmar(r.length === 1 && r[0].primera === 10 && r[0].ultima === 11, 'la de fecha desconocida va primero');

console.log(fallos === 0 ? '\nTODO BIEN\n' : `\n${fallos} FALLAS\n`);
process.exit(fallos === 0 ? 0 : 1);

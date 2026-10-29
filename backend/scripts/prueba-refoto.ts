// backend/scripts/prueba-refoto.ts
//
// Cuando se acepta OTRA foto del mismo creativo, que es lo unico que decide si
// la ficha puede ensenar "asi aparecio / asi se ve hoy" (migracion 029).
//
//   npm run prueba:refoto
//
// No toca la base ni la red: `tocaRefoto` es una funcion pura y esta es la
// unica parte del cambio que puede equivocarse en silencio. Las dos formas de
// equivocarse cuestan dinero en direcciones opuestas: de menos, la ficha se
// queda con una sola foto y el dueno vuelve a preguntar; de mas, el equipo
// sube la misma pantalla cada vuelta y se come los datos del sitio -que es
// justo lo que hacia TLALPAN con la pantalla apagada-.
import { tocaRefoto, type Conocida } from '../src/controllers/creativos.controller';

let fallos = 0;
function afirmar(ok: boolean, texto: string) {
  if (!ok) { fallos++; console.log(`  FALLA  ${texto}`); }
  else console.log(`  ok     ${texto}`);
}

const AHORA = Date.parse('2026-10-29T12:00:00Z');
const HORA = 3_600_000;
const c = (p: Partial<Conocida>): Conocida =>
  ({ phash: 'a'.repeat(64), bits: 3, photo_id: 10, photo_id_ultima: null, foto_en: null, ...p });

console.log('\nCuando toca otra foto del mismo creativo\n');

afirmar(
  tocaRefoto(c({ photo_id: null }), 24, AHORA),
  'sin ninguna foto, la primera entra siempre (aunque no tocara refoto)',
);

afirmar(
  tocaRefoto(c({ photo_id: null, foto_en: null }), 0, AHORA),
  'y entra incluso con el refresco apagado: es el hallazgo, no una repeticion',
);

afirmar(
  !tocaRefoto(c({ foto_en: new Date(AHORA - 2 * HORA) }), 24, AHORA),
  'con una foto de hace 2 h y plazo de 24 h, la repetida se descarta',
);

afirmar(
  tocaRefoto(c({ foto_en: new Date(AHORA - 25 * HORA) }), 24, AHORA),
  'con una de hace 25 h, se acepta la segunda toma',
);

afirmar(
  tocaRefoto(c({ foto_en: new Date(AHORA - 24 * HORA) }), 24, AHORA),
  'justo al cumplirse el plazo tambien entra (el limite no se queda fuera)',
);

afirmar(
  !tocaRefoto(c({ foto_en: new Date(AHORA - 10 * 365 * 24 * HORA) }), 0, AHORA),
  'con refoto_h = 0 no se repite nunca, por vieja que sea: es lo de antes de la 029',
);

afirmar(
  !tocaRefoto(c({ foto_en: new Date(AHORA - 10 * 365 * 24 * HORA) }), -3, AHORA),
  'un plazo negativo no abre la puerta: se trata como apagado',
);

afirmar(
  tocaRefoto(c({ photo_id: 10, foto_en: null }), 24, AHORA),
  'si la ficha dice tener foto pero no sabemos de cuando, se deja pasar una',
);

// El caso que importa en el sitio: TLALPAN manda la pantalla apagada cada
// vuelta. Con el plazo puesto, de 48 vueltas en 24 h entra UNA foto, no 48:
// la primera consume el plazo y la siguiente ya no cabe en ese dia.
let entran = 0;
let ultima = AHORA - 24 * HORA;
for (let i = 0; i < 48; i++) {
  const t = AHORA + i * (HORA / 2);
  if (tocaRefoto(c({ foto_en: new Date(ultima) }), 24, t)) { entran++; ultima = t; }
}
afirmar(entran === 1, `de 48 vueltas en 24 h solo entra 1 foto (entraron ${entran})`);

// Y en una semana, una al dia: el gasto que agrega la 029 es ese y no mas.
let enSemana = 0;
let ult = AHORA - 24 * HORA;
for (let i = 0; i < 7 * 48; i++) {
  const t = AHORA + i * (HORA / 2);
  if (tocaRefoto(c({ foto_en: new Date(ult) }), 24, t)) { enSemana++; ult = t; }
}
afirmar(enSemana === 7, `en 7 dias entran 7 fotos, una por dia (entraron ${enSemana})`);

console.log(`\n${fallos ? `${fallos} FALLA(S)` : 'Todo bien.'}\n`);
process.exit(fallos ? 1 : 0);

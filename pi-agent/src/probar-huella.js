// pi-agent/src/probar-huella.js
//
// Comprueba la huella visual con imagenes inventadas, sin camara ni red:
//
//   node src/probar-huella.js
//
// Lo que tiene que cumplir para servir en un espectacular:
//   - el mismo creativo, mas claro o mas oscuro (dia/noche), da CASI la misma
//     huella;
//   - un creativo distinto da una huella LEJANA;
//   - el temblor normal de la camara en el poste no lo convierte en "nuevo";
//   - una pantalla apagada o una noche cerrada NO inventan creativos.
//
// Las pruebas van a 960x540, que es el orden de lo que ve la camara. La escala
// importa: un corrimiento de 6 pixeles es despreciable en una imagen de 960 de
// ancho y es un golpe fuerte en una de 256.
const { calcular, distancia, CONTRASTE_MINIMO } = require('./huella');

const ANCHO = 960;
const ALTO = 540;
const { TOLERANCIA } = require("./huella"); // los bits (de 256) que el sistema acepta como "es el mismo"

function lienzo(pintor) {
  const g = new Uint8Array(ANCHO * ALTO);
  for (let y = 0; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) g[y * ANCHO + x] = pintor(x, y);
  return g;
}

const recorta = (v) => Math.max(0, Math.min(255, Math.round(v)));

// Ruido de sensor. Toda camara lo tiene, y aqui no es un adorno: sin el, una
// figura perfectamente simetrica deja media docena de coeficientes valiendo cero
// EXACTO, y el signo de un cero es una moneda al aire que cambia la huella sola.
// Ese caso no existe en el mundo real, pero si se cuela en un lienzo inventado y
// haria pasar por buena una prueba que no lo es.
// Generador propio y con semilla: la prueba tiene que dar lo mismo cada vez.
// Con Math.imul, que multiplica en 32 bits de verdad. Una multiplicacion normal
// se sale de la precision de JavaScript y degenera en un patron fijo: no es
// ruido, es una plantilla que se le suma igual a todas las imagenes y las vuelve
// parecidas entre si. (Paso: la prueba acuso a la huella de no distinguir dos
// creativos, y el defecto estaba aqui.)
function conRuido(img, semilla = 7, sigma = 3) {
  let s = semilla >>> 0;
  const aleatorio = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const g = new Uint8Array(img.length);
  for (let i = 0; i < img.length; i++) {
    // Dos uniformes sumadas se acercan a una campana, suficiente para esto.
    g[i] = recorta(img[i] + (aleatorio() + aleatorio() - 1) * sigma * 2);
  }
  return g;
}

// "Creativos" distintos entre si, con la pinta de un anuncio: manchas grandes de
// color plano y algo de texto, no texturas finas.
const creativos = {
  franjas:  lienzo((x, y) => (Math.floor(y / 90) % 2 ? 30 : 220)),
  circulo:  lienzo((x, y) => (Math.hypot(x - ANCHO / 2, y - ALTO / 2) < 180 ? 240 : 25)),
  mitades:  lienzo((x) => (x < ANCHO / 2 ? 235 : 35)),
  bloques:  lienzo((x, y) => ((Math.floor(x / 120) + Math.floor(y / 120)) % 2 ? 200 : 40)),
  titular:  lienzo((x, y) => (y > 180 && y < 320 && x % 150 < 90 ? 250 : 20)),
};
// Cada creativo, tal como lo entregaria una camara.
for (const k of Object.keys(creativos)) creativos[k] = conRuido(creativos[k]);

let fallos = 0;
const afirmar = (ok, texto, extra = '') => {
  if (!ok) { fallos++; console.log(`  FALLA  ${texto}  ${extra}`); }
  else console.log(`  ok     ${texto}  ${extra}`);
};

console.log('\n1) La misma imagen siempre da la misma huella');
const h1 = calcular(creativos.franjas, ANCHO, ALTO);
const h2 = calcular(creativos.franjas, ANCHO, ALTO);
afirmar(h1 === h2 && /^[0-9a-f]{64}$/.test(h1), 'huella estable y de 64 caracteres', h1);

console.log('\n2) De dia y de noche: el mismo creativo, otra luz');
for (const [nombre, img] of Object.entries(creativos)) {
  // Otra luz Y otro ruido: son dos tomas distintas, no la misma imagen retocada.
  const base = calcular(img, ANCHO, ALTO);
  const noche = calcular(conRuido(img.map((v) => recorta(v * 0.45)), 21), ANCHO, ALTO);
  const sol = calcular(conRuido(img.map((v) => recorta(60 + v * 0.75)), 33), ANCHO, ALTO);
  const dn = distancia(base, noche), dc = distancia(base, sol);
  afirmar(dn <= TOLERANCIA && dc <= TOLERANCIA, `${nombre}: sigue siendo el mismo`, `noche ${dn} bits, sol ${dc} bits`);
}

console.log('\n3) Un creativo distinto tiene que quedar LEJOS');
const nombres = Object.keys(creativos);
let minimo = 256;
for (let i = 0; i < nombres.length; i++) {
  for (let j = i + 1; j < nombres.length; j++) {
    const d = distancia(calcular(creativos[nombres[i]], ANCHO, ALTO), calcular(creativos[nombres[j]], ANCHO, ALTO));
    minimo = Math.min(minimo, d);
  }
}
afirmar(minimo > TOLERANCIA * 2, 'ningun par de creativos distintos se acerca al umbral',
  `el par mas parecido difiere en ${minimo} bits, contra ${TOLERANCIA} de tolerancia`);

console.log('\n4) La camara tiembla en el poste (no es creativo nuevo)');
function correr(img, dx, dy) {
  const s = new Uint8Array(ANCHO * ALTO);
  for (let y = 0; y < ALTO; y++) {
    for (let x = 0; x < ANCHO; x++) {
      s[y * ANCHO + x] = img[Math.min(ALTO - 1, y + dy) * ANCHO + Math.min(ANCHO - 1, x + dx)];
    }
  }
  return s;
}
for (const [nombre, img] of Object.entries(creativos)) {
  const d = distancia(calcular(img, ANCHO, ALTO), calcular(correr(img, 6, 4), ANCHO, ALTO));
  afirmar(d <= TOLERANCIA, `${nombre}: aguanta 6 px (0.6% del ancho)`, `${d} bits`);
}

console.log('\n5) Cuanto aguanta antes de romperse (informativo)');
// Hasta donde se puede mover la camara sin que el sitio empiece a reportar
// creativos nuevos. Si alguien le da un golpe al poste y se pasa de aqui, va a
// haber falsas alarmas hasta que se vuelva a aprender el catalogo.
for (const px of [6, 30, 60, 120, 240]) {
  const ds = Object.entries(creativos).map(([, img]) =>
    distancia(calcular(img, ANCHO, ALTO), calcular(correr(img, px, Math.round(px * 0.66)), ANCHO, ALTO)));
  const peor = Math.max(...ds);
  console.log(`  ${String(px).padStart(3)} px (${String(Math.round((px / ANCHO) * 1000) / 10).padStart(4)}% del ancho): peor caso ${String(peor).padStart(2)} bits  ${peor <= TOLERANCIA ? '-> sigue siendo el mismo' : '-> SE REPORTA COMO NUEVO'}`);
}

console.log('\n5b) Dos anuncios parecidos entre si (lo mas dificil)');
// La zona muerta manda a 0 todo lo que no resalta, asi que el riesgo es que dos
// creativos "oscuros con un elemento brillante" acaben con la misma huella.
const oscuroIzq = conRuido(lienzo((x, y) => (x > 150 && x < 400 && y > 150 && y < 380 ? 245 : 22)), 51);
const oscuroDer = conRuido(lienzo((x, y) => (x > 560 && x < 810 && y > 150 && y < 380 ? 245 : 22)), 52);
const oscuroChico = conRuido(lienzo((x, y) => (x > 150 && x < 300 && y > 200 && y < 330 ? 245 : 22)), 53);
const dLados = distancia(calcular(oscuroIzq, ANCHO, ALTO), calcular(oscuroDer, ANCHO, ALTO));
const dTamano = distancia(calcular(oscuroIzq, ANCHO, ALTO), calcular(oscuroChico, ANCHO, ALTO));
afirmar(dLados > TOLERANCIA, 'el mismo recuadro de un lado y del otro no se confunde', `${dLados} bits`);
afirmar(dTamano > TOLERANCIA, 'el mismo recuadro mas chico tampoco', `${dTamano} bits`);

console.log('\n6) Pantalla apagada o noche cerrada: no se inventa nada');
const apagada = lienzo(() => 12);
const casiLisa = lienzo((x, y) => 40 + ((x + y) % 3));
afirmar(calcular(apagada, ANCHO, ALTO) === null, 'pantalla apagada -> sin huella');
afirmar(calcular(casiLisa, ANCHO, ALTO) === null, `contraste por debajo de ${CONTRASTE_MINIMO} -> sin huella`);
afirmar(calcular(creativos.circulo, ANCHO, ALTO) !== null, 'un creativo de verdad si pasa el filtro');

console.log('\n7) Entradas invalidas no truenan');
afirmar(calcular(null, ANCHO, ALTO) === null, 'sin imagen -> null');
afirmar(calcular(new Uint8Array(10), ANCHO, ALTO) === null, 'imagen incompleta -> null');
afirmar(distancia('abc', 'defg') === 256, 'huellas de distinto largo -> lo mas lejano posible');

console.log(fallos === 0 ? '\nTODO BIEN\n' : `\n${fallos} FALLAS\n`);
process.exit(fallos === 0 ? 0 : 1);

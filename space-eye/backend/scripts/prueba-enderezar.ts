// backend/scripts/prueba-enderezar.ts
//
// El enderezado del servidor tiene que dar la MISMA huella que el equipo.
//
//   FOTOS=<carpeta> npm run prueba:enderezar
//
// La carpeta lleva un `manifiesto.json` con lo que hace falta para repetir la
// cuenta del agente sobre fotos de verdad:
//
//   [{ "ruta": "/storage/photos/...jpg",   <- de donde salio (su nombre es el archivo)
//      "phash": "fe00...",                 <- la huella que calculo EL EQUIPO
//      "pantalla": "{\"esquinas\":[...]}", <- las esquinas de ese equipo
//      "giro": 0 }]                        <- el giro horneado en la foto
//
// Por que contra fotos reales y no contra un fixture: no hay forma de probar
// esto con una imagen inventada. La prueba de `utils/huella.ts` compara contra
// las dos pantallas ya enderezadas de MANUEL DUBLAN, asi que cubre la huella
// pero NO el enderezado; y el enderezado es justo donde un port se desvia (un
// pixel de alto, el gris con otra formula, el borde). La unica vara honesta es
// la foto entera de un sitio, sus esquinas, y la huella que el agente saco de
// ahi: si el servidor llega al mismo sitio, el port esta bien.
//
// La vara es la TOLERANCIA (24 bits de 256), que es la misma con la que el
// servidor decide si dos fotos son el mismo creativo. Si el enderezado del
// servidor cae dentro, reconoce lo que el equipo reconoce.
import { readFileSync, existsSync } from 'fs';
import { basename, join } from 'path';
import { enderezarPantalla, girarEsquinas, medirPantalla, type Gris, type Punto } from '../src/utils/enderezar';
import { calcular, distancia, TOLERANCIA } from '../src/utils/huella';

const CARPETA = process.env.FOTOS ?? '';
if (!CARPETA) {
  console.error('Falta FOTOS=<carpeta con manifiesto.json>');
  process.exit(1);
}

type Caso = { ruta: string; phash: string; pantalla: string; giro: number };

let fallos = 0;
function afirmar(ok: boolean, texto: string, extra = '') {
  if (!ok) { fallos++; console.log(`  FALLA  ${texto}  ${extra}`); }
  else console.log(`  ok     ${texto}  ${extra}`);
}

async function main() {
  console.log('\n1) Las esquinas giran como la foto');
  const q: Punto[] = [[0.2, 0.1], [0.8, 0.1], [0.8, 0.5], [0.2, 0.5]];
  afirmar(JSON.stringify(girarEsquinas(q, 0)) === JSON.stringify(q), 'con 0 grados no se tocan');
  afirmar(JSON.stringify(girarEsquinas(q, 360)) === JSON.stringify(q), 'y 360 es lo mismo que 0');
  const ida = girarEsquinas(girarEsquinas(girarEsquinas(girarEsquinas(q, 90), 90), 90), 90);
  afirmar(ida.every((p, i) => Math.abs(p[0] - q[i][0]) < 1e-9 && Math.abs(p[1] - q[i][1]) < 1e-9),
    'cuatro giros de 90 vuelven al principio');
  // Se compara con holgura y no con ===: 1 - 0.8 no da 0.2 en coma flotante,
  // da 0.19999999999999996, y una prueba que exija el literal falla por el
  // redondeo y no por la geometria.
  const medio = girarEsquinas(q, 180);
  const esperado: Punto[] = [[0.8, 0.9], [0.2, 0.9], [0.2, 0.5], [0.8, 0.5]];
  afirmar(medio.every((p, i) => Math.abs(p[0] - esperado[i][0]) < 1e-9 && Math.abs(p[1] - esperado[i][1]) < 1e-9),
    '180 grados es el reflejo por el centro');

  console.log('\n2) Una pantalla apagada no es un creativo');
  const lleno = (v: number): Gris => ({ datos: new Uint8Array(320 * 180).fill(v), ancho: 320, alto: 180 });
  const franjas = (base: number, amplitud: number): Gris => {
    const datos = new Uint8Array(320 * 180);
    // Franjas de verdad: un patron que se promediara a cero no serviria.
    for (let i = 0; i < datos.length; i++) datos[i] = base + (i % 2 ? amplitud : -amplitud);
    return { datos, ancho: 320, alto: 180 };
  };
  afirmar(medirPantalla(lleno(12)).apagada, 'negra y lisa: apagada');
  afirmar(medirPantalla(lleno(64)).apagada, 'gris pareja de dia (el LED apagado refleja el cielo): apagada');
  // El hueco por el que se colaba TLALPAN: oscura CON algo de textura. La huella
  // si se puede calcular (variacion 10 > 6), y antes eso bastaba para llamarlo
  // creativo nuevo y gastar una foto.
  const penumbra = franjas(25, 10);
  afirmar(medirPantalla(penumbra).apagada, 'oscura con algo de textura: apagada (el caso de TLALPAN)');
  afirmar(medirPantalla(penumbra).desv > 6, 'y aun asi da huella, que es por lo que se colaba');
  // Un anuncio de verdad: la medida mas floja de las 43 fotos de g500 era
  // brillo 45 con variacion 23.
  afirmar(!medirPantalla(franjas(45, 23)).apagada, 'el creativo mas flojo medido en g500 NO es apagada');
  afirmar(!medirPantalla(franjas(100, 40)).apagada, 'y un anuncio normal tampoco');

  console.log('\n3) La huella del servidor contra la del equipo, en fotos reales');
  const casos: Caso[] = JSON.parse(readFileSync(join(CARPETA, 'manifiesto.json'), 'utf8'));
  let dentro = 0;
  let iguales = 0;
  let sinArchivo = 0;
  const distancias: number[] = [];

  for (const c of casos) {
    const archivo = join(CARPETA, basename(c.ruta));
    if (!existsSync(archivo)) { sinArchivo++; continue; }
    const esquinas = JSON.parse(c.pantalla)?.esquinas as Punto[] | undefined;
    if (!esquinas) { sinArchivo++; continue; }

    const gris = await enderezarPantalla(readFileSync(archivo), esquinas, Number(c.giro) || 0);
    if (!gris) { afirmar(false, `${basename(c.ruta)}: no se pudo enderezar`); continue; }
    const mia = calcular(gris.datos, gris.ancho, gris.alto);
    if (!mia) { afirmar(false, `${basename(c.ruta)}: sin contraste despues de enderezar`); continue; }

    const d = distancia(mia, c.phash);
    distancias.push(d);
    if (d === 0) iguales++;
    if (d <= TOLERANCIA) dentro++;
    console.log(`  ${d <= TOLERANCIA ? 'casa ' : 'FUERA'}  ${basename(c.ruta).slice(0, 8)}  ${String(d).padStart(3)} bits`);
  }

  const n = distancias.length;
  if (sinArchivo) console.log(`  (${sinArchivo} caso(s) sin archivo o sin esquinas, saltados)`);
  if (!n) { console.log('  no habia ningun caso que medir'); process.exit(1); }

  const orden = [...distancias].sort((a, b) => a - b);
  const mediana = orden[Math.floor(n / 2)];
  const peor = orden[n - 1];
  console.log(`  ${n} foto(s): ${iguales} identicas, mediana ${mediana} bits, peor ${peor}`);

  // Se juzga por la MEDIANA y no por la peor, y la razon esta en los datos:
  // algunos equipos de prueba son una camara apuntando a un MONITOR que
  // reproduce un video de un espectacular. En esos, el fotograma que quedo
  // guardado no es el que el agente midio -el video siguio corriendo- y la
  // huella es legitimamente otra. Eso no es un fallo del port, y una prueba que
  // exija las 14 se cae por un dato, no por el codigo.
  //
  // Un port roto no mueve una foto: las mueve TODAS, y la mediana se dispara.
  afirmar(mediana <= 3, 'la mitad de las fotos casan casi bit a bit', `mediana ${mediana}`);
  afirmar(iguales > 0, 'y algunas son identicas al bit', `${iguales} de ${n}`);
  afirmar(dentro >= Math.ceil(n * 0.9), `al menos el 90% dentro de la tolerancia (${TOLERANCIA})`,
    `${dentro}/${n}`);

  console.log(fallos ? `\n${fallos} FALLAS` : '\nTodo en orden');
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

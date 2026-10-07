// pi-agent/src/probar-ajustes.js
//
// Comprueba la traduccion de "lo que se ajusta en el dashboard" a banderas de
// rpicam-still, sin camara ni red:
//
//   node src/probar-ajustes.js
//
// Importa porque un recorte mal calculado se sale del cuadro y rpicam falla, o
// peor: encuadra otra cosa y las fotos del sitio quedan apuntando al vacio sin
// que nadie lo note hasta revisar la galeria.
const { argumentosDeAjuste } = require('./camara');

let fallos = 0;
const afirmar = (ok, texto, extra = '') => {
  if (!ok) { fallos++; console.log(`  FALLA  ${texto}  ${extra}`); }
  else console.log(`  ok     ${texto}  ${extra}`);
};

/** Saca el valor que sigue a una bandera. */
const valorDe = (args, bandera) => {
  const i = args.indexOf(bandera);
  return i >= 0 ? args[i + 1] : null;
};
const roiDe = (args) => {
  const v = valorDe(args, '--roi');
  return v ? v.split(',').map(Number) : null;
};

console.log('\n1) Sin ajustes no se manda nada');
afirmar(argumentosDeAjuste({}).length === 0, 'sin opciones -> sin banderas');
afirmar(argumentosDeAjuste({ zoom: 0 }).length === 0, 'zoom 0 -> cuadro completo, sin --roi');

console.log('\n2) El recorte del zoom siempre cae dentro del cuadro');
for (const zoom of [0.1, 0.25, 0.5, 0.75, 0.9]) {
  for (const [cx, cy] of [[0.5, 0.5], [0, 0], [1, 1], [0.1, 0.9]]) {
    const roi = roiDe(argumentosDeAjuste({ zoom, ajustes: { centro_x: cx, centro_y: cy } }));
    const [x, y, w, h] = roi;
    const dentro = x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1.0001 && y + h <= 1.0001;
    if (!dentro) { afirmar(false, `zoom ${zoom} centro ${cx},${cy}`, roi.join(',')); }
  }
}
afirmar(true, 'probadas 20 combinaciones de zoom y centro, todas dentro del cuadro');

console.log('\n3) A mas zoom, recorte mas chico');
const anchoCon = (z) => roiDe(argumentosDeAjuste({ zoom: z }))[2];
afirmar(anchoCon(0.25) > anchoCon(0.5) && anchoCon(0.5) > anchoCon(0.9), 'el recorte se cierra al subir el zoom',
  `0.25 -> ${anchoCon(0.25)}, 0.5 -> ${anchoCon(0.5)}, 0.9 -> ${anchoCon(0.9)}`);
const centrado = roiDe(argumentosDeAjuste({ zoom: 0.5 }));
afirmar(Math.abs(centrado[0] - 0.25) < 0.001 && Math.abs(centrado[1] - 0.25) < 0.001,
  'sin centro indicado, recorta al centro', centrado.join(','));

console.log('\n4) Valores fuera de rango no rompen nada');
afirmar(roiDe(argumentosDeAjuste({ zoom: 5 }))[2] >= 0.1, 'zoom 5 se limita al maximo util');
afirmar(argumentosDeAjuste({ zoom: -3 }).length === 0, 'zoom negativo -> sin recorte');
afirmar(argumentosDeAjuste({ zoom: 'hola' }).length === 0, 'zoom que no es numero -> sin recorte');
const raro = argumentosDeAjuste({ ajustes: { saturacion: 99, contraste: -5, ev: 500 } });
afirmar(valorDe(raro, '--saturation') === '2' && valorDe(raro, '--contrast') === '0' && valorDe(raro, '--ev') === '10',
  'saturacion, contraste y exposicion se recortan a su rango', raro.join(' '));

console.log('\n5) Balance de blancos (lo que corrige el tinte morado)');
const manual = argumentosDeAjuste({ ajustes: { awb: 'daylight', awb_rojo: 1.6, awb_azul: 1.4 } });
afirmar(valorDe(manual, '--awbgains') === '1.6,1.4', 'las ganancias manuales mandan sobre el modo');
afirmar(!manual.includes('--awb'), 'y no se manda el modo automatico junto con ellas');
const porModo = argumentosDeAjuste({ ajustes: { awb: 'daylight' } });
afirmar(valorDe(porModo, '--awb') === 'daylight', 'sin ganancias, se usa el modo');
afirmar(argumentosDeAjuste({ ajustes: { awb: 'inventado' } }).length === 0, 'un modo que no existe se ignora');
afirmar(argumentosDeAjuste({ ajustes: { awb_rojo: 1.6 } }).length === 0, 'una sola ganancia sin la otra se ignora');

console.log('\n6) Ajustes sueltos');
afirmar(argumentosDeAjuste({ ajustes: { hflip: true, vflip: true } }).join(' ') === '--hflip --vflip', 'volteo');
afirmar(valorDe(argumentosDeAjuste({ ajustes: { ruido: 'cdn_hq' } }), '--denoise') === 'cdn_hq', 'reduccion de ruido');
afirmar(argumentosDeAjuste({ ajustes: { ruido: 'lo_que_sea' } }).length === 0, 'un modo de ruido inventado se ignora');

console.log(fallos === 0 ? '\nTODO BIEN\n' : `\n${fallos} FALLAS\n`);
process.exit(fallos === 0 ? 0 : 1);

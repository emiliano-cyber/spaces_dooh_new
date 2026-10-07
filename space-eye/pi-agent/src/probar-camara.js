// pi-agent/src/probar-camara.js
// Prueba la captura sin tocar el servidor: dice que camara encontro, toma una
// foto y la guarda como prueba.jpg junto al agente.
const fs = require('fs');
const path = require('path');
const { Camara } = require('./camara');
const rutas = require('./rutas');
const tele = require('./telemetria');

(async () => {
  console.log(`equipo:  ${tele.modelo()}`);
  console.log(`serie:   ${tele.serie() || '(no disponible)'}`);

  const energia = tele.alimentacion();
  if (energia) {
    console.log(`energia: ${energia.crudo}` +
      (energia.subvoltaje_ahora ? '  <-- FALTA VOLTAJE AHORA MISMO' :
        energia.subvoltaje_ocurrido ? '  <-- hubo falta de voltaje desde que arranco' : '  (correcto)'));
  }

  const camara = new Camara();
  try {
    console.log(`camara:  ${await camara.describir()}`);
  } catch (e) {
    console.error(`\nNo hay forma de tomar fotos: ${e.message}`);
    process.exit(1);
  }

  const t0 = Date.now();
  const jpeg = await camara.tomarFoto();
  const destino = path.join(rutas.BASE, 'prueba.jpg');
  fs.writeFileSync(destino, jpeg);
  console.log(`\nFoto guardada en ${destino} (${Math.round(jpeg.length / 1024)} KB, ${Date.now() - t0} ms)`);
  if (camara.esPrueba()) {
    console.log('OJO: es una imagen generada, no una foto real. Conecta la camara o una webcam USB.');
  }
})().catch((e) => {
  console.error(`Fallo la prueba: ${e.message}`);
  process.exit(1);
});

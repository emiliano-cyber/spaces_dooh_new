// pc-agent/src/probar-camara.js
// Prueba SOLO la camara, sin tocar el servidor. Sirve para verificar en sitio que
// la IP, el usuario y la clave son correctos antes de dar de alta el equipo:
//   npm run probar-camara
const fs = require('fs');
const path = require('path');
const { Camara } = require('./camera');

const RUTA_CONFIG = process.env.SPACEEYE_CONFIG || path.join(__dirname, '..', 'config.json');

(async () => {
  if (!fs.existsSync(RUTA_CONFIG)) {
    console.error(`No encuentro ${RUTA_CONFIG}. Copia config.example.json a config.json.`);
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(RUTA_CONFIG, 'utf8'));
  const cam = new Camara(cfg.camara);

  console.log(`Probando ${cfg.camara.host}:${cfg.camara.puerto || 80} canal ${cfg.camara.canal || 101}...`);

  const info = await cam.infoDispositivo();
  if (info) console.log(`  modelo: ${info.modelo}  firmware: ${info.firmware}  serie: ${info.serie}`);
  else console.log('  no pude leer los datos del equipo (sigo con la foto)');

  try {
    const jpeg = await cam.tomarFoto();
    const salida = path.join(__dirname, '..', 'prueba.jpg');
    fs.writeFileSync(salida, jpeg);
    console.log(`  OK: foto de ${Math.round(jpeg.length / 1024)} KB guardada en ${salida}`);
    console.log('  Abrela para confirmar el encuadre. Si se ve bien, el agente ya puede correr.');
  } catch (e) {
    console.error(`  FALLO: ${e.message}`);
    console.error('  Revisa: IP correcta, usuario/clave del equipo (no los de Hik-Connect),');
    console.error('  y que la PC alcance a la camara (prueba abrir http://<ip> en el navegador).');
    process.exit(1);
  }
})();

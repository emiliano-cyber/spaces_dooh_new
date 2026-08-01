// pi-agent/src/rutas.js
// Donde viven config.json, state.json, el registro y la cola de fotos.
//
// Por omision todo cuelga de la carpeta del agente (comodo para la demo y para
// desarrollo). Al instalarlo como servicio conviene mover config y estado a
// rutas del sistema con SPACEEYE_DIR, para que una reinstalacion del codigo no
// se lleve por delante la identidad del equipo.
const path = require('path');

const BASE = process.env.SPACEEYE_DIR || path.join(__dirname, '..');

module.exports = {
  BASE,
  config: process.env.SPACEEYE_CONFIG || path.join(BASE, 'config.json'),
  estado: path.join(BASE, 'state.json'),
  registro: path.join(BASE, 'agente.log'),
  // Fotos que no se pudieron subir (sin red): se reintentan despues.
  cola: path.join(BASE, 'cola'),
};

// pc-agent/src/rutas.js
// Donde viven config.json y state.json.
//
// Empaquetado como .exe, __dirname apunta al sistema de archivos VIRTUAL que
// lleva dentro (solo lectura): hay que usar la carpeta del ejecutable real. Sin
// esto, el agente no encuentra su configuracion ni puede guardar su identidad.
const path = require('path');

// Empaquetado con SEA (lo nativo de Node) o con pkg; en ambos casos manda la
// carpeta del .exe, no la del codigo.
function empaquetado() {
  try { return require('node:sea').isSea(); } catch { /* Node sin SEA */ }
  return typeof process.pkg !== 'undefined';
}

const esExe = empaquetado();
const BASE = esExe ? path.dirname(process.execPath) : path.join(__dirname, '..');

module.exports = {
  esExe,
  BASE,
  ejecutable: process.execPath,
  config: process.env.SPACEEYE_CONFIG || path.join(BASE, 'config.json'),
  estado: path.join(BASE, 'state.json'),
  registro: path.join(BASE, 'agente.log'),
};

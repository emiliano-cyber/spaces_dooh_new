// backend/scripts/prueba-agentes-de-fabrica.ts
//
// Comprueba que un Space Eye publica para sus equipos el agente de Raspberry que
// trae su imagen, y que lo hace con cuidado: solo si es mas nuevo, nunca hacia
// atras, y con el manifiesto al final. Si esto falla en silencio, el boton
// "Actualizar" de las Raspberry de una empresa se queda sin nada que ofrecer, o
// peor, les ofrece una version vieja.
//
//   npm run prueba:agentes
//
// Usa carpetas temporales; no toca la base de datos ni la red.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { compararVersiones, publicarAgentesDeFabrica } from '../src/utils/agentesDeFabrica';

let fallos = 0;
function afirmar(ok: boolean, texto: string) {
  if (!ok) fallos++;
  console.log(`  ${ok ? 'ok   ' : 'FALLA'}  ${texto}`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentes-'));
const fabrica = path.join(tmp, 'fabrica');
const descargas = path.join(tmp, 'descargas');
fs.mkdirSync(fabrica);

function deFabrica(version: string, contenido = `paquete ${version}`) {
  fs.writeFileSync(path.join(fabrica, 'space-eye-pi-agent.tar.gz'), contenido);
  fs.writeFileSync(path.join(fabrica, 'instalar-pi.sh'), `# instalador ${version}`);
  fs.writeFileSync(path.join(fabrica, 'space-eye-pi-agent.json'), JSON.stringify({ version, sha256: `sha-${contenido}` }));
}
const publicada = () => {
  try { return JSON.parse(fs.readFileSync(path.join(descargas, 'space-eye-pi-agent.json'), 'utf8')).version; }
  catch { return null; }
};
const leer = (f: string) => fs.readFileSync(path.join(descargas, f), 'utf8');

console.log('\n1) Comparar versiones por numeros');
afirmar(compararVersiones('0.7.0', '0.6.12') === 1, '0.7.0 es mas nueva que 0.6.12 (como texto saldria al reves)');
afirmar(compararVersiones('0.10.0', '0.9.9') === 1, '0.10.0 es mas nueva que 0.9.9');
afirmar(compararVersiones('1.0', '1.0.0') === 0, '1.0 y 1.0.0 son la misma');
afirmar(compararVersiones('0.6.0', '0.7.0') === -1, '0.6.0 es mas vieja que 0.7.0');

console.log('\n2) Instancia nueva: no hay nada publicado');
deFabrica('0.7.0');
afirmar(publicarAgentesDeFabrica(descargas, fabrica).length === 1, 'publica el agente');
afirmar(publicada() === '0.7.0', 'el manifiesto dice 0.7.0');
afirmar(leer('space-eye-pi-agent.tar.gz') === 'paquete 0.7.0', 'el paquete es el de la imagen');
afirmar(leer('instalar-pi.sh') === '# instalador 0.7.0', 'y el instalador viaja con el');

console.log('\n3) Mismo arranque otra vez: nada que hacer');
afirmar(publicarAgentesDeFabrica(descargas, fabrica).length === 0, 'no vuelve a copiar la misma version');

console.log('\n4) Alguien publico a mano algo mas nuevo (una prueba en un sitio)');
fs.writeFileSync(path.join(descargas, 'space-eye-pi-agent.json'), JSON.stringify({ version: '0.8.0-prueba' }));
fs.writeFileSync(path.join(descargas, 'space-eye-pi-agent.tar.gz'), 'paquete a mano');
afirmar(publicarAgentesDeFabrica(descargas, fabrica).length === 0, 'no lo pisa');
afirmar(leer('space-eye-pi-agent.tar.gz') === 'paquete a mano', 'el paquete a mano sigue ahi');

console.log('\n5) La imagen trae una version mas nueva');
deFabrica('0.9.0');
afirmar(publicarAgentesDeFabrica(descargas, fabrica).length === 1, 'la publica');
afirmar(publicada() === '0.9.0' && leer('space-eye-pi-agent.tar.gz') === 'paquete 0.9.0', 'paquete y manifiesto de la 0.9.0');

console.log('\n6) Misma version reconstruida (otro paquete, mismo numero)');
deFabrica('0.9.0', 'paquete 0.9.0 corregido');
afirmar(publicarAgentesDeFabrica(descargas, fabrica).length === 1, 'publica el de la imagen');
afirmar(leer('space-eye-pi-agent.tar.gz') === 'paquete 0.9.0 corregido', 'el paquete publicado es el corregido');
afirmar(publicarAgentesDeFabrica(descargas, fabrica).length === 0, 'y no lo vuelve a copiar en el siguiente arranque');

console.log('\n7) Sin carpeta de descargas (Space Eye central) o sin agentes en la imagen');
afirmar(publicarAgentesDeFabrica('', fabrica).length === 0, 'sin DESCARGAS_DIR no hace nada');
afirmar(publicarAgentesDeFabrica(descargas, path.join(tmp, 'no-existe')).length === 0, 'sin /app/agentes no hace nada');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} FALLAS\n` : '\nTodo bien.\n');
process.exit(fallos ? 1 : 0);

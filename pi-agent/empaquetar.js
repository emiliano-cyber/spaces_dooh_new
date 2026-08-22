// pi-agent/empaquetar.js
// Arma el paquete que baja la Raspberry al actualizarse por red, y el JSON con
// su version y su huella.
//
// El paquete lleva node_modules DENTRO a proposito. La alternativa -correr
// `npm install` en la Pi despues de bajar- agrega una dependencia de red y del
// registro de npm justo en el momento mas delicado de la maniobra, en un equipo
// que puede estar detras de un modem LTE. La unica dependencia es
// socket.io-client, JavaScript puro sin nada compilado, asi que empaquetarlo
// desde Windows y descomprimirlo en la Pi funciona igual.
//
// Uso:  npm run empaquetar
// Deja en dist/: space-eye-pi-agent.tar.gz y space-eye-pi-agent.json
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const RAIZ = __dirname;
const DIST = path.join(RAIZ, 'dist');
const PAQUETE = path.join(DIST, 'space-eye-pi-agent.tar.gz');
const META = path.join(DIST, 'space-eye-pi-agent.json');

// Lo mismo que reemplaza `src/actualizar.js` al instalar. Si aqui se agrega algo
// hay que agregarlo alla, o quedaria fuera de la actualizacion.
const CONTENIDO = ['src', 'package.json', 'node_modules'];

const paso = (n, t) => console.log(`\n[${n}] ${t}`);

function version() {
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  const src = fs.readFileSync(path.join(RAIZ, 'src', 'index.js'), 'utf8');
  const m = src.match(/const VERSION = '([^']+)'/);
  const enCodigo = m && m[1];

  // Que package.json y el codigo digan cosas distintas es como quedarse sin
  // saber que corre cada sitio. Se corta aqui, no en campo.
  if (!enCodigo) throw new Error('no encontre VERSION en src/index.js');
  if (enCodigo !== pkg.version) {
    throw new Error(`la version no coincide: package.json dice ${pkg.version} y src/index.js dice ${enCodigo}`);
  }
  return enCodigo;
}

(function () {
  const v = version();
  console.log(`\nSPACE EYE — empaquetando el agente de Raspberry v${v}`);

  for (const nombre of CONTENIDO) {
    const ruta = path.join(RAIZ, nombre);
    if (!fs.existsSync(ruta)) {
      throw new Error(`falta ${nombre}. Si es node_modules, corre antes: npm install`);
    }
  }

  fs.mkdirSync(DIST, { recursive: true });
  if (fs.existsSync(PAQUETE)) fs.unlinkSync(PAQUETE);

  paso(1, 'Comprimiendo src/, package.json y node_modules...');
  // Rutas RELATIVAS y cwd, sin letra de unidad. GNU tar (el que trae Git para
  // Windows) interpreta "C:\..." como si "C" fuera un servidor remoto e intenta
  // conectarse por rsh; falla con un error que no dice nada. bsdtar no tiene ese
  // problema, pero cual de los dos aparece en el PATH depende de la maquina.
  //
  // --format=ustar porque bsdtar escribe pax por omision, y eso ensucia el
  // desempacado en la Pi con archivos PaxHeader.
  execFileSync('tar', ['--format=ustar', '-czf', 'dist/space-eye-pi-agent.tar.gz', ...CONTENIDO], {
    cwd: RAIZ,
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  const bytes = fs.statSync(PAQUETE).size;
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(PAQUETE)).digest('hex');
  console.log(`    ${(bytes / 1048576).toFixed(1)} MB`);

  paso(2, 'Escribiendo el manifiesto...');
  fs.writeFileSync(META, JSON.stringify({
    version: v,
    sha256,
    bytes,
    publicado: new Date().toISOString(),
  }, null, 2) + '\n');

  console.log(`\nLISTO`);
  console.log(`  ${PAQUETE}`);
  console.log(`  ${META}`);
  console.log(`\nPublicar: copiar los DOS a frontend/public/ del servidor.`);
  console.log(`El manifiesto va AL FINAL: mientras apunte a un paquete que no esta,`);
  console.log(`la huella no casa y los equipos rechazan la actualizacion (sin romperse).`);
})();

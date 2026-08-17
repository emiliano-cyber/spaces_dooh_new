// pc-agent/build.js
// Genera UN ejecutable de Windows con todo dentro: el agente, sus dependencias y
// el propio Node. En el sitio solo se copia ese archivo y se hace doble clic.
//
// Usa SEA (Single Executable Applications), lo nativo de Node 20+. Se descarto
// pkg porque en esta maquina no encuentra binarios precompilados e intenta
// compilar Node desde cero, lo que exige Visual Studio.
//
// Se llama a esbuild y postject por su API, no por linea de comandos: npx no
// resuelve sus binarios de forma fiable en Windows.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = __dirname;
const DIST = path.join(RAIZ, 'dist');
const BUNDLE = path.join(DIST, 'bundle.js');
const BLOB = path.join(DIST, 'sea.blob');
const SALIDA = path.join(DIST, 'SpaceEyeAgente.exe');
const CONFIG_SEA = path.join(DIST, 'sea-config.json');
const FFMPEG_VENDOR = path.join(RAIZ, 'vendor', 'ffmpeg.exe');
const FFMPEG_DIST = path.join(DIST, 'ffmpeg.exe');

const paso = (n, t) => console.log(`\n[${n}] ${t}`);

(async () => {
  fs.mkdirSync(DIST, { recursive: true });

  paso(1, 'Empaquetando el codigo y sus dependencias en un solo archivo...');
  require('esbuild').buildSync({
    entryPoints: [path.join(RAIZ, 'src', 'index.js')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: BUNDLE,
    // socket.io-client las carga solo si existen; son aceleradores opcionales.
    external: ['bufferutil', 'utf-8-validate'],
    logLevel: 'warning',
  });
  console.log(`    ${(fs.statSync(BUNDLE).size / 1024).toFixed(0)} KB`);

  paso(2, 'Preparando la carga para el ejecutable...');
  fs.writeFileSync(CONFIG_SEA, JSON.stringify({
    main: BUNDLE,
    output: BLOB,
    disableExperimentalSEAWarning: true,
  }, null, 2));
  execFileSync(process.execPath, ['--experimental-sea-config', CONFIG_SEA], { stdio: 'inherit' });

  paso(3, 'Copiando el motor de Node como base del ejecutable...');
  fs.copyFileSync(process.execPath, SALIDA);

  paso(4, 'Inyectando el agente dentro del ejecutable...');
  await require('postject').inject(SALIDA, 'NODE_SEA_BLOB', fs.readFileSync(BLOB), {
    sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  });

  // La vista en vivo necesita ffmpeg, que no viene con Windows y no cabe en el
  // repo (110 MB). Se copia aqui para que dist/ sea exactamente lo que se
  // lleva al sitio y nadie tenga que acordarse de bajarlo aparte.
  paso(5, 'Agregando ffmpeg (vista en vivo)...');
  if (fs.existsSync(FFMPEG_VENDOR)) {
    fs.copyFileSync(FFMPEG_VENDOR, FFMPEG_DIST);
    console.log(`    ${(fs.statSync(FFMPEG_DIST).size / 1048576).toFixed(0)} MB`);
  } else {
    console.log('    FALTA. Sin el, el sitio tendra fotos pero NO vista en vivo.');
    console.log('    Consiguelo con:  npm run bajar-ffmpeg');
  }

  const mb = (fs.statSync(SALIDA).size / 1048576).toFixed(0);
  console.log(`\nLISTO: ${SALIDA} (${mb} MB)`);
  console.log(fs.existsSync(FFMPEG_DIST)
    ? 'Lleva al sitio los DOS archivos de dist/: SpaceEyeAgente.exe y ffmpeg.exe.'
    : 'Ese archivo es todo lo que hay que llevar al sitio (sin vista en vivo).');
})().catch((e) => {
  console.error('\nFallo la compilacion:', e.message);
  process.exit(1);
});

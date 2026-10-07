// pc-agent/bajar-ffmpeg.js
// Baja el ffmpeg.exe que necesita la VISTA EN VIVO y lo deja en vendor/.
//
// Por que no esta en el repo: pesa 110 MB. Versionarlo engorda el
// historial de git para siempre y no se puede deshacer. Por que no se baja en el
// sitio: la PC del sitio suele tener una conexion mala y a quien va no le toca
// pelearse con eso; el archivo se prepara aqui y se lleva junto al agente.
//
// Se usa la build de BtbN en su variante **win64-lgpl**:
//   - estatica: un solo .exe, sin DLLs sueltas que copiar;
//   - LGPL en vez de GPL: se redistribuye junto a un programa propietario.
// Trae de sobra lo que hace falta (demuxer y muxer RTSP); no se codifica nada,
// el video de la camara se reenvia tal cual con -c copy.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const URL = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-lgpl.zip';
const VENDOR = path.join(__dirname, 'vendor');
const DESTINO = path.join(VENDOR, 'ffmpeg.exe');

const mb = (n) => (n / 1048576).toFixed(1);

async function bajar(url, aDonde) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`el servidor respondio HTTP ${res.status}`);

  const total = Number(res.headers.get('content-length')) || 0;
  const trozos = [];
  let leido = 0;
  let ultimoAviso = 0;

  for await (const trozo of res.body) {
    trozos.push(trozo);
    leido += trozo.length;
    // La descarga es lenta en conexiones de oficina: sin señales de vida
    // parece colgada y alguien la corta a los dos minutos.
    if (leido - ultimoAviso > 5 * 1048576) {
      ultimoAviso = leido;
      console.log(`    ${mb(leido)} MB${total ? ` de ${mb(total)} MB` : ''}...`);
    }
  }

  fs.writeFileSync(aDonde, Buffer.concat(trozos));
  return leido;
}

(async () => {
  if (fs.existsSync(DESTINO)) {
    console.log(`Ya esta: ${DESTINO} (${mb(fs.statSync(DESTINO).size)} MB)`);
    console.log('Borralo si quieres volver a bajarlo.');
    return;
  }

  fs.mkdirSync(VENDOR, { recursive: true });
  const zip = path.join(os.tmpdir(), `ffmpeg-spaceeye-${process.pid}.zip`);

  console.log('\n[1] Descargando ffmpeg (unos 140 MB, puede tardar)...');
  console.log(`    ${URL}`);
  const bytes = await bajar(URL, zip);
  console.log(`    ${mb(bytes)} MB descargados.`);

  try {
    console.log('\n[2] Extrayendo ffmpeg.exe...');
    // Expand-Archive viene con Windows; no hace falta ninguna herramienta extra.
    const carpeta = path.join(os.tmpdir(), `ffmpeg-spaceeye-${process.pid}`);
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${carpeta}' -Force`,
    ], { stdio: 'inherit' });

    // El zip trae una carpeta con el nombre de la version: se busca el binario.
    const encontrar = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { const r = encontrar(p); if (r) return r; }
        else if (e.name.toLowerCase() === 'ffmpeg.exe') return p;
      }
      return null;
    };

    const origen = encontrar(carpeta);
    if (!origen) throw new Error('el zip no traia ffmpeg.exe');
    fs.copyFileSync(origen, DESTINO);
    fs.rmSync(carpeta, { recursive: true, force: true });
  } finally {
    try { fs.unlinkSync(zip); } catch { /* da igual */ }
  }

  console.log(`\nLISTO: ${DESTINO} (${mb(fs.statSync(DESTINO).size)} MB)`);
  console.log('"npm run build" lo copiara a dist/ junto al agente.');
})().catch((e) => {
  console.error(`\nNo pude preparar ffmpeg: ${e.message}`);
  console.error('Alternativa a mano: baja el paquete win64-lgpl de');
  console.error('https://github.com/BtbN/FFmpeg-Builds/releases y copia su');
  console.error(`bin/ffmpeg.exe a ${DESTINO}`);
  process.exit(1);
});

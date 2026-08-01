// pi-agent/src/camara.js
// Captura una foto JPEG en la Raspberry. Hay tres formas y se elige la primera
// disponible, para poder avanzar sin esperar material:
//
//   libcamera -> camara oficial (Module 3) por el puerto MIPI. Es el destino.
//   usb       -> cualquier webcam USB. Sirve mientras no llega el cable
//                adaptador 22<->15 pines que la Module 3 necesita en la Pi 5.
//   prueba    -> imagen generada. Permite demostrar el circuito completo
//                (comando -> foto -> galeria -> verificacion) sin ninguna camara.
//
// El modo se puede fijar en config.json ("camara": { "modo": "usb" }); por
// omision se detecta solo.
const fs = require('fs');
const { spawn } = require('child_process');

const ANCHO = 1920;
const ALTO = 1080;

// spawn en vez de execFile: la foto es binaria y puede pesar varios MB, mas de
// lo que aguanta el buffer por omision de execFile.
function ejecutar(cmd, args, { entradaVacia = true } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    const salida = [];
    const errores = [];
    p.stdout.on('data', (d) => salida.push(d));
    p.stderr.on('data', (d) => errores.push(d));
    p.on('error', (e) => reject(new Error(`${cmd}: ${e.message}`)));
    p.on('close', (codigo) => {
      const buf = Buffer.concat(salida);
      if (codigo !== 0) {
        const msg = Buffer.concat(errores).toString().trim().split('\n').slice(-3).join(' ');
        return reject(new Error(`${cmd} termino con codigo ${codigo}: ${msg || 'sin detalle'}`));
      }
      if (entradaVacia && buf.length === 0) {
        return reject(new Error(`${cmd} no devolvio ninguna imagen`));
      }
      resolve(buf);
    });
    if (p.stdin) p.stdin.end();
  });
}

async function existe(cmd) {
  try {
    await ejecutar('sh', ['-c', `command -v ${cmd}`], { entradaVacia: false });
    return true;
  } catch {
    return false;
  }
}

// En Bookworm los binarios se llaman rpicam-*; en Bullseye eran libcamera-*.
async function binarioLibcamera() {
  for (const c of ['rpicam-still', 'libcamera-still']) {
    if (await existe(c)) return c;
  }
  return null;
}

async function hayCamaraMipi() {
  const bin = await binarioLibcamera();
  if (!bin) return null;
  try {
    const salida = await ejecutar('sh', ['-c', `${bin} --list-cameras 2>&1`], { entradaVacia: false });
    const txt = salida.toString();
    // Sin camara conectada imprime "No cameras available!".
    if (/no cameras available/i.test(txt)) return null;
    return bin;
  } catch {
    return null;
  }
}

async function dispositivoUsb(preferido) {
  const candidatos = preferido ? [preferido] : [];
  try {
    for (const f of fs.readdirSync('/dev')) {
      if (/^video\d+$/.test(f)) candidatos.push(`/dev/${f}`);
    }
  } catch { /* sin /dev/video* */ }
  return candidatos.find((d) => fs.existsSync(d)) || null;
}

class Camara {
  constructor(cfg = {}) {
    this.cfg = cfg;
    this.ancho = cfg.ancho || ANCHO;
    this.alto = cfg.alto || ALTO;
    this._modo = null;   // resuelto en detectar()
    this._detalle = '';
  }

  async detectar() {
    if (this._modo) return this._modo;
    const forzado = this.cfg.modo && this.cfg.modo !== 'auto' ? this.cfg.modo : null;

    if (!forzado || forzado === 'libcamera') {
      const bin = await hayCamaraMipi();
      if (bin) {
        this._bin = bin;
        this._detalle = `camara oficial via ${bin}`;
        return (this._modo = 'libcamera');
      }
      if (forzado) throw new Error('modo "libcamera" forzado pero no hay camara MIPI detectada');
    }

    if (!forzado || forzado === 'usb') {
      const dev = await dispositivoUsb(this.cfg.dispositivo);
      if (dev) {
        if (await existe('fswebcam')) { this._usbBin = 'fswebcam'; }
        else if (await existe('ffmpeg')) { this._usbBin = 'ffmpeg'; }
        else if (forzado) throw new Error('hay webcam pero falta fswebcam o ffmpeg (sudo apt install fswebcam)');
        if (this._usbBin) {
          this._dev = dev;
          this._detalle = `webcam USB ${dev} via ${this._usbBin}`;
          return (this._modo = 'usb');
        }
      }
      if (forzado) throw new Error('modo "usb" forzado pero no encuentro /dev/video*');
    }

    for (const c of ['convert', 'magick']) {
      if (await existe(c)) {
        this._imBin = c;
        this._detalle = 'IMAGEN DE PRUEBA (no hay camara conectada)';
        return (this._modo = 'prueba');
      }
    }

    throw new Error(
      'no hay forma de tomar una foto: sin camara MIPI, sin webcam USB y sin ImageMagick ' +
      '(sudo apt install -y imagemagick) para generar la imagen de prueba'
    );
  }

  async describir() {
    await this.detectar();
    return this._detalle;
  }

  esPrueba() {
    return this._modo === 'prueba';
  }

  async tomarFoto() {
    const modo = await this.detectar();

    if (modo === 'libcamera') {
      // -n sin vista previa, -t deja converger exposicion y balance de blancos.
      const args = [
        '-n', '-t', String(this.cfg.espera_ms || 1500),
        '--width', String(this.ancho), '--height', String(this.alto),
        '-q', String(this.cfg.calidad || 90),
      ];

      // La Module 3 tiene autofoco, pero NO enfoca por su cuenta al capturar:
      // sin pedirselo la foto sale borrosa. Dos formas:
      //   auto   -> hace una pasada de enfoque antes de cada disparo.
      //   manual -> enfoque fijo en dioptrias (1/metros; 0 = infinito). Es lo
      //             que conviene en un espectacular: la distancia no cambia y
      //             se evita que el autofoco se despiste de noche o con lluvia.
      if (this.cfg.enfoque === 'manual') {
        args.push('--autofocus-mode', 'manual',
          '--lens-position', String(this.cfg.lente_dioptrias ?? 0));
      } else {
        args.push('--autofocus-mode', 'auto', '--autofocus-on-capture');
      }

      args.push('-o', '-');
      return ejecutar(this._bin, args);
    }

    if (modo === 'usb') {
      if (this._usbBin === 'fswebcam') {
        return ejecutar('fswebcam', [
          '-d', this._dev, '-r', `${this.ancho}x${this.alto}`,
          '--no-banner', '-q', '--jpeg', String(this.cfg.calidad || 90), '-',
        ]);
      }
      return ejecutar('ffmpeg', [
        '-hide_banner', '-loglevel', 'error',
        '-f', 'v4l2', '-video_size', `${this.ancho}x${this.alto}`,
        '-i', this._dev, '-frames:v', '1', '-f', 'image2', '-c:v', 'mjpeg', 'pipe:1',
      ]);
    }

    // Imagen de prueba. Sin texto a proposito: el dashboard ya dibuja encima la
    // marca de informacion (nombre del equipo, fecha y hora), asi que no hace
    // falta ninguna tipografia instalada y la foto se ve igual que las reales.
    const args = [
      '-size', `${this.ancho}x${this.alto}`,
      'gradient:#0a2a5e-#0a66ff',
      '-quality', String(this.cfg.calidad || 90),
      'jpg:-',
    ];
    return ejecutar(this._imBin, this._imBin === 'magick' ? args : args);
  }
}

module.exports = { Camara };

// pi-agent/src/transmision.js
// Vista en vivo. La Pi 5 no trae codificador de video por hardware y no tiene
// GStreamer, asi que NO hace WebRTC punto a punto como los telefonos: codifica
// H.264 por software y empuja el video al servidor de medios, de donde el
// dashboard lo consume.
//
//   rpicam-vid (captura + codifica)  ->  ffmpeg (solo reempaqueta a RTSP)  ->  servidor
//
// ffmpeg NO recodifica (-c copy): solo mete el H.264 en RTSP.
//
// A donde publicar lo decide el servidor y llega en el comando START_STREAM
// (ruta al azar y de un solo uso), asi el equipo no guarda ninguna credencial.
const { spawn } = require('child_process');

// Red de seguridad propia. El dashboard corta a los 3 minutos y el backend tiene
// su propio vigilante, pero si ambos fallan el equipo no puede quedarse
// transmitiendo para siempre: en LTE eso se come los datos del sitio.
const DURACION_MAX_MS = 4 * 60 * 1000;

class Transmision {
  constructor(log, cfg = {}) {
    this.log = log;
    this.cfg = cfg;
    this.camara = null;
    this.ffmpeg = null;
    this.temporizador = null;
    this.ultimoError = '';
  }

  activa() {
    return !!(this.camara || this.ffmpeg);
  }

  iniciar(publishUrl, opts = {}) {
    if (!publishUrl) throw new Error('el servidor no indico a donde publicar');
    this.detener('reemplazada');

    const ancho = Number(opts.ancho || this.cfg.ancho || 1280);
    const alto = Number(opts.alto || this.cfg.alto || 720);
    const fps = Number(opts.fps || this.cfg.fps || 15);

    // --intra = 1 fotograma clave por segundo: el navegador empieza a ver casi
    // de inmediato en vez de esperar al siguiente clave.
    // --libav-format es obligatorio al escribir a la salida estandar: sin el,
    // rpicam-vid no sabe con que formato envolver el video y aborta.
    this.camara = spawn('rpicam-vid', [
      '-t', '0', '-n',
      '--width', String(ancho), '--height', String(alto),
      '--framerate', String(fps), '--intra', String(fps),
      '--codec', 'h264', '--libav-format', 'h264', '--inline',
      '-o', '-',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    this.ffmpeg = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'warning',
      '-fflags', 'nobuffer',
      // Sin esto el H.264 crudo llega sin marcas de tiempo y el video se ve a
      // tirones en el navegador.
      '-use_wallclock_as_timestamps', '1',
      // Por omision ffmpeg analiza 5 MB / 5 s del video antes de conectar con el
      // servidor: eran varios segundos de espera con la pantalla en blanco. Como
      // el formato ya se le dice (-f h264) y hay un fotograma clave por segundo,
      // con analizar mucho menos le sobra.
      '-analyzeduration', '1000000', '-probesize', '200000',
      '-f', 'h264', '-i', '-',
      '-c', 'copy',
      '-f', 'rtsp', '-rtsp_transport', 'tcp', '-pkt_size', '1200',
      publishUrl,
    ], { stdio: ['pipe', 'ignore', 'pipe'] });

    // Sin shell de por medio: la contrasena viaja como argumento, no por una
    // linea de comandos que habria que entrecomillar.
    this.camara.stdout.pipe(this.ffmpeg.stdin);
    // Si ffmpeg muere primero, la tuberia da EPIPE: se ignora y se limpia abajo.
    this.camara.stdout.on('error', () => {});
    this.ffmpeg.stdin.on('error', () => {});

    const recordarError = (origen) => (d) => {
      const t = d.toString().trim();
      if (t) this.ultimoError = `${origen}: ${t.split('\n').slice(-1)[0]}`.slice(0, 300);
    };
    this.camara.stderr.on('data', recordarError('camara'));
    this.ffmpeg.stderr.on('data', recordarError('ffmpeg'));

    const alMorir = (quien) => (codigo) => {
      if (!this.activa()) return;
      this.log(`transmision: ${quien} termino (codigo ${codigo})${this.ultimoError ? ' — ' + this.ultimoError : ''}`);
      this.detener('proceso terminado');
    };
    this.camara.on('exit', alMorir('la camara'));
    this.ffmpeg.on('exit', alMorir('ffmpeg'));
    this.camara.on('error', (e) => { this.ultimoError = `no pude ejecutar rpicam-vid: ${e.message}`; this.detener('error'); });
    this.ffmpeg.on('error', (e) => { this.ultimoError = `no pude ejecutar ffmpeg: ${e.message}`; this.detener('error'); });

    this.temporizador = setTimeout(() => {
      this.log('transmision: corte automatico por limite de tiempo');
      this.detener('limite de tiempo');
    }, DURACION_MAX_MS);

    this.log(`transmision iniciada (${ancho}x${alto} @ ${fps} fps)`);
    return { ancho, alto, fps };
  }

  detener(motivo) {
    if (this.temporizador) { clearTimeout(this.temporizador); this.temporizador = null; }
    const procesos = [this.camara, this.ffmpeg].filter(Boolean);
    this.camara = null;
    this.ffmpeg = null;
    for (const p of procesos) {
      try { p.kill('SIGTERM'); } catch { /* ya murio */ }
    }
    if (procesos.length && motivo) this.log(`transmision detenida (${motivo})`);
    return procesos.length > 0;
  }
}

module.exports = { Transmision };

// pc-agent/src/transmision.js
// Vista en vivo de una camara IP. La camara ya entrega H.264 por RTSP, asi que
// ffmpeg NO recodifica (-c copy): solo reenvia ese mismo video al servidor de
// medios, de donde el dashboard lo consume. El consumo de CPU de la PC del sitio
// es practicamente cero.
//
//   Camara IP --RTSP--> ffmpeg (reenvia) --RTSP--> servidor --WebRTC--> dashboard
//
// A donde publicar lo decide el servidor y llega en el comando START_STREAM
// (ruta al azar y de un solo uso).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const rutas = require('./rutas');

const DURACION_MAX_MS = 4 * 60 * 1000;

// ffmpeg no viene con Windows. Se busca junto al agente y luego en el PATH, para
// que baste con dejar ffmpeg.exe al lado del programa.
function buscarFfmpeg() {
  const vecino = path.join(rutas.BASE, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(vecino)) return vecino;
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
}

class Transmision {
  constructor(log, camaraCfg) {
    this.log = log;
    this.cam = camaraCfg;
    this.proc = null;
    this.temporizador = null;
    this.ultimoError = '';
  }

  activa() {
    return !!this.proc;
  }

  // rtsp://usuario:clave@host:554/Streaming/Channels/<canal>
  // canal 101 = calidad principal, 102 = secundaria (mucho menos ancho de banda,
  // que es lo que conviene para mirar en vivo si la camara la tiene habilitada).
  urlCamara() {
    const usuario = encodeURIComponent(this.cam.usuario);
    const clave = encodeURIComponent(this.cam.clave);
    const puerto = this.cam.puerto_rtsp || 554;
    const canal = this.cam.canal_stream || this.cam.canal || 101;
    return `rtsp://${usuario}:${clave}@${this.cam.host}:${puerto}/Streaming/Channels/${canal}`;
  }

  iniciar(publishUrl) {
    if (!publishUrl) throw new Error('el servidor no indico a donde publicar');
    this.detener('reemplazada');

    const ffmpeg = buscarFfmpeg();
    this.proc = spawn(ffmpeg, [
      '-hide_banner', '-loglevel', 'warning',
      // TCP en los dos extremos: es lo que atraviesa las redes de los sitios.
      '-rtsp_transport', 'tcp',
      '-i', this.urlCamara(),
      '-an',              // sin audio: no se usa y algunas camaras mandan formatos raros
      '-c', 'copy',       // sin recodificar
      '-f', 'rtsp', '-rtsp_transport', 'tcp', '-pkt_size', '1200',
      publishUrl,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    this.proc.stderr.on('data', (d) => {
      const t = d.toString().trim();
      if (t) this.ultimoError = t.split('\n').slice(-1)[0].slice(0, 300);
    });

    this.proc.on('error', (e) => {
      this.ultimoError = e.code === 'ENOENT'
        ? 'no encuentro ffmpeg: deja ffmpeg.exe junto al agente'
        : `no pude ejecutar ffmpeg: ${e.message}`;
      this.log(`transmision: ${this.ultimoError}`);
      this.proc = null;
    });

    this.proc.on('exit', (codigo) => {
      if (!this.proc) return;
      this.log(`transmision: ffmpeg termino (codigo ${codigo})${this.ultimoError ? ' — ' + this.ultimoError : ''}`);
      this.proc = null;
      this.detener();
    });

    this.temporizador = setTimeout(() => {
      this.log('transmision: corte automatico por limite de tiempo');
      this.detener('limite de tiempo');
    }, DURACION_MAX_MS);

    this.log(`transmision iniciada desde la camara ${this.cam.host}`);
    return { camara: this.cam.host };
  }

  detener(motivo) {
    if (this.temporizador) { clearTimeout(this.temporizador); this.temporizador = null; }
    const p = this.proc;
    this.proc = null;
    if (p) {
      try { p.kill(); } catch { /* ya murio */ }
      if (motivo) this.log(`transmision detenida (${motivo})`);
      return true;
    }
    return false;
  }
}

module.exports = { Transmision };

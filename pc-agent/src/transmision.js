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

// Cuanto se espera a que el video empiece a fluir antes de darlo por fallido.
//
// No basta con "ffmpeg sigue vivo": ante una IP inalcanzable se queda
// intentando conectar sin decir nada, y eso se reportaria como exito. Se usa
// -progress, que ffmpeg solo empieza a escribir cuando ya esta procesando
// cuadros: esa es la senal de que la camara entrego video de verdad.
const ESPERA_VIDEO_MS = 15000;

// Corta la espera de red de ffmpeg (microsegundos). Sin esto, una camara
// apagada o con la IP mal escrita deja el proceso colgado mas de dos minutos:
// nadie contesta al TCP y ffmpeg espera al sistema operativo.
//
// Tiene que ser -timeout, no -rw_timeout: el segundo solo cubre lecturas ya
// conectadas y no acota el intento de conexion, que es justo donde se cuelga.
const RED_TIMEOUT_US = '8000000';

// ffmpeg no viene con Windows. Se busca junto al agente y luego en el PATH, para
// que baste con dejar ffmpeg.exe al lado del programa.
const NOMBRE_FFMPEG = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

// La que se le pide a quien instala: al lado del ejecutable.
function rutaVecina() {
  return path.join(rutas.BASE, NOMBRE_FFMPEG);
}

// En el sitio va junto al .exe; corriendo desde el codigo fuente vive en
// vendor/, que es donde lo deja "npm run bajar-ffmpeg".
function candidatos() {
  return [rutaVecina(), path.join(rutas.BASE, 'vendor', NOMBRE_FFMPEG)];
}

function buscarFfmpeg() {
  return candidatos().find((p) => fs.existsSync(p)) || NOMBRE_FFMPEG;
}

// Para avisar en la instalacion, antes de que alguien se vaya del sitio.
function hayFfmpegVecino() {
  return candidatos().some((p) => fs.existsSync(p));
}

const FALTA_FFMPEG = 'no encuentro ffmpeg: deja ffmpeg.exe junto al agente';

// ffmpeg repite la URL completa en sus errores, y esa URL lleva la CLAVE de la
// camara. Ese texto viaja al dashboard y se guarda en la base de datos, asi que
// se tacha antes de soltarlo a ningun lado.
function sinCredenciales(texto) {
  return String(texto).replace(/(rtsp:\/\/)[^@\s/]*@/gi, '$1***@');
}

// Los errores de ffmpeg son para quien programa, no para quien esta en el sitio
// con la camara enfrente. Se traducen los cuatro que salen de verdad.
function explicar(texto) {
  const t = String(texto);
  if (/\b401\b|Unauthorized/i.test(t)) return 'la camara rechazo el usuario o la clave (401)';
  if (/\b404\b|Not Found/i.test(t)) return 'ese canal no existe en la camara (404): revisa canal_stream';
  if (/Connection refused/i.test(t)) return 'la camara rechazo la conexion: el RTSP (puerto 554) esta cerrado';
  if (/-138\b|timed? out/i.test(t)) return 'la camara no contesto: revisa la IP, que este encendida y en esta misma red';
  if (/No route to host|Network is unreachable/i.test(t)) return 'no hay ruta hasta la camara desde esta PC (estan en redes distintas)';
  return sinCredenciales(t);
}

class Transmision {
  constructor(log, camaraCfg) {
    this.log = log;
    this.cam = camaraCfg;
    this.proc = null;
    this.temporizador = null;
    this.ultimoError = '';
    this.canalBueno = 0; // el ultimo que si transmitio; se prueba primero
  }

  activa() {
    return !!this.proc;
  }

  // rtsp://usuario:clave@host:554/Streaming/Channels/<canal>
  // canal 101 = calidad principal, 102 = secundaria (mucho menos ancho de banda,
  // que es lo que conviene para mirar en vivo si la camara la tiene habilitada).
  urlCamara(canal) {
    const usuario = encodeURIComponent(this.cam.usuario);
    const clave = encodeURIComponent(this.cam.clave);
    const puerto = this.cam.puerto_rtsp || 554;
    return `rtsp://${usuario}:${clave}@${this.cam.host}:${puerto}/Streaming/Channels/${canal}`;
  }

  // Que canales intentar y en que orden. El sub-stream (102) gasta mucha menos
  // subida, pero NO todas las camaras lo traen habilitado: si no responde, se
  // cae al principal en vez de dejar al sitio sin vista en vivo. Las
  // instalaciones viejas no traen canal_stream en su config.json y siguen
  // yendo directo al canal de siempre.
  canales() {
    const lista = [];
    const add = (v) => {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0 && !lista.includes(n)) lista.push(n);
    };
    add(this.canalBueno);
    add(this.cam.canal_stream);
    add(this.cam.canal);
    add(101);
    return lista;
  }

  /**
   * Arranca la transmision. Resuelve cuando la camara ya entrego cuadros, y
   * RECHAZA con el motivo real si no lo consigue.
   *
   * Es asincrono a proposito: antes se respondia al dashboard "comando OK" en
   * cuanto se lanzaba el proceso, asi que un fallo tan basico como que faltara
   * ffmpeg.exe se veia en el navegador como 40 s de espera y un "el equipo no
   * comenzo a transmitir". El motivo solo quedaba en agente.log, dentro de la
   * PC del sitio.
   */
  async iniciar(publishUrl) {
    if (!publishUrl) throw new Error('el servidor no indico a donde publicar');
    this.detener('reemplazada');

    const ffmpeg = buscarFfmpeg();
    const intentados = this.canales();
    let ultimo = '';

    for (const canal of intentados) {
      try {
        const info = await this._intentar(ffmpeg, canal, publishUrl);
        this.canalBueno = canal;
        return info;
      } catch (e) {
        ultimo = e.message;
        // Si no existe el binario, probar otro canal no arregla nada.
        if (e.fatal) throw e;
        this.log(`transmision: el canal ${canal} no sirvio — ${e.message}`);
      }
    }

    throw new Error(
      intentados.length > 1
        ? `ningun canal de la camara transmitio (probe ${intentados.join(', ')}): ${ultimo}`
        : ultimo || 'no pude iniciar la transmision',
    );
  }

  _intentar(ffmpeg, canal, publishUrl) {
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpeg, [
        '-hide_banner', '-loglevel', 'warning',
        // TCP en los dos extremos: es lo que atraviesa las redes de los sitios.
        '-rtsp_transport', 'tcp',
        '-timeout', RED_TIMEOUT_US,
        '-i', this.urlCamara(canal),
        '-an',              // sin audio: no se usa y algunas camaras mandan formatos raros
        '-c', 'copy',       // sin recodificar
        '-f', 'rtsp', '-rtsp_transport', 'tcp', '-pkt_size', '1200',
        // Avisa por su salida estandar en cuanto empieza a mover cuadros: es la
        // confirmacion de que el video fluye, no solo de que el proceso arranco.
        '-progress', 'pipe:1', '-nostats',
        publishUrl,
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      this.proc = proc;
      let listo = false;
      let ventana = null;

      const fallar = (mensaje, fatal) => {
        this.ultimoError = mensaje;
        if (listo) return;
        listo = true;
        if (ventana) clearTimeout(ventana);
        const err = new Error(mensaje);
        err.fatal = Boolean(fatal);
        reject(err);
      };

      const lograr = () => {
        if (listo) return;
        listo = true;
        if (ventana) clearTimeout(ventana);
        this.temporizador = setTimeout(() => {
          this.log('transmision: corte automatico por limite de tiempo');
          this.detener('limite de tiempo');
        }, DURACION_MAX_MS);
        this.log(`transmision iniciada desde la camara ${this.cam.host} (canal ${canal})`);
        resolve({ camara: this.cam.host, canal });
      };

      // Hay que leer siempre esta salida aunque ya no interese: si nadie la
      // vacia, la tuberia se llena y ffmpeg se traba a medio reenvio.
      proc.stdout.on('data', (d) => {
        if (!listo && /frame=\s*\d+/.test(d.toString())) lograr();
      });

      proc.stderr.on('data', (d) => {
        const t = d.toString().trim();
        if (t) this.ultimoError = sinCredenciales(t.split('\n').slice(-1)[0]).slice(0, 300);
      });

      proc.on('error', (e) => {
        if (this.proc === proc) this.proc = null;
        const msg = e.code === 'ENOENT' ? FALTA_FFMPEG : `no pude ejecutar ffmpeg: ${e.message}`;
        this.log(`transmision: ${msg}`);
        fallar(msg, e.code === 'ENOENT');
      });

      proc.on('exit', (codigo) => {
        // Ya lo reemplazo o lo detuvo otra orden: ese final no es un fallo.
        if (this.proc !== proc) return;
        this.proc = null;
        this.log(`transmision: ffmpeg termino (codigo ${codigo})${this.ultimoError ? ' — ' + this.ultimoError : ''}`);
        if (listo) this.detener();
        else fallar(this.ultimoError ? explicar(this.ultimoError) : `ffmpeg termino de inmediato (codigo ${codigo})`);
      });

      ventana = setTimeout(() => {
        // Ni un cuadro en la ventana: se mata, o queda un ffmpeg colgado
        // intentando conectarse a una camara que no esta.
        if (this.proc === proc) this.proc = null;
        try { proc.kill(); } catch { /* ya murio */ }
        fallar(this.ultimoError
          ? explicar(this.ultimoError)
          : `la camara no entrego video en ${ESPERA_VIDEO_MS / 1000} s`);
      }, ESPERA_VIDEO_MS);
    });
  }

  /**
   * Prueba de sitio: reenvia a ningun lado y reporta que entrega cada canal.
   * Sirve para verificar la vista en vivo estando frente a la camara, sin
   * depender del dashboard ni de que la red del sitio alcance al servidor.
   */
  async probar(segundos = 6) {
    const ffmpeg = buscarFfmpeg();
    const salida = [];
    for (const canal of this.canales()) {
      const r = await this._probarCanal(ffmpeg, canal, segundos);
      salida.push(r);
      // Si no existe el binario, repetir con otro canal solo alarga la espera y
      // muestra el mismo error dos veces.
      if (r.error === FALTA_FFMPEG) break;
    }
    return salida;
  }

  _probarCanal(ffmpeg, canal, segundos) {
    return new Promise((resolve) => {
      const proc = spawn(ffmpeg, [
        '-hide_banner', '-loglevel', 'info',
        '-rtsp_transport', 'tcp',
        '-timeout', RED_TIMEOUT_US,
        '-i', this.urlCamara(canal),
        '-t', String(segundos),
        '-an', '-c', 'copy',
        '-f', 'null', '-',
      ], { stdio: ['ignore', 'ignore', 'pipe'] });

      let texto = '';
      proc.stderr.on('data', (d) => { texto += d.toString(); });

      proc.on('error', (e) => resolve({
        canal,
        ok: false,
        error: e.code === 'ENOENT' ? FALTA_FFMPEG : e.message,
      }));

      proc.on('exit', (codigo) => {
        const video = /Video:\s*([a-zA-Z0-9]+)[^\n]*?[, ](\d{2,5}x\d{2,5})/.exec(texto);
        const cuadros = [...texto.matchAll(/frame=\s*(\d+)/g)].pop();
        const tasa = /bitrate=\s*([\d.]+\s*\w+it\/s)/.exec([...texto.matchAll(/bitrate=[^\n]*/g)].pop()?.[0] || '');
        const fps = /,\s*([\d.]+)\s*fps/.exec(texto);
        const n = cuadros ? Number(cuadros[1]) : 0;

        if (codigo === 0 && n > 0) {
          resolve({
            canal, ok: true, cuadros: n,
            codec: video?.[1], resolucion: video?.[2],
            fps: fps ? Number(fps[1]) : undefined,
            tasa: tasa?.[1],
          });
        } else {
          // El motivo puede estar en cualquiera de las ultimas lineas: la final
          // suele ser el resumen ("Error opening input files"), y el detalle
          // util (401, 404, refused) viene justo antes.
          const lineas = texto.trim().split('\n').map((l) => l.trim()).filter(Boolean);
          const cola = lineas.slice(-4).join(' | ');
          resolve({
            canal,
            ok: false,
            error: cola ? explicar(cola) : `ffmpeg salio con codigo ${codigo}`,
          });
        }
      });
    });
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

module.exports = { Transmision, buscarFfmpeg, hayFfmpegVecino, rutaVecina, sinCredenciales, explicar };

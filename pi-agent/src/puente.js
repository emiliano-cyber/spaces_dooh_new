// pi-agent/src/puente.js
// La vigilancia de la pantalla corre en Python (vision/monitor.py, la misma del
// telefono portada con OpenCV). Este archivo es lo que la une al agente:
//
//   - el PUENTE: un servidor HTTP en 127.0.0.1 por el que Python pide tomas a
//     la camara y manda alertas, creativos y registros (contrato en
//     vision/PUENTE.md);
//   - el GUARDIAN: arranca monitor.py y lo vuelve a levantar si muere.
//
// POR QUE ASI Y NO PYTHON POR SU CUENTA
// -------------------------------------
// La camara es UNA: la foto pedida y la vista en vivo mandan sobre la
// vigilancia, y solo Node sabe cuando hay una en curso. La red tambien es suya:
// la llave del equipo, el reintento tras un 401 y la cola. Si Python abriera la
// camara o hablara con el servidor por su lado, habria dos duenos de cada cosa.
//
// Si a la Pi le falta python3-opencv la vigilancia no arranca, pero el agente
// sigue haciendo su trabajo (fotos, vivo, telemetria, actualizarse): una
// funcion opcional nunca deja al sitio mudo.
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { RECHAZADA } = require('./api');

const MAX_CUERPO = 25 * 1024 * 1024;     // una evidencia en base64 cabe holgada
const ESPERA_REARRANQUE_MS = 30 * 1000;
const ESPERA_SIN_PYTHON_MS = 60 * 60 * 1000;

class Puente {
  /**
   * @param {object} o
   * @param {import('./camara').Camara} o.camara
   * @param {import('./api').Api} o.api
   * @param {() => boolean} o.ocupada  hay una foto o una vista en vivo en curso
   * @param {(s: string) => void} o.log
   * @param {string} o.dirEstado  donde monitor.py guarda lo que aprende
   */
  constructor({ camara, api, ocupada, log, dirEstado }) {
    this.camara = camara;
    this.api = api;
    this.ocupada = ocupada;
    this.log = log;
    this.dirEstado = dirEstado;
    this.secreto = crypto.randomBytes(24).toString('hex');
    this.pendiente = null;
    this.tomando = null;      // promesa de la toma en curso: la foto pedida la espera
    this.hijo = null;
    this.detenido = false;
    // La huella de la configuracion de vigilancia que dio el servidor en el
    // ultimo reporte de estado: monitor.py la compara para saber si pedirla.
    this.version = null;
  }

  // ─── El resumen de la vuelta, pegado al reporte de estado ─────────────────
  // Misma regla que Monitor.devolver del telefono: los creativos se suman y de
  // salud vale la mas reciente.
  agregar(p) {
    const a = this.pendiente;
    if (!a) { this.pendiente = { ...p }; return; }
    if (p.creativos) {
      const unir = (x, y) => [...new Set([...(x || []), ...(y || [])])].slice(0, 60);
      a.creativos = a.creativos
        ? { vistas: unir(a.creativos.vistas, p.creativos.vistas), nuevas: unir(a.creativos.nuevas, p.creativos.nuevas) }
        : p.creativos;
    }
    if (p.salud) a.salud = p.salud;
  }

  tomarPendiente() {
    const p = this.pendiente;
    this.pendiente = null;
    return p;
  }

  devolver(p) { if (p) this.agregar(p); }

  /** La foto pedida espera a que termine la toma de la vigilancia en curso. */
  async esperarCamara() {
    if (this.tomando) await this.tomando.catch(() => {});
  }

  // ─── El servidor ──────────────────────────────────────────────────────────
  iniciar() {
    return new Promise((resolve) => {
      this.servidor = http.createServer((req, res) => {
        this._atender(req, res).catch((e) => {
          this.log(`puente: ${req.method} ${req.url} fallo: ${e.message}`);
          responder(res, 500, { error: e.message });
        });
      });
      this.servidor.listen(0, '127.0.0.1', () => {
        this.url = `http://127.0.0.1:${this.servidor.address().port}`;
        resolve(this.url);
      });
    });
  }

  async _atender(req, res) {
    // El puerto es local, pero cualquier proceso de la Pi podria tocarlo: sin
    // el secreto que solo conoce monitor.py, no se contesta nada.
    if (req.headers['x-puente'] !== this.secreto) return responder(res, 403, { error: 'puente' });
    const ruta = req.url.split('?')[0];

    if (req.method === 'GET' && ruta === '/ocupada') return responder(res, 200, { ocupada: this.ocupada() });

    if (req.method === 'POST' && ruta === '/camara/abrir') {
      await leerJson(req);
      // La Pi no tiene lentes ni zoom de camara: abrir es comprobar que hay una.
      try { await this.camara.detectar(); return responder(res, 200, { ok: true }); }
      catch { return responder(res, 200, { ok: false }); }
    }

    if (req.method === 'GET' && ruta === '/camara/tomar') {
      if (this.ocupada()) return responder(res, 503, { error: 'ocupada' });
      this.tomando = this.camara.tomarFoto({});
      try {
        const jpeg = await this.tomando;
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': jpeg.length });
        return res.end(jpeg);
      } catch (e) {
        return responder(res, 503, { error: e.message });
      } finally {
        this.tomando = null;
      }
    }

    if (req.method === 'POST' && ruta === '/camara/cerrar') { await leerJson(req); return responder(res, 200, { ok: true }); }

    if (req.method === 'GET' && ruta === '/version') return responder(res, 200, { version: this.version });

    if (req.method === 'GET' && ruta === '/monitoreo') {
      try { return responder(res, 200, await this.api.monitoreo()); }
      catch (e) { return responder(res, 502, { error: e.message }); }
    }

    if (req.method === 'POST' && ruta === '/falla') {
      const { campos, foto } = await leerJson(req);
      const id = await this.api.reportarFalla(campos, foto ? Buffer.from(foto, 'base64') : null);
      if (id === RECHAZADA) return responder(res, 200, { rechazada: true });
      if (id == null) return responder(res, 502, { error: 'sin_red' });
      return responder(res, 200, { id });
    }

    if (req.method === 'POST' && ruta === '/creativo') {
      const { foto, huella } = await leerJson(req);
      try {
        await this.api.subirFoto(Buffer.from(foto, 'base64'), {
          taken_at: new Date().toISOString(), source: 'creative_change', phash: huella,
        });
        return responder(res, 200, { ok: true });
      } catch (e) {
        this.log(`puente: no pude subir el creativo: ${e.message}`);
        return responder(res, 200, { ok: false });
      }
    }

    // Campanas de SPACE OS: la referencia para reconocerla y su prueba del dia.
    const campana = ruta.match(/^\/campana\/(\d{1,12})$/);
    if (req.method === 'GET' && campana) {
      try {
        const jpeg = await this.api.referenciaCampana(campana[1]);
        if (!jpeg) return responder(res, 404, { error: 'no_es_del_equipo' });
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': jpeg.length });
        return res.end(jpeg);
      } catch (e) {
        return responder(res, 502, { error: e.message });
      }
    }

    if (req.method === 'POST' && ruta === '/campana') {
      const { foto, campana_id } = await leerJson(req);
      try {
        await this.api.subirFoto(Buffer.from(foto, 'base64'), {
          taken_at: new Date().toISOString(), source: 'campana', campaign_id: Number(campana_id),
        });
        return responder(res, 200, { ok: true });
      } catch (e) {
        this.log(`puente: no pude subir la prueba de la campana ${campana_id}: ${e.message}`);
        return responder(res, 200, { ok: false });
      }
    }

    if (req.method === 'POST' && ruta === '/log') {
      const { nivel, etiqueta, texto } = await leerJson(req);
      // El servidor dice 'warning'; el puente acepta tambien 'warn' como el telefono.
      const n = nivel === 'warn' ? 'warning' : (nivel || 'info');
      this.api.log(n, etiqueta || 'monitor', String(texto || '').slice(0, 1000)).catch(() => {});
      this.log(`vigilancia: ${texto}`);
      return responder(res, 200, { ok: true });
    }

    if (req.method === 'POST' && ruta === '/resumen') {
      this.agregar(await leerJson(req));
      return responder(res, 200, { ok: true });
    }

    return responder(res, 404, { error: 'ruta' });
  }

  // ─── El guardian de monitor.py ────────────────────────────────────────────
  vigilar() {
    const script = path.join(__dirname, '..', 'vision', 'monitor.py');
    const lanzar = () => {
      if (this.detenido) return;
      const hijo = spawn('python3', [script, '--puente', this.url, '--dir', this.dirEstado], {
        env: { ...process.env, PUENTE_SECRETO: this.secreto, PYTHONUNBUFFERED: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.hijo = hijo;
      const t0 = Date.now();
      const linea = (b) => String(b).split('\n').filter(Boolean).forEach((l) => this.log(`[vision] ${l}`));
      hijo.stdout.on('data', linea);
      hijo.stderr.on('data', linea);
      hijo.on('error', (e) => {
        // Sin python3 en la Pi: se avisa UNA vez por hora, no en cada intento.
        this.log(`la vigilancia no arranca (${e.message}); reintento en 1 h`);
        this.api.log('error', 'monitor', `No se pudo arrancar la vigilancia de la pantalla: ${e.message}`).catch(() => {});
        setTimeout(lanzar, ESPERA_SIN_PYTHON_MS).unref();
      });
      hijo.on('exit', (code, senal) => {
        this.hijo = null;
        if (this.detenido || code === null && senal === 'SIGTERM') return;
        // Salir rapido con 3 es "falta OpenCV": no tiene caso insistir cada 30 s.
        const espera = code === 3 ? ESPERA_SIN_PYTHON_MS : ESPERA_REARRANQUE_MS;
        if (code === 3) {
          this.api.log('error', 'monitor', 'Falta python3-opencv en el equipo: la vigilancia de la pantalla no puede correr').catch(() => {});
        } else {
          this.log(`la vigilancia termino (codigo ${code}, ${Math.round((Date.now() - t0) / 1000)} s); la levanto de nuevo`);
        }
        setTimeout(lanzar, espera).unref();
      });
    };
    lanzar();
  }

  detener() {
    this.detenido = true;
    if (this.hijo) this.hijo.kill('SIGTERM');
    if (this.servidor) this.servidor.close();
  }
}

function responder(res, estado, cuerpo) {
  const txt = JSON.stringify(cuerpo);
  res.writeHead(estado, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(txt) });
  res.end(txt);
}

function leerJson(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let total = 0;
    req.on('data', (b) => {
      total += b.length;
      if (total > MAX_CUERPO) { reject(new Error('cuerpo demasiado grande')); req.destroy(); return; }
      partes.push(b);
    });
    req.on('end', () => {
      const txt = Buffer.concat(partes).toString('utf8');
      try { resolve(txt ? JSON.parse(txt) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = { Puente };

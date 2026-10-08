// pc-agent/src/camera.js
// Cliente de la camara IP (Hikvision / HiLook) por ISAPI.
//
// La camara vive en la red local del sitio, detras del NAT: el servidor no puede
// entrar a buscarla. Por eso el agente corre en la PC del sitio, pide la foto por
// la red local y la sube el mismo camino que usan los telefonos.
//
// Hikvision exige autenticacion DIGEST (Basic suele venir deshabilitado), asi que
// se implementa aqui en lugar de arrastrar una dependencia.
const crypto = require('crypto');

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

function parseDesafio(header) {
  const partes = {};
  const re = /(\w+)=("([^"]*)"|([^,]*))/g;
  let m;
  while ((m = re.exec(header)) !== null) partes[m[1]] = m[3] !== undefined ? m[3] : m[4];
  return partes;
}

function cabeceraDigest({ usuario, clave, metodo, uri, desafio, nc, cnonce }) {
  const { realm, nonce, qop, opaque, algorithm } = desafio;
  const ha1 = md5(`${usuario}:${realm}:${clave}`);
  const ha2 = md5(`${metodo}:${uri}`);
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);

  let h = `Digest username="${usuario}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  if (qop) h += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  if (opaque) h += `, opaque="${opaque}"`;
  if (algorithm) h += `, algorithm=${algorithm}`;
  return h;
}

// GET con digest: primera peticion sin credenciales para obtener el desafio 401.
async function getDigest(url, usuario, clave, timeoutMs) {
  const u = new URL(url);
  const uri = u.pathname + u.search;

  const ctl1 = AbortSignal.timeout(timeoutMs);
  const primera = await fetch(url, { signal: ctl1 });
  if (primera.status !== 401) return primera; // sin auth o ya autorizado

  const wa = primera.headers.get('www-authenticate') || '';
  if (!/digest/i.test(wa)) {
    // Algunas camaras aceptan Basic si se habilito en su configuracion.
    return fetch(url, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${usuario}:${clave}`).toString('base64') },
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  const desafio = parseDesafio(wa);
  const auth = cabeceraDigest({
    usuario, clave, metodo: 'GET', uri, desafio,
    nc: '00000001', cnonce: crypto.randomBytes(8).toString('hex'),
  });
  return fetch(url, { headers: { Authorization: auth }, signal: AbortSignal.timeout(timeoutMs) });
}

class Camara {
  constructor(cfg) {
    this.host = cfg.host;
    this.puerto = cfg.puerto || 80;
    this.usuario = cfg.usuario;
    this.clave = cfg.clave;
    this.canal = cfg.canal || 101; // 101 = canal 1, stream principal
    this.timeoutMs = cfg.timeout_ms || 15000;
  }

  get base() {
    return `http://${this.host}:${this.puerto}`;
  }

  // Foto fija JPEG. Es un solo GET: no hay que decodificar video.
  async tomarFoto() {
    const url = `${this.base}/ISAPI/Streaming/channels/${this.canal}/picture`;
    const res = await getDigest(url, this.usuario, this.clave, this.timeoutMs);
    if (!res.ok) {
      throw new Error(`la camara respondio HTTP ${res.status} (${res.statusText || 'sin detalle'})`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    // Una respuesta valida es JPEG (empieza con FF D8). Si la camara devuelve XML
    // de error con codigo 200, esto lo detecta en vez de subir basura.
    if (buf.length < 1000 || buf[0] !== 0xff || buf[1] !== 0xd8) {
      throw new Error(`la camara no devolvio una imagen JPEG (${buf.length} bytes)`);
    }
    return buf;
  }

  // Datos del equipo, para mostrar modelo/firmware en el dashboard.
  async infoDispositivo() {
    try {
      const res = await getDigest(`${this.base}/ISAPI/System/deviceInfo`, this.usuario, this.clave, this.timeoutMs);
      if (!res.ok) return null;
      const xml = await res.text();
      const campo = (t) => (new RegExp(`<${t}>([^<]*)</${t}>`).exec(xml) || [])[1] || null;
      return {
        modelo: campo('model'),
        firmware: campo('firmwareVersion'),
        serie: campo('serialNumber'),
        nombre: campo('deviceName'),
      };
    } catch {
      return null;
    }
  }

  async estaViva() {
    try {
      const res = await getDigest(`${this.base}/ISAPI/System/status`, this.usuario, this.clave, 8000);
      return res.ok;
    } catch {
      return false;
    }
  }
}

module.exports = { Camara };

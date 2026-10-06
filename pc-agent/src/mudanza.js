// pc-agent/src/mudanza.js  (el mismo de pi-agent: mantener los dos iguales)
// Mudar el equipo a otro servidor de Space Eye, a distancia.
//
// POR QUE
// -------
// Los equipos de campo hablan con el Space Eye central (:4000). Cada empresa
// tiene ahora el suyo (eyes.<dominio>). Pasar un equipo de uno a otro no puede
// exigir ir al sitio: llega como orden, igual que una foto.
//
// La orden viaja como UPDATE_CONFIG con { mudanza: { servidor, codigo? } }: es
// un tipo de orden que el servidor central YA acepta con cualquier contenido,
// asi la mudanza sale de el sin tocarlo.
//
// COMO, SIN QUEDARSE MUDO
// -----------------------
//   1. Antes de moverse, se da de alta en el servidor nuevo con su MISMA
//      identidad (device_uid). Si el equipo ya existe alla (la base se copio),
//      entra sin codigo; si no, necesita un codigo de vinculacion de alla. Si
//      no puede, NO se mueve: contesta el motivo al servidor de siempre.
//   2. Si puede, contesta que se muda, apunta config.json al nuevo (guardando
//      el anterior) y se reinicia.
//   3. En el nuevo, el primer reporte de estado que entra confirma la mudanza.
//   4. Si en `mudanza_espera_min` (30 por omision) no logra reportar alla, se
//      REGRESA SOLO al anterior y lo avisa ahi. Un servidor nuevo mal
//      configurado no deja a un sitio sin cobertura.
const fs = require('fs');
const rutas = require('./rutas');

const ESPERA_MIN = 30;

/** "https://eyes.x.mx/" -> "https://eyes.x.mx"; null si no es http(s). */
function normalizarServidor(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

/** Mezcla cambios en config.json sin perder lo demas; `undefined` borra. */
function escribirConfig(cambios, archivo = rutas.config) {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch { /* nuevo */ }
  for (const [k, v] of Object.entries(cambios)) {
    if (v === undefined) delete c[k];
    else c[k] = v;
  }
  const tmp = `${archivo}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(c, null, 2) + '\n');
  fs.renameSync(tmp, archivo); // nunca un config.json a medias tras un corte
  return c;
}

/**
 * Paso 1 y 2. `Api` es la clase del cliente (inyectada para las pruebas).
 * Devuelve { servidor, device_id } o lanza un Error con un motivo legible.
 */
async function preparar({ payload, cfg, datosRegistro, Api }) {
  const destino = normalizarServidor(payload && payload.servidor);
  if (!destino) throw new Error('la direccion del servidor nuevo no es valida');
  const actual = normalizarServidor(cfg.server_url);
  if (destino === actual) throw new Error('el equipo ya esta en ese servidor');

  const nueva = new Api(destino);
  let reg;
  try {
    reg = await nueva.registrar({
      ...datosRegistro,
      provision_token: undefined, // el testigo es del servidor viejo
      codigo_vinculacion: payload.codigo ? String(payload.codigo) : undefined,
    });
  } catch (e) {
    const cuerpo = e && e.cuerpo ? String(e.cuerpo) : '';
    if (/vinculacion_requerida/.test(cuerpo)) {
      throw new Error('el servidor nuevo no conoce este equipo y la orden no trae codigo de vinculacion');
    }
    if (/codigo_invalido/.test(cuerpo)) throw new Error('el servidor nuevo rechazo el codigo (vencido, usado o cancelado)');
    throw new Error(`no pude hablar con el servidor nuevo (${e.message})`);
  }

  escribirConfig({
    server_url: destino,
    codigo_vinculacion: undefined, // ya se gasto, o no hacia falta
    mudanza: {
      anterior: actual,
      testigo_anterior: cfg.testigo_de_alta || undefined,
      desde: new Date().toISOString(),
      // El plazo puede venir en la orden (la misma regla que el telefono).
      espera_min: Number(payload.mudanza_espera_min) > 0 ? Number(payload.mudanza_espera_min) : undefined,
    },
  });
  return { servidor: destino, device_id: reg.device_id };
}

function pendiente(cfg) {
  return cfg && cfg.mudanza && cfg.mudanza.anterior ? cfg.mudanza : null;
}

function vencida(cfg, ahora = Date.now()) {
  const m = pendiente(cfg);
  if (!m) return false;
  const espera = (Number(m.espera_min) || Number(cfg.mudanza_espera_min) || ESPERA_MIN) * 60 * 1000;
  return ahora - new Date(m.desde).getTime() > espera;
}

/** Paso 3: ya reporto en el servidor nuevo. */
function confirmar(cfg) {
  const m = pendiente(cfg);
  if (!m) return null;
  escribirConfig({ mudanza: undefined });
  delete cfg.mudanza;
  return m;
}

/** Paso 4: volver al servidor de antes y dejar dicho por que. */
function revertir(cfg) {
  const m = pendiente(cfg);
  if (!m) return null;
  escribirConfig({
    server_url: m.anterior,
    testigo_de_alta: m.testigo_anterior || undefined,
    mudanza: undefined,
    mudanza_fallida: { a: cfg.server_url, desde: m.desde, regreso: new Date().toISOString() },
  });
  return m;
}

module.exports = { ESPERA_MIN, normalizarServidor, escribirConfig, preparar, pendiente, vencida, confirmar, revertir };

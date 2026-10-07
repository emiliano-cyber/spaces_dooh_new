// Pruebas de la mudanza de servidor (src/mudanza.js).   node --test pruebas
//
// Lo que no puede fallar: que un equipo NO se mueva si el servidor nuevo no lo
// acepta, que al moverse guarde de donde venia, y que si el nuevo no responde
// en el plazo regrese solo al anterior.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mudanza-'));
process.env.SPACEEYE_CONFIG = path.join(dir, 'config.json');
const mudanza = require('../src/mudanza');

const leer = () => JSON.parse(fs.readFileSync(process.env.SPACEEYE_CONFIG, 'utf8'));
function apiFalsa(respuesta) {
  return class {
    constructor(base) { this.base = base; }
    async registrar(datos) {
      this.constructor.ultima = { base: this.base, datos };
      if (respuesta instanceof Error) throw respuesta;
      return respuesta;
    }
  };
}
const error = (status, cuerpo) => Object.assign(new Error(`HTTP ${status}`), { status, cuerpo });
const datosRegistro = { device_uid: 'pi-abc', app_version: 'pi-agent 0.7.2', provision_token: 'se_viejo' };

function configInicial() {
  fs.writeFileSync(process.env.SPACEEYE_CONFIG, JSON.stringify({ server_url: 'http://159.203.188.58:4000', camara: { modo: 'libcamera' }, testigo_de_alta: 'se_viejo' }));
  return { ...leer(), testigo_de_alta: 'se_viejo' };
}

test('direcciones: solo http(s), sin barra final', () => {
  assert.strictEqual(mudanza.normalizarServidor('https://eyes.g500.mx/'), 'https://eyes.g500.mx');
  assert.strictEqual(mudanza.normalizarServidor('ftp://x'), null);
  assert.strictEqual(mudanza.normalizarServidor('no es url'), null);
});

test('se muda: se da de alta alla con su misma identidad y guarda de donde venia', async () => {
  const cfg = configInicial();
  const Api = apiFalsa({ device_id: 77, token: 't' });
  const r = await mudanza.preparar({ payload: { servidor: 'https://eyes.g500.mx/' }, cfg, datosRegistro, Api });
  assert.deepStrictEqual(r, { servidor: 'https://eyes.g500.mx', device_id: 77 });
  assert.strictEqual(Api.ultima.base, 'https://eyes.g500.mx');
  assert.strictEqual(Api.ultima.datos.device_uid, 'pi-abc');
  assert.strictEqual(Api.ultima.datos.provision_token, undefined, 'el testigo del viejo no viaja al nuevo');
  const c = leer();
  assert.strictEqual(c.server_url, 'https://eyes.g500.mx');
  assert.strictEqual(c.mudanza.anterior, 'http://159.203.188.58:4000');
  assert.strictEqual(c.mudanza.testigo_anterior, 'se_viejo');
  assert.deepStrictEqual(c.camara, { modo: 'libcamera' }, 'lo demas del config.json se conserva');
});

test('con codigo de vinculacion, lo presenta alla', async () => {
  const cfg = configInicial();
  const Api = apiFalsa({ device_id: 5, token: 't' });
  await mudanza.preparar({ payload: { servidor: 'https://eyes.otra.mx', codigo: 'ABCD2345' }, cfg, datosRegistro, Api });
  assert.strictEqual(Api.ultima.datos.codigo_vinculacion, 'ABCD2345');
});

test('NO se mueve si el servidor nuevo no lo acepta', async () => {
  for (const [e, motivo] of [
    [error(403, '{"error":"vinculacion_requerida"}'), /no conoce este equipo/],
    [error(403, '{"error":"codigo_invalido"}'), /rechazo el codigo/],
    [new Error('fetch failed'), /no pude hablar/],
  ]) {
    const cfg = configInicial();
    await assert.rejects(mudanza.preparar({ payload: { servidor: 'https://eyes.x.mx' }, cfg, datosRegistro, Api: apiFalsa(e) }), motivo);
    assert.strictEqual(leer().server_url, 'http://159.203.188.58:4000', 'el config.json no se toca');
    assert.strictEqual(leer().mudanza, undefined);
  }
});

test('no se muda al mismo servidor ni a una direccion invalida', async () => {
  const cfg = configInicial();
  const Api = apiFalsa({ device_id: 1, token: 't' });
  await assert.rejects(mudanza.preparar({ payload: { servidor: 'http://159.203.188.58:4000/' }, cfg, datosRegistro, Api }), /ya esta/);
  await assert.rejects(mudanza.preparar({ payload: { servidor: 'eyes.x.mx' }, cfg, datosRegistro, Api }), /no es valida/);
});

test('el primer reporte alla confirma; sin reporte en el plazo, regresa solo', async () => {
  configInicial();
  await mudanza.preparar({ payload: { servidor: 'https://eyes.g500.mx' }, cfg: { ...leer(), testigo_de_alta: 'se_viejo' }, datosRegistro, Api: apiFalsa({ device_id: 1, token: 't' }) });

  // Confirmar
  let cfg = leer();
  assert.ok(mudanza.pendiente(cfg));
  assert.strictEqual(mudanza.confirmar(cfg).anterior, 'http://159.203.188.58:4000');
  assert.strictEqual(leer().mudanza, undefined);
  assert.strictEqual(leer().server_url, 'https://eyes.g500.mx');

  // Otra mudanza que no se confirma: dentro del plazo se espera, fuera regresa
  configInicial();
  await mudanza.preparar({ payload: { servidor: 'https://eyes.g500.mx' }, cfg: { ...leer(), testigo_de_alta: 'se_viejo' }, datosRegistro, Api: apiFalsa({ device_id: 1, token: 't' }) });
  cfg = leer();
  const desde = new Date(cfg.mudanza.desde).getTime();
  assert.strictEqual(mudanza.vencida(cfg, desde + 29 * 60000), false);
  assert.strictEqual(mudanza.vencida(cfg, desde + 31 * 60000), true);
  assert.strictEqual(mudanza.vencida({ ...cfg, mudanza_espera_min: 2 }, desde + 3 * 60000), true, 'el plazo se puede ajustar');
  assert.strictEqual(mudanza.vencida({ ...cfg, mudanza: { ...cfg.mudanza, espera_min: 5 } }, desde + 4 * 60000), false, 'el plazo de la orden manda');
  assert.strictEqual(mudanza.vencida({ ...cfg, mudanza: { ...cfg.mudanza, espera_min: 5 } }, desde + 6 * 60000), true);
  mudanza.revertir(cfg);
  const c = leer();
  assert.strictEqual(c.server_url, 'http://159.203.188.58:4000');
  assert.strictEqual(c.testigo_de_alta, 'se_viejo', 'recupera su testigo del servidor viejo');
  assert.strictEqual(c.mudanza, undefined);
  assert.strictEqual(c.mudanza_fallida.a, 'https://eyes.g500.mx', 'deja dicho a donde no pudo');
});

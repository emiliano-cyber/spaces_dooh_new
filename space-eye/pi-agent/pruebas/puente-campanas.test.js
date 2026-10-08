// Pruebas del puente para las campanas de SPACE OS y la huella de la
// configuracion (src/puente.js).   node --test pruebas
//
// Lo que no puede fallar: que la prueba de una campana suba ligada a su
// campana (source=campana), que la referencia llegue tal cual o diga 404 si ya
// no es del equipo, que la huella que dio el servidor llegue a monitor.py, y
// que nada de esto conteste sin el secreto.
const test = require('node:test');
const assert = require('node:assert');
const { Puente } = require('../src/puente');

function armar() {
  const subidas = [];
  const api = {
    async referenciaCampana(id) {
      if (String(id) === '41') return Buffer.from('JPEG-41');
      if (String(id) === '99') throw new Error('sin red');
      return null;
    },
    async subirFoto(jpeg, meta) { subidas.push({ jpeg: jpeg.toString(), meta }); },
    log: async () => {},
  };
  const p = new Puente({ camara: {}, api, ocupada: () => false, log: () => {}, dirEstado: '/tmp' });
  return { p, subidas };
}

async function pedir(p, metodo, ruta, cuerpo, secreto = p.secreto) {
  const r = await fetch(p.url + ruta, {
    method: metodo,
    headers: { 'X-Puente': secreto, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { estado: r.status, tipo: r.headers.get('content-type'), cuerpo: Buffer.from(await r.arrayBuffer()) };
}

test('la referencia de una campana llega tal cual; 404 si ya no es del equipo; 502 sin red', async () => {
  const { p } = armar();
  await p.iniciar();
  try {
    const ok = await pedir(p, 'GET', '/campana/41');
    assert.strictEqual(ok.estado, 200);
    assert.strictEqual(ok.tipo, 'image/jpeg');
    assert.strictEqual(ok.cuerpo.toString(), 'JPEG-41');
    assert.strictEqual((await pedir(p, 'GET', '/campana/7')).estado, 404);
    assert.strictEqual((await pedir(p, 'GET', '/campana/99')).estado, 502);
    assert.strictEqual((await pedir(p, 'GET', '/campana/../x')).estado, 404, 'solo numeros');
  } finally {
    p.servidor.close();
  }
});

test('la prueba del dia sube como source=campana con su campaign_id', async () => {
  const { p, subidas } = armar();
  await p.iniciar();
  try {
    const r = await pedir(p, 'POST', '/campana', { foto: Buffer.from('FOTO').toString('base64'), campana_id: 41 });
    assert.deepStrictEqual(JSON.parse(r.cuerpo), { ok: true });
    assert.strictEqual(subidas.length, 1);
    assert.strictEqual(subidas[0].jpeg, 'FOTO');
    assert.strictEqual(subidas[0].meta.source, 'campana');
    assert.strictEqual(subidas[0].meta.campaign_id, 41);
  } finally {
    p.servidor.close();
  }
});

test('la huella del ultimo reporte llega a monitor.py', async () => {
  const { p } = armar();
  await p.iniciar();
  try {
    assert.deepStrictEqual(JSON.parse((await pedir(p, 'GET', '/version')).cuerpo), { version: null });
    p.version = 'abc123';
    assert.deepStrictEqual(JSON.parse((await pedir(p, 'GET', '/version')).cuerpo), { version: 'abc123' });
  } finally {
    p.servidor.close();
  }
});

test('sin el secreto no contesta nada', async () => {
  const { p, subidas } = armar();
  await p.iniciar();
  try {
    assert.strictEqual((await pedir(p, 'GET', '/campana/41', null, 'otro')).estado, 403);
    assert.strictEqual((await pedir(p, 'POST', '/campana', { foto: 'eA==', campana_id: 41 }, 'otro')).estado, 403);
    assert.strictEqual((await pedir(p, 'GET', '/version', null, 'otro')).estado, 403);
    assert.strictEqual(subidas.length, 0);
  } finally {
    p.servidor.close();
  }
});

// backend/scripts/prueba-captura-instancia.ts
//
// Comprueba la UNICA puerta de escritura que tiene una instancia de SPACE OS:
// pedirle una foto a un equipo suyo. Y, sobre todo, comprueba que esa puerta no
// abrio ninguna otra.
//
//   npm run prueba:captura-instancia
//
// Necesita el backend en marcha y una cuenta admin para poder crear las llaves
// de la prueba (se revocan al terminar). Por omision habla con el backend local:
//
//   BASE=http://127.0.0.1:4000 ADMIN_EMAIL=admin@spaceeye.app ADMIN_PASS=... \
//   npm run prueba:captura-instancia
//
// POR QUE ESTA PRUEBA EXISTE. El dia que se abrio esta ruta se abrieron tambien
// dos cosas que antes estaban cerradas: una llave puede ESCRIBIR (nunca podia) y
// el historico de telemetria es alcanzable con llave (antes no lo era, y ese
// controlador NO comprobaba el dueno). Las dos son faciles de aflojar sin
// querer, porque viven en una lista de rutas que se edita a mano. Esto lo pilla.
const BASE = (process.env.BASE ?? 'http://127.0.0.1:4000').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@spaceeye.app';
const ADMIN_PASS = process.env.ADMIN_PASS ?? 'Admin123456';

let fallos = 0;
function afirmar(ok: boolean, texto: string, extra = '') {
  if (!ok) { fallos++; console.log(`  FALLA  ${texto}  ${extra}`); }
  else console.log(`  ok     ${texto}  ${extra}`);
}

type Resp = { status: number; cuerpo: any };
async function pedir(metodo: string, ruta: string, credencial: string): Promise<Resp> {
  const r = await fetch(BASE + ruta, { method: metodo, headers: { Authorization: `Bearer ${credencial}` } });
  let cuerpo: any = null;
  try { cuerpo = await r.json(); } catch { /* algunas respuestas no traen cuerpo */ }
  return { status: r.status, cuerpo };
}

async function main() {
  // ─── Sesion de admin, solo para crear y revocar las llaves de la prueba ───
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  if (!login.ok) {
    console.log(`\nNo pude entrar como admin (${login.status}). Revisa que el backend este arriba y las credenciales.`);
    process.exit(1);
  }
  const admin = (await login.json()).access_token as string;
  const H = { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' };

  // ─── Un equipo real de la base, y su dueno ───────────────────────────────
  const equipos = (await (await fetch(`${BASE}/api/devices`, { headers: H })).json()).devices as any[];
  const conDueno = equipos.find((d) => d.owner);
  if (!conDueno) {
    console.log('\nNo hay ningun equipo CON DUENO en esta base, y sin eso la prueba no significa nada.');
    console.log('Asignale un dueno a un equipo y vuelve a correrla.');
    process.exit(1);
  }
  const dueno = String(conDueno.owner);
  const ajeno = `${dueno}-inexistente`;
  console.log(`\nEquipo de la prueba: #${conDueno.id} "${conDueno.name}" (dueno ${dueno})`);

  // ─── Las cuatro credenciales que hacen falta ─────────────────────────────
  const llaves: { id: number; llave: string }[] = [];
  async function crear(nombre: string, owner: string | null, escritura: boolean, uso: 'lectura' | 'alta') {
    const r = await fetch(`${BASE}/api/llaves`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ nombre: `prueba captura · ${nombre}`, owner, escritura, uso }),
    });
    const d = await r.json();
    if (!d.llave) throw new Error(`no pude crear la llave "${nombre}": ${JSON.stringify(d)}`);
    llaves.push({ id: d.id, llave: d.llave });
    return d.llave as string;
  }

  const suyaEscribe = await crear('dueno con escritura', dueno, true, 'lectura');
  const suyaLee = await crear('dueno solo lectura', dueno, false, 'lectura');
  const ajenaEscribe = await crear('otro cliente con escritura', ajeno, true, 'lectura');
  const testigo = await crear('testigo de alta', dueno, false, 'alta');

  try {
    console.log('\n1) Pedir la foto, que es para lo que existe la ruta');
    let r = await pedir('POST', `/api/eyes/devices/${conDueno.id}/captura`, suyaEscribe);
    afirmar(r.status === 200 && typeof r.cuerpo?.orden === 'number', 'la llave del dueno pide la foto',
      r.status === 200 ? `orden ${r.cuerpo.orden}, en_linea=${r.cuerpo.en_linea}` : JSON.stringify(r.cuerpo));

    console.log('\n2) Quien NO puede, no puede');
    r = await pedir('POST', `/api/eyes/devices/${conDueno.id}/captura`, suyaLee);
    afirmar(r.status === 401, 'una llave de solo lectura no enciende la camara', JSON.stringify(r.cuerpo));

    r = await pedir('POST', `/api/eyes/devices/${conDueno.id}/captura`, testigo);
    afirmar(r.status === 401, 'un testigo de alta tampoco', JSON.stringify(r.cuerpo));

    console.log('\n3) LA FRONTERA: un equipo ajeno no se deja fotografiar');
    r = await pedir('POST', `/api/eyes/devices/${conDueno.id}/captura`, ajenaEscribe);
    afirmar(r.status === 404, 'y contesta 404, lo mismo que un equipo que no existe', JSON.stringify(r.cuerpo));
    r = await pedir('POST', '/api/eyes/devices/99999999/captura', suyaEscribe);
    afirmar(r.status === 404, 'un equipo inventado da 404 y no 500');
    r = await pedir('POST', '/api/eyes/devices/abc/captura', suyaEscribe);
    afirmar(r.status === 403 || r.status === 400, 'un id que no es numero no entra siquiera', `HTTP ${r.status}`);

    console.log('\n4) El historico: se abrio a las llaves, y comprueba el dueno');
    r = await pedir('GET', `/api/devices/${conDueno.id}/telemetry?granularity=hour`, suyaLee);
    afirmar(r.status === 200, 'el dueno lee el historico de su equipo',
      r.status === 200 ? `${(r.cuerpo?.series ?? []).length} puntos, ${(r.cuerpo?.alerts ?? []).length} alertas` : JSON.stringify(r.cuerpo));
    r = await pedir('GET', `/api/devices/${conDueno.id}/telemetry`, ajenaEscribe);
    afirmar(r.status === 404, 'otro cliente NO lee ese historico', JSON.stringify(r.cuerpo));

    console.log('\n4b) Fallas de pantalla y creativos (la ficha de SPACE OS)');
    for (const que of ['pantalla', 'creativos']) {
      r = await pedir('GET', `/api/devices/${conDueno.id}/${que}`, suyaLee);
      afirmar(r.status === 200, `el dueno lee ${que} de su equipo`, `HTTP ${r.status}`);
      r = await pedir('GET', `/api/devices/${conDueno.id}/${que}`, ajenaEscribe);
      afirmar(r.status === 404, `otro cliente NO lee ${que} de ese equipo`, JSON.stringify(r.cuerpo));
      // Con escritura y todo, una llave no CAMBIA nada aqui: su escritura es solo la captura.
      r = await pedir('PUT', `/api/devices/${conDueno.id}/${que}`, suyaEscribe);
      afirmar(r.status === 403, `PUT ${que} sigue cerrado a una llave con escritura`, `HTTP ${r.status}`);
    }

    console.log('\n5) Que no se abrio nada mas (la parte que de verdad importa)');
    const cerradas: [string, string][] = [
      ['POST', `/api/devices/${conDueno.id}/command`],
      ['GET', `/api/devices/${conDueno.id}/logs`],
      ['GET', `/api/devices/${conDueno.id}/telemetry/export`],
      ['GET', '/api/schedules'],
      ['GET', '/api/llaves'],
      ['POST', `/api/devices/${conDueno.id}/creativos/reaprender`],
    ];
    for (const [metodo, ruta] of cerradas) {
      const x = await pedir(metodo, ruta, suyaEscribe);
      afirmar(x.status === 403, `${metodo} ${ruta} sigue cerrada`, `HTTP ${x.status}`);
    }
  } finally {
    // Las llaves de la prueba no se quedan vivas: son credenciales.
    for (const l of llaves) {
      await fetch(`${BASE}/api/llaves/${l.id}`, { method: 'DELETE', headers: H }).catch(() => {});
    }
    console.log(`\n(${llaves.length} llaves de prueba revocadas)`);
  }

  console.log(fallos ? `\n${fallos} FALLOS\n` : '\nTodo bien\n');
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => {
  console.error(`\nLa prueba no pudo completarse: ${e.message}\n`);
  process.exit(1);
});

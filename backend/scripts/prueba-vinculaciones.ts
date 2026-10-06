// backend/scripts/prueba-vinculaciones.ts
//
// Como entra un equipo NUEVO al Space Eye de una empresa, contra un Space Eye
// de verdad (el del ensayo local de la instancia). Lo que no puede fallar:
//   - sin codigo, un aparato desconocido NO entra (antes bastaba tener el APK);
//   - con codigo vigente entra, y el codigo queda gastado y ligado al equipo;
//   - un codigo no sirve dos veces, ni cancelado, ni inventado;
//   - un equipo que YA existe sigue entrando sin codigo (renovar su llave, la
//     migracion de la flota).
//
//   PRUEBA_API=http://127.0.0.1:4200 PRUEBA_LLAVE=se_... npm run prueba:vinculaciones
import crypto from 'crypto';
import { normalizar, mostrar, generarCodigo, ALFABETO } from '../src/utils/vinculaciones';

const API = process.env.PRUEBA_API || 'http://127.0.0.1:4200';
const LLAVE = process.env.PRUEBA_LLAVE || '';

let fallos = 0;
function afirmar(ok: boolean, texto: string, extra = '') {
  if (!ok) fallos++;
  console.log(`  ${ok ? 'ok   ' : 'FALLA'}  ${texto}${extra ? '  ' + extra : ''}`);
}

async function panel(metodo: string, ruta: string, cuerpo?: unknown) {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { Authorization: `Bearer ${LLAVE}`, 'Content-Type': 'application/json', 'X-SpaceOS-Usuario': 'prueba@ensayo' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: r.status, json: (await r.json().catch(() => ({}))) as any };
}

async function alta(uid: string, codigo?: string, ip?: string) {
  const r = await fetch(API + '/api/device/register', {
    method: 'POST',
    // `ip`: como la pondria el nginx de la instancia (X-Forwarded-For).
    headers: { 'Content-Type': 'application/json', ...(ip ? { 'X-Forwarded-For': ip } : {}) },
    body: JSON.stringify({
      device_uid: uid, android_version: 'ensayo', app_version: 'pi-agent 0.7.1',
      model: 'Pi de ensayo', manufacturer: 'Raspberry Pi', ...(codigo ? { codigo_vinculacion: codigo } : {}),
    }),
  });
  return { status: r.status, json: (await r.json().catch(() => ({}))) as any, limite: r.headers.get('ratelimit-limit') };
}

const uid = () => `ensayo-${crypto.randomBytes(10).toString('hex')}`;

(async () => {
  console.log('\n1) Formato de los codigos (sin base)');
  const c = generarCodigo();
  afirmar(c.length === 8 && [...c].every((ch) => ALFABETO.includes(ch)), 'se generan de 8 con el alfabeto sin caracteres confusos', c);
  afirmar(normalizar(' abcd-2345 ') === 'ABCD2345', 'se aceptan en minusculas, con guion y espacios');
  afirmar(normalizar('ABCD0O1I') === null, 'con 0, O, 1 o I no es un codigo');
  afirmar(mostrar('ABCD2345') === 'ABCD-2345', 'se muestran como ABCD-2345');

  if (!LLAVE) { console.log('\n(sin PRUEBA_LLAVE: solo la parte sin base)'); process.exit(fallos ? 1 : 0); }

  console.log('\n2) Sin codigo, un aparato nuevo no entra');
  const r0 = await alta(uid());
  afirmar(r0.status === 403 && r0.json.error === 'vinculacion_requerida', 'respuesta 403 vinculacion_requerida', `(${r0.status})`);

  console.log('\n3) Un codigo inventado no sirve');
  const r1 = await alta(uid(), 'ABCD-2345');
  afirmar(r1.status === 403 && r1.json.error === 'codigo_invalido', 'respuesta 403 codigo_invalido', `(${r1.status})`);

  console.log('\n4) Con un codigo de SPACE OS, entra');
  const g = await panel('POST', '/api/vinculaciones', { tipo: 'raspberry', nota: 'ensayo' });
  afirmar(g.status === 201 && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(g.json.codigo), 'SPACE OS genera el codigo', g.json.codigo);
  afirmar(String(g.json.enlace || '').startsWith('spaceeye://vincular?servidor='), 'con el enlace para el QR');
  afirmar(g.json.creado_por === 'SPACE OS · prueba@ensayo', 'y queda quien lo genero', g.json.creado_por);
  const nuevo = uid();
  const r2 = await alta(nuevo, g.json.codigo.toLowerCase());
  afirmar(r2.status === 200 && r2.json.device_id > 0 && !!r2.json.token, 'el equipo se da de alta y recibe su llave', `#${r2.json.device_id}`);

  const lista = await panel('GET', '/api/vinculaciones');
  const v = (lista.json.vinculaciones || []).find((x: any) => x.codigo === g.json.codigo);
  afirmar(v?.estado === 'usado' && v?.equipo?.id === r2.json.device_id, 'el codigo queda usado y ligado a ese equipo');

  console.log('\n5) El mismo codigo no sirve para un segundo equipo');
  const r3 = await alta(uid(), g.json.codigo);
  afirmar(r3.status === 403 && r3.json.error === 'codigo_invalido', 'respuesta 403', `(${r3.status})`);

  console.log('\n6) Un equipo que YA existe entra sin codigo (renovar llave, migracion)');
  const r4 = await alta(nuevo);
  afirmar(r4.status === 200 && r4.json.device_id === r2.json.device_id, 'mismo equipo, llave nueva');

  console.log('\n7) Un codigo cancelado no sirve');
  const g2 = await panel('POST', '/api/vinculaciones', { tipo: 'telefono' });
  const can = await panel('DELETE', `/api/vinculaciones/${g2.json.codigo}`);
  afirmar(can.status === 200, 'se cancela desde SPACE OS');
  const r5 = await alta(uid(), g2.json.codigo);
  afirmar(r5.status === 403, 'y ya no deja entrar', `(${r5.status})`);
  const can2 = await panel('DELETE', `/api/vinculaciones/${g2.json.codigo}`);
  afirmar(can2.status === 404, 'cancelarlo otra vez dice que no esta vigente');

  console.log('\n8) Vigencias: telefono 1 hora, Raspberry 14 dias');
  const hora = (new Date(g2.json.expira_en).getTime() - new Date(g2.json.creado_en).getTime()) / 60000;
  const dias = (new Date(g.json.expira_en).getTime() - new Date(g.json.creado_en).getTime()) / 86400000;
  afirmar(Math.round(hora) === 60, 'telefono: 60 min', `(${Math.round(hora)})`);
  afirmar(Math.round(dias) === 14, 'Raspberry: 14 dias', `(${Math.round(dias)})`);

  console.log('\n9) El bloqueo por codigos malos es POR IP (detras de nginx), no global');
  const ipMala = `203.0.113.${10 + Math.floor(Math.random() * 200)}`;
  for (let i = 0; i < 10; i++) await alta(uid(), 'ZZZZ-ZZZZ', ipMala);
  const bloqueada = await alta(uid(), 'ZZZZ-ZZZZ', ipMala);
  afirmar(bloqueada.status === 429, 'tras 10 codigos malos, esa IP espera', `(${bloqueada.status})`);
  const otra = await alta(uid(), 'ZZZZ-ZZZZ', '198.51.100.9');
  afirmar(otra.status === 403, 'otra IP (otra oficina) sigue pudiendo vincular', `(${otra.status})`);

  console.log('\n10) Un equipo ya dado de alta no cuenta contra el limite por IP');
  const st = await fetch(API + '/api/device/status', {
    method: 'POST', headers: { Authorization: `Bearer ${r2.json.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ battery_pct: 90 }),
  });
  afirmar(!st.headers.get('ratelimit-limit'), 'su reporte de estado no lleva contador', `(${st.status})`);
  afirmar(!!r3.limite, 'el alta si lo lleva');

  console.log(fallos ? `\n${fallos} FALLAS\n` : '\nTodo bien.\n');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

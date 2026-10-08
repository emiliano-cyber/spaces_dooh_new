// backend/scripts/prueba-monitoreo.ts
//
// El monitoreo de la pantalla de punta a punta, contra el backend en marcha:
// el dashboard marca la pantalla y enciende la vigilancia; un "equipo" pide su
// configuracion, abre una falla con evidencia, la repite (no debe duplicarse),
// manda su resumen en el latido y la da por recuperada; alguien descarta otra en
// el dashboard y el equipo debe recibirla como silenciada.
//
//   npm run prueba:monitoreo            (DEVICE_ID=6 por omision)
//
// Firma sus propias credenciales con los secretos de backend/.env, asi que solo
// sirve contra un backend que use esos mismos secretos (el local). Deja el equipo
// como estaba y borra las fallas que creo.
import { deviceJwt, userJwt } from '../src/utils/jwt';
import { pool } from '../src/config/database';
import sharp from 'sharp';

const BASE = (process.env.BASE ?? 'http://127.0.0.1:4000').replace(/\/+$/, '');
const DID = Number(process.env.DEVICE_ID ?? 6);

let fallos = 0;
function afirmar(ok: boolean, texto: string, extra = '') {
  if (!ok) { fallos++; console.log(`  FALLA  ${texto}  ${extra}`); }
  else console.log(`  ok     ${texto}`);
}

async function pedir(metodo: string, ruta: string, token: string, cuerpo?: any) {
  const esForm = cuerpo instanceof FormData;
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo && !esForm ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? (esForm ? cuerpo : JSON.stringify(cuerpo)) : undefined,
  });
  let j: any = null;
  try { j = await r.json(); } catch { /* sin cuerpo */ }
  return { status: r.status, j };
}

let JPEG: Buffer;
function falla(campos: Record<string, string>, conFoto = true) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  if (conFoto) f.append('photo', new Blob([JPEG], { type: 'image/jpeg' }), 'evidencia.jpg');
  return f;
}

async function main() {
  JPEG = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 200, g: 30, b: 30 } } }).jpeg().toBuffer();
  const usuario = userJwt.sign({ uid: 1, role: 'admin' }, 'access');
  const equipo = deviceJwt.sign({ did: DID, device_uid: 'prueba-monitoreo' });

  const [antes] = await pool.query<any[]>(`SELECT pantalla, salud_watch, salud_desde, salud_ultimo, aprendizaje_min, creative_cada_min, salud_cada_min FROM devices WHERE id = ?`, [DID]);
  const original = (antes as any[])[0];
  const creadas: number[] = [];

  try {
    console.log('Dashboard');
    let r = await pedir('PUT', `/api/devices/${DID}/pantalla`, usuario, { esquinas: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8]], filas: 4, columnas: 6 });
    afirmar(r.status === 400, 'tres esquinas se rechazan');
    // Esquinas tocadas en desorden (como en la primera prueba real): el servidor
    // las acomoda arriba-izq, arriba-der, abajo-der, abajo-izq.
    r = await pedir('PUT', `/api/devices/${DID}/pantalla`, usuario, {
      esquinas: [[0.298, 0.957], [0.875, 0.687], [0.928, 0.193], [0.258, 0.244]],
      filas: 4, columnas: 6, excluir: [[3, 5]], horario: { inicio: '06:00', fin: '24:00' },
    });
    afirmar(r.status === 200, 'marcar la pantalla', JSON.stringify(r.j));
    {
      const [g] = await pool.query<any[]>(`SELECT pantalla FROM devices WHERE id = ?`, [DID]);
      const guardada = (g as any[])[0].pantalla;
      const q = (typeof guardada === 'string' ? JSON.parse(guardada) : guardada).esquinas;
      afirmar(JSON.stringify(q) === JSON.stringify([[0.258, 0.244], [0.928, 0.193], [0.875, 0.687], [0.298, 0.957]]),
        'las esquinas en desorden se guardan en orden', JSON.stringify(q));
    }
    r = await pedir('PUT', `/api/devices/${DID}/salud`, usuario, { vigilar: true });
    afirmar(r.status === 200 && r.j.salud.vigilar && r.j.salud.aprendiendo, 'encender la vigilancia: arranca aprendiendo');
    afirmar(r.j.salud.aprendizaje_min === 120, 'por omision aprende 2 horas', String(r.j.salud.aprendizaje_min));
    r = await pedir('PUT', `/api/devices/${DID}/salud`, usuario, { aprendizaje_min: 0 });
    afirmar(r.status === 200 && r.j.salud.aprendizaje_min === 0 && !r.j.salud.aprendiendo, 'con 0 el servidor ya no marca aprendizaje');
    r = await pedir('PUT', `/api/devices/${DID}/salud`, usuario, { cada_min: 5 });
    afirmar(r.status === 200 && r.j.salud.cada_min === 5, 'fallas: se acepta revisar cada 5 min (pruebas)');
    r = await pedir('PUT', `/api/devices/${DID}/salud`, usuario, { cada_min: 2 });
    afirmar(r.status === 400, 'fallas: menos de 5 min se rechaza');

    r = await pedir('PUT', `/api/devices/${DID}/creativos`, usuario, { cada_min: 10 });
    afirmar(r.status === 400, 'creativos: cada 10 min se rechaza (el minimo es 30, o continuo)');
    r = await pedir('PUT', `/api/devices/${DID}/creativos`, usuario, { cada_min: 0 });
    afirmar(r.status === 200 && r.j.config.cada_min === 0, 'creativos: se acepta el modo continuo');

    console.log('Equipo');
    r = await pedir('GET', '/api/device/monitoreo', equipo);
    afirmar(r.status === 200 && r.j.pantalla?.columnas === 6 && r.j.pantalla.horario.fin === '24:00', 'recibe la pantalla y su horario');
    afirmar(r.j.salud?.vigilar === true && Array.isArray(r.j.salud.abiertas), 'recibe la configuracion de fallas');
    afirmar(r.j.salud.aprendizaje_min === 0 && r.j.creativos?.aprendizaje_min === 0, 'el equipo recibe el aprendizaje (fallas y creativos)');
    afirmar(r.j.encuadre && 'camera_zoom' in r.j.encuadre, 'recibe el encuadre');
    afirmar(r.j.creativos?.cada_min === 0, 'recibe el modo continuo de creativos');
    const bytes = Buffer.byteLength(JSON.stringify(r.j));
    afirmar(bytes < 2000, `la configuracion pesa poco (${bytes} bytes)`);

    r = await pedir('POST', '/api/device/fallas', equipo, falla({ evento: 'abrir', tipo: 'zona_apagada', fila: '1', columna: '2', confianza: '0.88', detalle: '{"texto":"prueba"}' }));
    afirmar(r.status === 200 && r.j.id > 0, 'abre una falla con evidencia', JSON.stringify(r.j));
    const id = r.j.id; creadas.push(id);
    r = await pedir('POST', '/api/device/fallas', equipo, falla({ evento: 'abrir', tipo: 'zona_apagada', fila: '1', columna: '2', confianza: '0.9' }));
    afirmar(r.j.id === id && r.j.repetida, 'un reintento no la duplica');
    r = await pedir('POST', '/api/device/fallas', equipo, falla({ evento: 'abrir', tipo: 'nada_real', confianza: '0.9' }, false));
    afirmar(r.status === 400, 'un tipo desconocido se rechaza');

    r = await pedir('GET', '/api/device/monitoreo', equipo);
    afirmar(r.j.salud.abiertas.some((a: any) => a.id === id && a.fila === 1 && a.columna === 2), 'la ve como abierta en su siguiente vuelta');

    r = await pedir('POST', '/api/device/status', equipo, {
      battery_pct: 100, battery_charging: true, storage_free_mb: 1000, ram_free_mb: 500, uptime_seconds: 5,
      salud: { ts: Date.now(), pantalla: 'OK', camara: 'OK', vistazos: 18, cambios: 14, zonas: [['zona_apagada', 1, 2, 0.88]], excluidas: [[3, 5]] },
    });
    afirmar(r.status === 200, 'el latido acepta el resumen');

    r = await pedir('GET', `/api/devices/${DID}/pantalla`, usuario);
    const f = r.j.fallas?.find((x: any) => x.id === id);
    afirmar(r.j.ultimo?.vistazos === 18, 'el dashboard ve la ultima revision');
    afirmar(f?.gabinete === 9 && f?.nombre === 'Posible gabinete apagado', 'la falla dice que gabinete (fila 2, col 3 = 9)', JSON.stringify(f));
    afirmar(typeof f?.evidencia === 'string' && f.evidencia.includes('sig='), 'la evidencia viene firmada');

    r = await pedir('GET', '/api/fallas?estado=abierta', usuario);
    afirmar(r.j.abiertas >= 1 && r.j.fallas.some((x: any) => x.id === id && x.equipo), 'aparece en la lista de la flota');

    r = await pedir('POST', '/api/device/fallas', equipo, falla({ evento: 'recuperar', tipo: 'zona_apagada', fila: '1', columna: '2', falla_id: String(id) }));
    afirmar(r.status === 200 && r.j.id === id, 'el equipo la da por recuperada');
    const [rec] = await pool.query<any[]>(`SELECT estado, recuperada_en, cerrada_por, photo_recuperacion_id FROM pantalla_fallas WHERE id = ?`, [id]);
    const fr = (rec as any[])[0];
    afirmar(fr.estado === 'recuperada' && fr.recuperada_en && fr.cerrada_por === 'equipo' && fr.photo_recuperacion_id, 'queda la hora y la foto de la recuperacion');
    r = await pedir('POST', '/api/device/fallas', equipo, falla({ evento: 'recuperar', tipo: 'zona_apagada', fila: '1', columna: '2', falla_id: String(id) }, false));
    afirmar(r.status === 200 && r.j.ya_cerrada, 'recuperar dos veces no es un error');

    // Media pantalla apagada: UNA alerta con la lista de gabinetes.
    r = await pedir('POST', '/api/device/fallas', equipo, falla({ evento: 'abrir', tipo: 'zona_apagada', confianza: '0.9',
      detalle: JSON.stringify({ texto: 'Varios gabinetes apagados', gabinetes: [1, 2, 3, 4, 5, 6, 7, 8], total: 15 }) }));
    const grupo = r.j.id; creadas.push(grupo);
    r = await pedir('GET', `/api/devices/${DID}/pantalla`, usuario);
    const fg = r.j.fallas.find((x: any) => x.id === grupo);
    afirmar(fg?.nombre === 'Varios gabinetes apagados' && fg?.detalle?.gabinetes?.length === 8 && fg.gabinete === null,
      'varios gabinetes apagados llegan como una sola falla con su lista', JSON.stringify(fg && { n: fg.nombre, g: fg.detalle?.gabinetes }));
    r = await pedir('POST', '/api/device/fallas', equipo, falla({ evento: 'abrir', tipo: 'zona_apagada', confianza: '0.9' }, false));
    afirmar(r.j.id === grupo && r.j.repetida, 'el grupo tampoco se duplica');

    r = await pedir('POST', '/api/device/fallas', equipo, falla({ evento: 'abrir', tipo: 'zona_congelada', fila: '0', columna: '0', confianza: '0.7' }));
    const otra = r.j.id; creadas.push(otra);
    r = await pedir('PUT', `/api/fallas/${otra}`, usuario, { estado: 'descartada', nota: 'era un anuncio' });
    afirmar(r.status === 200, 'descartarla en el dashboard');
    r = await pedir('GET', '/api/device/monitoreo', equipo);
    afirmar(r.j.salud.silenciadas.includes('zona_congelada:0:0'), 'el equipo la recibe como silenciada');
    afirmar(!r.j.salud.abiertas.some((a: any) => a.id === otra), 'y ya no como abierta');
  } finally {
    if (creadas.length) {
      const [fotos] = await pool.query<any[]>(`SELECT photo_id, photo_recuperacion_id FROM pantalla_fallas WHERE id IN (?)`, [creadas]);
      const ids = (fotos as any[]).flatMap((x) => [x.photo_id, x.photo_recuperacion_id]).filter(Boolean);
      await pool.query(`DELETE FROM pantalla_fallas WHERE id IN (?)`, [creadas]);
      if (ids.length) await pool.query(`DELETE FROM photos WHERE id IN (?)`, [ids]);
    }
    await pool.query(`UPDATE devices SET pantalla = ?, salud_watch = ?, salud_desde = ?, salud_ultimo = ?, aprendizaje_min = ? WHERE id = ?`,
      [original.pantalla ? JSON.stringify(original.pantalla) : null, original.salud_watch, original.salud_desde,
       original.salud_ultimo ? JSON.stringify(original.salud_ultimo) : null, original.aprendizaje_min, DID]);
    await pool.query(`UPDATE devices SET creative_cada_min = ?, salud_cada_min = ? WHERE id = ?`, [original.creative_cada_min, original.salud_cada_min, DID]);
    await pool.end();
  }
  console.log(fallos ? `\n${fallos} FALLAS` : '\nTodo en orden');
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

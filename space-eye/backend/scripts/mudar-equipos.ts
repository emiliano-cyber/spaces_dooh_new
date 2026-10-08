// backend/scripts/mudar-equipos.ts
//
// Muda equipos de un Space Eye a otro, UNO POR UNO y comprobando cada uno.
// Es la herramienta de la etapa 5 (pasar la flota de g500 de :4000 a su
// eyes.<dominio>), y sirve igual para cualquier mudanza.
//
// Para cada equipo:
//   1. le manda, desde el servidor de ORIGEN, la orden de mudanza
//      (UPDATE_CONFIG {mudanza:{servidor[, codigo]}}: el origen no necesita
//      ninguna version nueva para mandarla);
//   2. espera su respuesta: si el equipo NO pudo mudarse, dice por que y se
//      DETIENE (no sigue con los demas sin que alguien lo vea);
//   3. espera a verlo REPORTANDO en el destino; si no aparece, se detiene.
//      El equipo, por su lado, regresa solo al origen si el destino no le
//      responde en `--espera` minutos.
//
// No borra ni cambia nada mas en ninguno de los dos servidores.
//
//   ORIGEN_USUARIO=admin@... ORIGEN_CLAVE=... DESTINO_LLAVE=se_... \
//   npx tsx scripts/mudar-equipos.ts --origen http://159.203.188.58:4000 \
//     --destino https://eyes.g500.mx --equipos 2,4,5 [--espera 30] [--codigo-de 13=ABCD2345]
//
// Las credenciales van por variables de entorno para que no queden en el
// historial de la terminal; el script nunca las imprime.
const args = process.argv.slice(2);
const opt = (n: string, def = '') => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : def;
};
const ORIGEN = opt('origen').replace(/\/+$/, '');
const DESTINO = opt('destino').replace(/\/+$/, '');
const EQUIPOS = opt('equipos').split(',').map((s) => Number(s.trim())).filter((n) => n > 0);
const ESPERA = Number(opt('espera', '30')) || 30;
// "13=ABCD2345,14=..." para equipos que el destino todavia no conoce.
const CODIGOS = new Map(
  opt('codigo-de').split(',').filter(Boolean).map((p) => p.split('=') as [string, string]).map(([k, v]) => [Number(k), v]),
);

if (!ORIGEN || !DESTINO || !EQUIPOS.length) {
  console.error('uso: --origen URL --destino URL --equipos 1,2,3 [--espera 30] [--codigo-de id=CODIGO,...]');
  process.exit(2);
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function json(url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
  const cuerpo = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) throw Object.assign(new Error(`${r.status} ${cuerpo.error || ''}`.trim()), { status: r.status });
  return cuerpo;
}

async function tokenOrigen(): Promise<string> {
  const u = process.env.ORIGEN_USUARIO, c = process.env.ORIGEN_CLAVE;
  if (!u || !c) throw new Error('faltan ORIGEN_USUARIO y ORIGEN_CLAVE');
  const r = await json(`${ORIGEN}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u, password: c }),
  });
  return r.access_token;
}

(async () => {
  const llaveDestino = process.env.DESTINO_LLAVE;
  if (!llaveDestino) throw new Error('falta DESTINO_LLAVE (la llave de la instancia destino)');
  const tok = await tokenOrigen();
  const origen = (ruta: string, init: RequestInit = {}) =>
    json(`${ORIGEN}${ruta}`, { ...init, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const destino = (ruta: string) => json(`${DESTINO}${ruta}`, { headers: { Authorization: `Bearer ${llaveDestino}` } });

  console.log(`\nMudanza de ${EQUIPOS.length} equipo(s): ${ORIGEN} -> ${DESTINO} (regreso automatico a los ${ESPERA} min)\n`);
  for (const id of EQUIPOS) {
    const { device } = await origen(`/api/devices/${id}`);
    console.log(`#${id} ${device.name} (${device.app_version}, uid ${String(device.device_uid).slice(0, 12)}…)`);
    const mudanza: Record<string, unknown> = { servidor: DESTINO, mudanza_espera_min: ESPERA };
    if (CODIGOS.has(id)) mudanza.codigo = CODIGOS.get(id);
    const desde = Date.now();
    await origen(`/api/devices/${id}/command`, {
      method: 'POST', body: JSON.stringify({ command_type: 'UPDATE_CONFIG', payload: { mudanza }, priority: 1 }),
    });
    console.log('   orden enviada; esperando la respuesta del equipo…');

    // ¿El destino ya lo ve reportando? Se busca por su identidad (device_uid),
    // que es lo unico que no cambia de un servidor a otro.
    let enDestino: any = null;
    for (let i = 0; i < 60 && !enDestino; i++) {
      await dormir(10_000);
      const { devices } = await destino('/api/devices');
      const d = (devices || []).find((x: any) => x.device_uid === device.device_uid);
      if (d && d.last_seen_at && new Date(d.last_seen_at).getTime() > desde) enDestino = d;
      // Si el equipo contesto que NO pudo, el origen lo sabe: se dice y se para.
      const logs = await origen(`/api/devices/${id}/logs?limit=5`).catch(() => ({ logs: [] }));
      const fallo = (logs.logs || []).find((l: any) => l.category === 'mudanza' && l.level === 'error' && new Date(l.logged_at).getTime() > desde);
      if (fallo) {
        console.log(`   NO SE MUDO: ${fallo.message}\n   Se detiene aqui; el equipo sigue en el origen.`);
        process.exit(1);
      }
    }
    if (!enDestino) {
      console.log(`   No aparecio reportando en el destino en 10 min. Se detiene aqui.\n   (El equipo regresa solo al origen a los ${ESPERA} min si el destino no le responde.)`);
      process.exit(1);
    }
    console.log(`   MUDADO: reporta en el destino como #${enDestino.id} (${enDestino.app_version})\n`);
  }
  console.log('Todos los equipos se mudaron.\n');
})().catch((e) => {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
});

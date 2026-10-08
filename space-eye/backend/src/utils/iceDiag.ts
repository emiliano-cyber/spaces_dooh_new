// backend/src/utils/iceDiag.ts
// Resumen de los candidatos ICE que emite cada equipo al transmitir.
//
// Nace de un caso real: un equipo (Interlomas) tomaba fotos y reportaba
// telemetria sin problema, pero la vista en vivo quedaba en negro. La causa era
// que su red movil ya solo le daba IPv6: WebRTC no encontraba ninguna direccion
// IPv4 propia que anunciar, asi que no generaba ni srflx ni relay, y contra un
// TURN IPv4 no habia ni un par de candidatos compatible. Nada en el dashboard
// lo delataba. Esto lo deja registrado por equipo.
import { pool } from '../config/database';

export interface IceSummary {
  ipv4: { host: number; srflx: number; relay: number };
  ipv6: { host: number; srflx: number; relay: number };
  total: number;
  verdict: 'ok' | 'sin_ipv4' | 'sin_publicos' | 'sin_candidatos';
}

const nuevo = (): IceSummary => ({
  ipv4: { host: 0, srflx: 0, relay: 0 },
  ipv6: { host: 0, srflx: 0, relay: 0 },
  total: 0,
  verdict: 'sin_candidatos',
});

// Acumulador por equipo mientras dura el intento. Se vuelca a la BD con un
// respiro para no escribir una vez por candidato. La ventana se reinicia con
// cada candidato (los relay por TCP tardan bastante mas que los host y con una
// ventana fija quedaban fuera del resumen), con un tope por si el equipo sigue
// emitiendo indefinidamente.
const ESPERA_MS = 15000;
const TOPE_MS = 60000;
const enCurso = new Map<number, { sum: IceSummary; flush: NodeJS.Timeout; inicio: number }>();

// "candidate:123 1 udp 2113937151 10.211.3.121 34643 typ host ..."
export function registrarCandidato(deviceId: number, candidate: string) {
  if (!candidate) return;
  const m = /candidate:\S+ \d+ \S+ \d+ (\S+) \d+ typ (host|srflx|relay|prflx)/.exec(candidate);
  if (!m) return;
  const [, direccion, tipo] = m;
  if (tipo === 'prflx') return;

  let e = enCurso.get(deviceId);
  if (!e) {
    e = { sum: nuevo(), flush: setTimeout(() => void volcar(deviceId), ESPERA_MS), inicio: Date.now() };
    enCurso.set(deviceId, e);
  } else if (Date.now() - e.inicio < TOPE_MS) {
    clearTimeout(e.flush);
    e.flush = setTimeout(() => void volcar(deviceId), ESPERA_MS);
  }
  // Una IPv6 lleva ':'; los .local son mDNS del navegador (no aplican aqui).
  const familia = direccion.includes(':') ? 'ipv6' : 'ipv4';
  e.sum[familia][tipo as 'host' | 'srflx' | 'relay']++;
  e.sum.total++;
}

function dictaminar(s: IceSummary): IceSummary['verdict'] {
  if (s.total === 0) return 'sin_candidatos';
  const ipv4 = s.ipv4.host + s.ipv4.srflx + s.ipv4.relay;
  if (ipv4 === 0) return 'sin_ipv4';
  if (s.ipv4.srflx + s.ipv4.relay === 0) return 'sin_publicos';
  return 'ok';
}

// Un candidato rezagado (uno que llega despues del volcado) abria un resumen
// nuevo que pisaba al bueno: un relay ya conseguido se perdia y el equipo
// quedaba marcado como si nunca hubiera conectado. Si el volcado anterior es
// del mismo intento, se fusionan en vez de reemplazarse.
const VENTANA_INTENTO_MS = 90000;
const ultimo = new Map<number, { at: number; sum: IceSummary }>();

function fusionar(a: IceSummary, b: IceSummary): IceSummary {
  const s = nuevo();
  for (const f of ['ipv4', 'ipv6'] as const) {
    for (const t of ['host', 'srflx', 'relay'] as const) s[f][t] = a[f][t] + b[f][t];
  }
  s.total = a.total + b.total;
  return s;
}

async function volcar(deviceId: number) {
  const e = enCurso.get(deviceId);
  if (!e) return;
  enCurso.delete(deviceId);

  const prev = ultimo.get(deviceId);
  if (prev && Date.now() - prev.at < VENTANA_INTENTO_MS) {
    e.sum = fusionar(prev.sum, e.sum);
  }
  ultimo.set(deviceId, { at: Date.now(), sum: e.sum });

  e.sum.verdict = dictaminar(e.sum);
  try {
    await pool.query(
      `UPDATE devices SET last_ice_at = NOW(), last_ice_summary = ? WHERE id = ?`,
      [JSON.stringify(e.sum), deviceId]
    );
    if (e.sum.verdict !== 'ok') {
      console.log(`[IceDiag] device ${deviceId}: ${e.sum.verdict} (${JSON.stringify(e.sum)})`);
    }
  } catch (err: any) {
    console.error(`[IceDiag] no se pudo guardar el diagnostico de ${deviceId}:`, err.message);
  }
}

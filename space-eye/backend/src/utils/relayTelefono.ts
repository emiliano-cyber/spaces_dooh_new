// backend/src/utils/relayTelefono.ts
// La vista en vivo de un telefono, repartida por el servidor de medios.
//
// Antes cada espectador era una conexion de video saliendo del telefono: dos
// personas mirando eran el doble de datos moviles, asi que solo se dejaba mirar
// a una a la vez. Ahora el telefono le manda su video UNA sola vez al servidor
// de medios (MediaMTX) y el servidor lo reparte: da igual cuantos miren, al
// telefono le cuesta lo mismo que con uno.
//
// El telefono no se entera del cambio y no hace falta actualizar la APK: sigue
// mandando su oferta de video por el socket como siempre. La diferencia es quien
// la contesta. Antes la contestaba el navegador; ahora el backend se la entrega
// al servidor de medios (protocolo WHIP) y le devuelve al telefono la respuesta
// del servidor. Los navegadores ven desde ahi (WHEP), igual que la Raspberry.
import { env } from '../config/env';
import { sesionDeVista } from './streamWatchdog';

function autorizacion() {
  return 'Basic ' + Buffer.from(`${env.MEDIAMTX_USER}:${env.MEDIAMTX_PASS}`).toString('base64');
}

/** Donde publica el telefono de esta sesion (red interna). */
export function whipDe(clave: string) {
  return `${env.MEDIAMTX_WEBRTC_INTERNAL.replace(/\/+$/, '')}/${clave}/whip`;
}

/**
 * Entrega la oferta del telefono y devuelve la respuesta del servidor de medios,
 * mas la direccion de la sesion (para mandarle candidatos y para cerrarla).
 */
export async function entregarOferta(whip: string, sdp: string) {
  const r = await fetch(whip, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp', Authorization: autorizacion() },
    body: sdp,
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) {
    const cuerpo = (await r.text().catch(() => '')).slice(0, 200);
    throw new Error(`el servidor de medios contesto ${r.status} ${cuerpo}`.trim());
  }
  const respuesta = await r.text();
  const donde = r.headers.get('location');
  return { respuesta, recurso: donde ? new URL(donde, whip).toString() : null };
}

/**
 * Le pasa al servidor de medios una direccion del telefono (trickle ICE, RFC
 * 8840). No es imprescindible -el servidor tambien aprende la direccion cuando
 * el telefono le toca la puerta-, asi que si falla solo se anota.
 */
export async function entregarCandidato(
  recurso: string,
  oferta: string,
  c: { candidate?: string; sdpMid?: string; sdpMLineIndex?: number },
) {
  if (!c?.candidate) return;
  const ufrag = /a=ice-ufrag:(\S+)/.exec(oferta)?.[1];
  const pwd = /a=ice-pwd:(\S+)/.exec(oferta)?.[1];
  const linea = c.candidate.startsWith('candidate:') ? c.candidate : c.candidate.replace(/^a=/, '');
  const frag = [
    ufrag ? `a=ice-ufrag:${ufrag}` : '',
    pwd ? `a=ice-pwd:${pwd}` : '',
    'm=video 9 UDP/TLS/RTP/SAVPF 0',
    `a=mid:${c.sdpMid ?? '0'}`,
    `a=${linea}`,
    '',
  ].filter((l, i, t) => l !== '' || i === t.length - 1).join('\r\n');

  const r = await fetch(recurso, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/trickle-ice-sdpfrag', Authorization: autorizacion() },
    body: frag,
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok && r.status !== 204) throw new Error(`PATCH ${r.status}`);
}

/** Cierra la sesion del telefono en el servidor de medios. */
export async function cerrarSesion(recurso: string) {
  await fetch(recurso, {
    method: 'DELETE',
    headers: { Authorization: autorizacion() },
    signal: AbortSignal.timeout(5000),
  });
}

/**
 * La oferta de video de un telefono, si su vista se reparte por el servidor de
 * medios. Devuelve false si no es el caso (punto a punto: la contesta un
 * navegador). `contestar` le hace llegar la respuesta al telefono: por su socket
 * si esta conectado aqui, o por el buzon de V1 si esta instancia es un espejo.
 */
export async function atenderOferta(did: number, payload: any, contestar: (r: any) => void | Promise<void>) {
  const sesion = sesionDeVista(did);
  if (!sesion?.whip) return false;
  const sdp = payload?.sdp?.sdp ?? (typeof payload?.sdp === 'string' ? payload.sdp : '');
  if (!sdp) return true;
  try {
    // Una oferta nueva en la misma sesion (el telefono reintento): la anterior
    // ya no sirve.
    if (sesion.recurso) cerrarSesion(sesion.recurso).catch(() => {});
    sesion.oferta = sdp;
    sesion.recurso = null;
    const { respuesta, recurso } = await entregarOferta(sesion.whip, sdp);
    // Si mientras tanto se corto la transmision, no se le contesta.
    if (sesionDeVista(did) !== sesion) {
      if (recurso) cerrarSesion(recurso).catch(() => {});
      return true;
    }
    sesion.recurso = recurso;
    await contestar({ sdp: { type: 'answer', sdp: respuesta } });
    const pendientes = sesion.candidatosPendientes ?? [];
    sesion.candidatosPendientes = [];
    if (recurso) for (const c of pendientes) entregarCandidato(recurso, sdp, c).catch(() => {});
  } catch (err: any) {
    console.error(`[Relay] device ${did}: el servidor de medios no acepto su video:`, err.message);
  }
  return true;
}

/** Una direccion del telefono para su sesion repartida. false = no es el caso. */
export function atenderCandidato(did: number, payload: any) {
  const sesion = sesionDeVista(did);
  if (!sesion?.whip) return false;
  const c = payload?.candidate;
  if (!c?.candidate) return true;
  if (sesion.recurso && sesion.oferta) {
    entregarCandidato(sesion.recurso, sesion.oferta, c).catch(() => {});
  } else {
    // Llega antes que la respuesta del servidor de medios: se guarda.
    (sesion.candidatosPendientes ??= []).push(c);
  }
  return true;
}

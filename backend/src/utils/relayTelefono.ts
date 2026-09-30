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

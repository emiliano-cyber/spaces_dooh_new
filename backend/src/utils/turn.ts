// backend/src/utils/turn.ts
// Genera la lista de ICE servers (STUN + TURN) para WebRTC. El TURN usa
// credenciales temporales (TURN REST API): username = <expiry>, credential =
// base64(HMAC-SHA1(secret, username)). coturn valida con `use-auth-secret`.
import crypto from 'crypto';
import { env } from '../config/env';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export function getIceServers(): IceServer[] {
  const servers: IceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];

  if (env.TURN_URL && env.TURN_SECRET) {
    const ttlSeconds = 12 * 3600;
    const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
    const username = `${expiry}:spaceeye`;
    const credential = crypto
      .createHmac('sha1', env.TURN_SECRET)
      .update(username)
      .digest('base64');

    const urls = env.TURN_URL.split(',').map((s) => s.trim()).filter(Boolean);
    servers.push({ urls, username, credential });
  }

  return servers;
}

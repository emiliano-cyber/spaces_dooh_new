// backend/src/sockets/deviceSocket.ts
import { Server, Socket } from 'socket.io';
import { deviceJwt } from '../utils/jwt';
import { pool } from '../config/database';
import { redis } from '../config/redis';
import { registrarCandidato } from '../utils/iceDiag';
import { sesionDeVista } from '../utils/streamWatchdog';
import { entregarCandidato, entregarOferta, cerrarSesion } from '../utils/relayTelefono';

export function setupDeviceNamespace(io: Server) {
  const ns = io.of('/devices');

  ns.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string;
      if (!token) throw new Error('no_token');
      const payload = deviceJwt.verify(token);
      socket.data.device_id = payload.did;
      socket.data.device_uid = payload.device_uid;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  ns.on('connection', async (socket) => {
    const did = socket.data.device_id;
    socket.join(`device:${did}`);

    await pool.query(`UPDATE devices SET online=TRUE, last_seen_at=NOW() WHERE id=?`, [did]);
    await redis.publish('device:online', JSON.stringify({ device_id: did, online: true }));

    socket.on('command_ack', async ({ command_id }: { command_id: number }) => {
      await pool.query(
        `UPDATE commands SET status='executing' WHERE id=? AND device_id=?`,
        [command_id, did]
      );
    });

    socket.on('webrtc_offer', async (payload) => {
      // Vista repartida por el servidor de medios: la oferta no va a ningun
      // navegador, se le entrega al servidor y su respuesta vuelve al telefono.
      const sesion = sesionDeVista(did);
      if (sesion?.whip) {
        const sdp = payload?.sdp?.sdp ?? (typeof payload?.sdp === 'string' ? payload.sdp : '');
        if (!sdp) return;
        try {
          // Una oferta nueva en la misma sesion (el telefono reintento):
          // la anterior ya no sirve.
          if (sesion.recurso) cerrarSesion(sesion.recurso).catch(() => {});
          sesion.oferta = sdp;
          sesion.recurso = null;
          const { respuesta, recurso } = await entregarOferta(sesion.whip, sdp);
          // Si mientras tanto se corto la transmision, no se le contesta.
          if (sesionDeVista(did) !== sesion) {
            if (recurso) cerrarSesion(recurso).catch(() => {});
            return;
          }
          sesion.recurso = recurso;
          socket.emit('webrtc_answer', { sdp: { type: 'answer', sdp: respuesta } });
          const pendientes = sesion.candidatosPendientes ?? [];
          sesion.candidatosPendientes = [];
          if (recurso) {
            for (const c of pendientes) entregarCandidato(recurso, sdp, c).catch(() => {});
          }
        } catch (err: any) {
          console.error(`[DeviceSocket] device ${did}: el servidor de medios no acepto su video:`, err.message);
        }
        return;
      }
      await redis.publish('webrtc:device_offer', JSON.stringify({ device_id: did, ...payload }));
    });

    socket.on('webrtc_ice_candidate', async (payload) => {
      // Guarda que familias de direcciones logra ofrecer el equipo: un equipo en
      // red IPv6 pura no produce candidatos IPv4 y la vista en vivo no conecta,
      // aunque fotos y telemetria sigan funcionando.
      registrarCandidato(did, payload?.candidate?.candidate);
      const sesion = sesionDeVista(did);
      if (sesion?.whip) {
        const c = payload?.candidate;
        if (!c?.candidate) return;
        if (sesion.recurso && sesion.oferta) {
          entregarCandidato(sesion.recurso, sesion.oferta, c).catch(() => {});
        } else {
          // Llega antes que la respuesta del servidor de medios: se guarda.
          (sesion.candidatosPendientes ??= []).push(c);
        }
        return;
      }
      await redis.publish('webrtc:device_ice', JSON.stringify({ device_id: did, ...payload }));
    });

    socket.on('disconnect', async () => {
      await pool.query(`UPDATE devices SET online=FALSE WHERE id=?`, [did]);
      await redis.publish('device:online', JSON.stringify({ device_id: did, online: false }));
    });
  });

  // Subscribe to commands from dashboard
  const sub = redis.duplicate();
  sub.connect().then(() => {
    sub.subscribe('device:command', (msg) => {
      const { device_id, command } = JSON.parse(msg);
      ns.to(`device:${device_id}`).emit('command', command);
    });

    sub.subscribe('webrtc:dashboard_answer', (msg) => {
      const { device_id, sdp, user_id } = JSON.parse(msg);
      ns.to(`device:${device_id}`).emit('webrtc_answer', { sdp, user_id });
    });

    sub.subscribe('webrtc:dashboard_ice', (msg) => {
      const { device_id, candidate, user_id } = JSON.parse(msg);
      ns.to(`device:${device_id}`).emit('webrtc_ice_candidate', { candidate, user_id });
    });

    sub.subscribe('camera:control', (msg) => {
      const { device_id, control } = JSON.parse(msg);
      ns.to(`device:${device_id}`).emit('camera_control', control);
    });
  }).catch((err) => {
    console.error('[DeviceSocket] Redis subscription failed:', err.message);
  });
}

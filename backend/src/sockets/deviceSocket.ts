// backend/src/sockets/deviceSocket.ts
import { Server, Socket } from 'socket.io';
import { deviceJwt } from '../utils/jwt';
import { pool } from '../config/database';
import { redis } from '../config/redis';
import { registrarCandidato } from '../utils/iceDiag';
import { atenderCandidato, atenderOferta } from '../utils/relayTelefono';

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
      if (await atenderOferta(did, payload, (r) => { socket.emit('webrtc_answer', r); })) return;
      await redis.publish('webrtc:device_offer', JSON.stringify({ device_id: did, ...payload }));
    });

    socket.on('webrtc_ice_candidate', async (payload) => {
      // Guarda que familias de direcciones logra ofrecer el equipo: un equipo en
      // red IPv6 pura no produce candidatos IPv4 y la vista en vivo no conecta,
      // aunque fotos y telemetria sigan funcionando.
      registrarCandidato(did, payload?.candidate?.candidate);
      if (atenderCandidato(did, payload)) return;
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

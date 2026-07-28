// backend/src/sockets/dashboardSocket.ts
import { Server, Socket } from 'socket.io';
import { userJwt } from '../utils/jwt';
import { redis } from '../config/redis';
import { stopStream } from '../utils/streamWatchdog';

export function setupDashboardNamespace(io: Server) {
  const ns = io.of('/dashboard');

  // Si ya nadie esta viendo el equipo, no tiene caso que siga transmitiendo.
  const stopIfNobodyWatching = (deviceId: number) => {
    const room = ns.adapter.rooms.get(`watching:${deviceId}`);
    if (!room || room.size === 0) void stopStream(deviceId, 'sin espectadores');
  };

  ns.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string;
      if (!token) throw new Error('no_token');
      const payload = userJwt.verify(token);
      if (payload.type !== 'access') throw new Error('invalid_token_type');
      socket.data.user_id = payload.uid;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  ns.on('connection', (socket) => {
    socket.join('dashboard');
    const watching = new Set<number>();

    socket.on('watch_device', (deviceId: number) => {
      socket.join(`watching:${deviceId}`);
      watching.add(Number(deviceId));
    });

    socket.on('unwatch_device', (deviceId: number) => {
      socket.leave(`watching:${deviceId}`);
      watching.delete(Number(deviceId));
    });

    // Pestaña cerrada / navegador caido: el STOP_STREAM nunca llego, asi que lo
    // manda el servidor en cuanto se cae el socket (sin esperar los 3 minutos).
    socket.on('disconnect', () => {
      for (const deviceId of watching) {
        socket.leave(`watching:${deviceId}`);
        stopIfNobodyWatching(deviceId);
      }
      watching.clear();
    });

    socket.on('webrtc_answer', async ({ device_id, sdp }) => {
      await redis.publish('webrtc:dashboard_answer', JSON.stringify({
        device_id,
        sdp,
        user_id: socket.data.user_id,
      }));
    });

    socket.on('webrtc_ice_candidate', async ({ device_id, candidate }) => {
      await redis.publish('webrtc:dashboard_ice', JSON.stringify({
        device_id,
        candidate,
        user_id: socket.data.user_id,
      }));
    });

    // Control manual de camara en vivo (zoom, enfoque, exposicion, WB, lock).
    // Canal efimero (no persiste en `commands`): solo aplica si el device
    // esta transmitiendo. payload = { device_id, control: {...} }.
    socket.on('camera_control', async ({ device_id, control }) => {
      await redis.publish('camera:control', JSON.stringify({ device_id, control }));
    });
  });

  // Subscribe to device events
  const sub = redis.duplicate();
  sub.connect().then(() => {
    sub.subscribe('device:status', (msg) => {
      const data = JSON.parse(msg);
      ns.to(`watching:${data.device_id}`).emit('device:status', data);
      ns.to('dashboard').emit('device:status_summary', {
        device_id: data.device_id,
        battery_pct: data.battery_pct,
        signal_dbm: data.signal_dbm,
      });
    });

    sub.subscribe('device:online', (msg) => {
      const data = JSON.parse(msg);
      ns.to('dashboard').emit('device:online', data);
    });

    sub.subscribe('webrtc:device_offer', (msg) => {
      const data = JSON.parse(msg);
      ns.to(`watching:${data.device_id}`).emit('webrtc_offer', data);
    });

    sub.subscribe('webrtc:device_ice', (msg) => {
      const data = JSON.parse(msg);
      ns.to(`watching:${data.device_id}`).emit('webrtc_ice_candidate', data);
    });
  }).catch((err) => {
    console.error('[DashboardSocket] Redis subscription failed:', err.message);
  });
}

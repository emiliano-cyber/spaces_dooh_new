// backend/src/sockets/dashboardSocket.ts
import { Server, Socket } from 'socket.io';
import { userJwt } from '../utils/jwt';
import { redis } from '../config/redis';

export function setupDashboardNamespace(io: Server) {
  const ns = io.of('/dashboard');

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

    socket.on('watch_device', (deviceId: number) => {
      socket.join(`watching:${deviceId}`);
    });

    socket.on('unwatch_device', (deviceId: number) => {
      socket.leave(`watching:${deviceId}`);
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

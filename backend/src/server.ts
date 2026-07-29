// backend/src/server.ts
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { createApp } from './app';
import { env } from './config/env';
import { connectRedis } from './config/redis';
import { pool } from './config/database';
import { setupDeviceNamespace } from './sockets/deviceSocket';
import { setupDashboardNamespace } from './sockets/dashboardSocket';

async function main() {
  // Test DB connection
  try {
    await pool.query('SELECT 1');
    console.log('[MySQL] connected');
  } catch (err: any) {
    console.error('[MySQL] connection failed:', err.message || err);
    console.error('[MySQL] Server will start but DB operations will fail.');
    console.error('[MySQL] Make sure MySQL is running on', env.DB_HOST + ':' + env.DB_PORT);
  }

  // Connect Redis
  try {
    await connectRedis();
  } catch (err: any) {
    console.error('[Redis] connection failed:', err.message || err);
    console.error('[Redis] Server will start but realtime features will be unavailable.');
  }

  // Create HTTP server
  const app = createApp();
  const server = http.createServer(app);

  // Socket.io
  const io = new SocketServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  setupDeviceNamespace(io);
  setupDashboardNamespace(io);

  // Start schedule worker inline (for dev)
  if (env.NODE_ENV === 'development') {
    import('./workers/scheduleWorker').catch(console.error);
  }

  server.listen(env.PORT, () => {
    console.log(`[SPACE EYE] API running on http://localhost:${env.PORT}`);
    console.log(`[SPACE EYE] Environment: ${env.NODE_ENV}`);
  });
}

// Ultima red de seguridad: un fallo suelto (fuera de una peticion HTTP, p.ej. en
// un worker o un socket) NO debe tumbar el backend de toda la flota. Se registra
// y se sigue operando; la alternativa es dejar sin servicio a todos los equipos
// por un error aislado.
process.on('unhandledRejection', (err: any) => {
  console.error('[FALLO NO CONTROLADO] promesa rechazada:', err?.sqlMessage || err?.stack || err);
});
process.on('uncaughtException', (err: any) => {
  console.error('[FALLO NO CONTROLADO] excepcion:', err?.sqlMessage || err?.stack || err);
});

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

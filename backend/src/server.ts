// backend/src/server.ts
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { createApp } from './app';
import { env } from './config/env';
import { connectRedis } from './config/redis';
import { pool } from './config/database';
import { setupDeviceNamespace } from './sockets/deviceSocket';
import { setupDashboardNamespace } from './sockets/dashboardSocket';
import { espejoActivo } from './utils/espejo';
import { prepararInstancia } from './utils/instancia';

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
  // Modo instancia: sus llaves y su primer administrador, si hacen falta.
  await prepararInstancia();

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

  // El worker de programacion corre DENTRO del backend, siempre.
  //
  // Antes solo arrancaba en desarrollo, y en el servidor no habia ningun proceso
  // que lo levantara: la programacion de fotos existia en la base y en el
  // dashboard, pero no habia quien la disparara. Por eso nunca se tomo una sola
  // foto programada en produccion.
  //
  // Va aqui adentro en vez de en su propio contenedor porque el droplet tiene 2 GB
  // y ya carga seis; el candado de Redis (schedule:tick) evita el disparo doble si
  // algun dia se levanta mas de una instancia.
  // En modo espejo las fotos programadas las dispara V1, que tiene la misma
  // programacion: si las disparara tambien esta, cada foto saldria dos veces.
  if (espejoActivo()) import('./workers/espejoWorker').catch(console.error);
  else import('./workers/scheduleWorker').catch(console.error);

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

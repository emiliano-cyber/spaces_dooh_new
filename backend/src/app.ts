// backend/src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { createRoutes } from './routes';
import { env } from './config/env';

export function createApp() {
  const app = express();

  // Security
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve frontend static files
  app.use(express.static(path.join(__dirname, '../../frontend/public')));
  app.use('/src', express.static(path.join(__dirname, '../../frontend/src')));

  // Serve locally-stored photos (STORAGE_DRIVER=local). Sin esto, /storage/*.jpg
  // caeria en el fallback SPA y devolveria index.html en vez de la imagen.
  if (env.STORAGE_DRIVER === 'local') {
    app.use('/storage', express.static(path.resolve(process.cwd(), env.STORAGE_DIR)));
  }

  // API routes
  app.use(createRoutes());

  // SPA fallback - serve index.html for non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/socket.io/')) {
      res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
    }
  });

  // Manejador de errores. Junto con asyncRouter, evita que el fallo de una sola
  // peticion tumbe el backend de toda la flota: se responde 500, se registra, y
  // el servidor sigue atendiendo a los demas equipos.
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err?.sqlMessage || err?.message || err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'server_error' });
  });

  return app;
}

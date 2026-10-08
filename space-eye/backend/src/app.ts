// backend/src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { createRoutes } from './routes';
import { env } from './config/env';
import { firmaValida } from './utils/firmaArchivos';
import { enModoInstancia } from './utils/instancia';

export function createApp() {
  const app = express();

  // En el Space Eye de una empresa (modo instancia) SIEMPRE hay un nginx
  // delante (eyes.<dominio>), y llega por el puerto publicado de Docker: desde
  // la red privada del host. Sin esto, TODAS las peticiones parecian venir de
  // la misma IP, y el limite por IP de abajo se volvia un limite para el
  // servidor entero (20 equipos reportando lo agotaban) y el bloqueo por codigos
  // de vinculacion malos cerraba la puerta a todos a la vez. nginx REEMPLAZA
  // X-Forwarded-For con la IP real (no la agrega): no se puede falsificar desde
  // fuera. Solo se confia en saltos de loopback y redes privadas. TRUST_PROXY
  // lo cambia si hiciera falta.
  if (process.env.TRUST_PROXY || enModoInstancia()) {
    app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, uniquelocal');
  }

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
    // Los equipos ya dados de alta llevan su propia llave y reportan solos cada
    // minuto: 20 en la misma oficina (misma IP publica) agotarian el limite y
    // dejarian de reportar. No cuentan aqui; el ALTA si (register), que ademas
    // tiene su bloqueo por codigos malos.
    skip: (req) => req.path.startsWith('/device/') && req.path !== '/device/register',
  });
  app.use('/api/', limiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve frontend static files
  // Los instaladores de esta empresa primero (modo instancia), luego el panel.
  if (env.DESCARGAS_DIR) app.use(express.static(path.resolve(env.DESCARGAS_DIR)));
  app.use(express.static(path.join(__dirname, '../../frontend/public')));
  app.use('/src', express.static(path.join(__dirname, '../../frontend/src')));

  // Serve locally-stored photos (STORAGE_DRIVER=local). Sin esto, /storage/*.jpg
  // caeria en el fallback SPA y devolveria index.html en vez de la imagen.
  if (env.STORAGE_DRIVER === 'local') {
    // Portero ANTES del static: sin firma valida no se sirve el archivo.
    //
    // Hasta el 2026-09-14 esto estaba abierto: cualquiera con la URL veia la
    // foto de cualquier pantalla de cualquier cliente. Va montado aqui y no
    // dentro de express.static porque static responde y termina; si el filtro no
    // corre antes, no corre nunca.
    app.use('/storage', (req, res, next) => {
      const ruta = decodeURIComponent(req.baseUrl + req.path);
      if (firmaValida(ruta, req.query.exp, req.query.sig)) return next();
      res.status(403).json({ error: 'enlace_invalido_o_vencido' });
    });
    app.use('/storage', express.static(path.resolve(process.cwd(), env.STORAGE_DIR)));
    // Modo espejo: las fotos que tomaron los equipos estan en el volumen de V1
    // (montado solo lectura). Se busca primero aqui y luego alla.
    if (env.ESPEJO_STORAGE_DIR) app.use('/storage', express.static(path.resolve(env.ESPEJO_STORAGE_DIR)));
    // Si el archivo no esta, express.static llama a next() y la peticion cae en
    // el comodin de mas abajo, que devuelve index.html con 200. O sea que pedir
    // una foto borrada contestaba una PAGINA WEB haciendose pasar por imagen: el
    // navegador pinta una imagen rota y el ai-worker intenta decodificar HTML
    // como JPEG. Aqui se corta con un 404 honesto.
    app.use('/storage', (_req, res) => res.status(404).json({ error: 'archivo_no_encontrado' }));
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

// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { userJwt, deviceJwt, UserTokenPayload, DeviceTokenPayload } from '../utils/jwt';
import { env } from '../config/env';
import { comprobar, pareceLlave, LlaveServicio } from '../utils/llaveServicio';

declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
      device?: DeviceTokenPayload;
      // Presente en vez de `user` cuando quien llama es otro sistema.
      servicio?: LlaveServicio;
    }
  }
}

// Las UNICAS rutas que una llave de servicio puede alcanzar.
//
// Lista blanca a proposito. Con una lista negra, cada endpoint que alguien
// agregue manana nace ABIERTO a todas las llaves y nadie se entera hasta que se
// filtra algo: es el modo de fallo que no da error. Asi, lo que no este aqui
// responde 403 aunque sea de solo lectura.
//
// Cada una de estas TIENE que filtrar por `req.servicio.owner`. Si se agrega
// una ruta a esta lista sin filtrar en su controlador, se abre la fuga que SE.1
// vino a cerrar.
const RUTAS_DE_LLAVE: RegExp[] = [
  /^\/api\/devices$/,
  /^\/api\/devices\/\d+$/,
  /^\/api\/photos$/,
];

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }
  const credencial = header.slice(7);

  // --- Llave de servicio -----------------------------------------------------
  //
  // Un sistema externo (la instancia de un cliente, un puente) entra con una
  // llave que NO caduca y que solo lee, en vez de con la cuenta admin y una
  // sesion que se vence a los 7 dias.
  //
  // Deliberadamente NO se rellena `req.user`. Dos cosas salen gratis de ahi:
  // `requireRole` ya niega cuando no hay usuario, asi que ninguna ruta de admin
  // u operador es alcanzable con una llave; y ningun controlador puede escribir
  // `created_by` con un usuario que no existe -todos los usos de `req.user.uid`
  // estan en manejadores de escritura, comprobado uno por uno.
  if (pareceLlave(credencial)) {
    const llave = await comprobar(credencial);
    if (!llave) return res.status(401).json({ error: 'llave_invalida' });
    // Solo lectura salvo que la llave lo diga. HEAD y OPTIONS tambien leen.
    if (!llave.escritura && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return res.status(401).json({ error: 'llave_de_solo_lectura' });
    }
    if (!RUTAS_DE_LLAVE.some((r) => r.test(req.path))) {
      return res.status(403).json({ error: 'ruta_no_permitida_para_llave' });
    }
    req.servicio = llave;
    return next();
  }

  try {
    const payload = userJwt.verify(credencial);
    if (payload.type !== 'access') {
      return res.status(401).json({ error: 'invalid_token_type' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

export function requireDevice(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }
  try {
    const payload = deviceJwt.verify(header.slice(7));
    req.device = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// Autentica al ai-worker en los endpoints /api/internal/* mediante un secreto
// compartido enviado en el header X-Worker-Secret.
export function requireWorker(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers['x-worker-secret'];
  if (typeof secret !== 'string' || secret !== env.WORKER_SECRET) {
    return res.status(401).json({ error: 'invalid_worker_secret' });
  }
  next();
}

export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

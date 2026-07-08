// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { userJwt, deviceJwt, UserTokenPayload, DeviceTokenPayload } from '../utils/jwt';
import { env } from '../config/env';

declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
      device?: DeviceTokenPayload;
    }
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }
  try {
    const payload = userJwt.verify(header.slice(7));
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

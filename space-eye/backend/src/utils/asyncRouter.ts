// backend/src/utils/asyncRouter.ts
// Router que NO tumba el proceso cuando un handler asincrono falla.
//
// Express 4 no captura las promesas rechazadas de un handler: se convierten en
// unhandledRejection y Node mata el proceso. Paso de verdad en produccion: un
// agente de PC mandaba un dato mas largo de lo que aguantaba una columna, MySQL
// devolvia error, y CADA intento de registro tumbaba el backend de TODA la flota
// (4 caidas seguidas, porque el agente reintentaba cada 30 s).
//
// Aqui se envuelve cada handler para que cualquier error caiga en el middleware
// de errores en lugar de matar el servidor.
import { Router, RequestHandler } from 'express';

const METODOS = ['get', 'post', 'put', 'delete', 'patch', 'all'] as const;

function envolver(h: any): any {
  // Los middlewares de error llevan 4 argumentos: se dejan tal cual.
  if (typeof h !== 'function' || h.length > 3) return h;
  const seguro: RequestHandler = (req, res, next) => {
    try {
      Promise.resolve(h(req, res, next)).catch(next);
    } catch (err) {
      next(err);
    }
  };
  return seguro;
}

export function asyncRouter(): Router {
  const r = Router();
  for (const metodo of METODOS) {
    const original = (r as any)[metodo].bind(r);
    (r as any)[metodo] = (ruta: any, ...handlers: any[]) =>
      original(ruta, ...handlers.map(envolver));
  }
  return r;
}

import 'server-only'

// ============================================================================
//  lib/server/rate-limit.ts — Limitador en memoria (ventana fija) para frenar
//  fuerza bruta. Suficiente para una instancia única; para escalar a varias
//  instancias, migrar a un store compartido (Redis).
// ============================================================================

interface Entrada {
  count: number
  reset: number
}
const cubos = new Map<string, Entrada>()

// Registra un intento para `clave`. Devuelve ok=false si superó `max` en la
// ventana `ventanaMs`. `retrySeg` = segundos hasta que se libera.
export function limitar(clave: string, max: number, ventanaMs: number): { ok: boolean; retrySeg: number } {
  const ahora = Date.now()
  const e = cubos.get(clave)
  if (!e || e.reset <= ahora) {
    cubos.set(clave, { count: 1, reset: ahora + ventanaMs })
    // Limpieza oportunista de entradas vencidas (evita crecer sin fin).
    if (cubos.size > 5000) for (const [k, v] of cubos) if (v.reset <= ahora) cubos.delete(k)
    return { ok: true, retrySeg: 0 }
  }
  e.count++
  if (e.count > max) return { ok: false, retrySeg: Math.ceil((e.reset - ahora) / 1000) }
  return { ok: true, retrySeg: 0 }
}

// ¿Está `clave` por encima de `max` AHORA? No cuenta nada: es para los cubos que
// solo suman los FALLOS (SEG-21OCT, el login por cuenta), donde mirar y anotar
// son dos momentos distintos — se mira antes de verificar la contraseña y se
// anota solo si resultó mala.
export function consultar(clave: string, max: number): { ok: boolean; retrySeg: number } {
  const ahora = Date.now()
  const e = cubos.get(clave)
  if (!e || e.reset <= ahora || e.count < max) return { ok: true, retrySeg: 0 }
  return { ok: false, retrySeg: Math.ceil((e.reset - ahora) / 1000) }
}

// Vacía `clave`. El login correcto lo usa para que dos tecleos malos al día no
// se acumulen hasta bloquear a quien sí sabe su contraseña.
export function olvidar(clave: string): void {
  cubos.delete(clave)
}

// IP del cliente detrás de un proxy (Nginx). Cae a 'desconocida' si no hay.
export function ipDe(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'desconocida'
}

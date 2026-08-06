import { NextResponse } from 'next/server'
import { googleHabilitado } from '@/lib/server/google-oauth'

export const runtime = 'nodejs'
// EN TIEMPO DE PETICIÓN, no de build. Es el punto entero de esta ruta.
export const dynamic = 'force-dynamic'

// GET /api/auth/metodos/ → qué formas de entrar ofrece este despliegue.
//
// PÚBLICA y sin sesión: la usa la pantalla de login, que por definición se ve
// antes de tener una.
//
// ── Por qué existe esta ruta en vez de leer la bandera en el cliente ────────
// Las otras dos banderas del login (`NEXT_PUBLIC_AUTOREGISTRO`,
// `NEXT_PUBLIC_RECUPERAR_PASSWORD`) se leen con `process.env` en el propio
// componente. Eso funciona, pero tiene un coste que se pagó en carne propia:
// Next las HORNEA EN EL BUILD, así que cambiarlas exige recompilar y no solo
// reiniciar. Comprobado el 06/08/2026 construyendo con la bandera de recuperar
// en 0: el texto «Olvidaste tu contraseña» desaparece del bundle.
//
// `GOOGLE_OAUTH` no lleva prefijo NEXT_PUBLIC_ precisamente para no repetirlo
// (ADR 0012, decisión 5), y entonces el cliente no puede leerla: tiene que
// preguntar. Preguntar por HTTP también evita depender de si esta página se
// prerenderiza estáticamente o no — un componente de servidor que leyera la
// variable durante la generación estática la hornearía igual, que es el mismo
// defecto por otra puerta.
//
// No revela nada: que exista el botón ya diría lo mismo.
export async function GET() {
  return NextResponse.json(
    { google: googleHabilitado() },
    // Sin caché: si se apaga la función, la siguiente carga del login tiene que
    // enterarse. Una respuesta cacheada mantendría el botón vivo apuntando a un
    // endpoint que ya responde 503.
    { headers: { 'cache-control': 'no-store' } },
  )
}

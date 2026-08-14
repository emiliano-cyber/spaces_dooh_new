import { NextResponse } from 'next/server'
import { googleHabilitado } from '@/lib/server/google-oauth'
import { autoregistroActivo } from '@/lib/entorno'

export const runtime = 'nodejs'
// EN TIEMPO DE PETICIÓN, no de build. Es el punto entero de esta ruta.
export const dynamic = 'force-dynamic'

// GET /api/auth/metodos/ → qué formas de entrar ofrece este despliegue.
//
// PÚBLICA y sin sesión: la usa la pantalla de login, que por definición se ve
// antes de tener una.
//
// ── Por qué existe esta ruta en vez de leer la bandera en el cliente ────────
// La bandera que queda del login (`NEXT_PUBLIC_RECUPERAR_PASSWORD`) se lee con
// `process.env` en el propio componente. Eso funciona, pero tiene un coste que
// se pagó en carne propia: Next la HORNEA EN EL BUILD, así que cambiarla exige
// recompilar y no solo reiniciar. Comprobado el 06/08/2026 construyendo con la
// bandera de recuperar en 0: el texto «Olvidaste tu contraseña» desaparece del
// bundle.
//
// `GOOGLE_OAUTH` no lleva prefijo NEXT_PUBLIC_ precisamente para no repetirlo
// (ADR 0012, decisión 5), y entonces el cliente no puede leerla: tiene que
// preguntar. Preguntar por HTTP también evita depender de si esta página se
// prerenderiza estáticamente o no — un componente de servidor que leyera la
// variable durante la generación estática la hornearía igual, que es el mismo
// defecto por otra puerta.
//
// ── Y por qué el autoregistro se añadió aquí (F2.6, 14/08/2026) ────────────
// Era exactamente ese defecto, cobrado: `/login` se PRERRENDERIZA en el build,
// y su HTML salía de fábrica con el botón «Crear cuenta» dentro. Medido en la
// imagen de F2.5: `.next/server/app/login.html`, 15 234 bytes, con el botón
// horneado, mientras el servidor —que sí lee la variable en cada petición—
// contestaba 503 al pulsarlo. Un botón que existe para dar un error.
//
// La vía alternativa —pasar el valor por props desde el layout— habría caído en
// la misma trampa por ser el mismo render de build. Se resuelve preguntando,
// porque preguntar ocurre en el navegador y por tanto DESPUÉS de arrancar.
//
// No revela nada: que exista el botón ya diría lo mismo.
export async function GET() {
  return NextResponse.json(
    { google: googleHabilitado(), autoregistro: autoregistroActivo() },
    // Sin caché: si se apaga la función, la siguiente carga del login tiene que
    // enterarse. Una respuesta cacheada mantendría el botón vivo apuntando a un
    // endpoint que ya responde 503.
    { headers: { 'cache-control': 'no-store' } },
  )
}

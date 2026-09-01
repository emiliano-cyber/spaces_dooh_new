import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  La imagen tiene que poder PUBLICAR A PANTALLAS.
// ----------------------------------------------------------------------------
//  Auditoria del 2026-09-01. `lib/server/doohmain.ts:165` publica invocando
//  `python -m doohmain_sdk publish` por subproceso, con `cwd = DOOHMAIN_SDK_DIR`.
//  Y el `Dockerfile` no llevaba NI el interprete NI el paquete: instalaba
//  unicamente `libc6-compat` y copiaba el standalone, los estaticos, `public/`
//  y las migraciones. Una instancia aprovisionada habria fallado en `execFile`
//  con ENOENT en la primera campana que intentara publicar.
//
//  Estas pruebas leen el Dockerfile porque es el unico sitio donde consta lo que
//  la imagen lleva dentro. No sustituyen a construirla -- eso lo hace
//  `release.yml` --, pero atrapan el olvido en `npm test`, que es donde sale
//  barato.
// ============================================================================

const RAIZ = join(__dirname, '..', '..', '..')
const DOCKERFILE = readFileSync(join(RAIZ, 'Dockerfile'), 'utf8')

describe('la imagen puede publicar a pantallas', () => {
  it('lleva un interprete de Python', () => {
    expect(DOCKERFILE).toMatch(/apk add[^\n]*python3/)
  })

  it('lleva el paquete `doohmain_sdk`, que es lo que se invoca con `-m`', () => {
    expect(DOCKERFILE).toMatch(/COPY[^\n]*doohmain_sdk/)
  })

  it('instala las dependencias SOLO desde ruedas, para que un build nunca compile', () => {
    // Medido el 2026-09-01 sobre `node:20-alpine`: psycopg[binary] 3.2.3 SI
    // tiene rueda musllinux y no hace falta cadena de compilacion. `--only-binary`
    // convierte eso en un contrato: el dia que una version deje de publicar
    // rueda, el build FALLA en vez de arrastrar gcc a la imagen en silencio.
    expect(DOCKERFILE).toMatch(/--only-binary/)
  })

  it('declara las dos rutas que el handler de Node necesita para encontrarlo', () => {
    // `doohmain.ts:24-25` cae en `python` y `process.cwd()` si faltan, y las dos
    // omisiones son falsas dentro de la imagen.
    expect(DOCKERFILE).toMatch(/ENV DOOHMAIN_PY=/)
    expect(DOCKERFILE).toMatch(/ENV DOOHMAIN_SDK_DIR=/)
  })
})

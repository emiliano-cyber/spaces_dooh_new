import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { autoregistroActivo, nombreDeMarca, MARCA_POR_OMISION } from './entorno'

// ============================================================================
//  Banderas del entorno que se deciden AL ARRANCAR, no al compilar.
// ----------------------------------------------------------------------------
//  Que este fichero pueda existir es el punto entero de F2.6. Con la bandera
//  vieja (`NEXT_PUBLIC_AUTOREGISTRO`) esta prueba era IMPOSIBLE de escribir:
//  Next inlinea las variables con prefijo NEXT_PUBLIC_ en tiempo de build, así
//  que cambiar `process.env` entre dos llamadas no cambiaba nada — el valor ya
//  no se leía de `process.env`, estaba escrito en el bundle.
// ============================================================================

const original = process.env.AUTOREGISTRO

afterEach(() => {
  if (original === undefined) delete process.env.AUTOREGISTRO
  else process.env.AUTOREGISTRO = original
})

describe('autoregistroActivo', () => {
  it('cambia de valor entre llamadas, sin recompilar', () => {
    // Las dos afirmaciones van en el MISMO caso a propósito: lo que se prueba
    // no es cada valor por separado, sino que el segundo cambio surta efecto.
    process.env.AUTOREGISTRO = '1'
    expect(autoregistroActivo()).toBe(true)

    process.env.AUTOREGISTRO = '0'
    expect(autoregistroActivo()).toBe(false)
  })

  it('sin la variable definida, viene APAGADO', () => {
    // Fail-closed, y es una inversión deliberada respecto al comportamiento
    // anterior (`!== '0'`, o sea encendido si faltaba). Una instancia cuyo
    // `.env` se quedó corto no abre el registro público por descuido.
    delete process.env.AUTOREGISTRO
    expect(autoregistroActivo()).toBe(false)
  })
})

// ============================================================================
//  UI-01 — el nombre de marca de la instancia.
// ----------------------------------------------------------------------------
//  Hallazgo de la auditoría del 2026-08-26: el `<title>` decía «Spaces — Demo»
//  en producción, y se ve tanto en la pestaña del navegador como en la liga
//  pública que el owner manda a su cliente.
//
//  Se resuelve como `AUTOREGISTRO` y por la misma razón: el artefacto es
//  idéntico para toda la flota (invariante 3), así que la marca se lee AL
//  ARRANCAR y no se hornea. Sin prefijo `NEXT_PUBLIC_`, que es precisamente lo
//  que la hornearía.
// ============================================================================

const marcaOriginal = process.env.ORG_NOMBRE

afterEach(() => {
  if (marcaOriginal === undefined) delete process.env.ORG_NOMBRE
  else process.env.ORG_NOMBRE = marcaOriginal
})

describe('nombreDeMarca', () => {
  it('cambia de valor entre llamadas, sin recompilar', () => {
    // Las dos afirmaciones en el MISMO caso, igual que en `autoregistroActivo`:
    // lo que se prueba no es cada valor, es que el segundo cambio surta efecto.
    process.env.ORG_NOMBRE = 'Publicidad del Norte'
    expect(nombreDeMarca()).toBe('Publicidad del Norte')

    process.env.ORG_NOMBRE = 'Medios del Bajio'
    expect(nombreDeMarca()).toBe('Medios del Bajio')
  })

  it('sin la variable, cae al nombre del producto y NUNCA a «Demo»', () => {
    // Fail-safe, no fail-closed: una instancia sin `ORG_NOMBRE` tiene que
    // seguir teniendo un título correcto. Lo que no puede volver es la palabra
    // que la auditoría encontró en producción.
    delete process.env.ORG_NOMBRE
    expect(nombreDeMarca()).toBe(MARCA_POR_OMISION)
    expect(MARCA_POR_OMISION).not.toMatch(/demo/i)
  })

  it('una variable vacía o en blanco cuenta como ausente', () => {
    // Un `.env` escrito a mano con `ORG_NOMBRE=` es lo normal en una flota que
    // se aprovisiona copiando plantillas. Sin este recorte, el título de esa
    // instancia sería la cadena vacía: una pestaña sin nombre.
    process.env.ORG_NOMBRE = ''
    expect(nombreDeMarca()).toBe(MARCA_POR_OMISION)
    process.env.ORG_NOMBRE = '   '
    expect(nombreDeMarca()).toBe(MARCA_POR_OMISION)
  })
})

// ============================================================================
//  SEC-04 — HSTS la emite nginx, no la aplicación.
// ----------------------------------------------------------------------------
//  `next.config.mjs` tiene una rama `HSTS=1`, pero `headers()` de Next se
//  evalúa en el BUILD y se congela en `.next/routes-manifest.json` (medido el
//  2026-08-26: el manifiesto del build vigente traía tres cabeceras y ninguna
//  de HSTS). O sea que esa bandera es de build, no de arranque, y en la flota
//  no la enciende nadie.
//
//  Quien sí la emite en cada instancia es nginx. Esta prueba existe porque al
//  añadir las cabeceras nuevas de SEC-04 era fácil dar por hecho que HSTS ya
//  venía de la aplicación y quitarla de la plantilla.
// ============================================================================

describe('SEC-04 · infra/nginx/instancia.conf.tpl', () => {
  it('sigue emitiendo HSTS con `always`', () => {
    const tpl = readFileSync(
      join(__dirname, '..', '..', '..', 'infra', 'nginx', 'instancia.conf.tpl'),
      'utf8',
    )
    const activas = tpl
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('#'))
      .join('\n')
    // `always` no es decorativo: sin él nginx omite la cabecera en las
    // respuestas de error (4xx/5xx), que son justo las que se sirven cuando
    // algo va mal y alguien está mirando.
    expect(activas).toMatch(/add_header\s+Strict-Transport-Security\s+"max-age=\d+[^"]*"\s+always;/)
  })
})

// ============================================================================
//  La PLANTILLA de entorno del repo (F0.3).
// ----------------------------------------------------------------------------
//  `autoregistroActivo()` es fail-closed, pero eso solo protege a quien NO
//  declara la variable. Quien levanta el proyecto copiando `.env.example` se
//  lleva lo que la plantilla diga, y hasta hoy nada vigilaba ese valor: el
//  14/08 se bajó a `=0` por decisión de Jochelo (`0dbccb8`) y devolverlo a `=1`
//  habría dejado la suite en verde y al CI mudo. Esta es la mitad de F0.3 que
//  faltaba: «que una prueba impida volver atrás».
//
//  La ruta se resuelve desde `__dirname` y NO desde el directorio de trabajo:
//  vitest se invoca desde `apps/web`, pero un `npx vitest` lanzado desde la
//  raíz encontraría el archivo igual. `lib` → `apps/web` → `apps` → raíz.
// ============================================================================

const PLANTILLA = readFileSync(join(__dirname, '..', '..', '..', '.env.example'), 'utf8')

describe('.env.example', () => {
  it('la plantilla de entorno nace con el autoregistro apagado', () => {
    // Se exige el valor EXPLÍCITO `=0`, no solo la ausencia de `=1`: la
    // plantilla es además el sitio donde se documenta la decisión, y una
    // variable ausente no la documenta.
    expect(PLANTILLA).toMatch(/^AUTOREGISTRO=0$/m)
  })

  it('la plantilla no propone un dominio de cookie', () => {
    // Invariante 4 del modelo de instancias: las cookies son host-only. Un
    // `COOKIE_DOMAIN` con valor en la plantilla invita a compartir sesión
    // entre dominios, que es justo lo que el modelo por instancia prohíbe —
    // y encima ningún archivo de `apps/` lo lee, así que sería una promesa
    // que nada cumple.
    expect(PLANTILLA).not.toMatch(/^COOKIE_DOMAIN=.+$/m)
  })
})

// ============================================================================
//  La plantilla de PRODUCCIÓN (T-03).
// ----------------------------------------------------------------------------
//  F0.3 puso bajo llave `.env.example`, pero esa no es la plantilla que se
//  copia para montar una instancia real: esa es `.env.production.example`, y
//  quedó fuera del candado con los dos mismos problemas.
//
//  El de la cookie era el grave. Declaraba
//  `COOKIE_DOMAIN=.{TENANT_SLUG}.spaces.com`, una cookie comodín de segundo
//  nivel del modelo de subdominios por tenant, muerto desde el 2026-08-12.
//  Hoy es inocuo —`apps/web` no lee la variable— pero es LATENTE: el código
//  que sí la consume sigue en el repo
//  (`_archive/api/src/core/auth/auth.routes.ts:17` hace
//  `domain: process.env.COOKIE_DOMAIN`), así que el día que alguien haga
//  configurable el `domain` de `cookieSesion()`, todos los `.env` nacidos de
//  esta plantilla comparten sesión por `*.spaces.com`: fuga entre instancias
//  soberanas, y del tipo que no da error.
// ============================================================================

// A diferencia de la constante de arriba, la plantilla se lee DENTRO de cada
// caso. Si el archivo desapareciera, debe caer el caso que lo mira y solo ese:
// leerlo al cargar el módulo convierte un archivo ausente en un error de
// importación que tumba también los casos de `autoregistroActivo()`, que no
// tienen nada que ver con las plantillas.
function plantillaProduccion(): string {
  return readFileSync(join(__dirname, '..', '..', '..', '.env.production.example'), 'utf8')
}

describe('.env.production.example', () => {
  it('la plantilla de produccion no propone un dominio de cookie', () => {
    // Invariante 4 del plan v3 (`docs/Plan_Instancias_Soberanas_v3.md:219`):
    // «las cookies siguen sin `domain`». `cookieSesion()`
    // (`lib/server/auth.ts:191-201`) y `cookieCsrf()` (`:216-226`) no lo fijan,
    // y la plantilla que lee el operador no puede decir lo contrario.
    expect(plantillaProduccion()).not.toMatch(/^COOKIE_DOMAIN=.+$/m)
  })

  it('la plantilla de produccion nace con el autoregistro apagado', () => {
    // El mismo candado que F0.3 puso en la plantilla de desarrollo: se exige
    // el valor EXPLÍCITO `=0` y no la mera ausencia, porque la plantilla es
    // además donde se documenta la decisión del 14/08 (cerrado en TODA la
    // flota) y una variable ausente no la documenta.
    expect(plantillaProduccion()).toMatch(/^AUTOREGISTRO=0$/m)
  })
})

// ============================================================================
//  F5.3 — las plantillas de una instancia de owner.
// ----------------------------------------------------------------------------
//  El objetivo de la tarea es que lo ÚNICO distinto entre dos instancias esté
//  en estos archivos y nunca en el código. Estas pruebas son el candado.
//
//  ─── Por qué DOS plantillas y no una ──────────────────────────────────────
//  `infra/scripts/update.sh`, que ya existe (F3.4), lee su propia configuración
//  de `/etc/space-os/instancia.env` (`:306`) y la de la aplicación de un archivo
//  APARTE, `/etc/space-os/app.env` (`:527`). Una sola plantilla obligaría a que
//  el actualizador cargase en su shell las credenciales de la base y los
//  secretos de correo, que no necesita para nada.
// ============================================================================

function plantilla(nombre: string): string {
  return readFileSync(join(__dirname, '..', '..', '..', 'infra', 'env', nombre), 'utf8')
}

/** Quita los comentarios: lo que se afirma es sobre los VALORES, no sobre el texto. */
function soloValores(texto: string): string {
  return texto
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('#'))
    .join('\n')
}

describe('F5.3 · infra/env/app.env.example', () => {
  it('nace con el autoregistro apagado, y con la bandera VIVA', () => {
    // `AUTOREGISTRO`, sin el prefijo `NEXT_PUBLIC_`. Se exige el valor
    // explícito `=0` y no la ausencia, igual que en las otras dos plantillas.
    expect(plantilla('app.env.example')).toMatch(/^AUTOREGISTRO=0$/m)
  })

  it('NO resucita `NEXT_PUBLIC_AUTOREGISTRO`, que F2.6 mató', () => {
    // La especificación de F5.3 pedía esta variable, y es un desfase suyo: el
    // 2026-08-14 la bandera salió del build precisamente porque con el prefijo
    // `NEXT_PUBLIC_` Next la inlinea al compilar y una instancia no puede
    // cambiarla en su `.env` (ver la cabecera de este archivo). Escribirla en
    // la plantilla de CADA instancia la traería de vuelta.
    expect(plantilla('app.env.example')).not.toMatch(/NEXT_PUBLIC_AUTOREGISTRO/)
  })

  it('no propone un dominio de cookie', () => {
    // Invariante 4 del plan v3: las cookies siguen sin `domain`.
    expect(soloValores(plantilla('app.env.example'))).not.toMatch(/COOKIE_DOMAIN/)
  })

  it('no trae variables que el producto vivo no lee', () => {
    // `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_TENANT_SLUG` YA NO EXISTEN en
    // `apps/web`: sobrevivían en `app/_legacy/` y en `lib/api-client.ts`, y los
    // dos se retiraron el 2026-08-27 con el resto de la pista archivada. Que no
    // estén en la plantilla lo sigue afirmando esta prueba; que no vuelvan al
    // código lo afirma `lib/pista-archivada.test.ts`.
    // `JWT_SECRET` y `REDIS_URL` no las lee nadie.
    const v = soloValores(plantilla('app.env.example'))
    for (const muerta of ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_TENANT_SLUG', 'JWT_SECRET', 'REDIS_URL']) {
      expect(v).not.toMatch(new RegExp(muerta))
    }
  })

  it('trae lo que la aplicacion SI lee para arrancar', () => {
    const v = soloValores(plantilla('app.env.example'))
    for (const viva of ['APP_URL', 'DATABASE_URL', 'COOKIE_SECURE', 'BOOTSTRAP_TOKEN']) {
      expect(v).toMatch(new RegExp(`^${viva}=`, 'm'))
    }
  })
})

describe('F5.3 · infra/env/instancia.env.example', () => {
  it('trae lo que `update.sh` lee, y el canal estable por defecto', () => {
    const v = soloValores(plantilla('instancia.env.example'))
    expect(v).toMatch(/^CANAL=estable$/m)
    for (const clave of ['REGISTRY', 'ENV_APP', 'SALUD_URL']) {
      expect(v).toMatch(new RegExp(`^${clave}=`, 'm'))
    }
  })

  it('no lleva los secretos que solo la aplicacion necesita', () => {
    // OJO con lo que NO se afirma aqui: `instancia.env` SI lleva un
    // `DATABASE_URL`, y es correcto -- es el PRIVILEGIADO, el de migraciones y
    // respaldo, distinto del rol `spaces_app` que usa la aplicacion
    // (`infra/scripts/update.sh:79-85`). Son dos conexiones con dos roles.
    //
    // Lo que no tiene que estar aqui es lo que solo sirve dentro de la app.
    const v = soloValores(plantilla('instancia.env.example'))
    for (const secreto of ['RESEND_API_KEY', 'GOOGLE_CLIENT_SECRET', 'BOOTSTRAP_TOKEN', 'AUTOREGISTRO']) {
      expect(v).not.toMatch(new RegExp(secreto))
    }
  })
})

describe('F5.3 · ninguna plantilla lleva un valor real quemado', () => {
  // Criterio de aceptación de la tarea, y ademas la regla de `CLAUDE.md`: ni
  // dominios, ni IPs, ni tokens, ni el nombre del registry. Van como parámetro.
  it('ni dominios ni IPs fuera de los comentarios', () => {
    const archivos = ['app.env.example', 'instancia.env.example']
    for (const a of archivos) {
      const v = soloValores(plantilla(a))
      expect(v, `${a} tiene un dominio real`).not.toMatch(/space-os\.io/)
      // El loopback se permite, y hace falta: `SALUD_URL` apunta a
      // `127.0.0.1:3000` porque la comprobación de salud la hace la propia
      // máquina contra su propio proceso (`update.sh:100`). Lo que no puede
      // aparecer es una IP ENCAMINABLE — eso sería un servidor concreto quemado.
      const sinLoopback = v.replace(/127\.0\.0\.1/g, '')
      expect(sinLoopback, `${a} tiene una IP`).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/)
    }
  })

  it('la plantilla de nginx usa `__DOMINIO__` y no un dominio real', () => {
    const tpl = readFileSync(
      join(__dirname, '..', '..', '..', 'infra', 'nginx', 'instancia.conf.tpl'),
      'utf8',
    )
    const v = tpl
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('#'))
      .join('\n')
    expect(v).toMatch(/__DOMINIO__/)
    expect(v).not.toMatch(/space-os\.io/)

    // Los cuatro detalles que el plan manda conservar LITERALMENTE, cada uno
    // porque su ausencia ya costo algo:
    //  - `X-Forwarded-For $remote_addr` REEMPLAZA la cabecera del cliente; sin
    //    eso, cualquiera elige su cubo del limitador de login.
    //  - `client_max_body_size 12M`: la subida de material.
    //  - `location = /` al login y el catch-all.
    expect(v).toMatch(/X-Forwarded-For\s+\$remote_addr/)
    expect(v).toMatch(/client_max_body_size\s+12M/)
    expect(v).toMatch(/location\s*=\s*\/\s*\{/)
  })
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { arrancarServidor, pararServidor, BASE } from './servidor-e2e'

// ============================================================================
//  SEC-04 / UI-01 — las cabeceras y la marca, leídas de una respuesta REAL.
// ----------------------------------------------------------------------------
//  Auditoría externa del 2026-08-26. Dos hallazgos que se arreglan juntos
//  porque los dos viven en `next.config.mjs` y en el layout de `(app)`:
//
//    SEC-04 · no había `Content-Security-Policy` ni `Permissions-Policy`.
//    UI-01  · el `<title>` decía «Spaces — Demo», y eso se ve en la pestaña
//             del navegador Y en la liga pública que recibe el cliente del
//             owner. Con una instancia por owner, «Demo» es doblemente falso.
//
//  ─── Por qué e2e y no una prueba unitaria de `next.config.mjs` ────────────
//  Porque afirmar el OBJETO de configuración no prueba que la cabecera SALGA.
//  `headers()` de Next no se ejecuta en cada petición: Next lo evalúa en el
//  BUILD y congela el resultado en `.next/routes-manifest.json` — comprobado el
//  2026-08-26 leyendo ese archivo, que traía las tres cabeceras ya resueltas y
//  ninguna de HSTS. Una prueba que importara el config vería la intención; ésta
//  ve lo que recibe el navegador, que es lo único que la auditoría midió.
//
//  ─── Lo que esta prueba NO puede ver ──────────────────────────────────────
//  Si la CSP ROMPE la aplicación. Eso solo se ve con un navegador abierto y la
//  consola a la vista. Por eso la política se entrega en modo
//  `Content-Security-Policy-Report-Only`, y hay un caso más abajo que se cae si
//  alguien la pasa a modo bloqueante sin ese paso humano.
// ============================================================================

// El nombre de marca que la instancia declara en su `.env`. Se pone ANTES de
// arrancar el servidor porque `servidor-e2e.ts` hereda `process.env` al hacer
// el spawn (mismo patrón que `FLOTA_TOKEN` en `version.e2e.test.ts`).
const MARCA = 'Instancia de prueba SEC04'

beforeAll(async () => {
  process.env.ORG_NOMBRE = MARCA
  await arrancarServidor()
}, 120_000)

afterAll(async () => {
  await pararServidor()
  delete process.env.ORG_NOMBRE
})

/** Una página pública de verdad: no necesita sesión ni base de datos. */
async function pedirPagina(ruta = '/login/') {
  return fetch(`${BASE}${ruta}`, { redirect: 'manual' })
}

describe('SEC-04 · cabeceras de seguridad en la respuesta real', () => {
  it('las tres cabeceras que YA existían siguen saliendo', async () => {
    // Añadir una cabecera y tirar otra sin darse cuenta es el accidente típico
    // al tocar el bloque `headers()`. Este caso es el candado contra eso.
    //
    // HSTS NO está en esta lista, y no es un olvido: `next.config.mjs` solo la
    // emite con `HSTS=1`, y como `headers()` se congela en el build, esa
    // bandera es de BUILD y no de arranque. Quien la emite de verdad en la
    // flota es nginx (`infra/nginx/instancia.conf.tpl`, `add_header ... always`).
    // Que siga ahí lo vigila `lib/entorno.test.ts`.
    const r = await pedirPagina()
    expect(r.status).toBe(200)
    expect(r.headers.get('x-frame-options')).toBe('DENY')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(r.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
  })

  it('`Permissions-Policy` niega cámara, micrófono y pagos', async () => {
    const r = await pedirPagina()
    const pp = r.headers.get('permissions-policy') ?? ''
    expect(pp).toMatch(/camera=\(\)/)
    expect(pp).toMatch(/microphone=\(\)/)
    expect(pp).toMatch(/payment=\(\)/)
  })

  it('`Permissions-Policy` CONSERVA la geolocalización para el propio origen', async () => {
    // La auditoría pedía negar geolocalización «porque no rompe nada». Sí
    // rompe: `components/demo/MapView.tsx:158` monta un `GeolocateControl` de
    // MapLibre —el botón «mi ubicación»— y ese mapa está en cinco pantallas,
    // incluida la propuesta PÚBLICA (`app/(app)/p/[id]/page.tsx:262`).
    // `geolocation=()` lo dejaría muerto sin dar ningún error visible.
    //
    // `(self)` es el punto medio: nuestro origen puede pedirla, cualquier
    // iframe incrustado no.
    const r = await pedirPagina()
    const pp = r.headers.get('permissions-policy') ?? ''
    expect(pp).toMatch(/geolocation=\(self\)/)
    expect(pp).not.toMatch(/geolocation=\(\)/)
  })
})

describe('SEC-04 · la CSP se entrega en modo REPORTE, no bloqueante', () => {
  it('la página trae `Content-Security-Policy-Report-Only` y NO la bloqueante', async () => {
    // Las dos afirmaciones van juntas a propósito. La negativa sola pasaría hoy
    // por la razón equivocada —no hay ninguna CSP—, y un caso que pasa en rojo
    // no vale. La positiva es la que se cae hasta que la política existe.
    const r = await pedirPagina()
    const reporte = r.headers.get('content-security-policy-report-only')
    expect(reporte, 'falta la CSP en modo reporte').toBeTruthy()
    expect(
      r.headers.get('content-security-policy'),
      'la CSP está en modo BLOQUEANTE: eso lo decide una persona con el navegador abierto',
    ).toBeNull()
  })

  it('la política cierra lo que no cuesta nada cerrar', async () => {
    const csp = (await pedirPagina()).headers.get('content-security-policy-report-only') ?? ''
    // `frame-ancestors 'none'` dice lo mismo que `X-Frame-Options: DENY`, pero
    // en el estándar que los navegadores modernos sí respetan en todos los
    // casos (XFO no admite listas y varios motores ya lo ignoran).
    expect(csp).toMatch(/frame-ancestors 'none'/)
    expect(csp).toMatch(/object-src 'none'/)
    expect(csp).toMatch(/base-uri 'self'/)
    expect(csp).toMatch(/form-action 'self'/)
  })

  it('la política NO se aplica a `/api/`, que ya trae la suya', async () => {
    // `app/api/creativos/[id]/arte/route.ts:71`, `.../logo/[token]/route.ts:78`
    // y `.../contratos/[id]/documento/route.ts:62` emiten su PROPIA CSP
    // (`default-src 'none'; ...; sandbox`), que es mucho más estricta. Añadirles
    // encima una de reporte con `default-src 'self'` llenaría la consola de
    // violaciones falsas justo cuando una persona la esté leyendo para decidir
    // si la política se puede activar. Se excluye la rama `/api/`.
    const pagina = await pedirPagina()
    expect(pagina.headers.get('content-security-policy-report-only')).toBeTruthy()

    const api = await fetch(`${BASE}/api/auth/metodos/`)
    expect(api.status).toBe(200)
    expect(api.headers.get('content-security-policy-report-only')).toBeNull()
  })
})

// ============================================================================
//  UI-01 · el título de la pestaña.
// ----------------------------------------------------------------------------
//  Hay DOS clases de ruta y se comportan distinto. No es un capricho de la
//  prueba: es lo que `next build` deja, medido el 2026-08-26.
//
//    ○ estáticas (22)  · /login, /inicio, /propuestas, … Next las prerenderiza
//                        y el `<title>` queda ESCRITO en `.next/server/app/
//                        *.html`. `generateMetadata()` corrió en el build.
//    ƒ por petición    · /p/[id] (la propuesta PÚBLICA), /portal/[token],
//                        /propuestas/[id], /recuperar/[token], /contrato/[id],
//                        /firmar/[token], /m/ot/[id], /operaciones/ot/[id].
//                        Aquí `generateMetadata()` corre en cada petición y
//                        `ORG_NOMBRE` sí manda.
//
//  Los dos casos de abajo fijan esa frontera para que nadie la descubra en
//  producción. El hallazgo de la auditoría —la palabra «Demo»— se arregla en
//  las dos, porque el valor de omisión ya no la lleva.
// ============================================================================
describe('UI-01 · el título de la pestaña', () => {
  async function tituloDe(ruta: string) {
    const r = await fetch(`${BASE}${ruta}`, { redirect: 'manual' })
    expect(r.status, `${ruta} no respondió 200`).toBe(200)
    return (await r.text()).match(/<title>([^<]*)<\/title>/)?.[1] ?? ''
  }

  it('no dice «Demo» en NINGUNA de las dos clases de ruta', async () => {
    // Lo que la auditoría midió: la pestaña del navegador y la liga pública que
    // recibe el cliente del owner decían «Spaces — Demo» en producción.
    for (const ruta of ['/login/', '/recuperar/token-de-prueba/']) {
      const titulo = await tituloDe(ruta)
      expect(titulo, `${ruta} no tiene <title>`).not.toBe('')
      expect(titulo, `${ruta} sigue diciendo Demo`).not.toMatch(/demo/i)
    }
  })

  it('en una ruta por petición, la marca sale del entorno de la instancia', async () => {
    // El artefacto es idéntico para toda la flota (invariante 3), así que la
    // marca no viaja dentro de él: se lee al arrancar, como `AUTOREGISTRO`.
    expect(await tituloDe('/recuperar/token-de-prueba/')).toBe(MARCA)
  })

  it('y en `/login`, que ANTES se prerenderizaba, tambien', async () => {
    // Este caso afirmaba lo contrario hasta el 2026-08-26: que en las 22 rutas
    // prerenderizadas ganaba el valor de omisión, porque el `<title>` se
    // escribía en el build. Se dejó escrito como limitación, con el aviso de
    // que caería el día que alguien sacara `(app)` del render estático.
    //
    // Ese día fue el mismo: `export const dynamic = 'force-dynamic'` en
    // `app/(app)/layout.tsx`. Ahora la marca de la instancia gana también aquí,
    // y el caso se invierte en vez de borrarse — así queda constancia de que el
    // cambio fue deliberado y de qué se ganó con él.
    expect(await tituloDe('/login/')).toBe(MARCA)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'

// ============================================================================
//  I18N-04 · LA PANTALLA DE ENTRAR, RENDIDA DE VERDAD EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  Las otras pruebas de i18n miran datos: que las claves cuadren, que el dinero
//  no se mueva. Esta mira el RESULTADO: se monta el componente real de
//  `app/(app)/login/page.tsx` dentro del proveedor, se rinde a HTML, y se
//  comprueba que el texto sale en el idioma que toca.
//
//  Es la unica prueba de este lote que podia haber cazado un `t()` olvidado en
//  medio del JSX, y de hecho es la que justifica decir que la pantalla «esta
//  traducida» en vez de «tiene las claves puestas».
//
//  ─── LO QUE ESTA PRUEBA NO PUEDE VER, DICHO SIN ADORNOS ────────────────────
//
//  `renderToStaticMarkup` corre en node a pelo, SIN DOM: no ejecuta los
//  `useEffect`, no hidrata, no hace clic. O sea que esto demuestra que el
//  SERVIDOR emite el idioma correcto —que es justamente el mecanismo
//  antiparpadeo— y NO demuestra que el selector funcione al pulsarlo, ni que la
//  cookie viaje, ni que `router.refresh()` repinte. Eso solo lo ve un navegador
//  o una e2e, y esta dicho en el informe.
//
//  El repositorio ya usa este patron a proposito (`vitest.config.ts` lo explica:
//  `oxc.jsx` esta para poder importar un `.tsx` desde una prueba `.ts`).
// ============================================================================

// El componente usa `useRouter` y `fetch`. Ninguno de los dos existe fuera de
// Next, y ninguno hace falta para lo que aqui se mide: el primer render.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/login',
}))

// `next/font/google` NO es una libreria normal: es una transformacion del
// BUILD de Next, que descarga los archivos y devuelve las clases. Fuera de
// `next build` no existe, asi que se sustituye por lo unico que el layout le
// pide: un objeto con `variable`. La tipografia no es lo que aqui se mide.
vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: '--font-inter' }),
  Source_Serif_4: () => ({ variable: '--font-source-serif' }),
}))

// `next/headers` solo existe dentro de una peticion. Se simula para poder
// rendir el layout RAIZ, que es quien decide el idioma.
const cabeceras = { cookie: null as string | null, accept: null as string | null }
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (n: string) =>
      n === 'spaces_idioma' && cabeceras.cookie ? { value: cabeceras.cookie } : undefined,
  }),
  headers: () => ({
    get: (n: string) => (n === 'accept-language' ? cabeceras.accept : null),
  }),
}))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

async function pintarLogin(idioma: Idioma): Promise<string> {
  const { default: LoginPage } = await import('../../app/(app)/login/page')
  // Los hijos van como TERCER argumento de `createElement`, no como propiedad
  // `children`. Las dos formas rinden igual, pero `next lint` rechaza la
  // segunda (`react/no-children-prop`) y el build de Next corre el linter: con
  // la otra forma, esta prueba pasaba en verde y TUMBABA `npm run build`.
  return renderToStaticMarkup(
    createElement(ProveedorIdioma, { idioma }, createElement(LoginPage)),
  )
}

describe('la pantalla de entrar, en ESPANOL', () => {
  it('pinta el formulario en espanol', async () => {
    const html = await pintarLogin('es')
    expect(html).toContain('Iniciar sesión')
    expect(html).toContain('Accede con tu cuenta.')
    expect(html).toContain('Correo')
    expect(html).toContain('Contraseña')
    expect(html).toContain('Entrar')
    expect(html).toContain('¿Olvidaste tu contraseña?')
    expect(html).toContain('Gestión de espacios publicitarios')
  })

  it('NO se le cuela ni una palabra de la version inglesa', async () => {
    // El caso negativo. Sin esto, un componente que pintara los dos idiomas a
    // la vez pasaria la prueba de arriba tan tranquilo.
    const html = await pintarLogin('es')
    expect(html).not.toContain('Sign in with your account')
    expect(html).not.toContain('Forgot your password')
    expect(html).not.toContain('Advertising space management')
  })
})

describe('la pantalla de entrar, en INGLES', () => {
  it('pinta el formulario en ingles', async () => {
    const html = await pintarLogin('en')
    expect(html).toContain('Sign in')
    expect(html).toContain('Sign in with your account.')
    expect(html).toContain('Email')
    expect(html).toContain('Password')
    expect(html).toContain('Forgot your password?')
    expect(html).toContain('Advertising space management')
  })

  it('NO QUEDA NI UNA FRASE EN ESPANOL, que es lo que de verdad se pide', async () => {
    // El caso negativo de los dos, y el que da sentido a la entrega: media
    // pantalla traducida es peor que ninguna, porque quien la lee deja de saber
    // que esperar.
    const html = await pintarLogin('en')
    for (const frase of [
      'Iniciar sesión',
      'Accede con tu cuenta',
      'Contraseña',
      '¿Olvidaste tu contraseña?',
      'Gestión de espacios publicitarios',
      'Crear cuenta',
      'Recuperar contraseña',
    ]) {
      expect(html).not.toContain(frase)
    }
  })

  it('la marca NO se traduce', async () => {
    // «Space OS» es un nombre propio. Traducir una marca es el error simetrico
    // de no traducir la interfaz, y se ve igual de mal.
    const html = await pintarLogin('en')
    expect(html).toContain('Space OS')
  })

  it('el selector de idioma esta en la pantalla, con los dos idiomas', async () => {
    const html = await pintarLogin('en')
    // Cada idioma se nombra en si mismo: quien no entienda la pantalla en la
    // que esta tiene que poder reconocer el suyo.
    expect(html).toContain('Español')
    expect(html).toContain('English')
    // Y el vigente viene ya seleccionado desde el servidor.
    expect(html).toMatch(/<select[^>]*>[\s\S]*?<option[^>]*value="en"[^>]*selected/)
  })

  it('el idioma seleccionado en el HTML del servidor es el pedido, no el de omision', async () => {
    // ESTA es la prueba del mecanismo antiparpadeo: el marcado que sale del
    // servidor YA trae el ingles elegido. Si hubiera que corregirlo en el
    // cliente, aqui saldria `es` seleccionado.
    const html = await pintarLogin('es')
    expect(html).toMatch(/<option[^>]*value="es"[^>]*selected/)
  })
})

describe('el mismo componente, los dos idiomas, sin mezclarse', () => {
  it('los dos HTML son distintos y cada uno es coherente', async () => {
    const es = await pintarLogin('es')
    const en = await pintarLogin('en')
    expect(es).not.toBe(en)
    // Ninguno contiene el titulo del otro.
    expect(es).not.toContain('Sign in with your account.')
    expect(en).not.toContain('Accede con tu cuenta.')
  })
})

// ─── EL MENU LATERAL ────────────────────────────────────────────────────────
//
// Sale en TODAS las pantallas internas, asi que traducirlo vale por mas que
// cualquier pantalla suelta. Se rinde igual que el login.
//
// Esta prueba se escribio porque el arnes tenia un agujero concreto: la de
// `diccionario.test.ts` comprueba que las 26 entradas del NAV tengan texto en
// los dos idiomas, pero NO que `Sidebar.tsx` los use. Un `Sidebar` que
// ignorara el diccionario y pintara siempre el `label` espanol pasaba aquella
// prueba tan tranquilo. Lo confirmo el mutante M13.
async function pintarSidebar(idioma: Idioma): Promise<string> {
  const { Sidebar } = await import('../../components/demo/shell/Sidebar')
  const { MenuMovilProvider } = await import('../../components/demo/shell/MenuMovilContext')
  return renderToStaticMarkup(
    createElement(
      ProveedorIdioma,
      { idioma },
      createElement(MenuMovilProvider, null, createElement(Sidebar)),
    ),
  )
}

describe('el menu lateral, en los dos idiomas', () => {
  it('en espanol pinta los rotulos de siempre', async () => {
    const html = await pintarSidebar('es')
    expect(html).toContain('Inventario')
    expect(html).toContain('Arrendadores')
    expect(html).toContain('Campañas')
    expect(html).toContain('Consumo de luz')
    expect(html).toContain('Razones sociales')
    expect(html).toContain('Derechos reservados')
  })

  it('en ingles pinta las entradas traducidas', async () => {
    const html = await pintarSidebar('en')
    expect(html).toContain('Landlords')
    expect(html).toContain('Campaigns')
    expect(html).toContain('Power usage')
    expect(html).toContain('Legal entities')
    expect(html).toContain('Volume discounts')
    expect(html).toContain('All rights reserved')
  })

  it('en ingles los ENCABEZADOS de grupo tambien estan traducidos', async () => {
    // Los cinco titulos de fase. Es donde mas facil se olvida uno, porque no
    // son entradas del NAV sino su agrupacion.
    const html = await pintarSidebar('en')
    for (const titulo of ['Inventory', 'Sales', 'Operations', 'Finance', 'System']) {
      expect(html).toContain(titulo)
    }
  })

  it('NO QUEDA NI UN ROTULO EN ESPANOL en el menu en ingles', async () => {
    // El caso negativo, y el que mata al mutante M13. Un menu medio traducido
    // es peor que uno sin traducir: quien lo lee deja de saber que esperar.
    const html = await pintarSidebar('en')
    for (const rotulo of [
      'Arrendadores',
      'Campañas',
      'Consumo de luz',
      'Razones sociales',
      'Descuentos por volumen',
      'Paquetes cerrados',
      'Almacén',
      'Captación',
      'Administración',
      'Derechos reservados',
      'Expandir menú',
      'Colapsar menú',
    ]) {
      expect(html).not.toContain(rotulo)
    }
  })

  it('«Network» y «Dashboard» siguen igual en los dos, y es a proposito', async () => {
    // Ya son las palabras inglesas y asi se llaman los modulos. Traducir
    // «Network» a «Red» en espanol seria inventar un nombre que nadie usa.
    for (const idioma of ['es', 'en'] as const) {
      const html = await pintarSidebar(idioma)
      expect(html).toContain('Network')
      expect(html).toContain('Dashboard')
    }
  })
})

// ─── EL LAYOUT RAIZ: DONDE SE DECIDE, Y EL `lang` DEL <html> ────────────────
//
// Este bloque tambien nacio de un mutante que SOBREVIVIO: dejar `lang="es"`
// fijo no rompia ninguna prueba. Y no es cosmetica — `lang` es lo que usan los
// lectores de pantalla para elegir voz y el navegador para ofrecer traduccion.
// Con `lang="es"` y el texto en ingles, la pagina AFIRMA algo falso.
async function pintarRaiz(cookie: string | null, accept: string | null): Promise<string> {
  cabeceras.cookie = cookie
  cabeceras.accept = accept
  const { default: RootLayout } = await import('../../app/layout')
  // Se INVOCA como funcion en vez de pasar por `createElement`, y hay dos
  // razones: es literalmente una funcion que devuelve JSX (un Server
  // Component), y `createElement(RootLayout, { children: null })` dispara
  // `react/no-children-prop` en `next lint` — que corre dentro de
  // `npm run build`, asi que la prueba pasaba en verde y tumbaba el build.
  return renderToStaticMarkup(RootLayout({ children: null }))
}

describe('el layout raiz decide el idioma y lo DECLARA en el <html>', () => {
  it('con el navegador en ingles, lang="en"', async () => {
    expect(await pintarRaiz(null, 'en-US,en;q=0.9')).toMatch(/<html[^>]*lang="en"/)
  })

  it('con el navegador en espanol, lang="es"', async () => {
    expect(await pintarRaiz(null, 'es-MX,es;q=0.9')).toMatch(/<html[^>]*lang="es"/)
  })

  it('sin ninguna senal, lang="es"', async () => {
    expect(await pintarRaiz(null, null)).toMatch(/<html[^>]*lang="es"/)
  })

  it('LA COOKIE MANDA sobre el navegador, tambien aqui', async () => {
    // Es la regla de precedencia comprobada de punta a punta: desde lo que
    // llega en la peticion hasta el atributo que sale en el HTML.
    expect(await pintarRaiz('es', 'en-US,en;q=0.9')).toMatch(/<html[^>]*lang="es"/)
    expect(await pintarRaiz('en', 'es-MX,es;q=0.9')).toMatch(/<html[^>]*lang="en"/)
  })

  it('una cookie con basura no secuestra el idioma', async () => {
    expect(await pintarRaiz('fr', 'en-US')).toMatch(/<html[^>]*lang="en"/)
  })
})

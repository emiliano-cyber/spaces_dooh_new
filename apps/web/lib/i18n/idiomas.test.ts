import { describe, it, expect } from 'vitest'
import {
  IDIOMAS,
  IDIOMA_POR_OMISION,
  COOKIE_IDIOMA,
  COOKIE_IDIOMA_MAX_AGE,
  cadenaCookieIdioma,
  normalizarIdioma,
  idiomaDeCabecera,
  resolverIdioma,
} from './idiomas'

// ============================================================================
//  I18N-01 · La eleccion del idioma, probada por separado del framework.
// ----------------------------------------------------------------------------
//  Todo lo de este archivo es PURO: entra texto (una cookie, una cabecera) y
//  sale un idioma. Ni Next, ni React, ni peticion. Es a proposito -- la regla
//  de precedencia es lo unico que de verdad hay que acertar, y una funcion pura
//  se puede mutar y medir.
// ============================================================================

describe('IDIOMAS · el catalogo', () => {
  it('son exactamente dos, y el de omision es el espanol', () => {
    expect(IDIOMAS).toEqual(['es', 'en'])
    expect(IDIOMA_POR_OMISION).toBe('es')
  })

  it('la cookie tiene el prefijo de las demas de la aplicacion', () => {
    // `spaces_sesion` y `spaces_csrf` ya viven con ese prefijo; una cookie
    // suelta llamada `idioma` seria la unica sin apellido.
    expect(COOKIE_IDIOMA).toBe('spaces_idioma')
  })
})

describe('normalizarIdioma', () => {
  it('acepta las dos etiquetas base', () => {
    expect(normalizarIdioma('es')).toBe('es')
    expect(normalizarIdioma('en')).toBe('en')
  })

  it('acepta una etiqueta regional y se queda con el idioma', () => {
    // Quien tenga el navegador en `es-MX`, `es-419` o `en-GB` no debe caerse al
    // idioma de omision por traer region.
    expect(normalizarIdioma('es-MX')).toBe('es')
    expect(normalizarIdioma('es-419')).toBe('es')
    expect(normalizarIdioma('en-US')).toBe('en')
    expect(normalizarIdioma('en-GB')).toBe('en')
  })

  it('no distingue mayusculas', () => {
    expect(normalizarIdioma('EN')).toBe('en')
    expect(normalizarIdioma('Es-Mx')).toBe('es')
  })

  it('ignora los espacios de alrededor', () => {
    expect(normalizarIdioma('  en  ')).toBe('en')
  })

  it('devuelve null para lo que no se habla, para el comodin y para la basura', () => {
    // `*` es valido en Accept-Language y significa «cualquiera»: no es una
    // eleccion, asi que aqui no decide nada.
    expect(normalizarIdioma('*')).toBeNull()
    expect(normalizarIdioma('fr')).toBeNull()
    expect(normalizarIdioma('pt-BR')).toBeNull()
    expect(normalizarIdioma('')).toBeNull()
    expect(normalizarIdioma(null)).toBeNull()
    expect(normalizarIdioma(undefined)).toBeNull()
  })

  it('no confunde un idioma que EMPIEZA igual con uno soportado', () => {
    // `esperanto` es `eo`, pero alguien podria mandar `español` o `este`.
    // Comparar por prefijo de texto en vez de por subetiqueta daria `es`.
    expect(normalizarIdioma('esperanto')).toBeNull()
    expect(normalizarIdioma('english')).toBeNull()
  })
})

describe('idiomaDeCabecera · Accept-Language', () => {
  it('toma el primero soportado cuando no hay calidades', () => {
    expect(idiomaDeCabecera('en-US,en;q=0.9')).toBe('en')
    expect(idiomaDeCabecera('es-MX,es')).toBe('es')
  })

  it('ordena por calidad y no por posicion', () => {
    // El navegador NO garantiza que la lista venga ordenada. Aqui el ingles va
    // primero en el texto y el espanol gana por `q`.
    expect(idiomaDeCabecera('en;q=0.3,es;q=0.9')).toBe('es')
    expect(idiomaDeCabecera('es;q=0.2,en;q=0.8')).toBe('en')
  })

  it('una entrada sin q vale 1 y le gana a una con q explicita menor', () => {
    expect(idiomaDeCabecera('en;q=0.9,es')).toBe('es')
  })

  it('a igual calidad manda el orden de aparicion', () => {
    expect(idiomaDeCabecera('en;q=0.8,es;q=0.8')).toBe('en')
    expect(idiomaDeCabecera('es;q=0.8,en;q=0.8')).toBe('es')
  })

  it('se salta los idiomas que no hablamos', () => {
    expect(idiomaDeCabecera('fr-FR,fr;q=0.9,de;q=0.8,en;q=0.7')).toBe('en')
  })

  it('descarta las entradas con q=0, que significan «este NO»', () => {
    // RFC 9110 §12.5.4: `q=0` es un rechazo explicito. Tratarlo como una
    // preferencia debil haria que pidiendo «ingles no» saliera ingles.
    expect(idiomaDeCabecera('en;q=0,es;q=0.1')).toBe('es')
    expect(idiomaDeCabecera('en;q=0')).toBeNull()
  })

  it('ignora el comodin', () => {
    expect(idiomaDeCabecera('*')).toBeNull()
    expect(idiomaDeCabecera('fr,*;q=0.5')).toBeNull()
  })

  it('devuelve null si la cabecera falta, esta vacia o es ilegible', () => {
    expect(idiomaDeCabecera(null)).toBeNull()
    expect(idiomaDeCabecera(undefined)).toBeNull()
    expect(idiomaDeCabecera('')).toBeNull()
    expect(idiomaDeCabecera('   ')).toBeNull()
    expect(idiomaDeCabecera(';;;,,,')).toBeNull()
  })

  it('una q mal escrita no tumba el analisis: esa entrada vale 1', () => {
    // Una cabecera rota es de quien llama, no nuestra. Lo que no puede pasar es
    // que reviente el render de la pagina.
    expect(idiomaDeCabecera('en;q=abc')).toBe('en')
    expect(idiomaDeCabecera('en;q=')).toBe('en')
  })

  it('aguanta espacios y mayusculas como los emiten los navegadores', () => {
    expect(idiomaDeCabecera('EN-US, en;Q=0.9')).toBe('en')
  })
})

describe('resolverIdioma · quien manda cuando las senales se contradicen', () => {
  it('la cookie gana a la cabecera, SIEMPRE', () => {
    // Es la regla entera en una linea: la cookie es una persona que eligio a
    // mano; la cabecera es una preferencia del sistema operativo que esa
    // persona quiza nunca configuro.
    expect(resolverIdioma({ cookie: 'es', cabecera: 'en-US,en;q=0.9' })).toBe('es')
    expect(resolverIdioma({ cookie: 'en', cabecera: 'es-MX,es;q=0.9' })).toBe('en')
  })

  it('sin cookie manda la cabecera', () => {
    expect(resolverIdioma({ cookie: null, cabecera: 'en-US,en;q=0.9' })).toBe('en')
    expect(resolverIdioma({ cookie: null, cabecera: 'es-MX' })).toBe('es')
  })

  it('una cookie con basura NO secuestra la decision: se cae a la cabecera', () => {
    // La cookie la puede escribir cualquiera desde la consola del navegador.
    // Un valor invalido tiene que comportarse como «no hay cookie», no como
    // «idioma de omision» -- si no, escribir `spaces_idioma=fr` apagaria la
    // deteccion de quien tiene el navegador en ingles.
    expect(resolverIdioma({ cookie: 'fr', cabecera: 'en-US' })).toBe('en')
    expect(resolverIdioma({ cookie: '', cabecera: 'en-US' })).toBe('en')
    expect(resolverIdioma({ cookie: '<script>', cabecera: 'en-US' })).toBe('en')
  })

  it('sin ninguna senal, espanol', () => {
    expect(resolverIdioma({})).toBe('es')
    expect(resolverIdioma({ cookie: null, cabecera: null })).toBe('es')
  })

  it('con una cabecera de un idioma que no hablamos, espanol', () => {
    // Y NO ingles: el espanol es el idioma original del producto y el que
    // seguro esta completo. Caer al ingles ante lo desconocido enseniaria la
    // mitad traducida a quien no pidio ninguno de los dos.
    expect(resolverIdioma({ cabecera: 'fr-FR,fr;q=0.9,de;q=0.8' })).toBe('es')
  })

  it('devuelve siempre uno de los idiomas del catalogo', () => {
    const casos = [
      {},
      { cookie: 'x' },
      { cabecera: 'zz' },
      { cookie: 'en' },
      { cabecera: 'es' },
      { cookie: 'fr', cabecera: 'de' },
    ]
    for (const c of casos) expect(IDIOMAS).toContain(resolverIdioma(c))
  })
})

// ─── LA COOKIE QUE GUARDA LA ELECCION ───────────────────────────────────────
//
// Este bloque existe por una razon concreta: el mutante que BORRABA la
// escritura de la cookie SOBREVIVIO a la primera medicion de I18N-01. No habia
// nada que la mirara, porque escribir en `document.cookie` es un efecto que sin
// DOM no se observa.
//
// El arreglo no fue añadir un DOM: fue sacar la CADENA a una funcion pura. Lo
// que se puede convertir en dato, se prueba.
describe('cadenaCookieIdioma', () => {
  it('lleva el nombre, el valor y el ambito de toda la aplicacion', () => {
    const c = cadenaCookieIdioma('en', false)
    expect(c).toContain(`${COOKIE_IDIOMA}=en`)
    // `path=/` y NO el basePath: `basePath` se antepone a las rutas, no al
    // ambito de una cookie. Con `path=/spaces-dooh` la eleccion no valdria
    // fuera de ahi.
    expect(c).toContain('path=/')
    expect(c).not.toContain('/spaces-dooh')
  })

  it('dura un ano: la eleccion de idioma no caduca sola', () => {
    expect(COOKIE_IDIOMA_MAX_AGE).toBe(60 * 60 * 24 * 365)
    expect(cadenaCookieIdioma('es', false)).toContain(`max-age=${COOKIE_IDIOMA_MAX_AGE}`)
  })

  it('es SameSite=Lax y NO httpOnly', () => {
    // No es httpOnly a proposito: la escribe el navegador y no es una
    // credencial. `httpOnly` solo se puede poner desde el servidor, asi que ni
    // siquiera seria posible aqui — pero conviene que este escrito.
    const c = cadenaCookieIdioma('es', true)
    expect(c).toContain('SameSite=Lax')
    expect(c).not.toContain('HttpOnly')
  })

  it('lleva Secure SOLO sobre HTTPS', () => {
    // Y este es el caso que importa: con `Secure` siempre, el navegador
    // DESCARTA la cookie en el `localhost` de desarrollo y el selector parece
    // roto sin dar ningun error.
    expect(cadenaCookieIdioma('en', true)).toContain('; Secure')
    expect(cadenaCookieIdioma('en', false)).not.toContain('Secure')
  })

  it('el valor que escribe es uno que `resolverIdioma` sabe volver a leer', () => {
    // El viaje completo, de ida y vuelta: lo que guarda el selector tiene que
    // ser exactamente lo que el servidor sepa interpretar. Si las dos mitades
    // se despegaran, elegir idioma dejaria de hacer nada.
    for (const idioma of IDIOMAS) {
      const cadena = cadenaCookieIdioma(idioma, false)
      const valor = /spaces_idioma=([^;]+)/.exec(cadena)?.[1] ?? ''
      expect(resolverIdioma({ cookie: valor, cabecera: 'fr-FR' })).toBe(idioma)
    }
  })
})

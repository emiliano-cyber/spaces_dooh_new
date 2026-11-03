import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  IDIOMA-USUARIO (03/11) — el idioma de la interfaz, POR PERSONA.
// ----------------------------------------------------------------------------
//  Decisión del dueño: «el idioma de papeles y contratos es fijo al crearse la
//  app en cada server, pero el idioma de lo demás se debe poder configurar por
//  usuario y navegador». Toca sesión, tenant y una migración: ROJO, y por eso
//  e2e, con la RLS de verdad y el rol `spaces_app` (NOSUPERUSER NOBYPASSRLS).
//
//  Lo que se defiende:
//   · guardar la preferencia hace que la SIGUIENTE petición salga en ese
//     idioma (la página y los errores del servidor), sin consultar la base;
//   · la preferencia sigue a la persona a otra sesión (otro «dispositivo»);
//   · otra persona de la misma empresa y otra empresa no la ven ni la cambian;
//   · con el idioma APAGADO se ignora sin error (y no se borra);
//   · sin preferencia, todo como antes.
//
//  El servidor de este archivo arranca con el inglés ENCENDIDO
//  (`IDIOMA_INGLES=1`): el arnés pasa `process.env` al proceso. Al final se
//  reinicia APAGADO para la prueba del interruptor, y se restaura.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let ana: Cliente
let beto: Cliente
let deOtra: Cliente
const inglesAntes = process.env.IDIOMA_INGLES
const italianoAntes = process.env.IDIOMA_ITALIANO

const NO_DISPONIBLE_ES = 'Ese idioma no está disponible en este servidor.'
const NO_DISPONIBLE_EN = 'That language is not available on this server.'

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('idiomausuario')
  otra = await sembrarTenant('idiomaotra')
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ('Beto', 'beto@idiomausuario.test', 'ADMINISTRADOR'::rol_demo, $1, true, $2)`,
    [await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
  process.env.IDIOMA_INGLES = '1'
  delete process.env.IDIOMA_ITALIANO
  await arrancarServidor()
  ana = new Cliente()
  await ana.entrar(org.usuarioEmail, PASSWORD_DEMO)
  beto = new Cliente()
  await beto.entrar('beto@idiomausuario.test', PASSWORD_DEMO)
  deOtra = new Cliente()
  await deOtra.entrar(otra.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
  if (inglesAntes === undefined) delete process.env.IDIOMA_INGLES
  else process.env.IDIOMA_INGLES = inglesAntes
  if (italianoAntes === undefined) delete process.env.IDIOMA_ITALIANO
  else process.env.IDIOMA_ITALIANO = italianoAntes
})

async function enBase(email: string): Promise<string | null> {
  const r = await poolTest().query('select idioma_preferido from usuarios where email = $1', [email])
  return r.rows[0].idioma_preferido
}

/** El `lang` del `<html>` que sirve el layout raíz para esta sesión. */
async function lang(c: Cliente, ruta = '/inicio/'): Promise<string> {
  const r = await c.pedir(ruta)
  expect(r.status).toBe(200)
  const m = /<html[^>]*\slang="([a-z]+)"/.exec(String(r.datos))
  expect(m, 'la página no trae <html lang>').not.toBeNull()
  return m![1]
}

/** Un error del servidor, para ver en qué idioma lo traduce `respuestaError()`. */
async function errorDe(c: Cliente): Promise<string> {
  const r = await c.pedir('/api/perfil/idioma/', { metodo: 'PUT', cuerpo: { idioma: 'fr' } })
  expect(r.status).toBe(400)
  return r.datos.error
}

describe('sin preferencia, todo como antes', () => {
  it('la columna nace vacía para todos', async () => {
    const r = await poolTest().query('select count(*)::int n from usuarios where idioma_preferido is not null')
    expect(r.rows[0].n).toBe(0)
  })

  it('GET devuelve null y los idiomas encendidos', async () => {
    const r = await ana.pedir('/api/perfil/idioma/')
    expect(r.status).toBe(200)
    expect(r.datos).toEqual({ preferido: null, disponibles: ['es', 'en'] })
  })

  it('sin cookie ni Accept-Language: español, página y errores', async () => {
    expect(await lang(ana)).toBe('es')
    expect(await errorDe(ana)).toBe(NO_DISPONIBLE_ES)
  })

  it('el login no trae idioma de cuenta', async () => {
    const c = new Cliente()
    const r = await c.pedir('/api/auth/login/', { cuerpo: { email: org.usuarioEmail, password: PASSWORD_DEMO } })
    expect(r.status).toBe(200)
    expect(r.datos.idioma).toBeNull()
    expect(c.tieneCookie('spaces_idioma_cuenta')).toBe(false)
  })
})

describe('guardar la preferencia', () => {
  it('sin sesión: 401, y no toca nada', async () => {
    const r = await new Cliente().pedir('/api/perfil/idioma/', { metodo: 'PUT', cuerpo: { idioma: 'en' } })
    expect(r.status).toBe(401)
  })

  it('un idioma APAGADO (italiano) o basura se rechaza con 400 y no se guarda', async () => {
    for (const idioma of ['it', 'fr', 'EN', 3]) {
      const r = await ana.pedir('/api/perfil/idioma/', { metodo: 'PUT', cuerpo: { idioma } })
      expect(r.status, JSON.stringify(idioma)).toBe(400)
    }
    expect(await enBase(org.usuarioEmail)).toBeNull()
  })

  it('Ana elige inglés: se guarda, y la SIGUIENTE petición ya sale en inglés', async () => {
    const r = await ana.pedir('/api/perfil/idioma/', { metodo: 'PUT', cuerpo: { idioma: 'en' } })
    expect(r.status).toBe(200)
    expect(r.datos.preferido).toBe('en')
    expect(ana.tieneCookie('spaces_idioma_cuenta')).toBe(true)
    expect(await enBase(org.usuarioEmail)).toBe('en')

    expect(await lang(ana)).toBe('en')
    expect(await errorDe(ana)).toBe(NO_DISPONIBLE_EN)
    expect((await ana.pedir('/api/perfil/idioma/')).datos.preferido).toBe('en')
  })

  it('la preferencia sigue a Ana a OTRA sesión (otro dispositivo)', async () => {
    const otroDispositivo = new Cliente()
    const r = await otroDispositivo.pedir('/api/auth/login/', {
      cuerpo: { email: org.usuarioEmail, password: PASSWORD_DEMO },
    })
    expect(r.status).toBe(200)
    expect(r.datos.idioma).toBe('en')
    expect(await lang(otroDispositivo)).toBe('en')
  })

  it('Beto, de la MISMA empresa, no la ve ni la hereda', async () => {
    expect((await beto.pedir('/api/perfil/idioma/')).datos.preferido).toBeNull()
    expect(await lang(beto)).toBe('es')
    expect(await enBase('beto@idiomausuario.test')).toBeNull()
  })

  it('la otra empresa tampoco, y su cambio solo toca SU fila', async () => {
    expect((await deOtra.pedir('/api/perfil/idioma/')).datos.preferido).toBeNull()
    // Un id ajeno en el cuerpo no sirve de nada: el id sale de la sesión.
    const [{ id: idAna }] = (
      await poolTest().query('select id from usuarios where email = $1', [org.usuarioEmail])
    ).rows
    const r = await deOtra.pedir('/api/perfil/idioma/', {
      metodo: 'PUT',
      cuerpo: { idioma: 'es', id: idAna, usuarioId: idAna },
    })
    expect(r.status).toBe(200)
    expect(await enBase(otra.usuarioEmail)).toBe('es')
    expect(await enBase(org.usuarioEmail)).toBe('en')
    expect(await lang(ana)).toBe('en')
  })

  it('«Usar el idioma del navegador» la borra y vuelve lo de siempre', async () => {
    const r = await ana.pedir('/api/perfil/idioma/', { metodo: 'PUT', cuerpo: { idioma: 'navegador' } })
    expect(r.status).toBe(200)
    expect(r.datos.preferido).toBeNull()
    expect(ana.tieneCookie('spaces_idioma_cuenta')).toBe(false)
    expect(await enBase(org.usuarioEmail)).toBeNull()
    expect(await lang(ana)).toBe('es')
  })

  it('al salir, la cookie de la cuenta se borra: la pantalla de entrar sigue al navegador', async () => {
    const c = new Cliente()
    await c.entrar(otra.usuarioEmail, PASSWORD_DEMO)
    await c.pedir('/api/perfil/idioma/', { metodo: 'PUT', cuerpo: { idioma: 'en' } })
    expect(c.tieneCookie('spaces_idioma_cuenta')).toBe(true)
    const r = await c.pedir('/api/auth/logout/', { metodo: 'POST' })
    expect(r.status).toBe(200)
    expect(c.tieneCookie('spaces_idioma_cuenta')).toBe(false)
    expect(await lang(c, '/login/')).toBe('es')
  })
})

describe('con el inglés APAGADO, la preferencia se ignora sin error', () => {
  beforeAll(async () => {
    await poolTest().query(`update usuarios set idioma_preferido = 'en' where email = $1`, [org.usuarioEmail])
    await pararServidor()
    delete process.env.IDIOMA_INGLES
    await arrancarServidor()
  }, 120_000)

  it('entra, y todo sale en español; la preferencia NO se borra', async () => {
    const c = new Cliente()
    const r = await c.pedir('/api/auth/login/', { cuerpo: { email: org.usuarioEmail, password: PASSWORD_DEMO } })
    expect(r.status).toBe(200)
    expect(r.datos.idioma).toBeNull()
    expect(await lang(c)).toBe('es')
    expect(await errorDe(c)).toBe(NO_DISPONIBLE_ES)
    expect((await c.pedir('/api/perfil/idioma/')).datos).toEqual({ preferido: null, disponibles: ['es'] })
    expect(await enBase(org.usuarioEmail)).toBe('en')
  })

  it('y no se puede guardar inglés mientras está apagado', async () => {
    const c = new Cliente()
    await c.entrar('beto@idiomausuario.test', PASSWORD_DEMO)
    const r = await c.pedir('/api/perfil/idioma/', { metodo: 'PUT', cuerpo: { idioma: 'en' } })
    expect(r.status).toBe(400)
    expect(await enBase('beto@idiomausuario.test')).toBeNull()
  })
})

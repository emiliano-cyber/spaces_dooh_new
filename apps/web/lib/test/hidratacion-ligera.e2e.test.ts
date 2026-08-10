import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, comoTenant } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  `/api/estado` no vuelve a engordar (V2-01 / NEW-1)
// ----------------------------------------------------------------------------
//  Medido en producción el 10/08: la petición que hidrata TODO el shell pesaba
//  6.12 MB y tardaba 6–12 s en frío, dejando la pantalla en blanco en cada F5.
//  No eran las consultas —la más pesada tarda 0.077 ms—: eran dos `select *`
//  arrastrando columnas con archivos dentro.
//
//    contratos  3.95 MB / 13 filas   → `documento_url`, el PDF en data URL
//    sitios     1.00 MB / 12 filas   → `fotos` (text[] de data URLs)
//    sitiosRed  1.00 MB / 12 filas   → las MISMAS filas, otra vez
//
//  Esta prueba no mide el peso: mide la CAUSA, que es lo que se puede afirmar
//  sin depender del volumen de datos de cada entorno. Si alguien vuelve a poner
//  un `select *` en esos listados, o añade una columna grande a la lista
//  explícita, aquí se cae.
//
//  Es la TERCERA vez que este defecto aparece en el repo: primero el arte de los
//  creativos (06/08), luego el documento del contrato y las fotos del sitio. Por
//  eso se fija con una prueba y no solo con un comentario.
// ============================================================================

let a: Awaited<ReturnType<typeof sembrarTenant>>

// Un data URL reconocible y lo bastante grande como para que, si se cuela, se
// note tanto en la aserción como en el peso.
const PDF_FALSO = `data:application/pdf;base64,${'A'.repeat(4096)}`
const FOTO_FALSA = `data:image/png;base64,${'B'.repeat(4096)}`

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  a = await sembrarTenant('hidratacion')

  // Se cargan por SQL y no por la API a propósito: lo que se prueba es la
  // LECTURA. Que el alta acepte o no un PDF de relleno es otro asunto.
  await comoTenant(a.id, async (q) => {
    await q(`update contratos_arrendamiento set documento_url = $1 where tenant_id = $2`, [
      PDF_FALSO,
      a.id,
    ])
    await q(`update sitios set fotos = $1, imagen_promocional = $2 where tenant_id = $3`, [
      [FOTO_FALSA],
      FOTO_FALSA,
      a.id,
    ])
  })

  await arrancarServidor()
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('/api/estado viaja ligero', () => {
  it('ninguna rebanada lleva un data URL incrustado', async () => {
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/estado/')
    expect(r.status).toBe(200)

    // La comprobación es sobre el CUERPO SERIALIZADO entero, no rebanada por
    // rebanada: así cubre también las que hoy no existen. Un `data:` de más de
    // unos cientos de bytes en la hidratación es siempre un error — lo pequeño
    // (un icono suelto) no es lo que rompió esto.
    const crudo = JSON.stringify(r.datos)
    const incrustados = crudo.match(/data:[a-z0-9.+/-]+;base64,[A-Za-z0-9+/=]{200,}/gi) ?? []
    expect(incrustados).toHaveLength(0)
  })

  it('el contrato dice DÓNDE está su documento, no el documento', async () => {
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const { datos } = await c.pedir('/api/estado/')
    const contrato = datos.contratos[0]

    expect(contrato).toBeTruthy()
    // Una ruta, no un archivo. Y con barra final: la app corre con
    // `trailingSlash` y sin ella responde 308.
    expect(contrato.documentoUrl).toBe(`/spaces-dooh/api/contratos/${contrato.id}/documento/`)
  })

  it('un contrato sin documento sigue diciendo null, no una ruta rota', async () => {
    // El export a Excel hace `c.documentoUrl ? 'si' : 'no'`. Si el listado
    // emitiera siempre una ruta, esa columna diría «si» para todos.
    await comoTenant(a.id, async (q) => {
      await q(`update contratos_arrendamiento set documento_url = null where tenant_id = $1`, [a.id])
    })
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const { datos } = await c.pedir('/api/estado/')
    expect(datos.contratos[0].documentoUrl).toBeNull()
  })

  it('las pantallas viajan sin galería, pero avisan de que la tienen', async () => {
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const { datos } = await c.pedir('/api/estado/')
    const sitio = datos.sitios.find((s: any) => s.id === a.sitioId)

    expect(sitio).toBeTruthy()
    expect(sitio.fotos).toEqual([])
    expect(sitio.imagenPromocional).toBeNull()
    // Sin esto, la ficha no podría distinguir «no tiene fotos» de «aún no las
    // he pedido», y pediría la galería de todas las pantallas al abrirlas.
    expect(sitio.tieneFotos).toBe(true)
  })

  it('la galería se sirve bajo demanda, y con sesión', async () => {
    const anon = new Cliente()
    const sin = await anon.pedir(`/api/sitios/${a.sitioId}/media/`)
    expect(sin.status).toBe(401)

    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir(`/api/sitios/${a.sitioId}/media/`)
    expect(r.status).toBe(200)
    expect(r.datos.fotos).toEqual([FOTO_FALSA])
  })
})

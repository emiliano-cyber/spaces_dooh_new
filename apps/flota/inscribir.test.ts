import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { inscribir, claveDeToken } from './inscribir.mjs'

// ============================================================================
//  Inscribir una instancia recién creada.  (ADR 0029 punto 6, ampliado)
// ----------------------------------------------------------------------------
//  Hasta el 2026-09-07 el ejecutor creaba la máquina y **no la apuntaba en
//  ningún sitio**: el panel no la veía, y hacía falta que una persona añadiera
//  la fila y el token a mano. El día que se olvidara, la instancia quedaba
//  funcionando pero invisible — que es justo lo que el panel existe para evitar.
//
//  Lo que se vigila aquí:
//
//   · que sea IDEMPOTENTE, porque el ejecutor puede pasar dos veces;
//   · que NO PIERDA lo que ya había, ni instancias ni tokens de otras;
//   · y que un fallo escribiendo esto **no tumbe el alta**: la máquina ya
//     existe y está servida. Quedar fuera del panel es molesto; abortar un alta
//     buena por eso es peor.
// ============================================================================

let dir = ''
let rutaInstancias = ''
let rutaTokens = ''

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'inscribir-'))
  rutaInstancias = join(dir, 'flota-instancias.json')
  rutaTokens = join(dir, 'flota-tokens.env')
})

const opciones = () => ({ rutaInstancias, rutaTokens })

describe('el nombre de la variable del token', () => {
  it('va en mayusculas y con los guiones como subrayado', () => {
    // Es el contrato con `estado.mjs`: si esto no coincide, el panel dice «no
    // hay token para esta instancia» y nadie sabe por que.
    expect(claveDeToken('ensayo4')).toBe('FLOTA_TOKEN_ENSAYO4')
    expect(claveDeToken('mi-cliente')).toBe('FLOTA_TOKEN_MI_CLIENTE')
  })
})

describe('inscribir una instancia', () => {
  it('la apunta y deja su token, que son las dos cosas que el panel necesita', async () => {
    await inscribir({ nombre: 'ensayo4', dominio: 'ensayo4.space-os.io', token: 'abc123' }, opciones())

    const inv = JSON.parse(await readFile(rutaInstancias, 'utf8'))
    expect(inv.instancias).toEqual([
      { nombre: 'ensayo4', dominio: 'ensayo4.space-os.io', canal: 'estable' },
    ])
    expect(await readFile(rutaTokens, 'utf8')).toContain('FLOTA_TOKEN_ENSAYO4=abc123')
  })

  it('el canal NO lo decide quien llama: siempre estable', async () => {
    // Un canal por instancia es como se salta el invariante 13 sin darse
    // cuenta. Misma regla que en el alta: el canal no se pasa nunca.
    await inscribir(
      { nombre: 'x', dominio: 'x.mx', token: 't', canal: 'beta' } as never,
      opciones(),
    )
    const inv = JSON.parse(await readFile(rutaInstancias, 'utf8'))
    expect(inv.instancias[0].canal).toBe('estable')
  })

  it('es IDEMPOTENTE: dos pasadas no la duplican', async () => {
    // El ejecutor puede pasar dos veces por aqui -- un reintento, una pasada del
    // temporizador. Duplicar la fila haria que el panel consultara dos veces la
    // misma maquina y ensenara dos filas iguales.
    const datos = { nombre: 'ensayo4', dominio: 'ensayo4.space-os.io', token: 'abc' }
    await inscribir(datos, opciones())
    await inscribir(datos, opciones())

    const inv = JSON.parse(await readFile(rutaInstancias, 'utf8'))
    expect(inv.instancias).toHaveLength(1)
    const tokens = await readFile(rutaTokens, 'utf8')
    expect(tokens.match(/FLOTA_TOKEN_ENSAYO4=/g)).toHaveLength(1)
  })

  it('un token nuevo REEMPLAZA al viejo en vez de acumularse', async () => {
    // Si se acumularan, `tokensDeArchivo()` se quedaria con el ultimo y nadie
    // sabria cual esta usando el panel.
    await inscribir({ nombre: 'x', dominio: 'x.mx', token: 'viejo' }, opciones())
    await inscribir({ nombre: 'x', dominio: 'x.mx', token: 'nuevo' }, opciones())
    const tokens = await readFile(rutaTokens, 'utf8')
    expect(tokens).toContain('FLOTA_TOKEN_X=nuevo')
    expect(tokens).not.toContain('viejo')
  })

  it('NO pierde las instancias que ya estaban', async () => {
    // Es lo unico que no puede pasar: dar de alta a un cliente no puede dejar al
    // panel sin ver a los demas.
    await writeFile(
      rutaInstancias,
      JSON.stringify({ instancias: [{ nombre: 'otra', dominio: 'otra.mx', canal: 'estable' }] }),
      'utf8',
    )
    await inscribir({ nombre: 'nueva', dominio: 'nueva.mx', token: 't' }, opciones())

    const inv = JSON.parse(await readFile(rutaInstancias, 'utf8'))
    expect(inv.instancias.map((i: { nombre: string }) => i.nombre).sort()).toEqual(['nueva', 'otra'])
  })

  it('NI los tokens de las demas', async () => {
    await writeFile(rutaTokens, '# cabecera\nFLOTA_TOKEN_OTRA=deotra\n', 'utf8')
    await inscribir({ nombre: 'nueva', dominio: 'nueva.mx', token: 't' }, opciones())

    const tokens = await readFile(rutaTokens, 'utf8')
    expect(tokens).toContain('FLOTA_TOKEN_OTRA=deotra')
    expect(tokens).toContain('FLOTA_TOKEN_NUEVA=t')
  })

  it('un archivo de instancias ILEGIBLE no borra nada: se para y avisa', async () => {
    // Sobrescribirlo seria perder el inventario entero por un JSON a medias.
    await writeFile(rutaInstancias, '{ esto no es json', 'utf8')
    const r = await inscribir({ nombre: 'x', dominio: 'x.mx', token: 't' }, opciones())
    expect(r.ok).toBe(false)
    expect(await readFile(rutaInstancias, 'utf8')).toBe('{ esto no es json')
  })

  it('sin nombre, sin dominio o sin token NO escribe nada', async () => {
    for (const malo of [
      { nombre: '', dominio: 'x.mx', token: 't' },
      { nombre: 'x', dominio: '', token: 't' },
      { nombre: 'x', dominio: 'x.mx', token: '' },
    ]) {
      const r = await inscribir(malo, opciones())
      expect(r.ok).toBe(false)
    }
  })

  it('NUNCA lanza: quedar fuera del panel no puede tumbar un alta buena', async () => {
    // La maquina ya existe y esta servida. Abortar el alta por no poder escribir
    // un archivo del panel seria cambiar un problema pequeno por uno grande.
    const r = await inscribir(
      { nombre: 'x', dominio: 'x.mx', token: 't' },
      { rutaInstancias: join(dir, 'no', 'existe', 'i.json'), rutaTokens: join(dir, 'no', 'existe', 't.env') },
    )
    expect(r.ok).toBe(false)
    expect(typeof r.motivo).toBe('string')
  })
})

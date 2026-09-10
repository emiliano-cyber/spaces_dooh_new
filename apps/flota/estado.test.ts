import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

import { arrastrarMemoria, CLAVES_FILA, CLAVES_REPORTE, clasificar, consultar, fusionar, resumen, tokenDe, tokensDeArchivo, cargarInventario } from './estado.mjs'
import { guardarReporte, validarReporte } from './reporte.mjs'

// ============================================================================
//  Pruebas del panel de flota (F6.2) y del receptor de reportes (F6.4).
// ----------------------------------------------------------------------------
//  Todo lo que se prueba aquí es PURO o toca solo archivos de un directorio
//  temporal. La parte que sale a la red son cuatro líneas de `fetch`; la que
//  decide —clasificar, resumir, fusionar y validar— es la que se puede
//  equivocar en silencio, y es la que está aquí.
//
//  Lo que de verdad se vigila no es que la tabla salga bonita: es que por
//  ninguna de estas rutas se cuele un dato de negocio de un owner. Por eso hay
//  dos pruebas que afirman las CLAVES EXACTAS en vez de la ausencia de unas
//  cuantas — una clave nueva rompe la prueba en vez de colarse.
// ============================================================================

const ESTABLE = 'v0.4.2'

/** Lo que deja una consulta a `GET /api/version` con token, ya normalizada. */
function consultaViva(nombre: string, version: string, fecha: string) {
  return {
    nombre,
    dominio: nombre + '.ejemplo.invalid',
    canal: 'estable',
    version,
    ultimaMigracion: '20260812_schema_migrations.sql',
    base: 'ok',
    uptime: 1200,
    fecha,
    origen: 'consulta',
  }
}

describe('clasificar', () => {
  it('al-dia cuando la instancia corre la version del canal estable', () => {
    expect(clasificar('v0.4.2', ESTABLE)).toBe('al-dia')
  })

  it('rezagada cuando corre cualquier otra version', () => {
    expect(clasificar('v0.4.1', ESTABLE)).toBe('rezagada')
  })

  it('sin-respuesta cuando no hay version porque la instancia no contesto', () => {
    expect(clasificar(null, ESTABLE)).toBe('sin-respuesta')
  })
})

describe('resumen', () => {
  it('clasifica las tres instancias y una caida NO rompe la tabla', () => {
    const filas = resumen(
      [
        consultaViva('inventario', 'v0.4.2', '2026-08-26T04:20:00.000Z'),
        consultaViva('vallas', 'v0.4.1', '2026-08-26T04:20:01.000Z'),
        {
          nombre: 'apagada',
          dominio: 'apagada.ejemplo.invalid',
          canal: 'estable',
          version: null,
          fecha: null,
          origen: 'consulta',
        },
      ],
      ESTABLE,
    )

    // Las tres siguen en la tabla: la caída ocupa su fila, no desaparece ni
    // tumba a las otras dos.
    expect(filas).toHaveLength(3)
    expect(filas.map((f: { estado: string }) => f.estado)).toEqual([
      'al-dia',
      'rezagada',
      'sin-respuesta',
    ])
    expect(filas[2].version).toBe('—')
  })

  it('la fila del panel lleva SOLO las columnas permitidas, aunque llegue mas', () => {
    // Una instancia comprometida —o un cambio futuro de `/api/version`— podría
    // devolver conteos del negocio del owner. El panel es de AS OOH y la
    // instancia es del owner: aquí se recorta contra una lista blanca en vez de
    // confiar en lo que mande el emisor.
    const [fila] = resumen(
      [
        {
          ...consultaViva('inventario', 'v0.4.2', '2026-08-26T04:20:00.000Z'),
          organizaciones: 42,
          nombreOrganizacion: 'Publicidad Real S.A.',
          usuarios: 130,
        },
      ],
      ESTABLE,
    )

    // La lista va ESCRITA A MANO y no sale de `CLAVES_FILA` a propósito: así una
    // clave nueva rompe esta prueba en vez de colarse. El 2026-09-10 se
    // añadieron `motivo` y `ultimaVezBien`, y este rojo fue el que obligó a
    // justificarlas — que es exactamente para lo que está la prueba.
    expect(Object.keys(fila).sort()).toEqual(
      [
        'canal',
        'dominio',
        'estado',
        'fecha',
        'nombre',
        'origen',
        'version',
        'motivo',
        'ultimaVezBien',
      ].sort(),
    )
    expect(JSON.stringify(fila)).not.toContain('Publicidad Real')
    expect(JSON.stringify(fila)).not.toContain('42')
  })
})

describe('fusionar', () => {
  it('el reporte gana si es mas reciente que la consulta, y pierde si es mas viejo', () => {
    const consultas = [
      consultaViva('inventario', 'v0.4.1', '2026-08-26T04:00:00.000Z'),
      consultaViva('vallas', 'v0.4.2', '2026-08-26T04:00:00.000Z'),
    ]
    const reportes = [
      // Más reciente: la instancia se actualizó después de que el padre mirara.
      { ...consultaViva('inventario', 'v0.4.2', '2026-08-26T05:00:00.000Z'), origen: 'reporte' },
      // Más viejo: el padre ya sabe algo mejor que esto.
      { ...consultaViva('vallas', 'v0.3.9', '2026-08-25T05:00:00.000Z'), origen: 'reporte' },
    ]

    const fusion = fusionar(consultas, reportes)
    const porNombre = Object.fromEntries(
      fusion.map((f: { nombre: string }) => [f.nombre, f]),
    ) as Record<string, { version: string; origen: string }>

    expect(porNombre.inventario.version).toBe('v0.4.2')
    expect(porNombre.inventario.origen).toBe('reporte')
    expect(porNombre.vallas.version).toBe('v0.4.2')
    expect(porNombre.vallas.origen).toBe('consulta')
  })
})

describe('el receptor de reportes (F6.4)', () => {
  let dirEstado = ''

  const reporteValido = {
    ok: true,
    version: 'v0.4.2',
    ultimaMigracion: '20260812_schema_migrations.sql',
    base: 'ok',
    canal: 'estable',
    uptime: 8130,
    instancia: 'inventario',
  }

  beforeEach(async () => {
    dirEstado = await mkdtemp(join(tmpdir(), 'flota-estado-'))
    // Otra instancia que ya había reportado antes. Tiene que salir intacta.
    await writeFile(
      join(dirEstado, 'vallas.json'),
      JSON.stringify({ instancia: 'vallas', version: 'v0.4.0' }),
      'utf8',
    )
  })

  it('un reporte valido actualiza el estado de esa instancia y SOLO el de esa', async () => {
    const resultado = await guardarReporte(reporteValido, {
      dirEstado,
      nombreEsperado: 'inventario',
      ahora: '2026-08-26T04:20:00.000Z',
    })

    expect(resultado.ok).toBe(true)

    const guardado = JSON.parse(await readFile(join(dirEstado, 'inventario.json'), 'utf8'))
    expect(guardado.version).toBe('v0.4.2')
    expect(guardado.instancia).toBe('inventario')
    expect(guardado.recibidoEn).toBe('2026-08-26T04:20:00.000Z')
    // El archivo guardado tampoco puede crecer con claves nuevas.
    expect(Object.keys(guardado).sort()).toEqual([...CLAVES_REPORTE, 'recibidoEn'].sort())

    // La otra instancia NO se tocó, y no apareció ningún archivo de más.
    const otra = JSON.parse(await readFile(join(dirEstado, 'vallas.json'), 'utf8'))
    expect(otra).toEqual({ instancia: 'vallas', version: 'v0.4.0' })
    expect((await readdir(dirEstado)).sort()).toEqual(['inventario.json', 'vallas.json'])
  })

  it('un reporte con claves de mas se rechaza ENTERO y no escribe nada', async () => {
    const conDeMas = {
      ...reporteValido,
      organizaciones: 3,
      nombreOrganizacion: 'Publicidad Real S.A.',
    }

    expect(validarReporte(conDeMas).ok).toBe(false)
    expect(validarReporte(conDeMas).motivo).toContain('organizaciones')

    const resultado = await guardarReporte(conDeMas, {
      dirEstado,
      nombreEsperado: 'inventario',
      ahora: '2026-08-26T04:20:00.000Z',
    })

    expect(resultado.ok).toBe(false)
    // Ni «lo que se entienda»: el archivo no llega a existir.
    expect(existsSync(join(dirEstado, 'inventario.json'))).toBe(false)
    expect((await readdir(dirEstado)).sort()).toEqual(['vallas.json'])
  })
})

// ============================================================================
//  De donde salen los tokens de instancia.  (A0.2 del Plan_Alta_Desatendida)
//
//  El ejecutor de altas corre como `altas` y el panel como `flota`: usuarios
//  distintos a proposito (ADR 0027). Para que el panel vea una instancia nueva
//  SIN reiniciarse y SIN que nadie escale privilegios, `altas` escribe un
//  archivo (`altas:flota`, 640) y el panel lo lee en cada pasada.
//
//  Los tres casos que importan son negativos: que el entorno pueda anular el
//  archivo, y que un archivo ausente o ilegible NO tumbe el panel.
// ============================================================================
describe('los tokens de instancia, y de donde se leen', () => {
  it('sin archivo se comporta EXACTAMENTE como hoy', async () => {
    expect(tokenDe('vallas', { FLOTA_TOKEN_VALLAS: 'del-entorno' }, {})).toBe('del-entorno')
    expect(tokenDe('vallas', { FLOTA_TOKEN: 'compartido' }, {})).toBe('compartido')
    expect(tokenDe('vallas', {}, {})).toBe('')
  })

  it('el archivo aporta el token que el entorno no tiene', async () => {
    const delArchivo = { FLOTA_TOKEN_ENSAYO4: 'del-archivo' }
    expect(tokenDe('ensayo4', {}, delArchivo)).toBe('del-archivo')
  })

  it('el ENTORNO gana sobre el archivo: hace falta poder anular uno malo sin editarlo', () => {
    const delArchivo = { FLOTA_TOKEN_ENSAYO4: 'viejo' }
    expect(tokenDe('ensayo4', { FLOTA_TOKEN_ENSAYO4: 'nuevo' }, delArchivo)).toBe('nuevo')
  })

  it('un token del archivo gana sobre el FLOTA_TOKEN compartido', () => {
    // Un token compartido convierte cualquier instancia comprometida en el
    // panel de todas las demas: si hay uno propio, manda el propio.
    const delArchivo = { FLOTA_TOKEN_ENSAYO4: 'propio' }
    expect(tokenDe('ensayo4', { FLOTA_TOKEN: 'compartido' }, delArchivo)).toBe('propio')
  })

  it('un archivo que NO existe es ausencia de tokens, no un error', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tok-'))
    await expect(tokensDeArchivo(join(dir, 'no-existe.env'))).resolves.toEqual({})
  })

  it('un archivo ilegible tampoco tumba el panel', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tok-'))
    const ruta = join(dir, 'flota-tokens.env')
    await writeFile(ruta, ['esto no es', 'un archivo de entorno', '= ', ''].join('\n'), 'utf8')
    await expect(tokensDeArchivo(ruta)).resolves.toEqual({})
  })

  it('lee el formato de systemd: CLAVE=valor, sin comillas y sin expansion', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tok-'))
    const ruta = join(dir, 'flota-tokens.env')
    const lineas = ['# escrito por el ejecutor', 'FLOTA_TOKEN_ENSAYO4=abc123', '', 'FLOTA_TOKEN_PIXELED=def456', '']
    await writeFile(ruta, lineas.join('\n'), 'utf8')
    await expect(tokensDeArchivo(ruta)).resolves.toEqual({
      FLOTA_TOKEN_ENSAYO4: 'abc123',
      FLOTA_TOKEN_PIXELED: 'def456',
    })
  })

  it('ignora lo que no sea un token de flota: el archivo no es un .env de proposito general', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tok-'))
    const ruta = join(dir, 'flota-tokens.env')
    await writeFile(ruta, ['FLOTA_TOKEN_ENSAYO4=si', 'DIGITALOCEAN_ACCESS_TOKEN=NO_DEBE_ENTRAR', ''].join('\n'), 'utf8')
    const leidos = await tokensDeArchivo(ruta)
    expect(leidos).toEqual({ FLOTA_TOKEN_ENSAYO4: 'si' })
    expect(leidos).not.toHaveProperty('DIGITALOCEAN_ACCESS_TOKEN')
  })
})

// ============================================================================
//  Las instancias que el ejecutor da de alta.  (ADR 0029 punto 6, ampliado)
// ----------------------------------------------------------------------------
//  `flota.json` es un inventario A MANO y no esta en git: seria la lista de
//  clientes con sus dominios. Hasta ahora el ejecutor creaba la instancia y no
//  la inscribia en ningun sitio, asi que cada alta quedaba INVISIBLE en el panel
//  hasta que alguien se acordara de anadir la fila.
//
//  >>> Y NO se arregla dejando que el ejecutor escriba en `flota.json`: ese
//  >>> archivo vive en `/var/www/Spaces`, y dar permiso de escritura ahi al
//  >>> proceso que tiene los tres tokens le daria ademas la capacidad de
//  >>> ALTERAR EL CODIGO de la aplicacion.
//
//  Va por el mismo camino que los tokens: un archivo que escribe `altas` y lee
//  `flota`, y el panel los mezcla.
//
//  Estuvo en `/etc/space-os/` hasta el 2026-09-08 y ahi NUNCA pudo funcionar: la
//  escritura es atomica --temporal al lado y `rename`--, asi que necesita
//  permiso sobre el DIRECTORIO, y ese directorio guarda los secretos del PADRE.
//  Vive en `/var/lib/space-os/`, donde el ejecutor ya escribe las solicitudes.
//  Las rutas se afirman en `inscribir.test.ts`.
// ============================================================================
describe('el inventario, y las instancias que se dan de alta solas', () => {
  async function conArchivos(flota: unknown, extra: unknown) {
    const dir = await mkdtemp(join(tmpdir(), 'inv-'))
    if (flota !== null) await writeFile(join(dir, 'flota.json'), JSON.stringify(flota), 'utf8')
    const rutaExtra = join(dir, 'instancias.json')
    if (extra !== null) await writeFile(rutaExtra, JSON.stringify(extra), 'utf8')
    return { dir, rutaExtra }
  }

  const base = { canales: { estable: 'v1' }, instancias: [{ nombre: 'padre', dominio: 'p.mx', canal: 'estable' }] }

  it('sin archivo extra se comporta EXACTAMENTE como hoy', async () => {
    const { dir, rutaExtra } = await conArchivos(base, null)
    const inv = await cargarInventario(dir, rutaExtra)
    expect(inv.instancias).toHaveLength(1)
    expect(inv.instancias[0].nombre).toBe('padre')
    expect(inv.esEjemplo).toBe(false)
  })

  it('las del archivo extra se suman, que es el punto', async () => {
    const { dir, rutaExtra } = await conArchivos(base, {
      instancias: [{ nombre: 'ensayo4', dominio: 'ensayo4.space-os.io', canal: 'estable' }],
    })
    const inv = await cargarInventario(dir, rutaExtra)
    expect(inv.instancias.map((i: any) => i.nombre).sort()).toEqual(['ensayo4', 'padre'])
  })

  it('NO pierde las de flota.json: es lo unico que no puede pasar', async () => {
    // Si una instancia nueva borrara el inventario a mano, el panel dejaria de
    // ver la flota entera por dar de alta a un cliente.
    const { dir, rutaExtra } = await conArchivos(base, { instancias: [{ nombre: 'x', dominio: 'x.mx' }] })
    const inv = await cargarInventario(dir, rutaExtra)
    expect(inv.instancias.some((i: any) => i.nombre === 'padre')).toBe(true)
  })

  it('flota.json GANA sobre el extra: hace falta poder corregir a mano', async () => {
    const { dir, rutaExtra } = await conArchivos(
      { instancias: [{ nombre: 'ensayo4', dominio: 'el-bueno.mx', canal: 'estable' }] },
      { instancias: [{ nombre: 'ensayo4', dominio: 'el-viejo.mx', canal: 'beta' }] },
    )
    const inv = await cargarInventario(dir, rutaExtra)
    expect(inv.instancias).toHaveLength(1)
    expect(inv.instancias[0].dominio).toBe('el-bueno.mx')
  })

  it('un extra ausente o ilegible NO tumba el panel', async () => {
    // Misma disciplina que `listar()` con un JSON roto y que `tokensDeArchivo()`.
    const { dir, rutaExtra } = await conArchivos(base, null)
    await writeFile(rutaExtra, '{ esto no es json', 'utf8')
    const inv = await cargarInventario(dir, rutaExtra)
    expect(inv.instancias).toHaveLength(1)
  })

  it('una entrada sin nombre o sin dominio se descarta, no se cuela a medias', async () => {
    // Una fila sin dominio haria que el panel consultara `undefined`.
    const { dir, rutaExtra } = await conArchivos(base, {
      instancias: [{ nombre: 'sin-dominio' }, { dominio: 'sin-nombre.mx' }, { nombre: 'ok', dominio: 'ok.mx' }],
    })
    const inv = await cargarInventario(dir, rutaExtra)
    expect(inv.instancias.map((i: any) => i.nombre).sort()).toEqual(['ok', 'padre'])
  })

  it('sin flota.json pero CON altas, se ven las de verdad y no el ejemplo', async () => {
    // El caso que tenia el panel de space-os.io vacio el 07/09, y es el estado
    // NORMAL de un PADRE que solo ha creado clientes desde el panel: `flota.json`
    // no esta versionado y nadie lo escribe a mano.
    //
    // Antes esto caia al ejemplo y enseñaba tres dominios `.invalid` mientras la
    // instancia real quedaba invisible. El aviso que aquello protegia --«esto no
    // es la flota»-- acababa diciendo lo contrario de la verdad.
    const { dir, rutaExtra } = await conArchivos(null, {
      instancias: [{ nombre: 'ensayo4', dominio: 'ensayo4.space-os.io', canal: 'estable' }],
    })
    await writeFile(
      join(dir, 'flota.example.json'),
      JSON.stringify({ instancias: [{ nombre: 'inventada', dominio: 'nada.invalid' }] }),
      'utf8',
    )
    const inv = await cargarInventario(dir, rutaExtra)
    expect(inv.esEjemplo).toBe(false)
    expect(inv.instancias.map((i: any) => i.nombre)).toEqual(['ensayo4'])
  })

  it('y sin flota.json y SIN altas, si se usa el ejemplo y se dice que lo es', async () => {
    // El ejemplo sigue existiendo para «aqui todavia no hay nada». Lo que se
    // retiro es que ganara cuando SI hay algo.
    const { dir, rutaExtra } = await conArchivos(null, null)
    await writeFile(
      join(dir, 'flota.example.json'),
      JSON.stringify({ instancias: [{ nombre: 'inventada', dominio: 'nada.invalid' }] }),
      'utf8',
    )
    const inv = await cargarInventario(dir, rutaExtra)
    expect(inv.esEjemplo).toBe(true)
    expect(inv.instancias).toHaveLength(1)
  })

  it('un archivo de altas ILEGIBLE por permisos no se calla', async () => {
    // Es el fallo mas probable en el PADRE: lo escribe `altas` y lo lee `flota`.
    // Sin aviso, «no puedo leerlo» y «no hay ninguna» se ven IGUAL: una tabla
    // vacia. El panel no se cae, pero el motivo queda en el journal.
    const { dir } = await conArchivos(base, null)
    const avisos: string[] = []
    const antes = console.error
    console.error = (m: unknown) => avisos.push(String(m))
    try {
      // Un DIRECTORIO en vez de un archivo: `readFile` da EISDIR, que como
      // EACCES es «esta ahi y no lo puedo leer». No hace falta ser root.
      await cargarInventario(dir, dir)
    } finally {
      console.error = antes
    }
    expect(avisos.join(' ')).toContain('no se pudo leer')
  })
})

describe('consultar · el motivo dice que arreglar', () => {
  const instancia = { nombre: 'g500', dominio: 'g500.ejemplo.invalid', canal: 'estable' }

  it('un fallo de DNS se lee como DNS y no como «fetch failed»', async () => {
    const pedir = async () => {
      const e = new Error('fetch failed') as Error & { cause?: { code: string } }
      e.cause = { code: 'ENOTFOUND' }
      throw e
    }
    const fila = await consultar(instancia, { token: 'x', pedir })
    expect(fila.motivo).toBe('el dominio no resuelve (ENOTFOUND)')
  })

  it('un 404 explica que esa instancia es vieja', async () => {
    const pedir = async () => new Response('', { status: 404 })
    const fila = await consultar(instancia, { token: 'x', pedir })
    expect(fila.motivo).toBe('no existe /api/version: corre una version anterior a F6.1 (HTTP 404)')
  })

  it('una instancia sana no trae motivo', async () => {
    const pedir = async () => new Response(JSON.stringify({ ok: true, version: 'v0.5.0' }))
    const fila = await consultar(instancia, { token: 'x', pedir })
    expect(fila.motivo).toBeNull()
    expect(fila.version).toBe('v0.5.0')
  })

  it('sin token, el motivo nombra la variable que falta', async () => {
    const pedir = async () => new Response(JSON.stringify({ ok: true }))
    const fila = await consultar(instancia, { token: '', pedir })
    expect(fila.motivo).toBe('falta FLOTA_TOKEN_G500 en el panel')
  })
})

describe('resumen · conserva el motivo sin abrir la puerta a datos del owner', () => {
  it('la fila trae el motivo de la consulta', () => {
    const filas = resumen(
      [
        {
          nombre: 'g500',
          dominio: 'g500.ejemplo.invalid',
          canal: 'estable',
          version: null,
          motivo: 'el dominio no resuelve (ENOTFOUND)',
        },
      ],
      { estable: ESTABLE },
    )
    expect(filas[0].motivo).toBe('el dominio no resuelve (ENOTFOUND)')
  })

  it('una instancia sana trae motivo nulo, no una cadena vacia', () => {
    const filas = resumen([consultaViva('g500', ESTABLE, '2026-09-10T00:00:00Z')], {
      estable: ESTABLE,
    })
    expect(filas[0].motivo).toBeNull()
  })

  // EL GUARD. Sin esto, `motivo` es la puerta de atras de la lista blanca: el
  // dia que a alguien le resulte comodo meter ahi «lo que dijo la instancia»,
  // esta prueba es lo unico que lo para.
  it('NINGUN valor del cuerpo de la instancia acaba en la fila', () => {
    const filas = resumen(
      [
        {
          nombre: 'g500',
          dominio: 'g500.ejemplo.invalid',
          canal: 'estable',
          version: null,
          motivo: 'el token no lo reconoce como panel',
          // Lo que una instancia comprometida podria intentar colar:
          clientes: 412,
          razonSocial: 'ACME SA DE CV',
          facturado: 1234567,
        },
      ],
      { estable: ESTABLE },
    )
    const serializada = JSON.stringify(filas[0])
    expect(serializada).not.toContain('412')
    expect(serializada).not.toContain('ACME')
    expect(serializada).not.toContain('1234567')
    expect(Object.keys(filas[0]).sort()).toEqual([...CLAVES_FILA].sort())
  })
})

describe('arrastrarMemoria', () => {
  const AHORA = '2026-09-10T12:00:00Z'
  const ANTES = '2026-09-10T09:00:00Z'

  it('una instancia que contesta ahora fija ultimaVezBien en ahora', () => {
    const filas = [{ nombre: 'g500', version: 'v0.5.0', motivo: null, ultimaVezBien: null }]
    expect(arrastrarMemoria(filas, [], () => AHORA)[0].ultimaVezBien).toBe(AHORA)
  })

  it('una instancia caida conserva la ultima vez que estuvo bien', () => {
    const filas = [
      { nombre: 'g500', version: '—', motivo: 'el dominio no resuelve (ENOTFOUND)', ultimaVezBien: null },
    ]
    const previas = [{ nombre: 'g500', ultimaVezBien: ANTES }]
    expect(arrastrarMemoria(filas, previas, () => AHORA)[0].ultimaVezBien).toBe(ANTES)
  })

  it('una instancia caida sin memoria previa se queda en nulo, no inventa una fecha', () => {
    const filas = [{ nombre: 'g500', version: '—', motivo: 'x', ultimaVezBien: null }]
    expect(arrastrarMemoria(filas, [], () => AHORA)[0].ultimaVezBien).toBeNull()
  })

  it('no se cruzan las memorias de dos instancias', () => {
    const filas = [
      { nombre: 'a', version: '—', motivo: 'x', ultimaVezBien: null },
      { nombre: 'b', version: '—', motivo: 'x', ultimaVezBien: null },
    ]
    const previas = [{ nombre: 'b', ultimaVezBien: ANTES }]
    const salida = arrastrarMemoria(filas, previas, () => AHORA)
    expect(salida[0].ultimaVezBien).toBeNull()
    expect(salida[1].ultimaVezBien).toBe(ANTES)
  })

  it('previas nulo o ausente no revienta: es «sin memoria»', () => {
    const filas = [{ nombre: 'g500', version: '—', motivo: 'x', ultimaVezBien: null }]
    expect(arrastrarMemoria(filas, null as never, () => AHORA)[0].ultimaVezBien).toBeNull()
    expect(arrastrarMemoria(filas, undefined, () => AHORA)[0].ultimaVezBien).toBeNull()
  })

  it('no toca ninguna otra clave de la fila', () => {
    const filas = [
      { nombre: 'g500', version: 'v0.5.0', motivo: null, ultimaVezBien: null, estado: 'al-dia' },
    ]
    const salida = arrastrarMemoria(filas, [], () => AHORA)
    expect(salida[0].estado).toBe('al-dia')
    expect(salida[0].version).toBe('v0.5.0')
  })
})

describe('validarReporte · las claves de la fase 2 son OPCIONALES', () => {
  const base = {
    ok: true,
    version: 'v0.5.0',
    ultimaMigracion: '20260910_pais_sin_default.sql',
    base: 'ok',
    canal: 'estable',
    uptime: 120,
    instancia: 'g500',
  }

  // Si fueran obligatorias, toda instancia que no se haya actualizado todavia
  // dejaria de reportar -- y eso es la flota entera el dia del despliegue.
  it('un reporte SIN resultado ni paso sigue siendo valido (update.sh viejo)', () => {
    expect(validarReporte(base).ok).toBe(true)
  })

  it('un reporte CON las dos es valido, y las CONSERVA', () => {
    const r = validarReporte({ ...base, resultado: 'fallo', paso: 'migraciones' })
    expect(r.ok).toBe(true)
    expect(r.reporte.resultado).toBe('fallo')
    expect(r.reporte.paso).toBe('migraciones')
  })

  it('un paso que no esta en la lista cerrada se rechaza', () => {
    const r = validarReporte({ ...base, resultado: 'fallo', paso: 'lo-que-sea' })
    expect(r.ok).toBe(false)
    expect(r.motivo).toContain('paso')
  })

  it('un resultado inventado se rechaza', () => {
    expect(validarReporte({ ...base, resultado: 'regular', paso: 'pull' }).ok).toBe(false)
  })

  // El guard de la fase 1, otra vez y por el otro lado: aqui el dato SI viene
  // de la instancia, asi que la lista cerrada es lo unico que lo sujeta.
  it('una clave que nadie declaro sigue tumbando el reporte ENTERO', () => {
    const r = validarReporte({ ...base, error: 'traceback con datos del cliente' })
    expect(r.ok).toBe(false)
    expect(r.motivo).toContain('error')
  })
})

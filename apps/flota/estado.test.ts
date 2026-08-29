import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

import { CLAVES_REPORTE, clasificar, fusionar, resumen } from './estado.mjs'
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

    expect(Object.keys(fila).sort()).toEqual(
      ['canal', 'dominio', 'estado', 'fecha', 'nombre', 'origen', 'version'].sort(),
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

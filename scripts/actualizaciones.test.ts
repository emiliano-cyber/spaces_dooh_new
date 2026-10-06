import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decidirActualizacion, MODOS, notasParaVersion, RUTA_NOVEDADES } from './actualizaciones.mjs'

const BASE = {
  modo: 'aprobacion',
  corrida: 'comprobar',
  digestInstalado: 'sha256:viejo',
  digestDisponible: 'sha256:nuevo',
  aprobadoDigest: null,
}

describe('decidirActualizacion', () => {
  it('sin nada disponible no se actualiza', () => {
    const r = decidirActualizacion({ ...BASE, digestDisponible: null })
    expect(r).toEqual({ actualizar: false, motivo: 'sin-disponible' })
  })

  it('si lo disponible ya es lo instalado, no hay nada que hacer', () => {
    const r = decidirActualizacion({ ...BASE, digestDisponible: 'sha256:viejo' })
    expect(r).toEqual({ actualizar: false, motivo: 'sin-cambios' })
  })

  it('en automatica, la corrida programada actualiza', () => {
    const r = decidirActualizacion({ ...BASE, modo: 'automatica', corrida: 'programada' })
    expect(r).toEqual({ actualizar: true, motivo: 'automatica' })
  })

  it('NEGATIVO: en automatica, la corrida frecuente NO actualiza', () => {
    // Su trabajo no es meter un corte de servicio a media manana. Si esto se
    // pone en verde devolviendo `actualizar: true`, se perdio la garantia de
    // que los cortes automaticos son de madrugada.
    const r = decidirActualizacion({ ...BASE, modo: 'automatica', corrida: 'comprobar' })
    expect(r).toEqual({ actualizar: false, motivo: 'automatica-espera-madrugada' })
  })

  it('una aprobacion que cuadra actualiza, en cualquiera de las dos corridas', () => {
    for (const corrida of ['comprobar', 'programada']) {
      const r = decidirActualizacion({ ...BASE, corrida, aprobadoDigest: 'sha256:nuevo' })
      expect(r, corrida).toEqual({ actualizar: true, motivo: 'aprobada' })
    }
  })

  it('NEGATIVO: una aprobacion para OTRO digest no actualiza', () => {
    // El corazon del ADR 0037. El dueno aprobo lo que vio; si la etiqueta del
    // canal se movio despues, instalar seria poner algo que nunca miro.
    const r = decidirActualizacion({ ...BASE, aprobadoDigest: 'sha256:el-que-vio-ayer' })
    expect(r).toEqual({ actualizar: false, motivo: 'aprobacion-caduca' })
  })

  it('NEGATIVO: en automatica, una aprobacion caduca NO frena la actualizacion', () => {
    // Una aprobacion vieja colgando no puede congelar a quien eligio automatica.
    const r = decidirActualizacion({
      ...BASE, modo: 'automatica', corrida: 'programada', aprobadoDigest: 'sha256:viejisimo',
    })
    expect(r).toEqual({ actualizar: true, motivo: 'automatica' })
  })

  it('sin aprobacion y en modo aprobacion, se espera', () => {
    expect(decidirActualizacion(BASE)).toEqual({
      actualizar: false, motivo: 'esperando-aprobacion',
    })
  })

  it('NEGATIVO: un modo que no se reconoce NO actualiza', () => {
    // Fail-closed. Un modo corrupto o de una version futura no puede
    // interpretarse como "adelante": actualizar es lo irreversible.
    const r = decidirActualizacion({ ...BASE, modo: 'loquesea', corrida: 'programada' })
    expect(r).toEqual({ actualizar: false, motivo: 'modo-desconocido' })
  })

  it('los dos modos validos, declarados una sola vez', () => {
    expect(MODOS).toEqual(['automatica', 'aprobacion'])
  })
})

// ============================================================================
//  Las notas de version que el actualizador anota en `notas_disponibles`.
// ----------------------------------------------------------------------------
//  Lo escribe la sonda de estado de `update.sh` (`guion_estado()`), con el
//  node de la imagen NUEVA, leyendo el `novedades.json` de esa misma imagen.
//  La regla que no se negocia: LAS NOTAS NUNCA TUMBAN UNA ACTUALIZACION. Un
//  archivo ausente, roto o sin la version da `null` y la sonda sigue.
// ============================================================================

const ENTRADA = { version: 'v0.9.2', fecha: '2026-10-01', items: [{ tipo: 'NUEVO', texto: 'Algo.' }] }

describe('notasParaVersion', () => {
  it('devuelve la entrada de la version', () => {
    expect(notasParaVersion(JSON.stringify([ENTRADA]), 'v0.9.2')).toEqual(ENTRADA)
  })

  it('una precandidata lee las notas de su version', () => {
    expect(notasParaVersion(JSON.stringify([ENTRADA]), 'v0.9.2-rc1')).toEqual(ENTRADA)
  })

  it('NEGATIVO: sin entrada para esa version, null', () => {
    expect(notasParaVersion(JSON.stringify([ENTRADA]), 'v0.9.3')).toBeNull()
  })

  it('NEGATIVO: sin archivo, JSON roto o forma que no es lista: null, nunca una excepcion', () => {
    for (const texto of [null, undefined, '', '[{"version":', '{"version":"v0.9.2"}', '42']) {
      expect(notasParaVersion(texto as string, 'v0.9.2')).toBeNull()
    }
  })

  it('NEGATIVO: una version que no es version (el canal, `desconocida`) no busca nada', () => {
    // `update.sh` cae en el nombre del canal cuando la imagen no trae
    // SPACE_OS_VERSION (`VERSION_NUEVA="$CANAL"`).
    for (const v of ['estable', 'beta', 'desconocida', '', null]) {
      expect(notasParaVersion(JSON.stringify([ENTRADA]), v as string)).toBeNull()
    }
  })

  it('NEGATIVO: una entrada sin lista de items no se anota', () => {
    expect(notasParaVersion(JSON.stringify([{ version: 'v0.9.2', fecha: 'x', items: 'no' }]), 'v0.9.2')).toBeNull()
  })
})

const RAIZ = join(__dirname, '..')
const UPDATE = readFileSync(join(RAIZ, 'infra', 'scripts', 'update.sh'), 'utf8')
const DOCKERFILE = readFileSync(join(RAIZ, 'Dockerfile'), 'utf8')

function guionEstado(): string {
  const m = /cat <<'FIN_GUION_ESTADO'\r?\n([\s\S]*?)\r?\nFIN_GUION_ESTADO/.exec(UPDATE)
  if (!m) throw new Error('no se encontro guion_estado() en update.sh')
  return m[1]
}

describe('la ruta de novedades.json dentro de la imagen', () => {
  it('el Dockerfile copia el archivo exactamente a la ruta que lee la sonda', () => {
    // Hoy el standalone tambien lo trae, pero por accidente: el trazado de
    // Next sigue el `import` de la app. Sin la COPY explicita, el dia que eso
    // cambie la sonda deja de encontrarlo y anota null para siempre, sin un
    // solo error.
    const destino = RUTA_NOVEDADES.replace(/^\/app\//, './')
    expect(DOCKERFILE).toContain(`COPY --chown=node:node apps/web/novedades.json ${destino}`)
  })

  it('la sonda de update.sh lee esa ruta, la de actualizaciones.mjs', () => {
    expect(guionEstado()).toContain('RUTA_NOVEDADES')
  })
})

// ----------------------------------------------------------------------------
//  La sonda DE VERDAD, ejecutada. Se extrae el guion node de `update.sh` tal
//  cual y se corre con un `pg` doble que anota cada consulta.
//
//  El caso que importa es el primero, y es el que mas caro saldria: la sonda
//  corre con la imagen NUEVA contra la base VIEJA -las migraciones de la
//  nueva aun no se aplicaron, eso pasa al instalar-. Si escribiera
//  `notas_disponibles` sin mirar si la columna existe, la primera
//  `--comprobar` tras publicar esta version reventaria con 42703, el
//  actualizador saldria con "no se pudo leer la tabla", y la instancia NO
//  PODRIA instalar nunca la version que trae la columna. Un bloqueo sin
//  salida, causado por un dato informativo.
//
//  Aqui `/app/...` no existe, asi que los `import` de la imagen fallan: eso
//  hace de "archivo de notas ausente" (tiene que anotar null y SEGUIR) y deja
//  sin decision, que sale con 9 DESPUES de escribir. Lo que se mira es lo
//  que se le pidio a la base.
// ----------------------------------------------------------------------------
const PG_DOBLE = `const fs = require('fs')
class Client {
  async connect() {}
  async end() {}
  async query(sql, params) {
    fs.appendFileSync(process.env.REG_SQL, JSON.stringify({ sql, params }) + '\\n')
    if (/notas_disponibles/.test(sql) && /^\\s*update/i.test(sql) && process.env.CON_COLUMNA !== '1') {
      const e = new Error('column "notas_disponibles" does not exist'); e.code = '42703'; throw e
    }
    if (/information_schema\\.columns/.test(sql)) return { rows: [{ hay: process.env.CON_COLUMNA === '1' }] }
    if (/to_regclass\\('public\\.actualizaciones_instancia'\\)/.test(sql)) return { rows: [{ hay: true }] }
    if (/to_regclass/.test(sql)) return { rows: [{ hay: false }] }
    if (/^\\s*select modo/i.test(sql)) return { rows: [{ modo: 'aprobacion', digest_instalado: null, aprobado_digest: null }] }
    return { rows: [] }
  }
}
module.exports = { Client }
`

describe('la sonda de estado anota notas_disponibles', () => {
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'sonda-'))
    mkdirSync(join(dir, 'node_modules', 'pg'), { recursive: true })
    writeFileSync(join(dir, 'node_modules', 'pg', 'index.js'), PG_DOBLE)
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  function correrSonda(conColumna: boolean) {
    const reg = join(dir, `sql-${conColumna}.log`)
    writeFileSync(reg, '')
    const r = spawnSync(process.execPath, [], {
      input: guionEstado(),
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        REG_SQL: reg,
        CON_COLUMNA: conColumna ? '1' : '0',
        DATABASE_URL: 'postgresql://doble',
        SPACE_OS_VERSION_DISPONIBLE: 'v0.9.2',
        SPACE_OS_DIGEST_DISPONIBLE: 'reg/space-os@sha256:nuevo',
        SPACE_OS_CORRIDA: 'comprobar',
      },
    })
    const consultas = readFileSync(reg, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { sql: string; params?: unknown[] })
    return { ...r, consultas }
  }

  const laEscritura = (c: { sql: string }[]) =>
    c.find((q) => /^\s*update actualizaciones_instancia/i.test(q.sql)) as { sql: string; params?: unknown[] } | undefined

  it('NEGATIVO: con la base SIN la columna (aun sin migrar), escribe lo de siempre y no la nombra', () => {
    const r = correrSonda(false)
    const u = laEscritura(r.consultas)
    expect(u, `la sonda no llego a escribir lo disponible:\n${r.stderr}`).toBeTruthy()
    expect(u!.sql).not.toMatch(/notas_disponibles/)
    expect(u!.params).toEqual(['v0.9.2', 'reg/space-os@sha256:nuevo', null])
    // Y siguio: leyo lo que decidio el dueno despues de escribir.
    expect(r.consultas.some((q) => /^\s*select modo/i.test(q.sql))).toBe(true)
  })

  it('con la columna, la escribe -- y sin archivo de notas la escribe NULL y sigue', () => {
    const r = correrSonda(true)
    const u = laEscritura(r.consultas)
    expect(u, `la sonda no llego a escribir lo disponible:\n${r.stderr}`).toBeTruthy()
    expect(u!.sql).toMatch(/notas_disponibles\s*=\s*\$4/)
    expect(u!.params).toEqual(['v0.9.2', 'reg/space-os@sha256:nuevo', null, null])
    expect(r.consultas.some((q) => /^\s*select modo/i.test(q.sql))).toBe(true)
    // Lo dice en el log de fuera, en vez de callarlo.
    expect(r.stderr).toMatch(/notas/)
  })
})

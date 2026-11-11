import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  La imagen corre un Node CON PARCHES, y el CI prueba esa misma linea.
// ----------------------------------------------------------------------------
//  2026-10-21. Node publico diez CVE de golpe (nodejs.org, «October 2026
//  security releases»), entre ellos un desbordamiento del decodificador Brotli
//  que permite ejecutar codigo (CVE-2026-111497) y dos saltos de la
//  verificacion del nombre en TLS (CVE-2026-105483, CVE-2026-106069). Hay
//  parche para 22.x (v22.23.4), 24.x y 26.x. **Para 20.x no hay ninguno**: es
//  fin de vida desde abril de 2026, y la imagen se construia sobre
//  `node:20-alpine`. O sea: no habia version a la que subir sin cambiar de
//  linea.
//
//  Por que `22.23.4-alpine3.23` y no `node:22-alpine`:
//   · la version COMPLETA, para que dos builds de la misma version de SPACE OS
//     no lleven Node distintos segun el dia en que se construyeron;
//   · `alpine3.23` y no la que toque: `node:22-alpine` ya es Alpine 3.24, con
//     Python 3.14, y psycopg[binary] 3.2.3 (doohmain_sdk/requirements.txt) no
//     tiene rueda para esa version — con `--only-binary` el build se caeria.
//     `node:20-alpine` era Alpine 3.23 (Python 3.12): se conserva la misma.
//
//  Estas pruebas leen los archivos porque la etiqueta base es el unico sitio
//  donde consta que Node lleva la imagen. Lo que atrapan es la vuelta atras
//  silenciosa: alguien que copia un `FROM node:20-alpine` de un documento viejo,
//  o una etiqueta flotante (`node:22-alpine`) que hace que dos builds de «la
//  misma version» lleven Node distintos.
// ============================================================================

const RAIZ = join(__dirname, '..', '..', '..')
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8')

const DOCKERFILE = leer('Dockerfile')
const BASES = [...DOCKERFILE.matchAll(/^FROM\s+(\S+)/gm)].map((m) => m[1])

// La minima con los parches del 21/10 en la linea 22.
const MINIMA: [number, number, number] = [22, 23, 4]

function noMenor(v: [number, number, number], min: [number, number, number]) {
  for (let i = 0; i < 3; i++) {
    if (v[i] !== min[i]) return v[i] > min[i]
  }
  return true
}

describe('la imagen corre un Node parcheado', () => {
  it('las tres etapas parten de una etiqueta base', () => {
    expect(BASES).toHaveLength(3)
  })

  it('cada etapa fija la version COMPLETA de Node, sin etiqueta flotante', () => {
    for (const base of BASES) {
      expect(base).toMatch(/^node:\d+\.\d+\.\d+-alpine\d+\.\d+$/)
    }
  })

  it('ninguna etapa usa una version anterior a la de los parches de octubre', () => {
    for (const base of BASES) {
      const [, a, b, c] = base.match(/^node:(\d+)\.(\d+)\.(\d+)/) ?? []
      expect(a, base).toBe('22')
      expect(noMenor([Number(a), Number(b), Number(c)], MINIMA), base).toBe(true)
    }
  })

  it('las tres etapas usan LA MISMA base', () => {
    // deps compila los modulos nativos y runtime los carga: con Node distintos
    // un modulo nativo se cae al arrancar (NODE_MODULE_VERSION).
    expect(new Set(BASES).size).toBe(1)
  })

  it('se queda en Alpine 3.23, que es donde psycopg[binary] 3.2.3 tiene rueda', () => {
    // `node:22-alpine` a secas apunta a Alpine 3.24, que trae Python 3.14, y
    // psycopg-binary 3.2.3 no publica rueda para esa version: con
    // `--only-binary=:all:` (`imagen-publicacion.test.ts`) el build se caeria.
    // `node:20-alpine` era Alpine 3.23 (Python 3.12): se conserva.
    for (const base of BASES) expect(base).toMatch(/-alpine3\.23$/)
  })
})

describe('el CI prueba la misma linea de Node que corre la imagen', () => {
  const versiones = (archivo: string) =>
    [...leer(archivo).matchAll(/node-version:\s*'([^']+)'/g)].map((m) => m[1])

  it.each(['.github/workflows/ci.yml', '.github/workflows/release.yml', '.github/workflows/lockfile-check.yml'])(
    '%s usa node 22',
    (archivo) => {
      const vs = versiones(archivo)
      expect(vs.length).toBeGreaterThan(0)
      for (const v of vs) expect(v).toBe('22')
    },
  )
})

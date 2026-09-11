# El alta en droplet propio y la licencia firmada — plan de implementación

> **Para quien ejecute esto:** SUB-SKILL OBLIGATORIA — usa
> `superpowers:subagent-driven-development` (recomendada) o
> `superpowers:executing-plans` para implementarlo tarea a tarea. Los pasos van
> con casillas (`- [ ]`) para poder marcarlos.

**Meta:** que SPACE OS se pueda vender por un segundo camino —el cliente crea y
paga su propio droplet y nosotros le entregamos el sistema encima— con una
licencia firmada que el sistema comprueba solo, sin salir a internet.

**Arquitectura:** el PADRE firma una licencia Ed25519 con su llave privada
cifrada; la pública viaja en la máquina del hijo. **`update.sh` apaga y la
aplicación sólo avisa**: la comprobación de firma vive fuera del contenedor, con
`openssl`, así que parchear el JavaScript no cambia nada. Todo el bloque queda
detrás de `LICENCIA_REQUERIDA`, que vale **0 por omisión**, de modo que las tareas
1 a 7 son código que duerme y la flota de hoy no cambia en absoluto.

**Herramientas:** bash + `openssl` en el droplet (sin dependencias nuevas), Node
20 con `node:crypto` en el PADRE, Vitest en `apps/flota` y `apps/web`, nginx.

**Spec:** `docs/superpowers/specs/2026-09-10-alta-en-droplet-propio-design.md`
**Decisión:** `docs/adr/0032-el-alta-en-droplet-propio-del-cliente.md`
**Rama:** `feat/alta-droplet-propio` (ya creada, sale de `main`)

## Restricciones globales

Aplican a **todas** las tareas. No se repiten en cada una.

- **Todo en español**: archivos, funciones, variables, comentarios y mensajes de
  error. Los comentarios explican **el porqué**, no el qué.
- **Commits convencionales en español y sin acentos**:
  `feat(licencia): la instancia comprueba su licencia antes de levantar`.
- **TDD literal**: primero la prueba, **en rojo y a la vista**; la implementación
  en un paso separado. Una tarea sin su rojo demostrado no está hecha.
- **`LICENCIA_REQUERIDA` vale 0 por omisión.** Sin ella, `update.sh` se comporta
  **exactamente** como hoy. Esto se comprueba con un escenario, no se promete.
- **Ninguna dependencia nueva en el droplet.** Sólo lo que ya hay: `bash`,
  `openssl`, `date`, `grep`, `sed`, `docker`, `nginx`. **Nada de `jq`** — es la
  misma razón por la que `update.sh` ya se niega a usarlo.
- **Ningún valor real quemado** en archivos versionados: ni dominios, ni IPs, ni
  tokens, ni llaves privadas. Van como parámetro.
- **Nada de `ssh`, `curl` a producción, `doctl`, `psql` contra un servidor,
  `certbot`, `pm2`, `git push`, `git tag` ni `gh`.** Los comandos contra
  servidores se escriben para que los corra una persona, en una tarjeta.
- **`apps/flota` no viaja en la imagen** — el `Dockerfile` construye con
  `--filter=web`. Por eso el firmador vive ahí: es código del PADRE que **no
  puede** acabar en el droplet de un cliente.
- **Las dos suites se corren desde su carpeta**: `cd apps/web && npm test` y
  `cd apps/flota && npx vitest run`. Desde la raíz dan `Missing script`.
- **La bóveda se actualiza en el MISMO commit que cambia el código** (regla 4 de
  `AGENTES.md`). La tarea 9 recoge lo que quede.

---

## Estructura de archivos

Se decide aquí para que ninguna tarea tenga que inventarse una ruta.

| Archivo | Responsabilidad |
|---|---|
| `infra/licencias/estados.casos.tsv` | **Crear.** El banco de casos de los cuatro estados. Lo leen **las dos** implementaciones |
| `apps/web/lib/licencia.ts` | **Crear.** `estadoDeLicencia()` — función pura, sin fs ni red |
| `apps/web/lib/licencia.test.ts` | **Crear.** Recorre el banco de casos |
| `apps/flota/licencia.mjs` | **Crear.** Firmar y verificar Ed25519. Sólo PADRE |
| `apps/flota/licencia.test.ts` | **Crear.** Ida y vuelta, y los negativos |
| `apps/flota/firmar-licencia.mjs` | **Crear.** El guion que corre una persona |
| `infra/scripts/update.sh` | **Modificar.** `licencia_estado()`, `EX_LICENCIA=8`, el apagado |
| `infra/scripts/pruebas-update.sh` | **Modificar.** Escenarios E107 en adelante |
| `infra/nginx/instancia-sin-licencia.conf.tpl` | **Crear.** El sitio de vencimiento |
| `infra/nginx/publico/licencia-vencida.html` | **Crear.** La página estática |
| `apps/flota/diagnostico.mjs` | **Modificar.** La frase del código 8 |
| `apps/web/components/demo/shell/BandaLicencia.tsx` | **Crear.** La banda |
| `apps/web/app/(app)/(shell)/layout.tsx` | **Modificar.** Lee la licencia y pinta la banda |
| `infra/scripts/instalar-hijo.sh` | **Crear.** El alta que corre el cliente |
| `docs/evidencias/llaves-de-licencia.txt` | **Crear.** Tarjeta: generar y custodiar la llave |
| `docs/evidencias/alta-droplet-propio.txt` | **Crear.** Tarjeta del paquete de alta |
| `docs/evidencias/ensayo-licencia-demo.txt` | **Crear.** Tarjeta del ensayo en DEMO |

### La duplicación que este plan acepta a propósito, y cómo la sujeta

La regla de los cuatro estados se escribe **dos veces**: en bash dentro de
`update.sh` —que es la autoridad y tiene que funcionar fuera del contenedor— y en
TypeScript dentro de la aplicación, que la usa para pintar la banda. No se puede
evitar: son dos lenguajes en dos procesos distintos, y unificarlas metería Node
en la ruta crítica del update.

Lo que sí se puede evitar es que **se separen sin que nadie se entere**, y para
eso está `infra/licencias/estados.casos.tsv`: **las dos suites leen el mismo
archivo**. Un caso nuevo que una implementación no cumpla pone en rojo esa suite.

Es TSV y no JSON por una razón concreta: `awk` lo lee en una línea y el arnés de
bash no puede usar `jq`.

---

## Tarea 1: el banco de casos y `estadoDeLicencia()`

**Archivos:**
- Crear: `infra/licencias/estados.casos.tsv`
- Crear: `apps/web/lib/licencia.ts`
- Crear: `apps/web/lib/licencia.test.ts`

**Interfaces:**
- Consume: nada. Es la primera tarea.
- Produce: `type EstadoLicencia = 'sana' | 'aviso' | 'gracia' | 'vencida' | 'invalida'`
  y `estadoDeLicencia(licencia: unknown, ahora: Date): EstadoLicencia`, donde
  `licencia` es el objeto ya parseado de `licencia.json`. Y el archivo
  `infra/licencias/estados.casos.tsv`, que la tarea 4 vuelve a leer desde bash.

- [ ] **Paso 1: escribir el banco de casos**

Crear `infra/licencias/estados.casos.tsv`. Las columnas van separadas por **un
tabulador**, no por espacios:

```tsv
# El banco de casos de los cuatro estados de una licencia.
#
# Lo leen DOS implementaciones que no comparten una linea de codigo:
# `apps/web/lib/licencia.test.ts` (la que pinta la banda) e
# `infra/scripts/pruebas-update.sh` (la que APAGA la instancia). Escribir la
# regla dos veces es inevitable -- bash fuera del contenedor, TypeScript dentro
# -- pero que se separen sin que nadie se entere, no.
#
# Es TSV y no JSON porque el arnes de bash no puede usar `jq`, y `awk` lee esto
# en una linea.
#
# Todas las fechas se interpretan como medianoche UTC, en los dos lados.
#
# vence	aviso_dias	gracia_dias	hoy	estado
2027-01-01	30	15	2026-11-01	sana
2027-01-01	30	15	2026-12-01	sana
2027-01-01	30	15	2026-12-02	aviso
2027-01-01	30	15	2026-12-31	aviso
2027-01-01	30	15	2027-01-01	gracia
2027-01-01	30	15	2027-01-15	gracia
2027-01-01	30	15	2027-01-16	vencida
2027-01-01	30	15	2027-06-01	vencida
2027-01-01	0	0	2026-12-31	aviso
2027-01-01	0	0	2027-01-01	vencida
```

Los tres bordes que importan y por eso están: **el día exacto en que empieza el
aviso** (`2026-12-02`), **el día del vencimiento**, que es gracia y no apagado
(`2027-01-01`), y **el primer día apagado** (`2027-01-16`). Las dos últimas
filas son el caso degenerado sin aviso ni gracia, que tiene que seguir
distinguiendo el antes del después.

- [ ] **Paso 2: escribir la prueba en rojo**

Crear `apps/web/lib/licencia.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { estadoDeLicencia } from './licencia'

// El banco vive fuera de `apps/web` a proposito: lo comparte con el arnes de
// `update.sh`, que es la otra implementacion de esta misma regla.
const BANCO = join(__dirname, '../../../infra/licencias/estados.casos.tsv')

function casos() {
  return readFileSync(BANCO, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [vence, aviso_dias, gracia_dias, hoy, estado] = l.split('\t')
      return { vence, aviso_dias: Number(aviso_dias), gracia_dias: Number(gracia_dias), hoy, estado }
    })
}

describe('estadoDeLicencia · el banco de casos compartido', () => {
  // Si el banco se queda vacio por un error de ruta, todos los `it` de abajo
  // desaparecen y la suite pasa en verde sin haber comprobado nada. Esta linea
  // es lo unico que separa "cero fallos" de "cero pruebas".
  it('el banco se lee y tiene casos', () => {
    expect(casos().length).toBeGreaterThanOrEqual(10)
  })

  for (const c of casos()) {
    it(`vence ${c.vence} · aviso ${c.aviso_dias} · gracia ${c.gracia_dias} · hoy ${c.hoy} -> ${c.estado}`, () => {
      const licencia = {
        instancia: 'pixeled',
        dominio: 'pixeled.ejemplo.invalid',
        emitida: '2026-01-01',
        vence: c.vence,
        aviso_dias: c.aviso_dias,
        gracia_dias: c.gracia_dias,
      }
      expect(estadoDeLicencia(licencia, new Date(`${c.hoy}T00:00:00Z`))).toBe(c.estado)
    })
  }
})

// Y los negativos, que son el corazon: una licencia rota NUNCA se lee como sana.
// Es la direccion en la que un fallo hace dano -- dar por buena la que no lo es.
describe('estadoDeLicencia · lo que no es una licencia', () => {
  const base = {
    instancia: 'pixeled',
    dominio: 'pixeled.ejemplo.invalid',
    emitida: '2026-01-01',
    vence: '2027-01-01',
    aviso_dias: 30,
    gracia_dias: 15,
  }
  const ahora = new Date('2026-11-01T00:00:00Z')

  it('sin objeto es invalida', () => {
    expect(estadoDeLicencia(null, ahora)).toBe('invalida')
    expect(estadoDeLicencia(undefined, ahora)).toBe('invalida')
    expect(estadoDeLicencia('2027-01-01', ahora)).toBe('invalida')
  })

  it('sin `vence` es invalida, no sana', () => {
    const { vence, ...sinVence } = base
    expect(estadoDeLicencia(sinVence, ahora)).toBe('invalida')
  })

  it('una fecha que no es una fecha es invalida', () => {
    expect(estadoDeLicencia({ ...base, vence: 'el mes que viene' }, ahora)).toBe('invalida')
  })

  it('los dias que no son numeros no caen a un valor por omision', () => {
    expect(estadoDeLicencia({ ...base, aviso_dias: 'treinta' }, ahora)).toBe('invalida')
    expect(estadoDeLicencia({ ...base, gracia_dias: -1 }, ahora)).toBe('invalida')
  })
})
```

- [ ] **Paso 3: correrla y ver el rojo**

```
cd apps/web && npx vitest run lib/licencia.test.ts
```

Esperado: **FALLA** con `Failed to resolve import "./licencia"`.

- [ ] **Paso 4: escribir la implementación mínima**

Crear `apps/web/lib/licencia.ts`:

```ts
// ============================================================================
//  licencia.ts — los cuatro estados de una licencia, y nada mas.
// ----------------------------------------------------------------------------
//  Funcion PURA: no lee archivos, no sale a la red y no comprueba ninguna firma.
//
//  Lo de la firma no es un olvido. Esta aplicacion corre en la maquina del
//  cliente y el cliente tiene root, asi que su veredicto nunca seria de fiar.
//  El veredicto que cuenta lo da `update.sh` con `openssl`, FUERA del
//  contenedor, y es el unico que apaga algo. Aqui solo se decide que se pinta.
//
//  La misma regla esta escrita en bash dentro de `update.sh`. Que las dos no se
//  separen lo sujeta `infra/licencias/estados.casos.tsv`, que leen las dos
//  suites.
// ============================================================================

export type EstadoLicencia = 'sana' | 'aviso' | 'gracia' | 'vencida' | 'invalida'

const DIA = 24 * 60 * 60 * 1000

function esDiaEntero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0
}

/** Medianoche UTC de una fecha `YYYY-MM-DD`, o `null` si no lo es. */
function medianocheUTC(valor: unknown): number | null {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const t = Date.parse(`${valor}T00:00:00Z`)
  return Number.isNaN(t) ? null : t
}

export function estadoDeLicencia(licencia: unknown, ahora: Date): EstadoLicencia {
  if (typeof licencia !== 'object' || licencia === null || Array.isArray(licencia)) {
    return 'invalida'
  }
  const l = licencia as Record<string, unknown>

  const vence = medianocheUTC(l.vence)
  if (vence === null) return 'invalida'
  // Un campo ilegible NO cae a un valor por omision: una licencia a medias es
  // una licencia rota, y elegir por ella seria inventarse lo que se concedio.
  if (!esDiaEntero(l.aviso_dias) || !esDiaEntero(l.gracia_dias)) return 'invalida'

  const t = ahora.getTime()
  const inicioAviso = vence - l.aviso_dias * DIA
  const finGracia = vence + l.gracia_dias * DIA

  if (t < inicioAviso) return 'sana'
  if (t < vence) return 'aviso'
  if (t < finGracia) return 'gracia'
  return 'vencida'
}
```

- [ ] **Paso 5: correrla y ver el verde**

```
cd apps/web && npx vitest run lib/licencia.test.ts
```

Esperado: **PASA**, con al menos 15 pruebas.

- [ ] **Paso 6: la suite entera, para saber que no se rompió nada**

```
cd apps/web && npm run typecheck && npm test
```

Esperado: typecheck limpio y **1115 pruebas o más** en verde.

- [ ] **Paso 7: commit**

```bash
git add infra/licencias/estados.casos.tsv apps/web/lib/licencia.ts apps/web/lib/licencia.test.ts
git commit -m "feat(licencia): los cuatro estados, con el banco de casos que compartiran las dos implementaciones"
```

---

## Tarea 2: firmar y verificar, en el PADRE

**Archivos:**
- Crear: `apps/flota/licencia.mjs`
- Crear: `apps/flota/licencia.test.ts`

**Interfaces:**
- Consume: nada de la tarea 1 (el estado y la firma son cosas distintas).
- Produce:
  - `construirLicencia({ instancia, dominio, vence, avisoDias, graciaDias, emitida })
     → string` (el JSON exacto que se firma, con salto de línea final)
  - `firmar(json: string, llavePrivada: KeyObject) → Buffer`
  - `verificar(json: string, firma: Buffer, llavePublica: KeyObject) → boolean`
  - `NOMBRE_VALIDO_INSTANCIA: RegExp`

**Por qué vive en `apps/flota` y no en `infra/`:** es código del PADRE que **no
puede acabar en el droplet de un cliente**, y `apps/flota` es exactamente la
carpeta que el repositorio ya creó para eso — el `Dockerfile` construye con
`--filter=web`, así que nada de ahí viaja en la imagen. Además ya tiene su propio
`vitest`, así que no hace falta montar un arnés nuevo.

- [ ] **Paso 1: escribir la prueba en rojo**

Crear `apps/flota/licencia.test.ts`:

```ts
import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { NOMBRE_VALIDO_INSTANCIA, construirLicencia, firmar, verificar } from './licencia.mjs'

const par = () => generateKeyPairSync('ed25519')
const otro = () => generateKeyPairSync('ed25519')

const datos = {
  instancia: 'pixeled',
  dominio: 'pixeled.ejemplo.invalid',
  vence: '2027-01-01',
  avisoDias: 30,
  graciaDias: 15,
  emitida: '2026-09-10',
}

describe('construirLicencia', () => {
  it('produce un JSON legible por una persona', () => {
    const json = construirLicencia(datos)
    expect(JSON.parse(json)).toEqual({
      instancia: 'pixeled',
      dominio: 'pixeled.ejemplo.invalid',
      emitida: '2026-09-10',
      vence: '2027-01-01',
      aviso_dias: 30,
      gracia_dias: 15,
    })
    // Con saltos de linea dentro: el cliente puede abrirlo y leerlo. Un archivo
    // opaco no compraria nada -- lo que lo sujeta es la firma, no la ofuscacion.
    expect(json).toContain('\n')
  })

  // Los bytes firmados tienen que ser SIEMPRE los mismos para los mismos datos.
  // Si `construirLicencia` reordenara claves o cambiara el espaciado entre dos
  // corridas, la firma dejaria de validar sin que nadie hubiera tocado nada.
  it('es reproducible byte a byte', () => {
    expect(construirLicencia(datos)).toBe(construirLicencia({ ...datos }))
  })

  it('rechaza un nombre de instancia que el receptor no aceptaria', () => {
    expect(() => construirLicencia({ ...datos, instancia: 'Pixeled S.A.' })).toThrow()
    expect(NOMBRE_VALIDO_INSTANCIA.test('pixeled')).toBe(true)
    expect(NOMBRE_VALIDO_INSTANCIA.test('Pixeled')).toBe(false)
  })

  it('rechaza una fecha que no tiene forma de fecha', () => {
    expect(() => construirLicencia({ ...datos, vence: '01/01/2027' })).toThrow()
  })
})

describe('firmar y verificar', () => {
  it('ida y vuelta: lo que se firma, valida', () => {
    const { privateKey, publicKey } = par()
    const json = construirLicencia(datos)
    expect(verificar(json, firmar(json, privateKey), publicKey)).toBe(true)
  })

  // LOS TRES NEGATIVOS, que son la razon de que exista la firma.
  it('un solo caracter cambiado invalida la firma', () => {
    const { privateKey, publicKey } = par()
    const json = construirLicencia(datos)
    const f = firmar(json, privateKey)
    const manipulado = json.replace('2027-01-01', '2099-01-01')
    expect(verificar(manipulado, f, publicKey)).toBe(false)
  })

  it('cambiar la instancia invalida la firma: no se puede copiar a otra maquina', () => {
    const { privateKey, publicKey } = par()
    const json = construirLicencia(datos)
    const f = firmar(json, privateKey)
    expect(verificar(json.replace('pixeled', 'otracosa'), f, publicKey)).toBe(false)
  })

  it('otra llave no vale: firmarse una licencia uno mismo no funciona', () => {
    const mia = par()
    const suya = otro()
    const json = construirLicencia(datos)
    expect(verificar(json, firmar(json, suya.privateKey), mia.publicKey)).toBe(false)
  })

  it('una firma corrupta no revienta: devuelve false', () => {
    const { privateKey, publicKey } = par()
    const json = construirLicencia(datos)
    const f = Buffer.from(firmar(json, privateKey))
    f[0] = f[0] ^ 0xff
    expect(verificar(json, f, publicKey)).toBe(false)
    expect(verificar(json, Buffer.alloc(0), publicKey)).toBe(false)
  })
})
```

- [ ] **Paso 2: correrla y ver el rojo**

```
cd apps/flota && npx vitest run licencia.test.ts
```

Esperado: **FALLA** con `Failed to resolve import "./licencia.mjs"`.

- [ ] **Paso 3: escribir la implementación**

Crear `apps/flota/licencia.mjs`:

```js
// ============================================================================
//  licencia.mjs — el PADRE firma; cualquiera puede verificar.
// ----------------------------------------------------------------------------
//  Ed25519, que es lo que `openssl pkeyutl -verify -rawin` sabe comprobar en el
//  droplet sin instalar nada. Esa restriccion es la que eligio el algoritmo: la
//  otra punta de esto es bash.
//
//  ─── Esto NO viaja en la imagen, y no es casualidad ───────────────────────
//  Vive en `apps/flota` porque el `Dockerfile` construye con `--filter=web`.
//  Firmar licencias es del PADRE; si este archivo acabara en el droplet de un
//  cliente, la mitad del mecanismo estaria en la maquina de quien tiene interes
//  en saltarselo. La llave privada nunca sale del PADRE de todos modos, pero la
//  frontera se pone donde se puede comprobar.
//
//  ─── Los bytes firmados son EXACTAMENTE los del archivo ───────────────────
//  No se firma un objeto: se firma la cadena que se escribe en disco. Firmar una
//  representacion y guardar otra es como se rompen estas cosas en silencio -- un
//  reordenamiento de claves o un espacio de mas y la firma deja de validar sin
//  que nadie haya tocado nada.
// ============================================================================

import { sign, verify } from 'node:crypto'

/** Un nombre de instancia es un identificador, no texto libre. El mismo que usa
 *  el receptor de reportes (`reporte.mjs`), porque nombran la misma cosa. */
export const NOMBRE_VALIDO_INSTANCIA = /^[a-z0-9][a-z0-9-]{0,39}$/

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/

function exigirFecha(nombre, valor) {
  if (typeof valor !== 'string' || !FECHA_VALIDA.test(valor)) {
    throw new Error(`\`${nombre}\` no es una fecha YYYY-MM-DD: ${String(valor)}`)
  }
  if (Number.isNaN(Date.parse(`${valor}T00:00:00Z`))) {
    throw new Error(`\`${nombre}\` tiene forma de fecha pero no existe: ${valor}`)
  }
}

function exigirDias(nombre, valor) {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`\`${nombre}\` no es un numero entero de dias: ${String(valor)}`)
  }
}

/**
 * El JSON exacto que se firma y se escribe. El orden de las claves es fijo y la
 * indentacion tambien: son los bytes que cubre la firma.
 */
export function construirLicencia({ instancia, dominio, vence, avisoDias, graciaDias, emitida }) {
  if (typeof instancia !== 'string' || !NOMBRE_VALIDO_INSTANCIA.test(instancia)) {
    throw new Error(`\`instancia\` no es un nombre valido (minusculas, digitos y guiones): ${String(instancia)}`)
  }
  if (typeof dominio !== 'string' || !dominio.includes('.') || /\s/.test(dominio)) {
    throw new Error(`\`dominio\` no parece un dominio: ${String(dominio)}`)
  }
  exigirFecha('emitida', emitida)
  exigirFecha('vence', vence)
  exigirDias('aviso_dias', avisoDias)
  exigirDias('gracia_dias', graciaDias)

  const cuerpo = {
    instancia,
    dominio,
    emitida,
    vence,
    aviso_dias: avisoDias,
    gracia_dias: graciaDias,
  }
  // El salto final es a proposito: un archivo de texto sin el ultimo salto es
  // el que rompe `cat`, los editores y los diffs.
  return JSON.stringify(cuerpo, null, 2) + '\n'
}

/** Ed25519 no lleva funcion de resumen aparte: por eso el algoritmo va en `null`. */
export function firmar(json, llavePrivada) {
  return sign(null, Buffer.from(json, 'utf8'), llavePrivada)
}

/** Nunca lanza: una firma corrupta es un `false`, no una excepcion que alguien
 *  pueda dejarse sin capturar en la ruta que decide si una instancia arranca. */
export function verificar(json, firma, llavePublica) {
  try {
    return verify(null, Buffer.from(json, 'utf8'), llavePublica, firma)
  } catch {
    return false
  }
}
```

- [ ] **Paso 4: correrla y ver el verde**

```
cd apps/flota && npx vitest run licencia.test.ts
```

Esperado: **PASA**, 9 pruebas.

- [ ] **Paso 5: la suite entera de flota**

```
cd apps/flota && npx vitest run
```

Esperado: **283 pruebas o más** en verde (274 de antes + las nuevas).

- [ ] **Paso 6: commit**

```bash
git add apps/flota/licencia.mjs apps/flota/licencia.test.ts
git commit -m "feat(licencia): el padre firma con ed25519, y una licencia no se puede copiar a otra maquina"
```

---

## Tarea 3: el guion que corre una persona, y la tarjeta de las llaves

**Archivos:**
- Crear: `apps/flota/firmar-licencia.mjs`
- Crear: `docs/evidencias/llaves-de-licencia.txt`

**Interfaces:**
- Consume: `construirLicencia`, `firmar` de `apps/flota/licencia.mjs`.
- Produce: el ejecutable
  `node firmar-licencia.mjs --instancia <n> --dominio <d> --vence <YYYY-MM-DD>
   [--aviso-dias 30] [--gracia-dias 15] [--llave <ruta>] [--salida <dir>]`,
  que escribe `licencia.json` y `licencia.firma`.

- [ ] **Paso 1: escribir el guion**

Crear `apps/flota/firmar-licencia.mjs`:

```js
#!/usr/bin/env node
// ============================================================================
//  firmar-licencia.mjs — emitir o renovar la licencia de un hijo.
// ----------------------------------------------------------------------------
//  Lo corre UNA PERSONA en el PADRE. No entra en la maquina de estados
//  desatendida del ADR 0029, y la razon es la misma por la que su punto 5 dejo
//  fuera el bootstrap: firmar dice «este cliente pago, hasta esta fecha», y eso
//  es un acto comercial. Con licencias mensuales o anuales son un punado de
//  firmas al ano.
//
//  Uso:
//    node firmar-licencia.mjs --instancia pixeled \
//         --dominio pixeled.ejemplo.com --vence 2027-09-10
//
//  La frase de paso se pide por la TERMINAL y nunca por argumento: un argumento
//  acaba en el historial del shell y en `ps`.
// ============================================================================

import { createPrivateKey } from 'node:crypto'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

import { construirLicencia, firmar } from './licencia.mjs'

function argumento(nombre, porOmision = undefined) {
  const i = process.argv.indexOf(`--${nombre}`)
  if (i === -1 || i === process.argv.length - 1) return porOmision
  return process.argv[i + 1]
}

function hoyUTC() {
  return new Date().toISOString().slice(0, 10)
}

/** Lee la frase de paso sin hacerla eco en la pantalla. */
function pedirFrase() {
  return new Promise((resolver) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    // `_writeToOutput` vacio: readline sigue leyendo, pero no imprime nada. Sin
    // esto la frase queda en el scrollback de la terminal, que es casi tan malo
    // como tenerla en un archivo.
    rl._writeToOutput = () => {}
    process.stdout.write('Frase de paso de la llave privada: ')
    rl.question('', (respuesta) => {
      rl.close()
      process.stdout.write('\n')
      resolver(respuesta)
    })
  })
}

const instancia = argumento('instancia')
const dominio = argumento('dominio')
const vence = argumento('vence')
const avisoDias = Number(argumento('aviso-dias', '30'))
const graciaDias = Number(argumento('gracia-dias', '15'))
const rutaLlave = argumento('llave', '/etc/space-os/llaves/space-os.key.pem')
const salida = argumento('salida', '.')

if (!instancia || !dominio || !vence) {
  console.error('uso: firmar-licencia.mjs --instancia <n> --dominio <d> --vence <YYYY-MM-DD>')
  console.error('     [--aviso-dias 30] [--gracia-dias 15] [--llave <ruta>] [--salida <dir>]')
  process.exit(64)
}

// Se construye ANTES de pedir la frase de paso: si los datos estan mal, que
// falle sin haber descifrado nada.
let json
try {
  json = construirLicencia({
    instancia, dominio, vence, avisoDias, graciaDias, emitida: hoyUTC(),
  })
} catch (error) {
  console.error(`firmar-licencia: ${error.message}`)
  process.exit(64)
}

const frase = await pedirFrase()

let llavePrivada
try {
  llavePrivada = createPrivateKey({
    key: readFileSync(rutaLlave, 'utf8'),
    format: 'pem',
    passphrase: frase,
  })
} catch (error) {
  // Sin detalles del error: distinguir «frase mal» de «archivo corrupto» le da
  // informacion a quien esta probando frases.
  console.error(`firmar-licencia: no se pudo abrir la llave privada en ${rutaLlave}`)
  console.error('  o la frase de paso no es la correcta, o el archivo no es una llave.')
  process.exit(1)
}

mkdirSync(salida, { recursive: true })
const destinoJson = join(salida, 'licencia.json')
const destinoFirma = join(salida, 'licencia.firma')
writeFileSync(destinoJson, json, 'utf8')
writeFileSync(destinoFirma, firmar(json, llavePrivada))

const sha = (ruta) => createHash('sha256').update(readFileSync(ruta)).digest('hex')

console.log('')
console.log(json.trimEnd())
console.log('')
console.log(`  ${destinoJson}`)
console.log(`    sha256 ${sha(destinoJson)}`)
console.log(`  ${destinoFirma}`)
console.log(`    sha256 ${sha(destinoFirma)}`)
console.log('')
console.log('Los dos archivos van al hijo, a /etc/space-os/licencia/.')
console.log('Las sumas son para que quien los reciba compruebe que llegaron enteros.')
```

- [ ] **Paso 2: probarlo de punta a punta, con llaves de usar y tirar**

Esto no es una prueba automática: es la comprobación de que el guion **funciona
de verdad con `openssl`**, que es la otra punta. Se corre una vez, a mano, en un
directorio temporal:

```bash
cd apps/flota
D=$(mktemp -d)
openssl genpkey -algorithm ed25519 -out "$D/k.pem" -aes256 -pass pass:prueba
openssl pkey -in "$D/k.pem" -passin pass:prueba -pubout -out "$D/k.pub"
printf 'prueba\n' | node firmar-licencia.mjs --instancia pixeled \
  --dominio pixeled.ejemplo.invalid --vence 2027-01-01 --llave "$D/k.pem" --salida "$D"
openssl pkeyutl -verify -pubin -inkey "$D/k.pub" -rawin -in "$D/licencia.json" -sigfile "$D/licencia.firma"
```

Esperado: la última línea imprime **`Signature Verified Successfully`**. Ése es
el momento en que se sabe que Node y `openssl` hablan el mismo idioma; si esto
falla, nada de lo que viene después puede funcionar.

Después, `rm -rf "$D"`.

- [ ] **Paso 3: escribir la tarjeta de las llaves**

Crear `docs/evidencias/llaves-de-licencia.txt`, con la cabecera y los bloques
`[LOCAL]` / `[SERVIDOR]` de las demás tarjetas del proyecto. Contenido
obligatorio:

- **La generación**, que se hace **una sola vez** y en el PADRE:
  `openssl genpkey -algorithm ed25519 -out /etc/space-os/llaves/space-os.key.pem -aes256`
  (pide la frase de paso dos veces y **no la escribe en ningún sitio**), y
  `openssl pkey -in … -pubout -out /etc/space-os/llaves/space-os.pub`.
- **Los permisos**: `chmod 600` la privada, `chmod 644` la pública, y el
  directorio `700`.
- **Dónde va la pública**: al repositorio, en `infra/licencias/space-os.pub`. No
  es un secreto y tiene que viajar con el instalador.
- **La frase de paso NO va a ningún archivo, ni a un gestor compartido del que
  cualquiera pueda sacarla sin dejar rastro.** Dónde vive es una decisión de
  Emiliano y la tarjeta la pide explícitamente en vez de suponerla.
- **El respaldo de la llave privada es tan valioso como la llave** — la tarjeta
  lo dice con esas palabras. Perderla significa no poder renovar ninguna
  licencia; filtrarla significa que cualquiera puede emitirlas.
- **Y el bloque de rotación**, comentado y bajo el banner
  `⛔ LO DE ABAJO NO ES EL PASO SIGUIENTE`: qué hacer si se filtra —llave nueva,
  imagen nueva, y relicenciar a todos los hijos— dicho para que se sepa de
  antemano lo que cuesta.

- [ ] **Paso 4: commit**

```bash
git add apps/flota/firmar-licencia.mjs docs/evidencias/llaves-de-licencia.txt
git commit -m "feat(licencia): el guion de firma, con la frase de paso por terminal y nunca en argv"
```

---

## Tarea 4: `update.sh` comprueba la licencia — todavía sin apagar

**Archivos:**
- Modificar: `infra/scripts/update.sh` (bloque nuevo tras la lectura de
  configuración, antes del paso 1)
- Modificar: `infra/scripts/pruebas-update.sh` (escenarios E107–E115)

**Interfaces:**
- Consume: `infra/licencias/estados.casos.tsv` (tarea 1), y el formato de
  licencia de la tarea 2.
- Produce, para la tarea 5: la variable `LICENCIA_ESTADO`, con uno de
  `sana | aviso | gracia | vencida | invalida | no-aplica`, y las funciones
  `licencia_valida()` y `licencia_estado()`.

**Esta tarea NO apaga nada.** Sólo decide y lo registra. Se separa de la 5 a
propósito: así se puede demostrar que la decisión es correcta **antes** de darle
poder para detener un contenedor, y un revisor puede rechazar el apagado sin
rechazar la comprobación.

- [ ] **Paso 1: escribir los escenarios en rojo**

En `infra/scripts/pruebas-update.sh`, junto a los demás ayudantes (después de
`usar_flota`), añadir el que fabrica licencias. **El arnés genera su propio par
de llaves en cada escenario**: sin llaves de verdad, sin red y sin nada
compartido entre escenarios.

```sh
# Fabrica una licencia FIRMADA para este escenario, con su propio par de llaves.
#   usar_licencia <vence> [aviso_dias] [gracia_dias] [instancia] [dominio]
# Deja `LICENCIA_REQUERIDA=1` en la configuracion y las rutas apuntando al
# directorio temporal.
usar_licencia() {
  local vence="$1" aviso="${2:-30}" gracia="${3:-15}"
  local inst="${4:-demo}" dom="${5:-demo.ejemplo.invalid}"
  mkdir -p "$RAIZ_TMP/licencia"
  openssl genpkey -algorithm ed25519 -out "$RAIZ_TMP/k.pem" 2>/dev/null
  openssl pkey -in "$RAIZ_TMP/k.pem" -pubout -out "$RAIZ_TMP/k.pub" 2>/dev/null
  cat >"$RAIZ_TMP/licencia/licencia.json" <<FIN
{
  "instancia": "$inst",
  "dominio": "$dom",
  "emitida": "2026-01-01",
  "vence": "$vence",
  "aviso_dias": $aviso,
  "gracia_dias": $gracia
}
FIN
  openssl pkeyutl -sign -inkey "$RAIZ_TMP/k.pem" -rawin \
    -in "$RAIZ_TMP/licencia/licencia.json" \
    -out "$RAIZ_TMP/licencia/licencia.firma" 2>/dev/null
  cat >>"$SPACE_OS_CONF" <<FIN
LICENCIA_REQUERIDA=1
LICENCIA_DIR=$RAIZ_TMP/licencia
LICENCIA_PUB=$RAIZ_TMP/k.pub
DOMINIO=$dom
FIN
}

# Recorre el banco de casos COMPARTIDO con `apps/web`. Que las dos
# implementaciones de la misma regla no se separen es todo el motivo de que ese
# archivo exista, y esto es la mitad que lo comprueba desde bash.
escenarios_del_banco() {
  local banco="$RAIZ/infra/licencias/estados.casos.tsv" n=0
  while IFS=$'\t' read -r vence aviso gracia hoy estado; do
    case "$vence" in ''|'#'*) continue ;; esac
    n=$((n + 1))
    preparar "E107.$n banco de casos: vence $vence, hoy $hoy -> $estado"
    usar_licencia "$vence" "$aviso" "$gracia"
    # `LICENCIA_HOY` existe SOLO para las pruebas: sin el no se puede comprobar
    # una fecha futura sin cambiarle el reloj a la maquina que corre el arnes.
    export LICENCIA_HOY="$hoy"
    correr
    log_dice "licencia: $estado"
    unset LICENCIA_HOY
    limpiar
  done <"$banco"
  if [ "$n" -lt 10 ]; then
    ESCENARIO_ACTUAL='banco de casos'
    mal "el banco de casos se leyo vacio o a medias ($n casos): la ruta esta mal"
  fi
}
```

Y los escenarios sueltos, antes del `printf` del resumen:

```sh
# ─── LA LICENCIA (E107-E115) ───────────────────────────────────────────────
#  El cliente es dueno de su droplet: la licencia es lo que dice hasta cuando
#  puede correr nuestro sistema. Todo esto vive detras de `LICENCIA_REQUERIDA`,
#  que vale 0 por omision -- E115 es el escenario que lo demuestra, y es el que
#  garantiza que la flota administrada de hoy no cambia en absoluto.

escenarios_del_banco

preparar 'E108 sin LICENCIA_REQUERIDA no se mira nada, aunque haya licencia vencida'
usar_licencia '2020-01-01'
# Se pisa la que dejo `usar_licencia`: la ultima gana al hacer `source`.
cat >>"$SPACE_OS_CONF" <<'FIN'
LICENCIA_REQUERIDA=0
FIN
correr
codigo_es 0
log_calla 'licencia'
limpiar

preparar 'E109 una firma que no valida es INVALIDA, nunca "se asume buena"'
usar_licencia '2027-01-01'
printf 'x' >>"$RAIZ_TMP/licencia/licencia.json"
export LICENCIA_HOY='2026-11-01'
correr
log_dice 'licencia: invalida'
unset LICENCIA_HOY
limpiar

preparar 'E110 una licencia de OTRA instancia no vale'
usar_licencia '2027-01-01' 30 15 'otracosa' 'demo.ejemplo.invalid'
export LICENCIA_HOY='2026-11-01'
correr
log_dice 'licencia: invalida'
log_dice 'no es de esta instancia'
unset LICENCIA_HOY
limpiar

preparar 'E111 una licencia de OTRO dominio no vale'
usar_licencia '2027-01-01' 30 15 'demo' 'otra.ejemplo.invalid'
export LICENCIA_HOY='2026-11-01'
correr
log_dice 'licencia: invalida'
unset LICENCIA_HOY
limpiar

preparar 'E112 sin el archivo de firma es invalida'
usar_licencia '2027-01-01'
rm -f "$RAIZ_TMP/licencia/licencia.firma"
export LICENCIA_HOY='2026-11-01'
correr
log_dice 'licencia: invalida'
unset LICENCIA_HOY
limpiar

preparar 'E113 un campo que falta NO cae a un valor por omision'
usar_licencia '2027-01-01'
grep -v 'gracia_dias' "$RAIZ_TMP/licencia/licencia.json" >"$RAIZ_TMP/l.tmp"
# Se quita la coma que colgaba de la linea anterior para que siga siendo JSON.
sed -i 's/"aviso_dias": 30,/"aviso_dias": 30/' "$RAIZ_TMP/l.tmp"
mv "$RAIZ_TMP/l.tmp" "$RAIZ_TMP/licencia/licencia.json"
openssl pkeyutl -sign -inkey "$RAIZ_TMP/k.pem" -rawin \
  -in "$RAIZ_TMP/licencia/licencia.json" -out "$RAIZ_TMP/licencia/licencia.firma" 2>/dev/null
export LICENCIA_HOY='2026-11-01'
correr
log_dice 'licencia: invalida'
unset LICENCIA_HOY
limpiar

preparar 'E114 con LICENCIA_REQUERIDA=1 y sin licencia, es invalida'
cat >>"$SPACE_OS_CONF" <<FIN
LICENCIA_REQUERIDA=1
LICENCIA_DIR=$RAIZ_TMP/no-existe
LICENCIA_PUB=$RAIZ_TMP/tampoco.pub
FIN
correr
log_dice 'licencia: invalida'
limpiar

# EL escenario que protege a la flota de hoy: sin la variable, ni una linea del
# bloque nuevo se ejecuta y el update es el de siempre.
preparar 'E115 sin la variable en la configuracion, el update es identico al de hoy'
correr
codigo_es 0
log_calla 'licencia'
limpiar
```

- [ ] **Paso 2: correr el arnés y ver el rojo**

```
bash infra/scripts/pruebas-update.sh
```

Esperado: **FALLA** — todos los `log_dice 'licencia: …'` en rojo, porque
`update.sh` todavía no imprime esa línea. `E108` y `E115` pasan desde el
principio: son el estado actual.

- [ ] **Paso 3: escribir la comprobación en `update.sh`**

Junto a los demás códigos de salida (donde están `EX_OK` … `EX_OCUPADO`):

```sh
EX_LICENCIA=8    # la licencia vencio: esta instancia esta APAGADA a proposito
```

Y el bloque, **después** de leer la configuración y **antes** del paso 1:

```sh
# ─── La licencia (ADR 0032) ────────────────────────────────────────────────
#  Un hijo de «droplet propio» corre en la maquina del cliente, que es suya y
#  donde el tiene root. La licencia es lo que dice hasta cuando puede correr
#  nuestro sistema.
#
#  ─── Por que la comprobacion esta AQUI y no dentro de la aplicacion ───────
#  Porque el cliente puede reescribir todo el JavaScript que quiera: si quien
#  decide fuera la aplicacion, decidiria el. Aqui, fuera del contenedor, lo que
#  tendria que reescribir es este guion -- y entonces deja de reportar bien al
#  padre, y el silencio ya es un estado en el panel de flota. No podemos
#  impedirlo; podemos hacer que no se pueda esconder.
#
#  ─── Y por que vale 0 por omision ─────────────────────────────────────────
#  Los hijos que damos de alta nosotros NO llevan licencia: la maquina es
#  nuestra y apagarla es trivial. Sin esta variable no se ejecuta ni una linea
#  de lo de abajo, y este guion se comporta exactamente como el de siempre. Lo
#  comprueba E115.
LICENCIA_REQUERIDA="${LICENCIA_REQUERIDA:-0}"
LICENCIA_DIR="${LICENCIA_DIR:-/etc/space-os/licencia}"
LICENCIA_PUB="${LICENCIA_PUB:-/opt/space-os/space-os.pub}"
LICENCIA_ESTADO='no-aplica'

# Lee un campo de texto del JSON. Se llama SOLO despues de que la firma valide:
# decidir con un JSON sin firmar seria confiar en un archivo que cualquiera
# puede escribir. Y es un analizador pobre a proposito -- no hay `jq` en el
# droplet, el archivo lo escribimos nosotros y su forma es fija.
licencia_texto() {
  grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$LICENCIA_DIR/licencia.json" 2>/dev/null \
    | head -n1 | sed 's/.*:[[:space:]]*"//; s/"$//'
}

licencia_numero() {
  grep -o "\"$1\"[[:space:]]*:[[:space:]]*[0-9][0-9]*" "$LICENCIA_DIR/licencia.json" 2>/dev/null \
    | head -n1 | sed 's/.*:[[:space:]]*//'
}

# 0 si la firma valida Y la licencia es de ESTA instancia y ESTE dominio.
licencia_valida() {
  [ -f "$LICENCIA_DIR/licencia.json" ] || { registrar "   licencia: no hay licencia.json en $LICENCIA_DIR"; return 1; }
  [ -f "$LICENCIA_DIR/licencia.firma" ] || { registrar "   licencia: no hay licencia.firma en $LICENCIA_DIR"; return 1; }
  [ -f "$LICENCIA_PUB" ] || { registrar "   licencia: no hay llave publica en $LICENCIA_PUB"; return 1; }

  if ! openssl pkeyutl -verify -pubin -inkey "$LICENCIA_PUB" -rawin \
       -in "$LICENCIA_DIR/licencia.json" -sigfile "$LICENCIA_DIR/licencia.firma" >/dev/null 2>&1; then
    registrar "   licencia: la firma NO valida"
    return 1
  fi

  # Ahora si: el contenido esta firmado, asi que se puede leer y creer.
  local inst dom
  inst="$(licencia_texto instancia)"
  dom="$(licencia_texto dominio)"
  if [ "$inst" != "$(respaldo_instancia 2>/dev/null || echo "${INSTANCIA:-}")" ]; then
    registrar "   licencia: firmada pero no es de esta instancia (dice \"$inst\")"
    return 1
  fi
  if [ -n "${DOMINIO:-}" ] && [ "$dom" != "$DOMINIO" ]; then
    registrar "   licencia: firmada pero no es de este dominio (dice \"$dom\")"
    return 1
  fi
  return 0
}

# Los cuatro estados. La MISMA regla que `apps/web/lib/licencia.ts`, y lo que
# impide que las dos se separen es `infra/licencias/estados.casos.tsv`, que
# leen las dos suites.
licencia_estado() {
  local vence aviso gracia t_vence t_aviso t_fin ahora
  vence="$(licencia_texto vence)"
  aviso="$(licencia_numero aviso_dias)"
  gracia="$(licencia_numero gracia_dias)"
  # Un campo ilegible NO cae a un valor por omision: una licencia a medias es
  # una licencia rota, y elegir por ella seria inventarse lo que se concedio.
  [ -n "$vence" ] && [ -n "$aviso" ] && [ -n "$gracia" ] || { echo invalida; return 0; }
  t_vence="$(date -u -d "$vence" +%s 2>/dev/null || true)"
  [ -n "$t_vence" ] || { echo invalida; return 0; }
  # `LICENCIA_HOY` es SOLO para el arnes: sin el no se puede comprobar una fecha
  # futura sin cambiarle el reloj a la maquina que corre las pruebas. En una
  # instancia real nunca esta definida.
  if [ -n "${LICENCIA_HOY:-}" ]; then
    ahora="$(date -u -d "$LICENCIA_HOY" +%s 2>/dev/null || true)"
    [ -n "$ahora" ] || { echo invalida; return 0; }
  else
    ahora="$(date -u +%s)"
  fi
  t_aviso=$(( t_vence - aviso * 86400 ))
  t_fin=$((   t_vence + gracia * 86400 ))
  if   [ "$ahora" -lt "$t_aviso" ]; then echo sana
  elif [ "$ahora" -lt "$t_vence" ]; then echo aviso
  elif [ "$ahora" -lt "$t_fin"   ]; then echo gracia
  else                                   echo vencida
  fi
}

if [ "$LICENCIA_REQUERIDA" = 1 ]; then
  if licencia_valida; then LICENCIA_ESTADO="$(licencia_estado)"; else LICENCIA_ESTADO='invalida'; fi
  registrar "licencia: $LICENCIA_ESTADO"
fi
```

- [ ] **Paso 4: correr el arnés y ver el verde**

```
bash infra/scripts/pruebas-update.sh
```

Esperado: **0 rojas**, y el recuento sube a **116 escenarios o más** (106 de
antes + 10 del banco + 8 sueltos).

- [ ] **Paso 5: comprobar que la flota de hoy no cambió**

Es la comprobación que justifica toda la estructura de esta tarea:

```
bash infra/scripts/pruebas-update.sh 2>&1 | tail -3
```

`E115` y `E108` en verde significan que un hijo sin `LICENCIA_REQUERIDA` corre
exactamente igual que antes de este commit.

- [ ] **Paso 6: commit**

```bash
git add infra/scripts/update.sh infra/scripts/pruebas-update.sh
git commit -m "feat(licencia): update.sh comprueba la firma y decide el estado, todavia sin apagar nada"
```

---

## Tarea 5: el apagado — nginx, el código 8 y la reanudación

**Archivos:**
- Modificar: `infra/scripts/update.sh`
- Modificar: `infra/scripts/pruebas-update.sh` (E116–E121 y dos mutantes)
- Crear: `infra/nginx/instancia-sin-licencia.conf.tpl`
- Crear: `infra/nginx/publico/licencia-vencida.html`

**Interfaces:**
- Consume: `LICENCIA_ESTADO` y `EX_LICENCIA` de la tarea 4.
- Produce, para la tarea 6: que `update.sh` salga con **8** cuando la licencia
  está vencida. Y para la tarea 8: los dos archivos de nginx, que el instalador
  copia.

- [ ] **Paso 1: escribir los escenarios en rojo**

Antes hace falta que el arnés vea qué le pide a `nginx`, así que se añade un
doble más en `montar_dobles`:

```sh
  # `nginx` doblado: anota lo que le piden y puede fallar el `-t` a peticion.
  # Sin esto no se puede comprobar lo que mas importa del apagado: que un `-t`
  # en rojo NO recargue, porque dejar a un cliente sin nginx por un error de
  # plantilla seria peor que el problema que se esta resolviendo.
  cat >"$BIN/nginx" <<'FIN'
#!/usr/bin/env bash
printf 'nginx %s\n' "$*" >>"$REG_LLAMADAS"
case "$*" in *-t*) exit "${N_TEST_CODIGO:-0}" ;; esac
exit 0
FIN
  cat >"$BIN/systemctl" <<'FIN'
#!/usr/bin/env bash
printf 'systemctl %s\n' "$*" >>"$REG_LLAMADAS"
exit 0
FIN
```

Y en `preparar`, junto a los demás valores por omisión: `export N_TEST_CODIGO=0`
y, en el `unset` de la cabecera, `N_TEST_CODIGO`.

Los escenarios:

```sh
preparar 'E116 una licencia vencida NO levanta el contenedor y sale con 8'
usar_licencia '2020-01-01'
correr
codigo_es 8
no_hubo 'docker run --detach'
log_dice 'licencia: vencida'
limpiar

preparar 'E117 al apagar se cambia el sitio de nginx y se recarga'
usar_licencia '2020-01-01'
correr
codigo_es 8
hubo 'nginx -t'
hubo_regex 'systemctl reload nginx|nginx -s reload'
limpiar

# LA comprobacion del apagado, y la que mas importa de esta tarea: apagar retira
# LO NUESTRO. Los datos del cliente estan en SU Postgres, en SU droplet.
preparar 'E118 apagar no toca la base, ni borra el contenedor, ni retira el respaldo'
usar_licencia '2020-01-01'
correr
codigo_es 8
no_hubo_regex 'docker rm|pg_restore|drop schema'
limpiar

preparar 'E119 si `nginx -t` falla NO se recarga, y el codigo sigue siendo 8'
usar_licencia '2020-01-01'
export N_TEST_CODIGO=1
correr
codigo_es 8
no_hubo_regex 'systemctl reload nginx|nginx -s reload'
log_dice 'no se recarga'
limpiar

preparar 'E120 en gracia la instancia SIGUE funcionando'
usar_licencia '2027-01-01' 30 15
export LICENCIA_HOY='2027-01-10'
correr
codigo_es 0
hubo 'docker run --detach'
log_dice 'licencia: gracia'
unset LICENCIA_HOY
limpiar

# Reanudar no tiene comando: la siguiente corrida con una licencia buena
# devuelve el sitio de nginx y arranca. Un procedimiento que hay que recordar es
# un procedimiento que se olvida el dia que hace falta.
preparar 'E121 con una licencia valida se reanuda solo, sin ningun comando'
usar_licencia '2027-01-01'
export LICENCIA_HOY='2026-11-01'
correr
codigo_es 0
hubo 'docker run --detach'
hubo_regex 'systemctl reload nginx|nginx -s reload'
unset LICENCIA_HOY
limpiar
```

Y los dos mutantes, junto a los demás:

```sh
  # ── Y los dos de la licencia (ADR 0032) ──────────────────────────────────
  # El primero es EL defecto que haria inutil todo el mecanismo: comprobar la
  # firma DESPUES de leer los campos, o sea creerse un archivo sin firmar.
  probar_mutante 'leer los campos antes de comprobar la firma' \
    's@^  if ! openssl pkeyutl -verify -pubin -inkey "\$LICENCIA_PUB" -rawin \\$@  if false; then :; elif false                                            ; then@'
  # Y el segundo es el que nadie ve venir: tratar la licencia ilegible como
  # sana. Falla ABIERTO, que en un mecanismo de licencia es no tener ninguno.
  probar_mutante 'una licencia invalida se trata como sana' \
    's@^  if licencia_valida; then LICENCIA_ESTADO="\$(licencia_estado)"; else LICENCIA_ESTADO='"'"'invalida'"'"'; fi$@  if licencia_valida; then LICENCIA_ESTADO="$(licencia_estado)"; else LICENCIA_ESTADO='"'"'sana'"'"'    ; fi@'
```

> **Nota para quien ejecute:** el validador de mutantes **no funciona desde Git
> Bash en Windows** — cuenta 3918 diferencias sobre 1959 líneas para *cualquier*
> mutante, también los que ya estaban, porque `sed` normaliza los finales de
> línea CRLF del árbol de trabajo. Está anotado en el commit `356873a`. Si
> ejecutas en Windows, comprueba los mutantes a mano: `sed` a una copia,
> `GUION_UPDATE=<copia> bash infra/scripts/pruebas-update.sh`, y que el recuento
> de rojas sea **mayor que cero**.

- [ ] **Paso 2: correr el arnés y ver el rojo**

```
bash infra/scripts/pruebas-update.sh
```

Esperado: **E116–E121 en rojo**. El más claro es `codigo esperado 8, real 0`.

- [ ] **Paso 3: escribir los dos archivos de nginx**

Crear `infra/nginx/instancia-sin-licencia.conf.tpl`, con `__DOMINIO__` como
parámetro igual que `instancia.conf.tpl` — **ningún valor real quemado**. Sirve
`/var/www/space-os-licencia/` como raíz estática, escucha en 443 con **el mismo
certificado** que el sitio normal (para que no salga un aviso de seguridad
encima del de licencia), y manda **todo** a `licencia-vencida.html` con un
`try_files $uri /licencia-vencida.html;` y `error_page 404 =200 /licencia-vencida.html`.

Crear `infra/nginx/publico/licencia-vencida.html`: una página estática, en
castellano llano, que dice que la licencia venció y **a quién llamar**. Sin
JavaScript, sin recursos externos y sin tipografías de Google: tiene que
renderizar en una máquina que no tiene nada levantado.

- [ ] **Paso 4: escribir el apagado en `update.sh`**

Justo después del bloque de la tarea 4:

```sh
# Cambia el sitio activo de nginx. `modo` es `normal` o `sin-licencia`.
#
# Un enlace simbolico y no un `if` dentro de nginx: `if` dentro de un `location`
# es celebre por comportarse distinto de como se lee, y esto tiene que ser
# predecible. Y tampoco un `error_page 502`, que confundiria «la licencia
# vencio» con «la aplicacion se cayo» -- las dos cosas que el panel de flota
# existe para no mezclar.
nginx_sitio() {
  local modo="$1" origen
  case "$modo" in
    normal)       origen="$NGINX_SITIO_NORMAL" ;;
    sin-licencia) origen="$NGINX_SITIO_SIN_LICENCIA" ;;
    *) return 0 ;;
  esac
  [ -f "$origen" ] || { registrar "   nginx: no existe $origen, no se cambia el sitio"; return 0; }
  # Si ya apunta ahi no se toca: recargar nginx cada noche por nada es ruido, y
  # una recarga es una ventana -- pequena, pero real -- de peticiones perdidas.
  [ "$(readlink -f "$NGINX_SITIO_ACTIVO" 2>/dev/null || true)" = "$(readlink -f "$origen")" ] && return 0
  ln -sfn "$origen" "$NGINX_SITIO_ACTIVO"
  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx >/dev/null 2>&1 || nginx -s reload >/dev/null 2>&1 || true
    registrar "   nginx: sitio -> $modo"
  else
    registrar "   nginx: \`nginx -t\` fallo con el sitio $modo, NO se recarga (queda el que estaba sirviendo)"
  fi
}

if [ "$LICENCIA_REQUERIDA" = 1 ]; then
  case "$LICENCIA_ESTADO" in
    vencida|invalida)
      # `docker stop`, nunca `docker rm`: los datos estan en Postgres y ahi se
      # quedan, y conservar el contenedor hace que reanudar sea arrancarlo.
      docker stop "$CONTENEDOR" >/dev/null 2>&1 || true
      nginx_sitio sin-licencia
      salir "$EX_LICENCIA" "APAGADO (8): la licencia de esta instancia esta \"$LICENCIA_ESTADO\". El contenedor esta detenido y nginx sirve la pagina de vencimiento. NO se ha tocado la base, NO se ha borrado nada y el respaldo sigue donde estaba: para reanudar basta con instalar una licencia valida en $LICENCIA_DIR y esperar a la siguiente corrida."
      ;;
    *)
      # Sana, aviso o gracia: se sirve con normalidad. Y se devuelve el sitio al
      # normal por si la corrida anterior lo dejo en el de vencimiento -- que es
      # todo el mecanismo de reanudacion, y por eso no hay ningun comando que
      # alguien tenga que acordarse de correr.
      nginx_sitio normal
      ;;
  esac
fi
```

Y las tres rutas, junto a `LICENCIA_PUB`:

```sh
NGINX_SITIO_ACTIVO="${NGINX_SITIO_ACTIVO:-/etc/nginx/sites-enabled/space-os.conf}"
NGINX_SITIO_NORMAL="${NGINX_SITIO_NORMAL:-/etc/nginx/sites-available/space-os.conf}"
NGINX_SITIO_SIN_LICENCIA="${NGINX_SITIO_SIN_LICENCIA:-/etc/nginx/sites-available/space-os-sin-licencia.conf}"
```

En `preparar` del arnés hay que apuntarlas al directorio temporal, junto a las
demás rutas de escenario, y crear los dos archivos vacíos para que `nginx_sitio`
los encuentre.

- [ ] **Paso 5: correr el arnés y ver el verde**

```
bash infra/scripts/pruebas-update.sh
```

Esperado: **0 rojas**, **122 escenarios o más**.

- [ ] **Paso 6: comprobar que los dos mutantes muerden**

En Linux: `bash infra/scripts/pruebas-update.sh --mutantes`. En Windows, a mano
como dice la nota del paso 1. Esperado: los dos mutantes dejan **más de cero
rojas**.

- [ ] **Paso 7: commit**

```bash
git add infra/scripts/update.sh infra/scripts/pruebas-update.sh infra/nginx/instancia-sin-licencia.conf.tpl infra/nginx/publico/licencia-vencida.html
git commit -m "feat(licencia): la licencia vencida apaga el contenedor y nginx explica por que"
```

---

## Tarea 6: el panel de flota nombra el código 8

**Archivos:**
- Modificar: `apps/flota/diagnostico.mjs`
- Modificar: `apps/flota/diagnostico.test.ts`

**Interfaces:**
- Consume: `EX_LICENCIA=8` de la tarea 5, que ya viaja al PADRE en el reporte sin
  tocar nada del canal — la fase 2 del panel lo dejó hecho.
- Produce: la frase del 8 en `CODIGO_UPDATE`.

- [ ] **Paso 1: escribir la prueba en rojo**

En `apps/flota/diagnostico.test.ts`, dentro del `describe` de
`fraseDeActualizacion`:

```ts
  // El 8 es de la licencia (ADR 0032), no de una averia. Un hijo apagado a
  // proposito no puede leerse igual que uno caido: son dos llamadas de telefono
  // distintas.
  it('el 8 dice que esta apagado a proposito, no que se cayo', () => {
    const frase = fraseDeActualizacion({ codigo: 8 })
    expect(frase).toContain('licencia')
    expect(frase).toContain('a proposito')
  })

  it('los codigos son una lista cerrada', () => {
    expect(CODIGOS_UPDATE).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 75])
  })
```

La segunda sustituye a la que ya existe con la lista sin el 8.

- [ ] **Paso 2: correrla y ver el rojo**

```
cd apps/flota && npx vitest run diagnostico.test.ts
```

Esperado: **FALLA** — la frase del 8 sale como «que este panel no conoce».

- [ ] **Paso 3: añadir la entrada**

En `CODIGO_UPDATE` de `apps/flota/diagnostico.mjs`, entre el 7 y el 75:

```js
  8: 'la licencia vencio y la instancia esta apagada a proposito: no es una averia',
```

- [ ] **Paso 4: correr la suite de flota**

```
cd apps/flota && npx vitest run
```

Esperado: **0 fallos**.

- [ ] **Paso 5: commit**

```bash
git add apps/flota/diagnostico.mjs apps/flota/diagnostico.test.ts
git commit -m "feat(flota): el codigo 8 se lee como lo que es, un apagado por licencia y no una averia"
```

---

## Tarea 7: la banda dentro de la aplicación

**Archivos:**
- Crear: `apps/web/components/demo/shell/BandaLicencia.tsx`
- Crear: `apps/web/components/demo/shell/BandaLicencia.test.tsx`
- Modificar: `apps/web/app/(app)/(shell)/layout.tsx`

**Interfaces:**
- Consume: `estadoDeLicencia(licencia, ahora)` y `EstadoLicencia` de
  `apps/web/lib/licencia.ts` (tarea 1).
- Produce: `<BandaLicencia estado={...} vence={...} finGracia={...} />`.

**Cómo llega la licencia al contenedor, y por qué esto no toca `update.sh`:**
`update.sh:1700` levanta el contenedor con `"${opciones_app[@]}"`, que sale de
`DOCKER_OPCIONES_APP` — una cadena que decide el aprovisionamiento. Así que el
montaje es **un valor de configuración**, no un cambio en la ruta crítica de la
flota. Lo pone `instalar-hijo.sh` en la tarea 8:

```
DOCKER_OPCIONES_APP="-v /etc/space-os/licencia:/etc/space-os/licencia:ro"
```

**Se monta el DIRECTORIO, no el archivo.** Montar un archivo suelto ata el
montaje a su inodo: al renovar, sustituir el archivo dejaría al contenedor
viendo el viejo para siempre.

Y en un hijo administrado no hay montaje, así que la aplicación no encuentra
nada y **no pinta ninguna banda** — el comportamiento de hoy, sin escribir
ninguna condición nueva.

- [ ] **Paso 1: escribir la prueba en rojo**

Crear `apps/web/components/demo/shell/BandaLicencia.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BandaLicencia } from './BandaLicencia'

describe('BandaLicencia', () => {
  // El silencio es la senal, igual que en el panel de flota: si algo esta bien,
  // no se dice nada.
  it('con la licencia sana no pinta nada', () => {
    const { container } = render(
      <BandaLicencia estado="sana" vence="2027-01-01" finGracia="2027-01-16" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('sin licencia (hijo administrado) tampoco pinta nada', () => {
    const { container } = render(
      <BandaLicencia estado="no-aplica" vence={null} finGracia={null} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('en aviso dice cuando vence', () => {
    render(<BandaLicencia estado="aviso" vence="2027-01-01" finGracia="2027-01-16" />)
    expect(screen.getByRole('status')).toHaveTextContent('2027-01-01')
  })

  // En gracia la fecha que importa es OTRA: no cuando vencio, sino cuando deja
  // de funcionar. Es lo unico que la persona puede hacer algo por evitar.
  it('en gracia dice cuando deja de funcionar', () => {
    render(<BandaLicencia estado="gracia" vence="2027-01-01" finGracia="2027-01-16" />)
    const banda = screen.getByRole('status')
    expect(banda).toHaveTextContent('2027-01-16')
    expect(banda).toHaveTextContent(/dejar[aá] de funcionar/i)
  })

  // Una banda que avisa de algo y no dice que hacer es ruido.
  it('las dos bandas dicen a quien contactar', () => {
    for (const estado of ['aviso', 'gracia'] as const) {
      const { unmount } = render(
        <BandaLicencia estado={estado} vence="2027-01-01" finGracia="2027-01-16" />,
      )
      expect(screen.getByRole('status')).toHaveTextContent(/contacta|escríbenos|escribenos/i)
      unmount()
    }
  })

  // `invalida` y `vencida` no se pintan porque en esos estados la aplicacion NO
  // ESTA LEVANTADA: quien apaga es update.sh, y lo que se ve es la pagina de
  // nginx. Pintarlas seria describir un estado imposible.
  it('vencida e invalida no pintan nada: en esos estados la app no corre', () => {
    for (const estado of ['vencida', 'invalida'] as const) {
      const { container, unmount } = render(
        <BandaLicencia estado={estado} vence="2020-01-01" finGracia="2020-01-16" />,
      )
      expect(container).toBeEmptyDOMElement()
      unmount()
    }
  })
})
```

- [ ] **Paso 2: correrla y ver el rojo**

```
cd apps/web && npx vitest run components/demo/shell/BandaLicencia.test.tsx
```

Esperado: **FALLA** con `Failed to resolve import "./BandaLicencia"`.

- [ ] **Paso 3: escribir el componente**

Crear `apps/web/components/demo/shell/BandaLicencia.tsx`:

```tsx
import type { EstadoLicencia } from '@/lib/licencia'

// ============================================================================
//  BandaLicencia — la aplicacion AVISA. No bloquea, y no comprueba nada.
// ----------------------------------------------------------------------------
//  Quien apaga es `update.sh`, con `openssl`, FUERA del contenedor. Duplicar la
//  criptografia aqui no compraria nada: esta aplicacion corre en la maquina del
//  cliente y el tiene root, asi que su veredicto nunca seria de fiar.
//
//  Por eso `vencida` e `invalida` no pintan nada: en esos estados este codigo
//  NO ESTA CORRIENDO -- lo que el navegador recibe es la pagina de nginx.
//  Pintarlos seria describir un estado imposible.
// ============================================================================

export function BandaLicencia({
  estado,
  vence,
  finGracia,
}: {
  estado: EstadoLicencia | 'no-aplica'
  vence: string | null
  finGracia: string | null
}) {
  if (estado !== 'aviso' && estado !== 'gracia') return null

  const enGracia = estado === 'gracia'
  return (
    <div
      role="status"
      className={
        enGracia
          ? 'flex flex-wrap items-center gap-x-2 bg-rose-600 px-4 py-2 text-sm font-medium text-white'
          : 'flex flex-wrap items-center gap-x-2 bg-amber-100 px-4 py-2 text-sm text-amber-900'
      }
    >
      {enGracia ? (
        <span>
          Tu licencia de SPACE OS venció el {vence}. El sistema dejará de funcionar el {finGracia}.
        </span>
      ) : (
        <span>Tu licencia de SPACE OS vence el {vence}.</span>
      )}
      <span>Para renovarla, contacta con tu proveedor.</span>
    </div>
  )
}
```

- [ ] **Paso 4: correrla y ver el verde**

```
cd apps/web && npx vitest run components/demo/shell/BandaLicencia.test.tsx
```

Esperado: **PASA**, 6 pruebas.

- [ ] **Paso 5: leer la licencia en el layout**

En `apps/web/app/(app)/(shell)/layout.tsx` — que es un componente **de
servidor**, así que puede leer del disco — añadir la lectura y pintar la banda
justo dentro del contenedor de `<Topbar />`:

```tsx
import { readFile } from 'node:fs/promises'
import { estadoDeLicencia, type EstadoLicencia } from '@/lib/licencia'
import { BandaLicencia } from '@/components/demo/shell/BandaLicencia'

const RUTA_LICENCIA = process.env.LICENCIA_JSON ?? '/etc/space-os/licencia/licencia.json'
const DIA = 24 * 60 * 60 * 1000

// Un hijo ADMINISTRADO no tiene licencia montada, y eso no es un error: es el
// caso normal de la mitad de la flota. Cualquier fallo de lectura sale por aqui
// como `no-aplica` y la banda no se pinta.
//
// Y no se comprueba ninguna firma a proposito: ver la cabecera de
// `BandaLicencia.tsx`.
async function leerLicencia() {
  try {
    const crudo = JSON.parse(await readFile(RUTA_LICENCIA, 'utf8'))
    const estado = estadoDeLicencia(crudo, new Date())
    const vence: string | null = typeof crudo?.vence === 'string' ? crudo.vence : null
    const dias = Number(crudo?.gracia_dias)
    const finGracia =
      vence && Number.isInteger(dias)
        ? new Date(Date.parse(`${vence}T00:00:00Z`) + dias * DIA).toISOString().slice(0, 10)
        : null
    return { estado: estado as EstadoLicencia | 'no-aplica', vence, finGracia }
  } catch {
    return { estado: 'no-aplica' as const, vence: null, finGracia: null }
  }
}
```

y convertir el componente en `async`, pintando `<BandaLicencia {...licencia} />`
por encima de `<Topbar />`.

**Sólo dentro del shell.** Las páginas públicas de propuesta las ve el cliente
**del** cliente, y nuestras cuentas comerciales no son asunto suyo.

- [ ] **Paso 6: la suite entera y el typecheck**

```
cd apps/web && npm run typecheck && npm test
```

Esperado: typecheck limpio y **1121 pruebas o más** en verde.

- [ ] **Paso 7: commit**

```bash
git add apps/web/components/demo/shell/BandaLicencia.tsx apps/web/components/demo/shell/BandaLicencia.test.tsx "apps/web/app/(app)/(shell)/layout.tsx"
git commit -m "feat(licencia): la aplicacion avisa del vencimiento dentro del shell, y no bloquea nada"
```

---

## Tarea 8: `instalar-hijo.sh` y la tarjeta del paquete de alta

**Archivos:**
- Crear: `infra/scripts/instalar-hijo.sh`
- Crear: `docs/evidencias/alta-droplet-propio.txt`

**Interfaces:**
- Consume: `setup-droplet.sh` (que ya corre como root en la propia máquina),
  las plantillas de `infra/env/` y `infra/nginx/`, y los archivos de licencia de
  la tarea 3.
- Produce: un droplet servido, reportando al panel de flota.

**La dirección se invierte.** `provision-instancia.sh` corre **desde nuestra
máquina** y empuja por SSH: todo pasa por `remoto()`. Este guion corre **dentro
del droplet**, lanzado por el cliente. Nuestro acceso `soporte` queda para las
averías, que es para lo que se pidió (ADR 0025).

- [ ] **Paso 1: escribir el guion**

Crear `infra/scripts/instalar-hijo.sh`, siguiendo la disciplina de
`provision-instancia.sh`:

- **Sin `--confirmar` se comporta como `--dry-run`.** El modo por omisión de algo
  que crea una base y un usuario Dueño es «cuéntame qué harías».
- Exige ser **root** y comprueba **Ubuntu 22.04**, como `setup-droplet.sh`.
- Argumentos: `--instancia`, `--dominio`, `--flota-token`, `--licencia <dir>`,
  y opcionales `--spaces-key`, `--spaces-secret`, `--spaces-bucket`.
- Pasos, en orden: `setup-droplet.sh` → escribir `instancia.env` y `app.env` →
  instalar `infra/licencias/space-os.pub` en `/opt/space-os/space-os.pub` →
  copiar la licencia a `/etc/space-os/licencia/` → `docker login` → los dos
  sitios de nginx → primera corrida de `update.sh` → certificado.
- En `instancia.env` escribe **`LICENCIA_REQUERIDA=1`** y
  **`DOCKER_OPCIONES_APP="-v /etc/space-os/licencia:/etc/space-os/licencia:ro"`**.
  Las dos, y las dos hacen falta: la primera apaga, la segunda avisa.
- **Verifica la licencia antes de instalarla**, con el mismo `openssl pkeyutl
  -verify` de `update.sh`. Fallar aquí, con una persona delante, es infinitamente
  mejor que fallar esa noche en el cron.
- **Se detiene a pedir las claves de Spaces**; si no las tiene, **avisa fuerte y
  sigue**. Una máquina a medias es peor que una servida sin respaldo remoto y con
  un aviso repetido cada noche en el log. *(Decisión del 10/09: se propuso, no se
  objetó.)*

- [ ] **Paso 2: probarlo con `--dry-run`, que es lo único que se puede probar aquí**

```bash
bash infra/scripts/instalar-hijo.sh --instancia pixeled \
  --dominio pixeled.ejemplo.invalid --flota-token t0ken --licencia /tmp/no-existe
```

Esperado: **cuenta todo lo que haría y no toca nada**, y **falla con un mensaje
claro** por la licencia que no está. `echo $?` distinto de 0.

- [ ] **Paso 3: escribir la tarjeta del paquete de alta**

Crear `docs/evidencias/alta-droplet-propio.txt`, con la estructura de las demás:
bloques etiquetados `[LOCAL]` / `[SERVIDOR]`, gates con 🚦, y la vuelta atrás
**comentada** bajo el banner `⛔ LO DE ABAJO NO ES EL PASO SIGUIENTE`.

Tiene **dos destinatarios**, y hay que separarlos visualmente porque uno de los
dos no trabaja aquí:

- **Lo que hacemos nosotros:** registrar el hijo en el inventario del PADRE (de
  donde sale el token), firmar la licencia con `firmar-licencia.mjs`, y armar el
  paquete con el `sha256` de cada archivo.
- **Lo que hace el cliente:** crear el droplet en **su** cuenta (Ubuntu 22.04),
  apuntar su DNS, descargar el instalador, **comparar el `sha256`**, correrlo en
  seco, y correrlo de verdad.

Y el gate final, que es el que cierra el alta: **su fila aparece en
`https://space-os.io/flota/`**. Eso es lo que sustituye a «lo vimos hacerlo».

- [ ] **Paso 4: commit**

```bash
git add infra/scripts/instalar-hijo.sh docs/evidencias/alta-droplet-propio.txt
git commit -m "feat(alta): el instalador que corre dentro del droplet del hijo, y su tarjeta"
```

---

## Tarea 9: el ensayo en DEMO, la bóveda y la bitácora

**Archivos:**
- Crear: `docs/evidencias/ensayo-licencia-demo.txt`
- Modificar: `vault/01-Arquitectura/modelo-instancias-soberanas.md`
- Modificar: `docs/Registro_Cambios.md`

- [ ] **Paso 1: escribir la tarjeta del ensayo**

Crear `docs/evidencias/ensayo-licencia-demo.txt`. **Es la puerta antes de vender
esto**, y su primera línea tiene que decirlo: un interruptor de apagado cuyo
primer uso real fuera contra un cliente que paga sería la peor forma posible de
estrenarlo.

Bloques, todos `[SERVIDOR: 137.184.107.53]`:

1. **Gate de máquina** — `hostname` y `curl -s ifconfig.me`. Si dice `g500`,
   PARAR.
2. Firmar una licencia para DEMO **ya caducada**:
   `node firmar-licencia.mjs --instancia demo --dominio demo.space-os.io --vence 2020-01-01`.
3. Instalarla, poner `LICENCIA_REQUERIDA=1` en la configuración de DEMO, y correr
   `SPACE_OS_CONF=/etc/space-os/demo-instancia.env /opt/space-os/update.sh`.
   **El `SPACE_OS_CONF` no es opcional**: sin él el guion lee otra configuración.
4. **Gate:** el código de salida es **8**, el contenedor está detenido, y
   `https://demo.space-os.io` sirve la página de vencimiento **con su
   certificado** y sin aviso de seguridad.
5. **Gate:** el **8** aparece en el panel de flota, y con su frase — no como una
   avería.
6. Firmar una licencia buena, instalarla, correr `update.sh` otra vez.
   **Gate:** vuelve a servir **sin ningún comando de reanudación**.
7. **Volver a poner `LICENCIA_REQUERIDA=0`** y comprobar que DEMO corre como
   siempre. Este paso **no es opcional**: los hijos administrados no llevan
   licencia (decisión de Emiliano del 10/09).

Y lo que hay que devolver: el código de salida de cada corrida, una captura de la
página de vencimiento, y la fila de DEMO en el panel.

- [ ] **Paso 2: actualizar la bóveda**

En `vault/01-Arquitectura/modelo-instancias-soberanas.md`, la §6-bis que hoy dice
**«Escrito, no construido»**: cambiarlo por lo que quedó construido, con las
rutas reales de cada pieza, el código **8**, y el frontmatter (`actualizado:` y
los `archivos:` nuevos).

Y dejar claro lo que **sigue** pendiente: el ensayo en DEMO y el primer alta real.

- [ ] **Paso 3: escribir la entrada de la bitácora**

En `docs/Registro_Cambios.md`, **en lenguaje llano y para quien no programa**.
Lo que tiene que decir, sin jerga:

- que ahora un cliente puede comprar el sistema **poniendo él su propio
  servidor**, y que sigue existiendo la forma de siempre;
- que el sistema **sabe hasta cuándo tiene permiso de funcionar**, avisa con
  semanas de antelación, da un margen después del vencimiento y sólo entonces
  deja de dejar entrar;
- que **sus datos nunca se tocan**: están en su servidor y siguen siendo suyos
  pase lo que pase;
- y que **para los servidores que ponemos nosotros no cambia absolutamente
  nada**.

- [ ] **Paso 4: las tres suites, sobre el árbol final**

```
cd apps/flota && npx vitest run
cd apps/web && npm run typecheck && npm test
bash infra/scripts/pruebas-update.sh
```

Esperado: las tres en verde, con los recuentos de las tareas anteriores.

- [ ] **Paso 5: commit**

```bash
git add docs/evidencias/ensayo-licencia-demo.txt vault/01-Arquitectura/modelo-instancias-soberanas.md docs/Registro_Cambios.md
git commit -m "docs(licencia): el ensayo en DEMO, la boveda al dia y la bitacora en lenguaje llano"
```

---

## Tarea 10: lo que crea una base de datos se escribe UNA vez

> **Tarea añadida el 2026-09-11, durante la ejecución.** No estaba en el plan
> original y nace de un hallazgo medido en la revisión de la tarea 8: mi brief de
> esa tarea **se olvidaba de la base de datos entera** —roles, esquema,
> migraciones—, el implementador lo detectó (sin eso «la primera corrida de
> `update.sh`» no podía funcionar nunca) y lo resolvió **copiando** la lógica de
> `provision-instancia.sh`.
>
> El revisor midió el resultado: **38 líneas idénticas carácter a carácter**, y
> unas 120-150 contando ayudantes. Y encontró que **la deriva ya nació en ese
> mismo commit** (`CANAL` acabó en `app.env` en uno y no en el otro).
>
> **Por qué esto no se puede dejar así, dicho con la regla del repositorio:**
> `zonas-de-riesgo.md` clasifica el aislamiento entre organizaciones como **R2**,
> y avisa de que *su modo de fallo no da error* — una consulta devuelve cero
> filas en silencio, o filas de otra empresa. El día que alguien arregle un
> privilegio de rol en un archivo y no en el otro, las instancias de cliente
> nacerán con el privilegio viejo **y nada fallará**: darán datos de quien no
> toca. Ya pasó dos veces en este repositorio por otra vía.

**Archivos:**
- Crear: `infra/scripts/base-instancia.sh`
- Modificar: `infra/scripts/provision-instancia.sh` (sustituir lo extraído por un `source` y una llamada)
- Modificar: `infra/scripts/instalar-hijo.sh` (lo mismo)

**Interfaces:**
- Consume: nada de las tareas anteriores.
- Produce: un archivo que los dos guiones **sourcean**, con las funciones que
  crean los roles, aplican el esquema y corren las migraciones. El patrón ya
  existe en este repositorio: `update.sh` sourcea `respaldo.sh` por exactamente
  esta razón, y su comentario de la línea 209 lo dice.

**El riesgo, y la red:** `provision-instancia.sh` es lo que crea las instancias
de clientes **reales** hoy. Su arnés es `infra/scripts/pruebas-provision.sh` y
**es la puerta de esta tarea**: tiene que quedar en verde sin tocar ni un
escenario. Si un escenario obliga a cambiarse, esta tarea ha cambiado el
comportamiento y hay que parar.

- [ ] **Paso 1: medir el punto de partida**

```
bash infra/scripts/pruebas-provision.sh 2>&1 | tail -3
```

Anotar el recuento **antes de tocar nada**. Sin este número no se puede afirmar
después que nada se rompió.

- [ ] **Paso 2: encontrar lo que de verdad está duplicado**

No fiarse de la cifra de la revisión: medirla otra vez. Los dos guiones tienen
propósitos distintos —uno empuja por SSH, el otro corre en la máquina— así que
**lo común es lo que le habla a Postgres**, no todo lo que se parezca.

Lo que **no** se extrae: todo lo que dependa de cómo se llega a la máquina
(`remoto()`, `ejecutar`, `escribir`). Extraer eso acoplaría los dos caminos, que
es lo contrario de lo que se busca.

- [ ] **Paso 3: escribir `infra/scripts/base-instancia.sh`**

Con la cabecera que este repositorio usa: qué es, por qué existe y **qué fallo
motivó su existencia** — que es lo que impide que alguien lo vuelva a duplicar.
Las funciones reciben por parámetro lo que cambia y **no leen variables
globales de sus llamadores**: eso es lo que hace que sirva a los dos.

- [ ] **Paso 4: que los dos guiones lo sourceen**

Igual que `update.sh` hace con `respaldo.sh`, y con el mismo cuidado: si el
archivo no está al lado, **abortar diciéndolo**, no seguir a medias.

- [ ] **Paso 5: la puerta**

```
bash infra/scripts/pruebas-provision.sh 2>&1 | tail -3
bash infra/scripts/instalar-hijo.sh --instancia prueba --dominio prueba.ejemplo.invalid --flota-token t --licencia /tmp/no-existe
bash -n infra/scripts/provision-instancia.sh infra/scripts/instalar-hijo.sh infra/scripts/base-instancia.sh
```

El arnés de aprovisionamiento **con el mismo recuento del paso 1 y 0 rojas**, sin
haber tocado ningún escenario. Y el instalador sigue fallando en seco igual.

- [ ] **Paso 6: cerrar la deriva que ya existe**

`CANAL` acabó en `app.env` en un guion y no en el otro. Averiguar cuál de los
dos tiene razón —leyendo qué espera la aplicación— y dejar los dos iguales.
Decirlo en el commit: es el ejemplo vivo de por qué existe esta tarea.

- [ ] **Paso 7: commit**

```bash
git add infra/scripts/base-instancia.sh infra/scripts/provision-instancia.sh infra/scripts/instalar-hijo.sh
git commit -m "refactor(instancias): lo que crea una base de datos se escribe una vez, no dos"
```

---

## Tarea 11: `app.env` y `instancia.env` tienen parsers distintos

> **Tarea añadida el 2026-09-11, durante la ejecución.** Es un **bloqueante del
> camino nuevo**: tal como está, el instalador de la tarea 8 **rompe en su primer
> uso**. Lo encontró el implementador de la tarea 10 fuera de su alcance y lo
> anotó sin tocarlo, que era lo correcto.

**El defecto.** `instalar-hijo.sh` escribe los dos archivos de configuración con
la misma función, `reescribir_env()`, que **entrecomilla todos los valores** —y
hace bien, porque `instancia.env` lo **sourcea** bash y un valor con espacios sin
comillas ejecuta la segunda palabra como root, que es un defecto que este
proyecto ya sufrió.

Pero **`app.env` no lo sourcea nadie**: lo lee Docker como `--env-file`, y
**Docker no quita las comillas**. Se las queda dentro del valor.

**Lo que pasa la primera noche**, y está en el código, no es una hipótesis.
`url_de_env_app()` (`update.sh:1416-1422`) lee ese archivo con `grep` y
`cut -d= -f2-` precisamente para no sourcearlo, así que recoge el valor **con las
comillas puestas**. Después, `update.sh:1430-1433` compara el destino de esa URL
con el de la de `instancia.env` y, al no coincidir, **para**:

```
ERROR update: … apuntan a bases DISTINTAS (… vs …). Se para: migrar una y
servir la otra no da error, deja dos bases a medias.
```

O sea: el alta termina «bien», y la primera corrida del cron aborta con
`EX_CONFIG`. El owner ve una instancia que no se actualiza nunca.

**Y el propio `update.sh` ya lo había avisado**, en el comentario de sus líneas
1417-1420: *«Formato `--env-file` de docker: CLAVE=valor, sin comillas ni
`export`. Por eso se lee con grep y no con `.`: sourcearlo interpretaría las
comillas de otra manera que docker, y ahí es donde nacen las diferencias
invisibles.»* El aviso estaba escrito; lo que faltaba era leerlo.

**Archivos:**
- Modificar: `infra/scripts/instalar-hijo.sh`
- Modificar: `infra/scripts/pruebas-provision.sh` (el escenario de CONTENIDO)

**Interfaces:**
- Consume: `reescribir_env()` de la tarea 8, y el escenario de CONTENIDO y el
  doble de `ssh` que captura cuerpos, los dos de la tarea 10.
- Produce: nada que otra tarea consuma.

**La regla, en una frase:** **un archivo, un parser.** `instancia.env` se sourcea
y sus valores van entrecomillados. `app.env` lo lee Docker y sus valores van
**tal cual**. Una sola función no puede servir a los dos, y la que hay hoy
pretende hacerlo.

- [ ] **Paso 1: la prueba primero, y ya se puede escribir**

La tarea 10 dejó el arnés capturando **el contenido** de los archivos que se
escriben, así que esto se puede afirmar sin salir del arnés. En el escenario de
CONTENIDO de `pruebas-provision.sh`, añade que:

- en `app.env`, `DATABASE_URL` **no empieza por comilla**;
- en `instancia.env`, los valores **sí** van entrecomillados;
- y el caso que ata las dos cosas: que el destino que `update.sh` leería de
  `app.env` con su propio método —`grep -m1 '^DATABASE_URL=' | cut -d= -f2-`—
  **coincide** con el de `instancia.env`. Esa es la comparación que aborta, así
  que es la que hay que afirmar.

- [ ] **Paso 2: correrla y ver el rojo**

```
bash infra/scripts/pruebas-provision.sh 2>&1 | tail -3
```

Esperado: **rojo**, diciendo que `DATABASE_URL` de `app.env` empieza por comilla.

- [ ] **Paso 3: separar las dos formas**

Dos funciones, o una con un modo explícito — lo que quede más legible—, y **el
comentario tiene que decir por qué son dos**, citando el aviso de
`update.sh:1417-1420`. Ese comentario es lo único que impide que alguien las
vuelva a unificar «para simplificar».

Y lo que hay que conservar de la versión de hoy, porque se ganó en una revisión:
**la validación de los valores sigue corriendo para los dos**. Que un valor vaya
sin comillas en `app.env` no lo hace seguro — lo hace seguro que se haya
rechazado antes lo que no puede llevar. En un `--env-file` el peligro cambia de
forma: no hay ejecución de palabras, pero **un salto de línea dentro de un valor
inventa una variable nueva**. Recházalo.

- [ ] **Paso 4: el verde, y el mutante**

El arnés en verde, y **un mutante** que vuelva a entrecomillar `app.env` y muera.
Es el guard contra la reunificación.

- [ ] **Paso 5: comprobar que la puerta de `update.sh` ya no se dispara**

Sin tocar `update.sh`: extrae su `url_de_env_app` y su `destino_de_url` en un
guion de usar y tirar, y córrelos contra el `app.env` y el `instancia.env` que
produce el instalador en `--dry-run`. Los dos destinos tienen que salir
**iguales**. Es la comprobación que demuestra que el defecto está cerrado, y se
hace sin levantar nada.

- [ ] **Paso 6: commit**

```bash
git add infra/scripts/instalar-hijo.sh infra/scripts/pruebas-provision.sh
git commit -m "fix(alta): app.env lo lee docker y no admite comillas; instancia.env lo sourcea bash y las exige"
```

---

## Autorrevisión de este plan

**1 · Cobertura del spec.** Recorridas sus trece secciones:

| Sección del spec | Tarea |
|---|---|
| §3.1 formato y §3.2 Ed25519 | 2 (firma) y 4 (verificación en bash) |
| §3.3 leer sin `jq` | 4 (`licencia_texto`, `licencia_numero`) |
| §3.4 los cuatro estados | 1 (banco + JS) y 4 (bash) |
| §4.1–4.3 dónde entra, la configuración, el código 8 | 4 y 5 |
| §4.4 qué hace al apagar | 5 (E116, E118) |
| §4.5 reanudar solo | 5 (E121) |
| §5 nginx | 5 |
| §6.1 el montaje | 7 (vía `DOCKER_OPCIONES_APP`), lo pone la 8 |
| §6.2–6.3 el aviso y los textos | 7 |
| §7 el firmador y la custodia | 3 |
| §8 el instalador | 8 |
| §9 el paquete de alta | 8 (la tarjeta) |
| §10 lo que no se construye | ninguna, a propósito |
| §11.3 el ensayo en DEMO | 9 |

**Un hueco encontrado y tapado:** el spec §10 pide, dentro de lo que **sí** se
hace, que «el origen de la imagen sea un solo valor de configuración» y la
tarjeta de rotación del token. **Se comprobó en el repositorio y la primera mitad
ya está hecha**: `REGISTRY` y `REGISTRY_TOKEN` son valores de `instancia.env`
(`update.sh:769-771`), no hay ningún `docker login` quemado en el guion, y el
propio archivo lo dice en un comentario. **No hace falta ninguna tarea.** La
tarjeta de rotación queda como trabajo suelto, fuera de este plan, porque no
bloquea nada de lo de aquí y mezclarla alargaría la tarea 3 sin motivo.

**2 · Marcadores.** Sin «TBD», sin «TODO», sin «manejar los casos límite». Los
sitios donde no hay código literal —las tarjetas de las tareas 3, 8 y 9, y los
dos archivos de nginx— llevan la lista completa de lo que tienen que decir, que
es lo que hace falta para escribirlos sin volver a preguntar.

**3 · Consistencia de nombres.** Comprobado de punta a punta:
`estadoDeLicencia(licencia, ahora)` en las tareas 1 y 7 · `construirLicencia`,
`firmar`, `verificar` en las 2 y 3 · `LICENCIA_REQUERIDA`, `LICENCIA_DIR`,
`LICENCIA_PUB`, `LICENCIA_ESTADO`, `EX_LICENCIA` en las 4, 5, 8 y 9 ·
`licencia_texto`, `licencia_numero`, `licencia_valida`, `licencia_estado`,
`nginx_sitio` en las 4 y 5 · `usar_licencia` y `escenarios_del_banco` en las 4 y
5 · `estados.casos.tsv` en las 1 y 4, con las mismas cinco columnas.

**4 · Y el orden protege a la flota.** Las tareas 1 a 7 no tocan a ningún cliente:
son código que **duerme** hasta que alguien ponga `LICENCIA_REQUERIDA=1`. El
escenario **E115** es lo que convierte esa frase en una comprobación, y por eso
está en la tarea 4 y no al final.

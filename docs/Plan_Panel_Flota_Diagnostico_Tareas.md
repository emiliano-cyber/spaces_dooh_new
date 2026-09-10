# Panel de flota · plan de implementación

> **Para quien ejecute esto:** SUB-SKILL REQUERIDA —
> `superpowers:subagent-driven-development` (recomendada) o
> `superpowers:executing-plans`, tarea por tarea. Los pasos van con casilla
> (`- [ ]`) para poder seguirlos.

**Objetivo:** que el panel de flota diga **por qué** una instancia no contesta
—en vez de meterlas todas en el cajón `sin-respuesta`— y **si una actualización
falló y en qué paso**.

**Arquitectura:** una función pura nueva traduce el fallo (código de red, estado
HTTP o caso de token) a una frase accionable **que lleva el código entre
paréntesis**; `consultar()` la usa; la fila la conserva; el HTML la enseña como
sub-fila. Se arrastra `ultimaVezBien` entre pasadas leyendo el `estado.json`
anterior. Y en la fase 2, la instancia reporta **dos valores de listas
cerradas** —`resultado` y `paso`— y **el PADRE escribe la frase**.

**Dos fases, 9 tareas.** Las tareas 1 a 6 son la fase 1 y se pueden desplegar
solas. Las 7 a 9 son la fase 2, y **su orden de despliegue no es negociable**:
el PADRE antes que las instancias.

**Tecnología:** JavaScript de módulos ES sin dependencias (`apps/flota` no tiene
ninguna, a propósito), pruebas en Vitest con TypeScript.

**Diseño:** `docs/Plan_Panel_Flota_Diagnostico.md` — se lee junto a este plan.

## Restricciones globales

- **`apps/flota` no tiene dependencias.** Nada de paquetes nuevos: `fetch`,
  `node:fs/promises` y nada más.
- **Todo en español**: archivos, funciones, variables y comentarios.
- **No se toca `apps/web`.** Si una tarea lo pide, la tarea está mal: esto no
  puede viajar en la imagen de la flota.
- **`COLUMNAS` no cambia.** Son las 7 de hoy y gobiernan las dos tablas. Lo que
  se guarda pasa a declararse en `CLAVES_FILA`.
- **Ningún valor del cuerpo de una respuesta puede acabar en `motivo`.** Hay una
  prueba que lo afirma; si estorba, la tarea está mal, no la prueba.
- **Comentarios que explican el porqué**, y que documenten el fallo que motivó
  la decisión. Es la convención de este repositorio.
- **Commits en español sin acentos**, `tipo(ámbito): descripción en minúscula`.
- Las pruebas se corren desde `apps/flota`: `npx vitest run <archivo>`.

---

### Tarea 1: el clasificador puro

**Archivos:**
- Crear: `apps/flota/diagnostico.mjs`
- Crear: `apps/flota/diagnostico.test.ts`

**Interfaces:**
- Consume: nada. Es la base.
- Produce: `clasificarFallo({ error, status, cuerpoSinVersion, token, nombre })`
  → `string`. Todas las claves son opcionales; se evalúan en ese orden.

- [ ] **Paso 1: escribir la prueba que falla**

```ts
import { describe, expect, it } from 'vitest'
import { clasificarFallo } from './diagnostico.mjs'

/** Un error de `fetch` de Node: el mensaje es inútil, la causa es el dato. */
function errorDeRed(code: string) {
  const e: any = new Error('fetch failed')
  e.cause = { code }
  return e
}

describe('clasificarFallo · red', () => {
  it('ENOTFOUND dice que el dominio no resuelve, Y trae el codigo', () => {
    expect(clasificarFallo({ error: errorDeRed('ENOTFOUND') })).toBe(
      'el dominio no resuelve (ENOTFOUND)',
    )
  })

  it('ECONNREFUSED dice que nadie escucha', () => {
    expect(clasificarFallo({ error: errorDeRed('ECONNREFUSED') })).toBe(
      'nadie escucha en el 443 (ECONNREFUSED)',
    )
  })

  it('CERT_HAS_EXPIRED dice que el certificado caduco', () => {
    expect(clasificarFallo({ error: errorDeRed('CERT_HAS_EXPIRED') })).toBe(
      'el certificado caduco (CERT_HAS_EXPIRED)',
    )
  })

  // El codigo impreso es EL QUE LLEGO, no el representante de su grupo:
  // EAI_AGAIN comparte frase con ENOTFOUND y tiene que salir con SU nombre. Si
  // saliera el del grupo, el panel diria un codigo que nadie vio.
  it('EAI_AGAIN comparte frase pero imprime SU propio codigo', () => {
    expect(clasificarFallo({ error: errorDeRed('EAI_AGAIN') })).toBe(
      'el dominio no resuelve (EAI_AGAIN)',
    )
  })

  it('un codigo que no esta en la tabla sale TAL CUAL, no como desconocido', () => {
    expect(clasificarFallo({ error: errorDeRed('EPROTO') })).toBe('EPROTO')
  })

  it('sin code se cae al mensaje', () => {
    expect(clasificarFallo({ error: new Error('algo raro') })).toBe('algo raro')
  })
})

describe('clasificarFallo · HTTP', () => {
  it('502 separa nginx de la aplicacion, con el codigo', () => {
    expect(clasificarFallo({ status: 502 })).toBe(
      'nginx contesta pero la aplicacion no (HTTP 502)',
    )
  })

  it('503 comparte frase con 502 pero imprime SU codigo', () => {
    expect(clasificarFallo({ status: 503 })).toBe(
      'nginx contesta pero la aplicacion no (HTTP 503)',
    )
  })

  it('404 dice que esa instancia es anterior a F6.1', () => {
    expect(clasificarFallo({ status: 404 })).toBe(
      'no existe /api/version: corre una version anterior a F6.1 (HTTP 404)',
    )
  })

  it('403 dice que el token no vale', () => {
    expect(clasificarFallo({ status: 403 })).toBe('el token no vale (HTTP 403)')
  })

  it('un estado sin traduccion conserva el formato de hoy', () => {
    expect(clasificarFallo({ status: 418 })).toBe('HTTP 418')
  })
})

describe('clasificarFallo · token', () => {
  it('con token, un cuerpo sin version es un token que no reconoce', () => {
    expect(clasificarFallo({ cuerpoSinVersion: true, token: 'x', nombre: 'g500' })).toBe(
      'el token no lo reconoce como panel',
    )
  })

  it('sin token, nombra la variable que falta', () => {
    expect(clasificarFallo({ cuerpoSinVersion: true, token: '', nombre: 'mi-cliente' })).toBe(
      'falta FLOTA_TOKEN_MI_CLIENTE en el panel',
    )
  })
})
```

- [ ] **Paso 2: correrla y verla fallar**

Correr: `cd apps/flota && npx vitest run diagnostico.test.ts`
Esperado: FALLA — `Failed to load ./diagnostico.mjs`.

- [ ] **Paso 3: la implementación mínima**

```js
// ============================================================================
//  diagnostico.mjs — de un fallo a una frase que dice QUE ARREGLAR.
// ----------------------------------------------------------------------------
//  El panel clasificaba toda instancia que no contesta como `sin-respuesta`, y
//  detras de ese cajon caben seis averias con seis arreglos distintos. El dato
//  para distinguirlas ya llegaba y se perdia por dos motivos:
//
//   1. `consultar()` calculaba un `motivo` y `resumen()` lo descartaba;
//   2. y en los fallos de RED ese motivo era `error.message`, que en Node es
//      **`fetch failed`** para todo. La causa vive en `error.cause.code`.
//
//  Medido el 2026-09-10, la misma noche que esto se escribio:
//  `prueba.space-os.io` daba `000` sin decir que era DNS, y
//  `demo.space-os.io` un 404 que significaba «esa maquina corre codigo
//  anterior a F6.1». Media hora de comandos a mano cada uno.
//
//  PURO a proposito: sin red, sin disco y sin dependencias, como
//  `comprobaciones.mjs` y `dns.mjs`. Es lo que permite probar la tabla entera
//  sin levantar nada.
// ============================================================================

/** Codigos de `error.cause.code` que sabemos traducir. */
const RED = {
  ENOTFOUND: 'el dominio no resuelve',
  EAI_AGAIN: 'el dominio no resuelve',
  ECONNREFUSED: 'nadie escucha en el 443',
  EHOSTUNREACH: 'la maquina no responde',
  ENETUNREACH: 'la maquina no responde',
  ETIMEDOUT: 'no contesto en 5 s',
  CERT_HAS_EXPIRED: 'el certificado caduco',
  ERR_TLS_CERT_ALTNAME_INVALID: 'el certificado no cubre este dominio',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'el certificado no se puede verificar',
  SELF_SIGNED_CERT_IN_CHAIN: 'el certificado no se puede verificar',
}

/** Estados HTTP que dicen algo mas que su numero. */
const HTTP = {
  401: 'el token no vale',
  403: 'el token no vale',
  404: 'no existe /api/version: corre una version anterior a F6.1',
  502: 'nginx contesta pero la aplicacion no',
  503: 'nginx contesta pero la aplicacion no',
  504: 'nginx contesta pero la aplicacion no',
}

/**
 * La frase para un fallo. Se evalua en orden: red, HTTP, token.
 *
 * >>> LA FRASE LLEVA EL CODIGO ENTRE PARENTESIS, y las dos partes hacen
 * >>> trabajos distintos: la frase se lee deprisa a las tres de la manana, el
 * >>> codigo se pega en un buscador o en un mensaje. Pedido en la retro del
 * >>> 2026-09-10, y no se elige entre uno y otro.
 * >>>
 * >>> Y el codigo que se imprime es EL QUE LLEGO, no el representante de su
 * >>> grupo: `EAI_AGAIN` comparte frase con `ENOTFOUND` y sale con su propio
 * >>> nombre. Imprimir el del grupo diria un codigo que nadie vio, que es peor
 * >>> que no decir ninguno.
 *
 * >>> Y lo que NO esta en las tablas sale TAL CUAL, sin frase. Un clasificador
 * >>> que se traga lo que no reconoce convierte una averia nueva en «error
 * >>> desconocido», que es volver al punto de partida. Feo y util le gana a
 * >>> bonito y ciego.
 */
export function clasificarFallo({ error, status, cuerpoSinVersion, token, nombre } = {}) {
  if (error) {
    const code = error?.cause?.code
    if (code) {
      const frase = RED[code]
      return frase ? frase + ' (' + code + ')' : String(code)
    }
    return String(error?.message ?? error)
  }

  if (typeof status === 'number') {
    const frase = HTTP[status]
    return frase ? frase + ' (HTTP ' + status + ')' : 'HTTP ' + status
  }

  if (cuerpoSinVersion) {
    if (token) return 'el token no lo reconoce como panel'
    return 'falta FLOTA_TOKEN_' + String(nombre).toUpperCase().replace(/-/g, '_') + ' en el panel'
  }

  return ''
}
```

- [ ] **Paso 4: correrla y verla pasar**

Correr: `cd apps/flota && npx vitest run diagnostico.test.ts`
Esperado: PASA, 13 pruebas.

- [ ] **Paso 5: commit**

```bash
git add apps/flota/diagnostico.mjs apps/flota/diagnostico.test.ts
git commit -m "feat(flota): traducir el fallo de una instancia a una frase accionable"
```

---

### Tarea 2: `consultar()` usa el clasificador

**Archivos:**
- Modificar: `apps/flota/estado.mjs:262-305` (la función `consultar`)
- Modificar: `apps/flota/estado.test.ts` (añadir un `describe`)

**Interfaces:**
- Consume: `clasificarFallo` de la Tarea 1.
- Produce: `consultar()` con la misma firma y la misma forma de retorno. Lo
  único que cambia es **el contenido** de `motivo`.

- [ ] **Paso 1: escribir la prueba que falla**

Añadir al final de `apps/flota/estado.test.ts`, y añadir `consultar` a la lista
de importaciones de `./estado.mjs` que ya existe arriba del archivo:

```ts
describe('consultar · el motivo dice que arreglar', () => {
  const instancia = { nombre: 'g500', dominio: 'g500.ejemplo.invalid', canal: 'estable' }

  it('un fallo de DNS se lee como DNS y no como «fetch failed»', async () => {
    const pedir = async () => {
      const e: any = new Error('fetch failed')
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
})
```

- [ ] **Paso 2: correrla y verla fallar**

Correr: `cd apps/flota && npx vitest run estado.test.ts -t "el motivo dice"`
Esperado: FALLA — la primera da `fetch failed` y la segunda `HTTP 404`.

- [ ] **Paso 3: la implementación**

En `apps/flota/estado.mjs`, añadir la importación arriba con las demás:

```js
import { clasificarFallo } from './diagnostico.mjs'
```

Y en `consultar()`, sustituir las tres construcciones de `motivo`:

```js
    if (!respuesta.ok) return { ...fila, motivo: clasificarFallo({ status: respuesta.status }) }
    const cuerpo = await respuesta.json()
    if (typeof cuerpo?.version !== 'string') {
      // OJO: se le pasa el NOMBRE, nunca el cuerpo. Ver la prueba del guard.
      return {
        ...fila,
        motivo: clasificarFallo({ cuerpoSinVersion: true, token, nombre: instancia.nombre }),
      }
    }
    return { ...fila, version: cuerpo.version, fecha: ahora() }
  } catch (error) {
    return { ...fila, motivo: clasificarFallo({ error }) }
  }
```

- [ ] **Paso 4: correr las pruebas del archivo entero**

Correr: `cd apps/flota && npx vitest run estado.test.ts`
Esperado: PASA todo. Si algo rojo aparece en las pruebas viejas, **para**: eso
significa que se cambió la forma de retorno y no solo el contenido.

- [ ] **Paso 5: commit**

```bash
git add apps/flota/estado.mjs apps/flota/estado.test.ts
git commit -m "fix(flota): el motivo de una instancia caida decia fetch failed y no la causa"
```

---

### Tarea 3: la fila conserva el motivo, y la promesa se ata a `CLAVES_FILA`

**Archivos:**
- Modificar: `apps/flota/estado.mjs:68` (añadir `CLAVES_FILA`) y `:109-123`
  (`resumen`)
- Modificar: `apps/flota/estado.test.ts` (el guard, y las pruebas de claves
  exactas)

**Interfaces:**
- Consume: `consultar()` de la Tarea 2, que ya trae `motivo`.
- Produce: `CLAVES_FILA` exportada; las filas de `resumen()` llevan `motivo`
  (`null` si no hay). `COLUMNAS` **no cambia**.

- [ ] **Paso 1: escribir las pruebas que fallan**

```ts
describe('resumen · conserva el motivo sin abrir la puerta a datos del owner', () => {
  it('la fila trae el motivo de la consulta', () => {
    const filas = resumen(
      [{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', canal: 'estable', version: null, motivo: 'el dominio no resuelve (ENOTFOUND)' }],
      { estable: ESTABLE },
    )
    expect(filas[0].motivo).toBe('el dominio no resuelve (ENOTFOUND)')
  })

  it('una instancia sana trae motivo nulo, no una cadena vacia', () => {
    const filas = resumen([consultaViva('g500', ESTABLE, '2026-09-10T00:00:00Z')], { estable: ESTABLE })
    expect(filas[0].motivo).toBeNull()
  })

  // EL GUARD. Sin esto, `motivo` es la puerta de atras de la lista blanca.
  it('NINGUN valor del cuerpo de la instancia acaba en el motivo', () => {
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
```

Y añadir `CLAVES_FILA` a la importación de `./estado.mjs` del principio del
archivo.

- [ ] **Paso 2: correrlas y verlas fallar**

Correr: `cd apps/flota && npx vitest run estado.test.ts -t "conserva el motivo"`
Esperado: FALLA — `CLAVES_FILA` no existe y `filas[0].motivo` es `undefined`.

- [ ] **Paso 3: la implementación**

En `apps/flota/estado.mjs`, junto a `COLUMNAS`:

```js
/** Las únicas columnas que la TABLA imprime. */
export const COLUMNAS = ['nombre', 'dominio', 'canal', 'version', 'estado', 'fecha', 'origen']

/**
 * Las únicas claves que una fila GUARDA. Aquí vive la promesa, y desde el
 * 2026-09-10 ya no coincide con `COLUMNAS`.
 *
 * Se separaron porque `motivo` no puede ir en la tabla —`principal()` ya lo
 * imprime debajo, y su comentario explica que en una celda se vuelve ilegible
 * el día que hay tres instancias caídas— pero SÍ tiene que viajar en el JSON
 * para que el panel web lo pinte.
 *
 * `motivo` y `ultimaVezBien` los escribe el PADRE: uno sale de un código de
 * error o de un estado HTTP, el otro de un reloj. **Ninguno se copia del cuerpo
 * de la respuesta**, y hay una prueba que lo afirma. Ese guard es lo único que
 * impide que este campo se convierta en la puerta de atrás de la lista blanca.
 */
export const CLAVES_FILA = [...COLUMNAS, 'motivo', 'ultimaVezBien']
```

Y en `resumen()`, añadir las dos claves al objeto que construye:

```js
      origen: r.origen ?? 'consulta',
      motivo: r.motivo ?? null,
      ultimaVezBien: r.ultimaVezBien ?? null,
```

- [ ] **Paso 4: correr el archivo entero y arreglar las pruebas de claves a propósito**

Correr: `cd apps/flota && npx vitest run estado.test.ts`

Las pruebas que afirman las claves exactas de una fila van a fallar. **Eso es lo
correcto**: es el gate. Se actualizan a `CLAVES_FILA` **una por una y leyendo lo
que afirman** — no con un buscar y reemplazar. Las que afirman
`CLAVES_REPORTE` **no se tocan**: el reporte saliente no cambia en este plan.

- [ ] **Paso 5: commit**

```bash
git add apps/flota/estado.mjs apps/flota/estado.test.ts
git commit -m "feat(flota): la fila conserva el motivo, y la lista blanca pasa a CLAVES_FILA"
```

---

### Tarea 4: `ultimaVezBien` se arrastra entre pasadas

**Archivos:**
- Modificar: `apps/flota/estado.mjs` (función nueva `arrastrarMemoria` + su uso
  en `principal()`, alrededor de `:503-525`)
- Modificar: `apps/flota/estado.test.ts`

**Interfaces:**
- Consume: las filas de `resumen()` (Tarea 3), que ya traen `ultimaVezBien`.
- Produce: `arrastrarMemoria(filas, previas, ahora)` → filas nuevas.
  `previas` es el arreglo `instancias` del `estado.json` anterior, o `[]`.

- [ ] **Paso 1: escribir la prueba que falla**

```ts
describe('arrastrarMemoria', () => {
  const AHORA = '2026-09-10T12:00:00Z'
  const ANTES = '2026-09-10T09:00:00Z'

  it('una instancia que contesta ahora fija ultimaVezBien en ahora', () => {
    const filas = [{ nombre: 'g500', version: 'v0.5.0', motivo: null, ultimaVezBien: null }]
    expect(arrastrarMemoria(filas, [], () => AHORA)[0].ultimaVezBien).toBe(AHORA)
  })

  it('una instancia caida conserva la ultima vez que estuvo bien', () => {
    const filas = [{ nombre: 'g500', version: null, motivo: 'el dominio no resuelve', ultimaVezBien: null }]
    const previas = [{ nombre: 'g500', ultimaVezBien: ANTES }]
    expect(arrastrarMemoria(filas, previas, () => AHORA)[0].ultimaVezBien).toBe(ANTES)
  })

  it('una instancia caida sin memoria previa se queda en nulo, no inventa una fecha', () => {
    const filas = [{ nombre: 'g500', version: null, motivo: 'x', ultimaVezBien: null }]
    expect(arrastrarMemoria(filas, [], () => AHORA)[0].ultimaVezBien).toBeNull()
  })

  it('no se cruzan las memorias de dos instancias', () => {
    const filas = [
      { nombre: 'a', version: null, motivo: 'x', ultimaVezBien: null },
      { nombre: 'b', version: null, motivo: 'x', ultimaVezBien: null },
    ]
    const previas = [{ nombre: 'b', ultimaVezBien: ANTES }]
    const salida = arrastrarMemoria(filas, previas, () => AHORA)
    expect(salida[0].ultimaVezBien).toBeNull()
    expect(salida[1].ultimaVezBien).toBe(ANTES)
  })
})
```

- [ ] **Paso 2: correrla y verla fallar**

Correr: `cd apps/flota && npx vitest run estado.test.ts -t arrastrarMemoria`
Esperado: FALLA — `arrastrarMemoria` no existe.

- [ ] **Paso 3: la implementación**

En `apps/flota/estado.mjs`:

```js
/**
 * Arrastra `ultimaVezBien` de la pasada anterior.
 *
 * El panel era una foto sin memoria, y eso hacía que «no contesta» no
 * distinguiera un parpadeo de una avería de tres horas. Un solo campo, ninguna
 * base de datos: si la instancia contesta ahora se pone ahora, y si no, se
 * conserva lo que dijera la pasada anterior.
 *
 * Sin fecha inventada: una instancia caída que nunca se vio bien se queda en
 * `null`. Rellenarla con la hora actual diría exactamente lo contrario de la
 * verdad.
 */
export function arrastrarMemoria(filas, previas = [], ahora = () => new Date().toISOString()) {
  const memoria = new Map((previas ?? []).map((p) => [p.nombre, p.ultimaVezBien ?? null]))
  return filas.map((f) => ({
    ...f,
    ultimaVezBien: f.version && f.version !== SIN_DATO ? ahora() : (memoria.get(f.nombre) ?? null),
  }))
}
```

- [ ] **Paso 4: correrla y verla pasar**

Correr: `cd apps/flota && npx vitest run estado.test.ts -t arrastrarMemoria`
Esperado: PASA, 4 pruebas.

- [ ] **Paso 5: leer el `estado.json` anterior, tolerando que no exista**

En `principal()`, antes de `const filas = resumen(...)`:

```js
  // La memoria de la pasada anterior. Un archivo que no existe, o roto, o sin
  // permisos, es «sin memoria» y NO un error: el criterio de esta cabecera es
  // que el panel sale siempre con 0, porque el día que hace falta vigilar es el
  // día que algo está mal.
  let previas = []
  try {
    const texto = await readFile(join(dirPublico, 'estado.json'), 'utf8')
    const json = JSON.parse(texto)
    if (Array.isArray(json?.instancias)) previas = json.instancias
  } catch {
    previas = []
  }
```

Y envolver el resultado de `resumen()`:

```js
  const filas = arrastrarMemoria(resumen(fusionar(consultas, reportes), versiones), previas)
```

- [ ] **Paso 6: la prueba de que un archivo corrupto no tumba el panel**

```ts
it('un estado.json corrupto se trata como sin memoria y el panel no revienta', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flota-'))
  await writeFile(join(dir, 'estado.json'), '{ esto no es json', 'utf8')
  // Se lee con el mismo try/catch que `principal()`: la prueba afirma el
  // criterio, no la implementación.
  let previas: unknown[] = []
  try {
    previas = JSON.parse(await readFile(join(dir, 'estado.json'), 'utf8')).instancias
  } catch {
    previas = []
  }
  expect(previas).toEqual([])
})
```

- [ ] **Paso 7: correr el archivo entero y commitear**

```bash
cd apps/flota && npx vitest run estado.test.ts
cd ../.. && git add apps/flota/estado.mjs apps/flota/estado.test.ts
git commit -m "feat(flota): recordar cuando fue la ultima vez que una instancia contesto bien"
```

---

### Tarea 5: el panel web enseña el motivo

**Archivos:**
- Modificar: `apps/flota/servidor.mjs:91-105` (función `pagina`) y el bloque
  `ESTILO` de arriba
- Modificar: `apps/flota/servidor.test.ts`

**Interfaces:**
- Consume: filas con `motivo` y `ultimaVezBien` (Tareas 3 y 4).
- Produce: HTML con una sub-fila por instancia con motivo.

- [ ] **Paso 1: escribir la prueba que falla**

```ts
describe('pagina · el motivo se ve', () => {
  const sana = { nombre: 'g500', dominio: 'g500.ejemplo.invalid', canal: 'estable', version: 'v0.5.0', estado: 'al-dia', fecha: '—', origen: 'consulta', motivo: null, ultimaVezBien: '2026-09-10T12:00:00Z' }
  const caida = { ...sana, nombre: 'otra', version: '—', estado: 'sin-respuesta', motivo: 'el dominio no resuelve', ultimaVezBien: '2026-09-10T09:00:00Z' }

  it('una instancia caida enseña su motivo', () => {
    expect(pagina([caida], null)).toContain('el dominio no resuelve')
  })

  it('una instancia sana NO enseña motivo: el silencio es la señal', () => {
    const html = pagina([sana], null)
    expect(html).not.toContain('class="motivo"')
  })

  it('el motivo va escapado, como todo lo que viene de fuera', () => {
    const html = pagina([{ ...caida, motivo: '<script>alert(1)</script>' }], null)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('el motivo se acompaña de la ultima vez que estuvo bien', () => {
    expect(pagina([caida], null)).toContain('2026-09-10T09:00:00Z')
  })
})
```

Comprobar que `pagina` esté en las importaciones del archivo de pruebas; si no,
añadirla a la lista existente de `./servidor.mjs`.

- [ ] **Paso 2: correrla y verla fallar**

Correr: `cd apps/flota && npx vitest run servidor.test.ts -t "el motivo se ve"`
Esperado: FALLA — el HTML no contiene el motivo.

- [ ] **Paso 3: la implementación**

En `ESTILO`, añadir una línea:

```css
  tr.motivo td { border-top: 0; padding-top: 0; color: #b60; font-size: 12px }
```

Y en `pagina()`, sustituir el `return` del `map`:

```js
      // El motivo va en una sub-fila a ancho completo y no en una celda: es una
      // frase, y en una celda estrecha se lee mal. Mismo criterio que el
      // terminal, que ya los imprime debajo de la tabla (`estado.mjs:512-514`).
      const fila = `<tr>${celdas}</tr>`
      if (!f.motivo) return fila
      const visto = f.ultimaVezBien ? ' · ultima vez bien ' + escapar(f.ultimaVezBien) : ''
      return (
        fila +
        `\n<tr class="motivo"><td colspan="${COLUMNAS.length}">${escapar(f.motivo)}${visto}</td></tr>`
      )
```

- [ ] **Paso 4: correr las pruebas del archivo entero**

Correr: `cd apps/flota && npx vitest run servidor.test.ts`
Esperado: PASA todo, incluidas las que ya existían del panel y de altas.

- [ ] **Paso 5: commit**

```bash
git add apps/flota/servidor.mjs apps/flota/servidor.test.ts
git commit -m "feat(flota): el panel web enseña por que una instancia no contesta"
```

---

### Tarea 6: la suite entera, la bóveda, la bitácora y la tarjeta

**Archivos:**
- Modificar: `vault/01-Arquitectura/modelo-instancias-soberanas.md`
- Modificar: `docs/Registro_Cambios.md`
- Crear: `docs/evidencias/padre-panel-flota-diagnostico.txt`

- [ ] **Paso 1: correr TODO lo de flota y el typecheck de la web**

```bash
cd apps/flota && npx vitest run
cd ../web && npm run typecheck
```

Esperado: verde las dos. La segunda porque el `typecheck` del repo abarca más de
lo que se tocó, y un verde aquí descarta haber roto algo de rebote.

- [ ] **Paso 2: la nota de la bóveda, en el MISMO commit que el código**

En `vault/01-Arquitectura/modelo-instancias-soberanas.md`, añadir al apartado
del panel de flota: que `sin-respuesta` ahora va acompañado de la causa, que la
lista blanca de lo que se guarda es **`CLAVES_FILA`** y no `COLUMNAS` —y por
qué se separaron—, y que el guard que impide colar datos de un owner por
`motivo` es una prueba, no una promesa en prosa. Actualizar `actualizado:` a la
fecha real y añadir `apps/flota/diagnostico.mjs` a `archivos:`.

- [ ] **Paso 3: la bitácora, en lenguaje llano**

Entrada nueva arriba de `docs/Registro_Cambios.md`: el panel de instancias ya no
dice solo «no contesta», dice por qué —el dominio no resuelve, el certificado
caducó, la aplicación no responde— y desde cuándo. Sin jerga y sin nombres de
archivo.

- [ ] **Paso 4: la tarjeta para desplegarlo en el PADRE**

`apps/flota` **no viaja en la imagen** (el `Dockerfile` construye con
`--filter=web`), así que esto llega con un `git pull` y reiniciando el panel.
La tarjeta lleva: el gate de identidad de máquina (`hostname` + IP) primero, el
`git pull`, **el comando de reinicio confirmado EN la máquina y no escrito de
memoria** —`systemctl list-units | grep -i flota` para averiguarlo—, y como
comprobación final abrir `https://space-os.io/flota/` y ver la causa en la fila
de una instancia caída.

- [ ] **Paso 5: commit**

```bash
git add vault/01-Arquitectura/modelo-instancias-soberanas.md docs/Registro_Cambios.md docs/evidencias/padre-panel-flota-diagnostico.txt
git commit -m "docs(flota): la boveda, la bitacora y la tarjeta del panel con diagnostico"
```

---

## Autorrevisión de este plan

**Cobertura del diseño:** §4.1 → Tarea 1. §4.2 → Tarea 2. §3 y §4.3 (lo que la
fila guarda) → Tarea 3. §4.3 (la memoria) → Tarea 4. §4.4 → Tarea 5. §6
(pruebas) → repartido en las cinco. §7 (llegada al PADRE) → Tarea 6.

**Sin huecos:** ningún paso dice «añadir manejo de errores» ni «probar lo
anterior». Todos traen el código.

**Tipos consistentes:** `clasificarFallo` se define en la Tarea 1 con la firma
`{ error, status, cuerpoSinVersion, token, nombre }` y se llama con esas mismas
claves en la Tarea 2. `arrastrarMemoria(filas, previas, ahora)` se define en la
Tarea 4 y se usa con ese orden en el mismo sitio. `CLAVES_FILA` se exporta en la
Tarea 3 y se consume en su prueba.

**Lo que este plan NO hace, y está en el diseño §5:** no sondea más hondo, no
guarda historial, y no renombra ningún estado.

**Añadido tras la retro del 2026-09-10:** la frase lleva el código entre
paréntesis (Tareas 1 y 2, con las dos pruebas de que se imprime **el código que
llegó** y no el representante de su grupo); la fase 2 se conserva y se
desarrolla en las Tareas 7 a 9; y una instancia sana sigue sin mostrar nada
(Tarea 5, y otra vez en la Tarea 8 para el caso del update que fue bien).

**Cobertura de la fase 2:** §9.1 → Tarea 9 paso 2. §9.2 (la frontera al revés)
→ Tarea 7, con la lista cerrada y el guard de «clave que nadie declaró». §9.3 →
Tareas 7, 8 y 9. §9.4 (el coste y el orden) → Tarea 9 paso 4.

---

# FASE 2 · saber que una actualización falló, y en qué paso

Se conserva por la retro del 10/09. Diseño en la §9 del documento de diseño.
**Va en commits aparte de la fase 1**, para que la 1 se pueda desplegar sin
esperar a ésta.

## Restricciones de esta fase, y no son negociables

- **La instancia NO manda texto libre.** Manda `resultado` (`ok` \| `fallo`) y
  `paso` (lista cerrada). **Las palabras las escribe el PADRE**, igual que en la
  fase 1. Un campo `error` de texto libre cruzando hacia el plano de control
  rompe el argumento entero de §3 del diseño.
- **El PADRE va PRIMERO.** `validarReporte` rechaza el reporte **entero** si
  llega una clave que no conoce (`reporte.mjs:69-78`). Si se despliega
  `update.sh` antes que el panel, **todos los reportes se rechazan** — la flota
  se queda ciega justo por el cambio que venía a darle vista.
- **Las claves nuevas son OPCIONALES.** Ese mismo validador exige que estén
  todas las de `CLAVES_REPORTE`. Si `resultado` y `paso` fueran obligatorias,
  una instancia con el `update.sh` viejo dejaría de reportar.
- **`version` sigue siendo obligatoria y no vacía.** Un update que falla antes
  de arrancar la imagen nueva reporta **la versión que sigue sirviendo**, que
  `update.sh` ya anota en `/var/lib/space-os/version-anterior`.

---

### Tarea 7: el PADRE acepta y traduce las dos claves nuevas

**Archivos:**
- Modificar: `apps/flota/estado.mjs:65` (`CLAVES_REPORTE` y una lista nueva)
- Modificar: `apps/flota/reporte.mjs:63-95` (`validarReporte`)
- Modificar: `apps/flota/diagnostico.mjs` (la frase del paso)
- Modificar: `apps/flota/estado.test.ts`, `apps/flota/diagnostico.test.ts`

**Interfaces:**
- Consume: `clasificarFallo` de la Tarea 1.
- Produce: `CLAVES_REPORTE_OPCIONALES = ['resultado', 'paso']`, `PASOS`, y
  `fraseDeActualizacion({ resultado, paso })` → `string | null`.

- [ ] **Paso 1: escribir las pruebas que fallan**

En `diagnostico.test.ts`:

```ts
import { fraseDeActualizacion, PASOS } from './diagnostico.mjs'

describe('fraseDeActualizacion', () => {
  it('un update que fue bien no dice nada: el silencio es la señal', () => {
    expect(fraseDeActualizacion({ resultado: 'ok', paso: null })).toBeNull()
  })

  it('un fallo al migrar se lee sin jerga', () => {
    expect(fraseDeActualizacion({ resultado: 'fallo', paso: 'migraciones' })).toBe(
      'la actualizacion fallo al aplicar las migraciones',
    )
  })

  it('un fallo en el sondeo de salud dice que la version nueva no levanto', () => {
    expect(fraseDeActualizacion({ resultado: 'fallo', paso: 'salud' })).toBe(
      'la actualizacion fallo: la version nueva no respondio al sondeo de salud',
    )
  })

  it('una instancia con el update.sh viejo no dice nada, y NO es un fallo', () => {
    expect(fraseDeActualizacion({})).toBeNull()
  })

  it('los pasos son una lista cerrada', () => {
    expect(PASOS).toEqual(['pull', 'respaldo', 'migraciones', 'arranque', 'salud'])
  })
})
```

En `estado.test.ts`:

```ts
describe('validarReporte · las claves nuevas son opcionales', () => {
  const base = {
    instancia: 'g500', ok: true, version: 'v0.5.0',
    ultimaMigracion: '20260910_pais_sin_default.sql', base: 'ok',
    canal: 'estable', uptime: 120,
  }

  it('un reporte SIN resultado ni paso sigue siendo valido (update.sh viejo)', () => {
    expect(validarReporte(base).ok).toBe(true)
  })

  it('un reporte CON las dos es valido', () => {
    expect(validarReporte({ ...base, resultado: 'fallo', paso: 'migraciones' }).ok).toBe(true)
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
  it('una clave que nadie declaro sigue tumbando el reporte entero', () => {
    expect(validarReporte({ ...base, error: 'traceback con datos del cliente' }).ok).toBe(false)
  })
})
```

- [ ] **Paso 2: correrlas y verlas fallar**

Correr: `cd apps/flota && npx vitest run diagnostico.test.ts estado.test.ts`
Esperado: FALLA — `fraseDeActualizacion` no existe, y el reporte con
`resultado` se rechaza por «claves de mas».

- [ ] **Paso 3: la implementación**

En `apps/flota/diagnostico.mjs`:

```js
/** Los pasos de `update.sh` donde puede morir una actualizacion. Cerrada. */
export const PASOS = ['pull', 'respaldo', 'migraciones', 'arranque', 'salud']

const FRASE_PASO = {
  pull: 'la actualizacion fallo al bajar la imagen',
  respaldo: 'la actualizacion fallo al respaldar la base, y NO siguio',
  migraciones: 'la actualizacion fallo al aplicar las migraciones',
  arranque: 'la actualizacion fallo al levantar el contenedor',
  salud: 'la actualizacion fallo: la version nueva no respondio al sondeo de salud',
}

/**
 * La frase de una actualizacion, o `null` si no hay nada que decir.
 *
 * >>> Devuelve `null` en DOS casos que no hay que confundir: la actualizacion
 * >>> fue bien, y la instancia no lo dice porque su `update.sh` es anterior a
 * >>> este cambio. Ninguno de los dos es un fallo, y por eso los dos callan.
 *
 * >>> Y la frase la escribe el PADRE, no la instancia. Lo que cruza la frontera
 * >>> son dos valores de listas cerradas; las palabras se ponen aqui. Es el
 * >>> mismo principio que sostiene `motivo` en la fase 1.
 */
export function fraseDeActualizacion({ resultado, paso } = {}) {
  if (resultado !== 'fallo') return null
  return (
    FRASE_PASO[paso] ??
    'la actualizacion fallo en un paso que este panel no conoce: ' + String(paso)
  )
}
```

En `apps/flota/estado.mjs`, junto a `CLAVES_REPORTE`:

```js
/**
 * Las que un `update.sh` nuevo AÑADE, y que un viejo no manda.
 *
 * Opcionales a proposito: `validarReporte` exige que esten todas las de
 * `CLAVES_REPORTE`, asi que declararlas ahi dejaria sin reportar a toda
 * instancia que no se haya actualizado todavia — y eso es toda la flota el dia
 * del despliegue.
 */
export const CLAVES_REPORTE_OPCIONALES = ['resultado', 'paso']
```

En `apps/flota/reporte.mjs`, dentro de `validarReporte`:

```js
  const conocidas = [...CLAVES_REPORTE, ...CLAVES_REPORTE_OPCIONALES]
  const deMas = claves.filter((c) => !conocidas.includes(c))
```

y al final de las comprobaciones de valores, antes del `return { ok: true }`:

```js
  // Solo se validan si vienen: son opcionales.
  if (cuerpo.resultado !== undefined && cuerpo.resultado !== 'ok' && cuerpo.resultado !== 'fallo') {
    return { ok: false, motivo: '`resultado` no es "ok" ni "fallo"' }
  }
  if (cuerpo.paso !== undefined && cuerpo.paso !== null && !PASOS.includes(cuerpo.paso)) {
    return { ok: false, motivo: '`paso` no es uno de: ' + PASOS.join(', ') }
  }
```

- [ ] **Paso 4: correr las dos suites y commitear**

```bash
cd apps/flota && npx vitest run
cd ../.. && git add apps/flota/diagnostico.mjs apps/flota/diagnostico.test.ts apps/flota/estado.mjs apps/flota/reporte.mjs apps/flota/estado.test.ts
git commit -m "feat(flota): el padre acepta que una instancia le diga si su update fallo"
```

---

### Tarea 8: la fila y el panel enseñan el fallo de actualización

**Archivos:**
- Modificar: `apps/flota/estado.mjs` (`resumen`)
- Modificar: `apps/flota/estado.test.ts`

**Interfaces:**
- Consume: `fraseDeActualizacion` (Tarea 7) y la sub-fila del HTML (Tarea 5),
  que **no cambia**: ya pinta `motivo`.
- Produce: filas cuyo `motivo` puede venir de una actualización fallida.

- [ ] **Paso 1: escribir la prueba que falla**

```ts
it('una instancia que reporto un fallo de update lo dice, aunque conteste bien', () => {
  const filas = resumen(
    [{
      nombre: 'g500', dominio: 'g500.ejemplo.invalid', canal: 'estable',
      version: 'v0.4.1', fecha: '2026-09-10T00:00:00Z', origen: 'reporte',
      resultado: 'fallo', paso: 'migraciones',
    }],
    { estable: 'v0.5.0' },
  )
  expect(filas[0].estado).toBe('rezagada')
  expect(filas[0].motivo).toBe('la actualizacion fallo al aplicar las migraciones')
})

it('si la instancia contesta bien Y su update fue bien, no hay motivo', () => {
  const filas = resumen(
    [{ ...consultaViva('g500', ESTABLE, '2026-09-10T00:00:00Z'), resultado: 'ok', paso: null }],
    { estable: ESTABLE },
  )
  expect(filas[0].motivo).toBeNull()
})
```

- [ ] **Paso 2: correrla y verla fallar**

Correr: `cd apps/flota && npx vitest run estado.test.ts -t "fallo de update"`
Esperado: FALLA — `motivo` es `null`.

- [ ] **Paso 3: la implementación**

En `resumen()`, sustituir la línea de `motivo`:

```js
      // El motivo de transporte gana: si la instancia no contesta AHORA, eso es
      // mas urgente que un update que fallo ayer. Si contesta, se enseña el del
      // update, que si no no se veria en ninguna parte.
      motivo: r.motivo ?? fraseDeActualizacion(r) ?? null,
```

- [ ] **Paso 4: correr, comprobar que el guard sigue verde, y commitear**

Correr: `cd apps/flota && npx vitest run`

La prueba del guard de la Tarea 3 **tiene que seguir pasando**: `resultado` y
`paso` entran en la fila solo a través de la frase, y ni uno ni otro se copian.

```bash
git add apps/flota/estado.mjs apps/flota/estado.test.ts
git commit -m "feat(flota): el panel enseña que el update de una instancia fallo y en que paso"
```

---

### Tarea 9: `update.sh` lo cuenta, y el despliegue en orden

**Archivos:**
- Modificar: `infra/scripts/update.sh:540-570` (la función que arma el JSON) y
  el camino de fallo
- Modificar: `infra/scripts/pruebas-update.sh`
- Crear: `docs/evidencias/flota-fase2-desplegar.txt`

- [ ] **Paso 1: que el JSON lleve las dos claves**

En la función que arma el cuerpo, sustituir el `printf` final:

```sh
  # `resultado` y `paso` los pone este script; el padre los valida contra su
  # lista cerrada y ESCRIBE LA FRASE. Aqui no se manda texto libre a proposito:
  # un mensaje de error puede arrastrar un fragmento de log con datos del
  # cliente, y esto va al plano de control.
  printf '{"instancia":"%s","resultado":"%s","paso":"%s",%s' \
    "$instancia" "$FLOTA_RESULTADO" "$FLOTA_PASO" "${respuesta#\{}"
```

- [ ] **Paso 2: que el camino de FALLO también reporte**

Hoy solo se reporta al terminar bien. Se declara arriba `FLOTA_RESULTADO=ok` y
`FLOTA_PASO=`, cada paso lo actualiza **antes** de empezar
(`FLOTA_PASO=migraciones`, etc.), y el manejador de salida pone
`FLOTA_RESULTADO=fallo` cuando el código de salida no es 0.

**Y si no hay respuesta de `/api/version`** —porque la versión nueva no
levantó— se usa la que sigue sirviendo, de
`/var/lib/space-os/version-anterior`: `version` es obligatoria en el validador
del padre, y un reporte sin ella se rechazaría entero.

- [ ] **Paso 3: probarlo sin tocar ninguna instancia**

`infra/scripts/pruebas-update.sh` ya existe para esto. Añadir un caso que
simule un fallo en migraciones y afirme que el JSON del reporte lleva
`"resultado":"fallo"` y `"paso":"migraciones"`.

- [ ] **Paso 4: la tarjeta de despliegue, con el orden dentro**

`docs/evidencias/flota-fase2-desplegar.txt`, y el orden es lo que la tarjeta
existe para imponer:

1. **el PADRE primero** — `git pull` y reiniciar el panel. Si se hace al revés,
   `validarReporte` rechaza **todos** los reportes por «claves de mas»;
2. después, copiar `update.sh` a **cada** instancia (hoy g500 y DEMO);
3. forzar un `update.sh` en una y comprobar en el panel que su fila aparece;
4. y el gate de identidad de máquina antes de cada bloque.

- [ ] **Paso 5: commit**

```bash
git add infra/scripts/update.sh infra/scripts/pruebas-update.sh docs/evidencias/flota-fase2-desplegar.txt
git commit -m "feat(flota): update.sh dice si fallo y en que paso, y la tarjeta impone el orden"
```

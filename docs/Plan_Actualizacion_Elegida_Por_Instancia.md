# Plan — cada instancia elige si toma la versión nueva

> **Para quien ejecute esto:** una tarea = un commit, en orden, respetando su
> «Depende de». **TDD literal**: primero la prueba, **en rojo y a la vista**, y la
> implementación en un paso separado. El rojo tiene que ser **fuerte** (falla por
> comportamiento, no por «módulo no encontrado») — es la lección de B18.

**Objetivo:** que el dueño de cada instancia decida, desde su propia aplicación, si
instala la versión nueva cuando se publica una — en vez de que el canal se la
imponga.

**Arquitectura:** la base de la instancia es el buzón. `update.sh` escribe *qué hay
disponible*; la aplicación escribe *qué quiere el dueño*; cada uno lee lo del otro
en su siguiente corrida. Ninguna vía de red nueva y el PADRE sigue sin aparecer.

**Spec:** `docs/adr/0037-cada-instancia-elige-si-toma-la-version-nueva.md` — se lee
**antes** de empezar. Este plan discute el *cómo*; el *por qué* está allí.

---

## Restricciones globales

Salen de `CLAUDE.md` y de `vault/06-Operacion/convenciones.md`. Aplican a **todas**
las tareas:

- **Todo en español**: archivos, funciones, variables, columnas, comentarios y
  mensajes de error.
- **Commits convencionales en español y SIN ACENTOS**:
  `feat(actualizaciones): la decision de actualizar, pura y probada`. El cuerpo
  explica el porqué, lo que apareció al hacerlo y qué se verificó.
- **Capas fijas**: `route.ts` → `*-controller.ts` → `*-repo.ts` → `db.ts`. El SQL
  vive en el repo, **nunca** en el route, y siempre parametrizado.
- **Las dos suites se corren desde `apps/web/`**:
  `cd apps/web && npm test` y `cd apps/web && npm run test:e2e`.
  Las e2e **exigen un build ANTES** o mueren las 41 en falso tras 636 s:
  `cd apps/web && npm run build && npm run test:e2e`.
- **Migraciones** `YYYYMMDD_descripcion.sql`, transaccionales e idempotentes. **No
  se edita una ya aplicada** y **no se toca `db/schema.sql` directo**.
- **Zona ROJA**: esto toca migración y el proceso de despliegue de toda la flota.
  Se reclama la zona en `vault/07-Agentes/tablero.md` antes de escribir.
- **La nota de bóveda se actualiza en el MISMO commit que cambia el código**
  (regla 4 de `AGENTES.md`).
- **Nada de `ssh`, `curl` a producción, `doctl`, `psql` contra un servidor,
  `pm2`.** Lo que toque un droplet se escribe como **tarjeta para una persona**.
- **Ningún valor real quemado** en archivos versionados: ni dominios, ni IPs, ni
  tokens, ni el nombre del registry.
- **`scripts/*.mjs` va en LF**, lo impone `.gitattributes`. Un `.mjs` con CRLF
  rompe la limpieza del shebang de vitest y muere con `SyntaxError` sin decir por
  qué.

---

## Mapa de archivos

| Archivo | De qué responde |
|---|---|
| `scripts/actualizaciones.mjs` | **Crear.** La decisión, pura. Sin base, sin red, sin bash. Viaja en la imagen |
| `scripts/actualizaciones.test.ts` | **Crear.** Sus pruebas. `vitest.config.ts:41` ya incluye `../../scripts/**/*.test.ts` |
| `db/migrations/20260922_actualizaciones_instancia.sql` | **Crear.** La tabla de una fila y sus `grant` por columna |
| `apps/web/lib/server/actualizaciones-repo.ts` | **Crear.** El SQL. Único sitio que toca la tabla desde la app |
| `apps/web/app/api/actualizaciones/route.ts` | **Crear.** `GET` y `PATCH`, con `exigir()` |
| `apps/web/components/demo/admin/ActualizacionesPanel.tsx` | **Crear.** La tarjeta |
| `apps/web/app/(app)/(shell)/administracion/page.tsx` | **Modificar.** Montar la tarjeta |
| `infra/scripts/update.sh` | **Modificar.** `--comprobar`, la sonda de la tabla y obedecer la decisión |
| `Dockerfile:106` | **Modificar.** La lista blanca de scripts, una línea más |
| `infra/scripts/instalar-hijo.sh:867` · `provision-instancia.sh:834` | **Modificar.** La entrada de cron frecuente |
| `infra/scripts/pruebas-update.sh` | **Modificar.** Casos nuevos |
| `apps/web/lib/test/migraciones.e2e.test.ts:106` | **Modificar.** La tabla nueva entra en la lista de «sin RLS a propósito» |

---

## Tarea 1 · La decisión, pura y probada

**Depende de:** nada.

**Por qué va primero y sola:** es la única pieza donde puede esconderse un fallo
silencioso, y es la única que se puede probar de verdad. Lo que se escribe dentro
de un `.sh` no lo prueba nadie.

**Por qué `.mjs` y no TypeScript:** `update.sh` corre `node` **dentro de la imagen**
(`infra/scripts/update.sh:1840-1846`), donde no hay TypeScript compilado que se
pueda `require`. Un `.mjs` viaja tal cual y lo prueba vitest igual — es lo que ya
hacen `scripts/migrar.mjs` y `scripts/semilla-demo.mjs`.

**Archivos:**
- Crear: `scripts/actualizaciones.mjs`
- Crear: `scripts/actualizaciones.test.ts`

**Interfaces que produce** (las usan las tareas 3 y 5):

```
MODOS = ['automatica', 'aprobacion']
decidirActualizacion({ modo, corrida, digestInstalado, digestDisponible, aprobadoDigest })
  → { actualizar: boolean, motivo: string }
motivo ∈ 'sin-disponible' | 'sin-cambios' | 'automatica' | 'automatica-espera-madrugada'
       | 'aprobada' | 'aprobacion-caduca' | 'esperando-aprobacion' | 'modo-desconocido'
corrida ∈ 'comprobar' | 'programada'
```

- [ ] **Paso 1 · Escribir la prueba, que falle**

`scripts/actualizaciones.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { decidirActualizacion, MODOS } from './actualizaciones.mjs'

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
```

- [ ] **Paso 2 · Correrla y ver el rojo FUERTE**

Primero el esqueleto que compila y lanza, para que el rojo sea por comportamiento:

`scripts/actualizaciones.mjs`:

```js
export const MODOS = ['automatica', 'aprobacion']

export function decidirActualizacion(_estado) {
  throw new Error('sin implementar')
}
```

Correr: `cd apps/web && npx vitest run ../../scripts/actualizaciones.test.ts`
Esperado: **10 fallos**, todos con `Error: sin implementar`. Si alguno dice
«is not a function» o «Cannot find module», el rojo es débil: arreglarlo antes de
seguir.

- [ ] **Paso 3 · Commitear el rojo**

```bash
git add scripts/actualizaciones.mjs scripts/actualizaciones.test.ts
git commit -m "test(actualizaciones): la decision de actualizar, en rojo"
```

- [ ] **Paso 4 · Implementar**

```js
export const MODOS = ['automatica', 'aprobacion']

/**
 * Si esta instancia debe tomar la version disponible, y por que.
 *
 * EL ORDEN DE LAS PREGUNTAS ES LA DECISION, y conviene leerlo entero antes de
 * tocarlo:
 *
 *  1. `automatica` se resuelve ANTES de mirar la aprobacion. Si se mirara
 *     primero, una aprobacion vieja colgando congelaria a quien eligio
 *     automatica — y nadie lo veria, porque no da error.
 *  2. La aprobacion se compara contra el digest DISPONIBLE, no contra el
 *     nombre de la version. Es el ADR 0037: el dueno aprueba lo que vio.
 *  3. Lo desconocido no actualiza. Actualizar corta el servicio y migra la
 *     base; ante la duda, la respuesta segura es no.
 */
export function decidirActualizacion({
  modo,
  corrida,
  digestInstalado,
  digestDisponible,
  aprobadoDigest,
}) {
  if (!digestDisponible) return { actualizar: false, motivo: 'sin-disponible' }
  if (digestDisponible === digestInstalado) return { actualizar: false, motivo: 'sin-cambios' }

  if (modo === 'automatica') {
    return corrida === 'programada'
      ? { actualizar: true, motivo: 'automatica' }
      : { actualizar: false, motivo: 'automatica-espera-madrugada' }
  }

  if (modo !== 'aprobacion') return { actualizar: false, motivo: 'modo-desconocido' }

  if (aprobadoDigest && aprobadoDigest === digestDisponible) {
    return { actualizar: true, motivo: 'aprobada' }
  }
  if (aprobadoDigest) return { actualizar: false, motivo: 'aprobacion-caduca' }
  return { actualizar: false, motivo: 'esperando-aprobacion' }
}
```

- [ ] **Paso 5 · Verde y suite completa**

```
cd apps/web && npx vitest run ../../scripts/actualizaciones.test.ts
cd apps/web && npm test
```
Esperado: 10 de 10 en la primera; la suite completa sin regresiones.

- [ ] **Paso 6 · Commitear**

```bash
git add scripts/actualizaciones.mjs
git commit -m "feat(actualizaciones): la decision de actualizar, pura y probada"
```

---

## Tarea 2 · La tabla de la instancia

**Depende de:** nada (puede ir en paralelo con la 1).

**Lo que la hace distinta de casi todas las del repo:** no lleva `tenant_id` y no
lleva RLS. Describe **el droplet**, no una organización — como `schema_migrations`.
`config_negocio` es una fila **por tenant** desde el ADR 0011 (`db/schema.sql:643-667`),
así que esto no cabe ahí: obligaría a preguntar «¿la de qué tenant manda?».

**Archivos:**
- Crear: `db/migrations/20260922_actualizaciones_instancia.sql`
- Modificar: `apps/web/lib/test/migraciones.e2e.test.ts:106`

- [ ] **Paso 1 · Escribir la prueba, que falle**

En `apps/web/lib/test/migraciones.e2e.test.ts`, añadir a la lista que ya declara
las tablas de instancia sin RLS:

```ts
      { relname: 'actualizaciones_instancia', relrowsecurity: false },
```

Y un caso nuevo en el mismo archivo:

```ts
  it('actualizaciones_instancia es de la INSTANCIA: una sola fila y sin tenant_id', async () => {
    // Sin `tenant_id` a proposito: describe el droplet, no una organizacion.
    // Si alguien le anade la columna, esta prueba lo dice antes de que la
    // pregunta "la de que tenant manda" se quede sin respuesta.
    const cols = await poolTest().query(
      `select count(*)::int as n from information_schema.columns
        where table_name = 'actualizaciones_instancia' and column_name = 'tenant_id'`,
    )
    expect(cols.rows[0].n).toBe(0)

    const filas = await poolTest().query('select count(*)::int as n from actualizaciones_instancia')
    expect(filas.rows[0].n).toBe(1)

    // NEGATIVO: una segunda fila no cabe. El `check (id)` mas la clave
    // primaria booleana son lo que lo impide.
    await expect(
      poolTest().query('insert into actualizaciones_instancia (id) values (false)'),
    ).rejects.toThrow()
  })

  it('el rol de la app puede leer todo, y escribir SOLO lo del dueno', async () => {
    // La separacion de escritores no es una convencion: la impone la base.
    // `digest_disponible` lo escribe el actualizador con el rol privilegiado;
    // si la app pudiera escribirlo, podria auto-aprobarse cualquier cosa.
    await expect(poolApp().query('select modo from actualizaciones_instancia')).resolves.toBeTruthy()
    await expect(
      poolApp().query("update actualizaciones_instancia set digest_disponible = 'sha256:inventado'"),
    ).rejects.toThrow()
  })
```

- [ ] **Paso 2 · Correrla y ver el rojo**

```
cd apps/web && npm run build && npm run test:e2e -- migraciones
```
Esperado: FALLA con `relation "actualizaciones_instancia" does not exist`.

- [ ] **Paso 3 · Escribir la migración**

`db/migrations/20260922_actualizaciones_instancia.sql`:

```sql
-- ============================================================================
--  Cada instancia elige si toma la version nueva. ADR 0037.
-- ----------------------------------------------------------------------------
--  UNA SOLA FILA, y sin `tenant_id`: esto describe el DROPLET, no una
--  organizacion de dentro. Es hermana de `schema_migrations`, no de
--  `config_negocio` —que es una fila por tenant desde el ADR 0011—.
--
--  DOS ESCRITORES CON PAPELES DISTINTOS, y la separacion la impone la base y
--  no la buena voluntad del codigo:
--    · el ACTUALIZADOR (rol privilegiado, el de las migraciones) escribe lo
--      que hay disponible;
--    · la APLICACION (`spaces_app`) escribe solo lo que decide el dueno.
--  Si la app pudiera escribir `digest_disponible`, podria aprobarse a si misma
--  una imagen que nadie publico. De ahi el `grant update (...)` por columna.
--
--  `obligatoria` nace y se queda SIN ESCRITOR a proposito: es el hueco para un
--  parche de seguridad que se salte la espera. Si esa politica existira, y
--  quien la decide, es cuestion de negocio y el ADR 0037 la deja abierta.
--  Anadir la columna ahora cuesta nada; retrofitearla despues, no.
-- ============================================================================
begin;

create table if not exists actualizaciones_instancia (
  -- Clave primaria booleana con `check (id)`: la unica fila posible es `true`.
  id boolean primary key default true constraint actualizaciones_instancia_una_fila check (id),

  -- ── Lo que decide el dueno (lo escribe la app) ──────────────────────────
  modo text not null default 'aprobacion'
    constraint actualizaciones_instancia_modo_ck check (modo in ('automatica', 'aprobacion')),
  aprobado_digest text,
  aprobado_por uuid references usuarios(id),
  aprobado_en timestamptz,

  -- ── Lo que ve el actualizador (lo escribe update.sh) ────────────────────
  version_instalada text,
  digest_instalado text,
  version_disponible text,
  digest_disponible text,
  migraciones_pendientes integer,
  comprobado_en timestamptz,

  -- Sin escritor todavia. Ver la cabecera.
  obligatoria boolean not null default false,

  actualizado_en timestamptz not null default now()
);

-- `aprobacion` por omision: una instancia nueva no se actualiza sin que alguien
-- diga que si. Decision del dueno del producto (ADR 0037).
insert into actualizaciones_instancia (id) values (true) on conflict (id) do nothing;

-- Los GRANT, sobre los roles que EXISTAN. Se enumeran candidatos porque una
-- instancia nueva trae `spaces_app` y el droplet viejo traia `spaces_user`;
-- es el mismo idioma que `20260820_grants_rol_app.sql`.
do $$
declare
  candidatos text[] := array['spaces_app', 'spaces_user'];
  r text;
begin
  foreach r in array candidatos loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select on actualizaciones_instancia to %I', r);
      -- Por COLUMNA. Lo que no esta aqui, la app no lo puede escribir.
      execute format(
        'grant update (modo, aprobado_digest, aprobado_por, aprobado_en, actualizado_en) '
        'on actualizaciones_instancia to %I', r);
    end if;
  end loop;
end $$;

commit;
```

- [ ] **Paso 4 · Verde, y comprobar que es idempotente**

```
cd apps/web && npm run test:e2e -- migraciones
DATABASE_URL="postgresql://spaces:spaces@localhost:5433/spaces" node scripts/migrar.mjs
DATABASE_URL="postgresql://spaces:spaces@localhost:5433/spaces" node scripts/migrar.mjs
```
Esperado: e2e en verde; la primera corrida aplica **1**, la segunda **0**.

- [ ] **Paso 5 · Actualizar la bóveda y commitear**

`vault/04-Datos/esquema.md` y `vault/04-Datos/migraciones.md`, en el MISMO commit.

```bash
git add db/migrations/20260922_actualizaciones_instancia.sql apps/web/lib/test/migraciones.e2e.test.ts vault/04-Datos/
git commit -m "feat(actualizaciones): la tabla de instancia, con los dos escritores separados por grant"
```

---

## Tarea 3 · El repo y el endpoint

**Depende de:** tareas 1 y 2.

**Archivos:**
- Crear: `apps/web/lib/server/actualizaciones-repo.ts`
- Crear: `apps/web/app/api/actualizaciones/route.ts`
- Crear: `apps/web/lib/test/actualizaciones.e2e.test.ts`

**Interfaces que produce** (las usa la tarea 4):

```ts
type EstadoActualizacion = {
  modo: 'automatica' | 'aprobacion'
  versionInstalada: string | null
  versionDisponible: string | null
  digestDisponible: string | null
  migracionesPendientes: number | null
  comprobadoEn: string | null
  aprobadoDigest: string | null
  hayNovedad: boolean          // digestDisponible existe y != digestInstalado
}
GET  /api/actualizaciones            → EstadoActualizacion
PATCH /api/actualizaciones  body: { modo? } | { aprobarDigest: string }
```

- [ ] **Paso 1 · Escribir las pruebas, que fallen**

`apps/web/lib/test/actualizaciones.e2e.test.ts`. Los casos que importan son los
negativos:

```ts
it('NEGATIVO: quien no es Dueno no puede cambiar el modo', async () => {
  const r = await comoOperaciones().patch('/api/actualizaciones', { modo: 'automatica' })
  expect(r.status).toBe(403)
})

it('NEGATIVO: no se puede aprobar un digest que no es el disponible', async () => {
  // Es el ADR 0037 defendido en el servidor y no solo en la pantalla: un
  // cliente viejo, o una pestana abierta desde ayer, mandaria el digest de
  // ayer. Aceptarlo instalaria algo que nadie miro.
  await sembrarDisponible('sha256:nuevo')
  const r = await comoDueno().patch('/api/actualizaciones', { aprobarDigest: 'sha256:de-ayer' })
  expect(r.status).toBe(409)
  const fila = await poolTest().query('select aprobado_digest from actualizaciones_instancia')
  expect(fila.rows[0].aprobado_digest).toBeNull()
})

it('NEGATIVO: el PATCH no puede escribir lo que le toca al actualizador', async () => {
  const r = await comoDueno().patch('/api/actualizaciones', { digestDisponible: 'sha256:mio' })
  expect(r.status).toBe(400)   // `.strict()` del schema
})

it('aprobar el digest disponible lo guarda con quien y cuando', async () => {
  await sembrarDisponible('sha256:nuevo')
  const r = await comoDueno().patch('/api/actualizaciones', { aprobarDigest: 'sha256:nuevo' })
  expect(r.status).toBe(200)
  const fila = await poolTest().query(
    'select aprobado_digest, aprobado_por, aprobado_en from actualizaciones_instancia')
  expect(fila.rows[0].aprobado_digest).toBe('sha256:nuevo')
  expect(fila.rows[0].aprobado_por).not.toBeNull()
  expect(fila.rows[0].aprobado_en).not.toBeNull()
})
```

- [ ] **Paso 2 · Ver el rojo**

```
cd apps/web && npm run build && npm run test:e2e -- actualizaciones
```
Esperado: 404 en todos — la ruta no existe.

- [ ] **Paso 3 · Escribir repo, controller y route**

`actualizaciones-repo.ts` lleva **todo** el SQL, parametrizado. El `route.ts` usa
`exigir('administracion', 'ver')` para el `GET` y `exigir('administracion',
'aprobar')` para el `PATCH` — el mismo par que `app/api/config/route.ts:91` y
`app/api/cambios/route.ts:32`. El schema del `PATCH` va con `.strict()`, para que un
campo con typo dé 400 en vez de ignorarse en silencio.

La comprobación del digest va **en el servidor**: `aprobarDigest` tiene que ser
igual a `digest_disponible` en ese momento, o 409. Y toda aprobación se registra
con `registrarAccion()`, como el resto de lo que mueve algo.

- [ ] **Paso 4 · Verde y commit**

```
cd apps/web && npm run typecheck && npm test && npm run test:e2e -- actualizaciones
git add apps/web/lib/server/actualizaciones-repo.ts apps/web/app/api/actualizaciones/ apps/web/lib/test/actualizaciones.e2e.test.ts vault/02-Backend/
git commit -m "feat(actualizaciones): endpoint para ver el estado y decidir, con la aprobacion atada al digest"
```

---

## Tarea 4 · La pantalla

**Depende de:** tarea 3.

**Archivos:**
- Crear: `apps/web/components/demo/admin/ActualizacionesPanel.tsx`
- Crear: `apps/web/components/demo/admin/actualizaciones-ui.ts` + `.test.ts`
- Modificar: `apps/web/app/(app)/(shell)/administracion/page.tsx`

**No hace falta tocar `nav.ts`:** Administración ya existe y ya es
`roles: ['DUENO']` (`components/demo/shell/nav.ts:158`).

**Lo que se prueba, y dónde:** `vitest.config.ts` no monta jsdom a propósito, así
que **lo que se escriba dentro del `.tsx` no lo prueba nadie**. Las frases van a
`actualizaciones-ui.ts`:

```ts
textoDeEstado(estado): { tono: 'ok' | 'aviso' | 'info', texto: string }
```

Casos que van en rojo primero: al día (`ok`); hay novedad y el modo es
`aprobacion` (`aviso`, y la frase **nombra la versión**); hay novedad y el modo es
`automatica` (`info`, y dice **cuándo** entrará — de madrugada, no «pronto»); nunca
se ha comprobado (`info`, y lo dice en vez de fingir que está al día); y el
negativo: **una aprobación caduca no se pinta como aprobada**, se pinta como que
hay una más nueva.

La tarjeta dice también **cuántas migraciones** traería, porque es lo que explica
que la actualización corte servicio, y la hora real de la próxima ventana
automática.

- [ ] **Paso 1 · Escribir la prueba, que falle**

`apps/web/components/demo/admin/actualizaciones-ui.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { textoDeEstado } from './actualizaciones-ui'

const AL_DIA = {
  modo: 'aprobacion' as const,
  versionInstalada: 'v0.4.1',
  versionDisponible: 'v0.4.1',
  digestDisponible: 'sha256:a',
  migracionesPendientes: 0,
  comprobadoEn: '2026-09-22T10:00:00.000Z',
  aprobadoDigest: null,
  hayNovedad: false,
}
const CON_NOVEDAD = {
  ...AL_DIA, versionDisponible: 'v0.4.2', digestDisponible: 'sha256:b',
  migracionesPendientes: 3, hayNovedad: true,
}

describe('textoDeEstado', () => {
  it('al dia se dice, y en verde', () => {
    const r = textoDeEstado(AL_DIA)
    expect(r.tono).toBe('ok')
    expect(r.texto).toContain('v0.4.1')
  })

  it('con novedad y esperando aprobacion: avisa y NOMBRA la version', () => {
    // Sin el numero de version el aviso no deja decidir nada.
    const r = textoDeEstado(CON_NOVEDAD)
    expect(r.tono).toBe('alerta')
    expect(r.texto).toContain('v0.4.2')
  })

  it('con novedad y en automatica: dice CUANDO entra, no "pronto"', () => {
    const r = textoDeEstado({ ...CON_NOVEDAD, modo: 'automatica' })
    expect(r.tono).toBe('info')
    expect(r.texto).toMatch(/madrugada/i)
  })

  it('NEGATIVO: una aprobacion CADUCA no se pinta como aprobada', () => {
    // El dueno aprobo `sha256:viejo` y desde entonces salio otra. Pintarlo como
    // "ya aprobaste, tranquilo" es la mentira exacta que el ADR 0037 existe
    // para impedir: se quedaria esperando algo que no va a pasar nunca.
    const r = textoDeEstado({ ...CON_NOVEDAD, aprobadoDigest: 'sha256:viejo' })
    expect(r.tono).toBe('alerta')
    expect(r.texto).toMatch(/mas nueva|otra version/i)
  })

  it('si nunca se ha comprobado, se dice: no se finge que esta al dia', () => {
    const r = textoDeEstado({ ...AL_DIA, comprobadoEn: null, digestDisponible: null })
    expect(r.tono).toBe('info')
    expect(r.texto).toMatch(/sin comprobar|no se ha comprobado/i)
  })
})
```

- [ ] **Paso 2 · Esqueleto que compila, y ver el rojo FUERTE**

```ts
export type TonoEstado = 'ok' | 'alerta' | 'info'

export function textoDeEstado(_e: EstadoActualizacion): { tono: TonoEstado; texto: string } {
  throw new Error('sin implementar')
}
```

Correr: `cd apps/web && npx vitest run components/demo/admin/actualizaciones-ui.test.ts`
Esperado: **5 fallos**, todos `Error: sin implementar`.

- [ ] **Paso 3 · Commitear el rojo**

```bash
git add apps/web/components/demo/admin/actualizaciones-ui.ts apps/web/components/demo/admin/actualizaciones-ui.test.ts
git commit -m "test(actualizaciones): lo que dice la pantalla, en rojo"
```

- [ ] **Paso 4 · Implementar `actualizaciones-ui.ts` y el `.tsx`**

La tarjeta usa `ConfirmDialog` para el botón de instalar: corta el servicio y
migra la base, así que no puede ser un clic suelto — es la misma razón que B32. El
texto de la confirmación dice **cuántas migraciones** trae y que habrá un corte.

- [ ] **Paso 5 · Verde**

```
cd apps/web && npm test && npm run typecheck
```

- [ ] **Paso 6 · Mirarlo en el navegador**, con novedad y sin ella. Con
      `npm run build && npm start`, no con `next dev` — la CSP sin `unsafe-eval`
      deja el botón de login muerto sin dar ningún error (está en `CLAUDE.md`).

- [ ] **Paso 7 · Commit**, con la nota de bóveda de frontend en el mismo commit.

---

## Tarea 5 · `update.sh --comprobar`

**Depende de:** tareas 1, 2 y 3.

**Es la zona más delicada del plan.** `update.sh` tiene siete códigos de salida
cuya distinción es deliberada, y un `set -e` que los aplanara sería el error que
ese script no puede cometer. **No se toca esa parte.**

**Archivos:**
- Modificar: `infra/scripts/update.sh` (parseo en `:412-415`; sonda nueva junto a
  `guion_huella` en `:1775`; decisión antes del bloque de `:1737`)
- Modificar: `Dockerfile:106`

- [ ] **Paso 1 · La lista blanca del Dockerfile**

`Dockerfile:106` copia scripts **por lista blanca de un solo archivo**. Sin esta
línea, `actualizaciones.mjs` no viaja en la imagen y la sonda no lo encuentra:

```dockerfile
COPY --chown=node:node scripts/actualizaciones.mjs ./scripts/actualizaciones.mjs
```

- [ ] **Paso 2 · La sonda, con el patrón que ya existe**

Se copia la forma de `guion_huella()` / `huella_base()`
(`infra/scripts/update.sh:1775-1852`): el guion va **por STDIN** —así no hay
comillas que escapar ni rutas del anfitrión que existan dentro del contenedor— y
se corre con el `node` y el `pg` de la **misma imagen**, por la misma red y con la
misma `DATABASE_URL` que el runner. Imprime **una sola línea con marca**:

```
ESTADO <modo> <digest_instalado> <aprobado_digest>
```

Los nulos viajan como `-`, y no como cadena vacía: con campos separados por
espacios, un vacío **corre los de la derecha** y un `awk '{print $3}'` devolvería
el campo equivocado sin dar error. Quien lea la línea traduce `-` a nulo.

Y una segunda función que **escribe** lo disponible (`version_disponible`,
`digest_disponible`, `migraciones_pendientes`, `comprobado_en`).

**Que la tabla no exista NO es un error, es un dato** — igual que
`schema_migrations` en la sonda de huella. Una instancia con una imagen anterior
a esta migración no tiene la tabla: en ese caso el comportamiento es **el de hoy**
(actualizar), y se registra en el log. Si no, esta tarea dejaría media flota
parada al desplegarse.

- [ ] **Paso 3 · Enganchar la decisión**

Tras calcular `DIGEST_NUEVO` y antes de respaldar y migrar, se llama a
`decidirActualizacion` con `corrida=comprobar` o `corrida=programada` según la
bandera. Si `actualizar` es falso: se registra el `motivo` y se sale con **`EX_OK`
(0)** — esperar aprobación no es un error y el cron no debe alarmarse. Al
actualizar de verdad, se limpia `aprobado_digest` y se escriben
`version_instalada` y `digest_instalado`.

- [ ] **Paso 4 · Casos nuevos en `pruebas-update.sh`**

El arnés ya sabe contar llamadas a `pg_dump`, al runner y a `docker run` (E33/E34).
Los casos:

| | Qué se afirma |
|---|---|
| `--comprobar` con `modo=aprobacion` y sin aprobación | **ni pg_dump, ni runner, ni docker run**, y salida 0 |
| `--comprobar` con aprobación que cuadra | actualiza, y `aprobado_digest` queda vacío |
| `--comprobar` con aprobación caduca | no actualiza, salida 0 |
| `--comprobar` con `modo=automatica` | **no** actualiza |
| corrida programada con `modo=automatica` | actualiza, como hoy |
| tabla inexistente | actualiza, como hoy, y lo dice en el log |

- [ ] **Paso 5** Correr `infra/scripts/pruebas-update.sh` entero y commitear.

---

## Tarea 6 · El cron

**Depende de:** tarea 5.

**Archivos:**
- Modificar: `infra/scripts/instalar-hijo.sh:867`
- Modificar: `infra/scripts/provision-instancia.sh:834`

La línea de hoy es **la misma en los dos archivos**, y eso importa: si se cambia
uno y no el otro, una instancia recién aprovisionada y una reinstalada se
comportarían distinto, sin que nada diera error. Se añade **junto a** la que ya
existe, no en su lugar:

```cron
*/15 * * * * root /opt/space-os/update.sh --comprobar >> /var/log/space-os/cron.log 2>&1
17 4   * * * root /opt/space-os/update.sh            >> /var/log/space-os/cron.log 2>&1
```

- [ ] **Paso 1 · Escribir la prueba, que falle**

En `infra/scripts/pruebas-instalar-hijo.sh`:

```bash
# Las DOS entradas tienen que quedar escritas, y la frecuente tiene que llevar
# --comprobar: sin la bandera seria una actualizacion completa cada 15 minutos,
# o sea un corte de servicio a cualquier hora del dia laboral.
grep -q -- '--comprobar' "$CRON_ESCRITO"   || fallar "falta la entrada de cron frecuente con --comprobar"
grep -qE '^17 4 ' "$CRON_ESCRITO"   || fallar "se perdio la entrada de las 04:17"

# Y la MISMA linea en los dos guiones. Si divergen, una instancia recien
# aprovisionada y una reinstalada se comportan distinto y nada da error.
linea_a="$(grep -- '--comprobar' infra/scripts/instalar-hijo.sh | tr -d '[:space:]')"
linea_b="$(grep -- '--comprobar' infra/scripts/provision-instancia.sh | tr -d '[:space:]')"
[ "$linea_a" = "$linea_b" ]   || fallar "instalar-hijo.sh y provision-instancia.sh escriben crones distintos"
```

- [ ] **Paso 2 · Ver el rojo**

Correr: `bash infra/scripts/pruebas-instalar-hijo.sh`
Esperado: FALLA con «falta la entrada de cron frecuente con --comprobar».

- [ ] **Paso 3 · Implementar** — la línea nueva **junto a** la que ya existe, en
      los dos archivos, idéntica en ambos.

- [ ] **Paso 4 · Verde y commit**

```bash
bash infra/scripts/pruebas-instalar-hijo.sh
git add infra/scripts/
git commit -m "feat(actualizaciones): cron frecuente que comprueba, sin tocar el de madrugada"
```

---

## Tarea 7 · Bóveda, bitácora y la tarjeta humana

**Depende de:** todas.

- [ ] **Paso 1 · Nota de bóveda nueva**: `vault/02-Backend/actualizaciones-instancia.md`,
      con su frontmatter (`tipo`, `estado`, `actualizado`, `archivos`) y enlazada
      desde `vault/00-Indice/MOC-Proyecto.md` y `vault/01-Arquitectura/entorno-y-despliegue.md`.
      Sin esto la nota nace huérfana.

- [ ] **Paso 2 · Entrada en `docs/Registro_Cambios.md`**, en lenguaje llano: el
      dueño puede elegir si instala las versiones nuevas, dónde se elige, y que por
      omisión se espera su aprobación.

- [ ] **Paso 3 · La tarjeta humana** — `docs/evidencias/tarjeta-actualizaciones-elegidas.md`.
      **Es la parte que no puedo ejecutar yo** y sin ella el despliegue rompe algo:

  1. **Fijar el modo en las instancias que YA existen (DEMO y g500).** La tabla
     nace en `aprobacion` y la migración **no puede distinguir** una instalación
     nueva de una que lleva meses corriendo. Si nadie las toca, **se congelan en
     silencio**. Para cada una, decidir a conciencia y escribirlo:
     ```sql
     update actualizaciones_instancia set modo = 'automatica';
     ```
  2. **Instalar la entrada de cron nueva** en las instancias ya aprovisionadas —
     los guiones solo la ponen en instalaciones nuevas.
  3. **Comprobar el recorrido entero en DEMO antes que en ninguna otra**, que es
     el invariante 13: publicar una versión, ver que la pantalla la anuncia,
     aprobarla, y que entra en el siguiente cuarto de hora.

- [ ] **Paso 4 · Liberar la zona** en `vault/07-Agentes/tablero.md` y commitear.

---

## Lo que este plan NO hace

- **No resuelve el parche de seguridad obligatorio.** La columna `obligatoria`
  nace sin escritor, a propósito. Si esa política existirá y quién la decide es de
  negocio, y el ADR 0037 la deja abierta.
- **No toca `instancia.env` ni `CANAL`.** Un dueño elige *cuándo* toma lo que hay
  en su canal, no *qué canal* sigue. El invariante 13 sigue en pie.
- **No ejecuta nada contra un droplet.** Todo lo que toque un servidor está en la
  tarjeta de la tarea 7.
- **No toca el panel de flota**, y el ADR 0037 deja dicho por qué habrá que
  hacerlo: a partir de aquí habrá instancias **desactualizadas a propósito**, y el
  panel tiene que poder distinguir eso de un fallo. Vive en `apps/flota`, fuera del
  artefacto, así que es **otro plan** — y uno que no se puede escribir bien hasta
  que éste exista y haya algo real que enseñar.

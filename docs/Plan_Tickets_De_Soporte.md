# Plan de implementación — Tickets de soporte (ADR 0038)

> **Para agentes:** este plan se ejecuta tarea por tarea. **TDD literal**: primero
> la prueba en rojo y a la vista, en su propio paso; la implementación va después.
> **Una tarea = un commit.**

**Objetivo:** que el dueño de una instancia escriba una incidencia desde su
aplicación y AS OOH la vea en el PADRE, agrupada por instancia, en una pantalla
hermana de `/flota/`.

**Arquitectura:** el ticket se guarda en la base de la instancia (tabla `tickets`,
con `tenant_id` y RLS). El panel del PADRE lo **jala** por `/api/tickets`, colgado
del mismo `FLOTA_TOKEN` que ya protege `/api/version`, y responde por `PATCH` por
el mismo canal. No hay credencial de salida, ni cola, ni dirección nueva de red.

**Spec:** `docs/adr/0038-los-tickets-de-soporte-viven-en-la-instancia.md`

**Rama:** `feat/tickets-de-soporte`, salida de `main` (`c56c89f`).

---

## Restricciones globales

Aplican a **todas** las tareas. No se repiten en cada una.

1. **Todo en español**: archivos, funciones, variables, columnas, comentarios y
   mensajes de error. Excepciones solo del framework (`route.ts`, `page.tsx`).
2. **Capas fijas**: `route.ts` → `tickets-controller.ts` → `tickets-repo.ts` →
   `db.ts`. **El SQL vive en el repo, nunca en el route**, y siempre parametrizado.
3. **Toda operación por `id` lleva `and tenant_id = $n`** como segunda capa sobre
   la RLS. Sin excepción en el lado del cliente.
4. **`apps/web/app/api/version/route.ts` NO se toca.** Su prueba afirma las claves
   exactas a propósito.
5. **`apps/web/lib/test/aislamiento.e2e.test.ts` NO se toca** (invariante 7). Si
   una tarea obliga a abrirlo, esa tarea está mal: se para y se dice.
6. **`db/schema.sql` NO se toca.** El cambio va por migración. `recrearEsquema()`
   corre `schema.sql` y **después** las migraciones (`db-e2e.ts:140`), así que la
   tabla nueva existe en e2e sin tocar el esquema.
7. **`infra/scripts/update.sh` NO entra en este trabajo.**
8. **Commits en español y sin acentos**, `tipo(ambito): descripcion en minuscula`.
9. **Esto es ROJO** (toca tenant y migración). Las e2e son obligatorias antes del
   merge, y **exigen un build hecho antes**:
   `cd apps/web && npm run build && npm run test:e2e`.
10. **Ningún valor real quemado**: ni dominios, ni IPs, ni tokens.

---

## Estructura de archivos

| Archivo | Qué |
|---|---|
| `db/migrations/20260922_tickets.sql` | **crear** — enum, tabla, RLS, índices |
| `apps/web/lib/server/folios.ts` | **modificar** — añadir `'ticket'` a `AmbitoFolio` |
| `apps/web/lib/server/tickets-repo.ts` | **crear** — el SQL, los dos lados separados |
| `apps/web/lib/server/tickets-controller.ts` | **crear** — validación y reglas |
| `apps/web/app/api/tickets/route.ts` | **crear** — GET/POST/PATCH |
| `apps/web/components/demo/admin/tickets-ui.ts` | **crear** — lógica pura de pantalla |
| `apps/flota/tickets.mjs` | **crear** — agrupación por instancia, pura |
| `apps/flota/servidor.mjs` | **modificar** — ruta `/flota/tickets` |
| `vault/02-Backend/api-endpoints.md`, `vault/04-Datos/esquema.md` | **modificar** |
| `docs/Registro_Cambios.md` | **modificar** |

---

## Tarea 1 · La migración

**Archivos:**
- Crear: `db/migrations/20260922_tickets.sql`
- Prueba: `apps/web/lib/server/tickets.e2e.test.ts` (nuevo)

**Produce:** tabla `tickets` con las columnas que consumen las tareas 2 a 8.

- [ ] **Paso 1 · La prueba en rojo**

En `apps/web/lib/server/tickets.e2e.test.ts`. Afirma lo que la migración debe
dejar hecho, no que el archivo exista:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { recrearEsquema, poolTest } from '@/lib/test/db-e2e'

describe('tabla tickets', () => {
  beforeAll(async () => { await recrearEsquema() })

  it('existe, tiene tenant_id y RLS encendida', async () => {
    const p = poolTest()
    const { rows } = await p.query(
      `select relrowsecurity from pg_class where relname = 'tickets'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })

  it('tiene la politica tenant_isolation', async () => {
    const p = poolTest()
    const { rows } = await p.query(
      `select policyname from pg_policies where tablename = 'tickets'`,
    )
    expect(rows.map((r) => r.policyname)).toContain('tenant_isolation')
  })
})
```

- [ ] **Paso 2 · Verla fallar**

`cd apps/web && npx vitest run lib/server/tickets.e2e.test.ts`
Esperado: **FALLA** con `expect(received).toHaveLength(1)` — la tabla no existe.

- [ ] **Paso 3 · La migración**

```sql
-- @tipo: esquema
-- Tickets de soporte (ADR 0038). El cliente los escribe desde su instancia y el
-- panel del PADRE los jala por /api/tickets.
--
-- Lleva tenant_id y RLS como cualquier tabla de negocio: el dato es del owner.
-- La ruta del panel lo atraviesa a proposito y con qRaw, y eso esta documentado
-- en tickets-repo.ts y probado en pareja (aisla el cliente / atraviesa el panel).
begin;

do $$ begin
  create type est_ticket as enum ('ABIERTO','EN_PROCESO','RESUELTO','CERRADO');
exception when duplicate_object then null; end $$;

create table if not exists tickets (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  folio                 text not null,
  asunto                text not null,
  cuerpo                text not null,
  estado                est_ticket not null default 'ABIERTO',
  prioridad             prioridad  not null default 'NORMAL',
  creado_por_usuario    uuid references usuarios(id) on delete set null,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  respuesta             text,
  respondido_en         timestamptz
);

create unique index if not exists idx_tickets_folio    on tickets (folio);
create index        if not exists idx_tickets_tenant   on tickets (tenant_id);
create index        if not exists idx_tickets_estado   on tickets (estado);

alter table tickets enable row level security;

drop policy if exists tenant_isolation on tickets;
create policy tenant_isolation on tickets for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid
         or nullif(current_setting('app.tenant_id', true),'') is null)
  with check (true);

commit;
```

> **Por qué la política copia la de `schema.sql:636` y no la de `config_negocio`:**
> la del bloque general permite leer sin tenant fijado (`app.tenant_id` vacío), que
> es exactamente lo que la ruta del panel necesita. La de `config_negocio` lo
> prohíbe. Copiar la equivocada dejaría al panel sin poder leer nada **y sin dar
> error**, que es el modo de fallo R2 de manual.

- [ ] **Paso 4 · Verla pasar**

`cd apps/web && npx vitest run lib/server/tickets.e2e.test.ts` → **PASA**.

- [ ] **Paso 5 · Comprobar el orden y aplicarla en el 5433**

```
node scripts/migrar.mjs --pendientes
node scripts/migrar.mjs
node scripts/migrar.mjs        # segunda vez: tiene que decir "sin cambios"
```

Esperado: la primera lista `20260922_tickets.sql`; la segunda la aplica; la
tercera **no vuelve a aplicarla** (idempotencia).

- [ ] **Paso 6 · Commit**

```
feat(tickets): la tabla de tickets de soporte, con tenant_id y RLS
```

---

## Tarea 2 · El folio

**Archivos:**
- Modificar: `apps/web/lib/server/folios.ts`
- Prueba: `apps/web/lib/server/folios.test.ts`

**Consume:** nada. **Produce:** `siguienteConsecutivo({ ambito: 'ticket', periodo: 'anio' })`.

- [ ] **Paso 1 · La prueba en rojo**

Añadir a `folios.test.ts`:

```ts
it('acuña folios de ticket por año', async () => {
  const { n, periodo } = await siguienteConsecutivo({
    ambito: 'ticket', periodo: 'anio', ahora: new Date('2026-09-22T10:00:00Z'),
  })
  expect(periodo).toBe('2026')
  expect(n).toBeGreaterThan(0)
})
```

- [ ] **Paso 2 · Verla fallar** — `npx vitest run lib/server/folios.test.ts`.
  Esperado: error de tipos en `'ticket'`, que no está en `AmbitoFolio`.

- [ ] **Paso 3 · Una línea**

```ts
export type AmbitoFolio = 'campana' | 'propuesta' | 'ot' | 'oc' | 'oi' | 'ticket'
```

> El contador es **global, no por tenant**, y aquí eso es lo correcto: el índice
> único de `tickets.folio` también es global. La cabecera de `folios.ts` ya explica
> por qué, y este ámbito no es la excepción.

- [ ] **Paso 4 · Verla pasar.**
- [ ] **Paso 5 · Commit** — `feat(tickets): el ambito de folio para los tickets`

---

## Tarea 3 · El repo

**Archivos:**
- Crear: `apps/web/lib/server/tickets-repo.ts`
- Prueba: `apps/web/lib/server/tickets-repo.test.ts`

**Consume:** la tabla de T1, el folio de T2.
**Produce:** `listarTicketsDelTenant()`, `crearTicket()`, `listarTicketsDeLaInstancia()`, `responderTicket()`.

- [ ] **Paso 1 · La prueba en rojo**

Con el doble de consultas que ya usan los demás `*-repo.test.ts` de este
directorio (seguir el patrón de `actualizaciones-repo.test.ts`). Lo que hay que
afirmar, y son cuatro cosas distintas:

```ts
it('el lado del cliente usa q (con tenant), no qRaw', async () => { /* … */ })
it('toda lectura por id lleva "and tenant_id = $n"', async () => { /* … */ })
it('el lado del panel usa qRaw a proposito y NO filtra por tenant', async () => { /* … */ })
it('el lado del panel NO selecciona tenants.nombre', async () => { /* … */ })
```

La cuarta es la que sostiene el punto 4 del ADR: si alguien añade un `join tenants`
para «mejorar la pantalla», esta prueba se pone roja.

- [ ] **Paso 2 · Verla fallar** — el módulo no existe.

- [ ] **Paso 3 · Implementar**

Cabecera obligatoria del archivo, explicando **por qué** hay dos estilos:

```ts
import 'server-only'
import { q, q1, qRaw } from './db'

// ============================================================================
//  lib/server/tickets-repo.ts — ADR 0038.
// ----------------------------------------------------------------------------
//  ESTE ARCHIVO USA LOS DOS ESTILOS A PROPOSITO, Y ESO NO ES UN DESCUIDO:
//
//   · Lo que pide el CLIENTE va por `q`/`q1` (fija `app.tenant_id`) y ademas
//     lleva `and tenant_id = $n`. Doble capa, como todo el resto del producto.
//
//   · Lo que pide el PANEL va por `qRaw` y NO filtra por tenant: el panel es
//     AS OOH preguntando por la instancia entera. Es la zona roja R2, cuyo modo
//     de fallo es SILENCIOSO, asi que va probado EN PAREJA — que el lado del
//     cliente aisla y que el del panel atraviesa. Una sola de las dos pruebas
//     no demuestra nada: un guard roto pasaria la primera.
//
//  Y el lado del panel NO selecciona `tenants.nombre` (ADR 0038 §4): viaja el
//  uuid opaco para poder agrupar sin aprender de quien es.
// ============================================================================
```

- [ ] **Paso 4 · Verla pasar.**
- [ ] **Paso 5 · Commit** — `feat(tickets): el repo, con los dos lados separados y explicados`

---

## Tarea 4 · El controlador

**Archivos:**
- Crear: `apps/web/lib/server/tickets-controller.ts`
- Prueba: `apps/web/lib/server/tickets-controller.test.ts`

**Consume:** el repo de T3. **Produce:** `crearTicketCtrl()`, `responderTicketCtrl()`.

- [ ] **Paso 1 · La prueba en rojo** — los casos negativos son el corazón:

```ts
it('rechaza asunto vacio', …)
it('rechaza cuerpo de mas de 4000 caracteres', …)
it('rechaza un estado que no esta en el enum', …)
it('recorta espacios del asunto antes de guardar', …)
it('al responder, fija respondido_en', …)
```

- [ ] **Paso 2 · Verla fallar.**
- [ ] **Paso 3 · Implementar** con `zod` y `.strict()`, como el PATCH del ADR 0037:
  un campo de más da **400**, no lo descubre Postgres.
- [ ] **Paso 4 · Verla pasar.**
- [ ] **Paso 5 · Commit** — `feat(tickets): el controlador y su validacion estricta`

---

## Tarea 5 · La ruta del cliente

**Archivos:**
- Crear: `apps/web/app/api/tickets/route.ts` (solo `GET` con sesión y `POST`)
- Prueba: añadir a `apps/web/lib/server/tickets.e2e.test.ts`

**Consume:** T3 y T4.

- [ ] **Paso 1 · La prueba en rojo, y es de aislamiento**

Con el `Cliente` de `@/lib/test/servidor-e2e` y `comoTenant()` de
`@/lib/test/db-e2e` para sembrar. **Estos son los ayudantes reales del repo —
comprobados el 22/09— y no hay otros: no inventes `comoDueno()`, `sembrar…()` ni
`fallar()`.** Los exports que existen son `poolTest`, `poolApp`, `recrearEsquema`,
`comoTenant`, `cerrarPool`, `Cliente`, `arrancarServidor` y `pararServidor`.

Dos organizaciones, un ticket en cada una:

```ts
it('un tenant NO ve los tickets del otro', async () => { /* 200 y solo los suyos */ })
it('sin sesion da 401', async () => { /* … */ })
it('sin permiso de administracion da 403', async () => { /* … */ })
```

- [ ] **Paso 2 · Verla fallar** — la ruta no existe (404).
- [ ] **Paso 3 · Implementar**, con `exigir('administracion', 'ver')` para el GET y
  `exigir('administracion', 'crear')` para el POST.
- [ ] **Paso 4 · Verla pasar.**
- [ ] **Paso 5 · Commit** — `feat(tickets): la ruta del cliente, con su prueba de aislamiento`

---

## Tarea 6 · La ruta del panel

**Archivos:**
- Modificar: `apps/web/app/api/tickets/route.ts`
- Prueba: añadir a `apps/web/lib/server/tickets.e2e.test.ts`

**Consume:** T5. **Produce:** el contrato que consume `apps/flota` en T8.

> **Esta es la tarea peligrosa del plan.** Aquí es donde un guard mal puesto abre
> los tickets de todas las organizaciones a cualquiera con sesión.

- [ ] **Paso 1 · Las pruebas en rojo — las cuatro, y ninguna sobra**

```ts
it('con x-flota-token correcto, devuelve tickets de TODOS los tenants', …)
it('con x-flota-token incorrecto, NO devuelve nada de otro tenant', …)
it('sin FLOTA_TOKEN configurado, el token no abre nada', …)   // ausente = cerrado
it('la respuesta del panel no trae el nombre de ninguna organizacion', …)
```

- [ ] **Paso 2 · Verlas fallar.**
- [ ] **Paso 3 · Implementar**, reusando **la misma función** `tokenCoincide` /
  `esElPanel` que `version/route.ts` — extraída a un módulo compartido si hace
  falta, **nunca copiada**: dos copias de una comparación en tiempo constante
  divergen, y la que divergirá es la que nadie mira.
- [ ] **Paso 4 · Verlas pasar.**
- [ ] **Paso 5 · Commit** — `fix(tickets): la ruta del panel atraviesa tenants, y se prueba en pareja`

---

## Tarea 7 · La pantalla del cliente

**Archivos:**
- Crear: `apps/web/components/demo/admin/tickets-ui.ts` (lógica pura, con test)
- Modificar: la pantalla de Administración para colgar la sección

**Consume:** T5.

- [ ] **Paso 1 · La prueba en rojo** de `textoDeEstado()` y del orden de las ramas,
  igual que `actualizaciones-ui.ts`: primero «no hay ninguno», después «hay
  abiertos», después «todos cerrados». **El orden de las ramas es la prueba.**
- [ ] **Paso 2 · Verla fallar.**
- [ ] **Paso 3 · Implementar.**
- [ ] **Paso 4 · Verla pasar.**
- [ ] **Paso 5 · Commit** — `feat(tickets): la pantalla del cliente en administracion`

---

## Tarea 8 · La lógica pura del panel

**Archivos:**
- Crear: `apps/flota/tickets.mjs` y `apps/flota/tickets.test.ts`

**Consume:** el contrato de T6.

- [ ] **Paso 1 · La prueba en rojo.** Lo que hay que afirmar, y la tercera es la
  que el ADR exige:

```ts
it('agrupa por instancia y cuenta los abiertos', …)
it('una instancia sin tickets sale con 0', …)
it('una instancia que NO contesta sale "sin-respuesta", NUNCA como 0', …)
```

> La tercera es el punto que el ADR marca en sus consecuencias: leer un silencio
> como una buena noticia es el error que este proyecto ya ha pagado varias veces.

- [ ] **Paso 2 · Verla fallar.**
- [ ] **Paso 3 · Implementar**, sin abrir ningún puerto — como todo `apps/flota`.
- [ ] **Paso 4 · Verla pasar** — `cd apps/flota && npx vitest run tickets.test.ts`
- [ ] **Paso 5 · Commit** — `feat(flota): agrupacion de tickets por instancia`

---

## Tarea 9 · La pantalla del panel

**Archivos:**
- Modificar: `apps/flota/servidor.mjs` (ruta `/flota/tickets`)
- Prueba: `apps/flota/servidor.test.ts`

**Consume:** T8.

- [ ] **Paso 1 · La prueba en rojo** — la ruta responde, exige sesión, y escapa el
  texto del cliente con `escapar()` (`servidor.mjs:66`).

> **El texto lo escribe un tercero.** Pintarlo sin escapar es XSS en el panel de
> AS OOH, y el atacante sería un cliente. La prueba manda un asunto con `<script>`
> y afirma que sale escapado.

- [ ] **Paso 2 · Verla fallar.**
- [ ] **Paso 3 · Implementar**, reusando la sesión y el CSRF que la ruta de altas
  ya tiene.
- [ ] **Paso 4 · Verla pasar** — `cd apps/flota && npx vitest run servidor.test.ts`
- [ ] **Paso 5 · Commit** — `feat(flota): la pantalla de tickets por instancia`

---

## Tarea 10 · Bóveda y bitácora

**Archivos:**
- Modificar: `vault/02-Backend/api-endpoints.md`, `vault/04-Datos/esquema.md`,
  `vault/07-Agentes/tablero.md` (liberar las zonas)
- Modificar: `docs/Registro_Cambios.md`

- [ ] **Paso 1 · Medir, no copiar**

```
node scripts/recuentos.mjs
```

Y poner **las cifras que imprima**, no las que diga cualquier documento. Este
repositorio ha tenido las mismas seis cifras mal tres veces.

- [ ] **Paso 2 · Escribir la entrada de la bitácora en lenguaje llano** — se nota
  desde la aplicación, así que le toca.
- [ ] **Paso 3 · Liberar Z2, Z9, Z12 y `apps/flota` en el tablero.**
- [ ] **Paso 4 · Commit** — `docs(tickets): boveda, bitacora y liberacion de zonas`

---

## Antes de pedir el merge

- [ ] `cd apps/web && npm run typecheck` limpio
- [ ] `cd apps/web && npm test` en verde
- [ ] `cd apps/web && npm run build && npm run test:e2e` en verde — **obligatorio**,
      esto es ROJO
- [ ] `cd apps/flota && npm test` en verde
- [ ] `git diff main --stat` no toca `version/route.ts`, `aislamiento.e2e.test.ts`,
      `servidor-e2e.ts`, `db/schema.sql` ni `update.sh`
- [ ] Ningún secreto en el diff

## Lo que este plan NO hace, y hay que decirlo al entregar

- **Nada de esto llega a una instancia hasta que haya una versión publicada y
  promovida a `estable`.** g500 sigue en `v0.5.1` con el `update.sh` del 9 de
  septiembre.
- **Nadie se entera de un ticket nuevo** si no abre la pantalla. El ADR lo deja
  fuera a propósito.

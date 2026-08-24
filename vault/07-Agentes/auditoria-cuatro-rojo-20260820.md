---
tipo: auditoria
estado: verificado
actualizado: 2026-08-24
tags: [agentes, auditoria, rojo, instancias, rol-app, credenciales, merge]
archivos:
  - scripts/migrar.mjs
  - db/migrations/20260820_grants_rol_app.sql
  - infra/scripts/update.sh
---

# Auditoría — los cuatro ROJO del 2026-08-20

> **Veredicto: 🟡 AMARILLO.** Los cuatro están bien hechos y hacen lo que dicen.
> Hay **un hallazgo que conviene cerrar antes del merge** (H1) y **dos menores**
> que pueden ir después. Ninguno invalida el trabajo.

**Quién audita:** sesión del 2026-08-24, distinta de la que escribió los cuatro
commits (`session_01Ff33PCRwFNbtSmyf1JUBMD`). El modelo exige que el remediador
no se autoconfirme, y aquí se cumple.

---

## 1 · Qué se auditó, y por qué no fueron los cuatro commits sueltos

| Commit | Qué es | Estado real hoy |
|---|---|---|
| `61f2668` | El candado del rol en el runner | Vigente |
| `3561bf9` | La migración de GRANT sin lista blanca | Vigente, **reescrita** por `551f6c1` |
| `551f6c1` | El nombre del rol se declara (P9) | ⚠️ **Revertido en parte por `f180a75`**: `ROL_APP` se retiró |
| `8f81c3e` | La poda del `=` percent-encoded | ⚠️ **Superado por `3872d61`**: la poda pasó a lista BLANCA |

**Se auditó el estado en `HEAD`, no los commits aislados**, y es lo correcto: dos
de los cuatro ya fueron reescritos por commits posteriores, así que lo que
entraría en un merge es el resultado, no el paso intermedio. Auditar `551f6c1`
tal cual habría sido auditar una perilla que ya no existe.

---

## 2 · Hallazgos

### 🟡 H1 · `alter default privileges` está atado al rol que aplicó la migración

**`db/migrations/20260820_grants_rol_app.sql:87-88`** · severidad **media** ·
categoría: permisos que fallan en silencio.

Las dos líneas de `alter default privileges in schema public grant … to %I` se
escriben **sin `for role`**. En PostgreSQL, omitirlo significa *«para los objetos
que cree el rol actual»* — los privilegios por omisión se guardan por la pareja
(rol propietario, esquema), no globalmente.

**Escenario de fallo concreto:** una instancia aplica su cadena de migraciones
conectada como `postgres`, y meses después alguien aplica una migración nueva con
un `DATABASE_URL` que usa otro superusuario (o `deploy.yml`, que corre
`sudo -u postgres psql`, se sustituye por el runner con otra conexión). Esa
migración crea una tabla. La tabla **nace sin GRANT para `spaces_app`**, la
aplicación empieza a dar `permission denied` sobre ella, y **ni la migración ni
el runner dan error**: es exactamente el modo de fallo que esta migración existe
para cerrar.

**Lo que lo hace un hallazgo y no una nota:** el comentario de `:85-86` afirma
*«Y las que se creen DESPUÉS. Sin esto el arreglo dura una versión»*. La promesa
es más ancha que lo que el código garantiza, y en este repositorio los
comentarios se leen como contrato.

**Corrección sugerida**, cualquiera de las dos:

```sql
-- (a) fijar el propietario explicitamente
execute format('alter default privileges for role %I in schema public grant … to %I', propietario, r);
```

o **(b)** dejar el `for role` fuera y escribir en el comentario la condición que
lo sostiene: *«vale mientras las migraciones las aplique siempre el mismo rol»*,
y añadirlo al runbook de aprovisionamiento.

> Se prefiere (b) si nadie quiere abrir una migración: es barato, es cierto, y
> deja el límite escrito donde se lee.

### 🔵 H2 · El rol de la app recibe DML sobre `schema_migrations`

**`:83`** · severidad **baja** · categoría: menor privilegio.

`grant select, insert, update, delete on all tables in schema public` incluye
`schema_migrations`, que es **deliberadamente ajena a la RLS**
(`20260812_schema_migrations.sql`, exenta como `folios_consecutivos`).

**Escenario:** un fallo de la aplicación —o una inyección— que llegue a borrar
filas de `schema_migrations` dejaría al runner creyendo que faltan migraciones ya
aplicadas. No hay hoy ningún camino conocido que lo haga, y por eso es baja.

Antes de esta migración el rol tenía DML sobre **seis** tablas
(`arr_m6:40-41`). El ensanchamiento es deliberado y está escrito; lo que no está
escrito es que se lleva por delante el registro de migraciones.

### 🔵 H3 · Un aviso obsoleto en el mensaje del runner — **fuera del alcance auditado**

**`scripts/migrar.mjs:447`** dice *«Ojo: la base "spaces" del 5433 tiene datos
reales»*. Eso **se corrigió el 2026-08-19**: las tres bases —el 5433, la de
integración y `spaces_prod` en el droplet— son **datos de prueba**. El mensaje
viene de F3.2 (17/08), o sea de antes de la corrección, y **no pertenece a
ninguno de los cuatro ROJO**. Se anota porque es el texto que lee el operador
justo antes de decidir contra qué base corre.

---

## 3 · Lo que se revisó y está bien

**`61f2668` — el candado del rol.** Correcto en las tres cosas que importan:

- **Está en el sitio bueno.** `migrar.mjs:449-456`, antes de cualquier lectura de
  estado y mucho antes del primer DDL. Si el rol falta, ninguna decisión
  posterior importa.
- **Falla cerrado y con el código bueno**: salida **1** («no se puede ni
  empezar»), no 2 ni 3.
- **La consulta va parametrizada** (`= any($1::text[])`), no interpolada.
- El parámetro `roles` de `revisarRolDeAplicacion()` **es una costura legítima**,
  no una puerta trasera: `pg_roles` es del **clúster**, así que producir la
  ausencia de verdad exigiría borrar el rol que usan todas las demás suites.
  `main()` nunca le pasa argumento, y eso se lee en el propio código.

**`3561bf9` + `551f6c1` — la migración de GRANT.** Salvo H1 y H2:

- **Es idempotente de verdad**: solo `grant`, ni un `revoke`.
- **El fail-closed es el arreglo, y está bien identificado**: lo que cierra
  ROJO-3 no es el nombre del rol, es que **aborte** cuando no encuentra ninguno.
  El `raise exception` dentro del `do $$` deshace la transacción entera.
- **El ASSERT de R2 está puesto donde se colaría el fallo**: comprueba que el rol
  **no** tenga `BYPASSRLS` ni `SUPERUSER`. Una migración de GRANT es exactamente
  el sitio donde alguien «arreglaría» un `permission denied` rompiendo el
  aislamiento sin un error.
- **No crea el rol, no lo renombra y no toca contraseñas.** Correcto: crear
  credenciales es provisión de entorno, no migración — mismo criterio que
  `arr_m6:7-11`.
- Las cifras de la cabecera (**13 / 11 / 1 / 0**) se contaron y cuadran.

**`8f81c3e` → `3872d61` — la poda del separador.** El arreglo vigente es **lista
blanca sobre las piezas ya decodificadas**, y aguanta lo que tiene que aguantar:

- `%253F` **no burla el filtro**: decodifica en una sola pasada a `%3F`, que
  contiene `%`, y `%` no está en el juego permitido ni del host
  (`[A-Za-z0-9._:-]`) ni del nombre de base (`[A-Za-z0-9._-]`). Se rechaza la URL
  entera. Fail-closed, y sin lista negra que burlar.
- **El usuario no viaja al log.** `URL_USUARIO` tiene un único consumidor,
  `update.sh:935`, y va a `-U` en el `argv` de `pg_dump`. No es credencial.
- Un `@` en el usuario, un host que no parsea o una cadena `clave=valor` de
  libpq **rechazan la URL** en vez de adivinar dónde empezaba el host.

---

## 4 · Qué se recomienda hacer con esto

| | |
|---|---|
| **Para fusionar** | Cerrar **H1**, aunque sea por la vía barata (b): escribir la condición en el comentario y en el runbook. Es una promesa de más en un comentario, y aquí eso se lee como contrato |
| **Después del merge** | **H2** y **H3**, que son de higiene |
| **Lo que NO hace falta** | Volver a auditar `551f6c1` ni `8f81c3e` como commits: sus sucesores ya están revisados aquí |

## Relacionadas

[[auditoria-f3-9-y-m3]] · [[ejecucion-plan-v3]] · [[2026-08-21]] ·
[[04-Datos/migraciones]] · [[zonas-de-riesgo]]

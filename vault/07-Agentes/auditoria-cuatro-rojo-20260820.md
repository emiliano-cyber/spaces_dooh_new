---
tipo: auditoria
estado: verificado
actualizado: 2026-08-24
tags: [agentes, auditoria, rojo, instancias, rol-app, credenciales, merge]
archivos:
  - scripts/migrar.mjs
  - db/migrations/20260820_grants_rol_app.sql
  - db/migrations/20260824_grants_tablas_futuras.sql
  - apps/web/lib/test/grants-tablas-futuras.e2e.test.ts
  - infra/scripts/update.sh
---

# Auditoría — los cuatro ROJO del 2026-08-20

> **Veredicto: 🟡 AMARILLO → ✅ el bloqueo está levantado.** Los cuatro están bien
> hechos y hacen lo que dicen. **H1 se cerró el 2026-08-24** con
> `20260824_grants_tablas_futuras.sql` —migración nueva, no un arreglo de la
> aplicada: eso era R3 y habría disparado F3.3—. Quedan **H2 y H3**, los dos
> menores, que pueden ir después del merge.

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

### ✅ H1 · `alter default privileges` está atado al rol que aplicó la migración — **CERRADO el 24/08**

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

### Cómo se cerró — `20260824_grants_tablas_futuras.sql`

**Primero se midió.** El hallazgo dejó de ser un razonamiento sobre la
documentación de PostgreSQL: `grants-tablas-futuras.e2e.test.ts` crea una tabla
siendo un segundo rol después de aplicar la migración del 20/08 y comprueba que
`spaces_app` **no** la alcanza. Ese caso pasó **en rojo antes** de escribir nada,
y sigue en la suite como el que mide el defecto.

**Migración nueva, no arreglo de la vieja.** `20260820_grants_rol_app.sql` **ya
está aplicada** —el PADRE corrió la cadena entera el 21/08—, así que abrirla es
zona **R3** y además cambiaría su checksum: F3.3 detendría la actualización con
**salida 3** en toda instancia que ya la tenga. Editar un comentario habría
bastado para romperlo, porque el checksum es del archivo.

**Y lo que no se pudo prometer, no se prometió.** `alter default privileges` no
puede cubrir «cualquier rol futuro»: habría que enumerar roles que aún no
existen. Así que la garantía se movió a donde sí es verificable, y son tres cosas:

1. **Repara** — `grant on all tables` en cada pasada: una tabla huérfana no
   sobrevive a la siguiente actualización, la creara quien la creara.
2. **Asegura hacia adelante** para los roles que hoy crean tablas, **derivados de
   `pg_tables`** y no cableados — el mismo criterio que usa `migrar.mjs` con sus
   tablas testigo. Si el rol que aplica no es miembro del propietario, **anota y
   sigue** en vez de negarse: negarse dejaría sin correr la reparación, que es lo
   que de verdad arregla instancias.
3. **Aborta nombrando las tablas** si algo se queda fuera. Esto es lo que
   convierte el fallo mudo en ruidoso.

> **El límite que queda, dicho en voz alta:** una tabla creada por un rol nuevo
> **entre dos pasadas** está sin permisos hasta la siguiente. Ya no es silencioso
> —la aplicación da `permission denied` y la pasada siguiente lo repara— pero no
> es cero. Cerrarlo del todo pediría un `event trigger` sobre `ddl_command_end`,
> maquinaria que corre en **cada** DDL: no se mete a cambio de este riesgo sin
> una decisión aparte.

**Verificado:** 5 casos e2e nuevos, y la suite completa en **20 archivos · 213
pruebas · 1 saltada**, con `aislamiento.e2e.test.ts` pasando **sin tocarse**.

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
| **Para fusionar** | ✅ **Nada pendiente.** H1 quedó cerrado el 24/08 con `20260824_grants_tablas_futuras.sql`, medido en rojo primero y con la suite e2e completa en verde |
| **Después del merge** | **H2** y **H3**, que son de higiene. H2 toca las **dos** migraciones de GRANT a la vez, porque las dos conceden igual |
| **Lo que NO hace falta** | Volver a auditar `551f6c1` ni `8f81c3e` como commits: sus sucesores ya están revisados aquí |

## Relacionadas

[[auditoria-f3-9-y-m3]] · [[ejecucion-plan-v3]] · [[2026-08-21]] ·
[[04-Datos/migraciones]] · [[zonas-de-riesgo]]

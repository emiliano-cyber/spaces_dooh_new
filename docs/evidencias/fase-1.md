# Instancias Soberanas · Fase 1 — Expediente de cierre

Rama: `feat/servidor-padre-instancias` (worktree `.claude/worktrees/servidor-padre`)
Levantado el **2026-08-14** contra `bc261e0` (commit `fb09b91`).
**Revisado el 2026-08-14 contra `38ace2f`**, con la rama ya doce commits más adelante.
Ruta: `docs/evidencias/fase-1.md` — el archivo nació como
`docs/Instancias_Fase1_Expediente_Cierre.md` y se movió con `git mv` en `42c0f4e`,
para que lo lea el compilador de expedientes. Es el mismo documento, no otro.
Plan de autoridad: `docs/Plan_Instancias_Soberanas_v3.md` §FASE 1 (`:371-671`)

> [!important] Alcance: **ejecución LOCAL**. No incluye servidor. **Cierre PARCIAL.**
> Todo lo que este expediente da por probado se probó en esta máquina, contra el
> Postgres del `db/docker-compose.yml` (puerto 5433) y contra un Next levantado en
> `localhost`. **Nada se aplicó al droplet `209.97.146.136` ni a `spaces_prod`.**
> Dos tareas de la fase siguen **pendientes de una persona** y sin ellas la fase no
> está cerrada de verdad: **F1.1** (el censo real) y **F1.5** (aplicar la migración
> en producción). Ver §8, tarjetas TH-01 y TH-02.

> [!note] Qué cambió en la revisión del 14/08 (y qué no)
> Los hechos de la fase **no se movieron**: los cinco commits siguen siendo los
> mismos y con el mismo contenido, y las medidas contra el 5433 dan hoy lo mismo que
> el día que se levantó (§15). Lo que se corrigió es lo que envejece alrededor:
> **los punteros de línea a `vault/07-Agentes/ejecucion-plan-v3.md`**, que se
> desplazaron entre 40 y 120 líneas al crecer la bitácora con las Fases 0 y 2; el
> **alcance de dos afirmaciones globales** que dejaron de ser ciertas fuera de esta
> fase (las tarjetas humanas vigentes y el total de commits ROJO — §8 y §9); el
> **origen de las cifras de las suites** (§3 y §15); y **tres consecuencias
> posteriores** que caen sobre trabajo hecho aquí (§6-bis). Nada de eso altera un
> solo veredicto.

Este documento es histórico: registra lo que era cierto el 2026-08-14. La
descripción de cómo funciona el sistema hoy vive en `vault/` y caduca; esto no.

---

## 1. Qué se hizo — el cuadro de la fase

| Tarea | Tipo | Estado final | Commit | Veredicto del verificador |
|---|---|---|---|---|
| **F1.1** · Auditoría de filas mal etiquetadas | verificación | **ENSAYADA_LOCAL** → PENDIENTE_SERVIDOR | — (el ensayo no produce commit) | — |
| **T-01** · `bootstrap-auth.mjs`: conflicto y tenant | código · **fuera del plan** | COMPLETADA_LOCAL | `b976b54` | AMARILLO |
| **T-02** · `bootstrap-auth.mjs`: base por omisión | código · **fuera del plan** | COMPLETADA_LOCAL | `3ac2bba` | **VERDE** |
| **F1.2** · Migración que quita los `DEFAULT` | migración | COMPLETADA_LOCAL | `65bf9b5` | AMARILLO |
| **F1.3** · `cupoGlobalClientes()` gana la 2ª capa | código | COMPLETADA_LOCAL | `c50344a` | AMARILLO |
| **F1.4** · Una IP deja de parecer un subdominio | código | COMPLETADA_LOCAL | `3671e8a` | AMARILLO |
| **F1.5** · Aplicar la limpieza al droplet | verificación | **PENDIENTE_SERVIDOR** | — | — (la corre una persona) |

*«Veredicto del verificador» no es lo mismo que «zona de riesgo».* El veredicto dice
si la tarea se acepta; la zona de riesgo dice si el commit necesita visto bueno
humano antes del merge. **Cinco de estos commits son ROJO por zona** — ver §9.

Los commits de orquestación y bóveda de la fase van de `1ad1045` a `28c4d4a`.
Verificado con `git log --oneline 1ad1045~1..28c4d4a` el 2026-08-14: son **14
commits**, cinco de código (los de arriba), ocho de orquestación/bóveda y el de
entrada del plan.

---

## 2. Qué se creó y qué se tocó (verificado con `git show --stat`)

| Commit | Archivos | Alcance |
|---|---|---|
| `b976b54` (T-01) | `apps/web/scripts/bootstrap-auth.mjs` (+40/−…), `db/README.md`, `vault/01-Arquitectura/entorno-y-despliegue.md`, `vault/07-Agentes/tablero.md` | 4 archivos, 91 inserciones |
| `65bf9b5` (F1.2) | **`db/migrations/20260812_sin_default_tenant.sql` (nuevo, 77 líneas)**, **`apps/web/lib/test/tenant-sin-default.e2e.test.ts` (nuevo, 81 líneas)**, `vault/02-Backend/multi-tenancy-y-rls.md`, `vault/04-Datos/migraciones.md`, `tablero.md` | 5 archivos. **`db/schema.sql` NO se tocó** |
| `3ac2bba` (T-02) | `apps/web/scripts/bootstrap-auth.mjs`, `vault/01-Arquitectura/entorno-y-despliegue.md`, `tablero.md` | 3 archivos |
| `c50344a` (F1.3) | `apps/web/lib/server/campanas-repo.ts`, `apps/web/lib/server/campanas-repo.cupo-clientes.test.ts`, `vault/02-Backend/comercial-propuestas-campanas.md`, `tablero.md` | 4 archivos |
| `3671e8a` (F1.4) | **`apps/web/lib/host.ts` (nuevo, 50 líneas)**, **`apps/web/lib/host.test.ts` (nuevo, 51 líneas)**, `apps/web/middleware.ts`, y 9 notas de bóveda | 12 archivos |

Los archivos citados existen hoy en el árbol y su contenido corresponde al que
describen los commits. Comprobado archivo por archivo, no por el reporte.

---

## 3. Evidencia — F1.2, la migración (lo central de la fase)

**Qué hace** (`db/migrations/20260812_sin_default_tenant.sql`, leído hoy):

- `:20-32` **guard**: aborta nombrando cualquier tabla que tenga `tenant_id` con
  `DEFAULT` y **sin** `NOT NULL`, porque ahí el default es lo único que sostiene la
  columna.
- `:35-47` **bucle por catálogo**, no por lista copiada a mano: `pg_attrdef` ×
  `pg_attribute` × `pg_namespace`, `drop default` en cada una.
- `:50-58` **ASSERT** posterior: si queda una sola columna con default, lanza.
- `:60` `commit` — transaccional. `:67-77` el rollback de emergencia, comentado,
  con las 23 tablas nombradas y el aviso de que **reintroduce la deriva**.

**El origen del problema**, verificado en el repositorio y no de memoria:
`db/schema.sql:604-609` declara un array de **23 tablas** y `db/schema.sql:615`
ejecuta `alter table %I alter column tenant_id set default %L` sobre cada una, con
el uuid del tenant `rgb`. Conté los nombres del array: son 23 exactas.

**Prueba nueva** — `apps/web/lib/test/tenant-sin-default.e2e.test.ts`, cuatro casos
(leídos hoy, `:39-73`):

```
tenant_id sin DEFAULT
  · un insert SIN tenant_id se rechaza con 23502 en vez de nacer como rgb   (:40)
  · el mismo insert CON tenant_id explícito sigue funcionando               (:48)
  · el catálogo no devuelve ninguna columna tenant_id con DEFAULT           (:59)
  · aplicar la migración dos veces seguidas no lanza                        (:73)
```

Su cabecera (`:20-24`) documenta una decisión que merece sobrevivir: usa el **pool
admin a propósito**, porque con el pool de la aplicación un `42501` de la RLS podría
hacer pasar la prueba por el motivo equivocado. Un rechazo ahí solo puede venir del
`NOT NULL`.

**El rojo que se enseñó** (cuerpo de `65bf9b5`): no una prueba que falla por
convención, sino el fallo silencioso ocurriendo en vivo — `insert into clientes
(nombre)` sin tenant **resolvía**, la fila nacía, y nacía etiquetada como `rgb`.

**Lo que el ejecutor no podía enseñar y la auditoría sí**
(`vault/07-Agentes/ejecucion-plan-v3.md:243`, era `:179` el 14/08 antes de que la
bitácora creciera con las Fases 0 y 2): el guard **se probó haciéndolo
saltar**. Se fabricaron dos tablas con `tenant_id` con `DEFAULT` y sin `NOT NULL`, se
corrió la migración, abortó nombrando las dos y —al no llegar al `commit`— dejó el
fixture intacto. *Un guard que nunca se ha visto saltar no está probado*, y ese guard
es lo único que impedirá en F1.5 quitar un default que en producción fuera lo único
sosteniendo una columna.

### Verificación e2e de F1.2 — de dónde viene la cifra

`cd apps/web && npx vitest run --config vitest.e2e.config.ts lib/test/tenant-sin-default.e2e.test.ts && npm run test:e2e`
→ **4/4** en el archivo nuevo y **13 archivos, 140 pruebas + 1 saltada** en la suite
completa, `aislamiento.e2e.test.ts` en verde **sin haberse tocado**.

> [!warning] De qué corrida viene esa cifra, y por qué no vale como estado de hoy
> **No la corrí yo, ni al levantar este expediente ni al revisarlo.** Es la salida
> del cuerpo del commit **`65bf9b5`**, de la corrida del **2026-08-13** contra ese
> commit. No la releas como «así está la suite ahora»: es una medición fechada de un
> árbol concreto.
>
> No se re-corrió porque la suite e2e usa la única base `spaces_e2e` y el puerto
> 3311, y había otros agentes trabajando en el mismo worktree; recrearla con `drop
> schema public cascade` a media corrida ajena habría roto su trabajo.
>
> Lo que sí comprobé, las dos veces: hay **13 archivos `*.e2e.test.ts`** en
> `apps/web/lib/test/` (`ls | wc -l` → 13, el 14/08), consistente con el 12 → 13 que
> el commit declara.
>
> El proyecto retiró después los recuentos globales de pruebas de la documentación
> viva, a propósito, porque envejecen con cada tarea (`703649e`; el aviso quedó en
> `CLAUDE.md §4`). Este expediente los conserva **solo como medición fechada con su
> ancla**, que es la única forma en que un número de suite sirve dentro de un
> registro histórico.

---

## 4. Evidencia — F1.3, la segunda capa del cupo

`apps/web/lib/server/campanas-repo.ts:304-313`, leído hoy:

```ts
export async function cupoGlobalClientes(client: PoolClient): Promise<number | null> {
  const v = (
    await client.query(
      `select max_clientes_pantalla from config_negocio
        where tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid
        limit 1`,
    )
  ).rows[0]?.max_clientes_pantalla
```

Antes era un `select … limit 1` **sin `where`**. Su único llamador (`:427`, dentro de
`reservar()`) corre en una transacción que ya fijó el tenant, así que hoy lo salvaba
la RLS: el cambio cierra el agujero **antes** de necesitarlo, no después. La firma no
cambió, y por eso las tres unitarias que la llaman con un cliente falso no se
tocaron.

**Rojo previo, citado literal del cuerpo de `c50344a`:**
`expected 'select max_clientes_pantalla from config_negocio limit 1' to match /where[\s\S]*tenant_id/`.

**Lo que la auditoría añadió** (`ejecucion-plan-v3.md:226`, era `:162`): comprobó el criterio con
la RLS desactivada de facto — con un GUC ajeno, la consulta vieja devolvía **1 fila**
(fuga) y la nueva **0**.

---

## 5. Evidencia — F1.4, la IP que parecía subdominio

Lo viejo, recuperado con `git show 3671e8a^:apps/web/middleware.ts`:

```ts
function extractSubdomain(host: string): string | null {
  const hostname = host.split(':')[0]
  const parts = hostname.split('.')
  if (parts.length >= 3) return parts[0]
  return null
}
```

Con la IP del droplet, `209.97.146.136` → `'209'`. Lo nuevo vive en
`apps/web/lib/host.ts:22-49` (`etiquetaDeHost`), módulo puro, y descarta IPv6 entre
corchetes (`:32`), IPv6 sin corchetes (`:36`), hosts de menos de tres etiquetas
(`:43`), etiquetas vacías (`:44`) y primeras etiquetas solo numéricas (`:47`).
`middleware.ts:3` la importa y `:75-79` es el único uso; `extractSubdomain` ya no
existe en el archivo.

La auditoría (`ejecucion-plan-v3.md:232`, era `:168`) no se fio de las pruebas: compiló `host.ts`
con `tsc`, levantó `next start` en el **3312**, mandó encabezados `Host` a mano y
comprobó que el bundle `middleware.js` correspondía al código (sin `parts.length`,
con la guarda IPv6 nueva) en lugar de fiarse de la marca de tiempo.

---

## 6. Evidencia — T-01 y T-02, las dos tareas que el plan no tenía

**Esto es el relato central de la fase, y no está en ningún plan.**

F1.2 se detuvo **antes de escribir una línea**. Su apartado «Riesgo y vuelta atrás»
manda repetir un `rg` sobre los inserts de `apps/web` antes de aplicar. El ejecutor
lo corrió y encontró uno que no nombra `tenant_id`. El plan afirma lo contrario, en
letra negrita:

> `docs/Plan_Instancias_Soberanas_v3.md:551-552` — «Cualquier ruta que hoy inserte
> sin fijar tenant dejará de funcionar … Comprobado que **no hay ninguna**».

La hay: **`apps/web/scripts/bootstrap-auth.mjs`**. Y al ir a arreglarlo apareció que
el diagnóstico de partida también era falso.

### Lo que se creía y lo que era

| Se creía | Era |
|---|---|
| «El script hoy funciona gracias al `DEFAULT`; tras F1.2 empezaría a fallar» | **Ya estaba roto, y en cualquier base.** Fallaba SIEMPRE con `42P10`: usaba `on conflict (email)` y la unicidad de correo es un índice **funcional** sobre `lower(email)` (`db/schema.sql:72`), que Postgres no infiere. Llevaba roto desde que el correo se hizo insensible a mayúsculas, y nadie lo sabía porque nadie volvió a correrlo |
| La premisa venía de un reporte que **lo dedujo sin ejecutarlo** | El ejecutor lo corrió contra una base desechable. Aislada la primera causa, aparece la segunda: el `23502` por `tenant_id` (`ejecucion-plan-v3.md:237`, era `:173`) |

El estado actual del script, leído hoy: `bootstrap-auth.mjs:96-100` inserta con
`tenant_id` resuelto **por slug** (`select t.id … from tenants t where t.slug = $6`),
nunca por uuid, y el conflicto va `on conflict (lower(email))`.

**Decisión T-01b, 2026-08-13:** si el tenant no existe, el script **aborta con salida
1** (`:107-113`). No es adorno: con esa forma de insert, sin la fila de `tenants` la
consulta afecta 0 filas y **termina con éxito sin crear nada** — el no-op silencioso
de R2, el mismo modo de fallo que dejó el desbloqueo de usuarios inservible un
despliegue entero. La auditoría midió el razonamiento en vez de creerlo: con `do
update` el conflicto devuelve `rowCount` 1 y con `do nothing` devuelve 0, así que un
0 solo puede venir del tenant ausente (`ejecucion-plan-v3.md:239`, era `:175`).

### T-02 — el destino por omisión

`bootstrap-auth.mjs:9-10` tomaba por omisión
`postgresql://spaces:spaces@localhost:5433/spaces`: **la base de desarrollo con datos
reales**, con un rol superusuario y `rolbypassrls` que además se salta la RLS `FORCE`
que `20260720_hard1_usuarios_rls.sql` puso sobre `usuarios`.

Ese destino era **inerte mientras el script moría con 42P10**. T-01 lo arregló y con
eso **activó el peligro**: un `node scripts/bootstrap-auth.mjs` sin variables ya
sembraba credenciales en una base que nadie eligió. Esa cadena —un arreglo correcto
que vuelve alcanzable un riesgo dormido— es la razón de que T-02 exista.

Hoy (`bootstrap-auth.mjs:10-34`) `DATABASE_URL` es **obligatoria**: sin ella el
script aborta con salida 1 y un mensaje con ejemplo en bash y en PowerShell,
incluyendo el aviso «Ojo: la base "spaces" del 5433 tiene datos reales».

Dos cosas que solo aparecieron por auditar y merecen quedar:

- **El rojo de T-02 se demostró SIN ejecutar el script** (habría escrito en `spaces`):
  se extrajo la declaración del fuente y se evaluó con `DATABASE_URL` sin definir.
- **El script no carga dotenv** (`ejecucion-plan-v3.md:248`, era `:184`). `apps/web/.env.local`
  sí define `DATABASE_URL`, y aun así la corrida con la variable desactivada aborta:
  el fail-closed **no tiene la puerta trasera** de heredar un destino de un `.env`
  que el operador no leyó.
- Se descartó una **lista negra** de nombres de base con el argumento decisivo: una
  lista negra es *fail-open* — protege el único nombre conocido hoy, y bajo el modelo
  de instancias soberanas **cada instancia tiene su propia base con datos reales y
  nombre propio**. Exigir explicitud es *fail-closed*.

**Contrato nuevo que heredan las Fases 2 y 3** (`ejecucion-plan-v3.md:249`, era `:185`): cuando
se escriba el aprovisionamiento de una instancia, el paso que siembre su primer
usuario **tiene que pasar `DATABASE_URL` explícito o fallará**. Hoy no hay ningún
llamador en el repo, así que nada está roto — pero es una condición nueva que esas
tareas todavía no conocen.

---

## 6-bis. Lo que cayó sobre este trabajo DESPUÉS de cerrar la fase

*Añadido en la revisión del 2026-08-14.* Nada de esto cambia un veredicto de la
Fase 1, pero son hechos posteriores que aterrizan justo encima de lo que se hizo
aquí, y quien lea este expediente dentro de seis meses los necesita.

1. **La decisión de cerrar el autoregistro convierte a T-01b en un eslabón del
   aprovisionamiento.** El 14/08 Jochelo decidió que **ninguna instancia abre el
   registro**, DEMO incluida (`ejecucion-plan-v3.md:32` y `:283`). Consecuencia
   registrada en `:284`: **el alta de una organización nueva ya no tiene camino por
   la aplicación**; lo único que queda es el tenant que siembra
   `db/schema.sql:598` (`insert into tenants … 'RGB Catorce','rgb'`) más el usuario
   que crea `bootstrap-auth.mjs`, que —por lo que hizo T-01— **resuelve por slug
   `rgb` y aborta si falta** (`bootstrap-auth.mjs:97` y `:107-113`). O sea que hoy
   **cada instancia nueva nacería con una organización llamada `rgb`**. La guarda que
   T-01b puso para no fallar en silencio sigue siendo lo correcto; lo que cambió es
   que ahora está en el camino crítico del alta de un owner, y eso enlaza
   directamente con **P1**, que sigue abierta.
2. **La migración de F1.2 ya viaja dentro del artefacto de release.** F2.2
   (`3f16386`) mete `db/` en la imagen: `Dockerfile:94-95` copia `db/schema.sql` y
   `db/migrations` completos, y la auditoría comparó los 68 archivos por md5 contra
   el repo. `db/migrations/20260812_sin_default_tenant.sql` está entre ellos
   (comprobado hoy). Efecto práctico: **toda instancia levantada desde la imagen
   nacerá sin los `DEFAULT`**, sin que nadie tenga que acordarse. **Producción sigue
   con ellos** hasta que se corra F1.5: son dos cosas distintas y conviene no
   confundirlas.
3. **La zona ciega 2 de §13 quedó confirmada y es peor de lo que se dijo aquí.** El
   ensayo de F2.5 (`ejecucion-plan-v3.md:298`) encontró que **la imagen no puede
   levantar una base nueva ella sola**: `db/migrations/20260729_licencias_permisos.sql:96-97`
   hace `raise exception` si no encuentra un rol de aplicación con grants, y en una
   base recién creada no lo hay — **13 migraciones** referencian ese rol. Este
   expediente lo había anotado en su forma pequeña («el bootstrap solo funciona con
   un rol que salte la RLS»); la forma grande es que **la cadena entera de arranque
   se corta antes**, en la migración del 29/07. Le cae al runner de F3.2/F3.3 y al
   aprovisionamiento de la Fase 5.

---

## 7. Lo que NO quedó probado — y por qué

Esta sección importa tanto como las anteriores.

### 7.1 El ensayo de F1.1 confirmó el catálogo. Los datos, no.

El ensayo se hizo **en solo lectura sobre la base `spaces` del 5433**, que no es
producción: es un *fixture*. Lo re-verifiqué el 2026-08-14 con `docker exec
spaces_db psql -U spaces -d spaces -Atc …` (solo `select`, sin escrituras), y **lo
volví a correr entero en la revisión** contra `38ace2f`: **misma salida, dato por
dato**, incluida la distribución de las 33 filas.

| Comprobación | Salida real de hoy | Vale para producción? |
|---|---|---|
| Tablas con `DEFAULT` en `tenant_id` | **23** | **NO.** Producción puede tener más (§1.2 punto 7 del plan) |
| Tablas con `DEFAULT` y `attnotnull = false` | `(ninguna)` → el guard no abortaría | **NO.** Solo dice que aquí no hay |
| Los 6 nombres de columna de enganche existen | `cobranzas.factura_id`, `contratos_arrendamiento.sitio_id`, `predios.arrendador_id`, `propuesta_items.propuesta_id`, `reservas.campana_id`, `sitio_modalidades.sitio_id` | Parcial: el plan los marcaba `[SIN VERIFICAR]`; existen **aquí** |
| `sitio_modalidades` | **0 filas** | **Cero vacuo** |
| Tenants presentes | `alfa, beta, emis-pruebas, empresa-nueva-sa, org-con-google-sa, rgb, ventas` | **`g500` y `eyro` NO EXISTEN aquí** |
| Filas totales en las 23 tablas del bucle | **33** (`usuarios=9, acciones=7, arrendadores=3, clientes=3, contratos_arrendamiento=3, predios=3, sitios=3, propuestas=1, propuesta_items=1`, el resto **0**) | — |

> [!danger] Un cero de esta base es **un cero vacuo**
> La consulta 2 de F1.1 —«modalidades cuyo tenant difiere del de su sitio»— devuelve
> 0 aquí porque **`sitio_modalidades` está vacía y los tenants implicados no
> existen**. No es que esté limpio: **es que no hay nada que mirar**. Lo mismo vale
> para los cinco enganches de la consulta 3: 14 de las 23 tablas tienen 0 filas.
> El caso conocido que la tarea persigue —15 modalidades de `g500`/`eyro`
> etiquetadas como `rgb`— **no es observable en local por construcción**.
>
> **El censo autoritativo sigue sin hacerse.** Es TH-02.

### 7.2 Lo local no prueba producción, en general

- El esquema desplegado **difiere** del repo, y no poco:
  `apps/web/lib/test/db-e2e.ts:103-108` deja escrito que `schema.sql` es un
  **subconjunto** de lo que corre en producción — «se comparó columna a columna y le
  faltan 143», incluidas tablas enteras (`almacen_activos`, `almacen_movimientos`).
  Por eso la migración recorre el catálogo en vez de una lista. Y por eso **23 es un
  piso, no una promesa**.
- El uuid de `rgb` en producción **no** es el de la base local: esa se recreó
  (`ejecucion-plan-v3.md:208-209`, era `:144-145`).
- **La migración nunca se aplicó a `spaces_prod`.** Lo único que se sabe es que
  aplica limpio sobre el esquema del repo más sus 67 migraciones (`ls
  db/migrations/*.sql | wc -l` → **67**, comprobado hoy).
- **El respaldo previo de F1.5 no existe todavía.** Es el paso 1 de esa tarea y lo
  hace una persona.

### 7.3 La distinción que tiene que sobrevivir

**`COMPLETADA_LOCAL` ≠ hecho.** F1.2 está *escrita y probada*, no *aplicada*: en
producción el `DEFAULT` **sigue vivo hoy** y sigue etiquetando como `rgb` cualquier
insert descuidado. **`ENSAYADA_LOCAL` significa que la parte real sigue sin
hacerse**: de F1.1 solo se ensayó la forma de las consultas, no su respuesta.

### 7.4 Lo que el plan pedía y todavía no está

`Plan_Instancias_Soberanas_v3.md:421-426` (F1.1, paso 4) manda escribir el censo
—tabla por tabla, con conteos— en `docs/Registro_Cambios.md`, y abrir un par
`docs/datos/<fecha>_<asunto>.sql` + `_rollback.sql` si hay filas que reparar.
**Ninguna de las dos cosas existe**, lo cual es coherente con que el censo real no se
haya corrido. Verificado: `git log --oneline 1ad1045~1..28c4d4a -- docs/Registro_Cambios.md`
**no devuelve ningún commit** — ningún commit de la fase tocó la bitácora.

> [!warning] Ojo con reproducir esa comprobación: hay que acotarla a la fase
> El 14/08 el comando se escribió como `1ad1045~1..HEAD`, y entonces daba vacío
> porque `HEAD` era `bc261e0`. **Hoy ya no vale**: `git log 1ad1045~1..HEAD --
> docs/Registro_Cambios.md` devuelve `70ca3f0`, que es **F2.6 de la Fase 2**, no de
> esta. El rango correcto para la Fase 1 es `1ad1045~1..28c4d4a`, y con él sigue
> saliendo vacío (recomprobado en la revisión). Es el mismo defecto que este
> expediente denuncia en otros sitios —una afirmación cierta que caduca al moverse
> su referencia—, cometido aquí dentro.

---

## 8. Las dos tarjetas humanas DE ESTA FASE

Siguen siendo **TH-01 y TH-02**, y las dos siguen **sin correr**. Están completas en
`vault/07-Agentes/ejecucion-plan-v3.md`: **TH-01 en `:137-153`** y **TH-02 en
`:178-216`** (el 14/08 estaban juntas en `:94-152`; hoy ni son contiguas). Se
reproducen aquí porque este expediente tiene que valer solo dentro de seis meses.

> [!important] Ya no son las únicas tarjetas vigentes del tablero — pero sí las de esta fase
> Cuando se levantó este expediente, TH-01 y TH-02 eran **todas** las tarjetas
> humanas emitidas. Ya no: el tablero acumula además **TH-F0.1** (de la Fase 0, el
> `curl` + `ssh` que dice si el registro está abierto hoy en el droplet —
> `ejecucion-plan-v3.md:55` y `:281`) y **TH-T03** (la cookie comodín en los `.env`
> ya desplegados — `:157-174`). **Ninguna de las dos es de la Fase 1** y ninguna
> desbloquea nada de aquí. Si este documento se lee como censo global de tarjetas,
> se lee mal: es el censo de las suyas.

### TH-01 · de F1.3 — comprobar `config_negocio` en producción

Emitida por el verificador el 2026-08-13. **Solo lectura.**

```bash
psql -d spaces_prod -c "select count(*) total, count(*) filter (where tenant_id is null) sin_tenant, count(*) filter (where max_clientes_pantalla is not null) con_cupo from config_negocio;"
```

**Esperado:** `sin_tenant = 0`. En el 5433 local salen **6 | 0 | 0** (re-corrido por
mí hoy, 2026-08-14).

**Qué pasa si no cuadra:** si producción tuviera alguna fila con `tenant_id` nulo
(esquema divergente), el filtro explícito que introdujo F1.3 dejaría a esa
organización **«sin límite» de cupo sin avisar**. Con `NOT NULL` en el esquema no
debería ocurrir; esto lo confirma.

**Desbloquea:** el visto bueno humano del merge de `c50344a`.

### TH-02 · de F1.1 — el censo real de los `DEFAULT`

Emitida por el ensayista el 2026-08-13. **Solo lectura, y son DOS pasos.**

> El comando de verificación del plan (`Plan_Instancias_Soberanas_v3.md:434`) invoca
> `psql -f /tmp/auditoria_tenant.sql`, y **ese archivo no existe ni el plan lo crea**.
> Es un agujero del plan detectado por el ensayo. El plan **no se tocó**; la tarjeta
> lo resuelve materializando el archivo antes.

**Paso 1 — dejar el SQL en el droplet** (las tres consultas literales del plan, sin
modificar, `Plan_Instancias_Soberanas_v3.md:390-419`):

```bash
ssh root@209.97.146.136 "cat > /tmp/auditoria_tenant.sql" <<'SQL'
… las tres consultas de F1.1, copiadas literalmente del plan …
SQL
```

**Paso 2 — el comando de verificación exacto de F1.1:**

```bash
ssh root@209.97.146.136 "sudo -u postgres psql -d spaces_prod -v ON_ERROR_STOP=1 -f /tmp/auditoria_tenant.sql"
```

| Consulta | Qué se espera | Qué significa lo contrario |
|---|---|---|
| 1 · tablas con `DEFAULT` | **23 o más**, nunca menos | Si salen más de 23, **ese es el hallazgo de la tarea**. Anotar la lista |
| 2 · modalidades mal etiquetadas | ~15 filas, `rgb` contra `g500`/`eyro` | Un cero es **sospechoso**: querría decir que ya se reparó. Confirmarlo antes de darlo por bueno |
| 3 · los cinco enganches | No debe fallar por nombre de columna | Si truena, **el error es el resultado**: se reporta literal, no se parchea |

**Desbloquea:** que **F1.2** pueda *aplicarse* en producción (hoy solo está autorizada
a escribirse), más **F1.5** y toda la **Fase 7**.

**Si aparecen filas sospechosas, no se corrigen en esta fase.** Se anotan y su destino
se decide en la Fase 7. Quitar el `DEFAULT` sigue adelante igual: detiene la
hemorragia aunque no cure la herida.

### Y después, F1.5

Sigue **PENDIENTE_SERVIDOR** en bloque: respaldo comprobado no vacío → ensayo en seco
con `rollback` → aplicación como `postgres` → verificación por catálogo. Los comandos
exactos están en `Plan_Instancias_Soberanas_v3.md:646-667`. Criterio: `pg_attrdef`
devuelve **0** y el login sigue dando **200**.

---

## 9. Los cinco commits ROJO DE ESTA FASE que esperan visto bueno humano

`vault/07-Agentes/ejecucion-plan-v3.md:250` (era `:186`) cierra la tanda diciendo:
«**Cinco commits ROJOS esperan visto bueno humano antes del merge**». Son estos:

| Commit | Tarea | Por qué es ROJO |
|---|---|---|
| `b976b54` | T-01 | Toca el alta del **primer usuario** de una base: sesión y credenciales (Z1 Auth 🔴). Marcado explícito en `ejecucion-plan-v3.md:82` (era `:47`) |
| `3ac2bba` | T-02 | Mismo script; cambia el destino de escritura de credenciales. Marcado en `:83` (era `:48`) |
| `c50344a` | F1.3 | **R2**, aislamiento por tenant. Marcado en `:85` (era `:50`) |
| `65bf9b5` | F1.2 | **R3**, migración destinada a producción |
| `3671e8a` | F1.4 | `middleware.ts` es archivo de **alto contacto** y pasa por todas las peticiones |

Ninguno está mergeado a `main`: viven en `feat/servidor-padre-instancias`.

> [!warning] «Cinco» es el número **de esta fase**, no el de la rama — y el de la rama ya creció
> Al 2026-08-14 la rama arrastra al menos **tres commits ROJO más**, todos **ajenos a
> la Fase 1**: **`70ca3f0`** (F2.6, marcado «ROJO: pendiente de visto bueno humano»
> en `ejecucion-plan-v3.md:106`), **`ef70aa9`** (T-03, marcado igual en `:58`) y
> **`6044732`** (F0.3, que el orquestador cuenta como ROJO aunque la celda del
> tablero —`:57`— solo registre su veredicto AMARILLO; su commit toca `.env.example`
> y no se autoclasifica). Quien vaya a mergear **no puede quedarse con el cinco de
> aquí**: tiene que mirar el tablero completo. Los expedientes de las Fases 0 y 2
> llevan la cuenta de los suyos.

---

## 10. Decisiones tomadas durante la fase

| Decisión | Fecha | Resolución |
|---|---|---|
| **T-01a · alcance del arreglo de `bootstrap-auth.mjs`** | 2026-08-13 | Las **dos** causas en el mismo commit (`on conflict` y `tenant_id`): son el mismo defecto de fondo. Se descartó meterlo dentro de F1.2 (habría inflado su diff) y se descartó ignorarlo |
| **T-01b · qué hace el script si falta el tenant `rgb`** | 2026-08-13 | **Abortar con error.** El no-op silencioso es el modo de fallo que ya costó un despliegue |
| **El plan NO se corrige** pese a que `:551-552` es falso | 2026-08-13, decisión de Jochelo | La evidencia vive en `ejecucion-plan-v3.md:235` (era `:171`), no en el plan |
| **T-01 y T-02 se abren fuera del plan**, y T-01 va **antes** de F1.2 | 2026-08-13, autorizada por Jochelo | Para que F1.2 entrara después con solo sus archivos declarados |
| **El par aprobado F1.3 ∥ F1.4 no se paraleliza** | 2026-08-13 | Las e2e comparten la única base `spaces_e2e` y cada archivo hace `drop schema public cascade` (`vitest.e2e.config.ts:13-14`, leído hoy). El DAG las aprobó por no compartir zona ni archivos, pero no contempló la base compartida |

### Decisiones de negocio que siguen abiertas y bloquean lo siguiente

`ejecucion-plan-v3.md:25-36` (era `:25-35`): **P1** (destino del tenant `rgb` y del
droplet actual), **P2** (fecha de migración de PIXELED), **P3** (cuenta de
DigitalOcean), **P4** (nombre del registry, que mantiene **F2.3 y F2.4 bloqueadas**)
y **P6** (`/api/version` pública o con token, afecta a la Fase 6). **P4-bis quedó
RESUELTA el 2026-08-13**: la bandera de autoregistro sale del build — y en la
revisión del 14/08 el tablero ya la da **RESUELTA y EJECUTADA** en `70ca3f0`.

De la Fase 1 en concreto: **P1 no bloquea nada de lo hecho**, pero sí decide qué se
hace con las filas que el censo de TH-02 encuentre — eso es Fase 7. Y desde el 14/08
P1 pesa más de lo que pesaba cuando se escribió esta línea: con el registro cerrado
en todas partes, **`rgb` es el único tenant que sabe crear una instancia nueva**
(§6-bis punto 1).

---

## 11. Lo que se rompió, se descubrió o costó por el camino

Esto es lo que explica el coste real de la fase, y ningún resumen lo cuenta.

1. **El script de bootstrap llevaba tiempo roto y nadie lo sabía.** No «a punto de
   romperse»: roto, con `42P10`, desde que la unicidad de correo pasó a ser
   insensible a mayúsculas. Se descubrió porque F1.2 obligaba a repetir una
   comprobación previa. Importa para el modelo soberano: ese script crea **el primer
   usuario de una base recién creada**, que es exactamente lo que necesita cada
   instancia nueva.
2. **Un arreglo correcto activó un peligro dormido.** El destino por omisión a la
   base con datos reales era inofensivo mientras el script no llegaba a escribir;
   T-01 lo volvió operativo. De ahí T-02.
3. **Una premisa del orquestador era falsa** y venía de un reporte que dedujo sin
   ejecutar (`ejecucion-plan-v3.md:237`, era `:173`). El ejecutor la desmintió corriendo el
   script contra una base desechable.
4. **El guard de la migración se probó haciéndolo saltar**, con tablas fabricadas
   para el caso.
5. **`vault/06-Operacion/verificacion-de-produccion.md` decía «Esperado: 21
   tablas»** — y es **la nota que leerá quien corra F1.5 contra producción**. Con 21
   escrito, un catálogo real de 23 o más se habría leído como desfase cuando es justo
   lo que F1.1 busca. Corregido en `64c35df`; hoy la nota dice **«23 o más»**
   (`verificacion-de-produccion.md:144-147`, verificado) y lleva un aviso explicando
   por qué más de 23 no es un desfase sino el hallazgo.
6. **Barrido de recuentos desfasados en la bóveda**: `MOC-Proyecto`, `esquema`,
   `entorno-y-despliegue` (66 → **67** migraciones — hoy `ls` devuelve 67), y **P15
   de `preguntas-abiertas`, que seguía planteando como pregunta abierta lo que F1.2
   acababa de responder**.
7. **Dos notas NO se tocaron a propósito**: `manual-tecnico.md` e
   `inventario-2026-08-11.md` arrastran las mismas cifras viejas. El manual se declara
   construido desde el inventario del 11/08, así que parchearle números sueltos lo
   dejaría **internamente incoherente con su propia procedencia**. Están pendientes de
   **regenerarse**, no de parchearse.
8. **Regresión de puntero, cometida y corregida dentro de la fase**
   (`ejecucion-plan-v3.md:233`, era `:169`): al reparar citas desplazadas se aplicó −8 donde
   tocaba −6, porque el corrimiento no era uniforme. Es el precio de reparar punteros
   con aritmética sin abrir el archivo.
9. **Trampa de entorno documentada, y costó 10 minutos**: las e2e exigen un build de
   Next hecho antes o fallan todas en falso tras 636 s. Quedó escrito en `CLAUDE.md`.
10. **La cita del plan ya no apunta donde apuntaba.** `Plan…v3.md:552` cita el insert
    de reservas en `campanas-repo.ts:687-696`; tras F1.3 ese insert arranca en
    **`:697`** (verificado hoy: `grep -n "insert into reservas"` da `:555` y `:697`, y
    el archivo tiene 1214 líneas). Quien repita la comprobación antes de F1.5 debe
    saberlo.

---

## 12. Lo que el plan afirmaba y el repositorio desmintió

| El plan dice | El repositorio dice | Consecuencia |
|---|---|---|
| `:551-552` «Comprobado que **no hay ninguna**» ruta que inserte sin fijar tenant | `apps/web/scripts/bootstrap-auth.mjs` insertaba en `usuarios` sin `tenant_id` | **F1.2 se detuvo antes de escribir una línea.** Nacieron T-01 y T-02 |
| `:434` el comando de verificación de F1.1 lee `/tmp/auditoria_tenant.sql` | El plan **nunca crea ese archivo** | TH-02 se emite en **dos pasos**. El plan no se tocó |
| `:552` cita el insert en `campanas-repo.ts:687-696` | Hoy arranca en `:697` | Reverificar antes de F1.5 |

La reauditoría de los inserts, hecha por el verificador sin creerse la clasificación
del ejecutor (`ejecucion-plan-v3.md:244`, era `:180`): de los 78 encontrados, 10 no nombran
`tenant_id`; menos los 2 del archivo nuevo del propio commit quedan los 9 del plan;
**8 son aserciones dentro de `.test.ts`** y el noveno es `sitios-repo.ts:277`, que la
añade dinámicamente en `:275`. **Cero rutas reales insertan sin fijar tenant** —
salvo el script de bootstrap, que ya se arregló.

---

## 13. Dos zonas ciegas que hay que recordar

Las dejó anotadas la auditoría y no las cubre ninguna prueba de esta fase.

1. **Una tabla con `tenant_id` nullable y SIN default es invisible.** El guard de la
   migración (`20260812_sin_default_tenant.sql:23-28`) solo mira las que tienen
   `DEFAULT`, y el bucle de `:38-43` solo recorre esas mismas. Una tabla con
   `tenant_id` nullable y sin default no la ve ninguno de los dos: ahí un insert
   descuidado dejaría **`NULL`** en vez de lanzar `23502`. Hoy en local no existe
   ninguna así, pero el catálogo de producción **no está censado**.
2. **El bootstrap solo funciona con un rol que salte la RLS.** Descubierto montando
   una base con las **66** migraciones que había entonces —la 67ª la añade F1.2, que
   entró después— (`ejecucion-plan-v3.md:240`, era `:176`): con `spaces`
   (superusuario) va; con un rol sin `bypassrls` falla, porque
   `20260720_hard1_usuarios_rls.sql` deja `usuarios` en RLS `FORCE` con `with check
   (tenant_id = app.tenant_id)` y el script no fija el GUC. Es **anterior** a estos
   commits. **Importa para el aprovisionamiento de instancias**: si el runbook siembra
   con el rol de la aplicación en vez del superusuario, el bootstrap fallará con
   `42501`.

---

## 14. Hallazgo abierto de F1.4, escalado y sin decidir

El criterio de F1.4 exige que «el rewrite de `portal` siga igual». **No sigue igual en
dos casos de borde** (`ejecucion-plan-v3.md:310`, era `:194`):

- `Host` en mayúsculas (`PORTAL.space-os.io`): la función nueva normaliza la caja
  (`host.ts:27`) y devuelve `'portal'`; la vieja devolvía `'PORTAL'`, que no era clave
  del `moduleMap`. **Antes no reescribía, ahora sí.**
- `Host` con punto final (`portal.space-os.io.`, FQDN perfectamente legal): la guarda
  de etiqueta vacía (`host.ts:44`) devuelve `null`. **Antes reescribía, ahora no.**

No es agujero de seguridad —`/portal/*` es público por token— y los navegadores
normalizan, así que no es alcanzable desde un cliente real. Pero está **fuera de los
pasos que la tarea autorizaba** y **pendiente de decisión**. El comentario de
`host.ts:41-42` lo justifica como «basura», sin mencionar el FQDN.

---

## 15. Verificación global — lo que corrí yo

Dos corridas, las dos del **2026-08-14** en este worktree y con salida literal. La
distinción importa: la primera mide el árbol de la fase, la segunda el de hoy.

**Corrida A — al levantar el expediente, contra `bc261e0`:**

```
$ cd apps/web && npm run typecheck
> tsc --noEmit
(sin salida — limpio)

$ cd apps/web && npm test
 Test Files  72 passed (72)
      Tests  799 passed (799)
   Duration  7.28s
[exited with code 0]
```

**Corrida B — en la revisión, contra `38ace2f`:**

```
$ cd apps/web && npm run typecheck
> tsc --noEmit
(sin salida — limpio)

$ cd apps/web && npm test
 Test Files  73 passed (73)
      Tests  805 passed (805)
   Duration  6.72s
[exited with code 0]
```

> [!note] Los seis casos de diferencia NO son de la Fase 1
> `799 → 805` y `72 → 73 archivos` es lo que añadieron **F0.3** (`6044732`, dos casos
> nuevos en `lib/entorno.test.ts`) y **T-03** (`ef70aa9`, otros dos), más el archivo
> que creó F2.6 — todo posterior y de otras fases. **Ninguna prueba de la Fase 1 se
> tocó, y ninguna cambió de resultado.** Se anotan las dos cifras con su commit
> justamente porque un recuento de suite sin ancla no significa nada: es la razón por
> la que `703649e` los sacó de la documentación viva.

Además, contra la base local del 5433 **en solo lectura**, en las dos ocasiones y con
salida idéntica: el catálogo de **23** tablas con `DEFAULT`, **0** con default y sin
`NOT NULL`, los 6 nombres de enganche, las **33** filas repartidas en 9 tablas (14
vacías: `usuarios=9, acciones=7, clientes=3, arrendadores=3,
contratos_arrendamiento=3, predios=3, sitios=3, propuestas=1, propuesta_items=1`),
los **7** tenants sin `g500` ni `eyro`, `sitio_modalidades` en **0** filas y el
`6 | 0 | 0` de `config_negocio`.

Y en el repositorio: los 5 commits con `git show --stat` (reverificados en la
revisión: mismos archivos, mismos recuentos), los **67** archivos de
`db/migrations/`, los **13** archivos `*.e2e.test.ts`, y cada `archivo:línea` citado
en este expediente, abierto — incluidas todas las del plan (`:371-671`, `:390-419`,
`:421-426`, `:434`, `:551-552`, `:646-667`), que **no han derivado**, y las de
`ejecucion-plan-v3.md`, que **sí** y están corregidas arriba.

**Lo que NO corrí, ninguna de las dos veces:** `npm run test:e2e`. Ver §3 para el
porqué y para el origen de la cifra que se cita.

---

## 16. Pendientes declarados al cerrar la Fase 1 en local

- [ ] **TH-02** — el censo real de los `DEFAULT` en `spaces_prod` (dos pasos).
      Desbloquea F1.5 y la Fase 7.
- [ ] **TH-01** — `config_negocio` sin nulos en producción. Desbloquea el merge de
      `c50344a`.
- [ ] **F1.5** — respaldo, ensayo en seco y aplicación de
      `20260812_sin_default_tenant.sql` al droplet. **Hasta que ocurra, el `DEFAULT`
      sigue vivo en producción** — reconfirmado en la revisión del 14/08: F1.5 sigue
      `PENDIENTE_SERVIDOR` en el tablero (`ejecucion-plan-v3.md:87`) y no hay ningún
      commit ni entrada de bitácora que registre su aplicación.
- [ ] **Visto bueno humano** de los cinco commits ROJO **de esta fase** antes del
      merge (§9). La rama arrastra más, de otras fases: no se mergea mirando solo
      esta lista.
- [ ] **Escribir el censo en `docs/Registro_Cambios.md`** y, si hay filas que
      reparar, el par `docs/datos/*.sql` + `_rollback.sql` — paso 4 de F1.1.
- [ ] **Decidir el caso de borde de F1.4** (mayúsculas y FQDN con punto final).
- [ ] **Regenerar** `vault/08-Manuales/manual-tecnico.md` y
      `vault/00-Inventario/inventario-2026-08-11.md`, que arrastran cifras viejas.
      No parchear.

---

## 17. Nota de entorno

- Worktree `.claude/worktrees/servidor-padre` sobre `feat/servidor-padre-instancias`.
  Postgres de desarrollo en el **5433** (contenedor `spaces_db`, sano y arriba desde
  hacía ~22 h al levantar este expediente).
- **La base `spaces` del 5433 no es de pruebas: tiene datos reales.** Todo acceso
  desde este expediente fue `select`. Las e2e usan `spaces_e2e`, y el arnés
  (`apps/web/lib/test/db-e2e.ts:34-42`) **se niega a apuntar a una base cuyo nombre no
  acabe en `_e2e` o `_test`**, precisamente porque `recrearEsquema()` hace `drop
  schema public cascade`. El comentario dice por qué existe ese guard: «deja pasar la
  de la demo local —se llama `spaces` a secas—, que es justo el despiste caro».
- Las e2e exigen `npm run build` **antes**: `servidor-e2e.ts:31` usa `npx next start`,
  que reutiliza el build y no construye. Sin `.next/BUILD_ID` fallan todas en falso
  tras 636 s, y ese rojo no dice nada del código.
- Mientras se levantaba este expediente había **otro agente trabajando en el mismo
  worktree** (F2.2, `Dockerfile` y `.dockerignore` en la raíz). Por eso el árbol se
  veía sucio con archivos ajenos y por eso este commit stagea **solo `docs/`**, por
  ruta explícita.
- En la revisión del 14/08 pasaba lo mismo, multiplicado: **tres documentalistas a la
  vez** sobre el mismo worktree, uno por fase (0, 1 y 2). Por eso tampoco aquí se
  corrió `npm run test:e2e` —recrea `spaces_e2e` con `drop schema public cascade`— y
  el commit vuelve a stagear **solo `docs/evidencias/fase-1.md`**, por ruta explícita.
  `spaces_db` llevaba **24 h** arriba y sano (`docker ps`).

---

*Levantado el 2026-08-14 contra `bc261e0` (`fb09b91`) y revisado el mismo día contra
`38ace2f`. La Fase 1 la declara cerrada el orquestador en
`vault/07-Agentes/ejecucion-plan-v3.md`, no este documento.*

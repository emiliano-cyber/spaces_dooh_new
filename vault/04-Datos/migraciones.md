---
tipo: datos
estado: verificado
actualizado: 2026-08-31
tags: [datos, migraciones, despliegue, rojo]
archivos:
  - db/migrations/
  - db/schema.sql
  - db/semilla-desarrollo.sql
  - scripts/migrar.mjs
  - scripts/migrar.test.ts
  - apps/web/lib/test/db-e2e.ts
  - apps/web/lib/test/migraciones.e2e.test.ts
  - apps/web/lib/test/reaplicacion.e2e.test.ts
  - apps/web/lib/test/permisos-semilla.e2e.test.ts
  - db/migrations/20260805_objetos_solo_en_prod.sql
  - db/migrations/20260819_semilla_rol_permisos.sql
  - db/migrations/20260820_grants_rol_app.sql
  - db/migrations/20260820_catalogo_permisos_completo.sql
  - db/migrations/20260825_sesion_metodo.sql
  - db/migrations/20260826_clientes_rfc_unico.sql
  - db/migrations/20260828_reautenticacion_por_defecto.sql
---

# Migraciones

> [!danger] ZONA ROJA
> Una migración ya aplicada en producción **no se edita nunca**. Se escribe una
> nueva. Ver [[zonas-de-riesgo]].
>
> **Excepción registrada, y única: T-04 (17/08).** Jochelo autorizó editar dos
> migraciones ya aplicadas para volver reaplicable la cadena. La condición que
> lo hizo aceptable —y la que hay que exigir si vuelve a plantearse— es que
> **toda edición sea un no-op semántico en una instalación limpia**: se comprobó
> objeto a objeto que una base virgen queda idéntica. Ver «La cadena tiene que
> poder reaplicarse», abajo.

> [!warning] DOS migraciones llevan prosa desfasada, y NO se corrige — son dos, no una
> Sus comentarios describen un `db/schema.sql` que ya no existe: el que sembraba
> el tenant `rgb` y ponía el `DEFAULT` de `tenant_id`. Lo cambió `9d609f0` el
> 2026-08-19 y las citas de las dos apuntan hoy a otra cosa.
>
> | Archivo | Lo que dice | Lo que es verdad hoy |
> |---|---|---|
> | `20260812_schema_migrations.sql:66-67` | «en cuanto `schema.sql` ha corrido siempre hay al menos un tenant (`db/schema.sql:598` siembra 'rgb')» | El esquema nace **sin ninguna organización** (`db/schema.sql:598-611`). Tras `schema.sql`, una base recién nacida tiene `tenants` **vacía** |
> | `20260812_sin_default_tenant.sql:3` y `:5` | «Ese default (`db/schema.sql:615`)» y «`config_negocio` ya nació sin él (`db/schema.sql:626+`)» | `:615` es hoy `t text;`; el bucle (`db/schema.sql:631-640`) ya no crea ningún `DEFAULT`, y el comentario de `config_negocio` está en `db/schema.sql:647-650` |
>
> **Editarlas les cambia el `sha256`**, y ninguna de las dos está marcada
> `'backfill'` —la primera se excluye a sí misma del backfill a propósito, la
> segunda ni siquiera entra—, así que toda base que ya las tenga registradas
> abortaría con **salida 3** hasta que alguien teclee `--forzar-checksum` (ver «La
> historia tiene que cuadrar»). Un comentario no vale eso. **Queda anotado aquí,
> que es donde se busca.**

## Cómo funciona

- **75 archivos** en `db/migrations/`, nombrados `YYYYMMDD_descripcion.sql`
  (medidos el 31/08; eran 74 el 27/08). El último es
  **`20260828_reautenticacion_por_defecto.sql`** (28/08), que cambia el DEFAULT
  de `tenants.exigir_reautenticacion` a `true` para que **toda organización nueva
  nazca pidiendo la contraseña** en los cambios sensibles — ver
  [[finanzas-y-cobranza]]. Antes va **`20260826_clientes_rfc_unico.sql`** (26/08),
  que le da a `clientes` el mismo RFC único por tenant que el ADR 0013 le dio a
  `arrendadores`; y antes `20260825_sesion_metodo.sql` (columna `metodo` en
  `sesiones`, la que sostiene el ADR 0018) y `20260824_grants_tablas_futuras.sql`,
  que cierra el hallazgo **H1** de [[auditoria-cuatro-rojo-20260820]]: los GRANT
  de la app alcanzan ahora a las tablas que crea **cualquier** rol, no solo el
  que aplicó la migración. **Repara** en cada pasada, **asegura** hacia adelante
  por propietario derivado de `pg_tables`, y **aborta nombrando** las tablas si
  alguna se queda fuera.

  > [!tip] Ninguna de las tres nuevas crea tabla
  > Siguen siendo **39** ([[esquema]]). `sesion_metodo` añade columna,
  > `clientes_rfc_unico` un índice único y `reautenticacion_por_defecto` **solo
  > cambia un DEFAULT, sin tocar una fila**: el recuento de tablas y el de
  > migraciones se mueven por separado, y confundirlos es lo que hizo que el
  > MOC llevara dos cifras distintas de migraciones a la vez.

  > [!warning] `20260826_clientes_rfc_unico.sql` está ESCRITA y NO APLICADA
  > Lo declara ella misma en su cabecera (`:4-7`). El arnés de integración la
  > aplica en cada corrida porque construye el esquema desde cero, así que
  > **verde en pruebas no significa aplicada en ninguna base real**. Aplicarla
  > es decisión de una persona: hay que censar los RFC duplicados antes, o el
  > `create unique index` aborta. Mismo patrón que
  > `20260812_sin_default_tenant.sql`.
- Se aplican en **orden lexicográfico** del nombre, **con dos excepciones** (ver
  abajo) que declara `scripts/migrar.mjs`.
- **Ya existe tabla de control**, `schema_migrations`, pero **todavía no en
  producción**: la crea `20260812_schema_migrations.sql`, escrita el 14/08 y sin
  aplicar (ver abajo). Hasta que se aplique, el registro de qué corrió sigue
  siendo las notas `DESPLIEGUE_*.txt` de la raíz. Herramienta de migraciones de
  terceros (`migrate`, Prisma Migrate) no hay ninguna: el runner es propio y
  vive en **`scripts/migrar.mjs`** desde el 17/08 (F3.2).
- En producción se aplican **a mano como `postgres`**:
  ```
  sudo -u postgres psql -d spaces_prod -v ON_ERROR_STOP=1 -f <archivo>.sql
  ```
- El arnés de pruebas las reaplica todas desde cero
  (`apps/web/lib/test/db-e2e.ts`, `recrearEsquema()`).

> [!warning] En producción, el estado real todavía solo se sabe mirando la base
> `schema_migrations` existe en el repo desde el 14/08, pero el droplet no la
> tiene hasta que alguien aplique la migración. Mientras tanto sigue sin haber
> forma de preguntarle al repo qué está aplicado. Ver [[preguntas-abiertas]].

## La tabla de control (`schema_migrations`)

La crea `20260812_schema_migrations.sql`. Existe porque con **una instancia por
owner** deja de haber alguien mirando: sin registro no hay forma de saber en qué
versión de esquema está un droplet.

| Columna | Para qué |
|---|---|
| `archivo` (PK) | El nombre del `.sql`, tal cual. La PK es lo que hace imposible registrar dos veces lo mismo |
| `checksum` | `sha256` del archivo aplicado, o `'backfill'` |
| `aplicada_en` | Cuándo. En las filas de backfill, cuándo se **rellenó** el registro |
| `tipo` | `esquema` o `datos`, para que el runner omita las de datos — el mismo criterio que aplicaba `deploy.yml:141-148` antes de retirarse el 31/08 |

**Sin RLS a propósito**, igual que `folios_consecutivos`: es infraestructura de
la instancia, no dato de negocio. Con RLS activa y sin `app.tenant_id` fijado
devolvería cero filas —sin error— y el runner concluiría que no hay nada
aplicado.

### El backfill, y las tres cosas que deja FUERA

Sin él, la primera corrida del runner en el droplet «aplicaría» la historia
entera: el registro nacería mintiendo. Y hasta el 17/08 habría hecho algo peor
que mentir —**abortar a mitad**—, porque dos de esas migraciones no se podían
reaplicar; eso lo arregló T-04, abajo.

La lista de 65 archivos va **escrita dentro de la migración**: un `.sql` no
puede listar un directorio (`pg_ls_dir` es de superusuario y leería el disco del
servidor de base de datos, no el repo). Y **no envejece**, que es la objeción
evidente: no es «lo que haya en `db/migrations/`», es *lo que la flota tenía
aplicado al 2026-08-12*. Un hecho histórico. Lo que se escriba mañana debe
aplicarse de verdad.

Quedan fuera, cada una por su motivo:

| Fuera | Por qué |
|---|---|
| `20260812_sin_default_tenant.sql` | Escrita pero **no aplicada en producción** (F1.2 → F1.5). Marcarla dejaría el `DEFAULT` de `tenant_id` vivo en el droplet, con el registro jurando lo contrario |
| `20260731_calendario_meses_cortos.sql` | Es `@tipo: datos`, y esas `deploy.yml` no las aplica nunca en un despliegue normal. No consta que corriera, así que no se afirma |
| La propia `20260812_schema_migrations.sql` | La registra quien la aplique, y así queda con su checksum real en vez de `'backfill'` |

**Heurística de «base con historia»:** existe `tenants` **y** tiene filas. Que la
tabla deba existir es el punto: en una base recién creada, donde ni `schema.sql`
ha corrido, no hay historia que respetar y `schema_migrations` queda vacía para
que el runner lo aplique todo. El runner **reutiliza esta misma heurística** en su
guard, en vez de inventarse otra (ver «El guard», abajo).

> [!important] Desde el 19/08 la heurística SÍ distingue una instalación nueva
> **Hasta esa fecha no lo hacía, y esta nota lo decía así**: `schema.sql` sembraba
> el tenant `rgb`, de modo que **en cuanto corría, la heurística ya decía «con
> historia»**. Era el peor sitio posible para esa frase, porque es la que se lee
> justo antes de decidir si una base es nueva o rezagada.
>
> El esquema ya no siembra ninguna organización (`db/schema.sql:598-611`, desde
> `9d609f0`), así que tras `schema.sql` una base recién nacida tiene `tenants`
> **vacía** y el backfill **no dispara**: sale por el segundo `return` del bloque,
> con el NOTICE *«Base con esquema pero sin organizaciones: no hay historia que
> respetar»* (`20260812_schema_migrations.sql:107-110`). Medido el 19/08 —lo fija
> `apps/web/lib/test/migraciones.e2e.test.ts:324-327`, que exige **cero** filas
> `'backfill'` tras la primera corrida sobre base vacía.
>
> Lo que **no** cambia: en una base que ya tiene organización —el droplet— la
> heurística sigue diciendo «con historia» en cuanto se la pregunta, así que esta
> migración solo es segura aplicada **en su turno**, después de las 65. Lo que
> desapareció es el falso positivo de la instalación recién nacida. Y la prosa de
> la propia migración (`:66-67`) todavía cuenta la versión vieja: ver el aviso del
> principio de esta nota.

## El runner (`scripts/migrar.mjs`)

Es lo que corre una instancia al actualizarse (lo invocará `update.sh`, F3.4).
Sustituye al bucle de `deploy.yml:141-148`, que reaplica **todas** las
migraciones en cada despliegue y no deja registro.

```
DATABASE_URL=postgresql://usuario:clave@host:puerto/base node scripts/migrar.mjs
                                                          node scripts/migrar.mjs --pendientes  # lista, no aplica
                                                          node scripts/migrar.mjs --con-datos   # incluye las @tipo: datos
                                                          node scripts/migrar.mjs --instalacion-nueva  # la base acaba de nacer
                                                          node scripts/migrar.mjs --forzar-checksum=AAAAMMDD_x.sql  # esa se reescribio a conciencia
```

**Códigos de salida** (`scripts/migrar.mjs:21-33`), que es lo único que mira el
`set -e` de `update.sh`: **0** nada que hacer o todo aplicado y registrado; **1**
no se puede ni empezar (falta `DATABASE_URL`, **no existe el rol de aplicación**,
argumento desconocido, no se sabe si la base es nueva o rezagada, o una bandera
afirma algo que la base desmiente);
**2** una migración falló, o se aplicaron y no se pudieron registrar; **3** el
registro y la imagen no cuentan la misma historia.

> [!warning] Se corre desde la RAÍZ del repositorio, no desde `apps/web`
> El script vive en `scripts/`, no en `apps/web/scripts/`. El comando de
> verificación de F3.2 (`Plan_Instancias_Soberanas_v3.md:994-998`) hereda un `cd
> apps/web` de su primera línea y por eso su segunda línea falla con
> `Cannot find module … apps\web\scripts\migrar.mjs`. Es un defecto del plan, no
> del runner.

| Decisión | Por qué |
|---|---|
| **Tiene que existir un rol de aplicación** —`spaces_app` o `spaces_user`—: si no, salida 1 y no se aplica nada | **13 migraciones** conceden sus GRANT a una lista blanca de dos nombres —`20260715_arr_m6_rol_restringido.sql:21` y `:38`, y el `foreach r in array array['spaces_user','spaces_app']` de otras once—, todas guardadas por existencia del rol. Con cualquier otro nombre **no conceden nada y no dan error**: el runner registra la migración como aplicada y no vuelve a intentarlo nunca. Medido el 2026-08-20 (ROJO-3). Los **dos** nombres son los que saben conceder las migraciones; lo propio de cada instancia es la **contraseña**. Un nombre libre **no es posible hoy**: una base virgen con otro nombre aborta en `20260729_licencias_permisos.sql:88-97` (archivo 52 de 70) |
| **`DATABASE_URL` obligatoria**: sin ella aborta con salida 1 | Desviación consciente de `apply-migration.mjs:16-24`, que cae en un default local. Ese default es la base de **desarrollo con datos reales**, cuyo rol `spaces` es superusuario con `BYPASSRLS`. Es lo que T-02 le quitó a `bootstrap-auth.mjs`, y aquí pesa más: este script ejecuta **DDL** |
| Solo imprime `host:puerto/base` | El destino se registra **sin credenciales**, igual que `apply-migration.mjs:28-37` |
| Sin registro **y con datos** = se para y pregunta (salida 1) | La heurística que mira ahí —la del backfill— no distingue una instancia rezagada de una recién instalada, y las dos suposiciones hacen daño en silencio. Ver «El guard», abajo |
| `--instalacion-nueva` **se verifica** contra la base (salida 1 si no se sostiene) | Una afirmación que nadie comprueba es una heurística con otro nombre. Ver «La bandera afirma, y se comprueba», abajo |
| Una migración ya aplicada que cambió en disco **aborta** (salida 3) | El registro guarda el `sha256` de lo aplicado. Si el archivo de la imagen ya no es ese, nadie sabe describir el estado sobre el que se aplicaría lo pendiente. Ver «La historia tiene que cuadrar», abajo |
| La tabla de registro la crea una migración, no el runner | El runner **no duplica ese DDL**: una segunda copia es la forma de que las dos dejen de coincidir. Lo aplicado antes de que la tabla exista se registra en cuanto aparece |
| Cada archivo con **su propia transacción** | **48 de los 68** traen su `begin; … commit;`, y envolverlos en otra no anida: el `commit` de dentro cerraría el de fuera. Los otros 20 viajan como sentencia simple, que Postgres ejecuta en su transacción implícita. En los dos casos, si el archivo falla no queda aplicado a medias. Se aborta **sin registrarlo** y con el nombre del archivo en el error (salida 2) |
| Si aplica y **no puede registrar**, salida 2 | El insert del registro también puede fallar (permisos, disco, réplica en solo lectura). Escapaba sin capturar, o sea salida **1 con volcado de pila** —«no se pudo ni empezar»— sobre una base que sí cambió. El 2 es lo que un `set -e` necesita distinguir para saber si hay que ir a mirar |
| Las `@tipo: datos` se **omiten** y se nombran | Mismo criterio que `deploy.yml:151-159`: reescriben filas y no se deshacen solas. Pero una migración que no se aplica y que nadie menciona es una que se olvida |
| El tipo se lee de la **primera línea** | `20260812_schema_migrations.sql` **menciona** la cadena `-- @tipo: datos` en su prosa (`:44` y `:168`). Un filtro por «el archivo contiene la marca» se saltaría, en silencio, justo la migración que crea la tabla de registro. Lo ancla `scripts/migrar.test.ts` |

### El guard: «sin registro» NO significa «instancia nueva»

Era la suposición del primer runner, y en el único servidor que hoy existe es
exactamente al revés: el droplet lleva meses con las migraciones aplicadas a mano
y **sin** `schema_migrations`, porque la crea una migración que nadie ha aplicado
todavía. Leído como «instancia nueva», el runner le reaplicaba **su historia
entera**.

**Hasta el 19/08 la heurística que el runner reutiliza aquí —la del backfill:
existe `tenants` y tiene filas— no las distinguía**, porque después de
`schema.sql` las dos enseñaban el tenant `rgb` y ninguna tenía registro. Desde que
el esquema nace sin organización (`db/schema.sql:598-611`) **sí las separa**: una
base recién creada tiene `tenants` vacía y este guard ya no le sale al paso. La
pregunta explícita se queda de todas formas —una heurística que hoy acierta no es
una respuesta— y sigue habiendo una segunda señal, la de `testigosDeHistoria()`,
que es la que **verifica** la bandera (ver «La bandera afirma, y se comprueba»).
Lo escribe así el propio runner en `scripts/migrar.mjs:377-386`. **Las dos
suposiciones hacen daño, por lados opuestos:**

| Suposición equivocada | Qué pasa |
|---|---|
| La rezagada tratada como nueva | Reaplica la historia. Desde T-04 la cadena aguanta una segunda pasada, pero una base parada en la ventana `[20260723, 20260807)` **aborta a mitad** y queda con migraciones aplicadas y **cero** registradas |
| La nueva tratada como rezagada | El backfill da por aplicadas 65 migraciones que **nunca corrieron**, y `schema.sql` es un SUBCONJUNTO de lo desplegado (le faltan 143 columnas, `db-e2e.ts:107-112`). El esquema queda incompleto **sin dar un solo error** |

Así que **el runner no adivina: se para con salida 1 y pregunta**, nombrando las
dos salidas — aplicar primero `20260812_schema_migrations.sql` si la instancia
tiene historia, o repetir con `--instalacion-nueva` si acaba de nacer. La
heurística de «base con historia» es la **misma, literal**, que la del backfill
(`20260812_schema_migrations.sql:99-110`): existe `tenants` y tiene filas. Si las
dos divergieran, runner y backfill discreparían sobre qué es una instancia nueva,
y esa discrepancia no da error: deja un registro que miente.

### La bandera afirma, y se comprueba

`--instalacion-nueva` declara un hecho —«esta base acaba de nacer»— y **el runner
lo verifica antes de creérselo**. Las dos direcciones, porque las dos hacen daño:

| Sobre qué base | Qué pasa |
|---|---|
| Con `schema_migrations` | Se rechaza (salida 1): el registro desmiente a la bandera, y quien la teclea cree estar hablando de otra base |
| Sin registro pero **con historia** | Se rechaza (salida 1) nombrando las tablas que la delatan y quién las crea. **No se aplica nada** |
| Recién nacida (rol de app + `schema.sql`) | Se acepta, y lo dice en voz alta: `--instalacion-nueva verificada: ninguna de las 11 tablas …` |

La segunda fila es la que faltaba, y no era un caso rebuscado: **el mensaje del
guard le pone al operador esa línea exacta para copiar**. Tecleada sobre el
droplet de hoy —que es rezagado, no nuevo— le reaplicaba las 67 migraciones **con
salida 0**, en silencio.

**La señal se DERIVA del repositorio, no se escribe a mano:** `schema.sql` dice
qué tablas trae una instalación recién nacida (es lo único que se le aplica, con
el rol de app), y las migraciones dicen cuáles añaden ellas. La diferencia son
**11 tablas** —`almacen_activos`, `password_resets`, `licencias`,
`identidades_externas`…— que en una base recién nacida **no pueden existir**. Si
alguna existe, la bandera miente. Las dos partes viajan en la imagen
(`Dockerfile:94-95` copia `db/schema.sql` y `db/migrations`), así que la
derivación funciona igual en el droplet que en el repo.

> [!warning] Por qué tablas y no índices, y por qué eso importa
> Los índices darían más resolución y también **falsos positivos**: un
> `constraint … unique` declarado dentro de un `create table` de `schema.sql`
> crea un índice con ese nombre **sin** que haya ningún `create index` que lo
> delate, así que se derivaría como testigo y una instalación legítima quedaría
> rechazada — justo lo que la bandera existe para permitir. Un nombre de **tabla**
> solo puede venir de un `create table`, y eso se lee igual de bien en los dos
> lados.

**Cobertura y su límite, dicho en voz alta:** la primera migración que crea tabla
propia es `20260716_doohmain_playlogs.sql`, así que una base parada **antes** de
esa fecha es indistinguible de una nueva por este criterio. Ninguna instancia real
está ahí (el droplet va por `20260810`) y **la ventana peligrosa —`[20260723,
20260807)`, donde reaplicar aborta a mitad— queda cubierta desde su primer
archivo**, que es `20260723_almacen.sql`.

**Fail-closed en las tres formas de no poder verificar** —sin `schema.sql` que
leer, sin señal derivable, o sin poder preguntárselo a la base—: salida 1 y no se
aplica nada. Una verificación que ante la duda deja pasar no verifica, decora.

> [!important] La señal puede caducar, y hay un canario para que se oiga
> El día que `almacen_activos` se renombre, se retire o entre en `schema.sql`, la
> derivación pierde cobertura **en silencio**. Por eso `scripts/migrar.test.ts`
> lleva un caso escrito a mano —el único nombre cableado de todo el mecanismo— que
> se pone **rojo** ese día. Quien lo vea: comprobar que quedan testigos
> suficientes y volver a elegir el canario, no borrar la prueba.

> [!note] La bandera **no** desaparece a favor de la señal
> Sería tentador dejar que el runner decidiera solo mirando los testigos. No:
> convertiría una pregunta explícita en otra heurística, y esa heurística es
> **fail-open** —una base sin testigos se daría por nueva sin que nadie lo haya
> afirmado—. Descartado expresamente el 17/08. La bandera se queda; lo que gana es
> comprobación.

> [!danger] El orden importa y no es simétrico
> Sobre una instalación recién creada, aplicar `20260812_schema_migrations.sql`
> **antes** que el resto es justo lo que NO hay que hacer: su backfill da por
> aplicadas las 65 históricas. En una instalación nueva esa migración debe llegar
> **en su turno**, aplicada por el runner después de las 65 — que es lo que el
> propio archivo asume al decir que «acaban de aplicarse en esta misma pasada»
> (`:66-70`).

Lo cubren **cinco** casos en `migraciones.e2e.test.ts`, que montan el droplet de
hoy (rol de app → `schema.sql` → la historia anterior al corte, sin registro) y
comprueban que el runner **se niega y no toca la base**, que `--pendientes`
tampoco contesta «Aplicadas: 0», que **`--instalacion-nueva` tampoco cuela sobre
esa base**, y que tras aplicar el registro el runner aplica **solo lo que falta**
— las 65 filas siguen marcadas `'backfill'`, que es el rastro que dejaría lo
contrario.

> [!warning] El runner NO levanta una base virgen él solo
> `20260729_licencias_permisos.sql:96-97` aborta si no existe un rol de
> aplicación con grants, y **13 migraciones** dependen de ese rol. La secuencia
> real de una instancia es **crear el rol de app → `schema.sql` → migraciones**,
> y de las dos primeras hoy no se encarga nadie: `Dockerfile:94-95` copia solo
> `db/schema.sql` y `db/migrations`, y `db/dev-rol-app.sql` no viaja en la
> imagen (además es de desarrollo: en producción el rol es `spaces_user`).
> `recrearEsquema()` lo resuelve aplicando `dev-rol-app.sql` primero, y la prueba
> de la base vacía reproduce ese mismo prólogo. Queda abierto para el
> aprovisionamiento (Fase 5) — que además es **quien tendrá que pasar
> `--instalacion-nueva`**: es el único que sabe con certeza que la base acaba de
> nacer.

> [!danger] El ASSERT de `20260812_schema_migrations.sql:221-223` y este runner
> Ese ASSERT comprueba `archivo >= '20260812'` sobre **toda** la tabla, sin
> distinguir una fila del backfill de una que ponga legítimamente el runner. En
> cuanto el runner registre `20260812_schema_migrations.sql` o
> `20260812_sin_default_tenant.sql`, **reaplicar esa migración aborta** — y
> `deploy.yml:141-148` reaplicaba todas en cada despliegue.
>
> **Esa mitad del riesgo desapareció el 2026-08-31: F3.6 retiró `deploy.yml`**,
> así que ya no existe el workflow que abortaría. Lo que **no** desaparece es el
> ASSERT: sigue en la migración, y sigue abortando si alguien reaplica esos dos
> archivos después de que el runner los registre. El disparador ahora sería
> `update.sh`, no el workflow viejo.

### La historia tiene que cuadrar: el checksum de lo ya aplicado (F3.3, 17/08)

`schema_migrations.checksum` guarda el `sha256` de lo que se aplicó. Desde el
17/08 el runner **lo compara** antes de tocar nada: si un archivo ya registrado
llega con otro contenido, la instancia **se niega a actualizarse** (salida 3),
nombra el archivo y enseña **los dos checksums**. Escribir el checksum ya lo
hacía F3.2; lo que faltaba —y es lo que añade F3.3— era compararlo.

Que la comprobación vaya **antes de todo**, incluido `--pendientes`, es el punto:
«aborta» tiene que significar *sin tocar nada*, no *a mitad*. Y `--pendientes` es
la orden que se teclea justo antes de actualizar, así que tampoco puede callarse.

| Fila del registro | Qué hace el runner |
|---|---|
| Checksum real que **coincide** | Sigue: la migración está aplicada y no se reaplica |
| Checksum real que **no** coincide | **Salida 3**, sin aplicar nada, nombrando archivo y los dos hashes |
| `'backfill'` | **Se la salta a conciencia** |
| Archivo pendiente (sin fila) | Nada que comparar: se aplica |

> [!important] La excepción de `'backfill'` es lo que impide negarse a actualizar la flota entera
> Esas filas son las 65 migraciones que el droplet aplicó **a mano** antes del
> 2026-08-12; nadie guardó el hash de origen, y por eso
> `20260812_schema_migrations.sql:51-56` deja escrito que la marca existe *«para
> que la comprobación de integridad de F3.3 se las salte a conciencia»*.
> Inventar hoy un checksum afirmaría que lo aplicado coincide con lo que hay en
> disco, que es precisamente lo que no se sabe.
>
> **No es teórico: T-04 editó dos de esos archivos.** Medido en las dos
> direcciones, ninguna muerde: en el droplet están marcados `'backfill'` y se
> saltan; y en una **instalación nueva** el runner los aplica él mismo y los
> registra con su checksum real —calculado sobre el archivo ya editado—, así que
> coinciden. (En una instalación nueva **no queda ni una fila `'backfill'`**, y
> desde el 19/08 por **dos** motivos que apuntan al mismo sitio: el backfill ni
> siquiera dispara —`schema.sql` dejó de sembrar organización, así que sale por su
> NOTICE «Base con esquema pero sin organizaciones»—; y aunque disparara, el `on
> conflict … do update` del runner (`scripts/migrar.mjs:631-632`) reescribiría esas
> 65 filas con el checksum real en la misma pasada. Lo mide
> `apps/web/lib/test/migraciones.e2e.test.ts:324-327`.)

**`--forzar-checksum=<archivo>` es el escape, y exige el nombre del archivo.**
Desviación consciente del paso 3 de F3.3, que la describe sin argumento:

- **suelta, perdonaría a bulto** cualquier migración alterada, presente y futura
  — justo lo que la comprobación existe para impedir— y se quedaría puesta para
  siempre en el `update.sh` de alguien. Sin nombre, **salida 1**;
- nombrando el archivo, perdonar es una decisión sobre **uno concreto**, y el
  runner **puede comprobarla**: si ese archivo no diverge —o está registrado como
  `'backfill'`, donde no hay nada que forzar—, **salida 1**. Es la lección que
  costó dos ciclos con `--instalacion-nueva`, aplicada a lo que aquí sí se puede
  verificar: la bandera no afirma un estado de la base, afirma una decisión sobre
  un archivo, y lo verificable es que ese archivo sea de verdad el que diverge;
- **no reaplica nada**: pone al día lo que el registro *afirma*. Actualiza el
  `checksum` y **no** `aplicada_en` — esa fecha dice cuándo se aplicó el archivo,
  y forzar el checksum no lo aplica. Con eso el escape **no se vuelve
  permanente**: la corrida siguiente ya no necesita la bandera.

> [!note] Lo que F3.3 deja fuera, dicho en voz alta
> Una fila registrada **cuyo archivo no viaja en la imagen** también es una
> discrepancia —una instancia por delante de su propia imagen— y **no** dispara
> nada: la comprobación solo mira los archivos que están en los dos lados. Se dejó
> fuera a propósito: F3.3 es sobre contenido alterado, y abortar ahí rechazaría de
> paso el día que se retire una migración del repositorio, que merece su propia
> decisión.

Lo cubren **ocho** casos en `migraciones.e2e.test.ts`, sobre una base desechable
que llega al estado del droplet ya puesto al día —así conviven filas `'backfill'`
y filas con checksum real—: la alterada aborta con 3, **con `--con-datos` la
migración de datos pendiente sigue sin aplicarse** (prueba de que aborta antes del
bucle), `--pendientes` tampoco calla, la fila `'backfill'` se salta, y las tres
formas de usar `--forzar-checksum` (acepta y pone al día; rechaza el archivo que
no diverge; rechaza la bandera suelta).

## La cadena tiene que poder REAPLICARSE (T-04, 17/08)

`deploy.yml:141-148` reaplica **todas** las migraciones de esquema en cada
despliegue y confía en que sean idempotentes. Esa confianza **no la comprobaba
nadie**: `recrearEsquema()` las aplica siempre sobre una base recién vaciada, o
sea que ejercita la primera pasada y **nunca la segunda**. Por eso el repo llegó
al 17/08 con dos migraciones de julio que abortaban al reaplicarse, y se
descubrieron auditando F3.2 en vez de en CI.

| Rotura | Error | Por qué |
|---|---|---|
| `20260720_hard1_usuarios_rls.sql` | `cannot change return type of existing function` | `create or replace` no puede devolver `auth_usuario_por_sesion` a su forma de julio después de que `20260804_reautenticacion_individual.sql:70-71` le añadiera la columna `debe_cambiar_password` |
| `20260729_datos_contrato_documento.sql` | `constraint "contrato_dia_pago_ck" ... already exists` | `add constraint` **no admite `IF NOT EXISTS`** en Postgres |

Fueron **dos, no una**: la primera aborta la pasada y tapa a la siguiente, así
que el censo hay que hacerlo continuando tras cada fallo.

> [!important] La causa NO es la que quedó escrita el 17/08
> El veredicto de F3.2 ([[07-Agentes/ejecucion-plan-v3]]) atribuye el cambio de tipo de
> retorno a `20260806_identidades_externas.sql` y `20260807_password_resets_rls
> .sql`. **No es así**, y se comprueba en un grep: esas dos crean funciones
> nuevas y propias (`auth_usuario_por_identidad`, `auth_reset_por_token`) y no
> tocan las de julio. Quien redefine `auth_usuario_por_sesion` es
> `20260804_reautenticacion_individual.sql:70-71`, y lo dice en su propio
> comentario (`:65-69`).

**El patrón: guarda delante, no cambio de semántica.** Cada edición es un no-op
en una instalación limpia:

- `20260729_datos_contrato_documento.sql` envuelve los dos `add constraint` en un
  `do $$ … if not exists (select 1 from pg_constraint …) $$`, que es el patrón ya
  usado en `20260715_arr_m2_tablas.sql:45-59`.
- `20260720_hard1_usuarios_rls.sql:78-101` guarda la creación de
  `auth_usuario_por_sesion` con `to_regprocedure(...) is null`. Aquí **no** se usó
  el `drop function if exists` habitual, y la razón está escrita en el archivo
  (`:59-77`): dropear y recrear **degradaría** la función a la versión de 7
  columnas durante los segundos que la cadena tarda en volver a la migración de
  agosto, y `auth.ts:116-117` pide `debe_cambiar_password` en **cada** petición
  autenticada. Si la cadena abortara en ese hueco (`ON_ERROR_STOP=1`), la
  instancia se queda sin resolver ni una sesión.

Lo cubre **`apps/web/lib/test/reaplicacion.e2e.test.ts`** (4 casos): monta el
prólogo real de una instancia, aplica la cadena tres veces sobre la misma base y
comprueba además que **el esquema converge** — una reaplicación que no da error
pero deja una función en su forma vieja sería el mismo fallo silencioso, sin
rojo. El censo lista **todas** las roturas, no solo la primera.

> [!note] Editar el archivo cambia su checksum, y aun así **no** dispara F3.3
> Ya no es una previsión: F3.3 está implementada desde el 17/08 y se midió.
> En el droplet estas migraciones están registradas por el backfill con el valor
> literal `'backfill'`, y `20260812_schema_migrations.sql:51-56` declara que esa
> marca existe *«para que la comprobación de integridad se las salte a
> conciencia»*. Como el checksum de origen nunca se guardó, no hay nada con lo
> que comparar y no hay alarma que disparar. **En una instalación nueva tampoco
> muerde, pero por el motivo contrario**: ahí las aplica el runner y las registra
> con el checksum del archivo **ya editado**, así que cuadra. Ver «La historia
> tiene que cuadrar», arriba.

## Dos migraciones cuyo nombre miente sobre el orden

El mapa `ANTES_DE` vive en **`scripts/migrar.mjs`** y se declara **una sola
vez**: `db-e2e.ts` tenía su copia y desde el 17/08 la importa (`ordenar()`). Dos
copias divergen, y divergir aquí significa que las pruebas apliquen en un orden y
el droplet en otro. **Si aplicas por orden alfabético a ciegas, estas dos
fallan:**

| Debe ir ANTES | Que | Por qué |
|---|---|---|
| `20260720_hard1_usuarios_rls.sql` | `20260720_hard1_rls_todas_tablas.sql` | La segunda comprueba que `usuarios` ya tenga RLS+FORCE, y la pone la primera (`r` < `u`) |
| `20260727_contrato_incompleto_enum.sql` | `20260727_contrato_incompleto.sql` | La segunda usa el valor `'INCOMPLETO'`, y lo añade la primera (`.` < `_`) |

No se renombraron a propósito: *«renombrar migraciones ya aplicadas confunde a
quien compare el repo con lo desplegado»* (`scripts/migrar.mjs`).

## Hitos

> [!success] 2026-08-28 · Estas CINCO ya están aplicadas en el PADRE
> Esta tabla decía de ellas «escrita, NO aplicada en producción», y era cierto
> cuando se escribió. **Hoy no.** No hace falta comprobarlas una a una: el
> recuento lo zanja.
>
> El PADRE marcaba **73 aplicadas** en sus dos bases —`spaces_prod` y
> `spaces_demo`— cuando `db/migrations/` tenía **74 archivos**, medido el 27/08 y
> el 28/08 (`docs/evidencias/despliegue-padre-20260827.md`, paso V12). La única
> que faltaba era **`20260731_calendario_meses_cortos.sql`**, que el runner omite
> a propósito por ir marcada `-- @tipo: datos` y solo entra con `--con-datos`.
>
> **74 − 1 = 73.** El conteo cuadraba.

> [!warning] Esa cuenta ya no es la de hoy — hay una migración más (31/08)
> El repositorio tiene **75** archivos desde el 28/08:
> `20260828_reautenticacion_por_defecto.sql`, que **no lleva `@tipo`** y por
> tanto cuenta como de esquema. La cuenta esperada pasa a ser **75 − 1 = 74**.
>
> **Que el PADRE la tenga aplicada NO está comprobado aquí**: esta revisión se
> hizo contra el repositorio y no se entró al servidor. Es una lectura, y la
> corre una persona:
>
> ```bash
> # En el PADRE, contra cada base:
> psql -d spaces_prod -c "select count(*) from schema_migrations;"
> ```
>
> Si da 73, falta aplicarla, y su efecto importa: es la que hace que **toda
> organización nueva nazca pidiendo la contraseña** en las ocho rutas sensibles,
> tres de ellas de dinero. Ver [[finanzas-y-cobranza]].

| Migración | Qué cambió |
|---|---|
| `20260629_bitacora_append_only.sql` | `acciones` deja de poder editarse |
| `20260715_arr_m2_tablas.sql` | `predios`, `arrendador_razon_social` |
| `20260715_arr_m5_rls_failclosed.sql` | **Primer endurecimiento de RLS** |
| `20260715_arr_m6_rol_restringido.sql` | Rol de app sin BYPASSRLS |
| `20260716_control_cambios.sql` | `sesiones.desbloqueo_expira_en` |
| `20260720_hard1_usuarios_rls.sql` | `usuarios` FORCE + las 3 funciones `auth_*` + ASSERT del rol |
| `20260720_hard1_rls_todas_tablas.sql` | Fail-closed en 16 tablas + funciones de token público |
| `20260723_password_resets.sql` | Recuperar contraseña |
| `20260727_contrato_incompleto_enum.sql` | Valor `INCOMPLETO` (ADR 0001) |
| `20260728_cobro_parcialidades.sql` | Cobro en cuotas |
| `20260729_firma_contrato.sql` | `contrato_firmas` |
| `20260804_folios_consecutivos.sql` | Fin de los folios aleatorios |
| `20260804_reautenticacion_individual.sql` | ADR 0009 — quita el secreto compartido |
| `20260805_config_negocio_por_tenant.sql` | ADR 0011 |
| `20260805_objetos_solo_en_prod.sql` | **Ver abajo** |
| `20260806_identidades_externas.sql` | ADR 0012 — aplicada en prod el 07/08 11:13 |
| `20260807_password_resets_rls.sql` | `password_resets` pasa a fail-closed — aplicada en prod el 10/08 09:14 |
| `20260810_notificaciones_archivada_en.sql` | `notificaciones.archivada_en` |
| `20260810_arrendadores_rfc_unico.sql` | `arrendadores_tenant_rfc_uq` — un RFC, un propietario (ADR 0013) |
| `20260812_sin_default_tenant.sql` | Retira el `DEFAULT` de `tenant_id` de las 23 tablas — **aplicada en el PADRE** (ver el aviso del 28/08) (eso es F1.2 → F1.5) |
| `20260819_semilla_rol_permisos.sql` | El catálogo de permisos viaja con el código: **25 filas · 8 módulos · 3 roles** (ver abajo) — **aplicada en el PADRE** (ver el aviso del 28/08), donde es no-op |
| `20260812_schema_migrations.sql` | Nace la tabla de control y su backfill (F3.1) — **aplicada en el PADRE** (ver el aviso del 28/08). Va **antes** que `sin_default_tenant` por orden lexicográfico (`c` < `i`), que es justo el orden que se quiere: así el runner registra las 65 históricas y aplica de verdad la de F1.2 |
| `20260820_catalogo_permisos_completo.sql` | El catálogo COMPLETO: **41 filas · 9 módulos · 5 perfiles** (ver abajo) — **aplicada en el PADRE** (ver el aviso del 28/08). Cierra ROJO-2: hasta el 20/08 había **dos** catálogos y ganaba el que corriera último |
| `20260820_grants_rol_app.sql` | Los GRANT del rol de aplicación **sin lista blanca**: concede a los candidatos que existan y **aborta si no hay ninguno** (ROJO-3) — **aplicada en el PADRE** (ver el aviso del 28/08). El nombre se **declara** con `ROL_APP` / `space_os.rol_app`, y sin declaración valen `spaces_app` y `spaces_user`, así que **el droplet actual se actualiza sin tocarle el rol**. ⚠️ Límite medido: una base virgen con nombre nuevo aborta antes, en `20260729_licencias_permisos.sql:88-97` (archivo 52 de 70) |

## La migración que revela el mayor riesgo del proyecto

`20260805_objetos_solo_en_prod.sql` documenta que **hasta el 05/08/2026 el
repositorio no podía construir una base de datos que funcionara**.

Al montar las pruebas de integración se comparó columna a columna una base
levantada desde el repo contra `spaces_prod`: **faltaban 27 columnas**, de tres
objetos creados a mano en producción y nunca versionados.

No era cosmético:
- `creativos-repo.ts:103` hace `update creatividades set retirado_en = now()` →
  **retirar un creativo fallaba** en cualquier entorno nuevo.
- `playlogs-repo` consultaba dos tablas de caché de DOOHmain que nada creaba.

> [!danger] La lección que hay que conservar
> Un objeto creado a mano en producción y no versionado **no falla donde se
> creó**: falla en el entorno nuevo, o en la recuperación desde cero, que es el
> peor momento posible. Cualquier cambio de esquema va como migración, siempre.

## El catálogo de permisos también estaba solo en la base (19/08)

Exactamente la misma lección de la sección anterior, cuatro días después y en
otra tabla: **`rol_permisos` se configuró a mano y nunca entró al repositorio.**

Medido antes de escribir la migración:

| Base | `rol_permisos` |
|---|---|
| Recién aprovisionada (rol de app → `db/schema.sql` → `migrar.mjs --instalacion-nueva`) | **5 filas · 1 módulo** |
| De desarrollo | **25 filas · 8 módulos · 3 roles** (antes del 20/08; con la migración del 20/08, **41 · 9 · 5**) |

`db/schema.sql:75-80` crea la tabla vacía y el único sembrado que viajaba en la
cadena era `20260804_modulo_inventario.sql:22` — las cinco filas de `inventario`
del ADR 0010. Las otras veinte no estaban en ninguna parte de lo que se
despliega.

> [!danger] Y no hay red debajo: el Dueño no tiene atajo
> `permisosDeRol` y `tienePermiso` (`apps/web/lib/server/auth.ts:126-142`) son
> consultas directas a la tabla, **sin excepción para ningún rol**, y `exigir()`
> es fail-closed. Con cinco filas de `inventario`, el Dueño de una instancia
> recién creada entraba y la veía **entera cerrada** — ni Administración, desde
> donde da de alta a su equipo. No es una fuga: es una instancia inservible
> desde el minuto uno. Bloqueaba F4.4 y toda la Fase 5.

`20260819_semilla_rol_permisos.sql` sembró las 25 y
`20260820_catalogo_permisos_completo.sql` las lleva a **41 · 9 · 5**, las dos
con `on conflict do nothing`. Tres decisiones que conviene no rehacer:

- **Migración y no `bootstrap-auth.mjs`** (decisión de Jochelo, 19/08). El
  catálogo es configuración de producto, idéntica en toda la flota, y así llega
  también a las instancias que ya existan cuando se actualicen. El bootstrap
  crea la identidad de **cada** instancia, que es lo contrario.
- **No lleva `-- @tipo: datos`.** Con esa marca el runner la saltaría salvo
  `--con-datos` y `deploy.yml:141-148` no la aplicaría nunca, así que la
  instancia nueva seguiría naciendo sin permisos. Mismo criterio que
  `20260804_modulo_inventario.sql`, que tampoco la lleva.
- **El ASSERT comprueba PRESENCIA, no el total.** Un `count(*) = 25` abortaría
  en cualquier base donde alguien haya concedido un permiso de más a propósito
  —`apps/web/scripts/a4-candado-banco.mjs:101` hace justo eso— y negarse a
  actualizar la flota por eso sería peor que el problema.

> [!important] Lo que la migración del 19/08 dejaba sin decidir, DECIDIDO el 20/08
> Aquella se negó a sembrar `imprenta` y los perfiles `IMPRENTA` y `FINANZAS`
> porque hacerlo era **inventar política de acceso**, y eso se decide, no se
> deduce. Quedó medido y esperando decisión, y la decisión llegó al cerrar
> **ROJO-2**: manda el contenido que llevaba el alta y se adopta **entero**.
>
> `20260820_catalogo_permisos_completo.sql` añade **16 filas** sobre aquellas 25:
>
> | Perfil | Gana |
> |---|---|
> | **DUEÑO** (19 → 24) | `imprenta` completo, `operaciones: aprobar`, `network: crear` |
> | **OPERACIONES** (1 → 5) | `operaciones: ver/crear`, y mirar `comercial` e `imprenta` |
> | **IMPRENTA** (0 → 3) | `imprenta: ver/crear` y mirar `operaciones`. **Sin `aprobar`** |
> | **FINANZAS** (0 → 4) | `finanzas: ver/crear/**facturar**` y el tablero |
>
> `facturar` para FINANZAS es **dinero irreversible (R4)** y va por decisión
> expresa: un Finanzas que no puede facturar obliga al Dueño a hacer el trabajo
> diario, y eso acaba con todo el mundo entrando como Dueño — que es peor. La
> traza de quién facturó no cambia. `CLIENTE` sigue fuera, por el ADR 0010.

> [!warning] Esto AMPLÍA permisos en instancias que ya existen
> La migración es aditiva, así que al actualizarse desarrollo y el droplet
> **ganan filas**. No es un efecto colateral: es la decisión. Pero conviene
> decirlo antes, no descubrirlo después en un tablero de producción.

Lo fija `apps/web/lib/test/permisos-semilla.e2e.test.ts` (6 casos, dos bases
desechables): la receta completa deja **41 · 9 · 5**, el reparto por perfil es
24/5/5/3/4, reaplicar las dos migraciones no duplica, una base que ya las tenía
no cambia, y —el que importa— un Dueño recién creado obtiene sus **nueve**
módulos **a través de `permisosDeRol`**, que es la función de la que cuelgan
`/api/auth/login`, `/api/auth/me` y `/api/estado`. Al Dueño ya no le queda **ni
un área cerrada**.

## Antes de aplicar en producción

Del `Runbook_Deploy_Fase1_Arrendadores.md` y `DESPLIEGUE_GOOGLE.txt`:

1. **Respaldo** `pg_dump` comprimido, con nombre y hora.
2. **Ensayo en rollback**: correr la migración dentro de una transacción que
   termine en `ROLLBACK` y comprobar salida 0.
3. Aplicar con `ON_ERROR_STOP=1`.
4. **Verificar el resultado**, no solo que no diera error (p. ej. `rls=t`,
   `force=t`, la función creada).
5. Anotar en una nota `DESPLIEGUE_*.txt` que ya se ejecutó, con la hora.

## Orden de despliegue

> [!warning] Migración primero, código después
> ADR 0009 lo deja escrito: al revés, el código lee columnas que no existirían.
> La excepción es una función **apagada por flag** (caso de Google), donde el
> código pudo viajar antes porque, apagado, nada tocaba la tabla nueva — y eso
> **se comprobó expresamente** antes de desplegar.

## Relacionadas
[[esquema]] · [[multi-tenancy-y-rls]] · [[entorno-y-despliegue]] ·
[[zonas-de-riesgo]] · [[convenciones]] · [[MOC-Proyecto]]

---
tipo: datos
estado: verificado
actualizado: 2026-08-17
tags: [datos, migraciones, despliegue, rojo]
archivos:
  - db/migrations/
  - db/schema.sql
  - scripts/migrar.mjs
  - scripts/migrar.test.ts
  - apps/web/lib/test/db-e2e.ts
  - apps/web/lib/test/migraciones.e2e.test.ts
  - apps/web/lib/test/reaplicacion.e2e.test.ts
  - db/migrations/20260805_objetos_solo_en_prod.sql
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

## Cómo funciona

- **68 archivos** en `db/migrations/`, nombrados `YYYYMMDD_descripcion.sql`.
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
| `tipo` | `esquema` o `datos`, para que el runner omita las de datos como hace `deploy.yml:141-148` |

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
que el runner lo aplique todo.

## El runner (`scripts/migrar.mjs`)

Es lo que corre una instancia al actualizarse (lo invocará `update.sh`, F3.4).
Sustituye al bucle de `deploy.yml:141-148`, que reaplica **todas** las
migraciones en cada despliegue y no deja registro.

```
DATABASE_URL=postgresql://usuario:clave@host:puerto/base node scripts/migrar.mjs
                                                          node scripts/migrar.mjs --pendientes  # lista, no aplica
                                                          node scripts/migrar.mjs --con-datos   # incluye las @tipo: datos
```

| Decisión | Por qué |
|---|---|
| **`DATABASE_URL` obligatoria**: sin ella aborta con salida 1 | Desviación consciente de `apply-migration.mjs:16-24`, que cae en un default local. Ese default es la base de **desarrollo con datos reales**, cuyo rol `spaces` es superusuario con `BYPASSRLS`. Es lo que T-02 le quitó a `bootstrap-auth.mjs`, y aquí pesa más: este script ejecuta **DDL** |
| Solo imprime `host:puerto/base` | El destino se registra **sin credenciales**, igual que `apply-migration.mjs:28-37` |
| Sin registro previo = instancia nueva | La tabla la crea una migración más; el runner **no duplica su DDL**. Lo aplicado antes de que la tabla exista se registra en cuanto aparece |
| Cada archivo con **su propia transacción** | Los `.sql` traen su `begin; … commit;`; envolverlos en otra no anida, y el `commit` de dentro cerraría el de fuera. Si uno falla, se aborta **sin registrarlo** y con el nombre del archivo en el error (salida 2) |
| Las `@tipo: datos` se **omiten** y se nombran | Mismo criterio que `deploy.yml:151-159`: reescriben filas y no se deshacen solas. Pero una migración que no se aplica y que nadie menciona es una que se olvida |
| El tipo se lee de la **primera línea** | `20260812_schema_migrations.sql` **menciona** la cadena `-- @tipo: datos` en su prosa (`:44` y `:168`). Un filtro por «el archivo contiene la marca» se saltaría, en silencio, justo la migración que crea la tabla de registro. Lo ancla `scripts/migrar.test.ts` |

> [!warning] El runner NO levanta una base virgen él solo
> `20260729_licencias_permisos.sql:96-97` aborta si no existe un rol de
> aplicación con grants, y **13 migraciones** dependen de ese rol. La secuencia
> real de una instancia es **crear el rol de app → `schema.sql` → migraciones**,
> y de las dos primeras hoy no se encarga nadie: `Dockerfile:94-95` copia solo
> `db/schema.sql` y `db/migrations`, y `db/dev-rol-app.sql` no viaja en la
> imagen (además es de desarrollo: en producción el rol es `spaces_user`).
> `recrearEsquema()` lo resuelve aplicando `dev-rol-app.sql` primero, y la prueba
> de la base vacía reproduce ese mismo prólogo. Queda abierto para el
> aprovisionamiento (Fase 5).

> [!danger] El ASSERT de `20260812_schema_migrations.sql:221-223` y este runner
> Ese ASSERT comprueba `archivo >= '20260812'` sobre **toda** la tabla, sin
> distinguir una fila del backfill de una que ponga legítimamente el runner. En
> cuanto el runner registre `20260812_schema_migrations.sql` o
> `20260812_sin_default_tenant.sql`, **reaplicar esa migración aborta** — y
> `deploy.yml:141-148` reaplica todas en cada despliegue. Hoy no se dispara
> (nadie corre el runner en el droplet todavía), y se retira con `deploy.yml` en
> F3.6. Si alguien corre el runner contra el droplet antes de eso, el siguiente
> despliegue por el workflow viejo abortará con un mensaje que además miente
> sobre la causa.

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
> En el droplet estas migraciones están registradas por el backfill con el valor
> literal `'backfill'`, y `20260812_schema_migrations.sql:51-56` declara que esa
> marca existe *«para que la comprobación de integridad de F3.3 se las salte a
> conciencia»*. Como el checksum de origen nunca se guardó, no hay nada con lo
> que comparar y no hay alarma que disparar.

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
| `20260812_sin_default_tenant.sql` | Retira el `DEFAULT` de `tenant_id` de las 23 tablas — **escrita, NO aplicada en producción** (eso es F1.2 → F1.5) |
| `20260812_schema_migrations.sql` | Nace la tabla de control y su backfill (F3.1) — **escrita, NO aplicada en producción**. Va **antes** que `sin_default_tenant` por orden lexicográfico (`c` < `i`), que es justo el orden que se quiere: así el runner registra las 65 históricas y aplica de verdad la de F1.2 |

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

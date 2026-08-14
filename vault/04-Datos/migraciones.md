---
tipo: datos
estado: verificado
actualizado: 2026-08-14
tags: [datos, migraciones, despliegue, rojo]
archivos:
  - db/migrations/
  - db/schema.sql
  - apps/web/lib/test/db-e2e.ts
  - db/migrations/20260805_objetos_solo_en_prod.sql
---

# Migraciones

> [!danger] ZONA ROJA
> Una migración ya aplicada en producción **no se edita nunca**. Se escribe una
> nueva. Ver [[zonas-de-riesgo]].

## Cómo funciona

- **68 archivos** en `db/migrations/`, nombrados `YYYYMMDD_descripcion.sql`.
- Se aplican en **orden lexicográfico** del nombre.
- **Ya existe tabla de control**, `schema_migrations`, pero **todavía no en
  producción**: la crea `20260812_schema_migrations.sql`, escrita el 14/08 y sin
  aplicar (ver abajo). Hasta que se aplique, el registro de qué corrió sigue
  siendo las notas `DESPLIEGUE_*.txt` de la raíz. Herramienta de migraciones
  (`migrate`, Prisma Migrate) no hay ninguna: el runner propio es F3.2.
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
entera: son idempotentes y no romperían, pero el registro nacería mintiendo.

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

## Dos migraciones cuyo nombre miente sobre el orden

`db-e2e.ts` mantiene un mapa `ANTES_DE` con las excepciones. **Si aplicas por
orden alfabético a ciegas, estas dos fallan:**

| Debe ir ANTES | Que | Por qué |
|---|---|---|
| `20260720_hard1_usuarios_rls.sql` | `20260720_hard1_rls_todas_tablas.sql` | La segunda comprueba que `usuarios` ya tenga RLS+FORCE, y la pone la primera (`r` < `u`) |
| `20260727_contrato_incompleto_enum.sql` | `20260727_contrato_incompleto.sql` | La segunda usa el valor `'INCOMPLETO'`, y lo añade la primera (`.` < `_`) |

No se renombraron a propósito: *«renombrar migraciones ya aplicadas confunde a
quien compare el repo con lo desplegado»* (`db-e2e.ts`).

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

---
tipo: datos
estado: verificado
actualizado: 2026-08-13
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

- **67 archivos** en `db/migrations/`, nombrados `YYYYMMDD_descripcion.sql`.
- Se aplican en **orden lexicográfico** del nombre.
- **No hay tabla de control de migraciones** ni herramienta (`migrate`, Prisma
  Migrate). El orden lo da el nombre y el registro de que se aplicaron son las
  notas `DESPLIEGUE_*.txt` de la raíz.
- En producción se aplican **a mano como `postgres`**:
  ```
  sudo -u postgres psql -d spaces_prod -v ON_ERROR_STOP=1 -f <archivo>.sql
  ```
- El arnés de pruebas las reaplica todas desde cero
  (`apps/web/lib/test/db-e2e.ts`, `recrearEsquema()`).

> [!warning] Sin tabla de control, el estado real solo se sabe mirando la base
> No hay forma de preguntarle al repo qué está aplicado. Ver
> [[preguntas-abiertas]].

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

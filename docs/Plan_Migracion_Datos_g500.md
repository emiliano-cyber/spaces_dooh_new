# Plan · Migración de los datos de g500 del droplet viejo a su instancia

- **Fecha:** 2026-09-09
- **Estado:** **aprobado para ejecución** por Emiliano (2026-09-09)
- **Alcance:** los datos de **una sola** organización — `g500` — desde
  `209.97.146.136` (`spaces_prod`) hasta la instancia `g500.space-os.io`
  (`142.93.113.106`)
- **Riesgo:** 🔴 **ROJO por tres vías a la vez** — tenant (R2), dinero (R4) y
  migraciones (R3). Ninguna etapa se ejecuta sin aprobación humana explícita.
- **Relacionados:** [ADR 0022](adr/0022-instancia-dedicada-por-owner.md) ·
  [ADR 0023](adr/0023-el-droplet-viejo-sale-del-modelo.md) — **se sustituye su
  punto 2**, ver §7 — ·
  [ADR 0028](adr/0028-google-obligatorio-y-la-contrasena-para-los-cambios.md) ·
  `docs/evidencias/f4-1-censo-resultado.md` ·
  `vault/07-Agentes/diario/2026-09-09.md`

> [!warning] Esto **no** es el Plan de Instancias Soberanas v3
> El plan vigente de la flota sigue siendo `docs/Plan_Instancias_Soberanas_v3.md`
> y este documento **no lo sustituye ni le añade tareas**. Es un plan de traslado
> de datos, con vida propia y final propio: cuando g500 tenga sus datos dentro,
> este documento se cierra. Si alguien cuenta tareas del plan de la flota, aquí
> no hay ninguna.

---

## 1 · Lo que se midió antes de escribir esto

| | Droplet viejo `209.97.146.136` | Instancia g500 `142.93.113.106` |
|---|---|---|
| Código | commit `504b4fc` · 2026-08-11 | imagen `v0.4.1` · 2026-09-09 |
| Migraciones | **66** | **78 aplicadas + 1 de datos pendiente** |
| Base | `spaces_prod` · 5 organizaciones | la de la instancia · **1**, nacida hoy |
| Proceso | `next start` desde el repo clonado | contenedor + `update.sh` |
| Organizaciones | `rgb`, `telcel`, `g500`, `eyro`, `demo-owner` | la del alta de hoy |

Evidencia: `docs/evidencias/f4-1-censo-resultado.md` (censo del 25/08, solo
lectura) y `vault/07-Agentes/diario/2026-09-09.md:23-40` (el alta de hoy, con sus
tiempos).

**Son 13 migraciones de diferencia**, y esta es la lista exacta:

```
20260812_schema_migrations            20260819_semilla_rol_permisos
20260812_sin_default_tenant           20260820_catalogo_permisos_completo
20260820_grants_rol_app               20260824_grants_tablas_futuras
20260825_sesion_metodo                20260826_clientes_rfc_unico
20260828_reautenticacion_por_defecto  20260901_doohmain_tracking
20260907_codigos_recuperacion         20260907_codigos_vistos
20260907_solo_google
```

66 + 13 = 79, que cuadra con las 78 + 1 de datos de la instancia. La de datos
(`@tipo: datos`) no la aplica `update.sh` a propósito (`scripts/migrar.mjs:7`).

### Las cuatro que deciden el diseño

1. **`20260812_sin_default_tenant.sql`** retira el `DEFAULT` de `tenant_id` que
   apuntaba a RGB. **El droplet viejo todavía lo tiene**, y es la causa de que
   haya filas de g500 etiquetadas como `rgb`. Un `where tenant_id = g500` las
   dejaría atrás **sin que nada avise**.
2. **`20260810_arrendadores_rfc_unico.sql`** y
   **`20260826_clientes_rfc_unico.sql`** añaden unicidad de RFC, que en julio no
   existía.
3. **`20260907_solo_google.sql`** nace en `false` para todos, así que los
   usuarios migrados **sí pueden entrar con su contraseña** — permitido por el
   punto 3 del ADR 0028 para usuarios normales, no para el Dueño (§4.3).
4. **`20260812_schema_migrations.sql`** es la que hace posible el puente: el
   runner detecta una base *con historia y sin registro* y dice exactamente qué
   hacer (`scripts/migrar.mjs:513-528`). El puente es un camino soportado, no una
   improvisación.

## 2 · Las decisiones que ya están tomadas

Tomadas por Emiliano el 2026-09-09, en conversación. Se escriben aquí para que no
se vuelvan a deducir:

| Decisión | Valor | Consecuencia |
|---|---|---|
| **Alcance** | **Solo `g500`** | `rgb`, `telcel`, `eyro` y `demo-owner` no viajan. La máquina de un cliente no contiene datos de otras organizaciones |
| **Personas** | **Todo: usuarios, roles y hashes** | Compatible con el ADR 0028 salvo para el Dueño (§4.3) |
| **Camino** | **Base puente en la máquina local** | La adaptación de esquema la hace `migrar.mjs`, que ya está probado, y no el criterio de nadie |
| **Cuentas DigitalOcean** | **Distintas en cada droplet** | No hay snapshot ni red privada entre las dos. El dump pasa por el equipo local **de todos modos**: eso es lo que abarata el puente |

## 3 · Las cuatro etapas

Cambia de manos tres veces. **Ningún comando contra un servidor lo corre un
agente**: las etapas 1 y 4 son tarjetas para una persona.

| # | Etapa | Dónde | Quién | Escribe |
|---|---|---|---|---|
| **E1** | `pg_dump -Fc` + descarga al equipo local | droplet viejo | **persona** | nada: **solo lectura** |
| **E2** | restaurar en `spaces_puente`, migrar a la versión del cliente, **censar** | equipo local, Postgres del 5433 | agente | solo la base local |
| **E3** | empaquetar el `.sql` de carga transformado | equipo local | agente | un archivo |
| **E4** | respaldo previo → cargar → comprobar | instancia g500 | **persona** | la base del cliente |

### E1 · Sacar los datos (tarjeta)

Tarjeta: **`docs/evidencias/migracion-g500-E1-dump.txt`**, con copia en
`C:\Users\Server\Downloads\`.

Solo lectura sobre el droplet viejo. Empieza **comprobando la identidad de la
máquina**, porque el 24/08 se censó entera la máquina equivocada
(`f4-1-censo-resultado.md` §1). Además de la base, la tarjeta recoge **qué
variables `DO_SPACES_*` están definidas** — solo los nombres, nunca los valores —
porque eso decide el punto 5 del censo y es lo único que no se puede averiguar
desde el puente.

**Criterio de aceptación:** el archivo `.dump` en el equipo local, con su
`sha256` coincidiendo con el calculado en el servidor.

> Con esto, el droplet viejo queda **fuera del asunto para siempre**. Es el único
> momento de todo el plan en que se le habla.

### E2 · El puente y el censo

```bash
cd db && docker compose up -d                 # Postgres del 5433
createdb  -h localhost -p 5433 -U postgres spaces_puente
pg_restore -h localhost -p 5433 -U postgres -d spaces_puente <archivo>.dump
psql "<url-puente>" -v ON_ERROR_STOP=1 -f db/migrations/20260812_schema_migrations.sql
DATABASE_URL="<url-puente>" node scripts/migrar.mjs
```

La base del 5433 es de pruebas y se recrea sin preguntar (corrección del 19/08,
`CLAUDE.md` §4). El guard del arnés no aplica aquí: la base no se llama `_e2e` ni
`_test`, y **no se usa `recrearEsquema()`** — nadie hace `drop schema`.

**Criterio de aceptación:** `migrar.mjs` termina informando **79 aplicadas** (o
78 + 1 de datos pendiente, igual que la instancia), y el censo del §4 queda
escrito en `docs/datos/`.

### E3 · Empaquetar

Un solo `.sql`, **transaccional**: entra completo o no entra nada. Las reglas de
transformación son las siete del §4.

**Criterio de aceptación:** el `.sql` aplicado sobre una **copia** del estado de
la instancia (reconstruible en local desde `db/schema.sql` + migraciones +
bootstrap) da los mismos recuentos por tabla que el censo del puente.

### E4 · Cargar (tarjeta)

Se emite **cuando el censo esté revisado**, no antes. Orden fijo:

1. `respaldo.sh` en la instancia, **y bajar el dump al equipo local** — esa
   instancia no tiene `SPACES_KEY`/`SPACES_SECRET`, así que el respaldo se
   quedaría en el propio droplet (deuda anotada en el diario del 09/09).
2. Subir el `.sql` y aplicarlo con `ON_ERROR_STOP=1`.
3. Comprobar: recuentos por tabla contra el censo, `GET /api/auth/metodos/` a 200
   con `{"google":true}`, y un login del Dueño.

**Disparadores de vuelta atrás** — cualquiera de los tres basta:

- un recuento por tabla que no cuadre con el censo;
- `/api/auth/metodos/` o el login que no respondan 200 después de la carga;
- cualquier error al aplicar el `.sql` (por eso va transaccional: su propio
  `rollback` es la primera línea de defensa, y el dump la segunda).

## 4 · Los siete chequeos del censo

Esto es el corazón de la validación local. Cada punto es una consulta contra el
puente, no una opinión, y cada uno tiene una acción asociada en E3.

| # | Qué se pregunta | Por qué importa | Qué hace E3 con la respuesta |
|---|---|---|---|
| 1 | **La deriva del `DEFAULT`**: filas de g500 etiquetadas como `rgb` | Es el fallo silencioso de R2: un `where tenant_id = g500` las deja atrás sin avisar | Se rescatan por criterio explícito, y queda escrito cuáles |
| 2 | **RFC repetidos** en `arrendadores` y `clientes` | Dos migraciones posteriores a julio los prohíben | Se resuelven en el puente, donde el fallo es gratis |
| 3 | **Folios**: `max()` usado por g500 frente a `folios_consecutivos.ultimo` | `PK (ambito, periodo)` con `ultimo integer` (`db/schema.sql:95-100`): sin adelantarlo, **la instancia reemite folios ya usados** | Se adelanta el contador del tenant destino |
| 4 | **Personas**: correos, roles, y si el Dueño viejo es el de hoy | El correo es de unicidad **global** (`20260720_hard1_usuarios_rls.sql`, `auth_email_existe`) | §4.3 |
| 5 | **Archivos**: cuántos `foto_key` no son nulos | `ot-repo.ts:44` usa Spaces si `DO_SPACES_*` está configurado, y ese bucket **está en la otra cuenta** | §4.4 |
| 6 | **Integridad referencial** dentro del recorte | Nada de g500 debe apuntar a filas de otro tenant | Se corta o se rescata, con la lista escrita |
| 7 | **Recuento por tabla** | Es el contrato de E4 | Se copia al `.sql` como comentario y se comprueba tras cargar |

### 4.1 · Cómo viaja el `tenant_id`

El destino se resuelve **por slug dentro del propio `.sql`** (`select id from
tenants where slug = 'g500'`). **Ningún UUID real se escribe en un archivo
versionado**, igual que no se queman dominios ni IPs (`CLAUDE.md`, §Corridas
nocturnas).

### 4.2 · Los `id` de las filas se conservan

Son `uuid`, no secuencias: no hay contadores que colisionen (`grep -n
"serial\|nextval" db/schema.sql` → sin resultados). Conservarlos mantiene las
cinco referencias a `usuarios` (`db/schema.sql:85,320,483,484,510,578`) y toda la
integridad interna del recorte.

### 4.3 · El Dueño

**El Dueño es el que nació hoy con Google, y es el único.**

- Si el Dueño viejo de g500 **es la misma persona** (mismo correo), no se inserta
  una fila nueva: se **remapea su `id`** en los datos importados al `id` del
  usuario de hoy. El correo es de unicidad global, así que duplicar no es una
  opción.
- Si **es otra persona**, entra con su rol funcional y el Dueño de hoy lo
  promueve desde la aplicación si quiere.

**El motivo es el ADR 0028:** una cuenta de máximo privilegio que abre con
contraseña es exactamente lo que ese ADR retiró, y `solo_google` nace en `false`
(`20260907_solo_google.sql:32`). Importar un segundo `DUENO` con hash sería
reabrir esa puerta por la espalda.

### 4.4 · Los archivos, si están en un bucket

Si el censo encuentra `foto_key` poblados, **falta una etapa que este plan no
cubre todavía**: copiar los objetos del bucket de la cuenta vieja al de la nueva.
Se decide con el número delante. Si están como base64 en la propia base, viajan
en el dump y no hay nada que hacer.

## 5 · Los invariantes que no se tocan

- **`apps/web/lib/test/aislamiento.e2e.test.ts`** no se abre. Si algo de este
  plan obligara a abrirlo, el plan está mal.
- **`db/schema.sql` no se edita.** Aquí no hay cambio de esquema: es un traslado
  de datos.
- **Nada de `ssh`, `scp`, `psql`, `curl` ni `doctl` contra un servidor por parte
  de un agente.** E1 y E4 son tarjetas para una persona.
- **Ningún secreto en el diff.** Y ningún valor real quemado **en el `.sql` de
  carga ni en ningún script**: el tenant destino se resuelve por slug (§4.1), y
  las credenciales no se escriben en ninguna parte. Este documento sí nombra las
  dos máquinas y el dominio, igual que los demás expedientes de `docs/`: la
  regla de `CLAUDE.md` §Corridas nocturnas es sobre artefactos que se ejecutan,
  no sobre la prosa que los explica.

## 6 · Qué queda escrito al terminar

- **ADR 0031**, que sustituye el punto 2 del ADR 0023 (§7).
- **`docs/datos/`**: el censo, y el rollback capturado **antes** de cargar, que es
  la convención para cambios de datos en una base de cliente
  (`docs/datos/README.md`).
- **`docs/Registro_Cambios.md`**: se nota desde la aplicación —g500 pasa de una
  instancia vacía a su inventario completo—, así que lleva entrada en lenguaje
  llano.
- **La nota de la bóveda en el mismo commit**, y el diario del día.

## 7 · Por qué esto no contradice el ADR 0023, sino que lo sustituye

El punto 2 del ADR 0023 dice: *«No se exporta ni se respalda su base»*, y lo
sostiene en una premisa explícita — que `rgb`, `telcel`, `g500`, `eyro` y
`demo-owner` son datos de prueba y **no hay ninguna organización real que migrar
(`F7.2`)**.

**Esa premisa caducó** el día que g500 tuvo instancia propia, con su dominio y su
Dueño (2026-09-09). El ADR no se ignora: se **reemplaza por el ADR 0031**, que
recoge el hecho nuevo y limita el rescate a una sola organización. Lo demás del
ADR 0023 sigue vigente: el droplet viejo sale del modelo, no recibe despliegues,
y de él solo se lee una vez.

> Este expediente lleva seis decisiones en cinco días sobre esta misma máquina
> (ADR 0015 → 0016 → 0017 → 0020 → 0021 → 0023). El costo no vino de cambiar de
> idea: vino de rellenar por deducción lo que no se decidía. Por eso esto se
> escribe antes de tocar nada.

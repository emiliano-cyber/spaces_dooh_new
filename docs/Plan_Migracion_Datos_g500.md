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
| **Personas** | **NO viajan** — ni usuarios, ni credenciales, ni sesiones | El equipo lo invita el Dueño desde la instancia. Cuatro columnas de «quién» llegan en nulo (§4.3) |
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

**Criterio de aceptación:** `migrar.mjs` termina informando **78 aplicadas + 1 de
datos pendiente**, igual que la instancia, y el censo del §4 queda escrito.

> [!success] **E2 CERRADA el 2026-09-09** — `docs/evidencias/migracion-g500-E2-censo.md`
> Restauración con **0 errores**, recuentos **idénticos** a la foto del servidor,
> backfill de **65** y **13 aplicadas** → **78**, el mismo estado que la
> instancia. Consultas en `migracion-g500-E2-censo.sql`.
>
> El censo va a **`docs/evidencias/`** y no a `docs/datos/` como decía este plan:
> `docs/datos/` es para scripts de corrección con su rollback
> (`docs/datos/README.md`), y un censo no corrige nada. Lo que sí irá ahí es el
> `.sql` de carga de E4.

### E3 · Empaquetar

Un solo `.sql`, **transaccional**: entra completo o no entra nada. Las reglas de
transformación son las siete del §4.

**Criterio de aceptación:** el `.sql` aplicado sobre `spaces_destino` —la copia
del esquema de la instancia reconstruida en E2 desde `db/schema.sql` +
`migrar.mjs --instalacion-nueva`— da los mismos recuentos por tabla que el censo
del puente.

> [!success] **E3 CERRADA el 2026-09-09** — `docs/datos/20260909_carga_g500.md`
> **541 filas** (no 717: la bitácora se quedó fuera, ver abajo), más la
> actualización de `config_negocio` y los 8 contadores de folio. Cinco ensayos
> en verde: carga sobre organización recién nacida · carga sobre instancia **con
> Dueño, configuración y bitácora propia** (los tres intactos) · segunda pasada
> **rechazada** · vuelta atrás · y recarga después de la vuelta atrás.
>
> **`acciones` no viaja, y lo decidió la base.** Tiene un trigger
> `BEFORE DELETE OR UPDATE` que la hace append-only, así que cargarla dejaba
> esta operación sin marcha atrás en el sitio. Decidido por Emiliano con el
> contenido delante: 175 filas de `Sistema` y del usuario `DEMO`.
>
> El archivo de carga **no se versiona** —8.5 MB de datos comerciales de un
> cliente— pero sí los cuatro que lo generan y el rollback.

> [!danger] Probarlo contra el puente NO vale, y esto lo midió E2
> El puente y el destino tienen **las mismas 524 columnas** pero **no los mismos
> índices**: el destino trae **tres restricciones que el droplet viejo nunca
> tuvo** porque solo viven en `schema.sql` (§4 del censo). Los datos de g500 las
> cumplen las tres, pero un `.sql` probado únicamente contra el puente no habría
> comprobado ninguna.

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
| 4 | **Huérfanos de persona**: cuántas filas de g500 apuntan a un usuario | Las personas no viajan (§4.3): hay que saber cuántas OT e incidencias llegan sin dueño antes de cargarlas, no después | Se ponen en nulo, y el número queda escrito |
| 5 | **Archivos**: cuántos `foto_key` no son nulos | `ot-repo.ts:44` usa Spaces si `DO_SPACES_*` está configurado, y ese bucket **está en la otra cuenta** | §4.4 |
| 6 | **Integridad referencial** dentro del recorte | Nada de g500 debe apuntar a filas de otro tenant | Se corta o se rescata, con la lista escrita |
| 7 | **Recuento por tabla** | Es el contrato de E4 | Se copia al `.sql` como comentario y se comprueba tras cargar |
| 8 | **¿Puente y destino tienen el mismo esquema?** — añadido tras medirlo | El registro de migraciones puede decir «78» en las dos bases y los esquemas diferir: `schema.sql` y la cadena de migraciones evolucionaron por separado | Se reconstruye el destino en local y se comparan columnas, índices y restricciones |

> [!success] Los ocho, contestados el 2026-09-09 · `docs/evidencias/migracion-g500-E2-censo.md`
> **1 · La deriva existe y es grave:** las **12** modalidades de venta de las 12
> pantallas de g500 están etiquetadas `rgb`. Un export por `where tenant_id`
> habría entregado las pantallas **sin un solo precio**, sin error. Se rescatan
> por `sitio_id`.
> **2 · RFC:** 0 duplicados, y las dos migraciones con guard pasaron limpias.
> **3 · Folios:** 8 contadores, y `folios_consecutivos` **no tiene `tenant_id`**
> —el comentario de `db/schema.sql:102-103` dice lo contrario y está mal—; se
> copian tal cual porque son cotas superiores.
> **4 · Huérfanos:** la única OT de g500 ya no tenía responsable ni supervisor;
> se pierde un `uploaded_by`.
> **5 · Archivos:** 1 evidencia, **62 kB** de base64, **0** en bucket.
> **6 · Integridad:** sin dependencias ocultas.
> **7 · Recuento:** **717 filas**.
> **8 · Esquema:** 524 = 524 columnas, pero **3 restricciones solo en el
> destino**. Los datos de g500 las cumplen las tres.

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

### 4.3 · Las personas no viajan — y qué se pierde con eso

**Decidido por Emiliano el 2026-09-09**, corrigiendo lo que este mismo documento
dijo primero: **viaja todo menos las personas.** No viajan `usuarios`,
`identidades_externas`, `codigos_recuperacion`, `password_resets` ni `sesiones`.
Los tres usuarios de g500 en el droplet viejo se quedan ahí, y el equipo lo
invita el Dueño desde la instancia.

Efecto secundario que conviene: **desaparece toda la fricción con el ADR 0028.**
No hay un segundo `DUENO` que llegue con hash, así que no hay ninguna cuenta de
máximo privilegio que abra con contraseña. El Dueño es el que nació hoy con
Google, y es el único.

**Lo que se pierde, exactamente cuatro columnas** — las cinco referencias a
`usuarios` son `on delete set null`, así que los datos entran y la columna queda
en nulo:

| Columna | Qué se deja de saber |
|---|---|
| `incidencias.reportado_por_usuario` | quién reportó la incidencia |
| `ordenes_trabajo.asignado_a` | a quién estaba asignada la OT |
| `ordenes_trabajo.supervisor` | quién la supervisaba |
| `evidencias_ot.uploaded_by` | quién subió cada evidencia |

Las OT llegan completas —sitio, tipo, estado, fechas y fotos—, solo sin la
persona. **Y la bitácora sí sobrevive:** `acciones` guarda `usuario_nombre` como
texto además del `usuario_id` (`db/schema.sql:574-580`, con `default 'Sistema'`),
así que la historia se sigue leyendo con el `id` en nulo.

### 4.5 · Qué tabla viaja y qué tabla no

| | Tablas | Motivo |
|---|---|---|
| **Viaja** | `sitios`, `sitio_modalidades`, `predios`, `licencias` | las pantallas y sus modalidades de venta |
| | `arrendadores`, `arrendador_razon_social`, `contratos_arrendamiento`, `contrato_firmas`, `pagos_renta` | el lado del arrendamiento |
| | `clientes`, `propuestas`, `propuesta_items`, `campanas`, `reservas`, `creatividades`, `ordenes_compra` | el lado comercial |
| | `ordenes_trabajo`, `evidencias_ot`, `incidencias`, `ordenes_impresion` | operaciones |
| | `facturas`, `cobranzas` | dinero — R4, revisión fila por fila |
| | `almacen_activos`, `almacen_movimientos`, `media_uploads`, `notificaciones` | inventario, archivos y avisos |
| | `config_negocio` | la configuración de la organización: se **actualiza** la fila del destino, con el antes/después en el censo |
| | `doohmain_*` | solo si tienen filas de g500; lo dice el censo |
| **No viaja** | `usuarios`, `identidades_externas`, `codigos_recuperacion`, `password_resets`, `sesiones` | decisión del §4.3 |
| | **`acciones`** | **append-only por trigger**: cargarla dejaba la operación sin marcha atrás en el sitio. Decidido el 09/09 en E3 |
| | `rol_permisos` | el destino tiene el catálogo del 20/08, más nuevo que el de julio |
| | `tenants`, `schema_migrations` | infraestructura de la instancia, no dato de negocio |
| | `folios_consecutivos` | no se copia la fila: se **adelanta** el contador del destino (§4, chequeo 3) |

La lista se **confirma contra el puente** en E2, tabla por tabla y con recuentos.
Esta tabla es la intención; el censo es la medición.

### 4.4 · Los archivos — **CERRADO en E1: no hay bucket**

Medido el 2026-09-09 en el droplet viejo, con dos fuentes que coinciden: el
proceso que sirve la aplicación **no tiene ninguna variable `DO_SPACES_*`**, y
`/var/www/Spaces/apps/web/.env.production` devuelve **0** al contarlas. Sin esas
variables, `storageHabilitado()` es falso (`lib/server/storage.ts:18`) y las
fotos se guardan **como base64 en la propia base** (`ot-repo.ts:39-44`).

**Consecuencia: viajan en el dump y no hay etapa extra.** La copia de objetos
entre cuentas de DigitalOcean —que era el riesgo de este apartado— no existe.

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

## 6-bis · Lo que E1 midió en el droplet viejo (2026-09-09)

Ejecutado por Emiliano desde la consola web, con la tarjeta delante. Todo esto
son hechos medidos, no supuestos del plan:

| Dato | Valor | Corrige |
|---|---|---|
| Identidad | `PIXELED-ubuntu-s-2vcpu-4gb-nyc3` / `209.97.146.136` | GATE 1 en verde |
| Ruta de la aplicación | **`/var/www/Spaces`** | la tarjeta suponía otra; el `README` de la raíz dice `/var/www/spaces-dooh` y **está mal** |
| Archivo de entorno | **`apps/web/.env.production`** (y 12 respaldos `.bak.*`) | no existe `.env` ni `.env.local` |
| `DO_SPACES_*` | **ninguna** | §4.4 queda cerrado |
| Bases | solo `spaces_prod` | — |
| Organizaciones | 5, todas de julio | como decía el censo del 25/08 |
| `schema_migrations` | **`NO EXISTE`**, y **66** migraciones en disco | confirma el camino del puente (`migrar.mjs:513-528`) |
| Tamaño del dump | **7.3 MB** | — |

**Filas por organización**, la foto de referencia contra la que se compara el
puente:

| | sitios | arrendadores | campañas | facturas | usuarios |
|---|---|---|---|---|---|
| **g500** | **12** | **5** | **7** | **3** | 3 (no viajan) |
| eyro | 8 | 3 | 6 | 4 | 3 |
| rgb | 0 | 0 | 0 | 0 | 3 |
| telcel | 0 | 0 | 0 | 0 | 1 |
| demo-owner | 0 | 0 | 0 | 0 | 0 |

> **`rgb` tiene 0 sitios y 3 usuarios.** O sea que las filas de la deriva del
> `DEFAULT` **no están en `sitios`**: hay que buscarlas más abajo, en
> `sitio_modalidades` y en las tablas hijas. Es el chequeo 1 del §4, y esta tabla
> ya dice dónde mirar.

### Lo que E1 dejó tocado en el servidor, y hay que deshacer

Al recuperar el acceso —la contraseña de `root` se había perdido y la llave de la
consola web de DigitalOcean (`dotty_ssh`) **caducó a las 11:38**— se añadió una
llave a `/root/.ssh/authorized_keys`. **Eso es un cambio en el servidor**, el
único de toda la etapa E1, y es reversible borrando esa línea.

Queda anotado aquí porque el plan prometía que E1 no escribía nada, y escribió
esto. Cuando el traslado termine, la llave se retira.

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

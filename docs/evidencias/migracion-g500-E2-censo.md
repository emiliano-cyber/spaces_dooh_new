# E2 · Censo de la base puente — **CERRADA**

- **Fecha:** 2026-09-09
- **Plan:** `docs/Plan_Migracion_Datos_g500.md`, etapa E2 de 4
- **Ejecutado por:** agente, en la máquina local. **Ningún servidor tocado.**
- **Base puente:** `spaces_puente` en el Postgres del 5433 (contenedor `spaces_db`)
- **Consultas:** `docs/evidencias/migracion-g500-E2-censo.sql`

> [!success] El titular
> **12 de las 12 modalidades de venta de las pantallas de g500 están etiquetadas
> como `rgb`.** Un export por `where tenant_id = g500` se habría llevado las 12
> pantallas **sin un solo precio**, sin dar ningún error. Es exactamente el modo
> de fallo de R2, y es lo que este censo existía para encontrar.

---

## 1 · El puente se levantó fiel

| Paso | Resultado |
|---|---|
| `pg_restore` del dump del droplet viejo | **0 errores** |
| Origen / destino de la restauración | PostgreSQL **16.15** → **16.14**, misma mayor |
| Recuentos tras restaurar | **idénticos** a la foto tomada en el servidor (B6 de E1) |
| Backfill `20260812_schema_migrations.sql` | **65** migraciones históricas registradas |
| `node scripts/migrar.mjs` | **13 aplicadas, 1 de datos pendiente** |
| Estado final del registro | **78 aplicadas** — el mismo que la instancia de g500 |

El runner reaccionó como el plan predijo: se negó a adivinar sobre una base con
historia y sin registro, y nombró el archivo del backfill
(`scripts/migrar.mjs:513-528`). No hubo que improvisar nada.

> **Chequeo 2 (RFC repetidos) quedó contestado por el camino.**
> `20260810_arrendadores_rfc_unico.sql` y `20260826_clientes_rfc_unico.sql`
> llevan un guard que **aborta nombrando a los culpables** si hay duplicados.
> Las dos se aplicaron limpias, y la consulta directa confirma **0**.

## 2 · La deriva del `DEFAULT`: 12 modalidades, todas de g500

El detector es genérico y no una lista escrita a mano: recorre **todas** las
claves ajenas donde madre e hija tienen `tenant_id` y cuenta las filas donde no
coinciden. Dos resultados en toda la base:

| Tabla hija | Por | Tabla madre | Desajustes |
|---|---|---|---|
| `sitio_modalidades` | `sitio_id` | `sitios` | **15** |
| `acciones` | `usuario_id` | `usuarios` | 12 |

De esas 15, **12 cuelgan de pantallas de g500**. Y `rgb` **no tiene ni una
pantalla propia** (0 `sitios`), así que ninguna de esas 15 filas es suya:

```
 tenant de la modalidad | modalidades de pantallas de g500
------------------------+----------------------------------
 rgb                    |               12
```

Las 12, con su precio, y con el nombre que no deja lugar a duda:

| Pantalla | Unidad | Tarifa publicada | Costo de compra | Etiquetada |
|---|---|---|---|---|
| AUTOPISTA MEX.-QRTO. #2998 ANTES SANTA MONICA - G500 | spot | 55 000.00 | 52 000.00 | `rgb` |
| AV. PALO SOLO #3515 - G500 | spot | 85 000.00 | 52 000.00 | `rgb` |
| BLVD. MAGNOCENTRO INTERLOMAS - CARA A - G500 | spot | 85 000.00 | 52 000.00 | `rgb` |
| BLVD. MAGNOCENTRO INTERLOMAS - CARA B - G500 | spot | 85 000.00 | 52 000.00 | `rgb` |
| CALZADA MEXICO TACUBA #610 - G500 | spot | 85 000.00 | 52 000.00 | `rgb` |
| GUSTAVO BAZ #83 - G500 | spot | 85 000.00 | 52 000.00 | `rgb` |
| JINETES 108 - G500 | spot | 85 000.00 | 52 000.00 | `rgb` |
| MANUEL DUBLAN 53 - G500 | spot | 85 000.00 | 52 000.00 | `rgb` |
| PATRIOTISMO Y PENSILVANIA - G500 | spot | 85 000.00 | 52 000.00 | `rgb` |
| REVOLUCION 267 - G500 | spot | 85 000.00 | 52 000.00 | `rgb` |
| RIO CONSULADO #2071 ESQ. PLOMO - G500 | spot | 85 000.00 | 52 000.00 | `rgb` |
| TLALPAN 985 - VILLA DE CORTES - G500 | spot | 85 000.00 | 52 000.00 | `rgb` |

**Criterio de rescate, y por qué no es una interpretación:** la fila viaja si su
`sitio_id` apunta a una pantalla de g500. No se decide por el nombre, ni por el
precio, ni por la fecha: se decide por la clave ajena, que es un hecho de la
base. Las 12 cumplen.

Las 12 de `acciones` no necesitan rescate: las personas no viajan (§4.3 del
plan), así que ese `usuario_id` se pone en nulo de todas formas.

### Lo que `rgb` guarda, para cerrar la duda

| Tabla | Filas de `rgb` |
|---|---|
| `acciones` | 28 |
| **`sitio_modalidades`** | **15** ← ninguna es suya |
| `notificaciones` | 6 |
| `usuarios` | 3 |
| `clientes` | 2 |
| `config_negocio` | 1 |

Sus 2 `clientes` **no los referencia ninguna campaña de g500** —lo dice el mismo
detector, que cubre el par `campanas → clientes`—, así que no hay nada más
escondido ahí. Se quedan.

## 3 · Lo que viaja, tabla por tabla

**717 filas.** Medido, no estimado:

| Tabla | Filas de g500 | | Tabla | Filas de g500 |
|---|---|---|---|---|
| `notificaciones` | 373 | | `arrendadores` | 5 |
| `acciones` | 175 | | `creatividades` | 4 |
| `pagos_renta` | 29 | | `facturas` | 3 |
| `propuesta_items` | 26 | | `ordenes_compra` | 3 |
| `reservas` | 26 | | `predios` | 3 |
| `cobranzas` | 15 | | `clientes` | 1 |
| `contratos_arrendamiento` | 13 | | `config_negocio` | 1 → **actualiza** |
| `sitios` | **12** | | `evidencias_ot` | 1 |
| **`sitio_modalidades`** | **12** ← rescatadas | | `ordenes_trabajo` | 1 |
| `campanas` | 7 | | | |
| `propuestas` | 7 | | | |

En cero, y por tanto sin nada que hacer: `almacen_activos`,
`almacen_movimientos`, `arrendador_razon_social`, `contrato_firmas`,
`incidencias`, `licencias`, `ordenes_impresion`, `doohmain_consultas_play`.

**No viajan:** los **3 `usuarios`** de g500 (§4.3), y `rol_permisos`, `tenants`
y `schema_migrations` por ser infraestructura de la instancia.

> **Los 3 usuarios de g500 son los tres `DUENO`.** No hay ningún usuario
> operativo que perder: no había comercial, ni operaciones, ni finanzas. El
> equipo lo invita el Dueño desde la instancia.

## 4 · El hallazgo que nadie había pedido: el esquema del destino es más estricto

El plan daba por hecho que, tras migrar, puente y destino tendrían el mismo
esquema. Se comprobó en vez de suponerlo: se reconstruyó el destino en local
(`db/schema.sql` + `migrar.mjs --instalacion-nueva`, que también termina en **78
aplicadas**) y se compararon las dos bases.

**Columnas: 524 y 524, sin una sola diferencia.** Pero los índices no:
**125 en el puente, 123 en el destino**, y tres restricciones que **el destino
tiene y el droplet viejo nunca tuvo** — porque viven solo en `schema.sql` y
ninguna migración las reparte:

| Restricción, solo en el destino | Qué habría hecho al cargar | Datos de g500 |
|---|---|---|
| `propuestas_token_publico_key` UNIQUE (`token_publico`) | dos propuestas con el mismo token abortan la carga | **0 duplicados, 0 nulos** en 7 propuestas ✅ |
| `sitios_max_clientes_check` (nulo o ≥ 1) | una pantalla con `max_clientes = 0` aborta | los **12** en nulo ✅ |
| `config_negocio_max_clientes_pantalla_check` | idem en la configuración | en nulo ✅ |

**Las tres pasan**, así que la carga no se rompe por ellas. Pero el hallazgo se
queda escrito porque es general: **el registro de migraciones puede decir «78»
en las dos bases y los esquemas no ser iguales.** `schema.sql` y la cadena de
migraciones evolucionaron por separado, y quien compare solo el contador no lo
ve. Cualquier traslado futuro entre una base con historia y una instancia nueva
tiene que repetir esta comparación.

Al revés hay tres índices que solo tiene el puente
(`doohmain_remote_campaigns.uniq_version`,
`doohmain_remote_lists.uniq_screen_list_media`, `media_uploads.uniq_media_version`).
El destino es más permisivo en eso y esas tablas no traen filas de g500: no
afectan.

### Y un defecto de documentación en un archivo de alto contacto

`db/schema.sql:102-103` afirma sobre `folios_consecutivos`:

> `-- ADR 0011: UNA FILA POR TENANT. tenant_id y su índice único se añaden más`
> `-- abajo, junto al bloque multi-tenant, porque tenants se declara después.`

**No es cierto.** Medido en las dos bases, las columnas de esa tabla son
`ambito, periodo, ultimo` y **no hay `tenant_id`** ni en el puente ni en el
destino reconstruido. El contador de folios es **de la instancia entera**, no por
organización. En el modelo de instancias soberanas eso da igual —una instancia,
una organización— pero el comentario manda a quien lo lea en la dirección
contraria.

## 5 · Los folios: ocho contadores, y son cotas superiores

`folios_consecutivos` en el puente, tal cual (compartido por las cinco
organizaciones, por lo de arriba):

| ámbito | periodo | último |
|---|---|---|
| campana | 20260707 | 2 |
| campana | 20260709 | 1 |
| campana | 20260714 | 2 |
| campana | 20260720 | 1 |
| campana | 20260728 | 7 |
| oc | 2026 | 8 |
| ot | 2026 | 2 |
| propuesta | 2026 | 12 |

Y los folios que g500 realmente usó:

| Tabla | Con folio | El más alto |
|---|---|---|
| `campanas` | 7 | `G50020260728969` |
| `propuestas` | 7 | `PR-877005` |
| `facturas` | 3 | `F001-CDE401E1` |
| `ordenes_compra` | 3 | `ODC-995C63` |
| `ordenes_trabajo` | 1 | `OT-2026-4237` |

**Decisión para E3: los ocho contadores se copian tal cual.** Al ser globales en
el origen, son mayores o iguales que lo que g500 gastó, así que copiarlos no
puede hacer que la instancia reemita un folio. Y hace falta: **las `UNIQUE` de
`folio` son globales** (`db/schema.sql:94`), no por organización, así que un
folio repetido no es un aviso, es una carga abortada.

## 6 · Lo que se pierde al no llevar las personas — y es poco

| Columna | Filas de g500 con valor |
|---|---|
| `acciones.usuario_id` | 172 de 175 |
| `evidencias_ot.uploaded_by` | 1 de 1 |
| `ordenes_trabajo.asignado_a` | **0** de 1 |
| `ordenes_trabajo.supervisor` | **0** de 1 |
| `incidencias.reportado_por_usuario` | 0 de 0 |

O sea: **la única OT de g500 no tenía responsable ni supervisor de todas
formas**, y no hay ninguna incidencia. Lo que de verdad se pierde es un
`uploaded_by` de una evidencia. La bitácora conserva su `usuario_nombre` en
texto, así que las 175 acciones se siguen leyendo.

## 7 · Las fotos: confirmado, no hay bucket

| | |
|---|---|
| Evidencias de OT de g500 | **1** |
| Con `foto_key` (o sea, en bucket) | **0** |
| Peso del base64 en la base | **62 kB** |

Coincide con lo medido en E1 (`DO_SPACES_*` ausentes). **La etapa de copiar
objetos entre cuentas de DigitalOcean no existe.**

## 8 · Integridad: no hay dependencias ocultas

De todas las claves ajenas que salen de una tabla con `tenant_id` hacia una
tabla **sin** `tenant_id`, solo hay dos, y las dos apuntan a `tenants`
(`config_negocio.tenant_id` e `identidades_externas.tenant_id`). En el destino
`tenants` ya existe con su organización. **Nada más que arrastrar.**

---

## Lo que E3 tiene que hacer, y ya está decidido con esto delante

1. **Rescatar las 12 modalidades** por `sitio_id`, no por nombre.
2. **Remapear `tenant_id`** al de la organización del destino, resuelto **por
   slug dentro del `.sql`** — ningún UUID escrito en un archivo versionado.
3. **`usuario_id`/`uploaded_by` a nulo** en las 173 filas que los traen.
4. **Copiar los 8 contadores de folio** tal cual.
5. **`config_negocio`: actualizar** la fila que ya existe en el destino, no
   insertar una segunda. El antes/después va en el archivo.
6. **Orden por claves ajenas**, y todo dentro de una transacción.
7. **Excluir** `usuarios`, `identidades_externas`, `codigos_recuperacion`,
   `password_resets`, `sesiones`, `rol_permisos`, `tenants` y
   `schema_migrations`.

**Y una comprobación nueva para E3, que este censo hace obligatoria:** el `.sql`
se prueba contra la base `spaces_destino` reconstruida aquí, que es la que tiene
las tres restricciones estrictas. Probarlo solo contra el puente no habría
detectado nada de la §4.

---

> [!important] Corrección posterior, el mismo día: **son 541 filas, no 717**
> Al construir E3, la base rechazó el borrado de `acciones`:
> `trg_acciones_append_only`, un trigger `BEFORE DELETE OR UPDATE` que la hace
> **append-only**. Cargar la bitácora dejaba la operación **sin marcha atrás en
> el sitio** —ni borrar para repetir, ni deshacer sin restaurar el respaldo
> entero—, así que **`acciones` se deja fuera**, decidido por Emiliano el
> 2026-09-09 con su contenido delante: de sus 175 filas, la mayoría son de
> `Sistema` y del usuario `DEMO`.
>
> **717 − 175 = 541 filas de negocio**, más la actualización de
> `config_negocio`. Los recuentos por tabla de la §3 siguen siendo válidos: lo
> único que cambia es que la fila de `acciones` no viaja.
>
> Se comprobó además que **ninguna otra tabla bloquea el borrado**: los otros
> cinco triggers de la base son de `UPDATE`. Detalle en
> `docs/datos/20260909_carga_g500.md`.

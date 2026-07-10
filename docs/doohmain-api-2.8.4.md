# Documentación de la API de Doohmain — v2.8.4

> Transcripción fiel de `doohmain-api-2.8.4.pdf` (mismo directorio), en texto plano
> para poder buscarla y diffearla entre versiones. Ante cualquier discrepancia, el
> PDF del proveedor es la fuente de verdad.
>
> Las **Observaciones** del final NO forman parte del documento original: son notas
> nuestras sobre huecos y erratas detectados al leerlo.

## Autenticación

Debe enviar el parámetro `api_key` con la key correspondiente.

Todas las operaciones cuelgan de un único endpoint, y la operación se elige con el
parámetro `action`:

```
https://app.doohmain.com/api/v1/index.php?action=<action>
```

## Crear campaña

`action=create_campaign`

| Parámetro | Descripción |
|---|---|
| `name` | Nombre de la campaña (**obligatorio**) |
| `cant_total` | Cantidad de reproducciones totales (default 0) |
| `cant_day` | Cantidad de reproducciones por día (default 0) |
| `cant_hour` | Cantidad de reproducciones por hora (default 0) |
| `auto_cant` | Repartir la cantidad de reproducciones a la hora (0 apagado, 1 encendido; default 0) |
| `status` | Estado de la campaña: `active`, `finished`, `pause`, `pending` |
| `start_date` | Fecha de inicio (`YYYY-MM-DD`) |
| `end_date` | Fecha de fin (`YYYY-MM-DD`) |
| `client` | Información del cliente: recibe un objeto/arreglo asociativo, o bien el id del cliente |

Datos de `client`:

| Campo | Descripción |
|---|---|
| `name` | Nombre del cliente (**obligatorio**) |
| `cuit` | CUIT del cliente |
| `real_name` | Nombre real del cliente |
| `address` | Dirección del cliente |
| `client_type` | Rubro del cliente |

**Retorna** el `auth` de la campaña y el id del cliente.

## Obtener información de campaña(s)

`action=get_campaigns`

| Parámetro | Descripción |
|---|---|
| `auth` | Auth de la campaña. Puede recibir uno o varios; en caso de múltiples, un arreglo |

> El PDF escribe este parámetro como `Auth`, con mayúscula inicial — es el único
> lugar donde lo hace. Aquí se transcribe como `auth` por consistencia; se
> desconoce si el nombre es sensible a mayúsculas.

**Retorna** un objeto `key,value` con la información de cada campaña. El key es el
`auth` de la campaña.

## Actualizar campaña

`action=update_campaign`

| Parámetro | Descripción |
|---|---|
| `auth` | Auth de la campaña (**obligatorio**) |
| `name` | Nombre de la campaña |
| `cant_total` | Cantidad de reproducciones totales (default 0) |
| `cant_day` | Cantidad de reproducciones por día (default 0) |
| `cant_hour` | Cantidad de reproducciones por hora (default 0) |
| `auto_cant` | Repartir la cantidad de reproducciones a la hora (0 apagado, 1 encendido; default 0) |
| `status` | Estado de la campaña: `active`, `finished`, `pause`, `pending` |
| `start_date` | Fecha de inicio (`YYYY-MM-DD`) |
| `end_date` | Fecha de fin (`YYYY-MM-DD`) |

## Actualizar cliente

`action=update_client`

| Parámetro | Descripción |
|---|---|
| `auth` | Auth de la **campaña** (**obligatorio**) |
| `name` | Nombre del cliente |
| `cuit` | CUIT del cliente |
| `real_name` | Nombre real del cliente |
| `address` | Dirección del cliente |
| `client_type` | Rubro del cliente |

## Obtener información de cliente(s)

`action=get_clients`

| Parámetro | Descripción |
|---|---|
| `auth` | Auth de la campaña. Puede recibir uno o varios; en caso de múltiples, un arreglo |

**Retorna** un objeto `key,value` con la información de cada cliente. El key es el
`auth` de la campaña.

## Obtener información de equipo(s)

`action=get_screen_info`

| Parámetro | Descripción |
|---|---|
| `name` | Nombre del equipo. Puede recibir uno o varios; en caso de múltiples, un arreglo |

**Retorna** un objeto `key,value` con la información de cada equipo. El key es el
`name` del equipo.

## Obtener métricas

`action=get_metrics`

| Parámetro | Descripción |
|---|---|
| `name` | Nombre del equipo. Puede recibir uno o varios; en caso de múltiples, un arreglo |
| `start_date` | Fecha de inicio (`YYYY-MM-DD`) |
| `end_date` | Fecha de fin (`YYYY-MM-DD`) |
| `type` | Tipo de vista: sumadas (`full`) o en detalle (`details`). Default `details` |
| `zoom` | Agrupación: por días (`days`) o en detalle (`details`). Default `details` |

**Retorna** un objeto `key,value` con la información de cada equipo. El key es el
`name` del equipo.

## Obtener estadísticas por campaña

`action=get_stats`

| Parámetro | Descripción |
|---|---|
| `auth` | Auth de la campaña. Puede recibir uno o varios; en caso de múltiples, un arreglo |
| `start_date` | Fecha de inicio (`YYYY-MM-DD`) |
| `end_date` | Fecha de fin (`YYYY-MM-DD`) |

**Retorna** un objeto `key,value` con la información de cada equipo. El key es el
`auth` de la campaña.

## Obtener estadísticas por equipo

`action=get_stats_by_screen`

| Parámetro | Descripción |
|---|---|
| `Screens` | Nombre del equipo. Puede recibir uno o varios; en caso de múltiples, un arreglo |
| `start_date` | Fecha de inicio (`YYYY-MM-DD`) |
| `end_date` | Fecha de fin (`YYYY-MM-DD`) |

**Retorna** un arreglo con las estadísticas.

## Obtener lista de equipos

`action=get_screen_list`

No recibe parámetros más allá de la autenticación.

**Retorna** un objeto con el `name` de todos los equipos a los cuales tiene acceso.

## Subir artes

`action=upload`

| Parámetro | Descripción |
|---|---|
| `file` | Archivo (imagen o video) |

## Crear spot

`action=create_spot`

| Parámetro | Descripción |
|---|---|
| `name` | Nombre del equipo (**obligatorio**) |
| `list` | Nombre de la lista (**obligatorio**) |
| `campaign` | Auth de la campaña (opcional) |
| `elements` | Arreglo de artes a cargar |

Datos de `elements`:

| Campo | Descripción |
|---|---|
| `id` | Id del arte (**obligatorio**) |
| `start_time` | Hora de inicio de la reproducción (opcional, formato `HH:mm`) |
| `end_time` | Hora de fin de la reproducción (opcional, formato `HH:mm`) |
| `days` | Días de la semana en los que reproduce (opcional; arreglo del 0 al 6, donde 0 es domingo, 1 lunes, y así sucesivamente) |

**Retorna** texto al finalizar la carga.

---

## Observaciones (notas nuestras, no del proveedor)

Detectadas al transcribir. Conviene confirmarlas con Doohmain antes de implementar
el conector.

**Erratas del documento.** `cant_day` aparece dos veces en la lista de parámetros
de `create_campaign` y otra vez en `update_campaign`. La capitalización es
inconsistente: `Auth` en `get_campaigns`, `Screens` en `get_stats_by_screen` y
`auth` en el resto. Se desconoce si los nombres son sensibles a mayúsculas.

**Contradicción en `get_stats`.** Se describe como "estadísticas por campaña" y se
indexa por `auth` de campaña, pero el texto dice que retorna "la información de cada
equipo".

**Sin documentar.** Método HTTP (GET/POST), `Content-Type`, formato de las
respuestas de error, códigos de estado, límites de tasa, paginación e idempotencia.
`upload` y `create_spot` "retornan texto", sin estructura especificada. `upload` no
documenta qué devuelve, pese a que `create_spot` necesita el `id` del arte.

**Sin webhooks.** Las métricas y estadísticas de entrega hay que consultarlas por
sondeo.

**El `api_key` viaja como parámetro.** Si se manda por query string queda registrado
en logs de acceso y proxies intermedios. Conviene enviarlo en el cuerpo por POST.

**Huecos frente a SPACES OS.** `create_spot` exige un `list` (nombre de lista) que no
existe como concepto en nuestro modelo. `upload` declara aceptar sólo imagen o video,
no HTML. Los equipos se identifican por `name`, y no hay columna de id externo en
nuestro `schema.prisma`. Doohmain pide `cant_total`/`cant_day`/`cant_hour`/`auto_cant`,
que no tenemos; y nuestra `TrafficInstruction` lleva `duracionSeg`, `resolucion`,
`prioridad`, `sovPorcentaje` y `tipoVenta`, que Doohmain no acepta.

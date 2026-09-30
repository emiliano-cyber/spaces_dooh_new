---
tipo: modulo
estado: verificado
actualizado: 2026-09-28
tags: [backend, inventario, sitios, amarillo]
archivos:
  - apps/web/lib/server/sitios-repo.ts
  - apps/web/lib/server/sitios-controller.ts
  - apps/web/lib/server/contratos-sitio.ts
  - apps/web/lib/server/almacen-repo.ts
  - apps/web/lib/inventario-import.ts
  - apps/web/lib/modalidades.ts
  - apps/web/app/api/sitios/[id]/modalidades/route.ts
  - apps/web/lib/predio-cercania.ts
---

# Inventario y sitios

## Modelo

```
Arrendador → Predio → Contrato → Pantallas (sitios) → Modalidades
```

Una **pantalla** (`sitios`) es la unidad física. Un **predio** es el inmueble
donde están varias. Una pantalla puede venderse en varias **modalidades**
(`sitio_modalidades`: mensual, catorcenal, spot, hora…), cada una con su tarifa.

### Las modalidades ya se capturan desde la ficha (2026-09-28)

**Hasta esa fecha solo entraban por archivo.** `sitio_modalidades` únicamente la
escribían `insertarSitio` y `actualizarSitioCompleto` —los dos del camino de
importación—, ningún formulario mandaba `modalidadesDetalle`, la ficha solo las
**mostraba** y el `PATCH /api/sitios/:id` no las aceptaba. Para poner una tarifa
de spoteo había que preparar un CSV.

Ahora hay una segunda puerta, y **tiene ruta propia**:

| | |
|---|---|
| Ruta | `PATCH /api/sitios/:id/modalidades` |
| Guard | `exigirCambioSensible('inventario', 'crear')` — **la ruta entera**, sin lista de campos |
| Controller | `actualizarModalidadesCtrl` (`sitios-controller.ts`) |
| Repo | `actualizarModalidades` (`sitios-repo.ts`) |
| Reglas | `lib/modalidades.ts`, **las mismas que el importador** |
| Pantalla | `SiteFicha.tsx` → `ModalidadesDialog` |

> [!danger] Por qué NO entró por el PATCH general — es una decisión de seguridad
> `app/api/sitios/[id]/route.ts` decide el candado por **campo**, con una lista
> blanca (`CAMPOS_SENSIBLES`: `tarifaPublicada`, `tarifaMensual`, `costoCompra`,
> `precioM2`, `tarifaImpresion`, `arrendadorId`, `predioId`).
>
> **Una modalidad ES una tarifa**: `sitio_modalidades.tarifa_publicada` es el
> mismo dinero que `sitios.tarifa_publicada`, por unidad de venta. Añadir
> `modalidadesDetalle` a esa lista habría funcionado y **habría sido la decisión
> equivocada**: una lista blanca protege lo que alguien se acordó de escribir, y
> el día que llegue otra tarifa por unidad nadie se acordará — y el hueco **no da
> ningún error**, el candado simplemente deja pasar.
>
> Con ruta propia **no hay nada que olvidarse de añadir**: todo lo que entre por
> ahí pide contraseña.
>
> Se usa `exigirCambioSensible` (o sea `exigirDesbloqueo`) y **no**
> `exigirReautenticacionSiempre`, a propósito: el trato es EXACTAMENTE el de
> `tarifaPublicada`, ni más estricto ni más laxo.
>
> Y el PATCH general **RECHAZA** `modalidadesDetalle` con un 400 en vez de
> ignorarlo. `CAMPO_COL` ya se lo saltaría, pero un 200 con la tarifa intacta es
> el «mentir en vez de callarse» que costó el arreglo de B38.

> [!warning] `actualizarModalidades` NO borra lo que no viene — y es la diferencia
> `actualizarSitioCompleto` hace `delete from sitio_modalidades where sitio_id =
> $1` y reinserta: para una **re-importación** es correcto, el archivo es la
> verdad completa de esa pantalla.
>
> Este camino recibe una **edición**, no un archivo. Lo que no viene no es «hay
> que borrarlo», es «no se tocó». Con la otra semántica, mandar solo la tarifa de
> spot se llevaría por delante las otras seis **sin dar error**: la pantalla
> dejaría de venderse por mensual y nadie se enteraría, que es el modo de fallo
> silencioso de R2. Por eso las bajas viajan **explícitas** en `quitar`, y guardar
> usa `on conflict (sitio_id, unidad) do update`.
>
> El `tenant_id` se toma de la **fila de la pantalla** (mismo invariante que
> `insertarSitio`) y la baja lleva `and tenant_id = $3` como segunda capa sobre
> la RLS.

**Las reglas viven en un solo sitio.** Las siete unidades válidas y «una pantalla
FIJA solo se vende por mensual o catorcenal» estaban privadas dentro de
`inventario-import.ts`; se extrajeron a `lib/modalidades.ts` y el importador las
**importa**. Con dos caminos de escritura, dos copias de la misma regla divergen —
es el mismo remedio que `scripts/migrar.mjs` con el orden de las migraciones.
`modalidades.test.ts` §3 muerde el fuente del importador para que nadie las
vuelva a copiar.

La **exhibición se lee de la base, nunca del cuerpo** de la petición: si se
tomara de la petición, la regla de la pantalla fija se saltaría con una línea de
`curl`.

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/server/sitios-repo.ts` (724) | CRUD, importación, whitelist `CAMPO_COL`, modalidades |
| `lib/server/sitios-controller.ts` (209) | Validación zod, mapeo de errores FK→HTTP |
| `lib/modalidades.ts` | Las siete unidades y la regla de la pantalla fija (puro) |
| `lib/server/contratos-sitio.ts` (336) | Contrato al **alta** (ADR 0002) |
| `lib/server/almacen-repo.ts` (116) | Activos físicos y traslados (Fase 3); por tipo desde el 30/09 ([[operaciones-y-ot]]) |
| `lib/inventario-import.ts` | Parseo del Excel de carga masiva |
| `lib/predio-cercania.ts` | Agrupa pantallas en predios por distancia |

## Reglas de negocio codificadas

| Regla | ADR | Dónde |
|---|---|---|
| Arrendador obligatorio al dar de alta una pantalla | 0002 | `contratos-sitio.ts` (`exigirArrendador`) |
| El contrato nace **INCOMPLETO** y eso es a propósito | 0001 | `contratos-sitio.ts:8-16` |
| Un solo costo por pantalla: la renta al arrendador | 0006 | `costo_compra` **no** es un costo aparte |
| Cupo de clientes distintos por pantalla | 0008 | `sitios.max_clientes` |

> [!note] Por qué el contrato se abre en el alta y no en la venta
> El ADR 0001 lo abría al **vender**, y eso tapaba el agujero tarde: hasta la
> primera venta, una pantalla cargada por Excel no tenía rastro de a quién se le
> paga la renta. El ADR 0002 mueve el disparador al alta, que es donde el dato
> se conoce (`contratos-sitio.ts:8-16`).

## Seguridad de la edición

`sitios-repo.ts` **whitelistea columnas** (`CAMPO_COL`) y usa SQL parametrizado;
el `PATCH` acepta un `z.record` genérico y el filtro real está en el repo
(`sitios-controller.ts:7-10`). Cambiar esa whitelist es exponer columnas nuevas
a escritura desde el cliente.

El desbloqueo NO se exige igual en las tres rutas, y la diferencia importa:

| Ruta | Cuándo pide la contraseña |
|---|---|
| `DELETE /api/sitios/[id]` | **Siempre**: borrar catálogo siempre es sensible |
| `PATCH /api/sitios/[id]` | **Solo si el cuerpo trae un campo de `CAMPOS_SENSIBLES`** (`route.ts:15-18`). Editar nombre, dirección o notas no la pide, a propósito |
| `PATCH /api/sitios/[id]/modalidades` | **Siempre**: la ruta entera es sensible, sin lista de campos |

Ver [[autenticacion-y-sesion]].

## La galería no viaja en la hidratación (10/08)

`sitios.fotos` es un `text[]` de **data URLs base64**, e `imagen_promocional`
otro. En los listados pesaban 1.0 MB por doce pantallas — y **dos veces**,
porque `sitios` y `sitiosRed` son las mismas filas serializadas por separado.

`rowToSitio(r, modalidades, conMedia)` lleva un tercer parámetro: los dos
listados pasan `false` y reciben `fotos: []`, `imagenPromocional: null` y
`tieneFotos: boolean`. `getSitio` y el portal público siguen con `true`.

La galería se pide a **`GET /api/sitios/[id]/media`** (permiso `network.ver`, el
mismo con el que la rebanada viaja) y la carga `SiteFicha` al abrirse.

> [!note] Por qué el `select s.*` se quedó como estaba
> Convertirlo en lista explícita son ~48 columnas. Cambiar un peso medido por el
> riesgo de que a alguien se le caiga una y ese campo pase a `undefined` en todo
> el inventario no compensa. Lo que sobraba —el peso de la RESPUESTA— se corta
> en el mapper; el tráfico Postgres→Node sigue ahí y está anotado en el código.

## Estados

Tres ejes independientes: `estatus_comercial`, `estatus_legal`,
`estatus_operativo` (`db/schema.sql:33-35,185-187`). Una pantalla puede estar
comercialmente `OCUPADO` y operativamente `EN_MANTENIMIENTO` a la vez.

La **pausa legal** (`POST/DELETE /api/sitios/[id]/pausa-legal`) suspende la
comercialización sin borrar nada (`20260723_sitio_pausa_legal.sql`).

## Importación masiva

`POST /api/sitios/import` con Excel. Agrupa por `codigo_proveedor` para crear
las modalidades. `lib/predio-cercania.ts` agrupa pantallas en predios por radio
(`RADIO_PREDIO_M`).

> [!warning] `clave_interna` y `codigo_proveedor` son UNIQUE **globales**
> No llevan `tenant_id` en la restricción (`db/schema.sql:124-125`). Dos
> organizaciones no pueden usar el mismo código de proveedor. Ver
> [[preguntas-abiertas]].

## Relacionadas
[[arrendadores-y-contratos]] · [[comercial-propuestas-campanas]] · [[esquema]] ·
[[decisiones]] · [[02-Backend/_indice|Índice de Backend]] · [[MOC-Proyecto]]

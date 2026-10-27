---
tipo: modulo
estado: verificado
actualizado: 2026-10-23
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
  - apps/web/app/api/sitios/[id]/route.ts
  - apps/web/app/api/sitios/[id]/rejilla/route.ts
  - apps/web/app/api/sitios/[id]/media/route.ts
---

# Inventario y sitios

> [!important] v0.12.3 (SIN PUBLICAR, 22/10) · pantallas y lugares PROPIOS
> Pedido del dueño: pantallas o lugares propios, sin renta mensual; solo luz y
> operación. Forma aprobada: `20261022_pantallas_propias.sql` agrega `sitios.propio`
> y `predios.propio`, y relaja `predios.arrendador_id` (CHECK: propio o con
> arrendador). Lo que cambia:
> - **Alta**: «Pantalla propia» en Nueva pantalla y «Son pantallas propias» en la
>   importación: no piden arrendador ni abren contrato; el predio de un lote propio
>   nace propio (`resolverPredioPropio`).
> - **Venta**: `exigirContratoCompleto` (y su espejo `sitiosSinContratoCompleto`) da
>   por cubierta a una propia; `generarCampanaDesdePropuesta` no le abre contrato.
> - **Marcar propia una existente** (`marcarPropio`, cambio sensible con contraseña):
>   cancela su contrato INCOMPLETO; con uno vigente/por vencer/renovado es 409.
> - **Costo**: renta 0; su costo real son los recibos de luz y las OT, que ya no
>   dependían del contrato. En Inventario, Comercial, propuestas y Reportes dice
>   «Propia» en vez de «sin contrato» o «Sin arrendador»; el tablero de propuestas la
>   cuenta con costo 0, no «sin costo».
> **Verificado contra Postgres el 23/10**: `lib/test/pantallas-propias.e2e.test.ts`,
> 15 en verde, incluida la venta de punta a punta por `POST /api/reservar` (propia
> sin contrato se vende; rentada incompleta o sin contrato es 409; la de otra
> organización no se vende ni siendo propia allá).
>
> **23/10 · «propia» en TODAS las altas.** Faltaba en dos:
> - **Alta manual desde Comercial** (`components/demo/comercial/AltaSitioDialog.tsx`)
>   siempre exigía arrendador; ahora tiene la misma casilla que Nueva pantalla.
> - **Re-importar en modo ACTUALIZAR** pisaba los datos de la pantalla existente y se
>   olvidaba de `propio`. Ahora un lote propio la vuelve propia con la MISMA regla
>   que la ficha (`volverPropiaEnTx`, compartida con `marcarPropio`): cancela su
>   pendiente; con renta vigente la fila sale como error y la pantalla queda intacta.
>   Un lote rentado NO desmarca una propia (eso exige arrendador, desde su ficha):
>   la actualiza y lo avisa como advertencia.


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
| `lib/server/sitios-repo.ts` (741) | CRUD, importación, whitelist `CAMPO_COL` (`:416`), modalidades |
| `lib/server/sitios-controller.ts` (209) | Validación zod, mapeo de errores FK→HTTP |
| `lib/modalidades.ts` (93) | Las siete unidades y la regla de la pantalla fija (puro) |
| `lib/server/contratos-sitio.ts` (336) | Contrato al **alta** (ADR 0002) |
| `lib/server/almacen-repo.ts` (141) | Activos físicos y traslados (Fase 3); por tipo desde el 30/09 ([[operaciones-y-ot]]) |
| `lib/inventario-import.ts` (271) | Parseo del Excel de carga masiva |
| `lib/predio-cercania.ts` (199) | Agrupa pantallas en predios por distancia |

Líneas medidas con `wc -l` el 2026-10-05. `sitios-repo.ts` ya no tiene
`horasOperacion` ni `parseHora`: los retiró `12fc300d` (01/10) porque nadie los
llamaba; la cantidad de spots de una pantalla digital vive ahora en un módulo
puro — ver [[calculadora-de-spots]].

## Reglas de negocio codificadas

| Regla | ADR | Dónde |
|---|---|---|
| Arrendador obligatorio al dar de alta una pantalla | 0002 | `contratos-sitio.ts` (`exigirArrendador`) |
| El contrato nace **INCOMPLETO** y eso es a propósito | 0001 | `contratos-sitio.ts:16-19` |
| Un solo costo por pantalla: la renta al arrendador | 0006 | `costo_compra` **no** es un costo aparte |
| Cupo de clientes distintos por pantalla | 0008 | `sitios.max_clientes` |
| A qué pantalla de DOOHmain se publica (13/10) | — | `sitios.doohmain_pantalla`: solo por el PATCH de la ficha (`CAMPO_COL`), **no** en `COLS`, para que alta e importación no la pisen; el controller recorta y vacío → null; `sitios_doohmain_pantalla_ck` repite la regla. Ver [[integraciones-externas]] |

> [!note] Por qué el contrato se abre en el alta y no en la venta
> El ADR 0001 lo abría al **vender**, y eso tapaba el agujero tarde: hasta la
> primera venta, una pantalla cargada por Excel no tenía rastro de a quién se le
> paga la renta. El ADR 0002 mueve el disparador al alta, que es donde el dato
> se conoce (`contratos-sitio.ts:10-14`).

## Seguridad de la edición

`sitios-repo.ts` **whitelistea columnas** (`CAMPO_COL`) y usa SQL parametrizado;
el `PATCH` acepta un `z.record` genérico y el filtro real está en el repo
(`sitios-controller.ts:17-21`). Cambiar esa whitelist es exponer columnas nuevas
a escritura desde el cliente.

El desbloqueo NO se exige igual en las cuatro rutas, y la diferencia importa:

| Ruta | Cuándo pide la contraseña |
|---|---|
| `DELETE /api/sitios/[id]` | **Siempre**: borrar catálogo siempre es sensible |
| `PATCH /api/sitios/[id]` | **Solo si el cuerpo trae un campo de `CAMPOS_SENSIBLES`** (`route.ts:15-18`). Editar nombre, dirección o notas no la pide, a propósito |
| `PATCH /api/sitios/[id]/modalidades` | **Siempre**: la ruta entera es sensible, sin lista de campos (`modalidades/route.ts:49`) |
| `PATCH /api/sitios/[id]/rejilla` | **Siempre**, el mismo candado que las modalidades (`rejilla/route.ts:50`); el `GET` solo pide `inventario.ver` (`:40`). Ver [[rejilla-franja-y-temporada]] |

`PATCH` y `DELETE` de `/api/sitios/[id]` piden primero `exigir('inventario',
'crear')` (`[id]/route.ts:22` y `:47`) y después `exigirDesbloqueo()` —
condicional en el `PATCH` (`:30`), incondicional en el `DELETE` (`:49`). La
lista `CAMPOS_SENSIBLES` está en `[id]/route.ts:15-18`.

Ver [[autenticacion-y-sesion]].

## La galería no viaja en la hidratación (10/08)

`sitios.fotos` es un `text[]` de **data URLs base64**, e `imagen_promocional`
otro. En los listados pesaban 1.0 MB por doce pantallas — y **dos veces**,
porque `sitios` y `sitiosRed` son las mismas filas serializadas por separado.

`rowToSitio(r, modalidades, conMedia)` lleva un tercer parámetro: los dos
listados pasan `false` y reciben `fotos: []`, `imagenPromocional: null` y
`tieneFotos: boolean`. `getSitio` y el portal público siguen con `true`.

La galería se pide a **`GET /api/sitios/[id]/media`** (permiso `network.ver`, el
mismo con el que la rebanada viaja; `media/route.ts:31`) y la carga `SiteFicha`
al abrirse.

> [!note] El `select s.*` se quitó el 12/10, y sin lista a mano
> Se dejó el 10/08 porque una lista explícita son ~48 columnas y se le puede
> caer una. Pero el tráfico Postgres→Node que quedaba pendiente **se notó en
> g500**: una pantalla con **10.4 MB** de fotos dejaba `/api/sitios` en 3.1 s y
> `/api/estado` en 7 s (en local, 1069 ms contra 1 ms sin las fotos).
>
> Ahora `listarSitios` y `listarSitiosRed` piden
> `columnasDeListado()` (`sitios-repo.ts`): las columnas de `sitios` leídas de
> `pg_attribute` **menos** `fotos` e `imagen_promocional`, una vez por proceso.
> Así una columna nueva entra sola. `tieneFotos` sale de
> `pg_column_size(s.fotos) > 20`, que no trae el valor: un `text[]` vacío mide
> 13 bytes en disco y uno con un elemento, 25 o más.
>
> Lo fijan `sitios-repo.listado-sin-media.test.ts` (el SQL no lee la media) y
> `hidratacion-ligera.e2e.test.ts` (fotos frente a arreglo vacío).

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

> [!danger] 2026-10-01 · las digitales importadas antes del 29/09 se reservaban como FIJAS
> El booking (`reservar` y `generarCampanaDesdePropuesta`, en
> `lib/server/campanas-repo.ts`) decide digital **solo** por
> `tipo_medio = 'PANTALLA_DIGITAL'`. El importador viejo ponía ahí la estructura
> física (ESPECTACULAR, MURAL…) y marcaba lo digital en `exhibicion`. Así que la
> pantalla **se veía digital en Inventario y se reservaba fija**: campaña OOH,
> sin slots, pidiendo imprenta.
>
> `b25c7ca6` (29/09) arregló el importador (`valoresDe`, `sitios-repo.ts`), pero
> **solo para las cargas nuevas**. Las ya cargadas siguieron mal hasta
> `20261004_pantallas_digitales_importadas.sql` (ver [[04-Datos/migraciones]]).
>
> **La lección:** arreglar el código que escribe un dato no arregla los datos que
> ya escribió. Si un arreglo cambia CÓMO se guarda algo, la misma tarea tiene que
> preguntarse qué filas quedaron guardadas de la forma vieja. Se vio en DEMO y no
> en local porque la base local se había recargado después del arreglo.

> [!warning] `clave_interna` y `codigo_proveedor` son UNIQUE **globales**
> No llevan `tenant_id` en la restricción (`db/schema.sql:124-125`). Dos
> organizaciones no pueden usar el mismo código de proveedor. Ver
> [[preguntas-abiertas]].

## Relacionadas
[[arrendadores-y-contratos]] · [[comercial-propuestas-campanas]] · [[esquema]] ·
[[decisiones]] · [[02-Backend/_indice|Índice de Backend]] · [[MOC-Proyecto]]

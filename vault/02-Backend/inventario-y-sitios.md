---
tipo: modulo
estado: verificado
actualizado: 2026-08-10
tags: [backend, inventario, sitios, amarillo]
archivos:
  - apps/web/lib/server/sitios-repo.ts
  - apps/web/lib/server/sitios-controller.ts
  - apps/web/lib/server/contratos-sitio.ts
  - apps/web/lib/server/almacen-repo.ts
  - apps/web/lib/inventario-import.ts
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

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/server/sitios-repo.ts` (624) | CRUD, importación, whitelist `CAMPO_COL` |
| `lib/server/sitios-controller.ts` (104) | Validación zod, mapeo de errores FK→HTTP |
| `lib/server/contratos-sitio.ts` (336) | Contrato al **alta** (ADR 0002) |
| `lib/server/almacen-repo.ts` (96) | Activos físicos y traslados (Fase 3) |
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

`PATCH·DELETE /api/sitios/[id]` exige **desbloqueo** (catálogo = cambio
sensible). Ver [[autenticacion-y-sesion]].

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

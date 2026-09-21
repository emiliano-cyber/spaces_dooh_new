---
tipo: modulo
estado: verificado
actualizado: 2026-09-21
tags: [backend, operaciones, ot, imprenta, amarillo]
archivos:
  - apps/web/lib/server/ot-repo.ts
  - apps/web/lib/server/ot-controller.ts
  - apps/web/lib/server/impresion-repo.ts
  - apps/web/lib/server/operaciones-eventos.ts
  - apps/web/lib/server/almacen-repo.ts
  - apps/web/lib/tipos-ot.ts
  - apps/web/lib/costos-ot.ts
  - apps/web/lib/costos-ot-payload.ts
  - apps/web/app/(app)/(shell)/administracion/page.tsx
  - db/migrations/20260917_costos_ot_por_tipo.sql
---

# Operaciones, OT e imprenta

## Órdenes de trabajo

Una **OT** es una tarea de campo: montaje de lona, montaje digital, desmontaje,
mantenimiento, herrería, eléctrico, inspección (`tipo_ot`, `db/schema.sql:53`).

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `ot-repo.ts` | 269 | OT + evidencias, cierre, notificaciones |
| `ot-controller.ts` | 39 | Validación |
| `impresion-repo.ts` | 121 | Órdenes de impresión y OC |
| `operaciones-eventos.ts` | 86 | OT automáticas desde Arrendadores |
| `almacen-repo.ts` | 96 | Activos y traslados |

> [!warning] No existe forma de reasignar una OT ya creada
> Las rutas son `GET·POST /api/ot`, `GET /api/ot/[id]` y `POST /api/ot/[id]/cerrar`.
> **No hay `PATCH`.** `asignado_a` solo se escribe en dos momentos: al **crear**
> la OT (`crearOTCtrl`, campo `asignadoA`) y al **cerrarla**, donde
> `ot-repo.ts:193` hace `asignado_a = coalesce(asignado_a, $3)` para estampar a
> quien cierra. Cambiar el responsable de una OT existente exige un script de
> datos — o un endpoint nuevo.

## El cierre de OT es lo que destraba la facturación

`ot-repo.ts:11-14`: cerrar una OT con foto guarda la evidencia, completa la OT
y, **si está ligada a una campaña, enciende `fotos_comprobatorias` y
`reporte_publicacion`** — dos de los tres candados de [[finanzas-y-cobranza]].

> [!warning] Tocar el cierre de OT toca la facturación
> No es un módulo aislado: es el disparador del dinero.

## Evidencias

`evidencias_ot` guarda foto (base64 legado **o** key en DigitalOcean Spaces),
GPS (`lat`, `lng`, `precision_m`), y **dos fechas distintas**:

| Columna | Significado |
|---|---|
| `tomada_en` | Cuándo se hizo la foto (EXIF del archivo) |
| `timestamp` | Cuándo se subió |

La distinción importa: probar que la lona se instaló **el día que se cobró**
depende de `tomada_en`, no de cuándo alguien subió el archivo.

El almacenamiento es condicional: si `storageHabilitado()` (todas las
`DO_SPACES_*` presentes) va a S3 con URL firmada; si no, cae al data URL en base
de datos (`lib/server/storage.ts:18`). Ver [[integraciones-externas]].

## Imprenta

`ordenes_impresion`, proceso lineal:

```
ARTE_RECIBIDO → VALIDADO → EN_PRODUCCION → IMPRESO → LISTO_MONTAJE
```

Con **prueba de color** aprobable (`prueba_color_url`,
`prueba_color_aprobada`). Folio consecutivo `OI-2026-0001`
(`impresion-repo.ts:13-15`).

## OT automáticas

Ver [[arrendadores-y-contratos]]. Cancelar contrato → OT de retiro; alta de
pantalla fija → OT de montaje. Nacen `PENDIENTE` con nota de origen y son a
mejor esfuerzo.

## Cuánto cuesta una OT — por TIPO y desde Configuración

Desde el **2026-09-17** el costo de mano de obra de una orden de trabajo sale de
`config_negocio.costos_ot` (jsonb, una fila por tenant — ADR 0011) y se resuelve
por tipo en `lib/costos-ot.ts`. Lo lee todo el que calcula margen:
`dashboardMetrics` (`derive.ts:618`), `margenCampana` (`derive.ts:735`) y los
reportes de rentabilidad ([[reportes-rentabilidad]]).

Antes era una constante en el archivo de derivados:

```ts
// lib/data/derive.ts:254 — RETIRADA el 17/09
const COSTO_OPERATIVO_POR_OT = 1500
// Parámetro de demo; en producción vendría de ConfigNegocio o por tipo de OT.
```

> [!important] El respaldo NO se siembra en la base, y es a propósito
> `COSTOS_OT_RESPALDO` (`lib/costos-ot.ts`) tiene los **nueve** tipos del enum
> `tipo_ot` (`db/schema.sql:53`) y **todos valen 1500**, que es lo que costaba
> cualquier OT antes del cambio. El DEFAULT de la columna es `{}` —«sin
> configurar»—, no los nueve importes: sembrarlos pondría el número en dos
> sitios, y el día que el negocio lo cambie la flota seguiría con el viejo
> quemado en su fila sin que nada lo dijera.
>
> Consecuencia medible: la migración **no mueve el margen**. Una organización que
> no configure nada ve exactamente las cifras de ayer.
>
> Y cuánto cuesta una herrería frente a una inspección **no lo decide el
> código**: se captura en Configuración. El respaldo solo existe para que un
> tenant sin configurar no reviente ni cueste 0 — un costo de 0 se suma sin que
> nada falle y deja el margen inflado en pantalla.

`costoDeOt(tipo, costos)` cae al respaldo ante cualquier hueco: tenant sin fila,
columna vacía, tipo sin capturar, valor basura en el jsonb, y **tipo fuera del
enum** (cae al respaldo de `OTRO`, no a 0). El `0` configurado **sí manda**: es
un costo capturable de verdad, y confundirlo con «sin configurar» sería volver a
decidir por el usuario — el mismo hallazgo de CFG-01 con los plazos de cobranza.

Se escribe por `PATCH /api/config` con las claves como **enum cerrado**
(`app/api/config/route.ts`), y se **sanea al leer y al escribir**
(`sanearCostosOt`): la columna es jsonb y lo que entre se arrastra en cada
respaldo.

> [!success] 2026-09-21 · Ya hay pantalla — B11 cerrado
> Hasta hoy `PATCH /api/config` aceptaba `costosOt` pero solo se podía escribir
> con una petición a mano: la pantalla no existía. Ahora hay una tarjeta en
> **Administración → pestaña Configuración** (`CostosOtCard`,
> `app/(app)/(shell)/administracion/page.tsx`), con un input por cada tipo
> vigente de `TODOS_TIPOS_OT` (excluye `TIPO_OT_OBSOLETO`, o sea
> `MONTAJE_DIGITAL`: ya no se ofrece en ninguna pantalla).
>
> Qué viaja en el PATCH es la única decisión no trivial: solo los tipos que el
> usuario tocó en esta sesión, comparando el borrador contra el `costosOt` que
> trajo el último GET. Un campo vaciado desde un valor existente manda `null`
> explícito (quitar ese tipo, vuelve al respaldo); un campo que nunca se tocó
> no viaja. Vive en `lib/costos-ot-payload.ts` (`payloadCostosOt`), con su
> propia prueba — `.tsx` no se prueba con unitarias porque `vitest.config.ts`
> no monta jsdom.

## Módulo móvil

`/m/ot/[id]` es una vista sin chrome para la cuadrilla en campo. Ver
[[paginas-publicas]].

> [!success] `OTMovil.tsx` se retiró el 2026-08-27 — no lo importaba nadie
> Importaba de `lib/auth-context.tsx`, el cliente JWT contra el backend
> archivado, y **eso lo hacía parecer una dependencia viva**. No lo era: la
> página real `/m/ot/[id]` renderiza `OTVista`, que está limpia. Los dos
> archivos salieron con la pista archivada. Ver [[zonas-de-riesgo]] §A6.

## Relacionadas
[[flujo-orden-de-trabajo]] · [[finanzas-y-cobranza]] · [[reportes-rentabilidad]] ·
[[arrendadores-y-contratos]] · [[integraciones-externas]] · [[MOC-Proyecto]]

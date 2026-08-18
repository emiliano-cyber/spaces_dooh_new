---
tipo: modulo
estado: verificado
actualizado: 2026-08-10
tags: [backend, operaciones, ot, imprenta, amarillo]
archivos:
  - apps/web/lib/server/ot-repo.ts
  - apps/web/lib/server/ot-controller.ts
  - apps/web/lib/server/impresion-repo.ts
  - apps/web/lib/server/operaciones-eventos.ts
  - apps/web/lib/server/almacen-repo.ts
  - apps/web/lib/tipos-ot.ts
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
de datos (`lib/server/storage.ts:5-9`). Ver [[integraciones-externas]].

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

## Módulo móvil

`/m/ot/[id]` es una vista sin chrome para la cuadrilla en campo. Ver
[[paginas-publicas]].

> [!bug] `OTMovil.tsx` depende del `AuthProvider` muerto
> `components/operaciones/OTMovil.tsx:6,190` importa de `lib/auth-context.tsx`,
> el cliente JWT contra el backend archivado. Ver [[vision-general]] y
> [[preguntas-abiertas]].

## Relacionadas
[[flujo-orden-de-trabajo]] · [[finanzas-y-cobranza]] ·
[[arrendadores-y-contratos]] · [[integraciones-externas]] · [[MOC-Proyecto]]

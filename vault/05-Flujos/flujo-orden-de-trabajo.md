---
tipo: flujo
estado: verificado
actualizado: 2026-08-07
tags: [flujo, operaciones, ot, evidencias]
archivos:
  - apps/web/lib/server/ot-repo.ts
  - apps/web/lib/server/operaciones-eventos.ts
  - apps/web/lib/server/storage.ts
  - apps/web/lib/exif.ts
  - apps/web/app/(app)/m/ot/[id]/
---

# Flujo: orden de trabajo en campo

Es el flujo de escritura que **destraba el dinero**: sin evidencia no hay
facturación.

```mermaid
sequenceDiagram
    autonumber
    participant EV as Evento (contrato/alta)
    participant OE as operaciones-eventos
    actor OP as Operaciones
    actor CU as Cuadrilla (móvil)
    participant OT as ot-repo
    participant ST as storage.ts
    participant PG as Postgres

    alt origen automático
        EV->>OE: cancelar contrato / alta de pantalla fija
        OE->>OT: crearOT(RETIRO | MONTAJE)
        Note over OE: mejor esfuerzo: si falla, la acción principal NO se rompe
    else origen manual
        OP->>OT: POST /api/ot
    end
    OT->>PG: insert ordenes_trabajo (folio consecutivo, PENDIENTE)
    OT->>PG: notificar()

    OP->>OT: PATCH /api/ot/[id] — asignar, programar
    CU->>CU: abre /m/ot/[id] (sin chrome)
    CU->>OT: POST /api/ot/[id]/cerrar + fotos
    OT->>OT: valida magic bytes (uploads.ts) — 422 si no es imagen
    OT->>OT: extrae fecha EXIF → tomada_en
    alt storageHabilitado()
        OT->>ST: subirDataUrl() → key en DO Spaces
    else
        Note over OT: fallback: data URL en la base
    end
    OT->>PG: insert evidencias_ot (foto, GPS, tomada_en, timestamp)
    OT->>PG: ordenes_trabajo → COMPLETADA
    alt la OT está ligada a una campaña
        OT->>PG: campanas.fotos_comprobatorias = true
        OT->>PG: campanas.reporte_publicacion = true
        Note over OT: dos de las tres llaves del candado de facturación
    end
```

## Estados

```mermaid
stateDiagram-v2
    [*] --> PENDIENTE
    PENDIENTE --> ASIGNADA
    ASIGNADA --> EN_PROCESO
    EN_PROCESO --> EN_REVISION: requiere_revision
    EN_PROCESO --> COMPLETADA
    EN_REVISION --> COMPLETADA
    EN_REVISION --> RECHAZADA
    RECHAZADA --> EN_PROCESO
    PENDIENTE --> BLOQUEADA
    BLOQUEADA --> EN_PROCESO
    PENDIENTE --> CANCELADA
    ASIGNADA --> CANCELADA
```

## Las dos fechas de la evidencia

| Columna | Qué prueba |
|---|---|
| `tomada_en` | Cuándo se hizo la foto (EXIF) |
| `timestamp` | Cuándo se subió |

Para demostrar que la lona estaba puesta el día que se cobró, la que vale es
`tomada_en`. Si el EXIF falta, queda `null` — **no** se rellena con la fecha de
subida.

## Subida de fotos: lo que la UI aprendió

Cada foto se lee entera (hasta 8 MB) y se le extrae la fecha, y se pueden subir
varias de golpe. Antes **no había ningún aviso** y la pantalla parecía colgada.
Hoy dice **cuántas** está cargando, y el aviso se apaga aunque el archivo resulte
ilegible (`docs/Registro_Cambios.md`, 06/08).

## Relacionadas
[[operaciones-y-ot]] · [[flujo-facturacion-y-cobranza]] ·
[[arrendadores-y-contratos]] · [[paginas-publicas]] ·
[[integraciones-externas]] · [[MOC-Proyecto]]

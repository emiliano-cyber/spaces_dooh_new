---
tipo: flujo
estado: verificado
actualizado: 2026-08-07
tags: [flujo, finanzas, dinero, rojo]
archivos:
  - apps/web/lib/server/finanzas-repo.ts
  - apps/web/lib/server/cambios.ts
  - apps/web/lib/finanzas-calculo.ts
  - apps/web/app/api/campanas/[id]/facturar/route.ts
  - apps/web/app/api/cobranzas/[id]/pagar/route.ts
  - apps/web/lib/test/flujo-critico.e2e.test.ts
---

# Flujo: facturación y cobranza

> [!danger] Escritura irreversible
> Emitir una factura consume folio fiscal y crea una cobranza. Ambos endpoints
> son `SENSIBLE`. Ver [[zonas-de-riesgo]].

## De candado a factura

```mermaid
sequenceDiagram
    autonumber
    actor F as Finanzas
    participant UI as /finanzas
    participant RT as /api/campanas/[id]/facturar
    participant CB as cambios.ts
    participant FR as finanzas-repo
    participant PG as Postgres

    F->>UI: «Facturar»
    UI->>RT: POST (+ x-csrf-token)
    RT->>CB: exigirCambioSensible('finanzas','facturar')
    CB->>CB: exigir(rol/permiso)
    CB->>CB: exigirDesbloqueo() — ¿tenant lo exige? ¿sesión desbloqueada?
    alt falta desbloqueo
        CB-->>UI: 403 {requiereDesbloqueo:true}
        UI->>F: abre el modal de contraseña (DesbloqueoCambios)
        F->>CB: POST /api/cambios/desbloquear
        CB->>PG: verifica bcrypt · sesiones.desbloqueo_expira_en = +15 min
    end
    RT->>FR: generarFactura(campanaId)
    FR->>FR: candadoDeSegmentos() — OC + fotos + reporte, POR SEGMENTO
    alt candado incompleto o ya facturado
        FR-->>F: 409
    else
        FR->>PG: insert facturas (folio consecutivo, snapshot fiscal)
        FR->>PG: insert cobranzas (plazo de config_negocio)
        FR->>PG: notificar()
    end
```

## Las tres llaves del candado

| Llave | Se enciende en |
|---|---|
| `oc_recibida` | Registro de la OC ([[operaciones-y-ot]] / imprenta) |
| `fotos_comprobatorias` | Cierre de OT con evidencia |
| `reporte_publicacion` | Cierre de OT |

**Doble factura sobre lo mismo → 409** (hallazgo A-2, verificado en e2e).

## Cobranza en parcialidades

```mermaid
sequenceDiagram
    autonumber
    actor F as Finanzas
    participant FR as finanzas-repo
    participant FC as finanzas-calculo
    participant PG as Postgres

    F->>FR: plan de parcialidades (n cuotas, periodicidad)
    FR->>FC: opcionesParcialidad() / repartirCuotas()
    alt el plan no cabe en la vigencia
        FC-->>F: rechazado
    else
        FC-->>FR: cuotas que SUMAN EXACTO al total
        FR->>PG: guarda el plan
    end
    F->>FR: POST /api/cobranzas/[id]/pagar (abono)
    FR->>FR: abono acotado al saldo
    FR->>PG: monto_pagado += abono
    alt saldo == 0
        FR->>PG: estatus = PAGADA
    end
```

Reglas verificadas por `flujo-critico.e2e.test.ts`: suma exacta, plan que no
cabe, abono acotado, liquidación.

## Recordatorios de cobro

`cobranzas.recordatorio_en` + `recordatorios_enviados` dan cadencia e
idempotencia. `POST /api/cobranzas/[id]/recordar` es manual; el barrido
automático de **contratos** (no de cobranzas) es el cron —
[[integraciones-externas]].

## Snapshot fiscal

`facturas` copia `rfc`, `razon_social`, `uso_cfdi` al emitir. Cambiar los datos
del cliente **no** altera facturas ya emitidas. Es intencional.

## Relacionadas
[[finanzas-y-cobranza]] · [[flujo-propuesta-a-campana]] ·
[[flujo-orden-de-trabajo]] · [[autenticacion-y-sesion]] · [[MOC-Proyecto]]

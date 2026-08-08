---
tipo: flujo
estado: verificado
actualizado: 2026-08-07
tags: [flujo, comercial, principal]
archivos:
  - apps/web/lib/server/propuestas-repo.ts
  - apps/web/lib/server/campanas-repo.ts
  - apps/web/lib/server/contratos-sitio.ts
  - apps/web/app/api/propuestas/[id]/generar-campana/route.ts
  - apps/web/lib/test/flujo-critico.e2e.test.ts
---

# Flujo principal: de propuesta a campaña publicada

Es el recorrido que define el producto. Está cubierto de punta a punta por
`apps/web/lib/test/flujo-critico.e2e.test.ts` (casos 1–7).

```mermaid
sequenceDiagram
    autonumber
    actor C as Comercial
    participant UI as /propuestas
    participant PR as propuestas-repo
    participant CR as campanas-repo
    participant CS as contratos-sitio
    participant PG as Postgres
    actor CL as Cliente

    C->>UI: crea propuesta (cliente, ítems, comisión, descuento)
    UI->>PR: POST /api/propuestas
    PR->>PR: agenciaBloqueada()? → gate de negociación
    PR->>PG: insert propuestas (folio consecutivo) + propuesta_items
    C->>PR: comparte la liga pública (token_publico)
    CL->>PR: GET /p/[id] · acepta
    PR->>PG: aceptado_en / aceptado_por / aceptado_ip
    Note over PR: «medio-contrato»: queda constancia de quién aceptó y desde dónde

    C->>CR: POST /api/propuestas/[id]/generar-campana
    CR->>CS: exigirContratoCompleto(sitio)
    alt contrato INCOMPLETO (ADR 0003)
        CS-->>C: error — no se puede reservar
    else contrato completo
        CR->>PG: insert campanas (folio) + reservas por ítem
        Note over CR: IDEMPOTENTE (hallazgo A5): repetir no duplica
    end

    C->>CR: sube creativos → POST /api/creatividades
    CR->>PG: creatividades (PENDIENTE)
    C->>CR: POST /api/campanas/[id]/validar
    CR->>PG: estatus_validacion = VALIDADA
    C->>CR: POST /api/campanas/[id]/creativos/repartir
    CR->>PG: asigna creativos a cada reserva
    C->>CR: POST /api/campanas/[id]/enviar-dominio
    alt sin creativo validado (hallazgo M14)
        CR-->>C: error — no se envía
    else
        CR->>PG: publica (y DOOHmain si el flag está encendido)
    end
```

## Los tres candados de este flujo

| # | Regla | Qué pasa si falta | ADR / hallazgo |
|---|---|---|---|
| 1 | No reservar con contrato incompleto | Error al generar campaña | ADR 0003 |
| 2 | Generar campaña es idempotente | Repetir duplicaría campañas y reservas | A5 |
| 3 | No enviar a dominio sin creativo validado | Se publicaría una pantalla en blanco | M14 |

## Estados de la campaña

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> COTIZACION
    COTIZACION --> CONFIRMADA
    CONFIRMADA --> ACTIVA
    ACTIVA --> LISTA_FACTURAR: candado completo
    LISTA_FACTURAR --> COMPLETADA
    DRAFT --> CANCELADA
    COTIZACION --> CANCELADA
    CONFIRMADA --> CANCELADA
    ACTIVA --> CANCELADA
```

## Reservas y su caducidad

Una reserva nace `TENTATIVA` con `expira_en`. Si no se confirma, **caduca sola**.
La liberación de tentativas vencidas es una de las cuatro tareas de
mantenimiento que corren al abrir el shell (`docs/Registro_Cambios.md`, 06/08).

## Validaciones de dominio comprobadas

De `flujo-critico.e2e.test.ts`: fechas coherentes, comisión no mayor que 100%,
neto no negativo.

## Relacionadas
[[comercial-propuestas-campanas]] · [[flujo-facturacion-y-cobranza]] ·
[[flujo-orden-de-trabajo]] · [[inventario-y-sitios]] · [[glosario]] ·
[[MOC-Proyecto]]

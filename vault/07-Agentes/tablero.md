---
tipo: tablero
estado: verificado
actualizado: 2026-08-10
tags: [agentes, coordinacion, vivo]
archivos: []
---

# Tablero de zonas

> [!warning] Reclama antes de escribir
> Protocolo completo en [[AGENTES]]. Si tu zona está `TOMADA`, **elige otra
> tarea** — no esperes.

**Estados:** `LIBRE` · `TOMADA` · `PAUSADA` · `REVISION`

## Zonas

| Zona | Estado | Agente | Archivos | Rama | Desde | Notas |
|---|---|---|---|---|---|---|
| Z1 · Auth 🔴 | LIBRE | — | — | — | — | Sesión externa cerró el 07/08 y **commiteó todo** (`e7c3517`). Google verificado en producción; ADR 0012 enmendado; `/login` ya redirige con sesión. **DESPLEGADO el 10/08**: `password_resets` aislada en producción, con respaldo y ensayo previos. El invariante de hardening vuelve a dar 0 tablas sin RLS. |
| Z2 · Tenant 🔴 | LIBRE | — | — | — | — | — |
| Z3 · Inventario 🟡 | LIBRE | — | — | — | — | — |
| Z4 · Arrendadores 🔴 | LIBRE | — | — | — | — | — |
| Z5 · Comercial 🟡 | LIBRE | — | — | — | — | — |
| Z6 · Operaciones 🟡 | LIBRE | — | — | — | — | — |
| Z7 · Finanzas 🔴 | LIBRE | — | — | — | — | — |
| Z8 · Integraciones 🟡 | LIBRE | — | — | — | — | **Trabajo identificado sin empezar:** `doohmain.ts:260` publica *todos* los creativos validados de la campaña, no el asignado a cada reserva. La asignación ya se guarda pero al publicar NO se usa — INC-02 punto 2. Antes de tocar: confirmar si `DOOHMAIN_PUBLISH_ENABLED` está encendido en producción |
| Z9 · Datos 🔴 | LIBRE | — | — | — | — | Última migración **aplicada en producción el 10/08**: `20260807_password_resets_rls.sql`. Invariante: 0 tablas con `tenant_id` sin RLS+FORCE |
| Z10 · UI base 🟡 | LIBRE | — | — | — | — | — |
| Z11 · Utilidades 🟢 | LIBRE | — | — | — | — | Zona de entrada para agentes nuevos |
| Z12 · Docs 🟢 | LIBRE | — | — | — | — | Bóveda creada el 07/08 y **validada contra el código el 10/08** ([[2026-08-10]]) |

## Archivos de alto contacto

Claim aparte, aunque estés en otra zona. Lista completa en [[AGENTES]].

| Archivo | Estado | Agente | Desde |
|---|---|---|---|
| `apps/web/middleware.ts` | LIBRE | — | — |
| `apps/web/next.config.mjs` | LIBRE | — | — |
| `apps/web/lib/server/db.ts` | LIBRE | — | — |
| `apps/web/lib/server/auth.ts` | LIBRE | — | — |
| `apps/web/lib/server/errores.ts` | LIBRE | — | — |
| `apps/web/lib/server/uploads.ts` | LIBRE | — | — |
| `apps/web/lib/modulos.ts` | LIBRE | — | — |
| `apps/web/components/demo/shell/nav.ts` | LIBRE | — | — |
| `apps/web/components/demo/ui/*` | LIBRE | — | — |
| `apps/web/app/providers.tsx` | LIBRE | — | — |
| `packages/types/src/*` | LIBRE | — | — |
| `db/schema.sql` | LIBRE | — | — |
| `package.json` / `package-lock.json` | LIBRE | — | — |
| `docs/Registro_Cambios.md` | LIBRE | — | — |

## Cómo se rellena una fila

```
| Z5 · Comercial 🟡 | TOMADA | agente-3 | lib/server/propuestas-repo.ts | feat/comercial-descuento | 07/08 14:20 | descuento por volumen |
```

Al terminar, vuelve a `LIBRE` **en el mismo commit** que cierra el trabajo.
Si te interrumpen, `PAUSADA` + dónde exactamente te quedaste (y al diario).

## Relacionadas
[[AGENTES]] · [[zonas-de-riesgo]] · [[_plantilla-diaria]] · [[MOC-Proyecto]]

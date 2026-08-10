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
| Z4 · Arrendadores 🔴 | LIBRE | — | — | — | — | **INC-07 desplegado el 10/08** (`7d27d25`). `arrendadores_tenant_rfc_uq` hace único el RFC por organización; el nombre repetido avisa con 409 y se puede confirmar. Antes de tocar el alta: [[0013-altas-que-no-se-pueden-duplicar]] |
| Z5 · Comercial 🟡 | LIBRE | — | — | — | — | **INC-03 desplegado y CONFIRMADO el 10/08** junto con INC-09 (`484e768`). El barrido corrio a las 11:57 y movio las 2 campanas del ensayo en seco (`KFC`, `Propuesta para cliente 1`), ni una mas. `recomputarEstadoCampanas()` en `campanas-repo.ts` sincroniza `estado_comercial` con el calendario desde `/api/estado`. Si tocas la definición de «publicada», está en la constante `SQL_PUBLICADA` y la comparten las dos reglas — y `pipelineStage()` usa el mismo criterio para `instalada`: cámbialos juntos |
| Z6 · Operaciones 🟡 | LIBRE | — | — | — | — | — |
| Z7 · Finanzas 🔴 | LIBRE | — | — | — | — | — |
| Z8 · Integraciones 🟡 | LIBRE | — | — | — | — | **INC-02 DESPLEGADO el 10/08** (`c610592`), con backfill de 16 reservas. ⚠️ Quedan 2 pantallas de **eyro** sin asignar («Campaña lista — publicar a DOOHmain» y «pruebas_produccion», 2 aprobados cada una): el día que alguien las apruebe, el guard las rebotará. Se cierra desde un usuario de eyro. `DOOHMAIN_PUBLISH_ENABLED=1` en producción: la publicación es REAL. `publicarCampanaEnDoohmain()` ya no manda el producto cruzado — cada pantalla recibe su pieza asignada, con `veces` como `cantDia`. Sin `spots_por_dia` NO se manda cuota (las 16 reservas de prod lo tienen en NULL). Antes de tocar: [[2026-08-10]] |
| Z9 · Datos 🔴 | LIBRE | — | — | — | — | **Al día.** Últimas migraciones aplicadas en producción el 10/08: `20260807_password_resets_rls.sql`, `20260810_notificaciones_archivada_en.sql` y `20260810_arrendadores_rfc_unico.sql`. Producción en `7d27d25`, sin migraciones pendientes. Invariante: 0 tablas con `tenant_id` sin RLS+FORCE |
| Z10 · UI base 🟡 | LIBRE | — | — | — | — | `Button` se bloquea solo mientras su `onClick` esté en vuelo (10/08, A5). No cambia su API y ningún formulario se tocó. La guarda vive en `lib/clic-unico.ts` y tiene sus propias pruebas |
| Z11 · Utilidades 🟢 | LIBRE | — | — | — | — | Zona de entrada para agentes nuevos |
| Z12 · Docs 🟢 | LIBRE | — | — | — | — | Bóveda creada el 07/08 y **validada contra el código el 10/08** ([[2026-08-10]]) |

> [!important] `eyro` es el tenant de PRUEBAS (confirmado el 10/08)
> Reclasifica el «pendiente» de Z8: las 2 pantallas sin creativo asignado son de
> `eyro`, o sea **datos de ensayo**, no un cliente esperando. Sigue siendo cierto
> que rebotarán con 409 si alguien las aprueba — pero eso es la guarda haciendo
> su trabajo, no una incidencia. Ver [[multi-tenancy-y-rls]].
>
> Lo que **no** cambia: `DOOHMAIN_PUBLISH_ENABLED=1`, así que lo que salga por
> `eyro` llega a pantallas de verdad.

> [!danger] Trabajo VERIFICADO pero FUERA de `main`: rama `feat/estado-ligero`
> Segunda validación del 10/08 (tarde). `main` va por `6ecf136` y **no contiene
> V2-01**: los tres archivos nuevos no existen ahí y `arrendadores-repo.ts:319`
> sigue con `select c.*`, así que la hidratación sigue pesando 6.12 MB en
> producción.
>
> La rama tiene 4 commits que `main` no tiene; `main` tiene 2 que la rama no
> tiene. Al fusionar habrá **conflicto en el diario y en este tablero**: las dos
> ramas escribieron en ellos el mismo día.
>
> La rama trae además, ya resueltos: recuentos (66 migraciones, 88 endpoints),
> los dos enlaces rotos al ADR 0013, y el hallazgo de INC-06.

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

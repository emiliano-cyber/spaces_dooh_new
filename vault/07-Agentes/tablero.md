---
tipo: tablero
estado: verificado
actualizado: 2026-08-13
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
| Z3 · Inventario 🟡 | LIBRE | — | — | — | — | **Sin desplegar (10/08):** `rowToSitio` lleva un tercer parámetro `conMedia`; los listados van sin galería y `SiteFicha` la pide a `/api/sitios/:id/media`. Si añades un consumidor de `sitio.fotos`, recuerda que en los listados llega `[]` — mira `tieneFotos` |
| Z4 · Arrendadores 🔴 | LIBRE | — | — | — | — | **INC-07 desplegado el 10/08** (`7d27d25`). `arrendadores_tenant_rfc_uq` hace único el RFC por organización; el nombre repetido avisa con 409 y se puede confirmar. Antes de tocar el alta: `docs/adr/0013-altas-que-no-se-pueden-duplicar.md`. **11/08:** el alta guarda `direccion` (no lo hacía) y la lista permite editar arrendadores ya dados de alta — el `PATCH` existía y no lo llamaba ninguna pantalla. El contrato exige ese domicilio DOS veces |
| Z5 · Comercial 🟡 | LIBRE | — | — | — | — | **F1.3 hecha (13/08):** `cupoGlobalClientes()` lee `config_negocio` filtrando por `tenant_id` con el GUC, no solo apoyada en la RLS. La firma NO cambió. **INC-03 desplegado y CONFIRMADO el 10/08** junto con INC-09 (`484e768`). El barrido corrio a las 11:57 y movio las 2 campanas del ensayo en seco (`KFC`, `Propuesta para cliente 1`), ni una mas. `recomputarEstadoCampanas()` en `campanas-repo.ts` sincroniza `estado_comercial` con el calendario desde `/api/estado`. Si tocas la definición de «publicada», está en la constante `SQL_PUBLICADA` y la comparten las dos reglas — y `pipelineStage()` usa el mismo criterio para `instalada`: cámbialos juntos |
| Z6 · Operaciones 🟡 | LIBRE | — | — | — | — | — |
| Z7 · Finanzas 🔴 | LIBRE | — | — | — | — | — |
| Z8 · Integraciones 🟡 | LIBRE | — | — | — | — | **INC-02 DESPLEGADO el 10/08** (`c610592`), con backfill de 16 reservas. ⚠️ Quedan 2 pantallas de **eyro** sin asignar («Campaña lista — publicar a DOOHmain» y «pruebas_produccion», 2 aprobados cada una): el día que alguien las apruebe, el guard las rebotará. Se cierra desde un usuario de eyro. `DOOHMAIN_PUBLISH_ENABLED=1` en producción: la publicación es REAL. `publicarCampanaEnDoohmain()` ya no manda el producto cruzado — cada pantalla recibe su pieza asignada, con `veces` como `cantDia`. Sin `spots_por_dia` NO se manda cuota (las 16 reservas de prod lo tienen en NULL). Antes de tocar: [[2026-08-10]] |
| Z9 · Datos 🔴 | LIBRE | — | — | — | — | **Al día.** Últimas migraciones aplicadas en producción el 10/08: `20260807_password_resets_rls.sql`, `20260810_notificaciones_archivada_en.sql` y `20260810_arrendadores_rfc_unico.sql`. Producción en `7d27d25`, sin migraciones pendientes. Invariante: 0 tablas con `tenant_id` sin RLS+FORCE |
| Z10 · UI base 🟡 | LIBRE | — | — | — | — | `Button` se bloquea solo mientras su `onClick` esté en vuelo (10/08, A5). No cambia su API y ningún formulario se tocó. La guarda vive en `lib/clic-unico.ts` y tiene sus propias pruebas. **11/08: el menú va por fases del proceso** (`nav.ts`, campo `grupo` + `GRUPOS`); si añades un módulo, ponle grupo o `nav.test.ts` se pone roja |
| Z11 · Utilidades 🟢 | LIBRE | — | — | — | — | **F1.4 hecha (13/08):** nace `lib/host.ts` con `etiquetaDeHost()`, la **única** función que mira el `Host`. Una IP desnuda (`209.97.146.136`) ya no se confunde con el subdominio `209`. No resuelve marcas ni organizaciones: solo decide si el rewrite a `/portal` se dispara. Zona de entrada para agentes nuevos |
| Z12 · Docs 🟢 | LIBRE | — | — | — | — | Bóveda creada el 07/08, **validada contra el código el 10/08** y actualizada con la tarde del 10/08 ([[2026-08-10]]) |

> [!warning] V2-01 ya está en `main` — FUSIONADO el 10/08, pero SIN DESPLEGAR
> `/api/estado` deja de llevar el PDF de los contratos y las fotos de las
> pantallas. Verde en local (typecheck · 772 unitarias · 129 e2e · build), y
> `feat/estado-ligero` fusionada en `main`.
>
> **Lo que falta es desplegar y MEDIR.** Su métrica —`<500 kB`, `<1 s` en frío—
> **no está tomada**: la base local tiene 3 contratos sin adjuntos, así que solo
> se reproduce en producción.
>
> Al desplegar, comprobar **la firma `/firmar/[token]` y el export de
> contratos**: son los dos flujos que leían el documento.
>
> Del merge: el runbook de INC-02 conserva la versión de `main` (la EJECUTADA);
> la de la rama era la instantánea previa al despliegue.

> [!important] `eyro` es el tenant de PRUEBAS (confirmado el 10/08)
> Reclasifica el «pendiente» de Z8: las 2 pantallas sin creativo asignado son de
> `eyro`, o sea **datos de ensayo**, no un cliente esperando. Sigue siendo cierto
> que rebotarán con 409 si alguien las aprueba — pero eso es la guarda haciendo
> su trabajo, no una incidencia. Ver [[multi-tenancy-y-rls]].
>
> Lo que **no** cambia: `DOOHMAIN_PUBLISH_ENABLED=1`, así que lo que salga por
> `eyro` llega a pantallas de verdad.
>
> **Reinicio pedido y escrito, SIN EJECUTAR:**
> `docs/datos/20260810_reset_tenant_eyro.sql`. Borra todo `eyro` y lo recrea
> vacío. Antes de correrlo hay que **editar el correo del Dueño** (`\set
> duenio_email`) — el script aborta si no. Y **retirar de DOOHmain** lo que siga
> publicado: el borrado no lo baja de las pantallas y además pierde el rastro de
> qué era.

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

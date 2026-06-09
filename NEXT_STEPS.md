# NEXT_STEPS — Spaces DOOH

**Generado:** 2026-05-27
**Basado en:** `SYSTEM_AUDIT_REPORT.md`
**Estado actual:** producción funcionando para 1 tenant (H3DM Media). 5 bloqueadores P0 antes de escalar.

---

## TL;DR — Próximas 2 semanas

1. Arreglar `deploy.yml` (1 día).
2. Cron de `pg_dump` diario a Spaces (medio día).
3. Iniciar diagnóstico del bug PrismaPg multi-schema (1-2 semanas — en paralelo con el resto).
4. Cifrar credenciales de connectors (1 día).
5. Fix bug `fotoUrl` placeholder en comentarios del portal cliente (1 hora).

Al cerrar estos 5, el sistema queda listo para onboardar segundo tenant.

---

## Roadmap por sprints

### Sprint 1 (semana 1) — Estabilizar producción

**Objetivo:** que el deploy automatizado funcione, exista respaldo de BD, y se resuelvan los 3 bugs visibles más urgentes.

| # | Tarea | Archivo | Esfuerzo | Owner | Prioridad |
|---|---|---|---|---|---|
| 1 | Agregar `npx prisma generate` a `deploy.yml` (paso CI + script remoto) | `.github/workflows/deploy.yml` | 30 min | DevOps | **P0** |
| 2 | Agregar `bash infra/scripts/migrate-all-tenants.sh` tras `migrate deploy` | `.github/workflows/deploy.yml` línea ~56 | 15 min | DevOps | **P0** |
| 3 | Cron diario `pg_dump` a DO Spaces con retención 30 días | nuevo `infra/scripts/backup-pg.sh` + crontab en `setup-droplet.sh` | 4 h | DevOps | **P0** |
| 4 | Cifrar credenciales de connectors (AES-256-GCM con key en env) | `connectors/connector.registry.ts:35`, nueva utility en `core/crypto/` | 1 día | Backend | **P0** |
| 5 | Fix `fotoUrl` placeholder en comentarios portal cliente | `portal-cliente.service.ts:200,223` | 1 h | Backend | **P0** |
| 6 | Investigar fallas reales de `verify-frontend.test.ts` (500 en `/ordenes-trabajo`) | `tests/verify-frontend.test.ts`, `modules/operaciones/ots.routes.ts` | 2 h | Backend | **P1** |
| 7 | UptimeRobot apuntando a `https://market.adavailable.com/health` | externo | 30 min | DevOps | **P1** |

### Sprint 2 (semana 2) — Diagnóstico multi-tenant + seguridad

**Objetivo:** descubrir si el bug es de `@prisma/adapter-pg@7.7.0`, de uso, o requiere otro patrón. Cerrar las 4 vulns HIGH.

| # | Tarea | Detalle | Esfuerzo | Prioridad |
|---|---|---|---|---|
| 8 | Reproducir bug de aislamiento PrismaPg en script aislado | `apps/api/scripts/repro-multi-tenant.ts` (crear) — insertar en 2 schemas y verificar `count()` | 4 h | **P0** |
| 9 | Probar workaround 1: `SET search_path TO {schema}` en `$queryRaw` antes de cada query | refactor de `getPrismaForTenant` | 1 día | **P0** |
| 10 | Probar workaround 2: una `databaseUrl` distinta por tenant con `?schema=` | requiere bump de `connection_limit` y revisión de pooling | 1 día | **P0** |
| 11 | Probar workaround 3: ejecutar `prisma migrate` por schema manualmente y verificar adapter | — | 4 h | **P0** |
| 12 | Si nada funciona: abrir issue en `prisma/prisma` y considerar downgrade a `@prisma/adapter-pg@7.5` o anterior estable | — | 1 día | **P0** |
| 13 | `npm audit fix` para vulns moderate-only (postcss, uuid, turbo) | root + apps | 2 h | **P1** |
| 14 | Plan de bump de `next@14.2.x → 14.2.latest` (4 vulns HIGH chained) | regression test manual login + 1 página por módulo | 1 día | **P1** |
| 15 | Plan de bump de `fastify@5.8.4 → 5.x.latest` | re-correr suite de tests con Redis levantado | 1 día | **P1** |

### Sprint 3 (semanas 3-4) — Features pendientes

**Objetivo:** cerrar features incompletas del V1 que ya tienen modelo y service pero no UI.

| # | Tarea | Archivos | Esfuerzo |
|---|---|---|---|
| 16 | UI Licencias y Permisos (`/inmuebles/licencias/page.tsx` + form) | nuevo en `apps/web/app/(inmuebles)/inmuebles/licencias/` | 2 días |
| 17 | UI Incidencias (`/inmuebles/incidencias/page.tsx` + form) | nuevo en `apps/web/app/(inmuebles)/inmuebles/incidencias/` | 2 días |
| 18 | Flujo D: incidencia → alerta a Comercial (event bus + UI badge en campaña) | `incidencias.service.ts`, `event-bus.ts`, `components/campanas/IncidenciaBadge.tsx` (nuevo) | 1 semana |
| 19 | Password reset por email (Resend) | `auth.routes.ts`, `email.service.ts`, nueva página `/auth/reset` | 2 días |
| 20 | Job alerta vencimiento de licencias (separado del de contratos) | `jobs/alert-licencias.job.ts` (nuevo) + scheduler | 1 día |

### Sprint 4 (semanas 5-6) — Deuda técnica de schema

**Objetivo:** eliminar el grueso de los 148 `(prisma as any)` agregando FKs reales al schema.

| # | Tarea | Detalle | Esfuerzo |
|---|---|---|---|
| 21 | Agregar `@relation` a `OrdenTrabajo.sitioId`, `asignadoAUserId`, `supervisorUserId`, `creadoPorUserId`, `revisadoPorUserId`, `campanaId` | migración + regenerar Prisma + arreglar uses | 1 día |
| 22 | Agregar `@relation` a `EvidenciaOT.uploadedBy` (User) | migración + uses | 4 h |
| 23 | Agregar `@relation` a `Incidencia.reportadoPorUserId` | migración + uses | 4 h |
| 24 | Agregar `@relation` a `Creatividad.subioPorUserId`, `campanaId` (ya existe) | migración + uses | 4 h |
| 25 | Agregar `@relation` a `AuditLog.userId`, `ComentarioPublico.userId`, `clienteId` (ya existe) | migración + uses | 4 h |
| 26 | Agregar `@relation` a `CampaignLine.sitioId`, `Pantalla.sitioId` | migración + uses | 4 h |
| 27 | Eliminar `(prisma as any)` de servicios y aprovechar `include` con type-safety | refactor masivo de `*.service.ts` | 3-4 días |
| 28 | Correr tests completos y typecheck para validar | — | 1 día |

### Sprint 5 (semanas 7-8) — Primer connector real

**Objetivo:** implementar DOOHmain connector real (es la prioridad según prompt §12: "Supply principal en LATAM").

| # | Tarea | Detalle | Esfuerzo |
|---|---|---|---|
| 29 | Reunir documentación API DOOHmain con cliente | externo | 2 días |
| 30 | Implementar `DoohmainConnector.publish()` real (POST a /campaigns con instrucción) | `connectors/doohmain/doohmain.connector.ts:8` | 3 días |
| 31 | Implementar `pause`, `resume`, `cancel` reales | mismo archivo | 2 días |
| 32 | Implementar `getDeliveryReport` con polling/webhook | mismo archivo | 2 días |
| 33 | Tests de integración (mockear API DOOHmain) | `tests/connectors/doohmain.test.ts` (nuevo) | 2 días |
| 34 | UI de configuración del connector en `/admin/connectors/page.tsx` (nuevo) | nuevo | 2 días |

### Sprint 6 (semanas 9-10) — Design System v2 — Fase 1

**Objetivo:** decidir si reabrir el DS v2 o oficializar el actual. Si se reabre, empezar progresivo.

> **Pregunta para el cliente:** ¿se sigue queriendo el rediseño Tesla/SpaceX-style del PDF, o el estado actual (inline styles funcionales) es aceptable como producto MVP?

Si la respuesta es "sí, reabrir":

| # | Tarea | Esfuerzo |
|---|---|---|
| 35 | Instalar Tailwind y configurar `tailwind.config.ts` según §12.3 del DS | 4 h |
| 36 | Crear `apps/web/styles/tokens.css` con TODAS las vars del §3 (nombres correctos: `--text`, `--spaces-accent`, `--tenant-accent`, `--mod-*`) | 4 h |
| 37 | Cargar JetBrains Mono via `next/font/google` en `layout.tsx` | 1 h |
| 38 | Crear `apps/web/components/ui/Button.tsx` con 5 variantes (§7.1) | 4 h |
| 39 | Crear `Input.tsx`, `Badge.tsx`, `Table.tsx`, `Card.tsx` base | 2 días |
| 40 | Copiar `DESIGN_SYSTEM.md` a `apps/web/DESIGN_SYSTEM.md` + `design/reference.html` (pedir el html original) | 1 h |
| 41 | Agregar bloque DS al `CLAUDE.md` raíz (crear el archivo) | 30 min |
| 42 | Rediseñar Login con hero 84px + tech row + tags módulos | 1 día |

### Sprint 7-8 (semanas 11-14) — Design System v2 — Migración progresiva

| # | Tarea | Esfuerzo |
|---|---|---|
| 43 | Migrar módulo Inmuebles a Tailwind + componentes UI base | 3 días |
| 44 | Migrar módulo Comercial | 3 días |
| 45 | Migrar módulo Operaciones | 3 días |
| 46 | Migrar Admin + Portal cliente | 3 días |
| 47 | Auditoría visual lado a lado con `reference.html`; pasar checklist §13 | 1 día |

### Sprint 9+ (mes 4+) — V2 del roadmap original

Items grandes del prompt arquitectura aún sin tocar:

- **Imprenta** (módulo completo): tabla, service, routes, UI, integración con portal cliente. ~3 semanas.
- **Finanzas/Cobranza** (facturas, recordatorios automáticos, integración PAC mexicano): ~6 semanas.
- **Settlement programático** (statements de SSP, conciliación): ~3 semanas.
- **Búsqueda avanzada Meilisearch** o FTS Postgres: ~2 semanas.
- **WhatsApp via Twilio** para notificaciones de campo: ~1 semana.
- **PostGIS + queries geoespaciales** (search por radio, clusters): ~2 semanas.
- **Tests frontend con Playwright** (login, crear OT, subir evidencia, portal cliente): ~2 semanas.
- **APM / métricas en producción** (OpenTelemetry → Grafana Cloud o Datadog free tier): ~1 semana.

---

## Pendientes detallados por categoría

### Errores conocidos a corregir
- [ ] `portal-cliente.service.ts:200,223` — fotoUrl placeholder
- [ ] `connector.registry.ts:35` — base64 no es encriptación
- [ ] `db/client.ts:18-22` + uso en `tenant.plugin.ts:74` — adapter no aísla schemas
- [ ] `.github/workflows/deploy.yml` — falta `prisma generate` (línea 30 y dentro del SSH script)
- [ ] `.github/workflows/deploy.yml` — falta `migrate-all-tenants.sh` (línea ~56)
- [ ] `tests/verify-frontend.test.ts` — 3/3 retornan 500 (investigar)
- [ ] Logs `console.log` en connectors → migrar a `app.log` o pino (5+5+5+5+2 ocurrencias)

### Mejoras de calidad
- [ ] Agregar `eslint` al pipeline CI (`turbo run lint`)
- [ ] Agregar husky + lint-staged para Prettier pre-commit
- [ ] Mover RHF + Zod a forms críticos (campañas, OTs, sitios) — hoy hay validación manual en muchos lugares
- [ ] Agregar paginación a endpoints que no la tienen (sitios, campañas, OTs ya la tienen; revisar arrendadores, clientes, audit-log)
- [ ] Eliminar `(prisma as any)` (148 ocurrencias) — depende de Sprint 4
- [ ] Documentar endpoint API en OpenAPI / Swagger (con `@fastify/swagger`)

### Operaciones / DevOps
- [ ] Cron `pg_dump` diario → DO Spaces
- [ ] UptimeRobot → `/health`
- [ ] Configurar Resend domain verification + DKIM/SPF
- [ ] Configurar alerts a Slack/email cuando `/health` devuelve `degraded`
- [ ] Documentar runbook de incidentes en `docs/runbook.md` (no existe)
- [ ] Considerar tabla `health_checks` + cron que escriba latencias para histórico

### Seguridad
- [ ] Cifrar credenciales connectors (AES-256-GCM)
- [ ] Password reset por email
- [ ] `npm audit fix` rutinario en CI (fail si HIGH+)
- [ ] Considerar 2FA opcional para owner/admin
- [ ] Revisar CORS — actualmente acepta `/https?:\/\/.*/` en prod (regex muy laxa)
- [ ] Considerar Content Security Policy header

### Frontend
- [ ] Tests con Playwright (login, OT, portal cliente)
- [ ] Decidir DS v2 vs estado actual
- [ ] Componentes UI base reutilizables
- [ ] Reducir 2100 inline styles a <500 con migración Tailwind o CSS modules
- [ ] Storybook (opcional) para componentes UI base si se reabre el DS

### Features V2/V3 del prompt arquitectura
- [ ] Imprenta
- [ ] Finanzas / Cobranza
- [ ] Settlement programático
- [ ] Meilisearch
- [ ] WhatsApp Twilio
- [ ] PostGIS
- [ ] API pública de disponibilidad
- [ ] Marketplace connect / SSP layer

---

## Decisiones pendientes para el cliente

1. **DS v2 — ¿reabrir o cerrar?** Costo total de migración progresiva: 4-6 semanas. Beneficio: producto visualmente alineado con la marca Spaces tipo Tesla/SpaceX. Si no se reabre, oficializar el estado actual como diseño v1 simplificado.

2. **¿Qué connector implementar primero (DOOHmain, Broadsign, Invian)?** Default: DOOHmain por ser supply principal en LATAM, pero el cliente que entre puede tener otro CMS.

3. **¿Implementación de Imprenta y Finanzas o seguir solo con OOH operativo + DOOH manual?** El módulo Imprenta requiere flujo nuevo end-to-end (~3 semanas) y Finanzas integración con PAC mexicano (~6 semanas). Ambos son V2 según prompt original.

4. **¿Aceptamos PrismaPg roto y movemos toda la data a un solo tenant compartido con row-level security (`tenantId` en cada tabla)?** Sería un giro arquitectónico pero elimina el bloqueador y simplifica operaciones.

5. **¿Onboarding asistido vs autoservicio para nuevos tenants?** El wizard de admin (commit `74ab981`) ya cubre el 80 % del onboarding técnico — falta el bloqueador multi-tenant para liberar la función real.

---

## Siguiente fase recomendada

**Si se priorizan ingresos:** Sprint 1 + Sprint 2 + Sprint 5 (connector DOOHmain real) = ~6 semanas para tener un sistema que pueda firmar segundo cliente DOOH.

**Si se prioriza producto:** Sprint 1 + Sprint 3 + Sprint 4 = ~6 semanas para cerrar features V1 incompletas y limpiar deuda técnica que hoy frena velocidad.

**Si se prioriza marca:** Sprint 1 + Sprint 6-8 (Design System v2) = ~8 semanas para alinear el frontend con la promesa visual del PDF.

**Mi recomendación:** **Sprint 1 sí o sí** (5 fixes P0 antes de cualquier otra cosa). Luego elegir UNA de las 3 direcciones según el momento del negocio. La que sugiero primero es ingresos (Sprint 2 + Sprint 5), porque la deuda técnica y el DS pueden esperar — el bloqueador multi-tenant + connector real no.

---

*Fin del roadmap. Acompañado por `SYSTEM_AUDIT_REPORT.md` para diagnóstico completo.*

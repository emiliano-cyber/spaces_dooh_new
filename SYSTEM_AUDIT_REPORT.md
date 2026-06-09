# SYSTEM AUDIT REPORT — Spaces DOOH

**Auditor:** Claude Opus 4.7 (1M context)
**Fecha:** 2026-05-27
**Rama:** `main` (último commit `74ab981` — wizard onboarding cliente)
**Alcance:** comparación PDF `ALL_PROJECT_PROMPTS.pdf` (59 pp.) vs estado actual del repo `/mnt/c/Users/hm284/spaces-dooh`
**Modo:** read-only. No se modificó ningún archivo de código fuente.

> **Nota sobre el PDF:** el documento `ALL_PROJECT_PROMPTS.pdf` no contiene capa de texto extraíble (impreso desde Microsoft Print To PDF como raster). Para reconstruir los prompts originales se usaron las versiones markdown fuente presentes en `C:\Users\hm284\Downloads\`: `SPACES_Architecture.md`, `DESIGN_SYSTEM.md`, `claude-code-setup.md` y `dooh-manager-claude-code-prompt.md`. El cuerpo del PDF coincide en título (`ALL_PROJECT_PROMPTS.md`) y la composición de los cuatro documentos da ~59 páginas.

---

## Estado General del Proyecto

| Métrica | Valor |
|---|---|
| Tamaño total monorepo | **~21.5 k LOC TypeScript** (5,546 API + 13,095 Web + 1,915 tests + 569 Prisma schema) |
| Archivos `.ts` API | 57 |
| Archivos `.tsx`/`.ts` Web | 57 |
| Tests | 11 archivos / 85 specs (11 pass, 3 fail real, 71 skipped) |
| Migraciones Prisma | 11 |
| Modelos Prisma | 23 |
| Connectors implementados | 1 de 4 (solo `MANUAL`) |
| Vulnerabilidades npm | 17 (13 moderadas, 4 altas, 0 críticas) |
| Tenants en producción | 1 (H3DM Media) |

### Porcentajes globales

- **% completado vs scope V1 del prompt arquitectura:** ≈ **70 %**
- **% completado vs scope V2 (conectores, settlements, búsqueda avanzada):** ≈ **15 %**
- **% funcional en producción (lo construido, funcionando):** ≈ **85 %**
- **% del Design System v2 implementado:** ≈ **20 %** (tokens parciales; sin Tailwind, sin componentes UI base, sin reference.html, sin DESIGN_SYSTEM.md en repo)
- **Nivel de estabilidad operativa:** **Medio-Alto** — un solo tenant vivo, 15 OTs activas, 6 portal-clientes, ~26 sitios, ~621 evidencias. Sin caídas reportadas las últimas 2 semanas tras `f86c17a`.

**Veredicto general:** El sistema **funciona en producción para un tenant**, cubre el flujo OOH de punta a punta (sitios → campaña → OT → evidencias → portal cliente) y tiene autenticación/RBAC reales. **No está listo para escalar** por dos bloqueadores: (1) el bug de aislamiento de schemas en `PrismaPg` y (2) connectors CMS sin implementar. El frontend funciona pero **no respeta el design system v2** definido en los prompts.

---

## Funcionalidades Detectadas

| Módulo | Estado | Avance | Errores / Notas |
|---|---|---|---|
| **Core — Auth (JWT + Refresh rotation)** | ✅ Implementado | 95 % | Refresh con SHA-256 hash, rotación al refrescar, cookie httpOnly + sessionStorage. **Falta password reset.** |
| **Core — Multi-tenant (schema-per-tenant)** | ⚠️ Implementado pero roto | 60 % | `PrismaPg` adapter no aísla por schema en runtime (HANDOFF §6.1). Toda la data vive físicamente en `tenant_template`, no en `tenant_h3dm`. **Bloqueador para segundo cliente.** |
| **Core — RBAC** | ✅ Implementado | 85 % | Permisos string-based, owner/admin bypass, `*` wildcard. No tiene Field-Level Security (precio_compra, margen_neto, etc.) que pide §4.3 del prompt. |
| **Core — Audit log** | ✅ Implementado | 80 % | Modelo `AuditLog` + servicio + UI en `/admin/audit-log`. |
| **Inmuebles — Sitios + mapa** | ✅ Implementado | 90 % | CRUD completo, MapLibre integrado, fotos, estatus triple (comercial/legal/operativo). |
| **Inmuebles — Contratos** | ✅ Implementado | 85 % | CRUD, vencimientos, pagos de renta. |
| **Inmuebles — Arrendadores** | ✅ Implementado | 80 % | CRUD. |
| **Inmuebles — Licencias/permisos** | ⚠️ Parcial | 60 % | Modelo + servicio existen, **UI dedicada faltante** (sin `/inmuebles/licencias/page.tsx`). |
| **Inmuebles — Incidencias** | ⚠️ Parcial | 60 % | Servicio en `incidencias.service.ts`, sin página UI dedicada. |
| **Inmuebles — Alertas** | ✅ Implementado | 85 % | Job BullMQ `alertas-vencimiento` corriendo, UI en `/inmuebles/alertas`. Email Resend integrado. |
| **Operaciones — OTs (lista + detalle + nueva)** | ✅ Implementado | 95 % | CRUD, asignación, supervisión, revisión, estatus extendidos (BLOQUEADA, EN_REVISION, RECHAZADA). |
| **Operaciones — Móvil (OTMovil.tsx)** | ✅ Implementado | 90 % | Componente único, checklist, fotos (cámara + galería), geolocalización, sesiones laborales, visitas estructuradas. |
| **Operaciones — Calendario** | ⚠️ Parcial | 50 % | Página `/operaciones/calendario` existe, datos básicos. |
| **Operaciones — Mis sitios** | ✅ Implementado | 80 % | Vista de sitios asignados al field worker. |
| **Operaciones — Evidencias agrupadas/eliminadas/editadas** | ✅ Implementado | 95 % | Admin sube/borra fotos individuales, agrupado por día, backdate al crear visita. |
| **Comercial — Dashboard** | ✅ Implementado | 80 % | KPIs, semáforos. |
| **Comercial — Campañas (lista + detalle + nueva)** | ✅ Implementado | 85 % | Flujo DRAFT→…→LISTA_FACTURAR, OC, fotos comprobatorias, reporte, portal. |
| **Comercial — Inventario** | ✅ Implementado | 85 % | Lista + mapa + detalle. |
| **Comercial — Clientes** | ✅ Implementado | 70 % | CRUD básico. |
| **Comercial — Digital / Tráfico** | ⚠️ Solo UI placeholder | 30 % | Página `/comercial/digital`, traffic.routes + traffic.service en backend, **pero los connectors reales lanzan `throw new Error('credenciales no configuradas')`** — únicamente `ManualConnector` funciona. |
| **Comercial — Readiness check** | ✅ Implementado | 90 % | Service computado + panel + auto-recheck por evento `ot.completada`. |
| **Portal cliente (token público, link compartible)** | ✅ Implementado | 85 % | `/portal/:token` carga campaña + creatividades, upload de creativos (multipart). |
| **Portal cliente (login + sitios + comentarios)** | ✅ Implementado | 80 % | bcrypt, JWT 7d, lista de sitios, OTs por sitio, comentarios bidireccionales. **Bug:** comentarios guardan `fotoUrl = 'https://placeholder.storage/...'` en lugar de URL real (`portal-cliente.service.ts:200,223`). |
| **Admin — Usuarios** | ✅ Implementado | 85 % | CRUD + reset password + activar/desactivar. |
| **Admin — Roles** | ✅ Implementado | 80 % | CRUD de roles con array de permisos. |
| **Admin — Configuración tenant** | ✅ Implementado | 70 % | Página `/admin/config`. |
| **Admin — Portal-clientes** | ✅ Implementado | 80 % | Banner copiable post-creación, asignación de sitios (commit `bc72d98`). |
| **Admin — Onboarding wizard 4 pasos** | ✅ Implementado | 90 % | Commit `74ab981`. Pasos: tenant → sitios → accesos → revisar. Genera passwords con `generatePassword()`. |
| **Almacenamiento — DigitalOcean Spaces (S3)** | ✅ Implementado | 95 % | Presigned upload/get, `buildKey` namespacing por tenant/entidad. |
| **Email — Resend** | ✅ Implementado | 80 % | `email.service.ts` envía emails (alertas, reset). |
| **Jobs — BullMQ** | ⚠️ Solo 2 jobs | 40 % | `alertas-vencimiento` y `readiness-check`. **Faltan**: cms-sync, settlements, notificaciones-push, generación de reportes. |
| **Connectors — MANUAL** | ✅ Implementado | 100 % | Funciona como fallback. |
| **Connectors — DOOHMAIN** | ❌ Stub | 5 % | `throw new Error('credenciales no configuradas')` en publish/pause/resume/cancel/getDeliveryReport. Solo `healthCheck` hace fetch real. |
| **Connectors — BROADSIGN** | ❌ Stub | 5 % | Idem. |
| **Connectors — INVIAN** | ❌ Stub | 5 % | Idem. |
| **Imprenta** | ❌ No implementado | 0 % | Pendiente V2. No hay módulo, ni tabla `ordenes_impresion`, ni UI. |
| **Finanzas / Cobranza** | ❌ No implementado | 0 % | Sin tabla `facturas`, `cobranza_seguimiento`. Solo el ítem `LISTA_FACTURAR` del flujo. |
| **Settlement programático** | ❌ No implementado | 0 % | Sin tabla `settlements_programaticos`, sin job, sin UI. |
| **Búsqueda Meilisearch** | ❌ No implementado | 0 % | V2 según prompts. Solo filtros simples por query string. |
| **WhatsApp (Twilio / Meta)** | ❌ No implementado | 0 % | V2. |
| **PostGIS / queries geoespaciales** | ❌ No implementado | 0 % | Sitios usan `Decimal` lat/lng, no `geography`. |
| **API pública de disponibilidad / marketplace connect** | ❌ No implementado | 0 % | V3. |
| **DOOH Manager (sub-marca interna)** | ❌ No relacionado | 0 % | Proyecto separado del prompt `dooh-manager-claude-code-prompt.md`. **No vive en este repo.** El prompt apuntaba a `~/repos/dooh-manager`. |

---

## Comparación Contra Prompts (PDF)

> El PDF se ensambla de 4 documentos fuente; las filas siguen ese orden lógico.

### A. SPACES_Architecture.md — Arquitectura V1/V2/V3

| Tarea / Sección | Implementado | Archivos / Evidencia | Observaciones |
|---|---|---|---|
| Monolito modular con bounded contexts (`/modules/inmuebles`, operaciones, comercial, digital, imprenta, finanzas, core) | **Parcial** | `apps/api/src/modules/` tiene: inmuebles, operaciones, comercial, digital, admin, portal-cliente, dev. **Sin imprenta, sin finanzas.** | El módulo `core/` se desglosó como `core/auth`, `core/tenant`, `core/audit`, `core/email`, `core/events`, `core/upload` — coherente con el prompt. |
| Stack Next.js 14 + Fastify + Postgres + Redis + BullMQ + Prisma | **Sí** | `package.json` raíz + apps. Versiones reales: Next 14.2.29, Fastify 5.8.4, Prisma 7.7.0, BullMQ 5.73.1, Redis via ioredis 5.10.1 | Tailwind **NO instalado** (spec V1 lo requería). |
| Multi-tenant schema-per-tenant con Prisma | **Parcial / roto** | `apps/api/src/db/client.ts` usa `PrismaPg` adapter con `{ schema }`. `tenant.plugin.ts` resuelve por x-tenant-slug. | **Bug crítico:** adapter no aísla — toda la data del tenant H3DM físicamente en `tenant_template`. Confirmado por HANDOFF §6.1. |
| Auth: JWT + Refresh rotation + cookie httpOnly | **Sí** | `auth.service.ts` (jose, bcryptjs), tokens 15m/7d, sha256 del refresh, rotation al refrescar. | Falta MFA opcional para roles financieros (no aplica aún porque no hay módulo finanzas). |
| RBAC con 15 roles (super_admin, owner, admin, …) | **Parcial** | `rbac.guard.ts` + `Role` con array de permisos. | No hay roles `super_admin`, `auditor`, `agency_external` aún. Solo se observan: owner, admin, seller, comercial_manager, operaciones_manager, crew_chief, field_worker, trafficker en el código. |
| Catálogo de Tipos de Venta (`SPOT_UNIT`, `DAY_PACK`, `SOV`, `PROG_*`, `MAKEGOOD`, `HOUSE_AD`) | **Sí** | `schema.prisma:201-215` `enum TipoVenta` con los 11 valores. | ✓ |
| Máquinas de estado: comercial / técnico / facturación / settlement | **Parcial** | `EstComercialCampana` (7 valores) y `EstTecnico` (5) implementados. **Estado financiero como tal no existe** (solo el ítem `LISTA_FACTURAR` dentro del enum comercial). Sin estado settlement. | Sin máquina formal — son enums sueltos. |
| Sitios con `lat/lng` + PostGIS | **Parcial** | `Sitio.lat/lng Decimal(10,8)`. **Sin extensión PostGIS, sin tipo geography.** | Mapas funcionan con coords decimales pero no hay queries geoespaciales eficientes. |
| Contratos arrendamiento + pagos renta + alertas | **Sí** | `ContratoArrendamiento`, `PagoRenta`, job `alertVencimientosProcessor`, `RESEND_API_KEY`. | ✓ |
| Licencias/permisos con alerta de vencimiento | **Parcial** | `LicenciaPermiso` modelo + service. **Sin UI dedicada, sin job de alerta separado.** | El job de alertas actual cubre solo contratos. |
| Incidencias con impacto a campañas activas | **Parcial** | `Incidencia` modelo + service. **No emite alerta cross-módulo a Comercial** (no hay UI ni la trigger). | Flujo D del prompt sin implementar. |
| Órdenes de trabajo con asignación + checklist + fotos geoloc | **Sí** | `OrdenTrabajo`, `EvidenciaOT.lat/lng/precision`, `OTMovil.tsx`. | ✓ |
| Portal cliente con upload de creativos | **Sí** | `/portal/:token`, `portalToken` en `Campana`, `validateUpload`, multipart 500 MB. | ✓ |
| OC recibida + readiness checklist + candado de facturación | **Sí** | `ocRecibida` Bool, `fotosComprobatorias`, `reportePublicacion`, `readiness.service.ts`, `ReadinessPanel.tsx`. | ✓ |
| Connector pattern (`CMSConnector` interface, adapters por CMS) | **Parcial** | `connector.interface.ts` define `CMSConnector` con 6 métodos; `ConnectorRegistry` con factory; 4 connectors. | **3/4 son stubs** que lanzan `throw new Error('credenciales no configuradas')`. Solo `MANUAL` funciona. |
| BullMQ jobs (notificaciones, cms-sync, settlements, reportes) | **Parcial** | Solo 2 jobs: `alertas-vencimiento`, `readiness-check`. | Faltan: cms-sync, settlements, generación de reportes pesados, WhatsApp. |
| Storage en DigitalOcean Spaces (S3-compatible) | **Sí** | `@aws-sdk/client-s3`, `s3-request-presigner`, `db/storage.ts`, env `DO_SPACES_*`. | ✓ |
| WhatsApp via Twilio / Meta | **No** | — | V2 según prompt. |
| Emails via Resend | **Sí** | `resend@6.10.0`, `core/email/email.service.ts`. | ✓ |
| Mapas MapLibre + tiles OpenStreetMap | **Sí** | `maplibre-gl@5.22.0`, `components/maps/SitiosMap.tsx`. | ✓ (sin Maptiler suscripción). |
| Búsqueda PostgreSQL FTS / Meilisearch | **No** | — | V1/V2 según prompt. |
| `audit_log` + Winston | **Parcial** | Modelo `AuditLog`, service propio. **Sin Winston** — usa el logger pino-pretty de Fastify. | El pino es equivalente o mejor. |
| Deploy DO Droplet + Nginx + PM2 + certbot | **Sí** | `infra/nginx/spaces.conf`, `infra/scripts/setup-droplet.sh`, `ecosystem.config.js` (fork mode con crash limits), GH Actions. | ✓ |
| Estructura monorepo Turborepo (`apps/`, `packages/`, `infra/`) | **Sí** | `turbo.json`, workspaces `apps/*` + `packages/*`. | ✓ |
| Packages: `shared-types` y `shared-utils` con readiness + state-machine | **Sí** | `packages/types/`, `packages/utils/` (dates, permissions, readiness). | Falta `state-machine.ts` explícito; la lógica vive dispersa en services. |
| Tests Vitest (unit) + Playwright (e2e) | **Parcial** | Vitest en backend (11 archivos, 85 specs). **Sin Playwright, sin tests en frontend.** | HANDOFF §9 confirma: "frontend no tiene tests". |
| GitHub Actions deploy via SSH | **Sí pero defectuoso** | `.github/workflows/deploy.yml`. | **Bug crítico:** falta paso `npx prisma generate` antes del build (HANDOFF §6.2). Falta `migrate-all-tenants.sh` después de `migrate deploy` (§6.3). |

### B. DESIGN_SYSTEM.md — Sistema visual v2 + claude-code-setup.md

| Tarea | Implementado | Evidencia |
|---|---|---|
| Crear `apps/web/DESIGN_SYSTEM.md` | **No** | Archivo ausente. |
| Crear `apps/web/design/reference.html` | **No** | Directorio ausente. |
| Bloque en `CLAUDE.md` raíz con reglas no-negociables | **No** | No existe `CLAUDE.md` en raíz del repo. |
| Cargar Cabinet Grotesk + General Sans desde Fontshare | **Sí** | `app/layout.tsx:14-18` carga ambas vía `<link>`. |
| Cargar JetBrains Mono via `next/font/google` | **No** | Ninguna referencia a `next/font/google` ni a JetBrains Mono. **Mono no disponible en la app.** |
| Crear `apps/web/styles/tokens.css` con todas las vars del §3 | **Parcial** | Existen vars básicas dentro de `globals.css` (no en archivo separado). Faltan: `--text-secondary`, `--text-muted`, `--text-disabled`, `--info`, `--info-bg`, `--danger-bg`, `--tenant-accent`, `--spaces-ink`, `--mod-digital`, `--mod-admin`, `--font-display`, `--font-sans`, `--font-mono`. Nombres de vars discrepan (`--fg` vs `--text`, `--accent` vs `--spaces-accent`). |
| Tailwind config en `apps/web/tailwind.config.ts` | **No** | Tailwind no instalado (no aparece en `apps/web/package.json`, no hay `node_modules/tailwindcss`). |
| Componentes UI base (`components/ui/Button|Input|Badge|Table`) | **No** | Carpeta `apps/web/components/ui/` no existe. Componentes existentes: `campanas/`, `maps/`, `operaciones/`, `shared/`. |
| Rediseñar login con wordmark hero 84px + tech row + tags módulos | **No** | `app/(auth)/auth/login/page.tsx` usa inline styles, título 24px (no 84px), botón con `var(--accent)` azul (no `var(--text)` negro como pide §7.1). |
| Inyectar `--tenant-accent` por tenant en layout | **No** | No hay layout `(tenant)/[slug]/`. App es single-tenant en path. |
| 2,100 inline `style={...}` blocks en frontend | — | Confirma uso pesado de inline styles en lugar de Tailwind / CSS modules. Solo 1 `className=` con clases Tailwind en toda la app. |

**Resumen Design System:** ~20 % de cumplimiento. Las fuentes display+sans cargan; los tokens existen parcialmente con nombres distintos; la mayor parte del sistema (Tailwind, componentes UI base, login rediseñado, doc en repo, modo oscuro completo, tenant-accent híbrido) **no se implementó.**

### C. dooh-manager-claude-code-prompt.md — Sub-marca DOOH Manager

| Tarea | Implementado | Observación |
|---|---|---|
| Rediseño del frontend de `dooh-manager` (proyecto SEPARADO) | **N/A** | El prompt apunta a `~/repos/dooh-manager`, no vive en este repo `spaces-dooh`. **Fuera de alcance de esta auditoría.** |

---

## Problemas Críticos

### CRIT-1 · PrismaPg adapter no aísla por schema (BLOQUEADOR para 2do cliente)
- **Síntoma:** toda la data del tenant H3DM físicamente vive en `tenant_template`, no en `tenant_h3dm`. `count()` devuelve lo mismo independientemente del `schema` pasado al adapter.
- **Archivo:** `apps/api/src/db/client.ts:18-22` (`makePrisma`).
- **Causa probable:** bug del paquete `@prisma/adapter-pg@7.7.0` o uso incorrecto del `{ schema }` option.
- **Impacto:** imposible onboardar segundo tenant sin mezclar datos.

### CRIT-2 · CI/CD deploy.yml sin `prisma generate`
- **Síntoma:** `npm ci` borra `node_modules/.prisma/`; `turbo run build` falla con *"Module '@prisma/client' has no exported member 'PrismaClient'"*.
- **Archivo:** `.github/workflows/deploy.yml` líneas 26-30 (paso `Build`). Mismo bug en el script remoto al SSH del droplet (línea ~50).
- **Estado:** se arregla manualmente en cada deploy; el workflow lleva "días fallando silenciosamente" según HANDOFF §6.2.

### CRIT-3 · Migraciones de tenant no se propagan automáticamente
- **Síntoma:** cambios a `tenant_template` (template) no llegan a `tenant_h3dm` activo. Última vez detectado: columna `visitasJson` el 2026-05-18.
- **Fix faltante:** agregar `bash infra/scripts/migrate-all-tenants.sh` al workflow tras `prisma migrate deploy`.
- **Archivo:** `.github/workflows/deploy.yml` línea 53.

### CRIT-4 · 3 de 4 connectors CMS son stubs
- **Archivos:** `connectors/doohmain/`, `broadsign/`, `invian/` — todos lanzan `throw new Error('credenciales no configuradas')` en publish/pause/resume/cancel/getDeliveryReport. Solo `healthCheck` hace fetch real.
- **Impacto:** la promesa de "conectar SPACES a CMS externos" (V2 del prompt) **no existe**. Las campañas DOOH se registran pero no se publican a DOOHmain/Broadsign/Invian.

### CRIT-5 · Credenciales de connectors en base64 (no cifrado)
- **Archivo:** `connectors/connector.registry.ts:35-37` decodifica `credencialesEnc` con `Buffer.from(..., 'base64')` — es **decodificación, no descifrado**.
- **Impacto:** si la BD se compromete, las API keys de Doohmain/Broadsign/Invian quedan en texto plano.

### CRIT-6 · 17 vulnerabilidades npm (4 high)
Detalle desde `npm audit`:

| Severidad | Paquete | Issue |
|---|---|---|
| HIGH | `fastify` 5.3.2-5.8.4 | (chained) |
| HIGH | `fast-uri` ≤3.1.1 | (chained) |
| HIGH | `fast-xml-builder` ≤1.1.6 | (chained) |
| HIGH | `next` 0.9.9-16.3.0-canary.5 | múltiples advisories |
| MODERATE | `postcss` <8.5.10 | XSS via unescaped `</style>` (GHSA-qx2v-qp2m-jg93) |
| MODERATE | `turbo` ≤2.9.13-canary.1 | CSRF en login + ejecución local en Yarn detection |
| MODERATE | `uuid` <11.1.1 | buffer bounds check (afecta `bullmq`, `svix`, `resend`) |
| MODERATE | `prisma` ≥6.20.0-dev.1 | (chained) |
| MODERATE | `resend` 6.2.0-canary.0-6.12.2 | depende de `svix` vulnerable |
| MODERATE | `bullmq` ≤5.76.1 | depende de `uuid` vulnerable |

### CRIT-7 · 13 FKs faltantes en schema Prisma → abuso de `(prisma as any)`
- **Conteo real:** **148 ocurrencias** de `(prisma as any)` en `apps/api/src/`, **162 ocurrencias** de `as any` totales.
- Columnas `userId`, `sitioId` etc. en `OrdenTrabajo`, `EvidenciaOT`, `Incidencia`, `Creatividad`, `AuditLog`, `ComentarioPublico`, `CampaignLine`, `Pantalla` son `String` sueltos sin `@relation`.
- **Impacto:** no se pueden hacer JOINs eficientes, type-safety degradada en toda la capa de servicios, IntelliSense ciego.

### CRIT-8 · Sin backup automatizado de Postgres (mitigado puntualmente)
- HANDOFF §6.5: antes del backup manual del 2026-05-20 no había `pg_dump` programado. Si el disco del droplet falla, se pierde todo.
- No hay cron en `infra/scripts/setup-droplet.sh` que monte un job de backup a Spaces.

### CRIT-9 · Tests 8/9 archivos fallan (parcialmente ambiental, parcialmente real)
- 8 de 9 archivos fallan. La mayoría por `ECONNREFUSED 127.0.0.1:6379` (Redis local no levantado en el ambiente de auditoría).
- **Real:** `tests/verify-frontend.test.ts` falla 3/3 con 500 al pegar contra `/ordenes-trabajo` (LISTA, FORMULARIO, DETALLE). Investigar si depende de seed faltante o cambio de schema sin propagar.

### CRIT-10 · Event bus in-memory (no escalable)
- **Archivo:** `core/events/event-bus.ts` usa `EventEmitter` de Node. En cluster multi-proceso o multi-droplet, eventos como `ot.completada` se pierden.
- PM2 ya corre en fork (1 instancia), lo cual mitiga ahora — pero impide escalar horizontalmente.

### CRIT-11 · Bug `fotoUrl` placeholder en comentarios del portal cliente
- **Archivos:** `portal-cliente.service.ts:200,223` — al agregar comentario con foto, guarda `fotoUrl = 'https://placeholder.storage/${storageKey}'` en lugar de URL real / presigned.
- **Impacto:** las fotos de comentarios cliente/técnico no se muestran. Las evidencias OT sí funcionan (usan `getPresignedGet`).

---

## Estado del Código

### Calidad general
- **Fortalezas:** estructura modular clara por bounded context; Zod schemas en endpoints sensibles; manejo de errores Prisma centralizado en `app.ts:70-139` (P2002, P2025, ZodError, validation, rate limit); fail-fast de env vars críticas en `server.ts:9-15`; rate limiting global 100/min; CORS con regex y override por `CORS_ORIGIN`.
- **Debilidades:** 148 `(prisma as any)` rompen la type-safety en toda la capa de servicios; 2,100 bloques de inline-styles en frontend (cero Tailwind, cero CSS modules); ausencia total de tests de frontend; tests backend dependientes de DB + Redis levantados localmente.

### Organización
- **Backend:** excelente. Módulos por bounded context (`modules/inmuebles/`, `operaciones/`, etc.), capa `core/` con auth/tenant/audit/email/events/upload bien separada, `connectors/` con interface explícita, `jobs/` con scheduler centralizado.
- **Frontend:** correcto pero con deuda. Route groups Next 14 (`(auth)`, `(comercial)`, etc.) bien usados. Falta carpeta `components/ui/` base — los componentes específicos por módulo (`campanas/`, `operaciones/`, `maps/`) están bien.

### Escalabilidad
- **Limitada por 3 factores:**
  1. Multi-tenant roto en el adapter (no aísla data).
  2. Event bus in-memory (no funciona en cluster).
  3. Connectors stub (no se puede vender DOOH real).
- **Multi-tenant a nivel infraestructura sí escala:** Nginx routing por subdominio + schemas por tenant — el diseño es correcto, solo el adapter no lo respeta.

### Rendimiento
- Sin métricas en producción (no hay APM, no hay Grafana). HANDOFF reporta 15 OTs activas, ~26 sitios, ~621 evidencias — volumen bajo, sin presión.
- Sin paginación obvia en algunos endpoints listado; el frontend usa React Query con `staleTime: 60s`.
- `health` endpoint mide latencia de DB y Redis — útil para monitoring externo (no configurado).

### Calidad de código
- **TypeScript strict** activo en ambos apps. Typecheck pasa limpio en api y web (45 s total). ✓
- **Sin ESLint corriendo en CI** (workflow no ejecuta `npm run lint`).
- **Sin Prettier en pre-commit** (no hay husky / lint-staged).

---

## Logs Técnicos

### Errores reales detectados durante la auditoría

```
[npm audit] 17 vulnerabilities (13 moderate, 4 high, 0 critical)
  - HIGH: fastify@5.3.2-5.8.4, next@0.9.9-16.3.0, fast-uri, fast-xml-builder
  - MODERATE: postcss<8.5.10 (XSS), turbo<=2.9.13 (CSRF), uuid<11.1.1, prisma, resend, bullmq
```

```
[vitest backend] 8/9 archivos fallan
  ✗ tests/auth.test.ts (skipped — Redis no disponible)
  ✗ tests/comercial.test.ts (skipped)
  ✗ tests/e2e.test.ts (skipped)
  ✗ tests/extra_checks.test.ts (skipped)
  ✗ tests/golive.test.ts (skipped)
  ✗ tests/operaciones.test.ts (skipped)
  ✗ tests/rbac.test.ts (skipped)
  ✗ tests/readiness.test.ts (skipped)
  ✗ tests/verify-frontend.test.ts (FALLA REAL — 3/3 retornan 500 en /ordenes-trabajo)
    → verify-frontend.test.ts:22 (LISTA),:45 (FORMULARIO),:66 (FORMULARIO POST)
  ✓ 1 archivo pasa
```

```
[grep código]
  148 ocurrencias de (prisma as any) en apps/api/src/
  162 ocurrencias de `as any` totales en backend
  2100 inline style={...} blocks en frontend
  1 className con clases de utilidad (no Tailwind real)
  0 archivos *.module.css
```

```
[design system gap]
  Faltantes en apps/web/:
    - DESIGN_SYSTEM.md
    - design/reference.html
    - styles/tokens.css (vars dispersas en globals.css con nombres distintos)
    - tailwind.config.ts (Tailwind no instalado)
    - components/ui/ (carpeta inexistente — sin Button/Input/Badge/Table base)
  Faltantes en raíz:
    - CLAUDE.md con bloque de reglas no-negociables del DS v2
```

```
[bug específico ubicación exacta]
  apps/api/src/modules/portal-cliente/portal-cliente.service.ts
    línea 200: fotoUrl = storageKey ? `https://placeholder.storage/${storageKey}` : null
    línea 223: idem en addComentarioTecnico
  → comentarios con foto guardan URL placeholder, no la real ni una presigned
```

```
[workflow deploy.yml gaps]
  .github/workflows/deploy.yml
    Falta entre línea 30 (Build) y línea 31 (Deploy via SSH):
      - name: Generate Prisma client
        run: cd apps/api && npx prisma generate

    Falta entre línea 52 (Building) y línea 54 (Running database migrations):
      - el `cd apps/api && npx prisma generate` también en remoto
    Falta entre línea 56 (migrate deploy) y línea 58 (Reloading PM2):
      - bash infra/scripts/migrate-all-tenants.sh
```

### Endpoints con `console.log` que deberían usar logger
- `connectors/manual/manual.connector.ts:8,15,19,23` — 4 logs
- `connectors/doohmain/doohmain.connector.ts:9,14,19,24,32` — 5 logs
- `connectors/broadsign/...` — similar
- `connectors/invian/...` — similar
- `connectors/connector.registry.ts:17,39` — 2 warnings

---

## Recomendaciones

### Prioridad P0 — Bloqueadores de producción / nuevos clientes
1. **Diagnosticar y arreglar el bug de aislamiento de PrismaPg multi-schema.** Sin esto no entra un segundo tenant. Tiempo estimado: 1-2 semanas (puede requerir reescribir el datasource manager para usar `SET search_path` en `$queryRaw` antes de cada query, o migrar a `databaseUrls` por tenant con `connection_limit`).
2. **Arreglar `.github/workflows/deploy.yml`** — agregar `prisma generate` y `migrate-all-tenants.sh`. Tiempo: 1-2 h.
3. **Cron de `pg_dump` diario** al droplet con upload a Spaces. Tiempo: 30 min.

### Prioridad P1 — Riesgos de seguridad / data
4. **Cifrar (no codificar) credenciales de connectors** con `node:crypto` y key en env (`CONNECTOR_KMS_KEY`). Tiempo: 1 día.
5. **`npm audit fix`** sobre dependencias moderate-only; planear bump de `next` y `fastify` para resolver las 4 HIGH (cambios breaking, requerirá testing). Tiempo: 2-4 días.
6. **Fix bug `fotoUrl` placeholder** en `portal-cliente.service.ts:200,223` — usar presigned URL real. Tiempo: 30 min.
7. **Investigar `verify-frontend.test.ts` 3/3 fallas** — 500 en `/ordenes-trabajo`. Probable seed o schema desincronizado. Tiempo: 1-2 h.

### Prioridad P2 — Producto y deuda
8. **Implementar connectors reales** (al menos uno: DOOHMAIN priority según prompt § V2). Tiempo: 2 semanas por connector.
9. **Password reset con Resend** (`auth.routes.ts` + email template). Tiempo: 2 días.
10. **Monitoreo externo** UptimeRobot → `/health`. Tiempo: 30 min.
11. **FKs explícitas en Prisma** para `userId` y `sitioId` sueltos (eliminar `(prisma as any)`). Tiempo: 3-5 días + regeneración + test pass.
12. **UI dedicadas para Licencias e Incidencias** (`/inmuebles/licencias/page.tsx`, `/inmuebles/incidencias/page.tsx`). Tiempo: 2-3 días.
13. **Flujo D (incidencia → alerta a Comercial → makegood)** del prompt — implementar emit de evento + suscriptor. Tiempo: 1 semana.

### Prioridad P3 — Design System v2 y frontend
14. **Decidir si reactivar el DS v2 o adoptar la versión actual como hecho consumado.** El gap es del 80 %. Si se quiere completar:
    - Instalar Tailwind, crear `tailwind.config.ts` per §12.3 del DS.
    - Crear `apps/web/styles/tokens.css` con TODAS las vars del §3.
    - Crear `apps/web/components/ui/` (Button, Input, Badge, Table, Card).
    - Crear `apps/web/DESIGN_SYSTEM.md` (copia de la fuente original) + `design/reference.html`.
    - Cargar JetBrains Mono via `next/font/google`.
    - Rediseñar login con wordmark Cabinet Grotesk 84px, tech row, módulo tags.
    - Migración progresiva: empezar por el login y un módulo (ej. inmuebles), no toda la app de golpe.
    - Tiempo total: 4-6 semanas para migración completa.
15. **Tests de frontend** — al menos Playwright para 3 flujos críticos (login, crear OT, subir evidencia). Tiempo: 1 semana.

### Prioridad P4 — Largo plazo (V2/V3 del roadmap original)
16. Imprenta, Finanzas/Cobranza, Settlement programático, Meilisearch, WhatsApp, PostGIS, API pública de disponibilidad, SSP integration. Tiempo: 6+ meses con equipo dedicado.

---

## Score Final

| Categoría | Score | Notas |
|---|---|---|
| **Backend** | **7.5 / 10** | Arquitectura sólida, módulos bien organizados, auth/RBAC correctos. **Penalizado por:** 148 `(prisma as any)`, multi-tenant roto en adapter, 3/4 connectors stub, sin Winston/APM. |
| **Frontend** | **6 / 10** | Funcional, cubre todos los flujos de los módulos implementados, React Query bien usado. **Penalizado por:** 2100 inline styles, 0 Tailwind, 0 componentes UI base, 0 tests, design system v2 al 20 %. |
| **Seguridad** | **5.5 / 10** | JWT+refresh rotation OK, rate limit, validación Zod, headers de seguridad en `next.config.mjs`, RBAC funcional. **Penalizado por:** 4 vulns HIGH, credenciales connectors en base64 (no cifradas), sin password reset, sin 2FA, sin pg_dump automatizado, dependencias atrasadas. |
| **Arquitectura** | **7 / 10** | Monolito modular acertado, bounded contexts bien delimitados, schema-per-tenant correcto en diseño, connector pattern bien definido. **Penalizado por:** PrismaPg no aísla (rompe la promesa multi-tenant), event bus in-memory (no escala), connectors no implementados. |
| **Rendimiento** | **6.5 / 10** | Sin presión real (volumen bajo), health endpoint con latencias, React Query con cache. **Penalizado por:** sin paginación en algunos endpoints, sin PostGIS para queries geoespaciales, sin Meilisearch, sin métricas en producción. |
| **Calidad de código** | **6.5 / 10** | TypeScript strict, typecheck limpio, manejo de errores centralizado, código en español+inglés consistente. **Penalizado por:** 162 `as any`, ESLint no en CI, sin Prettier en pre-commit, sin tests frontend, comentarios escasos donde se necesitan. |
| **Operaciones / DevOps** | **6 / 10** | PM2 con fork mode + crash limits, Nginx + Let's Encrypt, scripts de tenant. **Penalizado por:** deploy.yml roto (sin `prisma generate`, sin `migrate-all-tenants.sh`), sin pg_dump cron, sin monitoreo externo, sin alerting. |
| **Cobertura vs Prompts** | **6 / 10** | V1 al 70 %, V2 al 15 %, V3 al 0 %, Design System v2 al 20 %. Para un sistema con un solo tenant productivo es razonable; para la promesa del documento maestro queda corto. |

### **Score global ponderado: 6.4 / 10**

> Sistema **funcional en producción** para 1 tenant. Buena base arquitectónica. **No está listo para escalar** sin resolver los 5 bloqueadores P0 (PrismaPg, deploy.yml, migrate-all-tenants, backups, encriptación de credenciales). El design system y los connectors externos son la deuda más grande hacia el roadmap original.

---

## Apéndice — Inventario de archivos clave

### Backend (`apps/api/src/`)
- **Entry:** `server.ts` (60 LOC), `app.ts` (221 LOC)
- **Core:** `core/auth/` (auth.service, auth.plugin, auth.routes, rbac.guard), `core/tenant/`, `core/audit/`, `core/email/`, `core/events/`, `core/upload/`
- **DB:** `db/client.ts` (PrismaPg adapter), `db/storage.ts` (S3 Spaces)
- **Modules:** inmuebles (5 archivos), operaciones (4), comercial (8), digital (2), portal-cliente (2), admin (5), dev (1)
- **Connectors:** interface + registry + 4 implementaciones (manual real, 3 stubs)
- **Jobs:** 2 jobs + queue + scheduler

### Frontend (`apps/web/`)
- **App router:** 6 route groups, 35 páginas
- **Components:** 6 componentes en 4 carpetas (campanas, maps, operaciones, shared) — sin carpeta `ui/`
- **Lib:** `api-client.ts`, `auth-context.tsx`, `portal-cliente-api.ts`, `query-client.ts`, `hooks/useIsMobile.ts`, `group-by-day.ts`
- **Middleware:** subdomain rewrite + cookie guard

### Infra
- `infra/nginx/spaces.conf`
- `infra/scripts/`: `deploy.sh`, `new-tenant.sh`, `migrate-all-tenants.sh`, `setup-droplet.sh`, `setup-first-tenant.sh`
- `ecosystem.config.js` (PM2 fork mode)
- `.github/workflows/deploy.yml` (broken — falta prisma generate y migrate-all-tenants)

### Packages
- `packages/types/` — 7 archivos de tipos compartidos
- `packages/utils/` — dates, permissions, readiness
- `packages/ui/` — button, card, code (NO usado por `apps/web`)
- `packages/eslint-config`, `packages/typescript-config` — base configs

---

*Fin del reporte. Para roadmap accionable ver `NEXT_STEPS.md`.*

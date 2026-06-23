# VERIFICACIÓN DE CIERRE — SPACES OS

> **Fase 0 (read-only).** Auditoría de los 8 puntos contra el repo y la BD reales
> (Postgres demo, puerto 5433). No se modificó código. Rama: `cierre/verificacion-y-faltantes`.
> HEAD auditado: `12fb38b`.

Leyenda de veredicto: **✔ ok** · **◑ parcial** · **✘ falta**

---

## V1 — Linaje del repo · ✔ ok

- **Hallazgo:** Este repo (`spaces_dooh_new`) es el **mismo linaje** que el auditado antes (carpeta `spaces_doohmain_nueva`).
- **Evidencia:** `git remote -v` → `emiliano → github.com/emiliano-cyber/spaces_dooh_new` y `origin → CarlosMend87/spaces-dooh`. El historial contiene los commits del sprint (`12fb38b`…`63c579f`…). La carpeta de trabajo es `C:\Users\Server\spaces_doohmain_nueva` empujada a `spaces_dooh_new`.
- **Veredicto:** Los hallazgos previos **siguen aplicando**: mismo schema, misma estructura.

## V2 — Los dos backends · ◑ parcial

- **Hallazgo:** Existen **dos** backends. El **vivo** para el demo es el **BFF** (route handlers en `apps/web/app/api/**`) contra Postgres `:5433`. Existe además `apps/api` (**Fastify**) que **no está conectado** al frontend del demo.
- **Evidencia:** `apps/api/package.json` declara `fastify`. `apps/web/lib/server/db.ts` → `DATABASE_URL ?? 'postgresql://spaces:spaces@localhost:5433/spaces'`. Hay `NEXT_PUBLIC_API_URL=http://localhost:3001` en `.env.local`, pero la capa de datos del demo (`estado-api.ts`) llama a `/spaces-dooh/api/**` (el BFF), no a `:3001`.
- **Veredicto:** Backend vivo = **BFF**. `apps/api` (Fastify) queda **huérfano** para el demo (preparado para producción, sin cablear).

## V3 — Storage de evidencias · ✘ falta (para producción)

- **Hallazgo:** Las imágenes (testigos/fotos de OT) se guardan como **data URL base64 dentro de la BD**, no en S3/bucket.
- **Evidencia:** `lib/server/ot-repo.ts` inserta `foto_url` con el string recibido; en BD: `select left(foto_url,40) from evidencias_ot` → `data:image/png;base64,iVBORw0KGgoAAAANSU…`. La "prueba de color" tiene `prueba_color_url` pero la UI solo marca el flag (no sube archivo). No hay uso de S3 en el BFF.
- **Veredicto:** Almacenamiento real = **data URL en BD**. S3 no está en uso (puede existir config en `apps/api`, no en el BFF).

## V4 — Máquina de estados en backend · ✘ falta

- **Hallazgo:** El backend **no rechaza** transiciones inválidas por `tipo_medio`. La regla "una digital (DOOH) no pasa por imprenta" vive **solo en la UI** (filtro del selector). El pipeline es **derivado** (no una máquina de estados con validación de transición).
- **Evidencia:** `lib/server/impresion-repo.ts` y `app/api/impresion/route.ts` **no** consultan `tipo_campana`/`tipo_medio` al crear una orden de impresión (sin guard por DOOH). El pipeline se calcula en `lib/data/derive.ts` (`pipelineStage`/`etapasPipeline`), no se valida al escribir.
- **Veredicto:** Validación de transiciones = **solo UI**. Vía API directa, una DOOH podría recibir una orden de impresión.

## V5 — Candado de facturación · ✔ ok

- **Hallazgo:** Exige **los tres** requisitos (OC + fotos comprobatorias/testigos + reporte de publicación), enforzado server-side.
- **Evidencia:** `lib/server/finanzas-repo.ts:56` → `if (!(c.oc_recibida && c.fotos_comprobatorias && c.reporte_publicacion)) throw FacturaError(...)`. `lib/data/derive.ts:69` → `candadoFacturacion = ocRecibida && fotosComprobatorias && reportePublicacion`.
- **Veredicto:** Correcto: faltando cualquiera de los tres, **no** se puede facturar.

## V6 — Encriptado de credenciales · ◑ parcial (no aplica todavía)

- **Hallazgo:** **No existe un almacén de credenciales** (ni tabla ni archivo). Los conectores detectan si están "configurados" leyendo **variables de entorno** (`process.env.ADMOBILIZE_API_KEY`, `CMS_API_TOKEN`, `CFDI_PAC_KEY`).
- **Evidencia:** `lib/server/integraciones.ts` → `const def = (envVar) => !!process.env[envVar]`. No hay `encrypt`/`cipher`/`crypto` ni tabla de credenciales.
- **Veredicto:** No hay credenciales en BD ni en el repo (bien). Tampoco hay mecanismo de cifrado **porque aún no se almacenan**. Cuando se construya el almacén (al integrar de verdad), deberá cifrarse en reposo.

## V7 — Cobertura de RBAC · ✔ ok

- **Hallazgo:** **Todas** las rutas de escritura aplican el guard `exigir()` (sesión + permiso) **excepto** `auth/login` y `auth/logout`, que **deben** ser públicas.
- **Evidencia:** Barrido de `app/api/**` con handlers `POST/PATCH/PUT/DELETE`: 30/32 con `exigir(`; las 2 sin guard son `auth/login` y `auth/logout` (correcto).
- **Veredicto:** Cobertura completa. Sin rutas de escritura de negocio sin permiso server-side.

## V8 — Estado real de RLS · ✘ falta (CRÍTICO)

La RLS está **instalada pero inefectiva**: hoy **no aísla nada** en la práctica.

| Sub-punto | Resultado | Evidencia |
|---|---|---|
| `tenant_id` en tablas | ✔ **21 tablas** | `information_schema.columns where column_name='tenant_id'` → 21 |
| Políticas RLS creadas | ✔ **21** `tenant_isolation` | `pg_policies` → 21 |
| RLS ENABLE | ✔ 21 ENABLE | `pg_class.relrowsecurity` → 21 |
| RLS FORCE | ✘ **0 FORCE** | `pg_class.relforcerowsecurity` → 0 |
| Rol de conexión de la app | ✘ **`spaces` = SUPERUSER + BYPASSRLS** | `pg_roles` → `rolsuper=t, rolbypassrls=t`; `db.ts` conecta como `spaces` |
| `app.tenant_id` por request | ✘ **nunca se setea** | sin `set_config`/`SET app.tenant_id` en `lib/` ni `app/api/` |
| `tenant_id` desde la sesión | ◑ la sesión ya lo trae (`UsuarioSesion.tenantId`) pero **no se aplica** en queries |

- **Veredicto:** Tres motivos independientes hacen que la RLS **se ignore por completo** hoy: (1) la app conecta como **superusuario con BYPASSRLS**, (2) no hay **FORCE**, (3) **nunca se setea `app.tenant_id`**. Es una **base correcta y aditiva**, pero **sin enforcement real** → no hay aislamiento entre tenants en la app actual.

---

## Resumen ejecutivo (GATE 0)

1. **OK (no tocar):** V1 linaje, V5 candado (3 requisitos), V7 RBAC (cobertura completa).
2. **Falta crítico:** **V8 RLS inefectiva** — la app conecta como superusuario/bypassrls, sin FORCE y sin `app.tenant_id`. Es la falta #1 para producción.
3. **Falta (contenido):** **V4** máquina de estados solo en UI (el backend no rechaza DOOH→imprenta).
4. **Bloqueado por externos:** **V3** evidencias en data URL → mover a S3 **requiere llaves**; **V6** cifrado de credenciales **no aplica aún** (no hay almacén; se leen de env).
5. **Recomendación de orden:** F1.2 (máquina de estados, V4) primero por ser contenida y de bajo riesgo → luego **Fase 2 (RLS enforcement, V8)** con extremo cuidado (rol restringido + FORCE + `app.tenant_id` desde sesión + test de aislamiento). F1.5 (S3) solo si hay credenciales; F1.4/F1.1 sin acción (no aplican / ya cubierto).

> **DETENCIÓN EN GATE 0.** No se construye nada hasta revisión humana de este reporte.

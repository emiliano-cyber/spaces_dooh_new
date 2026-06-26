# SPACES OS — Informe de avance

> Estado al **26/06/2026** · Rama `cierre/auditoria-completitud`.
> Verificado contra el código y la base de datos reales (Postgres `:5433`).

---

## 1. Resumen ejecutivo

**SPACES OS** gestiona el ciclo completo de una operadora de publicidad exterior (OOH/DOOH): inventario → comercialización → propuesta → campaña → producción → instalación → **validación de publicación** → reporte → facturación → cobranza.

- **Funcionalidad de negocio: ~95%** — cadena comercial-fiscal completa y conectada, con persistencia real en base de datos, autenticación, permisos por rol, bitácora y notificaciones.
- **Listo para producción: ~55–60%** — lo pendiente es infraestructura/habilitaciones externas (multi-tenant real, timbrado fiscal legal, integraciones reales, despliegue), no funcionalidad.
- **Calidad de código:** `tsc --noEmit` **sin errores** (100% verde).

---

## 2. Arquitectura

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind, Radix, MapLibre |
| Estado | Zustand, hidratado desde `/api/estado` |
| Backend (BFF) | Route Handlers en `apps/web/app/api/**` (permisos + reglas) |
| Base de datos | PostgreSQL (`:5433`) |
| Auth | bcrypt + sesiones en BD + cookie httpOnly |

La UI lee de `/api/estado` y cada acción llama a un endpoint que valida permisos (`exigir`) y aplica reglas (repos). Tras escribir, refresca el estado. Las derivaciones (pipeline, candado, márgenes) son funciones puras.

---

## 3. Cambios de esta sesión (resumen)

| # | Cambio | Estado |
|---|---|---|
| 1 | Validación de publicación de campañas (enviar al dominio → aprobar/rechazar) | ✅ |
| 2 | Pantallas a ancho completo + modales/Sheet más anchos | ✅ |
| 3 | Menú lateral retráctil en celular (drawer + hamburguesa) | ✅ |
| 4 | Badge de sitio "Ocupado" en rojo (unificado con el pin) | ✅ |
| 5 | Agencia en nueva propuesta + asociación agencia↔cliente | ✅ |
| 6 | Migas de pan con contexto de origen ("de dónde vengo") | ✅ |
| 7 | Ver OT dentro del shell (conserva menú + marca Operaciones) | ✅ |
| 8 | Pantalla de detalle de propuesta (renta + costo + nombre) | ✅ |
| 9 | Copiar liga pública + Generar PDF (placeholder) | ✅ |
| 10 | Comisión por agencia + negociación con validación (bloquea) | ✅ |
| 11 | Propietario y renta por espacio + periodicidad de pago | ✅ |
| 12 | Propietario en la lista de inventario (Comercial) | ✅ |
| 13 | Tabla de inventario con columnas (fila clicable → ficha) | ✅ |
| 14 | Filtros en la bitácora (fecha, hora, quién) | ✅ |
| 15 | Acceso a propuesta por código (estilo Hivestack) | ✅ |
| 16 | Limpieza seed/mock → `tsc` 100% verde | ✅ |

### Migraciones de base de datos (aditivas, con respaldo)
- `campanas`: validación de publicación (6 columnas).
- `clientes`: `agencia_id` + negociación (`tiene_negociacion`, `negociacion_validada`, `negociacion_nota`).
- `propuestas`: `agencia_id`.
- Respaldos en `migration-backup/`.

---

## 4. Reglas de negocio destacadas

- **Comisión por agencia:** se configura en la agencia (cliente tipo Agencia), no en el cliente directo; la propuesta la precarga desde la agencia.
- **Negociación con validación:** si la agencia tiene negociación **sin validar**, se **bloquea** crear y aprobar propuestas con esa agencia (en UI y en servidor).
- **Propuesta → campaña:** aprobar congela la propuesta; "Generar campaña" deriva solo los sitios aprobados, con precio neto de comisión, y hereda la agencia.
- **Validación de publicación:** al aprobar, la campaña pasa a **Activa** (al aire).
- **Compartir propuesta:** liga pública e ingreso por **código** (folio), ambos sin login.

---

## 5. Verificación (esta sesión)

- **tsc:** 0 errores.
- **Rutas:** 16/16 en 200 (incluye OT en shell, detalle de propuesta, vista pública por folio/id y página de código).
- **APIs públicas:** propuesta por folio → 200, por id → 200, inexistente → 404.
- **APIs protegidas:** sin sesión → 401 (guard activo).
- **Migraciones:** 11 columnas verificadas en la BD.
- **Lógica:** gate de negociación y validación de publicación probados con SQL (rollback).

---

## 6. Qué falta para producción

**Leyenda:** 🔵 decisión · ⛔ externo · 🔒 autorización humana

- 🔵 **Aislamiento multi-tenant real (RLS):** las políticas existen pero están inertes (la app conecta como superusuario). *Bloqueante #1.*
- ⛔ **Timbrado fiscal legal (PAC CFDI/SUNAT):** hoy el folio fiscal es simulado.
- ⛔ **Integraciones reales (AdMobilize/CMS):** hoy stubs.
- 🔒 **Activar Spaces (storage) y backfill de evidencias:** llaves existen, no cableadas.
- 🔵 **Despliegue / CI-CD / backups.**

---

## 7. Estado de git

- Rama `cierre/auditoria-completitud`, todos los cambios commiteados.
- Documentación: este informe + manual de usuario (MD y PDF).
- Publicado en el repositorio `emiliano-cyber/spaces_dooh_new`.

---

*La funcionalidad de negocio está completa y demostrable; los pendientes son de infraestructura (multi-tenant), habilitación fiscal legal e integraciones externas.*

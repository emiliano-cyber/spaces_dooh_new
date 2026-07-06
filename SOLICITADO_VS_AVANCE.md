# SPACES OS — Lo solicitado vs. el avance

**Feedback de RGB / PIXELED y estado de implementación**
Fecha: 6 de julio de 2026 · Rama: `cierre/auditoria-completitud`

---

## 1. Resumen ejecutivo

A partir del feedback de la reunión (cuatro perspectivas: media owner, sales lead, director de operaciones y detalles del manual) se identificaron **11 puntos de mejora**. En esta iteración se cerraron **5**, todos verificados de extremo a extremo contra la base de datos real:

- **A** — Calendario de disponibilidad futura
- **B** — TTL de reservas tentativas (caducan solas)
- **C** — Aprobación del cliente desde la liga pública
- **D** — Alerta de OT vencida (SLA de cierre en campo)
- **F** — Recordatorios de cobranza (automáticos + manual)

Además, dos puntos del feedback **ya estaban resueltos** de antes: los **pagos parciales** de cobranza y el **prefijo de folio de campaña por-tenant**.

Quedan **5 pendientes cerrables por código** (1 de infraestructura, 3 de features, 1 rápido de manual) y **1 bloqueado por contratos externos**.

---

## 2. Lo que se solicitó (feedback original)

### Media owner (RGB / PIXELED)
- Ver **ocupación de inventario en el tiempo**: calendario de disponibilidad por catorcena/mes, para no sobrevender ("¿qué tengo libre en septiembre?").
- El estado **"Reservado – tentativo"** debe **expirar solo** (TTL), o el inventario queda bloqueado por propuestas muertas.
- Conectar **arrendadores/renta al P&L**: margen real por sitio (ingreso − costo de renta), para decidir qué pantallas mantener o renegociar.

### Sales lead
- Que el cliente pueda **aprobar la propuesta desde la liga pública** con un clic → timestamp de aceptación (medio-contrato).
- **Descuentos/bonificaciones** y **versiones de propuesta** (v1, v2 tras negociación).
- **Funnel view**: propuestas enviadas vs. aprobadas vs. perdidas, win rate y pipeline value.

### Director de operaciones
- La OT dice "Sin asignar": falta **asignación + SLA + alerta de vencidas**, o el candado se vuelve cuello de botella del cobro.
- **Proof-of-play** del player (no solo foto manual) — donde embona SPACE EYE.
- Cobranza: **recordatorios automáticos** y **registro de pagos parciales**.

### Detalles del manual
- La sección 9 muestra un screenshot de "Enlace no válido" → **recapturar** con el portal vivo.
- Armar un **tenant de staging** antes de que entre RGB con datos reales (no probar/borrar en prod).
- Verificar que el **prefijo de folio** sea por-tenant, no fijo.

---

## 3. Avance por punto

| # | Área | Solicitado | Estado |
|---|------|-----------|--------|
| A | Media owner | Calendario de disponibilidad futura | ✅ Hecho |
| B | Media owner | TTL de reserva tentativa | ✅ Hecho |
| G | Media owner | Margen / P&L con renta de arrendadores | ⏳ Pendiente (código) |
| C | Sales lead | Aprobación del cliente en la liga pública | ✅ Hecho |
| I | Sales lead | Descuentos + versiones de propuesta | ⏳ Pendiente (código) |
| H | Sales lead | Funnel / win-rate / pipeline value | ⏳ Pendiente (código) |
| D | Operaciones | Alerta de OT vencida + SLA | ✅ Hecho |
| K | Operaciones | Proof-of-play / SPACE EYE | 🌐 Bloqueado (externo) |
| F | Operaciones | Recordatorios de cobranza | ✅ Hecho |
| — | Operaciones | Pagos parciales de cobranza | ✅ Ya existía |
| J | Manual | Recapturar screenshot sección 9 | ⏳ Pendiente (rápido) |
| E | Infra | Tenant de staging | ⏳ Pendiente (infra) |
| — | Infra | Folio de campaña por-tenant | ✅ Ya existía |

**Marcadores:** ✅ hecho y verificado · ⏳ pendiente cerrable por código · 🌐 bloqueado por contratos/API externos.

---

## 4. Detalle de lo implementado en esta iteración

### A — Calendario de disponibilidad futura
Vista nueva **"Disponibilidad"** que cruza las reservas vigentes (tentativas + confirmadas) contra el inventario y pinta cada pantalla × periodo como **libre / parcial / ocupado**, por **catorcena o mes**. Estáticas = ocupación única; rotativas/digitales = por slots (`usados/total`). Responde directamente el "¿qué tengo libre más adelante?" que el mapa de "12/12 libres hoy" no podía.

*Verificado:* con los 12 sitios reales G500, la rejilla muestra ocupación 1/12 en las catorcenas que cubren cada campaña y libre después.

### B — TTL de reservas tentativas
Una reserva **tentativa caduca sola a los 7 días**: un barrido la pasa a cancelada y **libera el inventario** (devuelve slots a las digitales, regresa a disponible las estáticas sin otra reserva). Corre en cada lectura de estado — no requiere cron.

*Verificado:* una tentativa vencida se canceló y liberó el sitio; un sitio con reserva confirmada se mantuvo reservado (correcto); las confirmadas no caducan.

### C — Aprobación del cliente desde la liga pública
El cliente ahora **acepta la propuesta con un clic** desde la liga pública: se registra **timestamp + nombre + IP** (el "medio-contrato"), la propuesta pasa a aprobada y el equipo comercial recibe una **notificación**. Idempotente.

*Verificado:* aceptar sin nombre → rechazado; con nombre → aprobada + timestamp + items aprobados + notificación interna; reintento → idempotente.

### D — Alerta de OT vencida
Una OT abierta que pasó su **fecha compromiso** se marca **"Vencida"** (badge rojo + banner + fecha en rojo) y genera una **notificación in-app** proactiva. Umbral de "por vencer" a 2 días. Idempotente (una alerta por OT).

*Verificado:* OT vencida de prueba → notificación creada; segunda lectura no duplicó; el "(sin asignar)" aparece cuando no hay cuadrilla.

### F — Recordatorios de cobranza
Las cobranzas **por vencer (≤7 días) o vencidas** sin liquidar generan **recordatorios automáticos** (notificación in-app), con **cadencia de 3 días** para no saturar. Botón **"Recordar"** para nudge manual. El estado se calcula por fecha, no por el estatus almacenado, y el recordatorio muestra el **saldo real** (descontando abonos parciales).

*Verificado:* cobranza vencida → recordatorio automático; segunda lectura no duplicó (cadencia); manual envió ignorando cadencia; el saldo refleja el abono parcial.

---

## 5. Pendiente

| # | Pendiente | Prioridad | Nota |
|---|-----------|-----------|------|
| E | Tenant de staging | Alta | Hoy se prueba en la BD real con borrado manual → riesgo. Es decisión de infraestructura/despliegue. |
| H | Funnel / win-rate / pipeline value | Media | Agregar propuestas por estado + tasa de conversión (falta estado "perdida"). |
| I | Descuentos + versiones de propuesta | Media | La comisión de agencia ya existe; faltan descuentos y el versionado/adenda. |
| G | Margen / P&L con renta | Media | Ligar el costo de renta prorrateado a la campaña → margen por pantalla. |
| J | Recapturar screenshot sección 9 | Rápido | Tomar la captura con el portal vivo antes de borrar datos. |
| K | Proof-of-play / SPACE EYE | Roadmap | Requiere contratos/API keys de CMS (Broadsign/Invian); hoy los connectors son stubs. |

**Refinamientos menores anotados (opcionales):** no hay entidad "cuadrilla/crew" (asignación a usuario individual); se usa `fecha_programada` como compromiso en lugar de un campo SLA dedicado; los folios PR-/OT-/OI-/ODC-/factura usan prefijo fijo neutro (no filtra tenant, pero tampoco lleva su marca).

---

## 6. Estado de despliegue a producción

Producción es un **droplet** desplegado por **GitHub Actions al hacer push a `main`** (build → `pm2 reload`). El código de esta iteración quedó **commiteado y listo**, con el **build de producción verificado**.

**Importante antes de publicar:** las 3 migraciones nuevas son **SQL sobre la base del BFF** (`db/migrations/*.sql`), no Prisma, por lo que el pipeline de CI (que corre `prisma migrate deploy`) **no las aplica**. Deben ejecutarse contra la base de producción **antes o junto** con el despliegue del código; de lo contrario el código nuevo consultaría columnas inexistentes. Las 3 son **aditivas e idempotentes** (`add column if not exists`), sin riesgo para los datos existentes.

Migraciones a aplicar en prod:

- `db/migrations/20260706_reserva_ttl.sql`
- `db/migrations/20260706_propuesta_aceptacion.sql`
- `db/migrations/20260706_cobranza_recordatorios.sql`

---

## 7. Anexo — archivos principales

| Área | Archivos |
|------|----------|
| Disponibilidad (A) | `lib/data/derive.ts`, `app/demo/(shell)/disponibilidad/page.tsx`, `components/demo/shell/nav.ts` |
| TTL reservas (B) | `lib/server/campanas-repo.ts`, `db/migrations/20260706_reserva_ttl.sql` |
| Aprobación cliente (C) | `lib/server/propuestas-repo.ts`, `app/api/propuestas/publica/[id]/route.ts`, `app/demo/p/[id]/page.tsx`, `db/migrations/20260706_propuesta_aceptacion.sql` |
| OT vencida (D) | `lib/data/derive.ts`, `lib/server/ot-repo.ts`, `app/demo/(shell)/operaciones/page.tsx` |
| Recordatorios cobranza (F) | `lib/server/finanzas-repo.ts`, `app/api/cobranzas/[id]/recordar/route.ts`, `app/demo/(shell)/finanzas/page.tsx`, `db/migrations/20260706_cobranza_recordatorios.sql` |
| Barrido central | `app/api/estado/route.ts` (TTL + OT vencidas + recordatorios en cada lectura) |

*Verificación transversal:* `tsc --noEmit` sin errores; build de producción OK; pruebas E2E contra Postgres real para cada punto.

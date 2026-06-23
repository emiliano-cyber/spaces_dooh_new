# ESTADO DE COMPLETITUD — SPACES OS

> **Fuente de verdad.** Auditoría read-only (Fase A) contra el código y la BD reales
> (Postgres demo `:5433`). Verificado, no asumido. Rama: `cierre/auditoria-completitud`.

**Leyenda:** ✅ hecho y verificado · 🟡 parcial · 🔵 falta — bloqueado por DECISIÓN · ⛔ falta — bloqueado por EXTERNO · 🔒 requiere autorización humana

---

## 0. Tabla resumen

| Área | Estado | Nota |
|---|---|---|
| Clientes + RFC/razón social | ✅ | CRUD + datos fiscales |
| Propuestas + método del divisor | ✅ | bruto→neto por comisión |
| Aprobación granular (neto vs aprobado) | ✅ | por sitio |
| ODC (folio/monto/doc, abre candado) | ✅ | |
| Finanzas fiscal (folio, IVA, validación RFC) | ✅ | folio fiscal **simulado** |
| Cobranza (buckets/semáforo, abonos) | ✅ | |
| Inventario/sitios (CRUD, specs, precios, img) | ✅ | imágenes en data URL |
| Carga masiva (parser + persistencia) | ✅ | parser real cliente + BFF |
| Comercial (mapa/lista) | ✅ | |
| Reservas (reservar/confirmar/extender) | ✅ | |
| Colisión de fechas / sobre-reserva | ✅ | estáticas, 409 |
| Campañas + pipeline por tipo de medio | ✅ | derivado |
| Máquina de estados — DOOH↛imprenta | ✅ | guard server-side (409) |
| Máquina de estados — OOH↛etapas digitales | 🟡 | **falta guard inverso** (creatividades sin validar tipo) |
| Operaciones / OT | ✅ | |
| Imprenta + prueba de color | ✅ | |
| Probatorio: reporte contratado vs entregado | ✅ | derive |
| Testigos (proof-of-play) | ✅ | = evidencia de OT |
| Notificaciones por evento | ✅ | centro + campana |
| Motor de costos + margen real (≠100%) | ✅ | |
| Persistencia real (UI↔BD) | ✅ | sin mock residual (3 ops migradas en Fase 1) |
| Candado (OC + testigos + reporte) | ✅ | exige los 3, server-side |
| RBAC (cobertura escritura) | ✅ | todas salvo login/logout (correcto) |
| Auth (sesiones/bcrypt/cookie) | ✅ | |
| Auditoría / bitácora | 🟡 | registra todo, pero **mutable** (sin inmutabilidad) |
| Storage de evidencias | 🟡 | base64 en BD; Spaces implementado pero **inactivo** |
| **Conexión E2E propuesta→campaña** | 🟡 | **se corta**: la propuesta aprobada no genera campaña/reserva |
| Multi-tenant / RLS | 🔵 | instalada pero **inerte** (superuser/sin FORCE/sin app.tenant_id) |
| Integraciones (AdMobilize/CMS/CFDI/SUNAT) | ⛔ | stubs; requieren contratos/keys |
| Deploy / CI-CD / backups | 🔵 | fuera de alcance |

---

## 1. Estimado honesto de "% listo para producción": **~50–55%**

**Justificación.** La **funcionalidad de negocio está ~90%** (cadena comercial-fiscal completa, operación, probatorio, finanzas, notificaciones, persistencia real, auth+RBAC sólidos). Pero "listo para producción" pondera otras cosas que hoy **no** están:
- **No hay aislamiento real entre tenants** (RLS inerte) → riesgo de fuga de datos multi-cliente. *(bloqueante #1)*
- **No se puede facturar legalmente** (folio fiscal **simulado**; sin PAC CFDI/SUNAT). *(bloqueante)*
- **Evidencias en la BD** (base64), no en Spaces → backup/restore pesados; el modelo de BD ligera no se cumple aún en la práctica.
- **Sin despliegue/CI/backups**.
- **La cadena E2E se corta** entre propuesta y campaña (dos islas).

Es un producto **funcionalmente rico y demostrable**, pero a media tabla de "producción" por seguridad multi-tenant, fiscal legal y operación/infra.

---

## 2. Lo único que falta y de qué depende

### 🔵 Bloqueado por DECISIÓN (tenancy / arquitectura)
- **Enforcement de RLS / multi-tenant (Fase 2).** Las políticas existen pero la app conecta como superusuario sin `FORCE` ni `app.tenant_id`. Activar requiere definir el modelo de tenancy (rol restringido por request, etc.).
- **Forma del despliegue** (CI-CD, backups, migraciones por tenant) — depende de lo anterior.

### ⛔ Bloqueado por EXTERNO (contratos / API keys)
- **Facturación fiscal real** (CFDI MX / SUNAT PE): sin un PAC no hay timbrado legal. Hoy el folio fiscal es **simulado**.
- **AdMobilize / CMS-DOOH**: métricas y proof-of-play reales requieren API keys/contratos. Hoy stub.

### 🔒 Requiere AUTORIZACIÓN HUMANA (sin construir)
- **Activar el bucket de Spaces de producción** en el BFF (las llaves existen en `apps/api/.env`, no se cablearon).
- **Correr el backfill** de evidencias base64→Spaces (script listo, no ejecutado).

### 🟢 CERRABLE POR CÓDIGO AHORA (sin decisión ni externo)
- **B1 — Guard inverso de máquina de estados:** OOH no debe recibir etapas digitales (creatividad) vía API. Hay endpoint escribible (`POST /api/creatividades`) **sin** validación de tipo. *(contenido, bajo riesgo)*
- **B3 — Smoke test E2E repetible** del tramo conectado (campaña→ODC→factura→cobranza), con datos `TEST_` autolimpiables.
- **(Feature, mayor que un guard) Conexión propuesta→campaña:** "convertir propuesta aprobada en campaña + reservas". Cerrable por código pero es una **feature media**, no un guard; recomendado, requiere visto bueno por alcance.
- **(Opcional) Inmutabilidad de bitácora:** hoy la tabla `acciones` es mutable; endurecerla (append-only/trigger) es contenido.

---

## 3. Detalle por área (evidencia)

### Cadena comercial-fiscal
- **Clientes+RFC** ✅ — `clientes` con `rfc/razon_social/regimen_fiscal/cp_fiscal/uso_cfdi`; `clientes-repo.ts`.
- **Propuestas + divisor** ✅ — `propuestas-repo.ts`: `neto = bruto × (1 − comisión/100)`, IVA 16%.
- **Aprobación granular** ✅ — `propuesta_items.aprobado` + totales `*Aprobado`; `aprobarItem`.
- **ODC** ✅ — `ordenes_compra`; `crearOrdenCompra` marca `oc_recibida` (abre candado).
- **Finanzas fiscal** ✅ con matiz — `finanzas-repo.ts` exige RFC+razón social; genera `folio_fiscal` **simulado** (UUID), no timbrado real.
- **Cobranza** ✅ — semáforo derivado (`estadoCobranza`) + abonos parciales (`registrarPagoCobranza`).

### Máquina de estados (ambas direcciones)
- **DOOH↛imprenta** ✅ — `impresion-repo.crearOrdenImpresion` lanza `ImpresionError` si `tipo_campana='DOOH'` → ruta responde **409**. *(Fase 1, verificado.)*
- **OOH↛etapas digitales** 🟡 — `creativos-repo.crearCreatividad` inserta **sin** consultar `tipo_campana`; `POST /api/creatividades` no valida tipo. Una campaña fija puede recibir creatividad vía API. **Endpoint escribible existe → aplica B1.**
- **Híbrida** ✅ — conserva ambos (no excluida en ninguno de los dos guards).

### Probatorio / storage
- **Reporte contratado vs entregado** ✅ — `reporteCampana` (derive).
- **Testigos** ✅ — evidencia de OT (proof-of-play) contabilizada.
- **Pruebas de color** ✅ — `ordenes_impresion.prueba_color_aprobada` + UI.
- **Evidencias storage** 🟡 — hoy **data URL base64** en `evidencias_ot.foto_url` (verificado en BD). Spaces implementado (`storage.ts`, `foto_key`, gateado por `DO_SPACES_*`) pero **inactivo** en el BFF (no tiene esas env) → no entra base64 nuevo solo si se activa. Backfill listo, no ejecutado.

### Transversales
- **Candado** ✅ — `finanzas-repo.ts:56` exige `oc_recibida && fotos_comprobatorias && reporte_publicacion`.
- **RBAC** ✅ — 30/32 rutas de escritura con `exigir()`; las 2 sin guard son `auth/login` y `auth/logout` (deben ser públicas).
- **Auth** ✅ — bcrypt + sesiones en BD + cookie httpOnly.
- **Bitácora** 🟡 — `acciones` registra usuario+acción+timestamp en cada mutación, pero la tabla es **mutable** (sin append-only/inmutabilidad).
- **Costos/margen** ✅ — `dashboardMetrics` (espacios+impresión+operación), `margenCampana`.
- **Persistencia real** ✅ — el demo lee/escribe BD vía BFF; las 3 operaciones que quedaban en mock (pago renta, renovación, incidencia) se migraron en Fase 1.

### Conexión E2E (smoke)
- **Tramo conectado** ✅ — campaña → ODC → factura → cobranza tiene datos y fluye (ej. campaña "lanzamiento g3": factura emitida, candado completo).
- **Corte** 🟡 — **propuesta/aprobación es una isla aparte**: `reservar`/`campanas-repo` **no** referencian `propuesta`; no existe "convertir propuesta aprobada en campaña". La cadena completa propuesta→…→cobranza **no está unida**.

### Multi-tenant / RLS (catálogo)
- 🔵 `tenant_id` en 21 tablas, 21 políticas `tenant_isolation`, RLS ENABLE — pero **inerte**: app conecta como `spaces` (**SUPERUSER + BYPASSRLS**), **0 FORCE**, **nunca** se setea `app.tenant_id`. Aislamiento real = **no**.

### Higiene
- `.env` **no trackeado** (solo `.example`); `apps/api/.env` fuera de git (reconfirmado).
- Remotes: `emiliano` (`emiliano-cyber/spaces_dooh_new`) y `origin` (`CarlosMend87/spaces-dooh`). **Sin push** hasta confirmar canónico.
- `apps/api` (Fastify) **huérfano** confirmado; backend vivo = BFF (`apps/web/app/api/**`). README agregado en Fase 1.

---

## 4. Recomendación de Fase B (cerrable ahora)
1. **B1** — guard inverso OOH↛creatividad (409). *(contenido)*
2. **B3** — smoke test E2E repetible con datos `TEST_`. *(contenido)*
3. *(Decidir)* Conexión propuesta→campaña (feature media) e inmutabilidad de bitácora (contenido). No se construyen sin visto bueno.

> **⛔ GATE A — DETENCIÓN.** No se construye nada hasta revisión humana de este documento.

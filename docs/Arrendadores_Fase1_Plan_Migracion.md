# Arrendadores Fase 1 — FASE 0: Verificación + Plan de migración (GATE)

Fecha: 2026-07-15 · Rama propuesta: `feat/arrendadores-fase1-prod`
Estado: **PLAN — no se ha tocado la BD. Esperando revisión en el GATE.**

---

## 1. Estado real verificado (dev 5433 + prod spaces_prod)

### 1.1 Tablas del módulo (ambas BD)
- `tenant_id` **ya existe** y es `NOT NULL` con default en: `arrendadores`, `contratos_arrendamiento`, `pagos_renta`, `sitios`, `incidencias` (y ~21 tablas más).
- **No existe** `predios`. **No existe** razón social del arrendador.
- `contratos_arrendamiento.sitio_id` es **NOT NULL** (contrato ligado a pantalla, no a predio).
- `sitios` tiene los campos directos nuevos `arrendador_id`, `renta_arrendador`, `periodicidad_renta` y `caras` (nº de caras, ya disponible para atribución).
- `pagos_renta` existe con `factura_url`; faltan `comprobante_url`, `metodo_pago`, `observaciones`.
- `contratos_arrendamiento` no tiene `deposito`.
- `arrendadores` no tiene `curp`, `direccion`, `cuenta_bancaria`, `forma_pago`, `observaciones`.

### 1.2 RLS — hallazgo clave (aplica a las dos BD)
- Ya existen políticas `tenant_isolation` en TODAS las tablas de datos (bootstrap en `db/schema.sql`, líneas ~505-545).
- RLS está **ENABLED pero NO FORCE** en todas.
- La política es **FAIL-OPEN**:
  `USING (tenant_id = current_setting('app.tenant_id') OR current_setting('app.tenant_id') IS NULL)` y `WITH CHECK (true)`.
- **La app NUNCA fija `app.tenant_id`** (confirmado: 0 usos de `set_config`/`current_setting` en `apps/web`). El aislamiento real hoy es **por filtrado explícito de `tenant_id` en la app** (ver `lib/server/tenant.ts`).
- **Rol de conexión:**
  - **prod = `spaces_user`** → `rolsuper=f`, `rolbypassrls=f` (**ya restringido**), tablas propiedad de `postgres`.
  - **dev = `spaces`** → `rolsuper=t`, `rolbypassrls=t` (superusuario; salta RLS).
- Efecto neto hoy en ambas: RLS es un **no-op** (fail-open + GUC nunca seteado). En prod la RLS *sí evalúa* sobre `spaces_user`, pero como la política es fail-open y el GUC está vacío, permite todo.

### 1.3 P&L / motor de costos (`apps/web/lib/data/derive.ts`)
- Dashboard: `costoEspaciosMes = Σ costoCompra` de reservas CONFIRMADAS. `margen = ingreso − (costoCompra + impresión + operación)`.
- `costoRentaMes = Σ montoRenta` de contratos VIGENTE/POR_VENCER → **informativo, NO entra al margen** (para no duplicar con costoCompra).
- `margenPorSitio()` (P&L por pantalla) = `ingresoMensual − rentaMensual(contrato)`, con `rentaAMensual()` ya normalizando periodicidad (anual/12, catorcenal·30/14, quincenal·2, semanal·30/7, mensual).

### 1.4 Datos a migrar (volumen real)
| Dato | dev (5433) | prod (spaces_prod) |
|---|---:|---:|
| arrendadores | 3 | 6 |
| contratos (→ hoy a sitio_id) | 5 | 0 |
| pagos_renta | 0 | 0 |
| sitios | 15 | 16 |
| sitios con renta directa | 3 | 0 |

→ **Prod está casi en limpio** para el módulo (0 contratos, 0 renta directa): migración de datos trivial en prod. El grueso de la migración de datos es en dev (mis datos de prueba).

---

## 2. Qué hay que migrar

1. **Introducir `predios`:** por cada contrato existente (dev: 5) crear el predio correspondiente (a partir del sitio: ubicación + arrendador), ligar el sitio al predio y repuntar el contrato de `sitio_id` → `predio_id`.
2. **Renta directa del sitio → contrato:** por cada `sitio.renta_arrendador` (dev: 3) crear predio + contrato con esa renta/periodicidad y ligar el sitio. Luego dejar de leer los campos directos.
3. **Backfill de `predio_id` en sitios** sin contrato: crear un predio "1 pantalla = 1 predio" o dejar `predio_id` NULL hasta que se les asigne (decisión — ver §5).

---

## 3. Plan de migración (aditivo, versionado, con respaldo)

Orden y archivos (`db/migrations/2026MMDD_*`), cada uno idempotente:

**M1 — Extensiones de columnas (aditivo, sin romper):**
- `arrendadores` += `curp`, `direccion`, `cuenta_bancaria`, `forma_pago`, `observaciones`.
- `contratos_arrendamiento` += `deposito numeric(14,2)`, `predio_id uuid`.
- `pagos_renta` += `comprobante_url`, `metodo_pago`, `observaciones`.
- `sitios` += `predio_id uuid`.
- Comentar como DEPRECADOS `sitios.renta_arrendador`, `sitios.periodicidad_renta` (COMMENT ON COLUMN; sin DROP).

**M2 — Tablas nuevas (con `tenant_id NOT NULL` + FK):**
- `predios(id, tenant_id, arrendador_id→arrendadores, nombre, direccion, lat, lng, tipo_ubicacion, estado enum, documentos jsonb, creado_en)`.
  - enum `estado_predio`: PROSPECTO | EN_NEGOCIACION | DISPONIBLE | OCUPADO | SUSPENDIDO | PROBLEMA_LEGAL | FUERA_DE_SERVICIO.
- `arrendador_razon_social(id, tenant_id, arrendador_id→arrendadores, razon_social, rfc, regimen, creado_en)`.
  - `contratos_arrendamiento` += `razon_social_id uuid` (bajo qué razón social se paga); `pagos_renta` referencia la del contrato.
- FKs de `contratos.predio_id → predios`, `sitios.predio_id → predios` (ON DELETE RESTRICT).

**M3 — Enum canónico de periodicidad:**
- Enum documentado con equivalente mensual: SEMANAL(·30/7), CATORCENAL(·30/14), QUINCENAL(·2), MENSUAL(·1), BIMESTRAL(/2), TRIMESTRAL(/3), SEMESTRAL(/6), ANUAL(/12). Reconciliar con `rentaAMensual()`.

**M4 — Backfill de datos (transaccional, idempotente):**
- Crear predios desde contratos existentes y desde sitios con renta directa; repuntar `contrato.predio_id`; ligar `sitio.predio_id`; convertir renta directa en contrato.
- **No** hacer `sitio_id` nullable aún (se mantiene por compatibilidad; nueva fuente = `predio_id`). Evaluar quitar el NOT NULL en fase posterior.

**M5 — RLS fail-CLOSED + FORCE (solo tablas del módulo en esta fase):**
- Reescribir política `tenant_isolation` en `predios`, `arrendador_razon_social`, `contratos_arrendamiento`, `pagos_renta`, `arrendadores` (y `sitios` — ver riesgo §5) a **fail-closed**:
  `USING (tenant_id = current_setting('app.tenant_id')::uuid)` y `WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid)`.
- `ALTER TABLE ... FORCE ROW LEVEL SECURITY`.
- GRANT SELECT/INSERT/UPDATE/DELETE de esas tablas a `spaces_user` (prod) / al rol restringido (dev).

**M6 — Rol restringido en DEV:**
- Crear rol `spaces_app` (NOSUPERUSER, NOBYPASSRLS, LOGIN) en la BD dev, con GRANTs de DML, y cambiar `apps/web/.env(.local)` `DATABASE_URL` a ese rol. (Prod ya usa `spaces_user` restringido.)

**Respaldo previo obligatorio:** `pg_dump` de dev y de prod antes de M4/M5.

---

## 4. Refactor de la capa de datos (requisito para RLS fail-closed) — EL RIESGO PRINCIPAL

Hoy `lib/server/db.ts` ejecuta `q()/q1()` sobre un **Pool compartido sin fijar `app.tenant_id`**. Con RLS fail-closed, toda query a tablas del módulo **devolvería 0 filas** y los inserts fallarían (`WITH CHECK`).

**Plan:** envolver el acceso a datos para que cada operación fije el GUC del tenant activo:
- Nuevo helper `conTenant(fn)` / o modificar `q()/q1()` para: tomar un client del pool, `select set_config('app.tenant_id', $tenant, true)` **dentro de una transacción** (transaction-local, `true`), ejecutar, commit, release.
- El `$tenant` sale de `tenantActual()` (respeta el override de super-admin por cookie).
- `crearContratoConSitio` y demás transacciones ya usan un client dedicado → ahí se fija el GUC al inicio de la transacción.
- Rutas **sin tenant** (login, `tenants`, `tenantPlataforma`): NO tocar sus tablas con fail-closed (ver §5).

Esto toca todos los repos del módulo. Se hará con cobertura de la **prueba de aislamiento** (DoD) antes de considerar hecho.

---

## 5. Decisiones — RESUELTAS en el GATE (2026-07-15)

1. **⚠️ Login vs RLS (crítico) — RESUELTO:** `usuarios` y `tenants` quedan **EXENTOS** del fail-closed (el login los consulta pre-sesión). Solo se enforza el módulo + `sitios`.
2. **Alcance de fail-closed — RESUELTO: Módulo + `sitios`.** Enforzar fail-closed+FORCE en `predios`, `arrendador_razon_social`, `contratos_arrendamiento`, `pagos_renta`, `arrendadores` y `sitios`. Implica fijar el GUC en TODO el acceso a sitios → validar a fondo Comercial/Operaciones/Inventario.
3. **P&L (money) — RESUELTO: Costo 0 sin fallback.** Renta atribuida; si no hay contrato vigente del predio → costo del espacio = 0 (marcado "sin renta"). **Nunca** se vuelve a sumar `costoCompra` (cero doble conteo).
4. **Atribución partes iguales — asumido: suma de `caras`.** `rentaAtribuida(pantalla) = rentaMensualDelPredio × (caras_pantalla / Σ caras del predio)` (equivale a "÷ nº de caras" cuando cada pantalla tiene 1). *(Confirmar si prefieres ÷ nº de pantallas.)*
5. **Moneda — RESUELTO: crear `tenants.moneda`** (default MXN); usarla en contratos/pagos/reportes.
6. **Backfill `predio_id` en sitios sin contrato — asumido: NULL** (no inventar predios) + UI para asignar. *(Confirmar.)*
7. **Borrado de arrendador — RESUELTO: bloquear (RESTRICT) + soft-delete** (`activo=false`) para conservar historial.

---

## 6. Orden de ejecución propuesto (tras aprobación)

`pg_dump` → M1 → M2 → M3 → refactor db-layer (GUC) → M4 (backfill) → M5 (RLS fail-closed+FORCE módulo) → M6 (rol dev) → prueba de aislamiento (falla cerrada) → CRUD faltante → calendario de pagos → pagos+factura/comprobante → P&L → deprecación → `tsc`/`build` verdes.

Cada bloque en commit pequeño, probado en vivo. **Nada de esto se ejecuta hasta el visto bueno del GATE.**

# SPACE OS — Auditoría de verificación post-remediación
Fecha: 2026-07-24 · Commit auditado: `5317af0` + working tree sin commitear · Branch: `feat/arrendadores-fase1-prod`
Commit pre-remediación de referencia: `5317af0`

> Nota: la remediación A-1..A-4 está en el árbol de trabajo (sin commitear) sobre `5317af0`.
> Verificado contra el estado REAL de código y BD (`pg_indexes`/`pg_constraint`/`pg_class`),
> con los tests de concurrencia y candado re-ejecutados por el auditor.

## Resumen ejecutivo
| Hallazgo | Veredicto | Riesgo residual |
|---|---|---|
| A-1 Carreras de dinero | **RESUELTO** | Ninguno detectado en el path de dinero. |
| A-2 Candado digital | **RESUELTO** | Menor: la OT física aún enciende `reporte` en OOH (inocuo). |
| A-3 Moneda | **RESUELTO** | `config_negocio.moneda='PEN'` (M-8, declarado fuera de scope); `seed.ts` hardcodea 'PEN'. |
| A-4 datos bancarios arrendador | **PARCIAL** | ⚠️ El candado es INALCANZABLE en el RBAC real: solo DUENO puede editar y DUENO está exento. El candado NO bloquea a nadie en producción; solo el audit log quedó efectivo. |
| Regresión global | **FALLA** | `npm ci` roto (drift de lockfile postcss) → CI / deploy fresco falla. |

---

## A-1 — Carreras de dinero
**Veredicto:** RESUELTO

**Evidencia:**

`UNIQUE` reales en BD (no leídos de la migración, sino de `\d` de la BD viva):
```
$ \d facturas / \d campanas  (filtrado a los índices únicos relevantes)
    "facturas_campana_uq"  UNIQUE, btree (campana_id)
    "campanas_propuesta_uq" UNIQUE, btree (propuesta_id) WHERE propuesta_id IS NOT NULL
```
El índice de `propuesta_id` es PARCIAL con la condición correcta (`WHERE propuesta_id IS NOT NULL`): permite múltiples campañas sin propuesta y una sola por propuesta.

`FOR UPDATE` DENTRO de la transacción de reserva:
```
apps/web/lib/server/campanas-repo.ts:271  await client.query('begin')  (fijarTenant en :272)
apps/web/lib/server/campanas-repo.ts:328  '... from sitios where id=$1 for update'
```
El bloqueo de la fila del sitio precede a la validación de colisión/slots, todo en una sola transacción (commit en :419).

Check de existencia dentro de la tx + violación de UNIQUE como error de negocio (no 500):
```
apps/web/lib/server/finanzas-repo.ts:183   if ((e).code === '23505') throw new FacturaError('La campaña ya tiene factura')
apps/web/lib/server/finanzas-controller.ts  FacturaError "ya tiene factura" → 409
apps/web/lib/server/campanas-repo.ts:561    if ((e).code === '23505') { relee y devuelve la campaña existente (idempotente) }
```

**Test de concurrencia re-ejecutado por el auditor** (`Promise.all` de 2 requests idénticos contra el BFF real):
```
  (a) status=[409,201]  facturas_en_bd=1  rechazo="La campaña ya tiene factura"
  (b) status=[201,201]  ids=[53c9cff6,53c9cff6]  campanas_en_bd=1  (idempotente: misma campaña, 1 en BD)
  (c) status=[201,409]  reservas_TEST=1  rechazo=""...TACUBA #610..." ya está reservada en esas fechas..."
A-1 CONCURRENCIA OK — 5 aserciones en verde.
```
En los 3 casos: exactamente 1 éxito + 1 rechazo limpio, y exactamente 1 registro en BD. Sin 500.

**Riesgo residual:** ninguno detectado. Las reservas usan `FOR UPDATE` y todo el flujo es una transacción; factura y campaña-desde-propuesta están respaldadas por índices únicos con manejo limpio del 23505.

---

## A-2 — Candado de facturación digital
**Veredicto:** RESUELTO

**Evidencia:**

La regla exige reproducciones reales (no un playlog vacío):
```
apps/web/lib/server/playlogs-repo.ts:87   if (input.campanaId && r.ok && !vacio) {   // vacío ⇒ no enciende evidencia
apps/web/lib/server/playlogs-repo.ts:92       set reporte_publicacion = true          // evidencia DIGITAL, no física
```

Candado por segmento en UN solo lugar (`derive.ts`), y el servidor lo REUSA (no lo duplica):
```
apps/web/lib/data/derive.ts   candadoDeSegmentos(tipoCampana, {ocRecibida, evidenciaFisica, evidenciaDigital}):
    exigeFisica  = tipoCampana==='OOH' || 'HIBRIDA'   → fotos_comprobatorias
    exigeDigital = tipoCampana==='DOOH' || 'HIBRIDA'  → reporte_publicacion
    candado = oc && (!exigeFisica||fisica) && (!exigeDigital||digital)   // AND por segmento
apps/web/lib/server/finanzas-repo.ts  generarFactura() llama candadoDeSegmentos(...) (ya no inline)
```

Caza de bypasses — TODAS las asignaciones server a los flags (grep):
```
apps/web/lib/server/campanas-repo.ts:701   reporte_publicacion = true      (publicación aprobada = digital)
apps/web/lib/server/ot-repo.ts:211-212     fotos_comprobatorias = true; reporte = case HIBRIDA...else true  (solo si ot.tipo='MONTAJE_LONA')
apps/web/lib/server/playlogs-repo.ts:92    reporte_publicacion = true      (proof-of-play = digital)
```
- No existe ningún endpoint de `app/api/**` que asigne estos flags directamente (grep vacío en `app/api`).
- `mock.ts` (adapter demo) los asigna, pero NO es el path de producción: el UI vivo lee de `useDemoStore` (hidratado por `GET /api/estado`) y factura por `fetch(/api/campanas/:id/facturar/)` (BFF, `exigirCambioSensible('finanzas','facturar')`). `data.facturar` (mock) no se llama en ningún componente.

**4 casos re-ejecutados por el auditor:**
```
  (a) DOOH oc=true reporteDigital=false → facturar=400 "candado ... completo"      → APAGADO ✓
  (b) DOOH reporteDigital=true → facturar=201 folio=F001-D617B012                   → ENCENDIDO ✓
  (c) HÍBRIDA tras cerrar OT MONTAJE_LONA real → fotosFisica=true reporteDigital=false; facturar=400  → APAGADO ✓
  (d) HÍBRIDA física+digital → facturar=201 folio=F001-6BAAD728                       → ENCENDIDO ✓
```
El caso (c) prueba la INDEPENDENCIA de segmentos: cerrar la OT de lona encendió la evidencia física pero NO la digital.

**Riesgo residual:** menor. `ot-repo.ts:212` aún enciende `reporte_publicacion=true` en campañas OOH no-híbridas; es inocuo (el candado OOH no mira `reporte`), pero deja el flag digital encendido en campañas sin segmento digital. Además, `reporte_publicacion` lo puede encender tanto el proof-of-play como la aprobación de publicación (`campanas-repo:701`); si la política exige estrictamente proof-of-play, habría que separarlos.

---

## A-3 — Moneda
**Veredicto:** RESUELTO

**Evidencia:**

`tenants.moneda` en BD:
```
$ information_schema.columns  tenants.moneda
moneda | 'MXN'::text | NOT NULL
```

Cero literales `'PEN'` en inserts de dinero del SERVIDOR (grep). Las ocurrencias son legítimas y NO están en el path de producción:
```
apps/web/lib/data/adapters/mock.ts:532,744   ('PEN')  → adapter DEMO in-browser (no es prod)
apps/web/lib/data/seed.ts:192,259,272,...     ('PEN')  → datos SEMILLA de demo
```
Ningún repo server (`finanzas-repo`, `campanas-repo`) hardcodea 'PEN': usan `coalesce((select moneda from tenants...), 'MXN')`.

Snapshot de moneda al crear (no lookup dinámico):
```
apps/web/lib/server/campanas-repo.ts:297,505  campaña: moneda = coalesce((select moneda from tenants where id=$),'MXN')
apps/web/lib/server/finanzas-repo.ts          factura: moneda = coalesce((select moneda from campanas...),(select moneda from tenants...),'MXN')
apps/web/lib/server/arrendadores-repo.ts:320  contrato: moneda = input.contrato.moneda ?? 'MXN'  (elección explícita del usuario)
reserva: NO tiene columna moneda → hereda de su campaña
```

Distribución en BD (sin `'PEN'` residual en tenant MXN):
```
campanas  | MXN | 12
facturas  | MXN | 1
contratos | MXN | 6
```

`derive.ts` con monedas mixtas NO totaliza 1:1:
```
apps/web/lib/data/derive.ts  totalizarMoneda(): si Object.keys(porMoneda).length > 1
    → { mixto:true, moneda:null, total:null, porMoneda }   // total NULL, NO suma divisas
Test vitest: totalizarMoneda([{1160,MXN},{580,USD}]).total === null (NO 1740); porMoneda={MXN:1160,USD:580}
```

**Riesgo residual:** `config_negocio.moneda` sigue en `'PEN'` (1 fila) — declarado FUERA de scope (M-8, pendiente). `seed.ts` hardcodea `moneda:'PEN'`: un re-seed crearía registros en soles, contradiciendo el default MXN (ver N-3). Conversión FX multi-moneda: fuera de scope (por diseño).

---

## A-4 — Datos bancarios del arrendador
**Veredicto:** **PARCIAL** ⚠️

**Evidencia:**

`exigirCambioSensible` en el PATCH cuando el payload toca datos bancarios:
```
apps/web/app/api/arrendadores/[id]/route.ts:15  CAMPOS_BANCARIOS = ['cuentaBancaria','formaPago']
apps/web/app/api/arrendadores/[id]/route.ts:~34  if (tocaBanco) { const gc = await exigirCambioSensible('arrendadores','crear'); if(!gc.ok) return gc.res }
```

Único write a `cuenta_bancaria`/`forma_pago` (grep de callers):
```
editarArrendador() (arrendadores-repo) ← solo lo llama editarArrendadorCtrl:182 ← solo lo llama el PATCH de la ruta.
No hay otro endpoint ni repo que escriba esos campos. Sin bypass de escritura.
```

**Pruebas re-ejecutadas por el auditor** (con un usuario COMERCIAL SINTÉTICO al que se le concedió `arrendadores.crear`, ver más abajo):
```
  (a) PATCH {telefono} sin candado → 200                                    (no sensible, flujo intacto) ✓
  (b) PATCH {cuentaBancaria} sin desbloqueo → 403 requiereDesbloqueo=true; cuenta_en_bd sin cambio  ✓
  (c) PATCH {cuentaBancaria} con desbloqueo del Dueño → 200; audit:
      accion="Cambió datos bancarios del propietario"
      entidad="...· cuenta bancaria "CTA-VIEJA-0001"→"CTA-NUEVA-9999""    (anterior→nuevo) ✓
```
La tabla `acciones` es append-only inmutable (trigger `trg_acciones_append_only`), así que el audit no se puede alterar/borrar desde la app.

**Por qué PARCIAL (bypass estructural, no de código):**
```
$ select rol from rol_permisos where modulo='arrendadores' and accion='crear';
DUENO                       ← ÚNICO rol con el permiso
apps/web/lib/server/cambios.ts:31  ROL_SIN_CANDADO = 'DUENO'   ← el DUENO está EXENTO del candado
```
En el RBAC REAL, el único rol que puede editar datos bancarios es `DUENO`, y `DUENO` está exento de `exigirDesbloqueo`. **El candado nunca se dispara en producción**: para EJERCITARLO, el test tuvo que conceder sintéticamente `arrendadores.crear` a un rol no-Dueño. Con la configuración vigente, una sesión de Dueño (o una sesión secuestrada / estación desatendida) cambia datos bancarios SIN reconfirmar contraseña — que es exactamente el vector que A-4 buscaba cerrar. Lo único NUEVO efectivo hoy es el **audit log** (que sí registra el cambio).

**Riesgo residual (ALTO):** redirección de pagos de renta por una sesión de Dueño sin reautenticación. El fix de código es correcto pero INERTE en el RBAC actual. Para que el candado "muerda": (a) conceder `arrendadores.crear` a un rol no-Dueño, o (b) quitar la exención del Dueño para los campos bancarios (que el propio Dueño reconfirme contraseña).

---

## Regresión global
**Veredicto:** FALLA (por `npm ci`)

ASSERT de cobertura RLS (tablas con `tenant_id` SIN RLS+FORCE):
```
$ pg_class: tablas con tenant_id y (relrowsecurity=false OR relforcerowsecurity=false)
password_resets | f | f
```
Única tabla sin RLS+FORCE. Es una excepción DELIBERADA y pre-existente: `password_resets` se accede PRE-SESIÓN vía `qRaw` (el usuario está bloqueado); la frontera de seguridad es el token de 256 bits de un solo uso. La remediación A-1..A-4 NO agregó tablas ni columnas con `tenant_id`, así que la cobertura RLS no cambió.

Smoke E2E:
```
SMOKE E2E OK — 13 aserciones en verde. Cadena completa conectada.
```

`tsc --noEmit`:
```
tsc_exit=0
```

`next build`:
```
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
build_exit=0
```

`npm ci` desde cero — **FALLA**:
```
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and package-lock.json ... are in sync.
npm error Invalid: lock file's postcss@8.5.22 does not satisfy postcss@8.5.23
```
El lockfile volvió a desincronizarse (package.json/árbol requieren postcss 8.5.23; el lock pinnea 8.5.22). NO es atribuible a la remediación A-1..A-4 (no tocó `package.json`/`package-lock.json`), pero **bloquea CI y cualquier deploy fresco** que corra `npm ci` (el `deploy.yml` lo hace). `node_modules` preexistente sobrevive (npm ci aborta en el pre-check), por eso `next build` sí pasa. REPORTADO, no corregido.

Migraciones append-only (git diff vs pre-remediación `5317af0`):
```
$ git diff --stat 5317af0 -- db/migrations/
(vacío)   ← ninguna migración previa modificada
Nuevas (untracked): 20260724_a1_carreras_endurecer.sql, 20260724_a3_moneda_default_mxn.sql
```

---

## Hallazgos nuevos detectados durante la verificación
(REPORTO, NO FIXEO)

- **N-1 · ALTO · `cambios.ts:31` + `rol_permisos`** — El candado de A-4 es inalcanzable: solo `DUENO` tiene `arrendadores.crear` y `DUENO` es `ROL_SIN_CANDADO`. Escenario: sesión de Dueño desatendida/secuestrada → cambio de `cuenta_bancaria` sin reautenticación → redirección de renta. Recomendación: quitar la exención del Dueño para campos bancarios, o mover el permiso a un rol no-Dueño.
- **N-2 · MEDIO · `package-lock.json`** — `npm ci` falla (postcss 8.5.22 vs 8.5.23). Escenario: CI/deploy fresco (`deploy.yml` corre `npm ci`) falla; se degrada a `npm install` no reproducible. Recomendación: reconciliar el lockfile (`npm install` y commitear el lock) y fijar postcss.
- **N-3 · BAJO · `lib/data/seed.ts:192,259,272,285,298,311,324,428`** — La semilla hardcodea `moneda:'PEN'`. Escenario: re-seed de un tenant MXN crea campañas/facturas/contratos en soles, contradiciendo el default y reintroduciendo el bug de A-3. Recomendación: derivar la moneda del tenant en la semilla.
- **N-4 · BAJO · `lib/data/client.ts:59`** — El adapter de datos por defecto es `mockAdapter` (`NEXT_PUBLIC_DEMO_HTTP` no está en local ni en el droplet). No es bypass de seguridad (el UI vivo lee del store hidratado por el BFF y muta por `/api`), pero es config muerta/confusa. Recomendación: retirar `mockAdapter` del path de producción o documentar su rol.
- **N-5 · BAJO · `ot-repo.ts:212`** — La OT de montaje enciende `reporte_publicacion=true` en OOH no-híbrida (evidencia digital en campaña sin segmento digital). Inocuo para el candado, pero semánticamente incorrecto. Recomendación: no tocar `reporte` en OOH.
- **N-6 · MEDIO · `config_negocio.moneda='PEN'`** — Ya declarado como M-8 (fuera de scope de A-3). Escenario: la config económica global sigue en soles. Recomendación: migrar en la fase M-8.
- **N-7 · BAJO · inventario** — ≥4 sitios estáticos con `estatus_comercial='DISPONIBLE'` que tienen reservas activas (`estatus<>'CANCELADA'`). Inconsistencia de estado (drift del contador). Detectado al preparar el test de reserva de A-1. Recomendación: recalcular `estatus_comercial`.

---

## Datos de prueba creados y limpiados
Todos los tests usan prefijo `TEST_` y limpian al final. Registros efímeros creados durante la verificación:
- A-1/A-2/A-3: clientes/propuestas/campañas/reservas/facturas `TEST_*` (auto-limpiados por cada script; verificado "0 residuos").
- A-4: usuario `test_comercial_a4@spaces.local` (COMERCIAL), grant temporal `rol_permisos(COMERCIAL,arrendadores,crear)`, arrendador `TEST_Arrendador_A4`, control de cambios activado temporalmente, y filas en la bitácora inmutable `acciones`. El usuario no se puede hard-borrar desde la app (FK a `acciones` append-only), así que la limpieza final se hizo con `session_replication_role=replica` (superusuario).

Query final de verificación de limpieza:
```
test_users=0
test_arrend=0
test_campanas=0
test_clientes=0
control_cambios_on=false
comercial_arrend_grant=0
```
Sin residuos. Estado de la BD restaurado al previo a la auditoría.

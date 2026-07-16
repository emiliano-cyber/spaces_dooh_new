# Arrendadores · Fase 1 — Reporte de cierre

Rama: `feat/arrendadores-fase1-prod` · Fecha: 2026-07-15
Estándar: **producción** (multi-tenant, RLS enforced, RBAC, bitácora, validación
server-side). Sin datos de demo ni atajos temporales.

---

## 1. Qué se migró / creó (BD)

Migraciones aditivas y versionadas (`db/migrations/`), todas idempotentes:

| Mig. | Contenido | Verificación |
|---|---|---|
| M1 | Columnas nuevas: arrendador (curp, dirección, cuenta, forma_pago, obs, activo), contrato (deposito, predio_id, razon_social_id, motivo_cancelacion), pago (comprobante_url, metodo_pago, observaciones), sitio (predio_id), `tenants.moneda`. Deprecación (COMMENT) de renta directa del sitio. | columnas presentes |
| M2 | Tablas `predios` y `arrendador_razon_social` + FKs + RLS | tablas + FKs OK |
| M3 | Enum canónico `periodicidad_pago` (8 valores) + normalización | columna = enum |
| M4 | **Backfill**: 1 predio por sitio con arrendamiento; repunta contrato.predio_id; convierte renta directa en contrato | 6 predios, 6 sitios ligados, 0 contratos sin predio; **idempotente** |
| M5 | **RLS fail-closed + FORCE** en predios, arrendador_razon_social, contratos, pagos, arrendadores, sitios | 6/6 enabled+forced+fail_closed |
| M6 | Rol restringido `spaces_app` (dev) + GRANTs; prod usa `spaces_user` | rolsuper=f, rolbypassrls=f |
| M7 | Índice único `(contrato_id, periodo)` → calendario idempotente | índice presente |

Respaldo previo `pg_dump` del dev antes del backfill (`migration-backup/`, no versionado).

**Capa de datos:** `lib/server/db.ts` fija `app.tenant_id` transaction-local en
`q()/q1()/withTenantTx`; `qRaw` solo para bootstrap exento (usuarios/tenants). La
app conecta con **rol restringido** (dev `spaces_app`, prod `spaces_user`).

---

## 2. Evidencia — Prueba de aislamiento (falla cerrada)

Como `spaces_app` (NOSUPERUSER/NOBYPASSRLS), con dos tenants A y B:

```
[1] GUC=A  -> 6 predios (0 de B)
[2] GUC=B  -> 1 predio  (0 de A)
[3] GUC sin fijar -> 0 filas            (fail-closed)
[4] INSERT predio con tenant ajeno -> ERROR RLS (WITH CHECK)
```

Smoke autenticado (`/api/estado`) bajo el rol restringido: HTTP 200, dataset
completo (arrendadores, contratos, sitios, predios, …). El aislamiento falla
cerrado sin `app.tenant_id`.

---

## 3. Evidencia — Margen cuadra a mano (sin doble conteo)

Test de regresión `apps/web/lib/data/derive.pnl.test.ts` (vitest, 4/4):

Caso: predio P1 con 2 caras, contrato VIGENTE 10 000 MENSUAL; reserva
CONFIRMADA de 8 000 en S1; `costoCompra` del sitio = 99 999 (debe ignorarse).

```
rentaAtribuida(S1)=5 000, S2=5 000 (10 000 ÷ 2 caras) ; S3 sin predio = 0
costoEspaciosMes = 5 000  (renta atribuida, NO el costoCompra 99 999)
margen = 8 000 − 5 000 = 3 000   (no −7 000 ⇒ la renta bruta NO se resta aparte)
margenPorSitio: S1 margen +3 000 ; S2 margen −5 000 (renta sin ingreso)
```

La renta del contrato vigente del predio **reemplaza** el costo de compra
(un solo costo). Atribución por **partes iguales** (ponderada por caras).

---

## 4. Funcionalidad (Fase 1.2–1.7)

- **CRUD** arrendador (editar; borrar = RESTRICT si tiene predios/contratos
  activos, si no soft-delete) y contrato (editar; cancelar con motivo; renovación
  con **fecha configurable**). RBAC `exigir()` + `registrarAccion` + zod.
- **Calendario de pagos** automático al crear/renovar contrato (idempotente,
  ON CONFLICT); periodos vencidos e impagos → VENCIDO, resto PENDIENTE; no inventa
  PAGADO. **Costo mensual equivalente** expuesto en la ficha del contrato.
- **Pagos**: registrar con adjuntos (factura/comprobante), método y observaciones;
  historial por contrato (vía `pagosRenta` del estado).
- **Razón social** del arrendador (tabla + alta) referenciable desde el contrato.
- **P&L**: renta = costo del espacio; deprecados los campos de renta directa del
  sitio (migrados en M4; el P&L ya no los lee).

---

## 5. Verificación global

`tsc --noEmit` = 0 · `next build` = verde · vitest P&L = 4/4 · prueba de
aislamiento OK. Smokes ejecutados contra `next start` (bundle de producción).

## 6. Pendiente reportado (no bloquea DoD; siguiente iteración)

- **UI "captura rápida" de renta por pantalla**: sigue *escribiendo* los campos
  directos `renta_arrendador`/`periodicidad_renta` del sitio para la columna de
  inventario. Ya no son fuente del P&L, pero quitar esa escritura/lectura en la UI
  es un cambio de front acotado (evitar dejar la columna en blanco). Reportado
  para no expandir el alcance de esta fase.
- Fuera de alcance por diseño (fases siguientes): alertas por correo (apps/api no
  desplegada), automatizaciones contrato→Operaciones, CRM de adquisición.

## 7. Nota de entorno (dev)

`next dev` en esta máquina (Next 14.2.29) dispara el bug conocido
`__webpack_require__.a is not a function` en route handlers POST/PATCH/DELETE
(afecta también rutas preexistentes). No es del código: `tsc` y `next build` van
en verde y los smokes corren contra `next start`. Verificar runtime con
`next build && next start`.

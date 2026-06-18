# Repaso integral pre-producción — SPACES OS

Validación de extremo a extremo del backend real (Postgres) con **un perfil
distinto en cada etapa** del flujo, antes de pasar a producción.

- **Runner automatizado:** `apps/web/scripts/e2e-prod-review.mjs`
- **Cómo correrlo:**
  1. Docker arriba: `docker compose -f db/docker-compose.yml up -d`
  2. BD en estado inicial (solo el usuario RGB) — el runner crea y deja la BD lista, pero **debe arrancar sin datos de campañas** (conteos exactos).
  3. Dev server arriba: `cd apps/web && npm run dev`
  4. `node apps/web/scripts/e2e-prod-review.mjs`
- **Último resultado:** ✅ **28/28 verificaciones OK**
- El runner crea usuarios de prueba por perfil; **al terminar, limpiar la BD a solo-RGB**:
  ```sql
  delete from usuarios where email<>'jose@pixeled.com.mx';
  delete from acciones; delete from ordenes_impresion; delete from cobranzas;
  delete from facturas; delete from evidencias_ot; delete from ordenes_trabajo;
  delete from reservas; delete from campanas; delete from clientes; delete from sitios;
  ```

> Nota: la base de pruebas mantiene **solo** al usuario `jose@pixeled.com.mx`
> (Cliente_ RGB Catorce, rol DUENO, contraseña `spaces123`). Todo lo demás se
> crea desde cero en cada validación.

---

## Checklist

### A. Autenticación y sesión
- [x] `GET /api/estado` sin sesión → **401**
- [x] Login con contraseña incorrecta → **401**
- [x] Login RGB (DUENO) → **200** + cookie de sesión httpOnly
- [x] Login de los 4 perfiles (Comercial/Operaciones/Imprenta/Finanzas) → **200**
- [x] Tras `logout`, la cookie deja de autenticar → **401**
- [x] Contraseñas almacenadas con **bcrypt** (hash en `usuarios.password_hash`)

### B. Comercial — inventario + reserva + OC
- [x] Alta de sitio → **201** (persistido con código de proveedor)
- [x] Reservar (campaña tentativa) → **201**
- [x] Confirmar reserva → **200** (campaña `CONFIRMADA`, sitios `OCUPADO`)
- [x] Registrar OC del cliente → **200** (`oc_recibida = true`)
- [x] **Presupuesto** calculado desde las reservas (tarifa mensual × meses) — *bug detectado y corregido en este repaso (antes facturaba 0)*

### C. Imprenta — órdenes de impresión
- [x] Crear orden de impresión ligada a campaña → **201**
- [x] Avanzar proceso (arte → validado → producción → impreso → montaje) → **200**

### D. Operaciones — OT + testigo
- [x] Crear OT ligada a sitio + campaña → **201**
- [x] Cerrar OT con testigo fotográfico → **200** (OT `COMPLETADA`, evidencia guardada)
- [x] Al cerrar OT se encienden fotos + reporte → **candado de facturación** completo

### E. Finanzas — facturación + cobranza
- [x] Generar factura con candado completo → **201** (monto = presupuesto, **S/ 18,000** en la prueba)
- [x] Re-facturar la misma campaña → **400** (no duplica)
- [x] Registrar pago de cobranza → **200** (`PAGADA`)
- [x] Campaña queda `COMPLETADA` tras facturar

### F. RBAC (limitaciones por perfil)
- [x] COMERCIAL no puede **facturar** → **403**
- [x] COMERCIAL no puede **crear OT** → **403**
- [x] IMPRENTA no puede **dar alta de sitio** → **403**
- [x] OPERACIONES no puede **facturar** → **403**
- [x] FINANZAS no puede **crear orden de impresión** → **403**

### G. Persistencia e interconexión
- [x] `/api/estado` refleja todo lo capturado (sitios, campañas, OI, OT, evidencias, facturas, cobranzas)
- [x] Conteos exactos tras el flujo: 1 campaña · 1 OI · 1 OT · 1 evidencia · 1 factura · 1 cobranza
- [x] Los datos sobreviven recarga (la BD es la fuente de verdad; el store solo hidrata)

### H. Bitácora (trazabilidad)
- [x] Cada acción real queda registrada con su **usuario** y timestamp (15 acciones en la prueba)
- [x] OC atribuida a **Comercial**
- [x] Orden de impresión atribuida a **Imprenta**
- [x] Cierre de OT atribuido a **Operaciones**
- [x] Factura atribuida a **Finanzas**

---

## Pendientes conocidos antes de producción (no bloqueantes del flujo)

- **Almacenamiento de imágenes:** los testigos se guardan como data URL (base64)
  en la BD. En producción mover a disco/S3 y guardar solo la URL.
- **Proración de presupuesto:** los meses se calculan como `días/30` redondeado
  (mínimo 1). No modela IVA ni márgenes (`bruto = neto`). Revisar si se requiere
  fiscalidad real.
- **UI editar/eliminar sitio:** endpoints existentes; falta la pantalla.
- **Despliegue:** build de producción, variables de entorno (`DATABASE_URL`,
  secreto de sesión), hosting de Postgres y del frontend.

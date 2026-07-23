# Reglas de negocio — Arrendadores / Contratos (Jochelo López)

Requerimientos acordados para el módulo de administración de inmuebles y contratos,
con su estado de implementación. Última actualización: 2026-07-23.

Leyenda: ✅ Implementado · 🟡 Ya existía (cubierto) · 🔵 Pendiente (feature nuevo)

---

## 1. Administración de inmuebles y gestión de contratos

> Modelo que gestione negociaciones y contratos de inmuebles: identificar espacios,
> firmar contratos de arrendamiento con duraciones específicas (p. ej. 2 años),
> pagos anualizados, e información detallada por predio para organizar el inventario.

- 🟡 **Estructura Arrendador → Predio → Contrato → Pantallas.** Ya existe (alta
  unificada atómica). Cada predio (inmueble) agrupa sus pantallas y su contrato.
- 🟡 **Duraciones específicas (2 años, etc.).** El contrato usa `fecha_inicio` y
  `fecha_fin` libres; una duración de 2 años es solo el rango de fechas.
- 🟡 **Pagos anualizados.** La periodicidad `ANUAL` genera un calendario de pagos
  anual automáticamente (también semanal/catorcenal/mensual/etc.).
- 🟡 **Información detallada por predio.** El predio guarda dirección, arrendador,
  razón social y sus pantallas; la renta se atribuye del contrato del predio.

## 2. Alertas y control de pagos

> Alertas con al menos 3 meses de anticipación de vencimientos de renta (anuales o
> mensuales), historial de facturas/pagos, control interno financiero aunque el
> pago se gestione fuera de la plataforma.

- ✅ **Alerta con 3 meses (90 días) de anticipación.** Nueva alerta "Renta por
  vencer" que avisa del próximo pago pendiente de cada contrato hasta 90 días
  antes (aplica a anuales y mensuales). Y "Contrato por vencer" también pasó de 30
  a 90 días. Nuevas: "Renta vencida" (ya existía) y "Contrato vencido".
- ✅ **Recálculo de estatus contra la fecha de hoy.** Antes el estatus quedaba
  "congelado" (un contrato vencido seguía como vigente y falseaba el costo de
  renta / no alertaba). Ahora se recalcula (vigente / por vencer a 3 meses /
  vencido) al cargar el estado.
- 🟡 **Historial de pagos.** Cada contrato tiene su calendario de pagos con
  estatus (pendiente/pagado/vencido), método, observaciones y adjuntos
  (factura/comprobante) por pago.
- 🟡 **Control aunque el pago sea fuera de la plataforma.** El pago se marca como
  PAGADO con su comprobante; la plataforma es el registro de control, no el medio
  de pago.
- 🔵 **Facturas del arrendador como entidad propia** (folio, historial consolidado
  por razón social) — hoy la "factura" es un adjunto del pago, no una entidad con
  su propio historial. Pendiente si se requiere ese nivel.

## 3. Administración por razones sociales

> Gestionar las distintas razones sociales de los arrendadores (un propietario con
> varias gasolineras/inmuebles) y asociar las negociaciones a cada razón social.

- 🟡 **Razones sociales por arrendador.** Ya existe la tabla
  `arrendador_razon_social`; un arrendador puede tener varias.
- 🟡 **Contrato asociado a una razón social.** El contrato guarda `razon_social_id`
  (bajo qué razón social se paga/factura).
- ✅ **Vista consolidada por razón social.** En Arrendadores, tabla "Por razón
  social" que agrupa contratos, predios, renta mensual y pagos vencidos de cada
  razón social (incluye una fila para los contratos sin razón social).

## 4. Integración entre Arrendadores y Operaciones  🔵 (feature nuevo)

> La gestión de un espacio publicitario debe disparar tareas de instalación,
> retiro o reubicación; seguimiento de activos en almacén; y pausar inventario por
> situaciones legales, reflejándose automáticamente en la disponibilidad comercial.

Estado: **Fase 1 hecha**; el resto pendiente. Lo que hoy existe y lo que falta:

- ✅ **Pausar por situación legal → disponibilidad (Fase 1).** Desde la ficha de
  la pantalla, "Pausar por situación legal" (con motivo) la saca de la
  disponibilidad comercial (queda BLOQUEADA) y muestra un banner con el motivo y
  la fecha; "Reanudar" la libera. Genera alerta y queda en la bitácora. Requiere
  permiso de Arrendadores. Distinto de "Reportar incidencia" (daño físico).
- ✅ **Disparar OT automáticamente (Fase 2).** Dos eventos ya crean una OT
  PENDIENTE (mejor esfuerzo, con nota de origen; Operaciones la ve):
  - Cancelar un contrato → OT de **retiro (DESMONTAJE)** de su pantalla.
  - Alta de pantalla nueva → OT de **montaje (MONTAJE_LONA)** — solo fijas (el
    montaje digital es obsoleto).
- ✅ **Reubicación.** Desde la ficha de la pantalla, "Reubicar" la mueve a otro
  predio y dispara una OT de reubicación.
- ✅ **Seguimiento de activos en almacén (Fase 3).** Módulo "Almacén": registra
  activos físicos (pantallas/estructuras/lonas), su estado (en almacén /
  instalado / en traslado / baja) y sus traslados (historial de movimientos).
  Al cerrar una OT de retiro (desmontaje), el equipo de la pantalla entra
  automáticamente al almacén como activo (ENTRADA).

**Propuesta de fases** (para dimensionar aparte):
1. Estado "pausa legal" del predio/sitio con motivo → refleja disponibilidad.
2. Al terminar/cancelar un contrato o dar de baja una pantalla → sugerir/crear OT
   de retiro; al alta con instalación → OT de montaje.
3. Módulo de almacén: pantallas en bodega, traslados, y su reflejo en inventario.

---

## Notas de implementación (2026-07-23)

- Recálculo: `recomputarEstatusArrendadores()` en `lib/server/arrendadores-repo.ts`,
  llamado como barrido de mantenimiento en `app/api/estado/route.ts` (solo para
  quien puede ver arrendadores). Umbral "por vencer" = 90 días (`DIAS_POR_VENCER`).
- Alertas: `construirAlertas()` en `lib/data/derive.ts` (renta por vencer / renta
  vencida / contrato por vencer / contrato vencido).

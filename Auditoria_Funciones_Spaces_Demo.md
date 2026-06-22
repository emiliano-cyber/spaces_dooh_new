# Auditoría de funciones — Spaces (Demo DOOH)

> Documento de auditoría del estado actual del programa: qué funciones tiene y cómo se manejan.
> Pensado como línea base para la comparativa de "lo que tenemos".
> Proyecto: `spaces_doohmain_nueva` · Marca demo: *Billboards Perú SA* · Acceso: `http://localhost:3000/spaces-dooh/demo/login/`

---

## 1. Resumen ejecutivo

| Aspecto | Estado actual |
|---|---|
| Tipo de aplicación | Plataforma web de gestión DOOH (Digital/Out-Of-Home) multi-módulo |
| Stack | Next.js 14 (App Router) + React 18 + TypeScript + Tailwind + MapLibre |
| Módulos funcionales | **14** (Dashboard, Comercial, Inventario, Campañas, Creativos, Operaciones, Imprenta, Finanzas, Network, Arrendadores, Administración, Actividad, OT móvil, Portal cliente) |
| Roles | **6**: Dueño, Comercial, Operaciones, Imprenta, Finanzas, Cliente |
| Entidades de datos | **17** principales (Sitio, Campaña, Reserva, Cliente, Arrendador, Creatividad, OT, Orden de impresión, Evidencia, Factura, Cobranza, Contrato, Pago renta, Incidencia, Usuario, Config, Bitácora) |
| Persistencia | Postgres propio del demo (Docker, puerto 5433) para auth/usuarios/config; capa de datos de pantallas con store en memoria (adaptador mock por defecto) |
| Autenticación | Login real con bcrypt + cookie httpOnly (`spaces_sesion`), sesiones en BD |
| Control de acceso | RBAC por módulo + acción (ver / crear / aprobar / facturar) |
| Reglas de negocio clave | Pipeline de campaña (10 etapas, variable por tipo de medio), candado de facturación (3 condiciones), semáforo de cobranza |

---

## 2. Inventario de módulos (qué hace cada uno)

| # | Módulo | Ruta | Roles | Funciones principales |
|---|---|---|---|---|
| 1 | **Dashboard** | `/demo/` | Dueño | KPIs (ingreso, margen, por cobrar, ocupación), gráficos de ocupación y reservas, alertas, mapa de la red, campañas por finalizar |
| 2 | **Comercial** | `/demo/comercial/` | Dueño, Comercial | Buscar/filtrar sitios, lista + mapa, reservar (selección múltiple), confirmar/extender reservas tentativas, ficha de sitio, alta de pantalla |
| 3 | **Inventario** | `/demo/inventario/` | Dueño | Alta de pantalla manual (con pestaña IA) y carga masiva por Excel/CSV |
| 4 | **Campañas** | `/demo/campanas/` | Dueño, Comercial | Lista de campañas con pipeline visual; detalle con OC, sitios, imprenta, OT, creativos, evidencias, candado y presupuesto (neto/IVA/total) |
| 5 | **Creativos** | `/demo/creativos/` | Dueño, Comercial | Subir creativos (imagen o código HTML), aprobar/rechazar, asignar a spots (digital: nº repeticiones; fijo: imagen única) |
| 6 | **Operaciones** | `/demo/operaciones/` | Dueño, Operaciones | Crear OT (con sitio automático por campaña), filtrar por estado, asignar cuadrilla, abrir OT móvil |
| 7 | **Imprenta** | `/demo/imprenta/` | Dueño, Imprenta | Crear orden de impresión (solo OOH/híbrida), avanzar proceso de 5 etapas (arte → validado → producción → impreso → listo montaje) |
| 8 | **Finanzas** | `/demo/finanzas/` | Dueño, Finanzas | Generar factura (requiere candado), elegir plazo (60/90/120), tabla de cobranza con semáforo de vencimiento |
| 9 | **Network** | `/demo/network/` | Dueño, Comercial | KPIs de red, CMS por pantalla (Broadsign/Invidis/Doohmain), toggle "En Network", programático vs tradicional |
| 10 | **Arrendadores** | `/demo/arrendadores/` | Dueño | Contratos de arrendamiento, alertas de vencimiento, pagos de renta, registrar pago |
| 11 | **Administración** | `/demo/administracion/` | Dueño | Usuarios (invitar, cambiar rol, activar/desactivar), matriz de permisos, configuración (nombre, moneda, plazos, tipos de tarea) |
| 12 | **Actividad** | `/demo/actividad/` | Dueño | Bitácora cronológica de acciones (usuario, acción, entidad, fecha-hora) |
| 13 | **OT móvil** | `/demo/m/ot/[id]/` | Operaciones | Vista de campo: checklist, foto comprobatoria, sello de geolocalización, cerrar OT |
| 14 | **Portal cliente** | `/demo/portal/[token]/` | Cliente (público con token) | Seguimiento de campaña: pipeline, ubicaciones (sin precios), evidencias de instalación |

---

## 3. Modelo de datos (entidades y estatus)

### 3.1 Entidades principales

| Entidad | Para qué sirve | Relaciones clave |
|---|---|---|
| **Sitio** (pantalla) | Inventario físico/digital; incluye IA (`computerVision`, `admobilizeId`) | ↔ Campaña (vía Reserva), Contratos, Incidencias, OT |
| **Campaña** | Venta a un cliente; tipo OOH/DOOH/HIBRIDA; banderas de candado | → Cliente, Reservas, Creatividades, OI, OT, Factura |
| **Reserva** | Liga sitio↔campaña con fechas, precio y tipo de venta | → Campaña, Sitio |
| **Cliente** | Anunciante | → Campañas, Facturas |
| **Creatividad** | Arte (imagen o código) por campaña; con validación | → Campaña |
| **Arrendador** | Dueño del predio | → Contratos |
| **Contrato de arrendamiento** | Renta del sitio | → Sitio, Arrendador, Pagos |
| **Pago de renta** | Pago periódico al arrendador | → Contrato |
| **Incidencia** | Problema en un sitio (clima, vandalismo, legal…) | → Sitio, Usuario |
| **Orden de trabajo (OT)** | Tarea de cuadrilla (montaje, mantenimiento…) | → Sitio, Campaña, Evidencias |
| **Evidencia OT** | Foto + geolocalización de campo | → OT, Usuario |
| **Orden de impresión** | Producción de lona (medios físicos) | → Campaña, Sitio |
| **Factura** | Facturación de campaña (subtotal, IVA, total) | → Campaña, Cliente, Cobranzas |
| **Cobranza** | Seguimiento de cobro con plazo y vencimiento | → Factura |
| **Usuario** | Acceso al sistema con rol | → OT, Evidencias, Incidencias |
| **ConfigNegocio** | Parámetros del tenant (moneda, plazos, tipos de tarea) | — |
| **Bitácora (AccionLog)** | Auditoría de cada acción | → Usuario |

### 3.2 Estatus / catálogos relevantes

- **Estatus comercial de sitio:** Disponible · Reservado · **Ocupado** · Bloqueado · En mantenimiento · Baja
- **Tipo de campaña:** OOH (fija) · DOOH (digital) · Híbrida
- **Estado comercial de campaña:** Draft · Cotización · Confirmada · Activa · Completada · Cancelada · Lista para facturar
- **Estatus de reserva:** Tentativa · Confirmada · Cancelada
- **Validación de creatividad:** Pendiente · Validada · Rechazada
- **Orden de impresión:** Arte recibido · Validado · En producción · Impreso · Listo montaje
- **Orden de trabajo:** Pendiente · Asignada · En proceso · Bloqueada · En revisión · Completada · Rechazada · Cancelada
- **Cobranza:** Al corriente · Por vencer · Vencida · Pagada
- **Tipos de OT:** Montaje lona/digital, desmontaje, mantenimiento preventivo/correctivo, herrería, eléctrico, inspección, otro

---

## 4. Reglas de negocio (cómo se maneja)

### 4.1 Pipeline de campaña (derivado, no almacenado)
Orden canónico de 10 etapas:
`reservada → confirmada → oc_recibida → creativo_recibido → creativo_validado → en_imprenta → en_produccion → instalada → reporte_generado → lista_facturar`

Las etapas **cambian según el tipo de medio**:

| Tipo | Creativo recibido/validado | En imprenta |
|---|:---:|:---:|
| **Fija (OOH)** | No | **Sí** |
| **Digital (DOOH)** | **Sí** | No |
| **Híbrida** | Sí | Sí |

### 4.2 Candado de facturación
Una campaña solo se puede facturar cuando se cumplen **las 3 condiciones**:
`OC recibida` **y** `fotos comprobatorias` **y** `reporte de publicación`.
Al cerrar una OT con foto, se marca *fotos comprobatorias*; al cumplirse las 3, la campaña pasa a *Lista para facturar* y aparece en Finanzas.

### 4.3 Semáforo de cobranza (recalculado vs. hoy)
- **Pagada** (verde) · **Vencida** (rojo, días < 0) · **Por vencer** (ámbar, ≤30 días) · **Al corriente** (verde)
- Genera alertas automáticas en el Dashboard.

### 4.4 Métricas y alertas del Dashboard
Ingreso del mes, costo de renta, margen y %, por cobrar, ocupación de la red, reservas tentativas vs. confirmadas; alertas por renta vencida, contrato por vencer, factura vencida/por vencer y sitio bloqueado por incidencia.

---

## 5. Roles y permisos (RBAC)

Capacidades: **V** = ver · **C** = crear · **A** = aprobar · **F** = facturar

| Módulo | Dueño | Comercial | Operaciones | Imprenta | Finanzas | Cliente |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard | V | V | — | — | V | Portal |
| Comercial | V C A | V C | V | — | — | — |
| Inventario | V C | — | — | — | — | — |
| Arrendadores | V C A | — | — | — | — | — |
| Operaciones | V A | — | V C | V | — | — |
| Imprenta | V A | — | V | V C | — | — |
| Finanzas | V F | — | — | — | V C F | — |
| Network | V C | V | — | — | — | — |
| Administración | V C A | — | — | — | — | — |

**Cómo se aplica:**
- Hook `usePuede(modulo, accion)` muestra/oculta o deshabilita botones.
- `AuthGate` redirige si la ruta no corresponde al rol.
- El Sidebar filtra el menú según el rol.
- El **Portal cliente** no entra al chrome interno: solo ve su campaña por token, sin financieros.

---

## 6. Arquitectura — cómo se maneja técnicamente

### 6.1 Stack
- **Frontend/UI:** Next.js 14.2 (App Router, `basePath: /spaces-dooh`, `trailingSlash`), React 18, Tailwind, Radix UI, Lucide, Recharts, **MapLibre GL** (mapas, sin Google).
- **Estado en cliente:** Zustand (store en memoria) + hooks en vivo; React Query disponible.
- **Backend del demo (BFF):** Route Handlers de Next (`app/api/**`) contra Postgres propio.
- **Backend "producción" preparado:** app Fastify + Prisma + Redis/BullMQ + S3 (DigitalOcean) en `apps/api` (no conectado al frontend del demo).

### 6.2 Capa de datos (patrón adaptador)
- `lib/data/client.ts` expone una API única para las pantallas, con **dos adaptadores intercambiables**: `mock` (por defecto, lee/escribe el store sembrado) y `http` (preparado para el backend real).
- `lib/server/db.ts` = pool de Postgres del demo.
- `lib/data/derive.ts` = cálculos derivados (pipeline, candado, métricas, cobranza) — misma lógica para mock y http.
- Flag `NEXT_PUBLIC_DEMO_HTTP=1` cambia de mock a http sin tocar las pantallas.

### 6.3 API interna (BFF)
Rutas en `app/api/**`: `auth` (login/me/logout), `sitios` (+import), `estado` (hidratación), `campanas/[id]` (confirmar/extender/oc/facturar/creativo), `reservar`, `creatividades`, `impresion`, `ot/[id]/cerrar`, `cobranzas/[id]/pagar`, `usuarios`, `config`, `permisos`. Cada ruta valida sesión + permiso y registra en la bitácora.

### 6.4 Autenticación y sesión
- Login: email + contraseña (bcrypt) → token aleatorio en tabla `sesiones` (30 días) → cookie httpOnly `spaces_sesion`.
- `/api/auth/me` resuelve usuario + permisos; logout destruye la sesión.

### 6.5 Base de datos del demo
- Postgres 16 en Docker (`db/docker-compose.yml`), puerto **5433**, BD/usuario `spaces`, Adminer en **8081**.
- Esquema en `db/schema.sql` (se ejecuta al crear el volumen); incluye índices, FKs con cascadas (CASCADE/RESTRICT/SET NULL) y trigger de `actualizado_en`.

### 6.6 Despliegue
- PM2 (`ecosystem.config.js`): `spaces-web` (3000) y `spaces-api` (3001).
- Cabeceras de seguridad en `next.config.mjs` (X-Frame-Options, nosniff, Referrer-Policy).

---

## 7. Funciones nuevas/ajustadas en esta iteración

| Función | Módulo | Detalle |
|---|---|---|
| IA al crear pantalla | Inventario | Casilla Computer Vision + ID AdMobilize + visor de imagen de detección |
| Indicador IA en ficha | Comercial | Badge verde "Con IA" (con imagen) / rojo "Sin IA" |
| Pipeline por tipo de medio | Campañas | Fija = imprenta sin creativos; digital = creativos sin imprenta; híbrida = ambos |
| Sitio automático en OT | Operaciones | Al elegir campaña, el sitio se autocompleta desde su reserva |
| Mapa más grande + nombres | Dashboard/Comercial | Mapa ampliado; nombres automáticos al acercar zoom y al pasar el mouse |
| Estatus Ocupado en azul | Global (mapa/badges) | "Ocupado" cambia de verde a azul, con leyenda actualizada |

---

## 8. Checklist comparativo (para "lo que tenemos")

Marca el estado de cada función al comparar (✔ = lo tenemos / ◑ = parcial / ✘ = falta).

| Capacidad | Estado | Notas |
|---|:---:|---|
| Login con roles y permisos (RBAC) | ✔ | bcrypt + cookie httpOnly |
| Dashboard con KPIs y alertas | ✔ | |
| Inventario manual + carga masiva (Excel) | ✔ | |
| IA / Computer Vision en pantallas | ✔ | demo: imagen de muestra |
| Comercial: buscar, reservar, confirmar | ✔ | |
| Mapa geolocalizado con estatus por color | ✔ | ocupado = azul |
| Campañas con pipeline visual | ✔ | 10 etapas, variable por tipo |
| Creativos (imagen + código) y validación | ✔ | |
| Operaciones + OT móvil (foto + geo) | ✔ | |
| Imprenta (flujo de producción) | ✔ | solo OOH/híbrida |
| Finanzas: facturación + cobranza | ✔ | candado de 3 condiciones |
| Network / programático + CMS | ✔ | |
| Arrendadores: contratos + pagos | ✔ | |
| Administración: usuarios + config | ✔ | |
| Bitácora de auditoría | ✔ | |
| Portal del cliente (token) | ✔ | sin financieros |
| Backend de producción conectado (Fastify) | ◑ | preparado, no conectado al frontend demo |
| Persistencia real en todas las pantallas | ◑ | auth/usuarios/config sí; resto vía store mock por defecto |
| Pagos/cobranza con pasarela real | ✘ | registro manual de pago |
| Notificaciones por correo (Resend) | ◑ | configurado en API, no en demo |

---

*Documento generado para auditoría y comparativa — Spaces (Demo). Las rutas y reglas citadas reflejan el estado del repositorio al momento de la auditoría.*

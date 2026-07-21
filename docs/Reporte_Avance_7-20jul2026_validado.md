# SPACE OS — Reporte de avance: 7 → 20 de julio 2026 (validado contra git)

> **Versión corregida.** Este documento parte del reporte original de Ana (cruce de 3 manuales + 3 auditorías) y lo **valida commit por commit** contra el repositorio. Cada afirmación de avance lleva ahora su(s) commit(s) de respaldo. Se corrigieron 2 afirmaciones que el historial contradice (Comisiones y el timing de Arrendadores) y se añadió 1 avance del periodo que el original omitía (`d5e683e`).
>
> **Método de validación:** `git log --since=2026-07-06 --until=2026-07-21 --all`, contrastado con el estado real de los archivos en `HEAD`. Autoría del código en el periodo: la totalidad de los commits son de `emiliano-cyber` (un solo autor); "Ana" firma la redacción del reporte, no el código.

**Fuentes cruzadas (6 documentos, ordenados por fecha real de creación):**

| # | Documento | Fecha | Tipo |
|---|---|---|---|
| 1 | Manual de Usuario v1 (`report-9780`, branding "Spaces" naranja) | 07-jul 19:42 | Manual |
| 2 | Auditoría de cierre pre go-live PIXELED/G500 (39 verificaciones) | 08-jul 21:09 † | Auditoría |
| 3 | Manual de Usuario v2 ("by AS Network", botones azules) | 14-jul 23:36 | Manual |
| 4 | Auditoría Arrendadores y Finanzas de Rentas | 15-jul | Auditoría |
| 5 | Auditoría Técnica Integral (necesita vs. hace) | 20-jul 15:32 | Auditoría |
| 6 | Manual de Usuario v3 (Guía completa, 30 págs) | 20-jul 16:54 | Manual |

† **Corrección de fecha:** el original fechaba la auditoría de cierre el 09-jul 02:56; el commit del documento (`74efecf docs: informe de auditoría de cierre pre go-live (39/39 en verde)`) es del **08-jul 21:09**. El desfase es de horas (probable regeneración del PDF al día siguiente).

---

## 1. Resumen ejecutivo del periodo

En 13 días el sistema pasó de "demo funcional aprobada para go-live" a **plataforma con ~90% de la funcionalidad de negocio implementada y persistente**, con la cadena completa comercial → producción → operación → fiscal → cobranza corriendo contra Postgres. Los tres saltos más grandes del periodo fueron: (1) el **módulo Arrendadores/rentas**, que pasó de 4 rojos en la auditoría del 15-jul a totalmente cerrado el **16-jul** (ver corrección de timing en §3); (2) la **publicación real a DOOHmain**, que pasó de "modo demo" a publicación vía SDK con reglas de operación documentadas; y (3) el **pipeline de campañas**, que evolucionó incorporando el ciclo digital completo (Enviada al dominio → Publicada) y la separación imprenta/producción. Lo que **no** avanzó en el periodo es transversal y ya está identificado: timbrado fiscal, correo, scheduler, storage en Spaces y endurecimiento de permisos.

**Indicador global al cierre:** ~90% funcionalidad de negocio · ~55% listo para producción · 3 bloqueantes externos.

---

## 2. Línea de tiempo del avance (con commits)

**07-jul (Manual v1).** El sistema ya opera el ciclo base: inventario con carga masiva Excel, mapa comercial, disponibilidad por catorcena, propuestas con método del divisor, liga pública con aceptación del cliente, campañas con pipeline base, creativos, imprenta, OT con checklist + foto, finanzas con candado y cobranza con semáforo, arrendadores con rentabilidad por pantalla, network, bitácora, **y el módulo de Comisiones** (ya presente desde el 25-26 jun — ver §3, corrección 1). Integraciones: todas en **modo demo**. Branding: "Spaces".
> Contexto del arranque del periodo: `16731df` (07-jul) *fix(facturación): propagar descuento y reproducir el total aceptado de la propuesta*; `8019537` (07-jul) *ci(deploy): acotar typecheck y build al app web (excluye el api huérfano)*.

**08-jul (Auditoría de cierre + fundación por capas).** Día de mayor densidad de commits del periodo. Se cierran los hallazgos S0/S1 y se refactoriza toda la app al patrón por capas:
- `9bc5d90` S0-1 snapshot económico inmutable · `d38be76` S0-3 motor de reservas por tipo de medio (fin del doble-booking) · `8f6fc3d` S0-2/S1-6 UI de pagos/abonos + badge de costo estimado.
- `98d6f9a` S1-1/S1-2 validación de fechas (fin≥inicio) + guardarraíl de aprobación en $0 · `40ddf1b` S1-4/S1-5 OC real con folio/monto/fecha/documento + OT con fecha compromiso · `3fcc11a` S1-3 token aleatorio no enumerable para la liga pública.
- `043dc02` red compartida entre CRMs + bloqueo de duplicados ajenos · `bc51a4f` política de contraseñas + elimina defaults débiles.
- Fundación por capas (ruta→controller→model + AppError + zod): `a1346b9`, `3734f24`, `ae42d65`, `819df42`, `cb87cf8`, `8272658`, `51f868c`, `865dfdb`, `e9c5016` (9 commits).
- `74efecf` docs: informe de auditoría de cierre (39/39 en verde). **Veredicto: apto para go-live de PIXELED.**

**09-jul (creativos HTML).** `4b5423e` renderizar creativos HTML en `<iframe>` · `6f273ab` no permitir rechazar un creativo ya aprobado · `ebbfa86` botón "Ver HTML" con fuente + descarga · `770a048` docs API DOOHmain v2.8.4.

**10-jul (DOOHmain real).** `8d613d8` **SDK de integración con DOOHmain** (Python, adaptado a Postgres) · `82a8d5e` cablear el SDK al handler de aprobación (**detrás de flag**). Aquí es donde "modo demo" pasa a publicación real.

**13-jul (ciclo digital + rebranding).** `4ee8b50` enviar al dominio salvo canceladas + etapas de publicación · `c06f0c6` subir la imagen embebida del creativo, no el HTML · `6d169ab` pantallas digitales con 12 slots fijos (control DOOHmain) · `a0f6512` eliminar y reemplazar creativos (SDK + backend) · `f187d41` HTML adaptativo (fondo difuminado) · `9aff863` mostrar si cada sitio es Digital o Fija · `feb3254` filtro de búsqueda por nombre/folio/cliente · **`d2247ff` rediseño de marca SPACE OS del shell** (origen del branding azul; el manual v2 lo documenta al día siguiente).

**14-jul (Manual v2).** `7639206` publicar solo pantallas digitales, nunca fijos · `80fa203` slots disponibles por conteo (1 slot = 1 campaña) + badge · `3604f87` estado honesto de retirados + aviso al publicar · `86d123f` docs diseño de la integración DOOHmain. Rebranding a **"by AS Network"** con sistema de diseño azul (#0A66FF).

**15-jul (Auditoría Arrendadores + cierre en el mismo día).** La auditoría (`f0f00cf`) levanta 4 rojos, y **los 4 se cierran el mismo 15-jul**:
- Migraciones M1-M6: `c4e2b34` M1 columnas · `9b4c3ca` M2 tablas predios/razón social + FKs + RLS · `147d5ee` M3 enum periodicidad · `911413e` db-layer fija `app.tenant_id` (GUC) · `38912ae` M4 backfill · `775b96e` **M5 RLS fail-closed+FORCE** + M6 rol restringido.
- Rojos cerrados: `2051aee` CRUD faltante de arrendador y contrato (1.2) · `4f4b107` **calendario automático de pagos_renta (1.3)** · `9ab1984` P&L renta = costo del espacio (1.6/1.7) · `aa6b4ea` pagos con adjuntos (1.4) + razón social (1.5) · `6268ba5` PDF del contrato en base64.

**16-jul (pulido Arrendadores + control de cambios + proof of play).** `e4b9610` predio obligatorio + un contrato activo por predio (1.1/1.6) · `3584893` deprecación limpia de la renta directa del sitio · `d615131` validación de fechas/repago + fuga de errores de Postgres · `4258425` UI de adjuntos de pago · `cbfe92c` asignar pantallas del inventario al arrendador · `07e1a70` mostrar Fija/Digital en el contrato · `985fdd0` M6 deja de crear rol de login con contraseña en claro · **`3360be1` control de cambios con contraseña del Dueño** · **`3d7e6ee` tubo de proof of play (payload crudo)** · `f8c2ff3` apartado de proof of play en la ficha · `1467736` fix del rango horario del proof of play.

**17-jul (identidad por tenant).** **`d5e683e` razón social y nombre comercial por tenant en el Dashboard.** *(Este commit es del periodo y no figuraba en el reporte original — ver §4.)*

**20-jul (Auditoría Integral + Manual v3).** La auditoría integral reconcilia: casi todos los rojos del 15-jul ya están cerrados por código (§5). El manual v3 documenta el sistema más maduro. *(Nota: al 20-jul no hay commits de código; es día de auditoría y documentación.)*

---

## 3. Correcciones respecto al reporte original

Dos afirmaciones del reporte original resultaron contradichas por el historial de commits. Se corrigen aquí de forma explícita para que el reporte sea auditable.

### Corrección 1 — El módulo Comisiones NO es "nuevo del periodo"

El reporte original afirmaba, en el cuadro de avance por módulo: *"Comisiones — (No existía como módulo en v1) … Módulo nuevo del periodo."*

**Esto es incorrecto.** El módulo Comisiones se construyó el **25-26 de junio de 2026**, dos semanas antes del inicio del periodo:

| Commit | Fecha | Descripción |
|---|---|---|
| `37b4c23` | 25-jun 16:32 | comisión por agencia + negociación de agencia con validación |
| `f5e2c13` | 26-jun 11:33 | pantalla de Comisiones (ajuste por agencia + agencia por cliente) |
| `c9f7709` | 26-jun 11:41 | alta de agencia desde la pantalla de Comisiones |

El módulo **existe y está vivo** en `HEAD` (`apps/web/app/demo/(shell)/comisiones/page.tsx`, 14 KB; entrada en el nav para roles DUEÑO y COMERCIAL). Que Manual v1 no lo documentara no implica que no existiera — el commit demuestra que ya estaba operativo. **Afirmación corregida:** el módulo no es nuevo del periodo; lo nuevo es su *documentación*, que aparece por primera vez en Manual v2 (14-jul). No hubo commits de Comisiones entre el 7 y el 20 de julio; el módulo no avanzó en el periodo.

### Corrección 2 — El cierre de Arrendadores fue más rápido, no "5 días"

El reporte original afirmaba: *"4 rojos del 15-jul cerrados en 5 días"* y *"totalmente cerrado el 20-jul."*

**El historial muestra un cierre más rápido.** Los 4 rojos (calendario de pagos, CRUD de contrato, adjuntos, P&L de renta) se cerraron el **mismo 15-jul** (`4f4b107`, `2051aee`, `aa6b4ea`, `9ab1984`), y el pulido final (predio obligatorio, deprecación de renta directa, UI de adjuntos) el **16-jul**. Del 17 al 20 de julio **no hubo un solo commit del módulo Arrendadores**. El módulo estuvo cerrado al 16-jul, en ~1 día de la auditoría, no en 5. **Afirmación corregida:** "4 rojos cerrados en ~24 h; módulo estabilizado al 16-jul."

---

## 4. Avance del periodo omitido en el reporte original

El reporte original no incluía este commit, que sí pertenece al periodo:

| Commit | Fecha | Avance |
|---|---|---|
| `d5e683e` | 17-jul 11:40 | **Razón social y nombre comercial por tenant en el Dashboard** — la identidad fiscal deja de ser global y pasa a resolverse por organización (tabla `tenants`). |

Otros commits menores del periodo que el reporte plegó dentro de las filas de módulo, listados aquí por completitud: `feb3254` (filtro de búsqueda de campañas), `6d169ab` (12 slots fijos por pantalla digital), `9aff863` (Digital/Fija en propuestas).

---

## 5. Avance por módulo (7-jul vs. 20-jul) con respaldo de commit

| Módulo | Estado 07-jul (Manual v1) | Estado 20-jul (Auditoría + Manual v3) | Commits de respaldo |
|---|---|---|---|
| **Inventario** | Carga masiva Excel, alta manual fija/digital, ficha | + plantilla descargable, imágenes por lote, duplicados, precio m², anti-sobreventa por tipo de medio E2E, 12 slots digitales | `d38be76`, `6d169ab`, `80fa203` |
| **Propuestas** | Divisor, versiones, descuentos, liga pública, aceptación | + snapshot inmutable, token no-enumerable, confirmación $0, aprobación sitio por sitio, generar campaña idempotente, entrada por folio, Digital/Fija visible | `9bc5d90`, `3fcc11a`, `98d6f9a`, `9aff863` |
| **Campañas / pipeline** | Pipeline base, tipo único de flujo | Derivación OOH/DOOH/Híbrida, guards en ambos sentidos (409), TTL reservas 7 días, cola "Por validar", etapas de publicación, búsqueda | `4ee8b50`, `feb3254`, `d38be76` |
| **Creativos** | Subir imagen/código, aprobar/rechazar, asignar | + reemplazar con retiro sincronizado de DOOHmain, "estado honesto" de retirados, HTML adaptativo, `<iframe>`, "Ver HTML" | `4b5423e`, `6f273ab`, `ebbfa86`, `a0f6512`, `f187d41`, `3604f87` |
| **Publicación DOOHmain** | Conector en **modo demo** | **Publicación real vía SDK** (flag): 1 campaña = 1 sublista, solo validados, extracción de imagen del HTML, reglas de no-borrado | `8d613d8`, `82a8d5e`, `c06f0c6`, `7639206` |
| **Arrendadores / rentas** | Alta propietario, contratos, rentabilidad por pantalla | + **calendario auto (12 periodos)**, editar/renovar/cancelar, adjuntos (5MB/MIME), PDF del contrato, renta del predio compartida, predio obligatorio | `f0f00cf`(auditoría), `4f4b107`, `2051aee`, `9ab1984`, `aa6b4ea`, `6268ba5`, `e4b9610`, `3584893`, `4258425`, `cbfe92c` |
| **Operaciones / OT** | OT con checklist y foto | + vista móvil, geo obligatoria, cierre con checklist+foto+geo, SLA/vencidas, evidencia enciende candado | `40ddf1b`, `cb87cf8` |
| **Finanzas / cobranza** | Candado, factura IVA, plazos, semáforo | + abonos parciales con saldo, liquidar detiene recordatorios, candado server-side. **Timbrado SIMULADO — bloqueante #1** | `8f6fc3d`, `819df42`, `9bc5d90` |
| **Comisiones** | **Ya existía** (25-26 jun, ver §3) | Sin cambios en el periodo | *(pre-periodo: `37b4c23`, `f5e2c13`, `c9f7709`)* |
| **Network** | Toggle "En Network" | + costo interno oculto entre CRMs, operador visible, anti-duplicados 409, conteo por CMS | `043dc02` |
| **Portales externos** | Liga de propuesta + seguimiento | **Tres portales**: seguimiento (token, sin precios), carga de creativos (JPG/PNG/PDF/MP4/MOV hasta 500 MB — verificado en `portal/[token]/page.tsx`), portal con login + **chat cliente-técnico con fotos** (`comentarios` + `/comentarios/foto-url`) | verificado en código (rutas `portal/[token]`, `portal/cliente/*`) |
| **Seguridad / permisos** | Roles por menú, bcrypt | RBAC en BD (6 roles × módulo × acción), RLS fail-closed en 7 tablas, control de cambios con contraseña del Dueño, rate-limit login, tokens no-enumerables. Auditoría integral levanta 8 hallazgos de endurecimiento | `a1346b9`, `775b96e`, `3360be1`, `bc51a4f`, `3fcc11a`, `985fdd0` |
| **Branding / identidad** | "Spaces", botones naranjas | "SPACE OS by AS Network", azul #0A66FF, configuración de negocio, **razón social/nombre comercial por tenant** | `d2247ff`, `d5e683e` |

---

## 6. Reconciliación: documentación pendiente que el código ya cerró

La auditoría integral del 20-jul verificó que estas brechas, aún listadas como pendientes en documentos previos, **ya estaban resueltas**. Ahora con commit de respaldo:

| Brecha (doc del 15-jul o anterior) | Estado verificado 20-jul | Commit |
|---|---|---|
| Calendario de pagos de renta — "NO EXISTE" | Auto-generado al crear contrato (12 periodos) | `4f4b107` |
| Editar / renovar / cancelar contrato — "ROJO" | Los tres endpoints existen y funcionan | `2051aee`, `e4b9610` |
| Adjuntos de pago — "sin UI" | UI + ruta dedicada con validación 5MB/MIME | `aa6b4ea`, `4258425` |
| Propuesta → campaña — "corte en el flujo" | Genera campaña + reservas, probado E2E | *(flujo en `865dfdb`)* |
| Guard OOH↛creativo — "pendiente B1" | Server rechaza creativo en campaña fija | `d38be76` |
| Publicación DOOHmain — "modo demo" | Publicación real vía SDK detrás de flag | `8d613d8`, `82a8d5e` |

**Lección operativa del periodo (confirmada por git):** la documentación del repo corre ~5 días detrás del código. El código superó al diseño en varios frentes. Esto valida el método de auditar contra runtime, no contra docs — y este mismo reporte lo refuerza al validar contra el historial de commits, no contra los manuales.

---

## 7. Lo que NO avanzó en el periodo (verificado: cero commits que lo toquen)

Se confirmó por `git log` que ninguna de estas áreas recibió commits entre el 7 y el 20 de julio:

1. **Timbrado fiscal** — folio UUID simulado desde v1 hasta hoy. Bloqueante externo #1.
2. **Notificaciones externas** — todas las alertas siguen in-app; el worker de BullMQ nunca se desplegó (vive en el frontend muerto / `apps/api`).
3. **Scheduler** — TTL, OT vencidas y recordatorios siguen corriendo on-request dentro de `/api/estado`.
4. **Storage** — todo en base64 en BD; el módulo de Spaces existe sin variables de entorno.
5. **Proof-of-play interpretado** — se publica y se guarda crudo (`3d7e6ee`), pero no se interpreta; bloqueado por api_key/contrato del CMS.
6. **Endurecimiento de permisos/uploads** — los 8 hallazgos y los 6/7 puntos de subida sin validación, levantados formalmente el 20-jul. *(En ejecución como Hardening 1 al momento de este reporte.)*

Ninguna es del flujo de negocio; todas son transversales, y las 4 primeras ya tienen fase asignada.

---

## 8. Conclusión

Del 7 al 20 de julio el sistema pasó de "aprobado para go-live con flujo base" a "ERP con el negocio completo implementado y auditado". El avance no fue en amplitud de features nuevas sino en **profundidad y verdad**: cerrar el módulo de rentas (el más débil) en ~24 h de la auditoría, volver real la publicación digital vía SDK, endurecer el ciclo de propuestas con snapshots e idempotencia, y consolidar los tres portales externos. Validado contra el historial de git, el reporte original de Ana resulta **fiel en lo sustancial**, con dos correcciones de encuadre (Comisiones ya existía; Arrendadores cerró más rápido) y un avance omitido (`d5e683e`). La distancia restante a "producción real" está acotada por la auditoría del 20-jul y coincide con las fases Hardening 1 y 2 ya planeadas, más los dos trámites externos (PAC y api_keys de CMS) cuyo reloj no depende de código.

---

*Reporte original: Ana, 20-jul-2026 (cruce de 3 manuales + 3 auditorías).*
*Validación contra git y correcciones: 20-jul-2026. Rango auditado: `git log --since=2026-07-06 --until=2026-07-21 --all`. Todos los hashes citados son verificables en el repositorio.*

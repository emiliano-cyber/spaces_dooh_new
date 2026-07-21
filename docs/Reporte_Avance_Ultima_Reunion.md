# SPACE OS — Reporte de avance desde nuestra última reunión

**Cómo leer este reporte.** Cada avance descrito está implementado y corriendo en el sistema. El periodo cubre desde nuestra última reunión hasta hoy.

---

## 1. Resumen ejecutivo

Desde nuestra última reunión el sistema pasó de "demo funcional aprobada para go-live" a **plataforma con ~90% de la funcionalidad de negocio implementada y persistente**, con la cadena completa comercial → producción → operación → fiscal → cobranza corriendo contra Postgres.

Los tres saltos más grandes fueron:

1. **Módulo Arrendadores / rentas** — pasó de cuatro pendientes rojos a totalmente cerrado en poco más de un día de detectarlos.
2. **Publicación real a DOOHmain** — pasó de "modo demo" a publicación vía SDK, detrás de flag, con reglas de operación documentadas.
3. **Pipeline de campañas** — incorporó el ciclo digital completo (Enviada al dominio → Publicada) y la separación imprenta / producción.

**Indicador global al cierre:** ~90% funcionalidad de negocio · ~55% listo para producción · 3 bloqueantes externos (timbrado, correo, api_keys del CMS).

---

## 2. Avance por módulo (antes → ahora)

| Módulo | Antes | Ahora |
|---|---|---|
| **Inventario** | Carga masiva Excel, alta manual fija/digital, ficha de sitio | + plantilla descargable, imágenes por lote (`codigo.jpg`), manejo de duplicados (actualizar / nueva versión), precio por m², anti-sobreventa por tipo de medio verificada, 12 slots fijos por pantalla digital |
| **Propuestas** | Divisor, versiones, descuentos, liga pública, aceptación en línea | + snapshot inmutable al aprobar, token no-enumerable, confirmación para $0, aprobación sitio por sitio que congela precios, generar campaña idempotente, entrada por folio, indicador Digital/Fija por sitio |
| **Campañas / pipeline** | Pipeline base, tipo único de flujo | Derivación automática OOH / DOOH / Híbrida, guards server-side en ambos sentidos (409), colisión de fechas (409), TTL de reservas 7 días, cola "Por validar", etapas de publicación, filtro de búsqueda por nombre / folio / cliente |
| **Creativos** | Subir imagen / código, aprobar / rechazar, asignar a slots | + reemplazar con retiro sincronizado de DOOHmain, eliminar con "estado honesto" (Retirado · pendiente en DOOHmain), HTML adaptativo con fondo difuminado, render en `<iframe>`, botón "Ver HTML" con la fuente y descarga |
| **Publicación DOOHmain** | Conector en **modo demo** | **Publicación real vía SDK** (detrás de flag): 1 campaña = 1 sublista con folio, solo creativos validados, extracción de la imagen embebida del HTML, reglas de no-borrado documentadas, manejo del error "lista en edición" |
| **Arrendadores / rentas** | Alta de propietario, contratos, rentabilidad por pantalla | + **calendario de pagos auto-generado (12 periodos)**, editar / renovar / cancelar contrato, adjuntos de pago (factura + comprobante) con validación de tamaño y MIME, PDF del contrato, renta del predio compartida entre pantallas, predio obligatorio y un contrato activo por predio |
| **Operaciones / OT** | OT con checklist y foto | + vista móvil dedicada sin menús, captura de ubicación obligatoria, cierre habilitado solo con checklist + foto + geo, SLA / vencidas con alerta, la evidencia enciende el candado |
| **Finanzas / cobranza** | Candado, factura con IVA, plazos 60/90/120, semáforo | + abonos parciales con saldo, liquidar detiene recordatorios, abono negativo rechazado, recordatorios manuales + automáticos con cadencia, candado server-side verificado. **Timbrado sigue simulado — bloqueante externo #1** |
| **Operación / OC** | Registro básico de OC | OC real con folio, monto, fecha y documento; OT con fecha compromiso y asignación |
| **Network** | Toggle "En Network" | + costo interno oculto entre CRMs, operador dueño visible, anti-duplicados (409), conteo por CMS, reglas tradicional / programático |
| **Portales externos** | Liga de propuesta + portal de seguimiento | **Tres portales**: seguimiento (token, sin precios), carga de creativos (JPG / PNG / PDF / MP4 / MOV hasta 500 MB), portal con login + chat cliente-técnico con fotos; entrada por folio |
| **Seguridad / permisos** | Roles por menú, bcrypt | RBAC real en BD (roles × módulo × acción), RLS fail-closed en 7 tablas, control de cambios con contraseña del Dueño (desbloqueo temporal), rate-limit en login, tokens no-enumerables que cierran el IDOR clásico, política de contraseñas sin defaults débiles |
| **Identidad / branding** | "Spaces", botones naranjas | "SPACE OS by AS Network", sistema de diseño azul, configuración de negocio (IVA, loop digital, plazos, tipos de tarea) y **razón social / nombre comercial por tenant** |

---

## 3. Fundación técnica del periodo (transversal)

Además de las features de negocio, se construyó la base sobre la que se apoya todo lo anterior:

- **Arquitectura por capas** (ruta → controller → model) con manejo de errores tipado y validación de entrada en toda la app.
- **Aislamiento multi-tenant** con RLS fail-closed + FORCE y el tenant fijado en la capa de base de datos.
- **Migraciones del módulo de rentas** (aditivas e idempotentes), sin pasos destructivos.
- **SDK de integración con DOOHmain**, adaptado a Postgres.
- **Tubo de proof of play** — trae y guarda las reproducciones en crudo.

## 4. Reconciliación: pendientes que ya se cerraron

Brechas que la documentación aún listaba como pendientes y que el código ya resolvió:

| Brecha listada como pendiente | Estado actual |
|---|---|
| Calendario de pagos de renta — "no existe" | Auto-generado al crear contrato (12 periodos) |
| Editar / renovar / cancelar contrato — "rojo" | Los tres endpoints existen y funcionan |
| Adjuntos de pago — "sin UI" | UI + ruta dedicada con validación de tamaño y MIME |
| Propuesta → campaña — "corte en el flujo" | Genera campaña + reservas, probado extremo a extremo |
| Guard OOH ↛ creativo — "pendiente" | El servidor rechaza creativo en campaña fija |
| Publicación DOOHmain — "modo demo" | Publicación real vía SDK detrás de flag |

---

## 5. Lo que aún no avanza (pendientes acotados)

Ninguno pertenece al flujo de negocio; todos son transversales y ya tienen fase asignada:

1. **Timbrado fiscal** — el folio sigue simulado. Sin PAC no hay factura legal. Bloqueante externo #1.
2. **Notificaciones externas** — todas las alertas siguen in-app; cero correo / SMS en el shell vivo.
3. **Scheduler** — TTL, OT vencidas y recordatorios siguen corriendo on-request dentro de `/api/estado`.
4. **Storage** — todo sigue en base64 en BD; el módulo de Spaces existe pero sin variables de entorno.
5. **Proof-of-play interpretado** — se publica y se guarda en crudo, pero falta interpretarlo; bloqueado por api_key / contrato del CMS.
6. **Endurecimiento de permisos y uploads** — hallazgos de la auditoría integral, en ejecución como fase de Hardening.

---

## 6. Conclusión

Desde nuestra última reunión el sistema pasó de "aprobado para go-live con flujo base" a "ERP con el negocio completo implementado y auditado". El avance no fue en amplitud de features nuevas sino en **profundidad y solidez**: cerrar el módulo de rentas (el más débil), volver real la publicación digital, endurecer el ciclo de propuestas con snapshots e idempotencia, y consolidar los tres portales externos. La distancia restante a "producción real" está acotada por la auditoría integral y corresponde a las fases de Hardening y de infraestructura (storage, scheduler, correo) ya planeadas, más los dos trámites externos (PAC y api_keys del CMS) cuyo reloj no depende de código.

---
tipo: glosario
estado: verificado
actualizado: 2026-08-07
tags: [dominio, negocio, vocabulario]
archivos:
  - db/schema.sql
  - docs/adr/
  - apps/web/lib/modulos.ts
---

# Glosario del dominio

> El código está **en español** y usa el vocabulario del negocio. Traducir estos
> términos al inglés al escribir código nuevo rompe la coherencia — ver
> [[convenciones]].

## Inventario

| Término | Significado | Dónde vive |
|---|---|---|
| **Sitio** | Una pantalla o espectacular físico. La unidad de inventario. | `sitios` |
| **Predio** | El inmueble donde están las pantallas. N pantallas : 1 predio. | `predios` |
| **Modalidad** | Forma de vender un sitio (mensual, catorcenal, spot, hora…). Una pantalla física puede tener varias. | `sitio_modalidades` |
| **Cara** | Lado del espectacular. Un sitio puede tener varias. | `sitios.caras` |
| **Espectacular** | Valla publicitaria grande, estática. | `tipo_medio` |
| **DOOH** | *Digital Out Of Home* — pantalla digital con spots rotativos. | `tipo_campana` |
| **OOH** | *Out Of Home* — publicidad exterior estática (lona impresa). | `tipo_campana` |
| **Spot** | Cada aparición de un anuncio en una pantalla digital. | `sitios.total_spots` |
| **Cupo de clientes** | Cuántos anunciantes distintos admite una pantalla. Es política comercial, no capacidad técnica (ADR 0008). | `sitios.max_clientes` |
| **Clave interna / código de proveedor** | Identificadores de negocio de la pantalla, únicos. | `sitios.clave_interna`, `codigo_proveedor` |

## Arrendadores y renta

| Término | Significado | Dónde vive |
|---|---|---|
| **Arrendador** | Dueño del inmueble al que se le paga renta. | `arrendadores` |
| **Contrato de arrendamiento** | Acuerdo de renta por un predio/sitio. | `contratos_arrendamiento` |
| **Renta** | Lo que se le paga al arrendador. **Es el único costo de una pantalla** (ADR 0006). | `contratos_arrendamiento.monto_renta` |
| **Contrato incompleto** | Contrato creado al vuelo al generar campaña, al que le faltan datos (ADR 0001). Bloquea reservar (ADR 0003). | `est_contrato` |
| **Razón social** | Entidad fiscal bajo la que el arrendador factura. Un arrendador puede tener varias. | `arrendador_razon_social` |
| **Periodicidad** | Cadencia del pago: semanal → anual, más DIARIA (ADR 0004). | `periodicidad_pago` |
| **Licencia** | Permiso legal del sitio (uso de suelo, anuncio). | `licencias` |

## Comercial

| Término | Significado | Dónde vive |
|---|---|---|
| **Propuesta** | Cotización al cliente, con folio y liga pública compartible. | `propuestas` |
| **Método del divisor** | Cálculo bruto↔neto: el neto sale de dividir el bruto entre (1 − comisión). | `propuestas.comision_pct` |
| **Comisión de agencia** | Porcentaje que se lleva la agencia. Es un **divisor**, no un descuento. | `propuestas.comision_pct` |
| **Descuento comercial** | Rebaja sobre la tarifa de lista. **Distinto** de la comisión. | `propuestas.descuento_pct` |
| **Campaña** | La venta ejecutada. Puede nacer de una propuesta aprobada o a mano. | `campanas` |
| **Reserva** | Ocupación de un sitio por una campaña en un rango de fechas. | `reservas` |
| **Tentativa** | Reserva que caduca sola por TTL si no se confirma. | `est_reserva`, `reservas.expira_en` |
| **ODC / OC** | Orden de compra del cliente. Requisito del candado de facturación. | `ordenes_compra` |
| **Creatividad / creativo** | El arte que se exhibe. Puede ser imagen o código HTML. | `creatividades` |
| **Portal** | Página pública, por token, donde el cliente sigue su campaña. | `campanas.portal_token` |

## Operaciones

| Término | Significado | Dónde vive |
|---|---|---|
| **OT** | Orden de trabajo: tarea de campo (montaje, desmontaje, mantenimiento). | `ordenes_trabajo` |
| **Evidencia** | Foto con GPS y fecha que prueba que la OT se hizo. Destraba la facturación. | `evidencias_ot` |
| **Orden de impresión** | Trabajo de imprenta para producir la lona. | `ordenes_impresion` |
| **Prueba de color** | Muestra que el cliente aprueba antes de imprimir. | `ordenes_impresion.prueba_color_url` |
| **Playlog** | Registro de reproducciones reales de un spot en pantalla. | `doohmain_consultas_play` |

## Finanzas

| Término | Significado | Dónde vive |
|---|---|---|
| **Candado de facturación** | Condiciones que deben cumplirse antes de poder facturar: OC recibida, fotos comprobatorias y reporte de publicación. | `campanas.oc_recibida`… |
| **Cobranza** | Seguimiento del cobro de una factura, con plazo y vencimiento. | `cobranzas` |
| **Parcialidades** | Cobro en cuotas que deben sumar exacto al total. | `20260728_cobro_parcialidades.sql` |
| **CFDI / folio fiscal** | Comprobante fiscal mexicano (simulado). | `facturas.folio_fiscal` |

## Plataforma

| Término | Significado | Dónde vive |
|---|---|---|
| **Tenant / organización / CRM** | Cada empresa cliente. Tres nombres para lo mismo. | `tenants` |
| **Tenant de plataforma** | El tenant más antiguo. Solo su Dueño puede cambiar de CRM. | `lib/server/tenant.ts:26-29` |
| **Desbloqueo** | Reautenticación con la contraseña propia que abre 15 min para cambios sensibles (ADR 0009). | `sesiones.desbloqueo_expira_en` |
| **Cambio sensible** | Operación sobre dinero o catálogo que exige desbloqueo. | `lib/server/cambios.ts` |
| **Contraseña temporal** | La que entrega un administrador al restablecer. Fuerza cambio al entrar. | `usuarios.debe_cambiar_password` |
| **Rol** | `DUENO`, `COMERCIAL`, `OPERACIONES`, `IMPRENTA`, `FINANZAS` (+`CLIENTE`, retirado por ADR 0010). | `rol_demo` |
| **Módulo / acción** | Unidad de permiso: `ver`, `crear`, `aprobar`, `facturar`. | `rol_permisos` |

## Relacionadas
[[esquema]] · [[decisiones]] · [[comercial-propuestas-campanas]] ·
[[finanzas-y-cobranza]] · [[MOC-Proyecto]]

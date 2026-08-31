---
tipo: glosario
estado: verificado
actualizado: 2026-08-31
tags: [dominio, negocio, vocabulario, flota]
archivos:
  - db/schema.sql
  - docs/adr/
  - apps/web/lib/modulos.ts
  - infra/env/instancia.env.example
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
| **Tenant de plataforma** | El tenant más antiguo (`rgb`). Solo su Dueño puede cambiar de CRM. Está **vacío**. | `lib/server/tenant.ts:27-30` |
| **`g500`** | La organización con datos de negocio. Nombre comercial `PIXELED`. | — |
| **`eyro`** | **Perfil de PRUEBAS del usuario.** Lo que aparezca ahí no es deuda operativa — pero sí publica de verdad en DOOHmain. Ver [[multi-tenancy-y-rls]]. | — |
| **Desbloqueo** | Reautenticación con la contraseña propia que abre 15 min para cambios sensibles (ADR 0009). | `sesiones.desbloqueo_expira_en` |
| **Cambio sensible** | Operación sobre dinero o catálogo que exige desbloqueo. | `lib/server/cambios.ts` |
| **Contraseña temporal** | La que entrega un administrador al restablecer. Fuerza cambio al entrar. | `usuarios.debe_cambiar_password` |
| **Rol** | `DUENO`, `COMERCIAL`, `OPERACIONES`, `IMPRENTA`, `FINANZAS` (+`CLIENTE`, retirado por ADR 0010). | `rol_demo` |
| **Módulo / acción** | Unidad de permiso: `ver`, `crear`, `aprobar`, `facturar`. | `rol_permisos` |
| **Método de sesión** | Cómo se abrió la sesión: `password` o `google`. Existe porque quien entró con Google **no tiene contraseña que reautenticar**. | `sesiones.metodo` (`20260825_sesion_metodo.sql:39-40`) |

## Flota e instancias

Vocabulario del modelo aprobado el 2026-08-12. Antes de esta fecha «tenant» y
«cliente» bastaban; hoy no. Ver [[modelo-instancias-soberanas]].

| Término | Significado | Dónde vive |
|---|---|---|
| **Instancia** | Una copia completa de SPACE OS con su droplet, su base y su dominio. La unidad que se le entrega a un owner. | `infra/scripts/provision-instancia.sh` |
| **Owner** | La empresa dueña de una instancia. **No es lo mismo que un tenant**: hoy un owner es un tenant dentro de su propia instancia. | — |
| **PADRE** | El plano de control: donde se trabaja el código y desde donde se publica. `space-os.io`, droplet `137.184.107.53`. | `infra/systemd/spaces-web.service` |
| **DEMO** | El banco de pruebas donde se ensaya una versión antes de soltarla a la flota. Corre en el 3001 **dentro del PADRE**, y desde el 31/08 se llama `pruebas.space-os.io`. | `infra/systemd/spaces-demo.service` |
| **Canal** | `beta` o `estable`. DEMO sigue `beta`; **una instancia de owner sigue siempre `estable`**. Un owner en `beta` es un owner haciendo de conejillo. | `infra/env/instancia.env.example:30-35` |
| **Registry** | El almacén de la aplicación ya empaquetada, para que cada servidor la **instale** en vez de construirla. | Pendiente de nombre (decisión P4) |
| **Actualizador** | `update.sh` en cada instancia: jala la imagen del canal, aplica migraciones y reinicia. | `infra/scripts/update.sh` |

> [!warning] «Tenant» ya no significa «cliente»
> En el modelo viejo un cliente **era** un tenant dentro de una base compartida,
> y la RLS era el modelo de negocio. Hoy cada owner tiene su instancia, y la RLS
> **se queda como defensa en profundidad dentro de cada una**. Leer una nota
> anterior al 12/08 con el significado nuevo lleva a conclusiones falsas.

## Relacionadas
[[esquema]] · [[decisiones]] · [[comercial-propuestas-campanas]] ·
[[finanzas-y-cobranza]] · [[MOC-Proyecto]]

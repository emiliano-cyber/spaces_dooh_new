# ADR 0046: Cada pago de un cliente con su fecha, y Finanzas por periodo

- **Fecha:** 2026-10-06
- **Estado:** Propuesta. La forma de la tabla espera el visto bueno del dueño antes de
  fusionar (las decisiones de producto ya las tomó: abonos con fecha, estado de cuenta de la
  empresa y por cliente, y los periodos mes / mes pasado / trimestre / año / rango).
- **Relacionado:** [ADR 0036](0036-contrasena-compartida-de-vuelta-para-el-control-de-cambios.md) (los pagos son cambio
  sensible).

> Numeración: la 0044 (invitación de usuarios) y la 0045 (Space Eye, renumerada desde la 0041)
> están en ramas sin fusionar el 06/10. Esta toma la siguiente libre para no chocar con ninguna.

## Contexto

El 06/10 el dueño pidió tres cosas para Finanzas:

1. que no diga «vencida» en una cuota que ya está pagada;
2. un estado de cuenta de este mes y del mes pasado;
3. un tablero con temporalidad —facturas vencidas, trimestre—.

La 1 era un defecto de pantalla (la columna «Vence» miraba solo la fecha) y se arregló sin
decisión. La 2 y la 3 chocaban con un hueco de datos: **`cobranzas.monto_pagado` era un
acumulado**. Cada pago le sumaba su importe y la fecha se perdía, así que el sistema sabía
cuánto se había cobrado, pero no cuándo. Sin eso no hay «cobrado en septiembre».

## Decisión

1. **Tabla `cobranza_abonos`** (migración `20261008_cobranza_abonos.sql`): un renglón por pago
   con importe, **día en que se recibió**, quién lo registró y su origen. Con RLS forzada como
   el resto, FK compuesta a `cobranzas (id, tenant_id)` y `cascade` igual que
   `cobranzas → facturas`.
2. **`monto_pagado` se queda.** Lo leen la pantalla, el barrido de recordatorios y el cálculo
   del saldo. El invariante `monto_pagado = sum(abonos)` lo mantiene `registrarPagoCobranza`
   escribiendo las dos en **una transacción con la cobranza bloqueada**; una prueba e2e y la
   consulta final de la migración lo comprueban.
3. **El pago admite una fecha** (la de la transferencia de ayer), por omisión hoy en la zona de
   la base, y nunca futura.
4. **Lo cobrado antes de la migración se rescata, aproximado y marcado:** un renglón por
   cobranza con `origen = 'historico'`, fechado con el último «Registró pago/abono» de la
   bitácora para ese folio. Sin rastro → fecha `NULL` en la base (no se inventa), y el cálculo
   por periodo lo **fecha con su factura** y lo marca *aproximado*; la pantalla dice cuánto de lo
   cobrado lleva fecha aproximada.

   > Primero se trató como «pagado antes de cualquier periodo». Sembrando ejemplos el 06/10 salió
   > el fallo: el año 2026 arrancaba con saldo **−4 640**, porque se descontaba un pago de una
   > factura de junio antes de que la factura existiera. Fecharlo con su factura es lo más
   > pronto en que pudo pagarse, y mantiene `inicial + facturado − cobrado = final`.
5. **Las cuentas son puras** (`lib/finanzas-periodo.ts`) y las sirve
   `GET /api/finanzas/resumen` con `finanzas.ver`. Definiciones:
   - facturado = facturas no anuladas emitidas en el periodo;
   - cobrado = abonos con fecha en el periodo;
   - saldo final = inicial + facturado − cobrado (el final de un mes es el inicial del siguiente);
   - vencido = lo que se debía de cuotas ya vencidas **a la fecha de corte**: fin del periodo,
     o hoy si no ha terminado;
   - renta pagada por fecha de pago, por pagar por periodo (solo en la vista de la empresa).

## Lo que apareció al hacerlo

- **El doble clic cobraba dos veces.** Dos pagos simultáneos leían el mismo `monto_pagado` y
  sumaban los dos. El `for update` lo cierra; hay prueba e2e.
- **Pagar una cuota ya pagada** registraba un «pago de $0 (liquidado)» en la bitácora. Ahora es
  un 409.
- **La lista de Facturas** enseñaba la fecha cruda (`2026-10-01T06:00:00.000Z`). Visto en el
  navegador; ahora va formateada.

## Implicaciones de seguridad

- La tabla nace con RLS forzada y la prueba e2e confirma que el rol de la app no ve nada sin
  organización.
- `usuario_id` sale de la sesión, nunca del cuerpo.
- El estado de cuenta de un cliente de otra organización es un 404, no una hoja en ceros.
- El CSV neutraliza los valores que Excel tomaría por fórmula (`= + - @`), como los demás
  exportes.
- El pago sigue siendo cambio sensible (permiso + desbloqueo); el resumen es solo lectura.

## Lo que no hace

- No reparte lo histórico en sus abonos reales: la bitácora guarda el importe redondeado y por
  folio, no por cuota.
- No toca `pagos_renta`, que ya tenía `fecha_pago`.
- No es contabilidad: no hay pólizas ni conciliación bancaria. Es el seguimiento de cobranza.

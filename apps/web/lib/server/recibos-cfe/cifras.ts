import { z } from 'zod'

// ============================================================================
//  lib/server/recibos-cfe/cifras.ts — La regla de las cifras de un recibo de
//  luz, en un solo sitio. PURA: solo zod.
// ----------------------------------------------------------------------------
//  **Ni los kWh ni el importe pueden guardarse en cero ni en negativo.** Lo
//  decidio el dueño el 2026-09-29, endureciendo la regla anterior —que solo
//  exigia «lo ilegible va vacio»—.
//
//  El motivo es el de siempre en este modulo, y es el que hay que releer antes
//  de aflojarla: **un cero no dice «no se», dice «no consumio luz»**. Dentro
//  del reporte de rentabilidad esos dos hechos son exactamente el mismo numero,
//  y una vez guardado no hay forma de distinguirlos: el margen sale mejor de lo
//  que es y nada da error. Un negativo es peor todavia — RESTA costo.
//
//  ─── POR QUE VIVE AQUI Y NO DENTRO DEL CONTROLLER ────────────────────────
//  Porque el controller importa el repo, el repo importa `tenant.ts` y ese usa
//  `cache()` de React, que no existe fuera de un Server Component: una prueba
//  que importe el controller muere al cargarlo y la regla se queda sin arnes.
//  Aqui la regla se prueba sola, y `energia-controller.ts` la usa.
//
//  ─── Y POR QUE NO BASTA CON LA PANTALLA ─────────────────────────────────
//  La propuesta que sale del lector de PDF **se puede editar antes de
//  confirmarla**, y `POST /api/energia/consumos` se puede llamar directamente.
//  La pantalla es comodidad; esto es la puerta.
//
//  La base sigue admitiendo el cero (`consumo_energia_cifras_ck`, `kwh >= 0`):
//  apretarla pide una migracion, y una migracion es una decision del dueño.
//  Mientras tanto la aplicacion es la que corta.
// ============================================================================

/**
 * Una cifra de recibo: numero finito y **estrictamente mayor que cero**.
 *
 * Se acepta como numero o como texto porque el formulario manda lo que hay en
 * un `<input>`, y un `z.number()` a secas rechazaria `"3000"` con un mensaje
 * que habla de tipos y no de recibos.
 */
export const cifraDeRecibo = (mensaje: string) =>
  z.coerce
    .number({ invalid_type_error: mensaje })
    .finite(mensaje)
    // `.gt(0)` y no `.min(0)`: el cero es justo el valor que hay que cortar.
    .gt(0, 'Tiene que ser mayor que cero: un cero se lee como «no consumio luz»')

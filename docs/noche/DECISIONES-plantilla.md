# Decisiones pendientes — noche del <AAAA-MM-DD>

**Cómo se contesta:** escribe una palabra o una letra en cada `TU RESPUESTA` y lanza
`/noche continuar`. Lo que dejes sin contestar se queda aparcado; nadie lo adivina.

**Orden:** por cuánto desbloquea. La primera es la que más trabajo libera.

**Total:** <N> decisiones · <M> tareas aparcadas esperándolas

---

## Plantilla de entrada

```
### D<n> · <la pregunta, en una línea, respondible con una palabra>
Bloquea:      <FX.Y, FX.Z> y en cascada <lo que a su vez dependía de ellas>
Dónde muerde: <archivo:línea, o el paso exacto del script>
Referencia:   <§8.1 del documento del 12 | P1 del v3 | nueva, salió esta noche>

Opción A — <nombre corto>
  Qué implica:           <consecuencia técnica concreta, no abstracta>
  Qué cuesta:            <trabajo, dinero o riesgo, con número si lo hay>
  Qué se hace mañana:    <la tarea exacta que se desbloquea, con su comando>

Opción B — <nombre corto>
  Qué implica:           …
  Qué cuesta:            …
  Qué se hace mañana:    …

Lo que el repo ya dice: <precedente real con referencia de archivo:línea; o «nada»>
Lo que NO cambia:       <para que una decisión pequeña se vea pequeña>

TU RESPUESTA: ____
```

---

## Dos ejemplos, para calibrar el nivel de detalle esperado

Estos dos son reales: salen de §8 del documento del 12 y de la §4.4 del v3. Sirven de vara de medir.
Una entrada más vaga que estas no está terminada.

### D0-ejemplo · ¿Las instancias nacen en la cuenta DO de AS OOH o en la del owner?

```
Bloquea:      F5.4 (el modo por defecto) y en cascada el runbook de operación completo
Dónde muerde: infra/scripts/provision-instancia.sh, paso 1 — los dos modos están escritos
              (--crear-droplet y --host), ninguno es el predeterminado
Referencia:   §8.3 del documento del 12 · P3 del v3

Opción A — cuenta de AS OOH
  Qué implica:        --crear-droplet es el camino; el padre guarda las llaves de cada droplet
  Qué cuesta:         ≈ $15/mes por instancia en la factura de AS OOH, no del owner
  Qué se hace mañana: se fija el modo por defecto y se escribe un runbook, no dos

Opción B — cuenta del owner
  Qué implica:        --host es el camino; hay que escribir qué se le pide exactamente al owner:
                      versión de Ubuntu, accesos, quién renueva el certificado, quién mira el
                      log de update.sh
  Qué cuesta:         un runbook más largo y un onboarding con más pasos para Comercial
  Qué se hace mañana: el runbook del caso --host, que hoy no existe

Opción C — caso por caso
  Qué implica:        se documentan los dos modos y Comercial pregunta en el onboarding,
                      junto al dominio
  Qué cuesta:         mantener dos caminos vivos
  Qué se hace mañana: los dos runbooks

Lo que el repo ya dice: nada. setup-droplet.sh es agnóstico en su parte genérica (:25-72)
Lo que NO cambia:       el script ya soporta los tres escenarios. Esto elige el predeterminado
                        y el runbook, no rescribe código

TU RESPUESTA: ____
```

### D1-ejemplo · ¿El tenant `rgb` se queda con instancia propia, o se retira?

```
Bloquea:      F7.2, F7.3 y el cierre completo de la Fase 4. Si `rgb` se retira, el droplet
              viejo se apaga; si se queda, necesita instancia y dominio propios
Dónde muerde: apps/web/lib/server/tenant.ts:26-30 (`tenantPlataforma`), y el aprovisionamiento
              de la Fase 5 si hay que añadir una instancia más
Referencia:   §8.1 del documento del 12 · P1 del v3 (§4.4)

Opción A — RGB Catorce tiene su instancia
  Qué implica:        se añade a la Fase 5 un aprovisionamiento más
  Qué cuesta:         ~$15/mes de droplet, y un dominio que Comercial tiene que pedir
  Qué se hace mañana: entra en la cola de aprovisionamiento como un owner más

Opción B — se retira
  Qué implica:        la Fase 7 se simplifica a exportar `g500` y apagar el droplet viejo
  Qué cuesta:         hay que decidir QUÉ PASA CON EL SUPER-ADMIN, y esto es lo difícil:
                      el tenant de plataforma es el MÁS ANTIGUO (`select id from tenants
                      order by creado_en asc limit 1`, tenant.ts:26-30), y de él cuelga hoy
                      la capacidad de administrar a los demás. Si `rgb` es ese tenant y se
                      retira, el super-admin pasa al siguiente más antiguo POR ACCIDENTE —
                      no por decisión de nadie
  Qué se hace mañana: exportar `g500`, y antes fijar a quién pertenece el super-admin

Lo que el repo ya dice: `tenantPlataforma` NO tiene ninguna marca explícita — la plataforma es
                        una consecuencia de la antigüedad, no una propiedad declarada
Lo que NO cambia:       en ninguna de las dos, la RLS sigue siendo el aislamiento dentro de
                        cada instancia

TU RESPUESTA: ____
```

> **P4-bis ya no se plantea: quedó resuelta hacia la salida (b)** —el autoregistro se decide al
> arrancar, una sola imagen por versión— cuando la bandera salió del build el 2026-08-14. Si un
> agente la escribe como decisión abierta, es un hallazgo de puerta.

---

## Decisiones de esta noche

<!-- a partir de aquí escriben los agentes. Si no hay ninguna, la línea de abajo lo dice -->

_Ninguna. Las <N> tareas previstas se completaron._

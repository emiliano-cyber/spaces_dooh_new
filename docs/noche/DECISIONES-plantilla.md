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
Referencia:   <§8.3 del documento del 12 | P4-bis del v3 | nueva, salió esta noche>

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

### D0-bis-ejemplo · ¿DEMO lleva imagen propia, o el autoregistro sale del build?

```
Bloquea:      F2.6 (escrita en la rama feat/autoregistro-en-arranque, sin fusionar) y la forma
              final de F2.3 (una imagen por versión o dos)
Dónde muerde: apps/web/app/api/signup/route.ts:18, login/page.tsx:30, google-oauth.ts:90
Referencia:   P4-bis del v3 · es la contradicción entre el invariante 3 y el 9

Opción A — dos imágenes por versión
  Qué implica:        una con la bandera encendida para el canal beta, otra para los owners
  Qué cuesta:         el doble de almacenamiento en el registry y dos artefactos que validar
  Qué se hace mañana: se borra la rama feat/autoregistro-en-arranque y F2.3 publica dos

Opción B — el autoregistro se decide al arrancar
  Qué implica:        una sola imagen sirve a DEMO y a los owners; la bandera sale de
                      NEXT_PUBLIC_ y se lee del .env, con fail-closed (sin variable → apagado)
  Qué cuesta:         cambia el comportamiento de una bandera de seguridad, y el bloque
                      aislamiento.e2e.test.ts:200-213 queda obsoleto (se retira en un release
                      posterior, expand → contract, no ahora)
  Qué se hace mañana: se fusiona la rama, ya escrita y en verde

Lo que el repo ya dice: GOOGLE_OAUTH ya hace exactamente esto — se decide en el servidor, no en
                        el build — por la decisión 5 de la ADR 0012 (.env.example:38-46)
Lo que NO cambia:       en ninguna de las dos, el autoregistro sigue encendido solo en DEMO

TU RESPUESTA: ____
```

---

## Decisiones de esta noche

<!-- a partir de aquí escriben los agentes. Si no hay ninguna, la línea de abajo lo dice -->

_Ninguna. Las <N> tareas previstas se completaron._

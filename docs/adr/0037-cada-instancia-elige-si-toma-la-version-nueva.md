# ADR 0037: Cada instancia elige si toma la versión nueva

- **Fecha:** 2026-09-21
- **Estado:** Aceptada

Decisión del dueño del producto, pedida en sesión: **el dueño de cada instancia
decide, desde su propia aplicación, si instala la versión nueva cuando se publica
una.** Hoy no puede: el canal manda y la actualización es forzosa.

## Contexto

### Cómo se actualiza una instancia hoy

`infra/scripts/update.sh` lo lanza el cron de la propia instancia. Lee
`/etc/space-os/instancia.env`, jala `$REGISTRY/$IMAGEN_NOMBRE:$CANAL`, compara el
digest con el que corre, y si cambió: respalda, migra, conmuta, comprueba salud y
vuelve atrás si hace falta. Tiene siete códigos de salida distintos según dónde
falló, y esa distinción es deliberada.

Su cabecera lo dice mejor que ningún resumen: *«El PADRE no aparece por ningún
lado: este script habla con el registry de imágenes y con su propia base, y con
nadie más.»* Esa propiedad es un activo y este ADR no la toca.

**El contrato de hoy es "el canal manda".** `CANAL=estable|beta` en
`instancia.env`, y una instancia de owner sigue siempre `estable` — `beta` es el
banco de pruebas interno, por el invariante 13. Si la etiqueta del canal se mueve,
la instancia se actualiza en la siguiente corrida. **No hay forma de decir que no**
que no sea entrar al droplet.

### El dato que cambió el diseño a mitad de camino

El cron **corre una vez al día, a las 04:17** — `infra/scripts/instalar-hijo.sh:867`
y `infra/scripts/provision-instancia.sh:834`, la misma línea en los dos:

```
17 4 * * * root /opt/space-os/update.sh >> /var/log/space-os/cron.log 2>&1
```

Con una sola corrida diaria, poner la decisión en manos del dueño daría esto:
publicas hoy, el actualizador lo detecta mañana a las 04:17, el dueño lo ve por la
mañana y aprueba, y se instala pasado mañana a las 04:17. **Hasta dos días**, y un
botón que dijera «instalar ahora» estaría mintiendo.

La causa es que una sola corrida hace **dos trabajos con costes muy distintos**:
*comprobar* (mira el registry, no toca nada) y *actualizar* (corta el servicio,
migra, puede volver atrás). Que actualizar sea de madrugada tiene todo el sentido.
Que comprobar también lo sea, ninguno.

### Dónde NO va esta preferencia

`config_negocio` es **una fila por tenant** desde el ADR 0011
(`db/schema.sql:643-667`). La preferencia de actualización no es de una
organización dentro de la instancia: es **del droplet**. Guardarla ahí obligaría a
preguntar «¿la de qué tenant manda?», que es una pregunta sin respuesta buena.

## Decisión

**La base de la instancia es el buzón entre la aplicación y el actualizador.**

El actualizador escribe *qué hay disponible*; la aplicación escribe *qué quiere el
dueño*; cada uno lee lo del otro en su siguiente corrida. Ninguna vía de red nueva,
ninguna credencial nueva, y el PADRE sigue sin aparecer. El actualizador ya tiene
`DATABASE_URL` privilegiada — la que migra y respalda — así que no hace falta
darle nada que no tuviera.

### Las cuatro piezas

**1 · Una tabla de instancia, de una sola fila.** Sin `tenant_id` y sin RLS, como
`schema_migrations`, porque describe el droplet y no una organización. Dos
escritores con papeles separados por permisos de base: el actualizador (rol
privilegiado) escribe las columnas de *disponible*; la aplicación (rol
`spaces_app`, sin DDL y sujeta a RLS) escribe las de *preferencia y aprobación*.

**2 · La aprobación se ata al DIGEST, no al nombre de la versión.** Es la pieza
que impide el fallo silencioso de todo este diseño: si el dueño aprueba lo que vio
y entretanto la etiqueta del canal se mueve, aprobar «v0.4.2» instalaría **algo que
nunca miró**. Atada al digest, una aprobación caducada no vale — el actualizador la
ignora y la pantalla dice que hay otra más nueva. El caso negativo que lo sujeta:
*una aprobación para un digest que ya no es el disponible no actualiza.*

**3 · Comprobar se separa de actualizar.** Una entrada de cron nueva y frecuente
—cada 15 minutos— corre `update.sh --comprobar`: mira el registry, anota lo
disponible y **aplica solo si hay una aprobación esperando que cuadre**. La de las
04:17 se queda como está: es la del modo automático, y además la red de
seguridad si una aprobación no llegó a aplicarse. Así el dueño ve la versión nueva
el mismo día y «instalar ahora» significa un cuarto de hora.

**4 · Por omisión, esperar aprobación.** Una instancia nueva nace en
`aprobacion`, no en `automatica`.

### El recorrido completo

1. cron frecuente → `update.sh --comprobar` anota versión y digest disponibles, y
   cuántas migraciones traería.
2. La pantalla de Administración lo enseña: instalada, disponible, desde cuándo.
3. El dueño fija su preferencia, o pulsa *instalar*: la aplicación escribe el
   digest aprobado.
4. La corrida que toque decide, y **cada una decide cosas distintas**:
   - **`--comprobar` (cada 15 min)** actualiza **solo** si hay una aprobación cuyo
     digest coincide con el disponible. Con `modo = automatica` **no hace nada**:
     no es su trabajo meter un corte de servicio a media mañana.
   - **La de las 04:17 (sin bandera)** actualiza si `modo = automatica`, o si hay
     una aprobación que cuadre y el cron frecuente no llegó a aplicarla.
   - En los dos casos, al actualizar se **limpia la aprobación**. Y si no hay nada
     que hacer, se registra en el log y se sale con 0: esperar no es un error.

   Esa separación es la que sostiene la promesa de que **los cortes automáticos son
   de madrugada**. Un dueño que pulsa *instalar* está pidiendo el corte a esa hora
   a propósito; el modo automático no se lo pide nadie.

#### Dos casos que NO son espera, y salen con error a propósito

*Añadido el 2026-09-22, al implementarlo.* «Esperar no es un error» vale mientras
**haya algo que esperar**. Hay dos situaciones en las que el actualizador no está
esperando nada, y saldar ninguna de las dos con un `0` sería esconderla — con un
cron cada quince minutos, **96 veces al día**:

- **La imagen no trae `RepoDigest`.** Sin digest disponible la aplicación no tiene
  qué enseñar y la aprobación no se puede escribir, porque va atada al digest (§2
  de *Las cuatro piezas*). **El dueño no puede aprobar aunque quiera**: no es una
  espera, es un bloqueo sin salida. Y tampoco se actualiza «como antes de este
  ADR»: el modo por omisión es `aprobacion`, así que hacerlo sería saltarse al
  dueño por un campo que falta, justo la puerta que este ADR cierra.
- **La tabla no se puede LEER.** Distinto de que no exista: que no exista es un
  hecho medido y sigue saliendo con 0 (una instancia con una imagen anterior a la
  migración se actualiza como siempre). Que no se pueda leer es no saber nada, y
  el cron frecuente es el único proceso que lo sabría cada cuarto de hora.

Los dos usan el código que este actualizador ya tenía para «no se pudo ni
empezar», que es el mismo con el que aborta cuando no puede leer la huella de la
base. **El coste está aceptado**: hasta 96 salidas con error al día mientras el
problema dure. Es preferible a 96 corridas en verde con la base muerta.

> [!warning] El coste se aceptó llamándolo «96 correos al día», y ese canal no existe
> *Corregido el 2026-09-22, en la revisión final de la rama.* **Cron manda
> correo por la SALIDA, no por el código de salida**, y las dos entradas de
> `/etc/cron.d/space-os-update` redirigen stdout **y** stderr a `cron.log`
> (`>> … 2>&1`); el archivo tampoco define `MAILTO`. Sin salida no hay correo,
> para ningún código: **no llegaría ni uno.**
>
> **El comportamiento sigue siendo el correcto y el aviso sí llega** — por otra
> vía: `reportar_a_flota` con `FLOTA_CODIGO` (`infra/scripts/update.sh:780-798`)
> corre en **cada** `salir()` y entrega el código al PADRE, así que estos dos
> casos se ven **en el panel de flota**, 96 veces al día, no en un buzón.
>
> Se deja escrito en vez de reescribir la frase y ya, porque **el dueño aceptó
> el coste describiéndolo como correos**: es una decisión suya y tiene que
> poder revisarse sabiendo cuál es el canal de verdad. Si lo que quería era un
> correo, hoy no lo hay y hace falta `MAILTO` (y quitar la redirección), que es
> una decisión aparte y no se toma aquí.

### Qué se prueba, y dónde

La decisión **no se escribe en bash**. Es una función pura
—`decidirActualizacion({ modo, digestDisponible, aprobadoDigest })`— en TypeScript,
con sus pruebas, porque lo que se escribe dentro de un `.sh` no lo prueba nadie con
el detalle que esto necesita. `update.sh` la consulta contra la base y obedece.
Aparte: pruebas de permiso del endpoint, y casos nuevos en
`infra/scripts/pruebas-update.sh`, que ya existe.

## Alternativas consideradas

### A. La aplicación dispara el actualizador directamente

Inmediato, sin esperar a ningún cron. **Rechazada por seguridad:** exigiría que un
contenedor ejecutara algo en su anfitrión. Eso convierte cualquier fallo de la
aplicación en acceso al droplet — una escalada de privilegios construida a
propósito, y en la dirección exactamente contraria a la que este proyecto ha ido
endureciendo.

### B. El PADRE orquesta qué recibe cada instancia

Etiquetas por instancia en el registry, o una versión fijada que el PADRE escribe.
Mantiene un solo responsable de qué corre cada cliente. **Rechazada por dos
motivos:** contradice la propiedad de `update.sh` de no hablar con el PADRE —
añadiría dependencia de red y superficie de autenticación nuevas — y sobre todo
**no es lo que se pidió**: el hijo no elegiría, obedecería.

### C. Dejar el cron diario y decirlo en la pantalla

Cero cambios de infraestructura; el botón diría «instalar en la próxima
madrugada». Honesto y barato. **Rechazada** porque deja un parche urgente a hasta
dos días de distancia aunque el dueño lo apruebe al minuto, y porque el dueño no se
entera de que existe una versión nueva hasta la madrugada siguiente a publicarla.

### D. Correr la misma corrida cada 15 minutos, comprobando y actualizando

Lo más simple de explicar. **Rechazada:** mete una actualización —con su corte de
servicio y su migración— a cualquier hora del día laboral, y se pierde la garantía
de que los cortes son de madrugada.

## Consecuencias

### Lo que hay que hacer a mano, y si no se hace duele

**Las instancias que YA existen se congelarán en silencio EL DÍA QUE reciban el
`update.sh` NUEVO** — no el día que reciban la migración. Hoy (2026-09-22) no
ha pasado: DEMO y g500 corren sin la tabla y con el `update.sh` de `main`, así
que se actualizan como siempre.

> [!important] La urgencia estaba atada al vehículo equivocado
> *Corregido el 2026-09-22, en la revisión final de la rama.* Hasta hoy este
> párrafo decía que el riesgo empieza cuando llegue
> `20260921_actualizaciones_instancia.sql`. **Es falso, y por una razón que se
> ve en cuanto se separan los dos vehículos:**
>
> - La **migración** viaja **dentro de la imagen** y llega sola, en la primera
>   actualización que tome la instancia. Pero la migración por sí sola **no
>   congela nada**: crea la tabla y se acabó. El `update.sh` viejo —el que hoy
>   corre en DEMO y g500— **ni siquiera la lee**. Para él la tabla no existe.
> - El **`update.sh`** vive en el **ANFITRIÓN** (`/opt/space-os/update.sh`) y
>   **nada lo actualiza solo**: solo lo escriben `instalar-hijo.sh` y
>   `provision-instancia.sh`, es decir en instalaciones nuevas y
>   aprovisionamientos. `update.sh` actualiza el contenedor, **no a sí mismo**.
>
> Así que el congelamiento empieza el día que alguien **copie a mano el
> `update.sh` nuevo** a una instancia existente. Es una consecuencia buena de
> un hecho malo, y el hecho malo es el de la §siguiente: sin esa copia, el ADR
> **no tiene ningún efecto** en las instancias que ya existen, y la línea de
> cron `--comprobar` que la tarjeta manda poner le daría `exit 1` al
> `update.sh` viejo —cuyo `case` rechaza lo desconocido— **cada 15 minutos,
> para siempre**.

La tabla nace con `aprobacion` por omisión y la migración no puede distinguir
una instalación nueva de una que lleva meses corriendo, así que en cuanto
conviven la tabla **y** el `update.sh` nuevo, DEMO y g500 dejarían de
actualizarse sin que nada diera error. **Va en la tarjeta humana del
despliegue**, y el orden manda: **primero copiar `update.sh` (paso 0), después
fijar el modo a conciencia en cada instancia existente (paso 1), y solo
entonces el cron (paso 3).**

### Lo que este ADR deja deliberadamente sin resolver

**No hay vía de escape para un parche de seguridad.** Si un dueño elige esperar y
no atiende, no hay forma de forzar una corrección sin entrar a su droplet. Se deja
**el hueco preparado y sin usar** —una columna `obligatoria` que hoy nadie
escribe—, porque añadirla ahora cuesta nada y retrofitearla después es caro. La
decisión de si una versión puede ser obligatoria, y quién lo decide, es de negocio
y **no se toma aquí**.

### Lo que cambia para siempre

- **Habrá varias versiones corriendo a la vez en la flota.** Hoy no las hay por
  construcción. A partir de aquí, cualquier corrección tiene que poder convivir con
  instancias atrasadas, y el panel de flota (F6.2) enseñará instancias
  desactualizadas **a propósito** — hay que poder distinguir eso de un fallo.
- **Una migración puede quedarse esperando semanas.** La cadena se aplica entera
  cuando por fin se actualiza, que es lo que `migrar.mjs` ya hace, pero el salto
  será mayor y el respaldo previo más importante que nunca.
- **`instancia.env` no cambia.** `CANAL` sigue significando lo mismo y el
  invariante 13 sigue en pie: `beta` no es una preferencia del dueño, es el banco
  de pruebas. Un dueño elige *cuándo* toma lo que hay en su canal, no *qué canal*
  sigue.

## Cómo revertir

Poner la tabla en `automatica` para todas las instancias devuelve exactamente el
comportamiento de hoy, sin tocar código: el actualizador vuelve a actualizar en
cuanto ve un digest distinto. La entrada de cron frecuente puede quedarse —
comprobar no hace daño— o retirarse con la línea que la puso. La tabla y la
pantalla se pueden dejar en su sitio, inertes.

Lo que **no** se recupera al revertir es la información de qué dueño aprobó qué y
cuándo, si se borra la tabla. Conviene conservarla aunque se deje de usar.

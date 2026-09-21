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

**Las instancias que YA existen se congelan en silencio.** La tabla nace con
`aprobacion` por omisión y la migración no puede distinguir una instalación nueva
de una que lleva meses corriendo. DEMO y g500 dejarían de actualizarse sin que nada
diera error. **Va en la tarjeta humana del despliegue**: para cada instancia
existente, fijar el modo a conciencia.

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

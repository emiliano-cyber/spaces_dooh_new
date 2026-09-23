# ADR 0038: Los tickets de soporte viven en la instancia, y el panel los jala

- **Fecha:** 2026-09-22
- **Estado:** Aceptada

Decisión del dueño del producto, pedida en sesión: **el dueño de cada instancia
escribe una incidencia desde su propia aplicación, y AS OOH la ve en el PADRE,
agrupada por instancia, en una pantalla hermana de `/flota/`.**

Hoy no existe ningún camino para eso. Un cliente que encuentra un fallo lo cuenta
por teléfono, y no queda escrito en ninguna parte que se pueda mirar después.

## Contexto

### El nombre `incidencias` ya está ocupado, y por otra cosa

`db/schema.sql:310` declara una tabla `incidencias` que es **del negocio**: una
incidencia ocurre en un *sitio* —clima, vandalismo, mantenimiento—, tiene fotos, y
bloquea comercialmente esa pantalla. `app/api/incidencias/route.ts` exige
`arrendadores.crear`.

No tiene nada que ver con lo que este ADR decide. **El concepto nuevo se llama
`ticket`**, y esta separación se escribe aquí porque el día que alguien lea
«incidencia» en una conversación de soporte va a buscar en el sitio equivocado.

### El canal autenticado PADRE→instancia ya existe

Es el hallazgo que decide el diseño entero, y no había que construirlo:

- `apps/flota/servidor.mjs:818` — `filasDeLaFlota()` recorre el inventario y
  consulta a **cada instancia**.
- `apps/flota/servidor.mjs:798` — `consultarConToken()` resuelve el token de esa
  instancia, del entorno o de `/etc/space-os/flota-tokens.env`.
- `apps/web/lib/server/flota.ts` — `esElPanel()` compara ese token en
  tiempo constante contra `FLOTA_TOKEN`. **Sin token configurado, nadie es el
  panel**: ausente significa cerrado.

> **Las dos líneas se remidieron el 2026-09-23** (decían `:437` y `:417`, que es
> donde estaban al escribir este ADR). Las movió el trabajo de esta misma rama:
> un archivo que crece invalida todas sus citas de golpe y ninguna da error —
> solo mandan al sitio equivocado. Si no cuadran, mídelas antes de leerlas:
> `grep -n 'function filasDeLaFlota\|function consultarConToken' apps/flota/servidor.mjs`.

> **Nota del 2026-09-23, al implementarlo.** `esElPanel()` vivía dentro de
> `version/route.ts` y se **mudó entera** a `lib/server/flota.ts` al aparecer la
> segunda ruta que el panel consume. Se mudó en vez de copiarse a propósito: dos
> comparaciones en tiempo constante divergen, y la que divergiría es la que nadie
> mira. Lo que `/api/version` contesta —y lo que calla— no cambió, y su prueba de
> claves exactas lo sostiene.

O sea que ya hay un canal autenticado, probado y desplegado, del PADRE hacia cada
instancia. Lo único que le falta a este ADR es una ruta más colgada de él.

### La promesa que esto roza, y que conviene citar entera

`version/route.ts` lleva escrita la promesa comercial del producto:

> *«Ni cuántas organizaciones hay, ni cómo se llaman, ni cuántos usuarios, ni una
> sola cifra del negocio del owner. El panel de flota es de AS OOH y la instancia
> es del owner: la promesa comercial es que un owner no es una fila en la base de
> otro, y una ruta de telemetría es justo por donde esa promesa se erosiona sin
> que nadie lo note.»*

Un ticket es **texto libre escrito por el cliente**. Llevarlo al PADRE es una
excepción a esa promesa, y este ADR la hace **explícita en vez de accidental**.

Lo que la justifica no es que sea poco dato: es que **el cliente lo escribió para
que tú lo leas**. Eso es un consentimiento que la telemetría nunca tiene. Un
contador de organizaciones se recoge sin que nadie lo pida; un ticket no existe
hasta que alguien pulsa «enviar».

## Decisión

### 1 · El ticket se guarda en la base de la instancia

Tabla `tickets`, **con `tenant_id` y RLS** por el bloque de `db/schema.sql:634`,
como cualquier tabla de negocio. El dato es del owner y vive en su máquina: si el
PADRE está caído, o la red falla, el ticket que el cliente escribió **sigue ahí**.

### 2 · Una sola ruta nueva, dos direcciones, cero secretos nuevos

`/api/tickets`, tras el **mismo** `FLOTA_TOKEN` que ya protege `/api/version`:

| Verbo | Quién | Para qué |
|---|---|---|
| `GET` con sesión | el cliente | sus propios tickets, filtrados por RLS |
| `POST` con sesión | el cliente | abrir un ticket |
| `GET` con `x-flota-token` | el panel | los tickets de esa instancia |
| `PATCH` con `x-flota-token` | el panel | responder y cambiar el estado |

La respuesta viaja de vuelta por el mismo canal y el cliente la ve **en su propia
aplicación**, porque se escribe en su propia base. No hace falta credencial de
salida en `app.env`, ni cola de reintentos, ni abrir una dirección nueva de red.

### 3 · Ruta aparte, nunca una clave nueva en `/api/version`

`/api/version` se queda como está. Su prueba **afirma las claves exactas** del
cuerpo —no la ausencia de unas cuantas— justo para que una clave nueva rompa la
prueba en vez de colarse. Este ADR respeta ese diseño en lugar de gastarlo.

### 4 · El panel recibe el `tenant_id`, nunca el nombre de la organización

Una instancia puede tener varias razones sociales (ADR 0034). El panel necesita
distinguir «estos tres tickets son del mismo» sin aprender **quién** es: viaja el
`tenant_id` en crudo, que es un uuid opaco, y no `tenants.nombre`.

Es la misma frontera que `resumen()` sostiene con su lista blanca en
`apps/flota/servidor.mjs`, y por el mismo motivo.

### 5 · La pantalla del panel no guarda nada en disco

`/flota/tickets` jala en vivo, igual que `/flota/`. Una instancia apagada sale
`sin-respuesta` — el mismo lenguaje que el panel ya habla, en vez de uno nuevo.

## Alternativas consideradas y descartadas

### A · Que la instancia empuje el ticket al PADRE al pulsar «enviar»

Era el diseño obvio, y es el peor de los tres.

Obliga a meter una credencial de salida en `app.env` de cada instancia, y sobre
todo obliga a construir **una cola con reintentos**: si el PADRE no contesta en
ese instante, el ticket se pierde. `update.sh` ya tuvo que construir esa cola
(`update.sh:773` habla de los reportes que «quedan pendientes y salen en la
siguiente corrida»), y duplicarla en la aplicación es trabajo nuevo con un modo de
fallo nuevo — uno que además **se lo come el cliente**, que creyó haber reportado.

Con el panel jalando, el ticket está a salvo en cuanto se guarda localmente.

### B · Colgarse del receptor de reportes que ya existe (`/flota/reporte`)

Parecía gratis y no lo es. `apps/flota/reporte.mjs:70-82` **rechaza el reporte
entero si llega una clave de más**, a propósito y con su prueba. Meter tickets ahí
obliga a cambiar el contrato en los dos extremos a la vez — y las instancias
adoptan a ritmos distintos, que es exactamente el problema que el ADR 0037 acaba
de pagar caro. Además ese canal lo escribe `update.sh` desde el anfitrión, no la
aplicación.

### C · Correo, o un sistema de tickets de terceros

Media hora de trabajo y cero infraestructura. Se descarta porque no da lo que se
pidió: no hay pantalla, ni estado, ni «cuántos lleva abiertos g500». Y un sistema
de terceros mete los datos de los clientes de AS OOH en una base que no es de
AS OOH, que es justo lo contrario del modelo de instancias soberanas.

## Consecuencias

### Lo que mejora

- Queda **escrito** lo que hoy se cuenta por teléfono, con fecha y con estado.
- El cliente ve la respuesta sin salir de su aplicación.
- AS OOH ve de un vistazo qué instancia está sufriendo, que es la pregunta que
  hoy solo se contesta entrando a cada droplet.

### Lo que cuesta, y hay que decirlo

**Solo quien puede abrir Administración puede escribir un ticket.** El módulo es
`administracion`, como la pantalla de actualizaciones del ADR 0037. Consecuencia
real: un operario que encuentra un fallo montando una lona **no puede reportarlo**;
tiene que decírselo a su administrador. Se acepta para la primera versión porque
el interlocutor natural de AS OOH es el administrador del owner, y abrir la
escritura a todos los módulos multiplicaría el ruido antes de saber cuánto hay.
Si duele, se abre después: es un cambio de una línea en el guard.

**El GET con token de flota atraviesa todos los tenants de la instancia, y eso es
`qRaw` deliberado.** Es la zona roja R2, la que ya costó dos fallos en este
proyecto porque **no da error: devuelve cero filas en silencio, o las de otro**.
Por eso va con dos pruebas e2e emparejadas y no una: que la ruta **del cliente**
aísla, y que la **del panel** atraviesa. Una sola de las dos no demuestra nada —
un guard roto pasaría la primera.

**Una instancia sin `FLOTA_TOKEN` configurado no aparece.** Es el comportamiento
correcto —ausente significa cerrado— pero significa que el panel podría enseñar
«0 tickets» para una instancia que sí los tiene. La pantalla tiene que distinguir
**«no tiene tickets»** de **«no me contesta»**, o repite el error de leer un
silencio como una buena noticia.

**El texto del cliente cruza al PADRE.** Ya dicho arriba; se repite aquí porque es
la consecuencia que hay que releer si algún día se amplía lo que viaja. La regla
que queda: **lo que el cliente escribió para AS OOH, viaja; lo que no, no.**

## Qué NO decide este ADR

- **Notificaciones.** Nadie se entera de un ticket nuevo si no abre la pantalla.
  Cerrar ese círculo es trabajo aparte, y choca con el 403 del bucket de logs, que
  sigue abierto (`docs/evidencias/11-g500-sin-respaldo-programado.md`).
- **Adjuntos.** Un ticket es texto. Una captura de pantalla viajaría por otro
  camino y con otra decisión de privacidad.
- **Quién atiende.** No hay asignación ni turnos: hay una bandeja.

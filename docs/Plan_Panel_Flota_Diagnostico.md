# Diseño · el panel de flota dice POR QUÉ una instancia no contesta

- **Fecha:** 2026-09-10
- **Estado:** aprobado por Emiliano, **con su retro del 10/09 ya aplicada**
  — la frase lleva el código, la fase 2 se conserva, y una instancia sana no
  muestra nada
- **Alcance:** `apps/flota` en la fase 1; `apps/flota` + `infra/scripts/update.sh`
  en la fase 2. **Ninguna de las dos toca `apps/web`**, así que **nada de esto
  viaja en la imagen ni necesita release ni promoción** — que es lo que lo
  desbloquea, porque promover está parado hoy
- **Riesgo:** 🟡 la fase 1 modifica la lista blanca de lo que el panel guarda de
  un owner, con pruebas que afirman las claves exactas (§3). La fase 2 cruza esa
  frontera al revés —dato que viene DE la instancia— y por eso manda valores
  cerrados y no texto (§9.2)

---

## 1 · El problema, medido

El panel de flota clasifica cada instancia en tres estados: `al-dia`,
`rezagada`, `sin-respuesta` (`estado.mjs:70-72`). **`sin-respuesta` es un solo
cajón**, y detrás de él caben al menos seis averías con seis arreglos distintos:
el dominio dejó de resolver, nadie escucha en el 443, el certificado caducó, el
contenedor está caído, la aplicación devuelve 502, o el token del panel no vale.

Dos hallazgos concretos, del 2026-09-10:

**1 · El diagnóstico ya se calcula y se tira.** `consultar()`
(`estado.mjs:262-305`) construye un campo **`motivo`** con cuatro casos
distintos —`HTTP <código>`, «contestó sin versión», «no hay token para esta
instancia», y el error de red—. `COLUMNAS` (`:68`) no lo incluye, así que
`resumen()` lo descarta una línea después. **El trabajo no es calcularlo: es no
perderlo.**

**2 · Y el caso de red no dice nada.** El `catch` guarda
`String(error?.message)`, y en Node eso es **`fetch failed`** para todas las
averías de red. La causa vive en `error.cause.code`. Las siete averías más
comunes salen hoy con el mismo texto inútil.

> **Esto no es teórico.** La misma noche en que se escribió este diseño:
> `prueba.space-os.io` daba `000` sin decir que era **DNS**, y
> `demo.space-os.io` devolvía un **404** que en realidad significaba «esa
> máquina corre código anterior a F6.1 y no tiene esa ruta». Dos diagnósticos
> distintos, media hora de comandos a mano cada uno.

## 2 · Las tres decisiones, tomadas antes de diseñar

| | Decisión | Consecuencia |
|---|---|---|
| **Alcance** | **Dos fases.** La 1 dice por qué una instancia no contesta; la 2, si una actualización falló y con qué código | La 2 **se conserva**, no se descarta (retro del 10/09). Ver §9 |
| **Profundidad** | **Nombrar la capa que falló**, con **una sola** consulta | Nada de sondeo profundo automático: el PADRE no hace más peticiones hacia la máquina de un cliente de las que ya hace |
| **Memoria** | Recordar **solo `ultimaVezBien`** | Distingue un parpadeo de una caída. Un campo, ninguna base de datos |
| **La frase lleva el código** | «el dominio no resuelve **(ENOTFOUND)**», «el token no vale **(HTTP 403)**» | Retro del 10/09: la frase para leer deprisa **y** el código para buscarlo o pegarlo en un buscador. No se elige entre los dos |
| **Silencio si está sana** | Una instancia al día no muestra motivo | Confirmado en la retro |

> [!important] Corrección sobre el coste de la fase 2 — medido el 10/09
> Este diseño dijo primero que la fase 2 «viaja en la imagen» y por tanto exigía
> release y promoción. **Es falso.** El reporte lo construye `update.sh`
> (`:569`, inyectando `instancia` delante de lo que devolvió `/api/version`), y
> `update.sh` **vive en la máquina**: lo instala `provision-instancia.sh:481` y
> **no se autoactualiza**.
>
> O sea que la fase 2 cuesta **copiar el `update.sh` nuevo a cada instancia**
> —hoy dos— y nada más. Sin imagen, sin tag y sin promoción: **no está
> bloqueada** por lo de `prueba`.

## 3 · La frontera que se toca, y el argumento para cruzarla

`COLUMNAS` es la lista blanca de lo único que el panel guarda de un owner
(`estado.mjs:68`), y el README de `apps/flota` la llama «la promesa». Hay
pruebas que afirman las claves exactas.

> [!important] Y aquí `COLUMNAS` hace dos trabajos a la vez, que hay que separar
> Es **lo que la fila guarda** y **lo que la tabla imprime**, y esas dos cosas
> dejan de coincidir con este cambio. El propio código ya lo sabe:
> `estado.mjs:508-511` imprime los motivos **debajo** de la tabla y explica por
> qué no van en una columna — *«son texto de largo impredecible, y meterlos en
> la tabla la vuelve ilegible justo el día que hay tres instancias caídas y hay
> que leerla deprisa»*.
>
> Así que el diseño **no mete `motivo` en `COLUMNAS`**. Se separan los dos
> conceptos, que es lo que el archivo necesitaba de todos modos:
>
> | | Qué es | Contenido |
> |---|---|---|
> | `COLUMNAS` | lo que la **tabla imprime** | las 7 de hoy, sin tocar |
> | `CLAVES_FILA` (nueva) | lo que la **fila guarda** — aquí vive la promesa | `COLUMNAS` + `motivo` + `ultimaVezBien` |
>
> La lista blanca y su guard se atan a `CLAVES_FILA`. `COLUMNAS` se queda como
> la lista de presentación, y sigue gobernando las dos tablas sin duplicarse.

**Por qué no rompe la promesa:** esa lista existe para que **datos de negocio de
un owner** no entren al plano de control — ni conteos, ni nombres de
organización, ni cifras. `motivo` no es un dato del owner: **lo escribe el
PADRE**, derivado de un código de error de red o de un número de estado HTTP.

**Y se sujeta con un guard, no con una promesa en prosa:** una prueba afirma que
**ningún valor del cuerpo de la respuesta acaba dentro de `motivo`**. Sin ese
guard, este campo sería la puerta de atrás de lo que la lista blanca cerró — el
día que a alguien le resulte cómodo meter ahí «lo que dijo la instancia».

`COLUMNAS` sigue siendo la **única** fuente: gobierna la tabla del terminal
(`tabla()`, `:464`) y la del HTML (`servidor.mjs:92-95`). No se duplica la lista.

## 4 · El diseño

### 4.1 · `apps/flota/diagnostico.mjs` — una función pura

Recibe lo que falló y devuelve la frase. **Sin red, sin disco, sin
dependencias**, como `comprobaciones.mjs` y `dns.mjs`. Es la pieza que concentra
todo el valor de esta tarea y la que se prueba sola.

```
clasificar({ error })            → frase de red o TLS
clasificar({ status })           → frase de HTTP
clasificar({ cuerpoSinVersion, token }) → frase de token
```

**La frase lleva el código entre paréntesis** (retro del 10/09). No se elige
entre una cosa y la otra: la frase es para leerla deprisa a las tres de la
mañana, y el código es para buscarlo, pegarlo en un buscador o citarlo en un
mensaje. Los dos casos de token no tienen código y salen sin paréntesis.

| Entrada | Lo que sale |
|---|---|
| `ENOTFOUND`, `EAI_AGAIN` | el dominio no resuelve (ENOTFOUND) |
| `ECONNREFUSED` | nadie escucha en el 443 (ECONNREFUSED) |
| `EHOSTUNREACH`, `ENETUNREACH` | la máquina no responde (EHOSTUNREACH) |
| `ETIMEDOUT`, abortado por timeout | no contestó en 5 s (ETIMEDOUT) |
| `CERT_HAS_EXPIRED` | el certificado caducó (CERT_HAS_EXPIRED) |
| `ERR_TLS_CERT_ALTNAME_INVALID` | el certificado no cubre este dominio (ERR_TLS_CERT_ALTNAME_INVALID) |
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, `SELF_SIGNED_CERT_IN_CHAIN` | el certificado no se puede verificar (UNABLE_TO_VERIFY_LEAF_SIGNATURE) |
| HTTP 502, 503, 504 | nginx contesta pero la aplicación no (HTTP 502) |
| HTTP 404 | no existe `/api/version`: corre una versión anterior a F6.1 (HTTP 404) |
| HTTP 401, 403 | el token no vale (HTTP 403) |
| HTTP otro | `HTTP <código>` — se conserva el comportamiento actual |
| cuerpo sin `version`, con token | el token no lo reconoce como panel |
| cuerpo sin `version`, sin token | falta `FLOTA_TOKEN_<NOMBRE>` en el panel |
| nada de lo anterior | el `code` crudo, o el mensaje si no hay `code` |

> **El código que se imprime es el que llegó, no el de la fila de la tabla.**
> `EAI_AGAIN` sale con `(EAI_AGAIN)` aunque comparta frase con `ENOTFOUND`, y un
> 503 sale con `(HTTP 503)`. Si se imprimiera el representante del grupo, el
> panel diría un código que nadie vio — y eso es peor que no decir ninguno.

> **La última línea importa más que las otras.** Un clasificador que se traga lo
> que no reconoce convierte una avería nueva en «error desconocido», que es
> volver al punto de partida. Lo que no está en la tabla **sale con su código
> tal cual**, que es feo y es útil.

### 4.2 · `consultar()` usa el clasificador

Cambia en tres sitios, y ninguno cambia su forma de devolver: sigue devolviendo
la fila con `motivo`. Lo que cambia es **qué** hay dentro de `motivo`. En el
`catch`, se lee `error.cause?.code` antes de caer al mensaje.

### 4.3 · `ultimaVezBien` se arrastra

Antes de escribir `estado.json`, se lee el anterior y se toma por **nombre de
instancia** su `ultimaVezBien`. Reglas:

- si la instancia contesta bien ahora → `ultimaVezBien` = ahora;
- si no contesta → se conserva el valor anterior;
- si no hay archivo previo, está corrupto, o no se puede leer → **se trata como
  «sin memoria» y el panel sigue**. Nunca revienta por esto: el criterio de
  «sale siempre con 0» ya está escrito en la cabecera de `estado.mjs:44-49`.

En pantalla se lee junto al motivo: *«el dominio no resuelve · última vez bien
hace 3 h»*.

### 4.4 · La pantalla

**El terminal ya enseña los motivos** — `estado.mjs:512-514` los imprime debajo
de la tabla, uno por línea. Ahí **no cambia la forma, solo el contenido**: la
frase pasa a ser útil, y se le añade el «última vez bien». Cero columnas nuevas.

**El HTML no los enseña en absoluto**, y ahí está el hueco de verdad:
`resumen()` descarta `motivo`, así que el panel web nunca lo tuvo. Va como
**sub-fila a ancho completo** debajo del renglón de la instancia, siguiendo el
mismo criterio que el terminal: una frase no cabe en una celda.

Una instancia `al-dia` **no** muestra motivo: el silencio es la señal de que
está bien.

## 5 · Lo que este diseño NO hace

- **No sondea más hondo.** Nada de correr las tres comprobaciones de
  `comprobaciones.mjs` contra la instancia de un cliente automáticamente.
- **No guarda historial.** Un campo, no una línea de tiempo.
- **No cambia el estado** de una fila: `sin-respuesta` sigue llamándose así. Lo
  que se añade es el porqué, no una taxonomía nueva.
- **La fase 1 no toca `update.sh` ni el reporte.** Eso es la fase 2 (§9), y va
  en commits aparte para que la 1 pueda desplegarse sin esperarla.

## 6 · Pruebas

Todo unitario y sin red — es lo que hace que esta tarea sea barata:

| Qué | Cómo |
|---|---|
| La tabla de traducción | una prueba por entrada, guiada por tabla. Incluye el caso «no reconocido sale con su código» |
| **El guard de la promesa** | un cuerpo con datos de negocio y sin `version`; se afirma que **ningún valor suyo** aparece en `motivo` |
| `consultar()` con `pedir` falso | un error con `cause.code`, un 502, un 404, un cuerpo sin versión |
| `ultimaVezBien` | se arrastra al fallar; se actualiza al contestar; **y con un `estado.json` corrupto el panel termina bien** |
| Las pruebas de la lista blanca | se actualizan **a propósito** a nueve claves, no de rebote |

## 7 · Cómo llega al PADRE

`apps/flota` **no viaja en la imagen**: el `Dockerfile` construye con
`--filter=web`, y el README de esa carpeta dice que ese filtro es lo único que lo
garantiza. Así que esto llega con un `git pull` en el PADRE y reiniciando el
panel — **sin release, sin tag y sin promoción**, que es justo lo que hoy está
bloqueado por lo de `prueba`.

El comando exacto de reinicio se confirma en la máquina y va en su tarjeta: no se
escribe de memoria.

## 8 · Riesgos

| | |
|---|---|
| **La lista blanca se relaja de verdad** | Mitigado por el guard de §6. Si esa prueba se borra, la promesa se queda sin sujeción |
| El `motivo` se vuelve un cajón de sastre | Solo se escribe desde el clasificador, que es una función con tabla cerrada |
| Los códigos de Node cambian entre versiones | El caso por omisión imprime el código crudo, así que una avería nueva se ve en vez de desaparecer |

---

## 9 · Fase 2 · saber que una actualización falló, y con qué código

Se conserva por la retro del 10/09. Va en commits aparte: la fase 1 se despliega
sin esperar a ésta.

### 9.1 · Lo que hoy no se puede saber

`update.sh` reporta al PADRE al terminar, tomando la respuesta de
`/api/version` y añadiéndole `instancia` (`:569`). Si la actualización **falla**,
lo que se reporta es la versión **anterior** —la que sigue corriendo— así que en
el panel esa instancia aparece como **`rezagada`**, exactamente igual que una
que nadie ha actualizado todavía.

**Y son dos cosas distintas:** «esta instancia no se ha actualizado» se resuelve
esperando al cron; «el update reventó al migrar» no se resuelve solo.

### 9.2 · La frontera, que aquí NO es la misma que en la fase 1

El argumento que sostiene `motivo` en la fase 1 es que **lo escribe el PADRE**:
sale de un código de error o de un estado HTTP, nunca del cuerpo de una
respuesta. Un campo `error` que mande la instancia **rompe ese argumento**: es
texto libre cruzando la frontera hacia el plano de control, y ahí puede venir
cualquier cosa — incluido un fragmento de log con datos de un cliente.

**Así que la instancia no manda texto.** Manda **un número**:

| Clave | Qué es | Validación en el PADRE |
|---|---|---|
| `codigo` | el **código de salida** de `update.sh` en su última corrida | **opcional**, y por forma: entero de 0 a 255 |

> **Corregido el 10/09, durante la ejecución.** Este apartado pedía dos claves
> inventadas —`resultado` (`ok`/`fallo`) y `paso` (`pull`, `respaldo`,
> `migraciones`, `arranque`, `salud`)—. Al abrir `update.sh` para implementarlo
> apareció que ese vocabulario **ya existe y es mejor**: los códigos de salida
> están documentados en la cabecera del propio guión (`update.sh:374-388`), y
> distinguen cosas que un nombre de paso **aplana**.
>
> El caso que lo decide: `paso: migraciones` mete en el mismo cajón el **2**
> —«las migraciones fallaron y **LA BASE PUDO CAMBIAR**»— y el **3** —«no se
> aplicó nada»—. La primera es alguien entrando al droplet esta noche; la
> segunda espera al cron. Y la cabecera de `update.sh` advierte, literalmente,
> que *«un `set -e` que los aplanara todos en fallo sería justamente el error
> que este script no puede cometer»*. Inventar un vocabulario nuevo para
> aplanarlos a mano era cometerlo por otra vía.

Y **el PADRE compone la frase**: el 2 se lee «las migraciones fallaron a medias
y LA BASE PUDO CAMBIAR», el 3 «no se aplicó nada». Mismo principio que la fase
1, y por eso encaja sin excepciones: las palabras las escribe siempre el padre.
Un número de un byte no tiene sitio donde esconder un dato de negocio.

**Se valida por forma, no por enumeración**, y esto también cambió durante la
ejecución. La primera versión rechazaba cualquier código que no estuviera entre
los nueve que el panel traduce — y eso contradecía al propio panel, que promete
*nombrar* el código que no conoce en vez de callarlo. Peor: el día que
`update.sh` gane un modo de fallo nuevo, esa instancia dejaría de reportar
**entera** y se quedaría a oscuras justo cuando algo va mal. Así que se
comprueba lo que cabe en un código de salida (entero 0–255) y el panel nombra
lo que no sabe traducir.

> **Lo que se pierde con esto, dicho claro:** el mensaje de error concreto no
> llega al panel. Para eso está el log de la instancia, y sacarlo de la máquina
> es la deuda de `SPACES_KEY`/`LOGS_BUCKET` que ya está anotada. El panel dice
> **con qué código** murió, no **qué** dijo — y con el código ya sabes si entrar
> o esperar.

### 9.3 · Las piezas

| Dónde | Qué cambia |
|---|---|
| `infra/scripts/update.sh` | `salir()` fija `FLOTA_CODIGO="$codigo"` y `flota_cuerpo()` lo inyecta en el JSON |
| `apps/flota/reporte.mjs` | acepta `codigo` como clave **opcional** y lo valida por forma |
| `apps/flota/diagnostico.mjs` | `fraseDeActualizacion(codigo)`: la tabla de códigos → frase |
| `apps/flota/estado.mjs` | `CLAVES_REPORTE_OPCIONALES = ['codigo']`; la fila compone la frase |
| `apps/flota/servidor.mjs` | la sub-fila de la fase 1 ya la enseña: **no cambia** |

> **Y una cosa que este apartado daba por pendiente y ya estaba hecha:**
> «reportar también en el camino de fallo». `salir()` (`update.sh:668-684`) es la
> única puerta de salida una vez tomado el candado, y **ya llamaba** a
> `reportar_a_flota || true` en todos los caminos. Lo único que faltaba era que
> el cuerpo llevara el código. Fijarlo en `salir` y no en cada punto de fallo es
> deliberado: un modo de fallo nuevo arrastra su código solo.

### 9.3-bis · El 75 nunca llega, y está medido

`E105` de `pruebas-update.sh` lo afirma: cuando el candado está ocupado el
código **75** lo devuelve el proceso de **fuera** del candado
(`update.sh:707-711`), que no pasa por `salir` — y `salir` es la única puerta
que reporta. Así que esa corrida **no manda nada en absoluto**, que es lo
correcto: una corrida que no se ejecutó no puede sobrescribir el estado de la
que sí. El panel trata el 75 como sano de todos modos, pero esa rama es
**defensiva**, no un caso vivo.

### 9.4 · El coste real, corregido

**No viaja en la imagen.** `update.sh` lo instala `provision-instancia.sh:481` y
no se autoactualiza, así que el despliegue es **copiar el archivo nuevo a cada
instancia** — hoy dos, g500 y DEMO — con su tarjeta. Las instancias futuras lo
reciben del aprovisionamiento sin hacer nada.

Lo que sí conviene tener presente: **una instancia con el `update.sh` viejo
seguirá reportando sin esa clave**, y el panel tiene que tratar eso como «no lo
dice» y no como un fallo. Es el mismo criterio de `ultimaVezBien`.

Y de ahí sale **el orden de despliegue, que no es negociable**: primero el
PADRE, después las instancias. El receptor rechaza un reporte entero si trae una
clave que no conoce —a propósito—, así que una instancia que mande `codigo`
antes de que el PADRE lo acepte se queda **muda** en el panel, precisamente en
la corrida en que algo pudo fallar. Al revés no pasa nada. La tarjeta que lo
impone es `docs/evidencias/flota-fase2-desplegar.txt`.

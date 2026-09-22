# Tarjeta · actualización elegida por instancia (ADR 0037)

- **Para:** quien tenga acceso a los droplets de las instancias. No hace falta
  haber leído el ADR ni el código — cada paso trae el comando exacto, qué debe
  salir y qué hacer si sale otra cosa.
- **Qué autoriza esto:** [ADR 0037](../adr/0037-cada-instancia-elige-si-toma-la-version-nueva.md)
  — cada instancia decide, desde su propia pantalla, si instala la versión
  nueva cuando se publica. Antes el canal mandaba solo.
- **Relacionada:** `docs/runbook-actualizar-instancia.md` ·
  `vault/02-Backend/actualizaciones-instancia.md` (el mapa técnico completo).

> [!important] Lo que ningún paso de aquí ejecuta
> **Nada de esto se ha corrido todavía contra un contenedor de verdad.** Lo
> probado hasta hoy (2026-09-22) son las piezas por separado: la función pura
> `decidirActualizacion()` con sus propias pruebas, el endpoint con las suyas,
> el arnés de `update.sh` con un `docker` **doble** que simula el registro —
> nunca corre `node` de verdad —, y los dos arneses de `instalar-hijo.sh` /
> `provision-instancia.sh` comparando el texto que escribirían en el cron. Lo
> que falta es el recorrido entero, en una máquina real, con un Postgres real
> y una imagen real. Los pasos 0 a 3 de abajo son justo eso.
>
> **Dos cosas SÍ se midieron el 2026-09-22**, en la ola de arreglo de la
> revisión final: el **paso 6** (`docker build` en verde y
> `/app/scripts/actualizaciones.mjs` dentro del contenedor, con su `import()`
> ejecutado) y la migración contra el Postgres local, incluida su idempotencia.
> Y apareció un **paso 0** que antes no existía y sin el cual los pasos 1 a 3 no
> hacen nada — léelo antes que ninguno.

---

## Paso 0 · Copiar el `update.sh` nuevo al anfitrión — SIN ESTO NADA DE LO DEMÁS FUNCIONA

> [!danger] Este paso no existía hasta el 2026-09-22, y sin él los pasos 1 a 3 no hacen nada
> **El despliegue va por DOS vehículos y esta tarjeta solo seguía uno.** La
> migración y la aplicación viajan **dentro de la imagen** y llegan solas en la
> primera actualización que tome la instancia. **`update.sh` no.** Vive en el
> **anfitrión**, en `/opt/space-os/update.sh`, y **nada lo actualiza solo**:
> solo lo escriben `instalar-hijo.sh` y `provision-instancia.sh`, es decir
> instalaciones nuevas y aprovisionamientos. `update.sh` actualiza **el
> contenedor, no a sí mismo**.
>
> El `update.sh` que hoy corre en DEMO y g500 es el de `main`, y su `case`
> **rechaza cualquier argumento que no conozca** (`infra/scripts/update.sh`,
> la rama `*)` del parseo). Así que `--comprobar` le da **`exit 1`**. Si se
> hiciera el **paso 3** (la línea de cron `*/15`) sin hacer antes este paso,
> el resultado sería: **`exit 1` cada 15 minutos, 96 veces al día, para
> siempre, y el ADR 0037 sin ningún efecto.**

**Qué hacer, para CADA instancia que ya exista (hoy: DEMO y g500), y ANTES que
los pasos 1 y 3:**

1. Desde tu máquina, con el repositorio a la mano, copia el archivo:
   ```bash
   scp infra/scripts/update.sh root@<IP-de-la-instancia>:/opt/space-os/update.sh
   ```
2. Entra y déjale el modo que le toca (**750**, el mismo que le pone el
   instalador — el archivo lo corre `root` desde cron y no tiene por qué
   leerlo nadie más):
   ```bash
   ssh root@<IP-de-la-instancia>
   chown root:root /opt/space-os/update.sh
   chmod 750 /opt/space-os/update.sh
   ```
3. **Comprueba que el que quedó SÍ conoce `--comprobar`** — esta es la línea
   que distingue el nuevo del viejo:
   ```bash
   /opt/space-os/update.sh --help | grep -c comprobar
   ```
   **Debe salir un número mayor que 0.** Si sale `0`, el archivo que hay ahí
   sigue siendo el viejo: la copia no llegó, o llegó a otra ruta. **No sigas
   al paso 3 hasta que esto no dé un número.**

4. Y una comprobación de que no rompiste lo de hoy, porque este archivo lo
   corre el cron de madrugada:
   ```bash
   /opt/space-os/update.sh --dry-run
   ```
   Debe terminar en `--dry-run terminado. Ni base, ni contenedor, ni respaldo:
   nada cambio.` Si no, **vuelve a poner el `update.sh` anterior** (el de
   `main`) antes de irte: una instancia con un actualizador roto no se
   actualiza ninguna noche.

> [!note] Por qué esto no es «desplegar en el servidor»
> Copiar `update.sh` al anfitrión es exactamente lo que ya hacen
> `instalar-hijo.sh` y `provision-instancia.sh` en cada alta; aquí se hace a
> mano solo porque estas dos instancias nacieron antes. **Nadie edita nada en
> el servidor**: se copia el archivo del repositorio tal cual.

---

## Paso 1 · Fijar el modo en las instancias que YA existen — el que más duele si se olvida

**Por qué:** la tabla `actualizaciones_instancia` nace con `modo = 'aprobacion'`
por diseño (el dueño decide, nunca se le salta), y la migración **no tiene
forma de distinguir** una instancia recién nacida de una que lleva meses
corriendo. Si se deja en `aprobacion` sin que nadie lo sepa, **DEMO y g500
dejarían de actualizarse en silencio** — ningún error, ningún aviso, nada en un
log que alguien vaya a mirar. Se quedarían esperando una aprobación que nadie
sabe que hace falta dar.

> [!important] Cuándo empieza de verdad ese riesgo — corregido el 2026-09-22
> Hasta hoy este paso decía que el congelamiento empieza **el día que llegue la
> migración**. **Es falso, y la diferencia cambia cuándo hay que correr esto.**
> La migración sola **no congela nada**: crea la tabla y ya. El `update.sh`
> viejo —el que hoy corre en DEMO y g500— **ni siquiera la lee**, así que una
> instancia puede recibir la migración y seguir actualizándose como siempre,
> indefinidamente.
>
> **El congelamiento empieza el día que llega el `update.sh` NUEVO**, o sea el
> día que alguien haga el **paso 0** — porque `update.sh` vive en el anfitrión
> y nada lo actualiza solo. La urgencia estaba atada al vehículo equivocado.
>
> **Consecuencia práctica:** este paso no va atado a publicar una versión, va
> atado al paso 0. Hazlo **justo después del paso 0 y antes del paso 3**, en la
> misma sesión y en la misma instancia. Hoy (2026-09-22) no ha pasado nada de
> esto: DEMO y g500 corren sin la tabla **y** con el `update.sh` de `main`.

**Qué hacer, para CADA instancia que ya exista (hoy: DEMO y g500):**

1. Entra a la máquina de la instancia:
   ```bash
   ssh root@<IP-de-la-instancia>
   ```
2. Decide **a conciencia** el modo — no hay un valor correcto universal, es
   una decisión de negocio por instancia:
   - `automatica`: se instala sola en la ventana de madrugada (04:17) en
     cuanto se publica una versión nueva. Es el comportamiento de **antes**
     de este ADR — elígelo si quieres que siga igual que hasta hoy.
   - `aprobacion`: el dueño (o quien opere esa instancia) decide cuándo,
     desde la pantalla de Administración → Configuración. Es el valor por
     omisión y el que trae ya la fila.
3. Si decides `automatica` (para mantener el comportamiento de hoy), escríbelo:
   ```bash
   sudo -u postgres psql -d spaces -c "update actualizaciones_instancia set modo = 'automatica', actualizado_en = now();"
   ```
   Si decides dejarla en `aprobacion`, no hace falta correr nada — ya nace así
   — pero **igual conviene comprobarlo** (paso siguiente), porque si la
   migración aún no se aplicó en esa instancia la tabla no existe todavía.
4. Comprueba qué quedó:
   ```bash
   sudo -u postgres psql -d spaces -c "select modo, version_instalada, digest_instalado, actualizado_en from actualizaciones_instancia;"
   ```
   **Debe salir UNA fila.** Si sale `ERROR: relation "actualizaciones_instancia" does not exist`, esa instancia todavía no tiene la migración `20260921_actualizaciones_instancia.sql` aplicada — no es un fallo de este paso, es que su `update.sh` no ha corrido desde que la migración se publicó. Se resuelve solo en su próxima actualización; no hace falta forzar nada a mano.

**Repite para cada instancia de la flota**, no solo DEMO y g500 — cualquiera
que exista hoy nació antes de este ADR y tiene la misma exposición.

---

## Paso 2 · La primera corrida real de `update.sh --comprobar` en DEMO

**Por qué:** esto cierra el hueco más grande que queda. El SQL de las dos
sondas (`guion_estado()` / `guion_huella()`), los dos `import()` de
`scripts/actualizaciones.mjs` dentro del contenedor, y el conteo de
migraciones pendientes **no los ha ejecutado nadie contra una base real**. El
doble de `docker` del arnés de pruebas nunca corre `node`: lo que está probado
es que `update.sh` *obedece* la línea que la sonda le devuelva — no que la
sonda se produzca sola sobre datos reales.

**Hazlo primero en DEMO, nunca en g500 ni en ninguna otra.**

1. Entra a DEMO:
   ```bash
   ssh root@<IP-de-DEMO>
   ```
2. Primero, sin tocar nada:
   ```bash
   /opt/space-os/update.sh --dry-run
   ```
   **Debe salir**, entre otras líneas, algo terminado en:
   `--dry-run terminado. Ni base, ni contenedor, ni respaldo: nada cambio.`
   Si en vez de eso ves un error de conexión a la base o al registry, para
   aquí — el problema es previo a este ADR y no tiene sentido seguir.

3. Ahora sí, la corrida real de comprobación:
   ```bash
   /opt/space-os/update.sh --comprobar
   ```
   **Qué puede salir, y qué significa cada cosa:**

   | Lo que ves en el log | Qué significa |
   |---|---|
   | `2b · actualizaciones_instancia (comprobar, modo=aprobacion): esperando-aprobacion -> ...` seguido de `Esperar no es un error; no se toca nada.` | **Caso normal.** La sonda corrió, anotó lo disponible, y como nadie aprobó nada, no instala. Esto es lo que se espera ver la primera vez |
   | `2b · actualizaciones_instancia: NO SE PUDO LEER la base...` y sale con código **1** | La sonda no pudo consultar la tabla — revisa credenciales/red antes de seguir, NO es el resultado esperado |
   | `ERROR update: la imagen ... no trae RepoDigest...` y sale con código **1** | La imagen de DEMO no viene de un registro (por ejemplo, se cargó a mano). No es un fallo de esta tarea, pero bloquea todo el ADR en esa instancia hasta que la imagen sí venga jalada del registry |
   | `--comprobar: actualizaciones_instancia no existe todavia...` y sale con **0** | DEMO todavía no tiene la migración aplicada. Espera a que corra la corrida programada (o fuerza `/opt/space-os/update.sh` sin banderas) y repite este paso después |
   | `update: argumento desconocido: --comprobar (usa --dry-run, --simular-fallo-pull o --help)` y sale con **1** — fíjate en que la lista **no menciona `--comprobar`** | **El `update.sh` de esa máquina es el VIEJO: el paso 0 no se hizo, o no llegó.** No es un fallo de esta tarea ni del ADR — es que el archivo del anfitrión no se actualiza solo. Vuelve al **paso 0**, y no pongas el cron del paso 3 hasta que `--help \| grep -c comprobar` dé un número mayor que 0: con el `update.sh` viejo, esa línea de cron daría este mismo error 96 veces al día |

4. Lee la tabla después, para confirmar que quedó anotado:
   ```bash
   sudo -u postgres psql -d spaces -c "select modo, version_instalada, version_disponible, digest_disponible, migraciones_pendientes, comprobado_en from actualizaciones_instancia;"
   ```
   `comprobado_en` debe traer la hora de hace un momento. Si `version_disponible`
   sale igual que `version_instalada`, es correcto — significa que DEMO ya
   corre lo último publicado y no hay nada que anotar como novedad.

5. Con esto confirmado en DEMO, y **solo entonces**, se puede repetir el
   `--dry-run` (nunca hace falta correr `--comprobar` a mano en producción
   fuera de este ensayo: para eso está el cron del paso 3) en el resto de la
   flota si se quiere verificar lo mismo.

---

## Paso 3 · Instalar la entrada de cron nueva en las instancias ya aprovisionadas

**Por qué:** `instalar-hijo.sh` y `provision-instancia.sh` solo escriben la
línea de `--comprobar` cada 15 minutos **en instalaciones nuevas**. Una
instancia que ya existía antes de la tarea 6 (2026-09-22) tiene únicamente el
cron viejo de las 04:17 — nada dispara `--comprobar`, así que aunque el paso 1
deje una instancia en `aprobacion`, el dueño nunca verá la novedad hasta la
madrugada siguiente, y «instalar ahora» seguiría sin significar un cuarto de
hora.

> [!danger] NO hagas este paso sin haber hecho el PASO 0 en esa misma instancia
> El `update.sh` viejo **no conoce `--comprobar`**: su `case` rechaza lo
> desconocido y sale con **1**. Poner esta línea de cron sobre un `update.sh`
> viejo da **`exit 1` cada 15 minutos, 96 veces al día, para siempre**, sin que
> el ADR llegue a tener ningún efecto. La comprobación que lo descarta es la del
> paso 0: `/opt/space-os/update.sh --help | grep -c comprobar` tiene que dar un
> número mayor que 0.

**Qué hacer, para cada instancia ya aprovisionada:**

1. Entra a la instancia y mira qué tiene hoy:
   ```bash
   ssh root@<IP-de-la-instancia>
   cat /etc/cron.d/space-os-update
   ```
2. **Si ya aparece una línea con `--comprobar`**, no hagas nada más en esta
   instancia — ya está.
3. **Si solo ves la línea de las 04:17**, añade la nueva, sin tocar la que ya
   está:
   ```bash
   cat <<'CRON' >> /etc/cron.d/space-os-update
   */15 * * * * root /opt/space-os/update.sh --comprobar >> /var/log/space-os/cron.log 2>&1 || [ $? -eq 75 ]
   CRON
   ```
4. Comprueba que quedaron las dos líneas y que cron la recogió (no hace falta
   reiniciar cron para `/etc/cron.d/`, lo relee solo):
   ```bash
   cat /etc/cron.d/space-os-update
   ```
   **Debe salir exactamente dos líneas de `update.sh`**: la de `17 4 * * *` y
   la de `*/15 * * * *`. Si el archivo trae la línea nueva **duplicada**,
   bórrala a mano dejando una sola — el `>>` de arriba no comprueba si ya
   estaba.

---

## Paso 4 · La pasada visual de la pantalla

**Por qué:** nadie la ha mirado con ojos todavía. Los implementadores de las
tareas 1-6 no tienen navegador — lo verificado es la lógica (`decidirActualizacion`,
las pruebas del endpoint) y los seis estados por API (`textoDeEstado()` en
`actualizaciones-ui.ts`, con sus pruebas). Lo que falta es maquetado, color, y
que el clic sobre «Instalar» de verdad abra el diálogo de confirmación.

**Cómo, y por qué NO con `next dev`:**

```bash
cd apps/web
npm run build
npm start
```

**No uses `npm run dev`.** La CSP del proyecto no lleva `unsafe-eval`, y en
modo desarrollo Next la necesita — el síntoma es que el botón de login queda
muerto **sin dar ningún error visible**, y lo mismo le pasaría a esta pantalla.
Está documentado en `CLAUDE.md` del repositorio.

**Qué revisar una vez dentro** (Administración → Configuración → tarjeta
Actualizaciones):

- Que los cuatro datos (instalada, disponible, migraciones, comprobado) se
  vean legibles y con el formato de fecha correcto.
- Que el botón «Con aprobación» / «Automática» cambie el modo y el toast lo
  confirme.
- Que, con una novedad disponible y en modo `aprobacion`, aparezca el botón
  «Instalar», y que al hacer clic **se abra el diálogo de confirmación** con
  el número de migraciones y el aviso del corte de servicio — no que instale
  directo.
- Que sin permiso de `administracion:ver` la tarjeta explique por qué está
  oculta, en vez de desaparecer sin más.

Como no hay una instancia real con una versión nueva disponible a mano, para
ver el botón «Instalar» hace falta forzar un `digest_disponible` distinto del
instalado a mano en la base de pruebas local — nunca en una instancia real.

---

## Paso 5 · Decidir la asimetría de códigos según la hora — antes de activar el cron en producción

**Por qué está aparcado, no olvidado:** con `--comprobar` (cron cada 15 min),
una tabla `actualizaciones_instancia` **ilegible** (no ausente: ilegible —
base caída, credencial mala, permiso roto) hace que `update.sh` aborte de
inmediato con código **1** (`EX_CONFIG`), a propósito, para no dar 96 verdes
al día con un problema real sin resolver. Pero en la corrida **programada**
(04:17, sin bandera), el mismo síntoma **no aborta ahí**: el código sigue de
largo («se sigue con el comportamiento de antes del ADR 0037», literal en
`infra/scripts/update.sh`) hasta que, más adelante en el mismo guion, falla
otra cosa que sí depende de leer la base — típicamente el respaldo o la huella
antes de migrar.

**Por qué importa, y qué hay que decidir:** una tabla ilegible **solo en esa
columna/permiso**, con el resto de la base sana, podría dejar que la corrida
programada complete un respaldo válido y siga adelante **sin haber podido leer
`modo` ni `aprobado_digest`** — es decir, sin honrar la elección del dueño esa
noche. Las preguntas que le tocan a una persona, no a este commit:

1. ¿La corrida programada debe abortar tan pronto como `--comprobar` cuando la
   tabla es ilegible, aunque eso signifique parar una actualización de
   madrugada por un problema que podría ser solo de esa tabla?
2. ¿O se acepta el riesgo de hoy —que siga de largo y falle más adelante si de
   verdad la base está mal— a cambio de no volver más frágil la corrida que
   sostiene el resto de la flota?

Ninguna de las dos es obviamente correcta, y es una decisión de producto sobre
tolerancia a fallos, no una que se deba tomar escribiendo código sin que
alguien la firme primero.

---

## Paso 6 · ~~`docker build` nunca se corrió~~ — CERRADO el 2026-09-22

> [!success] Medido, no leído: la imagen se construyó y el módulo está dentro
> `docker build -t space-os-prueba-0037 .` terminó **en verde** (manifest list
> `sha256:9f796cb9…`), y dentro del contenedor:
>
> ```
> $ docker run --rm --entrypoint sh space-os-prueba-0037 -c "ls -la /app/scripts/"
> -rwxr-xr-x 1 node node  1547 Sep 21 22:20 actualizaciones.mjs
> -rwxr-xr-x 1 node node 41324 Aug 31 22:25 migrar.mjs
> ```
>
> Y el `import()` que hace la sonda de `update.sh`, ejecutado de verdad ahí
> dentro, devuelve `MODOS, decidirActualizacion`. **El punto único de fallo de
> toda la función queda comprobado por construcción**, no por lectura. Lo de
> abajo se conserva como explicación de por qué este paso existía.



La línea que copia `scripts/actualizaciones.mjs` a la imagen (`Dockerfile:117`)
está verificada **solo por lectura** — nadie ha construido la imagen de verdad
con este cambio dentro. Si esa copia fallara (por ejemplo, por una ruta mal
escrita), la sonda de `update.sh` no encontraría el módulo dentro del
contenedor y moriría con `ENOENT` en la primera corrida que jalara la imagen
nueva — un fallo que solo aparece al construir, nunca al leer el archivo.

**Qué hacer:** antes de publicar la próxima versión (el siguiente
`release.yml`), confirmar que el build de la imagen termina sin error y que,
dentro del contenedor, existe `/app/scripts/actualizaciones.mjs`:

```bash
docker build -t space-os-prueba .
docker run --rm space-os-prueba ls -la /app/scripts/actualizaciones.mjs
```

No hace falta hacerlo como paso aislado si de todas formas se va a publicar
una versión pronto: el primer `release.yml` real después de esta tarea ya lo
construye. Pero si pasan varias tareas antes de la siguiente publicación,
conviene no dejarlo para el día de la primera imagen de cliente.

---

## Paso 7 · Medir el coste de los 96

El dueño del producto decidió que los reportes al PADRE (`reporte de flota`) y
las subidas de log siguen ocurriendo en cada corrida de `update.sh`, incluida
`--comprobar`. Con el cron nuevo eso pasa de **1 corrida al día** por instancia
a **96** (una cada 15 minutos). Es aritmética, no una medición: **nadie ha
visto todavía qué hace el buzón que recibe esos 96 reportes al día** — si el
PADRE los procesa sin problema, si el panel de flota los acumula de forma
razonable, o si 96 entradas diarias por instancia empiezan a notarse en algún
sitio (disco, ruido en el panel, cuota de algún servicio externo).

**Qué hacer, al activar el cron en producción (no antes, no es bloqueante):**

- Revisar, tras uno o dos días con el cron nuevo activo en al menos una
  instancia, cuántos reportes llegaron al PADRE y si `apps/flota` los muestra
  de forma útil o simplemente los acumula.
- Si el volumen molesta, la palanca ya existe y no hace falta código nuevo:
  se puede espaciar el cron de `--comprobar` (por ejemplo, cada 30 minutos en
  vez de 15) sin tocar ninguna de las cuatro piezas del ADR.

---

## Paso 8 · Un síntoma que hay que saber reconocer: «se instalará en los próximos minutos» PARA SIEMPRE

**Qué se vería:** la pantalla de Administración dice *«Aprobaste vX.Y.Z: se
instalará en los próximos minutos, o de madrugada a más tardar»*, y pasan las
horas, y los días, y no se instala nunca. Ningún error. El log de
`update.sh --comprobar` dice `sin cambios` una y otra vez.

**Por qué pasa, en una frase:** dentro de `update.sh` hay **dos identidades
distintas de la misma imagen**, y el corte de «no hay nada que hacer» usa una
mientras la pantalla y la decisión del dueño usan la otra. El corte compara el
**Id** de la imagen; la sonda, la pantalla y la aprobación comparan el
**RepoDigest**. Si una imagen cambia de RepoDigest **sin** cambiar de Id, la
sonda anota el digest nuevo (la pantalla ofrece «Instalar»), el dueño aprueba,
y el corte de `sin cambios` sale **antes** de llegar al bloque que consumiría
esa aprobación. **La aprobación no se consume nunca.**

**No es teórico, y ya pasó en este proyecto:** reetiquetar con
`imagetools create` no reescribe la imagen, la envuelve en un índice nuevo —
digest distinto, mismo contenido. Está documentado en el `CLAUDE.md` del
repositorio, en el aviso del 2026-09-02 sobre `v0.1.0` y la promoción a
`estable` (`beta` era `manifest.v2+json` y `estable` un `manifest.list.v2+json`
envolviéndola). Desde entonces se reetiqueta con `crane copy`, que sí reescribe
los mismos bytes, pero **nada impide que vuelva a ocurrir por otra vía**.

**Cómo confirmarlo antes de tocar nada** (en la instancia afectada):

```bash
docker image inspect --format '{{.Id}}' "$IMAGEN"
docker image inspect --format '{{index .RepoDigests 0}}' "$IMAGEN"
sudo -u postgres psql -d spaces -c "select digest_instalado, digest_disponible, aprobado_digest from actualizaciones_instancia;"
```

Es este caso si **`digest_instalado` ≠ `digest_disponible` = `aprobado_digest`**
y aun así el log dice `sin cambios` (el `Id` no se movió).

**Remedio a mano, y es una sola línea** — borra la aprobación que nunca se va a
consumir, con lo que la pantalla deja de mentir y vuelve a pedir aprobación:

```bash
sudo -u postgres psql -d spaces -c "update actualizaciones_instancia set aprobado_digest = null;"
```

> [!warning] Esto es un parche, no el arreglo
> El arreglo de verdad es que el corte de `sin cambios` refresque
> `digest_instalado` cuando el `Id` coincide, para que las dos identidades no
> puedan discrepar. **No se hizo en esta ola a propósito:** ese corte está en el
> camino de **todas** las corridas de **todas** las instancias —las 95 de cada
> 96 pasan por ahí— y tocarlo junto a una ola de arreglos de prosa habría sido
> cambiar el camino caliente sin una corrida real de por medio. Queda propuesto
> en el informe de la ola y sin aplicar.

---

## Resumen — qué NO tiene red todavía

- Nadie ha corrido `update.sh --comprobar` contra un Postgres real (paso 2).
- Nadie ha mirado la pantalla con un navegador (paso 4).
- ~~Nadie ha corrido `docker build` con este cambio dentro (paso 6).~~ **Hecho
  el 22/09**: la imagen construyó en verde, `/app/scripts/actualizaciones.mjs`
  existe dentro del contenedor y el `import()` de la sonda devuelve
  `decidirActualizacion`.
- **El `update.sh` nuevo no está en ninguna instancia** y no llega solo: vive
  en el anfitrión y solo lo escriben el instalador y el aprovisionador (paso
  0). Hasta que alguien lo copie, **este ADR no tiene ningún efecto** sobre
  DEMO ni g500, y el cron del paso 3 les daría `exit 1` cada 15 minutos.
- La migración de la tabla todavía no llegó a `main` ni a ninguna instancia:
  hoy DEMO y g500 corren sin ella y siguen actualizándose como siempre. La
  migración **por sí sola no congela nada** —el `update.sh` viejo ni la lee—:
  el congelamiento empieza cuando conviven la tabla **y** el `update.sh` nuevo,
  o sea a partir del paso 0, y hasta que alguien corra el paso 1.
- El cron nuevo no existe todavía en ninguna instancia ya aprovisionada hasta
  que alguien corra el paso 3 — **y el paso 3 depende del paso 0**.
- El fantasma de «Id contra digest» (paso 8) **no tiene arreglo en el código**:
  hay un remedio a mano y un síntoma descrito, nada más.

Ningún paso de esta tarjeta se ejecutó al escribirla. Se escribió para que la
corra una persona con acceso a los droplets — la propia regla de este
repositorio para todo lo que toque un servidor.

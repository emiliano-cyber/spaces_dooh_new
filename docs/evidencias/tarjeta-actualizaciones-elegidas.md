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
> y una imagen real. Los pasos 1 a 3 de abajo son justo eso.

---

## Paso 1 · Fijar el modo en las instancias que YA existen — el que más duele si se olvida

**Por qué:** la tabla `actualizaciones_instancia` nace con `modo = 'aprobacion'`
por diseño (el dueño decide, nunca se le salta), y la migración **no tiene
forma de distinguir** una instancia recién nacida de una que lleva meses
corriendo. **Esto todavía NO está pasando hoy** (2026-09-22): la migración
`20260921_actualizaciones_instancia.sql` vive solo en esta rama —no en
`main`—, así que DEMO y g500 corren sin la tabla y siguen actualizándose como
siempre. El riesgo empieza **el día que una versión con esa migración llegue
a esas instancias**: desde ese momento, sin este paso, **DEMO y g500
dejarían de actualizarse en silencio** — ningún error, ningún aviso, nada en
un log que alguien vaya a mirar. Se quedarían esperando una aprobación que
nadie sabe que hace falta dar. Por eso este paso va **antes de publicar esa
versión, o justo después**, no en un momento cualquiera.

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

## Paso 6 · `docker build` nunca se corrió

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

## Resumen — qué NO tiene red todavía

- Nadie ha corrido `update.sh --comprobar` contra un Postgres real (paso 2).
- Nadie ha mirado la pantalla con un navegador (paso 4).
- Nadie ha corrido `docker build` con este cambio dentro (paso 6).
- La migración de la tabla todavía no llegó a `main` ni a ninguna instancia:
  hoy DEMO y g500 corren sin ella y siguen actualizándose como siempre. **El
  día que una versión con esa migración les llegue**, nacerán en
  `modo = 'aprobacion'` por defecto — y desde ese momento, hasta que alguien
  corra el paso 1, **se congelarán en silencio**.
- El cron nuevo no existe todavía en ninguna instancia ya aprovisionada hasta
  que alguien corra el paso 3.

Ningún paso de esta tarjeta se ejecutó al escribirla. Se escribió para que la
corra una persona con acceso a los droplets — la propia regla de este
repositorio para todo lo que toque un servidor.

# `infra/scripts/` — los scripts que corren EN un servidor

Aquí no hay código de la aplicación: hay lo que se ejecuta en una máquina, con
raíz, para poner o mantener una instancia en pie.

| Script | Modelo | Qué hace |
|---|---|---|
| **`update.sh`** | **instancias soberanas** | **Una instancia se actualiza sola: jala su canal del registry, respalda, migra, conmuta y se devuelve si la salud falla.** |
| **`respaldo.sh`** | **instancias soberanas** | **El respaldo sale del droplet: lo sube a Spaces y poda el disco. Lo *sourcea* `update.sh`; también se llama a mano.** |
| `setup-droplet.sh` | anterior | Prepara un Ubuntu 22.04 desde cero (nginx, node, pm2) |
| `deploy.sh` | anterior | Despliegue manual **por SSH**, compilando en el servidor |
| `new-tenant.sh`, `setup-first-tenant.sh`, `migrate-all-tenants.sh` | anterior | Alta y migración de tenants dentro de un único droplet compartido |

> [!warning] Los cuatro de abajo son del modelo que se sustituyó el 2026-08-12
> Se conservan porque el droplet de hoy todavía vive de ellos. El camino que
> **entra por SSH a compilar** se retira en F3.6 (`deploy.yml`), y el
> aprovisionamiento del modelo nuevo llega en la Fase 5. Ver
> `vault/01-Arquitectura/modelo-instancias-soberanas.md`.

---

## `update.sh`

> **El padre no aparece por ningún lado.** Este script habla con el registry de
> imágenes y con su propia base. Con nadie más. Nadie entra por SSH desde fuera
> para desplegar: **la instancia jala**.

### Cómo se usa

```bash
/opt/space-os/update.sh --dry-run     # mira y cuenta. NO toca nada
/opt/space-os/update.sh               # actualiza de verdad
/opt/space-os/update.sh --simular-fallo-pull   # ensaya los reintentos (§ abajo)
tail -n 40 /var/log/space-os/update.log
```

**El `--dry-run` es obligatorio la primera vez en cada instancia.** Respuestas:

| El log dice | Significa |
|---|---|
| `sin cambios` | la instancia ya corre esa versión; no había nada que hacer |
| `pull v0.4.2 -> 3 migraciones pendientes` | hay actualización, y cuántas migraciones trae |
| cualquier mención a **`BACKUP VACIO`** | **no seguir.** Avisar a una persona |

### Qué hace, en orden

1. Lee su canal y su registry de `/etc/space-os/instancia.env`.
2. `docker pull` —con **3 reintentos** y espera creciente, ver «Qué se
   reintenta»— y **compara el digest** con el que corre. Igual → sale 0 sin
   tocar nada.
3. **Respaldo** `pg_dump -Fc`, y comprueba que **no esté vacío**. Sin respaldo
   bueno, el update se detiene ahí **y borra el archivo de 0 bytes**: si se
   quedara, en un `ls` del directorio parecería un respaldo más —mismo nombre,
   misma extensión, más reciente que el bueno— y restaurar «el último» bajo
   presión sería restaurar la nada. El criterio está copiado de
   `.github/workflows/deploy.yml:117-125`: *un `pg_dump` que falla deja un
   archivo de 0 bytes y su salida se ve casi igual que la de uno bueno.*
   Con el dump bueno delante, y solo entonces, **poda el disco a 3 respaldos y
   sube el nuevo a Spaces** (§7). Si la subida falla, **el update sigue** y el
   log dice `RESPALDO REMOTO FALLIDO`.
4. Anota la versión que corría en `/var/lib/space-os/version-anterior`.
5. Toma la **huella** de la base, corre `migrar.mjs` **con las migraciones de
   la imagen nueva**, vuelve a tomar la huella, y **solo entonces** conmuta el
   tráfico al contenedor nuevo. Ahí hay corte: ver **§4, la ventana**.
6. **Health check** 10 × 3 s contra `SALUD_URL`.
7. Si la salud falla: vuelve al contenedor anterior, restaura el dump **solo si
   la huella dice que la base cambió** (§3), y sale ≠ 0 dejando el motivo en el
   log.
8. Lo lanza `cron` una vez al día, con `flock`.

### Códigos de salida — no son intercambiables

| Código | Qué pasó | ¿Hay que ir a mirar la base? |
|---|---|---|
| `0` | sin cambios, o actualizada y sana | no |
| `1` | no se pudo ni empezar: falta configuración, falló el pull, **el respaldo salió vacío**, no se pudo leer la huella de la base (§3), o el runner se negó a arrancar | no: **nada se tocó** |
| `2` | las migraciones fallaron a medias o no se pudieron registrar | **el log lo dice, medido contra la base** (§3): `LA BASE CAMBIO` = sí; `la base NO cambio` = no |
| `3` | el registro de la base y las migraciones de la imagen **no cuentan la misma historia** | no: **no se aplicó nada** |
| `4` | la salud falló y **la vuelta atrás salió bien** — la instancia sirve la versión anterior | no, pero hay que mirar el release |
| `5` | la salud falló y **la vuelta atrás no**. **La instancia queda SIN servicio** y el mensaje del log trae el **comando exacto** que la devuelve (§6) | **sí, urgente** |
| `75` | ya había otro update en marcha (candado) | no |

Los códigos 1, 2 y 3 vienen tal cual de `scripts/migrar.mjs:21-32`. Aplanarlos
todos en «falló» —que es lo que hace un `set -e` distraído— borraría justo la
información que decide si hay que ir a mirar la base: con un **2** la base ya
cambió y el registro puede no saberlo; con un **3** no se aplicó nada.

Y cuando el runner **se niega a arrancar** —por ejemplo, una base con datos y
sin `schema_migrations`, que es el estado del droplet de hoy— su mensaje dice
exactamente qué comando hace falta. `update.sh` **lo vuelca al log en vez de
tragárselo**: es accionable.

### Configuración: `/etc/space-os/instancia.env`

La escribe el aprovisionamiento (Fase 5). Lleva credenciales: **0600 y de
root** — el script avisa si no lo está.

| Clave | Obligatoria | Para qué |
|---|---|---|
| `CANAL` | sí | `estable` o `beta`. Cualquier otra cosa detiene el script |
| `REGISTRY` | sí | de dónde se jala la imagen |
| `DATABASE_URL` | sí (*) | conexión **privilegiada**: migraciones y respaldo. **No** es la de la app (`spaces_app` no tiene DDL) |
| `IMAGEN_NOMBRE` | no | `space-os` |
| `CONTENEDOR` | no | `space-os` |
| `ENV_APP` | no | `/etc/space-os/app.env`, las variables de la app |
| `DOCKER_OPCIONES_APP` | no | `--publish 127.0.0.1:3000:3000` |
| `RED_MIGRACION` | no | `host` |
| `SALUD_URL` | no | `http://127.0.0.1:3000/spaces-dooh/api/auth/metodos/` |
| `SALUD_INTENTOS` / `SALUD_ESPERA` | no | `10` y `3` |
| `PULL_ESPERAS` | no | `1 5 30`: una espera **por reintento** del `pull`, en segundos. Vacío = ningún reintento. Medido el 18/08: un valor que no sean números **no rompe el update** —`sleep` protesta por stderr, no espera, y el `pull` se rinde igual sin tocar nada— pero tampoco hay backoff |
| `RUNNER_MIGRACIONES` | no | `/opt/space-os/migrar.mjs` (ver el aviso 1) |
| `PG_DUMP` / `PG_RESTORE` | no | rutas, si conviven varias versiones de Postgres |
| `INSTANCIA` | no (*) | el prefijo de esta instancia dentro del bucket de respaldos. Si falta, se usa el `hostname -s` |
| `SPACES_KEY` / `SPACES_SECRET` | no (*) | la llave de Spaces. **Una por instancia y con permiso solo sobre su prefijo.** Sin ellas no hay respaldo fuera del droplet, y el log lo dice |
| `SPACES_BUCKET` | no | `space-os-respaldos` |
| `SPACES_REGION` | no | `nyc3`; de ahí sale el endpoint `https://nyc3.digitaloceanspaces.com` |
| `SPACES_ENDPOINT` | no | se calcula de la región; existe para poder apuntar a otra cosa al ensayar |
| `SPACES_CLIENTE` | no | `auto` (prefiere `s3cmd`), `s3cmd` o `aws` |
| `RESPALDOS_LOCALES` | no | `3` respaldos en el disco, los 3 **más recientes por la fecha del archivo** (no por su nombre: §7). **Nunca menos de 1**: con 0 se borraría el de la corrida en marcha |

(*) Si falta, se toma la de `ENV_APP` y se avisa. Y si **las dos** existen y
apuntan a **bases distintas**, el script se para: migrar una base mientras la
app habla con otra no da ningún error, deja dos bases a medias.

### La ruta de salud

`SALUD_URL` apunta a `/spaces-dooh/api/auth/metodos/` y **no** a
`/api/version`, porque `/api/version` todavía no existe (llega en F6.1).
`metodos` es pública, sin sesión y sin datos de negocio. Vive en **una sola
variable** para que F6.1 la cambie en una línea. Es la misma ruta que usa el
smoke de `.github/workflows/promover.yml`, y por el mismo motivo.

**El código HTTP se lee con cuidado, porque es el que decide si se restaura la
base.** `curl -w '%{http_code}'` imprime un código *pase lo que pase* —`000` si
no hubo respuesta—, así que un `|| echo 000` detrás **concatenaría un segundo
código**. Con un fallo de conexión eso solo se ve feo en el log
(`intento 1/5 -> 000000`); pero cuando `curl` alcanza a leer el **200** y luego
sale ≠ 0 —un `--max-time` agotado a mitad del cuerpo, un contenedor recién
arrancado y lento— la variable valdría `200000`, no casaría con `200`, y un
release **sano** acabaría tirado por una vuelta atrás que además pierde lo
escrito desde el respaldo. Por eso la salida y el código de salida de `curl` se
recogen **por separado**: lo que imprimió es el valor, y si no imprimió nada,
`000`.

### Qué se reintenta, y qué no

| Paso que falla | Reintentos | Espera | Qué pasa al agotarse |
|---|---|---|---|
| `docker pull` | **3** | 1 s, 5 s, 30 s | aborta **antes de tocar la base** y sale `1` |
| **migración** | **0** | — | se para en el sitio (códigos `2` o `3`). **Nunca se repite** |
| health check | 10 | 3 s | vuelta atrás al digest anterior (códigos `4` o `5`) |

**La fila que importa es la de en medio.** Reintentar un `pull` es gratis:
todavía no hay respaldo, ni contenedor parado, ni una sola sentencia contra la
base, así que rendirse deja la instancia **exactamente** como estaba. Reintentar
una **migración** es lo contrario: una migración que murió a la mitad dejó la
base en un estado que su segunda corrida no espera, y repetirla a ciegas es como
se corrompe una base. Por eso el límite ahí es **cero**, y está probado
contando llamadas al runner, no leyendo el log (`pruebas-update.sh`, E36 y E37).

Cada reintento sale **numerado** en el log —`reintento 2/3`—, así que se puede
contar desde fuera sin leerlo entero:

```bash
grep -c reintento /var/log/space-os/update.log
```

Para **ensayar** la política en una instancia de verdad sin cortarle la red al
droplet está `--simular-fallo-pull`: el `pull` falla a propósito —ni se llama a
`docker`, así que tampoco depende del registry—, se ven los tres reintentos con
sus esperas y el script sale `1` **sin respaldar, sin migrar y sin tocar el
contenedor**. Tarda los 36 s del backoff. Las esperas se pueden cambiar desde
`instancia.env` con `PULL_ESPERAS`.

> [!note] La cuarta fila de la política todavía **no existe**
> El plan (F3.8) también describe el **reporte al padre**: 2 reintentos, 5 s y
> 30 s, se guarda en disco si no llega y **nunca aborta el update**. Ese reporte
> es **F6.4** y no está escrito: aquí queda la política, no la implementación.

### El cron

```cron
# /etc/cron.d/space-os-update
17 4 * * *  root  /opt/space-os/update.sh >/dev/null 2>&1
```

El candado lo toma **el propio script** (`flock -n` sobre
`/var/lock/space-os-update.lock`), así que también protege a la corrida que
alguien lance a mano mientras el cron está dentro. Mismo criterio que
`concurrency: deploy-produccion` (`deploy.yml:56-58`): **el que ya está dentro
no se cancela**, porque cortar a mitad de una migración es peor que esperar.
Si `flock` no está instalado, el script **no corre**.

---

## Siete cosas que hay que saber antes de tocarlo

### 1 · El runner de migraciones NO viaja en la imagen

El plan manda correr `node scripts/migrar.mjs` **dentro de la imagen nueva**,
pero `Dockerfile:94-95` copia `db/schema.sql` y `db/migrations` y **no copia
`scripts/`**. Comprobado: `docker run --rm space-os:dev ls /app` devuelve
`apps  db  node_modules  package.json`.

Mientras siga así, `update.sh` **monta** el runner de la instancia dentro del
contenedor efímero, en `/app/scripts/migrar.mjs`. Funciona porque el runner
resuelve sus rutas **desde su propio archivo** y no desde el directorio de
trabajo (`scripts/migrar.mjs:43-48`): montado ahí,
`/app/scripts/../db/migrations` son **las migraciones de la imagen**, que es lo
que la tarea exige. Medido: montado contesta `67 pendientes` —las 67 que la
imagen lleva dentro— mientras el repositorio ya tiene 68. Sin montar, el
contenedor muere con `MODULE_NOT_FOUND`.

**El costo, escrito para que nadie lo descubra tarde:** así el runner queda
versionado con el **aprovisionamiento** y no con la imagen. Una instancia
aprovisionada antes de F3.3 seguiría migrando **sin la comprobación de
checksum** aunque jale imágenes nuevas. El arreglo duradero es una línea
`COPY scripts/migrar.mjs ./scripts/migrar.mjs` en el `Dockerfile` — que es
**F2.2, ya auditada**, y no se toca desde aquí. `update.sh` ya lo prevé: si la
imagen **trae** el runner, no monta nada y usa el de dentro.

### 2 · Qué pasa con `schema_migrations` al volver atrás

El respaldo es de la base **entera**, así que `schema_migrations` viaja dentro
del dump. Restaurarlo devuelve **a la vez** el esquema y el registro al mismo
instante: la instancia vuelve a afirmar exactamente las migraciones que la
imagen anterior lleva dentro, y la comprobación de checksum de F3.3 no tiene de
qué quejarse.

Si la restauración **no** llega a correr —porque no corrió ninguna migración, o
porque falló— el registro se queda nombrando migraciones cuyo archivo la imagen
anterior **no tiene**. Eso **no aborta nada**, y es a propósito: F3.3 dejó ese
caso fuera precisamente porque *una imagen anterior carece por definición de las
migraciones nuevas que su registro afirma*, y abortar ahí rompería esta vuelta
atrás. El runner las trata como aplicadas y no las toca.

> [!warning] Restaurar el dump pierde lo que se haya escrito desde el respaldo
> Por eso solo se hace en el camino de vuelta atrás, y **solo si la base
> cambió**. Cuando el runner sale **2** —la base cambió pero el tráfico **no**
> se conmutó— el script **no restaura**: la versión anterior está sirviendo, con
> clientes dentro, y un `pg_restore --clean` sobre una base viva tumbaría una
> instancia que en ese momento funciona. Se para y se avisa; el dump queda ahí
> para quien decida usarlo.

### 3 · Cómo sabe el script si la base cambió: **preguntándoselo a la base**

Esto se arregló el 17/08, en el segundo ciclo de F3.4, después de que la
auditoría lo pusiera en **rojo**. La primera versión lo deducía leyendo la
**prosa** del runner con un `sed`, y fallaba en los dos sitios donde importaba:

| Lo que imprime `scripts/migrar.mjs` | Lo que hacía el `sed` |
|---|---|
| `67 aplicadas, 1 de datos pendientes.` (`:694-696`, en cuanto hay una migración `@tipo: datos` pendiente — y la hay: `db/migrations/20260731_calendario_meses_cortos.sql`) | no casaba → la cuenta caía a **0** → **la vuelta atrás no restauraba la base** |
| `ERROR migrar: se aplicaron 66 migraciones y no se pudieron registrar…` (`:670-678` y `:687-692`) | no casaba → el log decía *«no consta ninguna migración aplicada; suele ser que no pudo conectar»*, justo debajo del mensaje que decía lo contrario |

La lección no era afinar el patrón: **la redacción de otro programa no puede ser
la fuente de verdad de una decisión que lanza `pg_restore --clean`.** Así que el
script ya no cuenta migraciones leyendo texto. Toma una **huella** de la base
*antes* y *después* de migrar y compara:

- **Qué entra en la huella:** columnas (con sus `DEFAULT`), índices,
  restricciones, políticas RLS, funciones — y el contenido de
  `schema_migrations`.
- **Funciona aunque `schema_migrations` no exista**, que es el caso de
  `migrar.mjs:687-692` y es alcanzable **hoy**: la imagen no lleva
  `20260812_schema_migrations.sql`. El hash del esquema ya es distinto.
- **No se mueve con el tráfico normal**: un `insert` de la versión anterior, que
  sigue sirviendo entre las dos lecturas, no cambia ninguna de esas cinco cosas.
  Comprobado contra Postgres real.
- **Si la huella no se puede leer *antes* de migrar, el update se para** (código
  1) sin migrar: sin punto de partida no hay decisión de vuelta atrás
  defendible.
- **Si no se puede releer *después*, se restaura igual**, por prudencia: dejar la
  versión vieja sobre un esquema nuevo es el fallo silencioso que nadie denuncia
  después.

La lee `node` con el `pg` **de la misma imagen**, por la misma red y con la misma
`DATABASE_URL` que el runner: si la sonda lee la base, el runner también.

El número de migraciones que aparece en el log es la diferencia de filas de
`schema_migrations` (o `?` si la tabla no existe) y es **informativo**: la
decisión cuelga de la huella, no del número.

### 4 · La ventana: durante la conmutación la instancia **no responde**

Conmutar es `docker stop` + `docker run`, no un cambio de puerto en caliente.
Hay corte, y conviene tenerlo escrito en vez de descubrirlo:

| Caso | Corte |
|---|---|
| Release bueno | ~10-20 s (`stop` espera hasta 10 s al `SIGTERM` + arranque) |
| Release malo | hasta ~3 min: `SALUD_INTENTOS × (5 s de --max-time + SALUD_ESPERA)` = 80 s de sondeo, luego el `pg_restore`, luego **otro** sondeo igual sobre la versión anterior |

Por eso el cron va a las 4 de la mañana. El *«el owner no se entera»* del
criterio de aceptación de F3.4 hay que leerlo como **«se queda en la versión
anterior y no pierde datos»**, no como «no hay corte». Cerrar la ventana de
verdad —arrancar el contenedor nuevo en otro puerto y mover nginx cuando ya
conteste— es otra tarea; aquí se documenta, no se disimula.

### 5 · La contraseña no viaja en `argv`

`pg_dump --dbname="postgresql://usuario:clave@…"` deja la clave visible en `ps`
para **cualquier** usuario de la máquina. `deploy.yml:119` lo evita con
`sudo -u postgres` (autenticación *peer*, sin clave); aquí la conexión es por
red, así que el script parte la URL: usuario y destino en `argv`, clave por
`PGPASSWORD`. Si la contraseña trae una barra invertida sin codificar el script
**avisa y no la toca** —decodificarla podría corromperla, y un respaldo que no
corre es peor—; codifícala como `%5C` en `instancia.env` y el aviso se va.

> [!note] El respaldo **ya no se queda solo en el droplet**, y el disco sí se poda
> Esta nota decía que nadie podaba y que sacarlo de la máquina era «materia de
> F3.7». F3.7 está hecha (18/08): el paso 3 poda a **3 respaldos locales** y sube
> el nuevo a Spaces. Lo que hace cada cosa, y por qué la retención local y la
> remota se podan por caminos distintos, está en **§7**.

### 6 · Un código `5` deja la instancia **caída**: cómo devolverle el servicio

Todas las salidas con `5` dicen **«La instancia queda SIN servicio»** —la
última, cuando la versión anterior tampoco contesta, dice «la instancia está
caída»—. Y las **dos** que se van por la restauración —no hay `pg_restore`, o
falló— traen además el **comando exacto** de rescate: son las únicas en las que
el script se para **antes de haber intentado** levantar nada, y es lo que
alguien va a leer a las cuatro de la mañana, no el momento de reconstruir de
memoria cómo se levantó el contenedor.

En ese punto el contenedor nuevo ya se retiró y el viejo está **parado y
aparcado** como `${CONTENEDOR}-anterior` — conserva puertos, `--env-file`, red y
política de reinicio, así que devolverlo es renombrarlo y arrancarlo:

```bash
docker rename space-os-anterior space-os && docker start space-os
```

Medido en el ensayo local: tras un código `5` el contenedor de la app **no
existía**, el `-anterior` estaba parado y la salud daba `000`; con ese comando
volvió en **8 s**. El script lo calcula en vez de escribirlo fijo: si el
`rename` del paso 5b **no** llegó a hacerse, el contenedor viejo conserva su
nombre y el mensaje dice `docker start space-os` a secas.

> [!warning] El rescate devuelve el servicio, **no** resuelve el estado de la base
> En los dos códigos `5` que salen de la restauración —no hay `pg_restore`, o
> falló— eso levanta la versión **anterior** sobre una base que **ya tiene las
> migraciones nuevas**. Es un parche para que la instancia responda mientras
> alguien mira; el dump está en `/var/lib/space-os/respaldos/`.

---

### 7 · El respaldo **sale** del droplet, y el disco no se llena

`update.sh` guardaba el `pg_dump` en el disco de la propia instancia. Eso sirve
para la vuelta atrás de un release malo —que es su trabajo— pero **no sirve para
nada si el droplet desaparece**, y ese escenario es *más* probable con el modelo
de instancias, no menos: son muchos droplets pequeños en vez de uno cuidado.

Desde F3.7 el paso 3 hace tres cosas, y la lógica vive en **`respaldo.sh`**, que
`update.sh` *sourcea*. **Si `respaldo.sh` no está al lado, el update se para
antes del `pull`**: actualizar sin respaldo fuera del droplet y sin podar el
disco no es lo que este script promete.

> [!important] La asimetría de la retención es deliberada
> | | Cuánto | Quién lo borra |
> |---|---|---|
> | **Local** | **3 respaldos** | **este script** |
> | **Remoto** | **30 días** | **la regla de ciclo de vida del bucket**, no el script |
>
> En `respaldo.sh` **no hay ni un solo borrado remoto**, y no es un olvido: *un
> `rm` mal escrito en un script que corre en todas las instancias es una forma
> elegante de perderlo todo a la vez.* Borrar lo viejo del bucket es
> configuración de la cuenta: se hace una vez, la revisa una persona y no viaja
> en cada release. El arnés lo comprueba (E41).

La poda local tampoco es un `rm` con glob: `find -maxdepth 1 -type f -name
'spaces_*.dump'`, **ordenado por la fecha del archivo** (`-printf '%T@'`), y se
retiran los más viejos dejando los N más recientes. Ni subdirectorios, ni
archivos que no casen con el patrón, ni nunca menos de uno. Va **después** de
comprobar que el dump nuevo es bueno: podar antes sería tirar un respaldo viejo
a cambio de nada.

> [!danger] Ordenaba por NOMBRE, y por eso podía borrar el dump de la corrida en marcha
> Corregido el 18/08 (auditoría de F3.7, H1). `sort` ordena **la ruta**, no la
> antigüedad: cualquier dump con otro nombre —`spaces_x.dump`, el que este mismo
> README documenta tres párrafos más abajo para el uso a mano— ordena
> **después** de `spaces_2026…` y contaba como «de los más recientes». El que
> sobraba pasaba a ser **el de la corrida en marcha**.
>
> Y de ahí en cascada: sin ese archivo la subida se salta, el log escribe
> `RESPALDO REMOTO FALLIDO` sin que haya fallado ninguna subida, y si el release
> sale malo el `pg_restore` de la vuelta atrás (§7a) apunta a un archivo que ya
> no existe —instancia sin servicio, sin respaldo local y sin respaldo remoto—.
> Nadie lo había visto porque el arnés **solo sembraba nombres con formato de
> fecha**; ahora lo cazan **E49** y un mutante propio.
>
> La línea de resumen también mentía: contaba los que **iba** a retirar, así que
> con los `rm` fallando decía «3 retirados» con los 6 dumps intactos. Ahora
> cuenta los retirados de verdad y, si no pudo con todos, **devuelve != 0** —que
> es lo que hace útil el `if !` con el que `update.sh` la llama—.

**Ruta remota**, tal cual la fija el plan:

```
s3://space-os-respaldos/<instancia>/<AAAA-MM-DD-HHMM>.dump
```

**Las credenciales no viajan en `argv`**, por lo mismo que la contraseña de
Postgres (§5): `s3cmd --access_key=… --secret_key=…` las deja visibles en `ps`
para cualquier usuario de la máquina. Con `s3cmd` van en un archivo de
configuración temporal, `chmod 600` **antes** de escribir el secreto dentro y
borrado al terminar **y también si el script muere por una señal**: hay un
`trap` para `TERM`, `INT`, `HUP` y `EXIT`, y sin él un `systemctl stop` a media
subida dejaba el archivo con la llave **en el disco** (auditoría de F3.7, H4; lo
caza **E51**). Con la CLI de AWS, por variables de entorno del proceso.

> [!warning] `gsutil` no
> Es el cliente de Google Cloud Storage y **no habla con Spaces**. El plan lo
> avisa expresamente porque es un error fácil de cometer leyendo por encima. Los
> dos clientes que valen son `s3cmd put` y `aws s3 cp --endpoint-url`.

**Si la subida falla, el update sigue.** El respaldo local ya existe y con él se
vuelve atrás; detener la actualización por no poder hablar con el bucket sería
cambiar un problema pequeño por uno grande. Pero **no pasa desapercibida**: el
log escribe

```
RESPALDO REMOTO FALLIDO — el dump se quedo SOLO en este droplet …
```

que es una línea pensada para buscarse con `grep`. Que además salga en el
**reporte de flota** es **F6.4**, que todavía no existe: hoy solo está en el log
de la instancia.

Y si no hay `SPACES_KEY`/`SPACES_SECRET`, no es un fallo: es una instancia sin
respaldo remoto configurado, y el log lo dice con esas palabras
(`respaldo remoto NO CONFIGURADO`) para que se lea como lo que es —**esa
instancia no tiene respaldo fuera del droplet**—.

A mano, sin actualizar nada:

```bash
/opt/space-os/respaldo.sh destino                      # a dónde subiría hoy
/opt/space-os/respaldo.sh subir /var/lib/space-os/respaldos/spaces_x.dump
/opt/space-os/respaldo.sh podar /var/lib/space-os/respaldos 3
```

> [!danger] Lo que no se puede hacer desde el repositorio: **el bucket, la llave
> y la regla de 30 días**
> Nada de esto lo crea un script del repo, y sin ello la subida devuelve `403` y
> el log dirá `RESPALDO REMOTO FALLIDO` en todas las corridas. Lo hace una
> persona, una vez por instancia:
>
> 1. **El bucket**, una sola vez para toda la flota:
>    `s3cmd mb s3://space-os-respaldos` (o desde el panel de DigitalOcean).
> 2. **Una llave por instancia**, con permiso **solo sobre su prefijo**
>    (`demo/*`), nunca la llave maestra de la cuenta. Si se filtra la de una
>    instancia, se pierde esa instancia y no la flota entera.
> 3. **La regla de ciclo de vida de 30 días** sobre el bucket — la poda remota
>    que el script *no* hace:
>    ```bash
>    s3cmd expire s3://space-os-respaldos --expiry-days=30 --expiry-prefix=''
>    ```
>    Comprobar después: `s3cmd info s3://space-os-respaldos` tiene que
>    mencionar la regla. Si no aparece, la revisión de los 30 días no existe y
>    el bucket crece para siempre.
> 4. Escribir `SPACES_KEY`, `SPACES_SECRET` e `INSTANCIA` en
>    `/etc/space-os/instancia.env` (0600, de root) y comprobar con
>    `/opt/space-os/respaldo.sh destino`.
>
> Comprobación de que quedó hecho —el **comando de verificación de F3.7**—:
> ```bash
> s3cmd ls s3://space-os-respaldos/demo/ | tail -3
> ```
> Se esperan las últimas líneas con fecha de hoy. Si sale vacío, la subida no
> llegó: mirar `RESPALDO REMOTO FALLIDO` en `/var/log/space-os/update.log`. Si
> sale `403`, la llave no tiene permiso sobre **ese** prefijo. Si sale
> `NoSuchBucket`, falta el paso 1.

---

## Cómo se verificó (sin tocar ningún servidor)

> [!important] El arnés está **en el repositorio**, y por eso esta sección se
> puede repetir
> La versión anterior de este README afirmaba «18 escenarios y 58
> comprobaciones» y **esos escenarios no estaban en ningún sitio**: nadie podía
> repetirlos, y cuando la auditoría los reconstruyó aparecieron dos agujeros
> (abajo). Una afirmación que no se puede repetir no es una verificación.

```bash
bash -n infra/scripts/update.sh
bash infra/scripts/pruebas-update.sh              # los escenarios
bash infra/scripts/pruebas-update.sh --mutantes   # además, que muerden (~45 min)
```

El arnés no sale a la red, no habla con Docker, no toca ninguna base y **no sube
nada a ningún bucket**: monta dobles POSIX de `docker`, `curl`, `flock`, `sleep`,
`pg_dump`, `pg_restore`, `s3cmd`, `aws`, `chmod`, `rm` y `hostname` en un `PATH`
propio
y mira **qué se les pide**. `sleep` es un doble a propósito: un backoff de
1+5+30 s se comprueba por lo que se **pide**, no por el reloj, o el arnés
tardaría 36 s en cada escenario. `chmod` lo es por otra razón: delega en el de
verdad pero anota la llamada, porque en un sistema de archivos sin permisos POSIX
`stat` devuelve `644` aunque el `chmod 600` se haya ejecutado. Y `rm` también
delega en el de verdad, con un interruptor para que falle **solo** el borrado de
un dump: es la única forma de comprobar que el resumen de la poda cuenta lo que
borró y no lo que se proponía borrar. El resultado del 2026-08-18, y el que
imprime el comando:

```
51 escenarios · 236 comprobaciones · 0 rojas
21 mutantes · 0 escapan
```

Cubre: sin cambios · dry-run · respaldo vacío **y que su archivo de 0 bytes no
se quede en disco** · los cuatro códigos del runner · camino feliz · vuelta
atrás con y sin restauración · vuelta atrás fallida **con su comando de
rescate** · sin versión anterior · candado tomado · dos bases distintas · imagen
con y sin runner dentro · canal inválido · pull fallido · huella ilegible antes
y después · **un `curl` que imprime 200 y sale ≠ 0**, uno que imprime `000` y
sale ≠ 0 y uno que no imprime nada · el padre no aparece · la contraseña no sale
en `argv` · **`--simular-fallo-pull` con sus tres reintentos numerados y la
instancia intacta** · un `pull` que falla de verdad (4 intentos y se rinde) · un
`pull` intermitente que **entra al tercero** y deja seguir el update · la
migración fallida que **no se reintenta**, con los códigos 2 y 3 · **la subida
del respaldo a Spaces con la ruta exacta del plan**, una subida que falla y
**deja seguir el update dejándolo escrito**, la retención de 3 locales, que el
script **nunca borra en el bucket**, que la llave **no sale en `argv`**, el
fallback a `aws s3 cp --endpoint-url`, la instancia sin credenciales, la que no
tiene cliente de S3, el prefijo sacado del `hostname`, **la falta de
`respaldo.sh`, que para el update antes del `pull`** —y, desde la auditoría del
18/08, **que la poda ordene por antigüedad real y no por el nombre** (E49), que su
resumen cuente **lo retirado y no lo que iba a retirar** (E50) y que el temporal
con la llave de Spaces **no sobreviva a un SIGTERM a media subida** (E51)—.

**Se comprueba que las comprobaciones muerden.** **Veintiun** mutantes de una
sola línea —sobre `update.sh` **y, desde F3.7, también sobre `respaldo.sh`**—, y
cada uno se **valida antes de correrlo** —diff de exactamente una línea, mismo
número de líneas, `bash -n` limpio— porque un ciclo anterior tuvo un falso verde
por un `sed` que dejó el archivo vacío y «pasó». Dos de ellos son justo los que
el arnés viejo **no** cazaba:

| Mutante | Qué rompería en un servidor |
|---|---|
| quitar `export DATABASE_URL` | `docker run --env DATABASE_URL` no pasa nada y **todas** las migraciones fallan |
| `pg_restore` sin `--clean --if-exists --single-transaction` | la vuelta atrás muere objeto por objeto en vez de volver |
| quitar el guard del respaldo vacío | se actualiza sin red |
| restaurar siempre / no restaurar nunca | los dos lados de la decisión de la vuelta atrás |
| retirar el contenedor nuevo por **nombre** | si el `rename` falló, borra el contenedor **viejo** |
| devolver el `\|\| echo 000` al `curl` de la salud | un `200` con salida ≠ 0 se lee `200000`: **tira un release sano** y restaura la base |
| dejar el `pull` sin reintentos | un parpadeo de red deja la instancia sin actualizar |
| aplanar la espera del backoff a 1 s | tres reintentos en 3 s no aguantan un registry que tarda en volver |
| **reintentar la migración fallida** | la corrida repetida encuentra la base a medias: **así se corrompe una base** |
| que la **subida fallida aborte** el update | una instancia se queda sin actualizar porque no pudo hablar con un bucket |
| quitar la poda local | el defecto **D4**: el disco se llena de dumps hasta reventar |
| subir con **`del`** en vez de `put` | el script **borraría** en el bucket en lugar de escribir |
| las credenciales de Spaces en `argv` | la llave visible en `ps` para cualquier usuario de la máquina |
| retención local a **99** | vuelve a no podar nada |
| podar **del revés** | se borrarían los respaldos **más nuevos**, incluido el de la corrida en marcha |
| tragarse el fallo de la subida | `RESPALDO REMOTO FALLIDO` no se escribiría nunca |
| **podar por NOMBRE en vez de por la fecha del archivo** | el defecto **H1**: un `spaces_x.dump` en el directorio y se borra **el dump de la corrida en marcha** |
| que el resumen de la poda cuente lo que **iba** a borrar | «3 retirados» con los 6 dumps intactos: la línea que se lee para saber si el disco baja |
| que el `trap` **no borre** el temporal con la llave | un `systemctl stop` a media subida deja el secreto en el disco |
| quitar el `trap` de **TERM** | la interrupción no queda dicha: bash corre el `trap` de `EXIT` igual, así que el archivo desaparece **y nadie se entera** |

Y contra material real, no solo dobles:

- El montaje del runner y la sonda de huella, **contra la imagen real**
  (`space-os:dev`) y bases **desechables** (`spaces_f34b_test`,
  `spaces_f34c_test`, `spaces_f34d_test`, ya destruidas).
- Los dos rojos de la auditoría se **reprodujeron** con la salida literal del
  runner antes de arreglarlos: `67 aplicadas, 1 de datos pendientes.` (exit 0) y
  `se aplicaron 66 migraciones y no se pudieron registrar` (exit 2).
- La huella **no se mueve** con un `insert` normal: mismo hash antes y después.

**Lo que NO se ha hecho: correrlo en un servidor.** El ensayo completo —release
bueno, release roto a propósito y vuelta atrás— es **F3.5, en DEMO**. El comando
de verificación de F3.4 (`/opt/space-os/update.sh --dry-run` en el droplet) es de
servidor y sigue pendiente de una persona.

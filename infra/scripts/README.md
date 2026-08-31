# `infra/scripts/` — los scripts que corren EN un servidor

Aquí no hay código de la aplicación: hay lo que se ejecuta en una máquina, con
raíz, para poner o mantener una instancia en pie.

| Script | Modelo | Qué hace |
|---|---|---|
| **`update.sh`** | **instancias soberanas** | **Una instancia se actualiza sola: jala su canal del registry, respalda, migra, conmuta y se devuelve si la salud falla.** |
| **`respaldo.sh`** | **instancias soberanas** | **El respaldo sale del droplet: lo sube a Spaces y poda el disco. Lo *sourcea* `update.sh`; también se llama a mano.** |
| **`provision-instancia.sh`** | **instancias soberanas** | **El ALTA de un owner: su base, su entorno, su nginx y su actualizador. Se detiene para que el owner apunte su DNS.** |
| `setup-droplet.sh` | base | Prepara un Ubuntu 22.04 desde cero (node, nginx, certbot, ufw) |
| `pruebas-update.sh`, `pruebas-vuelta-atras-real.sh` | pruebas | Ensayan `update.sh` sin tocar una instancia viva |

> [!important] El alta de un owner es aprovisionar una instancia, no insertar una fila
> Es la frase que evita la recaída, y por eso está aquí arriba. Dar de alta a un
> owner significa **su droplet, su base y su dominio**. Si buscas en esta carpeta
> un script que meta un `INSERT INTO tenants`, estás en el modelo que murió el
> 2026-08-12. El runbook es [`docs/runbook-alta-de-owner.md`](../../docs/runbook-alta-de-owner.md).

> [!note] Se retiraron cuatro scripts el 2026-08-26 (F5.5)
> `new-tenant.sh`, `setup-first-tenant.sh`, `migrate-all-tenants.sh` y
> `deploy.sh` eran del modelo de subdominios por tenant sobre un único droplet
> compartido, sustituido el 2026-08-12. **Ninguno se podía correr sin riesgo:**
> `migrate-all-tenants.sh` recorría la tabla de tenants de la pista Prisma
> archivada, que ya no existe, y `new-tenant.sh` llevaba datos reales quemados. `deploy.sh`
> entraba **por SSH a compilar en el servidor**, que es exactamente el camino
> que el modelo nuevo retira: la instancia se actualiza sola.
>
> Están en el historial de git si alguna vez hacen falta.

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
tail -n 40 /var/log/space-os/update.log        # todo, crudo, solo en el droplet
cat /var/log/space-os/update-publicable.log    # solo esta corrida, filtrado:
                                               # es lo que viaja al bucket (§8)
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
7. Si la salud falla: **solo si la huella dice que la base cambió** (§3)
   comprueba que el respaldo se puede leer, **tira el esquema `public` y lo
   rehace desde el dump** (§2), **relee la huella** para comprobar que la base
   volvió a como estaba, y luego vuelve al contenedor anterior. Sale ≠ 0 dejando
   el motivo en el log.
8. **Salga bien o mal**, sube el registro de la corrida a `s3://space-os-logs/`
   —el **filtrado**, no `update.log`— para poder diagnosticarla sin entrar por
   SSH (§8). Una subida fallida **no** cambia el código de salida.
9. Lo lanza `cron` una vez al día, con `flock`.

### Códigos de salida — no son intercambiables

> [!warning] Esta tabla vive **dos veces**, y la que se lee a las cuatro de la mañana es la otra
> La cabecera de `update.sh` trae la suya, y **ése** es el archivo que se instala
> en el droplet: quien diagnostica un fallo tiene el guion delante, no este
> README. Estuvo **dos días** listando `0,1,2,3,4,5,75` después de que D1
> añadiera el **6** y el **7** —o sea que el estado más urgente que este guion
> puede producir, «LA BASE QUEDO VACIA», no estaba donde se busca—. Corregida el
> **20/08**. Si añades un código, las **dos** se tocan en el mismo commit.

| Código | Qué pasó | ¿Hay que ir a mirar la base? |
|---|---|---|
| `0` | sin cambios, o actualizada y sana | no |
| `1` | no se pudo ni empezar: falta configuración, falló el pull, **el respaldo salió vacío**, no se pudo leer la huella de la base (§3), o el runner se negó a arrancar | no: **nada se tocó** |
| `2` | las migraciones fallaron a medias o no se pudieron registrar | **el log lo dice, medido contra la base** (§3): `LA BASE CAMBIO` = sí; `la base NO cambio` = no |
| `3` | el registro de la base y las migraciones de la imagen **no cuentan la misma historia** | no: **no se aplicó nada** |
| `4` | la salud falló y **la vuelta atrás salió bien** — la instancia sirve la versión anterior | no, pero hay que mirar el release |
| `5` | la salud falló y **la vuelta atrás no**. **La instancia queda SIN servicio** y el mensaje del log trae el **comando exacto** que la devuelve (§6). Desde el 20/08 las salidas `5` de la restauración se paran **antes** del `drop`, así que la base se queda con las migraciones nuevas. Con una excepción que el propio mensaje declara: si lo que falló fue el **cliente** `psql` **después** de que el servidor confirmara la limpieza, el esquema puede estar recreado y **vacío**; desde este script eso no se distingue de un rechazo, y por eso ya no se afirma | **sí, urgente** |
| `6` | la vuelta atrás dejó la instancia **sirviendo**, pero la base **no volvió** a la huella que tenía antes de migrar — o **no se pudo comprobar** que volviera. El mensaje distingue las dos cosas y no afirma la que no sabe | **sí**, sin prisa: hay servicio |
| `7` | **la base quedó vacía**: el esquema se tiró para restaurar encima y la restauración falló. Levantar la versión anterior **no basta**; el mensaje trae los dos comandos, **en orden**: primero restaurar la base, después el contenedor | **sí, urgente** |
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
| `DATABASE_URL` | sí (*) | conexión **privilegiada**: migraciones y respaldo. **No** es la de la app (`spaces_app` no tiene DDL). **La contraseña va percent-encoded** (`%40`, `%2F`, `%3F`, `%5C`): en crudo, cada cliente se rompe con un carácter distinto y la instancia acaba respaldando bien y sirviendo mal — la tabla de §5 dice cuál con cuál. Desde el 19/08 **nada de la URL viaja en `argv`**: el update la desarma y pasa `-h`, `-p`, `-U` y `-d`, con la contraseña y el resto de la consulta por variables `PG*` (§5). Da igual cómo esté escrito el parámetro de la consulta —`?password=`, `?%70assword=`, `?passwor%64=`—: el nombre se percent-decodifica **antes** de mirarse. `?sslpassword=` también sale, pero **se pierde**; y un parámetro de la consulta **sin variable `PG*`** para el update en seco, nombrándolo (§5). Si la cadena no se entiende como URL, el update **se para con salida 1** y no publica ni un trozo de ella; ojo con la excepción de §5: una URL **ambigua con puerto** no se para |
| `IMAGEN_NOMBRE` | no | `space-os` |
| `CONTENEDOR` | no | `space-os` |
| `ENV_APP` | no | `/etc/space-os/app.env`, las variables de la app |
| `DOCKER_OPCIONES_APP` | no | `--publish 127.0.0.1:3000:3000` |
| `RED_MIGRACION` | no | `host` |
| `SALUD_URL` | no | `http://127.0.0.1:3000/spaces-dooh/api/auth/metodos/` |
| `SALUD_INTENTOS` / `SALUD_ESPERA` | no | `10` y `3` |
| `PULL_ESPERAS` | no | `1 5 30`: una espera **por reintento** del `pull`, en segundos. **Vacío = ningún reintento** — cierto desde el **20/08** y no antes: la asignación usaba `${PULL_ESPERAS:-…}` y los dos puntos sustituyen **también el valor vacío**, así que `PULL_ESPERAS=""` dejaba los tres reintentos de siempre (medido) y solo un **espacio** los apagaba. Hoy es `${PULL_ESPERAS-…}`: ausente = los tres por omisión, vacío = ninguno. Lo fija **E88**. Medido el 18/08: un valor que no sean números **no rompe el update** —`sleep` protesta por stderr, no espera, y el `pull` se rinde igual sin tocar nada— pero tampoco hay backoff |
| `RUNNER_MIGRACIONES` | no | `/opt/space-os/migrar.mjs` (ver el aviso 1) |
| `PG_DUMP` / `PG_RESTORE` | no | rutas, si conviven varias versiones de Postgres |
| `PSQL` | no | ruta de `psql`. **Solo lo usa la vuelta atrás**, para dejar el esquema limpio antes de restaurar (§2). No se exige al empezar el update —eso pararía instancias que hoy se actualizan bien—: se comprueba en el momento en que hace falta, y si falta, el update **no toca la base** y sale `5` con el comando de rescate |
| `INSTANCIA` | no (*) | el prefijo de esta instancia dentro de los buckets —de respaldos **y de logs**—. Si falta, se usa el `hostname -s` |
| `SPACES_KEY` / `SPACES_SECRET` | no (*) | la llave de Spaces. **Una por instancia y con permiso solo sobre su prefijo.** Sin ellas no hay respaldo fuera del droplet, y el log lo dice |
| `SPACES_BUCKET` | no | `space-os-respaldos`, a dónde sale el **respaldo** |
| `LOGS_BUCKET` | no | `space-os-logs`, a dónde sale el **log** de cada corrida. **Otro bucket**: 90 días de retención en vez de 30, y puede pedir otro permiso en la llave (§8) |
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

## Nueve cosas que hay que saber antes de tocarlo

### 0 · Las migraciones `@tipo: datos` **no las aplica el update: las aplica una persona**

**Decisión de Jochelo, 2026-08-18.** `update.sh` llama al runner **sin
`--con-datos`** (`update.sh:1018-1024`, remedido leyendo el archivo el 19/08 por
**tercera vez ese día**: la cita decía `407-413`, luego `626-632`, luego
`692-698`, luego `775-781`, luego `924-930`, y M3 la movió otras **94
líneas**. Un archivo que crece invalida todas sus
citas de golpe), así que una instancia
**nunca** aplica una
migración marcada `-- @tipo: datos` en su primera línea. Eso es deliberado, no un
olvido: una corrección de datos no debe colarse en una actualización automática que
corre de madrugada por `cron` sin nadie mirando.

Lo que hasta hoy faltaba no era el comportamiento, **era decir quién las aplica**.
La respuesta es: **una persona, a mano, con el ritual de
`vault/04-Datos/migraciones.md` §«Antes de aplicar en producción»** — respaldo,
ensayo en `ROLLBACK`, `ON_ERROR_STOP=1` y nota de despliegue.

Cómo se ve desde el log, y por qué no es una alarma:

```
0 aplicadas, 1 de datos pendientes.
```

Ese `1 de datos pendientes` es **informativo y permanente** hasta que alguien la
aplique. `update.sh` sale 0 y la instancia queda al día en todo lo demás. Hoy la
pendiente es `db/migrations/20260731_calendario_meses_cortos.sql`.

> [!warning] Quien publique un release con una migración de datos tiene que avisar
> El runner **no** la aplicará en ninguna instancia de la flota, y el update **no**
> falla por ello. Si nadie avisa, la corrección sencillamente no ocurre — en
> silencio y en todas partes a la vez.


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

> [!danger] Esa frase era **falsa** hasta el 20/08, y este es el defecto **D1**
> `pg_restore --clean --if-exists` solo suelta **los objetos que están dentro del
> dump**. Lo que creó la migración del release fallido **no está ahí**, así que
> **sobrevivía a la vuelta atrás**. Medido contra Postgres 16.14: tras una
> «VUELTA ATRAS COMPLETA» la tabla del release seguía existiendo y
> `schema_migrations` había vuelto a sus filas de antes **sin ella**. El registro
> volvía; el esquema, a medias.
>
> Con una migración **no idempotente** eso deja la instancia **atascada**: el
> primer intento aplica, la salud falla, restaura y sale `4` dejando la tabla
> dentro sin registrar; el segundo muere con `relation … already exists` y sale
> `2`. Ese release **no se puede volver a aplicar nunca**, y el `cron` lo
> reintenta cada noche.

**Cómo se arregló:** la vuelta atrás restaura **sobre un esquema limpio**. Antes
de tocar nada comprueba que el respaldo existe, no está vacío y **se puede leer**
(`pg_restore --list`); entonces tira `public` con `drop schema … cascade`, lo
vuelve a crear **conservando su dueño** y restaura encima; y al terminar
**relee la huella** y la compara con la de antes de migrar. Si no coincide, lo
grita y sale `6` en vez de `4`.

> [!important] Lo que el dump **sí** devuelve, medido y no supuesto
> `bash infra/scripts/pruebas-vuelta-atras-real.sh` lo comprueba contra un
> Postgres de verdad, con una base desechable: vuelven tablas, índices,
> restricciones, **políticas de RLS**, el `force row level security`, la
> extensión `pgcrypto`, los `GRANT` del rol restringido y los `alter default
> privileges`; el **rol de la aplicación vive en el servidor**, así que el `drop`
> no lo toca; la app sigue viendo **solo sus filas** con el tenant fijado, no ve
> nada sin él y **no puede** desactivar la RLS; y la huella vuelve a ser
> exactamente la de antes. Después de eso, **el release descartado se vuelve a
> aplicar sin quejarse**, que es lo que hoy era imposible.
>
> Lo único que el dump **no** trae es el `CREATE SCHEMA public` —`pg_dump` solo
> emite sus `GRANT`—, y por eso el esquema se recrea a mano, con
> `authorization` al dueño de antes: crearlo sin él cambiaría el dueño en
> silencio.

> [!warning] El `drop` solo alcanza al esquema `public`
> Si un release dejó algo **fuera** de `public`, la limpieza no lo toca — y por
> eso la huella se relee **después** de restaurar: lo que el `drop` no limpie,
> la comparación lo **denuncia** (código `6`) en vez de callarlo.

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

### 5 · La conexión no viaja como URL

`pg_dump --dbname="postgresql://usuario:clave@…"` deja la clave visible en `ps`
para **cualquier** usuario de la máquina. `deploy.yml:119` lo evita con
`sudo -u postgres` (autenticación *peer*, sin clave); aquí la conexión es por
red, así que desde el **19/08 (decisión M3)** el script **no le pasa ninguna URL**:
la desarma y le da **cuatro banderas sueltas** —`-h`, `-p`, `-U`, `-d`— con **todo
lo demás por variables `PG*` del entorno**.

> [!important] Por qué se cambió el método, y no se añadió otro caso
> Esto era una **lista negra**: se pasaba la URL entera a `--dbname=` después de
> quitarle los parámetros que se reconocían como credencial. Fueron **tres
> ciclos**, y cada uno encontró **otra codificación del mismo nombre**:
>
> | Ciclo | Lo que se filtró | Lo que apareció después |
> |---|---|---|
> | 1 | `?password=` y `?sslpassword=`, por su nombre literal | `?PASSWORD=` |
> | 2 | nada: `?PASSWORD=` se declaró «límite conocido» | `?%70assword=` |
> | 3 | — | `?passwor%64=`, `?%70%61%73%73%77%6f%72%64=` |
>
> Las tres del ciclo 3 **funcionan**: libpq percent-decodifica el **nombre** del
> parámetro antes de mirarlo, y `pg-connection-string` 2.14.0 —el parser de la
> app y de `scripts/migrar.mjs`— también. Medido conectando de verdad contra un
> Postgres con `scram-sha-256` **forzado** y con control negativo (ojo: con el
> `pg_hba` por omisión de la imagen, `127.0.0.1` va por `trust` y **todo**
> conecta — así es como se mide esto mal).
>
> El fondo no es que faltara un caso: **una lista negra sobre un espacio de
> nombres que se decodifica no se puede demostrar completa.** Siempre queda otra
> codificación. Reconstruir la conexión sí se puede demostrar, y eso es lo que se
> hace ahora.

**El invariante, que es con lo que se audita esto:** en `argv` **no aparece nada
que venga del `userinfo` ni de la consulta, bajo ninguna codificación**. Lo fija
E77 con nueve parámetros y la contraseña en medio, y lo fija **en global**
`argv_sin_marca`, que corre en **los 88 escenarios**: toda credencial del arnés
lleva dentro una cadena marcadora, y ningún escenario puede dejarla en la línea de
comandos de ninguna llamada doblada.

**La contraseña se escribe siempre percent-encoded** en `instancia.env`: `%40`
por `@`, `%2F` por `/`, `%3F` por `?` y `%5C` por la barra invertida. Esta
sección decía otra cosa —que se podían poner los cuatro en crudo— y **era falsa
en tres de los cuatro**. Medido el 19/08:

| En crudo | libpq (`psql` 16) | `pg-connection-string` 2.14.0 (la app y `migrar.mjs`) |
|---|---|---|
| `@` | **no**: corta por el **primer** `@` y se queda `ssw0rd@host` como host | sí (corta por el último) |
| `/` | **no**: lee `spaces:pa` como `host:puerto` | **no**: `Invalid URL` |
| `?` | sí | **no**: `Invalid URL` |
| `\` | sí | sí — pero `instancia.env` **lo sourcea bash**, que se la come |

O sea que quien siguiera la instrucción anterior se quedaba con una instancia
**cuyo respaldo corría y cuya aplicación y cuyas migraciones no** — y eso no da
un error que apunte a la contraseña. El `update.sh` sí sabe leer los cuatro
crudos (E62, E63, E64 y E70), pero eso es tolerancia suya, **no una forma
válida**: lo que hay que escribir es `%40`.

**La consulta también puede llevar credencial.** `?password=` es una forma que
libpq acepta y que `pg-connection-string` lee **como la contraseña** —y que
**gana** sobre la del `usuario:clave@`—. Con **una salvedad medida**: eso vale
para un valor no vacío. Con `?password=` **vacío los dos clientes se separan**,
libpq se queda con la vacía de la consulta (y falla la autenticación) y
`pg-connection-string` conserva la del `userinfo`. El script sigue a **libpq**,
que es quien va a conectar (E79).

Y lo que **no** es credencial no se pierde: va por su variable de entorno. Las
ocho equivalencias están **medidas una a una** contra libpq 16 el 19/08, no
sacadas de la documentación:

| Parámetro de la consulta | Variable | Cómo se midió |
|---|---|---|
| `application_name` | `PGAPPNAME` | `show application_name` lo devuelve |
| `options` | `PGOPTIONS` | `-c statement_timeout=1234` → `show statement_timeout` da `1234ms` |
| `connect_timeout` | `PGCONNECT_TIMEOUT` | contra un host que no contesta, corta a los 2 s |
| `sslmode` | `PGSSLMODE` | con `require` la conexión deja de entrar |
| `target_session_attrs` | `PGTARGETSESSIONATTRS` | con `read-only` deja de entrar |
| `sslrootcert` | `PGSSLROOTCERT` | con TLS levantado: ruta buena entra, ruta mala no |
| `sslcert` | `PGSSLCERT` | ídem — una ruta **inexistente** libpq la ignora, una **existente y mala** da error de certificado |
| `sslkey` | `PGSSLKEY` | ídem |

Los tres de SSL **no se pueden aislar sin un servidor que hable TLS**: sin él,
cualquier valor da el mismo *«server does not support SSL»*. Por eso el Postgres
efímero de la medición se levantó con certificado. Y en la tabla
`PQconninfoOptions` del binario cada palabra clave está **pegada** a su variable
—`sslcert` en el byte 212560 y `PGSSLCERT` en el 212568; `sslkey` en el 212594 y
`PGSSLKEY` en el 212601—, mientras que `sslpassword` está (212660) y
`PGSSLPASSWORD` **no aparece ni una vez**.

> [!warning] Es una **lista blanca**: lo que no está, para el update en seco
> Un parámetro de la consulta sin variable `PG*` **para el update con salida 1,
> sin tocar nada, y el mensaje lo nombra** (nunca su valor). Es el precio del
> método y es el precio correcto: dejarlo pasar a `argv` es la fuga que se acaba
> de cerrar, y tragárselo en silencio cambia cómo se conecta la instancia sin
> decirlo. `?PASSWORD=` en mayúsculas cae por aquí, y con eso deja de ser el
> «límite conocido y aceptado» del ciclo 2 — libpq lo rechaza igualmente con
> *«invalid URI query parameter»*, o sea que esa URL no ha conectado nunca (E83).

> [!warning] `sslpassword` se quita **y se pierde**: libpq no tiene variable de
> entorno para ella
> La contraseña de Postgres se reenvía por `PGPASSWORD`. La frase de paso de la
> llave del certificado de cliente **no tiene por dónde**: `PGSSLPASSWORD` **no
> existe**. Medido el 19/08 sobre `libpq.so.5` de `postgres:16-alpine`:
> `PGSSLMODE`, `PGSSLKEY`, `PGSSLCERT` y `PGSSLROOTCERT` están dentro del
> binario; `PGSSLPASSWORD`, **cero apariciones**. La primera versión de este
> cambio la mandaba por ahí y «funcionaba», porque una variable que nadie lee
> tampoco estorba.
>
> Así que se **descarta**, y el log lo dice con todas las letras. Si la llave del
> cliente está cifrada, `pg_dump` pedirá la frase por una consola que no existe,
> el respaldo fallará y el update se parará en `BACKUP VACIO` **sin tocar nada**.
> La salida para esa instancia es **dejar esa llave sin cifrar**, que es lo que
> necesita cualquier proceso desatendido. Un descarte **silencioso** dejaría a
> esa instancia sin respaldo y sin explicación; por eso el aviso, y por eso E75
> lo comprueba.

> [!warning] Una URL ambigua **no siempre se para**: depende de si lleva puerto
> Una URL sin credencial cuya **consulta** lleve un `@`
> (`?application_name=space-os@demo`, que libpq acepta) es indistinguible de una
> con contraseña rara. **Sin puerto** el update se para con salida **1** y no
> publica nada de la cadena. **Con puerto no se para**: `localhost` cuela como
> usuario, `demo` cuela como host, se publica un `base=demo` **falso** y el
> update muere cuatro pasos después en el respaldo, como **`BACKUP VACIO`**.
> Este README afirmaba sólo la mitad buena. Arreglar el parseo es otra tarea; lo
> que sí se hizo es que ese mensaje mande a mirar el **`base=`** antes que
> `pg_dump`, para que un fallo de **parseo** deje de leerse como un fallo de
> **respaldo**. Lo fija **E78**.

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

En ese punto el contenedor nuevo ya se retiró. Dónde quedó el **viejo** depende
de si el `rename` del paso 5b llegó a hacerse, y **el mensaje lo dice**, no lo
supone:

- **El caso normal** — el `rename` se hizo: el viejo está **parado y aparcado**
  como `${CONTENEDOR}-anterior`, conservando puertos, `--env-file`, red y
  política de reinicio. Devolverlo es renombrarlo y arrancarlo:

  ```bash
  docker rename space-os-anterior space-os && docker start space-os
  ```

- **El `rename` falló**: el viejo **conserva su nombre**, está parado, y
  `${CONTENEDOR}-anterior` **no existe** —lo borró el `docker rm -f` con el que
  empieza el 5b—. Ahí basta con arrancarlo:

  ```bash
  docker start space-os
  ```

Medido en el ensayo local: tras un código `5` el contenedor de la app **no
existía**, el `-anterior` estaba parado y la salud daba `000`; con ese comando
volvió en **8 s**.

> [!warning] Hasta el 20/08 la frase de ese mensaje mentía en la segunda rama
> El **comando** ya se calculaba, pero el párrafo que va delante afirmaba
> siempre «el contenedor de la versión anterior está PARADO y aparcado como
> `space-os-anterior`». Con el `rename` fallido eso manda a mirar un contenedor
> **que no está**, y el mensaje se contradecía a sí mismo dos líneas después.
> Ahora las dos frases salen de la misma condición (`estado_del_viejo` junto a
> `comando_rescate`), y el arnés muerde por los dos lados: E18/E32 fijan la rama
> del aparcado y **E86/E87** la del nombre conservado.

> [!warning] El rescate devuelve el servicio, **no** resuelve el estado de la base
> En los códigos `5` que salen de la restauración —no hay `pg_restore`, no hay
> `psql`, el respaldo no sirve, o la limpieza del esquema falló— eso levanta la
> versión **anterior** sobre una base que **ya tiene las migraciones nuevas**. Es
> un parche para que la instancia responda mientras alguien mira; el dump está en
> `/var/lib/space-os/respaldos/`. Los cuatro tienen algo en común desde el 20/08:
> **la base no se tocó**, porque los cuatro se paran **antes** del `drop`.

> [!danger] El código `7` es distinto: ahí levantar el contenedor **no sirve**
> Es el precio de restaurar sobre un esquema limpio, y su mensaje lo dice con
> esas palabras: el `drop` se hizo y la restauración falló, así que la base **no
> tiene ni esquema ni datos**. El orden importa y va escrito en el propio
> mensaje: **primero la base** —con el `pg_restore` que trae, con las mismas
> banderas de conexión que usa el script y sin la contraseña dentro— y **después**
> el contenedor. Que ese camino exista es lo que obliga a comprobar el respaldo
> **antes** de tirar nada: sin respaldo legible, el `drop` no se intenta
> siquiera.

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

### 8 · El log **sale** del droplet — y por eso hay **dos** logs

El modelo de instancias soberanas **prohíbe entrar por SSH** a la máquina de un
owner. Bien, ¿y entonces cómo se diagnostica la actualización que falló anoche?
Desde F3.9, leyendo el bucket: al terminar —**salga bien o mal**— `update.sh`
sube su registro a

```
s3://space-os-logs/<instancia>/<AAAA-MM-DD-HHMM>.log
```

> [!warning] **`space-os-logs` no es `space-os-respaldos`**
> Son **dos buckets distintos**, con **dos reglas de ciclo de vida distintas**
> —**90 días** aquí, **30** allí— y, si se quiere, dos permisos. Reutilizan la
> misma llave (`SPACES_KEY`/`SPACES_SECRET`) y el mismo cliente, no el mismo
> destino. El bucket se elige con `LOGS_BUCKET` en `instancia.env`.
>
> Y otra vez: **los 90 días los poda la regla del bucket, no el script.** Aquí
> tampoco hay un solo borrado remoto, por la misma razón de siempre.

#### Lo delicado no es subirlo: es **qué** se sube

El criterio de aceptación de F3.9 está escrito **en negativo**:

> **ni un dato de negocio aparece en el log.**

Y el archivo que ya existía **no lo cumplía**. En `update.log` cae, por `eco`,
la salida **cruda** de las herramientas, y ahí sí hay datos:

| Quién escribe | Qué puede arrastrar |
|---|---|
| el runner de migraciones | un error de Postgres trae **la fila que lo provocó**: `Ya existe la llave (tenant_id, rfc)=(rgb, XAXX010101000)` |
| **`docker logs --tail 30`** (paso 7) | son los registros de **la aplicación**: rutas, cuerpos, correos, importes |
| `pg_dump` · `pg_restore` · `docker run` · la sonda de huella | mensajes por objeto, nombres, conteos |

La línea que el plan traza es exacta: **nombres de tabla y conteos son
aceptables; cualquier fila, no.** Así que subir `update.log` tal cual **habría
sido una fuga**, y la tarea no era «añadir una subida» sino **separar lo que el
script emite de lo que emiten sus herramientas**:

| Archivo | Qué lleva | Quién lo escribe | Dónde vive |
|---|---|---|---|
| `/var/log/space-os/update.log` | **todo**, crudo, acumulado desde que nació la instancia | `registrar` **y `eco`** | solo el droplet |
| `/var/log/space-os/update-publicable.log` | **solo esta corrida**, y solo las líneas del propio script **más su código de salida** | `registrar`, y nadie más | **es lo que viaja al bucket** |

Toda la separación cabe en dos funciones (`update.sh`, «Bitácora»): `registrar`
escribe en los dos archivos, `eco` **solo en el local**. No hay lista de
palabras prohibidas ni filtro por expresión regular —un filtro se olvida de un
caso y nadie se entera—: **lo que no se emite no puede filtrarse.**

> [!tip] Filtrar no es perder
> Lo crudo **sigue entero en el droplet** para quien tenga que entrar. Lo que
> cambia es que ya casi nunca hace falta. Así se ve una vuelta atrás completa
> leída **solo desde el bucket**, sin abrir una sesión en el servidor.
>
> Lo que sigue **no está escrito a mano**: es la salida literal de
> `update-publicable.log` en el escenario **E13** del arnés, capturada el
> **20/08**. La versión anterior de este bloque sí estaba escrita a mano y por
> eso se quedó **mintiendo**: enseñaba `7a · base restaurada (esquema Y registro
> de migraciones)`, una línea que D1 **borró del código**, y un `VUELTA ATRAS
> COMPLETA` sin la coletilla de la base que hoy lleva **siempre**. Un ejemplo
> falso justo aquí engaña a quien está diagnosticando **sin** entrar al servidor,
> que es para lo que existe este archivo. Para regenerarlo: copia el arnés hasta
> antes de su primer `preparar`, pega detrás el escenario E13 y termina con un
> `cat "$PUBLICABLE"`.
>
> Las rutas son las del directorio temporal del arnés (`/tmp/tmp.…`); en una
> instancia de verdad son `/var/lib/space-os/respaldos/…`.
>
> ```
> 2026-08-20 10:38:57-0600  1 · pull reg.example.com/space-os-flota/space-os:estable
> 2026-08-20 10:38:57-0600  2 · hay version nueva: sha256:vieja -> sha256:nueva (v0.4.2)
> 2026-08-20 10:38:57-0600     runner: montado desde /tmp/tmp.LUIxMFJCwZ/migrar.mjs (la imagen no lo trae; ver AVISO 1)
> 2026-08-20 10:38:57-0600  3 · respaldo -> /tmp/tmp.LUIxMFJCwZ/estado/respaldos/spaces_20260820_103857.dump
> 2026-08-20 10:38:57-0600     respaldo de 15 bytes
> 2026-08-20 10:38:57-0600     respaldo remoto -> s3://space-os-respaldos/demo/2026-08-20-1038.dump (por s3cmd)
> 2026-08-20 10:38:58-0600     respaldo remoto OK: s3://space-os-respaldos/demo/2026-08-20-1038.dump
> 2026-08-20 10:38:58-0600  4 · version anterior anotada en /tmp/tmp.LUIxMFJCwZ/estado/version-anterior
> 2026-08-20 10:38:58-0600  5 · migraciones (imagen nueva, contenedor efimero) · huella previa: esq-viejo reg-viejo 0
> 2026-08-20 10:38:59-0600     base tras migrar: cambio=si · 67 migraciones nuevas en schema_migrations · huella: esq-nuevo reg-nuevo 67
> 2026-08-20 10:38:59-0600  5b · parando space-os y guardandolo como space-os-anterior
> 2026-08-20 10:38:59-0600  5c · levantando space-os con v0.4.2
> 2026-08-20 10:38:59-0600  6 · salud: intento 1/2 -> 000
> 2026-08-20 10:39:00-0600  6 · salud: intento 2/2 -> 000
> 2026-08-20 10:39:00-0600  7 · VUELTA ATRAS: la version nueva no contesta 200 en http://127.0.0.1:3000/spaces-dooh/api/auth/metodos/
> 2026-08-20 10:39:00-0600  7a · restaurando …/spaces_20260820_103857.dump: la huella de la base cambio al migrar (67 filas nuevas en schema_migrations). [esq-viejo reg-viejo 0] -> [esq-nuevo reg-nuevo 67]. Se restaura ANTES de levantar la version anterior, para que no vea un esquema que no conoce.
> 2026-08-20 10:39:00-0600  7a · dejando el esquema limpio antes de restaurar (respaldo comprobado: …/spaces_20260820_103857.dump)
> 2026-08-20 10:39:00-0600  7a · base restaurada sobre un esquema limpio y COMPROBADA: la huella es otra vez la de antes de migrar [esq-viejo reg-viejo 0].
> 2026-08-20 10:39:00-0600  7b · levantando otra vez la version anterior
> 2026-08-20 10:39:01-0600  6 · salud: 200 en el intento 1/2
> 2026-08-20 10:39:01-0600  VUELTA ATRAS COMPLETA: la instancia sirve otra vez la version anterior y la base volvio a su huella de antes de migrar [esq-viejo reg-viejo 0], comprobado releyendola. El release v0.4.2 queda descartado. Respaldo en …/spaces_20260820_103857.dump
> 2026-08-20 10:39:01-0600  salida: 4
> 2026-08-20 10:39:01-0600     log remoto -> s3://space-os-logs/demo/2026-08-20-1039.log (por s3cmd)
> 2026-08-20 10:39:02-0600     log remoto OK: s3://space-os-logs/demo/2026-08-20-1039.log
> ```
>
> (Las únicas tres líneas acortadas son las que repetían la ruta completa del
> dump, sustituida por `…/`; nada más se tocó.)
>
> **Ni una fila y ni una credencial.** Eso es el criterio y se comprueba leyendo
> el archivo que viaja (E53, E62, E63).
>
> Lo que **sí** sale del droplet, dicho con nombres para que nadie se lleve una
> sorpresa: el **destino de la base** (`base=localhost:5433/spaces`, sin el
> `usuario:clave@`), la **URL de la imagen** en el registry y la **ruta local**
> del dump. Nombres de tabla no salen —la huella es un **hash**, que para
> diagnosticar sirve igual—, pero eso es una consecuencia, no una promesa: todo
> lo anterior está **dentro** de lo que el plan permite («nombres y conteos, sí;
> filas, no»). Decir «ni siquiera un nombre de tabla» sugería una asepsia mayor
> que la real, y por eso esta línea se corrigió el 18/08.

#### Seis cosas que conviene no descubrir tarde

> [!warning] Tres de estas seis las escribió mal la primera versión, y la
> auditoría del 18/08 lo reprodujo
> Decían «por ahí pasan los siete códigos», «al terminar —salga bien o mal—
> subir» y «el proceso de fuera no escribe nada», y ninguna de las tres era
> cierta. Las tres están corregidas **en el código**, no en la redacción; lo que
> sigue describe lo que el script hace hoy y lo fija el arnés.

1. **La subida cuelga de `salir()`**, que es la única puerta de salida del
   script una vez tomado el candado. Si el proceso muere **por una señal o por
   un error no previsto**, no hay log en el bucket. Un `trap EXIT` parecía la
   respuesta y **no lo es**: `respaldo.sh` hace `trap - EXIT INT TERM HUP` al
   cerrar su subida (`respaldo_conf_limpiar`), así que el trap quedaría
   **desarmado justo en la segunda mitad** del script — la mitad en la que las
   cosas salen mal. Un trap que deja de existir a medias es peor que no tenerlo,
   porque este README afirmaría algo falso.

2. Por esa puerta pasan **seis de los siete** códigos documentados **de una
   corrida de verdad**, no los siete. El **`75`** —ya había otro update en
   marcha— lo devuelve el proceso de **fuera** del candado con un `exit` pelado,
   a propósito: ese no escribe ni sube nada.

   **Precisado el 20/08:** `exit` pelados hay **tres**, no uno. Los otros dos
   están en el parseo de argumentos, antes de todo: `--help` sale con `0` y un
   argumento desconocido con `1`. Así que al pie de la letra los códigos `0` y
   `1` **también** pueden salir sin pasar por `salir()`, aunque solo escribiendo
   mal la línea de comandos — el cron nunca los produce. El punto 1 ya acota
   «una vez tomado el candado»; esto solo lo deja dicho donde se cuentan los
   códigos.

3. **Antes de leer `instancia.env` no hay con qué subir.** El cliente de S3 sale
   de `respaldo.sh`, que se sourcea **justo después** de la configuración; los
   dos únicos `salir` anteriores —falta `flock`, falta el propio archivo— se
   quedan en el droplet, y con ellos un tercero: la falta del propio
   `respaldo.sh`. Los dos últimos **lo dicen** con esas palabras (`log remoto: no
   hay con que subirlo…`) en vez de callárselo; el de `flock` sale **antes del
   candado**, así que ni siquiera llega a tener log publicable propio.
   **Todo lo demás sí sube**: hasta el
   18/08 había **doce** `salir` de configuración por encima del `source`, que
   escribían el log publicable y no lo subían; hoy **nueve de esos doce viajan**,
   y son justo los de una instancia mal aprovisionada — la clase de fallo que uno
   más quiere diagnosticar sin entrar al servidor del owner.

   **Medido el 20/08**, porque la cabecera de `update.sh` decía lo contrario
   («esos tres lo DICEN»): con `respaldo.sh` ausente el log sí trae `no hay con
   que subirlo` (**E47** lo fija desde hoy) y sin `instancia.env` también
   (**E61**); con `flock` ausente el log trae **solo** `ERROR update: falta
   flock…` y **no existe siquiera** el archivo publicable — el aviso no puede
   emitirse porque `subir_log_remoto` se rinde en su primer guard, fuera del
   candado. Ese tercer caso **no lo puede comprobar el arnés**: haría falta que
   `flock` no estuviera en el `PATH` del sistema, y el arnés monta dobles, no los
   quita.

4. Una subida que **falla** no cambia el código de salida (§siguiente), pero una
   **señal a media subida sí lo cambia**: los `trap` de `respaldo.sh` salen con
   `130`/`129`/`143`. Esa ventana existía ya en el paso 3 y ahora existe en
   **todas** las salidas, incluida la buena. Cerrarla exige tocar `respaldo.sh`,
   que está auditado: **queda escrito, no arreglado**.

5. **El proceso de fuera del candado** —el que se encuentra otro update en
   marcha y sale con `75`— no escribe ni sube nada: el log publicable es de la
   corrida que **tiene** el candado, y ensuciárselo sería mezclar dos historias.
   Esto **es cierto desde el 18/08 y antes no lo era**: la marca de «estoy dentro
   del candado» se **exportaba** antes del `flock`, así que el proceso de fuera se
   quedaba con ella puesta y su línea de «ya hay otro update en marcha» caía
   dentro del archivo que la **otra** corrida sube al bucket. Ahora se le pasa al
   hijo en la misma línea del `flock`. Lo caza **E59**, que es el escenario que
   faltaba: el anterior comprobaba «no sube» y **nunca abría el archivo que
   viaja**.

6. **El `--dry-run` también manda su log**, y es a propósito: es la corrida
   **obligatoria la primera vez en cada instancia**, o sea justo la que alguien
   quiere leer desde fuera para saber si quedó bien montada. Sigue sin tocar
   nada: lo único que sale del droplet es el relato de que no se hizo nada.

Si la subida falla, el update **no cambia de código de salida** (sería cambiar
lo que el cron lee por un problema de red), pero queda escrito:

```
LOG REMOTO FALLIDO — el registro de esta corrida se quedo SOLO en este droplet …
```

Y sin `SPACES_KEY`/`SPACES_SECRET` no es un fallo, es una instancia sin
diagnóstico remoto configurado, y el log lo dice con esas palabras
(`log remoto NO CONFIGURADO`).

> [!danger] Lo que no se puede hacer desde el repositorio: **el bucket de logs y
> su regla de 90 días**
> Hermana de la tarjeta de §7, y **no es la misma**: otro bucket. Lo hace una
> persona:
>
> 1. `s3cmd mb s3://space-os-logs` (o desde el panel de DigitalOcean).
> 2. Dar a la llave de cada instancia permiso de escritura sobre **su prefijo**
>    (`demo/*`) también en **este** bucket. Con la llave de §7 a secas, la
>    subida del log devuelve `403`.
> 3. La regla de ciclo de vida, **90 días** —la poda remota que el script *no*
>    hace—:
>    ```bash
>    s3cmd expire s3://space-os-logs --expiry-days=90 --expiry-prefix=''
>    ```
>    Comprobar después: `s3cmd info s3://space-os-logs` tiene que mencionarla.
> 4. Escribir `LOGS_BUCKET=space-os-logs` en `/etc/space-os/instancia.env`.
>
> Comprobación de que quedó hecho —el **comando de verificación de F3.9**—:
> ```bash
> s3cmd get s3://space-os-logs/demo/$(date +%F)*.log - | head -40
> ```
>
> 5. **Y la parte que ningún script puede hacer:** la **primera subida de cada
>    instancia se lee a ojo**, entera, buscando cualquier cosa que parezca un
>    dato de un cliente, y **lo que se encontró se anota en
>    `docs/Registro_Cambios.md`**. El criterio de F3.9 lo exige por escrito, y
>    tiene razón: un log es una vía de fuga clásica y la revisión mecánica solo
>    cubre lo que alguien pensó en comprobar.

Que el `LOG REMOTO FALLIDO` salga además en el **reporte de flota** es **F6.4**,
que todavía no existe: hoy solo está en el log de la instancia y en el bucket.

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
bash infra/scripts/pruebas-update.sh              # los escenarios (~6 min)
bash infra/scripts/pruebas-update.sh --mutantes   # además, que muerden (horas)
bash infra/scripts/pruebas-vuelta-atras-real.sh   # la vuelta atrás contra Postgres
```

> [!important] Hay **dos** arneses, y responden a preguntas distintas
> `pruebas-update.sh` monta dobles y mira **qué se le pide** a cada herramienta:
> fija el orden, los códigos y los mensajes, y corre en cualquier sitio.
> `pruebas-vuelta-atras-real.sh` (20/08, D1) habla con **Postgres de verdad**
> sobre una base desechable, porque hay una pregunta que los dobles no pueden
> responder: **¿basta el dump para rehacer la base?** Reproduce el defecto D1, su
> consecuencia —el release que ya no se podía reaplicar—, el arreglo, y que el
> rol restringido **siga viendo solo sus filas y sin poder apagar la RLS**.
> **27 comprobaciones · 0 rojas** el 20/08. Se niega a tocar una base cuyo nombre
> no acabe en `_test` o `_e2e`, igual que `recrearEsquema()` de las e2e, y
> **extrae de `update.sh`** el SQL de limpieza y la consulta de la huella en vez
> de copiarlos: una copia se habría quedado vieja sin que nadie se enterase.

El arnés no sale a la red, no habla con Docker, no toca ninguna base y **no sube
nada a ningún bucket**: monta dobles POSIX de `docker`, `curl`, `flock`, `sleep`,
`pg_dump`, `pg_restore`, **`psql`**, `s3cmd`, `aws`, `chmod`, `rm` y `hostname`
en un `PATH` propio
y mira **qué se les pide**. `sleep` es un doble a propósito: un backoff de
1+5+30 s se comprueba por lo que se **pide**, no por el reloj, o el arnés
tardaría 36 s en cada escenario. `chmod` lo es por otra razón: delega en el de
verdad pero anota la llamada, porque en un sistema de archivos sin permisos POSIX
`stat` devuelve `644` aunque el `chmod 600` se haya ejecutado. Y `rm` también
delega en el de verdad, con un interruptor para que falle **solo** el borrado de
un dump: es la única forma de comprobar que el resumen de la poda cuenta lo que
borró y no lo que se proponía borrar. Y desde F3.9 los dobles de `s3cmd` y `aws`
**guardan también el CONTENIDO de lo que suben**, no solo que lo subieron: el
criterio de esa tarea va en negativo —«ni un dato de negocio aparece en el log»—
y eso no se puede comprobar mirando la línea de comandos, hay que **leer el
archivo que viaja**. El resultado del 2026-08-20, y el que imprime el comando:

```
102 escenarios · 664 comprobaciones · 0 rojas
```

> [!note] Y una pieza nueva del doble de `pg_restore`: `--list` va aparte
> Desde D1, la comprobación **previa** del respaldo (`pg_restore --list`) tiene su
> propio interruptor en el arnés, separado del de la restauración. Si compartieran
> uno, no se podrían distinguir los dos lados del peor caso: «el respaldo no se
> puede ni abrir» —y entonces la base **no se toca**— de «la restauración murió a
> la mitad» —y entonces la base quedó **vacía**—.

> [!warning] La barrida de mutantes **no se ha vuelto a correr entera** — ni el 18/08, ni el 19/08, ni el 20/08
> Los mutantes son **52**, y esta vez el número está **contado, no recordado**:
> `grep -c '^  probar_mutante '` da **43** sobre `update.sh` y
> `grep -c '^  probar_mutante_respaldo '` da **9** sobre `respaldo.sh` (medido el
> **20/08**). Aquí ponía **44** —el recuento de antes de D1, que añadió ocho— y
> ese número llevaba dos días conviviendo, dos párrafos más abajo, con el «los
> ocho de D1». La barrida completa cuesta varios minutos por mutante en esta
> máquina —los 52 pasan de las quince horas— así que se corren **aislados los que
> tocan el cambio**: **siete** el 18/08 (los dos
> invalidantes de la auditoría, el hallazgo 3 y los cuatro de F3.9), **cinco** en
> el ciclo 2 del 19/08 (los del parseo único de la credencial), **cinco** en el
> ciclo 3 (los de la credencial en la consulta), **siete** en M3 (los seis de la
> conexión sin URL más el de fallar abierto, que hubo que reescribir) y **cuatro**
> el 20/08 (las dos ramas de `estado_del_viejo`, la condición de
> `comando_rescate` y `PULL_ESPERAS`). Todos
> **CAZADOS**. `52 mutantes · 0 escapan` **no** es de una barrida entera: quien la
> necesite entera, que la corra y lo escriba aquí.
>
> > [!danger] Y hasta el 20/08 la barrida entera **no se podía correr**, no es que
> > no se hubiera corrido
> > Los dos mutantes de `PULL_ESPERAS` de F3.8 —«dejar el pull sin reintentos» y
> > «aplanar el backoff a 1 s»— mutaban `${PULL_ESPERAS:-1 5 30}`, **con** los dos
> > puntos. H-1 quitó esos dos puntos ese mismo día y los dejó apuntando a una
> > línea que ya no existe: el validador del arnés los daba por
> > `INVALIDO … toco 0 lineas, no una` y `--mutantes` **salía con 1** al llegar
> > ahí. O sea que la barrida completa era imposible desde el commit anterior, y
> > lo que la paraba no era el tiempo. Reescritos contra la línea de hoy
> > **conservando lo que cada uno sabotea** (el primero deja el valor por omisión
> > vacío, el segundo aplana el backoff) y **los dos vuelven a salir CAZADOS**.
> > El mutante de H-1, que es el que reintroduce los dos puntos, ya apuntaba bien.
>
> **Y los ocho de D1** (20/08, mismo día, ciclo siguiente): no limpiar el esquema ·
> no releer la huella · tirar el esquema sin comprobar que el respaldo **existe** ·
> ni que **se puede leer** · llamar a `limpiar_esquema` **antes de que la vuelta
> atrás levante su marca** · el peor caso saliendo como un `5` cualquiera · dar
> «VUELTA ATRAS COMPLETA» sin mirar si la base volvió · y decir «comprobado
> releyéndola» en el camino que **no** restaura. **Los ocho CAZADOS, y contra el
> arnés ENTERO —102 escenarios— no contra una copia reducida**: 6 min por corrida,
> ~50 min los ocho. Dos de ellos no salieron a la primera y eso vale la pena
> dejarlo escrito: uno era **INVÁLIDO** —`\?` en GNU `sed` es un cuantificador, así
> que el patrón no casaba con ninguna línea— y otro **ESCAPABA** por un motivo
> real: enganchado al paso 3, `limpiar_esquema` **todavía no está definida**
> (bash define funciones cuando la ejecución pasa por ellas), el `|| true` se
> tragaba el «command not found» y no probaba nada. Movido a la primera línea de
> la vuelta atrás —función ya definida, marca todavía en 0— **muerde**.
>
> **Tres mutantes más, contra la base de verdad**, porque hay cosas que los dobles
> no pueden ver (`psql` es un doble: no tiene catálogo). Sobre
> `pruebas-vuelta-atras-real.sh`, que **extrae el SQL de `update.sh`**: crear el
> esquema **sin `authorization`** → 1 roja («el esquema public conserva su dueño de
> antes»: sale `d1r_mig_test` en vez de `pg_database_owner`); una limpieza que
> **aborta antes del `drop`** → **4 rojas**, incluida la de punta a punta («el
> release sigue sin poder reaplicarse: relation "ensayo_marca_dos" already
> exists»); y sustituir el `drop` por otra cosa → el guard **anti-deriva** del
> propio arnés lo para en seco («ABORTADO: no se pudo extraer de update.sh el SQL
> de limpieza»).
>
> **Y uno que NO se puede escribir, dicho para que no se busque:** quitar el guard
> de `VUELTA_ATRAS_EN_CURSO`. Hoy no hay ninguna llamada fuera de sitio que lo
> ejercite —y eso es exactamente lo que el guard existe para vigilar—, así que
> ese mutante escaparía por construcción.
>
> **Y un matiz del 20/08 que no estaba en los ciclos anteriores:** los **cuatro**
> de los mensajes que mentían se
> corrieron contra una copia **reducida** del arnés —9 escenarios, 74
> comprobaciones, 33 s por corrida— y no contra los 88. Los ocho de D1 sí fueron
> contra el arnés entero. Es más rápido y basta
> para decir que **esas** comprobaciones muerden, pero **no** dice nada de si el
> mutante rompía además algún otro escenario. Los ciclos anteriores usaron el
> arnés completo; esta diferencia queda escrita para que nadie compare peras con
> manzanas.
>
> **Tres mutantes del ciclo 3 desaparecieron de la lista y no se sustituyeron**:
> apuntaban a la línea que **reconstruía** la URL —pasarla entera, quitarle la
> consulta entera, o decidir la reescritura por «hay contraseña»—. Esa línea ya
> no existe, así que esas tres formas de equivocarse **ya no se pueden
> escribir**. Eso, y no otra cosa, es lo que M3 ganó: la clase de fallo se
> eliminó en vez de vigilarse.
>
> Y una trampa medida el 19/08 que se repite: la **copia reducida** del arnés que
> corre sólo unos mutantes **no puede vivir en `/tmp`**. `RAIZ` sale de
> `dirname "$0"/../..`, así que desde `/tmp` apunta a `/`, no encuentra
> `respaldo.sh` y **todos** los mutantes salen «CAZADOS» con el número constante
> de rojas del arnés roto. La copia va en `infra/scripts/` y se borra después.

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

Y, desde **F3.9**: que el log de la corrida **suba al bucket con la ruta exacta
del plan** (E52), que **ni un dato de negocio viaje dentro** —con el runner y
`docker logs` escupiendo un RFC, un nombre de cliente, un correo y un importe a
propósito, y comprobando que **los cuatro siguen en `update.log`** y **ninguno
sale del droplet**, ni tampoco las llaves de Spaces ni **la contraseña de
Postgres** (E53)—, que **suba también cuando el update falla** (E54), que
sin credenciales **no salga y se diga** (E55), que lo que sube sea **esta corrida
y no el histórico acumulado** (E56), que el `--dry-run` **también mande el suyo**
(E57) y que **`LOGS_BUCKET` de `instancia.env` mande** sin arrastrar al bucket de
respaldos (E58).

Y, desde la **auditoría de F3.9** (18/08), los cinco que faltaban —los tres
primeros se vieron **en rojo**, 10 comprobaciones, antes de tocar una línea—:

| Escenario | Qué fija |
|---|---|
| **E59** | el que se encuentra el candado tomado **no escribe** en el publicable de quien lo tiene. Se comprueba **abriendo el archivo**, no mirando si hubo `s3cmd`: esa era la mitad que faltaba |
| **E60** | el log sube **también en los fallos de configuración**, que son los de una instancia mal aprovisionada — nueve de las doce salidas que antes se quedaban dentro; las otras tres no tienen con qué subir y lo dicen (E61) |
| **E61** | si el update muere antes de leer `instancia.env` el log **no puede** viajar, y eso **se dice** en vez de callarse |
| **E62** | una contraseña con `@` sin codificar **no sale**: antes viajaba un trozo (`ssw0rd@localhost…`) |
| **E63** | una contraseña con `/` sin codificar **no sale**: antes viajaba entera, usuario incluido |

Y, desde el **ciclo de credenciales del 19/08**, los ocho que cierran el parseo. Cada
uno afirma **tres** cosas de la misma URL —qué sale al archivo que viaja, qué llega a
`argv` y qué entra por el **entorno**—, porque hasta ese día eran **dos recortes
distintos** y cada uno estaba mal a su manera. Los cinco primeros se vieron **en rojo**
(23 comprobaciones) antes de tocar una línea; desde M3 todos comprueban en `argv`
las **cuatro banderas de conexión** en vez de un `--dbname` que ya no existe:

| Escenario | Qué fija |
|---|---|
| **E62**, **E63** | ampliados: además del log, las banderas que llegan a `argv` y el `PGPASSWORD` que llega entero |
| **E64** | una `?` en la contraseña: el log publicaba `spaces:cl` — **usuario y prefijo de la clave**. Era una **regresión**: el recorte anterior a `70b8cc5` acertaba |
| **E65** | varias `@`: se corta por la **última**, no por la segunda |
| **E66** | el caso bien formado (`%40`), que es el que no puede romperse al arreglar los demás |
| **E67**, **E68** | sin contraseña y sin `@`: llega el usuario y **no** se inventa un `PGPASSWORD`. Y sin usuario **no se pasa `-U`**, que no es lo mismo que pasarlo vacío: libpq caería al usuario del sistema |
| **E69** | `@` al final y sin host: **falla cerrado**, salida 1, y no publica nada de la cadena |
| **E70** | una barra invertida cruda: antes se dejaba la URL entera en `argv` **a propósito** |
| **E25** | el mismo criterio en el camino normal, no solo en la familia de la credencial |
| **E71**, **E72** | lo que no es una URL —una cadena `clave=valor` de libpq— se publicaba **entera, con la contraseña dentro**; ahora sale `(url no parseable)`. E72 lo comprueba por la otra puerta: la URL de `app.env` en el mensaje de «bases DISTINTAS» |
| **E73** | el `--help` imprime su cabecera **entera**. Es un rango de líneas **fijo** (`sed -n '2,121p'`) y se descuadra en silencio cada vez que alguien añade una línea arriba: pasó el 19/08 al documentar la URL de la base, y se comió cuatro líneas sin decir nada. Se fija por los **dos** extremos |

Y, desde el **ciclo 3 del 19/08**, los seis de la credencial que viajaba en la
**consulta** — la vía que hasta ese día no miraba nadie. El quinto (E78) sólo falló
en la frase nueva del mensaje, porque lo demás **ya era así**; y el sexto (E79)
salió de escribir el arreglo, no de la auditoría:

| Escenario | Qué fija |
|---|---|
| **E74** | `?password=` sin nada en el `userinfo`: no había **nada** que recortar por el `@`, así que la URL entera —con la contraseña— llegaba a `--dbname`. Es una forma que libpq acepta y que `pg-connection-string` lee como la contraseña: medido, no supuesto |
| **E75** | `?sslpassword=` sale de `argv` **y** el `sslmode` que la acompaña se queda. Y como `PGSSLPASSWORD` **no existe** en libpq, se **descarta** y el log lo dice: un descarte silencioso dejaría sin respaldo, y sin explicación, a una instancia con la llave del cliente cifrada |
| **E76** | las tres credenciales en la misma URL: gana la de la **consulta**, como en libpq y en `pg-connection-string` (medido contra un Postgres real). Elegir la del `userinfo` cambiaría una fuga por un respaldo que no corre |
| **E77** | **el que impide el arreglo destructivo**: `sslmode`, `application_name`, `options`, `connect_timeout`, `target_session_attrs`, `sslrootcert`, `sslcert` y `sslkey` llegan **cada uno en su variable `PG*` y decodificado**, con la contraseña **en medio**. Lo de «decodificado» es lo que M3 cambió: `options=-c%20statement_timeout%3D0` en una URL es `-c statement_timeout=0` en `PGOPTIONS`, porque una variable de entorno no lleva percent-encoding y Postgres recibiría un `-c` que no entiende |
| **E78** | la **ambigüedad, tal y como es**: con puerto el update **no se para** —publica un `base=` falso y muere cuatro pasos después como `BACKUP VACIO`—. Fija lo medido, no lo deseable: el parseo no se toca, y lo que cambia es que el mensaje mande a mirar el `base=` antes que `pg_dump` |
| **E79** | `?password=` con el valor **vacío** y una clave de verdad en el `userinfo`. Fija la **precedencia**, que es el único caso en que los dos clientes **no coinciden**: libpq se queda con la vacía de la consulta, `pg-connection-string` con la del `userinfo`. Se sigue a libpq. La forma de equivocarse que este escenario cazaba en el ciclo 3 —decidir la reescritura por «hay contraseña»— **ya no se puede escribir**: no queda ninguna URL que reconstruir |

Y, desde **M3 (19/08)**, los cuatro de la **codificación del nombre** y los dos
límites que M3 **no** arregla. Los cuatro primeros son el mismo parámetro
`password` escrito de otra manera, uno por ciclo perdido:

| Escenario | Qué fija |
|---|---|
| **E80** | `?%70assword=` — la que rompió el ciclo 3. La lista negra buscaba la cadena `password` y aquí no está escrita |
| **E81** | `?passwor%64=` — la misma clase por el otro extremo de la palabra: un filtro por prefijo tampoco la ve |
| **E82** | `?%70%61%73%73%77%6f%72%64=` — el nombre entero codificado, el caso límite: no queda ni una letra a la vista |
| **E83** | `?PASSWORD=` en mayúsculas. Deja de ser un «límite aceptado»: cae por la lista blanca, el update **se para con 1 sin tocar nada** y el mensaje nombra el parámetro, nunca su valor |
| **E84**, **E85** | los dos límites que **siguen fuera de alcance** —multi-host y URL de socket unix—, fijados para saber que **no empeoran**: los dos paran en seco con salida 1 y sin publicar nada, igual que antes de M3. Comprobado corriéndolos también contra la versión anterior del script |

Y, desde el **ciclo del 20/08**, los tres de los mensajes que decían algo que no
era verdad. Los siete rojos se vieron **antes** de tocar una línea de
`update.sh`:

| Escenario | Qué fija |
|---|---|
| **E86** | `rename` fallido **y** restauración fallida: el mensaje del código `5` dice que el viejo **conserva su nombre**, no que esté aparcado como `-anterior` —que no existe—, y el comando de rescate es `docker start` a secas. Además es el primer escenario que ejercita la rama `else` de `comando_rescate` (**H2**), que hasta hoy no cubría nadie |
| **E87** | lo mismo por la **otra** puerta: no hay `pg_restore` con el que restaurar. Son dos `salir` distintos con el mismo párrafo, y los dos lo tenían mal |
| **E88** | **`PULL_ESPERAS=` vacío = ningún reintento**, que es lo que dicen el código y este README. Antes salían **tres** igual: cero líneas de `reintento` en `update.log`, ninguna llamada a `sleep`, y el mensaje del `pull` fallido dice «esperas de ninguna s» |
| **E18**, **E32** | ampliados con la rama **contraria**: en el caso normal el mensaje sí dice «aparcado como `space-os-anterior`». Entre los cuatro, la condición queda mordida por los dos lados |
| **E47** | ampliado: la falta de `respaldo.sh` **dice** que no hay con qué subir el log. Era una de las tres salidas que la cabecera daba por dichas sin que nadie lo comprobara (**H-B**) |

Y, desde **D1** (20/08), los siete de la vuelta atrás que devuelve la base —los
siete se vieron **en rojo**, 37 comprobaciones, antes de tocar una línea de
`update.sh`—:

| Escenario | Qué fija |
|---|---|
| **E89** | la vuelta atrás **restaura sobre un esquema limpio**, y **en orden**: comprobar el respaldo → tirar `public` → restaurar → **releer la huella**. El orden es la mitad del contrato, y se comprueba con un predicado nuevo (`antes_que`): tirar el esquema **después** de restaurar dejaría la base vacía, y comprobar el respaldo **después** de tirarlo no comprobaría nada |
| **E90** | si la huella de después **no coincide**, se grita: código `6` en vez de `4`, con los dos valores en el mensaje |
| **E91** | si la huella **no se puede releer**, el mensaje dice **«no consta»** — ni que volvió ni que cambió. Misma lección que **H1** |
| **E92** | el respaldo **desaparece** entre el `pg_dump` y la vuelta atrás (disco lleno, o la poda de F3.7 que ordenaba por nombre): **no se tira el esquema** y la base queda intacta. Es el `pg_restore` sin guarda `-s "$BK"`, cerrado |
| **E93** | el respaldo está y **no está vacío**, pero `pg_restore --list` no lo puede leer (un dump truncado pesa): tampoco se tira nada |
| **E94** | **no hay `psql`**: se para antes de tocar la base, con el comando de rescate, igual que la falta de `pg_restore` (E32) |
| **E95** | el `drop` se pide y **la limpieza falla** (el caso medido es «must be owner of schema public»): no se restaura encima, y desde el 20/08 el escenario exige lo **contrario** de lo que exigía —que el mensaje **no** diga «La base NO se vacio»—, porque con un código de salida de `psql` no se sabe si el servidor llegó a confirmar. Lo que sí exige es que lo **diga**: «este script NO lo comprobo» y «Mira la base ANTES de decidir» |
| **E18**, **E86** | pasan al **peor caso**: el esquema ya se tiró y la restauración falla. Código **7** propio, «LA BASE QUEDO VACIA», y los **dos** comandos en orden |
| **E14**, **E17** | ampliados: en el camino que **no** restaura, el mensaje no puede decir «comprobado releyéndola»; y en una corrida **buena** no aparece ningún `drop` **ni se pide** —la función lo rechazaría y lo diría— |

**Se comprueba que las comprobaciones muerden.** **Cincuenta y dos** mutantes de una
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
| **subir `update.log` crudo** en vez del publicable | **el defecto de F3.9**: se van al bucket los registros de la aplicación y las filas que arrastra Postgres |
| que `eco` escriba **también** en el publicable | la misma fuga por la otra puerta: bastaría una línea para deshacer toda la separación |
| subir el log **solo cuando el update sale bien** | justo la corrida que hay que diagnosticar es la que no llegaría |
| **no vaciar** el publicable al empezar | cada noche se subiría todo lo que la instancia registró desde que nació |
| **exportar** la marca del candado antes del `flock` | el invalidante 1: el proceso de fuera escribe en el log que sube **otra** corrida |
| no subir el log de los **fallos de configuración** | el invalidante 2: las salidas de una instancia mal aprovisionada no llegan al bucket |
| `partir_url` cortando por el **primer `@`** | el hallazgo 3: un trozo de la contraseña de Postgres en la primera línea de cada log que viaja **y** en `argv`. Ocupa el sitio del mutante viejo, que ya no se puede escribir: aquella línea era un `sed` y ha dejado de existir |
| quitar el **guard del destino** | cualquier cosa pasa por host: se publica el trozo que quede y `--dbname` apunta a una URL sin destino |
| fallar **abierto** cuando la URL no se entiende | vuelve la fuga peor: la cadena entera —contraseña incluida— a `--dbname`, visible en `ps` |
| `destino_de_url` publicando la cadena que **no entendió** | una cadena `clave=valor` con `password=` dentro, en la primera línea del log que sube al bucket |
| **no duplicar la barra invertida** antes del `printf '%b'` | `cl\v%40e` se decodifica como `cl<VT>@e`: la contraseña se corrompe y el respaldo no corre |
| que gane la clave del **`userinfo`** sobre la de la consulta | `pg_dump` se autenticaría con una clave distinta de la que usa la app: fuga cerrada a cambio de un respaldo que no corre |
| **no reconocer `sslpassword`** en la consulta | se queda en la consulta y vuelve a `argv`: la frase de paso de la llave, visible en `ps` |
| **volver a mandar la URL entera en `--dbname`** | el defecto de M3 en su forma pura: la contraseña vuelve a `ps`, venga de donde venga y esté codificada como esté |
| **no decodificar el nombre del parámetro** | **el que se les escapó a los tres ciclos**: `?%70assword=` deja de reconocerse como `password` y el valor se va con la consulta |
| no decodificar el **valor** | `PGOPTIONS` llegaría como `-c%20statement_timeout%3D0` y Postgres recibiría un `-c` que no entiende |
| **no fallar cerrado** ante un parámetro sin variable `PG*` | vuelve el «límite aceptado»: lo desconocido se cuela en vez de parar |
| **no reenviar la consulta** por el entorno | el arreglo destructivo: se van `sslmode`, `options` y `sslrootcert`, y la instancia deja de poder conectarse |
| pasar un **`-U` vacío** cuando la URL no trae usuario | libpq deja de caer al usuario del sistema: se pierden las instancias que se autentican por `peer` |
| **`estado_del_viejo` siempre «aparcado»** | el defecto **H1** en su forma pura: el mensaje del código `5` manda a buscar `space-os-anterior` cuando el `rename` falló y ese contenedor **no existe** — y el comando que va dos líneas después dice lo contrario |
| `estado_del_viejo` siempre «conserva su nombre» | la mentira simétrica: en el caso normal manda a arrancar un contenedor que ya no tiene ese nombre |
| **`comando_rescate` con la condición invertida** | el **H2**: hasta el 20/08 **ningún** escenario ejercitaba su rama `else`, así que este mutante escapaba entero. El comando de urgencia saldría al revés en las dos ramas |
| **`PULL_ESPERAS` con los dos puntos** | el **H-1**: `PULL_ESPERAS=""` en `instancia.env` vuelve a dejar los **tres** reintentos, y quien quería apagarlos no tiene forma de enterarse |

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

# `infra/scripts/` — los scripts que corren EN un servidor

Aquí no hay código de la aplicación: hay lo que se ejecuta en una máquina, con
raíz, para poner o mantener una instancia en pie.

| Script | Modelo | Qué hace |
|---|---|---|
| **`update.sh`** | **instancias soberanas** | **Una instancia se actualiza sola: jala su canal del registry, respalda, migra, conmuta y se devuelve si la salud falla.** |
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
2. `docker pull` y **compara el digest** con el que corre. Igual → sale 0 sin
   tocar nada.
3. **Respaldo** `pg_dump -Fc`, y comprueba que **no esté vacío**. Sin respaldo
   bueno, el update se detiene ahí. El criterio está copiado de
   `.github/workflows/deploy.yml:117-125`: *un `pg_dump` que falla deja un
   archivo de 0 bytes y su salida se ve casi igual que la de uno bueno.*
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
| `5` | la salud falló y **la vuelta atrás no** | **sí, urgente** |
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
| `RUNNER_MIGRACIONES` | no | `/opt/space-os/migrar.mjs` (ver el aviso 1) |
| `PG_DUMP` / `PG_RESTORE` | no | rutas, si conviven varias versiones de Postgres |

(*) Si falta, se toma la de `ENV_APP` y se avisa. Y si **las dos** existen y
apuntan a **bases distintas**, el script se para: migrar una base mientras la
app habla con otra no da ningún error, deja dos bases a medias.

### La ruta de salud

`SALUD_URL` apunta a `/spaces-dooh/api/auth/metodos/` y **no** a
`/api/version`, porque `/api/version` todavía no existe (llega en F6.1).
`metodos` es pública, sin sesión y sin datos de negocio. Vive en **una sola
variable** para que F6.1 la cambie en una línea. Es la misma ruta que usa el
smoke de `.github/workflows/promover.yml`, y por el mismo motivo.

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

## Cinco cosas que hay que saber antes de tocarlo

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

> [!note] El respaldo se queda en el droplet
> Hoy vive en `/var/lib/space-os/respaldos/`. Sacarlo de la máquina —para que
> sobreviva a la muerte del droplet que lo generó— es **F3.7**.

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
bash infra/scripts/pruebas-update.sh --mutantes   # además, que muerden (~4 min)
```

El arnés no sale a la red, no habla con Docker y no toca ninguna base: monta
dobles POSIX de `docker`, `curl`, `flock`, `pg_dump` y `pg_restore` en un `PATH`
propio y mira **qué se les pide**. El resultado del 2026-08-17, y el que imprime
el comando:

```
28 escenarios · 101 comprobaciones · 0 rojas
6 mutantes · 0 escapan
```

Cubre: sin cambios · dry-run · respaldo vacío · los cuatro códigos del runner ·
camino feliz · vuelta atrás con y sin restauración · vuelta atrás fallida · sin
versión anterior · candado tomado · dos bases distintas · imagen con y sin runner
dentro · canal inválido · pull fallido · huella ilegible antes y después · el
padre no aparece · la contraseña no sale en `argv`.

**Se comprueba que las comprobaciones muerden.** Seis mutantes de una sola línea,
y cada uno se **valida antes de correrlo** —diff de exactamente una línea, mismo
número de líneas, `bash -n` limpio— porque el ciclo anterior tuvo un falso verde
por un `sed` que dejó el archivo vacío y «pasó». Dos de los seis son justo los
que el arnés viejo **no** cazaba:

| Mutante | Qué rompería en un servidor |
|---|---|
| quitar `export DATABASE_URL` | `docker run --env DATABASE_URL` no pasa nada y **todas** las migraciones fallan |
| `pg_restore` sin `--clean --if-exists --single-transaction` | la vuelta atrás muere objeto por objeto en vez de volver |
| quitar el guard del respaldo vacío | se actualiza sin red |
| restaurar siempre / no restaurar nunca | los dos lados de la decisión de la vuelta atrás |
| retirar el contenedor nuevo por **nombre** | si el `rename` falló, borra el contenedor **viejo** |

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

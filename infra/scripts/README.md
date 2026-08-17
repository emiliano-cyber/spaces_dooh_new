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
5. Corre `migrar.mjs` **con las migraciones de la imagen nueva**, y **solo
   entonces** conmuta el tráfico al contenedor nuevo.
6. **Health check** 10 × 3 s contra `SALUD_URL`.
7. Si la salud falla: vuelve al contenedor anterior, restaura el dump **solo si
   corrieron migraciones**, y sale ≠ 0 dejando el motivo en el log.
8. Lo lanza `cron` una vez al día, con `flock`.

### Códigos de salida — no son intercambiables

| Código | Qué pasó | ¿Hay que ir a mirar la base? |
|---|---|---|
| `0` | sin cambios, o actualizada y sana | no |
| `1` | no se pudo ni empezar: falta configuración, falló el pull, **el respaldo salió vacío**, o el runner se negó a arrancar | no: **nada se tocó** |
| `2` | las migraciones fallaron a medias o no se pudieron registrar | **sí**: la base pudo cambiar |
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

## Dos cosas que hay que saber antes de tocarlo

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
> Por eso solo se hace en el camino de vuelta atrás, y **solo si corrieron
> migraciones**. Cuando el runner sale **2** —la base cambió pero el tráfico
> **no** se conmutó— el script **no restaura**: la versión anterior está
> sirviendo, con clientes dentro, y un `pg_restore --clean` sobre una base viva
> tumbaría una instancia que en ese momento funciona. Se para y se avisa; el
> dump queda ahí para quien decida usarlo.

> [!note] El respaldo se queda en el droplet
> Hoy vive en `/var/lib/space-os/respaldos/`. Sacarlo de la máquina —para que
> sobreviva a la muerte del droplet que lo generó— es **F3.7**.

---

## Cómo se verificó (sin tocar ningún servidor)

- `bash -n infra/scripts/update.sh`.
- **18 escenarios con dobles** de `docker`, `curl`, `flock`, `pg_dump` y
  `pg_restore` (58 comprobaciones): sin cambios · dry-run · respaldo vacío ·
  los cuatro códigos del runner · camino feliz · vuelta atrás con y sin
  restauración · vuelta atrás fallida · sin versión anterior · candado tomado ·
  dos bases distintas · sin `DATABASE_URL` · imagen con y sin runner dentro ·
  canal inválido · pull fallido · el log no lleva la contraseña.
- **Se comprobó que esas comprobaciones muerden**: tres mutantes del script
  —quitar la comprobación del respaldo vacío, aplanar la salida 3 en 1, y
  restaurar siempre— ponen el ejercicio en rojo.
- El montaje del runner se probó **contra la imagen real** (`space-os:dev`) y
  una base **desechable** (`spaces_f34_test`, ya destruida).

**Lo que NO se ha hecho: correrlo en un servidor.** El ensayo completo —release
bueno, release roto a propósito y vuelta atrás— es **F3.5, en DEMO**.

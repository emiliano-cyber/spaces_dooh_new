# Mudar g500 a un droplet NUEVO instalado desde cero, con todos sus datos

> Preparada el 2026-11-04. **La corre una persona**: Claude no entra a
> servidores (ni `ssh`, ni `scp`, ni `psql` remoto, ni `doctl`). Cada bloque dice
> **dónde** va:
>
> | Marca | Dónde |
> |---|---|
> | **[Panel DO]** | panel web de DigitalOcean |
> | **[Cloudflare]** | panel de Cloudflare, zona `space-os.io` |
> | **[VIEJO]** | bash en la consola web de DO del g500 de hoy |
> | **[NUEVO]** | bash en la consola web de DO del droplet nuevo |
> | **[PADRE]** | bash en la consola web de DO del PADRE |
> | **[PC]** | PowerShell en tu máquina |
>
> La consola web de DigitalOcean **se come el primer carácter** de cada pegado:
> por eso todo bloque bash empieza con `echo ok;`. **Pega un bloque cada vez**, y
> en la consola **no uses `exit` ni `set -e`**: cerrarían la sesión.
>
> Valores con marcador (no van en un archivo versionado, regla de `CLAUDE.md`):
> `142.93.113.106` (la de hoy, la del censo del dueño), `<IP_NUEVA>`, `<REPO>`
> (tu checkout, p. ej. `C:\Users\Server\spaces_doohmain_nueva`) y los que salen
> del censo de §0.3 (`registry.digitalocean.com/registryspaces/space-os@sha256:e6608ac9f02f3ca4d4917dfa8255d6b6ef6769a4d78623e449542982a1b8e15d`, `C.UTF-8`, `C.UTF-8`, `Etc/UTC`). Ningún
> bloque imprime una contraseña.

## Qué es y qué no es esta guía

**Es** el camino de **instalación limpia**: Ubuntu 24.04 recién creado, la base
del sistema con los guiones del repositorio en la etiqueta **`v0.12.5`** (la que
corre g500, `03026a15` = `main`), y encima **los datos y la identidad de g500
tal cual**: la base `spaces`, la configuración de `/etc/space-os`, la pila de
Space Eyes con sus volúmenes y su imagen local, nginx y el certificado.

**No es** la guía 29 (`29-mover-g500-a-2gb-copia-exacta-20261027.md`, copia por
instantánea). Aquella clona el disco entero; esta deja fuera lo que g500 arrastra
y no hace falta: el cluster 14 de PostgreSQL parado en el 5433, el contenedor
`space-os-antes-doohmain`, los paquetes que se hayan instalado a mano (guía 28,
paso 0: PHP/Node), las llaves viejas de root y Ubuntu 22.04. A cambio tiene más
pasos.

**El g500 viejo no se toca más allá de pararlo**: queda apagado, intacto y
**seguro de encender** (sin arranque automático de contenedores ni cron, §2.2)
como vuelta atrás, hasta que se reutilice como DEMO en otra guía.

---

## Las decisiones de esta guía, con su porqué

| # | Decisión | Por qué (evidencia en el repo) |
|---|---|---|
| D1 | **Ubuntu 24.04 LTS** | `setup-droplet.sh:128` instala `postgresql` sin fijar versión: en 24.04 es **PostgreSQL 16**, la misma mayor que g500 (cluster 16 del censo), así que `pg_dump`/`pg_restore` no cruzan de versión. En 22.04 sería 14 y `provision-instancia.sh:750-792` se niega a seguir. Es lo que ya decidió la guía 21 (§B1) y lo que corre el PADRE desde el 21/08 (diario 2026-08-21). |
| D2 | **Sin `provision-instancia.sh` ni `instalar-hijo.sh`** para la instancia; sí `setup-droplet.sh` para el sistema | `provision-instancia.sh` crea los roles con **claves nuevas** y aplica **siempre** `schema.sql` + `--instalacion-nueva` (`provision-instancia.sh:794-815`), que choca con una base restaurada; y su Space Eyes es el modelo `eyes.<dominio>` (`provision-instancia.sh:455-456`, `instancia.conf.tpl:195-229`), no el de g500, que entra por **el mismo dominio** (rama `feat/space-eyes-en-hijo-existente`, `7202c8b1`/`1fe8d201`, guía 23). `instalar-hijo.sh` es para droplets de cliente con licencia de alta. Del repo se usa: `setup-droplet.sh` (Docker, PG, nginx, certbot, s3cmd, ufw), las **recetas de roles** de `base-instancia.sh:96-140` como referencia, y los guiones del anfitrión. |
| D3 | **Sin bootstrap ni esquema**: base **vacía** + restauración entera | La organización, los 5 usuarios y su Dueño vienen dentro del respaldo. No se llama `--bootstrap` (`provision-instancia.sh:510-650`) ni se aplica `schema.sql`; la base se crea vacía con `sql_crear_base` (`base-instancia.sh:138-140`). La puerta `/api/bootstrap` queda cerrada sola porque `tenants` no está vacía (`docs/runbook-alta-de-owner.md:182-186`). |
| D4 | **Los secretos se COPIAN, no se regeneran** | No existe `SESSION_SECRET`: la sesión es un token aleatorio guardado en la tabla `sesiones` (`apps/web/lib/server/auth.ts:107-116`, `db/schema.sql:83`), y los códigos de recuperación también viven en la base; **las sesiones abiertas sobreviven** a la mudanza porque viaja la base. Lo que **sí** se rompería regenerando: `FLOTA_TOKEN` (la identidad de g500 ante el PADRE), `SPACE_EYE_KEY`/`SPACE_EYE_PROVISION_TOKEN` = `INSTANCIA_LLAVE`/`INSTANCIA_TESTIGO` (`eyes-alta.sh:13-17`), `JWT_SECRET`/`JWT_DEVICE_SECRET` de Space Eye (firman las sesiones de los equipos: regenerarlos los desconectaría a todos, `eyes-alta.sh:55-56`), `DB_PASSWORD`, que es la clave de root **dentro** del MySQL copiado (`infra/eyes/docker-compose.yml:32`), y las credenciales de terceros (Google, Resend, DOOHmain, Maps). |
| D5 | **Los roles de Postgres con el MISMO hash de contraseña** (`pg_dumpall --roles-only`) | Así `app.env` e `instancia.env` se copian **sin tocar una letra**, y los atributos del rol son exactamente los de g500 (el migrador **con** `bypassrls`: sin él el runner muere a media cola, guía 21 §B5). Mejor que la guía 21, que extraía la clave de la URL. |
| D6 | **`pg_restore` como `postgres`, sin `--no-owner` ni `--no-acl`, en una sola transacción** | Conserva los dueños tal como están (incluidos posibles tipos `enum` de `postgres`, guía 21 §B5-bis) y todos los `GRANT` a `spaces_app`. Si algo falla, no queda nada a medias. |
| D7 | **El contenedor de la app se arranca A MANO**, con el mismo `docker run` que `update.sh` | `update.sh` **no lo levantaría**: la base restaurada ya dice que `estable` está instalada, `decidirActualizacion` devuelve `sin-cambios` (`scripts/actualizaciones.mjs:25`) y `update.sh:2427-2429` sale con 0 «sin tocar nada»… sin contenedor. Se copia `update.sh:2628` y `:2636-2637`. |
| D8 | **Space Eyes por volúmenes crudos** (`rsync` en dos pasadas: en caliente y en el corte con la pila parada) **+ `mysqldump` de seguridad**; **imágenes por `docker save`** | La imagen `space-eye:0.16.24-local` **no está en el registro** (`update-eyes.sh:94-97` la acepta local). `mysql:8.0` es etiqueta flotante: llevar la misma imagen garantiza el mismo binario sobre el mismo `datadir`. La precopia deja el corte en minutos aunque las fotos pesen GB. |
| D9 | **El `docker-compose.yml` de Space Eyes se copia de g500**, no el de `v0.12.5` | El de g500 es la variante «mismo dominio» (`1fe8d201:infra/eyes/docker-compose.yml:63-69`: `MEDIAMTX_HOST` y `TURN_URL` por `IP_PUBLICA`, «los equipos la reciben del servidor cada vez, nunca la guardan»); el de `v0.12.5` usa `eyes.<dominio>` (`docker-compose.yml:59-64`). Cambiar de variante a la vez que de máquina son dos cambios en uno. `update-eyes.sh` y `mediamtx.yml` sí son idénticos en los dos (mismo sha256). |
| D10 | **TLS: se copia el certificado y se reemite en el nuevo tras mover el DNS** | Con el certificado copiado (vence el 2026-12-08) el HTTPS funciona **desde el primer minuto**, también con `--resolve` antes del DNS. Emitir antes es imposible por HTTP-01: Let's Encrypt pregunta a la máquina a la que apunta el nombre (`docs/runbook-alta-de-owner.md:68-72`), y DNS-01 pediría un token de Cloudflare que hoy no se usa. Después del DNS se fuerza una emisión en el nuevo (§4.5) para que el certificado vigente nazca ahí. |
| D11 | **Guiones del anfitrión desde `v0.12.5` con `git -c core.autocrlf=false archive`** | **Medido hoy en esta máquina**: `git archive` a secas entrega `update.sh` con sha `6add877f…`, que es **exactamente** la huella CRLF que dejó a g500 un día sin actualizarse el 08/10 (`vault/01-Arquitectura/entorno-y-despliegue.md:992-1007`); con `-c core.autocrlf=false` sale el canónico `8672d6b7…`. `.gitattributes` no protege `infra/scripts/*.sh`. |
| D12 | **El cron se replica el de g500** (incluida la línea de las 04:17 **comentada**, si así está) **+ el respaldo diario**, y se instala **solo tras el DNS y la prueba real** | El dueño decidió el 22/09 que el respaldo diario es de **todas** las instancias (`respaldo-diario.sh:47-49`, guía 12); el censo de hoy no lo muestra en g500. Instalar el cron al final hace la vuelta atrás de un solo paso. |
| D13 | **El viejo queda «seguro de encender»**: `--restart=no` en sus contenedores y su cron apartado | Si se enciende con el cron puesto, `update-eyes.sh` de las 04:27 **levanta la pila** porque no ve la API corriendo (`update-eyes.sh:101`, `:130`), y un respaldo subiría una base **vieja** a `s3://…/g500/` (el prefijo sale de `INSTANCIA`, `respaldo.sh:106-112`), el mismo del nuevo. |

---

## 0 · La víspera (sin cortar nada)

### 0.1 · [Cloudflare]
- Registro **A** de `g500`: anota la IP (`142.93.113.106`) y baja el **TTL a 1 min**.
- Debe estar en **«DNS only» (nube gris)**: RTSP 8554, WebRTC 8189/udp y TURN 3478
  no pasan por el proxy. Si está en naranja, **para y avisa**.
- **¿Hay un registro AAAA de `g500`?** Si lo hay, anótalo: el droplet nuevo tendrá
  que crearse con IPv6 (§1.1) o ese AAAA borrarse en §4.3. Si no lo hay, nada.

### 0.2 · [Panel DO] en el droplet de g500
Anota, porque **no** viajan solos: **región** (debería ser NYC1) y **VPC** ·
**Networking → Firewalls** (¿algún Cloud Firewall?) · **Backups** (¿activados?) ·
**Monitoring/alertas** · **tags** · **Reserved IP** (si g500 tuviera una, avisa:
cambia la guía entera — el censo dice que el A apunta a la IP propia del droplet).

### 0.3 · Censo — [VIEJO], solo lee

**Bloque A · sistema**
```bash
echo ok; hostnamectl | grep -E 'Operating|Kernel'; timedatectl | grep 'Time zone'; free -m | head -2; swapon --show; df -h / | tail -1
docker info --format 'docker {{.ServerVersion}} raiz={{.DockerRootDir}}'; docker compose version
docker ps -a --format '{{.Names}}  {{.Image}}  {{.Status}}'
docker volume ls --format '{{.Name}}' | grep -i eyes
du -sh /var/lib/docker/volumes/space-eyes_*/_data 2>/dev/null
ufw status | head -14
ls /etc/cron.d/ | grep -i space; grep -hv '^#' /etc/cron.d/space-os* 2>/dev/null | grep -v '^\s*$'; crontab -l 2>/dev/null | grep -v '^#'
ls /opt/space-os/respaldo-diario.sh 2>/dev/null || echo "sin respaldo-diario"
certbot certificates 2>/dev/null | grep -E 'Certificate Name|Domains|Expiry'
grep -hE '^(authenticator|webroot_path|installer|renew_hook|deploy_hook)' /etc/letsencrypt/renewal/*.conf
```

**Bloque B · configuración** (no imprime secretos). Sustituye `142.93.113.106`:
```bash
echo ok; IPV=142.93.113.106; ls -la /etc/space-os /etc/space-os/licencia 2>/dev/null
grep -E '^(INSTANCIA|CANAL|IMAGEN_NOMBRE|CONTENEDOR|ENV_APP|DOCKER_OPCIONES_APP|RED_MIGRACION|SALUD_URL|LICENCIA_[A-Z_]*|SPACES_BUCKET|SPACES_REGION|LOGS_BUCKET|FLOTA_REPORTE_URL)=' /etc/space-os/instancia.env
grep -E '^(EYES_IMAGEN|EYES_DOMINIO|IP_PUBLICA|INSTANCIA_OWNER|MIGRACIONES_BASE)=' /etc/space-os/eyes.env
grep -E '^(APP_URL|TZ|DOOHMAIN_PUBLISH_ENABLED|SPACE_EYE_BASE_URL)=' /etc/space-os/app.env; grep -q '^GOOGLE_MAPS_SERVIDOR_KEY=.' /etc/space-os/app.env && echo "MAPS: con clave" || echo "MAPS: sin clave"
( cd /opt/space-os && find . -maxdepth 2 -type f | sort | xargs sha256sum )
ls -la /var/lib/space-os
nginx -T 2>/dev/null | grep '^# configuration file'
grep -rIlF "$IPV" /etc /opt/space-os 2>/dev/null
```

**Bloque C · base de datos**
```bash
echo ok; pg_lsclusters; pg_dump --version
sudo -u postgres psql -d spaces -Atc "select (select count(*) from tenants)||'/'||(select count(*) from usuarios)||'/'||(select count(*) from sitios)||'/'||(select count(*) from propuestas)||'/'||(select count(*) from campanas)||'/'||(select count(*) from arrendadores)"
sudo -u postgres psql -d spaces -Atc "select version_instalada, digest_instalado, modo, aprobado_digest is not null as aprobada_pendiente from actualizaciones_instancia"
sudo -u postgres psql -Atc "select rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls from pg_roles where not (rolname ~ '^pg_') order by 1"
sudo -u postgres psql -Atc "select pg_encoding_to_char(encoding), datcollate, datctype, pg_get_userbyid(datdba), coalesce(datacl::text,'(sin acl)') from pg_database where datname='spaces'"
sudo -u postgres psql -Atc "select coalesce(r.rolname,'*')||' '||coalesce(d.datname,'*')||' '||s.setconfig::text from pg_db_role_setting s left join pg_roles r on r.oid=s.setrole left join pg_database d on d.oid=s.setdatabase"
sudo -u postgres psql -Atc "select m.rolname||' en '||r.rolname from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member where m.not (rolname ~ '^pg_')"
docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$(docker inspect -f '{{.Image}}' space-os)"
```

**Pégale las tres salidas a Claude antes del día.** Lo que tiene que salir, y lo
que hace cada cosa en esta guía:

| Qué | Esperado | Si no |
|---|---|---|
| Volúmenes | `space-eyes_base`, `space-eyes_redis`, `space-eyes_fotos`, `space-eyes_descargas`; raíz de Docker `/var/lib/docker` | Los bloques usan esos nombres: **para** y se ajustan |
| `du -sh` de los volúmenes | Anótalo: es lo que viaja (las fotos son lo grande) | — |
| `INSTANCIA=` | `g500` (no vacía) | Vacía: la licencia y el prefijo del bucket caen al `hostname` (`respaldo.sh:106-112`, `update.sh:1004`). **Para** |
| `EYES_IMAGEN` / `EYES_DOMINIO` / `IP_PUBLICA` | `space-eye:0.16.24-local` / `g500.space-os.io` / `142.93.113.106` | — |
| sha256 en `/opt/space-os` | `eyes/docker-compose.yml` = `5d77716f…` (variante de g500, D9) · `eyes/mediamtx.yml` = `55c10b1f…` · `update-eyes.sh` = `c10b9802…` · `update.sh` = `8672d6b7…` · `space-os.pub` (si existe) = `7a2f4e81…` | Otro compose: se copia igual (es el que corre) pero **avisa**. Otra `space-os.pub`: **para** (la licencia no verificaría) |
| `nginx -T` | `nginx.conf`, `sites-enabled/g500.space-os.io`, `snippets/space-eyes*.conf` y los de serie de Ubuntu | Otro archivo propio: se añade a §1.6 |
| `grep` de la IP vieja | solo `/etc/space-os/eyes.env` (y su respaldo `eyes.env.antes-0.16.24-…`); la red del droplet (`netplan`, `network/interfaces`) **no** viaja | Otro archivo: se añade a §1.6 |
| Conteos | `1/5/13/11/11/6` (guárdalo: se compara en §3) | — |
| `actualizaciones_instancia` | `v0.12.5`, `aprobada_pendiente = f` | `t`: espera a que instale o retira la aprobación |
| Roles | `postgres`, `spaces_app` (`f\|f\|f\|f\|t\|f`), `spaces_migrador` (`…\|t` en `rolbypassrls`) y nada más | Otro rol (p. ej. `spaces_user`): **para**, hay que crearlo antes de restaurar |
| Base `spaces` | `UTF8`, `C.UTF-8`, `C.UTF-8`, dueño `spaces_migrador`, `(sin acl)` | Otro dueño o una ACL: **para** |
| `pg_db_role_setting` y `pg_auth_members` | vacíos | Algo: **para** |
| RepoDigest | `…/space-os@sha256:…` → es `registry.digitalocean.com/registryspaces/space-os@sha256:e6608ac9f02f3ca4d4917dfa8255d6b6ef6769a4d78623e449542982a1b8e15d` | — |
| Zona horaria | `Etc/UTC` (se replica en §1.3) | — |
| `MAPS: con clave` | la clave de Google Maps de servidor **se restringe por IP** (`infra/env/app.env.example:127-128`) | Si hay clave: **antes del corte**, añade `<IP_NUEVA>` en Google Cloud (§1.1) |

### 0.3 bis · Resultado del censo del 2026-11-04 (lo pegó el dueño)

Ya sustituido en los bloques de esta guía: IP vieja `142.93.113.106`, digest de la app `…space-os@sha256:e6608ac9…`, base `UTF8` / `C.UTF-8` / `C.UTF-8`, zona del sistema `Etc/UTC` (la app lleva `TZ=America/Mexico_City` en `app.env`, que viaja tal cual).

| Qué | Censo | Veredicto |
|---|---|---|
| Volúmenes | `space-eyes_base` 811 MB · `_descargas` 236 MB · `_fotos` 1,2 GB · `_redis` 4,4 MB | ~2,3 GB a mover: la precopia en caliente (§1.8) es la que ahorra tiempo de corte |
| `INSTANCIA` / bucket | `g500` / `space-os-respaldos` en `sfo3` | OK |
| `FLOTA_REPORTE_URL` | vacío | g500 no reporta al panel de flota; se copia igual |
| sha256 de `/opt/space-os` | compose `5d77716f`, mediamtx `55c10b1f`, update-eyes `c10b9802`, update `8672d6b7`; sin `space-os.pub` ni `licencia/` | Todo lo esperado |
| `respaldo.sh` | existe en `/opt/space-os` pero **no hay cron** que lo llame | Confirma que g500 no tenía respaldo diario: se instala en el nuevo (§4.4) |
| nginx | `sites-enabled/g500.space-os.io` + `snippets/space-eyes.conf` (+ módulos de serie) | Lo esperado |
| IP vieja | `eyes.env`, su respaldo, `netplan` y `network/interfaces` (red del droplet) | Lo esperado |
| Google Maps | **sin clave** | No hay que tocar Google Cloud |
| `actualizaciones_instancia` | `v0.12.5`, modo `aprobacion`, sin pendiente | OK |
| Contenedores sobrantes | `flamboyant_mclaren` (Dead) y `space-os-antes-doohmain` (parado) | No viajan |
| ufw IPv6 | solo 22 y 80 con regla v6 | Si el nuevo lleva IPv6, sus reglas las pone `ufw` igual para v4/v6 |
| Roles y `pg_auth_members` | **no salieron**: el `!~` de esas dos consultas lo interpretó bash (event not found) | Ya corregido en el Bloque C; hay que **volver a correr esas dos líneas** |

### 0.4 · [PADRE] ¿alguien guarda la IP de g500?
```bash
echo ok; grep -rIlF '142.93.113.106' /etc/space-os /var/lib/space-os /var/www/Spaces/apps/flota 2>/dev/null || echo "el PADRE no la guarda"
```

### 0.5 · [PC] El paquete de guiones de `v0.12.5`, sin CRLF
```powershell
cd <REPO>
git rev-parse v0.12.5
git -c core.autocrlf=false archive --format=tar.gz -o $HOME\Downloads\space-os-v0.12.5-infra.tgz v0.12.5 infra scripts/migrar.mjs
Get-FileHash $HOME\Downloads\space-os-v0.12.5-infra.tgz
```
`git rev-parse` tiene que decir `03026a15ff11…`. **No quites el
`-c core.autocrlf=false`** (D11). Si `v0.12.5` no existe en tu checkout:
`git fetch <remoto> --tags` primero.

### 0.6 · Ventana
Acuerda **~60–90 min sin uso** con quien usa g500 (la app **y** los equipos de
Space Eyes dejan de reportar en el corte). Lo que capturen en el viejo después de
§2.1 no existe en el nuevo.

---

## 1 · Preparar el droplet nuevo (g500 sigue en uso)

Todo esto se puede hacer horas antes de la ventana, el mismo día.

### 1.1 · [Panel DO]
1. **Create → Droplets**: **Ubuntu 24.04 (LTS) x64**, la **misma región** (y VPC)
   que g500, **Basic · Regular · 2 GB / 1 vCPU / 50 GB**. Llave SSH
   **`spaces_deploy`**. **Monitoring** activado. **IPv6** solo si §0.1 encontró
   un AAAA. Nombre: `g500-nuevo`.
2. Si §0.2 encontró **Cloud Firewall**, **tags** o **alertas**, ponlos ya.
   **Backups**: igual que el viejo (si el dueño quiere cambiarlo, ver preguntas).
3. Anota su IP: `<IP_NUEVA>`.
4. Si §0.3 dijo `MAPS: con clave`: en Google Cloud → Credenciales → esa clave →
   añade `<IP_NUEVA>` a las IP permitidas (**deja también la vieja** hasta §6).

### 1.2 · [PC] Subir el paquete
```powershell
scp -i $HOME\.ssh\spaces_deploy $HOME\Downloads\space-os-v0.12.5-infra.tgz root@<IP_NUEVA>:/root/
```

### 1.3 · [NUEVO] Comprobar el paquete y montar la base del sistema
```bash
echo ok; mkdir -p /root/space-os-v0.12.5 && tar xzf /root/space-os-v0.12.5-infra.tgz -C /root/space-os-v0.12.5 && cd /root/space-os-v0.12.5
grep -rlI $'\r' infra scripts/migrar.mjs || echo "sin CRLF"
sha256sum infra/scripts/update.sh infra/scripts/respaldo.sh infra/scripts/respaldo-diario.sh infra/scripts/conexion-pg.sh infra/scripts/update-eyes.sh infra/scripts/setup-droplet.sh infra/eyes/mediamtx.yml infra/licencias/space-os.pub scripts/migrar.mjs; cd /
```
Tiene que decir `sin CRLF` y **exactamente** estas huellas (calculadas sobre
`git show v0.12.5:<ruta>`). Si una no cuadra, **para**:
```
8672d6b797608ce2f71f538e8e261b27ec44b43b649302bd73633f15d913c816  infra/scripts/update.sh
1e33dcc081096167b072d8e435bb0885f6958b4820153d8aa106b22347bf5a59  infra/scripts/respaldo.sh
7b775bd02563c268a596ec99aa095c5dece52818b1dca6409684d799ad7494a0  infra/scripts/respaldo-diario.sh
f3240e431d12779d976c6cf66b281681d2ec67d87b703999e2d6c8b7b9c47f93  infra/scripts/conexion-pg.sh
c10b980217410d648bb1a8b89d93131df1dbe1960397cc2d1bcf265a1b6da672  infra/scripts/update-eyes.sh
d3ebb4eba7517fc20f27664368dacf131adc489f3874eab61d7c175411796c0d  infra/scripts/setup-droplet.sh
55c10b1f88a93c651d463749c8b0dfbade9ca0dd9884a49a0375175c6d0173bb  infra/eyes/mediamtx.yml
7a2f4e8116816e8a2ba4078253021c8f2efb13e247e7213c09e9ac51735eb51f  infra/licencias/space-os.pub
97c9a05cbb8cc64a6edb16275443c1c7359e7026299fa199bfad286dffaddb8d  scripts/migrar.mjs
```

La base del sistema (Docker, PostgreSQL, nginx, certbot, s3cmd, ufw 22/80/443;
tarda varios minutos y **espera sola** el candado de apt, `setup-droplet.sh:59-84`):
```bash
echo ok; bash /root/space-os-v0.12.5/infra/scripts/setup-droplet.sh > /root/setup-droplet.log 2>&1; echo "setup=$?"; tail -15 /root/setup-droplet.log
```
`setup=0` y el recuadro «BASE DEL SERVIDOR LISTA». Luego:
```bash
echo ok; sudo -u postgres psql -Atc "select current_setting('server_version')"; pg_restore --version; docker --version; docker compose version; nginx -v; certbot --version; command -v rsync s3cmd
```
- PostgreSQL **16.x**. Compara el menor con el `pg_dump --version` de §0.3: si
  el del nuevo es **menor**, apúntalo (ver §7); si `pg_restore` falla en §3.1
  por «unsupported version», se instala PGDG en el nuevo.
- `docker compose version` tiene que contestar (el plugin llega como
  recomendado de `docker-ce-cli`; si falta: `apt-get install -y docker-compose-plugin`).
- `rsync` y `s3cmd` con ruta.

Swap (g500 tiene 2 GB; `setup-droplet.sh` no lo pone), zona horaria y los
puertos de video (los mismos que abre `provision-instancia.sh:711`):
```bash
echo ok; fallocate -l 2G /swapfile; chmod 600 /swapfile; mkswap /swapfile; swapon /swapfile
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
timedatectl set-timezone Etc/UTC
for r in 8554/tcp 8189/udp 3478/tcp 3478/udp 49160:49200/udp; do ufw allow $r; done
swapon --show; free -m | head -3; timedatectl | grep 'Time zone'; ufw status | head -14
```
`ufw status` tiene que quedar **igual** que el del viejo en §0.3.

### 1.4 · Una llave efímera del viejo al nuevo
Los datos viajan **directo entre droplets** (red de DO), no por tu máquina.

[VIEJO]:
```bash
echo ok; ssh-keygen -t ed25519 -N '' -C mudanza-g500 -f /root/.ssh/mudanza_g500 >/dev/null; cat /root/.ssh/mudanza_g500.pub
```
Copia la línea `ssh-ed25519 … mudanza-g500`. [NUEVO] (pégala entre las comillas):
```bash
echo ok; echo '<LINEA ssh-ed25519 ... mudanza-g500>' >> /root/.ssh/authorized_keys; tail -1 /root/.ssh/authorized_keys | cut -c1-30
```
[VIEJO]:
```bash
echo ok; N=<IP_NUEVA>; ssh -i /root/.ssh/mudanza_g500 -o StrictHostKeyChecking=accept-new root@$N 'hostname; df -h / | tail -1'
```
Tiene que contestar `g500-nuevo` sin pedir contraseña.

### 1.5 · [VIEJO] Configuración, roles y estado → al nuevo (aún sin instalar)
```bash
echo ok; N=<IP_NUEVA>; K=/root/.ssh/mudanza_g500; mkdir -p /root/g500-mudanza && chmod 700 /root/g500-mudanza
sudo -u postgres pg_dumpall --roles-only 2>/dev/null | grep -E '^(CREATE|ALTER) ROLE spaces_(app|migrador)( WITH .*)?;$' > /root/g500-mudanza/roles.sql; chmod 600 /root/g500-mudanza/roles.sql
sed -E "s/PASSWORD '[^']*'/PASSWORD '***'/" /root/g500-mudanza/roles.sql
tar czf /root/g500-mudanza/config.tgz --exclude='var/lib/space-os/respaldos' /etc/space-os /opt/space-os /var/lib/space-os /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/snippets /etc/nginx/conf.d /etc/letsencrypt /etc/cron.d /var/www /root/g500-mudanza/roles.sql 2>/dev/null
sha256sum /root/g500-mudanza/config.tgz
scp -i $K /root/g500-mudanza/config.tgz root@$N:/root/g500-config.tgz && ssh -i $K root@$N 'sha256sum /root/g500-config.tgz'
```
- `roles.sql` enmascarado: **4 líneas** (`CREATE ROLE` y `ALTER ROLE … WITH …
  PASSWORD '***'` de cada rol). Si sale otra cosa, **para**.
- Las dos huellas del `.tgz` **iguales**.
- El `.tgz` lleva **todos los secretos** de g500: no sale de los dos droplets.

### 1.6 · [NUEVO] Instalar la configuración (nada arranca todavía)
```bash
echo ok; V=/root/g500-viejo; mkdir -p $V && chmod 700 $V && tar xzf /root/g500-config.tgz -C $V
install -d -m 755 /etc/space-os && cp -a $V/etc/space-os/. /etc/space-os/
IP=$(curl -s http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address); echo "IP nueva: $IP"
cp -a /etc/space-os/eyes.env /etc/space-os/eyes.env.antes-mudanza
sed -i "s/^IP_PUBLICA=.*/IP_PUBLICA=$IP/" /etc/space-os/eyes.env; grep '^IP_PUBLICA=' /etc/space-os/eyes.env
bash -c '. /etc/space-os/instancia.env && echo "[$INSTANCIA] [$CANAL] [$DOCKER_OPCIONES_APP]"'
```
`IP nueva` = `<IP_NUEVA>`, y la última línea imprime los corchetes **sin error**
(`instancia.env` se ejecuta como bash, `update.sh` lo sourcea; guía 21 §B7).

Guiones del anfitrión desde `v0.12.5`, y el compose de g500 (D9):
```bash
echo ok; R=/root/space-os-v0.12.5; V=/root/g500-viejo
install -d -m 755 /opt/space-os /opt/space-os/eyes /var/log/space-os
install -m 750 $R/infra/scripts/update.sh          /opt/space-os/update.sh
install -m 750 $R/infra/scripts/respaldo.sh        /opt/space-os/respaldo.sh
install -m 750 $R/infra/scripts/respaldo-diario.sh /opt/space-os/respaldo-diario.sh
install -m 750 $R/infra/scripts/conexion-pg.sh     /opt/space-os/conexion-pg.sh
install -m 640 $R/scripts/migrar.mjs               /opt/space-os/migrar.mjs
install -m 750 $R/infra/scripts/update-eyes.sh     /opt/space-os/update-eyes.sh
install -m 640 $R/infra/eyes/mediamtx.yml          /opt/space-os/eyes/mediamtx.yml
install -m 640 $V/opt/space-os/eyes/docker-compose.yml /opt/space-os/eyes/docker-compose.yml
[ -f $V/opt/space-os/space-os.pub ] && install -m 644 $R/infra/licencias/space-os.pub /opt/space-os/space-os.pub
cp -a $V/var/lib/space-os /var/lib/
( cd /opt/space-os && find . -maxdepth 2 -type f | sort | xargs sha256sum )
```
Las huellas de `/opt/space-os` tienen que ser las de §1.3 (y el compose, la del
viejo en §0.3).

nginx y el certificado (copiados; D10):
```bash
echo ok; V=/root/g500-viejo
cp -a $V/etc/letsencrypt /etc/
cp -a $V/etc/nginx/sites-available/g500.space-os.io /etc/nginx/sites-available/
cp -a $V/etc/nginx/snippets/space-eyes*.conf /etc/nginx/snippets/
ln -sfn /etc/nginx/sites-available/g500.space-os.io /etc/nginx/sites-enabled/g500.space-os.io
cp -an $V/var/www/. /var/www/; mkdir -p /var/www/html/.well-known/acme-challenge
ls -l /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx && echo NGINX_OK
certbot certificates 2>/dev/null | grep -E 'Domains|Expiry'
```
`sites-enabled` con **solo** `g500.space-os.io` (`setup-droplet.sh:149` ya quitó
`default`), `NGINX_OK` y el certificado de `g500.space-os.io` (vence 2026-12-08).
Si §0.3 listó otros archivos propios en `nginx -T`, cópialos igual desde `$V`.

### 1.7 · Las imágenes
[VIEJO] — las cinco de Space Eyes, por la red y sin tocar el disco:
```bash
echo ok; N=<IP_NUEVA>; K=/root/.ssh/mudanza_g500
IMGS=$(docker ps -a --filter label=com.docker.compose.project=space-eyes --format '{{.Image}}' | sort -u); echo $IMGS
docker save $IMGS | gzip -1 | ssh -i $K root@$N 'gunzip | docker load'
for i in $IMGS; do echo "$i  viejo=$(docker image inspect -f '{{.Id}}' $i | cut -c8-19)  nuevo=$(ssh -i $K root@$N docker image inspect -f '{{.Id}}' $i | cut -c8-19)"; done
```
En cada línea, **`viejo` = `nuevo`**. (Deben salir `space-eye:0.16.24-local`,
`mysql:8.0`, `redis:7-alpine`, `bluenviron/mediamtx:1.19.3`, `coturn/coturn:4.6`.)

[NUEVO] — la de la app, del registro, **por digest** (la misma que corre g500):
```bash
echo ok; set -a; . /etc/space-os/instancia.env; set +a
printf '%s' "$REGISTRY_TOKEN" | docker login "${REGISTRY%%/*}" -u "$REGISTRY_TOKEN" --password-stdin
docker pull 'registry.digitalocean.com/registryspaces/space-os@sha256:e6608ac9f02f3ca4d4917dfa8255d6b6ef6769a4d78623e449542982a1b8e15d'
docker image inspect -f '{{.Id}}' 'registry.digitalocean.com/registryspaces/space-os@sha256:e6608ac9f02f3ca4d4917dfa8255d6b6ef6769a4d78623e449542982a1b8e15d'
```
Compara ese `Id` con el de [VIEJO] `docker inspect -f '{{.Image}}' space-os`:
**iguales**. Si el `pull` falla (la etiqueta se borró del registro al limpiar
cuota), llévala como las de Space Eyes: en [VIEJO]
`docker save "$(docker inspect -f '{{.Config.Image}}' space-os)" | gzip -1 | ssh -i $K root@$N 'gunzip | docker load'`,
y en §3.3 usa ese nombre en lugar de `registry.digitalocean.com/registryspaces/space-os@sha256:e6608ac9f02f3ca4d4917dfa8255d6b6ef6769a4d78623e449542982a1b8e15d`.

### 1.8 · Los volúmenes: crearlos y la PRECOPIA en caliente
[NUEVO] — `create` hace los volúmenes con las etiquetas de compose sin arrancar nada:
```bash
echo ok; docker compose -p space-eyes -f /opt/space-os/eyes/docker-compose.yml --env-file /etc/space-os/eyes.env create; docker volume ls --format '{{.Name}}' | grep space-eyes; docker ps --format '{{.Names}}'
```
Cuatro volúmenes `space-eyes_*` y **ningún** contenedor corriendo.

[VIEJO] — primera pasada con g500 en uso (lo grande viaja ahora, no en el corte):
```bash
echo ok; N=<IP_NUEVA>; K="ssh -i /root/.ssh/mudanza_g500"; D=/var/lib/docker/volumes
for v in fotos descargas base redis; do echo "== $v"; rsync -aHAX --numeric-ids --info=stats1 -e "$K" $D/space-eyes_$v/_data/ root@$N:$D/space-eyes_$v/_data/; done
```
Esta pasada de `base` (MySQL en marcha) **no vale como copia**: solo adelanta
bytes. La buena es la de §2.3, con la pila parada.

---

## 2 · El corte (g500 deja de atender)

### 2.1 · [VIEJO] Parar la app y la API de Space Eyes; respaldo lógico de MySQL
```bash
echo ok; docker stop space-os space-eyes-api-1
docker exec space-eyes-mysql-1 sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --no-tablespaces space_eye 2>/dev/null' | gzip > /root/g500-mudanza/space_eye.sql.gz
zcat /root/g500-mudanza/space_eye.sql.gz | tail -1; ls -l /root/g500-mudanza/space_eye.sql.gz
```
La última línea del volcado tiene que decir `-- Dump completed …` (mismo criterio
que `update-eyes.sh:142-145`). Si no, **`docker start space-os space-eyes-api-1` y para.**

Los conteos de MySQL — **este mismo bloque se pega igual en §3.2**:
```bash
echo ok; docker exec -i space-eyes-mysql-1 sh <<'FIN' | tee /root/eyes-conteos.txt | md5sum
P="$MYSQL_ROOT_PASSWORD"
for t in $(mysql -uroot -p"$P" -N -B -e "select table_name from information_schema.tables where table_schema='space_eye' and table_type='BASE TABLE' order by table_name" 2>/dev/null); do
  printf '%s %s\n' "$t" "$(mysql -uroot -p"$P" -N -B -e "select count(*) from space_eye.\`$t\`" 2>/dev/null)"
done
FIN
cp /root/eyes-conteos.txt /root/g500-mudanza/
```
Anota el **md5** (y mira que la lista traiga tablas con números).

### 2.2 · [VIEJO] Parar todo, y dejarlo seguro de encender (D13)
```bash
echo ok; docker stop space-eyes-mediamtx-1 space-eyes-coturn-1 space-eyes-redis-1 space-eyes-mysql-1
docker update --restart=no space-os space-eyes-api-1 space-eyes-mediamtx-1 space-eyes-coturn-1 space-eyes-redis-1 space-eyes-mysql-1 >/dev/null
mkdir -p /root/cron-desactivado-mudanza && mv /etc/cron.d/space-os* /root/cron-desactivado-mudanza/; ls /root/cron-desactivado-mudanza
docker ps --format '{{.Names}}'
```
`docker ps` **vacío** (o sin `space-os` ni `space-eyes-*`), y la carpeta con los
archivos de cron que había (`space-os-update`, `space-os-eyes`…).

### 2.3 · [VIEJO] El respaldo de la base, sus conteos y la pasada final
```bash
echo ok; F=/root/g500-mudanza/spaces.dump
sudo -u postgres pg_dump -Fc -d spaces > $F; echo "pg_dump=$?"; ls -l $F
sudo -u postgres pg_restore -l < $F | head -4
sudo -u postgres psql -d spaces -Atc "select (select count(*) from tenants)||'/'||(select count(*) from usuarios)||'/'||(select count(*) from sitios)||'/'||(select count(*) from propuestas)||'/'||(select count(*) from campanas)||'/'||(select count(*) from arrendadores)"
find /etc/space-os -newer /root/g500-mudanza/config.tgz -type f
```
`pg_dump=0`, un archivo de **varios MB** (el del 29/09 pesaba 13,8 MB), el
listado de `pg_restore -l`, `1/5/13/11/11/6`, y el `find` **vacío** (nadie tocó la
configuración desde §1.5; si sale un archivo, cópialo a mano igual que en §1.5).

La huella de la base — **este bloque se pega igual en §3.1**:
```bash
echo ok; cat > /root/conteos-pg.sql <<'FIN'
\pset tuples_only on
\pset format unaligned
select 'tabla '||table_name||' '||(xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name;
select 'dueno '||pg_get_userbyid(c.relowner)||' '||c.relkind::text||' '||count(*) from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' group by c.relowner, c.relkind order by 1;
select 'tipo '||pg_get_userbyid(t.typowner)||' '||count(*) from pg_type t join pg_namespace s on s.oid=t.typnamespace where s.nspname='public' and t.typtype in ('e','d') group by t.typowner order by 1;
select 'permisos '||grantee||' '||count(*) from information_schema.role_table_grants where table_schema='public' group by grantee order by 1;
select 'politicas '||count(*) from pg_policies where schemaname='public';
select 'migraciones '||count(*) from schema_migrations;
FIN
sudo -u postgres psql -d spaces -X -q < /root/conteos-pg.sql > /root/pg-conteos.txt; wc -l < /root/pg-conteos.txt; md5sum < /root/pg-conteos.txt
cp /root/pg-conteos.txt /root/g500-mudanza/
```
Anota el **md5**. (Corre como `postgres`, que atraviesa la RLS: cuenta todo.)

Pasada final de los volúmenes (la pila está parada: ahora sí es la copia buena)
y envío de los respaldos:
```bash
echo ok; N=<IP_NUEVA>; K="ssh -i /root/.ssh/mudanza_g500"; D=/var/lib/docker/volumes
for v in fotos descargas; do echo "== $v"; rsync -aHAX --numeric-ids --delete --info=stats1 -e "$K" $D/space-eyes_$v/_data/ root@$N:$D/space-eyes_$v/_data/; done
for v in base redis; do echo "== $v"; rsync -aHAX --numeric-ids --delete --checksum --info=stats1 -e "$K" $D/space-eyes_$v/_data/ root@$N:$D/space-eyes_$v/_data/; done
cd /root/g500-mudanza && sha256sum spaces.dump space_eye.sql.gz pg-conteos.txt eyes-conteos.txt > sumas.txt && scp -i /root/.ssh/mudanza_g500 spaces.dump space_eye.sql.gz pg-conteos.txt eyes-conteos.txt sumas.txt root@$N:/root/g500-viejo/ && $K root@$N 'cd /root/g500-viejo && sha256sum -c sumas.txt'; cd /
for v in fotos descargas; do echo "$v: $(find $D/space-eyes_$v/_data -type f | wc -l) archivos, $(du -sb $D/space-eyes_$v/_data | cut -f1) bytes"; done
```
Las cuatro `rsync` sin error, `sha256sum -c` con **4 × `OK`**, y anota los
archivos/bytes de fotos y descargas.

---

## 3 · Restaurar y arrancar en el nuevo

### 3.1 · [NUEVO] Roles, base vacía, restauración
```bash
echo ok; sudo -u postgres psql -v ON_ERROR_STOP=1 -q < /root/g500-viejo/root/g500-mudanza/roles.sql; echo "roles=$?"
sudo -u postgres psql -Atc "select rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls from pg_roles where rolname like 'spaces_%' order by 1"
locale -a | grep -iE '^(c\.utf-?8|en_us\.utf-?8)$'
```
`roles=0`, y las dos filas **idénticas** a las de §0.3 (`spaces_app` con
`rolbypassrls=f`, `spaces_migrador` con `t`: las recetas de `base-instancia.sh:96-132`).
Si el `C.UTF-8` del censo no aparece en `locale -a`:
`locale-gen C.UTF-8 && systemctl restart postgresql`.

La base **vacía**, con la misma codificación y orden que la de g500 (y dueño
`spaces_migrador`, `base-instancia.sh:138-140`); luego la restauración:
```bash
echo ok; sudo -u postgres psql -v ON_ERROR_STOP=1 -c "create database spaces owner spaces_migrador encoding 'UTF8' lc_collate 'C.UTF-8' lc_ctype 'C.UTF-8' template template0"
sudo -u postgres pg_restore -d spaces --exit-on-error --single-transaction < /root/g500-viejo/spaces.dump; echo "restore=$?"
sudo -u postgres vacuumdb -q --analyze-only -d spaces; echo "analyze=$?"
```
`restore=0`. **Si no, no sigas**: pega la salida. (Como es una sola transacción,
no queda nada a medias: `drop database spaces` y se repite tras corregir.)

La huella — pega **el mismo bloque `conteos-pg.sql` de §2.3** y compara:
```bash
echo ok; diff /root/pg-conteos.txt /root/g500-viejo/pg-conteos.txt && echo "BASE IDENTICA"
sudo -u postgres psql -d spaces -Atc "select (select count(*) from tenants)||'/'||(select count(*) from usuarios)||'/'||(select count(*) from sitios)||'/'||(select count(*) from propuestas)||'/'||(select count(*) from campanas)||'/'||(select count(*) from arrendadores)"
sudo -u postgres psql -d spaces -Atc "select version_instalada, digest_instalado, aprobado_digest is not null from actualizaciones_instancia"
```
`BASE IDENTICA` (filas por tabla, dueños, tipos, permisos, políticas y
migraciones), `1/5/13/11/11/6` y `v0.12.5|<digest>|f`.

Que no queda migración pendiente, con el runner **de la imagen** (el mismo que
usa `update.sh`; la URL sale del entorno, no se imprime):
```bash
echo ok; set -a; . /etc/space-os/instancia.env; set +a
docker run --rm --network host -e DATABASE_URL 'registry.digitalocean.com/registryspaces/space-os@sha256:e6608ac9f02f3ca4d4917dfa8255d6b6ef6769a4d78623e449542982a1b8e15d' node scripts/migrar.mjs --pendientes; echo "codigo=$?"
```
`codigo=0` y `… (0 de esquema, N de datos)`. Las de datos (p. ej.
`20260731_calendario_meses_cortos.sql`) son a propósito: `update.sh` no pasa
`--con-datos` (guía 21 §B6). **Si dice 3, no uses `--forzar-checksum`**: pega la salida.

### 3.2 · [NUEVO] Space Eyes
```bash
echo ok; docker compose -p space-eyes -f /opt/space-os/eyes/docker-compose.yml --env-file /etc/space-os/eyes.env up -d
sleep 30; docker ps --format '{{.Names}}  {{.Status}}'
curl -s -o /dev/null -w 'eyes %{http_code}\n' http://127.0.0.1:4200/api/app/version
docker logs space-eyes-mysql-1 2>&1 | grep -iE '\[ERROR\]|ready for connections' | tail -4
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' space-eyes-mediamtx-1 | grep ADDITIONALHOSTS
```
Cinco `space-eyes-*` en `Up`, `eyes 200` o `401` (los dos son «vivo»,
`update-eyes.sh:109`), MySQL `ready for connections` sin `[ERROR]`, y MediaMTX
con **`<IP_NUEVA>`**.

Los conteos de MySQL: pega **el mismo bloque de §2.1** (sin el `cp` final) y luego:
```bash
echo ok; diff /root/eyes-conteos.txt /root/g500-viejo/eyes-conteos.txt && echo "EYES IDENTICO"
D=/var/lib/docker/volumes; for v in fotos descargas; do echo "$v: $(find $D/space-eyes_$v/_data -type f | wc -l) archivos, $(du -sb $D/space-eyes_$v/_data | cut -f1) bytes"; done
```
`EYES IDENTICO` y los mismos archivos/bytes que en §2.3.

> **Si MySQL no arranca desde el volumen copiado** (log con `[ERROR]`): para la
> pila, vacía el volumen y carga el volcado lógico:
> `docker compose -p space-eyes -f /opt/space-os/eyes/docker-compose.yml --env-file /etc/space-os/eyes.env down` ·
> `rm -rf /var/lib/docker/volumes/space-eyes_base/_data/*` · `… up -d mysql` · esperar 40 s ·
> `zcat /root/g500-viejo/space_eye.sql.gz | docker exec -i space-eyes-mysql-1 sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" space_eye'` · `… up -d`.
> Mismo procedimiento que `restaurar()` de `update-eyes.sh:148-157`.

### 3.3 · [NUEVO] La app (D7: el mismo `docker run` que `update.sh:2628-2637`)
```bash
echo ok; set -a; . /etc/space-os/instancia.env; set +a
read -r -a OPC <<<"$DOCKER_OPCIONES_APP"
docker run --detach --name "${CONTENEDOR:-space-os}" --restart unless-stopped --env-file "${ENV_APP:-/etc/space-os/app.env}" "${OPC[@]}" 'registry.digitalocean.com/registryspaces/space-os@sha256:e6608ac9f02f3ca4d4917dfa8255d6b6ef6769a4d78623e449542982a1b8e15d'
sleep 20; curl -s -o /dev/null -w 'version %{http_code}\n' "${SALUD_URL:-http://127.0.0.1:3000/spaces-dooh/api/version/}"
curl -s -o /dev/null -w 'metodos %{http_code}\n' http://127.0.0.1:3000/spaces-dooh/api/auth/metodos/
docker exec space-os node -e "fetch('http://127.0.0.1:4200/api/app/version').then(r=>console.log('app->eyes',r.status)).catch(e=>console.log('NO LLEGA',e.message))"
docker exec space-os node -v; free -m | head -2
```
`version 200`, `metodos 200`, `app->eyes 200` o `401`, `v22.23.4`, y memoria
`available` holgada (> ~400 MB con swap aparte).

---

## 4 · Comprobar, mover el DNS y probar de verdad

### 4.1 · [PC] El sitio en la máquina nueva ANTES del DNS
(`curl.exe`, no el alias de PowerShell)
```powershell
curl.exe -s -o NUL -w "app %{http_code}`n"  --resolve g500.space-os.io:443:<IP_NUEVA> https://g500.space-os.io/spaces-dooh/api/auth/metodos/
curl.exe -s -o NUL -w "login-post %{http_code}`n" --resolve g500.space-os.io:443:<IP_NUEVA> -X POST https://g500.space-os.io/spaces-dooh/api/auth/login/ -H "Content-Type: application/json" -d '{\"email\":\"no@existe.invalid\",\"password\":\"x\"}'
curl.exe -s -o NUL -w "eyes %{http_code}`n" --resolve g500.space-os.io:443:<IP_NUEVA> https://g500.space-os.io/api/app/version
curl.exe -s -o NUL -w "apk %{http_code}`n"  --resolve g500.space-os.io:443:<IP_NUEVA> https://g500.space-os.io/space-eye.apk
```
`app 200`, **`login-post 401`** (el único que demuestra que la app habla con su
base, `docs/runbook-alta-de-owner.md:199-213`), `eyes 200|401`, `apk 200`.
**Si algo de §3 o de aquí falla, no muevas el DNS**: ve a §5.

### 4.2 · [Cloudflare] Mover el DNS
Registro **A** de `g500` → `<IP_NUEVA>`, nube **gris**. Si había AAAA (§0.1),
apúntalo a la IPv6 nueva o bórralo. Luego [PC]:
```powershell
Resolve-DnsName g500.space-os.io -Type A -Server 1.1.1.1
Resolve-DnsName g500.space-os.io -Type A -Server 8.8.8.8
```
Los dos con `<IP_NUEVA>` (con TTL 1 min, en uno o dos minutos).

### 4.3 · Prueba real (navegador en `https://g500.space-os.io`)
1. Entra con una cuenta real (la sesión que tuvieras abierta **debería seguir
   viva**: las sesiones viajan en la base, D4). Abre **Dashboard**, **Inventario**,
   una **campaña** y una **propuesta** (su PDF).
2. **DOOHmain**: abre la vista previa de programación de una campaña publicada.
   Es la primera llamada saliente desde la IP nueva (ver §7).
3. Si había clave de Maps: el buscador de calles de **Comercial negociación**.
4. **Space Eyes**: los equipos reconectan solos por el dominio (pueden tardar
   unos minutos). Que salgan **en línea**, pide **una foto** y abre **el vivo**
   de uno (el vivo es el que usa TURN e `IP_PUBLICA`).

### 4.4 · [NUEVO] El cron, el respaldo diario y los actualizadores
El cron de g500 tal cual (D12), más el respaldo diario si g500 no lo tenía:
```bash
echo ok; for f in /root/g500-viejo/etc/cron.d/space-os*; do install -m 644 "$f" /etc/cron.d/; done
[ -f /etc/cron.d/space-os-respaldo ] || printf '%s\n' '# El respaldo sale del droplet TODOS LOS DIAS (guia 12, decision del 22/09).' 'SHELL=/bin/bash' 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' '41 3 * * * root /opt/space-os/respaldo-diario.sh >> /var/log/space-os/cron.log 2>&1' > /etc/cron.d/space-os-respaldo
chmod 644 /etc/cron.d/space-os*; grep -H -v '^#' /etc/cron.d/space-os* | grep -v ':\s*$'
/opt/space-os/respaldo-diario.sh; echo "respaldo=$?"
ls -ld /var/lib/space-os/respaldos; ls -l /var/lib/space-os/respaldos | tail -2
```
- Las líneas de cron **iguales** a las del censo de §0.3, más la de las 03:41.
- `respaldo=0` y en el log `respaldo remoto OK` (sale al bucket de siempre,
  prefijo `g500/`). Con `5` el dump está y la subida falló: mira el 403/404
  (guía 12, A2). Directorio `drwx------` y dump `-rw-------`.

Los dos actualizadores, en modo «solo mirar»:
```bash
echo ok; /opt/space-os/update.sh --comprobar; echo "update=$?"; tail -n 5 /var/log/space-os/update.log
/opt/space-os/update-eyes.sh --comprobar; echo "eyes=$?"
```
`update=0` con `sin cambios` (o `esperando-aprobacion` si `estable` se movió
desde §0.3: correcto, nada se instala sin aprobar) y `eyes=0` con `al dia`.
`update.sh` reporta al PADRE en cada corrida: en el **panel de flota**, g500 tiene
que aparecer con un reporte de hace minutos.

### 4.5 · [NUEVO] El certificado nace en la máquina nueva
Con el DNS ya apuntando aquí (D10):
```bash
echo ok; certbot renew --cert-name g500.space-os.io --force-renewal 2>&1 | tail -4
nginx -t && systemctl reload nginx && echo NGINX_OK
certbot certificates 2>/dev/null | grep -E 'Domains|Expiry'
certbot renew --dry-run 2>&1 | tail -3; systemctl is-active certbot.timer
```
Caducidad nueva (~90 días desde hoy), `NGINX_OK`, el `--dry-run` en verde y el
temporizador `active`. Si la emisión fallara, **el certificado copiado sigue
sirviendo hasta el 08/12**: no hay prisa ni se reintenta a ciegas (5 por hora).

### 4.6 · Cerrar la mudanza
[NUEVO] — retirar la llave efímera:
```bash
echo ok; sed -i '/mudanza-g500$/d' /root/.ssh/authorized_keys; grep -c mudanza-g500 /root/.ssh/authorized_keys
```
(`0`). [VIEJO] — borrar su mitad y **apagar**:
```bash
echo ok; rm -f /root/.ssh/mudanza_g500 /root/.ssh/mudanza_g500.pub; docker ps --format '{{.Names}}'; ls /etc/cron.d | grep space-os || echo "sin cron de space-os"; poweroff
```
**[Cloudflare]**: el TTL de `g500` de vuelta a **Auto** al día siguiente.

---

## 5 · Vuelta atrás

**Antes de mover el DNS** (falla algo de §3 o §4.1): el viejo solo está parado.

[NUEVO] — que el nuevo no haga nada:
```bash
echo ok; docker stop space-os; docker compose -p space-eyes -f /opt/space-os/eyes/docker-compose.yml --env-file /etc/space-os/eyes.env stop; rm -f /etc/cron.d/space-os*; docker ps --format '{{.Names}}'
```
[VIEJO] — devolverle el cron, el arranque automático y arrancar:
```bash
echo ok; mv /root/cron-desactivado-mudanza/space-os* /etc/cron.d/
docker update --restart=unless-stopped space-os space-eyes-api-1 space-eyes-mediamtx-1 space-eyes-coturn-1 space-eyes-redis-1 space-eyes-mysql-1 >/dev/null
docker start space-eyes-mysql-1 space-eyes-redis-1 space-eyes-mediamtx-1 space-eyes-coturn-1 space-eyes-api-1 space-os
sleep 20; curl -s -o /dev/null -w 'app %{http_code}\n' http://127.0.0.1:3000/spaces-dooh/api/auth/metodos/; curl -s -o /dev/null -w 'eyes %{http_code}\n' http://127.0.0.1:4200/api/app/version
```
**Después de mover el DNS**: primero **[Cloudflare]** el A de `g500` de vuelta a
`142.93.113.106`; si el viejo ya está apagado, **[Panel DO] enciéndelo** (arranca
sin contenedores ni cron, D13); y luego los dos bloques de arriba.

> [!danger] Lo capturado en el nuevo después del DNS NO vuelve solo
> Si ya entraron datos reales en el nuevo (propuestas, fotos), la vuelta atrás
> los deja fuera. **No la hagas sin hablarlo**: se pueden traer repitiendo §2–3
> en sentido contrario (volcado del nuevo → base vacía en el viejo).

---

## 6 · Después

- **El viejo, apagado e intacto** hasta reutilizarlo como DEMO (otra guía). Se
  sigue cobrando apagado; **no se destruye**. Quedó seguro de encender (D13),
  pero **antes de reutilizarlo hay que quitarle la identidad de g500**: en
  `/etc/space-os` lleva `FLOTA_TOKEN` (reportaría al PADRE como g500), las
  claves de Spaces con prefijo `g500/` (subiría respaldos al de g500), la clave
  de **DOOHmain** (publicaría campañas en la cuenta real), Google, Resend y Maps;
  y en sus volúmenes, la base de equipos y las fotos de un cliente. Y su
  `/root/g500-mudanza/` tiene la base entera en claro.
- **En el nuevo, a la semana** (con g500 en uso sin problemas): borra el material
  de la mudanza, que lleva secretos y la base en claro:
  `rm -rf /root/g500-viejo /root/g500-config.tgz /root/eyes-conteos.txt /root/pg-conteos.txt /root/conteos-pg.sql`.
  Y en Google Cloud, quita `142.93.113.106` de la clave de Maps.
- **[Panel DO]**: renombra los droplets para que no se confundan
  (`g500-nuevo` → `g500`, el viejo → `g500-viejo-futura-demo`).
- **La bóveda**: la IP vieja sigue en `space-eye/docs/ARQUITECTURA_SPACE_EYES.md`
  (que describe el presente) y en guías históricas (23, 25, 29), que se dejan.
- **Siguen pendientes, y no son de esta guía**: la variante de Space Eyes «mismo
  dominio» de g500 no está en `main` (D9); el 403 del bucket de logs
  (`space-os-logs`, guía 21); y que **Space Eyes no tiene respaldo fuera del
  droplet** (ver §7).

---

## 7 · Lo que NO está verificado, y los riesgos

- **Esta guía no se ha corrido nunca.** Sus piezas sí tienen historia: la
  restauración de g500 en un PostgreSQL 16 vacío se ensayó en local el 29/09
  (guía 21), `setup-droplet.sh` corrió en las altas de 22.04; **en 24.04 no
  se ha corrido nunca** (la guía 21 lo dejó dicho y la parte B no se usó).
- **Roles por `pg_dumpall --roles-only`**: el filtro `grep` está pensado para
  la salida de PostgreSQL 16 (`CREATE ROLE x;` + `ALTER ROLE x WITH … PASSWORD '…';`).
  Por eso §1.5 enseña las líneas enmascaradas antes de usarlas.
- **Versión menor de PostgreSQL**: g500 corre el 16 de PGDG y 24.04 trae el 16
  de Ubuntu. Dentro de la misma mayor el formato custom no debería cambiar, pero
  no se ha medido entre estas dos. Señal: `pg_restore` diría `unsupported version`.
- **El `datadir` de MySQL copiado en crudo** con la misma imagen: es el camino
  normal de Docker, pero aquí es la primera vez. Para eso está el volcado lógico
  de §2.1 y el rescate de §3.2.
- **`docker save`/`docker load` de `space-eye:0.16.24-local`**: nunca se ha
  movido de máquina. Se compara el `Id` a los dos lados (§1.7).
- **El compose de g500 no es el de `main`** (D9): lo que corre g500 viene de una
  rama sin fusionar. Si §0.3 muestra otra huella que `5d77716f…`, se copia igual,
  pero hay que mirarlo.
- **El arranque manual de la app (D7)** sustituye a `update.sh` solo en esta
  primera vez; desde ahí manda el cron. El camino «base que ya dice instalado +
  host sin contenedor» **no lo cubre ningún guion** del repositorio.
- **IP de salida nueva**: la clave de **Google Maps** de servidor se restringe
  por IP (§1.1). Si **DOOHmain** filtrara por IP de origen, publicar fallaría:
  no hay nada en el repo que lo diga ni lo descarte, por eso §4.3 lo prueba.
- **Los equipos reconectan solos** por el dominio (commit `7202c8b1`, compose de
  g500 «nunca la guardan»). Un equipo que guardara la IP no volvería: se mira en §4.3.
- **Certificado**: copiarlo y reemitir es estándar en certbot, pero la
  renovación en el nuevo solo queda demostrada tras §4.5.
- **Space Eyes NO tiene respaldo fuera del droplet**: `respaldo-diario.sh` solo
  vuelca PostgreSQL (no menciona MySQL ni fotos), aunque el ADR 0045 dice que
  «el diario lo extiende». `update-eyes.sh` respalda MySQL solo antes de
  actualizar, y en el mismo disco. Las fotos no se respaldan en ningún sitio.
  Era así en el viejo y sigue así en el nuevo.
- **El respaldo diario es nuevo en g500** si el censo lo confirma ausente (D12):
  el `respaldo=0` de §4.4 es su primera corrida real ahí.

## Preguntas abiertas para el dueño

1. **La ventana**: día y hora, y quién avisa a los usuarios de g500 (la app y los
   equipos se cortan ~60–90 min).
2. **Backups de DigitalOcean** en el droplet nuevo (+20 % del precio): ¿igual que
   el viejo, o activarlos?
3. **¿Instantánea del viejo antes de convertirlo en DEMO?** Es la última vuelta
   atrás completa; cuesta por GB al mes.
4. **Space Eyes sin respaldo fuera del droplet** (§7): ¿se encarga como trabajo
   aparte?
5. **¿Reserved IP para g500?** Con una IP reservada, la próxima mudanza no
   tocaría ni el DNS ni `IP_PUBLICA`. No se ha probado coturn detrás de una.
6. **La línea de las 04:17 de `update.sh`** está comentada en g500 desde el
   23/09 (guía 16): esta guía la copia **comentada**. ¿Se queda así?

Ver también: `docs/evidencias/29-mover-g500-a-2gb-copia-exacta-20261027.md`
(la alternativa por instantánea), `21-publicar-y-mover-g500-20260930.md` §B,
`12-instalar-respaldo-diario.txt`, `23-agregar-space-eyes-a-g500.md` y
`vault/01-Arquitectura/entorno-y-despliegue.md`.

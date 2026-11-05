# Convertir el droplet viejo de g500 en la DEMO de `https://demo.space-os.io`

> Preparada el 2026-11-05 a partir de la decisión del dueño del mismo día
> ([ADR 0050](../adr/0050-demo-space-os-io-vuelve-como-la-demo-en-el-droplet-viejo-de-g500.md),
> que sustituye al 0024). **La corre una persona**: Claude no entra a servidores
> (ni `ssh`, ni `scp`, ni `psql` remoto, ni `doctl`, ni `gh`). Cada bloque dice
> **dónde** va:
>
> | Marca | Dónde |
> |---|---|
> | **[Panel DO]** | panel web de DigitalOcean |
> | **[Cloudflare]** | panel de Cloudflare, zona `space-os.io` |
> | **[GitHub]** | `github.com/emiliano-cyber/spaces_dooh_new` (o `gh` en tu máquina) |
> | **[Google Cloud]** | consola de Google Cloud → APIs y servicios → Credenciales |
> | **[VIEJO]** | bash en la consola web de DO del droplet viejo (`142.93.113.106`) |
> | **[GH500]** | bash en la consola web de DO de g500 de hoy (`159.65.221.205`) — solo lee |
> | **[PADRE]** | bash en la consola web de DO del PADRE |
> | **[PC]** | PowerShell en tu máquina |
> | **[PC-bash]** | **Git Bash** en tu máquina (el aprovisionamiento es un guion bash) |
>
> La consola web de DigitalOcean **se come el primer carácter** de cada pegado:
> por eso todo bloque bash empieza con `echo ok;`. **Pega un bloque cada vez**, y
> en la consola **no uses `exit` ni `set -e`**: cerrarían la sesión. Antes de
> cada pegado **mira el prompt** (`root@g500…` / `root@gh500…` / `root@demo…`):
> en la guía 30 dos bloques acabaron en el droplet equivocado.
>
> Valores con marcador: `<REPO>` (tu checkout, p. ej.
> `C:\Users\Server\spaces_doohmain_nueva`), `<LLAVE>` (la llave SSH de tu PC con
> la que entras al viejo, p. ej. `~/.ssh/spaces_deploy`), `<CORREO_LE>` (la cuenta
> de Let's Encrypt). **Ningún bloque imprime una contraseña ni un token.**

## Qué es y qué no es esta guía

**Es** el camino para que el droplet viejo de g500 —apagado e intacto desde la
mudanza del 04/11 (guía 30, D13)— **deje de ser g500** y pase a ser **la DEMO**:
una instancia instalada **exactamente como la de un owner** (`provision-instancia.sh`,
`/etc/space-os/instancia.env`, `update.sh` por cron, nginx de `instancia.conf.tpl`),
con la única diferencia de que sigue el canal **`beta`**, con datos de
demostración sembrados por el repositorio y con el nombre `demo.space-os.io`.

**No es**:
- la mudanza de g500 (guía 30): esa está cerrada y **g500 vive en `gh500`**;
- la promoción de la v0.12.6, que se hace **hoy con la DEMO del PADRE**
  (contenedor `space-os-demo`, `prueba.space-os.io`,
  `SPACE_OS_CONF=/etc/space-os/demo-instancia.env`). Esta guía solo cambia
  `DEMO_URL` al final (§6), cuando la nueva corra la versión que se vaya a promover;
- Space Eyes en la DEMO (ver P3): si el dueño lo quiere, es otra guía.

---

## Las decisiones de esta guía, con su porqué

| # | Decisión | Por qué (evidencia en el repo) |
|---|---|---|
| D1 | **Recomendado: reinstalar el disco desde cero (*Rebuild*, camino A)** en vez de vaciarlo (camino B) | El disco viejo tiene la base de g500, **dos** veces (cluster 16 en el 5432 y el 14 parado en el 5433 desde el 01/10), sus secretos en `/etc/space-os`, la base en claro en `/root/g500-mudanza/`, volúmenes de Space Eyes con fotos de un cliente, su certificado y logs (guía 30 §0.3 bis y §6). Vaciarlo a mano es acertar con la lista entera; el *Rebuild* no depende de acertar. DigitalOcean conserva la IP en un *Rebuild* (ver §7). |
| D2 | **La instancia se da de alta con `provision-instancia.sh --host`**, desde tu PC, con el árbol de `v0.12.6` **exportado sin CRLF** | Es el alta de un owner (`docs/runbook-alta-de-owner.md`): roles con claves nuevas, esquema y `--instalacion-nueva`, `app.env`/`instancia.env` desde las plantillas con un `BOOTSTRAP_TOKEN` y un `FLOTA_TOKEN` **nuevos** (`provision-instancia.sh:915`), nginx solo HTTP y el cron de `update.sh` (`:1008-1009`). Sube `update.sh`, `respaldo.sh` y `migrar.mjs` **leyéndolos de tu disco** (`remoto_escribir … < "$RAIZ/…"`), así que desde un checkout de Windows con `core.autocrlf=true` llegarían en CRLF: es la trampa que dejó a g500 un día sin actualizarse (`vault/01-Arquitectura/entorno-y-despliegue.md`, aviso del 08/10). Por eso se exporta con `git -c core.autocrlf=false archive` (guía 30, D11). Con `--host` el guion **no** corre `setup-droplet.sh` (solo lo hace con `--crear-droplet`): se corre a mano antes (§3.2). |
| D3 | **`CANAL=beta`** y **`modo = automatica`** en `actualizaciones_instancia` | DEMO es el banco de pruebas de `beta` (invariante 13; `provision-instancia.sh:132` lo admite como desviación consciente). El modo por omisión es `aprobacion` (`db/migrations/20260921_actualizaciones_instancia.sql:58`), y con él, en una base recién instalada, `update.sh` sale con «esperando-aprobacion … Esperar no es un error» (`update.sh:2428`) **sin levantar el contenedor** — deducido del código, ver §3.5 y §7. En `automatica`, la corrida de las 04:17 (y la que lances a mano) instala sola. |
| D4 | **Sin `--bootstrap`: la organización y sus usuarios los crean las semillas** | El bootstrap crea un Dueño que entra **solo con Google** y sin Google configurado responde 503 (`provision-instancia.sh:689`). Las semillas crean la organización `demo` y **ocho usuarios con contraseña**, uno por rol (`docs/datos/20261103_base_demo_nueva.md` §5), sin ninguna integración externa. La puerta `/api/bootstrap` se cierra sola en cuanto existe una organización. |
| D5 | **Las semillas se corren DENTRO de la imagen**, montando `scripts/` del paquete | En la instancia no hay Node ni repositorio (invariante 1), y la imagen **no lleva las semillas a propósito** (lista blanca de `Dockerfile:106` y `:117`). La imagen sí lleva `pg`, que es lo único que importan (`scripts/migrar.mjs` corre ahí con el mismo `import pg`). Se usa el rol **migrador** (`instancia.env`), como hace `sembrar-catalogo-demo.sh` en el PADRE. |
| D6 | **MXN y documentos en español** | Las dos semillas crean la organización en **MXN** (`semilla-catalogo-demo.mjs:1663`, `semilla-demo.mjs:733`) y no fijan idioma (por omisión `es`, ADR 0049). Moneda e idioma **no se pueden cambiar después** (ADR 0048/0049). Otra moneda u otro idioma de documentos exigiría tocar las semillas: ver P5. El idioma **de la interfaz** lo elige cada persona igual. |
| D7 | **Nada de g500 se reutiliza**: ni claves, ni tokens, ni la cuenta de DOOHmain, ni Google, ni Resend, ni Maps | La plantilla `infra/env/app.env.example` deja todo eso vacío y `DOOHMAIN_PUBLISH_ENABLED=0`. La DEMO no publica en DOOHmain ni manda correos ni geocodifica salvo que el dueño dé credenciales **de prueba** (P4). |
| D8 | **`DEMO_URL = https://demo.space-os.io/spaces-dooh`**, con el *basePath* y sin barra ni punto final | `promover.yml` prueba `"$DEMO_URL/login/"` y `"$DEMO_URL/api/auth/metodos/"` (`.github/workflows/promover.yml:250-261`). Sin `/spaces-dooh` esas rutas caen en la app fuera del *basePath* y no dan 200; el propio workflow lo enseña así en su mensaje de error (`:125`). El guard de caracteres (`:132-136`) **deja pasar un punto final**: `…/spaces-dooh.` pasaría la validación y fallaría el smoke. |
| D9 | **La DEMO del PADRE no se toca** hasta la primera promoción validada contra la nueva | Es la vuelta atrás del flujo de publicación. §8 deja escrito cómo apagarla de forma reversible, cuando el dueño lo decida (P7). |

---

## 0 · Antes de empezar

### 0.1 · Preguntas que contesta el dueño (Claude no decide ninguna)

| | Pregunta | Recomendación | Afecta a |
|---|---|---|---|
| **P1** | **¿Reinstalar el disco desde cero (*Rebuild*, camino A) o vaciar en sitio lo de g500 y reutilizar el sistema (camino B)?** | **A.** Es la única forma de no depender de una lista de borrado. B deja además Ubuntu 22.04 y PGDG del 01/10 | §2 |
| **P2** | **Tras esta guía, el disco viejo deja de ser la vuelta atrás de la mudanza de g500.** Y es la **única otra copia** de las fotos y el MySQL de Space Eyes de g500, que **no tienen respaldo fuera del droplet** (guía 30 §7). ¿Se acepta, se hace antes una instantánea del viejo en DO (lleva datos y secretos del cliente: privada, con fecha de borrado), o se espera a resolver el respaldo de Space Eyes? | Instantánea con fecha de borrado (p. ej. 30 días), **o** esperar al respaldo de Space Eyes. Borrar sin ninguna de las dos es decisión expresa | §2.1 |
| **P3** | ¿La DEMO lleva **Space Eyes**? | **No.** La base de demo se diseñó sin Space Eye «a propósito: en la demo se enseña con lo que ya tiene la instancia g500» (`docs/datos/20261103_base_demo_nueva.md`). Con Space Eyes haría falta `--con-eyes`, el DNS `eyes.demo.space-os.io` y su imagen: otra guía | — |
| **P4** | ¿Qué cuenta de **DOOHmain** usa la DEMO? | **Ninguna** (`DOOHMAIN_PUBLISH_ENABLED=0`, el de la plantilla). Si una de pruebas: su `DOOHMAIN_API_KEY` y su mapa de pantallas, **nunca** los de g500 | §3.6 |
| **P5** | ¿**Idioma de los documentos** y **moneda** de la instancia DEMO? | **`es` y `MXN`**: es lo que crean las semillas (D6) y no se puede cambiar después. USD o `en`/`it` piden antes un cambio en las semillas (tarea de código aparte) | §3.6 |
| **P6** | ¿La DEMO sube **respaldo fuera del droplet** (bucket `space-os-respaldos`, prefijo `demo/`)? | **Sí**, con la misma llave de Spaces de solo respaldos que use la flota (decisión del 22/09: el respaldo diario es de todas las instancias). Sus datos se pueden volver a sembrar, pero lo que se pruebe a mano en ella no | §3.4 |
| **P7** | ¿Qué pasa con **`prueba.space-os.io`** y el contenedor `space-os-demo` del PADRE cuando la nueva funcione? | Mantenerla **hasta la primera promoción validada contra la nueva** y luego apagarla (§8). Su certificado caduca el **29/11** y no se renueva (aviso del 01/10 en `entorno-y-despliegue`) | §6, §8 |
| **P8** | ¿Existe el secreto **`FLOTA_TOKEN`** en GitHub, y se cambia al de la DEMO nueva? | Si existe, **sí**: es lo que hace que `promover.yml` compruebe **qué versión corre DEMO** (`promover.yml:279-289`). Con el token de la DEMO vieja, contra la nueva el resumen dirá «NO COMPROBADO» | §6.3 |
| **P9** | ¿Qué correo recibe los avisos de **Let's Encrypt** (`CERTBOT_EMAIL`)? | El de AS OOH que ya use el PADRE | §4.4 |
| **P10** | ¿**Backups de DigitalOcean** en el droplet DEMO? Y si el viejo los tenía activados, **sus copias guardan datos de g500** | DEMO sin Backups (se resiembra). Las copias antiguas del viejo: borrarlas o dejarlas caducar, como en P2 | §2.1 |

### 0.2 · Precondiciones — si una no se cumple, **para**

- **La mudanza de g500 está cerrada de verdad** (guía 30 §4.2–§4.6):
  [PC]
  ```powershell
  Resolve-DnsName g500.space-os.io -Type A -Server 1.1.1.1
  ```
  Tiene que decir **`159.65.221.205`** (gh500), no `142.93.113.106`.
- **gh500 ya tiene respaldo fuera del droplet** (la base de g500 existe fuera del
  viejo). [GH500], solo lee:
  ```bash
  echo ok; grep -h 'respaldo remoto OK' /var/log/space-os/*.log 2>/dev/null | tail -2; ls /etc/cron.d | grep space-os
  ```
  Al menos una línea `respaldo remoto OK` reciente y el cron `space-os-respaldo`.
  Si no hay ninguna, **no borres el viejo**: es la única otra copia de la base.
- **P1, P2 y P9 contestadas.** Sin ellas no se pasa de §1.

### 0.3 · [PC] El paquete de `v0.12.6`, sin CRLF
```powershell
cd <REPO>
git fetch emiliano --tags
git rev-parse v0.12.6
git -c core.autocrlf=false archive --format=tar.gz -o $HOME\Downloads\space-os-v0.12.6-infra.tgz v0.12.6 infra scripts
Get-FileHash $HOME\Downloads\space-os-v0.12.6-infra.tgz
```
`git rev-parse` tiene que decir `34f36a54629d…`. **No quites el
`-c core.autocrlf=false`** (D2). El paquete lleva `infra/` (plantillas, guiones,
nginx) y `scripts/` (el runner y las semillas).

[PC-bash] — el mismo paquete descomprimido, que es desde donde corre el
aprovisionamiento:
```bash
mkdir -p ~/space-os-v0.12.6 && tar xzf ~/Downloads/space-os-v0.12.6-infra.tgz -C ~/space-os-v0.12.6 && cd ~/space-os-v0.12.6
grep -rlI $'\r' infra scripts || echo "sin CRLF"
sha256sum infra/scripts/provision-instancia.sh infra/scripts/base-instancia.sh infra/scripts/entorno-instancia.sh infra/scripts/update.sh infra/scripts/respaldo.sh scripts/migrar.mjs
```
Tiene que decir `sin CRLF` y **exactamente** (calculadas sobre `git show v0.12.6:<ruta>`):
```
4a1d26344af35ecead1cbe8f1ce115b81d32d337a8d6adbb6ebd3be7d12bf789  infra/scripts/provision-instancia.sh
4b1a5a560fe98ecf66bcc4d6f4bda9f8516b68e54cb7e2a69c30261f5c718a46  infra/scripts/base-instancia.sh
3477bc5b78aeaa3e1d05544ba3c8ff2bba05a8b77c609d77faf1618edab68d15  infra/scripts/entorno-instancia.sh
8672d6b797608ce2f71f538e8e261b27ec44b43b649302bd73633f15d913c816  infra/scripts/update.sh
1e33dcc081096167b072d8e435bb0885f6958b4820153d8aa106b22347bf5a59  infra/scripts/respaldo.sh
97c9a05cbb8cc64a6edb16275443c1c7359e7026299fa199bfad286dffaddb8d  scripts/migrar.mjs
```
`update.sh` y `respaldo.sh` son los mismos bytes que en `v0.12.5` (las huellas de
la guía 30 §1.3). Si una no cuadra, **para**.

---

## 1 · Encender el viejo sin que haga nada, y comprobarlo

> **Camino A:** este paso **solo hace falta si el panel no deja reconstruir con
> el droplet apagado** (o si quieres mirar antes de borrar). Si el *Rebuild* se
> deja hacer apagado, salta a §2.

### 1.1 · [Panel DO]
Droplet viejo (`142.93.113.106`) → **Power → Turn on**. Abre la **consola web**.

### 1.2 · [VIEJO] Que no arrancó nada, y que no va a arrancar
```bash
echo ok; hostname; ip -4 -o addr show eth0 | awk '{print $4}'
docker ps --format '{{.Names}}'; echo "--- politicas:"; docker inspect -f '{{.Name}} {{.HostConfig.RestartPolicy.Name}}' $(docker ps -aq) 2>/dev/null
ls /etc/cron.d | grep space-os || echo "sin cron de space-os"; crontab -l 2>/dev/null | grep -v '^#' || echo "sin crontab de root"
ls /root/cron-desactivado-mudanza
systemctl is-active nginx postgresql certbot.timer docker
```
Tiene que salir: la IP `142.93.113.106/…`, **`docker ps` vacío**, todas las
políticas en **`no`**, `sin cron de space-os`, `sin crontab de root` (o solo
comentarios) y la carpeta con los cron apartados (`space-os-update`,
`space-os-eyes`…). Si sale un contenedor corriendo o un cron de `space-os`,
**para**: el viejo no quedó como dice la guía 30 (D13).

Lo que **sí** está activo y conviene callar ya: nginx sigue sirviendo el sitio
de `g500.space-os.io` (con 502, sin app detrás) y el temporizador de certbot
intentaría renovar el certificado de g500 desde el **08/11** (vence el 08/12) —
fallaría, porque el nombre ya apunta a gh500, y gastaría intentos de Let's Encrypt
de ese nombre:
```bash
echo ok; systemctl stop nginx certbot.timer; systemctl disable certbot.timer 2>/dev/null; systemctl is-active nginx certbot.timer
```
Dos `inactive`. (En el camino A esto se va con el disco; en el B, `setup` y el
alta los vuelven a poner en marcha.)

---

## 2 · Quitarle la identidad de g500

Nada de lo que quede puede **reportar como g500**, **subir a su prefijo del
bucket** ni **publicar en el DOOHmain real**. Primero lo que vive **fuera** del
droplet (vale para A y B); luego el disco.

### 2.1 · Fuera del droplet

**[Cloudflare]** — que ningún nombre apunte todavía al viejo:
- Busca `142.93.113.106` en la lista de registros. **No tiene que salir ninguno**
  (el A de `g500` ya va a `159.65.221.205`). Si sale alguno (p. ej. un resto de
  Space Eyes), anótalo y bórralo.
- Mira el registro de **`demo`**: anota a qué IP apunta hoy (lo esperable es
  `209.97.146.136`, la máquina de julio del ADR 0024) y si hay **AAAA**. No lo
  cambies todavía (§4).

**[Google Cloud]** — Credenciales → cada **clave de API** → *Restricciones de
aplicación → Direcciones IP*. Si alguna lista **`142.93.113.106`** (la guía 30
§6 mandaba quitarla «a la semana»), **quítala ahora**: desde hoy esa IP es la
DEMO, y una clave de g500 que la admita dejaría a la DEMO usarla en nombre de
g500. El censo del 04/11 dijo «MAPS: sin clave» en g500, así que lo esperable es
no encontrar ninguna.

**[Panel DO]** — en el droplet viejo:
- **Backups** (P10): si estaban activados, las copias semanales **llevan la base
  y los secretos de g500**. Desactívalos y borra las copias, o anota cuándo
  caducan.
- **Instantánea** (P2): si el dueño la pidió, **ahora**: *Snapshots → Take live
  snapshot* con nombre `g500-viejo-antes-de-demo-20261105`. Lleva datos y
  secretos de un cliente: **anota la fecha en que se borra**.

**DOOHmain**: no hay nada en el repositorio que diga si DOOHmain filtra por IP de
origen (guía 30 §7). Si la cuenta de g500 tuviera una lista de IP permitidas en
DOOHmain, **quita `142.93.113.106`**. La DEMO, en todo caso, nace con
`DOOHMAIN_PUBLISH_ENABLED=0` y sin clave (D7).

**Panel de flota y bucket**: no hay nada que hacer fuera. g500 se identifica ante
el PADRE por su `FLOTA_TOKEN` (no por IP) y sube al prefijo `g500/` por su
`INSTANCIA` y sus claves de Spaces: **las dos cosas viven en el disco del viejo**
y se van en §2.2.

### 2.2 · El disco — camino A (recomendado): *Rebuild*

**[Panel DO]** droplet viejo → **Destroy → Rebuild Droplet** (no «Destroy
Droplet», que lo elimina y **libera la IP**):
- Imagen: **Ubuntu 24.04 (LTS) x64** (D1 de la guía 30: PostgreSQL 16 de
  serie, lo que exige `provision-instancia.sh`, que se para con menos de 15).
- Confirma. Al terminar, comprueba en la ficha del droplet que la **IPv4 sigue
  siendo `142.93.113.106`**. Si cambiara, **para**: todo lo que sigue y el DNS
  usan esa IP.
- **Renómbralo** a `demo` (y quita las etiquetas de g500, si las tenía).

[PC] — la máquina cambió de huella SSH, y la vieja está en tu `known_hosts`:
```powershell
ssh-keygen -R 142.93.113.106
ssh -i <LLAVE> -o StrictHostKeyChecking=accept-new root@142.93.113.106 "hostname; lsb_release -ds"
```
Tiene que contestar sin contraseña con `Ubuntu 24.04…`. **Si pide contraseña o
dice `Permission denied`**, el *Rebuild* no puso tu llave: entra por la
**consola web** y pega tu llave pública (el contenido de `<LLAVE>.pub`):
```bash
echo ok; mkdir -p /root/.ssh && chmod 700 /root/.ssh; echo '<CONTENIDO DE LLAVE.pub>' >> /root/.ssh/authorized_keys; chmod 600 /root/.ssh/authorized_keys; tail -1 /root/.ssh/authorized_keys | cut -c1-30
```

[VIEJO] — que el disco es nuevo de verdad:
```bash
echo ok; hostnamectl | grep -E 'hostname|Operating'; ls -A /root
ls /etc/space-os /opt/space-os /var/lib/space-os /root/g500-mudanza /etc/letsencrypt 2>&1 | head -5
command -v docker psql nginx certbot || echo "SISTEMA LIMPIO"
```
`Ubuntu 24.04`, en `/root` solo lo de serie (`.bashrc`, `.profile`, `.ssh`, quizá
`.cache`/`snap`), **«No such file or directory»** para los cinco directorios y
`SISTEMA LIMPIO`. Con eso la identidad de g500 **no existe en el disco**: no hay
nada que buscar. Sigue en §3.

### 2.3 · El disco — camino B (solo si el dueño lo eligió): vaciar en sitio

> Más pasos y más riesgo de dejarse algo: por eso termina con la comprobación de
> §2.3.6, que es la que da el paso por bueno, y no la lista.

#### 2.3.1 · [VIEJO] La lista de valores secretos de g500, sin imprimirlos
Se guarda **antes** de borrar, para buscar después si alguno quedó en algún sitio.
Se excluye `REGISTRY_TOKEN`: es la credencial de **solo lectura** del registro,
común a toda la flota, y la DEMO la usará también.
```bash
echo ok; umask 077; F=/root/.g500-secretos
grep -hE '^[A-Z_]*(TOKEN|SECRET|KEY|PASSWORD|PASS|LLAVE|TESTIGO|DATABASE_URL)[A-Z_]*=' /etc/space-os/*.env /etc/space-os/*.env.* 2>/dev/null \
  | grep -v '^REGISTRY_TOKEN=' | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//" | awk 'length($0)>=12' | sort -u > $F
wc -l < $F; ls -l $F
```
Un número de valores (decenas: app, instancia, Space Eyes) y el archivo
`-rw-------`. **No lo abras.**

#### 2.3.2 · [VIEJO] Contenedores, volúmenes e imágenes
```bash
echo ok; docker rm -f $(docker ps -aq) 2>/dev/null; docker volume rm $(docker volume ls -q) 2>/dev/null
docker image prune -af >/dev/null; docker network prune -f >/dev/null; docker builder prune -af >/dev/null
rm -f /root/.docker/config.json
docker ps -a --format '{{.Names}}'; docker volume ls -q; docker images -q | wc -l
```
Las dos primeras listas **vacías** y `0` imágenes. Con esto se van la base de
equipos (MySQL), las fotos y descargas de Space Eyes, la imagen local
`space-eye:0.16.24-local`, el contenedor `space-os-antes-doohmain` y las
variables de entorno que Docker guardaba de cada contenedor (incluido el
`--env-file` de la app).

#### 2.3.3 · [VIEJO] Las bases de g500 (las dos)
```bash
echo ok; pg_lsclusters
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "drop database if exists spaces" -c "drop role if exists spaces_app" -c "drop role if exists spaces_migrador"
pg_dropcluster --stop 14 main 2>/dev/null; pg_lsclusters
sudo -u postgres psql -Atc "select datname from pg_database order by 1"
sudo -u postgres psql -Atc "select rolname from pg_roles where not (rolname ~ '^pg_') order by 1"
```
Al final: **un solo cluster** (`16 main 5432 online`), bases `postgres`,
`template0`, `template1` y **solo** el rol `postgres`. Si sale otra base u otro
rol, **para y avisa**. (El cluster 14 del 5433 era la vuelta atrás del 01/10 y
tenía **otra copia de la base de g500**.)

#### 2.3.4 · [VIEJO] Archivos: configuración, material de la mudanza, certificado, nginx, logs
```bash
echo ok; rm -rf /root/g500-mudanza /root/cron-desactivado-mudanza /root/eyes-conteos.txt /root/pg-conteos.txt /root/conteos-pg.sql /root/.ssh/mudanza_g500 /root/.ssh/mudanza_g500.pub /root/space-os-v0.12.5 /root/space-os-v0.12.5-infra.tgz
rm -rf /etc/space-os /opt/space-os /var/lib/space-os /var/log/space-os; rm -f /etc/cron.d/space-os*
certbot delete --non-interactive --cert-name g500.space-os.io 2>&1 | tail -1
rm -f /etc/nginx/sites-enabled/g500.space-os.io /etc/nginx/sites-available/g500.space-os.io /etc/nginx/snippets/space-eyes*.conf
ls -A /var/www; rm -rf /var/www/*; mkdir -p /var/www/html/.well-known/acme-challenge
rm -f /var/log/nginx/*; journalctl --rotate >/dev/null 2>&1; journalctl --vacuum-time=1s >/dev/null 2>&1
: > /root/.bash_history
for r in 8554/tcp 8189/udp 3478/tcp 3478/udp 49160:49200/udp; do ufw delete allow $r >/dev/null 2>&1; done; ufw status | head -10
hostnamectl set-hostname demo; hostname
```
`ufw` con **solo** 22, 80 y 443 (los de Space Eyes se cierran: P3) y el nombre
`demo`. El `ls -A /var/www` enseña lo que había antes de borrarlo (la APK de
Space Eyes, el webroot de ACME): anótalo si sale algo raro.

#### 2.3.5 · [VIEJO] Volcados sueltos que se hayan quedado en otra parte
```bash
echo ok; find / -xdev \( -name '*.dump' -o -name '*.sql' -o -name '*.sql.gz' -o -name '*.tgz' -o -name '*.tar.gz' \) -size +50k -not -path '/usr/*' -not -path '/snap/*' -not -path '/var/lib/docker/*' -not -path '/proc/*' 2>/dev/null | head -20
```
**Vacío.** Si sale algo (p. ej. el respaldo previo a la subida a PostgreSQL 16
del 01/10, o un `.tgz` de configuración), míralo con `ls -l` y bórralo.

#### 2.3.6 · [VIEJO] La comprobación: ningún secreto de g500 y ninguna mención de g500
```bash
echo ok; F=/root/.g500-secretos
grep -rIlF -f $F /etc /opt /var /root /home /srv /usr/local 2>/dev/null | grep -vxF "$F" || echo "NINGUN SECRETO DE g500"
grep -rIl 'g500' /etc /opt /var/www /var/lib /var/log /root /home 2>/dev/null | grep -v '^/var/lib/docker/overlay2/' | head -20 || true
```
- La primera línea tiene que decir **`NINGUN SECRETO DE g500`**. Si lista
  archivos, son sitios donde **sigue** un valor de g500: bórralos o edítalos y
  repite. (Imprime solo **nombres de archivo**, nunca el valor.)
- La segunda tiene que salir **vacía** o con menciones inocuas que puedas
  explicar una por una (p. ej. la lista de paquetes). Un archivo de configuración
  con `g500` dentro **no** es inocuo.

Y solo entonces, el archivo de la lista:
```bash
echo ok; shred -u /root/.g500-secretos; ls /root/.g500-secretos 2>&1
```
`No such file or directory`.

> **Lo que el camino B deja y el A no:** Ubuntu **22.04** (soporte hasta
> abril de 2027), PostgreSQL 16 de **PGDG** (paquete de la subida del 01/10) en
> vez del de Ubuntu, y el resto de lo que se haya instalado a mano en g500 (guía 28,
> paso 0). `setup-droplet.sh` **no se corre** en B: en 22.04 instalaría el 14.

---

## 3 · Dejarlo como instancia DEMO

### 3.1 · [PC] Subir el paquete
```powershell
scp -i <LLAVE> $HOME\Downloads\space-os-v0.12.6-infra.tgz root@142.93.113.106:/root/
```

### 3.2 · [VIEJO] Comprobar el paquete y la base del sistema
```bash
echo ok; mkdir -p /root/space-os-v0.12.6 && tar xzf /root/space-os-v0.12.6-infra.tgz -C /root/space-os-v0.12.6 && cd /root/space-os-v0.12.6
grep -rlI $'\r' infra scripts || echo "sin CRLF"
sha256sum infra/scripts/setup-droplet.sh infra/scripts/respaldo-diario.sh infra/scripts/conexion-pg.sh scripts/semilla-demo.mjs scripts/semilla-catalogo-demo.mjs scripts/semilla-catalogo-modulos.mjs scripts/semilla-arte-demo.mjs scripts/semilla-pdf-demo.mjs; cd /
```
`sin CRLF` y **exactamente**:
```
d3ebb4eba7517fc20f27664368dacf131adc489f3874eab61d7c175411796c0d  infra/scripts/setup-droplet.sh
7b775bd02563c268a596ec99aa095c5dece52818b1dca6409684d799ad7494a0  infra/scripts/respaldo-diario.sh
f3240e431d12779d976c6cf66b281681d2ec67d87b703999e2d6c8b7b9c47f93  infra/scripts/conexion-pg.sh
dc2baa6f5b4269cd78e801ec4bfe0315c277dd80a65e0d53882fb51d06317f35  scripts/semilla-demo.mjs
e0b419aee241809b0dd5a51b1c01d9b75f99b15a717380dcde59a658925451e3  scripts/semilla-catalogo-demo.mjs
1ad2617eb55d827ee1228d0165e005ae687a7d00e253b70baa04e49380b91ecc  scripts/semilla-catalogo-modulos.mjs
01d92ec41f3f427aa01e60ea02cb5b7aff495fc145dc6088cdfff47cb0ef483f  scripts/semilla-arte-demo.mjs
8c6455b8c13e4b51bac7e0810f9dce935824dc46bbffe521bda75305b21440dc  scripts/semilla-pdf-demo.mjs
```

**Solo camino A** — la base del sistema (Docker, PostgreSQL 16, nginx, certbot,
s3cmd, ufw 22/80/443; tarda varios minutos y espera sola el candado de apt):
```bash
echo ok; bash /root/space-os-v0.12.6/infra/scripts/setup-droplet.sh > /root/setup-droplet.log 2>&1; echo "setup=$?"; tail -8 /root/setup-droplet.log
```
`setup=0` y «BASE DEL SERVIDOR LISTA». Luego swap (2 GB, como g500), zona del
sistema y nombre:
```bash
echo ok; fallocate -l 2G /swapfile; chmod 600 /swapfile; mkswap /swapfile; swapon /swapfile
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
timedatectl set-timezone Etc/UTC; hostnamectl set-hostname demo
sudo -u postgres psql -Atc "select current_setting('server_version')"; docker --version; nginx -v; certbot --version; swapon --show; ufw status | head -8
```
PostgreSQL **16.x**, swap de 2 GB, `ufw` con 22, 80 y 443.

**Camino B**: no se corre `setup-droplet.sh`; basta con levantar lo que §1.2 paró:
```bash
echo ok; systemctl start nginx; systemctl enable --now certbot.timer; systemctl is-active nginx postgresql docker certbot.timer
```

### 3.3 · [PC-bash] Que el aprovisionamiento entre por SSH
`provision-instancia.sh` entra con `ssh root@<host>` a secas, sin `-i`: tu
`ssh` tiene que saber qué llave usar. En `~/.ssh/config` (créalo si no existe):
```
Host 142.93.113.106
  User root
  IdentityFile <LLAVE>
  IdentitiesOnly yes
```
y comprueba:
```bash
ssh -o BatchMode=yes root@142.93.113.106 'hostname; sudo -u postgres psql -Atc "select 1"'
```
`demo` y `1`, sin pedir nada.

### 3.4 · [PC-bash] Simular y aprovisionar
Las credenciales **por entorno**, nunca en la línea (`ps` y el historial las verían;
`provision-instancia.sh:132-182`). `read -rs` no las enseña:
```bash
cd ~/space-os-v0.12.6
export REGISTRY=registry.digitalocean.com/registryspaces CANAL=beta
read -rs -p "REGISTRY_TOKEN (solo lectura): " REGISTRY_TOKEN; echo; export REGISTRY_TOKEN
# P6 = si (respaldo fuera del droplet):
read -rs -p "SPACES_KEY: " SPACES_KEY; echo; read -rs -p "SPACES_SECRET: " SPACES_SECRET; echo
export SPACES_KEY SPACES_SECRET SPACES_BUCKET=space-os-respaldos SPACES_REGION=sfo3
bash infra/scripts/provision-instancia.sh --host 142.93.113.106 --dominio demo.space-os.io --instancia demo --dry-run
```
(Si **P6 = no**: no exportes las `SPACES_*` y añade `--sin-respaldo-remoto` aquí
y en la corrida de abajo.)

Lee la simulación entera: cada línea `[SIMULACION]` es lo que va a hacer. Tiene
que hablar de `demo.space-os.io`, de la imagen `…/space-os:beta` y de
`/etc/space-os/{app,instancia}.env`. **Ninguna línea puede decir `g500`.** Luego,
de verdad:
```bash
bash infra/scripts/provision-instancia.sh --host 142.93.113.106 --dominio demo.space-os.io --instancia demo --confirmar 2>&1 | tee ~/provision-demo-20261105.log | tail -40
unset REGISTRY_TOKEN SPACES_KEY SPACES_SECRET
```
Tiene que acabar con el recuadro **«APROVISIONAMIENTO HECHO — Y AQUI SE PARA A
PROPOSITO»** y la instrucción del DNS. **No sigas sus dos órdenes finales tal
cual**: el certificado va en §4.4 y el `--bootstrap` **no se corre** (D4).
Mira además las líneas de «Levantando la aplicacion»: ver §3.5.

### 3.5 · [VIEJO] La aplicación en marcha, en `beta` y en modo automático
```bash
echo ok; docker ps --format '{{.Names}}  {{.Image}}  {{.Status}}'; tail -n 4 /var/log/space-os/update.log
sudo -u postgres psql -d spaces -Atc "select modo, coalesce(version_instalada,'-'), coalesce(version_disponible,'-') from actualizaciones_instancia"
```
Lo que **cabe esperar por el código** (D3, no medido): ningún contenedor, el log
diciendo `esperando-aprobacion … Esperar no es un error; no se toca nada` y la
fila `aprobacion|-|v0.12.6`. Si en cambio ya hay un `space-os` en `Up`, mejor:
sáltate el `update.sh` de abajo, pero pon igualmente el modo.

La DEMO toma **sola** cada `beta`:
```bash
echo ok; sudo -u postgres psql -d spaces -c "update actualizaciones_instancia set modo = 'automatica', actualizado_en = now()"
/opt/space-os/update.sh; echo "update=$?"; tail -n 6 /var/log/space-os/update.log
docker ps --format '{{.Names}}  {{.Status}}'
```
`UPDATE 1`, `update=0`, el log con la versión instalada y la salud en 200, y
`space-os` en `Up`. (Si sale otro código, **no repitas**: pega el log; la tabla de
códigos está en `infra/scripts/README.md`.)

Qué versión sirve, por las dos vías (la etiqueta de la imagen y la propia app; el
token se lee del archivo y **no se imprime**):
```bash
echo ok; docker inspect -f '{{index .Config.Labels "org.opencontainers.image.version"}}  {{.Config.Image}}' space-os
T=$(sed -n 's/^FLOTA_TOKEN=//p' /etc/space-os/app.env); curl -s -H "X-Flota-Token: $T" http://127.0.0.1:3000/spaces-dooh/api/version/ | grep -oE '"(version|canal)":"[^"]*"'; unset T
```
`v0.12.6  registry…/space-os:beta`, `"version":"v0.12.6"` y `"canal":"beta"`.

### 3.6 · [VIEJO] La configuración: que no hable con nada de g500 ni con nadie real
Muestra **nombres y si tienen valor**, nunca el valor (salvo los que no son
secretos):
```bash
echo ok; ls -l /etc/space-os
grep -E '^(INSTANCIA|CANAL|SPACES_BUCKET|SPACES_REGION|LOGS_BUCKET|FLOTA_REPORTE_URL|DOMINIO)=' /etc/space-os/instancia.env
grep -E '^(APP_URL|CANAL|TZ|DOOHMAIN_PUBLISH_ENABLED|GOOGLE_OAUTH|AUTOREGISTRO)=' /etc/space-os/app.env
awk -F= '/^(RESEND_API_KEY|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|GOOGLE_MAPS_SERVIDOR_KEY|DOOHMAIN_API_KEY|SPACE_EYE_BASE_URL|SPACE_EYE_KEY)=/{print $1"="(length($2)?"(CON VALOR)":"(vacio)")}' /etc/space-os/app.env
grep -c 'g500' /etc/space-os/*.env
```
- `instancia.env`: `INSTANCIA=demo`, `CANAL=beta`, bucket y región de P6 (o
  vacíos), `FLOTA_REPORTE_URL=` vacío.
- `app.env`: `APP_URL=https://demo.space-os.io`, `CANAL=beta`,
  `DOOHMAIN_PUBLISH_ENABLED=0`, `GOOGLE_OAUTH=0`, `AUTOREGISTRO=0`.
- Las siete de la tercera línea **`(vacio)`** — salvo que P4 haya dado una cuenta
  **de pruebas** de DOOHmain. Si es así, se pone ahora con `nano
  /etc/space-os/app.env` (`DOOHMAIN_API_KEY`, `DOOHMAIN_SCREEN_MAP`,
  `DOOHMAIN_PUBLISH_ENABLED=1`) y se reinicia con `docker restart space-os`.
- `grep -c 'g500'`: **`0`** en los dos archivos.
- Los archivos en `-rw-------` de root.

### 3.7 · [VIEJO] La base de demostración (semillas, dentro de la imagen — D5)
La organización `demo` y el guion de rentabilidad (dos pantallas comparables,
razones sociales y cuatro trimestres cerrados):
```bash
echo ok; set -a; . /etc/space-os/instancia.env; set +a; IMG=$(docker inspect -f '{{.Config.Image}}' space-os); S=/root/space-os-v0.12.6/scripts
docker run --rm --network host -e DATABASE_URL -v $S:/app/semillas:ro "$IMG" node /app/semillas/semilla-demo.mjs --org=demo --org-nombre='Space OS Demo' --verificar 2>&1 | tail -25; echo "guion=${PIPESTATUS[0]}"
```
`guion=0` y el resumen de `--verificar` con las cifras medidas. Si dice
**`Cannot find module 'pg'`**, la imagen no resuelve `pg` desde `/app/semillas`:
repite montando cada archivo **dentro** de `/app/scripts/`
(`-v $S/semilla-demo.mjs:/app/scripts/semilla-demo.mjs:ro`, y en el catálogo
también sus tres ayudantes) y llamando a `node /app/scripts/semilla-demo.mjs`.

El catálogo (un ejemplo en cada módulo y ocho usuarios, uno por rol). Primero
solo mira:
```bash
echo ok; set -a; . /etc/space-os/instancia.env; set +a; IMG=$(docker inspect -f '{{.Config.Image}}' space-os); S=/root/space-os-v0.12.6/scripts
docker run --rm --network host -e DATABASE_URL -v $S:/app/semillas:ro "$IMG" node /app/semillas/semilla-catalogo-demo.mjs --org=demo --comprobar 2>&1 | tail -5
```
`--comprobar: la base admite el catalogo. No se escribio nada.` Luego siembra; la
contraseña de los ocho usuarios se teclea **sin eco** (10 caracteres o más) y
viaja por entorno:
```bash
echo ok; read -rs -p "Contrasena de los usuarios demo (10+): " SEMILLA_CLAVE; echo; export SEMILLA_CLAVE
docker run --rm --network host -e DATABASE_URL -e SEMILLA_CLAVE -v $S:/app/semillas:ro "$IMG" node /app/semillas/semilla-catalogo-demo.mjs --org=demo 2>&1 | tail -8; echo "catalogo=${PIPESTATUS[0]}"
docker run --rm --network host -e DATABASE_URL -e SEMILLA_CLAVE -v $S:/app/semillas:ro "$IMG" node /app/semillas/semilla-catalogo-demo.mjs --org=demo 2>&1 | grep -i 'filas nuevas'
unset SEMILLA_CLAVE
```
`catalogo=0` y, en la segunda corrida, **`filas nuevas: 0`** (idempotente). En
local la primera metió **1224 filas** (guion: 253); la cifra de hoy puede variar
un poco con el calendario.

Que la base es **solo** de demostración:
```bash
echo ok; sudo -u postgres psql -d spaces -Atc "select slug, moneda, idioma_documentos from tenants"
sudo -u postgres psql -d spaces -Atc "select count(*) filter (where email like '%.invalid'), count(*) from usuarios"
```
**Una sola fila**, `demo|MXN|es` (D6), y todos los usuarios en `.invalid`
(`9|9` o `8|8`, según cuente el Dueño del catálogo). **Apunta la contraseña de
los usuarios demo** donde guarde las suyas el dueño: no queda escrita en ningún
otro sitio.

### 3.8 · [VIEJO] Guiones del anfitrión al día y en LF, respaldo diario y cron
`provision-instancia.sh` sube `update.sh`, `respaldo.sh` y `migrar.mjs` y el cron
de actualizar, pero **no** el respaldo diario (`entorno-y-despliegue`, punto 3
del recuadro del 05/10). Se instalan desde el paquete y se comparan **todas** las
huellas:
```bash
echo ok; R=/root/space-os-v0.12.6
install -m 750 $R/infra/scripts/respaldo-diario.sh /opt/space-os/respaldo-diario.sh
install -m 750 $R/infra/scripts/conexion-pg.sh     /opt/space-os/conexion-pg.sh
( cd /opt/space-os && sha256sum update.sh respaldo.sh respaldo-diario.sh conexion-pg.sh migrar.mjs )
grep -rlI $'\r' /opt/space-os || echo "sin CRLF en /opt/space-os"
```
Las cinco huellas tienen que ser **exactamente** las de §0.3 y §3.2:
`update.sh` `8672d6b7…`, `respaldo.sh` `1e33dcc0…`, `respaldo-diario.sh`
`7b775bd0…`, `conexion-pg.sh` `f3240e43…`, `migrar.mjs` `97c9a05c…`, y
`sin CRLF en /opt/space-os`. Una huella de `update.sh` distinta es **la trampa del
08/10** (CRLF): `sed -i 's/\r$//' /opt/space-os/update.sh` y vuelve a medir.

El cron (el de actualizar lo dejó el alta; el respaldo se añade):
```bash
echo ok; printf '%s\n' '# Respaldo diario de la DEMO (guia 31). Ver vault/06-Operacion/respaldo-diario.md' 'SHELL=/bin/bash' 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' '41 3 * * * root /opt/space-os/respaldo-diario.sh >> /var/log/space-os/cron.log 2>&1' > /etc/cron.d/space-os-respaldo
chmod 644 /etc/cron.d/space-os-*; grep -H -v '^#' /etc/cron.d/space-os-* | grep -v ':\s*$'
/opt/space-os/respaldo-diario.sh; echo "respaldo=$?"; ls -ld /var/lib/space-os/respaldos; ls -l /var/lib/space-os/respaldos | tail -2
/opt/space-os/update.sh --comprobar; echo "comprobar=$?"; tail -n 3 /var/log/space-os/update.log
```
- Cron: `space-os-update` con `*/15 … --comprobar` y `17 4 * * *`
  (`provision-instancia.sh:1008-1009`), y `space-os-respaldo` con `41 3`.
- `respaldo=0` y en el log **`respaldo remoto OK`** (al prefijo **`demo/`**) si
  P6 = sí; con P6 = no, el dump local y el aviso de «respaldo remoto NO
  CONFIGURADO» (es lo elegido, no un fallo). Directorio `drwx------`.
- `comprobar=0` con `sin cambios`.

---

## 4 · El nombre `demo.space-os.io` y su certificado

### 4.1 · [PC] El sitio en la máquina ANTES del DNS
El alta dejó nginx **solo en HTTP**, contestando 503 a todo salvo al desafío de
ACME (`provision-instancia.sh:960`):
```powershell
curl.exe -s -o NUL -w "http %{http_code}`n" --resolve demo.space-os.io:80:142.93.113.106 http://demo.space-os.io/
```
`http 503`. Si sale otra cosa, **no muevas el DNS**.

### 4.2 · [Cloudflare] Mover el DNS
Registro **A** de **`demo`** → **`142.93.113.106`**, **nube gris** («DNS only»;
con la naranja el certificado se pide para Cloudflare y no para la máquina,
`docs/runbook-alta-de-owner.md` §3), TTL **1 min**. Si había **AAAA** (§2.1),
**bórralo**: el droplet no lleva IPv6 y un AAAA a la máquina de julio partiría el
tráfico. Si no existía registro `demo`, créalo.

### 4.3 · [PC] Comprobar que ya resuelve aquí
```powershell
Resolve-DnsName demo.space-os.io -Type A -Server 1.1.1.1
Resolve-DnsName demo.space-os.io -Type A -Server 8.8.8.8
Resolve-DnsName demo.space-os.io -Type AAAA -Server 1.1.1.1
```
Las dos primeras con **solo** `142.93.113.106`; la tercera **sin** respuesta AAAA.
**Si no, no sigas**: el certificado gastaría uno de los cinco intentos por hora.

### 4.4 · [PC-bash] El certificado y el nginx definitivo
```bash
cd ~/space-os-v0.12.6
export CERTBOT_EMAIL=<CORREO_LE>
bash infra/scripts/provision-instancia.sh --host 142.93.113.106 --dominio demo.space-os.io --emitir-certificado --confirmar 2>&1 | tail -12
```
Termina con **`login 200`** (el propio guion lo comprueba desde el servidor). Usa
`certbot --webroot` y la plantilla `infra/nginx/instancia.conf.tpl`.

[VIEJO] — que se renovará solo:
```bash
echo ok; certbot certificates 2>/dev/null | grep -E 'Domains|Expiry'; certbot renew --dry-run 2>&1 | tail -3; systemctl is-active certbot.timer
ls /etc/nginx/sites-enabled/; nginx -t 2>&1 | tail -1
```
`demo.space-os.io` con caducidad a ~90 días, el `--dry-run` en verde, `active`,
**solo** `demo.space-os.io` en `sites-enabled` y `test is successful`.

---

## 5 · Comprobaciones

### 5.1 · [PC] Desde fuera, lo mismo que mirará `promover.yml`
```powershell
$B = "https://demo.space-os.io/spaces-dooh"
curl.exe -s -o NUL -w "login %{http_code}`n"   "$B/login/"
curl.exe -s -o NUL -w "metodos %{http_code}`n" "$B/api/auth/metodos/"
curl.exe -s -o NUL -w "login-post %{http_code}`n" -X POST "$B/api/auth/login/" -H "Content-Type: application/json" -d '{\"email\":\"no@existe.invalid\",\"password\":\"x\"}'
curl.exe -s -w "`nsignup %{http_code}`n" -X POST "$B/api/signup/" -H "Content-Type: application/json" -d '{}'
curl.exe -s "$B/api/version/"; ""
curl.exe -s -o NUL -w "raiz %{http_code} -> %{redirect_url}`n" https://demo.space-os.io/
```
| Línea | Esperado | Qué demuestra |
|---|---|---|
| `login` | **200** | La compuerta 1 de `promover.yml` |
| `metodos` | **200** | La compuerta 2 de `promover.yml` |
| `login-post` | **401** | Que la app **habla con su base** (el único que no se puede fingir, runbook §7) |
| `signup` | **503** | Autoregistro cerrado, como en toda la flota |
| `/api/version/` | `{"ok":true}` y **nada más** | Sin token no cuenta la versión (a propósito) |
| `raiz` | **302** → `/spaces-dooh/login/` | `instancia.conf.tpl:194-195` |

### 5.2 · [VIEJO] La versión servida es la v0.12.6
Es el bloque final de §3.5 otra vez: `"version":"v0.12.6"` y `"canal":"beta"`.
Compáralo con lo que lleva `beta` en el registro: en la ficha de la release
`v0.12.6` (Actions → *Release*, resumen del run) sale el digest; en el viejo:
```bash
echo ok; docker image inspect -f '{{range .RepoDigests}}{{println .}}{{end}}' "$(docker inspect -f '{{.Image}}' space-os)"
```
El `sha256:` tiene que ser el mismo.

### 5.3 · Navegador, en `https://demo.space-os.io`
1. Entra con **`dueno@catalogo.invalid`** y la contraseña de §3.7.
2. Dashboard, Inventario (30 pantallas del catálogo y las dos del guion),
   Comercial negociación, una **propuesta** con su PDF, Campañas, Finanzas y
   Reportes (rentabilidad: «Tlalpan» frente a «Santa Mónica»).
3. Entra con **`vendedor@catalogo.invalid`**: tiene que ver menos menú (roles).
4. **Nada** debe enseñar datos de g500: ni su organización, ni sus clientes, ni
   sus pantallas. Si aparece algo de g500, **para**: la base no es la de §3.7.
5. Publicar en DOOHmain, mandar una propuesta por correo y el buscador de calles
   **no** funcionan si P4 fue «ninguna» y no hay Resend ni Maps: es lo esperado (D7).

---

## 6 · [GitHub] `DEMO_URL` y, si procede, `FLOTA_TOKEN`

> **Cuándo:** con §5 en verde **y** la v0.12.6 ya promovida a `estable` con la
> DEMO del PADRE (el plan de hoy). Así la **siguiente** promoción (v0.12.7) es la
> primera que valida contra la DEMO nueva. No cambies la variable **durante** un
> run de *Promover a estable*.

### 6.1 · Apuntar el valor de hoy (es la vuelta atrás)
[PC]:
```powershell
gh variable get DEMO_URL --repo emiliano-cyber/spaces_dooh_new
```
Lo esperable: `https://prueba.space-os.io/spaces-dooh`. **Anótalo.**

### 6.2 · Cambiarlo — con el formato EXACTO
Valor: **`https://demo.space-os.io/spaces-dooh`**

- Con `https://` (`promover.yml:128-131`), **con** `/spaces-dooh` (D8), **sin**
  barra final, **sin** espacios y **sin punto final**. Ya pasó dos veces en F2.4
  (02/09): una `DEMO_URL` pegada **con un espacio delante** y una versión con un
  **punto detrás**. El guard de caracteres para el espacio, **pero no el punto**.

[GitHub] web: *Settings → Secrets and variables → Actions → pestaña Variables →
`DEMO_URL` → editar*, pega el valor **tecleándolo**, no copiándolo de un chat. O
[PC]:
```powershell
gh variable set DEMO_URL --body "https://demo.space-os.io/spaces-dooh" --repo emiliano-cyber/spaces_dooh_new
"[" + (gh variable get DEMO_URL --repo emiliano-cyber/spaces_dooh_new) + "]"
```
La segunda línea tiene que imprimir **exactamente**
`[https://demo.space-os.io/spaces-dooh]` — los corchetes hacen visible un espacio
o un punto. Y la prueba que hará el workflow, con **ese** valor:
```powershell
$B = (gh variable get DEMO_URL --repo emiliano-cyber/spaces_dooh_new).TrimEnd('/')
curl.exe -s -o NUL -w "login %{http_code}`n" "$B/login/"; curl.exe -s -o NUL -w "metodos %{http_code}`n" "$B/api/auth/metodos/"
```
`login 200` y `metodos 200`.

### 6.3 · (P8) El secreto `FLOTA_TOKEN`
[PC]: `gh secret list --repo emiliano-cyber/spaces_dooh_new` (solo enseña
nombres). **Si no sale `FLOTA_TOKEN`**, no hagas nada: el resumen de cada
promoción seguirá diciendo «qué versión corre DEMO: NO COMPROBADO»
(`promover.yml:294`). **Si sale**, hoy es el token de la DEMO del PADRE, y contra
la nueva la comprobación de versión **se apaga sin error** (la app no reconoce el
token y contesta `{ok:true}`). Para que vuelva a ser estricta, se le pone el de
la DEMO nueva, **sin que pase por la pantalla** [PC-bash]:
```bash
ssh root@142.93.113.106 "sed -n 's/^FLOTA_TOKEN=//p' /etc/space-os/app.env" | tr -d '\r\n' | gh secret set FLOTA_TOKEN --repo emiliano-cyber/spaces_dooh_new
```
Desde ese momento, una promoción **falla** si la DEMO nueva no corre la versión
que se promueve: hay que actualizarla antes (`/opt/space-os/update.sh` en el
viejo, ver §8.1). Y al revés: si vuelves `DEMO_URL` a `prueba.`, el secreto
también tiene que volver (es el de `/etc/space-os/demo-app.env` del PADRE).

---

## 7 · Vuelta atrás, riesgos y lo que no está verificado

### Vuelta atrás

| Hasta dónde llegaste | Cómo se vuelve |
|---|---|
| §1 (solo encendido) | [Panel DO] apagar. Nada cambió |
| §2.2/§2.3 **hecho** | **No hay vuelta atrás de los datos de g500 en este disco.** Solo la instantánea de P2, si se hizo. g500 sigue entero en gh500 |
| §3–§5 con fallos | La DEMO nueva no la usa nadie todavía: corregir y repetir. El alta se repite limpia tras otro *Rebuild* (A) |
| §4.2 DNS | [Cloudflare] el A de `demo` de vuelta a la IP anotada en §2.1 (o borrarlo) |
| §6 `DEMO_URL` / `FLOTA_TOKEN` | Los valores anotados en §6.1 (y el token de `demo-app.env` del PADRE) |

### Riesgos y lo NO verificado

- **Esta guía no se ha corrido nunca.** Sus piezas tienen historia por separado:
  `provision-instancia.sh` en las altas de septiembre (F5.6 y g500) y en el panel;
  las semillas en local (`docs/datos/20261103_base_demo_nueva.md`) y en la DEMO
  del PADRE con Node del anfitrión; `setup-droplet.sh` en 24.04 el 04/11 (guía 30).
- **`provision-instancia.sh` con `CANAL=beta` y desde Git Bash de Windows**: no
  consta ninguna corrida así. Lo que puede fallar está acotado: el `--dry-run`
  de §3.4 enseña cada orden antes, y las huellas de §3.8 cazan un guion en CRLF.
- **D3 está deducido del código, no medido**: que, desde el ADR 0037 (21/09), un
  alta nueva en modo `aprobacion` **no levante el contenedor** (`update.sh:2428`
  sale antes de respaldar y conmutar). Si fuera así, **afecta también a las altas
  de owner** (`provision-instancia.sh:1027` diría «la instancia ya sirve» sin que
  sirva): §3.5 lo mide, y si se confirma hay que anotarlo como defecto del alta.
- **Las semillas dentro de la imagen** (D5): que `pg` se resuelva desde
  `/app/semillas` no está probado. §3.7 trae el rodeo.
- **El *Rebuild* conserva la IP y no conserva las llaves SSH**: lo primero es lo
  que documenta DigitalOcean; lo segundo, según cómo se creara el droplet. §2.2
  comprueba las dos cosas antes de seguir.
- **La IP `142.93.113.106` fue de g500**: si alguna lista de IP permitidas de un
  tercero (Google, DOOHmain) la conserva, la DEMO hablaría en nombre de g500 con
  su clave… que ya no tiene. El riesgo real es que **otra** clave la admita: §2.1.
- **Dos DEMO a la vez** hasta P7. Cada release hay que actualizarlas a las dos
  (§8.1), o una promoción validaría contra la que no se actualizó.
- **Space Eyes de g500 pierde su segunda copia** con §2 (P2).
- **`prueba.space-os.io` caduca el 29/11** y no se renueva: si para entonces
  `DEMO_URL` no ha cambiado, **no se podrá promover**.
- **La DEMO del PADRE comparte `/var/lib/space-os/respaldos`** con el PADRE si
  no tiene `DIR_RESPALDOS` (guía 12, bloque B). Apagarla (§8) quita ese riesgo.

---

## 8 · Después

### 8.1 · Cada publicación, mientras haya dos DEMO
Tras `release.yml` (la imagen nueva en `beta`), en **las dos**:
- [PADRE] la de siempre: `SPACE_OS_CONF=/etc/space-os/demo-instancia.env /opt/space-os/update.sh`.
- [VIEJO] la nueva, **sin** `SPACE_OS_CONF` (lee su `instancia.env`):
  ```bash
  echo ok; /opt/space-os/update.sh; echo "update=$?"; tail -n 4 /var/log/space-os/update.log
  ```
  (En `automatica` también la instalaría sola a las 04:17.)

Y en las guías de publicación nuevas, el paso «DEMO» pasa a ser este segundo.

### 8.2 · (P7) Apagar la DEMO del PADRE — solo cuando el dueño lo diga
Reversible: no borra la base `spaces_demo` ni la configuración.
[PADRE]:
```bash
echo ok; docker update --restart=no space-os-demo >/dev/null; docker stop space-os-demo
mkdir -p /root/cron-desactivado-demo && mv /etc/cron.d/space-os-demo /etc/cron.d/space-os-respaldo-demo /root/cron-desactivado-demo/ 2>/dev/null; ls /root/cron-desactivado-demo
docker ps --format '{{.Names}}'; ls /etc/cron.d | grep -E 'space-os-(demo|respaldo-demo)' || echo "sin cron de la DEMO del PADRE"
```
Vuelta atrás: `mv /root/cron-desactivado-demo/* /etc/cron.d/` y
`docker update --restart=unless-stopped space-os-demo && docker start space-os-demo`.
**No uses `systemctl disable spaces-demo`** para nada: borra la unidad en vez de
apagarla (aviso del 02/09). El bloque `prueba.` de `infra/nginx/space-os.io.conf`
y el de `demo.` (que ya no recibe tráfico) se quitan después, en un cambio de
nginx del PADRE aparte (zona R6).

### 8.3 · Limpieza
- [VIEJO] a la semana: `rm -rf /root/space-os-v0.12.6 /root/space-os-v0.12.6-infra.tgz /root/setup-droplet.log`.
- [PC-bash]: `~/provision-demo-20261105.log` no lleva secretos (el guion no los
  imprime), pero sí la topología: bórralo o guárdalo fuera del repositorio.
- [Cloudflare]: el TTL de `demo` a **Auto** al día siguiente.
- [Panel DO]: la instantánea de P2, en la fecha anotada.

Ver también: `docs/evidencias/30-mudar-g500-a-droplet-limpio-20261104.md` (§6 y
D13), `docs/runbook-alta-de-owner.md`, `docs/datos/20261103_base_demo_nueva.md`,
`infra/scripts/README.md` y `vault/01-Arquitectura/entorno-y-despliegue.md`.

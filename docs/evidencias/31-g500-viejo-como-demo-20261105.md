# Convertir el droplet viejo de g500 en la DEMO de `https://demo.space-os.io`, con una copia de sus datos

> Preparada el 2026-11-05 y **rehecha el mismo día** con las respuestas del dueño
> a las preguntas P1–P10 de la primera versión
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
>
> La consola web de DigitalOcean **se come el primer carácter** de cada pegado:
> por eso todo bloque bash empieza con `echo ok;`. **Pega un bloque cada vez**, y
> en la consola **no uses `exit` ni `set -e`**: cerrarían la sesión. Los bloques
> que cargan guiones del repositorio van **entre paréntesis** `( … )` por eso
> mismo: esas funciones hacen `exit` al rechazar un valor, y dentro de un
> subshell solo cierran el subshell. Antes de cada pegado **mira el prompt**
> (`root@g500…` / `root@gh500…` / `root@demo…`).
>
> Valores con marcador: `<REPO>` (tu checkout, p. ej.
> `C:\Users\Server\spaces_doohmain_nueva`) y `<LLAVE>` (la llave SSH de tu PC
> con la que entras al viejo). **Ningún bloque imprime una contraseña ni un
> token**: los secretos se teclean con `read -rs` o se generan en la máquina.

> [!danger] LEE ESTO ANTES DE CORRERLA — los riesgos que el dueño aceptó el 05/11
> La DEMO **conserva los datos de g500 tal como quedaron el 04/11**. Está decidido
> (P1/P2); no se vuelve a preguntar aquí, pero tiene que constar:
>
> 1. **Datos reales de un cliente en una dirección pública de demostración.**
>    Quien entre a `demo.space-os.io` ve la organización, los clientes, las
>    pantallas, las propuestas, los contratos y los importes de g500. Y la gente a
>    la que se le enseñe la DEMO los verá también.
> 2. **Las cuentas de las personas de g500 siguen en la DEMO con sus contraseñas.**
>    Quien conozca la suya entra con su rol. El Dueño (`solo_google`) no puede,
>    porque la DEMO no tiene Google. **§3.4 propone (opcional, marcado) desactivar
>    esas cuentas y crear un usuario de demostración.**
> 3. **Las ligas públicas que g500 ya mandó** (`/p/<token>`, portal del cliente)
>    **funcionan también en `demo.space-os.io`** cambiando solo el dominio: el
>    token vive en la base.
> 4. **Cada versión `beta` se instalará sobre esa copia de datos reales** (es lo
>    bueno: se ensaya sobre historia de verdad) **y la cambiará** (migraciones).
> 5. **En cuanto g500 y la DEMO diverjan, la DEMO deja de ser copia fiel**: lo que
>    g500 capture desde el 04/11 no llega, y lo que se toque en la DEMO no vuelve.
>    Es una copia **al 04/11**, no un espejo ni un respaldo de la base.
> 6. **La llave de Spaces de la DEMO alcanza el bucket entero**, prefijo `g500/`
>    incluido: Spaces limita por bucket, no por prefijo. El prefijo `demo/` separa
>    por convención.

## Qué es y qué no es esta guía

**Es** el camino para que el droplet viejo de g500 —apagado e intacto desde la
mudanza del 04/11, «seguro de encender» (guía 30, D13)— **deje de ser la
instancia `g500` y pase a ser la instancia `demo`** sobre **la misma base**:
nueva configuración, nuevo nombre, nuevas claves, canal `beta`, y nada que pueda
actuar en nombre de g500 (reportar al PADRE, subir a su prefijo, publicar en su
DOOHmain, escribir a sus clientes, presentar su certificado).

**No es**:
- la mudanza de g500 (guía 30): está cerrada y **g500 vive en `gh500`**;
- la promoción de la v0.12.6, que se hace **hoy con la DEMO del PADRE**
  (`space-os-demo`, `prueba.space-os.io`). Esta guía cambia `DEMO_URL` al final
  (§6), cuando la nueva corra la versión que se vaya a promover;
- Space Eyes en la DEMO: su pila **se queda parada y sin borrar**, como copia de
  la de g500 (§2.4).

---

## Las decisiones de esta guía, con su porqué

| # | Decisión | Por qué (evidencia en el repo) |
|---|---|---|
| D1 | **Se conserva el disco**: base `spaces`, volúmenes de Space Eyes, fotos | Decisión del dueño (P1/P2): el droplet es además la única otra copia de Space Eyes de g500, que no tiene respaldo fuera del droplet (guía 30 §7) |
| D2 | **`app.env` e `instancia.env` se escriben NUEVOS desde las plantillas**, con las funciones del alta (`reescribir_env_docker` / `reescribir_env_sourceado` de `infra/scripts/entorno-instancia.sh`), no editando los de g500 | Editar los viejos deja en su sitio cualquier clave que no se nombre (DOOHmain, Google, Resend, Maps, `DO_SPACES_*`…). Escribir desde la plantilla parte de **todo vacío** y solo pone lo que se dice aquí. Y `instancia.env` se **sourcea** como root (`update.sh` hace `. "$CONF"`): con valores mal entrecomillados ejecuta código (zona R7). Las mismas funciones que usa `provision-instancia.sh:909-942` |
| D3 | **Las claves de `spaces_app` y `spaces_migrador` se ROTAN** | Son las de g500 (guía 30 D5 las copió idénticas a gh500). Rotarlas hace que **ningún secreto de g500 siga en uso** en la DEMO y que la búsqueda de §2.7 tenga sentido |
| D4 | **Se borran los contenedores de la app de g500** (`space-os`, `space-os-antes-doohmain` y el muerto) antes de instalar | Docker guarda el entorno de cada contenedor (el `--env-file` de g500 con todos sus secretos) en `/var/lib/docker/containers/*/config.v2.json`. Sin contenedor, `update.sh` instala como en un alta (no hay a dónde volver, y no hace falta: la vuelta atrás es el respaldo previo) |
| D5 | **`modo = automatica`** en `actualizaciones_instancia` | La base dice `v0.12.5` instalada en modo `aprobacion` (censo del 04/11). Con `aprobacion`, `update.sh` sale en «esperando-aprobacion … Esperar no es un error» (`update.sh:2428`) sin instalar. En `automatica`, la corrida completa instala sola (`scripts/actualizaciones.mjs:27-30`), y la DEMO tiene que tomar cada `beta` |
| D6 | **De v0.12.5 a la `beta` vigente (v0.12.6) con `update.sh`**: respaldo previo, tres migraciones, salud | `update.sh` respalda **antes** de migrar (paso 3) y sube el respaldo al prefijo de la **nueva** `INSTANCIA` (`demo/`). Por eso la configuración nueva va **antes** del primer `update.sh`. Las tres: `20261102_moneda_inmutable_por_instancia.sql` (se para si hay una moneda que no sea MXN/USD o más de una: §3.1 lo mira antes), `20261103_idioma_documentos_por_instancia.sql` (añade `idioma_documentos` = `es`) y `20261103_usuarios_idioma_preferido.sql` |
| D7 | **Sin DOOHmain, sin correo, sin Google, sin Maps** | Plantilla: `DOOHMAIN_PUBLISH_ENABLED=0`, sin clave. **Todas** las llamadas a DOOHmain pasan por `doohmainHabilitado()` (`apps/web/lib/server/doohmain.ts:61`, `:257-318`, y las rutas `campanas/[id]/validar`, `reintentar-publicacion`, `doohmain-estado`, `creatividades/[id]`): apagada, la app dice «La integración con DOOHmain está apagada» y no llama. Sin `RESEND_API_KEY`, `enviarCorreo` lanza `email_no_configurado` (`apps/web/lib/server/email.ts:29`, `:51`) **antes** de hablar con nadie: ningún cliente de g500 recibe nada. Las pantallas siguen guardando su id de DOOHmain (`sitios.doohmain_pantalla`): sin integración, es un texto |
| D8 | **La base no guarda el dominio de la instancia: no hay que tocar datos para el cambio de nombre** | Las URLs que se mandan se construyen al vuelo con `APP_URL` (`email.ts`, `google-oauth.ts`, `usuarios-controller.ts`, `propuestas/[id]/enviar`, `recordatorios`), y la redirección con el `Host` de la petición (`apps/web/lib/host.ts`). Lo que sí lleva la base y **se queda**: el nombre y el slug de la organización de g500, su logotipo (`config_negocio.logo_url`/`logo_token`), su remitente (`email_remitente`, sin efecto sin Resend) y los ids de DOOHmain |
| D9 | **Space Eyes: contenedores parados con `--restart=no` (ya lo están, D13 de la guía 30), volúmenes intactos, configuración apartada en `/root/g500-eyes-copia/`** y sin cron | Si `/etc/space-os/eyes.env` se quedara, `update-eyes.sh` la usaría (`update-eyes.sh:42`); apartada, nada la lee. Los secretos internos de esa pila (MySQL, JWT de equipos) **se quedan a propósito**: sin ellos la copia no vuelve a arrancar |
| D10 | **El certificado de `g500.space-os.io` se BORRA**; el de `demo.space-os.io` se emite con la **misma cuenta de Let's Encrypt** que usó g500 | La llave privada de g500 en esta máquina permitiría hacerse pasar por `g500.space-os.io` hasta el 08/12. La cuenta ya está en `/etc/letsencrypt/accounts/` y `certbot` la reutiliza sin preguntar el correo; §4.4 enseña cuál es |
| D11 | **`DEMO_URL = https://demo.space-os.io/spaces-dooh`**, sin barra ni punto final, y **el secreto `FLOTA_TOKEN` de GitHub pasa al de la DEMO nueva** | `promover.yml` prueba `"$DEMO_URL/login/"` y `"$DEMO_URL/api/auth/metodos/"` (`.github/workflows/promover.yml:250-261`); sin `/spaces-dooh` no dan 200, y el guard (`:132-136`) deja pasar un punto final. Con el token de la DEMO nueva, la comprobación de versión (`:279-289`) vuelve a ser estricta (P8) |
| D12 | **La DEMO del PADRE no se toca** hasta la primera promoción validada contra la nueva | Decisión del dueño (P7). §8.2 la apaga de forma reversible cuando toque |

---

## 0 · Antes de empezar

### 0.1 · Lo que contestó el dueño el 05/11

| | Pregunta | Respuesta |
|---|---|---|
| P1/P2 | ¿Instalar de cero o vaciar? ¿Instantánea? | **Ni lo uno ni lo otro: la DEMO usa los datos de g500 tal cual.** El droplet es la copia de Space Eyes; sin instantánea |
| P3 | ¿Space Eyes en la DEMO? | **No**: contenedores parados, volúmenes sin borrar |
| P4 | ¿DOOHmain? | **Ninguna cuenta**; nunca la de g500 |
| P5 | ¿Idioma y moneda? | **Español y MXN** |
| P6 | ¿Respaldo fuera del droplet? | **Sí**, prefijo `demo/` |
| P7 | ¿`prueba.space-os.io`? | Se mantiene hasta la primera promoción validada contra la nueva; luego se apaga |
| P8 | ¿`FLOTA_TOKEN` de GitHub? | **Se cambia** por el de la DEMO nueva |
| P9 | ¿Correo de Let's Encrypt? | **El mismo que usó g500** (§4.4 lo lee de la máquina) |
| P10 | ¿Backups de DO? | **Sin Backups** en la DEMO; los que tenga el viejo, ver §2.1 |

### 0.2 · Lo que el dueño todavía tiene que decidir (no bloquea empezar)

| | Pregunta | Recomendación | Dónde |
|---|---|---|---|
| **Q1** | `/root/g500-mudanza/` tiene **la base de g500 en claro** (`spaces.dump`), **todos sus secretos** (`config.tgz`), los hashes de sus roles (`roles.sql`) y el volcado de MySQL de Space Eyes (`space_eye.sql.gz`). ¿Borrar o cifrar? | **Borrar** `config.tgz`, `roles.sql` y `spaces.dump` (la base ya está viva en la DEMO, gh500 tiene la suya y sus respaldos en `g500/`); **conservar** `space_eye.sql.gz` en la copia de Space Eyes (§2.4), en `600`. Si prefieres no borrar nada, `gpg -c` con una clave que no viva en la máquina (§2.5, alternativa) | §2.5 |
| **Q2** | ¿Desactivar las cuentas de g500 en la DEMO y crear un usuario de demostración? | **Sí** (riesgo 2 del recuadro). Es opcional y está marcado | §3.4 |
| **Q3** | Si `app.env` de g500 tenía **`DO_SPACES_*`** (evidencias en el bucket de medios), ¿se le dan a la DEMO? | **No**: con ellas la DEMO leería **y escribiría** en el almacén de g500. Sin ellas, las fotos de evidencia que estén en ese bucket **no se verán** en la DEMO (las que estén en la base, sí) | §2.2, §5.3 |
| **Q4** | ¿La llave de Spaces de la DEMO es **la misma** de la flota o una **nueva**? | **Nueva**, solo para la DEMO: se puede revocar sin tocar a g500. Alcanza el bucket entero igual (riesgo 6) | §2.6 |

### 0.3 · Precondiciones — si una no se cumple, **para**

- **La mudanza está cerrada**: [PC]
  ```powershell
  Resolve-DnsName g500.space-os.io -Type A -Server 1.1.1.1
  ```
  **`159.65.221.205`** (gh500), no `142.93.113.106`.
- **gh500 ya tiene su respaldo fuera del droplet** (si la DEMO borrara algo por
  error, la base de g500 sigue existiendo en otro sitio). [GH500], solo lee:
  ```bash
  echo ok; grep -h 'respaldo remoto OK' /var/log/space-os/*.log 2>/dev/null | tail -2; ls /etc/cron.d | grep space-os
  ```
  Al menos un `respaldo remoto OK` reciente y el cron `space-os-respaldo`.

### 0.4 · [PC] El paquete de `v0.12.6`, sin CRLF
```powershell
cd <REPO>
git fetch emiliano --tags
git rev-parse v0.12.6
git -c core.autocrlf=false archive --format=tar.gz -o $HOME\Downloads\space-os-v0.12.6-infra.tgz v0.12.6 infra scripts/migrar.mjs
Get-FileHash $HOME\Downloads\space-os-v0.12.6-infra.tgz
scp -i <LLAVE> $HOME\Downloads\space-os-v0.12.6-infra.tgz root@142.93.113.106:/root/
```
`git rev-parse` = `34f36a54629d…`. **No quites el `-c core.autocrlf=false`**: sin
él `update.sh` sale en CRLF (`6add877f…`), la trampa que dejó a g500 un día sin
actualizarse el 08/10 (guía 30 D11). El `scp` va **después** de §1 (con el
droplet encendido); si el viejo no acepta tu llave, súbelo tras pegarla por la
consola (§1.2).

---

## 1 · Encender el viejo sin que haga nada, y comprobarlo

### 1.1 · [Panel DO]
Droplet viejo → **Power → Turn on**. Abre la **consola web**.

### 1.2 · [VIEJO] Que no arrancó nada, y que no va a arrancar
```bash
echo ok; hostname; ip -4 -o addr show eth0 | awk '{print $4}'
docker ps --format '{{.Names}}'; echo "--- politicas:"; docker inspect -f '{{.Name}} {{.HostConfig.RestartPolicy.Name}}' $(docker ps -aq) 2>/dev/null
ls /etc/cron.d | grep space-os || echo "sin cron de space-os"; crontab -l 2>/dev/null | grep -v '^#' || echo "sin crontab de root"
ls /root/cron-desactivado-mudanza /root/g500-mudanza
systemctl is-active nginx postgresql certbot.timer docker
```
Esperado: la IP `142.93.113.106/…`, **`docker ps` vacío**, todas las políticas en
**`no`**, `sin cron de space-os`, `sin crontab de root`, las dos carpetas de la
mudanza con su contenido. Si corre algún contenedor o hay un cron de `space-os`,
**para**: el viejo no quedó como dice la guía 30 (D13).

nginx sigue sirviendo el sitio de `g500.space-os.io` (502, sin app) y el
temporizador de certbot intentaría renovar el certificado de g500 desde el
**08/11**. Se callan los dos hasta §4:
```bash
echo ok; systemctl stop nginx certbot.timer; systemctl is-active nginx certbot.timer
```
Dos `inactive`.

Si tu PC no entra por SSH (`<LLAVE>`), pega aquí tu llave pública y sube el
paquete de §0.4:
```bash
echo ok; echo '<CONTENIDO DE LLAVE.pub>' >> /root/.ssh/authorized_keys; tail -1 /root/.ssh/authorized_keys | cut -c1-30
```

### 1.3 · [VIEJO] Comprobar el paquete
```bash
echo ok; mkdir -p /root/space-os-v0.12.6 && tar xzf /root/space-os-v0.12.6-infra.tgz -C /root/space-os-v0.12.6 && cd /root/space-os-v0.12.6
grep -rlI $'\r' infra scripts || echo "sin CRLF"
sha256sum infra/scripts/update.sh infra/scripts/respaldo.sh infra/scripts/respaldo-diario.sh infra/scripts/conexion-pg.sh infra/scripts/base-instancia.sh infra/scripts/entorno-instancia.sh scripts/migrar.mjs; cd /
```
`sin CRLF` y **exactamente** (calculadas sobre `git show v0.12.6:<ruta>`):
```
8672d6b797608ce2f71f538e8e261b27ec44b43b649302bd73633f15d913c816  infra/scripts/update.sh
1e33dcc081096167b072d8e435bb0885f6958b4820153d8aa106b22347bf5a59  infra/scripts/respaldo.sh
7b775bd02563c268a596ec99aa095c5dece52818b1dca6409684d799ad7494a0  infra/scripts/respaldo-diario.sh
f3240e431d12779d976c6cf66b281681d2ec67d87b703999e2d6c8b7b9c47f93  infra/scripts/conexion-pg.sh
4b1a5a560fe98ecf66bcc4d6f4bda9f8516b68e54cb7e2a69c30261f5c718a46  infra/scripts/base-instancia.sh
3477bc5b78aeaa3e1d05544ba3c8ff2bba05a8b77c609d77faf1618edab68d15  infra/scripts/entorno-instancia.sh
97c9a05cbb8cc64a6edb16275443c1c7359e7026299fa199bfad286dffaddb8d  scripts/migrar.mjs
```
(`update.sh` y `respaldo.sh` son los mismos bytes que en `v0.12.5`.) Si una no
cuadra, **para**.

---

## 2 · Quitarle la identidad de g500 (sin tocar sus datos)

Nada puede quedar que **reporte como g500**, **suba a su prefijo**, **publique en
su DOOHmain**, **escriba a sus clientes** o **presente su certificado**. Los datos
(base, volúmenes, fotos) **se quedan**.

### 2.1 · Fuera del droplet

**[Cloudflare]** — busca `142.93.113.106` en la lista de registros: **ninguno** tiene
que apuntar ahí (el A de `g500` ya va a gh500). Mira el registro de **`demo`**:
anota a qué apunta hoy (lo esperable, `209.97.146.136`, la máquina de julio del
ADR 0024) y si hay **AAAA**. No lo cambies todavía (§4).

**[Google Cloud]** — cada **clave de API** → *Restricciones de aplicación →
Direcciones IP*: si alguna lista **`142.93.113.106`**, **quítala** (la guía 30 §6
lo dejaba para «a la semana»; desde hoy esa IP es la DEMO). El censo del 04/11 dijo
«MAPS: sin clave» en g500: lo esperable es no encontrar ninguna. Y en el cliente
OAuth de g500, si tuviera una URI de retorno con `142.93.113.106`, también fuera.

**DOOHmain** — no hay nada en el repositorio que diga si filtra por IP de origen.
Si la cuenta de g500 tuviera una lista de IP permitidas, **quita `142.93.113.106`**.

**[Panel DO]** — en el droplet viejo:
- **Backups** (P10): si estaban activados, **desactívalos**. Las copias que ya
  existan son **de g500** (base y secretos de antes del corte): bórralas, o anota
  cuándo caducan (DO las retira solas al desactivar, en su plazo).
- **Nombre**: `demo`. Quita las etiquetas de g500 si las tenía.

**Panel de flota y bucket**: nada fuera. g500 se identifica ante el PADRE por su
`FLOTA_TOKEN` y sube a `g500/` por su `INSTANCIA` y sus claves de Spaces: las tres
viven en el disco y se van en §2.6.

### 2.2 · [VIEJO] Los valores secretos de g500, guardados sin imprimirlos
Se guardan **antes** de cambiar nada, para comprobar en §2.7 que no queda ninguno
en uso. Se toman de `app.env` e `instancia.env` (y sus copias `*.antes-*`); **no**
de `eyes.env`, que se queda como parte de la copia de Space Eyes (D9). Se excluye
`REGISTRY_TOKEN`: es la credencial de **solo lectura** del registro, común a la
flota, y la DEMO la seguirá usando.
```bash
echo ok; umask 077; F=/root/.g500-secretos
ls -l /etc/space-os
grep -hE '^[A-Z_]*(TOKEN|SECRET|KEY|PASSWORD|PASS|DATABASE_URL)[A-Z_]*=' /etc/space-os/app.env* /etc/space-os/instancia.env* 2>/dev/null \
  | grep -v '^REGISTRY_TOKEN=' | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//" | awk 'length($0)>=12' | sort -u > $F
wc -l < $F
awk -F= '/^(DO_SPACES_KEY|DOOHMAIN_API_KEY|RESEND_API_KEY|GOOGLE_CLIENT_SECRET|GOOGLE_MAPS_SERVIDOR_KEY|SPACE_EYE_KEY|FLOTA_TOKEN|SPACES_KEY)=/{print FILENAME": "$1"="(length($2)>2?"(CON VALOR)":"(vacio)")}' /etc/space-os/app.env /etc/space-os/instancia.env
```
Un número de valores (una veintena larga) y la lista de qué credenciales de
terceros tenía g500. **Apunta si `DO_SPACES_KEY` sale `(CON VALOR)`**: es Q3 (las
evidencias de g500 en su almacén de medios no se verán en la DEMO).

### 2.3 · [VIEJO] Los contenedores de la app de g500 (D4)
```bash
echo ok; docker ps -a --format '{{.Names}}  {{.Image}}  {{.Status}}'
docker rm space-os space-os-antes-doohmain 2>&1; docker ps -a --filter status=dead -q | xargs -r docker rm
docker ps -a --format '{{.Names}}'
```
Al final, **solo** los cinco `space-eyes-*` (parados). Las imágenes se quedan (la
de `v0.12.5` sirve de nada, pero no lleva secretos; se poda sola más adelante).

### 2.4 · [VIEJO] Space Eyes: parado, con sus datos, y apartado (D9)
```bash
echo ok; C=/root/g500-eyes-copia; install -d -m 700 $C
mv /etc/space-os/eyes.env* $C/ 2>/dev/null; mv /opt/space-os/eyes $C/opt-eyes 2>/dev/null; mv /opt/space-os/update-eyes.sh $C/ 2>/dev/null
mv /etc/nginx/snippets/space-eyes*.conf $C/ 2>/dev/null
[ -f /root/g500-mudanza/space_eye.sql.gz ] && mv /root/g500-mudanza/space_eye.sql.gz $C/
chmod -R go-rwx $C; ls -la $C
docker inspect -f '{{.Name}} {{.HostConfig.RestartPolicy.Name}} {{.State.Status}}' $(docker ps -aq)
docker volume ls --format '{{.Name}}' | grep space-eyes; du -sh /var/lib/docker/volumes/space-eyes_*/_data
for r in 8554/tcp 8189/udp 3478/tcp 3478/udp 49160:49200/udp; do ufw delete allow $r >/dev/null 2>&1; done; ufw status | head -8
```
- En `$C`: `eyes.env` (y su copia), `opt-eyes/` (compose y `mediamtx.yml`),
  `update-eyes.sh`, el snippet de nginx y `space_eye.sql.gz`.
- Los cinco `space-eyes-*` con `no` y `exited`.
- Los cuatro volúmenes con sus tamaños de la guía 30 (~2,3 GB en total).
- `ufw` con **22, 80 y 443** (los puertos de vídeo se cierran: nadie escucha).

> **Para volver a levantar la copia algún día** (no es de esta guía): devolver
> `eyes.env` a `/etc/space-os/`, abrir los puertos y
> `docker compose -p space-eyes -f $C/opt-eyes/docker-compose.yml --env-file /etc/space-os/eyes.env up -d`.
> Hablaría como el Space Eyes de g500 (sus equipos van por el dominio de g500, que
> apunta a gh500, así que no se cruzarían; pero esto no se ha probado).

### 2.5 · [VIEJO] El material de la mudanza y el cron apartado (Q1)
Recomendado (Q1): borrar lo que es **secreto o duplicado** y no conservar el cron
viejo (se instala uno nuevo en §3.6, no este):
```bash
echo ok; ls -la /root/g500-mudanza /root/cron-desactivado-mudanza
rm -f /root/g500-mudanza/config.tgz /root/g500-mudanza/roles.sql /root/g500-mudanza/spaces.dump /root/g500-mudanza/sumas.txt /root/g500-mudanza/*conteos*.txt
rmdir /root/g500-mudanza 2>/dev/null || ls -la /root/g500-mudanza
rm -rf /root/cron-desactivado-mudanza /root/eyes-conteos.txt /root/pg-conteos.txt /root/conteos-pg.sql /root/.ssh/mudanza_g500 /root/.ssh/mudanza_g500.pub
ls /etc/cron.d | grep space-os || echo "sin cron de space-os"
```
Si `rmdir` no puede, enseña lo que quedó: míralo antes de borrarlo.

*Alternativa si Q1 = cifrar*: en vez del `rm` de `spaces.dump`,
`gpg --symmetric --cipher-algo AES256 -o /root/g500-spaces.dump.gpg /root/g500-mudanza/spaces.dump && shred -u /root/g500-mudanza/spaces.dump`,
con una frase que **no** se guarde en la máquina. (`config.tgz` y `roles.sql` se
borran igual: sus secretos ya no sirven en la DEMO y siguen vivos en gh500.)

Volcados sueltos que hayan quedado en otra parte (p. ej. el respaldo previo a la
subida a PostgreSQL 16 del 01/10):
```bash
echo ok; find / -xdev \( -name '*.dump' -o -name '*.sql' -o -name '*.sql.gz' -o -name '*.tgz' -o -name '*.tar.gz' \) -size +50k -not -path '/usr/*' -not -path '/snap/*' -not -path '/var/lib/docker/*' -not -path '/proc/*' -not -path '/root/g500-eyes-copia/*' -not -path '/root/space-os-v0.12.6*' 2>/dev/null | head -20
ls -l /var/lib/space-os/respaldos 2>/dev/null | tail -5
```
Los de `/var/lib/space-os/respaldos` son los locales de g500 (los podaba
`update.sh`): **se quedan**, con el resto de datos (D1), en `drwx------`. Lo que
salga fuera de ahí, míralo y decide con Q1.

El cluster 14 parado en el 5433 (la vuelta atrás del 01/10, otra copia de la base
de g500, de entonces): **se queda** por D1, parado. Comprueba que no arranca:
```bash
echo ok; pg_lsclusters
```
`14 main 5433 down` y `16 main 5432 online`. Si el 14 estuviera `online`:
`pg_ctlcluster 14 main stop` y en `/etc/postgresql/14/main/start.conf` pon `manual`.

### 2.6 · [VIEJO] La identidad nueva: claves de Postgres, `app.env` e `instancia.env`
**Primero, lo que se lleva de la configuración vieja** (sin imprimirlo): el nombre
del registro y su token de solo lectura. Luego se rotan las dos claves de
Postgres (D3) y se escriben los dos archivos **desde las plantillas** (D2). Todo
en un subshell:
```bash
echo ok; (
umask 077; R=/root/space-os-v0.12.6; ENTORNO_GUION=guia31
. $R/infra/scripts/base-instancia.sh; . $R/infra/scripts/entorno-instancia.sh
REGISTRY_V=$(bash -c '. /etc/space-os/instancia.env; printf %s "$REGISTRY"')
REGISTRY_TOKEN_V=$(bash -c '. /etc/space-os/instancia.env; printf %s "$REGISTRY_TOKEN"')
echo "registro: [$REGISTRY_V]  token: $([ -n "$REGISTRY_TOKEN_V" ] && echo presente || echo FALTA)"
read -rs -p "SPACES_KEY de la DEMO (Q4): " SK; echo; read -rs -p "SPACES_SECRET de la DEMO: " SS; echo
for v in "$REGISTRY_V" "$REGISTRY_TOKEN_V" "$SK" "$SS"; do validar_valor_seguro "valor" "$v"; done
CLAVE_APP=$(openssl rand -hex 24); CLAVE_MIG=$(openssl rand -hex 24)
printf "alter role spaces_app password '%s';\nalter role spaces_migrador password '%s';\n" "$CLAVE_APP" "$CLAVE_MIG" | sudo -u postgres psql -v ON_ERROR_STOP=1 -q && echo "ROLES ROTADOS"
reescribir_env_docker $R/infra/env/app.env.example \
  "APP_URL=https://demo.space-os.io" \
  "DATABASE_URL=$(url_app "$CLAVE_APP")" \
  "GOOGLE_REDIRECT_URI=https://demo.space-os.io/spaces-dooh/api/auth/google/callback/" \
  "FLOTA_TOKEN=$(openssl rand -hex 32)" \
  "RECORDATORIOS_TOKEN=$(openssl rand -hex 32)" \
  "CANAL=beta" > /etc/space-os/app.env.nuevo
reescribir_env_sourceado $R/infra/env/instancia.env.example \
  "INSTANCIA=demo" \
  "DATABASE_URL=$(url_migrador "$CLAVE_MIG")" \
  "REGISTRY=$REGISTRY_V" "REGISTRY_TOKEN=$REGISTRY_TOKEN_V" "CANAL=beta" \
  "SPACES_KEY=$SK" "SPACES_SECRET=$SS" "SPACES_BUCKET=space-os-respaldos" "SPACES_REGION=sfo3" \
  "LOGS_BUCKET=" > /etc/space-os/instancia.env.nuevo
chmod 600 /etc/space-os/*.nuevo; ls -l /etc/space-os/*.nuevo
)
```
Tiene que imprimir `registro: [registry.digitalocean.com/registryspaces]  token: presente`,
**`ROLES ROTADOS`** y los dos `.nuevo` en `-rw-------`. Si sale algo de
`guia31: … trae un caracter que no se puede escribir`, no se escribió nada: revisa
el valor que tecleaste.

> **Desde aquí g500 (en esta máquina) ya no puede entrar a su base**: sus URLs
> llevan las claves viejas. Es lo que se quiere.

Se ponen en su sitio y se retira todo lo demás de g500 en `/etc/space-os`:
```bash
echo ok; cd /etc/space-os && rm -f app.env app.env.antes-* instancia.env instancia.env.antes-* && mv app.env.nuevo app.env && mv instancia.env.nuevo instancia.env; cd /
ls -la /etc/space-os
bash -c '. /etc/space-os/instancia.env && echo "[$INSTANCIA] [$CANAL] [$SPACES_BUCKET] [$SPACES_REGION] [$DOCKER_OPCIONES_APP]"'
```
`ls` con **solo** `app.env` e `instancia.env` (y `licencia/` si existiera: el
censo dijo que no), y `[demo] [beta] [space-os-respaldos] [sfo3] [--network host]`
**sin error** (el archivo se sourcea como bash).

Que la app y el actualizador ven **la misma base** con las claves nuevas (sin
imprimirlas):
```bash
echo ok; U=$(bash -c '. /etc/space-os/instancia.env; printf %s "$DATABASE_URL"'); psql "$U" -Atc "select current_user, current_database(), (select count(*) from tenants)"; unset U
A=$(sed -n 's/^DATABASE_URL=//p' /etc/space-os/app.env); psql "$A" -Atc "select current_user, current_database()"; unset A
```
`spaces_migrador|spaces|1` y `spaces_app|spaces`.

### 2.7 · [VIEJO] Comprobación: ningún secreto de g500 en uso, nada que se llame g500
```bash
echo ok; F=/root/.g500-secretos
grep -rIlF -f $F /etc /opt /var/lib/space-os /var/www /root /home /srv /usr/local 2>/dev/null | grep -vxF "$F" || echo "NINGUN SECRETO DE g500"
grep -lF -f $F /var/lib/docker/containers/*/config.v2.json 2>/dev/null || echo "NINGUN CONTENEDOR CON SECRETOS DE g500"
grep -rIl 'g500' /etc/space-os /opt/space-os /etc/nginx /etc/cron.d /var/www 2>/dev/null || echo "NADA SE LLAMA g500"
```
- **`NINGUN SECRETO DE g500`**. (Se excluye `/var/lib/docker` y la carpeta de la
  copia de Space Eyes no entra porque sus secretos no están en la lista.)
- **`NINGUN CONTENEDOR CON SECRETOS DE g500`**: los `space-eyes-*` llevan los de
  su pila, no los de la app.
- `grep 'g500'`: de momento saldrán `/etc/nginx/sites-*/g500.space-os.io` (se
  quitan en §4.4). **Nada** en `/etc/space-os`, `/opt/space-os` ni `/etc/cron.d`.

Solo entonces: `shred -u /root/.g500-secretos`.

---

## 3 · La instancia `demo` sobre la base de g500

### 3.1 · [VIEJO] Lo que hay en la base antes de migrar
```bash
echo ok; sudo -u postgres psql -d spaces -Atc "select slug, nombre, moneda from tenants"
sudo -u postgres psql -d spaces -Atc "select modo, version_instalada, aprobado_digest is not null from actualizaciones_instancia"
sudo -u postgres psql -d spaces -Atc "select (select count(*) from usuarios)||'/'||(select count(*) from sitios)||'/'||(select count(*) from propuestas)||'/'||(select count(*) from campanas)||'/'||(select count(*) from schema_migrations)"
```
- **Una** organización (la de g500) con **`MXN`**. Si sale otra moneda o vacía,
  **para**: la migración `20261102_moneda_inmutable_por_instancia.sql` se negaría
  (D6).
- `aprobacion|v0.12.5|f`.
- Los conteos de la guía 30: usuarios **5**, sitios **13**, propuestas **11**,
  campañas **11** (los de g500 al 04/11), y las migraciones registradas. Apúntalos.

### 3.2 · [VIEJO] Guiones del anfitrión al día y en LF
```bash
echo ok; R=/root/space-os-v0.12.6; install -d -m 755 /opt/space-os /var/log/space-os
install -m 750 $R/infra/scripts/update.sh          /opt/space-os/update.sh
install -m 750 $R/infra/scripts/respaldo.sh        /opt/space-os/respaldo.sh
install -m 750 $R/infra/scripts/respaldo-diario.sh /opt/space-os/respaldo-diario.sh
install -m 750 $R/infra/scripts/conexion-pg.sh     /opt/space-os/conexion-pg.sh
install -m 640 $R/scripts/migrar.mjs               /opt/space-os/migrar.mjs
ls -la /opt/space-os; ( cd /opt/space-os && sha256sum update.sh respaldo.sh respaldo-diario.sh conexion-pg.sh migrar.mjs )
grep -rlI $'\r' /opt/space-os || echo "sin CRLF en /opt/space-os"
```
En `/opt/space-os` **solo** esos cinco (lo de Space Eyes se apartó en §2.4), con
las huellas de §1.3 y `sin CRLF en /opt/space-os`.

### 3.3 · [VIEJO] Modo automático, y de v0.12.5 a la `beta` vigente (D5, D6)
Primero, qué haría:
```bash
echo ok; sudo -u postgres psql -d spaces -c "update actualizaciones_instancia set modo = 'automatica', aprobado_digest = null, actualizado_en = now()"
/opt/space-os/update.sh --dry-run; echo "dry=$?"; tail -n 4 /var/log/space-os/update.log
```
`UPDATE 1`, `dry=0` y una línea `pull v0.12.6 -> 3 migraciones pendientes. Nada se
toco: --dry-run.` Si dice otra versión, es que `beta` ya se movió: vale igual (la
DEMO sigue a `beta`), pero anota cuál y cuántas.

De verdad (respalda, migra, levanta y comprueba la salud):
```bash
echo ok; /opt/space-os/update.sh; echo "update=$?"; tail -n 12 /var/log/space-os/update.log
docker ps --format '{{.Names}}  {{.Image}}  {{.Status}}'; ls -l /var/lib/space-os/respaldos | tail -2
```
- `update=0`, en el log el **respaldo** (`3 · respaldo -> …dump`) **y**
  `respaldo remoto OK` al prefijo **`demo/`** (si falla la subida, el log lo dice y
  sigue: mira el 403/404, guía 12 A2), las tres migraciones y la salud en 200.
- `space-os` en `Up` desde `…/space-os:beta`.
- Un respaldo nuevo en `/var/lib/space-os/respaldos`: **es la vuelta atrás de esta
  migración** (la base de g500 a v0.12.5).

Si sale otro código, **no repitas**: pega el log (tabla de códigos en
`infra/scripts/README.md`; un 5 deja la instancia caída y el README dice cómo
devolverle el servicio).

Qué versión sirve (el token se lee del archivo y **no se imprime**):
```bash
echo ok; docker inspect -f '{{index .Config.Labels "org.opencontainers.image.version"}}  {{.Config.Image}}' space-os
T=$(sed -n 's/^FLOTA_TOKEN=//p' /etc/space-os/app.env); curl -s -H "X-Flota-Token: $T" http://127.0.0.1:3000/spaces-dooh/api/version/ | grep -oE '"(version|canal|ultimaMigracion)":"[^"]*"'; unset T
sudo -u postgres psql -d spaces -Atc "select modo, version_instalada from actualizaciones_instancia"
sudo -u postgres psql -d spaces -Atc "select slug, moneda, idioma_documentos from tenants"
```
`v0.12.6`, `"version":"v0.12.6"`, `"canal":"beta"`, la última migración
`20261103_…`, `automatica|v0.12.6`, y la organización con `MXN|es`.

Los datos siguen ahí (mismo bloque de conteos de §3.1): **los mismos números**,
con 3 migraciones más.

### 3.4 · [VIEJO] (OPCIONAL — Q2) Las cuentas de g500 y un usuario de demostración
**Solo si el dueño contesta Q2 que sí.** Primero mira:
```bash
echo ok; sudo -u postgres psql -d spaces -Atc "select rol, activo, solo_google, count(*) from usuarios group by 1,2,3 order by 1"
```
Luego, en una sola transacción: se cierran las sesiones abiertas y los enlaces de
restablecer contraseña de g500 (servirían contra esta base), se **desactivan** las
cuentas de g500 (no se borran: sus acciones las referencian) y se crea un Dueño de
demostración con contraseña. La contraseña se teclea sin eco; **sin comillas
simples**, 12 caracteres o más:
```bash
echo ok; read -rs -p "Contrasena del usuario demo: " CL; echo
printf "begin;\ndelete from sesiones;\ndelete from password_resets;\nupdate usuarios set activo = false where email not like '%%.invalid';\ninsert into usuarios (tenant_id, nombre, email, cargo, rol, password_hash, activo, debe_cambiar_password) select id, 'Demo', 'demo@demo.invalid', 'Demostracion', 'DUENO', crypt('%s', gen_salt('bf', 10)), true, false from tenants;\ncommit;\n" "$CL" | sudo -u postgres psql -d spaces -v ON_ERROR_STOP=1 -q && echo "USUARIOS LISTOS"; unset CL
sudo -u postgres psql -d spaces -Atc "select email like '%.invalid', activo, count(*) from usuarios group by 1,2"
```
`USUARIOS LISTOS`, y dos filas: `f|f|5` (las de g500, inactivas) y `t|t|1`. **Si
falla** (un trigger de la tabla, una restricción): no se aplicó nada —va en una
transacción—; pega el error. Apunta la contraseña donde guarde las suyas el dueño.

**Si Q2 = no**: al menos cierra las sesiones y los enlaces pendientes:
```bash
echo ok; sudo -u postgres psql -d spaces -c "delete from sesiones" -c "delete from password_resets"
```

### 3.5 · [VIEJO] Que la DEMO no habla con nadie real
Nombres y si tienen valor, nunca el valor:
```bash
echo ok; grep -E '^(APP_URL|CANAL|TZ|DOOHMAIN_PUBLISH_ENABLED|GOOGLE_OAUTH|AUTOREGISTRO)=' /etc/space-os/app.env
awk -F= '/^(RESEND_API_KEY|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|GOOGLE_MAPS_SERVIDOR_KEY|DOOHMAIN_API_KEY|SPACE_EYE_BASE_URL|SPACE_EYE_KEY|BOOTSTRAP_TOKEN|DO_SPACES_KEY)=/{print $1"="(length($2)?"(CON VALOR)":"(vacio)")}' /etc/space-os/app.env
grep -E '^(INSTANCIA|CANAL|FLOTA_REPORTE_URL|SPACES_BUCKET|LOGS_BUCKET)=' /etc/space-os/instancia.env
docker exec space-os printenv DOOHMAIN_PUBLISH_ENABLED RESEND_API_KEY GOOGLE_OAUTH | cat -A | head -3
```
- `APP_URL=https://demo.space-os.io`, `CANAL=beta`, `TZ=America/Mexico_City`,
  `DOOHMAIN_PUBLISH_ENABLED=0`, `GOOGLE_OAUTH=0`, `AUTOREGISTRO=0`.
- Las nueve de la segunda línea **`(vacio)`**.
- `INSTANCIA="demo"`, `FLOTA_REPORTE_URL=""`: la DEMO **no reporta al panel de
  flota**; no hay nada en el PADRE que la confunda con g500.
- Dentro del contenedor: `0$`, línea vacía, `0$`.

### 3.6 · [VIEJO] El cron nuevo (no el de g500)
El de actualizar (el mismo que pone el alta, `provision-instancia.sh:1008-1009`) y
el respaldo diario:
```bash
echo ok; printf '%s\n' 'SHELL=/bin/bash' 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' '*/15 * * * * root /opt/space-os/update.sh --comprobar >> /var/log/space-os/cron.log 2>&1 || [ $? -eq 75 ]' '17 4 * * * root /opt/space-os/update.sh >> /var/log/space-os/cron.log 2>&1' > /etc/cron.d/space-os-update
printf '%s\n' '# Respaldo diario de la DEMO (guia 31). Ver vault/06-Operacion/respaldo-diario.md' 'SHELL=/bin/bash' 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' '41 3 * * * root /opt/space-os/respaldo-diario.sh >> /var/log/space-os/cron.log 2>&1' > /etc/cron.d/space-os-respaldo
chmod 644 /etc/cron.d/space-os-*; grep -H -v '^#' /etc/cron.d/space-os-* | grep -v ':\s*$'
/opt/space-os/respaldo-diario.sh; echo "respaldo=$?"; grep 'respaldo remoto' /var/log/space-os/*.log | tail -1
/opt/space-os/update.sh --comprobar; echo "comprobar=$?"; tail -n 2 /var/log/space-os/update.log
```
Dos archivos de cron con tres líneas (`*/15`, `17 4`, `41 3`), **ninguno** de
Space Eyes; `respaldo=0` con `respaldo remoto OK: s3://space-os-respaldos/demo/…`;
`comprobar=0` con `sin cambios`.

[PC] — que nada nuevo cayó en el prefijo de g500: en el panel de DO, **Spaces →
`space-os-respaldos` → `g500/`**, el objeto más reciente tiene que ser **de gh500**
(su hora de cron, 03:41 UTC), no de los minutos en que corriste §3.3 y §3.6. Y en
**`demo/`**, los dos respaldos de hoy.

---

## 4 · El nombre `demo.space-os.io` y su certificado

### 4.1 · [VIEJO] nginx: fuera el sitio de g500, dentro uno de solo HTTP para el desafío
Igual que el paso 2 del alta (`provision-instancia.sh:945-964`):
```bash
echo ok; rm -f /etc/nginx/sites-enabled/g500.space-os.io /etc/nginx/sites-available/g500.space-os.io
mkdir -p /var/www/html/.well-known/acme-challenge
printf '%s\n' 'server {' '  listen 80;' '  listen [::]:80;' '  server_name demo.space-os.io;' '  location /.well-known/acme-challenge/ { root /var/www/html; }' '  location / { return 503 "instancia en aprovisionamiento\n"; }' '}' > /etc/nginx/sites-available/demo.space-os.io
ln -sfn /etc/nginx/sites-available/demo.space-os.io /etc/nginx/sites-enabled/demo.space-os.io
ls /etc/nginx/sites-enabled/; nginx -t && systemctl start nginx && echo NGINX_OK
```
**Solo** `demo.space-os.io` en `sites-enabled` y `NGINX_OK`. Si hubiera más
archivos propios de g500 en `sites-enabled` o `conf.d`, quítalos también.

[PC]:
```powershell
curl.exe -s -o NUL -w "http %{http_code}`n" --resolve demo.space-os.io:80:142.93.113.106 http://demo.space-os.io/
```
`http 503`.

### 4.2 · [Cloudflare] Mover el DNS
Registro **A** de **`demo`** → **`142.93.113.106`**, **nube gris** (con la naranja
el certificado se pide para Cloudflare, `docs/runbook-alta-de-owner.md` §3), TTL
**1 min**. Si había **AAAA** (§2.1), **bórralo**. Si no existía `demo`, créalo.

### 4.3 · [PC] Que ya resuelve aquí
```powershell
Resolve-DnsName demo.space-os.io -Type A -Server 1.1.1.1
Resolve-DnsName demo.space-os.io -Type A -Server 8.8.8.8
Resolve-DnsName demo.space-os.io -Type AAAA -Server 1.1.1.1
```
**Solo** `142.93.113.106`, y sin AAAA. **Si no, no sigas**: son cinco intentos por
hora.

### 4.4 · [VIEJO] El certificado con la cuenta de Let's Encrypt de g500 (D10, P9)
La cuenta (y su correo) ya está en la máquina; `certbot` la usa sin preguntar.
Para ver cuál es, sin escribirlo en ningún sitio:
```bash
echo ok; ls /etc/letsencrypt/accounts/*/directory/; grep -rhoE 'mailto:[^"]+' /etc/letsencrypt/accounts/ | sort -u
```
**Una** cuenta, con el correo que usó g500. (Si hubiera dos, añade abajo
`--account <id>` con el de la carpeta que corresponda.) Emitir:
```bash
echo ok; certbot certonly --webroot -w /var/www/html -d demo.space-os.io -n --agree-tos 2>&1 | tail -4
certbot certificates 2>/dev/null | grep -E 'Certificate Name|Domains|Expiry'
```
`Successfully received certificate` y el de `demo.space-os.io` a ~90 días. Ahora
**se borra el de g500** (su llave privada, D10):
```bash
echo ok; certbot delete --non-interactive --cert-name g500.space-os.io 2>&1 | tail -1
certbot certificates 2>/dev/null | grep -E 'Certificate Name'; ls /etc/letsencrypt/live/
```
**Solo** `demo.space-os.io`.

El nginx definitivo, desde la plantilla de instancia (lo que hace
`provision-instancia.sh --emitir-certificado`, `:519-524`):
```bash
echo ok; sed 's/__DOMINIO__/demo.space-os.io/g' /root/space-os-v0.12.6/infra/nginx/instancia.conf.tpl > /etc/nginx/sites-available/demo.space-os.io
grep -c 'demo.space-os.io' /etc/nginx/sites-available/demo.space-os.io; grep -c '__DOMINIO__\|g500' /etc/nginx/sites-available/demo.space-os.io
nginx -t && systemctl reload nginx && echo NGINX_OK
systemctl enable --now certbot.timer; certbot renew --dry-run 2>&1 | tail -2; systemctl is-active certbot.timer
curl -s -o /dev/null -w 'login %{http_code}\n' https://demo.space-os.io/spaces-dooh/login/
grep -rIl 'g500' /etc/nginx /etc/letsencrypt/renewal 2>/dev/null || echo "NADA DE g500 EN NGINX NI CERTBOT"
```
Varias menciones de `demo.space-os.io` y **`0`** de `__DOMINIO__`/`g500`;
`NGINX_OK`; `--dry-run` en verde; `active`; **`login 200`** y
`NADA DE g500 EN NGINX NI CERTBOT`. (La plantilla incluye
`snippets/space-eyes*.conf` con comodín: sin archivos, no incluye nada.)

Y el nombre de la máquina:
```bash
echo ok; hostnamectl set-hostname demo; hostname
```

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
curl.exe -s -o NUL -w "g500 %{http_code}`n" https://g500.space-os.io/spaces-dooh/login/
```
| Línea | Esperado | Qué demuestra |
|---|---|---|
| `login` / `metodos` | **200** / **200** | Las dos compuertas de `promover.yml` |
| `login-post` | **401** | Que la app habla con su base (runbook §7) |
| `signup` | **503** | Autoregistro cerrado |
| `/api/version/` | `{"ok":true}` y nada más | Sin token no cuenta la versión |
| `raiz` | **302** → `/spaces-dooh/login/` | `instancia.conf.tpl:194-195` |
| `g500` | **200** | g500 sigue sirviendo **desde gh500**, sin enterarse de nada de esto |

### 5.2 · [VIEJO] La versión servida es la v0.12.6
El último bloque de §3.3 otra vez (`"version":"v0.12.6"`, `"canal":"beta"`), y el
digest contra el de la release:
```bash
echo ok; docker image inspect -f '{{range .RepoDigests}}{{println .}}{{end}}' "$(docker inspect -f '{{.Image}}' space-os)"
```
El `sha256:` = el del resumen del run *Release* de `v0.12.6` en GitHub Actions.

### 5.3 · Navegador, en `https://demo.space-os.io`
1. Entra con **`demo@demo.invalid`** (si hiciste §3.4) o con una cuenta de g500
   cuya contraseña conozcas (si no).
2. Dashboard, Inventario (las 13 pantallas de g500), una propuesta y su PDF,
   Campañas, Finanzas, Reportes.
3. **Que no rompe sin integraciones** (D7):
   - una campaña: la vista de **DOOHmain** dice que la integración está apagada
     (no un error 500);
   - **Enviar** una propuesta por correo: error de correo no configurado, y
     **nadie** recibe nada;
   - Comercial negociación: el buscador de calles va por Nominatim (ADR 0047), sin
     clave de Google.
4. **Evidencias y fotos** de órdenes de trabajo: si §2.2 dijo `DO_SPACES_KEY`
   `(CON VALOR)` y Q3 = no, las que estén en ese almacén **no cargan**; es lo
   esperado. Las guardadas en la base, sí.
5. **Space Eye** en el menú: sin `SPACE_EYE_BASE_URL`, el módulo no tiene a quién
   preguntar. Anota cómo se ve: si da un error feo delante de un cliente, es un
   ajuste aparte.

---

## 6 · [GitHub] `DEMO_URL` y `FLOTA_TOKEN`

> **Cuándo:** con §5 en verde **y** la v0.12.6 ya promovida a `estable` con la
> DEMO del PADRE. Así la siguiente promoción es la primera contra la nueva. No lo
> cambies **durante** un run de *Promover a estable*.

### 6.1 · Apuntar los valores de hoy (la vuelta atrás)
[PC]:
```powershell
gh variable get DEMO_URL --repo emiliano-cyber/spaces_dooh_new
gh secret list --repo emiliano-cyber/spaces_dooh_new
```
Lo esperable: `https://prueba.space-os.io/spaces-dooh`, y en la lista de secretos
si existe `FLOTA_TOKEN` (solo enseña nombres). **Anótalo.** El valor actual del
secreto es el de `/etc/space-os/demo-app.env` del PADRE (la DEMO vieja): es a lo que
se vuelve.

### 6.2 · `DEMO_URL` — con el formato EXACTO
Valor: **`https://demo.space-os.io/spaces-dooh`** — con `https://`, **con**
`/spaces-dooh`, **sin** barra final, **sin** espacios, **sin** punto final. En F2.4
(02/09) se pegó una vez **con un espacio delante** y una versión **con un punto
detrás**; el guard para el espacio, **no el punto** (D11).

[GitHub] web: *Settings → Secrets and variables → Actions → Variables → `DEMO_URL`
→ editar*, **tecleándolo**. O [PC]:
```powershell
gh variable set DEMO_URL --body "https://demo.space-os.io/spaces-dooh" --repo emiliano-cyber/spaces_dooh_new
"[" + (gh variable get DEMO_URL --repo emiliano-cyber/spaces_dooh_new) + "]"
$B = (gh variable get DEMO_URL --repo emiliano-cyber/spaces_dooh_new).TrimEnd('/')
curl.exe -s -o NUL -w "login %{http_code}`n" "$B/login/"; curl.exe -s -o NUL -w "metodos %{http_code}`n" "$B/api/auth/metodos/"
```
Exactamente `[https://demo.space-os.io/spaces-dooh]`, `login 200` y `metodos 200`.

### 6.3 · El secreto `FLOTA_TOKEN` (P8)
Se le pone el de la DEMO nueva **sin que pase por la pantalla**. Desde **Git Bash**
en tu PC (necesita `ssh` y `gh`):
```bash
ssh -i <LLAVE> root@142.93.113.106 "sed -n 's/^FLOTA_TOKEN=//p' /etc/space-os/app.env" | tr -d '\r\n' | gh secret set FLOTA_TOKEN --repo emiliano-cyber/spaces_dooh_new
gh secret list --repo emiliano-cyber/spaces_dooh_new | grep FLOTA_TOKEN
```
`FLOTA_TOKEN` con la fecha de hoy. Desde ese momento, una promoción **falla** si la
DEMO nueva no corre la versión que se promueve (`promover.yml:279-289`): hay que
actualizarla antes (§8.1). Y si se vuelve `DEMO_URL` a `prueba.`, el secreto vuelve
con ella.

---

## 7 · Vuelta atrás, riesgos y lo que no está verificado

### Vuelta atrás

| Hasta dónde llegaste | Cómo se vuelve |
|---|---|
| §1 | Apagar. Nada cambió |
| §2.3–§2.6 (identidad) | **No hay vuelta a «ser g500»**, y no hace falta: g500 vive en gh500. La configuración de g500 sigue en gh500 si alguna vez se necesitara |
| §2.5 (material de la mudanza) | Lo borrado no vuelve. gh500 tiene la base, la configuración y sus respaldos en `g500/` |
| §3.3 (migración a v0.12.6) | Si `update.sh` falla, **vuelve solo** (restaura su respaldo y relanza la anterior: `infra/scripts/README.md` §2 y §6). A mano: el `.dump` de §3.3 con `pg_restore` como `postgres` |
| §3.4 (usuarios) | `update usuarios set activo = true where email not like '%.invalid'` y borrar `demo@demo.invalid` |
| §4.2 DNS | El A de `demo` a la IP anotada en §2.1 (o borrarlo) |
| §6 | `DEMO_URL` y `FLOTA_TOKEN` a los valores de §6.1 |

### Riesgos y lo NO verificado

- **Los seis del recuadro del principio**, aceptados por el dueño el 05/11.
- **Esta guía no se ha corrido nunca**, y su forma —convertir una instancia en otra
  sobre la misma base— **no la cubre ningún guion** del repositorio. Las piezas sí
  tienen historia: `update.sh` de v0.12.5 a la siguiente en g500 y en DEMO, las
  funciones de `entorno-instancia.sh` en cada alta, `certbot --webroot` en todas.
- **`update.sh` sin contenedor previo sobre una base que ya tiene historia**: el
  camino de D4 es el de un alta (no hay contenedor), pero con base existente. Por
  el código: compara digests, ve uno distinto, respalda, migra y arranca. **No
  medido**; el `--dry-run` de §3.3 lo anticipa.
- **Las funciones de `entorno-instancia.sh` corridas a mano** (no desde un alta)
  en un subshell: cargadas por `.` y sin `set -e`. Su salida se comprueba
  sourceando `instancia.env` en §2.6.
- **El `insert` del usuario de demostración (§3.4)** copia las columnas que usa
  `scripts/semilla-catalogo-demo.mjs:1003-1004`; si la tabla tiene un trigger que
  la semilla no dispara (la semilla corre con otro rol), fallará entero. Va en
  transacción.
- **Cómo se ve el menú de Space Eye sin Space Eye** en una organización que lo
  tenía: no está mirado (§5.3).
- **Las migraciones `@tipo: datos`** que g500 tuviera pendientes siguen pendientes
  (`update.sh` no pasa `--con-datos`, guía 21 §B6): igual que en g500.
- **Dos DEMO a la vez** hasta P7: cada release, las dos (§8.1).
- **`prueba.space-os.io` caduca el 29/11**: si para entonces `DEMO_URL` no ha
  cambiado, no se puede promover.

---

## 8 · Después

### 8.1 · Cada publicación, mientras haya dos DEMO
Tras `release.yml`, en **las dos**:
- [PADRE] `SPACE_OS_CONF=/etc/space-os/demo-instancia.env /opt/space-os/update.sh`.
- [VIEJO] `echo ok; /opt/space-os/update.sh; echo "update=$?"; tail -n 4 /var/log/space-os/update.log`
  (en `automatica` también lo haría sola a las 04:17).

### 8.2 · Apagar la DEMO del PADRE — tras la primera promoción validada contra la nueva (P7)
Reversible: no borra `spaces_demo` ni la configuración. [PADRE]:
```bash
echo ok; docker update --restart=no space-os-demo >/dev/null; docker stop space-os-demo
mkdir -p /root/cron-desactivado-demo && mv /etc/cron.d/space-os-demo /etc/cron.d/space-os-respaldo-demo /root/cron-desactivado-demo/ 2>/dev/null; ls /root/cron-desactivado-demo
docker ps --format '{{.Names}}'; ls /etc/cron.d | grep -E 'space-os-(demo|respaldo-demo)' || echo "sin cron de la DEMO del PADRE"
```
Vuelta atrás: `mv /root/cron-desactivado-demo/* /etc/cron.d/` y
`docker update --restart=unless-stopped space-os-demo && docker start space-os-demo`.
**No uses `systemctl disable spaces-demo`**: borra la unidad (aviso del 02/09). Los
bloques `prueba.` y `demo.` de `infra/nginx/space-os.io.conf` se quitan después,
en un cambio de nginx del PADRE aparte (R6).

### 8.3 · Limpieza
- [VIEJO] a la semana: `rm -rf /root/space-os-v0.12.6 /root/space-os-v0.12.6-infra.tgz`.
- [Cloudflare] el TTL de `demo` a **Auto** al día siguiente.
- Las guías de publicación nuevas: el paso «DEMO» pasa a ser el de [VIEJO].

### 8.4 · Si algún día se quieren quitar los datos de g500 de la DEMO
Cuando Space Eyes de g500 tenga respaldo fuera de su droplet, la razón para
conservar esta copia desaparece. Entonces: *Rebuild* del droplet con Ubuntu 24.04
(conserva la IP), alta con `provision-instancia.sh --host … --dominio demo.space-os.io
--instancia demo` y `CANAL=beta`, y las semillas de `docs/datos/20261103_base_demo_nueva.md`
corridas dentro de la imagen. Era la primera versión de esta guía (commit
`b8341c03`); se recupera con `git show b8341c03:docs/evidencias/31-g500-viejo-como-demo-20261105.md`.

Ver también: `docs/evidencias/30-mudar-g500-a-droplet-limpio-20261104.md` (§6 y
D13), `infra/scripts/README.md`, `docs/runbook-alta-de-owner.md` y
`vault/01-Arquitectura/entorno-y-despliegue.md`.

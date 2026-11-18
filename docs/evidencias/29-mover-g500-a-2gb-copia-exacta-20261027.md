# Mover g500 a un droplet nuevo de 2 GB — copia exacta por instantánea

> Preparada el 2026-10-27. La corre **una persona**: Claude no entra a
> servidores. Cada bloque dice dónde va: **panel** de DigitalOcean o
> Cloudflare, **bash** en la consola web de un droplet, o **PowerShell** en tu
> máquina. La consola web de DigitalOcean **se come el primer carácter** de
> cada pegado: por eso los bloques empiezan con `echo ok;`.

**Decisión del dueño (27/10):** copia exacta (instantánea → droplet nuevo),
**2 GB**, **NYC1**. El motivo: g500 corre en 1 GB + swap con la app, su
PostgreSQL 16 y la pila de Space Eyes (que sola reserva ~1 GB), y el 11/10 la
región no tuvo capacidad para el «Resize» en sitio (guía 24 §7).

**Por qué copia exacta y no instalación limpia.** Viaja **todo** tal cual: la
base, los volúmenes de Space Eyes (MySQL, fotos, descargas), `/etc/space-os`,
nginx con `space-eyes.conf`, el certificado, el cron y el swap. Lo único que
cambia es **la IP**, y en el sistema solo la usa `IP_PUBLICA` de
`/etc/space-os/eyes.env` (la anuncian coturn y MediaMTX a los equipos:
`infra/eyes/docker-compose.yml`). Los equipos entran **por el dominio**
(commit `7202c8b1`), así que con mover el DNS basta. La guía 21 §B (instalación
limpia) sigue siendo el camino si algún día hace falta otra versión de Ubuntu.

**El g500 viejo queda APAGADO e intacto** como vuelta atrás.

---

## 0 · La víspera (sin cortar nada)

### 0.1 · Cloudflare
- Registro **A** de `g500`: anota la IP actual (`142.93.113.106`) y baja el
  **TTL a 1–2 min**.
- Comprueba que está en **«DNS only» (nube gris)**. RTSP (8554), WebRTC (8189/udp)
  y TURN (3478) no pasan por el proxy de Cloudflare. Si está en naranja,
  **avísame antes de seguir**: hoy funcionaría por otra razón que hay que entender.

### 0.2 · Panel de DigitalOcean, en el droplet de g500
Anota, porque NO viajan con la instantánea:
- **Networking → Firewalls**: ¿está en algún Cloud Firewall?
- **Backups**: ¿activados?
- **Monitoring / alertas** configuradas.
- Las **etiquetas (tags)** del droplet.

### 0.3 · Censo (bash, consola de g500 — solo lee)
```bash
echo ok; hostnamectl | grep -E 'Operating|Kernel'; free -m; swapon --show; df -h / | tail -1
pg_lsclusters
docker ps -a --format '{{.Names}}  {{.Image}}  {{.Status}}'
grep -E '^(EYES_IMAGEN|EYES_DOMINIO|IP_PUBLICA)=' /etc/space-os/eyes.env
grep -rIl '142\.93\.113\.106' /etc /opt/space-os 2>/dev/null
ufw status | head -12
grep -hv '^#' /etc/cron.d/space-os* 2>/dev/null
certbot certificates 2>/dev/null | grep -E 'Domains|Expiry'
```
```bash
echo ok; sudo -u postgres psql -d spaces -Atc "select (select count(*) from tenants)||'/'||(select count(*) from usuarios)||'/'||(select count(*) from sitios)||'/'||(select count(*) from propuestas)||'/'||(select count(*) from campanas)||'/'||(select count(*) from arrendadores)"
sudo -u postgres psql -d spaces -Atc "select version_instalada, aprobado_digest is not null as aprobada_pendiente from actualizaciones_instancia"
```
**Pégale la salida a Claude.** Qué se busca:
- `grep -rIl` con la IP vieja: lo esperado es **solo** `/etc/space-os/eyes.env`.
  Si sale otro archivo, se agrega a §2.2.
- `aprobada_pendiente` = `f`. Si es `t`, espera a que instale o retira la
  aprobación: no conviene que el cron instale a media mudanza.
- La cadena de conteos se guarda: es la que se compara en §2.3.

### 0.4 · En el PADRE (bash) — ¿alguien guarda la IP de g500?
```bash
echo ok; grep -rIl '142\.93\.113\.106' /etc/space-os /var/lib/space-os /var/www/Spaces/apps/flota 2>/dev/null || echo "el PADRE no la guarda"
```

### 0.5 · Ventana
Acuerda **~45 min sin uso** con quien usa g500. Lo que capturen en el viejo
después del apagado (§1) no existe en el nuevo.

---

## 1 · El corte (consola de g500 VIEJO)

Desde aquí g500 deja de atender. Se paran la app y Space Eyes con `stop` (no
`down`): con `restart: unless-stopped`, lo parado a mano **sigue parado al
arrancar el droplet nuevo**, y así nada escribe antes de comprobar.

```bash
echo ok; docker stop space-os
docker compose -p space-eyes -f /opt/space-os/eyes/docker-compose.yml --env-file /etc/space-os/eyes.env stop
docker ps --format '{{.Names}}'
```
La última línea no debe listar `space-os` ni `space-eyes-*`. Si el `compose stop`
se queja de `EYES_IMAGEN`, usa en su lugar:
```bash
echo ok; docker stop $(docker ps -q --filter label=com.docker.compose.project=space-eyes)
```
Apaga el droplet (la instantánea con la máquina apagada es la consistente):
```bash
echo ok; poweroff
```

## 2 · El droplet nuevo

### 2.1 · Panel de DigitalOcean
1. g500 (apagado) → **Snapshots** → nombre `g500-mudanza-20261027` → **Take
   Snapshot**. Espera a que termine (minutos).
2. **Create → Droplets** → **Snapshots** → `g500-mudanza-20261027`.
   - Región **NYC1**, plan **Basic 2 GB**.
   - Tu llave SSH (`spaces_deploy`) y el monitoreo.
   - Nombre: `g500-2gb`.
3. Si en §0.2 había **Cloud Firewall**, **Backups**, **alertas** o **tags**,
   ponlos ahora en `g500-2gb`.
4. Anota su IP pública: `<IP_NUEVA>`.

> Si NYC1 no tiene 2 GB disponible: transfiere la instantánea a otra región
> (Snapshots → More → Add to region) y créalo ahí. Nada del sistema depende de
> la región; el bucket de respaldos está en NYC3 de todas formas.

### 2.2 · La IP nueva (consola de `g500-2gb`)
```bash
echo ok; IP=$(curl -s http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address); echo "IP nueva: $IP"
free -m | head -2; swapon --show
cp -a /etc/space-os/eyes.env /etc/space-os/eyes.env.antes-mudanza
sed -i "s/^IP_PUBLICA=.*/IP_PUBLICA=$IP/" /etc/space-os/eyes.env
grep '^IP_PUBLICA=' /etc/space-os/eyes.env
grep -rIl '142\.93\.113\.106' /etc /opt/space-os 2>/dev/null || echo "ya no queda la IP vieja"
```
- `free -m` tiene que mostrar ~2 GB de total.
- La IP de `IP_PUBLICA` tiene que ser la de §2.1.4.
- La última línea tiene que decir `ya no queda la IP vieja` (salvo el respaldo
  `eyes.env.antes-mudanza`). Si sale otro archivo, **para y pásaselo a Claude**.

### 2.3 · La base llegó entera
```bash
echo ok; pg_lsclusters
sudo -u postgres psql -d spaces -Atc "select (select count(*) from tenants)||'/'||(select count(*) from usuarios)||'/'||(select count(*) from sitios)||'/'||(select count(*) from propuestas)||'/'||(select count(*) from campanas)||'/'||(select count(*) from arrendadores)"
```
Cluster 16 `online` en 5432, y la cadena **idéntica** a la de §0.3.

### 2.4 · Arrancar la app y Space Eyes
```bash
echo ok; docker start space-os
API=$(docker ps -a -q --filter label=com.docker.compose.project=space-eyes --filter label=com.docker.compose.service=api | head -1)
export EYES_IMAGEN=$(docker inspect --format '{{.Config.Image}}' "$API"); echo "imagen eyes: $EYES_IMAGEN"
docker compose -p space-eyes -f /opt/space-os/eyes/docker-compose.yml --env-file /etc/space-os/eyes.env up -d
docker ps --format '{{.Names}}  {{.Status}}'
```
El `up -d` **recrea** coturn y MediaMTX porque cambió `IP_PUBLICA`, y deja la
imagen de Space Eyes que ya tenía (no jala ninguna versión nueva).

### 2.5 · Comprobar antes de mover el DNS
```bash
echo ok; sleep 20; curl -s -o /dev/null -w 'app %{http_code}\n' http://127.0.0.1:3000/spaces-dooh/api/auth/metodos/
curl -s -o /dev/null -w 'eyes %{http_code}\n' http://127.0.0.1:4200/api/app/version
docker inspect --format '{{.Config.Env}}' $(docker ps -q --filter label=com.docker.compose.service=mediamtx) | tr ' ' '\n' | grep ADDITIONALHOSTS
nginx -t
```
`app 200`, `eyes 200`, MediaMTX con la IP nueva y `nginx -t` en `ok`.

Y desde **PowerShell**, el sitio por HTTPS en la máquina nueva **antes** de
tocar el DNS (usa `curl.exe`, no el alias de PowerShell):
```powershell
curl.exe -s -o NUL -w "%{http_code}`n" --resolve g500.space-os.io:443:<IP_NUEVA> https://g500.space-os.io/spaces-dooh/api/auth/metodos/
```
Tiene que dar `200`. **Si algo de §2 falla, no muevas el DNS**: ve a §4.

## 3 · Mover el DNS y comprobar con uso real

1. **Cloudflare**: registro A de `g500` → `<IP_NUEVA>` (nube gris).
2. PowerShell:
   ```powershell
   Resolve-DnsName g500.space-os.io -Type A -Server 1.1.1.1
   ```
3. Navegador, en `https://g500.space-os.io`: entra con una cuenta real; abre
   Inventario, una campaña y el Dashboard.
4. **Space Eyes**: los equipos reconectan solos por el dominio (pueden tardar
   unos minutos). Comprueba que salen **en línea**, pide **una foto** y abre
   **el vivo** de uno (el vivo es el que usa TURN e `IP_PUBLICA`).
5. En la consola de `g500-2gb`, el certificado y su renovación:
   ```bash
   echo ok; certbot renew --dry-run 2>&1 | tail -3
   ```

## 4 · Vuelta atrás (antes de dar el visto bueno)

1. **Cloudflare**: el A de `g500` de vuelta a `142.93.113.106`.
2. Panel: **enciende** el g500 viejo.
3. Su consola:
   ```bash
   echo ok; docker start space-os
   docker start $(docker ps -aq --filter label=com.docker.compose.project=space-eyes)
   ```
4. Apaga `g500-2gb` para que su cron no haga nada.

Lo que se haya capturado en el nuevo entre el cambio de DNS y la vuelta atrás
**no** pasa al viejo.

## 5 · Después

- **El viejo, apagado una semana.** Un droplet apagado se sigue cobrando;
  destrúyelo cuando estés seguro. Hasta entonces **no lo enciendas** sin volver a
  parar su app: su cron de respaldo subiría al mismo bucket que el nuevo.
- La instantánea `g500-mudanza-20261027` se puede borrar a la vez (se cobra por GB).
- **Instalar la v0.12.4** en g500 desde Administración → Actualizaciones, ya en la
  máquina nueva, y comprobar Node 22 en el contenedor
  (`docker exec space-os node -v` → `v22.23.4`).
- **PHP**: correr el paso 0 de la guía 28 en `g500-2gb`.
- Pendientes que viajaron con la copia (guía 21 y diario del 01/10): el cluster 14
  de PostgreSQL (`pg_dropcluster 14 main` si ya no hace falta) y el 403 del bucket
  `space-os-logs`.
- La IP vieja sigue escrita en documentos históricos
  (`space-eye/docs/ARQUITECTURA_SPACE_EYES.md`, guías 23 y 25); actualizarla en
  `ARQUITECTURA_SPACE_EYES.md`, que describe el presente.

## Lo que NO está verificado

- **Nunca se ha creado un droplet desde una instantánea de g500.** Es la función
  estándar de DigitalOcean, pero aquí es la primera vez.
- Que **solo** `eyes.env` guarde la IP: se comprueba en §0.3 y §2.2, no se supone.
- Que los equipos reconecten sin tocarlos: se apoya en el commit `7202c8b1`
  (entran por el dominio). Si un equipo instalado **antes** de ese cambio guarda la
  IP, no volverá solo: hay que mirarlo en §3.4.

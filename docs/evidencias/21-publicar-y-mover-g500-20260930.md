# Publicar la versión del 30/09–01/10 y mover g500 a PostgreSQL 16

**Fecha:** 2026-09-30 · **Lo corre:** una persona (Claude no toca servidores)
**Estado al escribirse:** `main` en `d49d9b76` (puesta al día el 01/10), **sin empujar**
(128 commits por delante de `emiliano`). g500 sigue en `v0.5.1` sobre PostgreSQL 14.24.

> Esta es la copia versionada: IPs, registry y dominios van como parámetro
> (`<IP_PADRE>`, `<IP_G500_VIEJO>`, `<IP_G500_NUEVO>`, `<REGISTRY>`), por la regla
> de `CLAUDE.md` de no quemar valores reales. La copia de `Downloads` los trae
> rellenos.

---

## 0 · Qué entra en esta versión

> **Puesta al día el 2026-10-01.** `main` en `d49d9b76`, **128 commits** por
> delante de `emiliano` — no solo lo del 30/09: todo lo que se acumuló desde el
> último empuje. Lo que se ve desde la aplicación:

| Área | Qué |
|---|---|
| Precios (ADR 0039) | Franjas y temporadas · descuento por volumen · códigos promocionales · paquetes cerrados · tope de descuento por organización · vendedor de cada propuesta |
| Cupones | **El cupón aplicado nace PENDIENTE** y lo aprueba un admin o gerente; el cliente no lo ve hasta entonces · asignar un cupón desde la pantalla de Códigos · rediseño de esa pantalla |
| Roles (ADR 0040) | Los cuatro roles de venta y su matriz · el administrador ve el control de cambios · OPERACIONES y FINANZAS costean la OT |
| Operaciones | Costo REAL de la OT · checklist que se guarda en cada clic · almacén por tipo (vehículos, herramientas, cámaras) con placas, marca, modelo, serie |
| Campañas | Lista compacta / minimizar / ocultar · menú lateral plegable · horario de transmisión por franja (lo programan gerente, director y dirección) |
| Creativos | En el menú de **Operaciones** · solo campañas digitales · fotos de hasta 4 MB · sin «Repartir a todas» |
| Luz | Subir el PDF del recibo de CFE · meses declarados antes de subir, y **arranca en bimestral** |
| Comercial | Comercial OPEX en dos columnas · Captación **construida pero oculta** del menú |
| Toda la app | Solo español (el inglés queda apagado) · todo en pesos · **colores de botones**: azul asignar/aceptar, verde añadir, rojo eliminar · seis módulos que daban 404 en el navegador · login con 503 claro si la base cae · contraseña pedida en facturar, cobrar, pagar renta y contratos |

**Migraciones nuevas: 14**, todas `@tipo: esquema` y **ninguna con `@pg-min`**
(revisado archivo por archivo el 01/10). La única que exige PostgreSQL 15 sigue
siendo la vieja `20260918_entidad_tenant_compuesto.sql`, que es la que tiene
bloqueado a g500. La última es `20261003_codigo_aprobacion.sql`: tres columnas
en `propuestas` y deja **APROBADOS** los cupones que ya estaban aplicados.

**Verificado en el árbol de `main`:** typecheck limpio, **3180 unitarias** en
233 archivos y la **e2e completa 823 en 60 archivos** (1 omitida) — esta última
corrida sobre `6a3182ab`; lo que entró después son colores de botones, el
selector de luz y el rediseño de Códigos, sin servidor ni base.

**Captación está oculta**: la migración crea sus tablas y permisos, pero la
entrada del menú está comentada (`nav.ts`). No hay que hacer nada; es a
propósito hasta que se decida.

**El orden importa:** A (publicar y validar en DEMO) → B (mover g500) → C
(promover a `estable` y que g500 la tome). Se puede promover antes de mover g500
sin daño —el g500 viejo, en 14, **rechaza la cola entera sin tocar nada**
(medido el 24/09, `16-g500-postgres-14-20260923.md`)—, pero así el primer
cliente que la reciba es el g500 nuevo, ya en 16.

---

## A · Publicar

### A1 · Empujar `main` (PowerShell, en tu máquina; una línea a la vez)

```
cd C:\Users\Server\spaces_doohmain_nueva
git status
git log --oneline -1
git push emiliano main
gh run list --repo emiliano-cyber/spaces_dooh_new --workflow ci.yml --limit 1
```

`git status` tiene que salir limpio y `git log` decir `d49d9b76` (o posterior).
Espera a que `ci.yml` salga **verde** antes de seguir: corre typecheck, pruebas,
build y e2e en una máquina limpia, que es una verificación que no depende de
esta máquina. `gh` **siempre** con `--repo`: sin él apunta al remoto muerto.

### A2 · Etiquetar la versión

Mira la última etiqueta publicada:

```
git fetch emiliano --tags
git tag --sort=-v:refname | Select-Object -First 3
```

La última documentada en el repo es `v0.8.1` (25/09). Usa la **siguiente
menor** —si la última es `v0.8.x`, la nueva es `v0.9.0`— y **nunca** reuses una
existente:

```
git tag v0.9.0
git push emiliano v0.9.0
gh run list --repo emiliano-cyber/spaces_dooh_new --workflow release.yml --limit 1
```

`release.yml` vuelve a correr **toda** la suite con Postgres 16 y, solo si pasa,
construye la imagen y la publica como `v0.9.0` y como `beta`. **No toca
`estable`.** Si sale rojo no se publica nada.

### A3 · El PADRE (consola web de DO del PADRE, bash)

La consola web **se come el primer carácter** de cada pegado: antepón `echo ok;`.

```bash
echo ok; cd /var/www/Spaces && git pull
npm install
git checkout -- package-lock.json
npm run build
chown -R padre:padre apps/web/.next
systemctl daemon-reload
systemctl restart spaces-web
install -m 750 /var/www/Spaces/infra/scripts/update.sh /opt/space-os/update.sh
install -m 750 /var/www/Spaces/infra/scripts/respaldo.sh /opt/space-os/respaldo.sh
```

Las dos últimas líneas importan: **`update.sh` no se actualiza solo** — solo lo
escriben los scripts de alta. Sin ellas DEMO y g500 correrían el de antes.
`pm2 restart` ya **no** vale; la app la arranca systemd.

### A4 · DEMO toma `beta` (en el PADRE)

DEMO sigue `beta` y lo haría sola a las 04:31. Para validar ya:

```bash
echo ok; SPACE_OS_CONF=/etc/space-os/demo-instancia.env /opt/space-os/update.sh --dry-run
SPACE_OS_CONF=/etc/space-os/demo-instancia.env /opt/space-os/update.sh
tail -n 40 /var/log/space-os/update.log
```

El `--dry-run` tiene que listar las migraciones pendientes (las 14 de §0, o las
que DEMO no tenga) y **no** salir con código 3 ni 4. La corrida real termina con
salud en verde. Luego entra a DEMO y recorre, en este orden:

1. **Códigos promocionales**: crea uno que empiece hoy, «Asignar a propuesta» a
   una en borrador. Tiene que quedar «Pendiente de aprobación».
2. **La propuesta**: «Aprobar código». Abre su liga de cliente: el descuento
   aparece solo después de aprobar.
3. **Consumo de luz**: el selector arranca en «3 meses … BIMESTRAL».
4. **Creativos** (en el menú de Operaciones): solo campañas digitales; sube una
   foto de 2–3 MB.
5. **Almacén**: da de alta una camioneta con placas.
6. Una **OT**: tacha un punto del checklist y recarga.
7. **Campañas**: vista compacta y menú plegable.
8. Mira que los botones de **añadir salgan verdes** y los de guardar/aprobar azules.

En local se recorrió todo esto en un navegador sin ventana; **en DEMO es la
primera vez con el build de la imagen.**

---

## B · Mover g500 a un droplet nuevo con PostgreSQL 16

**Por qué hace falta.** g500 corre PostgreSQL 14.24 y
`20260918_entidad_tenant_compuesto.sql` exige 15 (`on delete set null (col)`).
El runner **rechaza la cola entera**, así que g500 no toma ninguna versión desde
el 23/09. Subir el motor con datos dentro es una actualización mayor; un droplet
nuevo deja **el viejo intacto como vuelta atrás**.

**Lo que ya está hecho y medido (29/09):**
- Respaldo de g500 en tres sitios (disco, `s3://space-os-respaldos/g500/manual/`,
  `Downloads`): **13 812 252 bytes**, 501 entradas.
- **Ensayo local:** ese respaldo restaurado en PostgreSQL 16 —roles creados
  **exactamente** como en `infra/scripts/base-instancia.sh:96-139`— aplica todas
  las pendientes con código 0, la 2.ª corrida no hace nada, los datos quedan
  idénticos (1 organización, 3 usuarios, 13 sitios, 7 propuestas, 7 campañas,
  6 arrendadores) y la RLS funciona. g500 **no tiene** usuarios `COMERCIAL`.
- **La trampa encontrada en el ensayo:** con `spaces_migrador` sin `bypassrls` el
  runner aplica 13 y **muere en la 14 dejando la base a medio migrar**. El rol
  tiene que ser idéntico al del script.

> [!danger] Ningún script cubre este camino
> `provision-instancia.sh` aplica SIEMPRE `schema.sql` + `--instalacion-nueva`
> (`:788-797`), que chocaría con el respaldo; e `instalar-hijo.sh` aborta fuera
> de Ubuntu 22.04, cuyo Postgres por omisión es el 14. Por eso esta parte es a
> mano, y es exactamente lo que se ensayó.

### B0 · La víspera

1. **Cloudflare:** baja el TTL del registro A de `g500` a 1–2 minutos. Anota la
   IP actual (`<IP_G500_VIEJO>`): es la vuelta atrás.
2. **Acuerda una ventana** de ~45 min con quien usa g500: durante el corte no
   pueden capturar (lo que capturen en el viejo después del respaldo final se
   perdería).
3. Si quieres, pídele a Claude que repita el ensayo local con el respaldo del día:
   no toca servidores y tarda minutos.

### B1 · Droplet nuevo (panel de DigitalOcean)

- **Ubuntu 24.04 LTS** (su Postgres por omisión es el 16), **misma región** que el
  g500 viejo, tamaño igual o mayor.
- **Añade tu llave SSH** (`spaces_deploy`) al crearlo: sin ella no puedes copiar
  archivos desde tu máquina, y en el g500 viejo las llaves se retiraron.
- Nombre sugerido: `g500-pg16`. Anota su IP: `<IP_G500_NUEVO>`.

### B2 · Preparar el droplet (PowerShell, en tu máquina)

```
cd C:\Users\Server\spaces_doohmain_nueva
scp -i $HOME\.ssh\spaces_deploy infra\scripts\setup-droplet.sh infra\scripts\update.sh infra\scripts\respaldo.sh scripts\migrar.mjs root@<IP_G500_NUEVO>:/root/
ssh -i $HOME\.ssh\spaces_deploy root@<IP_G500_NUEVO>
```

Ya dentro del droplet nuevo (bash):

```bash
bash /root/setup-droplet.sh
apt-get install -y s3cmd
sudo -u postgres psql -Atc "select current_setting('server_version_num')::int / 10000"
```

El último comando **tiene que decir 16** (o al menos 15). Si dice 14, **para
aquí**. `setup-droplet.sh` está escrito para 22.04; en 24.04 debería funcionar
(Docker se instala con el nombre de la versión), pero **no se ha probado**: si
se cuelga en un diálogo, mira `docs/Runbook_Padre_Droplet_Nuevo.md:117-137`.

### B3 · Llevar la configuración del g500 viejo (consola web del VIEJO)

Los `.env`, el vhost de nginx y el certificado se copian del viejo: así la app
arranca con las **mismas contraseñas** y el HTTPS funciona desde el primer
minuto. Viajan por el bucket privado de respaldos, igual que el dump del 29/09.

```bash
echo ok; tar czf /root/g500-config.tgz /etc/space-os /etc/letsencrypt /etc/nginx/sites-available/g500.space-os.io
ls -l /root/g500-config.tgz
```

Súbelo al bucket con el bloque de siempre (el mismo que subió el dump el 29/09):

```bash
( set -a; . /etc/space-os/instancia.env; set +a
  EP="${SPACES_ENDPOINT:-https://${SPACES_REGION:-nyc3}.digitaloceanspaces.com}"; H="${EP#https://}"
  C=$(mktemp); chmod 600 "$C"
  printf '[default]\naccess_key = %s\nsecret_key = %s\nhost_base = %s\nhost_bucket = %%(bucket)s.%s\nuse_https = True\n' "$SPACES_KEY" "$SPACES_SECRET" "$H" "$H" > "$C"
  s3cmd --config="$C" put /root/g500-config.tgz "s3://${SPACES_BUCKET:-space-os-respaldos}/g500/manual/"
  s3cmd --config="$C" ls "s3://${SPACES_BUCKET:-space-os-respaldos}/g500/manual/"
  rm -f "$C" )
```

> Ese `.tgz` lleva secretos (contraseñas de la base, llave del certificado,
> tokens). Bórralo del bucket al terminar el paso B8.

### B4 · El corte: respaldo FINAL (consola web del VIEJO)

Desde aquí, g500 deja de atender. Para la app y saca el respaldo:

```bash
echo ok; docker stop space-os
F=/root/g500-final-$(date +%Y%m%d-%H%M).dump
sudo -u postgres pg_dump -Fc -d spaces > "$F"
ls -l "$F"
sudo -u postgres pg_restore -l < "$F" | head -5
```

Tiene que pesar lo mismo o algo más que el del 29/09 (13,8 MB), y `pg_restore -l`
tiene que listar su contenido. **Si pesa 0 o da error, `docker start space-os` y
para.** Súbelo al bucket con el mismo bloque de B3 cambiando el archivo por
`"$F"`.

### B5 · Roles, base vacía y restauración (droplet NUEVO)

En el nuevo, crea la carpeta de trabajo:

```bash
echo ok; mkdir -p /root/g500
```

Descarga los dos archivos desde el panel (Spaces → `space-os-respaldos` →
`g500/manual/`) a tu máquina y súbelos con `scp` desde PowerShell:

```
scp -i $HOME\.ssh\spaces_deploy C:\Users\Server\Downloads\g500-config.tgz C:\Users\Server\Downloads\g500-final-<FECHA>.dump root@<IP_G500_NUEVO>:/root/g500/
```

De vuelta en el nuevo:

```bash
cd / && tar xzf /root/g500/g500-config.tgz
APP_PASS=$(grep '^DATABASE_URL=' /etc/space-os/app.env | sed -E 's#^DATABASE_URL=postgresql://[^:]+:([^@]+)@.*#\1#')
MIG_PASS=$(grep '^DATABASE_URL=' /etc/space-os/instancia.env | sed -E 's#^DATABASE_URL=postgresql://[^:]+:([^@]+)@.*#\1#')
echo "app=${#APP_PASS} migrador=${#MIG_PASS}"
```

Las dos longitudes tienen que ser **mayores que 0**. Crea los roles **igual que
`base-instancia.sh`** —el migrador CON `bypassrls`, o el runner muere a medias—
y la base VACÍA:

```bash
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "create role spaces_app login password '$APP_PASS' nosuperuser nocreatedb nocreaterole noinherit nobypassrls"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "create role spaces_migrador login password '$MIG_PASS' nosuperuser nocreaterole noinherit bypassrls"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "create database spaces owner spaces_migrador"
sudo -u postgres psql -Atc "select rolname, rolbypassrls from pg_roles where rolname like 'spaces_%' order by 1"
```

Tiene que salir `spaces_app|f` y `spaces_migrador|t`. **No** apliques
`schema.sql` ni `--instalacion-nueva`. Restaura:

```bash
sudo -u postgres pg_restore -d spaces --exit-on-error /root/g500/g500-final-*.dump
echo "restore=$?"
```

`restore=0`. Si sale otra cosa, **no sigas**: pega la salida.

### B6 · Migraciones, en seco y luego de verdad (droplet NUEVO)

Usa el runner **de la imagen**, que es el mismo que usará `update.sh`. Sigue en
la **misma sesión** de B5 (usa `$MIG_PASS`). Carga `instancia.env` y entra al
registry con su token de solo lectura:

```bash
set -a; . /etc/space-os/instancia.env; set +a
IMG="$REGISTRY/${IMAGEN_NOMBRE:-space-os}:v0.9.0"; echo "$IMG"
echo "$REGISTRY_TOKEN" | docker login "${REGISTRY%%/*}" -u "$REGISTRY_TOKEN" --password-stdin
docker run --rm --network host -e DATABASE_URL="postgresql://spaces_migrador:$MIG_PASS@127.0.0.1:5432/spaces" "$IMG" node scripts/migrar.mjs --pendientes
echo "codigo=$?"
```

- **codigo=0** y una lista de pendientes: bien. Sigue.
- **codigo=3** (checksum distinto): **no** uses `--forzar-checksum`; pega la salida.
- **codigo=4**: el motor no es el nuevo. Para.

Aplica (sin `--con-datos`, como `update.sh`) y repite para ver que ya no hay nada:

```bash
docker run --rm --network host -e DATABASE_URL="postgresql://spaces_migrador:$MIG_PASS@127.0.0.1:5432/spaces" "$IMG" node scripts/migrar.mjs
docker run --rm --network host -e DATABASE_URL="postgresql://spaces_migrador:$MIG_PASS@127.0.0.1:5432/spaces" "$IMG" node scripts/migrar.mjs
```

La 2.ª tiene que decir «0 aplicadas». Queda una pendiente `@tipo: datos`
(`20260731_calendario_meses_cortos.sql`): es a propósito, no la apliques.

### B7 · Instalar la app (droplet NUEVO)

```bash
install -d -m 755 /opt/space-os /var/log/space-os
install -m 750 /root/update.sh /opt/space-os/update.sh
install -m 750 /root/respaldo.sh /opt/space-os/respaldo.sh
install -m 640 /root/migrar.mjs /opt/space-os/migrar.mjs
grep -nE '^(CANAL|CONTENEDOR|DOCKER_OPCIONES_APP|SALUD_URL|DATABASE_URL)=' /etc/space-os/instancia.env
bash -c 'set -e; . /etc/space-os/instancia.env; echo "[$DOCKER_OPCIONES_APP] [$PULL_ESPERAS]"'
```

`instancia.env` **se ejecuta** como bash (`update.sh:841`): un valor con
espacios sin comillas hace que bash ejecute la segunda palabra. La última línea
tiene que imprimir los corchetes sin error.

Mientras `estable` no tenga la versión nueva, g500 la toma de `beta`: cambia
temporalmente `CANAL=estable` por `CANAL=beta` en `/etc/space-os/instancia.env`
(y vuelve a ponerlo en C2). Luego:

```bash
/opt/space-os/update.sh --dry-run
/opt/space-os/update.sh
tail -n 40 /var/log/space-os/update.log
```

Termina con salud en verde. Instala el nginx copiado y el cron:

```bash
ln -sfn /etc/nginx/sites-available/g500.space-os.io /etc/nginx/sites-enabled/g500.space-os.io
nginx -t && systemctl reload nginx
printf '%s\n' '*/15 * * * * root /opt/space-os/update.sh --comprobar >> /var/log/space-os/cron.log 2>&1 || [ $? -eq 75 ]' '17 4 * * * root /opt/space-os/update.sh >> /var/log/space-os/cron.log 2>&1' > /etc/cron.d/space-os-update
```

### B8 · Comprobar y mover el DNS

Antes de mover nada, compara los datos del viejo (ya parado, su base sigue ahí)
con los del nuevo. Corre esto **en los dos**:

```bash
sudo -u postgres psql -d spaces -Atc "select (select count(*) from tenants)||'/'||(select count(*) from usuarios)||'/'||(select count(*) from sitios)||'/'||(select count(*) from propuestas)||'/'||(select count(*) from campanas)||'/'||(select count(*) from arrendadores)"
```

Las dos cadenas tienen que ser **iguales**. Entonces, en **Cloudflare**, cambia el
registro A de `g500` a `<IP_G500_NUEVO>`. Comprueba desde PowerShell:

```
Resolve-DnsName g500.space-os.io
```

Entra a `https://g500.space-os.io` con una cuenta real y recorre lo mismo que en
DEMO (A4). Borra del bucket `g500/manual/g500-config.tgz`.

> El certificado viajó con el `.tgz`, así que HTTPS funciona desde el primer
> minuto, y `certbot` lo renueva solo en la máquina nueva en cuanto el DNS apunta
> ahí. Si algo falla con él, el camino documentado es
> `provision-instancia.sh --host <IP_G500_NUEVO> --dominio g500.space-os.io --emitir-certificado --confirmar`
> con `CERTBOT_EMAIL` (máximo 5 intentos por hora).

### B9 · Vuelta atrás, si algo sale mal

En cualquier punto antes de dar el visto bueno:

1. **Cloudflare:** el registro A de `g500` de vuelta a `<IP_G500_VIEJO>`.
2. **Consola del VIEJO:** `docker start space-os`.

El viejo quedó intacto: misma base, misma versión (`v0.5.1`). **No lo apagues en
una semana.** Para que no reintente nada mientras tanto, desactívale el cron:

```bash
echo ok; sed -i 's|^\*/15|#*/15|' /etc/cron.d/space-os-update
```

---

## C · Promover a `estable`

Con DEMO recorrida y g500 nuevo en verde:

```
gh workflow run promover.yml --repo emiliano-cyber/spaces_dooh_new -f version=v0.9.0 -f motivo="cupon con aprobacion, precios ADR 0039, roles de venta, almacen por tipo, checklist OT, luz bimestral, colores de botones"
gh run list --repo emiliano-cyber/spaces_dooh_new --workflow promover.yml --limit 1
```

`promover.yml` comprueba que el digest de `v0.9.0` es el de `beta`, hace el
smoke contra `DEMO_URL` y reetiqueta con `crane copy` (mismos bytes). Después, en
el g500 nuevo, vuelve a poner `CANAL=estable` en `/etc/space-os/instancia.env`.
Desde ahí el cron de las 04:17 lo mantiene al día.

---

## Lo que NO está verificado, con todas las letras

- **Las pantallas nuevas se recorrieron en local** (navegador sin ventana), **no
  con el build de la imagen**: A4 y B8 son la primera vez ahí.
- **`setup-droplet.sh` en Ubuntu 24.04** no se ha corrido nunca.
- **El respaldo FINAL** no se ha ensayado: el ensayo fue con el del 29/09. Si
  g500 cambió mucho desde entonces, repite el ensayo local antes (B0.3).
- **El paso B6 con el runner de la imagen** se ensayó con el runner del repo, no
  con el de la imagen; son el mismo archivo, pero no se ha medido en el droplet.
- **La llave de g500 da 403 en el bucket de logs** (`space-os-logs`): el log de
  `update.sh` se queda en el droplet hasta que se arregle en el panel de DO.

Ver también `vault/07-Agentes/diario/2026-09-30.md`,
`docs/evidencias/16-g500-postgres-14-20260923.md` y
`vault/01-Arquitectura/entorno-y-despliegue.md`.

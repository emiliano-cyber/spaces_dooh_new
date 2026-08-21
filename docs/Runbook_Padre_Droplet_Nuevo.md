# Runbook · levantar el droplet PADRE desde cero

**Escrito el 2026-08-20 para ejecutarse el 21.** Lo escribe un agente; **lo corre
una persona**. Ningún comando de este documento se ha ejecutado contra un
servidor.

---

## 0 · Antes de nada: una contradicción que hay que resolver en voz alta

> [!danger] El plan dice una cosa y lo de mañana dice otra
> **P1, cerrada hoy**, dice: *«el droplet **actual** pasa a ser el PADRE»* —
> repurposar el que ya existe, y recrear sus datos.
>
> **Lo de mañana** es: *«migramos todo al droplet padre de producción **apenas lo
> contratemos**»* — un droplet **nuevo**.
>
> **No son lo mismo, y cambian tres cosas:**
>
> | | Si el PADRE es el droplet actual | Si el PADRE es uno nuevo |
> |---|---|---|
> | Coste nuevo | **$0** por el padre | **+$12/mes** (2 GB) |
> | Qué se hace | Recrear sus datos en sitio | **Instalar todo desde cero** |
> | El droplet viejo | Es el padre | **Hay que decidir qué pasa con él** |
>
> Este runbook cubre **el droplet nuevo**, porque es lo que se pidió. Si al final
> se repurposa el actual, sirve el otro runbook
> (`Runbook_Merge_y_Produccion_20260820.md`) y **P1 se queda como está**.
>
> **Lo que hay que decidir antes de empezar:** qué pasa con el droplet viejo, y
> si su base se copia o se recrea. P1 dijo **recrear** —los datos son de prueba—
> y este runbook lo da por bueno. Si hay que copiar algo, para y dilo: cambia el
> orden entero.

## 0-bis · Qué NO existe todavía, y por eso mañana es a mano

Esto no es una queja: es lo que evita que alguien busque un script que no está.

- **No hay aprovisionamiento automático.** F5.1 a F5.4 —`withTxBootstrap`, el
  bootstrap de un solo uso, las plantillas de `.env`/nginx y
  `provision-instancia.sh`— **no están escritas**. Todo lo de abajo es manual.
- **`setup-droplet.sh` no instala Postgres.** Deja Node 20 (nvm), pm2, nginx,
  certbot, `ufw` y el directorio del proyecto. La base va aparte, en el paso 3.
- **No hay plantilla de `.env.production` verificada.** Eso es F5.3, y su lista
  de claves además está incompleta (le faltan las cinco de respaldos).
- **`update.sh` no sirve aquí.** Actualiza un **contenedor**; este droplet corre
  con **pm2**, igual que el actual. Se despliega con `deploy.yml`.

---

## 1 · El droplet

**2 GB / 1 vCPU / 50 GB, Ubuntu 22.04**, con **backups activados**.

> **Por qué 2 GB y no 1.** El plan presupuestó el PADRE a 1 GB describiéndolo
> como *«plano de control… no sirve a clientes»*. Ya no es eso: aquí corre la
> aplicación —el super admin `rgb` crea instancias y dueños— **más Postgres**. El
> propio plan pide 2 GB para DEMO justo por eso: *«ahí conviven Docker, Next y
> Postgres»*. Con 1 GB, el `npm run build` de Next es lo primero que muere.

Del panel, o:

```bash
doctl compute droplet create padre --size s-1vcpu-2gb --image ubuntu-22-04-x64 \
  --region <la misma que el actual> --enable-backups --ssh-keys <tu-fingerprint>
```

**Anota la IP.** Y el firewall de DO abierto **solo a 22, 80 y 443**.

## 2 · Sistema base

```bash
ssh root@<IP>
git clone <repo> /var/www/Spaces && cd /var/www/Spaces
bash infra/scripts/setup-droplet.sh
```

**Deja:** Node 20 por nvm, pm2, nginx, certbot, `ufw` con 22/80/443 y
`/var/www/Spaces`. **No deja Postgres.**

## 3 · Postgres

```bash
apt-get install -y postgresql postgresql-contrib
systemctl enable --now postgresql
sudo -u postgres psql -Atc "select version()"
```

Crear la base y el **rol de aplicación**, con contraseña propia de esta
instancia:

```bash
sudo -u postgres createdb spaces_prod
CLAVE=$(openssl rand -base64 24)
sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
  "create role spaces_app login password '$CLAVE' nosuperuser nobypassrls;"
echo "GUARDA ESTA CLAVE EN EL GESTOR DE SECRETOS: $CLAVE"
```

**Comprobar antes de seguir** — si sale `t` en cualquiera de los dos, **para**:
un rol de aplicación que se salta la RLS anula el aislamiento interno.

```bash
sudo -u postgres psql -Atc \
  "select rolname||'|'||rolsuper||'|'||rolbypassrls from pg_roles where rolname='spaces_app'"
```
**Esperado:** `spaces_app|f|f`.

> ⚠️ **El nombre no es negociable: `spaces_app`.** Los otros nombres no
> funcionan, y no por gusto: con uno distinto la cadena aborta en
> `20260729_licencias_permisos.sql:88-97` —**archivo 52 de 70, 33 tablas**— y hay
> que empezar de nuevo. Medido el 20/08. Lo propio de la instancia es la
> **contraseña**.

## 4 · El esquema, en el orden que sí funciona

**Este orden no es negociable**, y está medido: sin el paso 3 la cadena aborta en
la migración **52 de 70**.

```bash
cd /var/www/Spaces
sudo -u postgres psql -d spaces_prod -v ON_ERROR_STOP=1 -f db/schema.sql

DATABASE_URL="postgresql://postgres@/spaces_prod?host=/var/run/postgresql" \
  node scripts/migrar.mjs --instalacion-nueva
```

**Esperado:** `70 aplicadas, 1 de datos pendientes.` y **salida 0**. La pendiente
es `20260731_calendario_meses_cortos.sql`, que es `@tipo: datos` y **se queda
fuera a propósito** (decisión P7: las de datos las aplica una persona, aparte).

Comprobar:

```bash
sudo -u postgres psql -d spaces_prod -Atc \
  "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"
sudo -u postgres psql -d spaces_prod -Atc \
  "select count(*)||' / '||count(distinct modulo)||' / '||count(distinct rol) from rol_permisos"
```
**Esperado:** **39** tablas, y **`41 / 9 / 5`** de permisos.

> **Si el runner se para diciendo `no existe ningun rol de aplicacion`:** el paso
> 3 no se hizo, o el rol se llamó de otra forma.

## 5 · La organización y su Dueño

```bash
cd /var/www/Spaces/apps/web
DATABASE_URL="postgresql://postgres@/spaces_prod?host=/var/run/postgresql" \
  ORG_SLUG=<slug> ORG_NOMBRE='<Nombre>' \
  ADMIN_EMAIL=<correo> ADMIN_NOMBRE='<Nombre de la dueña>' \
  node scripts/bootstrap-auth.mjs
```

**Esperado**, y esto es lo único que hay que copiar a mano:

```
OK · usuarios: 1 · organización: <slug>
Dueño: <correo>
Contraseña temporal (se muestra UNA sola vez): XXXX-XXXX-XXXX-XXXX
```

**Guárdala antes de cerrar la terminal.** Se muestra una vez, la cuenta nace
**obligada a cambiarla**, y repetir el script **no la vuelve a generar**: si se
pierde, se restablece desde Administración.

> **El correo del Dueño tiene que ser una cuenta de Google** si se quiere el
> acceso decidido el 20/08. Ojo: los códigos de recuperación **no existen
> todavía**, así que hoy la única vía es la contraseña temporal.

## 6 · Configuración de la aplicación

`/var/www/Spaces/apps/web/.env.production`, como mínimo:

```
DATABASE_URL=postgresql://spaces_app:<LA CLAVE DEL PASO 3>@localhost:5432/spaces_prod
AUTOREGISTRO=0
GOOGLE_OAUTH=1
```

> **`AUTOREGISTRO=0` no se toca.** Nadie crea su propia cuenta en ninguna
> instancia: el super admin del PADRE crea instancias y dueños, y cada dueño da
> de alta a su equipo. Es fail-closed, así que ausente también vale — pero se
> escribe para que se lea.
>
> ⚠️ **No copies `COOKIE_DOMAIN`.** Si aparece en algún `.env` viejo, **bórralo**:
> es una cookie comodín del modelo de subdominios que murió el 12/08, y el día
> que alguien haga configurable ese `domain`, dos instancias comparten sesión.
> Eso es **TH-T03**.

Las demás claves salen del `.env.production` del droplet actual. **Revísalas una
a una**: no hay plantilla verificada todavía (es F5.3, sin escribir).

## 7 · Arrancar

```bash
cd /var/www/Spaces
npm ci
npm --prefix apps/web run build
pm2 start ecosystem.config.js && pm2 save && pm2 startup
pm2 describe spaces-web | grep -iE 'status|uptime|restarts'
```

## 8 · Dominio y certificado

```bash
cp infra/nginx/<conf> /etc/nginx/sites-available/<dominio>
ln -s /etc/nginx/sites-available/<dominio> /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d <dominio>
```

Y **bajar el TTL en Cloudflare antes** de mover el registro A, no después.

## 9 · Verificación final

```bash
curl -s -o /dev/null -w 'login: %{http_code}\n' https://<dominio>/spaces-dooh/login/
curl -s -o /dev/null -w 'signup: %{http_code}\n' -X POST https://<dominio>/spaces-dooh/api/signup/
curl -s https://<dominio>/spaces-dooh/api/auth/metodos/
```

**Esperado:** `login: 200` · **`signup: 503`** · `{"google":true,"autoregistro":false}`.

Un **400** en `signup` **no es un estado válido**: significa que el registro está
abierto y hay que cerrarlo.

Y entrar con el correo del Dueño y la temporal: debe dejar entrar, y **cortar con
403** en todo hasta cambiarla. Eso es lo correcto, no un fallo.

## 10 · Vuelta atrás

Mientras el droplet viejo siga en pie, la vuelta atrás es **no mover el DNS**.
Ése es el motivo de bajar el TTL antes: revertir el registro A es un minuto.

**No apagues el droplet viejo el mismo día.** Déjalo una semana, con su base
intacta, hasta que el nuevo lleve tráfico real sin sorpresas.

---

## Lo que este runbook NO cubre

- **El registry y las imágenes** (TH-P4, `release.yml`): este droplet corre con
  pm2 y `deploy.yml`, no con contenedores.
- **`update.sh`**: es del modelo de instancias, que nace en la Fase 5.
- **Migrar datos del droplet viejo**: P1 dijo **recrear**. Si hay que copiar
  algo, este runbook no sirve tal cual.

---

*Preparado el 2026-08-20. Ningún comando se ha ejecutado.*

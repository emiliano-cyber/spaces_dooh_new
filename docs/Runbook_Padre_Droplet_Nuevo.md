# Runbook · levantar el droplet PADRE desde cero

**Escrito el 2026-08-20 para ejecutarse el 21.** Lo escribe un agente; **lo corre
una persona**. Ningún comando de este documento se ha ejecutado contra un
servidor.

> [!success] CORRIDO DE VERDAD el 2026-08-21 — pasos 1 a 7 en un droplet real
> Este runbook **ya no es teoría**. Se ejecutó sobre
> `ubuntu-s-2vcpu-4gb-amd-nyc1` (NYC1, Ubuntu 24.04, 2 vCPU / 4 GB) y los pasos
> **1 a 7 quedaron cerrados**: 70 migraciones aplicadas, 39 tablas, catálogo
> 41/9/5, el Dueño creado y la aplicación sirviendo con pm2 —`online`,
> `restarts: 0`—. Faltan el 8 (dominio y certificado) y el 9.
>
> **Salieron SIETE defectos que en local no podían aparecer**, y están corregidos
> abajo. Van marcados con 🔧 para que se vea qué cambió respecto a lo que se
> escribió el día 20.
>
> Se clona **la rama**, no `main` — ver el paso 2. Empujada a `emiliano` el 21/08.

---

## 0 · Decidido: el PADRE es un droplet NUEVO

> [!important] Confirmado por Jochelo el 2026-08-20 · enmienda a P1
> **P1 se cerró esta misma tarde diciendo que «el droplet ACTUAL pasa a ser el
> PADRE».** Queda enmendado: **el PADRE se contrata aparte**, y a él se migra
> todo. Este runbook es el bueno.
>
> **Lo que eso cambia respecto a lo presupuestado:**
>
> | | Lo que decía P1 | Lo decidido |
> |---|---|---|
> | Coste del padre | $0 — se reusaba el actual | **+$12/mes** (2 GB) |
> | Trabajo | recrear datos en sitio | **instalar todo desde cero** |
> | Total nuevo al mes | ≈ $22 | **≈ $34** |
>
> El ≈ $34 sale de: padre nuevo $12 + DEMO $12 + backups de los dos $3,60 +
> registry $5 + snapshot ≈ $1,50. Son **precios de lista de DigitalOcean sin
> impuestos**, del plan del 12/08; **la cuenta real nunca se ha consultado**.

> [!warning] Y una pregunta que esto reabre, y que no está decidida
> Si el PADRE es nuevo, **¿qué pasa con el droplet de hoy?** P1 lo resolvía
> convirtiéndolo en padre; ya no. Las salidas son tres y no cuestan lo mismo:
>
> 1. **Se apaga** cuando el nuevo lleve tráfico. Ahorra su factura.
> 2. **Se queda como DEMO**, que es un droplet que el plan presupuesta aparte
>    ($12): si sirve éste, **te ahorras esos $12**.
> 3. Se queda de reserva un tiempo y luego se decide.
>
> **La 2 es la que más ahorra y la que menos trabajo pide**, pero hay que
> mirarla: hoy ese droplet **sirve `demo.space-os.io` y los tenants a la vez**, y
> separarlos era justo el objetivo de la Fase 4.
>
> **No lo decido yo.** Lo que sí digo: **no apagues el viejo el mismo día** —ver
> el paso 10.

**Los datos del droplet viejo NO se copian.** P1 lo decidió y eso no cambia: son
de prueba y se recrean. Si mañana hay que copiar algo, **para**: este runbook no
sirve tal cual y el orden entero cambia.

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

> [!danger] Se clona la RAMA, no `main`. Si clonas `main`, el paso 4 no existe
> **Medido el 21/08:** `main` tiene **66 migraciones** y **no tiene
> `scripts/migrar.mjs`**. Todo lo de la última semana —el runner, las 5
> migraciones nuevas, el alta que genera la contraseña— vive en
> `feat/servidor-padre-instancias`, que **no está fusionada**.
>
> Clonar `main` te deja con: el paso 4 fallando con «no such file», y un
> `bootstrap-auth.mjs` viejo que **siembra `spaces123` y no obliga a cambiarla**
> — o sea, justo el defecto que se cerró ayer.

```bash
ssh root@<IP>
git clone -b feat/servidor-padre-instancias <repo> /var/www/Spaces
cd /var/www/Spaces
bash infra/scripts/setup-droplet.sh
```

**Comprobar antes de seguir**, que cuesta dos segundos y evita el error entero:

```bash
git rev-parse --abbrev-ref HEAD          # feat/servidor-padre-instancias
ls scripts/migrar.mjs                    # tiene que existir
ls db/migrations/*.sql | wc -l           # 71
```

**Deja:** Node 20 por nvm, pm2, nginx, certbot, `ufw` con 22/80/443 y
`/var/www/Spaces`. **No deja Postgres.**

> [!warning] 🔧 El script NO es desatendido: se cuelga en un diálogo de `dpkg`
> Su primer paso hace `apt-get upgrade -y`, y ese `-y` **no cubre los archivos de
> configuración modificados**. La imagen de DigitalOcean trae `sshd_config`
> tocado, así que `dpkg` **abre un diálogo y espera**.
>
> **Cuando salga, elige «keep the local version currently installed»** —viene ya
> seleccionada, basta Enter—. La otra opción reemplaza el `sshd_config` de
> DigitalOcean por el de Ubuntu de fábrica, y ahí te puedes quedar sin SSH.
>
> Para correrlo sin que pregunte —y esto hay que meterlo en el script cuando sea
> `provision-instancia.sh`, o un aprovisionamiento automático se cuelga aquí para
> siempre y sin decir por qué:
>
> ```bash
> DEBIAN_FRONTEND=noninteractive apt-get -o Dpkg::Options::=--force-confold upgrade -y
> ```

> [!warning] 🔧 IGNORA los «Pasos siguientes» que imprime el script al terminar
> Ese epílogo es del **modelo viejo** y lleva a un sitio que ya no existe: manda
> clonar en `/var/www/spaces-dooh` (crea ese directorio vacío, que sobra), hacer
> `cp .env.example apps/api/.env` —**`apps/api` es el backend Fastify
> archivado**— y pedir un certificado **comodín** `*.{slug}.spaces.com`, del
> modelo de subdominios por tenant que murió el 12/08.
>
> **Sigue este runbook, no el epílogo.** El directorio de más se quita con
> `rmdir /var/www/spaces-dooh`.

> [!warning] Este droplet va a correr una RAMA, y eso hay que recordarlo
> Es deliberado: el merge a `main` sigue bloqueado por **cuatro cambios sin
> revisar**, y no tiene sentido dejar un servidor a medias esperando a eso.
>
> Pero un servidor de producción corriendo una rama de trabajo **no puede ser el
> estado final**. En cuanto esos cuatro tengan visto bueno y la rama entre a
> `main`, hay que pasarlo:
>
> ```bash
> cd /var/www/Spaces && git fetch origin && git checkout main && git pull
> npm ci && npm --prefix apps/web run build && pm2 reload spaces-web
> ```
>
> Hasta entonces, **el despliegue por `deploy.yml` hay que dispararlo con
> `ref: feat/servidor-padre-instancias`**, no con `main`.

## 2-bis · 🔧 Las dependencias, ANTES de migrar

**Esto no estaba y costó una vuelta.** El runner de migraciones (`migrar.mjs`) es
Node e importa `pg`: sin dependencias instaladas muere con
`ERR_MODULE_NOT_FOUND: Cannot find package 'pg'`. Estaba en el paso 7, donde ya
es tarde.

```bash
cd /var/www/Spaces
source /etc/profile.d/nvm.sh
npm ci
```

Tarda menos de un minuto. Verás avisos de `deprecated`, un `EBADENGINE` de
`@mapbox/jsonlint` y un recuento de vulnerabilidades.

> ⚠️ **NO corras `npm audit fix`.** Cambiaría el `package-lock.json` y el servidor
> dejaría de correr lo que CI probó. Los avisos se tratan en el repositorio, con
> pruebas, no a mano en un servidor.

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

### 🔧 Y una contraseña para el rol de MIGRACIONES

El runner corre como **root**, no como el usuario `postgres`, así que la
autenticación `peer` del socket lo rechaza: `Peer authentication failed for user
"postgres"`. Y no se puede correr como `postgres` porque Node vive bajo
`/root/.nvm`, donde ese usuario no entra.

Va por **TCP con contraseña** — que además es como va a conectar el runner el día
que corra dentro de un contenedor:

```bash
CLAVE_PG=$(openssl rand -base64 24)
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "alter role postgres password '$CLAVE_PG';"
echo "GUARDA TAMBIEN ESTA: $CLAVE_PG"
```

**Esta contraseña NO va a ningún `.env`.** Solo se usa a mano, para migrar.

## 4 · El esquema, en el orden que sí funciona

**Este orden no es negociable**, y está medido: sin el paso 3 la cadena aborta en
la migración **52 de 70**.

```bash
cd /var/www/Spaces
source /etc/profile.d/nvm.sh
sudo -u postgres psql -d spaces_prod -v ON_ERROR_STOP=1 -f db/schema.sql

DATABASE_URL="postgresql://postgres:$CLAVE_PG@localhost:5432/spaces_prod" \
  node scripts/migrar.mjs --instalacion-nueva
```

> 🔧 **La primera versión de este runbook usaba una URL de socket unix**
> (`postgresql://postgres@/spaces_prod?host=/var/run/postgresql`) y **no
> funciona**: ver el paso 3. Peor, el runner contestó `destino: (url no
> parseable)`, que **escondió el error real** hasta la mitad de la línea
> siguiente. Anotado como defecto del mensaje.

El `schema.sql` imprime muchos `NOTICE: policy "tenant_isolation" ... does not
exist, skipping`. **Son normales en una base nueva** y no indican nada malo.

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
EMAIL='correo@ejemplo.com'
NOMBRE='Nombre y apellido'
echo "correo: [$EMAIL]  nombre: [$NOMBRE]"     # MIRALO antes de seguir

DATABASE_URL="postgresql://postgres:$CLAVE_PG@localhost:5432/spaces_prod" \
  ORG_SLUG=<slug> ORG_NOMBRE='<Nombre>' \
  ADMIN_EMAIL="$EMAIL" ADMIN_NOMBRE="$NOMBRE" \
  node scripts/bootstrap-auth.mjs
```

> [!danger] 🔧 Fija las variables antes y MIRALAS. El alta no valida el correo
> En la primera corrida se pegó el bloque con los marcadores puestos, y el alta
> **creó al Dueño con el correo literal `<el correo de Google del Dueño>`**.
> `bootstrap-auth.mjs` comprueba que las variables no estén **vacías**, pero no
> que el correo **parezca un correo** — aunque el repositorio tiene
> `esEmailValido` (`lib/validacion.ts`) y la aplicación sí lo usa al dar de alta
> desde Administración.
>
> O sea: **por la pantalla no puedes crear un usuario con un correo inválido; por
> el alta de una instancia, sí.** Y es la cuenta de máximo privilegio.
>
> **Si te pasa:** se arregla borrando y repitiendo, porque la base está vacía.
> ```bash
> sudo -u postgres psql -d spaces_prod -c "delete from usuarios where email='<el que se coló>'"
> sudo -u postgres psql -d spaces_prod -Atc "select count(*) from usuarios"   # 0
> ```
> El tenant se queda creado y el alta lo reutiliza.

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

### 🔧 El archivo nace 644: ponle candado

```bash
chmod 600 .env.production
ls -l .env.production          # -rw-------
sed -E 's/(SECRET|KEY|TOKEN)=.*/\1=***/; s/:[^:@]*@/:***@/' .env.production
```

Por omisión se crea **legible por cualquier usuario del droplet**, y dentro está
la contraseña de la base. El `sed` te lo enseña con los secretos tapados.

### Qué traer del droplet viejo, y qué NO

Contado sobre lo que la aplicación lee de verdad (`process.env` en `apps/web`):

| Grupo | Hace falta en el PADRE |
|---|---|
| `DATABASE_URL`, `AUTOREGISTRO`, `NODE_ENV`, `APP_URL` | **Sí.** Se deciden aquí |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | **Sí** para el acceso con Google |
| `RESEND_API_KEY`, `EMAIL_FROM` | **Sí**, para restablecer contraseñas |
| `DO_SPACES_*` | Sí, si se suben archivos |
| `DOOHMAIN_*`, `ADMOBILIZE_API_KEY`, `CMS_API_TOKEN`, `CFDI_PAC_KEY`, `SPACE_EYE_*` | **No.** Son de **operación**, y el PADRE es plano de control |
| `*_TEST`, `GOOGLE_DOBLE_*`, `PUERTO_*` | **Nunca** en producción |

> ⚠️ **No copies `DOOHMAIN_PUBLISH_ENABLED=1`.** En el droplet viejo eso significa
> que lo que sale llega a **pantallas de verdad**. Copiarlo dejaría dos servidores
> capaces de publicar en las mismas pantallas.

Para pegar las claves sin que queden en el historial:

```bash
read -r  -p "GOOGLE_CLIENT_ID: "     GCID
read -r -s -p "GOOGLE_CLIENT_SECRET: " GCSEC; echo
cat >> .env.production <<EOF
GOOGLE_CLIENT_ID=$GCID
GOOGLE_CLIENT_SECRET=$GCSEC
EOF
unset GCID GCSEC
```

> ⚠️ **No pongas valores de prueba.** `google-oauth.ts:46` solo comprueba que las
> dos variables **no estén vacías**: con valores falsos, `/api/auth/metodos/`
> contesta `google:true`, el botón «Entrar con Google» **aparece** y se estrella
> al pulsarlo. Mejor dejarlas fuera hasta tener las de verdad.

## 7 · Arrancar

```bash
cd /var/www/Spaces
source /etc/profile.d/nvm.sh
mkdir -p logs
npm --prefix apps/web run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root
pm2 describe spaces-web | grep -iE 'status|uptime|restarts|memory'
```

**Esperado:** `status: online` y **`restarts: 0`**. El `npm ci` ya se hizo en el
paso 2-bis.

### El humo en el propio droplet, antes de publicar nada

```bash
curl -s -o /dev/null -w 'login:  %{http_code}\n' http://localhost:3000/spaces-dooh/login/
curl -s -o /dev/null -w 'signup: %{http_code}\n' -X POST http://localhost:3000/spaces-dooh/api/signup/
curl -s http://localhost:3000/spaces-dooh/api/auth/metodos/; echo
pm2 describe spaces-web | grep -iE 'status|restarts|uptime'
```

**Medido el 21/08 en el PADRE:** `login: 200` · **`signup: 503`** ·
`{"google":true,"autoregistro":false}` · `online`, `restarts: 0`, `uptime: 5m`.

Vuelve a mirar los `restarts` **después** de los `curl`: si subieron, se está
reiniciando en bucle. `pm2 logs spaces-web --lines 40 --nostream`.

## 8-bis · 🔧 Provisional: servir por IP mientras no hay dominio

**No se pega la configuración en la consola: se trae del repositorio.** Pegar un
bloque largo en la consola web del droplet **corrompe el archivo** —duplica
líneas— y `nginx -t` **pasa igual**, porque el resultado sigue siendo válido.

```bash
cd /var/www/Spaces && git pull
ln -sf /var/www/Spaces/infra/nginx/padre-ip.conf /etc/nginx/sites-enabled/padre-ip
rm -f /etc/nginx/sites-enabled/default          # trae su propio default_server
ls -l /etc/nginx/sites-enabled/                 # SOLO debe salir padre-ip
nginx -t && systemctl reload nginx
```

Y se comprueba por **códigos de respuesta**, no por «arrancó»:

```bash
curl -s -o /dev/null -w 'directo:  %{http_code}\n' http://localhost:3000/spaces-dooh/login/
curl -s -o /dev/null -w 'raiz:     %{http_code}\n' http://localhost/
curl -s -o /dev/null -w 'login:    %{http_code}\n' http://localhost/spaces-dooh/login/
curl -s -o /dev/null -w 'signup:   %{http_code}\n' -X POST http://localhost/spaces-dooh/api/signup/
```

**Medido el 21/08:** `directo 200` · `raiz 302` · `login 200` · `signup 503`.

> [!danger] Por IP NO se puede iniciar sesión, y no es un defecto
> La cookie de sesión sale con `Secure` (`apps/web/lib/server/auth.ts:184-188`) y
> el navegador **no la manda por HTTP**. La pantalla carga, el login contesta 200
> y la sesión no persiste.
>
> **Para usar la aplicación completa hoy**, sin dominio y sin bajar defensas:
> ```bash
> ssh -L 3000:localhost:3000 root@<IP>      # desde TU maquina
> ```
> y abrir `http://localhost:3000/spaces-dooh/login/`. El navegador ve `localhost`,
> así que la cookie no estorba y todo va cifrado dentro del túnel.
>
> **NO pongas `COOKIE_SECURE=0`**: eso mandaría la sesión del super admin de toda
> la flota en claro, y el día que se olvide devolverlo nadie se entera.

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

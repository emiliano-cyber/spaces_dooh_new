# Runbook — cerrar la Fase 4: DEMO nace dentro del PADRE

> **Reescrito el 2026-08-24.** Sustituye por completo a la versión de la mañana,
> cuya premisa —el droplet viejo se convierte en DEMO— **dejó de ser posible**:
> se perdió el acceso a esa máquina.
>
> **Servidor:** el PADRE, `137.184.107.53` · **Lo corre una persona.**
> **Alcance:** F4.2–F4.4 completas, **F4.5 con 3 de 4 criterios** (el canal
> `beta` sigue siendo desviación declarada) y **F4.1 declarada IMPOSIBLE**.

---

## 0 · Lo que cambió, y el precio que lleva dentro

| | |
|---|---|
| **F4.1** · censo del viejo | 🛑 **IMPOSIBLE.** Sin acceso no hay censo. Deja de bloquear a F4.2 **declarándolo**, no ignorándolo |
| **F4.2** · base de DEMO | `spaces_demo` **en el PADRE** |
| **F4.3** · dominio | `demo.<DOMINIO>` en el PADRE, vhost y certificado propios. **Ya no es mover el DNS del viejo** |
| **F4.4** · datos y bandera | Igual, y con `AUTOREGISTRO=0`: **al revés de lo que dice el plan** (`:1345`), a favor de P8 |
| **F4.5** · cierre del riesgo | Criterio 3 reinterpretado: se cumple **retirando `demo.space-os.io`** de la máquina perdida |

> [!warning] Lo que esta decisión cuesta, escrito una vez y para siempre
> Poner DEMO en el PADRE **no cierra el riesgo de la Fase 4: lo transforma.**
> Deja de ser «demo pública = producción» y pasa a ser **«demo pública = plano de
> control»** — la máquina que guarda el super admin de toda la flota y, desde la
> Fase 5, las llaves de cada droplet.
>
> Se aceptó a sabiendas el 24/08. Este runbook aprieta el aislamiento hasta donde
> llega una sola máquina —**base propia, dominio propio, proceso propio, usuario
> propio**— y con eso el criterio literal de F4.2 sigue siendo verificable. Lo
> que **no** se puede es separarlos de verdad: quien comprometa el proceso de
> DEMO está dentro del PADRE.

---

## 1 · GATE — dos cosas antes de tocar nada

**① El dominio.** Todo el §3 necesita el nombre. Sin él, F4.3 no es trabajo: es
espera. Donde ponga `<DOMINIO>`, va el que se elija.

**② Y una que hay que hacer AHORA o se pierde para siempre:**

> [!danger] 🔴 El `curl` de F0.1 va ANTES de tocar el DNS
> F0.1 se contesta pidiéndole `https://demo.space-os.io/spaces-dooh/api/signup/`
> a la máquina vieja. **En cuanto ese nombre deje de apuntarle, la pregunta ya no
> se puede responder nunca**, porque tampoco hay acceso por SSH para mirarlo por
> dentro.
>
> Es la última ventana. Y F0.1 es, según el plan (`:260`), la tarea que bloquea
> toda la Fase 4.
>
> ```bash
> # Git Bash / Linux / Mac
> curl -s -w '\nHTTP %{http_code}\n' -X POST https://demo.space-os.io/spaces-dooh/api/signup/ -H 'Content-Type: application/json' -d '{}'
> ```
> ```powershell
> # PowerShell — `curl` ahi es un alias de Invoke-WebRequest y estas banderas revientan
> curl.exe -s -w "`nHTTP %{http_code}`n" -X POST https://demo.space-os.io/spaces-dooh/api/signup/ -H "Content-Type: application/json" -d "{}"
> ```
>
> **503** = cerrado. **400** = abierto, y ya no se puede cerrar: se anota como
> riesgo vivo de una máquina ajena. Cualquier otro código = no concluyente.
> Sea cual sea, **se escribe con fecha**: eso es el criterio de aceptación.

---

## 2 · La máquina perdida — lo único que se puede hacer con ella

Se controla la zona DNS de `space-os.io`. Es la única palanca que queda.

### 2.1 · Comprobar si sigue publicando a pantallas reales

**Esto no se mira en el servidor** —no hay acceso— **se mira en DOOHmain.**
Según el tablero del 10/08 ese droplet llevaba `DOOHMAIN_PUBLISH_ENABLED=1`, o
sea que la publicación era **real**. Si sigue activo, hay un sistema mandando
contenido a pantallas que nadie puede detener.

En el panel de DOOHmain, comprobar si hay campañas o reservas publicadas por esa
integración con actividad posterior al 21/08. Si las hay, **retirarlas desde
DOOHmain**, que es el lado que sí se controla.

### 2.2 · Retirarle el nombre público

Solo cuando el `curl` de F0.1 esté hecho y anotado:

```bash
dig +short demo.space-os.io          # antes: 209.97.146.136
```

En Cloudflare, el registro `A` de `demo.space-os.io` **se borra**, o se reapunta.
No se apaga la máquina —seguirá encendida y accesible por su IP— pero sale de
circulación bajo el nombre público.

> Esto es además lo que hace **verificable** el criterio 3 de F4.5.

---

## 3 · DEMO dentro del PADRE

### 3.1 · Un aviso que sale del censo de hoy, y no es menor

El censo del PADRE devolvió su proceso corriendo así:

```
| 0 | spaces-web | ... | online | ... | root | disabled |
```

**La aplicación del PADRE corre como `root`.** En el droplet viejo corría como
`emiliano`. Con una demostración pública a punto de vivir en esa misma máquina,
eso deja de ser un detalle: cualquier ejecución de código en el proceso web es
ejecución como root en el plano de control.

**El proceso de DEMO no se arranca como root**, y lo del PADRE merece
corregirse aparte. Aquí se crea un usuario propio:

```bash
adduser --system --group --home /home/demo demo
```

### 3.2 · F4.2 · La base de DEMO

**Criterio de aceptación, literal del plan:** la base de DEMO **no contiene ni
una fila de ningún owner**, y el rol de la app **no** puede saltarse la RLS.

```bash
# La base nace vacia
sudo -u postgres psql -c "create database spaces_demo owner postgres"

# El esquema (ya NO siembra el tenant 'rgb': D1 se cerro en 9d609f0)
sudo -u postgres psql -d spaces_demo -f /var/www/Spaces/db/schema.sql

# Comprobacion INTERMEDIA: tiene que dar 0 antes de migrar
sudo -u postgres psql -d spaces_demo -Atc "select count(*) from tenants"
```

El código y las migraciones ya están en el PADRE, en `/var/www/Spaces`. Solo hay
que traer el commit de hoy, que añade la migración **72**:

```bash
cd /var/www/Spaces && git pull && ls db/migrations/*.sql | wc -l   # esperado: 72
```

Y las migraciones, **corriendo como `postgres`** — el defecto ② del 21/08:

```bash
cp "$(command -v node)" /usr/local/bin/node 2>/dev/null; chmod a+rx /usr/local/bin/node
chmod -R a+rX /var/www/Spaces
sudo -u postgres env \
  DATABASE_URL="postgresql:///spaces_demo?host=/var/run/postgresql" \
  /usr/local/bin/node /var/www/Spaces/scripts/migrar.mjs --instalacion-nueva
```

**Esperado:** 72 aplicadas, salida 0. Segunda corrida: 0 aplicadas.

**Verificación de F4.2:**

```bash
sudo -u postgres psql -d spaces_demo -Atc "select rolname, rolsuper, rolbypassrls from pg_roles where rolcanlogin"
sudo -u postgres psql -d spaces_demo -Atc "select count(*) from tenants"
```

Esperado: `spaces_app|f|f` y **`0`** organizaciones.

### 3.3 · F4.3 · Dominio y certificado

1. **DNS**: registro `A` de `demo.<DOMINIO>` → `137.184.107.53`. (Y el de
   `<DOMINIO>` a secas, para el PADRE.)
2. **Certificado primero, `server_name` después.** Al revés el navegador enseña
   un error de certificado, no un 301 — el error que el plan del 11 ya señalaba
   (T9):

```bash
certbot certonly --webroot -w /var/www/html -d <DOMINIO> -d demo.<DOMINIO>
```

3. **nginx con dos bloques `server`**, cada uno a su puerto:

| Nombre | Proxy a | Qué es |
|---|---|---|
| `<DOMINIO>` | `127.0.0.1:3000` | El PADRE |
| `demo.<DOMINIO>` | `127.0.0.1:3001` | DEMO |

> **Como archivo versionado, no pegado a mano.** Es el defecto ⑧ del 21/08:
> `nginx -t` dijo «ok» sobre una configuración corrupta. Se parte de
> `infra/nginx/demo.space-os.io.conf`, que ya trae HSTS, gzip,
> `client_max_body_size 12M`, la redirección de `/` al login y el
> `X-Forwarded-For $remote_addr` **que sostiene el limitador de intentos — esa
> línea no se toca**.

### 3.4 · F4.4 · El proceso de DEMO, sus datos y la bandera

`.env` propio, en `/etc/space-os/demo.env`, **a 600 y del usuario `demo`** — el
defecto ⑦ del 21/08 fue exactamente esto:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | apunta a **`spaces_demo`** |
| `APP_URL` | `https://demo.<DOMINIO>` |
| `PORT` | `3001` |
| `COOKIE_SECURE` | `1` |
| `AUTOREGISTRO` | **`0`** ⚠️ contra el plan, a favor de P8 |
| `DOOHMAIN_PUBLISH_ENABLED` | **`0`** ⚠️ ver abajo |

> [!danger] DEMO no publica a pantallas reales. Nunca.
> Es una demostración: si sale con la publicación encendida, lo que alguien
> enseñe a un cliente **llega a pantallas de verdad**. Es el mismo error que ya
> costó una incidencia con `eyro`, y aquí sería peor porque la demo la toca gente
> de fuera.

```bash
chmod 600 /etc/space-os/demo.env && chown demo:demo /etc/space-os/demo.env
```

**La organización de demostración no se llama `rgb`** — el criterio de F4.5
compara los slugs de las dos bases y no puede haber ninguno en común. Va con
slug `demo`.

> [!warning] No uses `bootstrap-auth.mjs` a ciegas
> Lleva **su propia `MATRIZ` de 36 permisos** que no coincide con las **41** que
> siembra la migración, así que corriendo **después** la base acaba con la
> **unión**. Y resuelve por slug `rgb`, abortando si falta. Para DEMO se usa el
> SQL documentado en `docs/datos/`, que es la alternativa que el plan admite en
> F4.4 paso 1. **Pídemelo y lo escribo con el slug `demo`.**

**Verificación de F4.4:**

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST https://demo.<DOMINIO>/spaces-dooh/api/signup/ -H 'Content-Type: application/json' -d '{}'
```

**Esperado: `503`** — no el `400` del plan (`:1351`).

> Y la comprobación que **ninguna prueba automática puede hacer**: abre
> `https://demo.<DOMINIO>/spaces-dooh/login/` en el navegador y confirma que el
> botón **«Crear cuenta» NO aparece**. Es el único eslabón que el ensayo de F2.5
> no pudo cerrar —hidratación en un navegador real— y si no se mira aquí, nadie
> lo mira.

---

## 4 · F4.5 · Smoke y cierre del riesgo

| # | Afirmación (plan) | En su forma nueva | Estado |
|---|---|---|---|
| 1 | DEMO resuelve a su droplet | `demo.<DOMINIO>` resuelve al PADRE | ✅ |
| 2 | La base de DEMO no tiene tenants de producción | `spaces_demo` ∩ `spaces_prod` = ∅ | ✅ |
| 3 | El viejo ya no sirve ese nombre | `demo.space-os.io` **deja de resolver** a `209.97.146.136` | ✅ vía DNS |
| 4 | DEMO suscrita al canal `beta` | — | 🔶 **desviación declarada** |

```bash
dig +short demo.<DOMINIO>            # el PADRE
dig +short demo.space-os.io          # vacio, o cualquier cosa menos 209.97.146.136
sudo -u postgres psql -d spaces_demo -Atc "select string_agg(slug,',') from tenants"
sudo -u postgres psql -d spaces_prod -Atc "select string_agg(slug,',') from tenants"
```

Las dos listas **no** pueden compartir ningún slug.

> **El criterio 4 y lo que arrastra:** el canal `beta` necesita **TH-P4** (crear
> el registry en DOCR y fijar sus variables) y una imagen publicada. Mientras no
> esté, **F3.5 y F3.6 siguen bloqueadas**. Y ahora también hay que decir que
> **F3.5 pierde parte de su sentido**: ensayar `update.sh` contra una DEMO que
> vive en el PADRE ya no prueba lo mismo que contra una instancia aparte.

---

## 5 · Al terminar — lo que se commitea

1. `docs/evidencias/fase-4.md` con las salidas reales.
2. La respuesta de **F0.1**, con fecha, y lo que devolvió DOOHmain sobre la
   máquina perdida.
3. Las filas de F0.1 y F4.1–F4.5 en `vault/07-Agentes/ejecucion-plan-v3.md`.
4. **ADR: «el PADRE hace también de DEMO»**, con el riesgo aceptado por escrito.
   Esta decisión no puede vivir solo en un diario.
5. Entrada en `docs/Registro_Cambios.md`: **ahora sí se nota desde la
   aplicación** — hay una demostración pública con datos de juguete y un dominio
   nuevo.

---

## 6 · Vuelta atrás

Nada de este runbook borra nada. DEMO es aditiva: base nueva, proceso nuevo,
vhost nuevo.

```bash
pm2 delete spaces-demo && pm2 save
rm /etc/nginx/sites-enabled/demo && nginx -t && systemctl reload nginx
sudo -u postgres psql -c "drop database spaces_demo"    # opcional
```

Lo único que **no** tiene vuelta atrás es el registro `A` borrado de
`demo.space-os.io` — y volver a ponerlo es una línea en Cloudflare.

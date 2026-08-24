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
| **F4.3** · dominio | `space-os.io` → el PADRE y `demo.space-os.io` → DEMO, **en la misma máquina**, con vhost propio cada uno. El nombre de DEMO **no se crea: se recupera** de la máquina perdida |
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

**① El dominio, resuelto el 24/08: `space-os.io`.** Y **no es un dominio nuevo**:
es la **misma zona que ya se controla**, la que tiene dentro `demo.space-os.io`
apuntando a la máquina perdida. Eso simplifica la fase entera:

| | |
|---|---|
| `space-os.io` | El **PADRE** |
| `demo.space-os.io` | **DEMO** — no se borra, **se recupera** |

> **Reapuntar `demo.space-os.io` al PADRE hace las dos cosas de una vez:** le
> retira el nombre público a la máquina perdida (criterio 3 de F4.5) y le da a
> DEMO su dominio de siempre. **No hay nombre nuevo que comunicar a nadie.**

**Lo primero, y antes de planear el corte — ¿a dónde apunta hoy el ápice?**

```bash
dig +short space-os.io
dig +short demo.space-os.io
curl -sI https://demo.space-os.io | grep -iE '^server:|^cf-ray:'
```

Si el ápice también devuelve **209.97.146.136**, la máquina perdida está
sirviendo **dos** nombres y no uno. Con `cf-ray` en la respuesta, el proxy naranja
de Cloudflare está encendido — el 28/07 estaba **gris**.

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

**No se borra el registro: se reapunta al PADRE.** Es el mismo gesto que le da a
DEMO su dominio, y va en el §3.3 junto con el certificado, porque el orden entre
los dos **importa** y hacerlos por separado abre una ventana de error de
certificado.

Lo único que hay que dejar hecho aquí, y **antes** de mover nada:

- [ ] El `curl` de F0.1, corrido y **anotado con fecha** (§1).
- [ ] La comprobación de DOOHmain del §2.1.
- [ ] `dig +short demo.space-os.io` guardado — la evidencia de a dónde apuntaba
      antes, que es lo que hace comprobable el criterio 3 de F4.5.

> La máquina **no se apaga**: no se puede. Seguirá encendida y accesible por su
> IP. Lo que se le quita es el nombre.

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

> [!danger] 🔴 El nudo: el certificado y el DNS se necesitan mutuamente
> `certbot --webroot` valida por **HTTP-01**, o sea que Let's Encrypt pide el
> desafío **al servidor al que apunta el nombre**. Y aquí el nombre apunta
> todavía a la máquina perdida.
>
> - Si se **emite primero**, no se puede: el desafío va a la máquina vieja.
> - Si se **mueve el DNS primero**, `demo.space-os.io` resuelve al PADRE sin
>   certificado, y todo el que entre ve un **error de certificado** — no un 301.
>   Es exactamente el error que el plan del 11 señalaba en T9.
>
> **La salida es no usar HTTP-01: se valida por DNS-01**, que es posible porque
> la zona está en Cloudflare y se controla. Se emite el certificado **antes** de
> mover ningún registro, y el corte queda sin ventana.

#### Paso 1 · Emitir por DNS-01, con el DNS todavía como está

#### El token de Cloudflare — qué marcar

**Cloudflare → My Profile → API Tokens → Create Token**, plantilla
**«Edit zone DNS»**, y luego:

| Campo | Valor | Por qué |
|---|---|---|
| Permissions | `Zone` · `DNS` · **Edit** | Crear y borrar el TXT `_acme-challenge` |
| | `Zone` · `Zone` · **Read** | El plugin resuelve el ID de la zona por su nombre |
| Zone Resources | Include → **Specific zone** → `space-os.io` | **Nunca «All zones»**: este token reescribe DNS |
| Client IP Filtering | `137.184.107.53` | Recomendado. Copiarlo no basta para usarlo fuera del PADRE |

No puede leer tráfico, ni tocar el proxy, ni entrar a otra zona.

> [!danger] Este token se vuelve dependencia de renovación PARA SIEMPRE
> Al emitir con DNS-01, certbot guarda esta configuración en el archivo de
> renovación y la usará cada ~60 días. Si alguien lo **revoca o lo deja
> caducar**, la renovación **falla en silencio** y el certificado muere 90 días
> después. Nadie se entera hasta que el sitio deja de cargar — y con el HSTS de
> dos años que sirven estos vhosts, «no carga» significa **no se puede saltar**.
>
> Por eso el TTL es una decisión y no un campo del formulario: con caducidad,
> hace falta un recordatorio ANTES de esa fecha; sin ella, lo que compensa es el
> filtro por IP.

#### Emitir

```bash
apt-get install -y python3-certbot-dns-cloudflare

# El archivo se crea YA CERRADO, y despues se escribe dentro. Es el defecto (7)
# del 21/08: `.env.production` nacio 644 con la clave de la base dentro.
install -m 600 /dev/null /root/.cloudflare.ini
nano /root/.cloudflare.ini          # dns_cloudflare_api_token = <token>

# 1. EN PRUEBAS PRIMERO. Let's Encrypt limita a 5 certificados duplicados por
#    semana: equivocarse en el token quema intentos de verdad. Esto valida
#    contra el servidor de pruebas y NO gasta cuota.
certbot certonly --dns-cloudflare   --dns-cloudflare-credentials /root/.cloudflare.ini   --dry-run -d space-os.io -d demo.space-os.io

# 2. Solo cuando el de arriba salga verde, se emite de verdad
certbot certonly --dns-cloudflare   --dns-cloudflare-credentials /root/.cloudflare.ini   -d space-os.io -d demo.space-os.io
```

**Y la comprobación que hay que dejar en el calendario, cada dos meses:**

```bash
certbot renew --dry-run
```

Es lo único que distingue «renueva bien» de «lleva meses fallando callado».

> **El `install -m 600` va antes de escribir el token, no después.** Es el
> defecto ⑦ del 21/08: `.env.production` nació `644` con la clave de la base
> dentro. Un archivo con un token de DNS se crea ya cerrado.

Comprobación antes de seguir — el certificado tiene que existir **ya**:

```bash
certbot certificates | grep -E 'Certificate Name|Domains|Expiry'
```

#### Paso 2 · nginx, desde archivo versionado

Dos bloques `server`, cada uno a su puerto:

| Nombre | Proxy a | Qué es |
|---|---|---|
| `space-os.io` | `127.0.0.1:3000` | El PADRE |
| `demo.space-os.io` | `127.0.0.1:3001` | DEMO |

**Ya está escrita: `infra/nginx/space-os.io.conf`** (24/08). Un solo archivo con
los dos vhosts, los dos upstreams y el hueco de ACME. Los encabezados del proxy
viven en `infra/nginx/snippets/proxy-app.conf`, **en una sola copia**, para que
los dos sitios no puedan divergir.

```bash
ln -sf /var/www/Spaces/infra/nginx/space-os.io.conf /etc/nginx/sites-enabled/spaces
rm -f /etc/nginx/sites-enabled/padre-ip /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

> **Se enlaza, no se pega.** Defecto ⑧ del 21/08: `nginx -t` dijo «ok» sobre una
> configuración corrupta y la única señal fue el **comportamiento**. Por eso la
> comprobación de abajo mide **códigos de respuesta**, no que el servicio
> arranque.

```bash
nginx -t && systemctl reload nginx
```

#### Paso 3 · El ÁPICE primero — y esto es deliberado

> [!tip] Medido el 2026-08-24: `space-os.io` **no tiene registro A**
> El ápice está **libre**, y la máquina perdida sirve **un solo nombre**
> (`demo.space-os.io`), no dos. Eso permite una secuencia mucho más segura que
> mover los dos a la vez.
>
> **El ápice no lo usa nadie y no tiene HSTS.** Ahí se puede montar y probar el
> stack completo —certificado, nginx, la app— sin público delante, y un error se
> deshace borrando un registro. `demo.space-os.io` es lo contrario: tiene HSTS de
> dos años y gente que entra, así que un fallo ahí **no es saltable** desde el
> navegador.
>
> Por eso el orden es: **estrenar en el ápice, y solo cuando funcione de verdad,
> tocar el nombre que importa.**

**3a · Añadir el A del ápice** (aditivo: no se le quita nada a nadie)

```
space-os.io      A      137.184.107.53
```

**3b · Comprobar el stack ENTERO ahí, antes de seguir:**

```bash
dig +short space-os.io                                                       # 137.184.107.53
curl -s -o /dev/null -w '%{http_code}
' https://space-os.io/                # 302
curl -s -o /dev/null -w '%{http_code}
' https://space-os.io/spaces-dooh/login/   # 200
echo | openssl s_client -connect space-os.io:443 -servername space-os.io 2>/dev/null | openssl x509 -noout -dates
```

**Si algo de esto no sale, se para aquí.** No se toca `demo` hasta que el ápice
esté sirviendo bien: es literalmente para lo que existe este paso.

> ⚠️ Y **no** entres a `https://demo.space-os.io` desde el navegador mientras
> tanto para «ir viendo»: sigue apuntando a la máquina perdida y lo único que
> conseguirás es renovarte el HSTS otros dos años.

#### Paso 4 · Ahora sí, recuperar `demo.space-os.io`

Con el ápice demostrando que el certificado, nginx y la app funcionan, mover el
segundo nombre es cambiar un número:

1. Bajar el TTL del registro de `demo.space-os.io` y esperar a que caduque el
   anterior.
2. `demo.space-os.io` → `137.184.107.53`. ← **aquí la máquina perdida pierde su
   nombre público.**
3. Restaurar el TTL.

> Si el proxy de Cloudflare se pusiera en **naranja**, hace falta
> `infra/nginx/cloudflare-realip.sh`. Sin él «TODO el tráfico parece venir de una
> sola IP y el limitador de intentos de login bloquearía a todos a la vez»
> (`demo.space-os.io.conf:9-12`). Medido el 24/08: está en **gris**.

**Verificación de F4.3:**

```bash
dig +short space-os.io demo.space-os.io       # los dos: 137.184.107.53
curl -s -o /dev/null -w '%{http_code}
' https://demo.space-os.io/spaces-dooh/login/
echo | openssl s_client -connect demo.space-os.io:443 -servername demo.space-os.io 2>/dev/null | openssl x509 -noout -dates
```

Esperado: `137.184.107.53` en los dos · `200` · certificado sin vencer.

### 3.4 · F4.4 · El proceso de DEMO, sus datos y la bandera

**El proceso ya está definido: `ecosystem.demo.config.js`** (24/08), en el 3001.
Va con **su propio pm2**, el del usuario `demo`, porque pm2 no sabe cambiar de
usuario por aplicación — lo fija el proceso que la arranca:

```bash
sudo -u demo bash -lc '
  set -a; . /etc/space-os/demo.env; set +a
  cd /var/www/Spaces
  pm2 start ecosystem.demo.config.js
  pm2 save
'
```

> **Next carga `.env.production` sin pisar lo que ya esté en el entorno**, así
> que lo de `/etc/space-os/demo.env` gana. Si eso fallara, DEMO hablaría con la
> base del PADRE **sin dar error**, solo enseñando los datos equivocados. Se
> comprueba mirando qué contesta, no suponiéndolo.

`.env` propio, en `/etc/space-os/demo.env`, **a 600 y del usuario `demo`** — el
defecto ⑦ del 21/08 fue exactamente esto:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | apunta a **`spaces_demo`** |
| `APP_URL` | `https://demo.space-os.io` |
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

> [!note] Corregido el 24/08 — `bootstrap-auth.mjs` **sí** es la vía, y la única
> Una versión anterior de este runbook decía que lo evitaras porque llevaba su
> propia `MATRIZ` de 36 permisos y dejaría la base con la unión. **Eso dejó de
> ser cierto el 2026-08-20**: `de6860a` le quitó la matriz y lo dejó
> **fail-closed**, comprobando que el catálogo esté y negándose si no. Lo que
> queda en el archivo es el comentario que cuenta la historia, y de ahí salió el
> aviso equivocado.
>
> Hoy el alta es lo único que hace tres cosas que un `.sql` no puede: **valida el
> correo** (`lib/validacion-email.mjs`, de hoy mismo), **genera** la contraseña y
> la enseña **una sola vez**, y obliga al Dueño a cambiarla. Escribir el alta a
> mano abriría un segundo camino para crear identidades — exactamente lo que
> costó ROJO-2.

```bash
cd /var/www/Spaces/apps/web
ORG_SLUG=demo ORG_NOMBRE="SPACE OS - Demostracion" ADMIN_EMAIL=<el correo real del Dueno de la demo> ADMIN_NOMBRE="<su nombre>" DATABASE_URL="postgresql:///spaces_demo?host=/var/run/postgresql"   node scripts/bootstrap-auth.mjs
```

> **Apunta la contraseña que imprime: no se vuelve a enseñar.** Y no dejes los
> marcadores puestos — desde hoy el script se niega si `ADMIN_EMAIL` no parece un
> correo, que es el defecto ⑥ del 21/08.

**Y después, el inventario de juguete:**

```bash
sudo -u postgres psql -d spaces_demo -v ON_ERROR_STOP=1   -f /var/www/Spaces/docs/datos/20260824_semilla_demo.sql
```

Siembra **2 arrendadores y 6 pantallas** inventadas. Es idempotente y trae tres
guardas: se niega si la base no se llama `spaces_demo`, si no existe la
organización `demo`, o si en esa base hay un tenant `rgb` — porque entonces el
criterio de F4.5 no se podría cumplir. **Probado de punta a punta contra Postgres
16 el 24/08**, incluidas las tres guardas y la vuelta atrás.

Esperado al final: `demo · 2 arrendadores · 6 pantallas · 5 disponibles`.

**Verificación de F4.4:**

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST https://demo.space-os.io/spaces-dooh/api/signup/ -H 'Content-Type: application/json' -d '{}'
```

**Esperado: `503`** — no el `400` del plan (`:1351`).

> Y la comprobación que **ninguna prueba automática puede hacer**: abre
> `https://demo.space-os.io/spaces-dooh/login/` en el navegador y confirma que el
> botón **«Crear cuenta» NO aparece**. Es el único eslabón que el ensayo de F2.5
> no pudo cerrar —hidratación en un navegador real— y si no se mira aquí, nadie
> lo mira.

---

## 4 · F4.5 · Smoke y cierre del riesgo

| # | Afirmación (plan) | En su forma nueva | Estado |
|---|---|---|---|
| 1 | DEMO resuelve a su droplet | `demo.space-os.io` resuelve al PADRE | ✅ |
| 2 | La base de DEMO no tiene tenants de producción | `spaces_demo` ∩ `spaces_prod` = ∅ | ✅ |
| 3 | El viejo ya no sirve ese nombre | `demo.space-os.io` **deja de resolver** a `209.97.146.136` | ✅ vía DNS |
| 4 | DEMO suscrita al canal `beta` | — | 🔶 **desviación declarada** |

```bash
dig +short space-os.io                 # 137.184.107.53  (el PADRE)
dig +short demo.space-os.io            # 137.184.107.53  -- y ya NO 209.97.146.136
sudo -u postgres psql -d spaces_demo -Atc "select string_agg(slug,',') from tenants"
sudo -u postgres psql -d spaces_prod -Atc "select string_agg(slug,',') from tenants"
```

> **El criterio 3 se cumple por sustitucion, no por borrado**, y eso lo vuelve
> mas facil de comprobar: el nombre sigue existiendo y sirviendo, pero desde otra
> maquina. La evidencia es el `dig` de antes (guardado en el §2.2) contra el de
> ahora.

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

El DNS tampoco se pierde: `demo.space-os.io` **se reapunta**, no se borra, así
que deshacerlo es devolver el registro `A` a `209.97.146.136` — una línea en
Cloudflare. Con una salvedad: **el certificado de esa máquina no se renovará
solo** si el nombre deja de apuntarle mucho tiempo, así que la vuelta atrás deja
de ser gratis pasados un par de meses.

Y el certificado del PADRE no estorba: cubre los dos nombres y se renueva por
DNS-01, que no depende de a dónde apunten.

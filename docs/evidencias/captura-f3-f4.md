# Hoja de captura — Fases 3 y 4 · lo que corre una persona

> **Para qué es esto.** Cada bloque trae **un comando en UNA sola línea**, qué
> demuestra, qué se espera, y un hueco vacío debajo. Corre, copia la salida
> **tal cual** —incluidos los errores— y pégala en su hueco. Con eso se levanta
> el expediente `docs/evidencias/fase-3-y-4.md` sin que nadie tenga que recordar
> qué había que capturar.
>
> **Servidor:** el PADRE, `137.184.107.53` · **Fecha de la corrida:** `________`

> [!danger] Tres reglas que ya costaron caro
> **① Una sola línea.** La consola web de DigitalOcean **corrompe las pegadas
> multilínea** — pasó dos veces (el 21/08 y el 24/08). Ningún comando de esta hoja
> ocupa dos renglones, y es a propósito.
>
> **② No abras `https://demo.space-os.io` en el navegador «para ir viendo»**
> hasta el bloque 4. Sigue apuntando a la máquina perdida, y lo único que
> consigues es renovarte el HSTS otros dos años.
>
> **③ Los 🚦 GATE son de verdad.** Si un gate no sale como dice, **para y
> pégame la salida**. Seguir adelante desde un gate rojo es exactamente lo que
> convierte un problema pequeño en uno que no se puede deshacer.

---

## Antes de empezar: qué se puede cerrar y qué no

| | |
|---|---|
| **Fase 4** | Se cierra con lo capturable aquí. `F4.1` es **imposible** (se perdió el acceso a esa máquina) y el criterio 4 de `F4.5` es **desviación declarada** |
| **Fase 3** | **NO se puede cerrar entera hoy.** `F3.5` exige publicar una versión en el canal `beta`, y ese canal no existe sin **TH-P4** (el registry). `F3.6` depende de `F3.5` |

**Pero la Fase 3 sí gana evidencia real en esta corrida**, y es la primera que
tiene: aprovisionar DEMO es **la primera vez que el runner de migraciones de la
Fase 3 corre en un servidor de verdad**. Hasta hoy solo se había probado en local.
Eso son los bloques 5 y 8.

---

# BLOQUE 0 · Antes de tocar nada

Los cuatro son de solo lectura. Ninguno cambia nada.

### C1 · ¿A qué máquina estoy entrando?

**Demuestra:** que se está censando el PADRE y no otra cosa. El 24/08 se censó
entera la máquina equivocada, y se detectó tarde.

```
ssh -o ConnectTimeout=8 root@137.184.107.53 "hostname; curl -s ifconfig.me; echo"
```

**Esperado:** la IP tiene que ser `137.184.107.53`.

**Pega aquí:**
```

```

### C2 · 🚦 GATE · La rama y el número de migraciones

**Demuestra:** que el código del PADRE trae la migración **72**. En `main` son
**66**, y DEMO nacería sin el arreglo de H1 —tablas creadas por otro rol sin
permisos **y sin error**— con el `git pull` saliendo en verde.

```
cd /var/www/Spaces && git rev-parse --abbrev-ref HEAD && git pull && ls db/migrations/*.sql | wc -l
```

**Esperado:** `feat/servidor-padre-instancias` y `72`.

**Si sale `main` o `66`: PARA.** La salida es:

```
cd /var/www/Spaces && git fetch --all && git checkout feat/servidor-padre-instancias && git pull && ls db/migrations/*.sql | wc -l
```

**Pega aquí:**
```

```

### C3 · El DNS ANTES de tocarlo

**Demuestra:** a dónde apuntaba cada nombre antes del cambio. **Es la evidencia
del criterio 3 de F4.5** —«el viejo ya no sirve ese nombre»—, y solo se puede
capturar ahora: después del bloque 4 ya no existe.

```
dig +short space-os.io; dig +short demo.space-os.io
```

**Esperado:** el ápice **vacío** (no tiene registro A) y `demo` → `209.97.146.136`.

**Pega aquí:**
```

```

### C4 · DOOHmain — ¿la máquina perdida sigue publicando a pantallas reales?

**Esto no es un comando y no se mira en el servidor: no hay servidor.** Se mira
en el panel de DOOHmain.

Según el tablero del 10/08 ese droplet llevaba `DOOHMAIN_PUBLISH_ENABLED=1`. Si
sigue activo, hay un sistema mandando contenido a pantallas de verdad que **nadie
puede detener desde aquí**. La única palanca es retirarlo **desde DOOHmain**.

**Qué mirar:** si hay campañas o reservas publicadas por esa integración con
actividad **posterior al 21/08**.

**Escribe aquí lo que veas** (aunque sea «no hay nada»):
```

```

---

# BLOQUE 1 · El certificado (F4.3, primera parte)

> **Por qué el certificado va ANTES de mover el DNS, y no es preferencia.**
> `demo.space-os.io` sirve **HSTS de dos años**. Si se mueve el DNS primero, todo
> el que entre ve un error de certificado que **no se puede saltar** desde el
> navegador. Por eso se valida por **DNS-01**, que no necesita que el nombre
> apunte aquí.

### C5 · El token de Cloudflare

**No tiene salida que pegar.** Se crea en **Cloudflare → My Profile → API Tokens
→ Create Token**, plantilla «Edit zone DNS»:

| Campo | Valor |
|---|---|
| Permissions | `Zone` · `DNS` · **Edit** |
| Permissions | `Zone` · `Zone` · **Read** ← el plugin resuelve el ID de la zona por su nombre |
| Zone Resources | Include → **Specific zone** → `space-os.io` — **nunca «All zones»** |
| Client IP Filtering | `137.184.107.53` |

> [!warning] Este token se vuelve dependencia de renovación PERMANENTE
> certbot lo guarda en el archivo de renovación y lo usa cada ~60 días. Si
> caduca o lo revocan, la renovación **falla en silencio** y el sitio muere 90
> días después. `certbot renew --dry-run` cada dos meses es lo único que lo
> delata.

**Y el archivo se crea CERRADO antes de escribir dentro** — el defecto ⑦ del
21/08 fue `.env.production` naciendo `644` con la clave de la base dentro:

```
apt-get install -y python3-certbot-dns-cloudflare && install -m 600 /dev/null /root/.cloudflare.ini
```

Después, `nano /root/.cloudflare.ini` y dentro **una sola línea**:
`dns_cloudflare_api_token = <el token>`

**Anota aquí** si le pusiste caducidad al token, y cuál:
```

```

### C6 · 🚦 GATE · El certificado, en pruebas

**Demuestra:** que el token funciona, **sin gastar cuota**. Let's Encrypt limita
a **5 certificados duplicados por semana**: equivocarse en el token quema
intentos de verdad.

```
certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.cloudflare.ini --dry-run -d space-os.io -d demo.space-os.io
```

**Esperado:** `The dry run was successful.`

**Si falla: PARA.** No corras el C7.

**Pega aquí:**
```

```

### C7 · El certificado, de verdad

```
certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.cloudflare.ini -d space-os.io -d demo.space-os.io
```

**Pega aquí:**
```

```

### C8 · 🚦 GATE · El certificado existe y cubre los dos nombres

**Demuestra:** F4.3 — certificado emitido, con los dos nombres dentro y vigente.

```
certbot certificates | grep -E 'Certificate Name|Domains|Expiry'
```

**Pega aquí:**
```

```

---

# BLOQUE 2 · nginx (F4.3, segunda parte)

> **Se enlaza el archivo del repositorio, no se pega.** El 21/08 `nginx -t` dijo
> «ok» sobre una configuración **corrupta**: la consola web había duplicado
> líneas y el resultado seguía siendo sintácticamente válido. La única señal fue
> el **comportamiento**, por eso el bloque 3 mide **códigos de respuesta** y no
> que el servicio arranque.

### C9 · Enlazar y retirar lo provisional

```
ln -sf /var/www/Spaces/infra/nginx/space-os.io.conf /etc/nginx/sites-enabled/spaces && rm -f /etc/nginx/sites-enabled/padre-ip /etc/nginx/sites-enabled/default && nginx -t
```

**Esperado:** `syntax is ok` y `test is successful`.

**Pega aquí:**
```

```

### C10 · Recargar

```
systemctl reload nginx && systemctl is-active nginx
```

**Pega aquí:**
```

```

---

# BLOQUE 3 · El ápice primero (F4.3, tercera parte)

> **Esto es deliberado.** `space-os.io` **no tiene registro A** (medido el
> 24/08): está libre, no lo usa nadie y **no tiene HSTS**. Ahí se estrena el
> stack entero —certificado, nginx, la app— sin público delante, y un error se
> deshace **borrando un registro**. `demo.space-os.io` es lo contrario: tiene
> HSTS de dos años y gente que entra.

### C11 · Añadir el A del ápice, y comprobar que resuelve

En Cloudflare, **añadir** (es aditivo: no se le quita nada a nadie):

```
space-os.io      A      137.184.107.53
```

Y después:

```
dig +short space-os.io
```

**Esperado:** `137.184.107.53`.

**Pega aquí:**
```

```

### C12 · 🚦 GATE · El stack entero, probado en el ápice

**Demuestra:** que el certificado, nginx y la app funcionan **juntos**, en el
nombre donde equivocarse es gratis.

```
curl -s -o /dev/null -w 'raiz %{http_code}\n' https://space-os.io/ ; curl -s -o /dev/null -w 'login %{http_code}\n' https://space-os.io/spaces-dooh/login/
```

**Esperado:** `raiz 302` y `login 200`.

**Si no sale exactamente eso: PARA.** No se toca `demo` hasta que el ápice sirva
bien — es literalmente para lo que existe este paso.

**Pega aquí:**
```

```

### C13 · Las fechas del certificado que se está sirviendo

```
echo | openssl s_client -connect space-os.io:443 -servername space-os.io 2>/dev/null | openssl x509 -noout -dates
```

**Pega aquí:**
```

```

---

# BLOQUE 4 · Recuperar `demo.space-os.io` (F4.3 final + criterio 3 de F4.5)

**Aquí la máquina perdida pierde su nombre público.** No se borra el registro:
**se reapunta**. Es el mismo gesto que le da a DEMO su dominio de siempre.

1. Bajar el TTL del registro de `demo.space-os.io` y esperar a que caduque el anterior.
2. `demo.space-os.io` → `137.184.107.53`.
3. Restaurar el TTL.

### C14 · El DNS después

```
dig +short space-os.io; dig +short demo.space-os.io
```

**Esperado:** `137.184.107.53` en los dos. Contra el **C3**, esa pareja es la
prueba del criterio 3 de F4.5.

**Pega aquí:**
```

```

---

# BLOQUE 5 · La base de DEMO (F4.2) — y la primera prueba real de la Fase 3

> **Criterio de F4.2, literal del plan:** la base de DEMO **no contiene ni una
> fila de ningún owner**, y el rol de la app **no** puede saltarse la RLS.

### C15 · La base nace vacía

```
sudo -u postgres psql -c "create database spaces_demo owner postgres" && sudo -u postgres psql -d spaces_demo -f /var/www/Spaces/db/schema.sql > /dev/null && sudo -u postgres psql -d spaces_demo -Atc "select count(*) from tenants"
```

**Esperado:** `0`. Tiene que dar cero **antes** de migrar.

**Pega aquí:**
```

```

### C16 · Las migraciones, corriendo como `postgres`

Es el defecto ② del 21/08: el runner necesita ver `node` y el árbol.

```
cp "$(command -v node)" /usr/local/bin/node 2>/dev/null; chmod a+rx /usr/local/bin/node; chmod -R a+rX /var/www/Spaces; sudo -u postgres env DATABASE_URL="postgresql:///spaces_demo?host=/var/run/postgresql" /usr/local/bin/node /var/www/Spaces/scripts/migrar.mjs --instalacion-nueva
```

**Esperado:** **72 aplicadas**, salida 0.

**Pega aquí:**
```

```

### C17 · La idempotencia, en un servidor de verdad

**Demuestra:** F3.1 y F3.2 — el runner lleva registro de lo aplicado y no repite.
**Esta es evidencia de la Fase 3, no de la 4.** Hasta hoy solo existía en local.

```
sudo -u postgres env DATABASE_URL="postgresql:///spaces_demo?host=/var/run/postgresql" /usr/local/bin/node /var/www/Spaces/scripts/migrar.mjs
```

**Esperado:** **0 aplicadas**, salida 0.

**Pega aquí:**
```

```

### C18 · Verificación de F4.2

```
sudo -u postgres psql -d spaces_demo -Atc "select rolname, rolsuper, rolbypassrls from pg_roles where rolcanlogin"; sudo -u postgres psql -d spaces_demo -Atc "select count(*) from tenants"
```

**Esperado:** `spaces_app|f|f` y **`0`** organizaciones.

**Pega aquí:**
```

```

---

# BLOQUE 6 · El proceso, los datos y la bandera (F4.4)

### C19 · Usuario propio y `.env` cerrado

El proceso de DEMO **no se arranca como root**. El del PADRE hoy sí corre como
root, y eso es una tarea aparte que este bloque **no** cierra.

```
adduser --system --group --home /home/demo demo; mkdir -p /etc/space-os; install -m 600 -o demo -g demo /dev/null /etc/space-os/demo.env; ls -l /etc/space-os/demo.env
```

Dentro de `/etc/space-os/demo.env`:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | apunta a **`spaces_demo`** |
| `APP_URL` | `https://demo.space-os.io` |
| `PORT` | `3001` |
| `COOKIE_SECURE` | `1` |
| `AUTOREGISTRO` | **`0`** |
| `DOOHMAIN_PUBLISH_ENABLED` | **`0`** |

> [!danger] DEMO no publica a pantallas reales. Nunca.
> Si sale con la publicación encendida, lo que alguien enseñe a un cliente
> **llega a pantallas de verdad**. Ya costó una incidencia con `eyro`.

> **Next carga `.env.production` sin pisar lo que ya esté en el entorno**, así que
> lo de `/etc/space-os/demo.env` gana. Si eso fallara, DEMO hablaría con la base
> del PADRE **sin dar error**, solo enseñando los datos equivocados. Por eso se
> comprueba mirando qué contesta (C22), no suponiéndolo.

**Pega aquí** la salida del `ls -l`, para dejar constancia del `600`:
```

```

### C20 · Arrancar DEMO en el 3001

```
sudo -u demo bash -lc 'set -a; . /etc/space-os/demo.env; set +a; cd /var/www/Spaces; pm2 start ecosystem.demo.config.js; pm2 save; pm2 list'
```

**Esperado:** `spaces-demo` en `online`, y con usuario **`demo`**, no `root`.

**Pega aquí:**
```

```

### C21 · El alta del Dueño de la demostración

`bootstrap-auth.mjs` **es la vía, y la única**. Hace tres cosas que un `.sql` no
puede: valida el correo, **genera** la contraseña y la enseña **una sola vez**, y
obliga a cambiarla. El slug **no puede ser `rgb`** — el criterio de F4.5 compara
los slugs de las dos bases y no puede haber ninguno en común.

```
cd /var/www/Spaces/apps/web && ORG_SLUG=demo ORG_NOMBRE="SPACE OS - Demostracion" ADMIN_EMAIL=<el correo real> ADMIN_NOMBRE="<su nombre>" DATABASE_URL="postgresql:///spaces_demo?host=/var/run/postgresql" node scripts/bootstrap-auth.mjs
```

> **Apunta la contraseña que imprime: no se vuelve a enseñar.** Y no dejes los
> marcadores puestos — el script se niega si `ADMIN_EMAIL` no parece un correo.

**Pega aquí la salida, TACHANDO la contraseña:**
```

```

### C22 · El inventario de juguete

Siembra 2 arrendadores y 6 pantallas inventadas. Es idempotente y trae tres
guardas: se niega si la base no se llama `spaces_demo`, si no existe la
organización `demo`, o si hay un tenant `rgb` en esa base.

```
sudo -u postgres psql -d spaces_demo -v ON_ERROR_STOP=1 -f /var/www/Spaces/docs/datos/20260824_semilla_demo.sql
```

**Esperado al final:** `demo · 2 arrendadores · 6 pantallas · 5 disponibles`.

**Pega aquí:**
```

```

### C23 · Verificación de F4.4 — el registro está cerrado

```
curl -s -w '\nHTTP %{http_code}\n' -X POST https://demo.space-os.io/spaces-dooh/api/signup/ -H 'Content-Type: application/json' -d '{}'
```

**Esperado: `503`** — **no** el `400` que dice el plan (`:1351`). Es desviación
deliberada, a favor de P8: el autoregistro no se abre en ningún sitio, ni en DEMO.

**Pega aquí:**
```

```

### C24 · Lo que ninguna prueba automática puede hacer

Abre `https://demo.space-os.io/spaces-dooh/login/` **en un navegador** y confirma
que el botón **«Crear cuenta» NO aparece**.

Es el único eslabón que el ensayo de F2.5 no pudo cerrar —hidratación en un
navegador real— y si no se mira aquí, no lo mira nadie.

**Escribe aquí qué viste** (y adjunta captura si puedes):
```

```

---

# BLOQUE 7 · Cierre del riesgo (F4.5)

### C25 · Los dos nombres

```
dig +short space-os.io; dig +short demo.space-os.io
```

**Pega aquí:**
```

```

### C26 · Las dos bases no comparten ni un slug

**Es el criterio 2 de F4.5**, y el que sostiene que «demo pública = producción»
dejó de ser cierto.

```
sudo -u postgres psql -d spaces_demo -Atc "select string_agg(slug,',') from tenants"; sudo -u postgres psql -d spaces_prod -Atc "select string_agg(slug,',') from tenants"
```

**Esperado:** las dos listas **sin ningún nombre en común**. `demo` en la primera;
lo que haya en la segunda, pero nunca `demo`.

**Pega aquí:**
```

```

### C27 · Con qué usuario corre cada proceso

**No es un criterio del plan.** Es la trampa ① del traspaso, y conviene dejarla
**medida** en el expediente en vez de recordada.

```
pm2 list; sudo -u demo pm2 list
```

**Esperado:** `spaces-web` (el PADRE) como **root** — la tarea abierta — y
`spaces-demo` como **demo**.

**Pega aquí:**
```

```

---

# BLOQUE 8 · Lo que la Fase 3 gana hoy, y lo que sigue sin poder probarse

### C28 · El runner de la Fase 3, corriendo en un servidor real

```
sudo -u postgres psql -d spaces_demo -Atc "select count(*) from schema_migrations"; sudo -u postgres psql -d spaces_demo -Atc "select archivo, aplicada_en from schema_migrations order by aplicada_en desc limit 1"
```

**Esperado:** `72`, y la última siendo `20260824_grants_tablas_futuras.sql`.

**Pega aquí:**
```

```

### C29 · F3.5 y F3.6 — por qué NO se capturan aquí

**No es un olvido, y no hay comando que correr.**

- **F3.5 · ensayo completo en DEMO** — su paso 1 es *«publicar una versión de
  prueba en `beta`»* (`plan:1083`). **El canal `beta` no existe** sin el registry,
  que es **TH-P4**, parado desde el 17/08. Sin canal no hay nada que jalar, así
  que `update.sh` no se puede ensayar contra un servidor de verdad.
- **F3.6 · retirar el despliegue por SSH** — depende de F3.5 (`plan:1104`), y el
  plan avisa de que hacerlo antes de tiempo es **riesgo alto**: mientras el
  despliegue viejo sea el único mecanismo, retirarlo deja sin salida.

Lo único que sí se puede afirmar hoy sobre F3.6 es **en qué estado está el
repositorio**, y eso se mide en local: no hace falta servidor y ya está medido en
el expediente.

---

## Cuando termines

Pégame esto de vuelta, **aunque sea a trozos y en varias tandas**. Con cada
bloque que llegue voy rellenando **`docs/evidencias/fase-3-y-4.md`**, que es el
expediente conjunto.

**Y si algo sale distinto de lo esperado, pégalo igual.** Una salida inesperada
vale más que una en verde: es la que enseña dónde estaba mal el supuesto.

# Runbook — cerrar la Fase 4: el droplet viejo pasa a ser DEMO

> **Emitido:** 2026-08-24 · **Servidor:** `209.97.146.136` · **Lo corre una persona.**
> **Alcance decidido:** F4.1–F4.4 completas y **F4.5 con 3 de sus 4 criterios**. El
> cuarto —«DEMO suscrita al canal `beta`»— queda como **desviación declarada** hasta
> que caiga **TH-P4**. Ver §6.

---

## 0 · Lo que este runbook decidió, y por qué no es lo que dice el plan

Tres enmiendas posteriores al plan v3 cambian esta fase. Están todas registradas;
aquí solo se aplican.

| Lo que dice el plan | Lo que se hace, y por qué |
|---|---|
| **F4.2**: contratar un droplet nuevo para DEMO | **No se contrata nada.** El droplet viejo *es* DEMO (2ª enmienda a P1, `5ddb422`). Ahorra ≈$12/mes |
| **F4.3**: mover el registro A de `demo.space-os.io` | **No se mueve nada.** Ese nombre **ya** resuelve a `209.97.146.136` (`runbook-dominio-https.md:20-26`). F4.3 se convierte en una verificación |
| **F4.4**: `NEXT_PUBLIC_AUTOREGISTRO=1`, `signup` **400** | **Al revés: apagado.** P8 (20/08) cerró el registro en toda la flota, DEMO incluida. Lo correcto es **503** y el botón «Crear cuenta» **ausente** |

> [!important] Y una decisión propia de este runbook: **no se borra nada**
> La enmienda del 21/08 dice «recrear su base». Aquí se hace **creando `spaces_demo`
> al lado**, sin tocar `spaces_prod`, que se queda en disco. Llega al mismo criterio
> de aceptación —«la base de DEMO no contiene ni una fila de ningún owner»— y deja
> la vuelta atrás en **una línea**: devolver `DATABASE_URL` a `spaces_prod` y
> reiniciar. `spaces_prod` se borra otro día, a propósito y por separado.
>
> Consecuencia buena: el veredicto del censo **deja de ser una condición de parada**.
> Diga lo que diga sobre `rgb`, hoy no se pierde nada.

---

## 1 · GATE — el censo tiene que estar corrido

**No se sigue sin la salida de `PASO_1_Censo_F4.1_y_F0.1.txt`.** De ella salen cinco
valores que este runbook necesita:

| Del censo | Se usa en | Si sale mal |
|---|---|---|
| Bloque 1 · commit desplegado | §2 y §5.2 | Si **no está en `main`**, ya no para el runbook (no se borra nada), pero **se anota**: hay código sin revisar sirviendo |
| Bloque 4 · certificado de `demo.space-os.io` | §4 (F4.3) | **Sin certificado vigente, F4.3 vuelve a ser trabajo**: hay que emitirlo con `certbot` |
| Bloque 11 · roles | §3 (F4.2) | Si `spaces_user` sale **`t`** en `rolsuper` o en `rolbypassrls`, **para y avisa**: la RLS no se estaría aplicando |
| Bloque 12 · disco | §3 | Menos de ~2 GB libres: no cabe la segunda base |
| El `curl` de F0.1 | §5 (F4.4) | **503** = ya está apagado, no hay nada que hacer. **400** = hay que apagarlo, y eso es F0.2 |

> `ROLES_APLICACION = ['spaces_app', 'spaces_user']` (`scripts/migrar.mjs:323`): el
> runner acepta los dos nombres, así que **`spaces_user` se queda como está** y la
> cadena de migraciones concede igual. No se le cambia el nombre ni la contraseña.

---

## 2 · Traer el código nuevo SIN tocar la aplicación que corre

El runner de migraciones (`scripts/migrar.mjs`) y las **71** migraciones viven en la
rama, no en el commit que sirve hoy. Se traen a un clon aparte: **`/var/www/Spaces`
no se toca**, así que la aplicación sigue sirviendo mientras se construye la base.

```bash
# En /opt y NO en /root: el usuario `postgres` tiene que poder leerlo (§3.4)
git clone --branch feat/servidor-padre-instancias --single-branch \
  https://github.com/emiliano-cyber/spaces_dooh_new.git /opt/space-os-rama
cd /opt/space-os-rama && git log --oneline -1
ls db/migrations/*.sql | wc -l      # esperado: 71

# El runner es Node e importa `pg`: sin dependencias muere con
# ERR_MODULE_NOT_FOUND. Es el defecto ① del 21/08, que estaba en el paso 7.
npm ci --omit=dev

chmod -R a+rX /opt/space-os-rama
```

> El script resuelve su directorio **desde sí mismo y no desde `cwd`**
> (`scripts/migrar.mjs:41`), así que corre bien desde este clon.

> [!danger] El defecto ② del 21/08, y cómo se esquiva aquí
> El runner **corre como `root`**, así que una URL de socket unix contra el
> usuario `postgres` la rechaza la autenticación `peer`
> (`Peer authentication failed for user "postgres"`). Y no se puede correr
> `sudo -u postgres node` sin más, porque **Node vive bajo `/root/.nvm`**, que
> `postgres` no puede leer.
>
> Este runbook lo esquiva sin tocar contraseñas ni `pg_hba.conf`: **el clon va a
> `/opt` y el binario de Node se deja al alcance de `postgres`**. Así el runner
> corre *siendo* el usuario `postgres` y `peer` lo acepta.
>
> ```bash
> command -v node                       # p. ej. /root/.nvm/versions/node/v20.x/bin/node
> cp "$(command -v node)" /usr/local/bin/node && chmod a+rx /usr/local/bin/node
> sudo -u postgres /usr/local/bin/node --version    # tiene que contestar
> ```

---

## 3 · F4.2 · La base de DEMO

**Criterio de aceptación (literal del plan):** la base de DEMO **no contiene ni una
fila de ningún owner**, y el rol de la app **no** puede saltarse la RLS.

```bash
# 3.1 · la base nace vacia
sudo -u postgres psql -c "create database spaces_demo owner postgres"

# 3.2 · el esquema  (ya NO siembra el tenant 'rgb': D1 se cerro en 9d609f0)
sudo -u postgres psql -d spaces_demo -f /opt/space-os-rama/db/schema.sql

# 3.3 · comprobacion INTERMEDIA — tiene que dar 0 antes de migrar
sudo -u postgres psql -d spaces_demo -Atc "select count(*) from tenants"

# 3.4 · las migraciones, corriendo COMO postgres (ver el aviso de §2)
sudo -u postgres env \
  DATABASE_URL="postgresql:///spaces_demo?host=/var/run/postgresql" \
  /usr/local/bin/node /opt/space-os-rama/scripts/migrar.mjs --instalacion-nueva
```

**Qué tiene que salir del 3.4:** las 71 aplicadas y **salida 0**. Correrlo una segunda
vez tiene que decir **0 aplicadas**.

> [!warning] Si el 3.4 aborta a mitad, mira el codigo de salida antes de nada
> **1** = no pudo ni empezar (falta `DATABASE_URL`, o **no hay rol de aplicación** —
> es el caso que deja la base a medias, en la migración 52 de 70).
> **2** = una migración falló, la nombra. **3** = un checksum no cuadra.
> Vuelta atrás en cualquier caso: `drop database spaces_demo` y volver a empezar.
> `spaces_prod` no se ha tocado.

### Comando de verificación de F4.2

```bash
sudo -u postgres psql -d spaces_demo -Atc "select rolname, rolsuper, rolbypassrls from pg_roles where rolcanlogin"
sudo -u postgres psql -d spaces_demo -Atc "select count(*) from tenants"
```

**Esperado:** el rol de la app con **`f | f`**, y **`0`** organizaciones.

---

## 4 · F4.3 · Dominio y certificado

Con la enmienda del 21/08 **no hay DNS que mover**. Esto es una constatación:

```bash
dig +short demo.space-os.io
curl -s -o /dev/null -w '%{http_code}\n' https://demo.space-os.io/spaces-dooh/login/
echo | openssl s_client -connect demo.space-os.io:443 -servername demo.space-os.io 2>/dev/null | openssl x509 -noout -dates
```

**Esperado:** `209.97.146.136` · `200` · un certificado **sin vencer**.

**Si el certificado está vencido o no existe** (lo dirá el bloque 4 del censo), esto
deja de ser verificación y se ejecuta la receta ya probada en
`docs/runbook-dominio-https.md`:

```bash
certbot certonly --webroot -w /var/www/html -d demo.space-os.io
```

> **Certificado primero, `server_name` después.** Al revés el navegador enseña un
> error de certificado, no un 301 — es el error que el plan del 11 ya señalaba (T9).

---

## 5 · F4.4 · Datos de juguete y la bandera

### 5.1 · La organización de demostración

**No se llama `rgb`.** El criterio de F4.5 compara los slugs de DEMO contra los de
`spaces_prod` y **no puede haber ninguno en común**.

> [!danger] No uses `bootstrap-auth.mjs` aquí sin leer esto
> Ese script **resuelve por slug `rgb` y aborta si falta**, y lleva **su propia
> `MATRIZ` de 36 filas de permisos** que no coincide con las **41** que siembra
> `20260820_catalogo_permisos_completo.sql`. Corriendo **después** de las migraciones,
> la base acaba con la **unión**, no con 41. Es una divergencia real y no da ningún
> error: hay que mirar la tabla para verla.
>
> **Para DEMO se usa SQL documentado en `docs/datos/`**, que es la alternativa que el
> propio plan admite en F4.4 paso 1. Ese SQL se escribe **con el censo delante** —
> pásame la salida y lo dejo listo con el slug `demo`.

### 5.2 · El `.env` de DEMO

```bash
cd /var/www/Spaces/apps/web
cp .env /root/env.web.bak.$(date +%F_%H%M%S)     # respaldo ANTES, siempre
```

Valores que quedan:

| Variable | Valor | Por qué |
|---|---|---|
| `DATABASE_URL` | apunta a **`spaces_demo`** | Es el corte. Lo único que hay que deshacer para volver atrás |
| `APP_URL` | `https://demo.space-os.io` | |
| `COOKIE_SECURE` | `1` | |
| `AUTOREGISTRO` | **`0`** o ausente | ⚠️ **Contra el plan, a favor de P8** |
| `CANAL` | *(no se pone)* | No hay canal todavía: §6 |

```bash
su - emiliano -c 'pm2 restart spaces-web && pm2 describe spaces-web | grep -iE "status|restarts"'
```

### Comando de verificación de F4.4

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST https://demo.space-os.io/spaces-dooh/api/signup/ -H 'Content-Type: application/json' -d '{}'
```

**Esperado: `503`** — y **no** el `400` que dice el plan (`:1351`). Ver §0.

> [!warning] Y una comprobación que NINGUNA prueba automática puede hacer
> Abre `https://demo.space-os.io/spaces-dooh/login/` **en el navegador** y confirma
> que el botón **«Crear cuenta» NO aparece**. Es el único eslabón que el ensayo de
> F2.5 no pudo cerrar —hidratación en un navegador de verdad— y si no se mira aquí,
> no lo mira nadie.
>
> ⚠️ Si el bloque 1 del censo dice que el droplet sirve un commit **anterior** a
> `70ca3f0` (F2.6), la bandera **sigue horneada en el build** y `AUTOREGISTRO=0` en
> el `.env` **no hace nada**. En ese caso el que manda es el resultado del `curl` de
> F0.1: si ya daba 503, está apagado de fábrica y no hay nada que hacer.

---

## 6 · F4.5 · Smoke y cierre del riesgo

Las cuatro afirmaciones del plan, con su estado bajo el alcance decidido:

| # | Afirmación | Cómo se comprueba | Estado |
|---|---|---|---|
| 1 | `demo.space-os.io` resuelve al droplet de DEMO | `dig +short demo.space-os.io` | ✅ alcanzable hoy |
| 2 | La base de DEMO no contiene ningún tenant de `spaces_prod` | abajo | ✅ alcanzable hoy |
| 3 | Los tenants reales no están servidos desde ahí | El censo lo dice: solo `rgb`, que es de prueba | ✅ alcanzable hoy |
| 4 | DEMO está suscrita al canal `beta` | — | 🔶 **DESVIACIÓN DECLARADA** |

```bash
# criterio 2 — las dos listas NO deben tener ningun slug en comun
sudo -u postgres psql -d spaces_demo -Atc "select string_agg(slug,',') from tenants"
sudo -u postgres psql -d spaces_prod -Atc "select string_agg(slug,',') from tenants"
```

### La desviación del criterio 4, escrita

**Qué falta:** el canal `beta` necesita **TH-P4** —crear el registry en DigitalOcean
Container Registry y fijar `REGISTRY`, `REGISTRY_TIPO` y `DO_REGISTRY_TOKEN`— y una
imagen publicada por `release.yml`, que dispara con un tag `vX.Y.Z`.

**Por qué no se hace hoy:** publicar esa imagen desde la rama metería dentro los
**cuatro commits ROJO sin auditar**. La decisión, tomada el 2026-08-24, fue cerrar la
fase sin el canal y volver por él cuando TH-P4 caiga.

**Qué queda bloqueado por eso, y hay que decirlo:** **F3.5** (ensayo real de
`update.sh` contra DEMO) sigue **PENDIENTE** — necesita que DEMO jale del canal, no
solo que exista. Y con F3.5, **F3.6** (retirar `deploy.yml`).

---

## 7 · Al terminar — lo que se commitea en el PADRE

Nada de esto toca el servidor; es el registro, y sin él la fase no cierra.

1. `docs/evidencias/fase-4.md` con las salidas reales pegadas.
2. El censo relleno, con su veredicto.
3. Las filas de F0.1 y F4.1–F4.5 en `vault/07-Agentes/ejecucion-plan-v3.md`.
4. La desviación del criterio 4 en la tabla de desviaciones, **con su fecha**.
5. `vault/07-Agentes/diario/2026-08-24.md`.
6. Entrada en `docs/Registro_Cambios.md`: **sí se nota desde la aplicación** — la
   demostración pública deja de compartir base con los datos de trabajo.

---

## 8 · Vuelta atrás completa

En una línea, y sin haber borrado nada en todo el runbook:

```bash
cp /root/env.web.bak.<fecha> /var/www/Spaces/apps/web/.env
su - emiliano -c 'pm2 restart spaces-web'
sudo -u postgres psql -c "drop database spaces_demo"   # opcional
```

# Runbook — dar de alta a un owner

**Qué es un alta, y qué no.** Dar de alta a un owner es **aprovisionar una
instancia entera**: su servidor, su base de datos y su dominio. No es insertar
una fila en `tenants`. Si alguien busca aquí un `INSERT`, está en el modelo que
murió el 2026-08-12 — ver
[`vault/01-Arquitectura/modelo-instancias-soberanas.md`](../vault/01-Arquitectura/modelo-instancias-soberanas.md).

La herramienta es [`infra/scripts/provision-instancia.sh`](../infra/scripts/provision-instancia.sh).
Este documento explica **cuándo** se corre cada modo y **qué hay que tener antes**.

---

## Lo que hace falta antes de empezar

| | Qué | Quién lo da |
|---|---|---|
| 1 | **El dominio** que el owner quiere usar (`inventario.suempresa.com`) | Comercial, confirmado con el owner |
| 2 | **El correo del Dueño** — su identidad para entrar y su única vía de recuperación | El owner |
| 3 | **Un servidor**: uno que ya exista (`--host`) o crearlo (`--crear-droplet`) | Ver «la decisión pendiente» |
| 4 | **Acceso `ssh` como root** a ese servidor desde tu máquina | Infra |
| 5 | El nombre del **registry** de imágenes | 🔴 **SIN DECIDIR — TH-P4** |

> [!danger] El alta NO se puede terminar hoy
> El punto 5 no está decidido. Sin `REGISTRY`, la instancia queda aprovisionada
> —base, entorno, nginx, actualizador— pero **no hay imagen que instalar**, así
> que no llega a servir nada. `update.sh` para con un error de configuración,
> que es exactamente lo que tiene que hacer.
>
> Los pasos 1 a 6 de abajo son válidos y se pueden ensayar. El 7 espera.

> [!warning] La decisión pendiente sobre el servidor
> **En qué cuenta de DigitalOcean nacen las instancias sigue sin decidirse**
> (§8.3 del plan v3). Por eso el script tiene los dos modos y **ninguno por
> defecto**: hay que elegir en cada corrida, a propósito.
>
> - `--crear-droplet` — nace en la cuenta de AS OOH ya configurada en `doctl`.
> - `--host <ip|dns>` — un servidor que ya existe, incluido el caso «la cuenta
>   es del owner», que es el más coherente con la promesa de soberanía.

---

## El orden, y por qué es ese

```
1. Simular         →  ves qué haría, sin tocar nada
2. Aprovisionar    →  base, entorno, nginx (solo HTTP), actualizador
3. ALTO            →  el owner apunta su DNS.  ESTO NO LO HACEMOS NOSOTROS
4. Comprobar DNS   →  antes del certificado, o se queman intentos
5. Certificado     →  y con él, el nginx definitivo
6. Bootstrap       →  la primera organización y su Dueño
```

**El certificado va después del DNS y no antes**, y no es una preferencia:
Let's Encrypt pide el desafío al servidor **al que apunta el nombre**. Si el
nombre todavía no apunta a nuestro servidor, el desafío se lo pide a otro y
falla. Solo hay **cinco intentos por hora**, así que un certificado pedido
antes de tiempo no es un reintento gratis: gasta el cupo de la tarde.

**El nginx definitivo también va después**, por un motivo distinto: apunta a
`/etc/letsencrypt/live/<dominio>/fullchain.pem`, y **nginx no arranca si ese
archivo no existe**. Instalarlo antes dejaría el servidor sin nginx. Por eso el
paso 2 pone un vhost mínimo de solo HTTP que sirve el desafío de ACME.

---

## 1 · Simular

**Siempre primero.** El script no ejecuta nada sin `--confirmar`: sin esa
bandera se comporta como una simulación aunque no la pidas.

```bash
infra/scripts/provision-instancia.sh \
  --host <ip> --dominio <dominio> --instancia <nombre-corto> --dry-run
```

Lee la lista entera. Cada línea empieza por `[SIMULACION]` y es literalmente lo
que se va a ejecutar.

## 2 · Aprovisionar

```bash
infra/scripts/provision-instancia.sh \
  --host <ip> --dominio <dominio> --instancia <nombre-corto> --confirmar
```

Deja hecho:

- **Dos roles de Postgres.** El de la aplicación es `NOSUPERUSER` **y
  `NOBYPASSRLS`**. Las dos palabras hacen falta: un rol que atraviesa la RLS
  funciona perfectamente y sin aislamiento, y no da ningún error — es la peor
  combinación posible.
- **El esquema y las migraciones**, con el rol privilegiado y
  `--instalacion-nueva`, que se verifica a sí mismo.
- **`/etc/space-os/app.env` y `/etc/space-os/instancia.env`**, en 600, con un
  `BOOTSTRAP_TOKEN` y un `FLOTA_TOKEN` aleatorios y distintos por instancia.
  Salen de las plantillas versionadas **con sus comentarios**: quien abra ese
  archivo dentro de seis meses necesita leer *por qué* `COOKIE_DOMAIN` no está.
- **nginx en solo HTTP**, sirviendo el desafío de ACME.
- **`update.sh` y su `cron`.** A partir de aquí la instancia se actualiza sola:
  el padre no entra por ssh a desplegar.

## 3 · ALTO — el DNS lo pone el owner

El script se detiene e imprime la instrucción exacta. **AS OOH no entra en la
zona DNS del owner.** No es una formalidad administrativa: es la parte de
«soberana» que el owner puede comprobar por sí mismo.

## 4 · Comprobar el DNS antes de pedir el certificado

```bash
dig +short <dominio>
```

Tiene que devolver la IP del servidor. **Si no la devuelve, no sigas**: el paso
5 gastaría uno de los cinco intentos de la hora.

## 5 · El certificado, y el nginx definitivo

```bash
infra/scripts/provision-instancia.sh \
  --host <ip> --dominio <dominio> --emitir-certificado --confirmar
```

Usa `certbot --webroot` y **no `--nginx`**: `--nginx` reescribe la
configuración por su cuenta y el archivo deja de parecerse a la plantilla
versionada. `--webroot` tampoco necesita parar nginx, que es lo que obliga
`--standalone` y lo que convierte cada renovación en una caída.

Al terminar, comprueba `login 200`.

## 6 · La primera organización y su Dueño

```bash
infra/scripts/provision-instancia.sh \
  --host <ip> --dominio <dominio> --instancia <nombre> \
  --email <correo-del-dueño> --bootstrap --confirmar
```

Llama a `POST /api/bootstrap` **desde el propio servidor, por loopback**: el
token no cruza internet y funciona aunque el DNS aún no haya propagado del todo.

> [!important] La clave se imprime UNA VEZ
> No se guarda en ningún sitio. Entrégasela al owner por un canal privado y
> dile que la cambie al entrar.

**Después de esto, la puerta se cierra sola.** `/api/bootstrap` responde 404
desde el momento en que existe una organización, con token o sin él. No hay que
acordarse de retirar el `BOOTSTRAP_TOKEN`: uno de los tres cerrojos es que
`tenants` esté vacía, y ya no lo está. Retirarlo es defensa en profundidad, no
el cerrojo.

## 7 · Comprobar el alta

```bash
curl -s -o /dev/null -w 'login %{http_code}\n' https://<dominio>/spaces-dooh/login/
curl -s -w '\nsignup HTTP %{http_code}\n' -X POST https://<dominio>/spaces-dooh/api/signup/ \
  -H 'Content-Type: application/json' -d '{}'
```

Esperado: **`200`** y **`503`**. El 503 es el autoregistro cerrado, que lo está
en toda la flota.

Y una tercera que **no se puede fingir**:

```bash
curl -s -o /dev/null -w 'login-post %{http_code}\n' \
  -X POST https://<dominio>/spaces-dooh/api/auth/login/ \
  -H 'Content-Type: application/json' -d '{"email":"no@existe.invalid","password":"x"}'
```

Esperado: **`401`**.

> **Por qué esta tercera es obligatoria.** Un `200` en el login solo demuestra
> que una página se pinta. El PADRE estuvo **cuatro días** sirviendo un login
> perfecto **sin poder autenticar a nadie** —le faltaba `DATABASE_URL`— y las
> cinco comprobaciones que se hacían salían verdes. El `401` es la única de las
> tres que demuestra que la instancia habla con su base.

---

## Si algo falla

| Síntoma | Qué significa | Qué hacer |
|---|---|---|
| El certificado falla | El DNS no resuelve todavía, o resuelve a otro sitio | `dig +short <dominio>`. **No reintentes a ciegas**: son 5 por hora |
| `nginx -t` falla tras el paso 5 | El certificado no se emitió pero el vhost ya se instaló | Vuelve al vhost de solo HTTP y repite el paso 5 |
| `bootstrap` devuelve 404 | Ya existe una organización, o falta el token | Si la instancia ya tiene Dueño, esto es **correcto**: la puerta se cerró sola |
| `bootstrap` devuelve 429 | Demasiados intentos desde esa IP | Espera. Son 10 por hora |
| `update.sh` para con error de configuración | Falta `REGISTRY` | Es lo esperado hoy: TH-P4 sin decidir |

**Vuelta atrás mientras no se haya entregado nada al owner:** destruir el
droplet. Nada de lo hecho hasta el paso 6 le ha llegado a nadie.

---

## Lo que este runbook no cubre

- **Migrar un owner que ya existe** a su propia instancia. Es otra cosa: hay
  datos que mover.
- **Dar de baja** una instancia.
- **El panel de flota** (F6.2), que es lo que dirá qué versión corre cada quien.

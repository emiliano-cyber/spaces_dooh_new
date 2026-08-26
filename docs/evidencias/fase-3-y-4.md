# Instancias Soberanas · Fases 3 y 4 — Expediente conjunto

Rama: `feat/servidor-padre-instancias` · **3.ª emisión: 2026-08-25 (noche)**
Emisiones previas: 1.ª el 24/08, 2.ª el 25/08 (mañana)
Plan de autoridad: `docs/Plan_Instancias_Soberanas_v3.md` §FASE 3 (`:917-1228`) y
§FASE 4 (`:1230-1434`)

> [!important] Qué es este documento
> El registro de **qué quedó probado, con qué se probó, y qué NO**. Cada
> afirmación lleva su ancla: un hash, un `archivo:línea`, o la salida de un
> comando que alguien corrió. Lo que no tiene ancla va marcado como lo que es.

---

## 0 · Resumen en una tabla

| | Estado | Falta |
|---|---|---|
| **Fase 3** | **7 de 9** | `F3.5` y `F3.6`, bloqueadas por **TH-P4** |
| **Fase 4** | **4 de 5**, y la 5.ª a medias | El **dominio de DEMO** |
| **El PADRE** | ✅ funcionando en `space-os.io` | Sacar su proceso de `root` |
| **DEMO** | ✅ corriendo en el `3001` como usuario `demo` | Su dominio |

**Un solo bloqueo externo detiene las dos fases: TH-P4, el registry.** El resto
es trabajo, y queda poco.

---

## 1 · Fase 3 · `update.sh` + runner de migraciones

### Estado

| Tarea | Estado | Anclaje |
|---|---|---|
| **F3.1** · tabla `schema_migrations` y backfill | ✅ **+ probada en servidor** | `6cb16d4` |
| **F3.2** · runner idempotente, orden correcto | ✅ **+ probada en servidor** | `d31a7b8` |
| **F3.3** · una migración alterada aborta el update | ✅ local | `dc6df52` |
| **F3.4** · `update.sh`, el pull de la instancia | ✅ ensayada local | `acbbe0b` · `8151772` · `2633bcb` |
| **F3.5** · ensayo completo en DEMO | 🛑 **BLOQUEADA** | espera TH-P4 |
| **F3.6** · retirar el despliegue por SSH | 🛑 **BLOQUEADA** | depende de F3.5 |
| **F3.7** · el respaldo sale del droplet | ✅ local | `f369b4c` |
| **F3.8** · reintentos con backoff y un límite | ✅ local | `84c6c20` |
| **F3.9** · el log se lee sin entrar al servidor | ✅ local, 🔴 cerrado | `a490dd3` · `32042e5` · `8f81c3e` · `3872d61` |

### Lo que ganó esta fase, y no estaba planeado

**El runner corrió en servidores de verdad, tres veces.** Hasta el 24/08 solo se
había probado contra el Postgres del 5433 y `spaces_e2e`.

```
$ migrar.mjs --instalacion-nueva          # spaces_demo, 24/08
--instalacion-nueva verificada: ninguna de las 11 tablas que solo crean las
  migraciones existe en esta base.
71 aplicadas, 1 de datos pendientes.

$ migrar.mjs                              # segunda corrida
0 aplicadas, 1 de datos pendientes.
```

**`0 aplicadas` es `F3.1` y `F3.2` demostradas fuera de local.** Y la guarda de
`--instalacion-nueva` **se verificó a sí misma** antes de tocar nada: eso es
`F3.2` haciendo lo suyo en la única situación donde importa — una base a punto de
recibir 71 migraciones.

Después se aplicó también a `spaces_prod` (25/08, `1 aplicada`) y se confirmó que
las dos bases del PADRE quedan en **72 aplicadas**.

> **71 y no 72, y el «esperado: 72» de la 1.ª emisión estaba MAL.**
> `20260731_calendario_meses_cortos.sql` lleva `-- @tipo: datos` y el runner la
> omite salvo `--con-datos` (`migrar.mjs:717-721`), igual que `deploy.yml`: las
> de datos **reescriben filas y no se deshacen solas**.
>
> Eran **dos números distintos**: **archivos en disco** y **migraciones
> aplicadas**. El runner **nombra** la que omite, a propósito — *«una migración
> que no se aplica y que nadie menciona es una que se olvida»* (`migrar.mjs:713-715`).

### Lo que costó de verdad: `F3.9`, cuatro intentos

La tarea era que el log del update se leyera sin entrar al servidor. Lo caro fue
que **subirlo tal cual habría incumplido su propio criterio**: `update.log` ya
llevaba salida cruda del runner, de `pg_dump`, de `pg_restore` y de `docker logs`.

La solución no fue añadir una subida, sino **separar lo que emite el script de lo
que emiten sus herramientas**. Viaja `update-publicable.log`; se queda
`update.log`, crudo. **Sin lista de palabras prohibidas ni filtro por regex, a
propósito**: un filtro se olvida de un caso y nadie se entera.

`d540833` 🔴 → `70b8cc5` 🟡 → `6fb93ec` 🔴 → `a490dd3` → **cerrado con `8f81c3e`**,
endurecido por `3872d61` (la poda pasó a lista blanca).

La decisión de fondo fue de Jochelo el 19/08 (**M3**): arreglar en el **origen**.
`pg_dump`/`pg_restore` dejaron de recibir un `--dbname` con la URL y pasaron a
**cuatro banderas sueltas**. El invariante está en el propio archivo
(`update.sh:905-911`), y su razón también:

> *«Una lista negra sobre un espacio de nombres que se decodifica no se puede
> demostrar completa. Siempre queda otra codificación. Reconstruir la conexión sí
> se puede demostrar.»*

### 🛑 `F3.6` — su criterio, medido, NO se cumple

Criterio: *«no queda en el repo ningún camino que entre por SSH a una instancia a
compilar»*, verificable con `rg -n "appleboy/ssh-action|pm2 reload" .github/` →
sin resultados (`plan:1122`).

**Corrido el 24/08:** tres resultados en `deploy.yml` (`:68`, `:171`, `:185`),
donde el criterio exige cero.

**No es un defecto: la tarea no se ha hecho, y no debe hacerse todavía.** El plan
avisa de que retirarlo antes de tiempo es **riesgo alto** (`plan:1126-1129`).

---

## 2 · Fase 4 · separar DEMO como instancia real

### Estado

| Tarea | Estado | Qué falta |
|---|---|---|
| **F4.1** · censo del droplet | ✅ **CERRADA** (25/08) | Nada |
| **F4.2** · base de DEMO | ✅ **CUMPLIDA** | Nada |
| **F4.3** · dominio y certificado | ⏳ **PENDIENTE** | Certificado de `demo` + mover el DNS |
| **F4.4** · datos y bandera | ✅ **CUMPLIDA** | Nada |
| **F4.5** · smoke y cierre del riesgo | 🟡 **2 de 4** | Los criterios 1 y 3 dependen de F4.3 |

### `F4.1` — cerrada, y desmontó la premisa del 24/08

El 24/08 se concluyó que se había perdido el acceso al droplet `209.97.146.136`.
**Era falso.** El 25/08 se entró sin dificultad y se completó el censo entero.
Documento en `docs/evidencias/f4-1-censo-resultado.md`.

| Dato | Valor |
|---|---|
| Identidad | `PIXELED-ubuntu-s-2vcpu-4gb-nyc3` · `209.97.146.136` |
| Commit desplegado | `504b4fc` (11/08), **en `main`** — la condición de parada **no se dispara** |
| Proceso | `online`, 13 días, **como `emiliano`, no root** |
| Certificado | `demo.space-os.io`, vence **2026-10-26** |
| Tenants | `rgb`, `telcel`, `g500`, `eyro`, `demo-owner` — todos de julio |
| `POST /api/auth/login/` | **401** — esa máquina **sí habla con su base** |

Sobre aquella conclusión falsa se habían levantado el **ADR 0015**, la 3ª enmienda
a P1 y **dos tareas declaradas imposibles**. Las cuatro se revisaron.

### `F4.2` — la base de DEMO

`spaces_demo` en el PADRE, creada el 24/08 y migrada. Criterio del plan, medido:

```
spaces_app|f|f     <- ni superusuario, ni puede saltarse la RLS
0                  <- cero organizaciones antes de sembrar
72                 <- migraciones aplicadas, igual que spaces_prod
```

### `F4.4` — proceso, datos y bandera

**El proceso** corre en el `3001` bajo **systemd**, con `User=demo`. Medido, no
supuesto:

```
$ systemctl show spaces-demo -p MainPID --value | xargs -r ps -o user=,pid=,cmd= -p
demo      262995 next-server (v14.2.29)
```

**Es la separación de la que depende el ADR 0017** para aceptar que la demo
comparta máquina con el plano de control.

**Las banderas**, comprobadas por HTTP contra el proceso:

```
$ curl -s http://127.0.0.1:3001/spaces-dooh/api/auth/metodos/
{"google":false,"autoregistro":false}

$ curl ... http://127.0.0.1:3001/spaces-dooh/login/
login 200
```

**El alta**, con `bootstrap-auth.mjs`:

```
OK · usuarios: 1 · organización: demo
Dueño: emistreg@gmail.com
```

Slug **`demo`** y no `rgb`, a propósito: el criterio 2 de F4.5 compara los slugs
de las dos bases y no puede haber ninguno repetido.

> ⧗ **La semilla (`20260824_semilla_demo.sql`) no tiene salida capturada en este
> expediente.** Se reporta como corrida; el resultado esperado es
> `demo · 2 arrendadores · 6 pantallas · 5 disponibles`. Se anota como **reporte,
> no como medición**, y se cierra pegando esa línea.

### `F4.5` — dónde está cada criterio

| # | Criterio | Estado |
|---|---|---|
| 1 | DEMO resuelve a su servidor | ❌ **`demo.space-os.io` → `209.97.146.136`** |
| 2 | Las dos bases no comparten ningún slug | ✅ `demo` vs `rgb` |
| 3 | El viejo ya no sirve ese nombre | ❌ depende del 1 |
| 4 | DEMO suscrita al canal `beta` | 🔶 **desviación declarada** — TH-P4 |

---

## 3 · El dominio — lo único que falta, y por qué no está

**Medido el 25/08 por la noche:**

```
space-os.io       → 137.184.107.53   ✅ el PADRE
demo.space-os.io  → 209.97.146.136   ❌ la máquina vieja
```

**El dominio del PADRE sí está**, y su historia es la de la tarde:

| | |
|---|---|
| Certificado | `space-os.io`, hasta el **2026-11-23**, con **renovación automática** |
| Emisión | `certbot --standalone` — `padre-ip.conf` no tenía hueco ACME, así que `--webroot` habría fallado |
| nginx | `space-os.io.conf` **enlazado** desde el repositorio, `padre-ip` retirado |
| Cloudflare | proxy en **gris**, decidido el 25/08 |
| Verificado | `raiz 302 · login 200 · login-post 401 · CN=space-os.io` |

**El de DEMO no**, y faltan dos cosas:

1. **Un certificado para `demo.space-os.io` en el PADRE.**
2. **Mover su registro A** de `209.97.146.136` a `137.184.107.53`.

### Por qué el paso 1 es fácil ahora y no lo era esta mañana

Se intentó por `certbot --manual` y **falló tres veces**, quemando 3 de los 5
intentos por hora que permite Let's Encrypt. Ese modo exige crear un archivo **en
la otra máquina** mientras certbot espera, y coordinar dos consolas web —con el
Enter enviándose solo por el salto de línea de la pegada— es frágil por diseño.

**Al invertir el orden, el problema se disolvió.** `space-os.io.conf` —ya
enlazado— **trae el hueco ACME** (`:94-96`, `:109-111`), así que la máquina vieja
solo tiene que **reenviar** el desafío al PADRE. Sin que nadie pulse Enter a
tiempo.

**El paso que desbloqueó al difícil fue el fácil**, y se habría visto antes
mirando qué sirve cada configuración en vez de repetir el comando.

### Y por qué el orden sigue importando

`demo.space-os.io` sirve **HSTS de dos años**. Si se mueve el DNS antes de tener
certificado, todo el que entre ve un error que **no se puede saltar** desde el
navegador. **Certificado primero, DNS después** no es preferencia: es requisito.

---

## 4 · Decisiones tomadas durante estas fases

| ADR | Decisión | Estado |
|---|---|---|
| **0015** | DEMO dentro del PADRE | superado por el 0016 |
| **0016** | DEMO se queda en su droplet | superado por el 0017 |
| **0017** | **Todo se concentra en el PADRE** | ✅ vigente |
| **0018** | Fijar la primera contraseña sin la anterior, tras entrar con Google | ✅ construido y verificado |
| **0019** | **DEMO arranca con systemd**, no con pm2 | ✅ vigente |

> **La decisión de DEMO cambió tres veces en dos días, y cada giro tuvo causa
> distinta:** el 0015 nació de creer perdido el acceso al droplet viejo; el 0016,
> de descubrir que no se había perdido; el 0017, de una decisión de producto — esa
> máquina **no forma parte del modelo**. Está escrito así en el 0017 para que no
> se lea como indecisión.

### Desviaciones declaradas frente al plan

| # | El plan dice | Lo que se hace | Por qué |
|---|---|---|---|
| 1 | `F4.4`: autoregistro **encendido**, `signup` → `400` | `AUTOREGISTRO=0` | **P8**: nadie crea su cuenta, ni en DEMO |
| 2 | `F4.5` criterio 4: canal `beta` | **No se cumple** | TH-P4 |
| 3 | `F5.4` y `F5.7` bloqueadas por §8.2 y §8.3 | **No lo están** | Cerradas el 20/08 (`ejecucion-plan-v3.md:39`) |

---

## 5 · Lo que estas fases enseñaron, y vale más que la lista de logros

**El PADRE pasó cuatro días sirviendo un login que no podía autenticar a nadie.**
Se descubrió el 25/08: le faltaba `DATABASE_URL`, y `db.ts:23-24` se cae a un
valor por omisión que apunta al Postgres de **desarrollo**. La app arranca, pinta
el login y devuelve `200`.

> [!danger] Cinco comprobaciones daban verde sobre un sistema roto
> `raiz 302` · `login 200` · `signup 503` · `nginx -t ok` · `metodos google:true`
>
> **Las cinco pasaban** con la base caída **y** con el acceso con Google roto.
> También pasaba el humo del propio runbook (§7).
>
> **Lo único que encuentra esta clase de fallo es ejercer la función de verdad.**

Y no fue un caso aislado. Cuatro cosas llevaban días rotas y **ninguna daba
señal**:

| Qué | Desde | Cómo se encontró |
|---|---|---|
| Sin `DATABASE_URL` | 21/08 | Un `POST` de login, no un `GET` |
| `GOOGLE_CLIENT_ID` **sin su primer carácter** | 21/08 | Pulsando el botón |
| `GOOGLE_REDIRECT_URI` a `localhost` | 21/08 | Completando el flujo |
| `spaces_prod` sin la migración 72 | 24/08 | Contando, no mirando |

El del client ID es el más instructivo: **le faltaba un carácter** —se lo comió la
consola web al pegar el `.env`— y nada lo delata. La app arranca, el botón
aparece, `metodos` dice `google:true`. **Solo falla cuando alguien entra.**

### La consecuencia para la Fase 5, que hay que escribir antes de llegar

**El smoke que se correrá en cada droplet nuevo hereda el mismo agujero** si se
limita a mirar códigos de respuesta. Tiene que incluir **una petición que toque la
base** — `POST /api/auth/login/` con credenciales inexistentes, esperando `401`.

Un `500` ahí significa que la instancia nació rota. Un `200` en el login no
significa nada.

---

## 6 · Lo que falta, y quién

### Trabajo — dos pasos, los dos sobre el PADRE

1. **Certificado de `demo.space-os.io`**, con la máquina vieja reenviando el
   desafío ACME.
2. **Mover el registro A** de `demo.space-os.io` al PADRE.

Con eso cierran **F4.3** y los criterios **1 y 3** de F4.5.

### Bloqueos que no son trabajo

| Bloqueo | Detiene | Quién |
|---|---|---|
| **TH-P4 · el registry** (desde el 17/08) | **F3.5, F3.6**, criterio 4 de F4.5, **F5.5, F5.6, F5.7** | Jochelo |

### Tareas abiertas que este expediente no cierra

1. **El proceso del PADRE corre como `root`.** DEMO ya no; el PADRE sí. Y el
   ADR 0019 deja escrito que lo coherente es que **ambos pasen a systemd**.
2. 🔴 **El valor por omisión de `db.ts`.** Una instancia sin `DATABASE_URL`
   debería **negarse a arrancar**. Peor: si alguien levanta el `docker-compose`
   en esa máquina, el 5433 **sí** responde y la app hablaría con una base de
   desarrollo creyendo que es la suya. **Es el fallo que ya mordió al PADRE**, y
   en la Fase 5 se repetiría en cada droplet.
3. **El humo del runbook** tiene que tocar la base.
4. **Los códigos de recuperación del Dueño** — decididos el 20/08, no construidos.
5. **D4** — una migración fallida deja la base sin recobro.
6. **`next start` con `output: standalone`** — el PADRE y DEMO arrancan igual, con
   el aviso de Next. Condición preexistente; se decide para los dos a la vez.

---

## 7 · Verificación

| Suite | Cifra | Cuándo |
|---|---|---|
| Unitarias | **858** en 79 archivos | 25/08 |
| e2e | **20 archivos · 216 pruebas · 1 saltada** | 25/08 |
| `typecheck` | limpio | 25/08 |
| `aislamiento.e2e.test.ts` | **pasa sin tocarse** | 25/08 |
| Migraciones | **73** archivos · **72** aplicables | 25/08 |

```
cd apps/web && npm run typecheck && npm test && npm run build && npm run test:e2e
```

> Las e2e **exigen el build hecho antes**. Y ojo con la variante que costó un
> diagnóstico hoy: **un build viejo también engaña** — el arnés arranca con
> `next start`, que reutiliza lo que haya en `.next`.

---

## 8 · Nota de entorno

- La rama **no está fusionada a `main`**. `main` tiene **66** migraciones; esta
  rama, **73**.
- El remoto vivo es **`emiliano`**. `origin` está muerto — **salvo en los
  droplets**, donde `origin` sí apunta al vivo.
- Las bases de los tres entornos son **datos de prueba**. ⚠️ Deja de valer con el
  primer cliente de pago.

---

## 9 · Registro de emisiones

| Emisión | Fecha | Qué cambió |
|---|---|---|
| 1.ª | 24/08 | Apertura, con la evidencia local y 31 huecos de captura |
| 2.ª | 25/08 mañana | `F4.1` cerrada, el acceso recuperado, el PADRE sin base |
| **3.ª** | **25/08 noche** | **DEMO corriendo**: `F4.2` y `F4.4` cumplidas, systemd (ADR 0019), el PADRE en `space-os.io`. Queda **solo el dominio de DEMO** |

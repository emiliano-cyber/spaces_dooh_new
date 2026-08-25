# Instancias Soberanas · Fases 3 y 4 — Expediente conjunto

Rama: `feat/servidor-padre-instancias` (worktree `.claude/worktrees/servidor-padre`)
**2.ª emisión: 2026-08-25** · 1.ª emisión: 2026-08-24
Plan de autoridad: `docs/Plan_Instancias_Soberanas_v3.md` §FASE 3 (`:917-1228`) y
§FASE 4 (`:1230-1434`)

> [!important] Por qué las dos fases van en un solo expediente
> **No se pueden contar por separado.** `F3.5` depende de `F4.5` (`plan:1080`,
> decisión **P5**), y `F4.5` arrastra una desviación que nace en la Fase 3 —el
> canal `beta`—. Un solo bloqueo, **TH-P4**, es lo que impide cerrar las dos.

> [!note] Relación con `docs/Expediente_Fases_0_a_4.md`
> Aquel, del 21/08, sigue siendo válido para las **Fases 0, 1 y 2**. Sus secciones
> de Fase 3 y Fase 4 quedaron superadas; lleva un aviso arriba que lo dice. **Para
> estas dos fases manda este documento.**

---

## 0 · Qué cambió en esta 2.ª emisión, y es casi todo

La 1.ª emisión se escribió creyendo dos cosas que resultaron falsas:

**① Que se había perdido el acceso al droplet `209.97.146.136`.** No se perdió.
El censo de `F4.1` se completó el 25/08 y la máquina **está entera y
funcionando**. → **[ADR 0016](../adr/0016-demo-se-queda-en-su-droplet.md)**, que
supera al 0015: **DEMO se queda en su propio droplet.**

**② Que el PADRE estaba vivo.** Servía un login `200` desde el 21/08 **sin
conexión con su base**. Se descubrió y se arregló el 25/08.

Las dos falsedades tenían la misma forma: **una medición que no medía lo que
parecía medir.** Un `ssh` que no se reintentó, y un `200` que era una página
pintándose.

---

## 1 · El cuadro de las dos fases

### Fase 3 · `update.sh` + runner de migraciones — **7 de 9**

| Tarea | Tipo | Estado | Commit(s) |
|---|---|---|---|
| **F3.1** · tabla `schema_migrations` y backfill | migración | ✅ COMPLETADA_LOCAL **+ probada en servidor** | `6cb16d4` |
| **F3.2** · runner idempotente, con el orden correcto | código | ✅ COMPLETADA_LOCAL **+ probada en servidor** | `d31a7b8` |
| **F3.3** · una migración alterada aborta el update | código | ✅ COMPLETADA_LOCAL | `dc6df52` |
| **F3.4** · `update.sh`, el pull de la instancia | infra | ✅ ENSAYADA_LOCAL | `acbbe0b` · `8151772` · `2633bcb` |
| **F3.5** · ensayo completo en DEMO | verificación | 🛑 **BLOQUEADA** — espera **TH-P4** | — |
| **F3.6** · retirar el despliegue por SSH | release | 🛑 **BLOQUEADA** — y ahora con una razón más | — |
| **F3.7** · el respaldo sale del droplet | infra | ✅ COMPLETADA_LOCAL | `f369b4c` |
| **F3.8** · reintentos con backoff, y un límite | infra | ✅ COMPLETADA_LOCAL | `84c6c20` |
| **F3.9** · el log se lee sin entrar al servidor | infra | ✅ COMPLETADA_LOCAL, 🔴 cerrado el 20/08 | `a490dd3` · `32042e5` · `8f81c3e` · `3872d61` |

### Fase 4 · separar DEMO como instancia real — **bajo el ADR 0016**

| Tarea | Estado | Qué falta |
|---|---|---|
| **F4.1** · censo del droplet | ✅ **CERRADA el 25/08** | Nada. `f4-1-censo-resultado.md` |
| **F4.2** · droplet y base de DEMO | ✅ **CUMPLIDA** | `spaces_demo` en el PADRE, creada y migrada el 24/08 |
| **F4.3** · dominio y certificado | ⏳ **PENDIENTE** | Certificado de `demo.space-os.io` en el PADRE, y mover su DNS |
| **F4.4** · datos y bandera | ⏳ **PENDIENTE** | Usuario `demo`, `.env`, proceso en el 3001, alta y semilla |
| **F4.5** · smoke y cierre del riesgo | ⏳ **PENDIENTE** | 3 criterios alcanzables; el 4.º sigue bloqueado por TH-P4 |

> [!warning] Esta tabla estuvo AL REVÉS unas horas, y conviene saber por qué
> Se escribió bajo el **ADR 0016** —DEMO en el droplet viejo— y el **ADR 0017**
> lo invirtió el mismo día: **todo se concentra en el PADRE**. Con el 0016,
> `F4.2` estaba pendiente y `F4.3` cumplida; con el 0017 es **exactamente al
> revés**, porque la base de DEMO ya existe en el PADRE y el dominio de DEMO
> todavía apunta a la otra máquina.
>
> El ADR se actualizó y **este documento no**. Es el mismo defecto que ya se
> corrigió hoy con `F4.1`, que siguió diciendo «IMPOSIBLE» en cinco sitios
> después de cerrarse. **Cerrar algo no es cambiar su fila.**

> [!warning] `F4.2` VUELVE a pendiente, y conviene entender por qué
> El 24/08 se creó y migró `spaces_demo` **en el PADRE**, y su criterio se
> cumplió allí. **Bajo el ADR 0016 esa base ya no es DEMO**, así que el criterio
> hay que volver a cumplirlo — esta vez en `209.97.146.136`.
>
> **Lo que NO se pierde de aquel trabajo:** demostró el runner de la **Fase 3**
> aplicando 71 migraciones y negándose a repetirlas **en un servidor real**. Eso
> era sobre el runner, no sobre la máquina, y sigue en pie.

---

## 2 · Los anclajes

Los trece hashes se comprobaron con `git log -1 --format='%ad · %s'` el
**2026-08-24**. Los trece existen y dicen lo que este documento afirma.

| Commit | Fecha | Asunto |
|---|---|---|
| `6cb16d4` | 14/08 | feat(migraciones): cada instancia lleva registro de lo que ya aplico |
| `d31a7b8` | 17/08 | fix(migraciones): --instalacion-nueva se comprueba, en vez de creerse |
| `dc6df52` | 17/08 | feat(migraciones): reescribir una migracion aplicada detiene la actualizacion |
| `acbbe0b` | 17/08 | feat(instancias): update.sh jala el canal, respalda, migra y se devuelve solo si falla |
| `8151772` | 17/08 | fix(instancias): update.sh decide la vuelta atras mirando la base, no la prosa del runner |
| `2633bcb` | 18/08 | fix(instancias): el health check de update.sh deja de tirar releases sanos |
| `f369b4c` | 18/08 | feat(instancias): el respaldo viaja a spaces… |
| `84c6c20` | 18/08 | feat(instancias): el pull reintenta con backoff, la migracion no reintenta nunca |
| `70b8cc5` | 18/08 | fix(instancias): el log del update deja de mezclar corridas… |
| `a490dd3` | 19/08 | fix(instancias): la clave de la base tambien viajaba en la consulta de la URL |
| `32042e5` | 19/08 | fix(seguridad): la conexion a Postgres deja de viajar como URL a pg_dump |
| `8f81c3e` | 20/08 | fix(seguridad): el = percent-encoded publicaba la contrasena en el log… |
| `3872d61` | 20/08 | fix(seguridad): la poda del separador pasa a lista BLANCA… |

---

## 3 · Evidencia de la Fase 3

### 3.1 · La primera evidencia de servidor, y salió gratis

Aprovisionar una base en el PADRE el 24/08 fue **la primera vez que el runner de
migraciones corrió en un servidor de verdad**. Hasta entonces solo se había
probado contra el Postgres del 5433 y `spaces_e2e`.

```
$ migrar.mjs --instalacion-nueva
--instalacion-nueva verificada: ninguna de las 11 tablas que solo crean las
  migraciones existe en esta base.
  omitida (migracion de DATOS, pidela con --con-datos): 20260731_calendario_meses_cortos.sql
[... 71 lineas ...]
71 aplicadas, 1 de datos pendientes.

$ migrar.mjs            # segunda corrida
0 aplicadas, 1 de datos pendientes.
```

**`0 aplicadas` es `F3.1` y `F3.2` demostradas fuera de local.** Y la guarda de
`--instalacion-nueva` **se verificó a sí misma** antes de tocar nada: eso es
`F3.2` haciendo lo suyo —la bandera se comprueba, no se cree— en la única
situación donde importa.

> **71 y no 72, y el «esperado: 72» de la 1.ª emisión estaba mal.**
> `20260731_calendario_meses_cortos.sql` lleva `-- @tipo: datos` y el runner la
> omite salvo `--con-datos` (`migrar.mjs:717-721`), igual que `deploy.yml`:
> las de datos **reescriben filas y no se deshacen solas**. Esa realinea cuotas
> **preexistentes**, así que en una base nueva sería un no-op.
>
> Eran **dos números distintos**: **72 archivos** en disco y **71 aplicadas**. El
> runner **nombra** la que omite, a propósito — *«una migración que no se aplica y
> que nadie menciona es una que se olvida»* (`migrar.mjs:713-715`).

### 3.2 · Lo que costó de verdad: `F3.9` pidió cuatro intentos

La tarea era que el log del update se leyera sin entrar al servidor. Lo caro fue
que **subirlo tal cual habría incumplido su propio criterio**: `update.log` ya
llevaba salida cruda del runner, de `pg_dump`, de `pg_restore` y de
`docker logs`.

La solución no fue añadir una subida, sino **separar lo que emite el script de lo
que emiten sus herramientas**. Viaja `update-publicable.log`; se queda
`update.log`, crudo. **Sin lista de palabras prohibidas ni filtro por regex, a
propósito**: un filtro se olvida de un caso y nadie se entera.

`d540833` 🔴 → `70b8cc5` 🟡 → `6fb93ec` 🔴 → `a490dd3` → **cerrado con `8f81c3e`**,
endurecido después por `3872d61` (la poda pasó a **lista blanca**).

**La decisión de fondo fue de Jochelo el 19/08 (M3):** arreglar en el **origen**.
`pg_dump`/`pg_restore` dejaron de recibir un `--dbname` con la URL y pasaron a
**cuatro banderas sueltas**. El invariante está en el propio archivo
(`update.sh:905-911`), y su razón también:

> *«Una lista negra sobre un espacio de nombres que se decodifica no se puede
> demostrar completa. Siempre queda otra codificación. Reconstruir la conexión sí
> se puede demostrar.»*

### 3.3 · El arnés, y su factura declarada

Llegó a **98 escenarios · 641 comprobaciones · 0 rojas**, con mutantes dirigidos.

Y trae una factura escrita: la barrida completa de mutación **ya no cabe en un
ciclo** —medido el 18/08, pasa de **10 horas**—. Se resolvió en **M1**: no se
exige por ciclo, y **cada ciclo declara qué no corrió**.

### 3.4 · 🛑 `F3.6` — su criterio, medido, **no se cumple**

Criterio: *«no queda en el repo ningún camino que entre por SSH a una instancia a
compilar»*, verificable con `rg -n "appleboy/ssh-action|pm2 reload" .github/` →
sin resultados (`plan:1122`).

**Corrido el 2026-08-24:**

```
.github/workflows/deploy.yml:68:        uses: appleboy/ssh-action@v1
.github/workflows/deploy.yml:171:            como_app "pm2 reload $PM2_APP"
.github/workflows/deploy.yml:185:              echo "SMOKE TEST FALLIDO. Rollback: ... pm2 reload."
```

**Tres donde exige cero.** No es un defecto: la tarea **no se ha hecho, y no debe
hacerse todavía**.

> **Y el ADR 0016 le añade una segunda razón para esperar.** DEMO se queda en un
> droplet que corre código del 11/08. **Hoy, la única forma de actualizarlo es
> `deploy.yml`** — justo lo que F3.6 retira. Retirarlo ahora dejaría a DEMO sin
> vía de actualización hasta que exista el canal `beta`. **Contradicción
> declarada, no resuelta.**

### 3.5 · Lo que sí cambió desde el expediente de la Fase 2

Aquel afirmaba, el 14/08, que *«no existen `release.yml` ni `promover.yml`»*. **Ya
existen** — corresponde a `F2.3` y `F2.4`. **Lo que sigue sin existir es el
registry al que publicarían.**

---

## 4 · Evidencia de la Fase 4

### 4.1 · `F4.1` — cerrada, y desmonta la premisa del 24/08

Censo completo el 25/08, todo solo lectura. Documento íntegro en
**`docs/evidencias/f4-1-censo-resultado.md`**. Lo esencial:

| Dato | Valor |
|---|---|
| Identidad | `PIXELED-ubuntu-s-2vcpu-4gb-nyc3` · `209.97.146.136` |
| Commit desplegado | `504b4fc` (11/08), **en `main`** — la condición de parada **no se dispara** |
| Proceso | `online`, 13 días, **como `emiliano`, no root** |
| Dominios | `demo.space-os.io` + `server_name _;` |
| Certificado | `demo.space-os.io`, vence **2026-10-26**, válido |
| `APP_URL` · `COOKIE_SECURE` | `https://demo.space-os.io` · `1` |
| Autoregistro | `NEXT_PUBLIC_AUTOREGISTRO=0` — la variante **vieja**, horneada |
| Tenants | `rgb`, `telcel`, `g500`, `eyro`, `demo-owner` — **todos de julio** |
| Migraciones en disco | **66**, las de `main` |
| `POST /api/auth/login/` | **401** |

**Ese 401 es el dato que no se puede fingir**, y no lo pedía el plan. Se añadió
por lo aprendido con el PADRE el mismo día. **Esa máquina funciona de verdad.**

### 4.2 · `F4.3` — ya está cumplida, y no había que hacer nada

El criterio de F4.3 es que DEMO tenga **su dominio y su certificado**. Bajo el ADR
0016 los tiene desde julio: `demo.space-os.io` resuelve a su droplet, nginx lo
sirve y el certificado es válido **y renovable**.

### 4.3 · `F4.4` — media hecha

**La bandera ✅**: el autoregistro está cerrado en esa máquina, desde el build.
Es lo que explica limpiamente el `503` de **F0.1**.

**Los datos de juguete ⏳**: falta la semilla, y va después de recrear la base.

### 4.4 · Lo que el ensayo local no puede decir

Con el mismo tamaño de letra que lo anterior:

- **La base local es un *fixture*.** Un `count(*)` en cero puede ser un **cero
  vacuo** —no hay nada que mirar—, no una base limpia.
- **Nadie ha visto el botón «Crear cuenta» ausente en un navegador real.** El
  ensayo de `F2.5` cerró el 503 del endpoint; la **hidratación** quedó fuera. Es
  el único eslabón que ninguna prueba automática puede cerrar.

---

## 5 · El PADRE — un hallazgo que no es de estas fases pero las condiciona

**El PADRE llevaba desde el 21/08 sirviendo un login que no podía autenticar a
nadie.** Medido el 25/08:

| Qué | Antes | Después |
|---|---|---|
| `POST /api/auth/login/` | **500** | **401** |
| `DATABASE_URL` en el proceso | ausente | presente |
| `.env.production` | **644** | **600** |

**Por qué no se quejaba:** `apps/web/lib/server/db.ts:23-24` se cae a un valor por
omisión que apunta al Postgres de **desarrollo** (`localhost:5433`). La app
arranca, pinta el login y devuelve 200.

> [!danger] «login 200» se usó como prueba de vida en cuatro documentos
> Estaba en `docs/Traspaso_20260824.md`, en `entorno-y-despliegue`, en
> `docs/Expediente_Fases_0_a_4.md` y en el diario del 24/08. **Era una página
> pintándose.** Los cuatro llevan ahora aviso fechado, con el cuerpo intacto.
>
> Lo mismo el `signup 503` de **F0.1** y **F2.5**: ese 503 lo devuelve el guard
> **antes** de tocar la base.
>
> **El humo del propio runbook (§7) tiene el mismo agujero.** Un smoke sin una
> petición que toque la base deja pasar exactamente esto — y es el que se va a
> correr en cada droplet de la Fase 5.
>
> **Lo que NO se cae:** lo medido con `psql` contra la base. Se cae lo medido **a
> través de la app**.

---

## 6 · Desviaciones declaradas frente al plan

| # | El plan dice | Lo que se hace | Por qué |
|---|---|---|---|
| 1 | `F4.4`: autoregistro **encendido**, `signup` → `400` (`:1345,:1351`) | `AUTOREGISTRO=0`, `signup` → **503** | **P8**: nadie crea su propia cuenta, ni en DEMO |
| 2 | `F4.5` criterio 4: DEMO suscrita al canal `beta` | **No se cumple** | No hay canal. **TH-P4** |
| 3 | `F4.1`: bloqueante de `F4.2` y `F7.1` | Se cerró **después** de F4.2 | La declaración de imposible del 24/08 alteró el orden. Sin consecuencia: F4.2 hay que rehacerla igual |
| 4 | `F5.4` y `F5.7` marcadas bloqueadas por §8.2 y §8.3 | **No lo están** | Las dos decisiones se cerraron el 20/08 (`ejecucion-plan-v3.md:39`). El texto del plan está desfasado |

---

## 7 · Lo que falta, y quién

### Para cerrar la Fase 4 — dos bloques, los dos en el PADRE

**Bloque A · levantar DEMO** (`docs/evidencias/bloque-2-comandos.txt`) → cierra **F4.4**

1. Usuario `demo` del sistema y `/etc/space-os/demo.env` a `600`.
2. `pm2 start ecosystem.demo.config.js` — el proceso en el **3001**, con su usuario.
3. Alta del Dueño de la demo con `bootstrap-auth.mjs`, **slug `demo`**.
4. La semilla `20260824_semilla_demo.sql`.
5. Verificación **por dentro**: `login 200` y `signup 503` contra `127.0.0.1:3001`.

**Bloque B · el dominio de DEMO** → cierra **F4.3** y dos criterios de **F4.5**

6. Certificado de `demo.space-os.io` en el PADRE. **Ya es fácil**: `space-os.io.conf`
   está enlazado y trae el hueco ACME, así que la máquina vieja solo tiene que
   **reenviar** el desafío — sin que nadie pulse Enter a tiempo.
7. Mover el registro A de `demo.space-os.io` al PADRE.
8. Verificación **por fuera**, y el botón «Crear cuenta» ausente en un navegador real.

**Antes del bloque A, una comprobación de una línea:** `spaces_demo` tiene que
tener las **72** migraciones aplicadas, igual que `spaces_prod`. La 73 se aplicó
a `spaces_prod` con seguridad; en `spaces_demo` **no está confirmado**.

```
sudo -u postgres psql -d spaces_demo -Atc "select count(*) from schema_migrations"
```

El criterio 4 queda como **desviación declarada** hasta que exista el registry.

### Para el PADRE — no es Fase 4, pero está a medio terminar

| | |
|---|---|
| ~~Certificado para `space-os.io`~~ | ✅ **HECHO el 25/08.** Por `--standalone`, vence el **23/11**, con **renovación automática** configurada por certbot |
| ~~Decidir el proxy de Cloudflare~~ | ✅ **En GRIS desde el 25/08.** Con naranja, `$remote_addr` habría sido una IP de Cloudflare para todos y el limitador de login (`rate-limit.ts:32-36`) habría bloqueado a todo el mundo a la vez |
| ~~nginx~~ | ✅ **Enlazado el 25/08**, `padre-ip` retirado. Medido **por el nombre**: `raiz 302 · login 200 · login-post 401` — el stack completo, por primera vez |
| ~~`GOOGLE_REDIRECT_URI`~~ | ✅ **HECHO el 25/08.** Y con él salieron tres defectos más, todos invisibles hasta intentar entrar: el `GOOGLE_CLIENT_ID` sin su primer carácter, `APP_URL` ausente, y la barra final de la URI registrada |
| El proceso corre como **root** | ⏳ Tarea abierta desde el 24/08 — **lo único que le queda al PADRE** |
| `spaces_demo` en el PADRE | Sin uso bajo el ADR 0016. Se puede tirar |

### Bloqueos que no son trabajo

| Bloqueo | Detiene | Quién |
|---|---|---|
| **TH-P4 · el registry** (desde el 17/08) | **F3.5, F3.6**, el criterio 4 de F4.5, y **F5.5, F5.6, F5.7** | Jochelo |

### Tareas abiertas que este expediente no cierra

1. 🔴 **El valor por omisión de `db.ts`.** Una instancia sin `DATABASE_URL`
   debería **negarse a arrancar**. Peor: si alguien levanta el `docker-compose`
   en esa máquina, el 5433 **sí** responde y la app hablaría con una base de
   desarrollo creyendo que es la suya. **Es el mismo fallo que acaba de morder al
   PADRE, y en la Fase 5 se repetiría en cada droplet.** Alto contacto.
2. **El humo del runbook** tiene que incluir una petición que toque la base.
3. **Los códigos de recuperación del Dueño** — decididos el 20/08, **no
   construidos**. Verificado: sin resultados en `apps/web` ni en `db/`.
4. **D4** — una migración fallida deja la base sin recobro. Declarado *«tarea
   propia, antes de la Fase 5»*.
5. **El `GOOGLE_CLIENT_SECRET` expuesto el 25/08.** Decidido no rotarlo: es la
   cuenta de pruebas. Se sustituye **cuando exista la cuenta real**.

---

## 8 · Verificación global

**⧗ Pendiente de re-medir al cierre.** Cifras del **2026-08-24**, con su
procedencia en vez de darse por vigentes.

| Suite | Cifra | Procedencia |
|---|---|---|
| Unitarias | **842** en 77 archivos | corrida del 24/08 |
| e2e | **20 archivos · 213 pruebas · 1 saltada** | corrida del 24/08 |
| `typecheck` | limpio | corrida del 24/08 |
| `aislamiento.e2e.test.ts` | **pasa sin tocarse** | corrida del 24/08 |
| Migraciones | **72** archivos · **71** aplicables | 24/08 |

```
cd apps/web && npm run typecheck && npm test && npm run build && npm run test:e2e
```

> Las e2e **exigen el build hecho antes**, o fallan las 20 en falso y tardan
> 636 s. El rojo no diría nada del código: diría que falta el build.

---

## 9 · Nota de entorno

- La rama **no está fusionada a `main`** y va **209 commits** por delante. `main`
  tiene **66** migraciones; esta rama, **72**.
- El remoto vivo es **`emiliano`**. `origin` está muerto — salvo **en los
  droplets**, donde `origin` **sí** apunta al vivo. El mismo nombre significa
  cosas distintas según dónde estés.
- Las tres bases —5433, `spaces_e2e` y las de los droplets— son **datos de
  prueba**. Se recrean sin preguntar. ⚠️ Deja de valer con el primer cliente de
  pago.

---

## 10 · Registro de emisiones

| Emisión | Fecha | HEAD | Qué cambió |
|---|---|---|---|
| 1.ª | 2026-08-24 | `a858c15` | Apertura, con la evidencia local medida y 31 huecos de captura |
| **2.ª** | **2026-08-25** | — | **F4.1 cerrada** y el acceso recuperado → **ADR 0016**, DEMO se queda en su droplet. El hallazgo del PADRE sin base. `F4.3` pasa a cumplida, `F4.2` vuelve a pendiente. Corregido el «72 aplicadas» a **71** |

# Instancias Soberanas · Fases 3 y 4 — Expediente conjunto de cierre **PARCIAL**

Rama: `feat/servidor-padre-instancias` (worktree `.claude/worktrees/servidor-padre`)
Fecha de apertura: **2026-08-24** · HEAD al abrir el expediente: `a858c15`
Plan de autoridad: `docs/Plan_Instancias_Soberanas_v3.md` §FASE 3 (`:917-1228`) y
§FASE 4 (`:1230-1434`)

> [!important] Por qué las dos fases van en un solo expediente
> **No se pueden contar por separado.** `F3.5` depende de `F4.5` (`plan:1080`,
> decisión **P5**), y `F4.5` arrastra una desviación que nace en la Fase 3 —el
> canal `beta`—. Separarlas obligaría a que cada documento remitiera al otro para
> explicar su propio bloqueo. Este expediente sustituye a los `fase-3.md` y
> `fase-4.md` que nunca se emitieron.

> [!note] Qué relación tiene con `docs/Expediente_Fases_0_a_4.md`
> Ese documento, del **21/08**, cubre las 28 tareas de las Fases 0 a 4 y **sigue
> siendo válido para las Fases 0, 1 y 2**. Sus secciones de Fase 3 y Fase 4
> **quedaron superadas** el 24/08 al perderse el droplet: dan `F4.1` por
> pendiente cuando es imposible, ponen DEMO en una máquina aparte y cuentan 70
> migraciones. **Para esas dos fases manda este documento**, y aquel lleva un
> aviso arriba que lo dice.

> [!danger] **NINGUNA de las dos fases está completa.** Esto es un cierre parcial.
> **Fase 3:** de sus **9** tareas, **7 están hechas en local** y **dos siguen
> bloqueadas**: `F3.5` (ensayo completo en DEMO) exige publicar en el canal
> `beta`, y ese canal no existe sin **TH-P4** — el registry, parado desde el
> 17/08. `F3.6` depende de `F3.5`.
>
> **Fase 4:** de sus **5** tareas, `F4.1` es **IMPOSIBLE** —se perdió el acceso a
> la máquina que había que censar— y `F4.5` cierra con **3 de 4 criterios**: el
> cuarto es el canal `beta`, o sea el mismo bloqueo.
>
> **Un solo bloqueo, TH-P4, es lo que impide cerrar las dos.**

> [!warning] Estado de este documento: **ABIERTO, esperando la corrida en el servidor**
> Todo lo marcado **⧗ C\<n\>** espera la salida de la hoja
> `docs/evidencias/captura-f3-f4.md`, que corre una persona sobre el PADRE. Lo
> que ya está escrito **está medido**; lo que falta está señalado como falta, no
> dado por bueno.

Este documento es histórico: registra lo que era cierto en su fecha. La
descripción de cómo funciona el sistema hoy vive en `vault/` y caduca; esto no.

---

## 1. El cuadro de las dos fases

### Fase 3 · `update.sh` + runner de migraciones

| Tarea | Tipo | Estado | Commit(s) | Veredicto |
|---|---|---|---|---|
| **F3.1** · tabla `schema_migrations` y backfill | migración | COMPLETADA_LOCAL | `6cb16d4` (14/08) | AMARILLO |
| **F3.2** · runner idempotente, con el orden correcto | código | COMPLETADA_LOCAL | `d31a7b8` (17/08, 3.er ciclo) | AMARILLO, auditada |
| **F3.3** · una migración alterada aborta el update | código | COMPLETADA_LOCAL | `dc6df52` (17/08) | AMARILLO, auditada |
| **F3.4** · `update.sh`, el pull de la instancia | infra | **ENSAYADA_LOCAL** | `acbbe0b` · `8151772` · `2633bcb` | 2.º ensayo, 18/08 |
| **F3.5** · ensayo completo en DEMO | verificación | 🛑 **BLOQUEADA** | — | espera **TH-P4** |
| **F3.6** · retirar el despliegue por SSH | release | 🛑 **BLOQUEADA** | — | depende de F3.5 |
| **F3.7** · el respaldo sale del droplet | infra | COMPLETADA_LOCAL | `f369b4c` (18/08) | AMARILLO |
| **F3.8** · reintentos con backoff, y un límite | infra | COMPLETADA_LOCAL | `84c6c20` (18/08) | AMARILLO |
| **F3.9** · el log del update se lee sin entrar al servidor | infra | COMPLETADA_LOCAL | `a490dd3` · `32042e5` · `8f81c3e` · `3872d61` | 🔴 → cerrado 20/08 |

### Fase 4 · separar DEMO como instancia real

| Tarea | Tipo | Estado | Qué falta |
|---|---|---|---|
| **F4.1** · censo del droplet actual | verificación | 🛑 **IMPOSIBLE** (24/08) | Nada. Se perdió el acceso |
| **F4.2** · droplet y base de DEMO | infra | ENSAYADA_LOCAL (19/08) | ⧗ **C15–C18** |
| **F4.3** · dominio y certificado | infra | PENDIENTE_SERVIDOR | ⧗ **C5–C14** |
| **F4.4** · datos y bandera | infra | ENSAYADA_LOCAL (19/08) | ⧗ **C19–C24** |
| **F4.5** · smoke y cierre del riesgo | verificación | smoke local en verde | ⧗ **C25–C27**, 3 de 4 criterios |

> **`COMPLETADA_LOCAL` y `ENSAYADA_LOCAL` no son lo mismo, y la diferencia tiene
> que sobrevivir a este documento.** La segunda significa que **la parte real
> sigue sin hacerse**: se ensayó el procedimiento en esta máquina, contra bases y
> contenedores de juguete. Ninguna de las dos dice nada sobre el servidor.

---

## 2. Lo que se creó, verificado con `git log`

Todos los hashes citados en este expediente se comprobaron con
`git log -1 --format='%ad · %s' --date=short <hash>` el **2026-08-24**. Los trece
existen y dicen lo que este documento afirma que dicen.

| Commit | Fecha | Asunto |
|---|---|---|
| `6cb16d4` | 14/08 | feat(migraciones): cada instancia lleva registro de lo que ya aplico |
| `d31a7b8` | 17/08 | fix(migraciones): --instalacion-nueva se comprueba, en vez de creerse |
| `dc6df52` | 17/08 | feat(migraciones): reescribir una migracion aplicada detiene la actualizacion |
| `acbbe0b` | 17/08 | feat(instancias): update.sh jala el canal, respalda, migra y se devuelve solo si falla |
| `8151772` | 17/08 | fix(instancias): update.sh decide la vuelta atras mirando la base, no la prosa del runner |
| `2633bcb` | 18/08 | fix(instancias): el health check de update.sh deja de tirar releases sanos |
| `f369b4c` | 18/08 | feat(instancias): el respaldo viaja a spaces, no se queda en el droplet que puede morir |
| `84c6c20` | 18/08 | feat(instancias): el pull reintenta con backoff, la migracion no reintenta nunca |
| `70b8cc5` | 18/08 | fix(instancias): el log del update deja de mezclar corridas… |
| `a490dd3` | 19/08 | fix(instancias): la clave de la base tambien viajaba en la consulta de la URL |
| `32042e5` | 19/08 | fix(seguridad): la conexion a Postgres deja de viajar como URL a pg_dump |
| `8f81c3e` | 20/08 | fix(seguridad): el = percent-encoded publicaba la contrasena en el log… |
| `3872d61` | 20/08 | fix(seguridad): la poda del separador pasa a lista BLANCA, y se cierra la puerta del %3F |

**Nacidos para la Fase 4, todos el 24/08:** `infra/nginx/space-os.io.conf`,
`infra/nginx/snippets/proxy-app.conf`, `ecosystem.demo.config.js`,
`docs/datos/20260824_semilla_demo.sql`, `docs/adr/0015-demo-dentro-del-padre.md`,
`docs/Runbook_Cierre_Fase4_DEMO.md`.

---

## 3. Evidencia de la Fase 3 — lo que ya está probado, y con qué

### 3.1 · Lo que costó de verdad: `F3.9` pidió cuatro intentos

La tarea era que el log del update se pudiera leer sin entrar al servidor. Lo que
la volvió cara fue que **subir el log tal cual habría incumplido su propio
criterio**: `update.log` ya llevaba salida cruda —del runner, de `pg_dump`, de
`pg_restore` y de `docker logs` del contenedor nuevo—.

La solución no fue añadir una subida, sino **separar lo que emite el script de lo
que emiten sus herramientas**: `registrar` escribe en los dos logs, `eco` solo en
el local. Viaja `update-publicable.log`; se queda `update.log`, crudo y acumulado.
**Sin lista de palabras prohibidas ni filtro por regex, a propósito**: un filtro
se olvida de un caso y nadie se entera.

Historia del color: `d540833` ROJO → `70b8cc5` AMARILLO → `6fb93ec` ROJO →
`a490dd3` → **cerrado el 20/08 con `8f81c3e`**, y después endurecido por
`3872d61` (la poda pasó a **lista blanca**).

**La decisión de fondo fue de Jochelo el 19/08 (M3):** arreglar en el **origen**,
no en el mensaje. `pg_dump`/`pg_restore` dejaron de recibir un `--dbname` con la
URL y pasaron a **cuatro banderas sueltas** (`-h -p -U -d`), con todo lo demás por
variables `PG*`. El invariante está escrito en el propio archivo
(`infra/scripts/update.sh:905-911`): *«en `argv` no aparece nada que venga del
`userinfo` ni de la consulta, bajo ninguna codificación»*.

> **Por qué esa forma y no un filtro:** *«una lista negra sobre un espacio de
> nombres que se decodifica no se puede demostrar completa. Siempre queda otra
> codificación. Reconstruir la conexión sí se puede demostrar»*
> (`update.sh:901-903`).

### 3.2 · El arnés de `update.sh`, y su factura

El arnés de pruebas de `update.sh` llegó a **98 escenarios · 641 comprobaciones ·
0 rojas**, con mutantes dirigidos.

**Y trae una factura declarada:** la barrida completa de mutación **ya no cabe en
un ciclo**. Medido el 18/08 —~25 min por mutante en esta máquina—, pasa de **10
horas**. Se resolvió en **M1**: no se exige por ciclo, y **cada ciclo declara qué
no corrió**. La primera consecuencia real de esa decisión ya llegó, y está
anotada en el tablero.

### 3.3 · 🛑 `F3.6` — su criterio, medido hoy, **NO se cumple**

El criterio es *«no queda en el repo ningún camino que entre por SSH a una
instancia a compilar»*, y su comando de verificación es
`rg -n "appleboy/ssh-action|pm2 reload" .github/` → sin resultados (`plan:1122`).

**Corrido el 2026-08-24 sobre `a858c15`:**

```
.github/workflows/deploy.yml:68:        uses: appleboy/ssh-action@v1
.github/workflows/deploy.yml:171:            como_app "pm2 reload $PM2_APP"
.github/workflows/deploy.yml:185:              echo "SMOKE TEST FALLIDO. Rollback: ... pm2 reload."
```

**Tres resultados donde el criterio exige cero.** No es un defecto: es que la
tarea **no se ha hecho**, y **no debe hacerse todavía** — el plan avisa de que
retirarlo antes de tiempo es **riesgo alto**, porque mientras el despliegue viejo
sea el único mecanismo, quitarlo deja sin salida (`plan:1126-1129`).

Se deja medido aquí para que el día que se cierre F3.6 se pueda comparar contra un
número, y no contra un recuerdo.

### 3.4 · Lo que sí cambió desde el expediente de la Fase 2

`docs/evidencias/fase-2.md` afirmaba, el 14/08, que *«no existen `release.yml` ni
`promover.yml`»*. **Ya existen.** Medido hoy, `.github/workflows/` contiene:

```
ci.yml   deploy.yml   lockfile-check.yml   promover.yml   release.yml
```

Es lo que corresponde a `F2.3` y `F2.4` completadas en local. **Lo que sigue sin
existir es el registry al que publicarían** — TH-P4.

---

## 4. Evidencia de la Fase 4 — lo que está probado en local

### 4.1 · `F4.1` es imposible, y eso se declara, no se ignora

Es un censo de solo lectura del droplet `209.97.146.136`. **Se perdió el acceso a
esa máquina el 2026-08-24.** No es una tarea que espere turno: no se puede hacer.

El plan la declara bloqueante de `F4.2` y `F7.1` (`plan:1241`). **Un bloqueo que
nadie puede levantar no es un bloqueo, es un punto muerto**, así que se retira
declarándolo. La consecuencia arrastrada: la **Fase 7 se queda sin objeto**, y
`F7.1` es otro censo de esa misma máquina.

### 4.2 · La semilla de DEMO, probada de punta a punta

`docs/datos/20260824_semilla_demo.sql` siembra 2 arrendadores y 6 pantallas
inventadas. Es idempotente y trae **tres guardas**: se niega si la base no se
llama `spaces_demo`, si no existe la organización `demo`, o si en esa base hay un
tenant `rgb` —porque entonces el criterio de `F4.5` no se podría cumplir—.

**Probada contra Postgres 16 el 24/08**, incluidas las tres guardas y la vuelta
atrás.

### 4.3 · Lo que el ensayo local **no** puede decir

Con el mismo tamaño de letra que lo anterior:

- **La base local es un *fixture*.** Un `count(*)` que da cero en local puede ser
  un **cero vacuo** —no hay nada que mirar—, no una base limpia. El cero que
  vale es el del **C15** y el **C18**, contra `spaces_demo` en el PADRE.
- **Nadie ha probado que el certificado, nginx y la app funcionen juntos.** Cada
  pieza está escrita y revisada; el conjunto no se ha ejecutado nunca. Para eso
  existe el gate **C12**, y para eso se estrena en el ápice.
- **Nadie ha visto el botón «Crear cuenta» ausente en un navegador real.** El
  ensayo de `F2.5` cerró el 503 del endpoint, pero la **hidratación** en un
  navegador de verdad quedó fuera. Es el **C24**, y es el único eslabón que
  ninguna prueba automática puede cerrar.

---

## 5. La corrida en el servidor — ⧗ pendiente

Cada hueco espera su captura de `docs/evidencias/captura-f3-f4.md`. **No se
rellena de memoria ni se parafrasea: va la salida literal, incluidos los errores.**

| | Qué demuestra | Estado |
|---|---|---|
| **C0** | La zona `space-os.io` la sirve Cloudflare — **de esto depende que el DNS-01 sea posible** | ⧗ |
| **C1** | Se está operando el PADRE y no otra máquina | ⧗ |
| **C2** | 🚦 El PADRE trae la migración 72, no las 66 de `main` | ⧗ |
| **C3** | A dónde apuntaba el DNS **antes** — evidencia del criterio 3 de F4.5 | ⧗ |
| **C4** | DOOHmain: si la máquina perdida sigue publicando a pantallas reales | ⧗ |
| **C5** | El token de Cloudflare, y si lleva caducidad | ⧗ |
| **C6** | 🚦 El certificado en `--dry-run`, sin quemar cuota | ⧗ |
| **C7** | El certificado emitido | ⧗ |
| **C8** | 🚦 El certificado cubre los dos nombres y está vigente — **F4.3** | ⧗ |
| **C9** | nginx enlazado desde el repositorio, y `nginx -t` | ⧗ |
| **C10** | nginx recargado | ⧗ |
| **C11** | El ápice resuelve al PADRE | ⧗ |
| **C12** | 🚦 El stack entero sirviendo: `302` en raíz, `200` en login | ⧗ |
| **C13** | Fechas del certificado servido de verdad | ⧗ |
| **C14** | `demo.space-os.io` reapuntado — **la máquina perdida pierde su nombre** | ⧗ |
| **C15** | `spaces_demo` nace vacía: `0` tenants antes de migrar — **F4.2** | ⧗ |
| **C16** | Las 72 migraciones aplicadas en un servidor real | ⧗ |
| **C17** | Idempotencia: segunda corrida, `0` aplicadas — **F3.1 y F3.2** | ⧗ |
| **C18** | `spaces_app\|f\|f` y `0` organizaciones — **criterio de F4.2** | ⧗ |
| **C19** | `/etc/space-os/demo.env` a `600` y de `demo` | ⧗ |
| **C20** | `spaces-demo` en el 3001, con usuario `demo` y no root | ⧗ |
| **C20a** | El login del 3001 contesta `200` **sin dominio ni nginx de por medio** | ⧗ |
| **C21** | El alta del Dueño por `bootstrap-auth.mjs`, slug `demo` | ⧗ |
| **C22** | La semilla: `2 arrendadores · 6 pantallas · 5 disponibles` | ⧗ |
| **C23a** | `signup` del 3001 → **503**, comprobado por dentro — **F4.4** | ⧗ |
| **C23** | `signup` → **503** por el nombre público — la misma prueba, por fuera | ⧗ |
| **C24** | El botón «Crear cuenta» ausente **en un navegador real** | ⧗ |
| **C25** | Los dos nombres resolviendo al PADRE — **criterio 1 de F4.5** | ⧗ |
| **C26** | `spaces_demo` ∩ `spaces_prod` = ∅ — **criterio 2 de F4.5** | ⧗ |
| **C27** | Con qué usuario corre cada proceso — la trampa del root, medida | ⧗ |
| **C28** | `schema_migrations` con 72 filas en un servidor real — **Fase 3** | ⧗ |

> [!important] La hoja se reordenó en dos etapas — y no es cosmético
> **Etapa 1** levanta DEMO entera y la verifica **por dentro** (`127.0.0.1:3001`),
> con el DNS sin tocar. **Etapa 2** hace el dominio y vuelve a verificar por fuera.
>
> El orden anterior —heredado del runbook— reapuntaba `demo.space-os.io` al PADRE
> **antes** de arrancar el proceso del 3001, así que entre esos dos pasos nginx
> proxeaba a un puerto donde no escucha nadie: **502 en un nombre público con
> visitantes**. Arrancando DEMO primero, esa ventana no existe.
>
> Efecto secundario, y es una mejora de la evidencia: cada criterio de F4.4 queda
> comprobado **dos veces**, por dentro y por fuera. Si difieren, el culpable es
> nginx o el DNS y no la aplicación — y eso antes no se podía distinguir.
>
> **Los identificadores `C<n>` no se renumeraron**: son estables porque este
> expediente los cita. En la hoja van salteados a propósito.

### 5.1 · La primera evidencia de servidor que tendrá la Fase 3

Merece decirse aparte, porque no está en el plan y sale gratis: **aprovisionar
DEMO es la primera vez que el runner de migraciones de la Fase 3 corre en un
servidor de verdad.** Hasta hoy `F3.1`, `F3.2` y `F3.3` solo se habían probado
contra el Postgres del 5433 y contra `spaces_e2e`.

Los **C16**, **C17** y **C28** son, sin costar un paso extra, evidencia real de la
Fase 3 — la única que va a poder tener mientras TH-P4 siga parado.

---

## 6. Desviaciones declaradas frente al plan

Ninguna es un descuido. Las cuatro se decidieron, y aquí quedan con su motivo.

| # | El plan dice | Lo que se hace | Por qué |
|---|---|---|---|
| 1 | `F4.2`: DEMO en **su propio droplet** | DEMO **dentro del PADRE** | Se perdió el droplet viejo y no se contrata otro. **ADR 0015** |
| 2 | `F4.4`: autoregistro **encendido**, `signup` → `400` (`plan:1345,1351`) | `AUTOREGISTRO=0`, `signup` → **503** | **P8**: nadie crea su propia cuenta en ninguna instancia, ni en DEMO |
| 3 | `F4.5` criterio 3: «el viejo ya no sirve ese nombre» | Se cumple **por sustitución**, no por apagado | La máquina no se puede apagar. Reapuntar el DNS es la única palanca, y es comprobable con un `dig` |
| 4 | `F4.5` criterio 4: DEMO suscrita al canal `beta` | **No se cumple** | No hay canal. **TH-P4** |

> [!warning] La desviación 1 no cierra el riesgo de la Fase 4: **lo transforma**
> `F4.5` se titula «cierre del riesgo» y su objetivo literal es dejar por escrito
> que *«demo pública = producción»* dejó de ser cierto. Lo que queda en su lugar
> es **«demo pública = plano de control»**: la misma máquina que guarda el super
> admin de toda la flota y, desde la Fase 5, las llaves de cada droplet.
>
> Nombre, puerto, base, proceso y usuario distintos **no son aislamiento**:
> comparten kernel, disco y red. **Aceptado a sabiendas el 24/08**, con tres
> disparadores escritos para volver a mirarlo (ADR 0015 §«Cuándo revisar»).

---

## 7. Lo que espera a una persona, y qué desbloquea cada cosa

| Qué | Quién | Desbloquea |
|---|---|---|
| Correr `docs/evidencias/captura-f3-f4.md` sobre el PADRE | persona con acceso | **F4.2, F4.3, F4.4, F4.5** (3 de 4) |
| **TH-P4 · el registry** — parado desde el **17/08** | Jochelo | **F3.5, F3.6**, el criterio 4 de F4.5, y **F5.5** |
| Comprobar en **DOOHmain** si la instancia perdida publica a pantallas reales | persona | Nada del plan. **Es lo más urgente que hay aquí**, y no depende de nada |
| `certbot renew --dry-run` **cada dos meses** | calendario | Que el sitio no muera en silencio a los 90 días |

### Tareas abiertas que este expediente **no** cierra

1. **El proceso del PADRE corre como `root`** (medido el 24/08). Con una demo
   pública compartiendo máquina, cualquier ejecución de código en el proceso web
   es ejecución como root en el plano de control. DEMO nace con usuario propio;
   **el del PADRE queda pendiente**.
2. **Los códigos de recuperación del Dueño no existen.** Decididos el 20/08 y
   **no construidos** — verificado: sin resultados en `apps/web` ni en `db/`.
3. **H2** — el `grant on all tables` incluye `schema_migrations`; estrecharlo toca
   las dos migraciones de GRANT a la vez. Menor, puede ir después del merge.
4. **D4** — una migración fallida deja la base sin recobro. El tablero lo declara
   *«tarea propia, antes de la Fase 5»*.

---

## 8. Verificación global

**⧗ Pendiente de re-medir al emitir la versión final.** Las cifras de abajo son
del cierre de la sesión del **2026-08-24**, y se citan con su procedencia en vez
de darse por vigentes — es la política que este proyecto adoptó después de que un
recuento heredado saliera mal dos veces.

| Suite | Cifra | Procedencia |
|---|---|---|
| Unitarias | **842** en 77 archivos | corrida del 24/08 |
| e2e | **20 archivos · 213 pruebas · 1 saltada** | corrida del 24/08 |
| `typecheck` | limpio | corrida del 24/08 |
| `aislamiento.e2e.test.ts` | **pasa sin tocarse** | corrida del 24/08 |
| Migraciones | **72** | `ls db/migrations/*.sql \| wc -l` el 24/08 |

Al emitir la versión final:

```
cd apps/web && npm run typecheck && npm test && npm run build && npm run test:e2e
```

> Las e2e **exigen el build hecho antes**, o fallan las 20 en falso y tardan
> 636 s en hacerlo. El rojo no diría nada del código: diría que falta el build.

---

## 9. Nota de entorno

- **Alcance de lo ya probado: LOCAL.** Docker y Postgres de esta máquina (5433),
  contenedores en `localhost`. **No se tocó ningún droplet, ningún registry y
  ninguna base de producción.**
- La rama **no está fusionada a `main`**, y va **182 commits por delante**. `main`
  tiene **66** migraciones; esta rama, **72**. Es la razón del gate **C2**.
- El remoto vivo es **`emiliano`**. `origin` (`CarlosMend87/spaces-dooh`) está
  muerto, 408 commits atrás. **No empujar ahí.**

---

## 10. Registro de emisiones

| Emisión | Fecha | HEAD | Qué cambió |
|---|---|---|---|
| 1.ª — apertura | 2026-08-24 | `a858c15` | Expediente abierto con toda la evidencia local medida y los 31 huecos de captura señalados |

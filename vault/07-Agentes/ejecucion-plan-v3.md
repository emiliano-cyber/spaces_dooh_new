---
tipo: tablero
estado: en-curso
actualizado: 2026-08-18
tags: [instancias, orquestacion, agentes, fases-1-4]
archivos:
  - docs/Plan_Instancias_Soberanas_v3.md
  - .claude/agents/ejecutor.md
  - .claude/agents/verificador.md
  - .claude/agents/ensayista-local.md
  - .claude/commands/orquestar.md
---

# Ejecución del plan v3 — Fases 1–4 en local

Estado vivo de la orquestación. Lo mantiene el orquestador; los humanos lo leen.
El plan de autoridad es
[`Plan_Instancias_Soberanas_v3`](../../docs/Plan_Instancias_Soberanas_v3.md) — este archivo
no lo replantea, solo registra su ejecución local.

**Modo:** todo se prueba en local antes de tocar producción. Las tareas de servidor
se ensayan (ensayista-local) y su ejecución real queda como **tarjeta humana**.

## Decisiones registradas

| Decisión | Estado | Respuesta | Fecha |
|---|---|---|---|
| P1 · destino de `rgb` y del droplet actual | ABIERTA | — | — |
| P2 · fecha de migración de PIXELED | ABIERTA | — | — |
| **P3 · cuenta DO** | **RESUELTA EN SU MITAD QUE NOS BLOQUEABA** | **El registry nace en la cuenta de PIXELED.** Con eso **TH-P4 deja de estar bloqueada** y la Fase 2 puede cerrarse en cuanto una persona la ejecute. ⚠️ **Pero la pregunta que el plan escribe en P3 (`:2076-2083`) es otra**: «¿las instancias nacen en la cuenta DO de AS OOH o en la del owner?», y **eso sigue abierto**. Bloquea `provision-instancia.sh` (F5.4) y el runbook de operación — **Fase 5, fuera del alcance actual**, así que no detiene nada hoy. ✅ Se preguntó si esa cuenta era la de un cliente —PIXELED figura en el plan como tenant a migrar (P2, `:2070`)— y **no lo es: es la de la casa**, confirmado por Jochelo el 17/08 | 2026-08-17 |
| **P4 · nombre del registry** | **RESUELTA** | **DigitalOcean Container Registry.** Login con `secrets.DO_REGISTRY_TOKEN`. **No cambia una línea de F2.3/F2.4**: el plan (`:785-786`) ya manda elegir el login según `vars.REGISTRY_TIPO` para no reescribir el workflow cuando cayera esta decisión. Lo que fija son **dos variables de repositorio en GitHub** → tarjeta **TH-P4**. ⚠️ **Arrastra P3**: un registry de DO vive en una cuenta concreta, y en cuál nacen las instancias sigue abierto. Mirar además el límite de almacenamiento del plan contratado | 2026-08-17 |
| **P4-bis · autoregistro fuera del build** | **RESUELTA y EJECUTADA** (`70ca3f0`) | **(b) la bandera sale del build**, como ya se hizo con `GOOGLE_OAUTH`. Un solo artefacto por versión; el autoregistro se decide en el `.env` al arrancar | 2026-08-13 |
| **P3b-bis · ¿el registro va abierto o cerrado?** | **REDECIDIDA y COMPLETA — revierte la del 10/08** | **CERRADO en todas partes: local, producción y DEMO.** Ninguna instancia lo abre. `.env.example` baja a `AUTOREGISTRO=0`; el droplet se queda sin la bandera. **Contradice F4.4 del plan** (`:1345`), que manda encenderlo en DEMO | 2026-08-14 |
| **D1 · qué hacer con la vuelta atrás que no devuelve el esquema** | **RESUELTA** | **Arreglarlo de fondo: restaurar sobre un esquema limpio**, no solo avisar. Decisión de Jochelo el 2026-08-18. Con eso la vuelta atrás hace lo que su README promete. ⚠️ Trae dos riesgos que la propia decisión nombró y que la tarea tiene que despachar con evidencia: (1) es un **`drop` dentro del script que corre en todas las instancias**; (2) hay que **demostrar que el dump SIEMPRE basta para reconstruir**, y el proyecto ya sabe que una base virgen no levanta sola — `db/migrations/20260729_licencias_permisos.sql:96-97` aborta si falta el rol de aplicación y **13 migraciones lo referencian**. Es ROJO: lleva TDD y verificador en sesión aparte | 2026-08-18 |
| **H1, H2 y H-1 · los tres sitios donde el script afirma algo falso** | **RESUELTA** | **Se cierran en un ciclo corto**, los tres juntos, porque son el mismo defecto. Decisión de Jochelo el 2026-08-18. Van después de D1 | 2026-08-18 |
| **M1 · cómo se exige la barrida de mutación** | **RESUELTA** | **Por tarea se corre el arnés entero (~4 min) más los mutantes que tocan el propio cambio, aislados con `probar_mutante_en`. La barrida completa deja de ser obligatoria por ciclo, y quien no la corra lo declara por escrito en su informe** — no se supone, se escribe. Decisión de Jochelo el 2026-08-18, tras medirse **~25 min por mutante** en esta máquina: a 25 mutantes la barrida pasa de 10 h y el arnés crece con cada tarea. ⚠️ **Coste aceptado a sabiendas**: una regresión en una pieza vieja **no se ve** hasta que alguien corra la barrida completa. Conviene lanzarla de vez en cuando fuera del ciclo, cuando la máquina esté libre | 2026-08-18 |
| **M2 · las credenciales, criterio de rechazo** | **RESUELTA** | **Cualquier fragmento de credencial que salga de la instancia es INVALIDANTE**, sin importar cuán estrecho sea el caso que lo produce. Decisión de Jochelo el 2026-08-19. Se suma a la regla de oro —sesión, tenant, migración o dinero— como quinto disparador. **Nació de una necesidad real**: la auditoría de `70b8cc5` encontró una regresión que devolvía usuario y prefijo de clave al bucket y **tuvo que preguntar cómo clasificarla, porque el criterio no existía**. A partir de ahora no se pregunta. ▸ `70b8cc5` se aceptó en **AMARILLO** —decisión del mismo día— porque los dos invalidantes que se le encargaban quedaron cerrados y comprobados, y la regresión es un defecto **nuevo hallado al auditar**, no un encargo incumplido. La regla rige de aquí en adelante | 2026-08-19 |
| P5 · «DEMO» de la Fase 3 = droplet nuevo de la Fase 4 | ASUMIDA por el plan (F3.5 depende de F4.5) | sí | 2026-08-13 |
| P6 · `/api/version` con token de flota o pública | ABIERTA (afecta Fase 6, fuera de alcance actual) | — | — |
| **P7 · ¿quién aplica las migraciones `@tipo: datos` en la flota?** | **RESUELTA** | **Una persona, a mano — no el update.** `update.sh:407-413` llama al runner **sin `--con-datos`**, y eso es deliberado: una corrección de datos no debe colarse en una actualización automática que corre de madrugada por `cron`. El ritual es el de `vault/04-Datos/migraciones.md`. ⚠️ **Quien publique un release con una migración de datos tiene que avisar**: el update no la aplica y **tampoco falla**, así que sin aviso la corrección no ocurre — en silencio y en toda la flota a la vez | 2026-08-18 |
| **T-01a · alcance del arreglo de `bootstrap-auth.mjs`** | RESUELTA | Las **dos** causas en el mismo commit: `on conflict` y `tenant_id` | 2026-08-13 |
| **T-01b · qué hace el script si falta el tenant `rgb`** | RESUELTA | **Abortar con error.** El no-op silencioso es el modo de fallo que ya costó un despliegue | 2026-08-13 |

## DAG y estado por tarea

Leyenda de estado: PENDIENTE · EN_CURSO · EN_VERIFICACION · COMPLETADA_LOCAL ·
ENSAYADA_LOCAL · PENDIENTE_SERVIDOR · DETENIDA · BLOQUEADA

### Fase 0 · Cerrar el autoregistro fuera de DEMO — **sobrepasada por los hechos**

> [!important] Dos tareas hechas, dos de servidor sin ejecutar, y la fase perdió su premisa — 2026-08-14
> Expediente: **[`docs/evidencias/fase-0.md`](../../docs/evidencias/fase-0.md)** (commit `9860d35`,
> que **sustituye** al `29c6b9e` de las 13:43 — aquel se escribió cuando F0.3 aún no existía).
>
> Hecho y auditado en local: **F0.3** (`6044732`) y **T-03** (`ef70aa9`). Sin ejecutar,
> las dos de servidor: **F0.1** y **F0.2**.
>
> Se titula «cerrar el autoregistro **fuera de DEMO**», y la decisión del 14/08 lo
> cierra **en todas partes**: la asimetría que perseguía ya no existe. Parte de lo
> que quería F0.3 lo hicieron F2.6 y `0dbccb8` por otra vía. **F0.1 sigue siendo la
> única forma de saber con evidencia si el registro está abierto hoy en el droplet.**

| Tarea | Tipo | Estado | Notas |
|---|---|---|---|
| F0.1 | [verificación] | **NO EJECUTADA** → PENDIENTE_SERVIDOR | `curl` + `ssh` al droplet. Según el plan (`:260`) **bloquea toda la Fase 4**. Tarjeta **TH-F0.1** |
| F0.2 | [infra] | **PENDIENTE_SERVIDOR** (condicionada a TH-F0.1) | No se ejecuta hasta que F0.1 dé 400. Su `sed` sobre el nombre viejo **caduca** en cuanto el droplet tome un release con F2.6 |
| F0.3 | [código] | **COMPLETADA_LOCAL** | `6044732`, AMARILLO. La prueba que faltaba ya existe **y muerde**: comprobado por el auditor poniendo la plantilla en `=1` y viéndola roja. `COOKIE_DOMAIN=localhost` fuera. 803 pruebas en 73 archivos |
| **T-03** | [código] · **fuera del plan** | **COMPLETADA_LOCAL** | `ef70aa9`, AMARILLO. Depende de F0.3. Fuera la **cookie comodín** de `.env.production.example`, y el candado extendido a la segunda plantilla. ROJO por tema: **pendiente de visto bueno humano**. ⚠️ Limpia la plantilla, **no los `.env` ya desplegados** — TH-T03 |

> [!tip] La mitad que faltaba de F0.3, **ya cerrada** (`6044732`)
> Hasta el 14/08 ninguna prueba leía `.env.example`, así que devolverla a
> `AUTOREGISTRO=1` dejaba la suite verde y el CI mudo. Ya no: `entorno.test.ts`
> la vigila, y el auditor comprobó que **muerde de verdad** poniendo la plantilla en
> `=1` y viéndola roja. La decisión del 14/08 ya no depende de que nadie mire.
>
> **Pero solo cubre `.env.example`.** `.env.production.example` tiene su propio
> `AUTOREGISTRO=0` (`:39`) igual de desvigilado, y además la línea `:9` con la cookie
> comodín — candidatas de **T-03**.

### Fase 1 · Limpieza de los 23 `DEFAULT` de `tenant_id`

> [!important] **FASE 1 · CERRADA** — validada y aceptada el 2026-08-17
> ✅ **`validador-plan`: AMARILLO** sobre HEAD `04952a7`, **aceptado por Jochelo** el
> 2026-08-17. Con eso la fase queda **CERRADA**, que es lo que la compuerta exige. **Ningún hallazgo toca el
> código, la migración ni las pruebas**: los siete son de tablero y expediente, y tres
> eran míos (H1, H2, H3), corregidos aquí mismo. Suites corridas por el validador, no
> reportadas: typecheck limpio, **805 unitarias en 73 archivos** y **147 e2e + 1 saltada
> en 14 archivos**, exit 0. Invariantes limpios: `aislamiento.e2e.test.ts` intacto en
> **toda la rama**, `db/schema.sql` sin tocar, ninguna migración preexistente modificada,
> cero `qRaw` nuevo y cero secretos.
>
> Expediente de evidencia: **[`docs/evidencias/fase-1.md`](../../docs/evidencias/fase-1.md)**,
> commit vivo **`7138f89`** (14/08 14:50), que **reescribió** el original `fb09b91` —
> aquel escribió 593 líneas en la ruta vieja `docs/Instancias_Fase1_Expediente_Cierre.md`
> y `42c0f4e` la mudó. El contenido de hoy **no** es el de `fb09b91`.
>
> **Cerrada en local, NO en producción.** El `DEFAULT` sigue vivo en `spaces_prod`:
> F1.2 está escrita y probada, no aplicada. Quedan **F1.5** (tarjeta **TH-F1.5**) y el
> censo de **TH-02**, las dos de persona, más **cuatro commits ROJO** esperando visto
> bueno humano — `c50344a`, `65bf9b5`, `b976b54` y `3ac2bba`. **Son cuatro, no cinco**:
> `3671e8a` (F1.4) lo declaró AMARILLO su ejecutor, y el criterio vigente es el de la
> sección «Commits que esperan visto bueno humano».

| Tarea | Tipo | Agente | Depende de | Estado | Notas |
|---|---|---|---|---|---|
| F1.1 | [verificación] | ensayista-local (SOLO LECTURA sobre 5433) + tarjeta humana | — | **ENSAYADA_LOCAL** → PENDIENTE_SERVIDOR | Catálogo confirmado (23 tablas, y los 6 nombres de enganche existen). **Los datos NO: la base local es fixture** y da ceros vacuos. Censo real en TH-02 |
| **T-01** | [código] · **fuera del plan** | ejecutor | — | **COMPLETADA_LOCAL** | `b976b54`, AMARILLO. Las dos causas arregladas y el aborte demostrado. ROJO: **pendiente de visto bueno humano** |
| **T-02** | [código] · **fuera del plan** | ejecutor | T-01 | **COMPLETADA_LOCAL** | `3ac2bba`, **VERDE** — el único verde de la tanda. `DATABASE_URL` pasa a obligatoria. ROJO: **pendiente de visto bueno humano** |
| F1.2 | [migración] | ejecutor | F1.1-local + T-01 ✅ | **COMPLETADA_LOCAL** | **`65bf9b5`**, AMARILLO. Descubre tablas por catálogo, no por lista; idempotencia probada ×3 y el guard visto saltar. **ROJO — migración Y tenant, los dos disparadores: pendiente de visto bueno humano.** ⚠️ El plan manda reverificar el `insert into reservas` que cita en `campanas-repo.ts:687-696`: tras F1.3 arranca en **`:697`** |
| F1.3 | [código] | ejecutor | — | **COMPLETADA_LOCAL** | `c50344a`. Veredicto AMARILLO (aceptada). ROJO por R2: **pendiente de visto bueno humano antes del merge** |
| F1.4 | [código] | ejecutor | — | **COMPLETADA_LOCAL** | `3671e8a`, AMARILLO. `lib/host.ts` nuevo y `extractSubdomain` borrada. ⚠️ Abierto: el rewrite de `portal` **sí cambia** con `Host` en mayúsculas o con punto final — fuera de los pasos que la tarea autorizaba. Pendiente de decisión |
| **T-04** | [migración] · **fuera del plan** | ejecutor | — | **COMPLETADA_LOCAL** | `4c484fa`, **AMARILLO**. ROJO por su ejecutor: **edita dos migraciones ya aplicadas en producción** (R3), autorizado por Jochelo el 17/08 — **pendiente de visto bueno humano**. Aparecieron **DOS roturas, no una**: la primera tapaba a la segunda, y su arnés sigue tras cada fallo para censarlas. ⚠️ **Y hay una TERCERA que T-04 no arregla ni debía**: sobre una base parada en la ventana `[20260723, 20260807)`, `20260720_hard1_rls_todas_tablas.sql:126` aborta con «Tablas con `tenant_id` sin RLS+FORCE: `password_resets`». **El droplet hoy NO está expuesto** (esa migración consta aplicada el 10/08). Ver la entrada del 17/08 sobre por qué esa tercera es argumento **a favor** del runner, no contra él |
| F1.5 | [verificación] | tarjeta humana | F1.1 real, F1.2 | PENDIENTE_SERVIDOR | Aplicación al droplet: la corre una persona. Tarjeta **TH-F1.5**, emitida el 17/08 — llevaba desde el 13/08 en este estado **sin tarjeta**, que es lo que la leyenda exige. Va después de TH-02 y **después de TH-F3.1** |

### Fase 2 · Release versionado — **cierre PARCIAL, validado**

> [!important] ✅ **Validada el 2026-08-17 · AMARILLO, como cierre PARCIAL**
> `validador-plan` sobre HEAD `37b8ffd`. Ningún hallazgo toca código, migraciones ni
> pruebas. Suites corridas por él: typecheck limpio, **805 unitarias en 73** y **147 e2e
> + 1 saltada en 14**, exit 0. Los seis invariantes limpios. **Como cierre completo sería
> ROJO** —dos tareas en PENDIENTE—; como parcial, la parte ejecutable está entera.
>
> **Qué falta para convertirlo en cierre completo, en este orden:** escribir F2.3 y F2.4
> (se puede hoy, sin esperar a nadie) → **TH-P4 ejecutada por una persona**, que exige
> cerrar **P3** antes → correr el workflow contra un tag real y comprobar sus dos
> criterios: que una suite en rojo **impida publicar**, y que promover **no cambie el
> digest**. Solo lo primero está en manos de un agente.

> [!important] Todo lo ejecutable, hecho — pero la fase NO está cerrada
> Expediente: **[`docs/evidencias/fase-2.md`](../../docs/evidencias/fase-2.md)**, commit
> vivo **`fc04607`** («reemitido con las anclas remedidas»), que **sustituye** al
> `84fe410` de las 14:09.
>
> **P4 quedó RESUELTA el 2026-08-17** (DigitalOcean Container Registry), así que
> **F2.3 y F2.4 dejan de estar bloqueadas y pasan a PENDIENTE**. Ojo con lo que eso
> significa de verdad: el plan (`:785-786`) ya las diseñó para escribirse **sin** esa
> decisión —el login se elige por `vars.REGISTRY_TIPO`—, o sea que lo desbloqueado no es
> el código sino **el valor de dos variables de repositorio**, que pone una persona
> (**TH-P4**). `COMPLETADA_LOCAL` tampoco es «hecho»: la rama no
> está mergeada y producción corre el build viejo, donde `NEXT_PUBLIC_AUTOREGISTRO`
> todavía manda.

| Tarea | Tipo | Agente | Depende de | Estado | Notas |
|---|---|---|---|---|---|
| F2.1 | [código] | ejecutor | — | **COMPLETADA_LOCAL** | `8ae8f77`, AMARILLO (auditada el 14/08 — la primera auditoría murió por un login expirado y se relanzó de cero). Las dos formas de arrancar comprobadas: `npm start` y el standalone, 200 y 307 en ambas. Alto contacto: `next.config.mjs` |
| F2.2 | [infra→código local] | ejecutor escribe, ensayista construye | F2.1 ✅ | **COMPLETADA_LOCAL** | `3f16386`, **VERDE**. Imagen de 240 MB con `db/` dentro (68 archivos md5-idénticos al repo). Sin `.env`, probado **con control positivo**. La línea `**/.env*` del `.dockerignore` es lo que lo sostiene — ver bitácora |
| F2.3 | [release] | ejecutor escribe workflow; NO se corre | F2.2, ~~P4-bis~~ ✅, ~~P4~~ ✅ | ✅ **COMPLETADA_LOCAL** — auditada **AMARILLO**; su parte de servidor es **TH-F2.3** | ✅ Nace `.github/workflows/release.yml`. **El gate no es una comprobación: es el orden** — el `docker push` es el último paso del último job y ese job cuelga de `needs: pruebas`, así que no hay camino por el que `beta` se mueva sin typecheck + unitarias + e2e en verde. Detalle que el plan no pide y sí importa: **primero la etiqueta de versión y después `beta`**, porque la de versión es inmutable y `beta` es un puntero — si el primer push falla, `beta` sigue apuntando al release anterior, que sí está entero. Resolvió las dos trampas que le pasé: **el build de Next va entre las unitarias y las e2e** (sin él, los 15 archivos morirían por timeout tras 636 s con un rojo que no habla del código), y **el rol de aplicación lo monta el arnés, no el YAML** — `recrearEsquema()` aplica `dev-rol-app.sql` antes que nada; montarlo por otro camino sería una segunda copia que divergiría. Van **las dos** conexiones (`DATABASE_URL_TEST` con superusuario y `DATABASE_URL_TEST_APP` con `spaces_app`), y el workflow las pone bien. ⚠️ **Pero el motivo que dimos era falso** y lo corrigió la auditoría: sin esa variable el arnés **no** cae en el superusuario — `db-e2e.ts:79-81` respalda con `spaces_app@localhost:**5433**`, o sea el Docker local, que en un runner da **`ECONNREFUSED` y rojo ruidoso**, no un aislamiento que pasa por casualidad. Ese escenario silencioso es otro (`db-e2e.ts:64-68`) y solo ocurriría apuntando la variable **al superusuario** | Publica **una** imagen (P4-bis resuelta). El registry va como parámetro `vars.REGISTRY` y el login se elige por `vars.REGISTRY_TIPO` (`plan:785-786`) — con P4 en DOCR, el valor lo pone una persona en **TH-P4** |
| F2.4 | [release] | ejecutor escribe; NO se corre | F2.3 | ✅ **COMPLETADA_LOCAL** — auditada **AMARILLO**; su parte de servidor es **TH-F2.4** | ✅ Nace `.github/workflows/promover.yml`. Reetiqueta con **`docker buildx imagetools create`**, que opera sobre el **manifiesto en el registry**: no baja capas ni pasa por el demonio local. Descartó `pull`+`tag`+`push` con un motivo decisivo que el plan no menciona: **el demonio local guarda UNA plataforma**, así que de un índice multi-arquitectura saldría un manifiesto de una sola — otro digest. Dos refuerzos suyos: **el origen es el digest, no la etiqueta `beta`** (entre comprobar y reetiquetar puede entrar un release y mover `beta`), y **no se cree a `imagetools`: lo comprueba** — relee el digest de `estable` y falla en rojo si difiere, imprimiendo la vuelta atrás. **Patrón estricto sin sufijos**, deliberadamente distinto del de `release.yml`: `-rc1` es material de `beta`, no de `estable`, y el porqué está escrito en los dos archivos para que nadie los «unifique» de buena fe |
| F2.5 | [verificación] | ensayista-local | F2.2 | **ENSAYADA_LOCAL** (×2) | Reensayada tras F2.6: `200 · 200 · 503 · 401` y **la bandera obedece al arranque** con la misma imagen (`sha256:12de895f`). Login con estilos: **22 activos a 200**, CSS con 707 reglas. Queda vigente que **la imagen no puede levantar una base virgen sola** (falta el rol de app) → F3.2/Fase 5 |
| F2.6 | [código] | ejecutor | F2.1 | **COMPLETADA_LOCAL** | `70ca3f0`, AMARILLO. `AUTOREGISTRO` sin prefijo, fail-closed, y el botón deja de hornearse. ROJO: **pendiente de visto bueno humano**. ⚠️ Rompe cuatro tareas del plan por el renombrado — ver bitácora |

### Fase 3 · `update.sh` + runner de migraciones

| Tarea | Tipo | Agente | Depende de | Estado | Notas |
|---|---|---|---|---|---|
| F3.1 | [migración] | ejecutor | — | **COMPLETADA_LOCAL** | `6cb16d4`, AMARILLO. `schema_migrations` + backfill de **65** (no 66 ni 67 — ver bitácora). ROJO: **pendiente de visto bueno humano**. ⚠️ **Su ASSERT se romperá en cuanto exista F3.2** — insumo obligado de esa tarea |
| F3.2 | [código] | ejecutor | F3.1 | ✅ **COMPLETADA_LOCAL** — 3.º ciclo, **auditado AMARILLO**, nada invalidante | ✅ **Tercer ciclo (`d31a7b8`, 17/08), autorizado por Jochelo fuera del presupuesto de dos.** La bandera **se comprueba en vez de creerse**, y la señal es **derivada, no cableada**: las **11** tablas que crean las migraciones y que `db/schema.sql` no crea — una instalación recién nacida es rol de app + `schema.sql`, así que ninguna puede existir en ella, y las dos partes viajan en la imagen (`Dockerfile:94-95`). **Tablas y no índices**, defendido por escrito: un `constraint … unique` dentro de un `create table` crea un índice sin que ningún `create index` lo delate, y se derivaría como testigo **rechazando una instalación legítima**. Protegida de caducar por un **canario** en `migrar.test.ts` que cablea `almacen_activos` a propósito —el único nombre escrito a mano del mecanismo— y se pone rojo el día que esa tabla se renombre. **Límite declarado en voz alta**: una base parada antes de `20260716_doohmain_playlogs.sql` sigue siendo indistinguible; ninguna instancia real está ahí y la ventana peligrosa `[20260723, 20260807)` queda cubierta desde su primer archivo. 821 unitarias y 164 e2e + 1 saltada. Sigue **ROJO: pendiente de visto bueno humano**. ▸ *2.º ciclo, auditado AMARILLO:* 🔴 **Lo que la auditoría del 2.º ciclo dejó abierto, y va a Jochelo, no a un tercer ciclo:** (1) **`--instalacion-nueva` no tiene guard propio** — `migrar.mjs:242-252` solo comprueba la dirección inocua (la bandera sobre una base que ya tiene registro), no la peligrosa; y el mensaje de error de `:230-237` **le pone al operador la línea a copiar** sin que nada verifique su afirmación. Medido: sobre el droplet de hoy, reaplicación silenciosa de **67 migraciones con salida 0**; sobre una base en la ventana `[20260723, 20260807)`, **salida 2 con 28 aplicadas y 0 registradas**. Es el mismo modo de fallo que el resto del runner se esfuerza en evitar. (2) 🔴 **La indistinguibilidad —justificación entera de la desviación— es FALSA, y el auditor la falsó**: una instalación nueva tiene **359** columnas en `public` y el droplet rezagado **512**, y `to_regclass('public.almacen_activos')` es `null` en la primera y no en el segundo (`db/migrations/20260723_almacen.sql` la crea; no está en `schema.sql`). La señal existe, es **una sola consulta** y del mismo tipo que las dos que el runner ya hace. Lo cierto es lo más débil: *la heurística que se eligió reutilizar* no las distingue. La frase está en tres sitios (`migrar.mjs:200-203`, `migraciones.e2e.test.ts:363-366` y [[migraciones]]). (3) **El criterio 1 del plan queda detrás de una bandera que el plan no tiene**: `migraciones.e2e.test.ts:249-259` pasa `--instalacion-nueva` donde antes no pasaba nada. Es cambio de contrato, declarado, que **debe ratificar una persona**. (4) Tres citas nuevas apuntan mal **en el commit cuyo tema era corregir comentarios falsos**: `:304`→`migrar.mjs:293-295`, `:319`→`:62`/`:110`, `:352`→`:17-22`. ✅ **Segundo ciclo (17/08): el runner ya no adivina.** Sin `schema_migrations` **y con datos**, se para con salida 1 y nombra las dos salidas: aplicar primero `20260812_schema_migrations.sql` (instancia con historia) o repetir con la bandera nueva **`--instalacion-nueva`** (base recién nacida). La heurística de «con historia» es la **misma, literal**, que la del backfill (`:99-110`), no una inventada. Cubre de paso la **tercera rotura** de T-04 —la ventana `[20260723, 20260807)`—: no se repara reaplicando, se evita **no reaplicando**. Cerrados también los hallazgos 2 (el registro que falla ya sale **2**, no 1 con volcado de pila) y 3 (`--pendientes` deja de contestar «Aplicadas: 0» sobre una base con historia). **+5 casos e2e**: 162 + 1 saltada en 15 archivos. ⚠️ **La bandera es una desviación del plan**, que no la contempla: sin ella no se puede sostener a la vez «no reapliques la historia» y el criterio «una base vacía llega al esquema correcto» — quien sabe cuál de los dos casos es, es el aprovisionamiento, no el script. Sigue **ROJO: pendiente de visto bueno humano**. ▸ *Lo que decía el primer ciclo, `d293865`:* **un criterio de aceptación del plan estaba incumplido y sin prueba**: «una instancia rezagada no truena». `migrar.mjs:175-182` lee la tabla de registro ausente como «instancia nueva», y sobre una instancia **con historia** eso es falso: reaplica los 68, **muere en el 28.º y deja 27 aplicadas y 0 registradas**, en un estado que el propio runner no sabe diagnosticar. ⚠️ **Pero la mitad de la causa no es del commit**: la cadena de migraciones **no es idempotente encadenada** —`20260720_hard1_usuarios_rls.sql:40-79` crea funciones a las que `20260806_identidades_externas.sql` y `20260807_password_resets_rls.sql` cambian el tipo de retorno—, así que **el plan se equivoca en `:955-956`** al darlas por idempotentes. El auditor lo probó reproduciendo el bucle de `deploy.yml:141-148`: falla en el mismo archivo, sin runner de por medio. ⚠️ **T-04 (17/08) cerró esa mitad y corrigió esta frase por dos lados**: las roturas eran **DOS** —la segunda, `20260729_datos_contrato_documento.sql`, quedaba tapada por la primera— y quien cambia el tipo de retorno **no** es `20260806`/`20260807`, sino `20260804_reautenticacion_individual.sql:70-71`. La cadena ya se reaplica entera y lo ancla `reaplicacion.e2e.test.ts`; ver [[migraciones]]. **En la secuencia prevista sí funciona** (con F3.1 ya aplicada: 2 aplicadas, salida 0, las 65 filas `'backfill'` intactas). Runner: reproduce el mapa `ANTES_DE`, que vive en **`db-e2e.ts:144-151`** (medido; el plan lo cita como `:145-155`, que abarca también el bucle). 🔴 **Dos insumos duros que la fila no traía y sin los cuales esta tarea se estrella:** (a) **la imagen no puede levantar una base virgen sola** — `20260729_licencias_permisos.sql:96-97` hace `raise exception` si no existe el rol de aplicación, y **13** migraciones lo referencian; el `Dockerfile` no lo crea y `dev-rol-app.sql` no viaja. El caso e2e «contra una base vacía» choca de frente con esto; (b) **el ASSERT de `20260812_schema_migrations.sql:221-223` se vuelve falso positivo en cuanto exista este runner** (comprueba `archivo >= '20260812'` sobre toda la tabla). 🔵 **Decisión de Jochelo (17/08): el runner es fail-closed** — `DATABASE_URL` obligatoria, **desviación consciente del paso 2 del plan** (`:979-980`) |
| F3.3 | [código] | ejecutor | F3.2 | ✅ **COMPLETADA_LOCAL** — auditada **AMARILLO**, nada invalidante | `dc6df52`, ROJO por su ejecutor. Una migración alterada **aborta con salida 3** nombrando el archivo y los dos checksums, **antes de todo, incluido `--pendientes`**. Las filas `'backfill'` se saltan la comprobación, que es lo que hace que T-04 no rompa nada. **`--forzar-checksum` exige el nombre del archivo** —desviación consciente del paso 3, que la describe suelta— y **verifica que ese archivo de verdad diverja**: una bandera olvidada en un `update.sh` sale con 1 en vez de perdonar a bulto para siempre. 172 e2e + 1 saltada en 15 archivos |
| F3.4 | [infra→código local] | ejecutor escribe, ensayista ensaya | **F3.2, F3.3, F2.4** (`plan:1034`) | ✅ **ENSAYADA_LOCAL** (18/08 · turno nocturno) — 2.º ciclo auditado **AMARILLO**, **ensayo local DEMOSTRADO en los nueve puntos**, y sus defectos reparados en `2633bcb` salvo **D1, que es ROJO y espera decisión**. Solo le queda su parte de servidor (F3.5) | ✅ **No parcheó el patrón: cambió de fuente de verdad.** El script ya no cuenta migraciones leyendo la prosa del runner — **le pregunta a la base**. `huella_base()` toma un hash de columnas y `DEFAULT`, índices, restricciones, políticas RLS, funciones y el contenido de `schema_migrations`, **antes y después** de migrar, ejecutado con el `pg` de la misma imagen y la misma `DATABASE_URL` que el runner. Medido contra Postgres real: discrimina base virgen · 66 sin registro · 67 con registro, **funciona sin `schema_migrations`** —que es justo el caso del código 2— y **no se mueve con un `insert`** de la versión anterior sirviendo entre las dos lecturas. Fail-closed en las dos direcciones: si no puede leer la huella **antes**, no migra; si no puede releerla **después**, **restaura por prudencia**. ▸ *1.er ciclo, `acbbe0b`, ROJO:* la vuelta atrás no restauraba la base, y el código 2 mentía en el log | 🔴 **La vuelta atrás NO restaura la base, y el fallo es permanente y mudo.** `update.sh:364` decide si restaurar con un `sed` que exige un punto pegado a «aplicadas» (`^\([0-9]*\) aplicadas\.`), y `migrar.mjs:694-696` imprime hoy `67 aplicadas, 1 de datos pendientes.` — así que **en cuanto hay una migración `@tipo: datos` pendiente, `APLICADAS` cae a 0** y el rollback anuncia «no corrió ninguna migración: la base no se toca». No es hipotético: `20260731_calendario_meses_cortos.sql` es `@tipo: datos` **y su primera línea lleva CRLF**, por eso un grep ingenuo no la ve. Reproducido de punta a punta: `[pg_restore: 0 llamadas]`. La instancia queda **sirviendo la imagen vieja sobre un esquema nuevo**, y **nada lo denuncia después** — por el hueco de `migrar.mjs:212-222`, que es el mismo que hace posible la vuelta atrás. 🔴 **Y el código 2 miente en el log**: `se aplicaron N migraciones y no se pudieron registrar` tampoco casa, así que reporta «no consta ninguna migración aplicada; suele ser que no pudo conectar» — **miente sobre la única pregunta que el 2 existe para responder**, y es alcanzable hoy. | ✅ Nacen `infra/scripts/update.sh` y su README. **Confirmada y medida la contradicción (1)**: `Dockerfile:94-95` no copia `scripts/`, y sin montaje el contenedor muere con `MODULE_NOT_FOUND`. **La resolvió montando el runner en solo lectura, sin tocar el `Dockerfile`** —que es F2.2, ya auditada— y **reportó el arreglo duradero en vez de aplicarlo**. La prueba de que funciona es preciosa: el runner montado informa **67 pendientes** y el repo tiene **68 archivos**, o sea que está leyendo **las migraciones de la imagen y no el disco del host**. El script **sonda la imagen** y si algún día trae el runner, no monta nada. **Los cuatro códigos del runner se distinguen** (1 vuelca el mensaje accionable al log; 2 **no conmuta y no restaura**, con dos redacciones según lo que el runner diga; 3 nada aplicado) más tres propios: 4 vuelta atrás buena, 5 vuelta atrás fallida, 75 candado tomado | `update.sh` contra instancia local desechable. ⚠️ Esta fila declaraba «F3.2, F2.5»: **perdía F3.3 y cambiaba F2.4 —que no está escrita— por F2.5, que sí está hecha**, haciendo parecer arrancable la tarea en cuanto cayera F3.2. **Su dependencia real no existe todavía**: sin F2.4 no hay canal del que jalar | ▸ **Ensayo local del 18/08:** montado en WSL con Postgres propio **sin puerto publicado** —el 5433 no recibió ni un SELECT— y destruido al terminar. Único doble: `docker pull` (no hay registry local y la guarda prohíbe uno remoto). **Demostrado:** digest igual sale 0 sin efectos · **respaldo vacío DETIENE** · las migraciones son las de la imagen, no las del host (el `--dry-run` listó un archivo que no existe en disco) · health con reintentos en verde y en rojo · **la vuelta atrás se decide por la huella de la base, no por la prosa del runner** —la regresión de `8151772`, probada en las dos direcciones y con la frase exacta que mató a la versión vieja— · los siete códigos provocados uno a uno · `flock` real: el segundo update sale 75 · `--dry-run` no toca nada · y el padre no aparece: registry, base propia y `127.0.0.1`. **Cinco defectos:** D1 🔴 (abajo), y D2/D3/D4a/D5 reparados en `2633bcb`. ⚠️ **`Dockerfile:94-95` sigue sin copiar `scripts/`**, confirmado contra HEAD: el runner viaja con el aprovisionamiento y no con la imagen. Es F2.2, ya auditada |
| F3.5 | [verificación] | ensayista-local (DEMO simulada) + tarjeta humana | F3.4, F4-local | PENDIENTE | El ensayo real en DEMO depende de F4.5 real (P5). ✅ **Su tarjeta ya está escrita** —**TH-F3.5**, abajo— con lo que el ensayo local del 18/08 **no pudo** ver: el `docker pull` de verdad (digest de registry, autenticación, movimiento de etiquetas), las rutas y permisos reales (`/etc/space-os/instancia.env` a 600 y de root), el `cron` de las 4 a. m., una imagen de release construida de verdad —las del ensayo derivan de `space-os:dev`, anterior a F3.1, con 67 migraciones y no 68—, la escala del `pg_dump`, nginx/TLS delante y el reinicio del droplet |
| F3.6 | [release] | ejecutor escribe el retiro; **NO se mergea a main** | canal probado en real | PENDIENTE_SERVIDOR | Retirar `deploy.yml` antes de que exista el canal real dejaría sin despliegue: se prepara, no se aplica |
| F3.7 | [infra] | ejecutor escribe script; ensayo parcial (destino local en vez de Spaces) | F3.4 ✅ | ✅ **COMPLETADA_LOCAL** — `f369b4c`, auditada **AMARILLO y aceptada**; **sus tres hallazgos (H1, H2, H4) corregidos el 18/08** —ver el cierre del bloque de auditoría— | Nace `infra/scripts/respaldo.sh` (258 líneas) y el paso 3 de `update.sh` hace tres cosas: dump, poda local y subida. Arnés de **37·165 con 10 mutantes** a **48 escenarios · 218 comprobaciones · 0 rojas** con **17 mutantes, 0 escapan** (~45 min), y tras la corrección a **51 · 236 · 0** con **21 mutantes**. ▸ ⚠️ **Su ejecutor dijo haber encontrado y corregido un defecto propio —la poda bajo el `set -e` de `update.sh`— y la auditoría lo falsó**: el contrafactual sobrevive y llega a las migraciones, porque `respaldo.sh:237` ya neutraliza `set -e` por su cuenta. La defensa que añadió está bien puesta pero su rama es **inalcanzable**. Sí es cierto que volvió a medir el arnés entero tras tocarlo. ▸ Credenciales **solo documentadas** —ninguna entra al repo— y **no viajan en `argv`**: archivo temporal con `chmod 600` pedido ANTES de escribir el secreto. ▸ **Fail-closed**: sin `respaldo.sh` al lado, el update se para ANTES del `pull`. La subida real a Spaces es tarjeta humana (TH-F37-A a D). **Cierra la segunda mitad de D4**: la retención de 3 respaldos locales que pide su paso 4 es exactamente la poda de `DIR_RESPALDOS` que hoy no existe. ⚠️ La retención remota (30 días) va por **regla de ciclo de vida del bucket, NO por un `rm` en el script** — el plan explica por qué y no es una preferencia de estilo |
| F3.8 | [infra] | ejecutor + ensayista | F3.4 ✅ | ✅ **COMPLETADA_LOCAL** — `84c6c20`, auditada **AMARILLO y aceptada** (18/08, veredicto en el bloque de abajo); su hallazgo **H-1 sigue abierto** y Jochelo aprobó cerrarlo con H1 y H2 | `PULL_ESPERAS="1 5 30"` configurable desde `instancia.env` (vacío = ningún reintento), `pull_una_vez()`/`pull_con_reintentos()` en `update.sh:399-435`, y la bandera **`--simular-fallo-pull`** que el plan pide en su comando de verificación. **La migración no se tocó**: sigue siendo una sola llamada a `correr_runner`, y ahora hay dos escenarios que lo cuentan. El comando literal del plan, corrido contra un `/opt/space-os` simulado: **salida 1, `grep -c reintento` = 3, 36,9 s reales** (1+5+30) y **el directorio de estado vacío** — ni respaldo, ni `version-anterior`. Arnés: de **32·121 con 7 mutantes** a **37 escenarios · 165 comprobaciones · 0 rojas** con **10 mutantes, 0 escapan**. ⚠️ La cuarta fila de la tabla del plan —el **reporte al padre**— es **F6.4**: queda documentada y **explícitamente sin implementar**. ▸ Hallazgo declarado por su ejecutor, medido y no defectuoso: un `PULL_ESPERAS` no numérico **no rompe el update** — `sleep` protesta por stderr (que **no llega a `update.log`**), no espera, y el pull se rinde igual sin tocar nada. Fail-safe, escrito en la tabla de configuración del README |
| F3.9 | [infra] | ejecutor + ensayista parcial | **F3.7** ✅ (`plan:1206`, no F3.4) | **CICLO 3 HECHO, en auditoría** — `d540833` ROJO → `70b8cc5` AMARILLO → `6fb93ec` ROJO → **`a490dd3`**. El tercero lo autorizó Jochelo fuera de presupuesto **con alcance cerrado en cuatro puntos**. Arnés: **79 escenarios · 399 comprobaciones · 0 rojas**, 37 mutantes con 5 aislados y cazados | **El diagnóstico cambió la forma de la tarea.** Medido antes de diseñar: `update.log` ya llevaba salida **cruda** —el runner (un error de Postgres arrastra la fila que lo provocó), `pg_dump`, `pg_restore`, y sobre todo **`docker logs --tail 30` del contenedor nuevo**, que son los registros de la aplicación—. Subirlo tal cual **habría incumplido el criterio**, así que la tarea no fue añadir una subida sino **separar lo que el script emite de lo que emiten sus herramientas**. ▸ **Dos logs, una sola regla**: `registrar` escribe en los dos; `eco` solo en el local. Viaja `update-publicable.log` —solo esta corrida, solo líneas del script y su código de salida—; se queda `update.log`, crudo y acumulado. **Sin lista de palabras prohibidas ni filtro por regex**, a propósito: un filtro se olvida de un caso y nadie se entera. Comprobado **leyendo** el archivo que viaja en un escenario de vuelta atrás: sale el diagnóstico entero y **ni una fila, ni una credencial, ni un nombre de tabla**. ▸ Arnés: **58 escenarios · 278 comprobaciones · 0 rojas** y **25 mutantes, 0 escapan** (~100 min). Rojo primero: **12 comprobaciones** en E52–E56. ▸ 🔴 **Límite declarado**: la subida cuelga de `salir()`, así que **si el proceso muere por una señal no hay log en el bucket**. Se intentó un `trap EXIT` y **no vale**: `respaldo.sh:168` hace `trap - EXIT INT TERM HUP` al cerrar su subida, así que quedaría **desarmado desde el paso 3**, justo donde las cosas salen mal. Cerrarlo exige tocar `respaldo.sh`, que está auditado: reportado, no arreglado. ▸ El bucket es **`space-os-logs`, distinto de `space-os-respaldos`**: dos buckets, dos reglas (90 días aquí, 30 allí) y **la llave de F3.7 a secas devuelve 403**. Tarjetas en `README.md` §8, hermanas de las de §7 |

> [!important] ✅ `2633bcb` auditado **AMARILLO** y aceptado — 2026-08-18
> `verificador` en sesión aparte. **Reprodujo el rojo de forma independiente**: corrió el
> arnés de hoy contra el `update.sh` del commit padre (`ab965a8`) y obtuvo **las 12 rojas
> exactas** que el ejecutor declaraba, en vez de creérselas. Cifras medidas por él, no
> copiadas: **32 escenarios · 121 comprobaciones · 0 rojas** (82 s) y **7 mutantes · 0
> escapan** (11 m 20 s). typecheck limpio, **821 unitarias en 74 archivos**.
>
> **D2 quedó cerrado del todo, y lo probó con los cuatro casos:**
>
> ```
> 200_ok      ANTES=200      (=200? si)   AHORA=200      (=200? si)
> 200_fallo   ANTES=200000   (=200? NO)   AHORA=200      (=200? si)   <- el release sano que se tiraba
> 000_fallo   ANTES=000000   (=200? NO)   AHORA=000      (=200? NO)
> mudo        ANTES=000      (=200? NO)   AHORA=000      (=200? NO)   <- sigue valiendo 000
> ```
>
> Confirmado además que es el **único** `curl` que lee códigos en el script, que el mutante
> nuevo es real (una línea de diff, mismo número de líneas, `bash -n` limpio, y el guard no
> lo neutraliza) y que **D1 no se tocó**: la región de restauración solo cambió en los dos
> textos de `salir` de D3. `aislamiento.e2e.test.ts` intacto, cero secretos, e2e no corridas
> con argumento que se sostiene (cero archivos bajo `apps/web/`, `db/` o `scripts/`).
>
> **Dos hallazgos ABIERTOS, no invalidantes, que valen un ciclo corto cuando haya hueco:**
>
> - **H1** · `update.sh:1150` y `:1160` —**remedidas leyendo tras `6fb93ec`**, que dejó el archivo
>   en **1181** líneas. El `pg_restore` sin guarda `-s "$BK"` de la misma zona está hoy en
>   **`:1158`**; ver el
>   aviso de más abajo sobre las tres veces que estas citas han derivado— la frase «el
>   contenedor de la version anterior esta
>   PARADO y aparcado como `$ANTERIOR`» **se afirma fija**, pero `comando_rescate()`
>   (`update.sh:953`) existe justo porque ese estado no siempre es cierto: si el `rename` de 5b
>   falló (`RENOMBRADO=0`), el viejo conserva su nombre y `${CONTENEDOR}-anterior` **no
>   existe** —lo borró `docker rm -f` en `:765`—. El camino es alcanzable. El comando que se
>   imprime **sí** es correcto en las dos ramas; lo que miente es la frase que va delante, en
>   el mensaje que alguien lee a las cuatro de la mañana. El README sí trae el matiz
>   (`infra/scripts/README.md:88-90`); el log no.
> - **H2** · el arnés no cubre la rama `else` de `comando_rescate()` (`:645`): E18 y E32 solo
>   ejercitan `RENOMBRADO=1`, y E21 fuerza el fallo del rename pero termina en la vuelta
>   atrás normal, no en un código 5. Un mutante que invirtiera la condición de `:642`
>   **no lo vería nadie**.
>
> Para VERDE bastaría con calcular esa frase igual que se calcula el comando, y un escenario
> que combine `D_RENAME_FALLA=1` con un código 5 y afirme que el log dice `docker start` **y
> calla** `docker rename`.

> [!important] ✅ `84c6c20` (F3.8) auditado **AMARILLO** y aceptado — 2026-08-18
> Cifras reproducidas por el verificador, no copiadas: **37 escenarios · 165 comprobaciones ·
> 0 rojas** y **10 mutantes · 0 escapan**. Reconstruyó el rojo previo corriendo el arnés nuevo
> contra `84c6c20^` y obtuvo **las 21 rojas exactas**, con E36/E37 en verde — o sea que el TDD
> declarado es cierto y esos dos **sí nacieron fijando un invariante que ya se cumplía**.
>
> **Y comprobó que muerden**, que era lo que se le pidió: aplicó él mismo el mutante «reintentar
> la migración fallida» y los vio caer, `se esperaban 1 llamadas … hubo 2`. Un caso que nace verde
> solo vale si algo demuestra que puede ponerse rojo.
>
> Las tres partes del criterio, medidas: **1 s, 5 s, 30 s exactos y tres reintentos, ni dos ni
> cuatro** (37,3 s de reloj) · el pull fallido dejó el directorio de estado **vacío**, sin
> `version-anterior` y sin que el de respaldos llegara a crearse, con **una sola llamada a docker**
> (`inspect`, de solo lectura) · y cada reintento numerado. **Ningún reintento sobre la migración
> está garantizado por estructura**, no por casualidad: `correr_runner` tiene exactamente dos
> sitios de llamada en 847 líneas, y el de la migración real es un comando único sin bucle.
>
> **F6.4 no se implementó**, correcto. D1, H1 y H2 intactos, comparados byte a byte.
>
> **Hallazgos abiertos, ninguno invalidante:**
>
> - **H-1 (el único que separa esto del verde)** · `update.sh:279-281` y `README.md:106` afirman
>   que `PULL_ESPERAS` vacío desactiva los reintentos (hoy en `update.sh:499` y `README.md:115`). **Es falso**: `${VAR:-default}` sustituye
>   también cuando la variable está **vacía**, no solo cuando falta. Medido escribiendo
>   `PULL_ESPERAS=""` en `instancia.env`, que es lo que haría un operador: **3 reintentos igual**.
>   Con un espacio (`" "`) sí da 0, y eso no está escrito en ningún sitio. Falla del lado seguro
>   —más reintentos sobre el paso que no toca la base— pero el código y su documentación **dicen
>   cosas distintas**. Colateral: el `${PULL_ESPERAS:-ninguna}` de `:435` es rama muerta.
> - **H-3** · el comando de verificación **del plan** (`:1193`) solo da 3 sobre un **log fresco**.
>   `update.log` no rota y el `cron` corre a diario, así que en un droplet con historial
>   `grep -c "reintento"` dará bastante más de 3 **sin que nada esté mal**. Es defecto del plan,
>   no del commit: **va en la tarjeta**, o quien la corra leerá un falso rojo.
> - **H-4** · «ningún reintento» es **dentro de una corrida**. El `cron` relanza cada noche, así
>   que una migración fallida sí se reintenta al día siguiente — es **D1**, y el plan no pide
>   cortacircuito. Que nadie lea el verde de F3.8 como «una migración rota nunca se vuelve a
>   intentar».
> - **H-2** · `pruebas-update.sh` es un archivo más de los que declara la tarea (`:1177`), y el
>   plan dice «prueba que falla primero: no aplica». Desviación declarada en el commit y
>   justificada: sin ese arnés no habría rojo que reproducir.

> [!important] ✅ `f369b4c` (F3.7) auditado **AMARILLO** y aceptado — 2026-08-18
> Todo reproducido, `--mutantes` incluido (**54 min**): **48 escenarios · 218 comprobaciones ·
> 0 rojas** y **17 mutantes · 0 escapan**, con los 7 nuevos cazados uno a uno. El rojo previo
> lo remidió y le salieron **19 rojas, no 18** — usar 19.
>
> Las credenciales pasaron el examen fino: **no viajan en `argv`** (espía doble: `s3cmd
> --config=<tmp>` y `AWS_ACCESS_KEY_ID` por entorno), y el **`chmod 600` va ANTES del
> secreto** —lo midió por el tamaño del archivo en el instante de la llamada: 0 bytes—.
> `gsutil` es **imposible por construcción**. El `rm` de la poda solo toca dumps: probado con
> `LEEME.txt`, un `.dump.bak`, un archivo que empieza por guion, un **subdirectorio que casa
> el patrón** y uno en subcarpeta; los cinco intactos. Cero borrados remotos. D1, H1 y H-1
> intactos. **D4 cerrada entera.**
>
> **🔴 HALLAZGO 1 — el más serio, y no es teórico: la poda ordena por NOMBRE y puede borrar el
> respaldo de la corrida en curso.** `respaldo.sh:230` hace `find … | sort`, que ordena **la
> ruta**, no la antigüedad. Basta un nombre con una letra para colarse por delante:
>
> ```
> ls -1t (más nuevo arriba)          podar $SB 3
> spaces_20260818_033000.dump  ←ESTA  → "1 respaldo(s) retirados, quedan los 3 mas recientes"
> spaces_z.dump                corrida   ls -1 → spaces_x  spaces_y  spaces_z
> spaces_y.dump                          >>> el dump de ESTA corrida: BORRADO
> ```
>
> **Y el nombre patológico es el que el propio script documenta** (`respaldo.sh:11` y README §7:
> `respaldo.sh subir …/spaces_x.dump`). La cadena: la poda va **antes** de la subida
> (`update.sh:648`, `:657`) → `$BK` desaparece → no se sube → `RESPALDO REMOTO FALLIDO` → las
> migraciones corren → y si hace falta vuelta atrás, `update.sh:881` hace `pg_restore` sobre un
> archivo que no existe, **sin guarda `-s "$BK"`** → instancia sin servicio, sin respaldo local
> y sin respaldo remoto. El arnés no lo veía: **E40 solo siembra nombres con formato de fecha**.
>
> **HALLAZGO 2** · `respaldo.sh:239` — el resumen cuenta lo que pensaba borrar, no lo borrado.
> **HALLAZGO 4** · no hay un solo `trap`: el temporal con el secreto **sobrevive a un SIGTERM**.
>
> **HALLAZGO 3 — y este corrige el commit anterior: el defecto que su ejecutor dijo haber
> encontrado NO se reproduce.** El auditor montó el contrafactual —llamada suelta bajo
> `set -euo pipefail` con un `rm` que siempre falla— y **el update sobrevive y llega a las
> migraciones**, porque `respaldo.sh:237` ya es `rm -f … || registrar`, que neutraliza `set -e`
> por sí solo. Además `respaldo_local_podar` no tiene ningún camino que devuelva ≠0, así que el
> `AVISO` de `update.sh:649` es **código muerto**. La defensa está bien puesta y no estorba;
> **lo que no se sostiene es la narrativa de `f369b4c`** («habría matado el update aquí»).
>
> Los tres primeros van a un ciclo de corrección; el tercero se corrige aquí, por escrito.
>
> **✅ H1, H2 y H4 corregidos el 18/08, mismo turno.** La poda ordena por `mtime`
> (`find -printf '%T@'` + desempate por ruta), el resumen cuenta lo retirado y devuelve
> **≠0** si no pudo con todo, y el temporal con la llave tiene `trap` para `TERM`, `INT`,
> `HUP` y `EXIT`. Arnés: **51 escenarios · 236 comprobaciones · 0 rojas** y **21 mutantes ·
> 0 escapan**; los tres escenarios nuevos (E49, E50, E51) se vieron **en rojo, 9
> comprobaciones**, antes de tocar una línea — **9 medidas por el auditor**; el commit y el
> tablero dicen 8, y la explicación probable es benigna: E51 ganó su cuarta comprobación
> *después* de medir el rojo. Tal como estaba escrito no se reproducía.
>
> **Y las citas de este bloque son de `f369b4c`: ya no valen.** `respaldo.sh` pasó de 258 a
> **331** líneas y `update.sh` de 903 a **907**. Hoy: el `find` de la poda es
> **`respaldo.sh:287`**, el resumen **`:305`** (y **`:307`** la rama del fallo parcial), las
> llamadas son **`update.sh:652`** (poda) y **`:660`** (subida), y el `pg_restore` **sin
> guarda `-s "$BK"`** —que **NO se tocó**: es zona de D1— es **`update.sh:884`**.
> `respaldo.sh:11` sigue donde estaba.
>
> **H3 deja de ser cierto en la dirección que importa**: `respaldo_local_podar` **ya tiene un
> camino que devuelve ≠0**, así que el `AVISO` de **`update.sh:653`** dejó de ser código
> muerto. La defensa que su ejecutor puso —y que la auditoría demostró inalcanzable— hoy se
> alcanza, y **E50 la ejerce**.

> [!danger] 🔴 `d540833` (F3.9) auditado **ROJO** — 2026-08-18. En corrección, ciclo 1 de 2
> **El rechazo NO es por fuga de datos.** La auditoría leyó el archivo que viaja en los **58
> escenarios** y no encontró ni una fila de negocio, ni una credencial, ni salida cruda de
> ninguna herramienta; la regla «`registrar` escribe en los dos, `eco` solo en el local` **no
> tiene fugas**, y los cuatro mutantes que la defienden muerden. El diseño de dos logs es
> correcto. **Se rechaza porque tres documentos afirman cosas que el código no cumple.**
>
> **Invalidante 1 · el proceso que pierde el candado escribe en el log de la corrida que lo
> tiene.** `update.sh:386` exporta `SPACE_OS_UPDATE_EN_CANDADO=1` **antes** del `flock` de
> `:388`, así que cuando `flock -n -E 75` devuelve 75 el proceso exterior conserva la variable,
> pasa el guard de `:312` y su línea acaba dentro del `update-publicable.log` ajeno —
> **reproducido**. Lo desmienten `README.md:597-598`, `update.sh:248-250` y
> `entorno-y-despliegue.md:610-611`, los tres con la frase «no escribe ni sube nada». **El arnés
> no lo veía**: su escenario de candado solo afirma `no_hubo 's3cmd'`, la mitad «no sube», y
> **nunca abre el archivo publicable**.
>
> **Invalidante 2 · «salga bien o mal» no se cumple en 12 salidas.** `subir_log_remoto`
> (`:337`) depende de funciones de `respaldo.sh`, que no se sourcea hasta `:533`; las doce
> salidas anteriores (`:384, :404, :436, :437, :440, :467, :469, :521-:524, :531`) escriben el
> publicable y **no suben nada**. Son los fallos de **instancia mal aprovisionada**, o sea la
> clase que el criterio del plan quiere diagnosticar sin entrar al servidor. Y el 75 ni siquiera
> pasa por `salir()`: `:392` sale con un `exit` pelado.
>
> ⚠️ **Elevado a prioritario por el orquestador, aunque la auditoría lo dejó fuera de los
> invalidantes:** `destino_de_url` (`:445-447`) **no corta la credencial** cuando la contraseña
> lleva `@` o `/` sin codificar (`p@ssw0rd` → `ssw0rd@localhost…`; `pa/ss` → `spaces:pa/ss@…`),
> y su salida es **la primera línea de todo log que viaja** (`:539`). La función es anterior al
> commit, pero **el commit le cambió el perfil de riesgo**: lo que se quedaba en el droplet
> ahora sale a un bucket.

> [!important] Ciclo 1 de corrección de F3.9 — `70b8cc5`, pendiente de auditoría
> Los tres arreglos, uno por línea: la marca del candado va **en la misma línea del `flock`**, sin
> `export`, así que el proceso que lo pierde ya no pasa el guard · **`respaldo.sh` se sourcea justo
> después de `$CONF`** —y no antes, porque deriva `SPACES_ENDPOINT` de `SPACES_REGION` al
> sourcearse— · y `destino_de_url` **corta por el último `@`** tras quitar la consulta.
>
> **Corrigió el enunciado del invalidante 2, y a la baja: de las 12 salidas, hoy viajan 9.** Las
> otras tres **no tienen con qué subir por definición** —falta `$CONF`, falta el propio
> `respaldo.sh`, o falta `flock` y ni siquiera llega a tener log publicable propio—. Está escrito
> como 9 en el código, el README y la bóveda, en vez de redondear a 12. Es la clase de precisión
> que conviene premiar: un enunciado mío repetido sin comprobar habría dejado una cifra falsa.

> [!danger] 🔴 Hallazgo nuevo, **verificado por el orquestador**: `PG_URL_SEGURA` mete un trozo de
> contraseña en `argv`
> `infra/scripts/update.sh:558-579` parte la URL por el **primer** `@` —`pg_userinfo="${pg_resto%%@*}"`,
> `pg_destino="${pg_resto#*@}"`—, que es **el mismo defecto de parseo** que acaba de corregirse en
> `destino_de_url`. Con `postgresql://spaces:p@ssw0rd@localhost:5433/spaces` el resultado es
> `postgresql://spaces@ssw0rd@localhost:5433/spaces`, y esa cadena viaja a
> **`--dbname="$PG_URL_SEGURA"` (`:589` y `:591`)**, o sea al **`argv` de `pg_dump`/`pg_restore`:
> visible en `ps` para cualquier proceso del droplet**. Con `pa/ss` ni siquiera separa, y la
> conexión queda mal formada.
>
> **No sale del droplet** —eso ya lo cierra `destino_de_url`— pero es zona de la contraseña.
> Comprobado leyendo las líneas el 18/08. Se cierra con el ciclo corto de H1, H2 y H-1, que toca
> el mismo archivo.

> [!important] ✅ `70b8cc5` auditado **AMARILLO** — los dos invalidantes CERRADOS, provocándolos
> **El que pierde el candado ya no escribe ni una línea** en el publicable ajeno (provocado con un
> doble de `flock` sobre un publicable a medio escribir; antes contaminaba, ahora no) y **nueve de
> las doce salidas de configuración suben**. Las tres restantes son **imposibles de verdad**,
> verificado una por una: falta `flock` —sale antes del candado y ni crea publicable—, falta
> `$CONF`, o falta el propio `respaldo.sh`. **El 9 del ejecutor es correcto**; mi enunciado de 12
> era el que estaba mal.
>
> Verificado también: el orden nuevo del `source` es necesario y no rompe nada —`respaldo.sh:84`
> deriva `SPACES_ENDPOINT` de `SPACES_REGION` al sourcearse, medido en las dos direcciones—; los
> siete mutantes son válidos (1098 = 1098 líneas, una línea de diff, `bash -n` limpio) y caen **con
> el número exacto de rojas declarado**; y desde `update.sh:601` hasta el final el archivo es
> **byte a byte idéntico** al padre, así que D1, H1, H2 y H-1 están intactos **por construcción**.

> [!danger] 🔴 Cuatro defectos para el ciclo siguiente — los cuatro en `update.sh` y casi juntos
> **H-A · REGRESIÓN** (`update.sh:522`) — el `sed` nuevo quita la consulta **antes** de cortar por
> el último `@`, así que un `?` dentro de la contraseña decapita la cadena antes de que haya `@`
> que cortar: `spaces:cl?ve@localhost…` sale como **`base=spaces:cl`** al archivo que viaja.
> **La versión anterior lo hacía bien**, y libpq acepta esa URL, o sea que es una instancia real.
> Incumple el criterio que el propio commit escribió dos líneas antes (`:517-519`).
>
> **`PG_URL_SEGURA`** (`:558-579`) — **peor de lo reportado: no es solo fuga, la instancia no
> puede actualizarse nunca.** Parte por el primer `@`, igual que hacía `destino_de_url`. Medido en
> `argv` real: de `p@ssw0rd` acaban seis de ocho caracteres (`ssw0rd`) en `--dbname=`; de `pa/ss`,
> la clave entera más el usuario. Y **libpq también corta por el primer `@`**, así que `pg_dump`
> **no conecta** y el update aborta en el respaldo **en todas las corridas**. Disponibilidad,
> no solo confidencialidad. ▸ Barrido: **no hay más sitios con ese patrón**; `migrar.mjs:225-232`
> usa `new URL()` y es segura.
>
> **H-B** (`:470`) — «esos tres lo DICEN» es falso para el caso de `flock`: sale antes del candado
> y no puede decirlo. Arrastre en `entorno-y-despliegue.md`, bloque `[!warning]`: dice «los dos»
> y son tres, y uno no lo dice. **Misma clase de defecto que motivó el ROJO, a escala de oración.**
>
> **H-C** (`:245-248`, README y bóveda) — «por esa puerta pasan seis de los siete códigos» excepciona
> solo el 75; hay dos más (`--help` y argumento inválido, `:315-316`). Atenuante: son anteriores al
> candado y el punto 1 ya acota «una vez tomado el candado». Precisión, no defecto de fondo.

> [!important] La barrida de mutación ya no cabe en un ciclo — dato medido el 18/08
> La auditoría **no pudo terminarla: la mató el entorno tras ~5 h**, con 12 de 25 cazados y 0
> escapes. Midió **~25 min por mutante en esta máquina**, contra los ~4 que implican los 100 min
> declarados por el ejecutor. Verificó **16 de 25** (12 de la corrida + los 4 de F3.9 aislados
> con `probar_mutante_en`), **0 escapan**; los 9 restantes son ajenos a la tarea. La afirmación
> «25 mutantes · 0 escapan» **no queda desmentida, pero tampoco reproducida entera**, y el
> motivo es de entorno, no del commit.
>
> **Consecuencia práctica:** a 25 mutantes × 25 min, la barrida completa pasa de **10 horas**.
> Con el arnés creciendo cada tarea, exigirla por ciclo bloquea la ejecución. **Resuelto en M1**,
> arriba: se exige el arnés entero más los mutantes del propio cambio, y lo no corrido se declara.

> [!warning] Hueco de la bóveda detectado por F3.9 — `modelo-instancias-soberanas.md:93-101`
> Su tabla «Las nueve fases, convertidas en tareas» **conserva los recuentos del plan v2**:
> Fase 2 dice 5 y son 6, **Fase 3 dice 6 y son 9**, Fase 5 dice 7 y son 8, Fase 6 dice 3 y son 4.
> Suma ~34 contra las **46** del v3. Quien lea esa nota para saber cuánto falta, se llevará una
> cifra del plan archivado.

> [!warning] Propuesta: dejar de citar `update.sh` por número de línea en el tablero
> Van **siete** correcciones de citas en tres días sobre este archivo, que ha pasado de 786 a
> **1181** líneas. El patrón está claro y no es descuido de nadie: **cualquier cita a `update.sh`
> caduca en el siguiente commit**. La salida barata es citar **por nombre de función**
> —`partir_url`, `comando_rescate`, `respaldo_local_podar`— que no derivan, y dejar el número de
> línea solo donde de verdad haga falta señalar una línea concreta. Pendiente de decidir.

> [!danger] Estas citas han derivado CINCO veces en dos días — remídelas, no las restes — remídelas, no las restes
> `update.sh` pasó de 786 a 847, a 903 y a **907 líneas** entre `2633bcb`, `84c6c20`,
> `f369b4c` y `d9d3747`. Las
> citas de H1 se recalcularon dos veces y **las dos mal**: la segunda, en `d7775b3`, sumó 47
> donde el archivo había crecido 56, y arrastró `comando_rescate()` a `:641-647`, que hoy es el
> comentario de la poda de F3.7. Corregidas y **verificadas leyendo la línea** el 18/08 04:00.
>
> **Y volvió a pasar una cuarta vez**, en `d9d3747` — el commit cuyo párrafo de arriba existe
> justamente para remedir citas: dio `respaldo.sh` en 324 líneas cuando son **331**, y sus
> cuatro citas nuevas erraban **las cuatro por 7**. Lo cazó la auditoría; quedan corregidas
> leyendo la línea.
>
> Es lo que `CLAUDE.md` §5 avisa, **cuatro veces en la misma noche** y en los dos archivos que
> más rápido crecen del repositorio. La lección ya no es «ten cuidado»: es que **una cita
> recalculada a mano es una cita rota**. Si citas `update.sh` o `respaldo.sh`, ábrelo — y si
> escribes un párrafo para remedir citas, remídelas de verdad.

> [!warning] Hueco del plan detectado por F3.7 — para cuando llegue **F5.3**
> F3.7 nombra «la plantilla `.env` de F5.3» entre sus archivos, y su ejecutor **no la creó**,
> con razón: F5.3 (`plan:1494-1498`) declara `infra/env/instancia.env.example` como archivo
> **nuevo** y su prueba en rojo es literalmente «falla hoy: el archivo no existe». Crearla ahora
> **dejaría a F5.3 sin su primer rojo**.
>
> Pero la lista de claves de F5.3 (`plan:1500-1512`) **no incluye** `SPACES_KEY`,
> `SPACES_SECRET`, `SPACES_BUCKET`, `INSTANCIA` ni `RESPALDOS_LOCALES`, que es lo que F3.7
> necesita para funcionar. Mientras tanto están documentadas en la cabecera de `update.sh` y en
> `infra/scripts/README.md`. **F5.3 tiene que añadirlas cuando le toque**, o la plantilla nacerá
> incompleta y ninguna instancia respaldará fuera de su droplet.

> [!note] Sobre el orden: F3.8 se hizo antes que F3.5, F3.6 y F3.7 — **deliberado**
> El plan ordena las tareas pero manda el campo «Depende de», y el de F3.8 es **F3.4**, que está
> ✅. F3.5 exige la DEMO real y F3.6 no puede aplicarse antes de que exista el canal —retirar
> `deploy.yml` hoy dejaría al proyecto sin despliegue—, así que ninguna de las dos es ejecutable
> desde aquí. **Lo que sí estaba mal era el orden que traía el turno nocturno**: ponía F3.9 antes
> que F3.7, y F3.9 declara «Depende de: F3.7 (reutiliza credenciales y bucket)» (`:1206`).
> Corregido: **F3.7 primero**, y F3.9 después.

> [!danger] 🔴 D1 · La vuelta atrás de `update.sh` **no devuelve el esquema** — abierta, espera decisión
> Salió del ensayo local del 18/08 y **no se tocó a propósito**: toca migraciones y pide
> una decisión de diseño, no un parche.
>
> `infra/scripts/update.sh:110-115` y `:732`, y `infra/scripts/README.md:159-164`, afirman
> que restaurar el dump devuelve «a la vez el esquema y el registro». **Medido: es falso.**
> `pg_restore --clean --if-exists` solo suelta los objetos **que están en el dump**; los que
> creó la migración nueva no estaban, así que **sobreviven a la vuelta atrás**:
>
> ```
> tras VUELTA ATRAS COMPLETA:
>   tabla ensayo_marca_dos existe?      t
>   registrada en schema_migrations?    f     (registro = 68 filas, correcto)
> ```
>
> Y el propio instrumento del script lo denuncia sin que nadie lo mire: la huella de esquema
> tras restaurar **no es** la de antes de migrar.
>
> **La consecuencia, reproducida de punta a punta** con una migración no idempotente: el
> primer intento aplica, la salud falla, restaura y sale **4** dejando la tabla dentro sin
> registrar; el segundo muere con `relation … already exists` y sale **2**. Es decir, **ese
> release no se puede volver a aplicar nunca**, el `cron` lo reintenta cada noche con código 2
> y hace falta una persona. Con migraciones idempotentes no atasca, pero la instancia se queda
> con objetos que su versión no conoce y que nadie declara.
>
> **Dos salidas.** (a) Restaurar sobre un esquema limpio. (b) Barata y con lo que ya existe:
> releer la huella **después** del `pg_restore` y gritar si no coincide con `HUELLA_ANTES`.
> Lo que no se puede es dejarlo así **y** sostener lo que el README promete.
>
> Mientras siga abierta: **el código 4 no significa «la base volvió tal cual estaba»**.

> [!danger] 🛑 `6fb93ec` auditado **ROJO** — segundo, presupuesto agotado, **escalado a Jochelo**
> **Las dos fugas que el ciclo se propuso cerrar están cerradas y verificadas**: un barrido de
> **198 URLs** (11 formas × 18 variantes de clave con `@ / ? # : % \ espacio`) salió **196 limpias**,
> y las 2 con residuo son una forma degenerada sin host que **libpq y `pg-connection-string` leen
> igual**, o sea una instancia que nunca funcionó. `partir_url` corta por el último `@`, la clave
> va por `PGPASSWORD`, y el fallo cerrado se da **antes de tocar nada** (ni `docker`, ni `pg_dump`).
>
> **🔴 Invalidante — queda una TERCERA vía que el parseo nuevo nunca mira: la consulta.**
> `postgresql://spaces@host:5433/spaces?password=X` → `pg_dump --dbname=…?password=X`, **entera y en
> claro en `argv`, visible con `ps`**. Igual con `?sslpassword=`. La consulta **se conserva a
> propósito** (`update.sh:654`: «quitarla cambiaria como se conecta») y viaja verbatim.
> **No es una forma inventada**: libpq la acepta —medido— y `pg-connection-string`, que es lo que
> usan la app y `scripts/migrar.mjs`, **la lee como la contraseña**. Bajo **M2** es invalidante por
> definición, aunque el aprovisionamiento del proyecto no la escriba hoy.

> [!warning] Tres hallazgos no invalidantes de ese mismo veredicto, y uno pesa más que el rojo
> **① La ambigüedad está mal descrita y su alcance es mayor.** `update.sh:534-537` y
> `README.md:107` prometen parada con salida 1. **Medido: con puerto NO para.** Publica un `base=`
> **falso** al bucket y muere cuatro pasos después como `BACKUP VACIO` — que la cabecera del propio
> script define como «NO SEGUIR, avisar a una persona». **Un fallo de parseo se presenta como un
> fallo de respaldo.** Caen ahí: valor de consulta con `@` (`?application_name=space-os@demo`),
> base con `@`, y en parada dura **multi-host** (`host1,host2`) y **URL de socket** — las dos
> últimas son instancias que hoy funcionan y **no volverían a actualizarse nunca**.
>
> **② El README promete algo que rompe la instancia de un owner.** `README.md:107` y
> `update.sh:76-79` dicen que la contraseña puede llevar `@`, `/`, `?` o `\` sin codificar.
> **Medido: `pg-connection-string` lanza `Invalid URL` con `pa/ss` y con `cl?ve`; libpq rechaza `@`
> y `/`.** De los cuatro, solo `\` lo aceptan los dos clientes. Quien siga el README obtiene una
> instancia **cuyo respaldo corre y cuya app y cuyas migraciones no**. A mi juicio esto pesa más
> que el invalidante, porque el invalidante exige una forma que nadie escribe y esto se lee como
> instrucción.
>
> **③ Un comentario afirma un hecho falso que sostiene la decisión de diseño.**
> `update.sh:519-521` dice que cortar por el primer `@` «ni siquiera es lo que hace libpq».
> **Medido: libpq sí corta por el primer `@`.** La regla implementada —último `@`— es la de
> WHATWG/node-pg, y **eso es justamente lo que hace correcto** mandar la clave por `PGPASSWORD`.
> El tablero y el mensaje del commit lo dicen bien; el comentario dice lo contrario.

> [!important] ✅ **D1 EJECUTADO** — `9d609f0`, pendiente de auditoría (19/08)
> `rgb` sale del esquema base y vive ahora en **`db/semilla-desarrollo.sql`**, que **no viaja en
> la imagen**; lo aplican el compose local y `recrearEsquema()` **entre `schema.sql` y las
> migraciones** — esa posición es la que mantiene el arnés reproduciendo el droplet y la que hace
> disparar el backfill. Medido: base nueva con **`tenants=0`, `config_negocio=0`**, luego
> **67 aplicadas / 39 tablas / exit 0**, y 2.ª corrida **0 aplicadas**. E2E corridas por ser
> tenant: **181 + 1 saltada en 16 archivos**, con `aislamiento.e2e.test.ts` intacto.
>
> ▸ **Consecuencia operativa que conviene saber antes del merge:** quien tenga un volumen de
> Docker viejo **no ve el cambio** (`schema.sql` solo corre al crear el volumen), y quien levante
> uno nuevo necesita la semilla — el compose ya la monta como `02_semilla_desarrollo.sql`.
>
> ▸ **Desbloquea F5.2**, que asume `count(*) from tenants = 0` para su ruta de un solo uso: antes
> habría dado 1 y **habría contestado 404 siempre**.

> [!danger] 🔴 Hallazgo del mismo ciclo, para la Fase 5: **todas las instancias nacen con la misma
> contraseña conocida**
> `apps/web/scripts/bootstrap-auth.mjs` usa `SEED_PASSWORD ?? 'spaces123'` y **el insert no marca
> `debe_cambiar_password`**. Preexistente y fuera del enunciado, pero en el modelo de instancias
> deja de ser un detalle de desarrollo: **cada owner nuevo nacería con la credencial que todos
> conocen**. Material de **F5.2**.

> [!danger] 🔴 El ensayo de Fase 4 encontró DOS defectos que impiden que el modelo funcione
> **D1 · `db/schema.sql:598` siembra el tenant `rgb` en TODA base nueva.** ROJO: toca tenant.
> ```sql
> insert into tenants (nombre, slug) values ('RGB Catorce','rgb') on conflict (slug) do nothing;
> ```
> Medido en una base recién nacida: `tenants = 1` (`rgb`) y `config_negocio = 1`.
> **Rompe el criterio de F4.2** —«ni una fila de ningún owner»: es 1, no 0— y **rompe el comando
> de verificación de F4.5**, que exige que los slugs de DEMO y de `spaces_prod` **no compartan
> ninguno**: `rgb` estaría en las dos listas. Y lo de fondo: **cada instancia de owner nace
> cargando la identidad de otro owner**, que es justo lo que el modelo de instancias soberanas
> existe para evitar.
>
> **D2 · `rol_permisos` nace con 5 filas de un solo módulo.** Único sembrado del repo:
> `db/migrations/20260804_modulo_inventario.sql:22`. Base nueva: **5 filas / 1 módulo**. Base de
> desarrollo: **25 filas / 8 módulos**. Sin respaldo en código —`auth.ts:126-134` lee la tabla y
> nada más—, así que **un Dueño en una instancia recién aprovisionada ve la aplicación entera
> vacía**. Falla cerrado, no es fuga, pero **bloquea F4.4 y toda la Fase 5**.

> [!warning] Y cuatro más del mismo ensayo, ninguno de decisión
> **D3 · `Dockerfile:94-95` no copia `scripts/migrar.mjs`**, contradiciendo su comentario de
> `:90-92`. `pg` sí viaja. **El arreglo es una línea y está probado**:
> `COPY --chown=node:node scripts/migrar.mjs ./scripts/migrar.mjs`.
>
> **D4 · Una migración fallida deja la base irrecuperable.** Tras abortar en la 52,
> `schema_migrations` **no existe** pero 51 migraciones ya corrieron. El runner sin bandera dice
> «no tiene registro pero YA tiene datos, no lo adivino» (exit 1) y `--instalacion-nueva` dice
> «sobre una base que SÍ tiene historia» (exit 1). **Los dos caminos se niegan; único recobro,
> `drop database`.**
>
> **D5 · El rol debe existir ANTES del runner y nada lo obliga.**
> `20260715_arr_m6_rol_restringido.sql:20-21` es `if exists (…) then` → **no-op silencioso** sin
> rol; una vez registrada como aplicada no vuelve a correr, así que crear el rol después deja un
> rol de app **sin ningún GRANT**. **D6**: `db/dev-rol-app.sql` está marcado *solo desarrollo*,
> lleva la contraseña en claro y no viaja en la imagen. Insumo de la Fase 5.

> [!tip] Dos hechos que corrigen lo que creíamos
> **① La imagen de release con las 68 migraciones YA se construyó.** El intento que dimos por
> «colgado» en realidad **completó el primer `docker build` del `Dockerfile` real**: tres etapas,
> 240 MB, las 68 dentro. Llevábamos días repitiendo que nadie la había construido. Se reconstruye
> con `docker build -t space-os:f4-ensayo --build-arg VERSION=v0.0.0-ensayo-f4 .`
>
> **② El autoregistro quedó cerrado de punta a punta**, salvo el ojo humano: **503** en el
> endpoint, `{"autoregistro":false}` en `metodos`, y **0 ocurrencias de «Crear cuenta» en el HTML
> servido** (15 104 B contra 15 234 B con el botón horneado). Cerrado además por construcción en
> `login/page.tsx:66,83,365`. Pero **van dos ensayos que no lo ven con un navegador**: sigue en
> la tarjeta.

> [!important] Ciclo 3 de F3.9 — `a490dd3`. Lo que enseñó vale más que lo que arregló
> Los cuatro puntos, cerrados: se quitan del `--dbname` **solo** `password` y `sslpassword`
> —el resto de la consulta se conserva **byte a byte**, y sin parámetro de credencial la URL **ni
> se reescribe**—; el README deja de prometer que la clave puede llevar `@ / ? \` en crudo; la
> ambigüedad se describe como es (**con puerto no se para**); y el comentario invertido sobre
> libpq queda corregido. **No se tocó** el parseo, ni multi-host, ni socket.
>
> Fundamento empírico de la decisión, medido contra un Postgres efímero: **la contraseña de la
> consulta GANA sobre la del `userinfo`** en libpq y en `pg-connection-string` —`userinfo` mala
> + consulta buena entra; al revés, «password authentication failed»—. Por eso es esa la que va
> a `PGPASSWORD`.
>
> **🔬 Tres defectos propios, cazados escribiendo el arreglo, y ninguno visible para el arnés:**
>
> **①** `env PGPASSWORD=… pg_dump …` deja el secreto en el **`argv` de `env`**: la misma fuga por
> otra puerta, un comando más allá. **El arnés no puede verlo** —los dobles reciben su propio
> `argv`, no el del proceso que los lanzó—, así que esa defensa **no está protegida por ninguna
> prueba**. Vuelto al prefijo de asignación de bash, con el porqué escrito en el código.
>
> **②** Decidir la reescritura por «hay contraseña» dejaba la URL entera en `argv` con
> `?password=` **vacío**, porque **la consulta vacía pisa la del `userinfo`**. Un parámetro sin
> valor no es un parámetro ausente.
>
> **③ `PGSSLPASSWORD` no existe.** Medido sobre `libpq.so.5` de `postgres:16-alpine`:
> `PGSSLMODE`, `PGSSLKEY`, `PGSSLCERT` y `PGSSLROOTCERT` están; esa, **cero apariciones**. La
> primera versión la usaba y **«funcionaba» porque una variable que nadie lee tampoco estorba**.
> Es un arreglo que parecía correcto porque **el mecanismo en el que se apoyaba no existía**.
> Ahora `sslpassword` **se descarta y el log lo dice** → tarjeta humana: si alguna instancia lo
> lleva en su `DATABASE_URL`, revisarlo antes de desplegar.
>
> ▸ Límite escrito en el código: **`?PASSWORD=` en mayúsculas sí viaja** a `argv`. libpq rechaza
> esa URL, así que nunca funcionó en ninguna instancia; no se le inventa significado.

> [!important] ✅ **D2 EJECUTADO** como **T-05** — `9c41606`, pendiente de auditoría (19/08)
> Nace `db/migrations/20260819_semilla_rol_permisos.sql`: **25 filas, 8 módulos, 3 roles** en toda
> base nueva, idempotente y no-op sobre una base que ya las tenga. E2E obligatorias corridas:
> **186 + 1 saltada en 17 archivos**, `aislamiento.e2e.test.ts` intacto. Antes, un Dueño recién
> creado recibía de `permisosDeRol` **una sola área abierta de 18**.

> [!warning] Y corrigió un dato que el orquestador dio mal — la corrección importa
> **No son «19 módulos y 11 sin permisos».** `apps/web/lib/modulos.ts` declara **18 ÁREAS** y de
> ellas **deriva** los módulos (`:57-60`, con el comentario «dos listas divergen, una no puede»).
> `actividad`, `almacen`, `campanas`, `clientes`, `comisiones`, `creativos`, `disponibilidad`,
> `integraciones` y `propuestas` son **áreas**, no módulos, y las gobiernan `comercial`,
> `operaciones` y `administracion`, **que sí tienen permisos**: son accesibles.
> **El único módulo huérfano es `imprenta`** (`modulos.ts:42`). No se sembró —sería inventar
> política de acceso— y queda fijado por la prueba.

> [!danger] 🔴 Hay DOS catálogos de permisos en el repo y NO coinciden — muerde en la Fase 5
> `apps/web/scripts/bootstrap-auth.mjs:90-99` lleva su propia `MATRIZ` de **36 filas**, con el
> módulo `imprenta` y con los roles `FINANZAS` e `IMPRENTA`, y **sin `inventario`** — es anterior
> al ADR 0010.
>
> **Si el aprovisionamiento corre el bootstrap después de las migraciones, la instancia acaba con
> la UNIÓN: 41 filas, no 25 — y sin dar un solo error.** Es exactamente el modo de fallo que el
> comentario de `modulos.ts:56` advierte para otra cosa: «dos listas divergen, una no puede».
>
> Desmiente además la frase con la que se encargó la tarea —«el único sembrado de todo el repo»—:
> era el único **en SQL**, no en el repo. Decisión pendiente para la Fase 5.
>
> ▸ Y dos roles del enum, **`IMPRENTA` y `FINANZAS`**, se ofrecen al dar de alta un usuario
> (`components/demo/shell/nav.ts:132-133`) y **no abren nada**: la misma trampa que el ADR 0010 le
> cerró a `CLIENTE`. Medido, no resuelto: es decisión de negocio.

> [!warning] Desviación declarada: se entra a la Fase 4 con **F0.1 sin ejecutar** — 2026-08-19
> El plan dice que **F0.1 bloquea toda la Fase 4** (`plan:260`), y F0.1 es una comprobación contra
> el droplet que **solo puede correr una persona** (tarjeta **TH-F0.1**, emitida y sin correr).
> Se entra igual **por decisión explícita de Jochelo**, y queda escrito aquí en vez de lanzarse en
> silencio — que es lo que la regla del orquestador exige.
>
> **Alcance de la desviación:** solo lo simulable en local (**F4.2**, **F4.4** y el smoke de
> **F4.5** contra `localhost`). **Nada de lo ensayado puede depender del estado real del droplet**;
> lo que lo necesite sale como tarjeta. **F4.1** y **F4.3** no se tocan.
>
> **Lo que la desviación NO resuelve:** si el registro estuviera abierto hoy en el droplet, seguirá
> abierto. Ensayar DEMO en local no lo cierra ni lo mide.

### Fase 4 · DEMO como instancia real → en local: DEMO simulada

| Tarea | Tipo | Agente | Depende de | Estado | Notas |
|---|---|---|---|---|---|
| F4.1 | [verificación] | tarjeta humana | — | PENDIENTE_SERVIDOR | Censo del droplet actual: solo una persona |
| F4.2 | [infra] | ensayista-local | F2.5 | ⚠️ **ENSAYADA_LOCAL — criterio de datos INCUMPLIDO por D1** | **La receta exacta**, medida: (1) `db/dev-rol-app.sql` **antes que nada**, (2) `db/schema.sql`, (3) `migrar.mjs --instalacion-nueva` → 67 aplicadas, **39 tablas**, exit 0; 2.ª corrida = 0 aplicadas. **Sin el paso 1 aborta en la 52 de 68.** Rol `spaces_app` NOSUPERUSER/NOBYPASSRLS ✅ |
| F4.3 | [infra] | tarjeta humana | F4.2 real | PENDIENTE_SERVIDOR | Dominio + certificado: no se simula con hosts falsos |
| F4.4 | [infra] | ensayista-local | F4.2-local | ⚠️ **ENSAYADA_LOCAL — bloqueada por D2** | Los datos entran y se leen bajo RLS, pero `/api/estado/` los devolvía **vacíos**, y **no es RLS ni tenant: es el catálogo de permisos** (D2). ⚠️ **El plan está desactualizado**: `:1345` pide `NEXT_PUBLIC_AUTOREGISTRO=1` y la bandera ya es `AUTOREGISTRO` de runtime; `:1351` espera 400 y lo correcto es **503** |
| F4.5 | [verificación] | ensayista-local + tarjeta humana | F4.4 | ⚠️ **SMOKE LOCAL EN VERDE**; el real, tarjeta | El cierre del riesgo es contra la DEMO real. 🔴 **Su tarjeta, cuando se escriba, tiene DOS instrucciones opuestas en la bitácora y solo una vale.** La del 14/08 —arrancar con `AUTOREGISTRO=1` y esperar `signup` **400**— quedó **invertida** el mismo día al cerrar el registro en toda la flota, DEMO incluida: lo correcto es **503 y el botón «Crear cuenta» AUSENTE**. Y esa comprobación del botón es el único eslabón que el ensayo de F2.5 no pudo probar (hidratación en navegador real), así que **tiene que ir en la tarjeta o se pierde** |

## Commits que esperan visto bueno humano

> [!important] El criterio, porque los dos expedientes lo contaron distinto
> **ROJO = lo que su ejecutor declaró ROJO en el reporte de la tarea.** Ni más ni
> menos. «Toca un tema sensible» **no** basta: si el ejecutor lo declaró AMARILLO
> tras juzgarlo, AMARILLO se queda — esa distinción es lo que hace útil el color.

| Commit | Tarea | Por qué es ROJO |
|---|---|---|
| `c50344a` | F1.3 | R2, aislamiento entre organizaciones |
| `65bf9b5` | F1.2 | **Migración Y tenant**, los dos disparadores |
| `b976b54` | T-01 | Siembra credenciales en `usuarios` |
| `3ac2bba` | T-02 | Cambia a qué base escribe el bootstrap |
| `70ca3f0` | F2.6 | Invierte la polaridad de una bandera de seguridad |
| `ef70aa9` | T-03 | Cookie de sesión + aislamiento entre instancias |
| `6cb16d4` | F3.1 | **Migración.** Nace `schema_migrations` y su backfill de 65 |
| `4c484fa` | **T-04** | **Edita DOS migraciones ya aplicadas en producción** (R3), autorizado por Jochelo el 17/08 |
| `d293865` | F3.2 (1.º) | Runner de migraciones: ejecuta DDL sobre la base que le pongan delante |
| `024759c` | F3.2 (2.º) | El guard que decide si una instancia reaplica su historia |
| `d31a7b8` | F3.2 (3.º) | La señal derivada que verifica `--instalacion-nueva` |
| `dc6df52` | F3.3 | Decide si una instancia **se niega a actualizarse** |

**Son doce.** Las seis primeras venían del 13–14/08; las seis de abajo salieron el 17/08.

> [!warning] La fila de `6cb16d4` faltaba, y llevaba tres días fuera
> Su propia fila de la Fase 3 dice «ROJO: pendiente de visto bueno humano» desde el
> 14/08, y esta tabla no la recogía. **Es una migración**: exactamente el tipo de commit
> que esta lista existe para no perder. Añadida el 17/08 al revisar el recuento.

**Y siguen fuera, por el mismo criterio** —declarados AMARILLO o VERDE por su propio
ejecutor, aunque toquen temas próximos—: `3671e8a` (F1.4), `6044732` (F0.3), `8ae8f77`
(F2.1), `3f16386` (F2.2), `958a3e6` (F2.3) y `0584d97` (F2.4). **Ninguno de los
dieciocho está en `main`.**

## Tarjetas humanas emitidas

*(El orquestador las agrega aquí conforme se generan: ID de tarea, comandos exactos
del plan, respuestas esperadas y qué desbloquean. Se presentan a Jochelo en bloque.)*

### TH-01 · de F1.3 — comprobar `config_negocio` en producción

Emitida por el verificador el 2026-08-13. **Solo lectura**, la corre una persona.

```bash
psql -d spaces_prod -c "select count(*) total, count(*) filter (where tenant_id is null) sin_tenant, count(*) filter (where max_clientes_pantalla is not null) con_cupo from config_negocio;"
```

**Respuesta esperada:** `sin_tenant = 0`. En el 5433 local son 6 filas, 0 sin tenant,
0 con cupo capturado.

**Qué pasa si no cuadra:** si producción tuviera alguna fila con `tenant_id` nulo
(esquema divergente), el filtro explícito que introdujo F1.3 dejaría a esa
organización **«sin límite» de cupo sin avisar**. Con `NOT NULL` en el esquema
(`db/schema.sql:643`) no debería ocurrir; esto lo confirma.

**Qué desbloquea:** el visto bueno humano del merge de `c50344a`.

---

### TH-F3.1 · aplicar `schema_migrations` al droplet — **y en este orden**

De F3.1 (`6cb16d4`). **Es ROJO**: migración. La corre una persona con el ritual
completo de `vault/04-Datos/migraciones.md` §«Antes de aplicar en producción»
—respaldo `pg_dump`, ensayo en `ROLLBACK`, `ON_ERROR_STOP=1`, nota
`DESPLIEGUE_*.txt`—.

> [!danger] El orden importa, y al revés rompe
> **Primero `20260812_schema_migrations.sql`, después `20260812_sin_default_tenant.sql`**
> (la de F1.5). Al revés, la de F1.2 quedaría registrada como aplicada sin haberlo
> sido, y el runner **no la aplicaría nunca**.

Verificación que la propia migración deja escrita al pie:

```sql
select count(*) as registradas, max(archivo) as ultima from schema_migrations;
```

**Esperado: 65** y `20260810_notificaciones_archivada_en.sql`. Si da distinto, **la
lista literal no describe a esa instancia** y hay que censar antes de seguir — el
repo ya divergió una vez de `spaces_prod` en 27 columnas
(`20260805_objetos_solo_en_prod.sql`).

**Dos cosas que solo se pueden resolver ahí:**
1. Si `20260731_calendario_meses_cortos.sql` **corrió alguna vez** en producción. Se
   decide mirando los datos que corregía o el historial de `psql` del 31/07, no desde
   el repo.
2. Qué migraciones tiene **de verdad** aplicadas el droplet. La lista de 65 es una
   afirmación sobre producción hecha desde el repositorio.

---

### TH-F0.1 · ¿está abierto el registro HOY en el droplet?

De F0.1, que **nunca se ejecutó**. **Solo lectura**, la corre una persona.
Según el plan (`:260`) **bloquea toda la Fase 4** — es la tarjeta más cara de las
cuatro.

**Paso 1 — desde cualquier máquina con red, sin tocar el servidor** (`:267-271`):

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST \
  https://demo.space-os.io/spaces-dooh/api/signup/ \
  -H 'Content-Type: application/json' -d '{}'
```

Con cuerpo vacío no se crea nada: zod revienta antes de tocar la base.

**Paso 2 — confirmar la causa en el servidor, solo lectura** (`:275`):

```bash
ssh root@209.97.146.136 "grep -rs AUTOREGISTRO /var/www/Spaces/.env /var/www/Spaces/apps/web/.env*; echo '[fin]'"
```

| Respuesta | Significa |
|---|---|
| **HTTP 503** | Registro **apagado**. No hay nada que apagar |
| **HTTP 400** | Registro **abierto**: zod rechazó el cuerpo vacío, o sea que pasó el guard |

> [!warning] Si sale 400, **F0.2 ya NO se ejecuta como está escrita**
> El plan manda un `sed` sobre `NEXT_PUBLIC_AUTOREGISTRO` y recompilar. Con la
> decisión del 14/08 —registro cerrado en toda la flota— y el renombrado de F2.6,
> lo correcto es **borrar la línea vieja y no poner nada**: ausente = cerrado
> (`lib/entorno.ts`). Poner `AUTOREGISTRO=1` sería lo contrario de lo decidido.
>
> Y ojo: el droplet corre **un build anterior a `70ca3f0`**, que todavía lee la
> variable vieja horneada. Hasta que tome un release con F2.6, el `sed` del plan
> sigue siendo lo que funciona ahí.

---

### TH-T03 · la cookie comodín en los `.env` YA desplegados

Emitida por el verificador de T-03 el 2026-08-14. **Solo lectura**, la corre una persona.

T-03 limpió la **plantilla**; los `.env` que ya se copiaron de ella **no**. Si el
droplet —o cualquier instancia aprovisionada desde esa plantilla— declara
`COOKIE_DOMAIN`, sigue ahí.

```bash
grep -n '^COOKIE_DOMAIN' /var/www/Spaces/apps/web/.env.production
```

**Respuesta esperada:** sin resultados. Si aparece, **borrar la línea**: hoy es
inocua —`apps/web` no lee la variable— pero es el mismo riesgo latente que motivó
T-03, y ahí sí sobre un archivo vivo.

**Qué desbloquea:** nada bloqueado; es higiene antes de que el `domain` de la cookie
se vuelva configurable alguna vez.

---

### TH-02 · de F1.1 — el censo real de los `DEFAULT` a `rgb`

Emitida por el ensayista el 2026-08-13 tras el ensayo local. **Solo lectura**, la
corre una persona. Son **dos pasos**: el comando de verificación del plan
(`Plan_Instancias_Soberanas_v3.md:434`) invoca `/tmp/auditoria_tenant.sql` con `-f`,
pero **ese archivo no existe ni el plan lo crea**. Hay que materializarlo antes.

**Paso 1 — dejar el SQL en el droplet.** Son las tres consultas literales del plan
(`Plan_Instancias_Soberanas_v3.md:390-419`), **materializadas aquí a propósito**: la
versión anterior de esta tarjeta ponía una elipsis y obligaba a transcribirlas a mano,
justo en el paso donde una errata produce un censo falso.

```bash
ssh root@209.97.146.136 "cat > /tmp/auditoria_tenant.sql" <<'SQL'
select c.relname as tabla, pg_get_expr(d.adbin, d.adrelid) as por_defecto
  from pg_attrdef d
  join pg_class c on c.oid = d.adrelid
  join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and a.attname = 'tenant_id'
 order by 1;

select sm.tenant_id as tenant_modalidad, s.tenant_id as tenant_sitio, count(*)
  from sitio_modalidades sm join sitios s on s.id = sm.sitio_id
 where sm.tenant_id is distinct from s.tenant_id
 group by 1,2;

select 'predios' t, p.tenant_id, a.tenant_id, count(*) from predios p join arrendadores a on a.id=p.arrendador_id where p.tenant_id is distinct from a.tenant_id group by 1,2,3
union all select 'reservas', r.tenant_id, c.tenant_id, count(*) from reservas r join campanas c on c.id=r.campana_id where r.tenant_id is distinct from c.tenant_id group by 1,2,3
union all select 'propuesta_items', pi.tenant_id, pr.tenant_id, count(*) from propuesta_items pi join propuestas pr on pr.id=pi.propuesta_id where pi.tenant_id is distinct from pr.tenant_id group by 1,2,3
union all select 'contratos_arrendamiento', ca.tenant_id, s.tenant_id, count(*) from contratos_arrendamiento ca join sitios s on s.id=ca.sitio_id where ca.tenant_id is distinct from s.tenant_id group by 1,2,3
union all select 'cobranzas', cb.tenant_id, f.tenant_id, count(*) from cobranzas cb join facturas f on f.id=cb.factura_id where cb.tenant_id is distinct from f.tenant_id group by 1,2,3;
SQL
```

**Paso 2 — el comando de verificación exacto de F1.1:**

```bash
ssh root@209.97.146.136 "sudo -u postgres psql -d spaces_prod -v ON_ERROR_STOP=1 -f /tmp/auditoria_tenant.sql"
```

**Respuestas esperadas, a la luz del ensayo local:**

| Consulta | Qué se espera | Qué significa lo contrario |
|---|---|---|
| 1 · tablas con `DEFAULT` | **23 o más**, nunca menos | Si salen más de 23, **ese es el hallazgo de la tarea**: confirma §1.2 punto 7. Anotar la lista |
| 2 · modalidades mal etiquetadas | ~15 filas, `rgb` contra `g500`/`eyro` | Un cero es **sospechoso**: querría decir que ya se reparó. Confirmarlo antes de darlo por bueno |
| 3 · los cinco enganches | No debe fallar por nombre de columna | Los seis nombres se verificaron contra el catálogo local y existen. Si aun así truena, **el error es el resultado**: se reporta literal, no se parchea |

> El uuid de `rgb` en producción **no** es el de la base local (`f2fa79e7-…`): esa se
> recreó. Y el conteo local de 23 no autoriza a esperar 23 allá.

**Qué desbloquea:** que **F1.2** pueda *aplicarse* en producción (hoy solo está
autorizada a escribirse), más **F1.5** y la **Fase 7**.

> [!important] Si aparecen filas sospechosas, **no se corrigen en esta fase**
> Se anotan y su destino se decide en la Fase 7. Quitar el `DEFAULT` sigue adelante
> igual: detiene la hemorragia aunque no cure la herida.

---

### TH-F1.5 · aplicar `sin_default_tenant` al droplet

De **F1.5** (`Plan_Instancias_Soberanas_v3.md:646-671`). **Es ROJO**: migración. La corre
una persona con el ritual completo de `vault/04-Datos/migraciones.md` §«Antes de aplicar
en producción». Emitida el **2026-08-17**, a raíz del hallazgo H1 de la validación de la
Fase 1: la tarea llevaba desde el 13/08 en `PENDIENTE_SERVIDOR` **sin tarjeta**, y su
ritual solo se narraba en prosa dentro del expediente.

> [!danger] Antes que nada: esta tarjeta va DESPUÉS de TH-02 y DESPUÉS de TH-F3.1
> **TH-02** (el censo) es la que autoriza a *aplicar* esto: hoy F1.2 solo está autorizada
> a escribirse. Y el orden contra **TH-F3.1** no es negociable —
> **primero `20260812_schema_migrations.sql`, después `20260812_sin_default_tenant.sql`**.
> Al revés, ésta quedaría registrada como aplicada sin haberlo sido, y el runner de F3.2
> **no la aplicaría nunca**.

**Paso 1 — respaldo, y comprobar que no está vacío** (`plan:649-654`; el patrón existe
porque un dump fallido se ve casi igual que uno bueno, `deploy.yml:117-125`):

```bash
ssh root@209.97.146.136 "BK=/root/spaces_$(date +%Y%m%d_%H%M%S).dump; sudo -u postgres pg_dump -d spaces_prod -Fc -f \$BK; [ -s \$BK ] && ls -lh \$BK || echo 'BACKUP VACIO — ABORTAR'"
```

**Paso 2 — ensayo en seco:** aplicar la migración con el `commit` cambiado por `rollback`
y comprobar que el ASSERT pasa. **El guard del paso 1 de la migración es lo que importa
aquí**: aborta si encuentra una tabla con `DEFAULT` y **sin** `NOT NULL`, o sea una
columna que el default fuera lo único que la sostenía. En local no saltó (0 tablas), pero
producción **no es el repo** — el esquema desplegado ya divergió una vez en 27 columnas.

**Paso 3 — aplicar de verdad, como `postgres`** (`plan:657`):

```bash
ssh root@209.97.146.136 "cd /var/www/Spaces && sudo -u postgres psql -d spaces_prod -v ON_ERROR_STOP=1 -f db/migrations/20260812_sin_default_tenant.sql"
```

**Paso 4 — el comando de verificación exacto del plan** (`:664-668`):

```bash
ssh root@209.97.146.136 "sudo -u postgres psql -d spaces_prod -Atc \"select count(*) from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum where a.attname='tenant_id'\""
curl -s -o /dev/null -w '%{http_code}\n' https://demo.space-os.io/spaces-dooh/login/
```

**Esperado: `0` y `200`.** El `0` dice que no queda ningún default; el `200` dice que la
aplicación sigue en pie.

> [!warning] Lo que hay que mirar la hora siguiente
> Si algún proceso externo insertaba sin `tenant_id`, **empezará a fallar en voz alta**
> con `23502` — que es el objetivo de la tarea, no un accidente. Conviene mirar los logs.
> Y **`bootstrap-auth.mjs` es el caso conocido**: hoy funciona en producción porque el
> default rellena; tras esto exige el arreglo de T-01 (`b976b54`), que **no está
> desplegado**. Sembrar el primer usuario de una instancia con el binario viejo, después
> de aplicar esto, revienta.

**Qué desbloquea:** cierra la Fase 1 **en producción**, y con ella **F4.2**, que declara
depender de F1.5 (`plan:1267`). Necesita además **entrada en `docs/Registro_Cambios.md`**
— es la tarea de la Fase 1 que sí se nota, y la fase entera no tiene ni una línea.

---

### TH-P4 · fijar el registry en las variables del repositorio

De la decisión **P4**, tomada por Jochelo el **2026-08-17**: DigitalOcean Container
Registry. **No hay nada que programar** — F2.3 y F2.4 se escriben con el registry como
parámetro. Esto es configuración de GitHub, y la pone una persona con permisos sobre
`emiliano-cyber/spaces_dooh_new`.

```bash
gh variable set REGISTRY      --body "registry.digitalocean.com/<NOMBRE-DEL-REGISTRY>"
gh variable set REGISTRY_TIPO --body "docr"
gh secret   set DO_REGISTRY_TOKEN   # pide el token por stdin; NO se escribe en un archivo
```

**Dónde se crea: la cuenta de PIXELED** (decisión de Jochelo, 2026-08-17). El
`<NOMBRE-DEL-REGISTRY>` no existe todavía y hay que crearlo ahí, con `doctl registry
create <nombre>` o desde el panel. Al crearlo, mirar el **límite de almacenamiento** del
plan contratado: una imagen de 240 MB por versión publicada se acumula.

> [!note] La duda de «¿es la cuenta de un cliente?», resuelta
> **La cuenta de PIXELED es la de la casa** (Jochelo, 2026-08-17). Se preguntó porque
> PIXELED figura en el plan como un tenant a migrar (P2, `Plan…v3.md:2070`) y parecía un
> owner; no lo es. **No hay nada que vigilar aquí.**

**Qué desbloquea:** que F2.3 y F2.4, una vez escritas, puedan **correrse** de verdad. Sin
esto se escriben y quedan esperando.

---

### TH-T04 · ¿ha completado `deploy.yml` un despliegue desde el 4 de agosto?

Emitida el **2026-08-17** a raíz del hallazgo 1 de T-04. **Solo lectura**, la corre una
persona. No bloquea nada del plan; es una pregunta cuya respuesta cambia lo que creemos
del despliegue actual.

**Lo que T-04 midió:** `.github/workflows/deploy.yml:141-148` reaplica **todas** las
migraciones con `ON_ERROR_STOP=1`, y hasta `4c484fa` esa reaplicación **abortaba** en
`20260720_hard1_usuarios_rls.sql` — desde el momento en que existe
`20260804_reautenticacion_individual.sql`. O sea que **ese workflow no puede haber
completado un despliegue desde el 2026-08-04**.

```bash
gh run list --workflow=deploy.yml --limit 20
```

**Las dos lecturas posibles, y las dos importan:**

| Respuesta | Significa |
|---|---|
| **No hay runs, o todos anteriores al 04/08** | El despliegue real es el manual por SSH, como dice la bóveda. El workflow lleva dos semanas siendo decorativo |
| **Hay runs posteriores en verde** | **Nuestra medición está incompleta**: algo del entorno real difiere del que reprodujimos. Hay que entender qué antes de fiarse de T-04 |
| **Hay runs posteriores en rojo** | Alguien lo vio fallar y no quedó escrito en ninguna parte |

**Paso 2 — el estado real de `password_resets` en el droplet.** Lo pidió el auditor de
T-04, y decide si su hallazgo 1 es teórico o bloqueante:

```bash
ssh root@209.97.146.136 "sudo -u postgres psql -d spaces_prod -Atc \"select relrowsecurity, relforcerowsecurity from pg_class where relname='password_resets'\""
```

**Esperado: `t|t`.** El tablero registra `20260807_password_resets_rls.sql` como aplicada
el 10/08, así que debería salir así. **Si sale `f|f`**, el droplet está parado en la
ventana `[20260723, 20260807)` y el próximo `deploy.yml` abortaría — el hallazgo pasa de
teórico a bloqueante.

**Qué desbloquea:** nada, pero es insumo directo de **F3.6** (retirar `deploy.yml`), que
hoy se plantea como si el workflow estuviera vivo y funcionando.

---

### TH-F2.3 · correr el workflow de release contra un tag de ensayo

Emitida el **2026-08-17**. **Va DESPUÉS de TH-P4**, que a su vez espera a **P3** (en qué
cuenta de DigitalOcean nace el registry). Sin las variables el workflow se para en su
primer paso, a propósito.

```bash
# 0 · Precondicion: TH-P4 hecha
gh variable list          # deben salir REGISTRY y REGISTRY_TIPO
gh secret   list          # debe salir DO_REGISTRY_TOKEN

# 1 · El comando de verificacion exacto de la tarea (plan:790-795)
git tag v0.0.1-rc1 && git push emiliano v0.0.1-rc1
gh run list --workflow=release.yml --limit 3
gh run view <id> --log | grep -E "test:e2e|beta"
```

**Paso 2 — la mitad que el plan no pide, y es la que de verdad prueba el criterio:** un
tag sobre un commit **con la suite en rojo NO debe publicar nada**. El criterio de
aceptación de F2.3 es exactamente ése, y no se ve con un tag que pasa.

| Respuesta | Significa |
|---|---|
| **Verde + imagen publicada** | Listo |
| **Verde sin imagen** | Falta permiso de escritura en el registry |
| **Rojo en e2e** | Revisar `DATABASE_URL_TEST` y el servicio de Postgres |
| **Rojo en el primer paso, «faltan las variables»** | **TH-P4 sin hacer.** No hay nada que investigar |

**Vuelta atrás si publica una imagen mala:** mover `beta` a la anterior y borrar el tag.
`beta` solo lo consume DEMO.

---

### TH-F2.4 · promover una versión a `estable`

Emitida el **2026-08-17**. Depende de **TH-P4** (variables del registry) y de que exista
una imagen en `beta` (**TH-F2.3**). Y de una condición que se olvida fácil: **el workflow
no aparece en Actions hasta que esta rama esté fusionada a `main`** — `workflow_dispatch`
exige que el archivo esté en la rama por omisión.

```bash
# 0 · Configuracion, una sola vez (parte de TH-P4)
gh variable set DEMO_URL --body "https://demo.space-os.io/spaces-dooh"
# recomendado: exigir aprobacion humana antes de mover estable
gh api -X PUT repos/:owner/:repo/environments/flota \
  -f 'reviewers[][type]=User' -F 'reviewers[][id]=<tu id>'

# 1 · El comando de verificacion del plan, tal cual (:824-829)
gh workflow run promover.yml -f version=v0.1.0 && gh run watch
docker buildx imagetools inspect "$REGISTRY/space-os:estable" | head -5
docker buildx imagetools inspect "$REGISTRY/space-os:v0.1.0"  | head -5

# 2 · El criterio de aceptacion, medido en una linea
A=$(docker buildx imagetools inspect --format '{{.Manifest.Digest}}' "$REGISTRY/space-os:estable")
B=$(docker buildx imagetools inspect --format '{{.Manifest.Digest}}' "$REGISTRY/space-os:v0.1.0")
[ "$A" = "$B" ] && echo "ok: promover no cambio el digest ($A)" || echo "FALLO: $A != $B"

# 3 · Vuelta atras (la etiqueta, NO las instancias que ya jalaron: eso es F3.4)
docker buildx imagetools create --tag "$REGISTRY/space-os:estable" "$REGISTRY/space-os@<digest anterior>"
```

| Respuesta | Significa |
|---|---|
| **Verde y los dos digests iguales** | Listo |
| Rojo en «la versión existe y es la que lleva `beta`» | O no se publicó esa versión, o ya salió una `beta` más nueva. **Promover una vieja es un rollback y va a mano** |
| Rojo en el smoke | DEMO no está sana, y promover **afirmaría algo falso** |
| Rojo en «promover no cambió el digest» | `imagetools create` no se comportó como se espera en ese registry. El error trae el comando para devolver `estable`: **parar y avisar** |

> [!danger] Hoy no hay red debajo
> Promover por error manda a **toda la flota** a jalar esa imagen. Reetiquetar `estable`
> a la anterior arregla la etiqueta, pero **las instancias que ya jalaron no vuelven
> solas**: necesitan su rollback local, que es **F3.4 y todavía no existe**. Armar el
> `environment: flota` con revisores es lo que hoy sustituye a esa red.

### TH-F3.5 · el ensayo de `update.sh` en el droplet de DEMO

**Emitida** el 2026-08-18, del ensayo local de F3.4. **Depende de** que exista DEMO
(F4.2–F4.5 reales) y de que la instancia esté **ya aprovisionada**: `update.sh` **no
estrena bases** —nunca pasa `--instalacion-nueva`, y sobre una base con `schema.sql`
el runner se planta con código 1—. Esa primera puesta al día es de la Fase 5.

```bash
# 0 · antes de nada
sudo cat /etc/space-os/instancia.env | sed 's/\(PASSWORD\|:\/\/[^@]*@\).*/…/'   # 600 y de root
ls -l /var/lib/space-os /var/log/space-os

# 1 · obligatorio la primera vez en cada instancia
sudo /opt/space-os/update.sh --dry-run ; echo "codigo=$?"
sudo tail -n 40 /var/log/space-os/update.log

# 2 · el update de verdad
sudo /opt/space-os/update.sh ; echo "codigo=$?"

# 3 · el release deliberadamente roto — el resultado que valida la fase
sudo /opt/space-os/update.sh ; echo "codigo=$?"

# 4 · lo que el ensayo local NO pudo ver (defecto D1)
sudo docker exec -i <postgres> psql "$DATABASE_URL" -c "\dt"   # tras el rollback

# 5 · el candado y el cron
sudo cat /etc/cron.d/space-os-update      # 17 4 * * * root /opt/space-os/update.sh
sudo /opt/space-os/update.sh & sleep 3; sudo /opt/space-os/update.sh; echo "codigo=$?"
```

**Respuestas esperadas**

| Paso | Esperado | Si sale otra cosa |
|---|---|---|
| 1 | `sin cambios` → al día, código 0 · o `pull vX.Y.Z -> N migraciones pendientes. Nada se toco: --dry-run.` → código 0 | Cualquier `BACKUP VACIO` → **NO SEGUIR**. Código 3 → el registro y la imagen no cuentan la misma historia → **NO SEGUIR** |
| 2 | Código 0 y `OK: vX.Y.Z sirviendo. La base cambio=si (N filas nuevas…)` | ⚠️ Hay **corte de servicio de 10–20 s**, y más si la base es grande: el ensayo midió sobre 175 kB |
| 3 | Código **4** + `VUELTA ATRAS COMPLETA`, y el sitio sirviendo 200 **la versión anterior** | Código **5** → **la instancia está CAÍDA**. Rescate: `sudo docker rename space-os-anterior space-os && sudo docker start space-os`. Código **2** → la base pudo cambiar y no se conmutó: **no reintentar**, mirar la base |
| 4 | Que **no** queden tablas ni funciones del release descartado | Si quedan, es **D1** confirmado en real: una migración no idempotente deja la instancia atascada en código 2 en cada corrida del `cron` |
| 5 | El segundo update sale **75** sin hacer nada | — |

**Qué desbloquea:** F3.5, y con ella el cierre de la Fase 3.

> [!warning] Antes de correrla hace falta una imagen de release construida de verdad
> Las del ensayo local derivan de `space-os:dev`, que es **anterior a F3.1** y trae 67
> migraciones en vez de 68. **Nadie ha hecho todavía un `docker build` con las 68 dentro.**

## Bitácora de orquestación

| Fecha | Evento |
|---|---|
| 2026-08-13 | Tablero creado. Alcance: Fases 1–4 en local. Diseño de agentes: ejecutor / verificador / ensayista-local + comando /orquestar. Pendiente crítico: respuesta a P4-bis antes de F2.3/F2.6. |
| 2026-08-13 | Entorno montado: `npm install`, los dos `.env` copiados, `spaces_db` revivido con `docker start` (había quedado `Exited` al reiniciar Docker). Línea base medida: typecheck limpio, 789 unitarias en 71 archivos. |
| 2026-08-13 | **El par aprobado (F1.3 ∥ F1.4) NO se paraleliza.** `vitest.e2e.config.ts:16-17`: las e2e corren en serie porque comparten la única base `spaces_e2e` y cada archivo la recrea con `drop schema public cascade`. Dos agentes a la vez se borran la base a media corrida. El DAG las aprobó por no compartir zona ni archivos —cierto— pero no contempló la base compartida. Regla escrita en `orquestar.md`. |
| 2026-08-13 | **Trampa de entorno documentada:** las e2e exigen build de Next previo (`servidor-e2e.ts:31` usa `npx next start`, que no construye). Sin `.next/BUILD_ID` fallan las 12 por timeout tras 636 s; con build, 61 s. Costó 10 min al ejecutor de F1.3. Escrito en `CLAUDE.md` y en los tres agentes. |
| 2026-08-13 | **F1.3 COMPLETADA_LOCAL** (`c50344a`, AMARILLO). Auditoría independiente confirmó el criterio con la RLS desactivada de facto: con GUC ajeno la consulta vieja devolvía 1 fila (fuga), la nueva 0. Tres asperezas menores, ninguna bloqueante. Emitida TH-01. |
| 2026-08-13 | Corregido en la bóveda el conteo de `campanas-repo.ts`: decía 1044 líneas en tres notas vivas, son **1214**. La de `comercial-propuestas-campanas` afirmaba `actualizado: 2026-08-13` con el dato viejo dentro. |
| 2026-08-13 | **Primer paralelo real, aprobado por Jochelo:** F1.1-local (ensayista, solo lee `spaces`) junto a F1.4 (ejecutor, usa `spaces_e2e` + puerto 3311). No es par del DAG, pero no comparten base, archivos ni git — el ensayista no commitea. Sin interferencia. |
| 2026-08-13 | **F1.1 ENSAYADA_LOCAL.** Catálogo confirmado: 23 tablas exactas contra `db/schema.sql:604-609`, los 6 nombres de enganche `[SIN VERIFICAR]` del plan existen tal cual, y 0 tablas con default y `attnotnull=false` (el guard de F1.2 no abortaría). **La mitad de datos es muda:** la base local es fixture (33 filas, `sitio_modalidades` vacía, sin `g500` ni `eyro`), así que sus ceros son vacuos. Emitida TH-02. |
| 2026-08-13 | Agujero del plan detectado por el ensayo: el comando de verificación de F1.1 (`:434`) hace `psql -f /tmp/auditoria_tenant.sql`, y **ese archivo no existe ni el plan lo crea**. TH-02 lo resuelve en dos pasos. El plan NO se tocó. |
| 2026-08-13 | **F1.4 COMPLETADA_LOCAL** (`3671e8a`, AMARILLO). El ejecutor mostró dos rojos: el módulo ausente y, después, la lógica vieja extraída tal cual fallando los casos que la tarea predice (`209.97.146.136` → `'209'`). Reajustó de oficio las citas desplazadas en 7 notas **sin subirles `actualizado:`**, por no afirmar más de lo que hizo. |
| 2026-08-13 | La auditoría de F1.4 no se fio de las pruebas: compiló `host.ts` con `tsc` y lo comparó contra la lógica vieja reimplementada, levantó `next start` en el **3312** y mandó encabezados `Host` a mano. También comprobó que el bundle correspondía al código (`middleware.js` sin `parts.length`, con la guarda IPv6 nueva) en vez de fiarse de la marca de tiempo. |
| 2026-08-13 | **Regresión de puntero, corregida por el orquestador.** `acceso-y-sesion-ui.md:74` citaba `middleware.ts:92` (= `normalizedPath === '/login'`); la línea correcta es `:94`. Antes del commit la cita era `:100` y **era correcta**: el ejecutor aplicó −8 donde tocaba −6, porque el corrimiento no era uniforme (el comentario del ruteo creció de 1 a 3 líneas). Es el precio de reparar punteros con aritmética sin abrir el archivo. |
| 2026-08-13 | **F1.2 DETENIDA antes de escribir una línea.** El ejecutor corrió la comprobación previa que el plan exige en su apartado «Riesgo y vuelta atrás» (`rg` sobre 76 inserts de `apps/web`) y encontró **uno que no nombra `tenant_id`**. Ni reclamó zona ni tocó el tablero: paró en el paso previo. Ver la contradicción de abajo. |
| 2026-08-13 | **El plan se equivoca en `:551-552`.** Afirma «Comprobado que **no hay ninguna**» ruta que inserte sin fijar tenant, y sí la hay: **`apps/web/scripts/bootstrap-auth.mjs:54`** inserta en `usuarios` sin `tenant_id`. Como `usuarios.tenant_id` es `NOT NULL` (verificado contra el catálogo, `attnotnull = t`), hoy solo funciona porque el `DEFAULT` lo rellena — el que F1.2 retira. Aplicada la migración lanza **23502 siempre**, incluso para un correo existente: Postgres valida el `NOT NULL` antes de arbitrar el `ON CONFLICT`, así que el `do update` no lo salva. **Decisión de Jochelo (13/08): el plan NO se corrige** — la evidencia vive aquí. |
| 2026-08-13 | **T-01 autorizada por Jochelo**, fuera del plan y **antes** de F1.2: arreglar `bootstrap-auth.mjs` en su propio commit para que F1.2 entre después con solo sus archivos declarados. Se descartó arreglarlo dentro de F1.2 (habría inflado su diff) y se descartó ignorarlo: el script crea **el primer usuario de una base recién creada**, que es justo lo que necesita cada instancia nueva del modelo soberano — y hoy lo etiqueta como `rgb` por el default, o sea que es a la vez víctima de la migración y ejemplar vivo de la deriva que persigue. |
| 2026-08-13 | **T-01 detenida en su primer intento, y la premisa del orquestador era falsa.** Se le pasó como verificado que el script «hoy funciona gracias al `DEFAULT`» — venía del reporte de F1.2, que lo dedujo sin ejecutarlo. El ejecutor lo corrió contra una base desechable y **falla siempre**, por una causa anterior: `bootstrap-auth.mjs:56` usa `on conflict (email)`, pero la unicidad de correo es un índice **funcional** sobre `lower(email)` (`db/schema.sql:72`) y Postgres no lo infiere → **42P10**. Aisló las dos causas: sin el `on conflict`, sale el 23502 esperado. O sea que el script **lleva roto** desde que se cambió la unicidad, no está «a punto de romperse». |
| 2026-08-13 | **Hallazgo de seguridad reportado por T-01, sin tocar:** `bootstrap-auth.mjs:9-10` toma por omisión `postgresql://spaces:spaces@localhost:5433/spaces` — **la base con datos reales**, y con rol superusuario, que además salta la RLS `FORCE` puesta sobre `usuarios` por `20260720_hard1_usuarios_rls.sql:110-115`. Correr el script sin `DATABASE_URL` escribe ahí. Nota para el futuro: con el rol de la aplicación en vez del superusuario, el `tenant_id` explícito **tampoco bastaría** — la política tiene `with check (tenant_id = app.tenant_id)` y haría falta fijar el GUC. |
| 2026-08-13 | **T-01 COMPLETADA_LOCAL** (`b976b54`, AMARILLO). La auditoría corrió la e2e aunque el ejecutor argumentara que no hacía falta —«prefiero el dato sobre el argumento»— y verificó el razonamiento del `rowCount` midiéndolo: con `do update` el conflicto devuelve 1 y con `do nothing` devuelve 0, así que el 0 solo puede venir del tenant ausente. La guarda es correcta y sin ventana TOCTOU. |
| 2026-08-13 | **Hallazgo pre-existente que la auditoría de T-01 destapó montando una base con las 66 migraciones:** el script **solo funciona con un rol que salte la RLS**. Con `spaces` (superusuario) va; con un rol sin `bypassrls` falla — `20260720_hard1_usuarios_rls.sql` deja `usuarios` en RLS FORCE con `with check (tenant_id = app.tenant_id)` y el script no fija el GUC. Es anterior al commit. **Importa para el aprovisionamiento de instancias**: si el runbook siembra con el rol de la aplicación en vez del superusuario, el bootstrap fallará con 42501. |
| 2026-08-13 | Corregidos en `entorno-y-despliegue.md:80-81` los conteos de las suites: decían ~729 y ~55, son **799 en 72 archivos** y **136 + 1 saltada en 12**. El commit de T-01 había subido el `actualizado:` de esa nota a hoy con los números viejos dentro — el mismo defecto que apareció en F1.3. |
| 2026-08-13 | **F1.2 COMPLETADA_LOCAL** (`65bf9b5`, AMARILLO). El rojo fue el mejor de la sesión: no una prueba que falla por convención, sino el **fallo silencioso ocurriendo en vivo** — `insert into clientes (nombre)` sin tenant devolvía «promise resolved» y la fila nacía etiquetada como `rgb`. |
| 2026-08-13 | **La auditoría de F1.2 probó el guard haciéndolo saltar**, que es lo que el ejecutor no podía enseñar. Fabricó dos tablas con `tenant_id` con `DEFAULT` y sin `NOT NULL` y corrió la migración: abortó nombrando las dos y, al no haber `commit`, dejó el fixture intacto. **Un guard que nunca se ha visto saltar no está probado** — y ese guard es lo único que impedirá, en F1.5, quitar un default que fuera lo único sosteniendo una columna en producción. |
| 2026-08-13 | La misma auditoría reclasificó los 78 inserts por su cuenta en vez de creerse la clasificación: 10 no nombran `tenant_id`, menos los 2 del archivo nuevo del propio commit = los 9 del plan. **8 son aserciones en `.test.ts`** y el noveno es `sitios-repo.ts:277`, que la añade dinámicamente en `:275`. **Cero rutas reales insertan sin fijar tenant.** |
| 2026-08-13 | **Barrido de recuentos desfasados en la bóveda**, a raíz del hallazgo 2 de esa auditoría. El grave era `verificacion-de-produccion.md:144`: decía «Esperado: **21** tablas» y es **la nota que leerá quien corra F1.5 contra producción** — si el catálogo real devolviera 23 o más, lo habría leído como desfase cuando es justo lo que F1.1 busca. Corregido a «23 o más» con el aviso de por qué. Corregidos también `MOC-Proyecto`, `esquema`, `entorno-y-despliegue` (66 → **67** migraciones) y **P15 de `preguntas-abiertas`, que seguía planteando como pregunta abierta lo que F1.2 acababa de responder**. |
| 2026-08-13 | **No se tocaron** `manual-tecnico.md` ni `inventario-2026-08-11.md`, que arrastran las mismas cifras viejas. El manual se declara a sí mismo construido desde el inventario del 11/08 (`:30-31`), así que corregirle números sueltos lo dejaría **internamente incoherente** con su propia procedencia. Ambos están pendientes de **regenerarse**, no de parchearse. |
| 2026-08-13 | **T-02 COMPLETADA_LOCAL** (`3ac2bba`, **VERDE**). La auditoría añadió el argumento decisivo que el ejecutor no dio para descartar la lista negra: **una lista negra es fail-open** — protege el único nombre conocido hoy, y bajo el modelo de instancias soberanas cada instancia tiene su propia base con datos reales y nombre propio. Exigir explicitud es fail-closed. |
| 2026-08-13 | Refuerzo que nadie había declarado, comprobado por esa auditoría: **el script no carga dotenv**. `apps/web/.env.local` sí define `DATABASE_URL`, y aun así la corrida con la variable desactivada aborta. El fail-closed no tiene la puerta trasera de heredar el destino de un `.env` que el operador no leyó. |
| 2026-08-13 | **Contrato nuevo que heredan las Fases 2 y 3:** cuando se escriba el aprovisionamiento de una instancia, el paso que siembre su primer usuario **tiene que pasar `DATABASE_URL` explícito** o fallará. Hoy no hay ningún llamador en el repo, así que nada está roto — pero es una condición nueva que esas tareas no conocen. |
| 2026-08-13 | **Fase 1 cerrada en todo lo ejecutable en local.** F1.3, F1.4, F1.2 y las dos tareas fuera de plan (T-01, T-02) commiteadas y auditadas; F1.1 ensayada. Quedan **F1.5** y el censo de **TH-02**, ambas de persona. Cinco commits ROJOS esperan visto bueno humano antes del merge. |
| 2026-08-13 | **P4-bis RESUELTA: (b), la bandera sale del build.** Un solo artefacto por versión; el autoregistro se decide en el `.env` al arrancar, como `GOOGLE_OAUTH`. El precedente es más fuerte de lo que dice el plan: **el propio código ya lo documenta** en `apps/web/lib/server/google-oauth.ts:35-36` — «apaga la función EN EL SERVIDOR, no solo escondiendo el botón — **misma lección que `NEXT_PUBLIC_AUTOREGISTRO`**. Y NO lleva prefijo». Alguien ya aprendió esto y dejó escrito que esta bandera era el siguiente caso. |
| 2026-08-13 | ⚠️ **F2.6 invierte la polaridad por omisión, y eso no es un detalle.** Hoy `NEXT_PUBLIC_AUTOREGISTRO !== '0'` significa **encendido si la variable no está** (`signup/route.ts:18`, `login/page.tsx:30`, `google-oauth.ts:90`). El criterio de F2.6 exige lo contrario: **sin variable → `false`**, fail-closed, «una instancia cuyo `.env` se quedó corto no abre el registro por descuido». Consecuencia práctica: **cualquier despliegue que hoy dependa del valor implícito se quedará sin autoregistro tras F2.6 salvo que ponga `AUTOREGISTRO=1` explícito** — incluida DEMO, que lo necesita encendido. Hay que comprobar el `.env` de cada entorno vivo antes de desplegarla. |
| 2026-08-13 | Con P4-bis resuelta, la Fase 2 queda ejecutable en **F2.1, F2.2, F2.5 y F2.6**. **F2.3 y F2.4 siguen bloqueadas, pero por otra decisión**: el nombre del registry (§8.4 / P4), que sigue abierta. |
| 2026-08-14 | **F2.6 COMPLETADA por el ejecutor** (`70ca3f0`, ROJO — pendiente de auditoría al escribir esto). El 503 ya sale por la razón correcta: con la **misma imagen sin recompilar**, sin variable → 503, `=0` → 503, `=1` → 400, y `/api/auth/metodos/` devuelve `autoregistro` en los tres casos. `login.html` pasó de **15 234 bytes con el botón** a **15 104 con 0 apariciones** de «Crear cuenta». Resolvió el `[SIN VERIFICAR]` por la ruta pública, que ya existía y ya se consultaba. **Y escribió en `docs/Registro_Cambios.md`** — el primer commit de la tanda que lo hace, con el criterio correcto: este cambio **sí** se nota desde la aplicación. |
| 2026-08-14 | Detalle de diseño de F2.6 que nadie pidió y está bien pensado: **las dos banderas del login empiezan en `false` en el cliente**, así que si la consulta a `/api/auth/metodos/` falla **no se pinta nada**. Ofrecer una entrada que contesta 503 es peor que no ofrecerla. |
| 2026-08-14 | 🔴 **F0.3 del plan queda contradicha por F2.6.** F0.3 (`:341-352`) **no está hecha** y especifica una prueba que busca `/^NEXT_PUBLIC_AUTOREGISTRO=0$/m` en `.env.example`; tras el renombrado esa regex **no puede casar nunca**. Quien ejecute F0.3 tiene que leerla como `/^AUTOREGISTRO=0$/m` y decidir si el valor de `.env.example` baja a `0` — el ejecutor solo renombró y dejó el `=1` que ya había, para no cambiar el comportamiento de un clon local por la puerta de atrás. **El plan NO se tocó.** |
| 2026-08-14 | **F2.5 REENSAYADA tras F2.6, DEMOSTRADO.** Smoke literal en verde y la bandera obedeciendo al arranque. El ensayista **corrigió su propia medición anterior**: dijo 18 activos a 200 y son **22** — los otros 4 se le habían escapado por una `\` de escape JSON que se comió su regex. Lo dijo él, sin que nadie se lo pidiera. |
| 2026-08-14 | **El ensayista cerró la cadena de evidencia del botón, que era lo que faltaba.** «0 apariciones en el HTML» prueba que **no se hornea**, no que **se pinte cuando toca**. Fue al bundle de cliente servido por la imagen (`login/page-1ac02c573056c2df.js`) y encontró que el JSX del botón sí viaja, que su única puerta es un estado que **arranca en `false`**, y que solo lo enciende un `autoregistro === true` de esa ruta. **Lo único sin probar es la hidratación en un navegador real** — y si fallara, el botón no aparecería: fallo en la dirección segura. |
| 2026-08-14 | Su propuesta para cerrar ese último eslabón, y la acepto: **añadir «se ve el botón *Crear cuenta*» a la tarjeta de F4.5**, que ya está prevista. Descartó la alternativa cara —prueba de regresión permanente— porque `apps/web` no trae `jsdom`, `@testing-library/react` ni Playwright (`vitest.config.ts:19` fija `environment: 'node'`) y exigiría devDeps nuevas. **No es decisión de un ensayo.** |
| 2026-08-14 | ⚠️ **Desfase del plan en F2.5, registrado y NO corregido**: su criterio justifica el 503 con «el autoregistro viene apagado **horneado**, invariante 9», y tras `70ca3f0` eso es **definitivamente falso** — nada se hornea. Y su paso 3 manda arrancar con `NEXT_PUBLIC_AUTOREGISTRO=0`, **variable que ya no lee nadie**: quien lo copie literal obtendrá 503 igual, pero por la ausencia de `AUTOREGISTRO`, no por lo que cree. Dos frases, ningún cambio de código. |
| 2026-08-14 | Para las tarjetas futuras: **F4.5 (smoke de DEMO) tiene que arrancar con `AUTOREGISTRO=1` y esperar `signup` 400**, no 503 — es la única instancia con el registro abierto. Una instancia de owner espera **503** con `AUTOREGISTRO=0` u omitida. |
| 2026-08-14 | 🔵 **DECISIÓN DE JOCHELO: el autoregistro va CERRADO en local y en producción.** Revierte P3b del 10/08 («abierto y permanente»). Efecto inmediato: `.env.example` baja de `AUTOREGISTRO=1` a **`=0`** — la plantilla del repo dejaba el registro abierto en cualquier clon, que era justo el agujero que F0.3 iba a cerrar. `.env.production.example` ya estaba en `0` y `apps/web/.env` local **no tiene la variable**, o sea ya cerrado por fail-closed. **La tarjeta humana del droplet cambia de sentido: ya no hay que poner `AUTOREGISTRO=1`, sino borrar la línea vieja y no poner nada.** |
| 2026-08-14 | **F3.1 COMPLETADA_LOCAL** (`6cb16d4`, AMARILLO). Arranca la Fase 3. El backfill registra **65** migraciones, no las 66 que dice el plan ni las 67 del repo, y las tres exclusiones son la parte valiosa: (a) **`20260812_sin_default_tenant.sql` fuera** porque está escrita y **no aplicada en producción** — marcarla como hecha habría hecho que el runner **no la aplicara nunca**, dejando el `DEFAULT` de `tenant_id` vivo en el droplet **con el registro jurando lo contrario**; (b) **`20260731_calendario_meses_cortos.sql` fuera** por ser la única `@tipo: datos`, que `deploy.yml:141-148` no aplica en un despliegue normal; (c) **no se registra a sí misma**, para quedar con su checksum real y no con `'backfill'`, que F3.3 se salta por diseño. |
| 2026-08-14 | El ejecutor resolvió sin escalar el problema que le señalé —un `.sql` no puede listar un directorio— con un argumento que el auditor validó: **la lista literal no envejece**, porque no es «lo que haya en `db/migrations/`» sino **lo que la flota tenía aplicado al 2026-08-12**, que es un hecho histórico. El auditor **intentó romper la hipótesis técnica y no cedió**: un `insert` SQL suelto que nombre `tenants` en base virgen falla **al analizarse** aunque su `where` nunca se cumpla; dentro de `do $$` con el guard delante, no. El `do $$` no es adorno. |
| 2026-08-14 | 🔴 **Hallazgo que F3.2 hereda y no puede ignorar: el ASSERT de `20260812_schema_migrations.sql:221-223` se volverá un falso positivo.** Comprueba `where archivo >= '20260812'` sobre **toda la tabla**, sin distinguir una fila del backfill de una que ponga legítimamente el runner. El auditor lo reprodujo simulando F3.2: insertó `20260812_sin_default_tenant.sql` y al reaplicar la migración **abortó**. O sea que es idempotente **solo mientras no exista ninguna fila ≥ 20260812**, condición que F3.2 destruye por diseño — y contradice lo que el propio archivo declara en `:72`. Peor: el despliegue de hoy reaplica **todas** las migraciones en cada corrida (`deploy.yml:141-148`, con `ON_ERROR_STOP=1`), así que entre F3.2 y el retiro de ese workflow **un despliegue normal abortaría**, con un mensaje que además miente sobre la causa. |
| 2026-08-14 | 🔴 **Y la prueba contradice a la migración.** `migraciones.e2e.test.ts:107-112` construye el conjunto esperado **leyendo el directorio** (`readdirSync().filter(f => f < '20260812')`), así que ante una migración **retrofechada** añadida mañana el oráculo **obligaría a meterla en la lista** — que es exactamente lo que `20260812_schema_migrations.sql:30-35` declara que no debe pasar jamás. Es la grieta concreta del argumento «no envejece», dentro del archivo que lo defiende. Probabilidad baja; contradicción real. |
| 2026-08-14 | Matiz que el auditor añadió a la exclusión (b), y que la nota de bóveda callaba: **sí hay rastro documental** de que se pidió aplicar la migración de datos a mano — `docs/Runbook_Deploy_Fase1_Arrendadores.md:230-235` la lleva como paso explícito. No prueba que se ejecutara, así que «no consta que corriera» es defendible, pero la nota presentaba la ausencia de evidencia como si no existiera ninguna. El juicio sigue siendo a favor de excluirla: es la dirección segura en los dos escenarios. |
| 2026-08-14 | Corregida la deriva que el propio commit de F3.1 introdujo: `MOC-Proyecto.md` seguía diciendo **38 tablas y 67 migraciones** mientras `esquema` y `migraciones` pasaban a **39 y 68** en ese mismo commit. Y `esquema.md:14` reafirmó al editar que `db/schema.sql` tiene 657 líneas: son **656**, medidas. |
| 2026-08-14 | **Los dos expedientes contaron los ROJO distinto** —seis el de la Fase 1, ocho el de la Fase 2— porque nadie había escrito el criterio. Zanjado arriba, en su propia sección: **ROJO es lo que su ejecutor declaró ROJO**, y «toca un tema sensible» no basta. Son **seis**. Sin esa regla escrita, el PDF habría salido contradiciéndose a sí mismo entre capítulos. |
| 2026-08-14 | **TH-F0.1 no tenía ficha**, solo menciones de pasada — y es la tarjeta que **bloquea toda la Fase 4**. Escrita ahora con sus dos comandos literales del plan (`:267-271` y `:275`), la tabla de respuestas y el aviso de que **si sale 400, F0.2 ya no se ejecuta como está escrita**. Lo levantó el expediente de la Fase 2. |
| 2026-08-14 | Otro error de briefing mío, cazado por ese mismo expediente: le dije que F0.3 (`6044732`) «ocurrió después» del suyo. **Es al revés**: `6044732` son las 14:05 y `84fe410` las 14:09 — es **ancestro**. El documentalista anterior arrancó con HEAD en `42c0f4e` (13:37) y F0.3 le pasó por debajo a media escritura, que es **por qué sus anclas ya estaban mal al commitear**. |
| 2026-08-14 | Y la lección que ese expediente saca de su propia historia, que vale más que el documento: **se quedó desactualizado a las cuatro horas**, y no porque nadie tocara la Fase 2, sino porque dos tareas de **otra** fase escribieron sobre los mismos archivos. Es la demostración práctica de que un `archivo:línea` no sobrevive una tarde en una rama activa. |
| 2026-08-14 | 🔴 **La cuenta de commits ROJO que venía dando el orquestador estaba mal, y lo levantó el expediente de la Fase 1.** Venía diciendo «ocho»; los declarados ROJO por su ejecutor son **seis**: `c50344a`, `65bf9b5`, `b976b54`, `3ac2bba` (Fase 1), `70ca3f0` (F2.6) y `ef70aa9` (T-03). `3671e8a` (F1.4), `6044732` (F0.3), `8ae8f77` (F2.1) y `3f16386` (F2.2) los declararon **AMARILLO**, no ROJO. Se estaba confundiendo «toca un tema sensible» con «su ejecutor lo declaró ROJO». |
| 2026-08-14 | Y este tablero **tampoco lo tenía bien**: la fila de **F1.2 no llevaba ni el hash ni la marca de pendiente**, siendo la más roja de todas —migración **y** tenant, los dos disparadores a la vez—. Corregido. Quien mergee mirando solo las filas marcadas se habría saltado justo esa. |
| 2026-08-14 | 🔴 **Desviación de proceso, y es del orquestador: F0.3 se ejecutó fuera del orden de dependencias.** El plan dice en `:337` «**Depende de: F0.1**», y F0.1 **nunca corrió** —es de servidor y no se ejecuta desde aquí. Se lanzó F0.3 igual, sin declararlo. Materialmente es inocuo (F0.3 no necesita el censo del droplet para escribirse), pero **la regla de ejecución dice respetar el campo «Depende de»**, y saltárselo en silencio es justo lo que esa regla previene. Lo levantó el expediente de la Fase 0, no yo. |
| 2026-08-14 | Corregida otra cita mía: `entorno-y-despliegue.md:244` —la tabla canónica de variables— señalaba `signup/route.ts:19-20` para `AUTOREGISTRO`, y ahí están un comentario y la firma de la función. El guard vive en **`:21-26`**. Medido. |
| 2026-08-14 | Coincidencia que el expediente de la Fase 0 desmontó: el plan (`:2037`) esperaba **6 casos** en `entorno.test.ts` y hoy hay **exactamente 6** — pero son de F2.6 + F0.3 + **T-03**, no los que el plan preveía (F2.6 + F0.3 + F5.3). **El número cuadra por casualidad**; los dos de F5.3 siguen sin escribirse. |
| 2026-08-14 | ⚠️ **Segunda fase consecutiva sin una línea en `docs/Registro_Cambios.md`.** Ni `6044732` ni `ef70aa9` la tocaron; la última entrada sigue siendo la de `70ca3f0`. Defendible tarea a tarea —nada se nota desde la aplicación— pero el patrón ya se repite, y en la Fase 1 pasó igual. |
| 2026-08-14 | **T-03 COMPLETADA_LOCAL** (`ef70aa9`, AMARILLO). El auditor **demostró la decisión de diseño en vez de opinarla**: borró cada plantilla y corrió el archivo. Sin `.env.production.example` (patrón nuevo, lectura dentro del `it`) → **2 fallan y 4 siguen corriendo**. Sin `.env.example` (patrón viejo, constante de módulo) → **«no tests»: ninguno de los 6 llega a ejecutarse**, el error revienta en la importación. El patrón nuevo no es cosmético. |
| 2026-08-14 | Residuo que ese mismo auditor levantó y **no es culpa de T-03**: mientras `PLANTILLA` (`entorno.test.ts:58`) se lea al cargar el módulo, **la protección de T-03 sigue siendo rehén de la otra plantilla** — si desaparece `.env.example`, los dos casos de producción tampoco corren. El candado a rehacer es el de F0.3, y la restricción de no tocar los 4 casos verdes era explícita. Queda como mejora pendiente, pequeña. |
| 2026-08-14 | 🔴 **Y me pilló otra vez, con razón.** `tablero.md:31` escribía «805 pruebas en 73 archivos» **doce minutos después** de que `703649e` retirara los recuentos globales de `CLAUDE.md` y de `entorno-y-despliegue.md` con el argumento de que crecen y hay que medirlos. Meter el total de la suite en la bóveda justo después va contra una decisión recién tomada. Retirado. (Los «4 casos» y «6 casos» de esa misma celda **no** son lo mismo: son el tamaño del candado, una afirmación de contrato, no una medición del entorno.) |
| 2026-08-14 | **T-03 ejecutada** (`ef70aa9`, ROJO, en verificación al escribir esto): fuera la cookie comodín de `.env.production.example` y el candado extendido a la segunda plantilla — su `AUTOREGISTRO=0` estaba tan desvigilado como estuvo el otro. **Aquí el rojo salió solo**, sin tener que forzarlo: la línea existía. 805 pruebas en 73 archivos. |
| 2026-08-14 | Detalle de oficio de T-03: sus dos casos leen la plantilla **dentro del `it`**, no en una constante de módulo como los de F0.3 — recogiendo el hallazgo de calidad que dejó aquella auditoría (leer al cargar el módulo hace que un archivo ausente tumbe también los casos de F2.6 con un error de importación). **No tocó la constante existente** para no mover los 4 casos que ya pasaban, y lo declaró. |
| 2026-08-14 | **F0.3 COMPLETADA_LOCAL** (`6044732`, AMARILLO). Con eso la Fase 0 queda terminada en todo lo que no exige una persona. El auditor **comprobó que la prueba muerde**: puso `.env.example` en `AUTOREGISTRO=1`, la vio roja, y restauró dejando el árbol como estaba. Y añadió una comprobación que nadie pidió: el archivo tiene finales **CRLF** en el árbol y la regex casa igual, porque en JS el `$` con flag `m` ancla antes del `\r` — **no hay falso rojo esperando a un clon en Windows**. |
| 2026-08-14 | Corregidas **dos afirmaciones falsas que ese mismo commit escribió** en la bóveda: `entorno-y-despliegue.md` decía «`COOKIE_DOMAIN` ya no está en la plantilla … sigue viva solo en `_archive/`», y `manual-tecnico.md` prometía que la prueba «impide que vuelva». Las dos ignoran que **`.env.production.example:9` la sigue declarando**. La prueba lee **una sola** plantilla. |
| 2026-08-14 | 🔴 **Dimensionado el riesgo de `.env.production.example:9`** (`COOKIE_DOMAIN=.{TENANT_SLUG}.spaces.com`), y es más que cosmético. **Inocuo hoy**: `apps/web` no lee la variable. **Latente por tres vías**: (a) el código que sí la consume existe en el repo —`_archive/api/src/core/auth/auth.routes.ts:17` hace `domain: process.env.COOKIE_DOMAIN`—, así que el día que alguien haga configurable el `domain` de `cookieSesion()`, los `.env` nacidos de esa plantilla comparten sesión por todo `*.spaces.com`: **fuga entre instancias soberanas, R1 y R2 a la vez, en silencio**; (b) es una instrucción explícita al operador, que tomará decisiones de DNS y certificados sobre un modelo muerto; (c) **ninguna tarea del plan la limpia** — F5.3 crea una plantilla *nueva* sin la variable pero **no toca esta**. Queda huérfana. |
| 2026-08-14 | Hallazgos menores de esa auditoría, no corregidos: la constante `PLANTILLA` de `entorno.test.ts:57` se lee **al cargar el módulo**, así que si `.env.example` desapareciera caerían también los 2 casos de F2.6 con un error de importación, en vez de fallar el caso que toca. Y el paso 4 pedía «un comentario de una línea» y quedaron tres — la sustancia es la pedida. |
| 2026-08-14 | **Expediente de la Fase 2 commiteado** (`84fe410`, `docs/evidencias/fase-2.md`), como **cierre parcial**. El documentalista **reprodujo el control positivo de secretos por su cuenta** en vez de citarlo: 11 patrones extraídos de los `.env`, 4/4 detectados en el standalone donde el `.env` sí está, **0 dentro de la imagen**. Y rehasheó los 68 archivos de `/app/db`: md5 agregado **idéntico** al repo a los dos lados. |
| 2026-08-14 | Honestidad de ese expediente: **no pudo reverificar los 15 104 bytes** de `login.html` post-F2.6 porque esa imagen ya no existe en la máquina. Reconstruyó y midió **14 594 bytes con 0 apariciones** — misma conclusión, otro artefacto — y lo dijo en vez de repetir el número ajeno. |
| 2026-08-14 | 🔴 **Y me pilló a mí.** `CLAUDE.md` §4 seguía diciendo «789 unitarias en 71 archivos» con la coletilla «medidas el 2026-08-14» que **yo mismo puse**: re-fechar con el dato viejo dentro, el defecto que llevo toda la sesión señalando en otros. Medido hoy: **803 en 73**. Corregido, y esta vez **sin número**: la línea ahora dice que el recuento crece y hay que medirlo. Lo mismo en `entorno-y-despliegue.md:102-103`. |
| 2026-08-14 | De paso, una trampa que casi me come al medirlo: `cd apps/web && npm test` desde la **raíz** del repo da **796 en 72** — es otra rama (`feat/ui-base-404-atajos`). El worktree da **803 en 73**. Anotado en `CLAUDE.md`. |
| 2026-08-14 | Matiz que el expediente de la Fase 2 deja dicho y conviene no perder: **el plan permitía escribir F2.3/F2.4 hoy** con el registry como parámetro (`Plan…v3.md:678-680`), y no se hicieron. Es defendible —el nombre del registry es P4— pero queda constando que fue una decisión, no un bloqueo absoluto. |
| 2026-08-14 | Hallazgo de clasificación: **`Dockerfile` y `.dockerignore` no están en ninguna zona de riesgo**, y `.dockerignore:13` (`**/.env*`) es hoy **lo único que impide hornear credenciales** en la imagen de toda la flota. |
| 2026-08-14 | **Expediente de la Fase 0 commiteado** (`29c6b9e`, `docs/evidencias/fase-0.md`): una fase **sin una sola tarea ejecutada** y que además **perdió su premisa**. El documentalista **corrigió al orquestador dos veces**: (a) el punto (d) de la auditoría de F2.6 estaba contado de más — el campo `Archivos:` de F0.3 apunta a `.env.example` «líneas 17-23 **y línea 4**», y **la línea 4 sigue siendo `COOKIE_DOMAIN=localhost`**, así que el paso 4 de F0.3 sigue aplicando tal cual; (b) el comando de F0.1 no está en `:262-273` como le dije, sino el `curl` en `:267-271` y el `ssh` en `:275`. |
| 2026-08-14 | 🔴 **Lo que nadie había visto: el criterio de F0.3 sigue sin cumplirse, y afecta a la decisión de hoy.** `.env.example` bajó a `AUTOREGISTRO=0`, pero **ninguna prueba lo ancla** — comprobado: el único `env.example` en `apps/web` es un comentario en `integraciones.ts:16`. **Devolverlo a `=1` deja la suite verde y el CI mudo.** La decisión de Jochelo del 14/08 la sostiene hoy un valor en una plantilla que nada vigila. La mitad «que una prueba impida volver atrás» sigue **entera sin hacer**. |
| 2026-08-14 | Dos arrastres más que localizó ese expediente: **F5.3 depende de F0.3** (`:1493`) y escribe el nombre viejo tres veces (`:1497,:1504`); y el recuento de pruebas del plan (`:2037`) presupone **6 casos** en `entorno.test.ts` cuando hay **2**. |
| 2026-08-14 | ⚠️ **TH-F0.1 emitida, con una advertencia que cambia el guion:** si el `curl` al droplet devuelve 400 (registro abierto), **F0.2 NO se ejecuta como está escrita**. Con la decisión del 14/08 la acción correcta es **borrar la línea vieja**, no poner la bandera a 1. |
| 2026-08-14 | Y una cobertura ausente por una razón que ya no es la razón: `aislamiento.e2e.test.ts:200-213` sigue con su `it.skip` justificado en que «la bandera se hornea en el build» — **falso desde `70ca3f0`**. El bloque se retira en un release posterior (expand → contract), pero conviene no leer ese `skip` como si siguiera siendo inevitable. |
| 2026-08-14 | 🔵 **Cerrada también la DEMO.** Jochelo lo confirmó al preguntárselo: **ninguna instancia abre el registro**, DEMO incluida. La bandera existe y funciona, pero hoy **nadie la enciende**. |
| 2026-08-14 | **Consecuencias de que el registro quede cerrado en todas partes**, ninguna resuelta aquí: (a) **F4.4 (`:1345`) queda contradicha** — manda `.env` de DEMO con el autoregistro encendido, y ahora va apagado; (b) **`POST /api/signup` pasa a ser código sin uso** en toda la flota, y `/api/auth/metodos/` devolverá siempre `autoregistro:false`; (c) **el alta de una organización nueva ya no tiene camino por la aplicación** — queda solo el tenant `rgb` que siembra `db/schema.sql:598` más el usuario que crea `bootstrap-auth.mjs`, que resuelve **por slug `rgb` y aborta si falta**. O sea que **cada instancia nueva nacería con una organización llamada `rgb`**, lo cual enlaza directamente con **P1** (destino del tenant `rgb`), que sigue abierta. |
| 2026-08-14 | Nota sobre P4-bis: que nadie encienda la bandera **no invalida F2.6**. Sacarla del build sigue siendo lo correcto —un solo artefacto para toda la flota, y encender el registro deja de exigir recompilar— y de paso arregló el botón horneado, que era un defecto real con el registro abierto **o** cerrado. |
| 2026-08-14 | **F2.6 COMPLETADA_LOCAL** (`70ca3f0`, AMARILLO). La auditoría reprodujo los tres casos con una sola construcción y tres arranques, y midió el botón **dentro de las dos imágenes**: `space-os:dev` (pre-F2.6) tiene `login.html` de 15 234 B con **1** aparición de «Crear cuenta»; la de `70ca3f0`, 15 104 B con **0**. Las dos cifras del ejecutor son ciertas al byte. |
| 2026-08-14 | Honestidad del auditor sobre el TDD: el segundo rojo —poner la polaridad vieja a propósito para verlo fallar— **no es verificable desde el repositorio**: no hay commit intermedio ni reflog que lo conserve. Lo que sí hizo fue ejecutar ambas polaridades y confirmar que ese rojo **tenía que salir** necesariamente. Lo da «por creíble, no por probado», que es la distinción correcta. |
| 2026-08-14 | 🔴 **Arreglado el hallazgo con riesgo operativo real:** `entorno-y-despliegue.md:241` —la tabla canónica de variables, **la que lee quien prepara el `.env` de una instancia**— seguía diciendo `NEXT_PUBLIC_AUTOREGISTRO / '0' apaga el alta pública / signup/route.ts:18`. **Falsa en las tres columnas**, y la nota llevaba `actualizado: 2026-08-14`. Siguiendo esa fila, DEMO se habría quedado con el registro cerrado. Corregida a `AUTOREGISTRO`, con el fail-closed explícito. |
| 2026-08-14 | Corregidos también dos punteros que F2.6 desplazó y dejó atrás en notas que **sí** re-fechó: `manual-tecnico.md:709-711` (tres citas: `login/page.tsx:126`→**`:134`**, `signup/route.ts:18`→**`:21`**, rate limit `:26`→**`:28`**) y `acceso-y-sesion-ui.md:57-61`, cuyo callout citaba una frase de `signup/route.ts:12-16` **que ese mismo commit borró** — la sustancia sobrevive en `:15-18`, la cita textual no. Ojo: el auditor dijo `:133` para `esSignup` y medido son **`:134`**. |
| 2026-08-14 | 🔴 **El renombrado rompe CUATRO tareas del plan, ninguna tocada.** Además de F0.3 —contradicha en cuatro puntos, no uno—: **F4.4 (`:1345`) es la peor**, manda poner `NEXT_PUBLIC_AUTOREGISTRO=1` en el `.env` de DEMO, así que **DEMO nacería con el registro CERRADO**, justo lo contrario de lo que P4-bis compró. **F5.3 (`:1497,:1504`)** grabaría una variable muerta en la plantilla de todas las instancias. **F2.5 (`:846,:850-851`)** ya está registrada. **F0.2 (`:302-307`)** su `sed` vale solo mientras el droplet corra el build viejo. |
| 2026-08-14 | Deuda que deja el diseño de F2.6, anotada por el auditor: **ningún test ejerce `GET /api/auth/metodos/`**. El nombre del campo `autoregistro` en ese JSON es hoy **la única atadura** entre el servidor y el botón; si alguien lo renombra, el botón desaparece **en silencio** — fail-closed, no rompe nada y no avisa nadie. Se acepta el cierre porque el repo no tiene navegador headless y el modo de fallo cae del lado seguro, pero es **cobertura perdida, no cobertura equivalente**. |
| 2026-08-14 | La bitácora de F2.6 (`docs/Registro_Cambios.md:8-33`) pasó el juicio del auditor **sin reparos**: abre por lo que se ve («una puerta pintada en la pared»), explica la causa sin jerga, y pone el aviso duro —el `.env` que siga con el nombre viejo amanece con el registro cerrado— en la única forma en que alguien que no programa puede actuar sobre él. |
| 2026-08-14 | **F2.2 COMPLETADA_LOCAL** (`3f16386`, **VERDE**). La auditoría no se limitó a buscar secretos: **montó un control positivo**. Extrajo los 11 valores literales de `apps/web/.env` y `.env.local`, comprobó que ese juego de patrones **sí acierta** sobre el artefacto local `standalone/apps/web/.env` —o sea, que el método detecta el `.env` cuando lo hay— y solo entonces afirmó que en la imagen no aparece ninguno. También materializó el stage `build` para ver que el `.env` **nunca entra al contexto**, en vez de conformarse con que no esté al final. |
| 2026-08-14 | Esa auditoría comparó además el **md5 de los 68 archivos** de `/app/db` (schema + 67 migraciones) contra el repo: **byte a byte idénticos**, sin corrupción de finales de línea pese al host Windows. Y verificó las dos decisiones de diseño del ejecutor **dentro del contenedor**: los `node_modules` anidados de `packages/eslint-config` y `packages/ui` existen de verdad tras el `npm ci`, y la plantilla `.xlsx` llega a la imagen (200, 31 322 bytes). |
| 2026-08-14 | **Deuda confirmada y peor de lo reportado: el alias muerto de `styled-jsx`.** `next.config.mjs:62-65` apunta a `apps/web/node_modules/styled-jsx`, que en local solo contiene `.vite` y **dentro del stage `build` ni siquiera existe**. Y el comentario que lo justifica (`:59-61`) **también está caducado**: habla de «styled-jsx (React 19) … while react-dom is still v18» cuando en el árbol hay styled-jsx 5.1.1 y react/react-dom 18.3.1 — **no hay React 19 por ningún lado**. Inocuo hoy, pero es código muerto con una justificación falsa que alguien creerá. Pre-existente, anterior a F2.1. **Merece tarea propia.** |
| 2026-08-14 | Hallazgo de proceso, repetido: en F2.1 y F2.2 la zona **Z12 aparece `LIBRE` antes y después** del commit — no queda rastro de la reclamación ni de la liberación, que es la regla 1 de AGENTES. Es costumbre de la tanda, no descuido puntual de un agente. |
| 2026-08-14 | **F2.5 ENSAYADA_LOCAL.** Smoke literal del plan en verde —`login 200 · metodos 200 · signup 503 · estado 401`— y lo que más importaba: **el login carga con estilos**. Los 18 activos que la página pide (3 hojas + 15 chunks) responden 200, y el CSS grande trae **707 reglas** con las utilidades del login dentro: no es un 200 vacío. El `COPY` de `.next/static` y `public` de F2.2 está bien hecho; **no hay que volver a F2.1**. Además la app habló de verdad con la base como `spaces_app` (sin `bypassrls`): un login con credenciales falsas devolvió 401 desde una consulta real. |
| 2026-08-14 | 🔴 **HALLAZGO GORDO de F2.5: la imagen NO puede levantar una base nueva ella sola.** `db/migrations/20260729_licencias_permisos.sql:96-97` hace `raise exception` si no encuentra un rol de aplicación con grants, y en una base recién creada no lo hay: la cadena se corta en la migración 20260729. **13 migraciones** referencian el rol. `Dockerfile:94-95` copia **solo** `db/schema.sql` y `db/migrations`, y `db/dev-rol-app.sql` no viaja — y aunque viajara, es de desarrollo (rol `spaces_app`, contraseña en claro) mientras en producción el rol es `spaces_user`. **El orden obligatorio es: crear el rol de app → `schema.sql` → las 67 migraciones con el mapa `ANTES_DE`**, y hoy nada en la imagen crea el rol. Le cae encima al runner de **F3.2/F3.3** y al aprovisionamiento de la **Fase 5**. |
| 2026-08-14 | ⚠️ **El 503 de F2.5 sale, pero por el motivo CONTRARIO al que dice el plan.** El plan lo justifica con «el autoregistro viene apagado **horneado**, invariante 9». Falso en esta imagen: el `.dockerignore` excluye `**/.env*`, así que la variable no existía en el build y Next no sustituyó ningún literal. Medido en el compilado: `signup/route.js` y el chunk de `google-oauth` **leen el entorno en tiempo de ejecución**. Comprobado con la **misma imagen sin recompilar**: `=0`→503, `=1`→400. |
| 2026-08-14 | **Consecuencia operativa para toda la flota, de ese mismo hallazgo:** lo que sí está horneado —y horneado **encendido**— es la UI. `login.html` es un prerender de build de 15 234 bytes que **ya trae dentro el botón «Crear cuenta»**, y ningún valor de entorno lo cambia. Cada instancia de owner mostrará un botón que al usarse devuelve `503 «El registro de cuentas nuevas está deshabilitado»`. No es fallo de la imagen: es P4-bis sin cerrar. |
| 2026-08-14 | El ensayo resolvió de paso el `[SIN VERIFICAR]` del paso 3 de **F2.6**: la vía de props/env **queda descartada por evidencia** (la página se prerrenderiza), así que el valor tiene que llegar por `GET /api/auth/metodos/`, que hoy devuelve solo `{"google":false}` y necesita un campo nuevo. |
| 2026-08-14 | **FASE 1 CERRADA EN LOCAL.** Expediente commiteado (hoy en `docs/evidencias/fase-1.md`) (`fb09b91`, 17 secciones). Es la primera vez que corre el `documentalista`, escrito hoy a raíz de la regla de cierre de fase. **La fase no se declaró cerrada hasta que el expediente existió**, que es lo que esa regla exige. |
| 2026-08-14 | El documentalista no se creyó los reportes: reverificó los cinco commits con `git show --stat`, abrió cada `archivo:línea` que cita, recuperó el `extractSubdomain` viejo con `git show 3671e8a^` para confirmar el `parts.length >= 3`, y remidió hoy contra el 5433 en solo lectura — 23 tablas con default, 0 sin `NOT NULL`, `sitio_modalidades` vacía, **33 filas repartidas en 9 tablas y 14 vacías**. Sin discrepancias sustantivas. |
| 2026-08-14 | Tres punteros que corrigió al citar, y que veníamos arrastrando mal: el guard de nombre de base está en `db-e2e.ts:34-39` (no `:32-38`), y la afirmación de que el esquema desplegado difiere está en **`db-e2e.ts:103-108`** — el plan la cita como `:100-118` y la bóveda como `:103-112`. Dice «le faltan 143» columnas y nombra `almacen_activos`/`almacen_movimientos`. |
| 2026-08-14 | ⚠️ **La Fase 1 entera no dejó una sola línea en `docs/Registro_Cambios.md`.** `git log 1ad1045~1..HEAD -- docs/Registro_Cambios.md` sale vacío. Cada tarea lo justificó bien por separado —nada se nota desde la aplicación— pero el agregado es que una fase completa no tiene rastro en la bitácora. No es falta todavía: el paso 4 de F1.1 manda escribir ahí el censo, y el censo real no se ha corrido. **F1.5 sí necesita entrada.** |
| 2026-08-14 | **F2.1 COMPLETADA_LOCAL** (`8ae8f77`, AMARILLO). Su primera auditoría murió a mitad por un login expirado —no por el código— y se relanzó de cero. La segunda comprobó **las dos formas de arrancar** levantando las dos de verdad: `npm start` (la que usa `ecosystem.config.js` en el droplet) y el standalone, 200 en `/login/` y 307 en la raíz del `basePath` en ambas. Producción no queda sin arrancar. |
| 2026-08-14 | **Confirmado que el standalone NO trae los estáticos, y que eso es normal**, por tres vías independientes: el trazado sí funcionó (33 paquetes hoisted en `.next/standalone/node_modules`), el SSR completo renderiza, y `copyTracedFiles` de Next no copia `public` ni `static` por diseño. **F2.2 no se construye sobre una premisa falsa**: copiarlos en el `Dockerfile` es lo correcto. |
| 2026-08-14 | ⚠️ **El standalone SE LLEVA el `.env` dentro, y nadie lo había dicho.** `apps/web/.next/standalone/apps/web/.env` es byte a byte el mismo que `apps/web/.env` (md5 `6032654f…`), con `GOOGLE_CLIENT_SECRET` incluido. **No hay fuga a git** (`.gitignore:14` lo cubre, árbol limpio) y no incumple ningún criterio de F2.1. Pero el criterio de aceptación de **F2.2** —«no contiene ningún `.env` ni credenciales»— **depende enteramente de que `**/.env*` esté en el `.dockerignore`**: si el contexto de build lleva un `.env`, Next lo hornea en el standalone **sin avisar**. Pasado a F2.2 como insumo duro, con la orden de comprobarlo **dentro de la imagen** y no solo en el `.dockerignore`. |
| 2026-08-14 | Hallazgos menores de esa auditoría, anotados sin corregir: `inventario-2026-08-11.md` conserva cuatro citas a `next.config.mjs` ya desplazadas (es foto fechada, se deja), y el cuerpo del commit dice «10 líneas» donde fueron **11** — las citas sí se recalcularon con +11, así que el error está en la narración y no en el resultado. |
| 2026-08-13 | **Hallazgo abierto de F1.4**, escalado a Jochelo: el plan exige que «el rewrite de `portal` siga igual», y con `Host` en mayúsculas (`PORTAL.space-os.io`) o con punto final (`portal.space-os.io.`, FQDN legal) **el comportamiento cambia**. La guarda `etiquetas.some(e => e === '')` de `host.ts:44-45` lo justifica como «basura», sin mencionar el FQDN. No es agujero de seguridad —`/portal/*` es público por token— y los navegadores normalizan, así que no es alcanzable desde un cliente real. |
| 2026-08-14 | 🔁 **Dos orquestadores corrieron a la vez sobre esta rama, sin saberlo el uno del otro.** Una segunda sesión abrió el mismo worktree, remidió la línea base y **lanzó su propio verificador sobre F2.1** mientras el primero hacía lo mismo. Los dos veredictos coincidieron —AMARILLO, las dos formas de arranque comprobadas de verdad, suites idénticas a la línea base, diff limitado a `next.config.mjs`— así que **F2.1 queda doblemente auditada por caminos independientes**, que es la única lectura buena del episodio. El resto es coste: trabajo pagado dos veces y esta bitácora con dos juegos de apuntes del mismo día, fusionados aquí. **Decisión de Jochelo (14/08): sigue la sesión que tiene el ejecutor de F2.2 a medias; la otra se retira.** El verificador de la sesión retirada lo había detectado solo, por el árbol cambiando bajo sus pies (`Dockerfile` y `.dockerignore` apareciendo sin seguimiento a mitad de auditoría). **Regla que faltaba: antes de lanzar a nadie, comprobar que no haya otra orquestación viva** — `git log` de los últimos minutos y zonas `TOMADA` en el tablero con fecha de hoy. |
| 2026-08-14 | Entorno de la sesión retirada, útil como confirmación independiente: no hubo que montar nada. `spaces_db` llevaba 21 h arriba y sano, `node_modules`, los dos `.env` y el `.next/BUILD_ID` seguían en su sitio. Línea base: typecheck limpio y **799 unitarias en 72 archivos**. |
| 2026-08-14 | **El par (F2.1 ∥ F3.1) del DAG no se usa, y conviene recordarlo cuando toque F3.1.** F3.1 es `[migración]`, así que su verificación acabará en `npm run test:e2e`; cualquier otra tarea que también termine en e2e comparte con ella la única base `spaces_e2e`, y cada archivo la recrea con `drop schema public cascade`. Se aplica la regla del 13/08 — el paralelo solo vale si como mucho UNA de las dos toca la e2e. |
| 2026-08-14 | ⚠️ **Legado de la auditoría retirada, y le corre prisa a F2.2: el plan quedó desfasado por el propio commit que audita.** `Plan_Instancias_Soberanas_v3.md:726`, dentro de los «Hechos del repo que la imagen respeta (**verificados**)» de **F2.2**, cita `basePath: '/spaces-dooh'` y `trailingSlash: true` en `next.config.mjs:8-9`. Tras F2.1 eso vive en la **19-20**; la 8-9 es hoy un comentario. Quien esté escribiendo el `Dockerfile` está leyendo una cita que ya no apunta donde dice. (`:87` también cita la 8-9, pero ahí describe el estado *previo* y es correcto como historia.) **No se toca el plan**: se escala. |
| 2026-08-14 | Dos hallazgos menores más de esa auditoría, anotados sin corregir. **(a)** Tres de las seis notas que tocó `8ae8f77` se editaron **sin mover su `actualizado:`**: `preguntas-abiertas.md` sigue en 2026-08-10, `integraciones-externas.md` en 2026-08-07 y `manual-tecnico.md` en 2026-08-11, aunque sus citas se revalidaron el 13/08. Es el mismo defecto que ya apareció en F1.3 y T-01, pero al revés: allí se subió la fecha con datos viejos dentro, aquí se validó sin subirla. **(b)** El alias de `styled-jsx` de `next.config.mjs:62-65` resuelve a `apps/web/node_modules/styled-jsx`, y **ese directorio no existe** en la instalación actual — solo está la copia hoisted de la raíz (`5.1.1`), que es la que acabó en el artefacto, sin divergencia de versión. Es **preexistente**, no lo introduce el commit, pero es una afirmación de la bóveda que hoy no se sostiene. |
| 2026-08-14 | Desfase anotado, sin corregir: `CLAUDE.md` (raíz y worktree) sigue diciendo «789 unitarias en 71 archivos» cuando son **799 en 72**, y en la misma frase se declara medido el 14/08. Su conteo de e2e (13 archivos, 140 + 1 saltada) sí es el bueno. Va con el commit de quien lo corrija, no suelto. |
| 2026-08-14 | ✅ **FASE 0 VALIDADA por `validador-plan` — veredicto AMARILLO**, sobre HEAD `6cb16d4`. Primera pasada por la compuerta de cierre. **Ningún hallazgo toca el código:** los dos commits (`6044732`, `ef70aa9`) existen, tienen auditoría independiente —comprobada por contenido, no por color: cada auditor reportó actos que su ejecutor no reportó— y los invariantes salen limpios (`aislamiento.e2e.test.ts` intacto en toda la rama, `db/schema.sql` sin tocar, ninguna migración preexistente modificada, cero secretos). Typecheck limpio y **805 pruebas en 73 archivos**. La e2e **no se corrió y no era exigible**: la fase solo toca plantillas `.env` y una prueba unitaria. El validador comprobó además, sin escribir nada, que **el candado muerde**, evaluando las cuatro expresiones contra copias en memoria con los valores invertidos. |
| 2026-08-14 | **Los tres defectos que dieron el AMARILLO eran del tablero, y se corrigieron aquí mismo.** (1) El titular decía «ninguna tarea ejecutada» tres líneas encima de dos filas COMPLETADA_LOCAL con commit: lo escribió `b57987c` cuando era cierto y cuatro commits posteriores actualizaron las filas sin tocarlo. (2) Citaba el expediente en `29c6b9e` cuando el archivo vivo es `9860d35`, que **en su propio cuerpo se declara sustituto** — el enlace por ruta llevaba al bueno, la cita del commit al obsoleto. (3) **F0.2 vivía en un estado inventado**, «NO EJECUTADA», que no está en la leyenda; ahora es `PENDIENTE_SERVIDOR (condicionada a TH-F0.1)`. **Lección: un callout de cabecera no se actualiza solo porque se actualicen sus filas, y es lo primero que lee un humano con prisa.** |
| 2026-08-14 | La tesis de que la Fase 0 quedó «sobrepasada por los hechos» resultó **cierta a medias**, y el matiz importa: la **premisa sí se cayó** —el título persigue una asimetría (apagado en owners, encendido en DEMO) que `0dbccb8` y `39379bf` eliminaron al cerrar el registro en todas partes— pero **«ninguna tarea ejecutada» era falso**. La fase queda como **cierre PARCIAL**: lo ejecutable en local está hecho y auditado; lo que le da nombre —¿está abierto el registro hoy en el droplet?— sigue sin respuesta, y con él **F0.2 y toda la Fase 4** (`plan:260`). |
| 2026-08-14 | ⚠️ **Hallazgo nuevo de esa validación, sin corregir:** `.env.production.example:54` sigue proponiendo `NEXT_PUBLIC_API_URL=https://{TENANT_SLUG}.spaces.com/api` — el modelo de subdominios muerto el 12/08. T-03 limpió la cookie comodín **de ese mismo archivo** argumentando que era grave *aunque ninguna línea de `apps/` la leyera*; esta variable **sí se lee, en seis archivos vivos** (`api-client.ts:1`, `auth-context.tsx:16`, `data/adapters/http.ts:15`, `portal-cliente-api.ts:1`, `ReadinessPanel.tsx:17`, `_legacy/portal/[token]/page.tsx:7`), quince líneas más abajo, y nadie la miró. Preexistente —por eso el criterio 3 pasa— pero es insumo para **F5.3**, que hereda esta plantilla. |
| 2026-08-14 | Menor de la misma validación: `apps/web/app/api/signup/route.ts:15` sigue llamando a DEMO «la única con el registro abierto», falso desde `39379bf`. Y F0.3 se ejecutó **sin su dependencia F0.1** (`plan:337`) — materialmente inocuo, porque opera sobre archivos del repo y su resultado no cambia con lo que conteste el droplet, y ya estaba declarado. Se registra para que conste en el veredicto de fase, no para reabrirlo. |

| 2026-08-17 | **Sesión nueva.** Docker estaba **caído** —el daemon no respondía— y hubo que levantar Docker Desktop antes de nada; `spaces_db` revivido con `docker start`, no con `compose up`, para reusar el volumen `db_spaces_pgdata` con los datos reales. Lo demás seguía montado: `node_modules`, los dos `.env` y `.next/BUILD_ID`. Línea base: typecheck limpio y **805 pruebas en 73 archivos**, idéntica a la del validador del 14/08. Ninguna zona `TOMADA`, árbol limpio, sin otra orquestación viva. |
| 2026-08-17 | 🔵 **DECISIÓN DE JOCHELO — P4 RESUELTA: DigitalOcean Container Registry.** Y el matiz que importa: **no desbloquea código**. El plan ya había previsto esta indecisión en F2.3 paso 5 (`:785-786`), donde manda elegir el login según `vars.REGISTRY_TIPO` «para no reescribir el workflow cuando se decida §8.4». O sea que F2.3/F2.4 se podían escribir desde siempre —el expediente de la Fase 2 ya lo había dicho (`:387`)— y lo que la decisión fija es **el valor de dos variables de repositorio**, que pone una persona: tarjeta **TH-P4**. ⚠️ **Arrastra P3**, que sigue abierta: un registry de DO vive en una cuenta concreta y aún no se sabe en cuál nacen las instancias. F2.3 y F2.4 pasan de BLOQUEADA a PENDIENTE. |
| 2026-08-17 | ✅ **FASE 1 VALIDADA por `validador-plan` — veredicto AMARILLO**, sobre HEAD `04952a7`. **Ningún hallazgo toca el código, la migración ni las pruebas**: los siete son de tablero y expediente. El validador corrió las suites él mismo en vez de creerse los reportes: typecheck limpio, **805 unitarias en 73 archivos** y —esto es lo que la Fase 1 exigía y nadie había corrido en la compuerta— **147 e2e + 1 saltada en 14 archivos, exit 0**, respetando el guard de nombre de base. Invariantes limpios los seis, incluido `aislamiento.e2e.test.ts` intacto en **toda la rama** y cero `qRaw` nuevo. Abrió las **30 citas a código** del expediente y **todas resuelven hoy**. |
| 2026-08-17 | **Tres de los siete hallazgos eran míos, y se corrigen en este mismo commit.** **(H1)** F1.5 llevaba desde el 13/08 en `PENDIENTE_SERVIDOR` **sin tarjeta emitida**, cuando la leyenda dice que ese estado exige tarjeta; su ritual solo existía en prosa dentro del expediente, y peor: **TH-F3.1 se refería a «la de F1.5» como si existiera**. Emitida **TH-F1.5** con los cuatro pasos literales del plan. **(H2)** El titular de la Fase 1 decía «cinco commits ROJO» tres líneas encima de una tabla que lista **cuatro** — el criterio «ROJO es lo que su ejecutor declaró ROJO» excluye a `3671e8a`. Es el mismo defecto que la validación de la Fase 0 ya me había levantado: **un callout de cabecera no se actualiza solo porque se actualicen sus filas**. **(H3)** El expediente estaba citado por el commit equivocado, `fb09b91` en vez de **`7138f89`** — aquel escribió 593 líneas en la ruta vieja y `7138f89` lo reescribió a las 739 de hoy. Lo mismo pasaba con la Fase 2: citaba `84fe410` cuando el vivo es **`fc04607`**. **Van tres validaciones y las tres han encontrado el mismo tipo de defecto en este archivo.** |
| 2026-08-17 | **H6 corregido también: TH-02 ya es copiable-pegable.** Su paso 1 tenía una elipsis —«… las tres consultas de F1.1, copiadas literalmente del plan …»— y obligaba a transcribir a mano `plan:390-419` justo en el paso donde **una errata produce un censo falso**. Materializadas las tres consultas dentro de la tarjeta. Veinte líneas a cambio de quitar el único paso manual de la tarjeta más cara de la fase. |
| 2026-08-17 | **H4 y H5 se anotan sin corregir, y la recomendación que dejan vale más que ellos.** De las ~28 citas que el expediente de la Fase 1 dirige a **este** archivo, hoy resuelven **dos**: TH-02 se movió +95 líneas, la decisión del registro cerrado +111. Lo que salva al expediente es que se declara histórico y sus anclas resolvían contra `38ace2f`; lo que **no** lo salva es que ya nacieron con +4 de error, porque `affa785` metió cuatro líneas entre su ancla y su commit. Tercer episodio del mismo defecto. **Regla nueva para los expedientes: citar este archivo por título de sección, nunca por número de línea** — es el único documento del repositorio que crece cada hora. (H5 es de la misma familia: el expediente dice 67 migraciones y 13 archivos e2e, hoy son **68** y **14**, movidos por `6cb16d4`, de otra fase.) |
| 2026-08-17 | **H7 — la bitácora vacía de la Fase 1: el validador la juzga ACEPTABLE para cerrar, y razona por qué**, que era lo que le pedí. El paso 4 de F1.1 condiciona la entrada **al censo**, y el censo no se ha corrido: escribirla hoy sería inventar datos. F1.2 está escrita y no aplicada, F1.3 es endurecimiento invisible, T-01 y T-02 son un script de operador. El único caso discutible es **F1.4** —entrar por la IP desnuda ya no reescribe a `/portal`— pero es acceso directo por IP al droplet, no un flujo de usuario. Y la ausencia está **declarada** en los dos sitios que la regla exige. Lo que sí queda anotado: **son dos fases consecutivas sin una línea**, y la entrada de F1.5 debe escribirse **en el momento de aplicar la migración**, junto con el censo, no después. |
| 2026-08-17 | Dependencia hacia adelante que el validador confirma bien declarada y conviene no perder: **F4.2 depende de F1.5** (`plan:1267`), y F1.5 sigue sin correr. **La Fase 4 no puede arrancar creyendo que la Fase 1 está «hecha»** — está cerrada en local, y en producción el `DEFAULT` sigue vivo. |

| 2026-08-17 | 🔵 **Jochelo ACEPTA el AMARILLO de la Fase 1. FASE 1 CERRADA.** Cerrada en local, no en producción: el `DEFAULT` sigue vivo en `spaces_prod`, y quedan TH-F1.5, TH-02 y cuatro commits ROJO esperando visto bueno antes del merge. |
| 2026-08-17 | ✅ **FASE 2 VALIDADA por `validador-plan` — veredicto AMARILLO, como CIERRE PARCIAL**, sobre HEAD `37b8ffd`. Ningún hallazgo toca código, migraciones ni pruebas: los siete son de tablero, expediente y punteros. Corrió las tres suites él mismo aunque el validador de la Fase 1 ya las hubiera pasado, **porque la fase toca auth y la bandera de un guard de seguridad**: typecheck limpio, **805 unitarias en 73** y **147 e2e + 1 saltada en 14**, exit 0. Los seis invariantes limpios. Y dejó dicho lo que la propia fase clava en su §8.5: **`COMPLETADA_LOCAL` no es «hecho»** — la rama no está mergeada y producción corre el build viejo, donde `NEXT_PUBLIC_AUTOREGISTRO` todavía manda. |
| 2026-08-17 | **Lo mejor de esa validación: no se creyó el punto más caro, lo reprodujo.** «La imagen no lleva secretos» dependía de una auditoría del 14/08 y yo le pregunté si la cadena se sostenía o si colgaba de una imagen que ya no existe. **Existe** (`space-os:dev`, `ce261aed83e7`, 240 MB) y `Dockerfile`/`.dockerignore` no se han tocado desde `3f16386`, así que es la misma configuración que HEAD. Rehízo el control positivo entero: 11 patrones sacados de los `.env`, **detectados** en el `.env` del standalone —o sea que el método acierta cuando hay algo— y **0 coincidencias dentro de `/app`**. El cero tiene control positivo detrás, hoy. |
| 2026-08-17 | 🔴 **H1 — una dependencia declarada al revés, corregida antes de lanzar nada.** La fila de F3.4 decía «Depende de: F3.2, F2.5»; el plan dice **F3.2, F3.3, F2.4** (`:1034`). Se perdía F3.3 y se cambiaba F2.4 —**que no está escrita**— por F2.5, que sí está hecha. Efecto: F3.4 parecía arrancable en cuanto cayera F3.2, cuando **su dependencia real no existe**: sin F2.4 no hay canal del que jalar. El expediente lo decía bien en §9 y la fila lo contradecía. |
| 2026-08-17 | 🔴 **H2 — el hallazgo del rol de aplicación estaba bien escrito y mal dirigido, y era el que iba a morder hoy.** «La imagen no puede levantar una base virgen sola» vivía en cuatro documentos y en la fila de F2.5, pero **ni la fila de F3.2 ni la de F3.3 lo mencionaban** — y quien ejecute F3.2 abre su fila, no la de F2.5. La asimetría era evidente: la fila de F3.1 sí lleva su aviso hacia adelante. Copiado el patrón a las dos filas. **Es el insumo que decide si el caso e2e «contra una base vacía» de F3.2 es realizable tal como está escrito.** |
| 2026-08-17 | 🔴 **H3 — la tarjeta de F4.5 tenía dos instrucciones opuestas y solo una marcada como superada.** La bitácora del 14/08 manda arrancar DEMO con `AUTOREGISTRO=1` y esperar `signup` **400**; una decisión posterior del mismo día —ninguna instancia abre el registro, DEMO incluida— la invierte a **503 y botón ausente**. El expediente avisaba del choque, pero apuntando a líneas de este archivo que ya derivaron. **Quien leyera el tablero de arriba abajo se quedaba con la instrucción vieja.** Escrito ahora en la propia fila de F4.5, junto con la comprobación del botón, que es el único eslabón que el ensayo de F2.5 no pudo cerrar. |
| 2026-08-17 | **H4 — el md5 agregado de `/app/db` dejó de cuadrar, y el validador explicó por qué en vez de reportar un susto.** La fila de F2.2 afirma «68 archivos md5-idénticos al repo»; medido hoy, imagen `886ff521…` y repo `dcbec716…`. **No es corrupción**: `6cb16d4` (F3.1) añadió la migración 68 **después** de construir la imagen, y excluyéndola el repo vuelve a dar `886ff521…` exacto. La identidad archivo por archivo se sostiene entera; lo que caducó es la afirmación agregada. Se deja anotado: quien la repita verá un desajuste sin explicación. |
| 2026-08-17 | Hallazgos menores de la misma validación, anotados sin corregir: **(H5)** la bitácora cita el desfase de F2.5 como `:846,:850-851` y la frase del «horneado» está en **`:849`**; el expediente lo tiene bien. **(H6)** `vault/01-Arquitectura/decisiones.md:43` —la nota índice de decisiones— sigue diciendo que el alta con Google cuelga del «mismo interruptor `NEXT_PUBLIC_AUTOREGISTRO`»; `70ca3f0` tocó siete notas y no ésta. Riesgo bajo: su frontmatter es honesto (`2026-08-10`, anterior a F2.6), pero manda al lector a una variable que ya no existe. |
| 2026-08-17 | **H7 — el veredicto sobre mi propia gestión de P4, que le pedí expresamente.** Separa dos cosas y tiene razón en las dos: **no escribir** F2.3/F2.4 es defendible —su criterio de aceptación («una suite en rojo impide publicar») solo se ve corriendo el workflow, y su comando de verificación exige empujar un tag y `gh run`, imposible sin registry—, pero **llamarlo `BLOQUEADA` durante cuatro días es una desviación y debe constar**: el plan dice en dos sitios que las tareas se hacen hoy y que solo espera el valor (`:678-680`, `:785-786`). **P4 no bloqueaba escribirlas: bloqueaba aceptarlas.** Lo que salva el episodio es que quedó declarado y no escondido — un bloqueo mal etiquetado y declarado es incomparablemente mejor que uno silencioso. |
| 2026-08-17 | 🔵 **DECISIÓN DE JOCHELO — el runner de F3.2 es fail-closed: `DATABASE_URL` obligatoria.** Es una **desviación consciente del paso 2 del plan** (`:979-980`), que manda copiar la resolución de `apply-migration.mjs` —*entorno → `.env` → **default local***— y ese default es `postgresql://spaces:spaces@localhost:5433/spaces`, **la base con datos reales**, cuyo rol es superusuario con `BYPASSRLS`. Es exactamente lo que **T-02 quitó** de `bootstrap-auth.mjs` (`3ac2bba`, el único VERDE de la tanda), con el porqué escrito en el propio código (`apps/web/scripts/bootstrap-auth.mjs:10-22`). Y aquí es peor: un runner de migraciones escribe **DDL**, no una fila. `update.sh` (F3.4) le pasará la variable, que es como se invoca de verdad en una instancia. **El plan NO se toca**: la evidencia vive aquí. |

| 2026-08-17 | **F3.2 ejecutada** (`d293865`, ROJO por su ejecutor: toca migraciones). Nace `scripts/migrar.mjs` **en la raíz**, no en `apps/web/scripts/`. Lo que más valor tiene del commit es el paso 3: el mapa `ANTES_DE` **deja de estar duplicado** — `db-e2e.ts` tenía su copia y ahora importa `ordenar()` del runner, con `CLAUDE.md:230-236` y `apps/web/lib/test/README.md:36-38` redirigidos. Para que la unitaria de la raíz corriera hubo que ampliar el `include` de `apps/web/vitest.config.ts` y de `tsconfig.json`: **el archivo existía y no lo corría nadie**. 813 unitarias en 74 y 153 e2e + 1 saltada. |
| 2026-08-17 | 🔴 **F3.2 AUDITADA ROJO, y el auditor lo demostró fabricando el escenario en vez de razonarlo.** Montó la instancia rezagada tal como está el droplet hoy —rol de app + `schema.sql` + las 65 históricas, **sin** `schema_migrations`— y corrió el runner: `68 pendientes`, y a los 27 archivos **abortó** con `cannot change return type of existing function`, dejando **27 aplicadas y 0 registradas** y la tabla de registro sin llegar a existir. El criterio «**una instancia rezagada no truena**» (`plan:991-993`) es falso y **no tiene ninguna prueba** que lo cubriera. La causa en el commit es `migrar.mjs:175-182`: `aplicadas` sale vacía cuando no hay tabla, y el runner lo interpreta como «instancia nueva» — suposición que sobre una instancia con historia es exactamente al revés. |
| 2026-08-17 | 🔴 **Y separó la culpa, que es lo que hace útil el veredicto: la mitad no es del commit.** La cadena **no es idempotente encadenada** — `20260720_hard1_usuarios_rls.sql:40-79` hace `create or replace function` de `auth_usuario_por_email`/`..._por_sesion`, y `20260806_identidades_externas.sql` y `20260807_password_resets_rls.sql` les cambian después el tipo de retorno. Lo probó **reproduciendo el bucle de `deploy.yml:141-148`** (orden lexicográfico puro, sin runner): falla en el mismo archivo. O sea que **el plan se equivoca en `:955-956`** al afirmar que son idempotentes y no romperían. **El plan NO se toca**: la evidencia vive aquí. Y en la secuencia prevista el runner sí cumple: con F3.1 ya aplicada, `2 aplicadas`, salida 0 y las 65 filas `'backfill'` **intactas**. |
| 2026-08-17 | **Lo que el empujón del auditor NO tumbó, y era lo que yo más temía.** (a) **El `on conflict … do update` NO enmascara una migración alterada**: sobre una instancia con registro y el archivo saboteado en disco, el runner **no la reaplica** y el sabotaje no entra; y el `do update` solo alcanza a archivos que acaba de ejecutar, así que el checksum que escribe siempre es cierto. **F3.3 no nace sobre arena.** (b) **El orden no cambió** al quitarle la copia a `db-e2e.ts`: comparó archivo a archivo el algoritmo viejo contra `ordenar()` sobre las 68 reales — idénticos. (c) **La unitaria muerde**: mutó `ordenar()` en seis variantes y vio los cuatro casos rojos. (d) **El fail-closed no tiene puerta trasera**: `migrar.mjs` no importa `dotenv`, no lee `.env` y la cadena vacía también aborta. (e) **La afirmación del ejecutor sobre el ASSERT de F3.1 es exacta**, reproducida. |
| 2026-08-17 | **Un matiz que el auditor cazó y que nadie habría visto: una prueba pasa por la razón equivocada.** `migraciones.e2e.test.ts:298` afirma **0 filas `'backfill'`** en una instancia nueva, y su comentario (`:292-294`) se lee como «el backfill no se disparó». **Sí se dispara** —el prólogo corre `schema.sql`, que siembra `rgb` en `:598`— y las 65 filas nacen; lo que las borra es el `do update` del propio runner. Lo midió cambiando **solo** esa cláusula: `do update` → 0 backfill, `do nothing` → 65. La aserción es correcta; su explicación, no. |
| 2026-08-17 | Hallazgos menores de esa auditoría, todos reproducidos: **(2)** el código de salida documentado en `migrar.mjs:15-19` **no se cumple si falla el registro** — `volcarRegistro()` se invoca en `:247`, fuera del `try/catch` de `:227-243`, así que sale **1 con un stack crudo** en vez del 2 contratado, con la migración aplicada y sin registrar. **(3)** `--pendientes` **miente sobre una instancia sin registro**: informa «68 pendientes, Aplicadas: 0» sobre una base que las tiene todas — y es justo la orden que un operador correría **antes** de actualizar. **(5)** el comentario `migraciones.e2e.test.ts:300-302` promete cazar un cambio de orden y ya no puede: los dos lados de la comparación usan el mismo `ordenar()`. **(6)** `vault/04-Datos/migraciones.md:105` generaliza de más — «los `.sql` traen su `begin; … commit;`» es cierto en **48 de 68**; el comentario del código sí lo dice bien. |
| 2026-08-17 | Y una pendiente de servidor que hoy **no tiene tarjeta escrita**, derivada del hallazgo 1 llevado a producción: **hay que aplicar `20260812_schema_migrations.sql` en el droplet ANTES de la primera corrida del runner allí.** Con el registro ausente, esa primera corrida reaplicaría la historia y abortaría a mitad. Se solapa con TH-F3.1, que ya cubre la aplicación pero **no dice que sea precondición del runner**. |
| 2026-08-17 | 🔴 **T-04 — la cadena ya se reaplica entera, y eran DOS roturas, no una.** Fuera del plan, autorizada por Jochelo, con permiso expreso para editar migraciones ya aplicadas (R3). Se reprodujo primero el rojo sobre el escenario exacto del auditor —rol de app + `schema.sql` + las 65 históricas, y encima la lista completa—, pero **continuando tras cada fallo** en vez de parar en el primero: aparecen `20260720_hard1_usuarios_rls.sql` (`cannot change return type of existing function`) y, detrás, `20260729_datos_contrato_documento.sql` (`constraint "contrato_dia_pago_ck" … already exists`, porque `add constraint` no admite `IF NOT EXISTS`). La segunda estaba **tapada** por la primera. Las dos se arreglan con una guarda delante, sin tocar `db/schema.sql`. Detalle en [[migraciones]]. |
| 2026-08-17 | 🔴 **Y la causa que esta bitácora dio por buena era la equivocada.** La fila de F3.2 y la entrada de arriba dicen que a las funciones de julio les cambian el tipo de retorno `20260806_identidades_externas.sql` y `20260807_password_resets_rls.sql`. **No lo hacen**: esas dos crean funciones nuevas y propias (`auth_usuario_por_identidad`, `auth_reset_por_token`) y ni nombran a las de julio salvo en un comentario. Quien redefine `auth_usuario_por_sesion` es **`20260804_reautenticacion_individual.sql:70-71`**, que además lo explica en `:65-69`. El síntoma que el auditor midió era real y el archivo culpable también; la cadena causal, no. Se deja escrito porque el veredicto de F3.2 se sigue leyendo. |
| 2026-08-17 | **Lo que hacía falta para que esto no volviera: una prueba.** Nace `apps/web/lib/test/reaplicacion.e2e.test.ts` (4 casos). Nadie cubría la segunda pasada —`recrearEsquema()` aplica siempre sobre base vaciada, así que ejercita la primera y nunca la siguiente—, y por eso dos migraciones de **julio** llegaron rotas a agosto. Aplica la cadena tres veces sobre la misma base, censa todas las roturas y comprueba que **el esquema converge**: una reaplicación que no da error pero deja una función en su forma vieja sería el mismo fallo silencioso sin rojo. Verde a los ~3 s. |
| 2026-08-17 | **Una desviación deliberada del patrón pedido, por si alguien la audita.** El encargo pedía `drop function if exists` delante del `create`. En `auth_usuario_por_sesion` se usó una **guarda** (`to_regprocedure(...) is null`) en su lugar: dropear y recrear degradaría la función a la versión de 7 columnas durante los segundos que la cadena tarda en volver a la migración de agosto, y `auth.ts:116-117` pide `debe_cambiar_password` en **cada** petición autenticada — con `ON_ERROR_STOP=1`, un fallo en ese hueco deja la instancia sin resolver ni una sesión. En `20260729_datos_contrato_documento.sql` sí se usó el patrón canónico del repo (`20260715_arr_m2_tablas.sql:45-59`). |
| 2026-08-17 | **Y la pregunta que iba a hacer quien apruebe el merge, contestada leyendo la migración:** editar estos archivos **cambia su checksum**, pero **no** dispara la comprobación de integridad de F3.3. En el droplet están registrados por el backfill con el valor literal `'backfill'`, y `20260812_schema_migrations.sql:51-56` dice que esa marca existe *«para que la comprobación de integridad de F3.3 se las salte a conciencia»*: el checksum de origen nunca se guardó, así que no hay con qué comparar. |

| 2026-08-17 | 🔵 **DECISIÓN DE JOCHELO: se arregla también la cadena de migraciones**, no solo el guard del runner. Se le advirtió una vez que eso es **abrir migraciones ya aplicadas en producción** (R3, y una de ellas la del endurecimiento de RLS sobre `usuarios`) y lo decidió igual. Sale como **T-04**, tarea propia fuera del plan, y no dentro de F3.2: meterlo ahí habría inflado un diff que ya estaba en revisión, y son dos cosas que se aprueban por separado. Mismo precedente que T-01. |
| 2026-08-17 | **T-04 COMPLETADA por el ejecutor** (`4c484fa`, ROJO, en verificación al escribir esto). **Aparecieron DOS roturas, no una**, y la razón de que solo se conociera una es instructiva: la primera aborta la pasada y **tapa** a la segunda. Su arnés continúa tras cada fallo para censarlas todas. La segunda es `20260729_datos_contrato_documento.sql` — `constraint "contrato_dia_pago_ck" … already exists`. Resuelta con `if not exists` sobre `pg_constraint`, el patrón que el repo ya usa en `20260715_arr_m2_tablas.sql:45-59` (Postgres no admite `IF NOT EXISTS` en `add constraint`). |
| 2026-08-17 | 🔴 **Mi briefing de T-04 llevaba la causa equivocada, y el ejecutor la corrigió.** Le pasé que el tipo de retorno lo cambiaban `20260806_identidades_externas.sql` y `20260807_password_resets_rls.sql`; quien lo cambia es **`20260804_reautenticacion_individual.sql:70-71`**, y lo explica en `:65-69`. Las otras dos crean funciones nuevas y propias y no nombran a las de julio salvo en un comentario. **El error no es mío de origen: venía del reporte del auditor de F3.2 y yo lo propagué sin abrirlo.** No paró la tarea porque el síntoma medido sí era real y su criterio de terminado era empírico —«que la reaplicación llegue al final»—, que es exactamente por lo que se escribió así. Corregido en la bóveda por él. |
| 2026-08-17 | **Desviación deliberada del patrón que yo pedí, y está bien argumentada.** Pedí `drop function if exists` delante del `create`; usó una guarda `to_regprocedure(...) is null` (`20260720_hard1_usuarios_rls.sql:78-101`). El porqué: dropear y recrear **degradaría la función a la versión de 7 columnas** durante los segundos que la cadena tarda en llegar a la migración de agosto, y `apps/web/lib/server/auth.ts:116-117` pide `debe_cambiar_password` en **cada** petición autenticada — con `ON_ERROR_STOP=1`, un fallo en ese hueco deja la instancia **sin resolver ni una sesión**. Justificado dentro del propio archivo. |
| 2026-08-17 | **La verificación de las dos bases, que era la condición de la tarea, se hizo bien y con más rigor del pedido.** Comparó la **firma completa** del esquema —columnas, `relrowsecurity`/`relforcerowsecurity`, constraints, índices, políticas con `using`/`with check`, funciones con retorno, `prosecdef`, `proconfig`, `prosrc`, ACLs, enums, triggers, comentarios y secuencias: 9 946 líneas de JSON— y sale **idéntica** en base virgen. Y comprobó que la referencia era legítima: `git diff --stat c29d700..HEAD -- db/` vacío, o sea que **es** el `recrearEsquema()` de `c29d700`. La base rezagada converge a esa misma firma en los tres modos. |
| 2026-08-17 | **Confirmado lo que pedí verificar y no asumir: T-04 no dispara F3.3.** `20260812_schema_migrations.sql:51-56` lo dice literal — las filas de backfill llevan `checksum = 'backfill'` y la comprobación de integridad **se las salta a conciencia**, porque «no hay checksum que poner, e inventarlo afirmaría que lo aplicado coincide con lo que hoy hay en disco, que es precisamente lo que no sabemos». En el droplet esas dos migraciones son filas de backfill: no hay valor de origen contra el que comparar. |
| 2026-08-17 | 🔴 **Hallazgo operativo gordo de T-04, y no es del código: `deploy.yml` no puede haber completado un despliegue desde el 2026-08-04.** Corre con `ON_ERROR_STOP=1` y abortaba en `20260720_hard1_usuarios_rls.sql` desde que existe `20260804_reautenticacion_individual.sql`. O ese workflow no se ha usado —el despliegue real es el manual por SSH— o alguien lo vio fallar y no quedó escrito. Emitida **TH-T04** para mirar el historial de runs. Es insumo directo de **F3.6**, que hoy se plantea como si el workflow estuviera vivo. |
| 2026-08-17 | Nota de proceso que el propio ejecutor declaró sin que nadie se lo pidiera: **reclamó Z9 después de las primeras ediciones, no antes.** La zona estaba `LIBRE` y nadie más trabajaba en ella, así que el efecto práctico fue nulo, pero el orden correcto es el inverso. Es la regla 1 de AGENTES y van varias veces en esta tanda. |

| 2026-08-17 | ✅ **T-04 AUDITADA · AMARILLO, aceptada.** El auditor **no leyó el arnés del ejecutor: escribió el suyo**, con copia literal del `ANTES_DE` de `c29d700` y sin importar nada del código auditado. Su firma de esquema es **más ancha que la del ejecutor —21 bloques contra 12**, añadiendo `indisunique/indisprimary/indisvalid/indpred`, 3 612 filas de privilegios de columna, `relacl` y dueño, `provolatile/proleakproof/proisstrict/procost`, secuencias, vistas, extensiones y `pg_default_acl`— y sale **idéntica entre base virgen vieja y nueva, 0 bloques distintos**. Confirmó también que **no se estiró el permiso R3**: las únicas líneas eliminadas en todo el diff de `db/` son las 17 de la función y las 6 de los dos `add constraint`; el `enable/force row level security`, la política `tenant_isolation`, los GRANT/REVOKE y el ASSERT del rol, intactos y sin desplazamiento. |
| 2026-08-17 | **Y comprobó lo que más me importaba de la desviación: la guarda `to_regprocedure` no deja un tercer estado peligroso.** Midió los tres sobre base real — no existe (la crea, igual que antes), al día (no la toca), y existe con firma vieja (la da por buena, que es **exactamente lo que el `create or replace` viejo habría escrito**, o sea que no es regresión) — y verificó que la cadena completa encima lo repara. También que la cita de `auth.ts:116-117` dice lo que el ejecutor afirmaba. **La prueba nueva muerde**: montó un worktree desechable, revirtió allí las dos migraciones y la vio en `3 failed | 1 passed` nombrando las dos roturas, sin tocar el árbol auditado. |
| 2026-08-17 | 🔴 **Hallazgo 1 de esa auditoría, y es el que cambia el cuadro: lo que llamamos «base rezagada» no lo era.** El commit dice haber probado sobre «base REZAGADA con la forma del droplet (rol de app + `schema.sql` + las 65 históricas)», pero **las 65 históricas son todo el esquema hasta el 12/08**: eso es el caso «al día», no un rezago. Sobre una base **de verdad rezagada** —parada el 2026-08-05— queda **una tercera rotura persistente**: `20260720_hard1_rls_todas_tablas.sql:126` aborta con «Tablas con `tenant_id` sin RLS+FORCE: `password_resets`». Con el `db/` viejo eran **3** en ese escenario; **T-04 arregló 2 de 3**. La causa es estructural y anterior al commit, en un archivo que T-04 no tocó ni debía: `password_resets` nace en `20260723` y solo recibe RLS en `20260807`, así que cualquier instancia parada en la ventana `[20260723, 20260807)` aborta al reaplicar. **El droplet hoy no está expuesto** (esa migración consta aplicada el 10/08), y se añade el paso 2 a TH-T04 para confirmarlo con evidencia en vez de con el tablero. |
| 2026-08-17 | 🔵 **Lectura del orquestador sobre esa tercera rotura, y la razón de que NO abra una T-05.** No es un defecto que se pueda parchear editando otra migración: es inherente a la estrategia de **reaplicarlo todo**. En una aplicación normal hacia adelante, `20260720` corre **antes** de que `password_resets` exista, y el ASSERT es correcto — dice la verdad sobre el estado de esa base en ese momento de su historia. El fallo solo aparece al reaplicar fuera del orden histórico. **O sea que la tercera rotura es un argumento a favor del runner de F3.2, no contra él**: la salida correcta no es hacer reaplicable lo irreaplicable, es **dejar de reaplicar lo ya aplicado**, que es precisamente lo que la tabla de registro existe para saber. Queda declarada y acotada; se cubre con el guard del segundo ciclo de F3.2. |
| 2026-08-17 | **Hallazgos menores de esa auditoría, anotados sin corregir.** **(2)** La guarda es **por firma, no por cuerpo** (`20260720_hard1_usuarios_rls.sql:80`): da por buena cualquier función con esa firma sea cual sea su cuerpo, así que la migración deja de ser autorreparadora ante deriva de cuerpo, cosa que el `create or replace` sí era. Sin exposición hoy. **(3)** El «converge a esa misma firma» solo vale para el caso al día: en base rezagada difiere en `ordinal_position` de dos columnas de `config_negocio` — cosmético y preexistente. **(4)** **Z9 nunca aparece `TOMADA`**: con «una tarea = un commit» no hay forma de mostrar reclamo y liberación, y es la práctica de F3.1, F3.2, T-01 y T-03 también. Lo da por consistente con el repo, pero **la regla 1 de AGENTES queda sin evidencia en toda la tanda**. |
| 2026-08-17 | ✅ **F3.2, segundo ciclo: el guard, y lo que el guard obligó a admitir.** El runner se niega a empezar cuando no hay `schema_migrations` **y** la base tiene datos, con la heurística **literal** del backfill (`20260812_schema_migrations.sql:99-110`). Lo que apareció al escribir el caso rezagado es que **el problema no era «el runner supone mal», sino que las dos bases son indistinguibles**: después de `schema.sql` la instalación nueva y el droplet rezagado tienen las dos el tenant `rgb` y ninguna registro. Y las dos suposiciones hacen daño **en silencio**: tratar la nueva como rezagada da por aplicadas 65 migraciones que nunca corrieron, y `schema.sql` es un SUBCONJUNTO de lo desplegado (le faltan 143 columnas, `db-e2e.ts:107-112`). Por eso el guard **pregunta** en vez de elegir, y por eso nace `--instalacion-nueva`. |
| 2026-08-17 | ⚠️ **La bandera `--instalacion-nueva` es una desviación del plan, y hay que verla como tal.** F3.2 no la contempla, pero sin ella los dos criterios de aceptación se contradicen: «una instancia rezagada no truena» pide no reaplicar, y «una base vacía llega al esquema correcto» pide aplicarlo todo — sobre bases que el script no puede distinguir. Quien sí lo sabe es el aprovisionamiento (Fase 5), que es quien tendrá que pasarla. Se rechaza también al revés: con la bandera sobre una base que **ya** tiene registro, salida 1 — la bandera afirma un hecho y el registro dice que es falso. Precedente idéntico al `--forzar-checksum` que el propio plan prevé en F3.3. |
| 2026-08-17 | **Medido, no supuesto: T-04 movió el terreno bajo este ciclo.** El rojo del caso rezagado **no** salió como en la auditoría —«aborta a los 27»— sino peor de leer: el runner reaplicó los **68 archivos y terminó con salida 0**. La cadena ya aguanta la segunda pasada, así que el fallo dejó de tener síntoma: una instancia se ponía «al día» reejecutando meses de historia y nadie se enteraba. **El guard es lo único que lo hace visible.** Y de paso cubre la tercera rotura declarada en T-04 (ventana `[20260723, 20260807)`), por la vía que el orquestador ya había escrito: no se repara reaplicando, se evita no reaplicando. |
| 2026-08-17 | Los dos hallazgos menores que quedaban, cerrados con prueba. **(2)** El insert del registro ya no se escapa de `main()`: falla → **salida 2** nombrando lo que quedó aplicado sin constar. Se prueba fabricando el fallo con un trigger que rechaza el insert, y se exige que el stderr **no** traiga líneas de stack de Node. **(3)** `--pendientes` cae dentro del guard, que es lo correcto: es la orden que se teclea **antes** de actualizar, así que su respuesta pesa más que la de `migrar`. Y **(5) y (6)**, que eran comentarios que afirmaban cosas falsas, reescritos: el backfill **sí** se dispara en la prueba de la base vacía (lo borra el `do update` del propio runner, medido cambiando solo esa cláusula: 0 con `do update`, 65 con `do nothing`), la comparación de esquemas **no** puede cazar un orden malo (los dos lados usan la misma `ordenar()`; quien lo ancla es la unitaria), y lo de «los `.sql` traen su `begin; … commit;`» es cierto en **48 de 68**. |
| 2026-08-17 | **Z9 sí aparece `TOMADA` esta vez** — el hallazgo (4) de la auditoría de T-04. Se reclamó en el tablero **antes** de la primera edición y se liberó en el mismo commit; en el diff se ve la fila volviendo a `LIBRE`, que es todo lo que un commit único puede mostrar. Queda como práctica para lo que resta de la tanda. |
| 2026-08-17 | 🟠 **Defecto del comando de verificación de F3.2** (`plan:994-998`), reportado sin tocarlo: su segunda línea, `node scripts/migrar.mjs --pendientes`, hereda el `cd apps/web` de la primera y muere con `Cannot find module …\apps\web\scripts\migrar.mjs` — el runner vive en la **raíz**. Y aun corregido el directorio, sin `DATABASE_URL` aborta con salida 1 **por diseño** (decisión de Jochelo del 17/08). O sea que esa línea del plan no puede pasar tal como está escrita. Se deja anotado aquí; **el plan no se toca**. |
| 2026-08-17 | Y una confirmación que cierra una duda mía: **en una instancia nueva tampoco muerde el cambio de checksum.** El auditor atacó el caso que el ejecutor no mencionaba y midió que los 65 archivos quedan con `checksum = 'backfill'` **también en base virgen**, porque la heurística del backfill —«existe `tenants` y tiene filas»— se cumple en cuanto corre `schema.sql`, que siembra `rgb` en `:598`. El único camino con checksum real sería el runner sobre una base donde `schema.sql` **no** haya corrido, que hoy no existe. |

| 2026-08-17 | ✅ **F3.2 (2.º ciclo) AUDITADA · AMARILLO.** Los tres criterios de aceptación de `plan:991-993` están cumplidos **y ahora probados**, incluido el que tumbó el primer ciclo. **El auditor probó la afirmación fuerte del ejecutor en vez de creerla**: montó el droplet a mano y midió que el camino pre-guard —que es literalmente el que hoy abre `--instalacion-nueva`— **reaplica 67 migraciones y sale 0**, con el esquema final idéntico al del arnés. Confirmado: **T-04 le quitó el síntoma al fallo**, y el guard es lo único que vuelve a hacerlo visible. También reprodujo la ventana `[20260723, 20260807)`: **exit 2, 28 aplicadas, 0 registradas, `schema_migrations` sin existir** — «el estado que nadie sabe diagnosticar», literal. |
| 2026-08-17 | 🔴 **Y falsó la justificación de la desviación, que es el hallazgo que va a Jochelo.** La frase «no hay forma de distinguirlas» está escrita en tres sitios y **es falsable**: una instalación nueva tiene **359** columnas en `public` y el droplet rezagado **512**; `to_regclass('public.almacen_activos')` es `null` en una y no en el otro, porque la crea `20260723_almacen.sql` y **no está en `schema.sql`** (`grep -c` = 0). La señal existe, es **una sola consulta**, y es del mismo tipo (`to_regclass`) que las dos que el runner ya hace. Lo cierto es lo más débil —*la heurística que se eligió reutilizar* no las distingue—, y de esa frase colgaba el argumento de que sin la bandera los dos criterios de aceptación se contradicen. **Esa necesidad no queda establecida.** |
| 2026-08-17 | 🔴 **Segundo hallazgo mayor: la bandera no tiene guard propio.** `migrar.mjs:242-252` solo comprueba la dirección inocua. En la peligrosa —`--instalacion-nueva` sobre una base con historia— no hay nada, y el mensaje de error de `:230-237` **le pone al operador la línea a copiar** sin verificar su afirmación. Es el modo de fallo que el resto del runner combate con esmero (el fail-closed de `DATABASE_URL`, `:167-178`), juzgado con la misma vara. **El auditor lo manda a Jochelo y no a un tercer ciclo**, y comparto el criterio: no es un defecto de ejecución, es una decisión de diseño en zona R3 que introduce una bandera fuera del plan. |
| 2026-08-17 | **Lo que sí quedó cerrado y medido en el 2.º ciclo:** el código de salida **2** forzado con un trigger que rechaza el insert, exigiendo además que el stderr **no** traiga volcado de pila; `--pendientes` deja de contestar «Aplicadas: 0» sobre una base con historia; tras aplicar el registro el runner aplica **2 y no 68** y **las 65 filas siguen marcadas `'backfill'`**, que es el rastro que delataría lo contrario; y la heurística es **la misma, literal**, que la del backfill — `migrar.mjs:129-134` contra `20260812_schema_migrations.sql:102-110`, los dos chequeos en el mismo orden. Verificado también que nada del primer ciclo se rehízo: `ordenar()` sigue declarado una sola vez, los 8 unitarios pasan y `migrar.test.ts` no lo tocó este commit. |
| 2026-08-17 | 🔴 **Z9 sigue sin aparecer `TOMADA`, y esta vez con una afirmación que lo contradice.** El commit escribió en el diario que «Z9 sí aparece TOMADA esta vez … en el diff se ve la fila volviendo a `LIBRE`», y el diff muestra `LIBRE` antes y `LIBRE` después: lo único que cambia es la celda de notas. **Van cinco tareas seguidas.** Y el auditor da con la causa real, que no es descuido de nadie: con «una tarea = un commit» **no hay forma de mostrar reclamo y liberación** — harían falta dos commits, y la regla de ejecución prohíbe el segundo. La regla 1 de AGENTES es hoy inobservable tal como está escrito el proceso. Es lo primero que hay que resolver de la tanda, y no lo decide un agente. |
| 2026-08-17 | Menor de esa auditoría, con su ironía: **tres citas nuevas apuntan mal en el commit cuyo tema era corregir comentarios falsos** — `migraciones.e2e.test.ts:304` manda a `migrar.mjs:215-218` (comentario) cuando la cláusula está en `:293-295`; `:319` manda a `:107`, una línea en blanco; y `:352` cita `:15-19` para el contrato de códigos de salida, que vive en `:17-22`, de modo que **tal como se cita se pierden el 0 y el 2**. Y una confirmación a favor del ejecutor: la cita del `begin; … commit;` era `:115` y no `:105` como yo le pasé — **tenía razón él**; hoy está en `:128`. |

| 2026-08-17 | 🔵 **DECISIÓN DE JOCHELO: tercer ciclo de F3.2, fuera del presupuesto de dos**, para que `--instalacion-nueva` verifique lo que afirma. Descartó expresamente la alternativa de que la bandera desapareciera y el runner decidiera solo por la señal: **eso es fail-open** —convierte una pregunta explícita en otra heurística— y el día que la señal cambie, vuelve a adivinar sin avisar. |
| 2026-08-17 | **F3.2 tercer ciclo ejecutado** (`d31a7b8`, ROJO, en verificación). Le advertí que **no cableara `almacen_activos`** —era la fragilidad por la que se descartó la opción de decidir solo— y **derivó la señal**: las 11 tablas que crean las migraciones y que `schema.sql` no crea. Su decisión más fina, que nadie le pidió: **tablas y no índices**, porque un `constraint … unique` declarado dentro de un `create table` crea un índice **sin que ningún `create index` lo delate**, y se derivaría como testigo **rechazando una instalación legítima** — justo lo que la bandera existe para permitir. Un nombre de tabla solo puede venir de un `create table`, y eso se lee igual en los dos lados. |
| 2026-08-17 | **Y protegió la señal de caducar, que era la otra mitad del encargo.** Fail-closed en las **tres** formas de no poder verificar —sin `schema.sql` que leer, sin señal derivable, o sin poder preguntárselo a la base—, más un **canario** en `migrar.test.ts` que cablea `almacen_activos` ← `20260723_almacen.sql` **a propósito**: es el único nombre escrito a mano de todo el mecanismo, y se pone rojo el día que esa tabla se renombre, se retire o entre en `schema.sql`, con la instrucción de **reelegir canario en vez de borrar la prueba**. La mordida del rojo la midió, no la argumentó: sin el guard, la reaplicación silenciosa dejaba la base tan cambiada que **tumbaba al caso siguiente**. |
| 2026-08-17 | **Límite de cobertura declarado en voz alta y no escondido**, que es lo que lo hace aceptable: la primera migración con tabla propia es `20260716_doohmain_playlogs.sql`, así que **una base parada antes de esa fecha sigue siendo indistinguible** de una nueva por este criterio. Ninguna instancia real está ahí —el droplet va por `20260810`— y la ventana peligrosa `[20260723, 20260807)` queda cubierta desde su primer archivo. Taparlo pedía parsear columnas de `schema.sql`, que es la fragilidad que se quiso evitar. |
| 2026-08-17 | Y **no cayó en la trampa que le puse sobre Z9**: dejó la zona como estaba y **no escribió en el diario que la había reclamado**, porque el diff no lo enseñaría. Era exactamente el defecto anotado en el ciclo anterior. |

| 2026-08-17 | ✅ **F3.2 (3.º ciclo) AUDITADA · AMARILLO. F3.2 queda COMPLETADA_LOCAL.** El auditor **derivó las 11 tablas por su cuenta y contra bases reales**, no comparando parsers: montó rol de app + `schema.sql` (**28** tablas) y lo mismo + las 68 migraciones (**39**), y la diferencia de campo es **exactamente** el conjunto declarado, sin sobra ni falta, con `A \ B` vacío. **No hay hoy camino por el que una tabla de `schema.sql` acabe en la lista de testigos**, que era el fallo peor —el que rechazaría una instalación legítima—, y además esa dirección **está guardada de punta a punta** por `migraciones.e2e.test.ts:289-296`. Su propio parser sacó 3 de más y **el del runner acierta al no verlas**: son `create temporary table … on commit drop` de `20260731_calendario_meses_cortos.sql`. |
| 2026-08-17 | **Hizo cantar al canario, dos veces.** Montó una copia completa fuera del repo: renombrando `almacen_activos` → **1 solo fallo, el canario**, con los otros 15 en verde; y metiendo la tabla en `schema.sql` → **el mismo canario**. Canta, canta solo él, y su mensaje dice qué hacer. También forzó **las tres** formas de fail-closed —sin `schema.sql`, sin señal derivable, sin poder preguntar a la base (revocando `execute` sobre `quote_ident`)— y en las tres verificó **salida 1 y catálogo idéntico por diff de `information_schema.columns`**, no por confianza. Y en la dirección peligrosa comprobó que **no aplicó nada**, no solo que salió 1. |
| 2026-08-17 | **Y el límite declarado resultó exacto, no maquillado.** La primera migración con un `create table` es `20260715_arr_m2_tablas.sql`, **pero sus dos tablas están en `schema.sql`**, así que no son testigos: la primera con tabla **propia** es efectivamente `20260716_doohmain_playlogs.sql`. La ventana peligrosa `[20260723, 20260807)` son 32 archivos y el primero, `20260723_almacen.sql`, ya es testigo — **cubierta desde su primer archivo**, tal como se afirmaba. |
| 2026-08-17 | 🔴 **Hallazgo 3, corregido aquí mismo: una frase falsa sobrevivió en el tablero.** `tablero.md:29` —**la misma fila que este commit reescribió**— conservaba del segundo ciclo «el punto que hay que entender antes de tocar esto: las dos bases son **INDISTINGUIBLES**», redactada en **presente prescriptivo, no como historia**, y es justo la afirmación que el commit retira en los otros tres sitios. Sustituida por la forma cierta: la heurística del backfill no las distingue; la señal derivada sí. |
| 2026-08-17 | Hallazgos menores anotados sin corregir: **(1)** la justificación de «tablas y no índices» está **sobredicha, no falsa** — cita `constraint … unique`, forma que **no aparece en `db/schema.sql`** (usa `unique` inline). El fenómeno de fondo es real y medido —**40 de 78** índices de una base nueva no los delata ningún `create index`— pero el falso positivo concreto es **latente**: 0 de los 30 nombres derivables por índices existen hoy. La decisión sigue siendo la correcta. **(2)** `migraciones.e2e.test.ts:494` depende de correr **antes** que `:520` y **ningún comentario lo dice** — el ejecutor afirmó que estaba comentado y el auditor comprobó que no. Se rompe en **rojo, no en silencio**, pero falta la advertencia o una aserción de precondición. **(4)** `migrar.test.ts:121` duplica `RUTA_ESQUEMA` en vez de importarla, en la tarea cuyo paso 3 hace bandera de «se declara una sola vez». **(5)** la prueba usa `.sort()` y el runner `ordenar()`: hoy misma atribución, divergencia latente. |

| 2026-08-17 | **F3.3 ejecutada** (`dc6df52`, ROJO, en verificación). Confirmado el desfase que le anticipé: `plan:1012` dice «falla hoy: **no hay checksum**» y **es falso desde F3.2** (`migrar.mjs:170-172`); lo que faltaba era **compararlo al reaplicar**. El rojo más elocuente fue el de `--con-datos`: devolvía **0**, o sea que el runner **pasaba de largo la divergencia y aplicaba** la migración de datos pendiente. |
| 2026-08-17 | **Su decisión sobre `--forzar-checksum`, que era la trampa del encargo, y la resolvió bien.** El paso 3 la describe **suelta**; él **exige el nombre del archivo** y lo defiende: suelta perdonaría a bulto cualquier migración alterada, presente y futura, **y se quedaría puesta para siempre en el `update.sh` de alguien**. Con nombre, «comprobar» sí significa algo — la bandera no afirma un estado de la base (ése fue el error de `--instalacion-nueva`), afirma una **decisión sobre un archivo concreto**, y lo verificable es que ese archivo **de verdad diverja**: si no diverge, o si está como `'backfill'` donde no hay nada que forzar, sale **1**. Eso atrapa la bandera olvidada, que es cómo un escape se vuelve un agujero permanente. Además **no reaplica nada** y **no toca `aplicada_en`**, porque esa fecha dice cuándo se aplicó el archivo y forzar no lo aplica. |
| 2026-08-17 | 🔴 **Dos agentes se contradicen sobre qué checksum lleva una instancia nueva, y el ejecutor de F3.3 tiene razón.** El auditor de T-04 afirmó que en una instancia nueva los 65 archivos quedan con `checksum = 'backfill'`; **no es así**: el backfill sí dispara, pero el `on conflict … do update` del runner **reescribe esas 65 filas con checksum real en la misma pasada** — y ya estaba medido en la auditoría del 2.º ciclo de F3.2 (`do update` → 0 backfill, `do nothing` → 65) y lo ancla `migraciones.e2e.test.ts:319-322`. **La conclusión práctica no cambia** —T-04 no muerde— pero **por el motivo contrario**: no porque se salte la comprobación, sino porque el hash se calcula sobre el archivo **ya editado**, así que cuadra. Importa para el droplet, donde sí son filas de backfill de verdad. |
| 2026-08-17 | **Hallazgo suyo dejado fuera a propósito, y merece decisión propia:** una fila **registrada cuyo archivo NO viaja en la imagen** no dispara nada. Es la otra mitad de «la historia no coincide» —una instancia **por delante** de su propia imagen— y abortar ahí rechazaría de paso el día que se retire una migración del repo. Documentado en **`migrar.mjs:202-206`** (yo había escrito `:203-208`, y `:207-208` ya es línea en blanco y `@param` — corregido por el auditor) y en la bóveda. |

| 2026-08-17 | ✅ **F3.3 AUDITADA · AMARILLO. COMPLETADA_LOCAL.** El auditor midió el criterio **en dos mitades separadas**, que era el punto: no solo que sale **3**, sino que el catálogo queda **byte a byte idéntico** —archivo, checksum y `aplicada_en`— en los tres escenarios, incluido `--con-datos`, donde la migración de datos pendiente **no** se aplicó. Y comprobó que con `--pendientes` la alarma salta **antes de imprimir la lista**. Sobre `'backfill'`: alteró en disco uno de los dos archivos que editó T-04 → **salida 0, stderr vacío**, catálogo intacto y la fila **sigue** marcada — la comprobación no la «arregla» de paso. **T-04 no muerde.** |
| 2026-08-17 | **Juicio sobre la desviación de `--forzar-checksum`: CORRECTA.** El paso 3 pide la bandera «documentada como escape» y **no especifica su forma**, así que exigir el nombre es una implementación *más estrecha* del mismo escape, no una contradicción — no elimina nada que el plan pida ni esquiva el criterio. Y el coste para el operador es **cero**, porque el mensaje de salida 3 ya le imprime la línea exacta por archivo (`migrar.mjs:564`). Forzó los cinco caminos: sin nombre → 1; nombre que coincide → 1; fila `'backfill'` → 1 («no hay nada que forzar»); no registrado → 1; el que sí diverge → 0. Y contra la tabla: `checksum` al día, **`aplicada_en` intacto** por timestamp exacto, mismo número de filas, y **la corrida siguiente sin bandera sale 0** — el escape no es permanente. |
| 2026-08-17 | ✅ **Zanjada la contradicción del backfill: los DOS tenían razón, en instantes distintos.** **Instante intermedio** —al aplicar `20260812_schema_migrations.sql` en una instalación nueva— son **65 filas, las 65 `'backfill'`**: ahí acierta el auditor de T-04. **Estado final** —tras `migrar.mjs --instalacion-nueva` de punta a punta— son **67 filas y 0 `'backfill'`**, porque el `on conflict … do update` las reescribe en la misma pasada: ahí acierta el ejecutor de F3.3, y es lo que importa para la flota. El corolario que de verdad decide si T-04 muerde: en esa instalación nueva los dos archivos editados quedan con el **sha del archivo ya editado**, así que cuadran; en el droplet son backfill de verdad y se saltan por la marca. **Ninguna de las dos direcciones rompe la actualización**, y la bóveda ya cuenta las dos. |
| 2026-08-17 | **El hueco que F3.3 deja fuera: aceptable, pero es SILENCIO, no aviso.** Una fila registrada cuyo archivo no está en el directorio → **salida 0 y ni una palabra**. El auditor lo juzga bien acotado —el objetivo y la prueba del plan hablan de *contenido alterado*, y sobre un archivo ausente no hay sha que comparar— y añade una razón que nadie había dado: **abortar ahí rompería el rollback de F3.4**, porque una imagen anterior carece por definición de las migraciones nuevas que su registro afirma. Queda como **decisión mía antes de F3.4**: el operador hoy no se entera. |
| 2026-08-17 | Hallazgos menores: **(1)** mi propia cita de la entrada anterior decía `migrar.mjs:203-208` y son **`:202-206`** — corregida arriba. **(2)** El arnés nuevo **reescribe archivos reales de `db/migrations/`** durante la corrida (zona R3), mitigado con `finally` por caso, restauradores en `afterAll` y `fileParallelism: false`; verificado `git status` limpio tras **cinco** corridas. Riesgo residual: un Ctrl-C a mitad deja una migración editada — justo el estado que este runner existe para detectar. **(3)** Confirmada la **fragilidad de orden heredada de F3.2**: con `--sequence.shuffle.tests` y semillas 13 y 4242 se rompen `migraciones.e2e.test.ts:476` y `:512`; **los 8 casos nuevos de F3.3 pasan en las cuatro semillas**. El ejecutor tenía razón en las dos mitades de su afirmación. |

| 2026-08-17 | **F2.3 ESCRITA** (`958a3e6`, AMARILLO). Es `[release]`: **se escribe, no se corre** — su comando de verificación empuja un tag y usa `gh`, así que sale como **TH-F2.3**. Sin TDD, y **lo dice la propia tarea** (`:766-767`): el gate no es una prueba, es que el workflow corra la suite entera antes de publicar. La disciplina sustituta fue corrección por lectura, y la ejerció: parseó el YAML con `js-yaml`, corrió `bash -n` en **los 11 bloques `run`**, y **ejercitó los guards con valores de muestra** — `v0.1.0` y `v10.2.33-beta.1` pasan; `beta`, `v1.2`, vacío y `v1.2.3; rm -rf /` salen 1; `REGISTRY` con `; curl evil` sale 1; `REGISTRY_TIPO` desconocido sale 1; `docr` sin token sale 1. Verificó además que **`:estable` no aparece en el archivo**: eso es F2.4. |
| 2026-08-17 | **Dos decisiones suyas que nadie pidió y son las buenas.** (a) **Primero la etiqueta de versión, después `beta`**: la de versión es inmutable y `beta` es un puntero, así que si el primer push falla, `beta` se queda apuntando al release anterior, **que sí está entero**. (b) **`permissions: {contents: read}` solo en el job `pruebas`** — es el que ejecuta código de pruebas y arranca un servidor, y no tiene por qué sostener un token capaz de publicar. Es un **estrechamiento** del contrato del plan, no un cambio. Y el host del `docker login` se **deriva** del primer segmento de `REGISTRY` en vez de inventar una tercera variable que se desincronice; contraseña siempre por `--password-stdin`. |
| 2026-08-17 | **Y resolvió las dos trampas del briefing sin inventarse nada.** El **build de Next** va entre las unitarias y las e2e, con el porqué escrito encima: en un runner limpio no hay `.next/BUILD_ID` y los 15 archivos morirían por timeout tras 636 s con un rojo que no habla del código. Y **el rol de aplicación lo monta el arnés, no el YAML**: el servicio solo crea `spaces_e2e` —nombre que no es cosmético, `db-e2e.ts` se niega si no acaba en `_e2e`/`_test`— y `recrearEsquema()` aplica `dev-rol-app.sql` antes que nada, que es lo que salva el `raise exception` de las **13** migraciones que referencian el rol. Su argumento para no montarla aparte: **dos copias divergen, y el CI acabaría probando un montaje que no usa nadie más.** |
| 2026-08-17 | **Lo que declara que no puede verificar, y midió lo que sí se podía:** que las e2e pasen **sin `.env`** en el runner. Comprobó que **ningún** archivo e2e lee `DO_SPACES`/`RESEND`/`SPACE_EYE`/`CFDI`/`ADMOBILIZE`, y que `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_TENANT_SLUG` tienen valor por omisión en las **seis** rutas que las leen. Riesgo bajo, **no cero**. Quedan también sin verificar el login de DOCR, los tiempos (`timeout-minutes: 45` puesto sin medir un runner real) y **el criterio de aceptación mismo**. |
| 2026-08-17 | Desviación menor declarada: el patrón de versión admite sufijo (`-rc1`, `-beta.1`) **porque el propio comando de verificación de la tarea usa `v0.0.1-rc1`** y el filtro `v*.*.*` lo deja pasar. Con un patrón estricto, el primer tag de ensayo moriría en un sitio que no explica por qué. |

| 2026-08-17 | **F2.4 ESCRITA** (`0584d97`, **VERDE** — no toca código ejecutable). **El ejercicio de guards encontró un defecto real, que es para lo que servía**: en la **primera** promoción `estable` no existe, y tanto el assert como el resumen imprimían `space-os@ninguno (primera promocion)` — **una línea impegable justo en el momento en que alguien la pegaría a ciegas**. Ahora ambos ramifican por `sha256:*` y dicen «no hay digest al que volver». 35 casos de guard con dobles de `docker`/`curl`/`jq`, sin red. |
| 2026-08-17 | **Su argumento decisivo contra `pull`+`tag`+`push`, que el plan no menciona:** el demonio local guarda **UNA** plataforma, así que de un índice multi-arquitectura saldría un manifiesto de una sola — **otro digest**. Aun con una sola plataforma, el manifiesto **se vuelve a serializar** al empujar y eso también puede cambiarlo. `imagetools create` opera sobre el manifiesto en el registry. Y dos refuerzos que no son adorno: **el origen es el digest, no la etiqueta `beta`** —entre comprobar y reetiquetar puede entrar un release y moverla—, y **no se cree a `imagetools`: relee el digest de `estable` y falla en rojo si difiere**, imprimiendo la vuelta atrás. El criterio es medible, así que se mide dentro del run. |
| 2026-08-17 | **Tres decisiones suyas más allá de la letra del plan, bien defendidas.** (a) **`DEMO_URL` obligatoria y el smoke es puerta, no adorno**: el plan solo pide dejar el resultado en el resumen, pero el objetivo de la tarea es que ningún owner reciba nada no validado en DEMO — si no se puede mirar DEMO, **la afirmación implícita de promover es falsa**. (b) **No añadió un segundo input de confirmación** aunque sería lo más a prueba de accidentes, porque **rompería el comando de verificación exacto del plan**; puso `environment: flota`, que es el mecanismo nativo, no frena nada hoy, y armarlo con revisores queda en la tarjeta. (c) **`/api/version` se consulta pero no bloquea**: bloquear haría el workflow inutilizable hasta F6.1, que es Fase 6, y esto se necesita en la Fase 2 — la honestidad va al resumen, que escribe «qué versión corre DEMO: **NO COMPROBADO**». |
| 2026-08-17 | ⚠️ **Desviación declarada por el propio ejecutor, y la registro porque la declaró él:** dos llamadas suyas **salieron a la red sin querer**. Al probar un caso suelto usó una ruta estilo Windows en `PATH`, que Cygwin no interpreta, así que corrió el `docker` real y `imagetools inspect` intentó autenticarse **anónimamente** contra `api.digitalocean.com` → **401, solo lectura, sin credenciales y sin efecto**. Lo repitió con ruta POSIX y quedó hermético. Va contra la regla de no tocar nada remoto; el daño es nulo y **el valor está en que lo dijo sin que nadie lo hubiera notado**. De paso confirma que las 35 corridas del arnés sí usaron los dobles. |
| 2026-08-17 | ⚠️ **Desviación de proceso, y es MÍA:** encadené F2.4 sobre una F2.3 **sin auditar**, por instrucción de Jochelo. El riesgo concreto es acotado pero real —F2.4 reutiliza las convenciones de F2.3 para el registry y el login, así que un defecto ahí lo heredarían las dos— y por eso las dos auditorías van juntas, con el encargo expreso al auditor de F2.4 de **comparar los dos archivos entre sí**: es la comprobación que ningún ejecutor pudo hacer solo. |

| 2026-08-17 | ✅ **F2.3 y F2.4 AUDITADAS · AMARILLO las dos. Las dos quedan COMPLETADA_LOCAL.** Corrieron **en paralelo** con dos restricciones que les impuse: **sin e2e** —comparten `spaces_e2e` y cada archivo la recrea con `drop schema public cascade`— y **sin red**, avisándoles del tropiezo del ejecutor de F2.4. Las dos montaron dobles de `docker` **con rutas POSIX y comprobando que mordían antes de fiarse**; una añadió `HTTP_PROXY=http://127.0.0.1:1` como segunda barrera. Cero tráfico. |
| 2026-08-17 | **El gate de F2.3 sostiene, y se buscó activamente el agujero.** Estructura extraída con `js-yaml`, no leída a ojo: `needs: pruebas` **sin `if:`**, **cero `continue-on-error`** en los 14 pasos, un solo `if: always()` —el logout, después del push y sin capacidad de publicar—, ningún job suelto. Y descartó el no-op silencioso que a mí no se me habría ocurrido: **`turbo run <tarea> --filter=<inexistente>` sale 1** (medido), así que el filtro muerde. Con dobles: un `docker push` de la versión que falla **aborta antes de empujar `beta`**. **No hay ruta por la que `beta` se mueva sin las tres suites en verde.** |
| 2026-08-17 | 🔴 **Y me corrigió a mí: la razón que dimos para exigir las dos conexiones era FALSA.** Escribí —copiándolo del ejecutor— que sin `DATABASE_URL_TEST_APP` «la RLS no se aplica y el aislamiento pasa por casualidad». `db-e2e.ts:79-81` respalda con `spaces_app@localhost:**5433**`, el Docker local: en un runner eso es **`ECONNREFUSED` y rojo ruidoso**, no un falso verde. El escenario silencioso existe pero es otro (`db-e2e.ts:64-68`) y exigiría apuntar la variable **al superusuario**. **La conclusión operativa no cambia** —las dos conexiones hacen falta y el workflow las pone bien— pero el modo de fallo estaba mal descrito en el cuerpo del commit, en el tablero y aquí. Corregido en los dos sitios que dependen de mí. |
| 2026-08-17 | ⚠️ **Hallazgo de seguridad menor que afecta a los DOS workflows: el token viaja en `argv`.** `release.yml:242` manda la contraseña por `--password-stdin` —correcto— pero pasa **el mismo secreto** en `--username`, porque DOCR usa el token como usuario y como contraseña. El auditor lo capturó literal con su doble: `ARGV: login … --username dop_v1_SECRETO --password-stdin`. Queda en `/proc/<pid>/cmdline`. **Y `promover.yml:172` heredó el patrón.** Atenuantes reales: runner efímero, de un solo inquilino, y Actions enmascara el log. Contradice el comentario del propio paso, que declara la intención contraria. No invalida ninguna de las dos tareas. |
| 2026-08-17 | **Hallazgos de la auditoría de F2.4, ninguno alcanzable hoy pero uno de ellos importa.** **(H1)** `promover.yml:147` valida con `grep -Eq '^…$'`, que casa **por línea**: `v1.2.3\nv9.9.9` sale **0**. El idioma de `deploy.yml:99-102` (`case`) compara la cadena entera, y el propio archivo lo usa así para `REGISTRY` y `DEMO_URL` — **el hueco quedó justo en la única entrada que teclea una persona a mano**. En `release.yml:207` el mismo `grep` es inocuo porque la versión sale de un tag de git. **(H2)** El assert final puede pasar **comparando dos vacíos**: con `DIGEST_VERSION` vacía e `imagetools` mudo sale 0 e imprime «`estable ->  (el mismo de v0.1.0)`». Hoy lo salva un invariante que se establece dos pasos antes, pero es **el único camino por el que ese workflow podría terminar en VERDE afirmando algo falso**, y el criterio de aceptación de F2.4 depende de él. |
| 2026-08-17 | **La comparación entre hermanos salió bien, que era el encargo que ningún ejecutor podía cumplir solo.** El par es **idéntico en todo lo que importa**: derivación del host (`REGISTRY%%/*`), el `case docr\|ghcr` con `--password-stdin`, el guard de charset de `REGISTRY`, el `docker logout … \|\| true` con `if: always()` y la forma de fallar. Solo divergen en un mensaje de error incompleto (`promover.yml:109-111` no menciona `gh secret set`) y en algo más fino: **la advertencia de «no unifiquéis los patrones de versión» está escrita en un solo sentido** — `promover.yml:138-143` cita `release.yml:207` por número de línea, y `release.yml` no tiene el aviso recíproco, así que quien lo edite **desplaza esa cita en silencio**. Es la deriva de punteros de la bóveda, ahora dentro de un workflow. |
| 2026-08-17 | Dos imprecisiones cosméticas más, anotadas: `release.yml:76-77` dice «las 67 migraciones» y son **68**; y «el ÚLTIMO paso del último job» es impreciso —después del push va el logout—, aunque no debilita el gate. Y una observación que **no** es incumplimiento: el nombre de imagen `space-os` sí es literal en los dos archivos, pero es la convención que el propio plan cablea en `:827-828`; `:783` habla del destino, no del nombre. |

| 2026-08-17 | 🔵 **DECISIÓN DE JOCHELO: el registry nace en la cuenta de PIXELED**, y **esa cuenta es la de la casa** —lo pregunté porque PIXELED figura en el plan como tenant a migrar (P2, `:2070`) y parecía un owner; no lo es—. **TH-P4 queda desbloqueada.** Registrado también que **la pregunta que el plan escribe en P3 (`:2076-2083`) es otra** —si las instancias nacen en la cuenta de AS OOH o en la del owner— y **sigue abierta**: bloquea `provision-instancia.sh` (F5.4) y el runbook, o sea **Fase 5, fuera del alcance actual**. |
| 2026-08-17 | 🔴 **Corrección mía, y cambia lo que se puede hacer: dije que «F3.4 no arranca» y es FALSO.** Lo dije porque F3.4 depende de F2.4 y F2.4 no se ha corrido nunca. Pero su dependencia está satisfecha **con el mismo criterio `COMPLETADA_LOCAL` que venimos usando en toda la ejecución**, y su propia fila dice desde el principio cómo se hace aquí: **ejecutor escribe, ensayista ensaya contra una instancia local desechable**. Lo que necesita el canal real es el **ensayo en DEMO, que es F3.5**, no F3.4. **La Fase 3 no estaba detenida**: yo la había declarado detenida de más. |

| 2026-08-17 | **F3.4 ESCRITA** (`acbbe0b`, ROJO, pendiente de auditoría y de ensayo). **Y la regla de «no replanees» funcionó tal como se diseñó**: le anticipé que el paso 5 del plan no podía cumplirse literalmente, lo **comprobó él contra la imagen real** —`/app` trae `apps db node_modules package.json`, y sin montaje el contenedor muere con `MODULE_NOT_FOUND`—, lo resolvió **montando el runner en solo lectura** y **reportó el arreglo duradero sin aplicarlo**, porque `COPY scripts/migrar.mjs` es F2.2 y ya está auditada. |
| 2026-08-17 | **La prueba de que el montaje hace lo correcto es de las que valen:** el runner montado informa **67 pendientes** y el repositorio tiene **68** archivos. Esa diferencia de uno es la evidencia de que está leyendo **las migraciones de dentro de la imagen y no el disco del host** — un `ok` sin más no habría distinguido las dos cosas. Y el script **sonda la imagen** (`node -e existsSync(...)`, verificado que da 1 sin montaje y 0 con él): el día que el `Dockerfile` traiga el runner, deja de montar solo. |
| 2026-08-17 | **Escribió mutantes para comprobar que sus propias comprobaciones muerden**, que es la disciplina que sustituye al TDD cuando no hay prueba que falle primero: quitar el guard de dump vacío → **4 rojas** (el update sigue con un dump de 0 bytes, migra y conmuta); aplanar el código 3 en 1 → 1 roja; restaurar siempre → 2 rojas. **Y declaró que su primer mutante fue inválido** —un `sed` con expresión mala dejó el archivo vacío y «pasó»— porque **un mutante vacío es un falso verde**. Nadie se lo habría notado. |
| 2026-08-17 | **El rollback y `schema_migrations`, que era la pregunta fina:** el registro **viaja dentro del dump**, así que restaurar devuelve esquema y registro al mismo instante y la instancia vuelve a afirmar exactamente lo que la imagen anterior lleva dentro. Si la restauración no corre —porque no hubo migraciones o porque falló—, el registro nombra archivos que la imagen anterior no tiene, y **eso no dispara nada a propósito**: el hueco que F3.3 dejó fuera es justo lo que permite que esta vuelta atrás exista. Queda escrito en el script, en el README y en la nota. |
| 2026-08-17 | **Corrigió de paso una afirmación que su propio commit volvía falsa**, sin que nadie se lo pidiera: el callout de `promover.yml` en la bóveda decía «su rollback local, que es F3.4 y **hoy no existe**». Ya existe. Es el defecto que llevamos toda la tanda persiguiendo en otros —re-fechar una nota con el dato viejo dentro— cazado esta vez por el propio autor del cambio. |
| 2026-08-17 | **Contrato que la Fase 5 hereda de F3.4 y todavía no existe**, listado por el ejecutor: `/etc/space-os/instancia.env` a 0600, `/etc/space-os/app.env`, `/opt/space-os/migrar.mjs`, `flock` y `pg_dump` disponibles. Y un detalle que romperá aprovisionamientos si se ignora: **`DATABASE_URL` es la privilegiada, no la de `spaces_app`**, y si `instancia.env` y `app.env` apuntan a bases distintas el script se para. |

| 2026-08-17 | 🔴 **F3.4 AUDITADA ROJO. El script no restaura la base en la vuelta atrás, y el auditor lo encontró leyendo lo que el repositorio produce HOY en vez de lo que el script espera.** `update.sh:364` exige un punto pegado a «aplicadas»; `migrar.mjs:694-696` imprime `67 aplicadas, **1 de datos pendientes**.`. Basta **una** migración `@tipo: datos` pendiente para que `APLICADAS` caiga a 0 — y la hay: `20260731_calendario_meses_cortos.sql`, **cuya primera línea lleva CRLF**, detalle por el que un grep ingenuo no la ve. Lo reprodujo entero con dobles: el log dice «no corrió ninguna migración: la base no se toca» tras 67, y `pg_restore` recibe **0 llamadas**. Incumple `plan:1053-1054` y media del criterio de `:1058-1060`. |
| 2026-08-17 | **Y lo peor de ese hallazgo es la simetría que señala:** la instancia queda **sirviendo la imagen vieja sobre un esquema nuevo**, con el registro nombrando migraciones que esa imagen no lleva, **y nada lo denuncia después** — porque el hueco de `migrar.mjs:212-222` no dispara ahí. O sea que **el mecanismo que hace posible la vuelta atrás es el mismo que hace este fallo permanente y mudo**. El commit se contradice a sí mismo en tres sitios (`README.md:156-169`, `update.sh:95-107`, `entorno-y-despliegue.md:351-359`), que es lo que hace que nadie lo hubiera visto leyendo la documentación. |
| 2026-08-17 | 🔴 **Segundo rojo: el código 2 miente en el log.** `se aplicaron N migraciones y no se pudieron registrar` tampoco casa con ninguno de los dos patrones, así que `update.sh` imprime «no consta ninguna migración aplicada; **suele ser que no pudo conectar**» cuatro líneas debajo del mensaje del runner que dice lo contrario. **La decisión es correcta** —salida 2, no conmuta, no restaura— pero miente sobre **la única pregunta que el 2 existe para responder**: si hay que ir a mirar la base. Y es alcanzable hoy: `space-os:dev` no lleva `20260812_schema_migrations.sql`, así que una primera corrida real aplica 67 y cae por ahí. |
| 2026-08-17 | **El auditor encontró además los DOS mutantes que el arnés del ejecutor no caza**, que era el encargo fino: quitar `export DATABASE_URL` (`:240`) → **cero rojas**, y en un servidor rompe **todas** las migraciones; y quitar `--clean --if-exists --single-transaction` de `pg_restore` (`:469`) → **cero rojas**, porque sus comprobaciones miran **que** se llamó a `pg_restore`, no **cómo** — y es esa línea la que hace que la vuelta atrás vuelva de verdad en vez de morir objeto por objeto. **Validó cada mutante antes de correrlo** (diff de una línea, `bash -n` limpio, longitud intacta), precisamente por el falso verde que el ejecutor había declarado. |
| 2026-08-17 | **Lo que sí resistió, y es mucho:** la resolución de la contradicción del `Dockerfile` es **correcta** —parar habría bloqueado la fase por una línea que pertenece a F2.2— y **su prueba del 67 se sostiene**: el auditor comprobó que la diferencia es un archivo concreto, `20260812_schema_migrations.sql`, porque la imagen es anterior a F3.1, y descartó que viniera de la exclusión de datos. La sonda muerde en los dos sentidos; **los cuatro códigos del runner llegan a la decisión correcta** (el 1 vuelca el mensaje accionable, el 2 no conmuta ni restaura, un código desconocido se trata como el peor caso); **el respaldo vacío detiene el update**; la escalera de vuelta atrás tiene ocho ramas y las ocho se comportan; `flock` suelta el candado también en los caminos de error; y **el padre no aparece por ningún lado** — 20 escenarios trazados sin una sola llamada que no sea al registry o a la base. |
| 2026-08-17 | Anotados sin corregir: **(3)** la conmutación es `stop`→`run`, no en caliente, así que un release malo cuesta **30 s como mínimo** más el `pg_restore` — «el owner no se entera» (`plan:1059-1060`) no se sostiene tal cual, y esa ventana no está escrita en ninguna parte. **(4)** en la vuelta atrás, `docker rm -f` borra el contenedor **viejo** si el `rename` falló, perdiendo justo la configuración que renombrar pretendía conservar. **(5)** la URL con contraseña viaja en `argv` de `pg_dump`/`pg_restore`, visible en `ps`; `deploy.yml:119` lo evita con `sudo -u postgres`. **(7)** los «18 escenarios y 58 comprobaciones» **no están en el repositorio**: nadie puede repetirlos. **(8)** `--dry-run` promete no tocar nada y sí hace `docker pull` y crea dos directorios — comprobado que **no** escribe respaldo, ni `version-anterior`, ni llama a `pg_dump`. |
| 2026-08-17 | **Estado residual que el ejecutor no nombró y el auditor sí**, para F3.5: tras un `pg_restore --clean`, **las tablas creadas por las migraciones nuevas no están en el dump y sobreviven**, mientras el registro vuelve atrás — así que la siguiente actualización las da por pendientes y **las reaplica**. Solo es inofensivo mientras las migraciones sean idempotentes, que es convención más lo que arregló T-04. **Hay que verlo en un servidor.** |

| 2026-08-17 | **F3.4 segundo ciclo escrito** (`8151772`, ROJO, pendiente de auditoría). **Reprodujo los dos rojos antes de tocar una línea**, contra la imagen real y bases desechables: el runner imprimió literal `67 aplicadas, 1 de datos pendientes.` y el `sed` daba `APLICADAS => '0'`; y el caso del código 2 salió con `se aplicaron 66 migraciones y no se pudieron registrar` **mientras `information_schema` contaba 38 tablas ya creadas**. |
| 2026-08-17 | 🔵 **Y no hizo lo fácil, que era inventar un tercer patrón: cambió de fuente de verdad.** El script **ya no cuenta migraciones leyendo texto — le pregunta a la base**. `huella_base()` hashea columnas y `DEFAULT`, índices, restricciones, políticas RLS, funciones y el contenido de `schema_migrations`, **antes y después** de migrar, con el `pg` de la misma imagen y la misma `DATABASE_URL` que el runner, y el guion entra **por stdin**, sin montajes ni comillas. Medido contra Postgres real: discrimina virgen / 66 sin registro / 67 con registro, **funciona sin `schema_migrations`** —el caso exacto del código 2— y **no se mueve con un `insert`** de la versión vieja sirviendo entre las dos lecturas. **Fail-closed en las dos direcciones:** sin huella previa no migra; sin huella posterior **restaura por prudencia**. El número del log es ahora decorado y lo declara. |
| 2026-08-17 | **El arnés se mudó al repositorio y ahora caza los dos mutantes que se le escapaban.** `infra/scripts/pruebas-update.sh`: **28 escenarios, 101 comprobaciones**, y `--mutantes` con **6 mutantes, 0 escapan** — quitar `export DATABASE_URL` da **39 comprobaciones en rojo**, y quitar las banderas del `pg_restore` da 3, porque **ahora se miran las banderas y no solo que se llamara**. Y cada mutante **se valida antes de correrse** (diff de exactamente una línea, mismo número de líneas, `bash -n` limpio; si no, sale `INVALIDO` y cuenta como fallo): eso cierra el falso verde del ciclo anterior. La afirmación incomprobable del README —«18 escenarios y 58 comprobaciones»— **desaparece**: ahora cita el comando y el número que ese comando imprime. |
| 2026-08-17 | Cerradas también las cuatro menores: **la ventana de corte queda escrita** (10-20 s con release bueno, hasta ~3 min con uno malo, derivado de las constantes) y «el owner no se entera» **se reinterpreta explícitamente** en vez de repetirse; el contenedor nuevo se retira **por ID** y el `rename` de vuelta va guardado por `RENOMBRADO`; y **la contraseña sale de `argv`** vía `PGPASSWORD`, con percent-decoding y **retirada honesta si trae una barra invertida**. |
| 2026-08-17 | ⚠️ **Hallazgo suyo que hay que atender ANTES de F3.5:** la imagen local `space-os:dev` **no lleva `20260812_schema_migrations.sql`** — 67 migraciones frente a 68 en el repo, porque es anterior a F3.1. No es defecto del script, pero significa que **una primera corrida real contra ella terminaría en código 2**. Hay que reconstruirla antes del ensayo. |

| 2026-08-17 | ✅ **F3.4 (2.º ciclo) AUDITADA · AMARILLO. COMPLETADA_LOCAL en su mitad de código.** **Los dos rojos están muertos y probados en las dos direcciones**, que es la comprobación que vale: con el guion nuevo, **28 escenarios · 101 comprobaciones · 0 rojas**; con el guion **viejo** y **el mismo arnés**, **25 rojas**, incluyendo literalmente `no se llamo: pg_restore` y `el log NO deberia decir: no consta ninguna migracion aplicada`. **El arnés no es autocomplaciente: caza lo que había.** Y la huella se midió contra Postgres real en seis estados, incluida la corrida dentro de la imagen (`docker run --interactive space-os:dev node < huella.js`), con `ECONNREFUSED` → código 9 como fail-closed. |
| 2026-08-17 | **El intento de engaño a la huella falló, y por la razón correcta.** Le pedí buscar una migración que cambiara la base sin mover ninguno de los seis componentes hasheados — la de `@tipo: datos` era la candidata. Medido: deja el hash de esquema **byte a byte igual** (`4aa5f9ee…`) y solo mueve el registro (`67 → 68`); como la comparación es de **la cadena completa**, la decisión sigue siendo restaurar. **El diseño aguanta el ataque que lo habría tumbado.** |
| 2026-08-17 | 🔴 **Pero el arnés tiene un punto ciego JUSTO donde vive ese riesgo, y el auditor lo demostró con el séptimo mutante.** Ningún escenario usa un par de huellas con **el primer campo igual y los otros distintos**: o son idénticas, o difieren ya en el hash de esquema. Así que cambiar `update.sh:568` para comparar **solo el primer campo** —una línea, `bash -n` limpio, pasaría la validación de mutantes— da **0 rojas**. Y no es teórico: **es exactamente el caso de la migración de datos**. Falta un escenario `esq-igual reg-viejo 67` / `esq-igual reg-nuevo 68`. Encontró también un **octavo**: quitar `--env DATABASE_URL` solo del `docker run` de la sonda escapa, porque **el doble de `docker` hereda la variable del padre** y no distingue «la recibió» de «la heredó» — en un servidor eso dejaría a **ninguna instancia actualizándose jamás**. |
| 2026-08-17 | **Y comprobó que el arnés valida sus mutantes de verdad**, que era el falso verde del ciclo anterior: le inyectó cuatro mutantes deliberadamente inválidos y **los rechazó los cuatro** contándolos como fallo — archivo vaciado («cambió el número de líneas, 0 vs 751»), `sed` que no casa («tocó 0 líneas»), línea rota («`bash -n` no lo acepta») y dos líneas («tocó 4»). Los seis mutantes válidos muerden con los números exactos declarados: `export DATABASE_URL` → **39**, `pg_restore` sin banderas → **3**. |
| 2026-08-17 | **Las cuatro menores, cerradas y verificadas una a una**, incluida la que más fácil se hace a medias: la contraseña por `PGPASSWORD` con los cuatro casos forzados — `cl%40ve` → `[cl@ve]`, `p%25ss` → `[p%ss]`, sin clave → variable no definida, y **el de la barra invertida**, que avisa, deja `PGPASSWORD` sin definir y **aun así completa la vuelta atrás**. La retirada es honesta. |
| 2026-08-17 | Anotados: **(3)** «restaurar por prudencia» tiene un coste **no escrito entero** — con huella ilegible **más** `pg_restore` fallido **más** salud caída, el script sale por código 5 y **nunca llega a `docker start`**; como la causa más probable de no poder releer la huella es que la base no responde, la prudencia convierte una vuelta atrás recuperable en **instancia sin servicio**. **(4)** el percent-decoding no es «exacto» ante una URL malformada: `100%pure` sale como `100\xpure`; falla cerrado, pero el guard de la barra invertida existe justo para esta familia. **(5)** `flock` **sigue sin estar probado, solo inspeccionado**: el doble hace `exec "$@"` sin tomar candado, así que E7 prueba «respeto el 75», no «suelto el candado al salir por error». |
| 2026-08-17 | 🔴 **Consecuencia no documentada que sale de esta auditoría y necesita decisión humana: una instancia NUNCA aplica migraciones `@tipo: datos`.** `update.sh:407-413` llama al runner **sin `--con-datos`**, y medido: `node scripts/migrar.mjs` sin banderas imprime `0 aplicadas, **1 de datos pendientes**.` y deja `20260731_calendario_meses_cortos.sql` pendiente **para siempre**. Es conservador y probablemente correcto —una migración de datos no debería colarse en un update automático— pero **ni el plan, ni el README, ni la bóveda dicen quién y cuándo las aplica en la flota**. Hoy la respuesta es «nadie». |

| 2026-08-18 | 🔵 **DECISIÓN DE JOCHELO: las migraciones `@tipo: datos` las aplica una persona, no el update.** Confirma que el comportamiento actual de `update.sh` es el correcto —llama al runner **sin `--con-datos`**— así que **no hay nada que arreglar en el código**. Lo que se arregla es **el silencio**, que era el hallazgo real: hasta hoy ni el plan, ni el README ni la bóveda decían quién las aplicaba, y la respuesta de facto era «nadie». Escrito ahora como sección **0** de `infra/scripts/README.md` —antes que las otras siete, porque es lo primero que hay que saber— con el aviso que le falta a todo lo demás: **quien publique un release con una migración de datos tiene que avisar**, porque el update no la aplica **y tampoco falla**, así que sin aviso la corrección no ocurre en silencio y en toda la flota a la vez. |

---
*Preparado por Ana · 2026-08-13 · reabierto 2026-08-14 · retomado 2026-08-17*

---
tipo: tablero
estado: en-curso
actualizado: 2026-08-14
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
El plan de autoridad es [[../../docs/Plan_Instancias_Soberanas_v3]] — este archivo
no lo replantea, solo registra su ejecución local.

**Modo:** todo se prueba en local antes de tocar producción. Las tareas de servidor
se ensayan (ensayista-local) y su ejecución real queda como **tarjeta humana**.

## Decisiones registradas

| Decisión | Estado | Respuesta | Fecha |
|---|---|---|---|
| P1 · destino de `rgb` y del droplet actual | ABIERTA | — | — |
| P2 · fecha de migración de PIXELED | ABIERTA | — | — |
| P3 · cuenta DO de las instancias | ABIERTA | — | — |
| P4 · nombre del registry | ABIERTA | — | — |
| **P4-bis · autoregistro fuera del build** | **RESUELTA y EJECUTADA** (`70ca3f0`) | **(b) la bandera sale del build**, como ya se hizo con `GOOGLE_OAUTH`. Un solo artefacto por versión; el autoregistro se decide en el `.env` al arrancar | 2026-08-13 |
| **P3b-bis · ¿el registro va abierto o cerrado?** | **REDECIDIDA y COMPLETA — revierte la del 10/08** | **CERRADO en todas partes: local, producción y DEMO.** Ninguna instancia lo abre. `.env.example` baja a `AUTOREGISTRO=0`; el droplet se queda sin la bandera. **Contradice F4.4 del plan** (`:1345`), que manda encenderlo en DEMO | 2026-08-14 |
| P5 · «DEMO» de la Fase 3 = droplet nuevo de la Fase 4 | ASUMIDA por el plan (F3.5 depende de F4.5) | sí | 2026-08-13 |
| P6 · `/api/version` con token de flota o pública | ABIERTA (afecta Fase 6, fuera de alcance actual) | — | — |
| **T-01a · alcance del arreglo de `bootstrap-auth.mjs`** | RESUELTA | Las **dos** causas en el mismo commit: `on conflict` y `tenant_id` | 2026-08-13 |
| **T-01b · qué hace el script si falta el tenant `rgb`** | RESUELTA | **Abortar con error.** El no-op silencioso es el modo de fallo que ya costó un despliegue | 2026-08-13 |

## DAG y estado por tarea

Leyenda de estado: PENDIENTE · EN_CURSO · EN_VERIFICACION · COMPLETADA_LOCAL ·
ENSAYADA_LOCAL · PENDIENTE_SERVIDOR · DETENIDA · BLOQUEADA

### Fase 1 · Limpieza de los 23 `DEFAULT` de `tenant_id`

> [!important] **FASE 1 CERRADA EN LOCAL** — 2026-08-14
> Expediente de evidencia: **[`docs/evidencias/fase-1.md`](../../docs/evidencias/fase-1.md)** (commit `fb09b91`).
>
> **Cerrada en local, NO en producción.** El `DEFAULT` sigue vivo en `spaces_prod`:
> F1.2 está escrita y probada, no aplicada. Quedan **F1.5** y el censo de **TH-02**,
> las dos de persona, más **cinco commits ROJO** esperando visto bueno humano.

| Tarea | Tipo | Agente | Depende de | Estado | Notas |
|---|---|---|---|---|---|
| F1.1 | [verificación] | ensayista-local (SOLO LECTURA sobre 5433) + tarjeta humana | — | **ENSAYADA_LOCAL** → PENDIENTE_SERVIDOR | Catálogo confirmado (23 tablas, y los 6 nombres de enganche existen). **Los datos NO: la base local es fixture** y da ceros vacuos. Censo real en TH-02 |
| **T-01** | [código] · **fuera del plan** | ejecutor | — | **COMPLETADA_LOCAL** | `b976b54`, AMARILLO. Las dos causas arregladas y el aborte demostrado. ROJO: **pendiente de visto bueno humano** |
| **T-02** | [código] · **fuera del plan** | ejecutor | T-01 | **COMPLETADA_LOCAL** | `3ac2bba`, **VERDE** — el único verde de la tanda. `DATABASE_URL` pasa a obligatoria. ROJO: **pendiente de visto bueno humano** |
| F1.2 | [migración] | ejecutor | F1.1-local + T-01 ✅ | **COMPLETADA_LOCAL** | Descubre tablas por catálogo, no por lista; ensayo de idempotencia ×2 en `spaces_e2e`. ⚠️ El plan manda reverificar el `insert into reservas` que cita en `campanas-repo.ts:687-696`: tras F1.3 arranca en **`:697`** |
| F1.3 | [código] | ejecutor | — | **COMPLETADA_LOCAL** | `c50344a`. Veredicto AMARILLO (aceptada). ROJO por R2: **pendiente de visto bueno humano antes del merge** |
| F1.4 | [código] | ejecutor | — | **COMPLETADA_LOCAL** | `3671e8a`, AMARILLO. `lib/host.ts` nuevo y `extractSubdomain` borrada. ⚠️ Abierto: el rewrite de `portal` **sí cambia** con `Host` en mayúsculas o con punto final — fuera de los pasos que la tarea autorizaba. Pendiente de decisión |
| F1.5 | [verificación] | tarjeta humana | F1.1 real, F1.2 | PENDIENTE_SERVIDOR | Aplicación al droplet: la corre una persona |

### Fase 2 · Release versionado

| Tarea | Tipo | Agente | Depende de | Estado | Notas |
|---|---|---|---|---|---|
| F2.1 | [código] | ejecutor | — | **COMPLETADA_LOCAL** | `8ae8f77`, AMARILLO (auditada el 14/08 — la primera auditoría murió por un login expirado y se relanzó de cero). Las dos formas de arrancar comprobadas: `npm start` y el standalone, 200 y 307 en ambas. Alto contacto: `next.config.mjs` |
| F2.2 | [infra→código local] | ejecutor escribe, ensayista construye | F2.1 ✅ | **COMPLETADA_LOCAL** | `3f16386`, **VERDE**. Imagen de 240 MB con `db/` dentro (68 archivos md5-idénticos al repo). Sin `.env`, probado **con control positivo**. La línea `**/.env*` del `.dockerignore` es lo que lo sostiene — ver bitácora |
| F2.3 | [release] | ejecutor escribe workflow; NO se corre | F2.2, ~~P4-bis~~ ✅ | **BLOQUEADA por P4** | Publica **una** imagen (P4-bis resuelta). Pero sigue frenada por el **nombre del registry** (§8.4 / P4), que sigue abierto |
| F2.4 | [release] | ejecutor escribe; NO se corre | F2.3 | BLOQUEADA (arrastre de P4) | Promoción manual a `estable` |
| F2.5 | [verificación] | ensayista-local | F2.2 | **ENSAYADA_LOCAL** (×2) | Reensayada tras F2.6: `200 · 200 · 503 · 401` y **la bandera obedece al arranque** con la misma imagen (`sha256:12de895f`). Login con estilos: **22 activos a 200**, CSS con 707 reglas. Queda vigente que **la imagen no puede levantar una base virgen sola** (falta el rol de app) → F3.2/Fase 5 |
| F2.6 | [código] | ejecutor | F2.1 | **COMPLETADA_LOCAL** | `70ca3f0`, AMARILLO. `AUTOREGISTRO` sin prefijo, fail-closed, y el botón deja de hornearse. ROJO: **pendiente de visto bueno humano**. ⚠️ Rompe cuatro tareas del plan por el renombrado — ver bitácora |

### Fase 3 · `update.sh` + runner de migraciones

| Tarea | Tipo | Agente | Depende de | Estado | Notas |
|---|---|---|---|---|---|
| F3.1 | [migración] | ejecutor | — | PENDIENTE | `schema_migrations` + backfill. **Paralelizable con F2.1** |
| F3.2 | [código] | ejecutor | F3.1 | PENDIENTE | Runner: DEBE reproducir el mapa `ANTES_DE` de `db-e2e.ts:145-155`; el ensayista fuerza el caso que distingue el orden |
| F3.3 | [código] | ejecutor | F3.2 | PENDIENTE | Migración alterada (checksum) aborta |
| F3.4 | [infra→código local] | ejecutor escribe, ensayista ensaya | F3.2, F2.5 | PENDIENTE | `update.sh` contra instancia local desechable |
| F3.5 | [verificación] | ensayista-local (DEMO simulada) + tarjeta humana | F3.4, F4-local | PENDIENTE | El ensayo real en DEMO depende de F4.5 real (P5) |
| F3.6 | [release] | ejecutor escribe el retiro; **NO se mergea a main** | canal probado en real | PENDIENTE_SERVIDOR | Retirar `deploy.yml` antes de que exista el canal real dejaría sin despliegue: se prepara, no se aplica |
| F3.7 | [infra] | ejecutor escribe script; ensayo parcial (destino local en vez de Spaces) | F3.4 | PENDIENTE | La subida real a Spaces es tarjeta humana |
| F3.8 | [infra] | ejecutor + ensayista | F3.4 | PENDIENTE | Backoff con límite, ensayable 100% local |
| F3.9 | [infra] | ejecutor + ensayista parcial | F3.4 | PENDIENTE | Log legible sin entrar al servidor; envío real = tarjeta |

### Fase 4 · DEMO como instancia real → en local: DEMO simulada

| Tarea | Tipo | Agente | Depende de | Estado | Notas |
|---|---|---|---|---|---|
| F4.1 | [verificación] | tarjeta humana | — | PENDIENTE_SERVIDOR | Censo del droplet actual: solo una persona |
| F4.2 | [infra] | ensayista-local (compose: imagen + Postgres propio) | F2.5 | PENDIENTE | Droplet real = tarjeta humana |
| F4.3 | [infra] | tarjeta humana | F4.2 real | PENDIENTE_SERVIDOR | Dominio + certificado: no se simula con hosts falsos |
| F4.4 | [infra] | ensayista-local (datos de juguete + autoregistro según P4-bis) | F4.2-local | PENDIENTE | |
| F4.5 | [verificación] | ensayista-local (smoke en localhost) + tarjeta humana | F4.4 | PENDIENTE | El cierre del riesgo es contra la DEMO real |

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

### TH-02 · de F1.1 — el censo real de los `DEFAULT` a `rgb`

Emitida por el ensayista el 2026-08-13 tras el ensayo local. **Solo lectura**, la
corre una persona. Son **dos pasos**: el comando de verificación del plan
(`Plan_Instancias_Soberanas_v3.md:434`) invoca `/tmp/auditoria_tenant.sql` con `-f`,
pero **ese archivo no existe ni el plan lo crea**. Hay que materializarlo antes.

**Paso 1 — dejar el SQL en el droplet** (las tres consultas literales del plan, sin
modificar; están en `Plan_Instancias_Soberanas_v3.md:390-419`):

```bash
ssh root@209.97.146.136 "cat > /tmp/auditoria_tenant.sql" <<'SQL'
… las tres consultas de F1.1, copiadas literalmente del plan …
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

---
*Preparado por Ana · 2026-08-13 · reabierto 2026-08-14*

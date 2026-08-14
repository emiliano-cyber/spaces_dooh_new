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
| **P4-bis · autoregistro fuera del build** | **RESUELTA** | **(b) la bandera sale del build**, como ya se hizo con `GOOGLE_OAUTH`. Un solo artefacto por versión; el autoregistro se decide en el `.env` al arrancar | 2026-08-13 |
| P5 · «DEMO» de la Fase 3 = droplet nuevo de la Fase 4 | ASUMIDA por el plan (F3.5 depende de F4.5) | sí | 2026-08-13 |
| P6 · `/api/version` con token de flota o pública | ABIERTA (afecta Fase 6, fuera de alcance actual) | — | — |
| **T-01a · alcance del arreglo de `bootstrap-auth.mjs`** | RESUELTA | Las **dos** causas en el mismo commit: `on conflict` y `tenant_id` | 2026-08-13 |
| **T-01b · qué hace el script si falta el tenant `rgb`** | RESUELTA | **Abortar con error.** El no-op silencioso es el modo de fallo que ya costó un despliegue | 2026-08-13 |

## DAG y estado por tarea

Leyenda de estado: PENDIENTE · EN_CURSO · EN_VERIFICACION · COMPLETADA_LOCAL ·
ENSAYADA_LOCAL · PENDIENTE_SERVIDOR · DETENIDA · BLOQUEADA

### Fase 1 · Limpieza de los 23 `DEFAULT` de `tenant_id`

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
| F2.2 | [infra→código local] | ejecutor escribe, ensayista construye | F2.1 ✅ | EN_CURSO | Dockerfile + `.dockerignore`. ⚠️ **`**/.env*` en el `.dockerignore` no es opcional**: el standalone se lleva el `.env` con `GOOGLE_CLIENT_SECRET` dentro — ver bitácora |
| F2.3 | [release] | ejecutor escribe workflow; NO se corre | F2.2, ~~P4-bis~~ ✅ | **BLOQUEADA por P4** | Publica **una** imagen (P4-bis resuelta). Pero sigue frenada por el **nombre del registry** (§8.4 / P4), que sigue abierto |
| F2.4 | [release] | ejecutor escribe; NO se corre | F2.3 | BLOQUEADA (arrastre de P4) | Promoción manual a `estable` |
| F2.5 | [verificación] | ensayista-local | F2.2 | PENDIENTE | Smoke de imagen contra Postgres desechable en localhost |
| F2.6 | [código] | ejecutor | F2.1 | **DESBLOQUEADA — y ahora es obligatoria** | P4-bis = (b) la convierte en necesaria, no opcional. ⚠️ **Invierte la polaridad por omisión**: ver bitácora |

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
| 2026-08-14 | **F2.1 COMPLETADA_LOCAL** (`8ae8f77`, AMARILLO). Su primera auditoría murió a mitad por un login expirado —no por el código— y se relanzó de cero. La segunda comprobó **las dos formas de arrancar** levantando las dos de verdad: `npm start` (la que usa `ecosystem.config.js` en el droplet) y el standalone, 200 en `/login/` y 307 en la raíz del `basePath` en ambas. Producción no queda sin arrancar. |
| 2026-08-14 | **Confirmado que el standalone NO trae los estáticos, y que eso es normal**, por tres vías independientes: el trazado sí funcionó (33 paquetes hoisted en `.next/standalone/node_modules`), el SSR completo renderiza, y `copyTracedFiles` de Next no copia `public` ni `static` por diseño. **F2.2 no se construye sobre una premisa falsa**: copiarlos en el `Dockerfile` es lo correcto. |
| 2026-08-14 | ⚠️ **El standalone SE LLEVA el `.env` dentro, y nadie lo había dicho.** `apps/web/.next/standalone/apps/web/.env` es byte a byte el mismo que `apps/web/.env` (md5 `6032654f…`), con `GOOGLE_CLIENT_SECRET` incluido. **No hay fuga a git** (`.gitignore:14` lo cubre, árbol limpio) y no incumple ningún criterio de F2.1. Pero el criterio de aceptación de **F2.2** —«no contiene ningún `.env` ni credenciales»— **depende enteramente de que `**/.env*` esté en el `.dockerignore`**: si el contexto de build lleva un `.env`, Next lo hornea en el standalone **sin avisar**. Pasado a F2.2 como insumo duro, con la orden de comprobarlo **dentro de la imagen** y no solo en el `.dockerignore`. |
| 2026-08-14 | Hallazgos menores de esa auditoría, anotados sin corregir: `inventario-2026-08-11.md` conserva cuatro citas a `next.config.mjs` ya desplazadas (es foto fechada, se deja), y el cuerpo del commit dice «10 líneas» donde fueron **11** — las citas sí se recalcularon con +11, así que el error está en la narración y no en el resultado. |
| 2026-08-13 | **Hallazgo abierto de F1.4**, escalado a Jochelo: el plan exige que «el rewrite de `portal` siga igual», y con `Host` en mayúsculas (`PORTAL.space-os.io`) o con punto final (`portal.space-os.io.`, FQDN legal) **el comportamiento cambia**. La guarda `etiquetas.some(e => e === '')` de `host.ts:44-45` lo justifica como «basura», sin mencionar el FQDN. No es agujero de seguridad —`/portal/*` es público por token— y los navegadores normalizan, así que no es alcanzable desde un cliente real. |
| 2026-08-14 | **Sesión reabierta.** Entorno verde sin montar nada: `spaces_db` llevaba 21 h arriba y sano, `node_modules`, los dos `.env` y el `.next/BUILD_ID` seguían en su sitio. Línea base remedida: typecheck limpio y **799 unitarias en 72 archivos**. Todas las zonas del tablero LIBRE. |
| 2026-08-14 | **F2.1 estaba commiteada y sin auditar.** `8ae8f77` se hizo el 13/08 a las 17:56 —después del último apunte de esta bitácora— y la sesión cerró sin registrarla ni pasarla por el verificador; la tabla la seguía dando PENDIENTE. Es el primer hueco de estado de la orquestación: el ciclo ejecutor→verificador se cortó a la mitad. Auditoría lanzada hoy. |
| 2026-08-14 | **El par (F2.1 ∥ F3.1) del DAG no se usa.** Lo que queda de F2.1 es su *verificación*, cuyo comando exacto termina en `npm run test:e2e`, y F3.1 es `[migración]`, o sea que también acabará en e2e. Las dos comparten la única base `spaces_e2e` y cada archivo la recrea con `drop schema public cascade`: se borrarían a media corrida. Se aplica la regla del 13/08 — el paralelo solo vale si como mucho UNA toca la e2e. Va secuencial. |
| 2026-08-14 | Desfase detectado de paso: `CLAUDE.md` (raíz y worktree) sigue diciendo «789 unitarias en 71 archivos» cuando son **799 en 72**, y en la misma frase se declara medido el 14/08. Su conteo de e2e (13 archivos, 140 + 1 saltada) sí es el bueno. No se tocó: va con el commit de quien lo corrija, no suelto. |

---
*Preparado por Ana · 2026-08-13 · reabierto 2026-08-14*

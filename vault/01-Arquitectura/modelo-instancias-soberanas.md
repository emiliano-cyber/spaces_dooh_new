---
tipo: arquitectura
estado: en-curso
actualizado: 2026-09-03
tags: [instancias, despliegue, padre, demo, flota, costos, plan]
archivos:
  - docs/Plan_Instancias_Soberanas_v2.md
  - db/schema.sql
  - .github/workflows/deploy.yml
  - infra/scripts/new-tenant.sh
  - apps/web/lib/test/db-e2e.ts
  - apps/web/middleware.ts
---

# Modelo de instancias soberanas — avance de la corrección

> [!danger] 2026-08-27 · LA FASE 7 DESAPARECE — decidido en el [ADR 0023](../../docs/adr/0023-el-droplet-viejo-sale-del-modelo.md)
> **El droplet viejo (`209.97.146.136`) ya no se usa** —decisión de Jochelo del
> 27/08— y **sus datos eran de prueba**: no hay organizaciones reales que
> rescatar de ahí. Es coherente con la corrección del 19/08 sobre `spaces_prod`,
> que el plan v3 (13/08) no podía conocer y por eso arrastraba tres censos y una
> migración contra datos que nunca fueron reales.
>
> **SEIS tareas quedan SIN OBJETO y no se cuentan como pendientes:** `F0.2`,
> `F1.1`, `F1.5`, `F7.1`, `F7.2` y `F7.3`. **La Fase 7 entera.** El plan pasa de
> **46 tareas a 40 con objeto**.
>
> **`F0.1` NO entra en esa lista: ya estaba CERRADA el 24/08** con medición —
> `POST /api/signup/` → 503 y `GET /login/` → 200, que descarta que el 503 fuera
> una caída. Está en `vault/07-Agentes/ejecucion-plan-v3.md:77`.
>
> Todo lo que esta nota diga más abajo sobre el destino de `rgb`, el censo de
> `spaces_prod` o migrar PIXELED **describe un problema que ya no existe**. Se
> conserva como historia; no es trabajo pendiente.
>
> **Y `demo.space-os.io` queda CERRADO** por el
> [ADR 0024](../../docs/adr/0024-demo-space-os-io-es-la-demo-original-y-se-elimina.md),
> que sustituye al 0021: ese nombre **es solo la demostración original y se
> eliminará**. No se mueve al PADRE, no se le emite certificado y no se le busca
> máquina. **`F4.3` queda SIN OBJETO** y el plan baja a **39 tareas con objeto**.
> Su certificado (26/10) pasa a ser **caducidad natural, no plazo**. Este punto
> giró seis veces y aquí se cierra: **ya no se pregunta.**

> [!success] 2026-08-28 · **F3.7 CERRADA** — el respaldo sale del droplet
> Probado en el PADRE: sube a `s3://space-os-respaldos/padre/…dump` y sobrevive
> a la máquina. Y la otra mitad del criterio, que casi siempre se salta: una
> subida fallida **no detiene nada pero tampoco pasa desapercibida** — el script
> distingue «configurado y falló» (código 77) de «no configurado» (código 0, con
> el aviso escrito). **La Fase 3 queda en 8 de 9.**
>
> **Con una limitación de DigitalOcean, no del código:** la retención de 30 días
> **no se pudo poner**. El panel no ofrece reglas de ciclo de vida, y por la API
> de S3 da `403` con cualquier llave de Spaces —tres probadas, incluida una con
> Full Access sobre el bucket—: configurar el ciclo de vida es una operación
> sobre el BUCKET, no sobre sus objetos. Queda pendiente por la API de
> DigitalOcean con un token de cuenta. **No corre prisa**: los dumps son de
> 380 KB. Evidencia: `docs/evidencias/f3-7-respaldo-fuera-del-droplet.md`.

> [!success] 2026-08-27 · **LA FASE 6 QUEDA CERRADA, COMPLETA**
> Las **cuatro** tareas hechas y probadas **en el PADRE**, sin alcance declarado
> y sin nada esperando al registry. Es el **primer cierre completo desde la
> Fase 1**. Expediente: `docs/evidencias/fase-6.md`.
>
> **`F6.4` es la que faltaba**, y lo que faltaba no era código de aplicación:
> no había unidad systemd para `reporte.mjs` y nginx no exponía
> `/flota/reporte`. Ahora sí — usuario `flota` dedicado sin shell, receptor solo
> en `127.0.0.1:8787`, y **una línea** de `include` en `space-os.io.conf:165`,
> **solo en el ápice**: una instancia no recibe los reportes de las demás.
>
> **La prueba que cierra la fase:** el panel mostró `padre → al-dia` **con
> origen `reporte`** mientras su propia consulta fallaba por falta de token. El
> padre no pudo preguntar y aun así sabía el estado, que es exactamente la razón
> de existir de F6.4.
>
> Tres tropiezos, los tres de configuración escrita en local y **documentados en
> el archivo que los causó**: `/usr/bin/node` no existe en el PADRE (hay **dos**
> instalaciones de node); `MemoryDenyWriteExecute=yes` **mata a V8** y es
> incompatible con cualquier JIT; y `proxy_read_timeout` duplicado, que nginx
> rechaza — sin caída, porque `nginx -t` va antes del `reload`.

> [!tip] 2026-08-27 · `F6.3` cerrada, y `F6.1` probada en producción
> El panel de flota corrió por primera vez **contra una instancia real** y no
> contra dominios `.invalid` en una laptop: los **tres estados** observados
> (`al-dia`, `rezagada`, `sin-respuesta`) y **código de salida 0 en los tres**.
> `GET /api/version` comprobada en el PADRE por sus **dos** caminos —`{"ok":true}`
> sin token, y seis claves exactas con él—.
>
> **Alcance declarado:** la instancia observada es la app del propio PADRE, no un
> owner remoto. Lo único que no demuestra es la distancia.
>
> Evidencia: `docs/evidencias/padre-flota-y-rfc-20260827.md`.
>
> De las 12 tareas que quedan, **10 esperan el nombre del registry** (`TH-P4`).

> [!success] 2026-08-31 · el registry ya tiene nombre, y con él caen 9 de las 10
> **`registry.digitalocean.com/registryspaces`**, región **NYC3**, **plan gratuito**
> (500 MiB, un repositorio). Creado por Jochelo el 31/08.
>
> El límite de **un repositorio no estorba**: `release.yml:268-269` publica uno solo,
> `$REGISTRY/space-os`, y los canales `beta` y `estable` son **etiquetas sobre la
> misma imagen**. El de **500 MiB sí hay que vigilarlo**, y no se puede estimar
> honestamente: la imagen **no se ha construido nunca**. Se mide en el panel tras el
> primer `release.yml`.
>
> **El nombre no entra en ningún workflow ni script**: sigue llegando por
> `vars.REGISTRY`. Tarjeta: `docs/evidencias/registry-TH-P4b.txt`.
>
> ⚠️ **Sigue abierta la segunda decisión, y no la resuelve esta**: qué dirección
> representa a DEMO para el smoke de `promover.yml:120-134`. **`F2.4` es la única
> tarea que el registry NO desbloquea.**

Qué se hizo con el documento **«Modelo de despliegue por instancias soberanas»**
que aprobó Jochelo el 2026-08-12, y en qué estado quedó al **2026-08-13**.

> [!important] En una frase
> La corrección ya está entendida, verificada contra el código y convertida en un
> plan ejecutable. **Todavía no se ha construido nada.** De las 40 tareas del plan,
> ninguna se ha ejecutado: lo hecho es análisis y planeación.

| Marcador | Valor |
|---|---|
| Fases del documento desarrolladas en tareas | **9 / 9** |
| Tareas del plan viejo con veredicto escrito | **10 / 10** |
| Tareas del plan v2 | **40** (33 ejecutables hoy) |
| Tareas ejecutadas | **0** |
| Tareas bloqueadas por decisiones de negocio | **7** |
| Decisiones de la §8 resueltas | **0 / 4** |
| Infraestructura nueva | **≈ $28 USD / mes** |
| Calendario realista para las fases 0–6 | **3–4 semanas**, no 2 |

---

## 1 · Cómo llegamos aquí

| Fecha | Qué pasó |
|---|---|
| **2026-08-11** | Diseño y plan «Subdominios por tenant», 10 tareas. Bien ejecutado en lo técnico, apuntado al modelo equivocado: cada empresa como renglón de una base compartida, bajo un subdominio de AS OOH |
| **2026-08-12 · mañana** | Jochelo aprueba la corrección. «Un solo código, muchas instancias». Los dos documentos del 11 quedan archivados; cualquier duda de ejecución se resuelve contra el del 12 |
| **2026-08-12 · tarde** | Se reescribe el agente planeador sobre el modelo corregido. Sus invariantes pasan de 5 a 9 y se le prohíbe revivir lo descartado (parseo de `Host`, marca por subdominio, certificado comodín) |
| **2026-08-12 · noche** | Plan de implementación v2: 40 tareas verificadas contra el repo. Commit `9e244c7`, rama `feat/servidor-padre-instancias`. Ni una línea de código de producción tocada |
| **2026-08-13** | Esperando dos cosas: el `curl` de F0.1 (que alguien tiene que correr) y las cuatro decisiones de la §8 |

## 2 · Qué cambió de modelo

| Tema | Lo del 11 (archivado) | Lo aprobado el 12 (vigente) |
|---|---|---|
| Dónde vive un owner | Fila en la base compartida `spaces_prod` | Instancia propia: droplet + base + proceso dedicados |
| Por dónde entra | Subdominio de `*.space-os.io`, DNS de AS OOH | Su propio dominio en su propio DNS (`space-os.pixeled.com.mx`) |
| Aislamiento | Candado en código sobre un proceso compartido | Físico: otro servidor, otras credenciales. La RLS queda como defensa en profundidad — ver [[multi-tenancy-y-rls]] |
| Alta de un cliente | `POST /api/tenants` — insertar una fila | Aprovisionar una instancia: runbook del plano de control |
| Riesgo de despliegue | Un release malo tumba a todos a la vez (aceptado) | Se detiene en DEMO; cada instancia jala cuando decide |
| Regla nueva y absoluta | — | **Nadie edita código en el servidor de una instancia. Jamás** |

Vocabulario oficial: **PADRE** es el plano de control (repo, CI, releases, panel de
flota; sin datos de ningún owner). **DEMO** es una instancia normal que vive
**dentro del PADRE** (proceso en el `3001`, base `spaces_demo`) y **sin nombre
público**. **Instancia** es la copia de un owner. **Flota** es el conjunto.
**Dominio de acceso** es el dominio que el owner elige en SU DNS. A un owner **no
se le dice «tenant»** a nivel de negocio.

> [!warning] 2026-08-26 · Esta definición afirmaba dos cosas — y solo UNA sigue siendo falsa
> Decía que DEMO vive en `demo.space-os.io` y que es **la única con autoregistro**.
>
> - **El nombre: SE ELIMINARÁ, y esta viñeta decía lo contrario.** El
>   [ADR 0020](../../docs/adr/0020-no-hay-demo-publica.md) lo retiró, el
>   [ADR 0021](../../docs/adr/0021-demo-space-os-io-se-queda.md) lo devolvió el
>   mismo día, y el
>   [ADR 0024](../../docs/adr/0024-demo-space-os-io-es-la-demo-original-y-se-elimina.md)
>   (27/08) **cerró el asunto**: `demo.space-os.io` es solo la demostración
>   ORIGINAL y desaparece. **No se mueve al PADRE, no se le emite certificado.**
>   La tarjeta **TH-F4.5 sigue cancelada** —el registro A no se borra a mano— y
>   `F4.3` queda **sin objeto**.
> - **El autoregistro: sigue siendo falso.** Está **cerrado en toda la flota**
>   desde **P8** (14/08, reafirmado el 20/08), **DEMO incluida**.
>
> Este aviso llevaba desde el 26/08 corrigiendo hacia el lado equivocado en el
> primer punto — corregido el 27/08. Lo que manda hoy sobre el modelo es el
> [ADR 0022](../../docs/adr/0022-instancia-dedicada-por-owner.md).

## 3 · Qué se produjo

| Pieza | Dónde está | Estado |
|---|---|---|
| **Plan de implementación v2** (1 855 líneas, 40 tareas, 9 fases) | `docs/Plan_Instancias_Soberanas_v2.md` — rama `feat/servidor-padre-instancias`, commit `9e244c7`. Copia idéntica en `Downloads\server padre\` | Entregado |
| **Documento de corrección legible por máquina** | `2026-08-12-correccion-modelo-instancias-space-os.md` — texto extraído del PDF de 7 páginas; el PDF sigue siendo el original | Entregado |
| **Agente planeador reescrito** | `~/.claude/agents/planeador-server-padre.md` | Entregado |
| **Documentos del 11 en PDF** | `2026-08-11-subdominios-por-tenant-plan.pdf` (37 pp.) | Entregado |
| **Código de producción** | — | **Sin empezar** |

## 4 · Veredicto sobre el trabajo del 11 — los diez, ninguno omitido

| Tarea del plan del 11 | Veredicto | Dónde aterriza |
|---|---|---|
| T0 · Cerrar el autoregistro público | **Se ejecuta** | F0.1–F0.3. **Cerrado en TODA la flota, DEMO incluida** (P8, 2026-08-20), y anclado por prueba, no por memoria (`entorno.test.ts:143,197`). *(Decía «Encendido solo en DEMO» hasta el 2026-09-03; era el veredicto del 13/08, anterior a P8.)* |
| T1 · `subdominioDe()`, parser de Host | Se descarta | No hay subdominios que parsear: una instancia, un dominio fijo |
| T2 · Arnés e2e con cabecera Host | Se descarta | Solo existía para probar T1 y T6 |
| T3 · Slugs reservados con CHECK | **Se adapta** | Deja de ser código; queda como nota de infra en la ADR 0014 (F8.1) |
| T4 · `marca.ts` por subdominio | Se descarta | Una instancia = una empresa = una marca, desde su `config_negocio` |
| T5 · Alta atómica + URL en la respuesta | **Mitad** | La transacción atómica sí (F5.1); la URL no. **Ojo:** es código nuevo, no un rescate |
| T6 · Candado de coherencia en `exigir()` | Se descarta | El aislamiento entre owners es físico |
| T7 · Marca en el login | Se descarta | La instancia ya muestra su única marca |
| T8 · Borrar `new-tenant.sh` | **Se ejecuta** | Ampliado a los **cuatro** scripts muertos (F5.5): uno llama a otro |
| T9 · Wildcard DNS + certificado comodín | Se descarta | Sobrevive el procedimiento HTTP-01 normal, reutilizado en F4.3 y F5.4 |

## 5 · Las nueve fases, convertidas en tareas

| Fase | Tareas | Estado del desarrollo |
|---|---|---|
| **0** · Cerrar el autoregistro fuera de DEMO | 3 | Completa — arranca con una verificación que hay que correr |
| **1** · Migración de limpieza de los `DEFAULT` | 5 | Completa — incluye la auditoría previa de filas mal etiquetadas |
| **2** · Release versionado (el artefacto) | 6 | Completa — falta solo el *nombre* del registry (§8.4) |
| **3** · `update.sh` + runner de migraciones | 9 | Completa — incluye retirar el despliegue por SSH, que hoy viola el modelo |
| **4** · Separar DEMO como instancia real | 5 | Completa |
| **5** · `provision-instancia.sh` (alta de un owner) | 8 | 6 de 7 — el alta real espera §8.2 y §8.3 |
| **6** · Visibilidad de flota | 4 | Completa — el panel va fuera del artefacto |
| **7** · Desenredar `spaces_prod` | 3 | **Solo el censo** — mueve datos reales y §8.1 no está decidida |
| **8** · Cierre documental | 3 | Completa — ADR 0014, archivo de los documentos del 11, bóveda al día |

Cada tarea trae objetivo observable, fase y dependencias, archivos con ruta real, la
prueba que debe fallar primero, pasos numerados, criterio de aceptación, comando de
verificación, commit sugerido y vuelta atrás. En total el plan pide **35 pruebas
nuevas** (16 unitarias, 19 de integración), de las cuales **14 son negativas**: el
aislamiento se demuestra por lo que impide.

## 6 · Lo que el código dijo que los documentos no sabían

De las 16 afirmaciones que el documento del 12 hace sobre el repositorio, **todas
coinciden salvo una cifra**. Pero al abrir los archivos aparecieron hechos que
cambian tareas concretas.

| Hallazgo | Qué implica |
|---|---|
| `withTxBootstrap` **no existe** | El documento lo da por «rescatado tal cual». Era una propuesta del plan del 11 que nunca se escribió: es **código nuevo** (F5.1) |
| Los `DEFAULT` de `tenant_id` son **23, no 21** | Contados uno a uno en `db/schema.sql` **antes del 19/08**; desde `9d609f0` el esquema ya no los crea y esas líneas son otra cosa. La migración los descubre por catálogo, no por lista |
| ~~`deploy.yml` entra por SSH, compila en el servidor y recarga pm2~~ | **Resuelto el 2026-08-31: F3.6 lo retiró** (commit `658c467`). Era exactamente lo que el modelo prohíbe. Ver [[entorno-y-despliegue]] |
| Los scripts muertos de la pista Prisma son **cuatro**, y uno llama a otro | Borrar solo `new-tenant.sh` dejaría `setup-first-tenant.sh:28` roto |
| El orden de migraciones **no es alfabético** (`db-e2e.ts:145-155`) | El runner de la Fase 3 tiene que reproducir dos excepciones reales o una instancia nueva no levanta — ver [[migraciones]] |
| `server-only` bloquea el atajo de la Fase 5 | Un script de aprovisionamiento no puede importar el alta ni el hash de contraseña; el Dueño se crea por una ruta HTTP de un solo uso |
| El panel de flota no cabe en `apps/web` | El artefacto es idéntico para todos: meterlo ahí mandaría la lista de la flota al servidor de cada owner |

## 7 · Lo que está bloqueado, y por quién

> [!success] Las cuatro decisiones de la §8, **CERRADAS al 2026-08-20**
> La tabla de abajo es el estado en que nacieron, y se conserva porque explica qué
> bloqueaba cada una. **Ninguna sigue abierta.**
>
> | | Respuesta | Fecha |
> |---|---|---|
> | **P1** | ⚠️ **ENMENDADA dos veces — ver abajo.** Nació diciendo: el droplet actual pasa a ser el PADRE y sus datos —`rgb` incluido— **se recrean desde cero**: son de prueba | 20/08 |
> | **P2** | **No hay migración de PIXELED.** Nace como instancia nueva y la información se recarga | 20/08 |
> | **P3** | Las instancias nacen en la **cuenta de DigitalOcean de la casa**, la misma del registry | 20/08 |
> | **P4** | **DigitalOcean Container Registry**, en la cuenta de PIXELED | 17/08 |
>
> **Lo que P1 arrastra y hay que mirar antes de ejecutarla:** el droplet deja de
> ser el entorno de producción del negocio, así que **la Fase 7 entera**
> («desenredar `spaces_prod`», 3 de las 46 tareas) **se vacía de contenido** — se
> escribió para mover datos reales de un entorno compartido, y no hay datos reales
> que mover. **Revisarla antes de ejecutarla**, no darla por válida tal cual.
>
> Y P3 tiene contrapartida, dicha una vez: una sola cuenta y **el padre guardando
> las llaves de cada droplet** concentra el riesgo — quien comprometa esa cuenta
> alcanza **toda la flota**. El runbook tiene que decir quién tiene esas llaves,
> dónde se guardan y cómo se rotan. No contradice el invariante de F3.4, que habla
> de la instancia **ya corriendo**: `update.sh` sigue sin hablar con el padre.
>
> ⚠️ La premisa que las cierra es **«todo es demo»**, y **deja de valer el día que
> se dé de alta la primera instancia de un owner con datos suyos**.
>
> Detalle y trazabilidad en [[ejecucion-plan-v3]] · [[preguntas-abiertas]].

> [!important] P1, enmendada dos veces — lo vigente es esto
> **Lo único de P1 que no se ha movido**: los datos del droplet viejo, `rgb`
> incluido, **son de prueba y se recrean desde cero**. No hay que archivar ni
> migrar nada.
>
> **Lo que sí cambió, y hay que leer en orden:**
>
> | | Qué dijo | Fecha |
> |---|---|---|
> | P1 original | El droplet actual **se convierte en el PADRE** | 20/08 mañana |
> | 1ª enmienda | **El PADRE es un droplet NUEVO**, contratado aparte. Deja **sin decidir** qué pasa con el viejo: apagarlo, dejarlo como DEMO o guardarlo de reserva | 20/08 tarde |
> | 2ª enmienda | El droplet viejo se queda como DEMO | 21/08 |
> | **3ª enmienda — SUPERADA** | 🛑 **SE PIERDE EL ACCESO al droplet viejo.** No se convierte en DEMO, no se apaga y no se guarda de reserva: **no se puede hacer ninguna de las tres.** Queda **ABANDONADO** — público, no actualizable, no apagable. **DEMO pasa a vivir DENTRO del PADRE** ([ADR 0015](../../docs/adr/0015-demo-dentro-del-padre.md)): `space-os.io` para el PADRE, `demo.space-os.io` para DEMO, segundo proceso en el 3001 con base `spaces_demo`. ⚠️ Eso **no cierra el riesgo de la Fase 4: lo transforma** — de «demo pública = producción» a **«demo pública = plano de control»**. Con ella **F4.1 y F7.1 pasan a IMPOSIBLES** | **24/08** |
> | **4ª enmienda — VIGENTE** | ✅ **EL ACCESO NUNCA SE PERDIÓ.** Se entró el 25/08 y se completó el censo de F4.1: la máquina está **entera y funcionando** —proceso `online` como `emiliano`, base respondiendo (`login-post 401`), certificado válido y renovable—. **Vuelve la 2ª enmienda: el droplet viejo se queda como DEMO** ([ADR 0016](../../docs/adr/0016-demo-se-queda-en-su-droplet.md), que supera al 0015). Y con ello el riesgo de la Fase 4 **se cierra** en vez de transformarse | **25/08** |
>
> La 1ª enmienda no fue una opinión: el PADRE **ya nació en una máquina nueva** el
> 21/08 y está corriendo. Cualquier nota que siga diciendo que el droplet actual
> es el PADRE describe algo que **no ocurrió**.
>
> **Lo que la 2ª enmienda ahorra:** F4.2 y F4.3 pedían **una tercera máquina** para
> la demostración (≈$12/mes). Con el viejo haciendo de DEMO se resuelven **moviendo
> un registro de DNS y recreando su base** — sin contratar nada.
>
> > [!warning] Condición, y no es opcional: **F4.1 antes**
> > «Recrear su base» es un borrado. **F4.1 es el censo que dice qué se borra**, es
> > de solo lectura y lleva sin correrse desde el 13/08. La decisión se registra
> > aquí **a petición expresa de Jochelo, sin esperar al censo** (21/08); si el
> > censo devuelve inventario real en `rgb` o un commit desplegado que no esté en
> > `main`, **esta enmienda vuelve a la mesa**.
>
> **Lo que NO cambia ninguna de las dos:** la **Fase 7** («desenredar `spaces_prod`»,
> 3 de las 46 tareas) **sigue vaciándose de contenido**, porque se escribió para
> mover datos reales y no hay datos reales que mover. Y `rgb` **se conserva como el
> tenant del super admin del PADRE**, aunque sus datos de negocio se recreen.

*Estado en que nacieron, al 2026-08-13:*

| Decisión (la toma Jochelo) | Bloquea | Qué cambia según la respuesta |
|---|---|---|
| **P1** · Destino del tenant `rgb` y del droplet actual | F7.2, F7.3 y el cierre de la Fase 4 | Si RGB tiene instancia propia, se suma un aprovisionamiento y un dominio; si se retira, hay que decidir de quién cuelga el super-admin (hoy cuelga del tenant más antiguo) |
| **P2** · Fecha para migrar PIXELED | F5.7 y F7.2 | Si es dentro del sprint de la Fase 5, la primera instancia deja de ser un alta limpia y pasa a ser migración de datos con respaldo y ventana |
| **P3** · ¿Las instancias nacen en la cuenta DO de AS OOH o en la del owner? | Modo por defecto del script de aprovisionamiento y todo el runbook | Define quién guarda las llaves, quién renueva el certificado y quién vigila las actualizaciones |
| **P4** · Nombre del registry de imágenes | Solo el *valor* en F2.3/F2.4 | No bloquea escribir el workflow; sí el login y el límite de almacenamiento |

> [!success] P4-bis · RESUELTA el 13/08 y EJECUTADA el 14/08 (F2.6)
> **La contradicción era esta:** DEMO necesita el autoregistro encendido, esa
> bandera se horneaba en el build, y la regla dice que el artefacto es idéntico
> para todas las instancias. Las dos cosas no podían ser ciertas a la vez.
>
> **Salida elegida: (b), sacar la bandera del build.** Un solo artefacto por
> versión. `NEXT_PUBLIC_AUTOREGISTRO` pasó a llamarse **`AUTOREGISTRO`** y se lee
> al arrancar (`apps/web/lib/entorno.ts`), igual que `GOOGLE_OAUTH` — el
> precedente que ya existía en el repo. Se descarta publicar dos imágenes por
> versión, así que **F2.3 publica un solo artefacto**.
>
> Como se advirtió, **cambia el comportamiento de la bandera**: es *fail-closed*.
> Solo `AUTOREGISTRO=1` enciende; ausente o cualquier otro valor deja el registro
> cerrado. Antes era al revés (ausente = abierto). Comprobado con la misma imagen
> sin recompilar: sin variable → 503, `=0` → 503, `=1` → 400.
>
> Y apareció una segunda mitad que el documento no había visto: el **cliente**
> también estaba horneado, y horneado **encendido**. `/login` se prerrenderiza en
> el build y su HTML traía el botón «Crear cuenta» dentro, con el servidor
> contestando 503 al pulsarlo. Se resolvió preguntando a `/api/auth/metodos/`,
> que ahora devuelve `{"google":…,"autoregistro":…}`.

Dos preguntas técnicas menores:

- **P5.** La Fase 3 dice «se ensaya primero en DEMO» y la Fase 4 es la que *crea*
  DEMO. El plan asumió que se refiere al droplet **nuevo**, no al actual —que hoy es
  también la producción de los tenants reales—. Si fuera el actual, el ensayo de un
  release roto tocaría datos reales.
- **P6.** ¿`GET /api/version` va tras un token de flota o completamente pública?

Y dos datos que nadie tiene todavía:

- La lista de tenants del documento del 12 (`rgb, g500, eyro, emis-pruebas`) **no
  coincide** con la del contexto operativo (`g500, rgb, eyro, telcel, demo-owner`).
  Ninguna se puede dar por buena: el censo de F7.1 es lo que las sustituye.
- `main` lleva al menos una migración que producción no tiene (commit `2f28be0`). El
  censo del droplet (F4.1) tiene que decir cuál.

## 8 · Lo que cuesta poner el modelo en pie

> [!note] De dónde salen estos números
> Son **precios de lista de DigitalOcean en dólares, sin impuestos**. No se consultó
> la cuenta: el trabajo de planeación tuvo prohibido todo acceso a DigitalOcean, así
> que no se conoce el tamaño del droplet actual ni la factura vigente. Del repo
> consta que hoy hay **un solo droplet** con **Postgres instalado en él** (no es base
> administrada) y **Spaces** activo para archivos.

**Lo mínimo para las fases 0–6, antes del primer owner:**

| Pieza | Para qué | Mensual |
|---|---|---|
| Droplet **PADRE** (1 GB / 1 vCPU / 25 GB) | Plano de control y panel de flota. No sirve a clientes ni guarda datos de ningún owner | $6 |
| Droplet **DEMO** (2 GB / 1 vCPU / 50 GB) | Instancia real con su propia base. 2 GB porque ahí conviven Docker, Next y Postgres | $12 |
| **Backups** de los dos | Es la vuelta atrás real de `update.sh` cuando un release sale mal | $3.60 |
| **Container Registry** Basic, 5 GB | El artefacto de la Fase 2. El plan gratuito (500 MB, un repositorio) no alcanza | $5 |
| **Snapshot** de la imagen base | Que aprovisionar sea clonar en minutos, no instalar desde cero | ≈ $1.50 |
| | **Suma nueva sobre lo de hoy** | **≈ $28** |

Ancho de banda, firewall en la nube, monitoreo e IPs reservadas no se cobran aparte.
Único gasto de una sola vez: el droplet desechable del ensayo de aprovisionamiento
(F5.6), que se destruye al terminar y cobra por hora — **$1 o $2**.

**Cada owner nuevo:** droplet dedicado de 2 GB ($12) + backups ($2.40) = **≈ $15 al
mes** (≈ $22 con 2 vCPU). Su dominio y su DNS los paga el owner; el certificado
Let's Encrypt es gratis.

| Escenario | Total mensual | Contra lo de hoy |
|---|---|---|
| Solo dejar el modelo funcionando (padre + DEMO + registry) | ≈ $28 nuevos | +$28 |
| Con PIXELED en su instancia **y el droplet viejo apagado** | ≈ $47 | +$20 a +$35 |
| Con tres owners (PIXELED, SANKOFA, TAURO) | ≈ $77 | +$50 a +$65 |

Dos decisiones bajan esta cuenta: si **P3** resuelve que las instancias nacen en la
cuenta del propio owner, esos ~$15 por owner los paga él; si **P4** elige GitHub
Container Registry, se ahorran los $5 del registry.

Para reemplazar estos estimados por los números reales:

```bash
doctl compute droplet list --format Name,Region,Memory,VCPUs,Disk,PriceMonthly,Status
doctl compute snapshot list
doctl registry get
doctl balance get
```

O en el panel: **cloud.digitalocean.com/account/billing** → *Billing history*.

## 9 · El siguiente paso concreto

La tarea **F0.1** no depende de ninguna decisión y bloquea toda la Fase 0 y la Fase
4. Es lectura pura, sin riesgo, y hay que correrla desde una máquina con red:

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST \
  https://demo.space-os.io/spaces-dooh/api/signup/ \
  -H 'Content-Type: application/json' -d '{}'
```

**HTTP 503** = el autoregistro está apagado, se sigue a F0.3. **HTTP 400** = está
abierto y hay que apagarlo y **recompilar** hoy mismo (reiniciar pm2 no basta: la
bandera vive en el build). Cualquier otro código no es concluyente y no se avanza
hasta saber por qué.

## 10 · Lectura crítica

> [!note] Esta sección es opinión, no medición
> Todo lo anterior es verificable contra el documento y el repositorio. Lo que sigue
> es un juicio de ingeniería sobre el rumbo y el calendario, escrito **antes** de
> arrancar para poder contrastarlo al terminar.

### El rumbo: la corrección gana, y por margen amplio

El plan del 11 estaba bien hecho y resolvía mal el problema. Su propio diseño
aceptaba como «precio del modelo» que un despliegue malo tumbara a todas las
empresas a la vez, y necesitaba inventar un candado en código para que un usuario no
entrara por la URL de otra empresa. El modelo corregido borra las dos cosas de un
plumazo. **Sustituye código defensivo por física.**

Cuesta menos de construir de lo que parecía: de las diez tareas del plan viejo, seis
se descartan. Lo que sobrevive era higiene que había que hacer de todos modos. No se
tiró trabajo: se tiró trabajo que apuntaba al lado equivocado. Y el plan v2 no se
creyó al documento: llegó con contraejemplos, no con aplausos. **Eso es lo que lo
hace confiable.**

### El calendario: «~2 semanas» es el número más débil del documento

Sumando las estimaciones que el propio documento da fase por fase —0.5 + 1 + 2–3 +
3–4 + 1–2 + 2–3 + 1–2 días— salen **13 días hábiles en secuencia, es decir 2.6
semanas**. Las dos semanas solo aparecen con paralelismo perfecto y sin que nada
falle. Es el mejor caso, no el esperado. Y esa estimación se escribió **antes** de
abrir el código:

| Lo que el documento asumió | Lo que el repo mostró | Efecto |
|---|---|---|
| `withTxBootstrap` se rescata tal cual | No existe; hay que escribirlo con sus pruebas | La Fase 5 crece |
| El aprovisionamiento importa el alta desde un script | `server-only` lo impide; hace falta una ruta HTTP de un solo uso | Código nuevo, y del delicado |
| Las migraciones se aplican en orden alfabético | No: hay dos excepciones ya codificadas | Si el runner falla ahí, una instancia nueva no levanta |
| Nada sobre el despliegue actual | `deploy.yml` violaba el invariante y hubo que retirarlo | Una tarea entera fuera de toda fase — **hecha el 31/08 como F3.6** |

> [!important] Estimación honesta: 3 a 4 semanas para las fases 0–6
> Con dos personas dedicadas y las cuatro decisiones respondidas desde el día uno. La
> **Fase 7 no está dentro de ese número**: mover los datos reales de `spaces_prod` es
> la parte más riesgosa del conjunto, el documento la estima aparte en 2–4 días, y
> con respaldo, ensayo y ventana se parece más a una semana. **«Dos semanas» es el
> piso, no la meta.**

### Tres cosas que cambiaría antes de arrancar

1. **Decidir P4-bis antes de la Fase 2**, no después. Si la respuesta es sacar la
   bandera del build, cambia cuatro sitios de código y el diseño del artefacto:
   decidirlo después de construir la Fase 2 significa rehacerla.
2. **Considerar hacer la Fase 4 antes de la Fase 3.** El documento pide ensayar
   `update.sh` en DEMO, pero DEMO se crea en la Fase 4. El orden natural es crear
   primero el lugar donde se va a ensayar. Es decisión de Jochelo: las fases están
   aprobadas y el plan no las reordena por su cuenta.
3. **Más ojos en F1.2.** Quitar los 23 `DEFAULT` sobre la base de producción es la
   tarea que puede doler. La auditoría previa (F1.1) está bien puesta; aun así
   conviene revisarla entre dos personas antes de aplicar.

**En una línea:** el rumbo está bien y el plan está bien construido; lo que hay que
corregir es la expectativa de tiempo, no el diseño.

---

## Fuentes

- `2026-08-12-correccion-modelo-instancias-space-os.pdf` — documento aprobado por
  Jochelo, 7 páginas. Es **la autoridad** sobre este tema; los dos documentos del 11
  están archivados y no se ejecutan.
- `docs/Plan_Instancias_Soberanas_v2.md` — rama `feat/servidor-padre-instancias`,
  commit `9e244c7`, 1 855 líneas.
- Las referencias a archivo y línea se abrieron contra el repositorio el 2026-08-12;
  ninguna se dio por buena de memoria. No se ejecutó ningún comando contra un
  servidor de producción, ni `doctl`.
- Misma información en `Downloads\server padre\avance-correccion-jochelo.html` y
  `.pdf` (14 páginas), para mandar fuera del equipo.

Relacionadas: [[multi-tenancy-y-rls]] · [[entorno-y-despliegue]] ·
[[vision-general]] · [[decisiones]] · [[preguntas-abiertas]] · [[zonas-de-riesgo]]

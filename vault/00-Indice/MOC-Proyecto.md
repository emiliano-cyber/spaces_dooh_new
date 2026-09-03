---
tipo: moc
estado: verificado
actualizado: 2026-08-28
tags: [indice, entrada]
archivos:
  - package.json
  - apps/web/package.json
  - db/schema.sql
---

# MOC — Space OS (spaces_doohmain_nueva)

> **Punto de entrada de la bóveda.** Desde aquí se llega a cualquier nota en 1 salto.

## Qué es esto

CRM/ERP multi-organización para **publicidad exterior (OOH/DOOH)**: inventario de
pantallas y espectaculares, arrendadores y contratos de renta, propuestas
comerciales, campañas, órdenes de trabajo en campo, imprenta, facturación y
cobranza.

| Dato | Valor | Evidencia |
|---|---|---|
| Producto vivo | Una sola app Next.js con BFF integrado | `apps/web/package.json` · lo arranca **systemd**, no pm2 (`infra/systemd/spaces-web.service:83`) |
| Framework | Next.js 14.2.29, App Router | `apps/web/package.json:17` |
| Base de datos | PostgreSQL, `pg` directo (sin ORM) | `apps/web/lib/server/db.ts:2` |
| Aislamiento | RLS de Postgres por `app.tenant_id` | `apps/web/lib/server/db.ts:54-69` |
| Producción | **El PADRE `137.184.107.53` sirve `space-os.io`**, certificado propio hasta el **2026-11-23** con renovación automática. DEMO vive dentro de él (proceso `3001`, base `spaces_demo`) y desde el **31/08 se llama `pruebas.space-os.io`** — nombre nuevo, no `demo.space-os.io`, que es solo la demostración ORIGINAL, la sirve la máquina vieja y **se eliminará** ([ADR 0024](../../docs/adr/0024-demo-space-os-io-es-la-demo-original-y-se-elimina.md), que sustituye al 0021) | `infra/nginx/space-os.io.conf:124` y `:188` · [ADR 0017](../../docs/adr/0017-todo-se-concentra-en-el-padre.md) · [ADR 0024](../../docs/adr/0024-demo-space-os-io-es-la-demo-original-y-se-elimina.md) · [ADR 0022](../../docs/adr/0022-instancia-dedicada-por-owner.md) |
| Endpoints | **90** route handlers | `apps/web/app/api/**/route.ts` |
| Tablas | 42 | [[esquema]] |
| Migraciones | **76** | [[migraciones]] |
| ADR | **24** (`0001`–`0024`) | `docs/adr/` · [[decisiones]] |

> [!success] `demo.space-os.io` SE ELIMINARÁ — cerrado el 27/08 por el ADR 0024
> Ese nombre **no sirve más que para la demostración original** —la anterior al
> modelo de instancias— y **desaparece**. No se mueve al PADRE, no se le emite
> certificado y no se le busca máquina. La demostración de las instancias hijas
> será **una instancia hija de verdad**, la primera que nazca de `F5.7`.
>
> Con eso **`F4.3` queda sin objeto** y el plan v3 baja a **39 tareas con
> objeto**. Su certificado vence el **2026-10-26**, y eso pasa a ser su
> caducidad natural, no un plazo que obligue a nada.
>
> **Este punto giró SEIS veces en seis días** (ADR 0015 → 0016 → 0017 → 0020 →
> 0021 → 0024). Lo que costó caro no fue cambiar de idea: fue que las partes que
> **no** se decidían se rellenaran por deducción. El 0024 cierra los dos huecos
> que el 0021 dejaba abiertos —qué máquina lo sirve y qué pasa con su
> certificado—, así que **ya no se pregunta y no se infiere lo contrario**.

> [!warning] No confundas «90 endpoints» con «los 72 endpoints censados»
> El censo de validación de entrada del 26/08 (`721557d`, `e125dee`) revisó **72**
> route handlers: los que reciben cuerpo. Es un subconjunto, no el total. Un
> commit que diga «72 endpoints» habla de ese censo; el total de
> `app/api/**/route.ts` medido el **27/08** es **90**.

## Antes de tocar nada

> [!warning] Lectura obligatoria para cualquier agente
> 1. [[AGENTES]] — el contrato de trabajo en paralelo
> 2. [[zonas-de-riesgo]] — qué es ROJO, AMARILLO y VERDE
> 3. [[tablero]] — qué zonas están tomadas ahora mismo

## Mapa

### 00 · Índice
- [[glosario]] — términos del dominio (predio, modalidad, divisor, candado…)
- [[preguntas-abiertas]] — lo que **no** se pudo determinar leyendo el código

### 01 · Arquitectura
- [[vision-general]] — diagrama de componentes y por qué hay una sola pista viva
- [[stack-y-dependencias]] — versiones reales y por qué están fijadas
- [[entorno-y-despliegue]] — local, CI y el despliegue manual por SSH
- [[decisiones]] — los 24 ADR y las decisiones deducidas del código
- [[modelo-instancias-soberanas]] — una instancia por owner: avance de la corrección del 12/08, costos y calendario

### 02 · Backend
- [[02-Backend/_indice|Índice de Backend]] — mapa de la capa servidor
- [[api-endpoints]] — los 90 endpoints con método, guard y módulo
- [[autenticacion-y-sesion]] — cookie, sesión, CSRF, permisos, reautenticación
- [[multi-tenancy-y-rls]] — cómo se aísla cada organización
- [[inventario-y-sitios]] — pantallas, modalidades, importación
- [[arrendadores-y-contratos]] — predios, contratos, rentas, firmas
- [[comercial-propuestas-campanas]] — propuestas, reservas, campañas
- [[operaciones-y-ot]] — órdenes de trabajo, evidencias, imprenta
- [[finanzas-y-cobranza]] — facturación, candado, parcialidades
- [[integraciones-externas]] — DOOHmain, Space Eye, Spaces S3, Resend, Google
- [[infraestructura-servidor]] — pool, errores, folios, rate limit, subidas

### 03 · Frontend
- [[03-Frontend/_indice|Índice de Frontend]] — mapa de la capa cliente
- [[shell-y-navegacion]] — layouts, sidebar, topbar, guards de UI
- [[acceso-y-sesion-ui]] — login, recuperar, autoregistro
- [[modulos-internos]] — las 22 pantallas del shell
- [[paginas-publicas]] — portal, firma, propuesta compartible, OT móvil
- [[estado-y-data-fetching]] — React Query, zustand, el parche de `fetch`

### 04 · Datos
- [[esquema]] — diagrama ER y las 39 tablas
- [[migraciones]] — las 75 en orden, y las trampas de orden

### 05 · Flujos
- [[flujo-login]] — del clic a la cookie
- [[flujo-acceso-con-google]] — ADR 0012, desplegado y apagado
- [[flujo-propuesta-a-campana]] — el flujo principal del producto
- [[flujo-facturacion-y-cobranza]] — el candado y las parcialidades
- [[flujo-orden-de-trabajo]] — campo, evidencias y cierre

### 06 · Operación
- [[zonas-de-riesgo]] — ROJO / AMARILLO / VERDE con evidencia
- [[convenciones]] — cómo se escribe código y documentación aquí
- [[verificacion-de-produccion]] — comandos para comprobar qué corre de verdad
  en el droplet y qué hay en `spaces_prod` (sin ejecutar)

### 07 · Agentes
- [[AGENTES]] — particionado, claims, ramas, conflictos
- [[tablero]] — estado vivo de las zonas
- [[ejecucion-plan-v3]] — estado vivo de la ejecución del plan v3, tarea por tarea
- [[auditoria-f3-9-y-m3]] — **ROJO (20/08)**: la contraseña sale al bucket de logs
  cuando el `=` de la consulta va percent-encoded
- [[_plantilla-diaria]] — plantilla del diario
- [[2026-08-27]] — **última entrada**: la CSP en modo reporte destapa que la pista
  archivada seguía ejecutándose en producción; se retiran nueve rutas
- [[2026-08-25]] — el PADRE nunca había hablado con su base,
  y cuatro documentos lo daban por vivo
- [[2026-08-24]] — la Fase 4 se queda sin su objeto… y la misma tarde se
  desmiente: el acceso al droplet viejo **nunca se perdió**
- [[2026-08-21]] — el droplet PADRE en pie, y los siete
  defectos que solo aparecen corriendo el procedimiento en un servidor real
- [[2026-08-20]] — los tres ROJO del re-ensayo de la Fase 4, cerrados; el
  catálogo de permisos completo y la contraseña del Dueño
- [[2026-08-19]] — la fuga de credenciales cerrada al cuarto intento, la Fase 4
  ensayada, y «las bases son de pruebas»
- [[2026-08-18]] — turno nocturno de guardia: F3.4 ensayada, F3.8, F3.7 y la poda;
  F3.9 en dos ciclos
- [[2026-08-17]] — el runner de migraciones en tres ciclos, T-04, F3.3, el
  workflow de release y `update.sh`
- [[2026-08-14]] — expedientes de evidencia, Fase 2 y el registro cerrado en toda la flota
- [[2026-08-13]] — entra el plan v3 con sus tres agentes; Fase 1 cerrada en local
- [[2026-08-12]] — nace el plan del servidor padre
- [[2026-08-11]] — el menú lateral cuenta el proceso
- [[2026-08-10]] — despliegues del día + V2-01
- [[2026-08-07]] — creación de la bóveda y la tarde de Google

### 08 · Manuales
- [[manual-tecnico]] — entrada para un dev nuevo: arquitectura, datos, API,
  entornos, despliegue y operación. Derivado del [[inventario-2026-08-11]]

> [!tip] Esta bóveda caduca
> Última validación contra el código: **31/08/2026**. El procedimiento para
> repetirla (cuatro chequeos y sus cuatro trampas) está en [[convenciones]].
> Lo medido ese día: **90** route handlers, **75** migraciones, **39** tablas,
> **24** ADR, **22** pantallas del shell, **127 archivos en `app/`** y **67
> componentes**; **804 enlaces internos, 0 rotos, 0 huérfanas** sobre **57**
> notas, y **0 líneas citadas fuera de rango**.
>
> (Eran 753 el 28/08. La subida es de esta misma revisión: la lista de abajo
> enlaza una por una las notas revalidadas, y eso son ~30 enlaces nuevos.)
>
> Respecto del **28/08** se movieron las migraciones (74 → **75**, por
> `20260828_reautenticacion_por_defecto.sql`) y desapareció
> `.github/workflows/deploy.yml` (F3.6). Endpoints, tablas y ADR siguen igual.

> [!warning] Qué se revalidó el 31/08 y qué NO — la lista, para que nadie la suponga
> No todas las notas se comprobaron igual, y la diferencia importa más que el
> número de arriba.
>
> **Revalidadas contra el código, nota a nota (17):** [[MOC-Proyecto]] ·
> [[glosario]] · [[preguntas-abiertas]] · [[inventario-2026-08-11]] (solo su
> aviso de caducidad) · [[stack-y-dependencias]] · [[entorno-y-despliegue]] ·
> [[modelo-instancias-soberanas]] · [[infraestructura-servidor]] ·
> [[integraciones-externas]] · [[finanzas-y-cobranza]] · [[operaciones-y-ot]] ·
> [[03-Frontend/_indice|Índice de Frontend]] · [[paginas-publicas]] ·
> [[estado-y-data-fetching]] · [[migraciones]] · [[flujo-login]] ·
> [[flujo-acceso-con-google]] · [[AGENTES]] · [[manual-tecnico]] (con aviso).
>
> **Solo con los cuatro chequeos mecánicos, sin releer su contenido contra el
> código (8):** [[inventario-y-sitios]] · [[arrendadores-y-contratos]] ·
> [[comercial-propuestas-campanas]] · [[shell-y-navegacion]] ·
> [[acceso-y-sesion-ui]] · [[flujo-orden-de-trabajo]] ·
> [[flujo-facturacion-y-cobranza]] · [[flujo-propuesta-a-campana]].
>
> **Sus citas resuelven y ninguna línea se salió de rango**, así que no hay nada
> roto que se pueda medir. Lo que no se comprobó es lo que ningún script detecta:
> que describan correctamente algo **que ya se decidió de otra forma**. Por eso
> **conservan su fecha vieja (07 al 14 de agosto) a propósito** — ponerles la de
> hoy sería justo el fallo que [[AGENTES]] describe: una nota caducada con fecha
> nueva se cree.
>
> Son notas de dominio (inventario, arrendadores, comercial, shell), que es la
> parte que menos movieron los cambios de infraestructura del 27 al 31. Es una
> apuesta razonable, no una comprobación.

## Advertencia sobre la documentación existente

`README.md` en la raíz **está desactualizado**: describe un backend Fastify
(`apps/api`), rutas `/var/www/spaces-dooh` y despliegue automático en cada push.
Nada de eso es cierto hoy — ver [[vision-general]] y [[entorno-y-despliegue]].

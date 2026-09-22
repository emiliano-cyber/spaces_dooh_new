---
tipo: modulo
estado: verificado
actualizado: 2026-09-22
tags: [backend, instancias, despliegue, rojo]
archivos:
  - db/migrations/20260921_actualizaciones_instancia.sql
  - apps/web/lib/server/actualizaciones-repo.ts
  - apps/web/app/api/actualizaciones/route.ts
  - scripts/actualizaciones.mjs
  - apps/web/components/demo/admin/ActualizacionesPanel.tsx
  - apps/web/components/demo/admin/actualizaciones-ui.ts
  - apps/web/lib/data/actualizaciones-api.ts
  - infra/scripts/update.sh
  - infra/scripts/instalar-hijo.sh
  - infra/scripts/provision-instancia.sh
---

# Actualización elegida por instancia (ADR 0037)

> **Esta nota es el mapa, no el detalle.** Cada pieza ya vive descrita, con su
> propia evidencia y citas, en la nota de su capa — [[api-endpoints]],
> [[infraestructura-servidor]], [[modulos-internos]], [[esquema]],
> [[migraciones]], [[entorno-y-despliegue]] y
> [[01-Arquitectura/modelo-instancias-soberanas|modelo-instancias-soberanas]]
> tocaron las siete entre las tareas 2 y 6. Lo que falta, y lo que esta nota
> aporta, es **por qué las cuatro piezas encajan así** — lo que cuesta
> reconstruir leyendo un archivo a la vez. El spec completo, con las
> alternativas descartadas, es
> [ADR 0037](../../docs/adr/0037-cada-instancia-elige-si-toma-la-version-nueva.md).

## Qué decide esto

Hasta el 2026-09-21 el canal (`CANAL=estable|beta` en `instancia.env`) mandaba
sin que el dueño pudiera decir que no: si la etiqueta del canal se movía, la
instancia se actualizaba en la siguiente corrida del cron de las 04:17. Desde
esta pieza, **el dueño de cada instancia elige, desde su propia pantalla, si
instala la versión nueva cuando se publica**.

## La idea central: la base de la instancia es el buzón

`update.sh` sigue sin hablar con el PADRE — esa propiedad no la toca este
diseño. Lo nuevo es que la aplicación y el actualizador **dejan de ser
extraños**: comparten una tabla en la propia base de la instancia,
`actualizaciones_instancia`, y cada uno escribe la mitad que le toca:

- **El actualizador** (`update.sh`, con el rol privilegiado que ya usa para
  migrar y respaldar) escribe *qué hay disponible*: versión, digest, cuántas
  migraciones traería, cuándo se comprobó.
- **La aplicación** (rol `spaces_app`, el mismo que corre con RLS en todo lo
  demás) escribe *qué quiere el dueño*: el modo, y el digest que aprobó.

Ningún proceso nuevo, ninguna credencial nueva, ninguna vía de red nueva. El
PADRE sigue sin aparecer por ningún lado — es la misma propiedad que describe
[[entorno-y-despliegue]] para el resto de `update.sh`.

> [!tip] Por qué no es una fila de `config_negocio`
> `config_negocio` es una fila **por tenant** (ADR 0011). Esta preferencia no es
> de una organización dentro de la instancia: es del droplet. Por eso
> `actualizaciones_instancia` nace **sin `tenant_id` y sin RLS** — es hermana de
> `schema_migrations`, no de `config_negocio`. Detalle de la tabla en
> [[esquema]] y [[migraciones]].

## Por qué la aprobación se ata al DIGEST y no al nombre de versión

Es la pieza que sostiene todo lo demás, y la más fácil de deshacer sin querer.
Si el dueño aprobara «v0.4.2» y luego alguien moviera la etiqueta del canal
—cosa que pasa: `release.yml` y `promover.yml` lo hacen a propósito—, esa
aprobación instalaría **una imagen que el dueño nunca vio**. Atada al digest,
una aprobación caducada deja de valer sola: `aprobarDigest()` en
`apps/web/lib/server/actualizaciones-repo.ts:64-78` hace la comprobación y la
escritura en **el mismo `UPDATE`** (el digest va en el `WHERE`, no en un
`SELECT` previo), así que no cabe una corrida de `update.sh --comprobar`
cambiando el disponible justo en medio. Si el digest ya no cuadra, el `PATCH`
de `apps/web/app/api/actualizaciones/route.ts` responde **409**, no lo guarda
calladamente.

El caso negativo que lo prueba, y el que hay que conservar si algo aquí se
toca: *una aprobación para un digest que ya no es el disponible no
actualiza.* Vive en `scripts/actualizaciones.test.ts` y en el motivo
`'aprobacion-caduca'` de `decidirActualizacion()`.

## Por qué los dos escritores están separados por GRANT, no por convención

`db/migrations/20260921_actualizaciones_instancia.sql:66-83` no confía en que
nadie llame a la función equivocada: hace `revoke all` y luego
`grant update (modo, aprobado_digest, aprobado_por, aprobado_en,
actualizado_en)` — **por columna**, sobre `spaces_app` (y `spaces_user` en el
droplet viejo). Las columnas de *disponible* (`version_disponible`,
`digest_disponible`, `migraciones_pendientes`, `comprobado_en`,
`version_instalada`, `digest_instalado`) quedan fuera del `grant`: la
aplicación no puede escribirlas aunque un bug en
`actualizaciones-repo.ts` lo intentara. Si pudiera, un fallo en el servidor
web —no en `update.sh`— bastaría para que una instancia se auto-aprobara una
imagen que nadie publicó, sin pasar por el registry ni por el actualizador.
Postgres rechazaría el intento con `42501`, que `respuestaError()` traduce a
403: es la **segunda** capa, no la única — el `.strict()` del `patchSchema` en
`route.ts:47-55` es la primera y más barata.

> [!warning] El `revoke all` no es paranoia, es necesario
> `20260824_grants_tablas_futuras.sql` da privilegios por omisión —incluido
> `update` de tabla completa— al propietario que corre las migraciones, sobre
> **cualquier tabla nueva que ese propietario cree**, ésta incluida. Un
> privilegio de tabla completo gana siempre a uno por columna. Sin el
> `revoke all` antes del `grant`, `spaces_app` seguiría pudiendo escribir
> `digest_disponible` pese al grant por columna. La propia migración documenta
> que esto se detectó porque la prueba pasaba en verde **por el motivo
> equivocado** hasta que se añadió.

## `comprobar` y `actualizar` son dos corridas distintas

Con un solo cron diario (04:17), poner la decisión en manos del dueño habría
significado hasta **dos días** entre publicar y que el botón de «instalar»
hiciera algo real. La causa: una sola corrida mezclaba dos trabajos de coste
muy distinto — *comprobar* (mirar el registry, no toca nada) y *actualizar*
(cortar el servicio, migrar, poder volver atrás). Que actualizar sea de
madrugada tiene sentido; que comprobar también lo sea, ninguno.

| Corrida | Cuándo | Qué hace | Decide |
|---|---|---|---|
| `update.sh --comprobar` | cron nuevo, cada 15 min | anota lo disponible; aplica **solo** si hay una aprobación cuyo digest cuadra | `decidirActualizacion({ corrida: 'comprobar', ... })` |
| `update.sh` (sin bandera) | cron de siempre, 04:17 | aplica si `modo = automatica`, o si hay una aprobación que el cron frecuente no llegó a aplicar | `decidirActualizacion({ corrida: 'programada', ... })` |

La regla no vive en bash: es `decidirActualizacion()`, una función pura en
`scripts/actualizaciones.mjs`, con sus propias pruebas, importada por el
`node` que corre **dentro** de la sonda de `update.sh` (mismo patrón que
`migrar.mjs`). El orden de sus preguntas **es** la decisión —`automatica` se
resuelve antes de mirar la aprobación, para que una aprobación vieja no
congele a quien ya eligió automática— y está descrito con detalle en
[[entorno-y-despliegue]] y en
[[01-Arquitectura/modelo-instancias-soberanas|modelo-instancias-soberanas]].

**Por qué los cortes automáticos siguen siendo de madrugada**: un dueño que
pulsa «instalar» está pidiendo el corte a esa hora a propósito, y el cron de
15 minutos solo obedece esa aprobación explícita. El modo automático, en
cambio, nunca actualiza en la corrida `comprobar` — solo en la `programada` —
precisamente para que nadie reciba un corte de servicio a media mañana sin
haberlo pedido.

## Lo que pasa cuando algo no se puede saber

Dos casos no son «esperar», y por eso el actualizador no los salda en verde
con salida 0 aunque `--comprobar` corra 96 veces al día:

- **La imagen no trae `RepoDigest`.** Sin digest no hay qué aprobar — la
  aprobación va atada al digest — y el dueño se queda sin poder decidir. No es
  un bloqueo silencioso: `update.sh` sale con `EX_CONFIG`.
- **La tabla `actualizaciones_instancia` existe pero no se puede leer** (base
  caída, credencial mala, red rota). Distinto de que no exista todavía —eso sí
  sigue saliendo en 0, es una instancia con imagen anterior a la migración—:
  no saber nada no es lo mismo que saber que algo falta.

El coste de este diseño —hasta 96 correos al día mientras el problema dure—
está aceptado a conciencia y documentado en `infra/scripts/update.sh` junto a
la decisión. Ver la tarjeta humana, punto 7, para lo que falta medir de este
coste en la práctica.

## Dónde vive cada pieza

| Pieza | Archivo | Nota que la detalla |
|---|---|---|
| Tabla, grants | `db/migrations/20260921_actualizaciones_instancia.sql` | [[esquema]] · [[migraciones]] |
| Buzón (repo) | `apps/web/lib/server/actualizaciones-repo.ts` | [[infraestructura-servidor]] |
| Endpoint | `apps/web/app/api/actualizaciones/route.ts` (`GET`/`PATCH`, `administracion:ver`/`:aprobar`) | [[api-endpoints]] |
| Decisión pura | `scripts/actualizaciones.mjs` → `decidirActualizacion()`, con `scripts/actualizaciones.test.ts` | [[modelo-instancias-soberanas]] |
| Pantalla | `ActualizacionesPanel.tsx` (pinta) + `actualizaciones-ui.ts` (frase y tono, con pruebas — el `.tsx` no las tiene porque `vitest.config.ts` no monta jsdom) + `lib/data/actualizaciones-api.ts` (tipo y fetch, en `lib/data/` para no arrastrar `pg` al navegador) | [[modulos-internos]] |
| Actualizador | `infra/scripts/update.sh`, paso **2b** (entre comparar digest y respaldar), banderas `--comprobar` / sin bandera | [[entorno-y-despliegue]] |
| Cron | `infra/scripts/instalar-hijo.sh:874` y `infra/scripts/provision-instancia.sh:841` — misma línea, `*/15 * * * * root /opt/space-os/update.sh --comprobar …`, junto a la de las 04:17, no en su lugar | [[entorno-y-despliegue]] |
| Copia a la imagen | `Dockerfile:117`, `COPY scripts/actualizaciones.mjs` — verificado solo por lectura, ver la tarjeta humana punto 6 | [[entorno-y-despliegue]] |

## Lo que hay que hacer a mano, y que no se le puede pedir a este commit

Ninguna de las piezas de arriba se ha ejecutado contra un contenedor de
verdad — lo probado es que `update.sh` **obedece** la línea que recibe, no que
la línea se produzca sobre una base real. Y la migración **no puede
distinguir** una instancia nueva de una que lleva meses corriendo: nace en
`modo = 'aprobacion'`, así que si nadie toca las instancias existentes
(**DEMO y g500**), dejan de actualizarse **en silencio**. Los pasos completos,
en orden de lo que más duele si se olvida, están en la tarjeta humana:
`docs/evidencias/tarjeta-actualizaciones-elegidas.md`.

## Relacionadas
[[02-Backend/_indice|Índice de Backend]] · [[api-endpoints]] ·
[[infraestructura-servidor]] · [[modulos-internos]] · [[esquema]] ·
[[migraciones]] · [[entorno-y-despliegue]] ·
[[01-Arquitectura/modelo-instancias-soberanas|modelo-instancias-soberanas]] ·
[[zonas-de-riesgo]]

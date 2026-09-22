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

`db/migrations/20260921_actualizaciones_instancia.sql:96-113` no confía en que
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

> [!danger] Y la PANTALLA pintaba VERDE en el primero de los dos — corregido el 22/09
> Con una imagen sin `RepoDigest`, la sonda escribe `comprobado_en = now()` y
> deja `digest_disponible` en `NULL`. Con eso `route.ts` calcula
> `hayNovedad = false` y `textoDeEstado()` caía en **«Al día»**, la única frase
> en verde que tiene la tarjeta. O sea: `update.sh --comprobar` saliendo con
> **1** cada cuarto de hora y la pantalla del dueño diciendo que todo está bien
> — el peor par posible, y justo en el estado que el ADR llama *bloqueo sin
> salida*.
>
> `actualizaciones-ui.ts` tiene ahora una rama explícita **antes** de la de «al
> día»: si hay `comprobadoEn` y **no** hay `digestDisponible`, tono `alerta` y
> una frase que dice que el actualizador no pudo leer el digest de la imagen y
> que hay que mirarlo. Con su prueba negativa, demostrada en rojo antes del
> arreglo.

El coste de este diseño —hasta 96 salidas con error al día mientras el problema
dure— está aceptado a conciencia y documentado en `infra/scripts/update.sh`
junto a la decisión. Ver la tarjeta humana, punto 7, para lo que falta medir de
este coste en la práctica.

> [!warning] Ese coste se aceptó llamándolo «96 correos», y por correo no llega nada
> *Corregido el 2026-09-22, revisión final de la rama.* **Cron manda correo por
> la SALIDA, no por el código de salida.** Las dos entradas de
> `/etc/cron.d/space-os-update` redirigen stdout y stderr a `cron.log`
> (`>> … 2>&1`) y el archivo no define `MAILTO`: sin salida no hay correo, para
> ningún código.
>
> **El comportamiento es el correcto y el aviso sí llega, por el panel de
> flota:** `reportar_a_flota` con `FLOTA_CODIGO` (`infra/scripts/update.sh:780-798`)
> corre en cada `salir()` y entrega el código al PADRE. Queda escrito, y no
> simplemente reescrito, porque **el dueño aceptó el coste describiéndolo como
> correos** y esa decisión tiene que poder revisarse sabiendo cuál es el canal
> de verdad. Si lo que se quería era un correo, hoy no existe: haría falta
> `MAILTO` y quitar la redirección, y eso es otra decisión.

## Dónde vive cada pieza

| Pieza | Archivo | Nota que la detalla |
|---|---|---|
| Tabla, grants | `db/migrations/20260921_actualizaciones_instancia.sql` | [[esquema]] · [[migraciones]] |
| Buzón (repo) | `apps/web/lib/server/actualizaciones-repo.ts` | [[infraestructura-servidor]] |
| Endpoint | `apps/web/app/api/actualizaciones/route.ts` (`GET`/`PATCH`, `administracion:ver`/`:aprobar`) | [[api-endpoints]] |
| Decisión pura | `scripts/actualizaciones.mjs` → `decidirActualizacion()`, con `scripts/actualizaciones.test.ts` | [[modelo-instancias-soberanas]] |
| Pantalla | `ActualizacionesPanel.tsx` (pinta) + `actualizaciones-ui.ts` (frase y tono, con pruebas — el `.tsx` no las tiene porque `vitest.config.ts` no monta jsdom) + `lib/data/actualizaciones-api.ts` (tipo y fetch, en `lib/data/` para no arrastrar `pg` al navegador) | [[modulos-internos]] |
| Actualizador | `infra/scripts/update.sh`, paso **2b** (entre comparar digest y respaldar), banderas `--comprobar` / sin bandera | [[entorno-y-despliegue]] |
| Cron | `infra/scripts/instalar-hijo.sh:886` y `infra/scripts/provision-instancia.sh:853` — misma línea, `*/15 * * * * root /opt/space-os/update.sh --comprobar …`, junto a la de las 04:17, no en su lugar | [[entorno-y-despliegue]] |
| Copia a la imagen | `Dockerfile:117`, `COPY scripts/actualizaciones.mjs` — **construido y comprobado el 22/09**: `docker build` en verde y `/app/scripts/actualizaciones.mjs` dentro del contenedor, con su `import()` devolviendo `decidirActualizacion` | [[entorno-y-despliegue]] |

## Lo que hay que hacer a mano, y que no se le puede pedir a este commit

Ninguna de las piezas de arriba se ha ejecutado contra un contenedor de
verdad — lo probado es que `update.sh` **obedece** la línea que recibe, no que
la línea se produzca sobre una base real. Y la migración **no puede
distinguir** una instancia nueva de una que lleva meses corriendo: nace en
`modo = 'aprobacion'`. **Esto todavía no es un problema hoy**: la migración
vive solo en esta rama —no en `main`—, así que DEMO y g500 corren sin la
tabla y siguen actualizándose como siempre. Los pasos completos, en orden de lo
que más duele si se olvida, están en la tarjeta humana:
`docs/evidencias/tarjeta-actualizaciones-elegidas.md`.

### El despliegue va por DOS vehículos, y el que importa no llega solo

*Encontrado el 2026-09-22, en la revisión final de la rama — mirando las siete
tareas juntas, no una a una.*

| Pieza | Vehículo | Cómo llega a una instancia que ya existe |
|---|---|---|
| Migración, aplicación, `scripts/actualizaciones.mjs` | **La imagen** | Sola, en la primera actualización que tome |
| **`update.sh`** | **El anfitrión** (`/opt/space-os/update.sh`) | **A mano.** Solo lo escriben `instalar-hijo.sh` y `provision-instancia.sh`, o sea altas y aprovisionamientos |

`update.sh` actualiza **el contenedor, no a sí mismo**. De ahí salen dos cosas
que hay que tener juntas en la cabeza:

- **El ADR no tiene ningún efecto hasta que alguien copie el `update.sh`
  nuevo.** El que corre hoy en DEMO y g500 es el de `main`, y su `case` rechaza
  lo desconocido: `--comprobar` le da **`exit 1`**. La línea de cron `*/15` de
  la tarjeta, puesta sin esa copia, sería `exit 1` **96 veces al día, para
  siempre**. Por eso la tarjeta tiene ahora un **paso 0** que va antes del cron,
  con su comprobación (`--help | grep -c comprobar`).
- **El congelamiento empieza con el `update.sh` nuevo, no con la migración.**
  La migración por sí sola no congela nada: el `update.sh` viejo **ni lee la
  tabla**. Este apartado y el paso 1 de la tarjeta decían lo contrario, y con
  eso la urgencia estaba atada al vehículo equivocado.

### La primera adopción nacía anunciando una novedad falsa — CERRADO el 22/09

*Medido en DEMO el 2026-09-22, la primera vez que el ADR corrió en un
servidor. Expediente: `docs/evidencias/adr0037-demo-20260922.md`.*

Tras actualizar, la fila quedó con `version_instalada` y `digest_instalado` en
**NULL**. Con eso `hayNovedad` (`apps/web/app/api/actualizaciones/route.ts:69`)
daba **verdadero**, y la pantalla del dueño anunciaba una `v0.6.0` disponible
**teniendo `v0.6.0` corriendo**. Y si alguien aprobaba esa novedad falsa, la
aprobación **no se consumía nunca** —la corrida siguiente sale por el corte de
«sin cambios», que está por encima del bloque de decisión— y la pantalla
prometía una instalación «en los próximos minutos» para siempre.

**No era un caso de borde: le pasaba a toda instancia que adoptara el ADR**, y
exactamente una vez, en la corrida de la adopción. La causa es que las dos
piezas llegan por vehículos distintos (el apartado de arriba):

1. `HAY_TABLA_ACTUALIZACIONES` se fija en el bloque **2b**, que corre **antes**
   de las migraciones.
2. La tabla la **crea** una migración que viaja **dentro de la imagen**, o sea
   después.
3. `marcar_instalado` solo corría si aquel flag valía 1 → en esa corrida, nunca.

**Cómo se cerró.** El marcado sigue yendo **después de la salud** —afirmar una
versión que la migración o la salud pudieran no haber dejado sirviendo es justo
lo que no se debe hacer— y el corte de «sin cambios» **no se tocó**. Lo que
cambia son dos cosas:

- `guion_instalado` pregunta por `to_regclass` **en la misma conexión** en la
  que escribiría, y contesta `INSTALADO sin-tabla` sin escribir nada si sigue
  sin haberla. No se sondea aparte: una segunda sonda sería otro contenedor
  efímero y otra ventana entre leer y escribir.
- Se llama a `marcar_instalado` también cuando **la base cambió en esta
  corrida** (`BASE_CAMBIO != no`), que es el único momento en que la tabla pudo
  aparecer.

Para una imagen anterior a esa migración **el resultado observable es el de
antes**: no se escribe nada, no se grita, y ningún código de salida cambia de
significado. Lo fijan **E148** (la tabla la crea la migración de esta corrida:
al cerrar sí se anota) y **E149** (si sigue sin existir, no se escribe nada y
no es un error) en `infra/scripts/pruebas-update.sh`, las dos **demostradas en
rojo** contra el código anterior.

### El fantasma permanente: el corte compara Id, la decisión compara digest

`update.sh` corta con «sin cambios» comparando el **Id** de la imagen; la
sonda, la pantalla y la aprobación del dueño comparan el **RepoDigest**. Si una
imagen cambia de RepoDigest sin cambiar de Id —un reetiquetado: le pasó a este
proyecto con `imagetools create` sobre `v0.1.0`, ver el aviso del 02/09 en
`CLAUDE.md`—, la sonda anota el digest nuevo, la pantalla ofrece *Instalar*, el
dueño aprueba… y **la aprobación no se consume nunca**, porque el corte sale
antes del bloque 2b. La pantalla diría «se instalará en los próximos minutos»
indefinidamente.

**No se arregló en esta ola a propósito**: ese corte está en el camino de todas
las corridas de toda la flota. Queda como **síntoma reconocible con remedio a
mano** en el paso 8 de la tarjeta (`update actualizaciones_instancia set
aprobado_digest = null;`), y como propuesta —refrescar `digest_instalado`
cuando el Id coincide— sin aplicar.

## Relacionadas
[[02-Backend/_indice|Índice de Backend]] · [[api-endpoints]] ·
[[infraestructura-servidor]] · [[modulos-internos]] · [[esquema]] ·
[[migraciones]] · [[entorno-y-despliegue]] ·
[[01-Arquitectura/modelo-instancias-soberanas|modelo-instancias-soberanas]] ·
[[zonas-de-riesgo]]

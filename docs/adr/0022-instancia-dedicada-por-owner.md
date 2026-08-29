# ADR 0022 — Una instancia dedicada por owner, y la RLS como defensa en profundidad

- **Fecha:** 2026-08-26
- **Estado:** Aceptada
- **Decide:** Emiliano
- **Relacionadas:** [ADR 0014](0014-postgres-en-el-droplet-o-base-administrada.md) ·
  [ADR 0015](0015-demo-dentro-del-padre.md) ·
  [ADR 0017](0017-todo-se-concentra-en-el-padre.md) ·
  [ADR 0019](0019-demo-arranca-con-systemd.md) ·
  [ADR 0021](0021-demo-space-os-io-se-queda.md) ·
  `docs/Plan_Instancias_Soberanas_v3.md` ·
  `vault/01-Arquitectura/modelo-instancias-soberanas.md`

> [!note] Sobre el número de este ADR
> El plan v3 pide esta decisión como «ADR 0014» y afirma que la última es la 0013
> (`docs/Plan_Instancias_Soberanas_v3.md:1948-1950`). **Eso era cierto el 13/08 y
> hoy no lo es:** entre el 14 y el 26 de agosto se escribieron de la 0014 a la
> 0021. Esta decisión es la **0022**. Ninguna 0014 se sobrescribió.

---

## Contexto

Hasta el 2026-08-12 el modelo era **una sola instalación multi-empresa**: un
proceso, una base, y las empresas separadas dentro por RLS de Postgres y un
subdominio por tenant. El diseño del 11/08 (`2026-08-11-subdominios-por-tenant-*`,
fuera del repo, archivado) llevaba esa idea hasta el final: parser de `Host`,
marca por subdominio, DNS y certificado comodín sobre `*.space-os.io`, y slugs
reservados por un `CHECK` en la base.

Ese modelo tenía dos problemas que no se arreglan con más código:

1. **El aislamiento dependía de no equivocarse.** Escribir `qRaw()` donde tocaba
   `q()` no da error: devuelve cero filas en silencio, o filas de otra empresa.
   Ya pasó dos veces en este repo, y una dejó el desbloqueo de usuarios
   inservible un despliegue entero.
2. **Un owner no puede comprobar su propio aislamiento.** «Estás en una fila de
   una base compartida, pero tranquilo» no es una promesa verificable desde
   fuera.

El 2026-08-12 se aprobó el modelo contrario, y el plan v3 lo convirtió en 46
tareas. Este ADR lo deja escrito donde el repo guarda las decisiones, después de
que las Fases 1 a 6 lo construyeran de verdad — no antes.

## Decisión

**Cada owner corre su propia instancia completa: su droplet, su base de datos y
su dominio de acceso. Un solo código para todas.**

- El aislamiento entre owners **es físico**: procesos, bases y máquinas
  distintas. No hay una consulta mal escrita capaz de cruzar de un owner a otro,
  porque no hay a dónde cruzar.
- **La RLS no se retira.** Cambia de papel: deja de ser el modelo de negocio y
  pasa a ser (a) **defensa en profundidad** dentro de cada instancia y (b) la
  puerta a que **un owner tenga varias unidades de negocio** dentro de la suya.
  Sigue siendo zona roja y sigue exigiendo `cd apps/web && npm run test:e2e`.
- El tenant se sigue resolviendo **desde la sesión**, no desde el `Host`
  (`apps/web/lib/server/tenant.ts:33`, `apps/web/lib/server/db.ts:40`). Esa
  parte del código no cambia con este ADR, y no debe cambiar.

### Cómo se ve eso en el repo, hoy

| Pieza | Dónde | Tarea |
|---|---|---|
| Alta de organización + Dueño en **una** transacción | `apps/web/lib/server/db.ts:123` (`withTxBootstrap`), consumido en `apps/web/lib/server/cuentas-controller.ts:65` | F5.1 |
| Arranque de una instancia vacía por HTTP, de un solo uso | `apps/web/app/api/bootstrap/route.ts` | F5.2 |
| Plantillas de configuración y de nginx por instancia | `infra/env/instancia.env.example`, `infra/nginx/instancia.conf.tpl` | F5.3 |
| Aprovisionamiento y su runbook | `infra/scripts/provision-instancia.sh`, `docs/runbook-alta-de-owner.md` | F5.4 |
| La instancia jala su versión sola | `infra/scripts/update.sh` + `/etc/cron.d/space-os-update` (`infra/scripts/provision-instancia.sh:359`) | F3.4 |
| El respaldo sale del droplet | `infra/scripts/respaldo.sh` | F3.7 |
| Qué versión corre una instancia | `apps/web/app/api/version/route.ts` | F6.1 |

## El vocabulario oficial

Se escribe aquí porque media docena de documentos ya usaron tres nombres
distintos para lo mismo.

| Término | Qué es |
|---|---|
| **PADRE** | La máquina de AS OOH: plano de control, panel de flota y sitio institucional. No sirve a ningún owner. Hoy es también donde vive DEMO ([ADR 0017](0017-todo-se-concentra-en-el-padre.md)) |
| **DEMO** | El banco de pruebas: segundo proceso dentro del PADRE, puerto 3001, base propia, arrancado por systemd ([ADR 0015](0015-demo-dentro-del-padre.md), [ADR 0019](0019-demo-arranca-con-systemd.md)). Toda tarea pasa por DEMO antes de tocar la instancia de un owner |
| **Instancia** | La copia completa de un owner: su droplet, su base y su dominio. Es lo que se le vende |
| **Flota** | El conjunto de instancias vivas. Se mira desde el panel del PADRE, que **no** viaja dentro de la imagen |
| **Canal** | `estable` o `beta`. Cada instancia está suscrita a uno y jala de él. Es la única palanca de «qué versión corre quién» |
| **Dominio de acceso** | La dirección por la que entra la gente del owner. En el código **ya existe** y se llama `APP_URL`: no se inventa una variable nueva |

> [!important] A un owner no se le dice «tenant»
> `tenant` es una palabra del código y de la base: la columna `tenant_id`, el
> GUC `app.tenant_id`, las políticas RLS. **Hacia fuera se dice «owner»** —el
> cliente que tiene su instancia— y «organización» o «unidad de negocio» para lo
> que hay dentro de ella. Confundirlos es lo que hizo que durante meses se
> llamara «instancia» a una fila.

## La regla que no admite excepciones

> **Nadie edita código en el servidor de una instancia.**
> Ni un `sed`, ni un `npm run build`, ni un `git pull`. Todo nace en el PADRE,
> se publica como imagen y la instancia **la jala**.

Es la restricción global 1 del plan v3
(`docs/Plan_Instancias_Soberanas_v3.md:212-213`), y de ella cuelgan las otras
dos que la sostienen: **el update es pull** —el padre no entra por SSH a
desplegar, salvo el aprovisionamiento inicial— y **el artefacto es idéntico**
para toda la flota; lo que cambia por owner vive en su base y su `.env`.

El motivo no es estético. Una instancia editada a mano deja de ser reproducible,
y con eso se pierde lo único que hace manejable una flota: que cualquier máquina
se pueda volver a levantar desde cero igual a como estaba. `deploy.yml` hacía
exactamente lo prohibido —`ssh` como `root`, `git checkout`, `npm run build`,
`pm2 reload`— y por eso se retiró en F3.6.

## Nota de infra: nombres reservados en la zona `space-os.io`

En la zona DNS `space-os.io` quedan **reservados** y no se le dan a nadie:

```
demo · beta · panel · releases · status · www
```

**Es una nota de operación, no un `CHECK` en la base.** El plan del 11 proponía
prohibir esos slugs en la tabla `tenants` porque el slug del tenant *era* su
subdominio. **Hoy el slug de un owner ya no es su URL**: su dominio de acceso lo
pone él en su propio DNS, y en la zona de AS OOH no aparece. Meter aquel `CHECK`
hoy, además, **habría abortado**: `demo` estaba en su lista de reservados y en
producción existe un tenant `demo-owner`
(`docs/Plan_Instancias_Soberanas_v3.md:191`).

## Alternativas descartadas

| Alternativa | Por qué se descarta |
|---|---|
| **Subdominios `*.space-os.io` con certificado comodín** (T9 del plan del 11) | Es la pieza central del modelo equivocado: obliga a que todos los owners vivan bajo un dominio de AS OOH, y hace de un solo certificado comodín el punto único de fallo de la flota entera. Lo que sobrevive es el **procedimiento** de certificado normal por HTTP-01 (`docs/runbook-dominio-https.md`), que F4.3 y F5.4 reutilizan con el dominio de cada owner. Un dominio propio, además, es la parte de «soberana» que el owner **puede comprobar**: el registro A lo pone él, en su zona |
| **Resolver la marca por `Host`** (T1 y T4 del plan del 11: `subdominioDe()`, `marca.ts`) | No hay nada que parsear. Una instancia = un owner = una marca, que sale de su `config_negocio`. Reconstruir un parser de `Host` obligaría a que `tenantActual()` aprendiera a leer la cabecera —restricción global 4— y devolvería al código la responsabilidad que este modelo acaba de quitarle. Y un parser de `Host` es superficie de ataque nueva a cambio de nada |
| **Candado de coherencia en `exigir()`** (T6 del plan del 11) | Era una comprobación en `apps/web/lib/server/auth.ts:159` para detectar que la sesión y el tenant de la petición no cuadraran. Tenía sentido cuando dos owners compartían proceso. Con aislamiento físico no hay incoherencia posible que detectar, y añadir un guard en la ruta por la que pasa **toda** petición autenticada es riesgo sin contrapartida. `exigir()` no se toca |
| **Mantener la base compartida y reforzar la RLS** | Es lo que se venía haciendo. Su modo de fallo no da error, ya costó dos incidentes, y **las pruebas unitarias no lo ven** porque simulan la base. Se puede endurecer indefinidamente y nunca se llega a poder demostrárselo a un cliente |

## Qué se promete cuando algo se rompe

> **Los números salen de los scripts, no de un deseo.** Cada fila cita dónde se
> mide. Lo que no se pudo medir va marcado `[SIN VERIFICAR]` en vez de
> rellenarse.
>
> **`infra/scripts/update.sh` se cita por texto y NO por número de línea, a
> propósito.** Mientras se escribía este ADR el archivo creció dos veces con la
> Fase 6, y las citas por línea quedaron falsas en cuestión de minutos —dos
> veces, medidas—. Una cita que manda al renglón equivocado es peor que ninguna:
> se busca el texto entrecomillado con `rg` y siempre acierta.

**Punto de partida, y hay que leerlo antes que la tabla:** la instancia se
actualiza sola una vez al día, a las **04:17**
(`infra/scripts/provision-instancia.sh:359`), y **el respaldo se hace en esa
corrida, solo si hay versión nueva** — si el digest de la imagen no cambió,
`update.sh` sale antes de tocar nada (`infra/scripts/update.sh`, guarda «sin cambios: la instancia ya corre»). O
sea: **no hay un respaldo diario garantizado.** Hay uno por actualización.

| Escenario | Cómo se sale | Tiempo hasta volver | Datos que se pierden |
|---|---|---|---|
| **Migración fallida** | **NO hay vuelta atrás automática.** `update.sh` sale con código 2, **no conmuta el tráfico** —la versión anterior sigue sirviendo— y **no restaura nada**: la base está viva y en uso, y restaurar por su cuenta tiraría lo escrito desde el dump (`infra/scripts/update.sh`, mensaje «ABORTADO (2): LA BASE CAMBIO … NO se restaura nada automaticamente estando la base viva y en uso»). Restaura una persona, con el respaldo que la propia corrida acaba de dejar | `[SIN VERIFICAR]` — depende de cuánto tarde una persona en mirarlo. **No hay corte mientras tanto: el owner sigue en la versión anterior** | Ninguno mientras nadie restaure. Si se restaura: lo escrito desde el respaldo de esa corrida |
| **Health check fallido tras conmutar** | **Sí es automática:** 10 intentos cada 3 s (`infra/scripts/update.sh`, `SALUD_INTENTOS:-10` y `SALUD_ESPERA:-3`) y, si no contesta 200, se vuelve al digest anterior y se restaura el dump previo. Códigos 4 (salió bien), 6 (hay servicio, pero la base no volvió a su huella) y 5 (no se pudo completar: urgente) | Corte de **~10-20 s** en el caso bueno y hasta **~3 min** en el malo (`infra/scripts/update.sh`, cabecera «LA VENTANA: durante la conmutacion la instancia NO responde») | Ninguno en el caso 4 |
| **Datos corrompidos por un bug** | Restauración manual del último respaldo, local o de Spaces | `[SIN VERIFICAR]` — no se ha cronometrado una restauración real | **Todo lo escrito desde la última actualización**, que puede ser mucho más de 24 h: los respaldos siguen a los releases, no al calendario |
| **El droplet desaparece** | Reaprovisionar con `infra/scripts/provision-instancia.sh` (F5.4) y restaurar de Spaces (F3.7) | `[SIN VERIFICAR]` — el script nunca se ha corrido contra un droplet real: F5.7 sigue bloqueada | Lo escrito desde el último respaldo **subido**. Retención: **3 dumps** en el disco de la instancia (`infra/scripts/respaldo.sh:87`) y **30 días** en Spaces por regla de ciclo de vida del bucket, que **no la aplica ningún script** y hay que configurarla en la cuenta (`infra/scripts/respaldo.sh:24-26`) |
| **El PADRE se cae** | Nada. Las instancias siguen operando solas | — | Ninguno. Solo se pierde el panel de flota y el alta de instancias nuevas |

**La última fila es la prueba del modelo.** Si el padre desaparece, ningún owner
se entera: ninguna instancia le pregunta nada para poder arrancar (restricción
global 14). **Si algún día deja de ser cierta, el modelo se rompió.**

> [!warning] La primera fila contradice al plan, y manda el código
> El plan v3 promete «rollback automático al respaldo previo (F3.4), 5–10 min,
> ningún dato perdido» para la migración fallida
> (`docs/Plan_Instancias_Soberanas_v3.md:1969`) y «rollback inmediato» en la
> tabla de reintentos de F3.8 (`docs/Plan_Instancias_Soberanas_v3.md:1184`).
> **`update.sh` hace deliberadamente lo contrario**, y su comentario dice por
> qué: restaurar sin que nadie mire, sobre una base viva, tira lo que se haya
> escrito desde el dump. Esta tabla describe **lo que el script hace**, no lo
> que el plan quería.

## Lo que este ADR NO decide

Se escribe aparte a propósito: rellenar los huecos por deducción es lo que costó
tres decisiones revertidas en cuatro días.

- **El nombre del registry de imágenes** (decisión TH-P4, plan §8.4). Sin él una
  instancia se aprovisiona pero **no hay imagen que instalar**: `update.sh` se
  para en el arranque si falta `REGISTRY` en su configuración
  (`infra/scripts/update.sh`, guarda «falta REGISTRY en $CONF»).
- **En qué cuenta de DigitalOcean nacen las instancias** (plan §8.3).
- **El destino del tenant `rgb` y del droplet de julio** (plan §8.1; F7.2 y F7.3
  siguen bloqueadas).
- **Qué máquina sirve `demo.space-os.io`.** Ese nombre **se queda** —es donde se
  enseña el producto como lo verá un owner,
  [ADR 0021](0021-demo-space-os-io-se-queda.md)— pero desde qué máquina lo hará
  no está decidido.

## Historia de la decisión

Los dos documentos del 2026-08-11 (`2026-08-11-subdominios-por-tenant-design.md`
y `...-plan.md`) **viven fuera del repo** y quedan como el contexto del error:
describen el modelo de base compartida con subdominio por tenant que este ADR
sustituye. No se ejecutan y no se borran. La corrección que los reemplaza es del
2026-08-12, y su desarrollo es `docs/Plan_Instancias_Soberanas_v3.md`.

## Cuándo revisar

Cuando exista la **primera instancia de un owner de pago**. Ahí se comprueban de
golpe las tres cosas que hoy están escritas y no medidas: que reaprovisionar
funciona, que restaurar de Spaces funciona, y que la caída del padre
efectivamente no se nota. Si alguna falla, se vuelve aquí antes que al plan.

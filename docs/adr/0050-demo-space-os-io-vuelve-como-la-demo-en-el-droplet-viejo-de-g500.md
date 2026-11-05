# ADR 0050 — `demo.space-os.io` vuelve: es la DEMO, servida por el droplet viejo de g500 y con una copia de sus datos

- **Fecha:** 2026-11-05
- **Estado:** Aceptada
- **Decide:** Emiliano (dueño), 2026-11-05, en tres tiempos: la máquina y el
  nombre por la mañana; **los datos**, por la tarde (P1–P10 de la guía 31); y
  **el material de la mudanza, las cuentas y el almacén de medios** (Q1–Q4)
- **Sustituye a:** [ADR 0024](0024-demo-space-os-io-es-la-demo-original-y-se-elimina.md)
- **Relacionadas:** [ADR 0015](0015-demo-dentro-del-padre.md) ·
  [ADR 0017](0017-todo-se-concentra-en-el-padre.md) ·
  [ADR 0021](0021-demo-space-os-io-se-queda.md) ·
  [ADR 0022](0022-instancia-dedicada-por-owner.md) ·
  [ADR 0023](0023-el-droplet-viejo-sale-del-modelo.md) ·
  [ADR 0037](0037-cada-instancia-elige-si-toma-la-version-nueva.md) ·
  guía `docs/evidencias/31-g500-viejo-como-demo-20261105.md` ·
  guía `docs/evidencias/30-mudar-g500-a-droplet-limpio-20261104.md`

> [!important] Esto REVIERTE el 0024, y lo dice a propósito
> El 0024 cerró el asunto con «no se vuelve a preguntar ni se vuelve a deducir».
> Este ADR no lo deduce: lo **decide el dueño** el 05/11, con hechos que el 0024
> no tenía (abajo). Lo que manda sobre el nombre es, desde hoy, **este**.

> [!danger] La DEMO lleva DATOS REALES DE UN CLIENTE — decidido a sabiendas
> La base de la DEMO es **la de g500 tal como quedó el 04/11** (organización,
> clientes, pantallas, propuestas, campañas, usuarios), y el disco conserva las
> fotos y el MySQL de Space Eyes de g500. El dueño lo eligió («dejar la
> información como está») frente a la alternativa recomendada de instalar de
> cero con datos sembrados. Los riesgos están escritos abajo y al principio de
> la guía 31.

---

## Contexto

El 0024 (27/08) decidió que `demo.space-os.io` era solo la demostración
**original** —la máquina de julio, `209.97.146.136`— y que se eliminaría. La
DEMO de verdad, el banco de pruebas de `beta`, quedó dentro del PADRE como
contenedor `space-os-demo` con el nombre `prueba.space-os.io`.

Desde entonces:

1. **Hay una máquina libre, del tamaño justo y ya pagada.** La mudanza del 04/11
   (guía 30) dejó a g500 en el droplet nuevo `gh500` y el viejo
   (`142.93.113.106`, NYC1, 2 GB) **apagado e intacto**, seguro de encender
   (D13 de esa guía).
2. **La DEMO dentro del PADRE arrastra tres defectos conocidos**
   (`vault/01-Arquitectura/entorno-y-despliegue.md`): comparte máquina, roles y
   directorio de respaldos con el PADRE (por eso cada guion necesita
   `SPACE_OS_CONF` delante); **su certificado no se renueva y caduca el
   2026-11-29**, y con él caducado `promover.yml` no puede hacer su smoke; y no se
   parece a la instalación de un owner.
3. **Ese disco es la única otra copia de Space Eyes de g500**, que no tiene
   respaldo fuera del droplet (guía 30 §7). Borrarlo para instalar de cero la
   habría perdido.

## Decisión

1. **El droplet viejo de g500 pasa a ser la DEMO**, con el nombre
   **`demo.space-os.io`** (registro A a `142.93.113.106`, nube gris, certificado
   propio emitido en esa máquina).
2. **Se conservan los datos de g500 tal cual**: la base `spaces`, los volúmenes y
   fotos de Space Eyes. **No se reinstala ni se vacía el disco**, y no hace falta
   instantánea: el propio droplet es la copia.
3. **Lo que se quita es la IDENTIDAD de g500** y todo lo que podría actuar en su
   nombre: `INSTANCIA=g500`, `FLOTA_TOKEN`, las credenciales de Spaces y el
   prefijo `g500/` (el respaldo pasa a `demo/`), la clave real de DOOHmain, Google,
   Resend, Maps, las claves de los roles de Postgres (se rotan), el certificado de
   `g500.space-os.io`, el cron apartado en la mudanza y el material de
   La guía 31 lo comprueba con `grep` de los valores sin imprimirlos.
   **Excepciones decididas (Q1, Q3):** `/root/g500-mudanza/` (base en claro y
   `config.tgz` con todos los secretos de g500) **se deja como está**, y la DEMO
   **usa el almacén de medios real de g500** (sus `DO_SPACES_*`, copiadas al
   `app.env` nuevo).
4. **La instancia pasa de `g500` a `demo` sobre la misma base**: `instancia.env` y
   `app.env` nuevos (escritos con las mismas funciones que el alta,
   `infra/scripts/entorno-instancia.sh`), `CANAL=beta`, nginx de
   `instancia.conf.tpl`, `modo = automatica` en `actualizaciones_instancia`, y
   `update.sh` la lleva de la v0.12.5 (donde quedó g500 el 04/11) a la `beta`
   vigente, con respaldo previo.
5. **Space Eyes no se sirve en la DEMO**: sus contenedores quedan **parados y sin
   borrar**, con su configuración apartada, como copia.
6. **Las cuentas de g500 siguen activas** en la DEMO (Q2); solo se recomienda
   cerrar las sesiones abiertas y los enlaces pendientes de restablecer
   contraseña. No hay usuario de demostración aparte.
7. **Los respaldos de la DEMO van con una llave de Spaces NUEVA** (Q4), al
   prefijo `demo/`.
8. **Sin DOOHmain** (`DOOHMAIN_PUBLISH_ENABLED=0` y sin clave), **sin correo**
   (sin Resend), **sin Google**: la DEMO no publica en pantallas reales ni escribe
   a los clientes de g500. Español y MXN (los de g500).
9. **`DEMO_URL` pasa a `https://demo.space-os.io/spaces-dooh`** y el secreto
   `FLOTA_TOKEN` de GitHub al de la DEMO nueva, cuando esta corra la versión que
   se vaya a promover. La v0.12.6 se promueve el 05/11 aún con la del PADRE.
10. **`prueba.space-os.io` y `space-os-demo` del PADRE se mantienen hasta la
   primera promoción validada contra la nueva**, y luego se apagan (reversible,
   guía 31 §8).

### Lo que esto retira del 0024

| | El 0024 decía | Ahora |
|---|---|---|
| `demo.space-os.io` | Demostración original; se eliminará | **Es la DEMO** (banco de pruebas `beta`) |
| Máquina | La de julio, hasta eliminarlo | El droplet viejo de g500 |
| Certificado | No se renueva ni se reemite | Se emite y se renueva en esa máquina |
| `F4.3` | Sin objeto | Sigue sin objeto como tarea del plan v3 (pedía DEMO dentro del PADRE) |

## Alternativas consideradas

### A · Instalar de cero (*Rebuild*) con datos de demostración sembrados

Era la recomendación de la primera versión de la guía 31: ningún dato de cliente
en una dirección pública y ninguna lista de borrado que acertar. **El dueño la
descartó**: perdía la única otra copia de Space Eyes de g500, y prefiere enseñar
el producto con datos reales.

### B · Dejar la DEMO en el PADRE y darle certificado propio a `prueba.`

Arregla el plazo del 29/11, pero deja los otros dos defectos. Descartada.

### C · Un droplet nuevo para la DEMO

Mismo resultado con otra factura, y sin conservar la copia. Descartada.

## Consecuencias

### Positivas

- La DEMO **se parece a una instancia de owner** (su `instancia.env`, nginx de la
  plantilla, `update.sh` por cron) y además **con datos de verdad**: cada `beta`
  se ensaya sobre una base con historia real, que es donde fallan las migraciones.
- Desaparece `SPACE_OS_CONF` de las guías de publicación en cuanto se retire la
  DEMO del PADRE.
- El plazo del 29/11 deja de bloquear las promociones.
- Se conserva la copia de Space Eyes de g500 sin pagar una instantánea.

### Negativas

- **La DEMO deja de ser copia fiel de g500 en cuanto diverjan**: la primera
  migración de `beta` que g500 aún no tenga, o lo que alguien cree en la DEMO, la
  separa. Es una copia **al 04/11**, no un espejo.
- **Una máquina más que mantener** (la que ya se pagaba apagada).
- **Dos DEMO** mientras dure la transición.

### Implicaciones de seguridad

- **Datos reales de un cliente en una dirección pública de demostración.**
  Cualquiera que entre a la DEMO ve clientes, importes y contratos de g500.
- **Las cuentas de las personas de g500 siguen existiendo en la DEMO con sus
  contraseñas.** Quien conozca la suya entra. La guía 31 propone, como paso
  opcional, desactivarlas y crear un usuario de demostración; el Dueño con
  `solo_google` no puede entrar porque la DEMO no tiene Google.
- **Las ligas públicas que g500 ya mandó** (`/p/<token>`, portal) **funcionan
  también en `demo.space-os.io`**: el token vive en la base, no en el dominio.
- **La llave de respaldos de la DEMO (nueva) alcanza el bucket entero**, también el
  prefijo `g500/`: Spaces limita por bucket, no por prefijo (`instancia.env.example`,
  bloque de respaldos). El prefijo `demo/` separa por convención, no por permiso.
- **La base y los secretos de g500 en claro siguen en el disco de la DEMO**
  (`/root/g500-mudanza/`, Q1): quien llegue a root en la DEMO tiene la identidad
  completa de g500 (`FLOTA_TOKEN`, Spaces, DOOHmain, Google, Resend), aunque la
  DEMO ya no la use.
- **La DEMO comparte el almacén de medios real de g500** (Q3) y **cada `beta` se
  instala sola** sobre ella. En v0.12.6 el código **no borra ningún archivo**
  (`apps/web/lib/server/storage.ts:2` solo importa `PutObjectCommand` y
  `GetObjectCommand`; es el único cliente del almacén) y **escribe** solo al
  cerrar una OT con foto (`apps/web/lib/server/ot-repo.ts:309-311`,
  `evidencias/<id OT>/<ms>.jpg`, sin pisar nada). Una versión futura que añada un
  borrado lo ejecutaría desde la DEMO contra los archivos reales de g500: toda
  versión que toque `storage.ts` se mira con esto delante.
- **La IP `142.93.113.106` fue de g500**: cualquier lista de IP permitidas que la
  conserve (Google, DOOHmain) se revisa en la guía 31 §2.1.
- **Ningún secreto de g500 queda en uso**: claves de Postgres rotadas, tokens
  nuevos, sin credenciales de terceros de g500. Lo que **sí** queda en disco, a
  propósito y apartado, son los secretos internos de la pila de Space Eyes (la
  copia).

## Cómo revertir

- **Antes de cambiar `DEMO_URL`**: no usar la DEMO nueva; nada más depende de ella.
- **Después**: `DEMO_URL` y `FLOTA_TOKEN` de vuelta a la DEMO del PADRE (si sigue
  viva), y el A de `demo` retirado.
- **Quitar los datos de g500 de la DEMO** es siempre posible después (guía 31 §8.4:
  instalar de cero con semillas), pero solo tras resolver otra copia de Space Eyes.

## Cuándo revisar

Tras la **primera promoción a `estable` validada contra la DEMO nueva** (destino
de `prueba.`), y **cuando Space Eyes tenga respaldo fuera del droplet**: en ese
momento desaparece la razón principal para mantener datos reales en la DEMO.

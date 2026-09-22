---
tipo: operacion
estado: verificado
actualizado: 2026-09-22
tags: [operacion, respaldo, instancias, cron, spaces]
archivos:
  - infra/scripts/respaldo-diario.sh
  - infra/scripts/conexion-pg.sh
  - infra/scripts/pruebas-respaldo-diario.sh
  - infra/scripts/respaldo.sh
  - infra/scripts/update.sh
---

# Respaldo diario de una instancia

> [!danger] Lo que esta nota viene a arreglar, medido el 2026-09-22
> **g500 —la única instancia con datos reales de cliente— se respaldaba fuera de
> su droplet ÚNICAMENTE cuando se desplegaba una versión nueva.**
>
> No era un olvido de configuración: es **dónde vive el dump**. `update.sh`
> respalda en su paso 3 (`update.sh:2333`) y a ese paso solo se llega si hay
> imagen nueva — las corridas `sin cambios` salen antes. Como `estable` no se
> movía desde el 17/09, la copia remota más reciente tenía **cinco días** y la
> había subido una persona a mano.
>
> La regla real era «la frecuencia de tus respaldos la decide el ritmo de los
> releases», que nadie habría escrito a propósito.
> Evidencia: `docs/evidencias/11-g500-sin-respaldo-programado.md`.

## Los dos respaldos, que son cosas distintas y conviven

Confundirlos es el error de lectura que dejó el agujero abierto tanto tiempo.

| | `update.sh`, paso 3 | `respaldo-diario.sh` |
|---|---|---|
| **Cuándo** | antes de migrar, **solo si hay versión nueva** | **por reloj**, todos los días |
| **Para qué** | deshacer un release malo | sobrevivir a la pérdida del droplet |
| **Si falla la subida** | el update **sigue** | el guion **sale != 0** |
| **Log** | `/var/log/space-os/update.log` | `/var/log/space-os/respaldo-diario.log` |

Los dos escriben `spaces_AAAAMMDD_HHMMSS.dump` en el mismo directorio y con
`--format=custom`, **y eso es un requisito, no una coincidencia**: la poda de
`respaldo.sh` busca `spaces_*.dump`, y la vuelta atrás de un release restaura con
`pg_restore`. Dos convenciones distintas dejarían dos montones de respaldos que
ni se podan ni se restauran entre sí.

## Qué hace, en orden

1. Lee `$SPACE_OS_CONF` (por omisión `/etc/space-os/instancia.env`) y saca
   `DATABASE_URL`; si no está ahí, cae a `/etc/space-os/app.env`.
2. Deriva la conexión con `pg_derivar_conexion` — **la contraseña no pasa por
   `argv`**.
3. `pg_dump --format=custom` al directorio de respaldos.
4. **Guard del archivo vacío**: si el dump falla o sale de 0 bytes, lo **borra**
   y aborta **sin subir nada**.
5. Poda local (deja `RESPALDOS_LOCALES`, 3 por omisión).
6. Sube al bucket con `respaldo_remoto_subir` de `respaldo.sh`.

### Los códigos de salida

| | |
|---|---|
| `0` | respaldo hecho (y subido, si hay credenciales) |
| `1` | configuración: falta el archivo, falta o no se entiende `DATABASE_URL` |
| `4` | **BACKUP VACÍO** — no se subió nada |
| `5` | el dump está bien pero **no salió del droplet**. El archivo local se conserva |

## Las tres decisiones que valen la pena

### 1 · Una subida fallida SÍ es un fallo aquí

`update.sh` se traga el fallo de subida a propósito: el respaldo local basta para
la vuelta atrás y no actualizar es peor. **Este guion hace lo contrario y sale con
5.** Sacar los datos del droplet es lo único que hace; si saliera con 0, el cron
lo daría por bueno todas las noches y volveríamos al agujero de arriba — con un
guion llamado «respaldo diario» diciendo que todo va bien.

**El dump local no se borra nunca por una subida fallida.** Es lo único que queda
de esos datos fuera de la base.

### 2 · Sin credenciales de Spaces NO es un error

Decisión del dueño (22/09): **el respaldo diario es de TODAS las instancias**, no
solo de las que tienen datos reales. DEMO hoy no tiene `SPACES_KEY`/`SPACES_SECRET`,
así que hace su dump local, poda, **lo dice** y sale con 0. El criterio no se
inventó aquí: es el que ya usa `respaldo.sh:229-232`.

### 3 · `SPACE_OS_CONF` manda — hay DOS montajes

| Instancia | Configuración | Base |
|---|---|---|
| **g500** | `/etc/space-os/instancia.env` (estándar) | `spaces` |
| **DEMO** | `SPACE_OS_CONF=/etc/space-os/demo-instancia.env`, dentro del PADRE | `spaces_demo` |

Un guion que ignorara `SPACE_OS_CONF` **respaldaría la base equivocada en el PADRE
sin dar ningún error**, porque las dos existen en esa máquina. Lo fija el
escenario R9 del arnés.

> [!danger] La deuda que queda abierta: hay DOS copias de la derivación
> `infra/scripts/conexion-pg.sh` duplica **letra por letra** seis funciones que
> viven también dentro de `update.sh` (su `:1381-1737`): `env_de_parametro`,
> `clasificar_consulta`, `partir_url`, `destino_de_url`, `decodificar_porciento`
> y `correr_pg`.
>
> **Por qué se duplicó**, y los tres caminos medidos:
> 1. **Sourcear `update.sh`** — imposible: no tiene guarda `BASH_SOURCE`
>    (`respaldo.sh:330` sí la tiene), así que sourcearlo **ejecuta un update
>    entero** desde su `set -Eeuo pipefail` de `:427`.
> 2. **Extraer y que `update.sh` lo sourcee** — es el final bueno, y **no se
>    podía hacer hoy**: está desplegado en g500 y en DEMO, y `pruebas-update.sh`
>    tarda **15 minutos**. Ese cambio lo hace quien pueda correr ese arnés entero.
> 3. **Copiar** — lo que hay.
>
> **La deuda no es silenciosa:** el escenario **R7** compara las dos copias letra
> por letra y se pone rojo si divergen. Comprobado que muerde.
>
> Lo que R7 **no** cubre: `pg_derivar_conexion`, que en `update.sh` es código
> suelto (`:1644-1713`) y no una función. Es una adaptación a mano.

## Cómo se prueba

```
bash infra/scripts/pruebas-respaldo-diario.sh
```

**16 escenarios · 61 comprobaciones · 0 fallos**, en **15 segundos** (medido el
22/09). No sale a la red, no toca ninguna base y no toca ningún servidor: dobla
`pg_dump`, `s3cmd` y `hostname`.

Que tarde segundos es deliberado: `pruebas-update.sh` tarda 15 minutos y un arnés
que nadie corre no defiende nada.

Muerden, comprobado con cinco mutantes el 22/09: quitar el guard de 0 bytes (R2),
salir 0 con la subida fallida (R4), ignorar `SPACE_OS_CONF` (R1/R9), volver a
`--dbname="$DATABASE_URL"` (R6 dice literalmente *«la contrasena aparece en el
argv»*) y tocar una sola copia de la derivación (R7).

> [!danger] Un dump es la base entera, y nacía legible por todo el droplet
> Encontrado al revisar este cambio el **22/09**. Nadie ponía permisos al
> directorio de respaldos: `update.sh:2332` hace `mkdir -p` a secas y, con el
> umask 022 de root, eso deja el directorio en **0755** y cada dump en **0644**.
> Un dump no tiene RLS, ni tenant, ni sesión: es la base completa, en claro,
> legible por cualquier usuario local del droplet — incluido el que corre la
> aplicación.
>
> `respaldo-diario.sh` lo cierra **para los archivos que crea él**: `umask 077`,
> `chmod 700` al directorio y `chmod 600` al dump.
>
> **`update.sh` sigue con el fallo**, porque no se toca (está desplegado). Sus
> dumps siguen naciendo 0644, y los que ya existen en g500 también. Cerrarlo es
> un `chmod` de una línea más un cambio en `update.sh` que exige su arnés de 15
> minutos.
>
> ⚠️ **Y no se puede probar en la máquina de desarrollo**: en Git Bash sobre
> Windows `umask` y `chmod` no se reflejan en `stat` (medido: 644 y 755 pase lo
> que pase), así que una prueba de permisos daría verde con el guion roto. El
> arnés comprueba que las líneas existen (**R10**); la comprobación real está en
> el paso **A2b** de la tarjeta 12, contra el droplet.

## Lo que este guion NO hace

- **No borra nada en el bucket.** La retención remota (30 días) es regla de ciclo
  de vida de la cuenta. Ver la cabecera de `respaldo.sh`.
- **No toma candado** — y el primer borrador justificaba esto con algo **falso**
  («un candado mal soltado dejaría la instancia sin respaldos para siempre»). Con
  `flock` eso no ocurre: lo tiene el núcleo y se suelta cuando el proceso muere.
  `update.sh` toma uno así (`update.sh:817`, `flock -n -E 75`) y además **exige**
  el binario, así que en estas máquinas `flock` existe.

  El motivo real es más flojo: este guion tiene **una sola** vía de entrada (una
  línea de cron al día) frente a las **dos** de `update.sh` —la de las 4:17 y el
  `--comprobar` cada 15 min, que son las que se pisan—, y el dump tarda segundos.

  > [!warning] Hueco conocido, y barato de cerrar
  > Si el dump se acerca a durar lo que el hueco entre corridas, o si alguien
  > añade una segunda línea de cron, **hay que tomar el candado**. El patrón ya
  > está escrito al lado, en `update.sh:802-818`.

> [!warning] Nada de esto está instalado todavía
> El guion existe y está probado **en la máquina de desarrollo**. La línea de
> cron va en `docs/evidencias/12-instalar-respaldo-diario.txt` y **la corre una
> persona**: dos bloques, uno por montaje, porque la línea de DEMO lleva
> `SPACE_OS_CONF` delante y la de g500 no.
>
> Hora elegida: **`41 3`**, ni a las 4:17 (`update.sh`) ni pegada a ella.

Ver también: [[06-Operacion/restaurar-un-respaldo-en-local]] ·
[[01-Arquitectura/entorno-y-despliegue]] · [[06-Operacion/zonas-de-riesgo]]

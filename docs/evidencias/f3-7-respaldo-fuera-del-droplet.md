# F3.7 · El respaldo sale del droplet — **CERRADA con una limitación**

**Fecha:** 2026-08-28 · **Máquina:** PADRE `137.184.107.53` · **Lo corrió:** Emiliano
**Tarjeta:** `docs/evidencias/padre-respaldo-F3.7.txt`
Plan de autoridad: `docs/Plan_Instancias_Soberanas_v3.md` §F3.7 (`:1131-1170`)

> [!important] Qué queda cerrado y qué no
> **El criterio de aceptación se cumple entero**: el respaldo sobrevive a la
> muerte del droplet, y una subida fallida no detiene nada pero tampoco pasa
> desapercibida. **La retención de 30 días NO se pudo poner** — ver §4. Es una
> limitación de DigitalOcean, no del código, y no afecta al criterio.

---

## 1 · El criterio, y su evidencia

El plan pide dos cosas (`:1158-1160`). Las dos, medidas:

### ① «Si el droplet desaparece, el último respaldo sigue existiendo fuera de él»

```
$ respaldo.sh subir …/spaces_20260828_153558.dump
2026-08-28 22:56:27+0000  respaldo remoto -> s3://space-os-respaldos/padre/2026-08-28-2256.dump (por s3cmd)
upload: … (390596 bytes in 0.5 seconds, 733.68 KB/s) [1 of 1]
2026-08-28 22:56:28+0000  respaldo remoto OK

$ s3cmd ls s3://space-os-respaldos/padre/
2026-08-28 21:03    390596   s3://space-os-respaldos/padre/2026-08-28-2103.dump
```

### ② «Una subida fallida NO detiene la actualización, pero NO pasa desapercibida»

Son **dos casos distintos**, y que el script los distinga es lo que hace útil su
log. Si dijeran lo mismo, nadie sabría si hay que arreglar una llave o si esa
instancia simplemente no tiene respaldo remoto.

| Caso | Salida | Código |
|---|---|---|
| **Configurado y falló** (secreto malo) | `ERROR: S3 error: 403 (SignatureDoesNotMatch)` | **77** |
| **No configurado** (sin credenciales) | `respaldo remoto NO CONFIGURADO: faltan SPACES_KEY/SPACES_SECRET. Esta instancia NO tiene respaldo fuera del droplet: si la maquina desaparece, el dump desaparece con ella.` | **0** |

**El `0` del segundo es la decisión, no un descuido.** Una instancia sin respaldo
remoto configurado no debe abortar su actualización por ello: el respaldo local
existe y basta para la vuelta atrás. Lo que no puede es callárselo.

### ③ La poda local

```
$ respaldo.sh podar /var/lib/space-os/respaldos 3
$ ls -1 …/*.dump | wc -l   ->   1
```

Con menos de 3 no borra nada, que es lo correcto.

---

## 2 · Cómo quedó montado

| | |
|---|---|
| Bucket | `space-os-respaldos` · **`sfo3`** · Standard |
| CDN | deshabilitado |
| File Listing | restringido |
| Cliente | `s3cmd 2.4.0`, de los repos de Ubuntu |
| Credenciales | `/etc/space-os/instancia.env`, **0600 root** |
| Llave | `padre-respaldos`, **acotada al bucket**, Read/Write/Delete |
| Ruta remota | `s3://space-os-respaldos/<instancia>/<AAAA-MM-DD-HHMM>.dump` |

**La región es `sfo3` y el droplet está en `nyc1`.** Se decidió dejarlo: el
nombre de un bucket es único en todo DigitalOcean y su borrado no es inmediato,
así que mover la región costaba borrar, esperar un plazo ajeno y recrear — a
cambio de unos segundos por respaldo. **Consecuencia permanente:
`SPACES_REGION=sfo3` va explícito**, porque el valor por omisión del script es
`nyc3` y con él la subida falla por endpoint erróneo.

> **El secreto nunca se escribió en la línea de comandos.** Se leyó con
> `read -rs` y solo se comprobó su longitud, así que no quedó en
> `~/.bash_history`. La tarjeta original usaba un heredoc, que sí lo habría
> dejado ahí.

---

## 3 · El 403, que fueron TRES causas encadenadas

Vale escribirlo entero: cada una parecía la anterior, y perseguir la equivocada
costó la mayor parte de la sesión.

| # | Síntoma | Causa real |
|---|---|---|
| 1 | `403 AccessDenied` al subir, `ls` funcionaba | La llave era **Read**, no Read/Write |
| 2 | `403 SignatureDoesNotMatch` | Se pegó el **`Access Key Name`** (`padre-respaldos`, 15 caracteres) donde iba el **`Access Key ID`** |
| 3 | `403 InvalidAccessKeyId` | Se **borró la llave del servidor** creyendo que era la temporal |

**Lo que separó cada capa fue siempre el mismo aislamiento:** probar si la llave
puede **leer** (`ls`) antes de mirar por qué no puede **escribir**. Con `ls` en
`[0]`, quedan descartados de golpe la región, el endpoint, el alcance y que la
llave esté cortada — y solo queda el permiso.

**Y la comprobación de longitudes vale su peso:**

```
$ awk -F= '/^SPACES_KEY=/{print length($2)} /^SPACES_SECRET=/{print length($2)}'
clave: 20    secreto: 43
```

DigitalOcean da 20 y 43. Un `15` delató el nombre pegado por error sin necesidad
de mirar el valor.

> [!warning] Pegar en un prompt oculto falla en silencio en la consola web
> `read -rsp` no siempre recibe el pegado en la consola de DigitalOcean, y como
> no muestra nada, **parece que sí lo tomó**. El resultado es un secreto vacío
> que se manifiesta después como `SignatureDoesNotMatch` — un error que manda a
> mirar la llave y no el pegado. Comprobar la longitud lo caza al momento.

### Y una lección que no es técnica

**Nunca se borra la credencial que funciona hasta que la nueva haya funcionado.**
Se borró `padre-respaldos` para limpiar, y el PADRE se quedó sin poder subir
nada. No se notó en el momento: se notó al probar. Si hubiera pasado sin probar,
lo habría descubierto un `update.sh` dentro de semanas, en el peor momento.

---

## 4 · La retención de 30 días — NO se pudo poner

**Y el código está bien: es una limitación de DigitalOcean.**

`respaldo.sh` **no borra nada en el bucket, a propósito** — un `rm` mal escrito
en un script que corre en todas las instancias es una forma elegante de perderlo
todo a la vez. La retención remota la hace el bucket.

**El panel no ofrece reglas de ciclo de vida.** Comprobado el 28/08: Settings
trae *Object Versioning*, *Access Logs*, *File Listing*, *CDN*, *CORS*, *Access
Keys* y *Delete*. Lifecycle no.

**Y por la API de S3 tampoco.** Tres intentos, tres llaves, mismo error:

| Llave | Alcance | `s3cmd expire` |
|---|---|---|
| `padre-respaldos` | acotada, Read/Write | `403 AccessDenied` |
| `temporal-lifecycle` | acotada, Full Access sobre el bucket | `403 AccessDenied` |
| la tercera | acotada, Read/Write/Delete | `403 AccessDenied` |

**Configurar el ciclo de vida es una operación sobre el BUCKET, no sobre sus
objetos**, y DigitalOcean no se la concede a una llave de Spaces acotada aunque
tenga Full Access sobre él.

### Qué queda pendiente, y cuánto corre prisa

El camino que no se probó es la **API de DigitalOcean con un token de cuenta**,
que es otra credencial y otro cliente (`doctl` o `curl`). Queda como tarea.

**No corre prisa, y conviene decir por qué en vez de dejarlo en «pendiente»:**
los dumps son de **380 KB**. Aunque el PADRE se actualizara a diario, tardaría
años en acumular algo que se note en la factura. **El día que importe es cuando
haya instancias con datos de verdad**, y para entonces esta decisión ya se habrá
tomado con el bucket-por-instancia (§5).

---

## 5 · Lo que sigue pendiente de decidir

**Una llave por instancia con permiso solo sobre su prefijo** —lo que pide el
plan (`:1148-1150`)— **no se puede hacer con Spaces**: sus llaves se limitan por
bucket, no por prefijo.

Se arrancó con un **bucket compartido**, y hoy eso no protege de nada porque hay
una sola instancia. **Disparador escrito: se decide antes del primer owner
(F5.7).** La salida conocida es un bucket por instancia — ahí una llave con
alcance de bucket **sí** es una llave por instancia.

**Riesgo aceptado, no tarea:** la llave del PADRE tiene **Delete**, y
`respaldo.sh` nunca borra en el bucket. Si DigitalOcean ofreciera Read/Write sin
Delete sería preferible: quien robe esa llave hoy puede **destruir** los
respaldos, no solo leerlos. Se acepta porque el panel no ofrece un nivel
intermedio.

---

## 6 · Un chequeo que no medía lo que decía medir — la tercera vez hoy

La prueba del caso «no configurado» **pasó en falso la primera vez**: subió el
archivo y salió `0`. El motivo es que un `set -a; . instancia.env; set +a`
anterior había dejado `SPACES_KEY` y `SPACES_SECRET` **exportadas en esa shell**,
y anteponer `INSTANCIA=` y `SPACES_BUCKET=` no las quita.

Se rehízo con `env -u SPACES_KEY -u SPACES_SECRET`, y entonces sí midió lo que
afirmaba.

> **Habría entrado en este expediente como prueba superada.** Es la tercera vez
> en dos días: el `grep -c clientes` que dio 1 con el sistema correcto, la prueba
> de tipografía que se puso roja por sus propios comentarios, y esta.
>
> **Un chequeo que no mide exactamente lo que dice medir es tan inútil en verde
> como en rojo** — y en verde es peor, porque nadie lo mira dos veces.

---

## 7 · Dónde queda la Fase 3

**8 de 9.** Solo `F3.5` (ensayo completo en DEMO) y `F3.6` (retirar el despliegue
por SSH) siguen esperando el registry.

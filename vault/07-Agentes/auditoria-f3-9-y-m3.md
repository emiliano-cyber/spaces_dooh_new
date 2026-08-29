---
tipo: operacion
estado: verificado
actualizado: 2026-08-20
tags: [instancias, auditoria, credenciales, log, fase-3, rojo]
archivos:
  - infra/scripts/update.sh
  - infra/scripts/respaldo.sh
  - infra/scripts/pruebas-update.sh
  - infra/scripts/README.md
  - docs/Plan_Instancias_Soberanas_v3.md
---

# Auditoría de F3.9 y M3 — 2026-08-20

> [!important] La auditoría que faltaba desde el 19/08
> [[ejecucion-plan-v3]] dejaba la fila de F3.9 en **«CICLO 3 HECHO, SIN
> AUDITAR»**: dos commits de código **sin confirmar** sobre `update.sh`, el
> archivo del que este proyecto dice, literalmente, que *«las tres veces
> anteriores que se dio por bueno, la auditoría encontró algo»*.
>
> | Commit | Qué es | Estado antes de hoy |
> |---|---|---|
> | `a490dd3` | Ciclo 3 de F3.9 — la clave también viajaba en la consulta | Solo el informe de **su propio ejecutor** (`2c3ca53`) |
> | `32042e5` | **M3** — la conexión deja de viajar como URL | Sin auditar, por decisión de parar ahí |
>
> Sesión aparte del ejecutor, como manda el modelo. **Solo lectura sobre el
> repositorio: no se corrió ni un comando contra ningún servidor, ninguna base
> real ni el bucket.** Y no se corrigió nada — auditar y remediar son sesiones
> distintas a propósito.

## Veredicto

🔴 **ROJO por UN hallazgo.** Todo lo demás que se midió salió **VERDE**, y se
midió más de lo que el arnés cubre.

El hallazgo cae por el **criterio M2 del 19/08** —*«cualquier fragmento de
credencial que salga de la instancia es INVALIDANTE»*, [[2026-08-19]]—, que es
el criterio que este mismo proyecto escribió para no tener que improvisar la
clasificación. La atenuante está medida y va abajo: **la exposición real es
estrecha.** Si eso baja el color es decisión de Jochelo, no de esta auditoría.

---

## 🔴 El hallazgo · `update.sh:891` publica la contraseña en el log que sale del droplet

Cuando el `=` que separa un parámetro de la consulta va **percent-encoded**,
nombre y valor se funden en un solo token, y el mensaje de error del update
**imprime ese token entero** en `update-publicable.log` — que es exactamente el
archivo que F3.9 sube al bucket.

El código dice de sí mismo, en `update.sh:889`:

> `# El mensaje nombra el PARAMETRO, nunca su valor.`

Es cierto **mientras haya separador**. Cuando no lo hay, el parámetro *es* el
valor.

### Medido, no deducido

Con el arnés real y sus dobles — `update.sh` sin tocar, y una copia del arnés
recortada solo para poder ejecutar un escenario suelto:

| `DATABASE_URL` | salida | ¿el secreto en `argv`? | ¿el secreto en lo que **sube al bucket**? |
|---|---|---|---|
| `…/spaces?password%3DSEC1` | 1 | limpio | 🔴 **SÍ** |
| `…/spaces?sslpassword%3DSEC3` | 1 | limpio | 🔴 **SÍ** |
| `…/spaces?password=SEC2` *(contrafactual)* | 0 | limpio | limpio |
| `…/spaces?raro=SEC4` *(parámetro raro, con `=`)* | 1 | limpio | limpio — solo viaja el nombre `raro` |
| `postgresql://spaces:SEC5@…` *(el caso normal)* | 0 | limpio | limpio |

Las dos filas limpias de abajo son las que enseñan que **el diseño es correcto y
lo que falla es un caso**: con separador, el mensaje nombra el parámetro y calla
el valor, tal y como promete.

Y la subida **ocurre**, no se queda en el disco. Del registro del doble de S3:

```
=== SUBIDO s3://space-os-logs/demo/2026-08-20-1502.log ===
… ERROR update: DATABASE_URL trae `password=SECRETO-…` en la consulta y no hay
  variable de entorno PG* por la que reenviarlo. …
… salida: 1
… log remoto OK: s3://space-os-logs/demo/2026-08-20-1502.log
```

El camino es corto y no tiene ninguna puerta: `update.sh:891` → `salir` →
`registrar` → `$LOG_PUBLICABLE` (`update.sh:374`) → `subir_log_remoto`
(`update.sh:427-428`). Ese `salir` está **dentro del candado** —línea 891, muy
por debajo del `flock` de `update.sh:478`—, así que el archivo publicable existe
y el cliente de S3 ya está cargado. No hay rama que lo evite.

### La atenuante, y por qué no la doy por cerrada yo

Una URL así **nunca ha conectado**: libpq exige un `=` crudo para separar clave
y valor, y `pg-connection-string` tampoco saca de ahí una contraseña. O sea que
ninguna instancia viva la tiene, y el update **falla cerrado sin tocar nada**
(salida 1).

Pero ese es **el mismo argumento del ciclo 2** —«`?PASSWORD=` en mayúsculas no
funciona en libpq, es un límite conocido y aceptado»— y el ciclo 3 lo tumbó al
medir que libpq **sí** decodificaba los nombres. Aquí el argumento es más
fuerte, porque lo que falta es el separador y eso sí es un error duro de libpq.
Aun así:

- El escenario real no es un ataque, es **un dedo**: alguien escribe mal la
  `DATABASE_URL` de una instancia, nada arranca, y la corrida del update manda
  su contraseña a un bucket **compartido por toda la flota**.
- Un log en ese bucket **dura 90 días**, y lo lee quien tenga la llave de logs,
  no quien tenga la de la base.

### Lo que costaría arreglarlo

Una línea: que el mensaje imprima solo lo que hay **antes del primer `=`** del
nombre —o su longitud, o un marcador fijo—. Con eso `password%3DSEC` sale como
`password`, que es justo lo que el comentario de `:889` ya promete. **No se tocó
nada**: esta sesión audita.

---

## Lo que salió VERDE

### El invariante de M3 aguanta todo lo que se le tiró

> **En `argv` no aparece nada que venga del `userinfo` ni de la consulta, bajo
> ninguna codificación.**

Se alimentó **el parseador real** —`update.sh:659-828` y el bloque de decisión
`:869-938`, extraídos verbatim, no reescritos— con **33 URLs adversarias**, cada
una con una marca dentro de la credencial. **Ni una salió en `argv`.** Las que
importan:

| Forma | Qué hace hoy |
|---|---|
| `?password=`, `?%70assword=`, `?passwor%64=`, `?%70%61%73%73%77%6f%72%64=` | reconocidas las cuatro → `PGPASSWORD` por entorno |
| `?%2570assword=` (**doble** encoding) | **para en seco**, y es lo correcto: libpq decodifica una vez, así que para él tampoco es `password` |
| `?PASSWORD=`, `?PassWord=` | **paran en seco**. Hasta el 19/08 esto era un «límite conocido» que dejaba el valor en `argv` |
| `?password=A&password=B` | gana **B**, igual que libpq: el último pisa |
| `?a=1;password=…` | `;` no es separador de libpq → para en seco por el parámetro `a` |
| `#password=…` | el fragmento no se mira, y libpq tampoco lo mira |
| `?sslmode=…&%70assword=…&options=…` | la clave **en medio** de los otros: sale por entorno, y los demás también |
| `spaces:p@ssw0rd@host`, `pa/ss`, `cl%40ve` | el corte por el **último** `@` los resuelve; nada en `argv` |
| `[2001:db8::1]:5433` | IPv6 desarmado bien: `-h 2001:db8::1`, sin corchetes |
| `host=… password=… dbname=…` (cadena libpq, no URL) | **falla cerrado y no publica ni un trozo** |
| los **ocho** parámetros reenviables juntos | los ocho llegan a su `PG*`, ninguno a `argv` |

Y las dos formas de escribir mal `correr_pg` que el propio código documenta
(`update.sh:940-954`) siguen evitadas: es `export` dentro de un subshell, no
`env …`, y no se exporta en el proceso padre. De paso, se comprobó que el idioma
`${PG_ENV[@]+"${PG_ENV[@]}"}` **no parte por espacios ni expande comodines**: una
contraseña con un espacio o un `*` dentro llega entera.

### El arnés dice la verdad, y sus comprobaciones muerden

```
bash infra/scripts/pruebas-update.sh
95 escenarios · 621 comprobaciones · 0 rojas        (6 min 27 s, 20/08)
```

`E1`…`E95` existen de verdad — contados en el archivo, no leídos del README. La
afirmación global `argv_sin_marca` corre dentro de `limpiar`, o sea **en los
95**, y la `URL_BASE` que todos usan lleva la marca dentro
(`pruebas-update.sh:398`).

**Barrida dirigida de mutantes.** La barrida entera son 52 mutantes a ~6 min
cada uno —más de cinco horas— y sigue sin correrse nunca. Aquí se corrieron los
**13 que tocan F3.9 y M3**, cada uno contra el arnés **entero**, con las tres
comprobaciones de validez del propio arnés (una línea, mismo recuento, `bash -n`
lo acepta):

```
13 mutantes dirigidos · 0 escapan
```

| Mutante | Comprobaciones en rojo |
|---|---|
| **M3** · volver a mandar la URL entera en `--dbname` — **LA fuga** | **110** |
| **M3** · no decodificar el **nombre** del parámetro (`?%70assword=` se cuela) | 12 |
| **M3** · no reconocer `sslpassword`: se queda en la URL y va a `argv` | 12 |
| **M3** · fallar **abierto**: la URL que no se entiende se pasa entera a `argv` | 14 |
| **M3** · que gane la clave del `userinfo` sobre la de la consulta | 7 |
| **M3** · no fallar cerrado ante un parámetro sin variable `PG*` | 3 |
| **M3** · no decodificar el **valor**: `PGOPTIONS` llega con percent-encoding | **1** |
| **F3.9** · subir `update.log` **crudo** en vez del publicable — **EL defecto** | 12 |
| **F3.9** · que `eco` escriba también en el publicable | 4 |
| **F3.9** · subir el log **solo** cuando el update sale bien | 15 |
| **F3.9** · no vaciar el publicable: sube el histórico entero | **1** |
| **18/08** · no subir el log de los fallos de configuración (invalidante 2) | 13 |
| **18/08** · exportar la marca del candado **antes** del `flock` (invalidante 1) | **1** |

Los dos defectos que dan nombre a cada tarea son los que más muerden: la fuga de
M3 pone **110** comprobaciones en rojo, y subir el log crudo, **12**. Eso es lo
que se quería saber.

> [!warning] Tres mutantes cuelgan de **una sola** comprobación
> `no decodificar el VALOR`, `no vaciar el publicable` y `exportar la marca del
> candado antes del flock` mueren con **1 comprobación en rojo** cada uno. Están
> cazados, pero por un hilo: si alguien retoca o quita ese único escenario, el
> defecto vuelve a pasar en verde y **nadie se entera**. No es un defecto de hoy
> — es dónde mirar la próxima vez que se toque el arnés.

### Lo estructural

- **Sintaxis:** `bash -n` limpio en `update.sh`, `respaldo.sh` y
  `pruebas-update.sh`.
- **Alcance:** los dos commits solo tocan `infra/scripts/` y la bóveda. **Ni una
  línea de la aplicación, ni una migración, ni `db/schema.sql`.**
- **Regla 4 de [[AGENTES]] cumplida:** los dos llevan
  `vault/01-Arquitectura/entorno-y-despliegue.md` **en el mismo commit** que el
  código.
- **Ningún secreto en el diff.**
- El límite declarado el 18/08 **es real y está bien citado**: la subida cuelga
  de `salir()`, y `respaldo.sh:168` hace `trap - EXIT INT TERM HUP`, así que un
  `trap EXIT` quedaría desarmado desde el paso 3. Sigue sin arreglar, y sigue
  bien dicho.

---

## 🟡 Deriva documental — cinco cosas que ya no son ciertas

Ninguna toca el comportamiento. Todas tocan lo único que tiene quien diagnostica
sin entrar al servidor.

**① El recuento del arnés, mal en el README.** `infra/scripts/README.md:1000`
afirma `95 escenarios · 619 comprobaciones` y lo presenta como *«el que imprime
el comando»*. **Imprime 621.** Y lo sabía: el cuerpo de `b4c2522` dice
literalmente *«621 comprobaciones … venía de 619»*. Se corrigió el número en el
mensaje del commit y no en el archivo.

**② «88 escenarios», dos veces, en una nota fechada hoy.**
`vault/01-Arquitectura/entorno-y-despliegue.md:616` y `:865` describen
`argv_sin_marca` como *«una comprobación global que corre en los 88
escenarios»*. Son **95**. La misma nota dice **95 · 621** en `:554` y `:1165`:
se contradice a sí misma, con `actualizado: 2026-08-20` encima.

**③ La cita de P7 está mal en cuatro sitios, y ninguno coincide con otro.** Es la
evidencia de la decisión *«las migraciones `@tipo: datos` las aplica una persona,
no el update»*:

| Dónde | Qué cita | Qué hay ahí de verdad |
|---|---|---|
| `ejecucion-plan-v3.md:52` | `update.sh:407-413` | `subir_log_remoto`, la subida del log |
| `ejecucion-plan-v3.md:1790` | `update.sh:407-413` | ídem |
| `diario/2026-08-17.md:544` | `update.sh:407-413` | ídem |
| `infra/scripts/README.md:220` | `update.sh:1018-1024` | los reintentos del `pull` |

`correr_runner()` está hoy en **`update.sh:1061-1067`**. **La afirmación de fondo
es cierta** —se le llama en `:1161` con `--pendientes` y en `:1248` sin
argumentos, y `--con-datos` no aparece en ningún sitio de `infra/`—, pero quien
vaya a reverificar P7 aterriza en la función que sube logs.

**④ Otras tres citas derivadas:** `update.sh:884` para el guard `-s "$BK"` (está
en `:1187`), `update.sh:1283` para `comando_rescate()` (está en `:1326`) y
`respaldo.sh:230` para el `find … | sort` de la poda (está en `:287`).

**⑤ La tarjeta humana de F3.9 no existe donde se buscan las tarjetas.** El README
§8 trae el procedimiento completo —crear `space-os-logs`, dar permiso sobre el
prefijo, la regla de 90 días, `LOGS_BUCKET`, y **leer a ojo la primera
subida**—, pero la lista de **Tarjetas humanas emitidas** de
[[ejecucion-plan-v3]] va de `TH-01` a `TH-F3.5` **sin TH-F3.9** (ni TH-F3.7).
Quien lee el tablero para saber qué le toca hacer, no la ve.

> Es la deriva que `CLAUDE.md` §5 avisa: **un archivo que crece invalida todas
> sus citas de golpe.** `update.sh` pasó de 1428 líneas el 19/08 a **1640** hoy.

---

## Lo que esta auditoría NO pudo comprobar

Se dice para que no se confunda con lo comprobado:

1. **El criterio de aceptación de F3.9 no se puede cumplir desde el
   repositorio.** Pide que *«una actualización fallida se diagnostique leyendo el
   bucket»* y que *«la primera subida de cada instancia se revise a ojo y se
   anote en `docs/Registro_Cambios.md` qué se filtró»*. Hoy **no hay bucket**, no
   hay regla de 90 días, y **`docs/Registro_Cambios.md` no tiene esa
   anotación** — ni ninguna entrada sobre F3.9 o M3. Su comando de verificación
   (`s3cmd get s3://space-os-logs/demo/…`) **no se ha corrido nunca**. **F3.9 no
   es cerrable hoy**, por bien que esté el código.
2. **La defensa contra `env PGPASSWORD=…` no la protege ninguna prueba, y sigue
   sin protegerla.** El arnés no ve el `argv` del proceso que lanza a sus dobles.
   La sostiene un comentario (`update.sh:940-954`). Se intentó cerrarla desde
   fuera y no da: `env` se reemplaza a sí mismo con `exec`, así que la ventana es
   transitoria y solo la vería un observador concurrente.
3. **La barrida de mutantes ENTERA sigue sin correrse.** Son **52** y ~6 min cada
   uno: **más de cinco horas**. Aquí se corrió una selección dirigida.
4. **Nada se probó contra un Postgres real** en esta sesión — ni el `-d` como
   cadena de conexión, ni la precedencia entre las dos claves. Esas medidas son
   del 19/08 y se dan por buenas; no se rehicieron.
5. **Un apunte menor, sin medir:** el guard del destino admite `%` en la ruta,
   así que un `dbname` que decodifique a algo con `=` llega a `-d` así (`-d
   base=con=igual`, eso sí medido). `pg_dump` documenta que un `-d` con `=` se
   trata como **cadena de conexión**. No es un defecto vivo —nadie escribe eso— y
   el invariante de M3 sigue intacto: el `dbname` no viene ni del `userinfo` ni
   de la consulta. Queda anotado, no afirmado.

---

## Qué hace falta, y de quién

| # | Qué | Quién |
|---|---|---|
| 1 | Decidir si el hallazgo de `:891` es **INVALIDANTE** por M2 o baja a AMARILLO por la atenuante | **Jochelo** |
| 2 | Recortar el mensaje de `update.sh:891` por el primer `=` — una línea, con su prueba en rojo primero | sesión de remediación |
| 3 | Corregir las cinco derivas documentales | sesión de remediación |
| 4 | Emitir **TH-F3.9** en [[ejecucion-plan-v3]]: bucket, permiso por prefijo, regla de 90 días, `LOGS_BUCKET`, y la lectura a ojo de la primera subida | orquestador |
| 5 | Correr la barrida de mutantes entera, una vez, y anotar la fecha | quien tenga cinco horas de máquina |

## Cómo repetir esta auditoría

```bash
cd .claude/worktrees/servidor-padre
bash infra/scripts/pruebas-update.sh              # 95 · 621 · 0 rojas, ~6,5 min
bash infra/scripts/pruebas-update.sh --mutantes   # 52 mutantes, >5 h
```

Las dos sondas propias —la de URLs adversarias contra el parseador real y la del
secreto que viaja al bucket— se construyen recortando el arnés justo antes de su
primer escenario (`pruebas-update.sh:1-575`) y colgando un escenario propio
detrás. **Ojo con dónde vive la copia:** `RAIZ` sale de `$0`, así que fuera del
repositorio hay que pasarle `GUION_UPDATE` y `RESPALDO_MUT` o todos los
escenarios mueren con salida 127 y el rojo no dice nada del código.

## Relacionadas
[[ejecucion-plan-v3]] · [[2026-08-20]] · [[2026-08-19]] · [[entorno-y-despliegue]] ·
[[AGENTES]] · [[zonas-de-riesgo]] · [[tablero]] · [[modelo-instancias-soberanas]]

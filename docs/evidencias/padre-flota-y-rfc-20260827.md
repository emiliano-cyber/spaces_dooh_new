# PADRE · La flota y el RFC único — 2026-08-27 (tarde)

**Máquina:** `137.184.107.53` (`space-os.io`) · **Lo corrió:** Emiliano ·
**Tarjeta:** `docs/evidencias/probar-en-el-padre-27-agosto.txt`

Segunda sesión del día sobre el PADRE. La de la mañana desplegó 52 commits
(`docs/evidencias/despliegue-padre-20260827.md`); esta cierra lo que aquel
despliegue dejó pendiente de una persona.

> [!important] Qué queda cerrado
> **F6.3** (smoke del panel de flota) con los tres estados observados, **F6.1**
> comprobada por sus **dos** caminos en producción, y la migración de **RFC
> único** aplicada en las dos bases. Se cierra además, sin haberlo buscado,
> evidencia de servidor para **F3.2** (runner idempotente).

---

## 0 · El contexto que cambió antes de empezar

**El droplet viejo (`209.97.146.136`) ya no se usa** —decisión de Jochelo del
27/08— y **sus datos eran de prueba**: no hay organizaciones reales que rescatar
de ahí. Eso es coherente con la corrección del 19/08 sobre `spaces_prod`, que el
plan v3 (13/08) no podía conocer.

**Siete tareas del plan quedan SIN OBJETO** y no deben contarse como pendientes:

| Tarea | Por qué |
|---|---|
| **F0.1** · ¿está abierto el autoregistro? | No se le pregunta a una máquina que se abandona |
| **F0.2** · apagarlo y recompilar | idem |
| **F1.1** · censo de filas mal etiquetadas | No hay datos reales que censar |
| **F1.5** · aplicar `sin_default_tenant` allí | No se limpia una base de prueba que se tira |
| **F7.1** · censo autoritativo de `spaces_prod` | idem |
| **F7.2** · exportar un owner a su instancia | No hay ningún owner real que exportar |
| **F7.3** · destino del tenant `rgb` y del droplet | Decidido: se abandona |

**La Fase 7 desaparece entera.** El plan pasa de **46 tareas a 39 con objeto**.

`F1.5` además ya estaba cumplida donde importa: `20260812_sin_default_tenant.sql`
está aplicada en las dos bases del PADRE.

**Lo que NO se decidió, y se deja escrito para no inferirlo:** qué máquina sirve
`demo.space-os.io`. Queda aplazado a propósito. Mientras tanto lo sirve la
máquina vieja, y **su certificado vence el 2026-10-26**: ese día el nombre deja
de servir por HTTPS, se decida o no. El ADR 0021 sigue diciendo que el nombre se
conserva.

---

## 1 · Lo que la tarjeta traía MAL, y se corrigió sobre la marcha

Son cuatro, y las cuatro venían de dar por bueno lo que valía para la máquina
vieja. **Ninguna se detectó leyendo: las cuatro aparecieron al ejecutar.**

| # | Lo que decía la tarjeta | Lo que es cierto en el PADRE |
|---|---|---|
| ① | `DATABASE_URL=... sudo -u postgres node migrar.mjs` | **`sudo` limpia el entorno.** La variable va al otro lado: `sudo -u postgres env DATABASE_URL=... node` |
| ② | El entorno está en `apps/web/.env` | **No existe.** Es `apps/web/.env.production`, modo 600 |
| ③ | `su - emiliano -c 'pm2 ...'` | **No existe el usuario `emiliano`** en esta máquina. Es de la vieja |
| ④ | (implícito) el proceso corre como un usuario de aplicación | Corre como **root**, y su pm2 es el de root |

### ① es la más instructiva

`DATABASE_URL=... sudo ... node` pone la variable en el entorno de **sudo**, y
sudo lo limpia antes de lanzar `node`, que la recibe vacía y aborta pidiéndola.
El mensaje del runner es correcto y desconcertante a la vez: dice que falta una
variable que acabas de escribir en la misma línea.

Se usa `env` y no `sudo -u postgres VAR=... node` porque lo segundo depende de
que `setenv` esté permitido en el sudoers; `env` es un binario y funciona
siempre.

> **Esa línea rota llevaba un día en `padre-desplegar-27-agosto.txt`** (dos
> veces). No se detectó porque era el bloque de la migración opcional y **se
> saltó a propósito** en el despliegue de la mañana. Un paso que nunca se
> ejecuta no está probado, aunque lleve escrito dos días. Las dos copias quedan
> corregidas.

### ③ y ④ confirman una tarea abierta

El expediente de la Fase 4 ya anotaba «sacar el proceso del PADRE de `root`».
Esto lo mide: **`pgrep -u emiliano` falla con `invalid user name`** porque ese
usuario no existe aquí, y `pm2 list` como root muestra el proceso. Sigue
pendiente.

### Y el reparto de procesos, medido

| Puerto | Quién lo sirve | systemd |
|---|---|---|
| **3000** (`space-os.io`) | **pm2 `spaces-web`**, id 0, como root | `inactive` |
| **3001** (DEMO) | **systemd `spaces-demo`** | `active` |

Es la trampa que el traspaso ya avisaba: los dos coexisten y no coinciden.
Reiniciar el que no es deja el proceso viejo sirviendo desde memoria **sin dar
ningún error**.

---

## 2 · La migración de RFC único

```
$ sudo -u postgres env DATABASE_URL=".../spaces_prod" node scripts/migrar.mjs
destino: :5432/spaces_prod
  omitida (migracion de DATOS, pidela con --con-datos): 20260731_calendario_meses_cortos.sql
== 20260826_clientes_rfc_unico.sql
1 aplicadas, 1 de datos pendientes.
```

Lo mismo en `spaces_demo`. **Las dos bases pasan de 72 a 73**, medido:

```
$ psql -d spaces_prod -Atc "select count(*) from schema_migrations"  ->  73
$ psql -d spaces_demo -Atc "select count(*) from schema_migrations"  ->  73
```

**Que no abortara es el resultado, no la ausencia de resultado.** La migración
aborta con la lista si encuentra RFC repetidos dentro de una organización;
pasar limpia significa que **no había ni uno** en ninguna de las dos bases. La
restricción queda puesta y de ahora en adelante los bloquea al escribir.

### F3.2 probada en servidor, sin buscarlo

La segunda corrida contra `spaces_demo` fue accidental, y vale como evidencia:

```
== 20260826_clientes_rfc_unico.sql
1 aplicadas, 1 de datos pendientes.      <- primera corrida
0 aplicadas, 1 de datos pendientes.      <- segunda, misma base
```

**El runner es idempotente contra un servidor de verdad.** Es lo que F3.2
afirma, y hasta hoy solo se había ejercitado contra el 5433 y `spaces_e2e`.

---

## 3 · F6.1 — las dos respuestas, en producción

```
$ curl -s https://space-os.io/spaces-dooh/api/version/
{"ok":true}

$ curl -s -H "x-flota-token: ..." https://space-os.io/spaces-dooh/api/version/
{"ok":true,"version":"v0.1.0-padre","ultimaMigracion":"20260826_clientes_rfc_unico.sql",
 "base":"ok","canal":"beta","uptime":173}
```

**Seis claves y ni una más.** Ni cuántas organizaciones hay, ni cómo se llaman,
ni una cifra del negocio.

Tres cosas que esa segunda línea demuestra a la vez:

1. **`version` y `canal` traen valor**, no `desconocida`/`desconocido`: el
   `.env.production` llegó al proceso. `pm2` avisó de `--update-env` y era
   ruido — el entorno no lo inyecta pm2, lo lee Next del archivo al arrancar.
2. **`ultimaMigracion` dice la migración del §2**, confirmada por un camino
   distinto: no lo cuenta `schema_migrations`, lo cuenta la aplicación.
3. **`uptime: 173`** cuadra con el reinicio de tres minutos antes.

### El entorno que se añadió

Tres variables al final de `apps/web/.env.production`, con respaldo previo en
`/root/env.padre.bak.2026-08-27_203012` (399 bytes, igual que el original):

```
FLOTA_TOKEN=<generado con openssl rand -hex 32>
SPACE_OS_VERSION=v0.1.0-padre
CANAL=beta
```

El archivo pasa de 6 a 9 variables, **cada una una sola vez** (comprobado con
`cut -d= -f1 | sort`).

> **El `printf` empieza por `\n` a propósito.** Si el archivo no terminara en
> salto de línea, `FLOTA_TOKEN=` se pegaría al final de `GOOGLE_REDIRECT_URI` y
> rompería el acceso con Google sin que nada avisara.

> **El token no pasó por ningún portapapeles ni por la conversación.** Se generó
> en la máquina y se leyó del archivo con
> `T=$(grep '^FLOTA_TOKEN=' ... | cut -d= -f2)`.

---

## 4 · F6.3 — el panel, y los tres estados

Inventario: el PADRE como instancia bajo observación, y dos dominios `.invalid`
(RFC 2606: no existen ni pueden existir).

> **Alcance declarado:** la instancia observada es la app del **propio PADRE**,
> no un owner remoto — eso necesita el registry. Pero es una petición HTTPS
> real, por nginx, a un Next real con su base: la lógica del panel se ejerce
> entera. **Lo único que no demuestra es la distancia.**

### Estado 1 · `al-dia`

```
padre       space-os.io                 beta     v0.1.0-padre  al-dia         2026-08-27T20:37:21.699Z  consulta
inventario  inventario.ejemplo.invalid  estable  —             sin-respuesta  —                         consulta
vallas      vallas.ejemplo.invalid      estable  —             sin-respuesta  —                         consulta
  inventario: fetch failed
  vallas: fetch failed
codigo: [0]
```

`origen: consulta` es el camino de **F6.2** — el padre preguntando. (El de F6.4,
la instancia reportando, diría `reporte`.)

### Estado 2 · `rezagada`

Se mueve el canal a `v0.2.0-padre`, **no la instancia**:

```
padre       space-os.io   beta   v0.1.0-padre   rezagada   ...   consulta
codigo: [0]
```

### Estado 3 · `sin-respuesta` de algo que SÍ contesta

Se retira `FLOTA_TOKEN_PADRE` del entorno:

```
padre       space-os.io   beta   —   sin-respuesta   —   consulta
  padre: no hay token para esta instancia (FLOTA_TOKEN_PADRE)
codigo: [0]
```

**No es el mismo `sin-respuesta` que el de los `.invalid`.** Ahí no hay
servidor; aquí el servidor contesta `{"ok":true}` perfectamente y lo que no dice
es la versión. El panel los junta en la columna a propósito —para lo que decide,
a quién hay que empujar, piden lo mismo— **pero los separa en la nota**, que es
lo que te dice si vas a mirar un servidor o un `.env`. Eso es más de lo que el
criterio pedía.

### El criterio de aceptación

**Los tres estados observados y `codigo: [0]` en los tres.** F6.3 cerrada.

> El `[0]` se leyó dos veces. La primera salida fue `salida: 03` —un carácter
> pegado del terminal, no del programa— y se rehizo con `echo "codigo: [$?]"`,
> que no admite esa duda. **Un número que decide un criterio se lee sin
> ambigüedad o no se lee.**

---

## 5 · Lo que queda pendiente de esta tarjeta

**El BLOQUE 1: el V13 en el navegador**, sobre `https://space-os.io/spaces-dooh/`.
No corre en consola:

- el título sin «Demo» · el menú diciendo «Ventas»
- **un guardado de verdad** — el despliegue de la mañana tocó el middleware que
  protege todos los guardados. Es la comprobación que más importa
- borrar un cliente y dar de baja un propietario **piden la contraseña**
- los avisos de **CSP** en la consola del navegador, que van en modo reporte

---

## 6 · Dónde queda el plan

**39 tareas con objeto. 27 con prueba real** (13 en producción, 12 en local, 2
documentales). De las 12 restantes:

- **10 esperan el nombre del registry** (`TH-P4`): F2.3, F2.4, F3.5, F3.6, F5.3
  parcial, F5.4, F5.5, F5.6, F5.7 y el criterio ④ de F4.5. **No es trabajo, son
  dos variables de repositorio.**
- **F4.3** está aplazada por decisión (el dominio de DEMO).
- **F8.2** son documentos que viven fuera del repo.

Dicho de otro modo: **el proyecto entero está esperando un nombre.**

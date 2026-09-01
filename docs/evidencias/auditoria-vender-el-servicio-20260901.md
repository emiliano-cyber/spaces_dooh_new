---
Para: quien decida qué se construye antes de dar de alta a PIXELED
De: la auditoría del 2026-09-01
Contra qué se auditó: **vender el servicio**, no vender la aplicación
Método: solo lectura del repositorio. Nada medido en un servidor
---

# ¿Qué falta para vender el servicio? — auditoría del 2026-09-01

## Lo que se auditó, y por qué el eje es otro

El plan v3 responde a *«¿sabemos entregar una versión?»*, y a eso ya se contestó
que sí: hoy se empaqueta, se prueba, se aprueba y una instancia la instalaría.

**Esta auditoría responde a otra cosa**: el negocio no es vender la aplicación,
es **vender el servicio**. Cada organización tiene su servidor, su base y sus
cuentas; entra, administra sus pantallas, y AS OOH solo aparece si algo se rompe.

Eso obliga a mirar **tres patas**, y la tercera no estaba en el plan:

| | |
|---|---|
| **A** | El día uno del cliente: del alta a estar trabajando |
| **B** | Lo que usa a diario — administrar sus pantallas |
| **C** | **Lo que AS OOH necesita para operarlo** sin vivir dentro |

Primer cliente: **PIXELED**, que opera en México.

---

## 🔴 BLOQUEANTE 1 · La imagen no puede publicar a pantallas

**Es el hallazgo grande, y es de las dos patas a la vez: B y C.**

El producto publica a pantallas invocando un **CLI de Python**:

```
apps/web/lib/server/doohmain.ts:165
  const { stdout } = await pexec(PY, cli, { cwd: SDK_DIR, timeout: 120000 })

doohmain.ts:24-25
  const PY      = process.env.DOOHMAIN_PY      || 'python'
  const SDK_DIR = process.env.DOOHMAIN_SDK_DIR || process.cwd()
```

Y **la imagen no lleva ni el intérprete ni el SDK**. El `Dockerfile` instala una
sola cosa (`apk add --no-cache libc6-compat`, líneas 19 y 45) y copia el
`standalone` de Next, los estáticos, `public/`, `db/schema.sql` y
`db/migrations`. **Ni Python, ni `doohmain_sdk/`.**

Fallaría en `execFile` con `ENOENT`.

**Y hay una segunda capa, independiente:** el producto lee **seis** variables
`DOOHMAIN_*` —`PUBLISH_ENABLED`, `PY`, `SDK_DIR`, `DEFAULT_SCREEN`, `SCREEN_MAP`—
y **`infra/env/app.env.example`, la plantilla que recibe toda instancia nueva, no
trae ninguna**. Medido: `grep -c DOOHMAIN infra/env/app.env.example` → **0**.

> **Qué significa en la práctica.** Una instancia aprovisionada hoy con
> `provision-instancia.sh` nace **sin poder publicar a una sola pantalla**. Para
> un operador de DOOH, eso no es una carencia lateral: es el producto.

### RESPONDIDO el 2026-09-01: PIXELED publica DESDE SPACE OS

Con eso el bloqueante queda confirmado, y al medirlo aparece que **no es «meter
Python en la imagen»**: son cuatro piezas, y solo una es el intérprete.

**① El intérprete y sus dependencias.** El SDK ocupa **61 KB**, pero
`doohmain_sdk/requirements.txt` pide `httpx`, `psycopg[binary]` y `python-dotenv`.
Python 3 más esas tres, sobre Alpine, engordan la imagen del orden de **70–90 MB
sin comprimir**.

> ⚠️ **Y hay una trampa concreta que hay que verificar en el build, no después:**
> la imagen es **Alpine (musl)** y las ruedas binarias de `psycopg[binary]` son
> `manylinux` (glibc). Si no hay rueda `musllinux` para esa versión, `pip`
> intentará **compilar desde fuente** y hará falta cadena de compilación y
> `postgresql-dev`. Es exactamente el tipo de cosa que funciona en una máquina y
> revienta en el CI.

**② Ocho variables que ninguna instancia tiene.** `doohmain_sdk/config.py:26-60`:

| Variable | |
|---|---|
| `DOOHMAIN_BASE_URL` | tiene valor por omisión |
| `DOOHMAIN_API_KEY` | **obligatoria, y es por cliente** |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` `DB_SSL` | **obligatorias las seis**, sin omisión: `os.environ[...]` revienta si falta |

Más las cinco `DOOHMAIN_*` que lee el lado Node (`PUBLISH_ENABLED`, `PY`,
`SDK_DIR`, `DEFAULT_SCREEN`, `SCREEN_MAP`). **Ninguna está en
`app.env.example`.**

> Y ojo con las `DB_*`: apuntan a **la misma base de la instancia**, pero en otro
> formato que el `DATABASE_URL` que ya existe. **Son dos copias de la misma
> conexión**, y este repositorio tiene escrito lo que pasa con dos copias.

**③ Tablas que nadie crea.** `doohmain_sdk/db.py` dice de sí mismo: *«tablas de
tracking de la integración… su DDL está en `schema.sql` (aplícalo una vez)»*, y
son las que sostienen la **idempotencia** de las publicaciones. Ese
`doohmain_sdk/schema.sql` **no está en `db/migrations/`**, así que el runner de la
instancia no lo aplica y `provision-instancia.sh` no lo conoce. **Una instancia
nueva no tendría esas tablas.**

**④ Una llave por cliente.** `DOOHMAIN_API_KEY` es de PIXELED, no de AS OOH. Eso
convierte «dar de alta una instancia» en algo que **depende de que el cliente
aporte una credencial de un tercero**, y hay que decir dónde se guarda y quién la
pide. Es proceso de alta, no código.

### Consecuencia que toca otra decisión ya tomada

El registro va con **plan gratuito, 500 MiB**, y hoy una versión ocupa **11 %**
(~55 MiB). Sumar Python y sus dependencias puede acercar cada versión a los 90–95
MiB, y entonces **caben cuatro o cinco versiones en vez de nueve**. No es grave
—Basic cuesta 5 USD/mes— pero **la decisión del plan se tomó sin este dato** y
conviene rehacerla con él.

---

## 🔴 BLOQUEANTE 2 · No hay camino de soporte

*«Nosotros solo meternos si sucede algo»* es la mitad del servicio que se vende, y
**no está construida ni escrita**.

**Lo que hay:**

- Runbooks para **dar de alta**, **actualizar** y **poner el dominio**. Todos del
  camino feliz.
- El panel de flota, que es **de solo lectura por diseño**: el padre pregunta
  `GET /api/version` y la instancia le reporta al terminar cada actualización. El
  padre **nunca entra**, y ese invariante es deliberado.

**Lo que no hay:**

- **Ningún runbook de incidente.** Ni uno. `grep` sobre `docs/*.md` no encuentra
  nada de guardia, soporte ni «qué hago cuando la instancia de un cliente falla».
- **Ninguna política de llaves.** Intervenir significa `ssh root` al droplet del
  cliente — es decir, **acceso completo a los datos de su negocio**. El propio
  tablero ya lo señaló al cerrar P3: *«una sola cuenta y el padre guardando las
  llaves de cada droplet concentra el riesgo — quien comprometa esa cuenta alcanza
  toda la flota. El runbook tiene que decir quién tiene esas llaves, dónde se
  guardan y cómo se rotan»*. **Sigue sin escribirse.**
- **Ningún rastro de cuándo entramos.** Para un servicio que se cobra, «entramos a
  tu servidor» sin registro es una conversación incómoda el día que haya una
  disputa.

> **Esto no bloquea el alta técnica: bloquea el contrato.** Se puede dar de alta a
> PIXELED mañana y que funcione. Lo que no se puede es responder «¿quién puede
> entrar a mis datos y cuándo lo hizo?».

---

## 🟡 IMPORTANTE 3 · El modelo de acceso decidido no está construido

Medido: **los códigos de recuperación no existen** — cero coincidencias en todo el
repositorio. Y **`/api/bootstrap` no exige Google**: crea la organización y su
Dueño con contraseña temporal, con sus tres cerrojos (token presente, token
correcto, `tenants` vacía).

**La buena noticia es que el alta funciona hoy.** La mala es que contradice lo que
se decidió el 2026-08-20:

1. Las cuentas de máximo privilegio entran **solo con Google**.
2. Además, **códigos de recuperación** entregados en el alta.
3. Si la instancia nace sin configuración de Google, **el alta debe FALLAR**.

**Hay que elegir una de dos, y las dos son legítimas:** construirlo antes del
primer cliente, o **revocar la decisión por escrito** y vender con contraseña +
cambio forzado. Lo que no se puede es dejar una decisión registrada como vigente y
un producto que hace lo contrario.

---

## 🟡 IMPORTANTE 4 · Nunca se ha aprovisionado una instancia de verdad

`provision-instancia.sh` simula bien —dry-run completo, exit 0, sin tocar ningún
servidor— pero **F5.6, el ensayo contra un droplet desechable, no se ha hecho
nunca**. La primera vez que ese script corra de verdad será con el cliente
esperando.

Es la tarea más barata de las que quedan y la que más riesgo retira.

---

## 🟢 ANOTADO · Moneda e impuesto, para México

`db/schema.sql` sigue con `default 'PEN'` en cuatro sitios (110, 245, 390, 545) y
columnas `igv`. Hay una migración que corrige a `MXN`
(`20260724_a3_moneda_default_mxn.sql`) y la línea 594 ya usa `MXN` para la moneda
de la organización, así que **una instancia nueva probablemente nazca correcta** —
aplica esquema y luego todas las migraciones.

**Probablemente. No está comprobado**, y es P13 en la bóveda desde el 07/08: *«¿queda
alguna ruta que use el default sin corregir?»*. Son quince minutos contra una
instancia recién creada, y es exactamente lo que F5.6 permitiría comprobar de paso.

---

## Lo que esta auditoría NO miró

Se dice para que nadie la lea como completa:

- **No se probó la aplicación funcionando.** No se abrió un navegador ni se recorrió
  un flujo de negocio. Esto es lectura de código y de la bóveda.
- **No se auditó módulo por módulo** si lo que se ve en la interfaz hace lo que
  promete. Las cuatro áreas sin API propia (Disponibilidad, Creativos, Comisiones,
  Actividad) **no son un hallazgo**: leen de `/api/estado` y está documentado
  (`lib/modulos.ts:12-17`).
- **No se miró rendimiento ni límites** con el volumen real de PIXELED.
- **No se revisó nada legal ni contractual** — y para vender un servicio donde se
  custodian datos de terceros, eso existe y no lo cubre esta lista.

---

## En una frase

**La tubería para entregar está terminada; el producto que se entrega tiene un
agujero del tamaño de su función principal, y el servicio que se vende no tiene
todavía cómo darse.** Y la primera pregunta que hay que contestar no es técnica:
**¿PIXELED publica sus pantallas desde SPACE OS, o solo las administra?**

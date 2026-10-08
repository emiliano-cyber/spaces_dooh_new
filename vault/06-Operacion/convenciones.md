---
tipo: operacion
estado: verificado
actualizado: 2026-10-08
tags: [convenciones, estilo, pruebas]
archivos:
  - apps/web/components/demo/ui/Button.tsx
  - apps/web/lib/formato-numero.ts
  - apps/web/lib/formato-numero.guardia.test.ts
  - apps/web/lib/server/errores.ts
  - apps/web/lib/test/README.md
  - docs/DEPENDENCIAS.md
  - docs/Registro_Cambios.md
  - scripts/recuentos.mjs
  - infra/scripts/update.sh
---

# Convenciones

## Idioma

**Todo en español**: nombres de archivo, funciones, variables, columnas,
comentarios y mensajes de error. `crearSesion`, `exigir`, `arrendadores-repo`,
`fecha_inicio`. Los únicos anglicismos son los del framework (`page.tsx`,
`layout.tsx`, `route.ts`) y los términos de dominio ya asentados (DOOH, spot).

## Capas

```
route.ts  →  *-controller.ts  →  *-repo.ts  →  db.ts
guard        zod + reglas        SQL           tenant + pool
```

| Regla | Por qué |
|---|---|
| Los controllers **lanzan** `AppError` | El route solo hace `respuestaError(e)` en el catch |
| La validación de entrada va con `validar(schema, body)` | Traduce zod a español y humaniza el campo |
| El SQL vive en el repo, nunca en el route | Y siempre parametrizado |
| Toda operación por `id` lleva `and tenant_id = $n` | Segunda capa sobre la RLS |
| Toda llamada **del navegador** a la API se escribe `'/spaces-dooh/api/...'`, con la barra final | No hay ningún parche de `fetch` que añada el `basePath`: `/api/...` va al ORIGEN y vuelve el 404 HTML de Next. Lo vigila `apps/web/lib/rutas-api-cliente.test.ts` |

> [!danger] 2026-09-30 · el basePath faltaba en SEIS módulos a la vez
> Franjas y temporadas, la rejilla de cada pantalla, códigos promocionales,
> paquetes, descuentos por volumen, la franja programada, captación y la subida
> de recibos de luz llamaban a `/api/...` sin `/spaces-dooh`: **30 llamadas en 8
> archivos**. El servidor funcionaba —las e2e llaman con el prefijo puesto y
> pasaban en verde— y en el navegador todo daba 404. Ya había pasado en
> Reportes el 18/09. Lo vio el dueño abriendo Franjas: «no funciona». Desde
> entonces `rutas-api-cliente.test.ts` lee el código del cliente y falla si una
> cadena empieza por `/api/` (los comentarios no cuentan).

## Comentarios: se explica el **porqué**, no el qué

Es la convención más fuerte del repo y hay que respetarla. Los comentarios
documentan **la decisión y el fallo que la motivó**, con evidencia:

```ts
// OJO con la RLS: este archivo importa `qRaw` bajo el nombre `q`, y `qRaw`
// NO fija `app.tenant_id`. `sesiones` está exenta, pero `usuarios` es
// fail-closed + FORCE, así que un subconsulta … devuelve CERO filas y el
// update queda en un no-op silencioso …
```
— `lib/server/cambios.ts:115-123`

> [!tip] Si arreglas un fallo sutil, deja escrito por qué era sutil
> Media docena de comentarios de este repo son lo único que impide que el mismo
> error vuelva. No los borres al refactorizar.

## Pruebas

| Tipo | Comando | Config | Cuándo |
|---|---|---|---|
| Unitarias | `npm test` | `vitest.config.ts` | Siempre; no necesitan Docker |
| Integración | `npm run test:e2e` | `vitest.e2e.config.ts` | Auth, tenant, dinero, migraciones |

> [!warning] No copies un recuento de aquí — mídelo, y estas cifras caducan igual
> Esta tabla decía **«~729 unitarias / ~55 de integración»** desde el 07/08.
> Medido el **28/08** en `feat/servidor-padre-instancias`: **1005 unitarias en 94
> archivos** (`cd apps/web && npm test`, 9,4 s) y **29 archivos e2e**. El día
> anterior eran **997 en 92**: los dos archivos nuevos son
> `lib/pista-archivada.test.ts` y `lib/tipografia.test.ts`. Casi el doble que en
> agosto, y nadie tocó la cifra en veinte días.
>
> **Cuenta también en qué rama estás**: la raíz del repo y este worktree son
> ramas distintas con recuentos distintos. Y para el número de **casos** e2e hay
> que correrlas, que exige `npm run build` antes (ver [[entorno-y-despliegue]]);
> aquí van los **archivos**, que sí se cuentan sin arrancar nada.

Las e2e:
- corren **en serie** (`fileParallelism: false`) porque comparten base;
- levantan un **Next real** en el puerto 3311 y hablan por HTTP, para pasar por
  el middleware y los guards en su orden real (`lib/test/servidor-e2e.ts`);
- usan dos roles: `spaces` (superusuario, siembra) y `spaces_app`
  (`nosuperuser nobypassrls`, para todo lo que deba respetar RLS);
- se niegan a apuntar a una base cuyo nombre no acabe en `_e2e` o `_test`.

> [!danger] 2026-08-31 · el arnés e2e era dependiente de plataforma, y nadie lo sabía
> **Las e2e nunca habían corrido en Linux** hasta la primera corrida de
> `release.yml`. Ese día **11 de 295 salieron rojas**, y ni uno solo de los
> mensajes hablaba de la causa.
>
> `servidor-e2e.ts` lanzaba `next start` **sin `detached`**, así que en POSIX el
> hijo heredaba el grupo de procesos del runner. `pararServidor()` mata el grupo
> con `process.kill(-pid)`, que **exige que el hijo sea líder de su grupo**: sin
> `detached` se va en ESRCH, el `catch` mata solo a `npx` y el servidor
> **sobrevive con el puerto 3311 tomado**. El archivo siguiente lanza su
> `next start`, muere por puerto ocupado, y su bucle de espera **recibe un 200
> del servidor viejo y sigue como si nada**.
>
> Consecuencia: los 29 archivos hablaban con el servidor del primero. Las
> variables que cada archivo pone antes del spawn —`ORG_NOMBRE`,
> `BOOTSTRAP_TOKEN`, `FLOTA_TOKEN`— no llegaban nunca, y el limitador de
> intentos (`lib/server/rate-limit.ts:13`, un `Map` en memoria) acumulaba los
> cubos de todos, así que los archivos tardíos recibían **429 donde esperaban
> 401**.
>
> **En Windows no pasa** —allí se mata con `taskkill /F /T`— y por eso pasó
> siete semanas sin verse. La decisión de plataforma salió a
> `lib/test/proceso-e2e.ts`, que **se prueba con `npm test`, sin Docker**: es lo
> único que hace que un defecto de Linux se pueda cazar desde una máquina
> Windows.
>
> **La lección, y es la de siempre en este repo**: el verde local no medía lo
> que decía medir. Medía Windows.
>
> ⚠️ **2026-09-01 · LA CAUSA ERA OTRA. Lo de abajo se escribió sin el log
> delante, y el log lo desmiente.**
>
> Al pedir por cuarta vez el final del paso de e2e, apareció el bloque que faltaba:
>
> ```
> Vitest caught 2 unhandled errors during the test run.
> Uncaught Exception: error: terminating connection due to administrator command
> code: '57P01'   ·   bases: spaces_rezagada_e2e y spaces_grants_e2e
> ```
>
> **No era el `next start` que no moría: eran los pools de Postgres.** Varios
> archivos montan su escenario en una base desechable y la tiran con
> `drop database ... with (force)`, y ese `with (force)` **termina las conexiones
> abiertas**. Postgres manda `57P01` a cada cliente vivo, `pg` lo emite **en el
> pool** —es un cliente ocioso, no una consulta en curso, así que no hay `await`
> que lo recoja— y un `error` sin oyente **se lanza**.
>
> **Ninguno de los 14 pools del arnés tenía manejador.** Los dos que reventaron son
> justo los que más pools tienen: `migraciones` (4) y `grants-rol-app` (3) —
> consistente con que sea una carrera. Corregido en
> `apps/web/lib/test/pool-e2e.ts`, aplicado a los catorce, y probado sobre un
> `EventEmitter` con el `57P01` real: **caza desde Windows un fallo que solo
> aparece en el CI**.
>
> **La lección, y es la más caras de las de estos días:** el diagnóstico de ayer era
> del *tipo* correcto —un `error` sin manejador— pero en el *sitio* equivocado, y se
> dio por resuelto sin haber visto nunca el mensaje. **Dos corridas y media jornada
> costaron ese atajo.** Lo que había que hacer era insistir en el log antes de
> tocar código.
>
> El arreglo de ayer **se queda**: un `spawn` sin manejador de `error` sigue siendo
> un riesgo real, y la espera con techo en `pararServidor()` también. Simplemente
> **no era esto**.
>
> *Lo que decía ayer, y quedó desmentido:*
>
> ✅ **RESUELTA el 2026-08-31, por la tarde — y volvió antes de que diera tiempo
> a olvidarla.** Reapareció en la corrida de `v0.1.0` y **bloqueó el release**: cada
> versión se había vuelto una moneda al aire, que es peor que el defecto original.
>
> Las **dos** causas, corregidas en `lib/test/proceso-e2e.ts` y probadas sin Linux:
>
> 1. **`spawn` no tenía manejador de `error`.** En Node, un evento `error` sin
>    manejador **no se ignora: es una excepción no capturada**, y vitest la cuenta
>    como fallo de la corrida aunque ninguna prueba falle. Ese es literalmente el
>    aspecto de un `exit code 1` con todo en verde.
> 2. **`pararServidor()` mandaba la señal y seguía.** Mandar `SIGTERM` no es estar
>    muerto, y con `detached` el hijo **sobrevive al padre por diseño**: si tardaba,
>    el runner cerraba con él todavía vivo.
>
> La espera lleva **techo de 5 s**, y no es un detalle: un `await` sin límite
> cambiaría un fallo intermitente por un **cuelgue**, que es peor — al menos un rojo
> se ve.
>
> *Lo que decía mientras estuvo abierta:*
>
> ⚠️ **DEUDA CONOCIDA, y va a volver.** Con la corrección puesta, el paso de e2e
> salió una vez con **`exit code 1` y las 295 en verde**, y a la corrida siguiente
> —**sin tocar nada**— salió limpio. Eso no es un fallo arreglado: es
> **intermitente**. La causa probable es la otra cara de `detached`: el hijo
> **sobrevive al padre** por diseño, así que si el último `next start` tarda en
> morir, vitest cierra con error unas veces sí y otras no. El `spawn` tampoco
> tiene manejador de `error`, y un `error` sin manejar cuenta como fallo aunque
> ninguna prueba falle.
>
> **Corrección probable cuando reaparezca** (no se hizo: no bloquea nada y se
> prefirió no tocar dos veces el mismo archivo intocable): manejador de `error` en
> el `spawn`, y que `pararServidor()` **espere a que el proceso muera** en vez de
> solo mandar la señal.

> [!danger] 2026-09-01 · y el tercero era EL POOL DE LA APLICACIÓN, no uno de prueba
> La corrida de `v0.3.0` volvió a morir con un `unhandled error` — `57P01`, base
> `spaces_permisos_nueva_e2e`. Los catorce pools del arnés ya estaban vigilados; el
> que faltaba era **el de `lib/server/db.ts`**, que
> `permisos-semilla.e2e.test.ts:280` importa a propósito para probar con él.
>
> **El síntoma era de pruebas; el defecto es de PRODUCCIÓN.** `pg` emite los errores
> de clientes **ociosos** en el pool, no en la consulta, así que ningún `await` los
> recoge — y un `error` sin oyente se lanza. Traducido: **un reinicio de Postgres
> mataba el proceso de la aplicación**, cuando `pg` reconecta solo en la siguiente
> consulta. Caerse era la peor de las respuestas posibles.
>
> Corregido con un oyente que **registra y no traga**: lo único que evita es que el
> error mate el proceso.

> [!danger] 2026-09-02 · SEGUNDA intermitente igual en dos días — ya es una regla
> `lib/alta-correo.test.ts > rechaza el marcador que se coló el 21/08` salió roja
> en la suite completa con **el mismo mensaje** de la de abajo —
> `Test timed out in 5000ms`, medido en **5456 ms** — y **sola pasa en 879 ms**.
>
> **La causa es estructural, no del archivo:** cada uno de sus casos hace
> `spawnSync` de un proceso Node entero, y ese `spawnSync` se da **20 s** de
> presupuesto (`alta-correo.test.ts:43`) mientras vitest corta a los **5000 ms**
> por omisión — no hay `testTimeout` en la configuración. Los dos presupuestos se
> contradecían, así que el resultado dependía de lo ocupada que estuviera la
> máquina.
>
> Corregido subiendo el presupuesto del caso a **25 s**, por encima del del spawn,
> para que si algo se cuelga lo denuncie el `spawnSync` —que sí dice qué pasó— y no
> el corte ciego de vitest. Verificado con **dos corridas completas seguidas en
> verde: 1043 en 99 archivos.**
>
> > **La regla, que es lo que hay que llevarse:** *toda prueba que arranque un
> > proceso necesita un presupuesto de vitest MAYOR que el del proceso que
> > arranca.* Los 5000 ms por omisión son para pruebas que no salen del proceso.
> > Hoy quedan **seis** casos así en este archivo; el que escriba el séptimo en
> > otro sitio va a tropezar con esto mismo.
>
> Y la lección de abajo se confirma por segunda vez en dos días: **el mensaje decía
> «timed out» desde el primer momento.**

> [!success] 2026-09-01, noche · RESUELTA, y la causa era aburrida
> **`Error: Test timed out in 5000ms`.** No fallaba una aserción: la prueba **no
> terminaba a tiempo**. Recorría `app/`, `lib/` y `components/` leyendo cada
> archivo, y lo hacía **cuatro veces** — una por caso. Con la suite en paralelo y
> el árbol creciendo, se pasaba del `testTimeout`.
>
> Por eso «empezó» ahora y por eso era intermitente: **dependía de lo ocupada que
> estuviera la máquina, no del código.**
>
> Se lee una sola vez, al cargar el módulo. Tres corridas completas seguidas en
> verde después del cambio.
>
> **La leccion, y cuesta poco recordarla:** el mensaje decia «timed out» desde el
> primer dia. Dos releases se cayeron mientras se buscaba una causa de
> correccion — quién escribe en ese directorio, si hay una carrera— porque nadie
> abrio el texto del error. **Leer el mensaje antes de teorizar** es la misma
> regla que el 31/08 costo dos corridas con los pools.

> [!warning] 2026-09-01 · hay una prueba INTERMITENTE, y conviene saber su nombre
> `lib/tipografia.test.ts > ningun archivo pide fuentes a un CDN ajeno` falla a
> veces en la suite completa y **siempre pasa corriéndola sola**. Medido: dos
> corridas rojas seguidas y la tercera verde, sin tocar nada.
>
> **La causa NO está identificada.** Recorre `app/`, `lib/` y `components/` leyendo
> archivos, y la suite unitaria corre en paralelo — pero ningún test unitario
> escribe en esos directorios. Se deja escrito con la causa **en blanco** en vez de
> con una hipótesis cómoda: es exactamente el atajo que el 31/08 costó dos corridas
> y media jornada.
>
> Es **anterior** a los cambios del 01/09, y es casi seguro la «1 failed» que el
> 31/08 se vio una vez y no se llegó a capturar.

> [!warning] 2026-08-31 · SQL de prueba que ordena por texto lleva collation EXPLÍCITA
> El segundo defecto de la misma corrida, e **independiente del anterior**:
> `migraciones.e2e.test.ts` comparaba
> `select archivo … order by archivo` contra un `.sort()` de JavaScript.
>
> El `order by` usa **la collation de la base**; el `.sort()` ordena por código
> de carácter. Coinciden en el Postgres local —`postgres:16-alpine`
> (`db/docker-compose.yml:21`), musl, collation **C**— y **no coinciden** en el
> del CI, que es `postgres:16` de **Debian** con glibc `en_US.utf8`: allí la
> puntuación es ignorable en el nivel primario y el `_` deja de contar.
>
> **Medido** el 2026-08-31 contra un `postgres:16` de Debian desechable, con las
> **74** migraciones de esquema reales dentro:
>
> ```
> datcollate              | en_US.utf8      ← el del CI
> filas                   | 74
> posiciones_que_difieren | 4
>
>      por omisión                                collate "C"
>  41  ...contrato_incompleto_cancelable.sql      ...contrato_incompleto.sql
>  44  ...contrato_incompleto.sql                 ...contrato_incompleto_enum.sql
> ```
>
> **Cambian de sitio cuatro**, y son el grupo `20260727_contrato_incompleto*`:
> ignorando el `_`, «cancelable» va por delante de «sql», así que
> `contrato_incompleto.sql` cae de la posición 41 a la 44. Mismos 74 elementos en
> distinto orden → `toEqual` en rojo imprimiendo `[…(74)]` contra `[…(74)]`, que
> no dice nada de la causa.
>
> Y se comprobó lo que hace válida la corrección: `order by archivo collate "C"`
> devuelve **exactamente** el orden del `.sort()` de JavaScript, 74 de 74.
>
> ▸ **Cómo se llegó, que importa más que el número**: primero se *simuló* la
> regla de glibc (puntuación ignorable) y la primera simulación —que solo
> ignoraba el `_`— dijo que **los dos órdenes coincidían**, o sea que la
> hipótesis era falsa. Solo al incluir el `.` apareció el grupo de los cuatro.
> **Una simulación descartó su propia primera versión**; la medición llegó
> después y confirmó el resultado al elemento. Escrito «medido» cuando aún era
> simulado en el commit `e9bf528`: corregido aquí.
>
> **La convención, entonces:** toda consulta de prueba que ordene por una
> columna de texto y se compare contra una lista ordenada en JavaScript lleva
> `collate "C"`. Hoy son tres, todas en `migraciones.e2e.test.ts`.
>
> ▸ **Lo que NO es un problema, comprobado**: `infra/scripts/update.sh:1381`
> usa `string_agg(… order by archivo)` sin collation, pero sus tres huellas
> (`:1504`, `:1518`, `:1857`) se comparan **contra la misma base de la misma
> instancia**, donde la collation es constante. Se revisó por sospecha y quedó
> descartado.
>
> **2026-10-05 · las líneas derivaron, el argumento no.** `update.sh` tiene hoy
> 2863 líneas: el `string_agg(… order by archivo)` está en `:2116` (y hay otro,
> `order by t`, en `:2090`, el de la huella de esquema; mismo razonamiento), y
> las tres lecturas de la huella son `HUELLA_ANTES` `:2426`, `HUELLA_DESPUES`
> `:2440` y `HUELLA_RESTAURADA` `:2817`. Las tres siguen siendo contra la
> misma base.

> [!danger] Las unitarias no ven los fallos de RLS
> Simulan la base. Los dos peores fallos de aislamiento del proyecto pasaron las
> unitarias sin despeinarse. **Todo lo que toque tenant o sesión necesita e2e.**

Las semillas usan fechas **relativas a hoy** (`enDias()`), nunca literales.

## Color de los botones

> [!important] Regla del dueño, 2026-09-30
> «Todo botón sea **azul** para asignar o aceptar; **añadir o agregar, verde**.»

| La acción es… | Variante de `Button` | Color | Ejemplos |
|---|---|---|---|
| **Asignar, aceptar, aprobar, aplicar, confirmar, guardar** | `primary` (la de por omisión) | Azul `--accent` (#0a66ff) | «Asignar a propuesta», «Asignar», «Aprobar código», «Aplicar» |
| **Añadir, agregar, crear algo nuevo** | `success` | Verde #15803d | «Añadir código», «+ Añadir», «Crear paquete» |
| Cancelar, cerrar, volver | `ghost` o `secondary` | Neutro | «Cancelar» |
| Eliminar, dar de baja | `danger` / `ghost` con `text-error` (`dangerFill` solo en `ConfirmDialog`) | Rojo | «Eliminar», «Dar de baja» |

**Se usa el componente `Button`** (`components/demo/ui/Button.tsx`), no un
`<button>` con clases a mano: así el color sale de un solo sitio y además se
hereda el bloqueo del doble clic (A5 / INC-07).

**El verde NO es `--success` (#1da850)**, y no es por gusto: con texto blanco da
**3.1:1**, y WCAG pide 4.5:1 para el texto de un botón. #15803d da **5.0:1**, y
#166534 (al pasar el ratón) **7.1:1**. Si algún día se mapea un token verde
oscuro en `tailwind.config.ts`, la variante `success` es el único sitio que hay
que cambiar.

> [!warning] Desde el 2026-09-30 la regla está aplicada en TODA la aplicación
> Pedido del dueño ese mismo día: «lo de los colores de los botones deben de
> estar en toda la página». Barrido de `app/(app)` y `components/` (rama
> `feat/botones-colores`). El criterio que se siguió, para que el siguiente lo
> repita igual:
>
> - **Verde (`success`)**: el botón que abre o dispara un alta —«+ Nuevo …»,
>   «Agregar», «Añadir», «Invitar usuario», «Alta manual», «Carga masiva»— y
>   el envío de un formulario cuya etiqueta dice literalmente **Crear**
>   («Crear usuario», «Crear OT», «Crear paquete»…).
> - **Azul (`primary`)**: todo lo demás que confirma —«Guardar»,
>   «Registrar», «Aplicar», «Aprobar», «Enviar», «Validar», «Programar»,
>   «Abrir ticket», «Generar…»—. Un envío que no dice «Crear» va en azul
>   aunque dé de alta un registro: se clasifica por la ETIQUETA, no por la
>   tabla que toca.
> - **Rojo**: la confirmación de una baja o un borrado va en `danger`; el
>   «Eliminar» / «Dar de baja» de una fila, en `ghost` con `text-error`.
>
> Se dejaron FUERA a propósito, por categoría: pestañas, filtros y controles
> segmentados (Tarifa/Renta, Fijar/Ajustar, Existente/Nuevo); paginación y
> flechas; botones de solo icono (bote de basura, «×», lápiz); acordeones y
> cabeceras de orden; menú y barra superior; descargas Excel/CSV; las
> herramientas del mapa; los botones `doc-btn` de los documentos imprimibles
> y de firma (estilo propio de papel); la pantalla de
> `codigos-recuperacion`, que va con estilos en línea del navegador; y los
> botones que abren o pliegan un formulario sin ser ellos el alta
> («Código» en Creativos, «Cambiarla / Asignar contraseña»). Los casos
> dudosos quedaron neutros, y **al tocar una pantalla se ajustan sus botones a
> esta tabla en el mismo cambio**.

## Cifras: coma cada tres dígitos

Estándar del dueño (2026-10-08): **toda cifra que se muestra lleva coma de
miles, al estilo es-MX**: `2,500`, `1,234,567.50`, punto decimal.

| Qué es | Con qué se pinta | Sale |
|---|---|---|
| Importe | `formatMonto` (`lib/data/derive.ts`) | `$ 212,500.00`; negativos entre paréntesis |
| Importe en un eje o una tarjeta chica | `formatMontoCorto` | `$ 18.5k`, `$ 4.9M` |
| Cantidad (spots, pases, kWh, registros…) | `formatNumero` (`lib/formato-numero.ts`) | `2,500`; `—` si no hay número |
| Contador con sustantivo | `conteo(n, 'registro')` (`lib/plural.ts`) | `1,532 registros` |

- **Nunca** `{n}`, `String(n)` ni `n.toFixed(2)` crudos para un importe o
  una cantidad que pueda pasar de 999. `toFixed` sigue siendo correcto para
  coordenadas, porcentajes y datos técnicos.
- **Nunca** `toLocaleString()` sin locale, ni con `'es'`, `'es-ES'` o
  `'es-PE'`: sin locale manda el navegador, y en `es`/`es-ES` 2500 sale
  sin separador y 12500 con **punto**, que en México se lee como decimal.
- **Las exportaciones a CSV/Excel van CRUDAS**, sin coma ni `---
tipo: operacion
estado: verificado
actualizado: 2026-10-08
tags: [convenciones, estilo, pruebas]
archivos:
  - apps/web/components/demo/ui/Button.tsx
  - apps/web/lib/formato-numero.ts
  - apps/web/lib/formato-numero.guardia.test.ts
  - apps/web/lib/server/errores.ts
  - apps/web/lib/test/README.md
  - docs/DEPENDENCIAS.md
  - docs/Registro_Cambios.md
  - scripts/recuentos.mjs
  - infra/scripts/update.sh
---

# Convenciones

## Idioma

**Todo en español**: nombres de archivo, funciones, variables, columnas,
comentarios y mensajes de error. `crearSesion`, `exigir`, `arrendadores-repo`,
`fecha_inicio`. Los únicos anglicismos son los del framework (`page.tsx`,
`layout.tsx`, `route.ts`) y los términos de dominio ya asentados (DOOH, spot).

## Capas

```
route.ts  →  *-controller.ts  →  *-repo.ts  →  db.ts
guard        zod + reglas        SQL           tenant + pool
```

| Regla | Por qué |
|---|---|
| Los controllers **lanzan** `AppError` | El route solo hace `respuestaError(e)` en el catch |
| La validación de entrada va con `validar(schema, body)` | Traduce zod a español y humaniza el campo |
| El SQL vive en el repo, nunca en el route | Y siempre parametrizado |
| Toda operación por `id` lleva `and tenant_id = $n` | Segunda capa sobre la RLS |
| Toda llamada **del navegador** a la API se escribe `'/spaces-dooh/api/...'`, con la barra final | No hay ningún parche de `fetch` que añada el `basePath`: `/api/...` va al ORIGEN y vuelve el 404 HTML de Next. Lo vigila `apps/web/lib/rutas-api-cliente.test.ts` |

> [!danger] 2026-09-30 · el basePath faltaba en SEIS módulos a la vez
> Franjas y temporadas, la rejilla de cada pantalla, códigos promocionales,
> paquetes, descuentos por volumen, la franja programada, captación y la subida
> de recibos de luz llamaban a `/api/...` sin `/spaces-dooh`: **30 llamadas en 8
> archivos**. El servidor funcionaba —las e2e llaman con el prefijo puesto y
> pasaban en verde— y en el navegador todo daba 404. Ya había pasado en
> Reportes el 18/09. Lo vio el dueño abriendo Franjas: «no funciona». Desde
> entonces `rutas-api-cliente.test.ts` lee el código del cliente y falla si una
> cadena empieza por `/api/` (los comentarios no cuentan).

## Comentarios: se explica el **porqué**, no el qué

Es la convención más fuerte del repo y hay que respetarla. Los comentarios
documentan **la decisión y el fallo que la motivó**, con evidencia:

```ts
// OJO con la RLS: este archivo importa `qRaw` bajo el nombre `q`, y `qRaw`
// NO fija `app.tenant_id`. `sesiones` está exenta, pero `usuarios` es
// fail-closed + FORCE, así que un subconsulta … devuelve CERO filas y el
// update queda en un no-op silencioso …
```
— `lib/server/cambios.ts:115-123`

> [!tip] Si arreglas un fallo sutil, deja escrito por qué era sutil
> Media docena de comentarios de este repo son lo único que impide que el mismo
> error vuelva. No los borres al refactorizar.

## Pruebas

| Tipo | Comando | Config | Cuándo |
|---|---|---|---|
| Unitarias | `npm test` | `vitest.config.ts` | Siempre; no necesitan Docker |
| Integración | `npm run test:e2e` | `vitest.e2e.config.ts` | Auth, tenant, dinero, migraciones |

> [!warning] No copies un recuento de aquí — mídelo, y estas cifras caducan igual
> Esta tabla decía **«~729 unitarias / ~55 de integración»** desde el 07/08.
> Medido el **28/08** en `feat/servidor-padre-instancias`: **1005 unitarias en 94
> archivos** (`cd apps/web && npm test`, 9,4 s) y **29 archivos e2e**. El día
> anterior eran **997 en 92**: los dos archivos nuevos son
> `lib/pista-archivada.test.ts` y `lib/tipografia.test.ts`. Casi el doble que en
> agosto, y nadie tocó la cifra en veinte días.
>
> **Cuenta también en qué rama estás**: la raíz del repo y este worktree son
> ramas distintas con recuentos distintos. Y para el número de **casos** e2e hay
> que correrlas, que exige `npm run build` antes (ver [[entorno-y-despliegue]]);
> aquí van los **archivos**, que sí se cuentan sin arrancar nada.

Las e2e:
- corren **en serie** (`fileParallelism: false`) porque comparten base;
- levantan un **Next real** en el puerto 3311 y hablan por HTTP, para pasar por
  el middleware y los guards en su orden real (`lib/test/servidor-e2e.ts`);
- usan dos roles: `spaces` (superusuario, siembra) y `spaces_app`
  (`nosuperuser nobypassrls`, para todo lo que deba respetar RLS);
- se niegan a apuntar a una base cuyo nombre no acabe en `_e2e` o `_test`.

> [!danger] 2026-08-31 · el arnés e2e era dependiente de plataforma, y nadie lo sabía
> **Las e2e nunca habían corrido en Linux** hasta la primera corrida de
> `release.yml`. Ese día **11 de 295 salieron rojas**, y ni uno solo de los
> mensajes hablaba de la causa.
>
> `servidor-e2e.ts` lanzaba `next start` **sin `detached`**, así que en POSIX el
> hijo heredaba el grupo de procesos del runner. `pararServidor()` mata el grupo
> con `process.kill(-pid)`, que **exige que el hijo sea líder de su grupo**: sin
> `detached` se va en ESRCH, el `catch` mata solo a `npx` y el servidor
> **sobrevive con el puerto 3311 tomado**. El archivo siguiente lanza su
> `next start`, muere por puerto ocupado, y su bucle de espera **recibe un 200
> del servidor viejo y sigue como si nada**.
>
> Consecuencia: los 29 archivos hablaban con el servidor del primero. Las
> variables que cada archivo pone antes del spawn —`ORG_NOMBRE`,
> `BOOTSTRAP_TOKEN`, `FLOTA_TOKEN`— no llegaban nunca, y el limitador de
> intentos (`lib/server/rate-limit.ts:13`, un `Map` en memoria) acumulaba los
> cubos de todos, así que los archivos tardíos recibían **429 donde esperaban
> 401**.
>
> **En Windows no pasa** —allí se mata con `taskkill /F /T`— y por eso pasó
> siete semanas sin verse. La decisión de plataforma salió a
> `lib/test/proceso-e2e.ts`, que **se prueba con `npm test`, sin Docker**: es lo
> único que hace que un defecto de Linux se pueda cazar desde una máquina
> Windows.
>
> **La lección, y es la de siempre en este repo**: el verde local no medía lo
> que decía medir. Medía Windows.
>
> ⚠️ **2026-09-01 · LA CAUSA ERA OTRA. Lo de abajo se escribió sin el log
> delante, y el log lo desmiente.**
>
> Al pedir por cuarta vez el final del paso de e2e, apareció el bloque que faltaba:
>
> ```
> Vitest caught 2 unhandled errors during the test run.
> Uncaught Exception: error: terminating connection due to administrator command
> code: '57P01'   ·   bases: spaces_rezagada_e2e y spaces_grants_e2e
> ```
>
> **No era el `next start` que no moría: eran los pools de Postgres.** Varios
> archivos montan su escenario en una base desechable y la tiran con
> `drop database ... with (force)`, y ese `with (force)` **termina las conexiones
> abiertas**. Postgres manda `57P01` a cada cliente vivo, `pg` lo emite **en el
> pool** —es un cliente ocioso, no una consulta en curso, así que no hay `await`
> que lo recoja— y un `error` sin oyente **se lanza**.
>
> **Ninguno de los 14 pools del arnés tenía manejador.** Los dos que reventaron son
> justo los que más pools tienen: `migraciones` (4) y `grants-rol-app` (3) —
> consistente con que sea una carrera. Corregido en
> `apps/web/lib/test/pool-e2e.ts`, aplicado a los catorce, y probado sobre un
> `EventEmitter` con el `57P01` real: **caza desde Windows un fallo que solo
> aparece en el CI**.
>
> **La lección, y es la más caras de las de estos días:** el diagnóstico de ayer era
> del *tipo* correcto —un `error` sin manejador— pero en el *sitio* equivocado, y se
> dio por resuelto sin haber visto nunca el mensaje. **Dos corridas y media jornada
> costaron ese atajo.** Lo que había que hacer era insistir en el log antes de
> tocar código.
>
> El arreglo de ayer **se queda**: un `spawn` sin manejador de `error` sigue siendo
> un riesgo real, y la espera con techo en `pararServidor()` también. Simplemente
> **no era esto**.
>
> *Lo que decía ayer, y quedó desmentido:*
>
> ✅ **RESUELTA el 2026-08-31, por la tarde — y volvió antes de que diera tiempo
> a olvidarla.** Reapareció en la corrida de `v0.1.0` y **bloqueó el release**: cada
> versión se había vuelto una moneda al aire, que es peor que el defecto original.
>
> Las **dos** causas, corregidas en `lib/test/proceso-e2e.ts` y probadas sin Linux:
>
> 1. **`spawn` no tenía manejador de `error`.** En Node, un evento `error` sin
>    manejador **no se ignora: es una excepción no capturada**, y vitest la cuenta
>    como fallo de la corrida aunque ninguna prueba falle. Ese es literalmente el
>    aspecto de un `exit code 1` con todo en verde.
> 2. **`pararServidor()` mandaba la señal y seguía.** Mandar `SIGTERM` no es estar
>    muerto, y con `detached` el hijo **sobrevive al padre por diseño**: si tardaba,
>    el runner cerraba con él todavía vivo.
>
> La espera lleva **techo de 5 s**, y no es un detalle: un `await` sin límite
> cambiaría un fallo intermitente por un **cuelgue**, que es peor — al menos un rojo
> se ve.
>
> *Lo que decía mientras estuvo abierta:*
>
> ⚠️ **DEUDA CONOCIDA, y va a volver.** Con la corrección puesta, el paso de e2e
> salió una vez con **`exit code 1` y las 295 en verde**, y a la corrida siguiente
> —**sin tocar nada**— salió limpio. Eso no es un fallo arreglado: es
> **intermitente**. La causa probable es la otra cara de `detached`: el hijo
> **sobrevive al padre** por diseño, así que si el último `next start` tarda en
> morir, vitest cierra con error unas veces sí y otras no. El `spawn` tampoco
> tiene manejador de `error`, y un `error` sin manejar cuenta como fallo aunque
> ninguna prueba falle.
>
> **Corrección probable cuando reaparezca** (no se hizo: no bloquea nada y se
> prefirió no tocar dos veces el mismo archivo intocable): manejador de `error` en
> el `spawn`, y que `pararServidor()` **espere a que el proceso muera** en vez de
> solo mandar la señal.

> [!danger] 2026-09-01 · y el tercero era EL POOL DE LA APLICACIÓN, no uno de prueba
> La corrida de `v0.3.0` volvió a morir con un `unhandled error` — `57P01`, base
> `spaces_permisos_nueva_e2e`. Los catorce pools del arnés ya estaban vigilados; el
> que faltaba era **el de `lib/server/db.ts`**, que
> `permisos-semilla.e2e.test.ts:280` importa a propósito para probar con él.
>
> **El síntoma era de pruebas; el defecto es de PRODUCCIÓN.** `pg` emite los errores
> de clientes **ociosos** en el pool, no en la consulta, así que ningún `await` los
> recoge — y un `error` sin oyente se lanza. Traducido: **un reinicio de Postgres
> mataba el proceso de la aplicación**, cuando `pg` reconecta solo en la siguiente
> consulta. Caerse era la peor de las respuestas posibles.
>
> Corregido con un oyente que **registra y no traga**: lo único que evita es que el
> error mate el proceso.

> [!danger] 2026-09-02 · SEGUNDA intermitente igual en dos días — ya es una regla
> `lib/alta-correo.test.ts > rechaza el marcador que se coló el 21/08` salió roja
> en la suite completa con **el mismo mensaje** de la de abajo —
> `Test timed out in 5000ms`, medido en **5456 ms** — y **sola pasa en 879 ms**.
>
> **La causa es estructural, no del archivo:** cada uno de sus casos hace
> `spawnSync` de un proceso Node entero, y ese `spawnSync` se da **20 s** de
> presupuesto (`alta-correo.test.ts:43`) mientras vitest corta a los **5000 ms**
> por omisión — no hay `testTimeout` en la configuración. Los dos presupuestos se
> contradecían, así que el resultado dependía de lo ocupada que estuviera la
> máquina.
>
> Corregido subiendo el presupuesto del caso a **25 s**, por encima del del spawn,
> para que si algo se cuelga lo denuncie el `spawnSync` —que sí dice qué pasó— y no
> el corte ciego de vitest. Verificado con **dos corridas completas seguidas en
> verde: 1043 en 99 archivos.**
>
> > **La regla, que es lo que hay que llevarse:** *toda prueba que arranque un
> > proceso necesita un presupuesto de vitest MAYOR que el del proceso que
> > arranca.* Los 5000 ms por omisión son para pruebas que no salen del proceso.
> > Hoy quedan **seis** casos así en este archivo; el que escriba el séptimo en
> > otro sitio va a tropezar con esto mismo.
>
> Y la lección de abajo se confirma por segunda vez en dos días: **el mensaje decía
> «timed out» desde el primer momento.**

> [!success] 2026-09-01, noche · RESUELTA, y la causa era aburrida
> **`Error: Test timed out in 5000ms`.** No fallaba una aserción: la prueba **no
> terminaba a tiempo**. Recorría `app/`, `lib/` y `components/` leyendo cada
> archivo, y lo hacía **cuatro veces** — una por caso. Con la suite en paralelo y
> el árbol creciendo, se pasaba del `testTimeout`.
>
> Por eso «empezó» ahora y por eso era intermitente: **dependía de lo ocupada que
> estuviera la máquina, no del código.**
>
> Se lee una sola vez, al cargar el módulo. Tres corridas completas seguidas en
> verde después del cambio.
>
> **La leccion, y cuesta poco recordarla:** el mensaje decia «timed out» desde el
> primer dia. Dos releases se cayeron mientras se buscaba una causa de
> correccion — quién escribe en ese directorio, si hay una carrera— porque nadie
> abrio el texto del error. **Leer el mensaje antes de teorizar** es la misma
> regla que el 31/08 costo dos corridas con los pools.

> [!warning] 2026-09-01 · hay una prueba INTERMITENTE, y conviene saber su nombre
> `lib/tipografia.test.ts > ningun archivo pide fuentes a un CDN ajeno` falla a
> veces en la suite completa y **siempre pasa corriéndola sola**. Medido: dos
> corridas rojas seguidas y la tercera verde, sin tocar nada.
>
> **La causa NO está identificada.** Recorre `app/`, `lib/` y `components/` leyendo
> archivos, y la suite unitaria corre en paralelo — pero ningún test unitario
> escribe en esos directorios. Se deja escrito con la causa **en blanco** en vez de
> con una hipótesis cómoda: es exactamente el atajo que el 31/08 costó dos corridas
> y media jornada.
>
> Es **anterior** a los cambios del 01/09, y es casi seguro la «1 failed» que el
> 31/08 se vio una vez y no se llegó a capturar.

> [!warning] 2026-08-31 · SQL de prueba que ordena por texto lleva collation EXPLÍCITA
> El segundo defecto de la misma corrida, e **independiente del anterior**:
> `migraciones.e2e.test.ts` comparaba
> `select archivo … order by archivo` contra un `.sort()` de JavaScript.
>
> El `order by` usa **la collation de la base**; el `.sort()` ordena por código
> de carácter. Coinciden en el Postgres local —`postgres:16-alpine`
> (`db/docker-compose.yml:21`), musl, collation **C**— y **no coinciden** en el
> del CI, que es `postgres:16` de **Debian** con glibc `en_US.utf8`: allí la
> puntuación es ignorable en el nivel primario y el `_` deja de contar.
>
> **Medido** el 2026-08-31 contra un `postgres:16` de Debian desechable, con las
> **74** migraciones de esquema reales dentro:
>
> ```
> datcollate              | en_US.utf8      ← el del CI
> filas                   | 74
> posiciones_que_difieren | 4
>
>      por omisión                                collate "C"
>  41  ...contrato_incompleto_cancelable.sql      ...contrato_incompleto.sql
>  44  ...contrato_incompleto.sql                 ...contrato_incompleto_enum.sql
> ```
>
> **Cambian de sitio cuatro**, y son el grupo `20260727_contrato_incompleto*`:
> ignorando el `_`, «cancelable» va por delante de «sql», así que
> `contrato_incompleto.sql` cae de la posición 41 a la 44. Mismos 74 elementos en
> distinto orden → `toEqual` en rojo imprimiendo `[…(74)]` contra `[…(74)]`, que
> no dice nada de la causa.
>
> Y se comprobó lo que hace válida la corrección: `order by archivo collate "C"`
> devuelve **exactamente** el orden del `.sort()` de JavaScript, 74 de 74.
>
> ▸ **Cómo se llegó, que importa más que el número**: primero se *simuló* la
> regla de glibc (puntuación ignorable) y la primera simulación —que solo
> ignoraba el `_`— dijo que **los dos órdenes coincidían**, o sea que la
> hipótesis era falsa. Solo al incluir el `.` apareció el grupo de los cuatro.
> **Una simulación descartó su propia primera versión**; la medición llegó
> después y confirmó el resultado al elemento. Escrito «medido» cuando aún era
> simulado en el commit `e9bf528`: corregido aquí.
>
> **La convención, entonces:** toda consulta de prueba que ordene por una
> columna de texto y se compare contra una lista ordenada en JavaScript lleva
> `collate "C"`. Hoy son tres, todas en `migraciones.e2e.test.ts`.
>
> ▸ **Lo que NO es un problema, comprobado**: `infra/scripts/update.sh:1381`
> usa `string_agg(… order by archivo)` sin collation, pero sus tres huellas
> (`:1504`, `:1518`, `:1857`) se comparan **contra la misma base de la misma
> instancia**, donde la collation es constante. Se revisó por sospecha y quedó
> descartado.
>
> **2026-10-05 · las líneas derivaron, el argumento no.** `update.sh` tiene hoy
> 2863 líneas: el `string_agg(… order by archivo)` está en `:2116` (y hay otro,
> `order by t`, en `:2090`, el de la huella de esquema; mismo razonamiento), y
> las tres lecturas de la huella son `HUELLA_ANTES` `:2426`, `HUELLA_DESPUES`
> `:2440` y `HUELLA_RESTAURADA` `:2817`. Las tres siguen siendo contra la
> misma base.

> [!danger] Las unitarias no ven los fallos de RLS
> Simulan la base. Los dos peores fallos de aislamiento del proyecto pasaron las
> unitarias sin despeinarse. **Todo lo que toque tenant o sesión necesita e2e.**

Las semillas usan fechas **relativas a hoy** (`enDias()`), nunca literales.

## Color de los botones

> [!important] Regla del dueño, 2026-09-30
> «Todo botón sea **azul** para asignar o aceptar; **añadir o agregar, verde**.»

| La acción es… | Variante de `Button` | Color | Ejemplos |
|---|---|---|---|
| **Asignar, aceptar, aprobar, aplicar, confirmar, guardar** | `primary` (la de por omisión) | Azul `--accent` (#0a66ff) | «Asignar a propuesta», «Asignar», «Aprobar código», «Aplicar» |
| **Añadir, agregar, crear algo nuevo** | `success` | Verde #15803d | «Añadir código», «+ Añadir», «Crear paquete» |
| Cancelar, cerrar, volver | `ghost` o `secondary` | Neutro | «Cancelar» |
| Eliminar, dar de baja | `danger` / `ghost` con `text-error` (`dangerFill` solo en `ConfirmDialog`) | Rojo | «Eliminar», «Dar de baja» |

**Se usa el componente `Button`** (`components/demo/ui/Button.tsx`), no un
`<button>` con clases a mano: así el color sale de un solo sitio y además se
hereda el bloqueo del doble clic (A5 / INC-07).

**El verde NO es `--success` (#1da850)**, y no es por gusto: con texto blanco da
**3.1:1**, y WCAG pide 4.5:1 para el texto de un botón. #15803d da **5.0:1**, y
#166534 (al pasar el ratón) **7.1:1**. Si algún día se mapea un token verde
oscuro en `tailwind.config.ts`, la variante `success` es el único sitio que hay
que cambiar.

> [!warning] Desde el 2026-09-30 la regla está aplicada en TODA la aplicación
> Pedido del dueño ese mismo día: «lo de los colores de los botones deben de
> estar en toda la página». Barrido de `app/(app)` y `components/` (rama
> `feat/botones-colores`). El criterio que se siguió, para que el siguiente lo
> repita igual:
>
> - **Verde (`success`)**: el botón que abre o dispara un alta —«+ Nuevo …»,
>   «Agregar», «Añadir», «Invitar usuario», «Alta manual», «Carga masiva»— y
>   el envío de un formulario cuya etiqueta dice literalmente **Crear**
>   («Crear usuario», «Crear OT», «Crear paquete»…).
> - **Azul (`primary`)**: todo lo demás que confirma —«Guardar»,
>   «Registrar», «Aplicar», «Aprobar», «Enviar», «Validar», «Programar»,
>   «Abrir ticket», «Generar…»—. Un envío que no dice «Crear» va en azul
>   aunque dé de alta un registro: se clasifica por la ETIQUETA, no por la
>   tabla que toca.
> - **Rojo**: la confirmación de una baja o un borrado va en `danger`; el
>   «Eliminar» / «Dar de baja» de una fila, en `ghost` con `text-error`.
>
> Se dejaron FUERA a propósito, por categoría: pestañas, filtros y controles
> segmentados (Tarifa/Renta, Fijar/Ajustar, Existente/Nuevo); paginación y
> flechas; botones de solo icono (bote de basura, «×», lápiz); acordeones y
> cabeceras de orden; menú y barra superior; descargas Excel/CSV; las
> herramientas del mapa; los botones `doc-btn` de los documentos imprimibles
> y de firma (estilo propio de papel); la pantalla de
> `codigos-recuperacion`, que va con estilos en línea del navegador; y los
> botones que abren o pliegan un formulario sin ser ellos el alta
> («Código» en Creativos, «Cambiarla / Asignar contraseña»). Los casos
> dudosos quedaron neutros, y **al tocar una pantalla se ajustan sus botones a
> esta tabla en el mismo cambio**.

: con coma,
  Excel lee texto y no puede sumar.
- Lo que ya se **guardó** como texto (p. ej. el historial de cambios del
  contrato, `12000.00`) no se reescribe: se formatea **al mostrarlo**
  (`valorParaMostrar`, `lib/contrato-cambios.ts`).
- Los **campos donde se teclea** todavía no muestran la coma (son
  `<input type="number">`): es la fase 2, pendiente.

`lib/formato-numero.guardia.test.ts` caza lo que se puede cazar en el fuente:
un `toLocaleString` con otro locale y el eje «`${v / 1000}k`».

## Nombres

| Cosa | Patrón | Ejemplo |
|---|---|---|
| Repo | `<dominio>-repo.ts` | `campanas-repo.ts` |
| Controller | `<dominio>-controller.ts` | `perfil-controller.ts` |
| Prueba unitaria | `<archivo>.test.ts` o `<archivo>.<caso>.test.ts` | `sitios-repo.modalidades-tenant.test.ts` |
| Prueba e2e | `<tema>.e2e.test.ts` | `aislamiento.e2e.test.ts` |
| Migración | `YYYYMMDD_descripcion.sql` | `20260806_identidades_externas.sql` |
| Nota de despliegue | `DESPLIEGUE_<TEMA>.txt` en la raíz | `DESPLIEGUE_GOOGLE.txt` |
| ADR | `docs/adr/NNNN-titulo-kebab.md` | `0012-acceso-con-cuenta-de-google.md` |

## Commits

Convencionales, **en español, sin acentos** (por compatibilidad del terminal):

```
feat(auth): entrar con Google — las dos rutas del ADR 0012
fix(seguridad): el desbloqueo leia `usuarios` sin contexto de tenant
docs(cambios): por que el tablero tardaba, y por que no era la base
test(integracion): el flujo de Google de punta a punta
```

El cuerpo del commit se usa **de verdad**: explica el porqué, lo que apareció al
hacerlo, y qué se verificó.

## La bitácora es parte del trabajo

`docs/Registro_Cambios.md` — entrada más reciente arriba, agrupada por fecha.
Está escrita **para quien no programa**: explica el impacto y el porqué en
lenguaje llano, no el diff.

> [!tip] Patrón habitual
> Un commit de código va seguido de un `docs(cambios):` que lo registra. Si tu
> cambio se nota desde la aplicación, tiene entrada en la bitácora.

## Dependencias

`docs/DEPENDENCIAS.md`: nunca tocar `package.json` sin regenerar el lockfile;
nada de rangos flotantes en lo crítico. Añadir una dependencia se justifica por
escrito. Ver [[stack-y-dependencias]].

## Documentación

| Documento | Para qué |
|---|---|
| ADR (`docs/adr/`) | Una decisión de diseño, con alternativas descartadas |
| Runbook (`DESPLIEGUE_*.txt`) | Pasos de un despliegue, marcados cuando se ejecutan |
| Bitácora | Qué cambió, para el negocio |
| Esta bóveda | Cómo funciona el sistema, para quien va a tocarlo |

## Validar la bóveda contra el código

La bóveda **caduca**. Se escribió el 07/08 y en cinco horas quedaron obsoletas
cuatro afirmaciones. Estos cuatro chequeos son mecánicos y detectan la mayoría de
la deriva. Correrlos al retomar el proyecto tras unos días, y siempre después de
un lote grande de commits.

### 1 · Los recuentos siguen cuadrando

> [!important] 2026-10-05 · esto ya no se cuenta a mano: `node scripts/recuentos.mjs`
> Desde el 18/09 existe `scripts/recuentos.mjs`, que mide de una vez
> **endpoints, tablas, migraciones, ADR, notas de la bóveda, enlaces internos,
> wikilinks rotos y notas huérfanas** sobre el árbol donde se corre. Cubre los
> chequeos **1 y 2** de esta sección. Se corre **desde la raíz del worktree**:
>
> ```
> node scripts/recuentos.mjs
> ```
>
> Al 2026-10-05, en `integra/riesgos-presentacion-14-oct`: **124 endpoints ·
> 57 tablas · 106 migraciones · 42 ADR · 100 notas · 1287 enlaces · 2 rotos**
> (los dos apuntan a ADR, que viven en `docs/`) **· 0 huérfanas**, medido **al
> empezar** la puesta al día. Al terminarla, con cinco agentes editando la
> bóveda en el mismo árbol, los enlaces ya eran **1432** — la misma tarde, el
> mismo árbol. Es una foto: córrelo tú.
>
> Lo que **no** mide: las pruebas (se miden corriéndolas) ni los chequeos 3 y 4
> (rutas citadas y números de línea). Y cómo cuenta, para no confundirse
> (`scripts/recuentos.mjs:41-46` y `:51-62`): las tablas son **nombres
> distintos** que casan `create table [if not exists] [public.]` en
> `schema.sql` y en todas las migraciones, no líneas `^create table`; los
> enlaces excluyen los de ancla (`[^]|#]`, la quinta trampa) y se resuelven
> **por el último segmento**, así que dos `_indice` no dan falsa huérfana pero
> tampoco distinguen cuál de los dos falta; y un wikilink escrito como ejemplo
> entre backticks **sí** cuenta. Los comandos de PowerShell de abajo siguen
> valiendo como comprobación independiente, pero **no son el camino
> principal**.

```powershell
"endpoints: $((Get-ChildItem apps\web\app\api -Recurse -Filter route.ts).Count)"
"migraciones: $((Get-ChildItem db\migrations\*.sql).Count)"
"tablas: $(Select-String db\schema.sql,db\migrations\*.sql -Pattern '^create table' | Measure-Object).Count"
```
Contrastar con [[MOC-Proyecto]], [[api-endpoints]], [[esquema]] y
[[migraciones]].

### 2 · Todo wikilink resuelve y nada queda huérfano

Extraer los enlaces internos (dobles corchetes) de cada nota y comprobar que
existe un `.md` con ese `BaseName` — o con esa ruta relativa, para los que van
con carpeta, tipo `02-Backend/_indice`. Al 10/08: **395 enlaces, 0 rotos, 0
huérfanas**. Al 17/08, con el diario recuperado: **606 enlaces, 0 rotos, 0
huérfanas** sobre 48 notas. Al 27/08: **726 enlaces, 0 rotos, 0 huérfanas**
sobre 56 notas — tras arreglar los tres de la tercera trampa, abajo. Al
**28/08**: **753 enlaces, 0 rotos, 0 huérfanas** sobre **57** notas. Al
**2026-10-05**, con `node scripts/recuentos.mjs`: **1287 enlaces** al empezar
la puesta al día de ese día y **1432** con ella a medias, **2 rotos**
(los dos a ADR de `docs/`, la tercera trampa de abajo) **y 0 huérfanas** sobre
**100** notas.

> [!tip] Quinta trampa: los enlaces a un ancla de la propia nota no son enlaces a notas
> `manual-tecnico` usa 19 enlaces del tipo dobles-corchetes-almohadilla-título
> para su índice interno. Un extractor que corte por la almohadilla se queda con
> la cadena vacía y los declara **rotos**: son 19 falsos positivos y aparecen
> todos en la misma nota. Descuéntalos antes de comparar con la cifra de arriba
> —753 son enlaces a notas; 772, con las anclas dentro—. Y la huérfana que
> aparece cada vez es **la entrada del diario del día**: se cierra enlazándola
> desde [[MOC-Proyecto]], no dejándola suelta.

> [!warning] Dos `_indice.md` distintos rompen los verificadores ingenuos
> `02-Backend/_indice.md` y `03-Frontend/_indice.md` comparten `BaseName`. Un
> script que indexe por nombre y no por ruta colapsa los dos en uno y declara
> **huérfana** a la que pierda el sorteo. Pasó el 17/08 y el falso positivo
> parecía real. Resuelve por ruta cuando el enlace la traiga.

> [!tip] Ojo con los ejemplos de sintaxis
> Un extractor ingenuo también captura los dobles corchetes escritos como
> ejemplo dentro de una nota, aunque estén entre backticks, y los reporta como
> rotos. Por eso esta sección los describe en palabras en vez de escribirlos.

> [!warning] Tercera trampa: un wikilink NO puede salir de la bóveda
> Encontrada el **27/08**, y eran tres a la vez. `entorno-y-despliegue`,
> `vision-general` y `verificacion-de-produccion` enlazaban al ADR 0021 con
> dobles corchetes y ruta `../../docs/adr/...`. El archivo **existe**, pero
> Obsidian solo resuelve wikilinks dentro de la bóveda: los tres quedaban muertos
> al hacer clic. **Fuera de `vault/` se cita con enlace Markdown normal**, que es
> lo que ya hacían el MOC y el resto de la tabla de `entorno-y-despliegue`.
> Un verificador que solo busque el archivo en disco **no los ve**: hay que
> comprobar que el destino esté dentro de `vault/`.

> [!warning] Cuarta trampa: no todo recuento de endpoints cuenta lo mismo
> Al 27/08 convivían tres cifras —88, 89 y 90— y ninguna era mentira: **90** son
> los `route.ts` de hoy, **89** era la cifra buena antes de que naciera
> `/api/version` (26/08), y los **«72 endpoints censados»** de los commits del
> 26/08 son el subconjunto que **recibe cuerpo**, del censo de validación de
> entrada. Antes de corregir una cifra, averigua **qué** contaba.

### 3 · Toda ruta citada existe

Tanto las de `archivos:` en el frontmatter como las de los cuerpos entre
backticks. **Dos avisos** si automatizas esto:

- las rutas se escriben relativas al **repo** (`apps/web/lib/…`) o a
  **`apps/web`** (`lib/server/…`); hay que probar las dos bases;
- `Test-Path` trata `[token]` y `[id]` como comodines — usa **`-LiteralPath`** o
  darán falsos negativos en todas las rutas dinámicas de Next.

> [!warning] Segunda trampa de la misma familia: los paréntesis de los *route groups*
> Un verificador que recorte la puntuación final de la cadena se come el `)` de
> `apps/web/app/(app)/(shell)/` (frontmatter de [[modulos-internos]]) y la marca como
> rota. **Es un falso positivo**: el directorio existe. Trata `(`, `)`, `[` y `]` como
> **literales**, no como sintaxis ni como puntuación a limpiar.
> Descubierto en la auditoría del 17/08, que también tropezó con el caso contrario:
> exigir la ruta completa marca como rotas todas las migraciones y los ADR, porque la
> bóveda los cita por nombre a secas (`20260720_hard1_usuarios_rls.sql`, sin
> `db/migrations/`). Hace falta resolver también por sufijo y por nombre de archivo.

### 4 · Los números de línea no han derivado

Es el chequeo que más deriva encuentra y el único que no es binario. Por cada
cita `archivo.ts:N`, leer la línea N y comprobar que dice lo que la nota afirma.

> [!warning] Un archivo que crece invalida todas sus citas de golpe
> `lib/server/auth.ts` pasó de 188 a 230 líneas al añadir `passwordAleatoria()`,
> y con eso **ocho** citas de cinco notas distintas apuntaron a la línea
> equivocada. Ninguna daba error: simplemente mandaban al sitio erróneo.

### Y lo que ningún script detecta

Que una nota describa correctamente algo que **ya se decidió de otra forma**. El
ADR 0012 pasó de «Google no da de alta» a lo contrario en una tarde, y las rutas,
los enlaces y los recuentos seguían perfectos. Para eso: leer
`git log --since` y `docs/Registro_Cambios.md` desde la fecha del último
`actualizado:`.

## Relacionadas
[[zonas-de-riesgo]] · [[AGENTES]] · [[migraciones]] ·
[[stack-y-dependencias]] · [[MOC-Proyecto]]

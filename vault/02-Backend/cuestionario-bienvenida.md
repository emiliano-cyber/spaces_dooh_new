---
tipo: modulo
estado: verificado
actualizado: 2026-09-18
tags: [backend, frontend, entidades, fiscal, administracion, bienvenida, onboarding, tenant]
archivos:
  - apps/web/lib/cuestionario-entidades.ts
  - apps/web/lib/cuestionario-entidades.test.ts
  - apps/web/lib/server/bienvenida-repo.ts
  - apps/web/lib/server/bienvenida-repo.test.ts
  - apps/web/lib/server/bienvenida-controller.ts
  - apps/web/lib/server/bienvenida-controller.test.ts
  - apps/web/app/api/bienvenida/route.ts
  - apps/web/app/(app)/bienvenida/page.tsx
  - apps/web/components/demo/bienvenida/CuestionarioRazonesSociales.tsx
  - apps/web/components/demo/bienvenida/PreguntaSiNo.tsx
  - apps/web/lib/test/bienvenida.e2e.test.ts
---

# El cuestionario de bienvenida

Las **tres preguntas** que el dueño pidió el **2026-09-17**, y lo que hacen:
crear las razones sociales del owner con sus papeles. Nació el **2026-09-18**
sobre la infraestructura de [[02-Backend/entidades-fiscales]], que es del día
anterior.

> [!important] No es una encuesta
> De las tres respuestas salen filas en `entidades_fiscales` y en
> `entidad_roles`. No hay ninguna tabla de «respuestas» ni ningún campo que
> guarde lo contestado: **las respuestas SON las entidades**. Si un documento te
> habla de guardar el cuestionario, describe otra cosa.

## Las tres preguntas, textuales

1. ¿Tu empresa tiene varias razones sociales? (sí/no)
2. ¿La operación está en la misma razón social que comercializa o factura las
   ventas? (sí/no)
3. El mapa **rol → razón social**, con los roles de `catalogo_roles_entidad`.

Las dos primeras existen para **SIMPLIFICAR la tercera**, no para repetirla, y
ahí está la mitad del valor del módulo:

| Respuesta 1 | Respuesta 2 | Campos del paso 3 |
|---|---|---|
| No, una sola | *no se pregunta* | **1** — y esa razón social se queda con los cinco roles |
| Sí, varias | Sí, coinciden | **4** — operación y ventas comparten un campo |
| Sí, varias | No, separadas | **5** |

Quien contesta «una sola» **no teclea el mismo nombre cinco veces**
(`cuestionario-entidades.ts:286`, y su prueba en
`cuestionario-entidades.test.ts`). Si esa simplificación se rompe, las preguntas
1 y 2 dejan de servir para nada y son solo dos preguntas más.

## Por qué va DESPUÉS del alta y no dentro

> [!danger] El bootstrap es de UN SOLO USO
> `hayAlgunTenant()` cierra la puerta para siempre en cuanto existe una
> organización. Meter un paso más en el alta deja **instancias que no pueden
> nacer**, y eso no se descubre hasta que una falla.
>
> Por eso el cuestionario es una pantalla y una ruta aparte, y **el flujo de
> alta no se tocó**: ni `cuentas-controller.ts`, ni `tenant.ts`, ni
> `/api/signup`, ni `/api/bootstrap`, ni `/api/organizacion`, ni
> `bootstrap-auth.mjs`. Ver [[02-Backend/autenticacion-y-sesion]].

De esa decisión salen las dos derivaciones que **evitan una migración y evitan
estado**:

1. **«El cuestionario está pendiente» se DERIVA**: la organización no tiene
   ninguna fila en `entidades_fiscales` ⇒ falta contestarlo
   (`cuestionario-entidades.ts:344`). **No hay columna nueva en `tenants` ni en
   `config_negocio`, y no hay migración.** Un estado guardado puede quedar
   desincronizado del hecho que describe; un recuento no.
2. **Los defaults se DERIVAN de los roles**: si una sola entidad tiene `VENTAS`,
   ésa es el emisor por omisión; si venden dos, **ninguna**
   (`cuestionario-entidades.ts:362`). Adivinar sería emitir a nombre de la
   sociedad equivocada sin que nadie lo hubiera decidido. Se autocorrige solo al
   alta de la segunda, así que no hay nada que guardar.

> [!warning] El recuento cuenta TAMBIÉN las dadas de baja
> `bienvenida-repo.ts:68` no filtra por `activo`, y es deliberado: haber
> contestado el cuestionario es un **hecho histórico**. Con el filtro puesto,
> quien desactivara todas sus razones sociales volvería a ver el cuestionario y
> crearía el duplicado que este módulo existe para evitar. Su prueba se pone
> roja si alguien añade el filtro.

## Las capas

`route.ts` → `bienvenida-controller.ts` → `bienvenida-repo.ts` → `db.ts`, como
manda [[06-Operacion/convenciones]]. Y **una cuarta pieza que no es una capa**:
un módulo puro sin acceso a base.

| Archivo | Qué decide | Líneas |
|---|---|---|
| `lib/cuestionario-entidades.ts` | La traducción respuestas → entidades y roles. **Puro** | 395 |
| `lib/server/bienvenida-repo.ts` | El SQL, la transacción y el cerrojo | 182 |
| `lib/server/bienvenida-controller.ts` | Forma de la entrada, permiso de escritura, HTTP | 130 |
| `app/api/bienvenida/route.ts` | Guard y bitácora | 67 |
| `app/(app)/bienvenida/page.tsx` | Carga, «ya contestado», saltar | 148 |
| `components/demo/bienvenida/*` | El formulario y la pregunta de sí/no | 305 |

### Por qué hay un módulo PURO, y es lo primero que hay que entender

> [!important] `vitest.config.ts` no monta jsdom, a propósito
> Lo dice en su propia cabecera: un `.tsx` no se puede probar en este
> repositorio. **Una decisión de negocio escrita dentro de una pantalla no la
> prueba nadie**, y en este repo ya costó caro — al sacar una a un módulo propio
> aparecieron **nueve casos en rojo**.
>
> La traducción de las tres respuestas al conjunto de entidades es exactamente
> esa clase de decisión, y de las caras: una traducción mal hecha **no da
> error**, da una identidad fiscal equivocada, y con ella rentas pagadas y
> comprobantes emitidos a nombre de quien no era.

Consecuencia práctica que conviene no deshacer: la pantalla **llama** a
`planDelCuestionario` y a `camposDelPaso3` en vez de reimplementarlas
(`CuestionarioRazonesSociales.tsx`). El aviso que ve el usuario antes de enviar
sale de la misma función que el 400 del servidor, así que **no pueden
contradecirse** — no es una validación duplicada, es la misma.

| Función pura | Qué hace | Línea |
|---|---|---|
| `planDelCuestionario` | Respuestas → `{ razonSocial, roles }[]`, o el porqué de que no | `:134` |
| `camposDelPaso3` | Qué campos pintar, ya simplificados por la 1 y la 2 | `:286` |
| `faltaContestarCuestionario` | La derivación de «pendiente» | `:344` |
| `emisorPorOmision` | La derivación de los defaults | `:362` |
| `claveRazonSocial` | Cuándo dos campos hablan de la MISMA sociedad | `:114` |
| `resumenParaBitacora` | El texto de `registrarAccion` | `:387` |

### El catálogo de roles entra por parámetro, siempre

`planDelCuestionario` recibe la lista de roles; **no la conoce**. El controller
la **consulta** (`bienvenida-controller.ts:114`). Es la decisión del módulo de
entidades llevada hasta aquí: `rol` es texto con catálogo y no un `enum` para
que añadir un rol sea un `insert` y no una migración con su despliegue detrás, y
una constante en el código habría anulado ese motivo.

La **única** excepción son los dos roles que la pregunta 2 relaciona
(`ROL_OPERACION` y `ROL_VENTAS`, `:41-42`), y es inherente a la pregunta: el
dueño preguntó por «operación» y por «facturación/ventas» por su nombre, así que
sin nombrarlos no hay pregunta 2. Si el catálogo recibido no los trae, **la
pregunta se ignora** en vez de dar un error que nadie puede arreglar.

## La agrupación: una razón social con varios roles es UNA entidad

Es el caso normal y no la excepción — por eso `entidad_roles` admite varios por
entidad y solo prohíbe el mismo dos veces. Dos campos con el mismo nombre se
agrupan, y la comparación ignora **mayúsculas, acentos, puntos y comas**
(`claveRazonSocial`, `:114`): «ACME, S.A. de C.V.» y «Acme SA de CV» son la
misma empresa teclada dos veces.

Dos detalles medidos que no se ven leyendo:

- Los puntos se **borran** y las comas se convierten en espacio, no al revés. Si
  el punto se cambiara por espacio, «S.A.» quedaría «S A» y **no** coincidiría
  con «SA», que es justo el caso que esto viene a resolver.
- Lo que va a la base es la **primera forma que un humano escribió**, no la
  clave normalizada: «ACME SA DE CV» no es como se llama la empresa.

## Los endpoints

| Método | Ruta | Guard |
|---|---|---|
| GET | `/api/bienvenida` | `exigir('administracion','ver')` (`route.ts:37`) |
| POST | `/api/bienvenida` | `exigir('administracion','crear')` (`route.ts:53`) |

**`administracion` y no otro módulo**, igual que `/api/entidades` y por el mismo
motivo: esto es la identidad fiscal del negocio —a nombre de quién paga y
factura—, no un dato operativo. Quien captura contratos no decide con qué
sociedad se firma.

El GET devuelve `{ pendiente, totalEntidades, roles, entidades }`. Las entidades
ya creadas viajan también para que **quien vuelva vea lo que contestó** en vez de
una pantalla en blanco.

El POST deja entrada en la bitácora de acciones con `registrarAccion`, y el texto
**nombra cuántas razones sociales y con qué roles** (`resumenParaBitacora`): el
papel es la parte que decide qué documentos salen a nombre de cada entidad, y
quien revise después tiene que poder leerlo sin abrir la base.

## O quedan TODAS, o ninguna

`crearEntidadesDelCuestionario` (`bienvenida-repo.ts:161`) hace **todo** dentro
de un `withTenantTx`. No es un detalle de estilo: a medias es **peor** que no
haberlo contestado, porque el estado se deriva de que exista alguna entidad y el
cuestionario **ya no se volvería a ofrecer**.

> [!warning] Hay un cerrojo, y el recuento del controller NO es la cerradura
> El recuento de `bienvenida-controller.ts:107` y los `insert` no son la misma
> transacción, así que dos pestañas —o dos dispositivos, o un reintento de red—
> pueden contar las dos cero y escribir las dos.
>
> Dentro de la transacción se toma `pg_advisory_xact_lock`
> (`bienvenida-repo.ts:168`) **antes** del recuento (`:170`), y con eso la
> segunda encuentra 1 y sale con `{ ok: false, yaHabia }`, que el controller
> convierte en **409**. El orden lo fija una prueba: si alguien mueve el cerrojo
> detrás del recuento, se pone roja.
>
> El cerrojo usa la **forma de dos enteros** y las dos mitades del uuid
> calculadas en JavaScript (`cerrojoDeTenant`, `:104`), no `hashtext()`:
> `hashtext` es una función interna de Postgres, sin documentar, y apoyar un
> cerrojo en algo así es apostar a que no cambie nunca. El `| 0` convierte al
> int32 **con signo** que espera pg — sin él, un uuid que empiece por `f`
> desborda el tipo y la consulta falla en vez de bloquear.
>
> Y no hace falta ninguna migración para tenerlo, que es lo que lo hace la
> opción correcta aquí: un índice único sobre «tener alguna entidad» no se puede
> expresar.

## Aislamiento

> [!danger] `entidad_id` NO es una frontera de seguridad
> La frontera sigue siendo **UNA**: `tenant_id` con RLS — el
> `set_config('app.tenant_id', ..., true)` de `apps/web/lib/server/db.ts:79`
> (`q`) y `:60` (`fijarTenant`), medido el 18/09. **Ojo si venías de
> [[02-Backend/entidades-fiscales]]: esa nota cita `db.ts:54-69` y ese rango ya
> derivo** — la 54 es hoy el `return` de otra funcion. Toda consulta de `bienvenida-repo.ts`
> lleva `and tenant_id = $n` **explícito** como segunda capa, usa `q` y **nunca
> `qRaw`**. `bienvenida-repo.test.ts` barre el archivo: una función nueva que se
> olvide del tenant cae ahí sin que nadie escriba su caso, y el doble de `qRaw`
> **lanza** en vez de dejar pasar la consulta sin contexto.
>
> La subconsulta de roles lleva **su propio** `tenant_id` y no se apoya en que el
> padre ya esté acotado: si un día cambia el `from`, se queda leyendo
> `entidad_roles` de toda la base sin que nada falle. Ver
> [[02-Backend/multi-tenancy-y-rls]] y [[06-Operacion/zonas-de-riesgo]].

El único `select` **sin** `tenant_id` es el del catálogo
(`bienvenida-repo.ts:51`), y eso es correcto: `catalogo_roles_entidad` no tiene
esa columna porque es vocabulario del producto, igual para toda la flota. Hay una
prueba que lo **fija**, para que nadie «arregle» la consulta añadiéndole un
filtro que no existe.

## Nadie queda encerrado

- **Se puede saltar.** Botón «Lo hago más tarde»: la aplicación funciona igual.
  Un paso obligatorio aquí dejaría al Dueño fuera de su propia aplicación por un
  dato que quizá tiene que preguntarle a su contador.
- **Se puede volver.** `/bienvenida` sigue siendo alcanzable.
- **Si ya hay entidades, no se vuelve a ofrecer**: la pantalla lo dice, enseña
  las que hay y manda a Administración, que es donde se cambian. Y el POST
  responde **409**, no un 400 confuso.

La pantalla vive **fuera de `(shell)`** a propósito: es una pantalla de una sola
tarea, y el chrome de navegación invita a irse a mitad. Irse con el botón es
distinto de irse sin enterarse. Ver [[03-Frontend/shell-y-navegacion]].

## Lo que está probado, y a qué nivel

| Nivel | Archivo | Casos | Qué demuestra |
|---|---|---|---|
| Unitaria | `cuestionario-entidades.test.ts` | 33 | La traducción, las dos derivaciones y **todos** los negativos |
| Unitaria | `bienvenida-controller.test.ts` | 14 | Que nada se escribe con respuestas inválidas, y el 409 por los dos caminos |
| Unitaria | `bienvenida-repo.test.ts` | 11 | Que toda consulta nombra `tenant_id`, el orden cerrojo→recuento→insert, y la atomicidad |
| **Integración** | `bienvenida.e2e.test.ts` | **18** | Aislamiento con RLS de verdad, la reversión de la transacción, el 409 y la carrera de dos POST simultáneos |

Medido el **2026-09-18** en el worktree `ola2/cuestionario`: **1308 unitarias en
114 archivos**, verde, y `npm run typecheck` limpio. El rojo previo fueron
**58 de 58**.

Los negativos son el corazón, y son éstos:

- contestar «una sola razón social» y mandar **cinco distintas**;
- contestar «una sola» y **una sola** distinta de la única — más sutil, y por eso
  peor: una discrepancia no salta a la vista, y elegir en silencio cuál gana es
  inventarse la identidad fiscal del negocio;
- un rol que **no está en el catálogo**, con el mensaje diciendo cuáles hay;
- contradicción entre la pregunta 2 y el mapa **en las dos direcciones**:
  «juntas» con dos distintas, y «separadas» con la misma para las dos;
- «una sola razón social» y a la vez operación y ventas separadas;
- **contestarlo dos veces**: 409 y ni una fila, por el recuento de fuera y por el
  cerrojo de dentro;
- un sí/no que llega como la cadena `"no"`, que aceptada sería **verdadera** —
  por eso el schema usa `z.boolean()` y no `z.coerce.boolean()`
  (`bienvenida-controller.ts:39`).

> [!important] Las unitarias NO ven los fallos de RLS
> Simulan la base, y los dos peores fallos de aislamiento de este proyecto las
> pasaron sin despeinarse. El aislamiento lo tiene que demostrar una e2e contra
> Postgres real y con `poolApp()`, nunca con el pool de administración: el rol
> `spaces` es superusuario y se salta la RLS aunque la tabla tenga FORCE.

> [!success] 2026-09-18, tarde · las tres e2e YA EXISTEN
> `apps/web/lib/test/bienvenida.e2e.test.ts`, **18 casos**, contra Postgres real
> y con `poolApp()`. Cubre las tres que este aviso reclamaba:
> 1. el mismo cuerpo desde dos sesiones distintas **no cruza ni una fila**;
> 2. un plan que falla a mitad deja **cero** filas, no la primera entidad;
> 3. el segundo POST responde **409 sin escribir**, y **dos POST simultáneos**
>    dejan exactamente un 201, un 409 y cinco filas.
>
> **Y demostradas por mutación**: con la política de RLS reescrita a
> `using (true)` se ponen rojas **cuatro** aserciones de aislamiento; con
> `contarEntidadesDelTenant()` además sin su `and tenant_id`, se pone roja la
> que afirma que el recuento de A es **5 y no 10**. Revertido las dos veces.

> [!danger] Corrección medida · el «rol inválido» NO sirve para probar la reversión
> Este aviso proponía provocar el fallo a mitad con **un rol fuera del
> catálogo**, y ese camino **no toca la transacción**: `planDelCuestionario`
> rechaza el rol y el controller devuelve **400 antes de abrirla**
> (`bienvenida-controller.ts`, el `if (!plan.ok)` va antes del
> `crearEntidadesDelCuestionario`). Una prueba montada así saldría **verde con
> la transacción quitada**: verde por vacuidad.
>
> Lo que sí ejercita la reversión es cualquier cosa que reviente en el **segundo
> insert**. La e2e lo reproduce con un **trigger de prueba** que rechaza el
> segundo insert de un tenant, y comprueba antes —con dos inserts a pelo— que el
> trigger deja pasar el primero: sin esa comprobación, el cero final no
> distinguiría «revirtió» de «nunca escribió nada».

## Lo que este módulo NO hace

- **No toca el alta.** Ver el aviso de arriba: el bootstrap es de un solo uso.
- **No escribe ninguna migración** ni añade columnas. Las dos preguntas de estado
  se derivan.
- **No asigna entidad a un contrato ni a una factura.** Las columnas
  `contratos_arrendamiento.entidad_id` y `facturas.entidad_emisora_id` existen y
  siguen sin escribirse desde la aplicación — igual que el 17/09. Lo que este
  módulo añade es el `emisorPorOmision` que esa pantalla necesitará.
- **No edita ni da de baja entidades.** Eso es `/api/entidades/[id]`, en
  [[02-Backend/entidades-fiscales]].
- **No tiene entrada de menú.** La pantalla existe y es alcanzable por su ruta,
  pero `lib/modulos.ts` y `components/demo/shell/nav.ts` los tenía otro agente
  el 18/09. Sin ella, **nadie llega solo al cuestionario**: es lo primero que
  hay que integrar.

## Relacionadas

[[02-Backend/_indice]] · [[02-Backend/entidades-fiscales]] ·
[[02-Backend/multi-tenancy-y-rls]] · [[02-Backend/autenticacion-y-sesion]] ·
[[02-Backend/finanzas-y-cobranza]] · [[03-Frontend/shell-y-navegacion]] ·
[[06-Operacion/zonas-de-riesgo]] · [[06-Operacion/convenciones]] ·
[[04-Datos/esquema]]

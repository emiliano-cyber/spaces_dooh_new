---
tipo: modulo
estado: verificado
actualizado: 2026-09-18
tags: [frontend, reportes, rentabilidad, finanzas, dinero]
archivos:
  - apps/web/app/(app)/(shell)/reportes/page.tsx
  - apps/web/components/demo/reportes/consulta.ts
  - apps/web/components/demo/reportes/estado.ts
  - apps/web/components/demo/reportes/tabla.ts
  - apps/web/components/demo/reportes/tabla.dimensiones.test.ts
  - apps/web/components/demo/reportes/FiltrosRentabilidad.tsx
  - apps/web/components/demo/reportes/TablaRentabilidad.tsx
  - apps/web/lib/modulos.ts
  - apps/web/components/demo/shell/nav.ts
---

# Pantalla de reportes de rentabilidad

`/reportes`, dentro del shell. Nació el **2026-09-18**, un día después del
endpoint que consume ([[02-Backend/reportes-rentabilidad]]), y esa misma tarde
se le arreglaron **tres defectos que solo se vieron ABRIÉNDOLA** — ver
§ «Los tres defectos que solo vio un navegador».

> [!important] Las columnas SALEN DE LA DIMENSIÓN
> Es lo segundo más importante de esta nota, después del límite del store.
> `columnasDeDimension()` (`components/demo/reportes/tabla.ts`) decide qué
> columnas hay, cómo se llama la primera y con qué orden abre la tabla. No hay
> un juego fijo de siete columnas: `operacion` trae visitas, proporción de
> operación y horas en sitio; `m2` trae superficie e ingreso y margen por metro;
> `trimestre` llama «Trimestre» a su primera columna y ordena **cronológico**.

> [!important] Pide sus números al ENDPOINT, nunca al store. Es lo único
> importante de esta nota
> Todas las demás pantallas de analítica leen del store: `/api/estado` devuelve
> 24 rebanadas de tablas completas (`app/api/estado/route.ts:98-130`) y el front
> deriva con `useStoreMemo` (`lib/data/client.ts:329`). **Ese camino ya reventó
> una vez: 6.12 MB y pantalla en blanco de 6 a 12 segundos, sin dar error**
> —lo cuenta su propio código en `app/api/estado/route.ts:142-146`—.
>
> Un reporte de rentabilidad verá **historia de años**: por ahí su volumen
> crecería con la antigüedad de la cuenta, no con el periodo consultado. Y el
> porte a agregación SQL —que es lo que vendrá— obligaría a **rehacer la
> pantalla entera** si se hubiera colgado del store.
>
> **Medido en el presupuesto de la ruta**, que es la evidencia y no la
> intención: `npm run build` del 18/09 da `/reportes` en **110 kB** de primera
> carga, contra **533 kB** de `/inicio` y **158 kB** de `/finanzas`.

## Es UNA pantalla, no cinco

Lo que se pidió fue «sacar diferentes reportes de analíticas»: rentabilidad por
sitio, por m², por trimestre, por consumo de luz y por operación. Son la **misma
pregunta** —qué ingresa y qué cuesta cada cosa— agrupada de otra forma, así que
es **un tablero con un selector de dimensión**.

Cinco secciones serían cinco copias de la misma tabla, y divergirían a la
primera corrección: es el error de raíz que este repositorio documenta en
`lib/server/tenant.ts:86-88`.

## Los cuatro archivos, y por qué están partidos así

| Archivo | Qué decide |
|---|---|
| `components/demo/reportes/consulta.ts` | La ruta, los enums de los selectores, la querystring, la validación previa del rango, **el rango de apertura** y **qué es una fila** en cada dimensión (`sustantivoFila`) |
| `components/demo/reportes/estado.ts` | Las **seis** fases: `inicial · cargando · invalido · error · vacio · datos` |
| `components/demo/reportes/tabla.ts` | **Las columnas de cada dimensión**, el encabezado de la primera, el orden inicial, el ordenamiento, los formatos y los avisos |
| `app/(app)/(shell)/reportes/page.tsx` | El cableado: `useEffect`, `fetch`, y qué componente se pinta en cada fase |

> [!warning] Nada que pueda equivocarse vive en un `.tsx`, y no es una
> preferencia de estilo
> `vitest.config.ts` **no monta jsdom, a propósito** (lo dice en su propia
> cabecera: un `.tsx` pediría dependencias que este repo no tiene). Consecuencia
> exacta: **una decisión escrita dentro de un componente no la prueba nadie**.
>
> Ya pasó: la decisión de negocio de la compuerta del shell vivía en un `.tsx`,
> se sacó a `components/demo/shell/compuerta.ts` y **aparecieron nueve casos en
> rojo**. Aquí se hizo al revés desde el principio, y los dos `.tsx` se quedan
> con pintar. Medido el 18/09 tras la ola 3: **102 pruebas en 5 archivos**
> (22 · 17 · 17 · 38 · 8).
>
> **Y aun así los tres defectos de la ola 3 pasaron por aquí sin rozarse con
> nada**, porque ninguno era una decisión mal escrita: eran decisiones **que no
> estaban escritas en ningún sitio**. Ver la sección siguiente.

## Lo que encontraron las PRUEBAS el día uno

- **El `null` de `margenPct` va al final en las DOS direcciones.** Es el único
  sitio de la pantalla donde el ordenamiento puede **mentir sin dar error**:
  `null` significa «no hubo ingreso», no «0 %», y tratado como cero coloca la
  pantalla que costó 15 000 y no vendió nada entre las que quedaron a la par.
  Se pinta «—», nunca «0 %».
- **La matriz completa de `status × filas × mensaje`** para que la fase no sea
  nunca `cargando` con una respuesta ya recibida. El spinner infinito aparece en
  la combinación que nadie escribe a mano.
- **El rango invertido se detecta por calendario**, reusando `ordenInvertido()`
  de `lib/server/fechas.ts` —el mismo que usa el controller— y no comparando
  texto: `'2026-9-1'` va después de `'2026-10-01'` como cadena y antes en el
  calendario. Ese defecto **ya se pagó dos veces** en este repo.

> [!danger] Dos defectos aparecieron al CABLEAR, no al leer
> **1 · Un fallo de red se pintaba como «sin movimiento en este periodo».** Un
> `fetch` que no llega no trae status HTTP, así que la pantalla lo representa
> con `status: 0`. Con el corte escrito como `status >= 400`, ese caso caía por
> debajo y con cero filas daba el vacío: **una afirmación falsa sobre el negocio
> encima de un cable desconectado**. El corte es ahora «solo 2xx trae reporte»
> (`estado.ts`). Es el hallazgo **C1** de la auditoría QA otra vez —el sistema
> vacío indistinguible del no cargado—, y no da ningún error.
>
> **2 · La ruta necesitaba el `basePath` y la barra final.**
> `next.config.mjs:126-127` declara `basePath: '/spaces-dooh'` y
> `trailingSlash: true`. Escrita como `/api/reportes/rentabilidad`, la petición
> sale del navegador hacia el **origen** y no hacia la app, y lo que vuelve no
> es un error de red: es el **404 de Next con cuerpo HTML**, que la pantalla
> habría pintado como «no se pudo calcular el reporte» sin decir nada de la
> causa.

## Los tres defectos que solo vio un navegador

Se encontraron el **2026-09-18**, con el build fusionado y la app abierta sobre
la base sembrada `spaces_ver2`. **Ninguno lo vio el typecheck, ni las
unitarias, ni las e2e**, y eso es lo que los hace valiosos: cada uno falla por
una razón que ninguna herramienta puede ver.

### 1 · El selector mentía sobre su propia aplicación

El desplegable ofrecía «Por trimestre **(en preparación)**» y al elegirla
**calculaba perfectamente**. La pantalla nació el 17/09 con `trimestre`,
`operacion` y `m2` devolviendo 501; la ola 2 cerró las tres el 18/09 y la
etiqueta se quedó.

**Por qué no lo vio nada: es un texto.** Una etiqueta de más no rompe ninguna
prueba ni ningún tipo. El campo `conMotor` se **retiró** en vez de ponerlo en
`true` para las cuatro — un interruptor que siempre vale lo mismo es el que se
queda desfasado.

> [!note] Y el camino del 501 se borró, pero MEDIDO antes
> Quitar el manejo de un error que sí puede ocurrir es peor que dejarlo de
> sobra, así que se comprobó que es **inalcanzable** y no se supuso:
>
> - `grep` de `status: 501` sobre `apps/web/lib` y `apps/web/app`, sin
>   pruebas: **cero líneas**.
> - `MOTORES` (`lib/server/reportes-controller.ts:114`) es un `Record`
>   **exhaustivo** sobre el enum, así que declarar una dimensión sin su motor
>   **no compila**. Lo que el tipo garantiza no necesita además un error en
>   tiempo de ejecución.
> - los demás caminos de error del endpoint están enumerados y ninguno da 501:
>   `AppError` (400 por omisión), zod (400 o el status que pida el issue), los
>   códigos de Postgres de `errores.ts:105-114` (400/403/409), el 500 de
>   respaldo y el 401/403 de `exigir`.
>
> Con eso, la fase `sin-motor` salió de `estado.ts` y `dimension` salió de
> `EntradaEstado` (era su único uso). Si un 501 llegara de todos modos ya no
> podría venir de una dimensión sin motor —sería un intermediario diciendo que
> no implementa el método—, así que cae como **error**, que es donde le toca.
> La prueba que lo fija está en `estado.test.ts` §1.

### 2 · La tabla pintaba SIEMPRE las columnas de `sitio` — el defecto de fondo

«Por operación» calculaba bien —Tlalpan 21.6 % contra Santa Mónica 34.2 %, el
guion del dueño— y **no enseñaba ni visitas ni horas**, que es justo lo que la
hace «por operación». Y en trimestral el encabezado de la primera columna decía
**«PANTALLA»** sobre filas que eran trimestres.

> [!danger] Por qué esto no lo puede ver NINGUNA prueba de las que había
> Las columnas propias de `operacion` y de `m2` son campos **opcionales** de
> `FilaRentabilidad` (`lib/data/reportes.ts:118-134`). **Un campo opcional que
> nadie lee no da error de tipos ni de ejecución**: da una tabla que calcula
> perfectamente y no contesta su propia pregunta. El typecheck está contento, la
> respuesta del endpoint es correcta y su e2e pasa — el dato llega y se tira en
> el último metro.

Lo que hay ahora, todo en `tabla.ts` y todo probado:

| Dimensión | Columnas propias | Primera columna | Orden de apertura |
|---|---|---|---|
| `sitio` | — | Pantalla | peor **margen** |
| `trimestre` | — | **Trimestre** | **cronológico** (por `clave`) |
| `operacion` | `visitas` · `costoOperacionPct` · `horasEnSitio` | Pantalla | más **costo de operación** |
| `m2` | `m2` · `ingresoPorM2` · `margenPorM2` | Pantalla | peor **margen / m²** |

Cuatro decisiones del diseño que no son de estilo:

- **`costoTotal` es la única columna que cede el sitio** cuando la dimensión
  trae propias. Es la suma exacta de las dos que tiene al lado, que siguen en
  pantalla, así que no se pierde nada; y once columnas de cifras a 13 px no se
  leen «a tres metros (proyector)», que es donde esto se presenta.
- **En `trimestre` se ordena por `clave` (`2026-T1`) y se pinta la etiqueta
  (`T1 2026`).** Como texto, «T4 2025» va **después** de «T1 2026» —la T4 pesa
  más que la T1— y en el calendario va antes. Es la trampa de comparar fechas
  como cadenas que este repo ya pagó dos veces.
- **El pie solo totaliza las seis columnas que trae `Totales`.** Las demás salen
  en blanco a propósito: sumar aquí divergiría del servidor, y con
  `margenPorM2` sería peor que divergir — es un **cociente**, y el promedio de
  los cocientes de las filas no es el cociente del total porque cada pantalla
  tiene otra superficie. Sería una cifra que no es de nadie.
- **El orden de cada dimensión es EL MISMO que el de su motor.** Si la tabla
  reordenara al recibir, discutiría con el servidor sobre la misma pregunta.
  `trimestre` es la única que no va «peor primero», y es deliberado: sus filas
  son una serie de tiempo, no un ranking.

Y dos cosas que llegaron con ellas:

- **`visitasPorTipo` se lee bajo el nombre de la pantalla**
  («Desmontaje 2 · Inspección 1»), no en una columna: es un objeto tipo→conteo
  y no hay orden sensato entre dos repartos. Un tipo que no esté en
  `TIPO_OT_LABEL` se pinta con su clave y **no se omite** — seguiría contando en
  `visitas`, y omitirlo dejaría dos cifras que no cuadran sin decir por qué.
- **El desglose por periodo**, que toda dimensión trae en `periodos[]` y hasta
  hoy no llegaba a ninguna parte: se despliega por fila, con el ingreso,
  espacio, operación, margen y visitas de cada bucket, y **en el orden del
  servidor**. Solo se ofrece cuando hay más de un bucket: con uno repetiría la
  fila de arriba.

### 3 · La pantalla abría en un periodo vacío

Por omisión tomaba el **trimestre en curso**. En la base de demostración eso es
jul-sep 2026, que no tiene ingresos pero **sí tiene renta**, así que lo primero
que se veía era el negocio **perdiendo 184 500**.

Abre en el **último trimestre CERRADO**, y el motivo es de producto y no de
demo: un trimestre a medias siempre se lee peor que uno completo —la renta se
devenga desde el día 1 y lo vendido se cobra al cerrar—, así que el reporte
arrancaba dando una impresión falsa del negocio a cualquiera que lo abra.

> [!tip] Es UNA línea, y es una decisión del dueño
> `RANGO_DE_APERTURA` en `consulta.ts`. Cambiarla a `rangoDelTrimestreDe`
> devuelve el trimestre en curso y nada más se toca; `rangoDelTrimestreDe` se
> conserva por eso, y porque es la base con la que se calcula el cerrado.
>
> El cerrado se calcula retrocediendo al día **anterior** al primero del
> trimestre en curso (`new Date(anio, primerMes, 0)`) y preguntando por el
> trimestre de ese día. Escrito como `mes - 3` sin cruzar el año, **enero daría
> octubre a diciembre del año en curso**: un trimestre que todavía no ha pasado,
> presentado como cerrado, y sin dar ningún error. Hay una prueba para ese caso
> y otra para que el cerrado nunca solape al que está en curso.

## Los vacíos son honestos

- **Sin movimiento en el rango** → se dice el rango preguntado y **por qué**
  puede salir vacío (una pantalla sin ingreso, sin renta y sin OT no aparece en
  el reporte), en vez de un «no hay datos» que deja sin saber si el problema son
  las fechas o el inventario.
- **Lo que el reporte no mide, y lo que deja FUERA, se cuenta encima de la
  tabla** (`avisosDelReporte`). Son cuatro avisos y cada uno tiene su porqué:
  - **sin contrato** — su costo del espacio sale en cero porque falta el dato,
    no porque sea gratis, así que su margen se lee mejor de lo que es.
  - **sin ingreso** — costaron y no vendieron: son justo las que este reporte
    existe para encontrar.
  - **exclusiones del m²** — cuántas digitales y cuántas sin medidas quedaron
    fuera del ranking. **La nota la redacta el motor** (`notaDeExclusiones`) y
    se pinta **verbatim**: volver a escribirla aquí sería la segunda
    implementación de la misma frase, y divergir significaría decirle al usuario
    que se excluyó otra cosa de la que se excluyó. Y se pinta **también cuando
    no se excluyó nada**, porque «no excluí ninguna» y «no te lo digo» se ven
    igual si no hay texto — el hallazgo C1 otra vez.
  - **convención del m²** — hoy **una cara**, y hay una decisión del dueño
    pendiente sobre si multiplica por caras. Una cifra por metro cuadrado sin
    decir qué cuenta como metro cuadrado no se puede conciliar con nada, y esa
    decisión **cambia el orden de toda la tabla**.

> [!danger] Un aviso era FALSO en trimestral, y nada se quejaba
> El aviso de «sin contrato» contaba **filas**, y en `trimestre`
> `tieneContrato` significa «hubo renta en el trimestre» — la fila no es una
> pantalla ([[02-Backend/reportes-dimensiones]] §3). Sobre dos trimestres sin
> renta, la pantalla afirmaba **«2 pantallas no tienen contrato»**: algo que no
> existe, en una caja de avisos que está ahí precisamente para ser honesta.
>
> Ahora ese aviso **no se pinta** en `trimestre`, y el de «sin ingreso» habla de
> trimestres y **defiende el cero** —un hueco en una serie se lee como «faltan
> datos»—. El sustantivo de la fila se declara **una vez**, en `sustantivoFila`,
> y lo leen también la cabecera («4 trimestres con movimiento», que decía
> «4 pantallas») y la tabla.

## Detalles del cableado que no son de estilo

- **`AbortController` en el efecto.** Dos cambios de filtro seguidos dejan dos
  peticiones en vuelo, y la que conteste **última** gana el `setState` aunque
  sea la vieja: una tabla que no corresponde a los filtros visibles, sin error.
- **`r.json()` con su propio `catch`.** Un 500 detrás de nginx devuelve HTML;
  sin eso, un error del servidor saldría por el `catch` de red con un mensaje
  falso.
- **`cargando` se apaga en el `finally`.** Es lo que impide el spinner infinito.
- **Esqueletos mientras carga, no ceros.** Un «$ 0.00» que luego cambia es una
  cifra falsa enseñada a una sala.
- **Los totales vienen del servidor** (`reporte.totales`) y no se suman aquí:
  dos sumas de lo mismo divergen, y la del servidor es la que cuadra con el
  desglose por periodo.
- **El rango de apertura es el último trimestre CERRADO**, construido desde las
  partes **locales** de la fecha. Con `toISOString()`, el 1.º de enero a
  medianoche en México (UTC−6) sale como 31 de diciembre y el rango caería en el
  trimestre anterior — la misma trampa que ya se pagó en `diasHasta`
  (`derive.ts`).
- **Al cambiar de dimensión se vuelve al orden de ESA dimensión**, no a uno
  fijo: conservar «margen ascendente» al pasar a trimestral ordenaba una serie
  de tiempo por importe.

## Permisos — el área está DECLARADA

El área `reportes` se registra en **`lib/modulos.ts`** bajo el módulo
**`finanzas`**, no `dashboard`: enseña lo que se cobra por cada pantalla y lo que
se le paga a cada arrendador. Con `dashboard` lo vería cualquier rol que pueda
abrir el tablero, y el `route.ts` del endpoint ya exige `finanzas.ver`.

Declararla es el **ADR 0010**, que existe para que nadie esconda qué abre cada
permiso: la matriz de Administración mostraba 8 módulos sobre 18 áreas, así que
marcar una casilla abría pantallas que nada mencionaba.

> [!tip] La entrada del menú lleva los MISMOS roles que Finanzas, y hay un guard
> Las dos las autoriza `finanzas`. Si divergieran, un rol vería la entrada en el
> menú y se comería un 403 de `exigir('finanzas','ver')` **sin que nada le dijera
> por qué** — el encierro que este repo ya documentó dos veces (contraseña
> temporal y códigos de recuperación). Lo comprueba
> `components/demo/reportes/registro.test.ts`.
>
> Y el control de acceso por ruta sale gratis: `AuthGate` resuelve el módulo de
> la ruta con el **mismo `NAV`** que pinta el menú
> ([[03-Frontend/shell-y-navegacion]]), así que la entrada cierra también el
> enlace directo.

## Pruebas

| Archivo | Qué ancla | Casos |
|---|---|---|
| `components/demo/reportes/consulta.test.ts` | Los 4 parámetros exactos, el `basePath`, el rango invertido por calendario, **el trimestre cerrado de apertura y su cruce de año**, y que **ninguna dimensión se ofrece «en preparación»** | 22 |
| `components/demo/reportes/estado.test.ts` | Las seis fases, **el 501 retirado y medido**, el `status: 0` que no es vacío, la matriz del spinner | 17 |
| `components/demo/reportes/tabla.test.ts` | El `null` al final en las dos direcciones, la no mutación, el orden en español, el catálogo completo de columnas | 17 |
| `components/demo/reportes/tabla.dimensiones.test.ts` | **Las columnas de cada dimensión**, el encabezado, el orden cronológico, las exclusiones y la convención del m², los avisos por dimensión, los formatos y el desglose | 38 |
| `components/demo/reportes/registro.test.ts` | El área bajo `finanzas` y los roles del menú | 8 |

**1470 unitarias en 122 archivos** el 18/09 tras la ola 3, contra 1430 antes de
ella. `npm run typecheck` limpio, `npm run build` en verde, `next lint` sin
avisos nuevos y **390 e2e en 36 archivos, con 1 omitida** — las e2e **sí se
corrieron** esta vez, con el build hecho antes. Los recuentos caducan: si
necesitas el número, córrelo.

> [!tip] Los negativos son los que valen, y son cinco
> Una dimensión que trae columnas ajenas · `trimestre` ordenado por margen en
> vez de cronológico · las exclusiones del m² que llegan y no se pintan · una
> columna propia colada en el pie de totales · y el aviso de «pantallas sin
> contrato» sobre filas que son trimestres. Los cinco describen algo que
> **calcula bien y dice algo falso**, que es la única clase de defecto que esta
> pantalla puede tener.

> [!warning] Y hay una clase de defecto que NINGUNA prueba automática cubre
> Los tres de la ola 3 se vieron **mirando**. Las pruebas de ahora los fijan
> para que no vuelvan, pero no habrían encontrado el siguiente de su especie: un
> dato que el endpoint devuelve bien y la pantalla no pinta **no tiene síntoma
> mecánico**. La pasada visual con datos sembrados es parte del trabajo de esta
> pantalla, no un extra.
>
> Se hace así, y el orden importa:
>
> ```
> cd apps/web && npm run build
> DATABASE_URL="postgresql://spaces:spaces@localhost:5433/spaces_ver2" npx next start -p 3402
> ```
>
> `duena@demo.invalid`, y el reporte en `/spaces-dooh/reportes/`. **El build
> ANTES y el servidor DESPUÉS**: reconstruir `.next` con un `next start` ya
> corriendo deja la página **en blanco sin ningún error** —el navegador pide
> chunks de un build que ya no existe—. Pasó otra vez el 18/09 al reiniciar,
> porque matar la tarea de fondo mató el envoltorio `npx` y **no el proceso
> hijo**: hubo que matar al dueño del puerto 3402 a mano
> (`Get-NetTCPConnection -LocalPort 3402`).

> [!warning] Falta una e2e propia de la pantalla
> Las unitarias no pueden darla: que un rol sin `finanzas.ver` no vea la entrada
> del menú **ni** pueda abrir `/reportes` por enlace directo. Las unitarias
> comprueban que el `NAV` lo dice; que el servidor lo cumpla con el rol real
> solo lo ve una e2e.

> [!success] 2026-09-18 · la pantalla YA se abrió en un navegador
> Es lo que el aviso anterior de esta nota reclamaba, y encontró **tres
> defectos** en una sesión (§ «Los tres defectos que solo vio un navegador»).
> Comprobado sobre `spaces_ver2` en el 5433, con el guion de Tlalpan contra
> Santa Mónica: las cuatro dimensiones pintan sus columnas, el trimestral sale
> cronológico (T3 2025 → T2 2026, con los márgenes **descendiendo**, que es
> justo el caso donde el orden viejo lo invertía), el m² declara su convención y
> sus exclusiones, y la pantalla abre en abr-jun 2026 con **+74 900** en vez de
> la pérdida de 184 500 del trimestre en curso.
>
> **El presupuesto de la ruta se midió otra vez, porque es el riesgo crítico
> del módulo:** `/reportes` pasó de **110 kB** a **111 kB** de primera carga,
> contra 533 kB de `/inicio`. Nueve columnas, los avisos y el desglose caben en
> **1 kB**: nada se colgó del store.

## Relacionadas
[[02-Backend/reportes-rentabilidad]] · [[02-Backend/reportes-dimensiones]] ·
[[03-Frontend/_indice]] · [[shell-y-navegacion]] · [[modulos-internos]] ·
[[estado-y-data-fetching]] · [[02-Backend/finanzas-y-cobranza]] ·
[[02-Backend/operaciones-y-ot]] · [[convenciones]] · [[MOC-Proyecto]]

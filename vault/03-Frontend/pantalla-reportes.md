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
  - apps/web/components/demo/reportes/FiltrosRentabilidad.tsx
  - apps/web/components/demo/reportes/TablaRentabilidad.tsx
  - apps/web/lib/modulos.ts
  - apps/web/components/demo/shell/nav.ts
---

# Pantalla de reportes de rentabilidad

`/reportes`, dentro del shell. Nació el **2026-09-18**, un día después del
endpoint que consume ([[02-Backend/reportes-rentabilidad]]).

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
| `components/demo/reportes/consulta.ts` | La ruta, los enums de los selectores, la querystring y la validación previa del rango |
| `components/demo/reportes/estado.ts` | Las **siete** fases: `inicial · cargando · invalido · sin-motor · error · vacio · datos` |
| `components/demo/reportes/tabla.ts` | El ordenamiento, las columnas y el formato del porcentaje |
| `app/(app)/(shell)/reportes/page.tsx` | El cableado: `useEffect`, `fetch`, y qué componente se pinta en cada fase |

> [!warning] Nada que pueda equivocarse vive en un `.tsx`, y no es una
> preferencia de estilo
> `vitest.config.ts` **no monta jsdom, a propósito** (lo dice en su propia
> cabecera: un `.tsx` pediría dependencias que este repo no tiene). Consecuencia
> exacta: **una decisión escrita dentro de un componente no la prueba nadie**.
>
> Ya pasó: la decisión de negocio de la compuerta del shell vivía en un `.tsx`,
> se sacó a `components/demo/shell/compuerta.ts` y **aparecieron nueve casos en
> rojo**. Aquí se hizo al revés desde el principio — **54 pruebas** sobre los
> tres módulos puros (62 contando `registro.test.ts`), y los dos `.tsx` se
> quedan con pintar. Medido el 18/09: 19 · 18 · 17 · 8.

## Lo que se probó, y los tres defectos que encontró

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

## El 501 se degrada, no se esconde

Hoy solo `sitio` tiene motor; `trimestre`, `operacion` y `m2` devuelven **501**
(ver [[02-Backend/reportes-rentabilidad]]). La pantalla:

1. **Las ofrece igual** en el selector, marcadas «(en preparación)». No se
   deshabilitan: el contrato del endpoint ya las contempla, y esconderlas
   obligaría a volver a tocar esta pantalla el día que aterricen — que es
   exactamente lo que el límite existe para evitar.
2. **Las pide.** El 501 lo decide el servidor. Si la pantalla se negara a
   preguntar, habría dos sitios donde está escrito qué dimensión funciona.
3. **Pinta el mensaje del servidor**, que nombra cuál falta. No es `error` ni
   `vacio`: un error manda a buscar un fallo que no existe y un vacío afirma que
   no hay datos, cuando lo que pasa es que no se calcularon.

**Cuando el motor de las otras tres aterrice, esta pantalla funciona sin
cambios.** Es la afirmación que se puede comprobar leyendo `estado.ts`.

## Los vacíos son honestos

- **Sin movimiento en el rango** → se dice el rango preguntado y **por qué**
  puede salir vacío (una pantalla sin ingreso, sin renta y sin OT no aparece en
  el reporte), en vez de un «no hay datos» que deja sin saber si el problema son
  las fechas o el inventario.
- **Lo que el reporte no mide se cuenta encima de la tabla**
  (`advertenciasDelReporte`): las pantallas **sin contrato** —su costo del
  espacio sale en cero porque falta el dato, no porque sea gratis, así que su
  margen se lee mejor de lo que es— y las que **costaron sin vender**, que son
  justo las que este reporte existe para encontrar.

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
- **El rango de apertura es el trimestre en curso**, construido desde las partes
  **locales** de la fecha. Con `toISOString()`, el 1.º de enero a medianoche en
  México (UTC−6) sale como 31 de diciembre y el rango caería en el trimestre
  anterior — la misma trampa que ya se pagó en `diasHasta` (`derive.ts`).

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

| Archivo | Qué ancla |
|---|---|
| `components/demo/reportes/consulta.test.ts` | Los 4 parámetros exactos, el `basePath`, el rango invertido por calendario, el trimestre de apertura |
| `components/demo/reportes/estado.test.ts` | Las siete fases, el 501 que no es error, el `status: 0` que no es vacío, la matriz del spinner |
| `components/demo/reportes/tabla.test.ts` | El `null` al final en las dos direcciones, la no mutación, el orden en español, las advertencias |
| `components/demo/reportes/registro.test.ts` | El área bajo `finanzas` y los roles del menú |

**1312 unitarias en 115 archivos** el 18/09 en esta rama, contra 1250 en 111 al
salir de ella. `npm run typecheck` limpio y `npm run build` en verde.

> [!warning] NO se corrió ninguna e2e, y falta una
> El puerto **3311** y la base **`spaces_e2e`** los tenía otro agente en
> exclusiva: colisionar habría dado rojos falsos a los dos. Cuando el arnés
> quede libre hay que correr `cd apps/web && npm run build && npm run test:e2e`
> —con el build **antes**, o fallan todas en falso—.
>
> **Y falta una e2e propia de la pantalla**, que las unitarias no pueden dar: que
> un rol sin `finanzas.ver` no vea la entrada del menú **ni** pueda abrir
> `/reportes` por enlace directo. Las unitarias comprueban que el `NAV` lo dice;
> que el servidor lo cumpla con el rol real solo lo ve una e2e.

> [!danger] Lo que NO se pudo comprobar
> **La pantalla no se abrió en un navegador.** Lo verificado es: `npm test`,
> `npm run typecheck`, `npm run build` (la ruta `/reportes` se emite) y `next
> lint` sin avisos nuevos. **Nada de eso dice que se vea bien**, ni que el
> selector se lea a tres metros en un proyector. Falta una pasada visual con
> datos reales de la base del 5433.

## Relacionadas
[[02-Backend/reportes-rentabilidad]] · [[03-Frontend/_indice]] ·
[[shell-y-navegacion]] · [[modulos-internos]] · [[estado-y-data-fetching]] ·
[[02-Backend/finanzas-y-cobranza]] · [[convenciones]] · [[MOC-Proyecto]]

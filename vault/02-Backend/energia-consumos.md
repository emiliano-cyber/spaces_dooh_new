---
tipo: modulo
estado: verificado
actualizado: 2026-09-18
tags: [backend, energia, luz, reportes, rentabilidad, captura, operaciones, dinero, rojo]
archivos:
  - db/migrations/20260918_consumos_energia.sql
  - apps/web/lib/server/energia-repo.ts
  - apps/web/lib/server/energia-controller.ts
  - apps/web/app/api/energia/consumos/route.ts
  - apps/web/app/api/energia/consumos/[id]/route.ts
  - apps/web/app/(app)/(shell)/energia/page.tsx
  - apps/web/components/demo/energia/captura.ts
  - apps/web/components/demo/energia/RejillaCaptura.tsx
  - apps/web/components/demo/energia/FormularioRecibo.tsx
  - apps/web/lib/data/reportes.ts
  - apps/web/lib/data/derive.ts
---

# Consumo de luz — la captura y la quinta dimensión

Nació el **2026-09-18**. Es la quinta de las cinco preguntas de rentabilidad que
pidió el dueño, y la única que **no tenía un solo dato en el sistema**: una
búsqueda por `kwh`, `consumo`, `energia`, `electric`, `cfe` y `recibo_luz` sobre
todo el repositorio devolvía **una** coincidencia, y era el valor `'ELECTRICO'`
del enum `tipo_ot`. Las otras cuatro pivotaban datos que ya existían; esta hubo
que empezarla por la base.

Complementa a [[02-Backend/reportes-rentabilidad]] (el límite y el prorrateo) y
a [[02-Backend/reportes-dimensiones]] (las otras cuatro dimensiones).

---

## 1 · La decisión que lo define todo

Se le preguntó al dueño **quién va a teclear el dato y cada cuánto**, porque de
eso salía la forma de la tabla. Eligió, con esta letra:

> «El medidor suele ser del predio, no de la pantalla, así que se captura una vez
> por predio y por mes y **se reparte entre sus pantallas igual que la renta**.
> Es lo más realista y **reusa el reparto que ya existe y está probado**.»

De ahí salen las tres decisiones de forma, y ninguna es del código:

| Qué | Por qué |
|---|---|
| **Anclaje al PREDIO** | El medidor es del predio, no de la pantalla |
| **Periodo MENSUAL** | Un recibo cubre un mes de calendario |
| **Reparto por caras** | «Igual que la renta» — literalmente la misma función |

Y **quién captura: operaciones**. Por eso el endpoint de captura exige
`operaciones` y el reporte que lo consume sigue exigiendo `finanzas.ver`: son
dos preguntas distintas —quién teclea el recibo y quién ve el margen— y por eso
son dos permisos.

> [!note] Consecuencia que conviene tener escrita
> Un rol de **operaciones escribe un número que cambia el margen** de un reporte
> de dinero que ese mismo rol **no puede abrir**. Es exactamente lo que el dueño
> pidió. La trazabilidad la da `registrarAccion`: cada alta y cada borrado
> quedan en la bitácora con quién los hizo.

---

## 2 · La tabla

`db/migrations/20260918_consumos_energia.sql`. **No toca `db/schema.sql`**, y hay
un guard que lo comprueba.

```
consumos_energia
  id · tenant_id (not null, SIN default)
  predio_id | sitio_id          ← anclaje EXCLUYENTE (CHECK)
  periodo date not null         ← día 1 del mes (CHECK)
  medidor text                  ← nullable, pero dentro de la UNICIDAD
  kwh numeric(12,2) not null    ← >= 0
  importe numeric(14,2) not null ← >= 0
  notas · creado_en · creado_por
```

### Las cuatro decisiones que costaron pensarlas

**1 · El anclaje es excluyente, y admite la pantalla suelta.** Molde:
`licencias` (`20260729_licencias_permisos.sql:41-58`). El medidor del predio es
el caso que describió el dueño; la pantalla suelta está porque
**`sitios.predio_id` es NULLABLE**. Sin ella, el consumo de una pantalla sin
predio no tendría dónde ir: existiría en el inventario y su luz no tendría fila
en ningún sitio.

**2 · El periodo es el día 1, y lo dice la base.** El motor reparte el recibo por
los días de *su* mes, así que una fila con `periodo = 2026-02-17` se repartiría
como si el mes empezara ese día. El CHECK va en la base porque la tabla la puede
escribir cualquier cosa que llegue mañana, no solo el controller de hoy.

> [!danger] El medidor dentro de la unicidad, y el `coalesce` que la hace valer
> **Un recibo capturado dos veces DUPLICA el costo de la luz de ese mes y no da
> ningún error**: da un margen peor de lo que es.
>
> La clave lleva el **medidor** porque **un predio puede tener más de uno**: con
> `(tenant, predio, periodo)` a secas, el segundo recibo real del mes sería
> imposible de capturar y quien captura acabaría sumando los dos a mano en una
> fila — el total quedaría bien y el detalle por medidor se perdería.
>
> Y se indexa **`coalesce(medidor,'')`**, no `medidor`: en Postgres los NULL son
> **distintos entre sí** dentro de un índice único, así que con la columna a
> secas **dos filas con medidor nulo entrarían las dos** — justo el caso del
> predio con un solo medidor sin número anotado, que es el más común.
> `nulls not distinct` haría lo mismo desde Postgres 15, pero ataría la
> migración a la versión del motor de cada instancia.

**4 · kWh e importe son NOT NULL.** Con `kwh` nullable, una fila sumaría importe
y no kWh, y el costo por kWh de ese renglón saldría de dividir un importe
**completo** entre unos kWh **incompletos**: no da error, da una cifra creíble y
falsa. **No admitir el dato a medias cuesta una palabra; manejarlo con cuidado
costaría propagar un «no se sabe» por cinco sitios.**

### RLS — y el detalle en que se separa del patrón

Fail-closed + FORCE, con el predicado **literal** de
`20260723_almacen.sql:47-60`. Lo único distinto: se escribe **fuera** del
`foreach t in array`.

> [!warning] Y eso lo destapó el propio guard
> Se quedó en rojo pidiendo `alter table consumos_energia enable row level
> security` **mientras la política SÍ se creaba**, porque en el archivo solo
> estaba `alter table %I`. Con **una** tabla el bucle no gana nada y **deja de
> poder comprobarse leyendo el archivo**. Mismo criterio que `licencias`.

---

## 3 · El reparto — se MOVIÓ, no se copió

`fraccionDeCarasPorPredio()` salió de **dentro** de `rentaAtribuidaPorSitio()`
(`derive.ts`) y ahora **la usan las dos**. Devuelve
`predioId → (sitioId → fracción)`, y las fracciones de un predio suman 1.

> [!important] Por qué no se copió, que es la pregunta que se hace sola
> Copiarla al motor de reportes habría hecho que **la renta de un predio se
> repartiera de una forma y su luz de otra sobre las mismas pantallas**, en la
> misma fila de la misma tabla. Es el error de raíz que este repo documenta en
> `lib/server/tenant.ts:87-89`.
>
> El movimiento **no cambió conducta**: las **206 unitarias de `derive`** pasan
> sin tocarse, incluidas `derive.anclaje-contrato.test.ts` y `derive.pnl.test.ts`.

### El recibo se reparte DOS veces

1. **En el tiempo**, por los días del mes que el bucket cubre, con
   `mesesEquivalentes()` sobre la intersección del bucket con el mes del recibo.
   Es aditiva, así que la suma de los buckets es exactamente el recibo.
   Medido: `3 100 × 15/31 = 1 500.00` exactos.
2. **Entre las pantallas** del predio, con la fracción de caras.

Un recibo de **pantalla suelta no se reparte**: es íntegro de esa pantalla, y sus
caras no lo dividen — son lados de la misma pantalla. Mismo criterio que el
contrato de pantalla suelta.

---

## 4 · La energía es la CUARTA FUENTE DE COSTO, no una columna de `luz`

Es lo más importante del cambio y lo que más superficie tocó.

`costoEnergia` entra en **`costoTotal` y en el margen de TODAS las dimensiones**.
Si `sitio` no lo contara, **`sitio` y `luz` darían dos márgenes distintos para la
misma pantalla** y los dos serían defendibles por separado.

Eso obligó a tocar a la vez `periodosDe`, `sumar`, `totalesDeFilas`,
`acumularCeldas` y `hayMovimiento`, y a añadir la columna en el catálogo, en
`COMUNES`, en `TOTALIZABLES` y en el desglose por periodo.

> [!danger] El doble conteo es el defecto que acecha aquí, y tiene tres capas
> Un `costoTotal` que se quedara con dos de las tres fuentes da **un margen
> optimista y un desglose que no suma su propia fila**, sin dar error. Hay
> pruebas del cuadre en las **tres**: la fila, el desglose por periodo y los
> totales del reporte.
>
> Y la cuarta capa es la pantalla: el KPI de cabecera enseña ahora **las tres
> fuentes** debajo del total. Si no, el número más grande de la pantalla no
> sería la suma de lo que dice debajo.

**La energía cuenta como MOVIMIENTO**: una pantalla que solo consumió luz tiene
un costo del periodo, y dejarla fuera escondería dinero gastado en el único
reporte que existe para enseñarlo.

---

## 5 · `luz` — la dimensión

Una fila por pantalla, **ordenada por más costo de energía**. No por peor margen,
y por el mismo motivo que `operacion`: una pantalla con margen horrible por una
renta cara **no es un problema de luz**, y por peor margen saldría primera
tapando justo a las que sí lo son.

| Columna propia | Qué es |
|---|---|
| `kwh` | Kilovatios-hora atribuidos, con el mismo reparto que el importe |
| `costoPorKwh` | `costoEnergia / kwh`. **`null` con cero kWh, no 0** |

Un «$0.00 por kWh» se lee como «aquí la luz es gratis», que es lo contrario de
«no hay consumo con el que calcularlo». Mismo criterio que `margenPct`.

El **501 no volvió**: `MOTORES` es un `Record` exhaustivo, así que fue el tipo el
que obligó a escribir el motor al añadir la dimensión al enum. El `route.ts`
**no se tocó** — la dimensión ya era un parámetro de su contrato.

---

## 6 · Lo que falta se DECLARA — la mitad del reporte

> [!danger] Aquí el hueco NO SE VE, y por eso es peor que en el m²
> Una pantalla sin recibo sale con **`costoEnergia: 0`**, que es
> **indistinguible** de una pantalla que de verdad no gasta luz. Un reporte de
> energía que suma solo lo capturado y lo presenta como el total **miente sin dar
> error**.
>
> En el m² la exclusión al menos quita la fila; aquí la fila se queda y la cifra
> parece completa.

`cobertura` cuenta los pares **(punto de medición × mes)** sin recibo:

- El **punto de medición** es el predio, o la pantalla cuando no tiene predio.
  Sin la segunda mitad, el hueco de una pantalla suelta no se contaría.
- **Solo cuentan los puntos de las pantallas que TIENEN fila**, mismo criterio
  que las exclusiones del m²: si no, un catálogo con trescientos predios
  dormidos diría «faltan 900 recibos» en un reporte donde eso no significa nada.
- Se dice **también cuando no falta ninguno**, pero entonces en gris. «No falta
  ninguno» y «no te lo digo» se ven igual si no hay texto (hallazgo C1), y un
  ámbar que saliera siempre no lo leería nadie.

### Los recibos SIN DESTINO

Un recibo de un predio **todavía sin pantallas**. El reparto no le da nada a
nadie y **el dinero desaparece del reporte sin dar error**. Se cuenta **antes**
del reparto —después es indistinguible de un recibo de cero— y se declara con su
importe.

---

## 7 · La pantalla de captura

`/energia`, dentro del shell. Dos trabajos, y el segundo es el que importa.

**Capturar rápido**: una línea de campos en el orden del papel y Enter. Al
guardar, **el predio y el mes se quedan** (capturar es un lote) y **las cifras se
limpian** — dejar el importe anterior en el campo es la forma más fácil de
teclear dos veces la misma cifra, y un importe repetido no da error.

**Que se vea lo que falta**: la unidad es la **rejilla punto × mes**, no la lista
de lo capturado. El hueco se pinta con **raya y fondo ámbar**; un «$0.00»
afirmaría que ese mes no se gastó luz y una celda en blanco no diría nada.

> [!tip] `mesesDelRango()` y `puntoDeMedicion()` se IMPORTAN del motor
> Con dos respuestas a «qué meses cubre este rango» o a «qué es un punto de
> medición», el usuario **rellenaría todas las celdas de la captura y el reporte
> seguiría diciendo que le falta un recibo**, sin nada que explicara cuál.

**Hay DELETE, y no es un extra.** El índice único impide recapturar el mismo
recibo, así que sin borrado un importe con un cero de más **infla el costo de un
mes para siempre**. Pide `aprobar`, igual que el borrado de licencias.

Y el duplicado **no se comprueba con un `select` previo**: entre el select y el
insert cabe otra petición, y el único sitio donde esa carrera no existe es el
índice. `errores.ts` traduce el `23505` a un 409.

---

## 8 · Aislamiento (R2)

Las cuatro consultas usan `q()`/`q1()` y llevan **`and tenant_id` explícito**
como segunda capa sobre la RLS. Nunca `qRaw`. El `delete` es el que más importa:
un borrado por `id` sin el filtro borraría el recibo de otra organización.

> [!warning] El guard se afinó CON EL ROJO DELANTE
> Exigía `tenant_id = $n` a **toda** consulta y se puso rojo sobre un `insert`
> **correcto**. Un alta no selecciona filas existentes, así que **no tiene
> `where` donde poner el filtro**: lo que hay que exigirle es que **escriba** el
> `tenant_id` y que venga de un **parámetro**. Se añadió además el caso que
> comprueba que no haya por dónde mandarlo desde el cuerpo de la petición.

### Y la RLS corta DE VERDAD — medido, no supuesto

Sobre la base desechable `spaces_energia_tmp`, con el rol **`spaces_app`**
(`rolsuper = f`), que es lo que una unitaria no puede ver:

| Contexto | Filas visibles |
|---|---|
| **Sin** `app.tenant_id` | **0** (fail-closed) |
| Con su tenant | 3 |
| Con el tenant de **otra** organización | **0** |
| `insert` con un `tenant_id` ajeno al contexto | **rechazado** por la política |
| Superusuario | 3 — lo que prueba que los ceros no eran una tabla vacía |

> [!danger] Y aun así falta la e2e, que es otra cosa
> Lo de arriba se midió **a mano contra Postgres**. Lo que no existe todavía es
> la e2e **automática** que lo vuelva a medir en cada corrida, con dos
> organizaciones sembradas y el reporte de una sin una sola fila de la otra.
> **Tiene que usar `poolApp()` y NUNCA el pool de administración**: el rol
> `spaces` es superusuario y se salta la RLS, así que con él la prueba pasaría
> **por casualidad**. Ver §10.

---

## 9 · Pruebas

| Archivo | Qué ancla | Casos |
|---|---|---|
| `lib/data/reportes.luz.test.ts` | la energía dentro del margen, el reparto, el recibo mensual contra medio bucket, la cobertura | 18 |
| `lib/server/energia-repo.aislamiento.test.ts` | la migración (RLS, unicidad, anclaje, `tenant_id` sin DEFAULT, que no se toque `schema.sql`) y el repo | 22 |
| `components/demo/reportes/tabla.luz.test.ts` | que `costoEnergia` se pinte en TODAS las dimensiones, y las columnas propias de `luz` | 20 |
| `components/demo/energia/captura.test.ts` | la rejilla, el hueco que no es cero, el resumen honesto, y el recibo del futuro | 26 |

**1577 unitarias en 126 archivos** al cerrar (1488 al empezar la ola). Los
recuentos caducan: si necesitas el número, córrelo.

> [!tip] Los negativos son los que valen
> Recibo duplicado · dos medidores que **sí** suman · medidor nulo duplicado ·
> los dos anclajes y ninguno · periodo que no es día 1 · importe negativo ·
> `tenant_id` nulo · predio sin pantallas cuyo importe no puede desaparecer ·
> mes sin recibo · recibo fuera del rango · punto sin filas que no cuenta como
> hueco · pantalla sin predio como su propio punto · kWh en cero que **no** da
> costo por kWh de cero · recibo de un mes que no ha terminado.

---

## 9-bis · Se abrió en un NAVEGADOR, y lo que enseñó

Sobre `spaces_ver2` en el 5433, con el build hecho antes y el servidor en el
3405. **Las unitarias no pueden ver esto**: que el dato llegue del endpoint y la
pantalla lo pinte es lo único que no tiene síntoma mecánico — es el defecto que
la ola 3 se comió tres veces.

**La captura, de punta a punta:**

- `/energia` abre en **abr–sep 2026** (los seis últimos meses) con los **tres
  predios** de la base sembrada y **las 18 celdas en raya**, y el aviso ámbar
  diciendo «Faltan 18 de 18 recibos del periodo».
- Capturado un recibo de **9 000 / 1 500 kWh** en Santa Mónica: la celda de
  sep 2026 pasa a `$ 9,000.00 · 1,500 kWh · sin número`, el contador de la fila
  baja de **6 a 5** y el aviso a **17 de 18**.
- **El duplicado se rechaza**, con el mismo predio, mes y medidor: el botón
  devuelve **«El registro ya existe»** —el 23505 del índice único traducido a
  409 por `errores.ts`— y no entra una segunda fila.

**El reporte, con esos dos recibos dentro** (`luz`, jul–sep 2026):

| Pantalla | Espacio | Luz | Consumo | Costo / kWh |
|---|---|---|---|---|
| G500 Santa Mónica | 82 500 | **9 000** | 1 500 kWh | **6.00** |
| Mural DEMO Viaducto | 9 000 | **4 500** | 750 kWh | **6.00** |
| Valla DEMO Zaragoza | 9 000 | **4 500** | 750 kWh | **6.00** |
| Tlalpan G500 | 84 000 | 0 | 0 kWh | **—** |

> [!success] Lo que esa tabla demuestra, y no lo demostraba ninguna unitaria
> · **El reparto por caras llega a la pantalla**: el recibo de 9 000 del predio
>   Viaducto se partió **4 500 / 4 500** entre sus dos pantallas, contra
>   Postgres y con la fracción de caras de la renta.
> · **El orden es por más consumo**, no por peor margen.
> · **`costoPorKwh` es `—` y no `$0.00`** en la pantalla sin recibo. El `null`
>   llegó hasta el último metro.
> · **Los KPI cuadran**: `Espacio 184,500 · Operación 0 · Luz 18,000` suman el
>   `Costo total 202,500` que enseña el número grande.
> · **El pie cuadra**: la fila de totales suma exactamente las columnas.
> · **Dos avisos ámbar conviven** —periodo en curso y recibos que faltan— y la
>   tabla se sigue leyendo debajo.
>
> **Y la comprobación que de verdad importaba**: en `sitio`, las mismas cuatro
> pantallas dan **exactamente los mismos márgenes** (−91 500, −13 500, −13 500,
> −84 000). Las dos dimensiones no divergen, que es lo que se quería comprar
> metiendo la energía en el costo común.
>
> `luz-sin-recibo` **no aparece** en `sitio`, que es el negativo que se pedía.

**Presupuesto de las rutas**, medido porque es el riesgo crítico del módulo de
reportes: `/energia` nace en **110 kB** y `/reportes` sigue en **112 kB** — la
quinta dimensión no le costó nada a la pantalla que ya existía.

> [!note] La base sembrada se dejó COMO ESTABA
> Los dos recibos de la prueba **se borraron** al terminar (`consumos_energia`
> vuelve a 0 filas). La tabla sí se queda, que es la migración. Se borran porque
> `spaces_ver2` es la base con la que se reproducen las cifras que documentan
> [[03-Frontend/pantalla-reportes]] y [[02-Backend/reportes-dimensiones]]
> —`Costo $184,500.00` al abrir—, y dejarlos dentro las habría dejado mal.

---

## 10 · Lo que NO está hecho

1. **Las e2e no se corrieron.** El puerto **3311** y la base `spaces_e2e` los
   tenía otro agente esta ola. Las que hay que correr después están en §8 y en
   la lista de abajo.
2. **El área `energia` no está registrada** en `lib/modulos.ts` ni en
   `components/demo/shell/nav.ts` — los tiene el otro agente de la ola.
   **Consecuencia medida** (`AuthGate.tsx:19-24`): `moduloDe()` devuelve `null`
   para una ruta que el NAV no conoce, `noAutorizado` queda en `false` y la
   pantalla **se abre por enlace directo a cualquier rol interno**. El **dato**
   sigue protegido —el endpoint exige `operaciones`— pero el rol equivocado
   vería la pantalla y se comería un 403 sin saber por qué, que es el encierro
   que este repo ya documentó dos veces.
3. **No hay edición de un recibo**, solo alta y borrado. Un importe mal tecleado
   se borra y se vuelve a capturar. Es el mismo criterio que `licencias`, y
   evita un camino de actualización que tendría que respetar el índice único.
4. **No hay agregación en SQL**, igual que el resto del módulo: el motor lee y
   suma en Node.

### Las e2e que quedan pendientes

- **Aislamiento del consumo entre organizaciones**, con `poolApp()` y **nunca**
  el pool de administración. Dos organizaciones con recibos en el mismo periodo
  y **el mismo importe**, para que un fallo de aislamiento salga como un total
  **al doble** y no como una lista de nombres distinta — mismo diseño que la
  e2e de rentabilidad.
- **El 403 del rol sin `operaciones`** sobre `POST /api/energia/consumos`, y el
  401 sin sesión.
- **El 409 del recibo duplicado** contra el índice real.
- **`reportes-rentabilidad.e2e.test.ts`**, que se tocó para la convención del m²
  y no se ha corrido.

---

## Relacionadas
[[02-Backend/reportes-rentabilidad]] · [[02-Backend/reportes-dimensiones]] ·
[[03-Frontend/pantalla-reportes]] · [[02-Backend/arrendadores-y-contratos]] ·
[[02-Backend/inventario-y-sitios]] · [[multi-tenancy-y-rls]] ·
[[zonas-de-riesgo]] · [[convenciones]] · [[MOC-Proyecto]]

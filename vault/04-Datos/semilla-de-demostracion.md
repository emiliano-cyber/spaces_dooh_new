---
tipo: datos
estado: verificado
actualizado: 2026-10-06
tags: [datos, semilla, demo, rentabilidad, reportes, ooh-summit, entidades, energia, caras]
archivos:
  - scripts/semilla-demo.mjs
  - scripts/semilla-demo.test.ts
  - scripts/semilla-catalogo-demo.mjs
  - scripts/semilla-catalogo-demo.test.ts
  - infra/scripts/sembrar-catalogo-demo.sh
  - scripts/reiniciar-razones-sociales.mjs
  - db/semilla-desarrollo.sql
  - apps/web/lib/data/reportes.ts
  - apps/web/lib/costos-ot.ts
  - apps/web/lib/server/bienvenida-repo.ts
  - apps/web/lib/server/reportes-repo.ts
  - apps/web/lib/coordenadas.ts
---

# La semilla de demostración

> [!important] 2026-10-06 · hay DOS semillas, y conviven en la misma organización
> **`scripts/semilla-demo.mjs` es el GUION** (todo lo de abajo): seis pantallas
> `DEMO-*` afinadas para que el reporte de rentabilidad cuente una frase.
> **`scripts/semilla-catalogo-demo.mjs` es el CATÁLOGO**: lo que pide una demo
> para que cada pantalla del producto tenga algo que enseñar. Todo lleva el
> prefijo `CAT-` y no toca una sola fila `DEMO-`, así que las cifras del guion
> no se mueven.
>
> Lo que siembra, medido con `--resumen` el 06/10 (805 filas, 0 en la 2.ª corrida):
>
> | | |
> |---|---|
> | Pantallas | 24 · 12 fijas y 12 digitales, **2 de cada clase en cada uno de los 6 estados comerciales**; cada estado legal y operativo aparece al menos 2 veces |
> | Contratos | 11 · vigente, por vencer, vencido, renovado, cancelado e incompleto; de 2024 a **2028** |
> | Rentas | 260 pagos, con 3 vencidos a propósito |
> | Luz | 208 recibos, por predio y mes, de 2024-01 al último mes cerrado, con huecos |
> | Comercial | 8 clientes (una agencia con dos clientes suyos) · 13 propuestas (4 aprobadas, 3 enviadas, 3 borradores, 3 rechazadas) · 23 campañas en los 7 estados, de 2024 a 2028 · 57 reservas · 13 comprobantes con su cobranza (pagada, al corriente, por vencer, vencida y uno anulado) |
> | Operación | 77 órdenes de trabajo, en los 8 estados de `est_ot` |
> | Usuarios | uno por rol de `ROLES_ASIGNABLES`, `<rol>@catalogo.invalid`. **Sin** `CLIENTE` ni `COMERCIAL`: no tienen permisos (ADR 0010 y 0040) |
>
> **El estado de cada pantalla sale de sus reservas**: las OCUPADAS tienen
> campaña ACTIVA hoy, las RESERVADAS tienen reservas por delante y las
> DISPONIBLES solo historia. `comprobarCoherencia()` lo revisa sobre el plan
> antes de abrir la base y **se niega a sembrar** si el «hoy» la rompe: con
> `--ancla=2026-11-25`, por ejemplo, la cotización 020 ya habría empezado.
> Funciona hasta finales de octubre de 2026; después hay que mover fechas.
>
> **La contraseña no está en el repositorio**: entra por `SEMILLA_CLAVE` y se
> cifra en la base con `crypt(…, gen_salt('bf', 10))` de pgcrypto, que
> `bcryptjs` compara igual. Un usuario que ya existe no se toca.
>
> **En el servidor la corre una persona** con
> `infra/scripts/sembrar-catalogo-demo.sh <spaces_demo|spaces_prod> --org=<slug> [--con-guion]`,
> que toma la URL de `spaces_migrador` de `/etc/space-os/demo-instancia.env`,
> **respalda la base con `pg_dump` antes**. La vuelta atrás es `--deshacer`:
> borra solo lo `CAT-` de la organización, sin `cascade` y en una transacción
> (ensayada en local: 805 filas fuera, el guion intacto con 82 581 frente a
> 156 906, y la 2.ª vez «nada que deshacer»).
>
> [!warning] Por qué NO se restaura el `pg_dump` como vuelta atrás
> `pg_restore --clean` emite `DROP EXTENSION pgcrypto`, y la extensión es de
> `postgres`, no de `spaces_migrador` (diario del 01/10): la restauración
> moriría entera. El respaldo se queda para un desastre, y lo restaura alguien
> con el rol `postgres`.
>
> [!danger] 2026-10-06, noche · la primera siembra en DEMO salió por el sitio equivocado
> Se corrió **sin organización explícita** y el guion usó la de por omisión,
> `demo-rentabilidad`. En `spaces_demo` la demo vive en **`demo`**. Como
> `clave_interna`, `campanas.folio` y `ordenes_trabajo.folio` son únicos en
> TODA la base, el `on conflict` dio por «ya sembradas» las filas `DEMO-` de la
> otra organización, y lo que se guarda por organización sí entró: **65 filas
> sueltas en una organización nueva, sin un solo error** («filas nuevas: 65 ·
> ya sembradas: 182»). El catálogo murió después con «column
> espacios_comprados does not exist» —DEMO corre `beta` y su base iba por la
> migración del **04/10**, tres por detrás de `main`— y volvió atrás entero.
>
> **Lo que cambió para que no se repita**, reproducido en local antes de
> escribirlo (mismos 65/182):
> - **Ya no hay organización por omisión.** El catálogo y el guion del PADRE
>   exigen `--org=<slug>`, y la organización tiene que existir (o pedirse con
>   `--crear-org`).
> - **`semilla-demo.mjs` para si sus pantallas son de otra organización**, antes
>   de escribir nada, y dice cuál.
> - **El catálogo lee la base antes de escribir** (`--comprobar`): que estén
>   las columnas que escribe y que sus claves `CAT-` no sean de otra
>   organización. `espacios_comprados` es la única opcional: sin ella las
>   partidas se siembran sin ese dato. No se aplican migraciones a mano en
>   DEMO para esto: le llegan con la imagen por `update.sh` (R3).
> - Las 65 filas se retiran con
>   `docs/datos/20261006_retirar_org_demo_rentabilidad.sql`, por id, con
>   captura a CSV y su vuelta atrás. El ciclo entero (seco, aplicar, negarse
>   la 2.ª vez, volver, retirar) se ensayó en local sobre la reproducción.

> Verificado el 06/10 sobre una base local con las 105 migraciones: la app
> compilada entra con los 8 usuarios (200) y `GET /api/estado` devuelve las 13
> propuestas, las 7 clases de campaña y las 24 pantallas con su estado.

> [!important] 2026-10-05 · dos cosas que cambiaron alrededor de la semilla desde el 18/09
> **1 · El costo REAL de la OT (OT-COSTO-01, 29/09) y el renombrado a
> `margenBruto`.** Desde `20260929_costo_real_ot.sql` una orden puede llevar
> `ordenes_trabajo.costo_real`, y el motor de reportes lo prefiere a la tarifa
> por tipo (`apps/web/lib/data/reportes.ts:1359-1367`; lo lee
> `apps/web/lib/server/reportes-repo.ts:159`). **La semilla no lo siembra**: su
> `insert into ordenes_trabajo` (`scripts/semilla-demo.mjs:1372-1381`) no
> nombra la columna, así que las 114 órdenes nacen con `costo_real` en NULL y
> el reporte las sigue costeando por tipo — **las cifras del guion no se
> movieron**. Pero el `--verificar` calcula la operación **solo por tipo**
> (`scripts/semilla-demo.mjs:1539-1540`): si alguien captura un costo real a
> mano en una OT de la demostración, el reporte y la verificación dejan de
> coincidir sin que nada avise.
>
> El campo del reporte se llama **`margenBruto`** desde el 29/09
> (`apps/web/lib/data/reportes.ts:102`, `:125`, `:226`). En la consulta de
> verificación el alias se quedó en `margen` **a propósito**
> (`scripts/semilla-demo.mjs:1576-1584` explica por qué: renombrar solo el lado
> JavaScript dejó el `--verificar` saliendo siempre con código 2). Donde esta
> nota dice «margen» se refiere a ese mismo número.
>
> **2 · Latitud y longitud son OBLIGATORIAS** (`a2964383`, 24/09, en `main`).
> Una pantalla ya no nace sin ubicación, y la semilla, que no sembraba
> coordenadas, ahora se las da a las **seis** (`scripts/semilla-demo.mjs:373`
> en adelante, una pareja por pantalla; el `insert` las pasa como `$21`/`$22`
> en `:1230` y `:1252`). Lo fija `scripts/semilla-demo.test.ts:639`
> («las seis traen coordenadas utilizables», con `puntoUtil` de
> `apps/web/lib/coordenadas.ts`). Sin eso el mapa las mandaba al (0,0).
>
> Lo que **no** se volvió a medir hoy: el total de filas (247) ni las cifras del
> guion de abajo; no se corrió la semilla contra una base el 05/10.

`scripts/semilla-demo.mjs` siembra el **guion** con el que se enseña el módulo de
rentabilidad: una historia coherente de varios trimestres, con una conclusión
puesta a propósito y comprobada.

> [!important] No es «datos de prueba»: es un guion, y se prueba como tal
> El software se presenta el **14 de octubre** en el OOH SUMMIT. El módulo de
> reportes estará construido, y **un reporte trimestral sobre una base con tres
> semanas de datos dibuja una sola barra.** Ese riesgo no lo arregla ningún día
> de desarrollo, y es invisible hasta que se abre la pantalla — en el peor caso,
> en el escenario.
>
> Y el dueño tiene una frase concreta que el reporte tiene que poder enseñar:
>
> > «Tlalpan G500 es menos rentable que G500 Santa Mónica. Han tenido las mismas
> > campañas, pero a una van a cada rato a arreglarla.»
>
> Eso es una **afirmación**, y una afirmación se prueba. La comprueba
> `scripts/semilla-demo.test.ts` preguntándole al mismo motor que corre detrás
> de `GET /api/reportes/rentabilidad`.


> [!warning] 2026-09-18 · la columna de horas salía VACÍA, y solo se vio corriendo la app
> Las 74 órdenes nacían con `fecha_completada` y **sin `fecha_inicio`**, así que
> el reporte por operación devolvía `horasEnSitio: null` y
> `visitasConDuracion: 0`. El reporte no estaba mal —informaba null en vez de
> inventar un cero—: la semilla no daba el dato. Ni el typecheck, ni las 1430
> unitarias, ni las 390 e2e lo vieron; apareció al levantar la app y pedirle el
> reporte por su propio endpoint.
>
> Arreglado con `HORAS_POR_TIPO`, rangos **aprobados por Jochelo** el mismo día:
> inspección 0.5-1.5 h · desmontaje 1.5-3 · montaje de lona 2-4 · montaje
> digital 3-6 · preventivo 1.5-3 · **eléctrico 2-5 · correctivo 3-8 · herrería
> 4-10** · otro 1-3. Son datos de DEMOSTRACIÓN, no medición de campo.
>
> **Lo que no hay que deshacer al retocarlos:** las visitas extra de Tlalpan son
> correctivo, eléctrico y herrería — las **tres más largas**. Medido tras
> resembrar: **109.5 h contra 50 h**, o sea **2.19×**, cuando la razón de visitas
> es solo 1.5×. Las horas **amplifican** la conclusión del guion. Aplanar los
> rangos dejaría el reporte correcto y sin demostrar nada.
>
> La duración es **determinista** (sale del índice estable de la orden, no de
> `Math.random()`), que es lo que mantiene la idempotencia: la 2.ª corrida dice
> `filas nuevas: 0`. Y la jornada arranca a las **08:00** con cierre máximo a las
> 18:00, así que `fecha_completada::date` no cambia y los buckets del reporte
> caen donde caían — de paso, las 08:00 son más seguras que la medianoche
> implícita que había antes, que es la hora que un desplazamiento de zona manda
> al día anterior.

> [!success] 2026-09-18 · la semilla ya enseña las CINCO dimensiones
> Hasta esta fecha, una base recién sembrada **no podía enseñar tres de las cinco
> cosas construidas**. Medido sobre `spaces_ver2`, que es la base del ensayo:
>
> | | Antes | Ahora |
> |---|---:|---:|
> | Recibos de luz | **0** | **40** (de 48 posibles) |
> | Pantallas con más de una cara | **0** | **1** (de 6) |
> | Contratos con razón social | 1 de 3, **puestas a mano** | **3 de 4**, sembradas |
>
> Las dos razones sociales que tenía `spaces_ver2` se habían tecleado en la
> interfaz: **el guion no las sembraba**, así que una base nueva nacía sin
> ninguna y la pantalla de razones sociales, el selector del contrato y el
> «Emite» del comprobante no tenían nada que enseñar.

## Lo que siembra

| | |
|---|---|
| **Organización** | la crea con el slug que se le pase (`--org=`, por omisión `demo-rentabilidad`). **Nunca asume `rgb`** |
| **Historia** | 4 trimestres naturales **ya cerrados** por omisión; el mínimo admitido es 3, y por debajo se niega |
| **Arrendadores · predios · pantallas** | 4 · 4 · 6 |
| **Contratos** | 1 por predio, `VIGENTE`, con vigencia que **cubre todo el histórico** |
| **Razones sociales** | **3**, con los **cinco** papeles del catálogo repartidos, un dueño por papel |
| **Comercial** | 2 clientes · 2 campañas por trimestre · 40 reservas (con 4 trimestres) |
| **Operación** | 114 órdenes de trabajo (con 4 trimestres), con mezcla de `tipo_ot` |
| **Comprobantes** | **8** (uno por campaña) con su **emisora**, y su cobranza |
| **Luz** | **40** recibos, uno por predio y por mes **menos 8 huecos a propósito** |
| **`config_negocio.costos_ot`** | los **nueve** tipos capturados, con importes distintos entre sí |

Total: **247 filas**, y la segunda corrida dice `filas nuevas: 0`.

## El guion, y por qué cada pieza está donde está

**Dos pantallas comparables.** `Tlalpan G500` (`DEMO-TLP-01`) y `G500 Santa Mónica`
(`DEMO-STM-01`): mismo `tipo_medio`, mismas medidas (12.90 × 7.20), rentas al 1.8 %
una de otra (28 000 y 27 500 mensuales) y **predios distintos**, cada uno con su
arrendador y su contrato. Si compartieran predio compartirían contrato, y la renta
se repartiría entre las dos caras ([[04-Datos/esquema]] → `rentaAtribuidaPorSitio`).

**Las mismas campañas encima de las dos, al mismo precio.** Ingreso idéntico a
propósito: si difiriera, la conclusión del reporte seguiría siendo cierta pero
dejaría de demostrar nada — el dueño podría atribuirla a que una se vende peor.

**La diferencia, deliberada, en la operación.** Y **va empeorando**, que es la
decisión importante: una brecha plana se enseña igual con un solo periodo, y
entonces el reporte *trimestral* no estaría demostrando nada. Lo que justifica el
eje de tiempo es ver el margen de Tlalpan caer mientras el de Santa Mónica se
sostiene.

**Estáticas sin medidas a propósito.** `DEMO-SM-01` y `DEMO-SM-02` nacen con
`ancho` y `alto` en NULL, y con actividad (reservas, renta y OT) para que salgan
en el reporte. Sin ellas no se puede enseñar —ni comprobar— que el reporte de m²
las **excluye y las cuenta** en vez de esconderlas. Van las dos en el mismo predio
con un solo contrato, así que además ejercitan el reparto de la renta entre caras.

**Dos pantallas de la MISMA superficie física y distinto número de caras.**
`DEMO-DC-01` (2 caras) y `DEMO-UC-01` (1 cara), las dos de 10 × 4 m, en el predio
`PRE-INS` con un solo contrato de 18 000.

> [!danger] Las caras NO son cosméticas, y por eso las protagonistas se quedan en UNA
> `rentaAtribuidaPorSitio()` reparte la renta de un contrato de predio **entre las
> caras de sus pantallas**, y desde el 18/09 `fraccionDeCarasPorPredio()` reparte
> igual **la luz**. Subirle una cara a una pantalla le mueve la renta atribuida, el
> costo de la energía, el margen y todos los totales.
>
> Las cifras de **Tlalpan G500** y **G500 Santa Mónica** están escritas en
> `docs/Guion_Summit_20261014.md` y las validó el dueño, así que **las dos se
> quedan en una cara y solas en su predio**. Las caras se pusieron en pantallas
> nuevas.
>
> **Medido**, con la energía fuera de los dos lados para aislar el efecto:
>
> | Pantalla | Margen ANTES | DESPUÉS del cambio de caras |
> |---|---:|---:|
> | `DEMO-TLP-01` Tlalpan G500 | 124 400 | **124 400** |
> | `DEMO-STM-01` G500 Santa Mónica | 196 800 | **196 800** |
>
> Y hay una prueba que lo sostiene mutando el dato: triplicar las caras de todas
> las pantallas que **no** son del guion no mueve ni su `costoEspacio`, ni su
> `costoEnergia`, ni su margen. Si alguien las metiera en un predio compartido,
> se pondría roja ahí y no en el escenario.

**Los recibos de luz, con huecos DECLARADOS.** Uno por predio y por mes del
histórico —48 posibles— menos **8**, que es lo que permite enseñar la rejilla de
captura en ámbar y el aviso de cobertura del reporte. Una base completa no puede
demostrar que el producto **avisa de lo que falta**, que es la mitad de ese
módulo ([[02-Backend/energia-consumos]] §6).

> [!warning] Los huecos se REPARTEN entre trimestres, y ya costó una vez
> La primera versión ponía el hueco de los cuatro predios en el **último mes** del
> histórico. Con eso el último trimestre salía con un mes menos de luz y el
> reporte por trimestre daba `120 018 · 116 966 · 104 666 · 113 885` —
> **repuntaba al final**. La tabla era correcta y el guion del Summit dejaba de
> poder decir su frase: «el ingreso es plano y el margen cae».
>
> **No se vio leyendo la semilla: se vio pidiéndole el reporte al endpoint.** Hay
> dos pruebas nuevas que lo fijan (el margen por trimestre cae sin repuntes, y
> los huecos no se concentran en un trimestre).

Y **Tlalpan y Santa Mónica pierden exactamente el mismo mes**: si a una le
faltara un recibo que a la otra no, la brecha del guion tendría una segunda causa
y dejaría de ser atribuible a la operación.

**Las razones sociales, y una sin asignar a propósito.** Tres sociedades que se
reparten los **cinco** papeles del catálogo —`ARRENDAMIENTOS · ACTIVOS ·
LICENCIAS · OPERACION · VENTAS`, fijos por decisión del dueño del 18/09
([[02-Backend/multi-entidad-en-uso]])— con **un solo dueño por papel**, para que
la pantalla no pinte «papel sin dueño» ni «papel compartido» y el selector pueda
preasignar. La que tiene `ARRENDAMIENTOS` paga los contratos; la de `VENTAS`
emite los comprobantes.

**El contrato de `PRE-VIA` se queda SIN razón social**, y es deliberado: «sin
asignar» es un estado que el producto sabe pintar —lo tienen todas las filas
anteriores al 17/09— y no se puede enseñar si la semilla los asigna todos.

## Las cifras que produce — medidas el 2026-09-18

Pedidas al **endpoint de verdad** (`GET /api/reportes/rentabilidad`) sobre
`spaces_ver2` sembrada con `--ancla=2026-09-18`, rango `2025-07-01 → 2026-06-30`,
granularidad trimestral. **La luz entra en el costo y en el margen de TODAS las
dimensiones**, así que estas cifras ya no son las de antes del 18/09.

**Por pantalla:**

| Pantalla | Ingreso | Espacio | Operación | **Luz** | Costo total | **Margen** | % |
|---|---:|---:|---:|---:|---:|---:|---:|
| `DEMO-SM-01` Mural DEMO Viaducto | 72 000 | 36 000 | 26 400 | 4 264 | 66 664 | 5 336 | 7.4 % |
| `DEMO-SM-02` Valla DEMO Zaragoza | 72 000 | 36 000 | 26 400 | 4 264 | 66 664 | 5 336 | 7.4 % |
| `DEMO-UC-01` Una Cara DEMO Insurgentes | 192 000 | 72 000 | 49 200 | 10 166 | 131 366 | 60 634 | 31.6 % |
| `DEMO-TLP-01` **Tlalpan G500** | 576 000 | 336 000 | **115 600** | 41 819 | 493 419 | **82 581** | 14.3 % |
| `DEMO-DC-01` Doble Cara DEMO Insurgentes | 360 000 | 144 000 | 49 200 | 20 332 | 213 532 | 146 468 | 40.7 % |
| `DEMO-STM-01` **G500 Santa Mónica** | 576 000 | 330 000 | 49 200 | 39 894 | 419 094 | **156 906** | 27.2 % |
| **Total (6)** | **1 848 000** | **954 000** | **316 000** | **120 739** | **1 390 739** | **457 261** | **24.7 %** |

El ingreso de las dos comparables sigue siendo **el mismo**, y de la brecha de
74 325 la operación explica **66 400** (89 %): la luz solo aporta 1 925 y el
espacio 6 000.

**Por trimestre** — el ingreso plano y el margen cayendo, que es el paso 4 del
guion:

| Trimestre | Ingreso | Operación | Luz | **Margen** | % |
|---|---:|---:|---:|---:|---:|
| T3 2025 | 462 000 | 68 800 | 23 747 | **130 953** | 28.3 % |
| T4 2025 | 462 000 | 73 900 | 34 890 | **114 710** | 24.8 % |
| T1 2026 | 462 000 | 84 100 | 31 112 | **108 288** | 23.4 % |
| T2 2026 | 462 000 | 89 200 | 30 990 | **103 310** | 22.4 % |

**Por operación** — las horas amplifican la conclusión:

| Pantalla | Visitas | Horas | Operación | % del ingreso |
|---|---:|---:|---:|---:|
| `DEMO-TLP-01` Tlalpan G500 | **30** | **109.5** | 115 600 | 20.07 % |
| `DEMO-DC-01` Doble Cara | 20 | 50 | 49 200 | 13.67 % |
| `DEMO-STM-01` G500 Santa Mónica | 20 | 50 | 49 200 | 8.54 % |
| `DEMO-UC-01` Una Cara | 20 | 50 | 49 200 | 25.62 % |
| `DEMO-SM-01` / `DEMO-SM-02` | 12 | 24 | 26 400 | 36.67 % |

**Por metro cuadrado** — convención `todas-las-caras`, 2 estáticas excluidas por
no tener medidas:

| Pantalla | Caras | m² | Ingreso/m² | **Margen/m²** |
|---|---:|---:|---:|---:|
| `DEMO-TLP-01` Tlalpan G500 | 1 | 92.88 | 6 201.55 | **889.11** |
| `DEMO-UC-01` Una Cara DEMO Insurgentes | 1 | 40.00 | 4 800.00 | **1 515.85** |
| `DEMO-STM-01` G500 Santa Mónica | 1 | 92.88 | 6 201.55 | **1 689.34** |
| `DEMO-DC-01` Doble Cara DEMO Insurgentes | **2** | **80.00** | 4 500.00 | **1 830.85** |
| **Total (4)** | | | | **446 589** de margen |

La de dos caras aporta **80 m²** sobre 40 de superficie física: es la convención
del 18/09 llegando hasta la fila, y lo que la hace comparable con su vecina.

**Por consumo de luz** — ordenada por más costo de energía:

| Pantalla | Luz | kWh | **$/kWh** |
|---|---:|---:|---:|
| `DEMO-TLP-01` Tlalpan G500 | 41 819 | 6 745.00 | **6.20** |
| `DEMO-STM-01` G500 Santa Mónica | 39 894 | 6 540.00 | **6.10** |
| `DEMO-DC-01` Doble Cara DEMO Insurgentes | 20 332 | 2 946.66 | **6.90** |
| `DEMO-UC-01` Una Cara DEMO Insurgentes | 10 166 | 1 473.34 | **6.90** |
| `DEMO-SM-01` Mural DEMO Viaducto | 4 264 | 820.00 | **5.20** |
| `DEMO-SM-02` Valla DEMO Zaragoza | 4 264 | 820.00 | **5.20** |

Cobertura: **faltan 8 de 48** recibos, **0** recibos sin destino. El reparto 2/3 –
1/3 entre `DEMO-DC-01` y `DEMO-UC-01` es la fracción de caras del predio, la
misma que reparte la renta.

> [!warning] No copies estas cifras: se miden
> Cambian con `--trimestres`, con el ancla y con cualquier ajuste de
> `COSTOS_OT_DEMO`, `LUZ_POR_PREDIO` o `HUECOS_LUZ`. Para el número de hoy:
> `node scripts/semilla-demo.mjs --ancla=<fecha> --verificar`, y para el que va a
> salir en pantalla, el propio endpoint.

## Cómo se corre

```powershell
# Ver el guion sin tocar ninguna base
node scripts/semilla-demo.mjs --guion

# Sembrar y medir
$env:DATABASE_URL="postgresql://usuario:clave@host:puerto/base"
node scripts/semilla-demo.mjs --org=demo-rentabilidad --trimestres=4 --verificar
```

La base tiene que traer ya `db/schema.sql` y sus migraciones aplicadas
(`node scripts/migrar.mjs --instalacion-nueva` sobre una base recién nacida).

## Las cuatro propiedades que hay que no romper

> [!danger] Idempotente, y no es pulcritud
> La segunda corrida duplicaría reservas, y el reporte enseñaría **el doble de
> ingreso sin dar el menor error** — el modo de fallo que este repo persigue.
> Cada `insert` va guardado por una clave natural: `on conflict` donde hay índice
> único de verdad (`tenants.slug`, `sitios.clave_interna`, `campanas.folio`,
> `ordenes_trabajo.folio`) y `not exists` sobre `tenant_id` + clave donde no. La
> prueba **«NINGUNA sentencia inserta sin guard»** lo exige mecánicamente, para
> que la próxima tabla que entre al guion no se escape.
>
> Medido el 2026-09-18 sobre una base recién nacida: 1.ª corrida
> `filas nuevas: 247`; 2.ª `filas nuevas: 0 · ya sembradas: 247`, con los
> recuentos de la base idénticos antes y después (3 razones sociales · 5 papeles
> · 4 contratos · 8 comprobantes · 8 cobranzas · 40 recibos · 6 pantallas · 40
> reservas · 114 órdenes).
>
> **Dos sentencias son `update` y no `insert`, y hay un motivo medido:** la que
> asigna la razón social al contrato y la que asigna la emisora al comprobante.
> El `insert` del comprobante lleva `on conflict do nothing`, así que sobre una
> base donde el comprobante YA existe no hace nada — y tras pasar
> `reiniciar-razones-sociales.mjs` los ocho se quedaban **sin emisora** al volver
> a sembrar (`facturas_con_emisora=0`, medido). Las dos llevan
> `and <columna> is null`, así que son seguras de repetir **y** respetan una
> asignación que alguien hiciera a mano.

> [!danger] NO viaja en la imagen de producción
> Y no hay que hacer nada para conseguirlo, solo **no deshacerlo**: la etapa de
> ejecución del `Dockerfile` copia scripts por **lista blanca de un archivo**
> (`COPY … scripts/migrar.mjs`, `Dockerfile:106`) y de `db/` solo `schema.sql` y
> `migrations/` (`Dockerfile:94-95`). Mismo criterio con el que
> `db/semilla-desarrollo.sql` se quedó fuera: **una instancia de un cliente no
> puede nacer con las pantallas de una demostración dentro**. Un
> `COPY scripts/ ./scripts/` genérico rompería esa propiedad sin que nada fallara.
>
> **Comprobado otra vez el 2026-09-18** al añadir
> `scripts/reiniciar-razones-sociales.mjs`: la lista blanca sigue nombrando un
> solo archivo, así que el guion de reinicio —que **borra**— tampoco viaja a
> ninguna instancia.

> [!danger] Todo dato lleva su `tenant_id` (R2)
> El esquema nace **sin ninguna organización** a propósito (`db/schema.sql`, el
> bloque que explica por qué se retiró la semilla de `rgb`). El script crea la
> suya y etiqueta cada fila. Una prueba comprueba que **ningún `insert` a una
> tabla con `tenant_id` lo deja fuera**: es la deriva que ya etiquetó como RGB
> filas de otras empresas. Ver [[06-Operacion/zonas-de-riesgo]].

> [!note] Nada real, y se ve
> Ni dominios, ni IPs, ni RFC verdaderos, ni tokens. Los correos van a
> `.invalid` (RFC 2606 lo reserva para que nunca resuelva), los RFC empiezan por
> `DMO` y los teléfonos son ceros. Los importes son redondos a propósito: esto se
> proyecta delante de gente y tiene que leerse como una demostración. Una prueba
> lo comprueba sobre el plan serializado.

## El guion de reinicio del cuestionario

`scripts/reiniciar-razones-sociales.mjs`. Nació el 2026-09-18 y resuelve una
elección que no debería existir.

> [!danger] No se pueden enseñar el cuestionario y los reportes en la misma base
> El cuestionario de bienvenida aparece **solo si la organización no tiene
> ninguna razón social**: la condición es un `count(*)` sobre
> `entidades_fiscales` (`lib/server/bienvenida-repo.ts:70`), y cuenta **también
> las dadas de baja**, porque haber contestado es un hecho histórico. En cuanto
> se contesta, no vuelve a salir.
>
> Es **correcto** —si filtrara por `activo`, quien desactivara todas volvería a
> ver el cuestionario y crearía el duplicado que ese módulo existe para evitar— y
> a la vez es una trampa para una demostración en vivo. Con la semilla del 18/09
> la trampa es peor, porque ahora **la base nace con tres**.

Borra **solo** las razones sociales de una organización. Los papeles se van por
`on delete cascade` y las dos asignaciones —`contratos_arrendamiento.entidad_id`
y `facturas.entidad_emisora_id`— quedan en NULL por las claves ajenas
`on delete set null (columna)` de `20260918_entidad_tenant_compuesto.sql`. **Todo
lo demás se queda**: inventario, contratos, campañas, reservas, órdenes,
comprobantes, cobranzas y recibos de luz. Volver a sembrar las repone.

```powershell
$env:DATABASE_URL="postgresql://spaces:spaces@localhost:5433/spaces_ver2"

# 1 · ensayo: cuenta y NO toca nada
node scripts/reiniciar-razones-sociales.mjs --base=spaces_ver2 --org=demo-rentabilidad

# 2 · de verdad
node scripts/reiniciar-razones-sociales.mjs --base=spaces_ver2 --org=demo-rentabilidad --borrar

# 3 · después de enseñar el cuestionario, volver a dejarlas sembradas
node scripts/semilla-demo.mjs --org=demo-rentabilidad --trimestres=4
```

Hay una copia lista para pegar en `C:\Users\Server\Downloads\`, porque lo corre
una persona el día del ensayo.

> [!important] Es incómodo de disparar A PROPÓSITO, y hacen falta TRES cosas
> Porque borra, se corre a mano y se corre el día del ensayo, que es el peor día
> para equivocarse de base.
>
> 1. `DATABASE_URL` apuntando a la base;
> 2. `--base=<nombre>` **repitiendo el nombre**, que tiene que coincidir con el
>    de la URL. Escribirlo dos veces es lo único que convierte un «me equivoqué
>    de terminal» en un error en vez de en un borrado;
> 3. `--borrar`. Sin él solo cuenta e imprime qué se llevaría.
>
> Y **ni la base ni la organización tienen valor por omisión**: una base por
> omisión es una base que alguien borra sin haberla elegido, y un tenant por
> omisión es la deriva que ya etiquetó como `rgb` filas de otras empresas.

Y se niega **por nombre** a lo que no sea desechable — mismo criterio con el que
la semilla se niega a sembrar `spaces_e2e`. Medido el 18/09, las seis salidas:

| Caso | Qué contesta |
|---|---|
| `spaces_e2e` | `esta en la lista de bases que no se tocan` |
| `spaces` | `esta en la lista de bases que no se tocan` |
| `spaces_prod`, `spaces_produccion` | `lleva 'prod' en el nombre` |
| cualquier nombre sin el prefijo `spaces_` | `no empieza por 'spaces_'` |
| `--base` distinto del de la URL | nombra los dos y para |
| organización que no existe | la nombra y para |

## Lo que esta semilla NO hace, dicho para que no sorprenda

- **No siembra usuarios ni sesiones.** De eso se encarga
  `apps/web/scripts/bootstrap-auth.mjs`, que pide la identidad por variables de
  entorno. Para entrar a la aplicación y ver el reporte hay que correrlo aparte.
- **No siembra `sitio_modalidades`.** Las pantallas llevan `tarifa_publicada` y
  `tarifa_mensual`, que es lo que el reporte usa.
- **No siembra recibos de luz de pantalla suelta.** Los 40 van anclados al
  **predio**, que es el caso que describió el dueño. El anclaje a la pantalla
  existe y queda sin ejercitar aquí.
- **No siembra un recibo SIN DESTINO** (un predio con recibo y sin pantallas).
  El reporte lo sabe declarar y la cobertura lo cuenta; esta semilla no lo
  produce, así que ese aviso sale en 0.
- **No mira el trimestre en curso.** Siembra solo trimestres **cerrados**: uno a
  medias sale con menos ingreso y menos renta que los demás y en la gráfica se
  lee como una caída del negocio, no como un periodo incompleto.
- **La cuenta de `--verificar` es independiente del motor**, a propósito, y vale
  solo para esta semilla (cada reserva cabe entera en su trimestre y los
  contratos cubren todo el rango, así que no hay que prorratear). **La aritmética
  que manda es `apps/web/lib/data/reportes.ts`**, y quien la comprueba contra el
  guion es `scripts/semilla-demo.test.ts`. Si las dos discrepan, la que está mal
  es la del script.

## Relacionado

- [[04-Datos/esquema]] — las tablas que esta semilla escribe
- [[04-Datos/migraciones]] — `20260917_costos_ot_por_tipo.sql` es la que hace que
  el tipo de OT decida el costo, y por tanto lo que hace posible este guion
- [[06-Operacion/zonas-de-riesgo]] — R2, el `tenant_id` de cada fila
- [[02-Backend/operaciones-y-ot]] — de dónde salen los `tipo_ot`
- [[02-Backend/arrendadores-y-contratos]] — el anclaje predio/pantalla del contrato
- [[02-Backend/entidades-fiscales]] — las razones sociales propias del owner
- [[02-Backend/multi-entidad-en-uso]] — los cinco papeles fijos, y la asignación
  en contratos y comprobantes
- [[02-Backend/cuestionario-bienvenida]] — el cuestionario que este guion vuelve
  a hacer visible
- [[02-Backend/energia-consumos]] — el recibo de luz, el reparto por caras y la
  cobertura que declara los huecos
- [[02-Backend/reportes-dimensiones]] — la convención del m² por caras

# Guion de la presentación — OOH SUMMIT, 2026-10-14

> **Estado: BORRADOR VIVO, abierto el 2026-09-18.** Solo entra aquí lo que está
> **medido**. Lo que todavía no se ha visto funcionar va en §6 marcado como
> pendiente, no en el guion. Si una cifra de este documento no se puede
> reproducir con los pasos que están escritos a su lado, es que caducó: se
> vuelve a medir, no se copia.

Poliforum Siqueiros. Quedan **26 días** al abrir este archivo.

---

## 1 · Lo que se va a contar, en una frase

Un dueño de publicidad exterior no sabe qué pantallas le ganan dinero y cuáles
se lo comen. SPACE OS se lo dice, **y dice por qué**.

El guion entero cuelga de un caso que se ve en pantalla y no hace falta
explicar dos veces:

> **Dos espectaculares casi idénticos. Las mismas campañas. El mismo ingreso.
> Y uno gana la mitad que el otro — porque hay que ir a repararlo el doble de
> veces.**

Todo lo demás de la demostración existe para llegar a esa frase y para
sostenerla con números.

---

## 2 · Antes de entrar a la sala

### Lo que tiene que estar listo

| | |
|---|---|
| Base | `spaces_ver2` en el 5433, con el guion sembrado |
| Acceso | `duena@demo.invalid` · `Demo-Verificacion-2026` |
| Dirección | `http://localhost:3399/spaces-dooh/login/` |
| Arranque | `cd apps/web && npm run build` **y después** `npx next start` |

> [!danger] El orden del arranque no es opcional
> **Build primero, servidor después.** Reconstruir `.next` con el servidor ya
> corriendo deja la página **en blanco, sin un solo error** — el navegador pide
> trozos de un build que ya no existe. Pasó el 18/09 y costó un diagnóstico
> entero. Si hay que reconstruir algo a última hora, **se reinicia el servidor**,
> y matando al dueño del puerto (`Get-NetTCPConnection -LocalPort 3399`), no a la
> ventana de `npx`.

> [!danger] Y «la página no está en blanco» NO prueba que el build sea el bueno
> **Encontrado el 2026-09-18 al empezar este ensayo.** El servidor llevaba
> corriendo desde las 11:30 y el build de disco era de las 17:16: **cinco horas
> y tres cuartos de diferencia**. Y la aplicación **se veía perfecta** — inventario,
> reportes, todo. Se veía perfecta y estaba sirviendo **el código de la mañana**.
>
> El motivo es que los trozos de código de Next viven en `/_next/static/chunks/`
> y **no llevan el `BUILD_ID` en la ruta**: mientras un trozo conserve su
> nombre, el servidor viejo lo sirve sin quejarse. La página se queda en blanco
> solo cuando el nombre cambia — o sea, **a veces**. Es peor que un fallo
> constante: un fallo constante se ve.
>
> **Así que la comprobación de arranque no es mirar la pantalla, es comparar dos
> cadenas.** Un minuto, la víspera y otra vez el mismo día:
>
> ```powershell
> # 1 · qué build hay en disco
> cat apps/web/.next/BUILD_ID
> # 2 · qué build sirve el proceso  (tienen que ser IGUALES)
> (Invoke-WebRequest http://localhost:3399/spaces-dooh/login/).Content -match 'buildId[":\]+([A-Za-z0-9_-]{15,})'; $Matches[1]
> ```
>
> Si no coinciden: matar al dueño del puerto y volver a arrancar. **No hace
> falta reconstruir** si el disco ya está al día — arrancó en **376 ms**.

### Los cinco enlaces — ponlos en marcadores ANTES

Desde el 2026-09-18 la pantalla **lee los filtros de la dirección**, así que cada
paso del recorrido es un enlace. **No hay que tocar un solo selector ni teclear
una sola fecha delante de la sala.**

| Paso | Enlace |
|---|---|
| 1 · Inventario | `/spaces-dooh/inventario/` |
| 2 · Por pantalla | `/spaces-dooh/reportes/?dimension=sitio&desde=2025-07-01&hasta=2026-06-30&granularidad=trimestre` |
| 3 · Por operación | `/spaces-dooh/reportes/?dimension=operacion&desde=2025-07-01&hasta=2026-06-30&granularidad=trimestre` |
| 4 · Por trimestre | `/spaces-dooh/reportes/?dimension=trimestre&desde=2025-07-01&hasta=2026-06-30&granularidad=trimestre` |
| 5 · Por metro cuadrado | `/spaces-dooh/reportes/?dimension=m2&desde=2025-07-01&hasta=2026-06-30&granularidad=trimestre` |
| extra · Por consumo de luz | `/spaces-dooh/reportes/?dimension=luz&desde=2025-07-01&hasta=2026-06-30&granularidad=trimestre` |

> [!important] El enlace NO trae el orden — y el orden es la historia
> **Cronometrado el 2026-09-18 pantalla por pantalla.** La tabla abre ordenada
> «peor margen primero», que es lo correcto para trabajar y **lo contrario de
> lo que cuenta la historia**: las dos comparables salen en las filas **4 y 6**,
> con otra pantalla en medio. Y el orden **no viaja en la dirección**: solo
> `dimension`, `desde`, `hasta` y `granularidad`.
>
> Se arregla con **un clic en una cabecera**, y sale gratis: reordena en el
> navegador, **sin volver a pedir nada al servidor**. La regla, para no pensarla
> en el escenario:
>
> | Paso | Clic | Deja arriba |
> |---|---|---|
> | 2 · Por pantalla | **Ingreso** | Tlalpan y Santa Mónica, filas 1 y 2 |
> | 3 · Por operación | **Ingreso** | las mismas dos, juntas |
> | 4 · Por trimestre | **ninguno** | ya viene en orden cronológico |
> | 5 · Por metro cuadrado | **Margen / m²** | el ranking de mejor a peor |
> | extra · Por consumo de luz | **ninguno** | ya salen juntas |
>
> **Las tablas de §3 están escritas EN EL ORDEN DE DESPUÉS DEL CLIC.** Sin el
> clic, la pantalla dice los mismos números en otro orden.

> **Y el enlace resuelve solo el aviso del paso 2.** Con el enlace, el reporte abre ya
> en el rango bueno: la pérdida del trimestre en curso **no aparece**. Sigue
> existiendo si alguien entra por el menú —y el aviso ámbar sigue estando para
> eso— pero deja de ser un riesgo del escenario.
>
> Probado el 18/09: un valor inventado en la dirección (`dimension=nomina`,
> `desde=ayer`) **se ignora** y la pantalla cae al estado de siempre. Un enlace
> mal pegado no rompe nada; simplemente abre por omisión.

### Ensayo completo, la víspera

No el mismo día. Al menos una pasada entera con el proyector encendido, porque
hay una cosa que **nadie ha comprobado todavía**: cómo se leen estas pantallas a
tres metros. Las tarjetas de indicador se diseñaron para eso, pero está sin
verificar (§6).

---

## 3 · El recorrido, paso a paso

### Paso 1 · Inventario — «esto es lo que tienes»

`Inventario` en el menú. **Seis pantallas** con su tipo, ubicación, tarifa,
arrendador y renta.

Es el paso corto, y sirve para dos cosas: que la sala entienda de qué se habla
cuando luego aparezcan nombres, y que se vea que el dato es **normal** — un
inventario, no una maqueta.

> **Dato para decir en voz alta:** la renta que se ve en esta tabla sale del
> contrato con el arrendador, y **es el único costo del espacio**. No hay un
> costo de compra por separado: es el mismo dinero con otro nombre.

### Paso 2 · Reportes, por pantalla — «esto es lo que te deja»

`Reportes` en el menú, dentro del bloque de Finanzas.

> [!tip] Con el enlace preparado, esto ya no es un riesgo
> Entrando **por el enlace del paso 2** el reporte abre en el rango bueno y la
> pérdida del trimestre en curso no aparece. Lo de abajo aplica solo si entras
> por el menú.
>
> Entrando por el menú, el reporte **abre en el trimestre en curso** y muestra
> una pérdida: la renta ya corrió y las ventas aún no están dentro. Hay un aviso
> en ámbar que lo explica, pero la cifra roja entra por el ojo antes.
>
> **Y se puede usar a propósito, que es más vendedor:** dejas que se vea, señalas
> el ámbar y dices *«esto es un trimestre a medias, y el sistema te avisa de que
> no lo compares — la mayoría de los reportes te habrían dejado creer que estás
> perdiendo dinero»*. Si lo haces, **ensáyalo**: depende de que la frase salga
> antes que la cara de susto.

Con el rango en `2025-07-01` → `2026-06-30`, agrupado **por pantalla**:

| | Ingreso | Espacio | Operación | Luz | Margen | |
|---|---:|---:|---:|---:|---:|---:|
| **Tlalpan G500** | 576,000 | 336,000 | 115,600 | 41,819 | **82,581** | 14.3 % |
| **G500 Santa Mónica** | 576,000 | 330,000 | 49,200 | 39,894 | **156,906** | 27.2 % |
| Doble Cara DEMO Insurgentes | 360,000 | 144,000 | 49,200 | 20,332 | 146,468 | 40.7 % |
| Una Cara DEMO Insurgentes | 192,000 | 72,000 | 49,200 | 10,166 | 60,634 | 31.6 % |
| Mural DEMO Viaducto | 72,000 | 36,000 | 26,400 | 4,264 | 5,336 | 7.4 % |
| Valla DEMO Zaragoza | 72,000 | 36,000 | 26,400 | 4,264 | 5,336 | 7.4 % |
| **Total (6)** | **1,848,000** | **954,000** | **316,000** | **120,739** | **457,261** | **24.7 %** |

> **Remedido el 2026-09-18.** Las cifras anteriores no llevaban el costo de la
> luz, que ahora entra en el margen de todos los reportes. La brecha entre las
> dos comparables es **74,325**, y la operación explica **66,400 — el 89 %**. El
> espacio pone 6,000 y la luz solo 1,925: **el guion sigue en pie, y ahora con
> una fuente de costo más que lo confirma.**

**La frase de este paso, y conviene decirla tal cual:**

> «Las dos primeras son espectaculares casi iguales. Facturaron **exactamente lo
> mismo**: 576 mil cada una. Y una deja 82 mil y la otra 157 mil. **Setenta y
> cuatro mil pesos de diferencia, con el mismo ingreso.**»

Que la pregunta «¿por qué?» la haga la sala. Si no la hace, se hace desde el
escenario y se pasa al paso siguiente.

### Paso 3 · Por operación — la respuesta

Abre el **enlace del paso 3**. (Por el menú: **Agrupar** → `Por operación`.)

| | Visitas | Horas en sitio | Costo operación | % del ingreso | Margen |
|---|---:|---:|---:|---:|---:|
| Tlalpan G500 | **30** | **109.5 h** | 115,600 | 20.1 % | 82,581 |
| G500 Santa Mónica | **20** | **50 h** | 49,200 | 8.5 % | 156,906 |

Y debajo de cada nombre, el desglose de qué tipo de trabajo fue cada visita.
**Tlalpan tiene mantenimiento correctivo, eléctrico y herrería. Santa Mónica no
tiene ninguno de los tres.**

> «Ahí está. **Treinta visitas contra veinte** — pero sobre todo, **109 horas
> contra 50**. No es que vayan más veces: es que cuando van, se quedan. Correctivo,
> eléctrico, herrería. Esa estructura está pidiendo una inversión, y hasta hoy
> nadie tenía cómo saberlo.»

Es el momento de la presentación. Si algo se ensaya dos veces, es éste.

### Paso 4 · Por trimestre — «y va a peor»

Abre el **enlace del paso 4**. (Por el menú: **Agrupar** → `Por trimestre`.)

Las columnas, **en el orden en que salen**:

| Trimestre | Ingreso | Operación | Margen | % |
|---|---:|---:|---:|---:|
| T3 2025 | 462,000 | 68,800 | 130,953 | 28.3 % |
| T4 2025 | 462,000 | 73,900 | 114,710 | 24.8 % |
| T1 2026 | 462,000 | 84,100 | 108,288 | 23.4 % |
| T2 2026 | 462,000 | **89,200** | **103,310** | **22.4 %** |

> «**El ingreso es plano: 462 mil los cuatro trimestres.** Y el margen cae del 28
> al 22 por ciento mientras **el costo de operación sube de 68 mil a 89 mil**. No
> estás vendiendo peor. **Te está costando más.** Eso es lo que un reporte anual
> no te enseña nunca.»

> [!warning] La columna de visitas NO existe en esta vista — medido el 18/09
> Esta dimensión pinta **Ingreso · Espacio · Operación · Luz · Costo total ·
> Margen · Margen %**, y nada más. La frase anterior de este guion citaba
> «las visitas suben de 27 a 30»: **el dato es cierto** —27 + 28 + 29 + 30 son
> las 114 órdenes sembradas— **pero no está en la pantalla que se está
> señalando**, y eso en una sala se nota. El costo de operación sí está, sube un
> **30 %** y cuenta exactamente lo mismo.

Cualquier fila se puede desplegar para ver el detalle mes a mes. Solo si la sala
lo pide: no alarga el guion por gusto.

### Paso 5 · Por metro cuadrado — el cierre técnico

Abre el **enlace del paso 5**. (Por el menú: **Agrupar** → `Por metro cuadrado`.)

Convención: **todas las caras**, decidida el 18/09 y ya medida.

| Pantalla | Caras | m² | Margen / m² |
|---|---:|---:|---:|
| **Doble Cara DEMO Insurgentes** | **2** | **80.00** | **1,830.85** |
| G500 Santa Mónica | 1 | 92.88 | 1,689.34 |
| **Una Cara DEMO Insurgentes** | **1** | **40.00** | **1,515.85** |
| Tlalpan G500 | 1 | 92.88 | 889.11 |

> **La pareja que hace visible la decisión:** las dos de Insurgentes miden lo
> mismo físicamente (10 × 4), y el ranking las separa **solo por las caras** —
> 80 m² contra 40. Si alguien pregunta por qué el metro cuadrado suma caras,
> ésas dos son la respuesta.

Lo que sí se puede decir con seguridad, porque no depende de la cifra:

> «Y fíjense en lo que dice arriba de la tabla: **dos pantallas quedaron fuera
> porque no tienen las medidas capturadas**. El sistema no las promedia ni las
> cuenta como cero: **dice que le faltan.** Un número que miente es peor que no
> tener el número.»

Ese detalle vende más que la tabla. Es la diferencia entre un reporte y un
reporte en el que se puede confiar.

### Paso extra · Por consumo de luz — solo si sobra tiempo

Abre el **enlace extra**. **No necesita clic**: las dos comparables ya salen
juntas, ordenadas por lo que cuesta la luz.

| | Consumo | Costo / kWh | Costo de la luz |
|---|---:|---:|---:|
| Tlalpan G500 | 6,745 kWh | 6.20 | 41,819 |
| G500 Santa Mónica | 6,540 kWh | 6.10 | 39,894 |

La tabla no es lo que vende aquí. **Lo que vende es el aviso de arriba**, y está
escrito en la pantalla con estas palabras:

> «Faltan 8 de 48 recibos del periodo, así que el costo de la luz que ves está
> INCOMPLETO y el margen sale mejor de lo que va a quedar. Un mes sin recibo no
> es un mes sin consumo: es un dato que nadie ha capturado todavía.»

> [!tip] Si solo te queda un minuto para el cierre, usa éste y no la tabla
> Es el mismo argumento del paso 5 —el sistema dice lo que le falta— pero **más
> fuerte, porque además dice en qué dirección te está engañando**: «el margen
> sale mejor de lo que va a quedar». Un reporte que avisa de que su propio
> número es optimista es algo que la sala no ha visto antes.
>
> Y los 8 huecos **están sembrados a propósito**. No es un defecto de la demo:
> es la demo.

---

## 4 · La trampa del cuestionario de bienvenida

> [!success] RESUELTO el 2026-09-18 — ya existe el guion de reinicio
> `node scripts/reiniciar-razones-sociales.mjs --base=spaces_ver2 --org=demo-rentabilidad`
> cuenta lo que borraría **sin tocar nada**; con `--borrar` lo hace. Exige la URL,
> el nombre de la base repetido **y** la bandera: tres cosas a la vez. Se niega
> por nombre sobre `spaces`, `spaces_e2e` y cualquiera con `prod`.
>
> **La secuencia del ensayo:** reiniciar → enseñar el cuestionario → volver a
> sembrar con `semilla-demo.mjs`. **Ensayada entera el 2026-09-18, con huella de
> la base tomada antes y después:**
>
> | | Tiempo | Salida |
> |---|---:|---|
> | Ensayo sin `--borrar` | **195 ms** | 0 — y lista las 3 razones y los 5 papeles |
> | `--borrar` de verdad | **180 ms** | 0 — y **relee la base tras el commit** |
> | Cuestionario en pantalla | **135 ms** | las 3 preguntas y los 5 papeles |
> | `semilla-demo --verificar` | **624 ms** | 0 — y reafirma 82 581 vs 156 906 |
>
> **La huella volvió idéntica, fila por fila**: 3 razones · 5 papeles · 3
> contratos asignados · 8 comprobantes con emisora · 6 sitios · 114 órdenes ·
> 40 recibos. Y el reporte volvió a dar **1 848 000 / 457 261 / 24.7 %**, los
> mismos dígitos que antes de borrar. **Menos de dos segundos de máquina en
> total**, así que el ciclo cabe entre dos preguntas del público.
>
> Lo de abajo se conserva porque explica **por qué** hacía falta.

> [!danger] No se pueden enseñar las dos cosas en la misma base
> El cuestionario de razones sociales **solo aparece si la organización no tiene
> ninguna razón social registrada** — la condición es un `count(*)` sobre
> `entidades_fiscales` (`lib/server/bienvenida-repo.ts:70`). En cuanto se
> contesta, no vuelve a salir. **Es el comportamiento correcto**, y es una trampa
> para una demostración en vivo.
>
> Y **la base de demostración tiene 3 razones sociales dadas de alta** —eran 2
> cuando se escribió esto—, así que **el cuestionario ya no sale ahí**. Vuelto a
> medir el 18/09.
>
> Salidas, a elegir antes del ensayo:
>
> 1. **Dos bases**: una virgen para enseñar el cuestionario y `spaces_ver2` para
>    todo lo demás. Obliga a cerrar sesión y volver a entrar en medio de la
>    demostración — se ve, y se ve mal.
> 2. **Una base virgen y contestar el cuestionario en vivo**, y que las razones
>    sociales que se creen sean las que después se usan. Es lo más honesto y lo
>    que mejor cuenta la historia, pero deja el resto de la demostración sin los
>    cuatro trimestres sembrados.
> 3. **Un guion de reinicio** que borre las razones sociales de `spaces_ver2`
>    justo antes de empezar, dejando intacto el resto. **Es la buena**, y hay que
>    escribirla: hoy no existe.

**Acción pendiente, con dueño:** escribir ese guion de reinicio. Sin él, hay que
elegir entre enseñar el alta de razones sociales o enseñar los reportes con
historia, y esa es una elección que no debería existir.

---

## 5 · Lo que NO se enseña, y por qué

Decidirlo ahora, no en la sala.

- **No se abre el código.** Ni una vez.
- **No se enseña una pantalla que no se ensayó.** Si algo llega tarde, no entra.
- **No se promete el timbrado fiscal.** Lo que hoy emite el sistema son
  comprobantes de pago, no CFDI timbrado; el timbrado llega después por
  integración. Si alguien pregunta, ésa es la respuesta: es el plan, no un hueco.
- **No se dan fechas de lo que no está construido.**

### La pregunta de los cinco papeles, y la respuesta preparada

**Medido el 2026-09-18 en el código.** El cuestionario captura los **cinco** papeles
que pidió el jefe, y eso está bien — pero solo **dos mueven dinero hoy**:

| Papel | ¿Lo usa el producto? | Dónde |
|---|---|---|
| **Paga las rentas a los arrendadores** | ✅ **sí** | el contrato dice quién paga, y se puede cambiar (`ContratoSheet.tsx:177`) |
| **Vende publicidad** | ✅ **sí** | el comprobante dice «Emite: …», y se elige al emitirlo (`finanzas/page.tsx:255`) |
| Compra los activos y el equipo | ⬜ **se captura, nada lo consume** | **no hay módulo de activos** |
| Trámites y licencias con gobierno | ⬜ **se captura, nada lo consume** | **no hay módulo de licencias** |
| Operación y nómina | ⬜ **se captura, nada lo consume** | el costo de una OT **no se atribuye** a una razón social |

> [!important] Y esto NO es trabajo a medias — es la diferencia que hay que saber decir
> Los tres papeles que no hacen nada no esperan a que alguien termine una pantalla:
> esperan a que el producto **tenga activos, licencias o nómina**, y hoy no los tiene.
> `lib/modulos.ts` no declara ninguno de los tres.
>
> Capturarlos igualmente **es lo correcto**, y conviene decirlo así: el sistema
> aprende la estructura fiscal completa de la empresa **el primer día**, y el día que
> entre el módulo de activos ya sabe a nombre de quién se compran. Lo contrario
> —preguntarlo cuando haga falta— es volver a molestar al cliente y a su contador.
>
> **La respuesta si alguien pregunta «¿y lo de los activos?»:** *«El sistema ya sabe
> con qué razón social los compras. Lo que todavía no tiene es dónde registrarlos —
> eso llega después, y cuando llegue no hay que volver a preguntártelo.»* Es el plan,
> no un hueco, y es la misma respuesta que la del timbrado.

### Lo que el jefe NO pidió, y por eso no está

**No hay reporte «por razón social».** Las cinco dimensiones son las cinco que pidió
—pantalla, trimestre, operación, m² y luz— y ninguna agrupa por sociedad. **El dato
existe** (`contratos_arrendamiento.entidad_id` y `facturas.entidad_emisora_id`), así
que es una sexta dimensión, no una reconstrucción.

> **Conviene tenerlo pensado porque es la pregunta natural del encargo.** El ADR 0034
> dice que el dueño **no quiere separar** sus razones sociales, quiere **verlas
> juntas** — y el siguiente paso obvio de esa frase es «¿cuánto deja cada una?». Si
> sale en la sala, la respuesta honesta es que el dato ya está capturado y la vista es
> el siguiente reporte. **No se promete fecha** (§5).

---

## 6 · Lo que todavía no está, al 2026-09-18

Esta lista es el trabajo que queda, y se vacía o se convierte en «no se enseña».

| | Estado | Qué falta |
|---|---|---|
| ~~**m² por caras**~~ | ✅ **HECHO** | Aplicado, medido y en el paso 5 |
| ~~**Multi-entidad: pantalla y asignación**~~ | ✅ **HECHO** | En `main` con el PR #91, y sembrado en la demo |
| ~~**Consumo de luz**~~ | ✅ **HECHO** | 40 recibos sembrados, con 8 huecos a propósito |
| ~~**Guion de reinicio** del cuestionario~~ | ✅ **ENSAYADO** | Ciclo entero corrido el 18/09: borra, enseña y resiembra en **&lt; 2 s**, y la huella de la base vuelve idéntica (§4) |
| ~~**El recorrido entero, cronometrado**~~ | ✅ **HECHO** | Los cinco pasos y el extra, medidos uno por uno. Todo bajo **0.72 s** (§7) |
| **Tres papeles sin acentos** | **Defecto abierto** | `Tramites`, `Operacion y nomina` y `Licencias` se pintan sin acento en el cuestionario. Están **sembrados en una migración ya aplicada** (`20260917_entidades_fiscales.sql:78-80`), así que se arregla con una migración nueva, no editando ésa |
| **Lectura a tres metros** | **Sin verificar** | Una pasada con el proyector, la víspera. **Es lo único del guion que sigue sin medir** |
| **Dónde se presenta** | **Sin decidir** | ¿Portátil con la base local, o una instancia de verdad servida? No es lo mismo y cambia el ensayo |

> [!success] Lo que este ensayo cerró, y lo que dejó abierto
> **Cerró tres cosas**: los cinco pasos dan **exactamente** las cifras escritas en
> §3 —comprobadas celda por celda—, el ciclo del cuestionario es reversible **con
> huella medida antes y después**, y el tiempo de máquina del recorrido completo
> cabe en **dos segundos**.
>
> **Y encontró tres que no se veían leyendo:** que el enlace no trae el orden y
> la historia lo necesita (§2), que el paso 4 citaba una columna **que no está en
> esa pantalla** (§3), y que un servidor viejo puede servir código de hace seis
> horas **sin que la pantalla lo delate** (§2).
>
> Queda **una sola cosa sin medir en todo el documento**, y no es de software:
> cómo se lee esto a tres metros.

### Y la pregunta que nadie ha hecho todavía

**¿Desde dónde se presenta?** Todo lo de este guion está medido contra un
servidor local en un portátil. Si el 14 de octubre se enseña desde una instancia
real servida por internet, hay que ensayarlo **ahí**, con su latencia y su
certificado. Es la clase de cosa que solo falla el día que importa.

---

## 7 · El cronómetro — recorrido completo del 2026-09-18

Recorrido entero, paso por paso, en el navegador y contra `spaces_ver2`. Las
cifras de máquina son del `Navigation Timing` y del `Resource Timing` del propio
navegador, no de un cronómetro a mano.

### Lo que tarda la máquina

| Paso | HTML | Página lista | **El número en pantalla** |
|---|---:|---:|---:|
| 1 · Inventario | 118 ms | 291 ms | **719 ms** |
| 2 · Por pantalla | 67 ms | 221 ms | **531 ms** |
| 3 · Por operación | 87 ms | 194 ms | **486 ms** |
| 4 · Por trimestre | 77 ms | 148 ms | **429 ms** |
| 5 · Por metro cuadrado | 52 ms | 130 ms | **353 ms** |
| extra · Por consumo de luz | 50 ms | 92 ms | **367 ms** |
| Cuestionario de bienvenida | 41 ms | 61 ms | **135 ms** |

**Nada pasa de siete décimas**, y los clics de ordenar no cuestan red: reordenan
en el navegador sin volver a preguntar.

> [!tip] El primero es el caro, y por eso se abre antes de que miren
> Los 719 ms del inventario son **el único arranque en frío**: paga los trozos de
> código que los demás ya encuentran guardados. Los cinco pasos siguientes bajan
> a la mitad. **Abre el paso 1 antes de que la sala esté mirando** y el recorrido
> entero va sobre ruedas.

### Lo que tarda la persona

Esto no lo mide una máquina, así que va contado en palabras, que sí se cuentan:

| Paso | Palabras de guion |
|---|---:|
| 1 · Inventario | 5 |
| 2 · Por pantalla | 78 |
| 3 · Por operación | 45 |
| 4 · Por trimestre | 52 |
| 5 · Por metro cuadrado | 48 |
| **Total** | **228** |

A ritmo de presentación —de 110 a 150 palabras por minuto— las frases escritas
son **entre 1.5 y 2 minutos**. Eso es el esqueleto, no la presentación: contando
el encuadre de cada pantalla, las pausas y el silencio del «¿por qué?» del paso
2, **calcula de 6 a 8 minutos** el recorrido de cinco pasos, y **dos segundos de
máquina en todo**.

> **El reparto dice dónde ensayar.** El 99.9 % del tiempo eres tú hablando. Lo
> único que puede fallar de la máquina ya está medido y cabe en una décima; lo
> que puede fallar de verdad es el orden de las frases. Los tres clics de ordenar
> son lo único que hace tu mano, y son siempre el mismo gesto.

---

## 8 · Cómo se reproduce cada cifra de este documento

Para que nadie tenga que creerme:

```
# 1. Levantar
cd apps/web && npm run build
DATABASE_URL="postgresql://spaces:spaces@localhost:5433/spaces_ver2" npx next start -p 3399

# 2. Entrar en http://localhost:3399/spaces-dooh/login/
#    duena@demo.invalid / Demo-Verificacion-2026

# 3. Reportes → rango 2025-07-01 a 2026-06-30 → cambiar «Agrupar»
```

Y si la base se pierde, se vuelve a sembrar — el guion de los datos es
determinista y produce exactamente los mismos números:

```
node scripts/semilla-demo.mjs --org=demo-rentabilidad --trimestres=4 --verificar
```

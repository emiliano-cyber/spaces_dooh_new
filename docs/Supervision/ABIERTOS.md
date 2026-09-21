# Supervisión · lo que queda ABIERTO

> Expediente vivo del supervisor. **Se actualiza, no se reescribe**: lo cerrado se
> tacha con su fecha y con qué se midió, porque en este proyecto la historia de una
> cifra es lo que la hace útil.
>
> **Nace el 2026-09-18**, sobre `integra/entidades-y-reportes` medida en el worktree
> `.claude/worktrees/entidades`. Fecha dura: **2026-10-14, OOH SUMMIT** — 26 días.

~~**Veredicto vigente de la rama: 🔴 ROJO.**~~ **Superado el 2026-09-18, tarde.** Los
dos motivos del rojo están cerrados y medidos:

- la puerta de e2e **se corrió en este árbol**: `41 archivos · 461 pruebas · 1 omitida`,
  exit 0, 198 s, con el build hecho antes;
- la pantalla de reportes ya **no afirma una pérdida sin decirlo**: el dueño eligió
  seguir abriendo en el trimestre vivo y entró un aviso en ámbar condicionado.
  Verificado en el navegador: sale en jul–sep 2026 y **desaparece** al mover el rango
  a abr–jun 2026.

~~**Veredicto de `chore/cierre-ola4`: 🟠 ÁMBAR por B23.**~~ **Revisado el 2026-09-18,
noche.** B23 está cerrada y medida en las dos bases, así que **ya no hay nada en esta
lista que pueda parar trabajo.**

**Veredicto vigente: 🟠 ÁMBAR, y por un solo motivo: `B8`.** Nadie ha abierto el PR,
así que `ci.yml` **no ha verificado nada en una máquina limpia** — y la regla de este
expediente es que *verde en mi árbol no es verde*. Todo lo demás está medido aquí:
typecheck limpio · **130 archivos / 1659 unitarias** · build correcto · **41 archivos /
461 e2e**. **B8 no lo puedo cerrar yo**: `git push` y `gh` están prohibidos por la
regla del repositorio, así que ese ámbar se vuelve verde en cuanto abras el PR.

Lo único más que queda abierto es **B11**, que no es un defecto: es una pantalla que no
existe todavía. Y **tres decisiones tuyas** —D6, D7 y la nueva **D8**, que salió del
ensayo del guion—.

> **De las 15 advertencias que este expediente llegó a tener, quedan 2.** Y conviene
> anotar cómo se cerraron cinco de ellas el 18/09: **ya estaban arregladas y nadie lo
> había apuntado** —el arreglo entró en una ola posterior y la advertencia siguió
> figurando como abierta—. Es el mismo vicio que este archivo persigue, cometido por
> el archivo mismo. La lección: **una lista de pendientes también caduca**, y se
> reverifica contra el repositorio antes de leerla, no después.

---

## A · Decisiones del dueño

Ordenadas por **cuánto trabajo bloquea cada una**, que es el orden en que conviene
preguntarlas. Están escritas para leerse en voz alta: sin jerga y sin rutas de
archivo dentro de la pregunta.

> **Estado al 2026-09-18, tarde.** De las seis, **cinco están contestadas y
> construidas** (D1, D2, D3, D4, D5) — y en tres de ellas el dueño eligió **algo
> distinto de lo que yo recomendaba**, que es como debe ser. **Quedan vivas: D6** y
> la nueva **D7**. Las contestadas se conservan tachadas, con la elección y con qué
> se comprobó que está aplicada y no solo escrita.

---

### ~~D1 · El jefe pidió medir el consumo de luz. Hoy no existe ese dato en ningún sitio: ¿quién lo va a teclear, y cada cuánto?~~

> ✅ **CONTESTADA por el dueño y CONSTRUIDA. 2026-09-18.** Eligió la opción (a),
> captura manual, con el grano en **predio y mes** y no en pantalla y mes.
> **Con qué se midió:** tabla `consumos_energia` creada por
> `db/migrations/20260918_consumos_energia.sql:28`, pantalla **Consumo de luz** en
> el bloque de Operaciones (`components/demo/shell/nav.ts`), endpoints
> `app/api/energia/consumos/route.ts:34,49` con `exigir('operaciones','ver'|'crear')`,
> y **40 recibos sembrados** en `spaces_ver2`
> (`select count(*) from consumos_energia` → `40`). Vista en el navegador el 18/09:
> rejilla predio × mes con los huecos en ámbar y el aviso literal «Faltan 14 de 24
> recibos del periodo». La quinta dimensión del reporte calcula:
> `Luz $30,990.00` sobre abr–jun 2026, con columnas `CONSUMO` y `COSTO / KWH`.



- **Bloquea:** la quinta forma de ver el reporte, completa. No hay dónde guardar un
  consumo, no hay pantalla para capturarlo y no hay un solo registro en la base. Es
  la única de las cinco dimensiones que pidió el jefe que **no está empezada**.
  Mientras no se contesta, sí se puede seguir con las otras cuatro, con la pantalla
  de razones sociales y con todo lo de la lista B.
- **Por qué importa:** las otras cuatro dimensiones ya calculan. Esta arranca de
  cero —hace falta guardar el dato, una pantalla para capturarlo y decidir de dónde
  sale— y **quedan 26 días**. Es el trabajo más grande que queda sin empezar del
  alcance que pidió el jefe, y es el único que no se puede acelerar después: sin
  meses de consumo capturados, el reporte sale vacío aunque el código esté listo.
- **Opciones:**
  - **a) El dato lo teclea una persona, un número por pantalla y por mes.** Es lo
    más rápido de construir (una pantalla de captura sencilla). Coste: alguien
    tiene que capturar todos los meses de historia que se quieran enseñar, y si no
    lo hace, el reporte enseña huecos.
  - **b) Un consumo fijo por tipo de pantalla, estimado una vez.** Se construye en
    poco tiempo y no necesita que nadie capture nada. Coste: es una estimación, no
    una medición — no sirve para comparar dos pantallas del mismo tipo, que es
    justo la pregunta que el reporte contestaría.
  - **c) No entra al 14 de octubre.** Se enseñan cuatro dimensiones y se dice que
    la de luz viene después. Coste: el jefe pidió cinco.
- **Recomendación:** **(b) para el 14 de octubre y (a) después.** Con la estimación
  se puede enseñar la dimensión funcionando el día del SUMMIT, y la captura real
  entra cuando haya tiempo sin rehacer nada, porque la pantalla lee el mismo sitio.
  Recomendar no es decidir.
- **Si nadie contesta:** no se hace nada y el 14 de octubre se enseñan cuatro
  dimensiones de cinco. Es aceptable si el jefe lo sabe de antemano; **no** es
  aceptable descubrirlo ese día.
- **Caduca:** **2026-09-25.** Contestarla después no deja tiempo para capturar ni
  estimar nada antes del SUMMIT.

---

### ~~D2 · Las razones sociales se pueden guardar, pero no hay pantalla para verlas ni para usarlas. ¿Se enseña esto el 14 de octubre, o se deja para después?~~

> ✅ **CONTESTADA por el dueño y CONSTRUIDA COMPLETA. 2026-09-18.** Eligió la (a),
> no la (b) que yo recomendaba: pantalla **y** asignación.
> **Con qué se midió:** pantalla `/razones-sociales`
> (`app/(app)/(shell)/razones-sociales/page.tsx`), entrada propia en el menú
> (`components/demo/shell/nav.ts:153`, rol `DUENO`), selector de entidad en
> contratos y comprobantes (`8c6002e`), y **3 razones sociales sembradas** en
> `spaces_ver2` con **3 de 4 contratos asignados**
> (`select count(*) total, count(entidad_id) from contratos_arrendamiento` → `4 | 3`).
> Vista en el navegador el 18/09: tres renglones con RFC, régimen y sus papeles, y
> los botones «+ Nueva razón social» · «Editar» · «Dar de baja». Con eso **B10
> también queda cerrada**.
>
> ⚠️ **Pero la promesa falsa que motivó esta pregunta sigue viva a medias** — ver
> **B26**: el cuestionario sigue mandando a «Administración», donde no hay nada.



- **Bloquea:** la mitad del alcance que pidió el jefe. Hoy el sistema sabe guardar
  varias razones sociales y para qué sirve cada una, pero **nadie puede verlas ni
  editarlas desde la aplicación**, y **ningún contrato ni comprobante se puede
  asignar a una de ellas**. Los huecos para guardar esa asignación existen en la
  base y están vacíos. Todo lo demás de la lista B avanza sin esta respuesta.
- **Por qué importa:** la pantalla de bienvenida le dice al usuario, con estas
  palabras, que para cambiarlas o añadir otra vaya a Administración — **y en
  Administración no hay nada de eso**. Es una promesa escrita que el producto no
  cumple, y la vería cualquiera que entre por primera vez. Además, la única forma
  de capturar razones sociales hoy es el cuestionario del primer día: si se
  contesta «no» o se salta, no hay segunda oportunidad desde la aplicación.
- **Opciones:**
  - **a) Se construye la pantalla de razones sociales y el selector en contratos y
    comprobantes.** Es el alcance que pidió el jefe, completo. Coste: es el trabajo
    más grande que queda; dos pantallas nuevas y tocar el alta de contratos, que es
    zona de riesgo.
  - **b) Solo la pantalla para ver y editar las razones sociales**, sin el selector
    en contratos. Coste: se enseña que el sistema las conoce, pero no se puede
    enseñar «este contrato lo paga esta sociedad», que es para lo que servían.
  - **c) Se retira el cuestionario de bienvenida hasta que haya pantalla.** Coste:
    se pierde la parte visible; se gana no prometer lo que no hay.
- **Recomendación:** **(b), y corregir la frase de la bienvenida en el mismo
  cambio.** Es lo que cabe en el calendario sin tocar el alta de contratos a 26
  días del lanzamiento, y deja de mentirle al usuario. La (a) es el objetivo, pero
  entrar al alta de contratos ahora abre riesgo justo antes de la fecha.
- **Si nadie contesta:** se queda como está, y quien entre por primera vez lee una
  instrucción que no lleva a ninguna parte. **No es aceptable** para una demo.
- **Caduca:** **2026-09-30.** Después no hay margen para construir una pantalla y
  probarla.

---

### ~~D3 · El reporte de rentabilidad abre en el trimestre en curso, que todavía no ha terminado. ¿Debe abrir ahí, o en el último trimestre cerrado?~~

> ✅ **CONTESTADA por el dueño. 2026-09-18.** Eligió la **(b)**, no la (a) que yo
> recomendaba: **abre en el trimestre vivo, porque es lo que quiere mirar**, y el
> engaño se arregla por el otro lado —diciéndolo en pantalla—.
>
> **Con qué se midió que la elección está aplicada y no solo escrita:**
> `RANGO_DE_APERTURA` es `rangoDelTrimestreDe` (`consulta.ts:236`), el camino de
> vuelta `rangoDelTrimestreCerradoDe` se conserva entero con sus pruebas
> (`consulta.ts:195`), y el aviso sale de `avisosDelReporte` con la clave
> `periodo-en-curso` bajo la condición `solapaTrimestreEnCurso` (`consulta.ts:241`).
> **Visto en el navegador el 18/09, las dos mitades:** en jul–sep 2026 la pantalla
> abre con `Ingreso $0.00 · Costo $238,500.00 · Margen ($238,500.00)` **y** el ámbar
> encima diciendo «El periodo que estás viendo toca T3 2026, que está EN CURSO:
> llevan 80 de sus 92 días… No lo compares con un trimestre terminado»; al mover el
> rango a abr–jun 2026 la pantalla da `Ingreso $462,000.00 · Margen 22.4 %` y **el
> ámbar desaparece**. Esa desaparición es la parte que hace que el aviso valga: no
> sale siempre.
>
> **Juicio del supervisor sobre el aviso, que es lo que se me pidió:** basta. La
> condición muerde (probada en `consulta.test.ts:187,205,212,219,233`, incluido el
> caso `2026-9-1` sin cero a la izquierda, que es el que un `<=` de cadenas habría
> dejado pasar justo en el mes que importa). Queda un residuo declarado, **no un
> motivo de rojo**: las cuatro cifras grandes del encabezado —las pensadas para
> leerse de lejos en un proyector— **no llevan el ámbar dentro**, así que a tres
> metros de la pantalla se lee «−$238,500.00 en rojo» sin el matiz. Si el dueño
> quiere cubrir eso sin cambiar su decisión, lo barato es marcar el propio KPI, no
> mover el rango.



- **Bloquea:** que la pantalla de reportes se pueda enseñar. No bloquea nada más: se
  cambia en un renglón y la vuelta atrás es el mismo renglón.
- **Por qué importa:** **medido hoy en la aplicación, con la base de demostración.**
  La pantalla abre en julio–septiembre de 2026. En ese periodo ya se está pagando
  renta pero todavía no hay ventas registradas, así que la primera cosa que ve
  quien entra es: **ingreso $0.00, costo $184,500.00, margen −$184,500.00 en rojo**,
  y cuatro pantallas con pérdida total. No es una pantalla vacía: es una pantalla
  que **afirma una pérdida que no ocurrió**. Si se abre en abril–junio, la misma
  pantalla dice ingreso $648,000.00 y margen 23.9 % — que es el negocio de verdad.
- **Opciones:**
  - **a) Abrir en el último trimestre cerrado.** Se ve el negocio completo desde el
    primer segundo. Coste: quien quiera ver el trimestre en curso cambia una fecha.
  - **b) Dejar el trimestre en curso.** Coste: en el 100 % de los casos en que el
    trimestre va empezado, el reporte abre exagerando la pérdida, porque el costo
    del espacio corre todo el trimestre y las ventas aún no están todas dentro. Es
    el problema todos los trimestres, no solo en la demo.
  - **c) Abrir en los últimos doce meses.** Se ve la tendencia. Coste: es más lento
    y mezcla trimestres cerrados con el que va a medias.
- **Recomendación:** **(a), el último trimestre cerrado.** Un reporte de
  rentabilidad contesta «cómo nos fue», y eso solo tiene respuesta sobre un periodo
  terminado. Y quita el único caso en que la pantalla dice algo falso sin que nada
  falle.
- **Si nadie contesta:** se queda en el trimestre en curso, y el 14 de octubre la
  pantalla nueva abre en rojo con una pérdida inventada delante de los clientes.
  **No es aceptable.**
- **Caduca:** **2026-10-07.** Es un renglón, pero tiene que estar probado y
  desplegado antes del SUMMIT.

---

### ~~D4 · Una pantalla de dos caras de 3 × 6 metros: ¿son 18 metros cuadrados o 36?~~

> ✅ **CONTESTADA por el dueño. 2026-09-18.** Eligió la **(b), todas las caras**.
> **Con qué se midió:** `MULTIPLICAR_M2_POR_CARAS = true` (`lib/data/reportes.ts:1227`),
> `CONVENCION_M2 = 'todas-las-caras'` (`:1229`), aplicado en `superficieM2()` (`:1236`).
> Y verificado en el navegador el 18/09 con dos pantallas que existen a propósito
> para esto: **«Doble Cara DEMO Insurgentes» = 80.00 m²** y **«Una Cara DEMO
> Insurgentes» = 40.00 m²**, el doble exacto. La pantalla **declara la convención**,
> que era la condición que yo ponía en «si nadie contesta»: «La superficie suma
> TODAS las caras de cada pantalla: una de dos caras de 3 × 6 cuenta 36 m², no 18».
> Y dice cuántas dejó fuera: «Quedaron fuera del ranking: 2 estáticas sin ancho o
> sin alto capturados».
>
> ⚠️ **La bitácora todavía dice lo contrario más arriba de donde lo corrige** — ver
> **B25**.



- **Bloquea:** la columna de metros cuadrados del reporte, que está a medio hacer, y
  cualquier cifra por metro cuadrado que se presente como definitiva. El resto del
  reporte no depende de esto.
- **Por qué importa:** cambia el orden completo del ranking, que es la única cosa
  que el reporte por metro cuadrado sirve para contestar. Con dos caras contadas,
  las pantallas de doble cara caen a la mitad de rendimiento por metro; con una,
  se quedan arriba. Hoy está puesto **una cara** —la superficie del soporte— y se
  cambia en un renglón.
- **Opciones:**
  - **a) Una cara: el metro cuadrado es la superficie del soporte.** Es lo que está
    hoy. No inventa superficie que no existe físicamente. Coste: una pantalla de
    doble cara parece el doble de rentable por metro que una de una cara idéntica.
  - **b) Todas las caras: el metro cuadrado es la superficie que se vende.** Refleja
    lo que el cliente compra. Coste: dos pantallas con la misma huella en el suelo
    salen con superficies distintas, y eso confunde a quien compara sitios.
- **Recomendación:** **(b), todas las caras**, si la pregunta que el dueño quiere
  contestar es «qué metro cuadrado de inventario me rinde más», porque el metro que
  produce dinero es el que se vende. Pero es una decisión de negocio y la respuesta
  correcta depende de con qué se vaya a conciliar. Recomendar no es decidir.
- **Si nadie contesta:** se queda en una cara. Es defendible y está declarado en la
  respuesta del reporte, así que **es aceptable** — con una condición: que la
  pantalla **diga** qué convención usó, que hoy no lo dice (ver B4).
- **Caduca:** **2026-10-07.** Después la cifra sale al SUMMIT como esté.

---

### ~~D5 · Las cinco etiquetas de para qué sirve cada razón social («paga las rentas», «vende publicidad»…): ¿se quedan fijas para todos, o cada dueño define las suyas?~~

> ✅ **CONTESTADA por el dueño. 2026-09-18.** Eligió la **(a), las cinco fijas** —no
> la (c) que yo recomendaba—, y **siguen viviendo en una tabla, no en el código**,
> que es lo que deja abierta la (c) para después sin rehacer nada.
> **Con qué se midió:** `catalogo_roles_entidad` con los cinco `insert … on conflict
> do nothing` (`db/migrations/20260917_entidades_fiscales.sql:62,76-82`), y
> `entidad_roles.rol` los referencia por clave ajena (`:117`). Las cinco etiquetas,
> tal como se leen en pantalla el 18/09: «Paga las rentas a los arrendadores» ·
> «Compra los activos y el equipo» · «Tramites y licencias con gobierno» ·
> «Operacion y nomina» · «Vende publicidad».
>
> **Consecuencia que conviene que sepa quien enseñe el producto**, y que era mi
> condición de aceptabilidad: un cliente que pida una sexta etiqueta o un nombre
> distinto **espera un despliegue**. La tabla hace que ese despliegue sea una
> migración de una línea, no un cambio de código.



- **Bloquea:** el diseño de la pantalla de razones sociales (la de D2). Una lista
  fija es un menú de cinco opciones; una lista propia de cada dueño necesita además
  una pantalla para crearlas y editarlas, y hay que decidir qué pasa con las que ya
  se usaron. No bloquea nada más.
- **Por qué importa:** hoy las cinco están fijas y **son las mismas para toda la
  flota**: un dueño no puede añadir la sexta ni renombrar ninguna sin que se toque
  el código y salga una versión nueva. Si un cliente del SUMMIT pide «yo lo que
  tengo es una sociedad patrimonial», hoy la respuesta es que espere a un
  despliegue.
- **Opciones:**
  - **a) Se quedan fijas las cinco.** Sin trabajo adicional, y el vocabulario es el
    mismo en toda la flota, lo que hace que los reportes se puedan comparar entre
    clientes. Coste: cada cliente que pida una etiqueta distinta es un despliegue.
  - **b) Cada dueño define las suyas.** Se adapta a cualquier cliente. Coste: una
    pantalla más, y los reportes dejan de ser comparables entre clientes.
  - **c) Las cinco fijas, más la posibilidad de renombrarlas.** El dueño ve sus
    palabras; por dentro siguen siendo las mismas cinco. Coste: pequeño, y resuelve
    el caso común, que es de vocabulario y no de estructura.
- **Recomendación:** **(c).** En la práctica lo que cambia entre clientes es cómo
  lo llaman, no qué hacen; y deja la comparación entre clientes intacta.
- **Si nadie contesta:** se quedan las cinco fijas y sin renombrar. **Es aceptable**
  para el 14 de octubre, siempre que quien enseñe el producto sepa que es así y no
  prometa lo contrario.
- **Caduca:** **2026-09-30**, la misma fecha que D2, porque es parte de esa pantalla.

---

### D6 · El reporte no limita cuántos meses se le pueden pedir de una vez. ¿Se le pone un tope?

- **Bloquea:** nada. Es un riesgo de producción, no un trabajo detenido.
- **Por qué importa:** el reporte construye una casilla por pantalla y por periodo.
  Con 12 pantallas y un año son 144 casillas y no se nota; con un inventario de 500
  pantallas y cinco años de historia son 30 000, y quien lo pida se queda mirando
  una pantalla cargando. El sistema lo permite y no avisa. Hoy no se puede llegar
  ahí —la base de demostración tiene cuatro pantallas— así que **no es un problema
  del 14 de octubre**: es un problema del primer cliente grande.
- **Opciones:**
  - **a) Tope de 36 meses, y un mensaje claro si se pide más.** Barato y se nota
    poco: nadie compara más de tres años en una tabla.
  - **b) Sin tope, y se resuelve el día que duela.** Coste: el día que duela será
    con un cliente delante.
  - **c) Sin tope, pero avisando en la pantalla cuando el rango es muy grande.** El
    dueño decide; el sistema no se lo prohíbe.
- **Recomendación:** **(a), 36 meses.** Es el único de los tres que no depende de
  que alguien esté mirando cuando pase.
- **Si nadie contesta:** se queda sin tope. **Es aceptable hasta el SUMMIT** y deja
  de serlo con el primer cliente de inventario grande.
- **Caduca:** no caduca antes del 14/10. Revisar antes de dar de alta la primera
  instancia de un cliente con inventario grande.

---

### D7 · El manual de usuario está escrito pero sin ilustrar, y le faltan cinco frases que solo se ven provocando un error. ¿Se termina antes del 14 de octubre, o se enseña el producto sin manual?

- **Bloquea:** nada del producto. Bloquea **poder dejarle algo en la mano** a quien
  vea la demostración. Todo lo de la lista B avanza sin esta respuesta.
- **Por qué importa:** el manual ya cubre las tres áreas nuevas y **ocho de sus
  catorce huecos se cerraron mirando la aplicación**, con el texto tal como sale en
  pantalla. Quedan cinco frases que hay que provocar —qué dice el sistema cuando una
  empresa no tiene ninguna razón social, cuando un papel no tiene dueño, cuando se
  borra un recibo de luz— y, aparte, **no tiene una sola captura de pantalla**.
  Terminarlo es media jornada de alguien recorriendo la aplicación a propósito; no
  es trabajo de programar.
- **Opciones:**
  - **a) Se termina completo, con capturas.** Es lo que se le puede entregar a un
    cliente el mismo día. Coste: media jornada de una persona recorriendo la
    aplicación, y hay que hacerlo **después** de que no vaya a cambiar nada más de
    pantalla, o las capturas nacen viejas.
  - **b) Se cierran solo las cinco frases, sin capturas.** Queda un manual correcto
    y utilizable, en texto. Coste: menos presentable, y el que lo lea sin el producto
    delante se pierde.
  - **c) No entra al 14 de octubre.** Coste: se enseña el producto y no hay nada que
    dejar; quien se interese se va con la memoria.
- **Recomendación:** **(b) ahora y (a) la semana del 6 de octubre**, cuando ya no se
  esperen cambios de pantalla. Hacer las capturas antes es tirarlas. Recomendar no es
  decidir.
- **Si nadie contesta:** se queda como está —completo en lo que se pudo comprobar, con
  cinco huecos marcados como preguntas— y sin capturas. **Es aceptable** si nadie
  espera repartir un manual el día del SUMMIT; no lo es si alguien lo da por hecho.
- **Caduca:** **2026-10-06.** Después no hay hueco para recorrer la aplicación y
  maquetar antes de la fecha.

---

### D8 · Tres de los cinco papeles se pintan SIN ACENTO en la primera pantalla de la demo. ¿Se corrigen con una migración nueva antes del 14/10?

- **Encontrada:** 2026-09-18, recorriendo el guion del Summit en el navegador. No la
  vio ninguna prueba: son datos, no código.
- **Qué es:** el cuestionario de bienvenida —**la primera pantalla que ve un cliente
  nuevo, y un paso del guion**— lista los cinco papeles así:

  | En pantalla | Como debería |
  |---|---|
  | Paga las rentas a los arrendadores | ✅ correcto |
  | Compra los activos y el equipo | ✅ correcto |
  | **Tramites** y licencias con gobierno | Trámites |
  | **Operacion y nomina** | Operación y nómina |
  | Vende publicidad | ✅ correcto |

  Y el contraste es lo que lo hace visible: la prosa **alrededor** sí lleva acentos
  («Sí», «más tarde», «operación»), así que no parece una convención: parece un
  descuido.
- **Por qué es una decisión tuya y no un arreglo:** las etiquetas están **sembradas
  en una migración YA APLICADA** —`db/migrations/20260917_entidades_fiscales.sql:78-80`—
  y la regla del repositorio prohíbe editar una migración aplicada. Corregirlo exige
  **una migración nueva** que actualice esas tres filas, y toda migración es **ROJO**:
  para y pide aprobación humana. No es difícil; es que no me corresponde.
- **Opciones:**
  - **a) Migración nueva** que haga `update` de las tres etiquetas. Coste: una
    migración más en la cuenta, y hay que correrla en cada base antes del 14/10
    —incluida la de la demostración— o la pantalla sigue igual donde se presenta.
  - **b) No se toca.** Coste: tres palabras sin acento en la primera pantalla, delante
    de una sala mexicana. Nadie se va por eso, pero es lo primero que se lee.
- **Recomendación:** **(a)**, y pronto, porque el coste real no es escribir la
  migración: es **acordarse de correrla en la base desde la que presentes**. Cuanto
  más tarde, más fácil olvidarlo. Recomendar no es decidir.
- **Si nadie contesta:** se queda (b). No rompe nada.
- **Caduca:** **el día que decidas desde dónde presentas.** Si es una instancia
  servida, la migración tiene que haber llegado antes; si es el portátil, basta con
  correrla aquí.

---

## B · Advertencias por estabilizar

Separadas en dos grupos, porque **mezclarlas es cómo se pierde la importante**: una
cosa es un fallo silencioso o un dato que miente, y otra es algo que solo aprieta por
calendario.

### B · i — Críticas por SEVERIDAD (fallo silencioso · dato que miente)

#### ~~B1 · La pantalla de reportes abre afirmando una pérdida de $184,500 que no ocurrió~~

> ✅ **CERRADA el 2026-09-18, y NO como yo lo proponía.** No se cambió el rango: el
> dueño decidió mantenerlo (D3) y se añadió el aviso en ámbar. Ya no «afirma una
> pérdida», la **enmarca**.
> **Con qué se midió:** los dos estados vistos en el navegador contra `spaces_ver2`
> en el 3409 — con el ámbar en jul–sep 2026 y sin él en abr–jun 2026, donde la misma
> pantalla da `Ingreso $462,000.00 · Margen 22.4 %`. La cifra de la pérdida de
> apertura, por cierto, **ya no es 184 500 sino 238 500**: la semilla creció, y eso
> confirma que el número era del dato y no del código.
> **Residuo declarado, no bloqueante:** las cuatro cifras grandes del encabezado no
> llevan el matiz dentro (detalle en D3).

- **Qué es:** el reporte abre en el trimestre en curso, donde el costo del espacio ya
  corrió pero las ventas todavía no están dentro. No es una pantalla vacía —eso se
  entendería— es una tabla con cifras que afirma una pérdida total.
- **Evidencia (medida hoy, en el navegador, contra `spaces_ver2` en el 3399):**
  abre en `2026-07-01 → 2026-09-30` y pinta `Ingreso $0.00 · Costo total
  $184,500.00 · Margen ($184,500.00)` con cuatro pantallas en pérdida. El rango
  por omisión sale de `components/demo/reportes/consulta.ts:154-163`
  (`rangoDelTrimestreDe`, que calcula el trimestre EN CURSO) llamada desde
  `app/(app)/(shell)/reportes/page.tsx:65` con `new Date()`. Y la semilla siembra
  **solo trimestres ya cerrados** (`scripts/semilla-demo.mjs:115,123`,
  `trimestresCerrados`), lo que se confirma en la base:
  ```
  $ docker exec spaces_db psql -U spaces -d spaces_ver2 -c "select to_char(fecha_inicio,'YYYY\"Q\"Q'), count(*) from reservas group by 1 order by 1;"
   2025Q3 | 6     2026Q1 | 6
   2025Q4 | 6     2026Q2 | 6
  ```
  El mismo rango 2026-01-01 → 2026-06-30 da `Ingreso $648,000.00 · Margen 23.9 %`.
- **Cómo se cierra:** contestando **D3** y cambiando el renglón. La vuelta atrás es
  el mismo renglón.
- **Quién puede cerrarla:** el dueño decide (D3); cualquier ejecutor lo aplica.
- **Si no se cierra antes del 14/10:** la pantalla nueva —la que se construyó para
  el SUMMIT— abre en rojo con una pérdida inventada delante de los clientes.

#### ~~B2 · La base `spaces` del 5433 bloquea toda migración~~ — **el diagnóstico se confirmó, el arreglo se aplicó a medias, y el problema CRECIÓ. Sigue en B23**

> ⚠️ **2026-09-18, tarde.** El paso (2) está hecho y es correcto: `.gitattributes`
> congela `db/migrations/*.sql` a LF (`git check-attr text eol -- …` →
> `text: set · eol: lf`, y los `.sql` en disco están **sin un solo CRLF**, medido).
> El paso (1) —la reconciliación del registro— **no se ha corrido**, y sin él el
> arreglo del (2) **invirtió qué bases están rotas**. Los números nuevos están en
> **B23**, que es donde sigue viva esta advertencia.

- **Qué es:** el runner de migraciones aborta contra `spaces` con cinco checksums
  divergentes. Frenó a dos agentes. **No es una divergencia de contenido:** el SQL
  es idéntico byte a byte salvo los finales de línea.
- **Evidencia:** el runner sale con **código 3** y «NO se aplico nada»:
  ```
  $ DATABASE_URL=postgresql://spaces:spaces@localhost:5433/spaces node scripts/migrar.mjs --pendientes
  ERROR migrar: una migracion YA APLICADA tiene otro contenido en disco.
    · 20260812_schema_migrations.sql · 20260812_sin_default_tenant.sql
    · 20260819_semilla_rol_permisos.sql · 20260820_catalogo_permisos_completo.sql
    · 20260820_grants_rol_app.sql
  exit=3
  ```
  Y la causa, medida comparando las tres huellas de cada archivo: **para los cinco,
  el checksum REGISTRADO en la base coincide exactamente con el del archivo en
  LF, y el de disco con el del archivo en CRLF.** Ejemplo:
  ```
  20260812_sin_default_tenant.sql
    disco     = 41dc9529…  (= CRLF)
    solo-LF   = 3c366a9e…  (= el REGISTRADO en la base)
  ```
  El mecanismo está a la vista: `scripts/migrar.mjs:179-181` hace sha256 «del
  contenido tal cual está en disco», y `.gitattributes:26` congela a LF
  **solo `scripts/*.mjs`** — `db/migrations/*.sql` queda sin política:
  ```
  $ git check-attr text eol -- db/migrations/20260812_sin_default_tenant.sql
  text: unspecified    eol: unspecified
  ```
  Consecuencia general, y es lo que nadie había medido: **el checksum de una
  migración depende de en qué máquina se hizo el checkout.** El mismo archivo
  aplicado desde el contenedor (LF) y leído desde Windows (CRLF) no coincide nunca.
  `.gitattributes:1-3` ya dice que la política del repositorio «sigue abierta».
  **`spaces_ver2` está limpia** (81 aplicadas, 1 de datos pendiente), así que el
  problema está confinado a `spaces`.
- **Cómo se cierra:** dos pasos independientes. (1) Desatascar `spaces`: los cinco
  `--forzar-checksum`, que es seguro **porque el contenido es provablemente el
  mismo**, o recrear la base — `CLAUDE.md` §4 dice que la del 5433 es de pruebas y
  se reinicia sin preguntar. (2) Que no vuelva a pasar: añadir `*.sql text eol=lf`
  a `.gitattributes`, igual que se hizo con `scripts/*.mjs`.
- **Quién puede cerrarla:** cualquier ejecutor. **No es una decisión del dueño** —
  estaba en la lista como si lo fuera y no lo es.
- **Si no se cierra antes del 14/10:** ninguna migración se puede ensayar en
  desarrollo, que es precisamente lo que hace falta para D1 (la tabla del consumo
  de luz).

#### ~~B3 · Una fila puede colgarse de la razón social de OTRA organización, y la base lo permite~~

> ✅ **CERRADA el 2026-09-18 en el esquema, que era la opción buena de las dos.**
> `0d85521`, con su rojo previo en `e9605c9` («el rojo del insert cruzado que las FK
> planas dejaban pasar»).
> **Con qué se midió — leído de la base, no del archivo.** En `spaces_ver2`:
> ```
> select conname, pg_get_constraintdef(oid) from pg_constraint
>  where confrelid='entidades_fiscales'::regclass and contype='f';
>
> entidad_roles_entidad_tenant_fkey            FOREIGN KEY (entidad_id, tenant_id)
>   REFERENCES entidades_fiscales(id, tenant_id) ON DELETE CASCADE
> contratos_arrendamiento_entidad_tenant_fkey  FOREIGN KEY (entidad_id, tenant_id)
>   REFERENCES entidades_fiscales(id, tenant_id) ON DELETE SET NULL (entidad_id)
> facturas_entidad_emisora_tenant_fkey         FOREIGN KEY (entidad_emisora_id, tenant_id)
>   REFERENCES entidades_fiscales(id, tenant_id) ON DELETE SET NULL (entidad_emisora_id)
> ```
> Las **tres** llevan la pareja; ninguna queda plana. Y la migración no se cree a sí
> misma: su §6 es un `assert` **dentro de la transacción** que revienta si alguna
> sigue con una sola columna (`20260918_entidad_tenant_compuesto.sql`), así que un
> arreglo a medias revierte en vez de dejar la base afirmando que el agujero está
> cerrado. Los dos detalles que podían romper comportamiento están resueltos y
> escritos: `MATCH SIMPLE` deja entrar «sin asignar», y `on delete set null
> (entidad_id)` con lista de columnas explícita evita anular el `tenant_id`.
> **Y no toca ni un importe:** `subtotal`, `igv` y `monto` no aparecen en el archivo.

- **Qué es:** las tres claves que apuntan a `entidades_fiscales` no llevan el
  componente de organización, y en Postgres **la comprobación de una clave ajena no
  pasa por la RLS**. El modo de fallo es el de R2: no da ningún error.
- **Evidencia:** ejecutado contra `spaces_ver2` con el rol `spaces_app` (no
  superusuario) **dentro de una transacción que se deshizo al terminar**:
  ```
  -- con app.tenant_id = B
  select razon_social from entidades_fiscales;      → solo 'ENTIDAD DE B'   (la RLS lee bien)
  insert into entidad_roles (entidad_id, rol, tenant_id)
    values (<id de la entidad de A>, 'VENTAS', <B>);  → INSERT 0 1          ← PASA
  select ... from entidad_roles;                    → la fila existe, visible para B
  ROLLBACK
  ```
  Las tres claves son planas y no hay con qué componerlas:
  ```
  entidad_roles_entidad_id_fkey            → REFERENCES entidades_fiscales(id) ON DELETE CASCADE
  contratos_arrendamiento_entidad_id_fkey  → REFERENCES entidades_fiscales(id) ON DELETE SET NULL
  facturas_entidad_emisora_id_fkey         → REFERENCES entidades_fiscales(id) ON DELETE SET NULL
  entidades_fiscales: PRIMARY KEY (id)     ← y ningún unique (id, tenant_id)
  ```
- **Atenuante medido, y es importante:** **hoy no se alcanza desde la aplicación.**
  Los dos caminos de escritura comprueban la pertenencia antes de escribir roles —
  `entidades-repo.ts:228` devuelve `null` (→404) si el `where id = $ and tenant_id = $`
  no encontró la entidad, y solo después escribe (`:236-237`). Se vuelve alcanzable
  el día que alguien cablee el selector de D2 sin repetir esa comprobación a mano.
- **Cómo se cierra:** `unique (id, tenant_id)` en `entidades_fiscales` y las tres
  claves ajenas compuestas, **o** —si eso se considera caro— una prueba negativa
  que falle si algún día se escribe la fila cruzada. Lo que **no** sirve es dejarlo
  a la disciplina: la nota ya declara que «`entidad_id` no es frontera de
  seguridad» y aun así el hueco es invisible.
- **Quién puede cerrarla:** un ejecutor, con aprobación humana: toca migración y
  aislamiento, o sea **ROJO** por las zonas de riesgo.
- **Si no se cierra antes del 14/10:** hoy no pasa nada. El riesgo entra con el
  trabajo de D2, y entonces será un fallo de aislamiento entre clientes que no da
  error.

#### ~~B4 · Tres de las cuatro dimensiones dicen «(en preparación)» y las tres funcionan; y la tabla no enseña ninguna columna de su dimensión~~

> ✅ **CERRADA el 2026-09-18, las dos mitades, y lo que la cierra es un navegador.**
> **Con qué se midió — leído del selector en la aplicación el 18/09:** «Por
> pantalla» · «Por trimestre» · «Por operación» · «Por metro cuadrado» · «Por
> consumo de luz». **Ninguna dice «(en preparación)»**, y son cinco, no cuatro.
> Y las columnas ya son propias de cada dimensión, columna por columna:
> - **por metro cuadrado** → `SUPERFICIE` · `INGRESO / M²` · `MARGEN / M²`, con la
>   convención declarada encima y las excluidas contadas;
> - **por operación** → `VISITAS` · `OPERACIÓN / INGRESO` · `HORAS EN SITIO` («36.0 h
>   de 9 visitas»), con el desglose por tipo de visita en el subtítulo de cada
>   renglón — las tres cosas que `Registro_Cambios.md` prometía y no se veían;
> - **por consumo de luz** → `CONSUMO` (kWh) · `COSTO / KWH`;
> - **por trimestre** → la primera columna se llama **`TRIMESTRE`** y el renglón dice
>   «T2 2026 · 2026-04-01 a 2026-06-30». Era el síntoma más feo del `Pick` de
>   `tabla.ts`: trimestres bajo un encabezado que decía PANTALLA.
>
> Y «por operación» y «por pantalla» **ya no devuelven tablas idénticas**: para
> abr–jun 2026 la primera trae cuatro columnas que la segunda no tiene.
> **La duda que dejé declarada queda resuelta con la medición:** sí estaba
> resolviéndose en `ola3/reportes-columnas`, y aterrizó en `cb6ffc2`.

- **Qué es:** dos defectos del mismo sitio, los dos visibles solo en un navegador.
  (1) el selector etiqueta como no disponibles tres dimensiones que calculan
  perfectamente; (2) al elegirlas, la tabla enseña **las mismas seis columnas** que
  «por pantalla», así que lo propio de cada dimensión no se ve en ninguna parte.
- **Evidencia:** leído del selector en el navegador —
  `option "Por trimestre (en preparación)"`, `"Por operación (en preparación)"`,
  `"Por metro cuadrado (en preparación)"` — mientras «por metro cuadrado» devuelve
  `Ingreso $576,000.00 · Costo $430,700.00 · Margen $145,300.00 · 25.2 %`. El
  origen es `components/demo/reportes/consulta.ts:60,66,72` (`conMotor: false`)
  pintado en `components/demo/reportes/FiltrosRentabilidad.tsx:53`, y ya no hay
  ningún 501 en el servidor: `lib/server/reportes-controller.ts:114-119` es un
  `Record` exhaustivo con los cuatro motores, y su propio comentario (`:38`) dice
  que «el 501 desapareció».
  Y las columnas: el motor **sí** calcula lo propio de cada dimensión —
  `visitasPorTipo`, `costoOperacionPct`, `horasEnSitio`, `visitasConDuracion`
  (`lib/data/reportes.ts:962-969`), `m2`, `ingresoPorM2`, `margenPorM2` (`:133-134`),
  `excluidas` y `convencionM2` (`:167,170`) — y **ninguno de esos nombres aparece
  en `components/demo/reportes/tabla.ts`, `TablaRentabilidad.tsx` ni
  `reportes/page.tsx`**. La causa es estructural, no un olvido: `tabla.ts:15-18`
  es un `Pick` que excluye esos campos y `tabla.ts:31-41` es una lista única de
  siete columnas con la primera etiquetada `'Pantalla'` a mano — por eso «por
  trimestre» enseña trimestres bajo una columna que dice PANTALLA. Medido: «por
  operación» y «por pantalla» devuelven, para el mismo rango, **tablas idénticas
  fila por fila y cifra por cifra**.
  Lo que lo convierte en dato que miente: `docs/Registro_Cambios.md:32-38` —el
  documento escrito para quien no programa— promete «por operación … **con cuántas
  visitas, de qué tipo y cuántas horas reales**». Ninguna de las tres se ve.
- **Cómo se cierra:** poner `conMotor: true` en los tres, y dar a la tabla columnas
  por dimensión. Lo segundo es el trabajo de verdad.
- **Quién puede cerrarla:** **Z10 · UI base está TOMADA por `reportes-columnas` en
  la rama `ola3/reportes-columnas`** (`vault/07-Agentes/tablero.md`), y el nombre
  dice que va exactamente de esto. **No pude mirar esa rama** —la instrucción de la
  corrida era no entrar a ese worktree— así que **no verificado** si ya está
  resuelto allí. Lo que afirmo es lo que mide este árbol.
- **Si no se cierra antes del 14/10:** se enseña un producto que declara no estar
  listo justo donde sí lo está, y tres de las cinco vistas que pidió el jefe se ven
  idénticas entre sí.

#### ~~B5 · `CLAUDE.md` arrastra otra vez las seis cifras — **SE CORRIGIÓ Y VOLVIÓ A CADUCAR EN LA MISMA RAMA. Tercera vez. Sigue ABIERTA, y ahora el MOC también**~~

> ✅ **CERRADA el 2026-09-18, al terminar el ensayo del guion — y con la
> herramienta, no a mano.** Las siete cifras de `CLAUDE.md` §2 coinciden hoy con
> `node scripts/recuentos.mjs` medido en este árbol: **98 endpoints · 44 tablas ·
> 84 migraciones · 35 ADR · 84 notas · 1093 enlaces · 2 rotos · 0 huérfanas**.
>
> Y el cierre incluye lo que la advertencia pedía de verdad: **la nota huérfana
> desapareció**. Era `diario/2026-09-17`, y se arregló encadenándola desde el
> diario del 18/09, que es como se enlazan los diarios entre sí. Los 2 rotos que
> quedan apuntan a ADR, que viven en `docs/`: choque de convención, no enlace
> muerto.
>
> **Lo que NO cierra esta advertencia, y conviene decirlo:** que vuelvan a
> caducar. Seguirá pasando cada vez que se añada un `route.ts` o una migración.
> Lo único que lo hace barato es que medirlas cuesta un comando, y ése ya existe.

> 🔴 **Remedido el 2026-09-18, tarde. Esto es lo más instructivo de todo el
> expediente y por eso no se tacha.** `cc5f6a1` corrigió las seis, y las dejó
> **exactas en ese commit** — comprobado: en `cc5f6a1` el árbol tenía 96 endpoints,
> 82 migraciones y 79 notas, justo lo que el archivo dice. Lo que pasó después es
> que **la misma rama siguió**: `f0db34b`, `0d85521`, `a4639dc` y `8c6002e` añadieron
> cuatro `route.ts` y dos migraciones, y `38c44fb` cuatro notas. Nadie volvió a
> medir, y la rama tocó `CLAUDE.md` **dos veces más** (`447b01d`, `726fc48`) sin
> hacerlo.
>
> **Y esta vez el MOC no salva:** `MOC-Proyecto.md:30-32` arrastra las mismas tres.
> La corrección del 18/09 de la mañana fue «copiar del MOC»; hoy no hay de dónde
> copiar, hay que medir.
>
> | Afirma | Dónde | Dice | **Medido en HEAD (`b9b0a31`)** | Con qué |
> |---|---|---|---|---|
> | Endpoints | `CLAUDE.md:100` · `MOC:30` | 96 | **98** | `find apps/web/app/api -name route.ts \| wc -l` |
> | Tablas | `CLAUDE.md:101` · `MOC:31` | 43 | **44** | `select count(*) … information_schema.tables` en `spaces_ver2`; lo confirma el guard `esquema-sin-owner.e2e.test.ts:163` |
> | Migraciones | `CLAUDE.md:102` · `MOC:32` | 82 | **84** | `ls db/migrations/*.sql \| wc -l` |
> | Notas de bóveda | `CLAUDE.md:36,42` | 79 | **83** | `find vault -name '*.md' \| wc -l` |
> | Enlaces internos | `CLAUDE.md:42` | «~1000» | **1087** | recorrido de wikilinks sobre las 83 notas |
> | Huérfanas | `CLAUDE.md:42` | 2 | **1** (`diario/2026-09-17.md`) | el mismo recorrido |
> | ADR | `CLAUDE.md:25` · `MOC:33` | 0035 / 35 | **0035 / 35** ✅ | `ls docs/adr/*.md \| wc -l` |
>
> Los rotos **sí** siguen siendo 2, y son los dos de `diario/2026-09-07.md` que ya
> estaban en B14: apuntan a `docs/adr/` desde dentro de `vault/`.
>
> **Lo que esto enseña, y es más valioso que las seis cifras:** el problema no es que
> nadie las actualice, es que **se actualizan a mano en medio de una rama que sigue
> creciendo**. Cualquier corrección manual caduca en el commit siguiente. Mientras no
> haya un chequeo que las mida, este apartado va a volver — van tres.

- **Qué era (18/09, mañana):** lo primero que lee un agente al abrir el repositorio
  empieza con seis números falsos. El MOC ya está corregido; este no.
- **Evidencia de entonces (medida contra lo que afirmaba el archivo):**

  | Afirma | Dónde | Dice | Medido |
  |---|---|---|---|
  | Endpoints | `CLAUDE.md:91` | 90 | **96** (`find apps/web/app/api -name route.ts \| wc -l`) |
  | Tablas | `CLAUDE.md:92` | 42 | **43** (y lo confirma el guard `esquema-sin-owner.e2e.test.ts:145`) |
  | Migraciones | `CLAUDE.md:93` | 76 | **82** (`ls db/migrations/*.sql \| wc -l`) |
  | ADR | `CLAUDE.md:25` | «van por la 0032» | **0033**, 33 archivos |
  | Notas de bóveda | `CLAUDE.md:36,43` | 57 | **79** |
  | Enlaces internos | `CLAUDE.md:42` | 753, **0 rotos, 0 huérfanas** | **1046**, **2 rotos, 3 huérfanas** |

  `vault/00-Indice/MOC-Proyecto.md:30-33` tiene las cuatro primeras **correctas**,
  así que la corrección es copiar de ahí, no volver a medir.
- **Cómo se cierra:** actualizar las seis y añadir el aviso que falta (ver B6).
- **Quién puede cerrarla:** cualquiera; `CLAUDE.md` es archivo de alto contacto y se
  reclama por separado. **El supervisor no lo toca**: solo escribe en
  `docs/Supervision/`.
- **Si no se cierra antes del 14/10:** cada agente que entre arranca con seis datos
  falsos. Es el sitio del repositorio donde un número equivocado cuesta más.

#### ~~B6 · La trampa que costó un diagnóstico hoy está escrita en un solo sitio, y es el único que casi nadie lee~~

> ✅ **CERRADA el 2026-09-18** por `cc5f6a1`, y exactamente donde pedía: pegada al
> aviso de las e2e.
> **Con qué se midió:** `CLAUDE.md:252-267` trae el recuadro
> «reconstruir `.next` con un `next start` YA CORRIENDO deja la página EN BLANCO»,
> con el diagnóstico por `BUILD_ID` y —lo que más falta hacía— **«al reiniciar, mata
> al dueño del puerto, no al envoltorio de `npx`»** (`:267`). Usado hoy: el servidor
> del 3409 se apagó por su PID (`netstat -ano` → 6376 → `taskkill`), no por el
> envoltorio.

- **Qué es:** reconstruir `.next` con un `next start` ya corriendo deja la página
  **en blanco sin ningún error** — el navegador pide trozos de un build que ya no
  existe.
- **Evidencia:** está documentada en **`.claude/agents/supervisor.md:117-120`** y en
  ningún otro sitio del repositorio:
  ```
  $ grep -rlin "next start ya corriendo|servidor vivo|pide chunks|chunks de un build" vault/ docs/ .claude/
  .claude/agents/supervisor.md
  ```
  `CLAUDE.md` menciona `BUILD_ID` una sola vez (`:229`) y es para la **otra**
  trampa: que las e2e exigen un build previo. Las dos son de la misma familia y
  deberían estar juntas.
- **Cómo se cierra:** un párrafo en el aviso de `CLAUDE.md:222-236`, pegado al de
  las e2e.
- **Quién puede cerrarla:** cualquiera, junto con B5.
- **Si no se cierra antes del 14/10:** el próximo que levante la app para mirarla
  —que a 26 días del SUMMIT van a ser varios— pierde el mismo rato otra vez, y el
  síntoma no dice nada del código.

### B · ii — Críticas por CALENDARIO (no hay fallo silencioso; aprieta la fecha)

#### ~~B23 · 🟠 **El arreglo de los checksums funcionó, y por eso la base de demostración del SUMMIT dejó de aceptar migraciones.** Pasó de 0 divergencias a 80~~

> ✅ **CERRADA el 2026-09-18. Medido en las DOS bases, que era el punto.**
> `node scripts/migrar.mjs --pendientes` devuelve **salida 0** contra
> `spaces_ver2` y contra `spaces`: **83 aplicadas, 0 pendientes de esquema** en
> las dos. La única pendiente es `20260731_calendario_meses_cortos.sql`, que es
> `[datos]` y **está excluida a propósito** — entra solo con `--con-datos`.
>
> La reconciliación se hizo con `infra/scripts/reconciliar-checksums-migraciones.ps1`:
> **80 divergencias en `spaces_ver2` y 65 en `spaces`, 0 inexplicables**, y los
> datos intactos. Y el propio guion se corrigió en el camino: llamaba al runner
> una vez por archivo, y así **aborta siempre en el primero**, porque la
> comprobación de integridad corre antes de perdonar nada. Ahora pasa todas las
> banderas en una sola invocación.

- **Qué es:** el paso (2) de B2 —congelar `db/migrations/*.sql` a LF— es correcto y
  está aplicado. Pero el paso (1), la reconciliación del registro, **no se ha
  corrido**, y sin él el arreglo **invirtió qué bases están rotas**: el registro de
  las bases con historia guarda el checksum del archivo *tal como estaba cuando se
  aplicó*, y ahora el archivo en disco es otro. El registro quedó **mezclado**: unas
  filas se escribieron desde un árbol CRLF y otras desde un árbol LF, así que ninguna
  normalización sola arregla las dos.
- **Evidencia (medida el 2026-09-18, tarde, en solo lectura — `--pendientes` no
  aplica nada):**

  | Base | Divergencias el 18/09 **mañana** | **Ahora** | Salida |
  |---|---|---|---|
  | `spaces` | 5 | **65** | `exit=3` · «NO se aplico nada» |
  | **`spaces_ver2`** (la de la demo) | **0 — limpia** | **80** de 82 aplicadas | `exit=3` · «NO se aplico nada» |
  | `spaces_e2e` | 0 | **0** ✅ | `exit=0` |

  Y la causa, medida archivo por archivo con sha256 de las tres variantes:
  ```
  20260625_agencia_en_propuesta.sql   CRLF:0  LF-solo:14
     disco = c6b05328 (= LF)   registrado en spaces = e8f87671 (= CRLF)  -> DIVERGE
  20260812_sin_default_tenant.sql     CRLF:0  LF-solo:77
     disco = 3c366a9e (= LF)   registrado en spaces = 3c366a9e (= LF)    -> YA CUADRA
  ```
  O sea: **las cinco originales se curaron solas** con `.gitattributes`, y las 65
  que cuadraban se rompieron. Es el mismo defecto, con el signo cambiado.
- **Por qué `spaces_e2e` está limpia y por qué eso es una trampa:** el arnés hace
  `drop schema public cascade` y reaplica de cero en cada corrida, así que su
  registro se escribe **siempre desde el disco de hoy**. Consecuencia:
  **las 461 e2e en verde no ven nada de esto.** Es «verde en mi árbol» en su forma
  más pura — la suite no puede delatarlo por construcción.
- **Cómo se cierra:** correr `infra/scripts/reconciliar-checksums-migraciones.ps1`
  —que existe, clasifica cada fila por finales de línea y **se detiene sin tocar nada
  si alguna no se explica así**— **contra las dos bases, una por una y por su
  nombre**: `-Base spaces` y `-Base spaces_ver2`. Con `-SoloMirar` primero.
  **La corre una persona**, y hay que decirle que son dos bases, no una.
- **Quién puede cerrarla:** una persona. El supervisor no la corre y **no usa
  `--forzar-checksum`**.
- **Si no se cierra antes del 14/10:** la base sobre la que se enseña el producto el
  día del SUMMIT **no acepta ni una migración más**. Cualquier arreglo de datos o de
  esquema entre hoy y esa fecha se queda fuera de la demo, y el runner lo dirá con un
  error que parece un problema de contenido y no lo es. Es la única advertencia de
  esta lista que puede **parar trabajo** en los 26 días que quedan.

> [!danger] Y hay un agravante que no es técnico: **el guion no está escrito en
> ningún sitio donde alguien lo busque**
> Medido: `grep -rn "reconciliar-checksums\|reconciliacion" --include=*.md docs/ vault/ CLAUDE.md`
> devuelve **cero**. El guion existe (`infra/scripts/…ps1`, commit `9c16a57`), su
> cabecera es excelente y su mensaje de commit explica todo — pero **no hay entrada
> en la bitácora, ni runbook, ni nota de bóveda, ni una línea en `CLAUDE.md`**. Una
> tarea que «la corre una persona» y que no aparece en ningún documento que una
> persona abra es una tarea que no se va a correr. Dos detalles más del guion, para
> quien lo ejecute:
> - su `$Repo` por omisión es **una ruta absoluta de esta máquina**
>   (`reconciliar-checksums-migraciones.ps1:39`) — no es un secreto, pero es un valor
>   real quemado en un archivo versionado, y en otra máquina falla;
> - su paso 1 hace `Remove-Item db\migrations\*.sql -Force` + `git checkout --` si
>   detecta CRLF (`:56-58`). Hoy no se dispara —el árbol ya está en LF, medido— pero
>   si se disparara con una migración sin commitear, **se la lleva**.

#### ~~B24 · Dos migraciones y una tabla nuevas, y ni la nota de migraciones ni la de esquema las mencionan — **y los dos commits no llevan nota de bóveda, que es la regla 4 de `AGENTES.md`**~~

> ✅ **CERRADA el 2026-09-18** en `1b1fa03`. Las dos migraciones del 18/09 están
> documentadas en `vault/04-Datos/migraciones.md`, incluida la que cierra R2 con
> las dos sutilezas que costaron saberlo —la lista de columnas del
> `on delete set null` y el `MATCH SIMPLE` que deja pasar «sin asignar»—.
>
> Y el hallazgo colateral, que era peor que la advertencia: **`esquema.md` tenía
> TRES recuentos de tablas distintos en el mismo archivo** —39 en el cuerpo, 43
> en la cabecera, 44 en el árbol— y ninguno era el de hoy.

- **Qué es:** las dos migraciones del 18/09 entraron **solas**, sin la nota que las
  describe en el mismo commit. Una de ellas es la que cierra un agujero de
  aislamiento: es exactamente el cambio que más falta hace tener escrito.
- **Evidencia:**
  ```
  $ git show --stat --format="" 0d85521
   db/migrations/20260918_entidad_tenant_compuesto.sql | 207 +++++
   1 file changed, 207 insertions(+)
  $ git show --stat --format="" f0db34b
   db/migrations/20260918_consumos_energia.sql | 212 +++++
   1 file changed, 212 insertions(+)
  ```
  Y el efecto, hoy:
  - `vault/04-Datos/migraciones.md:108` dice **82 archivos**; hay **84**. Y
    `grep -c 20260918` sobre esa nota devuelve **0**: ninguna de las dos consta.
  - `vault/04-Datos/esquema.md` lleva `actualizado: 2026-09-17`, su callout de
    cabecera dice **43 tablas / 81 archivos** (hay **44 / 84**), su cuerpo `:36` y
    `:54` siguen diciendo **«39 tablas»**, y `grep -c consumos_energia` devuelve
    **0** — la tabla nueva no existe para la nota del esquema.
  - `vault/02-Backend/api-endpoints.md:13,18` dice **94 endpoints**; hay **98**.
  - `vault/01-Arquitectura/decisiones.md` —la nota cuyo trabajo *es* indexar
    decisiones— lleva `actualizado: 2026-08-27` y lista **0001–0024**. Faltan
    **once**: 0025 a 0035, incluidos los **dos ADR que esta rama acaba de escribir**.
- **Cómo se cierra:** cuatro notas, con la cifra medida y no copiada, y el hábito de
  la regla 4. Nada de esto es trabajo grande; lo que cuesta es que nadie lo vea.
- **Quién puede cerrarla:** cualquier ejecutor. El supervisor no toca la bóveda.
- **Si no se cierra antes del 14/10:** la bóveda es lo que se lee **antes de tocar
  código**, y hoy no sabe que existe la tabla de los consumos ni que las FK hacia
  `entidades_fiscales` cambiaron. El próximo que abra `esquema.md` para saber contra
  qué escribe va a leer «39 tablas».

#### ~~B25 · La bitácora se contradice dentro del mismo día, **y la versión falsa va primero**~~

> ✅ **CERRADA el 2026-09-18.** Vuelto a medir hoy sobre el archivo: dice «las
> **cinco** formas de mirar el reporte» y «el metro cuadrado **suma todas las
> caras**» **arriba**, donde se lee. Las dos frases falsas que denunciaba esta
> advertencia —«cuatro formas» y «por ahora se calcula una cara»— **ya no
> existen en el archivo**, y tampoco la que decía que la decisión del m² seguía
> pendiente después de tomarse.
>
> Queda un residuo que **no es un defecto**: la sección del 18/09 dice dos veces
> lo mismo, porque las entradas que eran la corrección siguen debajo de las ya
> corregidas. Es ruido, no una contradicción, y borrar historia de la bitácora
> cuesta más de lo que arregla.

- **Qué es:** `docs/Registro_Cambios.md` es el documento escrito para quien no
  programa — el que lee el dueño. Su sección del 2026-09-18 afirma dos cosas que ella
  misma desmiente 44 líneas más abajo, y el orden es el malo: lo falso arriba.
- **Evidencia (líneas exactas del archivo):**
  ```
  :32  «Las cuatro formas de mirar el reporte ya funcionan.»        <- son CINCO
  :42  «Queda una decisión pendiente: … el metro cuadrado son 18 o 36.»
  :43  «Por ahora se calcula una cara, y el reporte lo dice.»       <- son TODAS las caras
  ...
  :76  «Ya son los cinco reportes: entra el consumo de luz.»        <- la corrección
  :86  «El metro cuadrado suma todas las caras.»                    <- la corrección
  ```
  Y lo que dice el código, medido: `MULTIPLICAR_M2_POR_CARAS = true`
  (`lib/data/reportes.ts:1227`), y la pantalla escribe «cuenta 36 m², no 18». O sea
  que `:43` no solo está desfasada: **afirma lo contrario de lo que el producto hace
  y de lo que el propio texto promete que el reporte dice**.
- **Cómo se cierra:** tachar o reescribir `:32` y `:42-43`. La cabecera del archivo
  declara que «la entrada más reciente va arriba», y dentro de un mismo día ese
  criterio deja la corrección debajo de lo corregido, que es justo al revés de como se
  lee.
- **Quién puede cerrarla:** cualquier ejecutor. `Registro_Cambios.md` es archivo de
  alto contacto y se reclama por separado.
- **Si no se cierra antes del 14/10:** es el documento que se le pone delante al
  dueño para contarle qué entró. Hoy le dice que su decisión del m² sigue pendiente
  **después** de que la tomara y se construyera. Este repositorio ya pagó un cierre
  en falso que tres documentos copiaron; el molde es el mismo.

#### ~~B26 · La promesa falsa de D2 sigue viva en el cuestionario: manda a «Administración», y ahí no hay nada~~

> ✅ **CERRADA el 2026-09-18.** Vuelto a medir en el código, que es lo que esta
> advertencia pedía:
> `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:162` dice hoy
> **«Después puedes separarlos en Razones sociales»**, y el comentario de `:230`
> dice **«el cuestionario sigue accesible desde Razones sociales»**. Las dos
> frases que mandaban a «Administración» desaparecieron.
>
> Comprobado además que el destino es el bueno:
> `grep -rn "azones sociales" "app/(app)/(shell)/administracion/"` sigue
> devolviendo **vacío** —o sea que la frase vieja era falsa— y el cuestionario se
> alcanza desde **Razones sociales**.
>
> **Se cerró sin que nadie lo apuntara**, que es el patrón que este archivo
> existe para romper: el arreglo entró en una ola posterior y la advertencia
> siguió figurando como abierta. Vale para las cinco que se cierran hoy.

- **Qué es:** se arregló **una** de las dos frases. La pantalla de «ya contestado»
  ahora enlaza a donde de verdad están las razones sociales; el **cuestionario**, que
  es lo que ve alguien la primera vez, sigue mandando al sitio equivocado.
- **Evidencia:**
  - arreglado: `app/(app)/bienvenida/page.tsx:125-137` — «ve a **Razones sociales**»,
    con `<Link href="/razones-sociales">` y un botón, y el comentario que explica por
    qué («Mandaba a Administración, y ahí NO HABÍA NADA»).
  - **sin arreglar, y es texto que el usuario lee:**
    `components/demo/bienvenida/CuestionarioRazonesSociales.tsx:162` →
    *«Se le asignarán todos los roles. Después puedes separarlos en Administración.»*
  - y el comentario de `:230` repite el error: «el cuestionario sigue accesible desde
    Administración».
  - **medido que las dos frases son falsas:**
    `grep -rn "azones sociales\|razones-sociales" app/(app)/(shell)/administracion/`
    devuelve **vacío**, y el único enlace a `/bienvenida` de toda la interfaz está en
    `app/(app)/(shell)/razones-sociales/page.tsx:124` — o sea que el cuestionario se
    alcanza desde **Razones sociales**, nunca desde Administración.
- **Cómo se cierra:** dos frases. La visible manda a «Razones sociales»; el
  comentario dice la verdad.
- **Quién puede cerrarla:** un ejecutor.
- **Si no se cierra antes del 14/10:** es la **primera pantalla** que ve un cliente
  nuevo, y le da una instrucción que no lleva a ninguna parte. Es el mismo defecto
  que motivó que el dueño pidiera la pantalla, sobreviviendo en el sitio donde más se
  nota.


#### ~~B7 · La puerta obligatoria de e2e no se ha corrido sobre el árbol fusionado~~

> ✅ **CERRADA el 2026-09-18, tarde.** Corrida en este árbol, con el 3311 y
> `spaces_e2e` libres y con el build hecho antes. **La salida, pegada:**
> ```
> $ cd apps/web && npm run build && npm run test:e2e
>  Test Files  41 passed (41)
>       Tests  461 passed | 1 skipped (462)
>    Duration  198.35s
> EXIT=0
> ```
> **La omitida no es una sorpresa y conviene nombrarla:** es
> `aislamiento.e2e.test.ts:212`, un `it.skip` preexistente («requiere un build con la
> bandera de producción — se verifica en el despliegue»). **Ese archivo no está en el
> diff** (`git diff --name-only main...HEAD`), así que el invariante 7 se cumple: pasa
> **sin tocarse**. Tampoco están `servidor-e2e.ts` ni `db/schema.sql`.
> Y las dos otras puertas, en el mismo árbol:
> ```
> $ npm run typecheck          → tsc --noEmit, EXIT=0
> $ npm test                   → Test Files 130 passed (130) · Tests 1651 passed (1651)
> ```
> Los archivos que yo nombraba como imprescindibles y nadie había visto en verde aquí
> están dentro de esos 41, incluido `esquema-sin-owner.e2e.test.ts` —el que afirma el
> recuento de tablas, hoy **44**—.

- **Qué es:** la lista de `AGENTES.md` exige `npm run test:e2e` cuando el cambio
  toca auth, tenant, dinero o migraciones. **Esta rama toca las cuatro.** No se
  corrió.
- **Evidencia:** el puerto **3311** y la base **`spaces_e2e`** son recurso
  exclusivo y los tiene `ola3/reportes-columnas` ahora mismo, así que la corrida
  quedó fuera de esta sesión por diseño. Lo que **sí** está medido en este árbol:
  `typecheck` limpio (exit 0), **1430 unitarias en 121 archivos en verde**, y
  **390 `it()` declarados en 36 archivos e2e** contados estáticamente —**declarados,
  no ejecutados**. Los que hacen falta y nadie ha visto en verde aquí son, como
  mínimo: `entidades-fiscales.e2e.test.ts` (31), `reportes-rentabilidad.e2e.test.ts`
  (15), `esquema-sin-owner.e2e.test.ts` (9, y es el que afirma las 43 tablas) y
  `aislamiento.e2e.test.ts` (7, que tiene que pasar **sin tocarse** — y confirmo que
  no está en el diff).
- **Cómo se cierra:** `cd apps/web && npm run build && npm run test:e2e` cuando el
  3311 quede libre. **Con el build hecho antes**, o mueren todas en falso tras 636 s.
- **Quién puede cerrarla:** quien tenga el 3311 libre, en sesión separada.
- **Si no se cierra antes del 14/10:** se fusiona sin la verificación que existe
  precisamente para lo que esta rama toca. Es lo primero que hay que hacer, y hasta
  entonces **el veredicto no puede pasar de rojo**.

#### B8 · Nadie ha abierto el PR, así que `ci.yml` no ha verificado nada en una máquina limpia

- **Qué es:** «verde en mi árbol» no es «verde». La verificación independiente la da
  `ci.yml` (typecheck + test + build) en una máquina limpia, y no se ha ejecutado.
- **Evidencia:** la rama es local; los checks de `main` son `ci.yml` y
  `lockfile-check.yml` (`CLAUDE.md:186`). Esta rama **añadió `.gitattributes`** con
  `scripts/*.mjs text eol=lf` justo porque una prueba pasaba en el árbol donde se
  escribió y moría al fusionarse. Una máquina limpia es lo único que confirma que
  ese arreglo funciona.
- **Cómo se cierra:** abrir el PR. **El supervisor no lo abre** (prohibido `gh`,
  `git push`).
- **Quién puede cerrarla:** una persona.
- **Si no se cierra antes del 14/10:** se aterriza sin comprobación independiente,
  en la rama que sostiene el lanzamiento.

#### ~~B9 · Ninguna pantalla nueva tiene e2e propia~~

> ✅ **CERRADA el 2026-09-18, tarde, y con más de lo que pedía.** Tres archivos
> nuevos, **52 casos**, y los tres **demostrados por mutación** con la mutación
> revertida, que es lo que separa un guard que muerde de uno que decora:
> - `bienvenida.e2e.test.ts` (18): con la política de RLS reescrita a `using (true)`
>   se ponen rojas cuatro aserciones; con `contarEntidadesDelTenant()` además sin su
>   `and tenant_id`, la que afirma «5 y no 10».
> - `energia-consumos.e2e.test.ts` (23): las dos capas mutadas **por separado**, y
>   ahí apareció lo que no se veía leyendo — aunque la consulta se trajera los
>   recibos de otra organización, **el síntoma de la fuga no es un total al doble**,
>   porque el reparto va por las caras de *mis* sitios y el recibo ajeno no encuentra
>   destino. El detector es `cobertura.recibosSinDestino`, y la prueba se reforzó
>   para afirmarlo: sin eso, esa mutación pasaba en verde.
> - `reportes-acceso.e2e.test.ts` (11): las cinco dimensiones dan 403 al rol sin
>   `finanzas`, con **control positivo** (el Dueño de la misma organización recibe
>   200) y comprobando antes que el permiso **no está sembrado**, para que el 403 no
>   pueda venir de una semilla incompleta.
>
> **Y la que yo decía que «más valdría» existe con otro nombre:** no hace falta una
> e2e que afirme que el reporte no abre con ingreso cero, porque el dueño decidió que
> sí abra así (D3); lo que se prueba en su lugar es el aviso, en
> `consulta.test.ts:187-233`.
>
> **Lo que esas e2e destaparon, y esto es lo que hace que cerrar B9 valga:** cuatro
> afirmaciones que la bóveda hacía y el servidor no sostenía, corregidas por su autor
> en el mismo commit. La más importante, en `pantalla-reportes.md`: la nota decía que
> un rol sin `finanzas` **no puede abrir `/reportes` por enlace directo**, y el
> servidor **no lo impide** — `middleware.ts:174-179` solo compuerta por presencia de
> sesión, así que a un COMERCIAL autenticado `/reportes/` le responde **200** con el
> HTML; quien lo desvía es `AuthGate` en el navegador. **No es fuga de datos** —el
> HTML no trae ni una cifra y el endpoint le contesta 403, y la e2e lo comprueba—
> pero la frase era falsa. Lo que protege el dinero es el guard del endpoint, no la
> ruta de la página.

- **Qué es:** las dos pantallas nuevas —el cuestionario de bienvenida y el reporte
  de rentabilidad— no tienen prueba de extremo a extremo que las recorra.
- **Evidencia:** `apps/web/lib/test/entidades-fiscales.e2e.test.ts` y
  `reportes-rentabilidad.e2e.test.ts` cubren **el endpoint**, no la pantalla. Y
  `vitest.config.ts` no monta jsdom a propósito, así que lo que se escribe dentro de
  un `.tsx` no lo prueba nadie: por eso la lógica salió a `consulta.ts`, `estado.ts`
  y `tabla.ts`. La consecuencia está medida en B1 y B4: **los tres defectos de hoy
  viven en el `.tsx` y en las constantes, y no los vio el typecheck, ni las 1430
  unitarias, ni las 390 e2e.** Los vio un navegador.
- **Cómo se cierra:** seis e2e ya anotadas (tres del cuestionario, tres del
  reporte). La que más valdría, a la vista de B1: una que abra el reporte con la
  base de demostración y **afirme que la primera pantalla no sale con ingreso cero**.
- **Quién puede cerrarla:** un ejecutor, cuando el 3311 esté libre.
- **Si no se cierra antes del 14/10:** el mismo tipo de defecto vuelve, y vuelve
  invisible.

#### ~~B10 · Multi-entidad no tiene un solo dato en la base de demostración~~

> ✅ **CERRADA el 2026-09-18** por `cda3db8`, con su rojo previo en `2d246cf`.
> **Con qué se midió — contado en `spaces_ver2`, no en el guion:**
> ```
> select count(*) from entidades_fiscales;                              →  3
> select count(*) total, count(entidad_id) from contratos_arrendamiento; →  4 | 3
> select count(*) from consumos_energia;                                → 40
> ```
> Y visto en pantalla: las tres razones sociales con sus papeles repartidos
> —«Inmuebles DEMO del Centro» paga rentas y compra activos, «Publicidad DEMO
> Exterior» vende, «Servicios DEMO Operativos» licencias y nómina—. Los RFC son
> inventados (`DMO010101…`), no hay ninguno real en el diff.
> **Y el rojo de `2d246cf` era FUERTE, no de resolución de módulo** —la lección de
> B18—: comprobado que `scripts/semilla-demo.mjs` ya existía en ese commit
> (`git cat-file -e 2d246cf:scripts/semilla-demo.mjs` pasa) y que **los siete
> símbolos que la prueba importa estaban exportados**, así que falló por aserción.

- **Qué es:** aunque se construyera la pantalla de D2, **no hay nada que enseñar**.
- **Evidencia:**
  ```
  $ docker exec spaces_db psql -U spaces -d spaces_ver2 \
      -c "select count(*) from entidades_fiscales;" \
      -c "select count(*) total, count(entidad_id) con_entidad from contratos_arrendamiento;" \
      -c "select count(*) total, count(entidad_emisora_id) con_entidad from facturas;"
   count = 0        total = 3 | con_entidad = 0        total = 0 | con_entidad = 0
  ```
  La semilla del guion de Tlalpan contra Santa Mónica **no siembra razones
  sociales**, y las cinco etiquetas del catálogo sí están (`ARRENDAMIENTOS`,
  `ACTIVOS`, `LICENCIAS`, `OPERACION`, `VENTAS`).
- **Cómo se cierra:** añadir a la semilla dos o tres razones sociales y repartir los
  contratos entre ellas. Es pequeño y depende de D2: sin pantalla, sembrar datos que
  nadie puede ver no sirve.
- **Quién puede cerrarla:** un ejecutor, después de D2.
- **Si no se cierra antes del 14/10:** la mitad del alcance que pidió el jefe no se
  puede demostrar, ni siquiera con la pantalla construida.

#### B11 · El costo de una orden de trabajo se puede configurar, pero no hay pantalla para hacerlo

- **Qué es:** cabo suelto de las horas por tipo de OT aprobadas el 18/09. Los costos
  por tipo se guardan y se leen correctamente, pero solo se pueden poner con una
  petición a mano.
- **Evidencia:** el endpoint existe y valida bien (`app/api/config/route.ts:68-76`,
  con enum cerrado y `null` = quitar), pero **cero referencias a `costosOt` en
  cualquier `.tsx`**:
  ```
  $ grep -rn "costosOt|costos_ot" --include=*.tsx app components   → (vacío)
  ```
  Mientras `docs/Registro_Cambios.md` anuncia «Cuánto cuesta una orden de trabajo ya
  se puede configurar, y por tipo». Es cierto del sistema, no del producto.
  Sobre las **horas** en sí no queda nada suelto: las reales se derivan de las dos
  marcas de tiempo de la OT y los rangos de la semilla (`scripts/semilla-demo.mjs:192,204`)
  son solo datos de demostración, no una entrada de negocio.
- **Cómo se cierra:** un bloque en Administración. Pequeño.
- **Quién puede cerrarla:** un ejecutor.
- **Si no se cierra antes del 14/10:** la dimensión «por operación» enseña costos
  que el dueño no puede ajustar, y el reporte usa los de respaldo sin que se vea.

### B · iii — Menores, para que no se pierdan

- **B27 · La pantalla de reportes ignora la querystring, así que un reporte no se
  puede compartir por enlace.** `reportes/page.tsx:72-76` inicializa el estado con
  `RANGO_DE_APERTURA(new Date())` y **nunca lee `searchParams`**. Medido: navegar a
  `/spaces-dooh/reportes/?desde=2026-04-01&hasta=2026-06-30` deja la pantalla en
  jul–sep 2026 con los datos del trimestre en curso; la URL cambia y la pantalla no.
  El comentario de `consulta.ts:202-204` dice que el rango «viaja en la querystring
  como cualquier otro rango que elija una persona», y es cierto **de la llamada al
  endpoint**, no de la dirección de la pantalla — es fácil leerlo al revés. No es un
  defecto de cálculo, pero para una presentación el 14/10 significa que **no hay
  forma de dejar preparado un enlace que abra el reporte ya filtrado**: hay que
  teclear dos fechas en vivo. Conviene saberlo antes del ensayo, no durante.
- **B28 · Las 41 e2e prueban `next start`; la imagen que corre en producción arranca
  otra cosa.** `next.config.mjs:119` tiene `output: 'standalone'` y el `Dockerfile:149`
  hace `CMD ["node", "apps/web/server.js"]`, mientras `servidor-e2e.ts` levanta
  `npx next start`. El propio `next start` lo avisa al arrancar, y lo vi hoy en el
  log del 3409: *«"next start" does not work with "output: standalone" configuration.
  Use "node .next/standalone/server.js" instead.»* En la práctica sirvió bien —las
  páginas cargaron y los datos también—, así que **no es un fallo**, es un hueco de
  cobertura **preexistente** (viene de `8ae8f77`, no de esta rama): ninguna prueba de
  este repositorio ejercita el artefacto que de verdad se despliega. Se menciona aquí
  porque es la forma que tiene «verde en mi árbol» en este proyecto, y porque el
  aviso del arranque es fácil de confundir con un entorno roto.
- **B29 · La cita derivada que se reportó y NO se corrigió, y está en código de
  producción.** `apps/web/lib/server/bienvenida-repo.ts:17` dice «La frontera es UNA:
  `tenant_id` con RLS (`db.ts:54-69`)». Medido hoy: `db.ts` tiene 180 líneas, la
  **54** es el `return` de `tenantDeRequest`, la **60** es `fijarTenant` y el rango
  cae dentro de `qRaw` —que es **lo contrario** de la frontera que la frase señala—.
  El `set_config` de `q()` está en la **79**. Lo llamativo es que la bóveda **ya lo
  documenta**: `vault/02-Backend/cuestionario-bienvenida.md:214-216` cita bien
  (`:79` y `:60`) y avisa «esa nota cita `db.ts:54-69` y ese rango ya derivó». O sea
  que se midió, se escribió el aviso, y **no se arregló el sitio que lo tiene mal**.
  Quedan dos más con el rango viejo: `vault/01-Arquitectura/vision-general.md:185` y
  `vault/00-Inventario/inventario-2026-08-11.md:777` (esta última es un inventario
  con fecha, discutible si se toca). El MOC y `entidades-fiscales.md:26` ya citan
  `:60` y `:79`.
- **B30 · Del manual de usuario quedan seis pendientes, y uno ya se puede cerrar sin
  abrir la aplicación.** `vault/08-Manuales/manual-usuario-2026-09-18.md:592` en
  adelante: ocho de los catorce se cerraron **mirando la aplicación** y están escritos
  con el texto literal de pantalla, que es como se hace. De los seis que quedan, el
  **nº 6** —«¿qué ve un perfil de Operaciones si intenta abrir el reporte?»— **ya
  está medido** por la e2e nueva `reportes-acceso.e2e.test.ts`, que afirma el 403 de
  las cinco dimensiones y que el mensaje no filtra ninguna clave; basta copiar la
  frase de ahí. Los otros cinco necesitan provocar un estado (una organización sin
  razones sociales, un papel sin dueño, borrar un recibo) y **no se inventan**: bien
  dejados abiertos. El nº 1 —que el inventario vigente es del 15/09 y no cubre estas
  tres áreas— es una decisión de alcance, no una pregunta de redacción.


- **~~B12 · La tabla «qué archivo hace qué» de la nota nueva del módulo apunta mal en
  5 de 6 filas.~~** ✅ **CERRADA el 2026-09-18** por `d0c9cd2`. **Con qué se midió:
  las seis filas, una por una, con `sed -n` sobre la línea citada** —
  `reportes-controller.ts:100` → `export function validarConsultaRentabilidad`;
  `:128` → `export async function rentabilidadCtrl`; `reportes-repo.ts:50` →
  `datosRentabilidad`; `reportes.ts:986` → `rentabilidadPorSitio`; `:340` →
  `bucketsDelRango`; `:400` → `mesesEquivalentes`. **Seis de seis aciertan**, y la
  fila que además afirmaba «501 si no hay motor» ya no lo dice. La nota deja escrito
  que derivaron *por crecer*, que es el dato reutilizable.
- **~~B20 · Rebanada sin consumidor en `/api/estado`.~~** ✅ **CERRADA el 2026-09-18**:
  `entidadesFiscales` ya tiene consumidor —
  `grep -rln entidadesFiscales --include=*.tsx` devuelve
  `app/(app)/(shell)/razones-sociales/page.tsx`. Se justificó sola en cuanto existió
  la pantalla de D2, tal como estaba previsto.
- **~~B18 · Un rojo de TDD de los cuatro es débil.~~** ✅ **No volvió a pasar en la
  ola nueva.** Ver la medición en B10: el rojo de `2d246cf` es por aserción.
- **B13 · SIGUE ABIERTA, y una de las dos citas empeoró.** Remedido el 18/09:
  `reportes-repo.ts:25` sigue diciendo «23 rebanadas» y citando
  `estado/route.ts:97-124`; `consulta.ts:12` dice «24» y cita `:98-130`. **La
  destructuración está en `:98` y lleva 24 nombres** —contados uno a uno, el último
  es `entidadesFiscales`— así que **`consulta.ts` es la correcta**, como ya decía.
  Lo nuevo: **las DOS fallan en la otra cita**. El comentario de los 6.12 MB está hoy
  en `estado/route.ts:146-157` (la línea que dice «6.12 MB» es la `:152`);
  `reportes-repo.ts:27` manda a `:132-141` y `consulta.ts:16` a `:142-146`, y ninguno
  de los dos rangos lo contiene ya.
- **B22 · SIGUE ABIERTA y ahora está replicada.** El patrón de bucle sin control
  positivo propio se repitió en el guard nuevo:
  `energia-repo.aislamiento.test.ts:317,324,333` iteran `rutas(DIR)` sin afirmar
  antes que la lista no está vacía, igual que
  `reportes-repo.aislamiento.test.ts:166,174`. **En los dos casos un `it` hermano sí
  tiene el control positivo** (`energia…:308` con `toBeGreaterThan(0)`,
  `reportes…:154` igual), así que el escenario malo se detectaría por ahí: es
  fragilidad de forma, **no fallo activo**.
  **Y lo demás de esos guards SÍ muerde — comprobado por mutación hoy, en memoria y
  sin tocar el archivo:** el extractor de `energia-repo.aislamiento.test.ts:208-214`
  encuentra **4 consultas** en `energia-repo.ts` y **0 violaciones**; quitando
  `and tenant_id = $2` del fuente, salta a **1 violación** y la nombra
  (`delete from consumos_energia where id = $1 returning id`). El árbol quedó
  intacto (`git status` limpio).
- **B12-bis (histórico) · La tabla «qué archivo hace qué» apuntaba mal en 5 de 6
  filas.** Detalle de la medición original: `vault/02-Backend/reportes-rentabilidad.md:57-62` — verificado
  línea a línea: `:57` manda a `reportes-controller.ts:81`, que es un `addIssue`
  (la función está en `:97`); `:58` a `:95`, que es `})` (está en `:121`); `:60` a
  `reportes.ts:300`, un comentario (`rentabilidadPorSitio` está en `:791`, **491
  líneas de distancia**); `:61` a `:207`, comentario (`bucketsDelRango` en `:269`);
  `:62` a `:266`, dentro de otro docblock (`mesesEquivalentes` en `:329`). Solo
  `reportes-repo.ts:50` acierta. Es justo la tabla que alguien abriría para
  navegar el módulo nuevo. Y la fila `:58` además afirma «501 si no hay motor»,
  que ya no existe.
- **B13 · Dos citas del mismo archivo, en dos archivos nuevos de la misma rama, no
  coinciden.** `reportes-repo.ts:25-28` cita `estado/route.ts:97-124` y `:132-141`
  hablando de «23 rebanadas»; `consulta.ts:11-15` cita `:98-130` y `:142-146` y
  dice «24». Medido: la destructuración está en `:98`, el cuerpo en `:131-133`, el
  comentario de los 6.12 MB en `:138-146`, y las rebanadas son **24** desde que
  esta rama añadió la suya. La de `consulta.ts` es la correcta.
- **B14 · Dos wikilinks rotos y tres notas huérfanas.** Rotos:
  `vault/07-Agentes/diario/2026-09-07.md:37` y `:294` usan `[[../../docs/adr/…]]`,
  que desde `vault/07-Agentes/diario/` cae en `vault/docs/…` y no existe (el ADR sí
  existe, en `docs/adr/`). Huérfanas: `vault/07-Agentes/diario/2026-09-17.md`,
  `vault/08-Manuales/manual-tecnico-2026-09-15.md` y
  `manual-usuario-2026-09-15.md` — las tres por lo mismo: el MOC no recogió nada
  posterior al 02/09 en sus apartados 07 y 08, y sigue llamando «el vigente» al
  manual del 25/08 (`MOC-Proyecto.md:123,151,153`).
- **B15 · `vault/04-Datos/esquema.md` se contradice consigo misma.** Su callout de
  cabecera trae 43 tablas ✓ pero el cuerpo (`:36-38`, `:55`) sigue diciendo «39
  tablas», «74 migraciones» y «las 11 restantes» (son 15). Y `:22` dice 81
  archivos de migración cuando la fusión los dejó en 82.
- **B16 · `vault/02-Backend/api-endpoints.md:13,18` dice 94 endpoints**, medidos el
  17/09; la fusión los dejó en **96**. Y `:16` cita `next.config.mjs:93` para el
  `basePath`, que es un comentario de CSP — el `basePath` está en `:126`.
  `pantalla-reportes.md:96` lo cita bien.
- **B17 · Seis citas a un archivo que no existe.** `vault/04-Datos/migraciones.md`
  (`:192`, `:251`, `:288`, `:416`, `:498`, `:683`) cita `.github/workflows/deploy.yml`,
  borrado por `658c467`. **Ninguna la introdujo esta rama** (`git diff main...HEAD`
  sobre esa nota no las toca): es deuda heredada.
- **B18 · Un rojo de TDD de los cuatro es débil.** `1e48cd3` («el guion de la demo
  escrito como asercion, en rojo») añadió **solo** el archivo de prueba, y
  `scripts/semilla-demo.mjs` no existía en ese commit —comprobado con
  `git cat-file -e 1e48cd3:scripts/semilla-demo.mjs`, que falla—, así que el rojo
  fue un fallo de resolución de módulo y no de aserción. Los otros tres
  (`7ff5458`, `29a7938`, `5c37262`) son rojos **fuertes**: acompañan esqueletos que
  compilan y lanzan `throw new Error('sin implementar')`, así que fallan por
  comportamiento.
- **B19 · Camino muerto que se prueba.** Como el servidor ya no devuelve 501, la
  rama `sin-motor` de `components/demo/reportes/estado.ts:64-71` es inalcanzable, y
  `estado.test.ts:20-49` tiene cuatro casos que cubren comportamiento que no puede
  ocurrir. Se limpia junto con B4.
- **B20 · Rebanada sin consumidor en el endpoint que se quiere adelgazar.**
  `app/api/estado/route.ts:129,132` calcula y serializa `entidadesFiscales`, y
  **ningún `.tsx` la lee** (solo la e2e, `:377-387`). Es una consulta más por cada
  hidratación del shell, en la ruta que su propio código documenta que llegó a
  6.12 MB. Se justifica sola en cuanto exista la pantalla de D2.
- **B21 · Sin unicidad de RFC en las razones sociales propias.**
  `20260810_arrendadores_rfc_unico.sql` y `20260826_clientes_rfc_unico.sql` imponen
  RFC único en arrendadores y clientes; `entidades_fiscales` **no tiene ningún
  unique sobre `rfc`** ni comprobación en el controller, así que dos razones
  sociales del mismo dueño pueden nacer con el mismo RFC. **No verificado si es
  deliberado**: a diferencia del resto del archivo, no hay comentario que lo
  justifique.
- **B22 · Dos guards con bucle sin control positivo.**
  `lib/server/reportes-repo.aislamiento.test.ts:163` y `:171` iteran `rutas(DIR)`
  sin afirmar antes que la lista no está vacía. Hoy no están vacíos (hay 1 archivo)
  y el `it` de `:152` sí tiene su `expect(...length).toBeGreaterThan(0)`, así que
  el escenario malo se detectaría por ahí. Es fragilidad de forma, no fallo activo.
  Lo demás de ese guard **sí muerde**: `:88` prohíbe `qRaw` sobre todo el fuente y
  `:72` es un control positivo de ≥4 consultas con 5 reales, o sea al filo a
  propósito.

---

## C · Cerradas

#### ✅ C6 · «Las e2e no se han corrido» — **CERRADA el 2026-09-18, tarde**

**Con qué se midió:** `cd apps/web && npm run build && npm run test:e2e` en el
worktree `entidades`, con el 3311 y `spaces_e2e` libres:
`41 archivos · 461 pruebas · 1 omitida · exit 0 · 198.35 s`. La omitida es el
`it.skip` preexistente de `aislamiento.e2e.test.ts:212`. Detalle en B7.

#### ✅ C7 · «El aviso en ámbar no basta / hay que cambiar el rango de apertura» — **JUZGADA COMO ESTÁ, y basta. 2026-09-18**

Mi recomendación era cambiar el rango; el dueño eligió lo contrario y resolverlo con
un aviso. **Con qué se midió que el aviso vale:** sale en jul–sep 2026 y
**desaparece** en abr–jun 2026, visto en el navegador contra `spaces_ver2` en el 3409.
Un aviso que saliera siempre no lo leería nadie, y esa desaparición es información.
La condición está probada en `consulta.test.ts:187-233`, incluido el caso `2026-9-1`
sin cero a la izquierda —el que un `<=` de cadenas habría dejado pasar justo en el mes
que hace falta—. **Queda un residuo declarado**, no un motivo de rojo: las cuatro
cifras grandes del encabezado no llevan el matiz dentro (D3).

#### ✅ C8 · «Puede que B4 ya esté resuelta en `ola3/reportes-columnas` — no verificado» — **VERIFICADA. 2026-09-18**

Lo dejé como hueco declarado porque la instrucción de esa corrida era no entrar al
worktree. **Con qué se midió:** esa rama aterrizó en `cb6ffc2`, y las dos mitades se
comprobaron en un navegador, no leyendo — selector sin «(en preparación)» y una tabla
con columnas propias por dimensión. Detalle en B4.

#### ✅ C9 · «Los guards podrían ser vacuos» — **COMPROBADO POR MUTACIÓN. 2026-09-18**

**Con qué se midió:** el extractor de `energia-repo.aislamiento.test.ts:208-214`
encuentra 4 consultas reales en `energia-repo.ts` y 0 violaciones; **quitando
`and tenant_id = $2` se pone rojo** y nombra el `delete`. Mutación hecha **en memoria,
sin tocar el archivo** —el classificador de permisos, con razón, no deja escribir un
debilitamiento de aislamiento en el árbol—, y `git status` quedó limpio. Las e2e
nuevas traen además sus propias mutaciones documentadas y revertidas (B9).

#### ✅ C10 · «Toda ruta citada existe y ningún número de línea ha derivado, en las notas nuevas» — **MEDIDO. 2026-09-18**

**Con qué se midió:** recorrido automático de las ocho notas y ADR que toca la rama
(`cuestionario-bienvenida`, `energia-consumos`, `pantalla-reportes`,
`semilla-de-demostracion`, `03-Frontend/_indice`, `manual-usuario-2026-09-18`, ADR
0034 y 0035), probando cada ruta contra las **dos** bases (repo y `apps/web`):
**0 citas fuera de rango** y **0 rutas inexistentes** una vez resueltos los nombres
sueltos sin directorio, que son convención de la bóveda y no enlaces roscados
(comprobados uno a uno: `cuestionario-entidades.ts`, `bootstrap-auth.mjs`,
`_error.tsx` y el resto existen). Es el mejor resultado que ha dado este chequeo.

#### ✅ C1 · «Los cinco checksums divergentes son una decisión del dueño» — **DESCARTADA como decisión el 2026-09-18**

No era una decisión: era un artefacto de finales de línea. **Con qué se midió:** el
checksum registrado en la base coincide exactamente con el sha256 del archivo en LF y
el de disco con el del archivo en CRLF, para los cinco. El contenido SQL es idéntico.
Queda como advertencia técnica **B2**, con dueño técnico y no del dueño del negocio.

#### ✅ C2 · «`entidad_id` está en contratos y en comprobantes» — **CORREGIDO EL ENUNCIADO el 2026-09-18**

No hay tabla `comprobantes` en este esquema. Las dos columnas reales son
`contratos_arrendamiento.entidad_id` y **`facturas.entidad_emisora_id`** — nombre
distinto, así que **un `grep` por `entidad_id` no la encuentra**. **Con qué se midió:**
`select table_name from information_schema.columns where column_name='entidad_id'`
devuelve solo `contratos_arrendamiento` y `entidad_roles`; la de facturas aparece en
`20260917_entidades_fiscales.sql:154`.

#### ✅ C3 · «El periodo por omisión se cambió a último cerrado, con la vuelta atrás en una línea» — **NO OCURRIÓ EN ESTE ÁRBOL. 2026-09-18**

**Con qué se midió:** no existe ninguna función de «último cerrado» —
`grep -rn "ultimoCerrado|trimestreCerrado"` sobre `apps/web` no devuelve nada— y la
única que hay calcula el trimestre **en curso** (`consulta.ts:154`), confirmado por
su propia prueba `consulta.test.ts:144`. Sigue abierta como **D3** y **B1**.

#### ✅ C4 · «Las horas por tipo de OT dejaron algo suelto» — **REVISADO el 2026-09-18**

De las horas, nada: las reales se derivan de las dos marcas de tiempo de la OT y los
rangos de la semilla son datos de demostración. Lo que sí quedó suelto es el **costo**
por tipo, que no tiene pantalla: queda como **B11**.

#### ✅ C5 · «`esquema-sin-owner.e2e.test.ts` se tocó» — **ES CORRECTO. 2026-09-18**

Aparece en el diff, y está bien: es un guard de recuento que **mordió** (delató las
tres tablas nuevas) y se actualizó a conciencia, de 40 a 43, con la historia de la
cifra escrita y la fecha de medición. **No es** el archivo protegido:
`apps/web/lib/test/aislamiento.e2e.test.ts` **no está en el diff**, ni
`servidor-e2e.ts`, ni `db/schema.sql`. Comprobado con
`git diff --name-only main...HEAD`.

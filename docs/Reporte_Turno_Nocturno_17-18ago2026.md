# Turno nocturno · noche del 17 al 18 de agosto de 2026

Rama: `feat/servidor-padre-instancias` · Plan: `docs/Plan_Instancias_Soberanas_v3.md`
Alcance: **ejecución local, sin supervisión humana**. Nada de esto se ha aplicado al
servidor, y ningún paso salió a la red contra un servidor real.

**12 cambios en siete horas**, todos con prueba y todos auditados por una sesión
distinta de la que los escribió. Tres tareas del plan cerradas en local. El árbol de
trabajo quedó limpio y sin nada a medias.

La batería de pruebas del script de actualización pasó de **28 escenarios y 6 pruebas
de sabotaje** a **51 escenarios, 236 comprobaciones y 21 sabotajes, ninguno sin
detectar**. Las pruebas de la aplicación siguen intactas: 821 en 74 archivos.

---

## Dónde está cada fase

| Fase | Estado | Qué falta |
|---|---|---|
| **0** · Cerrar el registro de cuentas nuevas | Lo local, hecho | Dos comprobaciones en el servidor |
| **1** · Limpieza de las filas mal etiquetadas | Cerrada en local | Aplicar la migración al servidor |
| **2** · Versionado de la imagen | Parcial | Dos variables que fija una persona |
| **3** · Actualizaciones automáticas | **Muy avanzada** | Una tarea local (F3.9) y el ensayo en el servidor |
| **4 a 8** | Sin empezar | — |

---

## Lo que se hizo · las actualizaciones automáticas

Esta es la pieza que permite que la instalación de cada cliente **se actualice sola**,
sin que nadie entre por consola al servidor. Es también la que puede tirar una
instalación si está mal, así que la noche se dedicó casi entera a ella.

### El ensayo completo del actualizador

Se montó una instalación desechable —con su propia base de datos, en su propio
aislamiento— y se comprobaron uno a uno los nueve comportamientos que el plan promete.
Al terminar, todo se destruyó. **La base de datos de desarrollo no recibió ni una
consulta.**

Lo que quedó demostrado, y no de palabra:

- Si no hay versión nueva, **no toca nada** y termina bien.
- **Un respaldo vacío detiene la actualización**, que es lo que evita actualizar sin red
  de seguridad.
- Las migraciones que aplica son **las que viajan dentro de la imagen nueva**, no las
  del disco del servidor. Se demostró de forma bonita: el actualizador anunció un
  archivo que **no existe en el disco**.
- Si la aplicación no responde después de actualizar, **vuelve sola a la versión
  anterior**, y decide si restaurar la base **mirando la base**, no leyendo el texto que
  imprime otro programa. Eso último era un fallo real, arreglado el día anterior, y aquí
  quedó anclado con la frase exacta que lo provocó.
- **Dos actualizaciones a la vez son imposibles**: la segunda se retira sin hacer nada.
- Y el criterio mayor: **el servidor central no aparece por ningún lado**. La
  instalación solo habla con el almacén de imágenes, con su propia base y consigo misma.

### Cinco defectos, cuatro arreglados

El ensayo encontró cinco problemas. Cuatro se arreglaron en la misma noche; el quinto
necesita una decisión y está más abajo.

El más importante de los cuatro: **una aplicación lenta al arrancar podía tirar una
versión sana**. La comprobación de salud juntaba dos códigos de respuesta en uno, y
cuando eso pasaba el actualizador creía que la aplicación no respondía y **restauraba la
base**, perdiendo lo escrito desde el respaldo. Ahora un arranque lento se distingue de
un arranque roto.

Los otros tres: los dos avisos que dejaban la instalación sin servicio **no decían que
estaba sin servicio** ni cómo levantarla —justo el mensaje que alguien lee a las cuatro
de la mañana—; un respaldo vacío se quedaba en el disco; y un mensaje de error adivinaba
la causa cuando la verdadera iba escrita justo encima.

### Los reintentos, con límite

Si la red falla al bajar la versión nueva, el actualizador **reintenta tres veces**,
esperando 1, 5 y 30 segundos. Si tras eso no llega, **deja la instalación exactamente
como estaba** — se comprobó que no escribe respaldo, no guarda nada y no toca el
contenedor.

Y lo contrario, que es lo que de verdad importa: **una migración que falla no se
reintenta nunca**. Reintentar una migración a medias es la forma habitual de corromper
una base de datos. No es una promesa: no hay ningún sitio en el programa desde donde se
pueda reintentar.

### El respaldo sale del servidor

Hasta anoche, el respaldo previo a cada actualización se guardaba **en el mismo servidor
que iba a actualizarse**. Sirve para volver atrás, que es su trabajo, pero **no sirve de
nada si el servidor desaparece** — y con una instalación por cliente, en vez de un solo
servidor cuidado, ese escenario pasa a ser el probable.

Ahora el respaldo **viaja a un almacén externo**. Con cuatro cuidados que merecen
mención:

- Las **credenciales no se ven** en la lista de procesos del sistema, y el archivo
  temporal que las contiene se crea con permisos cerrados **antes** de escribir el
  secreto, no después.
- Si la subida falla, **la actualización sigue** —el respaldo local ya existe— pero
  **queda dicho en el registro**. No es silenciosa.
- Se conservan **tres respaldos locales**; el borrado de los antiguos en el almacén
  externo lo hace **el propio almacén por regla**, y no el programa. La razón está en el
  plan y vale copiarla: un borrado mal escrito en un programa que corre en todas las
  instalaciones es una forma elegante de perderlo todo.
- Y ninguna credencial entró al repositorio.

### El fallo que encontró la auditoría del respaldo

Merece contarse porque es el tipo de cosa que no se ve leyendo el código.

El borrado de respaldos antiguos ordenaba los archivos **por nombre en vez de por
fecha**. Con los nombres normales —que llevan la fecha dentro— funcionaba. Pero bastaba
**un archivo llamado de otra forma** para que se colara por delante y el borrado se
llevara **el respaldo de la actualización en curso**. Y ese nombre no era un caso
rebuscado: era exactamente **el que el propio manual del programa propone como
ejemplo**.

La cadena completa terminaba mal: sin ese respaldo, la subida se salta, las migraciones
corren igual, y si luego hacía falta volver atrás el programa buscaba un archivo que ya
no existía. Resultado: instalación **sin servicio, sin respaldo local y sin respaldo
externo**.

Las pruebas no lo veían porque **solo usaban nombres bonitos**, con formato de fecha.
Está arreglado, y ahora hay tres pruebas nuevas que lo vigilan.

---

## Lo que se hizo · la documentación

El cuaderno de trabajo del proyecto **se había quedado el 11 de agosto**, y detrás
tenía 83 cambios sin narrar. Se escribieron las cuatro jornadas que faltaban: el 12, el
13, el 14 y el 17. El 15 y el 16 quedan en blanco a propósito —fue fin de semana y no
hubo un solo cambio—, y eso está dicho para que nadie los busque.

Se repasó además la documentación técnica entera contra el código, con cuatro
comprobaciones mecánicas. Tres salieron sanas. La cuarta no: **catorce referencias
apuntaban al sitio equivocado** porque un archivo **encogió** de 230 a 226 líneas
cuando se le sacó una parte a otro sitio. Ninguna daba error; solo mandaban a leer la
línea de al lado. Una de ellas apuntaba **fuera del archivo**.

Se corrigieron esas catorce y otras veintidós cosas menores: enlaces rotos, un recuento
de tablas que llevaba mal desde el 11 de agosto y que sobrevivía en el manual técnico, y
una ficha de decisión que faltaba entera. Al cierre: **48 notas, 606 enlaces, ninguno
roto, ninguna nota huérfana**.

---

## Lo que espera a una persona

En este orden. Ninguna se puede hacer sin acceso al servidor o a una cuenta.

| # | Qué | Por qué importa |
|---|---|---|
| 1 | Comprobar si el registro de cuentas nuevas está abierto hoy en el servidor | **Bloquea toda la Fase 4** |
| 2 | Censar las filas mal etiquetadas en la base real | La base local es de prueba y da ceros vacíos |
| 3 | Fijar las dos variables del almacén de imágenes | Cierra la Fase 2 |
| 4 | Aplicar el registro de migraciones y luego la limpieza | En ese orden, no al revés |
| 5 | Crear el almacén de respaldos, una llave por instalación **limitada a su carpeta**, y la **regla de borrado a los 30 días** | Sin la regla, el almacén crece para siempre |
| 6 | El ensayo del actualizador en la instalación de demostración | Cierra la Fase 3 |

> **Antes de las dos últimas** hace falta construir una imagen de verdad con las 68
> migraciones dentro. Las del ensayo se derivaron de una imagen anterior, que trae 67.

> **Un aviso para la comprobación de los reintentos**, o se leerá como un fallo: el
> comando que escribe el plan cuenta las líneas del registro y espera tres. Solo da tres
> **sobre un registro recién creado**; el registro no se recorta y el programa corre a
> diario, así que en un servidor con historia dará más sin que nada esté mal.

---

## Decisiones que necesitan a Jochelo

### 1 · La vuelta atrás no devuelve el esquema de la base

Es lo más importante de la noche y **no se tocó a propósito**: afecta a migraciones y
pide una decisión de diseño, no un parche.

El programa y su manual afirman que restaurar el respaldo devuelve la base «tal cual
estaba». **No es cierto.** La restauración solo deshace lo que está *dentro* del
respaldo; las tablas que creó la versión fallida **sobreviven**.

Se reprodujo de punta a punta: la primera vez, la actualización aplica, la aplicación no
responde, se restaura y se informa de vuelta atrás completa —dejando dentro una tabla
que nadie registra—; la segunda vez, **la actualización muere porque esa tabla ya
existe**. Es decir: **esa versión no se puede volver a aplicar nunca**, el programa
diario lo reintenta cada noche y hace falta una persona.

Dos salidas: restaurar sobre un esquema limpio, o —barato, y con lo que ya existe—
volver a mirar la huella de la base **después** de restaurar y avisar si no coincide.
Lo que no se puede es dejarlo así **y** mantener lo que el manual promete.

Mientras siga abierto: **«vuelta atrás completa» no significa que la base volvió tal
cual estaba.**

### 2 · Dos reglas de trabajo de los agentes se contradicen

La primera regla del contrato de agentes pide **reclamar la zona antes de escribir**. La
regla de ejecución del plan pide **una tarea, un commit**. Las dos juntas hacen
**imposible** mostrar el reclamo y la liberación de una zona: harían falta dos commits.
Van cinco tareas seguidas con la zona en «libre» antes y después, y un commit llegó a
**escribir que la había reclamado** cuando el cambio mostraba «libre» en los dos lados.
O el reclamo deja de ir en commit, o la fase admite un commit de tablero.

### 3 · El expediente de cierre de la Fase 2 quedó desfasado

Afirma **como hecho verificado** que no existen los dos flujos de publicación de
versiones y que sus tareas están bloqueadas. Los dos nacieron el 17 de agosto. Es un
documento histórico, pero es **el cierre de una fase validada**: o se reemite, o se le
pone el aviso encima. No se tocó.

### 4 · Un hueco del plan que muerde en la Fase 5

La plantilla de configuración de cada instalación, que nace en la Fase 5, **no contempla
ninguna de las cinco variables** que necesita el respaldo externo. Si nadie las añade
cuando llegue esa tarea, la plantilla nacerá incompleta y **ninguna instalación
respaldará fuera de su servidor**. No se pudo arreglar antes sin quitarle a esa tarea su
primera prueba, que consiste literalmente en que ese archivo todavía no exista.

### Y las que ya estaban abiertas

El destino del cliente antiguo y del servidor actual; la fecha de traslado de PIXELED;
en qué cuenta nacen las instalaciones; y la contradicción entre el plan, que manda abrir
el registro en la instalación de demostración, y la decisión del 14 de agosto, que lo
cierra en toda la flota.

---

## Lo que NO está probado

- **Nada corrió contra un servidor real.** Ni el actualizador, ni la subida de
  respaldos, ni la bajada de una versión nueva desde el almacén de imágenes: eso último
  fue lo único que se sustituyó por un doble, porque no hay almacén local y las reglas
  prohíben usar uno remoto.
- **Rutas, permisos y usuario real** del servidor. En el ensayo todo corrió como usuario
  normal en un directorio temporal.
- **El programa diario** que dispara la actualización de madrugada.
- **La escala.** El respaldo del ensayo pesaba 175 kB y tardó un segundo. En una
  instalación real, el respaldo y su restauración dominan el tiempo de corte, y el peor
  caso no durará los 21 segundos medidos.
- **El servidor web por delante**, con su certificado.
- Y una limitación que conviene saber: **el actualizador no estrena instalaciones**.
  Solo actualiza. La primera puesta en marcha es de la Fase 5.

---

## Lo que aprendimos, y cuesta caro

Una referencia del tipo `archivo:línea` **se recalculó a mano cuatro veces durante la
noche, y las cuatro salieron mal** — una de ellas dentro del mismo cambio escrito para
corregir las anteriores. El archivo del actualizador creció de 786 a 907 líneas en un
día, y cada crecida invalida de golpe todas las referencias que apuntan por debajo.

La regla deja de ser «ten cuidado» y pasa a ser: **una referencia recalculada a mano es
una referencia rota**. Si se cita ese archivo, se abre.

Y una segunda, de las pruebas: **una prueba que solo usa datos bonitos no prueba nada
incómodo.** El borrado de respaldos pasó todas sus pruebas durante un día entero porque
ninguna le puso delante un nombre raro. También apareció que una prueba de sabotaje se
escapaba por un detalle del intérprete de comandos —limpia igual al morir por señal—, lo
que obligó a partirla en dos para medir de verdad las dos propiedades por separado.

---

## Entregables

- **12 commits** en `feat/servidor-padre-instancias`, ninguno enviado al remoto.
- **Bitácora de guardia** con el detalle técnico y los pasos exactos:
  `.claude/relevo-nocturno-bitacora.md` (fuera del control de versiones).
- **Auditoría de la documentación**, con 35 correcciones y su método:
  `.claude/relevo-nocturno-auditoria-boveda.md` (fuera del control de versiones).
- **Cuatro jornadas nuevas** del cuaderno de trabajo, del 12 al 17 de agosto.
- **Estado de la orquestación** al día, con las fichas de lo que espera a una persona:
  `vault/07-Agentes/ejecucion-plan-v3.md`.

**Lo siguiente del plan es F3.9** —que el registro de la actualización se pueda leer sin
entrar al servidor—, y ya está desbloqueada. Su criterio va en negativo y conviene
tenerlo delante: **ni un dato de negocio puede aparecer en ese registro**.

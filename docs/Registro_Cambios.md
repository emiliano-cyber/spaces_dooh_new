# Registro de cambios — SPACE OS

Bitácora de cambios realizados en el sistema, con un resumen breve de cada uno.
La entrada más reciente va arriba.

---

## 2026-09-30

- **Los avisos de error tambien salen ya en INGLES.** *(Tu decision del 30/09:
  que los mensajes del servidor entren, en el idioma elegido.)*

  Hasta hoy, quien usaba la aplicacion en ingles veia **la pantalla en ingles y
  el aviso de error en espanol** — justo cuando algo salia mal, que es el peor
  momento para no entender. Eso se acabo para la mayoria de los avisos.

  **Lo que cambia para ti, en una frase:** si entras con el navegador en ingles,
  un aviso como «Campana no encontrada» ahora dice «Campaign not found».

  **Importante, y es lo primero que conviene saber: en espanol NO CAMBIA NADA.**
  Ni una palabra, ni una coma. El espanol sigue siendo el original y el ingles
  es una version suya — no al reves. Traducir no era ocasion para reescribir lo
  que un aviso dice, y no se reescribio ninguno.

  **Cuanto quedo cubierto, contado:** de los **251** avisos que puede dar el
  servidor, **179 salen ya en ingles** (el **71 %**). De los que faltan:

  - **44 son avisos que llevan un dato dentro** —«Son 3 archivos y el maximo por
    tanda es 10»—, y esos necesitan otra forma de traducirse. **Es el siguiente
    lote y ya esta contado.**
  - Otros **28** dependen de por donde venga el aviso: se traducen si el texto
    ya esta en la lista, y muchas veces lo esta.

  Mientras tanto, lo que falte **sale en espanol**, que es mucho mejor que salir
  a medias o en blanco.

  **Lo que NO se traduce, y es a proposito:** lo que queda **registrado** — el
  historial de acciones, los registros internos del servidor y los expedientes.
  Un registro escrito en dos idiomas segun quien provoco el fallo no sirve para
  nada: quien lo lee despues no puede saber si dos lineas son el mismo suceso o
  dos distintos. **La memoria del sistema se queda en un solo idioma.**

  **Y dos decisiones tuyas que quedan cerradas por escrito**, para que nadie las
  vuelva a preguntar: el ingles es **de Estados Unidos**, y el idioma se
  recuerda **por dispositivo** (quien elija ingles en su computadora seguira
  viendo espanol en su telefono). Esto ultimo significa, de paso, que **no hizo
  falta ningun cambio en la base de datos**.

  **Lo que nadie comprobo:** *sigue sin abrirse un navegador* — van siete
  entregas. Y **ninguna de las 142 traducciones la reviso un hablante nativo**:
  dicen lo mismo, pero no estan garantizadas de sonar como las escribiria
  alguien de alla.


- **Nueva pantalla «Comercial OPEX»: la prospeccion de arrendadores.** *(Tu
  peticion del 30/09, a partir de un prototipo tuyo: «por ahora solo sera html
  sin funciones» y «el mapa ese no lo anadas».)*

  Esta en **Comercial**, y ensena los espacios que se estan persiguiendo: donde
  esta cada uno, en que etapa va la **busqueda de quien manda** --desde «sin
  contacto» hasta «responsable legal confirmado»--, con quien se ha hablado y
  cuando, que se le ha ofrecido de renta y quien mas anda detras del mismo
  espacio.

  **Es una MAQUETA y la propia pantalla lo dice arriba.** Los datos son de
  ejemplo, no hay formularios y no se guarda nada: sirve para acordar la forma
  antes de construirla.

  **Y hay algo que conviene decir ahora y no despues:** se parece mucho a
  **Captacion**, que ya funciona de verdad y esta justo encima en el menu. No son
  dos cosas distintas: son la misma con distinto alcance. Esta maqueta anade
  VARIOS contactos por espacio --el dueno, su apoderada, la vecina, el portero--,
  la competencia y el historial de ofertas de renta, que Captacion no tiene.
  Cuando esto se construya de verdad hay que decidir si se hace **encima** de
  Captacion o aparte; aparte significaria llevar la misma bitacora dos veces.
- **La aplicación ya existe en INGLÉS, y se elige sola.** *(Lo pediste el
  30/09: «que la aplicación exista en dos idiomas y que el idioma se elija solo,
  según el del navegador de quien entra».)*

  Quien entre con el navegador en inglés **ve la aplicación en inglés desde el
  primer instante**. No parpadea: no se pinta español y luego salta — sale ya
  en su idioma.

  Y si alguien prefiere el otro, **hay un selector al pie de la pantalla de
  entrar**. En cuanto lo toca, **manda su elección y no la del navegador**, para
  siempre.

  Lo que **ya está traducido de verdad**:

  - **La pantalla de entrar**, entera: los tres modos (entrar, crear cuenta y
    recuperar contraseña), todos los campos, los botones, los avisos y los seis
    mensajes del acceso con Google.
  - **El menú lateral**, que sale en todas las pantallas: las **26 entradas** y
    los **5 encabezados** de grupo.

  Lo que **todavía NO**, dicho de frente para que nadie se lleve una sorpresa:

  - **El resto de las pantallas siguen en español.** Son unas cien, con ~1261
    textos: traducirlas de una sentada no era realista y no se fingió. Queda un
    inventario contado, por áreas, para repartirlo en lotes.
  - **Los mensajes de error que manda el servidor siguen en español.** O sea
    que alguien con la aplicación en inglés verá el formulario en inglés y, si
    algo falla, el aviso en español — justo en el peor momento. Es un trabajo
    aparte y grande (253 mensajes repartidos por 42 archivos), y se hace en su
    propio lote.

  **El dinero no se movió, y se probó que no.** *(Tu confirmación del 30/09: «el
  sistema se rige 100 % en pesos mexicanos por ahora, después lo moveremos».)*
  Cambiar de idioma **solo cambia cómo se escribe un importe**, nunca cuánto
  vale ni en qué moneda está. En inglés, de hecho, queda **más claro**: donde
  en español se lee `$1,234.50` —que un lector en inglés podría tomar por
  dólares— en inglés se lee `MX$1,234.50`, que dice pesos con todas las letras.
  La moneda está escrita **en un solo sitio** del programa, para que el día que
  se mueva sea un cambio y no veinte.

  **Una cosa que hay que decidir, y que apareció al medir:** el programa de hoy
  **no está al 100 % en pesos**. Al capturar un contrato con un arrendador se
  puede elegir **dólares**, y los totales del panel ya saben sumar por moneda
  separada. No se tocó nada de eso, pero o sobra esa opción o hay que
  contemplarla — conviene decidirlo antes de traducir cuarenta pantallas.

  **Dos preguntas más para ti**: si el inglés debe ser **de Estados Unidos o
  británico** (hoy es de EE. UU., por suponer), y si el idioma debe recordarse
  **por persona o por dispositivo** (hoy es por dispositivo: quien elija inglés
  en su computadora seguirá viendo español en su teléfono). Hacerlo por persona
  pide un cambio en la base de datos, y ésos no se hacen sin que los apruebes.

  **Lo que nadie comprobó:** *no se abrió un navegador*. Todo está verificado
  con las pruebas automáticas y con el build, pero **el selector no se pulsó
  nunca en una pantalla real**.


- **Ahora puedes decir en qué horario SE TRANSMITE cada campaña.** *(Tu decisión
  del 30/09: «es para horario transmisión ya que el precio ya debe de estar en la
  campaña después de la propuesta».)* Añade un dato nuevo a las campañas, que
  **aprobaste el 30/09**.

  En **Franjas y temporadas**, debajo del catálogo, aparece **«Horario de
  transmisión»**: junto a cada franja (Prime, Noche…) ves qué campañas salen en
  ella, puedes **marcar varias y programarlas de una vez**, o quitar una con la ×.
  Y en el **detalle de cada campaña** hay un cuadro con el mismo nombre para
  verlo y cambiarlo ahí.

  Lo importante:

  - **No cambia ningún precio.** Lo que se vendió —incluida la franja que se
    cotizó en la propuesta— se queda exactamente como se aceptó. Esto solo dice
    en qué horario tiene que salir.
  - **Si se vendió en una franja y se programa en otra**, el sistema te **avisa**
    («se vendió como Prime y se programa en Noche») pero **te deja guardarlo**,
    como decidiste el 30/09.
  - **O se programan todas o ninguna.** Si en un lote va una campaña que no se
    puede (por ejemplo, de otra organización), no se toca ninguna y te lo dice.
  - **Solo lo pueden hacer el gerente de ventas, el director comercial y la
    dirección** (Dueño y administrador), como decidiste: la franja se fija
    después de crear la campaña. El **vendedor** ve el horario pero no lo
    cambia. Queda registrado en **Actividad**.
  - **Sigue sin llegar sola a la pantalla**: el CMS no recibe horarios, así que
    quien opera la pantalla lo tiene que programar a mano. Se avisa siempre.

  *De paso se corrigió la documentación interna*, que decía que leer las franjas
  pedía el permiso de inventario: desde el 29/09 pide el de **precios**.

- **Si la base de datos se cae, el login ya lo dice con palabras.** *(Aprobado por
  ti el 30/09.)*

  Hasta hoy, si la base de datos no respondía, al pulsar «Entrar» salía un
  mensaje técnico en inglés —«Failed to execute 'json' on 'Response':
  Unexpected end of JSON input»— que no decía qué pasaba ni qué hacer. Ahora la
  pantalla dice: **«El servicio no está disponible en este momento. Intenta de
  nuevo en unos minutos.»** Y si lo que falla es la conexión a internet, lo dice
  también en español.

  Lo mismo se arregló en las otras puertas de acceso que consultan la base:
  entrar con un código de recuperación, comprobar la sesión al abrir la app,
  cerrar sesión y el enlace para restablecer la contraseña. Ninguna devuelve ya
  una respuesta vacía; todas avisan de que el servicio no está disponible, sin
  enseñar detalles internos del servidor.

  **Lo que no cambia:** una contraseña equivocada sigue diciendo «Correo o
  contraseña inválidos», el límite de intentos sigue igual y nadie entra sin
  credenciales válidas.

- **El almacén ya guarda de todo: camionetas, herramientas, pantallas, cámaras…**
  *(Pedido tuyo del 30/09.)*

  Hasta hoy el almacén era solo para equipo de pantallas (pantalla, estructura,
  lona u «otro»). Desde hoy, al **registrar un artículo** eliges entre:
  **vehículo / camioneta, herramienta, pantalla, equipo electrónico, cámara,
  estructura, lona u otro**.

  Arriba de la lista aparecen unas **pastillas por tipo**, cada una con cuántos
  artículos hay («Vehículo / camioneta 3», «Herramienta 12»…). Tocas una y la
  lista enseña solo esos; «Todos» la devuelve completa. Solo aparecen los tipos
  de los que tienes algo.

  Lo de siempre sigue igual: dar de alta, instalar en una pantalla, marcar en
  traslado, regresar a almacén y dar de baja.

  **Y con los datos de cada tipo** (columnas nuevas en la base, aprobadas por ti
  el 30/09): al registrar un artículo, el sistema te
  pide lo que tiene sentido para ese tipo —**placas** solo en vehículos;
  **marca, modelo y número de serie** en herramientas, pantallas, equipo y
  cámaras— y, para todos, **dónde se guarda** («Bodega norte, anaquel 3»). La
  lista enseña esos datos en una columna, y la ubicación cuando el artículo no
  está instalado. Las placas se guardan en mayúsculas y sin espacios, para que
  «abc 12 34» y «ABC1234» sean la misma camioneta.

- **El checklist de una orden de trabajo se guarda solo, cada vez que tachas un
  punto.** *(Pedido tuyo del 30/09.)*

  Hasta hoy, lo que se tachaba en el checklist de una OT **solo vivía en la
  pantalla**: no se guardaba nada hasta pulsar «Cerrar OT». Si la cuadrilla
  recargaba la página, se quedaba sin batería o cerraba el navegador a medio
  trabajo, **perdía todo lo tachado** sin ningún aviso.

  Ahora cada punto se guarda **en el momento** de marcarlo o desmarcarlo. Junto al
  título «Checklist» se ve **«Guardando…»** y luego **«Guardado»**. Si algo falla
  (por ejemplo, sin señal), sale un aviso en rojo que dice que lo tachado **todavía
  no está guardado**, con un botón **«Reintentar»**; y si intentas cerrar la
  pestaña con algo sin guardar, el navegador te pregunta antes. Al volver a abrir
  la OT, ves el avance tal como lo dejaste.

  Lo que **no** cambia: tachar el último punto **no cierra la OT** ni cambia su
  estado. Para cerrarla sigue haciendo falta la foto y la ubicación, como hasta
  ahora. Tampoco toca el costo real de la visita.

  Y solo puede tachar quien puede cerrar órdenes de trabajo (Dueño, Administrador,
  Operaciones). **Finanzas e Imprenta** ven la OT y su avance, pero el checklist
  les aparece **de solo lectura**.

- **En Campañas ya se puede achicar la lista.** *(Pedido tuyo del 30/09.)*

  Cada campaña enseñaba su pipeline completo, y con muchas la pantalla se hacía
  larguísima. Ahora hay tres formas de verla más corta:

  - **«Vista compacta»**, arriba junto al buscador: esconde el pipeline de todas
    y deja cada campaña en una sola fila, con su etapa actual al lado del estado.
    El mismo botón dice «Mostrar pipelines» para volver.
  - **La flecha de cada tarjeta** minimiza solo esa campaña.
  - **El ojo tachado** oculta una campaña de tu lista. Aparece un botón
    **«Mostrar ocultas (N)»** para traerlas de vuelta.

  **Es solo tu vista, en tu navegador.** Ocultar una campaña no la archiva, no la
  cancela y no le cambia nada a nadie más: tus compañeros la siguen viendo igual.
  Y el sistema lo recuerda la próxima vez que entres desde el mismo navegador.

- **En el detalle de una campaña, el menú de la izquierda ya se puede esconder.**
  *(Pedido tuyo del 30/09.)*

  Cuando abres una campaña, a la izquierda sale la lista de tus demás campañas
  para saltar de una a otra. Esa lista **no se podía quitar**: en el celular y la
  tableta salía encima del pipeline y había que bajar mucho para verlo, y en la
  computadora ocupaba siempre una franja del lado.

  Ahora tiene un botón **«Ocultar»** (en la computadora, un icono pequeño arriba
  del menú). Al pulsarlo el menú se recoge y **el pipeline usa todo el ancho**. El
  mismo botón, **«Mostrar»**, lo trae de vuelta. Funciona igual en celular,
  tableta y computadora.

  **Tu navegador lo recuerda**: si lo dejas escondido, la próxima campaña que abras
  ya sale con el menú escondido. Es solo tu vista; no le cambia nada a nadie más.

---

## 2026-09-29

- **Nueva pantalla «Captación»: la bitácora de cómo va cada venta.** *(Pedido tuyo
  del 29/09, diseño aprobado ese día.)*

  En **Comercial → Captación**, cualquier persona de ventas da de alta lo que está
  intentando traer: un **cliente**, un **arrendador**, un **predio** o una **pantalla**.
  Cada vez que avanza, anota qué pasó, en qué etapa va (Prospecto, Contactado,
  Visita, Negociación) y cuál es el siguiente paso y para cuándo. Todo queda en la
  bitácora del prospecto, con fecha y quién lo escribió, **y no se puede borrar ni
  reescribir**.

  Cuando está listo, el vendedor lo **envía a revisión**. El sistema le dice si le
  falta algo (por ejemplo, la dirección de un predio). Un **gerente, director,
  administrador o el Dueño** lo ve en «Por aprobar» y:

  - **lo aprueba**, y entonces el cliente, el arrendador o el predio **se da de alta
    solo** en el sistema, sin volver a capturarlo. Si ya hay uno con el mismo
    nombre, te avisa y te deja confirmar que es otro;
  - o **lo rechaza con un motivo**, que el vendedor lee para corregir y reenviarlo.

  **Cada vendedor ve solo lo suyo**; quien aprueba ve a todo el equipo. Y **nadie
  se aprueba solo**: el vendedor no tiene ese permiso.

  **Lo que todavía no hace** (queda para después del 14/10): subir fotos y
  documentos, convertir una pantalla aprobada en pantalla del inventario —hoy
  queda aprobada y se da de alta desde Inventario—, y el tablero y el reporte por
  vendedor.

- **El administrador ya ve el panel del control de cambios.** *(Decision tuya
  del 29/09.)*

  Hasta hoy ese panel —Administracion → Roles y permisos, el que enciende y
  apaga la contrasena para los cambios que mueven dinero— **solo se le ensenaba
  al Dueno**.

  Y al abrirlo aparecio algo que conviene contar, porque no era lo que
  parecia: **el administrador YA podia apagarlo**. El servidor pedia el permiso
  de «aprobar» sobre Administracion, que el administrador tiene, asi que la
  puerta estaba abierta y lo unico que faltaba era el boton. Una pantalla que
  esconde algo que el servidor permite no lo esta impidiendo: solo hace que no
  se vea quien puede hacerlo.

  Ahora coinciden las dos cosas. **Nadie mas lo ve**: ni finanzas, ni los tres
  perfiles de ventas, ni operaciones.

- **Antes de subir los recibos ahora eliges cuantos meses esperas, y el sistema
  comprueba si el PDF coincide.** *(Decision tuya del 29/09.)*

  En **Consumo de luz**, arriba del boton de subir, hay un selector nuevo:
  **«¿Cuantos meses de calendario cubre cada recibo de esta tanda?»**. El boton de
  subir **no se activa hasta que eliges uno** — y ese orden es el punto: una
  expectativa escrita despues de ver la respuesta no comprueba nada.

  Al subir, cada recibo que **no** coincida con lo que declaraste sale **marcado**,
  con los dos numeros a la vista: «declaraste 2 y este cubre 3». Y el resumen de
  arriba te dice la causa cuando la hay — «los 12 cubren 2 meses de calendario» se
  arregla cambiando el selector, sin mirar doce recibos uno por uno.

  **Manda SIEMPRE el PDF, no lo que declaraste.** Si no coinciden, el recibo se
  reparte igual segun el periodo que dice el papel y **se puede guardar**: lo
  declarado es una expectativa, no una orden. Si mandara lo declarado, un error de
  dedo meteria un recibo bimestral dentro de un solo mes — triplicando el costo de
  ese mes y dejando los otros dos como «falta recibo», sin dar ningun error.

  **Ojo con lo que significa «cuantos meses», porque es lo que mas confunde:** se
  cuentan los meses de calendario que el periodo **toca**, no lo que dura. Medido
  sobre tus 72 recibos:

  - Un recibo **mensual** dura ~31 dias pero empieza a mitad de mes, asi que toca
    **DOS** meses de calendario. **Los 15 mensuales de tu lote, los 15.**
  - Un recibo **bimestral** toca normalmente **TRES**. De los 57 tuyos, 49 tocan 3.

  O sea que quien piense «es mensual, pues 1» veria el aviso en los 15. La pantalla
  lo dice en cada opcion del selector para que no pase.

  **Y si mezclas mensuales y bimestrales en la misma tanda, muchos saldran
  marcados.** Eso no es un fallo: subelos por separado y la pantalla queda limpia.
- **Cuatro perfiles nuevos para el equipo de ventas, y dos candados que protegen
  al Dueno.**
  *(ADR 0040, primer tramo. **Pendiente de tu aprobacion**: lleva un cambio de
  base de datos y desde el 28/09 esos no se aplican sin que tu digas que si.)*

  Hasta hoy, quien vendia entraba como «Comercial» y ese perfil era uno solo para
  todos: el jefe de ventas y el vendedor recien entrado veian y podian
  exactamente lo mismo. Desde hoy hay **cuatro perfiles**:

  - **Administrador** — hace lo mismo que tu: da de alta gente, toca inventario,
    finanzas, operaciones y los datos de la empresa. **Con dos excepciones, y son
    a proposito:** no puede cambiar de organizacion, y **no puede dar de baja ni
    degradar a ningun Dueno** (ver abajo).
  - **Director comercial** — vende, aprueba lo vendido y **define el catalogo de
    precio**: franjas, temporadas, descuentos por volumen, cupones y paquetes.
  - **Gerente de ventas** — hoy puede lo mismo que el director. Las diferencias
    que hablamos —el techo de descuento de cada quien y quien firma lo que se
    pasa de ese techo— **son el tramo siguiente**, no estan construidas todavia.
  - **Vendedor** — cotiza, **aplica** cupones y paquetes, y **NO los crea**. Ni
    siquiera ve esas pantallas. Es la linea que pediste, y esta puesta en el
    servidor: no es que le escondamos el boton, es que el sistema se lo niega
    aunque lo intente por otro camino.

  **El perfil «Comercial» desaparece.** Quien lo tenga **pasa automaticamente a
  Vendedor** —lo decidiste el 29/09— y cualquier usuario nuevo al que no se le
  ponga perfil **nace como Vendedor**. Antes nacia como Comercial; si no lo
  hubieramos cambiado, esa persona habria entrado y **no habria visto ni una sola
  pantalla**, sin que nada le dijera por que.

  **Los dos candados, y el segundo no lo pediste:**

  1. **Un administrador no puede desactivar, cambiar de perfil ni eliminar a un
     Dueno.** Ni por la pantalla ni por ningun otro camino.
  2. **La empresa no puede quedarse sin ningun Dueno activo.** Esto aplica a
     todos, tu incluido: si eres el ultimo Dueno, nadie te puede desactivar hasta
     que nombres a otro. Sin este candado, dos Duenos podian desactivarse el uno
     al otro **a la vez** y dejar la empresa sin nadie que pudiera repartir
     permisos ni cambiar la configuracion — y de ahi no se sale desde la
     aplicacion.

  **Lo que NO entra en este cambio, dicho con todas las letras:** el techo de
  descuento por perfil, la autorizacion al aprobar una propuesta con descuento, y
  los descuentos preaprobados. Son los tramos siguientes.

- **Finanzas ya puede capturar lo que costo cada visita, y nadie mas puede
  nombrar Duenos.**
  *(Mismo dia, tus respuestas de la tarde. **Lleva cambios de base de datos** y
  van con los de arriba.)*

  **Finanzas captura el costo de la orden de trabajo.** La factura de la cuadrilla
  te llega a Finanzas, asi que son ellos quienes saben lo que costo la visita — y
  hasta hoy el sistema les contestaba «no tienes permiso». Ahora pueden **abrir la
  orden y teclear el importe**, y nada mas: **no pueden crear ni cerrar ordenes de
  trabajo**. Eso sigue siendo de Operaciones.

  Lo que si alcanzan de paso, y conviene que lo sepas: con el permiso de ver
  ordenes tambien pueden **consultar** el almacen y los recibos de luz de tu
  empresa. No les aparece en el menu, pero el dato esta a su alcance. Se acepto
  porque separar eso cuesta bastante mas y son consultas de la misma empresa.

  **Nadie puede nombrar a un Dueno salvo un Dueno.** Lo pediste asi: ni cambiandole
  el perfil a alguien ni dandolo de alta ya como Dueno. Aplica a **todos los
  perfiles**, administrador incluido — sin esto, un administrador al que le
  prohibimos tocar a un Dueno podria simplemente **fabricarse uno de confianza** y
  el candado no serviria de nada.

  El alta de una empresa nueva sigue funcionando igual: cuando se instala el
  sistema todavia no hay ningun Dueno que pueda autorizar al primero, asi que ese
  camino esta dejado pasar **a proposito**.

  **El director comercial ya ve Finanzas y los reportes.** Solo VER: no cobra ni
  factura. Es lo que contestaste cuando preguntamos si debia ver el margen —
  aprobar un descuento sin saber cuanto margen queda es firmar a ciegas. El
  gerente de ventas **no** lo ve, y esa es hoy la unica diferencia entre los dos.

- **Ahora puedes capturar lo que de verdad costó cada visita, y el reporte deja
  de estimarlo.**
  *(**Pendiente de tu aprobacion**: lleva un cambio de base de datos y esos no se
  aplican sin que tu digas que si.)*

  **El problema, dicho claro.** Lo que el reporte de rentabilidad llamaba «costo
  de operacion» **no era un costo**: era una **tarifa por tipo de tarea** que tu
  capturas una vez en Configuracion. O sea que **todas las herrerias costaban lo
  mismo**: una de $12,000 y una de $800 entraban al reporte las dos por el mismo
  importe. El margen salia falso en las dos direcciones y nada en la pantalla lo
  decia.

  **Que cambia.** Cada orden de trabajo tiene ahora un campo **«Costo real de
  esta visita»**. Lo capturas cuando lo sepas —muchas veces dias despues, cuando
  la cuadrilla pasa su factura— y **no hace falta esperar a cerrar la orden ni
  volver a abrirla**: tambien se puede capturar en ordenes ya cerradas.

  **Lo mas importante de entender, y la pantalla lo dice:**

  - **El costo que capturas SUSTITUYE a la estimacion por tipo; no se suma a
    ella.** Si la estimacion de una herreria es $1,500 y capturas $12,000, esa
    visita cuesta $12,000 — no $13,500. Las dos cosas miden lo mismo, asi que
    sumarlas seria cobrar dos veces la misma visita.
  - **Dejar el campo vacio NO es cero.** Vacio significa «no lo se todavia», y
    entonces el reporte sigue usando la estimacion. Si de verdad una visita no
    costo nada, escribe **0**: eso es un dato, y el reporte lo respeta.
  - **Puedes borrar un costo capturado** (vaciando el campo) y la visita vuelve a
    la estimacion.
  - **Capturar un costo te pedira tu contraseña** si tienes activado el control
    de cambios, igual que facturar o registrar un pago. Es dinero que cambia el
    margen. **Cerrar una orden con su foto sigue sin pedirla** — eso lo hace la
    cuadrilla en la calle y no se toco.

  **El reporte ahora te dice de donde sale cada peso.** En «Por operacion», encima
  de la tabla, hay un aviso que dice **cuantas visitas van con su costo real y
  cuantas con la estimacion**, con los dos importes por separado. Sin el, un
  total de «$13,500 de operacion» no se puede interpretar: no se sabe si costo
  eso o si se estima que costo eso. **Y este hueco es el unico del reporte que no
  se ve mirando la tabla**: una visita sin capturar no sale con una raya ni con
  un cero, sale con una cifra creible.

  El aviso **sale siempre**, tambien cuando todas las visitas estan capturadas —
  en gris—, porque su primera frase hace falta igual.

  **Y el costo capturado se usa en los TRES sitios donde se ve un margen**, no
  solo en el reporte: tambien en el **tablero de inicio** y en el **margen de
  cada campaña**. Esto importa mas de lo que parece: si el reporte usara el costo
  real y el tablero siguiera con la estimacion, **el mismo mes tendria dos
  margenes distintos** segun donde lo miraras, y ninguno de los dos daria error.

- **La columna «Margen» del reporte pasa a llamarse «Margen bruto».**

  **La cuenta no cambia ni un peso.** Sigue siendo ingreso menos el espacio,
  menos la operacion, menos la luz. Lo que cambia es que ahora se llama por su
  nombre: eso **es** un margen bruto.

  **Y el reporte dice lo que NO es, porque es la confusion que invita.** Margen
  bruto no es margen neto. Al neto le faltarian los **costos indirectos**
  —nomina, oficina, estructura— y **el sistema no captura ninguno**. O sea que el
  neto **no se calcula restandole nada a lo que ves en la tabla**: si algun dia
  lo necesitas, lo que falta son datos que hoy nadie captura, no una columna que
  este escondida en otra pantalla. Esa frase esta escrita en el propio reporte,
  encima de la tabla.
- **Ya se puede SUBIR el PDF del recibo de CFE, y la pantalla propone los datos.**

  Hasta hoy el recibo de luz se tecleaba a mano: predio, mes, medidor, kWh e
  importe. En la pantalla **Consumo de luz**, debajo del formulario de siempre,
  hay ahora un boton **«Subir PDF del recibo»** que admite **varios archivos a la
  vez** (hasta 40 por tanda). El sistema los lee y **te ensena lo que entendio,
  con lo que dice el recibo al lado**, para que lo confirmes renglon por renglon.

  **Nada se guarda al subir.** Es lo mas importante de esta pantalla y es
  deliberado: un recibo mal leido que se guardara solo meteria un costo falso en
  el reporte de rentabilidad, y ahi ya no se distingue de uno bueno. Se guarda
  cuando tu le das a **Guardar** en ese renglon.

  **Tres cosas que conviene saber, porque cambian lo que veias antes:**

  - **Un recibo de CFE casi nunca es de un mes.** De los 72 recibos que nos
    pasaste, **solo UNO** cabe dentro de un mes de calendario: 19 cubren dos
    meses, 49 cubren tres y 3 cubren cuatro. Por eso un recibo puede producir
    **varios renglones**, uno por mes, con el consumo y el importe repartidos por
    los dias que le tocan a cada uno. La suma de los renglones es exactamente el
    recibo, al centavo.

  - **Lo que se captura NO es el «TOTAL A PAGAR» del recibo.** Ese numero lleva
    dentro lo que debias del mes pasado, lo que pagaste y, en 8 de los 72, un
    **deposito en garantia**. En uno de ellos la luz del periodo son $994.64 y el
    total a pagar son $4,309.64: capturar el total multiplicaria por **4.3** el
    costo de ese predio sin que nada diera error. Se captura la **facturacion del
    periodo mas el alumbrado publico**, y el total impreso se te ensena al lado
    marcado como lo que es.

  - **La primera vez de cada servicio eliges tu el predio.** El sistema aprende:
    a partir del segundo recibo de ese mismo numero de servicio, lo empareja solo.
    Con tus 72 recibos eso son 29 elecciones a mano y 43 automaticas. Y si subes
    dos veces el mismo recibo, **te avisa antes de guardar**, con las cifras que
    ya hay capturadas, porque guardarlo otra vez duplicaria el costo de ese mes.

- **El CERO deja de valer como consumo o como importe.** *(Decision tuya del
  29/09.)*

  Antes se podia guardar un recibo con 0 kWh o con importe 0. Ya no: si el dato
  no se puede leer —o si se lee como cero o negativo— **el campo se queda vacio y
  marcado**, y hay que escribirlo a mano. Vale tanto para la subida de PDF como
  para el formulario de siempre.

  El motivo: **un cero no dice «no se», dice «no consumio luz»**, y en el reporte
  de rentabilidad esos dos hechos son el mismo numero. Una vez guardado ya no hay
  forma de distinguirlos.

  **Lo que esto te cuesta, medido:** **10 de los 72 recibos traen los kWh
  impresos en cero** —con importe que no lo es, porque el cargo fijo se cobra
  igual—, en 5 numeros de servicio (TJN Via Rapida Oriente, GDL Plaza Galerias,
  CDMX Cuchilla, CDMX VDQ 2008 y CDMX Rio Consulado 2334). Esos hay que teclearlos
  a mano.

---

## 2026-09-28

- **Paquetes cerrados: «estas cinco pantallas, un mes: $180,000».**
  *(ADR 0039, Fase 4. **Pendiente de tu aprobacion**: lleva un cambio de base de
  datos y desde hoy esos no se aplican sin que tu digas que si.)*

  Hasta hoy el precio de una cotizacion era siempre la suma de sus pantallas, con
  descuentos encima. Si querias vender un conjunto por un precio redondo, lo unico
  posible era calcular a mano que porcentaje de descuento daba ese numero — y el
  documento acababa diciendo «descuento del 28 %», que no es lo que vendiste.

  **Como se captura.** En el menu, dentro de *Inventario*, hay una entrada nueva:
  **«Paquetes cerrados»**. Cada paquete lleva su nombre, **que pantallas lo
  forman** y **cuanto cuesta el conjunto**. Son tuyos: no se comparten con ninguna
  otra empresa. Al capturarlo, la pantalla te ensena **como se repartira ese
  precio entre las pantallas**, antes de guardarlo.

  **Como se usa.** El vendedor abre la cotizacion —con esas mismas pantallas— y
  **elige el paquete de una lista**. Nada mas. El precio sale de lo que tu
  capturaste; el vendedor **no puede escribirlo ni cambiarlo**.

  **Lo que hay que entender, y la pantalla lo dice:**

  - **El precio del paquete SUSTITUYE la suma de las tarifas: no la descuenta, la
    reemplaza.** Si las cinco pantallas suman $250,000 de tarifa y el paquete vale
    $180,000, se cobran $180,000. Y si algun dia vendes un conjunto por MAS de lo
    que suman sus partes, tambien funciona.
  - **Un paquete no admite descuento por volumen**, porque su precio ya lo lleva
    dentro. **Ni codigo promocional**, salvo que marques esa casilla al crearlo —
    nace apagada a proposito. El descuento del vendedor si se sigue aplicando
    encima, con su tope de siempre.
  - **Quitar una pantalla de una cotizacion con paquete NO baja el precio.** Eso
    es lo que «precio cerrado» significa. El sistema **te lo avisa** en la
    cotizacion, con el numero de pantallas de antes y el de ahora, para que
    decidas tu: o ajustas las pantallas, o quitas el paquete, o lo dejas asi.
  - **El precio se reparte entre las pantallas** para que el reporte de
    rentabilidad sepa cuanto ingreso le toca a cada una. El reparto es
    proporcional a su tarifa de lista y **suma exactamente el precio del paquete,
    al peso**.

  **En el reporte de rentabilidad hay un cambio que conviene saber.** La columna
  que compara «tarifa publicada contra lo que de verdad entro» **deja fuera las
  ventas de paquete**, y las cuenta aparte con su explicacion. El motivo: en un
  paquete el precio de cada pantalla no sale de descontar su tarifa, asi que
  compararlos inventaria un descuento que nadie concedio — y en un paquete
  premium daria un descuento negativo, que se leeria como haber cobrado de mas.

  **Lo que queda escrito para siempre.** Al aprobar la cotizacion, el nombre del
  paquete, su precio, **con que pantallas se cotizo** y cuanto le toco a cada una
  quedan **congelados** en el documento. Si manana cambias ese paquete o **lo
  borras**, una venta ya aprobada **no se mueve ni un peso**. Esta probado
  borrandolo de verdad.

  **Y dos decisiones que necesito que confirmes** (estan abajo, en *Preguntas*):
  si el descuento del vendedor debe seguir aplicandose encima de un paquete, y si
  hace falta poder vender «el paquete mas una pantalla suelta» en un mismo
  documento — hoy eso se hace con dos cotizaciones.

  **Lo mas importante: si no capturas ningun paquete, NADA CAMBIA.** Todo se sigue
  vendiendo exactamente igual que ayer.


- **Codigos promocionales: «usa VERANO20 y llevate un 20 % adicional».**
  *(ADR 0039, Fase 3. **Pendiente de tu aprobacion**: lleva un cambio de base de
  datos y desde hoy esos no se aplican sin que tu digas que si.)*

  Hasta hoy no habia forma de hacer una promocion con nombre. Si querias correr
  una campana de fin de ano, lo unico posible era decirle de palabra a cada
  vendedor que diera un 20 % mas — y a partir de ahi nadie sabia cuantas veces se
  habia dado, ni hasta cuando, ni a quien.

  **Como se captura.** En el menu, dentro de *Inventario*, hay una entrada nueva:
  **«Codigos promocionales»**. Cada codigo lleva su descuento, **desde cuando y
  hasta cuando vale**, y **cuantas veces se puede usar en total** (o «sin tope»,
  si prefieres que el unico freno sea la fecha). Son tuyos: no se comparten con
  ninguna otra empresa.

  **Como se usa.** El vendedor abre la cotizacion y **teclea el codigo**. Nada
  mas. El sistema comprueba solo que exista, que este vigente y que le queden
  usos, y decide el el descuento. El vendedor **no puede escribir el porcentaje**,
  ni cambiarlo, ni saltarse la fecha.

  **Lo que hay que entender, y la pantalla lo dice:**

  - **El uso se cuenta cuando se aplica el codigo a una cotizacion, no cuando se
    cierra la venta.** Es lo que permite decirle al cliente «si, tu codigo vale»
    en el momento en que lo teclea, en vez de descubrir al firmar que ya se habia
    acabado. A cambio, una cotizacion abandonada con el codigo puesto retiene un
    uso: quitarle el codigo, o borrarla, lo devuelve.
  - **Se multiplica con los demas descuentos, no se suma.** Un 20 % por volumen,
    un 20 % del vendedor y un 20 % de codigo dejan al cliente pagando el
    **51,2 %**, no el 40 %.
  - **Dos personas no pueden gastar el mismo ultimo uso.** Si dos vendedores
    aplican a la vez el ultimo uso que quedaba, uno entra y al otro le dice que ya
    se acabo. Esta probado con dos peticiones simultaneas de verdad.

  **Lo que queda escrito para siempre.** Al aprobar la cotizacion, el codigo
  usado, su porcentaje y el momento en que se aplico quedan **congelados** en el
  documento. Si manana cambias ese codigo o lo borras, **una venta ya aprobada no
  se mueve ni un peso**. Y un codigo aplicado antes de vencer **sigue valiendo**
  aunque la cotizacion se firme tres dias despues de la fecha limite: lo que
  prometiste, prometido.

  **Y una decision que necesito que confirmes** (esta abajo, en *Preguntas*): hoy
  el codigo promocional **NO cuenta** contra el tope de descuento del vendedor —
  al reves que el descuento por volumen. El motivo es que el codigo **lo creaste
  tu**, desde una pantalla que pide contrasena, mientras que el tope existe para
  acotar lo que el vendedor decide por su cuenta. La consecuencia hay que saberla:
  el descuento total de una venta con codigo **puede pasar de tu tope**.

  **Lo mas importante: si no capturas ningun codigo, NADA CAMBIA.** Todo se sigue
  vendiendo exactamente igual que ayer.

- **Compra 50 spots y paga 40: ya se puede dar descuento por volumen.**
  *(ADR 0039, Fase 2. **Pendiente de tu aprobación**: lleva un cambio de base de
  datos y desde hoy ésos no se aplican sin que tú digas que sí.)*

  Hasta hoy, quien te compraba 500 spots pagaba exactamente lo mismo por spot que
  quien te compraba 10. La única forma de premiarle era que el vendedor le metiera
  un descuento a mano, propuesta por propuesta — y ahí ya no era una política
  tuya, era el criterio de cada quien.

  **Cómo se captura.** En el menú, dentro de *Inventario*, hay una entrada nueva:
  **«Descuentos por volumen»**. Ahí escribes tu escalera, por forma de venta:
  «a partir de 50 spots, 10 %»; «a partir de 200, 15 %». Y cada forma de venta
  tiene la suya, porque **50 spots y 50 meses no son la misma compra**.

  **Lo que hay que entender antes de capturar, y la pantalla lo dice:**

  - **El descuento se aplica a TODO, no solo a lo que pasa del número.** «A partir
    de 50 spots, 10 %» quiere decir que quien compra 50 paga los 50 con el 10 %
    menos. La consecuencia es que **quien compra 49 paga más que quien compra
    50**. Es como funciona cualquier tarifario por volumen, pero conviene saberlo
    al poner los números.
  - **Los descuentos se multiplican, no se suman.** Un 20 % por volumen y un 20 %
    del vendedor dejan al cliente pagando el **64 %**, no el 60 %. Son cuatro
    puntos de diferencia en cada venta.

  **El descuento lo pone el sistema, no el vendedor.** Se calcula solo, a partir
  de la cantidad y de la escalera que tú capturaste. Nadie puede teclearlo ni
  cambiarlo desde la pantalla de la propuesta.

  **Y una decisión que necesito que confirmes** (está abajo, en *Preguntas*): hoy
  el descuento por volumen **cuenta** contra el tope de descuento que pusiste esta
  misma semana. O sea que si tu escalera da 15 % y tu tope es 20 %, al vendedor le
  quedan unos 6 puntos para negociar, no 20. Se hizo así para que el tope siga
  siendo un techo de verdad; si prefieres lo contrario, se cambia en un minuto.

  **Lo más importante: si no capturas nada, NADA CAMBIA.** Todo tu inventario
  sigue vendiéndose exactamente como ayer. Y una propuesta ya aprobada **no se
  mueve nunca**, aunque mañana subas, bajes o borres la escalera entera: el precio
  que aceptó el cliente queda congelado el día que la aprueba.

  **Dónde se ve el descuento.** En el cotizador, mientras armas la propuesta; en
  el detalle de la propuesta; y en la **liga pública** —la que ve el cliente y
  donde la acepta—, como un renglón propio entre el subtotal y el descuento
  comercial, para que la cuenta se pueda seguir con el dedo.

- **Ahora una pantalla puede costar distinto según la hora del día y la época del
  año.** Hasta hoy cada pantalla tenía **un solo precio** por forma de venderla:
  un spot costaba lo mismo a las siete de la mañana que a las tres de la
  madrugada, y lo mismo en febrero que en el Buen Fin. Desde hoy puedes decir que
  el prime cuesta 4 200 y la madrugada 900, y que en diciembre suben las dos.

  **Se declara una sola vez y vale para todo tu inventario.** En el menú, dentro
  de *Inventario*, hay una entrada nueva: **«Franjas y temporadas»**. Ahí escribes
  las franjas de tu día —«Prime, de 06:00 a 10:00»— y las temporadas de tu año
  —«Buen Fin 2026, del 13 al 16 de noviembre»—. No las inventamos nosotros: las
  defines tú, porque el prime de una pantalla en un centro comercial no es el de
  una en carretera.

  **Y después, el precio de cada combinación en la ficha de cada pantalla.** En la
  ficha hay un cuadro nuevo, «Tarifas por franja», al lado del de siempre. Pide la
  contraseña para guardar, exactamente igual que las tarifas de toda la vida: es
  el mismo dinero.

  **Lo más importante: si no capturas nada, NADA CAMBIA.** Todo tu inventario
  sigue vendiéndose hoy igual que ayer, con sus tarifas de siempre. No hay que
  rellenar una tabla enorme para poder seguir cotizando: solo se capturan las
  combinaciones que de verdad cuestan distinto, y lo que no esté escrito se cobra
  con la tarifa de siempre. Si no creas ninguna franja, el selector ni siquiera
  aparece en las propuestas.

  **Al cotizar, cada pantalla lleva su franja.** En el cuadro de nueva propuesta,
  junto a la unidad de venta, hay un selector con «Todo el día» puesto por
  omisión. Si eliges una franja, el precio se ajusta solo y queda anotado qué
  franja se vendió.

  **Y hay un aviso que conviene leer entero, porque es una limitación real.** La
  franja que vendes **es un compromiso comercial: no se envía al reproductor de la
  pantalla.** Quien opere la pantalla tiene que programarla a mano en el CMS. El
  sistema no lo hace, y por eso lo dice en los cuatro sitios donde aparece una
  franja: al configurarlas, al cotizar, en el detalle de la propuesta y dentro de
  la propuesta congelada. Preferimos decirlo cuatro veces que dejar que alguien
  suponga que se programa solo.

  **Una propuesta aprobada no cambia de precio nunca.** Si mañana subes el prime
  de 1 800 a 2 500, las propuestas que ya se aprobaron siguen diciendo 1 800 — y
  siguen diciendo el nombre y el horario que tenía la franja el día que se vendió,
  aunque la renombres o la apagues después. Lo que el cliente aceptó no se
  reescribe.

  **Dos reglas que la pantalla no te deja saltarte, y por qué:** dos franjas no
  pueden pisarse (si «Prime» va de 06:00 a 10:00, no puedes crear otra de 09:00 a
  12:00), y dos temporadas tampoco. No es una manía: si dos precios distintos
  cubrieran las 09:30, el sistema tendría que elegir uno por su cuenta, y eso es
  una decisión tuya, no suya. Dos franjas que *se tocan* —de 06:00 a 10:00 y de
  10:00 a 14:00— sí valen: el final no entra.

  **Una franja que ya se vendió no se borra, se da de baja.** Deja de ofrecerse al
  cotizar y todo lo contratado con ella sigue en pie.

- **Ya puedes ver cuánto vendió cada persona de tu equipo, y cuánto descuento
  concedió.** En Reportes hay una vista nueva, **«Por vendedor»**: una fila por
  persona, con lo que vendió en el periodo, qué parte de tu facturación es eso,
  la tarifa que se publicó, y la diferencia entre las dos.

  **No hay nada que capturar.** Desde hoy, cuando alguien crea una propuesta, el
  sistema anota que fue esa persona. Se toma de su sesión: no hay una casilla que
  rellenar, no se puede elegir a otro y no se puede cambiar después. Una venta no
  se le puede poner a nombre de quien no la hizo.

  **Lo de antes no se puede recuperar, y la pantalla te lo dice.** Hasta hoy el
  sistema no guardaba quién hacía cada propuesta, así que **todas las propuestas
  anteriores a hoy salen en una fila llamada «Sin vendedor»**, con su importe.
  No es un error ni algo que se pueda arreglar capturando: ese dato nunca se
  escribió en ninguna parte. Encima de la tabla hay un aviso que dice cuánto
  dinero es y por qué.

  **A partir de hoy esa fila deja de crecer** por ese motivo. Lo que sí seguirá
  cayendo ahí son las campañas que creas directamente en Comercial, sin pasar por
  una propuesta: ésas no tienen a quién atribuirse, y el aviso las cuenta aparte
  precisamente porque **ésas sí** se arreglan, vendiendo por propuesta.

  **Dónde no verás un cero cuando debería haber una raya.** Si de una venta no se
  puede saber el descuento —porque nació en Comercial, o porque su precio no
  cuadra con lo que se congeló en la propuesta—, la columna sale con **un guion**,
  no con un cero. Un cero diría que esa persona no concedió ningún descuento, y
  eso es una afirmación muy distinta de «no se sabe».

  **Lo que esta vista NO enseña, a propósito:** no hay margen ni costos. La renta
  que le pagas al arrendador y las visitas de mantenimiento no las decide el
  vendedor, así que un «margen de fulano» mediría a una persona por el precio de
  un contrato que no negoció. Para eso está la vista «Por pantalla».

  **Y quien pueda crear propuestas no pasa a poder ver esto.** Sigue siendo un
  reporte de dinero: hace falta permiso de finanzas, igual que los demás.

- **Ya puedes poner las tarifas de spoteo desde la ficha de la pantalla. Hasta hoy
  había que subir un archivo.** Abres una pantalla en Comercial, y en el bloque
  «Tarifas por unidad» tienes un **Editar**: ahí añades una unidad con su precio
  —mensual, catorcenal, semanal, diaria, **spot**, hora o programático—, le cambias
  el precio a una que ya tengas, o dejas de venderla por esa unidad.

  **Por qué importa:** para cotizar «50 spots» en una propuesta, la pantalla
  necesita tener una tarifa de spot. Poner esa tarifa era, literalmente, preparar
  un CSV e importarlo. Ahora es abrir la ficha.

  **Lo que el sistema no te deja hacer, y es a propósito:**

  - Una pantalla **fija** (una lona, un espectacular) solo se puede vender por
    **mensual o catorcenal**. No tiene loop, así que no hay spot ni hora que
    vender. Es la misma regla que ya aplicaba el archivo de carga: si el archivo
    lo rechaza, la ficha también.
  - No puedes poner **dos precios a la misma unidad**. Si lo intentas, te lo dice
    y no guarda nada.
  - **Quitar una unidad no es ponerle cero.** Un cero significa «se regala» y la
    pantalla se seguiría ofreciendo así; para dejar de venderla por esa unidad,
    se quita.

  **Y pide la contraseña, como cualquier otro precio.** Una tarifa por unidad es
  dinero igual que la tarifa publicada, así que pasa por el mismo control de
  cambios — y el campo para escribirla está **dentro del mismo cuadro**, sin
  rodeos. (Si tu organización tiene el control de cambios apagado, no te pedirá
  nada, igual que hoy.)

  **Y solo te toca lo que cambiaste**: si otra persona está editando otra unidad
  de la misma pantalla, no se pisan.

- **Creativos ya está en el menú de Comercial, no en el de Operaciones.** Un dueño
  preguntó si se podían programar las pautas desde el módulo de ventas y la
  respuesta era «no» — no porque faltara la pantalla, que existía y funcionaba,
  sino porque colgaba del encabezado equivocado y nadie enlazaba a ella desde
  Propuestas ni desde Comercial.

  **No cambia quién puede entrar** (los mismos de siempre: Dueño y Comercial) ni
  lo que hace la pantalla. Solo cambia dónde está el enlace. Desde la ficha de una
  campaña se sigue llegando igual que antes.
- **En Reportes hay una vista nueva: «Publicada vs neta».** Contesta de una vez
  la pregunta de cuánto separa la tarifa que publicas de lo que de verdad entra.
  Por pantalla, en el periodo que elijas, y con cuatro columnas: **Tarifa
  publicada**, **Neto comparable**, **Descuento y comisión** y **% sobre
  publicada**.

  **Nada de esto se captura: ya estaba escrito.** Cuando un cliente acepta una
  propuesta, el sistema congela la economía exacta de ese día —la tarifa de lista
  y el neto de cada pantalla— y no se puede reescribir. Eso llevaba desde julio
  guardado y no había dónde mirarlo.

  **Dos cosas que conviene saber antes de enseñarla, porque son las que evitan
  leerla mal:**

  - **Se llama «Descuento y comisión», no «Descuento».** Lo que separa la tarifa
    publicada de lo que entra son **dos** cosas: la rebaja que concediste **y** la
    comisión de la agencia. El dato las guarda juntas por pantalla, así que la
    columna las nombra juntas. Llamarla «descuento» a secas haría parecer regalo
    lo que es comisión.
  - **Lo vendido desde Comercial sale con una raya, no con un cero.** Una venta
    hecha directamente desde Comercial no pasó por una propuesta, así que nunca
    tuvo tarifa publicada que congelar: no hay con qué compararla. Un cero ahí se
    leería como «se regaló la tarifa entera», y eso sería falso. **Encima de la
    tabla se dice cuántas ventas están en ese caso y cuánto dinero suman**, para
    que la raya se entienda a la primera.

  Los cuatro indicadores grandes de arriba **no cambian** al elegir esta vista:
  son el mismo periodo y el mismo dinero, se agrupe como se agrupe.

- **Y ahora se ve QUÉ se vendió, no solo cuánto.** Si vendes **50 spots**, el 50
  se ve.

  Hasta hoy el dato existía y no aparecía en ninguna pantalla posterior: el
  detalle de la propuesta enseñaba sitio, renta y precio, y la ficha de campaña
  ponía «/mes» debajo de **toda** reserva —también de las vendidas por spot—.

  - En el **detalle de la propuesta** hay una columna **Contratación** que dice la
    cuenta completa: «**50 spots × $ 1,200.00**» al lado del importe.
  - En la **ficha de la campaña**, cada pantalla dice «**50 spots · $ 54,000.00**»
    en vez de un importe con «/mes» pegado.
  - Y si se capturó la frecuencia, debajo sale «**12 pases al día**».

  **Se dice «pases al día» a propósito, y no «spots».** Son dos números
  distintos: los **50 spots** son lo que se cobra, y los **12 pases** son cuántas
  veces al día sale la pieza. Llamarlos igual ya causó un problema real en
  agosto, y con dos nombres distintos no se pueden volver a confundir.

  Lo que **no** cambia: **la factura sigue siendo un importe único sin
  conceptos**. Eso es otro trabajo.

  Y para que conste: **ningún precio se calcula ni se guarda distinto que ayer**.
  Todo esto es leer y enseñar lo que ya estaba.
- **Ya se puede poner un tope al descuento que tu equipo aplica en una propuesta.**
  Hasta hoy no había ninguno: cualquiera con permiso de Comercial podía teclear un
  **90 %** y guardarlo sin que nada lo frenara y **sin que la aplicación le pidiera
  la contraseña**. Visto de cerca era raro: cambiar la renta de una pantalla sí la
  pedía; regalar el 80 % de una venta, no.

  **Cómo funciona.** En **Administración → Configuración** hay una tarjeta nueva,
  *Tope de descuento comercial*, con un número. Por encima de ese número **la
  propuesta no se guarda**, y quien vende ve un aviso que dice cuál es el tope —no
  un «valor inválido» que no ayuda a nadie—. El tope es **de tu organización**: el
  de una empresa no afecta a ninguna otra.

  **Nada cambia hasta que tú lo cambies.** El tope nace en **100 %**, que es lo
  mismo que no tener tope, o sea exactamente como funcionaba ayer. **Ninguna
  propuesta existente se vuelve inválida**, tenga el descuento que tenga.

  **Y lo que ya está pactado no se toca.** Si mañana bajas el tope al 10 %, las
  propuestas que ya tienen un 40 % **conservan su 40 %** y se pueden seguir
  editando; lo que ya no se puede es volver a teclear ese 40 en una propuesta
  nueva. El tope manda sobre lo que se escribe de hoy en adelante, no sobre lo que
  alguien ya negoció.

  **Quién puede cambiarlo.** Solo quien administra la organización —un vendedor
  **no** puede subirse su propio techo—, y **pidiendo la contraseña**, igual que
  ya se pide para tocar una renta o registrar un pago. Es el único campo de esa
  pantalla que la pide: el resto (loop, IVA, plazos…) se guarda como siempre. El
  motivo es simple: si el tope se pudiera quitar con un clic, no sería un tope.

- **Actividad ya dice cuánto descuento se puso, y quién.** Antes, al guardar una
  propuesta la bitácora anotaba «Actualizó propuesta (v2)» y ahí se acababa: el
  descuento no aparecía por ningún lado. Ahora dice **«Fulana puso 22 % de
  descuento en la propuesta X»**, así que filtrando Actividad por persona se ve de
  un vistazo quién está descontando y cuánto.

  Solo lo anota **cuando el descuento cambió de verdad**: si guardas un cambio de
  nombre o de notas, la línea es la de siempre. Y bajar el descuento a cero se lee
  como lo que es, «Quitó el descuento».

  **No es un reporte por vendedor** —ese dato no existe todavía en el sistema—,
  pero es el registro de quién movió el precio, que hasta hoy no quedaba en
  ninguna parte.

---

## 2026-09-25

- **Y con esto ya no queda ningún sitio de la aplicación que te pida la contraseña
  sin darte dónde escribirla.** Entran los ocho que faltaban: en **Inventario**,
  editar la renta, la tarifa o el arrendador de una fila, y los dos **cambios
  masivos** (aplicar una tarifa o una renta a varias pantallas de golpe); el **alta
  de contrato**; y desde **Comercial**, **editar** o **eliminar** una pantalla.

  **Antes de eso hay algo que conviene saber, porque era peor de lo que creíamos.**
  En cuatro de esos sitios el problema no era que el aviso se perdiera: es que **la
  pantalla decía que había guardado cuando no había guardado nada**. Cambiabas una
  tarifa, salía «Tarifa actualizada», y la tarifa seguía igual. Eliminabas una
  pantalla, el cuadro se cerraba, y la pantalla seguía ahí. **Eso ya no puede
  pasar:** si el servidor no lo aceptó, lo dice.

  **Lo nuevo y lo que más costó decidir: los cambios masivos.** Aplicar una tarifa a
  doce pantallas no es una acción, son doce. Así quedó:

  - **No se te pide la contraseña por adelantado.** Se intenta el cambio y solo si el
    servidor la pide, se abre el cuadro. Como las doce salen a la vez, el servidor las
    frena **todas juntas**: no se cambia ninguna a medias.
  - **Si por lo que sea unas sí pasaron y otras no, se te dice con número** —«Se
    aplicó en 2 de 3 pantallas; 1 sin cambiar»— y el cuadro te avisa de que
    **confirmar aplica solo las que faltan**. Las que ya cambiaron **no se vuelven a
    tocar**. Lo que no puede pasar, y era lo que pasaba, es que media lista cambie y
    nadie diga nada.
  - Si cancelas, no se manda nada más.

  Como siempre: esto **no cambia quién puede hacer cada cosa ni cuándo se pide la
  contraseña** —eso lo decide el servidor y sigue igual— y **el camino de antes sigue
  funcionando**: desbloquear desde «Cambios bloqueados» te ahorra teclearla cada vez.

- **Facturar, cobrar, pagar una renta desde la lista y renovar un contrato ya te piden
  la contraseña donde estás.** Eran los cuatro sitios que quedaban con el problema de
  arriba y más se notan: tres de ellos mueven dinero.

  **Lo nuevo aquí, y es lo que costó decidir:** los cuadros que se arreglaron esta
  mañana tenían un sitio evidente donde poner la casilla de la contraseña. **«Registrar
  pago» de la lista de rentas y «Renovar» no son cuadros: son botones de un solo clic.**
  La solución es que, cuando hace falta la contraseña, **se abre un cuadro pequeño para
  teclearla**, y lo que confirmas ahí es exactamente la acción que habías pulsado — ni
  otra, ni una parecida. Si lo cancelas, no se manda nada.

  **«Emitir factura» y «Registrar pago» de una cobranza** sí tenían cuadro, así que la
  casilla va **dentro**, debajo de lo que estás a punto de confirmar, y **no pierdes
  nada de lo que ya elegiste** (el plazo, la sociedad que emite, las parcialidades, el
  importe del abono). Mientras tecleas la contraseña esos datos quedan en solo lectura,
  a propósito: lo que se confirma tiene que ser lo mismo que se pidió.

  **Y «Renovar» tenía un segundo problema, peor que el del candado: no decía nada de
  nada.** Pulsabas y no pasaba absolutamente nada — ni aviso, ni error. No era solo con
  el candado: **cualquier** fallo de ese botón era invisible. Ahora se ve siempre.

  Como siempre: esto **no cambia quién puede hacer cada cosa ni cuándo se pide la
  contraseña** —eso lo decide el servidor y sigue igual—, y **el camino de antes sigue
  funcionando**: desbloquear desde «Cambios bloqueados» antes de empezar te ahorra
  teclearla cada vez.

  ~~**Lo que sigue pendiente:** la tabla de **Inventario** (editar renta, tarifa o
  arrendador), el **alta de contrato** y **editar o eliminar una pantalla** desde
  Comercial. Ahí sigue haciendo falta desbloquear antes desde la barra superior. Están
  anotadas y se decidirán aparte.~~ — **ya no queda pendiente: se cerraron esa misma
  noche.** Ver la entrada de arriba.

- **Y los otros dos cuadros de esa misma ficha: completar un contrato y registrar el
  pago de una renta.** Tenían el mismo problema que el de arriba —te pedían la
  contraseña y no te daban dónde escribirla— y ya la piden en el sitio.

  **«Completar información»**, el formulario de un contrato al que le faltan datos, se
  quedaba con los cuatro campos capturados y un aviso en rojo. Si ibas a desbloquear por
  la barra superior, al volver había que **teclearlo todo otra vez**. Ahora el campo de
  la contraseña sale debajo del formulario y lo que ya escribiste se queda donde está.

  **«Registrar pago»**, el cuadro con el que se sella el pago de una renta al
  arrendador, era el peor de los tres, y por un motivo que no tiene que ver con la
  contraseña: el aviso salía como una **notificación flotante de las que se desvanecen
  solas**. O sea que la única frase que te explicaba qué hacer se iba de la pantalla en
  unos segundos y el cuadro se quedaba abierto sin decir nada. Ahora el mensaje **se
  queda dentro del cuadro**, junto al campo, mientras el cuadro siga abierto.

  Como antes: esto **no cambia quién puede registrar un pago ni cuándo se pide la
  contraseña** —eso lo decide el servidor y sigue exactamente igual—, y **el camino de
  siempre sigue funcionando**: si desbloqueas desde «Cambios bloqueados» antes de
  empezar, no te la vuelve a pedir en un rato.

  **Lo que sigue pendiente, y conviene saberlo:** hay otras pantallas que cambian cosas
  con candado y todavía no saben pedirte la contraseña. Las tres que más importan son el
  botón de **registrar un pago de renta desde la lista** (el de un solo clic, sin abrir
  el cuadro), **emitir una factura** y **registrar el cobro de una factura**. Ahí sigue
  haciendo falta desbloquear antes desde la barra superior. Están anotadas y se
  decidirán aparte.

- **Ya puedes decir con qué sociedad se paga una renta sin dar tres vueltas.** En la
  ficha de un contrato de arrendamiento, el cuadro **«Con cuál de tus razones sociales
  se paga»** te avisaba de que hacía falta tu contraseña para confirmar el cambio… y no
  te ponía ningún lugar donde escribirla. El botón de guardar no llevaba a ninguna
  parte.

  Para salir del paso había que cerrar la ficha, ir a **«Cambios bloqueados»** arriba a
  la derecha, desbloquear ahí, volver a abrir el contrato y elegir la razón social otra
  vez. El manual llegó a describir esa vuelta como si fuera lo normal.

  Ahora el cuadro **te pide la contraseña en el sitio**: la tecleas debajo del selector,
  pulsas «Confirmar y guardar» y listo, sin perder lo que ya habías elegido. **El camino
  de antes sigue funcionando** — si vas a asignar varias seguidas, desbloquear desde la
  barra superior te ahorra teclearla cada vez.

  Esto **no cambia quién puede hacer el cambio ni cuándo se pide la contraseña**: eso lo
  decide el servidor y sigue igual. Lo único que faltaba era la casilla donde escribirla.

  Dos cuadros de esa misma ficha siguen con el mismo problema —«Completar información» y
  el de registrar un pago de renta— y quedan pendientes.

- **El manual de usuario ya lleva una foto de cada paso.** Son 45 capturas
  tomadas siguiendo el manual paso a paso contra la aplicación de verdad, y
  van debajo del paso que ilustran, no en un anexo al final.

  Fotografiarlo sirvió para algo más que ilustrarlo: **aparecieron siete cosas
  que el manual decía mal** y que nadie había notado leyéndolo — dónde te deja
  el cuestionario de bienvenida, cómo se llama de verdad el botón de emitir una
  factura y dónde vive, y cuatro más. Cinco se corrigieron en el texto y dos
  eran defectos de la aplicación, que se arreglaron.

  Queda **un paso sin foto** (guardar los códigos de recuperación la primera
  vez): exige una sesión iniciada con Google y falsearla habría sido fingir la
  captura. Está dicho en el propio manual.

## 2026-09-24

- **Dar de alta una pantalla ahora exige decir dónde está.** Hasta hoy, si
  dejabas la latitud y la longitud en blanco en el alta manual, la pantalla no
  se quedaba sin ubicación: se guardaba **en el Zócalo**, sin avisar y sin
  quedar marcada como pendiente. Después era imposible distinguirla de una
  pantalla que de verdad está ahí. Ahora los dos campos son obligatorios y el
  botón de guardar lo dice.

  **La carga masiva por Excel/CSV no cambia**, y es a propósito: esos archivos
  casi nunca traen coordenadas, así que se sigue poniendo una por omisión pero
  la fila queda **marcada como pendiente de verificación**, que es lo que
  permite encontrarla después. Dando de alta una sola pantalla tienes la
  dirección delante; cargando cien, no.

  También se corrigieron los datos de ejemplo que se usan en las
  demostraciones: sus seis pantallas no tenían ubicación y por eso no salían en
  el mapa.

- **El mapa se iba al océano cuando faltaban coordenadas.** Una pantalla a la
  que nadie le capturó la ubicación no se quedaba fuera del mapa: se dibujaba
  en el punto cero del planeta, que está en el mar frente a África. Y como el
  mapa se acomoda solo para enseñar la zona donde tienes más pantallas, se
  llevaba el encuadre al Atlántico. El resultado era un mapa que parecía
  averiado, cuando lo que faltaba era un dato.

  Pasaba igual en todas las instalaciones, porque todas corren el mismo
  programa. Ahora una pantalla sin ubicación simplemente no se pinta, y el mapa
  **lo dice**: abajo a la izquierda aparece cuántas pantallas se quedaron fuera
  por no tener ubicación capturada. Así se ve el hueco y se puede rellenar.

  **Ojo con lo que esto NO arregla:** que aparezcan los puntos depende de
  capturar las coordenadas, y eso es trabajo de datos en cada instalación. Lo
  que se arregló es que el programa deje de inventarse una ubicación que nadie
  dio.

- **Un ticket cerrado ya no se puede volver a tocar.** Hasta hoy, un ticket
  marcado como `CERRADO` seguía admitiendo respuesta nueva y cambio de estado
  desde nuestro panel, igual que uno abierto — y si se puede seguir escribiendo
  en algo cerrado, estar cerrado no significa nada. Ahora la instancia lo
  rechaza, y nuestro panel ni siquiera ofrece el recuadro para escribir: en su
  lugar dice que está cerrado, para que se vea que es una decisión y no un
  fallo de la pantalla.

  **`RESUELTO` sí se sigue pudiendo tocar, a propósito.** «Resuelto» es lo que
  nosotros creemos; si vuelves con un «pues sigue pasando», tenemos que poder
  contestarte otra vez. El único estado que cierra la conversación es
  `CERRADO`. Reabrir uno cerrado no se puede hoy por ninguna vía.

- **La tarjeta «Actualizaciones» ya escribe con acentos.** Decía «todavia»,
  «version», «Con aprobacion», «Automatica», «Instalacion aprobada»… Era la única
  pantalla del sistema escrita así. No cambia nada de lo que hace la tarjeta: solo
  cómo se lee. Se vio al fotografiar el manual de usuario.

- **Al cambiar quién paga un contrato, la ficha lo enseña en el momento.** Antes
  salía «Razón social asignada al contrato» y la ficha seguía diciendo «Sin
  asignar» hasta que la cerrabas y la volvías a abrir. El cambio sí se guardaba:
  lo que no se refrescaba era la ficha abierta.

---

## 2026-09-23

- **Ahora puedes escribirnos desde la aplicación, y ver nuestra respuesta ahí
  mismo.** Hay una pantalla nueva en Administración para abrir un ticket de
  soporte: un asunto, una descripción y una prioridad. Nosotros (AS OOH) lo
  vemos desde nuestro propio panel, y cuando lo contestamos, la respuesta
  aparece en tu misma pantalla, con la fecha en que se contestó. Cada ticket
  recibe un folio propio (`TK-2026-0001`, por ejemplo), igual que una
  propuesta o una orden de compra.

  **Dos cosas que conviene saber de esta primera versión:** solo quien puede
  entrar a Administración puede abrir un ticket — alguien que solo tiene
  acceso a Operaciones o Comercial, por ejemplo, no ve esa pantalla ni puede
  reportar un problema por ahí, y tendría que pedírselo a quien sí entra. Y
  nadie recibe un aviso cuando escribes uno: nosotros tenemos que abrir
  nuestro panel para enterarnos, no hay notificación automática todavía.

  Esto no llega a ninguna instancia de cliente hasta que se publique una
  versión nueva y una persona decida instalarla — no pasa solo.

- **Y se corrigieron cuatro fallos de esa misma pantalla, antes de que llegara
  a nadie.** La revisión final los encontró, y ninguno se veía usando la
  aplicación en esta máquina:

  - **La pantalla desde la que te contestamos no habría abierto en el servidor
    de verdad.** Funcionaba aquí y habría dado «no existe» allá, que es la peor
    forma de descubrirlo: el día que alguien nos escribiera, no habríamos
    podido ni leerlo.
  - **La fecha de nuestra respuesta podía salir falsa.** Si después de
    contestarte marcábamos el ticket como resuelto, la fecha de la respuesta se
    volvía a poner al día de hoy: habrías visto «respondido el 25» para algo
    escrito el 22. La respuesta y la fecha ahora solo cambian si de verdad
    escribimos algo nuevo.
  - **Los tickets podrían no haberse podido leer en una instancia recién
    instalada**, por un permiso que faltaba en la base de datos. No daba ningún
    error que apuntara a la causa.
  - **Y cuando algo fallara, el aviso decía otra cosa.** El panel habría
    culpado a una parte del sistema que funciona bien, y alguien habría perdido
    la tarde buscando una avería que no existe.

  También se añadió el enlace que faltaba: hasta hoy había que saberse la
  dirección de memoria para llegar a esa pantalla.

## 2026-09-22

- **La demostración ya corre la versión nueva, y por primera vez decide si la
  toma.** Se publicó la versión `v0.6.0` y la instancia de demostración la
  instaló: con ella llega la tarjeta de **Actualizaciones** en Administración →
  Configuración. A partir de la siguiente versión, esa instancia **no instalará
  nada sin que alguien lo apruebe** desde esa pantalla — es el modo con el que
  nace, y se puede cambiar a automática cuando se quiera.

- **Y se corrigió un aviso falso que aparecía justo al estrenarla.** Al instalar
  la versión que crea esta función, la pantalla decía que había una versión nueva
  esperando cuando en realidad ya estaba instalada. Pasa solo la primera vez, en
  cada instancia, y mientras dure alguien podría aprobar algo que no iba a
  instalarse nunca. Se corrigió a mano en la demostración **y, el mismo día, en
  el programa que actualiza las instancias**: ahora, al terminar de instalar, la
  instancia anota sola qué versión quedó funcionando aunque la tarjeta de
  Actualizaciones acabe de nacer en esa misma instalación. Ninguna instancia
  volverá a estrenar la pantalla con ese aviso falso, y las que todavía no
  tienen la función siguen actualizándose exactamente igual que antes.

## 2026-09-21

- **El Dueño ya puede ver y decidir si esta instancia toma la versión nueva.**
  Nueva tarjeta **Actualizaciones** en Administración → Configuración: dice qué
  versión corre, qué hay disponible, cuántas migraciones traería y desde cuándo
  se comprobó. Hay dos modos — **con aprobación** (el Dueño decide cuándo, y
  nace así por omisión) o **automática** (se instala sola de madrugada en
  cuanto se publica). Instalar corta el servicio y migra la base, así que pide
  confirmación explícita, con el número de migraciones y el aviso del corte por
  delante. Si el Dueño aprobó una versión y mientras tanto salió otra, la
  pantalla no lo deja pensando que "ya aprobó, tranquilo": avisa que hay una más
  nueva.

  *Repasado el 22/09, antes de que esto salga a ninguna instancia, y se le
  corrigieron dos cosas que decían de más:* la tarjeta daba el mensaje verde de
  "Al día" también cuando el actualizador **no había podido leer la versión de la
  imagen** — o sea, tranquilizaba justo cuando había que mirar; ahora eso sale en
  ámbar y dice qué pasa. Y el aviso previo a instalar decía "No trae migraciones
  pendientes" tanto si eran cero como si **no se habían podido contar**; ahora
  distingue las dos cosas, porque ese aviso es el que va justo antes de un corte
  de servicio.
- **Borrar un recibo de luz ahora pregunta antes, y dice qué se va a borrar.**
  Hasta hoy el icono de la papelera borraba al primer clic, sin preguntar nada
  — y el manual de usuario decía lo contrario. Ahora sale un aviso que nombra
  el medidor, el mes y el importe, y explica lo que de verdad pasa al borrarlo:
  ese mes vuelve a contar como un hueco, y mientras lo sea el reporte de
  rentabilidad enseña un costo de luz **menor** del real. Importa porque el
  sistema no deja capturar dos veces el mismo recibo: si lo borras por error,
  hay que teclearlo otra vez.

- **Y si no tienes permiso para borrarlo, ya no desaparece la tabla entera.**
  Quien trabaja en Operaciones puede capturar recibos pero no borrarlos. Al
  intentarlo, la pantalla se quedaba en blanco con un mensaje que decía
  «No se pudo cargar la captura» — que era falso, porque sí había cargado: lo
  que falló fue el borrado. Ahora el aviso sale junto a la tabla, la tabla
  sigue ahí, y dice lo que de verdad pasó.

- **El control de cambios ya admite una contraseña de equipo, aparte de la de
  cada persona.** Cuando el Dueño activa el control de cambios (Administración →
  Roles y permisos), los cambios que mueven dinero o catálogo piden una
  contraseña para confirmar. Antes solo servía la contraseña de acceso de quien
  hace el cambio; ahora el Dueño puede además **asignar una contraseña propia del
  control de cambios**, distinta de la de acceso de nadie, y cualquiera de las dos
  desbloquea. La única excepción: **restablecer la contraseña de otra persona**
  sigue pidiendo siempre la contraseña de acceso de quien lo hace — la de equipo
  no sirve para eso, a propósito.

- **Ya se puede fijar el costo de mano de obra por tipo de orden de trabajo desde
  Administración.** El costo que usan el dashboard y los reportes de rentabilidad
  para calcular el margen de una OT (montaje de lona, herrería, mantenimiento…) ya
  se podía guardar por API desde hace unos días, pero solo con una petición a mano:
  no había ninguna pantalla. Ahora hay una tarjeta nueva en **Administración →
  Configuración**, con un campo por tipo de tarea. Dejar un campo vacío no borra
  nada: quita ese tipo y vuelve a usar el valor de respaldo (el mismo que aplicaba
  a todas las OT antes de esta tarjeta).

## 2026-09-18

- **Nuevo reporte: por razón social.** En Reportes, «Agrupar» tiene una sexta
  opción: **Por razón social**. Una fila por cada una de tus razones sociales, con
  lo que facturó y la renta que paga. Es la respuesta a «¿cuánto pasa por cada una
  de mis sociedades?», y hasta hoy el dato estaba capturado sin ningún sitio donde
  mirarlo. Las sociedades que no mueven dinero **también salen, en cero**: que una
  aparezca sin nada es información, no un hueco. Y lo que no tiene dueño en el dato
  sale en una fila **«Sin asignar»**, que se queda siempre al final porque no es una
  de tus sociedades: es algo por capturar.

- **Y este reporte dice lo que NO sabe, que es lo importante.** La operación y la
  luz **no se reparten** entre razones sociales, porque no hay ningún dato que diga
  a nombre de quién se paga una visita o un recibo de luz. Así que la tabla **no
  muestra margen** — lo diría mejor de lo que es— y en su lugar muestra el **saldo
  atribuido**, con ese nombre para que no se confunda. Encima de la tabla, en
  ámbar, dice cuánto dinero es lo que no se reparte y cuántos contratos o
  comprobantes les falta la razón social. Las cuatro cifras grandes de arriba
  siguen siendo las del negocio completo, idénticas a las de los otros reportes:
  cambiar de agrupador no cambia el total.

- **La presentación del 14 de octubre se recorrió entera y se cronometró.** No es
  un cambio en el sistema: es una comprobación. Se abrieron las seis pantallas
  del recorrido una por una y **se compararon todas las cifras, celda por celda,
  contra las que el guion tiene escritas**. Coinciden todas. Lo que tarda la
  máquina en poner un número en pantalla va de **0.13 a 0.72 segundos**, y la
  más lenta es la primera, porque es la que carga el programa; a partir de ahí
  todas bajan a la mitad. También se ensayó de principio a fin el borrado y la
  vuelta a sembrar de las razones sociales —lo que hace falta para poder enseñar
  el cuestionario de bienvenida en vivo—: **tarda menos de dos segundos y deja la
  base exactamente como estaba**, contado dato por dato antes y después.

- **Y encontró tres cosas que no se veían leyendo el guion.** Primera: la tabla
  del reporte abre con las pantallas que peor van arriba, que es lo correcto para
  trabajar, pero deja separadas las dos que la presentación compara — se juntan
  con **un clic** en el encabezado, y ese clic ahora está escrito en el guion como
  un paso más. Segunda: el guion mandaba señalar una columna de «visitas» en la
  vista por trimestre, **y esa columna no existe ahí**; el dato era cierto, pero
  no estaba en la pantalla, así que la frase ahora usa el costo de operación, que
  sí está y sube un 30 % en el año. Tercera: el programa puede estar sirviendo una
  versión vieja **con la pantalla viéndose perfecta**, así que la comprobación de
  antes de empezar dejó de ser «mirar si se ve bien» y pasó a ser comparar dos
  códigos de versión, que tarda un minuto.

- **El costo de un periodo pasado ya no miente.** El reporte de rentabilidad
  calculaba el costo de la renta con **el contrato vigente hoy**. Eso hacía dos
  cosas mal en cualquier reporte de un trimestre ya cerrado: no veía el contrato
  que se pagaba entonces —la pantalla salía sin costo, o no salía— y aplicaba la
  renta de hoy hacia atrás, como si el precio hubiera sido siempre el actual. En
  el ejemplo con el que se probó, el reporte **escondía 48 000 pesos de renta
  realmente pagada, sin dar ningún aviso**. Ahora cuenta el contrato que cubría
  las fechas que se piden, aunque ya haya vencido, y si hubo cambio de arrendador
  a mitad de mes cobra cada parte del mes a su precio.

- **Nueva pantalla: Reportes de rentabilidad.** En el menú, dentro del bloque de
  Finanzas, aparece **Reportes**: qué ingresa y qué cuesta cada pantalla en el
  periodo que elijas. Se abre con el trimestre en curso y trae cuatro controles
  —cómo agrupar, desde cuándo, hasta cuándo, y si los periodos son meses o
  trimestres—. Arriba, cuatro cifras grandes pensadas para leerse de lejos en un
  proyector; abajo, una tabla que se ordena con un clic en cualquier encabezado,
  con las pantallas que **peor** van primero, porque la pregunta que importa es
  cuáles están perdiendo dinero. La pantalla dice lo que **no** sabe en vez de
  esconderlo: si una pantalla no tiene contrato vigente, su costo de espacio sale
  en cero porque falta el dato, no porque sea gratis, y eso se avisa encima de la
  tabla. **Lo ven el Dueño y el rol de Finanzas**: es información de dinero.

- **Las cinco formas de mirar el reporte ya funcionan.** Además de **por
  pantalla**, ahora calculan **por trimestre**, para ver cómo evoluciona el
  negocio en el tiempo; **por operación**, que cruza las visitas de mantenimiento
  con el dinero que produce cada pantalla —es el reporte que contesta «han tenido
  las mismas campañas, pero a una van a cada rato a arreglarla», con cuántas
  visitas, de qué tipo y cuántas horas reales—; y **por metro cuadrado**, que
  compara el rendimiento de las estáticas. Esta última **deja fuera a propósito
  las pantallas digitales** (se venden por spots, no por metros) y las estáticas
  sin ancho o alto capturados, **y dice cuántas dejó fuera y por qué**, para que
  nadie lea la tabla creyendo que está el inventario completo. Y **el metro
  cuadrado suma todas las caras**: una pantalla de dos caras de 3 × 6 cuenta
  36 m², no 18, porque es la superficie que de verdad se vende. El reporte lo
  dice en pantalla, para que nadie lea las cifras sin saber con qué criterio se
  contaron.

- **Al entrar por primera vez, el sistema pregunta por tus razones sociales.**
  Casi todas las empresas de medios reparten su operación entre varias: una paga
  las rentas, otra compra el equipo, otra hace los trámites con gobierno, y la
  operación y las ventas a veces van juntas y a veces no. Hasta hoy el sistema no
  tenía forma de preguntarlo. Ahora, si tu empresa todavía no tiene ninguna
  registrada, aparece una pantalla de bienvenida con tres preguntas: si tienes
  varias, si la operación está en la misma que factura las ventas, y con cuál
  haces cada cosa. Las dos primeras están para **ahorrarte trabajo en la
  tercera**: quien tiene una sola escribe **un** nombre y no cinco, y quien tiene
  operación y ventas juntas contesta **un** campo menos. Si dos roles son de la
  misma razón social, escribes el mismo nombre y se agrupan en una: no se
  duplica. Al guardar quedan creadas **todas a la vez, o ninguna**. **Se puede
  saltar** con «Lo hago más tarde» y volver cuando quieras. Y si ya tenías
  razones sociales, el cuestionario no vuelve a aparecer. Solo lo ve el Dueño: es
  la identidad fiscal del negocio. En el menú está como **Razones sociales**.

- **Razones sociales: ya se pueden gestionar y asignar.** Hasta ahora el sistema
  guardaba las razones sociales de tu empresa pero no había ninguna pantalla para
  verlas: la de bienvenida te decía que fueras a Administración, y ahí no había
  nada. Ahora hay una pantalla propia, **Razones sociales**, donde se dan de alta,
  se editan, se dan de baja y se vuelven a activar. Cada una lleva su papel —quién
  paga las rentas, quién compra los activos, quién tramita licencias, quién opera
  y quién vende— y la pantalla **avisa cuando un papel se queda sin nadie**, porque
  a partir de ahí los documentos de ese tipo nacen sin razón social. Y lo más
  importante: **ya se puede decir con cuál se paga cada contrato de renta y con
  cuál se emite cada comprobante**. Si solo una tiene el papel, viene propuesta
  sola; si hay dos, el sistema no elige por ti. Lo que ya existía se queda como
  **«sin asignar»** y así se muestra, porque nadie sabe a nombre de quién se hizo y
  no se inventa. **Ningún importe cambió**: aquí solo se decide el nombre que va en
  el documento.

- **Ya son los cinco reportes: entra el consumo de luz.** Hay una pantalla nueva,
  **Consumo de luz**, donde operaciones teclea un recibo por predio y por mes. El
  importe se reparte entre las pantallas de ese predio **igual que la renta**, y
  entra en el costo y en el margen de **todos** los reportes, no solo del suyo.
  Lo más útil de esa pantalla no es capturar: es que **enseña lo que falta**. Una
  rejilla con un predio por fila y un mes por columna marca los meses sin recibo, y
  el reporte avisa de cuántos le faltan. Sin eso, un mes que nadie capturó se vería
  como si ese predio no gastara luz y el margen saldría mejor de lo que es, sin que
  nada lo dijera. Capturar dos veces el mismo recibo ya no es posible.

- **El metro cuadrado suma todas las caras.** Una pantalla de dos caras de 3 × 6
  cuenta 36 m², no 18, porque es la superficie que de verdad se vende. Cambia el
  orden del reporte por metro cuadrado; el ingreso, el costo y el margen no se
  mueven.

- **Lo que la pantalla enseña de cada reporte.** «Por operación» ya muestra las
  columnas que lo hacen ser de operación: cuántas visitas tuvo cada pantalla, qué
  proporción del ingreso se comió la operación, cuántas horas estuvo la cuadrilla en
  sitio y sobre cuántas visitas se midieron, y de qué tipo fue cada visita. «Por metro
  cuadrado» muestra la superficie y el rendimiento por metro, dice encima de la tabla
  cuántas pantallas quedaron fuera del ranking y por qué, y **declara con qué criterio
  se contó el metro cuadrado** (hoy, la superficie de una sola cara) — es una decisión
  pendiente y cambia el orden de toda la tabla. «Por trimestre» llama **Trimestre** a
  su primera columna, donde antes decía «Pantalla», y sale en **orden cronológico** en
  vez de del peor al mejor, porque es una serie de tiempo. Cualquier fila se despliega
  para ver su desglose mes a mes. Y el desplegable ya no marca tres de los cuatro
  reportes como «en preparación»: los cuatro funcionan.

- **El reporte avisa cuando el trimestre no ha terminado.** Sigue abriendo en el
  **trimestre en curso**, que es lo que se pidió ver. Pero un trimestre a medias se lee
  peor de lo que es: la renta de los espacios se paga desde el primer día y lo que se
  vende se cobra al cerrar. Así que ahora la pantalla lo advierte — cuando el periodo
  toca un trimestre que no ha terminado, sale un aviso en ámbar encima de la tabla que
  dice cuántos días lleva corridos de cuántos, explica que la renta ya corrió completa
  pero el ingreso todavía no está dentro, y recuerda que ese margen no se compara con
  el de un trimestre terminado. **Solo sale cuando hace falta**: al cambiar a un
  trimestre ya cerrado desaparece, y esa desaparición dice que las cifras ya son
  definitivas.

- **Datos de demostración para los reportes.** Se añadió una semilla que deja una
  base lista para enseñar el módulo con una historia de verdad: cuatro trimestres
  cerrados de campañas y de visitas sobre cuatro pantallas. No son datos al azar,
  cuentan un caso. Dos espectaculares muy parecidos —«Tlalpan G500» y «G500 Santa
  Mónica», mismas medidas y rentas casi iguales— reciben **exactamente las mismas
  campañas y facturan lo mismo**, pero a Tlalpan hay que ir a repararla cada vez
  más seguido: su margen baja de 41 300 a 20 900 trimestre a trimestre, mientras
  el de Santa Mónica se queda plano en 49 200. El reporte lo enseña y señala la
  causa: no son las ventas, son las órdenes de trabajo (30 contra 20). Se siembran
  además dos anuncios sin medidas capturadas, a propósito, para que se vea que el
  reporte por metro cuadrado los deja fuera **y lo dice**. Se puede volver a
  correr sin miedo: no duplica nada. Y **no se instala en la copia de ningún
  cliente**: es solo para demostraciones.
- **Los cuatro botones de Inventario ahora se ven como botones.** Arriba de
  Inventario hay cuatro opciones —ver el inventario, contrato + pantalla, carga
  masiva y alta manual— que iban pegadas unas a otras y sin relieve, y costaba
  saber cuál estaba activa y dónde acababa cada una. Ahora van **separadas**, la
  opción activa **sobresale** en blanco con su sombra sobre el fondo crema, y las
  demás dibujan su borde al pasar el ratón por encima. Además, al recorrerlas con
  el teclado se ve un anillo que marca en cuál estás: antes no se veía nada.

## 2026-09-17

- **El sistema ya puede guardar TUS razones sociales, no solo la del dueño de la
  pantalla.** Hasta hoy SPACE OS guardaba con detalle a nombre de quién te cobra
  la renta el propietario de un predio, pero no guardaba **ninguna de las tuyas**.
  Y una empresa de publicidad exterior no opera con una sola: normalmente hay una
  que paga las rentas, otra que compra los equipos, otra que hace los trámites y
  las licencias con gobierno, otra u otras que venden, y la operación con su
  nómina aparte. Ahora se pueden dar de alta todas, cada una con su RFC, su
  régimen, su código postal fiscal y la serie con la que folia sus documentos.

- **Cada razón social lleva escrito para qué sirve, y puede servir para varias
  cosas a la vez.** De partida hay cinco papeles —paga rentas, compra activos,
  trámites y licencias, operación, ventas— y una misma sociedad puede tener
  varios, porque es lo normal: operación y ventas casi siempre coinciden. Esa
  lista de papeles **se puede cambiar sin tocar el programa**, a propósito: está
  guardada como datos, no escrita dentro del código, porque todavía puede crecer.

- **Dar de baja una razón social no borra nada.** Deja de aparecer al capturar,
  pero sigue guardada: los contratos y los comprobantes que la nombran tienen que
  seguir diciendo a nombre de quién se hicieron. Y si un día se eliminara de
  verdad, los contratos **no desaparecen con ella**: se quedan sin razón social
  asignada, que es un estado que el sistema entiende.

- **Los contratos y los comprobantes ya existentes se quedan «sin asignar», y es
  correcto.** No se inventó a quién pertenecen. Cada uno se irá asignando a mano
  cuando alguien lo decida; nada se rellenó solo.

- **Esto lo ve y lo edita quien administra la empresa**, no quien captura
  contratos: es la identidad fiscal del negocio, no un dato operativo. Y cada
  alta, cada cambio y cada baja queda anotada en el historial de actividad, con
  el valor anterior y el nuevo cuando se trata de un cambio.

- **Lo que todavía NO hay: pantalla.** Hoy solo se construyó la parte de abajo,
  la que guarda y protege los datos. La pantalla para capturarlas llega aparte.
- **Los reportes de rentabilidad ya tienen por dónde pedir sus números, y no
  es el navegador.** Se abrió la dirección `/api/reportes/rentabilidad`: el
  servidor recibe qué periodo se quiere ver y devuelve el reporte **ya sumado**.
  Todavía no hay pantallas que lo usen; esto es la tubería sobre la que se van
  a construir.

  **Por qué se hizo ahora y no cuando estén las pantallas.** Hoy la aplicación
  se trae al navegador **tablas completas** en cada carga y saca los márgenes
  ahí. Eso ya reventó una vez: la respuesta llegó a **6 MB** y la pantalla se
  quedaba en blanco entre **6 y 12 segundos**, sin dar ningún error. Los
  reportes de rentabilidad van a mirar **años** de historia, así que por ese
  camino no aguantan. Hacerlo al revés —pantallas primero— habría obligado a
  rehacerlas todas después.

- **Lo que ya calcula: la rentabilidad por pantalla, repartida por periodo.**
  Antes el margen por pantalla era una **foto de hoy**: solo contaba lo que
  estuviera vendido en este momento. Ahora se puede pedir un trimestre o un mes
  concretos, y una campaña que empieza en marzo y acaba en abril **se reparte
  por los días que le toca a cada uno**, en vez de contarse entera en el mes en
  que arranca. Los dos trozos suman el precio exacto de la campaña: el reparto
  no pierde ni inventa dinero.

  La renta que se paga al arrendador se reparte al revés, por **meses de
  calendario**, porque así se paga: un mes completo cuenta como un mes, tenga
  28 o 31 días.

- **Falta decir lo que NO hace, para que nadie lea de más.** Se puede agrupar
  **por pantalla**; las otras tres agrupaciones previstas —por trimestre, por
  operación y por metro cuadrado— están declaradas y contestan «todavía no
  disponible» con ese mensaje, no con un error. Y el costo de renta usa el
  contrato **vigente hoy**, así que un reporte de un trimestre pasado no ve un
  contrato que ya venció entonces.

- **Cuánto cuesta una orden de trabajo ya se puede configurar, y por tipo.**
  Hasta hoy el sistema cobraba **1 500 pesos por cada orden de trabajo**, fuera
  montar una lona o pasar a hacer una inspección, y ese número estaba escrito
  dentro del programa: no había pantalla ni forma de cambiarlo. Como de ahí sale
  el costo de operación, el margen que enseña el tablero y el de cada campaña
  se apoyaban en ese único importe para todas las empresas.

  Ahora cada organización guarda **su** importe para cada uno de los nueve tipos
  de tarea, y lo que guarda solo le afecta a ella.

- **Nadie verá cambiar sus números por esto, y es intencional.** Mientras una
  organización no capture nada, el sistema sigue usando 1 500 para todo: las
  cifras de hoy son idénticas a las de ayer. El cambio abre la puerta; cruzarla
  es una decisión del dueño, no del programa.

  Un detalle que sí importa: capturar **0** es válido —una inspección que hace el
  propio dueño no paga cuadrilla— y no se confunde con «no lo he capturado».

- **Repartida la versión del 10 de septiembre a toda la flota.** El canal por el
  que las instancias bajan sus actualizaciones cada noche llevaba desde el 9 de
  septiembre apuntando a una copia vieja. Hoy se le puso la del 10.

- **Pero NO arregló lo que iba a arreglar, y hay que decirlo así.** La dirección
  de g500 seguía sin funcionar para quien la abriera sin haber iniciado sesión:
  antes acababa en una dirección interna del servidor, y desde hoy muestra una
  página de error. **Lo mismo le pasaba a la instalación de demostración**, así
  que el fallo era de todas las instancias, no de un cliente.

- **La causa, y por qué el arreglo de septiembre no podía funcionar.** Cuando
  alguien entra sin sesión, el sistema tiene que mandarlo a la pantalla de
  acceso. El arreglo del 10 de septiembre cambió la forma de indicar ese destino
  por una **abreviada** —«vete a la pantalla de acceso», sin decir de qué
  servidor—. Resulta que la tecnología sobre la que está construida la
  aplicación **exige el destino completo** y rechaza el abreviado, así que en vez
  de mandar a nadie a ninguna parte, devolvía un error.

- **Corregido, desplegado y COMPROBADO el mismo día.** Ahora el destino se arma
  con el nombre de dominio por el que entró la persona, así que sale correcto en
  cualquier instalación sin que la aplicación tenga que saber cuál es. Va con su
  registro de decisión, porque tiene implicaciones de seguridad que quedaron
  escritas.

  **Medido en g500 a las 17:52**, que es lo que convierte esto en un cierre y no
  en una afirmación: quien abre la dirección del cliente sin haber iniciado
  sesión **llega a la pantalla de acceso de su propio dominio**. Nueve días
  después de que apareciera el fallo. La actualización no cambió ningún dato
  —cero modificaciones de base— y dejó su copia de seguridad hecha antes de
  empezar.

- **Lo que más importa de todo esto: tres comprobaciones automáticas dieron por
  buena una versión rota.** Las tres miraban páginas públicas, y el fallo sólo
  aparecía en las páginas que exigen haber entrado. La instalación de
  demostración aprobó la versión sin llegar a ejecutar ni una vez la parte
  averiada. Se añadió la comprobación que faltaba.

- **Se publicó exactamente lo que se había probado, ni una coma más.** No se
  construyó nada nuevo: se le puso otro nombre a un paquete que ya existía y ya
  estaba validado. Es a propósito — reconstruir produciría un paquete distinto
  del que se probó. El sistema lo comprobó por su cuenta tres veces antes de
  hacerlo (que la versión fuera la que está en pruebas, que la instalación de
  demostración estuviera sana y corriendo esa misma versión, y que el paquete no
  cambiara al renombrarlo) y dejó escrito cómo deshacerlo.

- **Aplicado en la base del cliente: el país deja de rellenarse solo.** Hasta hoy,
  una pantalla dada de alta sin indicar país quedaba registrada en «Perú», y la
  ficha pública lo imprimía. Ya no. **No cambió ningún dato ya guardado** — las
  pantallas de g500 registradas como peruanas se corrigen aparte y por decisión
  suya, no como efecto colateral de una actualización. La instancia hizo una
  copia de seguridad de 6,3 MB antes de tocar nada.

- **Detectado de paso, y pesa más que lo anterior: g500 no tiene copias de
  seguridad fuera de su propio servidor.** Los respaldos se guardan en la misma
  máquina porque faltan las credenciales del almacén externo. Es la instalación
  con datos reales de cliente: si esa máquina desapareciera, las copias
  desaparecerían con ella. Sin resolver.

- **Ampliado el manual de usuario con lo que le faltaba.** Se documentó el área
  de **Integraciones** —los sistemas de otras empresas que SPACE OS puede usar—,
  que no aparecía en absoluto, y se escribieron por fin las tareas de
  **Actividad**, **Comisiones** y **Network**, que hasta ahora sólo se
  mencionaban de pasada. Ocho tareas nuevas en total. El manual sigue marcado
  como **en curso**: le falta recorrerse contra la aplicación en pantalla.

- **Encontrado al documentar: un aviso que miente.** En la ficha de una pantalla,
  el interruptor para compartirla a la Network le aparece al perfil Comercial,
  pero ese perfil no tiene permiso para guardarlo. El interruptor vuelve solo a
  su sitio **y aun así sale el mensaje de que se compartió**. Está sin corregir:
  antes hay que decidir si a Comercial se le concede ese permiso o se le oculta
  el interruptor.

---

## 2026-09-15

- **El servidor central dejó de quedarse sordo cada pocas horas.** Desde el 12
  de septiembre, el servidor desde el que administramos toda la flota perdía
  varias veces al día la capacidad de **traducir nombres de internet a
  direcciones** —lo que hace un listín telefónico—. Tenía un solo listín y
  ninguno de repuesto, así que cuando ese fallaba, la máquina no podía hablar
  con nadie: ni bajar las actualizaciones que reparte cada noche, ni renovar los
  certificados de seguridad, ni comprobar si las instancias de los clientes
  están vivas. Ahora tiene tres, y usa el siguiente cuando el primero no
  contesta.

- **Y mientras tanto, el tablero de control acusaba a quien no debía.** Durante
  esos ratos, el panel donde vemos el estado de cada cliente marcaba instancias
  **perfectamente sanas** como caídas, porque no distinguía entre «el servidor
  del cliente no responde» y «desde aquí no puedo ni preguntar». El fallo nunca
  estuvo en la máquina del cliente. Con el listín arreglado, lo que diga el
  panel vuelve a ser fiable.

- **Encontrado: el cliente g500 lleva seis días con la aplicación casi
  inalcanzable.** Quien abre su dirección sin haber iniciado sesión acaba en una
  dirección interna del servidor, en vez de en la pantalla de acceso; sólo entra
  quien escriba a mano la dirección del login. El arreglo existe desde el 10 de
  septiembre, pero **nunca llegó a su máquina**.

- **Por qué no llegó, y por qué nadie lo vio.** Las instancias bajan cada noche la
  versión publicada en el canal de actualizaciones. Ese canal se quedó apuntando a
  una copia del 9 de septiembre, **anterior al arreglo, pero con el mismo número de
  versión que la copia buena**: dos paquetes distintos llamados igual. El tablero
  interno mostraba el número correcto, así que todo parecía en orden.

- **Y el tablero tampoco ayudaba.** Marcaba a todas las instancias como
  «rezagadas» desde el 27 de agosto, porque la versión de referencia con la que se
  compara se había quedado congelada. Cuando todo está en ámbar, el ámbar deja de
  avisar de nada.

- **Comprobado un día después, y no el mismo día.** El registro de la máquina
  pasó de unas diez señales de avería diarias a **cero** en una jornada
  completa. Se esperó a tener el día entero antes de darlo por bueno: un arreglo
  de este tipo se ve funcionando con el tiempo, no en el momento de aplicarlo.

---

## 2026-09-14

- **Se cerró un agujero de seguridad en cómo se prepara el servidor de un
  cliente.** Cuando damos de alta a un cliente, su servidor guarda un archivo
  con su configuración —a qué base de datos apunta, de dónde baja las
  actualizaciones—. Ese archivo lo vuelve a leer el propio servidor todas las
  noches, con los permisos más altos que existen. Hasta hoy, si al escribirlo
  alguien dejaba por accidente un espacio de más en uno de esos valores, el
  servidor **no leía un dato: ejecutaba una orden**. No daba ningún error y no
  lo avisaba nadie.

  **No le pasó a ningún cliente.** Esos valores los escribimos nosotros, así
  que hacía falta una equivocación nuestra para dispararlo. Pero el resultado de
  esa equivocación era grave, así que ahora el sistema **se niega a escribir**
  un valor que pueda dar problemas, en vez de confiar en que nadie se equivoque.

- **Y antes de arreglarlo, se reprodujo.** En vez de corregirlo leyendo el
  código, se montó una prueba que provoca el fallo a propósito y demuestra que
  ocurre de verdad. Esa prueba se queda puesta: si alguien deshace el arreglo
  algún día, se entera en el momento y no cuando ya esté en el servidor de
  alguien.

- **Apareció, de paso, que las instrucciones para dar de alta a un cliente
  estaban incompletas desde hace tres días.** El paquete que se le entrega a un
  cliente que pone su propio servidor **no incluía uno de los archivos** que el
  instalador necesita para arrancar. Nadie lo había usado todavía —no hay
  ningún cliente por esa vía— pero el primero se habría quedado parado en el
  primer paso. Corregido, y ahora hay una comprobación automática que avisa si
  las instrucciones y el programa dejan de coincidir.

---

## 2026-09-11

- **Ahora se puede vender el sistema con el cliente poniendo su propio
  servidor.** Hasta hoy, cuando alguien contrataba SPACE OS, nosotros
  levantábamos su servidor y lo administrábamos. Eso **sigue funcionando
  exactamente igual**. Lo nuevo es una segunda forma: el cliente crea su propio
  servidor, en su propia cuenta, y nosotros le entregamos un paquete para
  instalar el sistema ahí. Sigue siendo el mismo programa; lo que cambia es
  quién es dueño de la máquina.

  **Para los servidores que ponemos nosotros no cambia absolutamente nada.**
  Si ya eres cliente y nosotros administramos tu servidor, esto no te afecta
  en lo más mínimo.

- **En la nueva forma, el sistema sabe hasta cuándo tiene permiso de
  funcionar.** Cuando un cliente pone su propio servidor, ese servidor lleva un
  documento firmado por nosotros que dice hasta qué fecha está pagado. El
  sistema avisa con semanas de anticipación de que se acerca el vencimiento, y
  si de todos modos llega la fecha, da un margen de gracia antes de dejar de
  funcionar. **Un olvido en la facturación no deja a nadie sin poder trabajar
  de un día para otro.**

- **Si el problema es nuestro, el sistema sigue funcionando y nos avisa a
  nosotros, no al cliente.** Comprobar el permiso necesita una herramienta que
  a veces puede faltar en un servidor. Si eso pasa, el sistema **no castiga al
  cliente** por algo que no es su culpa: sigue funcionando con normalidad, y lo
  que se avisa es que alguien de nuestro lado tiene que entrar a revisar esa
  máquina.

- **Los datos del cliente nunca se tocan.** En esta nueva forma, la información
  del cliente vive en su propio servidor, no en el nuestro. Pase lo que pase
  con el pago, sus datos siguen siendo suyos y siguen en su máquina.

  **Todavía no hay ningún cliente usando esta forma nueva.** Lo que falta antes
  del primero es terminar de repartir las llaves de seguridad, firmar el primer
  documento de permiso, y hacer un ensayo completo — apagando y volviendo a
  encender el mecanismo a propósito, contra el servidor de pruebas, nunca
  contra un cliente real.

- **Repaso completo de esa forma nueva, antes de estrenarla con nadie.** Se
  revisó el mecanismo entero de punta a punta, y aparecieron cosas que no se
  veían mirando cada pieza por separado. Ninguna había llegado a un cliente
  —todavía no hay ninguno— pero todas habrían aparecido con el primero:

  - **El aviso de vencimiento no se habría visto nunca.** El sistema tenía que
    avisar dentro de la pantalla durante el mes anterior al vencimiento y los
    quince días de gracia. No lo hacía: el documento de permiso quedaba
    guardado de forma que el propio sistema no podía leerlo, y en vez de
    quejarse se quedaba callado. Lo primero que habría visto el cliente sería
    la pantalla de «vencido», sin un solo aviso previo. Corregido, y además
    ahora si vuelve a pasar **se queja** en vez de callarse, y quien instala
    tiene un paso nuevo para comprobarlo antes de dar el alta por terminada.

  - **El tablero no se iba a enterar de un apagado.** Cuando el sistema se
    apaga por vencimiento, tiene que avisar al tablero con un aviso propio —el
    que dice «está apagado a propósito, no es una avería»—. Ese aviso se
    preparaba *después* de apagar, y para entonces ya no había nadie que lo
    pudiera preparar: al tablero llegaba «sin respuesta», que es exactamente
    lo que ese aviso existía para evitar. Ahora se manda antes de apagar.

  - **Las contraseñas del cliente quedaban en el historial de su terminal.**
    Los instructivos pedían escribirlas en la misma línea del comando de
    instalación, con lo que quedaban guardadas en su máquina para siempre.
    Ahora van por otro camino que no deja rastro, y si alguien las escribe a
    la antigua, el instalador se detiene y le explica cómo hacerlo bien.

  - **Dos comandos del instructivo del cliente no funcionaban**, y el
    instructivo no decía en qué orden se hacen las cosas —se podía dar de alta
    a un cliente sin haber hecho antes el ensayo de prueba—. Las dos cosas
    arregladas, y esta vez cada comando se ejecutó de verdad antes de
    escribirlo.

  - **La prueba en seco apagaba el sistema de verdad.** El actualizador tiene
    un modo «cuéntame qué harías sin hacer nada», y el instructivo le pide a
    quien instala que lo use **antes** de la instalación real, justamente para
    que nada pueda salir mal. Pero si en ese momento el permiso estaba
    vencido, ese modo **apagaba la instancia igual** —y encima sin avisar de
    que lo iba a hacer—. Alguien podía dejar un sistema abajo creyendo que
    sólo estaba mirando. Ahora la prueba en seco no toca nada y **dice en voz
    alta** lo que haría: «apagaría, porque el permiso está vencido». Las dos
    cosas hacían falta: una prueba que apaga es mala, y una que se calla que
    el permiso venció no sirve para ensayar nada.

## 2026-09-10

- **El tablero de servidores ya dice POR QUÉ uno no responde.** Cuando un servidor
  de cliente no contestaba, el tablero ponia «sin respuesta» y nada mas. Detras de
  esas dos palabras caben cosas muy distintas: que la direccion de internet dejo de
  apuntar a la maquina, que la maquina no acepta conexiones, que se le vencio el
  certificado de seguridad, que el programa esta caido, o que al tablero le falta la
  llave para preguntar. **Cinco averias con cinco arreglos, y todas se veian igual.**

  Ahora cada una dice lo que es, en una frase y con su codigo tecnico al lado — la
  frase para entenderlo de un vistazo, el codigo para buscarlo o pasarselo a quien
  lo vaya a arreglar. Por ejemplo: «el dominio no resuelve (ENOTFOUND)» o «el
  certificado caduco (CERT_HAS_EXPIRED)».

  **Y ahora recuerda desde cuando.** Antes era una foto del momento, asi que no se
  distinguia un parpadeo de dos segundos de una caida de tres horas. Ahora acompaña
  el aviso con la ultima vez que ese servidor si contesto. **Si un servidor esta
  bien, el tablero no dice nada de el**: el silencio es la señal de que todo va
  bien, en vez de llenar la pantalla de marcas verdes.

  **Lo curioso es que el sistema ya sabia la causa y la tiraba.** La calculaba al
  preguntar y la descartaba una linea despues, antes de mostrarla. Y para las
  averias de red guardaba un mensaje que no decia nada — el mismo texto para las
  cinco.

  **Esto no cambia nada de lo que ve un cliente**: es la pantalla interna con la
  que se vigilan los servidores. Y no hace falta actualizar ninguna maquina de
  cliente para tenerlo.

- **Y el tablero tambien dira si la ultima actualizacion de un servidor salio
  mal.** Escrito hoy; se enciende cuando se corra la tarjeta de despliegue, que la
  hace una persona.

  El problema que resuelve: cada servidor de cliente se actualiza solo, de noche.
  Si esa actualizacion falla, el servidor **sigue funcionando con la version
  anterior** — asi esta diseñado — y por eso en el tablero aparecia como
  «atrasado», exactamente igual que uno que simplemente todavia no le habia
  tocado. **Y son dos cosas muy distintas:** uno se arregla esperando a la noche
  siguiente, y el otro no se arregla solo nunca.

  Ahora cada servidor cuenta con que resultado acabo su ultima actualizacion, y el
  tablero lo traduce a una frase. La que mas importa distingue dos casos que antes
  se veian iguales: **«las migraciones fallaron a medias y la base pudo cambiar»**
  —que es alguien mirandolo esta noche— y **«no se aplico nada»** —que puede
  esperar—. Si la actualizacion fue bien, el tablero sigue sin decir nada.

  **Lo que el servidor de un cliente manda es un numero, nunca el texto del
  error.** No es un detalle tecnico: un mensaje de error puede arrastrar dentro un
  trozo del registro del programa, y ahi caben nombres, importes y correos de los
  clientes de ese cliente. Las palabras las escribe siempre nuestro lado. El
  registro completo se queda en la maquina del owner, que es de donde no tiene que
  salir.

- **Las pantallas dejan de nacer en Perú.** Al dar de alta una pantalla, el sistema
  no pregunta el pais — y hasta hoy rellenaba ese hueco solo, con **Perú**. Es
  herencia de cuando el producto se vendia en Lima, y quedo escrito en la base como
  valor por omision. No era un dato interno: **la ficha publica de la pantalla, la
  que se le manda al cliente, imprime la ubicacion**.

  En agosto ya se habia corregido la mitad del problema — la ciudad y el estado
  dejaron de inventarse y quedan en blanco cuando nadie los captura — pero el pais
  no se pudo tocar entonces: exigia cambiar la estructura de la base, y eso se
  decide aparte. Hoy se hizo.

  **Ahora un dato que nadie capturo se queda vacio**, igual que los otros dos. Y no
  se sustituyo Perú por Mexico a proposito: el mismo programa corre en la maquina de
  cada cliente y no puede saber en que pais opera cada uno. Poner un pais fijo en la
  base es exactamente lo que causo esto.

  **Aparte, y con su propia decision:** las **12 pantallas de G500** ya estaban
  guardadas como Perú, y son de la Ciudad de Mexico y el Estado de Mexico — Tlalpan,
  Patriotismo, Calzada Mexico Tacuba, Gustavo Baz. Se corrigen a Mexico con un
  cambio aparte, revisado y reversible. **El cambio de estructura no toca ni una
  fila por su cuenta**: los datos de un cliente no se modifican como efecto
  secundario de una actualizacion.

---

## 2026-09-09

- **Al entrar sin sesion, la aplicacion mandaba al navegador a una direccion que no
  existe.** Si alguien abria una direccion de la aplicacion sin haber iniciado sesion
  —o volvia a una direccion vieja guardada en favoritos— el navegador no acababa en la
  pantalla de entrada, sino en `localhost:3000`, que es una direccion **interna del
  propio servidor** y desde fuera no lleva a ninguna parte. El efecto practico: para
  entrar habia que escribir a mano la direccion exacta de la pantalla de entrada.

  **Donde se vio:** en la instancia de g500, el mismo dia en que se cargaron sus datos
  y por primera vez alguien recorrio pantallas ahi dentro. No lo causo esa carga —solo
  metio informacion— sino un detalle de como el sistema construia esos saltos.

  **Que se hizo:** ahora el sistema, en lugar de decirle al navegador la direccion
  completa a la que ir, le dice **solo el tramo final del camino**, y el navegador lo
  completa con la direccion por la que entro. Asi funciona en cualquier dominio sin que
  el sistema tenga que saber cual es el suyo — que es justo lo que hace falta cuando el
  mismo programa corre en la maquina de cada cliente.

  **Ojo, porque es de flota:** el fallo estaba en el programa, no en la maquina de
  g500, asi que **todas las instancias lo tienen** hasta que se les actualice la
  version. Se corrige con una version nueva, no tocando ningun servidor.
- **G500 ya tiene sus datos en su propio servidor.** Hasta hoy, la informacion de
  G500 vivia en el servidor de julio, mezclada en la misma base con la de otras cuatro
  organizaciones de prueba. Su servidor propio existia desde esta manana, pero estaba
  vacio. Ahora tiene **sus 12 pantallas con sus tarifas, sus 5 arrendadores con 13
  contratos y 29 pagos de renta, sus 7 campanas, sus 7 propuestas, 3 facturas y 15
  registros de cobranza**. Nada de las otras organizaciones viajo con ellos.

  **Lo que NO se llevo, y es a proposito:** las personas. Las tres cuentas que existian
  en el servidor viejo eran las tres de maximo privilegio y no se copiaron; el Dueno
  invita a su equipo desde la aplicacion, y cada quien entra con su cuenta. Tampoco se
  llevo el historial de «quien hizo que» de julio y agosto: eran anotaciones del sistema
  y de una cuenta de demostracion.

  **Lo que casi se pierde sin que nadie se enterara:** las **tarifas de las 12
  pantallas** estaban guardadas bajo el nombre de otra organizacion, por un defecto
  antiguo del sistema que ya se corrigio en agosto pero que dejo esas filas mal
  etiquetadas. Una copia normal se habria llevado las 12 pantallas **sin un solo
  precio, y sin dar ningun error**. Se detectaron antes de mover nada, contandolas
  contra la pantalla a la que pertenecen, y viajaron con su tarifa correcta.

  **Como se hizo, en corto:** se bajo una copia completa del servidor viejo, se puso al
  dia en una base de trabajo local —el servidor viejo iba 13 actualizaciones por
  detras— y ahi se comprobo todo antes de subir nada. La carga se hizo en un solo
  movimiento: o entraba completa o no entraba nada. Antes de tocar el servidor de G500
  se guardo una copia de seguridad, y se comprobo cada cifra despues.

  **Un detalle de facturacion que conviene saber:** en el servidor viejo el IVA de G500
  estaba en 15 %. Se cargo en **16 %**, que es el vigente; el 15 era un valor que quedo
  de las pruebas de julio.

---

## 2026-09-08

- **El mapa ya no dice «API KEY REQUIRED» encima.** Sobre los mapas aparecia un texto en
  diagonal que parecia el nombre de una calle o de una zona, pero no era nuestro ni era un
  error: la empresa que nos daba las imagenes del mapa empezo a pedir una cuenta, y su forma
  de pedirla fue **estampar el aviso dentro de la propia imagen**. Todo lo demas seguia
  funcionando, asi que el sistema no tenia forma de avisar de nada.

  **Donde se veia:** el panel de inicio, comercial, propuestas, el detalle de una propuesta
  y —lo mas importante— **la propuesta publica que se le manda al cliente**. Ahi es donde
  urgia: el cliente abria su propuesta y veia el aviso encima del mapa de sus pantallas.

  Ya se cambio el proveedor de las imagenes por otro que **no pide cuenta ni clave**, con el
  mismo aspecto gris claro de antes. No hay nada que configurar ni que pagar, y el mapa se
  comporta igual: se acerca, se aleja y muestra los pines como siempre.

  Queda una cosa que **no pudimos comprobar desde aqui y conviene mirar**: nadie ha visto
  todavia el mapa nuevo pintado en pantalla. Con abrir cualquier pantalla con mapa se ve al
  instante.

- **Las altas de instancias nuevas se habian quedado paradas sin que nada avisara.**
  Una alta pedida desde el panel avanza sola por etapas: se crea la maquina, se espera
  a que el dominio apunte, se pide el certificado. La segunda etapa **no avanzaba
  nunca**: el proceso que la empuja consultaba el dato de la maquina en un sitio y
  quien lo guardaba lo dejaba en otro. Asi que se rendia cada minuto diciendo que le
  faltaba un dato que si tenia.

  Se noto porque una alta del dia anterior llevaba 22 horas quieta, y porque una nueva
  no la recogia nadie. La segunda razon era distinta y tambien esta arreglada: el
  temporizador que despierta a ese proceso **nunca se habia activado** en el servidor.

  Habia un tercer efecto, y era el mas caro de los tres aunque no se hubiera visto
  todavia: la cuenta de intentos de certificado tampoco se guardaba donde se leia, asi
  que **el limite de tres intentos por hora no existia**. La autoridad que emite los
  certificados solo permite cinco por hora y por dominio, y a un intento por minuto eso
  se agota en cinco minutos y deja el dominio sin poder pedir certificado durante una
  hora.

- **El menu de la izquierda: «Ventas» ahora dice «Comercial», y «Entregar» dice
  «Operaciones».** Los dos grupos toman el nombre del area que hace ese trabajo en
  vez del verbo. No se movio ninguna pantalla ni cambio ningun permiso: son dos
  palabras del encabezado, y las entradas de cada grupo son exactamente las
  mismas.

  Con esto, cuatro encabezados se llaman igual que una de sus entradas
  —Inventario, Comercial, Operaciones y Finanzas—. Es a proposito: el encabezado
  nombra la fase del proceso y la entrada es la pantalla principal de esa fase.

- **La aplicacion del servidor padre estaba inaccesible, y decia que no habia datos.**
  Quien entraba con Google se encontraba la pantalla vacia con el mensaje «No se pudieron
  cargar los datos» y un boton de reintentar. El boton no podia funcionar nunca, y el
  mensaje era engañoso: los datos estaban ahi y se leian perfectamente.

  Lo que pasaba de verdad: el sistema estaba pidiendo que guardaras tus codigos de
  recuperacion antes de dejarte seguir —eso es correcto y es nuevo de la semana pasada—,
  pero **la pantalla de los codigos tambien quedaba tapada por el mismo mensaje**. O sea
  que te pedia una cosa y te escondia el unico sitio donde hacerla. Sin salida.

  Ya no. Cuando el sistema exige algo antes de dejarte entrar, la pantalla que lo resuelve
  se ve siempre, aunque el resto de la aplicacion este cerrada.

  **Si te pasa antes de que esto se despliegue**, hay una vuelta: entra con tu correo y
  contraseña en vez de con Google. Por esa puerta el sistema no pide los codigos.

  Y una nota para quien mantenga esto: es la **cuarta** vez que el mismo descuido deja a
  alguien encerrado —restablecimiento, desbloqueo, contraseña temporal y ahora los
  codigos—. Las tres anteriores se arreglaron una por una. Esta vez lo que se arreglo fue
  la forma de escribirlo: ahora la exigencia y su salida se declaran juntas en un solo
  sitio, asi que no se puede añadir una y olvidar la otra.

---

## 2026-09-07

- **Y si pierdes los codigos, ya puedes pedir otros.** Antes la pantalla de los codigos
  solo aparecia cuando el sistema te empujaba a ella: quien ya los habia guardado y luego
  perdio el papel no tenia forma de volver. Ahora esta en el menu de tu cuenta, arriba a la
  derecha.

  **Generar otros pide tu contraseña**, y no es burocracia: al generarlos, los anteriores
  **dejan de funcionar**. Es lo primero que haria alguien que se sentara en tu computadora
  con la sesion abierta —se fabrica una llave y te deja con una lista muerta sin avisarte—,
  asi que ademas **queda anotado** en el registro de la organizacion. Los codigos mismos no
  se anotan en ningun sitio.

  Un detalle que se cuido a proposito: si teclas mal la contraseña, **no se borra nada**.
  Tus codigos de siempre siguen valiendo.

- **Se comprobo, de punta a punta, que el Dueño de una empresa nueva puede trabajar.** Cada
  pieza de lo de arriba estaba probada por separado, pero **el recorrido completo no lo
  habia hecho nadie**: entrar con Google, guardar los codigos, poner tu propia contraseña y
  llegar a facturar. Eran cinco pasos y bastaba con que uno no encajara para que el Dueño se
  quedara mirando una pantalla que le pide una contraseña que nunca tuvo.

  Funciona. Y de paso aparecio algo util de saber para el dia que haya que dar soporte:
  **guardar los codigos no abre todavia la aplicacion** — falta cambiar la contraseña
  temporal, que es un segundo paso. Las dos cosas se piden de la misma forma, asi que sin
  saberlo es facil creer que algo se rompio cuando no.

- **Dar de alta a un cliente ya no genera ninguna contraseña.** Era lo ultimo que
  obligaba a que hubiera una persona delante: el comando imprimia una clave en la
  pantalla, habia que leerla y hacersela llegar al Dueño de la empresa nueva. Y mientras
  tanto se quedaba en el historial de quien corriera el comando.

  Ahora no existe. El Dueño entra con Google, y la primera vez que entra la aplicacion le
  enseña sus codigos de recuperacion y le pide que ponga su propia contraseña —esa
  contraseña **no** sirve para entrar: sirve para autorizar los cambios de dinero.

  **Lo que ahora hay que hacer bien es el correo.** Como no hay clave que entregar, ese
  correo ES su forma de entrar: tiene que ser su cuenta de Google. Si se pone mal, nace
  una empresa a la que no puede entrar nadie.

  Y si alguien sigue una instruccion vieja y manda una contraseña, **el sistema la
  rechaza** en vez de ignorarla. Ignorarla seria lo peor: el operador veria una clave en
  su pantalla y creeria haberla entregado, cuando la cuenta habria nacido con otra.

- **Ya se puede cerrar la entrada por contraseña, porque por fin hay otra puerta.**
  Lo que se decidio esta manaña era una intencion; hoy es un interruptor de verdad, y
  viene acompañado de las dos cosas sin las que habria sido peligroso encenderlo.

  - **Codigos de recuperacion.** Cuando un Dueño entra por primera vez, el sistema le
    enseña **diez codigos** y le obliga a decir que ya los guardo antes de dejarlo
    seguir. Se muestran **una sola vez** y no se pueden volver a ver: ni nosotros
    podemos, que es justo lo que los hace servir de algo. Cada uno vale **una vez**.
  - **Una puerta para usarlos.** Si algun dia pierde su cuenta de Google, teclea uno de
    esos codigos y entra. El sistema le dice cuantos le quedan, para que no gaste el
    ultimo sin darse cuenta.
  - **Y el interruptor.** Una cuenta se puede marcar como «solo Google»: a partir de
    ahi su contraseña **ya no abre**. Con eso deja de importar que quien hizo la
    instalacion haya visto una contraseña en su pantalla.

  **Nace apagado para todos**, a proposito: encenderlo de golpe habria dejado fuera a
  cualquiera que no tenga Google vinculado, incluidos nosotros. Se enciende cuenta por
  cuenta, y solo despues de comprobar que esa persona puede entrar de otra forma.

  Un detalle que parece menor y no lo es: **una cuenta desactivada no entra ni con
  codigo**. Si a alguien se le retiro el acceso, se le retiro por todas las puertas —
  un codigo guardado de antes no se lo devuelve.

- **Se decidio como entra cada persona al sistema, y queda escrito.** Hasta hoy habia
  una decision apuntada de agosto que decia una cosa y un sistema que hacia otra: es el
  tipo de contradiccion que se descubre el peor dia posible.

  La regla nueva, en corto: **quien manda entra con Google, y quien cambia algo teclea
  su contraseña.** Son dos cosas distintas a proposito.

  - Las cuentas del servidor principal —el nuestro, desde el que se ve y se administra
    toda la flota— entran **solo con Google**.
  - El **Dueño** de cada empresa nueva, tambien **solo con Google**. Con esto deja de
    existir la contraseña que hoy genera quien hace la instalacion: si no se genera
    ninguna, no hay ninguna que se pueda filtrar.
  - Los **demas usuarios** de una empresa eligen: contraseña o Google. No se les
    obliga, porque quien instala una pantalla o captura una orden no siempre tiene
    cuenta de Google de trabajo.
  - Y **para cualquier cambio importante hace falta la contraseña**, aunque hayas
    entrado con Google.

  Esto es la decision escrita, **todavia no el programa**: se construye despues, y no
  antes de que la instalacion automatica quede probada.

- **Y se anoto un riesgo que hay que resolver antes del primer cliente:** si el Dueño
  de una empresa pierde el acceso a su cuenta de Google y todavia no eligio contraseña,
  **se queda fuera y no hay otra puerta**. Hay tres formas de arreglarlo y hay que
  elegir una. Queda apuntado como pendiente, no dado por resuelto.

- **Se encendio el alta automatica de empresas, y fallo el primer intento.** El
  formulario de la pagina ya puede crear la maquina de un cliente. Se probo con una
  empresa de mentira y **no funciono a la primera** — pero fallo bien: **no se creo
  ninguna maquina y no se cobro nada**, porque el sistema comprueba que tiene todas
  las herramientas ANTES de crear nada.

  Aparecieron dos problemas, y el primero es el interesante: **el sistema perdio el
  mensaje que explicaba el fallo.** En la pantalla solo se veia «Creando el
  droplet», sin causa. Dos partes del programa escribian en el mismo archivo a la
  vez y se pisaban, y la que se perdio era justo la que traia el motivo. Arreglado,
  con cuatro comprobaciones automaticas nuevas.

  El segundo era el fallo de verdad: **faltaba encontrar una herramienta** que el
  sistema necesita para crear maquinas. Estaba instalada, pero en un sitio donde el
  proceso automatico no la buscaba. Tambien arreglado.

  **La leccion, que vale para todo:** un fallo en el registro de lo que pasa no es
  un fallo menor — es el que te deja sin saber cual fue el fallo de verdad.

- **Y se rotaron unas llaves de acceso** que se compartieron por descuido en una
  conversacion. Nadie las uso, pero se cambian igual: la regla es que una llave que
  salio de su sitio se da por perdida.

- **Segundo intento del alta: fallo otra vez, y esta vez el sistema SI dijo por que.**
  Eso era justamente lo que se acababa de arreglar, y funciono en su primer uso.

  El motivo: una de las herramientas que el sistema necesita para crear maquinas
  estaba instalada en un formato (**snap**) que **no puede funcionar** dentro del
  proceso automatico, porque ese proceso corre con los permisos deliberadamente
  recortados — es el unico del servidor que guarda las tres llaves importantes.

  Se podia aflojar esos permisos para que la herramienta cupiera. **Se decidio que
  no**: se cambio la herramienta por una version normal, que no necesita permisos
  especiales. Con eso desaparecen **tres** problemas distintos que ese formato ya
  habia causado.

  **Y quedo escrito como paso obligatorio de la instalacion**, que antes no existia
  en ningun documento: como llegaba esa herramienta al servidor era algo que solo
  sabia quien la habia puesto a mano.

  **La leccion, y es incomoda:** la comprobacion previa que existia para no gastar
  dinero **daba luz verde con el sistema roto**, porque no reproducia las
  condiciones reales del proceso automatico. Una comprobacion asi es peor que no
  tener ninguna. Ya esta corregida.

- **🎯 Y al tercer intento funciono: se dio de alta una empresa desde la pagina, de
  principio a fin, y se entro a su sistema.** Seis minutos y dos segundos desde
  apretar el boton hasta tener la maquina lista. Nadie escribio un comando para
  crearla.

  Se comprobo todo el recorrido: la maquina se crea, se instala sola, se le pone su
  nombre de internet, su certificado de seguridad, se levanta la aplicacion y se
  entra desde el navegador con la cuenta del Dueño. **Es lo que hara falta hacer
  cada vez que entre un cliente nuevo, y ya funciona.**

- **Pero al entrar aparecio algo que hay que arreglar ANTES del primer cliente
  real.** La version que se instala hoy es del **2 de septiembre**, y el arreglo de
  seguridad del dia 4 —el que obliga al Dueño a cambiar su contraseña— **no va
  dentro**.

  O sea: el arreglo existe, pero la version publicada no lo lleva. **Hay que
  publicar una version nueva antes de dar de alta a un cliente de verdad**, o
  nacera con el mismo problema que se corrigio hace tres dias.

  Es exactamente el tipo de cosa que solo se descubre haciendolo de verdad: estaba
  arreglado, probado y en verde, y aun asi no habia llegado a donde importa.

- **Y se arreglaron cinco cosas mas de la instalacion, la misma tarde.** La mas
  importante: **una empresa recien dada de alta quedaba apagada hasta las 4:17 de la
  manana.** El sistema dejaba programado el arranque para la madrugada y no encendia
  nada, asi que el cliente no podia entrar hasta el dia siguiente sin que nadie le
  explicara por que. Ahora se enciende al terminar la instalacion.

  Las otras cuatro son mensajes que mandaban a mirar al sitio equivocado: uno decia
  «falta un dato de arranque» cuando en realidad no habia podido ni conectarse; otro
  daba la instalacion por buena habiendo detectado que la pagina no respondia; y dos
  pedian datos que ese paso no usa.

  Y una de fondo: **la lista de datos de configuracion del sistema de altas no estaba
  guardada en ningun sitio del proyecto** -- vivia dentro de una hoja de instrucciones.
  Por eso se quedo desactualizada dos veces en cuatro dias. Ahora tiene su archivo
  propio, con la explicacion de cada dato al lado, y la hoja lo copia en vez de
  repetirlo.

- **Y una sexta, que aparecio justo al comprobar las anteriores.** El paso que crea la
  primera empresa de un cliente **daba el trabajo por bueno sin comprobarlo**: podia
  fallar y aun asi imprimir en pantalla «ya existe la empresa», dejando al operador
  con una contrasena que no servia para nada. Que el intento de hoy fallara a la vista
  fue **suerte**, no diseno. Ahora comprueba de verdad, y si algo sale mal dice que la
  contrasena no sirve y por que.

- **La conclusion honesta del dia, y es una deuda:** el programa que instala las
  maquinas de los clientes **es el unico grande que no tiene pruebas automaticas**. Su
  hermano, el que las actualiza, tiene un juego de pruebas mas grande que el propio
  programa -- y por eso sus fallos se descubren antes de llegar a un cliente. Los seis
  de hoy se descubrieron **con una maquina encendida y cobrando**.

  No se arregla en una tarde, pero es lo que hay que construir antes de tener varios
  clientes en marcha.

## 2026-09-04

- **Se termino la primera instalacion completa de una copia nueva, y se comprobo que
  funciona.** Se creo una maquina desde cero, se instalo el sistema entero, se dio de
  alta la primera empresa con su Dueño y se entro desde el navegador. Al terminar, la
  maquina se borro: era de prueba.

  Se contesto ademas una duda que llevaba **casi un mes** abierta: una instalacion
  nueva nace con la **moneda correcta (pesos mexicanos)**. No hacia falta arreglar
  nada, pero hasta hoy nadie lo habia comprobado.

- **Y se corrigio algo importante de seguridad.** Cuando se da de alta a un cliente, su
  contraseña la genera quien hace la instalacion y aparece **una sola vez** en su
  pantalla. Hasta hoy, esa contraseña **valia para siempre**: el sistema no obligaba a
  cambiarla al entrar. Ahora si.

  Lo llamativo es que habia una comprobacion automatica que decia que esto ya estaba
  bien — pero estaba mirando **otro camino distinto** del que usan las instalaciones de
  clientes. Se corrigio, y ahora la comprobacion mira el camino de verdad.

- **Nace el tablero de la flota.** En `space-os.io/flota/` se ve, desde el navegador,
  que version corre cada copia instalada y si responde. Antes eso solo se podia mirar
  entrando al servidor por consola.

  Entran solo las personas con permiso de administracion, y **el tablero no guarda
  ninguna contraseña ni llave**: le pregunta al sistema principal quien eres. Si
  alguien cierra sesion alli, el tablero se cierra tambien.

- **Y queda listo —pero todavia sin encender— el alta desde esa misma pagina.** Un
  formulario para dar de alta una empresa nueva sin escribir comandos. Se enciende el
  **lunes**, cuando se pongan las llaves de acceso. Esta partido en dos a proposito: la
  pagina que se ve desde internet **no tiene ninguna llave**; quien crea las maquinas es
  otro programa que no se asoma a la red.

---

## 2026-09-03

- **La lista de comprobaciones del ensayo de instalacion estaba incompleta, y se
  arreglo antes de usarla.** Antes de montar el servidor de prueba se compararon las
  instrucciones con lo que el plan exige comprobar, y **faltaban cuatro
  comprobaciones de cuatro**. Las cuatro son de las que no se ven a simple vista:

  que **nadie de fuera pueda registrarse solo** en la copia nueva; que la aplicacion
  **de verdad este hablando con su informacion** —y no solo pintando una pantalla de
  entrada bonita, que es lo que paso en el servidor principal durante cuatro dias—;
  que la puerta que crea la **primera empresa se cierre sola** y no se pueda volver a
  usar; y que **repetir la actualizacion no haga nada**.

  Tal como estaban escritas, el ensayo habria salido «en verde» sin haber comprobado
  ninguna de esas cuatro cosas. Ahora estan dentro, y se corren en el mismo viaje.

- **Y se instalo por primera vez una copia completa del sistema en una maquina
  nueva, de principio a fin.** Es el ensayo previo a instalarsela a un cliente. La
  maquina se creo, se preparo y quedo con la base de datos al dia: **75 cambios de
  base de datos aplicados** sobre una base vacia, y el paquete que se descargo es
  **exactamente el aprobado** — se comprobo comparando su huella.

  **Aparecieron cinco problemas, y ninguno le va a pasar ya al primer cliente.** Tres
  de ellos solo podian verse haciendolo de verdad: la maquina nacia **sin la llave de
  acceso**; el sistema intentaba entrar **antes de que la maquina terminara de
  arrancar**; y la instalacion se quedaba **una hora parada** esperando una pregunta
  en pantalla que nadie podia contestar. Los tres estan corregidos y con pruebas que
  impiden que vuelvan.

  Falta terminar el ensayo —el nombre en internet, el certificado, arrancar la
  aplicacion y crear la primera empresa— y despues **borrar la maquina**, que es
  desechable.

- **Se reviso ademas que las instrucciones siguieran coincidiendo con el sistema de
  hoy** —seis puntos, ninguno desfasado—, incluida la cuenta de cambios de base de
  datos que una instalacion nueva debe aplicar. No cambio nada del programa: solo la
  hoja de ruta con la que se va a instalar.

---

## 2026-09-02

- **La copia de pruebas ya se instala igual que se instalara la de un cliente.** Hasta
  hoy funcionaba de otra manera: leia el codigo directamente de la carpeta del
  proyecto. Eso servia para probar la aplicacion, pero **no probaba la instalacion**,
  que es justo la parte que nunca se habia ensayado de verdad.

  Ahora la copia de pruebas se instala desde el **paquete** —el mismo que descargara
  cualquier cliente—, se actualiza con el mismo procedimiento y lo revisa sola cada
  madrugada. Dicho de otro modo: **el camino que va a recorrer un cliente ya lo
  recorrio alguien antes**, y se recorrio en un servidor de verdad, no en una
  simulacion.

- **Y se comprobo lo que mas importaba: que la copia de seguridad se hace ANTES de
  cambiar nada.** El sistema guarda una copia de la informacion, aplica el cambio y
  solo entonces enciende la version nueva. Si el respaldo saliera vacio, se para y no
  toca nada — y esa proteccion se probo funcionando, porque hace dos dias fallaba
  precisamente ahi.

  Tambien se comprobo que **repetir la operacion no hace nada**: al correrla dos
  veces, la segunda contesto «sin cambios». Eso es lo que hace seguro que se revise
  automaticamente cada noche.

- **Aparecieron cuatro problemas mas, y los cuatro solo se veian ejecutando.** El mas
  importante: **el procedimiento para deshacer no funcionaba**. Estaba escrito, parecia
  correcto y habria fallado justo el dia que hiciera falta usarlo — que es la peor
  forma de descubrir que una red de seguridad no existe. Ya esta corregido y probado.

  Es el mismo patron de toda esta semana: **los problemas que quedan no se encuentran
  leyendo, se encuentran haciendo.** Van doce en este camino, y los seis ultimos
  aparecieron al correrlo contra maquinas reales.

- **Y se descubrio que una aprobacion que constaba como hecha nunca ocurrio.** El
  registro del 01/09 decia que ya habia una version **aprobada** del sistema. Al
  intentar aprobar la siguiente, el sistema contesto que **no habia ninguna
  aprobada todavia** — o sea que aquello se dio por hecho sin comprobarlo.

  No hay dano: nadie habia instalado nada desde esa etiqueta, porque no existe
  ninguna instalacion de cliente. Pero conviene decirlo tal cual, porque es el
  mismo tropiezo de otras veces: **se escribio que algo estaba hecho en vez de
  mirar si lo estaba.**

  Y al mirarlo aparecio la razon de fondo: la aprobacion **no podia funcionar**.
  El paso que marca una version como aprobada usaba una herramienta que, en vez de
  ponerle la etiqueta al paquete, creaba una envoltura nueva alrededor — y entonces
  el sistema, que comprueba que el paquete aprobado sea EXACTAMENTE el que se
  probo, se negaba con razon. Ya esta corregido: ahora se le pone la etiqueta al
  mismo paquete, sin envolverlo.

- **Y por la tarde ya SI hay una version aprobada de verdad: la `v0.3.0`.** Es la
  primera que llega al canal que miran las instalaciones de los clientes, y esta vez
  no se da por hecha: el propio sistema volvio a leer el paquete despues de
  aprobarlo y comprobo que es exactamente el que se habia probado.

  Costo **cuatro intentos**, y ninguno fue culpa del programa. Tres veces se paro
  por como estaba escrito el dato que se le pasaba: una direccion con un espacio de
  mas delante, y un numero de version con un punto de mas detras. **El sistema
  enseño el valor entre comillas cada vez**, que es lo unico que hace visible un
  espacio o un punto, y en ninguno de los tres intentos llego a tocar nada.

- **La copia de seguridad va a poder salir del servidor, y hasta hoy no podia.** El
  sistema ya sabia enviar la copia de seguridad y el registro de cada actualizacion a
  un almacen externo — pero **al preparar un servidor nuevo no se instalaba el
  programa que hace el envio**, asi que ninguna instalacion podia enviar nada.

  Lo peor no era el hueco: era que **no daba ningun error**. La actualizacion
  terminaba correctamente, todo salia en verde, y la copia se quedaba en la misma
  maquina que pretende proteger. Se habria descubierto el unico dia en que una copia
  externa importa: cuando la maquina se pierde.

  Ya esta corregido, y ahora hay una prueba que se pone roja si alguien lo quita.
  **Falta la parte que no es programacion**: crear los dos almacenes y sus claves,
  que es una tarea de una persona y esta escrita paso a paso.

  Y de paso esto resuelve la mitad de otro problema: hoy, para averiguar por que
  fallo una actualizacion en el servidor de un cliente, **hay que entrar a su
  servidor** — o sea, a los datos de su negocio. Con el registro fuera, la mayoria de
  los casos se diagnostican sin entrar.

- **Que falta para poder vender el servicio.** Del plan de trabajo quedan **dos**
  tareas, y las dos son la misma cosa: **instalar de cero**. Una es un ensayo con un
  servidor desechable y la otra es el alta del primer cliente.

  Y aparte del plan quedan **dos cosas que el plan nunca incluyo**, las dos necesarias
  para *vender* y no solo para *entregar*: **como se atiende una averia** —quien puede
  entrar al servidor de un cliente, con que permiso y dejando que rastro— y **la copia
  de seguridad fuera del servidor**, porque hoy el respaldo vive en la misma maquina
  que protege: si esa maquina desaparece, desaparece con ella.

---

## 2026-09-01

- **El sistema ya puede publicar a pantallas desde una instalacion nueva.** Publicar
  una campana a las pantallas no lo hace la aplicacion sola: llama por dentro a un
  programa auxiliar. Y ese programa **no viajaba dentro del paquete**, asi que una
  instalacion recien creada habria fallado en la primera campana que intentara
  publicar. Para un negocio de publicidad exterior eso no es un detalle: es el
  producto.

  Ahora el paquete lo lleva dentro, junto con la configuracion que necesita. **Nace
  apagado a proposito**: se enciende el dia que el cliente entrega su credencial de
  DOOHmain, que es suya. Encenderlo antes solo conseguiria que fallara cada campana.

- **Y se crean las tablas que impiden publicar dos veces lo mismo.** El programa
  auxiliar apunta que campana, que arte y que lista ya envio, para que reintentar no
  duplique lo que sale en pantalla. Esas tablas habia que crearlas **a mano**, y en
  una instalacion nueva no las creaba nadie. A partir de ahora se crean solas al dar
  de alta la instalacion.

- **Ya existe una version aprobada del sistema, y se llama `v0.1.0`.** Hasta ayer
  habia versiones **de prueba**: empaquetadas y guardadas, pero marcadas como «aun
  no revisadas». Hoy una de ellas paso la revision y quedo marcada como
  **estable**, que es la etiqueta que miran las instalaciones de los clientes.

  > ⚠️ **ESTO ERA FALSO, y se descubrio el 2026-09-02.** Esa aprobacion **nunca
  > ocurrio**: no habia ninguna version marcada como aprobada. Se dio por hecha sin
  > comprobarlo. Lo que sigue en este apartado describe como FUNCIONA el mecanismo,
  > y eso sigue siendo cierto; lo que no es cierto es que se hubiera usado. Ver la
  > entrada del 02/09.

  El paso no es automatico **a proposito**: alguien tiene que pedirlo, y antes de
  concederlo el sistema **va a mirar la copia de pruebas** y comprueba que
  responde. Si no responde, no aprueba nada. Ademas **no vuelve a empaquetar**: se
  aprueba exactamente el mismo paquete que se probo, no uno nuevo construido otra
  vez.

  Todavia no hay ninguna instalacion de cliente que lo descargue —no existe
  ninguna—, pero **la tuberia entera esta probada de punta a punta**: se empaqueta,
  se prueba, se aprueba y queda listo para instalar.

- **Y conviene decir lo que la revision NO comprueba todavia**, porque el propio
  sistema lo escribe en su informe: **no verifica que la copia de pruebas este
  corriendo esa version exacta**. Comprueba que responde. Esa segunda comprobacion
  se enciende sola cuando la copia de pruebas pase a instalarse igual que una
  instalacion de cliente, que es el siguiente trabajo pendiente.

---

## 2026-08-31

- **Se repasó la documentación interna entera y se corrigió lo que había dejado
  de ser verdad.** El proyecto guarda, junto al código, una documentación que
  describe **cómo funciona el sistema hoy**. Su utilidad depende de una cosa: que
  se pueda confiar en ella sin ir a comprobar. En los últimos cuatro días
  cambiaron bastantes cosas por dentro y varias de esas descripciones se
  quedaron contando lo de antes.

  Lo que se corrigió, en lenguaje llano:

  - **El programa que enciende el sistema en el servidor cambió el 28 de agosto**,
    y la documentación seguía nombrando al anterior. Es de las peores
    equivocaciones posibles: el archivo del programa viejo sigue ahí, así que
    quien leyera la frase la daría por buena, y **usarlo hoy haría que los dos
    programas se peleen por atender a la gente**.
  - **Las instrucciones para revisar el trabajo antes de darlo por bueno estaban
    mal escritas**, y el error se heredaba a todo el que entra al proyecto:
    faltaba indicar en qué carpeta se ejecutan, así que los comandos respondían
    «no existe» y eso se lee como «algo está roto» en vez de «me falta un paso».
  - **Faltaba escrito un candado de seguridad que se puso el 28 de agosto:**
    facturar, cobrar y pagar una renta ahora piden la contraseña. Antes el
    permiso del puesto sí aplicaba —no podía facturar cualquiera—, pero **nadie
    comprobaba que quien está al teclado sea de verdad esa persona** y no alguien
    que encontró una sesión abierta. Toda organización nueva nace ya con el
    candado puesto.
  - **Faltaba también la solución a un problema real:** el 25 de agosto, quien
    entró con su cuenta de Google se quedó **encerrado fuera del sistema**,
    porque para poner una contraseña nueva se le pedía la anterior, que nunca
    había tenido. Ya está resuelto y ahora está explicado.
  - **Se corrigieron los conteos** (cuántas pantallas, cuántos cambios de base de
    datos) y una decena de referencias que apuntaban a un sitio equivocado
    después de que los archivos crecieran.
  - **Se avisa, arriba del todo, de lo que caducó sin romperse:** los documentos
    escritos antes del 12 de agosto describen el modelo anterior —varios clientes
    compartiendo una instalación— y hoy **cada cliente tiene la suya**. Todo lo
    que dicen sigue existiendo; ya no significa lo mismo.

  Y se deja escrito **qué se comprobó y qué no**: 17 documentos se revisaron uno
  a uno contra el código; otros 8 solo pasaron las comprobaciones automáticas y
  **conservan su fecha antigua a propósito**, para que nadie los dé por
  verificados. Ponerles la fecha de hoy habría sido peor que dejarlos como
  estaban.

- **Ya hay un almacén para las actualizaciones, y se llama `registryspaces`.**
  Hasta hoy, cada vez que se quería actualizar el sistema, el servidor tenía que
  **armar la aplicación él mismo**: descargaba el código y lo construía, con dos
  minutos de la máquina al 100 % mientras seguía atendiendo a la gente. Con un
  servidor se aguanta; con diez clientes, cada uno armando su copia por su
  cuenta, hay un problema peor que la lentitud: **no todos armaban lo mismo**.
  Se comprobó el 28 de agosto — dos máquinas que se suponía tenían «la misma
  versión» podían acabar con piezas distintas, y eso **no avisa de nada**.

  A partir de ahora la aplicación **se arma una sola vez**, en una máquina
  limpia y controlada, y de ahí sale un paquete cerrado que se guarda en este
  almacén. Cada servidor **se lo baja ya hecho** en lugar de construirlo. Lo que
  corre en la máquina de un cliente es, pieza por pieza, exactamente lo que se
  probó.

  El almacén se creó en **DigitalOcean**, en la región **NYC3** (la misma que
  los servidores, así el paquete no cruza medio mundo al instalarse) y con el
  **plan gratuito por ahora**: medio gigabyte. Alcanza para empezar; cuando
  apriete se sube de plan por unos 5 dólares al mes. Todavía **no sabemos cuánto
  pesa el paquete** porque nunca se ha armado: se mide en la primera versión que
  se publique.

  Nada de esto cambia lo que ves ni cómo se usa la aplicación. Es la tubería por
  donde llegarán las actualizaciones de aquí en adelante.

- **Las versiones pasan a tener dos etapas antes de llegar a un cliente.** El
  paquete nuevo se publica primero en un canal de pruebas (`beta`), que **solo
  mira la demostración**. Únicamente cuando ahí funciona se marca como estable, y
  **estable es lo único que instalan los clientes**. Si una versión trae las
  pruebas en rojo, **no se publica nada**: no hay forma de que llegue a un
  servidor sin haber pasado antes.

- **Y ya hay una primera versión empaquetada y guardada.** La aplicación se armó
  una sola vez, en una máquina limpia, y el paquete resultante quedó guardado en
  el almacén con el nombre `v0.0.1-rc2`. Es la primera vez que existe una versión
  de SPACE OS como tal: hasta hoy solo había código, y cada servidor se hacía su
  propia copia.

  De momento está en el **canal de pruebas**, que es el que mira la demostración.
  Ninguna instalación de cliente lo ve, y no lo verá hasta que alguien la marque
  como estable a mano — eso es un paso aparte y deliberado.

- **El control de calidad se estrenó impidiendo una publicación, que es para lo
  que está.** El primer intento **no publicó nada**: al armar el paquete se
  corrieron las pruebas y once salieron mal, así que el proceso se detuvo antes
  de guardar nada. No era un problema del sistema — eran dos fallos de las
  propias pruebas, que llevaban semanas escondidos porque nunca se habían
  ejecutado fuera de la computadora del desarrollador. Se corrigieron y el
  segundo intento pasó las **1 304 pruebas** sin una sola falla.

  Lo que importa de esto: **una versión con pruebas en rojo no se puede publicar
  aunque alguien quiera**. No es una comprobación que se pueda olvidar; es el
  orden en que están puestas las cosas.

- **La copia de pruebas del sistema tiene por fin su propia dirección:
  `prueba.space-os.io`.** Existe una segunda copia de la aplicación, separada de
  la de trabajo, que sirve para **probar cada versión nueva antes de que llegue a
  nadie**. Funcionaba, pero no tenía dirección propia: solo se podía ver desde
  dentro del servidor.

  Eso importaba más de lo que parece, porque **el sistema se niega a aprobar una
  versión sin haber mirado antes esa copia de pruebas**. Sin dirección, no había
  forma de mirarla, y por lo tanto no se podía aprobar ninguna versión.

  Es una dirección **nueva**, no la de la demostración antigua —esa se elimina—, y
  la usa el equipo, no los clientes.

- **Se retira el último camino que actualizaba el sistema entrando al servidor.**
  Había un procedimiento que se conectaba a la máquina, compilaba el programa
  **allí mismo** y lo reiniciaba. Ese era el modo antiguo, y tenía dos problemas:
  compilar en cada servidor no garantiza que salga lo mismo, y desde el 28 de
  agosto además **habría chocado** con la nueva forma de arrancar la aplicación
  —dos programas peleando por el mismo puerto—.

  A partir de ahora **cada instalación se actualiza sola**: revisa si hay una
  versión nueva aprobada, se la descarga ya preparada, hace copia de seguridad,
  aplica los cambios de la base y comprueba que todo responde. Si algo falla,
  **vuelve sola a la versión anterior**. Nadie entra a tocar nada. La única vez que
  se entra a un servidor es al **darlo de alta**, una sola vez.

- **Se retiran cuatro programas viejos que ya no se podían usar sin hacer daño.**
  Eran los que daban de alta una empresa cuando todas compartían una misma base de
  datos: creaban su espacio dentro de la base común y propagaban cambios a todas a
  la vez. Ese modelo se descartó en agosto —ahora cada cliente tiene su propia
  instalación—, así que esos programas ya no describían el sistema: describían uno
  que dejó de existir. **El riesgo de dejarlos era que alguien los corriera**
  creyendo que seguían sirviendo. En su lugar queda una nota que dice cuáles son los
  programas vigentes y una frase para evitar la recaída: dar de alta a un cliente es
  **preparar su instalación**, no añadir una fila a una tabla.

- **Los dos documentos del diseño viejo quedan marcados como descartados.** En
  agosto se diseñó otra forma de dar servicio a varias empresas —todas
  compartiendo una misma base de datos, separadas por la dirección web— y el
  2026-08-12 se decidió no hacerlo así: cada cliente tiene su propia instalación
  y su propia base. Esos dos documentos **no se borran**, porque el contexto de
  una decisión también es documentación, pero ahora **avisan en la primera línea**
  de que están archivados y a qué documento hay que ir. La confusión que evita es
  concreta: alguien podría abrirlos y ponerse a construir el modelo equivocado.

- **Queda una decisión pendiente y conviene que se sepa**: qué dirección de
  internet representa a la demostración a la hora de dar el visto bueno a una
  versión. Hoy `demo.space-os.io` apunta a la máquina vieja, que quedó fuera del
  modelo y corre código del 11 de agosto, así que usarla haría que se revisara
  **la máquina equivocada** y se diera por buena una versión que no es. Mientras
  eso no se decida, se pueden publicar versiones de prueba pero **no marcarlas
  como estables**.


## 2026-08-28

- **Facturar, cobrar y pagar una renta ahora piden tu contraseña.** Hasta hoy no
  la pedían: bastaba con que tu usuario tuviera el permiso. Eso deja fuera a
  quien no debe entrar, pero no comprueba que quien está frente a la pantalla
  seas tú y no alguien que encontró tu sesión abierta. **Te la pide una vez y
  vale por quince minutos**, así que facturar diez campañas seguidas la pide una
  sola vez. Editar clientes, propuestas o pantallas **no** la pide. Si a tu
  organización le estorba, se puede apagar.


- **La protección del navegador pasa de avisar a bloquear.** Desde hace dos días
  la aplicación venía anotando en silencio qué contenido externo cargaba, sin
  impedir nada, para poder decidir con datos. Ya no queda ninguno: las letras se
  sirven desde la propia aplicación y se retiró un resto de código viejo que
  hablaba con fuera. **Ahora sí bloquea.** Si un día apareciera contenido
  inyectado por alguien que no debe, el navegador se niega a ejecutarlo.


- **El programa que atiende la aplicación dejó de correr con permisos de
  administrador.** Hasta hoy funcionaba con la cuenta que puede hacer cualquier
  cosa en el servidor; ahora tiene una cuenta propia que solo puede tocar lo
  suyo. No cambia nada de lo que ves ni de cómo se usa: si alguien encontrara
  una forma de abusar de la aplicación, ahora llegaría mucho menos lejos.


- **Las letras de la aplicación ya no vienen de un servidor ajeno.** Hasta hoy,
  cada vez que alguien abría una pantalla, su navegador iba a pedirle las
  tipografías a una empresa de fuentes en internet. Eso significaba tres cosas:
  que si ese servicio se caía la aplicación se veía mal para todos a la vez, que
  un tercero recibía la dirección de cada persona que entraba, y que la página
  tardaba un poco más en pintar el texto. **Ahora las letras viajan dentro de la
  propia aplicación.** Se ven igual de bien —cambia la familia de los títulos, a
  una con más carácter— y ya no dependen de nadie.

## 2026-08-27

- **El RFC de un cliente ya no se puede repetir dentro de la misma
  organización.** Hasta hoy nada impedía dar de alta dos veces al mismo cliente
  con el mismo RFC, y acababan compitiendo en las listas y en la facturación.
  Ahora el sistema lo rechaza al guardar. Al aplicar la regla se comprobó que
  **no había ningún RFC repetido**, así que ningún cliente existente se vio
  afectado ni hubo que elegir cuál se quedaba.

- **La lista de arrendadores ya dice si un propietario se puede dar de baja.** La
  columna «Contratos» enseñaba el total, y el total no es lo que decide: solo
  los contratos **vigentes** lo impiden, y también los **predios** a su nombre.
  Así que mentía en las dos direcciones —tres contratos vencidos parecían un
  bloqueo y no lo eran; cero contratos parecía vía libre y podía acabar en un
  aviso—. Ahora la columna dice **vigentes de total** y hay una columna
  **Predios** al lado. Y esas cifras dejan de moverse con los filtros de la
  pantalla: describen al propietario, no lo que hay filtrado.

- **Ya se puede quitar un cliente y dar de baja a un propietario desde la
  aplicación.** Hasta hoy no había botón para ninguna de las dos cosas: lo que
  se daba de alta por error se quedaba en la lista para siempre —la revisión de
  agosto dejó diez clientes de prueba que nadie podía retirar—. Ahora cada fila
  tiene su botón, con estas reglas:
  - **Te pide la contraseña, siempre.** Aunque tu organización tenga apagado el
    candado de cambios. Son acciones que no se deshacen.
  - **Solo lo ve quien puede aprobar.** A quien únicamente edita no se le
    enseña el botón.
  - **Cuando no se puede, dice qué lo impide y cuánto hay.** «tiene 2 campañas y
    3 facturas», en vez del antiguo «el registro está referenciado por otro»,
    que era correcto y no servía para nada.
  - **Avisa antes de pulsar de lo que se lleva por delante.** Quitar un cliente
    deja sus propuestas sin dueño, y esas propuestas pasan a calcular el IVA
    general en vez del suyo: **puede cambiarles el precio**. Se dice con la
    cifra delante y hay que confirmarlo aparte.
  - **Dar de baja a un propietario no borra su historia.** Sus contratos y pagos
    anteriores se conservan; deja de aparecer en Arrendadores y de poder
    elegirse en contratos nuevos. Eso sí: **no se puede reactivar desde la
    aplicación**, y no se deja dar de baja a quien todavía tenga predios o
    contratos activos.

- **Una pantalla digital vendida por propuesta ya rota sus anuncios.** Cuando se
  vendía una pantalla desde una propuesta, el sistema la registraba como si
  fuera una lona impresa. Consecuencia: **un solo anuncio se quedaba con toda la
  pantalla**, en vez de repartirse entre los que se contrataron. Solo ocurría
  por ese camino; vendiendo desde Comercial funcionaba bien.
- **Y esas pantallas ya se liberan al terminar la campaña.** Por el mismo
  motivo, cuando una de esas reservas vencía **no devolvía su espacio**: la
  pantalla seguía contando como ocupada aunque la campaña hubiera acabado hace
  meses.

## 2026-08-26

- **La aplicación ya no acepta datos imposibles por la puerta de atrás.** La
  pantalla siempre validó bien lo que se escribe; el problema estaba en que si
  algo entraba **sin pasar por la pantalla** —un programa, una integración, una
  petición hecha a mano— el sistema lo aceptaba sin mirar. Se cerraron siete de
  esos huecos:
  - **Una orden de compra podía guardarse con un importe negativo.** Y no había
    forma de corregirla ni de borrarla desde la aplicación: quedaba ahí, y
    encima podía empujar la campaña a «lista para facturar».
  - **«Extender» una campaña podía ACORTARLA.** Bastaba mandar una fecha
    anterior a la que ya tenía, y se llevaba por delante también todas sus
    reservas.
  - **El RFC de tu propia empresa** —el que sale en las facturas— se aceptaba
    con fechas que no existen, como el mes 13. Ya se comprueba.
  - **Firmar un contrato o aceptar una propuesta** admitía un nombre de miles
    de caracteres, sin haber iniciado sesión, en un registro que después no se
    puede modificar.
  - **Un descuento que no fuera un número** se guardaba igual y contaminaba
    todos los importes de esa propuesta, en silencio y con la petición dando
    «correcto».
  - **Dos comparaciones de fechas estaban mal** y fallaban en las dos
    direcciones: dejaban pasar un periodo invertido y a la vez rechazaban uno
    correcto.

- **Se revisaron los 72 puntos por donde la aplicación recibe datos**, no solo
  los que fallaron. Queda una lista priorizada de lo que falta, en el
  repositorio, para irla cerrando por orden de gravedad.

- **Los plazos de cobranza que configuras ahora sí se usan.** En Administración
  se podían añadir y quitar plazos —45 días, 30 días, los que hicieran falta—,
  se guardaban bien, y al momento de facturar **el sistema los ignoraba y solo
  aceptaba 60, 90 o 120**. Quien configuraba 45 recibía un «Plazo inválido». Era
  una pantalla que prometía algo que no ocurría.
  - **Dos cuidados que se tomaron, y conviene conocerlos:**
  - Si una organización se queda **sin ningún plazo** configurado —se pueden
    borrar todos, uno a uno—, el sistema vuelve a 60/90/120 en vez de quedarse
    sin poder facturar. Quedarse sin facturación sería peor que el fallo que se
    corrigió.
  - **Las facturas ya emitidas no cambian.** Si mañana quitas el plazo de 45
    días, las facturas que ya salieron a 45 días siguen ahí, se siguen viendo y
    se siguen cobrando. Retirar un plazo no congela el dinero que ya está en la
    calle.

- **Quedó escrito, de una vez y en el sitio donde se guardan las decisiones, en
  qué consiste el producto.** Hasta hoy el modelo —«cada cliente tiene su propia
  copia del sistema, en su propia máquina, con su propia dirección»— vivía
  repartido entre un plan de trabajo y media docena de documentos sueltos. Ahora
  hay **una sola hoja** que lo dice, y que además fija tres cosas que se venían
  diciendo de formas distintas:
  - **Cómo se llama cada cosa.** La máquina de la casa se llama **PADRE**; la
    copia de pruebas, **DEMO**; la de cada cliente, **instancia**; el conjunto,
    **flota**. Y, hacia el cliente, **no se dice «tenant»**: se dice «su
    instancia» o «su organización». Esa palabra es de la base de datos, no del
    trato con la gente.
  - **Nadie toca el código dentro de la máquina de un cliente.** Ni para
    arreglar algo urgente. Todo se hace en la máquina de la casa, se publica una
    versión, y la copia del cliente **se la baja sola**. Una máquina retocada a
    mano ya no se puede volver a levantar igual, y con muchas copias eso se
    vuelve ingobernable.
  - **Nombres de internet reservados.** `demo`, `beta`, `panel`, `releases`,
    `status` y `www` no se le dan a ningún cliente. Es una nota para quien
    administre el dominio, no un candado en el programa: la dirección de un
    cliente ya no depende de cómo se llame su empresa dentro del sistema.

- **Se escribió, y se corrigió a la baja, qué se promete cuando algo se rompe.**
  El plan prometía que si una actualización sale mal el sistema se arregla solo
  en cinco o diez minutos y sin perder nada. **Al ir a comprobarlo contra lo que
  de verdad está programado, no era así**, y se corrigió en vez de dejarlo
  bonito:
  - Si falla la **puesta al día de la base de datos**, el sistema **no deshace
    nada por su cuenta** y avisa. Es a propósito: deshacer sin que nadie mire
    borraría lo que se haya trabajado desde la copia de seguridad. El cliente se
    queda en la versión anterior, funcionando, hasta que una persona lo revise.
  - Si la versión nueva **arranca y no responde**, ahí sí vuelve sola a la
    anterior. El corte dura entre unos segundos y unos tres minutos.
  - **Las copias de seguridad no son diarias.** Se hacen cuando hay versión
    nueva. Si pasan tres semanas sin actualizaciones, la copia más reciente
    tiene tres semanas. Conviene saberlo antes de necesitarlo.
  - Y lo más importante: **si la máquina de la casa se cae, ningún cliente se
    entera.** Ninguna copia le pide permiso para funcionar. Solo se queda sin
    servicio el panel interno.

- **La documentación interna dejó de describir el mundo viejo.** Dos apartados
  contaban todavía que todas las empresas compartían un mismo programa y una
  misma base de datos en una sola máquina. Ya no es así, y se reescribieron.
  De paso quedó anotado —sin disimularlo— que **todavía existe en el repositorio
  el viejo mecanismo de despliegue** que el modelo nuevo prohíbe: está previsto
  retirarlo y **aún no se ha hecho**.

- **Rectificación: la página de demostración `demo.space-os.io` SE QUEDA.** Más
  abajo en esta misma fecha se anotó lo contrario —que se retiraba y que había
  que quitarle el nombre—. **Eso era una lectura equivocada de la decisión, y se
  corrige aquí.**
  - **Lo que se decide de verdad:** esa dirección es **donde se va a enseñar el
    producto funcionando como lo verá un cliente**, es decir, sobre una copia
    suya y no sobre el sistema central. Por eso el nombre no sobra: es
    justamente para lo que sirve.
  - **No hay nada que hacer en el navegador.** La tarea de quitar el nombre
    **queda cancelada**.
  - **Lo que todavía no está decidido, y se deja dicho para no darlo por
    supuesto:** qué máquina va a servir esa dirección. Hoy la sirve la máquina
    de julio; podría quedarse ahí o mudarse a la primera copia de cliente cuando
    exista. También queda abierto su certificado de seguridad, que vence el
    **26 de octubre**.

- **Una copia nueva del sistema ya puede darse de alta sola.** Cuando se le
  entrega el sistema a un cliente, su copia nace **completamente vacía**: sin
  empresa dentro y sin ninguna persona que pueda entrar. Hasta hoy, para meter a
  la primera persona había que abrir la base de datos de esa máquina a mano.
  Ahora la copia se arranca sola: se le da una clave de un solo uso y ella crea
  su empresa y a su primer responsable.
  - **Solo funciona una vez, y no depende de que nadie se acuerde de cerrarla.**
    La puerta exige tres cosas a la vez: que se haya configurado la clave, que
    la clave sea la correcta, **y que la copia siga vacía**. Esa tercera es la
    importante: en cuanto existe la primera empresa, la puerta queda cerrada
    para siempre, aunque alguien conserve la clave. No hay un paso posterior que
    se pueda olvidar.
  - **Y a quien no tiene la clave, la puerta le parece inexistente.** No
    responde «clave incorrecta» —eso confirmaría que la puerta está ahí—, sino
    lo mismo que respondería una dirección que no existe. El precio, dicho
    claro: si quien da de alta una copia escribe mal la clave, recibe esa misma
    respuesta y no puede distinguir un caso del otro.

- **No va a haber una página de demostración aparte. La demostración va a ser el
  producto de verdad.** Hasta hoy el plan contaba con `demo.space-os.io`, una
  dirección separada donde enseñar el sistema a quien viniera a verlo. **Se
  retira.**
  - **Por qué:** esa página existía para enseñar *cómo van a ser* las copias del
    sistema que tendrá cada cliente, cuando todavía no existía ninguna. Hoy
    `space-os.io` es la dirección oficial y también donde se prueba, y lo que se
    va a enseñar es **el producto funcionando con una o más copias reales**. Una
    demostración con clientes de verdad vale más que un sitio aparte que los
    imita.
  - **Lo que esto cuesta, y conviene tenerlo presente:** **hasta que exista la
    primera copia de un cliente no hay dónde enseñar el producto a alguien de
    fuera.** Eso depende de la siguiente etapa del plan. Si hiciera falta antes,
    habría que volver a darle dirección propia a algo.
  - **Lo que se ahorra:** un certificado de seguridad que se intentó emitir cinco
    veces sin éxito, y una dependencia que había que renovar a mano y que, al
    caducar, habría tumbado el sitio en silencio tres meses después.

- **Queda una cosa por hacer, y la hace una persona en el navegador: quitarle el
  nombre público a la máquina vieja.** Mientras esa dirección siga apuntando a la
  máquina de julio, esa máquina **sigue siendo un sitio público** con cinco
  organizaciones dentro, hasta que su certificado venza el 26 de octubre.
  - **Abandonar un nombre no es lo mismo que retirarlo**, y esa diferencia es
    justo lo que esta etapa del plan existía para arreglar. La máquina no se
    apaga con esto: pierde su nombre público, que es lo que hacía falta.

- **Se cerraron las dos etapas del plan que estaban en curso, y se dejó por
  escrito qué quedó fuera de cada una.** Se cierran diciendo su alcance, no en
  verde limpio: lo que falta tiene nombre, dueño y ficha de trabajo. **Nada queda
  en «pendiente» sin decir de quién es.**
  - Sigue parada desde el 17 de agosto **una sola decisión** —dónde se guardan las
    versiones del programa— y sin ella no hay forma de que cada servidor se
    actualice solo. Es lo que más cosas destraba de todo el plan.

- **Se corrigieron tres desfases entre lo que decían los documentos y lo que era
  cierto**, encontrados al preparar el reporte: un apartado seguía pidiendo dos
  pasos que se habían anulado el mismo día, y el tablero de trabajo daba por «solo
  ensayado en local» algo que llevaba cinco días hecho en el servidor.

## 2026-08-25

- **Ya hay un manual de usuario completo.** Está en
  `vault/08-Manuales/manual-usuario-2026-08-25.md` y cubre **todo** lo que se
  puede hacer desde la aplicación: entrar, el Dashboard, Inventario,
  Arrendadores, Network, Clientes, Comercial, Disponibilidad, Propuestas,
  Campañas, Creativos, Imprenta, Operaciones, Almacén, Finanzas, Comisiones,
  Integraciones, Actividad, Administración y Configuración, más las tres
  pantallas que ven de fuera el cliente y el arrendador (la propuesta, el portal
  de seguimiento y la firma del contrato).
  - **Nombra los botones y los campos por su rótulo real.** El borrador anterior
    describía la acción —«crea una pantalla nueva»— pero no decía dónde pulsar.
    Este se escribió leyendo la interfaz, así que dice «Contrato + pantalla»,
    «Repartir a todas» o «Cambios bloqueados», tal cual aparecen en pantalla.
  - **Trae un capítulo de fallas con los mensajes literales.** Los veinte avisos
    que más frenan el trabajo —contrato incompleto, cupo de clientes, agencia sin
    validar, candado de facturación, factura duplicada— están citados palabra por
    palabra, con el sitio exacto donde se arreglan.
  - **Y un diccionario de estados**: qué significa cada etiqueta de color de
    pantallas, reservas, contratos, pagos, campañas, cobranza, impresión,
    órdenes de trabajo, creatividades y publicación.
  - **De las veinte preguntas abiertas del borrador quedan ocho.** Siete son
    decisiones de negocio que no se pueden deducir del sistema: si se va a
    encender el correo saliente, quién ocupa cada rol en la práctica, qué se hace
    con una orden asignada a la cuadrilla equivocada, y si el módulo Almacén está
    en uso real. Van listadas al final del propio manual.
  - **Al escribirlo apareció un ajuste que no hace nada.** En Administración se
    pueden capturar los «Plazos de cobranza (días)», pero la ventana de facturar
    no lee esa lista: ofrece siempre 60, 90 y 120. Quien añada un plazo ahí no lo
    verá al emitir la factura. Queda anotado; el manual lo advierte en su sitio
    en vez de callarlo.
  - El borrador del 11 de agosto se conserva marcado como superado.
- **Ya se puede entrar al sistema por su dirección de internet, y con Google.**
  Hasta hoy el servidor nuevo no servía para trabajar: se veía la pantalla de
  entrada, pero **nadie podía iniciar sesión**. Ahora funciona de punta a punta —
  dirección propia, candado de seguridad en el navegador, y acceso con la cuenta
  de Google.
  - **Qué hizo falta:** cuatro correcciones distintas, y **ninguna daba error por
    su cuenta**. La clave de la base de datos faltaba; el identificador de Google
    **había perdido un carácter** al copiarse en agosto; la dirección de retorno
    apuntaba al ordenador de un programador; y a la dirección registrada en
    Google le faltaba una barra al final.
  - **Lo que esto enseña, y vale más que la lista:** todas las comprobaciones que
    se hacían —que la página carga, que el servidor responde, que la
    configuración es válida— **pasaban con el sistema roto**. Lo único que
    encuentra estos fallos es **intentar entrar de verdad**. Se anota para que las
    comprobaciones de los próximos servidores incluyan eso.

- **La organización del sistema ya se llama «RGB» y no «RGB Catorce».** Es el
  nombre que encabeza las pantallas.
  - **Solo cambió el rótulo.** Se comprobó antes de tocar nada que la **razón
    social** y el **nombre comercial** estaban vacíos: si hubieran tenido valor,
    esto habría sido un cambio en un dato **fiscal** —el que sale en las
    facturas— y no un simple retoque de nombre.
  - Se aplicó con una pasada de prueba previa, comprobando que tocaba **una sola
    fila**, y queda guardado cómo deshacerlo.

- **Quien entra con Google ya puede ponerse contraseña sin conocer la anterior.**
  Al crear la cuenta de un responsable, el sistema genera una contraseña temporal
  y **la enseña una sola vez**. Si esa persona entra con Google y esa temporal se
  perdió, quedaba **encerrada**: la pantalla le pedía algo que nadie tenía, y no
  hay recuperación por correo porque este servidor no envía correos.
  - **Qué cambia:** si entraste con Google y **nunca** has puesto contraseña,
    puedes ponerla directamente. La pantalla te lo explica en vez de pedirte un
    dato imposible.
  - **Qué NO cambia, y es lo importante:** sigue haciendo falta la contraseña
    anterior para todo lo demás — cambiar el correo, o cambiar la contraseña una
    segunda vez. **La facilidad es de un solo uso por persona** y desaparece en
    cuanto la usas.
  - **Y sigues teniendo contraseña**, que es lo que el sistema pide para
    confirmar los cambios delicados. La idea no era quitarla: era poder ponerla.

- **Se puso al día la base de datos del servidor nuevo.** Le faltaba una
  actualización de ayer — la que arregla los permisos de las tablas que se creen
  en el futuro. Estaba aplicada en una de sus dos bases y no en la otra.

## 2026-08-24

- **El servidor nuevo llevaba cuatro días sin poder abrir sesión de nadie, y
  nadie lo sabía.** Desde que se puso en marcha el 21 de agosto, la pantalla de
  entrada se veía perfectamente y el servidor contestaba, así que se dio por
  hecho que funcionaba. **No funcionaba: el programa no tenía forma de hablar
  con su base de datos.** Cualquiera que hubiera intentado entrar habría recibido
  un error.
  - **Por qué no se notó:** el programa no avisa cuando le falta ese dato. En vez
    de negarse a arrancar, se conecta a una dirección de reserva pensada para el
    ordenador de un programador. Como ahí no hay nada, la aplicación arranca, se
    ve bien por fuera, y solo falla cuando alguien intenta hacer algo de verdad.
  - **Qué se hizo:** se generó una contraseña nueva para la base, se guardó donde
    el programa la lee, y se comprobó **con una prueba que sí distingue**: pedir
    entrar con un correo inventado. Antes daba «error del servidor»; ahora
    responde «correo o contraseña incorrectos», que es lo correcto — significa
    que **buscó en la base de datos de verdad**.
  - **La lección, y va escrita para que no se repita:** que una página se vea no
    demuestra que el sistema funcione. Las comprobaciones que se hacían al
    terminar de montar un servidor no incluían ninguna que necesitara la base de
    datos, así que este fallo las pasaba todas.

- **Se cerró un archivo de configuración que estaba abierto a todo el mundo.** El
  archivo con las claves del servidor se podía leer desde cualquier cuenta de esa
  máquina. Ahora solo lo lee quien debe. Ya estaba escrito en el procedimiento
  que había que hacerlo; **se había hecho en el papel y no en el servidor**.

- **Hay que cambiar una clave de Google, por un error nuestro.** Al revisar ese
  archivo de configuración se usó un filtro incompleto y **una de las claves
  salió a la vista**. No hubo acceso indebido, pero una clave que se ve deja de
  ser secreta: se sustituye por otra. El filtro correcto ya estaba escrito en la
  documentación del proyecto y se copió a medias.

## 2026-08-24

- **Se perdió el acceso al servidor de siempre, y ya no hay forma de entrar.**
  Es la máquina que lleva funcionando desde julio y la que atiende la página de
  demostración. **No está apagada**: sigue encendida y sigue contestando a quien
  entre por su dirección. Lo que se perdió es la llave — no se puede actualizar,
  ni corregir, ni apagar.
  - **Lo único que sí se controla es su dirección de internet**, porque el
    dominio está a nuestro nombre. Eso permite **quitarle el nombre público**, no
    apagarla: quien se sepa su número seguirá llegando.
  - **Una preocupación del día quedó descartada el mismo día, y era más
    pequeña de lo que se escribió.** Esa máquina llevaba activada la publicación
    de contenido, así que había que comprobar si estaba mandando algo sin que
    nadie pudiera detenerlo. **Se revisó y no hay nada publicando: está limpio.**
    - **Corrección importante, y la hizo Emiliano:** varios documentos internos
      de ese día —y una versión anterior de esta misma entrada— decían que esa
      publicación llegaba a **pantallas reales de clientes**. **No es así: la
      publicación de este sistema ha ido siempre a pantallas de PRUEBA, nunca a
      pantallas de un cliente.** El programa no puede saber qué hay al otro lado
      —solo decide si manda o no manda—, así que eso se afirmó sin el dato.
    - **Lo que sí sigue siendo cierto, y no dependía de eso:** se comprobó desde
      el lado de DOOHmain, que es el único al que se llega. Queda demostrado que
      **no ha publicado nada**, no que no pueda hacerlo. Y lo que se llegue a
      publicar **no se retira borrando información** de esta base: eso se retira
      desde DOOHmain.
  - **Su certificado de seguridad vence el 26 de octubre** y no se va a renovar
    solo. Esa es la fecha límite natural de todo este asunto.

- **Corrección de lo que se anotó el 21 de agosto.** Aquella entrada decía que
  «el servidor viejo se queda como el de demostraciones» y que eso ahorraba
  contratar uno. **Eso ya no puede ocurrir**, por lo de arriba: no hay nada que
  reutilizar. Se decidió otra cosa, y va en el punto siguiente.

- **La demostración pasa a vivir dentro del servidor nuevo, el que lleva el
  control.** Es la única máquina que hay, y contratar otra costaba unos 12
  dólares al mes. Van a convivir dos sitios separados en un mismo servidor:
  **cada uno con su dirección, su base de datos, su programa y su usuario**.
  - **Qué se gana:** no hay que contratar nada, y la información de la
    demostración **no se mezcla con la de verdad** — son bases de datos
    distintas, y eso se comprueba contando: la de la demostración no tiene ni una
    fila de ningún cliente.
  - **Qué se acepta a cambio, y conviene que esté escrito:** la demostración es,
    por definición, la parte más expuesta —es pública y la toca gente de fuera— y
    ahora comparte máquina con la que guarda las llaves de todo. Separarlas por
    dirección, por base y por usuario **ayuda, pero no es una pared**. Se decidió
    a sabiendas, y queda anotado **cuándo hay que volver a mirarlo**: en cuanto
    entre el primer cliente de pago, o en cuanto la demostración se abra a
    tráfico que no sea una demostración acompañada.

- **El sistema va a tener por fin una dirección de internet propia.** Hasta hoy
  al servidor nuevo solo se llega **escribiendo su número**, y por eso todavía no
  se puede iniciar sesión desde un navegador como es debido. Queda así:
  - **`space-os.io`** — el sistema.
  - **`demo.space-os.io`** — la demostración. **Es la dirección de siempre**, la
    que ya usaba la página de demostración, así que **no hay que avisar a nadie
    de ninguna dirección nueva**. Cambiar a dónde apunta es, además, lo que le
    quita el nombre público a la máquina perdida: las dos cosas de un solo gesto.

- **La demostración no va a mandar contenido a ningún sitio. Nunca.** Es una
  decisión y va escrita en su configuración. El motivo, corregido el mismo día:
  no es que llegaría a pantallas de clientes —eso nunca ha ocurrido, la
  publicación siempre ha ido a pantallas de prueba— sino que **a dónde se manda
  es un ajuste que cualquiera puede cambiar**, que una demostración no tiene por
  qué mandar nada a ninguna parte, y que lo que se publica **no se retira
  borrando información**.

- **En la demostración nadie puede crearse una cuenta por su cuenta.** Las cuentas
  las crea quien administra, igual que en el resto del sistema. Se comprobó
  además que el servidor viejo **también lo tenía cerrado** — era la última
  ocasión de preguntárselo antes de perderlo de vista, y la respuesta quedó
  anotada con fecha.

- **Dos arreglos que se notan al dar de alta una organización.** Al poner en
  marcha el servidor nuevo, el alta del Dueño **se creó con un texto de relleno
  en vez de un correo**, y nadie se enteró hasta después. Desde hoy el alta
  **comprueba que el correo parezca un correo y se niega si no**. Y por separado
  se corrigió un permiso de la base de datos que dejaba **tablas nuevas sin
  permisos y sin dar ningún error**, que es la peor forma de fallar.

- **Lo que falta, y no lo hace el programa: lo hace una persona.** Poner la
  dirección en marcha, emitir el certificado de seguridad y preparar la
  demostración son pasos manuales sobre el servidor, ya escritos uno por uno.
  **No queda trabajo de programación pendiente para esta parte.**
  - **Y sigue habiendo una decisión parada desde el 17 de agosto** — dónde se
    guardan las versiones del programa —, y sin ella **no hay canal de
    actualizaciones**, que es lo que permitiría que cada servidor se actualice
    solo en vez de a mano.

## 2026-08-21

- **El servidor de siempre pasa a ser el de demostraciones, y eso ahorra
  contratar uno.** Hasta hoy la página de demostración y el trabajo de verdad
  vivían **en la misma máquina y compartiendo la misma base de datos**. El plan
  para separarlos suponía **contratar un servidor más**, con su gasto mensual.
  Hoy se decidió otra cosa: **el servidor viejo se queda como el de
  demostraciones**, porque el que lleva el control ya se puso en marcha ayer en
  una máquina nueva.
  - **Qué cambia en la práctica:** separar las dos cosas deja de ser una compra y
    pasa a ser **cambiar a dónde apunta la dirección de internet** y **dejar la
    base del servidor viejo como nueva**.
  - **Qué se ahorra:** los **≈12 dólares al mes** que estaban presupuestados para
    esa máquina adicional.
  - **Lo que no cambia:** desde la aplicación **no se nota nada hoy**. Es una
    decisión sobre dónde vive cada cosa, no sobre cómo funciona el programa.

- **Antes de dejar esa base como nueva hay que mirar qué tiene dentro.** «Dejarla
  como nueva» quiere decir **borrar lo que hay**, y hoy nadie ha revisado qué hay.
  Se preparó una revisión que **solo mira y no toca nada**: qué organizaciones
  existen en ese servidor, cuánta información tiene cada una y qué versión del
  programa está funcionando ahí.
  - **La decisión se anotó igualmente, antes de esa revisión y a petición
    expresa.** Queda escrito que, **si la revisión encuentra información de
    verdad**, la decisión se vuelve a mirar. Se dice ahora para que después nadie
    tenga que reconstruir con qué información se decidió.

- **Tres documentos internos decían cosas distintas sobre el mismo asunto, y se
  corrigieron.** Dos de ellos seguían afirmando que el servidor de siempre iba a
  convertirse en **el que lleva el control de todo** — algo que se cambió de idea
  ayer por la tarde y **que ya no ocurrió**, porque ese papel lo tiene desde ayer
  una máquina nueva. Quien leyera uno u otro sacaba conclusiones opuestas. Los
  tres cuentan ahora la historia completa y en orden.

## 2026-08-20

- **Imprenta y Finanzas por fin sirven para algo, y el Dueño puede abrir Imprenta.**
  Ayer quedó anotado que el módulo de **Imprenta** no tenía permisos para nadie
  —tampoco para el Dueño— y que los roles **Imprenta** y **Finanzas** se podían
  elegir al dar de alta a una persona pero no abrían nada: entraban y recibían un
  «no tienes permiso» en todo. Era una decisión del negocio y hoy se tomó.
  - **Qué puede hacer cada uno a partir de ahora:**
    - **Imprenta** ve y crea sus trabajos, y **mira** Operaciones para saber qué se
      va a instalar. **No aprueba nada**: no cierra trabajos por su cuenta.
    - **Finanzas** ve, crea y **factura**, y ve el tablero. Facturar es una acción
      que no se puede deshacer, y aun así va incluida a propósito: un Finanzas que
      no puede facturar obliga al Dueño a hacer el trabajo diario, y eso acaba con
      todo el mundo entrando como Dueño, que es peor. Queda registrado quién
      facturó, igual que antes.
    - **Operaciones** pasa de solo mirar el catálogo de pantallas a **ver y crear
      lo suyo**, y a mirar Comercial e Imprenta.
    - **El Dueño** gana Imprenta completo, más aprobar en Operaciones y crear en
      Network. Ya no le queda **ni una pantalla cerrada**.
  - **Ojo, esto amplía permisos en las instalaciones que ya existen.** Al
    actualizarse, la instalación de trabajo gana esas líneas. **No es un efecto
    colateral: es la decisión**, y se dice antes para que nadie se lo encuentre
    después mirando un tablero.

- **Se acabó que la lista de permisos estuviera escrita en dos sitios.** El programa
  que da de alta una instalación llevaba su propia lista, y la actualización llevaba
  otra distinta. No coincidían, y **mandaba la que se ejecutara en último lugar** —
  sin dar ningún error ni ningún aviso. Según el orden, el Dueño acababa con 19
  permisos o con 24. Ahora la lista está **en un solo sitio**, la actualización, y el
  programa de alta se limita a **comprobar que esté**; si no la encuentra, **se
  niega a terminar** en vez de entregar una instalación en la que el Dueño no puede
  abrir nada.

- **El dueño de cada instalación deja de nacer con la misma contraseña que todos.**
  Hasta hoy, toda copia recién instalada creaba a su dueño con una contraseña fija e
  idéntica en todas partes, la escribía en pantalla, y **no le obligaba a
  cambiarla**. Cualquiera que la conociera —y estaba escrita en el programa— entraba
  como dueño en cualquier instalación, con acceso a todo, incluidas Administración y
  Finanzas. No hacía falta romper nada: bastaba con teclearla.
  - **Qué cambia:** el alta **genera una contraseña distinta cada vez**, en cuatro
    grupos de cuatro caracteres pensados para poder dictarse por teléfono —sin
    letras y números que se confundan—, la **enseña una sola vez** para que se le
    entregue al dueño por otro canal, y la cuenta nace **obligada a cambiarla**: la
    aplicación no le deja hacer nada hasta que lo haga.
  - **Y repetir el alta ya no le cambia la contraseña a quien ya existe.** Antes se
    la reescribía con la misma de siempre, así que daba igual; ahora, hacerlo lo
    dejaría fuera de su propia instalación. Si la pierde, se restablece desde
    Administración, como con cualquier otra persona.

- **Una instalación no puede nacer con la base a medio permiso sin que nadie se
  entere.** El programa que aplica las actualizaciones de la base ahora **comprueba
  antes de empezar** que exista el usuario técnico con el que la aplicación se
  conecta a su base de datos. Si no está, **se para y lo dice**, en vez de aplicar
  todo con éxito aparente y dejar una instalación donde la aplicación no puede leer
  ni una sola tabla. Y se añadió una actualización que **repara** las instalaciones
  que ya hubieran nacido así.

---

## 2026-08-19

- **Una instancia nueva ya nace con los permisos puestos, y su Dueño puede entrar
  a trabajar.** Quién puede ver, crear, aprobar o facturar en cada módulo se guarda
  en una tabla de la base. Esa tabla estaba **configurada a mano** en la base de
  desarrollo desde hace meses y **no viajaba con el programa**: de las 25 líneas que
  la hacen funcionar, solo cinco estaban escritas en el repositorio.
  - **Qué pasaba en la práctica:** una copia recién instalada nacía con permisos
    para un solo módulo, Inventario. Y como el programa **no le da ningún atajo al
    Dueño** —comprueba sus permisos en la tabla igual que a cualquiera—, el dueño de
    esa instancia entraba y se encontraba la aplicación cerrada de arriba abajo:
    tampoco podía abrir Administración, que es justo desde donde tendría que dar de
    alta a su equipo. La instancia no servía para nada desde el primer minuto.
  - **Qué cambia:** las 25 líneas se escribieron en el repositorio, de modo que
    cualquier instalación nueva las trae de fábrica: Dueño, Comercial y Operaciones
    con lo que cada uno necesita, tal y como funciona hoy la instalación de trabajo.
    No se inventó ni un permiso: es exactamente la configuración que ya se usa.
  - **A las instalaciones que ya existen no les cambia nada.** Se comprobó: sobre
    una base que ya tiene esos permisos, la actualización no toca ni una línea, y
    tampoco los duplica si se aplica dos veces.
  - **Queda una cosa medida y sin decidir, y se anota aquí para que no se pierda:**
    el módulo de **Imprenta** no tiene permisos para nadie —tampoco para el Dueño—,
    y los roles **Imprenta** y **Finanzas** se pueden elegir al dar de alta a una
    persona pero no abren nada. No se han tocado a propósito: decidir quién imprime
    o quién ve las finanzas es una decisión del negocio, no un arreglo técnico.

- **Una instalación nueva ya no nace con la empresa de otro dentro.** Hasta hoy,
  cualquier base creada desde cero salía con una organización ya dada de alta —«RGB
  Catorce»— y con su ficha de configuración detrás. Nadie la había creado: venía
  escrita en el archivo que levanta la base. Para una sola instalación era cómodo;
  con el modelo de una instancia por cliente era un error de identidad: la copia de
  cada cliente empezaba con la empresa de otro cliente adentro.
  - **Qué cambia en la práctica:** una base recién creada sale **vacía de
    organizaciones**, y la organización del cliente se crea **al darlo de alta**, no
    se hereda. Quien monta una instancia tiene que decir de quién es: el programa de
    arranque pide ahora el nombre y la clave de la organización y el nombre y correo
    de su Dueño, y **se niega a arrancar si no se los dan**, en vez de inventarse
    unos. Es la misma decisión que ya se tomó con la base de datos: no adivinar.
  - **Y sigue avisando cuando algo falla de verdad.** Si la organización no llega a
    crearse, el arranque **se detiene con error** en lugar de terminar «bien» sin
    haber creado a nadie. Ese final silencioso ya costó un despliegue entero, y es lo
    único que no se podía perder al hacer este cambio.
  - **Nada de esto toca las bases que ya existen.** Producción y la de desarrollo
    conservan su organización y siguen funcionando igual. El cambio es para las que
    nacen a partir de hoy.
  - **Para trabajar en local no se pierde nada:** la organización de pruebas de
    siempre se mudó a un archivo aparte que se aplica a mano y que **no viaja** en lo
    que se instala en los servidores.

---

## 2026-08-14

- **Los expedientes de evidencia de las fases 0, 1 y 2 caben ya en un solo PDF.**
  49 páginas con portada, índice, un resumen de las nueve fases del plan y un
  capítulo por fase, con el texto de su expediente reproducido entero, sin resumir
  ni reordenar.
  - **Dónde está:** **no en el repositorio**. El PDF es una salida derivada —pesa
    ~1,7 MB y cambia en binario con cada regeneración—, así que se entrega como
    archivo y `docs/evidencias/*.pdf` queda ignorado en git. Lo que sí se versiona
    son los expedientes de texto (`docs/evidencias/fase-0.md`, `fase-1.md`,
    `fase-2.md`), que es de donde se vuelve a generar cuando haga falta.
  - **Para qué sirve:** poder leer de una sentada en qué estado quedó el trabajo
    sin abrir el repositorio ni ir archivo por archivo. Se entrega a quien tiene
    que dar el visto bueno.
  - **Qué se ve primero, a propósito:** lo que **no** está probado. Cada capítulo
    abre con la lista de lo que su expediente declara sin probar, y esas secciones
    van marcadas en rojo dentro del texto, no escondidas al final.
  - **Las fases 3 a 8 también salen**, aunque no tengan expediente: aparecen en el
    resumen con su estado —sin empezar, bloqueada o fuera de alcance— para que el
    hueco se vea en vez de desaparecer.
  - **Añade una página del editor** con las cuatro tareas que solo puede hacer una
    persona (las «tarjetas humanas»), qué desbloquea cada una, y los **seis**
    commits que esperan visto bueno humano. Los capítulos de las fases 1 y 2
    cuentan ocho: se escribieron antes de que ese criterio estuviera por escrito y
    se dejan tal cual, porque son documentos históricos; esa página explica cuál es
    el número bueno y por qué.
  - **No añade evidencia nueva.** No se corrió ninguna prueba ni se tocó ningún
    servidor para hacerlo: lo que falta se declara como faltante. El PDF se puede
    volver a generar desde los mismos archivos y sale igual.

- **El botón «Crear cuenta» ya no aparece donde el registro está cerrado.** Hasta
  hoy la pantalla de acceso enseñaba ese botón siempre, sin importar la
  configuración del servidor: al pulsarlo el sistema contestaba «El registro de
  cuentas nuevas está deshabilitado». Una puerta pintada en la pared. Ahora la
  pantalla le pregunta al servidor qué ofrece y solo pinta lo que de verdad
  funciona — igual que ya hacía con el botón de Google.
  - **Por qué pasaba:** la pantalla de acceso se genera al compilar el programa, y
    la decisión de mostrar el botón iba escrita dentro de esa página ya generada.
    Cambiarla obligaba a recompilar el sistema entero, no bastaba con reiniciarlo.
  - **Qué cambia para quien opera un servidor:** la opción se llamaba
    `NEXT_PUBLIC_AUTOREGISTRO` y ahora se llama **`AUTOREGISTRO`**. Se lee al
    encender el sistema, así que abrir o cerrar el registro es cambiar una línea y
    reiniciar, sin recompilar nada.
  - **Cuidado, y es lo importante:** ahora **solo `AUTOREGISTRO=1` abre el
    registro**. Si la línea falta, o conserva el nombre viejo, o dice cualquier
    otra cosa, el registro queda **cerrado**. Es a propósito: entre dejar un
    servidor sin registro por error y dejarlo con el registro abierto a internet
    por error, se prefiere lo primero, porque se nota enseguida y no deja entrar a
    nadie mientras tanto.
  - **Un servidor cuyo archivo de configuración siga diciendo
    `NEXT_PUBLIC_AUTOREGISTRO=1` amanecerá con el registro cerrado.** Los que deban
    seguir abiertos necesitan la línea nueva.

---

## 2026-08-13

- **El avance de la corrección del modelo de despliegue queda por escrito, en la
  bóveda.** Nueva nota `vault/01-Arquitectura/modelo-instancias-soberanas.md`, con
  lo que se hizo con el documento que aprobó Jochelo el 12/08 —una instancia
  dedicada por owner, en vez de un renglón en una base compartida— y en qué estado
  quedó: las nueve fases desarrolladas en 40 tareas, los diez veredictos sobre el
  plan del 11, y **cero tareas ejecutadas**. Lo hecho hasta hoy es análisis y
  planeación; no se ha construido nada.
  - **Dice también lo que va a costar:** ≈ $28 USD al mes de infraestructura nueva
    (droplet padre, droplet de DEMO, backups, registry y snapshot) y ≈ $15 por cada
    instancia de owner. Son precios de lista de DigitalOcean, **no la factura**: la
    cuenta no se consultó, y la nota deja escritos los comandos `doctl` para
    sustituirlos por los números reales.
  - **Y deja por escrito un desacuerdo con el calendario**, antes de arrancar para
    poder contrastarlo al terminar: las «~2 semanas» del documento salen de sumar
    13 días hábiles en secuencia y suponen paralelismo perfecto. La estimación de
    la nota es de **3 a 4 semanas** para las fases 0–6, con la Fase 7 —mover los
    datos reales de `spaces_prod`— fuera de esa cuenta.
  - Las cuatro decisiones de negocio siguen abiertas y bloquean 7 de las 40 tareas.
    El siguiente paso no depende de ninguna: es el `curl` a `/api/signup` que dice
    si el autoregistro está abierto en el droplet.
  - Misma información en `Downloads\server padre\avance-correccion-jochelo.html` y
    `.pdf` (14 páginas), para mandar fuera del equipo.

---

## 2026-08-12

- **Plan de trabajo para que cada cliente tenga su propio sistema, en su propio
  servidor.** Queda en `docs/Plan_Instancias_Soberanas_v2.md`. Traduce a tareas
  concretas la corrección de rumbo que aprobó Jochelo el 12 de agosto: hasta
  ahora todos los clientes vivían dentro de una misma base de datos, separados
  por una etiqueta interna; el modelo correcto es que cada uno corra una copia
  completa del sistema en su propio servidor, con su propia base y entrando por
  el dominio que él elija. El motivo es comercial antes que técnico: la promesa
  de SPACE OS es que el cliente es dueño de su sistema, y un cliente que es un
  renglón en la base de otro no lo es. Son **40 tareas**; 33 se pueden hacer hoy
  y 7 esperan decisiones de negocio. Cada tarea trae la prueba que tiene que
  fallar primero, el criterio de aceptación y cómo se revierte si sale mal.

  Al contrastar el plan contra el código aparecieron seis cosas que los
  documentos daban por buenas y no lo eran:
  - **La pieza que el documento decía "rescatar tal cual" nunca se escribió.**
    Se daba por hecho que ya existía código para dar de alta una organización y
    su dueño en una sola operación. No existe: hay que escribirlo.
  - **Las tablas por limpiar son 23, no 21.** Dos se agregaron después de que se
    escribiera el número.
  - **El despliegue automático de hoy hace justo lo que el modelo nuevo
    prohíbe:** entra al servidor del cliente, compila ahí y reinicia. Eso deja a
    ese servidor distinto a todos los demás. Se retira, pero no antes de que
    exista el mecanismo que lo sustituye, o nos quedamos sin forma de desplegar.
  - **Los scripts muertos del sistema anterior son cuatro, no uno**, y uno llama
    a otro: borrar solo el que se había señalado dejaba roto al que lo invoca.
  - **Las migraciones no se aplican en orden alfabético.** Hay dos excepciones
    reales que las pruebas conocen y el despliegue no. Un cliente nuevo no
    arrancaría si el instalador las aplica por nombre.
  - **La limpieza pendiente es menos arriesgada de lo que parecía:** el sistema
    ya manda siempre a qué organización pertenece cada registro, así que quitar
    el valor por defecto no rompe nada en uso; solo deja de tapar los registros
    hechos a mano.

  Queda una contradicción que tiene que resolver Jochelo: el interruptor del
  registro público se graba dentro del programa al compilarlo, así que "todos los
  clientes reciben exactamente el mismo programa" y "el registro público solo
  está abierto en la demo" no pueden cumplirse las dos a la vez. Hay dos salidas
  y ambas están escritas en el plan.

## 2026-08-11

- **Cerrados cuatro pendientes del manual técnico: ya se puede levantar el
  proyecto siguiendo el manual.** Eran los cuatro más baratos —los comandos de
  arranque, las versiones mínimas, cómo se aplica una migración y cómo se corren
  las pruebas— y para resolverlos sí hubo que leer el repositorio. El manual pasa
  de describir las piezas a dar la secuencia exacta: instalar, levantar Postgres,
  crear el rol restringido, apuntar la conexión y arrancar. Tres cosas
  aparecieron por el camino que no estaban en el inventario y que ahora quedan
  advertidas:
  - **El `README.md` de la raíz manda al camino equivocado.** Describe el backend
    archivado (Fastify, Prisma, Redis, un API en el 3001) que hoy no corre.
    Alguien que entre nuevo y lo siga pierde la tarde. El manual lo dice en el
    primer aviso del capítulo de entorno.
  - **El aplicador de migraciones prefiere la configuración de producción.**
    Busca a qué base conectarse en un orden fijo, y `.env.production` va **antes**
    que la de tu máquina. Si alguien copió ese archivo del servidor para revisar
    algo, el script escribe en producción creyendo estar en local. Queda marcado
    como peligro, con la indicación de leer el destino que imprime antes de
    aplicar.
  - **Las pruebas no se lanzan desde la raíz**, sino desde `apps/web`.
  - **Se corrieron TODAS las pruebas y todas pasan: 789 unitarias y 136 de
    integración**, exactamente las cifras que decía el diario. Es la primera vez
    que se confirma contra la máquina y no contra la nota.
  - **Las pruebas de integración necesitan compilar antes, y si no lo haces el
    error no te lo dice.** Levantan el servidor de verdad, que reutiliza el
    programa ya compilado; si no hay compilación previa, el servidor muere al
    instante, pero el arnés descarta su mensaje de error. Lo que se ve son doce
    ficheros esperando un minuto cada uno y una corrida de diez minutos sin
    ninguna pista. Pasó en la primera corrida. Queda documentado con la
    comprobación de un vistazo, y el paso de compilar añadido al runbook.

- **Manual técnico para quien entra nuevo al proyecto.** Queda en
  `vault/08-Manuales/manual-tecnico.md` (carpeta nueva): once capítulos que van
  del panorama general al runbook de operación, pasando por arquitectura, modelo
  de datos, la lista de endpoints con sus candados, autenticación, entornos,
  migraciones, despliegue y zonas de riesgo. Está escrito para alguien que no
  conoce el sistema y necesita situarse, levantarlo y saber qué no debe tocar.
  La fuente fue **únicamente** el inventario del 11 de agosto: no se volvió a
  explorar el código, así que el manual no puede contradecirlo ni adelantarse a
  él. Lo que el inventario no cubría **no se rellenó a ojo**: quedaron **35
  puntos marcados como PENDIENTE** al final del manual, cada uno redactado como
  la pregunta concreta que hay que responder. Los más gruesos son el runbook de
  incidente y la restauración de un respaldo (hoy son enunciados, no comandos),
  los contratos de entrada y salida de los ~90 endpoints, y la política de
  respaldos. Las cuatro cosas que no se pudieron verificar de producción no se
  dan por buenas: se remiten al runbook de verificación, que sigue sin ejecutar.

- **Runbook para comprobar el estado real de producción.** El inventario cerró
  con cuatro cosas que no se pudieron verificar por ser un encargo de solo
  lectura: qué hay de verdad en la base de producción (filas, organizaciones,
  migraciones aplicadas), qué dice el entorno del servidor, si lo que corre
  sigue siendo el despliegue del 11 de agosto, y si las pruebas pasan hoy. Queda
  en `vault/06-Operacion/verificacion-de-produccion.md` la secuencia exacta de
  comandos para cerrarlas, cada uno con la respuesta que se espera, para que la
  salida se pueda contrastar y no solo leer. Va marcado `sin-ejecutar`: mientras
  lo diga, lo que sabemos de producción sigue viniendo de las notas de
  despliegue y del diario, no de la máquina. **No se corrió nada**: ni sondeos a
  producción ni pruebas. Tres avisos van dentro porque ya nos han mordido antes:
  los conteos se piden como `postgres` y no con el rol de la app (con la RLS
  cerrada saldrían en cero con buena pinta), los valores secretos del entorno
  salen como longitud y nunca como texto, y el arnés de pruebas arrasa el
  esquema de la base a la que apunte — de ahí la comprobación previa de que no
  apunte a la base del demo local, donde hay datos reales.

- **Inventario completo del sistema, verificado contra el código.** Se recorrió
  la bóveda entera y se comprobó nota por nota contra el repositorio. Queda en
  `vault/00-Inventario/inventario-2026-08-11.md`: 88 archivos de rutas (110
  métodos HTTP), 38 tablas, 66 migraciones, 13 decisiones de arquitectura, 22
  pantallas internas y 8 flujos de punta a punta. No se tocó código ni base de
  datos; es solo lectura.
  - **Se corrigió una idea equivocada sobre la arquitectura.** Se creía que
    había dos pistas de código y que una segunda (`apps/api`, con Fastify y
    Prisma) esperaba turno. No es así: hay **una sola pista viva**, `apps/web`,
    y un único proceso corriendo. El Fastify vive en `_archive/api`, fuera de
    los paquetes del proyecto. Los grupos de pantallas `(comercial)` y
    `(operaciones)` que las notas mencionaban **no existen**.
  - **La ruta `/demo` ya no existe.** Las pantallas viven ahora en el grupo
    `(app)`: `/login`, `/p/[id]`, `/portal/[token]`, `/m/ot/[id]`. Cualquier
    nota que hable de `/demo/…` está desfasada.
  - **Once puntos desfasados** entre la bóveda y el código, con su evidencia.
    Los que más pesan: un endpoint de notificaciones que cambió de nombre
    (`leer-todas` → `archivar-todas`, la vieja da 404); las citas a
    `lib/server/auth.ts` corridas cuatro líneas en cinco notas; y la política de
    contraseñas, que se mudó a `lib/password.ts`.
  - **Cuatro componentes no los usa nadie** — `OTMovil`, `PermissionGuard`,
    `ReadinessPanel` y `ReporteVisual`. La orden de trabajo en campo la pinta
    `OTVista`, no `OTMovil`. Esto responde una pregunta que llevaba tiempo
    abierta y baja el riesgo de retirar el `AuthProvider` viejo.
  - **El `deploy.yml` ya no está desactualizado:** se reescribió el 31 de julio
    y hoy apunta al servidor y las rutas correctas.
  - Quedan **20 dudas** anotadas para resolver contigo; las que estorban para
    escribir manuales son quién ocupa cada rol, por dónde se entra a
    `/configuracion` y si `/almacen` está en uso.

- **El contrato ya puede llevar todos sus datos, y el aviso dice dónde
  capturarlos.** El documento salía con «Faltan 4 datos por capturar» y no había
  forma de resolverlo del todo. Al revisarlo, los cuatro no eran el mismo
  problema:
  - **Tres eran de tu empresa** (RFC, domicilio fiscal y representante legal) y
    **sí se capturan**, en *Administración › Datos fiscales*. Simplemente
    estaban vacíos: ninguna de las organizaciones los tenía puestos.
  - **El cuarto no se podía capturar.** El **domicilio del arrendador** existía
    en la base de datos y el contrato lo exige dos veces —en la declaración de
    la parte y en la cláusula de notificaciones—, pero **ningún formulario lo
    pedía**, y el alta ni siquiera lo guardaba si se mandaba. Era un dato
    obligatorio sin ninguna casilla donde escribirlo.
  - **Ahora se pide al dar de alta** un arrendador, con una nota que explica
    para qué sirve.
  - **Y se puede completar en los que ya existen:** la lista de Arrendadores
    muestra una columna de Domicilio, marca en ámbar los que **Falta**n, y trae
    un botón **Completar** para escribir el domicilio y el RFC sin salir de la
    lista. Hasta ahora no había ninguna pantalla para editar un arrendador ya
    dado de alta.
  - **El aviso del contrato ahora dice dónde va cada dato**, agrupado por
    pantalla: los tres de la empresa se resuelven de una sentada en
    Administración, y el del arrendador en su ficha. Antes solo los nombraba.
  - *El documento sigue sin inventar nada:* lo que falta se deja en blanco, y
    un contrato con huecos no se puede enviar a firma.

- **El menú lateral ahora cuenta el proceso, en el orden en que ocurre.** Era
  una lista de dieciocho opciones sin orden aparente: **Campañas salía tercera**,
  tres puestos por encima de Propuestas — cuando una campaña nace justo de
  aprobar una propuesta. Quien entraba nuevo lo leía de arriba abajo y no
  encontraba por dónde se empieza. Ahora va por fases, con su título:
  - **Dashboard** — abre siempre, y va solo: es la portada.
  - **Lo que tienes** — Inventario · Arrendadores · Network. *Arrendadores sube
    aquí:* una pantalla no es tuya, es de alguien que te la renta, y ese
    contrato es lo que te deja venderla. Antes quedaba suelta en medio del ciclo
    de venta.
  - **Vender** — Clientes · Comercial · Disponibilidad · Propuestas, en el orden
    en que se hace.
  - **Entregar** — Campañas · Creativos · Imprenta · Operaciones · Almacén.
    *Campañas abre el tramo*, que es su sitio: es lo que sale de la propuesta
    aprobada.
  - **Cobrar** — Finanzas · Comisiones.
  - **Sistema** — Integraciones · **Actividad** · **Administración**, que cierran
    el menú siempre.
  - *No cambia ningún permiso:* cada quien sigue viendo exactamente los mismos
    módulos que antes. Solo cambia el orden y se añaden los títulos.
  - *Con el menú plegado* los títulos no caben, así que las fases se marcan con
    una línea de separación: el agrupamiento se conserva aunque el rótulo no.
  - **Ya está en producción.**
- **Las pantallas y los contratos dejan de mandar sus archivos en cada carga.**
  Cambio de otra sesión que entró en el mismo despliegue: al abrir la aplicación
  ya no viajan las fotos ni los documentos de contrato dentro de los datos, sino
  un enlace para pedirlos cuando hagan falta. Se verificó junto con el menú:
  build limpio, 787 pruebas de unidad y 129 de integración en verde.

---

## 2026-08-10

- **AVISO — el arreglo del arranque lento está hecho pero TODAVÍA NO
  DESPLEGADO.** Todo lo de esta entrada funciona en local y está probado; en
  producción **aún no se nota nada**. Hasta que se despliegue y se vuelva a
  medir, la pantalla en blanco al recargar sigue igual.
- **El sistema dejaba de responder 6 a 12 segundos en cada recarga, y ya se sabe
  por qué.** Al abrir la aplicación —o al pulsar F5, o al entrar por un enlace
  directo— el contenido se quedaba en blanco varios segundos. Se midió en
  producción: la petición con la que arranca todo pesaba **6.12 MB**.
  - *No eran las consultas.* La más pesada de la base tarda siete centésimas de
    milésima de segundo. Lo que tardaba era **descargar 6 MB de archivos** que
    nadie estaba mirando.
  - *Qué venía dentro:* el **PDF de cada contrato de arrendamiento** (unos 300
    kB por contrato, casi 4 MB en total) y las **fotografías de las pantallas**
    (1 MB, y por partida doble, porque el inventario y la vista de red se
    traían las mismas fotos cada una por su lado). Todo eso se descargaba en
    **cada carga de página**, para pintar tablas y unos indicadores que no
    enseñan ni un documento ni una foto.
  - *Ahora cada cosa se pide donde se ve:* el contrato al abrir su ficha, la
    galería al abrir la de la pantalla. En las listas solo viaja el dato de si
    hay documento o no, que es lo único que necesitan.
  - *Lo que no cambia para quien usa el sistema:* el contrato se abre igual, la
    galería se ve igual, y el enlace de firma y la exportación a Excel siguen
    funcionando igual. Solo dejan de descargarse por adelantado.
  - *Es la tercera vez que pasa lo mismo* (el 06/08 fue con el arte de los
    creativos), así que esta vez queda una **prueba automática** que rechaza
    cualquier archivo incrustado en el arranque. Si alguien vuelve a meter uno,
    la prueba falla antes de llegar a producción.
- **Comprobado, y NO era lo que parecía: la bitácora de borrados no es a prueba
  de fallos.** Se revisó a fondo porque el plan daba por hecho que sí.
  - *Lo bueno:* **las 8 acciones de borrado** que existen —arrendador, creativo,
    licencia, razón social, pantalla, usuario, pausa legal y desbloqueo— dejan su
    entrada en la bitácora. Ahí no falta ninguna.
  - *Lo que hay que saber:* la anotación se hace **después** del borrado y por
    separado. Si la anotación fallara, **el borrado ya está hecho** y no se
    deshace. Está escrito así a propósito, para que un problema al anotar no
    tumbe la operación de quien está trabajando.
  - *Lo que sí conviene arreglar, y queda anotado:* hoy ese fallo **no se
    registra en ningún sitio** — no deja ni una línea de aviso. En un sistema
    donde la bitácora sirve como prueba de quién hizo qué, un borrado sin rastro
    y sin avisar es un punto ciego. **Pendiente de decidir** si basta con dejar
    aviso o hay que llegar a que el borrado se revierta.
- **Las fechas de Arrendadores ya estaban bien.** Se revisó porque el plan las
  daba por pendientes: se comprobó pantalla por pantalla y **no había ninguna
  fecha en formato crudo** («2026-07-16») ni el «28/10/2026(80d)» pegado. Se
  corrigieron en su día. No se tocó nada.
- **La contraseña que pide el registro es la que de verdad se exige.** Al crear
  una cuenta, el formulario daba por buena una contraseña de **6 caracteres** y
  dejaba pulsar «Crear cuenta»; el servidor exige **8, con letra y número**, así
  que devolvía un error después de enviar. En la primera pantalla de un registro
  que ahora está abierto al público, eso es el primer tropiezo de cualquiera.
  - Ahora el aviso sale **mientras se teclea** y dice qué falta («debe incluir
    al menos un número»), en vez de esperar al envío.
  - *El mismo arreglo tapó otro hueco:* los formularios de alta de usuario y de
    organización pedían 8 caracteres pero no comprobaban letra ni número, así
    que «aaaaaaaa» también rebotaba contra el servidor.
  - *La causa de fondo:* la regla vivía en un sitio donde los formularios no
    podían leerla, así que cada uno la reescribía a ojo. Ahora hay **una sola**,
    y una prueba que falla si alguien vuelve a escribir la suya.
- **Ahora se sabe qué anuncio salió en qué pantalla.** Era el hallazgo más
  grave que quedaba. Al publicar, el sistema mandaba **todos** los anuncios
  aprobados de la campaña a **todas** sus pantallas, así que no existía tal cosa
  como «el anuncio de esta pantalla» — y el reporte al cliente no podía probar
  qué se exhibió, que es justo lo que se le vende. En la pantalla de Creativos
  se veía como campañas ya publicadas con todos sus espacios en «Sin asignar».
  - **Ahora cada pantalla recibe lo suyo**, y solo lo suyo.
  - **Con un solo anuncio aprobado, se asigna solo.** No hay nada que decidir, y
    pedir que se elija doce veces la única respuesta posible es de donde venía
    el problema. Queda anotado en el historial, a nombre de quien aprobó.
  - **Con dos o más, no se adivina.** Ahí sí es una decisión —qué pieza va en
    qué pantalla y cuántas veces— y la toma una persona.
  - **No se publica una pantalla vacía.** Si a alguna le falta su anuncio, ni se
    envía al dominio ni se aprueba la publicación, y el aviso **dice cuáles**
    son. Se comprueba en los dos momentos, porque entre uno y otro pueden pasar
    días y algo puede cambiar.
  - **Se corrigió también el número de pases al día.** Antes cada anuncio pedía
    el total de la pantalla: dos anuncios en una de 8 pases pedían 8 cada uno,
    16 en un hueco de 8. Ahora cada uno pide los suyos. *Y donde no hay pauta
    diaria contratada no se impone ninguna*, igual que hasta hoy.
  - **Las campañas ya publicadas se dejan anotadas.** 16 pantallas de cuatro
    campañas (KFC, mastercard, card y prueba final). *No se inventa el dato*:
    como en esas cuatro solo hay un anuncio aprobado, ése es exactamente el que
    salió en cada pantalla. Se está escribiendo lo que ocurrió. Las dos campañas
    con dos anuncios aprobados se dejan sin tocar a propósito: ahí sí habría que
    adivinar.
  - *Nada de esto republica nada,* ni afecta a las campañas de lona.
  - **Ya está en producción.** Las 16 pantallas quedaron anotadas.
  - *Queda un pendiente, y conviene saberlo:* dos campañas de la organización
    **eyro** tienen **dos** anuncios aprobados y su pantalla sin asignar, así
    que el sistema no elige por ellas. No pasa nada mientras nadie las vuelva a
    aprobar —lo que está al aire sigue igual—, pero el día que alguien lo haga,
    el sistema pedirá que se asigne primero. Se resuelve con un clic desde un
    usuario de esa organización.
- **Ya no se puede dar de alta dos veces al mismo propietario.** Pasó de verdad:
  el 7 de julio alguien dio de alta «ADMINISTRADORA DE GASOLINERAS INTERLOMAS»,
  no lo vio en la lista y lo volvió a dar de alta **un minuto y once segundos
  después**. Ahora hay dos protecciones, y son distintas a propósito:
  - **El RFC es de un solo propietario, y punto.** Si se captura un RFC que ya
    tiene otro, no se guarda y se dice **de quién es**, para poder ir a su ficha
    en vez de buscarlo a mano. Esto no se puede saltar: un RFC identifica a un
    contribuyente. Funciona igual escrito en minúsculas o con espacios de más.
  - **El nombre repetido avisa, pero deja continuar.** Si ya hay un propietario
    que se llama igual, se advierte y el botón pasa a decir «Crear de todos
    modos». *No se prohíbe* porque dos propietarios distintos **pueden**
    llamarse igual —son personas, no solo empresas—, y prohibirlo dejaría sin
    poder dar de alta al segundo. También avisa si el que ya existe está dado de
    baja, que suele ser alguien recuperando lo que borró.
  - *El RFC sigue siendo opcional:* se pueden dar de alta varios propietarios
    sin RFC, como hasta ahora.
  - *Cada organización va por su cuenta:* un mismo propietario puede estar en
    dos empresas del sistema sin que ninguna se entere de la otra.
- **El botón de guardar ya no puede dispararse dos veces con un doble clic.**
  Los formularios ya se bloqueaban al enviar —eso estaba bien hecho y no se
  tocó—, pero quedaba una rendija de una fracción de segundo entre el primer
  clic y el momento en que el botón se apaga. Ahora el bloqueo es inmediato, y
  vale para todos los botones de la aplicación a la vez.
  - *Lo que esto NO cubre, y por eso hacía falta lo de arriba:* dos pestañas,
    dos dispositivos o un reintento de la red. Un bloqueo del navegador no llega
    ahí; la base de datos sí.
- **El estado de una campaña ya no se queda congelado esperando que alguien lo
  mueva a mano.** Había campañas marcadas **«Activa»** cuyo periodo terminó hace
  semanas, y otras **«Confirmada»** que llevaban días al aire. De ahí salía el
  doble rótulo «Completada + Aún vigente», que enseñaba el desfase pero no lo
  arreglaba. Ahora el sistema lo pone al día solo, con dos reglas:
  - **Terminó su periodo → Completada.** Se aplica tanto a las que estaban
    «Activa» como a las que se quedaron atascadas en «Confirmada» habiendo
    salido al aire. Las que **nunca se publicaron** no se completan: «terminó»
    y «nunca ocurrió» no son lo mismo.
  - **Empezó y ya está publicada → Activa.** «Publicada» significa lo que
    corresponde a cada medio: en pantalla digital, enviada al dominio y con la
    validación aprobada; en lona, la orden de montaje completada. Una campaña
    física **no** se da por publicada por las banderas digitales.
  - *El último día cuenta.* Una campaña que termina **hoy** sigue Activa hoy; se
    completa mañana.
  - *No mueve nada que dependa de una decisión de alguien:* «Cancelada»,
    «Borrador», «Cotización» y «Lista para facturar» se quedan como están. Y una
    campaña cerrada antes de tiempo **no se reabre**: ese cierre anticipado es
    legítimo —una cancelación de facto— y deshacerlo sería pisar una decisión
    humana.
  - *Queda constancia:* cada campaña que se mueve deja su apunte en la bitácora
    a nombre del Sistema. Y solo cuando de verdad se movió — un barrido que se
    ejecuta en cada carga de pantalla y anota «no hice nada» ahogaría el
    historial.
  - *En la pantalla de Campañas, un rótulo menos.* Donde antes había dos
    distintivos compitiendo, ahora está el estado y, en el único caso que
    queda —una campaña cerrada antes de su fecha de fin—, una nota discreta al
    lado.
  - *Lo que el plan pedía y no aplica:* pedir un motivo cuando alguien marca
    «Completada» una campaña que aún no termina. **No hay dónde ponerlo**: en el
    sistema no existe ninguna pantalla ni endpoint que permita fijar el estado a
    mano. El único camino a «Completada» por acción de una persona es **emitir
    la factura**, que ya queda registrada por sí sola (bitácora, folio y aviso).
    Inventar un campo para un flujo que no existe habría sido trabajo muerto.
  - *Verificado a conciencia:* 24 pruebas nuevas contra Postgres de verdad, por
    HTTP y con la sesión real, más cuatro mutaciones deliberadas del código para
    comprobar que las pruebas muerden. Una de ellas descubrió una condición del
    SQL que **no protegía nada** —ninguna prueba se rompía al quitarla— y se
    eliminó en lugar de dejarla ahí aparentando que guardaba algo.
  - **Ya está en producción**, desplegado junto con los tres detalles de
    interfaz de abajo. *Antes de subirlo* se comprobó contra los datos reales,
    sin escribir nada, exactamente a qué campañas iba a afectar: **dos**, «KFC»
    (que terminó el 8 de agosto) y «Propuesta para cliente 1» (que terminó el 31
    de julio). Ninguna otra. Y se dejó preparada la vuelta atrás de **esos dos
    datos** por separado, porque deshacer el programa no desharía el cambio de
    estado.
- **Una campaña ya facturada deja de aparecer como si le faltara algo.** El
  recorrido de la campaña terminaba en «Lista para facturar», así que una que
  **ya tenía su factura emitida** se quedaba ahí, en ámbar, como un paso
  pendiente. Ahora hay un paso más al final —**«Facturada»**— y el anterior se
  marca como cumplido.
  - *No hace falta capturar nada nuevo:* se deduce de que exista la factura de
    esa campaña, que es un dato que ya estaba.
  - *No cambia nada del candado ni de la facturación.* Solo se añade un paso
    después del último; todo lo anterior se comporta igual.
- **«1 resultados» ya dice «1 resultado».** El fallo de concordancia estaba
  repetido en **doce sitios** —«sitios», «pantallas», «resultados»—, así que se
  arregló con una pieza común en vez de uno por uno.
  - *Con la lección de un fallo anterior incorporada:* en julio, la regla
    ingenua de «añadir una s» produjo «mess» al pluralizar «mes». Ahora la forma
    plural se puede indicar a mano cuando la palabra lo pide.
- **El IVA que se propone al dar de alta un cliente sale del catálogo de la
  organización.** Antes arrancaba siempre en 16% escrito a mano, así que una
  organización que trabaja al 15% veía el desplegable ofreciendo **15 y 16** —y
  ese 16 no era suyo—. Ahora se propone la primera tasa configurada.
  - *La tasa que ya tenga un cliente se sigue respetando* aunque no esté en el
    catálogo: al editarlo no se le cambia por sorpresa.
- **Fuera los rótulos de prueba que se veían en la demo.** Tres cosas que un
  cliente leía mientras alguien le explicaba otra cosa:
  - El nombre comercial de la organización decía **`DEMO PIXELED.`**; ahora dice
    **`PIXELED`**.
  - Un creativo de la campaña KFC se llamaba **`upsivale 1920.jpg`**; ahora
    `creativo-kfc.jpg`. **Solo cambió el rótulo**: la imagen es exactamente la
    misma.
  - El usuario que aparecía como **`DEMO`** ahora se llama **`Operador Demo`**.
    No se borró a propósito: tiene historial en la bitácora, y borrarlo dejaría
    referencias a alguien que ya no existe.
  - *Las entradas de bitácora antiguas siguen diciendo «DEMO»*, y es lo
    correcto: guardan el nombre que tenía la persona en ese momento. Reescribir
    el pasado sería justo lo que una bitácora no debe permitir.
  - *Con respaldo y ensayo*, como manda la convención: se corrió el cambio
    entero contra los datos reales y se deshizo, para confirmar que tocaba tres
    filas y ni una más. Solo después se aplicó.
- **Lo que NO se tocó, y conviene decir por qué.** El plan pedía asignarle un
  responsable a las órdenes de trabajo que aparecen «Sin asignar». **No se
  hizo.** Al mirarlo resulta que son **las dos únicas órdenes que existen**, o
  sea que ese campo nunca se ha usado — no es un registro suelto que se quedó
  atrás. Escribir ahí el nombre de alguien sería afirmar que hizo un trabajo de
  campo que nadie sabe si hizo, en un sistema cuya bitácora se usa como prueba.
  Eso lo decide una persona, no una limpieza de datos.
- **Y lo que sigue viéndose, porque son datos que hay que capturar:** 11 de las
  12 pantallas no tienen fotografía, y el «win rate» marca 100% porque no hay
  ninguna propuesta registrada como perdida.
- **La tabla que guarda los enlaces de «olvidé mi contraseña» ya está aislada
  entre organizaciones, igual que el resto.** Era lo que quedó apuntado el
  viernes para hoy, y ya está en producción.
  - *Qué se gana:* una segunda barrera. El enlace de recuperación ya era
    imposible de adivinar —es de un solo uso y caduca—, y esa sigue siendo la
    protección principal. Lo que se añade es que, si algún día un error del
    programa consultara esa tabla sin decir de qué organización habla, no
    obtendría nada en vez de poder ver los enlaces de todas.
  - *Por qué no se hizo el mismo día:* el cambio va en **dos piezas que
    dependen una de otra** —la base y el programa—, y aplicar solo la primera
    habría dejado «recuperar contraseña» **sin funcionar y sin avisar**: los
    enlaces empezarían a salir como inválidos, sin ningún error en ningún sitio.
    Se prefirió escribir el procedimiento y ejecutarlo con calma.
  - *Cómo se hizo:* respaldo completo de la base antes de tocar nada (7 MB, 38
    tablas con datos), y un ensayo previo que corre el cambio entero contra los
    datos reales y lo deshace solo. Solo después se aplicó de verdad.
  - *Comprobado después:* **ninguna tabla del sistema queda sin aislar** —era
    la única que faltaba y llevaba así desde el 23 de julio—, la aplicación
    responde con normalidad y no hubo ni un error nuevo.
  - *Nada cambia para quien usa el sistema.* Recuperar contraseña sigue
    apagado en producción por falta del servicio de correo, así que este cambio
    es preparación: el día que se encienda, ya estará sano.

## 2026-08-07

- **La plantilla de configuración del servidor tenía mal el nombre de una
  variable, y eso dejaba el correo apagado sin avisar.** Decía `RESEND_FROM`
  donde el sistema espera `EMAIL_FROM`. Quien montara un servidor nuevo
  siguiéndola se quedaba **sin correo saliente y sin ningún error**: el sistema
  simplemente lo daba por deshabilitado.
  - *Se comprobó contra el servidor real* antes de decidir qué corregir: el
    droplet usa `EMAIL_FROM`, así que el código siempre tuvo razón y la
    equivocada era la plantilla.
  - *Se deja escrito el aviso que faltaba:* van **las dos o ninguna**. Con la
    clave puesta y el remitente vacío, quien pide recuperar su contraseña ve
    «revisa tu bandeja» y no le llega nada.
- **Al entrar con la sesión ya iniciada, el inicio de sesión ya no muestra el
  formulario:** lleva directo a donde corresponde a cada rol.
  - *Se comprueba la sesión de verdad contra el servidor*, en vez de fiarse de
    que exista la cookie. Una cookie caducada sigue estando ahí, así que el
    atajo fácil habría producido un ida y vuelta infinito entre el inicio de
    sesión y el tablero — de los que solo se notan en producción.
- **⚠️ El registro público quedó ABIERTO en producción, por decisión del
  usuario.** Desde hoy, en la pantalla de inicio de sesión aparece **«Crear
  cuenta»**, y con ella se puede dar de alta una organización nueva —también con
  una cuenta de Google—.
  - *Lo que esto significa, dicho sin rodeos:* **cualquiera que llegue a la
    dirección de la demo puede crear una organización y un usuario Dueño dentro
    de la misma base de datos donde están los datos reales**, sin invitación y
    sin que nadie lo apruebe. La demo pública y el sistema en uso son el mismo
    servidor.
  - *Estaba cerrado desde la auditoría de calidad*, que lo señaló como hallazgo
    de seguridad (A6). Se abre a petición expresa, después de explicar el riesgo
    dos veces, y queda escrito aquí para que sea una decisión con fecha y no un
    descuido que nadie recuerda.
  - *Cerrarlo otra vez cuesta un minuto:* se cambia una línea de configuración en
    el servidor y se vuelve a compilar. El respaldo de la configuración anterior
    quedó guardado antes de tocar nada.
  - *Lo que NO cambia:* quien se dé de alta así entra a **su propia organización
    nueva y vacía**. No ve ni toca los datos de ninguna otra — ese aislamiento es
    independiente de esta decisión.
- **Ya se pueden crear organizaciones desde dentro del sistema.** Antes había un
  callejón sin salida: el panel de Organizaciones decía «para dar de alta una
  organización nueva, usa Crear cuenta en el inicio de sesión»… y ese botón
  estaba oculto. Es decir, no había ninguna forma de crear una organización.
  - Ahora el panel tiene su propio formulario, y el Dueño de la organización
    nueva **puede entrar con Google** sin que haya que inventarle contraseña.
  - *Sigue siendo exclusivo del administrador de la plataforma*, que es quien
    gobierna el conjunto de organizaciones.
- **El panel de organizaciones ya explica por qué no lo ves.** Antes
  desaparecía sin más para quien no fuera administrador de la plataforma, y eso
  dejaba adivinando: el botón estaba anunciado y no aparecía. Ahora dice que esa
  gestión está reservada y a quién pedírsela.
  - *Se distingue «no tienes permiso» de «falló la carga»*, que hasta hoy se
    trataban igual. Con un fallo de red no se inventa una explicación que podría
    ser falsa.
  - *No cambia ningún permiso:* el servidor responde exactamente igual que antes.
- **Entrar con Google FUNCIONA EN PRODUCCIÓN.** Verificado por el usuario con su
  cuenta real, de principio a fin: se dio de alta desde Administración marcando
  la casilla nueva —sin inventar ni enviarse ninguna contraseña— y entró con su
  cuenta de Google. Cero rechazos en el registro del servidor.
  - *Lo que faltaba no era programación:* había que declarar en Google la
    dirección exacta a la que devuelve al usuario. Hasta hacerlo, Google
    rechazaba el acceso con un error que no dice mucho.
- **Ya se puede dar de alta a alguien sin inventarle una contraseña.** En
  Administración → Usuarios hay una casilla: «Entra con su cuenta de Google». Al
  marcarla desaparece el campo de contraseña y la persona entra directamente con
  su cuenta, siempre que su correo de Google sea el mismo que se capturó.
  - *Por qué importa más de lo que parece:* hasta ahora había que inventar una
    contraseña y **pasársela por chat o por correo**, donde queda escrita en el
    historial de alguien. Esa es la fuga que esto elimina.
  - *La cuenta conserva una contraseña interna que nadie ve ni necesita.* Suena
    contradictorio y es deliberado: sin ella, esa persona no podría autorizar
    operaciones de dinero ni cambiar sus propios datos, y si un administrador le
    «restableciera la contraseña» quedaría **encerrada fuera del sistema**, con
    la única salida pidiéndole algo que nunca tuvo.
  - *La casilla solo aparece si el servidor tiene Google configurado.* Si no,
    crearía una cuenta que no puede entrar de ninguna forma.
  - *De paso se corrigió un desajuste viejo:* el formulario daba por buena una
    contraseña de 6 caracteres y el sistema exige 8 con letra y número. Escribías
    una de 6, la enviabas, y volvía rechazada con un mensaje que parecía salido
    de la nada.
- **También se puede crear una empresa entera con Google, pero solo donde el
  registro público está abierto.** En producción **sigue cerrado**, igual que el
  «Crear cuenta» de siempre y por el mismo motivo: la demo pública y el sistema
  real son el mismo servidor sobre los mismos datos, así que dejarlo abierto
  permitiría a cualquiera con una cuenta de Google crear organizaciones ahí.
  Comprobado tras el despliegue: en producción responde que está deshabilitado.
  - *El nombre de la empresa se pide antes de ir a Google*, porque es el único
    dato que Google no puede aportar.
- **Cerrada una puerta que las pruebas habían dejado abierta en producción.**
  Para poder ensayar el acceso con Google sin hablar con Google, el sistema
  permite sustituir la dirección con la que se verifica una identidad. Esa
  facilidad —pensada solo para pruebas— **también funcionaba en el servidor de
  producción**, y sin restricción sobre a dónde apuntaba.
  - *Qué se podía hacer con ella:* quien pudiera cambiar la configuración del
    servidor la habría apuntado a una máquina suya, que respondería «esta
    persona es quien dice ser» para **cualquier correo**. El sistema lo daría
    por bueno y abriría sesión como esa persona. No es algo que se pueda hacer
    desde fuera —hace falta acceso al servidor, y quien lo tiene ya lo tiene
    todo—, pero una facilidad de pruebas no debe seguir viva en producción.
  - *Cómo queda:* la sustitución solo se acepta si apunta **a la propia
    máquina**. Lo peor que consigue quien la toque es hablar consigo mismo.
  - Salió al preparar la prueba manual, no de una revisión: es el tipo de cosa
    que se ve montando el escenario real y no leyendo el código.
- **Un error de base de datos ya no le enseña al usuario una pantalla rota.**
  Al entrar con Google, si algo falla del lado de la base, antes salía la
  página de error técnica del sistema — con su listado de líneas de código—,
  porque a esta pantalla se llega **navegando**, no desde dentro de la
  aplicación. Ahora el detalle queda en el registro del servidor y a la persona
  se le devuelve al inicio de sesión con un mensaje que se entiende.
  - *Apareció probando de verdad:* el fallo se provocó solo, al probar en un
    entorno donde el cambio de base todavía no estaba aplicado. Las pruebas
    automáticas no podían verlo porque ellas siempre corren con la base al día.
- **El inicio de sesión con Google se probó a mano, de principio a fin.** Sin
  credenciales de Google todavía: se montó un «Google de mentira» local —que se
  identifica como tal en pantalla, para que ninguna captura confunda— y se
  recorrió el camino completo haciendo clic. Entra, reconoce a la persona por su
  correo, deja la sesión abierta, **guarda la vinculación** y la anota en la
  bitácora de actividad. Funciona.
  - *Lo que sigue faltando es solo la llave:* la credencial de Google no está
    puesta, así que en cualquier entorno real el botón sigue sin aparecer. No es
    un paso de programación, es de configuración.

- **El acceso con Google ya se prueba solo, de punta a punta.** Antes de
  encenderlo para nadie, el camino completo queda cubierto por **18 pruebas
  automáticas** que corren contra un *Google de mentira*: un doble local que
  responde lo que la prueba le pida. Así se puede ensayar lo que Google nunca
  haría a petición — un correo sin verificar, un permiso caducado, un intento
  repetido.
  - *Por qué había que hacerlo antes y no después:* un fallo aquí **no se ve**.
    No sale un error ni se rompe una pantalla; simplemente deja entrar a quien
    no debería, y por dentro parece un inicio de sesión perfectamente normal.
  - *Casi todas las pruebas comprueban que algo NO pasa.* Que un correo que
    Google **no ha verificado** no entra —es la barrera que impide que alguien
    se apropie de una cuenta ajena dando de alta ese correo en Google—; que un
    correo desconocido no entra **y no crea ningún usuario**; que una persona
    desactivada no puede colarse por esta puerta aunque su cuenta de Google
    siga viva; y que un intento rechazado no deja media sesión abierta.
  - *También se comprueba que la puerta sirve*, no solo que se abre: después de
    entrar se pide un dato real de la organización y tiene que llegar.
  - *Y que reconoce a la persona aunque le cambien el correo:* la segunda vez
    se entra por el identificador permanente que da Google, no por el correo.
    Era la razón entera de guardarlo.
  - *Se verificó que las pruebas de verdad detectan:* se quitó a propósito una
    de las protecciones del código y cayó exactamente la prueba que la cubre.
    Una prueba que pasa siempre no prueba nada.
  - *Un hallazgo de paso, y conviene que quede escrito:* se confirmó que
    **nadie puede falsear su dirección de internet** para saltarse el límite de
    intentos, porque el servidor web la reemplaza en vez de creerse la que
    manda el visitante. Si algún día alguien cambia esa línea de configuración,
    el límite de intentos **del acceso normal** pasaría a ser burlable.
  - Todo en verde: 55 pruebas de integración, 729 de las otras, y la
    compilación de producción correcta.
- **El acceso con Google ya tiene su sitio en la base de datos. Sigue apagado:
  ahora solo le falta la llave.** Ayer quedó anotado aquí como aviso que el
  código estaba en el servidor pero **su cambio de base no**, y que encenderlo
  sin aplicarlo antes lo habría roto. Ese paso **ya está hecho** (11:13 de hoy),
  con respaldo de la base tomado antes y un ensayo previo que se deshace solo.
  - *Qué cambia hoy para quien usa el sistema:* **nada**. Sin la llave de
    Google el botón no se pinta y todo ese camino sigue inerte. Comprobado
    después de aplicarlo: el acceso normal responde bien y no hay ni un error.
  - *Lo que falta son dos cosas, y una la tiene que hacer una persona:* crear
    la credencial en Google —desde una **cuenta de empresa**, no la personal de
    nadie, para que no se vaya con quien se vaya— y anotarla en el servidor.
    Encenderlo después no obliga a recompilar nada.
  - *Conviene recordar qué es y qué no es:* para entrar con Google hay que
    **existir antes** como usuario, con el mismo correo. Google es un atajo
    para entrar, **no un alta**: a quien no esté dado de alta se le dice que no
    lo está, y no se le crea nada.
  - *Y si algo saliera mal, apagarlo es inmediato* y no obliga a deshacer nada
    de la base. El detalle completo está en `DESPLIEGUE_GOOGLE.txt`.

## 2026-08-06

- **Un usuario con contraseña temporal ya no se queda encerrado.** *(Comprobado
  en producción: el usuario afectado entró, se le llevó a cambiarla, y al
  guardarla recuperó el acceso — incluido el logo de su empresa, que tampoco
  veía por lo mismo. Las miniaturas también quedaron verificadas.)* Cuando a
  alguien se le restablece la contraseña, el sistema le entrega una temporal y
  **cierra el resto de los módulos** hasta que la cambie — eso está bien y es a
  propósito: una contraseña temporal la conoce también quien se la entregó.
  - *Lo que estaba mal:* la aplicación **no le decía nada**. Al entrar, todo le
    daba error y veía «No se pudieron cargar los datos» con un botón de
    reintentar **que no podía funcionar nunca**, sin ninguna pista de que su
    contraseña era temporal ni de adónde ir a cambiarla. En la práctica quedaba
    bloqueado.
  - *Ahora* se le lleva directo a la pantalla de su cuenta, con un aviso que
    explica por qué está ahí, y **en cuanto la cambia recupera el acceso** sin
    tener que volver a entrar.
  - *Es la tercera vez que aparece este mismo patrón* (ya pasó con el
    restablecimiento de contraseñas y con el desbloqueo): el servidor exige algo
    correctamente, y la pantalla no ofrece dónde hacerlo.
- **Las miniaturas de Creativos volvieron a verse.** Fue un efecto secundario
  del cambio de rendimiento de hoy: al dejar de mandar el arte por adelantado,
  la pantalla pasó a montar **cada creativo como una página completa** en vez de
  como una imagen. Son alrededor de un megabyte cada una, con un desenfoque
  pesado; con once en pantalla **el navegador se quedaba colgado**.
  - *Cómo se encontró:* abriendo uno en el navegador. La imagen se veía
    perfectamente — lo que no aguantaba era montar once a la vez.
  - *El arreglo:* ahora el servidor saca la imagen y manda solo la imagen, que
    es justo lo que la pantalla hacía por su cuenta cuando el arte viajaba por
    adelantado.
- **El sistema abre más rápido: dejó de descargarse las imágenes que nadie está
  mirando.** Se reportó que el tablero tardaba, y la sospecha era que las
  consultas a la base iban lentas. **Se midió, y no era eso.** La base entera
  pesa 21 MB, la consulta más pesada tarda **0.077 milésimas de segundo**, y hay
  20 pantallas y 13 campañas. Optimizar consultas ahí habría sido acelerar algo
  que ya es instantáneo.
  - *Lo que sí pasaba:* cada vez que alguien abría **cualquier** pantalla, el
    sistema se traía los creativos **con el arte dentro** — casi **3 MB de
    imágenes en solo cuatro creativos**, para dibujar unos indicadores que no
    usan ninguna de ellas. Ese era el tiempo de espera.
  - *Ahora las imágenes se piden solo donde se ven*, y el navegador las guarda
    en su caché. En la pantalla de Creativos aparecen igual, con la diferencia
    de que se cargan al entrar ahí y no antes.
  - *Y el sistema dejó de hacer cola consigo mismo:* antes de mostrar nada,
    ejecutaba **cuatro tareas de mantenimiento una tras otra** (liberar reservas
    vencidas, avisar de órdenes de trabajo vencidas, recordar cobranzas y
    actualizar el estatus de los contratos). Ahora corren a la vez. Para un
    Dueño, que ve todos los módulos, eran cuatro esperas encadenadas en cada
    carga.
  - *Lo que se descubrió de paso, y explica por qué no fue un cambio de una
    línea:* la pantalla decidía si un creativo era código o imagen **mirando el
    principio del archivo**. Como el archivo ya no viaja, eso dejaba de
    funcionar — y al revisar los datos reales aparecieron **tres formas
    distintas de guardar lo mismo** conviviendo. Ocho creativos se habrían
    dejado de ver. Ahora la decisión se toma por el tipo declarado, que sí es
    fiable.
- **Subir una imagen ya avisa de que está trabajando.** Antes parecía que no
  pasaba nada: elegías el archivo, la pantalla se quedaba igual, y lo natural
  era volver a pulsar creyendo que no se había aceptado. **Desplegado.**
  - *Por qué el aviso que ya existía no bastaba:* la aplicación tiene una barra
    de carga que se enciende cuando hay algo en marcha, pero **solo cuenta las
    peticiones al servidor**. Subir un logo son tres esperas y solo la última es
    una petición: leer el archivo, comprobar que se puede mostrar, y enviarlo.
    Durante las dos primeras no había ningún aviso posible.
  - *Ahora el aviso está donde uno mira:* encima de la propia vista previa del
    logo, no en una esquina de la pantalla. El logo anterior se atenúa detrás en
    vez de desaparecer, para que se vea que sigue siendo el vigente hasta que el
    nuevo termine de guardarse.
  - *El mismo problema estaba en las fotos, y peor:* la carga de fotografías **no
    tenía ningún aviso**. Cada foto se lee entera —hasta 8 MB— y se le extrae la
    fecha, y se pueden subir varias de golpe: media docena tarda, y la pantalla
    no se movía. Se usa justo donde más importa, en la ficha del sitio y en las
    evidencias de la orden de trabajo, que son las que destraban la facturación.
    Ahora dice **cuántas** está cargando, porque «6 fotos» es una espera muy
    distinta de «1 foto».
  - *Y no se queda colgado si algo falla:* si el archivo resulta ilegible o no
    es una imagen, el aviso se apaga igual. Antes de este cambio no había aviso
    que apagar, pero al añadirlo era el error fácil de cometer.
- **El logo de la empresa ya sale también donde lo ve quien NO trabaja en
  ella.** Por la mañana se puso en el menú lateral, en el contrato y en la
  propuesta que se le comparte al cliente. Faltaban las dos páginas que abre
  alguien de fuera, que son justo las que más representan a la empresa ante un
  tercero. **Desplegado y verificado.**
  - *El portal donde el cliente sigue su campaña* decía «Spaces» escrito a
    mano. Su historia explica por qué: antes llevaba el nombre de una empresa
    **fijo**, de modo que al cliente de otra organización se le mostraba el
    nombre de alguien que no es su proveedor. Al corregir aquello se dejó
    genérico — correcto, pero mudo. Ahora dice el nombre y pinta el logo de
    quien de verdad le presta el servicio.
  - *La hoja de firma del contrato* es la que más llamaba la atención: **el
    mismo contrato salía con membrete visto por dentro y sin membrete visto
    desde el enlace de firma**. O sea que el logo lo veía quien ya trabaja en la
    empresa, y no lo veía el arrendador que se está comprometiendo. Un contrato
    sin membrete no es solo feo: es el documento con el que alguien firma, y no
    decía de qué empresa venía. Se le puso el mismo membrete que al contrato
    interno, así que al imprimirlo tampoco se pierde.
  - *Si una organización no ha cargado su logo*, las dos páginas se quedan
    exactamente como estaban. Nunca peor que antes.
  - *Lo que se deja fuera a propósito:* la pantalla de acceso y la de consultar
    una propuesta por código. En las dos todavía no se sabe de qué organización
    es quien está mirando, así que no hay ningún logo correcto que poner — es el
    mismo criterio por el que se quitó de la pantalla de acceso el nombre de una
    empresa concreta.
- **AVISO OPERATIVO — el acceso con Google está en el servidor, apagado, y le
  falta un paso.** Viajó al servidor dentro del despliegue de esta tarde, porque
  se subió al repositorio antes y todo lo pendiente sale junto. **Hoy no hace
  nada**: la llave de Google no está configurada, así que el botón ni se pinta y
  todo ese camino queda inerte (comprobado en el servidor: responde que Google
  no está disponible).
  - *La trampa:* **su cambio de base de datos todavía NO se ha aplicado.** Si
    alguien enciende la llave sin aplicarlo antes, entrar con Google fallará
    contra una tabla que no existe. Se comprobó expresamente antes de desplegar
    que, apagado, nada del sistema toca esa tabla — por eso se pudo desplegar
    sin riesgo. Pero encenderlo **exige aplicar el cambio de base primero**.
    *(RESUELTO el 07/08: el cambio de base ya se aplicó en producción. Ver la
    entrada de ese día.)*
- **El filtro por precio de Comercial vuelve a servir para algo.** Ofrecía
  «≤ $8,000 · ≤ $15,000 · ≤ $25,000» escritos a mano, y como **todas** las
  pantallas cuestan $45,000 o más, las tres opciones devolvían cero resultados:
  el filtro no filtraba, y de paso hacía parecer que no había inventario. Ahora
  los cortes se calculan a partir de los precios que hay de verdad.
  - *Dos reglas que se cumplen siempre:* ninguna opción puede dejar la lista
    vacía, y ninguna puede devolver absolutamente todo — eso último sería
    «Cualquier precio» con otro nombre.
  - *Puede que veas una o dos opciones en vez de tres, y es correcto:* se
    descarta cualquier corte que no separe nada. Con nueve pantallas a un precio
    y tres a otro, solo hay un corte útil.
  - *Y si todas las pantallas valieran lo mismo, el desplegable no aparece.* Un
    filtro que no puede cambiar lo que ves es ruido, y además sugiere que hay
    más datos de los que hay.
  - Desplegado y verificado en producción el mismo día.
- **La razón social de G500 pierde el prefijo «DEMO».** Parecía cosmético y no lo
  era: ese dato es **la parte que se obliga en el contrato de arrendamiento que
  se manda a firma**, así que los contratos salían con esa palabra dentro del
  nombre de la empresa. Queda «RGB CATORCE S DE RL DE CV», que es la razón social
  legal de la misma organización cuyo nombre comercial es G500 — que en pantalla
  convivan los dos nombres es lo correcto, no una inconsistencia.
- **Revisión del cierre de la auditoría: dos hallazgos estaban dados por
  inexistentes.** Al repasar el informe contra el código apareció que el guion de
  pruebas afirmaba que la numeración «saltaba» dos hallazgos y que no existían.
  Sí existían. Uno era este filtro de precio; el otro, el enlace de «olvidé mi
  contraseña».
  - *Y una prueba que se aprobaba sola:* la del filtro de precio pedía que «los
    resultados correspondan a la tarifa en pantalla» — y cero resultados
    corresponde. Quien la corriera habría dado el hallazgo por bueno con el
    fallo intacto. Reescrita.
- **«Olvidé mi contraseña» está listo para encenderse, y se revisó antes de
  decirlo.** No hacía falta programar nada: el flujo existe desde antes y solo
  está apagado porque no hay servicio de correo configurado. Antes de darlo por
  bueno se comprobó que no arrastra el fallo que ya dejó inservible al
  desbloqueo dos veces —una consulta que devuelve vacío en silencio en lugar de
  fallar—. **No lo tiene.**
  - *El detalle que habría hecho fracasar el encendido:* poner la clave del
    correo y reiniciar **no basta**. El enlace del login se fija al compilar, así
    que sin recompilar se encenderían las funciones por detrás y el enlace
    seguiría sin verse — la función viva y sin forma de llegar a ella, que es
    exactamente el fallo que se corrigió el 05/08. Queda escrito en el
    instructivo.
- **Los tres cambios de la mañana —correo por organización, logo y reparto de
  creativos— están desplegados en producción y verificados.** Se
  aplicaron las dos migraciones de base de datos (con respaldo tomado antes y un
  ensayo previo que las corre enteras y las deshace, para que si algo falla,
  falle sin escribir nada). La aplicación quedó en línea con un solo reinicio y
  sin errores nuevos.
  - *Ojo con una parte:* lo del correo por organización **está desplegado pero
    dormido**. Mientras no se configure el servicio de envío, no sale ningún
    correo — ni los nuevos ni los que ya existían. El Dueño ya puede capturar la
    dirección de su organización y queda guardada; simplemente todavía no se usa
    para nada. Lo mismo aplica a «olvidé mi contraseña», que hoy responde que
    envió un enlace y no envía nada.
  - *De paso quedó resuelta una duda que arrastrábamos:* no había forma de
    confirmar si la separación de configuración por organización (del 05/08)
    había llegado de verdad al servidor, porque su registro nunca se cerró.
    **Sí había llegado**, y se comprobó contra la base.
  - *Dos cosas salieron mal y se corrigieron en el momento*, y las dos solo se
    ven ejecutando de verdad — ninguna aparece trabajando en local:
    - La dirección desde la que se sirve el logo **necesitaba una barra final**.
      Sin ella el servidor redirige, y aunque un navegador sigue la redirección
      sin que nadie lo note, **un correo depende de que el programa de correo la
      siga**. Si no lo hace, queda un hueco donde debería ir el logo — que es
      justo lo que esa dirección venía a evitar. Corregido y vuelto a desplegar.
    - El instructivo de despliegue **daba una indicación equivocada** que habría
      detenido en seco un despliegue correcto: mandaba parar si un contador
      salía en cero, cuando salir en cero era lo normal. Corregido en el
      instructivo para que no vuelva a confundir a quien lo siga.
- **Restablecer la contraseña de otra persona quedó comprobado en producción.**
  Era lo único que faltaba por verificar del arreglo del 05/08, porque hacía
  falta entrar a la aplicación y no se podía comprobar desde fuera. Se probó
  sobre un usuario desechable —ninguna persona real perdió su sesión— y funciona
  en los dos sentidos: entrega la contraseña temporal, y con una contraseña
  equivocada dice «no correcta».
  - *Por qué importaban las dos pruebas y no una:* eran **dos fallos distintos
    que se parecían en pantalla**, y solo el texto del mensaje los distingue.
    Que salga la temporal prueba que ya hay dónde teclear la contraseña; que una
    contraseña equivocada se rechace prueba que la comprobación llega de verdad
    a la base de datos.
  - *Lo que sigue pendiente de esto:* que la liga de restablecimiento se envíe
    **por correo**. Hoy la contraseña temporal hay que pasarla a mano, lo que
    significa que quien la restablece ve una contraseña ajena. Se cierra solo en
    cuanto haya correo configurado.
- **Asignar creativos a las pantallas deja de ser de una en una.** Había que
  entrar pantalla por pantalla: una campaña de doce pantallas con dos creativos
  eran **veinticuatro campos que llenar a mano**. De ahí salían las campañas
  publicadas con todos los slots en «Sin asignar» que reportó la auditoría — no
  porque a nadie le importara, sino porque hacerlo bien costaba media tarde.
  Ahora un botón reparte los creativos elegidos entre todas las pantallas de la
  campaña.
  - *Cada pantalla parte los suyos:* las pantallas **no tienen los mismos
    slots** (las hay de 10 y de 12). Una de 12 con dos creativos queda 6 y 6;
    una de 10, 5 y 5. Repartir una sola cifra y copiarla a todas dejaría a unas
    cortas y a otras pasadas.
  - *No se pierde ningún slot:* si el reparto no da exacto, el sobrante va al
    primero de la lista, así que el cliente no paga un espacio que se queda
    vacío. El orden lo eliges tú.
  - *Respeta lo que ajustaste a mano:* si ya habías configurado algunas
    pantallas, puedes pedirle que no las toque. Y queda registrado en la
    bitácora, porque sobrescribe.
  - *Avisa de las que no pudo:* una pantalla digital a la que nadie le capturó
    sus slots no recibe reparto, y se dice **por su nombre** — el sistema se la
    va a exigir igual al publicar, y sin el nombre habría que buscarla una por
    una.
  - *Lo que esto no resuelve:* el arte en sí. Si la campaña no tiene creativos
    subidos, esto no lo inventa.
  - *Un hallazgo del propio trabajo:* la definición de «qué cuenta como pantalla
    digital» estaba **escrita por triplicado**. Si el reparto hubiera usado un
    criterio distinto al que exige el sistema al publicar, el resultado no sería
    un error visible: repartes «a todas», la aplicación dice que quedó bien, y
    al publicar se bloquea nombrando una pantalla que el reparto nunca tocó — y
    el usuario repetiría el reparto sin entender por qué no avanza. Ahora la
    definición vive en un solo sitio, con una prueba que lo sostiene.
- **Los avisos ya salen a nombre de cada organización.** Hasta ahora todo el
  correo del sistema salía con la misma identidad para las cinco
  organizaciones. Se parte en dos: los avisos de **operación** (hoy, el resumen
  diario de contratos) salen a nombre de la organización y **las respuestas
  llegan al correo que su Dueño configure**; los de **sistema** (contraseñas,
  invitaciones) siguen saliendo de la plataforma, que es quien habla en esos.
  - *Por qué las respuestas y no el envío:* el proveedor de correo verifica
    **dominios**, no direcciones. Enviar desde el dominio de un cliente exige
    que ese cliente autorice el envío en sus registros DNS, y son cinco
    dominios que no controlamos. Sin esa autorización, un correo que dijera
    venir de su dominio lo marcarían como suplantación y acabaría en spam. Así
    que el correo sale del dominio verificado, **a nombre** de la organización,
    y quien responda le contesta a ella. Se ve igual y llega. El día que un
    cliente autorice su dominio, lo único que cambia es de dónde se lee ese
    mismo dato.
  - *Se avisa antes de guardar, no en una nota al pie.* Al capturar el correo
    sale un aviso que hay que confirmar, porque lo que pasa es lo contrario de
    lo que uno espera: en la bandeja de enviados de esa cuenta no se va a ver
    nada. Una nota al pie de un formulario no se lee.
  - *Aviso:* **mientras no esté configurada la clave de envío no sale ningún
    correo**, ni los nuevos ni los de antes. Esto deja el sistema listo, no lo
    enciende.
- **El logo de la empresa ya se ve donde importa.** Estaba solo en el menú
  lateral, y a un tamaño en el que no se distinguía. Ahora sale más grande en
  el menú, en la **propuesta que ve el cliente** —que llegaba con marca
  genérica, o sea una cotización sin remite— y en los correos de aviso. En el
  contrato impreso ya estaba.
  - *El detalle que lo obligaba:* el logo se guardaba incrustado dentro de la
    propia página, y así funciona en pantalla pero **los correos lo descartan**
    — Gmail y la mayoría no muestran imágenes incrustadas de esa forma. Se
    añadió una dirección desde la que servirlo como imagen de verdad; el
    archivo se sigue guardando igual, lo que cambia es que ahora se puede
    entregar.
  - *No es una dirección adivinable:* cuelga de una llave aleatoria por
    organización y no del identificador de la empresa. Con el identificador,
    probar direcciones diría quién existe y quién no.

## 2026-08-05

- **Cada organización tiene por fin su propia configuración.** Hasta hoy la
  moneda, el IVA, el logo, los plazos de cobranza y los tiempos de exhibición
  eran **una sola fila compartida por las cinco organizaciones**. Las cinco
  estaban viendo los valores de RGB. Y no era solo de lectura: el Dueño de
  cualquier organización que cambiara su IVA o subiera su logo **se los cambiaba
  a todas las demás**, desde una pantalla de administración normal, con permisos
  legítimos y sin que quedara registro de que había tocado a terceros. Ahora hay
  una fila por organización y ninguna alcanza a la otra.
  - *Nadie estrena valores:* al migrar se copió la configuración actual a cada
    organización, así que todas se quedaron con exactamente lo que ya estaban
    viendo. El cambio no se nota hasta que alguien edita — que es el punto.
  - *El nombre de la empresa tenía dos escritorios y dos lectores.*
    «Configuración → Empresa» y «Administración → Configuración» guardaban el
    nombre en lugares distintos, y por eso el menú lateral decía «G500» mientras
    Configuración seguía diciendo «RGB Catorce». Ahora el nombre vive en un solo
    sitio y no puede contradecirse consigo mismo.
  - *Fuera el nombre grabado a mano:* la pantalla de inicio de sesión saludaba
    con «RGB Catorce S de RL de CV (PIXELED)», y ahí todavía no se sabe de qué
    organización es quien entra — a las otras cuatro las recibía con el nombre
    de un competidor. Igual en el pie del portal del cliente y en el título de
    la pestaña del navegador, que además arrastraba la palabra «Demo».
  - *Queda desplegado y verificado en producción el mismo día*, comprobando la
    prueba de fuego: cambiar el IVA en una organización y confirmar que a otra
    no le cambió nada.
- **Restablecer la contraseña de otra persona volvió a funcionar.** Estaba
  inservible desde que se desplegó, por dos motivos independientes. Uno: el
  sistema pedía reconfirmar identidad y **el único lugar de toda la aplicación
  donde se podía teclear esa contraseña era un botón que no se muestra** salvo
  que «Control de cambios» esté encendido — y está apagado en las cinco
  organizaciones. Pulsabas «Restablecer», salía un mensaje en rojo como si fuera
  un error, y no había dónde continuar. Ahora la contraseña se pide **en el
  mismo cuadro donde estás**, con la frase que explica por qué: vas a cambiar el
  acceso de otra persona y la bitácora tiene que poder probar que fuiste tú.
  - *Y dos:* la comprobación de esa contraseña consultaba los usuarios sin decir
    a qué organización pertenecen, y la protección de aislamiento la cortaba en
    seco. El resultado era que **cualquier reconfirmación de identidad respondía
    «tu usuario no tiene contraseña»**, siempre.
  - *Lo que no estaba roto todavía, y era pura suerte:* las ocho operaciones de
    dinero que pueden pedir reconfirmación (facturar, cobranza, pago de renta y
    el ciclo de contratos) funcionaban solo porque ese interruptor está apagado.
    El día que un Dueño lo encendiera, esas ocho quedaban bloqueadas sin salida
    posible. Se arregló antes de que pasara.
  - *Desplegado y verificado en producción*, salvo la prueba dentro de la
    aplicación, que necesita una sesión iniciada y quedó anotada como pendiente
    en lugar de darse por buena.
- **No se puede publicar una campaña digital con pantallas sin creativo
  asignado.** Tener un creativo *cargado* no es tenerlo *asignado*: el sistema
  solo comprobaba que la campaña tuviera alguno, y por eso había campañas
  publicadas y hasta completadas con todos sus espacios en «Sin asignar». Sin
  esa liga, el reporte al cliente no puede probar que su anuncio salió en cada
  sitio, que es justo lo que se le vendió. El aviso nombra **cuáles** pantallas
  faltan, para no tener que buscarlas una por una en una campaña de doce.
  - *Aviso operativo:* hoy 11 de las 13 campañas digitales en producción no
    tienen ningún creativo asignado a sus pantallas. Las ya terminadas no se
    vuelven a enviar, pero las **confirmadas** (mastercard2, EdgeCase Fechas y
    `credito` en eyro) se van a bloquear cuando alguien intente publicarlas
    hasta que se asignen los creativos en la pantalla de Creativos. Es el efecto
    buscado, pero conviene saberlo antes de toparse con él.
- **Listas largas paginadas y la misma factura, una sola vez.** Actividad
  pintaba sus 168 entradas de golpe y los pagos de renta más de 30 filas
  programadas hasta 2027. En Cobranza el problema era distinto: una factura a
  doce parcialidades salía **doce veces**, así que no se podía saber cuántas
  facturas hay de verdad. Ahora es una fila por factura, desplegable a sus
  cuotas, y el estado del grupo es el **peor** de ellas: una factura con once al
  corriente y una vencida está vencida, y pintarla en verde sería exactamente el
  semáforo mentiroso que hay que evitar.
- **Fechas y cifras que se leían mal.** El periodo de los pagos de renta se
  imprimía en formato crudo (`2026-08-27`) en tres pantallas, junto a otras que
  ya usaban dd/mm/aaaa. Y los sufijos de tipo «(24d)» o «hace 18 días» iban
  pegados a la fecha al copiar la celda («27/08/2026(24d)»).
- **El tiempo de exhibición global ya no dice gobernar lo que no gobierna.**
  Configuración anunciaba «loop 60s / slot 10s = 6 espacios» y debajo afirmaba
  que eso se usaba al apartar pantallas digitales. Es falso: lo que se aparta
  son los espacios propios de cada pantalla, y por eso convivía un 6 con
  pantallas de 10 y de 12 sin nada que dijera cuál mandaba. Ahora se presenta
  como **referencia** y se indica cuántas pantallas tienen su propio número, con
  sus valores. El mismo aviso aparece al reservar, que es donde más engañaba.
- **Validación del teléfono y errores debajo del campo que los causa.** El RFC,
  el código postal y el correo ya se validaban; el teléfono entraba tal cual
  («abc123xyz» se guardaba). Se valida por cantidad de dígitos y no con una
  plantilla rígida, porque «55 1234 5678», «(55) 1234-5678» y «+52 55 1234 5678»
  son el mismo número correcto. Además, el motivo del rechazo ahora se pinta
  **bajo el campo**: antes había un solo mensaje al pie, así que con dos datos
  mal el usuario arreglaba uno, reenviaba y descubría el otro.
- **El catálogo de tipos de tarea deja de mentir.** «Tipos de tarea de
  cuadrilla» era un editor de texto libre que **no leía nadie** — las órdenes de
  trabajo sacan su tipo de una regla del producto según el tipo de pantalla. Por
  eso el catálogo salía vacío mientras Operaciones tenía una OT de «Montaje de
  lona». Ahora es de **solo lectura** y muestra lo que de verdad rige y a qué
  pantalla aplica cada tarea. Llenarlo habría sido peor: seguiría sin gobernar
  nada y encima parecería que sí.
- **Detalles visibles que estorbaban a diario.**
  - Los campos de los formularios tenían contorno, pero de un color tan tenue
    sobre blanco que **no se veía** — para el usuario es lo mismo que no
    tenerlo. Se corrigió el color en un solo sitio, así que alcanza también a
    los formularios que aún no existen.
  - «Agregar inventario» pasa a llamarse **«Inventario»**: el menú prometía
    menos de lo que hay dentro (consulta, carga masiva y exportación) y escondía
    la consulta a quien no entraba a curiosear.
  - El KPI «Renta mensual $65,000» dejaba fuera 9 contratos sin capturar y la
    salvedad vivía en una nota al pie, así que la cifra se citaba fuera de
    contexto como si fuera la renta real. Ahora la coletilla («+ 9 por
    capturar») va pegada al propio número.
  - Los nombres de pantalla cortados («AUTOPISTA MEX…») y el detalle de las
    notificaciones cortado a media frase ya se pueden leer completos sin abrir
    la ficha.
  - **«Eliminar» deja de ser un botón rojo junto a «Editar».** Borrar una
    pantalla no se deshace, y tenía el mismo peso visual que la acción más
    inocua de la ficha. Se separa, se hace discreto, y la confirmación ahora
    pide **escribir el nombre** de la pantalla. No es fricción por gusto:
    obliga a leer cuál es, que es justo lo que un clic reflejo no hace.
- **El repositorio vuelve a poder construir una base de datos que funciona**, y
  hay un arnés de pruebas que lo comprueba en cada corrida contra una base real.
  Al montarlo aparecieron **143 columnas faltantes** respecto a producción: la
  definición base iba por detrás, la cadena de actualizaciones no se podía
  reaplicar desde cero, y tres piezas existían **solo en producción**, creadas a
  mano y nunca registradas. Eso último no era cosmético: en cualquier entorno
  levantado desde el repositorio, **retirar un creativo fallaba**. Hoy la
  diferencia con producción es de cero columnas.
  - *El detalle que casi se cuela:* la primera versión de la prueba de
    aislamiento daba verde, pero porque la tabla estaba vacía, no porque aislara
    — se conectaba con un usuario con permisos totales, que ignora la
    protección. Firmar un aislamiento inexistente es peor que no tener la
    prueba: da confianza sin respaldarla. Ahora se siembra un dato antes de
    comprobar, y se usa un usuario equivalente al de producción.

## 2026-08-04

- **Corregidos los hallazgos de la auditoría de calidad del 04/08.** Se
  trabajaron por fases, de lo que rompe el sistema a lo que solo se ve feo.
- **Los módulos ya no arrancan diciendo «0 de 0».** Al abrir la aplicación, las
  pantallas se pintaban antes de que llegaran los datos: todos los módulos
  mostraban cero, el menú lateral anunciaba «RGB Catorce» y el mapa salía sin
  nada que encuadrar. Nunca se perdió la sesión ni la organización — faltaba un
  estado de carga. De paso, cuando la carga fallaba, el sistema **se quedaba
  vacío para siempre y sin avisar**; ahora avisa.
- **La ocupación decía 0% junto a una gráfica marcando 42%.** El indicador
  contaba pantallas marcadas como «ocupado» mientras la gráfica contaba reservas
  confirmadas del periodo. En producción las 12 pantallas de G500 están en
  «reservado» y ninguna en «ocupado», de ahí el cero. Los dos usan ya el mismo
  criterio.
- **Una sola tarifa por pantalla.** Había dos campos con el mismo número en la
  misma unidad, y tres pantallas de G500 quedaron descuadradas (45 mil contra 85
  mil): Comercial leía uno y Red leía el otro. Ahora hay una sola fuente — y con
  eso se arregló también el filtro de precio, que comparaba contra el campo
  rezagado.
- **Importes negativos por una comisión mal acotada.** Una comisión del 150%
  daba un neto **negativo**, y de ahí salían los −135,333.33 de la campaña
  EdgeCase, que además se sumaban a los indicadores del tablero. Se acota en los
  tres puntos donde se calculaba a mano, el formulario valida con el mismo
  criterio que el servidor y explica el motivo.
- **El candado de facturación dejaba de exigir fotos a las campañas digitales.**
  La pantalla reimplementaba la regla por su cuenta y pedía evidencia física a
  una campaña digital, así que **toda digital quedaba «Pendiente» para siempre**
  aunque el servidor sí la dejara facturar. Además, el panel listaba las tres
  condiciones siempre: una campaña digital aparecía con «Fotografías
  comprobatorias» en rojo **junto a un candado completo**. Ahora solo se listan
  las condiciones que a esa campaña le aplican.
- **«Completo» que no lo era.** «Rentabilidad» y «Reporte de cumplimiento»
  tenían el estado fijo en «hecho» pasara lo que pasara — de ahí el «Completo ·
  0% entregado» y el «Completo · Margen 93%» sobre un total negativo. Ahora
  cumplimiento exige el 100% entregado y rentabilidad no se da por buena con
  margen negativo. También: una orden de trabajo podía quedar «Completada · Sin
  asignar»; al cerrarla se estampa quién la cerró.
- **Campañas cuyo estado contradice el calendario.** El estado sigue el flujo
  (confirmar, publicar, facturar), no la fecha, así que nadie lo movía al vencer.
  No se reescribe solo a propósito — «Completada» condiciona la facturación y
  automatizarlo podría dar por entregado algo que nunca se entregó. En su lugar,
  la lista muestra un distintivo cuando el estado y las fechas no cuadran.
- **El registro público de cuentas queda apagado tras un interruptor.** La demo
  pública y producción son el mismo despliegue sobre la misma base, así que un
  registro anónimo aterrizaba en datos reales. Ocultar solo el botón no bastaba
  (la dirección seguía abierta), así que se comprueba también en el servidor.
- **Textos y cifras que se leían mal.** «null · EDOMEX, EDOMEX» en la ficha de
  sitio; «PANTALLA_DIGITAL» en crudo en la tabla de la red; «mess» en el
  selector de duración; «$ 4897.5k» para cuatro millones y medio, junto a un
  «$ 2,505,600.00» en la misma tarjeta; y mensajes de «no hay resultados» que
  mandaban a revisar un filtro que estaba vacío. También el mapa, que centraba
  en **Lima** por herencia de la demo original, y la pantalla de error 404, que
  salía oscura y sin marca.
- **La pantalla de Integraciones dejaba ver los nombres de las claves de
  acceso** de AdMobilize, del CMS y del timbrado fiscal. Ya no salen. El aviso
  de «Modo demo» tampoco es fijo: aparece solo si algún conector realmente no
  tiene credenciales.
- **Se acabó la contraseña compartida para las operaciones sensibles.** Había
  **una sola contraseña que tecleaba todo el equipo** para reconfirmar identidad
  al facturar, cobrar o pagar renta. Un secreto colectivo no prueba identidad: la
  bitácora afirmaba «Ana facturó» cuando lo único verificado era «alguien que
  conoce el secreto del equipo facturó» — la peor propiedad posible para un
  registro de auditoría en un sistema que mueve dinero. Ahora cada quien
  reconfirma con **su propia contraseña de acceso**: no hay ningún secreto nuevo
  que guardar ni rotar, y dar de baja a una persona basta para revocarle el
  acceso.
  - *Se retira la excepción del Dueño.* Con la contraseña propia el costo para
    él es el mismo que para los demás — teclear lo que ya sabe —, así que la
    excepción dejó de comprar comodidad y solo compraba riesgo: es su sesión la
    que más daño hace desatendida.
  - *Restablecer la contraseña de otro ya no permite elegirla.* Antes cualquier
    Dueño fijaba la de otra persona, entraba como ella y todo quedaba registrado
    a su nombre — suplantación indistinguible de actividad legítima. Ahora el
    sistema genera una temporal de un solo uso, corta las sesiones vivas del
    afectado y le obliga a cambiarla al entrar.
  - *El envío por correo queda pendiente*, y se dice por qué: hoy producción no
    tiene configurada la clave de envío, así que adoptarlo ahora habría dejado
    el restablecimiento inoperante. Está preparado para que solo cambie la forma
    de entrega.
- **La matriz de permisos ahora declara qué abre cada fila.** No faltaban
  módulos, como se creía: nueve áreas de la interfaz iban bajo un permiso
  paraguas, así que marcar «comercial» abría además Clientes, Propuestas y
  Campañas sin que nada lo dijera. La matriz mostraba 8 filas y parecía completa.
  - *Lo que sí era un defecto:* el rol CLIENTE existía sin **un solo permiso**,
    así que se podía crear un usuario que entraba y recibía «no autorizado» en
    todo, incluido el tablero. Se retira; el cliente externo no necesita cuenta,
    su portal va por enlace público.
  - *Aviso a ventas:* **COMERCIAL pierde la escritura del catálogo** (conserva
    la lectura). Vender no debería implicar poder reestructurar el activo que se
    vende; a quien de ventas venga dando de alta pantallas hay que decírselo.
- **Limpieza de datos de prueba en producción (13 filas del tenant g500).** Se
  quitaron los prefijos `TEST_` de un cliente, dos campañas y sus dos propuestas
  espejo, y los creativos llamados «WhatsApp Image 2026-07-13 at 17.06.24»
  pasaron a nombres por campaña — solo cambia el rótulo, la imagen es la misma.
  Además se corrigió el rango de fechas invertido de la campaña EdgeCase (31/08
  → 01/08) en las tres tablas donde vive, con lo que su importe pasó de
  −135,333.34 a +144,666.67 sin tocar un solo precio: el monto es derivado y con
  el rango al revés salía en negativo.
  - *Con respaldo y ensayo:* el rollback se capturó leyendo la base **antes** de
    aplicar, y se hizo una pasada en seco para confirmar que tocaba 13 filas y
    no una más. El registro queda en `docs/datos/`.

## 2026-08-03

- **Recordatorios diarios de contratos, en la app y por correo.** Hasta ahora los
  avisos se calculaban al abrir la pantalla: si nadie entraba, nadie se
  enteraba. Ahora una tarea programada revisa los contratos cada mañana y deja
  el aviso en la campana de notificaciones, más un correo de resumen a los
  Dueños. Avisa de tres cosas: contratos **sin capturar** (los que nacieron al
  cargar o vender una pantalla y siguen sin renta), los que **vencen en los
  próximos 3 días** y los que **ya vencieron**.
  - *Por qué 3 días y no 90:* el aviso a 90 días ya existe en pantalla. Este es
    el de «esto se te va encima mañana», y una ventana ancha lo convertiría en
    ruido que se aprende a ignorar.
  - *Un solo correo por organización, y solo si hay algo nuevo.* Nueve correos
    seguidos se archivan sin leer, y el décimo —el que importaba— con ellos. Si
    no hay novedades del día, no se manda nada.
  - *No se duplica:* si la tarea se dispara dos veces, o alguien la lanza a mano
    para probar, el aviso del día no se repite.
  - *Sin correo configurado sigue funcionando:* las notificaciones aparecen igual
    dentro de la app y el sistema lo dice en vez de fallar en silencio. Hoy en
    producción falta la clave de envío, así que de momento solo hay campana.
- **Descarga de contratos vigentes en Excel**, desde la pantalla de Arrendadores.
  Deja fuera a propósito los contratos **sin capturar** —todavía no son un
  acuerdo, y colarlos con columnas vacías haría creer que existe un trato que no
  existe— y los cancelados o vencidos. Un contrato de predio cuenta **todas** las
  pantallas del inmueble, no solo una: es lo que ampara de verdad.
- **Al elegir el arrendador en «Completar contrato» ya se ve a quién se le va a
  pagar.** Antes solo salía el nombre, y el nombre no dice si se le podrá
  facturar: la renta se cobra contra una razón social con RFC y régimen fiscal.
  Ahora se muestran esos datos y se avisa de los que falten, sin bloquear el
  guardado — el acuerdo es real aunque el dato fiscal se capture después.
- **Corregido: cambiar el rol de alguien dejaba su pantalla con el rol viejo.**
  La sesión se leía una sola vez al abrir la aplicación, así que quien veía la
  pantalla seguía con sus permisos anteriores hasta recargar a mano. No era un
  agujero de seguridad —el servidor sí aplicaba el rol nuevo de inmediato— pero
  la interfaz ofrecía botones que iban a fallar.
- *Se revisó también* que no se pueda dar de alta una pantalla sin arrendador, y
  **ya estaba bien**: se comprobó atacando directamente la API sin pasar por la
  pantalla, y la rechaza en los tres casos (sin arrendador, vacío, o de otra
  organización), sin dejar registros a medias.


- **Corregida la carga masiva de inventario, que fallaba con «Sin acceso a ese
  registro» en cualquier organización que no fuera la primera.** Al subir
  pantallas desde Excel a un CRM recién creado, la carga se interrumpía entera y
  no entraba ni una pantalla. Con la organización original funcionaba sin ruido,
  y por eso llevaba tiempo sin detectarse: el fallo solo aparece al dar de alta
  un CRM nuevo, que es justo lo que se estaba haciendo para validar el ciclo
  completo.
  - *Qué pasaba:* cada pantalla guarda aparte sus modalidades de venta (mensual,
    catorcenal, por spot…). Esa tabla arrastra un valor por omisión que apunta a
    **una organización fija**, y al guardar no se indicaba a cuál pertenecía la
    modalidad, así que se escribía siempre esa. El aislamiento entre
    organizaciones —que existe para que nadie lea ni escriba datos de otra—
    detectaba la incoherencia y rechazaba la operación. Al usuario le llegaba el
    mensaje genérico de permisos, que no decía nada de la causa real.
  - *Qué se cambió:* la modalidad hereda ahora, de forma explícita, la
    organización **de su propia pantalla**. No es solo "mandar el dato que
    faltaba": es la regla que vuelve imposible que una modalidad quede colgada de
    una organización distinta a la de la pantalla a la que pertenece, aunque ese
    valor por omisión desaparezca o cambie.
  - *El alcance era mayor que el reportado:* el mismo defecto afectaba también al
    alta manual de una pantalla y al alta de «contrato + pantalla» desde
    Arrendadores, no solo a la carga masiva. Las tres pasan por el mismo guardado
    y las tres quedan corregidas.
  - *No se perdieron datos:* la carga masiva corre dentro de una transacción, así
    que al fallar revierte completa y no deja medio lote cargado. Queda por
    confirmar contra producción que no quedó nada del intento fallido.
  - *Se añadió una prueba de regresión* que falla si alguien vuelve a omitir la
    organización al guardar modalidades, comprobada revirtiendo la corrección
    para verificar que efectivamente falla sin ella.
- **De paso se detectaron dos cosas que NO se tocaron en este cambio**, para que
  queden anotadas:
  - *El valor por omisión está en 21 tablas, no en una,* y no vive en el
    repositorio: se añadió a mano directamente en la base. Hoy ningún guardado
    del sistema depende de él, pero mientras siga ahí convierte un descuido
    ("olvidé indicar la organización") en un error de permisos en producción, en
    lugar de un fallo inmediato y evidente en desarrollo. Se acordó quitarlo en
    una migración aparte.
  - *La configuración de negocio sigue siendo única y compartida* (moneda, IVA,
    plazos de cobranza, loop/spot). Ya estaba documentado como limitación
    conocida, pero conviene tenerlo presente al validar con un CRM de prueba:
    cambiarle esos parámetros se los cambia también a la organización real. El
    nombre que se ve en la barra lateral sí es propio de cada organización.
- *Comprobado contra producción:* el valor por omisión **existe** y apunta a la
  organización más antigua. Hay **cinco** organizaciones dadas de alta, así que
  las otras cuatro chocaban con esto. Y el daño ya estaba hecho: **15 modalidades
  de venta de 16 pantallas de dos organizaciones distintas están guardadas a
  nombre de la primera**. Esas pantallas no muestran hoy sus tarifas ni sus
  costos a quien es su dueño. Es anterior al error reportado: hasta el hardening
  del 20 de julio esto ocurría en silencio, y a partir de entonces empezó a dar
  el error visible. Se barrieron doce tablas por organización y esta es la única
  afectada; el resto cuadra.
- *Falta una reparación de datos, además del arreglo de código:* con esas filas
  viejas ahí, volver a subir esas mismas 16 pantallas seguiría fallando aunque el
  arreglo esté desplegado (el archivo choca con un registro que la organización
  no puede ver). Se comprobó reproduciéndolo. La reparación mueve cada modalidad
  a la organización de su pantalla y necesita permisos de administrador de la
  base; queda pendiente de autorización.
- *Despliegue:* **pendiente**. El código está verificado en local —se reprodujo
  el fallo con otra organización, se confirmó que el arreglo lo resuelve, y la
  batería completa queda en verde—, pero no se ha desplegado.

- **Alta de arrendador: se piden los datos fiscales y se avisa del RFC mal
  escrito al teclearlo.** El RFC ya se rechazaba en el servidor, pero el aviso
  llegaba después de enviar el formulario. Ahora se marca en el momento, con la
  misma regla que aplica el servidor (antes estaba escrita por duplicado en dos
  sitios; ahora es una sola). Además se pueden capturar **razón social y régimen
  fiscal** en el alta, ambos opcionales: es a quien se le factura la renta, y
  pedirlo cuando se tiene a la mano evita tener que volver a entrar a la ficha.
  Si el arrendador se crea pero su razón social falla, se dice — antes ese caso
  habría dejado un arrendador sin datos fiscales sin que nadie se enterara.
- **Carga masiva más simple: se quitaron dos botones y ahora el archivo es quien
  responde.** Desaparece la casilla «todas estas pantallas están en el mismo
  predio» con su selector: se pedía al operador que AFIRMARA algo que el propio
  Excel ya dice. Ahora solo se escribe el **nombre del predio** —y si ya existe,
  se reutiliza en vez de duplicarlo— y al cargar el archivo el sistema
  **comprueba que las direcciones sean la misma o parecidas**, avisando de las
  que se salen del grupo y a qué distancia. Avisa, no bloquea: sin coordenadas en
  el Excel la única evidencia es cómo está escrita la dirección, y eso no da para
  rechazar un archivo. También se quitó el botón «Nueva pantalla» de dentro del
  importador: el alta manual ya tiene su propia pestaña, y esconderla ahí obligaba
  a entrar a «importar» para descubrir que también se podía dar de alta una sola.
- **El precio de impresión por m² solo aparece si el archivo trae pantallas
  estáticas.** La impresión es de la lona y una pantalla digital no lleva lona,
  así que en un archivo solo-digital era un campo que invitaba a capturar un
  número que no se iba a usar.
- **Ya se puede descargar el inventario en Excel o CSV.** Sale con el **mismo
  formato que la plantilla de carga**, así que el archivo descargado se puede
  editar en masa y volver a subir sin traducir nada. Descarga lo que esté
  filtrado en pantalla, no siempre todo. Dos detalles que se cuidaron: las
  coordenadas puestas por defecto **no** se exportan (son «sin capturar», y
  sacarlas las convertiría en dato bueno en la siguiente vuelta), y lo que no
  tiene dato sale como celda vacía y no como cero — un cero en la renta se leería
  como que el espacio es gratis.

## 2026-07-29

- **Nuevo cuadre de renta: cuánto se le debe a cada propietario.** En la pantalla
  de Arrendadores aparece una tabla que responde de un vistazo lo que antes solo
  se podía averiguar contrato por contrato: qué está vencido, qué está pendiente
  y qué ya se pagó, con el desglose de cada propietario. La información siempre
  estuvo ahí, pero había que sumarla a mano y en la práctica nadie lo hacía, así
  que con un propietario de varios predios no se sabía el total.
  - *Cómo se agrupa:* por **emplazamiento**, no por pantalla ni por contrato. Un
    predio con seis caras es una negociación con un propietario, no seis. Se
    despliega haciendo clic en el propietario para ver cada predio o pantalla
    suelta por separado.
  - *El orden es el orden en que hay que actuar:* arriba quien tiene deuda
    vencida. La columna "próximo" muestra el periodo impago **más antiguo**, que
    es el que urge, no el siguiente del calendario.
  - *No se pierde ni se duplica nada:* si un pago quedara sin contrato asociado,
    aparece igualmente en una fila aparte en vez de desaparecer. Un cuadre al que
    le faltan renglones es peor que no tenerlo, porque se usa para pagarle a
    alguien real. Se comprobó contra los datos reales de producción: 13 de 13
    pagos y $260,000 de $260,000.
  - *Dónde NO está:* en Finanzas. Ese módulo recibe los pagos a propósito **sin**
    los contratos, para no exponerle importes ni datos del propietario, y sin
    contratos no hay a quién agrupar. Si se quiere que Finanzas también lo vea,
    es una decisión de permisos que hay que tomar aparte.
- **Ya se puede registrar la vigencia de licencias y permisos, y el sistema avisa
  antes de que venzan.** Era el hueco que la auditoría había marcado: el sistema
  pedía alertar de tres cosas —contrato, renta y permiso— pero de la tercera no
  avisaba nunca, sencillamente porque **no había dónde guardar la fecha**. El
  estatus legal de una pantalla ya contemplaba "permiso vencido", pero solo se
  llegaba ahí a mano.
  - *Dónde se capturan:* en la ficha del contrato, en un apartado nuevo
    "Licencias y permisos". Se registra el tipo (municipal, ambiental,
    estructural u otro), el folio, la autoridad que lo expide y —lo importante—
    la fecha de vencimiento.
  - *A quién amparan:* el sistema lo decide solo, con la misma regla que los
    contratos. Si la pantalla pertenece a un predio, el permiso es **del predio y
    cubre a todas sus pantallas**; si es una pantalla suelta, el permiso es suyo.
    No se le pide al usuario que elija, porque elegir mal dejaría media ubicación
    sin amparo y nadie lo notaría.
  - *Cuándo avisa:* **120 días antes**, más margen que los 90 de los contratos,
    porque renovar ante la autoridad es un trámite y no una firma. El aviso pasa
    a rojo dentro de los últimos 30 días y también cuando ya venció.
  - *Qué NO hace:* un permiso vencido **no bloquea la venta**. Fue una decisión
    deliberada: bloquear en automático frenaría ventas cuando el permiso ya está
    renovado pero todavía no se ha capturado, que es el caso más habitual. Si más
    adelante se prefiere que bloquee, se activa sin rehacer nada.
  - *Renovaciones:* se guarda el histórico. Registrar la renovación no borra la
    anterior, así que queda la trazabilidad de que la ubicación estuvo siempre
    amparada. También caben varios permisos a la vez sobre el mismo sitio, y que
    uno esté vigente no tapa que otro haya vencido.
- **De paso se corrigió un error de conteo de días que venía de antes.** Los
  avisos decían un día de más: un permiso vencido hacía 12 días reportaba 13, y
  un contrato vencido ayer decía "hace 0 días". Era un problema de zona horaria
  al interpretar las fechas. Afectaba a los avisos de contratos y de pagos de
  renta, no solo a los nuevos.
- *Despliegue:* respaldo verificado antes de tocar nada (7.1 MB, 34 tablas, 17
  contratos), migración aplicada y comprobación posterior creando y borrando una
  licencia real en producción. **Sin interrupción del servicio** esta vez: no
  hizo falta reinstalar dependencias.

## 2026-07-28

- **Corregido el error intermitente que tumbaba el dibujado de algunas páginas.**
  En el registro técnico aparecía de vez en cuando un fallo al generar la página
  en el servidor. No rompía la aplicación entera —el sitio seguía respondiendo—
  pero cada aparición era una página que se servía mal, y era imposible predecir
  cuál.
  - *Qué pasaba:* el proyecto tenía **dos versiones distintas de React** conviviendo.
    La aplicación usaba la 18 y en la raíz había una 19. La librería que aplica los
    estilos quedaba enganchada a la copia equivocada y se caía al intentar dibujar.
  - *De dónde salía la segunda:* de `packages/ui`, un paquete de ejemplo que vino
    con la plantilla del proyecto (tres componentes de muestra: botón, tarjeta y
    bloque de código) y que **no se usa en ninguna parte**. Arrastraba React 19 sin
    aportar nada.
  - *Solución:* se alineó ese paquete a la misma versión de React que usa la
    aplicación y se dejó un candado en la configuración para que ninguna
    dependencia futura vuelva a meter una segunda copia. El candado se probó a
    propósito: aun forzando la versión vieja, el sistema resuelve una sola.
  - *Comprobación:* se vació el registro de errores y se volvieron a visitar las
    páginas que fallaban (acceso, propuesta compartida, portal de cliente,
    recuperar contraseña) además de entrar con un usuario real. **Cero
    apariciones del fallo.**
  - *Nota:* el despliegue exigió reinstalar las dependencias del servidor, lo que
    obliga a detener la aplicación. **Hubo unos 4 minutos de interrupción.**
- **La renta de las pantallas individuales dejó de ser invisible.** Es el
  arreglo más importante del día y cambia números reales. Hasta hoy, el cálculo
  de rentabilidad solo entendía los contratos colgados de un *predio*. Una
  pantalla suelta —sin predio, con su propio contrato— aparecía con **renta $0**,
  con la ganancia completa como margen, y el sistema además afirmaba que **no
  tenía contrato**, así que ni siquiera salía en la lista de pendientes. El
  espacio figuraba como gratis y nada lo denunciaba.
  - *Efecto concreto en producción:* la `PANTALLA DIGITAL DEMO` de **eyro** tiene
    un contrato vigente de **$20,000 al mes** —el que capturamos esta semana— y
    el sistema lo mostraba como $0. Ahora su costo de renta es $20,000 y el
    margen de esa pantalla bajó en la misma cantidad. No es un error nuevo: es
    dinero que siempre se pagó y que por fin se ve. **demo g500 no cambió**, sus
    $65,000 mensuales ya se contaban bien.
  - *La regla que quedó fija:* un predio tiene **un** contrato y lo comparten
    todas sus pantallas; una pantalla suelta tiene el suyo. Nunca se suman los
    dos, así que la renta no puede contarse doble. Las campañas siguen siendo por
    pantalla, como hasta ahora.
- **Vender la segunda cara de un predio ya no abre un contrato duplicado.** Al
  aprobar una propuesta, el sistema buscaba si esa pantalla tenía contrato, pero
  no miraba el del predio al que pertenece. Resultado: cada cara vendida
  estrenaba su propia ficha, aunque el predio ya estuviera contratado. Eso
  producía alertas falsas de "contrato incompleto" sobre espacios que sí estaban
  cubiertos, y si alguien completaba una de esas fichas con un importe, quedaban
  dos contratos vivos sobre el mismo predio: renta pagada dos veces.
  - Se encontró **una ficha así en producción**: `BLVD. MAGNOCENTRO INTERLOMAS -
    CARA B`, cuyo predio ya tenía un contrato vigente de $45,000. Quedó
    **cancelada con su motivo**, no borrada, para que el registro explique por
    qué desapareció. Los 9 pendientes de demo g500 y los 3 de eyro son legítimos
    y siguen ahí.
- **Ya no se puede registrar un contrato con renta de $0.** Era el hallazgo más
  caro de la auditoría: un contrato en cero se daba por completo, salía de la
  lista de pendientes y dejaba el espacio con la ganancia íntegra como margen,
  sin ningún aviso. Ahora se rechaza al capturarlo **y** la base de datos lo
  impide por su cuenta, junto con las vigencias que terminan antes de empezar.
  - *Detalle que se respetó:* el alquiler de **un solo día** sigue siendo válido.
    Se detectó a tiempo que hay propuestas de un día en demo g500 y que una regla
    más estricta habría impedido aprobarlas.
- **Una pantalla suelta ya no puede tener dos contratos activos a la vez.**
  Faltaba ese candado: existía para los predios y para los pendientes, pero no
  para este caso, y era alcanzable desde la aplicación.
- *Despliegue:* respaldo de la base verificado antes de tocar nada (7.1 MB, 34
  tablas, 17 contratos), migraciones aplicadas, aplicación reconstruida y
  reiniciada, y comprobación posterior con datos reales de eyro. Sin incidencias.
- *Sigue pendiente:* aparece en el registro técnico un error de React duplicado
  (`styled-jsx`) que **ya existía antes** de estos cambios y conviene atacar
  aparte; y las contraseñas del servidor compartidas por chat siguen sin rotar.

- **Auditoría independiente del módulo de Arrendadores.** Se revisó el módulo
  regla por regla contra la especificación del dueño del producto, sin corregir
  nada: el objetivo era saber en qué estado real está de cara a la salida a
  producción con PIXELED. Informe completo en
  `docs/CONFORMIDAD_ARRENDADORES_20260728.md`. Resultado: **20 reglas conformes,
  8 parciales, 1 con desviación**. Los diez casos de cálculo se ejecutaron
  contra el sistema real —no se razonaron sobre el papel— y nueve dieron el
  número esperado al peso.
  - *Lo que está bien:* el corazón del cálculo de rentabilidad. La renta es el
    único costo del espacio (el viejo "costo de compra" ya no se resta por
    ningún lado, se comprobó metiendo un valor falso de $99,999 y viendo que el
    margen no se movía), se reparte en partes iguales entre las caras del
    predio, un contrato vencido deja de sumar costo el mismo día, y el sistema
    impide crear dos contratos vigentes solapados sobre el mismo predio.
  - *Lo que hay que arreglar antes de facturarle a un cliente real:* **el
    sistema acepta un contrato con renta de $0**. Si eso pasa, el contrato se da
    por completo, desaparece de la lista de "contratos incompletos" y la
    rentabilidad de ese espacio aparece como ganancia íntegra: el espacio parece
    gratis. Es el error más caro posible en este módulo porque no da ningún
    aviso. Relacionado: la base de datos tampoco rechaza fechas invertidas (fin
    antes que inicio) — hoy solo lo frena la pantalla.
  - *Aviso a futuro:* el reparto de renta por pantalla no distingue monedas.
    Mientras todo sea en pesos no pasa nada, pero el primer contrato en dólares
    haría que el total del tablero y la suma de los márgenes por pantalla dejen
    de cuadrar, sin marcar error.
  - *Faltantes detectados:* no hay dónde guardar la vigencia de licencias y
    permisos, así que la alerta de permiso por vencer no puede existir todavía;
    y el registro de un pago no guarda bajo qué razón social se pagó.
  - *Sobre la documentación:* `docs/Reglas_Arrendadores.md` quedó desactualizado
    —no menciona los contratos incompletos, ni el calendario automático de
    pagos, ni que los campos de renta del sitio ya no se usan—. Conviene
    rehacerlo antes de que alguien lo tome como referencia.
  - *Alcance:* se auditó sobre la base local, no sobre producción, porque las
    pruebas exigían crear contratos e incidencias y eso dejaría rastros
    imborrables en la bitácora del cliente. Los datos de producción quedan sin
    auditar: los 17 contratos incompletos siguen sin importe conocido. Todos los
    datos de prueba se borraron y se comprobó que no quedó ninguno.
- **El sistema ya vive en https://demo.space-os.io.** Se acabó entrar por la IP:
  cualquier acceso por `209.97.146.136` redirige de forma permanente al dominio,
  conservando la ruta, así que los enlaces guardados siguen funcionando.
  Certificado válido de Let's Encrypt (renovación automática comprobada), HTTP/2
  y compresión. Los enlaces de recuperar contraseña ya apuntan al dominio y no a
  la IP, y la cookie de sesión viaja marcada como `Secure`: solo por HTTPS.
  Procedimiento completo y cómo revertirlo en `docs/runbook-dominio-https.md`.
  - *Pendiente:* Cloudflare sigue sin hacer de proxy (nube gris). Al activarlo
    hay que ejecutar `infra/nginx/cloudflare-realip.sh`; si no, todas las visitas
    parecerán venir de una misma IP y el décimo intento de acceso fallido de
    cualquiera bloquearía el ingreso de todos durante 5 minutos.
- **Renombrar la organización queda reservado al Dueño.** Antes bastaba con el
  permiso de Administración, que se puede conceder a otros roles sin tocar
  código; el nombre identifica al negocio en toda la aplicación, así que ahora
  depende del rol y no de un permiso configurable. La bitácora registra el
  cambio completo ("nombre anterior → nombre nuevo") en vez de solo el nuevo.
- **Aviso de carga en toda la aplicación.** Al guardar, aprobar, facturar o
  registrar un pago no había ninguna señal de que el sistema estuviera
  trabajando: la pantalla parecía congelada hasta que llegaba la respuesta. Ahora
  una barra fina en el borde superior se enciende mientras haya alguna petición
  en curso. Aparece solo si la espera se nota de verdad —las respuestas rápidas
  no la disparan, porque un parpadeo se lee como un error— y no simula un
  porcentaje de avance, que sería inventado. Respeta la preferencia del sistema
  de reducir animaciones y se anuncia a los lectores de pantalla. Los avisos de
  carga que ya había al abrir cada pantalla siguen igual; esto cubre el hueco de
  las acciones.
- **Una campaña ya se puede cobrar en parcialidades.** Hasta ahora se cobraba de
  una sola vez, con un plazo de 60/90/120 días; no había forma de pactar
  mensualidades, que es lo normal en contratos anuales. Al generar la factura hay
  una casilla "Cobrar en parcialidades": eliges cuántas, cada cuánto (quincenal,
  mensual, bimestral o trimestral) y desde qué fecha, y ves el importe de cada
  cuota antes de emitir. Las cuotas son iguales y **la última ajusta el
  redondeo**, de modo que siempre suman el total exacto de la factura. Cada
  parcialidad tiene su propio vencimiento y se cobra por separado; la factura
  solo queda saldada cuando se han pagado todas.
  - *El número de cuotas ya no se teclea:* se calcula solo a partir de la
    duración de la campaña, y únicamente se ofrecen los repartos que caben. La
    regla es que las cuotas salgan enteras y sean al menos dos —cobrar en "una
    parcialidad" no es fraccionar el pago, es el cobro único de siempre—, y de
    ahí salen las restricciones: una campaña de **un mes** solo admite dos
    quincenales; una de **dos meses**, como mucho mensuales; y las **anuales**
    aparecen a partir de 24 meses, porque con 12 saldría una sola cuota. El
    desplegable dice directamente "8 cuotas trimestrales" en vez de pedir dos
    datos sueltos, y si la campaña no admite ningún reparto lo explica en vez de
    ofrecer opciones que van a fallar. La comprobación se repite al guardar, así
    que no depende de la pantalla.
  - *Cuotas anuales y semestrales,* además de quincenales, mensuales,
    bimestrales y trimestrales. Una campaña de 24 meses se cobra en 2
    anualidades y una de 36 en 3.
  - *Los vencimientos ya no se desplazan.* Las cuotas avanzaban 30 días fijos en
    vez de un mes real, así que doce mensualidades desde el 1 de septiembre caían
    el 1, el 1, el 31, el 30… acumulando casi una semana de desfase y dando al
    cliente fechas que no coincidían con lo pactado. Ahora respetan el día del
    mes y ajustan los meses cortos: del 31 de enero pasan al 28 de febrero y al
    31 de marzo.
  - *Alcance de esta versión:* cuotas iguales, plan decidido al facturar, sin
    complemento de pago (REP) y con aviso —no bloqueo— si una parcialidad vence.
    Un calendario libre (30 % al firmar, 70 % al cierre) o el timbrado del REP se
    pueden añadir después sin rehacer el modelo. Ver
    `docs/diseno-cobro-en-parcialidades.md`.
  - *El cobro de siempre no cambia:* una factura sin plan de cuotas se comporta
    igual que antes, y las cobranzas anteriores siguen intactas.
- **La captura de la renta avisa cuando algo no cuadra.** Se detectaron dos
  propuestas reales con la renta mal capturada: llevaban el precio del cliente
  con IVA en vez de lo que se le paga al propietario —un importe **mayor** que lo
  cobrado—, y además sin propietario asignado, lo que dejaba el contrato
  pendiente sin que nadie se enterara. Ahora, si la organización tiene un solo
  propietario viene ya seleccionado, y salta un aviso en ámbar si la renta iguala
  o supera lo que se le cobra al cliente (la campaña saldría a pérdida) o si
  falta algún dato, diciendo qué falta y qué consecuencia tiene.
- **La renta al propietario se captura al crear la propuesta.** Cierra el hueco
  que dejó el contrato incompleto: se indica a quién se le paga, cuánto y cada
  cuánto (mensual, anual…), y el contrato nace **completo** con la campaña en vez
  de como pendiente. El costo se conoce desde la venta, se muestra el equivalente
  mensual mientras se escribe, y se genera el calendario de pagos con **todas las
  cuotas pendientes** — nada se marca como pagado hasta que alguien lo registra.
  - *Se autocompleta y respeta lo ya pactado:* si el **inmueble** ya tiene
    contrato no se pregunta nada (la renta se pacta por predio y se reparte entre
    sus pantallas); solo se muestra el importe vigente. Y cuando sí hay que
    capturarla, los campos llegan propuestos con lo que ya se sabe de esa
    pantalla, así que la segunda vez que se vende el sistema recuerda. *Nota:* las
    pantallas actuales sin contrato no tienen ningún dato previo, así que la
    primera captura sigue siendo manual.
- **En Finanzas ya se ve cuánto cuesta la renta al mes y el detalle de cada
  contrato.** Faltaban dos cosas distintas. Primero, la vista de lo
  **comprometido**: nueva tarjeta "Renta comprometida a propietarios" con lo que
  se paga por cada pantalla, cada cuánto, hasta cuándo y —clave— su equivalente
  mensual, que es lo que permite comparar y sumar un contrato anual con uno
  mensual (60 000 al año = 5 000/mes). El total va arriba.
  - *Y segundo, había contratos sin calendario de pagos.* Los anteriores a la
    generación automática se habían quedado sin cuotas: en producción había 2
    contratos vigentes y **cero** pagos registrados, así que la pantalla salía
    vacía aunque el contrato existiera. Se generaron las cuotas de su vigencia
    (26 en producción), con los periodos ya pasados marcados como vencidos.
    Ninguna se marca como pagada: eso solo ocurre cuando alguien lo registra.
  - *Cuando no hay importe capturado se dice.* Antes la pantalla mostraba "no
    hay rentas pendientes", que se lee como que la renta está al día. Ahora
    explica que no se puede calcular lo que hay que pagar porque faltan importes,
    y que al completarlos en Arrendadores el calendario se genera solo.
- **Los pagos de renta también en Finanzas.** El calendario de lo que hay que
  pagar a los propietarios solo vivía en Arrendadores, un módulo al que Finanzas
  no tiene acceso, aunque es dinero que sale con vencimiento. Ahora aparece en
  las dos pantallas: en Finanzas como "Renta por pagar a propietarios", con lo
  vencido primero y el total pendiente a la vista. Finanzas lo ve en modo
  lectura; registrar el pago sigue siendo de Arrendadores.
- **"Olvidé mi contraseña" desactivado temporalmente.** El envío de correo no
  está configurado, así que quien lo usaba recibía "revisa tu bandeja" y no le
  llegaba nada. Se ocultó el enlace y se cerraron los endpoints. *Consecuencia a
  tener presente:* quien olvide su contraseña queda fuera hasta que un
  administrador se la reponga — delicado en organizaciones con un solo Dueño.
  Se reactiva con una variable, sin revertir código.
- **El botón para contraer el menú vuelve arriba**, en la cabecera de la barra
  lateral, alineado con la barra superior. Con el menú contraído la cabecera
  muestra solo ese botón: es la única forma de volver a expandirlo.
- **Todo lo anterior, más lo del 27 de julio, quedó desplegado en producción.**
  Con respaldo de la base tomado y verificado antes. El efecto visible: se
  abrieron **14 contratos incompletos** — 10 en la organización *demo g500* y 4
  en *eyro*. No son un error: son pantallas que se estaban vendiendo sin
  constancia de qué se le paga a su propietario, y hasta ahora contaban con costo
  cero, inflando el margen. Aparecen en Arrendadores con alerta y diciendo en qué
  campaña se vendió cada una.
  - *Pendiente, y es lo que da valor al cambio:* definir quién completa esos 14
    contratos y en qué plazo. Mientras sigan vacíos, el costo real de esas
    pantallas se desconoce.

## 2026-07-27

- **Contrato de arrendamiento incompleto al vender una pantalla.** Hasta ahora se
  podía vender y facturar una pantalla sin que constara qué se le paga a su
  propietario: el P&L la contaba con costo de renta cero y el margen de esa
  campaña salía inflado. Al aplicarlo, 10 de las 16 pantallas estaban así y 8 ya
  estaban comprometidas en campañas. Ahora, al generar la campaña desde una
  propuesta aprobada, toda pantalla sin contrato recibe uno en estado
  **"Incompleto"**, visible en Arrendadores, con su alerta de pendiente. El
  contrato nace sin arrendador, importe, periodicidad ni fecha de fin —los campos
  muestran "Por definir"— y **no cuenta como costo ni dispara alertas de
  vencimiento** hasta que se completa. La base de datos impide cerrarlo a medias:
  para sacarlo de "Incompleto" hay que capturar los cuatro datos. Se hizo carga
  inicial retroactiva, así que hoy no queda ninguna pantalla sin registro.
  Decisiones y alternativas descartadas en
  `docs/adr/0001-contrato-incompleto-al-generar-campana.md`.
  - *Candado del Dueño al completarlo:* rellenar un contrato incompleto fija por
    primera vez cuánto se le paga al propietario, así que pide la contraseña del
    control de cambios **incluso al Dueño** —igual que cambiar datos bancarios
    del arrendador—, para que una sesión abierta y desatendida no pueda
    comprometer una renta. Si el control de cambios está apagado, no cambia nada.
    Completar a medias no lo saca de "Incompleto": mientras falte cualquiera de
    los cuatro datos, sigue pendiente y no genera calendario de pagos. La
    bitácora distingue "Completó contrato de arrendamiento" de "Editó contrato".
  - *La vigencia cubre lo vendido:* el contrato nace abarcando el periodo de la
    campaña (de la fecha de inicio a la de fin), no solo la de arranque, y si una
    venta posterior va más allá se estira. Los pendientes ya existentes se
    ajustaron a su reserva más lejana. Un contrato **real** nunca se extiende
    solo: eso sería inventar lo pactado con el propietario.
  - *Nueva alerta «El contrato no cubre la campaña»:* avisa en rojo cuando lo
    vendido a un cliente termina después de que vence el contrato de esa
    pantalla. Es el caso grave: estamos comprometiendo un espacio sobre el que
    perderemos derechos a media campaña. Hay que renovar antes o recortar. Hoy no
    hay ninguna reserva en esa situación (se revisaron las 18 activas).
  - *Renovar y cancelar un pendiente:* renovar un contrato incompleto ahora
    explica qué falta capturar en vez de fallar con un error técnico —no se puede
    renovar lo que nunca se pactó—, y el botón ya no aparece en esos contratos.
    Cancelarlo sí se puede: es la forma de descartar un pendiente que no aplica.
  - *Pendiente:* definir quién completa estos contratos y en qué plazo. Sin un
    responsable, el pendiente se vuelve ruido.
- **Campañas: las más recientes hasta arriba.** El listado de Campañas mostraba
  las más antiguas primero y el menú lateral del detalle las ordenaba
  alfabéticamente, así que las campañas nuevas quedaban enterradas al final. Los
  dos usan ya el mismo orden, por fecha de creación descendente.
- **No aparecía cómo subir una campaña a DOOHmain.** En el detalle de una campaña
  digital que todavía no se había enviado al dominio, la sección "Validación de
  publicación" se marcaba como **"No aplica"**. Eso la dejaba plegada y al final
  de la página, escondiendo justo el botón "Enviar al dominio" que hay que pulsar
  para que el arte llegue a DOOHmain — así que parecía que la opción no existía,
  aunque los creativos ya estuvieran aprobados. Ahora la validación aplica a toda
  campaña digital: no haberla enviado es el estado **Pendiente**, no un "no
  aplica", y la sección aparece abierta y arriba. Las campañas fijas (OOH) siguen
  en "No aplica", como debe ser.
  - De paso, el panel aclara que **aprobar los creativos no los sube a DOOHmain**:
    el arte se publica al aprobar la publicación de la campaña, que es el paso
    siguiente. La confusión era razonable porque no se decía en ningún lado.
- **Creativos: búsqueda, filtros y orden por campaña más reciente.** La pantalla
  listaba todas las campañas sin forma de acotarlas y con las más antiguas
  primero. Ahora tiene un buscador por nombre de campaña, folio, cliente o
  **nombre del archivo del creativo**, y un filtro por estado: con pendientes de
  aprobar, con aprobados, con rechazados, o **sin creativos todavía** —este
  último es el pendiente real: campañas con espacios reservados a las que aún no
  se les ha subido nada—. Arriba a la derecha se ve cuántas campañas quedan de
  cuántas. El orden es el mismo que en Campañas: la más reciente primero.
- **Clases de estilo que nunca llegaban al navegador (causa de varias
  desalineaciones).** La configuración de Tailwind seguía apuntando a la carpeta
  `app/demo/`, que dejó de existir cuando se quitó el segmento `/demo` de las
  URLs. Consecuencia: ninguna clase usada *solo* dentro de `app/` se generaba, y
  las pantallas se veían mal sin que nada fallara en consola. El caso visible era
  el **detalle de campaña**, donde el listado lateral de campañas aparecía
  apilado encima del contenido en vez de a su lado. Corregidos los globs a
  `app/**`, `components/**` y `lib/**`; el CSS creció ~18% (esas utilidades que
  faltaban). *Ojo: al activarse de golpe, otras pantallas pueden cambiar de
  aspecto — conviene un repaso visual.*
- **Pipeline de campaña vacío al abrir una campaña digital.** En el detalle de
  una campaña DOOH el pipeline se veía sin ninguna etapa marcada (todos los pasos
  en gris, sin palomitas ni etapa actual), aunque la campaña estuviera avanzada.
  Ocurría cuando la campaña tenía una orden de trabajo de montaje digital
  completada: el sistema la situaba en "Instalada", que es una etapa **física** y
  por tanto no forma parte del pipeline de una campaña digital, y el resultado era
  un índice inválido. Afectaba a "Coca-Cola — Verano". Ahora la etapa derivada
  siempre pertenece al pipeline del tipo de campaña, con pruebas automáticas que
  lo garantizan para digital, fija e híbrida. *Pendiente de decisión de negocio:*
  si una campaña digital debe tener etapa propia de puesta al aire, hoy su avance
  se expresa con "Publicada".
- **Menú lateral izquierdo: colapsable y siempre a la vista.** El menú se puede
  contraer a modo icono con un botón al pie de la propia barra; la preferencia se
  recuerda entre sesiones. Se compactaron las filas para que los 18 módulos
  quepan sin desplazar el menú, y el botón junto con "Derechos reservados" quedan
  fijos abajo. El contenido de la derecha es lo único que hace scroll. En móvil se
  mantiene el menú deslizable de siempre.
  - *Nombres al pasar el ratón (menú colapsado):* con el menú contraído, apuntar
    a un icono muestra el nombre del módulo en un globo blanco a su derecha. El
    botón de contraer/expandir perdió su rótulo: queda solo el icono, y su
    nombre aparece en el mismo globo. Los nombres siguen presentes para lectores
    de pantalla aunque no se vean.
- **Ubicación de las pantallas en la liga de propuesta compartida.** La liga que
  se manda al cliente ahora muestra, por cada pantalla, su dirección completa, la
  zona (alcaldía/ciudad/estado) y un enlace para abrirla en Google Maps. Antes
  solo estaba el mapa, que depende de un servicio externo: si no cargaba, el
  cliente se quedaba sin saber dónde estaba la pantalla. La tarjeta del mapa ya no
  desaparece en silencio cuando faltan coordenadas: lo dice y remite a la lista.
- **Mapas más robustos.** Una pantalla con coordenadas inválidas o sin capturar
  tumbaba el mapa completo (desaparecía la sección entera, no solo ese punto).
  Ahora esos puntos se descartan y el resto del mapa se dibuja igual. *Pendiente:*
  queda un reporte de que el mapa no aparece en la liga pública que no se pudo
  reproducir — los datos, el servicio de mapas y la liga se verificaron correctos.
- **Reset de estilos incompleto.** Faltaba la regla que hace que imágenes, video,
  canvas e iframes se comporten como bloque; es la que necesita el mapa para
  dimensionarse bien. Se añadió, dejando fuera los iconos a propósito para no
  mover su alineación en toda la aplicación.

## 2026-07-24

- **Cierre de los 5 riesgos ALTO de la auditoría de código.**
  - *Duplicados por doble clic (dinero):* índices únicos en `facturas.campana_id`
    y `campanas.propuesta_id` + bloqueo `FOR UPDATE` del sitio al reservar → ya no
    se pueden crear dos facturas de una campaña, dos campañas de una propuesta, ni
    sobre-reservar una pantalla por peticiones simultáneas.
  - *Candado de facturación digital más honesto:* un proof-of-play **vacío** (sin
    reproducciones) ya no cuenta como evidencia; en campañas **híbridas**, cerrar
    una OT de la parte fija ya no da por publicada la parte digital.
  - *Moneda correcta:* las campañas y facturas ya salen en la moneda de la
    organización (MXN) en vez de un fijo en soles; se corrigieron las existentes.
  - *Datos bancarios del propietario:* cambiar la cuenta/forma de pago del
    arrendador ahora pide el desbloqueo del Dueño (candado), como los demás
    movimientos de dinero.
  - *Deploy:* el pipeline aplica todas las migraciones (no una lista fija) y se
    corrigió el `package-lock` para que `npm ci` funcione.

## 2026-07-23

- **Arrendadores: reubicación, vista por razón social y enlace Almacén↔OT.**
  Desde la ficha de la pantalla, "Reubicar" la mueve a otro predio y genera una OT
  de reubicación. En Arrendadores hay una tabla "Por razón social" que consolida
  contratos, predios, renta mensual y pagos vencidos de cada razón social. Y al
  cerrar una OT de retiro, el equipo entra solo al almacén. (De paso se corrigió
  un error que hacía que cerrar una OT devolviera "error interno" aunque sí se
  cerrara.)
- **Almacén de activos (Arrendadores ↔ Operaciones, Fase 3).** Nueva sección
  "Almacén" (Dueño y Operaciones) para el seguimiento de activos físicos
  (pantallas, estructuras, lonas): se registran, se ve su estado (en almacén /
  instalado / en traslado / baja) y se registran sus traslados con historial de
  movimientos.
- **Contratos que disparan tareas de Operaciones (Arrendadores ↔ Operaciones,
  Fase 2).** Al **cancelar un contrato** se genera automáticamente una OT de
  **retiro (desmontaje)** de su pantalla; al **dar de alta una pantalla nueva** se
  genera una OT de **montaje/instalación** (solo fijas). Nacen PENDIENTE, con nota
  de origen, y aparecen en Operaciones; si no aplican, se pueden cancelar. No
  bloquean la acción principal si algo falla.
- **Pausa legal del inventario (Arrendadores ↔ Operaciones, Fase 1).** Desde la
  ficha de una pantalla se puede "Pausar por situación legal" (con motivo): la
  pantalla sale de la disponibilidad comercial (queda bloqueada) y muestra un
  banner con el motivo; "Reanudar" la vuelve a habilitar. Genera alerta y queda en
  la bitácora. Es distinta de "Reportar incidencia" (daño físico) y requiere
  permiso de Arrendadores.
- **Arrendadores: estatus al día + alertas con 3 meses de anticipación.** El
  estatus de contratos y pagos ya no queda "congelado": se recalcula contra la
  fecha de hoy (vigente / por vencer / vencido), así el costo de renta del P&L y
  las alertas dejan de usar un valor viejo. Nuevas alertas: "Renta por vencer"
  (avisa hasta 90 días antes del próximo pago, anual o mensual) y "Contrato
  vencido"; "Contrato por vencer" pasó de 30 a 90 días de anticipación. Ver las
  reglas acordadas en `docs/Reglas_Arrendadores.md`.
- **Cámaras Space Eye = la "Inteligencia artificial" de la pantalla.** En la ficha
  de la pantalla, la sección de IA ya no muestra una imagen de demostración: se
  sincroniza con Space Eye y enseña la **cámara real** del espectacular — estado
  del dispositivo (en línea, batería, última señal), la última foto y, si existe,
  el veredicto de IA (correcto / no coincide). El enlace es automático por código
  (el `billboard_code` de Space Eye = el código de proveedor del sitio); si la
  pantalla no tiene cámara, lo indica.
- **Recuperar contraseña ("olvidé mi contraseña").** En el login hay un enlace
  para restablecer la contraseña: escribes tu correo y recibes un enlace (vence en
  1 hora, un solo uso) para elegir una nueva. Por seguridad la respuesta es
  siempre la misma (no revela si el correo existe), tiene límite de intentos y, al
  cambiarla, cierra todas las sesiones. Nota: el envío por correo requiere
  configurar el proveedor (Resend) en el servidor; mientras tanto queda listo.
- **El Dueño puede cambiar la contraseña de cualquier usuario.** En Administración
  → Usuarios, cada fila tiene un botón para fijarle una contraseña nueva a ese
  usuario (reset), y para el propio Dueño pide su contraseña actual. Queda en la
  bitácora de acciones.
- **Configuración por perfil.** La Configuración del negocio (empresa, IVA, loop,
  plazos, tareas…) sigue siendo solo del Dueño. Los demás perfiles ven solo "Mi
  cuenta", para cambiar su **correo y contraseña** (con su contraseña actual para
  confirmar).
- **Menús de notificaciones y de cuenta con fondo sólido.** Los desplegables de la
  campana y del menú de usuario ya no se ven transparentes: tienen fondo blanco y
  sombra.

## 2026-07-22

- **Ficha de pantalla: los detalles ahora son editables.** En Comercial, "Editar"
  de una pantalla ya permite cambiar los detalles técnicos (medidas, caras,
  estructura, tramo, iluminado y —en digitales— slots, duración, slots/hora,
  resolución, contenido, CMS y horario), no solo nombre/tarifa. Se guarda solo lo
  que cambió, así editar un detalle NO financiero ya no pide la contraseña del
  Dueño; tocar tarifa, costo o arrendatario sí la sigue pidiendo. La renta se
  mantiene fuera (vive en el contrato del predio).
- **Inventario: cambio masivo de tarifa sin Excel.** En la tabla de Inventario se
  pueden seleccionar varias pantallas (o todas) y, desde una barra, fijar una
  tarifa nueva o ajustar un porcentaje (+/-) que se aplica a todas de una vez, con
  confirmación previa. Ya no hace falta subir un Excel para un cambio masivo de
  precios. La edición de una sola tarifa por fila (clic en el monto) sigue igual.
- **Modales que ya no se salen de la pantalla.** Los modales se topan al 90% del
  alto de la pantalla y su cuerpo hace scroll interno, con el encabezado y el pie
  (donde va, por ejemplo, el total y "Crear propuesta") siempre visibles.
- **Propuesta: elegir sitios en lista o en mapa, y por zona.** Al armar una
  propuesta ahora hay un switch Lista / Mapa. En el mapa, tocar un punto agrega o
  quita la pantalla. Además, con "Dibujar zona" se traza un polígono sobre el
  mapa y, al cerrarlo, la selección pasa a ser exactamente las pantallas dentro de
  esa área (se descartan las demás).
- **Pantallas: "Vista" en vez de "Orientación".** En la ficha de la pantalla se
  quitó el campo "Orientación" y se dejó solo "Vista", que ahora indica el rumbo
  (Norte, Sur, Este, Oeste, Noreste…) mediante un selector.
- **Pipeline digital sin etapas físicas.** En las campañas digitales (DOOH) el
  pipeline ya no muestra "Instalada / al aire" ni "En producción": una digital
  sale al aire por "Publicada" (DOOHmain), no por producción o instalación
  física. Las fijas conservan esas etapas.
- **Indicador de carga global.** Cada vez que una acción guarda y espera
  respuesta (POST/PUT/PATCH/DELETE), se muestra una pequeña animación de carga:
  una barra delgada arriba y un spinner "Procesando…" abajo a la derecha, que
  desaparecen al terminar. Es automático para toda la app, sin tocar cada botón.
- **Creativos: botones según el estado.** Cuando un creativo ya fue aprobado, el
  botón "Aprobar" queda deshabilitado (hasta reemplazarlo o eliminarlo, que lo
  regresa a pendiente) y el botón "Rechazar" se oculta.
- **Campaña: pendientes hasta arriba + vista previa del creativo.** En la ficha,
  las secciones pendientes se ordenan hasta arriba (luego las completas y al final
  las que no aplican). Además, al subir un creativo (imagen o código) se abre un
  modal de vista previa que muestra cómo se verá en la pantalla antes de confirmar
  la subida.
- **Ficha de campaña: secciones que se minimizan solas.** Cada sección de la
  campaña ahora es plegable y arranca según su estado: las que están
  **pendientes** quedan abiertas, y las **completas** o las que **no aplican** al
  tipo de campaña (p. ej. imprenta/evidencias en una digital, o proof of play en
  una fija) arrancan minimizadas. Cada sección muestra un chip Pendiente /
  Completo / No aplica y se puede abrir o cerrar con clic.
- **Candado de facturación para campañas digitales.** En las digitales, el candado
  ya no depende de una OT: "Reporte de publicación" se enciende al aprobar la
  publicación en DOOHmain (salió al aire) y "Fotografías comprobatorias" al traer
  el proof-of-play (las reproducciones son la evidencia). Con la OC recibida, el
  candado completa y la campaña queda lista para facturar. Las fijas siguen igual
  (candado por la OT cerrada con foto).
- **Operaciones: se retira la tarea "Montaje digital".** Ya no aparece como tipo
  de OT (ni para digitales), porque el arte de las pantallas digitales se sube
  con "Subir a producción" (DOOHmain) desde la campaña. El servidor también la
  rechaza. Las digitales siguen teniendo desmontaje, mantenimiento, eléctrico,
  inspección y otro.
- **Propuesta: no se puede generar campaña dos veces.** Si una propuesta ya
  generó su campaña, el botón "Generar campaña" queda deshabilitado ("Campaña
  generada") y aparece un botón "Ver campaña" para ir a ella.

## 2026-07-21

- **Operaciones: OT según el tipo de pantalla.** Al crear una orden de trabajo,
  primero se elige la campaña y su pantalla; los tipos de tarea disponibles
  dependen del tipo de pantalla (una digital no ofrece montaje de lona ni
  herrería; una fija no ofrece montaje digital). Además se valida en el servidor
  para que no se pueda forzar una tarea que no aplica.
- **Comercial: disponibilidad por spots, sin reserva tentativa.** Al reservar en
  comercial ya no hay estado "tentativo": el spot se consume de inmediato
  (reserva confirmada). La disponibilidad de una pantalla digital se muestra por
  spots (12/12, 8/12… o "No disponible" cuando es 0/12); las fijas muestran
  Disponible / No disponible.
- **Propuesta: los spots/día solo en pantallas digitales.** En el armado de la
  propuesta, la programación de spots por día solo aparece para pantallas
  digitales; las fijas no manejan spots.
- **Errores de validación en lenguaje natural + notificación.** Todos los errores
  de validación ahora salen en español claro para el usuario (antes salían en
  inglés técnico como "Number must be greater than 0") y con el nombre del campo
  legible (p. ej. "Spots por día: Debe ser mayor que 0"). Además, el error al
  crear una propuesta se muestra como notificación (toast). También se corrigió un
  fallo por el que dejar "spots/día" vacío impedía crear la propuesta.
- **Campaña: OC precargada desde la propuesta.** Al registrar la Orden de Compra
  del cliente, el número (folio de la campaña), el monto (total contratado) y la
  fecha vienen precargados; el documento de la OC es el contrato ya adjunto, así
  que ya no se pide de nuevo. Todo editable.
- **Campaña: datos de facturación del cliente + contrato.** La ficha de la
  campaña ahora muestra los datos fiscales del cliente (razón social, RFC,
  régimen, CP fiscal, uso CFDI, IVA) tomados del cliente elegido en la propuesta,
  e indica si están completos para facturar. Se puede adjuntar el contrato
  firmado del cliente (PDF) al expediente de facturación.
- **DOOHmain: se envía la programación (spots/día).** Al publicar en DOOHmain, la
  programación de spots por día de cada pantalla se manda como cuota diaria
  (`cant_day`), junto con las fechas contratadas. Se toma de la reserva de la
  campaña.
- **Propuesta: duración que completa la fecha "Hasta".** Al crear la propuesta se
  indica cuánto dura la campaña (número + unidad: meses, catorcenas, semanas o
  días) y, con la fecha "Desde", se calcula automáticamente la fecha "Hasta". La
  duración usa la misma equivalencia que el precio, así "1 mes" cubre exactamente
  un periodo mensual.
- **Propuestas/campañas por tiempo.** Al crear una propuesta, cada sitio se
  contrata eligiendo su unidad (mensual, semanal, catorcenal, diaria, por spot o
  por hora) tomada de sus tarifas publicadas; el precio se calcula solo (tarifa ×
  periodos del rango) y se puede indicar la programación de spots por día. Esta
  contratación por tiempo se conserva al generar la campaña (las reservas heredan
  unidad, cantidad y spots/día).
- **DOOHmain: fechas de la campaña siempre al día.** Al publicar en DOOHmain se
  envían las fechas de inicio y fin de la campaña contratada. Antes solo se
  fijaban al crear la campaña; ahora, si se vuelve a publicar o si se extendió el
  periodo, DOOHmain recibe las fechas vigentes.
- **Campaña: subir creativos desde la ficha.** En la ficha de una campaña ahora
  se pueden agregar creativos (subir imagen o pegar código HTML) sin tener que
  ir a la pantalla de Creativos. La tarjeta de Creatividades siempre está
  visible, con un enlace para gestionar en detalle.
- **Dashboard: configurar qué alertas se muestran.** Nuevo menú en la tarjeta de
  Alertas para elegir qué tipos de alerta ver en pantalla (rentas vencidas,
  contratos por vencer, cobranza, sitios bloqueados y órdenes de trabajo). Por
  default se muestran todas; la preferencia se recuerda en el navegador.
- **Barra superior: fondo blanco en notificaciones y cuenta.** Los botones de
  notificaciones y de ajustes/cuenta ahora tienen fondo blanco; antes se
  confundían con la barra y se perdía la lectura.
- **Menú lateral: marca "AS SPACE OS".** El texto bajo el nombre en el menú
  lateral ahora dice "AS SPACE OS" en lugar de "by AS Network".
- **Menú lateral: "Derechos reservados".** El pie del menú lateral ahora dice
  "Derechos reservados" en lugar de "Demo · datos ficticios · $ MXN".

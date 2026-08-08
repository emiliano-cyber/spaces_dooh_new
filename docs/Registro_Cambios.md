# Registro de cambios — SPACE OS

Bitácora de cambios realizados en el sistema, con un resumen breve de cada uno.
La entrada más reciente va arriba.

---

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

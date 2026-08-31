# Registro de cambios — SPACE OS

Bitácora de cambios realizados en el sistema, con un resumen breve de cada uno.
La entrada más reciente va arriba.

---

## 2026-08-31

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
  `pruebas.space-os.io`.** Existe una segunda copia de la aplicación, separada de
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

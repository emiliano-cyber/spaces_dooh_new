# Registro de cambios — SPACE OS

Bitácora de cambios realizados en el sistema, con un resumen breve de cada uno.
La entrada más reciente va arriba.

---

## 2026-07-28

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

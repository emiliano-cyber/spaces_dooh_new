# Registro de cambios — SPACE OS

Bitácora de cambios realizados en el sistema, con un resumen breve de cada uno.
La entrada más reciente va arriba.

---

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

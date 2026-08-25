---
tipo: manual
estado: superado
actualizado: 2026-08-11
tags: [manual, usuario-final, negocio, historico]
archivos:
  - vault/00-Inventario/inventario-2026-08-11.md
---

# Manual de usuario — Space OS

> [!warning] Superado por [[manual-usuario-2026-08-25]]
> Este borrador se escribió desde el inventario, sin leer la interfaz: describe
> la acción pero no nombra los controles, y deja 20 preguntas abiertas. El
> vigente es [[manual-usuario-2026-08-25]], que además cubre Dashboard,
> Administración, Configuración, Integraciones, Actividad, Network, Almacén y
> las pantallas públicas. Se conserva como historia.

Space OS lleva el negocio de publicidad exterior de punta a punta: las pantallas que
rentas, los arrendadores que te las alquilan, los clientes que te compran, las campañas
que sales a montar y el dinero que cobras.

Este manual se organiza por lo que quieres lograr, no por pantallas. Busca tu tarea en el
índice y sigue los pasos.

## Antes de empezar

### Cómo entras

Abres la dirección de la aplicación en tu navegador: `https://demo.space-os.io/spaces-dooh/`.

La pantalla de acceso ofrece tres caminos: entrar con tu correo y contraseña, entrar con
tu cuenta de Google, o dar de alta una organización nueva.

> [!note] Captura: la pantalla de acceso con las tres opciones visibles.

**Pasos para entrar con correo y contraseña**

1. Abre la dirección de la aplicación.
2. Escribe tu correo.
3. Escribe tu contraseña.
4. Confirma el acceso.

**Qué debes ver cuando salió bien.** Entras al tablero de inicio y aparece el menú lateral
con los grupos «Inventario», «Vender», «Entregar», «Finanzas» y «Sistema».

Tu sesión dura 30 días. Después de ese plazo el sistema te vuelve a pedir la contraseña.

> [!warning]
> Si tu cuenta está marcada para cambiar contraseña, el sistema no te deja hacer nada más
> hasta que la cambies. Es normal la primera vez que entras con una cuenta que alguien
> creó por ti.

### Crear tu organización

Cualquier persona con la dirección puede dar de alta una organización nueva desde la
pantalla de acceso.

1. Abre la dirección de la aplicación.
2. Elige la opción de dar de alta una organización.
3. Escribe el nombre de la organización.
4. Escribe tu nombre, tu correo y una contraseña.
5. Confirma el alta.

**Qué debes ver cuando salió bien.** Entras directo a la aplicación con la organización
recién creada y tu cuenta queda como Dueño.

> [!warning]
> Quien crea la organización queda como Dueño y es la única cuenta que puede dar de alta
> al resto del equipo. Que la cree la persona correcta.

> [!info]
> El sistema permite un máximo de cinco altas de organización por hora desde la misma
> conexión a internet. Si intentas más, te pide esperar.

### Qué puedes ver según tu tipo de cuenta

Cada cuenta tiene un tipo, y el tipo decide qué módulos ves en el menú.

| Tipo de cuenta | Qué ve en el menú |
|---|---|
| Dueño | Todo |
| Comercial | Network, Clientes, Comercial, Disponibilidad, Propuestas, Campañas, Creativos, Comisiones |
| Operaciones | Operaciones, Almacén |
| Imprenta | Imprenta |
| Finanzas | Finanzas |

Ver un módulo no es lo mismo que poder hacer todo dentro de él. Cada acción concreta
depende además de los permisos que tenga tu cuenta. Si una opción no te aparece o te
rechaza, pídesela a quien administra la cuenta.

### Cuando el sistema te pide desbloquear

Las operaciones que mueven dinero o tocan contratos no se ejecutan de corrido: el sistema
te pide desbloquear los cambios antes de guardarlos.

Esto aplica a facturar, registrar un pago, modificar o borrar un arrendador, crear o
modificar un contrato, cancelarlo, renovarlo, pagar una renta y modificar o borrar una
pantalla del inventario.

**Qué debes ver cuando salió bien.** Se abre una ventana de desbloqueo, la confirmas y la
operación continúa sola. No tienes que repetir la captura.

> [!warning]
> El desbloqueo exige una contraseña, aunque entres a la aplicación con Google. Si no la
> tienes, no vas a poder facturar ni registrar pagos: pídela a quien administra la cuenta
> antes de necesitarla.

> [!info]
> Solo puedes intentar el desbloqueo cinco veces cada cinco minutos. Si te pasas, espera.

## Registrar lo que rentas

### Dar de alta una pantalla

Disponible si tu cuenta es Dueño.

**Empiezas en:** el menú lateral.

1. Abre «Inventario».
2. Crea una pantalla nueva.
3. Captura sus datos: clave interna, código de proveedor, caras, spots totales y máximo de
   clientes simultáneos.
4. Elige el arrendador al que le rentas el espacio.
5. Guarda.

**Qué debes ver cuando salió bien.** La pantalla aparece en la lista del inventario y el
sistema abre solo un contrato de renta asociado a ella.

> [!warning]
> El arrendador es obligatorio. Sin arrendador no puedes dar de alta la pantalla, así que
> dalo de alta antes (ver «Dar de alta un arrendador»).

> [!warning]
> La clave interna y el código de proveedor no se pueden repetir en toda la instalación,
> ni siquiera entre organizaciones distintas. Si el sistema rechaza el código, elige otro.

> [!warning]
> El contrato que nace con la pantalla queda incompleto, y mientras esté incompleto nadie
> puede reservar esa pantalla para una campaña. Complétalo el mismo día.

Si la pantalla es fija, el sistema genera además una orden de trabajo de montaje.

> [!note] Captura: la lista de inventario con una pantalla recién dada de alta.

### Cargar muchas pantallas de una vez

Disponible si tu cuenta es Dueño.

**Empiezas en:** el menú lateral.

1. Abre «Inventario».
2. Elige la carga masiva.
3. Sube tu archivo de Excel con las pantallas.
4. Confirma la carga.

**Qué debes ver cuando salió bien.** Las pantallas del archivo aparecen listadas en el
inventario, cada una con su contrato abierto.

### Corregir o dar de baja una pantalla

Disponible si tu cuenta es Dueño.

**Empiezas en:** el menú lateral.

1. Abre «Inventario».
2. Entra a la pantalla que quieres corregir.
3. Cambia los datos, o elige darla de baja.
4. Guarda y confirma el desbloqueo cuando el sistema te lo pida.

**Qué debes ver cuando salió bien.** La lista refleja el cambio y la modificación queda
registrada en la bitácora de actividad con tu nombre.

### Reportar una avería, reubicar o pausar una pantalla

**Empiezas en:** el menú lateral.

1. Abre «Inventario».
2. Entra a la pantalla afectada.
3. Registra la incidencia, la reubicación o la pausa por motivo legal, según el caso.
4. Guarda.

**Qué debes ver cuando salió bien.** La pantalla muestra su nuevo estado y deja de
ofrecerse como disponible mientras dure la pausa.

## Arrendadores y contratos de renta

### Dar de alta un arrendador

Disponible si tu cuenta es Dueño.

**Empiezas en:** el menú lateral.

1. Abre «Arrendadores».
2. Crea un arrendador nuevo.
3. Captura su nombre, su RFC y su domicilio.
4. Captura sus razones sociales si factura con más de una.
5. Guarda.

**Qué debes ver cuando salió bien.** El arrendador aparece en la lista y ya puedes
seleccionarlo al dar de alta pantallas.

> [!warning]
> El domicilio es obligatorio para poder generar el contrato. Si lo dejas vacío, el
> contrato no se puede emitir después.

> [!warning]
> El RFC no se puede repetir dentro de tu organización. Si el sistema lo rechaza, busca al
> arrendador que ya existe en vez de crear uno nuevo.

Un arrendador con predios o contratos no se puede borrar. Primero hay que cerrar lo que
cuelga de él.

### Completar el contrato de renta

Disponible si tu cuenta es Dueño.

**Empiezas en:** el menú lateral.

1. Abre «Arrendadores».
2. Entra al arrendador y localiza el contrato de la pantalla.
3. Captura el monto de la renta y la periodicidad del pago.
4. Elige la razón social con la que se firma.
5. Guarda y confirma el desbloqueo cuando el sistema te lo pida.

**Qué debes ver cuando salió bien.** El contrato deja de estar marcado como incompleto, la
pantalla queda liberada para reservarse y el sistema arma el calendario de pagos de renta.

> [!info]
> Los vencimientos del calendario se cuentan desde la fecha de inicio del contrato, no
> desde la fecha en que lo capturaste.

### Mandar el contrato a firma del arrendador

Disponible si tu cuenta es Dueño.

**Empiezas en:** el menú lateral.

1. Abre «Arrendadores».
2. Entra al contrato.
3. Genera el documento del contrato.
4. Solicita la firma.
5. Hazle llegar al arrendador la liga de firma que genera el sistema.

**Qué debes ver cuando salió bien.** El contrato queda con su documento sellado y, cuando
el arrendador firma desde la liga, el contrato muestra la firma registrada.

> [!warning]
> Al mandarlo a firma, el texto del contrato queda sellado. Si necesitas cambiar una
> cláusula o un monto después, ya no puedes tocar ese documento.

### Registrar el pago de la renta

Disponible si tu cuenta es Dueño.

**Empiezas en:** el menú lateral.

1. Abre «Arrendadores».
2. Entra al calendario de pagos del contrato.
3. Elige el pago que vas a liquidar.
4. Adjunta el comprobante.
5. Marca el pago y confirma el desbloqueo cuando el sistema te lo pida.

**Qué debes ver cuando salió bien.** El pago aparece como liquidado y el comprobante queda
consultable desde el mismo contrato.

### Cancelar o renovar un contrato

Disponible si tu cuenta es Dueño.

**Empiezas en:** el menú lateral.

1. Abre «Arrendadores».
2. Entra al contrato.
3. Elige cancelar o renovar.
4. Confirma el desbloqueo cuando el sistema te lo pida.

**Qué debes ver cuando salió bien.** El contrato cambia de estado. Si lo cancelaste, el
sistema genera solo una orden de trabajo de retiro para que la cuadrilla desmonte.

> [!warning]
> Cancelar un contrato dispara el retiro en campo. No lo uses para corregir un dato mal
> capturado.

## Vender

### Registrar un cliente o una agencia

Disponible si tu cuenta es Dueño o Comercial.

**Empiezas en:** el menú lateral.

1. Abre «Clientes».
2. Crea un cliente nuevo.
3. Captura sus datos fiscales y el porcentaje de IVA que le aplica.
4. Si el cliente compra a través de una agencia, indícala.
5. Guarda.

**Qué debes ver cuando salió bien.** El cliente aparece en la lista y puedes elegirlo al
crear una propuesta.

### Buscar pantallas para un cliente

Disponible si tu cuenta es Dueño o Comercial.

**Empiezas en:** el menú lateral.

1. Abre «Comercial».
2. Filtra el inventario por lo que busca tu cliente.
3. Ubica las pantallas en el mapa.
4. Abre «Disponibilidad» para ver el calendario de ocupación de las que te interesan.

**Qué debes ver cuando salió bien.** El calendario muestra qué fechas están libres y
cuáles ya están comprometidas por otra campaña.

> [!info]
> Una pantalla admite varios clientes a la vez hasta el límite que tenga configurado. Si
> ya llegó a su límite, deja de ofrecerse aunque el calendario parezca libre.

> [!note] Captura: el buscador comercial con el mapa y un filtro aplicado.

### Armar una propuesta

Disponible si tu cuenta es Dueño o Comercial.

**Empiezas en:** el menú lateral.

1. Abre «Propuestas».
2. Crea una propuesta nueva.
3. Elige el cliente.
4. Agrega las pantallas, con sus fechas y sus spots por día.
5. Captura el descuento y la comisión, si aplican.
6. Guarda.

**Qué debes ver cuando salió bien.** La propuesta recibe un folio consecutivo y muestra el
total calculado.

> [!warning]
> Si el cliente pertenece a una agencia cuya negociación todavía no está validada, el
> sistema no te deja crear la propuesta. Pide que validen la negociación de esa agencia
> antes de cotizar.

### Compartir la propuesta y que el cliente la acepte

Disponible si tu cuenta es Dueño o Comercial.

**Empiezas en:** el menú lateral.

1. Abre «Propuestas».
2. Entra a la propuesta.
3. Copia la liga pública.
4. Hazle llegar la liga al cliente.

**Qué debes ver cuando salió bien.** El cliente abre la liga sin necesidad de usuario ni
contraseña, revisa la propuesta y la acepta. En tu pantalla la propuesta queda marcada
como aceptada, con la fecha y con quién la aceptó.

> [!warning]
> Cualquiera con esa liga ve la propuesta. Compártela solo con el cliente.

### Convertir la propuesta aceptada en campaña

Disponible si tu cuenta es Dueño o Comercial.

**Empiezas en:** el menú lateral.

1. Abre «Propuestas».
2. Entra a la propuesta aceptada.
3. Genera la campaña.

**Qué debes ver cuando salió bien.** Se crea una campaña con folio propio y las pantallas
de la propuesta quedan reservadas para esas fechas.

> [!warning]
> Todas las pantallas de la propuesta necesitan su contrato de renta completo. Si alguna
> lo tiene incompleto, el sistema no genera la campaña: completa ese contrato y vuelve a
> intentar.

Si le das dos veces, no se duplica: el sistema reconoce que esa propuesta ya generó su
campaña.

## Entregar la campaña

### Cargar los creativos

Disponible si tu cuenta es Dueño o Comercial.

**Empiezas en:** el menú lateral.

1. Abre «Creativos».
2. Crea una pieza nueva y ligala a la campaña.
3. Sube la imagen, o captura el creativo en formato HTML.
4. Guarda.

**Qué debes ver cuando salió bien.** La pieza aparece listada como pendiente de validar.

### Validar y repartir los creativos por pantalla

Disponible si tu cuenta es Dueño o Comercial.

**Empiezas en:** el menú lateral.

1. Abre «Campañas».
2. Entra a la campaña.
3. Valida los creativos.
4. Reparte qué creativo va en cada pantalla reservada.

**Qué debes ver cuando salió bien.** Cada pantalla de la campaña muestra el creativo que
le toca y la campaña queda lista para publicarse.

### Publicar la campaña en las pantallas

Disponible si tu cuenta es Dueño o Comercial.

**Empiezas en:** el menú lateral.

1. Abre «Campañas».
2. Entra a la campaña ya validada y repartida.
3. Envía la campaña a las pantallas.

**Qué debes ver cuando salió bien.** La campaña queda marcada como enviada y los reportes
de reproducción empiezan a llegar a la propia campaña.

> [!warning]
> El envío sale a pantallas reales. Revisa fechas y creativos antes de confirmar.

### Pedir la impresión

Disponible si tu cuenta es Dueño o Imprenta.

**Empiezas en:** el menú lateral.

1. Abre «Imprenta».
2. Crea la orden de impresión para la campaña.
3. Sube la prueba de color.
4. Registra la aprobación de la prueba de color cuando el cliente la autorice.

**Qué debes ver cuando salió bien.** La orden recibe su folio y queda marcada con la
prueba de color aprobada.

### Levantar una orden de trabajo

Disponible si tu cuenta es Dueño u Operaciones.

**Empiezas en:** el menú lateral.

1. Abre «Operaciones».
2. Crea una orden de trabajo.
3. Indica el tipo de trabajo, la pantalla y la campaña, si aplica.
4. Asigna a la cuadrilla que va a ejecutarla.
5. Guarda.

**Qué debes ver cuando salió bien.** La orden aparece en la lista con su folio y con la
cuadrilla asignada.

> [!warning]
> La asignación solo se escribe al crear la orden. Después no se puede reasignar a otra
> cuadrilla.

El sistema también levanta órdenes solo: retiro cuando cancelas un contrato, montaje
cuando das de alta una pantalla fija.

### Cerrar una orden de trabajo desde el campo

Disponible si tu cuenta es Dueño u Operaciones.

**Empiezas en:** el teléfono, con la liga de la orden que te compartieron.

1. Abre la liga de la orden en el teléfono.
2. Revisa el trabajo a realizar.
3. Toma las fotos de evidencia.
4. Súbelas.
5. Cierra la orden.

**Qué debes ver cuando salió bien.** La orden queda completada y las fotos quedan
guardadas con su ubicación y con la fecha real en que se tomaron.

Si la orden estaba ligada a una campaña, cerrarla enciende las fotos de comprobación y el
reporte de publicación de esa campaña. Ese paso es el que destraba la facturación.

> [!warning]
> El sistema solo acepta archivos de imagen reales. Un archivo renombrado se rechaza.

> [!note] Captura: la vista de la orden de trabajo en el teléfono, con las fotos cargadas.

### Mover activos en el almacén

Disponible si tu cuenta es Dueño u Operaciones.

**Empiezas en:** el menú lateral.

1. Abre «Almacén».
2. Localiza el activo.
3. Registra el movimiento o traslado.
4. Guarda.

**Qué debes ver cuando salió bien.** El activo muestra su nueva ubicación y el movimiento
queda en su historial.

### Compartir el avance con el cliente

Disponible si tu cuenta es Dueño o Comercial.

**Empiezas en:** el menú lateral.

1. Abre «Campañas».
2. Entra a la campaña.
3. Copia la liga del portal del cliente.
4. Hazle llegar la liga al cliente.

**Qué debes ver cuando salió bien.** El cliente abre el portal sin usuario ni contraseña y
ve el avance de su campaña.

## Cobrar

### Facturar una campaña

Disponible si tu cuenta es Dueño o Finanzas.

**Empiezas en:** el menú lateral.

1. Abre «Finanzas».
2. Localiza la campaña a facturar.
3. Emite la factura.
4. Confirma el desbloqueo cuando el sistema te lo pida.

**Qué debes ver cuando salió bien.** La factura recibe folio consecutivo, guarda los datos
fiscales del cliente tal como estaban ese día, y el sistema abre solo el seguimiento de
cobranza con su fecha de vencimiento.

> [!warning]
> La campaña no se puede facturar hasta que tenga las tres cosas: la orden de compra del
> cliente, las fotos de comprobación y el reporte de publicación. Las dos últimas las
> enciende la cuadrilla al cerrar la orden de trabajo con fotos.

> [!warning]
> Una campaña no se puede facturar dos veces. Si el sistema te dice que ya existe la
> factura, búscala en la lista en vez de volver a emitirla.

> [!note] Captura: una campaña facturada con su folio y su cobranza abierta.

### Registrar el pago del cliente

Disponible si tu cuenta es Dueño o Finanzas.

**Empiezas en:** el menú lateral.

1. Abre «Finanzas».
2. Entra a la cobranza.
3. Registra el pago.
4. Confirma el desbloqueo cuando el sistema te lo pida.

**Qué debes ver cuando salió bien.** El saldo de la cobranza baja por el importe registrado
y, si quedó en cero, la cobranza se cierra.

> [!info]
> Puedes cobrar en parcialidades. Las cuotas tienen que sumar exactamente el total, y
> ningún abono puede exceder el saldo pendiente.

### Recordarle al cliente que pague

Disponible si tu cuenta es Dueño o Finanzas.

**Empiezas en:** el menú lateral.

1. Abre «Finanzas».
2. Entra a la cobranza vencida.
3. Envía el recordatorio.

**Qué debes ver cuando salió bien.** La cobranza registra el recordatorio y aumenta su
contador de recordatorios enviados.

> [!warning]
> Hoy el sistema no envía correo. El recordatorio queda registrado, pero el cliente no
> recibe nada: comunícate con él por tu medio habitual.

### Consultar comisiones

Disponible si tu cuenta es Dueño o Comercial.

**Empiezas en:** el menú lateral.

1. Abre «Comisiones».
2. Consulta el cálculo.

**Qué debes ver cuando salió bien.** El listado muestra las comisiones calculadas a partir
de lo vendido. No se capturan a mano: el sistema las deriva.

## Avisos del sistema

El sistema te avisa de vencimientos y pendientes dentro de la propia aplicación. Los avisos
se agrupan por día, así que no vas a recibir el mismo aviso repetido.

1. Abre la lista de avisos.
2. Márcalos como leídos uno por uno, o archiva todos de una vez.

**Qué debes ver cuando salió bien.** Los avisos archivados desaparecen de la lista activa.

## Cuando algo falla

**«Te pide desbloquear los cambios».** Es normal en todo lo que toca dinero o contratos.
Confirma el desbloqueo con tu contraseña y la operación sigue sola. Si no tienes
contraseña porque entras con Google, pídesela a quien administra la cuenta.

**No puedes reservar una pantalla ni generar la campaña.** Casi siempre es un contrato de
renta incompleto. Abre «Arrendadores», completa monto y periodicidad de esa pantalla, y
vuelve a intentar.

**No te deja cotizar a un cliente de agencia.** La negociación de esa agencia no está
validada. Avisa a quien lleva la relación con la agencia.

**No te deja facturar.** A la campaña le falta la orden de compra del cliente, las fotos de
comprobación o el reporte de publicación. Las dos últimas las genera la cuadrilla al cerrar
la orden de trabajo con fotos: pídeles que la cierren.

**Te dice que la factura ya existe.** Alguien ya facturó esa campaña. Búscala en «Finanzas»
en lugar de emitir otra.

**Te pide esperar antes de reintentar.** El sistema limita cuántas veces seguidas se puede
intentar entrar, desbloquear o dar de alta una organización. Espera unos minutos y repite.

**Olvidaste tu contraseña.** La recuperación por correo está apagada hoy. Pide a quien
administra la cuenta que te la restablezca.

**Un módulo no te aparece en el menú.** Tu tipo de cuenta no lo incluye. Si lo necesitas
para tu trabajo, pídelo a quien administra la cuenta.

**El sistema te saca y te pide entrar de nuevo.** Tu sesión caducó, o alguien restableció
tu contraseña, lo que cierra todas tus sesiones abiertas. Vuelve a entrar.

## Relacionadas

[[inventario-2026-08-11]] · [[MOC-Proyecto]]

## PENDIENTES

1. ¿Cómo se llaman exactamente los botones y los campos de cada pantalla? El inventario
   solo registra los rótulos del menú, así que los pasos de este manual describen la acción
   pero no nombran el control. Hacen falta al menos los de Inventario, Arrendadores,
   Propuestas, Campañas, Imprenta, Operaciones y Finanzas.
2. ¿Cómo aparecen escritos los tipos de cuenta en la interfaz? Aquí se escribieron Dueño,
   Comercial, Operaciones, Imprenta y Finanzas.
3. ¿Qué pide exactamente la ventana de desbloqueo de cambios, y cuánto tiempo dura el
   desbloqueo antes de que el sistema lo vuelva a pedir?
4. ¿Cómo obtiene su contraseña quien dio de alta la organización entrando con Google, si la
   necesita para desbloquear las operaciones de dinero?
5. ¿Por dónde llega la persona a la configuración del negocio (IVA, plazos de cobranza,
   logotipo, remitente de correo)? No está en el menú lateral.
6. ¿Cuánto dura una reserva tentativa antes de caducar, y qué ve la persona cuando caduca?
7. ¿Qué mensaje exacto ve la persona cuando el sistema le impide reservar por contrato
   incompleto, cuando rechaza una segunda factura y cuando bloquea la cotización por
   agencia sin validar? Sin el texto literal, el capítulo de fallas no puede citarlo.
8. ¿Cómo se le hace llegar al arrendador la liga de firma, y al cliente la liga de propuesta
   y la del portal, si hoy el sistema no envía correo?
9. ¿Sigue apagado el envío de correo en producción? Afecta recuperación de contraseña,
   recordatorios de cobranza y avisos al cliente.
10. ¿Está en uso real el módulo «Almacén» o es funcionalidad adelantada? El inventario lo
    marca como fase posterior.
11. ¿Qué comisión muestra «Comisiones»: la de la agencia o la del vendedor?
12. ¿Qué es la pantalla de consulta de propuesta por código, quién la usa y sigue vigente?
13. ¿En qué moneda se muestran los importes? El inventario reporta valores por omisión de
    otro país en campañas, facturas y configuración.
14. ¿Qué hace la persona cuando una orden de trabajo quedó asignada a la cuadrilla
    equivocada, si el sistema no permite reasignarla?
15. ¿La factura cubre la campaña completa o se emite por tramos? El inventario menciona un
    candado por segmento sin explicar qué es un segmento para el negocio.
16. ¿La verificación por cámaras está disponible para el usuario, y desde dónde se consulta?
17. ¿Cuál es el límite de clientes simultáneos por pantalla, y qué ve la persona cuando lo
    supera al armar una propuesta?
18. ¿Puede una persona trabajar con más de una organización desde la misma cuenta, y quién
    tiene esa opción?
19. ¿Quién ocupa cada tipo de cuenta en la vida real y con qué frecuencia? Sin eso, este
    manual no puede ordenar las tareas por prioridad de uso.
20. ¿Qué ve exactamente la persona en «Dashboard»? El inventario solo dice que muestra
    indicadores, sin decir cuáles.

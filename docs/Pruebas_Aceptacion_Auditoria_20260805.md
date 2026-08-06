# Pruebas de aceptación — auditoría QA del 04/08/2026

**Qué es esto.** El guion para comprobar, desde la aplicación y como lo haría un
usuario, que todo lo que la auditoría reportó quedó resuelto en producción. No
hace falta saber nada técnico: cada prueba dice dónde ir, qué hacer y qué tiene
que pasar.

**Dónde se corre.** `https://demo.space-os.io` — producción. Entra con tu
usuario Dueño.

**Cómo se marca.** En la columna final: `OK` si pasó, `NO` si falló. Si algo
falla, anota abajo del bloque qué viste exactamente y en qué pantalla; con eso
se reproduce.

**Las claves de la columna «Hallazgo»** son las del informe del 04/08/2026:
`C` críticos, `A` altos, `M` medios, `B` bajos. Una sola prueba lleva `A-1 jul`
y es de la auditoría anterior, la del 24/07 — las dos numeraciones existen y no
son la misma.

| | |
|---|---|
| Versión desplegada | `3865c4e` (05/08/2026, 17:05) |
| Hallazgos que cubre | 3 críticos, 10 altos, 13 medios, 9 bajos |
| Duración estimada | 60–90 minutos |
| Fecha de ejecución | |
| Ejecutado por | |

---

## 0 · Antes de empezar — LEER

Esto corre contra la base **real**. Lo que crees se queda ahí y lo que borres no
vuelve. Cuatro reglas:

**1. Todo lo que crees, con prefijo.** Cliente, propuesta y campaña de prueba
llévalos con `QA0805_` delante del nombre. Al final hay un paso para borrarlos y
así se distinguen sin pensar.

**2. No cambies valores que ya tienen contenido real.** El logo, la razón social
y los datos fiscales son de verdad. La única prueba que escribe sobre
configuración existente es la M5, y lleva instrucciones para anotar el valor
anterior y devolverlo.

**3. «Restablecer contraseña» cierra las sesiones de esa persona** y la obliga a
cambiarla al entrar. Hazlo solo sobre un usuario desechable que crees tú, nunca
sobre alguien que esté trabajando.

**4. «Control de cambios» aplica a todo el equipo, tú incluido.** Si lo
enciendes, todos tendrán que teclear su contraseña para facturar o cobrar. La
prueba que lo usa es opcional y dice cómo dejarlo como estaba.

> Si algo se ve raro pero no está en esta lista, anótalo igual al final. Media
> auditoría salió de cosas que alguien vio de reojo mientras hacía otra cosa.

---

## 1 · Lo primero, porque se arregló hoy

Esto se desplegó hoy a las 17:05 y **es lo único que no se ha podido comprobar
todavía**. Restablecer la contraseña de otra persona llevaba sin funcionar desde
el 5 de agosto por la mañana: pedía la contraseña y luego contestaba que tu
usuario no tenía ninguna.

| # | Dónde | Qué hacer | Qué debe pasar | OK |
|---|---|---|---|---|
| 1.1 | Administración → Usuarios | Crea un usuario desechable: nombre `QA0805 Prueba`, correo `qa0805@prueba.local`, rol Comercial | Se crea y aparece en la lista | |
| 1.2 | Misma pantalla | En ESE usuario, botón **Cambiar** | Se abre «Restablecer la contraseña de QA0805 Prueba» y explica que generará una temporal | |
| 1.3 | Mismo diálogo | Pulsa **Restablecer contraseña** | Te pide **TU** contraseña, dentro del mismo diálogo. **No** debe salir un mensaje en rojo sin dónde escribirla | |
| 1.4 | Mismo diálogo | Escribe una contraseña **equivocada** y confirma | Dice «Contraseña incorrecta». Si dijera «Tu usuario no tiene contraseña», el arreglo NO está puesto — para la prueba y avisa | |
| 1.5 | Mismo diálogo | Ahora la correcta | Aparece la contraseña temporal en un recuadro, con el aviso de que no se puede volver a ver | |
| 1.6 | Administración → Usuarios | Borra el usuario `QA0805 Prueba` | Desaparece de la lista | |

---

## 2 · Entrar y ver tus datos

| # | Hallazgo | Qué hacer | Qué debe pasar | OK |
|---|---|---|---|---|
| 2.1 | C1 | Entra y mira el menú lateral | Dice el nombre de **tu** organización, no «RGB Catorce» ni «Demo» | |
| 2.2 | C1 | Recarga el Dashboard y observa mientras carga | Se ve un estado de carga. **No** aparecen contadores en «0 de 0» que luego cambian | |
| 2.3 | A6 | Cierra sesión y mira la pantalla de entrada | No hay ninguna opción de crear cuenta ni registrarse | |
| 2.4 | M5 | Vuelve a entrar y mira el pie de la pantalla de entrada y la pestaña del navegador | No aparece el nombre de otra empresa. La pestaña no dice «Demo» | |
| 2.5 | M4 | Escribe una dirección que no existe, p. ej. `demo.space-os.io/spaces-dooh/noexiste` | Sale una página de «no encontrado» con la marca y el fondo claro del sistema, no una pantalla oscura y suelta | |

---

## 3 · Dashboard y cifras

| # | Hallazgo | Qué hacer | Qué debe pasar | OK |
|---|---|---|---|---|
| 3.1 | A2 | Dashboard: compara el KPI de ocupación con la gráfica de ocupación | Dicen lo mismo. No un 0% junto a una gráfica marcando 42% | |
| 3.2 | M9 | Mira los importes grandes del Dashboard | Se abrevian bien: `$4.9M`, no `$4897.5k`. Y no conviven un abreviado y un `$2,505,600.00` en la misma tarjeta | |
| 3.3 | C2 | Revisa que ningún KPI muestre un importe **negativo** | Ninguno en rojo negativo. Si lo hay, anota cuál y de qué campaña | |
| 3.4 | A3 | Abre una campaña terminada → secciones «Rentabilidad» y «Reporte de cumplimiento» | No dicen «Completo» porque sí: cumplimiento exige 100% entregado y rentabilidad no se da por buena con margen negativo | |
| 3.5 | M13a | Recarga el Dashboard con F5 y mira el **primer segundo** | Sale un indicador de carga. En ningún momento aparecen los KPI en `$ 0.00` / `0%` para poblarse después: ese destello hacía creer que no había datos | |

---

## 4 · Inventario y pantallas

| # | Hallazgo | Qué hacer | Qué debe pasar | OK |
|---|---|---|---|---|
| 4.1 | B3 | Mira el menú lateral | La opción se llama **Inventario** (antes «Agregar inventario») y abre consulta, carga masiva y exportación | |
| 4.2 | A4 | Abre la ficha de varias pantallas y lee la línea de ubicación | Nunca dice `null`. No repite la alcaldía dos veces («EDOMEX, EDOMEX») | |
| 4.3 | B2 | Busca una pantalla de nombre largo, que salga cortado | Al pasar el cursor sale el nombre completo. Igual con el arrendador | |
| 4.4 | M10 | Mira la columna de tipo, aquí y en Network | Dice «Pantalla digital», «Puente peatonal», «Mural». Nunca `PANTALLA_DIGITAL` en crudo | |
| 4.5 | A8 | Elige una pantalla y compara su tarifa en Comercial y en Network | El mismo número en las dos. No 45,000 en una y 85,000 en otra | |
| 4.6 | M6 | Comercial → abre el desplegable de precio y **lee las opciones** | Los cortes corresponden al inventario real (del orden de `≤ $45k`). Si siguen diciendo `≤ $8k · ≤ $15k · ≤ $25k` con todas las pantallas en $45,000+, el arreglo NO está puesto | |
| 4.7 | M6 | Elige **cada** opción del desplegable, una por una | **Ninguna deja la lista en cero.** Ése era el defecto: los tres rangos estaban escritos a mano y ninguna pantalla bajaba de ellos | |
| 4.8 | M6 | Con un rango puesto, compara los resultados contra la tarifa de la columna | Todas las que quedan cuestan igual o menos que el corte elegido | |
| 4.9 | B7 | Ficha de una pantalla → botón **Eliminar** | Está separado de «Editar» y es discreto, no un bloque rojo. Al pulsarlo pide **escribir el nombre** de la pantalla | |
| 4.10 | B7 | Cancela, abre el diálogo de otra pantalla distinta | El campo llega **vacío**, no con el nombre anterior escrito | |
| 4.11 | M2 | Inventario sin ningún filtro puesto, y luego con un filtro que no encuentre nada | Los dos mensajes son distintos: uno dice que no hay nada capturado y por dónde empezar; el otro, que limpies el filtro | |
| 4.12 | M3 | Comercial → mapa | Abre centrado en Ciudad de México, no en Lima | |

---

## 5 · Clientes y propuestas

| # | Hallazgo | Qué hacer | Qué debe pasar | OK |
|---|---|---|---|---|
| 5.1 | M1 | Clientes → nuevo cliente `QA0805_Cliente`. Pon teléfono `abc123xyz` y RFC inválido, y envía | Se rechaza, y el motivo aparece **debajo de cada campo** que lo causa, no solo al pie del formulario | |
| 5.2 | M1 | Corrige solo el teléfono y vuelve a enviar | Sigue marcando el RFC. No te obliga a descubrir los errores de uno en uno | |
| 5.3 | M1 | Escribe el teléfono como `55 1234 5678` y como `+52 55 1234 5678` | Los dos se aceptan: se valida por cantidad de dígitos, no por formato rígido | |
| 5.4 | — | Termina de crear el cliente con datos válidos, incluidos RFC y razón social | Se crea. (Hacen falta para facturar más adelante) | |
| 5.5 | C2 | Propuestas → nueva propuesta `QA0805_Propuesta`, con fecha fin **anterior** a la de inicio | Se rechaza y explica el motivo | |
| 5.6 | C2 | Ahora con comisión del **150%** | Se rechaza y explica. Antes esto producía importes negativos que subían al Dashboard | |
| 5.7 | — | Corrige: fechas normales (un mes), comisión válida, y añade una pantalla **digital** | Se crea la propuesta | |
| 5.8 | A5 | Aprueba la propuesta y genera la campaña. Vuelve a pulsar **generar campaña** | La segunda vez te lleva a la **misma** campaña. No se crean dos | |
| 5.9 | A5 | Actividad → busca «Generó campaña desde propuesta» | Aparece **una sola** entrada para esa campaña, no dos con el mismo minuto | |

---

## 6 · Creativos y publicación

| # | Hallazgo | Qué hacer | Qué debe pasar | OK |
|---|---|---|---|---|
| 6.1 | M14 | Abre la campaña `QA0805_Propuesta` recién creada e intenta **enviarla al dominio** sin asignar creativos | Se rechaza, y el mensaje **nombra las pantallas** que faltan por asignar. No dice «asigna los creativos» a secas | |
| 6.2 | — | Creativos → sube un arte para esa campaña y **apruébalo** | Queda validado | |
| 6.3 | M14 | Asigna el creativo a la pantalla de la campaña | La pantalla deja de estar «Sin asignar» | |
| 6.4 | M14 | Vuelve a enviar al dominio | Ahora sí pasa, y la campaña queda esperando validación | |
| 6.5 | C3 | Aprueba la publicación. Abre la campaña y mira el panel del candado de facturación | Lista **solo** las condiciones que aplican a una campaña digital: OC y reporte de publicación. **No** debe aparecer «Fotografías comprobatorias» | |

---

## 7 · Facturación — el candado

Es el bloque donde la auditoría encontró más contradicciones: semáforos en verde
sin merecerlo y digitales que no se podían facturar nunca.

| # | Hallazgo | Qué hacer | Qué debe pasar | OK |
|---|---|---|---|---|
| 7.1 | C3 | En la campaña, **sin** registrar la OC todavía, intenta facturar | Se rechaza: falta la orden de compra | |
| 7.2 | — | Registra la OC del cliente | El panel del candado marca la OC en verde | |
| 7.3 | C3 | Mira el veredicto del panel | Dice que está lista para facturar, y las condiciones que enseña están **todas** en verde. No puede haber un candado «Completo» con una condición en rojo debajo | |
| 7.4 | — | Factura la campaña (plazo 90 días) | Se emite con folio. La campaña pasa a Completada | |
| 7.5 | — | Abre la factura y revisa el desglose | Subtotal + IVA = total, exacto. Sin descuadres de centavos | |
| 7.6 | A-1 jul | Vuelve a intentar facturar la misma campaña | Se rechaza diciendo que ya tiene factura. **No** debe aparecer un error del sistema ni crearse una segunda | |

---

## 8 · Cobranza

| # | Hallazgo | Qué hacer | Qué debe pasar | OK |
|---|---|---|---|---|
| 8.1 | M7 | Finanzas → Cobranza | Cada factura ocupa **una fila**, con sus cuotas desplegables. No la misma factura repetida doce veces | |
| 8.2 | M7 | Despliega una factura con varias cuotas y mira el estado del grupo | El estado del grupo es el **peor** de sus cuotas: si once están al corriente y una vencida, la factura sale vencida, no en verde | |
| 8.3 | M7 | Si hay muchas filas, baja hasta el final | Hay paginador. Si solo cabe una página, no se pinta ninguno | |
| 8.4 | M8 | Mira las fechas de esta pantalla y de los pagos de renta | Todas en dd/mm/aaaa. Ninguna en `2026-08-27` crudo | |
| 8.5 | M8 | Copia una celda de fecha que lleve un sufijo del tipo «(24d)» y pégala en cualquier sitio | Sale separado: `27/08/2026 (24d)`, no `27/08/2026(24d)` | |
| 8.6 | — | Registra un **abono parcial** en una cuota | La cuota sigue viva con el saldo actualizado; la factura **no** queda pagada | |
| 8.7 | — | Liquida esa cuota, dejando otras pendientes | La cuota queda pagada y la factura **sigue** sin estarlo. Solo se cierra cuando no queda ninguna cuota viva | |

---

## 9 · Arrendadores y contratos

| # | Hallazgo | Qué hacer | Qué debe pasar | OK |
|---|---|---|---|---|
| 9.1 | B4 | Arrendadores → KPI de renta mensual | Junto a la cifra dice cuántos contratos faltan por capturar («+ 9 por capturar»), no escondido en una nota al pie | |
| 9.2 | M7 | Abre un contrato con muchos pagos programados | La lista está paginada, no vuelca 30 filas de golpe | |
| 9.3 | M8 | Mira los periodos de los pagos de renta | En dd/mm/aaaa y sin capitalizar de forma rara | |
| 9.4 | M10 | Cualquier selector de duración | Dice «2 meses», nunca «2 mess» | |

---

## 10 · Operaciones

| # | Hallazgo | Qué hacer | Qué debe pasar | OK |
|---|---|---|---|---|
| 10.1 | A3 | Operaciones → cierra una orden de trabajo que esté sin asignar | Al cerrarse queda estampada a tu nombre. No puede quedar «COMPLETADA · Sin asignar» | |
| 10.2 | M15 | Administración → catálogo de tipos de tarea de cuadrilla | Es de **solo lectura** y dice a qué tipo de pantalla aplica cada tarea. Ya no es un campo de texto libre vacío | |
| 10.3 | M15 | Compara esa lista con los tipos que ofrece Operaciones al crear una OT | Coinciden. Y ya no se ofrece «Montaje digital», que el sistema rechazaba | |

---

## 11 · Campañas — estado contra calendario

| # | Hallazgo | Qué hacer | Qué debe pasar | OK |
|---|---|---|---|---|
| 11.1 | A1 | Campañas → busca alguna cuya fecha de fin ya pasó pero siga en un estado activo | Lleva un distintivo que avisa de que el estado contradice al calendario | |
| 11.2 | M12 | Abre el diálogo de reservar pantallas digitales | Avisa de que el loop configurado es una **referencia** y de que lo que manda son los spots de cada pantalla | |

---

## 12 · Administración, permisos y configuración

| # | Hallazgo | Qué hacer | Qué debe pasar | OK |
|---|---|---|---|---|
| 12.1 | RBAC | Administración → Roles y permisos | Aparece la fila **Inventario**, separada de Comercial | |
| 12.2 | RBAC | Lee cada fila de módulo | Cada uno dice **qué áreas abre** (Comercial → Clientes · Propuestas · Campañas…). Antes marcabas uno y abrías nueve sin saberlo | |
| 12.3 | A7 | En la misma pantalla, mira «Control de cambios» | Es un interruptor. Ya **no** hay campos para fijar una contraseña compartida | |
| 12.4 | RBAC | Administración → Usuarios → crear usuario, despliega el selector de Rol | **No** aparece «Cliente externo». Ese rol no tenía ni un permiso: entraba y recibía error en todo | |
| 12.5 | B8 | Integraciones | **No** se ven nombres de credenciales tipo `ADMOBILIZE_API_KEY` ni `CFDI_PAC_KEY`. Solo qué conector falta por configurar | |
| 12.6 | B8 | Mira el aviso de «Modo demo» de esa pantalla | Solo aparece si de verdad hay un conector sin credenciales, no siempre | |
| 12.7 | M12 | Administración → Configuración → apartado del loop | Dice que es una referencia y cuenta cuántas pantallas tienen su propio valor | |
| 12.8 | A10 | Actividad | Solo aparecen movimientos de **tu** organización | |
| 12.9 | M7 | Actividad, baja hasta el final | Está paginada. No vuelca 168 entradas de una vez | |
| 12.10 | B6 | Campana de notificaciones | El detalle se lee en dos líneas. No se corta en «…el importe de la re…» | |
| 12.11 | B1 | Abre cualquier formulario (alta de cliente, de pantalla) | Todos los campos tienen un contorno visible sobre el fondo | |
| 12.12 | M13b | Administración → Configuración → razón social *(solo si ya se aplicó el script de datos del 06/08)* | Dice `RGB CATORCE S DE RL DE CV`, sin `DEMO`. Que el nombre de la organización siga siendo **G500** es correcto: uno es el comercial y otro la razón social legal | |
| 12.13 | M13b | Arrendadores → abre un contrato y mira la **parte arrendataria** | Sale con la razón social sin `DEMO`. Es lo único que ese cambio venía a arreglar: el contrato se manda a firma con ese nombre | |

---

## 13 · Aislamiento entre organizaciones (M5 · ADR 0011)

Esta es la prueba más delicada y la más importante: hasta el 05/08 las cinco
organizaciones **compartían una sola fila de configuración**, y quien cambiaba
su IVA se lo cambiaba a todas las demás.

> Necesitas acceso a dos organizaciones. Si no lo tienes, salta al 13.4 y déjalo
> anotado como no ejecutado.

| # | Hallazgo | Qué hacer | Qué debe pasar | OK |
|---|---|---|---|---|
| 13.1 | M5 | Administración → Configuración. **Anota el IVA actual de las dos organizaciones antes de tocar nada** | Valor A: ______ Valor B: ______ | |
| 13.2 | M5 | En la organización A, cambia el IVA a un valor distinto y guarda | Guarda sin error | |
| 13.3 | M5 | Entra a la organización B y mira su IVA | **Sigue como estaba.** Si cambió, para todo y avisa: es el fallo que este cambio venía a cerrar | |
| 13.4 | M5 | Devuelve el IVA de A a su valor original | Queda como estaba al empezar | |
| 13.5 | M5 | Compara el nombre de la organización en el menú lateral y en Administración → Configuración | Dicen lo mismo. Antes uno decía «G500» y el otro «RGB Catorce» | |

---

## 14 · Limpieza

| # | Qué hacer | Hecho |
|---|---|---|
| 14.1 | Borra la campaña, la propuesta y el cliente `QA0805_*` que creaste | |
| 14.2 | Comprueba que no queda ningún `QA0805_` buscándolo en Clientes, Propuestas y Campañas | |
| 14.3 | Si encendiste «Control de cambios» en alguna prueba, apágalo | |
| 14.4 | A9 · Busca `TEST_` y `WhatsApp Image` en Clientes, Campañas y Creativos | No debe aparecer nada. Se limpiaron el 04/08 | |
| 14.5 | B9 · Propuestas → marca como **rechazada** cada propuesta que de verdad se perdió | El win rate deja de decir 100% y empieza a reflejar el histórico real. Es captura, no un arreglo: no sembrar propuestas inventadas para bajar el número | |

---

## 15 · Lo que este guion NO cubre, y por qué

Cuatro hallazgos siguen abiertos. **Ninguno es código pendiente**: son datos por
capturar o una configuración que no depende de la aplicación.

| Hallazgo | Qué falta | Por qué no está aquí |
|---|---|---|
| M11 | El enlace «¿Olvidaste tu contraseña?» no se ve en producción | El flujo **está implementado** (`/api/auth/forgot` y `/reset`), pero vive tras `NEXT_PUBLIC_RECUPERAR_PASSWORD`, que está en `0` porque `RESEND_API_KEY` y `EMAIL_FROM` están vacías. Sin correo, el enlace diría «revisa tu bandeja» y no llegaría nada. Se abre configurando el remitente, no tocando código |
| M13b | La razón social del tenant `g500` conserva el prefijo `DEMO` | Es un dato, no código. Script listo en `docs/datos/20260806_m13b_razon_social_g500.sql`; se cierra al aplicarlo. Ver la nota de abajo |
| B5 | Los sitios no tienen fotos cargadas | **Abierto por decisión, 06/08.** El mecanismo funciona (Comercial → ficha → «Agregar foto», persiste); faltan las fotos reales del inventario. No se desarrolla carga masiva |
| B9 | El win rate aparece al 100% | **En curso, 06/08.** Sale así porque no hay propuestas perdidas capturadas. El cálculo ya es honesto (dice «sobre 7 cerradas» y devuelve «—» sin cierres), así que se cierra **registrando las propuestas que de verdad se perdieron** —Propuestas → marcar como rechazada—, no tocando la fórmula ni sembrando datos inventados |

> **Sobre M13b, que no es solo cosmético.** `tenants.razon_social` de `g500`
> dice `DEMO RGB CATORCE S DE RL DE CV`, y ese campo no es decorativo:
> `obtenerConfigAdmin()` lo usa como la parte arrendataria del **contrato de
> arrendamiento que se manda a firma**. Mientras diga «DEMO», los contratos de
> G500 salen a firma con esa palabra en el nombre de la empresa que se obliga.
>
> El valor correcto es `RGB CATORCE S DE RL DE CV` —confirmado el 06/08—, y
> conviene saber por qué no lleva «G500» dentro: **G500 es el nombre comercial
> y RGB Catorce S de RL de CV la razón social legal de la misma empresa.** No
> son dos organizaciones. Que Configuración muestre los dos nombres a la vez es
> lo correcto, no una inconsistencia como la que reportó M5.

**M11 y M13 sí existen en el informe** (tabla resumen y sección 6). Una versión
anterior de este guion decía lo contrario y los daba por inexistentes; era falso,
y el efecto era que dos hallazgos quedaban sin resolver ni declarar. La parte de
M13 que **sí** está cerrada es el destello de `$ 0.00` al cargar (prueba 3.5).

Tampoco se comprueba desde aquí:

- **El aislamiento a nivel de base de datos** (que una organización no pueda leer los datos de otra ni forzando la dirección) está cubierto por las pruebas automáticas de integración, que verifican lo que un usuario no puede intentar desde la pantalla.

---

## 16 · Resultado

| Bloque | Pruebas | OK | NO |
|---|---|---|---|
| 1 · Restablecer contraseña (lo de hoy) | 6 | | |
| 2 · Entrar y ver tus datos | 5 | | |
| 3 · Dashboard y cifras | 5 | | |
| 4 · Inventario y pantallas | 12 | | |
| 5 · Clientes y propuestas | 9 | | |
| 6 · Creativos y publicación | 5 | | |
| 7 · Facturación | 6 | | |
| 8 · Cobranza | 7 | | |
| 9 · Arrendadores y contratos | 4 | | |
| 10 · Operaciones | 3 | | |
| 11 · Campañas | 2 | | |
| 12 · Administración y permisos | 13 | | |
| 13 · Aislamiento entre organizaciones | 5 | | |
| **Total** | **82** | | |

**Fallos encontrados** (número de prueba, qué viste, en qué pantalla):

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

**Firma de quien ejecuta:** ____________________  **Fecha:** ____________

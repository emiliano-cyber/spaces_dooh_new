---
tipo: manual
estado: en-curso
actualizado: 2026-09-15
tags: [manual, usuario-final, negocio, instancias]
archivos:
  - vault/00-Inventario/inventario-2026-09-15.md
  - vault/08-Manuales/manual-usuario-2026-08-25.md
  - apps/web/components/demo/shell/nav.ts
  - apps/web/middleware.ts
  - apps/web/app/(app)/login/page.tsx
  - apps/web/app/(app)/(shell)/
  - apps/web/app/(app)/codigos-recuperacion/
  - manuales/capturas-pendientes.md
---

# Manual de usuario — SPACE OS

## Cómo leer este manual

Este manual es para quien **usa** SPACE OS desde el navegador. Está ordenado por lo que
quieres lograr, no por cómo está hecho el sistema.

Los nombres de botones, pestañas y mensajes van **entre comillas**, tal como aparecen en
pantalla.

> [!important] Dos fechas, y conviene distinguirlas
> Lo que existe hoy, quién entra a cada pantalla y qué operaciones piden confirmación
> viene del reconocimiento del **15 de septiembre de 2026**.
>
> Los textos exactos de la interfaz —nombres de botones, avisos, campos— vienen de la
> revisión del **25 de agosto de 2026**, cuando se leyó la aplicación pantalla por
> pantalla. **No se han vuelto a comprobar**. Si un botón se llama distinto en tu
> instalación, manda lo que ves en tu instalación.

Lo que este manual **no** cubre: la instalación de una organización nueva, el panel con el
que se vigila el conjunto de instalaciones, y las licencias del producto. Eso lo opera
quien te vende SPACE OS, no tú.

---

## 1 · Qué es SPACE OS y qué se puede hacer con él

SPACE OS lleva de punta a punta un negocio de publicidad exterior: las pantallas y
espectaculares que rentas, los arrendadores que te alquilan el espacio donde están, los
clientes que te compran, las propuestas que les mandas, las campañas que sales a montar,
el trabajo de campo que eso exige, y el dinero que cobras y que pagas.

Tu empresa tiene **su propia copia de SPACE OS**, en su propia dirección de internet, con
sus propios datos. Nadie de otra empresa ve lo tuyo y tú no ves lo de nadie.

Esa copia **se actualiza sola de madrugada**, a las 04:17. No tienes que hacer nada, y
puede haber un corte de servicio de unos segundos a esa hora.

El recorrido completo, en el orden en que ocurre:

| Paso | Qué haces | Capítulo |
|---|---|---|
| 1 | Das de alta las pantallas que vas a vender | 4 |
| 2 | Registras de quién es el espacio y qué le pagas | 5 |
| 3 | Registras al cliente y le armas una propuesta | 6 |
| 4 | El cliente la acepta y se convierte en campaña | 6 |
| 5 | Subes el arte, mandas a imprimir y a montar | 7 |
| 6 | Facturas y cobras | 8 |

---

## 2 · Entrar y gestionar tu cuenta

### 2.1 · Entrar con correo y contraseña

**Empiezas en:** la dirección de SPACE OS de tu empresa, abierta en el navegador.

**Vas a conseguir:** entrar a trabajar.

1. Abre la dirección que te dieron. Llegas a la pantalla **«Iniciar sesión»**.
2. Escribe tu correo en **«Correo»**.
3. Escribe tu contraseña en **«Contraseña»**.
4. Pulsa **«Entrar»**.

**Salió bien si:** entras a la pantalla que corresponde a tu perfil —el Dueño aterriza en
**«Dashboard»**— y aparece el menú lateral con tus módulos.

Cada instalación ofrece los métodos de entrada que tenga encendidos. Si tu empresa
configuró la entrada **solo con Google**, la caja de contraseña no aparece y la única vía
es el botón de Google.

> [!note] Captura: la pantalla «Iniciar sesión» con las opciones de entrada disponibles
> Ya existe material: `manuales/capturas/01-01-acceso-tres-opciones.png`. Conviene
> retomarla porque desde entonces cambió el alta.

### 2.2 · Entrar con Google

**Empiezas en:** la pantalla **«Iniciar sesión»**.

1. Pulsa **«Continuar con Google»**.
2. Elige tu cuenta de Google y acepta.

**Salió bien si:** vuelves a SPACE OS ya dentro, sin haber escrito ninguna contraseña.

Tu cuenta de Google tiene que ser **el mismo correo** con el que te dieron de alta. Si no,
el sistema te dice que esa cuenta no está dada de alta y que se lo pidas a tu
administrador.

> [!warning] Si entras con Google puede que no tengas contraseña
> Hay operaciones que te van a pedir **tu contraseña** aunque hayas entrado con Google
> (apartado 2.6). Si nunca te pusieron una, el sistema te lo dirá justo cuando la
> necesites. Pídele a quien administra la cuenta que te la restablezca **antes** de que te
> haga falta para facturar.

Si tu instalación permite el alta por Google, entrar por ahí la primera vez puede crear tu
organización y dejarte como Dueño. Eso depende de cómo esté configurada tu copia; no es
igual en todas.

### 2.3 · Guardar tus códigos de recuperación

**Empiezas en:** la pantalla **«Códigos de recuperación»**, a la que el sistema te lleva
cuando toca, y que puedes abrir estando dentro.

**Vas a conseguir:** una lista de códigos de un solo uso para entrar el día que no puedas
usar tu contraseña ni tu cuenta de Google.

1. Abre **«Códigos de recuperación»**.
2. Genera la lista.
3. Cópiala y guárdala fuera de SPACE OS: en papel, o donde guardes tus contraseñas.

**Salió bien si:** tienes la lista de códigos guardada en un sitio al que llegues sin
entrar a SPACE OS.

> [!warning] Cada código sirve una sola vez, y la lista se muestra una vez
> Si cierras esa pantalla sin copiarlos, tendrás que generarlos otra vez. Generarlos otra
> vez deja los anteriores sin valor.

> [!note] Captura: la pantalla «Códigos de recuperación», con la lista generada
> No existe todavía. Es una pantalla nueva, de septiembre.

### 2.4 · Entrar cuando no puedes usar tu contraseña

**Empiezas en:** la pantalla **«Iniciar sesión»**.

Tienes tres caminos, y no todos están abiertos en todas las instalaciones:

1. **Un código de recuperación** de los que guardaste (apartado 2.3). Funciona siempre que
   te los hayas generado.
2. **El enlace de contraseña olvidada.** Solo aparece si tu empresa tiene configurado el
   correo saliente. Si aparece, escribe tu correo, abre el mensaje que te llega y fija una
   contraseña nueva desde ahí.
3. **Pedírselo a quien administra la cuenta**, que te la restablece (apartado 3.4).

**Salió bien si:** vuelves a entrar.

> [!info] Si el enlace de contraseña olvidada no está, no está roto
> Esa opción se enciende por instalación, y necesita un servidor de correo detrás. Sin él,
> la aplicación diría «revisa tu bandeja» y no llegaría nada. Por eso se oculta en lugar
> de mentir.

### 2.5 · Cambiar tu contraseña

**Empiezas en:** tu nombre, arriba a la derecha → **«Configuración»**.

1. Abre la tarjeta **«Mi cuenta»**.
2. Escribe la **«Nueva contraseña»**.
3. Confirma con tu **«Contraseña actual»**.
4. Pulsa **«Guardar cambios»**.

**Salió bien si:** el aviso de confirmación aparece y puedes seguir trabajando.

La contraseña necesita **al menos 8 caracteres, con al menos una letra y un número**.

**Si tu contraseña es temporal.** Cuando alguien te crea el usuario o te lo restablece, la
contraseña que te dan sirve una sola vez. Al entrar con ella, el resto de la aplicación
queda cerrado y aterrizas directo en **«Configuración»** con el aviso *«Tu contraseña es
temporal. Cámbiala aquí abajo para volver a entrar al resto del sistema.»* Cámbiala y el
menú vuelve a aparecer completo.

### 2.6 · Cuando el sistema te pide tu contraseña otra vez

No es un fallo. Hay siete operaciones que mueven dinero o compromisos y piden que **quien
las hace vuelva a teclear su propia contraseña**:

- Crear un contrato de arrendamiento.
- Modificar un contrato de arrendamiento.
- Renovar un contrato.
- Cancelar un contrato.
- Registrar el pago de una renta al arrendador.
- Facturar una campaña.
- Registrar el pago de una factura del cliente.

**Pasos**

1. Pulsa el botón **«Cambios bloqueados»** de la barra superior.
2. En la ventana **«Desbloquear cambios»**, escribe tu contraseña.
3. Pulsa **«Desbloquear»**.

**Salió bien si:** el botón cambia a **«Desbloqueado N min»** en verde y la operación
continúa. Mientras dure, no te la vuelve a pedir.

> [!important] No es una clave compartida, y al Dueño también le aplica
> Cada quien confirma con **la suya**. La bitácora tiene que poder probar quién lo hizo.

El trabajo diario —crear campañas, subir creatividades, cerrar órdenes de trabajo— **no**
pide desbloqueo.

### 2.7 · Si te quedas fuera

El sistema frena los intentos repetidos de entrar. Si te pasas, espera unos minutos y
vuelve a probar: no hace falta avisar a nadie.

Si el sistema te saca de golpe, hay dos explicaciones normales: tu sesión caducó, o
alguien restableció tu contraseña, y eso cierra todas tus sesiones abiertas.

Si nada de lo anterior te deja entrar, avisa a quien administra la cuenta en tu empresa —
el Dueño— y, si él tampoco puede, a quien os da soporte de SPACE OS.

---

## 3 · Tu organización y las personas

> [!info] Casi todo este capítulo es solo para el Dueño
> El resto de perfiles no ve la pantalla **«Administración»**.

### 3.1 · Los cinco perfiles y qué ve cada uno

| Perfil | Pantallas que ve |
|---|---|
| **Dueño** | Todas |
| **Comercial** | Network · Clientes · Comercial · Disponibilidad · Propuestas · Campañas · Creativos · Comisiones |
| **Operaciones** | Operaciones · Almacén |
| **Imprenta** | Imprenta |
| **Finanzas** | Finanzas |

Lo que un perfil no debe ver **no aparece en el menú**. No es que esté en gris: no está.

> [!warning] Ver un módulo no es poder hacer todo dentro de él
> Además del perfil, cada acción concreta —Ver, Crear, Aprobar, Facturar— depende del
> permiso que tenga ese perfil sobre ese módulo. Si una opción no te aparece o te la
> rechaza, pídesela al Dueño.

El cliente y el arrendador **no necesitan cuenta**: entran por una liga que tú les mandas
(capítulo 9).

> [!note] Captura: el menú lateral completo, visto por el Dueño
> Hay material del 11 de agosto en `manuales/capturas/01-04-menu-lateral-grupos.png`.
> Conviene rehacerla: los grupos del menú cambiaron después.

### 3.2 · Invitar a alguien de tu equipo

**Empiezas en:** **«Administración»** → pestaña **«Usuarios»**.

1. Pulsa **«Invitar usuario»**.
2. En la ventana **«Crear usuario»**, captura **«Nombre»**, **«Correo»**, **«Cargo»** y
   **«Rol»**.
3. Escribe una **«Contraseña»** para esa persona, o marca *«Entra con su cuenta de
   Google»* si tu instalación lo ofrece. Con Google, el correo que escribiste tiene que
   ser exactamente el de su cuenta de Google.
4. Guarda.

**Salió bien si:** la persona aparece en la tabla **«Equipo»** con su rol y en estado
**Activo**.

La contraseña que le pongas es **temporal**: el sistema le va a pedir que la cambie en
cuanto entre (apartado 2.5).

> [!note] Captura: la ventana «Crear usuario» con el selector de rol desplegado
> No existe todavía.

### 3.3 · Cambiar el rol de alguien o darlo de baja

**Empiezas en:** **«Administración»** → pestaña **«Usuarios»** → tabla **«Equipo»**.

1. Busca a la persona en la tabla.
2. Cambia su rol con el selector de su fila, o alterna su estatus entre **Activo** e
   **Inactivo**.

**Salió bien si:** la fila refleja el cambio. Una persona **Inactiva** ya no puede entrar.

> [!warning] No puedes cambiarte el rol a ti mismo ni desactivarte
> Es a propósito: evita que el último Dueño de la organización se cierre la puerta.

Dar de baja se hace dejando a la persona **Inactiva**, no borrándola. Su rastro en la
bitácora tiene que seguir existiendo.

### 3.4 · Restablecerle la contraseña a alguien

> [!danger] La contraseña temporal se ve una sola vez y no se puede recuperar
> En cuanto cierres la ventana, nadie —ni tú— puede volver a verla. Si se te pierde,
> tienes que volver a restablecerla. Además, esta acción **cierra todas las sesiones
> abiertas** de esa persona.

**Empiezas en:** **«Administración»** → pestaña **«Usuarios»** → la fila de esa persona.

1. Pulsa **«Cambiar»** en su fila.
2. Confirma con **tu** contraseña. El sistema te lo explica: *«Vas a cambiar el acceso de
   <nombre>, y la bitácora tiene que poder probar que fuiste tú»*.
3. Pulsa **«Restablecer contraseña»**.
4. Copia la contraseña temporal que aparece y entrégasela por un medio seguro.

**Salió bien si:** tienes la contraseña temporal copiada y esa persona puede entrar con
ella. Al entrar, el sistema le pedirá cambiarla.

Para la tuya propia, el botón dice **«Cambiar la mía»** y te pide la contraseña actual.

### 3.5 · Decidir quién puede hacer qué

**Empiezas en:** **«Administración»** → pestaña **«Roles y permisos»**.

La tabla **«Permisos por rol y módulo»** cruza los módulos con los roles. Cada celda
muestra las capacidades concedidas: **V** (Ver), **C** (Crear), **A** (Aprobar), **F**
(Facturar).

Bajo el nombre de cada módulo se listan las áreas que abre: conceder el módulo comercial
concede además Clientes, Propuestas y Campañas.

En esa misma pestaña se enciende y se apaga el **«Control de cambios»**, que es lo que
hace que las siete operaciones del apartado 2.6 pidan la contraseña.

> [!note] Captura: la matriz «Permisos por rol y módulo» completa
> No existe todavía.

### 3.6 · Los datos de tu empresa

**Empiezas en:** **«Administración»** → pestaña **«Configuración»**. Solo el Dueño.

| Tarjeta | Qué ajustas |
|---|---|
| **«Identidad de la empresa»** | Logo, nombre de la empresa, razón social, nombre comercial y moneda |
| **«Correo de avisos»** | La dirección a la que responden los avisos de operación |
| **«Datos fiscales para contratos»** | RFC, representante legal, domicilio fiscal y datos de constitución, con los que tu empresa firma como arrendataria |
| **«IVA(s) con los que trabaja»** | Las tasas disponibles; cuál se aplica se elige por cliente |
| **«Reproducción digital (loop)»** | Tamaño del loop, duración por slot y slots resultantes |
| **«Cupo de clientes por pantalla»** | Cuántos anunciantes distintos comparten una pantalla a la vez |
| **«Plazos de cobranza (días)»** | Una lista de plazos |
| **«Tipos de tarea de cuadrilla»** | Solo lectura: los fija el sistema |

> [!warning] «Plazos de cobranza (días)» hoy no gobierna nada
> Puedes guardar la lista que quieras, pero la ventana de facturar ofrece siempre 60, 90 y
> 120 días (apartado 8.2). Está anotado en los pendientes del final.

> [!warning] El «Correo de avisos» no es desde dónde salen los correos
> Los avisos salen del servidor de correo de la plataforma a nombre de tu organización, y
> **las respuestas llegan a esa dirección**. En la bandeja de enviados de esa cuenta no
> vas a ver nada.

**Crear otra organización** dentro de tu instalación está reservado a quien administra la
plataforma. Si necesitas una, pídesela a quien te da soporte.

---

## 4 · El inventario: tus pantallas y sitios

Solo el **Dueño** entra a **«Inventario»**. Comercial ve las mismas pantallas desde
**«Comercial»** y **«Network»**, pero no da de alta desde ahí.

> [!important] Una pantalla sin contrato de arrendamiento completo no se puede vender
> Es el tropiezo más frecuente de todo el sistema. Por eso la vía recomendada da de alta
> el contrato y la pantalla a la vez.

### 4.1 · Dar de alta una pantalla junto con su contrato (recomendado)

**Empiezas en:** **«Inventario»** → pestaña **«Contrato + pantalla»**.

**Vas a conseguir:** una pantalla vendible desde el primer momento.

**Paso 1 — ¿A quién le rentas este espacio?**

1. Elige un **«Arrendador»** existente, o cambia a «Nuevo» y captura **«Nombre / razón
   social»** y, si los tienes, **«RFC»**, **«Teléfono»** y **«Correo»**.
2. Elige el **«Predio»**, o captura **«Nombre del predio»** y **«Dirección del predio»**.
   Si dejas la dirección vacía se toma la de la pantalla.

**Paso 2 — Condiciones del arrendamiento**

3. Captura **«Inicio de vigencia»** y **«Fin de vigencia»**. Puedes usar fechas pasadas
   para registrar contratos que ya firmaste en papel.
4. Captura la **«Renta»**, la **«Periodicidad del pago»** y la **«Moneda»** (MXN o USD).
5. Si lo tienes, adjunta el **«Documento del contrato (PDF, opcional)»**, hasta 8 MB.

**Paso 3 — La pantalla**

6. Elige una pantalla existente sin arrendador —el asistente te muestra **«Datos que ya
   tiene»** para que confirmes que es la correcta— o captura una nueva con **«Nombre de la
   pantalla»**, **«Tipo de medio»**, **«Dirección»**, **«Distrito / alcaldía»**,
   **«Ciudad»**, **«Caras»**, **«Tarifa publicada»** y **«Lat/Lng»**.
7. Si es digital, captura además **«Slots»** y **«Duración por slot»**.
8. Pulsa **«Crear contrato y pantalla»**.

**Salió bien si:** vuelves a la lista con el aviso *«Contrato y pantalla "<nombre>"
creados»* y la pantalla ya aparece en el mapa de **«Comercial»**.

> [!note] Captura: los tres pasos del asistente «Contrato + pantalla»
> Hay material parcial en `manuales/capturas/` del alta de pantalla; falta el asistente
> completo.

### 4.2 · Dar de alta una sola pantalla a mano

**Empiezas en:** **«Inventario»** → pestaña **«Alta manual»**.

| Solapa | Qué capturas |
|---|---|
| **«Básico»** | **«Arrendador (dueño del espacio)»**, **«Renta al arrendador»**, **«Nombre de la pantalla»**, **«Dirección»**, **«Exhibición»** (*Fija (impresa)* o *Digital (pantalla)*), **«Latitud»**, **«Longitud»**, **«Tipo de pantalla»** y **«Estado»** |
| **«Especificaciones»** | Resolución en píxeles, **«Caras»**, **«Modalidades de contratación»** (Mensual · Catorcenal) y la configuración de slots: duración, total y disponibles |
| **«IA/Vision»** | La casilla *«Esta pantalla cuenta con tecnología de Computer Vision (IA)»* y el identificador del dispositivo |
| **«Precios»** | **«Tarifa publicada»** y **«Precio por m² (estáticas)»** |
| **«Imágenes»** | **«Imagen promocional»**, obligatoria, JPG o PNG, máximo 5 MB |

Cierra con **«Guardar pantalla»**.

**Salió bien si:** la pantalla aparece en la tabla de **«Inventario»**.

> [!important] Una pantalla tiene un solo costo: la renta al arrendador
> Por eso la renta se captura junto a quién es el arrendador, y la solapa **«Precios»** no
> tiene ningún «costo de compra». Dos números para el mismo espacio producían márgenes que
> no cuadraban.

Si no capturas la renta, el contrato queda **Incompleto** y esa pantalla **no se puede
reservar** hasta que lo completes (apartado 5.4).

### 4.3 · Cargar muchas pantallas de una vez

**Empiezas en:** **«Inventario»** → pestaña **«Carga masiva»**.

1. Pulsa **«Descargar plantilla»** y llénala. La hoja se llama **Sitios**.
2. Elige el **«Arrendador de estas pantallas»**. Es obligatorio.
3. Indica el predio. Puedes escribir uno nuevo.
4. Si aplica, captura el **«Precio de impresión por m² (pantallas estáticas)»**, que se
   aplica a todas las estáticas del archivo.
5. Si tu Excel no está en UTF-8, elige la **«Codificación del archivo»**.
6. Opcionalmente adjunta las imágenes en bloque.
7. Si alguna pantalla ya existe, elige entre **«Actualizar»** los campos modificados o
   **«Crear nueva»** con sufijo `-v2`, `-v3`…
8. Sube el archivo.

**Salió bien si:** aparece el resumen con **Total · Creadas · Actualizadas · Advertencias
· Errores** y el botón **«Ver información añadida»**.

> [!warning] El detalle de los errores solo se ve en ese resumen
> Qué fila falló y por qué no queda guardado en ninguna otra pantalla. Léelo antes de
> cerrarlo. Las filas con advertencia **sí entraron**.

### 4.4 · Cambiar tarifas y rentas de varias pantallas a la vez

**Empiezas en:** **«Inventario»** → pestaña **«Inventario»**.

1. Marca las pantallas con la casilla de la izquierda. Aparece una barra de acciones.
2. Elige qué campo tocas: **«Tarifa»** (lo que te paga el cliente) o **«Renta»** (lo que
   le pagas al arrendador).
3. Elige cómo: un valor exacto (**«Fijar tarifa»** / **«Fijar renta»**) o un porcentaje
   (**«Ajustar %»**, por ejemplo `10` o `-5`).
4. Escribe el valor y pulsa **«Aplicar»**.

**Salió bien si:** aparece un aviso del estilo *«Renta actualizada en N contratos»*.

> [!warning] Los contratos de predio alcanzan más pantallas de las que marcaste
> Si alguna pantalla seleccionada cuelga de un contrato de predio compartido, la
> confirmación te avisa de cuántas pantallas **que no seleccionaste** también cambian.
> Léelo antes de aceptar.

La tarifa y la renta de una sola pantalla se editan pulsando directamente sobre la celda
de la tabla. Los botones **«Excel»** y **«CSV»** descargan **lo que estás viendo
filtrado**.

### 4.5 · Ver tus pantallas en el mapa

**Empiezas en:** **«Comercial»**. Entran el Dueño y Comercial.

Filtras con el buscador **«Buscar avenida, distrito…»** y con los selectores de tipo,
distrito, disponibilidad y precio. Puedes alternar entre mapa y lista, y descargar lo
filtrado en Excel o CSV.

Los pines llevan color: azul *Digital*, verde *Disponible*, rojo *Ocupado*, ámbar
*Reservado*.

> [!note] Captura: el mapa de «Comercial» con un filtro aplicado y la leyenda visible
> Estaba planificada como `04-03` y sigue pendiente.

### 4.6 · La ficha de una pantalla: editar, pausar, reubicar

**Empiezas en:** **«Comercial»** → pulsa la pantalla.

La ficha trae **Galería**, **Características**, **Datos comerciales** (tarifa, renta y
margen), **Arrendador y renta**, **Ubicación** y **Disponibilidad**.

Desde el menú de la ficha:

- **«Editar»** — nombre, tipo de medio, disponibilidad, dirección, medidas, caras,
  estructura, iluminación, tarifa, arrendador, cupo de clientes y, en digitales, slots,
  duración, resolución, contenido y horario.
- **«Pausar por situación legal»** — pide el **«Motivo»**. Mientras esté en pausa, la
  pantalla **no está disponible comercialmente**. Se revierte con **«Reanudar»**.
- **«Reubicar»** — elige el **«Predio destino»**. Si procede, el sistema genera la orden de
  trabajo y te lo dice: *«Pantalla reubicada · OT <folio> generada»*.
- **Eliminar** — solo funciona si la pantalla no tiene reservas ni órdenes asociadas.

Si la pantalla tiene cámara, la ficha añade el bloque **«Inteligencia artificial · Space
Eye»** con el estado del dispositivo, la última señal, la foto y el veredicto de la
verificación: **«Anuncio correcto»**, **«No coincide con la creatividad»** o **«Sin
verificación IA aún»**.

---

## 5 · Arrendadores y contratos

**Empiezas en:** **«Arrendadores»**. Solo el Dueño.

La cabecera lleva cinco contadores: **Arrendadores**, **Contratos**, **Renta mensual**,
**Por vencer** y **Renta vencida**.

### 5.1 · Dar de alta un arrendador

1. Pulsa **«Nuevo arrendador»**.
2. Captura **«Nombre / razón social»**. Es obligatorio.
3. Captura **«RFC»**, **«Teléfono»**, **«Correo»** y **«Domicilio»**.
4. Si aplica, captura los datos fiscales: **«Razón social»** y **«Régimen fiscal»**.

**Salió bien si:** el arrendador aparece en la tarjeta **«Arrendadores»**.

> [!warning] El domicilio no es opcional en la práctica
> El contrato que genera el sistema lo recita dos veces. Si falta, el documento sale con
> huecos y **no se puede enviar a firma**.

Los campos que faltan aparecen marcados como **«Falta»** en la tarjeta y se completan ahí
mismo.

Un mismo arrendador puede facturar a nombre de varias razones sociales. Se administran en
la tarjeta **«Razones sociales»** y el contrato elige cuál usa.

### 5.2 · Crear un contrato de arrendamiento

> [!warning] Esta operación pide tu contraseña
> Crear, modificar, renovar y cancelar contratos son de las siete operaciones del apartado
> 2.6.

**Empiezas en:** **«Arrendadores»** → **«Nuevo contrato»**.

Es el mismo asistente de tres pasos del apartado 4.1: arrendador → condiciones (con
fechas pasadas permitidas) → pantalla.

**Salió bien si:** el contrato aparece como **Vigente** y su pantalla deja de rebotar al
reservarla.

### 5.3 · Registrar las licencias y permisos del sitio

**Empiezas en:** la tarjeta **«Licencias y permisos»** → **«Agregar»**.

Captura **«Tipo»**, **«Folio»**, **«Autoridad»**, **«Expedición»** y **«Vencimiento»**.

**Salió bien si:** la licencia aparece listada con su vencimiento.

La **fecha de vencimiento es lo que dispara el aviso**: de ahí salen las alertas del
Dashboard.

> [!info] Esto no tiene nada que ver con la licencia de SPACE OS
> Aquí se registran los permisos de anuncio de tus sitios. La licencia del producto es
> otra cosa y la lleva quien te da soporte (apartado 10.4).

### 5.4 · Completar un contrato que quedó incompleto

**Empiezas en:** **«Arrendadores»** → abre el contrato marcado como **Incompleto**.

Un contrato **Incompleto** no es un error: es uno que todavía no dice qué se paga.

1. Pulsa **«Completar información»**.
2. En la ventana **«Completar contrato de arrendamiento»**, elige el **«Arrendador»**. Al
   elegirlo se muestran su razón social, RFC, régimen, correo y teléfono para que
   confirmes que es el correcto.
3. Captura el **importe de la renta**.
4. Captura **cada cuándo se paga**.
5. Captura **«Desde»** y **«Hasta»**.

**Salió bien si:** el contrato pasa a **Vigente** y su pantalla ya se puede reservar.

### 5.5 · Generar el contrato y mandarlo a firma

> [!danger] Mandar a firma congela el documento
> Al enviarlo, el sistema guarda una versión sellada. Si después cambias cualquier dato
> del contrato, **todas las firmas que ya tenías quedan invalidadas** y hay que volver a
> empezar. Revisa el documento completo antes de este paso.

**Empiezas en:** el contrato abierto.

1. Pulsa **«Generar contrato»**. El sistema produce el documento con las DECLARACIONES y
   las CLÁUSULAS. Si falta algún dato, arriba aparece *«Faltan N datos por capturar»* y
   los huecos van marcados en el texto.
2. Si quieres copia en papel, usa **«Imprimir o guardar como PDF»**.
3. En **«Firma del contrato»**, pulsa el botón que manda el documento a firma.
4. Pulsa **«Copiar enlace de firma»** y hazle llegar esa liga al arrendador.

**Salió bien si:** ves *«Documento congelado y enviado a firma»* y después *«Enlace
copiado. Envíaselo al arrendador.»*

> [!warning] La liga la envías tú
> El sistema **no manda ese correo**. Copias el enlace y se lo haces llegar por el medio
> que uses. Lo mismo vale para la liga de la propuesta y la del portal del cliente.

Cuando el arrendador abre la liga ve **«Firmar electrónicamente»**, escribe su **«Nombre
completo»** y firma. Queda una **«Constancia de firma electrónica»** con fecha, hora y
dirección desde la que firmó.

Si el contrato cambió después de congelarse, el panel lo dice y marca cada firma como
**«Firma invalidada»**. Hay que usar **«Volver a enviar a firma (reinicia las firmas)»**.

### 5.6 · Pagar la renta del arrendador

> [!warning] Esta operación pide tu contraseña y no se deshace sola
> Si registras un pago que no era, el sistema te obliga a **cancelarlo** antes de volver a
> registrar ese periodo. No se sobrescribe.

**Empiezas en:** la tarjeta de pagos de renta, en **«Arrendadores»**. Primero salen los
vencidos.

1. Pulsa el pago pendiente. Se abre **«Registrar pago»** con el periodo y el importe.
2. Captura la **«Fecha de pago»**. No puede ser futura.
3. Elige el **«Método de pago»**.
4. Adjunta la **factura del arrendador** y el **comprobante de pago**, en PDF o imagen.
5. Escribe observaciones si hacen falta y guarda.

**Salió bien si:** el periodo queda **Pagado** y los adjuntos aparecen como **«Factura»** y
**«Comprobante»** en la fila.

Si el periodo ya estaba pagado, el sistema lo rechaza: *«Este periodo ya está pagado (…).
Cancélalo antes de volver a registrarlo.»*

### 5.7 · Renovar o cancelar un contrato

> [!danger] Un contrato cancelado no se reactiva
> El sistema responde *«El contrato está CANCELADO; crea uno nuevo en su lugar.»* No uses
> la cancelación para corregir un dato mal capturado: para eso está la edición.

**Empiezas en:** el contrato abierto. Las dos acciones piden tu contraseña.

Usa **«Renovar»** para prolongar la vigencia, y la cancelación solo cuando el acuerdo se
acabó de verdad.

### 5.8 · Reportar una incidencia en un sitio

**Empiezas en:** el contrato o la ficha de la pantalla → **«Reportar incidencia»**.

1. Elige el **«Tipo»**: *Legal / permiso*, *Mantenimiento*, *Vandalismo*, *Clima*,
   *Suspensión operativa*, *Accidente* u *Otro*.
2. Escribe la **descripción**.

**Salió bien si:** la ficha de la pantalla muestra la incidencia y el Dashboard la cuenta
como alerta.

### 5.9 · Saber cuánto debes y qué tan rentable es cada pantalla

En **«Arrendadores»**, cuatro vistas resuelven las preguntas de dinero del lado del
arrendador:

- **«Cuadre de renta por arrendador»** — qué se le debe a cada uno y qué ya se le pagó, con
  las columnas **Vencido · Pendiente · Pagado · Próximo**. Primero quien tiene vencidos.
- **«Renta comprometida a arrendadores»** — lo que sale cada mes por contrato activo, ya
  convertido a equivalente mensual.
- **«Rentabilidad por pantalla»** — margen mensual = ingreso de reservas vigentes menos
  renta del arrendador. Las de margen negativo son candidatas a renegociar o dar de baja.
- **«Vigentes en Excel»** — descarga los contratos vigentes.

---

## 6 · Vender: de una propuesta a una campaña

### 6.1 · Registrar un cliente o una agencia

**Empiezas en:** **«Clientes»** → **«Nuevo cliente»**. Entran el Dueño y Comercial.

1. Captura **«Nombre del cliente»** y el **«Tipo»**: *Directo* o *Agencia*.
2. Captura **«Correo de contacto»** y **«Teléfono»**.
3. Si es agencia, captura la **«Comisión de la agencia (%)»**.
4. Elige el **«IVA (%)»** de las tasas que configuró el Dueño.
5. Captura los datos fiscales: **«RFC»**, **«C.P. fiscal»**, **«Razón social»**,
   **«Régimen fiscal»** y **«Uso de CFDI»**.

**Salió bien si:** el cliente aparece en el catálogo y se puede elegir al reservar.

> [!warning] Sin RFC y razón social no vas a poder facturar
> El sistema no te frena al crear el cliente: te frena semanas después, al facturar, con
> *«El cliente requiere RFC y razón social para facturar (ve a Clientes)»*. Captúralos
> ahora.

**La negociación de la agencia.** En un cliente de tipo Agencia aparece el bloque
**«Negociación con la agencia»**, con los términos y el interruptor **«Negociación
validada»**. Mientras esté sin validar **no se pueden crear ni aprobar propuestas con esa
agencia**.

### 6.2 · Apartar pantallas para un cliente

**Empiezas en:** **«Comercial»**, con las pantallas ya filtradas.

1. Marca las pantallas que quieres con la casilla de cada tarjeta.
2. Abre **«Reservar sitios»**.
3. Captura **«Cliente»**, **«Nombre de campaña (opcional)»**, **«Inicio»** y **«Fin»**.
4. Elige el **tipo de campaña**: **Automático** (lo deduce el sistema según las pantallas),
   **Digital (DOOH)** (sin imprenta), **Fijo (OOH)** (con imprenta) o **Híbrida** (con
   imprenta).
5. En las digitales, indica cuántos **slots** apartas por pantalla.

**Salió bien si:** las pantallas quedan en **«Reservado · tentativo»** en ámbar y aparecen
en la tarjeta **«Reservas tentativas»** de Comercial, con el botón **«Confirmar»**.

> [!warning] Las tentativas caducan solas a los 7 días y liberan el inventario
> Si la venta es real, confírmala. Nadie te va a avisar el día que caduque.

### 6.3 · Ver qué tienes libre más adelante

**Empiezas en:** **«Disponibilidad»**.

Elige **«Desde»**, la vista **Catorcena** o **Mes**, cuántos **periodos** quieres ver (4,
6, 8 o 12) y, si quieres, busca una pantalla concreta.

Leyenda: **Libre** · **Parcial (digital con slots)** · **Ocupado** · borde punteado = solo
tentativa.

### 6.4 · Armar una propuesta

**Empiezas en:** **«Propuestas»** → **«Nueva propuesta»**.

1. Captura el **«Nombre de la propuesta»**.
2. Elige el **«Cliente»** y, si aplica, la **«Agencia»**. Al elegirla se aplica su comisión.
3. Captura **«Desde»**, la **duración de la campaña** y el **«Hasta»**, que se calcula solo
   y puedes ajustar.
4. Ajusta la **«Comisión de la agencia (%)»** si hace falta.
5. Elige los sitios: desde la **lista**, o dibujando una **zona** sobre el mapa y tocando
   los puntos para agregarlos o quitarlos.
6. En **«Contratación por sitio»**, indica por cada pantalla la unidad de contratación, la
   cantidad y, en digitales, los spots por día. Las fijas muestran *«Fija · sin spots»*.
7. Si quieres, fija ahí mismo la renta al arrendador de cada sitio.

**Salió bien si:** al pie ves el cálculo en vivo: **Bruto → Divisor (comisión) → Neto →
IVA → Total c/IVA**.

**Cómo funciona el método del divisor.** El **Bruto** es la tarifa de lista. Se le resta el
descuento comercial, si lo hay, y queda la **Base**. La comisión de agencia se aplica como
divisor sobre la base y da el **Neto**, que es lo que recibe el medio. Encima va el
**IVA**, y el resultado es el **Total que paga el cliente**.

> [!note] Captura: el alta de una propuesta con el desglose económico al pie
> Estaba planificada como `04-06` y sigue pendiente.

### 6.5 · Compartir la propuesta con el cliente

**Empiezas en:** el detalle de la propuesta.

1. Pulsa **«Copiar liga»**.
2. Hazle llegar esa liga al cliente por el medio que uses. El sistema no la manda.
3. Si te la piden en papel, usa **«Generar PDF»**.
4. Pulsa **«Enviar»** para dejar la propuesta en estado **Enviada**.

**Salió bien si:** el cliente abre la liga sin cuenta y ve la propuesta con la tarjeta
**«¿Aceptas esta propuesta?»**.

El cliente escribe su nombre y cargo y acepta. La propuesta queda marcada como **«Propuesta
aceptada»**.

**El descuento comercial** se edita mientras la propuesta esté en borrador. Cambiarlo en
una propuesta ya **Enviada** sube la versión y queda registrado como renegociación. Una vez
aprobada o rechazada, el descuento queda fijo.

### 6.6 · Aprobar la propuesta

**Empiezas en:** el detalle de la propuesta.

Puedes aprobar o rechazar la propuesta entera con **«Aprobar»** / **«Rechazar»**, o ir
**sitio por sitio** con la columna **Aprobado**. El resumen **«Sobre lo aprobado»**
recalcula bruto, neto y total.

> [!warning] Antes de aprobar, el sistema avisa de los cupos
> Si alguna pantalla ya llegó a su cupo de clientes en esas fechas, el aviso lo dice y te
> deja **«¿Aprobar de todas formas?»**. Pero al reservar se rechazará salvo que se libere
> o se suba el cupo.

### 6.7 · Convertir la propuesta en campaña

> [!warning] Solo se pasan los sitios aprobados, y esto se hace una vez
> Los sitios que dejaste sin aprobar **no viajan a la campaña**: *«Solo se pueden agregar
> sitios aprobados en la propuesta de esta campaña»*. Revisa la lista antes de generar.

**Empiezas en:** la propuesta en estado **Aprobada**.

1. Pulsa el botón de generar campaña.

**Salió bien si:** el botón queda deshabilitado con el texto **«Campaña generada»** y la
campaña aparece en **«Campañas»**.

### 6.8 · Qué se puede cambiar después

| Quieres | Cómo |
|---|---|
| Alargar la campaña | **«Extender campaña»**, indicando la nueva fecha de fin |
| Registrar la orden de compra del cliente | Panel **«Registrar OC del cliente»** de la campaña |
| Adjuntar el contrato del cliente | Bloque **«Datos de facturación»** de la campaña |
| Cambiar el arte | Reemplazar el creativo (apartado 7.2) |
| Cambiar el descuento | Solo antes de aprobar la propuesta |

### 6.9 · Leer la campaña de un vistazo

**Empiezas en:** **«Campañas»** → abre una.

| Sección | Qué te dice |
|---|---|
| **Pipeline** | Dónde va la campaña. Los pasos dependen del tipo: una digital no pasa por imprenta ni por «instalada» |
| **Validación de publicación** | Solo digitales e híbridas (apartado 7.3) |
| **Candado de facturación** | Qué falta para poder facturar (apartado 8.1) |
| **Comercial** | Subtotal neto, IVA, total, agencia y si hay orden de compra recibida |
| **Datos de facturación** | Los datos fiscales del cliente y el contrato adjunto |
| **Rentabilidad** | Ingreso del medio menos costo de espacios, impresión y operación |
| **Reporte de cumplimiento** | Sitios contratados y entregados, testigos y días contratados |
| **Sitios de la campaña** | Las pantallas asignadas |
| **Imprenta** · **Órdenes de trabajo** · **Creatividades** · **Evidencias fotográficas** | El trabajo de ejecución, en su propio bloque |
| **Reproducciones (proof of play)** | Lo efectivamente reproducido, por rango de fechas |

---

## 7 · Operar: las órdenes de trabajo

### 7.1 · Levantar una orden de trabajo

**Empiezas en:** **«Operaciones»** → **«Nueva OT»**. Entran el Dueño y Operaciones.

1. Elige la **«Campaña»** y el **«Sitio»**. Solo se ofrecen los sitios reservados de esa
   campaña.
2. Elige el **«Tipo»** de tarea. El catálogo lo fija el sistema y depende del tipo de
   pantalla:

| Tarea | Dónde aplica |
|---|---|
| Montaje de lona · Herrería | Solo pantalla fija |
| Desmontaje · Mantenimiento preventivo · Mantenimiento correctivo · Eléctrico · Inspección · Otro | Fija y digital |

3. Escribe la **descripción** y la **prioridad**.
4. Pon la fecha programada y el responsable en **«Asignar a (responsable)»**.

**Salió bien si:** la orden aparece en la lista con estado **Pendiente** o **Asignada**.

> [!warning] Piensa bien a quién se la asignas
> Hoy la aplicación **no ofrece reasignar** una orden que quedó con la cuadrilla
> equivocada. Solo se puede crear con responsable y cerrarla.

> [!info] El arte de una pantalla digital no se monta
> *«El montaje digital ya no es una tarea de OT: el arte se sube con "Subir a producción"
> en la campaña.»* Si eliges una tarea que no corresponde, el sistema lo rechaza.

### 7.2 · Cargar y repartir los creativos

**Empiezas en:** **«Creativos»**, o el bloque de creatividades de la campaña.

Para subir una pieza tienes dos vías:

- **«Imagen»** — sube un archivo, máximo 5 MB.
- **«Código»** — pega el código del creativo, opcionalmente con un nombre. Antes de guardar
  puedes ver la **«Vista previa»**.

Por cada creativo tienes **«Aprobar»**, **«Rechazar»**, **«Reemplazar»**, **«Eliminar»** y,
si es código, **«Ver HTML»**.

> [!warning] Un creativo aprobado no se vuelve a aprobar
> El sistema responde *«El creativo ya fue aprobado — reemplázalo o elimínalo para
> cambiarlo.»*

**Asignarlos a las pantallas.** En **«Slots reservados»** eliges, por pantalla, el creativo
y cuántas veces al día se muestra. Para no hacerlo uno por uno, **«Repartir a todas»** los
asigna a todas las digitales de la campaña.

**Salió bien si:** cada pantalla digital de la campaña tiene un creativo aprobado asignado.

> [!warning] «Retirado · pendiente en DOOHmain»
> Significa que quitaste el creativo de SPACE OS pero su arte **sigue publicado** en el
> sistema de reproducción. Hay que quitarlo también desde allá.

### 7.3 · Publicar la campaña en las pantallas digitales

> [!danger] El envío sale a pantallas reales
> Revisa fechas y creativos antes de confirmar. Lo que se publica se ve en la calle.

**Empiezas en:** el panel **«Validación de publicación»** de la campaña.

1. Manda el arte con **«Enviada al dominio / CMS»**.
2. Comprueba el contador **«Anuncios cargados (N/M validados)»**.
3. Pulsa **«Aprobar publicación»**, o **«Rechazar»** registrando el motivo.

**Salió bien si:** la campaña queda con publicación aprobada y las reproducciones empiezan
a aparecer en el bloque de proof of play.

Si algo falta, el sistema lo dice con precisión: *«la pantalla no tiene ningún creativo
aprobado asignado»*, *«sitio sin pantalla DOOHmain mapeada»* o *«La integración con
DOOHmain está apagada»*.

Para retirar una pieza, usa **«Bajar creativo»**.

### 7.4 · Pedir la impresión

**Empiezas en:** **«Imprenta»** → **«Nueva orden»**. Entran el Dueño e Imprenta. Solo
aplica a campañas fijas o híbridas.

1. Elige la **«Campaña»** y, si aplica, el **«Sitio (opcional)»**.
2. Captura el **«Material»**, el **«Ancho (m)»** y el **«Alto (m)»**. Para contenido
   digital, deja ancho y alto en 0.
3. Indica el **«Proveedor (opcional)»**.

**Salió bien si:** la orden aparece en estado **Arte recibido**.

La orden avanza por **Arte recibido → Validado → En producción → Impreso → Listo para
montaje**, con la aprobación de la prueba de color por el camino.

### 7.5 · Cerrar una orden de trabajo desde el campo

**Empiezas en:** el teléfono de la cuadrilla, con la orden abierta desde la liga que le
pasaste.

1. Marca el **checklist** punto por punto.
2. Pulsa **«Tomar foto»** y saca la fotografía comprobatoria.
3. Pulsa **«Capturar ubicación»**.
4. Pulsa **«Cerrar OT»**.

**Salió bien si:** la pantalla cambia a **«OT cerrada»** con el texto *«La evidencia se
envió al pipeline de la campaña»*. Si con eso se completaron las condiciones, aparece
**«Candado de facturación encendido»**.

El botón de cerrar está deshabilitado hasta que las tres cosas estén hechas: *«Completa el
checklist, toma una foto y captura la ubicación.»*

> [!note] Captura: la orden de trabajo en un teléfono, con el checklist y el botón de foto
> Estaba planificada como `05-06`, necesita una orden real y una pantalla de teléfono.
> Sigue pendiente.

### 7.6 · Mover activos en el almacén

**Empiezas en:** **«Almacén»**. Entran el Dueño y Operaciones.

- **«Registrar activo»** — captura **«Etiqueta / número de inventario»**,
  **«Descripción»**, **«Tipo»** (*Pantalla*, *Estructura*, *Lona*, *Otro*) y notas.
- **«Mover»** — elige el movimiento y, si es una salida, la pantalla destino. Puedes añadir
  un motivo.

**Salió bien si:** la tabla refleja la nueva ubicación y el nuevo estado del activo.

---

## 8 · Cobrar: facturación y cobranza

**Empiezas en:** **«Finanzas»**. Entran el Dueño y Finanzas.

### 8.1 · Entender el candado de facturación

Una campaña no se puede facturar hasta que cumple sus condiciones, y cuáles son depende del
tipo:

| Tipo de campaña | Condiciones |
|---|---|
| **Fija (OOH)** | Orden de compra recibida + fotografías comprobatorias |
| **Digital (DOOH)** | Orden de compra recibida + reporte de publicación |
| **Híbrida** | Las tres |

La orden de compra la registras tú en el panel **«Registrar OC del cliente»** de la
campaña. Las fotografías las produce la cuadrilla al cerrar la orden de trabajo con fotos
(apartado 7.5). El reporte de publicación nace al aprobarse la publicación (apartado 7.3).

### 8.2 · Emitir la factura

> [!danger] Una campaña admite una sola factura y facturar pide tu contraseña
> Si alguien ya la emitió, el sistema responde *«La campaña ya tiene factura»*. Búscala en
> la tabla de cobranza en lugar de emitir otra.

**Empiezas en:** **«Finanzas»** → tarjeta **«Listas para facturar»**.

1. Pulsa **«Generar factura»** en la campaña. La ventana muestra **Subtotal (neto)**,
   **IVA** y **Total**.
2. Si el cliente paga a plazos, marca **«Cobrar en parcialidades»** y elige el número de
   cuotas, su periodicidad y la fecha de la primera. Solo se ofrecen los repartos que dan
   cuotas iguales y al menos dos; la última ajusta el redondeo.
3. Elige el **plazo de cobranza**: **60, 90 o 120 días**. Con parcialidades, el plazo pasa
   a ser informativo porque manda el calendario de cuotas.
4. Pulsa **«Emitir factura»**.
5. Confirma con tu contraseña cuando el sistema te la pida.

**Salió bien si:** la factura aparece en la tarjeta **«Cobranza»** con su folio y su fecha
de vencimiento.

La factura cubre la campaña completa, en una exhibición o repartida en parcialidades. No se
factura por tramos independientes.

Si la tarjeta **«Listas para facturar»** está vacía, te lo explica: *«Cuando una campaña
complete su candado (OC + fotos + reporte) aparecerá aquí.»*

### 8.3 · Registrar el pago del cliente

> [!warning] Esta operación pide tu contraseña
> Es una de las siete del apartado 2.6.

**Empiezas en:** **«Finanzas»** → tarjeta **«Cobranza»**.

1. Pulsa la fila de la factura. Se abre **«Registrar pago»** con el folio y el saldo.
2. Escribe el **monto del abono**.
3. Guarda y confirma con tu contraseña.

**Salió bien si:** ves *«Abono registrado»*, o *«Cobranza liquidada»* si cubriste el saldo.
Al cubrirlo todo, la cobranza pasa a **Pagada** y **se detienen los recordatorios**.

La tarjeta cuenta las facturas **Al corriente**, **Por vencer** y **Vencida**, y las lista
con **Folio · Folio fiscal · Cliente · Monto · Plazo · Vence · Estatus**.

### 8.4 · Recordarle al cliente que pague

El sistema genera los avisos de cobranza con el folio, el cliente, los días y el saldo, y
los deja en la campanita. La fila de la factura muestra cuándo se envió el último.

**Salió bien si:** la fila registra la fecha del recordatorio.

### 8.5 · Qué hacer cuando algo no cuadra

| Lo que ves | Qué significa | Qué haces |
|---|---|---|
| *«La campaña no tiene el candado de facturación completo»* | Falta la orden de compra, las fotos o el reporte de publicación | Apartado 8.1 |
| *«El cliente requiere RFC y razón social para facturar (ve a Clientes)»* | La ficha fiscal del cliente está incompleta | Apartado 6.1 |
| *«La campaña ya tiene factura»* | Alguien la emitió antes que tú | Búscala en cobranza |
| El total no coincide con la propuesta | La campaña solo trae los sitios **aprobados** de la propuesta | Revisa el bloque **Comercial** de la campaña |
| Un abono quedó mal capturado | La aplicación no ofrece deshacerlo desde la interfaz | Avisa al Dueño y déjalo por escrito; corregir un importe ya registrado es trabajo de soporte |

### 8.6 · La renta que sale hacia los arrendadores

En la misma pantalla de **«Finanzas»**, el bloque **«Renta por pagar a propietarios»** reúne
lo que sale hacia el otro lado. El registro del pago se hace desde **«Arrendadores»**
(apartado 5.6).

---

## 9 · El portal y las páginas públicas

Ni el cliente ni el arrendador necesitan cuenta. Los dos entran por una **liga** que tú les
haces llegar, y solo ven lo que esa liga abre.

> [!warning] Quien tenga la liga, entra
> Esas direcciones no piden contraseña: la liga **es** la credencial. Mándasela a la
> persona correcta y no la publiques.

### 9.1 · La propuesta que ve el cliente

**Se la das:** copiando la liga desde el detalle de la propuesta con **«Copiar liga»**.

El cliente ve el nombre de la propuesta, las fechas, el anunciante, la agencia y la
comisión; el **resumen económico**; los **sitios de la propuesta**; la ubicación de las
pantallas en el mapa; el desglose hasta el total que paga; y la tarjeta **«¿Aceptas esta
propuesta?»**.

Si la liga no corresponde a nada, ve *«Enlace no válido — Esta liga no corresponde a
ninguna propuesta.»*

### 9.2 · El portal de seguimiento de la campaña

**Se lo das:** desde la campaña, con el botón **«Portal del cliente»**, si está activo.

El cliente ve **«Avance de tu campaña»**, **«Ubicaciones»** y **«Evidencias de
instalación»**. Nada más: ni costos internos, ni rentas, ni márgenes.

### 9.3 · La firma del arrendador

**Se la das:** con **«Copiar enlace de firma»** desde el panel de firmas del contrato
(apartado 5.5).

El arrendador ve el contrato y el bloque **«Firmar electrónicamente»**.

Mensajes que puede encontrarse: *«Contrato firmado. Se registró tu firma con la fecha y
hora de este…»*, *«Este contrato ya fue firmado con este enlace.»* y *«El enlace expiró.
Pide al remitente que te envíe uno nuevo.»*

---

## 10 · Preguntas frecuentes y problemas típicos

### 10.1 · Avisos, alertas y notificaciones: son tres cosas

| | Dónde | Qué es |
|---|---|---|
| **Alertas** | Tarjeta **«Alertas»** del Dashboard | Pendientes vivos: rentas vencidas, contratos por vencer, cobranza, sitios bloqueados, órdenes de trabajo fuera de plazo |
| **Notificaciones** | La campanita de la barra superior | Hechos que ya ocurrieron: factura emitida, abono registrado, propuesta aprobada, campaña generada, publicación validada |
| **Avisos emergentes** | La esquina de la pantalla | La misma notificación, mostrada al momento mientras tienes la pestaña abierta |

La campanita muestra el número de no leídas. Cada aviso se marca como leído al pulsarlo y
te lleva al sitio correspondiente. **«Borrar todas»** archiva la lista completa.

Las notificaciones llegan solas mientras la pestaña esté visible. Si te vas a otra pestaña
dejan de consultarse y se ponen al día al volver.

Puedes apagar tipos de alerta que no quieres ver desde la tarjeta **«Alertas»**. Es una
preferencia **de tu navegador**: no cambia nada para tus compañeros.

### 10.2 · Mensajes que vas a ver, y qué hacer con ellos

| Mensaje | Qué significa | Qué haces |
|---|---|---|
| *«No se pudieron cargar los datos»* | No es que no haya datos: no se pudieron leer | Pulsa **«Reintentar»**. Si insiste, avisa a quien administra el sistema |
| *«"<pantalla>" todavía no se puede vender: su contrato de arrendamiento está incompleto»* | El caso más frecuente al reservar | Apartado 5.4 |
| *«"<pantalla>" ya está reservada en esas fechas por la campaña "<nombre>"»* | Choque de fechas en una pantalla fija | Cambia fechas o pantalla |
| *«"<pantalla>" ya llegó a su cupo de N clientes»* | Demasiados anunciantes distintos a la vez | Sube el cupo desde la ficha de la pantalla, o elige otra |
| *«La negociación con la agencia <nombre> no está validada»* | Falta validar la negociación | Apartado 6.1 |
| *«No se puede eliminar: la pantalla tiene reservas u órdenes asociadas»* | Hay trabajo colgando de esa pantalla | Resuelve o cancela lo que cuelga |
| *«Faltan N datos por capturar»* al generar el contrato | Huecos en el arrendador o en tus datos fiscales | Apartados 5.1 y 3.6 |
| *«El contrato cambió después de congelarse»* | Las firmas quedaron invalidadas | Vuelve a enviarlo a firma (apartado 5.5) |
| *«Tienes una contraseña temporal. Cámbiala en Configuración antes de seguir»* | Entraste con una contraseña de un solo uso | Apartado 2.5 |
| *«Tu usuario no tiene contraseña. Pide que te la restablezcan»* | Típico de quien entra con Google | Apartado 2.2 |
| *«El registro de cuentas nuevas está deshabilitado. Contacta al administrador»* | El alta por tu cuenta está cerrada a propósito | Pídele el usuario al Dueño |
| *«La recuperación de contraseña está deshabilitada temporalmente»* | Tu instalación no tiene correo saliente | Apartado 2.4 |
| *«No tienes permiso para esta acción»* | Tu perfil no incluye esa capacidad | Pídesela al Dueño (apartado 3.5) |
| *«Esas pantallas son de alguien más (otro operador ya las registró en la red)»* | Estás importando inventario ya registrado | Revisa el archivo de carga |

### 10.3 · El navegador me lleva a una dirección rara y no llego al login

Es un fallo conocido y **está medido**. En algunas instalaciones, al abrir la dirección de
tu empresa sin haber entrado, el navegador te manda a una dirección local que no existe en
tu equipo, y la pantalla se queda en blanco o da error.

**Mientras tanto, así entras:** escribe a mano la dirección del login de tu empresa —la que
termina en `/spaces-dooh/login/`— en lugar de la dirección corta. Desde ahí todo funciona
con normalidad.

**A quién avisas:** a quien te da soporte de SPACE OS. Lo que hay que decirle es que *la
instalación está sirviendo una versión anterior al arreglo de la redirección*. Con eso
sabrá qué hacer.

### 10.4 · Me aparece una banda avisando de la licencia

Tu copia de SPACE OS tiene una licencia con fecha. Cuando se acerca el vencimiento, aparece
una banda arriba.

**Esa banda no bloquea nada.** Puedes seguir trabajando igual, también durante el periodo
de gracia posterior al vencimiento.

> [!danger] Pasado el periodo de gracia, la aplicación deja de servirse
> No es que se ponga lenta o que falle una pantalla: la dirección deja de mostrar SPACE OS.
> Si ves la banda, avisa a quien te vende SPACE OS **antes** de que se cumpla el plazo.

### 10.5 · ¿Hay que hacer algo para actualizar?

No. Tu copia se actualiza sola de madrugada, a las 04:17, y hace una copia de seguridad de
tus datos antes de tocar nada.

### 10.6 · Otras preguntas que salen seguido

**¿Cuánto dura mi sesión?** Hasta que caduca o hasta que alguien restablece tu contraseña.
Si te saca, vuelve a entrar con normalidad.

**¿Puedo trabajar en dos organizaciones con el mismo usuario?** No. Tu usuario pertenece a
una organización. Cambiar entre organizaciones está reservado a quien administra la
plataforma.

**¿En qué moneda se ven los importes?** En pesos mexicanos, con separador de miles y dos
decimales. Los negativos van entre paréntesis: `($ 156,986.66)`. Los contratos de
arrendamiento sí admiten elegir MXN o USD al crearlos.

**¿Puedo borrar a una persona del equipo?** No se borra: se deja **Inactiva** (apartado
3.3). Su rastro en la bitácora tiene que seguir existiendo.

**¿Dónde veo quién hizo qué?** En **«Actividad»**, que filtra por fecha, hora y persona.

**¿Qué significan los estados que veo en las etiquetas de color?**

- **Pantalla** — Disponible · Reservado · tentativo · Ocupado · Bloqueado · En
  mantenimiento · Baja. En digitales verás **«N de M libres»**, **«Sin slots libres»** o
  **«Sin slots capturados»**.
- **Reserva** — Tentativa · Confirmada · Cancelada.
- **Contrato de arrendamiento** — Vigente · Por vencer · Vencido · Renovado · Cancelado ·
  **Incompleto** (pendiente de captura, no un error).
- **Pago de renta** — Pagado · Pendiente · Vencido.
- **Campaña** — Borrador · Cotización · Confirmada · Activa · Lista para facturar ·
  Completada · Cancelada.
- **Cobranza** — Al corriente · Por vencer · Vencida · Pagada.
- **Orden de impresión** — Arte recibido · Validado · En producción · Impreso · Listo para
  montaje.
- **Orden de trabajo** — Pendiente · Asignada · En proceso · Bloqueada · En revisión ·
  Completada · Rechazada · Cancelada.
- **Creatividad** — Pendiente · Validada · Rechazada.
- **Publicación** — Pendiente de validar · Publicación aprobada · Publicación rechazada.

---

## Relacionadas

[[00-Inventario/inventario-2026-09-15]] · [[08-Manuales/manual-usuario-2026-08-25]] ·
[[08-Manuales/manual-tecnico-2026-08-11]] · [[00-Indice/MOC-Proyecto]] ·
[[03-Frontend/shell-y-navegacion]] · [[03-Frontend/paginas-publicas]] ·
[[05-Flujos/flujo-login]] · [[05-Flujos/flujo-acceso-con-google]] ·
[[05-Flujos/flujo-propuesta-a-campana]] · [[05-Flujos/flujo-facturacion-y-cobranza]] ·
[[05-Flujos/flujo-orden-de-trabajo]]

---

## PENDIENTES

Preguntas concretas que este manual **no puede responder** con el inventario del 15 de
septiembre. Hay que probarlas en la aplicación o preguntárselas a quien las decidió, y la
respuesta se corrige en el inventario, no a mano aquí.

1. **¿Cómo se llaman hoy los grupos del menú lateral?** La revisión del 25 de agosto los
   nombraba Inventario, Vender, Entregar, Finanzas y Sistema. El encargo de esta corrida
   dice que el menú cambió a Comercial y Operaciones. El inventario del 15/09 lista las
   pantallas y quién entra a cada una, pero no nombra los grupos.
2. **¿Por dónde se llega a «Configuración» y quién puede entrar?** La pantalla existe, pero
   no aparece en la lista de módulos del menú. El manual anterior decía que se abre desde
   tu nombre, arriba a la derecha. No está comprobado.
3. **¿Cuántos códigos de recuperación genera el sistema, y se pueden volver a ver?** Se
   sabe que son de un solo uso y que la pantalla existe. El resto está por comprobar.
4. **¿Cuándo obliga el sistema a pasar por «Códigos de recuperación»?** El inventario dice
   que esa pantalla es salida obligatoria del control de sesión, pero no en qué situaciones
   te lleva allí.
5. **¿Cuánto dura una sesión antes de caducar?** La revisión de agosto decía 30 días. No
   está confirmado hoy.
6. **¿Cuántos intentos fallidos de entrar admite el sistema, y por cuánto tiempo bloquea?**
   La revisión de agosto daba cifras concretas; el inventario del 15/09 solo confirma que
   existe un límite en la entrada con Google.
7. **¿Sigue existiendo la entrada pública «Ver tu propuesta» donde el cliente teclea un
   código tipo `PR-A0BC4F`?** El inventario lista una pantalla de propuesta que exige
   sesión, lo que apunta a que hoy es otra cosa.
8. **¿Está encendida la recuperación de contraseña por correo en las instalaciones de
   clientes?** Depende de si cada instalación tiene servidor de correo configurado. Sin
   respuesta, el apartado 2.4 tiene que quedar en condicional.
9. **¿Puede el cliente subir su propia orden de compra desde el portal, o siempre la
   registras tú?** No está descrito.
10. **¿Cómo se reasigna una orden de trabajo que quedó con la cuadrilla equivocada?** Hoy
    la aplicación no ofrece esa acción. Falta decidir si se añade o si el procedimiento es
    cancelar y crear otra.
11. **¿Cómo se corrige un abono de cobranza mal capturado?** No hay acción en la interfaz.
    Hace falta un procedimiento escrito.
12. **«Plazos de cobranza (días)» no gobierna nada.** La lista se guarda en Administración
    y la ventana de facturar ofrece siempre 60, 90 y 120. O el ajuste debe mandar sobre esa
    ventana, o debe retirarse. Un ajuste que aparenta hacer algo y no lo hace es peor que
    no tenerlo.
13. **¿Está en uso real el módulo «Almacén»,** o es funcionalidad adelantada que todavía no
    usa nadie?
14. **¿Cuál es el catálogo oficial de tipos de licencia y de métodos de pago?** Los
    selectores los ofrecen, pero no están fijados por escrito como catálogo de negocio.
15. **¿Qué política hay para los adjuntos** —facturas y comprobantes de renta, documentos
    de contrato—: cuánto se conservan y quién puede borrarlos.
16. **¿Está encendida la subida de imágenes en las instalaciones nuevas?** El inventario
    señala que la configuración de almacenamiento de archivos no viaja en la plantilla de
    instalación, y que no se sabe si eso es deliberado. Si está apagada, la carga de
    imágenes de pantallas y creativos no funciona en una instalación recién puesta.
17. **Las capturas.** De las 32 planificadas solo hay material para tres, tomadas el 11 de
    agosto. El recuento vive en `manuales/capturas-pendientes.md`. Este manual marca con
    una nota cada sitio donde hace falta una.

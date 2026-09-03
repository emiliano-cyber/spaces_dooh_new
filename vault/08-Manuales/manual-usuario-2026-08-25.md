---
tipo: manual
estado: verificado
actualizado: 2026-08-25
tags: [manual, usuario-final, negocio]
archivos:
  - apps/web/app/(app)/login/page.tsx
  - apps/web/components/demo/shell/nav.ts
  - apps/web/components/demo/shell/Topbar.tsx
  - apps/web/components/demo/shell/DesbloqueoCambios.tsx
  - apps/web/components/demo/StatusBadge.tsx
  - apps/web/app/(app)/(shell)/inicio/page.tsx
  - apps/web/app/(app)/(shell)/inventario/page.tsx
  - apps/web/app/(app)/(shell)/arrendadores/page.tsx
  - apps/web/app/(app)/(shell)/clientes/page.tsx
  - apps/web/app/(app)/(shell)/comercial/page.tsx
  - apps/web/app/(app)/(shell)/disponibilidad/page.tsx
  - apps/web/app/(app)/(shell)/propuestas/page.tsx
  - apps/web/app/(app)/(shell)/campanas/[id]/page.tsx
  - apps/web/app/(app)/(shell)/creativos/page.tsx
  - apps/web/app/(app)/(shell)/imprenta/page.tsx
  - apps/web/app/(app)/(shell)/operaciones/page.tsx
  - apps/web/app/(app)/(shell)/almacen/page.tsx
  - apps/web/app/(app)/(shell)/finanzas/page.tsx
  - apps/web/app/(app)/(shell)/comisiones/page.tsx
  - apps/web/app/(app)/(shell)/network/page.tsx
  - apps/web/app/(app)/(shell)/integraciones/page.tsx
  - apps/web/app/(app)/(shell)/actividad/page.tsx
  - apps/web/app/(app)/(shell)/administracion/page.tsx
  - apps/web/app/(app)/(shell)/configuracion/page.tsx
---

# Manual de usuario — Space OS

Space OS lleva de punta a punta el negocio de publicidad exterior: las pantallas
que rentas, los arrendadores que te las alquilan, los clientes que te compran,
las campañas que sales a montar y el dinero que cobras.

Este manual está escrito para quien **usa** la aplicación, no para quien la
programa. Se organiza por lo que quieres lograr y nombra los controles tal como
aparecen en pantalla, entre comillas.

> [!note] Alcance y fecha
> Redactado el **2026-08-25** leyendo la aplicación tal como está hoy en la rama
> `feat/ui-base-404-atajos`. Sustituye al borrador
> [[manual-usuario-2026-08-11]], que se escribió desde el inventario y dejaba
> veinte preguntas abiertas. La mayoría están resueltas aquí; las que siguen
> abiertas se listan al final, en §14.

---

## Índice

1. [Antes de empezar](#1--antes-de-empezar)
2. [Dashboard: dónde estás](#2--dashboard-dónde-estás)
3. [Inventario: las pantallas que vendes](#3--inventario-las-pantallas-que-vendes)
4. [Arrendadores: de quién es el espacio](#4--arrendadores-de-quién-es-el-espacio)
5. [Network: la red compartida](#5--network-la-red-compartida)
6. [Vender: clientes, propuestas y reservas](#6--vender-clientes-propuestas-y-reservas)
7. [Entregar: campañas, creativos, imprenta y campo](#7--entregar-campañas-creativos-imprenta-y-campo)
8. [Cobrar: facturación, cobranza y comisiones](#8--cobrar-facturación-cobranza-y-comisiones)
9. [Sistema: integraciones, actividad y administración](#9--sistema-integraciones-actividad-y-administración)
10. [Lo que ve el cliente y lo que ve el arrendador](#10--lo-que-ve-el-cliente-y-lo-que-ve-el-arrendador)
11. [Avisos, alertas y notificaciones](#11--avisos-alertas-y-notificaciones)
12. [Diccionario de estados](#12--diccionario-de-estados)
13. [Cuando algo falla](#13--cuando-algo-falla)
14. [Lo que este manual todavía no puede responder](#14--lo-que-este-manual-todavía-no-puede-responder)

---

## 1 · Antes de empezar

### 1.1 Cómo entras

Abre la dirección de tu instancia en el navegador. La pantalla se llama
**«Iniciar sesión»** y pide dos datos: **Correo** y **Contraseña**. El botón es
**«Entrar»**.

**Pasos**

1. Escribe tu correo en **Correo**.
2. Escribe tu contraseña en **Contraseña**.
3. Pulsa **«Entrar»**.

**Qué debes ver cuando salió bien.** Entras a la pantalla que corresponde a tu
rol —el Dueño aterriza en «Dashboard»— y aparece el menú lateral con los grupos
**Inventario**, **Vender**, **Entregar**, **Finanzas** y **Sistema**.

Tu sesión dura **30 días**. Pasado ese plazo el sistema te vuelve a pedir la
contraseña.

**Entrar con Google.** Si tu instalación lo tiene activado, debajo del botón
aparece un separador **«o»** y el botón **«Continuar con Google»**. Google
**no da de alta a nadie**: solo entra si alguien ya creó tu usuario con ese
mismo correo. Si no, verás *«Esa cuenta de Google no está dada de alta. Pide a
tu administrador que te agregue.»*

**¿Olvidaste tu contraseña?** El enlace aparece solo si tu instalación tiene el
correo saliente configurado. **Hoy está apagado en producción**, porque sin
servidor de correo la aplicación diría «revisa tu bandeja» y no llegaría nada.
Mientras siga así, la única vía es pedirle a quien administra la cuenta que te
la **restablezca** (§9.2).

> [!info] Límites de reintento
> El sistema frena los intentos repetidos: **10 intentos de entrar cada 5
> minutos** por conexión, **5 desbloqueos cada 5 minutos** por usuario, **10
> intentos con Google cada 5 minutos**. Si te pasas, espera unos minutos.

### 1.2 Crear una organización

La opción **«¿No tienes cuenta? Crear cuenta»** del login **está cerrada en
producción a propósito**. Si la ves (por ejemplo, en un entorno de pruebas),
pide **Organización**, **Tu nombre**, **Correo** y **Contraseña**, y el botón es
**«Crear cuenta»**.

En producción, las organizaciones nuevas las da de alta el **administrador de la
plataforma** desde **Administración → «Organizaciones (CRMs)» → «Nueva
organización»** (§9.5). Si necesitas una, pídesela a quien administra Space OS.

### 1.3 Tu contraseña temporal (la primera vez)

Cuando alguien te crea el usuario o te restablece la contraseña, el sistema
genera una **contraseña temporal de un solo uso**. Al entrar con ella:

- El resto de la aplicación queda **cerrado**, por seguridad.
- Aterrizas directo en **Configuración**, con el aviso *«Tu contraseña es
  temporal. Cámbiala aquí abajo para volver a entrar al resto del sistema.»*
- En la tarjeta **«Mi cuenta»** escribes la **Nueva contraseña**, confirmas con
  la **Contraseña actual** (la temporal) y pulsas **«Guardar cambios»**.

**Qué debes ver cuando salió bien.** El aviso desaparece y el menú lateral vuelve
a mostrar todos tus módulos.

La contraseña debe tener **al menos 8 caracteres, con al menos una letra y un
número**.

### 1.4 El menú: el proceso, en orden

El menú lateral cuenta el negocio en el orden en que ocurre. No es una lista
alfabética: es el proceso.

| Grupo | Entradas | Para qué |
|---|---|---|
| *(sin título)* | **Dashboard** | Dónde estás hoy |
| **Inventario** | Inventario · Arrendadores · Network | El patrimonio que vendes y de quién es |
| **Vender** | Clientes · Comercial · Disponibilidad · Propuestas | A quién le vendes, qué le enseñas, si está libre, y la cotización |
| **Entregar** | Campañas · Creativos · Imprenta · Operaciones · Almacén | Lo vendido se ejecuta |
| **Finanzas** | Finanzas · Comisiones | El dinero, después de entregar |
| **Sistema** | Integraciones · Actividad · Administración | Lo que no es el proceso |

Un grupo sin entradas visibles **no pinta su título**: alguien de Operaciones ve
dos entradas, no seis encabezados vacíos.

### 1.5 Qué ve cada tipo de cuenta

| Tipo de cuenta | Qué ve en el menú |
|---|---|
| **Dueño** | Todo |
| **Comercial** | Network · Clientes · Comercial · Disponibilidad · Propuestas · Campañas · Creativos · Comisiones |
| **Operaciones** | Operaciones · Almacén |
| **Imprenta** | Imprenta |
| **Finanzas** | Finanzas |

Estos cinco son los nombres exactos que verás en la interfaz. Ya **no existe** un
tipo «Cliente»: el cliente externo no necesita cuenta, entra por una liga
pública (§10).

> [!warning] Ver un módulo no es poder hacer todo dentro de él
> Además del tipo de cuenta, cada acción concreta depende del **permiso**
> («Ver», «Crear», «Aprobar», «Facturar») que tenga tu rol sobre ese módulo. La
> matriz completa está en **Administración → «Roles y permisos»** (§9.3). Si una
> opción no te aparece o te la rechaza, pídesela a quien administra la cuenta.

### 1.6 La barra superior

De izquierda a derecha:

- **Vista de <tu rol>** — te recuerda con qué perfil estás trabajando.
- **Candado de cambios** — solo aparece si el Dueño activó el control (§1.7).
- **Campanita** — notificaciones, con el número de no leídas (§11).
- **Tu nombre** — abre el menú con **«Configuración»** y **«Cerrar sesión»**.

En pantalla pequeña, el botón de las tres rayas abre y cierra el menú lateral.

### 1.7 Cuando el sistema te pide desbloquear los cambios

El Dueño puede activar el **Control de cambios**. Con él encendido, todo lo que
mueve **dinero o catálogo** —tarifas, rentas, contratos, pagos, facturación y
borrar pantallas, clientes o arrendadores— pide que **quien lo hace vuelva a
teclear su propia contraseña**.

**Pasos**

1. Pulsa el botón **«Cambios bloqueados»** de la barra superior.
2. En la ventana **«Desbloquear cambios»**, escribe tu contraseña.
3. Pulsa **«Desbloquear»**.

**Qué debes ver cuando salió bien.** El botón cambia a **«Desbloqueado N min»**
en verde y la operación continúa. Mientras dure, no te la vuelve a pedir. El
plazo por defecto es de **15 minutos**; al terminar, el candado se cierra solo.
Pulsando el botón en verde lo vuelves a bloquear a mano.

> [!important] Aplica también al Dueño
> No es una clave compartida: cada quien confirma con **la suya**. Antes el
> Dueño estaba exento y una sesión suya olvidada abierta podía facturar sin que
> nadie confirmara nada.

El trabajo diario —crear campañas, subir creatividades, cerrar órdenes— **no**
pide desbloqueo.

Si entras con Google y nunca te pusieron contraseña, el sistema te lo dirá al
intentar desbloquear: *«Tu usuario no tiene contraseña. Pide que te la
restablezcan.»* Consíguela **antes** de necesitarla para facturar.

### 1.8 Tu cuenta: Configuración

Se abre desde **tu nombre → «Configuración»**, arriba a la derecha.

- **«Mi cuenta»** (todos los perfiles): cambia tu **Correo** y tu **Nueva
  contraseña**. Cualquiera de los dos exige escribir tu **Contraseña actual**
  para confirmar. Botón **«Guardar cambios»**.
- **«Empresa»** (solo el Dueño): el **Nombre de la empresa**, que es el que
  aparece en el menú lateral. Botón **«Guardar»**.

Todo lo demás del negocio —logotipo, IVA, plazos, datos fiscales— vive en
**Administración → «Configuración»** (§9.4), no aquí.

### 1.9 La moneda

Todos los importes se muestran en **pesos mexicanos**, con separador de miles y
dos decimales: `$ 45,000.00`. Los negativos van **entre paréntesis** —
`($ 156,986.66)` — que es la convención contable: en una columna de cifras, un
signo menos se pierde entre los dígitos.

Los contratos de arrendamiento sí admiten elegir **MXN** o **USD** al crearlos.

---

## 2 · Dashboard: dónde estás

Es la portada del Dueño. Bajo el título aparecen la **razón social** y el
**nombre comercial**, si están capturados en Administración.

**Los cuatro indicadores de arriba**

| Indicador | Qué mide |
|---|---|
| **Ingreso contratado del mes** | Lo vendido del mes, con el número de reservas confirmadas |
| **Margen** | Porcentaje y monto, con el costo total del mes. Verde a partir de 30 %, rojo por debajo de 10 % |
| **Por cobrar** | Facturas emitidas pendientes de pago |
| **Ocupación de la red** | Porcentaje de espacios ocupados, con el desglose digital / fijas |

Debajo, la franja **«Costos del mes»** los reparte en **Espacios**,
**Impresión**, **Operación** y **Total**.

**Las tarjetas**

- **«Ocupación»** — gráfica con selector **Día · Semana · Mes**.
- **«Reservas: tentativas vs confirmadas»** — cuánto valor está solo apartado y
  cuánto está cerrado.
- **«Alertas»** — hasta seis pendientes. El botón de los controles deslizantes
  abre **«Alertas a mostrar»** y te deja apagar tipos que no quieres ver:
  *Rentas vencidas*, *Contratos por vencer*, *Facturas (cobranza)*, *Sitios
  bloqueados por incidencia* y *Órdenes de trabajo (SLA)*. Es una preferencia
  **de tu navegador**: no cambia nada para tus compañeros.
- **«Tu red en el mapa»** — los pines con su leyenda: azul *Digital*, verde
  *Disponible*, rojo *Ocupado*, ámbar *Reservado*. El enlace **«Ver comercial»**
  lleva al mapa completo.
- **«Campañas por finalizar»** — las que terminan en los próximos 14 días o
  terminaron en los últimos 7. Sirve para revisar ingresos antes de que se
  enfríen.

---

## 3 · Inventario: las pantallas que vendes

Solo el **Dueño** entra aquí. La pantalla tiene cuatro pestañas:
**«Inventario»**, **«Contrato + pantalla»**, **«Carga masiva»** y **«Alta
manual»**.

### 3.1 Consultar el inventario

La pestaña **«Inventario»** es la tabla completa. Arriba, el buscador **«Buscar
pantalla, código, distrito…»** y el contador *«N de M»*.

Columnas: **Pantalla · Tipo · Ubicación · Medio · Tarifa · Disponibilidad ·
Arrendador · Renta · Cada cuándo**.

**Descargar.** Los botones **«Excel»** y **«CSV»** bajan **lo que estás viendo
filtrado**, con el mismo formato que la plantilla de carga: si buscaste
«Reforma», bajas esas pantallas.

**Editar sin salir de la tabla.** La **Tarifa** y la **Renta** se editan
pulsando sobre la celda.

**Cambio masivo.** Marca varias pantallas con la casilla de la izquierda y
aparece una barra:

1. Elige qué campo tocas: **«Tarifa»** (lo que te paga el cliente) o
   **«Renta»** (lo que le pagas al arrendador). Son cosas distintas y se eligen
   aparte a propósito.
2. Elige cómo: **«Fijar tarifa» / «Fijar renta»** (un valor exacto) o **«Ajustar
   %»** (por ejemplo `10` o `-5`).
3. Escribe el valor y pulsa **«Aplicar»**.

**Qué debes ver cuando salió bien.** Un aviso del estilo *«Renta actualizada en
N contratos»*.

> [!warning] Los contratos de predio alcanzan más de lo que marcaste
> Si alguna pantalla seleccionada cuelga de un contrato de **predio**
> compartido, la confirmación te avisa de cuántas pantallas **que no
> seleccionaste** también cambian. Léelo antes de aceptar. También se te dice
> cuántas se omiten por no tener contrato o por no tener importe capturado.

### 3.2 Dar de alta un contrato y su pantalla a la vez (recomendado)

Es la pestaña **«Contrato + pantalla»**, un asistente de tres pasos. Es la vía
recomendada porque deja la pantalla **vendible desde el primer momento**: una
pantalla sin contrato completo **no se puede reservar** (§13).

**Paso 1 — ¿A quién le rentas este espacio?**

- Elige un **Arrendador** existente, o cambia a «Nuevo» y captura **Nombre /
  razón social**, y opcionalmente **RFC**, **Teléfono** y **Correo**.
- Elige el **Predio**, o captura **Nombre del predio** y **Dirección del predio**
  (si la dejas vacía se toma la de la pantalla).

**Paso 2 — Condiciones del arrendamiento**

- **Inicio de vigencia** y **Fin de vigencia**. Puedes usar **fechas pasadas**
  para registrar contratos ya firmados.
- **Renta**, **Periodicidad del pago** y **Moneda** (MXN o USD).
- **Documento del contrato (PDF, opcional)**: hasta **8 MB**.

**Paso 3 — La pantalla**

- O eliges una pantalla ya existente **sin arrendador** (el selector te dice
  cuántas hay) y el asistente te muestra **«Datos que ya tiene»** para que
  confirmes que es la correcta.
- O capturas una nueva: **Nombre de la pantalla**, **Tipo de medio**,
  **Dirección**, **Distrito / alcaldía**, **Ciudad**, **Caras**, **Tarifa
  publicada**, **Lat/Lng** y, si es digital, **Slots** y **Duración por slot**.

Cierra con **«Crear contrato y pantalla»**.

**Qué debes ver cuando salió bien.** Vuelves a la lista con el aviso *«Contrato y
pantalla "<nombre>" creados»*.

### 3.3 Cargar muchas pantallas de una vez

Pestaña **«Carga masiva»**.

1. Si es la primera vez, pulsa **«Descargar plantilla»** y llénala. La hoja se
   llama **Sitios**.
2. Elige el **Arrendador de estas pantallas**. Es obligatorio.
3. Indica el **predio** (puedes escribir uno nuevo).
4. Opcional: **Precio de impresión por m² (pantallas estáticas)**, que se aplica
   a todas las estáticas del archivo.
5. Elige la **Codificación del archivo** si tu Excel no es UTF-8 (*Latin-1 /
   ISO-8859-1* o *Windows-1252*).
6. Opcionalmente adjunta **Imágenes (bulk)**.
7. Si alguna pantalla ya existe, elige entre **«Actualizar»** los campos
   modificados (conserva la imagen anterior si no subes otra) o **«Crear
   nueva»** con sufijo `-v2`, `-v3`…

**Qué debes ver cuando salió bien.** Un resumen con **Total · Creadas ·
Actualizadas · Advertencias · Errores** y el botón **«Ver información añadida»**.

> [!note] Con errores, la pantalla no te saca del resumen
> El detalle fila por fila —qué código falló y por qué— solo se ve ahí. Las
> advertencias sí dejan continuar: esas filas **sí entraron**.

### 3.4 Alta manual de una sola pantalla

Pestaña **«Alta manual»**, con cinco solapas.

| Solapa | Qué se captura |
|---|---|
| **Básico** | **Arrendador (dueño del espacio)**, **Renta al arrendador**, **Nombre de la pantalla**, **Dirección**, **Exhibición** (*Fija (impresa)* o *Digital (pantalla)*), **Latitud**, **Longitud**, **Tipo de pantalla**, **Estado** |
| **Especificaciones** | **Resolución ancho/alto (px)**, **Caras**, **Modalidades de contratación** (Mensual · Catorcenal) y la **Configuración de slots**: duración, total y disponibles |
| **IA/Vision** | Casilla *«Esta pantalla cuenta con tecnología de Computer Vision (IA)»* y el **ID del dispositivo AdMobilize** |
| **Precios** | **Tarifa publicada** y **Precio por m² (estáticas)** |
| **Imágenes** | **Imagen promocional**, **obligatoria**, JPG o PNG, máximo **5 MB** |

Cierra con **«Guardar pantalla»**.

> [!important] Una pantalla tiene UN solo costo: la renta al arrendador
> Por eso la renta se captura en **Básico**, junto a quién es el arrendador, y
> la solapa **Precios** no tiene ningún «costo de compra». Tener dos números
> para el mismo espacio producía márgenes que no cuadraban.

Si no capturas la renta, se puede dejar para después: el contrato queda
**pendiente** en Arrendadores. Pero hasta completarlo, **esa pantalla no se
puede reservar**.

### 3.5 La ficha de una pantalla

Se abre pulsando la pantalla desde **Comercial**. Trae **Galería**,
**Características**, **Datos comerciales** (tarifa, renta y **margen**),
**Arrendador y renta**, **Ubicación** y **Disponibilidad**.

Desde el menú de la ficha:

- **«Editar»** — nombre, tipo de medio, disponibilidad, vista, dirección,
  medidas, caras, estructura, tramo, iluminado, tarifa, arrendador, **cupo de
  clientes** y, si es digital, slots, duración, slots por hora, resolución,
  contenido, CMS y horario.
- **«Pausar por situación legal»** — pide el **Motivo** (*«Ej. Litigio del
  predio, permiso suspendido, orden de autoridad…»*). Mientras esté en pausa
  **no está disponible comercialmente**. Se revierte con **«Reanudar»**.
- **«Reubicar»** — elige el **Predio destino**. Si procede, el sistema genera la
  orden de trabajo y te lo dice: *«Pantalla reubicada · OT <folio> generada»*.
- **Eliminar** — solo si la pantalla no tiene reservas ni órdenes asociadas.

**Space Eye.** Si la pantalla tiene cámara, la ficha trae el bloque
**«Inteligencia artificial · Space Eye»**, con el estado del dispositivo (*En
línea* / *Desconectado*), la última señal y la foto, y el veredicto de la
verificación: **«Anuncio correcto»**, **«No coincide con la creatividad»** o
**«Sin verificación IA aún»**, con su porcentaje de confianza.

---

## 4 · Arrendadores: de quién es el espacio

**«El otro lado de la red · contratos, rentas y vencimientos».** La cabecera
lleva cinco contadores: **Arrendadores**, **Contratos**, **Renta mensual**,
**Por vencer** y **Renta vencida**.

Los filtros son **«Buscar arrendador, pantalla o RFC…»**, **«Todos los
arrendadores»** y **«Contratos: todos»**.

### 4.1 Dar de alta un arrendador

Botón **«Nuevo arrendador»**.

1. **Nombre / razón social** (obligatorio).
2. **RFC**, **Teléfono**, **Correo** y **Domicilio**.
3. Opcionalmente, **Datos fiscales**: **Razón social** y **Régimen fiscal**.

> [!warning] El domicilio no es opcional en la práctica
> El contrato de arrendamiento que genera el sistema lo **recita dos veces**. Si
> falta, el documento sale con huecos y **no se puede enviar a firma**.

En la tarjeta **«Arrendadores»** los campos que faltan aparecen marcados como
**«Falta»** y se pueden completar ahí mismo, sin abrir nada.

### 4.2 Razones sociales

Un mismo arrendador puede facturar a nombre de varias razones sociales, y el
contrato elige cuál usa. Se administran en la tarjeta **«Razones sociales»**, con
**Razón social**, **RFC** y **Régimen fiscal**.

### 4.3 Crear un contrato de arrendamiento

Botón **«Nuevo contrato»**: es el mismo asistente de tres pasos de §3.2
(*«Arrendador → contrato (fechas pasadas permitidas) → pantalla»*).

### 4.4 Completar un contrato incompleto

Un contrato en estado **Incompleto** es el que aún no dice qué se paga. Abre el
contrato desde la tabla y pulsa **«Completar información»**. La ventana
**«Completar contrato de arrendamiento»** pide *«los cuatro datos que faltan
para que cuente como acuerdo real»*:

1. **Arrendador** — al elegirlo se muestran su razón social, RFC, régimen,
   correo y teléfono, para que confirmes que es el correcto.
2. **Importe de la renta**.
3. **Cada cuándo se paga**.
4. **Desde** y **Hasta**.

**Qué debes ver cuando salió bien.** El contrato pasa a **Vigente** y su pantalla
deja de rebotar al reservarla.

### 4.5 Generar el contrato y mandarlo a firma

Dentro del contrato:

1. **«Generar contrato»** produce el documento con las **DECLARACIONES** y las
   **CLÁUSULAS**. Si falta algún dato, arriba aparece *«Faltan N datos por
   capturar»* y los huecos van marcados en el texto.
2. **«Imprimir o guardar como PDF»** para la copia en papel.
3. En **«Firma del contrato»**, el botón manda el documento a firma: se
   **congela** una versión y se generan las ligas.
4. **«Copiar enlace de firma»** te da la liga de cada firmante.

**Qué debes ver cuando salió bien.** El aviso *«Documento congelado y enviado a
firma»*, y después *«Enlace copiado. Envíaselo al arrendador.»*.

> [!warning] Hoy la liga la envías tú
> El sistema **no manda ese correo**: copias el enlace y se lo haces llegar por
> el medio que uses. Lo mismo vale para la liga de la propuesta y la del portal
> del cliente.

Cuando el arrendador abre la liga ve **«Firmar electrónicamente»**, escribe su
**Nombre completo** y firma. Queda una **«Constancia de firma electrónica»** con
fecha, hora y dirección IP.

> [!danger] Si el contrato cambia después de congelarse, las firmas se invalidan
> El panel lo dice: *«El contrato cambió después de congelarse. Las firmas ya no
> corresponden…»* y marca cada firma como **«Firma invalidada»**. Hay que
> **«Volver a enviar a firma (reinicia las firmas)»**.

### 4.6 Licencias y permisos

Tarjeta **«Licencias y permisos» → «Agregar»**. Pide **Tipo**, **Folio**,
**Autoridad**, **Expedición** y **Vencimiento**. *«La fecha de vencimiento es lo
que dispara el aviso»*: de ahí salen las alertas del Dashboard.

### 4.7 Pagar la renta

La tarjeta de pagos de renta lista, por pantalla: **Renta · Vence · Monto ·
Estatus · Contrato hasta · Pagado el**. Primero los vencidos.

**Pasos**

1. Pulsa el pago pendiente. Se abre **«Registrar pago»** con el periodo y el
   importe.
2. Captura **Fecha de pago** (no puede ser futura) y **Método de pago**.
3. Adjunta la **Factura del arrendador** y el **Comprobante de pago** — PDF o
   imagen, hasta el límite que indica la propia ventana.
4. Escribe **Observaciones** si hace falta y guarda.

**Qué debes ver cuando salió bien.** El periodo queda **Pagado** y los adjuntos
aparecen como **«Factura»** y **«Comprobante»** en la fila.

Si el periodo ya estaba pagado, el sistema lo rechaza: *«Este periodo ya está
pagado (…). Cancélalo antes de volver a registrarlo.»*

### 4.8 Cuadre, compromisos y rentabilidad

- **«Cuadre de renta por arrendador»** — *«Qué se le debe a cada uno y qué ya se
  le pagó. Primero quien tiene vencidos.»* Columnas: **Vencido · Pendiente ·
  Pagado · Próximo**.
- **«Renta comprometida a arrendadores»** — lo que sale cada mes por contrato
  activo, con la equivalencia mensual de las periodicidades distintas.
- **«Rentabilidad por pantalla»** — *«Margen mensual = ingreso de reservas
  vigentes − renta del arrendador. Las de margen negativo son candidatas a
  renegociar o dar de baja.»*
- **«Vigentes en Excel»** descarga los contratos vigentes.

### 4.9 Renovar, cancelar y reportar incidencias

Dentro del contrato están **«Renovar»** y la cancelación. Un contrato
**CANCELADO** no se reactiva: *«El contrato está CANCELADO; crea uno nuevo en su
lugar.»*

**«Reportar incidencia»** pide el **Tipo** (*Legal / permiso*, *Mantenimiento*,
*Vandalismo*, *Clima*, *Suspensión operativa*, *Accidente*, *Otro*) y la
**Descripción**. Mientras la incidencia esté activa, la ficha de la pantalla lo
muestra y el Dashboard lo cuenta como alerta.

---

## 5 · Network: la red compartida

Lo ven el **Dueño** y **Comercial**. Cuatro contadores: **Espacios totales**,
**En la Network**, **Programáticos** y **Tradicionales**.

- **«CMS utilizado en la Network»** — con qué sistema se opera cada espacio
  digital compartido.
- **«Reglas de comercialización por pantalla»** — **Comercialización · CMS ·
  Estatus · En Network**.
- **«Red de pantallas · toda la plataforma»** — incluye las de otros operadores:
  **Pantalla · Operador · Tipo · Ubicación · Tarifa**.

Si al importar inventario intentas registrar pantallas que ya registró otro
operador, el sistema responde: *«Esas pantallas son de alguien más (otro
operador ya las registró en la red).»*

---

## 6 · Vender: clientes, propuestas y reservas

### 6.1 Registrar un cliente o una agencia

**Clientes** — *«Catálogo de clientes y sus datos fiscales»*. Botón **«Nuevo
cliente»**.

- **Nombre del cliente**, **Tipo** (*Directo* o *Agencia*), **Correo de
  contacto**, **Teléfono**.
- Si es **Agencia**: **Comisión de la agencia (%)**.
- **IVA (%)**: se elige de las tasas que configuró el Dueño (§9.4).
- **Datos fiscales**: **RFC**, **C.P. fiscal**, **Razón social**, **Régimen
  fiscal** y **Uso de CFDI**.

> [!warning] Sin RFC y razón social no se puede facturar
> Al llegar a Finanzas el sistema lo rechaza: *«El cliente requiere RFC y razón
> social para facturar (ve a Clientes)»*.

**La negociación de la agencia.** En un cliente de tipo Agencia aparece el bloque
**«Negociación con la agencia»**, con los **Términos de la negociación** y el
interruptor **«Negociación validada»**. Mientras esté **«Negociación sin
validar»** no se pueden crear ni aprobar propuestas con esa agencia.

### 6.2 Buscar pantallas para un cliente

**Comercial** — *«Tu red en el mapa»*. Filtros: buscador **«Buscar avenida,
distrito…»**, **«Todos los tipos»**, **«Todos los distritos»**, **«Toda
disponibilidad»** (Disponible / No disponible / Bloqueado) y **«Cualquier
precio»**.

Puedes alternar entre mapa y lista, descargar las pantallas filtradas en
**Excel** o **CSV**, y abrir el detalle de cada una (§3.5). El botón **«Nueva
pantalla»** da de alta desde aquí.

### 6.3 Reservar

1. Marca las pantallas que quieres con la casilla de cada tarjeta.
2. Abre **«Reservar sitios»**.
3. Captura **Cliente**, **Nombre de campaña (opcional)**, **Inicio**, **Fin** y
   el **Tipo de campaña**:
   - **Automático** — el sistema deduce el tipo según las pantallas elegidas.
   - **Digital (DOOH)** — sin imprenta.
   - **Fijo (OOH)** — con imprenta.
   - **Híbrida** — con imprenta.
4. En las digitales, indica cuántos **slots** apartas por pantalla. La ventana
   te recuerda el loop y la duración del slot configurados.

**Qué debes ver cuando salió bien.** Las pantallas quedan en **«Reservado ·
tentativo»** (ámbar) y aparecen en la tarjeta **«Reservas tentativas»** de
Comercial, con el botón **«Confirmar»**.

> [!important] Las tentativas caducan solas a los 7 días
> Y al caducar **liberan el inventario**. Si la venta es real, confírmala.

Para alargar una campaña ya montada, usa **«Extender campaña»** e indica la
**Nueva fecha de fin**.

### 6.4 Ver qué tienes libre más adelante

**Disponibilidad** — *«Ocupación futura por catorcena o mes. Cruza reservas
vigentes (tentativas y confirmadas) contra el inventario»*.

Controles: **Desde**, la vista **Catorcena / Mes**, el número de **Periodos**
(4, 6, 8 o 12), **Buscar pantalla** y la casilla para ver solo las disponibles.

Leyenda: **Libre** · **Parcial (digital con slots)** · **Ocupado** · **borde
punteado = solo tentativa**.

### 6.5 Armar una propuesta

**Propuestas** — *«Cotizaciones con método del divisor (bruto / neto)»*. Botón
**«Nueva propuesta»**.

1. **Nombre de la propuesta**.
2. **Cliente** y, si aplica, **Agencia** (al elegirla se aplica su comisión).
3. **Desde**, la **Duración de la campaña** (número + unidad) y el **Hasta**,
   que se calcula solo pero puedes ajustar.
4. **Comisión de la agencia (%)**.
5. Elige los **Sitios**: desde la **Lista** o dibujando una **zona** sobre el
   mapa (toca un punto para agregarlo o quitarlo).
6. En **«Contratación por sitio»**, por cada pantalla: la **unidad** de
   contratación, la **cantidad**, y en digitales los **spots/día**. Las fijas
   muestran *«Fija · sin spots»*.
7. También puedes fijar ahí mismo la **Renta al arrendador** de cada sitio: a
   quién se le paga, el importe y cada cuándo.

Al pie se calcula en vivo: **Bruto → Divisor (comisión) → Neto → IVA → Total
c/IVA**.

**Cómo funciona el método del divisor.** El **Bruto** es la tarifa de lista. Se
le resta el **descuento comercial**, si lo hay, para dar la **Base**. La
**comisión de agencia** se aplica como divisor sobre la base y da el **Neto**,
que es lo que recibe el medio. Encima va el **IVA**, y el resultado es el
**Total que paga el cliente**.

### 6.6 Enviar la propuesta y que el cliente la acepte

En el detalle de la propuesta:

- **«Copiar liga»** — la dirección pública que se le manda al cliente. Él entra
  **solo por esa liga**, sin cuenta.
- **«Generar PDF»**.
- **«Enviar»** deja la propuesta en estado **Enviada**.
- **«Aprobar»** / **«Rechazar»** la cierran.
- Puedes aprobar o rechazar **sitio por sitio** con la columna **Aprobado**; el
  resumen **«Sobre lo aprobado»** recalcula bruto, neto y total.

**Descuento comercial.** Se edita mientras la propuesta esté en borrador.
Cambiarlo en una propuesta ya **Enviada** **sube la versión** (queda registrado
como renegociación). Una vez aprobada o rechazada, el descuento queda fijo.

**El cliente**, desde su liga, ve la propuesta completa y la tarjeta **«¿Aceptas
esta propuesta?»**: escribe **su nombre y cargo** y acepta. Queda marcada como
**«Propuesta aceptada»**.

También existe la entrada pública **«Ver tu propuesta»**, donde el cliente teclea
el **código** que le diste (formato `PR-A0BC4F`) en lugar de usar la liga larga.

> [!warning] Antes de aprobar, el sistema avisa de los cupos
> Si alguna pantalla de la propuesta ya llegó a su cupo de clientes en esas
> fechas, el aviso lo dice y te deja **«¿Aprobar de todas formas?»** — pero al
> reservar se rechazará salvo que se libere o se suba el cupo.

### 6.7 Convertir la propuesta en campaña

Con la propuesta **Aprobada**, el botón genera la campaña. Solo se pasan los
sitios **aprobados**: *«Solo se pueden agregar sitios aprobados en la propuesta
de esta campaña»*.

**Qué debes ver cuando salió bien.** El botón queda deshabilitado con el texto
**«Campaña generada»** y la campaña aparece en **Campañas**.

---

## 7 · Entregar: campañas, creativos, imprenta y campo

### 7.1 La campaña, de un vistazo

**Campañas** lista lo vendido, con buscador **«Buscar por nombre, folio o
cliente…»** y filtro **«Todos los estados»**. Si está vacía, te lo explica: *«Las
campañas se generan al aprobar una propuesta.»*

Al abrir una campaña, el detalle trae, en este orden:

| Sección | Qué contiene |
|---|---|
| **Pipeline** | Dónde va la campaña, paso a paso. Los pasos dependen del tipo: una DOOH no pasa por imprenta ni por «instalada» |
| **Validación de publicación** | Solo digitales / híbridas (§7.4) |
| **Candado de facturación** | Las condiciones que faltan para poder facturar (§8.1) |
| **Comercial** | Subtotal (neto), IVA, Total, Agencia y si hay **OC recibida** |
| **Datos de facturación** | Los datos fiscales del cliente y el **Contrato del cliente** adjunto |
| **Rentabilidad** | Ingreso del medio − costo de espacios − impresión − operación = **Margen** |
| **Reporte de cumplimiento** | Sitios contratados / entregados, testigos (fotos) y días contratados |
| **Orden de compra** | Folio ODC, número de OC del cliente, monto, fecha y documento |
| **Sitios de la campaña** | Las pantallas asignadas |
| **Imprenta** | Sus órdenes de impresión |
| **Órdenes de trabajo** | Las OT de campo |
| **Creatividades** | Los creativos, que se pueden subir desde aquí |
| **Evidencias fotográficas** | Las fotos que dejó la cuadrilla al cerrar la OT |
| **Reproducciones (proof of play)** | Consulta por rango de fechas de lo efectivamente reproducido |

Si la campaña incluye pantallas con cámara, arriba aparece el aviso *«Esta
campaña incluye N pantallas con IA · medición de audiencia (AdMobilize)»*.

Si el portal del cliente está activo, el botón **«Portal del cliente»** abre lo
que él ve (§10.2).

### 7.2 Cargar los creativos

Se hace desde **Creativos** o desde la propia campaña. Dos vías:

- **«Imagen»** — sube un archivo, máximo **5 MB**.
- **«Código»** — pega el **código del creativo (HTML/UTF)**, opcionalmente con
  un **Nombre del creativo**. Antes de guardar puedes ver la **«Vista previa»**:
  *«Así se verá el creativo en la pantalla.»*

### 7.3 Aprobar y repartir los creativos

En **Creativos**, cada campaña muestra sus creativos y sus **slots reservados**.
El filtro de arriba permite ver **«Con pendientes de aprobar»**, **«Con
aprobados»**, **«Con rechazados»** o **«Sin creativos todavía»**.

Por cada creativo: **«Aprobar»**, **«Rechazar»**, **«Reemplazar»**,
**«Eliminar»** y, si es código, **«Ver HTML»** (con descarga en `.html`).

Un creativo **ya aprobado** no se puede volver a aprobar: *«El creativo ya fue
aprobado — reemplázalo o elimínalo para cambiarlo.»*

**Asignar a cada pantalla.** En **«Slots reservados»** eliges, por pantalla, el
**Creativo del sitio** y cuántas **veces** al día se muestra. Para no hacerlo uno
por uno, el botón **«Repartir a todas»** los asigna a todas las digitales de la
campaña.

> [!warning] «Retirado · pendiente en DOOHmain»
> Esa etiqueta significa que el creativo se quitó de Space OS pero su arte
> **sigue publicado** en DOOHmain. Hay que quitarlo desde el panel de DOOHmain.

### 7.4 Publicar la campaña en las pantallas

En el detalle de la campaña, el panel **«Validación de publicación»** lleva la
secuencia:

1. **«Enviada al dominio / CMS»** — el arte sale hacia DOOHmain.
2. **«Anuncios cargados (N/M validados)»** — cuántos creativos quedaron
   validados.
3. **«Aprobar publicación»** o **«Rechazar»**. Al rechazar se registra el
   **Motivo**, que queda a la vista.

Para retirar una pieza, **«Bajar creativo»** *(finaliza su campaña en
DOOHmain)*.

Si algo falta, el sistema lo dice con precisión: *«la pantalla no tiene ningún
creativo aprobado asignado»*, *«sitio sin pantalla DOOHmain mapeada»* o *«La
integración con DOOHmain está apagada»*.

**Reproducciones (proof of play).** Elige **Desde** y **Hasta** y consulta. Si la
campaña no está publicada: *«Esta campaña no está publicada en DOOHmain: no hay
reproducciones que consultar.»*

### 7.5 Pedir la impresión

**Imprenta** — *«Órdenes de impresión · del arte al montaje»*. Solo aplica a
campañas **fijas (OOH) o híbridas**.

Botón **«Nueva orden»**: **Campaña**, **Sitio (opcional)**, **Material** (*«Lona
front, vinil, contenido digital…»*), **Ancho (m)**, **Alto (m)** y **Proveedor
(opcional)**. *«Deja ancho y alto en 0 para contenido digital.»*

La orden avanza por los estados **Arte recibido → Validado → En producción →
Impreso → Listo para montaje**, con la aprobación de la **prueba de color** por
el camino.

### 7.6 Levantar una orden de trabajo

**Operaciones** — *«Tareas de cuadrilla · seguimiento de campo»*, con los filtros
**Todas · Pendientes · Asignadas · En proceso · Completadas**.

Botón **«Nueva OT»**:

1. **Campaña** y **Sitio** (solo se ofrecen los sitios reservados de esa
   campaña).
2. **Tipo** de tarea. El catálogo lo fija el sistema y **depende del tipo de
   pantalla**:

| Tarea | Dónde aplica |
|---|---|
| Montaje de lona | solo pantalla fija |
| Herrería | solo pantalla fija |
| Desmontaje · Mantenimiento preventivo · Mantenimiento correctivo · Eléctrico · Inspección · Otro | fija y digital |

3. **Descripción**, **Prioridad**, fecha programada y **Asignar a
   (responsable)**.

> [!note] El «montaje digital» ya no es una OT
> El arte de una digital se sube desde la campaña, no montando nada: *«El
> montaje digital ya no es una tarea de OT: el arte se sube con "Subir a
> producción" en la campaña.»* Si eliges una tarea que no corresponde, el
> sistema lo rechaza: *«Esa tarea no aplica a una pantalla digital (no lleva
> lona ni herrería).»*

### 7.7 Cerrar una orden de trabajo desde el campo

La cuadrilla abre la orden desde su teléfono (la misma vista que en escritorio,
sin el menú). Tiene tres bloques y un botón:

1. **Checklist** — se marca punto por punto.
2. **Fotografía comprobatoria** — botón **«Tomar foto»**.
3. **Sello de ubicación** — botón **«Capturar ubicación»**.
4. **«Cerrar OT»**.

El botón está deshabilitado hasta que las tres cosas estén: *«Completa el
checklist, toma una foto y captura la ubicación.»*

**Qué debes ver cuando salió bien.** La pantalla cambia a **«OT cerrada»** con el
texto *«La evidencia se envió al pipeline de la campaña»*, y si con eso se
completaron las condiciones, aparece **«Candado de facturación encendido»**.

### 7.8 Mover activos en el almacén

**Almacén** — *«Activos físicos (pantallas, estructuras) y sus traslados»*.

- **«Registrar activo»**: **Etiqueta / número de inventario**, **Descripción**,
  **Tipo** (*Pantalla*, *Estructura*, *Lona*, *Otro*) y **Notas**.
- **«Mover»**: elige el **Movimiento** y, si es una salida, la **Pantalla
  destino** (*«Para instalar (salida) indica la pantalla destino»*). Puedes
  añadir un **Motivo / nota**.

La tabla lleva **Etiqueta · Descripción · Tipo · Estado · Ubicación**.

---

## 8 · Cobrar: facturación, cobranza y comisiones

### 8.1 El candado de facturación

Una campaña **no se puede facturar** hasta que cumple sus condiciones. Cuáles,
depende del tipo:

| Tipo de campaña | Condiciones |
|---|---|
| **Fija (OOH)** | Orden de compra recibida + **Fotografías comprobatorias** |
| **Digital (DOOH)** | Orden de compra recibida + **Reporte de publicación** |
| **Híbrida** | Las tres |

- La **orden de compra** se registra en el panel **«Registrar OC del cliente»**
  de la campaña: **Número de OC del cliente**, **Monto (opcional)** y fecha.
- Las **fotografías comprobatorias** y el **reporte de publicación** los produce
  la operación: la cuadrilla al cerrar la OT con fotos, y la validación de
  publicación al aprobarse.

### 8.2 Emitir la factura

**Finanzas** — *«Facturación, cobranza y renta a arrendadores»*. La tarjeta
**«Listas para facturar»** muestra las campañas con el candado completo. Si está
vacía te lo dice: *«Cuando una campaña complete su candado (OC + fotos +
reporte) aparecerá aquí.»*

**Pasos**

1. Pulsa **«Generar factura»** en la campaña.
2. La ventana muestra **Subtotal (neto)**, **IVA** y **Total**.
3. Opcionalmente marca **«Cobrar en parcialidades»** y elige el número de cuotas
   y su periodicidad, más la fecha de la primera. Solo se ofrecen los repartos
   que dan cuotas iguales y al menos dos; la última ajusta el redondeo.
4. Elige el **Plazo de cobranza**: **60, 90 o 120 días**. Con parcialidades el
   plazo pasa a ser informativo, porque manda el calendario de cuotas.
5. Pulsa **«Emitir factura»**.

> [!warning] Los tres plazos son fijos, no los que configuraste
> **Administración → «Plazos de cobranza (días)»** guarda una lista, pero esta
> ventana **no la lee**: ofrece siempre 60, 90 y 120. Si añades un plazo allí,
> aquí no aparecerá. Está anotado como pendiente en §14.

**La factura cubre la campaña completa**, en una sola exhibición o repartida en
parcialidades. No se factura «por tramos» de forma independiente.

> [!note] Solo una factura por campaña
> Si alguien ya la emitió, el sistema responde *«La campaña ya tiene factura»*.
> Búscala en la tabla de **Cobranza** en vez de emitir otra.

### 8.3 Cobrar

La tarjeta **«Cobranza»** cuenta las facturas **Al corriente**, **Por vencer** y
**Vencida**, y las lista con **Folio · Folio fiscal · Cliente · Monto · Plazo ·
Vence · Estatus**.

**Registrar un pago**

1. Pulsa la fila. Se abre **«Registrar pago»** con el folio y el saldo.
2. Escribe el **Monto del abono**.
3. Guarda.

**Qué debes ver cuando salió bien.** *«Abono registrado»*, o *«Cobranza
liquidada»* si cubriste el saldo. Al cubrirlo todo, la cobranza pasa a
**Pagada** y **se detienen los recordatorios**.

**Recordatorios.** El sistema genera avisos de cobranza con el folio, el cliente,
los días y el saldo, y los deja en la campanita. La fila muestra cuándo se envió
el último.

### 8.4 Pagar a los arrendadores

En la misma pantalla, **«Renta por pagar a propietarios»** reúne lo que sale
hacia el otro lado. El registro del pago se hace desde **Arrendadores** (§4.7).

### 8.5 Comisiones

**Comisiones** administra **las comisiones de las agencias**, no las de los
vendedores.

- **«Agencias y su comisión»** — **Agencia · Comisión (%) · Negociación ·
  Clientes**. El porcentaje se edita en línea, y la negociación se marca como
  **«Validada»** con el botón **«Validar»**.
- **«Nueva agencia»** — **Nombre de la agencia**, **Comisión de la agencia
  (%)** y la nota de negociación. *«Sin validar, no se pueden crear ni aprobar
  propuestas con esta agencia.»*
- **«Clientes y su agencia»** — a qué agencia pertenece cada cliente y qué
  comisión se le aplica. Se puede reasignar desde ahí.

---

## 9 · Sistema: integraciones, actividad y administración

### 9.1 Integraciones

*«Conectores externos · listos para enchufar credenciales.»* Cada conector se
muestra con su estado: **«Conectado»** (*«Credenciales cargadas · responde el
proveedor real»*) o **«Sin credenciales»** (*«Devuelve datos simulados»*).

Si hay alguno sin credenciales, arriba aparece el aviso: *«Hay conectores sin
credenciales: devuelven datos simulados hasta que se configuren en el
servidor.»*

La tarjeta **«Probar AdMobilize»** deja consultar un **ID del dispositivo** y
devuelve **Vehículos**, **Personas**, **Vel. prom.** y **Ventana**, marcando si
son datos simulados.

### 9.2 Actividad

*«Bitácora de acciones · quién hizo qué y cuándo.»* Se filtra por **Fecha**,
**Hora** (por franja horaria) y **Quién**, con el botón **«Limpiar»** y el
contador *«N de M»*. Se pagina de 25 en 25.

### 9.3 Usuarios, roles y permisos

**Administración** — *«Usuarios, roles y configuración del negocio»*. Tres
pestañas: **«Usuarios»**, **«Roles y permisos»** y **«Configuración»**.

**Crear un usuario.** Botón **«Invitar usuario»** → ventana **«Crear usuario»**:
**Nombre**, **Correo**, **Cargo**, **Rol** y **Contraseña**. Si Google está
disponible, puedes marcar *«Entra con su cuenta de Google»* y entonces no hace
falta contraseña — su correo de Google debe ser el mismo que escribiste.

**Cambiar el rol o activar/desactivar.** En la tabla **«Equipo»**, el rol se
cambia con el selector y el estatus alternando entre **Activo** e **Inactivo**.
No puedes cambiar tu propio rol ni desactivarte a ti mismo.

**Restablecer la contraseña de otra persona.** Botón **«Cambiar»** de su fila:

1. El sistema te pide confirmar con **tu** contraseña (*«Vas a cambiar el acceso
   de <nombre>, y la bitácora tiene que poder probar que fuiste tú»*).
2. Pulsa **«Restablecer contraseña»**.
3. Se muestra **una sola vez** la contraseña temporal. Cópiala y entrégasela por
   un medio seguro.

> [!danger] La temporal no se puede volver a ver
> *«En la base solo queda su huella.»* Además se **cierran las sesiones
> abiertas** de esa persona y el sistema le pedirá cambiarla en cuanto entre. Tú
> no eliges su contraseña ni conservas una que siga sirviendo.

Para la tuya, el botón dice **«Cambiar la mía»** y exige la contraseña actual.

**La matriz de permisos.** En **«Roles y permisos»**, la tabla **«Permisos por
rol y módulo»** cruza módulos y roles. Cada celda muestra las capacidades
concedidas: **V** (Ver), **C** (Crear), **A** (Aprobar), **F** (Facturar).

Bajo el nombre de cada módulo se listan **las áreas que abre**: marcar
`comercial` concede además Clientes, Propuestas y Campañas. Las áreas marcadas
con `*` no tienen API propia — ocultarles el menú **no** protege el dato; lo
protege el permiso.

En esa misma pestaña vive el **«Control de cambios»** (§1.7), con **«Activar el
control de cambios»** / **«Desactivar el control»**.

### 9.4 Configurar el negocio

Pestaña **«Configuración»** de Administración. Solo el Dueño.

| Tarjeta | Qué se ajusta |
|---|---|
| **Identidad de la empresa** | **Logo** (PNG, JPG, WebP o SVG, máx. 2 MB), **Nombre de la empresa**, **Razón social**, **Nombre comercial** y la **Moneda** (fija: peso mexicano) |
| **Correo de avisos** | El **Correo de la organización** al que responden los avisos de operación |
| **Datos fiscales para contratos** | **RFC**, **Representante legal**, **Domicilio fiscal** y **Datos de constitución** — con los que tu empresa comparece como **parte arrendataria** |
| **IVA(s) con los que trabaja** | Las tasas disponibles para facturar. La aplicada se elige por cliente |
| **Reproducción digital (loop)** | **Tamaño del loop (seg)**, **Duración por slot (seg)** y los **Slots por loop** que resultan |
| **Cupo de clientes por pantalla** | Cuántos anunciantes distintos pueden compartir una pantalla a la vez. Vacío = sin límite |
| **Plazos de cobranza (días)** | Una lista de plazos. **Hoy no gobierna nada**: al facturar se ofrecen siempre 60, 90 y 120 (§8.2) |
| **Tipos de tarea de cuadrilla** | Solo lectura: los fija el sistema |

**Dónde se usa el logo:** en el menú lateral, en el contrato impreso, en la
propuesta que ve el cliente y en los correos de aviso.

> [!warning] El correo de avisos no es desde dónde salen los correos
> Antes de guardarlo, la aplicación te lo explica en una ventana que hay que
> confirmar: los avisos **salen del servidor de correo de la plataforma**, a
> nombre de tu organización, y **las respuestas llegan a esa dirección**. En la
> bandeja de enviados de esa cuenta no vas a ver nada. Las contraseñas y las
> invitaciones siguen saliendo del correo de la plataforma.

> [!note] El loop global es una referencia, no la regla
> Lo que se aparta en una campaña son **los slots de cada pantalla**. Si alguna
> tiene su propio número, manda el suyo, y la propia tarjeta te dice cuántas
> difieren y con qué valores.

> [!note] Sobre el cupo de clientes
> Un cliente que **ya está** en la pantalla puede seguir metiendo campañas
> mientras le queden slots; el cupo solo frena al **cliente nuevo**. Cada
> pantalla puede llevar su propio valor desde su ficha en Comercial.

### 9.5 Organizaciones (CRMs)

Panel reservado al **administrador de la plataforma**, arriba del todo en
Administración. Cada organización es *«un CRM propio con sus datos y sus
usuarios aislados»*.

- **«Nueva organización»** — **Nombre de la organización**, **Nombre del
  Dueño**, **Su correo** y su **Contraseña** (o la casilla de Google).
- **«Entrar»** cambia a esa organización; **«Volver a mi CRM»** regresa.

Si no eres administrador de plataforma, el panel te lo dice en lugar de
esconderse: *«Crear organizaciones y cambiar entre ellas está reservado al
administrador de la plataforma. Tu usuario administra su propia organización, no
el conjunto.»*

---

## 10 · Lo que ve el cliente y lo que ve el arrendador

Ninguno de los dos necesita cuenta. Los dos entran por una **liga** que tú les
haces llegar.

### 10.1 La propuesta del cliente

La liga se copia desde el detalle de la propuesta (**«Copiar liga»**). El
cliente ve el nombre de la propuesta, las fechas, el anunciante, la agencia y la
comisión; el **Resumen económico**; los **Sitios de la propuesta**; la
**Ubicación de las pantallas** en el mapa; el desglose hasta el **Total que paga
el cliente**; y la tarjeta **«¿Aceptas esta propuesta?»**.

Alternativa: la pantalla pública **«Ver tu propuesta»**, donde teclea el
**código** (`PR-A0BC4F`).

Si la liga no corresponde a nada: *«Enlace no válido — Esta liga no corresponde a
ninguna propuesta.»*

### 10.2 El portal de seguimiento de la campaña

Se abre desde la campaña con **«Portal del cliente»**, si está activo. El cliente
ve **«Avance de tu campaña»**, **«Ubicaciones»** y **«Evidencias de
instalación»**. Nada más: ni costos internos ni márgenes.

### 10.3 La firma del arrendador

La liga se copia desde el panel de firmas (**«Copiar enlace de firma»**). El
arrendador ve el contrato y el bloque **«Firmar electrónicamente»**.

Mensajes posibles: *«Contrato firmado. Se registró tu firma con la fecha y hora
de este…»*, *«Este contrato ya fue firmado con este enlace.»* y *«El enlace
expiró. Pide al remitente que te envíe uno nuevo.»*

---

## 11 · Avisos, alertas y notificaciones

Hay tres cosas distintas y conviene no confundirlas:

| | Dónde | Qué es |
|---|---|---|
| **Alertas** | Tarjeta «Alertas» del Dashboard | Pendientes vivos: rentas vencidas, contratos por vencer, cobranza, sitios bloqueados, OT fuera de plazo |
| **Notificaciones** | Campanita de la barra superior | Hechos que ocurrieron: ODC registrada, factura emitida, abono registrado, propuesta aprobada, campaña generada, OT vencida, publicación validada, recordatorios de cobro |
| **Avisos emergentes** | Esquina de la pantalla | La misma notificación, mostrada al momento mientras tienes la pestaña abierta |

**La campanita.** Muestra el número de no leídas (o `9+`). Al abrirla, cada aviso
se marca como leído al pulsarlo y te lleva al sitio correspondiente. El botón
**«Borrar todas»** archiva la lista completa. Si no hay nada: *«Sin
notificaciones»*.

Las notificaciones llegan solas, sin recargar, mientras la pestaña esté visible;
si te vas a otra pestaña dejan de consultarse y se ponen al día al volver.

**El barrido diario de contratos.** Una vez al día, el servidor revisa todos los
contratos y crea los avisos de vencimiento —uno por contrato y motivo, sin
repetir— y manda el resumen por correo a los Dueños activos, si el correo está
configurado.

---

## 12 · Diccionario de estados

Los mismos nombres que verás en las etiquetas de colores.

**Pantalla (disponibilidad)** — Disponible · Reservado · tentativo · Ocupado ·
Bloqueado · En mantenimiento · Baja. En digitales, en vez de sí/no verás
**«N de M libres»**, o **«Sin slots libres»**, o **«Sin slots capturados»**.

**Reserva** — Tentativa · Confirmada · Cancelada.

**Contrato de arrendamiento** — Vigente · Por vencer · Vencido · Renovado ·
Cancelado · **Incompleto** (pendiente de captura, no un error).

**Pago de renta** — Pagado · Pendiente · Vencido.

**Campaña** — Borrador · Cotización · Confirmada · Activa · **Lista para
facturar** · Completada · Cancelada.

**Cobranza** — Al corriente · Por vencer · Vencida · Pagada.

**Orden de impresión** — Arte recibido · Validado · En producción · Impreso ·
Listo para montaje.

**Orden de trabajo** — Pendiente · Asignada · En proceso · Bloqueada · En
revisión · Completada · Rechazada · Cancelada.

**Creatividad** — Pendiente · Validada · Rechazada.

**Publicación** — Pendiente de validar · Publicación aprobada · Publicación
rechazada.

---

## 13 · Cuando algo falla

**«No se pudieron cargar los datos».** No es que no tengas datos: no se pudieron
leer. Usa **«Reintentar»**. Si insiste, avisa a quien administra el sistema.

**Te pide desbloquear los cambios.** Es normal en todo lo que toca dinero o
catálogo. Confirma con tu contraseña y la operación sigue (§1.7).

**«"<pantalla>" todavía no se puede vender: su contrato de arrendamiento está
incompleto. Complétalo en Arrendadores (arrendador, vigencia, importe y
periodicidad) antes de reservarla.»** Es el caso más frecuente al reservar. Ve a
**Arrendadores → «Completar información»** (§4.4).

**«"<pantalla>" ya está reservada en esas fechas por la campaña "<nombre>".
Elige otras fechas u otra pantalla.»** Choque de fechas en una pantalla fija.

**«"<pantalla>" ya llegó a su cupo de N clientes (…). Elige otras fechas, otra
pantalla, o sube el cupo de esta.»** El cupo se sube desde la ficha de la
pantalla o, en general, desde Administración (§9.4).

**«La negociación con la agencia <nombre> no está validada; valídala antes de
crear la propuesta»** — o *«…no se puede aprobar la propuesta»*. Ve a
**Comisiones** o al cliente de tipo Agencia y marca **«Negociación validada»**.

**«La campaña no tiene el candado de facturación completo».** Falta la OC, las
fotos comprobatorias o el reporte de publicación (§8.1).

**«El cliente requiere RFC y razón social para facturar (ve a Clientes)».**
Complétalos en la ficha del cliente.

**«La campaña ya tiene factura».** Búscala en Cobranza; no emitas otra.

**«Este periodo ya está pagado (…). Cancélalo antes de volver a registrarlo.»**
Un pago de renta duplicado.

**«No se puede eliminar: la pantalla tiene reservas u órdenes asociadas.»**
Primero hay que resolver o cancelar lo que cuelga de ella.

**«Faltan N datos por capturar»** al generar el contrato. Los huecos van marcados
en el documento; se rellenan en el arrendador (§4.1) y en **Administración →
«Datos fiscales para contratos»** (§9.4).

**«El contrato cambió después de congelarse»**, con las firmas invalidadas. Hay
que volver a enviarlo a firma (§4.5).

**«Tienes una contraseña temporal. Cámbiala en Configuración antes de seguir.»**
Ver §1.3.

**«Tu usuario no tiene contraseña. Pide que te la restablezcan.»** Típico de
quien entra con Google y necesita desbloquear cambios.

**«El registro de cuentas nuevas está deshabilitado. Contacta al
administrador.»** El autoregistro está cerrado a propósito (§1.2).

**«La recuperación de contraseña está deshabilitada temporalmente. Contacta al
administrador.»** No hay correo saliente configurado (§1.1).

**«No tienes permiso para esta acción.»** Tu rol no incluye esa capacidad.
Pídesela a quien administra la cuenta (§9.3).

**«Esas pantallas son de alguien más (otro operador ya las registró en la
red).»** Ocurre importando inventario que ya está en la Network.

**El sistema te saca y te pide entrar de nuevo.** Tu sesión caducó (30 días), o
alguien restableció tu contraseña, lo que cierra todas tus sesiones abiertas.

**Te pide esperar antes de reintentar.** Ver los límites de §1.1.

---

## 14 · Lo que este manual todavía no puede responder

Estas son decisiones de negocio o comportamientos que no se pueden deducir
leyendo la aplicación. Se dejan escritas para resolverlas con quien las conoce.

1. **¿Quién ocupa cada rol en la vida real y con qué frecuencia?** Sin eso, este
   manual no puede ordenar los capítulos por prioridad de uso.
2. **¿Se piensa encender el correo saliente?** Mientras no, tres cosas viven a
   mano: la liga de firma, la liga de propuesta y la del portal. Y la
   recuperación de contraseña sigue apagada.
3. **¿Una misma persona puede trabajar en más de una organización?** Hoy solo el
   administrador de la plataforma cambia de CRM; un usuario normal pertenece a
   una sola.
4. **¿Cómo se reasigna una orden de trabajo que quedó con la cuadrilla
   equivocada?** La aplicación no ofrece hoy esa acción: solo crear la OT con su
   responsable y cerrarla.
5. **¿El módulo «Almacén» está en uso real** o es funcionalidad adelantada?
6. **Los tipos de licencia y los métodos de pago** que ofrecen sus selectores no
   están documentados como catálogo de negocio: conviene fijarlos por escrito.
7. **¿Qué política hay para los adjuntos** (facturas y comprobantes de renta,
   contratos del cliente): cuánto se conservan y quién puede borrarlos.
8. **«Plazos de cobranza (días)» no lo lee nadie.** La lista se guarda en
   Administración, pero la ventana de facturar ofrece siempre 60, 90 y 120. O el
   campo debe gobernar esa ventana, o debe retirarse: dejar un ajuste que
   aparenta hacer algo y no lo hace es peor que no tenerlo. Es el mismo defecto
   que ya se corrigió con el catálogo de tareas de cuadrilla.

---

## Relacionadas

[[manual-tecnico-2026-08-11]] · [[inventario-2026-08-11]] · [[MOC-Proyecto]] ·
[[06-Operacion/convenciones]] · [[03-Frontend/shell-y-navegacion]] ·
[[05-Flujos/flujo-login]] · [[05-Flujos/flujo-propuesta-a-campana]] ·
[[05-Flujos/flujo-facturacion-y-cobranza]] · [[05-Flujos/flujo-orden-de-trabajo]]

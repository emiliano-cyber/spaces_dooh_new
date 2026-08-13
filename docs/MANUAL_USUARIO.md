# SPACE EYE — Manual de Usuario

> Para quien va a **usar** el sistema. No hace falta saber programar.
> Última revisión: 12 de agosto de 2026.

---

## Índice

1. [Qué es SPACE EYE](#1-qué-es-space-eye)
2. [Cómo funciona, en general](#2-cómo-funciona-en-general)
3. [Los tres tipos de equipo](#3-los-tres-tipos-de-equipo)
4. [Entrar al sistema](#4-entrar-al-sistema)
5. [Pantalla: Devices (lista de equipos)](#5-pantalla-devices-lista-de-equipos)
6. [Pantalla: ficha del equipo](#6-pantalla-ficha-del-equipo)
7. [Pantalla: Galería](#7-pantalla-galería)
8. [Pantalla: Gráficas](#8-pantalla-gráficas)
9. [Pantalla: Ajustar texto](#9-pantalla-ajustar-texto)
10. [Pantalla: Programación](#10-pantalla-programación)
11. [Pantalla: Campañas](#11-pantalla-campañas)
12. [Pantalla: Verificación](#12-pantalla-verificación)
13. [Menú de usuario](#13-menú-de-usuario)
14. [Flujos completos paso a paso](#14-flujos-completos-paso-a-paso)
15. [Consumo de datos: lo que cuesta cada cosa](#15-consumo-de-datos-lo-que-cuesta-cada-cosa)
16. [Problemas frecuentes y qué hacer](#16-problemas-frecuentes-y-qué-hacer)
17. [Glosario](#17-glosario)

---

## 1. Qué es SPACE EYE

SPACE EYE es un sistema para **comprobar a distancia qué se está mostrando en un espectacular**.

En cada sitio hay un equipo con cámara apuntando a la pantalla. Ese equipo toma
fotografías —solo, a horas programadas, o cuando alguien se lo pide— y las sube a
un servidor central. Desde el navegador se ven todas las fotos de todos los
sitios, se descargan como evidencia y se revisa el estado de cada equipo.

**Para qué sirve en la práctica:**

- Comprobar que la campaña de un cliente está efectivamente al aire.
- Tener evidencia fotográfica con fecha, hora y nombre del sitio.
- Detectar que un sitio dejó de funcionar sin ir a verlo.
- Ver en vivo lo que está pasando en un espectacular.

**Lo que SPACE EYE no es:** no controla la pantalla ni programa qué se muestra en
ella. Solo observa y documenta.

---

## 2. Cómo funciona, en general

```
   EN EL SITIO                    EN EL SERVIDOR                 EN TU NAVEGADOR

  ┌─────────────┐                ┌──────────────┐                ┌─────────────┐
  │   Equipo    │   fotos        │              │   fotos        │             │
  │  con cámara │ ─────────────► │  SPACE EYE   │ ─────────────► │  Dashboard  │
  │             │   telemetría   │   servidor   │   estado       │             │
  │             │ ◄───────────── │              │ ◄───────────── │             │
  └─────────────┘   órdenes      └──────────────┘   órdenes      └─────────────┘
```

1. **El equipo reporta cada minuto**: batería, señal, temperatura, red, espacio
   libre. Eso mantiene la luz de "en línea" y alimenta las gráficas.
2. **El servidor guarda todo** y envía órdenes a los equipos: *toma una foto*,
   *empieza a transmitir*, *actualízate*.
3. **Tú abres el navegador** y ves la flota, las fotos y el estado de cada sitio.

Las órdenes viajan por una conexión permanente, así que un equipo encendido
responde en segundos. Si está apagado, la orden **vence a los 10 minutos** — no
se acumula ni dispara fotos viejas cuando vuelva.

---

## 3. Los tres tipos de equipo

| Tipo | Qué es | Vista en vivo | Peso típico de foto |
|---|---|---|---|
| **Teléfono Android** | Un celular con la app SPACE EYE instalada | Sí, punto a punto | 1.2 – 3.4 MB |
| **PC con cámara IP** | Una PC en el sitio con una cámara Hikvision/HiLook | Sí, por servidor de medios | ~400 KB |
| **Raspberry Pi 5** | Mini computadora con cámara propia | Sí, por servidor de medios | ~150 – 400 KB |

**Por qué importa la diferencia:** los teléfonos aceptan ajustes de cámara *en
vivo* (mueves el zoom y el video responde al instante). La Raspberry y las PC no:
en ellos el encuadre **se guarda y la vista se reabre** para aplicarlo. La
pantalla te lo avisa cuando es el caso.

---

## 4. Entrar al sistema

Abre la dirección del servidor en el navegador. Verás la pantalla de acceso.

- **Correo y contraseña**: los que te haya dado el administrador.
- **Botón "Iniciar sesión"**: entra al dashboard.

**Sobre la sesión:** una vez dentro, el sistema te mantiene conectado. No tienes
que volver a capturar la contraseña cada semana; la sesión se renueva sola
mientras uses el sistema. Solo caduca si dejas de entrar durante 7 días.

> **Importante:** si cambias tu contraseña, **se cierra la sesión en todos los
> navegadores** de esa cuenta. Si varias personas comparten la misma cuenta,
> todas tendrán que volver a entrar.

---

## 5. Pantalla: Devices (lista de equipos)

Es la pantalla principal. Muestra una tarjeta por cada equipo de la flota.

### Qué muestra cada tarjeta

| Elemento | Qué significa |
|---|---|
| **Nombre del sitio** | El nombre que le pusiste al equipo |
| **Dirección o código** | Ubicación o código del espectacular |
| **online / offline** | Verde = reportó hace menos de un minuto. Gris = no responde |
| **Batería** | Porcentaje. Solo en equipos con batería |
| **Señal** | Calidad de la red móvil |
| **Última vez** | Cuánto hace que reportó |

### Botones

| Botón | Dónde está | Qué hace |
|---|---|---|
| **Buscar** | Arriba a la izquierda | Filtra por nombre, código o dirección |
| **Filtro** (Todos / Online / Offline / Mantenimiento) | Arriba | Muestra solo los equipos en ese estado |
| **Foto a todos** | Arriba a la derecha | Pide una foto **a toda la flota** de una vez |
| **Estrella** (al pasar el cursor) | En la tarjeta | Fija el equipo arriba de la lista |
| **Cámara** (al pasar el cursor) | En la tarjeta | Pide una foto **solo a ese equipo** |
| **Bote de basura** (al pasar el cursor) | En la tarjeta | Elimina el equipo. Pide escribir ELIMINAR |
| **Clic en la tarjeta** | — | Abre la ficha completa del equipo |

### Sobre "Foto a todos"

Manda la orden a todos los equipos que no estén dados de baja. Te dice cuántos
recibieron la orden y cuántos estaban apagados.

**Cómo se toman esas fotos:** en los teléfonos el sistema **abre la vista en vivo,
espera a que la cámara enfoque, dispara y cierra**. Tarda unos 13 segundos, y a
cambio todas las fotos salen con el mismo encuadre, la misma orientación y la
misma calidad que ves en el visor. La Raspberry y las cámaras IP la toman directo,
que en ellas es lo mismo.

> **Cuidado con el consumo:** una ronda completa gasta entre 5 y 7 MB de datos
> móviles sumando toda la flota. Úsalo cuando lo necesites, no por costumbre.
> Abrir la vista para la foto **no cuesta datos extra**: si nadie está mirando, el
> video nunca llega a transmitirse.

### Sobre eliminar un equipo

Borrar un equipo **se lleva sus fotos, su telemetría y su historial completo**, y
no hay vuelta atrás. Por eso no basta con aceptar un aviso: hay que **escribir la
palabra ELIMINAR** en el recuadro. El botón está deshabilitado hasta que la
escribas.

### Por qué la lista no se mueve

Los equipos se ordenan **alfabéticamente** y los fijados van arriba. El orden es
estable a propósito: antes se ordenaban por "última vez que reportó" y las
tarjetas se reacomodaban solas cada pocos segundos, lo que hacía muy fácil hacer
clic en el equipo equivocado.

---

## 6. Pantalla: ficha del equipo

Se abre al hacer clic en una tarjeta. Es la pantalla más completa del sistema.

### 6.1 Vista en vivo

El recuadro negro de arriba a la izquierda.

| Botón | Qué hace |
|---|---|
| **Iniciar stream** | Pide al equipo que empiece a transmitir video |
| **Detener** | Corta la transmisión |
| **Corte en m:ss** | Cuenta regresiva: la transmisión **se corta sola a los 3 minutos** |

**Por qué se corta sola:** transmitir consume datos del equipo continuamente. El
corte automático evita que una pestaña olvidada se coma el plan de datos del
sitio. Si cierras la pestaña, el servidor también lo detecta y corta.

**¿Pueden verla varias personas a la vez?** Depende del equipo:

- **Raspberry y PC con cámara IP:** sí. Te unes a la transmisión que ya está
  abierta y el sistema te dice con quién la compartes.
- **Teléfonos:** solo una persona. Si alguien más la tiene, verás un aviso
  *"Vista en uso"* con su nombre y desde hace cuánto. No es un fallo: en un
  teléfono cada espectador gasta datos móviles del sitio por separado.

**Controles sobre el video (solo teléfonos Android):**

| Control | Qué hace |
|---|---|
| Deslizador de lupa | Zoom |
| Deslizador de sol | Exposición / brillo |
| **Auto / Luz de día / Nublado…** | Balance de blancos |
| **Fijar enfoque** | Bloquea el enfoque para que no "salte" |
| **90°** | Gira el video en tu pantalla |
| **Lente normal / Gran angular** | Cambia de cámara física |
| **Fijar encuadre** | **Guarda** el lente y el zoom actuales |
| **Fijar orientación** (solo admin) | Guarda el giro del video para todos |
| Tocar el video | Enfoca en ese punto |

**Controles en Raspberry y PC con cámara IP:** solo aparecen **zoom** y
**posición** (dos deslizadores para mover el recorte a los lados y arriba/abajo).
Al soltarlos, el encuadre se guarda y **la vista se reabre sola** con un aviso
*"Aplicando el encuadre…"*. Estos equipos no aceptan ajustes instantáneos.

> **Diferencia clave que conviene entender:** el zoom y la exposición que mueves
> durante la transmisión son **temporales** (se pierden al cerrar). El botón
> **"Fijar encuadre"** es lo que los guarda de verdad y hace que se apliquen
> también a las **fotos programadas**.

**Sobre "Fijar enfoque":** en un espectacular la distancia nunca cambia, así que
el enfoque automático solo estorba — cada vez que pasa un creativo de muchos
colores la cámara vuelve a buscar foco y la imagen parece saltar. Al fijarlo, el
ajuste **se guarda en el equipo** y se aplica solo cada vez que alguien abra la
vista. Si el punto central no cae sobre la pantalla, **toca directamente sobre el
espectacular en el video**: ese punto queda guardado.

### 6.2 Acciones

| Botón | Qué hace |
|---|---|
| **Tomar foto** | Pide una foto ya. Sale un aviso "Capturando fotografía…" y la foto aparece abajo en unos segundos |
| **Editar** | Cambia nombre, código, dirección, ciudad y estado del sitio |
| **Actualizar app** | Instala la versión nueva de la app en el equipo (ver más abajo) |

### 6.3 Estado del dispositivo

Muestra lo último que reportó el equipo: batería, señal, red, operador, IP
pública, almacenamiento libre, temperatura de CPU y de batería, última conexión y
versión de la app.

**Si aparece un aviso de diagnóstico de red**, léelo: explica por qué la vista en
vivo no conecta en ese sitio. El caso más común es un equipo cuya red móvil solo
entrega direcciones IPv6; las fotos y la telemetría siguen funcionando, pero el
video no puede conectar hasta cambiar el APN.

### 6.4 Consumo de datos

Cuánto ha gastado el equipo por red móvil y por WiFi: hoy, esta semana, este mes
y en total.

> Si dice **"n/d"**, ese equipo tiene una versión de app anterior a la v0.7.0 y
> no sabe reportar consumo. Actualízalo para verlo.

### 6.5 Ajustes de imagen

Panel desplegable. Se guardan **en el equipo** y se aplican a **todas** sus
fotos, incluidas las programadas.

| Control | Para qué |
|---|---|
| Centro horizontal / vertical | A dónde apunta el recorte cuando hay zoom |
| Brillo, Contraste, Saturación, Nitidez | Ajuste fino de imagen |
| Balance de blancos | Automático o por tipo de luz |
| **Ajustar el color a mano** | Ganancias de rojo y azul (ver abajo) |
| **Hojas moradas: punto de partida** | Valores iniciales para cámaras sin filtro infrarrojo |
| **Restablecer** | Deja todo en blanco |
| **Probar** | Guarda y pide una foto para ver cómo quedó |
| **Guardar** | Guarda sin tomar foto |

> **Cada "Probar" gasta una foto de datos.** En equipos con SIM, úsalo con medida.

**Sobre las hojas moradas:** la cámara de la Raspberry no tiene filtro
infrarrojo. La vegetación refleja mucho infrarrojo y por eso las hojas salen
lavanda. **Esto no se puede corregir con los deslizadores** — está comprobado
midiendo los colores: un árbol y un muro de concreto dan la misma firma. Se
arregla con un filtro físico de corte infrarrojo. Los ajustes sí mejoran mucho el
resto de la imagen (cielo, contraste, color general).

### 6.6 Fotos recientes

Las últimas 12 fotos del equipo.

| Acción | Resultado |
|---|---|
| Clic en una foto | La abre en grande |
| **Descargar álbum** | Baja todas en un .zip, con la marca de datos aplicada |
| Botón de basura sobre la foto | Elimina esa foto (pide confirmación) |

En la vista grande puedes girar la foto y descargarla individualmente.

### 6.7 Registros del dispositivo

Lo que el equipo ha reportado: arranques, fotos capturadas, errores de cámara,
fallos de red. Se actualiza solo cada 15 segundos.

**Cuándo mirarlo:** cuando un equipo no responde como esperas. Suele decir
exactamente qué falló.

### 6.8 PlayLog — Histórico de telemetría

Gráficas del comportamiento del equipo a lo largo del tiempo.

| Control | Qué hace |
|---|---|
| Rango (24h / 7 días / 30 días / personalizado) | Periodo a mostrar |
| **Exportar CSV** | Descarga los datos para Excel |

Muestra **alertas automáticas** cuando algo se sale de rango:

| Alerta | Umbral |
|---|---|
| Temperatura de CPU alta | más de 60 °C |
| Temperatura de batería alta | más de 45 °C |
| Batería baja | menos de 20 % |
| Señal débil | peor que −105 dBm |
| Poco almacenamiento | menos de 500 MB |
| Sin reportar | más de 10 minutos |

---

## 7. Pantalla: Galería

Todas las fotos de todos los equipos, con filtros.

| Control | Qué hace |
|---|---|
| Filtro por equipo | Solo las fotos de un sitio |
| Filtro por fechas | Rango de días |
| Clic en una foto | La abre en grande |
| **Descargar** | Baja la foto con su marca de datos |

Las fotos se muestran **ya enderezadas**: si un equipo está montado al revés, el
sistema lo corrige al mostrarlas y al descargarlas, sin alterar el archivo
original guardado.

---

## 8. Pantalla: Gráficas

Vista comparativa de toda la flota: cuántos equipos hay en línea, consumo,
actividad. Útil para ver el estado general de un vistazo.

---

## 9. Pantalla: Ajustar texto

Configura **la marca de datos** que aparece sobre las fotografías (nombre del
sitio, fecha y hora).

| Control | Qué hace |
|---|---|
| **Tomar foto de referencia** | Pide una foto al equipo para usarla de fondo |
| Arrastrar el texto | Cambia su posición |
| Tamaño, peso, color | Apariencia de la letra |
| Sombra, fondo | Legibilidad sobre imágenes claras |
| Alineación, espaciado | Distribución del texto |
| **Guardar** | Aplica a ese equipo (solo admin) |

**Lo que ves es lo que sale**: la vista previa usa el mismo cálculo que la
descarga real.

> **Nota importante:** la marca **no se graba en la foto guardada**. Se dibuja al
> mostrarla y al descargarla. Así, si te equivocas en la configuración, puedes
> corregirla y las fotos viejas salen bien.
>
> Las fotos tomadas con apps anteriores a la v0.8.0 traen la marca **quemada** en
> la imagen; a esas no se les dibuja nada encima para no duplicar el texto.

---

## 10. Pantalla: Programación

Aquí se configura que las fotos **se tomen solas**.

### Crear una programación

| Campo | Qué es |
|---|---|
| **Nombre** | Cómo la vas a reconocer |
| **Aplicar a** | Todos los equipos / Un equipo / Una campaña |
| **Desde / Hasta** | Fechas de vigencia (opcional) |
| **Cuándo** | Franjas al azar / Horas exactas / Cada cierto tiempo |

### Los tres modos

**Hora al azar dentro de franjas (recomendado).** Defines franjas —por ejemplo
8:00–11:00, 13:00–16:00 y 18:00–21:00— y el sistema toma **una foto por franja,
en un minuto sorteado cada día**.

*Por qué es el recomendado:* una hora fija se puede preparar de antemano y deja
de ser evidencia. El azar puro puede amontonar todas las fotos de madrugada. Las
franjas dan lo mejor de ambos: impredecible, pero con cobertura garantizada.

**Horas exactas.** Siempre al mismo minuto. Sirve para un reporte fijo, pero como
evidencia es más débil.

**Cada cierto tiempo.** Cada N minutos. Ojo con el consumo: el formulario te
avisa cuántas fotos al día son.

### El estimado de consumo

Antes de guardar, la pantalla te dice cuántas fotos al día son y **cuántos MB al
mes** por equipo. Está calculado a 1.5 MB por foto, que es lo que pesan hoy.

### La tabla de programaciones

| Columna | Qué muestra |
|---|---|
| Nombre | — |
| Aplica a | Todos los equipos, un sitio o una campaña |
| Cuándo | Las franjas u horas configuradas |
| Próxima foto | Cuándo dispara la siguiente |
| Fotos | Cuántas ha tomado en total y esta semana |
| Estado | Activa o Pausada |

Botones por fila: **Editar**, **Pausar/Activar**, **Eliminar**.

> **Pausar** detiene las fotos sin perder la configuración. **Eliminar** pide
> escribir la palabra ELIMINAR; las fotos ya tomadas se conservan.

---

## 11. Pantalla: Campañas

Registra las campañas publicitarias: nombre, anunciante, fechas y a qué equipos
aplica. Sirve para agrupar fotos por campaña y para la verificación automática.

---

## 12. Pantalla: Verificación

Muestra el resultado de comparar las fotos contra la creatividad esperada de la
campaña. Indica si la foto es correcta, con qué confianza y por qué.

> **Pendiente de validar:** esta función requiere que la campaña tenga cargada
> una creatividad de referencia. La pantalla de Campañas actual **no permite
> subir el archivo de la creatividad**, así que en la práctica la verificación no
> se está usando hoy.

---

## 13. Menú de usuario

Arriba a la derecha, con tu nombre.

| Opción | Qué hace |
|---|---|
| **Mi perfil** | Muestra tu correo y tu rol |
| **Cambiar contraseña** | Pide la actual y la nueva (mínimo 8 caracteres) |
| **Crear usuario** (solo admin) | Da de alta una persona nueva |
| **Salir** | Cierra la sesión |

### Roles

| Rol | Puede |
|---|---|
| **admin** | Todo: fijar orientación, configurar la marca, eliminar equipos, crear usuarios |
| **operator** | Operar: pedir fotos, crear programaciones, eliminar fotos, **ajustar encuadre, color y enfoque** |
| **viewer** | Solo mirar |

> **Recomendación:** hoy casi todo el equipo comparte una sola cuenta de
> administrador. Conviene **una cuenta por persona**: si alguien cambia la
> contraseña, cierra la sesión de todos los demás.

---

## 14. Flujos completos paso a paso

### Flujo A — Dar de alta un sitio nuevo, de principio a fin

1. **Instala el equipo en el sitio** y apúntalo a la pantalla.
2. Entra al dashboard. El equipo aparece solo en la lista, con un nombre
   provisional tipo `Device a1b2c3d4`.
3. Ábrelo y pulsa **Editar**. Ponle el nombre del sitio, el código del
   espectacular y la dirección. **Guardar**.
4. Pulsa **Iniciar stream** para ver lo que capta la cámara.
5. Ajusta el **zoom** hasta que el espectacular llene bien el cuadro. Si hace
   falta, gira con **90°**.
6. Pulsa **Fijar encuadre**. *Esto es lo que hace que el encuadre valga también
   para las fotos programadas.*
7. Si es admin y el video se ve girado, pulsa **Fijar orientación** para que todos
   lo vean derecho.
8. Toca sobre el espectacular en el video y pulsa **Fijar enfoque**, para que la
   cámara no ande buscando foco con cada creativo.
9. Ve a **Ajustar texto**, elige el equipo, pulsa **Tomar foto de referencia** y
   coloca la marca donde no tape la lona. **Guardar**.
10. Vuelve a la ficha y pulsa **Tomar foto**. Comprueba abajo que salió como
    esperabas.
11. Ve a **Programación** y crea las franjas para ese sitio (o inclúyelo en la
    programación de toda la flota).

**Resultado:** el sitio queda tomando fotos solo, con su encuadre, su marca y su
horario.

### Flujo B — Sacar la evidencia de un cliente

1. Entra a **Galería**.
2. Filtra por equipo y por rango de fechas.
3. Revisa las miniaturas y abre las que sirvan.
4. **Descargar** cada una, o entra a la ficha del equipo y usa **Descargar
   álbum** para bajarlas todas en un .zip.

Las fotos salen con el nombre del sitio, la fecha y la hora impresos.

### Flujo C — Un sitio dejó de reportar

1. En la lista, la tarjeta aparece en **gris (offline)**.
2. Ábrela y mira **Última conexión**: te dice desde cuándo.
3. Baja a **Registros del dispositivo**: si el equipo alcanzó a reportar el
   problema, aquí está.
4. Mira **PlayLog** en rango de 7 días: si venía cayéndose a ratos, se ve el
   patrón.
5. Revisa **Estado del dispositivo**: batería baja, temperatura alta o
   almacenamiento lleno explican muchos casos.
6. Si nada de eso aparece, es problema de red o de corriente en el sitio y hay
   que ir físicamente.

### Flujo D — Actualizar la app de un equipo

1. Abre la ficha del equipo.
2. Si hay versión nueva, aparece el aviso y el botón **Actualizar app**.
3. Púlsalo y confirma.
4. El equipo descarga la app, **verifica que sea legítima** e instala.

> **Importante:** si el equipo **no** está configurado como *device owner*,
> alguien tiene que **confirmar la instalación en la pantalla del teléfono**. El
> aviso te lo dice antes de mandar la orden.
>
> La descarga son unos 50 MB por equipo. En equipos con SIM, conviene hacerlo
> donde haya WiFi.

---

## 15. Consumo de datos: lo que cuesta cada cosa

| Acción | Consumo aproximado |
|---|---|
| Reportes de estado (todo el día) | ~20 MB al mes por equipo |
| Una fotografía | 0.15 – 3.4 MB según el equipo |
| Vista en vivo | Continuo mientras está abierta (por eso se corta a los 3 min) |
| Actualizar la app | ~50 MB, una vez |

**Referencia real medida:** con 3 franjas diarias, un equipo pasa de ~20 MB a
~155 MB al mes. El peso varía mucho entre equipos: hay teléfonos que suben fotos
de 3.4 MB y otros de 400 KB.

**Cómo gastar menos:**
- Menos franjas al día.
- No dejar la vista en vivo abierta sin necesidad.
- Evitar "Foto a todos" por costumbre.
- Actualizar apps donde haya WiFi.

---

## 16. Problemas frecuentes y qué hacer

| Síntoma | Qué suele ser | Qué hacer |
|---|---|---|
| **El equipo aparece offline** | Sin corriente, sin red, o app detenida | Mira "Última conexión" y los Registros. Si no hay pista, hay que ir al sitio |
| **No llega la foto que pedí** | El equipo está apagado, o la cámara ocupada transmitiendo | Revisa que esté en línea. Si está transmitiendo, detén el stream y reintenta |
| **La foto sale borrosa** | Casi siempre, **zoom digital alto** | Baja el zoom y vuelve a fijar el encuadre. El zoom digital recorta y amplía: acerca pero pierde detalle |
| **La foto sale girada** | El equipo está montado al revés | Avísale al administrador; se corrige desde el sistema sin ir al sitio |
| **La vista en vivo no conecta** | Red del sitio sin IPv4, o puerto bloqueado | Mira el aviso de diagnóstico en la ficha. Si dice "Sin IPv4", hay que cambiar el APN del equipo |
| **La vista en vivo se corta sola** | Es a propósito, a los 3 minutos | Vuelve a pulsar "Iniciar stream" |
| **El consumo dice "n/d"** | App anterior a v0.7.0 | Actualiza la app del equipo |
| **No veo cambios que acabo de hacer** | Caché del navegador | **Ctrl + Shift + R** |
| **Las hojas de los árboles salen moradas** | Cámara sin filtro infrarrojo (Raspberry) | No tiene arreglo por software. Requiere filtro físico |
| **Me pide iniciar sesión otra vez** | Alguien cambió la contraseña de la cuenta compartida | Pide la contraseña nueva al administrador |

---

## 17. Glosario

| Término | Qué significa |
|---|---|
| **Creatividad / creativo** | La imagen publicitaria que se muestra en la pantalla |
| **Encuadre** | Qué parte de la escena entra en la foto (lente + zoom) |
| **Franja** | Rango de horas dentro del cual se toma una foto a hora al azar |
| **Marca de datos / overlay** | El texto con nombre, fecha y hora sobre la foto |
| **Telemetría** | Los datos de salud del equipo: batería, señal, temperatura |
| **PlayLog** | La pantalla con el histórico de telemetría |
| **Stream / vista en vivo** | Video en directo desde la cámara del sitio |
| **Device owner** | Modo de Android que permite instalar actualizaciones sin que nadie confirme |
| **Zoom digital** | Acercamiento por recorte de la imagen. No es zoom óptico: pierde detalle |
| **Offline** | El equipo lleva más de un minuto sin reportar |

---

*Si algo de este manual no coincide con lo que ves en pantalla, gana lo que ves:
avísale al equipo técnico para actualizar el documento.*

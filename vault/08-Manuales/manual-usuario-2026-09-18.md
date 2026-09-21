---
tipo: manual
estado: en-curso
actualizado: 2026-09-21
tags: [manual, usuario-final, negocio, entidades, fiscal, energia, reportes, rentabilidad, ilustrado]
archivos:
  - vault/08-Manuales/manual-usuario-2026-09-15.md
  - vault/02-Backend/entidades-fiscales.md
  - vault/02-Backend/cuestionario-bienvenida.md
  - vault/02-Backend/multi-entidad-en-uso.md
  - vault/02-Backend/energia-consumos.md
  - vault/02-Backend/reportes-rentabilidad.md
  - vault/02-Backend/reportes-dimensiones.md
  - vault/03-Frontend/pantalla-reportes.md
  - manuales/capturas-2026-09-18.spec.ts
---

# Manual de usuario — lo que entró en septiembre

## Qué cubre este manual y qué no

Este manual cubre **tres cosas nuevas** que aparecieron en SPACE OS entre el 17 y el 18 de
septiembre de 2026:

- las **razones sociales** de tu empresa, y con cuál se paga cada renta y se emite cada
  comprobante;
- la captura del **recibo de luz** de cada predio;
- los **reportes de rentabilidad**, con sus cinco formas de mirar el negocio.

Todo lo demás —entrar, el inventario, los arrendadores, las propuestas, las campañas, las
órdenes de trabajo, la facturación y la cobranza— sigue en
[[08-Manuales/manual-usuario-2026-09-15]], que no cambia.

Los nombres de botones, pantallas y avisos van **entre comillas**, tal como aparecen en
pantalla.

> [!success] 2026-09-21 · recorrido delante de la aplicación, con capturas
> Este manual se volvió a caminar completo con la base de demostración
> (`demo-rentabilidad`, sembrada con `scripts/semilla-demo.mjs`) y la app en
> `next build && next start` — **no** en `next dev`: la CSP bloqueante del
> 28/08 usa `unsafe-eval` implícitamente en modo desarrollo (Fast Refresh) y
> ese modo deja el formulario de acceso sin reaccionar, con el botón
> «Entrar» permanentemente deshabilitado. No es un defecto de este manual;
> es un defecto del entorno de desarrollo local y se reporta aparte.
>
> Las capturas están en `capturas-2026-09-18/`, junto a este archivo, y el
> guion que las toma —re-ejecutable— es
> `manuales/capturas-2026-09-18.spec.ts`. Los cinco textos entre comillas que
> quedaban por confirmar ya están confirmados **mirando la pantalla**, y
> quedan escritos donde corresponden y también en `## PENDIENTES`, al final,
> con la cita literal. Lo que no cambia: si un botón se llama distinto en tu
> instalación, manda lo que ves en tu instalación — esto se verificó contra
> UNA base de demostración, no contra la tuya.

---

## 1 · Decirle al sistema con qué razones sociales trabaja tu empresa

Una empresa de publicidad exterior casi nunca es una sola sociedad. Una paga las rentas a
los arrendadores, otra compra el equipo, otra hace los trámites con gobierno, y la
operación y las ventas a veces van juntas y a veces no.

Hasta el 17 de septiembre el sistema solo guardaba **una**. Ahora guarda las que hagas
falta, y sabe qué papel juega cada una.

Los papeles son **cinco y fijos**: arrendamientos, activos, licencias, operación y ventas.
No se pueden crear, renombrar ni borrar desde la aplicación.

### 1.1 · Contestar el cuestionario de bienvenida

**Solo si tu cuenta tiene permiso de Administración.** En la práctica, el Dueño.

**Empiezas en:** la pantalla de bienvenida, que aparece la primera vez que entras a una
instalación recién estrenada.

**Vas a conseguir:** que queden creadas tus razones sociales, cada una con su papel.

1. Contesta la primera pregunta: **«¿Tu empresa tiene varias razones sociales?»**. Responde
   sí o no.
2. Si contestaste que sí, contesta la segunda: **«¿La operación está en la misma razón
   social que comercializa o factura las ventas?»**. Responde sí o no.
3. Escribe el nombre de la razón social que corresponde a cada papel. El sistema te enseña
   solo los campos que hacen falta según lo que contestaste antes.
4. Pulsa **«Guardar y continuar»**.

Las dos primeras preguntas existen para **ahorrarte la tercera**. Esto es lo que cambia:

| Si contestas... | y luego... | tecleas |
|---|---|---|
| Una sola razón social | no se te pregunta | **un solo nombre**, que se queda con los cinco papeles |
| Varias | operación y ventas coinciden | **cuatro nombres** |
| Varias | operación y ventas separadas | **cinco nombres** |

**Salió bien si:** la pantalla deja de ofrecerte el cuestionario y te lleva a la pantalla
**«Razones sociales»**, donde ves las que acabas de crear.

> [!info] Puedes escribir la misma empresa en varios campos
> Es el caso normal, no la excepción. Si la misma sociedad paga rentas y compra activos,
> escribe su nombre en los dos campos: el sistema entiende que es **una sola** razón social
> con dos papeles, no dos.
>
> Y no le molestan las diferencias de escritura. «ACME, S.A. de C.V.» y «Acme SA de CV» son
> la misma empresa para el sistema. Lo que se guarda es **como tú lo escribiste la primera
> vez**, no una versión normalizada.

> [!warning] El cuestionario se contesta UNA vez
> En cuanto existe una razón social, el cuestionario deja de ofrecerse y ya no se puede
> volver a enviar. Lo que se cambia después se cambia en **«Razones sociales»** (apartado
> 1.2), no aquí.
>
> Y se guarda todo junto o no se guarda nada: si algo falla a la mitad, no queda ninguna
> razón social creada y puedes volver a intentarlo.

> [!note] Captura: el cuestionario de bienvenida con las tres preguntas, en el caso de
> «varias razones sociales» con operación y ventas separadas (cinco campos)

![El cuestionario de bienvenida con las tres preguntas contestadas — varias razones sociales, operación y ventas separadas — y los cinco campos de razón social debajo](capturas-2026-09-18/01-01-bienvenida-cuestionario-cinco-campos.png)
*Captura — apartado 1.1, pasos 1-3. Tomada el 2026-09-21 contra una organización sin
ninguna razón social (`scripts/reiniciar-razones-sociales.mjs` deja ese estado exacto;
aquí se hizo el borrado equivalente a mano porque el guion se niega a tocar la base
`spaces` del 5433 por nombre — ver `## PENDIENTES`).*

### 1.2 · Saltarte el cuestionario y contestarlo después

**Empiezas en:** la pantalla de bienvenida.

1. Pulsa **«Lo hago más tarde»**.

**Salió bien si:** entras a trabajar con normalidad. La aplicación funciona igual sin
razones sociales capturadas.

Nadie queda encerrado en esta pantalla. Si el dato lo tienes que preguntar a tu contador,
sáltatela y vuelve cuando lo tengas.

> [!info] Mientras no las captures, verás «Sin asignar»
> Los contratos y los comprobantes seguirán funcionando, pero saldrán sin razón social. No
> es un error: ver el apartado 4.

---

## 2 · Gestionar tus razones sociales después

**Solo si tu cuenta tiene permiso de Administración.**

**Empiezas en:** el menú lateral, entrada **«Razones sociales»**.

En esta pantalla das de alta una razón social nueva, editas las que ya tienes, les cambias
el papel, las das de baja y las vuelves a activar.

> [!note] Captura: la pantalla «Razones sociales» con el listado, los papeles de cada una y
> los avisos de papel sin dueño y papel compartido

![La pantalla «Razones sociales» con las tres razones sociales de la organización de demostración, cada una con su papel, y sin avisos: es el caso sano, con una sola dueña por papel](capturas-2026-09-18/02-01-razones-sociales-sano.png)
*Captura — apartado 2, estado sano. En la base de demostración, cada papel tiene
exactamente una dueña, así que los dos avisos de 2.2 no aparecen aquí; se muestran
provocados más abajo.*

### 2.1 · Dar de baja una razón social

1. Abre **«Razones sociales»**.
2. Localiza la razón social en el listado.
3. Dala de baja.

**Salió bien si:** desaparece del listado normal y deja de ofrecerse al asignar contratos y
comprobantes nuevos.

> [!warning] Dar de baja la única que tenía un papel deja ese papel sin dueño
> Si la sociedad que das de baja era la única que vendía, a partir de ese momento **el
> sistema deja de proponerte nada** al emitir un comprobante, y hay que elegir a mano cada
> vez. La pantalla te lo avisa, pero el efecto se nota semanas después y en otra pantalla.

La baja **no borra nada**. Los contratos y los comprobantes que ya la tenían asignada la
conservan, y la puedes volver a activar desde la misma pantalla. No hace falta capturarla
otra vez con el mismo nombre: eso crearía un duplicado, y el sistema lo rechaza.

### 2.2 · Los dos avisos de esta pantalla

| Aviso | Qué significa | Qué hacer |
|---|---|---|
| **Papel sin dueño** | Ninguna razón social activa tiene ese papel | Asígnaselo a alguna, o acepta elegir a mano cada vez |
| **Papel compartido** | Dos o más lo tienen | El sistema no propondrá ninguna: tendrás que elegir en cada documento |

Ninguno de los dos te impide trabajar. Los dos te dicen por qué el sistema deja de
sugerirte una razón social donde antes te la sugería.

> [!success] 2026-09-21 · Los dos avisos, provocados y confirmados palabra por palabra
> En la demostración cada papel tiene una sola dueña, así que hubo que forzar el estado:
> se dio de baja «Servicios DEMO Operativos» (única dueña de `OPERACION` y `LICENCIAS`,
> lo que deja esos dos papeles sin dueño) y se le añadió `ARRENDAMIENTOS` a «Publicidad
> DEMO Exterior», que ya lo tenía «Inmuebles DEMO del Centro» (papel compartido).
>
> **Papel sin dueño**, literal:
> *«Ninguna razón social activa tiene Trámites y licencias con gobierno, Operación y
> nómina. Los documentos de ese tipo van a nacer sin razón social hasta que se lo asignes
> a alguna.»*
>
> **Papel compartido**, literal:
> *«Paga las rentas a los arrendadores lo tienen dos o más. Cuando hay varias con el mismo
> papel el sistema no propone ninguna, así que habrá que elegirla a mano en cada contrato
> o comprobante.»*
>
> Cita: `apps/web/components/demo/razones-sociales/GestionEntidadesFiscales.tsx:284-303`.
> Y de paso: las etiquetas de los papeles salen **con acento** («Trámites», «Operación y
> nómina»), así que la migración `20260921_corrige_acentos_catalogo_roles_entidad.sql`
> (D8 de `docs/Supervision/ABIERTOS.md`) **ya estaba aplicada** en el entorno donde se
> hizo esta pasada.

![La pantalla «Razones sociales» con los dos avisos en ámbar: «Papel sin dueño» sobre Trámites y licencias con gobierno y Operación y nómina, y «Papel compartido» sobre Paga las rentas a los arrendadores](capturas-2026-09-18/02-02-razones-sociales-avisos.png)
*Captura — apartado 2.2, avisos provocados a propósito para esta pasada.*

---

## 3 · Decir con qué razón social se paga cada renta y se emite cada comprobante

### 3.1 · Asignar la razón social que paga un contrato de renta

**Empiezas en:** la ficha del contrato de arrendamiento.

**Vas a conseguir:** que quede escrito a nombre de qué sociedad tuya se paga esa renta.

1. Abre el contrato.
2. Busca el dato **«La paga»**.
3. Pulsa **«Cambiar»**.
4. Elige la razón social en el selector.
5. Guarda.

**Salió bien si:** **«La paga»** deja de decir «sin asignar» y muestra el nombre de la razón
social que elegiste.

> [!warning] El sistema te va a pedir tu contraseña otra vez
> Asignar la razón social que paga viaja por el mismo camino que el importe de la renta, y
> ese camino pide volver a teclear tu contraseña antes de guardar. Es el mismo candado que
> ya conoces de facturar y de registrar un pago.
>
> Si entraste con Google y nunca te pusieron contraseña, pídesela a quien administra tu
> cuenta **antes** de sentarte a asignar razones sociales.

Si el contrato está incompleto, el selector también aparece dentro de **«Completar
información»**, junto con el resto de los datos que faltan.

> [!note] Captura: la ficha de un contrato mostrando «La paga» con su botón «Cambiar», y el
> cuadro de un solo campo que se abre al pulsarlo

![La ficha del contrato de «Tlalpan G500», con «La paga: Inmuebles DEMO del Centro, S.A. de C.V.» y el enlace «Cambiar» a la derecha](capturas-2026-09-18/03-01-contrato-la-paga.png)
*Captura — apartado 3.1, paso 2.*

![El cuadro «Con cuál de tus razones sociales se paga», de un solo campo, abierto sobre la ficha del contrato tras pulsar «Cambiar»](capturas-2026-09-18/03-02-contrato-la-paga-editar.png)
*Captura — apartado 3.1, pasos 3-4.*

### 3.2 · Asignar la razón social que emite un comprobante

**Empiezas en:** la campaña que vas a facturar.

1. Abre la campaña.
2. Pulsa **«Generar factura»**.
3. Revisa la razón social emisora que trae propuesta y cámbiala si no es la correcta.
4. Confirma.

**Salió bien si:** bajo el folio del comprobante aparece **«Emite»** con el nombre de la
razón social.

> [!danger] La emisora se decide al emitir, y después no se cambia
> No existe forma de reasignar la razón social de un comprobante ya emitido. Si te
> equivocas, el documento queda emitido a nombre de quien elegiste. **Revísalo antes de
> confirmar.**

> [!info] Elegir la emisora no cambia ni un importe
> El subtotal, el impuesto y el total los sigue calculando el sistema a partir del
> presupuesto de la campaña y de la tasa del cliente. La razón social no entra en ningún
> cálculo.

### 3.3 · Por qué a veces el sistema te propone una razón social y a veces no

El sistema **no adivina**. La regla es ésta:

| Situación | Qué hace el sistema |
|---|---|
| Una sola razón social tiene el papel de arrendamientos | La propone al asignar un contrato |
| Una sola tiene el papel de ventas | La propone al emitir un comprobante |
| **Dos o más** lo tienen | **No propone ninguna**: eliges tú |
| Ninguna lo tiene | No propone ninguna |

Con dos candidatas, elegir una sería emitir a nombre de la sociedad equivocada sin que
nadie lo hubiera decidido. Por eso el sistema prefiere no proponer.

Y si el documento **ya tiene** una razón social asignada, ésa es la que se te muestra,
aunque esté dada de baja. Lo que ya decidiste manda sobre la sugerencia.

El selector te ofrece **todas** las razones sociales activas, no solo las que tienen el
papel. El papel decide la sugerencia, no lo que está permitido.

---

## 4 · «Sin asignar» no es un error

Los contratos y los comprobantes creados **antes del 17 de septiembre de 2026** no tienen
razón social, y se muestran así: **«sin asignar»**.

Es deliberado. Nadie sabe a nombre de qué sociedad se hicieron, y el sistema **no se lo
inventa**. Una razón social puesta a la ligera en un documento fiscal viejo es peor que un
hueco declarado.

Qué hacer con ellos:

- **Los contratos de renta sí se pueden asignar hacia atrás**, con el procedimiento del
  apartado 3.1. Ve haciéndolo a medida que los toques.
- **Los comprobantes ya emitidos no.** Se quedan «sin asignar» y así se muestran.

> [!info] «Razon social no disponible» es otra cosa
> Si en lugar de «sin asignar» lees **«Razon social no disponible»**, el documento **sí**
> tiene una razón social asignada: lo que pasa es que la pantalla todavía no acabó de
> cargar su nombre. Recarga la pantalla. No es lo mismo que un documento sin asignar, y por
> eso el sistema lo dice distinto.

---

## 5 · Capturar el recibo de luz

**Solo si tu cuenta tiene permiso de Operaciones.**

La regla es **un recibo por predio y por mes**. El medidor normalmente es del predio, no de
cada pantalla, así que el importe se captura una vez y el sistema lo reparte entre las
pantallas de ese predio **igual que reparte la renta**.

> [!info] Quien captura el recibo no es quien lee el reporte
> Un perfil de Operaciones teclea el recibo; el margen que ese recibo cambia lo ve un perfil
> de Finanzas o el Dueño. Son dos permisos distintos a propósito. Si capturas recibos y no
> puedes abrir el reporte de rentabilidad, no es una falla.

### 5.1 · Capturar un recibo

**Empiezas en:** la pantalla de consumo de luz.

1. Elige el predio.
2. Elige el mes al que corresponde el recibo.
3. Escribe el número de medidor, si lo tienes anotado.
4. Escribe los kilovatios-hora del recibo.
5. Escribe el importe.
6. Guarda.

**Salió bien si:** la celda de ese predio y ese mes deja de estar en ámbar y muestra el
importe, el consumo y el medidor. El contador de recibos que faltan baja en uno.

Al guardar, **el predio y el mes se quedan puestos** y las cifras se limpian. Está pensado
para capturar un lote de recibos seguidos sin volver a elegir el predio cada vez.

> [!warning] Las cifras se limpian a propósito, y conviene entender por qué
> Si el importe anterior se quedara en el campo, sería facilísimo teclear dos veces la misma
> cantidad sin darte cuenta. Un importe repetido **no da ningún error**: solo hace que el
> costo de la luz de ese mes salga más alto de lo que fue.

> [!note] Captura: la rejilla de predios por meses, con celdas capturadas y celdas en ámbar,
> y el aviso de cuántos recibos faltan

![La rejilla de predios por meses: celdas con importe y kWh capturados, celdas en ámbar con una raya para los meses sin recibo, y el aviso «Faltan 14 de 24 recibos del periodo…» sobre la tabla](capturas-2026-09-18/05-01-consumo-luz-rejilla.png)
*Captura — apartado 5.1/5.4.*

### 5.2 · Un predio con dos medidores

Si el predio tiene más de un medidor, captura **un recibo por cada uno**, con su número de
medidor anotado. El sistema los suma.

No los sumes tú en una sola línea. El total quedaría bien, pero perderías el detalle de qué
consume cada medidor.

### 5.3 · Corregir un recibo mal capturado

**No hay edición.** Si te equivocaste, borra el recibo y captúralo de nuevo.

1. Localiza el recibo en la pantalla. Cada uno se identifica por su número de medidor (o
   «sin número» si no lo tiene), debajo de la cifra, con un icono de papelera.
2. Bórralo.
3. Captúralo otra vez con las cifras correctas.

> [!warning] El borrado existe precisamente porque no puedes capturarlo dos veces
> El sistema rechaza el mismo recibo repetido, así que un importe con un cero de más se
> quedaría inflando el costo de ese mes para siempre si no pudieras borrarlo.

> [!danger] 2026-09-21 · El paso 2 dice mal las cosas: NO hay confirmación
> Verificado mirando la pantalla: al pulsar el icono de papelera, el recibo se borra **de
> inmediato**, sin ningún cuadro de diálogo que pedir aceptar. No hay «¿Seguro que quieres
> borrar…?», ni nativo del navegador ni de la aplicación. El botón, además, **no lleva un
> texto visible que diga «Borrar»**: es solo el icono y el número de medidor, con un
> `title="Borrar este recibo"` que solo se lee al pasar el mouse por encima.
>
> Esto es lo contrario de lo que dice el paso 2 arriba, y es la respuesta a la pregunta que
> este manual tenía pendiente. Se deja la corrección aquí, sin tocar el paso, porque
> corregir el cuerpo del manual es decisión de quien lo revise.
>
> Cita: `apps/web/components/demo/energia/RejillaCaptura.tsx:84-95` (el botón, sin
> `confirm()` alguno) y `apps/web/app/(app)/(shell)/energia/page.tsx:127-138` (`borrar()`,
> que llama al DELETE sin preguntar antes).
>
> **Y hay un segundo hallazgo, más grave, de permisos:** el botón de borrar se pinta igual
> para cualquier rol, pero borrar exige `exigir('operaciones', 'aprobar')`
> (`app/api/energia/consumos/[id]/route.ts:24`) y el rol OPERACIONES —el mismo al que este
> apartado dice que le toca esta pantalla— solo tiene `ver` y `crear` sobre `operaciones`,
> no `aprobar`. Un perfil de Operaciones que pulsa la papelera para corregir SU PROPIO
> error no puede: recibe 403 («No tienes permiso para esta acción») y, como ese mensaje
> comparte el mismo estado que el de «no cargó la pantalla», **la rejilla entera
> desaparece** y se sustituye por «No se pudo cargar la captura» — no un aviso junto al
> botón, sino la pantalla completa. Verificado en vivo con una cuenta OPERACIONES real.

![Con la cuenta Dueño (que sí tiene el permiso), la misma rejilla justo después de borrar un recibo: la celda de ese mes vuelve a ámbar y el contador de faltantes sube en uno, sin ningún diálogo de por medio](capturas-2026-09-18/05-02-consumo-luz-tras-borrar.png)
*Captura — apartado 5.3, tras el paso 2, con una cuenta que sí puede borrar.*

![Un perfil de Operaciones, tras pulsar «Borrar este recibo»: la rejilla entera desaparece y la pantalla muestra «No se pudo cargar la captura · No tienes permiso para esta acción»](capturas-2026-09-18/05-03-operaciones-borrar-recibo-403.png)
*Captura — hallazgo de producto, no pedida por el manual. El contador «Faltan 14 de 24»
no cambió: el borrado sí se rechazó en el servidor, pero la pantalla no lo dice así.*

### 5.4 · Ver qué recibos te faltan

Eso es lo más útil de esta pantalla, más que capturar.

La pantalla se organiza como una **rejilla de predios por meses**. Cada celda es un recibo.
Las que faltan salen **en ámbar y con una raya**, no con un cero: un «$0.00» afirmaría que
ese mes no se gastó luz, y una celda en blanco no diría nada.

Arriba verás un aviso del estilo **«Faltan 18 de 18 recibos del periodo»**.

**Salió bien si:** el aviso llega a cero y no queda ninguna celda en ámbar en el periodo que
te interesa.

> [!info] Si no falta ninguno, el sistema también te lo dice
> Lo dice en gris, no en ámbar. «No falta ninguno» y «no te lo digo» se ven igual si no hay
> texto, y eso no vale.

---

## 6 · Saber qué pantallas te están costando dinero

**Solo si tu cuenta tiene permiso de Finanzas.** En la práctica, el Dueño y el perfil de
Finanzas.

El reporte contesta una sola pregunta —qué ingresa y qué cuesta cada cosa— y te deja
mirarla de cinco formas. **No son cinco reportes**: es una pantalla con un selector.

> [!success] 2026-09-21 · Qué ve exactamente un perfil de Operaciones si lo intenta
> Verificado con una cuenta OPERACIONES real: la entrada **«Reportes» no aparece en su
> menú** —el menú de Operaciones solo trae Operaciones, Almacén y Consumo de luz—, y si
> escribe la dirección `/reportes/` a mano, **no llega a verla**. El sistema lo manda de
> vuelta a `/operaciones/`, su propio tablero, al instante y sin ningún mensaje de error:
> ni un 403 en pantalla, ni un aviso de «no tienes permiso». Simplemente nunca aparece
> Reportes, como si esa dirección no existiera para él.
>
> Esto pasa ANTES de que la pantalla llegue a pedir datos al servidor: la decide el propio
> menú (`components/demo/shell/nav.ts:138`, la entrada de Reportes solo lista
> `roles: ['DUENO', 'FINANZAS']`) y la reafirma la compuerta de la aplicación
> (`components/demo/shell/compuerta.ts:59-66` y `AuthGate.tsx:73`, que redirige a
> `landingDeRol(rol)` en cuanto detecta que el rol no alcanza el módulo de la ruta).

![Un perfil de Operaciones tras intentar abrir /reportes/: termina en su propio tablero «Vista de Operaciones», con el menú lateral mostrando solo Operaciones, Almacén y Consumo de luz — sin Reportes y sin ningún mensaje de error](capturas-2026-09-18/07-01-operaciones-intenta-reportes.png)
*Captura — respuesta al pendiente 6, apartado 6.*

### 6.1 · Sacar el reporte

**Empiezas en:** el menú lateral, en la entrada de reportes.

1. Abre la pantalla de reportes.
2. Elige cómo quieres mirar: por pantalla, por trimestre, por operación, por metro cuadrado
   o por consumo de luz.
3. Ajusta las fechas de **«desde»** y **«hasta»** si el periodo que trae no es el que
   quieres.
4. Elige si quieres el desglose por mes o por trimestre.

**Salió bien si:** aparece la tabla con una fila por pantalla —o por trimestre, según lo que
elegiste—, los indicadores de arriba con el ingreso, el costo y el margen, y el pie con los
totales.

Las fechas **no traen valor por omisión más allá del periodo de apertura**, y son
obligatorias. Si pones un rango al revés, el sistema te lo dice y no calcula.

> [!note] Captura: la pantalla de reportes abierta, con el selector de las cinco miradas, el
> rango de fechas, los indicadores de arriba y la tabla

![La pantalla «Reportes de rentabilidad» recién abierta: el selector «Agrupar» en «Por pantalla», el rango 01/07/2026-30/09/2026, los cuatro indicadores de arriba, el aviso ámbar de periodo en curso y la tabla con sus seis pantallas](capturas-2026-09-18/06-01-reportes-periodo-en-curso.png)
*Captura — apartado 6.1/6.2. Tomada el 2026-09-21, que cae en el trimestre jul-sep 2026:
el reporte abrió ahí solo, sin tocar las fechas.*

> [!warning] 2026-09-21 · La pantalla ya no ofrece cinco miradas: ofrece SEIS
> El selector «Agrupar» trae hoy: «Por pantalla» · «Por trimestre» · «Por operación» ·
> «Por metro cuadrado» · «Por consumo de luz» · **«Por razón social»**. La sexta no la
> documenta ningún apartado de este manual — entró con el commit `30af088`
> («feat(reportes): la sexta dimension — por razon social»), posterior a la redacción del
> 18/09. No es un error de este manual en el sentido de que diga algo falso: es que quedó
> incompleto por un cambio de producto que llegó después. Se deja constancia aquí; añadir
> el apartado 6.3-bis con «Por razón social» es trabajo aparte, no de esta pasada.
>
> Cita: `apps/web/components/demo/reportes/consulta.ts:58-92` (`DIMENSIONES_UI`, con las
> seis entradas).

### 6.2 · El reporte abre en el trimestre en curso, y avisa de que está incompleto

**Esto es lo primero que vas a ver, y lo primero que hay que entender.**

Al abrir, el reporte se planta en el **trimestre que está corriendo ahora mismo**. Y un
trimestre a medias **siempre se lee peor de lo que es**.

El motivo es de negocio, no del sistema: la renta a los arrendadores **ya corrió** todos los
días transcurridos, y lo que vendiste **se cobra al cerrar**. Así que el costo ya está
dentro y el ingreso todavía no.

Por eso lo normal es que al abrir veas algo como `Ingreso $0.00` y un margen en negativo.
**No es una pérdida real.**

Encima de la tabla sale un **aviso en ámbar**, el primero de todos, que dice tres cosas:

1. que el periodo sigue abierto, y **cuántos días lleva corridos de cuántos** (por ejemplo,
   «80 de sus 92 días»);
2. por qué eso hace que el margen salga peor de lo que va a quedar;
3. que ese periodo **no se compara** con un trimestre ya terminado.

**Para ver cifras definitivas**, mueve el rango a un trimestre que ya cerró. Cuando lo
hagas, **el aviso ámbar desaparece**, y esa desaparición es información: te está diciendo
que lo que estás viendo ya no va a cambiar.

> [!warning] Basta un solo día de solape para que el aviso vuelva
> Si estiras el rango un día dentro del trimestre en curso, el aviso reaparece. Y con razón:
> ese día ya trae renta pagada y todavía no trae el ingreso que lo acompaña.

> [!success] 2026-09-21 · El texto exacto del aviso ámbar, palabra por palabra
> Verificado en pantalla el 2026-09-21, con el reporte abierto de forma natural (sin tocar
> el rango) en jul-sep 2026:
>
> *«El periodo que estás viendo toca T3 2026, que está EN CURSO: llevan 83 de sus 92 días.
> La renta de los espacios ya corrió esos 83 días completos, pero lo que se vendió se cobra
> al cerrar, así que el ingreso todavía no está dentro y el margen sale peor de lo que va a
> quedar. No lo compares con un trimestre terminado.»*
>
> Los números («83 de sus 92») cambian con la fecha en la que se mire; el resto de la frase
> no. Cita: `apps/web/components/demo/reportes/tabla.ts:662`.

### 6.3 · Las cinco formas de mirar

Cada forma cambia **las columnas de la tabla y el orden en que salen las filas**. No es la
misma tabla con otro título.

#### Por pantalla

Una fila por pantalla. Salen primero las de **peor margen**.

Es la mirada que contesta «¿qué pantallas están perdiendo dinero?».

#### Por trimestre

Una fila por trimestre. Salen en **orden cronológico**, no por importe: es una serie de
tiempo, no un ranking.

Un trimestre sin movimiento **sí aparece, en cero**. Un hueco en una serie se lee como
«faltan datos»; un cero se lee como «no pasó nada», que es la verdad.

> [!info] Aquí una fila no es una pantalla
> En esta mirada, cada fila es un trimestre entero con todas tus pantallas dentro. Los
> avisos que hablan de pantallas no salen aquí, precisamente porque dirían algo falso.

#### Por operación

Una fila por pantalla, con **cuántas visitas** recibió, **qué proporción de su ingreso se
comió la operación** y **cuántas horas** pasó alguien en sitio. Bajo el nombre de cada
pantalla verás el desglose por tipo de visita, del estilo «Desmontaje 2 · Inspección 1».

Salen primero las de **más costo de operación**, no las de peor margen. Es deliberado: una
pantalla con margen horrible por una renta cara **no es un problema de operación**, y por
peor margen saldría primera tapando justo a las que sí lo son.

Ésta es la mirada que contesta «tienen las mismas campañas, pero a una van a cada rato a
arreglarla».

#### Por metro cuadrado

Una fila por pantalla estática, con su **superficie**, su **ingreso por metro** y su
**margen por metro**. Salen primero las de peor margen por metro.

Lee el apartado 6.4 antes de usar esta mirada: deja pantallas fuera, y te dice cuáles.

#### Por consumo de luz

Una fila por pantalla, con los **kilovatios-hora** que le tocaron y su **costo por
kilovatio-hora**. Salen primero las de **más costo de energía**, por el mismo motivo que la
mirada por operación.

Si una pantalla no tiene consumo, su costo por kilovatio-hora sale como **«—»** y no como
«$0.00». Un cero se leería como «aquí la luz es gratis», que es lo contrario de «no hay
consumo con el que calcularlo».

> [!info] La luz cuenta en TODAS las miradas, no solo en ésta
> El costo de la energía entra en el costo total y en el margen de las cinco. Si no fuera
> así, la misma pantalla daría dos márgenes distintos según cómo la miraras, y los dos
> parecerían correctos.

### 6.4 · Lo que el reporte no sabe, te lo dice

Ésta es la parte que más preguntas genera, y la que conviene leer despacio. **Un número que
miente es peor que no tener el número**, así que el reporte declara sus huecos encima de la
tabla en vez de disimularlos.

Son cinco avisos. El primero va en ámbar; los demás en gris.

| Aviso | Qué te está diciendo |
|---|---|
| **Periodo en curso** | El único en ámbar. Ver el apartado 6.2 |
| **Sin contrato** | Esas pantallas salen con costo de espacio en cero **porque falta capturar el contrato**, no porque el espacio sea gratis. Su margen se lee mejor de lo que es |
| **Sin ingreso** | Costaron y no vendieron. Son justo las que este reporte existe para encontrar |
| **Exclusiones por metro cuadrado** | Cuántas pantallas quedaron fuera del ranking por metro, y por qué |
| **Convención del metro cuadrado** | Qué cuenta como metro cuadrado. Ver el apartado 6.5 |

#### Qué deja fuera la mirada por metro cuadrado

Deja fuera dos grupos, y **te dice cuántas de cada uno**:

- **Las pantallas digitales.** Una pantalla digital se vende por spots, no por metros. Una
  pantalla de led que vende doce spots al día no se compara con una valla de la misma
  superficie, y mezclarlas produce un ranking sin sentido.
- **Las estáticas sin medidas capturadas.** Sin ancho y alto no hay superficie, y dividir
  por un dato que no está **no da un error: da una cifra**, y la cifra se ve creíble.

El aviso sale **también cuando no se excluyó ninguna**. «No excluí ninguna» y «no te lo
digo» se ven igual si no hay texto.

Solo se cuentan como excluidas las pantallas que **habrían salido en el reporte**, es decir,
las que tuvieron movimiento en el periodo. Un catálogo con trescientas digitales dormidas
no te dirá «excluí 300»: el recuento contesta «cuántas filas te falta ver».

#### Qué deja fuera la mirada por consumo de luz

Aquí el hueco es **más peligroso que en el metro cuadrado**, y por eso se declara con más
cuidado: una pantalla sin recibo capturado sale con **costo de luz en cero**, que es
indistinguible de una pantalla que de verdad no gasta luz. La fila se queda y la cifra
parece completa.

El reporte cuenta por eso **cuántos recibos faltan**: cuántos pares de punto de medición y
mes no tienen recibo capturado. Si ese número no es cero, el costo de la luz que estás
viendo está por debajo del real.

Y hay un segundo caso, el de los **recibos sin destino**: un recibo de un predio que
**todavía no tiene pantallas dadas de alta**. Ese importe no le toca a nadie y desaparecería
del reporte sin dar ningún error, así que el sistema lo cuenta aparte y te dice cuánto es.

> [!warning] Si el reporte te dice que faltan recibos, no compares márgenes todavía
> Dos pantallas con distinta cobertura de recibos no son comparables. Captura los recibos
> que faltan (apartado 5) y vuelve.

### 6.5 · El metro cuadrado suma todas las caras

Una pantalla de **dos caras de 3 × 6 cuenta 36 metros cuadrados**, no 18.

La razón es de negocio: si vendes las dos caras, las dos son superficie que monetizas. El
metro cuadrado mide **la superficie que se vende**, no la del soporte.

El número de caras sale de **cada pantalla**, no de un multiplicador general. Una pantalla
de una cara aporta una, una de tres aporta tres, y una a la que no se le capturaron caras
cuenta como una sola —el sistema no inventa superficie.

El reporte **declara esta convención en pantalla**, encima de la tabla, con este texto:

> La superficie suma TODAS las caras de cada pantalla: una de dos caras de 3 × 6 cuenta
> 36 m², no 18. Es la superficie que se vende, y cada pantalla aporta la de sus propias
> caras.

Está escrito ahí porque una cifra por metro cuadrado **no se puede conciliar con nada** si
no dice qué cuenta como metro cuadrado.

> [!info] Esto cambia el orden del ranking por metro, y no cambia ninguna cifra de dinero
> Al contar todas las caras, la superficie sube y los cocientes por metro bajan. El ingreso,
> el costo y el margen **no se mueven**. Si comparas con una impresión vieja del reporte,
> eso es lo único que va a estar distinto.

### 6.6 · Ver el detalle de una fila

Cada fila se puede desplegar para ver su desglose periodo por periodo, con el ingreso, el
costo del espacio, el costo de operación, el margen y las visitas de cada uno.

El desglose solo se ofrece **cuando hay más de un periodo** en el rango. Con uno solo
repetiría la fila de arriba.

### 6.7 · Cómo leer los totales del pie

El pie **no totaliza todas las columnas**, y las que deja en blanco las deja a propósito.

Las columnas que son un promedio o un cociente —como el margen por metro cuadrado— no se
pueden sumar: el promedio de los cocientes de las filas **no es** el cociente del total,
porque cada pantalla tiene otra superficie. Un número ahí sería una cifra que no es de
nadie.

---

## 7 · Cuando algo falla

### 7.1 · Mensajes que vas a ver, y qué significan

| Lo que ves | Qué pasó | Qué hacer |
|---|---|---|
| **«El registro ya existe»** al guardar un recibo de luz | Ya hay un recibo de ese predio, ese mes y ese medidor | Comprueba si ya lo capturaste. Si es un segundo medidor, anota su número y vuelve a intentar |
| **«sin asignar»** en un contrato o comprobante | Ese documento no tiene razón social. Normal en todo lo anterior al 17 de septiembre | En contratos, asígnala (apartado 3.1). En comprobantes emitidos, se queda así |
| **«Razon social no disponible»** | El documento **sí** tiene razón social, pero la pantalla no acabó de cargar su nombre | Recarga la pantalla |
| El reporte dice que **no hubo movimiento** en el periodo | Ninguna pantalla tuvo ingreso, ni renta, ni visitas en ese rango | Comprueba primero las fechas. Si son correctas, es que ese periodo está realmente vacío |
| El reporte dice que **no se pudo calcular** | La pantalla no recibió respuesta, o la respuesta vino con error | Vuelve a intentar. Si se repite, avisa a quien administra tu instalación |
| El sistema te pide **tu contraseña** al asignar la razón social de un contrato | Es el candado de los cambios sensibles | Tecléala. Si no tienes contraseña porque entras con Google, pídesela a tu administrador |
| Te dice que **ya contestaste** el cuestionario de bienvenida | Ya existe al menos una razón social | Ve a **«Razones sociales»** a cambiar lo que haga falta |

### 7.2 · A quién avisar

- **Un dato de negocio que no cuadra** —un margen raro, un recibo que no aparece, una razón
  social equivocada en un contrato— lo resuelve quien administra tu organización, con
  permiso de Administración. Empieza por ahí.
- **Una pantalla que no carga, un error que se repite o un mensaje que no está en esta
  tabla** es para quien te da soporte de SPACE OS. Anota qué estabas haciendo y qué fechas
  tenías puestas en el reporte.

### 7.3 · Si te falta una pantalla del menú

Cada perfil ve solo lo que le toca. Si no encuentras **«Razones sociales»**, tu cuenta no
tiene permiso de Administración. Si no encuentras la pantalla de reportes, no tiene permiso
de Finanzas. Pídeselo a quien administra tu organización.

---

## Relacionadas

[[08-Manuales/manual-usuario-2026-09-15]] · [[08-Manuales/manual-tecnico-2026-09-15]] ·
[[02-Backend/entidades-fiscales]] · [[02-Backend/cuestionario-bienvenida]] ·
[[02-Backend/multi-entidad-en-uso]] · [[02-Backend/energia-consumos]] ·
[[02-Backend/reportes-rentabilidad]] · [[02-Backend/reportes-dimensiones]] ·
[[03-Frontend/pantalla-reportes]]

---

## PENDIENTES

> [!success] 2026-09-18, tarde · **ocho de los catorce, cerrados MIRANDO la aplicación**
> Se levantó la aplicación con la base de demostración ya sembrada y se comprobaron
> uno por uno. Lo de abajo **ya no se pregunta: se afirma**, con el texto tal como
> sale en pantalla.
>
> **La entrada del reporte se llama «Reportes»**, en el bloque de Finanzas.
>
> **Las cinco miradas del selector**, literales: «Por pantalla» · «Por trimestre» ·
> «Por operación» · «Por metro cuadrado» · **«Por consumo de luz»**. Ninguna dice ya
> «(en preparación)».
>
> **Consumo de luz SÍ tiene entrada propia**, en el bloque de Operaciones, después
> de Almacén. El hueco que este manual reportaba **estaba cerrado antes de que se
> escribiera**: la nota de origen describía el estado anterior. Un perfil de
> Operaciones sí tiene forma de llegar.
>
> **Los campos de la captura**, en orden: `DESDE` · `HASTA` · `PREDIO O PANTALLA` ·
> `MES DEL RECIBO` · `MEDIDOR` (marcado *opcional*) · `KWH` · `IMPORTE`, y el botón
> **«Guardar recibo»**.
>
> **Los botones de «Razones sociales»**: **«+ Nueva razón social»**, y en cada
> renglón **«Editar»** y **«Dar de baja»**.
>
> **Las etiquetas de los cinco papeles**, tal como se leen: «Paga las rentas a los
> arrendadores» · «Compra los activos y el equipo» · «Tramites y licencias con
> gobierno» · «Operacion y nomina» · «Vende publicidad».
>
> **El aviso de los recibos que faltan**, literal:
> *«Faltan 14 de 24 recibos del periodo. Mientras falten, el reporte de rentabilidad
> suma solo lo capturado y enseña un costo de luz MENOR del real, sin avisar de
> nada: un mes sin recibo no es un mes sin consumo.»*
> Y los meses sin recibo se pintan con **una raya ámbar**, nunca con `$0.00`.
>
> **Las columnas del reporte**, como encabezados reales: `Pantalla` · `Ingreso` ·
> `Costo del espacio` · `Costo de operación` · **`Costo de la luz`** · `Costo total` ·
> `Margen` · `Margen %`. Cada renglón lleva además **«Ver el desglose por periodo»**.

> [!success] 2026-09-21 · Cinco de los seis, cerrados MIRANDO la aplicación (y con capturas)
> Se levantó la aplicación con `next build && next start` (no `next dev`: ver el aviso al
> principio de este manual) contra la base de demostración `demo-rentabilidad`, sembrada
> con `scripts/semilla-demo.mjs`, y se recorrió cada flujo con Playwright
> (`manuales/capturas-2026-09-18.spec.ts`), con capturas en `capturas-2026-09-18/`.
>
> **2. El botón del cuestionario de bienvenida es «Guardar y continuar»**, no «Enviar».
> Confirmado con una organización sin ninguna razón social (ver el apartado 1.1).
>
> **3. El texto exacto del aviso ámbar de periodo en curso** está citado palabra por
> palabra en el apartado 6.2.
>
> **4. El texto de los avisos de papel sin dueño y papel compartido** está citado palabra
> por palabra en el apartado 2.2, provocado a propósito porque en la demostración cada
> papel tiene una sola dueña.
>
> **5. El botón de borrar un recibo NO tiene texto visible** (es un icono de papelera con
> `title="Borrar este recibo"`) **y NO hay ninguna confirmación**: el borrado es inmediato.
> Contradice lo que dice el paso 2 del apartado 5.3, que queda anotado ahí con la cita del
> código. Y de paso se encontró que un perfil de Operaciones —al que este manual le asigna
> la pantalla— no puede borrar su propio recibo mal capturado: el borrado exige el permiso
> `aprobar`, que Operaciones no tiene, y el 403 resultante le borra la rejilla entera de la
> pantalla. Ver el apartado 5.3.
>
> **6. Un perfil de Operaciones que intenta `/reportes/` no ve ni un 403 ni un mensaje**:
> el sistema lo redirige de inmediato a su propio tablero (`/operaciones/`), y la entrada
> «Reportes» ni siquiera aparece en su menú. Ver el apartado 6.
>
> **Hallazgo aparte, no pedido por ninguno de los seis:** el selector de reportes ya no
> ofrece cinco miradas, ofrece **seis** — «Por razón social» se añadió después de escribirse
> este manual (commit `30af088`). Ver el aviso en el apartado 6.1.

### El que sigue abierto — es una decisión de negocio, no técnica

1. **¿Se levanta un inventario nuevo antes del lanzamiento?** Esta pregunta **no se puede
   contestar recorriendo la aplicación**: no es un comportamiento del sistema, es una
   decisión de qué inventario enseñar el día del SUMMIT. El inventario vigente
   (`vault/00-Inventario/inventario-2026-08-11.md`) sigue siendo del 15 de septiembre y
   anterior a razones sociales, consumo de luz y reportes de rentabilidad. Queda para quien
   decide el guion de la demostración, no para esta pasada.

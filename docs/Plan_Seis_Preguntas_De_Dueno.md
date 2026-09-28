# Las seis preguntas de los dueños — qué se contesta hoy, y qué haremos

**Fecha:** 2026-09-28 · **Lanzamiento:** 2026-10-14 (16 días)
**Método:** auditoría de solo lectura sobre `main` (`dcc9a88`), con `archivo:línea`.
Nada se ejecutó ni se tocó ningún servidor — en este repositorio la planeación no
toca nada.

---

## El cuadro de respuestas

| # | Lo que preguntan | Respuesta honesta |
|---|---|---|
| 1 | ¿Ventas de oct/dic 2027 desde ahora? | **SÍ** — sin tope en ninguna capa |
| 2 | ¿Programar pautas desde el módulo de ventas? | **A MEDIAS** — la frecuencia sí nace en ventas; el reparto vive en otro menú; la franja horaria no existe |
| 3 | ¿Tarifas de spoteo y vender 50 spots? | **A MEDIAS** — se cotiza de punta a punta; **no** se programa ni se descuenta del inventario |
| 4 | ¿Circuitos y paquetes con promociones? | **NO** como entidad — sí dibujo de zona y venta en bloque |
| 5 | ¿Códigos de descuento con vencimiento? | **NO** — cero. Hay un solo % por propuesta |
| 6 | ¿Rentabilidad bruta y neta, por vendedor, publicada vs neta? | **A MEDIAS** — y las tres mitades cuestan muy distinto |

---

## Tres hallazgos que importan más que las respuestas

### 1 · Vender para 2027 apaga la pantalla en el inventario de HOY

**Es lo que más probabilidad tiene de arruinar una demostración en vivo.**

`apps/web/lib/server/campanas-repo.ts:585` hace
`update sitios set estatus_comercial='OCUPADO' where id=$1` — **incondicional, sin
mirar fechas**. Y el listado de Comercial decide «disponible» mirando ese campo
(`comercial/page.tsx:339`), **sin ningún filtro de fecha en pantalla**.

Con las digitales pasa por otra vía: `sitios-repo.ts:242` calcula
`spotsDisponibles = totalSpots − campanas_activas`, y `campanas_activas` cuenta
**toda reserva con `fecha_fin >= current_date`**, sin acotar al periodo
consultado. Una venta de 2027 consume un slot visible durante todo 2026.

El servidor sí dejaría volver a vender ese espacio para 2026 — pero **el comercial
ya no lo ve**.

> **Para el 14/10:** no vender a futuro lejano sobre una pantalla que se vaya a
> volver a enseñar. Arreglarlo de raíz son 3–5 días y es cambiar el modelo de
> lectura: no entra antes del Summit.

### 2 · Cualquier comercial puede regalar el 90 % sin contraseña ni aprobación

`apps/web/lib/descuento.ts:42` — el único límite es `Math.max(0, Math.min(100, n))`.

- Lo puede hacer **cualquier rol COMERCIAL** (`api/propuestas/[id]/route.ts:13`).
- **No pasa por el candado de contraseña**: propuestas no está entre las rutas con
  `exigirCambioSensible`. Cambiar la renta de una pantalla sí la pide; **regalar el
  80 % de una venta, no.**
- El único freno es al **100 % exacto** (`propuestas-repo.ts:565-592`). El 90 %
  pasa liso.

> **Medio día de trabajo** — `config_negocio` ya existe por organización. **Entra
> antes del 14/10.** Es el hueco más barato de tapar y el que peor se ve si un
> dueño potencial pregunta justo por eso.

### 3 · Dos convenciones de precio conviven en la misma columna

- Reserva creada desde **Comercial** → guarda la **tarifa de lista**
  (`campanas-repo.ts:443`, `tarifa_mensual`, sin descuento ni comisión).
- Reserva nacida de **propuesta** → guarda el **neto**
  (`campanas-repo.ts:701`, tras `factorDesc × divisor`).

**El reporte de rentabilidad suma las dos cosas juntas.** No da error, no se ve.

> **Para el 14/10:** alinear los datos de la demostración a **una sola ruta**.
> Unificarlo toca dinero y va después.

---

## Pregunta por pregunta

### P1 · Ventas de 2027 — **SÍ**

**Sin tope en ninguna capa**, verificado en las cuatro: base de datos
(`schema.sql:367,386,457`), servidor (`propuestas-controller.ts:52-59`), interfaz
(ningún `max` en los inputs de venta) y cálculo de solape, que compara contra el
periodo pedido **sin `current_date`** (`campanas-repo.ts:457-467`).

**Qué enseñar:** una propuesta con `Desde 2027-10-01 / Hasta 2027-12-31` pasa
entera. Disponibilidad con `Desde = 2027-10-01`, vista Mes, 4 periodos. Y el
calendario de la ficha avanza a 2027 clic a clic.

**La trampa del contrato del arrendador:** el guard de venta **nunca mira la fecha
de fin del contrato** — solo el estatus, y `VENCIDO` cuenta como acreditado, **a
propósito** (`contratos-sitio.ts:223-228`, con test que lo blinda). O sea: **se
puede vender un sitio para una fecha en la que ya no será nuestro.** La única
señal es una alerta de dashboard, y tiene tres huecos: no aparece si el contrato
está VENCIDO, no aparece si la pantalla cuelga de un predio, y **el dashboard es
solo del rol DUEÑO** — un comercial no la ve nunca.

**Y una puerta trasera:** «Extender campaña» (`campanas-repo.ts:939-965`) alarga
campaña y reservas **sin comprobar solape, ni cupo, ni cobertura**. Es el camino
limpio para saltarse todos los guards.

### P2 · Pautas desde ventas — **A MEDIAS**, y la respuesta literal es **no**

**Sí nace en ventas:** el campo «spots/día» por pantalla digital se captura en
**Propuestas** (`propuestas/page.tsx:812-822`) y viaja hasta la reserva.

**Pero el reparto de creativos vive bajo «Operaciones»** (`nav.ts:121`), no bajo
Comercial, y **no hay ningún enlace desde Propuestas ni desde Comercial**. La
pregunta del dueño es literal, así que hoy la respuesta es no.

**Lo que sí hay, y es bueno:** asignación de creativo por pantalla con nº de
veces, reparto automático prorrateado sobre los slots, autoasignación cuando hay
una sola pieza, y un guard que impide enviar la campaña al CMS si alguna pantalla
digital se queda sin creativo. Y **sí sale al CMS de verdad** (`doohmain.ts:280-403`).

**Lo que NO existe: el «cuándo».** Franja horaria y días de la semana **no existen
en ninguna capa** — ni columna, ni API, ni UI. Y **el SDK de DOOHmain tampoco los
acepta**: sus banderas son versión, anunciante, campaña, fechas, archivo, pantalla,
lista y cantidad por día. **No hay `--hora` ni `--dias`.** Aunque lo modeláramos,
hoy no habría por dónde entregarlo. **Fuera de alcance para el 14/10.**

> Ojo: `sitios.horario` es **texto libre descriptivo** y nadie lo lee para
> programar. No confundirlo con una franja.

### P3 · Tarifas de spoteo y 50 spots — **A MEDIAS**

**Lo bueno, y es real:** `sitio_modalidades` permite **una tarifa distinta por
unidad para cada pantalla**, con `unique (sitio_id, unidad)`. El camino completo
funciona: en Propuestas eliges «Por spot», aparece un input de cantidad, tecleas
**50**, y el precio sale `tarifa_spot × 50`, recalculado en el servidor sin fiarse
del cliente.

**Tres límites que hay que decir:**

1. **Las modalidades solo se capturan por archivo.** Ningún formulario las manda;
   la ficha solo las **muestra**. Para poner tus tarifas de spoteo hoy hay que
   importar un CSV.
2. **El 50 no se ve después.** El detalle de la propuesta no tiene columna de
   unidad ni cantidad, la lectura de la reserva no expone esos campos, y **la
   factura es un importe único sin conceptos**.
3. **No se descuenta de ningún inventario.** `spots_disponibles` **nunca se
   decrementa al vender**: se recalcula como `total_spots − nº de campañas`. O sea
   **1 slot = 1 campaña**, no 1 slot = 1 spot. Y `total_spots` está **forzado a 12**
   para toda pantalla digital nueva, ignorando lo que traiga el archivo
   (`sitios-repo.ts:167-170`).

**Y los once tipos de venta son decorativos.** Medido uno por uno: **`FIXED_PKG`
es el único que se escribe**, y está **quemado en las dos rutas de venta**
(`campanas-repo.ts:559` y `:709`). Los otros diez —`SPOT_UNIT`, `SOV`, `TAKEOVER`,
los tres `PROG_*`…— solo existen en la declaración del tipo. Cero UI.
**Una venta por spot se guarda literalmente como «paquete fijo».**

> **Dos números distintos que no se hablan:** `cantidad` con unidad spot (los 50,
> para el precio) y `spots_por_dia` (cuántas veces al día, la programación).
> **Antes de contestarle al dueño hay que saber cuál pide**, porque la respuesta
> cambia de «sí, se cotiza» a «no, no se programa».

### P4 · Circuitos y paquetes — **NO** como entidad

Ninguna tabla, ningún tipo, ninguna pantalla. La palabra «circuito» no aparece en
el producto.

**Lo que sí existe y es vistoso:** **dibujar un polígono sobre el mapa** al armar
una propuesta, y que la selección pase a ser **exactamente las pantallas de
dentro** (`propuestas/page.tsx:359-368`). Más selección múltiple con total a la
vista y reserva en bloque desde Comercial, y cambio masivo de tarifas (fijar
importe o ajustar %, sobre lo que cobras o sobre lo que pagas).

**El límite honesto: la zona no se guarda.** Es estado de React; se pierde al
recargar. **Filtra en el momento y muere.** Esa es exactamente la frontera entre
«filtro» y «circuito».

> **Decisión de producto pendiente:** ¿un circuito es **fijo** (estas 12 pantallas
> por nombre) o **dinámico** (todo lo que caiga en este polígono)? Se comportan
> distinto al dar de alta una pantalla nueva en la zona, y define si el trabajo es
> día y medio o cinco.

### P5 · Códigos de descuento con vencimiento — **NO**

Cero: ni cupón, ni código, ni promoción con fecha. Lo único es
`propuestas.descuento_pct`, **un porcentaje por propuesta entera** — ni siquiera
por pantalla (`propuesta_items` no tiene columna de descuento).

**Lo que sí se puede enseñar, y vende solo:** la escalera económica completa —
**bruto → descuento → comisión → neto → IVA → total**— editable en vivo, y el hecho
de que **al aprobar queda congelada y versionada**: lo que aceptó el cliente no se
puede reescribir.

**Construirlo no es inventar:** el patrón «token con fecha de caducidad» ya está
escrito tres veces en este repositorio (reservas con TTL, tokens de recuperación,
firma de contrato). Son 3–4 días y toca dinero.

### P6 · Rentabilidad — **A MEDIAS**, y las tres mitades cuestan muy distinto

El módulo existe de verdad: **seis dimensiones** (pantalla, trimestre, operación,
m², luz, razón social), rango libre y granularidad mensual o trimestral.

**Calcula un solo margen** (`reportes.ts:1032`):
`margen = ingreso − costoEspacio − costoOperacion − costoEnergia`.
Está **más cerca del neto que del bruto**: el ingreso ya viene descontado y sin
comisión. No hay costos indirectos en ninguna parte del cálculo.

| Lo que piden | Estado | Coste |
|---|---|---|
| **Publicada vs neta** | El dato **ya está escrito** en `snapshot_economico` (`{lista, neto}` por pantalla, con el % de descuento y de comisión al lado). El reporte simplemente **no lo mira** | **1–2 días**, sin capturar nada nuevo |
| **Bruta vs neta** | Depende de qué llamen «bruta» ↓ | 1–2 días **o** semanas |
| **Por vendedor** | **No existe el dato** | Ver abajo |

**Por vendedor — no es un reporte que falte, es un dato que nadie captura.**
Verificado: `usuario_id` solo existe en `sesiones` y en la bitácora. **Ninguna
propuesta ni campaña tiene dueño**, ni las históricas ni las futuras. Añadir la
columna es un día; que el número signifique algo exige que **cada comercial entre
con su cuenta y cree sus propias propuestas** — eso no es programar, es cambiar
cómo trabaja la gente. **Y todo el histórico queda sin atribuir para siempre.**

> **El atajo barato:** escribir el **valor** del descuento en la bitácora (hoy
> registra que se actualizó la propuesta, pero no cuánto). **Una hora de trabajo**,
> y Actividad filtrada por persona ya enseña «Fulana puso 22 % en la propuesta X».
> No es un reporte, pero es verdad y es enseñable la semana que viene.

**Un matiz que vale oro en la venta:** la dimensión «por razón social» **se niega a
llamar margen a lo que no lo es**. Su columna se llama `saldoAtribuido` porque le
faltan dos de las cuatro fuentes de costo, y el código explica por qué. Ese párrafo,
leído en voz alta a un dueño, demuestra más rigor que tres funciones.

---

## El plan — qué entra antes del 14/10

Ordenado por relación valor/coste. Total: **≈5–6 días de trabajo en 16 días.**

| # | Qué | Coste | Por qué entra |
|---|---|---|---|
| 1 | **Tope de descuento por organización** | medio día | Tapa un agujero real, y se **enseña como control** |
| 2 | **Enlace de Propuestas/Comercial a Creativos** (o mover la entrada al grupo Comercial) | minutos | Convierte P2 de «no» a «sí» literal |
| 3 | **Escribir el valor del descuento en la bitácora** | 1 hora | Da la mitad de «descuentos por vendedor» sin migración |
| 4 | **Capturar modalidades desde la ficha** | 1–2 días | La mejor relación esfuerzo/venta: hoy las tarifas de spoteo **solo entran por CSV** |
| 5 | **Publicada vs neta en el reporte** | 1–2 días | El dato ya está escrito; es leerlo |
| 6 | **Mostrar unidad y cantidad** en el detalle de propuesta | 1 día | Hoy vendes 50 spots y el 50 no se ve en ninguna pantalla |

### Lo que NO entra, y se promete con fecha

| Qué | Coste | Por qué no |
|---|---|---|
| Inventario real por spots | **semanas** | Cambio de modelo: hoy «slot = campaña» y `total_spots` forzado a 12 |
| Cupones con vencimiento | 3–4 días, ROJO | Toca dinero; no la noche antes |
| Circuito como entidad | 3–5 días | Falta decidir fijo vs dinámico |
| Guardar la zona dibujada | 1.5 días | **Candidato si sobra tiempo:** es lo más vistoso por lo que cuesta |
| Vendedor asignado | 2–3 días + reorganización | Exige decidir cómo trabaja el equipo |
| Franja horaria y días | semanas | **El CMS no lo acepta**: no depende de nosotros |
| Unificar las dos convenciones de precio | medio día, ROJO | Toca dinero; después del Summit |

---

## Lo que hay que preguntarle a los dueños antes de prometer

1. **¿Qué es «rentabilidad bruta» para ellos?** Si es *antes de descuento y
   comisión*: **1–2 días y el dato ya está**. Si es *antes de gastos de estructura*
   —nómina, oficina—: **este sistema no modela esos costos en ninguna parte**, y son
   semanas. Es la pregunta más cara del informe.
2. **«50 spots» ¿de qué?** ¿50 en total (precio) o 50 al día (programación)? Son
   dos campos distintos que hoy no se hablan.
3. **¿Un circuito es fijo o dinámico?**
4. **¿Un paquete lleva precio propio**, distinto de la suma de sus partes? Si sí,
   toca el snapshot económico y es zona roja. Si es «los mismos precios pero
   preseleccionados», casi lo tienes con la zona.
5. **¿Quién crea las propuestas hoy, de verdad?** Si es una persona capturando por
   todo el equipo, la columna de vendedor no arregla nada: la métrica nacería
   mintiendo.
6. **¿Aceptan que «un slot = una campaña» y que sean siempre 12?** Un dueño con
   loop de 60 s y spots de 15 s tiene 4 posiciones, no 12. Es la afirmación más
   frágil del inventario y la que un cliente técnico va a cuestionar.

---

## Antes del 14/10, comprobar con datos delante

- **¿Hay una sola pantalla con modalidad `spot` en el entorno de la demostración?**
  Toda la demo de P3 depende de ello, y nadie lo ha verificado. El archivo
  `carga-digitales-demo.csv` está en el repo, listo, con una pantalla de tres
  modalidades.
- **¿Hay datos para que las seis dimensiones del reporte salgan pobladas?** En
  particular recibos de luz y órdenes de trabajo con sus dos marcas de tiempo. **Una
  tabla en blanco cuesta más que no enseñarla.**
- **`spots_por_dia` está en NULL en toda la producción de hoy**, así que el campo de
  frecuencia se verá vacío si se enseña con datos existentes.

---

## Lo que NO se verificó

- **Nada se ejecutó.** Ni pruebas, ni build, ni la aplicación en un navegador. Todo
  es lectura de código.
- **No se consultó ninguna base de datos viva.** No se sabe qué hay cargado en DEMO,
  en el PADRE ni en g500.
- **No se probó el camino propuesta → campaña → factura con unidad `spot`.** Se
  reconstruyó leyendo las tres capas; no se ejecutó.
- Este repositorio tiene **precedente** de algo que se leía bien en el código y se
  veía mal en pantalla (las columnas del reporte, descubiertas con un navegador
  delante). **La lectura no sustituye a mirar.**

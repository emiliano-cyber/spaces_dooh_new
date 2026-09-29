# ADR 0040 · Los roles de venta y la autorización de descuentos

**Fecha:** 2026-09-29
**Estado:** en diseño · **nada construido** · la migración espera aprobación
**Decide:** Jochelo, el 2026-09-29
**Se apoya en:** ADR 0039 (la cadena de precio) y el tope de descuento del 28/09

---

## Lo que se pidió

**Cuatro** roles nuevos —**administrador**, **director comercial**, **gerente de
ventas** y **vendedor**— con estas reglas:

- Generar **descuentos**, **códigos promocionales** y **crear paquetes** va **con
  autorización del director comercial**.
- El **gerente de ventas** crea **paquetes cerrados sin autorización**.
- El **vendedor** genera cotizaciones, ofrece **descuentos aprobados** y aplica
  **códigos promocionales** a las propuestas.

Más dos cosas aparte: una **calculadora de precio de spot** (la lógica llega
después) y una **bitácora del vendedor** para prospectos, citas y seguimiento.

---

## Lo medido antes de diseñar

| Qué | Cómo está hoy | Qué implica |
|---|---|---|
| Los roles | **Enum de Postgres** `rol_demo` (`db/schema.sql:31`) | Añadir tres es **una migración**. Y un valor de enum **no se puede quitar** después |
| Los permisos | **Tabla** `rol_permisos` (rol, módulo, acción). DUENO 24 filas, COMERCIAL 5 | Definir qué puede cada rol es **datos**, no código. Esto abarata mucho la parte de roles |
| Autorizar a alguien | **NO EXISTE** | Hoy hay dos frenos: la contraseña (`exigirCambioSensible`) y el tope de descuento. **Ninguno es «pedirle permiso a otra persona»** |

> **Y aquí es donde este ADR se corrigió el mismo día.** La primera lectura fue
> que «con autorización» era un **subsistema nuevo** de solicitudes. El dueño lo
> precisó y resultó ser mucho más simple: **la solicitud ES la propuesta**. Ver
> la sección del flujo, más abajo — pasó de semanas a días.

---

## El reparto entre los cuatro roles

| | **Administrador** | **Director comercial** | **Gerente de ventas** | **Vendedor** |
|---|---|---|---|---|
| Cotizar (propuestas) | sí | sí | sí | **sí** |
| Descuento **dentro de su techo** | sí | sí | sí | **sí** |
| Descuento **por encima de su techo** | sí | — | su propuesta **la aprueba otro** | su propuesta **la aprueba otro** |
| Aplicar un **código existente** | sí | sí | sí | **sí** |
| **Crear** códigos promocionales | sí | sí | **pide autorización** | no |
| **Crear** paquetes cerrados | sí | sí | **sí, SIN autorización** | no |
| **Crear** escalas de volumen | sí | sí | **pide autorización** | no |
| **Aprobar una propuesta CON descuento** | sí | **sí** | **sí** | no |
| Aprobar una propuesta **sin** descuento | sí | sí | sí | **sí** (→ pregunta 8) |
| Fijar los techos de cada rol | sí | sí | no | no |

**El gerente crea paquetes sin pedir permiso y códigos pidiéndolo, y eso no es
una incoherencia:** un paquete es un precio cerrado para una venta concreta, y un
código es una promesa **con nombre** que se le entrega a un cliente y se puede
canjear N veces. El segundo se le escapa de las manos a quien lo crea; el primero
no.

---

## Los tres caminos del descuento del vendedor

El dueño los quiere **los tres**, y conviven sin pisarse porque responden a
preguntas distintas:

1. **Dentro de su techo.** Un porcentaje máximo por rol. Es el tope del 28/09,
   hecho **por rol** en vez de por organización.
2. **De una lista preaprobada.** Un catálogo de descuentos —5 %, 10 %, 15 %— que
   el director define. El vendedor elige de ahí sin teclear a mano.
3. **Códigos existentes.** No los crea: los aplica.

**Y la pregunta que tenía este apartado quedó contestada el mismo día:** un
descuento de la lista **NO cuenta contra el techo, y puede superarlo** — porque
ya se autorizó antes, para un caso concreto. Eso lo convierte en otra cosa
distinta de un catálogo de porcentajes; ver el apartado del preaprobado.

---

## El flujo de autorización — CORREGIDO el 2026-09-29

> **La primera versión de este ADR diseñó un subsistema de solicitudes con su
> propia entidad, sus estados y una bandeja del director. Estaba de más.** El
> dueño lo precisó el mismo día y la regla real es mucho más simple:
>
> > **Una propuesta SIN descuento la aprueba cualquiera. Una propuesta CON
> > descuento solo la aprueban el gerente de ventas y el administrador.**
>
> Con eso, **la solicitud ES la propuesta**. No hace falta inventar nada: el
> vendedor la arma con su descuento y **no puede aprobarla él**. Quien la aprueba
> es quien autoriza.

**Por qué esto lo cambia todo de tamaño.** El producto ya tiene la máquina de
estados de una propuesta, ya congela el `snapshot_economico` al aprobarla, y ya
sube la `version` al renegociarla. La autorización deja de ser un flujo nuevo y
pasa a ser **una comprobación de rol en el momento de aprobar**.

De **2–3 semanas** a **2–3 días**.

### Lo que sigue en pie de las cinco preguntas

Tres se responden solas con este modelo, y dos siguen siendo decisiones:

| | |
|---|---|
| ¿Qué queda bloqueado mientras espera? | **Se responde sola**: sin aprobar no hay campaña ni factura. No hay que bloquear nada aparte |
| ¿La aprobación caduca? | **Se responde sola**: renegociar sube la `version` y hay que volver a aprobar |
| ¿Qué se congela? | **Ya se congela**: el snapshot guarda la escalera al aprobar. Solo falta añadirle **quién aprobó** |
| ¿Quién aprueba si el gerente no está? | **Sigue abierta.** Propuesto: el Dueño siempre puede |
| ¿Se puede aprobar MENOS de lo pedido? | **Sigue abierta**, y ahora significa que el aprobador **edita el descuento y aprueba**. Editarlo sube la versión, así que el rastro queda |

### «El administrador» es un CUARTO rol, no el Dueño

Precisado el 2026-09-29: *«el administrador no es el dueño, pero puede hacer las
mismas cosas que él»*. Son **cuatro** roles nuevos, no tres.

**Y «las mismas cosas» no se puede dar por sentado, porque medido hoy hay CUATRO
sitios donde `DUENO` está escrito a mano, FUERA de la matriz de permisos.**
Copiarle al administrador las 24 filas de `rol_permisos` **no le daría ninguno**:

| Dónde | Qué guarda | ¿El administrador? |
|---|---|---|
| `lib/server/tenant.ts:61` (`puedeCambiarCrm`) | **Cambiar de organización** — el super-admin de la plataforma | **Yo diría que NO.** Es de flota, no de empresa |
| `lib/server/tenant.ts:37` | El mismo salto, por otra vía | idem |
| `configuracion/page.tsx:25` | Editar **los datos de la empresa** | Probablemente sí |
| `inventario/page.tsx:57` | La pantalla de Inventario entera, *«exclusiva del Dueño»* | Probablemente sí |

> [!danger] Y la pregunta de gobierno que hay que contestar antes de crear el rol
> `administracion: crear` incluye **dar de alta y de baja usuarios**. Si el
> administrador la tiene, **puede quitarle el acceso al Dueño**.
>
> Eso puede ser exactamente lo que se quiere —un administrador de verdad— o un
> disparo en el pie. Lo que no vale es descubrirlo el día que pasa: **un rol de
> enum no se puede quitar de Postgres**, así que el reparto con el que nazca es
> el que se arrastra.
>
> Lo mínimo razonable: **que nadie pueda quitarse a sí mismo ni al último Dueño**.
> Hoy eso no existe y no se ha comprobado si `borrarUsuario` lo impide.

→ **Preguntas 6a a 6c.**

---

## El descuento preaprobado — NO es un número, es un número con condiciones

Corrección del mismo día, y cambia el modelo: **un preaprobado PUEDE superar el
techo del vendedor**, porque *«ya fue aprobado anteriormente para ciertas compras
o ciertos arrendadores»*.

O sea que no es una entrada de catálogo con un porcentaje: es un porcentaje
**atado a un supuesto**. «15 % en las pantallas de este arrendador», «20 % a
partir de tal volumen». Sin ese supuesto, la lista sería exactamente la puerta
para saltarse el techo que se temía.

| | Techo por rol | Descuento preaprobado |
|---|---|---|
| Qué acota | **la discreción** de quien vende | nada: ya se decidió antes |
| Lo puede superar | no | **sí, ése es su sentido** |
| Cuándo se autorizó | nunca: es el límite | **antes**, y para un caso concreto |
| Qué hay que guardar | un porcentaje | **el porcentaje Y a qué aplica** |

> [!danger] El riesgo que hay que cerrar en el diseño
> Si el sistema guarda la condición pero **no la comprueba**, el preaprobado se
> convierte en un descuento libre con una etiqueta bonita: el vendedor elige el
> «15 % del arrendador X» en una venta que no lleva ni una pantalla de X, y nada
> se lo impide.
>
> **Comprobarlo no es opcional.** Si una condición no se puede comprobar con lo
> que hay en la propuesta, ese preaprobado no debería existir todavía.

## Las tres decisiones del 2026-09-29, y lo que arrastran

### 1 · El administrador NO cambia de organización y NO da de baja a ningún Dueño

Dictado: *«no puede cambiar de organización ni dar de baja al dueño, y tampoco
puede dar de baja ningún dueño»*.

Lo primero sale solo: `puedeCambiarCrm` (`lib/server/tenant.ts:61`) exige
`rol === 'DUENO'` y no se toca.

Lo segundo **no existe hoy en ninguna forma** y hay que construirlo: la regla es
**«un administrador no puede desactivar ni degradar a un usuario con rol DUENO»**,
y va **en el servidor**, no en la pantalla — esconder el botón no es una regla.

> **Y conviene extenderla una línea más, aunque no se pidió:** que **nadie pueda
> quedarse sin ningún Dueño**. Sin eso, dos Dueños pueden desactivarse el uno al
> otro y dejar la organización sin nadie que pueda cambiar la configuración de la
> empresa ni repartir permisos. Hoy nada lo impide. → **Pregunta 9**.

### 2 · El rol COMERCIAL se retira — pero un enum de Postgres NO se puede borrar

Dictado: *«con el rol comercial lo eliminamos ya que estos lo cubren»*. De
acuerdo con el fondo, y hay que ser exacto con la forma:

**`rol_demo` es un enum, y quitarle un valor exige recrear el tipo entero** —
soltar el default, reescribir cada columna que lo usa, volver a crearlo—. Sobre
una tabla con datos, en una flota donde **g500 tiene clientes reales y su cola de
migraciones lleva parada desde el 23/09**, eso es un riesgo que no compra nada.

**Así que se retira DE USO, no del esquema**, y son tres cosas:

1. **Se le quitan sus filas de `rol_permisos`.** Sin permisos, el valor existe y
   no autoriza nada.
2. **Se cambia el DEFAULT de la columna.** `usuarios.rol` es
   `rol_demo not null default 'COMERCIAL'` (`db/schema.sql:65`). Si no se cambia,
   **cada usuario nuevo sin rol explícito nace con un rol que no puede hacer
   nada** — y el síntoma sería «entro y no veo ninguna pantalla», que no señala
   la causa. El default natural pasa a ser `VENDEDOR`.
3. **Se migran los usuarios que lo tengan.** → **Pregunta 10: ¿a qué rol?**
   `VENDEDOR` es lo natural por lo que hace hoy un COMERCIAL, pero es una
   decisión de personas, no de código: al que hoy es COMERCIAL se le está
   asignando un puesto.

### 3 · El preaprobado admite TODAS las condiciones — y ahí hay una consecuencia cara

Dictado: *«el preaprobado todo lo que comentas»*, o sea arrendador, volumen,
cliente, franja, temporada y tipo de medio.

**Las seis no cuestan lo mismo, y la diferencia no es de cantidad sino de
naturaleza.** Medido: `propuesta_items` **no tiene ninguna columna de descuento**
— el `descuento_pct` vive en `propuestas` (`db/schema.sql:355`), o sea **uno solo
para toda la cotización**.

| Condición | Se comprueba contra | Coste |
|---|---|---|
| **Arrendador** | la propuesta entera («¿todas sus pantallas son de X?») | barato |
| **Volumen** | la cantidad total | barato |
| **Cliente** | el cliente de la propuesta | barato |
| **Franja** | **cada línea** | **caro ↓** |
| **Temporada** | **cada línea** | **caro ↓** |
| **Tipo de medio** | **cada línea** | **caro ↓** |

**Las tres últimas describen una PARTE de la cotización, no toda.** Si una
propuesta mezcla prime y madrugada, un «15 % en prime» no puede aplicarse al
total — y aplicarlo sería regalar descuento de prime a la madrugada, en silencio
y en dinero.

**Hacerlo bien exige descuento POR LÍNEA**, que es columna nueva en
`propuesta_items` y rehacer la escalera económica en tres sitios
(`propuestas-repo`, y `campanas-repo` en sus dos caminos), más el congelado. La
auditoría del 28/09 ya lo estimó: **2–3 días y zona ROJA**.

**Las dos salidas, y hay que elegir:**

- **(a) Solo las condiciones de propuesta entera** —arrendador, volumen,
  cliente—. Entra rápido y no miente: un preaprobado se aplica o no se aplica.
- **(b) Las seis, con descuento por línea.** Es lo que se pidió y es lo correcto a
  la larga, pero **suma 2–3 días de zona roja** y no cabe antes del 14/10.

→ **Pregunta 11.** Mi recomendación: **(a) ahora y (b) después del Summit**,
porque (a) es un subconjunto honesto de (b) y no hay que deshacer nada.

---

## Lo que NO cabe antes del 14 de octubre

Quedan **15 días**. Con el calendario delante:

| Qué | Tamaño | ¿Antes del 14/10? |
|---|---|---|
| **Los tres roles + su matriz de permisos** | 2–3 días | **SÍ** — y es lo que se ve |
| Techos de descuento **por rol** | 1–2 días | **Sí, si hay hueco** |
| **La autorización al aprobar** (regla de rol) | **2–3 días** | **SÍ** — dejó de ser un subsistema |
| Descuentos preaprobados **con su condición** | 3–5 días | Según la pregunta 7 |
| La calculadora de precio de spot | ? | **Bloqueada: falta la lógica** |
| La bitácora del vendedor | 1–2 semanas | **No** — decidido: después del Summit |

**Con el flujo corregido, el 14/10 cabe bastante más de lo que parecía esta
mañana:** los tres roles, los techos por rol **y la autorización al aprobar**. Es
la historia entera —«cada quien vende hasta donde puede, y lo que se sale lo
firma su jefe»— y es verdad, no una promesa.

---

## Lo que hay que decidir antes de escribir código

1. ~~¿Un descuento de la lista preaprobada cuenta contra el techo?~~
   **CONTESTADA el 29/09: no cuenta y puede superarlo**, porque se autorizó antes
   para un caso concreto. De ahí que el preaprobado lleve condición.
2. **¿Qué pasa con el rol `COMERCIAL` que ya existe?** Con estos tres, se solapa.
   Y ojo: **un valor de enum de Postgres no se puede quitar**, así que si se
   retira, se retira *de uso*, no del esquema. ¿Se conserva, se reparte su gente
   entre los tres nuevos, o se deja como está para quien no quiera el detalle?
3. **¿El director comercial ve el margen?** Aprobar un descuento sin ver cuánto
   margen deja es firmar a ciegas. Si debe verlo, la bandeja necesita el dato del
   reporte de rentabilidad, y eso la encarece.
4. **¿El gerente de ventas aprueba algo?** Hoy no aprueba nada, solo pide. En
   muchos equipos el gerente autoriza hasta cierto punto y escala al director por
   encima. **Dos niveles cuestan poco más que uno si se diseñan juntos, y mucho
   más si se añaden después.**
5. **La calculadora: ¿qué calcula?** Sin la lógica no se puede ni dimensionar.
6. **El administrador**, ahora en tres partes:
   - **6a** · ¿Puede **cambiar de organización** (el salto de plataforma)? Yo diría
     que no: eso es de flota, no de empresa.
   - **6b** · ¿Puede **dar de baja usuarios**, incluido el Dueño? Con
     `administracion: crear` puede. ¿Es lo que se quiere?
   - **6c** · ¿Debería impedirse **quedarse sin ningún Dueño**? Hoy nada lo
     impide y no se ha comprobado.
7. **¿Qué condiciones admite un preaprobado?** Por arrendador y por volumen son
   las dos nombradas. Por cliente, por franja, por temporada o por tipo de medio
   son posibles y **cada una encarece**. Y la regla que no se negocia: **una
   condición que no se pueda comprobar no se admite**.
9. **¿Se impide quedarse sin ningún Dueño?** Hoy nada lo impide.
10. **Los usuarios que hoy son COMERCIAL, ¿a qué rol pasan?** `VENDEDOR` es lo
    natural, pero es una decisión de personas.
11. **¿Preaprobados de propuesta entera ahora, o las seis condiciones con
    descuento por línea?** Lo segundo suma 2–3 días de zona roja.
8. **¿Un vendedor puede aprobar una propuesta SIN descuento?** «Sin descuento,
   cualquiera» — conviene confirmar que incluye al propio vendedor que la hizo.
   Es lo natural, pero significa que una venta a tarifa de lista se cierra sola.

---

## Lo que NO se ha verificado

- **Cuántos usuarios hay hoy de cada rol**, ni si alguien está usando `COMERCIAL`
  para hacer de vendedor. Se mide en cada instancia, y no se ha mirado.
- **Si `rol_demo` se usa en algún sitio que asuma exactamente seis valores** —un
  `switch` sin `default`, un mapa de etiquetas—. Añadir tres valores a un enum es
  barato en la base y puede no serlo en el código.
- **Nada de esto se ha construido.** No hay migración escrita ni código. El ADR
  es el diseño, y la migración espera aprobación explícita.

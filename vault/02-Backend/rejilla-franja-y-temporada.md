---
tipo: contrato
estado: verificado
actualizado: 2026-10-05
tags: [backend, precios, tarifas, franjas, temporadas, propuestas, dinero, snapshot, rls, programacion]
archivos:
  - db/migrations/20260928_rejilla_franja_temporada.sql
  - apps/web/lib/rejilla.ts
  - apps/web/lib/server/rejilla-repo.ts
  - apps/web/lib/server/rejilla-controller.ts
  - apps/web/app/api/rejilla/franjas/route.ts
  - apps/web/app/api/sitios/[id]/rejilla/route.ts
  - apps/web/lib/server/propuestas-repo.ts
  - apps/web/lib/server/propuestas-controller.ts
  - apps/web/lib/server/sitios-repo.ts
  - apps/web/components/demo/rejilla/AvisoFranjaCMS.tsx
  - apps/web/components/demo/rejilla/GestionRejilla.tsx
  - apps/web/components/demo/rejilla/RejillaDialog.tsx
  - db/migrations/20261002_franja_programada_campana.sql
  - apps/web/lib/franja-programada.ts
  - apps/web/lib/server/programacion-repo.ts
  - apps/web/lib/server/programacion-controller.ts
  - apps/web/app/api/campanas/franja-programada/route.ts
  - apps/web/lib/data/programacion-api.ts
  - apps/web/components/demo/rejilla/ProgramacionPorFranja.tsx
  - apps/web/components/demo/campanas/FranjaProgramadaCampana.tsx
  - apps/web/lib/test/franja-programada.e2e.test.ts
  - apps/web/lib/tarifa-calculada.ts
  - apps/web/lib/server/tarifas-repo.ts
---

# La rejilla de precios: franja horaria y temporada

**ADR 0039, Fase 1.** Hasta el 2026-09-28 el precio de venta era **un solo
número** por `(pantalla, unidad)` — `sitio_modalidades`, con su
`unique (sitio_id, unidad)`. Desde aquí es

```
tarifa base = f(pantalla, unidad, FRANJA, FECHA)
```

y la fecha entra por la **temporada** que la cubre. Las capas de descuento
—volumen, código promocional, paquete cerrado— son las fases 2, 3 y 4 del mismo
ADR y **no existen todavía**.

> [!note] 2026-10-05 · las otras tres capas YA existen, y el servidor recalcula la tarifa
> Volumen, cupón y paquete están en `main`: [[descuento-por-volumen]],
> [[codigo-promocional]], [[paquete-cerrado]]. Y desde `17fbd252` (01/10) la
> tarifa base de cada línea **la recalcula el servidor**: `tarifaCalculada`
> (`apps/web/lib/tarifa-calculada.ts:95`) toma las modalidades de la pantalla
> (`modalidadesDeSitio`, `:55`), deduce la temporada de la fecha de inicio y,
> si la pantalla tiene filas de rejilla **para esa unidad**, llama a
> `resolverTarifa` (`apps/web/lib/rejilla.ts:251`); si no, se queda con la
> modalidad. `crearPropuestaCtrl` la usa línea a línea
> (`apps/web/lib/server/propuestas-controller.ts:359-375`) con los datos de
> `datosParaTarifar` (`apps/web/lib/server/tarifas-repo.ts:45`), y un precio que
> no coincide **al centavo** sin `comercial.aprobar` se rechaza con 403. El
> orden de la tabla de abajo es el que aplica hoy, en la pantalla y en el
> servidor.

> [!warning] Alcance
> Esta nota describe **solo** franja y temporada. Si un documento te habla de
> descuentos por volumen, códigos promocionales o paquetes cerrados dentro de
> esta fase, está describiendo trabajo que no se ha hecho.
>
> *(2026-10-05: «dentro de esta fase». Las tres capas existen hoy como fases
> propias, con su nota cada una.)*

---

## Las dos decisiones de diseño, y por qué

### 1 · Las franjas son POR ORGANIZACIÓN

No son fijas para toda la flota. El motivo no es preferencia: **este producto son
instancias soberanas** ([[01-Arquitectura/modelo-instancias-soberanas]]) — cada
dueño corre su copia con su mercado, y el prime de una pantalla en un centro
comercial no es el de una en carretera.

El repositorio ya tenía la respuesta **de los dos lados**, y la diferencia es la
que decide:

| | Molde | Por qué |
|---|---|---|
| `catalogo_roles_entidad` | **De la flota**, sin `tenant_id`, sin CRUD | Cinco papeles fiscales que valen igual para todos; se corrigen por migración |
| `entidades_fiscales` | **Del owner**, con `tenant_id` y su pantalla | Son datos del negocio de cada uno |

Una franja horaria es un dato del owner: la define su mercado, no el producto.
Sigue el molde de `entidades_fiscales`.

**Lo que cuesta:** dos tablas más, una pantalla de configuración más, y un dueño
que empieza con la rejilla vacía. Ese coste no se paga por adelantado porque la
rejilla es **dispersa** (ver abajo).

### 2 · La temporada es una ENTIDAD PROPIA, no una vigencia sobre la fila

La alternativa era `desde`/`hasta` en cada fila de tarifa. Descartada por dos
razones, y ninguna es estética:

- **«Buen Fin» son unas fechas para TODO el inventario.** Como vigencia por fila,
  esas dos fechas se reescriben en cada `(pantalla × unidad × franja)` que la
  tenga —cientos de copias del mismo hecho— y moverla un día obliga a editarlas
  todas. Las que se escapen **no dan ningún error**: cobran el precio de
  temporada un día de más. Es la «segunda verdad que envejece» que este
  repositorio ya documentó en `lib/server/tenant.ts:87-89` y en
  `20260928_vendedor_en_propuesta.sql` al negarse a copiar el vendedor a
  `campanas`. *(2026-10-05: la cita de `tenant.ts` no se sostiene — ni hoy ni
  el 28/09 hubo ahí nada sobre una «segunda verdad»; lo más cercano son
  `:86-88`, que hablan de no duplicar **lógica**. La frase literal está en la
  migración del vendedor, `db/migrations/20260928_vendedor_en_propuesta.sql:62`.)*
- **Sin entidad no hay dónde prohibir el solape.** Dos filas con vigencias
  cruzadas darían dos precios para el mismo día y el desempate lo decidiría el
  `order by` que tocara.

**Fechas concretas con año**, no un patrón anual recurrente: «Buen Fin 2026» y
«Buen Fin 2027» son dos filas, porque las fechas cambian cada año y proyectar un
patrón al año de la venta sería cálculo escondido sobre dinero.

---

## El esquema

`db/migrations/20260928_rejilla_franja_temporada.sql` — aditiva entera. No toca
una sola fila existente, ni ninguna restricción anterior, ni `db/schema.sql`.

| Tabla | Qué es |
|---|---|
| `franjas_horarias` | `tenant_id`, `nombre`, `hora_inicio`, `hora_fin` (texto `HH:MM` con CHECK), `orden`, `activo` |
| `temporadas` | `tenant_id`, `nombre`, `desde`, `hasta` (date), `activo` |
| `sitio_tarifas` | La rejilla: `sitio_id`, `unidad`, `franja_id`, `temporada_id`, `tarifa_publicada` |

Y dos columnas nuevas: **`propuesta_items.franja_id`** (qué franja se contrató) y
**`reservas.franja_id`** (la hereda del ítem al generar la campaña).

### Por qué una tabla nueva y no ampliar `sitio_modalidades`

Tres motivos, y el tercero decide:

1. **PostgreSQL 14.** Un `unique (sitio_id, unidad, franja_id, temporada_id)`
   **no deduplica cuando las columnas son NULL**: dos filas «sin franja» de la
   misma pantalla entrarían las dos. `nulls not distinct` es sintaxis de la 15 y
   **g500 corre 14.24**. Aquí se resuelve con `coalesce` al uuid nulo dentro de
   un índice de expresión, que funciona en 14.
2. `on conflict (sitio_id, unidad)` se apoya **hoy** en ese unique
   (`sitios-repo.ts`, la captura desde la ficha del 28/09). Cambiarlo convertiría
   ese upsert en un insert duplicado, y el síntoma sería una tarifa que «no se
   guarda» sin ningún error.
3. **Y el decisivo:** `actualizarSitioCompleto` hace
   `delete from sitio_modalidades where sitio_id = $1` y reinserta lo del
   archivo. Para una re-importación es correcto. Si la rejilla viviera ahí,
   **volver a importar un CSV borraría la rejilla entera de esa pantalla en
   silencio.** Perder un precio no da error: solo se deja de cobrar.

Con tabla aparte, el invariante «lo que no tiene franja se vende como siempre»
deja de ser una convención del código y pasa a ser **estructural**.

### Las FK a franja y temporada son COMPUESTAS `(id, tenant_id)`

Al revés que `propuestas.usuario_id` del mismo día, y el motivo es que **aquí el
agujero SÍ es alcanzable**: `usuario_id` sale de la sesión; **`franja_id` entra
por el cuerpo de la petición** —el vendedor la elige en un selector—. Una FK
plana se comprueba con los privilegios del dueño de la tabla y **elude la RLS**:
solo exigiría que la franja existiera en algún sitio. Es el agujero exacto que
midió `20260918_entidad_tenant_compuesto.sql` con `entidad_id`.

Y **sí se puede en PostgreSQL 14**: lo que exigía la 15 en aquella migración era
`on delete set null (columna)`, no la FK compuesta.

`propuesta_items.franja_id` y `reservas.franja_id` van con **`on delete
restrict`**: una franja contratada es un hecho. Por eso el repositorio **no
ofrece borrado** — la baja es lógica (`activo = false`), como en
`entidades_fiscales` y `arrendadores`.

> [!warning] Lo que la base NO hace
> **El solape NO se prohíbe en el esquema.** Una franja que cruza la medianoche
> son dos tramos, y una restricción de exclusión necesitaría `btree_gist` —que no
> está garantizada en toda la flota— y aun así no sabría partir el tramo. El
> guardián es `lib/rejilla.ts`, declarado una vez e importado por todos los
> caminos de escritura. Queda como pregunta abierta si conviene además en la base.

---

## La resolución del precio — `lib/rejilla.ts`

Módulo **puro**, hermano de `lib/modalidades.ts` y por el mismo motivo: la regla
«cuál de estas filas manda» la necesitan **cuatro** sitios —la ficha al guardar,
el cotizador al calcular, el controller al validar y el congelado al aprobar— y
cuatro copias divergen. Aquí divergir significa **cobrar un precio que nadie
decidió**.

`resolverTarifa({ tarifaBase, rejilla, franjaId, temporadaId })` baja escalones
hasta encontrar fila:

| Orden | Fila | `origen` |
|---|---|---|
| 1 | `(franja, temporada)` | `franja+temporada` |
| 2 | `(franja, —)` | `franja` |
| 3 | `(—, temporada)` | `temporada` |
| 4 | `(—, —)` | `rejilla` |
| 5 | ninguna → `sitio_modalidades` | `modalidad` |

**Entre 2 y 3 gana la FRANJA**, y hay que saber por qué: la franja la **escoge**
el vendedor y queda contratada; la temporada se **deduce** de la fecha. Entre dos
filas igual de específicas manda la que alguien eligió a propósito.

**Un `0` de la rejilla es un precio, no un hueco.** El desempate se hace por
presencia de fila y nunca con `?? tarifaBase` sobre el importe: una madrugada
regalada a conciencia saldría cobrada a tarifa completa, y nadie lo vería.

### Las reglas de validación

- **Franja**: `HH:MM` en 24 h, **fin EXCLUSIVO** (06:00–10:00 y 10:00–14:00 se
  tocan y no se pisan), duración cero prohibida, cruce de medianoche permitido, y
  **solape prohibido** contra todas las del catálogo —**incluidas las
  desactivadas**, porque si no, reactivar una dejaría dos precios para la misma
  hora sin saber desde cuándo—.
- **Temporada**: `AAAA-MM-DD`, **ambos extremos inclusivos**, solape prohibido.
  Que «Diciembre» y «Buen Fin» no puedan convivir tal cual es deliberado: obliga
  al dueño a decidir qué precio manda esos días.

Las fechas se comparan **como cadenas**. Un `new Date('2026-11-13')` es un
instante UTC y en México se imprime como el día 12.

---

## El congelado — el invariante que decide si esta fase está bien hecha

`propuestas.snapshot_economico` ya congelaba la escalera económica. Ahora
`porSitio[]` lleva además:

```json
{ "sitioId": "...", "lista": 1800, "neto": 1800, "tarifaUnitaria": 1800,
  "franja": { "id": "...", "nombre": "Prime", "horaInicio": "06:00", "horaFin": "10:00" },
  "temporada": { "id": "...", "nombre": "Buen Fin" } }
```

y, cuando alguna línea lleva franja, un `avisoFranja` con el texto del CMS.

**Se congelan los NOMBRES, no solo los ids**, y es lo contrario de lo que se
decidió el mismo día con el vendedor. No es incoherencia: una **propuesta** es un
registro vivo y el nombre debe seguir al usuario; un **snapshot** es una línea de
bitácora congelada, como `acciones.usuario_nombre`. Si el dueño renombra «Prime»
o lo desactiva, la propuesta firmada tiene que seguir imprimiendo lo que se
vendió.

La temporada **no** se guarda en `propuesta_items`: se deduce de `fecha_inicio`.
Copiarla ahí sería una segunda verdad que envejece. En el snapshot sí, porque ahí
deja de ser un dato vivo.

**Medido** en `rejilla-franja-temporada.e2e.test.ts` §5: se vende el prime a
1 800, se aprueba, el dueño lo sube a 2 500 **y renombra la franja**, y el
snapshot no se mueve ni en el precio, ni en el nombre, ni en el horario.

---

## La franja NO viaja al CMS, y el producto lo dice

El SDK de DOOHmain acepta `--version --anunciante --campana --fecha-inicio
--fecha-fin --filepath --screen --list --cant-dia`
(`doohmain_sdk/__main__.py:66-75`). **No hay `--hora` ni `--dias`.**

Decisión del dueño (2026-09-28): se construye igual, como **capa comercial**. Se
vende y se cobra por franja, y **alguien la programa a mano en el CMS**.

El texto vive **una sola vez** en `AVISO_FRANJA_NO_VIAJA_AL_CMS` (`lib/rejilla.ts`)
y lo pinta **un solo componente**, `AvisoFranjaCMS`. Aparece en **ocho sitios**
(seis hasta el 30/09):

1. La pantalla donde se **configuran** las franjas — antes de montar la tabla de
   precios sobre algo que el sistema no agenda.
2. El cuadro donde se **capturan** las tarifas por franja, en la ficha.
3. El cuadro de la **propuesta**, pegado al selector, y solo cuando alguien ya
   eligió una franja: puesto siempre se vuelve decorado.
4. El **detalle** interno de la propuesta, bajo la tabla que enseña la franja.
5. **La LIGA PÚBLICA** (`/p/[id]`) — la que ve el **cliente** y donde la acepta.
   Es la que más importa de todas.
6. **Dentro del `snapshot_economico` congelado** — el que dura cuando las cinco
   pantallas hayan cambiado.
7. **Horario de transmisión** en Franjas y temporadas (`ProgramacionPorFranja`,
   PROG-01, 30/09).
8. **Horario de transmisión** en el detalle de campaña
   (`FranjaProgramadaCampana`, PROG-01).

`lib/rejilla-aviso.test.ts` nombra las superficies y cae si a una le quitan el
aviso — y desde el 30/09 también si la página deja de **montar** el componente
de la 7 o de la 8.

> [!warning] Lo que esa prueba NO puede hacer
> Vigila una **lista escrita a mano**. Protege las cinco pantallas que hay hoy;
> **no obliga** a que una sexta nazca con el aviso. Si mañana aparece otra que
> enseñe una franja, hay que añadirla a `SUPERFICIES`.

---

## Lo que NO cambia — el invariante 1

**Una pantalla sin filas de rejilla se vende exactamente como hoy.** La rejilla
es dispersa: se puebla donde el dueño quiera. Y una pantalla *con* rejilla a la
que se le contrata una franja sin fila propia **también se vende**: cae al
escalón siguiente. **En ningún camino se impide vender por falta de captura.**

El catálogo vacío también se nota en la UI: el selector de franja del cotizador
**no se pinta** si no hay franjas, así que vender tiene la misma forma que antes
de que esto existiera.

---

## Las rutas

| Ruta | Guard |
|---|---|
| `GET /api/rejilla/franjas` | **`precios.ver`** — devuelve franjas **y** temporadas |
| `POST /api/rejilla/franjas` | **Cambio sensible** (`exigirCambioSensible('precios','crear')`) |
| `PATCH · DELETE /api/rejilla/franjas/[id]` | Sensible, `precios.crear`. `DELETE` es **baja lógica** |
| `POST /api/rejilla/temporadas` · `PATCH · DELETE /api/rejilla/temporadas/[id]` | Sensible, `precios.crear` |
| `GET /api/sitios/[id]/rejilla` | `inventario.ver` |
| `PATCH /api/sitios/[id]/rejilla` | Sensible **entera** (`inventario.crear`), sin lista blanca de campos |
| `GET /api/campanas/franja-programada` | `comercial.ver` — la franja en que **se transmite** cada campaña (PROG-01, abajo) |
| `PUT /api/campanas/franja-programada` | `comercial.aprobar` (gerente, director, administrador y Dueño; decision del 30/09) — en bloque y atómico. **No** es cambio sensible: no mueve precio |

> [!warning] Corregido el 2026-09-30: esta tabla decía `inventario.ver`
> Desde el ADR 0040 (29/09) el catálogo de franjas va bajo el módulo **`precios`**
> (`app/api/rejilla/franjas/route.ts:40`, y `rbac-coherencia.test.ts` lo exige).
> La tabla se quedó con el módulo de antes; lo vio la tarea PROG-01 al leerla.
> La captura desde la ficha (`/api/sitios/[id]/rejilla`) sí sigue en
> `inventario`, a propósito: ver el comentario de esa prueba.

El candado es **exactamente** el de `PATCH /api/sitios/:id/modalidades` —
`exigirCambioSensible` y no `exigirReautenticacionSiempre`— porque es el mismo
dinero. Pedir aquí más que para la tarifa escalar sería una incoherencia, y las
incoherencias se acaban resolviendo por el lado malo.

Y se sigue el camino que aquella ruta dejó marcado en su cabecera: *«el día que
llegue otra tarifa por unidad —un recargo por franja— nadie se acordará»*. Pues
llegó, y va por **ruta propia**, no por una cadena más en una lista blanca.

---

## Dónde se ve en la aplicación

- **Franjas y temporadas** (`/franjas-y-temporadas`, módulo **`precios`** desde
  el ADR 0040 —`lib/modulos.ts`—, menú para mando y jefes de venta): el catálogo
  de la organización, y debajo, desde el 30/09, el **horario de transmisión**
  (`ProgramacionPorFranja`).
- **Detalle de campaña** (`/campanas/[id]`): cuadro «Horario de transmisión»
  (`FranjaProgramadaCampana`), montado con una línea bajo el Pipeline.
- **Ficha de la pantalla**: cuadro «Tarifas por franja», aparte del de «Tarifas
  por unidad» — dos tablas con dos semánticas, y un solo formulario obligaría a
  que un botón sirviera para las dos.
- **Cotizador de propuestas**: selector de franja por pantalla, con «Todo el día»
  por omisión. El precio se resuelve **en el cliente** con la misma
  `resolverTarifa` del servidor, sobre `sitio.rejilla`, que viaja con la pantalla
  en una sola consulta para todas. *(2026-10-05: y desde el 01/10 el servidor lo
  vuelve a calcular con la misma función, `tarifaCalculada`, y lo compara —ver
  la nota del principio—. Lo que pinta el cliente ya no es lo que manda.)*

---

## La franja PROGRAMADA — en qué horario se transmite (PROG-01, 2026-09-30)

> [!danger] SIN FUSIONAR — la forma de la base espera la aprobación del dueño
> Rama `feat/franja-programada`. Si lees esto en `main`, ya se aprobó.
>
> **2026-10-05 · se aprobó y está en `main`**: `16c4d367` y la migración
> `20261002_franja_programada_campana.sql`.

**Decisión del dueño**, textual: *«es para horario transmisión ya que el precio
ya debe de estar en la campaña después de la propuesta»*. Desde Franjas y
temporadas —o desde la propia campaña— se eligen **una o varias campañas** y se
les dice en qué franja **salen al aire**.

Hay por tanto **dos franjas** en la vida de una campaña, y no se mezclan:

| | Dónde vive | Quién la escribe | ¿Mueve precio? |
|---|---|---|---|
| **Contratada** | `reservas.franja_id` (y congelada en el snapshot) | Se hereda del ítem al generar la campaña. **Prohibido elegirla** en la campaña (`campanas-repo.ts`, inserción desde propuesta) | Sí: es lo vendido |
| **Programada** | `campanas.franja_programada_id` | `PUT /api/campanas/franja-programada` | **No** |

Nada de PROG-01 escribe en `reservas.franja_id`, `propuesta_items`, precios ni
`snapshot_economico`. Lo prueba `franja-programada.e2e.test.ts` §6: programa y
desprograma, y lo contratado sale **idéntico**.

### Por qué por campaña y no por reserva

El dueño lo pidió por campaña. Una columna por reserva daría granularidad por
pantalla a costa de que un lote de diez campañas escriba cientos de filas y de
que la pantalla tenga que repartir la misma franja N veces. Si mañana hace
falta que una pantalla salga en otro horario que su campaña, se añade **esa**
columna como excepción y la de la campaña sigue siendo la regla.

### La operación en bloque es TODO O NADA

`asignarFranjaProgramada` (`lib/server/programacion-repo.ts`) comprueba, dentro
de una sola `withTenantTx`, que la franja es **de la organización y está
activa**, y que **todas** las campañas del lote lo son (`for update`). Si falta
una, **no escribe ninguna** y el 404 lo dice: *«no se programó ninguna»*. Por
eso la pantalla tiene dos gestos atómicos —«Programar N en Prime» y la × de cada
campaña— y no un «guardar» con altas y bajas, que serían dos peticiones.

La FK compuesta `(franja_programada_id, tenant_id)` es la capa que cierra R2 en
la base: `franja_programada_id` entra por el cuerpo. La validación del repo
existe además porque la FK **deja pasar una franja dada de baja**.

### Avisar, no bloquear — decidido por el dueño el 2026-09-30

Si la programada difiere de la contratada, `avisosDeProgramacion`
(`lib/franja-programada.ts`, pura) produce *«Se vendió como «Prime» (2
pantallas) y se programa en «Noche»…»*. Se calcula en el **servidor** y las dos
pantallas solo lo pintan. Tres reglas:

- sin franja programada **no se avisa** (no hay contraste);
- lo vendido **sin franja** («todo el día») **no** es una discrepancia;
- las reservas **canceladas** no cuentan.

**Se avisa y se guarda igual**, y así lo decidió el dueño el 30/09 («avisar»).
Si algún día se quisiera bloquear, el cambio sería en esa función y en el
controller, no en las pantallas.

### Permiso

Programar pide **`comercial.aprobar`** y leer, **`comercial.ver`**. Decisión del
dueño del 2026-09-30: *«como la franja es después de la creación de la campaña,
puede solo gerente comercial, directivo y dueño»*. `comercial.crear` —lo que
piden confirmar, extender o repartir creativos— lo tiene también el VENDEDOR;
`comercial.aprobar` lo tienen DUENO, ADMINISTRADOR (el ADR 0040 le da lo mismo
que al Dueño), DIRECTOR_COMERCIAL y GERENTE_VENTAS. Se reutiliza el permiso que
ya existía, sin migración. El GET devuelve `puedeProgramar` con la misma regla,
y las dos pantallas esconden los controles sin él (un botón que el servidor
niega es el «encierro»). La e2e §5 fija los cinco roles.

No es cambio sensible: no mueve dinero. La lectura devuelve nombre y horario de
las franjas a quien no tiene `precios.ver`, porque un nombre no es un precio.

---

## Lo que queda abierto

- **El `PATCH` de una franja es en realidad un reemplazo completo**: el esquema
  exige `nombre`, `horaInicio` y `horaFin`, así que una petición parcial se
  rechaza con un 400 en vez de fusionar. Hoy no molesta porque la pantalla de
  configuración no edita franjas —solo crea y da de baja—, pero el día que se
  añada el botón de editar hay que mandar el objeto entero o cambiar el esquema.
- **`tarifaUnitaria` sigue llegando del cliente**, y esto **no lo introduce esta
  fase**: `propuestas-controller.ts` ya calculaba `precio = tarifaUnitaria ×
  cantidad` confiando en la tarifa que manda la UI. La rejilla lo hace más
  visible —ahora hay una tabla de precios que se podría contradecir— pero el
  agujero es anterior y cerrarlo significa resolver el precio en el servidor,
  que cambia el comportamiento de TODA venta. Es una decisión del dueño.
  **Cerrado el 2026-10-01** (`17fbd252`, PRECIO-01): el dueño decidió que el
  precio se calcula y solo un gerente o superior lo cambia. La `tarifaUnitaria`
  sigue llegando en el cuerpo, pero el servidor la compara contra
  `tarifaCalculada` y la rechaza si difiere sin permiso
  (`apps/web/lib/server/propuestas-controller.ts:359-375`). Ver
  [[comercial-propuestas-campanas]].

- **Nadie ha medido cuántas filas genera** la rejilla en un inventario real.
  Siete unidades × N franjas × M temporadas crece rápido (ADR 0039 ya lo decía).
- **No se ha consultado con un operador de CMS** si programar franjas a mano es
  aceptable en su día a día. Es el supuesto sobre el que descansa toda la fase.
- **El importador CSV todavía no acepta la franja**: la rejilla se captura desde
  la ficha o por API. El importador sigue escribiendo solo `sitio_modalidades`.
- **El reporte `tarifa` (publicada vs neta) todavía no distingue por franja.**
  Lee del snapshot, que ya la trae congelada, pero no la usa como dimensión.
- Si la flota llega a PostgreSQL 15, el solape podría cerrarse también en el
  esquema.

## Notas relacionadas

- [[02-Backend/inventario-y-sitios]] — `sitio_modalidades` y la tarifa base
- [[02-Backend/comercial-propuestas-campanas]] — propuestas, snapshot, reservas
- [[02-Backend/tarifa-publicada-vs-neta]] — la dimensión `tarifa` del reporte
- [[02-Backend/multi-tenancy-y-rls]] — R2 y las FK compuestas
- [[04-Datos/esquema]] · [[04-Datos/migraciones]]
- [[06-Operacion/zonas-de-riesgo]]

# ADR 0051: El CRM comercial: oportunidades encima de `prospectos` y `propuestas`, con el cotejo de lo que pide el cliente contra lo que se le cotiza

- **Fecha:** 2026-11-17
- **Estado:** **Aceptada (17/11, el dueño aprobó la forma de la migración de §1 a §4).** Es ROJO:
  R3 (migración) y R4 (toca el flujo de Propuestas, que es dinero). Las preguntas 2 y 4 se
  contestaron el 17/11; siguen abiertas la 3 y la 5. **Fase 1 hecha el 17/11** (sin
  migración): `lib/crm-cotejo.ts` y la vista «Por cliente» en Propuestas. **Fase 2 hecha el 17/11**:
  `20261117_crm_oportunidades.sql`, `/api/oportunidades/**` y su e2e (ver «Cómo quedó la Fase 2»).
  **Fase 3 hecha el 17/11**, con el historial escrito por **trigger** y no desde el repo (decisión
  del dueño; ver «Cómo quedó la Fase 3»). **Fase 4 terminando el 17/11** (en el commit `wip(crm)`
  `37b5f4dd`, sin empujar): `/crm`, la ficha de la oportunidad y «CRM» en el menú (ver «Cómo quedó
  la Fase 4»).
- **Rama:** `feat/crm-comercial`, desde `main` `17f56561` (v0.12.13).
- **Relacionado:** [ADR 0047](0047-comercial-negociacion-encima-de-prospectos.md) (Prospección
  encima de `prospectos`; este ADR reutiliza su tabla para el lado cliente y respeta su decisión de
  no duplicar). [ADR 0048](0048-la-moneda-es-de-la-instancia-y-no-se-cambia.md) (la moneda es de la
  instancia: el presupuesto no lleva moneda propia).

## Contexto

El 2026-11-17 el dueño pidió que Propuestas crezca hasta ser un CRM de clientes de publicidad.
Quiere ver, por cliente: **cuánto quiere gastar**, **cuánto tiempo llevamos negociando**, **cuántas
cotizaciones lleva** y **qué cambios hacen el vendedor y los demás**.

Lo que existe hoy no alcanza para eso:

- **`propuestas`** guarda cliente, estatus, `version` (solo un número), vendedor (`usuario_id`,
  `vendedor_nombre`), vigencia y las fechas de aprobación y rechazo. **Nada agrupa varias
  cotizaciones de un mismo cliente**, ni guarda lo que el cliente pidió, ni qué cambió entre
  versiones.
- **`prospectos`** (CAP-01 y NEG-01) ya tiene el tipo `CLIENTE`, contactos, notas, bitácora y la
  regla «el vendedor solo ve lo suyo». Desde la v0.12.13 su pantalla, Prospección, vive en
  Inventario y se usa para el lado de los espacios.
- **`acciones`** es la bitácora general (append-only): demasiado genérica para decir «bajó el
  descuento del 10 al 15 %».

El dueño eligió el 17/11 combinar dos opciones: **una entidad nueva, la oportunidad (B)**, y
**reutilizar `prospectos` de tipo `CLIENTE` (C)**, para tener el cotejo. Y decidió además:

| Pregunta | Decisión |
|---|---|
| Detalle del historial | **Campo por campo**: quién, cuándo, valor anterior → nuevo |
| Quién ve qué | **Igual que Captación**: el vendedor lo suyo; quien puede aprobar, todo |
| Menú | **«CRM» en Comercial, con Propuestas dentro** como pestaña |
| ¿Propuesta sin oportunidad? | **Sí, opcional**. Las de hoy siguen igual; se pueden ligar después |

## Decisión

```
prospectos (tipo CLIENTE)        ← C · el lead: contactos, notas, bitácora (lo que ya hay)
   │  al aprobarse nace el cliente (registro_id); la historia se queda
   ▼
oportunidades                    ← B · NUEVA: lo que el cliente QUIERE
   │  oportunidad_actividades    ← NUEVA, append-only: llamadas, juntas, cambios de etapa
   ▼
propuestas 1..n (oportunidad_id) ← lo que COTIZAMOS (opcional)
   └─ propuesta_cambios          ← NUEVA, append-only: campo por campo
```

### 1 · `oportunidades` — lo que el cliente quiere

| Columna | Tipo | Nota |
|---|---|---|
| `id`, `tenant_id` | uuid | RLS forzada; `unique (id, tenant_id)` para las FK compuestas |
| `prospecto_id` | uuid null | FK compuesta `(prospecto_id, tenant_id)` → `prospectos`, solo tipo `CLIENTE` (lo comprueba el repo con la fila bloqueada) |
| `cliente_id` | uuid null | FK compuesta `(cliente_id, tenant_id)` → `clientes`. **Requiere añadir `clientes_id_tenant_uq`**, que hoy no existe |
| | | CHECK: al menos uno de los dos. Al aprobar el prospecto se rellena `cliente_id` y el prospecto se conserva |
| `nombre` | text | «Campaña Navidad 2026», 1..200 |
| `usuario_id` | uuid | el **vendedor**, de la sesión, nunca del cuerpo (VEND-01) |
| `etapa` | text | `CONTACTO · NECESIDAD · COTIZANDO · NEGOCIANDO · GANADA · PERDIDA` |
| `probabilidad_pct` | smallint | 0..100; por omisión la de la etapa |
| `presupuesto_min`, `presupuesto_max` | numeric(14,2) | ≥ 0 y min ≤ max. Sin moneda: es la de la instancia (ADR 0048) |
| `fecha_inicio_deseada`, `fecha_fin_deseada` | date | lo que pide; inicio ≤ fin |
| `fecha_decision` | date | cuándo dice el cliente que decide |
| `plazas`, `tipos_medio`, `objetivo` | text, text[], text | la necesidad, en sus palabras |
| `motivo_perdida` | text | CHECK: obligatorio si `etapa = 'PERDIDA'` |
| `ganada_en`, `perdida_en` | timestamptz | los pone el repo |
| `creado_en`, `actualizado_en` | timestamptz | trigger `set_actualizado_en` |

**Las oportunidades no se borran** (`revoke delete`, como las ofertas de NEG-01): la que no
prospera se marca `PERDIDA` con su motivo. Por eso la FK desde `propuestas` puede ser `restrict`.

### 2 · `oportunidad_actividades` — la línea de tiempo comercial

`id, tenant_id, oportunidad_id (FK compuesta), usuario_id, usuario_nombre (congelado), tipo
(LLAMADA · VISITA · REUNION · CORREO · WHATSAPP · NOTA · ETAPA), nota, etapa_anterior,
etapa_nueva, siguiente_paso, siguiente_paso_fecha, creado_en`. **Append-only por trigger**, como
`acciones` (20260629): el BFF conecta como superusuario y el trigger se dispara igual.

Cada cambio de etapa escribe aquí una fila `ETAPA` en la misma transacción: de ahí salen los
**días en cada etapa** sin otra columna.

> **Por qué no se reutiliza `prospecto_avances`**, si el ADR 0047 pidió no duplicar la bitácora:
> una oportunidad de un cliente que **ya existe** no tiene prospecto del que colgar. La pantalla
> **une las dos** en una sola línea de tiempo (avances del prospecto + actividades de la
> oportunidad + cambios de sus propuestas); lo que no se hace es escribir lo mismo en dos sitios.

### 3 · `propuestas.oportunidad_id`

`uuid null`, FK compuesta `(oportunidad_id, tenant_id)` → `oportunidades`, `on delete restrict`.
Opcional: las propuestas de hoy quedan sin ligar y funcionan igual. Al ligar, el repo comprueba
que el cliente de la propuesta (si tiene) coincide con el de la oportunidad.

### 4 · `propuesta_cambios` — campo por campo

| Columna | Nota |
|---|---|
| `id`, `tenant_id` | RLS forzada |
| `propuesta_id` | **sin FK a propósito**, como `prospectos.registro_id`: borrar un borrador (R5, PROP-COMPLETA) no debe llevarse su historia, y una FK en cascada chocaría con el trigger append-only |
| `folio` | congelado, para que el historial de un borrador borrado se siga leyendo |
| `version` | la de la propuesta en ese momento |
| `usuario_id`, `usuario_nombre` | de la sesión; nombre congelado |
| `origen` | `APP · CLIENTE · SISTEMA` (CLIENTE = la aceptación por la liga pública) |
| `accion` | `CREAR · EDITAR · AGREGAR_SITIO · QUITAR_SITIO · APROBAR_SITIO · CODIGO · PAQUETE · ESTATUS · ENVIAR · ACEPTAR · LIGAR · BORRAR` |
| `campo`, `item_id` | qué se tocó (`descuento_pct`, `fecha_fin`, …) y de qué renglón |
| `valor_anterior`, `valor_nuevo` | jsonb |
| `creado_en` | |

**Append-only por trigger.** Se escribe en `propuestas-repo.ts` **dentro de la misma transacción**
que el cambio, en cada función que muta: `crearPropuesta`, `actualizarPropuesta`, `agregarItems`,
`quitarItem`, `aprobarItem`, `cambiarEstatusPropuesta`, `asignarClienteAPropuestaAprobada`,
`borrarPropuestaBorrador`, `aceptarPropuestaPublica` y las rutas de código, paquete y enviar. Si el
historial falla, el cambio no se guarda: un historial con huecos es peor que ninguno, porque
quien lo lee deja de comprobar.

### 5 · Quién ve qué

- Las oportunidades viven en el módulo **`comercial`** (pantalla `crm` en `lib/modulos.ts`).
- **`soloDe`** con la forma de Captación: quien tiene `comercial.aprobar` ve todo; el resto, solo
  las oportunidades con su `usuario_id`. Una ajena es **404**, no 403.
- Los prospectos `CLIENTE` siguen con el permiso y las rutas de `captacion` (ADR 0047): no se
  abre un segundo sistema de permisos.

### 6 · El cotejo — calculado, no guardado

En la ficha de la oportunidad, sin columnas nuevas:

- **Presupuesto contra cotizado**: total de cada propuesta ligada **con la misma función de precio
  que ya usa Propuestas** (una sola fuente para el dinero), contra `presupuesto_min..max`, con la
  diferencia en importe y en %.
- **Fechas y plazas**: las pedidas contra las de cada propuesta.
- **Tiempo**: días desde el primer contacto (el más antiguo entre el prospecto y la oportunidad),
  días negociando y días en cada etapa (de las filas `ETAPA`).
- **Cotizaciones**: cuántas, en qué estatus y cuál es la vigente.
- **Cambios**: la línea de tiempo unida, filtrable por persona.

### 7 · Menú

- Entra **«CRM»** en el grupo Comercial (`vender`), en el lugar de «Propuestas», con pestañas
  **Embudo** (kanban por etapa) · **Oportunidades** · **Prospectos** (los `CLIENTE`) ·
  **Propuestas** (la pantalla de hoy).
- Las rutas `/propuestas/**`, la liga pública y la API **no cambian**: solo cambia cómo se llega.
- **Prospección** (Inventario) pasa a listar solo `ARRENDADOR`, `PREDIO` y `PANTALLA`. Es la misma
  tabla, con dos vistas.
- El diseño sigue el Dashboard aprobado el 26/10 como referencia.

## Fases

| Fase | Qué | Riesgo |
|---|---|---|
| **1** | Vista de cotejo por cliente con lo que ya existe: cotizaciones, días, montos y estatus. Sin migración | ÁMBAR |
| **2** | Migración + `oportunidades-repo/controller` + rutas `/api/oportunidades/**` + e2e de aislamiento | **ROJO R3** |
| **3** | `propuesta_cambios` escrito desde `propuestas-repo.ts`, y `oportunidad_id` al crear y al editar | **ROJO R4** |
| **4** | Pantalla CRM: menú, embudo, ficha con cotejo y línea de tiempo; Prospección filtrada; los idiomas de la instancia | ÁMBAR |

## Cómo quedó la Fase 2 (17/11)

Tal como §1 a §5, con cuatro precisiones que salieron al hacerla:

- **La probabilidad se guarda NULL cuando el vendedor no la pone**, y la tabla
  por etapa (`lib/crm.ts`, `PROBABILIDAD_POR_ETAPA`) se aplica **al leer**. Así la
  pregunta 3 sigue abierta sin costo: si el dueño cambia los números, cambian
  todas las oportunidades sin reescribir una fila.
- **El cliente que nace al aprobar el prospecto se lee, no se copia**:
  `coalesce(cliente_id, prospectos.registro_id)`. La aprobación de Captación no se
  tocó; §1 decía «se rellena `cliente_id`», y leerlo da lo mismo sin abrir otra
  zona ROJA.
- **`oportunidad_actividades` y `propuesta_cambios` no llevan FK a `usuarios`**,
  por la lección de `20261109_acciones_sin_fk_usuario.sql`: con `set null`, borrar un
  usuario sería un UPDATE que el trigger rechaza. La e2e lo comprueba.
- **Borrar un cliente con oportunidades da 409 genérico** («El registro está
  referenciado por otro»): la FK es `restrict` y `borrarCliente` no las cuenta en su
  desglose. No rompe nada (el cliente se queda y no hay 500); contarlas queda
  para la Fase 4.

## Cómo quedó la Fase 3 (17/11)

**El historial lo escribe la base, no `propuestas-repo.ts`.** §4 pedía escribirlo en cada función,
en la misma transacción que el cambio. Al hacerlo apareció que cuatro de ellas —`actualizarPropuesta`,
`aprobarItem`, `cambiarEstatusPropuesta` y `asignarClienteAPropuestaAprobada`— no usan transacción:
cada `q()` se guarda sola. Cumplir §4 obligaba a reescribirlas, incluida la que aprueba y congela el
dinero. **El dueño eligió el trigger** el 17/11:

- `20261117_propuesta_cambios_por_trigger.sql`: triggers `after` en `propuestas` y
  `propuesta_items` que comparan la fila vieja con la nueva **columna por columna** (de forma genérica:
  una columna nueva queda registrada sin tocar la migración) y escriben en `propuesta_cambios`. Al
  correr dentro de la sentencia, es la misma transacción por construcción, y **ninguna ruta —tampoco
  las de cupón y paquete, en otros archivos— puede saltárselo**. Eso hace innecesaria la prueba
  «que ninguna función se olvide»; la e2e recorre las rutas y comprueba lo que queda escrito.
- **Quién**: `lib/server/db.ts` fija `app.usuario_id` y `app.usuario_nombre` de la sesión junto con
  `app.tenant_id`, en la misma sentencia y TRANSACTION-LOCAL. Sin sesión, el origen es SISTEMA. La
  aceptación por la liga se reconoce por la fila (`aceptado_en` pasa a tener valor): CLIENTE, con el
  nombre que escribió.
- **Lo que no se registra**: los sitios que nacen con la propuesta (el alta es UNA fila CREAR) y los
  que se van con su borrado (UNA fila BORRAR).
- **`crm_solo_crece()`** deja pasar el borrado **solo** si la organización entera ya no existe: sin
  eso, borrar una organización con propuestas fallaría.

**Ligar** (§3): `oportunidadId` al crear (`POST /api/propuestas`) y `PATCH /api/propuestas/[id]`
con `{ oportunidadId }` solo (cualquier estatus; mezclado con otros campos es 400). Se revisa con la
oportunidad bloqueada: existe para quien liga (404), no está perdida y es del mismo cliente (409).

**Visibilidad** (respuesta a la pregunta 2): el vendedor ve **solo sus propuestas** en `/api/estado`,
en el resumen y en cada ruta por id (404); quien tiene `comercial.aprobar`, todas
(`lib/server/propuestas-visibilidad.ts`). Las de antes de VEND-01, sin `usuario_id`, solo las ve
quien ve todas. La liga pública no pasa por ahí.

## Cómo quedó la Fase 4 (17/11)

La pantalla, tal como §6 y §7, con lo que salió al hacerla:

- **«CRM» toma el lugar de «Propuestas» en el menú, y `/propuestas` sigue siendo suya.** La entrada
  `crm` (`components/demo/shell/nav.ts:202`) lleva `tambien: ['/propuestas']`, un campo nuevo de
  `NavItem` (`nav.ts:94-105`, con `rutasDe()`). Cuenta en dos sitios, y el segundo es el que
  importa: el `Sidebar` enciende «CRM» en `/propuestas/**` (`Sidebar.tsx:93-94`), y **la compuerta
  de `AuthGate` empareja la ruta con todas las de cada entrada** (`AuthGate.tsx:20-28`). Sin eso,
  `/propuestas` se habría quedado sin entrada en `NAV` y, por tanto, **sin compuerta de roles**. Los
  roles son los mismos que tenía Propuestas (`MANDO` + `VENTA`): nadie gana ni pierde acceso. El
  atajo del 404 cambia de clave (`lib/atajos-404.ts:43`).
- **Área `crm` en `lib/modulos.ts:34-36`**, del módulo `comercial`: no hay permiso nuevo. El área
  `propuestas` se queda (`modulos.ts:33`).
- **Las cuatro pestañas son enlaces, no estado** (`components/demo/crm/PestanasCrm.tsx`): Embudo,
  Oportunidades y Prospectos viven en `/crm?vista=…` (`app/(app)/(shell)/crm/page.tsx:23`), y
  Propuestas lleva a `/propuestas`, que pinta las mismas pestañas arriba de su lista
  (`propuestas/page.tsx:193`). Así no cambia ninguna dirección, ni la liga pública.
- **Prospectos es la pantalla de Captación con el tipo fijo**: `Captacion` acepta `tipoFijo` y con
  `"CLIENTE"` esconde el selector de tipo y da de alta clientes (`Captacion.tsx:507-512` y `:603-609`;
  usada en `crm/page.tsx:33`). No se escribió otra pantalla de leads. Prospección (Inventario) no
  necesitó cambio: ya pedía solo `PREDIO` y `PANTALLA` (`ComercialOpex.tsx:1129`); §7 decía
  también `ARRENDADOR`, que no lista.
- **La ficha une la línea de tiempo al leer** (§2), con dos campos nuevos en
  `GET /api/oportunidades/[id]` (`oportunidades-controller.ts:126-153`): `cambios`, el historial de
  las propuestas ligadas que escribe el trigger de la Fase 3 (`leerCambiosDePropuestas`,
  `oportunidades-repo.ts:282`, los últimos 300, solo de propuestas vivas), y `avancesProspecto`, la
  bitácora del lead **solo si quien mira puede ver ese prospecto con la regla de Captación**
  (`obtenerProspecto` con `soloDe` de Captación, `:138`). El gerente que ve la oportunidad de un
  vendedor no hereda por eso los leads; si no los ve, llega `[]`. La e2e lo prueba quitándole
  `captacion.aprobar` al gerente.
- **`borrarCliente` cuenta las oportunidades** (`clientes-repo.ts:251-253`, `:287` y `:297`) y el
  desglose las nombra (`clientes-controller.ts:170-171`). Cierra el 409 genérico de la Fase 2. Su
  traducción pidió tocar las tres funciones de bloqueo de `lib/i18n/errores-servidor.ts`
  (`:1740-1749`, `:2148-2156`, `:2451-2461`): **«oportunidades» hace el plural en -es**, y quitarle
  la `s` como a las demás piezas daba «oportunidade», que no se reconocía. Lo vigila
  `lib/i18n/errores-crm.test.ts`.
- **`lib/crm.ts` gana las cuentas de la pantalla**, calculadas al leer y sin columnas (§6):
  `diasPorEtapa` (`:113`, de las filas `ETAPA`; volver a una etapa suma, GANADA y PERDIDA no
  cuentan, y se cuenta con marcas de tiempo porque el navegador no conoce la zona del negocio),
  `cotejoPresupuesto` (`:139`, debajo · dentro · encima del rango, con la diferencia contra el
  extremo rebasado y su %), `cotejoFechas` (`:175`, días que se movió cada extremo) y
  `agruparEmbudo` (`:196`, una columna por etapa con su total y su **ponderado** por la
  probabilidad efectiva; el monto de referencia es el máximo, o el mínimo, `montoReferencia`, `:188`).
  24 unitarias en `lib/crm.test.ts`.
- **El cotizado es el total con IVA** de cada propuesta, tal como lo arma `armarPropuesta`
  (`propuestas-repo.ts:86-87`: `total = bruto + iva`): la misma cifra que las tarjetas de Propuestas
  y el cotejo por cliente de la Fase 1, y la ficha lo rotula «con IVA»
  (`FichaOportunidad.tsx:37-40` y `:274-289`). Ver la pregunta 5.
- **En el embudo una tarjeta se mueve a otra etapa abierta o a GANADA**, no a PERDIDA: perderla
  exige el motivo, y eso se escribe en la ficha (`components/demo/crm/Oportunidades.tsx:34`).
- **`armarPropuesta` expone `oportunidadId`** (`propuestas-repo.ts:276`), para que la ficha ofrezca
  ligar solo las propuestas sueltas del mismo cliente y desligar las suyas
  (`PATCH /api/propuestas/[id]` con `{ oportunidadId: null }`).
- **Una prueba de orden del menú pasaba en falso.** `nav.test.ts` comprobaba que Propuestas fuera
  antes que Campañas con `findIndex`; al quitar la entrada `propuestas`, `findIndex` daba **-1**, y
  -1 es menor que cualquier posición: la prueba seguía verde sin comprobar nada. Ahora usa la clave
  `crm` y exige además que exista (`nav.test.ts:41-50`). Y un bloque nuevo vigila que ninguna ruta
  sea de dos entradas, para que la compuerta no dude qué roles aplicar (`nav.test.ts:309-327`).

> [!success] Visto al documentar y RESUELTO el mismo día: lo ligado de otro vendedor ya no se ve
> La ficha traía folio, nombre, estatus e historial campo por campo de **todas** las propuestas
> ligadas, sin la regla de la Fase 3 «el vendedor solo ve las suyas». Ligar no exige que propuesta y
> oportunidad sean del mismo vendedor (`revisarOportunidadParaLigar`), así que quien ve todo podía
> ligar la propuesta de B a la oportunidad de A, y A leía en la ficha lo que en Propuestas le da
> 404. Ahora `leerPropuestasLigadas` y `leerCambiosDePropuestas` reciben el `soloDe` de quien mira
> (`oportunidades-repo.ts:241-255` y `:282-298`) y aplican el mismo filtro que la lista. **No** se
> prohibió ligar entre vendedores: quien ve todas puede querer juntar el trabajo de dos en una
> venta, y lo único que importaba era no enseñar lo ajeno. La e2e
> «una propuesta de OTRO vendedor ligada a la mía…» se vio **en rojo** contra el build anterior
> (`['CRM-M-2','CRM-M-1']`) y en verde con el arreglo.

> [!success] Visto en el navegador y RESUELTO: el cotejo de fechas daba «NaN»
> La columna «Fechas» decía «Movidas: inicio NaN, fin NaN días». `propuestas-repo` serializa las
> fechas de los renglones como ISO completo (`iso()` → `2026-12-01T06:00:00.000Z`) y `diasEntre`
> (`lib/crm.ts`) le pegaba `T00:00:00Z` encima. Ahora acepta los dos formatos y **redondea** en vez de
> cortar a 10 caracteres, porque al este de UTC la medianoche local cae el día anterior en UTC. Las
> unitarias solo probaban `AAAA-MM-DD`; la nueva, con las dos zonas, se vio en rojo con `NaN`.

## Alternativas consideradas

**A · Solo una vista, sin tablas.** Es la Fase 1. No basta sola: no guarda el presupuesto, ni
prospectos que aún no son clientes, ni el detalle de los cambios.

**C sola · todo en `prospectos`.** Volvería a mezclar en una fila conseguir espacios y venderlos,
que es justo lo que se separó en la v0.12.13, y una oportunidad de un cliente existente no tendría
prospecto.

**Foto completa por versión en vez de campo por campo.** Descartada por el dueño: para saber qué
cambió habría que comparar dos fotos.

## Consecuencias

**Positivas**
- Por fin se responde «cuánto quiere gastar, cuánto llevamos, cuántas cotizaciones y quién cambió
  qué» con datos y no de memoria.
- Las propuestas de hoy no cambian de comportamiento: `oportunidad_id` es opcional.

**Negativas**
- **Cada cambio a una propuesta escribe filas de más** (una por campo), por trigger. Aprobar una
  propuesta con muchos sitios escribe una fila por sitio aprobado.
- **`db.ts` fija dos GUC más por consulta** (en la misma sentencia que el tenant: ninguna ida más a
  la base) y lee la sesión una vez por petición (`autorActual`, memoizado).
- **Dos líneas de tiempo físicas** (`prospecto_avances` y `oportunidad_actividades`) que la
  pantalla une al leer.

**Implicaciones de seguridad**
- **Aislamiento:** las tres tablas nuevas llevan RLS forzada y FK compuestas con `tenant_id`, porque
  los chequeos de FK saltan la RLS. Se prueba en un e2e nuevo **sin tocar**
  `aislamiento.e2e.test.ts`.
- **Entrada:** esquemas `.strict()`. El vendedor, el autor y el nombre congelado salen de la
  sesión, nunca del cuerpo.
- **El historial no se puede editar ni borrar** desde la aplicación (trigger), igual que `acciones`.

## Preguntas abiertas para el dueño

1. ~~**¿Se aprueba la forma de la migración de §1 a §4?**~~ **Aprobada el 17/11.**
2. ~~**Hoy un vendedor ve TODAS las propuestas.** ¿Pasa a «solo las suyas»?~~ **Contestada el
   17/11: «sus propuestas el vendedor, el resto todas».** Hecho en la Fase 3, en toda la aplicación
   y no solo en la pestaña del CRM.
3. **Probabilidad por etapa por omisión**: propuesta 10 · 25 · 50 · 75 · 100 · 0. ¿Te sirve así o
   la fija cada instancia?
4. ~~**¿Se ve el historial de cambios en la liga pública del cliente?**~~ **Contestada el 17/11:
   no, es interno.** La e2e `propuestas-por-vendedor` comprueba que la liga no lo trae.
5. **El cotejo compara el presupuesto contra el total CON IVA** de cada cotización (Fase 4): es la
   cifra de las tarjetas de Propuestas. Si el cliente dice su presupuesto **sin IVA**, el cotejo
   pinta «encima» a una cotización que en realidad cabe (un 16 % de más). Cambiarlo es usar el
   `neto` de la propuesta en `FichaOportunidad.tsx:274`, sin migración. ¿Cómo habla el cliente?

## Cómo revertir

La migración solo agrega columnas y tablas. La versión anterior funciona con ella puesta, porque
no las lee. Volver atrás es revertir los commits; los datos capturados se quedan.

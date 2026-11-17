# ADR 0051: El CRM comercial: oportunidades encima de `prospectos` y `propuestas`, con el cotejo de lo que pide el cliente contra lo que se le cotiza

- **Fecha:** 2026-11-17
- **Estado:** **Aceptada (17/11, el dueño aprobó la forma de la migración de §1 a §4).** Es ROJO:
  R3 (migración) y R4 (toca el flujo de Propuestas, que es dinero). Siguen abiertas las preguntas
  2 a 4 de abajo; ninguna cambia la forma de la migración. **Fase 1 hecha el 17/11** (sin
  migración): `lib/crm-cotejo.ts` y la vista «Por cliente» en Propuestas.
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
- **Cada función que muta una propuesta gana una escritura** en la misma transacción. Una función
  que se olvide de escribir deja un hueco silencioso. Se cubre con una prueba que recorre todas las
  rutas de escritura de `/api/propuestas/**` y exige una fila nueva en `propuesta_cambios`.
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
2. **Hoy un vendedor ve TODAS las propuestas** (`listarPropuestas` no filtra por vendedor). Con
   «igual que Captación», ¿la pestaña Propuestas del CRM también pasa a «solo las suyas»? Es un
   cambio de comportamiento para los vendedores actuales.
3. **Probabilidad por etapa por omisión**: propuesta 10 · 25 · 50 · 75 · 100 · 0. ¿Te sirve así o
   la fija cada instancia?
4. **¿Se ve el historial de cambios en la liga pública del cliente?** La propuesta es que **no**:
   es interno.

## Cómo revertir

La migración solo agrega columnas y tablas. La versión anterior funciona con ella puesta, porque
no las lee. Volver atrás es revertir los commits; los datos capturados se quedan.

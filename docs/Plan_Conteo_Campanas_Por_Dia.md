# Plan · Conteo de campañas por día, por vendedor

> **Estado:** propuesto el 2026-11-17, **sin aprobar**. D1 la cerró el dueño el
> mismo día («las que se crearon y las que se aprueban»); faltan **D3** y **D4**
> (§2) antes de la Tarea 1.
> **Pedido:** «el conteo de campañas por día, para cada vendedor y usuario grande».

---

## 1 · Qué se pide, y cómo se lee

Una vista que diga, **día por día y por vendedor**, dos cosas:

- **Creadas** — cuántas campañas se crearon ese día.
- **Aprobadas** — cuántas se aprobaron ese día.

Y quién ve qué:

- **El vendedor** ve **solo lo suyo**.
- **El «usuario grande»** ve **cada vendedor y el total**. Se lee como quien
  tiene `comercial.aprobar`: **Dueño, Administrador, Director comercial y
  Gerente de ventas** (`20260929_roles_de_venta_matriz.sql`, ver
  `vault/02-Backend/roles-de-venta.md`). El vendedor no lo tiene.

La regla de visibilidad **no se inventa**: es la de Captación (`soloDe()`,
`apps/web/lib/server/captacion-controller.ts:141`) y la que el CRM (ADR 0051,
Fase 3) adoptó para las propuestas: *si no puedes aprobar, solo lo tuyo*.

## 2 · Decisiones

| # | Pregunta | Estado |
|---|---|---|
| **D1** | ¿Qué cuenta como «campaña de ese día»? | **CERRADA (17/11): las dos — creadas y aprobadas**, como dos series |
| **D2** | ¿Qué estados cuentan? | **Resuelta por D1**: «creadas» cuenta todas las que se crearon, acaben como acaben; «aprobadas» solo las que se aprobaron. Ver §3 |
| **D3** | ¿Dónde se ve? | **Abierta.** Recomendación: bloque del **Dashboard** (últimos 30 días), que es la referencia de diseño aprobada (26/10) y ya sabe ocultar bloques por persona con «Personalizar». Alternativa: dentro del tablero de Propuestas |
| **D4** | El tablero de propuestas por periodo que ya existe (`/api/propuestas/resumen`) le enseña **al vendedor** las cifras de **todos** los vendedores. ¿Se alinea con la regla nueva? | **Abierta.** Si el vendedor solo debe ver lo suyo aquí, verlo todo allá contradice la decisión. Recomendación: alinearlo, como tarea aparte (T5) |

## 3 · De dónde sale cada número (sin migración)

**En este sistema, una campaña nace ya aprobada.** Al aprobar una propuesta se
inserta la campaña con `estado_comercial = 'CONFIRMADA'`
(`apps/web/lib/server/campanas-repo.ts:749-750`). Antes de aprobarla, lo que el
vendedor «crea» es la **propuesta** de esa campaña. Por eso las dos cifras se
leen de `propuestas`, que además es donde vive el vendedor:

| Serie | Fecha | Fuente |
|---|---|---|
| **Creadas** | `propuestas.creado_en` | cuando el vendedor la armó |
| **Aprobadas** | `propuestas.aprobada_en` (PROP-PER, `20261009_propuestas_fechas_estatus.sql`) | aprobación interna o del cliente por la liga; es el momento en que nace la campaña |
| Vendedor | `propuestas.usuario_id` (VEND-01) + `vendedor_nombre` congelado | quien creó la propuesta, tomado de la sesión |

**Ya existe casi todo.** El tablero de propuestas por periodo (PROP-PER, 06/10)
lee justo esas columnas por propuesta (`filasPropuestasResumen`,
`apps/web/lib/server/propuestas-resumen-repo.ts:42-53`) y ya reparte
«generadas» y «aprobadas» por vendedor, pero **por periodo, no por día**
(`apps/web/lib/propuestas-periodo.ts:93-102`). Este plan añade el corte por día
y el filtro por vendedor; no hace una segunda cuenta.

Casos de atribución, los mismos que ya resuelve ese repo:

| Caso | Cómo se ve |
|---|---|
| Propuesta con vendedor | En la fila de ese vendedor |
| Vendedor **borrado** | Con su nombre congelado (P19) |
| Propuesta histórica sin vendedor | Fila **«Sin vendedor»**, que solo ve el usuario grande |

**Lo que no se cuenta y por qué:**
- **Campañas sin propuesta** (las de «Reservar», `campanas-repo.ts:355`): no
  tienen vendedor ni fecha de aprobación. Contarlas pediría `campanas.usuario_id`
  y una fecha de confirmación: **migración → ROJO R3**. Fuera de este plan.
- **Un borrador que se borró** (`facbba61`) desaparece también de «creadas» del
  día en que se creó. Es coherente con el tablero actual. Si el dueño quiere que
  cuente igual, también hace falta migración.
- **Una propuesta rechazada que después se aprueba** cuenta como aprobada en su
  fecha nueva. Es la regla de PROP-PER.

> [!warning] El día, en la zona del negocio, no en la del servidor
> Hoy el repo arma la fecha con `to_char(p.creado_en, 'YYYY-MM-DD')`, que usa la
> zona de la **conexión** a Postgres. Para un corte **por día** eso importa: una
> propuesta de las 19:00 en Ciudad de México ya es «mañana» en UTC, y se
> contaría en el día equivocado sin dar error. La consulta nueva convierte de
> forma explícita: `(p.creado_en at time zone $zona)::date`, con
> `zonaDelNegocio()` (`apps/web/lib/propuesta-vigencia.ts`, por omisión
> `America/Mexico_City`).

## 4 · Tareas

Una tarea = un commit, prueba primero y en rojo.

### T1 · La cuenta por día, en puro (VERDE)

`conteoPorDia(props, desde, hasta)` en `apps/web/lib/propuestas-por-dia.ts`, sobre
el mismo `PropuestaP` de `propuestas-periodo.ts`. Devuelve
`{ dias, porVendedor: [{ id, nombre, creadas[], aprobadas[] }], total: { creadas[], aprobadas[] } }`.

Pruebas (`propuestas-por-dia.test.ts`):
- los días **sin movimiento salen en 0**, no desaparecen (si no, la gráfica miente);
- una propuesta creada un día y aprobada otro suma en **los dos días**, cada una en su serie;
- creada y aprobada el mismo día cuenta una vez en cada serie;
- «Sin vendedor» y el vendedor borrado con nombre congelado, por separado;
- el total cuadra con la suma de las filas.

### T2 · El repo y la ruta (ÁMBAR: toca tenant, R2)

- En `propuestas-resumen-repo.ts`, una lectura con las fechas **en la zona del
  negocio** (ver el aviso de §3), con `q` (**nunca `qRaw`**),
  `and p.tenant_id = $n` además de la RLS, filtro opcional por `usuario_id` y
  rango de **92 días como máximo**.
- `GET /api/propuestas/conteo-diario?desde=&hasta=` → controller con zod →
  repo. El filtro por vendedor **sale de la sesión** (`soloDe` con
  `comercial.aprobar`), **nunca de la URL**.

Pruebas e2e (`propuestas-conteo-diario.e2e.test.ts`, con `npm run build` antes):
- **negativo**: un VENDEDOR no ve los conteos de otro vendedor, ni mandando
  `?vendedor=<otro>`;
- **negativo**: no se cuentan propuestas de otra organización;
- **negativo**: el vendedor no ve la fila «Sin vendedor»;
- el GERENTE ve a todos y el total cuadra;
- una propuesta creada a las 23:30 de Ciudad de México cuenta en **su** día local;
- sin sesión → 401; rango mayor de 92 días → 400.

### T3 · La pantalla (donde diga D3)

Siguiendo el diseño del Dashboard, sin tocar lo demás:
- **Vendedor**: sus dos series por día (creadas y aprobadas) y los totales del periodo.
- **Usuario grande**: tabla vendedor × día con las dos cifras, o barras
  agrupadas; total al pie y «Sin vendedor» al final.
- Textos en los cuatro idiomas (es, en, it, pt) con sus pruebas de cobertura.
- Recorrido en Chrome con un VENDEDOR y un GERENTE, también a 375 px.

### T4 · Documentación

- Nota nueva `vault/02-Backend/conteo-campanas-por-dia.md`, enlazada desde
  `vendedor-en-propuesta`, `api-endpoints` y el MOC.
- Entrada en `docs/Registro_Cambios.md`.
- Recuentos con `node scripts/recuentos.mjs` (sube 1 endpoint) en `CLAUDE.md` y el MOC.

### T5 · (solo si D4 dice que sí) Alinear el tablero de propuestas

`/api/propuestas/resumen` aplica la misma regla: el vendedor recibe solo sus
filas en `porVendedor` y sus propuestas en los totales. Con su e2e negativa.

## 5 · Zona de riesgo

| | |
|---|---|
| Sesión / tenant | **Sí** (lectura filtrada por usuario y organización) → e2e obligatorias |
| Migración | **No** (salvo que se pida contar campañas sin propuesta, ver §3) |
| Dinero | **No**: cuenta propuestas y campañas, no suma importes |
| Global | **ÁMBAR**. Pasa a ROJO solo si entra la migración |

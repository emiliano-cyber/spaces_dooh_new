# Plan · Conteo de campañas por día, por vendedor

> **Estado:** propuesto el 2026-11-17, **sin aprobar**. Antes de la Tarea 1 hay
> que cerrar las tres decisiones del §2 (son del dueño, no de quien programa).
> **Pedido:** «el conteo de campañas por día, para cada vendedor y usuario grande».

---

## 1 · Qué se pide, y cómo se lee

Una vista que diga **cuántas campañas hubo cada día**, separada **por vendedor**:

- **El vendedor** ve **solo su propio conteo**, día por día.
- **El «usuario grande»** —quien manda sobre el equipo— ve **el de cada vendedor
  y el total**. Se lee como los roles que hoy ya ven todo lo comercial:
  **Dueño, Administrador, Director comercial y Gerente de ventas**, o sea quien
  tiene `comercial.aprobar` en `rol_permisos`.

La regla de quién ve qué **no se inventa**: es la de Captación
(`soloDe()`, `apps/web/lib/server/captacion-controller.ts:141`) y la que el CRM
(ADR 0051, Fase 3) adoptó para las propuestas: *si no puedes aprobar, solo lo
tuyo*. Aquí con el permiso `comercial.aprobar`. Una sola regla en todo Comercial.

## 2 · Las tres decisiones que faltan

| # | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| **D1** | ¿Qué cuenta como «campaña de ese día»? | **(a) nuevas**: las que se generaron ese día (`campanas.creado_en`) · **(b) al aire**: las que estaban corriendo ese día (`fecha_inicio ≤ día ≤ fecha_fin`) | **(a)** mide el trabajo del vendedor, que es lo que pide «por vendedor». (b) mide ocupación y ya se parece a Disponibilidad. Se pueden mostrar las dos como dos series si el dueño quiere |
| **D2** | ¿Qué estados cuentan? | Todos · sin `DRAFT` ni `CANCELADA` | **Sin `DRAFT` ni `CANCELADA`** (`est_comercial_campana`, `db/schema.sql:48`): un borrador o una cancelada no es una venta |
| **D3** | ¿Dónde se ve? | Bloque del **Dashboard** (con «Personalizar») · pantalla en **Reportes** · las dos | **Bloque del Dashboard**, últimos 30 días; el Dashboard es la referencia de diseño aprobada (26/10) y ya sabe ocultar bloques por persona |

## 3 · De dónde sale el vendedor de una campaña (sin migración)

`campanas` **no tiene columna de usuario** (`db/schema.sql:378-404`). El vendedor
se llega por la propuesta:

```
campanas.propuesta_id → propuestas.usuario_id   (VEND-01, 20260928_vendedor_en_propuesta.sql)
                      → propuestas.vendedor_nombre (congelado, 20261029_…_vendedor.sql)
```

Es **el mismo puente** que ya usa el reporte de rentabilidad por vendedor
(`VendedorDeCampana`, `apps/web/lib/data/reportes.ts:410`), así que se reutiliza
la misma regla de atribución y los mismos tres casos:

| Caso | Cómo se ve |
|---|---|
| Campaña de propuesta con vendedor | En la fila de ese vendedor |
| Campaña de propuesta con vendedor **borrado** | Con su nombre congelado (P19) |
| Campaña **manual**, sin propuesta, o propuesta histórica | Fila **«Sin vendedor»** — solo la ve el usuario grande |

> [!warning] Si el dueño quiere que las campañas manuales cuenten para alguien
> hace falta `campanas.usuario_id` (quien la creó) y eso es **migración → ROJO
> R3**. Queda **fuera** de este plan; si se pide, va como tarea aparte.

**El día** se calcula en la **zona del negocio**, no en UTC:
`zonaDelNegocio()` (`apps/web/lib/propuesta-vigencia.ts`, por omisión
`America/Mexico_City`). Una campaña creada a las 19:00 de Ciudad de México ya es
«mañana» en UTC; contarla en UTC la cargaría al día equivocado sin dar error.

## 4 · Tareas

Una tarea = un commit, prueba primero y en rojo.

### T1 · La cuenta, en puro (VERDE)

`apps/web/lib/conteo-campanas.ts` — función sin base de datos:
`(filas, desde, hasta, zona) → { dias: string[], porVendedor: {id, nombre, conteos[]}[], total[] }`.

Pruebas (`conteo-campanas.test.ts`):
- los días **sin campañas salen en 0**, no desaparecen (si no, la gráfica miente);
- el borde de zona: una creada a las 23:30 locales cuenta en **su** día local;
- «Sin vendedor» y el vendedor borrado con nombre congelado, separados;
- `DRAFT` y `CANCELADA` no cuentan (según D2).

### T2 · El repo y la ruta (ÁMBAR, toca tenant → R2)

- `campanas-conteo-repo.ts`: una consulta agrupada con `q` (**nunca `qRaw`**), con
  `and c.tenant_id = $n` además de la RLS, `left join propuestas`, filtro
  `soloVendedor` opcional y rango máximo de **92 días**.
- `GET /api/campanas/conteo-diario?desde=&hasta=` → controller con zod →
  repo. El vendedor que se filtra **sale de la sesión** (`soloDe` con
  `comercial.aprobar`), **nunca de la URL**: un vendedor que mande
  `?vendedor=<otro>` sigue viendo solo lo suyo.

Pruebas e2e (`campanas-conteo.e2e.test.ts`, con `npm run build` antes):
- **negativo**: un VENDEDOR no ve los conteos de otro vendedor, ni con el
  parámetro forzado;
- **negativo**: no se cuentan campañas de otra organización;
- el GERENTE ve a todos y el total cuadra con la suma de las filas;
- sin sesión → 401; rango mayor de 92 días → 400.

### T3 · El bloque del Dashboard

Componente en `components/demo/inicio/` siguiendo el diseño del Dashboard
(referencia aprobada, no se toca lo demás):
- **Vendedor**: una serie, sus campañas por día, y el total del periodo.
- **Usuario grande**: tabla vendedor × día (o barras apiladas) + total, con
  «Sin vendedor» al final.
- Entra en «Personalizar» como un bloque más; textos en los cuatro idiomas
  (es, en, it, pt) con sus pruebas de cobertura.
- Recorrido en Chrome con un VENDEDOR y un GERENTE, también a 375 px.

### T4 · Documentación

- Nota nueva en la bóveda `vault/02-Backend/conteo-campanas-por-dia.md`,
  enlazada desde `vendedor-en-propuesta`, `api-endpoints` y el MOC.
- Entrada en `docs/Registro_Cambios.md`.
- Recuentos con `node scripts/recuentos.mjs` (sube 1 endpoint) en `CLAUDE.md`
  y el MOC.

## 5 · Zona de riesgo

| | |
|---|---|
| Sesión / tenant | **Sí** (lectura filtrada por usuario y organización) → e2e obligatorias |
| Migración | **No** (salvo que se pida `campanas.usuario_id`, ver §3) |
| Dinero | **No**: solo cuenta campañas, no suma importes |
| Global | **ÁMBAR**. Pasa a ROJO solo si entra la migración |

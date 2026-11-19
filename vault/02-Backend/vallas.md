---
tipo: backend
estado: en-curso
actualizado: 2026-11-19
tags: [backend, vallas, inventario, reglas, competencia, rojo]
archivos:
  - db/migrations/20261119_vallas_esqueleto.sql
  - apps/web/lib/vallas/tipos.ts
  - apps/web/lib/vallas/numeracion.ts
  - apps/web/lib/vallas/reglas/tipos.ts
  - apps/web/lib/vallas/reglas/index.ts
  - apps/web/lib/vallas/reglas/configuracion.ts
  - apps/web/lib/vallas/reglas/competencia-marcas.ts
  - apps/web/lib/server/vallas-repo.ts
  - apps/web/lib/server/vallas-controller.ts
  - apps/web/app/api/vallas/route.ts
  - apps/web/app/api/vallas/[id]/route.ts
  - apps/web/app/api/vallas/grupos/route.ts
  - apps/web/app/api/vallas/grupos/[id]/route.ts
  - apps/web/app/api/vallas/competencia/route.ts
  - apps/web/app/api/vallas/competencia/[id]/route.ts
  - apps/web/app/api/vallas/verificar/route.ts
  - apps/web/app/(app)/(shell)/vallas/page.tsx
  - apps/web/components/vallas/Vallas.tsx
  - apps/web/lib/data/vallas-api.ts
  - apps/web/lib/i18n/textos/vallas.ts
  - apps/web/lib/test/vallas.e2e.test.ts
---

# Vallas (esqueleto, 19/11)

Pedido del dueño el 2026-11-19: un módulo propio para las **vallas publicitarias**,
al estilo de Imprenta/imprentas, donde se irán metiendo **más reglas de negocio**.
Decisión de forma en el [ADR 0052](../../docs/adr/0052-vallas-modulo-con-reglas-enchufables.md).

> [!danger] ROJO R3 · la migración `20261119_vallas_esqueleto.sql` espera al dueño
> Aplicada solo a la base de e2e y, por pedido del dueño, a `spaces_hoy` (5434,
> local, para probarla). **A ningún servidor.**

## Qué reutiliza y qué agrega

- **Reutiliza `sitios`**: `tipo_medio = 'VALLA'`, `ancho`, `alto`, `caras`. Una valla
  vive en un sitio y no copia sus datos (al elegir el sitio, la pantalla propone sus
  medidas).
- **Reutiliza `campanas.marca`** (texto) como la marca de una reserva. Si está vacía,
  cuenta el nombre del cliente. No hay tabla de marcas aparte.
- **Reutiliza los permisos de `inventario`**: `ver` lee, `crear` escribe. Sin módulo
  nuevo en `rol_permisos`. Entrada **«Vallas»** en el grupo **Inventario** del menú,
  con los roles de Inventario (`MANDO`). Va en Inventario y no en Operaciones porque
  una valla es patrimonio que se vende, no una tarea; Imprenta está en Operaciones
  porque ejecuta lo vendido.

Tablas nuevas (las tres con `tenant_id`, RLS fail-closed + FORCE y FK compuestas):

| Tabla | Campos clave |
|---|---|
| `vallas` | `numero` (único por organización, sin distinguir mayúsculas), `sitio_id` → `sitios(id, tenant_id)` **restrict**, `cara`, `ancho_m`, `alto_m`, `grupo_id` → `vallas_grupos(id, tenant_id)`, `posicion`, `notas`, `activo` |
| `vallas_grupos` | `numero` (otra numeración, única por organización), `nombre`, `modo` (`una_imagen` \| `separadas`), `ancho_m`, `alto_m` (medida total), `activo` |
| `competencia_categorias` | `nombre` («Refrescos de cola»), `marcas text[]`, `activo` (baja lógica, el rol de la app no borra) |

Vallas y grupos sí se borran (no tienen historia todavía). Al borrar un grupo, el
repo suelta antes a sus vallas en la misma transacción: `on delete set null (col)`
es PostgreSQL 15 y g500 corre 14 (la misma razón que `imprentas`).

## Las dos numeraciones y la medida del arte

`lib/vallas/numeracion.ts` (puro):

- `siguienteNumero(existentes, 'V-')` **sugiere** `V-001`, `V-002`…; el número lo pone
  el usuario (texto libre, se guarda en mayúsculas).
- `medidaParaArte(valla, grupo)`: si el grupo es **`una_imagen`**, la medida del
  arte es la **del grupo**; si no tiene medida capturada, `null` (no se adivina). En
  `separadas` o sin grupo, la de la valla.
- `medidaSugeridaDeGrupo`: lado a lado (suma de anchos, el mayor alto); solo sugiere.
- `problemasDeGrupo`: sin medida en una imagen, menos de dos vallas, vallas de sitios
  distintos. Avisos, no bloqueos.

> [!important] Enganche con Imprenta — señalado, sin conectar
> `medidaParaArte` devuelve `{ ancho, alto }` en metros, la misma forma que `Lona`
> de `lib/valoracion-arte.ts` y que `medidaDeOrden` de `lib/proporcion-pantalla.ts`.
> Hoy la orden de impresión apunta a un **sitio**. El día que apunte a una valla o a
> un grupo, la valoración del arte debe pedir aquí la lona: con `una_imagen`, la del
> grupo.

## Dónde se enchufan las reglas nuevas

`lib/vallas/reglas/`:

| Archivo | Qué es |
|---|---|
| `tipos.ts` | El contrato: `Regla { id, descripcion, evaluar(ctx) → Hallazgo[] }`, `Hallazgo { regla, nivel: 'bloqueo' \| 'aviso', mensaje, datos? }`, `ContextoVallas` |
| `configuracion.ts` | Cómo se comporta cada regla (hoy en código) |
| `index.ts` | `REGLAS` (el registro) y `evaluarReglas(ctx)`: corre todas, junta hallazgos, `bloquea` si alguna dio bloqueo; una regla que revienta se vuelve aviso y no tumba a las demás |
| `competencia-marcas.ts` | La primera regla |

Para añadir una: un archivo con su `Regla`, su configuración, sumarla a `REGLAS` y, si
necesita más datos, ampliar `ContextoVallas` y llenarlo en `contextoParaVerificar`
(`vallas-repo.ts`). Las reglas son **puras**: no leen la base.

## Regla 1 · exclusión de competencia de marcas

Dos marcas compiten si comparten una categoría **activa**. Chocan si la candidata
(marca + fechas + vallas) cae en la zona de una valla ya ocupada por la otra marca con
fechas que se solapan (**inclusivas**: tocarse un día ya es solape). Las marcas se
comparan normalizadas («Coca-Cola» = «coca cola»); la misma marca no compite consigo
misma; una marca fuera del catálogo no compite con nadie.

Configuración por omisión: **`nivel: 'aviso'`**, **`alcance: 'grupo_imagen'`** (la
misma valla y las de su grupo si el grupo es una sola imagen). Otros alcances:
`valla`, `grupo` (cualquier modo) y `sitio` (vecinas).

**Las ocupaciones salen de las reservas, que hoy son por SITIO**: una reserva viva
(no cancelada; tentativa sin caducar) ocupa **todas** las vallas de su sitio. Es la
aproximación honesta mientras la reserva no sepa en qué cuadro cae.

> [!warning] Conectado solo a `POST /api/vallas/verificar` (y a «Verificar una marca»)
> Solo informa. **No** está enganchada a `reservar` ni a
> `generarCampanaDesdePropuesta` (`lib/server/campanas-repo.ts`): eso es dinero (R4)
> y la reserva no sabe todavía en qué valla cae. Cuando se conecte: armar el contexto
> con `contextoParaVerificar`, 409 con los hallazgos si `bloquea`, y mostrar los avisos.

## API

| Ruta | Permiso |
|---|---|
| `GET /api/vallas` → `{ vallas, grupos }` | `inventario.ver` |
| `POST /api/vallas` · `PATCH`/`DELETE /api/vallas/[id]` | `inventario.crear` |
| `POST /api/vallas/grupos` · `PATCH`/`DELETE /api/vallas/grupos/[id]` (`vallaIds` deja EXACTAMENTE esas, en ese orden) | `inventario.crear` |
| `GET`/`POST /api/vallas/competencia` · `PATCH /api/vallas/competencia/[id]` | `ver` / `crear` |
| `POST /api/vallas/verificar` `{ marca, fechaInicio, fechaFin, vallaIds?, sitioIds?, excluirCampanaId? }` → `{ hallazgos, bloquea }` | `inventario.ver` |

Una valla en un sitio ajeno, o un grupo con vallas ajenas, es **400** (el repo lo
pregunta antes; la FK compuesta lo impide igual en la base).

## Pruebas

- `lib/vallas/numeracion.test.ts` y `lib/vallas/reglas/reglas.test.ts`: 33 unitarias
  (solapes, misma valla, grupo una imagen / separadas, alcances, marcas de categorías
  distintas, misma marca, evaluador). Vistas en rojo antes del código.
- `lib/test/vallas.e2e.test.ts`: 11 casos contra Postgres y Next reales — CRUD, 403
  de COMERCIAL, 409, aislamiento por API y con el rol de la app (RLS y FK compuestas),
  y la verificación. Vistas en rojo (404) antes de las rutas.

## Preguntas abiertas al dueño

¿Bloquea o avisa? ¿Alcance: misma valla, grupo una imagen, cualquier grupo o mismo
sitio? ¿Quién edita las categorías (hoy `inventario.crear`)? ¿La numeración la pone
el usuario o la asigna el sistema? ¿Una valla puede estar en más de un grupo? ¿La
reserva pasará a ser por valla? ¿Hace falta un catálogo de marcas ligado al cliente?

## Relacionadas
[[02-Backend/_indice]] · [[inventario-y-sitios]] · [[operaciones-y-ot]] · [[MOC-Proyecto]]

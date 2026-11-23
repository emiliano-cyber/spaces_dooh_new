---
tipo: backend
estado: en-curso
actualizado: 2026-11-20
tags: [backend, vallas, inventario, reglas, competencia, rojo, en-proceso, demo, plano, esquinas, liga-publica]
archivos:
  - db/migrations/20261119_vallas_esqueleto.sql
  - db/migrations/20261119_vallas_sembrar_competencia_por_omision.sql
  - db/migrations/20261120_vallas_esquina.sql
  - apps/web/lib/server/vallas-controller.test.ts
  - apps/web/lib/test/vallas-esquina.e2e.test.ts
  - apps/web/lib/vallas/competencia-por-omision.ts
  - apps/web/lib/roles.ts
  - apps/web/lib/server/cuentas-controller.ts
  - apps/web/lib/vallas/tipos.ts
  - apps/web/lib/vallas/numeracion.ts
  - apps/web/lib/vallas/reglas/tipos.ts
  - apps/web/lib/vallas/reglas/index.ts
  - apps/web/lib/vallas/reglas/configuracion.ts
  - apps/web/lib/vallas/reglas/competencia-marcas.ts
  - apps/web/lib/server/vallas-repo.ts
  - apps/web/lib/server/vallas-controller.ts
  - apps/web/lib/server/propuestas-competencia.ts
  - apps/web/app/api/vallas/route.ts
  - apps/web/app/api/vallas/[id]/route.ts
  - apps/web/app/api/vallas/grupos/route.ts
  - apps/web/app/api/vallas/grupos/[id]/route.ts
  - apps/web/app/api/vallas/competencia/route.ts
  - apps/web/app/api/vallas/competencia/[id]/route.ts
  - apps/web/app/api/vallas/verificar/route.ts
  - apps/web/app/(app)/(shell)/vallas/page.tsx
  - apps/web/components/vallas/Vallas.tsx
  - apps/web/components/vallas/PlanoVallas.tsx
  - apps/web/components/vallas/plano.test.ts
  - apps/web/lib/vallas/plano.ts
  - apps/web/lib/vallas/plano.test.ts
  - apps/web/components/demo/propuestas/DibujarPlanoPropuesta.tsx
  - apps/web/app/api/vallas/ocupacion/route.ts
  - apps/web/lib/test/vallas-plano.e2e.test.ts
  - apps/web/lib/data/vallas-api.ts
  - apps/web/lib/i18n/textos/vallas.ts
  - apps/web/lib/test/vallas.e2e.test.ts
  - apps/web/lib/test/alta-organizacion.e2e.test.ts
  - apps/web/components/demo/shell/nav.ts
  - apps/web/components/demo/shell/Sidebar.tsx
  - apps/web/components/vallas/en-proceso.test.ts
  - apps/web/components/demo/shell/vallas-en-comercial.test.ts
  - apps/web/lib/modulos.ts
  - scripts/semilla-catalogo-modulos.mjs
  - scripts/semilla-catalogo-demo.mjs
  - scripts/semilla-catalogo-demo.test.ts
  - apps/web/lib/test/semilla-vallas-demo.e2e.test.ts
  - apps/web/lib/vallas/plano-publico.ts
  - apps/web/lib/vallas/plano-publico.test.ts
  - apps/web/lib/server/vallas-publicas-repo.ts
  - apps/web/lib/server/vallas-publicas-controller.ts
  - apps/web/lib/server/vallas-publicas-controller.test.ts
  - apps/web/components/vallas/plano-cliente.test.ts
  - apps/web/app/api/propuestas/publica/[id]/route.ts
  - apps/web/app/(app)/p/[id]/page.tsx
  - apps/web/lib/test/liga-plano-vallas.e2e.test.ts
---

# Vallas (esqueleto, 19/11)

Pedido del dueño el 2026-11-19: un módulo propio para las **vallas publicitarias**,
al estilo de Imprenta/imprentas, donde se irán metiendo **más reglas de negocio**.
Decisión de forma en el [ADR 0052](../../docs/adr/0052-vallas-modulo-con-reglas-enchufables.md).

> [!danger] ROJO R3 · las migraciones de vallas esperan al dueño para servidores
> `20261119_vallas_esqueleto.sql` está aplicada solo a la base de e2e y, por pedido
> del dueño, a `spaces_hoy` (5434, local, para probarla).
> `20261119_vallas_sembrar_competencia_por_omision.sql` (las categorías por
> omisión, abajo) la aprobó el dueño para LOCAL el 19/11. **A ningún servidor.**

> [!success] 2026-11-19 · decisiones del dueño sobre la competencia de marcas
> 1. **Solo avisa, nunca bloquea.** El nivel está fijo en `aviso`
>    (`configuracion.ts` lo tipa como literal y la regla lo escribe fijo al emitir).
> 2. **Aplica a todo el sitio**: alcance por omisión `sitio`.
> 3. **Las categorías las edita SOLO el Dueño** (crear, editar, dar de baja). Ver,
>    quien ve Inventario.
> 4. **Cada organización trae doce categorías por omisión**, editables.
>
> Rama `feat/vallas-decisiones` desde `integra/18-11` `3e73f5e5`. Apunte en el
> [ADR 0052](../../docs/adr/0052-vallas-modulo-con-reglas-enchufables.md).

> [!important] 2026-11-20 · el PLANO por sitio, arriba de todo en `/vallas`
> Pedido del dueño: «tiene que estar un mapa del plano de las vallas». Eligió **un plano
> por sitio** y aprobó el boceto (cuadros numerados en su lugar, a escala, el grupo
> marcado debajo, y libre/ocupado). Rama `feat/vallas-plano-por-sitio` desde
> `integra/18-11` `8f993be6`. **Sin migraciones.** Detalle en «El plano por sitio», abajo.

> [!important] 2026-11-20 · ESQUINAS: la pared dobla a la derecha o a la izquierda
> Pedido del dueño: «recuerda que hay vallas que están en esquinas y doblan a la derecha
> o izquierda, para que se muestre». Rama `feat/vallas-esquinas` desde `integra/18-11`
> `2ad1152c`. **Una migración (ROJO R3)**: `20261120_vallas_esquina.sql` agrega
> `vallas.dobla` (`null` | `'izquierda'` | `'derecha'`, CHECK `vallas_dobla_ck`).
> **Aprobada por el dueño SOLO para local**; aplicada solo a la base de e2e. Detalle en
> «Las esquinas», abajo.

> [!important] 2026-11-20 · Vallas también como PESTAÑA dentro de Inventario
> Pedido del dueño, después de dejarla una sola vez en el menú: «en Inventario añade la
> parte de vallas para que también se tenga esa opción y validación». El **menú no cambia**
> (una entrada, en Comercial). En la pantalla **Inventario**, junto a Todos · Fijos ·
> Digitales, hay una pestaña **«Vallas · En proceso»** que monta `VallasPantalla` tal cual
> (alta, grupos, plano, «Verificar una marca»). Rama `feat/inventario-pestana-vallas`.
>
> - `PestanasMedio` (`components/demo/inventario/ResumenInventario.tsx`) acepta `vallas?:
>   { activa, onElegir }`; solo Inventario la ofrece. Con Vallas activa ninguna pestaña de
>   medio queda marcada.
> - `app/(app)/(shell)/inventario/page.tsx`: estado `vista`; volver por «Fijos» rearma la
>   tabla con ese filtro (`InventarioTabla` `medioInicial`).
> - Permisos sin cambios: la pantalla Inventario ya es solo Dueño y Administrador.
> - Prueba: `components/demo/inventario/pestana-vallas.test.ts` (vista en rojo, 3 de 4).

> [!important] 2026-11-20 · Vallas, SOLO en Comercial (una sola entrada)
> Al ver el menú en el navegador el dueño pidió: «hay 2 menús de vallas, cámbialo a que
> solo haya uno, es en Comercial». Rama `fix/vallas-solo-en-comercial` desde
> `integra/18-11` `0e13d222`.
>
> - La entrada `vallas` vive ahora en el grupo `vender` (Comercial), justo después de
>   Disponibilidad, con la insignia «En proceso» y los mismos roles (`MANDO` + `VENTA`).
> - **Inventario ya no la tiene**, y el espejo `vallas-comercial` y la función `espejo()`
>   se retiraron. `NavItem.espejoDe` y `claveDeTexto()` se quedan, sin uso hoy.
> - **Permisos del servidor sin cambios**: siguen siendo los de `inventario` (ver lee,
>   crear escribe). Cambiar de grupo en el menú no toca `rol_permisos`.
> - Lo fija `components/demo/shell/vallas-en-comercial.test.ts` (reescrita, vista en rojo
>   7 de 13 antes del cambio).
>
> Lo de abajo (19/11) queda como historia: describe el espejo que este cambio retiró.

> [!note] 2026-11-19 · Vallas va igual en Comercial (SUPERADO el 20/11: ver arriba)
> Pedido del dueño: las vallas son lo que se vende, y el equipo comercial las usa
> («Verificar una marca» antes de proponer). Rama `feat/vallas-en-comercial` desde
> `integra/18-11` `6911c588`.
>
> **Menú.** Sigue en **Inventario** y sale **también en Comercial**, justo después de
> Disponibilidad, con la misma insignia «En proceso». Es una entrada **espejo**
> (`NavItem.espejoDe`, construida con `espejo()` en `components/demo/shell/nav.ts`): copia
> ruta, rótulo, icono, roles e insignia de la original y solo cambia clave
> (`vallas-comercial`) y grupo. Detalle del patrón en [[03-Frontend/shell-y-navegacion]].
>
> **Quién la ve.** Los roles de la entrada pasan de `MANDO` a **`MANDO` + `VENTA`**
> (Dueño, Administrador, Director comercial, Gerente de ventas, Vendedor), en los dos
> grupos. Operaciones, Finanzas e Imprenta siguen sin verla.
>
> **Permisos del servidor: NO cambió ninguno.** Los tres roles de venta ya tienen
> `inventario.ver` y no `inventario.crear` en la matriz por omisión
> (`20260929_roles_de_venta_matriz.sql`). Con eso leen vallas, grupos y categorías y usan
> `POST /api/vallas/verificar`; dar de alta, editar o borrar vallas y grupos les da 403, y
> las categorías siguen siendo **solo del Dueño** (`puedeEditarCompetencia`). Lo único que
> se abrió es la **puerta de la pantalla** (`AuthGate`, que empareja por ruta con el `NAV`):
> antes un vendedor que abría `/vallas` era devuelto a su inicio. La pantalla ya escondía
> las altas con `usePuede('inventario','crear')`. Lo vigila `vallas.e2e.test.ts` (bloque
> «Vallas en Comercial», con la matriz de la migración y sin filas a mano).

> [!important] 2026-11-19 · «En proceso» en todas las instancias, y datos de ejemplo en la demo
> Pedido del dueño: el módulo sale **tal como está** a todas las versiones, diciendo que
> todavía se construye. Rama `feat/vallas-en-proceso-demo` desde `integra/18-11` `dc5c2f9d`.
>
> **La leyenda.** `NavItem.insignia` (`components/demo/shell/nav.ts`) es una etiqueta
> **genérica** junto al rótulo: hoy solo existe `'en-proceso'` y solo la lleva Vallas. Su
> texto es `nav.insignia.<valor>` (es «En proceso» · en «In progress» · it «In corso» ·
> pt «Em andamento»). `Sidebar.tsx` la pinta como la pastilla del Dashboard (`TONO.aviso`
> de `components/demo/admin/Chip.tsx`) en chico y al final del renglón; con el menú
> colapsado va en el globo y en el texto accesible. La cabecera de `/vallas` lleva la
> misma pastilla junto al título y una franja de aviso (`FRANJA_AVISO`, `role="note"`):
> «**En proceso:** Este módulo todavía se está construyendo; las reglas y la numeración
> pueden cambiar.» (`vallas.en-proceso.aviso`). **Para quitarla** al terminar el módulo:
> borrar `insignia` de la entrada y la franja de `Vallas.tsx`.
>
> **La demo.** Se enganchó al **mismo** mecanismo que siembra la demostración: el catálogo
> (`scripts/semilla-catalogo-demo.mjs` → `semilla-catalogo-modulos.mjs`, ver
> [[04-Datos/semilla-de-demostracion]]), que corre una persona con
> `infra/scripts/sembrar-catalogo-demo.sh` y que **no viaja en la imagen** (el
> `Dockerfile` copia `scripts/` por lista blanca). Por eso una instancia de cliente recibe
> solo la leyenda y la pantalla vacía («Todavía no hay vallas. Da de alta la primera sobre
> un sitio del inventario.»), y las doce categorías de siempre.
>
> Lo que siembra (`planVallas` / `sentenciasVallas`), todo con `CAT-` y guardado por número
> o nombre con `not exists`:
>
> | | |
> |---|---|
> | Vallas | 8: `CAT-V01..V03` (CAT-F01, Espectacular Reforma Norte, 4.3 × 7.2 c/u), `CAT-V04/V05` (CAT-F02, caras 1 y 2), `CAT-V06` (CAT-F04, Valla Satélite, 8 × 3), `CAT-V07` (CAT-F06, Vallarta), `CAT-V08` (CAT-F11, de baja: **inactiva**) |
> | Grupos | `CAT-G01` «una sola imagen» 12.9 × 7.2 (V01–V03) · `CAT-G02` «separadas» (V04, V05) |
> | Categorías | las 12 por omisión si faltan (una organización creada con `--crear-org` no pasa por la migración ni por el alta) |
> | Marcas | por **cliente**, en todas sus campañas: Refresquera → «Coca-Cola», Telefonía → «Telcel», Automotriz → «Nissan». Solo donde la marca está vacía o con la genérica que dejaba la ficha antes («Refresquera»); lo que alguien escribió no se pisa. Una base nueva ya nace con la buena |
>
> **El caso de competencia**, para enseñarlo: en «Verificar una marca», **Pepsi** con la
> fecha de hoy y la valla **CAT-V01** → aviso, porque la campaña al aire de la Refresquera
> (Coca-Cola) ocupa CAT-F01. Va por cliente porque el calendario se mueve con el ancla y la
> campaña al aire cambia; la prueba lo comprueba cualquier día hasta 2028. También
> **AT&T** en CAT-V04 (Telcel en CAT-F02) y **Toyota** en CAT-V06 en las fechas de la
> CAT-CMP-018 (Nissan). Las campañas fijas del catálogo no admiten dos marcas a la vez en
> el mismo sitio (lo exige `comprobarCoherencia`), así que la segunda marca es la que se
> verifica, que es justo para lo que está la tarjeta.
>
> **Sin la migración.** Si la base no tiene `20261119_vallas_esqueleto.sql`,
> `comprobarBase` lo dice («sin las tablas de vallas») y el catálogo se siembra **sin
> vallas** (`sinVallas`), como ya pasaba con `espacios_comprados`; `--deshacer` tampoco las
> toca. `--deshacer` borra las vallas `CAT-V`, las de sitios `CAT-` y las de grupos `CAT-G`
> **antes** que los sitios (FK `restrict`), y **no** borra las categorías: son las de
> omisión de toda organización.
>
> [!danger] ROJO R3 · para que llegue a una demo de servidor hace falta, en este orden
> 1. que la migración de vallas llegue a esa base por su camino (imagen + `update.sh`), cuando
>    el dueño la apruebe para servidores;
> 2. y que **una persona** corra el catálogo (idempotente: solo mete lo que falta):
>    ```
>    cd /var/www/Spaces && git pull
>    sudo bash infra/scripts/sembrar-catalogo-demo.sh spaces_demo --org=demo
>    ```
>    Esa es la demo del PADRE (la base `spaces_demo`, donde vive el catálogo). Si el
>    catálogo de esa base se sembró con otro calendario y ya no es coherente hoy, el script
>    se niega: ver «Opción A» en `docs/datos/20261103_base_demo_nueva.md`.
>
> **`demo.space-os.io` NO tiene el catálogo**: desde el ADR 0050 usa los datos de g500 tal
> cual, y el script no está en su imagen. Sembrarle vallas de ejemplo ahí es meter el
> catálogo `CAT-` entero en la organización de g500 —o un sembrado propio sobre sus sitios—,
> y **eso lo decide el dueño**; no se hizo ni se escribió el comando.

## Qué reutiliza y qué agrega

- **Reutiliza `sitios`**: `tipo_medio = 'VALLA'`, `ancho`, `alto`, `caras`. Una valla
  vive en un sitio y no copia sus datos (al elegir el sitio, la pantalla propone sus
  medidas).
- **Reutiliza `campanas.marca`** (texto) como la marca de una reserva. Si está vacía,
  cuenta el nombre del cliente. No hay tabla de marcas aparte.
- **Reutiliza los permisos de `inventario`**: `ver` lee, `crear` escribe. Sin módulo
  nuevo en `rol_permisos`. Entrada **«Vallas»** en el grupo **Comercial** del menú
  (desde el 20/11, **solo** ahí; nació en Inventario y el 19/11 estuvo en los dos), con
  `MANDO` + `VENTA` (hasta el 19/11 solo `MANDO`). Va en Comercial porque las vallas
  son lo que se vende y el equipo comercial verifica la marca antes de proponer.

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

Configuración por omisión (decisión del dueño, 19/11): **`nivel: 'aviso'`** —fijo,
no hay forma de configurarla para que bloquee— y **`alcance: 'sitio'`**: cualquier
valla del mismo sitio, **más las de su grupo** (un grupo se vende junto aunque cruzara
de sitio). Los alcances más estrechos siguen en el código (`valla`, `grupo_imagen`,
`grupo`) y con prueba, por si el dueño cambia de idea.

Con alcance `sitio` el aviso se agrupa **por sitio, campaña y marca**: como la reserva
ocupa todas las vallas del sitio, sin agrupar una misma campaña de Pepsi daría un aviso
idéntico por cada valla. El aviso nombra la valla propia si también está ocupada. El
texto de la pantalla: «No van en el mismo sitio en las mismas fechas · Solo avisa, no
bloquea. Las edita el Dueño.»

**Las ocupaciones salen de las reservas, que hoy son por SITIO**: una reserva viva
(no cancelada; tentativa sin caducar) ocupa **todas** las vallas de su sitio. Es la
aproximación honesta mientras la reserva no sepa en qué cuadro cae.

> [!warning] Conectada a `POST /api/vallas/verificar` y, desde el 20/11, a las PROPUESTAS
> Solo informa, en los dos sitios. **Una sola puerta**: `verificarCompetencia`
> (`vallas-controller.ts`) arma el contexto con `contextoParaVerificar` y corre
> `evaluarReglas`; la usan la ruta de Vallas y `lib/server/propuestas-competencia.ts`
> (PROP-MARCA, ver [[comercial-propuestas-campanas]]): al crear la propuesta, al
> agregarle sitios, al editar su marca y en la vista previa de la pantalla
> (`POST /api/propuestas/competencia`). La propuesta no tiene copia de la regla.
>
> **Sigue SIN enganchar** a `reservar` ni a `generarCampanaDesdePropuesta`
> (`lib/server/campanas-repo.ts`): eso es dinero (R4) y la reserva no sabe todavía en
> qué valla cae. Lo único que `generarCampanaDesdePropuesta` hace desde el 20/11 es
> copiar `propuestas.marca` a `campanas.marca`, para que la regla vea la campaña con
> la marca con que se vendió.

## El plano por sitio (20/11)

La primera tarjeta de `/vallas` (`components/vallas/PlanoVallas.tsx`, `TarjetaPlano`) es
un dibujo por sitio. Lo arma `armarPlano` (`lib/vallas/plano.ts`, puro) y el componente
solo lo pinta:

```
Sitio: Periférico Sur 4500
┌───────┬───────┬───────────────┐
│ V-001 │ V-002 │    V-003      │
│ 6x3 m │ 6x3 m │   12x3 m      │
│ Libre │ Pepsi │   Libre       │
└───────┴───────┴───────────────┘
└─ G-001 (una imagen) ─┘
```

- **Forma**: sitio → **una fila por cara** (las sin cara al final) → bloques (un tramo de
  grupo o una valla suelta) → cuadros. Solo vallas **activas**; un sitio sin ninguna no
  sale. Sitios por nombre.
- **Orden**. `posicion` la escribe `fijarMiembros` y es el orden **dentro del grupo**; una
  valla suelta la tiene siempre nula. Ordenar la fila entera por `posicion` intercalaría
  dos grupos y mandaría las sueltas al final, así que: dentro del grupo manda `posicion`
  (nulos al final, luego número) y el grupo entero va donde cae su número más bajo. El
  número se ordena como número (`V-2` antes que `V-10`).
- **Escala**: el ancho de cada cuadro es `flex-grow` = sus metros, y cada fila mide lo que
  suma respecto de la más ancha del sitio; el alto, relativo a la valla más alta del sitio.
  Mínimos legibles: 5.5rem de ancho (`ANCHO_MINIMO_REL` en el dato) y `ALTO_MINIMO_REL`.
  Si no cabe en un teléfono, el plano **de cada sitio** tiene su scroll horizontal; la
  página no se ensancha.
- **Grupos**: corchete debajo de sus cuadros con «G-001 (Una sola imagen)»; si el grupo
  tiene vallas en otro sitio se marca en cada uno con «· sigue en otro sitio». Un grupo
  repartido en dos caras sale en las dos filas.
- **Ocupación**: selector de fechas (por omisión hoy → +30, fecha del navegador) y
  `GET /api/vallas/ocupacion?desde&hasta`. **Las reservas son por SITIO**: una campaña
  viva ocupa todos los cuadros del sitio, y la pantalla lo dice en la leyenda. El
  criterio es **el mismo** que el de «Verificar una marca»: las dos leen
  `reservasVivasEnSitiosConVallas` (`vallas-repo.ts`) —no cancelada, tentativa sin
  caducar, solape inclusivo, solo sitios con vallas activas—, una sola consulta para toda
  la organización. Cada cuadro dice «Libre» o la marca (sin marca, el cliente; sin
  cliente, el nombre de la campaña) y «+n» si hay más campañas.
- **Accesible**: el estado va en texto, no solo en color (verde libre, ámbar ocupada), y
  cada cuadro lleva `aria-label` «Valla V-001, 6 × 3 m, Ocupada por Pepsi, Telcel».
- **Idiomas**: claves `vallas.plano.*` en es/en/it/pt (en «Poster panel layout», it
  «Pianta dei poster», pt «Planta dos outdoors»). «Ocupada» es «Occupied» en inglés, como
  en Disponibilidad (lo exige `costura.test.ts`).

`GET /api/vallas/ocupacion` valida que las fechas **existan** (`2026-13-40` pasa el patrón
y Postgres lo rechazaría con 500). **Desde el 20/11 (tarde) `POST /api/vallas/verificar`
también**: con `2026-13-40` o `2026-02-30` responde **400** en vez de 500. Es el mismo
`fechaReal` de `vallas-controller.ts`, exportado y reutilizado también por la vista previa
de las propuestas (`POST /api/propuestas/competencia`), no copiado.

### El mismo plano en la propuesta (20/11, noche)

El cuerpo del plano es `PlanoVallas` (fechas, leyenda y un dibujo por sitio); `TarjetaPlano`
solo lo envuelve en la tarjeta plegable de `/vallas`, que **no cambia**. «Dibujar plano» de
la propuesta (`components/demo/propuestas/DibujarPlanoPropuesta.tsx`, en la ficha y en
Nueva propuesta) lo usa con:

- `sitioIds`: solo los sitios de la propuesta. `armarPlano` filtra **después** de contar
  los sitios de cada grupo, así que un grupo que sigue en un sitio ajeno a la propuesta
  sigue diciendo «sigue en otro sitio». Lista vacía → plano vacío.
- `fechas` fijas: sin campos Desde/Hasta; dice el periodo («Lo ocupado del … al …») y,
  si aún no hay fechas, no marca nada ocupado y lo dice (`vallas.plano.sin-fechas`).
- `textoVacio`: «Ninguno de los sitios de esta propuesta tiene vallas dadas de alta.»

Solo se ofrece con `inventario.ver` (lo piden `GET /api/vallas` y `/ocupacion`).

### Las esquinas (20/11)

Cada valla puede decir **«Después de esta valla la pared dobla»**: `vallas.dobla` =
`null` (sigue recta, lo de siempre) · `'izquierda'` · `'derecha'`
(`20261120_vallas_esquina.sql`, CHECK con nombre `vallas_dobla_ck`). Va en la valla y no
en el sitio porque el quiebre cae **entre dos cuadros concretos** de una cara.

- **Alta y edición** (`components/vallas/Vallas.tsx`, `FormValla`): selector «Esquina:
  No dobla / Dobla a la izquierda / Dobla a la derecha» con la ayuda «Después de esta
  valla, la pared da vuelta». La lista de vallas lo repite («Esquina · dobla a la
  derecha»). Servidor: `dobla: z.enum(DOBLECES).nullable()` en `vallaSchema`
  (`vallas-controller.ts`): otro valor es **400** antes de tocar la base; sin la clave no
  se toca (editar otra cosa no borra la esquina); `null` la quita. El repo la escribe en
  el `insert` y en la lista de columnas del `update` (`tenant_id = $2`, `q`).
- **Dato del plano** (`lib/vallas/plano.ts`, `partirEnEsquinas`): cada fila se parte
  **después de ordenarla**, en `tramos` rectos. Se corta DESPUÉS de cada cuadro con
  `dobla`; el tramo siguiente lleva `gira` = esa dirección. Si la que dobla es la
  **última** de la cara no se abre un tramo vacío: queda `esquinaFinal`. Un grupo que
  cruza la esquina sale en los dos tramos (`cortadoAntes` / `cortadoDespues`) para que
  su corchete lo siga abarcando entero. `bloques` sigue siendo la fila entera; cada
  cuadro trae su `dobla`. El quiebre es **por cara**.
- **Dibujo** (`PlanoVallas.tsx`): entre dos tramos va un separador de esquina —una flecha
  (`CornerUpRight` / `CornerUpLeft`), una línea vertical punteada y el texto
  «Esquina · dobla a la derecha»—; la última que dobla deja el mismo separador al final.
  El tramo de después se dibuja **girado en perspectiva** (`perspective(700px)
  rotateY(∓28deg)`, eje en su borde izquierdo, pegado a la esquina): **a la derecha la
  pared se va al fondo** (su borde derecho se achica) y **a la izquierda viene hacia el
  frente** (se agranda). 28° deja leer número, medida y estado. El grupo cortado deja
  abierto (punteado) el lado del corte y añade «· dobla la esquina». El `aria-label` del
  cuadro que dobla termina en «…, en esquina, dobla a la derecha». El giro no ocupa sitio
  en el flujo: en móvil lo absorbe el scroll propio del plano, no la página.
- **Idiomas**: `vallas.campo.dobla*` y `vallas.plano.esquina.*` en es/en/it/pt (en
  «Corner · turns right», it «Angolo · gira a destra», pt «Esquina · vira à direita»).
- **Demo**: CAT-V02 dobla a la derecha (`ESQUINAS_VALLAS` en
  `scripts/semilla-catalogo-modulos.mjs`), así el grupo de una imagen CAT-G01 cruza la
  esquina y CAT-V03 queda en la otra pared. Va en un `update` aparte (`and dobla is
  null`: no pisa lo que alguien cambió y la 2.ª corrida no toca nada); una base con las
  tablas de vallas pero sin la columna la detecta `comprobarBase` (`sinEsquinas`) y
  recibe las vallas rectas, sin tronar.

> [!important] Decisión del dueño (20/11): las vallas dadas de baja NO salen en el plano
> Ni en un sitio que se quedó sin ninguna activa (no sale el sitio) ni en uno que conserva
> otras (solo se dibujan las activas). Lo fija `lib/vallas/plano.test.ts` («en un sitio con
> una de baja y otra activa, solo se dibuja la activa»), que cae si se quita el filtro de
> `activo` en `armarPlano`.

### En la liga del cliente (20/11)

Dueño: «En la liga que se le manda al cliente también debe estar, si es valla, cómo se ven
las pantallas que rentará, si es más de 1; si solo es una, entonces sin tema, como se
encuentra actualmente.»

- **Cuándo**: si las vallas **activas** de los sitios de la propuesta suman **más de una**
  (entre todos los sitios; `MINIMO_VALLAS_PLANO_LIGA = 2`, `lib/vallas/plano-publico.ts`).
  Con 0 o 1 la respuesta de la liga **no trae el campo** y `/p/[id]` queda igual que antes.
  Las de baja no cuentan.
- **Dónde viaja**: campo `planoVallas` de `GET /api/propuestas/publica/[id]` (sin ruta
  nueva: con 0 o 1 valla no hay ni una petición de más). `{ sitios: [{ id, nombre }],
  vallas: [{ id, sitioId, numero, cara, ancho, alto, grupoId, posicion, dobla }], grupos:
  [{ id, numero, nombre, modo, sigueFuera }] }`. `sitioId` es el mismo que la liga ya
  expone en `items[]`; los ids de vallas y grupos son **opacos** (`v1`, `g1`) y solo unen
  valla con grupo dentro de la respuesta.
- **Tenant (R2)**: `lib/server/vallas-publicas-repo.ts` sigue el patrón de
  `fotos-sitio-publico-repo.ts`: `propuesta_tenant_por_token($1)` con `qRaw1` (función
  `security definer`, no lee filas con RLS) y UNA consulta bajo `qConTenant(tenant)` con
  `tenant_id = $2` en `propuestas`, `sitios`, `vallas` y `vallas_grupos`. Solo sitios que
  son renglón de ESA propuesta. `sigue_fuera` (el grupo tiene vallas activas en un sitio
  que no es de la propuesta) se calcula en la base y sale como booleano: el otro sitio no
  se lee hacia fuera.
- **Lista blanca** (`vallas-publicas-controller.ts`): nada de notas, ocupación, reservas,
  campañas, marcas ni clientes; un campo que se colara en la fila no llega al JSON. Si la
  lectura falla, `null` + `console.error` y la liga sale sin plano (no se cae).
- **Dibujo**: `PlanoVallasCliente` (`PlanoVallas.tsx`) → `planoDesdeLiga` → `armarPlano`
  con `ocupaciones: []` y `gruposQueSiguenFuera` (opción nueva: el cliente no recibe las
  vallas de fuera, así que el corchete no lo puede deducir). `PlanoDeSitio` en modo
  `publico`: cada cuadro dice **«Tu valla»** (tono acento) en lugar de Libre/Ocupada, sin
  fechas, sin leyenda, y **no pide nada** (ni `/api/vallas/ocupacion` ni sitios, que exigen
  sesión). Esquinas y grupos igual que dentro. Tarjeta «Así se ven tus vallas», debajo de
  los sitios. Textos `vallas.plano.tuya` y `vallas.publico.*` en es/en/it/pt.

## API

| Ruta | Permiso |
|---|---|
| `GET /api/vallas` → `{ vallas, grupos }` | `inventario.ver` |
| `POST /api/vallas` · `PATCH`/`DELETE /api/vallas/[id]` | `inventario.crear` |
| `POST /api/vallas/grupos` · `PATCH`/`DELETE /api/vallas/grupos/[id]` (`vallaIds` deja EXACTAMENTE esas, en ese orden) | `inventario.crear` |
| `GET`/`POST /api/vallas/competencia` · `PATCH /api/vallas/competencia/[id]` | `ver` / `crear` |
| `POST /api/vallas/verificar` `{ marca, fechaInicio, fechaFin, vallaIds?, sitioIds?, excluirCampanaId? }` → `{ hallazgos, bloquea }` | `inventario.ver` |
| `GET /api/vallas/ocupacion?desde&hasta` → `{ desde, hasta, ocupaciones: [{ sitioId, marca, campanaId, campanaNombre, inicio, fin }] }` (20/11, el plano) | `inventario.ver` |

Una valla en un sitio ajeno, o un grupo con vallas ajenas, es **400** (el repo lo
pregunta antes; la FK compuesta lo impide igual en la base).

Las categorías: **ver** con `inventario.ver`; **crear y editar (incluida la baja,
`activo: false`) SOLO el Dueño**: `puedeEditarCompetencia(rol)` (`lib/roles.ts`,
`rol === 'DUENO'`, el mismo patrón que `puedeEncuadrar`). Los demás reciben **403**
«Solo el Dueño puede editar las marcas que compiten» (traducido en
`errores-servidor.ts`). El Administrador también, aunque tenga `inventario.crear`: la
puerta es el ROL, no el permiso. En PATCH el 403 va antes del 404, para no revelar qué
ids existen. La pantalla esconde los botones con la misma función.

## Categorías por omisión

Cada organización trae estas doce (`lib/vallas/competencia-por-omision.ts`), editables
por el Dueño:

| Categoría | Marcas |
|---|---|
| Refrescos de cola | Coca-Cola, Pepsi |
| Tiendas departamentales | El Palacio de Hierro, Liverpool, Sears |
| Telefonía | Telcel, AT&T, Movistar |
| Bancos | BBVA, Banorte, Santander, Citibanamex, HSBC |
| Cerveza | Grupo Modelo, Heineken México |
| Comida rápida | McDonald's, Burger King, KFC, Carl's Jr. |
| Pizzas | Domino's, Pizza Hut, Little Caesars |
| Autoservicio | Walmart, Soriana, Chedraui, La Comer |
| Tiendas de conveniencia | OXXO, 7-Eleven, Circle K |
| Automotriz | Nissan, Volkswagen, Chevrolet, Toyota, KIA |
| Streaming | Netflix, Disney+, Prime Video, Max |
| Aerolíneas | Aeroméxico, Volaris, Viva Aerobus |

**Cómo llegan**, por dos caminos y una sola lista:

- **Organizaciones nuevas**: `crearOrgConDueno` (`cuentas-controller.ts`) llama a
  `sembrarCompetenciaPorOmision(client, tenantId)` (`vallas-repo.ts`) **dentro de la
  transacción del alta, después de `fijarTenant`**: la tabla tiene RLS forzada y el
  tenant tiene que coincidir; si el alta se deshace, las categorías se van con ella.
  Cubre `/api/tenants`, `/api/signup` y `/api/bootstrap`, que pasan todas por ahí.
- **Organizaciones que ya existían**: la migración
  `20261119_vallas_sembrar_competencia_por_omision.sql`, `@tipo: esquema` (para que
  `update.sh` la aplique sin `--con-datos`), fijando `app.tenant_id` organización por
  organización, `on conflict do nothing`.
- **Se descartó** sembrarlas al leer la primera vez (un GET que escribe, con carreras)
  y un trigger en `tenants` (tendría que cambiar `app.tenant_id` a mitad del alta).

La lista vive dos veces (TS y SQL, porque una migración no importa TS) y
`competencia-por-omision.test.ts` **exige que sean idénticas** (mutado: cambiar
«Max» por «HBO» en la migración la pone roja). Si la lista cambia, la migración
aplicada **no se edita**: va otra migración.

Ojo con el nombre: `..._vallas_competencia_por_omision.sql` habría ordenado ANTES de
`..._vallas_esqueleto.sql` ('c' < 'e') y la tabla no existiría. Con `sembrar` ('s' >
'e') el orden sale por nombre y **no hace falta tocar `ANTES_DE`**.

Lo que NO las recibe: las organizaciones que siembran a mano los scripts de demo
(`scripts/semilla-*.mjs`) después de migrar, ni `sembrarTenant` de las e2e.

## Pruebas

- `lib/vallas/plano.test.ts` (19) y `components/vallas/plano.test.ts` (17, el componente
  real rendido en es/en/it/pt: número, medida, «Libre» en texto, el grupo con su modo,
  `aria-label`, «Pepsi +1» y el ancho proporcional). Vistas en rojo antes del código
  (19/19 y 17/17).
  Desde el 20/11 (noche) son **25 y 21**: el filtro por `sitioIds` (5) y `PlanoVallas`
  con fechas fijas y texto vacío (4), vistos en rojo (3 de 5 y 4 de 4) antes del código.
  **Esquinas (20/11): 31 y 31** — `partirEnEsquinas` (6: recta, derecha, dos quiebres,
  última que dobla, grupo que cruza, por cara; 6 de 6 en rojo) y el render en es/en
  (separador, giro, `aria-label`, izquierda, esquina final, grupo cortado, sin esquina;
  8 de 10 en rojo, los dos «sin esquina» pasaban ya).
- **Liga del cliente (20/11)**: `lib/server/vallas-publicas-controller.test.ts` (9: token
  malo no llega a la base, 0 y 1 valla → null, 2 en sitios distintos → plano, ids opacos,
  lista blanca, grupo ajeno fuera, falla → null), `lib/vallas/plano-publico.test.ts` (4),
  `armarPlano` con `gruposQueSiguenFuera` (2 en `plano.test.ts`) y
  `components/vallas/plano-cliente.test.ts` (13: «Tu valla» en es/en/it/pt, sin
  Libre/Ocupada ni fechas, «sigue en otro sitio», cero `fetch`): 14 en rojo antes del
  código. La página real en `lib/i18n/pantallas-cuenta-shell.test.ts` (3: con dos vallas
  sale la tarjeta; sin el campo o con una, no; escritas tras el código).
  `lib/test/liga-plano-vallas.e2e.test.ts` (8) contra Postgres y Next: el plano con
  número, medida, cara, posición, esquina y grupo `sigueFuera`; una sola activa (la otra de
  baja) → sin campo; beta no ve las de alfa ni al revés; token inventado/mal formado 404;
  ni marca ni campaña ni notas ni el sitio de fuera ni uuids ni el tenant en el texto
  crudo. Vista en rojo contra un build sin el cambio de la ruta (2 de 8: los positivos).
- `lib/server/vallas-controller.test.ts` (20/11, 9): `dobla` acepta izquierda/derecha/null
  y lo pasa al repo; sin la clave no se toca; `'arriba'`, `'Derecha'`, `''`, `1`, `true`
  son 400 sin llegar al repo (3 de 9 en rojo: los de rechazo ya los daba el `.strict()`).
- `lib/test/vallas-esquina.e2e.test.ts` (20/11): la migración (columna + CHECK, que la base
  hace cumplir con 23514), alta y edición con `dobla` (editar otra cosa no la borra,
  `null` la quita), 400 en alta y edición sin escribir, y aislamiento (la otra
  organización 404 y no la ve; rol de la app sin tenant, cero filas).
- `lib/test/vallas-plano.e2e.test.ts` (20/11): `GET /api/vallas/ocupacion` contra Postgres
  y Next — el criterio (inclusivo, cancelada, tentativa caducada/vigente/sin caducidad,
  sitio sin vallas activas, marca vacía → cliente), aislamiento entre organizaciones,
  COMERCIAL 200 / FINANZAS sin `inventario.ver` 403 / sin sesión 401 y fechas malas 400.
  **Escrita y NO corrida** el 20/11 (otro agente usaba el 3311 y el 5433).
- `components/vallas/en-proceso.test.ts`: la insignia en el menú (solo en Vallas) y el
  aviso en la cabecera, rendidos de verdad en es/en/it/pt (14, vistas en rojo).
- `scripts/semilla-catalogo-demo.test.ts` (sin base): 6–8 vallas sobre fijas tipo
  valla/espectacular, un grupo de cada modo sin avisos de grupo, las categorías idénticas
  a las de la app, el aviso Pepsi/Coca-Cola **cualquier día hasta 2028** con las reglas
  reales, que muerde (la misma marca o una valla libre no avisan), la marca solo donde
  está vacía o genérica, y el catálogo sin vallas cuando no hay tablas (8 nuevas, vistas en
  rojo; más «deshacer cubre cada tabla» con `competencia_categorias` como excepción).
- `lib/test/semilla-vallas-demo.e2e.test.ts`: las MISMAS sentencias del catálogo contra
  Postgres y Next reales, las de vallas con el **rol de la app** (RLS forzada): sin tenant
  o con el de otra organización no escribe; 8 vallas (1 inactiva), los dos grupos, 12
  categorías y las marcas; la 2.ª corrida no mete nada; `GET /api/vallas` las ve;
  `POST /api/vallas/verificar` con Pepsi en CAT-V01 da aviso (no bloqueo) y en CAT-V07
  nada; `--deshacer` las quita y deja las categorías (mutante: sin las vallas en el
  deshacer, el borrado de sitios muere por la FK → rojo).

- `lib/vallas/numeracion.test.ts` y `lib/vallas/reglas/reglas.test.ts`: unitarias
  (solapes, misma valla, grupo una imagen / separadas, alcances, sitio por omisión,
  un aviso por campaña y sitio, nunca bloqueo, evaluador). Vistas en rojo antes del
  código, también las del 19/11 (alcance sitio y nivel fijo).
- `lib/vallas/competencia-por-omision.test.ts`: la lista (12, sin marcas repetidas
  entre categorías, límites de la tabla) y que la migración traiga la misma.
- `lib/roles.test.ts` · `puedeEditarCompetencia`: solo `DUENO`.
- `lib/test/vallas.e2e.test.ts`: 13 casos contra Postgres y Next reales — CRUD, 403
  de COMERCIAL, 409, aislamiento por API y con el rol de la app (RLS y FK compuestas),
  la verificación (otra valla del mismo sitio avisa; otro sitio no), **403 de
  Administrador, Vendedor y Comercial al crear/editar/dar de baja categorías y 201 del
  Dueño**, y la migración sembrando a todas las organizaciones sin duplicar al
  repetirse y respetando una categoría propia con el mismo nombre.
- `lib/test/alta-organizacion.e2e.test.ts`: una organización nueva nace con las 12.

## Preguntas abiertas al dueño

Resueltas el 19/11: ~~¿bloquea o avisa?~~ (avisa) · ~~¿alcance?~~ (el sitio) ·
~~¿quién edita las categorías?~~ (solo el Dueño) · ~~¿categorías de entrada?~~ (las
doce de arriba).

Siguen abiertas: ¿la numeración la pone el usuario o la asigna el sistema? ¿Una valla
puede estar en más de un grupo? ¿La reserva pasará a ser por valla? ¿Hace falta un
catálogo de marcas ligado al cliente? ¿La lista por omisión cambia por país cuando
una instancia no sea de México?

Esquinas (20/11): ¿el dibujo del giro es el que espera? Hoy «a la derecha» manda la pared
siguiente **al fondo** y «a la izquierda» la trae **al frente**; si lo ve al revés, es
cambiar el signo de `giro()` en `PlanoVallas.tsx`. ¿Una esquina puede ser de otro ángulo
que 90° (ochavo)? Hoy solo izquierda/derecha.

Liga del cliente (20/11): como la reserva es **por sitio**, la liga enseña como «Tu valla» **todas** las vallas activas de cada sitio de la propuesta. Cuando la reserva sepa en qué cuadro cae, ¿solo las contratadas? ¿Y el cliente debería ver también las fechas o la medida del grupo para el arte?

## Relacionadas
[[02-Backend/_indice]] · [[inventario-y-sitios]] · [[operaciones-y-ot]] · [[MOC-Proyecto]]

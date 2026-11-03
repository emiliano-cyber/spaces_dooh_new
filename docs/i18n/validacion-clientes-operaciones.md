# Validación · lote de inglés «clientes y operaciones (parte 1)»

- **Rama:** `feat/ingles-operaciones-clientes` (worktree `.claude/worktrees/ingles-operaciones-clientes`). Diff revisado: `git diff 2e622add..HEAD`, cinco commits (`3fb83a6d`, `2f9065b0`, `bd768ec6`, `4d931fc9`, `f3e41c40`), 27 archivos.
- **Fecha:** 2026-11-02. **Validador:** agente independiente. No corrige código. Este informe es lo único que escribe, y no está commiteado.

## Veredicto: **ÁMBAR**. Se puede integrar después de corregir lo de abajo.

Lo que se comprobó de forma mecánica:

- **El español está intacto.** Los 37 de 37 estados (25 de clientes y 12 de operaciones) son idénticos byte a byte entre los componentes de `2e622add` y los de HEAD.
- **`faltantesParaRevision` no cambia en español.** Probé 120 combinaciones contra la versión vieja, sin idioma y con `'es'`, y sale lo mismo. El servidor (`captacion-repo.ts:395`) la sigue llamando sin idioma.
- **El español de Comercial y Propuestas no cambió.** Esas pantallas pintan las piezas compartidas, y su HTML español es idéntico byte a byte con las piezas viejas y con las nuevas.
- No se tocó nada prohibido y no hay dinero en el diccionario.
- Typecheck y unitarias en verde.
- De 10 mutantes mueren 8. **Los 2 que sobreviven son toasts de operaciones que ninguna prueba fija.**

El inglés se lee como software B2B en casi todo el lote. Hay **4 hallazgos de severidad media**. El primero es el que no puede esperar:

1. **«Dar de baja» → «Retire» rompe la costura al integrar.** `integra/ingles` ya trae catálogos con «Deactivate». Lo simulé con los diccionarios de `integra/ingles` más los de esta rama: `costura.test.ts` se pone en rojo con exactamente esta divergencia.
2. En la misma pantalla del almacén se dice la baja de tres maneras: «Retire», «{n} retired» y «Decommissioned».
3. Los toasts del almacén y de la imprenta no tienen prueba de clave. Los mutantes M4a y M4c sobreviven.
4. En la vista por mes, «Mar 26» se lee en inglés como «26 de marzo», no como «marzo de 2026».

Además hay unos 10 de severidad baja y tres comentarios o notas que afirman algo falso.

---

## 1 · Hallazgos de sentido en contexto

Las líneas son del valor `en` en `apps/web/lib/i18n/textos/clientes.ts` u `operaciones.ts`, y del punto de uso. Cada frase la leí en el HTML inglés rendido de los 37 estados. Para eso volqué el HTML inglés con un parche temporal a las dos pruebas de pantallas, que ya está revertido.

| clave | archivo:línea | inglés actual | problema | propuesto | sev. |
|---|---|---|---|---|---|
| `operaciones.almacen.mov.baja` | operaciones.ts:296 · `almacen/page.tsx:86` | `Retire` | Choca con `catalogos.comun.dar-de-baja` = `Deactivate`, mismo español «Dar de baja». Al integrar, `costura.test.ts` falla: «Dar de baja» → «Deactivate» (catalogos) / «Retire» (operaciones). El comentario (operaciones.ts:19-21) y la bóveda (idiomas-es-en.md:1099) dicen «igual que catálogos», y no es verdad. Ver §6. | `Decommission`, y añadir «Dar de baja» a `DISTINTOS_A_PROPOSITO` con su motivo (o `Deactivate` si el dueño prefiere unificar) | **media** |
| `operaciones.almacen.kpi.baja.uno/.otros` · `kpi.ninguno-baja` · `estado.baja` | operaciones.ts:314-316 · 292 | `{n} retired` · `none retired` · `Decommissioned` | En la misma pantalla el botón dice «Retire», el KPI dice «1 retired» y la pastilla del artículo dice «Decommissioned». Son tres palabras para un solo estado. Lo vi en el render: «Items · 1 retired» encima de una fila «Decommissioned». | `{n} decommissioned` · `none decommissioned` · `Decommissioned` (como el sitio de Comercial) | **media** |
| toasts de almacén e imprenta | `almacen/page.tsx:121,304,307,371,374` · `imprenta/page.tsx:66,243,305` | — | No hay prueba de qué clave usa cada aviso que no se rinde. Clientes sí la tiene (`textos/clientes.test.ts:130`) y operaciones no. **M4a** (`mover.registrado` → `alta.registrado`) y **M4c** (`no-avanzar` → `no-crear`) sobreviven a las 1168 pruebas de `lib/i18n`. Es la regla 9 del encargo y el error M7 de campañas y finanzas. | Un `describe` de avisos en `textos/operaciones.test.ts`, como el de clientes | **media** |
| etiqueta del periodo por mes | `disponibilidad/page.tsx:46` | `Mar 26` (cabecera y «in Mar 26») | `{ month: 'short', year: '2-digit' }` da «Mar 26», que en inglés se lee como fecha: «in Mar 26» = «el 26 de marzo». El «mar 26» español es la convención de siempre, pero en inglés no se sostiene. | `{ month: 'short', year: 'numeric' }` → «Mar 2026» (o «Mar ’26» a mano) | **media** |
| `clientes.form.iva.ayuda` | clientes.ts:338 | `Chosen from the VAT catalog (Settings → Configuration).` | El validador de Comercial ya señaló «Settings → Configuration» como redundante. El lote de administración, que está en curso y sin commitear en `integra-ingles`, llama a esa pestaña «Business settings» (`admin.tab.config`). | `(Settings → Business settings)` cuando aterrice admin, o `(set in Settings)` | baja |
| `clientes.filtro.ninguno` | clientes.ts:297 | `No client matches{busqueda}{tipo}.` | En inglés natural va en plural tras «no». Así se corrigió en Comercial (`comercial.pagina.vacio`: «No screens match»). | `No clients match{busqueda}{tipo}. Clear the filter to see all {n}.` | baja |
| `clientes.captacion.avance` · `guardar-avance` · `error.avance` | clientes.ts:477 · 481 · 452 | `Record update` · `Save update` · `The update could not be recorded` | «Record update» como título de sección se lee como sustantivo («actualización de registro»). Comercial negociación usa «Log contact» para lo mismo. | `Log progress` · `Save progress` · `Progress could not be logged` | baja |
| `operaciones.disponibilidad.kpi.estaticas` | operaciones.ts:238 | `Free static sites` | El KPI de al lado dice «Digital **screens** with room», y la rejilla entera habla de «screens». | `Free static screens` | baja |
| `operaciones.disponibilidad.kpi.piden.uno/.otros` | operaciones.ts:247-248 | `screens requested by {n} open proposal · they don’t block` | Comercial dice lo mismo como «screens in {propuestas} · not blocking» (`comercial.ts:677`). | `… · not blocking` | baja |
| `operaciones.disponibilidad.solo-hueco` | operaciones.ts:259 | `Only with free space` | «free space» suena a espacio físico. Es el filtro de pantallas con algo libre. | `Only with availability` | baja |
| `operaciones.clientes-badge.libres` | operaciones.ts:225 | `{libres} of {cupo} client places open` | «client places» no es una expresión natural. «slots» no sirve, porque es el otro eje de la misma ficha. | `{libres} of {cupo} client openings left` | baja |
| `operaciones.clientes-badge.lleno` | operaciones.ts:226-227 | `… Only campaigns from the clients already on it are accepted.` | «on it» queda vago en un `title` suelto. | `… Only campaigns from clients already on this screen are accepted.` | baja |
| `clientes.captacion.form.dueno` | clientes.ts:435 | `Land owner (added as a landlord on approval)` | En inglés se escribe en una palabra. | `Landowner (added as a landlord on approval)` | baja |
| `clientes.captacion.vencido-hace` | clientes.ts:498 | `overdue by {n} d` | Se entiende, pero en una tabla lo natural es «2d overdue». | `{n}d overdue` | baja |

**Revisado y correcto** (para no repetirlo):

- **Captación.**
  - «Prospecting» (coincide con el menú), «prospect», «Log», «Stage», «Sales rep».
  - «Pending approval / In progress / Closed».
  - «Approving adds the property (and its landlord, if new).», «The landlord already exists in the system.» (con el `.toLowerCase()` correcto en inglés), «Visit (note only)».
  - `faltantesParaRevision` en inglés: «To send it for review, it still needs: the address, the owner: …».
- **Clientes.**
  - «Legal name», «Tax regime», «CFDI use», «Tax ZIP code».
  - «Negotiation validated / not validated», «Draft + sent, incl. VAT», «historical close rate», «Outside the funnel: 1 rejected proposal (MX$ 500) · 1 cancelled campaign».
- **Comisiones.** «Applied commission», «Direct · no commission», «Validate / Validated».
- **Disponibilidad.**
  - «Two-week period» (glosario), «3/1–3/14» (orden de EE. UU.), «Otoño (confirmed, 5 slots)\n1 of 6 slots left».
  - «In proposal PR-0001 · Refresco Azul (Mar 1, 2026 to Mar 14, 2026, 2 spots)».
  - El calendario: «February 2026» y «M,T,W,T,F,S,S».
- **Almacén.** «Warehouse», «Depot: » (el prefijo de la ubicación), «In transit», «Install on a screen», «Tag / inventory number», «License plate / Plate», «Vinyl banner».
- **Imprenta.**
  - «Printing» (el módulo) y «Print shop» (el proveedor).
  - «Color proof: Approved / Pending», «Approve proof», «they move on to a work order», «Front-lit vinyl».
- **Plurales.** Los cuatro pares `.uno/.otros` del lote y `pagina`, que solo se pinta en plural y está bien justificado.
- **Se quedan en español, a propósito:** los catálogos SAT del alta (son el valor que se guarda), los ejemplos de marca, modelo y placas, y los datos de prueba («Llamar», «Grua»). Están declarados y son correctos.

**Las 6 excepciones nuevas de la costura están justificadas.** Comprobé cada una con la simulación (§2):

- **«Aprobada»:** «Approved» frente a «Approved on». La divergencia ya existía dentro de propuestas; aparece en la costura porque clientes es un segundo lote.
- **«Validada»:** el creativo es «Approved», la negociación es «Validated».
- **«Validar»:** en Campañas es «Review», en comisiones es «Validate».
- **«RFC»:** la cabecera corta es «RFC», la ficha de facturación dice «RFC (tax ID)».
- **«Vista»:** «Facing» frente a «View».
- **«Movimiento»:** «Transaction» frente a «Movement».

Cada una significa otra cosa en su pantalla. Una errata de documentación: la bóveda (`idiomas-es-en.md:1107`) dice «**Cinco** españoles nuevos» y luego enumera seis.

---

## 2 · Español intacto (evidencia)

- **Volcado de los 37 estados.**
  1. `I18N_VOLCAR` con los componentes de HEAD.
  2. `git checkout 2e622add -- <los 14 componentes y lib/captacion.ts>` y otra vez `I18N_VOLCAR`.
  3. `git checkout HEAD -- …` para volver.
  4. `diff -rq`, vacío en los dos casos: `CLIENTES-IGUAL` (25 archivos) y `OPER-IGUAL` (12 archivos).

  Con los componentes viejos fallan 39 pruebas de clientes y 13 de operaciones, todas de inglés. Es el rojo esperado.
- **`faltantesParaRevision`.** Escribí una prueba temporal, ya borrada, que importa la versión de `2e622add` y la nueva. Cubre 4 tipos × 5 contactos × 3 direcciones × 2 datos = 120 casos. Comprueba que `nueva(c)` y `nueva(c, 'es')` dan lo mismo que `vieja(c)`, y que `'en'` da la misma longitud con otro texto. Pasó. En la base de código hay dos llamadores:
  - `Captacion.tsx:324`, con `idioma`;
  - `captacion-repo.ts:395`, sin idioma, así que el mensaje 409 del servidor sigue en español.
- **Piezas compartidas** (`SlotsBadge`, `ClientesBadge`, `CalendarioDisponibilidad`). Solo las usan `comercial/page.tsx`, `SiteFicha.tsx` y `disponibilidad/page.tsx`, todos `'use client'`. No las usa Propuestas.
  - Comercial: volqué `pantallas-comercial.test.ts` (`VOLCAR_HTML`) con las tres piezas de `2e622add` y con las de HEAD. Sale idéntico en los 24 estados; 8 de ellos pintan las piezas.
  - Propuestas: lo mismo con `pantallas-propuestas.test.ts`. Sale idéntico en los 23 estados.
  - En verde: comercial 152/152 y propuestas 146/146.
  - Un comentario quedó viejo: `pantallas-comercial.test.ts:45` sigue diciendo que esas piezas «siguen en español, y no se comprueban». En inglés ahora salen traducidas; las vigila `pantallas-operaciones.test.ts`, no la de Comercial.
- **Costura tras integrar.** Transpilé con `typescript` los nueve diccionarios: catálogos de `integra/ingles`, que es igual a su commit, y los demás de esta rama. Corrí la misma regla que `costura.test.ts`, con las 14 excepciones de la rama. Queda **una** divergencia: «Dar de baja». Esta rama no la ve porque sale de `2e622add`, que todavía no tenía catálogos.

## 3 · Nada en español en el inglés

Barrí el texto visible y los `title`, `aria-label` y `placeholder` de los 37 HTML ingleses, buscando acentos, «¿¡» y palabras funcionales españolas. Solo aparecen datos de prueba («Llamar», «Tiene vista», «Articulo 2», «Grafica Sur») y los catálogos SAT, que están declarados. El barrido del propio lote (`pantallas-*.test.ts`) también está en verde.

## 4 · Reglas

- **Dinero.** No hay cifras ni símbolos en `clientes.ts` ni en `operaciones.ts` (`grep` de `$`, `MX$`, `US$` y `<cifra> MXN|USD`: vacío). En inglés, los importes llevan `formatMonto`/`formatMontoCorto(…, idioma)` (`PipelineCliente`, `CampanasDelCliente`, `clientes/page.tsx`); el render da «MX$ 3k» y «MX$ 11,600.00». La prueba de moneda (`leerDinero`) está en verde. `{moneda}` en «Asking rent (MXN / month)» es el código ISO en un rótulo, no un importe.
- **`desktop.ini`.** El diff no añade ninguno. Los 14 que hay en el árbol ya estaban en `2e622add`.
- **Archivos prohibidos.** El diff no toca `middleware.ts`, `nav.ts`, `db/schema.sql`, migraciones, `app/api`, `aislamiento.e2e.test.ts`, `servidor-e2e.ts`, `dinero.ts` ni `idiomas.ts`. `IDIOMA_INGLES` solo aparece como `process.env.IDIOMA_INGLES = '1'` dentro de las dos pruebas nuevas, como en los lotes anteriores.
- **Commits.** Los cinco llevan los dos trailers. La bóveda va en un commit de documentación aparte (`f3e41c40`), no en el mismo commit del código, como pide AGENTES regla 4. Es lo mismo que hicieron los lotes anteriores y no lo cuento como hallazgo.

## 5 · Pruebas y mutantes

```
cd apps/web && npm run typecheck   → tsc --noEmit, salida 0
cd apps/web && npm test            → Test Files 339 passed (339) · Tests 5295 passed (5295) · 28.89 s
```

| # | mutante | pruebas | resultado |
|---|---|---|---|
| M1 | `es` cambiado: `clientes.titulo` 'Clientes' → 'Clientes.' | textos/clientes + pantallas-clientes | **muere** (1 roja: la instantánea) |
| M2 | `en` en español: `mov.baja` 'Retire' → 'Dar de baja' | textos/operaciones + pantallas-operaciones | **muere** (3) |
| M3 | el llamador sin idioma: `faltantesParaRevision(p, idioma)` → `(p)` en `Captacion.tsx` | pantallas-clientes + textos/clientes | **muere** (2) |
| M4a | clave de toast: almacén `mover.registrado` → `alta.registrado` | todo `lib/i18n` (1168) | **SOBREVIVE** |
| M4b | clave de toast: comisiones `no-se-pudo-asignar` → `no-se-pudo-crear` | todo `lib/i18n` | **muere** (1) |
| M4c | clave de toast: imprenta `no-avanzar` → `no-crear` | todo `lib/i18n` | **SOBREVIVE** |
| M5a | `ClientesBadge` sin idioma (rótulo «clientes» fijo) | pantallas-operaciones + pantallas-comercial | **muere** (2) |
| M5b | `CalendarioDisponibilidad`: mes siempre de `MESES` | ídem | **muere** (1) |
| M5c | `SlotsBadge`: `title` fijo en español | ídem | **muere** (2) |
| M6 | Disponibilidad: `etiquetaPeriodo` devuelve siempre la etiqueta española | pantallas-operaciones | **muere** (2) |

Restauré todo con `git checkout --`. `git status --short` sale vacío salvo este informe.

## 6 · Decisiones de glosario para el dueño

1. **Cómo se dice en inglés «dar de baja» un artículo del almacén.** El orquestador fijó «Deactivate / Deactivated» para la baja lógica en catálogos, Campañas y compartidos. En el almacén «dar de baja» **sí** significa otra cosa:
   - Es un estado **terminal** de un objeto físico: `MOVS.BAJA = []` (`almacen/page.tsx:80`), así que no hay movimiento posible después.
   - No es un interruptor de oferta comercial que se pueda reactivar.
   - Para una camioneta o una pantalla en bodega, «Deactivated» se lee como apagada, no como retirada del inventario.

   Por eso diferenciarlo está justificado. Pero «Retire» no está alineado con nada: el propio lote pinta «Decommissioned» para el mismo estado, igual que el sitio dado de baja en Comercial. **Propuesta:** «Decommission / {n} decommissioned / Decommissioned», con «Dar de baja» en `DISTINTOS_A_PROPOSITO` («la baja lógica de una franja, temporada o paquete (“Deactivate”) frente a la baja definitiva de un artículo físico del almacén (“Decommission”), como el sitio»). La alternativa es unificar en «Deactivate» y aceptar que se lea raro en el almacén.
2. **Origen de la confusión, para corregirlo en catálogos.** El encabezado de `catalogos.ts:23`, tal como está commiteado en `integra/ingles`, sigue diciendo «dar de baja / dada de baja → retire / Retired». Los valores son «Deactivate / Deactivated» desde la segunda vuelta. El traductor de este lote se fió del comentario. Hay que corregir también `operaciones.ts:19-21` y `idiomas-es-en.md:1099`, que copian la afirmación.
3. **«Administración → Configuración»** en texto de ayuda. Conviene fijar un único nombre en el glosario cuando aterrice el lote de administración, que en su borrador usa «Settings → Business settings», y que los lotes ya integrados lo adopten.
4. **Nombre del periodo mensual** en Disponibilidad: «Mar 2026» o «Mar ’26». Es estilo, pero lo verá cualquier usuario de inglés en la cabecera de la rejilla.

---

## Segunda pasada (2026-11-02)

Diff revisado: `git diff f3e41c40..HEAD`. Son dos commits:

- `61ead612`: este informe, commiteado por el traductor.
- `aa592555`: las correcciones.

Esta sección se añade sin commitear.

### Veredicto: **ÁMBAR**. Solo queda el arnés.

**Los 4 hallazgos medios y los 10 bajos de la tabla del §1 quedaron resueltos**, con sentido en su contexto. Pero aparece un hallazgo **medio nuevo**: el arnés de forzado no es estable (§S2). Es una corrección de la prueba, no del producto. Con ella, el lote pasa a VERDE.

### S1 · Los hallazgos, uno por uno

| hallazgo | ahora | estado |
|---|---|---|
| «Dar de baja» → «Retire» rompía la costura | `mov.baja` = «Decommission», y «Dar de baja» en `DISTINTOS_A_PROPOSITO` con su motivo (`costura.test.ts:43`). Repetí la simulación con catálogos de `integra/ingles`: **cero divergencias sin declarar** (las 7 que quedan están declaradas) | resuelto |
| Tres nombres para la baja | «Decommission» · «1 decommissioned» · «none decommissioned» · «Decommissioned». Coincide con la decisión del orquestador | resuelto |
| Toasts de almacén e imprenta sin prueba | Nuevo `describe` en `textos/operaciones.test.ts:106-126`. **M4a, M4c y M4d mueren** (§S4) | resuelto |
| «Mar 26» | `year: 'numeric'` (`disponibilidad/page.tsx:47`). En el render sale «in Mar 2026» y «>Mar 2026<» | resuelto |
| «Settings → Configuration» | «Settings → Business settings» (`clientes.ts:338`), como decidió el orquestador | resuelto |
| Los 9 bajos restantes | «No clients match», «Log progress / Save progress / Progress could not be logged», «Free static screens», «· not blocking», «Only with availability», «client openings left», «already on this screen», «Landowner», «{n}d overdue». Las aserciones inglesas de las pruebas de pantallas se pusieron al día, y en el HTML se leen bien | resuelto |
| Documentación | `operaciones.ts:16-22` y la bóveda corregidos (ahora dicen «Siete españoles nuevos» y enumeran siete). El comentario viejo de `pantallas-comercial.test.ts:45` también está corregido | resuelto |
| `catalogos.ts:23` («retire / Retired») | No está en esta rama, que sale de `2e622add`, sin catálogos. **Sigue pendiente en `integra/ingles`** | pendiente, fuera de esta rama |

### S2 · Estabilidad del arnés: **hallazgo MEDIO, causa localizada**

**En condiciones normales es estable.** Corrí `pantallas-clientes` y `pantallas-operaciones` **8 veces seguidas** y salió `231 passed (231)` en las 8.

**Bajo carga falla, y la causa es una fuga entre pruebas cuando una agota su tiempo.**

1. La cola de forzado es una sola, compartida por todo el archivo: `forzado.cola` en `pantallas-clientes.test.ts:36`. `beforeEach` la vacía (`:96`).
2. Cada estado **mete sus `forzar(...)` antes** del `await import(...)` de la página (por ejemplo `:362-364`, con `captacionPagina` en `:176`).
3. Si un estado agota el `testTimeout` mientras espera ese import, vitest pasa al siguiente. **La función del estado anterior sigue viva**: cuando el import resuelve, rinde.
4. Ese render lee `forzado.cola[0]` (`:42-45`), que ya es la cola del estado **siguiente**, y **se come sus entradas**. El estado siguiente rinde sin forzar, por ejemplo en la pestaña «curso» por omisión, y falla **una aserción**, no un timeout.

El primer import de Captación es lento: arrastra `ComercialOpex` entero (`Captacion.tsx:15`). Por eso los fallos se concentran en captación, que es justo lo que vio el traductor («pestaña equivocada», en español).

**Reproducido de forma determinista** acortando el tiempo:

```
npx vitest run lib/i18n/pantallas-clientes.test.ts --testTimeout=100
→ 1 «Test timed out» (captacion · por aprobar) y, justo detrás,
  AssertionError en ESPANOL en «captacion · en curso vacia»:
  falta «No hay prospectos en curso. Da de alta el primero con «Nuevo prospecto».»
```

`pantallas-operaciones.test.ts` tiene el mismo patrón: la cola en `:36`, el reinicio en `:88`, y los `forzar` y `datos.* =` antes del `await import`. Con `--testTimeout=100` dio «2 failed» con un solo timeout en 2 de 3 corridas.

**La corrección que propongo** (en la prueba, no en el producto). Cualquiera de las dos basta, y conviene aplicar la primera en los dos archivos:

- Resolver el componente **antes** de forzar: `const C = await captacionPagina(); forzar(...); return pintar(idioma, createElement(C))`. `renderToStaticMarkup` es síncrono, así que entre forzar y rendir ya no puede entrar nadie.
- O importar las páginas una sola vez en un `beforeAll`, y marcar cada cola con un número de generación que el `useState` simulado compruebe.

### S3 · Español intacto (otra vez, mecánico)

Volví a volcar el HTML español de los 37 estados con HEAD (`I18N_VOLCAR`) y lo comparé con el volcado de la primera pasada, hecho con los componentes de `2e622add`. `diff -rq` salió vacío: **25/25 y 12/12 idénticos**. El único componente que cambió es `disponibilidad/page.tsx`, y solo en la rama inglesa de `etiquetaPeriodo`; el `if (idioma === 'es') return p.label` sigue igual.

### S4 · Pruebas y mutantes

Las corrí con la máquina cargada (otros agentes en paralelo), con **`--testTimeout=60000`**:

```
cd apps/web && npm run typecheck                  → tsc --noEmit, sin errores
cd apps/web && npm test -- --testTimeout=60000    → Test Files 339 passed (339) · Tests 5297 passed (5297) · 80.17 s
```

| # | mutante | resultado |
|---|---|---|
| M4a | almacén: toast de mover con la clave de registrar | **muere** (1 de 1170) |
| M4c | imprenta: `no-avanzar` → `no-crear` | **muere** (1) |
| M4d | imprenta: `no-crear` → `no-avanzar` | **muere** (1) |
| M7 | Disponibilidad: el mes vuelve a `'2-digit'` | **muere** (1) |
| M8 | `mov.baja` vuelve a «Retire» | **muere** (1: la instantánea) |

Restauré todo con `git checkout --`.

### S5 · Reglas

- No hay dinero en los diccionarios.
- El diff no toca ningún archivo prohibido y no añade ningún `desktop.ini`.
- No usé `git stash`.
- El árbol queda limpio salvo esta sección del informe.

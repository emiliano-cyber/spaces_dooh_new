# Validación · lote de inglés «catálogos de precio»

- **Rama:** `feat/ingles-operaciones` (worktree `.claude/worktrees/ingles-operaciones`), commit `5aa3b787` sobre `integra/ingles` (`ec427a66`), `git diff ec427a66..HEAD`: 20 archivos.
- **Alcance:** paquetes cerrados, franjas y temporadas (con el horario de transmisión y el cuadro de tarifas por franja de la ficha de pantalla) y descuentos por volumen.
- **Fecha:** 2026-11-02. **Validador:** agente independiente. No corrige código. Este informe es lo único que escribe, y no está commiteado.

## Veredicto: **ÁMBAR**. Se puede integrar con las correcciones de abajo

El español está intacto, y lo medí de forma mecánica de tres maneras: el render de los 15 estados, los fragmentos del diccionario contra el código de `ec427a66` y 16 000 comparaciones de los motivos de rechazo. El typecheck está limpio, hay **4684 unitarias en verde** y no se tocó ningún archivo prohibido. Murieron los 12 mutantes que probé. El inglés se lee bien en casi todo el lote, y los términos nuevos (*bundle share*, *flat scale*, *tier*/*step*, *rate grid*, *airs*, *retire*) son correctos para DOOH B2B.

Hay **4 hallazgos de severidad media**. Ninguno toca el español, y el inglés sigue apagado:

1. **Dos textos en español quedan a la vista en la pantalla inglesa** del cuadro de tarifas por franja, y ninguno está declarado:
   - el `title` de error de `CampoCifra`: «Escribe solo cifras…», que sale de `lib/captura-cifra.ts:45`;
   - la unidad `programatico` en el selector de unidad.
2. **«Retired» choca con «(deactivated)».** Campañas llama así a la MISMA franja dada de baja (`campanas.horario.dada-de-baja`). La prueba de costura no lo ve, porque los dos españoles no son idénticos.
3. **«{monto} is not billed»** describe mal el ahorro frente a la lista: parece que esa cantidad se queda sin facturar.

---

## 1 · Sentido en contexto

Las 193 claves las leí en su uso real (diff de los 8 componentes y páginas) y en el HTML inglés de los 15 estados. Para eso volqué el inglés con una copia temporal de `pantallas-catalogos.test.ts` y luego la borré. Las líneas son de `apps/web/lib/i18n/textos/catalogos.ts` (valor `en`).

| clave | archivo:línea | inglés actual | problema | propuesto | sev. |
|---|---|---|---|---|---|
| (sin clave) `MSJ_FORMA` de `lib/captura-cifra.ts` | `captura-cifra.ts:45` · lo pinta `CampoCifra` en `RejillaDialog.tsx` | `title="Escribe solo cifras: la coma separa miles y el punto, decimales. Ejemplo: 212,500.50"` | Es español visible en la pantalla inglesa: sale en el render del estado 10, con la tarifa inválida. La prueba no lo caza, porque el barrido solo mira los diccionarios de catálogos y compartidos. No está declarado ni en la bóveda ni en la cabecera de la prueba. Es un módulo compartido, así que afecta a todos los lotes que usan `CampoCifra`. | Pasarle `idioma` a `captura-cifra` (como en compartidos) o, como mínimo, declararlo en «Sigue en español». | media |
| (sin clave) unidad `programatico` | `RejillaDialog.tsx:66` y `:279` (`unidadVisible`) | `programatico` en el `<select>` de la unidad nueva | `programatico` sí es una unidad de venta (`lib/modalidades.ts:32`), pero no está en `UNIDAD_LABEL`, así que `etiquetaUnidad` devuelve el dato crudo. La bóveda lo declara como «unidad que no está en `UNIDADES` (es el dato)», y eso solo cuadra para una unidad desconocida, no para una opción del catálogo. Ya existe `comercial.comun.programatico` → «Programmatic». | Darle etiqueta inglesa, por ejemplo con `compartidos.unidad.programatico` = «Programmatic». En español sigue saliendo el dato. | media |
| `catalogos.comun.dada-de-baja` | textos:286 · `GestionRejilla.tsx` (franjas y temporadas) | `Retired` | La misma franja dada de baja se llama ` (deactivated)` en Campañas (`campanas.horario.dada-de-baja`, `FranjaProgramadaCampana.tsx:117`) y en compartidos (`compartidos.asignacion.baja`). El término *retire* es bueno, pero hoy la app dice dos cosas distintas para el mismo estado. | Unificar. Por coherencia con el lote: `campanas.horario.dada-de-baja` → ` (retired)`. Decisión del dueño (ver abajo). | media |
| `catalogos.paquetes.resumen.deja-de-cobrar` | textos:357 · `GestionPaquetes.tsx:393` | `{monto} is not billed` | En el render sale «List MX$ 100,000 · Bundle MX$ 90,000 · **MX$ 10,000 is not billed**». Se lee como una cantidad que se olvida facturar, cuando lo que dice es que el paquete sale 10,000 por debajo de la lista. | `{monto} below list` | media |
| `catalogos.paquetes.resumen.por-encima` | textos:358 | `{monto} is billed ABOVE the list` | Es la pareja del anterior. «the list» suena forzado. | `{monto} ABOVE list` | baja |
| `catalogos.paquetes.de-lista` | textos:354 · `GestionPaquetes.tsx:371` | `{monto} list` | Sale «MX$ 60,000 list» al lado de cada pantalla. Le falta la preposición. | `{monto} at list` (o `list {monto}`) | baja |
| `catalogos.paquetes.lista.subtitulo` | textos:315 | `Split pro rata to the list rate` | «pro rata to» no es idiomático. Lo natural es «in proportion to» o «pro rata by». | `Split pro rata by list rate` | baja |
| `catalogos.paquetes.lista.explicacion` + `.prorrata` | textos:316-318 | `split among the screens pro rata to their list rate` | Es lo mismo que en el anterior. | `… in proportion to their list rate` | baja |
| `catalogos.programacion.sin-permiso` | textos:411 · `ProgramacionPorFranja.tsx:124` | `… Here you see how it stands.` | Es un calco de «Aquí ves cómo está». | `… You can view the current schedule here.` | baja |
| `catalogos.programacion.explicacion` | textos:408 | `… what was sold is already in the campaign since the proposal.` | Es un calco. «since» se lee como tiempo y no como origen. | `… what was sold already came into the campaign from the proposal.` | baja |
| `catalogos.programacion.boton` | textos:423 · `ProgramacionPorFranja.tsx:231` | `Schedule {n} in {franja}` | Con 0 marcadas, `n` es `''` y sale «Schedule  in Tarde», con doble espacio. El español ya lo hacía («Programar  en Tarde») y sigue igual. | Solo en inglés: claves `.ninguna/.uno/.otros`, o `Schedule in {franja}` cuando `n` está vacío. | baja |
| `catalogos.programacion.quitar.title` | textos:418 | `Remove from this daypart (what was sold is not touched)` | Suena forzado. | `Remove from this daypart (doesn’t affect what was sold)` | baja |
| `catalogos.volumen.descripcion` | textos:448 | `What discount someone buying a lot gets. …` | Es una frase sin verbo principal y se lee torpe. | `The discount a high-volume buyer gets. …` | baja |
| `catalogos.paquetes.col.codigos` / `.admite-codigo` | textos:323 / 334 | `Codes?` · `Takes codes` | Un «code» suelto es ambiguo. El glosario dice «negotiation code». En una columna estrecha se acepta, pero queda poco claro. | `Negotiation code?` · `Code allowed` | baja |
| `catalogos.paquetes.desactivado` | textos:328 | `Deactivated` | Funciona como estado («Active / Deactivated»). Lo habitual es «Inactive». | `Inactive` (opcional) | baja |
| contracciones | varias (`can’t`, `doesn’t` frente a `does not`, `cannot`) | — | El lote mezcla formas contraídas y completas, a veces dentro de la misma pantalla. No afecta al sentido. | Elegir una forma. Los otros lotes contraen en los textos de ayuda. | baja |

**Lo que revisé y está bien** (para no repetirlo):

- **Términos del traductor:**
  - *fixed price* (columna), *bundle share*, *split*: bien.
  - *retire / Retired* (es baja lógica, y «delete» prometería un borrado que no ocurre): bien, salvo el choque con Campañas.
  - *tier* / *Step {n}* / *Flat scale (volume)*: la pareja tier/step es correcta. El escalón es la posición dentro de la escala, como «Escalón 1».
  - *rate grid*, *schedule*, *airs*, *Broadcast schedule* (coincide con Campañas), *list rate*, *rate card* para «tarifario».
- **Coherencia con el resto del producto:**
  - daypart, season, bundle y negotiation code coinciden con el menú y con los lotes previos;
  - los roles («the sales manager, the sales director and management») son idénticos a `campanas.horario.sin-permiso`;
  - «Rates by daypart and season» y «Rates per daypart» (comercial) son distintos en español, así que no chocan.
- **Plurales:** pantallas, elegidas, campañas, marcadas y tramos van con `.uno/.otros`. Los vi con n = 0, 1 y 2 en el render: «1 screen», «2 screens», «0 campaigns», «1 tier», «(1 selected)». Funcionan.
- **Huecos:**
  - son los mismos en `es` y `en` en las 193 claves (lo comprueba la guardia del lote);
  - `{concretas}` pasa a inicio de frase («**Specific** dates») con mayúscula, que es correcto;
  - el bold de `{negrita}` en «a bundle **does not take a volume discount** (…), nor a negotiation code» es gramatical.
- **Los 27 motivos de rechazo**, leídos uno por uno, son correctos y naturales. Comillas curvas alrededor de `{nombre}`, «HH:MM in 24-hour format», «YYYY-MM-DD», «rate card», sin espacio antes de `%`.
- **Fechas:** «Nov 13, 2026» en inglés con `formatFecha(iso, idioma)`.

## 2 · Español intacto: VERIFICADO (mecánicamente)

**a) Render de los 15 estados, byte a byte, contra `ec427a66`.**

1. Volqué el HTML español de HEAD con `I18N_VOLCAR`.
2. Sobrescribí en el árbol los **11** archivos del lote (8 componentes y páginas, y `lib/paquete.ts`, `lib/rejilla.ts` y `lib/volumen.ts`) con `git show ec427a66:<ruta>`.
3. Volví a volcar con la MISMA prueba (mismos mocks y mismos `useState` forzados): con el código viejo, 15 pruebas en español en verde y 17 en inglés en rojo, como se esperaba.
4. Restauré con `git checkout -- <ruta>`.

Resultado: `diff -r` vacío y `cmp -s` **15/15 IGUAL** (de 476 a 12 374 bytes por estado).

**b) Fragmentos del diccionario contra el código de `ec427a66`.**

Para cada valor `es`, cada trozo literal entre huecos se buscó en el fuente viejo de los 11 archivos, con los saltos de línea de JSX normalizados a un espacio:

- **190 de 193** aparecen literales.
- Las 3 restantes (`paquetes.elegidas.otros`, `programacion.marcadas.uno/.otros`) se armaban por concatenación (`elegida{…'s'}`, `` marcada${…} ``). Las tres salen en el render de (a): «>0</span> elegidas», «(1 marcada)» y «(2 marcadas)». Son idénticas.

Esto cubre también los toasts, los `mensajeSiFalla` y los `catch`, que no se rinden.

**c) Motivos de rechazo: versión vieja contra nueva.**

Copié las versiones de `ec427a66` de `paquete.ts`, `rejilla.ts` y `volumen.ts` a una carpeta temporal y las comparé con las nuevas sobre **16 000 entradas** generadas: 4000 por función, con semilla fija. Las entradas mezclaban nombres vacíos, de 120 y 121 caracteres, con `{n}` y con comillas; cantidades `0`, `2.5`, `'abc'`, `null` y `{}`; horas y fechas inválidas, y 0 a 3 «otras» que se solapan.

- `viejo(x) === nuevo(x) === nuevo(x, 'es')`: **0 divergencias**, sobre 14 181 entradas con motivo y 41 formas distintas.
- En inglés:
  - **27 formas**;
  - es nulo justo cuando el español es nulo;
  - nunca coincide con el español;
  - no lleva acentos ni huecos sin rellenar.

**d) El servidor sigue recibiendo el español.**

- `paquetes-controller.ts:76`, `rejilla-controller.ts:90/118` y `volumen-controller.ts:74` llaman sin idioma, y el `'es'` por omisión devuelve el literal (c).
- `git diff` no toca `lib/server/` ni `app/api/`.
- `catalogos.fuentes.test.ts` lo fija además con 4 aserciones.

## 3 · Nada en español en el inglés

**En el diccionario** no queda nada en español:

- ninguna clave tiene el mismo valor en los dos idiomas (`IGUALES` está vacío);
- no hay acentos;
- no hay `%` con espacio.

**En el HTML inglés de los 15 estados** solo queda lo declarado:

- los datos de prueba;
- el aviso del servidor (`a.texto`);
- la unidad desconocida `trimestral`, que es un dato.

**Y dos cosas NO declaradas:** el `title` de `CampoCifra` y la opción `programatico` (ver §1, media).

## 4 · Reglas

| regla | resultado | evidencia |
|---|---|---|
| Nada de dinero en el diccionario | **cumple** | «180,000» y «15,000.50» entran por `{ejemplo}`. Las cifras que quedan («50 spots», «10%», «64%», «20%») son cantidades y porcentajes, no dinero, igual que en `propuestas.codigo.ayuda`. |
| `formatMonto` recibe el idioma | **cumple** | `montoEntero(n, idioma)` en las 9 llamadas de `GestionPaquetes`. En el render inglés sale «MX$ 60,000». El mutante M6 lo confirma. |
| Archivos prohibidos | **no se tocaron** | `git diff --name-only` sin `middleware`, `nav.ts`, `schema.sql`, `migrations`, `app/api`, `aislamiento`, `servidor-e2e`, `dinero.ts` ni `idiomas.ts`. Comentarios conservados. |
| `desktop.ini` | **ninguno** | `git show --stat 5aa3b787 \| grep -ci desktop` → 0 |
| `costura.test.ts` incluye `catalogos` | **sí** | `costura.test.ts:8` y `:29`. Pasa en verde. |

## 5 · Pruebas

```
cd apps/web && npm run typecheck   →  tsc --noEmit, sin salida (limpio)
cd apps/web && npm test            →  Test Files 337 passed (337) · Tests 4684 passed (4684)
```

Son 4610 de la base más 74 del lote: 8 del diccionario, 34 de las fuentes y 32 de las pantallas.

**Mutantes** contra las cuatro pruebas del lote y `costura.test.ts` (81 pruebas). Cada uno se restauró con `git checkout`.

| # | mutante | resultado |
|---|---|---|
| M1 | `es` cambiado: `catalogos.paquetes.activo` «Activo» → «Activa» | **muere** (2) |
| M2 | `en` en español: `catalogos.volumen.anadir` → «Añadir tramo» | **muere** (4) |
| M3 | sin idioma en el motivo, en el llamador (`GestionVolumen`: `tramos, idioma)` → `tramos)`) | **muere** (1) |
| M3b | lo mismo en `GestionPaquetes` (quitar el `idioma,`) | **muere** (1) |
| M4 | clave del toast: `toast.success(t('catalogos.tarifas.guardadas'))` → `…no-guardar` | **muere** (1) |
| M5 | plural invertido (`pantallas.uno` ↔ `.otros` en el llamador) | **muere** (2) |
| M6 | `formatMonto` sin idioma en `montoEntero` | **muere** (1) |
| M7 | clave cruzada en `lib/rejilla.ts` (misma-hora → hora) | **muere** (1) |
| M8 | la unidad cruda en `RejillaDialog` (sin `etiquetaUnidad`) | **muere** (2) |
| M9 | `catch` cruzado en paquetes (no-cambiar → no-guardar) | **muere** (1) |
| M10 | `mensajeSiFalla` de dar de baja → `comun.no-guardar` | **muere** (1) |
| M11 | `formatFecha` sin idioma en las temporadas | **muere** (1) |

**12 de 12 mueren.** Una observación: un cambio en el `en` de un plural singular, por ejemplo ` · {n} tier` → ` · {n} tiers`, solo lo atrapa la instantánea, porque « · 1 tier» es subcadena de « · 1 tiers». Es una debilidad menor de la lista `ingles`, no del lote.

**Árbol:** queda limpio salvo este informe. Los volcados y los scripts están en el scratchpad y la carpeta temporal `lib/__valcat` está borrada. Los `desktop.ini` sin seguimiento ya estaban.

## 6 · Correcciones pedidas (para pasar a VERDE)

1. **Media:**
   - traducir el `MSJ_FORMA` de `captura-cifra` o declararlo;
   - darle etiqueta inglesa a `programatico`;
   - unificar *retired* / *deactivated* para la franja dada de baja;
   - `resumen.deja-de-cobrar` → «{monto} below list».
2. **Baja (recomendadas):** el resto de la tabla del §1.
3. **Bóveda:**
   - añadir a «Sigue en español» lo que quede de (1);
   - añadir *broadcast schedule* a la lista de términos nuevos, porque la cabecera de `catalogos.ts` lo nombra y la bóveda no.

## 7 · Decisiones de glosario para el dueño

- **retire / Retired frente a deactivate / Deactivated.**
  - El lote usa *Retired* para franjas y temporadas dadas de baja y *Deactivated* para paquetes desactivados.
  - Campañas y compartidos usan *(deactivated)* para lo mismo que aquí es *Retired*.
  - Hay que elegir: (a) *retired* para la baja lógica de catálogo y *deactivated*/*inactive* para el interruptor de paquete, alineando Campañas; o (b) *deactivated* en todas partes.
- **«pesos» en un texto de producto con moneda por instancia (ADR 0048).**
  - Lo dicen «Price for the set (whole pesos)», «adds up to the peso», «to the peso» y el motivo «whole number of pesos».
  - En una instancia USD es falso, **en los dos idiomas** (el español ya decía «pesos enteros» y «al peso»).
  - Propuesta: redacción neutra, como «(whole amounts, no cents)» y «adds up exactly». En español no se puede tocar en este lote (regla 1), así que es una tarea aparte.
- **«Codes?» / «Takes codes»:** abreviar *negotiation code* en una columna estrecha, o escribirlo entero.
- **La unidad en el cuadro de tarifas.** En español se pinta el dato (`spot`, `mensual`) y en inglés la etiqueta larga (*CPS · cost per play*, *Monthly*). Es coherente con Volumen, pero las dos lenguas enseñan cosas distintas. ¿Se acepta?

# Validación independiente · el símbolo de la moneda en las pantallas en inglés

- **Rama:** `feat/moneda-simbolo-ingles`, dos commits sobre `integra/ingles` (`ec427a66`):
  `1d36ccaa` (el cambio) y `bc5b2533` (el `eslint-disable`).
- **Validador:** agente independiente, 2026-11-02. No he corregido nada. Este archivo no está commiteado.
- **Decisión que se valida (dueño, 02/11):** en inglés, MXN se escribe `MX$` y USD `$`; el español
  no cambia (MXN `$`, USD `US$`); correos, CSV, PDF del contrato y cantidad con letra no cambian.

## Veredicto: **VERDE**

El código hace lo que decidió el dueño y no toca nada más. Todo lo de abajo lo he medido yo
en este worktree. No hay hallazgos que bloqueen. Dejo tres observaciones de severidad baja o
informativa (§9).

---

## 1 · El inglés: cada importe lleva el símbolo correcto

**Estático.** He buscado todas las llamadas a `formatMonto`, `formatMontoCorto` y `pesos` (alias de
`formatMonto` en `ComercialOpex.tsx:103`) que **no** pasan `idioma`, en los archivos que usan el
idioma. Solo salen tres sitios, y ninguno está en una pantalla traducida:

- `lib/data/derive.ts:824,825,854,855,987`: los avisos del Dashboard, que se escriben en español.
  Inicio no está traducido.
- Los comentarios de `lib/i18n/dinero.ts:33`, `lib/i18n/moneda-cliente.tsx:13` y
  `lib/i18n/simbolo-en-pantalla.ts:10`.

En los directorios de propuestas, campañas, finanzas, comercial, comercial-opex y el documento
imprimible, y en `lib/periodos.ts`, no hay ningún `$` escrito a mano delante de una cifra, ni
ningún `currency:`, ni ningún `simboloMoneda()` suelto. Lo he comprobado con grep de `>\s*\$`,
`'$ `, `$${` y `currency`. Los `toLocaleString('es-MX')` que quedan son cantidades sin moneda
(spots, m², pases).

`resumenContratacion` (`lib/periodos.ts:141`) y `resumenReserva` (`lib/periodos.ts:166`) pasan ya
`idioma` al importe.

**Dinámico.** Las nuevas `describe` de `pantallas-propuestas`, `pantallas-comercial` y
`pantallas-campanas-finanzas` pintan cada estado con las dos monedas y en los dos idiomas. Las
tres están en verde. Sin el cambio fallan: con los 18 archivos de pantalla de `ec427a66` metidos
por `git show` en el árbol, salieron 31 + 24 + 34 = **89** pruebas en rojo. De ellas, 88 son de
dinero y 1 es la expectativa de `pantallas-propuestas` que afirmaba `$` en inglés. Coincide con
lo que declaran el commit y la bóveda («88 + 2»; la segunda de las 2 está en
`compartidos-idioma.test.ts`, que no corrí contra el código viejo).

## 2 · El español queda idéntico

**HTML.** He volcado el HTML en español de todos los estados de las cuatro pruebas de pantallas
(`I18N_VOLCAR` / `VOLCAR_HTML`): 23 de propuestas, 24 de comercial, 56 de campañas y finanzas,
y 6 de compartidos, **109 en total**. Lo hice dos veces: con HEAD y con los 18 archivos de
componentes y páginas, incluido `lib/periodos.ts`, sustituidos por su versión de `ec427a66`
(`git show ec427a66:<ruta> > <ruta>`, y luego restaurados con `git checkout`).

`diff -r` de las cuatro carpetas: **IDÉNTICO** en las cuatro. Los volcados contienen 355 importes
(`$ <cifra>`), así que no se está comparando HTML vacío.

**Funciones.** `lib/data/derive.ts` y `lib/i18n/dinero.ts` **no cambian** en este diff
(`git diff --quiet ec427a66..HEAD`). Aun así escribí una prueba temporal, que ya he borrado. Con
3019 importes, entre bordes (0, −0, 0.005, 999 999, 4 999 999, ±1e9, NaN, Infinity) y
pseudoaleatorios, y en **las dos monedas**, comprueba:

- `formatMonto(n) === formatMonto(n, 'es')` y lo mismo con `formatMontoCorto`;
- `resumenContratacion` y `resumenReserva` de HEAD contra la copia de `ec427a66`, en 6 unidades,
  sin idioma y con `'es'`.

Son 78 494 comparaciones por moneda y **0 diferencias**. En la misma prueba también verifiqué
estos valores:

| Moneda | `formatearDinero(1234.5, 'en')` | `formatearDinero(1234.5, 'es')` | `formatMonto(-1234.5, 'en')` |
|---|---|---|---|
| MXN | `MX$1,234.50` | `$1,234.50` | `(MX$ 1,234.50)` |
| USD | `$1,234.50` | `US$1,234.50` | `($ 1,234.50)` |

## 3 · Lo que no debe cambiar, no cambia

`git diff --quiet ec427a66..HEAD` sale limpio en todo esto:

- `app/api/`;
- `lib/server/` (correos, repos, intérprete de recibos);
- `lib/contrato-documento.ts` (la cantidad con letra, `numeroALetras`, ligada al hash de las firmas);
- `lib/tarifa-calculada.ts`;
- `lib/contratos-export.ts` y `lib/inventario-export.ts` (los CSV);
- `components/demo/reportes/`.

Ninguno de esos archivos recibe idioma en sus llamadas de dinero. Las bitácoras siguen así:

- `app/api/cobranzas/[id]/pagar/route.ts:25`, `app/api/ot/[id]/costo/route.ts:77`,
  `app/api/propuestas/[id]/paquete/route.ts:54`, `app/api/propuestas/[id]/route.ts:101` y
  `lib/tarifa-calculada.ts:175` siguen usando `simboloMoneda()` sin idioma;
- `app/api/energia/consumos/route.ts:62` sigue usando `formatMonto(...)` sin idioma.

## 4 · Las guardias de `dinero.test.ts`

`lib/i18n/dinero.test.ts` **no cambia** en el diff, y está en verde dentro de la suite. Siguen
estas cuatro:

- **Una moneda por instancia:** `LA MONEDA DE LA INSTANCIA · una sola` (`:51`), con la de dos
  copias del módulo.
- **La moneda nunca la decide el idioma:** `LA PRUEBA NEGATIVA` (`:215`) y GUARDIA 1, «ningún
  `currency:` se decide con un ternario sobre el idioma» (`:421`).
- **Ningún diccionario lleva dinero:** GUARDIA 2 (`:434`).
- **Ninguna pantalla deja elegir moneda:** GUARDIA 3 (`:451`).

El diseño mantiene la intención. `formatMonto(n, idioma)` (`derive.ts:1435`) solo usa el idioma
para elegir **cómo se escribe** el símbolo (`SIMBOLO[idioma][monedaInstancia()]`). La moneda
sigue saliendo de `monedaInstancia()`, y la cifra se escribe siempre con `es-MX`. Ninguna de las
llamadas nuevas pasa otra cosa que el `idioma` de `useIdioma()` o de `idiomaDeLaPeticion()`.

## 5 · El segundo commit (`bc5b2533`, `eslint-disable` en `pantallas-compartidos.test.ts:132`)

- **El problema es real y viene de antes:** la línea ya existía en `ec427a66`. Al quitar el
  `disable` de una copia temporal, `npx eslint` da
  `132:29 error Do not pass children as props … react/no-children-prop`. Con el `disable`,
  `eslint` sale limpio.
- **Lo que afirma el autor es cierto:** la forma «limpia» de los otros archivos del repo (los
  hijos como tercer argumento de `createElement`, como en `pantallas.test.ts:74-84`) **no tipa**
  con `Campo`, porque su tipo exige `children` en las props (`Campo.tsx:46`). Lo medí con
  `tsc --noEmit`: `TS2769 No overload matches this call`.
- **Sí hay una forma que tipa y pasa el linter sin suprimir nada:** armar primero las props con
  `ComponentProps<typeof Campo>` (con `children` dentro) y pasarlas como variable:
  `createElement(Campo, props)`. Lo comprobé y pasan `tsc` y `eslint`. Pero no es más limpia de
  verdad: solo esquiva una regla que mira el objeto literal. Las otras dos opciones serían
  convertir la prueba a `.tsx` con JSX o hacer `children` opcional en `Campo`, que cambia un
  componente para contentar a una prueba.
- **Veredicto del punto:** el `disable` de una línea, con su comentario del porqué, es
  **aceptable** y honesto.
- **Detalle menor:** el tipo del commit es `feat(i18n)` y debería ser `fix(...)` o `test(...)`.
  No arregla nada de la funcionalidad, solo devuelve el build a verde. No lo considero un defecto.
- `next build` no lo he corrido, por la restricción de memoria, así que **no afirmo** que
  compile. Lo que sí he medido es que `eslint` ya no protesta en ese archivo.

## 6 · Mutantes

Todos se restauraron con `git checkout`. Al final, `git status` queda limpio salvo los
`desktop.ini` sin seguimiento de siempre.

**Del lector `leerDinero`** (`lib/i18n/simbolo-en-pantalla.ts`), contra `simbolo-en-pantalla.test.ts`:

| Mutante | Resultado |
|---|---|
| L1 · la comparación `simbolo !== esperado` nunca se cumple | **MUERE** (3 de 4) |
| L2 · tabla `en.MXN = '$'` | **MUERE** (1) |
| L3 · regex sin el prefijo de letras (`()` en vez de `([A-Za-z]{0,3})`) | **MUERE** (3) |
| L4 · lookahead sin espacio (`(?=\d)` en vez de `(?=\s*\d)`) | **MUERE** (3) |

**De las pantallas**: en cada caso quité `idioma` de un `formatMonto` o `formatMontoCorto` y corrí
la prueba de pantallas de su lote.

| Mutante | Módulo | Resultado |
|---|---|---|
| P1 · `propuestas/[id]/page.tsx`, bruto de lista | propuestas (ficha) | **MUERE** (≥6) |
| P2 · `propuestas/page.tsx`, total de la tarjeta | propuestas (lista) | **MUERE** (≥6) |
| P3 · `TableroPropuestas.tsx`, venta por vendedor | propuestas (tablero) | **MUERE** (2) |
| D1 · `propuesta/[id]/page.tsx`, total | **documento imprimible** | **MUERE** (2: MXN·en y USD·en) |
| K1 · `campanas/[id]/page.tsx`, ingreso | campañas (ficha) | **MUERE** (2) |
| K2 · `IndicadoresCampanas.tsx`, contratado | campañas (lista) | **MUERE** (≥6) |
| F1 · `TableroPeriodo.tsx`, cobrado | finanzas | **MUERE** (4) |
| F2 · `ComprobanteDialog.tsx`, total | finanzas | **MUERE** (2) |
| F3 · `EstadoCuenta.tsx`, saldo | finanzas | **MUERE** (2) |
| F4 · `finanzas/page.tsx`, «excede el saldo» | finanzas | **MUERE** (2) |
| C1 · `SiteFicha.tsx`, tarifa publicada | comercial (ficha) | **MUERE** (≥6) |
| C2 · `comercial/page.tsx`, tarifa de la fila | comercial | **MUERE** (≥6) |
| C3 · `ComercialOpex.tsx`, `pesos(...)` | comercial negociación | **MUERE** (2) |
| C4 · `ReservaDialog.tsx`, total | comercial (reserva) | **MUERE** (4) |
| P4 · `comercial/page.tsx`, filtro `formatMontoCorto` | comercial | **MUERE** (≥6) |
| R1 · `lib/periodos.ts`, `resumenReserva` | compartido | **MUERE** (`compartidos-idioma.test.ts`) |

**20 de 20 mueren.** El lector detecta de verdad un símbolo equivocado, y las pantallas están
cubiertas en los cinco frentes: propuestas, campañas, finanzas, comercial y el documento
imprimible.

**Puntos ciegos del lector.** Ninguno afecta a este cambio:

- No ve un símbolo separado de su cifra por una etiqueta (`<span>$</span>1,000`). Lo comprobé con
  grep, y en las pantallas traducidas no hay ningún caso así. `renderToStaticMarkup` tampoco mete
  comentarios entre nodos de texto.
- Un `$` sin cifra detrás no lo cuenta, a propósito.

## 7 · Pruebas

```
cd apps/web && npm run typecheck   →  tsc --noEmit, sin errores
cd apps/web && npm test            →  Test Files 335 passed (335) · Tests 5038 passed (5038) · 13.7 s
```

No he levantado `next start` ni las e2e, por la restricción de memoria. Las 1186 e2e en verde
(salvo `grants-rol-app`, que pide Docker) son cifra del autor, y **no las he medido**.

## 8 · Reglas

- `git diff --name-only ec427a66..HEAD` no toca `middleware.ts`, `nav.ts`, `db/schema.sql` ni
  `db/migrations/`.
- `IDIOMA_INGLES` no aparece en el diff (0 coincidencias).
- **Ningún `desktop.ini` en el diff.** Hay 14 `desktop.ini` seguidos por git en `vault/`, pero
  son los **mismos 14 que ya están en `ec427a66` y en `main`**: vienen de antes y no los mete
  esta rama.
- No hay marcadores de conflicto (`git grep "^<<<<<<< HEAD$"` vacío).
- La bóveda (`vault/03-Frontend/idiomas-es-en.md`) se actualiza en el mismo commit que el código,
  con cifras que he podido reproducir: 109 estados y 88 en rojo.

## 9 · Observaciones (no bloquean)

1. **Bitácora · baja.** `docs/Registro_Cambios.md` no tiene una línea para este cambio. Hoy no se
   nota desde la aplicación, porque el inglés solo se enciende con `IDIOMA_INGLES=1`
   (`lib/i18n/idiomas.ts:77`, apagado por omisión). Por eso no lo considero una falta. Pero
   cuando se escriba la entrada del inglés, conviene decir allí que en una instancia en pesos el
   inglés escribe `MX$`.
2. **Tipo del commit `bc5b2533` · informativa.** `feat` donde sería `fix` o `test` (ver §5).
3. **El comprobante toma el código de otra fuente que el símbolo · informativa, viene de antes.**
   El código del total viene de la factura (`comprobante.ts:87`, `f.moneda || monedaInstancia()`)
   y el símbolo viene de la instancia. Si alguna factura guardada tuviera una `moneda` distinta
   de la de la instancia, se leería `MX$ 1,160.00 USD`. En español pasaría igual
   (`$ 1,160.00 USD`), así que no lo introduce esta rama. El ADR 0048 lo hace improbable, porque
   la moneda es una por instancia y no se puede cambiar.

## Aparte · ¿el «MX$ 1,160.00 MXN» del comprobante se corrige o se deja?

**Recomiendo dejarlo** (`ComprobanteDialog.tsx:103`):

- **Es coherente con el español**, que ya escribe `$ 1,160.00 MXN` desde antes. Quitar el código
  solo en inglés haría que el mismo comprobante se escribiera distinto según el idioma, que es
  justo lo que la regla del dinero intenta evitar.
- **El código ISO no sobra en un comprobante.** Es un documento fiscal que se imprime y se
  archiva, y el CFDI lleva la moneda como dato propio. `MX$` es una convención de lectura, y
  `MXN` es el dato.
- **En una instancia USD queda `$ 1,160.00 USD`**, que es la forma habitual en un documento en
  inglés.
- **Es una línea, no una columna.** La redundancia aparece una vez, en el total.

Si el dueño prefiere quitarla, el cambio correcto sería quitar el sufijo `{c.importes.moneda}`
**en los dos idiomas a la vez**, no solo en inglés. Es una decisión de presentación del dueño, no
un defecto.

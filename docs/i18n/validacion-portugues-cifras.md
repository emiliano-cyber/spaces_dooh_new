# Validación · P2, las cifras del portugués se teclean a la brasileña

**Fecha:** 2026-11-05 · **Rama:** `feat/portugues-cifras`, diff `a97c171d..c138e983`
(`eb1d0b8f` pruebas en rojo, `c138e983` código, textos y bóveda) · Tarea **ROJA
(dinero)** · Validador independiente: solo lee y mide; no corrige. Todo lo de
abajo está medido en este árbol.

## Veredicto: VERDE

Lo que prometió el ejecutor se cumple, y lo medí con una batería propia, no con
la suya:

- **El cambio de comportamiento es un solo dato**: `FORMATO_IDIOMA.pt.separadorDecimal = ','`
  (`apps/web/lib/i18n/formato-idioma.ts:141`). En `lib/captura-cifra.ts` solo
  cambian comentarios: quitando las líneas de comentario, el código de
  `a97c171d` y el de HEAD son **idénticos** (`diff` vacío). `CampoCifra` y
  `EntradaCifra` deciden por `comaDecimal()`; ningún sitio de la captura
  pregunta `idioma === 'it'`.
- **En es/en/it no cambia ningún número que llega al servidor** (§1).
- **En pt llega la cifra correcta** en los casos de dinero reales, y lo ambiguo
  se rechaza (§2).
- **Los 13 textos pt dicen la regla nueva**, la misma que aplica el código (§4).

Hay **un hallazgo de gravedad media, PREEXISTENTE y fuera del diff** (H1): la
cantidad manual de Propuestas se traga separadores al teclear, en **todos** los
idiomas, no solo en it/pt como dice la propuesta del ejecutor, y su arreglo
propuesto no basta. No bloquea P2: el portugués hace exactamente lo que ya hace
el italiano publicado, y está apagado. Lo tiene que decidir el dueño.

## 1 · es/en/it, idénticos a `a97c171d`

Copia congelada de `a97c171d` (`captura-cifra.ts`, `i18n/diccionario.ts`,
`idiomas.ts`, `formato-idioma.ts`, `dinero.ts` y los 22 `textos/*.ts`, con sus
motivos), contra HEAD. Batería propia (xorshift32, semilla `0x5eed2611`;
alfabeto con cifras, `.`, `,`, `-`, `$`, espacios, `e`, `x`, `+`, `I`; diez
juegos de opciones: 0/1/2/3/4/6 decimales, mínimos 0, −10 y 1500, máximos 100,
1e6 y 1e9, `permiteVacio: false`):

| Prueba | es | en | it |
|---|---|---|---|
| Funciones puras sobre 60 000 entradas cada una (`leerCifra` con su motivo, `crudoDeLectura`, `textoAlSalir`, `textoDesdeCrudo`, `pintarCrudo`, `cifraAMedias`, `cifraIlegible`, `ejemploCifra`, `ponerComas`, `motivoCifraAjena`, `comaDecimal`) | 0 distintas | 0 | 0 |
| 25 000 sesiones de 1–10 acciones (teclear, retroceso, suprimir, pegar, soltar; desde vacío, «1,500», «1.500», «2,000.50», «2.000,50», «12.9», «12,9», «$1,234»; cursor al principio o al final): `teclearCifra`, `formatearMientrasEscribe` y **la cifra enviada** en cada paso, y `textoAlSalir` al final | 0 | 0 | 0 |
| 23 cifras de dinero fijas × 0/1/2/3 decimales | 0 | 0 | 0 |

**La batería discrimina:** añadiendo `pt` a la lista, las tres pruebas fallan.

**Huella italiana recalculada sobre `a97c171d`:** corrí
`captura-cifra.es-en.test.ts` de HEAD apuntado a la copia congelada de
`a97c171d`. `HUELLA_IT_DE_ANTES = 58b30641…` **pasa** con la función de
antes (y las huellas es/en también); lo único que falla allí es «el
portugués da los números del italiano», como tiene que ser antes de P2. Con HEAD
pasa todo. La huella se midió de verdad sobre `a97c171d`.

Los textos de es/en/it no cambian: todos los trozos del diff en `textos/` están
dentro de los `PT_*` (más un comentario justo antes de `PT_COMERCIAL`), y los
motivos de las 60 000 entradas por idioma, leídos de los diccionarios viejo y
nuevo, coinciden.

## 2 · pt: lo que llega al servidor

Unitarias propias (`leerCifra`, `crudoDeLectura` y `teclearCifra` tecla a tecla):

| Tecleado en pt | Opciones | Enviado |
|---|---|---|
| «1.500,50» / «1500,50» tecleado → «1.500,50» | dinero | `1500.5` |
| «0,5» | dinero | `0.5` |
| «1.234.567,89» / «1234567,89» tecleado → «1.234.567,89» | dinero | `1234567.89` |
| «12,9» | dinero | `12.9` |
| «55,5» | 1 decimal | `55.5` |
| «$ 1.500,50» | dinero | `1500.5` |
| «1,500» | dinero, y enteros | `NaN` (rechazado) |
| «1,500» | 3 decimales | `1.5` (uno y medio, como en italiano) |
| «1.5000» pegado o tecleado | dinero | `NaN` |
| «$1,500.50» | dinero | `NaN` |

En formularios de verdad (arnés `formulario-sin-dom`, API simulada), **Alta de
Comercial, tarifa**, cada caso **tecleado tecla a tecla Y pegado**: «1.500,50»
→ 1500.5, «0,5» → 0.5, «1.234.567,89» y «1234567,89» → 1234567.89, «12,9» →
12.9, «$ 1.500,50» pegado → 1500.5; **no llega nada a la API** con «1,500»,
«1.5000», «1,500.50», «$1,500.50», «2,500» ni «1.234.567.89» (pulsando el botón
aunque esté apagado). `EntradaCifra` en pt con un porcentaje: «55,5» → `55.5`,
«55.5» → `NaN`, «155,5» con máximo 100 → `NaN`, y el `type="number"` no llega
al `<input>` (se pinta `type="text"`). 24/24 en verde.

Los casos del ejecutor en `cifras-formularios.test.ts` (medidas, caras,
comisión, código, tramo, ficha, prospecto, asistente; cambio de idioma con el
campo abierto) y en `cifras-d18.test.ts` (Alta de Comercial, Alta de
Inventario, Paquete) también pasan.

## 3 · Ningún sitio de captura lee con su propia regla

- `parseFloat` y `replace(/,/g` en `app/` y `components/`: **0** apariciones.
- `'es-MX'` fijo en un `value`, `defaultValue`, `placeholder` o input: **0**.
- `Number(e.target.value)`: 23 sitios; todos son `<input type="number">`,
  deslizadores o `<select>` (segundos de loop/spot, días, filas, minutos, zoom,
  ids), donde el navegador entrega siempre punto decimal: hacen lo mismo en pt
  que en es e it. Los de cifras de dinero, medidas y porcentajes son
  `EntradaCifra`/`CampoCifra`.
- `idioma === 'it'` en la captura: ninguno. Los que hay
  (`PanelFirmas.tsx:413`, `estado-cuenta-csv.ts:60`, `contrato-documento.ts`,
  `errores-servidor.ts`, `novedades.ts`) son de presentación y papeles, no de lo
  que se teclea.
- Fuera de alcance, para que conste: latitud y longitud
  (`ContratoWizard.tsx:709-710`, `NuevaPantallaForm.tsx:326`) son `<input>`
  de texto con punto, igual que en italiano; no son cifras de dinero ni pasan
  por `comaDecimal()`.

## 4 · Los 13 textos pt

Los 13 están dentro de `PT_*`: los cinco `compartidos.cifra.*` (`forma`,
`comas`, `europeo`, `puntos`, `punto-decimal`),
`campanas.candado.monto-ilegible`, `comercial.tarifas.no-se-entiende`,
`catalogos.tarifas.invalida` y los cinco de inventario. Todos dicen «o ponto
separa os milhares e a vírgula, os decimais», que es lo que hace `leerCifra`
con `comaDecimal('pt')`, y son paralelos uno a uno a los italianos. Los
ejemplos de los que tienen hueco llegan por `ejemploCifra` (`CandadoPanel.tsx:136`,
`SiteFicha.tsx:1183`, `ContratoWizard.tsx:223`, `InventarioTabla.tsx:239`,
`RejillaDialog.tsx:208`), y el «(65,50)» fijo de `carga.precio-m2-ilegible` es
solo pt y corresponde a un `CampoCifra` que toma el idioma del contexto
(`ImportarInventarioDialog.tsx:421`). Los motivos que monta `leerCifra` salen
bien: «1,500» → «Em português, a vírgula é decimal: “1,500” seria 1,5. Para
1.500, digite 1500 ou 1.500»; «1,500.50» → «Aqui a vírgula é decimal e o ponto
separa os milhares: digite 2.500,50». Busqué en todo `PT_*` restos de «a
vírgula separa os milhares» o «use ponto» para decimales: **ninguno**.

## 5 · La propuesta del ejecutor (§2 quinquies): real, pero más ancha de lo que dice

Reproducido con mi propio arnés: un `CampoCifra` igual que el de la cantidad
manual (`apps/web/app/(app)/(shell)/propuestas/page.tsx:1584-1600`: `decimales={0}`,
guarda solo lo válido, `Math.max(1, …)`), la primera tecla sustituyendo el «1»
que trae, y dejando correr el efecto que repinta entre tecla y tecla, como
React:

| Tecleado | es | it | pt |
|---|---|---|---|
| «1.5000» | 1 → 1. → **1** → 10 → 100 → 1,000 · **guarda 1000** | 1 → **1** → 15 → 150 → 1.500 → 15.000 · **guarda 15000** | igual que it |
| «1.500» | … · **guarda 100** | guarda 1500 (bien) | igual que it |
| «2.5» | guarda 2 | **guarda 25** | igual que it |
| «1,5000» | 1 → 1, → 1,5 → 1,50 → 1,500 → 1,500 · **guarda 1500** | … · **guarda 1000** | igual que it |
| «1,500» | guarda 1500 (bien) | 1 → 1, → **1** → 10 → 100 · **guarda 100** | igual que it |

**H1 · MEDIA, preexistente, fuera del diff.** `propuestas/page.tsx:1591` (más
`CampoCifra.tsx:137-146`): un formulario que se queda con el último valor válido
hace que `CampoCifra` repinte ese valor en cuanto lo tecleado no se entiende, y
el separador **desaparece**; las cifras siguientes se pegan y se guarda otra
cantidad. Pasa con el **separador de millar en it/pt** (lo que vio el
ejecutor) **y también con el decimal en todos los idiomas**, español
incluido: «1.500» en es guarda 100 y «1,500» en it/pt guarda 100.

- **¿Es real?** Sí, y lo que dice la §2 quinquies de es —«no manda nada»— no
  es exacto: en «1,5000» se queda con el 1500 de «1,500», y con «1.500» guarda 100.
- **¿Afecta a la v0.12.6 publicada en italiano?** Sí. `origin/main`
  (`34f36a54`, PR #107, la v0.12.6) tiene `CampoCifra.tsx`, `captura-cifra.ts` y
  `propuestas/page.tsx` **idénticos** a `a97c171d` (`git diff --stat` vacío en
  los tres). La traza de it de arriba es la de producción en italiano, y la de es
  la de producción en español.
- **Gravedad: media.** Es la cantidad (spots, horas o millares de CPM) de una
  línea de propuesta, que multiplica la tarifa y llega al total que ve el
  cliente. No es silencioso del todo: el campo enseña lo que se guardó
  («15.000»), y el total y el «= n impressões» se mueven. Pero lo tecleado y lo
  guardado difieren sin aviso (`mostrarError={false}`), y en CPM un ×10 cobra
  diez veces más.
- **El arreglo que propone el ejecutor no basta.** Un `cifraAMedias` en espejo
  para it/pt arregla «1.» y «1.5» camino de «1.500», pero no «2.5» → 25 ni
  «1,500» → 100 en it/pt, ni nada de lo de es. La causa es el repintado a mitad
  de tecleo de un campo cuyo formulario descarta lo ilegible; habría que
  arreglarlo allí (el formulario guarda el `NaN` y bloquea, o `CampoCifra` no
  repinta lo que acaba de rechazar mientras `escribiendo`). **Decisión del
  dueño**, y P2 no la empeora: antes de P2, pt se comportaba como es, que
  también falla.

## 6 · Más hallazgos

- **H2 · BAJA (documentación).** `vault/03-Frontend/portugues-olas.md:619-620`:
  que es «no manda nada» es inexacto (ver H1). Corregirlo junto con la
  decisión de H1.
- **H3 · INFORMATIVA (código muerto).** El mutante que limita el guardia B77 de
  `formatearMientrasEscribe` al italiano (`captura-cifra.ts:348-353`,
  `if (insertoUnPunto && idioma === 'it')`) **sobrevive** a toda la batería.
  No es un hueco de P2: ese camino no se alcanza desde la aplicación, porque
  `teclearCifra` (lo único que usa `CampoCifra`) intercambia los signos y llama
  a `formatearMientrasEscribe` en `'es'` (`:463-470`, `:471`); solo lo ejercen
  las pruebas que lo llaman directamente con `'it'`.

## 7 · Lo medido

- `cd apps/web && npm run typecheck`: limpio.
- `npx vitest run --testTimeout=60000`: **434 archivos, 10153 en verde + 1
  omitida** (sin mis archivos temporales, ya borrados), lo mismo que declaró
  el ejecutor.
- **Mutantes propios, 10 contra 13 archivos de prueba (1458 pruebas, las mías
  incluidas): 9 muertos, 1 equivalente (H3).**

  | # | Mutante | Fallan |
  |---|---|---|
  | M1 | `cifraIlegible` solo `'it'` | 11 |
  | M2 | `EntradaCifra`: `idioma !== 'it'` en vez de `!comaDecimal` | 15 |
  | M3 | `pintarCrudo` solo `'it'` | 3 |
  | M4 | guardia B77 de `formatearMientrasEscribe` solo `'it'` | 0 (equivalente, H3) |
  | M5 | `textoAlSalir` solo `'it'` | 4 |
  | M6 | `teclearCifra`: lo pegado no cuenta como de la persona (B85) | 9 |
  | M7 | pt `inventario.renta.ilegible` con el texto mexicano de antes | 1 |
  | M8 | pt `compartidos.cifra.punto-decimal` con «Aqui o ponto é decimal» | 2 |
  | M9 | `cifraAMedias` solo `'it'` | 2 |
  | M10 | `ejemploCifra` solo `'it'` | 9 |
  | M11 | `FORMATO_IDIOMA.pt.separadorDecimal = '.'` (el dato) | 74 |

  Todos restaurados con `git checkout`; el árbol quedó limpio (solo los
  `desktop.ini` sin seguimiento de OneDrive, que ya estaban).
- **E2e no corridas**: el cambio no toca servidor, API, base ni sesión, y el
  ejecutor tampoco las corrió (no había Postgres en el 5433).
- **Procesos vitest colgados:** en la máquina hay 8 `node.exe` vivos, pero no
  pude ver su línea de mandatos (el permiso para listarla se denegó), así que
  **no puedo afirmar ni descartar** que alguno sea un vitest de la sesión del
  ejecutor. Las corridas de esta validación terminaron todas. No se mató nada.

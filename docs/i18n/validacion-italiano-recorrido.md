# Validacion independiente · recorrido final del italiano

- **Rama:** `feat/italiano-recorrido`, commits `b2de0501`, `8a3b10e7`, `e2f79aa2`, `aedef548`, `c2b2c1ba` sobre `integra/idiomas` (`caef69f8`).
- **Fecha:** 2026-11-04.
- **Quien:** validador independiente. Se reviso el codigo y se midio; la revision del autor (`revision-italiano-recorrido.md`) se comprobo, no se creyo.
- **Donde se midio:** un worktree temporal propio (`git worktree add --detach`), con `node_modules` enlazado por union al del worktree de la rama, primero en `caef69f8` y luego en `c2b2c1ba`. El build se hizo ahi, no en el worktree de los servidores 3600/3601. El temporal se borro al final (primero las uniones, luego el worktree).

## Veredicto: VERDE

Los seis criterios se cumplen y lo que dice la revision del autor cuadra con lo medido. Hay **una prueba muerta** (O1) que conviene arreglar antes de fusionar: es un escape perdido en una expresion regular y no afecta al comportamiento, pero la prueba promete algo que no comprueba.

## 1 · Los 8 arreglos italianos y sus pruebas

Se leyo el diff entero de `caef69f8..c2b2c1ba`. Cada arreglo hace lo que dice y solo donde lo dice:

| # | Donde | Condicion | Comprobado |
|---|---|---|---|
| 1 | `components/demo/ui/Paginacion.tsx:65`, `PagosRentaCard.tsx:321` | `idioma !== 'es'` | es: literales de siempre; it «di / Precedente / Avanti / pagamenti»; en «of / Previous / Next / payments» |
| 2 | `components/demo/ui/IndicadorCarga.tsx` (`EtiquetaCarga`) | `idioma !== 'es'` | `comun.cargando` |
| 3 | `components/IndicadorCarga.tsx` | `idioma !== 'es'` | `shell.confirmar.procesando`; los dos indicadores estan dentro de `ProveedorIdioma` (`app/layout.tsx:104`) |
| 4 | `lib/i18n/papeles.ts` | comparacion sin acentos; `es` sale antes | las 5 etiquetas, con y sin acento |
| 5 | `lib/i18n/donde-falla.ts:65` | `es` sale antes | los tres cortos coinciden con `space-eye/backend/src/controllers/monitoreo.controller.ts:36-38` |
| 6 | `lib/i18n/errores-acceso.ts`, `login/page.tsx:193` | `idioma !== 'es'` | `app/api/auth/forgot/route.ts` solo manda un `mensaje` (lineas 37-71), asi que no se pierde ningun otro aviso |
| 7 | `PanelFirmas.tsx` (`importeDeRevision`) | `idioma === 'it'` | «6.000,00 MXN»; es y en «$6,000.00 MXN» |
| 8 | `lib/i18n/textos/finanzas.ts` (it) | solo diccionario `it` | «Registra pagamento parziale», «Importo del pagamento» |

**Mutantes propios** (script en el *scratchpad*, contra `recorrido-italiano.test.ts` y `contrato-documento-idioma.test.ts`, restaurados uno a uno): **15 de 16 mueren**.

- Mueren: paginacion en ingles devuelta al espanol; `EtiquetaCarga` solo en it; «Procesando…» literal siempre; papeles sin quitar acentos; fallas cortas solo en it; aviso de *forgot* solo en it; aviso en espanol tomado del diccionario; importe de revision extendido al ingles; «Registra acconto» de vuelta; fecha del comprobante cruda en espanol; y cinco del contrato (abajo).
- Sobrevive: pasar `'es'` en vez del idioma a `formatNumero` de la paginacion en italiano. La prueba usa `total: 260` (`recorrido-italiano.test.ts:43`), sin millar, asi que no ve «1.000» frente a «1,000». Hueco menor (O3).

## 2 · El ingles de los arreglos 1–6

El ingles resultante es correcto y natural: «1–20 of 260 payments · Previous · Next», «Loading…», «Processing…», «Government permits and licenses», «Operations and payroll», «Screen frozen (the content is not changing)», «If that email is registered, we sent you a link.». Antes salia en espanol en todos esos puntos.

El espanol sigue igual en cada rama: todas las condiciones dejan el literal o el dato tal cual para `es`. En el volcado (§4) ningun estado con la interfaz en ingles cambia: ninguna prueba previa pintaba esos casos en ingles. Los casos ingleses nuevos estan en `recorrido-italiano.test.ts`.

## 3 · El contrato italiano

- **Apostrofo tipografico** en todo el texto y **«esclusivamente all’installazione, alla gestione…»**. Un uso escrito por una persona va tras «al seguente uso:». De paso, un uso vacio o solo con espacios cae ahora al texto por omision (`terminos.usoPermitido?.trim()`), y antes daba «a   ».
- **Las fechas:** «a decorrere dal giorno 1 agosto 2026 e fino al giorno 31 luglio 2028» y «in data 29 luglio 2026».
- **Los 14 hashes espanoles** de `contrato-documento-idioma.test.ts` no se tocaron y pasan.
- **El espanol y el ingles, identicos a `caef69f8`, medido.** Se copio el `contrato-documento.ts` de `caef69f8` junto al nuevo y se generaron los dos con los mismos datos: los dos juegos de la prueba (`completo` y `otro`) × es/en × 5 periodicidades × renovable si/no × uso (nulo, escrito, solo espacios) × 3 fechas de firma × 2 fechas de inicio. Son **720 casos**, y en todos sale igual el texto (`documentoATexto`), el objeto entero (JSON) y `encabezadosDocumento`. Los archivos temporales se borraron.
- **Mutantes del contrato, solo contra su prueba** (sin la huella del archivo, que mata cualquier cambio): «in data» → «il», «a l’installazione», un apostrofo recto, el uso escrito sin «al seguente uso:» y «fino al giorno» → «fino al». **Mueren los 5.**

## 4 · La fecha del comprobante en espanol

Volcado HTML de **toda la suite** con `I18N_VOLCAR_TODO`, en `caef69f8` (4633 archivos) y en `c2b2c1ba` (4642, los 9 de mas son la carpeta nueva de `recorrido-italiano.test.ts`). `diff -rq`: **16 archivos distintos**, y se miro cada uno etiqueta a etiqueta.

- **7 con el papel en espanol**, todos con **una sola linea** cambiada: el `<span>` de la fecha, «2026-10-01» → «01/10/2026» (o «2026-11-01» → «01/11/2026»).
  - Seis son de `pantallas-campanas-finanzas`: MXN es y USD es, comprobante y finanzas desplegadas, y «en ESPANOL sale el texto de siempre», comprobante y finanzas.
  - El septimo es `papeles-idioma-instancia`: instancia espanola, persona en ingles, el papel en espanol.
- **9 italianos:**
  - 5 de registrar pago: «Importo dell’acconto» → «Importo del pagamento» y el boton «Registra acconto» → «Registra pagamento parziale»;
  - 4 del panel de firmas: «$10,000.00 MXN» → «10.000,00 MXN».
- **Ningun otro estado espanol ni ingles cambia.**

## 5 · Diccionarios

`DICCIONARIOS` volcado en los dos arboles y comparado clave a clave:

| | Claves | Valores cambiados | Quitadas | Nuevas |
|---|---|---|---|---|
| es | 5617 → 5621 | **0** | 0 | `compartidos.paginacion.{de,anterior,siguiente,pagos}` |
| en | 5617 → 5621 | **0** | 0 | las mismas 4 |
| it | 5617 → 5621 | 2 (`finanzas.pago.registrar-abono`, `finanzas.pago.monto`) | 0 | las mismas 4 |

- El catalogo de errores del servidor (`errores-servidor.ts`, todas sus exportaciones) sale identico.
- Cobertura del italiano: **0 pendientes** de 5930 claves y 0 problemas (`coberturaItaliano()`, `problemasItaliano()`).
- La costura (`cobertura-italiano.test.ts`, `errores-servidor.test.ts` y las pruebas de pantallas) pasa en verde.

## 6 · Cifras

- `npm run typecheck`: limpio.
- `npx vitest run --testTimeout=60000`: **8374 de 8374 en 401 archivos** (la base, 8353 en 400). Cuadra con la revision.
- `npm run build`: en verde, hecho en el worktree temporal en `c2b2c1ba`.

## Observaciones

- **O1 · prueba muerta (arreglar antes de fusionar).** `apps/web/lib/contrato-documento-idioma.test.ts:302`: la regex se escribio `…l’)s?d{1,2} (gennaio|…` en vez de `…l’)\s?\d{1,2} (…`. Se perdieron los escapes, asi que busca una «s» y una «d» literales y **no puede fallar nunca**: `'dal 1 agosto 2026'` no la dispara. Medido con un mutante: «in data 29 luglio» → «in data del 29 luglio» **sobrevive** a las 71 pruebas del archivo. Hoy los textos son correctos y otras aserciones (`toContain`) fijan las frases actuales, pero la prueba «ninguna fecha con preposicion articulada» no protege lo que dice. Arreglo: poner `\s?\d{1,2}`.
- **O2 · comentarios desfasados por la segunda vuelta.**
  - `apps/web/lib/i18n/recorrido-italiano.test.ts:19-24` sigue diciendo que el ingles sale identico y que queda para el dueno.
  - `apps/web/app/(app)/login/page.tsx:192` dice «En italiano», y ahora es fuera del espanol.
  - El codigo esta bien; solo el comentario.
- **O3 · hueco menor.** Ninguna prueba fija la cifra con millar de la paginacion en italiano (ver §1, el mutante que sobrevive).
- **O4 · ya existia, no lo introduce esta rama.** `fechaDeComprobante` (`ComprobanteDialog.tsx:162`) usa `formatFecha`, que lee un instante ISO en la hora local del navegador. Con «2026-09-01T06:00:00.000Z», un navegador en UTC-7/-8 (Baja California) pinta «31/08/2026». La lista de facturas hace lo mismo, asi que al menos coinciden.
- **O5 · cosmetico.**
  - En `Paginacion.tsx:75` el «de» pasa a ser un nodo de texto propio. El texto visible es identico, pero un `renderToString` (no el `renderToStaticMarkup` del volcado) meteria un `<!-- -->` mas.
  - Las tres fallas cortas se traducen a la forma larga del telefono («Schermo bloccato (il contenuto non cambia)»), mientras que en espanol se ve la corta. Es aceptable.

## Higiene

- Solo se leyo y se corrieron pruebas.
- Los mutantes se restauraron byte a byte: la huella de `contrato-documento.ts` sigue siendo `6c5b8e86…`.
- `git status` queda limpio, salvo los `desktop.ini`, que no se commitean.
- No se usaron `git stash` ni `git push`. No se tocaron el Postgres del 5433, sus bases ni los servidores 3500/3600/3601.

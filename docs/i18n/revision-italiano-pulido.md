# Revisión · pulido final del italiano

- **Rama:** `feat/italiano-pulido` (worktree `.claude/worktrees/italiano-pulido`), sale de `integra/idiomas` en `49eaf1e4`.
- **Fecha:** 2026-11-04.
- **Qué es:** los abiertos del italiano que se podían cerrar sin una decisión del dueño y sin cambiar el español ni el inglés: B69, B72, O2/O3/O5 de la validación del recorrido, la lista de B65 para su validador y un barrido global del HTML italiano. **Sin validar**: lo revisa un validador después.
- **No se tocó:** B68 (`middleware.ts`), B70 y B71 (cambian el español), B73, B74, la captura de cifras (`lib/captura-cifra.ts`, P-L2-1), el texto legal del contrato, `app/api/auth/forgot`, migraciones, `db/schema.sql`, `nav.ts`, `aislamiento.e2e.test.ts`, `servidor-e2e.ts`. Sin servidores ni e2e (la máquina va justa de memoria).

## 1 · Commits

Cada arreglo con su rojo en un commit propio y sus mutantes contra las unitarias.

| Commit | Qué |
|---|---|
| `eca4fa82` | rojo · paginación con millar y `renderToString` sin `<!-- -->` de más (O3, O5); comentario de cabecera (O2) |
| `90d999da` | arreglo · los espacios van en la misma cadena que la palabra; comentario del login (O2) |
| `bae90b5f` | rojo · el aviso de idioma guardado en el idioma nuevo (B69) |
| `8451b1d3` | arreglo · B69 |
| `edea7c08` | rojo · los papeles con su `lang` cuando difieren (B72) |
| `df44ec0c` | arreglo · `ParteEnIdioma` (B72) |
| `b20feb0e` | el barrido global del HTML italiano |
| `0740b452` | rojo · el `alt` de la imagen promocional del alta manual |
| `e6dd7808` | arreglo · ese `alt` en italiano |

## 2 · O2, O3 y O5 (validación del recorrido)

- **O3:** `recorrido-italiano.test.ts` pinta la paginación con 1260 elementos: «21–40 di 1.260» en italiano y «1,260» en español e inglés. Con la página 51 de 63 también se mira el «desde–hasta» («1.001–1.020»). Mueren los tres mutantes que pasan `'es'` a `formatNumero` (total, desde y hasta).
- **O5:** el `<!-- -->` de más no era uno, eran tres: antes de «de», antes de «Anterior» y después de «Siguiente». Los espacios van ahora dentro de la misma cadena que la palabra (`` {` ${tr(…)}`} ``). La prueba fija el `renderToString` español de `caef69f8` byte a byte, y el inglés y el italiano con los mismos nodos. El texto visible y el `renderToStaticMarkup` del volcado no cambian.
- **O2:** la cabecera de `recorrido-italiano.test.ts` dice ya que el inglés se arregló en la segunda vuelta, y el comentario de `login/page.tsx` dice «fuera del español».
- **Mutantes:** 5 de 5 mueren.

## 3 · B69 · el aviso «Idioma guardado», en el idioma nuevo

- **Antes:** el aviso usaba el `t` de la pantalla, que es el del idioma de antes; el nuevo llega con el `router.refresh()`. Al pasar a italiano decía «Language saved».
- **Ahora:** `idiomaTrasGuardar()` (`components/demo/admin/IdiomaCuenta.tsx`) calcula en el cliente el idioma de destino:
  - el elegido, si está encendido;
  - con «Usar el idioma del navegador», la misma regla que `resolverIdioma` en el servidor: cookie `spaces_idioma`, luego `navigator.languages` (de donde el navegador saca su `Accept-Language`), luego español, entre los encendidos.
- `avisoIdiomaGuardado(destino)` traduce el aviso con ese idioma.
- **Sin cambio de idioma**, el destino es el de ahora y el aviso sale igual que hoy. El diccionario no cambia. La tarjeta pinta el mismo HTML, y con un solo idioma encendido sigue sin pintarse.
- **Lo que no cubre una unitaria:** que el desplegable llame a la función. No hay DOM para pulsarlo, así que una prueba lee la fuente, como `salir.test.ts`.
- **Mutantes:** 8 de 8 mueren. *(Tras la validación: el contexto sale de una función pura, §10.)*
- **Límite conocido:** con «navegador», la cabecera real la arma el navegador desde `navigator.languages`. Si alguien la cambia por otro medio (un proxy, una extensión), el aviso podría salir en un idioma y la página en otro. Es solo el aviso.

## 4 · B72 · los papeles imprimibles declaran su `lang`

- **`lib/i18n/parte-en-idioma.tsx`** (`ParteEnIdioma`): un `<div lang style="display:contents">` **solo si** el idioma del papel no es el de la persona. Si coinciden, devuelve los hijos tal cual.
- Va en tres sitios:
  - **la propuesta imprimible** (`/propuesta/[id]`): envuelve el `<article>`. La barra queda fuera;
  - **el contrato** (`/contrato/[id]`): dos partes, lo que se imprime antes del panel de firmas y el aviso del pie. El panel de firmas, en medio, habla en el idioma de la persona y queda fuera;
  - **el comprobante:** dentro de `EnIdiomaDeLosDocumentos`, que compara con el idioma de la persona.
- **Medido** con `I18N_VOLCAR_TODO` contra `49eaf1e4`:
  - **23 estados** cambian, todos con instancia y persona en idiomas distintos:
    - 14 del contrato (pantallas de inventario y arrendadores);
    - 3 de la propuesta (ADR 0049);
    - 2 del comprobante;
    - 3 de `idioma-documentos-cliente`;
    - 1 del layout raíz.
  - Un script comprobó en los 23 que la **única** diferencia es abrir y cerrar el envoltorio.
  - **Ningún estado con los dos idiomas iguales cambia**, que es el caso de hoy en todas las instancias.
- **Mutantes:** 7 de 7 mueren.
- **Por qué cambia el HTML inglés, y se acepta:** B72 lo daba por sabido («se arregla … aceptando ese cambio»). Los estados ingleses que cambian son los de una persona en inglés con un papel español: el envoltorio dice `lang="es"`, que es la verdad.
- **Queda:**
  - el `title` de los huecos del contrato («falta este dato») está en el idioma de la persona dentro de la parte del papel. Es ayuda de pantalla y no se imprime;
  - el título del cuadro del comprobante (Radix) va fuera del envoltorio.

## 5 · B65 · para el validador

Las cinco claves de «Mi cuenta → Idioma» en italiano (`lib/i18n/diccionario.ts`, `IT_BASE`), sin cambios en este pulido:

| Clave | Español | Italiano |
|---|---|---|
| `idioma.cuenta.titulo` | Idioma | Lingua |
| `idioma.cuenta.ayuda` | El idioma en que ves la aplicación, en cualquier dispositivo donde entres. Los contratos y documentos no cambian: van en el idioma de la empresa. | La lingua in cui vedi l’applicazione, su qualsiasi dispositivo da cui accedi. Contratti e documenti non cambiano: usano la lingua dell’azienda. |
| `idioma.cuenta.navegador` | Usar el idioma del navegador | Usa la lingua del browser |
| `idioma.cuenta.toast` | Idioma guardado | Lingua salvata |
| `idioma.cuenta.error` | No se pudo guardar el idioma | Impossibile salvare la lingua |

Y el error del servidor, que ya venía: «Questa lingua non è disponibile su questo server.». Con B69, «Lingua salvata» es ahora lo que ve quien **pasa** a italiano.

## 6 · Barrido global del italiano

- **Cómo:** `node scripts/i18n-barrido-italiano.mjs <carpeta>`.
  1. Corre todas las unitarias con `I18N_VOLCAR_IT` (el espejo italiano de cada estado inglés) e `I18N_VOLCAR_TODO`. `volcado-html.ts` apunta en `_italiano.txt` los estados cuya raíz va en `idioma: 'it'`, sin cambiar ningún `.html`.
  2. Lo barre con `lib/i18n/barrido-italiano.test.ts` (que sin `I18N_BARRIDO_IT` solo prueba sus reglas).
- **Qué cuenta:**
  - **frases:** 7414 trozos de los textos españoles e ingleses del diccionario, partidos por sus huecos `{…}`, con dos palabras y ocho letras como mínimo, que **ningún** texto italiano contiene;
  - **formato:** las huellas de `huellasEnItaliano`, con la moneda deducida del HTML.
- **No se barre:** lo que va dentro de un papel con `lang` de otro idioma (B68, B72). Tampoco se juntan dos nodos de texto («CMS DOOHmain» + «ID in DOOHmain» no es «DOOHmain ID»).
- **Resultado final:** 3710 estados italianos, **646 hallazgos, los 646 declarados, 0 sin declarar.** Las declaraciones están en `A_PROPOSITO_IT`, cada una con su motivo:

| Hallazgos | Motivo |
|---|---|
| 300 | falso positivo de la guardia: «0,812» es el decimal italiano del SSIM, no un millar |
| 97 | P-L2-1: captura de cifras a la mexicana, decisión ROJA pendiente. Solo el `placeholder` numérico de un campo («0.00», «Es. 12.9», «es. 180,000») y la explicación «… il punto i decimali» con su ejemplo detrás (§10) |
| 102 | espejo de un Server Component: el contrato, la propuesta imprimible, la firma pública, «sin permiso» y el 404 se resuelven con la persona en inglés **antes** de que el espejo cambie el idioma; sus claves italianas las fijan las pruebas italianas de cada lote |
| 54 | dato: el cuerpo del contrato simulado de la prueba va en español sea cual sea el idioma |
| 39 | dato: navegador e IP de una firma («Mozilla/5.0», «10.0.0.1») |
| 20 | catálogo del SAT (uso del CFDI) |
| 11 | dato: «litigio del predio», el motivo de una pausa legal |
| 8 | la marca de agua de la foto de Space Eyes, en es-MX a propósito (evidencia) |
| 5 + 5 + 3 + 1 | datos: una notificación («Pago registrado»), el folio CA-0001.1, el `formatMonto` de juguete del comprobante, el error forzado de InvitarModal |
| 1 | la prueba de la propia guardia (pinta una fecha inglesa para ver que muerde) |

- **Fallos encontrados:** con dos palabras, **ninguno**: lo que el recorrido del navegador vio ya estaba arreglado.
- **Una pasada exploratoria de una sola palabra** (seis letras como mínimo; no queda en el script porque es casi todo ruido): 592 hallazgos más. Uno es un fallo de verdad:
  - el `alt="preview"` de la imagen promocional del alta manual, escrito a mano. **Arreglado** para el italiano («Anteprima», `e6dd7808`); en español e inglés, el literal de siempre;
  - el resto son datos de las pruebas: nombres de campaña y de código («Campaña Verano», «VERANO20», «LANZAMIENTO»), el SAT, claves y correos, el mensaje «tiempo agotado» que fuerza la prueba, y la palabra de confirmación «BORRAR» que pasa la prueba.
- **«Vincular», la bitácora y las notas de versión:** no salen con estas reglas. «Vincular» es una sola palabra, y la bitácora y las notas son datos que ninguna prueba de pantallas pinta en italiano.

## 7 · El español y el inglés

- **`DICCIONARIOS`:** volcados en `49eaf1e4` y al final, y comparados clave a clave.
  - es, en e it: 5621 claves, **0 valores cambiados**, 0 nuevas, 0 quitadas.
  - El catálogo de errores del servidor, idéntico.
- **HTML** (`I18N_VOLCAR_TODO`, `diff -rq` contra `49eaf1e4`):
  - **23 estados** distintos: los de B72, solo el envoltorio (§4);
  - **4 italianos**: el `alt` «Anteprima», y nada más;
  - **17 entradas nuevas** en `diff -rq`, que son las carpetas y estados de las pruebas nuevas, más `_italiano.txt`.
  - Ningún otro estado cambia.
- **El espejo italiano:** 13 estados con el envoltorio, más los nuevos.
- **Cobertura del italiano:** 0 pendientes (`cobertura-italiano.test.ts`). **Costura** (`costura.test.ts`) en verde.

## 8 · Cifras

- `npm run typecheck`: limpio.
- `npx vitest run --testTimeout=60000`: **8418 en verde y 1 omitida, en 402 archivos** (8407 antes de las correcciones de §10). La omitida es el barrido sobre disco, que solo corre con `I18N_BARRIDO_IT`. La base tenía 8374 en 401.
- `npm run build`: en verde.
- `node scripts/recuentos.mjs`: en el diario.

## 9 · Lo que se tocó

- **Código:**
  - `components/demo/ui/Paginacion.tsx`;
  - `components/demo/admin/IdiomaCuenta.tsx`;
  - `components/demo/inventario/NuevaPantallaForm.tsx`;
  - `app/(app)/propuesta/[id]/page.tsx`, `app/(app)/contrato/[id]/page.tsx`, `app/(app)/login/page.tsx` (comentario);
  - `lib/i18n/idioma-documentos-cliente.tsx`, nuevo `lib/i18n/parte-en-idioma.tsx`.
- **Pruebas e infraestructura:**
  - `lib/i18n/recorrido-italiano.test.ts`, `components/demo/admin/IdiomaCuenta.test.ts`;
  - `lib/i18n/pantallas-propuestas.test.ts`, `lib/i18n/pantallas-inventario-arrendadores.test.ts`, `lib/i18n/papeles-idioma-instancia.test.ts`;
  - nuevos `lib/i18n/barrido-italiano.ts` y `lib/i18n/barrido-italiano.test.ts`;
  - `lib/test/volcado-html.ts`;
  - nuevo `scripts/i18n-barrido-italiano.mjs`.
- **Bitácora:** sin entrada. B69 y B72 solo se ven con más de un idioma encendido, que hoy no pasa en ninguna instancia.
- **Higiene:**
  - sin `git stash` ni `git push`;
  - el Postgres del 5433 no se tocó, y no se levantó ningún servidor;
  - los `desktop.ini` no se commitean.

## 10 · Correcciones tras la validación (ÁMBAR, `docs/i18n/validacion-italiano-pulido.md`)

Cada una con su rojo en un commit propio.

| Commit | Qué |
|---|---|
| `5190eff4` | rojo · B69, el contexto del aviso como función pura |
| `eb738963` | arreglo · B69 |
| `80f9459b` | rojo · la excepción de cifras anclada y la comprobación estática |
| `e22a49cd` | arreglo · las dos |

- **La excepción de P-L2-1, anclada** (`lib/i18n/barrido-italiano.ts`). Antes, `0\.00`, `65\.50` y `180,000` iban sin anclar contra el contexto y declaraban un importe inglés cualquiera. Ahora solo cubre dos cosas:
  - un `placeholder` que es solo el ejemplo numérico (`/^(?:es\. )?-?\d[\d.,]*$/i`, y la huella tiene que estar dentro);
  - la explicación de `captura-cifra` con el ejemplo justo detrás («il punto i decimali. Esempio: X», «il punto i decimali (X)»).
  - **Probado:** `<p>Totale</p><p>MX$ 5,000.00</p>`, «Nov 30, 2026» con un importe al lado, «Totale 0.00», un `title="0.00"` y un placeholder con texto salen **sin declarar**.
  - **Recuento** sobre el mismo volcado: 646 hallazgos y 0 sin declarar; el reparto queda en **97 de P-L2-1 y 102 del espejo de Server Components**, como medía el validador. Los 11 de la propuesta imprimible del espejo ya caen en su motivo.
  - **Mutantes:** 5 de 5 mueren (sin ancla, cualquier placeholder, placeholder sin fin, `title` como placeholder, la huella fuera del placeholder).
- **Comprobación estática** `italianoConFrasesDeOtraClave()`, que corre en cada `vitest` sin volcado. Ningún valor italiano (`IT_PARCIAL`) lleva un trozo español o inglés de **otra** clave, de 12 letras y dos palabras como mínimo.
  - El propio español de la clave lo sigue mirando la cobertura.
  - Con 8 letras salían 66 coincidencias: «del periodo», «al momento», «in pipeline» y otras, que también son italiano. Con 12 quedan tres cognados, declarados en `COGNADOS_IT`: «foto del cliente», «Raspberry Pi» e «ID del dispositivo».
  - **Mutantes:** mueren los del validador (`idioma.cuenta.navegador` = «No se pudo guardar el idioma», y una variante con el inglés de otra clave), el que compara la clave consigo misma, el umbral a 99 y quitar un cognado.
- **B69:** `contextoDelNavegador(actual, encendidos, cadenaCookie, idiomasNavegador)` es pura. `cadenaCookieDelDocumento()` e `idiomasDelNavegador()` leen `document.cookie` y `navigator.languages`, y dan cadena y lista vacías en el servidor.
  - La tarjeta solo las cablea, y la prueba de cableado exige la llamada entera.
  - Las pruebas usan cadenas («spaces_csrf=x; spaces_idioma=it; otra=1») y `vi.stubGlobal`. Node 24 trae un `navigator` global, y para el caso «servidor» se quita.
  - **Mutantes:** 10 de 10 mueren, entre ellos los tres que sobrevivían: `navegador: []`, `actual: 'es'` y `cookie: null`.
- **Sin cambios** en el español, el inglés ni los diccionarios: solo se tocaron `barrido-italiano.*` e `IdiomaCuenta.*`.
- **El barrido sobre disco sigue sin correr en CI:** es una herramienta a demanda (`I18N_BARRIDO_IT`). Lo que sí corre siempre son sus reglas y la comprobación estática.
- **Queda (deuda menor, observación 4 del validador):** las excepciones por `archivo` sin `tipo` declaran cualquier frase de esos estados. Hoy todo lo que tapan es inglés del espejo.

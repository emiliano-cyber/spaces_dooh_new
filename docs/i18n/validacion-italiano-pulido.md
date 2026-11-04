# Validacion · pulido final del italiano

- **Rama:** `feat/italiano-pulido`, 10 commits `eca4fa82..97f8ea0d` sobre `integra/idiomas` `49eaf1e4`.
- **Fecha:** 2026-11-04.
- **Quien:** validador independiente. Se reviso el codigo y se midio; la revision del autor
  (`docs/i18n/revision-italiano-pulido.md`) se comprobo, no se tomo por buena.
- **Como:** un worktree propio y desechable en `49eaf1e4` (fuera del repo, `node_modules` por
  union) para el volcado base; el volcado de la rama, con el propio `scripts/i18n-barrido-italiano.mjs`.
  Sin servidores, sin e2e, sin `git stash` ni `git push`; el Postgres del 5433 no se toco.

## Veredicto: AMBAR

Lo que se arreglo esta bien arreglado y medido: B69, B72, O2/O3/O5 y el `alt` cumplen, el espanol
y el ingles no cambian salvo el envoltorio de B72 en estados de idiomas distintos, y todas las
suites estan en verde. El ambar es por el **barrido**: funciona y sus 646 declarados son legitimos,
pero una de sus excepciones es tan ancha que declararia un fallo real de formato de dinero, tiene
un punto ciego (una frase espanola metida en un `IT_*`) y no corre en CI. Y la prueba de cableado
de B69 deja vivos tres mutantes. Nada de esto rompe lo entregado; si condiciona fiarse del
barrido como red para lo que venga.

## 1 · B69 · el aviso «Idioma guardado» en el idioma de destino · VERDE (con una observacion)

- `components/demo/admin/IdiomaCuenta.tsx:27-33` `idiomaTrasGuardar`: el elegido si esta
  encendido (si no, el actual); con «navegador», `resolverIdioma({ cookie, cabecera, permitidos })`.
  Es la misma funcion que usa el servidor (`lib/i18n/idiomas.ts:225`, `lib/i18n/servidor.ts:99`)
  sin la cookie de la cuenta, que al elegir «navegador» la ruta `PUT /api/perfil/idioma` deja sin
  preferencia. Regla cookie > navegador > espanol entre los encendidos: correcta.
- Sin cambio de idioma, destino = `idioma` actual = el del `t` de antes: el texto de hoy. El
  diccionario no cambia.
- **La prueba que lee la fuente** (`IdiomaCuenta.test.ts:101-103`) no esta vacia (muere si se
  vuelve a `t('idioma.cuenta.toast')`), pero solo mira el prefijo de la llamada. **Sobreviven**:
  - M12 `navegador: []` en `IdiomaCuenta.tsx:97`;
  - M13 `actual: 'es'` en `IdiomaCuenta.tsx:94`;
  - M14 `cookie: null` en `IdiomaCuenta.tsx:96`.
  **Mejor forma:** sacar el contexto a una funcion pura, p. ej.
  `contextoDelNavegador(idioma, disponibles, document.cookie, navigator.languages)`, y probarla con
  cadenas; asi el cableado deja de depender de una expresion regular sobre la fuente. No hay
  jsdom/happy-dom en el repo, asi que la via de pulsar el desplegable no esta disponible.
- Limite que el autor ya cita y se confirma: el cliente deduce el `Accept-Language` de
  `navigator.languages`; si el navegador lo recorta (reduccion de `Accept-Language`) o un proxy lo
  cambia, el aviso podria salir en otro idioma que la pagina. Solo el aviso.

## 2 · B72 · `ParteEnIdioma` · VERDE

- `lib/i18n/parte-en-idioma.tsx:33`: si los idiomas coinciden devuelve los hijos tal cual; si no,
  `<div lang style="display:contents">`.
- **Volcado completo** (`I18N_VOLCAR_TODO`, toda la suite) en `49eaf1e4` y en la rama, `diff -rq`:
  **27** estados distintos y 18 entradas nuevas (las pruebas nuevas y `_italiano.txt`). De los 27,
  un script que quita el envoltorio (con su cierre) y compara byte a byte:
  - **23 solo por el envoltorio** (14 contrato, 3 propuesta, 3 `idioma-documentos-cliente`,
    2 comprobante, 1 layout raiz), cifra del autor confirmada. En todos el `lang` del envoltorio es
    el de la instancia y distinto del de la persona;
  - **4 solo por el `alt`** «preview» → «Anteprima», todos con la persona en italiano.
  - **Ningun estado con los dos idiomas iguales cambia.**
- **Contrato:** el panel de firmas (`doc-panel-firma doc-no-print`) queda **fuera** de los dos
  envoltorios (`app/(app)/contrato/[id]/page.tsx:118-200` y `:209-211`); comprobado en el HTML.
- **`display:contents` y la impresion:** `app/(app)/demo.css:295-358` y `:412-519` no tienen
  ningun selector de hijo directo, hermano ni `:first-child` sobre `.doc-*` (el unico `>` es
  `.doc-campo > span`, fuera de los papeles). Las reglas de `break-*` y `@page` van sobre clases de
  los hijos, que siguen siendo cajas; el envoltorio no genera caja. En la propuesta, el `article`
  sigue siendo el bloque centrado dentro de `.doc-wrap`. **No rompe ni el layout ni el print.** Un
  efecto colateral bueno: `.doc-hoja` lleva `hyphens: auto`, y ahora el silabeo usa el idioma del
  papel. Riesgo no medido (sin navegador): lectores de pantalla y `display:contents`; es el mismo
  patron que B68 ya usa en `/p` y el portal.

## 3 · O2/O3/O5 · paginacion · VERDE

- Mutantes `'es'` en `formatNumero` (total, hasta) **mueren** (M1, M2); el nodo aparte de «de»
  (M3) muere en la prueba de `renderToString`.
- Prueba propia con las tres versiones de `Paginacion.tsx` (`caef69f8`, `49eaf1e4`, rama):
  - `renderToString` espanol de la rama **identico** al de `caef69f8`; `<!-- -->`: 6 / 9 / 6
    (caef / base / rama). Eran tres de mas, como dice el autor;
  - `renderToStaticMarkup` es/en/it de la rama **identico** al de `49eaf1e4`;
  - el texto visible de `renderToString` (sin comentarios ni etiquetas), identico en los tres
    idiomas.

## 4 · B65 · las cinco `idioma.cuenta.*` en italiano · VERDE

`lib/i18n/diccionario.ts:642-647`: «Lingua», «La lingua in cui vedi l’applicazione, su qualsiasi
dispositivo da cui accedi. Contratti e documenti non cambiano: usano la lingua dell’azienda.»,
«Usa la lingua del browser», «Lingua salvata», «Impossibile salvare la lingua». Sentido fiel,
registro «tu» (vedi, accedi, usa), apostrofo tipografico ’ en los dos sitios que lo llevan,
«Impossibile …» segun L5; ninguno necesita « ». Validadas. Para cerrar B65 falta solo la entrada
en la bitacora.

## 5 · El barrido · AMBAR

**Funciona y reproduce:** `node scripts/i18n-barrido-italiano.mjs` sobre la rama da 3710 estados,
7414 trozos, **646 hallazgos, 646 declarados, 0 sin declarar**, con el mismo reparto por motivo.

**Los 646, revisados todos agrupados por detalle unico** (13 motivos, 81 detalles distintos, mas
de 40 contextos leidos): ninguno es un fallo de traduccion escondido. SSIM «0,812» (todos en Space
Eyes), `Mozilla/5.0`, «litigio del predio», «Pago registrado», CFDI del SAT, CA-0001.1, la marca de
agua, el `formatMonto` de juguete, los ejemplos de captura «Esempio: 212,500.50», «es. 180,000»,
«Es. 12.9 / 7.2» y los 91 del espejo de Server Components (todo ingles resuelto antes del espejo).

**Pero:**

1. **`lib/i18n/barrido-italiano.ts:167` · la excepcion de P-L2-1 es demasiado ancha.** Las
   alternativas `0\.00`, `65\.50` y `180,000` van sin anclar contra el texto de la huella, que
   incluye su contexto. Consecuencias medidas:
   - **11 de los 108** «P-L2-1» no son captura de cifras: son la propuesta imprimible en ingles del
     espejo («MX$ 5,000.00», «Nov 30, 2026», «Volume discount (2.5%)»). Estan declarados con el
     motivo equivocado porque esa regla va antes que la del espejo; el reparto real es 97 / 102,
     no 108 / 91;
   - prueba de la regla con `barrerHtml`: `<p>Totale</p><p>MX$ 5,000.00</p>` sale **declarado**
     como P-L2-1, y una fecha inglesa «Nov 30, 2026» al lado de un «MX$ 1,000.00» tambien; sin el
     importe, la misma fecha sale SIN DECLARAR. Es decir: **el fallo de formato mas probable
     (un importe con locale ingles en italiano) quedaria tapado**. Anclar las alternativas al
     contexto de los ejemplos (`esempio: 212,500\.50`, `es\. 180,000`, el `0.00` del campo de la
     ficha) o limitarlas por `archivo`.
2. **`lib/i18n/barrido-italiano.ts:71` · punto ciego: un `IT_*` con texto espanol.** Un trozo que
   aparece en cualquier valor italiano deja de ser ajeno. Mutantes:
   - `idioma.cuenta.navegador` (it) = «Usar el idioma del navegador» (su propio espanol):
     el barrido **no** lo ve (7413 trozos); lo caza `cobertura-italiano.test.ts` («igual al espanol»);
   - `idioma.cuenta.navegador` (it) = «No se pudo guardar el idioma» (el espanol de OTRA clave):
     **sobrevive a toda la suite** (402 archivos, 8407 en verde), al barrido, a cobertura y a
     costura.
   Arreglo barato: una comprobacion estatica de que ningun valor italiano contiene un trozo
   espanol/ingles de dos palabras de otra clave, con su lista blanca.
3. **El barrido no corre en CI.** Sin `I18N_BARRIDO_IT` solo se prueban sus reglas
   (`barrido-italiano.test.ts`, `describe.runIf`); es una herramienta a demanda, no una red.
   Que quede dicho asi en la nota de la boveda.
4. Excepciones por `archivo` sin `tipo` (`barrido-italiano.ts:160`, `:169-171`) declaran cualquier
   frase de esos estados. Hoy todo lo que tapan es ingles del espejo; es una deuda menor.

**Mutante pedido, el de un literal:** `{'Usar el idioma del navegador'}` escrito a mano en
`IdiomaCuenta.tsx:123` → el barrido lo **caza** (11 sin declarar), y tambien las pruebas del lote.

## 6 · Espanol, ingles y suites · VERDE

- `git diff 49eaf1e4..HEAD` no toca `lib/i18n/diccionario.ts` ni `lib/i18n/textos/`:
  `DICCIONARIOS.es/.en/.it` **0 valores cambiados**.
- `npm run typecheck`: limpio.
- `npx vitest run --testTimeout=60000`: **402 archivos, 8407 en verde y 1 omitida** (el barrido
  sobre disco). Base `49eaf1e4`: 401 archivos, 8374.
- `cobertura-italiano.test.ts` y `textos/costura.test.ts`: 43 en verde.
- `npm run build`: **en verde** (habia 7.6 GB libres; no habia servidor sobre este `.next`).

## 7 · Mutantes propios (todos restaurados, `git status` limpio tras cada uno)

| # | Mutante | Resultado |
|---|---|---|
| M1 | `formatNumero(total, 0, 'es')` en la paginacion | muere (2) |
| M2 | `formatNumero(hasta, 0, 'es')` | muere (1) |
| M3 | «de» otra vez en un nodo aparte | muere (2, `renderToString`) |
| M4 | `ParteEnIdioma` envuelve siempre | muere (7) |
| M5 | `ParteEnIdioma` no envuelve nunca | muere (7) |
| M6 | `lang` del envoltorio = el de la persona | muere (7) |
| M7 | el panel de firmas dentro del envoltorio del contrato | muere (3) |
| M8 | la propuesta sin envoltorio | muere (3) |
| M9 | el comprobante sin envoltorio | muere (1) |
| M10 | un idioma apagado se toma por destino | muere (1) |
| M11 | «navegador» ignora la cookie | muere (1) |
| M12 | componente: `navegador: []` | **sobrevive** |
| M13 | componente: `actual: 'es'` | **sobrevive** |
| M14 | componente: `cookie: null` | **sobrevive** |
| B1 | literal espanol en `IdiomaCuenta.tsx` | el barrido lo caza |
| B2 | `IT` = su propio espanol | el barrido no; cobertura si |
| B3 | `IT` = espanol de otra clave | **sobrevive a todo** |

11 de 14 de codigo mueren; los tres vivos son el cableado de B69 (§1). Del barrido, el punto
ciego B3 (§5.2).

## 8 · Que haria falta para VERDE

1. Anclar la excepcion de P-L2-1 (`barrido-italiano.ts:167`) y recontar el reparto 108/91.
2. La comprobacion estatica de valores italianos con trozos espanoles/ingleses de otra clave.
3. Sacar el contexto de B69 a una funcion pura y probarla (mata M12-M14).

Ninguno toca espanol ni ingles, ni el diccionario.

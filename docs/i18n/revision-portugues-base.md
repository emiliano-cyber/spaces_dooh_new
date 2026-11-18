# Revisión · Ola 0 del portugués (la infraestructura)

**Fecha:** 2026-11-05 · **Rama:** `feat/portugues-base`, sobre
`integra/portugues` (= `verificacion`, `a7953731`) · **Tablero:**
`vault/03-Frontend/portugues-olas.md`

Pedido del dueño: la aplicación en portugués de Brasil. Esta ola prepara la
aplicación para un **cuarto idioma sin traducir la interfaz**, replicando la
ola 0 del italiano (`feat/italiano-base`, hasta `cbd791c9`) con las decisiones
del dueño del 05/11. Eso lo harán cinco lotes con traductor y validador
(partición en el tablero, §2).

## 1 · Decisiones del dueño que esta ola aplica (05/11)

1. **pt-BR, trato «você».** Locale `pt-BR`; la clave es `pt`.
2. **Pesos «MX$ 1.160,00»**, como el italiano. No se añade BRL. Instancia USD:
   provisional «US$ 1.160,00» (pendiente del dueño).
3. **Lo que falta se pinta en ESPAÑOL**, no en inglés. Errores del servidor:
   enteros en portugués o enteros en español. La caída vive en un solo sitio.
4. **Los papeles en portugués NO son de esta ola**: tarea ROJA aparte. Esta
   ola no escribe migraciones ni toca `db/`, auth, middleware ni sesión.

## 2 · Qué se construyó

| Pieza | Archivo | Qué hace |
|---|---|---|
| El idioma y su interruptor | `lib/i18n/idiomas.ts` | `IDIOMAS = ['es','en','it','pt']` (el cuarto, sin mover los otros); `portuguesActivo()` (solo `IDIOMA_PORTUGUES=1`); `idiomasActivos()` lo incluye; `idiomasPorOmision()` lo excluye si está apagado. `pt-BR`, `pt-PT` y `pt` se normalizan a `pt` |
| Lo que la base acepta | `lib/i18n/idiomas.ts` | `IDIOMAS_EN_LA_BASE = ['es','en','it']`, `esIdiomaEnLaBase()`, `idiomasDeCuenta()` (§4) |
| Quién decide | `servidor.ts`, `pages/_error.tsx`, `app/layout.tsx` | Sin cambios: ya leían `idiomasActivos()` |
| El selector | `SelectorIdioma.tsx` | Sin cambios de conducta (pinta `disponibles`); el tipo de la clave incluye `idioma.pt`. Etiqueta **«Português»** |
| El formato | `lib/i18n/formato-idioma.ts` | `FORMATO_IDIOMA.pt` (§3) |
| El diccionario | `diccionario.ts`, `textos/*.ts` | `PT_<AMBITO>: Partial<Record<…>> = {}` en los 21 ámbitos; `PT_BASE` con el selector (6 claves: `idioma.etiqueta` «Idioma», `idioma.cambiar` «Mudar idioma», y los cuatro nombres de idioma en sí mismos); `idioma.pt` «Português» en ES, EN e IT. **`DICCIONARIOS.pt = conCaidaAlEspanol(ES, PT)`**; `AMBITOS_PORTUGUES` y `PT_PARCIAL` para la cobertura |
| Los errores del servidor | `errores-servidor.ts` | `CATALOGO_ERRORES_PT`, `CATALOGO_LIB_PT` (sale de `PT_SERVIDOR`), `CAMPO_PT`, `FALTA_FIRMA_PT`, `PATRONES_PT` (vacíos); `PatronError` gana `pt` y `huecosPt`. La lógica «nunca a medias» del italiano se generalizó a `errorEnTablas(TABLAS_*, …)`; `traducirError(m, 'pt')` = `errorEnTablas(TABLAS_PT, m) ?? m` (el español que entró) |
| La cobertura | `cobertura-portugues.ts` | Tabla por ámbito; `problemasPortugues()` rechaza vacíos, huecos distintos y claves sin español |
| La guardia | `guardias-portugues.ts` | Formatos españoles e ingleses en HTML pt-BR; «abril» y «agosto» (iguales en los dos idiomas) no cuentan |
| El espejo | `lib/test/espejo-portugues.ts`, `volcado-html.ts`, `vitest.config.ts` | `I18N_VOLCAR_PT=<carpeta>` rinde en portugués cada árbol inglés de las pruebas y lo pasa por la guardia (`_guardias.jsonl`); con `I18N_VOLCAR_TODO`, los árboles `pt` se apuntan en `_portugues.txt` |
| Space Eyes | `space-eyes/piezas.tsx` | `SIN_PREFIJO_HACE.pt` quita «há » o «hace » (lo que cae del español). `fijo()`/`cifra()` ya daban separadores pt-BR (rama no es/en) |

## 3 · El formato pt-BR (medido)

| Caso | Sale |
|---|---|
| `formatearDinero(1160, 'pt')` | `MX$ 1.160,00` (espacio normal U+0020, no el U+00A0 que pone `Intl` en pt-BR) |
| negativo / `formatMonto` | `-MX$ 1.160,00` / `(MX$ 1.160,00)` |
| millones / redondo / corto | `MX$ 1.234.567,50` / `MX$ 1.160` / `MX$ 1,2k` |
| instancia USD | `US$ 1.160,00` (**provisional**, P1) |
| nombre de la moneda | `Peso mexicano (MXN)` / `Dólar americano (USD)` |
| números | `1.160`, `1.160,5`, `12.345,7` (agrupación forzada como en italiano: pt-PT y otras versiones de ICU no agrupan cuatro cifras) |
| porcentaje | `55,0%` (**propuesta**) |
| fechas | `1 de dez. de 2026`; con hora `1 de dez. de 2026, 15:45` (**propuesta**, D4) |
| trimestre | `T1 2026` (**provisional**) |
| captura de cifras | **a la mexicana** (`separadorDecimal: '.'`, `comaDecimal('pt') === false`) — **pendiente del dueño** (P2): es dinero y los avisos caen al español |

`es`, `en` e `it` con su forma de siempre (fijado en `formato-portugues.test.ts`).

## 4 · El CHECK de la base: qué se hizo

`usuarios.idioma_preferido` y `tenants.idioma_documentos` tienen `check (… in
('es','en','it'))` (`db/migrations/20261103_usuarios_idioma_preferido.sql:51`,
`20261103_idioma_documentos_por_instancia.sql:73`). Con `pt` en `IDIOMAS`:

- `app/api/perfil/idioma` → `guardarIdiomaCtrl` validaba contra
  `idiomasActivos()`: con `IDIOMA_PORTUGUES=1` habría aceptado `pt` y el UPDATE
  habría muerto en el CHECK (500). **Ahora valida contra `idiomasDeCuenta()`**
  (los encendidos que caben en la base) y la tarjeta «Mi cuenta → Idioma» no
  ofrece «Português» (`IdiomaCuenta.tsx`, filtro `esIdiomaEnLaBase`). El
  portugués se consigue con el selector o «Usar el idioma del navegador».
- `idiomaDocumentosPedido` (`idioma-alta.ts`) validaba contra `IDIOMAS`:
  habría aceptado `pt` en el alta y el INSERT habría muerto en el CHECK.
  **Ahora valida contra `IDIOMAS_EN_LA_BASE`**, con el mismo 400 y mensaje.
- `idiomaDeLaInstancia()`, `resolverIdiomaDocumentosDeAlta()` y
  `lib/contrato-documento.ts` usan el tipo **`IdiomaEnLaBase`**: `tsc` impide
  pedir un contrato en portugués. En el redactor solo cambian el import y un
  comentario; su huella (`textos/arrendadores.test.ts`) se actualiza a
  propósito y los hashes españoles de `contrato-documento-idioma.test.ts`
  siguen en verde.
- Lectura (login, código, layout): sin cambios; la base no puede devolver `pt`.
- `infra/scripts/provision-instancia.sh:238` ya rechazaba `--idioma pt`.

**Dependencia de la tarea roja (P3):** migración que abra los dos CHECK,
`IDIOMAS_EN_LA_BASE` → `IDIOMAS` (y con ello `idiomasDeCuenta` =
`idiomasActivos`), `--idioma pt` y los papeles en portugués. Las pruebas que la
fijan (`idiomas-portugues.test.ts` «el portugues NO llega a la base»,
`idioma-controller.test.ts`, `IdiomaCuenta.test.ts`) cambian a propósito ahí.

## 5 · Prueba primero, en rojo

Con las pruebas escritas y sin implementación (`idiomas-portugues`,
`formato-portugues`, `cobertura-portugues`, `errores-servidor-portugues`,
`guardias-portugues`, `espejo-portugues`, `catalogos-portugues`, el bloque del
portugués en `pantallas.test.ts` e `IdiomaCuenta.test.ts`):

```
 Test Files  9 failed (9)
      Tests  40 failed | 58 passed (98)
Error: Cannot find module './cobertura-portugues'
Error: Cannot find module './guardias-portugues'
Error: Cannot find module '/lib/test/espejo-portugues'
TypeError: portuguesActivo is not a function
TypeError: idiomasDeCuenta is not a function
TypeError: Cannot read properties of undefined (reading 'posicionSimbolo')
TypeError: SIN_PREFIJO_HACE[idioma] is not a function
AssertionError: expected [ 'es', 'en', 'it' ] to deeply equal [ 'es', 'en', 'it', 'pt' ]
AssertionError: expected 'Not found' not to be 'Not found'
AssertionError: expected 'Email: This field is required' to be 'Correo: Este dato es obligatorio'
AssertionError: expected '<html lang="es" …' to match /<html[^>]*lang="pt"/
AssertionError: expected '<div class="rounded-md border border-…' not to contain 'value="pt"'
```

(los dos últimos: el error del servidor en `pt` caía al INGLÉS, y la tarjeta de
la cuenta ofrecía `pt`). Las 58 que ya pasaban son las de siempre de
`pantallas.test.ts` / `IdiomaCuenta.test.ts` y los negativos que ya se
cumplían (p. ej. el alta ya rechazaba `pt` porque no existía).

## 6 · Español, inglés e italiano idénticos (medido)

- **Volcado completo** (`I18N_VOLCAR_TODO`) de toda la suite antes (árbol
  limpio en `a7953731`) y después: 5238 → 5245 HTML. `diff -rq`: **0 distintos,
  0 desaparecidos**; 7 nuevos, todos de las pruebas nuevas del portugués
  (`pantallas.test.ts` 3 carpetas, `IdiomaCuenta.test.ts` 1, `espejo-portugues`
  2 + su `_portugues.txt`). `_italiano.txt` difiere solo en el ORDEN de las
  líneas (lo escriben los hilos en paralelo): ordenado, idéntico (1837).
- **`DICCIONARIOS.es/.en/.it`**: 5633 → 5634 claves cada uno, **0 valores
  cambiados, 0 quitados**; la única clave nueva es `idioma.pt` = «Português».
- **`traducirError`** es/en/it sobre los 235 mensajes del catálogo y los
  `Campo: Requerido`: **0 cambiados** tras generalizar la lógica del italiano.
  Además, toda `errores-servidor-italiano.test.ts` sigue en verde.

## 7 · Lo que mide el espejo

El espejo portugués sobre las pruebas de pantallas (`I18N_VOLCAR_PT`, **2147
estados**) da hoy **309 huellas de formato en 39 estados**, todos de tres
archivos y de tres clases, ninguna de la maquinaria:

| Archivo | Estados | Huellas | Clase |
|---|---:|---:|---|
| `pantallas-propuestas.test.ts` | 9 | 204 | El **documento imprimible** (Server Component): su idioma lo fija el simulacro de la prueba (`servidor.idioma`) y el del papel es el de la instancia; el espejo no puede cambiarlos («Nov 30, 2026», «6,612.00», «20 de octubre») |
| `pantallas-inventario-arrendadores.test.ts` | 18 | 81 | El **documento del contrato** (papel en el idioma de la instancia, P3) y el navegador del firmante («Mozilla/5.0», un dato) |
| `pantallas-comercial.test.ts` | 12 | 24 | Los **ejemplos de captura** del alta de pantalla («Ej. 12.9», «7.2»), que caen al español y siguen la captura a la mexicana (P2) |

Por tipo: cifra con punto decimal 110, coma de millar 54, fecha en inglés 49,
dinero sin prefijo 33, fecha larga en español 29, «a. m.» 15, dd/mm/aaaa 14,
AM/PM 5. Detalle por estado en `_guardias.jsonl` de la corrida. Es el punto de partida de cada lote: los lotes que traduzcan esos
ámbitos rendirán sus estados en `pt` y los declararán o arreglarán.

> [!warning] El espejo de TODA la suite se cuelga en `cifras-formularios.test.ts`
> Como el italiano (diario del 05/11): con el espejo, ese archivo no termina.
> Se corre excluyéndolo (y `middleware.test.ts`):
> `I18N_VOLCAR_PT=<carpeta> npx vitest run --exclude '**/cifras-formularios.test.ts' --exclude 'middleware.test.ts' --exclude '**/node_modules/**' --exclude '**/*.e2e.test.ts'`.

## 8 · Suites

- `cd apps/web && npm run typecheck`: limpio.
- `cd apps/web && npm test`: **418 archivos, 8741 en verde + 1 omitida** (la
  base `a7953731` daba 411 archivos, 8649 + 1).
- Sin e2e: no se toca base, sesión, auth ni middleware.
- **Mutantes (9/9 muertos)**: el controlador de la cuenta vuelve a
  `idiomasActivos()` (11 rojas); `DICCIONARIOS.pt` cae al inglés (9);
  `traducirError` en `pt` cae al inglés (6); `portuguesActivo` acepta cualquier
  valor (4); `idiomasPorOmision` deja pasar el portugués apagado (6); la
  tarjeta de la cuenta sin el filtro (1); el alta acepta `pt` (1); la guardia
  cuenta «abril/agosto» como español (2); `separadorDecimal` del portugués a
  `','` (1).
- `node scripts/recuentos.mjs`: 160 endpoints, 66 tablas, 125 migraciones, ADR
  hasta 0049, **118 notas, 1679 enlaces**, 3 wikilinks rotos (los ADR de
  siempre), 0 huérfanas.

## 9 · Lo que esta ola NO hizo, a propósito

- No traduce la interfaz (salvo el selector).
- No extiende `textos/costura.test.ts` al portugués: con 0 claves no hay nada
  que coser. Se extiende con el primer lote.
- No crea el barrido global (`barrido-italiano.ts`) del portugués: lo
  necesitarán los lotes y el recorrido; el espejo cubre la ola 0.
- No toca las ramas `=== 'it'` que son del italiano a propósito: el CSV del
  estado de cuenta con «;» (`estado-cuenta-csv.ts:55`, en Brasil Excel también
  espera «;»: decisión de L4), el `alt` «preview» del alta manual
  (`NuevaPantallaForm.tsx:435`, de L3), la cantidad del panel de firmas
  (`PanelFirmas.tsx:412`, papel), y las notas de versión (`novedades.ts:100`:
  el portugués cae a `texto`, el español, como manda D3).

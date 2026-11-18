# Validación · Ola 0 del portugués (la infraestructura)

**Fecha:** 2026-11-05 · **Rama validada:** `feat/portugues-base` (`9b049a63`, 4
commits sobre `a7953731`) · **Base de comparación:** `a7953731`
(`integra/portugues` = `verificacion`) · **Validador independiente:** no recibió
el razonamiento del autor; leyó el diff y repitió las mediciones en los dos
árboles.

## Veredicto: VERDE (con dos observaciones menores y tres notas)

El código hace lo que el encargo pide. Español, inglés e italiano salen
idénticos, medido en los dos árboles. `pt` no tiene ningún camino de escritura
hacia las dos columnas con CHECK. El interruptor es propio y exacto. La caída va
al español y vive en un solo sitio. Los 6 mutantes propios mueren. Nada de lo
encontrado bloquea la ola 0; H1 conviene dejarlo escrito antes del primer lote.

## 1 · Suites

| Medición | Resultado |
|---|---|
| `cd apps/web && npm run typecheck` | limpio (código 0) |
| `cd apps/web && npm test` | **418 archivos, 8741 en verde + 1 omitida** (lo mismo que dice la revisión) |
| e2e | no corridas: el diff no toca base, sesión, auth ni middleware (comprobado: ninguna ruta de `db/`, `middleware`, `auth`, `schema`, `package*`, `next.config`, `aislamiento.e2e`, `servidor-e2e` en `git diff --name-only`) |
| `node scripts/recuentos.mjs` | 118 notas, 1679 enlaces, 3 rotos (los ADR de siempre), 0 huérfanas: cuadra con `CLAUDE.md` |
| Marcadores de conflicto (`git grep "^<<<<<<< "`) | ninguno |

## 2 · Español, inglés e italiano idénticos (medido)

| Medición | Resultado |
|---|---|
| Volcado de **todo** el HTML de las pruebas (`I18N_VOLCAR_TODO`), excluido `cifras-formularios.test.ts`: `a7953731` en un worktree temporal contra `9b049a63` | 4726 → 4733 `.html`. `diff -rq`: **0 distintos, 0 desaparecidos**. Los 7 nuevos: 3 de `pantallas.test.ts`, 1 de `IdiomaCuenta.test.ts`, 2 de `espejo-portugues.test.ts` y `_portugues.txt`. `_italiano.txt` difiere solo en el orden; ordenado, idéntico (1599 líneas) |
| `DICCIONARIOS.es` / `.en` / `.it` (5633 claves cada uno en la base) | **0 valores cambiados, 0 quitados**; 1 clave nueva en cada uno, `idioma.pt` |
| `traducirError` es/en/it sobre 1558 mensajes (catálogo, `lib`, catálogo italiano, `Campo: motivo` con todos los campos de `CAMPO_EN`/`CAMPO_IT` × 35 motivos, y cada literal de las pruebas `errores*.test.ts` de la base) | **0 distintos** (y 1276 de ellos difieren entre `it` y `en`, así que la comparación ejerce la rama italiana generalizada a `errorEnTablas`) |

Mis recuentos de HTML no coinciden con los de la revisión (5238 → 5245): el
delta (+7) y el resultado (0 distintos) sí. No lo atribuyo a nada concreto;
probablemente el conjunto de exclusiones, que no era el mismo.

## 3 · Lo que encendido y apagado hacen

- `portuguesActivo` solo acepta `'1'` exacto (`lib/i18n/idiomas.ts:115`);
  `idiomasActivos` (`:131`) e `idiomasPorOmision` (`:184-189`) lo consultan
  por separado. Mutante M1 (`IDIOMA_PORTUGUES` enciende también el italiano):
  **muere** (5 rojas).
- Apagado: `servidor.ts`, `_error.tsx` y el layout pasan `idiomasActivos()`;
  una cookie `pt` o un `Accept-Language: pt-BR` se ignoran. El selector solo
  pinta `disponibles`. `global-error.tsx:37` acepta `IDIOMAS` pero lee el `lang`
  que el servidor ya decidió. Correcto.
- Caída: `DICCIONARIOS.pt = conCaidaAlEspanol(ES, PT)` (`diccionario.ts`) y
  `traducirError(m, 'pt') = errorEnTablas(TABLAS_PT, m) ?? m`
  (`errores-servidor.ts:2071`). Un único sitio cada una.
- Ramas `=== 'it'` / `!== 'es'` revisadas (101 coincidencias de
  `idioma === 'es' ?`/`!== 'es'`): todas pasan por `traducir()` o por el
  formato, así que `pt` recibe español o formato pt-BR, nunca un literal
  inglés. Las cuatro `=== 'it'` que quedan (`novedades.ts:100`,
  `estado-cuenta-csv.ts:55`, `NuevaPantallaForm.tsx:435`, `PanelFirmas.tsx:412`)
  le dan a `pt` exactamente lo que le dan al español.
- Correos (`email.ts`, `propuesta-correo.ts`, `correo-recordatorios.ts`): van
  en el idioma de la instancia, que es `IdiomaEnLaBase`; no pueden salir en `pt`.

## 4 · `pt` no llega a la base (medido en el código)

Escritores de las dos columnas con CHECK:

| Camino | Valida contra | Con `pt` |
|---|---|---|
| `PUT /api/perfil/idioma` → `guardarIdiomaCtrl` (`idioma-controller.ts:40`) → `guardarIdiomaPreferido` (`usuarios-repo.ts:404`, el único UPDATE de `idioma_preferido`) | `idiomasDeCuenta()` | 400, la base ni se toca |
| Alta (`cuentas-controller.ts:159`, `:197`) → `idiomaDocumentosPedido` (`idioma-alta.ts:27`) → `crearTenant` (`tenant.ts:119`, el único INSERT de `idioma_documentos`) | `esIdiomaEnLaBase` | 400 |
| Aprovisionamiento (`provision-instancia.sh`) | su propia lista | ya rechazaba `--idioma pt` |
| `bootstrap-auth.mjs` | no escribe la columna | — |
| Login, código, Google | solo LEEN `idioma_preferido` | — |
| Cookies | `spaces_idioma` y la de la cuenta son cookies, no columnas | — |
| Server actions | no hay ninguna (`'use server'`: 0) | — |

Mutante M4 (`IDIOMAS_EN_LA_BASE` admite `pt`): **muere** (4 archivos en rojo).

**Contrato firmado:** los cambios de `lib/contrato-documento.ts` y
`app/(app)/contrato/[id]/page.tsx` son solo de tipo y comentario. Transpilado
con `typescript.transpileModule` sin comentarios, el JS de los dos archivos es
**idéntico** al de `a7953731`; los hashes de `contrato-documento-idioma.test.ts`
siguen en verde. Ningún hash de un contrato firmado puede cambiar.

## 5 · Mutantes propios (contra unitarias, árbol restaurado y limpio después)

| # | Mutante | Resultado |
|---|---|---|
| M1 | `idiomasActivos`: `it: italianoActivo(e) \|\| portuguesActivo(e)` | **muere** (5: `idiomas-portugues`, `pantallas`, `idioma-controller`) |
| M2 | `DICCIONARIOS.pt = conCaidaAlIngles(EN, PT)` | **muere** (9: `catalogos-portugues`, `cobertura-portugues`, `pantallas`, `espejo-portugues`) |
| M3 | `motivoEnTablas` sin `if (sinTraducir) return null` (un patrón a medias) | **muere** (2: `errores-servidor-italiano` y `errores-servidor-portugues`) |
| M4 | `IDIOMAS_EN_LA_BASE` con `'pt'` | **muere** (8: `idiomas-portugues`, `idioma-controller`, `IdiomaCuenta`) |
| M5 | `conCaidaAlEspanol` acepta `''` como traducido | **muere** (1: `cobertura-portugues`) |
| M6 | `FORMATO_IDIOMA.pt.posicionSimbolo = 'intl'` (el U+00A0 de `Intl`) | **muere** (7: `formato-portugues`, `guardias-portugues`, `catalogos-portugues`) |

Ruido, no del cambio: `scripts/semilla-catalogo-demo.test.ts` agota sus 5 s
cuando la máquina va cargada (pasó en el volcado y en varios mutantes); en un
`npm test` normal pasa. La primera corrida de M6 en la suite entera dio 50
rojas en archivos sin relación con solo 3304 pruebas ejecutadas: corrida
degradada; repetida sobre `lib/i18n`, 7 rojas y todas del portugués.

## 6 · Hallazgos

**H1 · MENOR · con una preferencia de cuenta guardada, el portugués no se
alcanza después de entrar.** `resolverIdioma` pone la cuenta por delante de la
cookie (`lib/i18n/idiomas.ts:300-301`); la tarjeta «Mi cuenta → Idioma» no
ofrece `pt` (`components/demo/admin/IdiomaCuenta.tsx:148`), y el selector solo
existe en el login (`app/(app)/login/page.tsx:409`). Escenario: con
`IDIOMA_PORTUGUES=1`, una persona que guardó «Español» en su cuenta elige
«Português» en el login → entra → la cookie de la cuenta (`es`) gana y la
pantalla sale en español. Para tener portugués tiene que elegir antes «Usar el
idioma del navegador». La revisión (§4) y el comentario de
`idioma-controller.ts:15-20` dicen «se consigue con el navegador o el
selector», que solo es cierto sin preferencia guardada. No afecta a nadie
mientras el interruptor esté apagado y desaparece con la tarea roja (P3). Pide
una línea en el tablero, o en la ayuda de la tarjeta, antes del recorrido en
navegador.

**H2 · MENOR (tipo) · `crearTenant` sigue aceptando `Idioma`.**
`lib/server/tenant.ts:108`: `idiomaDocumentos: Idioma = IDIOMA_POR_OMISION`.
Su único llamador (`cuentas-controller.ts:102`) ya pasa `IdiomaEnLaBase`, así
que hoy no hay camino; pero un llamador nuevo podría pasar `'pt'` sin que `tsc`
diga nada y el INSERT moriría en el CHECK con un 500. Es el único eslabón de la
cadena de escritura que no se pasó a `IdiomaEnLaBase`.

**H3 · NOTA · `<html lang="pt">`, no `pt-BR`.** `app/layout.tsx:101` escribe la
clave del idioma. Para el italiano da igual; para el portugués, `pt` a secas no
dice qué variante es (lectores de pantalla, guionado, traductor del navegador).
Propuesta para el lote L5 o el recorrido: `lang={localeDe(idioma)}` o un mapa.

**H4 · NOTA · el CSV del estado de cuenta en portugués usa `,` y punto
decimal** (`components/demo/finanzas/estado-cuenta-csv.ts:56-58`). Es coherente
y la revisión lo declara a propósito (decisión del lote L4); un Excel con
configuración brasileña lo abrirá en una sola columna, como le pasaba al
italiano. Queda para el lote.

**H5 · NOTA · mis recuentos del volcado no son los de la revisión** (§2). El
resultado coincide; las cifras absolutas no son comparables entre corridas con
exclusiones distintas.

## 7 · Lo que no medí

- Las e2e (no aplica, §1) ni el navegador real: ni el selector, ni la cookie, ni
  `<html lang>` en un servidor encendido con `IDIOMA_PORTUGUES=1`.
- El espejo portugués (`I18N_VOLCAR_PT`): no repetí las 309 huellas de §7 de la
  revisión.
- Los mutantes no se corrieron contra e2e.
- No revisé el contenido de las 6 claves de `PT_BASE` más allá de que
  «Português», «Idioma» y «Mudar idioma» son portugués correcto con «você».

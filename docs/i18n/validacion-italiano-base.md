# Validación · Ola 0 del italiano (la infraestructura)

**Fecha:** 2026-11-03 · **Rama validada:** `feat/italiano-base` (`6779321d`, 11
commits) · **Base de comparación:** `a89bd217` (`integra/ingles`; la antigua
`integra/italiano` era idéntica y hoy todo va a `integra/idiomas`) · **Validador
independiente:** no recibió el razonamiento del autor; revisó el código y repitió
las mediciones.

## Veredicto: VERDE (con tres huecos de prueba, ninguno de comportamiento)

El código hace lo que promete. Español e inglés salen idénticos, medido por mí
en los dos árboles. Los tres mutantes que sobreviven son huecos de las pruebas,
no defectos del código: conviene cerrarlos antes del primer lote (§7).

## 1 · Español e inglés idénticos

| Medición (repetida por el validador) | Resultado |
|---|---|
| Volcado de **todo** el HTML de las pruebas (`I18N_VOLCAR_TODO`): base `a89bd217` con el arnés copiado en un worktree temporal, contra la rama | 3021 archivos en la base y 3027 en la rama. `diff -rq`: **0 distintos, 0 desaparecidos**. Los 6 nuevos salen de las pruebas nuevas: 4 del selector en `pantallas.test.ts` y 2 de `espejo-italiano.test.ts` (la revisión dice «4 nuevos»: le faltan los 2 del espejo) |
| `DICCIONARIOS.es` / `.en` (5589 claves en la base) | **0 valores cambiados**, 0 quitados; 1 clave nueva, `idioma.it` |
| `traducirError` es/en sobre 846 mensajes (catálogo, `lib`, `Campo: motivo` con 30 campos × 6 motivos, mensajes de firma) | 0 cambiados |
| Formatos es/en, en las dos ramas y con instancia MXN y USD: `formatearDinero` (con y sin decimales), `formatearDineroRedondo`, `formatearNumero`, `formatMonto`, `formatMontoCorto`, `formatNumero`, `formatoPorcentaje`, `formatoCelda` (entero, horas, kWh, m², dinero), `etiquetaCantidad`, `etiquetaFrecuencia`, `textoReproducciones`, `formatearFecha`, `formatFecha`, `formatFechaHora` (con fechas inválidas y vacías), `etiquetaBucket` (4 granularidades), `etiquetaPeriodo` de finanzas, símbolo, nombre de la moneda y locale. Valores probados: 0, −0, NaN, ±∞, negativos, −0.004, 999 999.995, 1e12 y otros | 128 líneas, **byte a byte iguales** |
| Base del cambio de `'es-MX'` fijo a `localeDe(idioma)`: `es-MX` contra `en-US` con 7 juegos de opciones sobre 300 000 cifras aleatorias más casos borde | 2 100 140 formatos, **0 diferencias** (Node 24.19, ICU 78.3) |
| Las bifurcaciones de fecha (`idioma === 'en'` → `idioma !== 'es'`) | En `en` llevan el mismo locale y las mismas opciones. La etiqueta semanal de Disponibilidad (`m/d` armada a mano → `toLocaleDateString('en-US', {month, day numeric})`) sale «3/1» igual |

Las pruebas que la rama toca (`idiomas.test`, `dinero.test`, `inicio.test`,
`pantallas-inventario-arrendadores.test`) solo amplían tipos o la cadena fuente
que buscan. No se debilitó ninguna aserción.

## 2 · El interruptor

- `italianoActivo` solo enciende con el valor exacto `'1'` (`lib/i18n/idiomas.ts:93`).
  `idiomasActivos` es el único sitio que lo consulta (`idiomas.ts:105`).
- `idiomaDeLaPeticion` (`lib/i18n/servidor.ts:83`), `pages/_error.tsx:23` y el layout
  (`app/layout.tsx:93`) leen `idiomasActivos()` y pasan `permitidos`. Con el
  italiano apagado, una cookie `it` es basura y se cae a la cabecera; en
  `Accept-Language: it, en;q=0.5` se salta el `it`. Es la misma conducta que
  tenía la base, cuando `it` no existía.
- El selector solo pinta `disponibles` (`SelectorIdioma.tsx:54`).
- `global-error.tsx:34` llama a `normalizarIdioma` sin `permitidos`, pero lee el
  `lang` del `<html>`, que ya decidió el servidor. Correcto.
- No se tocaron `middleware.ts`, `nav.ts`, auth, migraciones, `schema.sql`,
  `db.ts`, `package.json` ni `next.config.mjs` (comprobado en el diff).

> [!note] Valor por omisión que obliga a disciplina
> `resolverIdioma`, `normalizarIdioma` e `idiomaDeCabecera` aceptan por omisión
> **todo** `IDIOMAS`, `it` incluido. Hoy todos los que deciden pasan
> `permitidos`. Un llamador nuevo que lo olvide dejaría pasar el italiano
> apagado sin dar ningún error: el mutante V5 (§7) lo demuestra con
> `_error.tsx`. Quizá convenga que el valor por omisión sea `idiomasActivos()`.

## 3 · La caída al inglés

- `conCaidaAlIngles(EN, IT)` (`diccionario.ts`): una clave sin italiano o con `''`
  sale en inglés. Hoy `DICCIONARIOS.it` tiene 0 valores vacíos y solo difiere de
  `en` en `idioma.etiqueta` e `idioma.cambiar`. Nunca sale en español ni como clave cruda.
- Errores: `errorEnItaliano` (`errores-servidor.ts:1164`) devuelve `null` si falta
  una pieza, y entonces el mensaje entero sigue la ruta inglesa. Los patrones
  sin `huecosIt` también caen enteros al inglés (el mutante V10 muere).
- Observación menor: en tiempo de ejecución, una entrada `''` en
  `CATALOGO_ERRORES_IT` o `CAMPO_IT` se tomaría como traducción (`!== undefined`).
  No llega a la pantalla porque `problemasItaliano()` la rechaza en la prueba.

## 4 · El formato italiano (medido)

| Caso | Sale |
|---|---|
| `formatearDinero(1160)` | `MX$ 1.160,00` |
| negativo | `-MX$ 1.160,00` (`formatMonto`: `(MX$ 1.160,00)`, la convención de siempre de esa función) |
| cero / −0 / −0,004 | `MX$ 0,00` / `-MX$ 0,00` / `-MX$ 0,00`: el mismo signo que ya ponía `Intl` en es y en |
| millones / sin decimales | `MX$ 1.234.567,89` / `MX$ 1.234.568` |
| instancia USD | `US$ 1.160,00` (provisional, P1) |
| `formatMontoCorto` | `MX$ 1,2k`, `MX$ 4,9M`, `MX$ 1M` (999 999), `MX$ 1.234,5M`, `(MX$ 2,5k)`, `MX$ 0` |
| números | `1.160`, `1.234.567,5`, `0,5`, `-3` |
| porcentaje | `0,5%`, `1.160,0%` |
| fechas | `1 dic 2026`; con hora `1 dic 2026, 15:45`; trimestre `T1 2026`; mes `gen`; semana `12 gen` |

Todo coincide con la decisión del dueño («1 dic 2026», «MX$ 1.160,00»).

## 5 · La infraestructura sirve a los lotes

- Cada `IT_<AMBITO>` está tipado `Partial<Record<Clave<Ámbito>, string>>` en su
  propio archivo, así que un lote no puede escribir claves de otro.
- La cobertura suma exactamente `CLAVES.length` en las filas de interfaz y no
  cuenta los vacíos (muere V14).
- La costura del italiano tolera vacíos y muerde con un italiano distinto para
  el mismo español (muere V17).
- La guardia caza formatos españoles e ingleses (mueren V13 y V18), y lo que
  escriben los formateadores italianos pasa limpio. Un posible falso positivo
  a conocer: `fecha dd/mm/aaaa` marcaría también una fecha numérica italiana
  («01/12/26», `dateStyle: 'short'`). Hoy es coherente porque el dueño eligió
  «1 dic 2026», pero un lote que use fechas numéricas tendrá que declararlas
  en `permitidos`. Una versión de dos partes («v0.12») también saltaría como
  «cifra con punto decimal».

## 6 · El enganche para el idioma de la instancia (tarea ROJA)

Nada de lo nuevo lo impide. `traducir(idioma, …)`, `traducirError`,
`formatearDinero`, `localeDe` y `numeroEnIdioma` reciben el idioma como
parámetro y funcionan en el servidor sin petición. `DICCIONARIOS.it` se arma al
cargar el módulo y no depende del interruptor, así que un contrato en italiano
se podría generar aunque la interfaz italiana esté apagada. Los puntos de
enganche de la revisión §6 existen. `contrato-documento.ts` sigue en español
literal, como dice la revisión.

## 7 · Mutantes del validador (20, distintos de los del autor; todos restaurados)

Corrida: `npx vitest run` completo por cada mutante.

| # | Mutante | Resultado |
|---|---|---|
| V1 | `italianoActivo` acepta cualquier valor no vacío | muere (`idiomas-italiano`) |
| V2 | `normalizarIdioma` ignora `permitidos` | muere |
| V3 | `idiomaDeCabecera` no pasa `permitidos` | muere |
| V4 | `servidor.ts` no pasa `permitidos` | muere |
| **V5** | **`pages/_error.tsx` no pasa `permitidos`** | **SOBREVIVE**: ninguna prueba ejerce `_error` con una cookie `it` y el italiano apagado. Con el inglés encendido, la página 404/500 saldría en italiano |
| **V6** | **`cambiarIdioma` acepta un idioma fuera de `disponibles`** | **SOBREVIVE**: ninguna prueba llama a `cambiarIdioma('it')` con el italiano apagado. Impacto bajo: el selector no lo ofrece y el servidor ignora la cookie |
| V7 | el layout no pasa `disponibles` | muere (`pantallas`) |
| V8 | caída al **español** en vez de al inglés | muere |
| **V9** | **`Campo: motivo` con el motivo en italiano y el campo sin él → campo inglés + motivo italiano** | **SOBREVIVE**: `errores-servidor-italiano.test.ts:61` prueba campo-sí/motivo-no, pero no motivo-sí/campo-no. La mezcla «a medias» que la regla prohíbe no tiene prueba en ese sentido |
| V10 | patrón con hueco sin `huecosIt` se acepta | muere |
| V11 | signo detrás del símbolo (`MX$ -1.160,00`) | muere |
| V12 | italiano sin agrupar cuatro cifras (`1160`) | muere |
| V13 | guardia sin «cifra con coma de millar» | muere (`guardias-italiano`) |
| V14 | la cobertura cuenta los `''` | muere |
| V15 | `formatFecha('it')` por la rama española | muere |
| V16 | el espejo no cambia la propiedad `idioma` de los hijos | muere (`espejo-italiano`) |
| V17 | la costura cuenta los vacíos | muere |
| V18 | guardia sin «moneda equivocada» | muere |
| V19 | `idiomasActivos` ignora el italiano | muere |
| V20 | letra del trimestre italiana `Q` | muere |

**17 de 20 mueren.** Los 3 que sobreviven no son equivalentes: son pruebas que
faltan. Arreglo propuesto, de una prueba cada uno:

- `_error`: con `IDIOMA_INGLES=1`, sin `IDIOMA_ITALIANO` y con la cookie `it`, que la página salga en español o en inglés y no en italiano.
- `ProveedorIdioma` con `disponibles: ['es','en']`: que `cambiarIdioma('it')` no cambie nada.
- `CATALOGO_ERRORES_IT` con el motivo y sin `CAMPO_IT`: que el resultado sea igual al inglés.

## 8 · Suites y recuentos

Medido en un worktree aislado de `6779321d`, para no reconstruir el `.next` del
worktree de trabajo:

- `npm run typecheck`: limpio.
- `npx vitest run --testTimeout=60000`: **383 archivos, 6988 pruebas, en verde**.
  La base daba 375 y 6901.
- `npm run build`: limpio.
- `node scripts/recuentos.mjs`: 159 endpoints, 66 tablas, 123 migraciones, ADR hasta
  0048, 114 notas, 1629 enlaces, 3 wikilinks rotos (los ADR de siempre) y 0
  huérfanas. Coincide con `CLAUDE.md`. Sin marcadores de conflicto.

## 9 · Lo que no comprobé

- Las e2e (`npm run test:e2e`): la ola 0 no toca sesión, tenant, dinero en base
  ni migraciones, y el encargo no las pedía.
- El espejo italiano (`I18N_VOLCAR_IT`): no repetí las 358 huellas de la revisión §5.
- El navegador: no hubo recorrido, y la ICU del navegador puede diferir de la de
  Node en `it-IT`.
- El `useGrouping: 'always'` en navegadores viejos: no lo probé.

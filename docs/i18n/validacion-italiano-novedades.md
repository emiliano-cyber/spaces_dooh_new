# Validación · notas de versión en inglés e italiano, y B82

- **Rama:** `feat/italiano-novedades` (`01b9c273..d52b7d88`, 7 commits sobre `integra/idiomas` `e6c8ca43`).
- **Fecha:** 2026-11-05. **Validador independiente**: sin el razonamiento del autor; se revisó el código y se midió.
- **Base de comparación:** el worktree `.claude/worktrees/integra-ingles`, que está en `e6c8ca43` exacto y limpio.
- **No se hizo:** e2e ni servidores (memoria; los del dueño en 3600/3601 no se tocaron). Ningún proceso de vitest se quedó colgado.

## Veredicto: VERDE

El mecanismo hace lo que dice, el español no cambia (ni en las notas ni fuera de ellas) y la decisión de B83 es correcta. Lo que sigue son matices de redacción en italiano, una justificación imprecisa en tres comentarios y dos mutantes casi equivalentes; nada bloquea la integración.

## 1 · Notas de versión

| Comprobación | Resultado |
|---|---|
| `texto` español de los 110 items contra `e6c8ca43` (script propio: entradas reducidas a `{version, fecha, items:[{tipo, texto}]}`) | **idéntico**; 18 entradas en las dos; 110/110 items con `en` y con `it`; claves de item solo `tipo, texto, en, it` |
| Caída (`lib/novedades.ts`, `textoDeItem`) | es → `texto` siempre; en → `en \|\| texto`; it → `it \|\| en \|\| texto`. Correcto |
| `verificar-novedades.mjs` sobre el archivo real | `v0.12.5` → 0 (sin `::warning::`: todo traducido); versión sin entrada → 1; sin argumento → 2. Igual que antes |
| `release.yml` | intacto (`git diff e6c8ca43..HEAD -- .github` vacío) |
| Traducción vacía | invalida (`novedades-reglas.mjs`, el bucle de `TRADUCCIONES_ITEM`); probada en `verificar-novedades.test.ts` (sale 1) |

### La decisión de quitar `en`/`it` de `notas_disponibles` (B83): correcta

Leído el código de la versión vieja: `GET /api/actualizaciones` pasa la columna por `entradaValida()` (`app/api/actualizaciones/route.ts:77` → `lib/novedades.ts`), que llama a `erroresDeEntrada()`; en `e6c8ca43` esa función tiene `CLAVES_ITEM = ['tipo', 'texto']` y marca como error cualquier otra clave. Con un `en` dentro, la app vieja recibe `null`. La sonda que escribe la columna corre en la imagen nueva (`infra/scripts/update.sh:1921-1922`). Quitar las traducciones ahí es lo correcto.

**Imprecisión en la descripción (menor):** el comentario (`scripts/actualizaciones.mjs:82`), B83 (`docs/Supervision/ABIERTOS.md:2781`) y la bóveda (`vault/02-Backend/notas-de-version.md:178`) dicen que el dueño vería «Esta versión no trae notas». **No es eso:** desde v0.11.2, con `notasDisponibles` en `null` el panel ni siquiera llama a `NotasDeVersion`. Enseña la ALARMA de `avisoSinNotas` («la versión llegó sin notas, repórtalo antes de aprobarla»; `components/demo/admin/actualizaciones-ui.ts:130-134`, `ActualizacionesPanel.tsx:210-218`). Eso es peor que lo descrito y justifica la decisión con más razón. Conviene corregir la frase en los tres sitios. El resto de B83 (cómo se cierra, quién) está bien.

### Calidad de las traducciones

Leídos los 110 items en los dos idiomas. Los nombres del menú y de las pantallas coinciden con el diccionario: Settings/Impostazioni, Sales/Vendite, Lease negotiation/Negoziazione locazioni, Publication review/Convalida della pubblicazione, Screen history/Storico dei suoi schermi, «Only with availability»/«Solo con spazio libero», «Scheduled in its CMS», «Manca questo dato», What’s new/Novità. El tuteo, las « », el ’ y las cifras a la italiana (2.500, MX$ 1.234.567,50, 0,00%) son correctos. Las cifras del español se conservan, y la prueba lo vigila. El inglés es natural; nada que un nativo no diría, salvo un detalle.

Frases que un nativo italiano no diría (menores, de redacción, no de sentido):

| Línea de `apps/web/novedades.json` | Dice | Mejor |
|---|---|---|
| 94 (v0.12.5) | «avvisa **prima che il precedente va** fuori onda» | «prima che» pide subjuntivo, y además se lee como «avisa antes de que se baje». → «avvisa **in anticipo che** il precedente **andrà** fuori onda» |
| 766 (v0.9.2) | «**dal giorno 5 ottobre**… termina **il giorno 4** dicembre… **dal giorno 1 al giorno 31**» | ver abajo: «dal 5 ottobre… termina il 4 dicembre… dall’1 al 31» |
| 274 (v0.12.1) | «pubblicate **in data 21 ottobre**» | «pubblicate il 21 ottobre» (burocrático, no incorrecto) |
| 760, 766 | «non **si fa pagare**», «si **fa pagare** allo stesso modo» | «non viene addebitato», «si addebita allo stesso modo» |
| 532 | «nasce programmato per oggi» | calco de «nace»; «viene creato già programmato per oggi» |
| 676 | «accetta **i centesimi**» | se lee como céntimos de moneda; «accetta due decimali» |
| 22 | «**Scaduta**, il cliente non può più accettarla» | participio colgado; «Una volta scaduta, …» |
| 639 (en) | «the quantity **reads in** plays» | «the quantity is expressed in plays» |

**La regla de «sin artículo ante fecha» se aplicó donde no toca.** En `italiano-olas.md` (§5, l. 192 y el recuadro de la l. 266) la regla existe porque la fecha es un HUECO interpolado, y «il {fecha}» daría «il 8» sin elisión. En las notas las fechas son texto literal: «dal 5 ottobre», «il 21 ottobre» o «dall’1» son el italiano normal y no tienen ese problema. La prueba `novedades-idiomas.test.ts` («sin articulo delante de una fecha») lo prohíbe, y §14 lo registra como glosario («dal giorno 5 ottobre»). Recomendación: limitar la regla a los huecos y aflojar esa prueba para el texto literal. **No bloquea.**

**Anacronismo aceptable:** la línea 688 (v0.10.0) dice en español «código promocional», el nombre de entonces, y en/it lo traducen con el nombre de hoy («negotiation code»/«codice di negoziazione»). En cambio v0.11.9 conserva los nombres viejos a propósito. Es coherente con lo que hoy ve la persona; solo se apunta.

## 2 · B82 (`pintarCrudo`, `CampoCifra`)

- **Lo pintado coincide con lo que se manda, o se avisa:** correcto. Canónico → el camino de siempre. Lo que `Number()` entiende se pinta con `String(n)`, que es lo que manda `Number(x) || 0`. Lo que no entiende (`NaN`) se deja tal cual, con `aria-invalid`, `role="alert"` y el motivo italiano. Sondeado aparte: «1,500», «12,9», «1,50», «1.500,50», «2,500.75», «$1,5» → todos `ajeno: true` y sin cambiar el texto.
- **es/en sin cambio de idioma:** `pintarCrudo` devuelve `textoDesdeCrudo` en cuanto `!comaDecimal(idioma)`. `captura-cifra.es-en.test.ts` está sin tocar (`git diff` vacío) y su huella `e5240e24…` (`:85`) pasa. El volcado lo confirma (§3).
- **Residual (decisión del autor, documentada):** el aviso **no bloquea**. `cifraIlegible` solo mira `'NaN'` (`lib/captura-cifra.ts:386-388`), así que con «1,500» en rojo el formulario manda 0, como habría hecho en español. Es coherente con «lo que se manda no cambia», pero la persona puede guardar un 0 con el aviso a la vista. Si se quiere cerrar del todo, el sitio es `cifraIlegible`, a costa de cambiar lo que se manda.
- **Comentario impreciso (menor):** `components/demo/ui/CampoCifra.tsx:177-179` justifica `if (!ajeno)` en el `onBlur` diciendo que «1,500» «se leería 1,5». Medido: `textoAlSalir('1,500', {idioma:'it', decimales:0|2})` devuelve «1,500» sin tocar, porque la lectura es inválida. La guardia solo cambia casos cosméticos (« 1,5 » → «1,5», «$1,5» → «1,5» con 2 decimales). Es inofensiva, pero ninguna prueba la ejerce (M10 sobrevive).
- **¿Basta el «formulario mínimo»?** Para la lógica, sí. Usa el `EntradaCifra` real, que pasa de `<input>` a `CampoCifra` igual que en React (cambia el tipo de elemento en la misma posición, `CampoCifra` monta de nuevo y su `useState` inicial pasa por `pintarCrudo`). También usa el `ProveedorIdioma` real y el mismo `cifraIlegible` + `Number(x) || 0` del alta. Lo que no prueba es el cableado de cada diálogo real, aunque todos los usuarios de `EntradaCifra` repiten el mismo patrón. Tampoco se sabe si la interfaz deja cambiar de idioma con un modal abierto, cosa que el autor declara. Suficiente para cerrar B82 como «menor»; una pasada en navegador lo remataría.

## 3 · Español e inglés idénticos fuera de Novedades

- **Volcado `I18N_VOLCAR_TODO`** de la suite entera en `e6c8ca43` (worktree `integra-ingles`) y en la rama, y `diff -rq`. **Ningún archivo común difiere.** Base 5141 `.html`, rama 5214. Las únicas carpetas nuevas son 11 (2 de `NotasDeVersion.test.ts` y 9 del bloque «B82» de `cifras-formularios.test.ts`). `_italiano.txt`, comparado ordenado, solo añade 3 líneas (los estados italianos de `NotasDeVersion`).
- Sin `I18N_VOLCAR_IT`, como se pidió. No se comprobó si se cuelga.
- **Diccionarios:** `git diff e6c8ca43..HEAD -- apps/web/lib/i18n/textos apps/web/lib/i18n/diccionario.ts` está vacío: en `DICCIONARIOS.es` y `.en` no cambia ningún valor.

## 4 · Mutantes propios (12; 10 muertos, 2 sobreviven; todos restaurados, `git status` limpio)

Se corrieron contra 9 archivos de prueba: `novedades-idiomas`, `NotasDeVersion`, `verificar-novedades`, `actualizaciones`, `captura-cifra.italiano`, `captura-cifra.es-en`, `cifras-formularios`, `CampoCifra` y `EntradaCifra`; 164 pruebas.

| # | Mutante | Resultado |
|---|---|---|
| M1 | italiano sin caída al inglés (`it \|\| texto`) | muere |
| M2 | español pinta `en` si existe | muere |
| M3 | traducción de espacios válida (sin `.trim()`) | muere |
| M4 | el actualizador conserva `it` | muere |
| M5 | el aviso solo con más de 1 item sin traducir | muere |
| M6 | el aviso de traducción sale con código 1 | muere |
| M7 | `NotasDeVersion` sin pasar el idioma | muere |
| M8 | `pintarCrudo` sin la guardia de idioma | muere (la huella es/en) |
| M9 | crudo ajeno pintado con `textoDesdeCrudo` | muere |
| M10 | `onBlur` canoniza aunque sea ajeno | **sobrevive**: casi equivalente (ver §2) |
| M11 | teclear no quita el aviso | muere |
| M12 | `Number.isFinite` → `!Number.isNaN` | **sobrevive**: solo cambia «Infinity»/«1e999», que no se prueban; equivalente en la práctica |

## 5 · Suites

- `npm run typecheck`: limpio.
- `npx vitest run --testTimeout=60000`: **409 archivos, 8586 en verde + 1 omitida** (coincide con lo que declara el autor).
- `npm run build`: en una copia (`git archive HEAD` en el scratchpad, con uniones a los `node_modules` de `italiano-pulido`), para no tocar el `.next` del worktree: **en verde** (exit 0). Hubo un único aviso, `EPERM` al copiar `standalone/node_modules`, causado por la unión de la copia y no por el código. Las frases de las notas (es, en, it) **no aparecen en `.next/static`**: buscadas literalmente, 0 archivos. `novedades.json` sigue siendo solo del servidor.

## 6 · La revisión del autor, comprobada

`docs/i18n/revision-italiano-novedades.md` cuadra con lo medido: los commits, el formato, las caídas, los códigos de salida, el volcado (5142 → 5215 en su cuenta, un archivo más que la mía porque incluye `_italiano.txt`), los diccionarios y las suites. Solo hay dos discrepancias. La primera es la frase de «Esta versión no trae notas» (§1). La segunda, la justificación del `onBlur` (§2). Sus 16/16 mutantes no se repitieron; mis 12 son otros.

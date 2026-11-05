# Revisión · las notas de versión en inglés e italiano, y B82

- **Rama:** `feat/italiano-novedades` (worktree `.claude/worktrees/italiano-novedades`), sale de `integra/idiomas` en `e6c8ca43`.
- **Fecha:** 2026-11-05.
- **Qué es:** el siguiente tramo de lo que todavía salía en español con el idioma encendido y se podía arreglar **sin cambiar el español**: las notas de versión («Novedades»), que hasta hoy se declaraban «en español a propósito», y B82 (cambiar de idioma con un diálogo de cifras abierto). **Sin validar**: lo revisa un validador después.
- **No se tocó:** B68 (`middleware.ts`), B70 (controles del mapa y del toaster), B71 (nombres accesibles de cerrar), D18 («2,5» en español), el texto legal del contrato, la bitácora/Actividad (es dato), «Vincular», `nav.ts`, migraciones, `db/schema.sql`, `aislamiento.e2e.test.ts`, `servidor-e2e.ts`. Sin servidores ni e2e (memoria justa; los servidores del dueño en 3600/3601 no se tocaron).

## 1 · Commits

| Commit | Qué |
|---|---|
| `01b9c273` | rojo · notas por idioma (validación, `textoDeItem`, componente, actualizador, puerta de la release, archivo real) y B82 tecla a tecla |
| `19938be0` | arreglo · B82 (`pintarCrudo`, `motivoCifraAjena`, `CampoCifra`) |
| `5d841a50` | mecanismo · `en`/`it` opcionales por item, `textoDeItem`, `NotasDeVersion` en el idioma de quien lee, `sinTraducir` y el aviso de `verificar-novedades.mjs`, el actualizador quitando `en`/`it` |
| `ecd89571` | las 18 versiones (110 items) traducidas al inglés y al italiano |
| `30e51c71` | prueba · la rama de `Number()` de `pintarCrudo` («1e3», «+1500.5») |
| `57b34617` | barrido · los dos hallazgos preexistentes de `cifras-formularios`, declarados |
| _(siguiente)_ | documentación |

## 2 · El formato de las notas

Cada item admite dos campos **opcionales** junto a `texto` (el español, el original):

```json
{ "tipo": "NUEVO", "texto": "…", "en": "…", "it": "…" }
```

| Interfaz | Se pinta |
|---|---|
| español | `texto`, **siempre** (aunque haya traducciones) |
| inglés | `en`, o `texto` si falta |
| italiano | `it`; si falta, `en` (la caída del resto del italiano); si faltan los dos, `texto` |

- **Una entrada vieja sin traducciones sigue valiendo** y se pinta como siempre.
- **Una traducción vacía o que no es texto invalida el archivo** (pintaría una viñeta en blanco). `fr` o `es` siguen siendo campos desconocidos.
- **`verificar-novedades.mjs` no cambia de contrato:** sale con 0, 1 o 2 como antes y `release.yml` no se toca. Si a la entrada de la versión le faltan traducciones, lo dice con un `::warning::` por idioma y **sale con 0**: parar una release por una traducción sería peor que el defecto.
- **El actualizador quita `en`/`it`** de lo que escribe en `notas_disponibles` (`scripts/actualizaciones.mjs`, `notasParaVersion`). La sonda corre con la imagen NUEVA pero la columna la lee la aplicación VIEJA, que rechaza campos de item desconocidos: el dueño habría visto «Esta versión no trae notas» justo en la versión que las trae. Consecuencia: el panel de Actualizaciones enseña la versión **pendiente** en español; ya instalada, el diálogo y `/novedades` la pintan traducida. Apuntado como **B83** en `ABIERTOS.md`.

## 3 · Las traducciones (110 items, 18 versiones)

Traducidas desde el español; el inglés solo como apoyo para el italiano.

- **Inglés:** glosario de `idiomas-es-en.md` §11 y los nombres que ya pinta la aplicación (Settings, Lease negotiation, Negotiation codes, Bundles, “Plays (proof of play)”, “Publication review”, “Owned screen”, Activity log, Power usage, Account settings…). Comillas “ ” y apóstrofo ’. Cifras a la inglesa: 2,500 · MX$1,234,567.50 · 7.50%.
- **Italiano:** glosario de `italiano-olas.md` §7 y §12 y los nombres del diccionario italiano (Impostazioni, Negoziazione locazioni, Codici di negoziazione, Pacchetti, «Passaggi (proof of play)», «Convalida della pubblicazione», «Impianto di proprietà», Registro attività, Consumo elettrico…). Tuteo, « » y ’, sin artículo pegado a la cifra de un día. Cifras a la italiana: 2.500 · MX$ 1.234.567,50 · 7,50%.

Decisiones de traducción que no venían en los glosarios:

| Español | Inglés | Italiano | Por qué |
|---|---|---|---|
| pantalla (de la app) | page | pagina | «todas las pantallas se ven como el Dashboard»: son páginas, no impianti |
| pantalla (inventario) / pantalla digital | screen / digital screen | impianto / schermo (digitale) | glosario: impianto en inventario y propuestas; schermo en DOOHmain, Space Eyes y lo digital |
| Inicio (la página de antes) | the home page | la pagina iniziale | el menú ya dice Dashboard; las notas viejas hablan de «Inicio» |
| folio (de campaña o extensión) | internal ref. | rif. interno | glosario «folio interno» |
| folio (de una solicitud de Space Eyes) | reference number | numero della richiesta | no es un folio interno de documento |
| campanita | the bell | la campanella | |
| pin (del mapa) | pin | segnaposto | |
| arte | artwork | grafica | |
| se cuentan hacia abajo (spots) | counted down | si contano per difetto | redondeo hacia abajo |
| prima (Roadblock) | premium | maggiorazione | como el diccionario |
| «Por spot» (nombre viejo) | “Per spot” | «A spot» | nombre retirado; no tenía italiano |
| «Comercial OPEX», «Códigos promocionales» (nombres viejos, v0.11.9) | “Comercial OPEX”, “Promo codes” | «Comercial OPEX», «Codici promozionali» | la nota cuenta el cambio de nombre; el viejo se nombra a propósito |
| «Valor Real del Spot Unitario» | igual | igual | nombre propio de la calculadora HTML de referencia |
| el 21 de octubre / desde el 5 de octubre | October 21 / from October 5 | in data 21 ottobre / dal giorno 5 ottobre | regla del italiano: sin artículo pegado al día |
| las cifras en una nota sobre cifras (v0.11.3) | «2,500», «“2.500” en un importe» | «2.500», «“2,500” in un importo» | la nota describe lo que ve la persona: en italiano el separador y el caso ambiguo son el espejo |

## 4 · B82 · cambiar de idioma con un diálogo de cifras abierto

- **Antes:** en es/en `EntradaCifra` guarda lo tecleado tal cual. Al pasar a italiano con el diálogo abierto, `CampoCifra` lo trataba como canónico: «1,500» se pintaba «1.500» (mil quinientos) y el formulario mandaba `Number('1,500') || 0` = 0.
- **Ahora:** `pintarCrudo(crudo, idioma)` (`lib/captura-cifra.ts`) relee el crudo:
  - canónico → el camino de siempre («12.9» → «12,9», «1500» → «1.500»);
  - no canónico pero `Number()` lo entiende → pinta esa cifra, la que se mandará («1e3» → «1.000», «+1500.5» → «1.500,5»);
  - no es una cifra («1,500», «12,9», «1.500,50» tecleados en es/en) → **se deja como se tecleó y el campo avisa** (borde rojo, `role="alert"`, el motivo de forma italiano: «… Esempio: 212.500,50») hasta que se teclee; al salir del campo no se canoniza (se leería 1,5).
- **Lo que se manda no cambia.** Se eligió avisar y no bloquear: bloquear cambiaría lo que el formulario manda.
- **Solo en italiano:** en es/en `pintarCrudo` es la identidad con `textoDesdeCrudo`.
- **Medido tecla a tecla** con el arnés (`cifras-formularios.test.ts`, «B82»): es→it y en→it con «12.9», «1500», «1,500» y teclear de nuevo tras el aviso; italiano sin cambio de idioma, el de siempre. **Límite del arnés:** recuerda el estado por posición de llamada, y al cambiar de idioma cada `<input>` de es/en pasa a ser un `CampoCifra` con estado propio, así que en el alta de Comercial entera los estados de después se corrían de sitio (el ancho salía vacío). Se monta un formulario mínimo con la misma forma que el alta (`useState('')`, `EntradaCifra`, `cifraIlegible`, `Number(x) || 0`).
- **No verificado:** si la interfaz deja cambiar de idioma con un diálogo abierto (el selector queda detrás del modal; el caso real es un refresco que trae otro idioma).

## 5 · Cómo se midió

- **Español e inglés idénticos (HTML):** volcado `I18N_VOLCAR_TODO` + `I18N_VOLCAR_IT` de toda la suite en un worktree aparte en `e6c8ca43` y en la rama, `diff -rq`: **0 archivos distintos** (5142 → 5215 en `todo`, 2134 → +1 carpeta en `it`). Lo único nuevo son los estados de las pruebas nuevas: 2 de `NotasDeVersion` y 9 de B82. `_italiano.txt` difiere solo en orden y en esas 3 líneas nuevas (comparado ordenado).
- **Diccionarios:** `lib/i18n/textos/` y `diccionario.ts` sin tocar (`git diff e6c8ca43` vacío): `DICCIONARIOS.es` y `.en`, 0 valores cambiados. Cobertura y costura en verde (en la suite).
- **Español de las notas:** `texto` de los 110 items idéntico a `e6c8ca43` (comparado por script con los items reducidos a `{ tipo, texto }`); y la prueba de `NotasDeVersion` fija que en español el HTML con traducciones es byte a byte el de sin ellas.
- **Barrido italiano** (`scripts/i18n-barrido-italiano.mjs --sin-volcar` sobre el volcado de la rama): **3963 estados, 596 hallazgos, 596 declarados, 0 sin declarar.** Salieron 11 sin declarar, **los mismos en `e6c8ca43`**: estados de `cifras-formularios.test.ts`, cuyo HTML no se había barrido nunca (el motivo de rechazo que cita «1,500» tecleado y el nombre «Pantalla Nueva» que teclea una prueba). Declarados con su porqué en `A_PROPOSITO_IT`.
- **Trampa del volcado:** con `I18N_VOLCAR_IT`, `cifras-formularios.test.ts` no termina nunca (sin CPU), también en `e6c8ca43`; solo con `I18N_VOLCAR_TODO` pasa en 3 s. Se volcó en dos tandas: toda la suite menos ese archivo y `middleware.test.ts` con los dos volcados, y esos dos con `I18N_VOLCAR_TODO`. Igual en los dos árboles.
- **Mutantes: 16/16 muertos** contra las unitarias (validación de `en`/`it`, campos conocidos, caídas, español fijo, agrupar por idioma, el componente, el actualizador, el aviso y el recuento de la puerta; `pintarCrudo` sin `ajeno`, sin la rama de `Number()`, sin la guardia de idioma; `CampoCifra` sin aviso, sin quitarlo al teclear, sin `pintarCrudo` al montar; el ejemplo del motivo sin intercambiar). La rama de `Number()` no la ejercía ningún caso: se añadió «1e3» y «+1500.5» (`30e51c71`) antes de medir.
- **Suites:** `npm run typecheck` limpio; `npx vitest run --testTimeout=60000`: **409 archivos, 8586 en verde + 1 omitida**; `npm run build` en verde, y el texto de las notas no aparece en `.next/static`. **Sin e2e ni servidores** (memoria; nada de sesión, tenant ni servidor cambia).

## 6 · Documentación

- `vault/02-Backend/notas-de-version.md` (formato, reglas, la puerta, la sonda, la página).
- `vault/03-Frontend/italiano-olas.md` §14.
- `docs/Supervision/ABIERTOS.md`: B82 cerrada, B83 nueva.
- `vault/07-Agentes/diario/2026-11-05.md`, enlazado desde el MOC; recuentos en `CLAUDE.md`.

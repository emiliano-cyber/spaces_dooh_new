---
tipo: tablero
estado: en-curso
actualizado: 2026-11-05
tags: [frontend, i18n, portugues, olas, agentes, dinero]
archivos:
  - apps/web/lib/i18n/idiomas.ts
  - apps/web/lib/i18n/formato-idioma.ts
  - apps/web/lib/i18n/diccionario.ts
  - apps/web/lib/i18n/textos/
  - apps/web/lib/i18n/cobertura-portugues.ts
  - apps/web/lib/i18n/errores-servidor.ts
  - apps/web/lib/i18n/guardias-portugues.ts
  - apps/web/lib/test/volcado-html.ts
  - apps/web/lib/test/espejo-portugues.ts
  - apps/web/lib/server/idioma-controller.ts
  - apps/web/lib/server/idioma-alta.ts
  - apps/web/lib/server/idioma-instancia.ts
  - apps/web/components/demo/admin/IdiomaCuenta.tsx
  - docs/i18n/revision-portugues-base.md
---

# La versión en portugués (Brasil), ola por ola

Pedido del dueño el **2026-11-05**: la aplicación en portugués de Brasil. Esta
nota es el **tablero**: qué está hecho, en qué rama, qué falta y qué decidió el
dueño. La maquinaria de idiomas —la regla de la cookie, las claves, el dinero,
los errores del servidor— está en [[idiomas-es-en]]; el método por lotes es el
del italiano, en [[italiano-olas]], y el del inglés, en [[ingles-olas]]. Aquí no
se repiten.

> [!important] Nada de esto está en `main`
> - La rama de integración es **`integra/portugues`**, que sale de
>   `verificacion` (`a7953731`, con el inglés y el italiano completos).
> - La ola 0 vive en **`feat/portugues-base`**. Cada lote trabajará en su
>   `feat/portugues-<lote>`, saliendo de `integra/portugues`.
> - No se ha empujado nada ni hay PR.

> [!warning] El portugués está APAGADO
> Su interruptor es **`IDIOMA_PORTUGUES=1`** —solo el valor exacto `1`—, propio
> y separado de `IDIOMA_INGLES` e `IDIOMA_ITALIANO`: encender uno no enciende
> otro. Apagado (la omisión), nadie ve portugués aunque su cookie o su navegador
> (`pt-BR`, `pt-PT`, `pt`) lo pidan, y el selector no ofrece «Português». No se
> enciende hasta cerrar los lotes y el recorrido en el navegador (§4).

## 1 · Decisiones del dueño (05/11)

| # | Asunto | Estado |
|---|---|---|
| D1 | **pt-BR (Brasil), trato «você»**. Locale `pt-BR`; la clave del idioma es `pt` | **Decidido**. `IDIOMAS = ['es','en','it','pt']` (`idiomas.ts`), etiqueta «Português» |
| D2 | **Pesos: «MX$ 1.160,00»** —símbolo delante con espacio, separadores brasileños—, como el italiano. **No se añade el real (BRL)** | **Decidido**. `FORMATO_IDIOMA.pt` (`formato-idioma.ts`) |
| D3 | **Mientras falte una clave en portugués, se pinta en ESPAÑOL** (no en inglés como el italiano). Lo mismo los errores del servidor: un mensaje sale entero en portugués o entero en español, nunca a medias | **Decidido**. La caída vive en un solo sitio: `conCaidaAlEspanol(ES, PT)` (`diccionario.ts`); en el servidor, `errorEnTablas(TABLAS_PT, …) ?? mensaje` (`errores-servidor.ts`) |
| D4 | Fechas «1 de dez. de 2026» (la corta de pt-BR), cifras «1.160,5», porcentaje «55,0%», trimestre «T1 2026» | **Propuesto en la ola 0**, sin decidir. En `FORMATO_IDIOMA.pt` |
| P1 | **Dólar de una instancia USD en portugués** — provisional «US$ 1.160,00» | **Pendiente del dueño** |
| P2 | **¿Se teclean las cifras a la brasileña («1.500,50»)?** Hoy, a la mexicana (`separadorDecimal: '.'`), porque es una decisión de dinero (ZONA ROJA) que el dueño tomó para el italiano (P-L2-1, 04/11) y no para el portugués, y porque los avisos de captura caen al español («la coma separa miles»): con coma decimal mentirían | **Pendiente del dueño** |
| P3 | **Los papeles en portugués** (contrato de ejemplo, constancia, propuesta impresa, `/p`, portal, comprobante, correos) en una instancia `pt` | **Tarea ROJA aparte** (§3): migración de los dos CHECK, `--idioma pt` y el texto |
| P4 | Glosario: ¿los anglicismos del sector se quedan en inglés como en italiano (spot, loop, DOOH, «loops/h»)? | Pendiente; lo propone L5 con el glosario común |

## 2 · Las olas

### Ola 0 · La infraestructura

| Tarea | Rama | Veredicto | Notas |
|---|---|---|---|
| `pt` como cuarto idioma, formatos, caída al español, catálogos, guardia, espejo y cobertura | `feat/portugues-base` | **Hecha, sin validar** | Sin traducir la interfaz. Detalle en `docs/i18n/revision-portugues-base.md` |

### Ola 1 · Los lotes de traducción (propuesta)

La partición del italiano, que funcionó: **5 lotes que no se pisan**, cada uno
toca **solo sus archivos** de `textos/` (y el L5, además, la base de
`diccionario.ts` y los catálogos de `errores-servidor.ts`). Recuentos medidos el
05/11 con `coberturaPortugues()` sobre `feat/portugues-base`.

| Lote | Ámbitos | Claves |
|---|---|---:|
| **L1 · Space Eyes y luz** | `spaceeyes` 1007 · `energia` 121 | **1128** |
| **L2 · Comercial y propuestas** | `comercial` 502 · `codigos` 59 · `propuestas` 446 · `catalogos` 194 | **1201** |
| **L3 · Inventario, arrendadores y operaciones** | `inventario` 360 · `arrendadores` 444 · `operaciones` 177 · `operaciones2` 205 | **1186** |
| **L4 · Campañas, finanzas, clientes, reportes y Dashboard** | `campanas` 396 · `finanzas` 170 · `clientes` 220 · `reportes` 148 · `inicio` 148 | **1082** |
| **L5 · Armazón, cuenta, administración y servidor** | base de `diccionario.ts` 113 (de 119; el selector ya está) · `shell` 59 · `cuenta` 125 · `admin` 542 · `compartidos` 113 · `notificaciones` 47 · `servidor` 32 · errores del servidor 309 (catálogo 205, campos 30, firma 12, patrones 62) | **1340** |
| | **Total pendiente** | **5937** |

> [!tip] El glosario se fija ANTES de repartir
> Como en el italiano: `compartidos` (L5) fija las palabras que usan todos
> (periodos, catorcena, millar, unidades). Conviene que L5 entregue primero el
> glosario común y que los otros cuatro lo reciban en su encargo. Y el
> glosario del italiano (`italiano-olas.md` §5–§7) sirve de lista de términos
> a decidir: impianto/schermo, OdL, OdA, provvigione…

> [!warning] Lo que se traduce y todavía no se ve
> Las claves de los papeles —`arrendadores.constancia.*` (13), los correos
> (`propuestas.correo.*`, `cuenta.correo.*`, `notificaciones.correo.*`)— van en
> el idioma de la INSTANCIA, y una instancia no puede ser `pt` hasta la tarea
> roja (P3). Los lotes pueden traducirlas; no se verán en una pantalla hasta
> entonces.

Después, una **costura** como la del italiano (`textos/costura.test.ts`, que hoy
compara inglés e italiano: se extiende al portugués con el primer lote) y el
**recorrido en el navegador**.

## 3 · La base todavía no sabe portugués (dependencia de P3)

Dos columnas guardan un idioma y las dos tienen un CHECK `in ('es','en','it')`:
`usuarios.idioma_preferido` (`20261103_usuarios_idioma_preferido.sql`) y
`tenants.idioma_documentos` (`20261103_idioma_documentos_por_instancia.sql`).
Con `pt` en `IDIOMAS`, cualquiera que escribiera en ellas validando contra
`IDIOMAS` mandaría un `pt` que el CHECK tumbaría con un **500**. La ola 0 **no
toca la base**; en su lugar:

- `IDIOMAS_EN_LA_BASE = ['es','en','it']` y `esIdiomaEnLaBase()`
  (`idiomas.ts`): lo que cabe hoy en esas columnas.
- **«Mi cuenta → Idioma»** guarda contra `idiomasDeCuenta()` (los encendidos
  que caben en la base; `idioma-controller.ts`) y la tarjeta no ofrece
  «Português» (`IdiomaCuenta.tsx`). Un `PUT {idioma:'pt'}` da el **400** de
  siempre. El portugués se consigue con el selector (cookie) o con «Usar el
  idioma del navegador».
- **El alta** (`idiomaDocumentosPedido`, `idioma-alta.ts`) rechaza
  `idiomaDocumentos: 'pt'` con el 400 de siempre («debe ser es, en o it»).
  `provision-instancia.sh` ya rechazaba `--idioma pt`.
- **El tipo de un papel** es `IdiomaEnLaBase`: `contrato-documento.ts`,
  `idiomaDeLaInstancia()` y el alta. `tsc` impide pedir un contrato en
  portugués antes de que exista. La huella del redactor cambió solo por el tipo
  y su comentario; los hashes españoles del contrato, en verde.

La tarea roja P3 abre los dos CHECK (migración nueva), pasa `IDIOMAS_EN_LA_BASE`
a `IDIOMAS`, añade `--idioma pt` y escribe los papeles.

## 4 · Antes de encender `IDIOMA_PORTUGUES`

- [ ] Los cinco lotes en **VERDE**, con su tipo `PT_<AMBITO>` ya en `Record` completo
- [ ] `coberturaPortugues()` con **0 pendientes** en todas las filas (hoy, 5937)
- [ ] El espejo (`I18N_VOLCAR_PT`) sin hallazgos de formato (hoy, §5)
- [ ] La costura extendida al portugués, en verde
- [ ] P1 y P2 contestadas por el dueño
- [ ] La tarea roja P3, si las instancias `pt` van a tener papeles en portugués
- [ ] El recorrido en el navegador, pantalla por pantalla, con su validador

> [!danger] Lo que distingue al portugués: a medias NO SE NOTA
> Con la caída al español, una pantalla sin traducir es idéntica a la de la
> versión española. El italiano a medias se veía (salía en inglés); el
> portugués a medias no. **La única medida es `coberturaPortugues()`**: no se
> enciende con ninguna fila por encima de 0.

## 5 · Lo que la ola 0 deja medido para los lotes

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
AM/PM 5. Es el punto de partida de cada lote: los lotes que traduzcan esos
ámbitos rendirán sus estados en `pt` y los declararán o arreglarán.

> [!warning] El espejo de TODA la suite se cuelga en `cifras-formularios.test.ts`
> Como el italiano (diario del 05/11): con el espejo, ese archivo no termina.
> Se corre excluyéndolo (y `middleware.test.ts`):
> `I18N_VOLCAR_PT=<carpeta> npx vitest run --exclude '**/cifras-formularios.test.ts' --exclude 'middleware.test.ts' --exclude '**/node_modules/**' --exclude '**/*.e2e.test.ts'`.

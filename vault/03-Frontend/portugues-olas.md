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
  - apps/web/lib/contrato-documento.ts
  - apps/web/lib/i18n/textos/papeles-portugues.ts
  - db/migrations/20261105_idioma_portugues.sql
  - infra/scripts/provision-instancia.sh
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
> - La tarea roja P3 (los papeles y la base) vive en
>   **`feat/portugues-documentos`**, sobre `integra/portugues` (`e018b1bb`).
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
| D4 | Fechas «1 de dez. de 2026» (la corta de pt-BR), cifras «1.160,5», porcentaje «55,0%», trimestre «T1 2026» | **Decidido** (05/11). En `FORMATO_IDIOMA.pt` |
| P1 | **Dólar de una instancia USD en portugués: «US$ 1.160,00»** | **Decidido** (05/11) |
| P2 | **¿Se teclean las cifras a la brasileña («1.500,50»)?** Hoy, a la mexicana (`separadorDecimal: '.'`), porque es una decisión de dinero (ZONA ROJA) que el dueño tomó para el italiano (P-L2-1, 04/11) y no para el portugués, y porque los avisos de captura caen al español («la coma separa miles»): con coma decimal mentirían | **Decidido (05/11): A LA BRASILEÑA.** Tarea ROJA aparte (`feat/portugues-cifras`), como la del italiano del 04/11 |
| P3 | **Los papeles en portugués** (contrato de ejemplo, constancia, propuesta impresa, `/p`, portal, comprobante, correos) en una instancia `pt` | **Aprobada (05/11, «Sí, igual que italiano») y hecha, sin validar**: `feat/portugues-documentos` (§3). Adenda al ADR 0049 |
| P4 | Glosario: ¿los anglicismos del sector se quedan en inglés como en italiano (spot, loop, DOOH, «loops/h»)? | **Decidido (05/11): se quedan en inglés** (spot, loop, DOOH, CPM, «loops/h»), como en italiano |

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

> [!warning] Las claves de los PAPELES ya están escritas (P3, 05/11)
> Viven aparte, en `lib/i18n/textos/papeles-portugues.ts` (169 claves de
> `propuestas`, `cuenta`, `finanzas`, `arrendadores`, `notificaciones`,
> `campanas` y `comercial`), para no pisar los archivos de los lotes. Cuentan
> como traducidas en `coberturaPortugues()`. Si un lote traduce una de ellas,
> **gana el lote**, pero `papeles-portugues.test.ts` exige que diga LO MISMO:
> si difiere, rojo, y se decide en la costura cuál queda. Al cerrar los lotes,
> esas claves se mueven a su `PT_<AMBITO>` y el archivo desaparece.

Después, una **costura** como la del italiano (`textos/costura.test.ts`, que hoy
compara inglés e italiano: se extiende al portugués con el primer lote) y el
**recorrido en el navegador**.

## 3 · P3: la base sabe portugués, y los papeles también (05/11)

**Hecha en `feat/portugues-documentos`, sin validar.** Tarea ROJA aprobada por el
dueño el 05/11 («Sí, igual que italiano»). Adenda al ADR 0049.

Hasta P3, dos columnas guardaban un idioma con un CHECK `in ('es','en','it')`
—`usuarios.idioma_preferido` y `tenants.idioma_documentos`— y la ola 0 validaba
contra una lista corta (`IDIOMAS_EN_LA_BASE`) para que un `pt` no llegara a la
base como un 500. Desde P3:

- **Base:** `20261105_idioma_portugues.sql` abre los dos CHECK a `pt` (mismo
  nombre de restricción; ni triggers ni filas). Idempotente, LF.
- **La lista temporal desaparece.** El alta (`idioma-alta.ts`) valida contra
  `IDIOMAS` —el 400 dice «es, en, it o pt»—; `idiomaDeLaInstancia()` lee `pt`;
  `provision-instancia.sh --idioma pt` (o `--idioma=pt`); `pt-BR` o `PT`, 400 /
  salida 64.
- **«Mi cuenta» guarda `pt` si está encendido** (`idiomasActivos()`), y la
  tarjeta lo ofrece. **Cierra H1** de la validación de la ola 0: con una
  preferencia guardada, el portugués ya se alcanza. Apagado, ni se ofrece ni se
  guarda (400) y una preferencia `pt` guardada se ignora sin error.
- **El idioma de los documentos no depende de `IDIOMA_PORTUGUES`**: una
  instancia puede nacer con papeles en portugués con la interfaz apagada, como
  con el italiano.
- **El contrato de ejemplo en pt-BR** (`redactarEnPortugues`, aparte de la
  función del inglés y el italiano): «O LOCADOR / O LOCATÁRIO», contracciones
  escritas a mano, «1.234.567,89 MXN», «1º de agosto de 2026», y la cantidad con
  letra con «e» («MIL DUZENTOS E TRINTA E QUATRO PESOS 50/100 MXN»,
  «UM MILHÃO E DUZENTOS MIL», «UM MILHÃO DE PESOS», «QUATORZE»). Plantilla de
  EJEMPLO (D13, D17): el contrato que vale lo sube el cliente.
- **Los demás papeles**: claves en `textos/papeles-portugues.ts` (ver el aviso
  de §2).
- **Firmas:** ningún hash cambia. Los del inglés y el italiano no estaban
  fijados en ninguna prueba: se midieron sobre `e018b1bb` antes del cambio y
  quedan en `contrato-documento-portugues.test.ts`.
- **Validación (05/11): VERDE** (`docs/i18n/validacion-portugues-documentos.md`).
  Corregido después en la misma rama: H1 (la revisión previa a la firma muestra
  el importe como el contrato pt, «1.234.567,89 MXN»), H2 (la cabecera de la
  migración ya no cita `deploy.yml`), H4 («à sua inteira satisfação»,
  «certificado de conservação NOM-151»). Desde ahí el contrato pt también va
  **fijado por hash** (`HASH_PT`). H3 queda anotado como B91 en `ABIERTOS.md`.
  Ningún papel decía «Proprietário» por el rol Dueño («Titular», decisión del
  dueño del 05/11): el contrato dice «proprietário ou possuidor» del inmueble.

> [!warning] Lo que P3 NO tradujo (para los lotes)
> Lo que rodea a los papeles y es INTERFAZ (la barra de la propuesta, los
> botones del comprobante) sigue a la persona y lo traducen sus lotes. Y dos
> piezas que `/p` y el portal pintan y son de L5: `compartidos.mapa.*` (los
> avisos del mapa) y `compartidos.asignacion.sin-asignar` (el comprobante),
> que caen al español hasta que L5 los traduzca.

## 4 · Antes de encender `IDIOMA_PORTUGUES`

- [ ] Los cinco lotes en **VERDE**, con su tipo `PT_<AMBITO>` ya en `Record` completo
- [ ] `coberturaPortugues()` con **0 pendientes** en todas las filas (hoy, 5937)
- [ ] El espejo (`I18N_VOLCAR_PT`) sin hallazgos de formato (hoy, §5)
- [ ] La costura extendida al portugués, en verde
- [x] P1 y P2 contestadas por el dueño (05/11)
- [x] La tarea roja P3 (05/11, `feat/portugues-documentos`; falta su validación)
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

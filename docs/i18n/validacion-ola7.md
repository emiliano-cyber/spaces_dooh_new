# Validación · ola 7 (cierre final) de la versión en inglés

- **Rama:** `feat/ingles-ola7` (`31c7a1f5`), contra la base `integra/ingles` `d4fe7883`.
- **Fecha:** 2026-11-03. Validador independiente: no recibió el razonamiento del traductor. Todo se midió de nuevo; `revision-ola7.md` se usó como lista de afirmaciones por comprobar.
- **Veredicto: ÁMBAR leve.** Todo lo medido cuadra con la revisión. Queda un hueco de una línea dentro del alcance de la ola (§6, H1) y un mutante que sobrevive en una rama defensiva (§5, v07). Ninguno toca el español ni los datos.

## 1 · Español idéntico (medido)

- **HTML.** Se volcó el HTML de las 15 pruebas de pantallas, cada una en su carpeta (`I18N_VOLCAR` / `VOLCAR_HTML`).
  - La base salió de este mismo worktree con `git checkout d4fe7883 -- apps/web` y se volvió a `HEAD` con `git checkout HEAD -- apps/web`. El árbol de `integra-ingles` no se tocó.
  - `diff -rq`: **0 diferencias en los 559 archivos de la base.**
  - Solo hay 4 archivos nuevos, todos en `pantallas-spaceeyes`: los dos estados nuevos de la ola 7, en español y en inglés.
  - Las 15 pruebas pasan en las dos corridas.
- **Los estados nuevos contra el código viejo.** Con `ListaEquipos`, `PantallaYCreativos` y `FallasFlota` de `d4fe7883`, la prueba de Space Eyes da 3 rojos (las dos exigencias inglesas nuevas y el barrido con el diccionario). Los dos archivos españoles nuevos salen **idénticos** a los de la rama; solo cambian los ingleses.
- **`DICCIONARIOS`.** Comparados con el código de `d4fe7883` en una prueba temporal:
  - `es`: 5574 → 5589, **0 valores cambiados**, 0 quitados y 15 nuevos (5 `finanzas.csv.*`, 8 `spaceeyes.fallas.nombre.*` y 2 `notificaciones.*.cero`);
  - `en`: 0 cambiados, 0 quitados y las mismas 15 nuevas.
- **El CSV en español, byte a byte.** El generador de `d4fe7883` y el de la rama, con los mismos datos, en **112 combinaciones**:
  - 2 monedas de instancia (MXN, USD);
  - 4 periodos (mes, trimestre, rango y una etiqueta rara que empieza por `=`);
  - 7 titulares (`=1+1`, `-Neg`, `+Pos`, `@At`, coma y comillas, tabulador…);
  - con y sin columna de cliente;
  - 23 movimientos con folios peligrosos (`=SUM(A1)`, `+52 55`, `-x`, `@h`, tabulador, coma, comillas, salto de línea, acentos), clientes peligrosos, saldos negativos e importes con decimales.
  - Resultado: **idéntico en las 112**, con y sin el argumento `'es'`. El BOM lo pone `EstadoCuenta.tsx` en una línea que el diff no toca.
- **Servidor.** `traducirError(m, 'es') === m` para la frase de `PaqueteImposible`. El diff no toca `lib/server`, `app/api`, `middleware.ts`, `nav.ts`, `db/`, `dinero.ts`, `aislamiento.e2e.test.ts` ni `servidor-e2e.ts`. No hay ningún `desktop.ini`.

## 2 · El CSV en inglés

- **Inyección de fórmulas.** En las mismas 112 combinaciones, ninguna celda inglesa empieza por `=`, `+`, `-`, `@` o tabulador, salvo los números negativos (`-50.25`), que Excel lee como número y no como fórmula. Los textos peligrosos salen con apóstrofo (`'=SUM(A1)`, `'-Beta`), igual que en español.
- **Separadores y comillas.** Cada fila tiene el mismo número de columnas que su gemela española. Las fechas inglesas llevan coma («Sep 1, 2026») y salen entre comillas, igual que «Overdue as of Sep 30, 2026 (MX$)». Las comillas internas se doblan.
- **Lo que sale:** `Account statement`, `Period,September 2026,"Sep 1, 2026","Sep 30, 2026"`, `Opening balance (MX$)`, `Invoiced (MX$)`, `Collected (MX$)`, `Closing balance (MX$)`, y las columnas `Date,Transaction,Invoice no.,Client,Charge (MX$),Payment (MX$),Balance (MX$)`. Los movimientos dicen `Invoice`, `Payment received` y `Payment received (approximate date)`. El archivo se llama `account-statement-2026-09[-client].csv`.
- **Opinión sobre el importe como número con `MX$` en el encabezado: razonable, y mejor que formatear cada celda.**
  - Excel suma la columna.
  - Un negativo llega como `-100`, número, y no como `-MX$100.00`. Esa cadena empezaría por `-`, así que habría que neutralizarla con apóstrofo y dejaría de ser número.
  - El encabezado conserva la moneda, que es lo que la decisión del dueño pedía, sin tocar el dato.
  - Queda abierto para el dueño, como dice la revisión.
- **Observaciones que ya estaban antes y no son de esta ola.**
  - `num = String(v)` escribe los decimales tal como llegan. Un importe sin redondear en el servidor saldría como `0.30000000000000004`. En el español es igual desde siempre.
  - El punto decimal en un Excel con configuración regional española se puede leer mal. También es igual en el español de siempre.
  - Las fechas inglesas son texto entre comillas: un Excel en inglés las convierte en fecha y uno en español las deja como texto. Es aceptable.

## 3 · Sentido del inglés (probado con datos)

- **Notificaciones.**
  - Con 0, `… — due today · balance MX$5,000`; con 1, `due in 1 day`; con 10 o 20, el plural de siempre (las pruebas de la rama lo cubren).
  - `Contract expires TODAY: …` repite la frase de `vence-hoy`, así que es coherente.
  - El servidor escribe de verdad «vence en 0 día(s)» (`finanzas-repo.ts:87`), así que el `.cero` de cobranza no es teórico.
- **`PaqueteImposible`.** La frase de fuera se ata al literal de `paquetes-repo.ts:443-445`, y el mensaje viaja por `AppError` (`paquetes-controller.ts:118`, `:129`).
  - Con un tope que no casa con ningún patrón, solo esa pieza queda en español y el resto sale en inglés. Probado con una frase de tope incompleta.
  - Un nombre con comillas o `$1` se repite tal cual.
- **«Dónde falló».**
  - `Gabinete 8 (fila 2, columna 3)` → `Cabinet 8 (row 2, column 3)`.
  - `Gabinetes 5 (1 de 15)` → `Cabinet 5 (1 of 15)`, con singular.
  - `Gabinetes 2, 5, 8 (3 de 15)` → `Cabinets 2, 5, 8 (3 of 15)`.
  - La lista cortada con «…» y `(14 de 20)` se traduce bien.
  - `Toda la pantalla` → `The whole screen`.
  - `Gabinete 8` a secas y un texto libre se quedan como llegan.
  - Las tres formas coinciden con `dondeDeFalla` (`lib/server/space-eye.ts:697-708`).
- **Nombre de la falla.**
  - Los 8 literales coinciden con `Monitor.kt:81-87` y `:533`, y también con `space-eye/pi-agent/vision/monitor.py:93-99` y `:710`, que la revisión no menciona pero usa el mismo catálogo.
  - Solo casa el texto exacto. Con un espacio de más, con el código crudo (`zona_apagada`) o con «cámara» en NFD, sale el texto tal cual.
- **Vigencia en la revisión del contrato.** «Jan 1, 2026 to Dec 1, 2026» con `timeZone: 'UTC'`. En español sigue la ISO.
- **Papeles.** `RENT, ASSETS, PERMITS, OPERATIONS, SALES` en inglés. El intruso tecleado se repite tal cual.
- **Glosario.** «Dec 1, 2026», `MX$` y *cabinet* («gabinete», como ya decía la flota) se respetan. Esta ola no trae términos de negotiation code, Internal ref. ni loops/h.

## 4 · Datos guardados y lo que se envía (criterio 4)

Todo lo que traduce «solo si casa exactamente» se usa solo para pintar:

- `nombreDeFallaEnIdioma` y `dondeDeFallaEnIdioma` aparecen solo en JSX (`FallasFlota.tsx:285`, `:353`, `:415`; `PantallaYCreativos.tsx:160`, `:162`, `:199`, `:200`). El cierre de una falla sigue mandando `{ estado, nota }` (`FallasFlota.tsx:165`).
- `textoDeActualizacion` aparece solo en un `title` (`ListaEquipos.tsx:367`).
- `diaDeVigencia` solo se usa en la fila de la revisión. La huella que viaja al enviar a firma es la que dio el servidor (`PanelFirmas.tsx:100`), no el texto pintado.
- En el papel, la lista de códigos solo entra en el mensaje. El borrador no cambia.
- Las notificaciones traducen una copia al pintarlas, igual que en la ola 6.

## 5 · Mutantes propios (distintos de los 24 del traductor)

Cada uno se aplicó con `scratchpad/val7/mutantes.mjs`, se corrió la suite unitaria entera y se restauró con `git checkout`. Al terminar, `git status` quedó limpio.

| # | Mutante | Resultado |
|---|---|---|
| v01 | «(n de total)» con `n` y `total` cambiados | muere (4 rojos) |
| v02 | `fila` y `columna` cambiadas en el gabinete | muere (2) |
| v03 | Sin la clave `varios-congelados` en el catálogo de nombres | muere (3) |
| v04 | Sin `otro-dueno` en las frases de actualización | muere (1) |
| v05 | La moneda en el encabezado también en español | muere (4) |
| v06 | La fecha inglesa del CSV sin comillas | muere (2) |
| v07 | El `.cero` sin comprobar que la plantilla existe | **sobrevive** |
| v08 | La vigencia en `America/Los_Angeles` en vez de UTC | muere (1) |
| v09 | Los códigos de papel siempre en inglés, también en español | muere (3) |
| v10 | El `(n de total)` obligatorio en el patrón de gabinetes | muere (4) |

**9 de 10 mueren.**

- **v07 sobrevive.** `formaDePlural` (`lib/i18n/notificaciones.ts:151-154`) comprueba que exista `${base}.cero` antes de usarla, y ninguna prueba manda la cifra `0` a una plantilla plural sin `.cero`.
  - Hoy no pasa: `cobranza.vencida` y `contrato.vencido` siempre llevan 1 o más.
  - Es una defensa sin prueba. Un caso de `contrato.vencido.detalle` con `n = 0` la cubriría.
- **Una trampa para quien repita esto.** La primera pasada dio «muere» en todos, y era **falso**. Para comparar había dejado una copia del código viejo en `apps/web/zz-old/`, y las guardias de `dinero.test.ts` recorren todo `apps/web`, así que fallaban por la copia y no por el mutante. Se borró la copia y se repitió la pasada; los números de arriba son los de la segunda. Para comparar con código viejo, la copia tiene que quedar fuera de `apps/web`.

## 6 · Hallazgos

- **H1 (menor, dentro del alcance).** `components/demo/space-eyes/FallasFlota.tsx:496`: el subtítulo del diálogo para cerrar una falla («Fixed» / «Not a fault») sigue pintando `${cierre.falla.nombre}` crudo. En inglés sale «Posible gabinete apagado · <equipo>», y es el único sitio que la ola dejó sin `nombreDeFallaEnIdioma`.
  - Arreglo de una línea: `nombreDeFallaEnIdioma(cierre.falla.nombre, idioma)`.
  - Ninguna prueba de pantallas abre ese diálogo con una falla del catálogo.
- **H2 (menor).** El mutante v07 (§5).
- **H3 (documentación, trivial).** `vault/03-Frontend/ingles-olas.md` dice «la campanita con las 24 plantillas», y `revision-ola7.md` §4 dice 25 notificaciones sembradas: 24 plantillas más una para el aviso emergente. Las dos cosas son compatibles, pero conviene escribirlo igual en los dos sitios.
- **Comprobado y correcto en la revisión:** los 559 estados, las 15 claves, el CSV byte a byte, los 24 mutantes listados, las 6900 unitarias y el build.

## 7 · Cifras (medidas en este worktree)

- `npm run typecheck`: limpio.
- `npx vitest run --testTimeout=60000`: **6900 de 6900 en 375 archivos**.
- `npm run build`: «Compiled successfully» (`BUILD_ID` `V9dAmjn83AqUKU4jzQqGD`).
- e2e: no se repitieron. El diff no toca servidor, rutas ni migraciones, y el traductor midió 1186 en verde (la única roja, `grants-rol-app`, cae por falta de Docker).

## 8 · Lo que no se comprobó

- **No se miró en el navegador.** Ni la descarga real del CSV ni las pantallas de Space Eyes con el doble del backend. Lo visual se apoya en el HTML de las pruebas de pantallas y en las funciones probadas con datos.
- **El CSV no se abrió en Excel.** Lo de las comillas, las fórmulas y los números se comprobó leyendo el CSV con un lector propio.
- **Las e2e** (§7).

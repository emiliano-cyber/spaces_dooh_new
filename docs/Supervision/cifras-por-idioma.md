# Supervisión · `feat/cifras-por-idioma` (P-L2-1, ZONA ROJA: dinero)

- **Fecha:** 2026-11-04
- **Rama:** `feat/cifras-por-idioma`, commits `f6877379` y `954203cd` sobre `integra/idiomas` `cb116dde`
- **Árbol medido:** worktree `.claude/worktrees/cifras-por-idioma` y, aparte, una fusión de
  prueba sobre `integra/idiomas` `f92b9b26` (deshecha con `git merge --abort`)
- **Autorización:** el dueño, 04/11: en italiano «1.500,50» → 1500.5 y «12,9» → 12.9; lo ambiguo
  se rechaza; en español e inglés, EXACTAMENTE lo de hoy.

## Veredicto: ÁMBAR

Aterriza en `integra/idiomas` con una deuda que **tiene que cerrarse antes de encender el
italiano en cualquier servidor con clientes** (B77). Español e inglés no cambian: lo medí por tres
caminos independientes. El servidor no se toca. Lo que falla es el **tecleo tecla a tecla** en
italiano, que ninguna prueba de la rama ejerce: un punto a la inglesa se traga en silencio y la
cifra sale 10 o 100 veces mayor.

## 1 · Lo que medí

| Comprobación | Resultado |
|---|---|
| `cd apps/web && npx tsc --noEmit` (rama) | `EXIT=0` |
| `cd apps/web && npm test` (rama) | `Test Files 406 passed (406)` · `Tests 8488 passed \| 1 skipped (8489)` · `EXIT=0` |
| Fusión de prueba con `integra/idiomas` `f92b9b26` | 4 conflictos: `italiano-l2.test.ts.snap`, `ABIERTOS.md`, `italiano-olas.md`, diario 04/11. Resuelto SOLO el snapshot (las dos líneas: la clave nueva de la calculadora + «provvigione» de integra) |
| typecheck + unitarias en el árbol fusionado | `TSC_EXIT=0` · `Test Files 408 passed (408)` · `Tests 8527 passed \| 1 skipped (8528)` |
| Huella es/en recalculada con `git show cb116dde:apps/web/lib/captura-cifra.ts` | `e5240e24065a685350c809d98a02f6a07ba65f15ffef205896872af2c902fda3` = la pegada en `captura-cifra.es-en.test.ts` |
| Misma batería, forzada a inglés en las 6 funciones (incl. `textoDesdeCrudo` y `formatearMientrasEscribe`), vieja vs nueva | `2bcafc85…f31a5` en las dos: idénticas también en los MOTIVOS ingleses (la prueba del autor solo compara números en inglés) |
| Volcado `I18N_VOLCAR_TODO` de toda la suite, `cb116dde` vs rama, `diff -rq` | 187 archivos distintos + `_italiano.txt`; **0** distintos fuera de `_italiano.txt`; 0 «solo en antes»; «solo en después»: `EntradaCifra.test.ts`, `cifras-formularios.test.ts` y 3 pruebas nuevas de `CampoCifra.test.ts` |
| Rojo del TDD: `captura-cifra.italiano.test.ts` contra la función de `cb116dde` | `Tests 21 failed \| 6 passed (27)`, todas por **aserción** (`expected 1500 to be 1.5`, `se esperaba RECHAZO de «1,500» y se leyo 1500`…). Rojo bueno; está en el mensaje del commit, no en la historia (un solo commit) |
| Archivos de servidor en el diff | `git diff --name-only cb116dde..HEAD \| grep -E "app/api/\|lib/server/\|db/\|middleware\|migrations\|servidor-e2e\|aislamiento\|scripts/\|next.config\|package"` → vacío. 45 archivos, ninguno de servidor |
| `qRaw`/`tenant_id`, IPs, URLs en lo añadido | ninguno (la única coincidencia del patrón de IP es la cifra `99.999.999.999.999.999` de una prueba) |
| `node scripts/recuentos.mjs` | rama: 160 · 66 · 125 · 116 notas · **1659** enlaces · 3 rotos (ADR) · 0 huérfanas. En `cb116dde`: **1656**. `CLAUDE.md` de la rama sigue diciendo 1656 |

### Mutantes (míos, contra la suite unitaria ENTERA, uno por corrida, restaurados con `git checkout`)

| # | Mutación | Resultado |
|---|---|---|
| M1 | `leerCifra` no intercambia en italiano (`captura-cifra.ts:100`) | MUERE · 42 rojas |
| M2 | `comaDecimal` verdadero también en inglés | MUERE · 25 rojas (incl. la huella es/en) |
| M3 | `crudoTecleado` devuelve lo tecleado | MUERE · 1 roja (solo su prueba unitaria; ver B80) |
| M4 | `cifraIlegible` siempre `false` | MUERE · 7 rojas |
| M5 | `EntradaCifra` es/en deja pasar `decimales`/`minimo` al `<input>` | MUERE · 4 rojas |
| M6 | `formatearMientrasEscribe` sin la rama italiana (`:282`) | MUERE · 3 rojas |
| M7 | `textoDesdeCrudo` ignora el idioma | MUERE · 17 rojas |
| M8 | Editar sitio: `medidaIlegible` siempre falso (`SiteFicha.tsx:1309`) | **SOBREVIVE** |
| M9 | Clientes: fuera `cifraIlegible` de `hayErrores` (`clientes/page.tsx:483`) | **SOBREVIVE** |
| M10 | Captación: fuera la guardia (`Captacion.tsx:568`) | **SOBREVIVE** |
| M11 | Propuestas: guardia de la calculadora siempre falsa (`propuestas/page.tsx:1139`) | **SOBREVIVE** |
| M12 | Negociación: `if (cifraMal) return` → nunca (`ComercialOpex.tsx:315`) | **SOBREVIVE** |
| M13 | Asistente de contrato: `cantidadIlegible` siempre falso (`ContratoWizard.tsx:189`) | **SOBREVIVE** |
| M14 | Alta de Comercial: `medidaIlegible = false` | MUERE · 2 rojas |
| M15 | Los ejemplos del motivo sin intercambiar (`fx`) | MUERE · 6 rojas |
| M16 | Comisiones: fuera la guardia del alta | MUERE · 1 roja |

**10 de 16 mueren.** Los 6 supervivientes son exactamente los formularios sin prueba propia. Los
leí uno a uno (abajo): la guardia está bien escrita en los seis. Lo que no tienen es quien la
defienda de una regresión (B79).

## 2 · Hallazgos, por severidad

### H1 · 🔴 por severidad · En italiano, un punto tecleado tecla a tecla se TRAGA y la cifra sale 10 o 100 veces mayor (B77)

Medido llamando a `formatearMientrasEscribe` tecla a tecla, como lo llama `CampoCifra` en su
`onChange` (`inputType: 'insertText'`):

```
it teclea "2.5"      pasos ["2","2","25"]                                             crudo "25"
it teclea "12.9"     pasos ["1","12","12","129"]                                      crudo "129"
it teclea "15000.50" pasos ["1","15","150","1.500","15.000","15.000","150.005","1.500.050"] crudo "1500050"
es teclea "2,5"      pasos ["2","2","25"]                                             crudo "25"
es teclea "15000,50" pasos [... "1,500,050"]                                          crudo "1500050"
```

**El mecanismo** (`captura-cifra.ts:282` y `:311`): en italiano se intercambian los signos y se
llama al camino español; allí una coma insertada donde no toca se quita al «recolocar las comas»
(`sin = texto.replace(/,/g, '')`). Al volver a intercambiar, lo que se quitó es el **punto**. El
mismo «12.9» **pegado** se rechaza con su motivo; **tecleado** se convierte en 129 sin ningún aviso.

**Por qué es grave aquí y no solo «el espejo de lo de siempre»:**

- Contradice la autorización del dueño («lo ambiguo se rechaza») y la propia convención
  (`vault/06-Operacion/convenciones.md:537-540`: «reformatear un «2,50» pegado daría «250», que
  nadie decidió»). La regla protege lo pegado; lo tecleado hace justo eso.
- **Es una regresión en los 37 usos de `EntradaCifra` (14 archivos), que antes eran `<input>` llano.** Antes de la rama, en italiano,
  «2.5» en el descuento de la ficha de una propuesta era `Number('2.5')` = 2.5. Ahora, tecleado, es
  **25 %** de descuento, y solo lo para el tope si el tope es menor de 25. Igual en ancho/alto
  (12.9 m → 129 m), horas de la calculadora, plazos, presupuestos de negociación.
- Las pruebas no lo ven **por construcción**: el arnés teclea siempre como pegar
  (`lib/test/formulario-sin-dom.ts:161-165`, `inputType: 'insertFromPaste'`), y las pruebas de
  tecleo italianas (`captura-cifra.italiano.test.ts:192-215`) no prueban un punto mal puesto. La
  prueba «ITALIANO · NEGATIVO: «12.9» (punto a la inglesa) no se manda» es verde **solo para
  pegar**.
- **Atenuante real:** la pantalla enseña «129» / «25» mientras se escribe; no es un dato oculto.
  Y para la persona que teclea a la italiana («2,5»), la rama **arregla** lo que antes salía 25 en
  los campos de dinero. Por eso es ÁMBAR y no ROJO: neto, la rama reduce el riesgo; pero abre uno
  nuevo en los campos que antes eran llanos.

**Cómo se cierra sin tocar español ni inglés:** en italiano, no recolocar cuando la tecla
insertada es un punto que no cae en posición de millar válida (dejarlo y que `leerCifra` lo
rechace con su motivo), o, más simple, no reformatear en italiano si la tecla es `.`. Prueba roja
primero: `formatearMientrasEscribe({anterior:'2', nuevo:'2.', cursor:2}, 'it')` debe devolver
`'2.'`, y la secuencia «2.5» debe acabar rechazada. La huella es/en seguirá cuadrando porque el
camino español no se toca. **El caso español simétrico («2,5» tecleado → 25) es anterior a esta
rama y cambiarlo cambia el español: es la decisión D18.**

### H2 · 🟠 Seis formularios con guardia nueva y sin prueba que la defienda (B79)

M8–M13 sobreviven. Lectura a mano de cada uno:

- **Editar sitio** (`SiteFicha.tsx:1309`): la guardia cubre ancho, alto, caras, cupo y, si es
  digital, slots y segundos; corta `guardar` y apaga el botón. Correcta. Sin ella, `Number('NaN')`
  viajaría como `null` y **borraría** el ancho guardado (el comentario lo dice y es cierto:
  `anchoNum = ancho.trim() === '' ? null : Number(ancho)`, `SiteFicha.tsx:1336`).
- **Asistente de contrato** (`ContratoWizard.tsx:189`): caras, slots y segundos; entra en
  `paso3Ok` y en el `disabled` del botón final. Correcta.
- **Captación** (`Captacion.tsx:568`): recorre todos los campos `numero` del tipo. Correcta.
- **Negociación** (`ComercialOpex.tsx:315`): la ficha corta `guardar` en silencio (el campo ya está
  en rojo); las ofertas dependen de `Number('NaN') > 0` = falso en el `disabled` del botón, y el
  `onSubmit` no tiene guardia propia — un Enter con el botón apagado no envía por la regla de envío
  implícito de HTML. **No verificado en navegador.**
- **Clientes** (`clientes/page.tsx:483`): `hayErrores` y `guardar` lo comprueba en `:488`. Correcta.
- **Propuestas** (`propuestas/page.tsx:1139`): solo si la línea usa calculadora; la comisión
  (`:1096-1103`) y la duración (`:1105-1107`) ya rechazan `NaN` por `Number.isFinite`. Correcta.
- **Ficha de la propuesta (descuento) y Administración (IVA, plazos, tope)**: `aplicarDescuento`
  rechaza `isNaN`; IVA y plazos hacen `return` con `cifraIlegible`; `guardarTope` rechaza
  `!Number.isFinite`. Correctas. (No tienen mutante propio; leídas.)

En español e inglés, todas son `false` por construcción (`cifraIlegible` exige `comaDecimal`).

### H3 · 🟡 La rama no fusiona limpia con `integra/idiomas` de hoy (B78)

`git merge-tree` contra `f92b9b26` da 4 conflictos. Tres son de documentos; **uno es un
snapshot** (`italiano-l2.test.ts.snap`, la clave nueva `propuestas.alta.error.calculadora` junto a
las tres de «provvigione»). Resolviéndolo a mano (las dos cosas), el árbol fusionado da typecheck
limpio y 8527 + 1 unitarias en verde. **No resolver el snapshot con `vitest -u`**: bendeciría lo
que hubiera.

### H4 · 🟡 Sin entrada en la bitácora y con el recuento de enlaces viejo (B81)

- `docs/Registro_Cambios.md` no está en el diff. El cambio se nota desde la aplicación (en
  italiano), así que lleva entrada en lenguaje llano.
- `node scripts/recuentos.mjs`: 1656 enlaces en `cb116dde`, **1659** en la rama; `CLAUDE.md:42`
  dice 1656. Tras fusionar habrá que medir otra vez (integra ya decía 1657).
- `docs/i18n/revision-catalogos.md:249-261` cita `captura-cifra.ts:65…144`; el archivo creció
  (~100 líneas) y esas citas ya apuntan a otro sitio. Es un documento histórico de `docs/`, no una
  nota de la bóveda: informativo. En la bóveda no hay citas con línea a los archivos tocados.

### H5 · ⚪ `crudoTecleado` es código muerto que se prueba como si fuera el componente (B80)

`captura-cifra.ts:338`. `grep` en todo `apps/web`: solo lo usan su definición y
`EntradaCifra.test.ts:59-71`. `EntradaCifra` no lo llama: en italiano delega en `CampoCifra`. Su
comentario dice «lo que recibe el formulario cuando en un `EntradaCifra` se teclea», y sus pruebas
dan una cobertura que no es la del camino real (M3 solo lo mata su propia prueba). El camino real sí
lo cubre `cifras-formularios.test.ts` en siete formularios. Menor: borrarlo o usarlo.

### H6 · ⚪ Cambiar de idioma con un formulario abierto (B82)

En es/en, `EntradaCifra` guarda lo TECLEADO; en italiano espera la cifra canónica. Si alguien
teclea «1,500» en español y cambia a italiano sin cerrar el diálogo, el campo pinta
`textoDesdeCrudo('1,500','it')` = **«1.500»** (medido) mientras el formulario conserva «1,500», que
no es `'NaN'`: `cifraIlegible` no lo para y `Number('1,500') || 0` guarda 0. Es exactamente lo que
habría pasado en español con «1,500» (0), así que no empeora nada; pero el campo enseña una cifra
distinta de la que se manda. Requiere cambiar de idioma con un diálogo abierto; **no verifiqué si
la interfaz lo permite** (no levanté la aplicación). Menor.

### H7 · ⚪ Lo que quedó fuera a propósito

- **Coordenadas:** `AltaSitioDialog.tsx:117` hace `Number(lat) || -12.09`; en italiano «19,4326»
  daría NaN → el punto por omisión, sin aviso. `ContratoWizard.tsx:311,330`: `NaN` → `null` en JSON.
  Pasa igual en español con una coma; la razón del autor (se pegan del mapa, con punto) es
  razonable. No es dinero. Menor.
- **Administración, enteros sin control** (`administracion/page.tsx:1204-1218`, `:1241-1246`,
  `:1570-1585`): son `type="number"`; el navegador normaliza lo tecleado según su idioma. Cupo, loop,
  segundos y días de vigencia: cifras pequeñas, no dinero. **No verificado en navegador** cómo trata
  un `type="number"` en un navegador italiano «1.500». Riesgo bajo.
- **Space Eyes y el orden de la rejilla:** enteros técnicos. Sin riesgo de dinero.

Ninguno de los cuatro guarda un IMPORTE mal en italiano. El riesgo real de dinero es H1.

### Lo que está bien y conviene decirlo

- `leerCifra` en italiano, 48 casos borde medidos: «1.500,50» → 1500.5; «1.500» → 1500; «1,5» →
  1.5; «0,5» y «,5» → 0.5; «1.000.000,00» → 1000000; «-1.500,50» → rechazado con mínimo 0 y −1500.5
  sin mínimo; «1,500», «1,505», «1,999» → **rechazados** con su motivo («sarebbe 1,5»); «12.9»,
  «1.5», «1.50», «01.500», «0.500», «.500» → rechazados; «MX$1.500», «€1.500», «1.500,50 €»,
  «1 500,50», «+5», «–5» (raya), «1e5», cifras de ancho completo → rechazados; «9.007.199.254.740.992»
  → «troppo grande». Ningún texto italiano **pegado** produce otra cifra que la que dice, **con una
  excepción medida**: «999.999.999.999.999,99» se acepta como **1000000000000000** (el `Number` de
  JavaScript no guarda más de ~15-16 cifras significativas y la guardia solo mira
  `MAX_SAFE_INTEGER`). Es anterior a la rama (el camino español es el mismo) y la cifra es absurda
  para un importe; informativo.
- Con 3+ decimales, «1,500» en italiano es 1.5: espejo de «2.500» = 2.5 en español. Ningún campo
  de la rama usa 3+ decimales.
- `EntradaCifra` en es/en: los atributos se copian en orden y `value`/`onChange` caen en el sitio de
  `valor`/`onCambio`. Revisado en cada llamada: el orden de `valor`/`onCambio` coincide con el de
  `value`/`onChange` de antes en todos los sitios.
- Los ejemplos/avisos italianos dicen la regla nueva, y `ImportarInventarioDialog` (que usa
  `CampoCifra` sin `idioma`) lee italiano con el idioma de la pantalla: su aviso «(65,50)» dice la
  verdad.

## 3 · Preguntas para el dueño

Una: **D18** (en `ABIERTOS.md`, apartado A). No bloquea esta rama.

## 4 · Lo que NO verifiqué, y por qué

- **La interfaz no la miré.** El orquestador pidió no levantar servidores (memoria justa). Nada de
  lo dicho sobre cómo se ve un campo en el navegador está medido en un navegador; H1 está medido en
  la función que el campo llama, no en el `<input>`.
- **Qué tecla produce el separador del teclado numérico en un Windows con distribución italiana.**
  Si produce «.», H1 lo dispara cualquiera que teclee con el teclado numérico. No lo comprobé.
- **E2e no corridas:** no hay cambio de servidor (medido arriba); no se pidieron.
- **El barrido aleatorio de 2,88 millones de lecturas** que cita el autor: no versionado, no lo
  reproduje. Lo sustituí por la huella recalculada y la comparación en inglés de las seis funciones.
- **El tecleo con el cursor en medio** (insertar un punto entre cifras ya escritas) no lo medí; solo
  al final del texto.
- **Envío implícito con Enter** en las ofertas de negociación con el botón apagado: deducido de la
  norma HTML, no comprobado.

---

## 2.ª pasada (2026-11-04) · `efaf62d4` · Veredicto: VERDE

Commits revisados: `468ee616` (rojo B77), `0281f9a8` (arreglo B77), `c5ffe82d` (B80), `03db5ea4`
(B79), `5c771163` (merge de `integra/idiomas` `f92b9b26`, B78) y `efaf62d4` (docs). Medido en el
worktree, en `efaf62d4`, con `git status` limpio antes y después de cada cambio temporal.

### Lo que medí

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | `TSC=0` |
| `npx vitest run` | `Test Files 408 passed (408)` · `Tests 8552 passed \| 1 skipped (8553)` |
| Rojo de B77 en `468ee616` (italiano + formularios) | `Tests 4 failed \| 57 passed (61)`, por aserción: `2.5 → ["2","2","25"]: expected true to be false`, `expected { texto: '2', cursor: 1 } to deeply equal { texto: '2.', cursor: 2 }` |
| Huella es contra la función de `cb116dde` | vieja y nueva `e5240e24…fda3` (sin idioma y forzada a `es`) |
| Batería forzada a inglés en las 6 funciones | vieja y nueva `2bcafc85…f31a5` |
| Volcado `I18N_VOLCAR_TODO` contra `f92b9b26`, `diff -rq` | 187 distintos, **0** fuera de `_italiano.txt`, 0 «solo en antes»; «solo en después» = las pruebas nuevas (incl. 3 de B79 en `pantallas-propuestas`) |
| Servidor tocado respecto a `f92b9b26` | filtro de rutas de servidor sobre `git diff --name-only f92b9b26 HEAD` → vacío |
| Mutantes M8–M13 (las seis guardias) y M17 (apagar el arreglo de B77) | **7/7 mueren**: M8, M9, M10, M12, M13 → `cifras-formularios`; M11 → `pantallas-propuestas`; M17 → 4 rojas |
| `recuentos.mjs` | 116 notas · **1660** enlaces · 3 rotos (ADR) · 0 huérfanas = `CLAUDE.md:42` |
| Marcadores de conflicto | `git grep -l "^<<<<<<< \|^>>>>>>> "` → nada |

### B77, tecla a tecla (`formatearMientrasEscribe`, `insertText`)

Al final del texto, en italiano:

```
"2.5"       pasos ["2","2.","2.5"]                       crudo NaN   (rechazado, se ve lo tecleado)
"12.9"      pasos ["1","12","12.","12.9"]                crudo NaN
"15000.50"  pasos [... "15.000","15.000.","15.000.5","15.000.50"]  crudo NaN
"10.5", "2.50"                                           crudo NaN
"1.500,50"  -> "1.500,50"   crudo 1500.5
"12,9"      -> "12,9"       crudo 12.9
"1500,50"   -> "1.500,50"   crudo 1500.5
"1.500" y "1500" -> "1.500" crudo 1500 · "0,5" -> 0.5 · "1234567,89" -> "1.234.567,89" -> 1234567.89
```

Con el cursor en medio (cada posición de «1.500», «12,9», «1.500,50», «125», insertando «.», «,» o
una cifra) y borrando en cada posición de «1.500», «12.500,5», «1.500.000» con retroceso y suprimir:
el punto insertado se queda siempre donde se tecleó (y se rechaza si no cae en un millar); una cifra
insertada se reagrupa («1.500» + 7 tras el 1 → «17.500»), que es la cifra que se tecleó; borrar un
punto de millar borra la cifra vecina («1.500» → «500» o «100» según el lado), lo mismo que hace la
coma en español desde siempre.

**Barrido aleatorio** (30 000 secuencias × 12 teclas = 360 000 pasos por idioma; inserciones de
cifra, «.» o «,» en posición aleatoria y borrados): cuento los pasos en que el campo cambia lo
tecleado por algo con **otras cifras**, descontando los ceros a la izquierda y el borrado de un
separador de millar.

```
FUZZ it  separador-tecleado-tragado 0   cambios-de-cifras-no-explicados 0
FUZZ es  separador-tecleado-tragado 23846                (D18, anterior, sin tocar a propósito)
```

**No aparece ninguna forma nueva de que lo tecleado acabe en una cifra distinta de la que se ve**:
el campo emite siempre la lectura del texto pintado (`CampoCifra`, `emitir(r.texto)`), y en
italiano el texto pintado ya no pierde ningún separador tecleado. El español sigue tragando la coma
(23 846 casos en el barrido): es exactamente lo de antes, y es D18.

### Lo que no perdió el merge

Para cada archivo que `integra/idiomas` cambió desde `cb116dde`, `git diff f92b9b26 HEAD`: solo
difieren `CLAUDE.md` (recuento), `pantallas-propuestas.test.ts` (+44, B79), `italiano-l2.test.ts.snap`,
`propuestas.ts` (+3, la clave nueva), `ABIERTOS.md` (+111), `italiano-olas.md` y el diario. Todas las
líneas que desaparecen respecto a integra son las que esta rama reescribe a propósito (el recuento de
enlaces, los dos avisos de tarifa italianos, el aviso P-L2-1 y la fila del diario, que conserva «D13
contestada»). El snapshot tiene las 11 menciones de «provvigione» de integra **y** la clave de la
calculadora. D17, B75 y B76 siguen en `ABIERTOS.md`. El tablero es idéntico al de integra (ninguna
de las dos ramas lo toca).

### Lo que queda

- **B81, a medias.** El recuento sí; la entrada de la bitácora **está aplazada**, no hecha, por
  indicación del coordinador hasta que se encienda el italiano. Es una decisión registrada, no un
  defecto, pero la tarjeta dice «CERRADA» y además conserva pegado el cuerpo viejo («`CLAUDE.md:42`
  dice 1656»), que ya es falso. Lo anoté en `ABIERTOS.md` junto a B82.
- **B82** sigue abierta (menor). **D18** sigue para el dueño.

### Lo que no verifiqué

- La interfaz en un navegador (sin servidores, como se pidió). Todo lo de B77 está medido en la
  función que llama el campo y, para el alta de Comercial, en el formulario montado con el arnés.
- Qué produce la tecla decimal del teclado numérico en Windows italiano. Con el arreglo ya no
  importa: si produce «.», el campo lo rechaza en vez de tragarlo.
- E2e: sin cambio de servidor.

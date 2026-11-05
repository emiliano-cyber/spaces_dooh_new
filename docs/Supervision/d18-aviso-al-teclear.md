# Supervisión · D18 · aviso al teclear una coma mal puesta (es/en)

- **Rama:** `feat/d18-aviso-al-teclear` · worktree `.claude/worktrees/d18`
- **Commits auditados:** `6dce3b0f` (rojo) y `598a3a25` (arreglo), sobre `verificacion` `a91580bb`
- **Fecha:** 2026-11-04 (hora local; la rama fecha sus notas el 05/11)
- **Zona:** ROJA (captura de importes). Decisión del dueño: D18 opción (b), en español e inglés.

## Veredicto: ÁMBAR

Aterriza. Lo que el dueño pidió está hecho y medido: en español e inglés, «2,5», «12,34», «1,5000» y
«15000,50» tecleados se quedan a la vista y se rechazan igual que pegados; lo bien puesto sigue
igual; sin una coma de la persona el campo se comporta exactamente como antes (100 000 secuencias
al azar de hasta 20 teclas: 0 diferencias). La deuda es pequeña y está declarada abajo (B84, B85,
B86) más una decisión nueva fuera de D18 (D19).

**La que importa de verdad:** no es deuda de esta rama, es **D19**. En los campos `EntradaCifra`
de español e inglés —la comisión de la agencia, la comisión de la propuesta—, «12,5» se guarda
como **0** sin avisar, hoy, en el idioma con clientes. D18 no lo toca y no tenía por qué tocarlo.
De la deuda de la rama, la que más pesa es **B85**: pegar «1,500» encima de otra cifra con el
mismo número de comas no cuenta como coma de la persona, y una cifra más lo regrupa en «15,000».

## Lo que medí

### Typecheck y unitarias, en el worktree `d18` (HEAD `598a3a25`)

```
> web@0.1.0 typecheck
> tsc --noEmit
exit 0

 Test Files  413 passed (413)
      Tests  8790 passed | 1 skipped (8791)
exit 0
```

E2E: **no corridas**, por indicación (no levantar servidores). El diff no toca servidor, API, base,
middleware, auth ni migraciones (ver «Alcance»), así que no son obligatorias por la regla del
repositorio, pero tampoco están medidas.

### El rojo (6dce3b0f), corrido en un worktree temporal en ese commit

```
 Test Files  2 failed | 2 passed (4)
      Tests  72 failed | 108 passed (180)
     44  FAIL  lib/captura-cifra.d18.test.ts
     28  FAIL  lib/i18n/cifras-d18.test.ts
```

Todas las fallas son **de aserción**, ninguna de importación (0 líneas «is not a function»): el
commit rojo trae `teclearCifra` y `cifraAMedias` como esbozo con el comportamiento de antes. Ejemplos:

```
AssertionError: expected [ '2', '2', '25' ] to deeply equal [ '2', '2,', '2,5' ]
AssertionError: expected '1,234' to be '12,34'
AssertionError: expected [ '2', '2', '25', '250', '2500' ] to deeply equal [ '2', 'NaN', 'NaN', 'NaN', '2500' ]
AssertionError: expected { nombre: 'Paquete Uno', …(4) } to be undefined
```

Rojo bueno: mide el defecto.

### Medición independiente contra la función de `a91580bb`

Copia de `apps/web/lib/captura-cifra.ts` de `a91580bb` (`git show`), comparada con la de HEAD en un
arnés propio fuera del repositorio.

**1. Las cifras del autor, reproducidas** (solo agregar al final, alfabeto `0 1 2 5 , .`, hasta 7
teclas, 335 922 secuencias por idioma):

```
es dinero {"total":335922,"sinComaCambia":0,"cifraARechazo":125259,"soloTexto":84799,"rechazoACifra":0,"cifraAOtra":0,"igual":125864}
es entero {"total":335922,"sinComaCambia":0,"cifraARechazo":88399,"soloTexto":121659,"rechazoACifra":0,"cifraAOtra":0,"igual":125864}
en dinero  (idéntico a es)
en entero  (idéntico a es)
```

Cuadran una a una con lo que dice la tarjeta D18.

**2. Con borrar, suprimir, mover el cursor, pegar, pegar sobre todo y salir del campo** (12 teclas:
`0 1 5 , . ⌫ Supr ← → pegar«2,5» pegar-sobre-todo«1,500» salir`, todas las secuencias):

```
desde ''      hasta 6 teclas: total 3257436  igual 2324432  cifra→rechazo 906626  rechazo→cifra 2309   cifra→otra 24069  sin coma: 597870, distintas 0
desde '1,500' hasta 5 teclas: total  271452  igual  209857  cifra→rechazo  58023  rechazo→cifra    6   cifra→otra  3566  sin coma:  66429, distintas 0
desde '25'    hasta 5 teclas: total  271452  igual  193871  cifra→rechazo  72646  rechazo→cifra   78   cifra→otra  4857  sin coma:  66429, distintas 0
```

**Corrección de una afirmación del autor**: «ninguna pasa de una cifra a otra ni de rechazo a cifra»
es cierta **solo para teclear de corrido**. Con retroceso aparecen diferencias, por ejemplo:

```
0 0 , ⌫  desde «1,500»  →  nuevo 150,000 | antes 15,000
0 0 0 , ⌫ desde «25»    →  nuevo 25,000  | antes 2,500
```

**Y las diferencias son a favor del arreglo**: antes la coma tecleada desaparecía, así que el
retroceso siguiente **borraba una cifra** que nadie quería borrar. Comprobado con un invariante
(cursor al final, `0 1 5 , . ⌫`, hasta 8 teclas, 2 015 538 secuencias): «si el campo acepta la
cifra, sus dígitos son los que quedan de lo tecleado»:

```
{"nuevo":0,"viejo":143150,"total":2015538}
  viejo 0 0 0 0 1 0 , ⌫ => 1   (lo tecleado: 000010)
```

La función nueva no pierde ni inventa una cifra en ninguna; la vieja, en 143 150.

**3. Al azar, sin coma de la persona** (100 000 secuencias de 5 a 20 teclas con cifras, punto, `-`,
⌫, Supr, ←, →, teclear-sobre-todo, pegar «250», salir; desde '', '1,500', '12,345.6', '7'):

```
azar 100000 distintas 0
```

Texto y cursor idénticos a la función de antes en todas (el autor dijo 30 000; repetido con más).

**4. «Teclear igual que pegar»** (solo agregar, `0 1 5 , .`, hasta 9 teclas, 2 441 405):

```
{"total":2441405,"igual":2428715,"tecValPegInv":12690,"tecInvPegVal":0,"distintos":0}
  tecleado vale, pegado no: 00001,000 -> 1,000
```

Nunca da tecleado una cifra distinta de la pegada. Las 12 690 donde tecleado vale y pegado no son
de dos tipos, los dos visibles y anteriores a D18: el campo quita los ceros a la izquierda
(«00001,000» → «1,000») o la coma se teclea **sobre** una coma que puso el campo («1500» → «1,500»,
luego «,000» → «1,500,000»), y lo que se ve es lo que se manda.

### La huella `captura-cifra.es-en.test.ts`, recalculada

Batería de la prueba ejecutada con el módulo de `a91580bb` y con el de HEAD:

```
sin idioma filas 116000 huella viejo e5240e24…02fda3 nuevo 4d4a09e4…0afe7c distintas 68
es         filas 116000 huella viejo e5240e24…02fda3 nuevo 4d4a09e4…0afe7c distintas 68
en         filas 116000 huella viejo 2bcafc85…81f31a5 nuevo 5fd46944…00e61 distintas 68
```

- La huella del módulo de `a91580bb` es `e5240e24065a685350c809d98a02f6a07ba65f15ffef205896872af2c902fda3`
  = `HUELLA_DE_ANTES` de la prueba.
- Las 68 filas distintas son **exactamente** los índices de `CAMBIOS_D18`, en el mismo orden
  (comparación de cadenas: `IGUALES`).
- Límite que conviene saber: la batería llama a `formatearMientrasEscribe` **un evento cada vez** y
  sin `comasPropias`. El estado entre teclas (`teclearCifra`) no lo cubre la huella; lo cubren
  `captura-cifra.d18.test.ts` y las mediciones de arriba.

### Volcado HTML de toda la suite (`I18N_VOLCAR_TODO`), antes y después

```
a91580bb : Test Files 411 passed · Tests 8649 passed | 1 skipped · 5239 archivos
598a3a25 : Test Files 412 passed + 1 failed · Tests 8789 passed | 1 failed | 1 skipped · 5881 archivos
diff -rq : 0 HTML distintos · «Only in despues: lib_i18n_cifras-d18.test.ts» (la prueba nueva)
           · _italiano.txt distinto solo en ORDEN (1837 líneas en los dos; ordenadas, iguales)
```

La falla de la segunda corrida es `scripts/semilla-catalogo-demo.test.ts` por **tiempo** («Test
timed out in 5000ms») con el volcado escribiendo a disco; en la corrida normal pasa (8790 verdes de
arriba) y no toca nada de D18. Se repitió: misma falla, mismo resultado del volcado.

Confirma lo que dice el autor: 0 pantallas distintas.

### Mutantes contra las unitarias (13, en un worktree temporal en `598a3a25`)

Línea base: `Test Files 10 passed · Tests 260 passed`
(`captura-cifra.d18`, `cifras-d18`, `captura-cifra.es-en`, `captura-cifra.italiano`, `captura-cifra`,
`components/demo/ui`).

| Mutante | Resultado |
|---|---|
| M1 quitar `insertoUnaComa` de la guarda (`captura-cifra.ts:354`) | MUERE (54) |
| M2 quitar `e.comasPropias` de la misma guarda | MUERE (16) |
| M3 `comasPropias` no se apaga cuando no quedan comas (`:453` y siguiente) | MUERE (2) |
| M4 lo pegado con coma no cuenta como de la persona | MUERE (2) |
| M5 `cifraAMedias` siempre `true` en es (`:476`) | MUERE (24) |
| M6 `cifraAMedias` admite un 0 inicial («0,5» a medias) | MUERE (2) |
| M7 repintar también a media escritura (`CampoCifra.tsx:138`) | MUERE (2) |
| M8 salir del campo no apaga `escribiendo` (`:205`) | MUERE (18) |
| M9 Enter no apaga `escribiendo` (`:212`) | MUERE (2) |
| M10 lo pegado también va «a medias» (`:193`) | MUERE (2) |
| **M11** salir con una cifra INVÁLIDA también apaga `comasPropias` (`:206`) | **SOBREVIVE** |
| M12 `CampoCifra` no pasa `comasPropias` a `teclearCifra` (`:184`) | MUERE (6) |
| **M13** el repintado del padre no apaga `comasPropias` (`:144`) | **SOBREVIVE** |

11 de 13 mueren. Los dos que sobreviven van en B86. Los mutantes se aplicaron en una copia, nunca en
el worktree `d18`; el worktree temporal se borró al terminar.

## Hallazgos, por severidad

### 1 · (fuera de D18, dinero, hoy) `EntradaCifra` en español e inglés guarda «12,5» como 0 → D19

- `app/(app)/(shell)/comisiones/page.tsx:296`: `cambiado = !cifraIlegible(comision, idioma) && Number(comision) !== …`.
  En es/en `cifraIlegible` es siempre `false` (`lib/captura-cifra.ts:490`) y `Number('12,5')` es
  `NaN`, así que `cambiado` es `true` y Guardar (`:341`) o Enter (`:326`) mandan
  `comisionAgenciaPct: Number(comision) || 0` → **0**.
- Alta de agencia: `comisiones/page.tsx:206`, mismo `Number(comision) || 0`.
- Comisión de la propuesta: `app/(app)/(shell)/propuestas/page.tsx:1224`, `comisionPct: Number(comision) || 0`.
- Son campos de texto (`EntradaCifra` sin `type="number"`), así que el «12,5» llega tal cual.
- Los que son `type="number"` (descuento de la propuesta, tope, cupones, volumen) dependen de lo
  que haga el navegador con una coma: **no verificado** sin navegador.

Es comportamiento anterior, se dejó a propósito el 04/11 y la tarjeta D18 ya lo avisa. No es deuda
de esta rama: es una decisión nueva (tarjeta D19 abajo).

### 2 · B85 · Pegar encima de una cifra con las mismas comas no cuenta como coma de la persona

`teclearCifra` decide que la persona «puso» una coma si el cambio trae **más** comas que antes
(`lib/captura-cifra.ts:453`). Pegar sobre una selección cambia el texto entero sin cambiar
necesariamente el número de comas:

```
""      -> pega 1,500 (comasPropias=true)  + 0 => 1,5000  RECHAZA
"2,000" -> pega 1,500 (comasPropias=false) + 0 => 15,000  15000
```

La regla escrita en la propia función («una coma que pone la PERSONA —tecleada, o en un texto
pegado— se queda donde la puso») y la prueba «lo pegado con coma cuenta como de la persona» solo se
cumplen pegando en un campo vacío o con menos comas. Reemplazar una tarifa ya escrita
(seleccionar todo y pegar) es el caso normal de edición.

Severidad baja-media: lo que se ve es lo que se manda (15,000) y es el comportamiento de antes de
D18, pero es exactamente el patrón que D18 quería cerrar («1,500» + 0 → «15,000» sin aviso).
**Cómo se cierra:** en `insertFromPaste`/`insertFromDrop`, `pone` = el texto resultante lleva coma
(no «hay más que antes»); prueba roja con «2,000» → pegar «1,500» → «0». **Quién:** el ejecutor de
la rama. Un caso parecido y rarísimo, de antes de D18: seleccionar «,0» de «2,000» y teclear «,» se
interpreta como un retroceso y da «200».

### 3 · B84 · El gemelo italiano: «1.500» + «0» → «15.000», sin aviso

Medido con `teclearCifra(…, 'it')`, tecla a tecla:

```
it 1.5000  : 1 > 1. > 1.5 > 1.50 > 1.500 > 15.000         => 15000
it 1.2345  : 1 > 1. > 1.2 > 1.23 > 1.234 > 12.345         => 12345
es 1,5000  : 1 > 1, > 1,5 > 1,50 > 1,500 > 1,5000         => RECHAZA
```

Es el **mismo defecto** que D18 corrige en español, con el signo intercambiado: B77 dejó el punto
tecleado donde cae, pero en cuanto el texto vuelve a parecer canónico («1.500»), la tecla siguiente
lo regrupa. Pegado, «1.5000» se rechaza; tecleado, da 15 000. Incumple lo que B77 prometió en su
propia prueba («en italiano, lo TECLEADO acaba igual que lo pegado»).

**Recomendación: arreglarlo igual, sin decisión nueva.** El dueño ya fijó el principio para el
italiano en B77 («lo tecleado acaba igual que lo pegado») y lo repitió en D18 para es/en; no hay
nada que elegir, solo aplicar el mismo estado (`comasPropias` → «separadores propios») en la rama
italiana de `teclearCifra`, que hoy devuelve `comasPropias: false` siempre
(`lib/captura-cifra.ts:439` y siguientes). El italiano está apagado en los servidores con clientes:
urge **antes de encenderlo**, no antes de fusionar esto.

### 4 · B86 · Dos mutantes sobreviven (huecos de prueba, sin defecto medido hoy)

- **M11** · al salir con una cifra inválida también se apaga `comasPropias`. Con un mínimo
  (`minimo: 1500`), «1,000» tecleado es inválido; con el mutante, salir y volver a teclear «0» daría
  «10,000» (válido) en vez de «1,0000» (rechazado). El código de hoy lo hace bien
  (`CampoCifra.tsx:206`), pero nada lo protege.
- **M13** · el repintado del padre no apaga `comasPropias`. Con el mutante, tras un repintado con
  comas del campo («1,500»), la cifra siguiente dejaría de reagrupar. Tampoco lo vigila nada.

**Cómo se cierra:** una prueba por cada uno en `lib/i18n/cifras-d18.test.ts` (el arnés ya tiene
`salir()` y `refs: true`). **Quién:** el ejecutor. Menor.

### 5 · Menores, de lectura (no van al expediente)

- **El repintado del padre se aplaza mientras el texto va «a medias»** (`CampoCifra.tsx:138`): si
  el formulario limpia el campo o precarga otro registro con el foco dentro y «1,5» escrito, el
  campo no se repinta hasta salir. Al salir sí (la condición se reevalúa en cada render). Es lo que
  pretende el cambio y lo prueba «…y si lo deja mal puesto, al salir enseña lo que el padre guardó».
- **Formularios que se quedan con el último valor válido** (cantidad de la propuesta,
  `propuestas/page.tsx:1590`) **o acotan a 0 lo ilegible** (reserva, `ReservaDialog.tsx:336`):
  mientras se escribe «1,5» el campo lo enseña y el padre guarda el valor de antes (o 0). Ninguno de
  los dos está dentro de un `<form>` (`grep "<form\|onSubmit"` vacío en los dos archivos), así que
  Enter no envía; un clic en el botón saca antes el foco del campo y el campo se repinta con lo que
  el padre guardó. **No verificado en un navegador** el orden real de `blur` → repintado → `click`.
- **Guardias de `'NaN'`**: D18 no inventa un valor nuevo; produce más a menudo el mismo `'NaN'` que
  en es/en ya llegaba al pegar «2,5». Las guardias por `CRUDO_INVALIDO` existen en los formularios
  con `CampoCifra` (`grep -rn "CRUDO_INVALIDO\|cifraIlegible" app components`: administración, propuestas,
  contratos, candado, alta de sitio, ficha, rejilla, inventario, asistente, importar…). Las tres de
  `cifras-d18.test.ts` se prueban pulsando el botón aunque esté apagado. **No revisé una por una**
  las ~20 en esta pasada.
- **«NaN» a la vista** al cambiar de idioma con un `'NaN'` guardado: `pintarCrudo('NaN', …)` pinta
  el texto «NaN» (`lib/captura-cifra.ts:255-260`, por `ponerComas`, que devuelve intacto lo que no
  entiende). Es anterior a D18; D18 lo hace algo más probable. Feo, no peligroso: sigue bloqueado.

## Alcance (punto 6)

```
git diff --name-only a91580bb..HEAD | grep -E "app/api|lib/server|middleware|db/|migrat|auth|aislamiento|servidor-e2e|schema.sql"
(vacío)
```

Archivos tocados: `CampoCifra.tsx`, `captura-cifra.ts`, tres pruebas, el arnés
`lib/test/formulario-sin-dom.ts` (gana `salir()`, `pulsarTecla()` y `useRef` con memoria **solo con
`refs: true`**; sin él, el de siempre), `CLAUDE.md`, bitácora, `ABIERTOS.md`, `convenciones.md` y el
diario. Nota de bóveda en el mismo commit que el código (`598a3a25` toca `convenciones.md`).
`aislamiento.e2e.test.ts`, `servidor-e2e.ts` y `db/schema.sql`: fuera del diff.

Recuentos (`node scripts/recuentos.mjs` en el worktree `d18`): 117 notas, **1672** enlaces, 3
wikilinks rotos (los tres ADR de siempre), 0 huérfanas. `CLAUDE.md` dice 1672: cuadra. Ninguna cita
`archivo:línea` de `vault/` apunta a los archivos cambiados; las que hay están en `docs/` (históricas).

## Qué NO pude verificar, y por qué

- **E2E**: no corridas (indicación de no levantar servidores; el cambio no toca servidor).
- **La interfaz en un navegador**: no la miré. No puedo afirmar cómo se ve el borde rojo, el
  aviso al salir ni el orden real `blur` → repintado → `click` en Chrome/Safari/Firefox.
- **Qué hace un `<input type="number">` con «12,5»** en los campos `EntradaCifra` de es/en
  (descuento de la propuesta, tope, cupones): depende del navegador; sin navegador, no verificado.
- **Las ~20 guardias de `'NaN'`** de los formularios con `CampoCifra`, una por una: no revisadas en
  esta pasada (sí las tres que prueba la rama y el argumento de que el valor no es nuevo).
- **El árbol fusionado**: no hay merge que auditar; medí la rama sobre su base `a91580bb`.

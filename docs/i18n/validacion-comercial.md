# Validación · lote de inglés «comercial»

- **Rama:** `feat/ingles-comercial` (worktree `.claude/worktrees/ingles-comercial`). Diff revisado: `git diff integra/ingles...HEAD`, tres commits (`76e815db`, `bcd2c6fd`, `de7ad5f3`), 19 archivos.
- **Fecha:** 2026-11-02. **Validador:** agente independiente. No corrige código; este informe es lo único que escribe, y no está commiteado.

## Veredicto: **ÁMBAR**. Se puede integrar después de corregir lo de abajo.

Comprobado de forma mecánica:

- El español está intacto: 23 de 23 estados idénticos byte a byte frente a los componentes de `integra/ingles`, y 557 de 557 valores `es` reconciliados con el código viejo.
- Los espejos reproducen las etiquetas originales.
- No se tocó nada prohibido y no hay dinero en el diccionario.
- Typecheck y unitarias en verde. Los 6 mutantes mueren.

El inglés se lee como software B2B en casi todo el lote. Hay **4 hallazgos de severidad media**:

1. Incumple el glosario fijado después de que empezara el traductor: «per 14-day period».
2. Un estatus en minúsculas que en inglés pinta «no **po**».
3. «3 of no cap».
4. «press Clear» en vez de «click».

Además hay unos 14 de severidad baja y una nota de la bóveda que fija un término ya revocado.

---

## 1 · Hallazgos de sentido en contexto

Las líneas son del valor `en` en `apps/web/lib/i18n/textos/comercial.ts` (o `codigos.ts`) y del punto de uso. Cada frase se leyó en el HTML inglés rendido de los 23 estados, o en su punto de uso cuando el estado no la rinde.

| clave | archivo:línea | inglés actual | problema | propuesto | sev. |
|---|---|---|---|---|---|
| `comercial.tarifas.fija` | comercial.ts:831 · `SiteFicha.tsx:1072` | ` This screen is {fija}, so it is only sold monthly or per 14-day period.` | Incumple el glosario fijado (catorcenal → «every two weeks»). | ` This screen is {fija}, so it is only sold monthly or every two weeks.` | **media** |
| `comercial.ficha.no-reservable` | comercial.ts:733 · `SiteFicha.tsx:365` | `Site {estatus} · not available to book` | El código hace `.toLowerCase()` del estatus en los dos idiomas. En el render inglés sale «**Site booked · no po · not available to book**»: la sigla PO queda en minúsculas y además se lee como una cadena de tres trozos. En español «sin oc» ya estaba así en el código viejo. | Aplicar `.toLowerCase()` solo en español, y en inglés `Not available to book (status: {estatus})`, que da «Not available to book (status: Booked · no PO)». | **media** |
| `codigos.usos` + `codigos.sin-tope` | codigos.ts:147 · `GestionCodigos.tsx:324` | `{usos} of {tope}`, con tope = `no cap` | Se ve en el render: «**0 of no cap**», «**3 of no cap**». El español viejo ya decía «3 de sin tope» (`GestionCodigos.tsx:319` de `integra/ingles`), pero en inglés no se sostiene. | Clave nueva `codigos.usos.sin-tope`: en `{usos} (no cap)`, en es `{usos} de sin tope` (el español no cambia). | **media** |
| `comercial.pagina.vacio.quitar-filtro` | comercial.ts:695 · `comercial/page.tsx:484` | ` Remove a filter or press Clear.` | El glosario manda «Click». | ` Remove a filter or click Clear.` | **media** |
| `comercial.pagina.kpi.bloqueadas.sub` | comercial.ts:677 · `comercial/page.tsx:313` | `incomplete contract: fix it in Landlords` | El sujeto son las pantallas, en plural. | `incomplete contract: fix them in Landlords` | baja |
| `comercial.pagina.vacio` | comercial.ts:690 · `page.tsx:461` | `No screen matches: {filtros}.` | En inglés natural va en plural tras «no», igual que se corrigió en el piloto. | `No screens match: {filtros}.` | baja |
| `comercial.negociacion.lista.sin-resultados` | comercial.ts:1120 · `ComercialOpex.tsx:1294` | `No space matches. Clear the filter…` | Lo mismo. | `No spaces match. Clear the filter to see all spaces ({n}).` | baja |
| `comercial.reserva.loop.referencia` | comercial.ts:929 · `ReservaDialog.tsx:259` | `(reference, from Settings → Configuration)` | «Settings → Configuration» es redundante: dos palabras para lo mismo. «reference» suelto tampoco dice qué es. | `(reference value, set in Settings)` | baja |
| `comercial.tarifas.titulo` / `ficha.tarifas-unidad` / `ficha.tarifas-franja` | comercial.ts:827 / 777 / 780 | `Rates by sales unit` · `Rates per unit` · `Rates by daypart` | Mezcla «by» y «per» para la misma idea en la misma ficha. | `Rates per sales unit` · `Rates per unit` · `Rates per daypart` (o «by» en las tres) | baja |
| `comercial.editar.cupo.ahora` | comercial.ts:866 · `SiteFicha.tsx:1542` | ` Right now it has {n}.` | Sale «…while slots remain. Right now it has 1.». No dice qué tiene. | ` It currently has {n} client(s).` (o `.uno/.otros`) | baja |
| `comercial.reserva.sin-cupo.fila.uno/.otros` | comercial.ts:935 · `ReservaDialog.tsx:291` | `{nombre} — {cupo} client on those dates ({ocupantes})` | Sale «Pantalla Reforma — 1 client on those dates (Bebidas Sur)». Se lee como «hay 1 cliente», cuando lo que dice es «el cupo es 1 y lo ocupa X». | `{nombre} — cap of {cupo} client on those dates, taken by {ocupantes}` | baja |
| `comercial.reserva.sin-cupo.ayuda` | comercial.ts:937 | `Remove those screens… raise their cap from their profile.` | Con una sola pantalla (estado «reservar una pantalla con slots propios») sale en plural. El español arrastra lo mismo. | Aceptable. Si se quiere: `Remove the screen(s) above…` | baja |
| `comercial.negociacion.ficha` | comercial.ts:998 · `ComercialOpex.tsx:316` | `Technical profile` | «Ficha técnica» de un predio. En inglés lo habitual es «spec sheet». | `Spec sheet` (y `ficha.guardar` → `Save spec sheet`) | baja |
| `comercial.negociacion.alta.nombre-ej` | comercial.ts:1097 | `E.g. Azotea Insurgentes 1420` | «Azotea» es una palabra española dentro del inglés. No es un nombre propio: es el tipo de predio. | `E.g. Rooftop Insurgentes 1420` | baja |
| `comercial.pagina.alta-hecha` / `pagina.reservados` | comercial.ts:708 / 711 | `Screen "{nombre}" added` · `Sites booked: "{nombre}"` | Comillas rectas, cuando el resto del inglés del lote usa “…” (`vacio.busqueda`, `responsable.pasar`, `lista.vacia`). | `Screen “{nombre}” added` · `Sites booked for “{nombre}”` | baja |
| `comercial.negociacion.kpi.seguimiento.parcial` | comercial.ts:1104 | `showing the {n} most recently active of {total}` | Con n=1 sale «showing the 1 most recently active of 5». | `showing the most recently active {n} of {total}` | baja |
| `comercial.comun.direccion-comercial` | comercial.ts:625 | `Commercial address` | En EE. UU. «commercial address» se lee como «domicilio de la empresa». Aquí es la dirección que se le enseña al cliente (el placeholder del alta ya dice «Address shown»). | `Display address` | baja |

**Revisado y correcto** (para no repetirlo):

- Pantallas y estatus: «Booked · no PO», «Free to sell / of 3 screens (filtered)», «screens in 1 open proposal · not blocking», «Occupied or blocked» (leyenda), «Owned / Owned screen», «Decommissioned».
- Permisos y estados de la pantalla: «Permit in order / expired / in process / suspended».
- Características: «Faces», «Facing» con North…Southwest (es el término OOH correcto para «vista»), «Display: digital · rotating / static», «Operating hours», «Slots per hour», «Slot length».
- Datos comerciales y renta: «Rent to landlord (monthly)», «Payment frequency», «Term» para la vigencia del contrato (correcto en arrendamiento, distinto de «Validity» de los códigos), «Client cap», «Usage cap», «Book (tentative)», «Monthly total».
- Space Eye: «Correct ad · confidence 93%», «Does not match the creative».
- Comercial negociación entera: etapas, canales, «Finding the decision-maker», «Legal representative confirmed», «Counteroffer», «Log contact», «Saved by Ana on Oct 1, 2026 · from the address search».
- Los textos largos de los códigos: «compounds… paying 51.2%, not 40%», «until the 30th includes the 30th» y «It consumes one use of the code and stays pending approval: … an admin or manager approves it».
- Plurales `.uno/.otros`: `descargadas`, `seleccionados`, `sin-cupo`, `meses`.

**Coherencia con los lotes ya hechos:** «negotiation code(s)», «sales rep», «landlord», «work order», «Settings» sin actuar como sujeto («set in Settings»), «draft», «quote», «Internal ref.» (no aparece) y «loops» (no aparece). El lote no usa nunca «promo», «coupon», «Tap» ni `{pct} %` con espacio.

---

## 2 · Español intacto: VERIFICADO (mecánicamente)

**a) Render frente a `integra/ingles`, byte a byte.**

- Copié con `git show integra/ingles:<ruta>` los 8 archivos del lote a un espejo temporal (`apps/web/__valviejo/`): las 2 `page.tsx`, `GestionCodigos`, `ComercialOpex`, `AltaSitioDialog`, `ReservaDialog`, `SiteFicha` y `SpaceEyeVision`.
- Reescribí sus importaciones cruzadas al espejo. El `./SelectorUbicacion` relativo de `ComercialOpex` lo pasé al alias, para que lo alcanzara el mismo `vi.mock`.
- Rendí los **23 estados** con una copia de `pantallas-comercial.test.ts` apuntada al espejo (mismos mocks, mismos `useState` forzados, mismo reloj) y con la prueba real, las dos con `VOLCAR_HTML`:

```
viejo: Tests 23 passed · nuevo: Tests 23 passed
diff -rq viejo nuevo   → sin salida (IDENTICOS, 23/23)
```

Para descartar que el espejo no se estuviera usando, metí un cambio en él (`Galería` → `GaleriaX` en el `SiteFicha` viejo): 4 archivos pasaron a diferir. Lo restauré. Después borré el espejo y las copias de la prueba.

**b) Cada valor `es` contra el código viejo.**

Usé un script que, para cada uno de los 557 valores `ES_COMERCIAL` + `ES_CODIGOS`, busca cada trozo entre huecos en el código viejo de los 8 archivos más `StatusBadge.tsx`, `lib/tipo-medio.ts`, `lib/captacion.ts` y `lib/negociacion.ts` (normalizando espacios como JSX).

- **549 de 557** aparecen literales.
- Las 8 restantes son frases que el código viejo armaba por ramas. Las reconstruí una por una y las **8 son exactas**:
  - `reserva.seleccionados.uno`: `${n} sitio${…}`, `ReservaDialog.tsx:175`.
  - `sin-cupo.fila.uno/.otros`: `{a.cupo}{' '}{cupo===1?'cliente':'clientes'} en esas fechas (…)`, `:278`.
  - `negociacion.pin.enlace/.coordenadas`: plantilla ternaria, `ComercialOpex.tsx:355`.
  - `buscar.ayuda`: JSX con `&apos;`/`&quot;`, `:408-409`.
  - `negociacion.ultimo.con`: `Último contacto{…? `: ${nombre}`}`, `:900`.
  - `codigos.asignado.reactivada`: concatenación, `GestionCodigos.tsx:185-186`.

**c) Espejos de etiquetas.**

- `claves.ts` cubre `CLAVE_SITIO_ESTATUS`, `CLAVE_TIPO_MEDIO`, `CLAVE_CONTRATO_ESTATUS` y `CLAVE_PAGO_ESTATUS`. `ComercialOpex` cubre `CLAVE_ETAPA`, `CLAVE_VISIBILIDAD`, `CLAVE_CANAL`, `CLAVE_OFERTA` y `CLAVE_RESPONSABLE`. La prueba exige las mismas claves y `es` === etiqueta original. Lo comprobé además con 2 mutantes (§5, M3 y M5): los dos mueren.
- Los mapas locales que el lote sustituye los comparé uno por uno con el viejo: `OPERATIVO_LABEL` y `LEGAL_LABEL` (`SiteFicha.tsx:95-108` viejo), `TIPO_CAMPANA` (`ReservaDialog.tsx:37-39`), el estado de negociación (`ComercialOpex.tsx:116-118`) y `VISTAS_CARDINALES`. Coinciden clave por clave.

**d) Huecos y bordes:** los huecos `{…}` son idénticos entre `es` y `en` en las 557 claves, y los espacios iniciales y finales también (0 diferencias).

---

## 3 · Nada en español dentro del inglés

**En el diccionario:**

- Ningún valor `en` lleva acentos, `ñ` ni `¿¡`. Las únicas coincidencias del filtro eran `·`, `²`, `©` y `°`.
- Hay 10 valores idénticos en los dos idiomas, todos legítimos: `No`, `Video`, `Digital`/`digital` (×3), `Manual`, `Global: {n}`, ` · {n} slots`, `Seguros Andinos` (dato de ejemplo) y `WhatsApp`.
- Única palabra española suelta: «Azotea» en `negociacion.alta.nombre-ej` (§1, baja).

**En las pantallas en inglés (HTML de los 23 estados):** todo lo que queda en español viene de módulos fuera del lote, y está declarado en la bóveda y en la cabecera de la prueba:

- Tarifas: `UNIDAD_LABEL` («Por hora», «Mensual», «Catorcenal», «CPS · costo por salida», «CPM · costo por millar») y la unidad de la tarifa publicada como dato («Published rate (mensual)»).
- Ficha: `periodicidadLabel` («Mensual»), `textoOrigenDoohmain` («del mapa del servidor (no está escrita en la ficha)»), `CalendarioDisponibilidad` («noviembre 2026», L M M J V S D, «confirmada», «en propuesta», «Mes anterior»).
- Insignias de la lista: `SlotsBadge` y `ClientesBadge` («clientes», «6 de 8 slots libres», «2 de 3 lugares de cliente libres»).
- Comercial negociación: los motivos de `lib/negociacion.ts` («El espacio está perdido: ya solo admite notas», «Para confirmar al responsable legal…»).
- El « (obligatorio)» de `Campo`.

Son datos de prueba: «Pantalla Reforma», «Don Pepe», «Lona rota», «Litigio del predio», «tiempo agotado», «CDMX».

**Cuando se traduzcan esos módulos**, les toca el glosario nuevo: «Per hour», «every two weeks» y «thousand».

---

## 4 · Reglas

- **Dinero en el diccionario:** no hay `$`, `MXN`, `USD` ni importes. Los números que quedan no son dinero: `Q3`, `1420`, `+30 días`, las coordenadas de ejemplo y el ejemplo didáctico `20 %`/`51,2 %`. Los importes entran por hueco (`{monto}`, `{total}`, `{simbolo}`).
- **Archivos prohibidos:** `git diff integra/ingles...HEAD --name-only` no toca `middleware.ts`, `nav.ts`, `db/schema.sql`, `db/migrations/`, `app/api/**`, `next.config.mjs`, `idiomas.ts` ni ningún `package.json`. `IDIOMA_INGLES` solo aparece en la prueba (`process.env.IDIOMA_INGLES = '1'`).
- **`desktop.ini`:** ninguno en el diff, y `git ls-files | grep -c desktop.ini` da 0 en esta rama.
- **Datos guardados:**
  - La vista cardinal guarda el valor español: `<option value={d}>{t(VISTA_CLAVE[d])}</option>` (`SiteFicha.tsx:1452`). Un valor fuera de la rosa de los vientos se conserva tal cual (`:1454`), y la ficha traduce solo al pintar (`:481`).
  - **Excepción declarada:** el nombre por omisión de una reserva sin nombre se GUARDA en el idioma de quien la crea (`ReservaDialog.tsx:157`, «X — campaign»). En español no cambia nada, pero contradice la regla general. Ver §6.
- **Nota de la bóveda:** `vault/03-Frontend/idiomas-es-en.md`, en «Glosario añadido» del lote comercial, fija «catorcenal → *per 14-day period*», que ya está revocado. Hay que corregirlo junto con `tarifas.fija`. «Valla → *Hoarding* (para revisar)» depende de §6.

---

## 5 · Pruebas (corridas por mí en este worktree)

```
cd apps/web && npm run typecheck   →  tsc --noEmit, sin errores
cd apps/web && npm test            →  Test Files 324 passed (324) · Tests 4305 passed (4305)
```

Corrí los mutantes contra `npx vitest run lib/i18n` (248 pruebas). Restauré cada uno con `git checkout -- lib/i18n components/demo` y comprobé `git status` vacío después de cada uno:

| # | mutante | resultado |
|---|---|---|
| M1 | `en` de `comercial.tarifas.fija` puesto en español. La clave **no se rinde en ningún estado** (rama de pantalla fija dentro del cuadro de tarifas). | **MUERE** (3 rojas: instantánea EN, «igual a la española» y «lleva acentos») |
| M2 | `es` de `codigos.asignado.reactivada`: «borrador» → «borador». Es un aviso emergente y no se rinde. | **MUERE** (instantánea ES) |
| M3 | `es` de `comercial.tipo-medio.valla` = «Vallas» | **MUERE** (espejo `TIPO_MEDIO_LABEL` + instantánea ES) |
| M4 | `SiteFicha.tsx:454`: `{t('comercial.ficha.galeria')}` → literal «Galería» | **MUERE** (1 roja: «en INGLES no queda…», ficha digital) |
| M5 | `CLAVE_ETAPA`: `RECHAZADO` ↔ `PERDIDO` intercambiados | **MUERE** (espejo de etapas) |
| M6 | `en` de `pagina.vacio.quitar-filtro` sin el espacio inicial | **MUERE** (instantánea EN) |

El árbol quedó limpio salvo este informe (`git status --short` sin nada fuera de los `desktop.ini` sin rastrear de OneDrive).

**Debilidades de la prueba (no bloquean):**

- **127 de las 557 claves no aparecen en el texto inglés de ningún estado.** Medido sobre el texto visible, sin atributos, así que algunas sí salen en `title` o en `placeholder`. Son sobre todo avisos emergentes, errores, estados «…ando», ramas raras y estatus poco frecuentes. Las cubren las instantáneas y la regla «inglés ≠ español», como demuestran M1 y M2, pero un error de SENTIDO en ellas no lo ve ninguna prueba: solo una lectura.
- El barrido del diccionario ignora trozos de menos de 8 caracteres. M4 murió solo porque «Galería» estaba en la lista a mano de un estado. Una palabra corta olvidada en un estado sin lista a mano pasaría.

---

## 6 · Decisiones de glosario que le tocan al dueño

1. **«Comercial negociación» → «Commercial negotiation».**
   - El lote es **coherente con el menú**: `nav.comercial-opex` ya dice «Commercial negotiation» en `integra/ingles` (`diccionario.ts:350`), y `comercial.negociacion.titulo` lo repite.
   - **El incoherente es el par del menú**: «Comercial» → «Sales» y, a su lado, «Comercial negociación» → «Commercial negotiation». El módulo no es de ventas: es prospección y negociación de renta con **arrendadores** (la descripción ya dice «Landlord prospecting…»).
   - Propuesta: **«Site acquisition»**, que es el término del sector OOH para conseguir y negociar espacios, o «Lease negotiation». Hay que cambiar a la vez `nav.comercial-opex` y `comercial.negociacion.titulo`. Las dos son claves del diccionario, no hace falta tocar `nav.ts`.
   - Relacionado y fuera del lote: el lote de campañas traduce `campanas.ficha.comercial` como «Commercial», no como «Sales».
2. **Valla → «Hoarding».** Es británico y significa sobre todo la valla de obra. En EE. UU. casi no se usa. Alternativas:
   - **«Poster panel»**: el formato estático a pie de calle, más pequeño que el espectacular. Es mi propuesta.
   - «Poster».
   - «Fence board».
   - El espectacular ya es «Billboard», así que no conviene usar «billboard» para las dos.
3. **Mural → «Wall mural».** Es correcto, pero «Mural» a secas también es inglés y es lo habitual. Si se elige, hay que declararlo entre las entradas idénticas permitidas.
4. **«Reservado» (sitio) = «Booked», pero en el lote de campañas «Reservada» (etapa) = «Reserved»** (`campanas.etapa.reservada`). Son conceptos distintos, pero la misma raíz traducida de dos formas confunde. Conviene elegir una para los dos lotes. Recomiendo «Booked», coherente con «Book (tentative)».
5. **«Used up» para «Agotado»** (estado del código). Es correcto pero coloquial. Alternativas: «Limit reached» o «Fully used».
6. **ficha → «profile».** Funciona («raise their cap from their profile», «pin it on the profile»), pero para la ficha técnica del predio queda mejor «spec sheet» (§1). Hay que decidir si «profile» se queda para la ficha de la pantalla.
7. **El nombre por omisión de una reserva se guarda en el idioma de quien la crea.** ¿Se acepta, o debe guardarse siempre «— campaña», como la vista cardinal? Es lo único del lote que escribe datos según el idioma.
8. Sin objeción, por si se quieren revisar: «Facing» (correcto en OOH), «Road segment» (tramo), «Supplier code» y «Client cap / Usage cap».

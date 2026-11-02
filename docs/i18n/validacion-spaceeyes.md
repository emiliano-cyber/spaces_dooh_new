# Validación · lote de inglés «Space Eyes»

- **Rama:** `feat/ingles-space-eyes` (worktree `.claude/worktrees/ingles-space-eyes`). Diff revisado: `git diff ec427a66..HEAD`, dos commits (`4f8e53c7` la prueba de pantallas, `144fefbf` la traducción), 31 archivos.
- **Fecha:** 2026-11-02. **Validador:** agente independiente. No corrige código. Este informe es lo único que escribe, y no está commiteado.

## Veredicto: **ÁMBAR**. Se puede integrar después de corregir lo de abajo.

Comprobado de forma mecánica:

- **El español está intacto.** 95 de 95 estados son idénticos byte a byte frente a los componentes de `ec427a66`, con la misma prueba y los mismos datos en los dos lados.
- **Las funciones con texto dan el mismo español.** `hace`, `fechaHora`, `calidadSenal` y `comoSeActualiza` coinciden en 5869 comparaciones, sin idioma y con `'es'`, frente a la versión vieja.
- **El servidor sigue llamando sin idioma**, así que recibe el español de siempre.
- **La evidencia no cambia.** No se tocaron la marca que se graba en la foto ni el ticket de activación.
- **Nada prohibido.** No se tocó ningún archivo vedado, no hay `desktop.ini` y no hay dinero en el diccionario.
- **Pruebas.** Typecheck limpio y **4828/4828** unitarias en verde.

Hay **5 hallazgos de severidad media**:

- Tres son de texto:
  1. Un error en español que se cuela en la pantalla inglesa y no está declarado: «Space Eye respondió 500».
  2. «Updates: Updates on its own.»
  3. «One code for all 2 … Device number 3 is not let in».
- Dos son huecos de prueba: **dos de los 7 mutantes sobreviven**.
  4. Quitar el idioma de un `fechaHora`.
  5. Traducir la marca de la foto. El encargo exigía que este muriera.

Además hay unos 13 de severidad baja.

---

## 1 · Hallazgos de sentido en contexto

Las líneas son del valor `en` en `apps/web/lib/i18n/textos/spaceeyes.ts` y del punto de uso. Cada frase se leyó en el HTML inglés rendido de los 95 estados: 1163 textos visibles distintos, extraídos de los nodos de texto y de los `title`, `aria-label`, `placeholder` y `alt`. Cuando el estado no rinde la frase, se leyó en su punto de uso.

| clave | archivo:línea | inglés actual | problema | propuesto | sev. |
|---|---|---|---|---|---|
| (sin clave) | `components/demo/space-eyes/Graficas.tsx:271` · `lib/data/space-eyes-se.ts:27` | `throw new Error(\`Space Eye respondió ${r.status}\`)` | Es un literal español del cliente, no del servidor. En inglés sale «**Could not export the CSV. Space Eye respondió 500**», y lo mismo en cualquier error de Space Eye sin cuerpo JSON (Galería, Gráficas…). No está en la lista de lo que no se traduce: esa lista declara `space-eyes-whep` y `space-eyes-marca`, no esto. La prueba lo enmascara porque fuerza ese texto como si fuera un dato del servidor (`pantallas-spaceeyes.test.ts:1837` y `:2454`). | Clave `spaceeyes.comun.respondio` → es `Space Eye respondió {status}` / en `Space Eye returned {status}`, con `idioma` en `space-eyes-se.ts` y `'es'` por omisión. | **media** |
| `spaceeyes.admin.actualizaciones` | spaceeyes.ts:1642 · `EquipoAdmin.tsx:517` | `Updates: {como}` | Con `como` = `comoSeActualiza(...)` sale «**Updates: Updates on its own.**» y «Updates: Needs a site visit: this version…», con dos «:» seguidos. En español («Actualizaciones: Se actualiza sola.») no choca. | `Update mode: {como}` (o `How it updates: {como}`) | **media** |
| `spaceeyes.alta.lote.qr` / `.archivo` / `.codigo` | spaceeyes.ts:2187 / 2189 / 2191 · `AltaDispositivo.tsx:360` | `One code for all {n}: each device joins separately. Device number {siguiente} is not let in, and you can cancel it at any time.` | Se ve en el render: «One code for all **2**», «**Device number 3 is not let in**». No es inglés natural. | `One code for {n} devices: each one joins separately. A device beyond the {n}th is refused, and you can cancel the code at any time.` O, sin ordinal: `…Once {n} devices have joined, any other is refused…` (los huecos tienen que seguir siendo los mismos). | **media** |
| `spaceeyes.sin-respuesta.soporte`, `demo.listo`, `demo.listo.folio` | spaceeyes.ts:1169 / 1233 / 1235 | `… from Settings › Configuration › Support.` | «Settings › Configuration» es redundante: es la misma objeción que el validador de Comercial le hizo a «Settings → Configuration». Además, la pestaña «Configuración» de Administración aún no tiene inglés, así que no hay garantía de que se llame así. | Depende del lote de Administración. Por ahora: `… from Settings › Support.` (ver §7). | baja |
| `spaceeyes.lista.kpi.de-equipos` | spaceeyes.ts:1265 · `ListaEquipos.tsx:165` | `of {n} devices` | Con una flota de un equipo sale «of 1 devices». | `.uno/.otros`: `of {n} device` / `of {n} devices` | baja |
| `spaceeyes.prog.todos.texto` | spaceeyes.ts:2027 · `Programacion.tsx:652` | `Applies to the {n} devices in the fleet…` | Con n = 1 sale «the 1 devices». El render ya pinta «the 0 devices». | `.uno/.otros`, o `Applies to every device in the fleet ({n}), including any registered later.` | baja |
| `spaceeyes.fallas.donde.gabinetes` | spaceeyes.ts:1866 · `FallasFlota.tsx:84` | `Cabinets {lista}` | Se ve en el render: «Area · **Cabinets 2**» con un solo gabinete. El español viejo ya decía «Gabinetes 2». | `.uno/.otros` según `g.length`: `Cabinet {lista}` / `Cabinets {lista}` | baja |
| `spaceeyes.galeria.origen.on-demand` vs `spaceeyes.ficha.origen.demanda` | spaceeyes.ts:1805 / 1320 | `On request` / `on demand` | Es el mismo origen de foto (`on_demand`) dicho de dos maneras. El español también difiere («A petición» / «a demanda»), pero el inglés puede unificarse sin tocarlo. | `On demand` en las dos | baja |
| `spaceeyes.falla.a-mano`, `galeria.descripcion`, `prog.vacio.texto` | spaceeyes.ts:1378 / 1828 / 2009 | ` · by hand` · `requested by hand` · `requests them by hand` | En software, «by hand» suena casero. Lo idiomático es «manually». | ` · manually` · `requested manually` · `requests them manually` | baja |
| `spaceeyes.vivo.corte.ayuda`, `vivo.se-detiene`, `vivo.en-uso.texto` | spaceeyes.ts:1732 / 1751 / 1788 | `…so it does not use the device data` · `…uses the site mobile data` | Falta el posesivo: se lee «the device data» como un nombre compuesto. | `…so it does not use the device’s data` · `…uses the site’s mobile data` | baja |
| `spaceeyes.vivo.sin-servidor` | spaceeyes.ts:1710 | `It is a server issue, not the device.` | No es paralelo: compara «issue» con «device». | `It is a server issue, not a device issue.` | baja |
| `spaceeyes.admin.estado-ayuda` | spaceeyes.ts:1612 | `…In operation and active behave the same today.` | Son nombres de estatus que flotan sin marcar. «today» se lee como «hoy, este día». | `…“In operation” and “Active” currently behave the same.` | baja |
| `spaceeyes.admin.cuadros.texto` | spaceeyes.ts:1672 | `Against screen lines: each frame…` | «Against» al inicio de la frase suena a traducción literal de «Contra». | `Reduces screen lines: each frame…` | baja |
| `spaceeyes.admin.actualizar.pc` (y `.pi`) | spaceeyes.ts:1614 | `It checks the file fingerprint…` | En inglés técnico se dice «checksum» o «hash». | `It verifies the file checksum…` | baja |
| `spaceeyes.creativo.visto.uno/.otros` | spaceeyes.ts:1384 | `Seen {n} times · last {hace}` | Sale «Seen 3 times · last 3 min ago». | `Seen {n} times · last seen {hace}` | baja |
| (formato) | `Programacion.tsx:219` | `Nov 02, 12:30 (in 30 min)` | Es el único sitio del lote en inglés con día en dos cifras y reloj de 24 h. El resto usa «Nov 2, 2026, 11:30 AM» (`formatFechaHora`). El español no cambia. | En inglés, `day: 'numeric'` y sin `hour12: false`. O `formatFechaHora(…, 'en')` sin el año. | baja |
| (formato) | `Galeria.tsx:602` | `Reforma 222 · 11/2/2026, 11:59:00 AM · GPS …` | El pie del visor usa `toLocaleString('en-US')` a pelo: segundos y fecha numérica, distinto del resto del lote. | En inglés, `fechaHora(foto.taken_at, 'en')`. El español se deja como está. | baja |
| `spaceeyes.historial.aria` (+ unidad) | spaceeyes.ts:1362 · `Historial.tsx` | `…Worst value in the range: no data dBm.` | Pegan la unidad a «no data». En español viejo pasaba igual («sin dato dBm»). | No poner la unidad cuando el valor es «no data». | baja |

**Revisado y correcto** (para no repetirlo):

- **Términos del encargo:**
  - Device / Devices (igual que el menú).
  - Fault / Faults, y la alerta que manda el equipo → alert.
  - Live view.
  - Verification («Verification on», «Verified · correct / does not match», «Verification failed»).
  - Activation request.
  - Fleet («across the fleet»).
  - Cabinet: es el término estándar de LED.
  - Framing («Lock framing», «The screen framing changed»).
  - Monitoring («Screen monitoring», «Monitoring continuously», «Monitoring off»).
  - Pairing code(s) / «Pending pairing».
  - Label («Show label», «Label turned off», «Photo label»).
  - Scheduling / schedule.
  - «Not reporting», que es mejor que «no connection» para un equipo que no reporta.
- **Frecuencias fijas, todas en letra:** «Every half hour», «Every two hours», «Every twelve hours», «Batched every four hours», «Every five minutes (testing)». Las variables (`Every {n} min`, `Every {n} h`, `Batched every {n} min`) llevan cifra porque el número es un dato. Es aceptable y lo deja pasar la guardia `/\bevery \d/` del lote.
- **Plurales `.uno/.otros`:** reportes, veces, vistazos, cambios, fotos, fotos al día, equipos de campaña, días y álbum parcial.
- **Huecos JSX con `interpolarNodos`:** `alta.tel.3`, `alta.pi.1/2/4`, `solicitudes.pie` y `demo.aviso`.
- **Las tres divergencias de la costura son correctas**, medidas en el diccionario entero:
  - «Actualizar»: `campanas.doohmain.actualizar` y `spaceeyes.comun.actualizar` son «Refresh» (recargar), y `spaceeyes.admin.actualizar.boton` es «Update» (instalar una versión).
  - «Estado»: «Status» en 4 claves de otros lotes, frente a `admin.estado-region` = «State» (de la república).
  - «Ganancia»: `propuestas.tablero.ganancia` = «Profit», frente a `admin.ganancia` = «Gain» (de la cámara).
- **El veredicto de la foto reutiliza `comercial.eye.*`:** «Correct ad · confidence 93%», «Does not match the creative · 41%».
- **Las 10 iguales declaradas son legítimas:** «38 °C», «312 MB», «Manual», «No», «Total», «Normal», «Raspberry Pi», «Raspberry», «PC» y el «No» del Imager.
- **Estilo:** sin acentos en el inglés (salvo el placeholder «Juárez»), sin `{n} %` con espacio, con comillas y apóstrofo tipográficos, y sin «tap» ni «press». El teléfono «confirms».

---

## 2 · Evidencia: marca de la foto y ticket — NO CAMBIAN (verificado)

- `git diff --stat ec427a66..HEAD -- lib/space-eyes-marca.ts lib/space-eyes-marca-editor.ts lib/space-eyes-marca.test.ts lib/space-eyes-whep.ts` sale **vacío**.
- En el diff de `components/` no cambia ni una línea que llame a `marcaDeFoto`, `renderizarFoto`, `nombreDescarga`, `nombreEnZip`, `normalizarGiro`, `giroDeFoto` ni `MARCA_POR_OMISION`. Se buscaron con `grep` sobre las líneas `+`/`-`.
- En el HTML inglés de «ajustar texto», la vista previa de la marca sigue diciendo `02/11/2026` y `11:55:00 a.m.`: es el formato es-MX de `space-eyes-marca-editor.ts:129-130`. Es correcto, porque es la evidencia.
- **El ticket de activación** (`DemoSpaceEyes.tsx:167-170`): el `asunto` y el `cuerpo` son los mismos literales españoles de antes. El diff solo añade el comentario «El ticket es un DATO que lee soporte en el padre: va en español siempre».

**Pero nada lo protege.** Ver el §6: traducir la marca no hace caer ninguna prueba.

---

## 3 · Español intacto: VERIFICADO (mecánicamente)

**a) Render frente a `ec427a66`, byte a byte, con los mismos datos.**

- `pantallas-spaceeyes.test.ts` se creó en `4f8e53c7` y **no cambia** en `144fefbf` (`git diff 4f8e53c7..HEAD -- …pantallas-spaceeyes.test.ts` sale vacío).
- El cambio de datos de prueba («Glorieta» → «GL-2») está **dentro de la prueba**. «Glorieta Norte» queda solo como valor `es` de `spaceeyes.demo.equipo.c`, que en el componente viejo era un literal.
- Por eso la comparación justa es esta: **la prueba de HEAD, con sus datos, contra los componentes viejos y contra los nuevos.** Es lo que hice.
- Como no se pueden sobrescribir los archivos del árbol, monté un espejo en `apps/web/lib/__valviejo/`:
  - Los 20 componentes de `components/demo/space-eyes/`, la `page.tsx` de `[id]` y `lib/space-eyes-actualizacion.ts`, todos con `git show ec427a66:…`.
  - Reescribí las importaciones: `@/lib/space-eyes-actualizacion` de `EquipoAdmin` y `@/components/demo/space-eyes/FichaEquipo` de la página.
  - Una copia de la prueba apuntada al espejo, con los mismos mocks, la misma cola de `useState`, el mismo reloj y los mismos datos.

```
nuevo: I18N_VOLCAR=…/nuevo-es  → Tests 192 passed, 95 archivos
viejo: I18N_VOLCAR=…/viejo-es  -t ESPANOL → Tests 95 passed, 95 archivos
diff -rq viejo-es nuevo-es      → sin salida (IDENTICOS, 95/95)
```

Para descartar que el espejo no se estuviera usando, cambié `'En línea'` por `'En lineaX'` en el `piezas.tsx` viejo: fallaron 2 pruebas y **7 archivos** pasaron a diferir. Lo restauré. No hay volcados triviales: el más pequeño mide 136 bytes (un estado de error) y el total es de 1,07 MB.

**b) Las funciones, vieja contra nueva** (`hace`, `fechaHora`, `calidadSenal`, `comoSeActualiza`). Lo medí con una prueba temporal en el espejo y el reloj fijo:

- `hace` y `fechaHora`: 19 instantes cada una (null, basura, futuro, 0 s… 100 días), sin idioma y con `'es'`.
- `haceSinPrefijo`: contra el antiguo `hace(x).replace('hace ', '')`.
- `calidadSenal`: 7 valores en dBm, cubriendo todas las fronteras.
- `comoSeActualiza`: 2880 combinaciones de `app_version` × `device_owner` × `app_actualiza_sola` × `app_actualiza_motivo` × `app_version_code`, sin idioma y con `'es'`.

```
COMPARACIONES 5869 · Tests 1 passed
```

**c) El servidor recibe el español.** `lib/server/space-eye.ts:319` llama a `comoSeActualiza({...})` con un solo argumento, así que entra `'es'` por omisión. El archivo no está en el diff (`git diff --stat ec427a66..HEAD -- apps/web/lib/server` sale vacío). Lo fija además `space-eyes-actualizacion.test.ts`.

Al terminar borré el espejo (`rm -rf apps/web/lib/__valviejo`), y `git status --short` salió vacío.

---

## 4 · Nada en español en el inglés: VERIFICADO, con una excepción no declarada

- **Barrido propio** de los 1163 textos visibles del HTML inglés de los 95 estados, buscando acentos, ñ, ¿ ¡ y palabras funcionales españolas. Lo único español que aparece es esto:
  - **Datos de prueba:** «Reforma 222 · Cara A», «Verano», «Otoño», «Invierno», «Norte», «Banco», «Refrescos», «raro», «se limpió», «sin red», «Fallo de red», «Av. Juárez» y «activar acme».
  - **La marca de la foto**, declarada.
  - **«Space Eye respondió 500»: NO DECLARADO.** Viene de `Graficas.tsx:271` y de `lib/data/space-eyes-se.ts:27`. Es el hallazgo medio n.º 1.
- **Lo declarado y dejado en español** son los errores de `lib/space-eyes-whep.ts`, por ejemplo «El equipo no comenzó a transmitir. Puede estar sin señal o con la cámara ocupada.». Se ve en la vista en vivo inglesa cuando falla la conexión. Es legítimo dejarlo para otro lote, pero conviene que lo sepa el dueño (§7).
- **`node scripts/i18n-inventario.mjs`:** quedan 20 hallazgos en 13 archivos de `components/demo/space-eyes`. Listados uno por uno con la misma heurística, son **3 del ticket** (declarado) y **17 clases de Tailwind o expresiones** (falsos positivos). El literal de `Graficas.tsx:271` no lo ve, porque es una plantilla con acento grave.

---

## 5 · Reglas: VERIFICADO

- **Sin dinero en el diccionario.** `grep` de `$`, `MX`, `MXN`, `USD`, «precio» y «monto» en `spaceeyes.ts`: nada (solo «Peso de la fuente», que es tipografía). El lote no pinta importes, así que `MX$` no aplica.
- **Ningún `desktop.ini`** en los dos commits (`git diff --name-only`) ni en el árbol.
- **No se tocaron** `middleware.ts`, `nav.ts`, `db/schema.sql`, `db/migrations/`, `app/api/`, `dinero.ts`, `aislamiento.e2e.test.ts` ni `servidor-e2e.ts`. `IDIOMA_INGLES` solo aparece como `process.env.IDIOMA_INGLES = '1'` dentro de la prueba de pantallas, igual que en las demás `pantallas-*.test.ts`.
- **`diccionario.ts` y `costura.test.ts`:** solo el import, el spread y las tres divergencias declaradas.

---

## 6 · Pruebas

```
cd apps/web && npm run typecheck   → tsc --noEmit, limpio
cd apps/web && npm test            → Test Files 336 passed (336) · Tests 4828 passed (4828)
```

La base `ec427a66` tenía 4610 según el encargo. El lote añade 218.

**Mutantes.** Cada uno se aplicó con `sed`, se corrió `pantallas-spaceeyes`, `textos/spaceeyes`, `costura`, `space-eyes-marca` y `space-eyes-actualizacion` (246 pruebas), y se restauró desde una copia. No se usaron ni `git stash` ni `git checkout`.

| # | mutante | resultado |
|---|---|---|
| M1 | `es` cambiado: `'En línea'` → `'En linea'` en `spaceeyes.conexion.en-linea` | **muere** (4 rojas: 3 estados en español + instantánea ES) |
| M2 | `en` en español: `spaceeyes.fallas.titulo` = `'Fallas de pantalla'` | **muere** (3 rojas: barrido inglés, instantánea EN, guardia de iguales) |
| M3 | sin idioma en un llamador de `fechaHora` (`FallasFlota.tsx:295`, y también `:408`) | **SOBREVIVE**: 246/246 en verde. Volcando el inglés, salen «02 nov 2026, 10:15 a.m.» y otras 8 fechas españolas en «fallas · abiertas, historial…». |
| M4 | sin idioma en un llamador de `hace` (`ListaEquipos.tsx:374`) | **muere** (3 rojas: lo caza la palabra «hace») |
| M5 | clave de toast: `toast.success(t('…prog.toast.creada'))` → `…actualizada` | **muere** (guardia de avisos de Programación) |
| M6 | marca de la foto traducida: `space-eyes-marca.ts:89-90` `'es-MX'` → `'en-US'` | **SOBREVIVE**: 246/246 en verde |
| M7 | marca de la vista previa traducida: `space-eyes-marca-editor.ts:129-130` `'es-MX'` → `'en-US'` | **SOBREVIVE**: 246/246 en verde |

**Lo que piden M3 y M6/M7** (severidad **media**, de prueba, no de código):

- **M3.** Las fechas no están vigiladas en inglés: el barrido busca trozos del diccionario, y una fecha es-MX no lo es. Propuesta: en `pantallas-spaceeyes.test.ts`, que el HTML inglés de cada estado no contenga `/\b\d{1,2} (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b|\b[ap]\.m\./`, salvo dentro de la marca, que se puede excluir por su contenedor o quitando ese nodo antes.
- **M6/M7.** La regla «la marca de la foto NO cambia» la cumple el código, pero ninguna prueba la fija. Propuesta:
  - En `space-eyes-marca.test.ts`: `lineasMarca({ taken_at: '2026-11-02T17:55:00Z', device_name: 'X' })` igual a `['X', '02/11/2026', '11:55:00 a.m.']`, con la zona horaria fija.
  - En la prueba de pantallas: que el HTML **inglés** de «ajustar texto» contenga `02/11/2026` y `a.m.`.

Al terminar, `git status --short` salió vacío, salvo este informe.

---

## 7 · Decisiones de glosario que le tocan al dueño

1. **«Pair» o «Vincular»** (`spaceeyes.alta.tel.vincular`, spaceeyes.ts:2198, en el paso «In the app, choose **Pair** and scan the QR»). Nombra un botón de la app Android de Space Eye, y el repositorio no contiene la app, así que no pude comprobar cómo se llama en ella ni si tiene inglés.
   - Si la app solo está en español, el inglés debe decir lo que el usuario va a ver: **«Vincular»**, o «Vincular» (“Pair”). Hay que declararlo en `IGUALES` de `textos/spaceeyes.test.ts` si queda igual.
   - Si la app tiene inglés, «Pair» es correcto.
2. **«Settings › Configuration › Support»** (3 claves). Depende de cómo se llame en inglés la pestaña «Configuración» de Administración, que es de otro lote. Recomiendo «Settings › Support», o esperar a ese lote.
3. **«folio» de un ticket → «ticket»** (`spaceeyes.solicitudes.folio`, `demo.listo.folio`). El glosario fija «folio interno → internal ref.», pero aquí es el número de un ticket de soporte, y «ticket T-0012» se lee mejor. Lo dejaría, pero conviene que conste en el glosario general.
4. **«el padre» → «the parent server»** (`spaceeyes.solicitudes.pie`). Es el primer lote que nombra el PADRE en inglés. Solo lo ve el padre, así que es un término interno, aceptable.
5. **Los errores de `lib/space-eyes-whep.ts` y de `lib/space-eyes-marca.ts` quedan en español en la pantalla inglesa** (vista en vivo y descargas). Están declarados, pero el usuario inglés sí los lee. Hay que decidir si entran en un lote posterior.
6. **Términos que decidió el traductor y que dejaría tal cual:**
   - equipo → device;
   - falla → fault;
   - vigilancia → monitoring;
   - encuadre → framing;
   - marca → label;
   - gabinete → cabinet;
   - zona → area;
   - sin comunicación → not reporting;
   - recuperada → cleared;
   - «Pide un toque» → «Someone has to confirm on the phone».

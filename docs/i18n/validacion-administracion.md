# Validación · lote de inglés «administración, cuenta y shell»

- **Rama:** `feat/ingles-administracion` (worktree `.claude/worktrees/ingles-administracion`). Diff revisado: `git diff ec427a66..HEAD`, tres commits (`bb309403`, `f0180cc4`, `819ed60f`), 58 archivos.
- **Fecha:** 2026-11-02. **Validador:** agente independiente. No corrige código; este informe es lo único que escribe, y no está commiteado.

## Veredicto: **ÁMBAR**. Se puede integrar después de corregir lo de abajo.

Comprobado de forma mecánica:

- El español está intacto: **60 de 60 estados idénticos byte a byte** frente a los componentes de `ec427a66`. Los 682 valores `es` aparecen literales en el código viejo, y los 16 restantes se reconciliaron uno por uno.
- Las funciones de `lib/` dan lo mismo que antes, sin idioma y con `'es'`: **9086 comparaciones** viejo contra nuevo, sin una diferencia.
- La zona sensible solo cambió texto. No se tocó nada prohibido, no hay dinero en el diccionario y el inglés pinta `MX$`.
- Typecheck limpio y unitarias en verde. **Los 12 mutantes mueren.**

El inglés del lote se lee como software B2B en casi todo. Hay **4 hallazgos de severidad media**:

1. El portal del cliente enseña la etapa actual de la campaña **en español** («Confirmada»).
2. En Integraciones, el nombre y la descripción de cada conector salen en español, y no está declarado.
3. «Normal priority», metido para esquivar la guardia de «inglés igual al español».
4. El subtítulo de Razones sociales queda colgando: «Your company’s · which one pays…».

Además hay unos 14 de severidad baja.

---

## 1 · Hallazgos de sentido en contexto

Leí las 698 claves en par `es`/`en` (volcado con `jiti` de los tres `textos/*.ts`), y el HTML inglés de los 60 estados: los volqué con una copia temporal de las dos pruebas de pantallas que pinta `en`, borrada después. 137 claves no salen en ningún estado (avisos emergentes, errores, estados «…ando», ramas raras); esas las leí en su punto de uso.

| clave | archivo:línea | inglés actual | problema | propuesto | sev. |
|---|---|---|---|---|---|
| (sin clave) | `app/(app)/portal/[token]/page.tsx:116` | «Nov 1, 2026 – Nov 30, 2026 **Confirmada**» | `{pipeline.pasos[pipeline.index]?.label}` pinta la etiqueta española de `usePipeline` (`ETAPA_LABEL`). `PipelineView` sí la traduce con `CLAVE_ETAPA`, pero esta línea no. La ve el **cliente**. La lista `espanol` del estado «cuenta · portal del cliente» no incluye la etapa, así que ninguna prueba lo ve. | `idioma === 'es' ? paso.label : t(CLAVE_ETAPA[paso.key])`, lo mismo que `PipelineView.tsx`, y añadir «Confirmada» a la lista `espanol` del estado. | **media** |
| (sin clave) | `lib/server/integraciones.ts:40-54` · `integraciones/page.tsx:121` | «AdMobilize (Computer Vision)» · «Conteo de audiencia y vehículos por dispositivo de visión.» · «Facturación fiscal (CFDI / SUNAT)» · «Timbrado fiscal de facturas…» | El nombre y la descripción de cada conector llegan del servidor en español y se pintan tal cual en inglés. No está en la lista «Sigue en español» de la bóveda ni en la cabecera de la prueba; el fixture lo disfraza con «Audiencias» y «Facturas». Los módulos de la matriz, que también vienen del servidor, sí se tradujeron (`admin.modulo.*`). | Claves `admin.integ.conector.<clave>.nombre/.descripcion`, en español solo en otro idioma, como `admin.modulo.*`. O, si se decide dejarlo así, declararlo en la bóveda y en la prueba. | **media** |
| `admin.tickets.prioridad.normal` | admin.ts:1087 · `TicketsPanel.tsx:196,224` | `Normal priority` | En el selector sale «Low / **Normal priority** / High / Urgent», y en el chip «TK-2 · Resolved · Normal priority». Es incoherente con sus tres hermanas. Por lo que parece, el «priority» está para esquivar la guardia «ninguna entrada inglesa es igual a la española» (`admin.test.ts:39`). | `Normal`, y añadir la clave a `IGUALES` (`admin.test.ts:30`). | **media** |
| `admin.razones.subtitulo` | admin.ts:1249 · `razones-sociales/page.tsx:94` | `Your company’s · which one pays the rents, buys the assets, handles permits and sells` | El posesivo queda colgando. Se lee roto en el subtítulo de la página. | `Your company’s legal entities · which one pays rent, buys assets, handles permits and sells` | **media** |
| `admin.network.de-espacios` | admin.ts:1192 · `network/page.tsx:84` | `of {total} spaces` | En el render sale «0 · **of 1 spaces**». El español tampoco concordaba («de 1 espacios»), y el encargo pide arreglar justo esto. | `.uno`/`.otros`: `of {total} space` / `of {total} spaces` (el `es` de las dos, «de {total} espacios», no cambia). | baja |
| `cuenta.publica.mapa.parcial.uno/.otros` | cuenta.ts:290 · `p/[id]/page.tsx:342` | `{faltan} of {n} screens have no coordinates entered; their address is in…` | La forma la elige `n` (el total), pero el verbo concuerda con `faltan`. Con 5 pantallas y 1 sin coordenadas sale «1 of 5 screens **have** … **their** address». | En inglés, elegir por `faltan` (claves nuevas o una frase neutra): `Screens without coordinates: {faltan} of {n}. Their addresses are in the list of sites.` | baja |
| `admin.razones.compartidos` | admin.ts:1266 · `GestionEntidadesFiscales.tsx:320` | `{papeles} is held by two or more.` | `{papeles}` es una lista unida con comas. Con dos papeles sale «Ventas, Rentas **is** held by two or more». | `Held by two or more legal entities: {papeles}. When several share…` | baja |
| `admin.act.mig.sin-contar` | admin.ts:1071 | `It couldn’t be counted how many migrations it brings` | Pasiva forzada, y suena a traducción. | `Couldn’t count how many migrations it includes` | baja |
| `admin.act.que-trae` / `mig.*` / `confirmar-sin-notas` / `aviso-sin-notas` | admin.ts:1072-1080 | `What v0.12.5 brings` · `It brings 2 pending migrations` · `you don’t know what it brings` | En notas de versión, «brings» es un calco de «trae». | `What’s in v0.12.5` · `It includes 2 pending migrations` · `you don’t know what’s in it` | baja |
| `admin.network.ninguna` | admin.ts:1209 | `No screen matches the filter.` | Es el mismo patrón que se corrigió en el piloto y en el lote comercial. | `No screens match the filter.` | baja |
| `admin.actividad.sin-coincidencias` | admin.ts:1240 | `No action matches the filters.` | Lo mismo. | `No actions match the filters.` | baja |
| `admin.actividad.subtitulo` / `.registro` | admin.ts:1229-1230 | `Activity log` → `Log of actions · who did what and when` → `Action log` | «log» tres veces seguidas en la misma cabecera. | subtítulo `Who did what and when`, y la tarjeta `Actions` | baja |
| `admin.usuarios.rol-de` | admin.ts:740 · `administracion/page.tsx:153` | `Role of {nombre}` (aria-label) | No es natural. | `{nombre}’s role` (o `Role for {nombre}`) | baja |
| `admin.cuenta.nueva-ayuda` | admin.ts:1147 | `Leave it blank to keep it (at least 8)` | «8» ¿de qué? | `Leave it blank to keep it (at least 8 characters)` | baja |
| `admin.tope.titulo` | admin.ts:869 | `Commercial discount cap` | El glosario manda Comercial → «Sales», y la tarjeta está bajo la sección «Sales». | `Sales discount cap` (o `Discount cap`) | baja |
| `admin.orgs.entrar` | admin.ts:1019 · `OrganizacionesPanel.tsx:135` | `Enter` | Es cambiar de organización. «Enter» suelto en un botón se lee como la tecla. | `Switch to` (o `Open`) | baja |
| `admin.correo.modal.afecta` | admin.ts:1008 | `It affects operations notices —today, the daily summary of contracts that need attention—. Passwords…` | En inglés no se cierra un inciso con «—.». | `It affects operations notices (currently, the daily summary of contracts that need attention). Passwords…` | baja |
| `cuenta.cuestionario.p2` | cuenta.ts:249 | `Are operations under the same legal entity that sells or invoices the sales?` | «invoices the sales» es un calco. | `Do operations run under the same legal entity that sells or invoices?` | baja |
| `cuenta.bienvenida.intro` | cuenta.ts:235 | `…in whose name a rent is paid and who issues a receipt.` | Aquí «comprobante» es el comprobante fiscal (la factura), no el recibo de pago del glosario. | `…who pays each rent and who issues invoices.` | baja |
| `cuenta.comun.ir-inicio` | cuenta.ts:175 | `Go to home` | No es natural. | `Go to the home page` (o `Go home`) | baja |

**Revisado y correcto** (para no repetirlo):

- **Roles:** Owner / Administrator / Sales director / Sales manager / Sales rep / Operations / Finance; «Viewing as Owner».
- **Zona sensible:**
  - Recuperar la contraseña: «Invalid or expired link», «Choose a new password», «At least 8 characters, with at least one letter and one number».
  - Códigos de recuperación, con el plural arreglado donde el español no concordaba: «Your 2 codes» / «Your 1 code».
  - Candado de cambios: «Changes unlocked for 15 more min · click to lock».
- **Contraseñas en Administración:**
  - «Temporary password for {nombre}. Hand it over through a secure channel».
  - «only its hash stays in the database».
  - «the audit log has to be able to prove it was you».
- **Control de cambios:** «Change control», «Turn on change control», «Change-control password», «It unlocks sensitive changes, but **not** resetting another person’s password».
- **Configuración del negocio:**
  - Fiscal y razones sociales: «lessee» (correcto: la empresa renta el espacio al arrendador), «Tax details for contracts», «Incorporation details», «public deed … before notary public 45».
  - Comercial: «Client cap per screen», «Payment terms (days)», «{n}-day term added», «VAT rates you work with».
  - Operación: «Labor cost by work order type», «Uses the fallback», «Crew task types», «Vinyl installation / Metalwork / static screen only».
- **Plurales nuevos donde el español no concordaba:**
  - `cuestionario.se-crearan.uno` («1 legal entity will be created:»).
  - `loop.propios.uno` («1 of 1 digital screen has its own number»).
  - `fiscal.falta.uno/.otros` («{campos} is / are missing»).
  - `novedades.n-*` («1 fix / 2 adjustments»).
- **Actualizaciones:** «Up to date: running…», «It will install by itself in the next automatic window, overnight (04:17)», «Let whoever runs the server know».
- **Fechas en inglés:** «Oct 30, 2026, 4:00 AM» en tickets y actualizaciones, y «Jan 5, 2026» en Actividad.
- **Dinero:** «MX$ 1,000.00» en Network y en la propuesta pública.
- **Las tres excepciones nuevas de la costura** (§4) y el atajo del 404, que pinta los rótulos del menú por `nav.*`.

---

## 2 · Zona sensible: SOLO TEXTO, verificado leyendo el diff

- **`recuperar/[token]/page.tsx`.** La validación es la misma (`validarPassword`, comparar las dos contraseñas, el `fetch` a `/api/auth/reset/`). Solo cambia el mensaje:
  - `claveDeRegla()` busca la clave `password.*` cuyo español es el que devolvió `validarPassword`, y pinta esa clave en el idioma vigente. Si no la encuentra, pinta el texto original.
  - El botón final usa `login.titulo.login`, cuyo `es` es «Iniciar sesión», el literal de antes.
- **`codigos-recuperacion/page.tsx`.** Solo hay sustituciones de literales por `t()`. Las llamadas a la API, los estados y el orden de los `useState` no cambian (lo confirma el volcado español idéntico con `useState` forzados por posición).
- **`AuthGate.tsx`.** Solo cambia el texto de `ErrorDeCarga`, que además se **exporta** para la prueba. `decidirPantalla`, `salidaObligatoria` y las redirecciones no se tocan.
- **Layout del shell.** Solo pasa `idioma={idiomaDeLaPeticion()}` a `BandaLicencia`.
- **Layouts y 404.** `app/layout.tsx` y `app/(app)/layout.tsx` pasan de `metadata` a `generateMetadata`, solo para la descripción, y el título no cambia. El layout raíz ya leía la cookie para `<html lang>`, así que no se vuelve dinámico nada nuevo. El 404 lee `idiomaDeLaPeticion()`.
- **Topbar.** Solo texto y `rolLabel(rol, idioma)`. Los `href` (`/configuracion`, `/codigos-recuperacion`), `cerrar()` y los manejadores de notificaciones no cambian.
- **`DesbloqueoCambios`.** Solo texto; las llamadas a `desbloquearApi`/`bloquearApi` siguen igual.
- **`global-error.tsx`.** Aquí no hay proveedor de idioma, y el diseño es correcto:
  - `useState(idiomaDelDocumento)` lee `document.documentElement.lang` una vez, al montar. Ese `lang` lo escribe el layout raíz con `idiomaDeLaPeticion()`, que ya respeta el inglés apagado.
  - En el servidor no hay `document` y sale `es`, como siempre; al hidratar, ese mismo `<html lang="es">` da `es` y no hay desajuste.
  - Para los textos usa `traducir()` directo.
  - Coste: el componente arrastra el diccionario entero a su paquete. Es menor, y no bloquea.
- **`pages/_error.tsx`.** Decide el idioma en `getInitialProps` con `resolverIdioma` (cookie > Accept-Language) y devuelve español si el inglés está apagado o no hay petición.
- **Archivos prohibidos.** `git diff --name-only ec427a66..HEAD` no toca `middleware.ts`, `components/demo/shell/nav.ts`, `lib/modulos.ts`, `db/schema.sql`, `db/migrations/`, `app/api/**`, `idiomas.ts`, `dinero.ts`, `aislamiento.e2e.test.ts`, `servidor-e2e.ts` ni ningún `package.json`.
- **Otros cambios de código en el diff**, revisados con un filtro sobre las líneas borradas que no son texto:
  - `EMAIL_INVALIDO` → `t('validacion.email')`. `diccionario.test.ts:141` ata los dos.
  - `rotuloDia`/`formatearFecha` ganan `idioma`, con `es-MX` igual que antes.
  - `window.confirm(t(…))`.
  - `ConfirmDialog`/`FotoUploaderMock`: los rótulos por omisión pasan a `t()` y lo que pase el llamador manda.
  - `PipelineView` traduce las etiquetas solo si `idioma !== 'es'`.
  - `NotasDeVersion` gana el hook `useTexto()`. Nadie la llama como función: lo comprobé con grep.
  - Ninguno cambia la lógica.

---

## 3 · Español intacto: VERIFICADO (mecánicamente)

**a) El HTML de los 60 estados, frente a `ec427a66`, byte a byte.**

1. Volqué el HTML español de los 28 estados de `pantallas-admin.test.ts` y de los 32 de `pantallas-cuenta-shell.test.ts` con `I18N_VOLCAR`, primero con HEAD.
2. Devolví los **43 archivos de código del diff** a `ec427a66` con `git --literal-pathspecs checkout ec427a66 --pathspec-from-file=…`, que son todos menos `lib/i18n/**` y la documentación. Las pruebas y el diccionario nuevos se quedaron.
3. Volví a volcar. El estado «shell · error al cargar los datos» falló con el código viejo porque `ErrorDeCarga` no estaba exportada. Lo exporté a mano en la copia vieja (solo `function` → `export function`) y repetí.

```
diff -rq viejo-admin nuevo-admin   → sin salida (IDENTICOS, 28/28)
diff -rq viejo-cuenta nuevo-cuenta → sin salida (IDENTICOS, 32/32)
```

**Control del espejo:** metí «Invitar usuarioX» en la `administracion/page.tsx` vieja y «Volver al inicioX» en el `not-found.tsx` viejo.

- Pasaron a diferir 14 estados de admin y 1 de cuenta.
- **Ojo:** las pruebas siguieron en verde, porque comparan por subcadena. El volcado es lo único que lo ve.

Después restauré con `git checkout HEAD --pathspec-from-file=…` y `git status` quedó vacío.

**b) Cada valor `es` contra el código viejo.** Busqué cada trozo entre huecos en los 43 archivos viejos, más `TicketsPanel`, `usuarios-repo`, `modulos.ts`, `nav.ts`, `novedades-reglas.mjs` y el `diccionario.ts` viejo.

- **682 de 698** aparecen literales.
- Las 16 restantes son frases que el código viejo armaba por ramas o con `conteo()`. Las reconcilié una por una:
  - `toast.activado/desactivado`: `${nombre}: ${activo ? …}`.
  - `fiscal.falta.otros`: `Falta{n===1?'':'n'}`.
  - `act.mig.uno`: `conteo(n,'migración','migraciones')` + `pendiente${…}`.
  - `tickets.estado-esperando.*`: `conteo(…)`.
  - `bienvenida.ya.*`: `Tu empresa ya tiene{' '}{…}, así que…`.
  - `se-crearan.*`: un ternario.
  - `publica.mapa.parcial.*`: `{faltan} de {conteo(n,'pantalla')} no tienen`.
  - `publica.aceptada.detalle*`: `Aceptada{por}… el{' '}`.
  - `publica.al-aceptar.*`: `pantalla{n===1?'':'s'}`.

**c) Las funciones de `lib/`, la vieja contra la nueva** (prueba temporal en `lib/__valviejo/`, borrada después):

- **`rolLabel`:** los 11 roles, incluidos los retirados `COMERCIAL` y `CLIENTE` y uno inventado. Además, `admin.rol.*` (es) es igual a `ROLES_ASIGNABLES`.
- **`etiquetaTipoOt`:** los 9 tipos, igual a `TIPO_OT_LABEL`, y en inglés distinta.
- **`CLAVE_CAP`:** `admin.cap.*` (es) es igual a `CAP_LABEL`.
- **`actualizaciones-ui`:** 2304 combinaciones de estado (modo, versiones nulas, digest, migraciones `null/0/1/2/1532`, aprobado, notas), en las cuatro funciones.
- **`tickets-ui`:** 0 tickets, 1, 2, mixtos y 1200 (con coma de miles).
- **`gestion.ts`:** nombre vacío, demasiado largo, duplicado activo y dado de baja, RFC malo y bueno, papel inventado, cada caso con y sin `editando`.
- **`disponibilidadInventario`:** los 6 estatus × 5 tipos × 7 pares de slots.

Resultado: **9086 comparaciones, viejo = nuevo sin idioma = nuevo con `'es'`.**

- **Única divergencia, y es imposible:** con `migracionesPendientes = -1` el viejo decía «Trae -1 migración pendiente**s**» y el nuevo «…pendiente». La excluí: el valor no puede darse.

**d) Componentes compartidos y lotes ya aprobados.** `npx vitest run lib/i18n` da 22 archivos y 648 pruebas en verde, incluidas `pantallas-propuestas`, `-compartidos`, `-campanas-finanzas` y `-comercial`. Esto cubre `StatusBadge`, `ConfirmDialog`, `PipelineView` y `FotoUploaderMock`.

**e) Huecos y bordes:** los huecos `{…}` son idénticos entre `es` y `en` en las 698 claves, y los espacios iniciales y finales también (0 diferencias). Las 698 tienen par, sin claves sobrantes.

---

## 4 · Nada en español dentro del inglés, y las reglas

**En el diccionario:**

- 0 valores `en` con acentos, `ñ` o `¿¡`.
- 0 `$`/`MXN`/`USD` en `es` o `en`.
- 0 `{x} %` con espacio.
- 0 comillas o apóstrofos rectos.
- 0 «Tap» o «press».
- Hay 6 iguales en los dos idiomas, todos legítimos y declarados: `Dashboard`, `Network`, `Logo`, `Error` y `No` ×2.

**En el HTML inglés de los 60 estados.** Lo que queda en español es:

- dato de prueba («Pantalla Reforma», «Detalle», «Listo», «Algo nuevo», «falla del servidor»);
- lo declarado en la bóveda: los registros de Actividad («reservó Pantalla Reforma»), los papeles del catálogo («Ventas», «Rentas», «OPERACION»), el ejemplo del régimen del SAT y los mensajes del servidor;
- el código crudo `PANTALLA_DIGITAL` de la liga pública, que ya salía así en español: es un defecto previo, no de este lote;
- y **dos cosas sin declarar**: la etapa del portal y los conectores de Integraciones (§1, media).

**Reglas:**

- **Dinero:** el inglés de una instancia MXN pinta «MX$ 1,000.00» (Network) y «MX$ 5,800.00» (propuesta pública).
- **`desktop.ini`:** ninguno en el diff, y `git ls-files | grep -c desktop.ini` da 0.
- **`costura.test.ts`:** incluye `admin`, `cuenta` y `shell` en `LOTES`.
- **Las tres excepciones nuevas están justificadas:**
  - **Actualizar:** `campanas.doohmain.actualizar` vuelve a leer el estado de DOOHmain («Refresh»); `admin.correo.actualizar` guarda el correo («Update»). Son acciones distintas.
  - **Baja:** el estatus de un sitio («Decommissioned») frente a la prioridad de un ticket («Low»). Son palabras homónimas.
  - **Cargo:** un cargo contable («Charge») frente al puesto de una persona («Job title»). También homónimas.
- **Hueco de la costura (no bloquea):** solo compara entre los `textos/*.ts`, no contra el diccionario base. Por eso no ve que `nav.actividad` = «Activity» y `admin.actividad.titulo` = «Activity log» (el menú y el título de la misma página difieren), ni «Entrar» = «Sign in» / «Enter». La segunda es legítima; la primera es decisión del dueño (§6).

---

## 5 · Pruebas (corridas por mí en este worktree)

```
cd apps/web && npm run typecheck   →  tsc --noEmit, sin errores
cd apps/web && npm test            →  Test Files 338 passed (338) · Tests 4775 passed (4775)
```

Las dos primeras corridas completas dieron 2 y 3 rojas, todas `Test timed out in 5000ms` en `pantallas-comercial` y `pantallas-campanas-finanzas`, archivos que este lote no toca. La segunda roja de comercial es arrastre del *timeout* anterior en el mismo archivo. Esos dos archivos solos dan 167/167 en 1,9 s, y la tercera corrida completa salió entera en verde. Es carga de la máquina (hay otros agentes en paralelo), no el código.

Corrí los mutantes contra `npx vitest run lib/i18n`, o contra las dos pruebas de pantallas más `lib/i18n/textos`. Restauré cada uno con `git checkout -- lib app components pages` y comprobé `git status` vacío después de cada uno:

| # | mutante | resultado |
|---|---|---|
| M1 | `es` de `admin.usuarios.invitar` = «Invitar usuarios» | **MUERE** (instantánea ES) |
| M2 | `en` de `admin.razones.titulo` = «Razones sociales» | **MUERE** (3 rojas: instantánea EN, «igual a la española», render) |
| M3 | `Topbar.tsx:54` llama a `rolLabel(usuario.rol)` sin idioma | **MUERE** («shell · barra superior…») |
| M4 | `administracion/page.tsx:150`, la fila de usuario sin idioma | **MUERE** («administracion · todo cargado») |
| M5 | toast «usuario creado» → la clave `admin.usuarios.toast.invitacion` | **MUERE** (la prueba que fija las claves de los toasts) |
| M6 | `global-error.tsx`, el botón con `shell.carga.reintentar` | **MUERE** (2 rojas, es y en) |
| M7 | `recuperar`: `setError(regla)` sin traducir | **MUERE** («recuperar la contrasena») |
| M8 | `global-error`: idioma fijo `'es'` | **MUERE** (2 rojas) |
| M9 | `configuracion/page.tsx:212`, `rolLabel` sin idioma | **MUERE** (3 rojas) |
| M10 | `_error.tsx` no devuelve `idioma` | **MUERE** |
| M11 | `rolLabel` ignora el idioma | **MUERE** (6 rojas) |
| M12 | `tickets-ui` siempre en plural | **MUERE** (3 rojas) |

El árbol quedó limpio salvo este informe: `git status --short` no muestra nada fuera de los `desktop.ini` sin rastrear de OneDrive. Borré el espejo, la prueba de comparación y las copias inglesas de las pruebas.

**Debilidades de la prueba (no bloquean):**

- **137 de las 698 claves no aparecen en el texto inglés de ningún estado.** Las cubren las instantáneas, la regla «inglés ≠ español» y las pruebas de funciones y toasts. Un error de **sentido** en ellas solo lo ve una lectura.
- **Las listas `espanol` comprueban por subcadena.** Un cambio que AÑADE letras al español («Invitar usuarioX») no lo ve ninguna prueba: solo el volcado con `diff`.
- **El estado del portal no lista la etapa.** Por eso el hallazgo 1 pasa en verde.

---

## 6 · Decisiones de glosario que le tocan al dueño

1. **«Configuración» → «Configuration», en tres sitios distintos:**
   - la pestaña de Administración;
   - la página de la cuenta del usuario (`/configuracion`);
   - el enlace del menú de usuario.

   En inglés, el menú de usuario y su página serían **«Account settings»**, pero «Settings» ya es Administración. Además, la ruta «Settings → Configuration» sale tres veces (`admin.cuenta.empresa.enlace`, `integ.donde.actualizaciones-detalle`, `razones.principal-title`). El lote comercial ya la tuvo y se resolvió como «set in Settings» por redundante. Hay dos salidas:
   - (a) Renombrar la pestaña, p. ej. **«Business settings»** o «Preferences», y la página de usuario a «Account settings».
   - (b) Dejarlo como está, que es coherente con la navegación real.
2. **Actividad:** el menú dice «Activity» (`nav.actividad`) y la página «Activity log». Hay que elegir uno.
3. **Imprenta (rol) → «Printing».** Como rol de persona se lee mejor **«Print shop»** o «Printer»; «Printing» es la actividad. El módulo puede seguir siendo «Printing».
4. **«Cost» como capacidad de la matriz** (View / Create / Approve / Invoice / Cost). Como encabezado se lee como sustantivo («el costo»), no como permiso. Alternativa: **«Costing»**.
5. **CP fiscal → «Tax ZIP code» y «ZIP {cp}».** «ZIP» es de EE. UU. Para un código postal mexicano, «Postal code» es neutro.
6. **Organizaciones → «Organizations (CRMs)».** ¿Se queda «CRMs» en inglés? Para el comprador, una organización no es un CRM.
7. **«Change control»** (control de cambios) y **«lessee»** (parte arrendataria) son correctos; los dejo anotados por si se prefiere «Approval lock» o «tenant».
8. **Los conectores de Integraciones:** ¿se traducen por clave, como los módulos de la matriz, o se declaran «dato del servidor» que sigue en español? Es el hallazgo 2 de §1.

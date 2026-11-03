# Revisión · ola 7 (cierre final) de la versión en inglés

- **Rama:** `feat/ingles-ola7` (worktree `.claude/worktrees/ingles-ola7`). Sale de `integra/ingles` en `d4fe7883`.
- **Fecha:** 2026-11-03.
- **Qué es:**
  - los tres menores que quedaban;
  - la decisión del dueño sobre el CSV del estado de cuenta, que llegó durante la ola;
  - el recorrido en navegador de lo que la ola 5 no pudo ver: Space Eyes con el módulo activo, el portal y la firma con token válido, la campanita con datos y el pipeline;
  - las correcciones de lo que apareció en ese recorrido.

## 1 · Commits

| Commit | Qué |
|---|---|
| `c5400f32` | Recordatorio de cobro el día del vencimiento: «due today», no «due in 0 days» |
| `88c9f93d` | `PaqueteImposible` al quitar un paquete, en inglés por patrón |
| `a1e1d077` | `admin.razones.falta.papel` lista los códigos válidos en inglés |
| `4f849d60` | El CSV del estado de cuenta en el idioma de la pantalla (decisión del dueño) |
| `fe18032c` | Recorrido: la vigencia del panel de revisión del contrato, con fecha inglesa |
| `571f543a` | Prueba: el papel tecleado se repite tal cual (mata el mutante m08) |
| `8eb0d4df` | Recorrido: el `title` de cómo se actualiza un equipo, en la lista de Space Eyes |
| `e484da63` | Recorrido: dónde falló la pantalla, en la ficha del equipo |
| `ba7f7ad9` | Recorrido: el nombre de una falla de pantalla (catálogo del teléfono) |

## 2 · Los tres menores

| Menor | Español (no cambia) | Inglés antes | Inglés ahora |
|---|---|---|---|
| Recordatorio con 0 días | `F001-0008 · Cliente — vence en 0 día(s) · saldo $3,480` | `… — due in 0 days · balance MX$3,480` | `… — due today · balance MX$3,480` |
| Contrato «vence en 0 días»: hoy el servidor escribe «HOY»; es una defensa | `Contrato vence en 0 días: Predio Norte` | `Contract expires in 0 days: Predio Norte` | `Contract expires TODAY: Predio Norte` |
| Quitar un paquete sobre el tope | `No se puede quitar el paquete "Verano": sin el paquete vuelve a aplicarse el descuento por volumen de las lineas. El descuento máximo que autoriza tu organización es 20 %, y se pidió 30 %. … Baja primero el descuento comercial y vuelve a quitar el paquete.` | todo en español | `The bundle “Verano” can’t be removed: without the bundle, the volume discount of the lines applies again. The maximum discount your organization allows is 20%, and 30% was requested. … Lower the commercial discount first, then remove the bundle again.` |
| El papel que no existe | `El papel «X» no existe. Los que hay son: ARRENDAMIENTOS, ACTIVOS, …` | `… The available ones are: ARRENDAMIENTOS, ACTIVOS, …` | `… The available ones are: RENT, ASSETS, PERMITS, OPERATIONS, SALES` |

**Cómo se hizo cada uno:**

- **`.cero`.** Variante nueva de las plantillas plurales de notificaciones (`notificaciones.cobranza.vence.detalle.cero` y `notificaciones.contrato.vence-en.cero`).
  - Su español es el mismo que el de `.otros`, porque es lo que guarda el servidor.
  - `armar()` solo la usa con la cifra exacta `0`; «10» y «20» siguen en plural.
  - La prueba global de huecos del diccionario (`diccionario.test.ts`) deja faltar `{n}` **solo** en las claves `.cero`.
- **`PaqueteImposible`.** Patrón nuevo en `PATRONES_ERROR`. El hueco del tope pasa a su vez por `traducirMotivo`, o sea por los patrones del tope de la ola 6.
  - Si esa pieza no se reconoce, solo ella queda en español.
  - El nombre del paquete es dato, y puede llevar comillas o `$1`.
  - Una prueba ata la frase al literal de `paquetes-repo.ts`. La respuesta ya pasaba por `respuestaError()`, así que no se tocó ninguna ruta.
- **Papeles.** `codigoDePapel` se aplica a cada código válido.
  - Un código que no es de los cinco (`OTRO`) es dato y se queda.
  - El intruso que tecleó la persona también se queda, aunque coincida con un código de partida.

## 3 · El CSV del estado de cuenta (decisión del dueño, 03/11)

**Decisión:** el CSV sale en el idioma de la pantalla. En español, byte a byte el de antes.

- **Español:** cada texto fijo sale de una clave cuyo español es el literal de antes. Fechas e importes van crudos, como siempre. `estado-cuenta-csv-idioma.test.ts` compara contra dos CSV completos, sacados del código de `d4fe7883` antes de tocarlo: con y sin columna de cliente, con comillas, una fórmula neutralizada, un pago de fecha aproximada y un saldo negativo.
- **Inglés:**
  - encabezados, tipos de movimiento y textos fijos en inglés (reusa las claves de la pantalla: *Account statement*, *Opening balance*, *Transaction*, *Invoice no.*…);
  - el periodo en inglés (*October 2026*);
  - las fechas como «Oct 1, 2026»;
  - la moneda en el encabezado de cada importe (*Charge (MX$)*, *Opening balance (MX$)*; `$` en una instancia USD);
  - el nombre del archivo: `account-statement-2026-10.csv` / `-client`.
- **Una lectura de la decisión, a confirmar con el dueño.** «Importes con el formato del idioma, `MX$` en inglés» se aplicó así: el `MX$` va en el encabezado y el importe sigue siendo un **número** con punto decimal. Hay dos razones:
  - con `MX$23,200.00` Excel no sumaría la columna;
  - un saldo negativo (`-MX$100.00`) Excel lo abre como fórmula, que es justo lo que el CSV evita.

  Si el dueño quiere la cifra formateada en cada celda, es un cambio de una línea (`num` → `formatearDinero` en inglés).
- **En el navegador:** con el inglés, el botón descargó `account-statement-2026-10.csv` con el contenido esperado.
- **«MX$ 1,160.00 MXN» del comprobante:** se queda así (decisión del dueño). No se tocó.

## 4 · El recorrido

**Montaje:**

- Build primero; después `node ../../node_modules/next/dist/bin/next start -p 3470`, con `IDIOMA_INGLES=1` y `COOKIE_SECURE=0`.
- Base propia `spaces_ola7` en el 5433:
  - montada como `recrearEsquema()`: rol de app, `schema.sql`, semilla de desarrollo y las 123 migraciones en el orden de `ordenar()`;
  - después `semilla-demo.mjs --org=demo-rentabilidad` (247 filas) y `bootstrap-auth.mjs`.
- `spaces_e2e`, `spaces_demo_nueva` y el 3500 no se tocaron.
- Al terminar se pararon el 3470 y el doble de Space Eye; los puertos 3470 y 4470 quedaron libres.

**Space Eyes con el módulo ACTIVO.** El módulo se activa con configuración, no con código: con `SPACE_EYE_BASE_URL` + `SPACE_EYE_KEY` y `/health` en 200, `estadoDelModulo()` da `activo`.

- No hay backend de Space Eye en esta máquina (necesita MySQL y Redis). Se escribió un **doble** en el *scratchpad* (`se-falso/servidor.mjs`), fuera del repositorio.
  - Responde las rutas que usan `lib/server/space-eye.ts`, `space-eyes-campanas.ts` y la lista `PERMITIDAS` del proxy.
  - Las formas salen de los tipos del cliente, de los fixtures de `pantallas-spaceeyes.test.ts` y del backend real.
  - Tiene cuatro equipos: un teléfono en línea, un teléfono caído con batería baja, un PC y una Raspberry.
- En la base se pusieron sus códigos en `sitios.codigo_proveedor`.
- **Pantallas recorridas:**
  - la lista;
  - la ficha del equipo en sus cuatro pestañas (fotos, pantalla y fallas, creativos y equipo), con la del PC;
  - «Take photo» hasta que llega la foto;
  - la galería y el visor;
  - las gráficas;
  - la marca de la foto;
  - programación, con el diálogo de editar;
  - campañas, con el diálogo de editar;
  - verificación, fallas y alta.

**Portal y firma con token válido:**

- **Portal:** se puso `portal_token` y `portal_activo` en una campaña. La app no tiene botón que lo genere: viene de la semilla o de un dato.
  - `/portal/<token>` sale entero en inglés: pipeline con «Nov 3» / «Aug 16», ubicaciones y evidencia vacía.
- **Firma:** el token se generó **como lo hace la app**, con «Send for signature» en `/contrato/[id]`, que pasa por `enviarAFirma`. Se recorrió:
  - `/firmar/<token>` en un contexto sin sesión;
  - la firma con nombre y casilla;
  - «already signed» al reabrir;
  - la constancia en inglés en el documento.

**Campanita:**

- 25 notificaciones sembradas, una por plantilla del servidor y con sus literales exactos, más una nueva para el aviso emergente.
- Todas en inglés, incluido «due today».
- El aviso emergente salió con «Payment reminder · … due today · balance MX$5,000 · View».

**Pipeline:**

- En la ficha de campaña y en el portal: «Booked Nov 3 · Confirmed Aug 16 · Installed / on air Sep 30».
- Con `TZ` de México la fecha de inicio sale bien.

**Con datos:** Dashboard, Finanzas (con el CSV), Arrendadores, Operaciones (114 OT) y la ficha de campaña.
- El barrido en la página no marcó nada fuera de datos de la semilla.

**Hallazgos y lo que se hizo:**

| # | Dónde | Qué salía | Qué se hizo |
|---|---|---|---|
| 1 | Panel de revisión antes de enviar a firma | «Term: 2025-08-31 to 2027-09-30» | En inglés, «Aug 31, 2025 to Sep 30, 2027»; en español, la ISO de siempre (`fe18032c`) |
| 2 | Lista de Space Eyes, `title` de «Needs a confirmation on the phone to update» | «La próxima actualización pide un toque en el teléfono…» (lo arma el servidor con `comoSeActualiza` sin idioma) | `textoDeActualizacion` reconoce la frase del catálogo y la dice en inglés (`8eb0d4df`) |
| 3 | Ficha del equipo · pantalla y fallas · «Area» | «Gabinete 8 (fila 2, columna 3)», «Gabinetes 2, 5, 8 (3 de 15)», «Toda la pantalla» (los arma el servidor, `dondeDeFalla`) | `dondeDeFallaEnIdioma` reconoce las tres formas y usa las claves que ya usaba la pantalla de la flota (`e484da63`) |
| 4 | Fallas (flota y ficha) · nombre de la falla | «Posible gabinete apagado», «Varios gabinetes congelados o tapados»… (los escribe el teléfono, `Monitor.kt`) | Catálogo fijo de 8 nombres, `spaceeyes.fallas.nombre.*`, atado al literal de `Monitor.kt`; solo el texto exacto (`ba7f7ad9`) |

**Términos nuevos:**

| Español | Inglés |
|---|---|
| gabinete | cabinet (como ya decía la flota) |
| Posible gabinete apagado / congelado o tapado | Possible cabinet off / frozen or covered |
| Pantalla apagada en horario | Screen off during operating hours |
| Pantalla congelada (no cambia el contenido) | Screen frozen (the content is not changing) |
| La cámara se movió: hay que volver a marcar la pantalla | The camera moved: the screen has to be marked again |
| Sin imagen: lente tapada, o pantalla apagada de noche | No image: lens covered, or screen off at night |
| Varios gabinetes apagados / congelados o tapados | Several cabinets off / frozen or covered |
| (CSV) Periodo · Saldo al cierre | Period · Closing balance |

**Observaciones sin tocar (para el dueño o para otra pasada):**

- **«Rent: $6,000.00 MXN»** en el panel de revisión del contrato, en inglés. El lote de arrendadores lo dejó así a propósito («el importe se arma como lo recita el contrato»). Es el mismo caso que «MX$ … MXN» del comprobante, así que no se tocó.
- **El aviso al pie del documento del contrato** («Documento generado automáticamente por SPACE OS… debe ser revisado por un abogado») sigue en español en inglés. Es parte del documento legal impreso. Lo declaró así el lote de inventario y arrendadores, y una prueba lo exige.
- **Lo que es dato y sigue en español, a propósito:**
  - los registros del equipo (`logs`);
  - las notas que escribe una persona al cerrar una falla;
  - el mensaje del servidor de medios del vivo;
  - un nombre de falla que no es del catálogo del teléfono.
- **«Android: Windows 10»** en la ficha de un PC: la etiqueta dice «Android» también en español. No es de traducción.
- **«Close toast»** (sonner) en el botón de cerrar de cada aviso, también en español. Es el valor por omisión de la librería, como «Notifications alt+T».
- **Notificaciones viejas.** Siguen sin reconocerse si se guardaron con otra redacción.
- **Posible defecto real** (lo vio el agente que escribió el doble): `equipoDetalle()` lee `data_mobile_month` / `data_wifi_month`, y el backend real manda `mobile_month` / `wifi_month`. En la ficha, los datos del mes saldrían siempre vacíos contra el Space Eye real. No es de traducción; está anotado para el dueño.

## 5 · El español, idéntico (medido)

- **HTML.** Se volcó el español de las 15 pruebas de pantallas, cada una en su carpeta (`I18N_VOLCAR` / `VOLCAR_HTML`), antes de tocar nada (`d4fe7883`) y al final.
  - `diff -rq` en las 14 carpetas: **0 diferencias en los 559 estados existentes**.
  - Hay 4 archivos nuevos en `pantallas-spaceeyes`: los dos estados nuevos, en español y en inglés.
  - La de catálogos no escribió archivos en ninguna de las dos corridas, y esta ola no toca sus componentes.
- **Los estados nuevos contra el código viejo.** Se restauraron desde `d4fe7883` `ListaEquipos`, `PantallaYCreativos` y `FallasFlota` y se volvió a volcar Space Eyes.
  - Los dos estados nuevos salen **idénticos** en español, y el resto también: solo cambian sus versiones inglesas.
  - Al terminar se volvió a `HEAD`, con `git status` limpio.
- **`DICCIONARIOS`** volcado en `d4fe7883` y en `HEAD`:
  - `es`: 5574 → 5589, con **0 valores cambiados**, 0 quitados y 15 nuevos (5 `finanzas.csv.*`, 8 `spaceeyes.fallas.nombre.*` y 2 `notificaciones.*.cero`);
  - `en`: 0 valores cambiados y las mismas 15 claves nuevas.
- **El CSV** en español: byte a byte, contra el texto sacado de `d4fe7883`.
- **Servidor:** `traducirError(m, 'es') === m` para el mensaje de `PaqueteImposible` con las tres formas del tope.

## 6 · Pruebas, mutantes y cifras

- **Pruebas nuevas:**
  - `paquete-imposible.test.ts`, `estado-cuenta-csv-idioma.test.ts` y `donde-falla.test.ts`;
  - casos en `notificaciones.test.ts`, `textos/notificaciones.test.ts`, `textos/admin.test.ts` y `space-eyes-actualizacion.test.ts`;
  - en las pruebas de pantallas, una exigencia inglesa más en un estado que ya existía (la revisión del contrato, «Jan 1, 2026 to Dec 1, 2026») y dos estados nuevos de Space Eyes: la lista con el motivo del servidor y la ficha con `donde` y nombre.
  - Cada una se vio en rojo antes de implementar.
- **Mutantes: 24 aplicados, 24 mueren.** Se aplicaron con `ola7-mutantes.mjs`, que restaura con `git checkout`; `git status` quedó limpio al final. El m08 sobrevivía en la primera pasada y lo mata `571f543a`.
  - Notificaciones:
    - m01: sin la rama `.cero`;
    - m02: `endsWith('0')`;
    - m03: el `.cero` dice «in {n} days».
  - Paquete:
    - m04: el tope sin `traducirMotivo`;
    - m05: el nombre sin comillas;
    - m06: el corte del tope mal.
  - Papeles:
    - m07: los válidos sin traducir;
    - m08: el intruso traducido.
  - CSV:
    - m09: fecha formateada también en español;
    - m10: sin moneda en el encabezado;
    - m11: el vencido sin comillas;
    - m12: el periodo sin traducir;
    - m13: el nombre de archivo siempre en español;
    - m14: la pantalla no pasa el idioma;
    - m16: una clave española distinta.
  - Firma:
    - m17: la vigencia siempre en ISO.
  - Space Eyes:
    - m18: `textoDeActualizacion` sin traducir;
    - m19: el `title` crudo;
    - m20: la lista sin «…»;
    - m21: el singular de gabinetes;
    - m22: el patrón de gabinete sin `$`;
    - m23: el nombre por prefijo;
    - m24: la tabla de la flota con el nombre crudo;
    - m25: «Toda la pantalla» sin traducir.
  - El m15 no se aplicó: el texto a mutar no casó, y la fecha ya la cubre el m09.
- **Cifras:**
  - `npm run typecheck`: limpio.
  - `npx vitest run --testTimeout=60000`: **6900 de 6900 en 375 archivos** (la base tenía 6854).
  - `npm run build`: «Compiled successfully».
- **Inventario:** `node scripts/i18n-inventario.mjs` sigue en 211 textos en 91 archivos. Todo lo de esta ola son datos que pinta la pantalla, y el contador no los ve.
- **e2e:** ver §7.

## 7 · e2e de la integración

- Se corrió `npm run build` y después `npm run test:e2e` en el worktree, con el build de esta rama (`BUILD_ID` `KZx7RW-iWcbWme6gysxRy`), y con el 3470 y el doble ya parados.
- Resultado: **1186 en verde, 21 saltadas, 1 en rojo**, en 85 archivos y 355 s.
- La roja es `grants-rol-app.e2e.test.ts` («si NO existe ninguno de los dos, ABORTA…»), que falla siempre en esta máquina porque no hay Docker.
- Es la misma cifra que la integración antes de la ola 5: 1186.

## 8 · Lo que se tocó fuera de `lib/i18n`

- `components/demo/finanzas/estado-cuenta-csv.ts` y `EstadoCuenta.tsx`
- `components/demo/arrendadores/PanelFirmas.tsx`
- `components/demo/razones-sociales/gestion.ts`
- `components/demo/space-eyes/ListaEquipos.tsx`, `PantallaYCreativos.tsx` y `FallasFlota.tsx`
- `lib/space-eyes-actualizacion.ts`

No se tocó nada de lo prohibido:
- `middleware.ts`, `nav.ts`, `db/schema.sql`, las migraciones, las rutas de acceso ni `app/api`;
- `aislamiento.e2e.test.ts`, `servidor-e2e.ts`, `db-e2e.ts`;
- `dinero.ts`, `contrato-documento.ts`;
- Actividad, las notas de versión, «Vincular» y «MX$ … MXN» del comprobante.

No se usó `git stash` ni `git push`. No hay `desktop.ini` en los commits.

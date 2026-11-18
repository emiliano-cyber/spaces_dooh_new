# Revisión · ola 5 (cierre) de la versión en inglés

- **Rama:** `feat/ingles-ola5` (worktree `.claude/worktrees/ingles-ola5`), sale de `integra/ingles` en `008bb1b9` (la corrección del lint de la prueba de inventario, que se trajo por *fast-forward* antes de construir).
- **Fecha:** 2026-11-03.
- **Qué es:** el recorrido en navegador real con `IDIOMA_INGLES=1`, las correcciones de lo que apareció y los menores que dejaron pendientes los validadores.

## 1 · Cómo se recorrió

- **Construcción:** `npm run build` y después `next start -p 3420`, con `IDIOMA_INGLES=1` y `COOKIE_SECURE=0`. Tras cada reconstrucción se mató al proceso dueño del puerto y se volvió a arrancar. El 3311 y el 3399 no se tocaron.
- **Base:** `spaces_ola5`, propia, en el Postgres portátil del 5433 (`spaces_e2e` no se tocó). Se armó con los pasos de `recrearEsquema()`: rol de app, `schema.sql`, semilla de desarrollo y las 123 migraciones con `ordenar()`. Después se le pasó `semilla-demo.mjs --org=demo-rentabilidad` (247 filas) y `bootstrap-auth.mjs` para la dueña.
  - `semilla-catalogo-demo.mjs` se negó por la fecha (`CAT-CMP-020 COTIZACION ya empezada`), así que el recorrido usa solo los datos de la semilla de la demo.
- **Navegador:** Chrome a través de `chrome-devtools`, en un contexto aislado y con la cookie `spaces_idioma=en`.
  - En cada pantalla, un barrido en la página leía el texto de `main`, los diálogos y los *toasts*, y además los `title`, `aria-label`, `placeholder` y `alt`.
  - Ese barrido marcaba tres cosas: palabras y acentos del español; fechas `d/m`, `dd/mm/aaaa` y meses en español; y un `$` sin `MX$`.
  - Cada aviso se juzgó a mano. Los nombres de la semilla («Campana DEMO…», «G500 Santa Mónica», «Ciudad de Mexico») son dato y se descartaron.
- **Interacción:** se abrieron los diálogos de alta y se pulsó guardar con el formulario vacío, para ver los errores de cada campo. Además:
  - se creó una propuesta de verdad y se aprobó;
  - se forzó un error del servidor con un RFC inválido;
  - se probó la contraseña equivocada en `/login`.

## 2 · Pantallas recorridas

**Acceso y cuenta**
- `/login`, en inglés y en español, con la contraseña equivocada.
- `/configuracion` con la contraseña temporal: aviso, contraseña corta y cambio correcto.
- `/codigos-recuperacion` y `/bienvenida` (ya contestada).

**Menú (todas las entradas)**
- `/inicio`
- Inventario: `/inventario`, `/arrendadores`, `/network`, `/almacen`.
- Space Eyes: `/space-eyes` y sus siete subpantallas, y `/space-eyes/nuevo`.
- Ventas: `/clientes`, `/comercial`, `/disponibilidad`, `/propuestas`, `/comercial-opex`, `/franjas-y-temporadas`, `/descuentos-por-volumen`, `/codigos-promocionales`, `/paquetes`.
- Operaciones: `/campanas`, `/creativos`, `/imprenta`, `/operaciones`, `/energia`.
- Finanzas: `/finanzas`, `/reportes`, `/comisiones`.
- Sistema: `/integraciones`, `/razones-sociales`, `/actividad`, `/administracion` (Users, Roles and permissions y Business settings), `/novedades` y `/captacion`.

**Detalle**
- La ficha de una campaña (`/campanas/[id]`): pipeline, extensiones, candado de facturación y orden de compra.
- La ficha de una propuesta (`/propuestas/[id]`).
- La ficha de una OT (`/operaciones/ot/[id]`) y su vista móvil (`/m/ot/[id]`).
- La ficha de un sitio en Comercial (`SiteFicha`).

**Diálogos**
- Propuestas:
  - New proposal: vacío con sus cuatro errores, lleno y creado;
  - Duplicate, Send, Approve (genera la campaña), Reject, Delete y Add sites.
- Clientes: New client, vacío y con un RFC inválido que rechaza el servidor.
- Arrendadores: New landlord, New contract (primer paso) y Add →.
- Operaciones: New work order.
- Ventas: Register item (almacén), New space (`comercial-opex`), New order (imprenta).
- Formularios en línea de los catálogos de precio: Add, Add tier, Add negotiation code y Create bundle.
- Finanzas: Record payment, Payments and proof of payment y Remind.
- Administración: Invite user (vacío, con sus errores) y Change mine.
- La campanita de notificaciones.

**Públicas**
- `/p/[token]` (la liga pública de la propuesta) y `/propuesta` (entrada por código).
- `/contrato/[id]` (el documento del contrato).
- `/portal/[token]` y `/firmar/[token]`, con un token inválido.
- El 404.

**No se pudieron recorrer:**
- **Space Eyes con equipos reales.** La organización no tiene el módulo activado, así que todas sus pantallas enseñan la demostración, que sí se recorrió y está en inglés. Las 95 pantallas reales siguen cubiertas por `pantallas-spaceeyes.test.ts`.
- **Las pantallas que dependen de una integración externa.** Son la publicación en DOOHmain, el envío de correo y el acceso con Google; aquí no hay credenciales.
- **El portal del cliente con un token válido.** Ninguna campaña de la semilla tiene portal; se vio solo el caso del enlace inválido.

## 3 · Hallazgos y lo que se hizo

Cada corrección lleva una prueba que se vio en rojo antes de cambiar el código.

| # | Dónde | Qué salía en inglés | Qué se hizo | Commit |
|---|---|---|---|---|
| 1 | Todas las tarjetas plegables (`CardColapsable`) | El lector de pantalla oía «Minimizar My account», «Expandir Proposal summary»… en todas las pantallas | Claves `compartidos.plegar.minimizar/expandir`, con el título por hueco. Dos piezas nuevas en `pantallas-compartidos` | `84dbfde9` (+ `c97e567d`, el lint) |
| 2 | `/login` y `/recuperar/[token]` | «Correo o contraseña inválidos» con la contraseña equivocada | Las rutas de acceso son zona roja y no pasan por `respuestaError()`, así que no se tocan. En su lugar, `lib/i18n/errores-acceso.ts` traduce en la pantalla:<br>· los mensajes de `auth/login`, `auth/forgot`, `signup` y `lib/auth-real.ts`;<br>· los dos límites de intentos;<br>· el resto pasa a `traducirError`.<br>Lleva 10 claves `login.error.*` | `313d57db` |
| 3 | Alta y duplicado de propuesta, sitio con contrato | «MX$ 28,000.00 mensual» | En inglés, `periodicidadLabel(…, idioma)` («monthly», «every two weeks»); en español, el dato crudo de siempre | `ac8513c2` |
| 4 | Menú lateral en el móvil | `aria-label="Cerrar menú"` escrito a mano | Usa `shell.topbar.cerrar-menu`, que ya existía | `f9d09887` |
| 5 | Pipeline de la campaña (ficha y portal) | «Booked 03/11», que en EE. UU. se lee 11 de marzo | `usePipeline` pasa también la fecha cruda (`iso`). En inglés se pinta «Nov 3» | `17fa96b9` |
| 6 | Ficha de una pantalla fija (`SiteFicha`) | «Display: fijo» | El dato real es `fijo` (migración `g500_estaticas`), no `fija`. Clave `comercial.ficha.exhibicion.fijo`: en español «fijo», el mismo dato que se pintaba; en inglés «static» | `cfd71b48` |
| 7 | Liga pública `/p/[token]` | « · ESPECTACULAR» en cada sitio | En inglés, la etiqueta del tipo («Billboard»); en español, el código, como siempre | `d6706972` |

**Los menores pendientes de los validadores:**

| Menor | Qué se hizo | Commit |
|---|---|---|
| Guardia de formato · fechas `\d{1,2}` (M1) | Ahora caza `2/11/2026`, `12/1/2026` y `02/11/26` | `1928ecb2` |
| Guardia · importes partidos entre elementos (M2) | `\$\s*\d`: `<span>$</span><span>10.00</span>` ya no se escapa. El `MX$` partido sigue limpio | `1928ecb2` |
| Guardia · falso positivo de USD (M3) | En modo MXN, `(?<![A-Z]{2})` deja pasar `US$`. En modo USD se enciende una huella nueva, «dinero con US$ en una instancia USD», porque `US$` es el símbolo del **español** de esa instancia | `1928ecb2` |
| «legal name» frente a «legal entity» en Arrendadores (M4) | Toda la tarjeta dice ahora *legal entity*: «{n} without a legal entity», «No legal entity», los dos avisos y «billed/invoiced to this legal entity». También `arrendadores.comun.sin-razon`, que es la etiqueta de esa misma tarjeta, de la fila de «By legal entity» y del selector de CambiosContrato | `2199bb78` |
| Contracciones en la tarjeta de licencias (M5) | «Cannot be earlier than the issue date», como «cannot expire». Los errores van sin contracción | `2199bb78` |
| Concordancia de «this is missing» | Ahora dice «To send it for review, it still needs: …», que no depende del número. Se cambió a la vez en el servidor (`errores-servidor.ts`) y en las dos claves de captación, para que la costura siga viendo un solo inglés | `9a6f0703` |
| Reportes · el mutante de visita única `total<=2` (M6a) | Prueba con dos visitas reales en los dos idiomas. Medido: con `total <= 2` en `lib/data/reportes.ts:1944` la prueba cae, y restaurado pasa | `5333cf56` |
| `energia.lectura.ok.uno`: «Check them» | «Check each row against the bill and confirm it». La clave `.uno` se elige por el número de **archivos**, no de renglones. Un archivo puede dar varios renglones, así que «Check it» habría fallado en ese caso; la frase neutra concuerda con uno o con varios | `e142cc0d` |

**Observaciones que no se tocaron (menores):**
- En Arrendadores el vencimiento sale «in 331 d» y en Finanzas «in 331 days», para el mismo contrato. Son claves distintas y cada una cabe en su columna.
- `notaDeCostosOt` en inglés dice «All 2 visits…» con dos visitas («Both visits» sería más natural). Hace falta una variante `.dos` y queda para otra pasada.
- `PR-2026-0001· the client…`: falta un espacio. Pasa igual en español, es del maquetado y no de la traducción.
- El *toaster* (sonner) se anuncia como «Notifications alt+T» también en español. Es el valor por omisión de la librería, y tocarlo cambiaría el español.

## 4 · El español, idéntico (medido)

- **HTML.** Se volcó el español de las 16 pruebas de pantallas, cada una en su carpeta, porque varias numeran los archivos igual y en una sola carpeta se pisan. Se volcó antes de tocar nada y al final, y se comparó con `diff -rq`:
  - **0 diferencias en los 550 estados que ya existían**;
  - 5 archivos nuevos, que son los estados que añade esta ola.
- **Los estados nuevos, contra el código viejo.** Se restauraron desde `008bb1b9` los siete componentes tocados (`SiteFicha`, `CardColapsable`, `Sidebar`, `propuestas/page`, `p/[id]/page`, `PipelineView` y `lib/data/client.ts`).
  - Con ellos se volcaron otra vez las cuatro pruebas afectadas (comercial, compartidos, cuenta-shell y propuestas, 90 estados).
  - **0 diferencias**, también en los 5 estados nuevos. El español que fijan es el que ya pintaba el código.
  - Al terminar se volvió a `HEAD`, y `git status` quedó limpio.
- **`DICCIONARIOS`.** Se volcó el JSON en `008bb1b9` y en `HEAD` (con `diccionario.ts` y `textos/` de cada uno):
  - `es`: 5510 → 5521, con **0 valores cambiados**, 11 claves nuevas y 0 retiradas;
  - `en`: 11 valores cambiados, todos de la tabla de arriba (M4 ×7, M5, captación ×2 y energía), y 11 claves nuevas.
- **`costura.test.ts`** sigue en verde: mismo español, mismo inglés.

## 5 · Cifras

- `npm run typecheck`: limpio.
- `npx vitest run --testTimeout=60000`: **6697 de 6697** en 366 archivos. La base tenía 6645.
- `npm run build`: en verde, con la corrección del lint `c97e567d`.

## 6 · El inventario, clasificado

`node scripts/i18n-inventario.mjs` da **211 textos en 91 archivos**, igual que antes de la ola. Ninguna corrección de esta ola bajó la cifra, y eso dice algo del contador:
- no mira `login/page.tsx` ni `Sidebar.tsx`, que están en su lista `YA_HECHO` aunque tenían texto pendiente (el #4);
- no ve los literales armados en plantillas, como «Minimizar» (el #1);
- no ve los datos que se pintan crudos (#3, #6 y #7).

**Para la próxima vez: «el inventario solo tiene falsos positivos» no basta para declarar terminado. Hace falta el recorrido.**

Con el detalle cadena por cadena (214 entradas, sacadas con una copia del script que imprime cada texto):

| Clase | Cuántas | Qué son |
|---|---|---|
| Falso positivo | ~165 | Clases de Tailwind y trozos de código (`y && x`, `, si: tipo ===`, `Math.hypot…`). Además:<br>· la constante `TITULO_POR_OMISION` de `PagosRentaCard`, que solo es id;<br>· el error de `FotoUploaderMock`, que no se pinta;<br>· `SIN_NOTAS`;<br>· el error de desarrollo de `MenuMovilContext`;<br>· «En proceso» de `operaciones`, que se traduce por su `clave` |
| Español a propósito | ~40 | · Catálogos del SAT («601 · General de Ley Personas Morales», `G03`, `P01`…): son nombres oficiales.<br>· Las tablas de `StatusBadge`, que son la verdad en español; cada lote traduce por clave.<br>· Nombres de ejemplo en los *placeholders*.<br>· El texto legal del contrato (`CLÁUSULAS`, `FIRMADO ELECTRÓNICAMENTE`): va al hash de firmas.<br>· El ticket de activación de Space Eyes, que lee soporte.<br>· «Creativo (código)», el nombre por omisión que se guarda como dato.<br>· Los mensajes de `console` del layout |
| Pendiente (decisión) | 3 | La lista de comprobación por omisión de una OT nueva (`operaciones/page.tsx:474-476`): se guarda como dato en español. Ver §7 |

## 7 · Decisiones para el dueño

Todas se verían en inglés como texto español, y ninguna se cambió, porque arreglarlas exige decidir qué pasa con el dato o con el español.

1. **Las notificaciones de la campanita.** «Campaña generada desde propuesta», «Propuesta aprobada» y «Cobranza vencida — vencida hace 4 día(s) · saldo $247,080» se guardan como dato, en español, al crearse. Hay dos caminos:
   - traducirlas al pintarlas, con un catálogo de títulos y patrones como el de los errores (es un lote propio);
   - aceptarlas en español.
2. **Los papeles de las razones sociales** («Compra los activos y el equipo», «Paga las rentas…»). Salen de `catalogo_roles_entidad`, y la bóveda los declaró «español a propósito» en el lote de administración. Se ven en `/razones-sociales`, en Administración y en la bienvenida; en la bienvenida salen además como códigos («ACTIVOS, ARRENDAMIENTOS»), también en español. Son cinco papeles **fijos** para toda la flota, así que una etiqueta inglesa por código es barata y no toca el español. ¿Se hace?
3. **La lista de comprobación por omisión de una OT nueva** («Inspección de estructura y herrajes», «Montaje / ejecución», «Foto comprobatoria con geolocalización»). Se guarda en la OT, en español, aunque quien la cree trabaje en inglés. Hay dos opciones:
   - guardarla en el idioma de quien la crea (cambia el dato);
   - traducir esas tres al pintarlas.
4. **El registro de Actividad** («Actualizó su cuenta», «Aprobó propuesta · snapshot económico v1 (total $167,040)») y **las notas de versión** de `/novedades`. Siguen en español, como declaró el lote de administración: son bitácora y dato. Se apuntan aquí solo porque en el recorrido son lo más visible en español.
5. **Los dos mensajes del flujo de venta** que el encargo pidió no traducir todavía: el tope al EDITAR el descuento y el 400 de la negociación con la agencia sin validar. No se tocaron.

## 8 · Lo que se tocó fuera de `lib/i18n`

- `components/demo/ui/CardColapsable.tsx`, `components/demo/shell/Sidebar.tsx`, `components/demo/campanas/PipelineView.tsx`, `components/demo/comercial/SiteFicha.tsx`.
- `app/(app)/login/page.tsx`, `app/(app)/recuperar/[token]/page.tsx`, `app/(app)/(shell)/propuestas/page.tsx`, `app/(app)/p/[id]/page.tsx`.
- `lib/data/client.ts`: solo se añade `iso` a `PasoPipeline`.

No se tocó nada de lo prohibido:
- `middleware.ts`, `nav.ts`, `db/schema.sql`, las migraciones, `app/api`;
- `aislamiento.e2e.test.ts`, `servidor-e2e.ts`, `semillas-e2e.ts`, `db-e2e.ts`;
- `dinero.ts`, `contrato-documento.ts`.

No se usó `git stash` ni `git push`, y el servidor del 3420 quedó parado al terminar.

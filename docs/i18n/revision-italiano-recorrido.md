# Revisión · recorrido del italiano en el navegador (cierre)

- **Rama:** `feat/italiano-recorrido` (worktree `.claude/worktrees/italiano-recorrido`), sale de `integra/idiomas` en `caef69f8`.
- **Fecha:** 2026-11-04.
- **Qué es:** el último punto de la lista de §4 de [italiano-olas](../../vault/03-Frontend/italiano-olas.md) antes de encender `IDIOMA_ITALIANO`: el recorrido pantalla por pantalla en un navegador real, las correcciones de lo que apareció y una versión local con los tres idiomas para que el dueño la pruebe.

## 1 · Cómo se recorrió

- **Bases propias** en el Postgres del 5433 (no se tocaron `spaces_e2e`, `spaces_demo_nueva` ni `spaces_idiomas_e2e`):
  - `spaces_demo_it`: instancia con idioma de documentos **it**.
  - `spaces_demo_es`: instancia **es**, para ver que todo sale como siempre.
- **Cómo se armaron**, como nace una instancia de verdad: rol de app (`db/dev-rol-app.sql`), `schema.sql` y las 125 migraciones en el orden de `ordenar()`. **Sin** `semilla-desarrollo.sql`, que mete la organización `rgb` en español. Después:
  - la organización `demo` con su `idioma_documentos` (`it` o `es`), insertada a mano antes de las semillas;
  - `semilla-demo.mjs --org=demo` (247 filas);
  - `semilla-catalogo-demo.mjs --org=demo --ancla=2026-10-31` (805 filas). Sin ancla se niega: `CAT-CMP-020 COTIZACION ya empezada`;
  - `bootstrap-auth.mjs` para la Dueña (`duena@demo.invalid`).
- **Las semillas no saben sembrar una instancia italiana.** Las tres insertan la organización sin idioma (o sea `es`) y el trigger `trg_tenants_idioma_documentos_unico` las rechaza aunque lleven `on conflict do nothing`, porque el trigger salta antes que el conflicto. En `spaces_demo_it` se **apagó ese trigger solo mientras corrían** y se volvió a encender; la organización ya existía, así que no insertaron ninguna. Es lo que el ADR 0049 ya decía («son para instancias españolas de prueba»); queda anotado para quien quiera una semilla italiana.
- **Datos que se pusieron a mano** para poder ver los papeles:
  - `token_publico` en las 13 propuestas: `semilla-catalogo-demo` no lo pone, y sin él «Genera PDF» da un 404;
  - un portal en `CAT-CMP-016`;
  - los datos fiscales de la organización, para poder mandar un contrato a firma;
  - los códigos `DEMO-S1…S4` de Space Eye en cuatro sitios.
- **Contraseña común** de los nueve usuarios: en el *scratchpad* (`clave-tres-idiomas.txt`), no en el repositorio.
- **Servidor:** `npm run build` primero y después `next start -p 3610` (y `-p 3611` contra la base `es`), con `IDIOMA_INGLES=1` e `IDIOMA_ITALIANO=1`. Tras reconstruir se mató al dueño del puerto y se volvió a arrancar.
- **Space Eyes con el módulo activo:** el doble del *scratchpad* (`se-falso/servidor.mjs`) en el 4471, con `SPACE_EYE_BASE_URL` y `SPACE_EYE_KEY`.
- **Navegador:** Chrome por `chrome-devtools`, en contextos aislados y con la cookie `spaces_idioma=it`.
  - Para no gastar una llamada por pantalla, el recorrido abría cada ruta en una ventana del mismo origen y volcaba a disco el texto visible, más los `title`, `aria-label`, `placeholder` y `alt`.
  - Un script comparaba cada volcado contra **8514 trozos** del español y del inglés que ningún texto italiano contiene, sacados de `DICCIONARIOS`. Además buscaba fechas `d/m`, meses ajenos, `$` sin `MX$`, cifras con coma de millar, artículo ante fecha y palabras sueltas.
  - Cada aviso se juzgó a mano. Los nombres de la semilla («Pantalla LED Reforma», «Arrendador DEMO…», «Dueña Demo», «Aseguradora DEMO Confianza»), las notas del equipo y los mensajes del registro del teléfono son **dato** y se descartaron.
- **Desbordes:** las 30 pantallas del menú a 390 px. Ninguna tiene desplazamiento horizontal. Lo que no cabe son los nombres de sitio, que se recortan a propósito, igual en los tres idiomas.

## 2 · Pantallas recorridas

**Menú, todas las entradas (40 rutas):**
- Dashboard;
- Inventario, Arrendadores, Network, Almacén;
- Space Eyes y sus siete subpantallas, con «Aggiungi dispositivo»;
- Clientes, Comercial, Disponibilidad, Propuestas, Comercial negociación, Franjas y temporadas, Descuentos por volumen, Códigos de negociación, Paquetes;
- Campañas, Creativos, Imprenta, Operaciones, Consumo de luz;
- Finanzas, Reportes, Comisiones;
- Integraciones, Razones sociales, Actividad;
- Administración, con sus tres pestañas;
- Novedades, Captación, Configuración, Códigos de recuperación, Bienvenida y el 404.

**Diálogos** (22): se abrió cada uno y se pulsó guardar vacío para ver sus errores.
- Carga masiva;
- New landlord, New contract y Registrar pago (arrendadores);
- Registrar artículo, Nuevo cliente, Nuevo sitio, Nueva propuesta, Nuevo espacio;
- los formularios de Franjas, Volumen, Códigos y Paquetes;
- Nueva orden de imprenta, Nueva OT;
- Registrar pago (finanzas), con el candado de contraseña;
- Nueva agencia, Nueva razón social;
- Invitar usuario, Nueva organización;
- Nuevo prospecto, Añadir dispositivo.

**Fichas:**
- tres campañas (activa, confirmada y lista para facturar);
- tres propuestas (borrador, enviada y aprobada);
- la OT y su vista móvil;
- dos contratos;
- tres equipos de Space Eyes, con sus pestañas.

**Campanita:** las 10 últimas, todas en italiano.

**Mi cuenta → Idioma:**
- se cambió a es, en e it, y de vuelta a «Usar el idioma del navegador»;
- **B64:** con la cuenta en español y la cookie en italiano, al cerrar sesión la pantalla de entrar sale en **italiano**, no en el idioma de la cuenta;
- además, el login con la contraseña equivocada y «Hai dimenticato la password?».

**Los papeles** (ADR 0049):

| Papel | Instancia `it`, interfaz `it` | Instancia `it`, interfaz `es` | Instancia `es`, interfaz `it` |
|---|---|---|---|
| Propuesta imprimible (`/propuesta/[id]`) | italiano | papel en italiano, barra en español | papel en español, barra en italiano |
| Liga `/p/[token]` | italiano | italiano (`lang="it"`) | español (`lang="es"`) |
| Portal con token válido | italiano | italiano | español |
| Contrato `/contrato/[id]` | italiano | italiano, barra en español | español, barra en italiano |
| Firma pública `/firmar/[token]` (navegador en inglés) | texto en italiano, marco en inglés | — | — |
| Constancia de firmas (firmado de verdad por los dos) | italiano | — | — |
| Comprobante de cobranza | italiano | — | español, botones en italiano |

## 3 · Hallazgos y lo que se hizo

**Regla de la pasada:** el español y el inglés salen idénticos. Cada arreglo pasa por `idioma === 'it'` y tiene su caso en rojo antes en `apps/web/lib/i18n/recorrido-italiano.test.ts`. El mismo caso fija también el español y el inglés de siempre. Commit `b2de0501`.

| # | Dónde | Qué salía con la interfaz en italiano | Qué se hizo |
|---|---|---|---|
| 1 | Paginación (pagos de renta en Arrendadores, Finanzas) | «1–20 de 260 pagos · Anterior · Siguiente», escrito a mano | Claves `compartidos.paginacion.*`, nuevas: «1–20 di 260 pagamenti · Precedente · Avanti». «Avanti» como el resto de la aplicación |
| 2 | Barra de carga (lector de pantalla) | «Cargando…» escrito a mano | `EtiquetaCarga` usa `comun.cargando`: «Caricamento…» |
| 3 | Pastilla de las peticiones que escriben | «Procesando…» escrito a mano | `shell.confirmar.procesando`: «Elaborazione…» |
| 4 | Razones sociales (lista, diálogo, bienvenida) | «Trámites y licencias con gobierno», «Operación y nómina» | La base las guarda **con** acentos desde `20260921_corrige_acentos_catalogo_roles_entidad.sql` y el diccionario español sin ellos, así que la comparación exacta de `etiquetaDePapel` fallaba. En italiano se compara sin acentos |
| 5 | Fallas de Space Eyes (flota y ficha) | «Pantalla congelada», «Cámara movida», «Sin imagen» | El backend (`space-eye/backend/src/controllers/monitoreo.controller.ts`) manda nombres más cortos que el teléfono, y solo los del teléfono se reconocían. Se reconocen también los tres cortos |
| 6 | Recuperar contraseña | «Si el correo está registrado, te enviamos un enlace…», que manda `app/api/auth/forgot` (zona roja, no se toca) | En italiano se pinta `login.aviso-generico`: `avisoDeEnlaceEnviado()` |
| 7 | Revisión antes de enviar a firma | «Canone: $6,000.00 MXN», el formato mexicano | En italiano, «6.000,00 MXN», como lo recita el contrato italiano: `importeDeRevision()` |
| 8 | Registrar un abono | «Importo dell’acconto», «Registra acconto» | «acconto» es un anticipo. La costura (§7) fijó que un abono es un pago parcial: «Importo del pagamento», «Registra pagamento parziale» |

**Mutantes** (`scratchpad/mutantes.mjs`, contra las unitarias): **15 de 15 mueren**. Por cada arreglo hay uno que apaga el italiano y otro que lo extiende al inglés. El que extiende al inglés también muere: la prueba protege la regla.

Lo único que ninguna prueba cubre es que `PagosRentaCard` pase «pagamenti» como etiqueta. Se comprobó en el navegador, tras reconstruir: «1–20 di 260 pagamenti Precedente 1 / 13 Avanti».

**Comprobado en el navegador tras reconstruir:**
- la paginación (Arrendadores y Finanzas);
- los papeles de Razones sociales («Pratiche e licenze con la pubblica amministrazione», «Operatività e buste paga»);
- las fallas de Space Eyes;
- el aviso de recuperar contraseña («Se l’email è registrata, ti abbiamo inviato un link.»).

## 4 · El español y el inglés, idénticos (medido)

- **HTML.** Se volcó todo con `I18N_VOLCAR_TODO`, antes de tocar nada y al final, y se comparó con `diff -rq`:
  - 4633 estados antes;
  - después, **10 archivos distintos**, todos de pruebas italianas («en ITALIANO», «reglas del italiano», «barrido … HTML italiano»): son «Importo del pagamento» y «Canone: 10.000,00 MXN»;
  - más la carpeta nueva de `recorrido-italiano.test.ts`.
- **`DICCIONARIOS`.** `es` y `en` pasan de 5617 a 5621 claves, con **0 valores cambiados** (las 4 nuevas son `compartidos.paginacion.*`). En `it` cambian 2 valores: `finanzas.pago.registrar-abono` y `finanzas.pago.monto`. El catálogo de errores del servidor, sin cambios.
- **La instantánea** de `textos/compartidos.test.ts` se actualizó, y solo añade las 4 claves en los tres idiomas.

## 5 · El inglés tiene los mismos defectos (para el dueño)

Los defectos 1 a 6 también se ven en inglés: «Anterior / Siguiente», «Cargando…», «Procesando…», los dos papeles con acento, las tres fallas cortas y el aviso de recuperar contraseña. No se tocaron, por la regla de esta pasada. **Arreglarlos es quitar la condición `idioma === 'it'`**: las claves inglesas ya están. Cada sitio lo dice en su comentario, y hay un mutante que muere si se hace sin querer. Basta con que el dueño diga que sí.

## 6 · Lo que no se tocó (observaciones)

**Para el abogado: el contrato italiano** (`lib/contrato-documento.ts`, sellado con hash; no se toca sin él).
- «destinerà LO SPAZIO esclusivamente **a l’installazione**…» debería ser «**all’installazione**». El texto del uso permitido entra en una plantilla pensada para el español «a la instalación».
- Usa el apóstrofo recto (') en todo el texto; el resto del italiano usa el tipográfico (’).
- «dal {día} {mes}» está bien con el 31, pero con el 1, el 8 o el 11 pediría «dall’» o «dal 1°». No hay ningún contrato italiano firmado; si se cambia ahora, no se rompe ninguna firma.

**Del idioma, en todos los idiomas** (cambiarlos cambia el español o el inglés):
- El aviso «Idioma guardado» sale en el idioma **anterior** al cambio: al pasar a italiano dice «Language saved».
- Los controles del mapa (MapLibre: «Zoom in», «Find my location», «Map marker», «Toggle attribution») y el *toaster* («Notifications alt+T») salen en inglés también en español.
- El botón de cerrar de los diálogos no tiene nombre accesible, en ningún idioma.
- El papel de la propuesta imprimible, el del contrato y el del comprobante no llevan su propio `lang` cuando el idioma de la instancia no es el de la persona. `/p` y el portal sí lo llevan (B68). Ponerlo cambiaría el HTML inglés de las pruebas que usan una instancia española, así que no se hizo.

**Ajenos al idioma, vistos de paso:**
- En una instancia **española**, el comprobante pinta la fecha de emisión como llega de la API: «2026-09-01T06:00:00.000Z». El código espera `AAAA-MM-DD`.
- `semilla-catalogo-demo.mjs` crea las propuestas sin `token_publico`, así que «Genera PDF» da 404 sobre la semilla.
- El 404 de `/propuesta/[id]` (fuera del armazón) sale sin estilos, con un icono enorme.
- En `/contrato/[id]`, la constancia la arma el servidor al cargar la página. La firma de la conductora, hecha desde el panel de esa misma página, aparece en la constancia al recargar.

**Ya conocidos y pendientes de decisión:** la captura de cifras a la mexicana en italiano (P-L2-1): «0.00» en el descuento, «382,800» en el abono, «es. 180,000». Los catálogos del SAT y los nombres de la semilla en español.

## 7 · Lo que no se pudo

- **Los correos** (propuesta, invitación, recordatorios). No hay SMTP en esta máquina. Sus textos los cubre `correos-idioma.test.ts`.
- **DOOHmain** y el acceso con Google. Sin credenciales.
- **Space Eyes con un equipo real.** Se usó el doble: la vista en vivo y «Scatta foto» contra el doble ya se recorrieron en inglés en la ola 7.
- **El italiano en un teléfono de verdad.** El recorrido móvil fue a 390 px en el navegador de escritorio.

## 8 · Cifras

- `npm run typecheck`: limpio.
- `npx vitest run --testTimeout=60000`: **8367 de 8367** en 401 archivos. La base tenía 8353 en 400.
- `npm run build`: en verde.
- `node scripts/recuentos.mjs`: 115 notas, 1649 enlaces y 3 wikilinks rotos (los tres de siempre, que apuntan a ADR), medidos antes de estas notas. Los de después están en el diario.

## 9 · La versión local para el dueño

- Dos servidores, levantados con `exec node ../../node_modules/next/dist/bin/next start` desde `apps/web` de este worktree, con `IDIOMA_INGLES=1` e `IDIOMA_ITALIANO=1`:

  | Dirección | Instancia | Base |
  |---|---|---|
  | `http://localhost:3600/spaces-dooh/login` | **italiana** | `spaces_demo_it` |
  | `http://localhost:3601/spaces-dooh/login` | **española** | `spaces_demo_es` |

- Usuarios, con la misma contraseña (en el *scratchpad*, `clave-tres-idiomas.txt`):
  - `duena@demo.invalid` (Dueña);
  - `dueno@catalogo.invalid`, `administrador@`, `director.comercial@`, `gerente.ventas@`, `vendedor@`, `operaciones@`, `imprenta@` y `finanzas@catalogo.invalid`.
- El idioma de la interfaz se elige en la pantalla de entrar o en «Mi cuenta → Idioma». El de los papeles es el de la instancia.
- Space Eyes funciona mientras el doble del 4471 siga vivo.

## 10 · Lo que se tocó

- `components/demo/ui/Paginacion.tsx`, `components/demo/ui/IndicadorCarga.tsx`, `components/IndicadorCarga.tsx`.
- `components/demo/arrendadores/PagosRentaCard.tsx`, `components/demo/arrendadores/PanelFirmas.tsx`.
- `app/(app)/login/page.tsx`.
- `lib/i18n/papeles.ts`, `lib/i18n/donde-falla.ts`, `lib/i18n/errores-acceso.ts`.
- `lib/i18n/textos/compartidos.ts` (y su instantánea), `lib/i18n/textos/finanzas.ts`.
- Nueva: `lib/i18n/recorrido-italiano.test.ts`.

No se tocó nada de lo prohibido:
- `middleware.ts`, `nav.ts`, auth ni `app/api/auth/forgot`;
- las migraciones ni `db/schema.sql`;
- `aislamiento.e2e.test.ts` ni `servidor-e2e.ts`.

Tampoco se usaron `git stash` ni `git push`. El 3500, `spaces_e2e`, `spaces_demo_nueva` y `spaces_idiomas_e2e` no se tocaron.

# Revisión · Ola 0 del italiano (la infraestructura)

**Fecha:** 2026-11-03 · **Rama:** `feat/italiano-base`, sobre `integra/italiano`
(que sale de `integra/ingles`, `a89bd217`) · **Tablero:**
`vault/03-Frontend/italiano-olas.md`

Pedido del dueño: «ahora versión en italiano». Esta ola prepara la aplicación
para un tercer idioma **sin traducir la interfaz**: eso lo harán cinco lotes con
traductor y validador (partición en el tablero, §2).

## 1 · Qué se construyó

| Pieza | Archivo | Qué hace |
|---|---|---|
| El idioma y su interruptor | `lib/i18n/idiomas.ts` | `IDIOMAS = ['es','en','it']`; `italianoActivo()` (solo `IDIOMA_ITALIANO=1`); `idiomasActivos()`; `normalizarIdioma`, `idiomaDeCabecera` y `resolverIdioma` con `permitidos` |
| Quién decide | `lib/i18n/servidor.ts`, `pages/_error.tsx`, `app/layout.tsx` | Leen `idiomasActivos()` en vez de `inglesActivo()`. Un idioma apagado se trata como uno que no hablamos |
| El selector | `components/demo/ui/SelectorIdioma.tsx`, `lib/i18n/contexto.tsx` | Ofrece solo los `disponibles` que manda el servidor; `cambiarIdioma` ignora los demás |
| El formato, en UN sitio | `lib/i18n/formato-idioma.ts` | `FORMATO_IDIOMA`: locale, agrupación, fecha por omisión, símbolo y su posición, nombre de moneda, porcentaje, letra del trimestre. `localeDe`, `numeroEnIdioma`, `porcentajeEnIdioma`, `opcionesNumero` |
| El dinero | `lib/i18n/dinero.ts`, `simbolo-en-pantalla.ts` | Leen la tabla. Italiano: «MX$ 1.160,00» |
| Los diccionarios | `textos/*.ts`, `diccionario.ts` | `IT_<AMBITO>: Partial<Record<…>>` en cada ámbito (vacíos) y la base con el selector. `DICCIONARIOS.it = conCaidaAlIngles(EN, IT)` |
| Los errores del servidor | `errores-servidor.ts` | `CATALOGO_ERRORES_IT`, `CATALOGO_LIB_IT`, `CAMPO_IT`, `FALTA_FIRMA_IT`; patrones con `it` y `huecosIt`. Nunca a medias |
| La cobertura | `cobertura-italiano.ts` | Tabla por ámbito; `problemasItaliano()` rechaza vacíos, huecos distintos y claves sin español |
| La guardia | `guardias-italiano.ts` | Formatos españoles e ingleses en HTML italiano |
| El volcado y el espejo | `lib/test/volcado-html.ts`, `lib/test/espejo-italiano.ts`, `vitest.config.ts` | `I18N_VOLCAR_TODO` vuelca todo el HTML de las pruebas; `I18N_VOLCAR_IT` además lo rinde en italiano y lo pasa por la guardia |
| La costura | `textos/costura.test.ts` | Mismo español → mismo italiano entre lotes, tolerando vacíos |

## 2 · Los sitios binarios que se generalizaron

Se buscó cada `idioma === 'en'`, `idioma === 'es' ? 'es-MX' : 'en-US'`,
`'en-US'` en una rama no española y `toLocaleString('es-MX')` con el idioma a
mano. Los que decidían un **formato** pasan a la tabla:

- `lib/data/derive.ts`: `formatMonto`, `formatMontoCorto` (cifra), `formatFecha`,
  `formatFechaHora`, `etiquetaBucket` (y la letra del trimestre).
- `lib/formato-numero.ts` (`formatNumero` con `idioma` opcional),
  `lib/periodos.ts` (`etiquetaCantidad`, `etiquetaFrecuencia`),
  `lib/doohmain-programacion.ts` (`textoReproducciones`),
  `lib/finanzas-periodo.ts` (`etiquetaPeriodo`).
- `components/demo/reportes/tabla.ts` (porcentaje, entero, horas, kWh, m²),
  `energia/captura.ts`, `energia/RejillaCaptura.tsx`,
  `CalendarioDisponibilidad.tsx`, `admin/ActualizacionesPanel.tsx`,
  `admin/TicketsPanel.tsx`, `arrendadores/CambiosContrato.tsx`,
  `arrendadores/ConstanciaFirmas.tsx`, `arrendadores/PanelFirmas.tsx`,
  `captacion/Captacion.tsx`, `comercial/SpaceEyeVision.tsx`,
  `comercial-opex/ComercialOpex.tsx`, `operaciones/OTVista.tsx`.
- Space Eyes: `Graficas.tsx`, `Historial.tsx`, `Programacion.tsx`,
  `CampanasEyes.tsx`, `Galeria.tsx`, `piezas.tsx` (`haceSinPrefijo` por idioma).
- Páginas: `disponibilidad`, `inicio`, `creativos`, `propuestas`.

**Los que NO se tocaron, y por qué:**

- `idioma === 'es' ? literal : traducir(idioma, …)` (unos 70): ya están bien
  para el italiano — van por el diccionario, que cae al inglés.
- `toLocaleString('es-MX')` **sin idioma a mano** en textos que se quedan en
  español por diseño: bitácora y notificaciones del servidor
  (`app/api/**/route.ts`), el sello de las fotos (`space-eyes-marca*.ts`),
  `lib/server/finanzas-repo.ts`, `lib/group-by-day.ts`,
  `lib/calculadora-spots.ts` (`fmtH`), `lib/tarifa-calculada.ts`,
  `lib/paquete.ts` y el **documento del contrato** (`lib/contrato-documento.ts`,
  ver §6). Y `fmtNum` de `propuestas/page.tsx` (sin idioma en su ámbito) y el
  importe del paso de revisión de firmas (`PanelFirmas.tsx:307`, es el dato que
  se congela). Los lotes que los pinten en una pantalla italiana los verán en el
  espejo.

**Por qué cambiar `'es-MX'` fijo por el idioma no mueve el inglés:** `es-MX` y
`en-US` escriben las cifras igual. Medido: 200 000 importes × 7 juegos de
opciones (y NaN, Infinity, −0), **0 diferencias**.

## 3 · La caída de una clave sin italiano

Al **inglés**, no al español (`conCaidaAlIngles`, `diccionario.ts`): el inglés
está completo y revisado, es más legible para un italiano, y el glosario
italiano conserva los anglicismos. Una cadena vacía no cuenta como traducida. La
prueba de cobertura cuenta lo pendiente. En errores del servidor, un mensaje
compuesto («Campo: motivo», o un patrón con huecos traducidos) sale en italiano
solo si **todas** sus piezas lo tienen.

## 4 · Español e inglés idénticos — medido

| Medición | Resultado |
|---|---|
| HTML de **todas** las pruebas (`I18N_VOLCAR_TODO`, 3021 archivos), antes (`a89bd217` + arnés) y después | `diff -rq` = **0** distintos, 0 desaparecidos; 4 nuevos (las pruebas nuevas del selector) |
| Determinismo del volcado: dos corridas del mismo árbol | `diff -rq` = 0 |
| `DICCIONARIOS.es` / `.en` | 5589 valores, **0 cambiados**, 0 quitados; 1 clave nueva (`idioma.it` = «Italiano») |
| `traducirError` es/en sobre los 201 del catálogo y los 27 de `lib` | 0 cambiados |
| Papeles, checklist de OT, acceso, notificación de muestra, formatos de dinero/fecha/número | Iguales |
| CSV del estado de cuenta en es y en | Sus pruebas byte a byte (`estado-cuenta-csv-idioma.test.ts`) en verde, sin tocarlas |

## 5 · El italiano, mirado por el espejo

`I18N_VOLCAR_IT=<carpeta> npx vitest run lib/i18n components`: 2108 estados en
italiano, **358 huellas de formato** en 5 archivos:

| Archivo de pruebas | Huellas | Lo que más sale |
|---|---:|---|
| `pantallas-propuestas` | 191 | «Nov 1, 2026», «1,000.00», «$ 1,000.00» en el documento de la propuesta (Server Component con `servidor.idioma` simulado en `en`) |
| `pantallas-spaceeyes` | 87 | «1.2», «0.00»: cifras de ejemplo y de los textos que caen al inglés |
| `pantallas-inicio` | 32 | «1,234 space·days» (barrido del diccionario con cifras preformateadas) |
| `pantallas-comercial` | 24 | «E.g. 12.9»: ejemplos del diccionario |
| `pantallas-inventario-arrendadores` | 24 | El documento del contrato en español («2 de noviembre de 2026», «a.m.»): §6 |

Ninguna es de la maquinaria nueva. Cada lote parte de su fila.

## 6 · Para la tarea ROJA del idioma de la instancia (contratos)

Decisión del dueño (03/11): los contratos se generan en el idioma elegido al
crear la instancia, distinto del de la interfaz. **No se implementó** (migración,
firmas y hash, aprovisionamiento). La ola 0 lo deja preparado así:

- Todo formateador y `traducir()` reciben el idioma **como parámetro**:
  `traducir(idiomaInstancia, …)`, `formatearDinero(m, idiomaInstancia)`,
  `localeDe(idiomaInstancia)` funcionan en el servidor sin petición.
- **Puntos de enganche:**
  - `lib/contrato-documento.ts`: `generarContrato` (texto legal en español
    literal), `numeroALetras` (cantidad con letra, solo español),
    `toLocaleString('es-MX')` de la cifra (`:249`), `documentoATexto`.
  - `lib/contrato-documento.ts:504` `hashParaCotejar`: ya calcula el hash de
    una versión anterior del texto para cotejar firmas viejas — el mismo
    mecanismo hará falta si el idioma cambia el texto.
  - `lib/server/firmas-repo.ts:42` y `:242`, `lib/server/contrato-expediente.ts`:
    quien genera y sella.
  - `components/demo/arrendadores/ConstanciaFirmas.tsx`: ya recibe `idioma` por
    propiedad; pasarle el de la instancia en vez del de la petición.
  - El modelo a copiar: `lib/server/moneda-instancia.ts` / `moneda-alta.ts`
    (moneda elegida al crear, inmutable, ADR 0048).
- Nada de la ola 0 supone que el documento es español: el espejo lo marca como
  huella («2 de noviembre de 2026» en `pantallas-inventario-arrendadores`).

## 7 · Pruebas y mutantes

Pruebas nuevas (todas en rojo antes de su implementación, salvo las de la
guardia y la cobertura, escritas junto con su módulo y medidas por mutantes):
`idiomas-italiano`, `servidor` (3 casos), `pantallas` (4 casos del selector),
`formato-idioma`, `errores-servidor-italiano`, `cobertura-italiano`,
`sitios-italiano`, `guardias-italiano`, `catalogos-italiano`,
`lib/test/espejo-italiano`, y la costura del italiano.

**Mutantes: 32 distintos, 30 mueren.** Uno más sobrevivía en la primera
medición —dejar que una cadena italiana vacía tapara el inglés— porque
`DICCIONARIOS.it` se arma al cargar el módulo; se sacó la caída a
`conCaidaAlIngles()`, se probó directamente y ahora muere. Los 2 vivos son
equivalentes:

- `servidor.ts`: `permitidos.length === 1` → `=== 0`. Con solo el español
  permitido, `resolverIdioma` devuelve español de todos modos.
- `reportes/tabla.ts`: `porcentajeEnIdioma` → la bifurcación de antes. Para el
  italiano de hoy (sin espacio) da lo mismo; cambiaría si el dueño pidiera
  «55,0 %».

## 8 · Decisiones para el dueño

Ver el tablero, §3: **P1** (dólar en italiano), **P2** (letra del trimestre),
**P3** (comillas), **P4** (idioma de la instancia, tarea roja).

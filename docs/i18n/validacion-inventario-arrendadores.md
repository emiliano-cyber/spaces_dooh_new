# Validación · lote de inglés «inventario y arrendadores» (con contratos, firmas y razones sociales)

- **Rama:** `feat/ingles-inventario-arrendadores` (worktree `.claude/worktrees/ingles-inventario-arrendadores`). Diff revisado: `git diff ec427a66..HEAD`, dos commits (`729ef37a` feat, `e008a105` docs), 36 archivos.
- **Fecha:** 2026-11-02. **Validador:** agente independiente. No corrige código; este informe es lo único que escribe, y no está commiteado.

## Veredicto: **ÁMBAR**. Se puede integrar después de corregir los tres puntos de severidad media.

**Lo crítico está bien.** Ningún camino hace que el documento que se firma dependa del idioma. `lib/contrato-documento.ts`, `ConstanciaFirmas.tsx`, `lib/server/firmas-repo.ts` y `app/api/**` no aparecen en el diff. Sus pruebas pasan sin tocarlas.

Comprobado de forma mecánica:

- **Español intacto:** 81 de 81 estados idénticos byte a byte (`diff -rq`, volcado propio).
- **Diccionario:** las 761 claves se leyeron entera una por una, en su par ES/EN.
- **Pruebas:** typecheck limpio y **4811 unitarias en 337 archivos** en verde.
- **Mutantes:** de 8, mueren 7. **Sobrevive uno de los pedidos**: quitar el idioma en un llamador de dinero o fecha.

**Los tres hallazgos de severidad media:**

1. **La prueba no ve un `formatMonto`/`formatFecha` sin idioma.** El mutante sobrevive: el inglés pinta `$ 10,000.00` y `02/10/2026` y ninguna prueba se entera.
2. **`lote.frase()` mete una frase entera en español** («Se aplicó en 2 de 5 pantallas; 3 sin cambiar.») dentro del cuadro inglés de contraseña del cambio masivo. Está declarado, pero se arregla en el componente sin tocar `lib/`.
3. **El historial de cambios del contrato pinta el dinero sin idioma** (`valorParaMostrar`), así que sale `$ 12,000.00` en vez de `MX$`. Incumple la regla 4 del encargo. La regla 5 permite añadir `idioma` con `'es'` por omisión.

Además hay unos 14 hallazgos de severidad baja. Uno repite un error que ya había cazado el validador de comercial: «No screen matches».

---

## 1 · Contratos y firmas (lo crítico)

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `lib/contrato-documento.ts` sin cambios | **Sí** | `git diff --stat ec427a66..HEAD -- lib/contrato-documento.ts components/demo/arrendadores/ConstanciaFirmas.tsx lib/server/ app/api` sale vacío |
| El documento no depende del locale de quien mira | **Sí** | `contrato-documento.ts` no importa nada. Su única llamada de formato es `toLocaleString('es-MX', …)` en la línea 249, fija. No usa `navigator`, `window` ni `Intl` dependiente del entorno |
| Cantidad con letra, DECLARACIONES / CLÁUSULAS, sellos y aviso de borrador | Intactos | Viven en `contrato-documento.ts` y `ConstanciaFirmas.tsx`, que no se tocaron. En `contrato/[id]/page.tsx` solo cambian dos cosas que no se imprimen: el `title` del hueco `doc-falta` y el aviso «sin permiso» |
| `contrato-documento.test`, `firmas-repo.token.test`, `firmas-repo.reparto-token.test` | **Verdes y sin tocar** | Ninguno sale en el diff. Corridos aparte junto con las pantallas de los lotes aprobados: 7 archivos, 283 pruebas, todas verdes |
| `firmar/[token]`: la interfaz va en el idioma de la petición | **Sí** | `traducir(idiomaDeLaPeticion(), …)` en la página (Server Component) y `useTexto()` en `FirmaPublica`. **Mutante 6** (forzar `'es'` en la página): **muere** |
| `firmar/[token]`: el texto congelado se muestra tal cual | **Sí** | `FirmaPublica.tsx:113`: `<pre className="doc-congelado">{documento}</pre>`, con `documento = f.documento` de `firmaPorToken`. Ni un `t()` lo toca |
| ¿Hay algún camino por el que el documento firmado cambie con el idioma? | **No. Sin hallazgo ALTO** | El POST de firma (`app/api/firma/[token]/route.ts`) no se tocó y solo recibe `{ nombre }`. «Enviar a firma» manda `{ accion, huellaRevisada: revision?.huella }`, y esa huella la calcula el servidor (`huellaDatosContrato`). El paso de revisión solo traduce los rótulos que se pintan. La periodicidad traducida se pinta, pero no viaja |

**Sobre dejar la constancia en español: de acuerdo.**

- La constancia se imprime pegada al documento y recita su sello. Un papel con el contrato en español y la constancia en inglés tendría dos idiomas, y la constancia es precisamente la prueba de lo que se firmó.
- La regla está bien atada. **Mutante 3** (traducir el título de la constancia solo cuando el idioma es `en`) muere dos veces:
  - en la prueba de comportamiento: el estado «documento del contrato (Server Component)» exige el español en el render inglés;
  - en la guardia de fuente: `arrendadores.test.ts:167` prohíbe `i18n|traducir|useTexto|useIdioma` en `ConstanciaFirmas.tsx`.
- **Pregunta para el dueño:** la casilla de consentimiento de la firma pública sí se tradujo (`arrendadores.publica.acepto`: «I have read the whole contract and state my will to be bound by its terms…»). Ver §7.

---

## 2 · Sentido en contexto

Cada frase se leyó en su par ES/EN, extraído de los dos archivos con `node --experimental-strip-types`, y en el texto del HTML inglés de los 81 estados (`I18N_VOLCAR_EN`). Las líneas son del valor `en`.

| clave | archivo:línea | inglés actual | problema | propuesto | sev. |
|---|---|---|---|---|---|
| (llamador) `avisoDeLote` → `inventario.lote.*` | `InventarioTabla.tsx:65` · `inventario.ts:466-469` | `{frase}` = «Se aplicó en 2 de 5 pantallas; 3 sin cambiar.» seguido de «Confirming applies ONLY…» | Una frase entera en español dentro del cuadro inglés de contraseña. Está declarado, pero `lote.aplicadas()`, `lote.pendientes()` y la unidad son conocidos en el componente, así que se arregla sin tocar `lib/cambios-lote.ts` | Claves `inventario.lote.aplicado.{uno,otros}` («Applied to {ya} of {total} {unidad}; {faltan} unchanged.»). Pasar `lote.frase()` solo en `es`, para que el español no cambie | **media** |
| (llamador) `valorParaMostrar` | `CambiosContrato.tsx:153,155` → `lib/contrato-cambios.ts:103` | `$ 12,000.00` → `$ 10,000.00` en el historial | `formatMonto(Number(valor))` sin idioma: en inglés no sale `MX$`, a diferencia del resto de la ficha. Está declarado, pero incumple la regla 4, y la regla 5 permite añadir `idioma = 'es'` | `valorParaMostrar(campo, valor, idioma = 'es')` → `formatMonto(Number(valor), idioma)`. Pasarle `idioma` desde `CambiosContrato` | **media** |
| (rótulo del historial) `c.etiqueta` | `CambiosContrato.tsx:152` | «Renta:», «Depósito:», «Fecha de inicio:» (en el fixture: «Importe:», «Garantía:») | Se guarda como dato, así que no es una infracción. Pero `c.campo` es estable y casi todas sus etiquetas ya tienen clave (`comun.renta`, `comun.deposito`, `comun.periodicidad`, `editar.moneda`, `ficha.renovacion`…) | Mapa `campo → ClaveTexto`, con `c.etiqueta` como respaldo | baja |
| `arrendadores.barra.en` | `arrendadores.ts:937` · `BarraDocumento.tsx:40` | «In Administración:» | Mitad inglés, mitad español, porque `donde` lo redacta `contrato-documento.ts`. Está declarado. Los valores de `donde` son un conjunto corto y fijo | Mapear los `donde` conocidos a claves en la barra, que no se imprime. Lo desconocido, tal cual | baja |
| `inventario.tabla.vacio.filtros` · `arrendadores.rentabilidad.sin-filtro` · `arrendadores.lista.sin-filtro` · `inventario.tabla.vacio.busqueda(-filtros)` | `inventario.ts:525,523` · `arrendadores.ts:613,623` | `No screen matches the chosen filters.` / `No landlord matches…` / `No site matches “{q}”.` | **Repite un hallazgo** de `validacion-comercial.md`: tras «no», el inglés natural va en plural | `No screens match the chosen filters.` · `No screens match the filter.` · `No landlords match the filter.` · `No sites match “{q}”.` | baja |
| `inventario.kpi.propias.sub` | `inventario.ts:446` | `no rent: its costs are electricity and operations` | El sujeto es «Owned» (pantallas, en plural) | `no rent: their only costs are power and operations` | baja |
| `inventario.carga.duplicados` | `inventario.ts:769` | `{n} code(s) already exist` | Plural con «(s)» y sin `.uno`/`.otros`: «1 code(s) already exist» | Partir en `.uno` / `.otros` (el español puede seguir diciendo «código(s)») | baja |
| `inventario.alta.total-slots` | `inventario.ts:685` | `Slots in total` | Rótulo de campo poco natural | `Total slots` | baja |
| `arrendadores.contratos.excel` | `arrendadores.ts:583` | `Active ones in Excel` | Botón que se lee raro | `Active (Excel)` o `Export active (Excel)` | baja |
| `arrendadores.comun.la-que-arrienda` | `arrendadores.ts:532` · `ContratoSheet.tsx:523,853` | ` — the one that leases` | Ambiguo (¿arrienda o da en arriendo?). Marca la razón social propia recomendada para el contrato | ` — the lessee entity` (o ` — recommended`) | baja |
| `arrendadores.razones.facturan.uno/.otros` | `arrendadores.ts:660-661` | `{n} contract invoices here` | Sujeto raro: un contrato no factura | `{n} contract billed to this name` / `{n} contracts billed to this name` | baja |
| `arrendadores.completar.varias` | `arrendadores.ts:710` | `…Which one invoices this contract is chosen in its profile.` | Sintaxis enrevesada | `…Choose which one this contract is billed to in its profile.` | baja |
| `arrendadores.alta.razon-fallo` · `alta.fiscales-ayuda` · `revision.nota` | `arrendadores.ts:591,603,925` | `…its legal name… from its profile` · `the landlord’s in its profile` | Para el arrendador se usa «its», mientras `lista.predios-title` y `baja.conserva` dicen «their». Mezcla | «their» en todas | baja |
| `arrendadores.firmas.desfasado` · `arrendadores.editar.aviso-firmado` | `arrendadores.ts:899,790` | `Send it for signature again … collect the signatures again.` · `…send it for signature again … sign it again.` | «again» repetido en la misma frase | `…Send it for signature again to seal the new version and collect new signatures.` · `…so both parties review and re-sign it.` | baja |
| `arrendadores.licencias.vigente` | `arrendadores.ts:808` | `Active` | Para un permiso suena más natural «Valid». «Active» se queda bien para contratos | `Valid` | baja |
| `arrendadores.ficha.ruc` frente a `inventario.wizard.rfc` | `arrendadores.ts:692` | `Tax ID (RUC)` frente a `RFC (tax ID)` | Orden distinto para la misma glosa. RFC sigue a `campanas` (correcto) | `RUC (tax ID)` | baja |
| (comentario) | `pantallas-inventario-arrendadores.test.ts:36` | cita `docs/i18n/revision-inventario-arrendadores.md` | Ese archivo no existe: son `revision-inventario.md` y `revision-arrendadores.md` | Corregir la referencia | baja |

**Términos en contexto:**

- **lease agreement:** solo en títulos y en «contrato de arrendamiento»; en el resto, contract. Coherente.
- **security deposit:** bien.
- **rent reconciliation:** bien, aunque la tarjeta es más un saldo que un cuadre (ver §7).
- **license/permit:** «Permits and licenses» en el título, «Municipal license» como tipo y «Permit» como nombre genérico. Aceptable.
- **lessee:** ver §7.
- **location:** choca con «Ubicación → Location» (ver §7).
- **individual screen, manual entry, bulk upload, deactivate y freeze:** bien en todas sus apariciones.
- **Legal entities / legal name:** el reparto es coherente. «Legal name» se usa para la razón social del arrendador y «Legal entity/entities» para las propias (`pagadora.*`, `entidades.*` y la página).

**Las tres excepciones nuevas de la costura**, comprobadas en su punto de uso:

- **Vence:** «Expires» en la columna de contratos (`arrendadores/page.tsx`) frente a «Due» en la de cuotas (`PagosRentaCard`). Correcto.
- **Próximo:** «Next» en el cuadre frente a «Upcoming» en códigos. Correcto.
- **Actualizar:** «Update» en la carga masiva frente a «Refresh» en DOOHmain. Correcto.

**Plurales y huecos.**

- Todos los contadores llevan `.uno`/`.otros`, salvo `carga.duplicados`, que está en la tabla.
- Las claves sin `.uno` se usan solo con n ≥ 2: `renta.compartida-confirm`, `renta.predio-actualizada`, `completar.varias` y `carga.lejos-varias`, que tiene su `lejos-una`.
- Los huecos JSX van por `interpolarNodos`, sin concatenar trozos traducidos.
- Las guardias de huecos iguales están en verde.

---

## 3 · El español intacto

- **Volcado propio de los 81 estados.**
  1. `I18N_VOLCAR` con HEAD.
  2. `git --literal-pathspecs checkout ec427a66 --` de los 22 componentes y páginas modificados (`git diff --name-only --diff-filter=M ec427a66..HEAD -- apps/web/app apps/web/components`). La prueba y el diccionario se quedaron en HEAD.
  3. Segundo volcado y restauración con `checkout HEAD --`.
  4. `diff -rq` de los dos volcados: **vacío, 81 de 81 idénticos**.

  Los 81 HTML son distintos entre sí (ningún md5 repetido), así que los estados forzados son reales y no la misma pantalla 81 veces.
- **Funciones de `lib/` que ganaron idioma:** ninguna en este lote. El diff de `lib/` solo toca `lib/i18n/**`. Los espejos nuevos (`components/demo/{inventario,arrendadores}/etiquetas.ts`) repiten `medioLabel`, `disponibilidadInventario`, `textoVencimiento`, `faltaEnContratos` y `LICENCIA_LABEL` sin tocarlos. Los leí contra los originales (`derive.ts:1414`, `StatusBadge.tsx:101`, `renta-periodicidad.ts:234`, `derive.ts:1161`, `derive.ts:356`) y reproducen la lógica rama por rama. **Mutante 8** (`libres <= 0` → `libres < 0` en `textoDisponibilidad`): **muere** en la prueba de paridad.
- **Pantallas de los lotes aprobados:** `pantallas-propuestas`, `pantallas-compartidos`, `pantallas-comercial` y `pantallas-campanas-finanzas`, todas en verde (283 pruebas junto con las de firmas).
- **El id de plegado de `PagosRentaCard`:** para un usuario en español **no cambia nada**.
  - El `id` sigue siendo `` `renta.${titulo}` `` con el `titulo` de la prop. Por omisión es la constante `'Pagos de renta'`, la misma cadena que antes, y solo cambia `titulo={tituloVisible}`, que es lo que se pinta.
  - En Arrendadores el id es `renta.Pagos de renta` en los dos idiomas.
  - **Mutante 7** (id con `tituloVisible`): **muere** en `arrendadores.test.ts` («el id de la tarjeta de pagos de renta NO cambia con el idioma»).
  - *Nota preexistente, de otro lote:* Finanzas pasa `titulo={t('finanzas.renta.titulo')}` desde antes de este lote (`finanzas/page.tsx:469` en ec427a66). Allí el id sí cambia con el idioma: `renta.Rent payable to landlords` frente a `renta.Renta por pagar a propietarios`. En español no cambia nada; quien alterne idiomas verá el plegado de Finanzas por separado. No es un defecto de este lote.

---

## 4 · Nada en español en el inglés, salvo lo declarado

Escaneé el texto del HTML inglés de los 81 estados buscando acentos y palabras funcionales en español. Lo que aparece:

- **Declarado y correcto:**
  - el documento del contrato, la constancia, los sellos y el aviso de borrador (estado 71);
  - «RFC del arrendador» (la etiqueta de `Faltante`);
  - los datos de prueba (Doña Rosa, Benito Juárez, Alcaldía, «bajar renta», «Navidad»);
  - el importe que recita el paso de revisión (`$10,000.00 MXN`, estados 64 y 67).
- **Declarado pero arreglable:** los tres primeros de la tabla de §2 (`lote.frase()`, `valorParaMostrar` y la etiqueta del historial) y «In Administración:».
- **De otro lote:** el error de formato de `CampoCifra` («Escribe solo cifras: …», estado 56, `lib/captura-cifra.ts:45`). La prueba de este lote lo quita a propósito antes del barrido (`pantallas-inventario-arrendadores.test.ts:1484`) y la bóveda lo declara. Le toca a la ola que traduzca `captura-cifra`.

No hay ninguna fecha `dd/mm/aaaa` en el inglés. El dinero sale `MX$` en todas partes, salvo en el historial de cambios y en la revisión de firmas.

---

## 5 · Reglas

| Regla | Resultado |
|---|---|
| Sin dinero en el diccionario | **Sí.** Ni `$`, ni `MXN`/`USD`, ni «pesos» en `textos/inventario.ts` ni en `textos/arrendadores.ts`; todo va por `{monto}` |
| `MX$` en inglés | **Sí** en las pantallas del lote, con las excepciones de §4. Cada llamador modificado de `formatMonto`/`formatFecha` en los 22 archivos lleva `idioma` (grep sin resultados para llamadas sin él) |
| `desktop.ini` | **Ninguno en el diff.** *Aparte:* `vault/*/desktop.ini` ya estaba versionado en ec427a66; no lo añadió este lote |
| `costura.test.ts` con los 8 lotes | **Sí:** propuestas, compartidos, campañas, finanzas, comercial, códigos, inventario y arrendadores. Tres entradas nuevas en `DISTINTOS_A_PROPOSITO`, cada una con su porqué |
| Archivos prohibidos | No se tocan `middleware.ts`, `nav.ts`, `schema.sql`, las migraciones, `app/api`, `aislamiento.e2e`, `servidor-e2e`, `dinero.ts` ni `IDIOMA_INGLES` |
| Comentarios | Ninguno borrado: ninguna línea `-//` ni `-{/*` en el diff |
| Commits | En español, con el formato del proyecto y la atribución |

---

## 6 · Pruebas

```
cd apps/web && npm run typecheck   → tsc --noEmit, código 0
cd apps/web && npm test            → Test Files 337 passed (337) · Tests 4811 passed (4811)
```

La base del encargo daba 4610.

**Mutantes.** Cada uno se aplicó, se corrió y se restauró con `git checkout --`. El árbol quedó limpio después de cada uno.

| # | Mutante | Resultado |
|---|---|---|
| 1 | `es` cambiado: `inventario.tabla.quitar-filtros` «Quitar filtros» → «Quitar los filtros» | **Muere** (instantánea + estado «búsqueda sin resultados con filtros») |
| 2 | `en` en español: `arrendadores.pagos.col.contrato-hasta` → «Contrato hasta» | **Muere** (4 pruebas: guardia es≠en, instantánea, estado y barrido) |
| 3 | Constancia traducida solo en inglés (`idiomaDeLaPeticion() === 'en' ? …`) | **Muere** (estado del documento + guardia de fuente) |
| 4 | Clave de un toast cambiada: el asistente usa `ok.asignada` en vez de `ok.predio` | **Muere** («el asistente: predio, asignada o creados, en ese orden») |
| 5 | Quitar el idioma en un llamador: `formatMonto(p.monto, idioma)` → `formatMonto(p.monto)` y `formatFecha(p.fechaPago, idioma)` → `formatFecha(p.fechaPago)` en `PagosRentaCard` | **SOBREVIVE.** 684 de 684 pruebas de `lib/i18n/` en verde. El volcado inglés cambia en los estados 35 y 39 a 44: `MX$ 10,000.00` → `$ 10,000.00` y `Oct 2, 2026` → `02/10/2026`, y ninguna prueba lo ve |
| 6 | `firmar/[token]`: `idioma = 'es'` fijo | **Muere** (estado «enlace no válido» + barrido) |
| 7 | `PagosRentaCard`: id de plegado con `tituloVisible` | **Muere** |
| 8 | Espejo `textoDisponibilidad`: `<= 0` → `< 0` | **Muere** (paridad) |

**Corrección que pide el mutante 5 (media).**

- Las pruebas de pantallas solo buscan frases españolas, y `$ 10,000.00` o `02/10/2026` no lo son. Es un hueco que comparten las pruebas de los demás lotes, pero aquí se pidió explícitamente.
- Propuesta: añadir al barrido inglés de este lote dos guardias.
  - `/(?<!MX)\$ ?\d/`, excluyendo lo declarado: el historial, si no se corrige, y la revisión de firmas, que es un dato.
  - `/\b\d{2}\/\d{2}\/\d{4}\b/`, fuera de los `value=` de los `<input>`.
- Hoy las dos pasarían con el HTML actual (comprobado en §4), así que no rompen nada y matan al mutante.

---

## 7 · Decisiones de glosario para el dueño

Ninguna bloquea la integración. Son elecciones del traductor que conviene confirmar.

1. **«lessee» junto a «landlord».** La pareja jurídica es *lessor/lessee*, y la coloquial *landlord/tenant*. Hoy se mezclan: «Your company (lessee)» y «Sign as lessee» frente a «landlord» en todo lo demás. ¿Se queda «lessee» o pasa a «tenant»?
2. **«location» para *emplazamiento*** (cuadre: «Landlord / location», «{n} locations»). Choca con *ubicación* → «Location» en la tabla de inventario. ¿Vale la colisión, o *emplazamiento* pasa a «site», que ya es *sitio*, o a «placement»?
3. **«Rent reconciliation by landlord»** para el cuadre. La tarjeta dice qué se debe y qué se pagó; «Rent balance by landlord» describe mejor lo que enseña. ¿Reconciliation o balance?
4. **licencia/permiso.** «Permit» como genérico (borrar, registrar, vacío) y «license» solo en «Municipal license» y en el título. ¿Se acepta?
5. **«Legal name» (arrendador) frente a «Legal entities» (propias).** Es coherente, pero son dos términos para la misma palabra española en pantallas vecinas. ¿Se fija así en el glosario?
6. **La casilla de consentimiento de la firma pública, traducida.** Quien firma en inglés lee el contrato en español y acepta en inglés que «my electronic signature will have the same effects as a handwritten signature». El texto de la casilla no se guarda ni entra en el hash (lo comprobé en `firmas-repo` y en la ruta de firma), así que no hay riesgo técnico. Pero es una declaración de voluntad. ¿Se deja en inglés, se pone en los dos idiomas o se deja en español como el documento?
7. **«RFC (tax ID)» y «Tax ID (RUC)».** La glosa entre paréntesis sigue a `campanas`. Falta fijar el orden para RUC.
8. **«Static» para pantalla *fija*** y **«Medium»** para el filtro *Medio*. Son razonables; conviene fijarlos en el glosario para los lotes que siguen.

---

## Segunda pasada (2026-11-02)

- **Diff revisado:** `git diff e008a105..HEAD`, que añade `c17f99ee` (código) y `db405279` (bóveda y tablas de revisión). El commit `85e29fce` es este mismo informe.
- **Decisión del dueño que manda sobre mi recomendación de §1:** la constancia se pinta en el idioma configurado.
- **Decisiones del orquestador:** lessee, Placement, Rent reconciliation, permit, Legal name / Legal entities, RUC (tax ID), Static / Medium y Valid. Comprobé que las ocho se aplicaron.

### Veredicto: **VERDE**

- Los tres hallazgos de severidad media están resueltos y verificados con mutantes.
- Lo crítico de las firmas está intacto.
- El español es idéntico en los 81 estados.
- Sobreviven tres mutantes. Todos son huecos de prueba sobre código que, leído, es correcto. Quedan abajo como recomendaciones de severidad baja, no bloqueantes.

### Lo crítico: la constancia en el idioma configurado

| Comprobación | Resultado | Evidencia |
|---|---|---|
| La constancia no entra en ningún hash ni se guarda como texto | **Sí** | `ConstanciaFirmas` solo se usa en `app/(app)/contrato/[id]/page.tsx:176`. `firmas-repo.ts` sella con `hashDocumento(documentoATexto(generarContrato(…)))` (líneas 42 y 242) y no menciona la constancia. Lo fija `arrendadores.test.ts` («el hash de las firmas es el del documento, no el de la constancia») |
| `lib/contrato-documento.ts` intacto | **Sí, misma sha256** | `git show ec427a66:…` y `git show HEAD:…` dan los dos `662e1799…cbcc4` con `sha256sum`. La nueva prueba de huella normaliza CRLF → LF antes de hashear, así que no falla en un checkout de Windows (el archivo está en CRLF en este disco y pasa) |
| Pruebas de firmas sin tocar | **Sí** | `contrato-documento.test` y `firmas-repo.*` no aparecen en el diff y pasan |
| Ningún camino hace que el documento firmado cambie con el idioma | **Confirmado** | La constancia recibe `idioma` como prop desde la página y no toca `documento`. El texto congelado (`<pre>`) y el POST de firma siguen igual que en la primera pasada |
| La constancia sigue el idioma | **Sí** | En el estado 71 en inglés: «Electronic signature certificate», «THE LESSEE», «— SIGNATURE INVALIDATED», «Date and time: October 20, 2026 at 9:00:00 AM». El documento de encima sigue en español («CLÁUSULAS», el aviso de borrador) |

### Los hallazgos de la tabla de §2, uno por uno

| Hallazgo | Estado | Comprobación |
|---|---|---|
| `lote.frase()` en español en el cuadro inglés | **Resuelto** | `fraseDeLote()` en `InventarioTabla.tsx` arma la frase con `inventario.lote.frase` y la unidad correcta según `total === 1`. Es la misma regla que `crearLote().frase()` (`cambios-lote.ts:94-95`, con `lote.total()`, que ya existía). La prueba de paridad fija que en español sale exactamente `lote.frase()` en cuatro casos. Para el toast, `alFallar` traduce solo cuando `m === lote.frase()`; los demás errores (el candado, el servidor) pasan tal cual. Correcto |
| `valorParaMostrar` sin idioma | **Resuelto** | `valorParaMostrar(campo, valor, idioma = 'es')` llama a `formatMonto(…, idioma)`. Los llamadores que no lo pasan, como el servidor, quedan igual. El historial en inglés pinta `MX$ 10,000.00` |
| Etiqueta del historial en español | **Resuelto** | `CLAVE_CAMPO_CONTRATO`, con paridad contra `CAMPOS`: los once campos, con el español idéntico. En inglés pinta «Rent:» y «Security deposit». Un campo desconocido sale tal cual |
| «In Administración:» | **Resuelto** | `CLAVE_FALTANTE_DOC` y `CLAVE_DONDE_DOC` cubren las 12 llamadas a `exigir()` de `contrato-documento.ts:279-290` y los cuatro «dónde». La prueba exige que cada cadena exista literalmente en el redactor. En español la barra pinta siempre la cadena original. Lo desconocido cae al texto original (el fixture «In Otra sección:»), que es la caída esperada |
| «No screen/site/landlord matches» | **Resuelto** | Ahora «No screens match…», «No sites match “{q}”…» y «No landlords match the filter.» |
| `code(s)` | **Resuelto** | `.uno` es «{n} code already exists» y `.otros` es «{n} codes already exist». El español no cambia |
| its/their, «Total slots», «Export active (Excel)», « — recommended», «billed to this name», el «again» repetido, «Valid», «RUC (tax ID)» y la cita del comentario | **Resueltos** | Leídos en el diff y en el HTML inglés |
| Mutante 5: hueco de la guardia | **Resuelto** | Lo cubre `lib/i18n/guardias-ingles.ts`; detalle abajo |

**Términos de las decisiones**, comprobados en el HTML inglés:

- «Landlord / placement» y «{n} placement(s)» en el cuadre.
- «THE LESSEE» en la constancia, coherente con «Your company (lessee)».
- «Valid» en licencias, con su entrada `Vigente` en `DISTINTOS_A_PROPOSITO` frente a «Active» de contratos y códigos.

### El español intacto

- **Volcado propio de los 81 estados, otra vez.**
  1. `I18N_VOLCAR` con HEAD.
  2. `git --literal-pathspecs checkout ec427a66 --` de los 24 archivos modificados. Ahora incluye `ConstanciaFirmas.tsx` y `lib/contrato-cambios.ts`.
  3. Segundo volcado y restauración con `checkout HEAD`.
  4. `diff -rq` de los dos volcados: **vacío, 81 de 81 idénticos**.

  La constancia en español sale byte a byte igual que antes.
- **`valorParaMostrar`:** con `idioma = 'es'` por omisión hace lo mismo que antes. `formatMonto(n, 'es')` es el mismo formato que `formatMonto(n)`.

### `lib/i18n/guardias-ingles.ts`

**Lo que detecta**, comprobado con mutantes:

- el dinero sin `MX$` que sale de `formatMonto` y `formatMontoCorto`. El separador es un espacio normal, no NBSP (`derive.ts:1441`), y la regex lo cubre con y sin espacio;
- las fechas `dd/mm/aaaa` de `formatFecha` y `formatFechaHora` en español.

**Falsos positivos:** no encontré ninguno. Hoy pasa limpio con el HTML inglés de los 81 estados. Los `value=` de los campos se excluyen, y la rama USD apaga la guardia del dinero, como corresponde.

**Falsos negativos** (los tres de severidad baja):

1. **Fechas largas en español** («20 de octubre de 2026, 9:00»): no las ve. El **mutante E** (quitar `idioma` en `fecha(estado.congeladoEn, idioma)` de `PanelFirmas`) **sobrevive**: el panel pintaría «Document frozen on…» en inglés con la fecha en español, y ninguna prueba se entera. Propuesta: añadir `/\b\d{1,2} de [a-záéíóú]+ de \d{4}\b/` (y quizá un patrón para las fechas cortas de `es-MX`).
2. **Atributos:** quita las etiquetas con sus atributos, así que no mira `title`, `aria-label` ni `placeholder`. Si una fecha o un importe se pintan en un `title`, no se ven.
3. **Lo permitido:** `permitidos` se compara contra 30 caracteres de contexto a cada lado. Una huella real pegada a un «$10,000.00 MXN» declarado quedaría perdonada. Es poco probable; sería más estricto comparar contra el trozo encontrado más el sufijo inmediato.

### `fraseDeLote` frente a `crearLote().frase()`

- **Leída, es correcta:**
  - `ya` sale de `aplicadas()`, `faltan` de `pendientes()` y `total` de `total()`;
  - la unidad va en singular solo si `total === 1`, igual que `cambios-lote.ts:94`;
  - `unidadLoteRef` se fija a `'pantalla'` o `'contrato'` justo antes de cada `candado.ejecutar`.
- **Pero la prueba de paridad vuelve a escribir la fórmula en vez de llamar a la del componente.** `fraseDeLote` no se exporta, y ningún estado rinde el cuadro de un lote a medias. Sobreviven dos mutantes:
  - **D1:** intercambiar `ya` y `faltan` dentro de `fraseDeLote`;
  - **D2:** fijar `'pantalla'` en el subtítulo en vez de `unidadLoteRef.current`.

  Severidad baja: el código es correcto hoy, pero nada lo fija. Propuesta: exportar `fraseDeLote` (o moverla a `inventario/etiquetas.ts`) y que la prueba de paridad la llame. O añadir un estado de pantallas con el cuadro abierto y un lote a medias.

### Textos nuevos, en contexto

Las 17 claves de la constancia, las 11 de campos del historial, las 16 de faltantes y «dónde» y las 5 del lote se leen bien. Una sola nota baja: en `arrendadores.constancia.nota`, «are kept as indications» suena forzado; propongo «are kept as circumstantial evidence».

### Pruebas

```
cd apps/web && npm run typecheck          → tsc --noEmit, código 0
cd apps/web && npm test                   → 1.ª corrida, máquina cargada: 9 fallos, todos por
                                            «Test timed out in 5000ms» en pantallas de campañas,
                                            comercial y de este lote
cd apps/web && npx vitest run --testTimeout=60000
                                          → Test Files 338 passed (338) · Tests 4824 passed (4824)
```

**Mutantes de esta pasada.** Todos se aplicaron, se corrieron (con `--testTimeout=60000`) y se restauraron con `git checkout --`.

| # | Mutante | Resultado |
|---|---|---|
| A1 | La página no pasa `idioma` a la constancia | **Muere**: estado del documento en inglés, los dos barridos y la guardia de fuente |
| A2 | La constancia ignora la prop (`traducir('es', …)`) | **Muere**, las mismas 4 pruebas |
| B1 | `contrato-documento.ts`: «CLÁUSULAS» → «CLAUSULAS» | **Muere**: 3 de `contrato-documento.test` (texto sellado y `hashParaCotejar`) y la huella sha256 |
| B2 | `contrato-documento.ts`: un espacio al final de la línea 1 | **Muere** en la huella sha256 |
| C1 | `PagosRentaCard`: `formatMonto(p.monto)` sin idioma | **Muere** en la guardia («dinero sin MX$ «$ 10,000.00»») |
| C2 | `PagosRentaCard`: `formatFecha(p.fechaPago)` sin idioma | **Muere** en la guardia («fecha dd/mm/aaaa «02/10/2026»») |
| C3 | `CambiosContrato`: `valorParaMostrar` sin idioma | **Muere** en la guardia («$ 12,000.00») |
| D1 | `fraseDeLote`: `ya` ↔ `faltan` | **Sobrevive** (baja, ver arriba) |
| D2 | Subtítulo con la unidad fija en `'pantalla'` | **Sobrevive** (baja) |
| E | `PanelFirmas`: fecha larga sin idioma | **Sobrevive**: falso negativo de la guardia (baja) |

El árbol quedó limpio después de cada mutante (`git status` vacío). La única modificación es esta sección del informe, sin commitear.

### Recomendaciones (no bloquean)

1. Añadir a `guardias-ingles.ts` el patrón de fecha larga en español, que mata al mutante E.
2. Exportar `fraseDeLote` y que la prueba de paridad la llame, o rendir el cuadro de un lote a medias. Mata a D1 y D2.
3. Que `permitidos` se compare contra el trozo encontrado y no contra los 60 caracteres de contexto.
4. Cambiar «kept as indications» por «kept as circumstantial evidence» en la constancia.

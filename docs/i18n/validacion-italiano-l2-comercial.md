# Validación · Italiano, lote L2 «Comercial y propuestas»

**Fecha:** 2026-11-03 · **Rama validada:** `feat/italiano-l2-comercial`
(`c3866f5e`, 3 commits sobre `integra/idiomas` `6fea374a`) · **Revisión del
traductor:** `docs/i18n/revision-italiano-l2-comercial.md` · **Validador
independiente:** no recibió el razonamiento del traductor; revisé el código, leí
las 1194 frases italianas y repetí las mediciones en dos copias (`git archive`
de la base y de la rama, con `node_modules` enlazado).

## Veredicto: ÁMBAR

El español y el inglés salen **idénticos** (medido), la cobertura es completa, el
italiano es bueno y los cambios de formato fuera de la lista son correctos. No
hay nada que rompa a otro lote. Queda en ámbar por cuatro cosas que conviene
cerrar antes de integrar:

1. **«predio» choca entre lotes** (L1 «proprietà», L2 «terreno», L3/L4
   «immobile»). Recomiendo **«immobile»** (§5).
2. **La liga pública `/p/[token]` se quedó sin el arreglo de cifras** que sí se
   hizo en el documento imprimible: en italiano saldría «Sconto per volume
   (2.5%)» (§4, H2).
3. **Cuatro mutantes sobreviven** porque las pruebas italianas no tienen un
   porcentaje con decimales en el tablero ni en Códigos, ni un conteo de cuatro
   cifras: el código está bien, pero nada lo vigila (§6). La revisión afirma
   «12,5%» en el tablero y ninguna prueba lo comprueba.
4. **Los términos propios del lote no están en la prueba de glosario** (solo en
   la instantánea) (§6).

## 1 · Español e inglés idénticos (criterio 3)

| Medición (repetida por el validador) | Resultado |
|---|---|
| `I18N_VOLCAR_TODO` de **toda** la suite (`npx vitest run`, sin filtro) en la base y en la rama | Base 3027 HTML, rama 3337. `diff -rq`: **0 distintos, 0 desaparecidos**. Los 310 nuevos son todos de pruebas italianas (nombre con «ITALIANO» o `_it_`; comprobado con `comm`) |
| Las dos corridas en copia fallan en las mismas 2 pruebas en base y rama | `aprovisionamiento.test` y `notificaciones.test` usan `git ls-files`/`git grep`, y una copia de `git archive` no tiene `.git`. En el worktree pasan (ver §7) |
| `DICCIONARIOS.es` y `.en` (5590 claves en la base) | **0 cambiados, 0 quitados**; 3 nuevos en cada idioma |
| Las 3 claves nuevas | `comercial.pagina.slots-hora` = `« slots/h»`, `propuestas.calc.spots-hora` = `«{n} spots/h»`, `propuestas.calc.spots-sufijo` = `« spots»`, en es **y** en: el literal exacto de antes. Mismos nodos de texto (`{x}{t(…)}` y `{x} spots` dan los mismos dos nodos con `<!-- -->`), y el volcado lo confirma |
| `traducirError` es/en sobre `CATALOGO_ERRORES` + `CATALOGO_LIB` (456 salidas) | 0 cambiados |
| El truco del espejo del documento imprimible (`pantallas-propuestas.test.ts:667`) | Solo entra con `I18N_VOLCAR_IT`. Con `I18N_VOLCAR_TODO` **y** `I18N_VOLCAR_IT` a la vez, el HTML es/en de `pantallas-propuestas` sale **idéntico** al volcado sin espejo (`diff -rq` vacío): `SegunIdioma` pinta el árbol inglés cuando recibe `en`. La corrida normal no lo toca |

### Los cambios de formato, uno por uno (es/en)

| Sitio | es/en antes → ahora | Veredicto |
|---|---|---|
| `formatNumero(x)` → `formatNumero(x, 0, idioma)` (Comercial, ficha, reserva, tablero, volumen, alta RB) | `es-MX` siempre → `es-MX` / `en-US` | Igual. Medido: `es-MX` vs `en-US` con 0 y 2 decimales sobre 0, −0, ±1, 999, ±1000, 1234.5, ±1 234 567, 1e9, 0.005, 1.005, ±2.5, 123 456 789.987 y `MAX_SAFE_INTEGER`: **0 diferencias** (Node 24.19, ICU 78.3). `null`/`NaN` siguen dando «—» antes de formatear |
| `cifraEnEtiqueta(n, idioma)` | `String(n)` → `String(n)` | Igual por construcción (`cifra-en-etiqueta.ts:508`) |
| `cifraEnEtiqueta(n, idioma, 2)` | `n.toFixed(2)` → `n.toFixed(2)` | Igual por construcción |
| Descuento comercial: `pctConDosDecimales(p)` → `cifraEnEtiqueta(Number(pctConDosDecimales(p)), idioma, 2)` | `toFixed(2)` → `Number(toFixed(2)).toFixed(2)` | Igual para todo valor real. Único borde distinto: un descuento **negativo** de menos de 0,005 (`-0.001` daba «-0.00» y ahora «0.00»). El descuento se valida 0–100 (`propuestas.ficha.descuento.invalido`), así que no ocurre |
| `fmtNum` de la calculadora (`propuestas/page.tsx:1829`) | `es-MX` fijo → `es-MX` fijo en es y en | Igual |
| `pct` del tablero (`TableroPropuestas.tsx:396`) | `` `${r} %` `` → igual en es/en | Igual; `null` sigue en «—» |
| `montoEntero` de paquetes (`GestionPaquetes.tsx:368`) | `.replace('.00','')` → igual en es/en | Igual. El arreglo italiano es correcto: «MX$ 100.000,00».replace('.00','') daba «MX$ 1000,00» |

## 2 · Cobertura (criterio 4)

- `IT_COMERCIAL`, `IT_CODIGOS`, `IT_PROPUESTAS`, `IT_CATALOGOS` son `Record<…>`:
  `tsc` exige cada clave. Contadas: 502 / 59 / 439 / 194 = **1194, 0 vacías**.
- Italiano igual al inglés o al español: 38 entradas, **todas justificadas**
  (cognados: «Video», «Cliente», «Tipo», «Motivo», «Periodo», «Inventario»,
  «Incompleto», «Operativo»; anglicismos decididos: «Programmatic», «Email»,
  «Online/Offline», «In pipeline»; huecos puros y «{pct}%»; el ejemplo «Seguros
  Andinos»).
- Espejo (`I18N_VOLCAR_IT`) sobre las tres pruebas del lote: **12 archivos, 24
  huellas**, todas el mismo caso declarado (P-L2-1: «Es. 12.9» y «Es. 7.2» del alta
  de pantalla). Coincide con la revisión.

## 3 · El italiano, frase por frase (criterio 1)

Leí las 1194 entradas (tabla es/en/it generada del diccionario) y el texto que
rinde el espejo de 28 pantallas (Comercial, ficha de pantalla en cinco estados,
reserva, alta, negociación, códigos, lista/ficha/calculadora/documento de
propuestas, paquetes, rejilla, volumen, palinsesto). Muestra de 48 con veredicto:

| # | Clave (o pantalla) | Italiano | Veredicto |
|---|---|---|---|
| 1 | `comercial.pagina.subtitulo` | La tua rete sulla mappa · 3 siti | Bien |
| 2 | `comercial.pagina.kpi.libres` | Liberi da vendere | Comprensible, algo calcado. Mejor **«Disponibili alla vendita»** (opcional) |
| 3 | `comercial.pagina.kpi.libres.sub` | su 3 impianti | Bien |
| 4 | `comercial.pagina.kpi.propuesta.sub` | impianti in 1 proposta aperta · non bloccano | Bien |
| 5 | `comercial.pagina.kpi.bloqueadas.sub` | contratto incompleto: si sistemano in Locatori | Bien |
| 6 | `comercial.sitio-estatus.reservado` | Prenotato · senza OdA | Bien (OdA es de uso corriente) |
| 7 | `comercial.pagina.slots-hora` (rendido) | · 120 slot/h | Bien, sin plural inglés |
| 8 | `comercial.pagina.descargadas.otros` | Scaricati {n} impianti | Correcto; más natural **«{n} impianti scaricati»** (y `.uno` «{n} impianto scaricato»). Opcional |
| 9 | `comercial.ficha.en-network` | Nella Network | **Corregir**: el préstamo es masculino en italiano → **«Nel Network»** |
| 10 | `comercial.alta.network` | Condividi nella Network (inventario non venduto) | **Corregir** → **«Condividi nel Network (inventario non venduto)»** |
| 11 | `comercial.ficha.slots-hora` | Slot all’ora | Bien (glosario «All’ora») |
| 12 | `comercial.ficha.exhibicion.rotativo` (rendido) | digitale · a rotazione | Bien |
| 13 | `comercial.ficha.propia.aviso` | Impianto di proprietà: non si paga canone a nessuno. Il suo costo è l’elettricità e la gestione; il margine reale lo vedi in Report. | Bien |
| 14 | `comercial.ficha.sin-contrato.aviso` | Senza un contratto di locazione attivo non si può calcolare il margine: manca sapere quanto si paga per lo spazio. | Bien |
| 15 | `comercial.ficha.tarifas-franja.vacio` | Nessuna griglia tariffaria: questo impianto si vende con le tariffe qui sopra… se il prime time o una stagione costano diversamente. | Bien |
| 16 | `comercial.ficha.no-reservable` (rendido) | Non prenotabile (stato: Disponibile) | Bien (declarado sin «sito») |
| 17 | `comercial.ficha.pausada.desde` | · dal 1 ott 2026 | Bien, fecha italiana |
| 18 | `comercial.ficha.eliminar.texto` | L’impianto viene eliminato e non si può più prenotare. Le sue prenotazioni e la sua cronologia restano come sono: … | Bien |
| 19 | `comercial.editar.cupo.ahora.uno` | Al momento ha {n} cliente. | Bien, concuerda |
| 20 | `comercial.tarifas.fija` | Questo impianto è fisso, quindi si vende solo al mese o ogni due settimane. | Bien (glosario «ogni due settimane») |
| 21 | `comercial.reserva.seleccionados.uno` / `.otros` | 1 sito selezionato / 2 siti selezionati | Bien, género y número |
| 22 | `comercial.reserva.slots-propios.otros` | 2 degli impianti scelti hanno un proprio numero di slot, e prevale il loro. | Bien |
| 23 | `comercial.reserva.sin-cupo.fila.uno` | {nombre} — limite di 1 cliente in quelle date, occupato da {ocupantes} | Bien, más claro que el literal |
| 24 | `comercial.reserva.tipo.ooh-opcion` | Statica (OOH) — con stampa | Bien («campagna statica» es del sector). Nota: en Propuestas «Fija» es «Fisso» (pantalla): contextos distintos, aceptable |
| 25 | `comercial.reserva.reservar` | Prenota (provvisoria) | Bien |
| 26 | `comercial.negociacion.titulo` | Negoziazione locazioni | Bien (glosario) |
| 27 | `comercial.negociacion.descripcion` | Ricerca di locatori: gli spazi che si stanno trattando, chi decide su ciascuno e come va la negoziazione del canone. | Bien |
| 28 | `comercial.negociacion.alta.predio` | Un terreno (muro, tetto, lotto) | **Corregir** (§5): un muro o un tetto no son «terreno» → **«Un immobile (muro, tetto, terreno)»** |
| 29 | `comercial.negociacion.ubicacion.*` (compuesta) | Salvata da Ana il 3 nov 2026 · dalla ricerca | Bien, concuerda con «posizione» |
| 30 | `comercial.negociacion.lista.sin-resultados` | Nessuno spazio corrisponde. Togli il filtro per vedere tutti gli spazi ({n}). | Bien, evita el «los {n}» calcado |
| 31 | `codigos.pagina.descripcion` | Codici con scadenza e limite di utilizzi che un commerciale applica a un preventivo. | Bien |
| 32 | `codigos.aviso.compone` (rendido) | E si applica a cascata sugli altri livelli: un 20% per volume, un 20% commerciale e un 20% di codice lasciano al cliente da pagare il 51,2%, non il 40%. | Bien; «sconti a cascata» es exacto |
| 33 | `codigos.usos.sin-tope` | {usos} (senza limite) | Bien, mejor que el literal |
| 34 | `codigos.asignar.ayuda` | …finché un amministratore o un manager non lo approva dalla proposta. | Bien |
| 35 | `propuestas.lista.subtitulo` | Preventivi con il metodo del divisore (lordo / netto) | Bien |
| 36 | `propuestas.lista.kpi.ganado.sub` (rendido) | 1 approvata · perso MX$ 3k su 1 rifiutata | Bien; «3k» lo pone `formatMontoCorto` (compartido, no del lote) |
| 37 | `propuestas.fila.cupo-lleno.titulo` | L’impianto ha già raggiunto il suo limite di clienti in queste date (…). Alla prenotazione verrà rifiutato, a meno che non si liberi un posto o si aumenti il limite. | Bien |
| 38 | Ficha (rendido) | Commissione d’agenzia (15%) · divisore ×0,85 | Bien, coma decimal |
| 39 | Ficha (rendido) | Sconto commerciale (5,00%) | Bien |
| 40 | `propuestas.ficha.kpi.neto` | Netto per la concessionaria | Bien (término del sector) |
| 41 | `propuestas.ficha.descuento.tope-aviso` (rendido) | La tua organizzazione autorizza fino a 30%; per andare oltre, bisogna alzare il limite in Impostazioni. | Bien; mejor «fino al 30%» (con artículo, como en el resto del lote: «dopo il 15%») — opcional |
| 42 | `propuestas.codigo.ayuda` (rendido) | Si applica dopo lo sconto commerciale, a cascata su di esso: un 20% e un 20% lasciano al cliente da pagare il 64%, non il 60%. | Bien |
| 43 | `propuestas.ficha.mapa.parcial` (rendido) | Impianti senza coordinate (non compaiono sulla mappa): 1 su 2 impianti. | Bien, evita el plural forzado |
| 44 | `propuestas.calc.spots-dia` (rendido) | · 3.240 spot/giorno × 30 giorni = | Bien, miles con punto |
| 45 | `propuestas.calc.rb.prima` | + maggiorazione {pct}% = {monto} | Bien |
| 46 | `propuestas.tablero.col.aprobada` | Approvata il | **Corregir**: como encabezado de columna queda colgando → **«Data di approvazione»** (o «Approvata») |
| 47 | Documento (rendido) | PROPOSTA COMMERCIALE · Per · Validità · Valida fino al 1 dic 2026 · IMPIANTI · Impianto e posizione · ACCETTAZIONE DEL CLIENTE · Nome, firma e data | Bien |
| 48 | `catalogos.paquetes.resumen.deja-de-cobrar` / `.por-encima` | si incassano {monto} in meno / si incassano {monto} IN PIÙ rispetto al listino | Bien |
| 49 | `catalogos.rejilla.franjas.explicacion` | La fine è esclusa: 06:00–10:00 e 10:00–14:00 si toccano senza sovrapporsi. | Bien |
| 50 | `catalogos.volumen.aviso.ejemplo` | «Da 50 spot, 10%» vuol dire che chi compra 50 spot li paga tutti e 50 con il 10% in meno. | Bien, natural |
| 51 | `catalogos.programacion.titulo` | Palinsesto | Bien |
| 52 | `catalogos.programacion.sin-permiso` | Solo il responsabile vendite, il direttore commerciale e la direzione possono programmare il palinsesto. | Bien, pero **«gerente» sale «responsabile» aquí y «manager» en el resto**: si son nombres de rol, que la costura los alinee con el lote de roles |
| 53 | `catalogos.motivo.temporada.fecha` | Data non valida in «{nombre}»: si scrive AAAA-MM-GG. | Bien |

Registro «tu» coherente en todo el lote («Scegli», «Togli», «Inserisci»,
«Completalo»), botones en imperativo breve («Salva», «Elimina», «Rimuovi»,
«Aggiungi», «Prenota»), «Impossibile …» uniforme para los errores, apóstrofo
tipográfico y « » en todas partes, «%» pegado. No encontré concordancias rotas
(«1 sito selezionato», «2 siti selezionati», «Ne restano 0», «1 impianto / 2
impianti», «1 campagna / 3 campagne»).

## 4 · Fuera de la lista (criterio 5)

Todo lo tocado fuera de los diccionarios está justificado y es correcto:
`cifra-en-etiqueta.ts` (nuevo), `fmtNum`, `pct` del tablero, `formatNumero` con
idioma, `montoEntero` (el defecto del punto de miles era real) y la entrada
«Lista» en `DISTINTOS_A_PROPOSITO_IT` (Elenco/Listino, bien razonada; el mutante
que la quita muere). Ningún cambio toca un archivo de otro lote salvo
`costura.test.ts`, como pide su comentario.

**H2 · Lo que se quedó sin el mismo arreglo** (en italiano sale la cifra con
punto; en es/en no cambia nada):

| Sitio | Hoy | Arreglo propuesto |
|---|---|---|
| `app/(app)/p/[id]/page.tsx:397` (liga pública, la que el cliente acepta) | `pct: Math.round((p.descuentoVolumenPct ?? 0) * 10) / 10` → «Sconto per volume (2.5%)» | `cifraEnEtiqueta(…, idioma)`, como en `propuesta/[id]/page.tsx:181` |
| `app/(app)/p/[id]/page.tsx:402` | `pct: p.descuentoPct` | `cifraEnEtiqueta(p.descuentoPct, idioma)` |
| `app/(app)/p/[id]/page.tsx:414` | `pct: p.codigoDescuentoPct ?? 0` | `cifraEnEtiqueta(p.codigoDescuentoPct ?? 0, idioma)` |
| `app/(app)/(shell)/propuestas/[id]/page.tsx:158` (toast del tope) | `{ tope: topeDescuento }` | `cifraEnEtiqueta(topeDescuento, idioma)`, como ya se hizo en la línea 670 |
| `components/demo/propuestas/ElegirClienteDialog.tsx:84` | `{ pct: c.ivaPct }` | ídem (solo importa si un IVA lleva decimales) |

`/p/[id]` lo ejercita `pantallas-cuenta-shell.test.ts` (otro lote), y sus datos
llevan enteros, por eso el espejo no lo vio.

**Previo y no del italiano:** `AltaSitioDialog.tsx:221` pasa `simbolo: '$'` fijo,
así que el alta dice «Tariffa pubblicata ($)» —y «Tarifa publicada ($)» en
español— en una instancia MXN donde los importes dicen «MX$». Igual antes y
después; para el lote de moneda.

## 5 · Términos (criterio 2)

Glosario obligatorio: respetado (lo comprueba `italiano-l2.test.ts` clave por
clave y lo confirmé leyendo). «MX$ 1.160,00», «1 dic 2026», spot/loop/DOOH/CPM/
Roadblock en inglés.

| Término propuesto | ¿Lo usaría un italiano del sector OOH? |
|---|---|
| **impianto / schermo** | Sí. «Impianto» es *el* término del inventario OOH en Italia; «schermo» (o «impianto digitale») para la pantalla. Bien separado |
| **terreno** (predio) | **No lo recomiendo.** Un «predio» del dominio es muro, azotea o lote; «terreno» solo es el lote, y la propia frase del lote dice «Un terreno (muro, tetto, lotto)», que se contradice. **Choque con L1 («proprietà») y L3/L4 («immobile»).** Recomiendo **«immobile»**: es el término legal de la locación («locazione dell’immobile»), cubre suelo y edificio, y ya lo usan dos lotes. «Proprietà» no conviene: en este mismo lote «di proprietà» significa *propia* («Impianto di proprietà»), y «Locatore della proprietà» junto a «Impianto di proprietà» se lee ambiguo. Claves de L2 a cambiar: `comercial.comun.direccion-predio` («Indirizzo dell’immobile»), `comercial.ficha.arrendador-del-predio` («Locatore dell’immobile / impianto»), `comercial.ficha.pausar.motivo-ej` («Contenzioso sull’immobile…»), `comercial.ficha.reubicar.ayuda` («…su un altro immobile…»), `comercial.ficha.reubicar.destino` («Immobile di destinazione»), `comercial.ficha.reubicar.elige` («— Scegli l’immobile —»), `comercial.negociacion.alta.predio` («Un immobile (muro, tetto, terreno)»), `comercial.negociacion.kpi.seguimiento.sub` («immobili e impianti»), `propuestas.alta.renta.pactada.predio` (« dell’immobile»). `comercial.negociacion.ficha.superficie` se queda en «terreno»: el español dice «terreno» |
| **canone** | Sí («canone di locazione») |
| **OdA** | Sí (ordine d’acquisto; también se oye «PO») |
| **si applica a cascata** | Sí, «sconti a cascata» es la expresión exacta |
| **concessionaria** | Sí: la que vende el espacio publicitario. Correcto para «el medio» |
| **maggiorazione** | Sí |
| **acquisto** | Sí («modalità di acquisto»); evita el choque con «prenotazione» |
| **manager** | Aceptable y usual en empresa; ver fila 52 (sale también «responsabile») |
| **palinsesto** | Sí, es el término del DOOH |
| **Attivo / Scaduto / In ritardo / In arrivo** | Sí; «In ritardo» para un pago vencido es lo natural |
| **Elenco / Listino** | Sí, distinción correcta y bien declarada |
| **Programmatic** | Sí, en Italia se dice así |
| **Email** | Sí |

## 6 · Mutantes propios (criterio 6)

Distintos de los 16 del traductor. Todos restaurados (`git status` limpio).

| # | Mutante | Resultado |
|---|---|---|
| V1 | `montoEntero` en italiano con céntimos (`formatMonto` en vez de `formatearDineroRedondo`) | MUERE (2, catálogos ITALIANO) |
| V2 | `pct` del tablero en italiano con `String(r)` (punto decimal) | **SOBREVIVE** |
| V3 | `fmtNum` en italiano con `en-US` | MUERE (2, calculadora: «3.240 spot/giorno») |
| V4 | El español de `comercial.pagina.slots-hora` pasa a « slot/h» | MUERE (instantánea española y pantalla) |
| V5 | `ReservaDialog` vuelve a `formatNumero(totalSpotsReservados)` sin idioma | **SOBREVIVE** |
| V6 | `GestionCodigos` vuelve a `pct: c.descuentoPct` | **SOBREVIVE** |
| V7 | Ficha: el descuento comercial vuelve a `pctConDosDecimales` | MUERE (5) |
| V8 | `costura.test.ts` sin la excepción «Lista» | MUERE (costura) |
| V9 | `cifraEnEtiqueta` cambia el español (`toFixed(1)` sin decimales) | MUERE (6, es/en de volumen, ficha y documento) |
| V10 | «Canone» → «Affitto» en `comercial.ficha.renta` | **SOBREVIVE** a la prueba de glosario; muere solo por la instantánea y la costura |
| V11 | «senza OdA» → «senza OC» | **SOBREVIVE** a la prueba de glosario; muere solo por la instantánea |
| V12 | Hueco renombrado en italiano (`{monto}` → `{importo}`) | MUERE (huecos) |
| V13 | Plural `.uno` de paquetes: «{n} impianti» | MUERE (pantalla de paquetes en italiano) |
| V14 | Apóstrofo recto en `codigos.lista.ayuda` | MUERE (estilo) |
| V15 | Tablero: `formatNumero(r.generadas)` sin idioma | **SOBREVIVE** |

(Descartado un mutante equivalente: `cifraEnEtiqueta` es/en con
`toLocaleString('es-MX', …, useGrouping:false)` da lo mismo que `toFixed`.)

**Lectura de los supervivientes.** V2, V5, V6 y V15 no son defectos: el código
está bien leído línea a línea. Sobreviven porque los datos de las pruebas
italianas no tienen un porcentaje con decimales en el tablero (`tasaCierre` 0,5
→ «50%») ni en Códigos, ni un conteo de 1000 o más. **La revisión del traductor
(§4) anuncia «12,5%» en el tablero y nada lo comprueba.** Propuesta: un estado
italiano con `tasaCierre: 0.125`, un código al 12,5 % y un conteo ≥ 1000 en la
reserva o en el tablero.

V10 y V11: la prueba de glosario solo lleva el glosario obligatorio. Los términos
que fija el propio lote (canone, OdA, impianto/schermo, maggiorazione,
palinsesto, concessionaria) solo los guarda la instantánea, que se acepta con
`-u`. Conviene añadirlos a `GLOSARIO` de `italiano-l2.test.ts` (y, una vez
decidido, el de «predio»).

## 7 · Pruebas y compilación (criterio 7)

| Comando (en el worktree del lote) | Resultado |
|---|---|
| `npm run typecheck` | Limpio |
| `npx vitest run --testTimeout=60000` | **384 archivos, 7241 pruebas, todas en verde** |
| `npm run build` (en una copia `git archive` de la rama) | «Compiled successfully», 44/44 páginas, salida 0. Un aviso al copiar los archivos del modo `standalone` (EPERM al crear un enlace hacia el `node_modules` enlazado de la copia): es del enlace de la copia, no del código |

## 8 · Lo que no pude comprobar

- Las e2e (prohibidas en esta tanda) y la aplicación en un navegador.
- `/p/[token]` en italiano con un descuento decimal: lo deduje del código
  (`interpolar` hace `String(n)`), no lo rendí.
- El italiano de las claves que ninguna prueba pinta (toasts, errores, motivos
  del servidor, ~235): leídas en la tabla del diccionario, no en contexto.

# Revisión · Italiano, lote L2 «Comercial y propuestas»

**Fecha:** 2026-11-03 · **Rama:** `feat/italiano-l2-comercial`, sobre
`integra/idiomas` (`6fea374a`) · **Tablero:** `vault/03-Frontend/italiano-olas.md`
· **Encargo:** traductor del lote L2; lo revisa un validador independiente.

## 1 · Qué se tradujo

| Ámbito | Claves | Con italiano | Visibles en el HTML italiano de las pruebas |
|---|---:|---:|---:|
| `comercial` (Comercial, ficha, alta, reserva, Space Eye, Comercial negociación) | 502 | 502 | 431 |
| `codigos` (Códigos de negociación) | 59 | 59 | 51 |
| `propuestas` (lista, alta, ficha, calculadora, tablero, código, condiciones, envío, entrada pública, documento imprimible) | 439 | 439 | 328 |
| `catalogos` (paquetes, franjas y temporadas, horario de transmisión, tarifas por franja, volumen, motivos) | 194 | 194 | 149 |
| **Total** | **1194** | **1194** | **959** |

Los cuatro `IT_*` pasan de `Partial<Record<…>>` a `Record<…>`: desde ahora `tsc`
exige cada clave, como en el inglés. Las claves que no salen en ningún estado
de las pruebas (toasts, errores, motivos del servidor) las vigila la prueba de
diccionario `textos/italiano-l2.test.ts` (instantánea, huecos, estilo, glosario).

**Claves nuevas (3):** literales que no estaban extraídos y que en italiano no
pueden pluralizar el anglicismo: `comercial.pagina.slots-hora` (« slots/h»),
`propuestas.calc.spots-hora` («{n} spots/h») y `propuestas.calc.spots-sufijo`
(« spots»). Español e inglés **iguales al literal de antes**; italiano «slot»,
«spot». Mismo nodo de texto que antes (React separa los nodos adyacentes con
`<!-- -->`: cambiar la forma habría cambiado el HTML español).

## 2 · Glosario aplicado y términos nuevos

El obligatorio del encargo, sin excepción. Lo que el encargo no fijaba y decidí
yo (también en el tablero, «Lote L2»):

| Español | Italiano | Por qué |
|---|---|---|
| pantalla (inventario en general) | **impianto** | En Comercial un espectacular también es una «pantalla»; «schermo» solo para la digital («Schermo digitale», «Slot digitali»…) |
| predio | **terreno** | Lo que se arrienda: muro, azotea, lote |
| renta (al arrendador) | **canone** | «canone di locazione» |
| OC (orden de compra) | **OdA** | «Prenotato · senza OdA» |
| se compone (descuentos encadenados) | **si applica a cascata** | «sconti a cascata»: no se suman, se encadenan |
| el medio (neto para el medio) | **la concessionaria** | Término del sector en Italia |
| prima (del Roadblock) | **maggiorazione** | Sobreprecio porcentual |
| contratación (por sitio) | **acquisto** | «Prenotazione» ya es *reserva* |
| gerente | **manager** | |
| horario de transmisión | **palinsesto** | |
| rejilla | **griglia tariffaria** | |
| tramo / escalón / escala plana | **scaglione / gradino / scala piatta** | |
| a prorrata / reparto / parte del paquete | **in proporzione / ripartizione / quota del pacchetto** | |
| precio cerrado | **prezzo fisso** | |
| liga | **link** | |
| Programático | **Programmatic** | Anglicismo del sector (decisión del dueño: los anglicismos se quedan) |
| correo | **Email** | |
| Lista (vista en lista) | **Elenco** | Frente a «Listino» (precio de lista). Declarado en `costura.test.ts` |
| cupo lleno | **al completo** | |
| vigente (contrato, código) | **Attivo** | Como el inglés «Active» |
| vencido (pago) / (contrato, código) | **In ritardo** / **Scaduto** | Como el inglés «Overdue» / «Expired» (ya declarado distinto) |
| Próximo (código) | **In arrivo** | |
| Plazo (oferta de renta) | **Durata** | |
| Vista (orientación) | **Orientamento** | |

Registro «tu» («Scegli», «Aggiungi», «Togli»), botones en imperativo breve
(«Salva», «Elimina», «Rimuovi», «Prenota»), *sentence case*, comillas « », apóstrofo
tipográfico (’), porcentaje sin espacio («20%»).

## 3 · Español e inglés idénticos — medido

| Medición | Resultado |
|---|---|
| HTML de **todas** las pruebas (`I18N_VOLCAR_TODO`, `lib` y `components`), antes (`6fea374a`, 3027 archivos) y después | `diff -rq` = **0 distintos, 0 desaparecidos**; 229 nuevos, todos de las pruebas italianas nuevas |
| `DICCIONARIOS.es` y `.en` | 5590 valores, **0 cambiados**, 0 quitados; 3 claves nuevas (§1) |
| `traducirError` es/en sobre los 201 del catálogo | 0 cambiados |
| Código tocado | Cada cambio deja la rama `es`/`en` con la **expresión de antes** (`cifraEnEtiqueta`, `fmtNum`, `montoEntero`, el `pct` del tablero), o pasa el idioma a `formatNumero`, que en es y en escribe igual (`es-MX` = `en-US`, medido por la ola 0) |

## 4 · Formatos que se arreglaron en el código (los cazó el espejo o la guardia)

| Sitio | Antes, en italiano | Ahora |
|---|---|---|
| Divisor (lista, alta, ficha) | «× 0.85», «divisore ×0.85» | «× 0,85» (`cifraEnEtiqueta`) |
| Descuento por volumen (ficha y documento) | «(2.5%)» | «(2,5%)» |
| Descuento comercial (ficha) | «(5.00%)» | «(5,00%)» |
| Porcentajes de códigos, tope, tramos de volumen | `String(n)` | coma decimal |
| Calculadora de spots (`fmtNum`) | «3,240 spot/giorno» (`es-MX` fijo) | «3.240» |
| Tablero de propuestas (`pct`) | «50 %», «12.5 %» | «50%», «12,5%» |
| Paquetes (`montoEntero`) | **«MX$ 1000,00»**: el `.replace('.00','')` se comía el punto de los MILES | «MX$ 100.000» |
| Conteos (`formatNumero` sin idioma) en Comercial, ficha, reserva, tablero, volumen | «1,234» | «1.234» |
| Documento imprimible en el espejo | 191 huellas (fechas y cifras inglesas) | 0: la prueba construye también el árbol italiano y el espejo lo pinta (`SegunIdioma`) |

**Espejo (`I18N_VOLCAR_IT`) sobre las tres pruebas del lote:** de **215** huellas a
**24**. Las 24 son el mismo caso, a propósito (§6, P-L2-1): los ejemplos «Es. 12.9» y
«Es. 7.2» del alta de pantalla.

## 5 · Pruebas

- **Rojo antes de traducir** (con las `IT_*` vacías): `pantallas-comercial` 28
  rojas, `pantallas-propuestas` 36, `pantallas-catalogos` 20.
- **Nuevas:** en cada `pantallas-*` del lote, un bloque «en ITALIANO» por pantalla
  (sin frases españolas ni inglesas de las listas, frases italianas esperadas,
  sin huellas de formato) y un barrido con el diccionario (ningún trozo español
  NI inglés de los ámbitos del lote en el HTML italiano, y al menos N trozos
  italianos vistos); el dinero también en `it`. `textos/italiano-l2.test.ts`:
  instantánea del italiano, completo, huecos y bordes, estilo tipográfico, sin
  ortografía española, sin moneda, no igual al inglés salvo lo declarado, y el
  **glosario obedecido** clave por clave.
- **Cifras:** `npx vitest run lib components` → **378 archivos, 7094 pruebas en
  verde**; `tsc --noEmit` limpio. Cobertura italiana: `comercial` 502/502,
  `codigos` 59/59, `propuestas` 439/439, `catalogos` 194/194 (0 pendientes).
- **Mutantes: 16, mueren los 16.**

| # | Mutante | Resultado |
|---|---|---|
| M1 | un italiano que cae al inglés («siti» → «sites») | MUERE |
| M2 | una clave italiana borrada | MUERE (y `tsc`) |
| M3 | `cifraEnEtiqueta` con `toFixed` en todos los idiomas | MUERE (16 rojas) |
| M4 | `montoEntero` vuelve al `.replace('.00','')` en italiano | MUERE |
| M5 | el porcentaje del tablero con espacio en italiano | MUERE |
| M6 | `fmtNum` sin idioma en los spots/día | MUERE |
| M7 | glosario: «Nuova offerta» por «Nuova proposta» | MUERE |
| M8 | apóstrofo recto | MUERE |
| M9 | plural: «1 selezionate» | MUERE |
| M10 | el literal « slots/h» vuelve a la fila del mapa | MUERE |
| M11 | el documento sin `cifraEnEtiqueta` en el volumen | MUERE |
| M12 | la prueba del documento sin encender el italiano | MUERE |
| M13 | divergencia entre ámbitos («Cancella» en catálogos) | MUERE (costura) |
| M14 | un hueco perdido | MUERE |
| M15 | género: «1 sito selezionata» | MUERE |
| M16 | la ficha sin `cifraEnEtiqueta` en el divisor | MUERE |

## 6 · Pendiente y para el dueño

- **P-L2-1 · La captura de cifras no es italiana.** `CampoCifra`
  (`lib/captura-cifra.ts`, compartidos) lee la coma como separador de MILES y el
  punto como decimal, en todos los idiomas; los campos de dimensiones y
  coordenadas del alta usan `Number()`. Un italiano que teclee «1.500,50» (su
  formato) en una tarifa obtiene otra cifra, y «12,9» en el ancho se guarda como
  0. Por eso los ejemplos y avisos del lote describen el formato que el campo
  ENTIENDE («Es. 12.9», «(15,000.50)», «180,000») y no el italiano. **Hay que
  decidir** si la captura sigue el idioma (cambio en compartidos/L5, con su
  propia prueba) antes de encender el italiano. Es el riesgo más serio del lote.
- **P-L2-2 · El documento imprimible y la liga `/p/[token]`** son papel que sale
  hacia el cliente. Se tradujeron, pero su regla de idioma **no se tocó**: sigue
  siendo el de la petición (cookie). Si deben ir en el idioma de la instancia,
  como el contrato (P4), lo decide el dueño.
- **Coordenadas** en la ficha («19.4000, -99.1000») y en la ayuda del buscador:
  se quedan con punto (son un dato que se copia y pega en mapas).
- **Lo que sigue en inglés en las pantallas del lote es de OTROS ámbitos**
  (declarado en `AJENAS_IT` de cada prueba): unidades, periodicidades, selector de
  periodo, origen del id de DOOHmain, `avisoFranja`, el chip «Pending approval»,
  `CampoCifra` y « (obligatorio)» de `Campo` (`compartidos`, L5); títulos del menú,
  «Cancel», «Save», «Loading…» (base, L5); `SlotsBadge`, `ClientesBadge`,
  `CalendarioDisponibilidad` (otros lotes); «El espacio está perdido…»
  (`servidor`, L5).
- **Para el catálogo de errores italiano (L5):** `catalogos.motivo.*` los manda
  también el servidor; su italiano tiene que ser el de aquí (la costura lo
  comprueba en cuanto los dos existan).

## 7 · Fuera de mi lista

- `lib/i18n/cifra-en-etiqueta.ts` (nuevo, del lote): la cifra suelta de una
  etiqueta; en es/en, la expresión de antes.
- `lib/i18n/textos/costura.test.ts`: una entrada en `DISTINTOS_A_PROPOSITO_IT`
  («Lista»), como pide su comentario.
- Componentes de mis pantallas: `comercial/page.tsx`, `propuestas/page.tsx`,
  `propuestas/[id]/page.tsx`, `propuesta/[id]/page.tsx`, `SiteFicha`,
  `ReservaDialog`, `BloqueCodigoPropuesta`, `GestionCodigos`, `TableroPropuestas`,
  `GestionPaquetes`, `GestionVolumen` (solo formatos de cifras y los 3 literales).

# Validación · La costura del portugués (pt-BR)

**Fecha:** 2026-11-05 · **Rama:** `feat/portugues-costura` (`94f75c78`), diff
`2e2a62e1..HEAD` · **Revisión del traductor:**
`docs/i18n/revision-portugues-costura.md` · Validador independiente: solo lee y
mide; no corrige. Todo lo de abajo está medido en este árbol.

## Veredicto: VERDE

Las cuatro fusiones no perdieron nada, el retiro de `papeles-portugues.ts` no
dejó caer al español ninguna clave, es/en/it son **byte a byte** los de
`2e2a62e1` (diccionarios, `traducirError` y volcado HTML de toda la suite), las
decisiones del dueño están donde se pidieron y las pruebas siguen mordiendo sin
las listas de español pendiente (6/6 mutantes propios muertos). Typecheck
limpio, suite en verde, cobertura 0 pendientes.

Quedan tres incoherencias de vocabulario **bajas**, ninguna de las cuales cambia
el sentido de una pantalla (H1–H3), y una nota de prueba (H4). Ninguna bloquea
llevar la rama a `integra/portugues`; las tres primeras caben en el recorrido en
el navegador o en una pasada de una línea por clave.

## 1 · Mediciones

| Medición | Resultado |
|---|---|
| `git grep -l "^<<<<<<< HEAD$"` | vacío |
| Archivos de cada lote (`merge-base 72b33050..<punta>`) en la punta validada vs `6b0e2883` (tras las 4 fusiones, antes de la costura) | **idénticos** en L1 `2e80948a`, L2 `9744a483`, L3 `0646bdd3`, L4 `0a06fe95`, salvo `catalogos-portugues.test.ts`, que tocaban L1 y L3: el resultado es la **unión** de los dos (leído el diff). Ningún archivo de un lote lo tocaba también `2e2a62e1` (L5/P3), así que nada de la base pudo pisarse |
| `PT_<AMBITO>` (los 21 ámbitos, importados en `6b0e2883` y en `HEAD`) | **35 claves distintas**, todas declaradas en la revisión §2, §4, §6 y §7 (lista en §2 abajo). `DICCIONARIOS.pt`: 36 (las 35 + `nav.captacion`). Ninguna clave nueva ni desaparecida |
| `DICCIONARIOS.es/.en/.it` en `2e2a62e1` vs `HEAD` (JSON) | **`cmp` idénticos** |
| `traducirError` es/en/it sobre 283 mensajes (todo `CATALOGO_ERRORES`, `CATALOGO_LIB`, los del italiano y del portugués y `Campo: …` con cada campo) y `PATRONES_ERROR` | **0 diferencias**; en pt, 3 cambios: «em um Roadblock», «CEP inválido (5 dígitos)», «o dono do terreno» (declarados) |
| Volcado `I18N_VOLCAR_TODO` de toda la suite sin `cifras-formularios`, base (worktree `portugues-l5-armazon`, `2e2a62e1`) y rama | base **4824** HTML, rama **5712**. **15 distintos, 888 nuevos, 0 desaparecidos; los 903 están en `_portugues.txt`**; ningún HTML de es/en/it distinto. `_italiano.txt` ordenado, idéntico |
| Papeles en `pt` del volcado (42 HTML: portal, `/p`, documento de propuesta, comprobante, constancia) buscando trozos españoles (≥ 10 caracteres de toda clave con es ≠ pt) | **0 fugas** salvo el contrato y la constancia de la prueba de inventario, que están en español **por diseño** (papel en el idioma de la instancia, ADR 0049; ya contados como huellas del espejo). El comprobante dice «Comprovante Nº F-000»; «Folio fiscal (UUID do CFDI)» es el término mexicano a propósito |
| El folio | correo `propuestas.correo.folio` «Nº {folio}» (la prueba pinta «Nº P-1»), `finanzas.comprobante.titulo` «Comprovante Nº {folio}»; dentro de la app `propuestas.ficha.folio` «Ref. interna:» y `propuestas.tablero.col.folio` «Ref. interna». Como decidió el dueño |
| Hashes de contratos firmados es/en/it/pt (`contrato-documento-idioma.test.ts`, `contrato-documento-portugues.test.ts`, `contrato-documento.test.ts`) | ningún archivo de contrato en el diff; las tres pruebas en verde |
| `cd apps/web && npm run typecheck` | limpio |
| `npx vitest run --testTimeout=60000` | **426 archivos, 9905 en verde + 1 omitida, 0 rojas** |
| Cobertura del portugués | `cobertura-portugues.test.ts` en verde: 0 pendientes en todas las filas |
| Árbol al terminar | limpio (`HEAD` = `94f75c78` antes de este commit) |

Para importar los diccionarios de tres commits a la vez se copió `lib/i18n` (sin
pruebas, es autocontenido) de cada uno a una carpeta temporal dentro del árbol,
se volcó a JSON y se borró antes de correr la suite. Volcados en el scratchpad
del validador (`val-pt-costura/`).

## 2 · Las 35 diferencias de la costura, una a una

Todas tienen su porqué en la revisión: decisiones del dueño (Captação,
Pré-reserva ×3, Nº ×2 y «Ref. interna» intacta, CEP ×2, «o dono do terreno»),
guardias comunes («não gera mais» ×2, «no período», «Se você deixar em
branco…», los cuatro «ex.:» del L4) y las 24 unificaciones de §7. Ninguna clave
del lote cambió sin aparecer ahí.

**Las 24 unificaciones, en su pantalla.** Leídas con el español y el uso:
ninguna cambia el sentido. Las que merecen mirarse en el navegador por ancho:
«Grade de programação» (título del panel de horario de la campaña),
«Pré-reservar» (botón), «Licenças e alvarás» (filtro del Dashboard),
«Desinstalação» (tipo de OS: «Retirada» era también correcta, pero
«Instalação/Desinstalação» empareja con «Montaje/Desmontaje»). «Mostrar» frente
a «Exibir o menu de campanhas» en el mismo componente es aceptable (español
distinto).

**Las 20 de `DISTINTOS_A_PROPOSITO_PT`.** Revisadas clave por clave
(`costura.test.ts:414-440`):

- Correctas y bien justificadas: `Pantalla` (Ponto/Tela: las cuatro «Tela» son
  DOOHmain, almacén y Space Eyes), `Guardar pantalla`, `Sitio` (Local solo en
  Space Eyes), `Lista`, las concordancias `Fija`, `Todas`, `Automática`, `Sin
  asignar`, `— Sin asignar —`, `{n} nueva(s)`, y `Vencida/Vencidas`: las dos
  «Atrasada» son de OS (`campanas.listas.vencida` es el distintivo de una OT en
  la ficha de campaña, `ListasCampana.tsx:94`), las «Vencida» de cobranza.
  `Siguiente`, `Fin`, `Operación`, `No` (Raspberry Pi Imager) y `Teléfono`
  (Celular en el alta de Space Eyes) también.
- `a` y `{desde} a {hasta}`: correctas en lo que pintan, pero el porqué escrito
  no describe todas las claves (H3).

## 3 · Hallazgos

| # | Dónde | Qué | Gravedad | Escenario |
|---|---|---|---|---|
| H1 | `textos/comercial.ts:1887`, `:1900`, `:1975`, `:2025` | «Tarifa publicada» sigue en cuatro textos de Comercial (`comercial.ficha.tarifa-publicada`, `.tarifas-unidad.vacio`, `comercial.editar.tarifa`, `comercial.alta.tarifa`), mientras la costura unificó «Tarifa de tabela» (glosario aprobado, §2 bis: «precio/tarifa de lista → preço/tarifa de tabela») en inventario, reportes y Dashboard. La prueba de costura no lo ve porque el español no es idéntico («Tarifa publicada ({unidad})») | baja | el vendedor ve «Tarifa publicada» en la ficha del ponto en Comercial y «Tarifa de tabela» en la columna del reporte y en el Dashboard: dos nombres para el mismo precio |
| H2 | `textos/campanas.ts:1730`, `:1740`; `textos/servidor.ts:224` | El título del panel es «Grade de programação» (`campanas.ts:1734`, unificado), pero el error de lectura y el de permiso del MISMO panel dicen «horário de exibição», y el aviso de franja del servidor «horário de veiculação». El §2 bis afirma que la costura «unificó "Horário de exibição" de Campañas»: solo el título | baja | en la ficha de campaña, bajo «Grade de programação», un gerente sin permiso lee «…podem mudar o horário de exibição» |
| H3 | `textos/campanas.ts:1798` (`campanas.doohmain.horario.a` «a») y `:1439` (`campanas.comun.rango-horas` «{inicio} a {fin}»); frente a `textos/compartidos.ts:566` («{desde} às {hasta}») y `textos/spaceeyes.ts:3861` («às»); porqué en `costura.test.ts:431` | Entre dos HORAS de DOOHmain el portugués dice a veces «a» y a veces «às»; el porqué declarado dice que en DOOHmain va «às». Las dos formas son portugués válido («De 06:00 a 22:00»), así que no hay error de sentido: es el texto de la excepción el que no cuadra con dos claves | muy baja | la ficha de campaña: «Horário da campanha: 06:00 a 22:00» y en la vista previa de DOOHmain «06:00 às 22:00» |
| H4 | `textos/portugues-comun.test.ts:161` | «las excepciones declaradas existen y de verdad se saltan su regla» solo comprueba que la clave existe, no que su valor dispararía la regla; una excepción que deje de hacer falta no se delata (la de costura sí lo hace) | muy baja (prueba) | se corrige «Usa o valor padrão» y la excepción se queda, apartando en silencio esa clave de la guardia de tuteo |

### «CEP inválido (5 dígitos)» — opinión pedida

**Aceptable, y mejor que lo que había.** El rótulo ya decía «CEP fiscal», y
rótulo y error deben llamar igual a la misma cosa; «(5 dígitos)» basta para que
un brasileño entienda que no es su CEP de 8. Es la misma decisión que mantener
RFC y CFDI: el dato es mexicano y se nombra con la palabra que el usuario
reconoce. La alternativa honesta sería «Código postal» en los dos sitios (se
entiende en Brasil y no evoca el formato brasileño); no la recomiendo por encima
de la actual. Lo que **no** es de traducción: si una instancia brasileña llegara
a capturar direcciones brasileñas, la VALIDACIÓN de 5 dígitos sería la
equivocada. Eso es de la tarea de moneda/datos por instancia, no de esta rama.

## 4 · Mutantes propios (contra unitarias; restaurados con `git checkout`, árbol limpio)

| # | Mutante | Resultado |
|---|---|---|
| V1 | `comercial.sitio-estatus.disponible` en pt vuelve a «Disponible» (una de las seis etiquetas cortas que inventario apartaba con `AJENOS_CORTOS_PT`) | **muere (6)**: 4 pantallas de inventario/arrendadores, costura, L2. Prueba directa de que vaciar las listas devolvió la fuerza |
| V2 | `campanas.horario.no-leer` en pt = la frase española entera | **muere (3)**: guardia común de palabras españolas, L4 ×2 |
| V3 | el comprobante pierde el «Nº» («Comprovante {folio}») | **muere (1)**: la regla del folio de `papeles-portugues.test.ts` |
| V4 | `operaciones2.tipo-ot.desmontaje` vuelve a divergir («Retirada») | **muere (2)**: costura pt y pantalla de operaciones |
| V5 | tuteo con enclítico en arrendadores («…; verifica-o») | **muere (2)**: guardia común de tuteo y costura |
| V6 | dentro de la app, `propuestas.tablero.col.folio` pasa a «Nº» | **muere (2)**: regla del folio y glosario del L2 |

**6/6 muertos.** Sin e2e: la costura solo toca textos y pruebas.

## 5 · Para después

- H1–H3 en una pasada de una línea por clave (o en el recorrido en el
  navegador), sin tocar es/en/it.
- Lo demás que la revisión §9 deja abierto sigue igual: la tarea roja de
  cifras (P2) y el recorrido con `IDIOMA_PORTUGUES` todavía apagado.

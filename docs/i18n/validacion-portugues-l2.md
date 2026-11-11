# Validación · Lote L2 del portugués (comercial, códigos, propuestas y catálogos)

**Fecha:** 2026-11-05 · **Rama:** `feat/portugues-l2-comercial` (`2fafdc84`), sobre
`integra/portugues` (`72b33050`) · **Revisión del traductor:**
`docs/i18n/revision-portugues-l2.md` · Validador independiente: solo lee y mide;
no corrige. Todo lo de abajo está medido en este árbol.

## Veredicto: VERDE (con una nota de costura y retoques menores)

El portugués del lote **se entiende y se dice así** en una agencia o un veículo
brasileño de mídia OOH: leídas las **1201 claves** (y, en contexto, el HTML
portugués de las tres pruebas de pantallas: documento imprimible, liga pública,
códigos, tablero, reserva, ficha), **ninguna dice otra cosa que el español**.
Cada aviso de precio, descuento, código, paquete y validade da la misma regla:
el 64% en cascada, el 51,2% de las tres capas, «TODAS as unidades», el paquete
que **substitui** (no descuenta) la tabela, el código que consume un uso al
aplicarse y lo devuelve al quitarse, la validade inclusiva, la caída de la
propuesta rechazada a rascunho. Glosario común (§2 bis) y del lote obedecidos
sin excepción, fechas sin «em/no/do», «você» en todo, comillas “ ”, plurales que
concuerdan. Las cifras salen a la brasileña donde el código las formatea.

`es`/`en`/`it` **byte a byte idénticos**, typecheck limpio, suite entera en verde.

Lo único de peso es de **proceso, no del lote**: al integrar en
`integra/portugues` (que ya lleva P3) **se ponen rojas 3 pruebas** de P3 —la
revisión anticipa una— y hay que resolverlas en la propia costura (§3, H1). Más
cinco retoques de una línea que no bloquean.

## 1 · Mediciones

| Medición | Resultado |
|---|---|
| `cd apps/web && npm run typecheck` | limpio (`tsc --noEmit`, salida 0) |
| `npx vitest run --testTimeout=60000` (sin `cifras-formularios.test.ts`; `middleware.test.ts` incluido) | **419 archivos, 8903 en verde + 1 omitida, 0 rojas** |
| `DICCIONARIOS.es/.en/.it` + `traducirError(es/en/it)` sobre todo `CATALOGO_ERRORES`, `CATALOGO_LIB`, cada campo de `CAMPO_EN` × 3 motivos y tres motivos de catálogos (paquete, franja, tramo); más `PATRONES_ERROR` serializados | volcado JSON con prueba temporal (fuera del commit, retirada) en `HEAD` y con los cuatro `textos/` de `72b33050`: **1 239 113 bytes, `cmp` idénticos**. Ninguna clave pt dentro (comprobado: `propuestas.documento.aceptada` sale «Aceptada el / Accepted on / Accettata in data») |
| Diff de fuentes `72b33050..HEAD` en `textos/` | las únicas líneas retiradas son las cuatro declaraciones `PT_* = {}` y sus comentarios de la ola 0. **Ninguna línea ES, EN ni IT**. Ningún archivo de la aplicación cambia |
| Espejo `I18N_VOLCAR_PT` sobre `pantallas-comercial`, `-propuestas`, `-catalogos` | **15 estados, 103 huellas**, exactamente lo que dice la revisión §7 (detalle en §4) |
| Cobertura y forma | 1201/1201; los cuatro `PT_*` son `Record`; llaves `{x}` iguales al español (las pruebas del lote lo exigen y pasan) |
| Árbol al terminar | limpio en la rama; `HEAD` = el commit de este informe |

## 2 · Sentido en portugués

Leídas **todas** las claves del lote, lado a lado con el español (propuestas 446,
comercial 502, catalogos 194, codigos 59), y en contexto el HTML portugués
volcado de 63 estados. Lo que el CLIENTE ve —documento imprimible, liga `/p`,
correo, entrada por código— se lee como un papel comercial brasileño: «PROPOSTA
COMERCIAL», «Validade · Válida até 1 de dez. de 2026», «Bruto (preço de tabela)»,
«Pacote “Combo” — preço do conjunto», «Comissão de agência (15%)», «Líquido»,
«Total que o cliente paga», «ACEITE DO CLIENTE · Nome, assinatura e data».

Bien resueltos y que conviene conservar: «Toque em um marcador» (evita el «ponto»
del mapa contra el ponto de inventario), «Data de aprovação» como cabecera, «O
único ponto desta proposta…» en vez del calco «Nenhum dos 1», «Agora tem {n}
cliente/clientes» concordando donde el español no concuerda, «limite de usos»,
«Em breve / Esgotado», «Reservar (provisória)», «Líquido para o veículo», «aplica
em cascata».

### 2.1 · Retoques (ninguno cambia la regla; no bloquean)

| # | Dónde | Texto actual | Problema | Propuesta | Gravedad |
|---|---|---|---|---|---|
| H2 | `textos/propuestas.ts:1697` `propuestas.fila.cupo-lleno.titulo` | «…Na reserva, será recusado, a menos que…» | Sujeto ambiguo: se lee «el ponto será recusado». El español dice que se rechaza la reserva | «…A reserva será recusada, a menos que uma vaga se libere ou o limite aumente.» | baja |
| H3 | `textos/propuestas.ts:1991` `propuestas.condiciones.vencio` | «Venceu ({fecha}): o link…» | Correcto pero torpe, y distinto del «Vencida desde {fecha}» de la ficha (`propuestas.ficha.vencida`) para el mismo hecho | «Vencida desde {fecha}: o link não permite mais aceitá-la…» | baja |
| H4 | `textos/propuestas.ts:1667` `propuestas.lista.kpi.tasa.sub` | «aprovadas sobre {n} fechadas, desde sempre» | «sobre» como razón es calco; el tablero ya dice «aprovadas entre as decididas» | «aprovadas entre {n} fechadas, desde sempre» | baja |
| H5 | `textos/propuestas.ts:1977` y `textos/codigos.ts:338` | «…a reativa como rascunho» | Se entiende, pero «reativar como» no es como se dice | «…a faz voltar para rascunho» (como `propuestas.codigo.aplicado.reactivada`: «volta para rascunho») | baja |

### 2.2 · Observación para el dueño (no es defecto)

- **`propuestas.correo.folio` (`textos/propuestas.ts:1596`): «Ref. interna {folio}»
  en un correo AL CLIENTE.** Obedece la decisión (Folio = «Ref. interna») y por
  eso debe ganar a la de P3; pero a un cliente brasileño «referência interna» le
  dice «número que no es para usted», cuando es justo el que citará al
  contestar. Si el dueño quiere una excepción para los papeles, «Ref. {folio}» o
  «Nº {folio}». No lo decido.
- En la ficha de un ponto, el calendario de disponibilidad sale «L M M J V S D…
  confirmada en propuesta» en español: son claves `operaciones.calendario.*`
  (L3), caída al español esperada (D3). No es del lote.

## 3 · Costura con P3 (`papeles-portugues.ts`, ya en `integra/portugues`)

De las 59 claves de papel de este lote, **50 iguales y 9 distintas** (las 11 de la
revisión §4 menos «Aceita: / Vencida:», que P3 ya cambió al integrar). Opinión
por el glosario común —que según §2 bis gana a cualquier glosario de lote, y el
de P3 dice «pantalla → tela», contra §2 bis—: **en las 9 gana el L2.**

| Clave | P3 | L2 | Gana | Por qué |
|---|---|---|---|---|
| `propuestas.documento.pantallas` | TELAS | PONTOS | L2 | §2 bis: pantalla de inventario = *ponto*; un papel lista painéis y murais, no solo telas |
| `propuestas.documento.col.pantalla` | Tela e localização | Ponto e localização | L2 | ídem |
| `propuestas.documento.sin-coords` | {n} tela(s)… | {n} ponto(s)… | L2 | ídem |
| `propuestas.ficha.mapa` | Localização das telas | Localização dos pontos | L2 | ídem |
| `propuestas.correo.cuerpo` | …revisar as telas… | …revisar os pontos… | L2 | ídem |
| `propuestas.comun.bruto-lista` | Bruto (tabela de preços) | Bruto (preço de tabela) | L2 | «preço de tabela» es el precio de lista en la mídia brasileña; «tabela de preços» es la rejilla en §2 bis |
| `comercial.tipo-medio.espectacular` | Outdoor | Painel | L2 | §2 bis; el *outdoor* es el 9×3 a pie de calle |
| `comercial.tipo-medio.valla` | Painel | Outdoor | L2 | la valla mexicana es justo ese *outdoor* |
| `propuestas.correo.folio` | Nº {folio} | Ref. interna {folio} | L2 | decisión del dueño (ver §2.2) |

**H1 · Lo que la integración tiene que hacer (media, de proceso).** Medido con un
merge de prueba de esta rama sobre `integra/portugues` (`2e2a62e1`), en un árbol
temporal ya retirado: conflicto trivial en `vault/07-Agentes/diario/2026-11-05.md`
y **3 pruebas rojas**, no 1 como da a entender la revisión §4:

1. `papeles-portugues.test.ts` · «si un lote escribe una clave de papel, tiene que
   decir LO MISMO»: los 9 choques de arriba.
2. `papeles-portugues.test.ts` · «el correo de la propuesta, en portugues»: espera
   `Nº P-1` y sale `Ref. interna P-1`.
3. `cobertura-portugues.test.ts` · «P3 (05/11): fuera del L5, lo traducido es
   exactamente lo de los PAPELES»: con el L2 dentro, sus cuatro filas ya no
   valen solo lo de P3 (hay que añadirlas a las filas completas, como `FILAS_L5`).

Las tres se arreglan en la costura: quitar de `PT_PAPELES` las 9 claves (o
igualarlas al L2), cambiar `Nº P-1` por `Ref. interna P-1` (o lo que decida el
dueño) y extender la prueba de cobertura. Ninguna toca el código de la rama.

## 4 · Espejo y ejemplos de captura (P2)

Las **103 huellas** en **15 estados** están bien explicadas:

- **12 estados × 2 = 24** en `pantallas-comercial` (alta de pantalla y alta
  digital, en sus variantes): «Ex.: 12.9» y «Ex.: 7.2», los ejemplos de ancho y
  alto. Son la verdad de hoy (captura mexicana) y van con P2; igual que
  `comercial.tarifas.no-se-entiende` y `catalogos.tarifas.invalida` («a vírgula
  separa os milhares e o ponto, os decimais»), que la tarea roja
  `feat/portugues-cifras` tiene que reescribir junto con los `compartidos.cifra.*`
  del L5. Las coordenadas de ejemplo con punto no dan huella y están bien así
  (se pegan de un mapa).
- **3 estados = 79** en `pantallas-propuestas` (30 + 30 + 19): las pruebas del ADR
  0049 y B72 con la instancia fijada en español o inglés; el papel va en el
  idioma de la instancia y el espejo no debe cambiarlo.

## 5 · Mutantes propios (contra las unitarias)

`npx vitest run` sobre `portugues-l2`, `portugues-l5`, `cobertura-portugues` y las
tres `pantallas-*` del lote (806 pruebas), de uno en uno, restaurando el archivo
(script en el scratchpad, fuera del repo). Las e2e no se mutaron.

| # | Mutante | Resultado |
|---|---|---|
| V1 | `propuestas.documento.aceptada` → «Aceita em {fecha}» | **muere** (regla de fechas de todo el portugués) |
| V2 | `propuestas.codigo.ayuda`: «pagando 64%, não 60%» → «60%, não 64%» (la regla al revés) | **sobrevive** |
| V3 | `propuestas.documento.pantallas` → «TELAS» (la de P3) | **muere** (frase esperada del documento) |
| V4 | `comercial.tipo-medio.valla` → «Painel» (la de P3) | **sobrevive** |
| V5 | `propuestas.correo.folio` → «Nº {folio}» (la de P3) | **muere** (glosario) |
| V6 | `catalogos.volumen.aviso.todas`: «não só sobre…» → «só sobre…» (la regla al revés) | **sobrevive** |
| V7 | tuteo: «Escolhe um pacote» | **muere** (guardia de tuteo) |

4 de 7 mueren. **H6 (baja, prueba):** V4 es la única clave de las que discuten L2 y
P3 que nada vigila: conviene añadir `['valla → outdoor', /\bvalla\b/i, /outdoor/i]`
al `GLOSARIO` de `portugues-l2.test.ts`. V2 y V6 son inversiones de sentido que
ninguna prueba mecánica caza del todo; V2 sí la cazaría una guardia barata —que
la secuencia de cifras de cada texto portugués sea la del español— y vale para
todos los avisos de precio. Lo demás lo cubre esta lectura.

## 6 · Las 7 dudas para el dueño, desde el uso brasileño (opinión, no decisión)

1. **Comissão.** Sí: es *a* palabra de la agencia y del vendedor en Brasil
   («comissão de agência», «comissão do vendedor»). No confundir con la *BV*
   (bonificação de volume), que es otra cosa y la app no la maneja.
2. **Espectacular = Painel, valla = Outdoor.** De acuerdo con el L2. En el
   mercado, *outdoor* es el cartel de 9×3 de papel a nivel de calle (la valla);
   el espectacular sobre estructura alta es *painel* (rodoviário, front/backlight).
   El público general llama «outdoor» a todo, pero el lector de esta app es del
   ramo. P3 tiene que cambiar.
3. **Preço de tabela / tabela de preços.** «Preço de tabela» y «desconto sobre
   tabela» son el habla de la mídia brasileña: correcto. La rejilla como
   «tabela de preços» se parece, pero se distingue por el contexto (faixa e
   temporada); «grade de preços» chocaría con «grade de programação». Lo dejaría.
4. **«Líquido para o veículo».** Correcto y natural: el veículo recibe el líquido
   tras la comissão da agência.
5. **Patamar / escala não progressiva.** «Faixa de desconto» sería lo más común,
   pero choca con la faixa horária: «patamar» es buena salida. «Escala não
   progressiva» la entiende quien conoce el IR progressivo (justo lo contrario:
   aquí el patamar alcanzado vale para todas las unidades); la tarjeta lo
   explica debajo. Aceptable.
6. **Grade de programação.** Es el término de TV, rádio y DOOH. De acuerdo.
7. **«Buen Fin».** Se queda: la instancia es mexicana y es un ejemplo. Un usuario
   brasileño no lo reconocerá, pero no confunde.

## 7 · Resumen de hallazgos

| # | Gravedad | Qué |
|---|---|---|
| H1 | media (proceso) | Al integrar en `integra/portugues`: 3 pruebas rojas de P3 y conflicto en el diario; en las 9 claves gana el L2 (§3) |
| H2 | baja | `propuestas.fila.cupo-lleno.titulo`: sujeto ambiguo |
| H3 | baja | `propuestas.condiciones.vencio`: «Vencida desde {fecha}» como en la ficha |
| H4 | baja | `propuestas.lista.kpi.tasa.sub`: «sobre» → «entre» |
| H5 | baja | «a reativa como rascunho» → «a faz voltar para rascunho» (2 claves) |
| H6 | baja (prueba) | `valla → outdoor` sin guardia; guardia de secuencia de cifras sugerida |

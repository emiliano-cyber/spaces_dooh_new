# Revisión · Lote L2 del portugués (comercial, códigos, propuestas y catálogos)

**Fecha:** 2026-11-05 · **Rama:** `feat/portugues-l2-comercial`, sobre
`integra/portugues` (`72b33050`) · **Tablero:** `vault/03-Frontend/portugues-olas.md`
· **Encargo:** traductor del lote L2 del portugués (pt-BR); lo revisa un
validador independiente. Equivalente del L2 italiano
(`docs/i18n/revision-italiano-l2-comercial.md` y su validación), con sus
lecciones y las del L5 portugués aplicadas.

## 1 · Qué se tradujo

| Ámbito | Archivo | Claves | Antes | Después |
|---|---|---:|---:|---:|
| comercial | `textos/comercial.ts` (Comercial, ficha, alta, reserva, Space Eye, Negociação de locações) | 502 | 0 | 502 |
| codigos | `textos/codigos.ts` (Códigos de negociação) | 59 | 0 | 59 |
| propuestas | `textos/propuestas.ts` (lista, alta, calculadora, ficha, código, condiciones, envío, tablero, entrada pública, documento imprimible, correo) | 446 | 0 | 446 |
| catalogos | `textos/catalogos.ts` (pacotes, faixas e temporadas, grade de programação, tarifas por faixa, volume, motivos) | 194 | 0 | 194 |
| **Total** | | **1201** | **0** | **1201** |

Los cuatro `PT_<ÁMBITO>` pasan de `Partial<Record<…>>` a `Record<…>`: una clave
nueva sin portugués ya no compila. `coberturaPortugues()`: las cuatro filas con
**0 pendientes**; total del portugués 2547 con portugués, **3396 pendientes**
(de L1, L3 y L4).

**Ningún archivo de código de la aplicación cambió.** El código del lote ya
pasaba el idioma a todo (`cifraEnEtiqueta`, `fmtNum`, el `pct` del tablero,
`formatNumero` con idioma, `montoEntero`: los arreglos del italiano L2) y
ninguna rama `=== 'it'` del lote necesitaba su gemela `pt` (las ramas del
encargo —CSV, `alt="preview"`, panel de firmas— son de otros lotes). Lo medido
en §5 lo confirma: las cifras salen «12,5%», «1.200 de 5.000», «2.400»,
«× 0,85», «(2,5%)».

## 2 · El glosario

El común (§2 bis de `portugues-olas.md`) sin excepción. Lo que el lote fija
(también en el tablero, subsección «Lote L2»):

| Español | pt-BR | Por qué |
|---|---|---|
| comisión (de la agencia, del vendedor) | **comissão** | lo propuesto por el encargo; el §2 bis ya dice «Comissões · comissão da agência». El italiano eligió *provvigione*. Lo exige la prueba |
| neto · «neto para el medio» | **líquido** · **«líquido para o veículo»** | en la mídia brasileña, la empresa que vende el espacio es **o veículo** |
| precio / tarifa de lista | **preço de tabela** («Bruto (preço de tabela)», «Tabela {monto}») | el *preço de tabela* es el de lista en Brasil; ver duda 3 |
| espectacular · valla | **Painel** · **Outdoor** | el §2 bis propone *painel* para el espectacular; el *outdoor* brasileño es el cartel de calle de 9×3 a nivel del suelo, que es la valla mexicana |
| prima (Roadblock) | **acréscimo** | §2 bis |
| tramo · escalón · escala plana | **patamar** · **degrau** · **escala não progressiva** | *faixa* chocaría con *faixa horária*; «escala plana» no se dice: lo que la distingue es que el descuento alcanzado vale para todas las unidades |
| horario de transmisión | **grade de programação** | el término de la TV y el DOOH brasileños |
| tentativa (reserva) | **provisória** | «Reservar (provisória)» |
| dueño (del espacio que se negocia) | **dono** | «proprietário» lo prohíbe en TODO el portugués la prueba del L5 (decisión Titular); *dono do imóvel* es natural |
| prime (franja) | **horário nobre** | el placeholder «ex.: Horário nobre» |
| distrito · plaza | **bairro** · **praça** | *praça* es el mercado en la mídia brasileña |
| se compone (descuentos) | **se aplica em cascata** | «20% e 20% deixam o cliente pagando 64%, não 60%» |
| tablero de propuestas | **resumo** («Resumo de propostas») | *painel* es el espectacular |
| reparto · a prorrata | **rateio** · **proporcionalmente** | |
| vigencia de un código / propuesta | **validade** («Válida até {fecha}») | la del contrato sigue *vigência* (§2 bis) |
| Próximo (código) · Agotado | **Em breve** · **Esgotado** | |
| unipolar | **monoposte** | la estructura de un poste en Brasil |
| Ej. / p. ej. | **Ex.:** / **ex.:** | |

## 3 · Clave por clave, lo no obvio

- **Pantalla y sitio = *ponto*, la digital = *tela*.** «Novo ponto», «Reservar
  pontos», «Ponto próprio»; *tela* solo donde es digital: «Tela digital», «as
  telas digitais da visualização», la calculadora («o horário da tela», «A tela
  não tem tarifa mensal»).
- **`comercial.ficha.no-reservable`**: «Ponto não reservável (status:
  {estatus})». `SiteFicha` solo pone el estatus en minúsculas en español; en
  portugués va tal cual y entre paréntesis, como en inglés e italiano.
- **`comercial.negociacion.ubicacion.el`**: « · {fecha}» → «Salva por Ana · 1
  de out. de 2026 · pela busca». Sin «em» delante de la fecha (regla común).
- **Fechas** (regla común): «Válida até {fecha}», «Vencida desde {fecha}»,
  «Venceu ({fecha}): o link não permite mais aceitá-la…», «O cliente pode
  aceitá-la até {fecha} (esse dia incluído).», documento «Aceita: {fecha}» y
  «Vencida: {fecha}».
- **`propuestas.ficha.mapa.parcial`**: «Pontos sem coordenadas (não aparecem
  no mapa): {n} de {pantallas}.» — sin concordancia con ninguna cifra (la
  lección del L5, `cuenta.publica.mapa.parcial`). `sin-coords.uno`: «O único
  ponto desta proposta…» (el español dice «Ninguna de las 1 pantalla»).
- **`propuestas.tablero.col.aprobada`**: «Data de aprovação», no un participio
  colgando de una cabecera (la lección del italiano, fila 46).
- **`propuestas.alta.renta.sospechosa`**: «…o que você paga ao LOCADOR» (el
  español dice PROPIETARIO: no se puede, y es el locador).
- **`comercial.reserva.tipo.*`**: el tipo es de la CAMPANHA (fem.): «Digital»,
  «Fixa», «Híbrida», «Fixa (OOH) — com gráfica». `propuestas.comun.fija` es
  de un ponto: «Fixo».
- **`comercial.editar.cupo.ahora.*`**: el español dice lo mismo en `.uno` y
  `.otros` («Ahora mismo tiene {n}.»); el portugués nombra al cliente y
  concuerda: « Agora tem {n} cliente.» / «… clientes.».
- **`comercial.negociacion.ofertas.meses.*`**: «{n} mês» / «{n} meses» (el
  español dice «meses» en los dos).
- **`propuestas.calc.rotaciones`**: «{n} loops/h» (D-P4). **`spots`, `slots`**
  se quedan en inglés y en plural («97.200 spots», « slots/h»): en pt-BR se
  pluralizan, a diferencia del italiano.
- **Los avisos de captura** (`comercial.tarifas.no-se-entiende`,
  `catalogos.tarifas.invalida`) dicen la verdad MEXICANA de hoy («a vírgula
  separa os milhares e o ponto, os decimais»), como `compartidos.cifra.*` del
  L5; la tarea roja `feat/portugues-cifras` (P2) los reescribe.
- **Datos de ejemplo**: «Buen Fin 2026» se queda (temporada mexicana: la
  instancia es mexicana); «VERANO20» → «VERAO20»; «Lanzamiento Q3» →
  «Lançamento T3» (D4: trimestre «T»); «cliente@empresa.com.br».
- **Las coordenadas de ejemplo** (`comercial.negociacion.buscar.ayuda`) siguen
  con punto: se pegan de un mapa (como en el italiano y el L5).
- **`catalogos.paquetes.col.codigos`**: «Códigos?» (sin «¿»).

## 4 · Los papeles: costura con `feat/portugues-documentos` (P3)

`textos/papeles-portugues.ts` de la rama P3 (no integrada) trae 59 claves de
este lote (documento imprimible, `/p`, correo, tipo de medio). **48 son
idénticas** a las mías. **11 difieren**, y las dejo como están porque las mías
obedecen el glosario y las reglas comunes; `papeles-portugues.test.ts` las
marcará en la costura (allí «gana el lote» por mezcla, pero su prueba exige
que digan lo mismo):

| Clave | P3 (`papeles-portugues.ts`) | L2 | Por qué la del L2 |
|---|---|---|---|
| `propuestas.documento.aceptada` | Aceita em {fecha} | Aceita: {fecha} | regla común: ningún «em {fecha}» (lo vigila `portugues-l5.test.ts`, que con P3 integrado se pondrá roja) |
| `propuestas.documento.vencio` | Venceu em {fecha} | Vencida: {fecha} | ídem |
| `propuestas.documento.pantallas` | TELAS | PONTOS | §2 bis: la pantalla de inventario es *ponto* (un papel lleva espectaculares) |
| `propuestas.documento.col.pantalla` | Tela e localização | Ponto e localização | ídem |
| `propuestas.documento.sin-coords` | {n} tela(s) sem coordenadas… | {n} ponto(s) sem coordenadas… | ídem |
| `propuestas.ficha.mapa` | Localização das telas | Localização dos pontos | ídem |
| `propuestas.correo.cuerpo` | …revisar as telas… | …revisar os pontos… | ídem |
| `propuestas.correo.folio` | Nº {folio} | Ref. interna {folio} | Folio = «Ref. interna» (decisión del dueño) |
| `propuestas.comun.bruto-lista` | Bruto (tabela de preços) | Bruto (preço de tabela) | *tabela de preços* es la rejilla (§2 bis); el precio de lista es *preço de tabela* |
| `comercial.tipo-medio.espectacular` | Outdoor | Painel | §2 bis (espectacular → painel) |
| `comercial.tipo-medio.valla` | Painel | Outdoor | el outdoor brasileño es la valla |

## 5 · Pruebas

- **Prueba estática** `lib/i18n/textos/portugues-l2.test.ts`, **en rojo
  primero** (commit propio `5f2c705e`): con los `PT_*` vacíos, **7 de 20
  rojas** (los cuatro ámbitos sin portugués, el plural, el glosario y la
  comisión). Mira el diccionario entero: cada clave con portugués y ninguna de
  sobra; ninguna igual al español o al inglés salvo los 149 cognados
  declarados (`COGNADOS_PT_L2`, con su texto: «Vigente», «Tarifa», «Mapa»,
  «Loop de {loop} · slot de {slot} → {n} slots por loop»…; la prueba exige que
  sigan siendo iguales); huecos y bordes del español; `.uno` ≠ `.otros`;
  comillas “ ”; «20%» pegado; ni ñ, ¿, ¡ ni palabras españolas sueltas (con
  su prueba de que muerde; tras guion no cuentan: «alterá-las»); ni moneda
  («real» incluido: «a margem real» pasó a «a margem efetiva»); el **glosario**
  (31 pares, con 5 excepciones declaradas y su porqué) y la comisión. Las
  reglas de TODO el portugués (fechas, tuteo, «proprietário») ya las aplica
  `portugues-l5.test.ts` sobre `PT_PARCIAL`, y pasan.
- **Pantallas en portugués** (`pantallas-comercial`, `-propuestas`,
  `-catalogos`): cada estado de las tres rendido en `pt` (25 + 24 + 15), con
  el barrido del diccionario del lote (`culpablesEnItaliano` con los `PT_*`,
  apartando `espanolPendienteDeOtrosLotes()`), `huellasEnPortugues` y las
  frases portuguesas esperadas donde hay concordancia o formato. Más los
  estados de la lección del italiano L2 (V2, V5, V6, V15, H2): códigos al
  12,5% con «1.200 de 5.000», reserva con «2.400» slots, tablero con «12,5%»,
  «margem 33,3%» y miles, y la liga pública con «(2,5%)», «(7,5%)»,
  «(12,5%)» y «Tela digital».
- **El documento imprimible** entra en `pt` con el portugués encendido; con el
  espejo (`I18N_VOLCAR_PT`) se construye además su árbol portugués y se
  envuelve en `SegunIdioma` (como el italiano). Solo con el espejo: la corrida
  normal no cambia.

### Mutantes (12/12 mueren)

`scratchpad/pt-l2/mutar.cjs`, de uno en uno contra las unitarias del lote,
restaurados (`git status` limpio). Las e2e no se mutaron (§8).

| # | Mutante | Resultado |
|---|---|---|
| M1 | una clave igual al español («Nueva pantalla») | muere (4) |
| M2 | glosario: «Neto para o veículo» | muere |
| M3 | «aceitá-la no {fecha}» | muere |
| M4 | `.uno` igual a `.otros` («{n} pontos») | muere |
| M5 | la comisión sin «comissão» | muere (3) |
| M6 | comillas « » | muere |
| M7 | tuteo («Digita o código») | muere |
| M8 | porcentaje con espacio («20 % aqui») | muere |
| M9 | moneda («a margem real») | muere |
| M10 | un hueco perdido (`{unidad}`) | muere |
| M11 | `cifraEnEtiqueta` trata `pt` como es/en (punto decimal) | muere (15) |
| M12 | palabra española suelta («Reservar sitios») | muere (3) |

(Probé también dos mutantes de la prueba, no del código: quitar el portugués
encendido al pintar el documento —casi equivalente: el papel lo decide el
idioma de la instancia, que el simulacro toma de la cookie— y quitar el
español de `propuestas.*` del barrido —no hay español que cazar—. Sobreviven
los dos y no cuentan.)

## 6 · Español, inglés e italiano idénticos — medido

| Medición | Resultado |
|---|---|
| `DICCIONARIOS.es/.en/.it`, `traducirError` es/en/it (catálogo, `CATALOGO_LIB`, 30 campos), los patrones y dos motivos de catálogos en los tres idiomas; volcado JSON antes (`72b33050`) y después | 1 272 143 bytes, **`cmp` idénticos** |
| `I18N_VOLCAR_TODO` de toda la suite (sin `cifras-formularios.test.ts` ni `middleware.test.ts`, `--testTimeout=60000`), antes (`72b33050`, 4825 archivos) y después (4897) | `diff -rq`: **0 HTML distintos de es/en/it**; 7 HTML distintos, todos estados `…en_PORTUGUES…` del L5 que ahora pintan el portugués del L2 (Network, portal, propuesta pública); 68 nuevos, todos portugueses; 0 «solo antes»; `_italiano.txt` ordenado idéntico |
| Fuentes | el diff de los cuatro `textos/` solo retira la declaración vacía `PT_* = {}` y su comentario de la ola 0; en las tres pruebas de pantallas, la rama `pt` de `SegunIdioma` y del documento |

## 7 · Espejo (`I18N_VOLCAR_PT`) sobre las tres pruebas del lote

**15 estados, 103 huellas** (la ola 0 medía 21 y 228 en estos archivos), todas
explicadas:

- **12 estados, 24 huellas** de `pantallas-comercial`: los ejemplos de
  captura del alta («Ex.: 12.9», «Ex.: 7.2»), que siguen la captura mexicana
  hasta P2 (declarados en `PERMITIDOS_PT` en la prueba portuguesa).
- **3 estados, 79 huellas** de `pantallas-propuestas`: las pruebas del ADR 0049
  y de B72 que fijan la instancia en español o inglés. El papel va en el
  idioma de la instancia, no en el de quien lee: el espejo no puede (ni debe)
  cambiarlo.
- El documento imprimible «normal» ya no da huellas (eran 204 en 9 estados).

## 8 · Lo que no se hizo, y por qué

- **Las e2e** no se corrieron: el lote no toca sesión, tenant, migraciones ni
  dinero en base (solo textos y pruebas).
- **`costura.test.ts`** no se extiende al portugués: es del integrador, cuando
  haya dos lotes portugueses juntos.
- **Los motivos de `lib/volumen.ts` con porcentaje decimal** («({pct} %)» en
  español): el número entra con `String(n)`, así que un 12,5 saldría «12.5%»
  en portugués… y en italiano. Es previo y común a los dos; arreglarlo solo
  para `pt` cambiaría el criterio del italiano. Para la costura.
- **`AltaSitioDialog.tsx:221`** sigue con `simbolo: '$'` fijo («Tarifa
  publicada ($)»): defecto previo, del lote de moneda (lo anotó el italiano).
- **Los papeles** (documento, `/p`, correo) se ven en portugués solo con una
  instancia `pt` (P3): ver §4.

## 9 · Suites y recuentos (medidos en este árbol)

- `cd apps/web && npm run typecheck`: limpio.
- `npx vitest run --testTimeout=60000` (toda la suite unitaria salvo
  `cifras-formularios.test.ts` y `middleware.test.ts`, que se cuelgan con el
  volcado): **418 archivos, 8880 en verde + 1 omitida, 0 rojas**.
- `node scripts/recuentos.mjs`: 160 endpoints, 66 tablas, 125 migraciones, ADR
  hasta 0049, 118 notas, 1681 enlaces (con la entrada del diario), 3 wikilinks rotos (los ADR de siempre),
  0 huérfanas.

## 10 · Dudas para el dueño

1. **Comisión = *comissão*** en todo el lote (el italiano eligió
   *provvigione*). En portugués no hay alternativa seria: *comissão* es la
   palabra de la agencia y del vendedor.
2. **Espectacular = *Painel*, valla = *Outdoor*** — al revés que la rama P3
   (§4). Alternativa: *Outdoor* para el espectacular, como hace P3, si el
   dueño piensa en el cliente brasileño que llama «outdoor» a todo cartel.
3. **Precio de lista = *preço de tabela*** y rejilla = *tabela de preços*
   (§2 bis). Se parecen; si molesta, la rejilla podría ser *grade de preços*.
4. **«Líquido para o veículo»** para el neto del medio.
5. **Tramo = *patamar*, escala plana = *escala não progressiva***.
6. **Horario de transmisión = *grade de programação***.
7. **«Buen Fin»** se queda en los ejemplos (la instancia es mexicana).

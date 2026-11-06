# Validación · Lote L4 del portugués (campañas, finanzas, clientes, reportes y Dashboard)

**Fecha:** 2026-11-05 · **Rama:** `feat/portugues-l4-campanas` (`7317e6e8`), sobre
`integra/portugues` (`72b33050`) · **Revisión del traductor:**
`docs/i18n/revision-portugues-l4.md` · Validador independiente: solo lee y mide;
no corrige. Todo lo de abajo está medido en este árbol.

## Veredicto: ÁMBAR (leve)

La maquinaria está **limpia**: español, inglés e italiano **byte a byte iguales**
(diccionarios y volcado HTML de toda la suite: 0 HTML distintos de es/en/it),
el Dashboard español intacto, el CSV portugués correcto (`;`, coma decimal,
moneda en el encabezado, defensa contra fórmulas) y typecheck y suite en verde.
Leídas las **1082 claves** del lote, en par con el español y el inglés, más el
HTML portugués volcado de finanzas, Dashboard y reportes. La traducción es
buena: registro «você» constante, glosario común respetado (OS, PC, ocorrência,
ponto/tela, locador, extrato, bloqueio de faturamento, Ref. interna), plurales
bien resueltos en los avisos largos de reportes y huecos idénticos al español.

Lo que impide el VERDE es **un aviso de dinero y fecha que dice otra cosa**
(H1): «Em atraso até {fecha}» se lee como «atrasado *hasta* esa fecha», cuando
el español dice «vencido *a* esa fecha» (el corte). Se ve en Finanzas, en el
resumen del periodo y en el CSV. Es de una línea por clave. El resto son
retoques (H2–H8) y dos huecos de prueba (MV3, MV4).

**Para la costura (no es defecto del lote, pero conviene saberlo):** al fusionar
con `integra/portugues` (que ya trae P3) **se ponen rojas 2 pruebas** y hay **un
conflicto de texto en el diario** (§5).

## 1 · Mediciones

| Medición | Resultado |
|---|---|
| `cd apps/web && npm run typecheck` | limpio |
| `npx vitest run --testTimeout=60000` | **420 archivos, 9222 en verde + 1 omitida, 0 rojas** |
| `ES_/EN_/IT_` de los cinco ámbitos (`campanas`, `finanzas`, `clientes`, `reportes`, `inicio`) en `72b33050` y en `HEAD`, volcados a JSON (importando los `.ts` con Node 24) | **214 400 bytes, `cmp` idénticos** |
| `diccionario.ts`, `errores-servidor.ts`, `idiomas.ts` | **0 líneas de diff** → `DICCIONARIOS.es/.en/.it` y `traducirError` idénticos por construcción (ningún otro fuente cambia salvo el CSV) |
| `I18N_VOLCAR_TODO` (sin `cifras-formularios.test.ts`), rama y base (`git switch --detach 72b33050` en el mismo worktree y vuelta) | base **4823** HTML (418 archivos en verde), rama **5140** (419 en verde). `diff -rq`: **1 HTML distinto, portugués** (el portal del cliente del L5 en `pt`, que ahora pinta etapas y galería del L4); **0 desaparecidos**; **317 HTML nuevos** en 305 carpetas de estado nuevas (169 campañas/finanzas, 76 clientes, 49 reportes, 11 Dashboard), todas con `PORTUGUES` en el nombre; `_italiano.txt` ordenado idéntico |
| Instantánea del Dashboard español (`__snapshots__`) | no está en el diff; en verde sin regenerar |
| Huecos `{x}` pt vs es (1082 claves) | iguales en todas |
| Comillas « », espacios dobles, tuteo (`tu/teu/tens…`) | ninguno |
| `PT_PAPELES` (de `integra/portugues`) vs el lote | 33 claves comunes, **3 distintas** (las declaradas, §4) |
| Árbol al terminar | limpio, `HEAD` = `7317e6e8` antes de este commit |

### 1.1 · El CSV del estado de cuenta

`estado-cuenta-csv.ts`: la única lógica nueva es `excelConComa = idioma === 'it'
|| idioma === 'pt'`; separador, `num()` y `texto()` son los del italiano.
Leídos el código y el bloque portugués de `estado-cuenta-csv-idioma.test.ts`:
«;» como separador y dentro de comillas, coma decimal («5000,5»), importe como
número sin miles ni símbolo, moneda en el encabezado («Débito (MX$)»), fechas
pt-BR, nombre `extrato-…csv` y fórmula neutralizada. Los bloques es/en/it de esa
prueba no se tocaron (solo +56 líneas añadidas) y siguen en verde. El mutante
MV2 (quitar la defensa con «;») muere en 4.

## 2 · Sentido en portugués

Leído **todo** el lote clave por clave (es / en / pt) y, en contexto, el HTML
portugués de: estado de cuenta con movimientos, resumen del periodo, Finanzas
con una factura desplegada, Dashboard con todas las alertas y reportes por
operación y por luz.

### 2.1 · A corregir

| # | Dónde | Texto actual | Problema | Propuesta | Gravedad |
|---|---|---|---|---|---|
| H1 | `textos/finanzas.ts:782` `finanzas.estado-cuenta.vencido-al`; `:808-809` `finanzas.periodo.vencido.sub.uno/.otros` | «Em atraso até {fecha}» · «{n} fatura(s) até {fecha}» (en el HTML: «Em atraso até 2 de nov. de 2026 MX$ 300,00», «2 faturas até 2 de nov. de 2026»; y en el CSV) | El español dice «Vencido **al** {corte}» (*a esa fecha*, el corte; el inglés «as of», el italiano «al giorno»). «Em atraso até» se lee «atrasado **hasta** esa fecha», como si dejara de estarlo después; y «2 faturas até…» pierde que son *vencidas*. La regla de fechas prohíbe «em {fecha}», pero hay formas idiomáticas | «Vencido até {fecha}» (lo que dice una cartera brasileña: *títulos vencidos até*) y «{n} fatura vencida até {fecha}» / «{n} faturas vencidas até {fecha}»; o, si se prefiere el corte explícito, «Em atraso · posição de {fecha}» | **media** (dinero + fecha) |
| H2 | `textos/campanas.ts:1859` `campanas.validacion.bajar.texto` | «…mas {arte}(a API não permite)…» | Copia el espacio que falta en el español; sale «…do DOOHmain(a API não permite)». El inglés ya lo corrige | «…mas {arte} (a API não permite)…» | baja |
| H3 | `textos/reportes.ts:856`, `:884`, `:896` (`.uno` de `ot.estimacion`, `tarifa.sin-tarifa`, `vendedor.sin-vendedor`) | «{estimadas} **da** {total} visita…», «{sin} **da** {total} reserva…» | `.uno` se elige con `{total}` = 1: sale «1 da 1 visita do período», que en portugués no se dice («da» con un número singular) | «{estimadas} de {total} visita do período…», «{sin} de {total} reserva…» | baja |
| H4 | `textos/reportes.ts:905` `reportes.nota.luz.completa.uno` | «a {esperados} conta prevista do período está registrada» | Con `{esperados}` = 1 sale «a 1 conta prevista»; poco natural | «Não falta nenhuma conta: a conta prevista do período ({esperados} de {esperados}) está registrada, então…» | baja |
| H5 | `textos/campanas.ts:1543` `campanas.kpi.activas.sub.*` | «{n} confirmada(s) para começar» | Se lee «confirmada para que empiece»; el español es «por arrancar» (aún no empieza) | «{n} confirmada(s), ainda por começar» | baja |

### 2.2 · Retoques menores (no bloquean)

| # | Dónde | Actual | Propuesta |
|---|---|---|---|
| H6 | `textos/finanzas.ts:833` `finanzas.comprobante.aviso` | «CFDI **carimbado** perante o SAT… o **carimbo fiscal**» | *carimbar* es poner un sello de goma; el término mexicano se nombra tal cual, como CFDI: «NÃO é um CFDI timbrado pelo SAT: o timbrado é emitido à parte…» |
| H7 | `textos/finanzas.ts:792` `finanzas.estado-cuenta.aproximada.title` | «leva a data da **sua** fatura» | «sua» se lee «de usted»: «leva a data da fatura correspondente» (igual en `finanzas.periodo.sin-fecha`, «receberam a data da sua fatura») |
| H8 | `textos/clientes.ts:763` vs `textos/campanas.ts` `campanas.lista.buscar` | «Pesquisar cliente» junto a «Buscar por nome…» | un solo verbo en la app (el L5 usa «Buscar») |
| H9 | `textos/clientes.ts:806` | «Código postal inválido (5 dígitos)» bajo la etiqueta «CEP fiscal» | coherente con el hallazgo 12 del L5 (el código es mexicano); que la etiqueta diga lo mismo: «Código postal fiscal», o aceptar la mezcla a sabiendas |
| H10 | `textos/campanas.ts:1470` vs `campanas.etapa.creativo-validado` | «Validada» (creatividad) y «Criativo aprovado» (etapa); `impresion.validado` «Aprovada» | un solo verbo para el mismo estado del criativo (*aprovado*) |

### 2.3 · Revisado y correcto (muestra)

Finanzas: «Lembrete de cobrança enviado», «{n} parcelas, duas por mês», «308d de
atraso», «Ao cobrir o saldo total, a cobrança passa para {pagada} e os lembretes
param», «⚠ O valor excede o saldo…», «Débito / Crédito / Saldo», «Nenhuma fatura
nem pagamento de {desde} a {hasta}», «Esta campanha dura {n} mês: … é cobrada de
uma só vez», «Cobrança quitada / Pagamento parcial registrado», «Emitente:
Não atribuída». Reportes: los avisos largos (margem BRUTA, superfície de todas
las faces, sin contrato, en curso con `.uno`/`.otros` concordando con
`{corridos}`), «Conta faltando / Contas faltando: {faltantes} de {esperados}»
(invariable a la cifra), «A única visita do período…», «rateada» para
repartir costos. Dashboard: «Receita de novembro … a receita reconhecida neste
mês, proporcional aos dias», «15 de 24 espaços · digitais 12/20 · fixos 3/4»,
«87% de 4 vendas com tarifa de tabela · 2 sem tarifa para comparar», «“Verano”
vai até 1 de mar. de 2028, mas o contrato vence antes (31 de dez. de 2027)»,
«OS atrasada OT-1 · … — atrasada há 1 dia · sem responsável», «Laudo
estrutural», «Licenças e autorizações». Campañas: «faturamento liberado»,
«Bloqueio de faturamento», «Enviar para publicação», «Retomar», «Remover
criativo (encerra a campanha dele no DOOHmain)» (el `{nombre}` es el criativo:
masculino correcto), «Relatório de veiculação», «Receita do veículo
(líquida)». Clientes: «Nome fantasia», «Este {tipo} já existe» (los cuatro
tipos, en minúscula, son masculinos), «Ao aprovar, nada é cadastrado ainda: o
ponto é completado no Inventário», «Motivo da recusa (o vendedor vai ler)».
Lo que cae al español en estas pantallas («Pantalla Reforma», «Valla Centro»,
«clausura-municipal», «Panel s1») son DATOS de la prueba, no textos.

## 3 · Mutantes propios (unitarias)

Aplicados uno a uno con `scratchpad/val-pt-l4/mutar.mjs` contra las siete
pruebas del lote (estática L4 y L5, las cuatro `pantallas-*`, CSV), restaurados;
`git status` limpio al acabar. Las e2e no se mutaron (el lote no toca sesión,
tenant, base ni dinero en base).

| # | Mutante | Resultado |
|---|---|---|
| MV1 | `vencido-al` = «Em atraso **em** {fecha}» | muere (3) |
| MV2 | CSV: la defensa contra fórmulas solo con «,» | muere (4) |
| MV3 | `inicio.huecos-nada` = «Nada fica **libre**…» | **SOBREVIVE** |
| MV4 | tuteo: `finanzas.comprobante.no-cuadra` «**Revisa**-o antes…» | **SOBREVIVE** |
| MV5 | `campanas.evidencia.alt` = «evidencia» (español) | muere (1) |
| MV6 | `.otros` de `reportes.aviso.sin-contrato` con «não **tem**» | sobrevive (esperado: la concordancia no es mecánica) |

**MV3**: `libre/libres` no está en `PALABRAS_SOLO_ESPANOL`
(`lib/test/barrido-portugues-l4.ts`) ni en la guardia estática; es la palabra
española que más fácil se cuela al lado de «livre». Propuesta: añadir `libre`,
`libres`, `pago` (como sustantivo), `cobro`, `alta` a la lista, con su prueba
de que muerde. **MV4**: el `TUTEO` del L5 (`portugues-l5.test.ts:258`) mira
`Tenta|Escolhe|Digita|Clica` pero no los imperativos de 2.ª que el lote usa en
3.ª («Revise», «Use», «Escolha», «Complete», «Remova», «Verifique»): propuesta,
añadir `Revisa|Usa|Completa|Remove(?! )|Verifica|Ajusta` con cuidado de no
morder «Remover»/«Revisão».

## 4 · Las tres claves distintas de `papeles-portugues.ts`

Comparadas contra el `PT_PAPELES` que **ya está en `integra/portugues`**
(`2e2a62e1`, P3 integrada): 33 claves de los ámbitos del lote, 30 iguales, 3
distintas — exactamente las que declara la revisión.

| Clave | Lote | Papel | Debe ganar |
|---|---|---|---|
| `campanas.evidencia.vacia.texto` | «As fotos de comprovação são enviadas ao encerrar a OS no celular.» | «As evidências são enviadas…» | **el lote.** El glosario común (§2 bis) fija *evidencia → comprovação* y manda que gane sobre cualquier lote; «foto de comprovação» es el *checking* de mídia, y es lo que dicen las demás claves del lote («Fotos de comprovação», «Comprovação fotográfica») y el bloqueio de faturamento |
| `campanas.evidencia.alt` | «comprovação» | «evidência» | **el lote**, con un retoque: para un `alt` de imagen, «foto de comprovação» describe mejor que el sustantivo suelto |
| `finanzas.comun.folio` | «Nº da fatura» | «Número» | **el lote.** La clave es la cabecera de la tabla de cobrança, la de faturas, la del extrato y la columna del CSV: «Número» suelto, entre «Movimento» y «Cliente», no dice de qué. En el comprobante va junto a «Série» y sigue leyéndose bien, y en Brasil la *fatura* es justamente el documento comercial no fiscal (la fiscal es la nota), que es lo que ese comprobante dice ser |

En la costura: cambiar las tres en `PT_PAPELES` (o quitarlas de allí, ya que el
lote las cubre) para que `papeles-portugues.test.ts` vuelva a verde.

## 5 · Integración con `integra/portugues` (medido con una fusión de prueba)

`git merge --no-commit integra/portugues` en este worktree, las pruebas, y
`git merge --abort` (árbol limpio y `HEAD` intacto después):

- **Conflicto de texto** en `vault/07-Agentes/diario/2026-11-05.md` (las dos
  ramas añaden al diario del día). Ningún otro.
- **2 rojas** tras la fusión, las dos previstas por P3 para cuando un lote cierra:
  `papeles-portugues.test.ts` «si un lote escribe una clave de papel, tiene que
  decir LO MISMO» (las 3 de §4) y `cobertura-portugues.test.ts` «fuera del L5,
  lo traducido es exactamente lo de los PAPELES» (las cinco filas del L4 ya
  están completas: esa expectativa tiene que pasar a «0 pendientes» para L4,
  como para L5). `portugues-l4.test.ts` sigue en verde con P3 dentro.

No es un defecto del lote (salió antes de P3), pero quien integre tiene que
tocar esas dos pruebas y `PT_PAPELES` en el mismo commit de la fusión.

## 6 · Las 5 dudas para el dueño (revisión §10), desde el uso brasileño

Opinión; decide el dueño.

1. **«Captação de pontos» como título de la página.** El menú del L5 lo fija así,
   pero la página lleva también **clientes** («Clientes, locadores, imóveis e
   pontos…») y un brasileño entiende *captação* sola tanto de clientes como de
   pontos («captação de clientes» es habitual en ventas). Propongo **«Captação»**
   a secas como título (y, si se quiere, también en el menú). «Prospecção»
   solo cubre clientes.
2. **«Tarifa de tabela».** Correcto: *preço/tabela de preços* es lo que dicen las
   tablas de mídia brasileñas; «tarifa cheia» es más coloquial y sugiere «sin
   descuento» sin decir de dónde sale. Mantener.
3. **«{n} parcelas, duas por mês».** Correcto y sin ambigüedad. En finanzas
   brasileñas «parcelas quinzenais» se entiende sin problema, pero el glosario
   reserva el campo semántico de la quincena para no chocar con la bissemana;
   mantener la decisión.
4. **«Provisória».** Bien como adjetivo («Reserva: Provisória»). En la mídia
   brasileña lo más oído para ese estado es **«pré-reserva»**; si L2 lo usa como
   sustantivo, valdría la pena unificar a «Pré-reserva» en la costura. Lo
   importante es que L2 diga lo mismo.
5. **«Nome fantasia» y «veículo».** Los dos son los términos exactos del mercado
   brasileño (*nome fantasia* es el legal; *veículo* es quien vende el espacio
   en mídia). «Receita do veículo» puede extrañar a alguien de fuera del sector,
   pero el usuario de la app es del sector. Mantener.

## 7 · Resumen de hallazgos

| # | Gravedad | Qué |
|---|---|---|
| H1 | **media** | «Em atraso até {fecha}» / «{n} fatura até {fecha}» dicen «hasta», no «al corte» (Finanzas, resumen, CSV) |
| H2–H5 | baja | espacio pegado en `bajar.texto`; «1 da 1 …» en tres `.uno` de reportes; «a 1 conta prevista»; «confirmada para começar» |
| H6–H10 | retoque | «carimbado», «sua fatura», Pesquisar/Buscar, CEP/código postal, validada/aprovada |
| MV3, MV4 | prueba | «libre» y el tuteo «Revisa» no los vigila nada |
| Costura | — | 3 claves de papel (gana el lote), 2 rojas y un conflicto del diario al fusionar con `integra/portugues` |

## Segunda vuelta (05/11, `097660f5`)

Revalidado sobre los tres commits del traductor (`fa631579` pruebas en rojo,
`31e183df` correcciones, `097660f5` revisión, tablero y diario), encima de
`159e786a`.

### Veredicto final: VERDE

| Medición | Resultado |
|---|---|
| `cd apps/web && npm run typecheck` | limpio |
| `npx vitest run --testTimeout=60000` | **420 archivos, 9235 en verde + 1 omitida, 0 rojas** (+13: las pruebas de los hallazgos y las guardias nuevas) |
| `ES_/EN_/IT_` de los cinco ámbitos, HEAD contra `72b33050` | **`cmp` idénticos** (214 400 bytes); `diccionario.ts`, `errores-servidor.ts` e `idiomas.ts`, 0 líneas de diff; fuera de `textos/` solo cambia (desde la base) `estado-cuenta-csv.ts`, el mismo de la primera vuelta |
| La línea española tocada por el reemplazo masivo | `campanas.ts:80` `ES_CAMPANAS['campanas.creatividad.validada']` = **«Validada»**, como en la base; el único cambio de esa clave entre `159e786a` y HEAD es el PT (`:1470`, «Aprovada»). Lo confirma el `cmp` de arriba |
| Árbol | limpio al terminar |

### Los hallazgos, uno por uno

| # | Ahora | Veredicto |
|---|---|---|
| H1 | «Vencido até {fecha}», «{n} fatura vencida até {fecha}» / «{n} faturas vencidas até {fecha}». En el CSV: «Vencido até 30 de set. de 2026 (MX$);6600». La prueba del CSV ya no puede buscar «Vencido» como palabra española (también es portuguesa) y busca «Vencido al»: correcto | cerrado |
| H2 | «…mas {arte} (a API não permite)…» | cerrado |
| H3 | «{estimadas} de {total} visita», «{sin} de {total} reserva» (los tres `.uno`); prueba: ningún «da {total}» en reportes | cerrado |
| H4 | «a conta prevista do período está registrada ({esperados} no total)» | cerrado |
| H5 | «{n} confirmada(s), ainda por começar» | cerrado |
| H6 | «NÃO é um CFDI timbrado pelo SAT: o timbrado é emitido à parte…» | cerrado |
| H7 | «da fatura correspondente» en `aproximada.title` y `periodo.sin-fecha` | cerrado |
| H8 | «Buscar cliente»; prueba: ningún «pesquis» en el lote. Ahora es igual al español y entra en `COGNADOS_PT_L4`, con su porqué (y `creatividad.validada`, que ya no lo es, sale) | cerrado |
| H9 | se queda «CEP fiscal» + «Código postal inválido (5 dígitos)» | **de acuerdo**: la etiqueta es la del glosario común y la de `admin.razones.cp` (L5), y el mensaje es el gemelo del catálogo del servidor; cambiar uno solo rompe otra coherencia. Va a la costura, en los tres sitios a la vez |
| H10 | `creatividad.validada` = «Aprovada», «({validadas}/{total} aprovados)», como «Criativo aprovado» | cerrado |

Sin «pago»: «Quitado {monto}» (`finanzas.periodo.renta.pagada`, el aluguel:
masculino, junto a «A pagar no período») y «o custo de operação que você vê é
o que foi desembolsado» (`reportes.nota.ot.reales.*`). Los dos se leen bien y
dicen lo mismo que el español. `campanas.evidencia.alt` = «foto de comprovação»,
como proponía §4.

### Las guardias nuevas

- **Palabras solo españolas** (`PALABRA_ESPANOLA` de la estática y
  `PALABRAS_SOLO_ESPANOL` del barrido): + «libre/libres», «cobro», «alta» y
  «pago». Prueban que muerden («Nada fica libre», «Está pago», «Alta do
  cliente», «o cobro») y que no muerden «Livre hoje», «pagamento», «altura»,
  «{sin}», «sinal». Pasadas a mano por los `PT_*` del L5 (admin, cuenta,
  compartidos, shell, notificaciones, servidor): solo coinciden nombres de
  clave y huecos (`{libres}`), ningún texto; no hay falsos positivos hoy. Ojo
  para el futuro: «alta» y «pago» son también portugués («em alta», «está
  pago»); si la costura extiende la guardia a todo el portugués, que lo haga
  sabiéndolo.
- **`TUTEO_L4`**: imperativos de 2.ª con mayúscula (orden) o con enclítico
  («revisa-o», «ajusta-os»). Prueba de que muerde (6 casos) y de que no muerde
  «Revise-o», «Use o filtro», «a lista completa», «Revisão», «usado»,
  «Verifique», «Ajuste-os», «Remover», «Usuário». Sin falsos positivos en el
  lote ni en los textos del L5 revisados.

### Mutantes (contra las siete pruebas del lote; restaurados, `git status` limpio)

| # | Mutante | Resultado |
|---|---|---|
| MV3 | «Nada fica **libre**…» | **muere** (2) — antes sobrevivía |
| MV4 | «**Revisa**-o antes de entregá-lo» | **muere** (1) — antes sobrevivía |
| MV7 | «**Usa** “Nova agência”…» (clientes) | muere (1) |
| MV8 | vuelve «Em atraso até {fecha}» | muere (2) |
| MV9 | «o que foi o **cobro**» (reportes) | muere (1) |

### Decisiones del dueño de hoy

Título de Captación = **«Captação»** a secas y tentativa = **«Pré-reserva»**:
las aplica la costura, no este lote (hoy siguen «Captação de pontos» y
«Provisória/Provisórias»). Sigue pendiente para la costura lo de §5: las tres
claves de `PT_PAPELES` (gana el lote), las dos pruebas de P3 que se ponen rojas
al fusionar y el conflicto del diario.

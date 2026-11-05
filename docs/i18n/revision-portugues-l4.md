# Revisión · Lote L4 del portugués (Campañas, Finanzas, Clientes, Reportes y Dashboard)

**Fecha:** 2026-11-05 · **Rama:** `feat/portugues-l4-campanas`, sobre
`integra/portugues` (`72b33050`) · **Tablero:** `vault/03-Frontend/portugues-olas.md`
(subsección «Lote L4») · **Encargo:** traductor del lote L4 del portugués
(pt-BR); lo revisa un validador independiente. Equivalente del L4 italiano
(`docs/i18n/revision-italiano-l4.md` y su validación), con sus lecciones y las
del L5 portugués aplicadas desde el principio.

## 1 · Qué se tradujo

| Ámbito | Archivo | Claves | Antes | Después |
|---|---|---:|---:|---:|
| campanas | `textos/campanas.ts` | 396 | 0 | 396 |
| finanzas | `textos/finanzas.ts` | 170 | 0 | 170 |
| clientes | `textos/clientes.ts` | 220 | 0 | 220 |
| reportes | `textos/reportes.ts` | 148 | 0 | 148 |
| inicio (Dashboard) | `textos/inicio.ts` | 148 | 0 | 148 |
| **Total** | | **1082** | **0** | **1082** |

Los cinco `PT_<ÁMBITO>` pasan de `Partial<Record<…>>` a `Record<…>`: una clave
nueva sin portugués ya no compila. Ni `diccionario.ts`, ni `errores-servidor.ts`,
ni `idiomas.ts`, ni ámbitos de otros lotes: el único código que cambia fuera de
`textos/` es el CSV del estado de cuenta (§5).

## 2 · Glosario: lo que el común (§2 bis) no traía

Todo el glosario común se respeta (ponto/tela, OS, PC, comprovação, Gráfica,
Captação de pontos, bloqueio de faturamento, Ref. interna, locador/aluguel/imóvel,
cobrança/fatura/pagamento parcial, extrato, lembrete de cobrança, Titular…). Lo
que fija este lote:

| Español | pt-BR | Por qué |
|---|---|---|
| ingreso · devengar | **receita** · «receita reconhecida» | el término contable brasileño |
| margen bruto · neto | **margem bruta** · **líquido/líquida** | |
| tarifa publicada · tarifa de lista | **tarifa de tabela** | en Brasil se vende «preço de tabela»; *publicada* no se dice |
| cuota (parcialidad) | **parcela** («em 6 parcelas») | |
| cuotas quincenales | «{n} parcelas, **duas por mês**» | el glosario prohíbe *quinzenal* (se confunde con la bissemana); con el número delante, «duas vezes por mês» se leía ambiguo (la lección H4 del italiano) |
| mensuales · bimestrales… | **mensais · bimestrais · trimestrais · semestrais · anuais** | adjetivo, como el italiano tras H4 |
| al corriente (cobranza) | **Em dia** | |
| cargo · abono (extrato) | **Débito · Crédito** | lo que dice un extracto bancario brasileño |
| folio de una factura | **Nº da fatura** | como el inglés «Invoice no.» y el italiano «N. fattura»; *Ref. interna* es el folio interno (campaña, PC, tramo) |
| nombre comercial | **nome fantasia** | el término legal brasileño exacto |
| tasa de cierre | **taxa de fechamento** | |
| hueco (Dashboard) | **espaço livre** («Espaços livres e renovações») | |
| tentativa (reserva) | **Provisória** | *tentativa* en portugués es «intento» |
| medio (quien vende el espacio) | **veículo** («Receita do veículo») | el término de mídia brasileño |
| reporte de cumplimiento | **relatório de veiculação** | ídem |
| reproducción (proof of play) | **exibição** | |
| enviar al dominio | **enviar para publicação** | como el inglés y el italiano: el «dominio» es el CMS |
| reanudar · bajar un creativo | **retomar** · **remover** | |
| bitácora (captación) | **histórico** | |
| embudo · giro · azotea | **funil · ramo de atividade · telhado** | |
| dueño del terreno | **dono do terreno** | no *proprietário*: es el rol (Titular) y la guardia del L5 lo prohíbe en todo el portugués |
| sin asignar (razón social) | **Não atribuída** | el glosario común; en la factura, «sem razão social» |
| licencia municipal · permiso ambiental · dictamen estructural | **Licença municipal · Licença ambiental · Laudo estrutural** | |
| incidencia · accidente | **ocorrência** · **acidente** | la lección H3 del italiano: *incidente* no |
| DOOHmain | masculino: «no DOOHmain», «ao DOOHmain» | la plataforma |
| desde / hasta (filtros) | **De / Até** | el glosario común |

## 3 · Clave por clave, lo no obvio

- **Fechas en hueco, sin preposición** (regla común): «Término: {fecha}»,
  «Sai {cliente} · {campana} · termina: {fecha}», «Em atraso até {fecha}»,
  «{n} fatura até {fecha}», «· prazo: {fecha}», «consultado: {fecha}»,
  «Nenhuma fatura nem pagamento de {desde} a {hasta}», «De {inicio} a {fin}».
  `inicio.alerta.cobertura.vence` dice «…vai até {hasta}, mas o contrato vence
  antes ({fin})»: la fecha va entre paréntesis y la frase dice lo que importa.
- **`finanzas.pagos.historico`**: la fecha fija va escrita como la pinta
  pt-BR: « · recebido antes de 8 de out. (aproximado)».
- **`{periodo}` y `{mes}`** no son fechas con día: «Receita de {mes}», «Ganho em
  {mes}», «Nenhuma fatura nem pagamento em {periodo}» («em setembro de 2026»,
  «em T3 2026») son correctas en portugués.
- **Plurales del motor de reportes** (`.uno` / `.una-de-varias` / `.otros`): la
  forma la elige `{total}` (1), `{estimadas}`/`{sin}` (1 de varias) o el resto,
  como en el italiano. `reportes.nota.ot.reales.uno` no lleva `{total}` (el
  español escribe «Las 1 visita»): «A única visita do período…».
  `reportes.nota.luz.faltan.*`: «Conta faltando / Contas faltando: {faltantes}
  de {esperados} do período», que no depende de que `{faltantes}` sea 1.
- **`clientes.captacion.ya-existe`**: «Este {tipo} já existe no sistema.» Los
  cuatro tipos (cliente, locador, imóvel, ponto) son masculinos: la trampa H1
  del italiano («Il immobile») no puede darse.
- **`clientes.filtro.*`**: la forma del italiano tras H5 — «Nenhum cliente
  encontrado{busqueda}{tipo}», con « para “{texto}”» y « entre as agências».
- **`clientes.captacion.falta.*`** dice lo mismo que `FALTA_REVISION_PT` del
  servidor (L5) **salvo `dueno`**: aquí «o dono do terreno: …», allí «o
  proprietário: …» (§9, para la costura).
- **`campanas.candado.monto-ilegible`** y el ejemplo «212,500.50»: dicen la
  verdad de HOY (el campo lee la cifra a la mexicana en portugués, P2). La tarea
  roja `feat/portugues-cifras` tiene que cambiar este aviso junto con los de
  `compartidos.cifra.*`. Texto propuesto: «O valor não foi entendido: o ponto
  separa os milhares e a vírgula, os decimais ({ejemplo}).»
- **`campanas.validacion.aviso-pantalla`**: «Lembre-se de não estar na página
  dentro do site do DOOHmain…» — *página*, no *tela*, para no chocar con la
  tela DOOH (la pantalla de la aplicación, glosario común).
- **`campanas.validacion.bajar.texto`** conserva el «{arte}(a API…» pegado del
  español (así sale en pantalla).
- **`campanas.etapa.*`, `campanas.evidencia.*` y `finanzas.comprobante.*` /
  `finanzas.comun.*` del papel**: son también papel (el portal, el comprobante).
  `textos/papeles-portugues.ts` no existe en este árbol (rama
  `feat/portugues-documentos`, sin integrar); su texto se copió de esa rama
  clave por clave, **con tres diferencias** que decide la costura (§9).
- **SAT**: «IVA», «RFC», «CFDI», «Uso do CFDI», «Folio fiscal (UUID do CFDI)»
  y los usos «G01 · Aquisição de mercadorias…» (las etiquetas de la ficha). El
  catálogo `USOS_CFDI` / `REGIMENES` del alta de cliente es DATO (el texto es el
  valor que se guarda) y sale en español en todos los idiomas, como en inglés e
  italiano.
- **El Dashboard**: solo textos. Ni una clase ni un nodo; la instantánea del
  HTML español sigue en verde y el volcado es/en/it, idéntico (§6).

## 4 · Cognados declarados

153 claves se escriben igual que en español o en inglés y están declaradas, con
su texto, en `COGNADOS_PT_L4` (`textos/portugues-l4.test.ts`): «Cliente»,
«Total», «IVA ({pct}%)», «Confirmada», «Publicada», «Pipeline», «Comercial»,
«Vendedor», «Trimestre», «Consumo», «Visitas», «Alertas», «Ver menos», «Semana»,
«Digital», «Contrato vencido», «snapshot», «Prospects», «Faces», «Sáb», «Dom»…
La prueba exige que sigan siendo iguales (si uno se traduce, se quita).

## 5 · El CSV del estado de cuenta (H4 de la validación de la ola 0)

En portugués sale **como el italiano**: separador «;» y coma decimal
(«5000,5»), lo que abre una Excel brasileña con doble clic. El importe sigue
siendo un NÚMERO (sin miles ni símbolo), la moneda va en el encabezado («MX$»,
«US$»), el periodo y las fechas en pt-BR («setembro de 2026», «10 de set. de
2026»), el archivo se llama `extrato-2026-09[-cliente].csv`, y un texto que
empieza por `= + - @` sigue neutralizado (también entre comillas, con «;»).

`estado-cuenta-csv.ts` no lee `comaDecimal()` (`lib/captura-cifra.ts`): esa es
la CAPTURA de cifras, que en portugués sigue a la mexicana hasta P2; el CSV es
el archivo que abre la Excel de quien lo baja. Español, inglés e italiano, byte
a byte los de antes (sus pruebas, sin tocar, en verde).

## 6 · Pruebas

- **Prueba estática `lib/i18n/textos/portugues-l4.test.ts`, en rojo primero**
  (commit `cf50ec9e`): con los cinco `PT_*` vacíos, **10 de 37 rojas** (cada
  ámbito sin portugués y sus plurales). Mira el diccionario entero, clave por
  clave: cada clave con portugués; ninguna igual al español o al inglés salvo
  los 153 cognados declarados; `.uno` ≠ `.otros`; los mismos huecos `{x}` que
  el español; ninguna fecha en hueco con «em/no/do/ao/pelo» (con los huecos del
  lote: `{corte}`, `{inicio}`…); **ninguna palabra que solo existe en español**
  («y», «campaña», «factura», «sin»…: el portugués a medias que las demás no
  ven); el glosario común (OS y no OT, PC y no OC, «ocorrência» y no
  «incidente», «código de negociação», ningún «proprietário»); y cada guardia,
  con su prueba de que muerde. La de tuteo, «proprietário» y fechas del L5
  (sobre todo `PT_PARCIAL`) también cubren este lote, en verde.
- **El CSV** (`estado-cuenta-csv-idioma.test.ts`): bloque portugués, rojo
  primero (5 de 7: solo separador y decimales; los textos ya estaban), byte a
  byte con y sin cliente, «;» entre comillas, fórmula neutralizada, USD,
  ninguna palabra española ni inglesa, ningún punto decimal, nombre del archivo.
- **Pantallas en portugués** en `pantallas-campanas-finanzas`, `-clientes`,
  `-reportes` y `-inicio` (los mismos estados del italiano): barrido del L5
  (`culpablesEnItaliano` sobre los diccionarios del lote, apartando
  `espanolPendienteDeOtrosLotes()`), la guardia nueva
  `palabrasEspanolasEnPortugues` (`lib/test/barrido-portugues-l4.ts`) y
  `huellasEnPortugues` estado por estado; frases esperadas («Valla Centro —
  vence em 1 dia (MX$ 1.000,00)», «Nenhuma fatura nem pagamento de 5 de jan. de
  2026 a 9 de mar. de 2026.»…); en el Dashboard, cifras de mil o más («1.500 de
  12.000 espaços · digitais 1.200/2.000 · fixos 1.100/1.300»); y el dinero en
  MXN y USD con su símbolo portugués. 317 estados nuevos. La etapa de Comercial
  negociación (L2) que pinta Captación se aparta por nombre
  (`espanolPendienteDe('comercial.negociacion.etapa.')`) y se vacía sola.

### Mutantes (13/13 mueren)

Aplicados de uno en uno con `scratchpad/pt-l4/mutar.js` contra las siete
pruebas del lote y restaurados (`git status` limpio). Contra unitarias; las e2e
no se mutaron (el lote no toca sesión, tenant, base ni dinero en base).

| # | Mutante | Muere en |
|---|---|---|
| M1 | `campanas.lista.titulo` = «Campañas» | estática + pantallas (9) |
| M2 | un `.uno` igual a su `.otros` | estática |
| M3 | «Termina em {fecha}» | estática L4 y L5 |
| M4 | «Sin movimento neste período» | estática + pantallas de reportes |
| M5 | «OT atrasada» | estática (glosario) |
| M6 | el CSV portugués con «,» | CSV (5) |
| M7 | el CSV portugués con punto decimal | CSV (2) |
| M8 | un hueco `{m}` en lugar de `{n}` | estática |
| M9 | un literal español sin `t()` en la lista de campañas | pantallas (9) |
| M10 | «Proprietário do terreno» | estática L4 y L5 |
| M11 | la guardia de palabras no mira nada | **sobrevivía**; ahora muere (prueba de que muerde, añadida) |
| M12 | tuteo («tu emitires») | estática L5 |
| M13 | «en los próximos» en el Dashboard | estática + pantallas del Dashboard |

## 7 · Español, inglés e italiano idénticos — medido

| Medición | Resultado |
|---|---|
| `DICCIONARIOS.es/.en/.it` + `traducirError(es/en/it)` (catálogo entero y 30 campos) + `PATRONES_ERROR` | JSON de 1 265 249 bytes antes (`72b33050`) y después: **`cmp` idénticos** (prueba temporal fuera del repo, retirada) |
| Volcado de TODA la suite (`I18N_VOLCAR_TODO`, sin `cifras-formularios.test.ts` ni `middleware.test.ts`, `--testTimeout=60000`) antes (`72b33050`, 417 archivos en verde) y después | 4823 → 5140 HTML. `diff -rq`: **1 distinto, portugués** (el portal del cliente del L5 en `pt`, que ahora pinta las etapas y la galería en portugués); 0 desaparecidos; 317 nuevos, todos de los estados portugueses nuevos; `_italiano.txt` ordenado idéntico |
| Fuentes | fuera de los cinco `PT_*` solo cambia `estado-cuenta-csv.ts`, con es/en/it byte a byte (sus pruebas, sin tocar) |
| El Dashboard | instantánea del HTML español (`__snapshots__`) en verde, sin regenerar |

## 8 · Espejo (`I18N_VOLCAR_PT`)

Sobre toda la suite: 2147 estados, **309 huellas en 39 estados**, las mismas de
la ola 0 y del L5 y en los mismos tres archivos (`pantallas-comercial` 12,
`-inventario-arrendadores` 18, `-propuestas` 9: P2 y P3). **Ninguna en las
cuatro pantallas del lote.** Las pruebas portuguesas nuevas aplican además
`huellasEnPortugues` estado por estado, con dos permitidos declarados: el
ejemplo de captura «212,500.50» del bloqueo de faturamento (la captura sigue a
la mexicana, P2) y el folio de tramo «CA-0001.1» (un dato), los mismos del
italiano.

## 8 bis · Suites y recuentos (medidos en este árbol)

- `cd apps/web && npm run typecheck`: limpio.
- `cd apps/web && npm test`: con la máquina cargada (cuatro lotes en
  paralelo) 10 rojas por el tope de 5 s en archivos ajenos al lote; con
  `--testTimeout=60000`, **420 archivos, 9222 en verde + 1 omitida, 0 rojas**.
- `coberturaPortugues()`: las cinco filas del lote, **0 pendientes** (1082);
  total del portugués, 3515 pendientes (L1–L3).
- `node scripts/recuentos.mjs`: 118 notas, 1680 enlaces, 3 wikilinks rotos
  (los ADR de siempre), 0 huérfanas.
- Sin e2e ni build: el lote no toca sesión, tenant, migraciones ni dinero en
  base (el CSV es un archivo de descarga).

## 9 · Para la costura

- **Los papeles (P3, `feat/portugues-documentos`).** `papeles-portugues.ts` no
  está en este árbol. De sus 33 claves de los ámbitos del lote (13 etapas,
  6 de la galería, 5 de `finanzas.comun`, 9 del comprobante), 30 se copiaron
  igual y **3 difieren** (la costura `papeles-portugues.test.ts` las pondrá en
  rojo; alguien decide):

  | Clave | Lote | Papel | Por qué el lote |
  |---|---|---|---|
  | `campanas.evidencia.vacia.texto` | «As fotos de comprovação são enviadas ao encerrar a OS no celular.» | «As evidências são enviadas…» | glosario común: evidencia → *comprovação* |
  | `campanas.evidencia.alt` | «comprovação» | «evidência» | ídem |
  | `finanzas.comun.folio` | «Nº da fatura» | «Número» | es la columna de las facturas, del CSV y del comprobante; «Número» suelto no dice de qué |

- **`clientes.captacion.falta.dueno`** («o dono do terreno: …») y su gemelo del
  servidor `FALTA_REVISION_PT` (L5, «o proprietário: …»): el mismo texto lo
  arma el cliente (`faltantesParaRevision`) y el servidor. Propuesta: el
  servidor también «o dono do terreno», y la guardia de «proprietário» del L5
  puede entonces mirar las tablas de huecos.
- **`campanas.candado.monto-ilegible`**: lo reescribe `feat/portugues-cifras`
  (texto en §3).
- **`costura.test.ts`** no se extiende aquí (el encargo lo deja a la costura).
  «Vencida» del lote: «Vencida» (la cobranza) y «Atrasada» (`campanas.listas.vencida`,
  la OS), como el italiano «Scaduta/Scaduto»; «Pantalla»: «Ponto» (reportes,
  captación) y «Tela» (columna de DOOHmain), el glosario.
- **`lib/test/barrido-portugues-l4.ts`** lleva el nombre del lote para no pisar
  los barridos de L1–L3; la costura puede unificar su lista de palabras.
- **Otros lotes que se ven en estas pantallas, aún en español**: la etapa de
  Comercial negociación en Captación (L2: «Contactado», «Visita», «En
  revisión»…), el tipo de OT «Instalación» en la ficha (L3). Las pruebas los
  apartan por nombre (`espanolPendienteDe`) o por trozo largo, y se vacían
  solos cuando esos lotes traduzcan.

## 10 · Dudas para el dueño

Decididas por el traductor con su porqué; el dueño puede cambiarlas:

1. **«Captação de pontos» como título de la página** (el menú del L5). La
   página lleva también clientes («Clientes, locadores, imóveis e pontos…»).
   Si se quiere un título que cubra los dos, «Captação» a secas o «Prospecção».
2. **Tarifa publicada = «tarifa de tabela».** Alternativa: «tarifa cheia».
3. **Cuotas quincenales = «{n} parcelas, duas por mês».** El italiano acabó en
   «quindicinali»; en portugués «quinzenais» chocaría con la bissemana, que es
   lo que el glosario quiso evitar.
4. **Tentativa = «Provisória»** (reserva y la gráfica del Dashboard). L2
   (propuestas, comercial) tiene el mismo término: que lo iguale la costura.
5. **«Nome fantasia»** para el nombre comercial (el término legal brasileño)
   y **«veículo»** para el medio: términos del mercado brasileño, no calcos.

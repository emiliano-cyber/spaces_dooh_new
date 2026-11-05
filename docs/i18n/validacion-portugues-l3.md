# Validación · Lote L3 del portugués (inventario, arrendadores y operaciones)

**Fecha:** 2026-11-05 · **Rama:** `feat/portugues-l3-inventario` (`01723cbd`), sobre
`integra/portugues` en su punto de salida (`72b33050`) · **Revisión del traductor:**
`docs/i18n/revision-portugues-l3.md` · Validador independiente: solo lee y mide;
no corrige. Todo lo de abajo está medido en este árbol.

## Veredicto: ÁMBAR

La maquinaria está **limpia**: es/en/it byte a byte idénticos, typecheck limpio, la
suite entera en verde, las 1186 claves con portugués y una prueba estática que
muerde (5 de mis 7 mutantes mueren; los otros dos son huecos de prueba, H6). La lectura de
las 1186 claves deja un portugués de oficio, natural para un gestor de locações
y para una equipe de campo, con el glosario común respetado.

Lo que impide el VERDE es **una frase que dice lo contrario que el español sobre
el candado de facturación** (H1): al cerrar una OS, la tarjeta verde con el
candado abierto dice «Bloqueio de faturamento **ativado**», cuando el español,
el inglés («Billing lock open») y el italiano («Fatturazione sbloccata») dicen que
la facturación queda **liberada**. Es de una línea, pero es un aviso de dinero
y candado y **no se integra sin corregirlo**. El resto son de gravedad media o
baja.

## 1 · Mediciones

| Medición | Resultado |
|---|---|
| `cd apps/web && npm run typecheck` | limpio |
| `cd apps/web && npx vitest run --testTimeout=60000` | **420 archivos, 9012 en verde + 1 omitida, 0 rojas** (con el timeout ampliado la semilla del catálogo pasa) |
| `DICCIONARIOS.es/.en/.it` + `traducirError(es/en/it)` sobre `CATALOGO_ERRORES`, `CAMPO_EN` y `FALTA_FIRMA_EN` | volcado JSON con los cuatro `textos/` del lote en `72b33050` y en `HEAD` (prueba temporal, retirada): **1 280 736 bytes, `cmp` idénticos** |
| Diff de fuentes `72b33050..HEAD` en los cuatro `textos/` | las únicas líneas retiradas son los cuatro `PT_* = {}` y su comentario de la ola 0. **Ninguna línea ES, EN ni IT** |
| `NuevaPantallaForm.tsx` | el único cambio es `idioma === 'it' \|\| idioma === 'pt'`: es/en siguen con el literal `preview` (lo fijan `pantallas-inventario-arrendadores.test.ts:1891-1892`, y mi mutante V3 lo confirma) |
| La constancia contra `integra/portugues` (`2e2a62e1`, `papeles-portugues.ts:33-50`) | **las 13 claves coinciden letra por letra**, incluida `.intro` («Data do selo: {fecha}. Este documento foi assinado eletronicamente…»). La costura no tiene nada que decidir aquí (ver duda 5) |
| Las dos pruebas del L5 con «Pantalla digital» en ignorados | quitado el ignorado, caen **5 pantallas** (Network; portal del cliente; propuesta pública pendiente, aceptada y vencida), todas por `comercial.tipo-medio.pantalla-digital` (L2). Ninguna clave en español de los diccionarios del L5 (admin, compartidos, shell, cuenta, notificaciones, base) contiene «Pantalla digital», así que el ignorado **no tapa ninguna fuga del L5**. Va para todas las pantallas del bucle y no solo para las cinco, pero el coste es nulo: **no está más debilitado de lo necesario** |
| Árbol al terminar | `git status` limpio (los mutantes y las pruebas temporales, restaurados) |

No repetí el volcado `I18N_VOLCAR_TODO`: el `cmp` de los diccionarios, el diff de
fuentes sin líneas es/en/it y el único cambio de componente (protegido por prueba)
lo hacen redundante para este lote.

### 1.1 · Mutantes propios (contra `lib/i18n/textos/`, las tres pruebas de pantallas del lote y `catalogos-portugues`)

| # | Mutante | Resultado |
|---|---|---|
| V1 | `operaciones2.ficha.cerrar` vuelve a «Cerrar OT» | **muere** (3) |
| V2 | «locado até **o dia** {fin}» en `inventario.wizard.arrendado-hasta` | **muere** (2) |
| V3 | el `alt` del alta sale del diccionario para todos salvo `en` (`idioma !== 'en'`) | **muere** (1: es deja de decir `preview`) |
| V4 | `operaciones2.ficha.candado-encendido` = «Faturamento liberado» (la corrección de H1) | **sobrevive**: nada fija el sentido de esa frase; corregir H1 no rompe ninguna prueba |
| V5 | `arrendadores.cuadre.emplazamientos.uno` = «{n} locais» | **muere** (2) |
| V6 | `arrendadores.comun.renta` = «Renta» | **muere** (2) |
| V7 | los días del calendario «D,S,T,Q,Q,S,S» (semana desde el domingo) | **sobrevive**: nada fija el orden; el actual «S,T,Q,Q,S,S,D» es el correcto (la rejilla empieza en lunes, como el «L,M,M,J,V,S,D» español) |

5 de 7 mueren; las dos que sobreviven son huecos de prueba, no defectos (H6).

## 2 · Sentido en portugués

Leídas **las 1186 claves**, español y portugués lado a lado: arrendadores (444,
enteras: contratos, pagos de aluguel, firmas, constancia, licencias, conciliação),
operaciones2 (205, enteras: OS, ficha, costo, criativos), operaciones (177,
enteras: disponibilidade, almoxarifado, gráfica) e inventario (360, enteras), y en
contexto el componente donde una frase era dudosa (`OTVista.tsx`,
`PagosRentaCard.tsx`, `ContratoSheet.tsx`, `disponibilidad/page.tsx`). Sin
español colado, sin tuteo, sin « », OS en femenino en todas partes, plurales de
verdad, huecos intactos.

### 2.1 · Hallazgos

| # | Dónde | Clave | Texto actual | Problema | Propuesta | Gravedad |
|---|---|---|---|---|---|---|
| H1 | `apps/web/lib/i18n/textos/operaciones2.ts:870` | `operaciones2.ficha.candado-encendido` | «Bloqueio de faturamento ativado» | **Dice lo contrario.** Sale al cerrar la OS en una tarjeta verde con el icono `LockOpen` (`components/operaciones/OTVista.tsx:767-771`): el candado se **abre** y la facturación queda **liberada** (EN «Billing lock open», IT «Fatturazione sbloccata»). Un brasileño lee «se activó el bloqueo de la facturación». El glosario del lote lo cita como ejemplo (`docs/i18n/revision-portugues-l3.md:63`), así que es un malentendido, no un desliz | «**Faturamento liberado**» (o «Faturamento desbloqueado»); corregir también el ejemplo de la revisión §2. Y una prueba que lo fije (V4 sobrevive): la frase en el estado «OS encerrada» de `pantallas-operaciones2.test.ts` | **ALTA** (aviso de dinero y candado al revés; bloquea la integración) |
| H2 | `apps/web/lib/i18n/textos/arrendadores.ts:1717-1718` | `arrendadores.alta.fiscales-ayuda` | «É quem fatura o aluguel.» | Español, inglés e italiano dicen «es **a quien se le** factura la renta» («who the rent is invoiced **to**»); el portugués dice lo contrario («quien **emite** la factura»). El portugués probablemente describe mejor lo que hace el sistema (`razones.sub`: «a nombre de quién factura cada arrendador»), pero un aviso fiscal no debe decir una cosa en un idioma y la contraria en otro | Una frase que valga para las dos lecturas: «**É o nome que aparece na fatura do aluguel.**» Y que el dueño decida si el español está mal (es decisión aparte; no la toma este lote) | MEDIA |
| H3 | `apps/web/lib/i18n/textos/arrendadores.ts:1973-1974` | `arrendadores.pagos.vencidas.uno/.otros` | «{n} atrasada ({monto}) · » / «{n} atrasadas» | Femenino sin sustantivo: en español va implícita «renta» (fem.), pero en portugués *aluguel* es masculino y «1 atrasada» queda colgando. El italiano lo resolvió con el sustantivo («1 rata scaduta») | «{n} **parcela atrasada** ({monto}) · » / «{n} **parcelas atrasadas** ({monto}) · » | BAJA |
| H4 | `apps/web/lib/i18n/textos/operaciones.ts:649` y `:651` | `operaciones.disponibilidad.kpi.en-periodo`, `.kpi.no-llenas` | «em {periodo}», «não lotados em {periodo}» | `{periodo}` es una fecha: «mar. de 2026» o, por bissemana, «1/3–14/3» (`disponibilidad/page.tsx:45-56`). «em 1/3–14/3» es justo lo que la regla común prohíbe; la prueba del lote no lo ve porque `periodo` no está en `NOMBRE_DE_FECHA` (`portugues-l3.test.ts`) | «**no período {periodo}**», «não lotados **no período** {periodo}»; y añadir `periodo` a `NOMBRE_DE_FECHA` | BAJA |
| H5 | `apps/web/lib/i18n/textos/arrendadores.ts:1713` y `:1743` | `arrendadores.alta.domicilio-ph`, `arrendadores.lista.domicilio-ph` | «…bairro, código postal, cidade…» | El glosario común dice CP = **CEP** («CEP fiscal», §2 bis); «código postal» se entiende pero no es lo que escribe un brasileño en un formulario | «Rua, número, bairro, **CEP**, cidade, estado» (y sin «estado» en la lista) | BAJA |
| H6 | `apps/web/lib/i18n/pantallas-operaciones2.test.ts` (estado «OS encerrada», l. ~897) y `textos/portugues-l3.test.ts` | — | — | Huecos de prueba: V4 (el sentido del candado al cerrar) y V7 (el orden de los días) sobreviven. Es lo que dejó pasar H1 | Añadir «Faturamento liberado» a las frases del estado cerrado (o una aserción que lo fije en la estática); opcional, fijar `operaciones.calendario.dias` | BAJA (prueba) |

### 2.2 · Lo que leí con lupa y está bien

- **Lei do Inquilinato:** locador / locatária / contrato de locação / aluguel /
  caução / imóvel, en todas partes; «O LOCADOR / O LOCATÁRIO» en la constancia,
  como P3. «Renovação automática», «vigência», «término» correctos.
- **Pagos de aluguel:** «Atrasado / A vencer / Pago / Programado», «Data do
  pagamento» (cabecera sin hueco), «Pago: {fecha} · transferência.» (el método
  llega con « · » delante, `ContratoSheet.tsx:1135-1140`), «Forma de pagamento»,
  «Dinheiro / Cartão / Cheque». Las reglas de dinero coinciden con el español:
  «não entra no total: já não gera aluguel», «o custo real é maior», «não conta
  como custo na DRE nem gera calendário de pagamentos», «Alterá-lo para {monto}
  vale para todos».
- **Firmas:** «congela … e o sela com SHA-256», «o que se assina é essa versão, e
  não “o que estiver no banco de dados”», «trate-o como uma credencial», «Vence:
  {fecha}», «{parte}: assinado por {nombre} · {fecha}», «assinatura de próprio
  punho». Las reglas de archivar/anular firmas dicen lo mismo que el español.
- **OS y equipe de campo:** «Nova OS», «OS atrasada», «Encerrar OS», «Prazo»,
  «mantêm o faturamento bloqueado» (correcto: ahí el candado **está** cerrado),
  «Tirar foto», «Registrar localização», «Carimbo de localização», «Foto de
  comprovação», «Serralheria», «Instalação / Desinstalação». El aviso de costo al
  cerrar («não poderá mais registrá-lo depois», «fica fixo») dice la misma regla.
- **Fechas en hueco:** sin preposición en todas las del lote salvo H4.
- **Plurales nuevos** que el español no distingue («1 linha lida», «1 código já
  existe», «1 imagem carregada»): bien.
- **Avisos de captura** («a vírgula separa os milhares e o ponto, os decimais»):
  dicen la verdad de hoy, como manda el encargo; los reescribe `feat/portugues-cifras`.

## 3 · Opinión sobre las dudas para el dueño (§10 de la revisión), sin decidir

1. **valla = Outdoor, espectacular = Painel, muro = Empena, puente = Passarela.**
   Desde el uso brasileño, bien elegidas: *outdoor* es en Brasil el cartel de papel
   9×3 a pie de calle, que es la valla mexicana; *empena* es exactamente el muro
   ciego pintado o con lona; *passarela* es como se vende la publicidad en puentes
   peatonales. *Painel* para el espectacular es lo natural (el mercado dice
   «painel», «painel rodoviário», «front-light»). Único roce: «painel» también
   aparece como el panel de DOOHmain en Creativos («remova-a no painel dele»);
   en contexto no confunde. Yo no lo cambiaría a una sola familia.
2. **«Bairro / região»** para «Distrito / alcaldía»: correcto; el buscador por
   *bairro* es lo que un brasileño espera. «região» cubre la alcaldía sin
   inventar una equivalencia administrativa.
3. **«Plaqueta / número de patrimônio»**: es el término exacto del control
   patrimonial brasileño («plaqueta de patrimônio»). De acuerdo.
4. **«Alvará municipal», «laudo estrutural», «licença ambiental»**: son los nombres
   que un gestor brasileño reconoce, y el título «Licenças e alvarás» los recoge.
   Que la autoridad sea mexicana no estorba: son etiquetas de tipo de papel.
5. **La intro de la constancia**: ya no hay que elegir. En `integra/portugues`
   (`2e2a62e1`) `papeles-portugues.ts` quedó con **el mismo texto que este lote**
   («Data do selo: {fecha}. Este documento foi assinado eletronicamente…»), y las
   13 claves coinciden. Como lectura brasileña, «Data do selo: …» suena a
   etiqueta de formulario, aceptable en una constancia; «selado em {fecha}» sería
   más natural con una fecha completa, pero rompe la regla común y no compensa
   reabrirlo.

## 4 · Para el traductor (si corrige)

H1 es obligatoria antes de integrar (y su prueba, H6). H2 conviene corregirla a
la vez (una línea). H3–H5 son de una línea cada una. Ninguna toca es/en/it.

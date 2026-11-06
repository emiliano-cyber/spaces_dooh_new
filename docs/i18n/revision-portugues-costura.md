# Revisión · La costura del portugués (pt-BR)

Rama `feat/portugues-costura`, que sale de `integra/portugues` (`2e2a62e1`: ola 0
+ L5 + P3). Fecha: 2026-11-05. Sin validar. Tablero en
`vault/03-Frontend/portugues-olas.md` (§2 ter); glosario común final en su §2 bis.

## 1 · Lo que se integró

`git merge --no-ff`, uno por commit, en el orden pedido:

| Lote | Rama (punta) | Commit de la fusión | Conflictos |
|---|---|---|---|
| L2 · Comercial y propuestas | `feat/portugues-l2-comercial` (`9744a483`) | `6ea4fadf` | diario del 05/11 |
| L3 · Inventario, arrendadores y operaciones | `feat/portugues-l3-inventario` (`0646bdd3`) | `f7d1a458` | diario, `portugues-olas.md` |
| L4 · Campañas, finanzas, clientes, reportes y Dashboard | `feat/portugues-l4-campanas` (`0a06fe95`) | `32d1f701` | diario, `portugues-olas.md` |
| L1 · Space Eyes y luz | `feat/portugues-l1-spaceeyes` (`2e80948a`) | `6b0e2883` | diario, `portugues-olas.md` |

Todos los conflictos fueron de documentación (la fila de agentes activos y las
entradas de «Completado» del diario; el frontmatter, la fila de estado, la
sección de cada lote y la línea de cobertura del tablero). Se conservaron todos
los lados. Al resolver el del L3 se perdió la línea en blanco entre las dos
tablas de la ola 1; se devolvió en la fusión del L4. El código no chocó en
ningún archivo (`catalogos-portugues.test.ts`, que tocaban L1 y L3, se fusionó
solo). Salida de cada `git merge` leída entera; al final
`git grep -l "^<<<<<<< HEAD$"` sale vacío.

Tras las cuatro fusiones, 3 pruebas rojas, las previstas por las validaciones
de L2 y L4: `papeles-portugues.test.ts` (los choques de papel y el «Nº P-1» del
correo) y `cobertura-portugues.test.ts` («fuera del L5, solo lo de los papeles»).
Se arreglaron en los commits de la costura, no en las fusiones.

## 2 · Los papeles (`papeles-portugues.ts`) — commit `e2ba6d53`

De las 151 claves que P3 escribió aparte, **las 151 estaban ya en su
`PT_<AMBITO>`**: 138 iguales y 13 distintas, todas por el glosario común (gana el
lote):

| Clave | P3 | Lote (queda) |
|---|---|---|
| `propuestas.documento.pantallas` / `.col.pantalla` / `.sin-coords`, `propuestas.ficha.mapa`, `propuestas.correo.cuerpo` | tela(s) | ponto(s) |
| `propuestas.comun.bruto-lista` | Bruto (tabela de preços) | Bruto (preço de tabela) |
| `comercial.tipo-medio.espectacular` / `.valla` | Outdoor / Painel | Painel / Outdoor |
| `campanas.evidencia.vacia.texto` / `.alt` | evidências / evidência | fotos de comprovação / foto de comprovação |
| `finanzas.comun.folio` | Número | Nº da fatura |
| `finanzas.comprobante.aviso` | carimbado | timbrado |
| `propuestas.correo.folio` | Nº {folio} | **Nº {folio}** (el lote decía «Ref. interna»; decisión del dueño, abajo) |

Así que **el archivo se eliminó** y `diccionario.ts` dejó de mezclarlo: un solo
sitio por clave. `coberturaPortugues()` vuelve a contar cada fila con su propio
`PT_<AMBITO>` (entre P3 y la costura contaba también lo escrito aparte).

**El folio del cliente es «Nº»** (decisión del dueño del 05/11): el correo de la
propuesta dice «Nº P-1» y el comprobante «Comprovante Nº {folio}». Dentro de la
app sigue «Ref. interna» (ficha y tablero de propuestas). El documento
imprimible y `/p` pintan el folio sin rótulo, como en español: no hay texto que
cambiar.

`papeles-portugues.test.ts` ya no compara dos archivos: exige que las **169**
claves que pinta un papel (las 151 de P3 y las que cubren sus patrones) estén en
el `PT_<AMBITO>` de su ámbito, y fija la regla del folio.

## 3 · Cobertura total

`cobertura-portugues.test.ts` sustituye las pruebas de transición (`FILAS_L5` y
«fuera del L5, lo traducido es exactamente lo de los papeles») por dos: **0
pendientes en TODAS las filas** y **cada ámbito cubierto por su propio
`PT_<AMBITO>`**.

| | Claves | Con portugués | Pendientes |
|---|---:|---:|---:|
| 21 ámbitos de `textos/` + base | 5634 | 5634 | 0 |
| Errores del servidor (catálogo 205, campos 30, firma 12, patrones 62) | 309 | 309 | 0 |
| **Total** | **5943** | **5943** | **0** |

## 4 · Decisiones del dueño y gemelos con el servidor — commit `40b50f12`

- **«Captação»** a secas en el menú (`nav.captacion`) y en el título
  (`clientes.captacion.titulo`).
- **«Pré-reserva»** en vez de «Provisória»: `campanas.reserva.tentativa`
  «Pré-reserva», `inicio.grafica.tentativas` «Pré-reservas»,
  `comercial.reserva.reservar` «Pré-reservar».
- **«o dono do terreno»** también en el servidor (`FALTA_REVISION_PT` decía «o
  proprietário»). La guardia de «proprietário» del L5 mira ahora también las
  tablas de huecos.
- **«CEP inválido (5 dígitos)»** en el campo (`clientes.form.cp-invalido`) y en
  el servidor a la vez (H9 del L4): el rótulo ya decía «CEP fiscal». «(5
  dígitos)» dice que es el código mexicano, no el CEP brasileño de 8. Sale de las
  listas de cognados de L4 y L5.
- «o app» en masculino, fijado en `portugues-comun.test.ts` y en el §2 bis.

Prueba nueva `textos/portugues-comun.test.ts`: rojo a la vista, 4 de 5, antes de
tocar los textos.

## 5 · Fuera las listas de español pendiente — commit `50f482b8`

Con los cinco lotes dentro, nada cae al español. Se quitaron:

- `espanolPendienteDeOtrosLotes()` (L5), en las catorce pruebas de pantallas;
- `espanolPendienteDe(prefijo)` (L4), las etapas de Comercial negociación en
  Captación;
- «Pantalla digital» (L2) en `pantallas-admin` y `pantallas-cuenta-shell`;
- seis etiquetas cortas del L2 (`AJENOS_CORTOS_PT`) en
  `pantallas-inventario-arrendadores`; quedan dos datos de verdad (una columna de
  la plantilla y un correo de ejemplo);
- el veredicto de la foto (`comercial.eye.*`, L2) en `COMUNES_PT` y `DATOS_PT`
  de `pantallas-spaceeyes`;
- «En producción» (L4) en `pantallas-operaciones` y «Pendiente / En proceso» (L4)
  en `pantallas-operaciones2`;
- y las dos pruebas del L5 que vigilaban `espanolPendienteDeOtrosLotes()`.

Las pruebas siguen en verde sin apartar nada que no sea un dato de su prueba.
`barrido-portugues-l4.ts` se unió a `barrido-portugues.ts`: queda un solo
ayudante (la guardia de palabras solo españolas, `palabrasEspanolasEnPortugues`).

## 6 · Guardias comunes — commit `77406ba1`

En `textos/portugues-comun.test.ts`, sobre todo `PT_PARCIAL` y los catálogos del
servidor (catálogo, lib, campos, firma, periodicidad, etapa, faltantes,
patrones):

| Guardia | De dónde | Qué cazó (rojo primero) | Qué se hizo |
|---|---|---|---|
| Portugués de Portugal (ecrã, aplicação, ficheiro, utilizador, registo, «a app», «já não») | L1 | «já não gera aluguel» (L3, ×2) | «não gera mais aluguel» |
| Tuteo (pronombres; «Tenta/Escolhe…»; «Revisa/Usa/Completa/Verifica/Ajusta» con mayúscula o enclítico) | L5 + L4 | «Usa o do ponto se você deixar em branco» (L3); «Usa o valor padrão» (L5) | el primero, «Se você deixar em branco, vale o do ponto»; el segundo es el ESTADO de un costo en 3.ª persona («Uses the fallback»): excepción declarada |
| Palabras solo españolas | L4 | 25 falsos positivos | la regla ya no mira detrás de un guion («lê-los», «alterá-las» son pronombres portugueses); fuera «fecha», «subir» y «guardar», que también son portugués; **sin «alta» ni «pago»** (avisado por la validación del L4: también son portugués; el L4 los sigue vigilando en su lote). Una ruta de la API citada en un mensaje del servidor, excepción declarada |
| Fechas en hueco (por el NOMBRE del hueco: `fecha*`, `*Fecha`, `fin*`, `inicio*`, `desde`, `hasta`, `vence*`, `cuando`, `dia`, `periodo`, `corte`) | L3 (la más amplia) | «Nenhuma fatura nem pagamento em {periodo}» (L4) | «no período {periodo}», como el H4 del L3 |

Cada guardia lleva su prueba de que muerde y de que deja pasar el portugués de
Brasil.

## 7 · `costura.test.ts` al portugués — commit `7e99c525`

Como el italiano: el mismo español en dos lotes se dice igual. Rojo primero:
**38 divergencias**, 2 de moneda (falsos positivos de la regla: «dispositivos
reais», «Peso da fonte») y 4 gemelos con el servidor.

**Unificadas (24 claves):**

| Español | Queda | Cambió en |
|---|---|---|
| Renta al arrendador | Aluguel ao locador | `inventario.alta.renta` |
| Cada cuándo se paga | Periodicidade do pagamento | `arrendadores.completar.cada-cuando` |
| Mostrar | Mostrar | `campanas.menu.boton.mostrar` (era «Exibir») |
| La imagen / El archivo supera {mb} MB | A imagem / O arquivo excede {mb} MB | `operaciones2`, `arrendadores` |
| evidencia (alt) | foto de comprovação | `operaciones2.ficha.evidencia-alt` |
| otra franja | outra faixa horária | `campanas.horario.otra-franja` (gemelo del servidor) |
| Horario de transmisión | Grade de programação | `campanas.horario.titulo` (glosario del L2, aprobado) |
| «…quítalo en su panel» | remova-a no painel de lá | `operaciones2.creativos.retirado-doohmain` |
| hace segundos | há poucos segundos | `comercial.comun.hace.segundos` |
| Desmontaje | Desinstalação | `admin.tipo-ot.desmontaje` (montaje = instalação) |
| Ninguna pantalla coincide con el filtro. | Nenhum ponto corresponde ao filtro. | `arrendadores.rentabilidad.sin-filtro` |
| Hora | Hora | `admin.actividad.hora` (era «Horário») |
| Quitar filtros | Limpar filtros | `inventario.tabla.quitar-filtros` |
| Tarifa publicada | Tarifa de tabela | `inventario.wizard.tarifa-publicada` (glosario aprobado) |
| Licencias y permisos · Licencia municipal · Permiso | Licenças e alvarás · Alvará municipal · Licença | `inicio.*` (glosario aprobado) |
| la prima del Roadblock | «Só um gerente ou um perfil superior pode pôr acréscimo em um Roadblock.» | `propuestas.calc.prima.no-puede` y el servidor («num» → «em um») |
| el tope de reportes | «…Reduza o intervalo de datas.» | `reportes.motivo.tope` (gemelo del servidor) |
| Ej. | Ex.: | los cuatro «p. ex.» del L4 (`clientes.*`), uno gemelo del servidor |

**Declaradas (20 textos)** en `DISTINTOS_A_PROPOSITO_PT`, cada una con su porqué
en la prueba: `Pantalla` y `Guardar pantalla` (ponto / tela), `Sitio` (ponto /
local), `Lista` (Lista / Tabela), las concordancias `Fija` (Fixo / Fixa),
`Todas` (Todas / Todos), `Automática` (Automática / Automático), `Sin asignar` y
`— Sin asignar —` (Não atribuída/o / Sem responsável), `Vencida(s)` (Vencida /
Atrasada), `a` y `{desde} a {hasta}` (a / às), `Siguiente` (Avançar / Próxima),
`Fin` (Término / Fim), `Operación` (Operações / Operação), `No` (el «No» del
Raspberry Pi Imager), `Teléfono` (Celular / Telefone) y `{n} nueva(s)` (novidade
/ novo). Las del inglés se heredan; las de concordancia del italiano no (el
género portugués no es el italiano).

Además, en la misma prueba: comillas curvas en todo el portugués, ninguna moneda
dada por hecha («peso da fonte» declarado) y «Ex.:», nunca «p. ex.».

## 8 · Medido

| Medición | Resultado |
|---|---|
| `cd apps/web && npm run typecheck` | limpio |
| `npx vitest run --testTimeout=60000` | **426 archivos, 9905 en verde + 1 omitida, 0 rojas** |
| `DICCIONARIOS.es/.en/.it` + `traducirError` es/en/it + patrones, contra `2e2a62e1` | **`cmp` idénticos** (1 570 782 bytes) |
| Volcado `I18N_VOLCAR_TODO` de toda la suite (sin `cifras-formularios`), contra `2e2a62e1` | 4824 → 5712 HTML; **0 HTML de es/en/it distintos, nuevos o desaparecidos**. Los 15 distintos y los 888 nuevos están todos en `_portugues.txt`; `_italiano.txt` ordenado, idéntico |
| Espejo `I18N_VOLCAR_PT` de toda la suite (sin `cifras-formularios` ni `middleware`) | 2147 estados; **184 huellas en 33 estados** (eran 309 en 39 en la ola 0), todas explicadas: documento imprimible 3/79 y contrato 14/77 (papeles en el idioma de la instancia, ADR 0049), ejemplos de captura del alta de ponto 12/24 (P2, captura a la mexicana) y «Mozilla/5.0» 4/4 (un dato) |
| `coberturaPortugues()` | 5943/5943, 0 pendientes |
| `git grep -l "^<<<<<<< HEAD$"` | vacío |

### Mutantes propios (contra unitarias; restaurados, árbol limpio)

| # | Mutante | Resultado |
|---|---|---|
| M1 | el folio del correo vuelve a «Ref. interna» | muere (2) |
| M2 | el menú vuelve a «Captação de pontos» | muere (1) |
| M3 | el servidor vuelve a «o proprietário» | muere (2) |
| M4 | la reserva vuelve a «Provisória» | muere (1) |
| M5 | vuelve «já não gera» | muere (1) |
| M6 | vuelve «em {periodo}» | muere (1) |
| M7 | el horario de transmisión vuelve a divergir | muere (1) |
| M8 | el servidor vuelve a «Código postal inválido» | muere (1) |
| M9 | el tipo de medio «Pantalla digital» en español (lo que antes se apartaba) | muere (10) |
| M10 | una clave de papel vacía en su lote | muere (9) |
| M11 | vuelve «Usa o do ponto…» (tuteo fuera del lote del L4) | muere (1) |
| M12 | vuelve «p. ex.» | muere (2) |

**12/12 muertos.** M9 es el que justifica vaciar las listas: con
`espanolPendienteDeOtrosLotes()` o «Pantalla digital» en `ignorar`, ese español
habría pasado.

Sin e2e: la costura no toca sesión, tenant, base ni dinero (solo textos y
pruebas).

## 9 · Lo que queda

- Llevar esta rama a `integra/portugues` (validada VERDE, §10).
- **La tarea roja de cifras** (`feat/portugues-cifras`, P2): teclear a la
  brasileña, reescribir `compartidos.cifra.*` y `campanas.candado.monto-ilegible`
  (texto propuesto en la revisión del L5 §3 y del L4 §3). Se llevará las 24
  huellas de los ejemplos de captura del espejo.
- **El recorrido en el navegador**, pantalla por pantalla, con su validador. Lo
  que conviene mirar ahí: las frases unificadas largas («Grade de programação»
  como título en la ficha de campaña, «Pré-reservar» como botón, «Licenças e
  alvarás» en el Dashboard), que el ancho de los botones y las columnas aguante
  el portugués, y los papeles (correo «Nº P-1», comprobante «Comprovante Nº …»)
  en una instancia con documentos en `pt`.
- `IDIOMA_PORTUGUES` sigue **apagado**.

## 10 · La validación (VERDE) y sus cuatro hallazgos bajos, cerrados

Expediente: `docs/i18n/validacion-portugues-costura.md` (`ea82b8ef`). Rojo primero
en los cuatro; ninguno toca es/en/it.

| # | Hallazgo | Corrección | Prueba |
|---|---|---|---|
| H1 | «Tarifa publicada» en cuatro textos de Comercial (`comercial.ficha.tarifa-publicada`, `.tarifas-unidad.vacio`, `comercial.editar.tarifa`, `comercial.alta.tarifa`) | «Tarifa de tabela» | `costura.test.ts`: el glosario **por palabra** (no solo por español idéntico): si el español dice «tarifa publicada / de lista», el portugués dice «de tabela», y «tarifa publicada» no sale en ningún sitio |
| H2 | «horário de exibição» en el error de lectura y en el de permiso del panel «Grade de programação», y «horário de veiculação» en el aviso de franja del servidor | «a grade de programação» en los tres (`campanas.horario.no-leer`, `.sin-permiso`, `servidor.franja.aviso`) | la misma regla por palabra: «horario de transmisión» → «grade de programação»; «horário de exibição/veiculação/transmissão», descartados |
| H3 | entre dos horas de DOOHmain, «a» en dos claves y «às» en otras | «às» siempre entre horas (`campanas.doohmain.horario.a`, `campanas.comun.rango-horas`); «a» entre fechas. El porqué de `a` en `DISTINTOS_A_PROPOSITO_PT` lo dice ya bien | `costura.test.ts`: las cuatro claves de rango horario (`ENTRE_HORAS`) llevan «às» |
| H4 | `portugues-comun.test.ts` no veía una excepción que ya no hace falta | `excepcionesSobrantes()`: cada excepción tiene que SEGUIR disparando su regla | rojo visto con «É usado o valor padrão»; prueba de que muerde con datos de muestra |

Rojo primero: H1 y H2 dieron los 7 textos (14 hallazgos: falta el término y
sale el descartado); H3, 2 claves; H4, el mutante. Las listas de cognados de L2
(`comercial.ficha.tarifa-publicada`, `comercial.alta.tarifa`) y L4
(`campanas.comun.rango-horas`, `campanas.doohmain.horario.a`) pierden lo que
ya no es igual al español, y una frase esperada de `pantallas-comercial` pasa a
«Tarifa de tabela (mensal)».

**Mutantes nuevos (4/4 mueren):** MH1 vuelve «Tarifa publicada ({simbolo})»,
MH2 vuelve «horário de veiculação» en el servidor, MH3 vuelve «a» entre horas,
MH4 la excepción de tuteo sobra.

**Medido:** typecheck limpio; `npx vitest run --testTimeout=60000`: **426
archivos, 9908 en verde + 1 omitida, 0 rojas**; `DICCIONARIOS` y
`traducirError` es/en/it `cmp` idénticos a `2e2a62e1`; volcado
`I18N_VOLCAR_TODO` de toda la suite: 0 HTML de es/en/it distintos, nuevos o
desaparecidos (los 15 distintos, portugueses).

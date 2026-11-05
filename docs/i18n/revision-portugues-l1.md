# Revisión · lote L1 del portugués «Space Eyes y luz»

**Fecha:** 2026-11-05 · **Rama:** `feat/portugues-l1-spaceeyes` (sale de
`integra/portugues`, `72b33050`) · **Tablero:** `vault/03-Frontend/portugues-olas.md`
(subsección «Lote L1») · **Estado:** hecho, sin validar.

## 1 · Qué se hizo

| Ámbito | Claves | Con portugués | Archivo |
|---|---:|---:|---|
| `spaceeyes` | 1007 | 1007 | `apps/web/lib/i18n/textos/spaceeyes.ts` (`PT_SPACEEYES`) |
| `energia` | 121 | 121 | `apps/web/lib/i18n/textos/energia.ts` (`PT_ENERGIA`) |

- Los dos `PT_*` pasan de `Partial<Record<…>>` a `Record<…>`: `tsc` exige cada
  clave. `coberturaPortugues()`: **spaceeyes 1007/1007, energia 121/121, 0
  pendientes**. Total del portugués: 4597 → **3469 pendientes** (L2–L4).
- Traducido desde el **español**, con el inglés y el italiano de apoyo.
  Registro «você» con imperativo de 3.ª persona, comillas “ ”, sin espacio
  antes de «%», cifras del texto con coma («0,5x», «1,5 MB»), frecuencias fijas
  en letra («A cada duas horas»), fechas en hueco sin preposición («Início:
  {fecha}», «Vence: {fecha}.», «Válido até {fecha}»), botones en imperativo o
  infinitivo cortos («Salvar», «Excluir», «Atualizar»). En la web, siempre
  «Clique»; lo que pasa en el teléfono, «confirmação no celular».
- **Ningún código fuera de `textos/`.** El formato de cifras de Space Eyes y
  energía ya lo hizo genérico el italiano L1 (`fijo`, `cifra`, `gigas`,
  `formatNumero` con idioma): en `pt` sale «0,812», «1.234», «3,10 GB»,
  «MX$ 3.400,50» sin tocar nada. `SIN_PREFIJO_HACE.pt` (ola 0) ya quitaba «há».
  No hay ramas `=== 'it'` en estos ámbitos.
- **Pruebas** (§3). Una prueba de la ola 0 se reescribe a propósito:
  `catalogos-portugues.test.ts` afirmaba que las fallas de Space Eyes en `pt`
  eran el español; ahora exige el portugués («Gabinete 3 (linha 1, coluna 2)»,
  «A tela inteira», «Possível gabinete apagado») y el «há» quitado.

## 2 · Español, inglés e italiano idénticos — medido

| Medición | Resultado |
|---|---|
| `DICCIONARIOS.es/.en/.it` + `traducirError` es/en/it sobre `CATALOGO_ERRORES` y `CAMPO_EN` (prueba temporal fuera del commit), antes (`72b33050`) y después | **1 281 112 bytes, `cmp` idénticos** |
| Volcado de toda la suite (`I18N_VOLCAR_TODO`, sin `cifras-formularios` ni `middleware`), antes y después en el mismo worktree | ver §2.1 |

### 2.1 · El volcado

Antes: 4825 archivos (`72b33050` más la prueba estática en rojo, que no rinde
HTML). Después: 5199. `diff -rq`: **0 HTML distintos, 0 desaparecidos**; los
**374 nuevos** son todos de los estados portugueses nuevos de
`pantallas-spaceeyes` y `pantallas-energia`. `_italiano.txt` ordenado
idéntico; `_portugues.txt` solo gana esas 374 líneas (no pierde ninguna).
Las dos corridas con `--testTimeout=60000` (la máquina va cargada con los
otros tres lotes; con 5 s, una primera corrida dio 10 rojas por tiempo en
pruebas ajenas): antes, solo las 7 rojas de la estática; después, **418
archivos, 9047 en verde + 1 omitida, 0 rojas**.

## 3 · El portugués, comprobado

- **`textos/portugues-l1.test.ts`** (estática, 24 pruebas): cada clave con
  portugués y ninguna sobra; ninguna igual al español ni al inglés salvo **115
  cognados declarados uno por uno** (Fotos, Comparar, Nitidez, Obturador,
  Pausar, «30 minutos», «Gabinetes {lista}», Latitude…, más «Vincular», «No»
  del Imager, «38 °C», «{n}%»); mismos huecos que el español; singular ≠
  plural; comillas, «%», «¿¡ñ»; sin cifras con punto (las versiones no
  cuentan); ninguna fecha en hueco tras em/no/do/ao/pelo; frecuencias en
  letra; nunca «toque/toca/aperte/pressione» en la web; nunca «Dono» ni
  «proprietário»; ningún resto español suelto (pantalla, equipo, falla,
  recibo, predio, guardar, eliminar…). **Rojo antes de traducir: 7 de 24**
  (commit `8d381d74`).
- **`pantallas-spaceeyes.test.ts`**: las 95 pantallas (y la galería con 1234
  fotos) se rinden también en `pt`: ninguna frase española de la lista de cada
  estado (salvo `COMUNES_PT`, lo que en portugués se dice igual), el portugués
  esperado en 15 estados (`PORTUGUES`), ningún «há há», `huellasEnPortugues`
  sin huellas (permitidos: «0,812» del SSIM y las versiones «0.15» y «1.0»), la
  marca de la foto sigue en es-MX (es la evidencia), y el barrido del
  diccionario con `culpablesEnItaliano` + `espanolPendienteDeOtrosLotes`.
- **`pantallas-energia.test.ts`**: los 11 estados en `pt`, el portugués
  esperado en todos, sin huellas, el dinero con el símbolo de la instancia
  (MXN «MX$ 3.400,50» y USD «US$ …») y el barrido.
- **Espejo** (`I18N_VOLCAR_PT` sobre las dos pruebas de pantallas): **0
  huellas** (no se escribe `_guardias.jsonl`).
- **La regla común de tuteo y de fechas** (`portugues-l5.test.ts`, sobre todo
  `PT_PARCIAL`) también pasa con el lote.

### Mutantes — 14, mueren los 14

Contra `portugues-l1`, `portugues-l5`, `pantallas-spaceeyes`,
`pantallas-energia` y `catalogos-portugues` (unitarias; las e2e no se mutaron:
el lote no toca sesión, base ni dinero). Script en el scratchpad, cada archivo
restaurado byte a byte.

| # | Mutante | Muere en |
|---|---|---|
| M1 | `prog.estado.empieza` = «Começa em {fecha}» | 3 |
| M2 | Falta `energia.medidor` | 3 |
| M3 | «última vez há {hace}» («há há 5 min») | 1 |
| M4 | «A cada 2 horas» | 2 |
| M5 | `lista.kpi.flota` en español | 2 |
| M6 | «registrada em {mes}» | 2 |
| M7 | «Toque nos 4 cantos» | 1 |
| M8 | «só o Dono» | 1 |
| M9 | «Grande-angular 0.5x» | 1 |
| M10 | `galeria.total.uno` = plural | 2 |
| M11 | «alumbrado {monto}» (concepto del recibo sin portugués) | 2 |
| M12 | «Vincular» traducido a «Parear» | 3 |
| M13 | «Tenta de novo» (tuteo) | 2 |
| M14 | `cobertura.faltan` sin `{esperados}` | 1 |

## 4 · Glosario del lote (lo que no está en §2 bis)

| Español | pt-BR | Por qué |
|---|---|---|
| equipo / dispositivo | **dispositivo** (masc.) | como el menú (`nav.space-eyes` = «Dispositivos») |
| pantalla que mira el equipo (LED, gabinetes, apagada, marcarla) | **tela** | es la pantalla digital del glosario común |
| pantalla del inventario (asignada, «tus pantallas», su galería, «Pantalla asociada») | **ponto** | glosario común |
| sitio físico donde está el equipo («ir al sitio», «Nombre del sitio», «Datos del sitio») | **local** | «ir ao local» es lo natural; «ponto» chocaría con el inventario dentro de la misma frase |
| espectacular («Código del espectacular») | **painel** | propuesta del §2 bis para L3 |
| falla · recuperada · descartada | **falha · resolvida · descartada** («Não era falha») | «recuperada» suena a dinero recuperado |
| gabinete | **gabinete** | término del LED en Brasil |
| creativo / creatividad de referencia | **criativo / criativo de referência** | un solo término, masc. |
| vigilancia / vigilar | **monitoramento / monitorar** | «vigilância» suena a seguridad |
| vista en vivo | **visualização ao vivo** («Ao vivo» en la pestaña) | |
| encuadre · acercamiento · lente | **enquadramento · aproximação · lente** (fem.) | |
| código de vinculación · vincular | **código de pareamento · parear** | lo que dicen Android y los fabricantes en Brasil |
| flota | **parque de dispositivos** («de todo o parque de dispositivos») | «frota» es de vehículos; la lección del italiano |
| marca de la foto | **legenda** | el menú ya dice «Legenda das fotos» (L5) |
| evidencia | **comprovação** | glosario común; «Comprovação de veiculação» = prueba de exhibición |
| franja (programación) | **faixa** («faixa horária») | |
| folio de un ticket de soporte · panel de tickets | **chamado · painel de chamados** | en Brasil un ticket de soporte es un *chamado*; no es el Folio de la venta (Ref. interna) |
| toque en el teléfono | **confirmação no celular** | como el inglés («someone has to confirm»); «toque» se vigila |
| registros (logs) del equipo | **logs** | «registros» chocaría con «registrar uma conta» en la misma app |
| Dueño | **Titular** | glosario común (3 claves: `pconfig.solo-dueno`, `admin.solo-dueno`, `vivo.pie.mirar.nada`) |
| recibo de luz | **conta de luz** | lo que dice Brasil |
| predio · pantalla suelta | **imóvel · ponto avulso** | |
| punto de medición | **unidade consumidora** | la UC de las contas brasileñas, y no choca con *ponto* |
| capturar (un recibo) | **registrar** | |
| hueco | **lacuna** | |
| tanda · renglón | **lote · linha** | |
| reporte de rentabilidad | **relatório de rentabilidade** | |
| adeudos | **débitos anteriores** | |

## 5 · Lo no obvio, clave por clave

### Lo que se queda como en la app o en el papel

- **`spaceeyes.alta.tel.vincular` = «Vincular»** (cognado): es el botón de la
  app Android de Space Eye, que **solo está en español** (decisión del dueño
  para el inglés, 02/11). La frase alrededor está en portugués: «Na app,
  escolha **Vincular** e escaneie o QR».
- **`spaceeyes.alta.pi.1.no` = «No»** (cognado): el botón del Raspberry Pi
  Imager, que sale en inglés.
- **La CFE** (`energia.lectura.no-recibo.*`): «conta de luz da **CFE**». Es
  nombre propio y lo que el usuario ve en el papel.
- **Lo que se lee del PDF de la CFE** (`energia.leido.*`), que el usuario
  compara con el papel: «**nº de serviço** {n}» (el «No. de servicio» del
  recibo), «**medidor nº** {n}», «**faturamento** {monto}» (la línea de
  facturación), «**iluminação pública (DAP)** {monto}» — el **DAP** (derecho de
  alumbrado público) es la sigla que trae el recibo y se deja para que lo
  encuentre; «Total da conta {monto} (inclui débitos anteriores e
  pagamentos)». Ninguno es un nombre propio de la CFE, así que van en
  portugués con lo justo para encontrarlos en el papel. **Duda para el dueño
  (D1).**
- **La marca grabada en la foto** (nombre · fecha · hora en es-MX) y el nombre
  del `.zip` y del CSV **no se tocan** (son la evidencia); la prueba exige que
  la marca siga en es-MX también en `pt`.

### Fechas y huecos

- `prog.estado.empieza` «Início: {fecha}», `prog.estado.vencio` «Vencida:
  {fecha}», `prog.proxima.espera` «Não dispara antes de: {fecha}»,
  `alta.vence` « · vence: {fecha}», `alta.pi.listo.vence` «Vence: {fecha}.»,
  `ficha.captura-del` «Captura: {fecha}», `creativo.aparecio` «Apareceu:
  {fecha}», `pyc.detectada` «Detectada: {fecha} · confiança {pct}»: regla del
  §2 bis (sin «em/no/do»).
- `prog.proxima.min/h`: «{fecha} (em {n} min)»: «em» va delante de la cifra,
  no de la fecha.
- `energia.subir.ya-capturado`: «Já existe uma registrada **para** {mes}» (el
  hueco es «2026-01»; «em» queda prohibido delante de un mes).
- `comun.encendida` / `pconfig.editor.*`: «Ligada das {inicio} às {fin}»
  (horas, no fechas).
- `hace.*`: «há {n} min / h / d / semanas»; `hace.segundos` «há poucos
  segundos». `creativo.visto.*` «… · última vez {hace}» sin repetir el «há»
  (la lección del «fa fa» italiano), y la prueba lo vigila.

### Plurales que el español no distingue

El español repite la misma frase en `.uno` y `.otros` en varias claves
(«{n} pendiente(s)», «{n} reportes», «{n} fotos», «{n} seleccionados», «de {n}
equipos»…). En portugués van de verdad en singular y plural: «1 pendente / 2
pendentes», «1 registro», «1 foto», «1 selecionado», «de 1 dispositivo». Las
que el español arma con una cifra sin forma propia se reescriben para que
concuerden con cualquiera:

- `energia.lectura.desajuste.*` «{n} não confere(m) com o número de meses que
  você declarou ({esperados})» y `energia.lectura.cubre.*` «{base}: o número
  de meses do calendário que essas {n} abrangem é {unico}» (con «os 1 meses»
  salía mal; la forma del inglés).
- `energia.lectura.repetidos` «{n} com o mês já registrado: salvar de novo
  DUPLICA o custo» (como el italiano: «1 já registradas» no concuerda).
- `energia.cobertura.completa.uno` «o período tem {n} conta e ela está lá».
- `fallas.donde.gabinetes.uno` «Gabinete {lista}» / `.otros` «Gabinetes
  {lista}» (el código elige por cuántos hay).

### Otras

- `conexion.en-linea` «On-line» (con guion, como se escribe en Brasil; distinto
  del «Online» inglés). `senal.*` en masculino (*o sinal*): «bom / razoável /
  fraco».
- `solicitudes.copiada` «Copiado»: lo copiado es el *comando* (masc.).
- `lista.kpi.mas-10` «há mais de 10 min»; `lista.filtro.atencion` «Pedem
  atenção · {n}»; `lista.filtro.manual` «Atualização manual · {n}».
- `actualizacion.*` «Atualiza sozinho» (el dispositivo); «Precisa de uma
  confirmação no celular…».
- `pconfig.revision.ok` «sem problemas» y `.inconcluso` «não avaliada»: van
  dentro de «{cuando} · tela {pantalla}…» («tela sem problemas», «tela não
  avaliada»).
- `pconfig.ayuda.orden` «superior esquerdo, superior direito, inferior
  direito, inferior esquerdo» (los cantos).
- `admin.actualizar.pc`: «O agente confere a assinatura…» (sujeto explícito,
  la lección del italiano: sin él se lee como orden al usuario).
- `admin.registros*` «Logs do dispositivo» (§4).
- `alta.lote.*`: «O dispositivo número {siguiente} já não consegue entrar»
  ({siguiente} es la cifra n+1).
- `alta.lote.completo` « · esgotado» (todos los usos gastados).
- Ejemplos: «Ex.: Painel Av. Paulista, 222», «Ex.: Verão 2026», «Ex.: Natura»,
  «Av. Brasil, 120 · Face A» (cara de un painel = *face*).

## 6 · Medido al cerrar

| Medición | Resultado |
|---|---|
| `cd apps/web && npm run typecheck` | limpio |
| `npx vitest run --testTimeout=60000` (toda la suite unitaria, sin `cifras-formularios` ni `middleware`) | 418 archivos, 9047 en verde + 1 omitida, 0 rojas |
| `cd apps/web && npm test` (la suite tal cual, 5 s por prueba) | 420 archivos, 9121 en verde + 1 omitida, **1 roja ajena**: `scripts/semilla-catalogo-demo.test.ts` por tiempo con la máquina cargada; **sola, 29/29**. Es la de siempre (L5 la anotó igual) |
| `DICCIONARIOS` + `traducirError` es/en/it | `cmp` idénticos (§2) |
| Volcado `I18N_VOLCAR_TODO` | 0 HTML distintos de es/en/it (§2.1) |
| Espejo `I18N_VOLCAR_PT` (las dos pruebas de pantallas) | 0 huellas |
| `coberturaPortugues()` | spaceeyes 1007/1007, energia 121/121 |
| Mutantes | 14/14 muertos |
| e2e, build | no corridas: el lote solo cambia textos y pruebas |

## 7 · Dudas para el dueño

1. **D1 · Los conceptos del recibo de la CFE.** Se dejó la **CFE** y la sigla
   **DAP**; «servicio», «facturación» y «total» van en portugués («nº de
   serviço», «faturamento», «Total da conta»). Alternativa: dejar el rótulo
   del papel tal cual («No. de servicio», «Facturación») entre paréntesis.
2. **D2 · *local* para el sitio físico.** En Space Eyes el «sitio» (donde está
   el equipo) es *local* y la pantalla del inventario es *ponto*; el campo
   «Sitio» de la ficha del equipo sale «Local». El §2 bis dice «Sitio → Ponto»
   para el campo del servidor; aquí habría frases como «sem ir ao ponto» que
   chocan con «Ponto associado». Conviene confirmarlo en la costura con L3.
3. **D3 · *parque de dispositivos*** para la flota (y no *frota*).
4. **D4 · *unidade consumidora*** para el punto de medición de la luz (y no
   *ponto de medição*, que choca con *ponto*).
5. **D5 · *legenda*** para la marca de la foto: lo fijó el menú de L5; se usa
   igual dentro de la pantalla.
6. **D6 · *chamado*** para el folio de un ticket de soporte (no *Ref. interna*,
   que es el folio de la venta).

## 8 · Para la costura

- **L2** (`comercial.eye.*`): el veredicto de la foto («Anuncio correcto ·
  confianza 93%», «No coincide con la creatividad · 41%») sale en español en la
  ficha de Space Eyes hasta que L2 lo traduzca. Está en `COMUNES_PT` de
  `pantallas-spaceeyes.test.ts` y en `DATOS_PT` (« · confianza» es un trozo
  corto que `espanolPendienteDeOtrosLotes` no aparta): **quitarlos al integrar
  L2**.
- **L3**: *painel* para el espectacular (aquí, «Código do painel» y el
  ejemplo); *local* frente a *ponto* (D2).
- **`papeles-portugues.ts`** (rama `feat/portugues-documentos`): no existe en
  este árbol, y Space Eyes y energía no tienen papeles; nada que igualar.
- La costura (`textos/costura.test.ts`) aún compara inglés e italiano; el
  portugués de este lote ya cumple la forma que exigiría.

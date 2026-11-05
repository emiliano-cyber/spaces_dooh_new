# Validación · Lote L1 del portugués (Space Eyes y luz)

**Fecha:** 2026-11-05 · **Rama:** `feat/portugues-l1-spaceeyes` (`c2f5d3ed`), sobre
`integra/portugues` (`72b33050`) · **Revisión del traductor:**
`docs/i18n/revision-portugues-l1.md` · Validador independiente: solo lee y mide;
no corrige. Todo lo de abajo está medido en este árbol.

## Veredicto: ÁMBAR (leve)

La maquinaria está **limpia**: `DICCIONARIOS.es/.en/.it` y `traducirError` en
es/en/it **byte a byte idénticos** antes y después, 0 HTML distintos de es/en/it
en el volcado de toda la suite, typecheck limpio y la suite entera en verde. Las
pruebas que el lote cambia no se debilitan (§3). 6 de 8 mutantes propios mueren;
los 2 que sobreviven señalan un mismo hueco: nada vigila el **portugués de
Portugal** (§4).

Y es justo lo que impide el VERDE. **«a app» en femenino** en 17 claves
(«Versão da app», «a app vai reiniciar sozinha», «Na app, escolha
Vincular») es una marca de pt-PT. En Brasil se dice *o app* o *o aplicativo*, y
el propio lote lo dice así en dos claves («Reiniciar o aplicativo»). Hay además
una concordancia que **se ve en el HTML** («Estado do ponto: Ativa ·
Desativada»). Todas las correcciones son de una línea.

## 1 · Mediciones

| Medición | Resultado |
|---|---|
| `cd apps/web && npm run typecheck` | limpio |
| `cd apps/web && npx vitest run --testTimeout=60000` | **420 archivos, 9122 en verde + 1 omitida, 0 rojas** (incluida `semilla-catalogo-demo`, que esta vez no se pasó de tiempo) |
| `DICCIONARIOS.es/.en/.it` + `traducirError(es/en/it)` sobre `CATALOGO_ERRORES`, `CATALOGO_LIB` y `CAMPO_EN` × 3 motivos; más `PATRONES_ERROR` (`re`, `en`, `it`). Se volcó con una prueba temporal fuera del repo, retirada, con los dos `textos/` en `72b33050` y en `HEAD` | **1 205 085 bytes, `cmp` idénticos** |
| Diff de fuentes `72b33050..HEAD` en `textos/energia.ts` y `textos/spaceeyes.ts` | lo único retirado son las 8 líneas de cada `PT_* = {}` de la ola 0 y su comentario. `diccionario.ts`, `errores-servidor.ts` e `idiomas.ts`: **sin cambios** |
| `I18N_VOLCAR_TODO` (sin `cifras-formularios.test.ts` ni `middleware.test.ts`). La base se midió con `git switch --detach 72b33050` en el mismo worktree, y se volvió a la rama | base **4825** archivos (417 archivos de prueba en verde), rama **5199** (418 en verde). `diff -rq`: **0 HTML distintos, 0 «solo en antes»**; 374 nuevos, todos de los estados `pt` de `pantallas-spaceeyes` y `pantallas-energia`. `_italiano.txt` ordenado idéntico (solo cambia el orden). `_portugues.txt` gana 374 líneas y no pierde ninguna |
| Huecos `{x}`, singular ≠ plural, comillas, «%», fechas en hueco | los vigila la estática del lote (`portugues-l1.test.ts`, 24 pruebas), y pasa. Comprobado además a ojo en las 1128 claves (§2) |
| Árbol al terminar | `git status` limpio en la rama; `HEAD` = `c2f5d3ed` antes del commit de este informe |

## 2 · Sentido en portugués

Leídas **todas** las claves: las 121 de `energia` y las **1007 de `spaceeyes`**,
cada una junto a su español (volcado en el scratchpad,
`val-pt-l1/spaceeyes.txt` y `energia.txt`). En contexto se leyó el HTML
portugués volcado: la ficha de administración del equipo Android, la lectura
de los PDF de la CFE con todas las pegas a la vez, la lista y la programación.

Lo leí poniéndome en dos lugares. Un **técnico de campo brasileño** que instala
celulares, Raspberry y PC lo entiende todo y casi todo lo diría así: «Tire
primeiro uma foto», «Clique nos 4 cantos da tela nesta ordem», «Lente tampada,
ou tela apagada à noite», «Cole o comando», «Ninguém precisa se conectar a
ela», «A transmissão para sozinha». Un **financiero** que registra la conta de
luz encuentra lo que busca: «unidade consumidora», «conta de luz da CFE»,
«débitos anteriores», «Faltam 3 de 6 contas do período… um mês sem conta não é
um mês sem consumo».

No encontré español colado, tuteo, «Dono» ni falsos amigos graves. Los
plurales que el español repite («{n} pendiente(s)», «{n} reportes») están bien
resueltos en singular y plural. Las frases que el código arma con cifras se
reescribieron para que no dependan de la cifra («{n} não conferem com o número
de meses que você declarou ({esperados})»), y en el HTML se leen bien.

### 2.1 · A corregir

| # | Dónde | Texto actual | Problema | Propuesta | Gravedad |
|---|---|---|---|---|---|
| 1 | `textos/spaceeyes.ts`, 17 claves: líneas 3751, 3794, 3837, 3876, 3944, 3969, 3971, 3973, 3982, 3984, 4002, 4092, 4470, 4562, 4563, 4565, 4568 (`pyc.sin-vigilar`, `creativos.no-sabe`, `pconfig.no-sabe`, `pconfig.camara-bloqueada`, `admin.version-app`, `admin.actualizar.version/.publicada`, `admin.orden.reiniciar`, `admin.programa.texto/-pi`, `admin.reiniciar-pi.texto`, `vivo.p2p.texto`, `graficas.consumo.sin`, `alta.tel.1`, `alta.tel.descargar`, `alta.tel.3`, `alta.tel.escanea`) | «Versão **da** app», «**a** app vai reiniciar sozinha», «**Na** app, escolha Vincular», «precisa **da** app 0.15» | *app* en femenino es uso de **Portugal**. En Brasil es **o app** (o *o aplicativo*). El propio lote lo hace bien en `admin.reiniciar.titulo/.texto` («Reiniciar **o aplicativo**») y en «Instalar apps desconhecidos». Un brasileño lo nota en la primera pantalla, y es la que más usa el técnico (el alta del celular) | Masculino en las 17: «Versão do app», «o app vai reiniciar sozinho», «No app, escolha {vincular}…», «precisa do app 0.15…», «Escaneie pelo app Space Eye», «Instale o app {app} no celular» | **media** (sistemática) |
| 2 | `textos/spaceeyes.ts:3961` `admin.estado-pantalla` frente a `:3918-3921` `admin.estado.*` y `:3962` `admin.estado-ayuda` | «Estado **do ponto**» · opciones «Em operação · **Ativa** · Em manutenção · **Desativada**» · «Manutenção e desativada deixam o ponto fora…» | **Se ve en el HTML** (`equipo android atrasado · editar y actualizar`). *Ponto* es masculino y las opciones vienen del femenino español (*la pantalla*). Además, `comun.activa`/`campanas.inactiva` son de campañas y sí van en femenino: no hay que tocarlas | O se cambia el rótulo a «Estado **da tela**» (los cuatro estados y la ayuda quedan bien en femenino), o se pasan a masculino («Ativo · Desativado», «Manutenção e desativado… Em operação e ativo»). Prefiero lo primero, porque es una línea | media (se ve) |
| 3 | `textos/spaceeyes.ts:3502`, `:4528`, `:4607` (`conexion.pendiente`, `alta.tipo.telefono.detalle`, `alta.codigos`) | «Aguardando **pareamento**», «É **pareado** lendo um QR», «Códigos de **pareamento**» junto al botón de la app «**Vincular**» | El técnico lee en la web *parear* y en el teléfono *Vincular*: dos palabras para un mismo gesto. Y *Vincular* es portugués corriente («vincular o dispositivo à conta»), así que la web puede decir lo mismo que la app. Además, en Brasil *pareamento* suena a Bluetooth. El lote ya escribe «não está **vinculado** a um ponto» (`ficha.sin-sitio`) | «Aguardando vinculação», «É vinculado lendo um QR», «Códigos de vinculação». Así la web dice lo mismo que el botón que el dueño decidió conservar. Habría que cambiar también la fila del glosario del lote | baja-media |

### 2.2 · Retoques menores (no bloquean)

| # | Dónde | Actual | Propuesta |
|---|---|---|---|
| 4 | `spaceeyes.ts:3674` `ficha.sin-cargar` (estado de la batería) | «sem carregar» | «não está carregando» (o «na bateria») |
| 5 | `energia.ts:627` `energia.leido.facturacion` | «faturamento {monto}» | En Brasil *faturamento* es la **facturación de una empresa** (sus ingresos). En una conta se dice «**valor faturado** {monto}». Ver D1 |
| 6 | `energia.ts:610` `energia.lectura.sin-predio` | «{n} sem imóvel: escolha você» | «{n} sem imóvel: escolha manualmente» |
| 7 | `spaceeyes.ts:4046` `admin.prueba.datos` | «Cada teste consome uma foto de dados» | calca el español: «Cada teste consome os dados de uma foto» |
| 8 | `spaceeyes.ts:4298` `campanas.equipos` | «Dispositivos onde esta campanha está» | «Dispositivos desta campanha» |
| 9 | `spaceeyes.ts:3990`, `:4530`, `:4570`; y `actualizacion.sola/.kiosco/.sin-tocar/.proxima` | «Instala sozinha», «Atualiza sozinho» | Sin el pronombre se lee «instala (algo) sola». Mejor «**Se** instala sozinha», «**Se** atualiza sozinho»: en Brasil la próclisis es lo natural |
| 10 | `spaceeyes.ts:4555-4557` `alta.lote.qr/.archivo/.codigo` | «O dispositivo número {siguiente} **já não** consegue entrar» | «já não» es más de Portugal: «…**não consegue mais** entrar» |
| 11 | `energia.ts` `energia.borrado.confirmacion` | «até você registrá-**lo** de novo» (lo = el mes) | «registrá-**la**» (la conta), como en el español |

### 2.3 · «Vincular», la CFE y la marca de la foto

- **«Vincular»** se queda igual que en la app Android: `alta.tel.vincular` =
  «Vincular», y el estado `pt` de `alta · telefono con codigo y lista` lo
  exige. El mutante que lo traduce («Parear») muere (M12 del traductor). La
  frase alrededor («Na app, escolha **Vincular**…») evita «toque» por la regla
  de la web. Aquí la acción es **en el teléfono**, y «toque em» sería lo
  natural, pero «escolha» se entiende. Lo que sí desentona es «Na app» (#1).
- **La CFE** se reconoce frente al papel mexicano. En el HTML se lee: «nº de
  serviço 123456789012 · medidor nº AB12 · PDBT · período … · o PDF diz 1.500
  kWh · faturamento MX$ 4.000,00 · iluminação pública (DAP) MX$ 200,00 · Total
  da conta MX$ 9.000». «No. de servicio», «DAP» y «Total» se encuentran en el
  recibo sin esfuerzo. El que confunde es «faturamento» (#5).
- **La marca de la foto** sigue en es-MX en `pt`, y la prueba lo exige.

## 3 · Las pruebas que el lote cambia

- **`catalogos-portugues.test.ts`** (9+/6−). Las dos pruebas de Space Eyes
  afirmaban que `pt` era igual al español, porque no había traducción. Ahora
  exigen el portugués literal: «Gabinete 3 (linha 1, coluna 2)», «Gabinetes 1,
  2 (2 de 8)», «A tela inteira», «Possível gabinete apagado», y
  `haceSinPrefijo` = «5 min» sin «há» ni «hace». **Es más estricta que antes**:
  una igualdad con el español se cambia por un valor exacto, y la guarda
  `not.toMatch(/^(?:há|hace) /)` sigue ahí. El resto del archivo no se toca.
- **`pantallas-spaceeyes.test.ts`** (+184/−0) y **`pantallas-energia.test.ts`**
  (+121/−0): **solo añaden**. Ni `COMUNES`, ni las pruebas es/en/it, ni sus
  permitidos cambian.
  - `COMUNES_PT` = `COMUNES` + cognados. Leí uno por uno los 77 de Space Eyes
    («Zona», «Nitidez», «Obturador», «Lente normal», «Reiniciar app», «Ver
    nítido», «OFERTA», «15 gabinetes»…): todos se escriben igual en pt-BR. Los
    de energía («3 de 6», «Medidor») también.
  - Las únicas entradas que **sí esconden español** son dos frases del
    veredicto de la foto, de L2 («Anuncio correcto · confianza 93%», «No
    coincide con la creatividad · 41%»), y `DATOS_PT = ['Anuncio correcto ·
    confianza']`. Están declaradas, comentadas y anotadas para la costura
    (revisión §8). La de `DATOS_PT` quita la **frase entera** de L2, no el
    trozo « · confianza»: el «· confiança» de `pyc.detectada` sigue vigilado.
  - `huellasEnPortugues` admite «0,812» (el SSIM) y las versiones «0.15» y
    «1.0». Están acotadas con `^…$` y no dejan pasar cifras.
- **`textos/portugues-l1.test.ts`** (nueva). Los 115 cognados están
  declarados uno por uno con su texto en comentario, y hay una prueba que
  falla si uno deja de ser igual. Revisé la lista: no hay ninguna traducción
  perezosa escondida. Todos son cognados reales, cifras con unidad o nombres
  propios.

## 4 · Mutantes propios (contra unitarias)

Aplicados uno a uno con el script `val-pt-l1/mutar.mjs` del scratchpad, contra
`portugues-l1`, `portugues-l5`, `pantallas-spaceeyes`, `pantallas-energia` y
`catalogos-portugues`. Cada archivo se restauró byte a byte, y `git status`
quedó limpio al acabar. Las e2e no se mutaron, porque el lote no toca sesión,
tenant, dinero en base ni migraciones.

| # | Mutante | Resultado |
|---|---|---|
| MV1 | tuteo: `prog.toast.equipo` = «Escolhe o dispositivo» | muere (1) |
| MV2 | pt-PT: «**Ecrã** apagado no horário de funcionamento» | **SOBREVIVE** |
| MV3 | `alta.pi.listo.vence` = «Vence em {fecha}.» | muere (2) |
| MV4 | `fallas.donde.gabinete` con «fila/columna» en español | muere (4) |
| MV5 | `prog.linea.uno` sin `{semana}` | muere (1) |
| MV6 | `alta.tel.3` «Na app, toque em {vincular}» | muere (2) |
| MV7 | `energia.leido.alumbrado` sin la sigla «(DAP)» | muere (1) |
| MV8 | pt-PT: «Versão da **aplicação**» | **SOBREVIVE** |

**MV2 y MV8 señalan el mismo hueco**, que es el del hallazgo 1: ninguna prueba
distingue pt-BR de pt-PT. Una guarda barata en la estática (o mejor, en
`portugues-l5.test.ts` sobre todo `PT_PARCIAL`, para los cinco lotes) sería
`/\b(?:ecrã|aplicação|telemóvel|ficheiro|utilizador|(?:a|da|na|pela) app)\b/i`.
No bloquea, pero el #1 habría muerto con ella.

## 5 · Las 6 dudas para el dueño (§7 de la revisión): opinión desde el uso brasileño

No decido: opino.

1. **D1 · Conceptos del recibo de la CFE.** El criterio de traducir y dejar la
   sigla está bien: un financiero brasileño no conoce el papel mexicano, y lo
   que necesita es encontrar cada número. «nº de serviço» se encuentra
   enseguida al lado del «No. de servicio» del papel. «Iluminação pública
   (DAP)» es perfecto. **«faturamento» no**: en Brasil es la facturación de una
   empresa. Propondría «valor faturado». La alternativa del paréntesis con el
   rótulo español solo merecería la pena para «Facturación».
2. **D2 · *local* para el sitio físico.** Estoy de acuerdo. «Ir ao local»,
   «nome do local» y «dados do local» son lo que dice un técnico. «Sem ir ao
   ponto» sonaría a inventario. El choque con el «Sitio → Ponto» del §2 bis se
   resuelve en la costura con L3, como dice la revisión.
3. **D3 · *parque de dispositivos*.** Estoy de acuerdo: es jerga de TI
   brasileña corriente («parque de máquinas»), y *frota* evoca vehículos.
   Queda algo largo en la tarjeta («de todo o parque de dispositivos»), pero
   se entiende a la primera.
4. **D4 · *unidade consumidora*.** Muy de acuerdo. Es el término de la ANEEL
   que aparece en toda conta de luz brasileña, y el financiero lo reconoce sin
   pensar. Además evita el choque con *ponto*.
5. **D5 · *legenda* para la marca de la foto.** Es aceptable y coherente con
   el menú de L5. Matiz: lo que se graba (nombre · fecha · hora) en Brasil se
   llama a menudo «**carimbo** de data e hora». *Legenda* se entiende como «el
   texto sobre la foto», así que no lo cambiaría solo por esto.
6. **D6 · *chamado*.** Muy de acuerdo: «abrir/fechar um chamado» es como se
   dice en Brasil, y separarlo de «Ref. interna» es correcto.

Y una **duda que no está en la lista**, aunque es del mismo tipo: *pareamento*
frente a *vinculação* (hallazgo 3). Si el dueño quiere que la web diga lo
mismo que el botón de la app, es «vinculação».

## 6 · Para la costura

Lo que ya anota la revisión (L2: veredicto `comercial.eye.*` en `COMUNES_PT`
y `DATOS_PT`, que se quitan al integrar L2; L3: *painel* y *local*/*ponto*),
más:

- el **género de *app*** (#1): conviene fijarlo en el §2 bis («o app») antes
  de que lo repitan L2–L4;
- la **guarda pt-PT** (§4) en `portugues-l5.test.ts`, para todos los lotes.

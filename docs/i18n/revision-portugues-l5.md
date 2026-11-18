# Revisión · Lote L5 del portugués (armazón, cuenta, administración, compartidos y servidor)

**Fecha:** 2026-11-05 · **Rama:** `feat/portugues-l5-armazon`, sobre
`integra/portugues` (`e018b1bb`) · **Tablero:** `vault/03-Frontend/portugues-olas.md`
· **Encargo:** traductor del lote L5 del portugués (pt-BR); lo revisa un
validador independiente. Equivalente exacto del L5 italiano
(`docs/i18n/revision-italiano-l5.md` y su validación), con sus lecciones aplicadas.

## 1 · Qué se tradujo

| Ámbito | Archivo | Claves | Antes | Después |
|---|---|---:|---:|---:|
| base | `lib/i18n/diccionario.ts` (`PT_BASE`) | 119 | 6 | 119 |
| compartidos | `textos/compartidos.ts` | 113 | 0 | 113 |
| shell | `textos/shell.ts` | 59 | 0 | 59 |
| cuenta | `textos/cuenta.ts` | 125 | 0 | 125 |
| admin | `textos/admin.ts` | 542 | 0 | 542 |
| notificaciones | `textos/notificaciones.ts` | 47 | 0 | 47 |
| servidor | `textos/servidor.ts` | 32 | 0 | 32 |
| errores · catálogo | `errores-servidor.ts` (`CATALOGO_ERRORES_PT`) | 205 | 0 | 205 |
| errores · campos | `CAMPO_PT` | 30 | 0 | 30 |
| errores · firma | `FALTA_FIRMA_PT` | 12 | 0 | 12 |
| errores · patrones | `PATRONES_PT` → `p.pt` / `p.huecosPt` | 62 | 0 | 62 |
| **Total** | | **1346** | **6** | **1346** (1340 nuevas) |

Los seis `PT_<ÁMBITO>` de `textos/` pasan de `Partial<Record<…>>` a `Record<…>`:
una clave nueva sin portugués ya no compila. La base sigue `Partial` (su tipo es
`ClaveTexto`, todos los ámbitos); la exigen la fila «base» de la cobertura y
`textos/portugues-l5.test.ts`. `errores-acceso.ts`, `papeles.ts` y
`notificaciones.ts` no tienen tabla propia: leen la base, `admin.papel.*` y
`notificaciones.*`.

## 2 · El glosario

**Primera entrega, en su propio commit** (`30b60385`): §2 bis de
`vault/03-Frontend/portugues-olas.md`, para que los otros cuatro lotes lo reciban
en su encargo. Resumen de lo que no es obvio:

| Español | pt-BR | Por qué |
|---|---|---|
| pantalla (inventario genérico) / digital | **ponto** / **tela** | el OOH brasileño vende *pontos*; el DOOH dice *telas*. La pantalla de la app es **página** (evita el choque con *tela*) |
| catorcena · Catorcenal | **bissemana** · **Bissemanal** | es exactamente el periodo de 14 días con que se vende el outdoor en Brasil; *quinzena* sería la quincena |
| quincenal | **Duas vezes por mês** | no «quinzenal», que se confundiría con la bissemana |
| CPS · salida | **CPS · custo por inserção** · **inserção** | *inserção* es la salida al aire en mídia |
| millar · CPM | **milhar** · «CPM · custo por mil impressões» | |
| espacios del loop · prima | **slots do loop** · **acréscimo** | |
| OT · OC | **OS** (ordem de serviço, fem.) · **PC** (pedido de compra, masc.) | las siglas que usa Brasil |
| arrendador · renta · predio | **locador** · **aluguel** · **imóvel** | Lei do Inquilinato |
| Folio · cupón | **Ref. interna** · **código de negociação** | decisión del dueño |
| Dueño (rol) | **Titular** | decisión del dueño (05/11), §11 |
| rol de una persona / de una razón social | **perfil** / **papel** | los sistemas brasileños dicen «perfil de acesso»; los papeles de una razón social son otra cosa y así no se cruzan |
| Imprenta (módulo y rol) | **Gráfica** | en Brasil la imprenta *es* la gráfica; no hace falta la excepción módulo/rol del italiano |
| Captación | **Captação de pontos** | como la *captação de imóveis* |
| Configuración (menú / cuenta / negocio) | **Configurações** / **…da conta** / **…da empresa** | |
| Network | **a Network** (fem., como «a rede») | |
| Almacén | **Almoxarifado** | |
| Eliminar · Quitar · Agregar · Guardar | **Excluir · Remover · Adicionar · Salvar** | el estándar de las interfaces brasileñas |
| comillas | **“ ”** | Brasil no usa « »; lo vigila la prueba estática |

**Regla de las fechas en hueco** (la del italiano, en portugués): nunca «em
{fecha}», «no/do/ao/pelo {fecha}». Se escribe «Vencimento: {vence}», «válida até
{fecha}», «vencida desde {vence}», «a partir de {finGracia}», «Aceita: {fecha}»,
«Aceita por {quien} ({fecha})». La vigila `textos/portugues-l5.test.ts` sobre
**todo** `PT_PARCIAL` (los cinco lotes), con su prueba de que muerde.

## 3 · Clave por clave, lo no obvio

- **`compartidos.cifra.*` (P2).** El dueño decidió teclear a la brasileña, pero
  eso es la tarea ROJA `feat/portugues-cifras`. Hasta entonces `CampoCifra` lee
  el portugués a la mexicana (`comaDecimal('pt') === false`), y los avisos dicen
  **eso**: «a vírgula separa os milhares e o ponto, os decimais». Mentir hoy
  para acertar mañana no tenía sentido. **Texto propuesto para esa tarea:**
  - `forma`: «Digite só algarismos: o ponto separa os milhares e a vírgula, os decimais. Exemplo: {ejemplo}»
  - `comas`: «Os pontos vão a cada três algarismos, como em {ejemplo}. Se queria decimais, use vírgula: {decimal}»
  - `europeo`: «Aqui a vírgula é decimal e o ponto separa os milhares: digite {ejemplo}»
  - `puntos`: «Só pode haver uma vírgula, a dos decimais. Para os milhares, use ponto: {ejemplo}»
  - `punto-decimal`: «No Brasil a vírgula é decimal: “{texto}” seria {decimal}. Para {miles}, digite {sinComas} ou {miles}»
- **`servidor.ubicacion.vacio`** y su gemelo del catálogo: «(19.4326, -99.1332)»
  se queda con punto: las coordenadas se pegan de un mapa así.
- **`shell.licencia.gracia` / `.aviso`**: «Sua licença do SPACE OS está vencida
  desde {vence}. O sistema deixará de funcionar a partir de {finGracia}.» y
  «Vencimento da sua licença do SPACE OS: {vence}.» (sin «em {fecha}»).
- **`cuenta.publica.vencio-el`**: «vencimiento: {fecha}» → «vencimento: {fecha}».
- **`cuenta.publica.mapa.parcial.*`**: el inglés dice lo mismo en `.uno` y
  `.otros`; el portugués concuerda («não tem» / «não têm»).
- **`admin.password.no-se-ve`**: sin pronombre que suponga el género de
  {nombre} («no primeiro acesso, o sistema pedirá para trocá-la») — la lección
  del L5 italiano.
- **`admin.razones.de-baja`**: «Desativadas: {n}» (sin plural que elegir) — la
  lección del L5 italiano («1 disattivate»).
- **`admin.act.modo.*`**: «Modo alterado: automático / com aprovação», no el
  calco «alterado para com aprovação». `admin.act.automatica` es **Automático**
  (el *modo*), no Automática.
- **`admin.orgs.reservado-texto`** + `admin-plataforma`: «reservado ao{admin}»
  con « administrador da plataforma» (el espacio va en el hueco, como el español).
- **`admin.loop.propios.*`**: «{n} de {pantallas} tem / têm…»; `{pantallas}`
  ya dice «telas digitais».
- **`admin.fiscal.constitucion-ejemplo`**: «lavrada pelo tabelião nº 45 de
  Guadalajara» (el notario mexicano, en el vocabulario notarial brasileño).
- **`admin.papel.codigo.*`**: LOCAÇÕES · ATIVOS · LICENÇAS · OPERAÇÃO · VENDAS.
- **`notificaciones.cobranza.vence.detalle.cero`**: «vence hoje», sin `{n}`
  (como el «due today» inglés y el «scade oggi» italiano).
- **`notificaciones.correo.*` y `cuenta.correo.*`**: traducidos, pero van en el
  idioma de la INSTANCIA, que no puede ser `pt` hasta la tarea roja P3: no se
  verán antes.
- **Errores del servidor: las tablas de huecos NO dejan pasar lo desconocido.**
  En italiano `deTabla` devuelve la entrada tal cual si no la conoce. En
  portugués eso daría «ele negociación inventada»: `deTablaPt` / `listaPt`
  dejan la marca `SIN_ITALIANO` y el mensaje entero cae al español (la regla
  de «nunca a medias»). Solo afecta al portugués.
- **`ETAPA_PT`** lleva su verbo («ainda é um prospect», «está em negociação»,
  «foi perdido»), porque la plantilla es «…prospect: ele $1» y «ele está um
  prospect» no se dice.
- **El predio lejano**: la preposición va en el hueco, como en italiano: «A tela
  está a 2,5 km do imóvel “Norte”», «“P1” está a 800 m de “P2”, que já está no
  imóvel “Sur”».
- **«“$1” cannot be sold yet»** → «O ponto “$1” ainda não pode ser vendido»: el
  sustantivo evita el género del nombre.
- **Patrones de fecha**: «até $1», «a partir de $2», «venceu ($1)»; ningún «em $n».
- **Cifras del servidor**: `cifraPt` (= `cifraIt`, los mismos signos) en
  porcentajes, horas, distancias, MB y «Debe ser mayor que».
- **Costura interna**: los motivos de la calculadora, la ubicación, la
  validación de correo y contraseña y «No puede ser mayor que» dicen **lo
  mismo** en el diccionario y en el catálogo del servidor (comprobado).

## 4 · Cognados declarados

101 claves de la interfaz y 9 del servidor se escriben igual que en español o
inglés y están declaradas, con su texto, en `COGNADOS_PT_L5` /
`COGNADOS_SERVIDOR` (`textos/portugues-l5.test.ts`): «Cancelar», «Entrar»,
«Comercial», «Clientes», «Semanal», «Bimestral»…, «Dashboard», «Network»,
«Space Eyes», «RFC», «CURP inválida», «Contrato», «Código». La prueba exige
que sigan siendo iguales (si uno se traduce, se quita).

## 5 · Pruebas

- **Prueba estática** `lib/i18n/textos/portugues-l5.test.ts`, **en rojo
  primero**: con el portugués vacío, 18 de 36 rojas (cada ámbito sin portugués,
  catálogos y patrones). Mira el diccionario entero, sin depender de lo que
  rinda una pantalla: cada clave con portugués; ninguna igual al español o al
  inglés salvo cognados; `.uno` ≠ `.otros`; comillas curvas; fechas sin
  preposición (sobre los cinco lotes); catálogos, campos y firma completos y
  distintos; patrones con los mismos `$n` que el inglés y su función portuguesa
  donde el inglés la tiene; tablas de huecos con las claves del inglés; el
  predio lejano, el bloqueo del cliente y la etapa desconocida.
- **Pantallas en portugués** (`pantallas-admin`, `pantallas-cuenta-shell`,
  `pantallas-compartidos`): cada estado rendido en `pt` pasa el barrido del
  italiano (`culpablesEnItaliano`, que sirve tal cual: ninguna frase española
  ni inglesa de los diccionarios del lote) y `huellasEnPortugues`. Compartidos
  comprueba además el portugués esperado de cada pieza. 74 estados nuevos.
- **`lib/test/barrido-portugues.ts`** (`espanolPendienteDeOtrosLotes`): en
  portugués lo que falta cae al español, y una pantalla del lote lleva texto de
  otros lotes aún sin traducir («Ubicación de las pantallas», de propuestas).
  Esto aparta ese español —solo trozos largos y solo los que no dice también
  una clave ya traducida— para que el barrido no lo achaque al lote. Su prueba
  exige que no esconda nada del lote.
- **Pruebas reescritas** (afirmaban el portugués VACÍO de la ola 0), sin perder
  lo que medían: `cobertura-portugues.test.ts` (la caída al español se mide con
  una clave pendiente de otro lote; el lote L5 sin pendientes; «muerde»
  restaura las claves en vez de borrarlas), `errores-servidor-portugues.test.ts`
  (la caída se ve quitando a mano una pieza y devolviéndola),
  `catalogos-portugues.test.ts` (acceso, papeles y campanita en portugués;
  checklist de OT, Space Eyes y notas de versión siguen igual: son de otros
  lotes) y el bloque portugués de `pantallas.test.ts` (la entrada ya sale en
  portugués).

### Mutantes (14/14 mueren)

Aplicados de uno en uno con `scratchpad/pt-l5/mutar.js` contra las siete
pruebas del lote y restaurados (`git status` limpio). Contra unitarias; las e2e
no se mutaron (no se corrieron, §8).

| # | Mutante | Resultado |
|---|---|---|
| M1 | una clave de shell igual al español | muere |
| M2 | un `.uno` igual a su `.otros` | muere |
| M3 | «em {vence}» | muere |
| M4 | comillas « » | muere |
| M5 | la tabla de etapas indulgente (`deTabla`) | muere (2) |
| M6 | un patrón sin la cifra brasileña | muere |
| M7 | la periodicidad sin «catorcenal» | muere |
| M8 | un mensaje del catálogo igual al inglés | muere |
| M9 | el barrido esconde lo ya traducido | muere |
| M10 | el plural de «que o tem/têm como agência» al revés | muere |
| M11 | el predio sin preposición | muere |
| M12 | un campo de la firma en español | muere |
| M13 | la campanita `.cero` sin «hoje» | muere |
| M14 | un literal español en una pieza compartida | muere (2) |

## 6 · Español, inglés e italiano idénticos — medido

| Medición | Resultado |
|---|---|
| Volcado de TODA la suite (`I18N_VOLCAR_TODO`, sin `cifras-formularios.test.ts`), antes (`e018b1bb`, árbol limpio) y después, mismo día | 4735 → 4825 archivos. `diff -rq`: **0 distintos** de es/en/it; 1 «solo en antes», el estado `lang="pt"` de `pantallas.test.ts` cuyo nombre cambió; 75 nuevos, todos de las pruebas portuguesas nuevas; `_italiano.txt` solo cambia el orden (ordenado, idéntico); `_portugues.txt` solo gana 88 líneas |
| Fuentes | el diff de `diccionario.ts`, `errores-servidor.ts` y los seis `textos/` solo retira los comentarios y declaraciones vacías de la ola 0 (`PT_* = {}`); ninguna línea de ES, EN o IT |
| `crearTenant` (H2) | transpilado sin comentarios, el JS es idéntico al de antes |

## 7 · Espejo (`I18N_VOLCAR_PT`)

- **Sobre las pantallas del lote** (`pantallas-admin`, `-cuenta-shell`,
  `-compartidos`, `pantallas`): 333 HTML, **0 huellas** (`_guardias.jsonl` no
  se crea). Las pruebas portuguesas nuevas, además, aplican
  `huellasEnPortugues` estado por estado.
- **Sobre toda la suite**: 2147 estados, **309 huellas en 39 estados**, las
  mismas de la ola 0 y de los mismos tres archivos (documento imprimible,
  contrato y ejemplos de captura del alta de pantalla: P3 y P2). **Ninguna de
  los ámbitos del lote.**
- El espejo pinta la **404** con el inglés de la prueba de origen (es un Server
  Component cuyo idioma fija el simulacro): no es un hallazgo; la prueba
  portuguesa de `pantallas-cuenta-shell` la rinde en `pt` de verdad.

## 8 · Lo que no se hizo, y por qué

- **H2 de la validación de la ola 0** — **hecho** (commit aparte): `crearTenant`
  acepta `IdiomaEnLaBase`. Solo tipo; JS idéntico.
- **H3 (`<html lang="pt">` en vez de `pt-BR`)**: no se tocó. Cambia el HTML del
  layout y varias pruebas lo fijan; es del recorrido en el navegador. Anotado.
- **H1** (con preferencia de cuenta guardada, el portugués no se alcanza tras
  entrar): depende de la tarea roja P3; sin cambios.
- **La costura** (`textos/costura.test.ts`) no se extiende al portugués: con un
  solo lote no hay dos versiones que coser. Se extiende al integrar el segundo.
- **Las e2e** no se corrieron: el lote no toca sesión, tenant (el cambio de
  `tenant.ts` es solo de tipo), dinero en base ni migraciones.
- `<html lang>`, CSV del estado de cuenta, contrato y papeles: de otros lotes o
  de P3.

## 9 · Suites y recuentos (medidos en este árbol)

- `cd apps/web && npm run typecheck`: limpio.
- `cd apps/web && npm test`: **419 archivos, 8854 en verde + 1 omitida**, 1
  roja: `scripts/semilla-catalogo-demo.test.ts` agota sus 5 s con la máquina
  cargada; sola pasa 29/29. Ya fallaba igual en el volcado de antes
  (`e018b1bb`): no es del lote.
- `cobertura-portugues.test.ts`: las 11 filas del lote, **0 pendientes**; total
  1346 con portugués, 4597 pendientes (de los otros cuatro lotes).
- `node scripts/recuentos.mjs`: 160 endpoints, 66 tablas, 125 migraciones, ADR
  hasta 0049, 118 notas, 1680 enlaces, 3 wikilinks rotos (los ADR de siempre),
  0 huérfanas.

## 10 · Dudas para el dueño

Decididas por el traductor con su porqué (§2); el dueño puede cambiarlas, y
mejor antes de que los otros cuatro lotes las copien:

1. **Pantalla = *ponto* (inventario) / *tela* (digital)**, como el italiano
   *impianto/schermo*. Alternativa: *ponto* para todo.
2. **Catorcena = *bissemana*** (el término del outdoor brasileño). Si la
   catorcena mexicana no debe sonar a «outdoor», la alternativa es «período de
   14 dias».
3. **Rol de una persona = *perfil*; papel de una razón social = *papel*.**
4. ~~**Dueño = *Proprietário***~~ → **Titular** (decidido por el dueño, 05/11).
5. **«a Network»**, femenino. El italiano eligió «il Network».
6. **Captación = *Captação de pontos*.**
7. **Los avisos de captura de cifras** dicen hoy la verdad mexicana; la tarea
   roja `feat/portugues-cifras` los cambia (texto propuesto en §3).
8. **H3 · `<html lang="pt">` o `pt-BR`**: para el recorrido.

## 11 · Correcciones de la validación (ÁMBAR, 05/11)

Respuesta a `docs/i18n/validacion-portugues-l5.md`. Commits `9f3d5bda` (textos y
pruebas) y `bcb3a867` (`lang="pt-BR"`).

**Decisiones del dueño (05/11):** Dueño = **Titular** en todo el portugués
(rol, «Nome / E-mail / Senha do Titular», «o Titular entra com o Google», el
candado, el control de cambios). Los dos choques del validador: «sem
proprietário» (del ponto) → «sem locador»; «o operador proprietário» → «o
operador a que pertencem». Se quedan *Captação de pontos*, *ponto/tela*,
*bissemana*, *perfil/papel* y «a Network» en femenino. «o proprietário» de
`FALTA_REVISION_PT` se queda: es el dueño del espacio que se negocia, no el rol.

**Los cinco hallazgos, corregidos:** «(E ou O)» en `servidor.ubicacion.orden` y
su gemelo del catálogo; `cuenta.publica.mapa.parcial.*` = «Pontos sem
coordenadas cadastradas: {faltan} de {n}. Os endereços estão na lista de
pontos.» (declarada invariable); «como aparece na Constancia de Situación
Fiscal» (el documento mexicano, por su nombre, como el RFC); «E-mail do
Titular»; «não é da sua empresa».

**Retoques §2.2 (6–18): aceptados los trece.** Notas: el 9 queda «livre(s)» en
la clave y en el patrón, que deben decir lo mismo (la forma de la clave la
elige `{espacios}`, no `{libres}`, así que no cabe un plural real); el 12 deja
«Código postal inválido (5 dígitos)» igual al español y se declara cognado; el
13 pone el filtro en masculino («Programático» de un ponto, también cognado);
en el 17 el inciso de `admin.correo.modal.afecta` termina en punto y no en
raya. `bloqueoClientePt` (8) deja la marca ante una pieza desconocida.

**H3 de la ola 0:** `langDelHtml` (`idiomas.ts`) da `pt-BR` para `pt`; es, en e
it, igual que siempre. Lo usan `app/layout.tsx` y `app/global-error.tsx` (que
lo relee con `normalizarIdioma`). No toca sesión ni middleware.

**Pruebas nuevas, en rojo primero** (9 rojas de 286 en los cuatro archivos):
guardia de **tuteo** sobre todo `PT_PARCIAL`, el catálogo y los patrones
(`tu/teu/tua/tens/podes/…` y «Tenta/Escolhe/Digita/Clica»; `{tu}` es hueco),
con su prueba de que muerde; el bloqueo del cliente con «3 órdenes» sale entero
en español; Titular y ningún «proprietário»; «E ou O»; el mapa parcial
invariable; ni «constância» ni «não é próprio»; `lang="pt-BR"` en el layout y
en la página de error global.

**Mutantes: 7/7 mueren** — A1 «Tenta de novo» (el MV2 del validador), A2 el
bloqueo deja pasar la pieza, A3 `lang` sin variante, A4 `lang` con locale en
es/en/it, A5 «L ou O», A6 «Proprietário», A7 el mapa parcial en plural.

**Medido:** `DICCIONARIOS.es/.en/.it` y `traducirError` es/en/it (catálogo,
lib, 30 campos × 2 motivos y los patrones tocados) antes (`390e6e34`) y después:
JSON de 1 185 855 bytes, `cmp` idénticos. Volcado de toda la suite contra el de
`e018b1bb`: 0 HTML distintos de es/en/it (el único «solo antes» es el estado
`lang="pt"` renombrado; 75 nuevos, portugueses). typecheck limpio; `npm test`
419 archivos, **8863 en verde + 1 omitida**, 1 roja ajena (la semilla por
tiempo, la de siempre).

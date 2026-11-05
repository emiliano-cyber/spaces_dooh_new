# Revisión · Lote L3 del portugués (inventario, arrendadores y operaciones)

**Fecha:** 2026-11-05 · **Rama:** `feat/portugues-l3-inventario`, sobre
`integra/portugues` (`72b33050`) · **Tablero:** `vault/03-Frontend/portugues-olas.md`
(subsección «Lote L3») · **Encargo:** traductor del lote L3 del portugués (pt-BR);
lo revisa un validador independiente. Equivalente del L3 italiano
(`docs/i18n/revision-italiano-l3.md` y su validación), con sus lecciones aplicadas
desde el principio: prueba estática del diccionario entero (H7), ninguna
preposición ante una fecha en hueco (H1), la cabecera «Pagado el» sin fecha
reescrita como «Data do pagamento» y el ejemplo es/en del visor ya protegido (H8).

## 1 · Qué se tradujo

| Ámbito | Archivo | Claves | Antes | Después |
|---|---|---:|---:|---:|
| operaciones (disponibilidad, almacén, imprenta) | `lib/i18n/textos/operaciones.ts` | 177 | 0 | 177 |
| operaciones2 (OT, ficha de OT, creativos, lista por omisión) | `lib/i18n/textos/operaciones2.ts` | 205 | 0 | 205 |
| inventario | `lib/i18n/textos/inventario.ts` | 360 | 0 | 360 |
| arrendadores y contratos (con la constancia) | `lib/i18n/textos/arrendadores.ts` | 444 | 0 | 444 |
| **Total** | | **1186** | **0** | **1186** |

Los cuatro `PT_<ÁMBITO>` pasan de `Partial<Record<…>>` a `Record<…>`: una clave
nueva sin portugués ya no compila (mutante M9). `coberturaPortugues()`: las cuatro
filas a **0 pendientes**, `problemasPortugues()` vacío. Total del portugués:
2532 con portugués, **3411 pendientes** (de L1, L2 y L4; eran 4597).

Fuera de los diccionarios, **un solo componente**: `NuevaPantallaForm.tsx`, el
`alt` de la vista previa de la imagen promocional, que el italiano ya sacaba del
diccionario (`idioma === 'it'`) y ahora también el portugués («Pré-visualização»).
En español e inglés sigue el literal `preview` (lo fija la prueba del italiano).
`lib/i18n/checklist-ot.ts` no necesitó cambios: la lista por omisión de una OT
sale de `operaciones2` y ya pinta portugués (`catalogos-portugues.test.ts`, la
igualdad con el español se rompe a propósito, como manda su cabecera).

**No se tocó** `importeDeRevision` (`PanelFirmas.tsx`): con la interfaz en
portugués el paso de revisión de firmas recita el importe a la mexicana
(«$10,000.00 MXN»). Lo corrige la rama de los documentos; aquí la prueba lo
aparta con su porqué, como hacían la guardia inglesa y la italiana.

## 2 · El glosario propio

En `vault/03-Frontend/portugues-olas.md`, subsección «Lote L3», solo lo que no
está en §2 bis. Lo esencial:

| Español | pt-BR | Por qué |
|---|---|---|
| pantalla (inventario en general) | **ponto** (masc.: «livre», «ocupado», «{n} selecionados», «Nenhum ponto coincide») | §2 bis; el validador del L5 lo pidió fijado aquí |
| **espectacular** | **Painel** | propuesta del validador del L5; *outdoor* en Brasil es otra cosa |
| **valla** | **Outdoor** | la valla mexicana (cartel de papel a nivel de calle; el inglés dice *Poster panel*) es exactamente el *outdoor* 9×3 brasileño |
| muro | **Empena** | el muro publicitario de un edificio; *muro* en pt-BR es la barda |
| puente | **Passarela** | la publicidad en puentes peatonales |
| mobiliario urbano (parabús/mupi/publitienda) | Mobiliário urbano (abrigo de ônibus/mupi/expositor em loja) | |
| pantalla digital (tipo de medio, opciones de OT) | **Tela digital** | §2 bis |
| artículo del almacén de tipo «Pantalla» | **Tela** | es un aparato, no un ponto (el «schermo» del italiano) |
| propia (pantalla, predio) | **própria / próprio** («pontos próprios», «Ponto próprio») | |
| alta manual · carga masiva · plantilla | **cadastro manual · importação em massa · modelo** | lo que dicen los sistemas brasileños |
| almacén · bodega · traslado · dar de baja | **almoxarifado · depósito · transferência · dar baixa / baixado** | §2 bis + «baixado» como estado |
| etiqueta / número de inventario | **plaqueta / número de patrimônio** | el término de control patrimonial brasileño |
| imprenta · proveedor | **Gráfica · fornecedor** («Gráfica fornecedora») | §2 bis |
| montaje (de lona, de la orden de impresión) | **instalação** | en mídia OOH brasileña se *instala* la lona |
| OT | **OS** (fem.: «Nova OS», «OS atrasada», «OS encerrada») | §2 bis |
| cerrar una OT | **encerrar** | «fechar» queda para la ventana |
| candado de facturación | **bloqueio de faturamento** («mantêm o faturamento bloqueado», «Bloqueio de faturamento ativado») | la lección H6 del italiano: no calcar «candado» |
| fecha compromiso | **prazo** | |
| fotografía comprobatoria · evidencia · sello de ubicación | **foto de comprovação · comprovação · carimbo de localização** | §2 bis (*checking*) |
| costo real · estimación · rentabilidad | **custo real · estimativa · rentabilidade** | |
| creativo | **criativo** (masc.: «1 criativo», «{n} criativos em rodízio») | |
| arte · reemplazar el arte | **arte · substituir a arte** | |
| arrendataria (nuestra empresa) | **locatária**; en la constancia, **O LOCATÁRIO** (la parte del contrato, como en `papeles-portugues.ts`) | |
| emplazamiento · cuadre | **local · conciliação** | |
| depósito (del contrato) | **caução** | la garantía de la Lei do Inquilinato |
| incidencia · reportar | **ocorrência · registrar** | |
| licencia municipal · permiso ambiental · dictamen estructural · permiso | **alvará municipal · licença ambiental · laudo estrutural · licença** | los papeles municipales brasileños |
| folio (de una licencia) | **Número** | es el número de la autoridad, no nuestra «Ref. interna» |
| autoridad que la expide · expedición | **órgão emissor · emissão** | |
| domicilio | **endereço** (fiscal: «endereço fiscal», como admin) | |
| efectivo · tarjeta | **dinheiro · cartão** | |
| sello SHA-256 | **selo SHA-256** | |
| firma autógrafa | **assinatura de próprio punho** | |
| distrito / alcaldía | **Bairro / região** | |
| caras | **Faces** | |
| P&L | **DRE** | §2 bis |

## 3 · Clave por clave, lo no obvio

**Fechas en hueco (regla común, y la H1 del italiano).** Ninguna preposición
delante: `ficha.cerrada-el` «Encerrada: {fecha}», `pago.pagado-el` «Pago:
{fecha}{metodo}.», `versiones.archivada` « · arquivada: {fecha}»,
`versiones.firmo-el` «{parte}: assinado por {nombre} · {fecha}»,
`licencias.vence` «vence: {fecha}», `firmas.congelado` «Documento congelado:
{fecha}. Selo SHA-256: {hash}», `firmas.envia` «Vence: {fecha}»,
`wizard.arrendado-hasta` / `wizard.historial` «…locado até {fin}. O contrato novo
… a partir de {desde}.», `wizard.pantalla-historial` «O início da vigência que
você informou é {inicio}: volte à etapa 2 e mude-o para {desde} ou depois.» La
cabecera de columna `pagos.col.pagado-el` («Pagado el», sin hueco) es «Data do
pagamento». La prueba estática del lote lo mira con los huecos de fecha PROPIOS
(`{fechaFin}`, `{cuando}`… cualquiera cuyo nombre diga fecha), no solo con la
lista de la regla común.

**La constancia de firmas (`arrendadores.constancia.*`, 13).** Es un papel: va
en el idioma de los documentos de la instancia, y `papeles-portugues.ts` (rama
`feat/portugues-documentos`, P3, `8ff73e17`) ya la escribe. No está en este árbol;
la copié **idéntica** de esa rama salvo `.intro`: allí dice «Este documento foi
selado **em {fecha}** e assinado…», que choca con la regla común (y con la prueba
del L5 en cuanto las dos ramas se junten, porque `PT_PAPELES` entra en
`PT_PARCIAL`). Aquí: «Data do selo: {fecha}. Este documento foi assinado
eletronicamente pelas partes indicadas. O selo SHA-256…». **Para la costura**:
`papeles-portugues.test.ts` se pondrá rojo por esa clave (es lo que debe hacer);
alguien decide. Mi propuesta: quedarse con la de este lote y corregir la de P3.

**Plurales que el español no distingue.** `carga.filas.uno/.otros` y
`carga.duplicados.uno/.otros` dicen lo mismo en español («{n} filas leídas»,
«{n} código(s) ya existen»); en portugués van en singular y plural de verdad
(«1 linha lida», «1 código já existe»). `carga.imagenes-cargadas` igual.

**Concordancias que dependen de quién elige la forma.** `creativos.vacio.sin-digitales-detalle`:
«Você tem {n} campanha, de mídia fixa…» / «Você tem {n} campanhas, todas de mídia
fixa…» (un «Sua 1 campanha» calcado del «Tus 1 campaña» se leía mal).
`arrendadores.completar.le-falta`: la lista llega unida con comas, de uno o
varios datos: «Falta: {lista}.», que vale para los dos.

**`{parte} firmó {nombre}`.** En español la parte va de sujeto («El arrendador
firmó Juan…» = por el arrendador firmó Juan). En portugués «{parte}: assinado por
{nombre}» evita el sujeto doble.

**Avisos de captura.** `tabla.cifra-ilegible`, `renta.ilegible`,
`tarifa.ilegible`, `wizard.renta-ilegible` y `carga.precio-m2-ilegible` dicen la
verdad de HOY: «a vírgula separa os milhares e o ponto, os decimais (65.50)». La
tarea roja `feat/portugues-cifras` los reescribe con la captura brasileña.

**Correo de ejemplo.** `contacto@arrendador.com` está escrito a mano en el alta
de arrendador (`arrendadores/page.tsx:702`), igual en todos los idiomas; no es
del diccionario y no se tocó (la prueba lo aparta como dato).

**Dueño = Titular** (`inventario.sin-permiso`). «Arrendador (dueño del espacio)»
es «Locador (dono do espaço)»: ahí es el dueño del inmueble, no el rol.

## 4 · Cognados declarados (102)

En `textos/portugues-l3.test.ts` (`COGNADOS_PT_L3`), cada uno con su valor:
palabras que en portugués se escriben igual (Contrato, Tipo, Marca, Modelo,
Material, Lona, Clima, Vandalismo, Cheque, Programado, Vigente, Normal, Alta,
Urgente, Instalado(s), Registrar, Renovar, Completar, Indicadores, Todos, Tarifa,
Existente, Próximo…), las que coinciden con el inglés (Status, Faces, Latitude,
Longitude, Checklist), siglas (RFC, RUC, IA/Vision, HTML) y huecos sueltos
(«{n} de {total}», «“{nombre}”», «{campo}: {valor}», «{desde} a {hasta}»). La
lista se vigila a sí misma: si uno se traduce, la prueba exige quitarlo (M10).

## 5 · Pruebas

- **Estática** `lib/i18n/textos/portugues-l3.test.ts` (nueva): cada clave con
  portugués; ninguna igual al español ni al inglés salvo cognados; `.uno` ≠
  `.otros`; comillas “ ”; ninguna fecha en hueco con preposición (huecos del
  lote); glosario: ninguna «OT», «pantalla», «espectacular», «arrendador»,
  «renta» ni «predio» en portugués (sin contar los nombres de hueco),
  espectacular = Painel, valla = Outdoor, pantalla digital = Tela digital,
  «outdoor» solo en la valla; la constancia igual que P3 salvo la intro.
  **Rojo primero, a la vista: 8 de 22 en rojo** (las cuatro «cada clave tiene
  portugués» y las cuatro de plurales), con los diccionarios vacíos.
- **Pantallas en portugués** (como L5: barrido `culpablesEnItaliano` con el
  portugués en su sitio + `espanolPendienteDeOtrosLotes()` + `huellasEnPortugues`
  + frases portuguesas por estado):
  - `pantallas-operaciones.test.ts`: todos sus estados;
  - `pantallas-operaciones2.test.ts`: todos sus estados + el dinero en portugués con
    las monedas de la instancia (`leerDinero(…, 'pt', …)`);
  - `pantallas-inventario-arrendadores.test.ts`: todas sus pantallas + el `alt` de la
    vista previa del alta manual en portugués.
  Lo que se aparta, con su porqué en la prueba: las palabras sueltas de OTROS
  lotes que dicen lo mismo que una clave de este (el tipo de medio, el estatus
  del sitio, del contrato y del pago de Comercial, L2; los estados de OT y de
  impresión de Campañas, L4) —las de este lote sí salen en portugués y están en
  las listas—, los datos de prueba, el documento del contrato y la constancia
  (papel de la instancia) y el importe de `importeDeRevision`.
- **Efecto sobre el L5:** al traducir `inventario.tipo.pantalla-digital`, el
  trozo «Pantalla digital» dejó de apartarse solo en las pruebas portuguesas
  de `pantallas-admin` (Network) y `pantallas-cuenta-shell` (portal y propuesta
  pública): ahí lo pinta `comercial.tipo-medio.pantalla-digital` (L2, aún en
  español), y `espanolPendienteDeOtrosLotes()` no aparta un trozo que también es
  el español de una clave ya traducida (a propósito). Se añadió a su lista de
  ignorados con el porqué; se quita cuando L2 traduzca su tipo de medio.
- `catalogos-portugues.test.ts`: la lista por omisión de una OT ya sale en
  portugués; la igualdad con el español se rompe a propósito.

### Mutantes (12/12 mueren, contra unitarias)

Aplicados uno a uno con un guion fuera del repo, restaurados (`git diff --stat`
igual antes y después). Contra `lib/i18n/textos/`, las tres pruebas de pantallas
del lote y `catalogos-portugues`; M9 contra `tsc`. Las e2e no se mutaron.

| # | Mutante | Resultado |
|---|---|---|
| M1 | «Nova OS» vuelve a «Nueva OT» | muere (3) |
| M2 | `vence.hace.uno` = plural | muere (1) |
| M3 | «Vence em {fecha}» en el panel de firmas | muere (2: la regla común y la del lote) |
| M4 | el `alt` del alta solo para `it` | muere (1) |
| M5 | espectacular = «Outdoor» | muere (2) |
| M6 | «OT» en vez de «OS» | muere (2) |
| M7 | comillas « » | muere (2) |
| M8 | tuteo «Escolhe» | muere (2) |
| M9 | una clave sin portugués | muere (`tsc` TS2741) |
| M10 | un cognado declarado se traduce y la lista no se toca | muere (1) |
| M11 | la intro de la constancia como P3 («selado em {fecha}») | muere (3) |
| M12 | «Novo arrendador» | muere (1) |

## 6 · Español, inglés e italiano idénticos — medido

- `DICCIONARIOS.es/.en/.it` + `traducirError(es/en/it)` sobre el catálogo, los
  campos y la firma: volcado JSON antes (sobre `72b33050`, sin tocar nada) y
  después: **1 245 826 bytes, `cmp` idénticos**.
- `I18N_VOLCAR_TODO` de toda la suite (sin `cifras-formularios` ni
  `middleware`), antes y después: **4825 → 4950 archivos, 0 HTML distintos**,
  0 desaparecidos; lo nuevo son 104 carpetas/archivos de los estados portugueses nuevos del lote, `_italiano.txt`
  ordenado idéntico, `_portugues.txt` solo crece.

## 7 · Espejo (`I18N_VOLCAR_PT`) sobre las tres pruebas del lote

**81 huellas en 18 estados, las mismas de la ola 0** (§5 de `portugues-olas.md`):
todas del **documento del contrato** («2 de noviembre de 2026», «a.m.», «9:00 AM»,
papel de la instancia, P3) y del navegador del firmante («Mozilla/5.0», un dato).
`pantallas-operaciones` y `pantallas-operaciones2`: 0.

## 8 · Lo que no se hizo, y por qué

- E2e y build: el lote no toca sesión, tenant, base ni dinero en base.
- `importeDeRevision`: lo corrige la rama de los documentos (encargo).
- `costura.test.ts` no se extendió al portugués: es de la costura, con los cinco
  lotes juntos.
- El correo de ejemplo `contacto@arrendador.com`: literal de un componente,
  igual en todos los idiomas.

## 9 · Suites y recuentos (medidos en este árbol)

- `cd apps/web && npm run typecheck`: limpio.
- `npx vitest run` (sin `cifras-formularios` ni `middleware`, con el volcado):
  **418 archivos, 8936 en verde + 1 omitida, 1 roja**: `scripts/semilla-catalogo-demo.test.ts`
  por tiempo con la máquina cargada; **sola, 29/29**. Es la roja de siempre (L5).
- Antes del lote, la misma corrida: 418 archivos, 8790 en verde + 1 omitida.
- `coberturaPortugues()`: inventario 360/360, arrendadores 444/444, operaciones
  177/177, operaciones2 205/205; `problemasPortugues()` vacío.

## 10 · Dudas para el dueño

1. **valla = Outdoor, espectacular = Painel, muro = Empena, puente = Passarela.**
   Son las palabras del OOH brasileño; si se prefiere una sola familia («Painel
   rodoviário», «Painel de LED»), se cambia en `inventario.tipo.*`.
2. **«Bairro / região»** para «Distrito / alcaldía»: la alcaldía es mexicana;
   en Brasil la dirección se busca por *bairro*.
3. **«Plaqueta / número de patrimônio»** para la etiqueta del almacén.
4. **Licencias: «alvará municipal», «laudo estrutural»**: los nombres brasileños
   de esos papeles; la autoridad sigue siendo mexicana.
5. **La intro de la constancia** (ver §3): la de este lote o la de P3.

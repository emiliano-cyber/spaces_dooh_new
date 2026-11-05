# Validación · Lote L5 del portugués (armazón, cuenta, administración, compartidos y servidor)

**Fecha:** 2026-11-05 · **Rama:** `feat/portugues-l5-armazon` (`2c6dcac9`), sobre
`integra/portugues` (`e018b1bb`) · **Revisión del traductor:**
`docs/i18n/revision-portugues-l5.md` · Validador independiente: solo lee y mide;
no corrige. Todo lo de abajo está medido en este árbol.

## Veredicto: ÁMBAR (leve)

La maquinaria y el español/inglés/italiano están **limpios**: `DICCIONARIOS.es/.en/.it`
y `traducirError` en es/en/it **byte a byte idénticos** antes y después, 0 HTML
distintos de es/en/it en el volcado de toda la suite, typecheck limpio y la suite
en verde (salvo la roja conocida, que sola pasa). Las tablas de huecos no dejan
salir un mensaje a medias en ningún caso real. 8 de 9 mutantes propios mueren.

Lo que impide el VERDE son **frases portuguesas que dicen otra cosa o se leen
mal** (§2.1): una que da una regla que el servidor no acepta (**«L ou O»**), una
concordancia que **se ve en el HTML** («1 de 2 pontos não têm…»), un falso amigo
(«constância») y dos supuestos de género o sentido («E-mail dele», «não é
próprio»). Todas son de una línea. Y un hueco de prueba: **el tuteo no lo
vigila nada** (MV2 sobrevive).

## 1 · Mediciones

| Medición | Resultado |
|---|---|
| `cd apps/web && npm run typecheck` | limpio |
| `cd apps/web && npx vitest run` | **419 archivos, 8854 en verde + 1 omitida, 1 roja**: `scripts/semilla-catalogo-demo.test.ts` por timeout de 5 s; **sola, 29/29 en verde**. Falla igual en la base (abajo): no es del lote |
| `DICCIONARIOS.es/.en/.it` + `traducirError(es/en/it)` sobre las 205+ claves del catálogo, `CATALOGO_LIB`, 30 campos × 15 motivos y 5 mensajes de patrón; más `PATRONES_ERROR` (`re`, `en`, `it`) | volcado JSON en `e018b1bb` y en `2c6dcac9` (prueba temporal fuera del repo, retirada): **1 570 038 bytes, `cmp` idénticos** |
| `I18N_VOLCAR_TODO` (sin `cifras-formularios.test.ts` ni `middleware.test.ts`), base con `git switch --detach e018b1bb` en el mismo worktree y vuelta a la rama | base **4735** archivos, rama **4825**. `diff -rq`: **0 HTML distintos**; 1 «solo en antes» (el estado `lang="pt"` de `pantallas.test.ts`, que cambió de nombre); 75 nuevos (29 admin, 8 compartidos, 37 cuenta-shell, 1 `pantallas`), todos de las pruebas portuguesas nuevas; `_italiano.txt` ordenado idéntico; `_portugues.txt` solo gana 88 líneas. Las dos corridas con la misma única roja (la semilla) |
| Diff de fuentes (`diccionario.ts`, `errores-servidor.ts`, los seis `textos/`, `tenant.ts`) | las únicas líneas retiradas son los `PT_* = {}` y comentarios de la ola 0, y la firma de `crearTenant` (`Idioma` → `IdiomaEnLaBase`, solo tipo). **Ninguna línea ES, EN ni IT** |
| Llaves `{x}` del portugués contra el español (todo `PT_PARCIAL`) | iguales en todas salvo las dos `.cero` (`notificaciones.cobranza.vence.detalle.cero`, `notificaciones.contrato.vence-en.cero`), que quitan `{n}` a propósito («vence hoje»): correcto |
| Comillas « », espacios dobles | ninguno |
| Árbol al terminar | `git status` limpio en la rama, `HEAD` = `2c6dcac9` |

### 1.1 · «Nunca a medias» en los errores del servidor (sondas con `traducirError(…, 'pt')`)

| Entrada | Salida |
|---|---|
| periodicidad inventada | **entera en español** ✔ |
| periodicidad `catorcenal` | «…(periodicidade: bissemanal)…» ✔ |
| prospecto en etapa inventada | entera en español ✔ |
| revisión con una pieza inventada | entera en español ✔ (con piezas conocidas: «ainda falta: o endereço, um telefone…») |
| firma con un dato inventado | entera en español ✔ (con datos conocidos: «ainda falta 1 dado (RFC da sua empresa)») |
| campo desconocido o motivo desconocido | enteros en español ✔ |
| «Monto: Debe ser mayor que 2.5» | «Valor: Deve ser maior que 2,5» ✔ |
| predio lejano (los dos formatos que emite `contratos-sitio.ts:170-174`) | «A tela está a 2,5 km do imóvel “Norte”…» ✔ |
| cliente con «2 campañas y **3 órdenes**» | «…o cliente tem 2 campanhas e **3 órdenes**…» ✘ **a medias** — ver hallazgo 8 (latente: el servidor hoy no emite esa pieza) |

## 2 · Sentido en portugués

Leídos **todos** los `PT_*` del lote (base 119, shell 59, cuenta 125, admin 542,
compartidos 113, notificaciones 47, servidor 32, catálogo 205, campos 30, firma
12, patrones 62) y, en contexto, el HTML portugués volcado de admin (razones
sociales, Network, actualizaciones), cuenta (propuesta pública pendiente,
códigos), shell (campanita, licencia, candado) y compartidos.

### 2.1 · A corregir

| # | Dónde | Texto actual | Problema | Propuesta | Gravedad |
|---|---|---|---|---|---|
| 1 | `textos/servidor.ts:222` `servidor.ubicacion.orden` **y** su gemelo `errores-servidor.ts:1516` | «…depois a longitude **(L ou O)**» | El aviso dice una regla que el intérprete **no acepta**: `interpretar-ubicacion.ts:90` solo reconoce `[NSEWOnsewo]` y `:116` exige `E`, `W` u `O`. Quien teclee «46°38′ L» como le dice el mensaje recibe otro error. El español dice «(E u O)» | «…depois a longitude (E ou O)» en los dos sitios (las dos claves tienen que seguir diciendo lo mismo). Aceptar `L` en el intérprete sería código, fuera del lote | **media** |
| 2 | `textos/cuenta.ts:165-168` `cuenta.publica.mapa.parcial.uno/.otros` | «1 de 2 pontos **não têm** coordenadas cadastradas; **os endereços estão**…» (**en el HTML** de `propuesta pública · pendiente de aceptar`) | La forma la elige `p.items.length` (`app/(app)/p/[id]/page.tsx:351`), no `{faltan}`: con 1 que falta de 2, el verbo y «os endereços» salen en plural. La revisión §3 dice que «concuerda»: concuerda con el total, no con lo que falta | La forma del inglés, que no depende de ninguna cifra: `.uno` y `.otros` «Pontos sem coordenadas cadastradas: {faltan} de {n}. Os endereços estão na lista de pontos.» (y declararlos invariables en la prueba) | media (se ve) |
| 3 | `textos/admin.ts:2531` `admin.razones.razon-ejemplo` | «…como aparece na **constância**» | Falso amigo: *constância* es «constancia» de perseverancia; el documento mexicano no se llama así en Brasil | «…como aparece na Constancia de Situación Fiscal» (documento mexicano, se nombra tal cual, como RFC) o «…como aparece no comprovante de situação fiscal» | media |
| 4 | `textos/admin.ts:2300` `admin.orgs.su-correo` | «E-mail **dele**» | Supone que el Proprietário es hombre (la lección del L5 italiano, `admin.password.no-se-ve`, aplicada a una sola clave) | «E-mail do Proprietário» | baja |
| 5 | `errores-servidor.ts:1485` | «O lugar escolhido não existe ou **não é próprio**.» | «não é próprio» se lee «no es apropiado» | «O lugar escolhido não existe ou não é da sua empresa.» | baja |

### 2.2 · Retoques menores (no bloquean)

| # | Dónde | Actual | Propuesta |
|---|---|---|---|
| 6 | `errores-servidor.ts:2404` | «Altere-a antes nesse contrato» | «Altere-a nesse contrato antes» / «nesses contratos antes» |
| 7 | `errores-servidor.ts:1327` | «cancele/vença o contrato anterior» | «cancele o contrato anterior ou deixe-o vencer» |
| 8 | `errores-servidor.ts:2302` `bloqueoClientePt` | `if (!m) return pieza` deja pasar en español una pieza que no reconoce («3 órdenes») | que devuelva `SIN_ITALIANO`, como `deTablaPt`: es la misma regla que el lote declara y hoy solo es latente (`clientes-controller.ts:149-163` emite solo las cuatro piezas conocidas) |
| 9 | `errores-servidor.ts:2369`, `textos/compartidos.ts:534-535` | «a tela só tem 1 livres» / «0 livres» | calca el «1 libres» del español; «e a tela só tem {libres} livre(s)» o «e a tela tem livres só {libres}» |
| 10 | `errores-servidor.ts:2358`, `compartidos.ts:530` | «devem ser mais de 0» | «devem ser maiores que 0» |
| 11 | `errores-servidor.ts:2423` | «ainda falta: $1» (con una lista) | «ainda faltam dados: $1» |
| 12 | `errores-servidor.ts:1521` | «CEP inválido (5 dígitos)» | el CEP brasileño tiene 8; el código es mexicano: «Código postal inválido (5 dígitos)» |
| 13 | `textos/admin.ts:2479` vs `:2474` | filtro «Todos · Programática · Tradicional» junto a la tarjeta «Programáticos · Tradicionais» | un solo género para los pontos: «Programáticos / Tradicionais» o «Programático / Tradicional» |
| 14 | `textos/cuenta.ts:602` `cuestionario.p1.ayuda` | «isto poupa o resto» | «pode pular o resto» |
| 15 | `textos/admin.ts:2161` `tope.contrasena` | «quanto dinheiro se pode dar de presente numa venda» | «de quanto dinheiro se pode abrir mão numa venda» |
| 16 | `textos/admin.ts:2223` `costos.respaldo` | «valor de reserva» | «valor padrão» |
| 17 | `shell.candado.explicacion`, `admin.cambios.*`, `admin.correo.modal.afecta` | incisos «—tarifas…—» sin espacios (uso español) | en pt-BR la raya va con espacios: « — tarifas… — » |
| 18 | `textos/shell.ts:304` | «Apagar todas» | el glosario dice Eliminar = Excluir; para notificaciones lo idiomático es «Limpar todas» |

### 2.3 · Frases revisadas y correctas (muestra)

Registro «você» con imperativo de 3.ª persona, «Não foi possível…», «Salvar /
Excluir / Remover / Adicionar», fechas sin preposición («válida até 1 de dez. de
2026», «vencida desde {vence}», «a partir de {finGracia}», «Aceita: {fecha}») y
comillas “ ” bien en todo el lote. En el HTML: «Ao aceitar, você confirma os 2
pontos e o total de MX$ 5.800,00.», «F001-0007 · Cliente Uno — vencida há 4 dias ·
saldo MX$ 247.080», «Contrato vence em 2 dias: Predio Norte · Juan Ruiz», «Visão
de Proprietário», «Desativadas: 1», «2 ativas», «Sem papel atribuído»,
«Compartilhado / Não», «Regras de comercialização por ponto». Errores: «Valor:
Deve ser maior que 2,5», «A tela está a 2,5 km do imóvel “Norte”…», «Não é
possível enviar para assinatura: ainda falta 1 dado (RFC da sua empresa).»,
«O prazo do contrato gera mais de 100 pagamentos (periodicidade: bissemanal).»,
los cinco del tope de
descuento (`cifraPt` en cada `%`). `ETAPA_PT` con su verbo («ainda é um
prospect», «foi recusado») está bien resuelto. Lo que cae al español en esas
pantallas («Ubicación de las pantallas», «Disponible», «Reservado · sin OC»,
«Pantalla digital») es de otros lotes, como manda D3.

## 3 · Mutantes propios (contra `lib/i18n` y `lib/test`, unitarias)

Aplicados uno a uno con `scratchpad/val-pt-l5/mutar.mjs` y `mutar2.mjs`,
restaurados, `git status` limpio al acabar. Las e2e no se mutaron (el lote no
toca sesión, tenant, dinero en base ni migraciones).

| # | Mutante | Resultado |
|---|---|---|
| MV1 | patrón «Os slots do loop vão de 1 a **$2**» | muere (6) |
| MV2 | **tuteo**: `shell.carga.reintentar` = «Tenta de novo» | **SOBREVIVE** |
| MV3 | `CAMPO_PT` sin `Monto` | muere (10) |
| MV4 | `cuenta.publica.al-aceptar.otros` sin `{total}` | muere (4) |
| MV5 | la caída del portugués pasa por el italiano antes del español | muere (7) |
| MV6 | «Guardar modelo» (palabra española) en admin | muere (7) |
| MV7 | `ETAPA_PT` sin `perdido` | muere (19) |

**MV2** es un hueco real: ninguna prueba mira el registro. Un «tu/teu/tens/
Tenta» que se cuele en los otros cuatro lotes pasaría. Propuesta: en
`textos/portugues-l5.test.ts`, sobre todo `PT_PARCIAL`, prohibir
`\b(tu|teu|tua|teus|tuas|contigo|tens|podes|queres)\b` y una lista corta de
imperativos de 2.ª persona («Tenta», «Escolhe», «Digita», «Clica»), con su
prueba de que muerde. Hoy la única coincidencia es `admin.password.confirma-tu`
(«Confirme com {tu} senha»), que es la variable, no tuteo.

## 4 · Las 7 dudas del glosario (revisión §10), desde el uso brasileño

Opinión; decide el dueño.

1. **ponto / tela.** Correcto para el mercado: el OOH brasileño vende *pontos* y
   el DOOH habla de *telas*. Riesgo único: en la Network una pantalla digital
   sale como «Ponto» y en el loop como «tela»; es coherente con la regla, pero
   L3 tiene que fijar *painel* para el espectacular para que no vuelva *tela*
   ahí.
2. **bissemana.** Es exactamente el término del outdoor brasileño (la «bi-semana»
   de 14 días de la Central de Outdoor) y casa con la catorcena. Para quien
   vende digital puede sonar a papel, pero lo entiende cualquiera del sector.
   Mantener.
3. **perfil / papel.** «Perfil de acesso» es lo que dicen los sistemas
   brasileños; *papel* para la razón social es aceptable (alternativa:
   *função*). Separarlos evita el choque. Mantener.
4. **Proprietário / Dono.** *Dono* es coloquial para un rol de software;
   *Proprietário* es correcto pero **ya choca** dentro del lote: «sem
   proprietário» (del ponto, `errores-servidor.ts:1331`) y «o operador proprietário»
   (`admin.network.red-sub`). Si molesta, *Titular* (de la conta) evita los dos
   choques.
5. **a Network.** Se oye de las dos formas; femenino («a rede») es lo más
   natural en marketing brasileño. Mantener.
6. **Captação de pontos.** Se entiende; en OOH también se oye *prospecção de
   pontos/áreas*. Como el módulo trata de *prospects* de espacios, *Prospecção
   de pontos* sería igual de natural. Indiferente.
7. **`lang` pt-BR.** Recomendable `pt-BR`: es la etiqueta BCP 47 que usan el
   corrector, la partición silábica y los lectores de pantalla, y el dueño
   decidió Brasil (D1). Hoy el layout emite `lang="pt"` (medido en el volcado).
   Es del recorrido (H3).

## 5 · Qué no se midió

- E2e y build (`npm run build`): no se corrieron; el lote no toca sesión,
  tenant, migraciones ni dinero en base.
- El espejo `I18N_VOLCAR_PT` no se repitió (lo midió el traductor; el volcado
  `TODO` sí).
- Los correos (`cuenta.correo.*`, `notificaciones.correo.*`) se leyeron pero no
  se rinden en `pt` hasta P3.

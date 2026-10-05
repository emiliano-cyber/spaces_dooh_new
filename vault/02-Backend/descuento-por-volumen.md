---
tipo: contrato
estado: verificado
actualizado: 2026-10-05
tags: [backend, precios, descuentos, volumen, propuestas, dinero, snapshot, rls]
archivos:
  - apps/web/lib/periodos.ts
  - apps/web/lib/tarifa-calculada.ts
  - apps/web/lib/server/paquetes-repo.ts
  - db/migrations/20260928_descuento_por_volumen.sql
  - apps/web/lib/volumen.ts
  - apps/web/lib/descuento.ts
  - apps/web/lib/server/volumen-repo.ts
  - apps/web/lib/server/volumen-controller.ts
  - apps/web/app/api/volumen/escalas/route.ts
  - apps/web/app/api/volumen/escalas/[id]/route.ts
  - apps/web/lib/server/propuestas-repo.ts
  - apps/web/lib/server/propuestas-controller.ts
  - apps/web/lib/server/campanas-repo.ts
  - apps/web/lib/data/volumen-api.ts
  - apps/web/components/demo/volumen/GestionVolumen.tsx
---

# El descuento por volumen

**ADR 0039, Fase 2.** «Compra 50 spots y pagas 40.» El escalón que va **después**
de la tarifa base que construyó la [[rejilla-franja-y-temporada]] y **antes** del
descuento comercial:

```
tarifa base = f(pantalla, unidad, franja, fecha)     ← Fase 1
      ×  DESCUENTO POR VOLUMEN                       ← esta nota
      ×  descuento comercial (con su tope)
      ×  código promocional                          ← Fase 3, NO existe
      ×  (1 − comisión de agencia)
      =  neto
```

> [!note] 2026-10-05 · el diagrama de arriba es el del 28/09; la cadena de HOY
> Las fases 3 y 4 **existen y están en `main`**: el cupón
> ([[codigo-promocional]], `10e72087`) y el paquete ([[paquete-cerrado]]). La
> cuenta real, verificada hoy en `armarPropuesta`
> (`apps/web/lib/server/propuestas-repo.ts:142`) y repetida en el congelado
> (`congelarSnapshotEconomico`, `:336`):
>
> ```
> precio de línea = tarifa × cantidad
>                   (tarifa: franja+temporada → franja → temporada → rejilla → modalidad)
> volumen         = Σ round(precio_línea × pct_línea/100)        volumen.ts:244
> brutoConVolumen = paquete ? precio_paquete : bruto − volumen    propuestas-repo.ts:182
> comercial       = round(brutoConVolumen × comercial/100)        :196
> baseComercial   = brutoConVolumen − comercial
> cupón           = round(baseComercial × cupón/100)              :219
>                   (0 si el paquete no admite cupón, :215)
> base            = baseComercial − cupón
> neto            = round(base × divisor de comisión)             :224
> ```
>
> **El redondeo del volumen es POR LÍNEA**, no sobre el total: tres líneas de
> 1 003 al 15 % descuentan 150 × 3 = **450**, y `round(3 009 × 0,15)` daría
> **451**. Y **con paquete el volumen vale cero** (`propuestas-repo.ts:181`): el
> precio del conjunto ya lo lleva dentro.

> [!warning] Alcance
> Esta nota describe **solo** el volumen. Si un documento te habla de códigos
> promocionales o paquetes cerrados dentro de esta fase, describe trabajo que no
> se ha hecho.
>
> *(2026-10-05: «dentro de esta fase». Los dos existen hoy como fases propias:
> [[codigo-promocional]] y [[paquete-cerrado]].)*

> [!danger] SIN FUSIONAR — la migración espera aprobación del dueño
> Desde el **2026-09-28**, ningún cambio de base de datos aterriza sin que el
> dueño lo apruebe antes. La migración está escrita y probada contra bases
> desechables; lo que está detenido es la **fusión**, no el trabajo. El motivo
> no es ceremonia: cada migración que entra a `main` acaba corriendo en **g500**,
> la única instancia con datos de cliente reales, y su runner **se para en seco**
> si algo no cuadra. Una migración de más es una cola de despliegue detenida.
>
> **2026-10-05 · ya está FUSIONADA.** El commit `22c75a72` es ancestro de
> `main` y `db/migrations/20260928_descuento_por_volumen.sql` está en el árbol.
> El recuadro se conserva como historia de cómo se aprobó.

---

## 1 · Qué se añadió

| Qué | Dónde |
|---|---|
| `escalas_volumen` | Tabla nueva. Los tramos de la organización, por unidad de venta |
| `propuesta_items.descuento_volumen_pct` | Columna nueva. `0` = sin volumen |
| `propuesta_items.volumen_desde` | Columna nueva. El umbral que lo ganó. `NULL` = ninguno |
| `reservas.descuento_volumen_pct` | Columna nueva. Se hereda al generar la campaña |

Todo **aditivo**. La escala nace vacía y las tres columnas nacen en cero, así que
**nada cambió de precio al aplicar la migración**.

---

## 2 · Las dos decisiones de diseño

### 2.1 · La escala cuelga de la ORGANIZACIÓN, con la UNIDAD como clave

Había cuatro opciones: la organización, la **fila de tarifa** (`pantalla × unidad
× franja × temporada`), la unidad de venta, o una mixta con anulación por
pantalla. Se eligió **organización × unidad**.

- **No la fila de tarifa**, porque obligaría a capturar tramos en cada
  combinación de la rejilla — la explosión que la Fase 1 evitó haciéndola
  dispersa. Y aquí sería peor: un tramo capturado en la combinación equivocada
  no da ningún error, simplemente se aplica donde nadie lo decidió.
- **No «a secas por organización»**, porque **50 spots y 50 meses no son la misma
  compra**. Una escala sin unidad regalaría el tramo pensado para los spots a un
  contrato de cuatro años.
- **No la mixta** por ahora: la anulación por pantalla es **aditiva más tarde**
  —una columna `sitio_id` nullable, el mismo índice con `COALESCE` que usó la
  Fase 1, y un peldaño más en la resolución— y en cambio quitarla después es
  imposible sin decidir qué pasa con lo ya capturado. Está **preguntada al dueño**.

El repositorio ya tenía la respuesta de los dos lados, y la diferencia decide: la
**tarifa** es un dato de la pantalla y vive con ella (`sitio_modalidades`,
`sitio_tarifas`); el **techo de descuento** es una política comercial del dueño y
vive en `config_negocio`. Un descuento por volumen es lo segundo.

### 2.2 · Los tramos son PLANOS, no escalonados

«A partir de 50 spots, 10 % sobre **todo**», y no «los primeros 10 a precio
lleno, del 11 al 50 al 5 %…».

1. Es la frase que un dueño de medios ya tiene escrita en su tarifario — el mismo
   argumento con el que el ADR 0039 descartó los multiplicadores.
2. Un tramo marginal produce una **tarifa unitaria mezclada** que no es ningún
   número del tarifario, y el snapshot congela `tarifaUnitaria` para que el
   reporte compare publicada contra neta.
3. Y el que decide en el esquema: en una escala plana el **solape ES el umbral
   repetido**, así que lo prohíbe un `unique (tenant_id, unidad,
   desde_cantidad)` — una restricción de la base, que nadie puede olvidar.
   Escalonado son rangos, y prohibir su solape volvería a necesitar lógica de
   aplicación como la de las franjas.

> [!warning] Lo que cuesta: el ESCALÓN
> Quien compra 49 paga más que quien compra 50, y el salto puede ser mayor que
> el precio de una unidad. Es el comportamiento estándar de un tarifario por
> volumen, y la pantalla de captura lo dice con esas palabras — pero es una
> consecuencia real, no un detalle.

---

## 3 · El volumen SÍ cuenta contra el tope de descuento (VOL-02)

**Es una decisión de negocio y está preguntada al dueño.** Mientras no conteste,
la respuesta implementada es **sí cuenta**, medida en **compuesto**:

```
descuento contra el tope = 100 × (1 − (1−volumen/100) × (1−comercial/100))
```

Con una escala del 15 % y un tope del 20 %, al comercial le quedan **~5,9 puntos**
de negociación, no 5 ni 20.

**Por qué sí:** el tope nació el 2026-09-28 porque cualquier comercial podía
regalar el 90 %. Si el volumen no contara, un 15 % de volumen más el tope entero
volvería a dejar el techo real por encima de lo autorizado. «La regla nace
cerrada y se abre a propósito» (ADR 0039 §2).

**Por qué compuesto y no sumado:** compuesto es lo que de verdad se regaló. Un
20 % y un 20 % dejan al cliente pagando el 64 %, o sea un **36 %** regalado, no un
40 %. Comparar contra el tope una suma que nadie dejó de cobrar cerraría ventas
por un margen que no se perdió.

> [!tip] Cambiarla cuesta una línea
> La respuesta vive ENTERA en `descuentoContraTope` (`apps/web/lib/descuento.ts`).
> Pasar a «no cuenta» es sustituir su cuerpo por `return descuentoValido(
> comercialPct)` y ajustar `descuento.volumen.test.ts`. Ningún otro archivo se
> entera.

> [!note] 2026-10-05 · las otras dos capas, frente al tope
> - **El cupón NO cuenta.** `CODIGO_CUENTA_CONTRA_TOPE = false`
>   (`apps/web/lib/descuento.ts:260`), y `descuentoContraTope` (`:273`) le pasa
>   un 0 a `componerDescuentos`. Lo comparado sigue siendo la fórmula de arriba.
>   Ver [[codigo-promocional]].
> - **Con paquete, el volumen tampoco cuenta**, porque no se aplicó:
>   `descuentoDePropuestaDentroDelTope` pasa `volumenPct = 0` si hay paquete
>   vivo (`apps/web/lib/descuento.ts:424`; la llama `actualizarPropuesta` en
>   `apps/web/lib/server/propuestas-repo.ts:1357`). Hasta TOPE-03 la cuenta vivía
>   dentro de `actualizarPropuesta`.
> - **Y al QUITAR el paquete el volumen vuelve**, así que se revalida el
>   comercial con él: `quitarPaquete` (`apps/web/lib/server/paquetes-repo.ts:376`,
>   comprobación en `:439`) se niega si el compuesto pasaría del tope. Commit
>   `b2d30d50`, **en esta rama y todavía no en `main`** al 05/10. Ver
>   [[paquete-cerrado]].

> [!important] 2026-10-05 · TOPE-03 · aprobar y aceptar revisan el tope VIGENTE
> El tope se validaba al **escribir** el descuento y al quitar un paquete. Si
> Administración lo **bajaba** después, ni la aprobación interna
> (`cambiarEstatusPropuesta`) ni la aceptación del cliente por la liga
> (`aceptarPropuestaPublica`) lo volvían a mirar, y el descuento por encima del
> techo vigente se **congelaba en el snapshot**.
>
> - **La cuenta es UNA**: `descuentoDePropuestaDentroDelTope`
>   (`apps/web/lib/descuento.ts:424`) — volumen sí salvo con paquete, cupón según
>   `CODIGO_CUENTA_CONTRA_TOPE`. La usan la edición (`propuestas-repo.ts:1357`),
>   la aprobación (`revisarTopeVigente`, `:1421`, llamada en `:1493`) y la liga
>   (`:976`). `quitarPaquete` sigue con su propia llamada a
>   `descuentoDentroDelTope` porque cuenta el volumen **como si ya no hubiera
>   paquete**.
> - **Aprobar** con el descuento por encima: `TopeVigenteError` → **409**
>   `descuentoSobreTope: true`, con el descuento, el total con volumen, el tope
>   y qué hacer (`mensajeTopeVigente`, `descuento.ts:449`). No se escribe nada.
> - **Aceptar por la liga**: 409 con `MSJ_TOPE_VIGENTE_PUBLICO` (`:476`), que
>   **no nombra el tope** —es un dato interno— y manda al cliente con su
>   ejecutivo. Se revisa dentro de la transacción, tras el `for no key update`
>   de la propuesta (el mismo bloqueo que ya tenía, sin cambiar el orden), con el
>   tope leído por el tenant del **token** (`config_negocio` con
>   `tenant_id` explícito); sin fila, el respaldo del 100 %.
> - **Con 0 % comercial no se revisa**, por el criterio de TOPE-PAQ: el tope
>   acota la discreción del vendedor, y si el volumen solo pasa el tope es la
>   escala por encima del techo, que se arregla en Administración.
> - **Lo ya guardado no se toca** (TOPE-01): el descuento se conserva y la
>   propuesta se sigue editando; lo que no se puede es cerrarla así.
>
> **Abierto para el dueño:** ¿una propuesta ya **ENVIADA** debe respetar el tope
> con que se envió? Lo implementado es lo conservador (el de hoy manda también
> para lo enviado). La alternativa es guardar el tope al enviar y validar contra
> ése; exige columna nueva, o sea migración. Y no hay mecanismo de «aprobación
> por encima del tope»: los techos por rol y la autorización al aprobar del
> ADR 0040 **no están construidos**; cuando lo estén, esta revisión es donde
> encajan.
>
> Pruebas: `lib/server/propuestas-repo-tope-vigente.test.ts` (11),
> `lib/descuento.tope.test.ts` (TOPE-03, 5) y `lib/test/tope-descuento.e2e.test.ts`
> (TOPE-03, 4; mutada con rebuild: 3 en rojo).

> [!important] 2026-10-05 · TOPE-04 · si el volumen SOLO ya pasa el tope, 0 % comercial SÍ se guarda
> El caso: Administración baja el tope al 5 % y la escala de la organización da
> 10 %. Hasta hoy la **edición** rechazaba incluso guardar 0 % comercial
> (`componerDescuentos(10, 0)` = 10 > 5), mientras aprobar, la liga y
> `quitarPaquete` **no revisaban** con 0 % comercial (TOPE-PAQ). Aprobar
> contestaba 409 «Ajusta el descuento» y el vendedor no podía ajustarlo a
> **nada**: solo Administración subiendo el tope lo destrababa.
>
> - **La regla vive en UN sitio**: `descuentoDentroDelTope`
>   (`apps/web/lib/descuento.ts:330`) devuelve 0 sin mirar el tope cuando el
>   comercial es 0 (`:350`). Edición, aprobación (`revisarTopeVigente`,
>   `propuestas-repo.ts:1421`), liga y `quitarPaquete` (`paquetes-repo.ts:439`)
>   pasan todas por ahí; los dos atajos `comercial > 0` que tenían aprobar y
>   quitar el paquete se quitaron. Para esas tres puertas el comportamiento es
>   idéntico; la única que cambia es la edición.
> - **Con comercial > 0 sigue rechazando** exactamente como antes si el
>   compuesto pasa el tope.
> - **El mensaje dice la salida real** (`mensajeSobreTope`, `descuento.ts:115`,
>   y `mensajeTopeVigente`, `:449`): si el volumen solo ya pasa el tope, «El
>   descuento por volumen (10 %) ya supera el tope (5 %): deja el descuento
>   comercial en 0 % o pide a Administración que suba el tope.»; si no, el de
>   siempre más «Cabe hasta X % comercial», con X de
>   `comercialMaximoDentroDelTope` (`:157`), que se **comprueba** contra
>   `descuentoContraTope` en lugar de repetir la regla. Estos mensajes no pasan
>   por el catálogo ES/EN (`respuestaError`): la ruta los devuelve tal cual.
> - **La pantalla no bloqueaba el 0 %** (`propuestas/[id]/page.tsx` solo compara
>   `d > tope`), así que no hubo que tocarla.
>
> Pruebas: `lib/descuento.tope.test.ts` (TOPE-04, 5), `lib/server/propuestas-repo-tope-vigente.test.ts`
> (§3, 3), `lib/descuento.volumen.test.ts` (la prueba que exigía rechazar el 0 %
> se invirtió) y `lib/test/tope-descuento.e2e.test.ts` (TOPE-04, 2: tope bajado
> por la API → aprobar 409 con la salida → editar a 1 % 400 → editar a 0 % 200 →
> aprobar 200). Rojo a la vista antes de implementar (7 unitarias; las 2 e2e
> contra el build viejo); mutante que quita la regla → build → 1 e2e en rojo →
> restaurar → build.

**Consecuencia que hay que tener escrita:** si el dueño deja el tope **por debajo**
de su propia escala de volumen, ninguna propuesta con volumen podrá llevar
descuento **comercial** hasta que arregle una de las dos cosas (desde TOPE-04,
05/10, dejarlo en 0 % sí se guarda y se aprueba). Eso es visible y se explica; lo
contrario —un techo que no es techo— no se ve.

---

## 4 · El servidor decide el descuento (hallazgo B40)

> [!success] 2026-10-01 · PRECIO-01: la TARIFA BASE ya también la comprueba el servidor
> El aviso de abajo describe el estado hasta el 01/10. Desde
> `feat/precio-ajustado-por-gerente`, `crearPropuestaCtrl` recalcula la tarifa
> de cada línea con `lib/tarifa-calculada.ts` (la misma función que la
> pantalla) y rechaza con 403 un precio distinto si la sesión no tiene
> `comercial.aprobar`. Ver [[comercial-propuestas-campanas]].

> [!danger] La cadena de la Fase 1 vive ENTERA en el navegador — y esto no lo arregla
> `resolverTarifa` solo se llama desde `app/(app)/(shell)/propuestas/page.tsx`,
> que es `'use client'`, y el controller copia la `tarifaUnitaria` que manda el
> cliente **tal cual**. Se puede cerrar una venta de prime a 1 peso con un `curl`
> y queda congelada en el snapshot con toda la apariencia de ser auditable.
>
> Esta fase **no** arregla aquello —mover la cadena entera al servidor cambia el
> comportamiento de cada venta y espera decisión del dueño (D11)— pero **tampoco
> lo amplía**: el escalón de volumen nace del lado correcto.
>
> **2026-10-05 · este recuadro YA NO describe el código.** Desde `17fbd252`
> (01/10, en `main`) `resolverTarifa` la llama también `tarifaCalculada`
> (`apps/web/lib/tarifa-calculada.ts:95`), módulo puro que importan la pantalla
> **y** `crearPropuestaCtrl` (`apps/web/lib/server/propuestas-controller.ts:359-375`).
> Un precio distinto de la tarifa sin `comercial.aprobar` es **403**. Se
> conserva como historia del hallazgo B40.

Cómo: el cliente manda la **cantidad**; el porcentaje lo resuelve
`propuestas-controller.ts` leyendo `escalas_volumen` bajo RLS. El `itemSchema` de
zod **no declara** `descuentoVolumenPct`, y una prueba lee el archivo para
impedir que alguien lo añada sin darse cuenta — el mismo candado que el vendedor
de VEND-01.

Y la cantidad que cuenta es la **efectiva** (`cantidadEfectiva`), la misma que
multiplica la tarifa: una `cantidad: 999` inflada a mano en una unidad de tiempo
no regala ningún tramo, porque el rango de fechas manda.

Verificado el 05/10 en `apps/web/lib/server/propuestas-controller.ts`: el
`itemSchema` (`:100`) no declara `descuentoVolumenPct`; la escala se lee una vez
por propuesta (`:213`); `volumenDelItem` resuelve el tramo (`:223-226`) con la
cantidad efectiva (`:302`, aplicada en `:324`).

> [!warning] 2026-10-05 · los meses de calendario pueden CAMBIAR EL TRAMO
> Desde `6ab3c1f2` (02/10, en `main`) la unidad `mensual` cuenta **meses de
> calendario** y no `días ÷ 30` hacia arriba: `periodosEnRango`
> (`apps/web/lib/periodos.ts:186`) busca el menor `n` con
> `finDeMeses(inicio, n) ≥ fin`, y `cantidadEfectiva` (`:205`) lo usa.
> 01/10–31/10 pasó de **2** meses a **1**; 05/10–04/12 (61 días), de **3** a
> **2**. Como el tramo se resuelve con esa cantidad, **una escala con umbral en
> meses puede dejar de aplicar** a una propuesta capturada hoy con las mismas
> fechas que una de antes. Las ya capturadas no cambian: el porcentaje está
> copiado en la línea (§5).

---

## 5 · Cómo se congela (invariante 3)

**Dos redes, no una:**

1. **Al capturar**, la línea copia `descuento_volumen_pct` y `volumen_desde`. Es
   el mismo criterio con el que ya copia `tarifa_unitaria`: mover la escala
   mañana no puede cambiar una propuesta ya cotizada.
2. **Al aprobar**, el snapshot vuelve a congelarlos, y **sin releer
   `escalas_volumen`** — una prueba lo exige. Es la diferencia con la franja, que
   sí relee su catálogo para poder congelar su *nombre*.

Lo que entra en `snapshot_economico`, **solo cuando hay volumen**:

| Campo | Qué es |
|---|---|
| `descuentoVolumenPct` | El ponderado de la propuesta entera |
| `descuentoVolumenMonto` | Lo regalado, en dinero |
| `brutoConVolumen` | `bruto − descuentoVolumenMonto` |
| `porSitio[].descuentoVolumenPct` | El de esa línea |
| `porSitio[].volumenDesde` | El umbral que lo ganó |

Un snapshot **sin** volumen es byte por byte el mismo JSON que producía la
Fase 1: los campos no aparecen. Mismo criterio que el `avisoFranja`.

> [!important] `bruto` y `porSitio[].lista` NO cambian de significado
> Siguen siendo la **lista**. El volumen se aplica como una capa explícita, y por
> eso el documento puede enseñar «subtotal − volumen − comercial». Si `lista`
> bajara, el reporte de publicada contra neta compararía la neta con una
> «publicada» que nadie publicó nunca.

---

## 6 · Por qué el ítem guarda NÚMEROS y no una FK

`propuesta_items.franja_id` es una FK compuesta con `on delete restrict` porque
una franja **contratada** es un hecho que el vendedor eligió. Un tramo de volumen
es lo contrario: **nadie lo elige**, se deduce de la cantidad y de la política
vigente el día de la captura. De él no importa la identidad, importan sus números.

Eso compra tres cosas:

- Mover la escala mañana no cambia una propuesta ya capturada.
- **Borrar un tramo nunca puede quedar bloqueado por una venta.** Con FK
  `restrict`, el primer tramo vendido dejaría la pantalla de configuración
  devolviendo un 500 sin explicar nada.
- Y por tanto **no hace falta baja lógica**: es una columna menos y un estado
  menos. Un `activo` sobre una tabla con `unique` en el umbral impediría volver a
  crear el tramo de 50 mientras existiera el de 50 apagado.

Por eso `DELETE /api/volumen/escalas/:id` **borra de verdad**, al revés que el de
franjas, y el botón dice «Eliminar» y no «Dar de baja».

---

## 7 · Lo que la migración NO hace

- **No prohíbe en la base que la escala sea no monótona** («desde 50 → 10 %»
  junto a «desde 100 → 5 %»). Eso exige mirar las filas hermanas, o sea un
  trigger, y este repositorio no tiene ninguno. El guardián es
  `motivoTramoInvalido` en `apps/web/lib/volumen.ts`, declarado una vez e
  importado por el único camino de escritura — igual que `lib/rejilla.ts` con el
  solape de franjas. Queda como pregunta abierta si se quiere además en el
  esquema.
- **No valida `unidad` contra una lista** en la base. Mismo criterio que
  `sitio_modalidades.unidad`; la lista vive en el zod del controller. El modo de
  fallo cae del lado prudente: una unidad mal escrita hace que el tramo **no
  aplique nunca**, o sea que se cobra de más.
- **No toca** `sitio_modalidades`, `sitio_tarifas`, la rejilla de la Fase 1 ni
  `config_negocio`.
- **No construye** códigos promocionales ni paquetes cerrados (fases 3 y 4).
- **No lleva `@pg-min`**: no usa nada posterior a PostgreSQL 14. Las tres
  columnas del `unique` son `NOT NULL`, así que la trampa de los NULL que la
  Fase 1 resolvió con `COALESCE` aquí no aplica.

---

## 8 · R2 · el aislamiento, y por qué su fallo no da error

`escalas_volumen` lleva RLS **fail-closed estricto** (`enable` + `force`), igual
que las tres tablas de la Fase 1: sin `app.tenant_id` fijado no se ve ni se
escribe nada. `volumen-repo.ts` añade la segunda capa —`and tenant_id = $n` en
toda operación por `id`— y `listarEscalasVolumen()` **no acepta ningún
argumento**, que es el candado de tipo contra un `tenantId` por el cuerpo.

> [!danger] El modo de fallo es silencioso
> Leer la escala sin contexto de tenant devuelve **cero filas**, y cero tramos no
> significa «error»: significa «esta organización no descuenta por volumen».
> Nadie ve un fallo; se ve una venta más cara, y quien la pierde no vuelve a
> preguntar por qué. Es el mismo molde que los dos peores fallos de aislamiento
> del proyecto.

Un tramo de otra organización da **404 y no 403**: decir «existe pero no es tuyo»
ya cuenta algo de la otra.

---

## 9 · Qué está probado, y con qué

- **`npx vitest run`: 2309 pruebas en 173 archivos** (en `main`: 2217 en 166 —
  **92 nuevas en 7 archivos**). De las existentes solo se abrieron
  `propuestas-franja.test.ts` y `propuestas-vendedor.test.ts`, para mockear un
  módulo nuevo que el controller importa, y `esquema-sin-owner.e2e.test.ts`, por
  la cuenta de tablas (49 → 50).
- **e2e**: `descuento-volumen.e2e.test.ts`, **22 pruebas** contra Postgres real,
  en base aislada. La suite completa: **49 archivos, 563 pruebas, 1 omitida**.
- **24 mutantes, todos muertos.** Cinco sobrevivieron en la primera pasada y
  **ninguno era equivalente salvo uno**: dos eran huecos de NaN sobre dinero
  —uno desactivaba el tope en silencio, otro metía NaN en el neto por sitio que
  la campaña copia a `reservas.precio`— y dos eran caminos del repositorio sin
  ninguna prueba unitaria. Están cerrados con pruebas propias, y cada una lo dice
  en su comentario.
- **Runner de migraciones ×2** sobre `spaces_vol_mig2`, base creada para eso: la
  primera aplica 91 y sale 0, la segunda dice `0 aplicadas` y sale 0, con **50
  tablas** al final.

---

## 10 · Lo que NO se probó

- **Que las pantallas se vean bien en un navegador de verdad**: el arnés no tiene
  DOM.
- **La migración contra PostgreSQL 14 real.** El 5433 corre 16, así que la
  compatibilidad con la 14 está **razonada y evitada por construcción**, no
  ejecutada.
- **Cuántas filas genera una escala en un catálogo real.** Son pocas por
  construcción —un puñado por unidad— pero nadie lo ha medido con un dueño
  delante.
- **Si un dueño de medios entiende el escalón** sin que se lo expliquen. El aviso
  de la pantalla está escrito, pero no se ha enseñado a nadie.

---

## Enlaces

- [[rejilla-franja-y-temporada]] — la Fase 1, sobre la que esto se apoya
- [[comercial-propuestas-campanas]] — dónde encaja en el ciclo comercial
- [[02-Backend/_indice]] · [[00-Indice/MOC-Proyecto]]
- [[04-Datos/esquema]] · [[04-Datos/migraciones]]
- [[06-Operacion/zonas-de-riesgo]] — esto es ROJO por triple: migración, tenant y dinero

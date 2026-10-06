---
tipo: contrato
estado: verificado
actualizado: 2026-10-01
tags: [backend, precios, propuestas, dinero, spots, roadblock, digital]
archivos:
  - apps/web/lib/calculadora-spots.ts
  - apps/web/lib/calculadora-spots.test.ts
  - db/migrations/20261007_calculadora_spots.sql
  - apps/web/lib/server/propuestas-controller.ts
  - apps/web/lib/server/propuestas-repo.ts
  - apps/web/lib/server/tarifas-repo.ts
  - apps/web/lib/server/campanas-repo.ts
  - apps/web/lib/server/propuestas-calculadora.test.ts
  - apps/web/lib/test/calculadora-spots.e2e.test.ts
  - apps/web/lib/i18n/errores-servidor.ts
  - apps/web/app/(app)/(shell)/propuestas/page.tsx
  - apps/web/app/(app)/(shell)/propuestas/[id]/page.tsx
  - apps/web/lib/data/estado-api.ts
  - apps/web/novedades.json
---

# La calculadora de spots

**ADR 0043, aceptado el 2026-10-06, que sustituye las decisiones 1, 2 y 3 del
ADR 0042.** La calculadora da la **CANTIDAD** de spots de una línea de pantalla
digital vendida por spot **y su PRECIO**, y cuenta como la calculadora HTML con
la que cotiza el dueño (`indexcal.html`, «Valor Real del Spot Unitario»):

```
loop      = anunciantes de hoy + espacios de la línea        (Roadblock: todos)
cantidad  = floor( 3600 / (loop × duración) × espacios × horasDía × días )
precio    = tarifaMensual / (3600 / (loop × duración) × horasOperación × 30)
Roadblock = tarifaMensual × loop / (horasOperación × 30) / floor(3600 / duración)
            por spot, × (1 + prima)
```

Con el ejemplo del HTML —$100,000 al mes, 6 anunciantes, 20 s, 18 h, 30 días—
da lo mismo que el HTML: **16 200 spots a $6.17**, y el Roadblock con prima del
30 % a **$8.02** por spot ($1,444.44 la hora). El volumen, el cupón y la
comisión se siguen componiendo **encima** del precio (ADR 0039).

Todo vive en **un módulo puro**, `apps/web/lib/calculadora-spots.ts`, que usan la
pantalla y el servidor. Es la misma razón que `tarifa-calculada.ts`: si cada lado
contara con su regla, el vendedor vería un número y el servidor le rechazaría
otro.

## Las piezas

| Función | Qué hace |
|---|---|
| `loopDeLaLinea` | Ocupados + espacios de la línea, con tope en `total_spots`. Sin ocupación conocida, o en Roadblock, el loop entero |
| `cantidadDeSpots` | La cantidad **en enteros** (horas en centésimas), redondeada UNA vez al final del periodo |
| `tarifaPorSpot` | El precio por spot, al centavo, normal o de Roadblock |
| `tarifaMensualDeSitio` | De qué tarifa mensual sale: la modalidad `mensual` (con su rejilla) o `sitios.tarifa_mensual`. **Nunca** la tarifa `spot` |
| `tarifaBaseCalculadora` | `{ tarifa, calculable }` para `decidirPrecioCalculadora` |
| `resolverCalculadora` | La línea completa: valida, calcula la cantidad, la compara con la enviada y mira los libres. Devuelve `400` (la petición está mal) o `409` (la pantalla no tiene los espacios) |
| `decidirPrecioCalculadora` | La prima del Roadblock dentro de la regla de PRECIO-01 |
| `duracionSpotSeg` | La pantalla → la organización (`config_negocio.spot_seg`) → **20 s** |
| `horasDeFranja` / `horasDeHorario` / `horasPorOmision` | El techo de horas al día |
| `tarifaConPrima` | `tarifa × (1 + prima/100)`, al centavo |

## Decisiones que hubo que tomar

> [!important] La ocupación son las CAMPAÑAS VIGENTES, en los dos lados
> El inventario enseña libres = `total − campañas` (`listarSitios`), así que la
> pantalla saca los ocupados como `total − libres`, y el servidor lee
> `campanasActivas` de `datosDelLoop`. Es el mismo número. **No** se usa el
> contador `spots_disponibles` guardado: si cada lado contara el loop con un
> número distinto, la cantidad no cuadraría y el servidor rechazaría la venta con
> un 400 sin que nadie hubiera tocado nada.

> [!important] Las fracciones suman; se redondea una vez, al final
> Con 7 anunciantes de 20 s salen 25,71 rotaciones por hora: 462,86 al día y
> **13 885** en 30 días. Con el `floor` por día del ADR 0042 eran 13 860. Un
> periodo sin un solo spot sí se rechaza.

> [!important] Las horas del PRECIO son las del horario, no las de la franja
> La renta mensual paga el día entero. La franja pone el techo de horas de la
> cantidad y, si tiene rejilla sobre la modalidad `mensual`, su precio. Pero una
> franja corta no encarece el spot por tener menos horas.

> [!warning] Con la pantalla vacía, la línea ES el loop
> Compre los espacios que compre, recibe `3600 / duración` spots por hora (180
> con spots de 20 s). Lo que cambia con los espacios es el precio por spot, y el
> total de la línea queda en `espacios × tarifa mensual` salvo el redondeo al
> centavo (2 × $45,000 → $90,396 en la e2e). Es la cuenta del HTML.

> [!note] Lo que había hasta el 2026-10-06 (ADR 0042)
> Precio = la tarifa `spot` con su rejilla; loop = todos los espacios; `floor`
> por día. Las líneas por spot **sin** calculadora siguen con la tarifa `spot`,
> como siempre.

**El horario es texto libre.** `sitios.horario` lo escribe el alta
(`06:00-24:00`), lo copia el importador del Excel, y hay `6:00 am a 12:00 pm`,
`6 a 24`, `24 horas`, `24/7`. `horasDeHorario` entiende esas formas; lo que no
entiende cae a **18 h** y lo dice (`reconocido: false`), para que la pantalla
avise en vez de enseñar 18 como si los hubiera leído. Sustituye a
`horasOperacion` de `sitios-repo.ts`, que **nadie llamaba** y se retiró.

**Las horas tienen techo.** Por omisión son la duración de la franja elegida
(fin exclusivo; la que cruza la medianoche cuenta bien) y, sin franja, el
horario. El vendedor las puede **bajar**, nunca subir: más horas de las que la
pantalla transmite serían spots que no salen.

## En el servidor

`crearPropuestaCtrl` (`propuestas-controller.ts`) llama a `resolverCalculadora`
para toda línea que traiga **cualquiera** de los cuatro parámetros
(`usaCalculadora`). El loop sale de `datosDelLoop` (`tarifas-repo.ts`), UNA
lectura por propuesta y solo si alguna línea lo usa. Una pantalla de otra
organización no aparece y la calculadora la rechaza (R2).

**Por qué 400 y 409, y en ese orden.** 400 = la petición está mal (parámetros,
cantidad que no cuadra); 409 = la pantalla no tiene los espacios. Se mira lo
primero antes: a quien mandó una línea mal no le sirve saber que además está
llena. Y los dos van **antes** que el precio (403), por lo mismo.

### Los espacios libres: rechazar, no avisar

> [!important] Se RECHAZA (409) cotizar más espacios que los libres
> Al generar la campaña, `spotsDeLaReserva` **acota** los slots retenidos a los
> libres. Si se dejara cotizar 6 con 5 libres, se cobrarían 6 y se retendrían 5:
> spots que no salen. Rechazar el día de la cotización garantiza que ese acote
> no muerda ese día. La pantalla de propuestas avisa antes de mandar.

«Libres» es el **menor** de dos números que hoy no coinciden
(`espaciosLibres`): el del inventario —`total − campañas vigentes`, el que ve el
vendedor— y el contador guardado `sitios.spots_disponibles` —con el que la
campaña acota—.

> [!warning] Límite que se hereda, no que se crea
> El inventario cuenta **campañas**, no slots retenidos («1 slot = 1 campaña»,
> `listarSitios`). Una compra de 6 espacios ocupa 1 en ese conteo. Ya pasaba con
> la reserva de Comercial, que retiene todos los libres por omisión. La
> calculadora no lo empeora para lo cotizado hoy, pero **dos propuestas sobre la
> misma pantalla pueden sumar más espacios que el loop** hasta que la ocupación
> se cuente por slots. Y un Roadblock exige la pantalla **sin ninguna** campaña
> vigente, porque la ocupación es por pantalla y no por franja (ADR 0042,
> consecuencias negativas).

### Roadblock y la regla de PRECIO-01

- Compra **todos** los espacios (`espacios_comprados = total_spots`) y exige el
  loop entero libre.
- Precio por spot (ADR 0043) = lo que vale una hora del loop entero —tarifa
  mensual × espacios ÷ (horas de operación × 30)— entre los `floor(3600 /
  duración)` spots de esa hora, y × (1 + prima/100) (`tarifaConPrima`). La
  «ocupación» que valora la hora es el loop ENTERO: el Roadblock exige el loop
  vacío, y con la ocupación de hoy la hora valdría $0.
- `decidirPrecioCalculadora`: prima > 0 sin `comercial.aprobar` →
  `prima-sin-permiso` (403). Con permiso, la esperada lleva la prima **una
  vez**, la línea queda como **ajuste** (`precio_ajustado_por`, Actividad) y
  `tarifa_calculada` guarda la base **sin prima**, para que «de $5.56 a
  $6.95» diga cuánto se movió.
- Un vendedor puede marcar el Roadblock con prima 0: es un precio a la tarifa.

**Volumen × prima.** La prima va en la tarifa unitaria; el volumen se aplica
sobre el bruto de la línea, con la cantidad de la calculadora. Son dos factores
y conmutan, así que no importa «cuál va primero» salvo el redondeo al peso.

### La campaña

`generarCampanaDesdePropuesta` (`campanas-repo.ts`) pasa
`it.espacios_comprados ?? it.spots_por_dia` a `spotsDeLaReserva`. El orden es
la mitad del arreglo: en una línea de calculadora `spots_por_dia` son los pases
al día (540, 3240), y ponerlo primero retendría cientos de slots de un loop de
12. Un Roadblock retiene los 12. Si entre la cotización y la campaña se ocupó un
espacio, se acota a lo libre como siempre — no se rechaza al generar.

### Mensajes

Los motivos salen de `resolverCalculadora` y viajan como `AppError(r.motivo)`,
así que la GUARDIA de i18n no los ve: van declarados a mano en
`lib/i18n/errores-servidor.ts` (catálogo y `PATRONES_ERROR` para los que llevan
números) y `calculadora-spots.test.ts` comprueba que todos se traducen.

## En la pantalla

En el alta de propuesta (`propuestas/page.tsx`, «Contratación por sitio»), toda
línea de pantalla con `tipoMedio === 'PANTALLA_DIGITAL'` y unidad `spot` trae el
bloque `CalculadoraSpotsLinea`, **APAGADO por omisión** desde el 2026-10-01
(`CALCULADORA_POR_OMISION` en `lib/calculadora-spots.ts`). Al encenderlo arranca
con 1 espacio y las horas de la franja o del horario:

> [!danger] 2026-10-01 · por qué arranca apagada (decisión del dueño, opción B)
> Nació encendida. Al revisarla en el navegador, «Insurgentes Sur LED» de la base
> local tenía tarifa «por spot» de **$3,200**, que no es el precio de UNA
> reproducción sino uno de día o de paquete. Antes se cotizaba con cantidad
> manual 1 = $3,200; con la calculadora encendida llenaba **10,200 spots** y la
> línea salía en **$32,640,000**. La propia referencia lo delataba: «equivale a
> $0.31 por spot frente a la tarifa mensual». Hasta revisar las tarifas por spot
> de cada instancia (g500 incluida), la línea arranca en cantidad manual y la
> calculadora se enciende a mano. Encenderla por omisión es cambiar `manual:
> true` por `false` en esa constante, con su prueba.
>
> **2026-10-06 · el motivo ya no aplica, pero sigue apagada.** Desde el ADR 0043
> la calculadora no usa la tarifa `spot`: el precio sale de la tarifa mensual, así
> que aquel $32.6 M ya no se puede dar. Encenderla por omisión es otra decisión
> del dueño, y no se tomó.

- Espacios del loop (máx. `totalSpots`, con «N libres» del inventario), horas al
  día (techo = el por omisión), casilla **Roadblock** y **Prima %**, que solo
  se habilita con `usePuede('comercial','aprobar')`.
- Debajo, el desglose del HTML: «Loop de 6 anunciantes (4 hoy + esta línea) ·
  2:00 min», «30 rotaciones/h · 1 080 spots/día × 30 días = **32 400 spots**» y
  «Tarifa mensual $45,000 ÷ 16 200 spots de un anunciante al mes = **$2.78 por
  spot**» (en Roadblock, la hora del loop y su prima). Esa cantidad y ese precio
  son los de la línea: el campo manual de cantidad y el de spots/día se
  sustituyen por los de la cuenta. Sin tarifa mensual, lo avisa.
- La cuenta es `previsualizarCalculadora`: la misma función por dentro que
  `resolverCalculadora`, sin comparar. Si el servidor la fuera a rechazar, el
  pie del cuadro enseña **el mismo motivo** y el botón queda inerte.
- La tarifa base es `tarifaBaseCalculadora`, la misma que comprueba el servidor;
  con prima, la que se manda es `tarifaConPrima(base, prima)`.
- La casilla «Calculadora de spots» se puede apagar: la línea vuelve a la
  cantidad a mano y viaja sin parámetros, o sea exactamente como antes.

El detalle interno (`propuestas/[id]/page.tsx`) enseña `etiquetaCalculadora`:
«2 espacios del loop · 18 h al día», o «Roadblock · 12 espacios del loop · 18 h
al día · prima 25 %». La liga pública no.

## Relacionadas

- [[comercial-propuestas-campanas]] — la tarifa calculada (PRECIO-01), donde se integra la prima
- [[rejilla-franja-y-temporada]] — de donde salen la franja y su duración
- [[descuento-por-volumen]] — el volumen se resuelve sobre la cantidad que da esta calculadora

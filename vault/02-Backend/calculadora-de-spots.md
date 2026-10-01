---
tipo: contrato
estado: en-curso
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
---

# La calculadora de spots

**ADR 0042, aceptado el 2026-10-01.** La calculadora da la **CANTIDAD** de spots
de una línea de pantalla digital vendida por spot. El **precio** sigue siendo el
de la pantalla: la cadena del ADR 0039 —modalidad `spot`, rejilla por franja y
temporada, volumen sobre la cantidad, código, comisión— no cambia.

```
spotsDia = floor( 3600 / (espaciosDelLoop × duraciónSpot) × espaciosComprados × horasDía )
cantidad = spotsDia × días
```

Todo vive en **un módulo puro**, `apps/web/lib/calculadora-spots.ts`, que usan la
pantalla y el servidor. Es la misma razón que `tarifa-calculada.ts`: si cada lado
contara con su regla, el vendedor vería un número y el servidor le rechazaría
otro.

## Las piezas

| Función | Qué hace |
|---|---|
| `spotsPorDia` | La fórmula, **en enteros** (horas en centésimas): `0.1 + 0.2` no puede quitarle un spot a nadie |
| `resolverCalculadora` | La línea completa: valida, calcula la cantidad, la compara con la enviada y mira los libres. Devuelve `400` (la petición está mal) o `409` (la pantalla no tiene los espacios) |
| `decidirPrecioCalculadora` | La prima del Roadblock dentro de la regla de PRECIO-01 |
| `duracionSpotSeg` | La pantalla → la organización (`config_negocio.spot_seg`) → **20 s** |
| `horasDeFranja` / `horasDeHorario` / `horasPorOmision` | El techo de horas al día |
| `tarifaConPrima` | `tarifa × (1 + prima/100)`, al centavo |
| `referenciaPorSpotMensual` | «Equivale a $X por spot frente a la tarifa mensual». **Informativa: nunca se cobra** |

## Decisiones que hubo que tomar

> [!important] Se redondea hacia abajo, UNA vez y al final del día
> Con 7 espacios de 20 s salen 25,71 rotaciones por hora. La calculadora original
> cobraba la fracción; aquí `floor(25,71 × 18) = 462` spots al día. Ni 462,86
> (se cobraría una reproducción que no ocurre) ni `25 × 18 = 450` (se le
> quitarían 12 al cliente por redondear cada hora).

> [!important] El loop son TODOS los espacios (`total_spots`)
> No la ocupación del día. Con la pantalla medio vacía el mismo spot no puede
> salir más barato (decisión 3 del ADR).

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
- Precio por spot = tarifa calculada × (1 + prima/100) (`tarifaConPrima`).
- `decidirPrecioCalculadora`: prima > 0 sin `comercial.aprobar` →
  `prima-sin-permiso` (403). Con permiso, la esperada lleva la prima **una
  vez**, la línea queda como **ajuste** (`precio_ajustado_por`, Actividad) y
  `tarifa_calculada` guarda la de la **pantalla**, para que «de $1,200 a
  $1,500» diga cuánto se movió.
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

## Relacionadas

- [[comercial-propuestas-campanas]] — la tarifa calculada (PRECIO-01), donde se integra la prima
- [[rejilla-franja-y-temporada]] — de donde salen la franja y su duración
- [[descuento-por-volumen]] — el volumen se resuelve sobre la cantidad que da esta calculadora

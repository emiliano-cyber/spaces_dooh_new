---
tipo: contrato
estado: en-curso
actualizado: 2026-10-01
tags: [backend, precios, propuestas, dinero, spots, roadblock, digital]
archivos:
  - apps/web/lib/calculadora-spots.ts
  - apps/web/lib/calculadora-spots.test.ts
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

## Relacionadas

- [[comercial-propuestas-campanas]] — la tarifa calculada (PRECIO-01), donde se integra la prima
- [[rejilla-franja-y-temporada]] — de donde salen la franja y su duración
- [[descuento-por-volumen]] — el volumen se resuelve sobre la cantidad que da esta calculadora

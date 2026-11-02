# Tabla de revisión · lote de inglés «compartidos»

Generada el 2026-11-02 a partir de `apps/web/lib/i18n/textos/compartidos.ts` y de
los usos en el código (búsqueda literal de la clave y, para las claves que se arman
con plantilla —`compartidos.unidad.${unidad}…`, `compartidos.periodicidad.${…}`,
`compartidos.periodo.${o.tipo}`—, la línea de la plantilla). **72 claves.**

- **español** es la copia literal de lo que decía el módulo antes del lote. Donde
  el módulo conserva su tabla (`UNIDADES`, `PERIODICIDAD_RENTA_LABEL`,
  `OPCIONES_PERIODO`, `AVISO_FRANJA_NO_VIAJA_AL_CMS`) una prueba exige que el
  diccionario diga exactamente lo mismo (`lib/i18n/textos/compartidos.test.ts`).
- Comprobado además rindiendo **27 estados de pantalla** en español antes y después
  del cambio (los 21 de Propuestas, uno nuevo con la calculadora y la renta, y 6
  piezas sueltas: el mapa, `Campo`, migas, candado y el aviso de la franja):
  **idénticos byte a byte** (`cmp`). Ver `lib/i18n/pantallas-propuestas.test.ts` y
  `lib/i18n/pantallas-compartidos.test.ts`.
- Las funciones de `lib/` ganaron un parámetro `idioma` con `'es'` por omisión:
  el servidor, el PDF, los correos y las pantallas fuera de Propuestas no lo
  pasan y siguen en español. Las pantallas de Propuestas le pasan el suyo.
- Los huecos `{nombre}` se rellenan con datos o cifras ya formateadas; ninguna
  cifra de dinero vive en el diccionario. `formatMontoCorto` no tiene texto
  (sus sufijos son «k» y «M») y no se tocó.
- `␣` marca un espacio al principio o al final del texto: es intencional.
- Claves globales reutilizadas, que ya estaban traducidas y no salen en la tabla:
  `comun.cancelar` (mapa y candado).

## Dónde se pinta cada función en Propuestas

| función | dónde | qué pinta |
|---|---|---|
| `unidadCorta(u, n, idioma)` | `app/(app)/(shell)/propuestas/page.tsx:1361`, `:1579`, `:1584` | duración, «No. of …», periodos de la línea |
| `etiquetaUnidad(u, idioma)` | `app/(app)/(shell)/propuestas/page.tsx:1526` | selector de modalidad |
| `periodicidadLabel(p, '—', idioma)` | `app/(app)/(shell)/propuestas/page.tsx:1741`; `app/(app)/(shell)/propuestas/[id]/page.tsx:888` | selector de renta; periodicidad del contrato (en inglés, en minúsculas como el dato español) |
| `previsualizarCalculadora(…, idioma)` | `app/(app)/(shell)/propuestas/page.tsx:901` | motivo de rechazo de la calculadora |
| `resumenContratacion`, `etiquetaCalculadora`, `etiquetaFrecuencia` | `app/(app)/(shell)/propuestas/[id]/page.tsx:904`, `:933`, `:936` | la línea de contratación de la ficha |
| `avisoFranja(idioma)` | `components/demo/rejilla/AvisoFranjaCMS.tsx:54`; `app/(app)/propuesta/[id]/page.tsx:151` | aviso de la franja |
| `etiquetaPeriodo(p, idioma)` y `compartidos.periodo.<tipo>` | `components/demo/propuestas/TableroPropuestas.tsx:83`, `:102`, `:117` | etiqueta y selector del periodo |
| `etiquetaEstadoCodigo(e, quien, idioma)` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:100` | estado del código de negociación |

## Las claves

| clave | archivo:línea donde se usa | qué es | español | inglés |
|---|---|---|---|---|
| `compartidos.unidad.mensual` | `lib/periodos.ts:87` | nombre de unidad de contratación (selector de modalidad) | Mensual | Monthly |
| `compartidos.unidad.mensual.uno` | `lib/periodos.ts:77` | palabra para conteo (singular/plural): duración, cantidad, «No. of …» | mes | month |
| `compartidos.unidad.mensual.otros` | `lib/periodos.ts:77` | palabra para conteo (singular/plural): duración, cantidad, «No. of …» | meses | months |
| `compartidos.unidad.catorcenal` | `lib/periodos.ts:87` | nombre de unidad de contratación (selector de modalidad) | Catorcenal | Every 14 days |
| `compartidos.unidad.catorcenal.uno` | `lib/periodos.ts:77` | palabra para conteo (singular/plural): duración, cantidad, «No. of …» | catorcena | 14-day period |
| `compartidos.unidad.catorcenal.otros` | `lib/periodos.ts:77` | palabra para conteo (singular/plural): duración, cantidad, «No. of …» | catorcenas | 14-day periods |
| `compartidos.unidad.semanal` | `lib/periodos.ts:87` | nombre de unidad de contratación (selector de modalidad) | Semanal | Weekly |
| `compartidos.unidad.semanal.uno` | `lib/periodos.ts:77` | palabra para conteo (singular/plural): duración, cantidad, «No. of …» | semana | week |
| `compartidos.unidad.semanal.otros` | `lib/periodos.ts:77` | palabra para conteo (singular/plural): duración, cantidad, «No. of …» | semanas | weeks |
| `compartidos.unidad.diaria` | `lib/periodos.ts:87` | nombre de unidad de contratación (selector de modalidad) | Diaria | Daily |
| `compartidos.unidad.diaria.uno` | `lib/periodos.ts:77` | palabra para conteo (singular/plural): duración, cantidad, «No. of …» | día | day |
| `compartidos.unidad.diaria.otros` | `lib/periodos.ts:77` | palabra para conteo (singular/plural): duración, cantidad, «No. of …» | días | days |
| `compartidos.unidad.spot` | `lib/periodos.ts:87` | nombre de unidad de contratación (selector de modalidad) | CPS · costo por salida | CPS · cost per play |
| `compartidos.unidad.spot.uno` | `lib/periodos.ts:77` | palabra para conteo (singular/plural): duración, cantidad, «No. of …» | salida | play |
| `compartidos.unidad.spot.otros` | `lib/periodos.ts:77` | palabra para conteo (singular/plural): duración, cantidad, «No. of …» | salidas | plays |
| `compartidos.unidad.hora` | `lib/periodos.ts:87` | nombre de unidad de contratación (selector de modalidad) | Por hora | Hourly |
| `compartidos.unidad.hora.uno` | `lib/periodos.ts:77` | palabra para conteo (singular/plural): duración, cantidad, «No. of …» | hora | hour |
| `compartidos.unidad.hora.otros` | `lib/periodos.ts:77` | palabra para conteo (singular/plural): duración, cantidad, «No. of …» | horas | hours |
| `compartidos.unidad.cpm` | `lib/periodos.ts:87` | nombre de unidad de contratación (selector de modalidad) | CPM · costo por millar | CPM · cost per thousand impressions |
| `compartidos.unidad.cpm.uno` | `lib/periodos.ts:77` | palabra para conteo (singular/plural): duración, cantidad, «No. of …» | millar | thousand |
| `compartidos.unidad.cpm.otros` | `lib/periodos.ts:77` | palabra para conteo (singular/plural): duración, cantidad, «No. of …» | millares | thousands |
| `compartidos.frecuencia.uno` | `lib/periodos.ts:178` | frase con contador (ficha: programación de la línea) | {n} pase al día | {n} play per day |
| `compartidos.frecuencia.otros` | `lib/periodos.ts:178` | frase con contador (ficha: programación de la línea) | {n} pases al día | {n} plays per day |
| `compartidos.calc.espacios.uno` | `lib/calculadora-spots.ts:527` | trozo de la línea de la calculadora en la ficha (se une con « · ») | {n} espacio del loop | {n} loop slot |
| `compartidos.calc.espacios.otros` | `lib/calculadora-spots.ts:527` | trozo de la línea de la calculadora en la ficha (se une con « · ») | {n} espacios del loop | {n} loop slots |
| `compartidos.calc.horas` | `lib/calculadora-spots.ts:529` | trozo de la línea de la calculadora en la ficha (se une con « · ») | {h} h al día | {h} h per day |
| `compartidos.calc.prima` | `lib/calculadora-spots.ts:534` | trozo de la línea de la calculadora en la ficha (se une con « · ») | prima {pct} % | premium {pct}% |
| `compartidos.calc.motivo.solo-digital` | `lib/calculadora-spots.ts:422` | motivo de rechazo de la calculadora (aviso en el alta de propuesta) | La calculadora de spots solo aplica a pantallas digitales vendidas por spot. | The spot calculator only applies to digital screens sold per spot. |
| `compartidos.calc.motivo.sin-loop` | `lib/calculadora-spots.ts:426` | motivo de rechazo de la calculadora (aviso en el alta de propuesta) | La pantalla no tiene capturado cuántos espacios tiene su loop; captúralo en su ficha antes de usar la calculadora. | The screen doesn't have its number of loop slots entered; enter it on the screen's page before using the calculator. |
| `compartidos.calc.motivo.roadblock-todos` | `lib/calculadora-spots.ts:434` | motivo de rechazo de la calculadora (aviso en el alta de propuesta) | Un Roadblock compra los {total} espacios del loop, no {espacios}. | A Roadblock buys every loop slot ({total}), not {espacios}. |
| `compartidos.calc.motivo.rango-espacios` | `lib/calculadora-spots.ts:439` | motivo de rechazo de la calculadora (aviso en el alta de propuesta) | Los espacios del loop van de 1 a {total}. | Loop slots go from 1 to {total}. |
| `compartidos.calc.motivo.rango-prima` | `lib/calculadora-spots.ts:446` | motivo de rechazo de la calculadora (aviso en el alta de propuesta) | La prima de Roadblock va de 0 a 100 %. | The Roadblock premium goes from 0 to 100%. |
| `compartidos.calc.motivo.prima-sin-roadblock` | `lib/calculadora-spots.ts:449` | motivo de rechazo de la calculadora (aviso en el alta de propuesta) | La prima de Roadblock solo aplica a una línea marcada como Roadblock. | The Roadblock premium only applies to a line marked as Roadblock. |
| `compartidos.calc.motivo.horas` | `lib/calculadora-spots.ts:455` | motivo de rechazo de la calculadora (aviso en el alta de propuesta) | Las horas al día van de más de 0 a {max}: más horas de las que transmite la pantalla serían spots que no salen. | Hours per day go from more than 0 up to {max}: more hours than the screen broadcasts would be spots that never play. |
| `compartidos.calc.motivo.sin-dias` | `lib/calculadora-spots.ts:461` | motivo de rechazo de la calculadora (aviso en el alta de propuesta) | La línea no tiene días: revisa las fechas. | The line has no days: check the dates. |
| `compartidos.calc.motivo.cero-spots` | `lib/calculadora-spots.ts:466` | motivo de rechazo de la calculadora (aviso en el alta de propuesta) | Con esos espacios y esas horas no sale ni un spot al día. | With those slots and those hours, not a single spot plays in a day. |
| `compartidos.calc.motivo.roadblock-libres` | `lib/calculadora-spots.ts:487` | motivo de rechazo de la calculadora (aviso en el alta de propuesta) | Un Roadblock necesita los {total} espacios del loop libres, y la pantalla tiene {libres}. | A Roadblock needs every loop slot free ({total}), and the screen has {libres}. |
| `compartidos.calc.motivo.pocos-libres.uno` | `lib/calculadora-spots.ts:496` | motivo de rechazo de la calculadora (aviso en el alta de propuesta) | Pides {espacios} espacios del loop y la pantalla solo tiene {libres} libres. | You're asking for {espacios} loop slot and the screen only has {libres} free. |
| `compartidos.calc.motivo.pocos-libres.otros` | `lib/calculadora-spots.ts:496` | motivo de rechazo de la calculadora (aviso en el alta de propuesta) | Pides {espacios} espacios del loop y la pantalla solo tiene {libres} libres. | You're asking for {espacios} loop slots and the screen only has {libres} free. |
| `compartidos.periodicidad.diaria` | `lib/renta-periodicidad.ts:67` | opción del selector de periodicidad de renta · periodicidad del contrato en la ficha (inglés) | Diaria | Daily |
| `compartidos.periodicidad.semanal` | `lib/renta-periodicidad.ts:67` | opción del selector de periodicidad de renta · periodicidad del contrato en la ficha (inglés) | Semanal | Weekly |
| `compartidos.periodicidad.catorcenal` | `lib/renta-periodicidad.ts:67` | opción del selector de periodicidad de renta · periodicidad del contrato en la ficha (inglés) | Catorcenal (cada 14 días) | Every 14 days |
| `compartidos.periodicidad.quincenal` | `lib/renta-periodicidad.ts:67` | opción del selector de periodicidad de renta · periodicidad del contrato en la ficha (inglés) | Quincenal | Twice a month |
| `compartidos.periodicidad.mensual` | `lib/renta-periodicidad.ts:67` | opción del selector de periodicidad de renta · periodicidad del contrato en la ficha (inglés) | Mensual | Monthly |
| `compartidos.periodicidad.bimestral` | `lib/renta-periodicidad.ts:67` | opción del selector de periodicidad de renta · periodicidad del contrato en la ficha (inglés) | Bimestral | Every 2 months |
| `compartidos.periodicidad.trimestral` | `lib/renta-periodicidad.ts:67` | opción del selector de periodicidad de renta · periodicidad del contrato en la ficha (inglés) | Trimestral | Quarterly |
| `compartidos.periodicidad.semestral` | `lib/renta-periodicidad.ts:67` | opción del selector de periodicidad de renta · periodicidad del contrato en la ficha (inglés) | Semestral | Every 6 months |
| `compartidos.periodicidad.anual` | `lib/renta-periodicidad.ts:67` | opción del selector de periodicidad de renta · periodicidad del contrato en la ficha (inglés) | Anual | Yearly |
| `compartidos.codigo.pendiente` | `lib/codigo-aprobacion.ts:140` | etiqueta del estado del código de negociación | Pendiente de aprobación | Pending approval |
| `compartidos.codigo.aprobado-por` | `lib/codigo-aprobacion.ts:144` | etiqueta del estado del código de negociación | Aprobado por {nombre} | Approved by {nombre} |
| `compartidos.codigo.aprobado` | `lib/codigo-aprobacion.ts:145` | etiqueta del estado del código de negociación | Aprobado | Approved |
| `compartidos.franja.aviso` | `lib/rejilla.ts:107` | aviso (alta, ficha, documento imprimible y demás pantallas con franja) | La franja horaria es un compromiso comercial: se cotiza y se cobra. Al publicar en DOOHmain se envía su horario a cada pantalla; en las pantallas que opera otro CMS, o si el anuncio ya estaba publicado, quien opere la pantalla tiene que programarla manualmente. | The daypart is a commercial commitment: it is quoted and billed. Publishing to DOOHmain sends its schedule to each screen; on screens run by another CMS, or if the ad was already published, whoever operates the screen has to schedule it manually. |
| `compartidos.periodo.mes` | `components/demo/propuestas/TableroPropuestas.tsx:102`<br>`components/demo/propuestas/TableroPropuestas.tsx:117` | opción del selector de periodo del tablero | Este mes | This month |
| `compartidos.periodo.mes-anterior` | `components/demo/propuestas/TableroPropuestas.tsx:102`<br>`components/demo/propuestas/TableroPropuestas.tsx:117` | opción del selector de periodo del tablero | Mes pasado | Last month |
| `compartidos.periodo.trimestre` | `components/demo/propuestas/TableroPropuestas.tsx:102`<br>`components/demo/propuestas/TableroPropuestas.tsx:117` | opción del selector de periodo del tablero | Trimestre | Quarter |
| `compartidos.periodo.trimestre-anterior` | `components/demo/propuestas/TableroPropuestas.tsx:102`<br>`components/demo/propuestas/TableroPropuestas.tsx:117` | opción del selector de periodo del tablero | Trimestre pasado | Last quarter |
| `compartidos.periodo.anio` | `components/demo/propuestas/TableroPropuestas.tsx:102`<br>`components/demo/propuestas/TableroPropuestas.tsx:117` | opción del selector de periodo del tablero | Año | Year |
| `compartidos.periodo.rango` | `components/demo/propuestas/TableroPropuestas.tsx:102`<br>`components/demo/propuestas/TableroPropuestas.tsx:117` | opción del selector de periodo del tablero | Rango | Range |
| `compartidos.periodo.etiqueta.trimestre` | `lib/finanzas-periodo.ts:149` | etiqueta del periodo que manda el servidor, rearmada (solo inglés) | {n}.º trimestre {anio} | Q{n} {anio} |
| `compartidos.periodo.etiqueta.rango` | `lib/finanzas-periodo.ts:152` | etiqueta del periodo que manda el servidor, rearmada (solo inglés) | {desde} a {hasta} | {desde} to {hasta} |
| `compartidos.mapa.cerrar-zona` | `components/demo/MapView.tsx:417` | botón / indicación / contador del mapa | Cerrar zona ({n}) | Close area ({n}) |
| `compartidos.mapa.limpiar-zona` | `components/demo/MapView.tsx:426` | botón / indicación / contador del mapa | Limpiar zona | Clear area |
| `compartidos.mapa.indicacion` | `components/demo/MapView.tsx:432` | botón / indicación / contador del mapa | Toca el mapa para marcar la zona (mín. 3 puntos) | Tap the map to mark the area (min. 3 points) |
| `compartidos.mapa.sin-ubicacion.uno` | `components/demo/MapView.tsx:397` | botón / indicación / contador del mapa | 1 pantalla sin ubicación capturada | 1 screen with no location entered |
| `compartidos.mapa.sin-ubicacion.otros` | `components/demo/MapView.tsx:398` | botón / indicación / contador del mapa | {n} pantallas sin ubicación capturada | {n} screens with no location entered |
| `compartidos.campo.obligatorio` | `components/demo/ui/Campo.tsx:60` | texto para lector de pantalla, pegado al rótulo | ␣(obligatorio) | ␣(required) |
| `compartidos.campo.falta` | `components/demo/ui/Campo.tsx:50` | mensaje de campo obligatorio vacío | Falta este dato | This field is required |
| `compartidos.contrasena.etiqueta` | `components/demo/ui/CampoContrasena.tsx:38` | rótulo de campo | Tu contraseña | Your password |
| `compartidos.migas.aria` | `components/demo/ui/Breadcrumbs.tsx:20` | aria-label de la navegación | Ruta de navegación | Breadcrumb |
| `compartidos.candado.pide` | `components/demo/ui/candado.tsx:176` | texto / botón / error del paso de la contraseña | Tu organización pide la contraseña para confirmar los cambios sensibles. | Your organization requires your password to confirm sensitive changes. |
| `compartidos.candado.falta` | `components/demo/ui/candado.tsx:128` | texto / botón / error del paso de la contraseña | Escribe tu contraseña para confirmar. | Enter your password to confirm. |
| `compartidos.candado.confirmar` | `components/demo/ui/candado.tsx:232` | texto / botón / error del paso de la contraseña | Confirmar | Confirm |

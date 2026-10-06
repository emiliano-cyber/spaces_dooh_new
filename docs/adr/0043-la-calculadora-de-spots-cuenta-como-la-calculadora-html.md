# ADR 0043: La calculadora de spots cuenta como la calculadora HTML — cantidad Y precio

- **Fecha:** 2026-10-06
- **Estado:** Aceptada (2026-10-06). Aprobada por el dueño en la sesión de ese día, con las
  cuatro diferencias marcadas: el loop es la ocupación real, sin redondeo por día, el precio
  es la tarifa mensual ÷ spots, y el Roadblock se valora por hora.
- **Sustituye:** las decisiones **1, 2 y 3** del [ADR 0042](0042-la-calculadora-de-spots-da-la-cantidad-y-la-pantalla-el-precio.md).
  Las decisiones 4, 5 y 6 del 0042 —sin tope de espacios por cliente, el Roadblock compra el
  loop entero y su prima la pone solo `comercial.aprobar`, una sola copia de las fórmulas que el
  servidor recalcula— **siguen vigentes**.
- **Relacionado:** [ADR 0039](0039-la-cadena-de-precio-del-spot.md) (la cadena de precio).

## Contexto

El dueño cotiza con una calculadora HTML de un solo archivo (`indexcal.html`, «Valor Real del
Spot Unitario»), que es la versión en HTML del `DOOHCalculator.tsx` que el ADR 0042 tomó como
fuente. Al compararla con la de SPACE OS el 2026-10-06, las cifras no coincidían en nada de lo
que se cobra:

| | Calculadora HTML | SPACE OS (ADR 0042) |
|---|---|---|
| Precio por spot | tarifa mensual ÷ spots de un anunciante al mes | la tarifa `spot` de la pantalla |
| Tamaño del loop | los anunciantes de hoy | todos los espacios (`total_spots`) |
| Redondeo | fracciones de spot, sin redondeo por día | `floor` por día |
| Roadblock | ingreso de la hora × (1 + prima) | tarifa `spot` × (1 + prima) |

Con el ejemplo del propio HTML —$100,000 al mes, 6 anunciantes, spots de 20 s, 18 h, 30 días—
el HTML da **$6.17 por spot** y 16 200 spots al mes; SPACE OS, en una pantalla de 12 espacios,
daba 8 100 spots a la tarifa `spot` que tuviera capturada.

## Decisión

Textual del dueño, 2026-10-06: el cálculo tiene que ser «más cercano o exacto al html», con las
cuatro diferencias alineadas.

1. **El loop es la ocupación**: los anunciantes de hoy más los espacios que compra la línea,
   con tope en `total_spots`. «Anunciantes de hoy» son las **campañas vigentes** de la
   pantalla, el mismo conteo que enseña el inventario (`listarSitios`) y que lee el servidor
   (`datosDelLoop.campanasActivas`). Sin el dato, el loop es la pantalla entera. Un Roadblock
   es el loop entero.
2. **La cantidad no se redondea por día**:
   `cantidad = floor(3600 / (loop × duración) × espacios × horasDía × días)`. Las fracciones de
   cada día suman y se redondea **una** vez, al final del periodo. El Roadblock cuenta
   `floor(3600 / duración)` spots por hora, como el HTML.
3. **El precio por spot sale de la tarifa mensual**:
   `tarifaMensual / (3600 / (loop × duración) × horasOperación × 30)`, al centavo. La tarifa
   mensual es la modalidad `mensual` de la pantalla (con su rejilla de franja y temporada, si la
   tiene) y, si no la ofrece, `sitios.tarifa_mensual`. **Nunca** la tarifa `spot`. Las horas de
   operación son las del **horario** de la pantalla, no las de la franja.
4. **El Roadblock se valora por hora**: `tarifaMensual × loop / (horasOperación × 30)` es lo que
   vale una hora, repartida entre sus `floor(3600 / duración)` spots, y la prima va encima, una
   vez.

El volumen, el cupón y la comisión se siguen componiendo **encima** de ese precio: cambia el
primer escalón de la cadena del ADR 0039, no la cadena.

## Lo que NO se copia del HTML

- **La coma flotante.** Se cuenta en enteros —horas en centésimas, pesos en centavos— porque la
  pantalla y el servidor tienen que dar el mismo entero o la venta se bloquea.
- **Más de dos decimales en el precio.** `tarifa_unitaria` es `numeric(14,2)`: $100,000 ÷ 16 200
  = $6.1728 se cobra a **$6.17**, que es lo que enseña el HTML. Por eso el total de una línea
  difiere de `espacios × tarifa mensual` en el redondeo al centavo (2 espacios × $45,000 sale
  $90,396 y no $90,000 en la prueba e2e). Guardar más decimales sería una migración aparte.
- **La gráfica y la tabla de desglose.** La pantalla de propuestas enseña el desglose de la
  línea (loop, rotaciones, spots al día, tarifa mensual ÷ spots, y la hora del Roadblock), no
  las veinte barras.

## Alternativas consideradas

**A · Dejar el ADR 0042 y enseñar el HTML como referencia.** Era lo vigente. Descartada por el
dueño: las cifras con las que cotiza son las del HTML.

**B · Ocupación por el contador `spots_disponibles` guardado.** Descartada: la pantalla de
propuestas ve `total − campañas` y el servidor acota con el menor de los dos. Si el loop
saliera de un número distinto en cada lado, la cantidad no cuadraría y el servidor
rechazaría la venta con un 400 sin que nadie hubiera tocado nada.

**C · Para el Roadblock, la ocupación actual como «anunciantes».** Es lo que hace el HTML con
su deslizador, pero un Roadblock exige el loop vacío, así que la ocupación actual es siempre
0 y la hora valdría $0. Se valora con el loop entero.

## Consecuencias

**Positivas**
- Las cifras de la propuesta coinciden con las del HTML, salvo el redondeo al centavo.
- Lo que se paga por un espacio durante un mes es la tarifa mensual, ocupe quien ocupe el resto
  del loop: con más ocupación cada spot vale más y salen menos.
- Desaparece el riesgo del 2026-10-01: una tarifa `spot` capturada como precio de día o de
  paquete ya no se multiplica por miles de spots, porque la calculadora no la usa.

**Negativas**
- **El precio y la cantidad dependen del día en que se cotiza** (la objeción del ADR 0042,
  alternativa B). Lo que no depende es el total de la línea.
- **Con la pantalla vacía, una línea es todo el loop**: compre los espacios que compre, recibe
  `3600 / duración` spots por hora. Es la cuenta del HTML, y conviene decírselo a quien venda.
- La tarifa `spot` y su rejilla dejan de aplicar a las líneas de calculadora. Las líneas por
  spot **sin** calculadora (cantidad a mano) siguen con la tarifa `spot`.
- Una pantalla sin tarifa mensual no tiene precio de calculadora: solo un gerente puede
  ponerlo (403 `sin-tarifa`, igual que PRECIO-01).
- Las propuestas guardadas **no cambian**; una propuesta vieja que se edite se recalcula con la
  regla nueva.

**Implicaciones de seguridad**
- Sin superficie nueva: ni endpoints, ni columnas, ni dependencias.
- El servidor sigue recalculando cantidad y precio; la ocupación la lee él (`datosDelLoop`),
  nunca del cuerpo.

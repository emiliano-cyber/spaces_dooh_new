# ADR 0039 · La cadena de precio del spot: franja, temporada, volumen, código y paquete

**Fecha:** 2026-09-28
**Estado:** aprobado para diseño · las fases 1–4 se ejecutan una detrás de otra
**Decide:** Jochelo, el 2026-09-28
**Sustituye a:** nada. Amplía el modelo de `sitio_modalidades` del ADR 0006.

---

## El problema

Unos dueños potenciales pidieron cinco cosas: **franja horaria**, **tarifas por
franja**, **descuentos**, **promociones para la renta de cada spot** y
**atribución por vendedor**.

Las cinco parecen funcionalidades distintas. **Cuatro son la misma pregunta:**

> ¿Cuánto cuesta este spot, **para este comprador**, **en este momento**?

Hoy el producto contesta con un solo número: `sitio_modalidades (sitio_id,
unidad) → tarifa_publicada`, con `unique (sitio_id, unidad)` (`db/schema.sql:207-211`).
Un precio por pantalla y unidad de venta, y se acabó.

La quinta —el vendedor— es independiente y va aparte (**Fase 0**).

---

## La decisión

Convertir ese número en una **cadena de resolución de precio**, por capas:

```
tarifa base   =  f(pantalla, unidad, FRANJA, FECHA)
      │                                  ▲       ▲
      │                            Fase 1 ┘       └ Fase 1 (temporada)
      ▼
      ×  descuento por VOLUMEN                      ← Fase 2
      │        …o bien PRECIO DE PAQUETE,           ← Fase 4
      │           que SUSTITUYE la suma entera
      ▼
      ×  descuento comercial  (ya existe, con su tope desde 2026-09-28)
      ▼
      ×  CÓDIGO PROMOCIONAL   (con vencimiento y tope de usos)   ← Fase 3
      ▼
      ×  (1 − comisión de agencia)   (ya existe)
      =  NETO
```

### Por qué esta forma y no cinco funcionalidades sueltas

**Franja y temporada son la misma cosa estructuralmente**: dimensiones de la
tarifa **base**, una sobre la hora del día y otra sobre la época del año. Se
construyen juntas, y **todo lo demás se apoya encima**. Por eso son la Fase 1 y
por eso las fases 2–4 **no se pueden construir en paralelo** con ella: cada una
acabaría inventándose su propia versión de los cimientos.

**Volumen y código son modificadores**: se aplican sobre un precio ya resuelto.
Son independientes entre sí, así que sus fases pueden reordenarse.

**El paquete cerrado es el raro: no modifica, SUSTITUYE.** Un precio de conjunto
distinto de la suma de sus partes rompe la aritmética de todas las capas
anteriores, y por eso va el último y por eso es el que toca el
`snapshot_economico`.

---

## Las tres reglas de negocio, decididas

### 1 · Los descuentos SE COMPONEN, no se suman

Un 20 % por volumen y un 20 % por código dejan al cliente pagando el **64 %**
(0,8 × 0,8), **no el 60 %**.

**Dos motivos.** Es el estándar en compra de medios, así que es lo que una
agencia espera. Y sobre todo: **errar hacia cobrar de más se corrige con una nota
de crédito; errar hacia cobrar de menos ya se regaló.**

Cuatro puntos de diferencia por venta no son un detalle de implementación: es la
clase de decisión que hay que poder señalar en un documento cuando alguien
pregunte por qué la cotización dice lo que dice.

### 2 · El paquete cerrado es PRECIO FINAL

Por omisión, un paquete **no admite nada encima**: ni volumen (su precio ya lo
lleva dentro) ni código. Llevará una bandera por paquete para permitir el código
explícitamente, y **nace apagada**.

Mismo criterio que el tope de descuento del 2026-09-28: **la regla nace cerrada y
se abre a propósito**, no al revés.

### 3 · Todo se CONGELA al aprobar

`propuestas.snapshot_economico` ya congela la escalera de hoy —bruto, descuento,
comisión, neto, IVA, total, y `porSitio: [{sitioId, lista, neto}]`— y es lo que
hace que **el precio del contrato firmado mande** (ver B39).

**Cada capa nueva tiene que entrar en ese congelado.** Una promoción que cambie
después no puede reescribir lo que un cliente ya aceptó. Es el invariante más
importante de todo este ADR: **si una fase no congela lo suyo, esa fase está mal
hecha**, por muy bien que calcule.

---

## El obstáculo que no depende de nosotros

**La franja horaria se puede cotizar y contratar, pero HOY no se puede entregar
a la pantalla.**

El SDK de DOOHmain acepta `--version --anunciante --campana --fecha-inicio
--fecha-fin --filepath --screen --list --cant-dia`
(`doohmain_sdk/__main__.py:66-75`). **No hay `--hora` ni `--dias`.**

**Decisión del dueño (2026-09-28): se construye igual, como capa comercial.** Se
vende y se cobra por franja; **quien la programe la mete a mano en el CMS**.

> [!danger] Y el producto tiene que DECIRLO
> La pantalla que venda por franja tiene que dejar claro que lo contratado es un
> compromiso comercial y que la programación no viaja sola al CMS. Un sistema
> que enseña «prime 06:00–10:00» y no lo agenda **está mintiendo por omisión**, y
> el día que un spot salga a las tres de la mañana nadie sabrá si falló el
> sistema o el operador.
>
> Es la misma familia de defecto que el `?? 0` del mapa: convertir «no sé» en una
> afirmación concreta.

---

## Lo que cuesta, y lo que NO cabe antes del Summit

El lanzamiento es el **2026-10-14**. Al escribir esto quedan **16 días**.

| Fase | Qué | Tamaño | ¿Antes del 14/10? |
|---|---|---|---|
| **0** | **Vendedor en la propuesta** | 2–3 días | **SÍ** — es independiente de todo esto |
| **1** | **La rejilla**: franja + temporada con su tarifa | 4–6 días | No |
| **2** | Descuento por volumen | 2–3 días | No |
| **3** | Código promocional con vencimiento | 3–4 días | No |
| **4** | Paquete cerrado | 4–5 días | No |

**Prometer las fases 1–4 para el 14/10 sería mentir.** Cada una entrega algo
vendible por sí sola, y la **1 es la que más vale suelta**: poder decir «prime
cuesta esto, madrugada esto otro, y en diciembre esto» ya es otra conversación de
venta.

---

## Lo que arrastra cada capa

Para que nadie subestime la Fase 1: cambiar la clave del precio toca **toda la
cadena**, no solo una tabla.

| Dónde | Qué cambia |
|---|---|
| `sitio_modalidades` | La clave deja de ser `(sitio, unidad)` |
| `propuesta_items` | Tiene que guardar **qué franja** se contrató |
| `reservas` | Igual — hereda la contratación del ítem |
| `snapshot_economico` | Tiene que congelar la franja y la tarifa que le tocó |
| El reporte | La dimensión `tarifa` compara publicada vs neta: **¿publicada de qué franja?** |
| El importador CSV | Hoy valida siete unidades; tendrá que aceptar la franja |
| El CMS | **No la recibe.** Ver arriba |

---

## Alternativas descartadas

**Multiplicadores en vez de filas** (prime = ×1,4, diciembre = ×1,2). Menos filas
y menos que capturar. **Descartada** porque un dueño de medios piensa y negocia en
**precios**, no en factores: «el prime cuesta 4 200» es una frase de su oficio;
«el prime es 1,4» no. Y un multiplicador obliga a recalcular para saber qué se
está cobrando, que es justo lo que no se quiere delante de un cliente.

**Una tabla de precios genérica** (entidad, clave, valor, vigencia). **Descartada**:
todo cabe y nada se valida. Este repositorio ya paga caro un enum de once valores
del que **solo se usa uno** (`tipo_venta`, medido el 28/09) — un modelo que lo
admite todo acaba siendo un modelo que no dice nada.

**Aplicar las promociones al leer, sin congelar.** **Descartada por el
invariante 3**: reescribiría lo que un cliente ya aceptó.

---

## Lo que NO se ha verificado al escribir este ADR

- **No se ha probado ninguna de estas capas contra datos reales.** El diseño sale
  de leer el código, no de ejecutarlo.
- **No se ha medido cuántas filas genera** la rejilla en un inventario real. Siete
  unidades × N franjas × M temporadas crece rápido, y nadie ha puesto números.
- **No se ha consultado con un operador de CMS** si programar franjas a mano es
  aceptable en su día a día. Es el supuesto sobre el que descansa la Fase 1.
- **No se ha decidido qué franjas existen** ni si las define cada organización o
  vienen fijas. Es la primera pregunta de la Fase 1.

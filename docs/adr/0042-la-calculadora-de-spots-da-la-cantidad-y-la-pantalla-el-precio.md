# ADR 0042: La calculadora de spots da la CANTIDAD; el precio sigue siendo el de la pantalla

- **Fecha:** 2026-10-01
- **Estado:** Aceptada (2026-10-01). El dueño aprobó las cuatro columnas de
  `propuesta_items` tal como se proponen abajo, y confirmó que la prima del Roadblock la pone
  **solo** `comercial.aprobar` (Gerente de ventas y superiores). Antes decía «Propuesta —
  falta aprobar las columnas y confirmar quién pone la prima».
- **Relacionado:** [ADR 0039](0039-la-cadena-de-precio-del-spot.md) (la cadena de precio),
  [ADR 0040](0040-roles-de-venta-y-la-autorizacion-de-descuentos.md) (que dejó «la
  calculadora de precio de spot» **bloqueada por falta de la lógica**), y la tarifa calculada
  en el servidor del 2026-10-01 (`apps/web/lib/tarifa-calculada.ts`).

## Contexto

El dueño entregó el 2026-10-01 la lógica, en el repositorio
`github.com/CarlosMend87/CalculadoraH-` (un proyecto Lovable/Vite con Supabase). Se leyó sin
ejecutarlo. La lógica son dos componentes de React con las fórmulas dentro del render:

**`DOOHCalculator.tsx` · valor del spot unitario**

```
loopSeg            = duracionSpot × anunciantes
loopsPorDia        = horasOperacion × 3600 / loopSeg
spotsPorClienteMes = loopsPorDia × diasActivos
tarifaSpot         = tarifaMensual / spotsPorClienteMes
Roadblock:
  ingresoHora      = tarifaMensual × anunciantes / (horasOperacion × dias)
  tarifaRBHora     = ingresoHora × (1 + prima%)
  spotsEnRBHora    = floor(3600 / duracionSpot)
```

**`SpotBudgetCalculator.tsx` · presupuesto de una compra**

```
loopSeg        = espaciosDelLoop × duracionSpot
rotacionesHora = 3600 / loopSeg
spotsTotales   = rotacionesHora × espaciosComprados × horasDia × dias
presupuesto    = costoPorSpot × spotsTotales
(máximo comprable = min(libres, 4))
```

**Lo que SPACE OS ya tiene por pantalla:**
- `sitios.total_spots` (12 por omisión), `duracion_spot_seg` (20), `horario`, `spots_disponibles`.
- La modalidad `spot` / `hora` con su tarifa, la rejilla por franja y temporada, y el descuento
  por volumen por cantidad de spots.
- En `propuesta_items`: `unidad`, `cantidad`, `spots_por_dia` y la `franja_id`.

**Dos cosas de la calculadora que no se pueden copiar tal cual:**
- `presupuesto` multiplica spots **fraccionarios**: con 7 espacios de 20 s salen 25,71
  rotaciones por hora. Se cobraría una fracción de reproducción.
- Las fórmulas viven en el navegador. El 2026-10-01 se cerró el hallazgo B40 para la tarifa
  base: el servidor la recalcula. Esta calculadora no puede reabrirlo.

## Decisión

Las decisiones de negocio son del dueño, textuales del 2026-10-01:

1. **El precio de un spot es el de cada pantalla** — «de cada pantalla + como lo indica la
   propuesta ya que se va afectando por cantidad de spots por pantalla o por franjas de
   tiempo». La base es la tarifa de la modalidad `spot` de la pantalla, ajustada por la
   **franja/temporada** (rejilla) y por el **descuento por volumen** sobre la cantidad. Es la
   cadena del ADR 0039, intacta. **No** se usa `tarifaMensual ÷ spotsPorClienteMes` para
   fijar el precio. Esa cifra puede mostrarse como referencia («equivale a $X por spot frente
   a la tarifa mensual»), sin cobrarse.
2. **La calculadora pone la CANTIDAD**:
   `spots = floor(3600 / (espaciosTotales × duracionSpot) × espaciosComprados × horasDia) × dias`.
   - **Se redondea hacia abajo por día**: no se cobra una reproducción que no ocurre.
   - `horasDia` toma por omisión la duración de la franja elegida y, sin franja, el horario de
     la pantalla. El vendedor la puede bajar.
   - `dias` sale de las fechas de la línea.
3. **El loop cuenta los espacios TOTALES** de la pantalla (`total_spots`), no la ocupación del
   día. El precio no baja porque la pantalla esté vacía.
4. **Sin máximo de espacios por cliente**: el tope es lo libre (`spots_disponibles`).
5. **Roadblock por propuesta y cliente**: una línea puede marcarse Roadblock.
   - Compra **todos** los espacios del loop en las horas elegidas, así que exige que estén
     todos libres.
   - Su precio es el de esos spots más un **% de prima** capturado en esa línea.
   - **Confirmado por el dueño el 2026-10-01:** la prima solo la pone `comercial.aprobar`
     (Gerente de ventas y superiores), por la regla del mismo día de que solo ellos se apartan
     de la tarifa. Un vendedor sí puede marcar un Roadblock, con la prima en 0.
6. **Una sola copia de las fórmulas**, en un módulo puro (`lib/calculadora-spots.ts`) que usan
   la pantalla y el servidor. El servidor **recalcula la cantidad** a partir de los parámetros
   guardados y rechaza una línea cuya cantidad no cuadre, igual que con la tarifa.

**Columnas que hacen falta** en `propuesta_items` (aprobadas por el dueño el 2026-10-01,
migración `db/migrations/20261007_calculadora_spots.sql`):

| Columna | Tipo | Para qué |
|---|---|---|
| `espacios_comprados` | `integer` | Cuántos espacios del loop compra la línea |
| `horas_dia` | `numeric(4,2)` | Horas de transmisión al día |
| `roadblock` | `boolean not null default false` | La línea es un Roadblock |
| `prima_roadblock_pct` | `numeric(5,2)` | La prima, solo con `roadblock` |

Con CHECK de rangos, y `prima_roadblock_pct` solo cuando `roadblock`.

## Alternativas consideradas

**A · El precio por spot = tarifa mensual ÷ spots por cliente al mes, como en la
calculadora.** Une el precio del spot al de la renta mensual. **Descartada por el dueño**: el
precio es el de cada pantalla, y ya le afectan franja y cantidad. Además dejaría sin efecto la
rejilla y el volumen sobre los spots.

**B · Usar la ocupación real del loop (anunciantes de hoy).** Es la que usa la calculadora. Se
descarta por la decisión 3: con la pantalla medio vacía, el mismo spot saldría más barato, y el
precio de una propuesta dependería del día en que se cotiza.

**C · Copiar los componentes de la calculadora tal cual** (React + shadcn/ui + Supabase). Se
descarta: trae dependencias que el producto no usa (shadcn, Supabase, Vite), las fórmulas viven
en el render y no en un módulo probado, y cobra spots fraccionarios. Se toma **la lógica**, no
el código.

## Consecuencias

**Positivas**
- El vendedor cotiza una pantalla digital por espacios, horas y días, sin calcular a mano.
- Lo cotizado, la ocupación (`spots_disponibles`) y lo que se programa en el CMS hablan de la
  misma cantidad.
- La rejilla, el volumen, los cupones, los paquetes y la nueva regla de quién cambia la tarifa
  siguen igual.

**Negativas**
- Cuatro columnas más en `propuesta_items` y un cálculo más en el servidor.
- El redondeo hacia abajo cambia el total frente a la calculadora original, unos pesos por
  línea. Es a propósito, y hay que decírselo a quien la usaba.
- El Roadblock exige que el loop esté libre en esas horas. Hoy la ocupación es por pantalla, no
  por hora: **se exigirán todos los espacios libres de la pantalla** hasta que exista ocupación
  por franja.

**Implicaciones de seguridad**
- **No se agrega superficie de ataque:** ni endpoints nuevos públicos, ni dependencias. El
  repositorio original **no se integra**: no se instala nada de él.
- **El cliente no ve los parámetros internos:** la liga pública sigue mostrando solo el precio.
- **Riesgo que se cierra:** como el servidor recalcula la cantidad, no se puede mandar una
  cantidad de spots inventada para bajar el total.
- **Revisado en el repositorio de la calculadora:** no tiene claves escritas en el código. Las
  funciones de Supabase leen `SUPABASE_SERVICE_ROLE_KEY` del entorno. No se copia nada de esa
  parte.

## Cómo revertir

Las columnas son aditivas y nulas por omisión. Quitar la calculadora de la pantalla deja la
captura de cantidad a mano, como hoy. Las líneas ya creadas con ella conservan su cantidad y su
precio congelados en el snapshot.

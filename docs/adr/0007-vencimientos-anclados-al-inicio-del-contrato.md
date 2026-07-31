# ADR 0007: Vencimientos anclados al inicio del contrato

- **Fecha:** 2026-07-31
- **Estado:** Aceptada
- **Sustituye a:** el «Pendiente» del [ADR 0004](0004-periodicidad-de-renta-diaria.md)

> Decisiones tomadas al aceptar (2026-07-31): (1) el vencimiento número *k* se
> calcula sumando *k* periodos a la **fecha de inicio**, no avanzando sobre el
> vencimiento anterior; (2) el día se recorta al último del mes destino y se
> recupera en el siguiente; (3) los calendarios ya generados se realinean con una
> migración de datos que **no toca ninguna cuota PAGADA** y se salta —reportando—
> los contratos que no puede reparar sin destruir información; (4) se elimina
> `avanzarPeriodo`, la primitiva acumulativa que causaba el defecto.

## Contexto

El calendario de pagos de un contrato se generaba avanzando el vencimiento de uno
en uno con `Date.setMonth`. Ese método **desborda** en los meses cortos: pedirle
el 31 de febrero devuelve el 3 de marzo. Consecuencias sobre la serie:

```
contrato del 29, mensual        real (setMonth)            correcto
                                29-ene                     29-ene
                                01-mar   ← febrero perdido 28-feb
                                01-abr                     29-mar
                                01-may                     29-abr
```

Dos daños distintos, y el segundo es el que importa:

1. **Los vencimientos posteriores caen el día 1** en vez del día pactado. El
   arrendador cobra en una fecha que su contrato no dice.
2. **Un periodo desaparece del calendario.** Febrero no tiene cuota: ni pendiente,
   ni vencida, ni nada. La renta de ese mes no se reclama y nada lo señala.

Afecta a las cadencias en meses (`MENSUAL`, `BIMESTRAL`, `TRIMESTRAL`,
`SEMESTRAL`, `ANUAL`) cuando la fecha de inicio cae en día 29, 30 o 31 — y a
`ANUAL` desde un 29 de febrero. Las cadencias en días (`DIARIA`, `SEMANAL`,
`CATORCENAL`, `QUINCENAL`) usan `setDate` y son exactas.

No es teórico: está en la base de la demo. El contrato vigente (29/07/2026 →
01/03/2028) tiene veinte cuotas y **febrero de 2027 no está entre ellas**; de
marzo de 2027 en adelante todas vencen el día 1.

### Por qué ahora y no en el ADR 0004

El ADR 0004 lo dejó anotado como «Pendiente» con una razón correcta: corregirlo
mueve las fechas de calendarios ya generados, incluidos pagos conciliados contra
facturas del propietario, y eso es una migración de datos y no un arreglo de
paso. Esa migración es justamente lo que trae este ADR.

Lo que cambió mientras tanto es la **visibilidad**. Hasta el commit `99f3d59` la
UI pintaba las fechas de calendario un día antes por una trampa de zona horaria,
de modo que el vencimiento del 01/03/2027 se leía «28/02/2027» y la serie parecía
continua: el defecto de formato estaba tapando el defecto de datos. Corregido el
primero, el hueco de febrero quedó a la vista.

### El hallazgo que cambia la solución

La corrección evidente —«usa `interval` de PostgreSQL, que sí ajusta al último
día del mes»— **no basta**, y conviene dejarlo escrito porque es la trampa en la
que cae la primera versión de cualquier arreglo. Comprobado contra la base:

```sql
select generate_series('2027-01-29'::date, '2027-06-01'::date, interval '1 month')::date;
--  2027-01-29 · 2027-02-28 · 2027-03-28 · 2027-04-28 · 2027-05-28
```

`generate_series` **acumula**: suma el intervalo al valor anterior, así que en
cuanto febrero recorta el día a 28, el 28 se queda pegado para siempre. Arregla
el mes perdido y deja la renta cobrándose un día antes cada mes, que es otro
error, solo que más silencioso.

La forma que sí funciona suma sobre la fecha original:

```sql
select ('2027-01-29'::date + (k || ' months')::interval)::date from generate_series(0,4) k;
--  2027-01-29 · 2027-02-28 · 2027-03-29 · 2027-04-29 · 2027-05-29
```

El recorte de febrero es local a febrero. Marzo recupera el 29.

## Decisión

**El vencimiento número `k` se calcula sobre la fecha de inicio**, no sobre el
vencimiento anterior:

```ts
periodoDeIndice(inicio, k, periodicidad)   // reemplaza a avanzarPeriodo(previo, periodicidad)
```

Para cadencias en días, `inicio + k×n días`. Para cadencias en meses, `inicio +
k×n meses` con el día recortado al último del mes destino
(`min(díaAncla, díasDelMes)`). Es la misma semántica que `+ interval` de
PostgreSQL, que es la que `lib/finanzas-calculo.ts` ya usaba y por la que ese
módulo nunca tuvo este defecto.

**`avanzarPeriodo` se elimina.** No tenía más consumidor en producción que el
generador del calendario, y dejar exportada la primitiva acumulativa es cómo se
propaga otra vez el mismo error.

**Los calendarios ya generados se realinean** con
`db/migrations/20260731_calendario_meses_cortos.sql`, que:

- recalcula el calendario correcto de cada contrato y lo compara con el guardado,
  **por conjuntos de vencimientos** y no por el síntoma («ancla ≥ 29»), para que
  alcance también cualquier calendario torcido por otra vía;
- borra las cuotas impagas y sin papeles que sobran, e inserta las que faltan;
- **nunca toca una cuota `PAGADO`**;
- **se salta y reporta** los contratos que no puede reparar sin destruir algo: los
  que tienen una cuota `PAGADO` en una fecha que el calendario correcto no
  contempla, y los que tienen una cuota impaga con factura, comprobante u
  observaciones fuera de sitio.

Es idempotente: tras la primera pasada no hay diferencia que reparar.

Un test cruza la serie de TypeScript contra la lista que devolvió la migración
corriendo contra la base. Si las dos implementaciones divergieran, la migración
realinearía los calendarios y la app volvería a torcerlos en la siguiente edición
del contrato, y el desacuerdo se vería como cuotas que aparecen y desaparecen
solas.

## Alternativas consideradas

### Dejarlo como estaba

Es lo que decidió el ADR 0004, y era defendible mientras el daño fuera «las
fechas están corridas». Al medirlo resultó que además **falta un periodo**, que
es renta que no se reclama, y el arreglo de formato lo dejó visible en pantalla:
ahora el operador ve el hueco y no puede hacer nada con él. Sostener el defecto
pasó a costar más que migrar.

### Recortar sin anclar (`generate_series` con `interval`, o `setMonth` con clamp)

Avanzar sobre el vencimiento anterior recortando el día al último del mes. Es la
corrección de una línea y **resuelve el mes perdido**.

Se descarta porque el recorte se vuelve permanente: un contrato del 29 pasa a
cobrarse el 28 desde el primer febrero, y el 31 pasa al 30 desde el primer abril.
Cambia el día pactado del contrato para siempre a cambio de arreglar un mes. El
modo de fallo es peor que el original justamente por ser plausible: nadie lo
mira dos veces.

### Reconstruir el calendario entero en la migración

Borrar todas las cuotas de los contratos afectados y regenerarlas.

Se descarta porque destruye los hechos: la fecha de pago, el método, la factura y
el comprobante de las cuotas ya pagadas. La migración tiene que respetar lo que
ya ocurrió, no solo producir una serie bonita.

### Re-fechar las cuotas en su sitio (`update` posicional) en vez de borrar e insertar

Emparejar la cuota *k* guardada con el vencimiento *k* correcto y actualizar su
`periodo`. Conserva la fila y con ella sus adjuntos, así que repararía también
los contratos que hoy se saltan por tener papeles fuera de sitio.

Se descarta por ahora por dos razones. Una, mover `periodo` puede chocar
transitoriamente con el índice único `(contrato_id, periodo)` y obliga a un paso
intermedio con valores temporales, que es maquinaria difícil de auditar en una
migración de datos de dinero. Dos, y más importante: el emparejamiento posicional
**supone** que la cuota *k* guardada corresponde al vencimiento *k* correcto, y
esa suposición se rompe justo en los casos raros donde importa. Preferimos dejar
esos contratos para revisión manual, con su lista impresa, a repararlos con una
heurística.

### Guardar `periodo` como `date` en vez de `text`

La columna es `text` con formato `YYYY-MM-DD`. Con tipo `date` la aritmética sería
nativa y la comparación no dependería del formato.

No se decide aquí. Es un cambio de esquema con su propio backfill que además
tocaría el serializado hacia la UI (fue el origen del otro defecto de fechas, el
de formato), y esta migración no lo necesita: compara texto contra texto generado
con `to_char(..., 'YYYY-MM-DD')`, que es exactamente lo que escribe la app.

## Consecuencias

**Positivas**

- Ningún periodo vuelve a desaparecer del calendario. La renta de todos los meses
  de la vigencia se reclama.
- El vencimiento cae el día que dice el contrato, salvo en los meses que no tienen
  ese día, donde cae el último — y se recupera al mes siguiente.
- La aritmética de vencimientos deja de estar duplicada con criterios distintos:
  el generador (TypeScript) y la migración (SQL) producen la misma serie, y hay un
  test que lo fija.
- Desaparece del código la primitiva que causaba el defecto.

**Negativas**

- **La migración mueve fechas de vencimiento ya generadas.** Es el costo que el
  ADR 0004 no quiso pagar y que aquí se paga a conciencia. Quien haya exportado o
  enviado un calendario de pagos a un propietario verá fechas distintas después
  del despliegue: hay que avisar al equipo de Arrendadores antes, no después.
- **El número de cuotas de un contrato puede cambiar**, y con él su renta total
  comprometida. La serie correcta no tiene por qué tener la misma longitud que la
  torcida: la torcida podía perder un periodo por el mes corto y ganar otro por la
  cola al desplazarse. En el contrato de la demo quedan veinte en ambos casos,
  pero no es una garantía general, y el P&L de un contrato puede moverse.
- **Quedan contratos sin reparar** —los que tienen un pago real en una fecha que
  el calendario correcto no contempla— que exigen que una persona decida. La
  migración los lista, pero no los arregla.
- Los datos **no se revierten solos** (ver «Cómo revertir»).

**Implicaciones de seguridad**

- **Superficie de ataque:** sin cambios. No se añaden endpoints, dependencias ni
  campos de entrada; `periodoDeIndice` es aritmética pura, sin acceso a BD, red ni
  entorno.
- **Entrada no confiable:** ninguna. La migración no toma parámetros: opera sobre
  columnas ya validadas por el `CHECK contrato_completo_ck` y no construye SQL
  dinámico.
- **Aislamiento multi-tenant:** la migración corre como `postgres`, que **salta la
  RLS**, y por tanto toca los contratos de TODAS las organizaciones. Es
  deliberado —es una reparación global— y no mueve datos entre tenants: el
  `tenant_id` de cada cuota nueva se toma del contrato al que cuelga, en la misma
  fila, nunca de un parámetro ni de otra tabla. Un tenant no puede acabar con
  cuotas de otro.
- **Integridad del dinero:** la migración es la operación más delicada de este
  cambio y por eso va envuelta en una transacción única, es idempotente, nunca
  escribe `PAGADO`, y se detiene ante cualquier fila que tenga un pago real o un
  documento adjunto en una posición inesperada. El peor caso es que repare de
  menos y lo diga.
- **Auditoría:** la migración no pasa por `registrarAccion` —es una operación de
  esquema, no de usuario— así que su rastro es el reporte que imprime y el backup
  previo. Conviene guardar la salida del `psql` junto al runbook del despliegue.

## Pendiente (no se resuelve aquí)

- Acortar la vigencia de un contrato deja vivas las cuotas que quedan fuera del
  nuevo rango: `generarCalendarioEnTx` inserta y reajusta importes, pero no borra.
  Es la misma familia de desincronización y pide la misma decisión que aquí se
  tomó para los pagos (qué hacer si alguna ya está PAGADA).
- `pagos_renta.periodo` sigue siendo `text` (ver alternativas).

## Cómo revertir

**El código sí.** Volver a `avanzarPeriodo` es revertir el commit; el generador
vuelve a producir la serie acumulativa.

**Los datos no.** La migración no guarda el calendario anterior, así que
deshacerla es restaurar `pagos_renta` desde el `pg_dump` previo al despliegue —el
del bloque 1 del runbook—, con la pérdida de cualquier pago registrado entre el
despliegue y la restauración.

Y sobre todo: **revertir el código sin revertir los datos deja el sistema en el
peor de los dos mundos.** Los calendarios quedarían realineados en la base y la
app volvería a torcerlos en cuanto alguien edite un contrato, que es exactamente
el desacuerdo entre las dos implementaciones que el test de cruce existe para
impedir. Si hay que revertir, se revierten los dos o ninguno.

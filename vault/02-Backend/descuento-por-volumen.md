---
tipo: contrato
estado: verificado
actualizado: 2026-09-28
tags: [backend, precios, descuentos, volumen, propuestas, dinero, snapshot, rls]
archivos:
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

> [!warning] Alcance
> Esta nota describe **solo** el volumen. Si un documento te habla de códigos
> promocionales o paquetes cerrados dentro de esta fase, describe trabajo que no
> se ha hecho.

> [!danger] SIN FUSIONAR — la migración espera aprobación del dueño
> Desde el **2026-09-28**, ningún cambio de base de datos aterriza sin que el
> dueño lo apruebe antes. La migración está escrita y probada contra bases
> desechables; lo que está detenido es la **fusión**, no el trabajo. El motivo
> no es ceremonia: cada migración que entra a `main` acaba corriendo en **g500**,
> la única instancia con datos de cliente reales, y su runner **se para en seco**
> si algo no cuadra. Una migración de más es una cola de despliegue detenida.

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

**Consecuencia que hay que tener escrita:** si el dueño deja el tope **por debajo**
de su propia escala de volumen, ninguna propuesta con volumen podrá tocar su
descuento hasta que arregle una de las dos cosas. Eso es visible y se explica; lo
contrario —un techo que no es techo— no se ve.

---

## 4 · El servidor decide el descuento (hallazgo B40)

> [!danger] La cadena de la Fase 1 vive ENTERA en el navegador — y esto no lo arregla
> `resolverTarifa` solo se llama desde `app/(app)/(shell)/propuestas/page.tsx`,
> que es `'use client'`, y el controller copia la `tarifaUnitaria` que manda el
> cliente **tal cual**. Se puede cerrar una venta de prime a 1 peso con un `curl`
> y queda congelada en el snapshot con toda la apariencia de ser auditable.
>
> Esta fase **no** arregla aquello —mover la cadena entera al servidor cambia el
> comportamiento de cada venta y espera decisión del dueño (D11)— pero **tampoco
> lo amplía**: el escalón de volumen nace del lado correcto.

Cómo: el cliente manda la **cantidad**; el porcentaje lo resuelve
`propuestas-controller.ts` leyendo `escalas_volumen` bajo RLS. El `itemSchema` de
zod **no declara** `descuentoVolumenPct`, y una prueba lee el archivo para
impedir que alguien lo añada sin darse cuenta — el mismo candado que el vendedor
de VEND-01.

Y la cantidad que cuenta es la **efectiva** (`cantidadEfectiva`), la misma que
multiplica la tarifa: una `cantidad: 999` inflada a mano en una unidad de tiempo
no regala ningún tramo, porque el rango de fechas manda.

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

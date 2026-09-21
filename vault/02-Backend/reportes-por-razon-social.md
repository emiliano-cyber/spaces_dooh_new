---
tipo: contrato
estado: verificado
actualizado: 2026-09-18
tags: [reportes, multi-entidad, razones-sociales, atribucion]
archivos:
  - apps/web/lib/data/reportes.ts
  - apps/web/lib/server/reportes-repo.ts
  - apps/web/components/demo/reportes/tabla.ts
  - apps/web/components/demo/reportes/consulta.ts
---

# La sexta dimensión: `entidad`

`GET /api/reportes/rentabilidad?dimension=entidad` — una fila por razón social:
**cuánto facturó y cuánta renta paga cada una.**

No la pidió el dueño. Pidió cinco y son cinco. Sale de la frase que define
el **ADR 0034** (`docs/adr/0034-multi-entidad-es-atribucion-no-aislamiento.md`):
**el dueño no quiere separar sus razones sociales, quiere verlas juntas.** La
pregunta siguiente de esa frase es «¿y cuánto pasa por cada una?», y hasta el
18/09 el dato estaba capturado y no había dónde mirarlo.

---

## 1 · Qué se atribuye, y con qué dato

**Solo lo que el dato dice.** De los cinco papeles del cuestionario, **dos
mueven dinero hoy**:

| Papel | Columna que lo dice | Qué se le atribuye |
|---|---|---|
| `ARRENDAMIENTOS` | `contratos_arrendamiento.entidad_id` | la renta de ese contrato |
| `VENTAS` | `facturas.entidad_emisora_id` | el ingreso de las reservas de esa campaña |

El puente del ingreso tiene tres saltos y conviene tenerlo claro:
**reserva → campaña → comprobante → razón social emisora.** La reserva no sabe
quién factura; la campaña tiene un comprobante (`facturas_campana_uq`, uno por
campaña) y el comprobante tiene emisora.

> [!important] Del comprobante se leen DOS columnas, y el importe NO es una de ellas
> `campana_id` y `entidad_emisora_id`, nada más. El ingreso del reporte sale de
> las **reservas prorrateadas por días**, igual que en las otras cinco
> dimensiones. Tomarlo del comprobante daría **dos facturaciones distintas del
> mismo periodo según el agrupador**, que es el error de raíz que este
> repositorio documenta (`lib/server/tenant.ts:87-89`).
>
> El mapa dice a nombre de **quién**, nunca **cuánto**.

### Lo que NO se puede atribuir

Tres papeles se capturan y **nada los consume**, y no es trabajo a medias:

- **`OPERACION`** — ninguna columna de `ordenes_trabajo` dice a nombre de quién
  se paga una visita.
- **La luz** — `consumos_energia` se ancla a predio o a pantalla, nunca a una
  sociedad.
- **`ACTIVOS` y `LICENCIAS`** — no existen como módulo. `lib/modulos.ts` no
  declara ninguno de los dos.

---

## 2 · Por eso esta dimensión NO PINTA MARGEN

Es la decisión de diseño, no un ahorro de columnas.

Un «margen» que fuera `ingreso − renta` **saldría mejor que el real**, porque le
faltarían **dos de las cuatro fuentes de costo**. Lo que se pinta es el **saldo
atribuido**, con ese nombre para que no se pueda confundir, y lo que falta se
dice **encima de la tabla, en ámbar y con su importe**.

Es la misma regla que ya obliga a declarar los recibos que faltan
(`CoberturaEnergia`) y las pantallas sin medidas (`ExclusionesM2`): **un número
que miente es peor que no tener el número.**

Columnas: `Razón social · Ingreso · Costo del espacio · Saldo atribuido ·
% de la facturación`. Ni operación, ni luz, ni costo total, ni margen.

> [!note] Los indicadores de arriba SÍ son los del negocio completo
> Las cuatro tarjetas grandes traen la operación y la luz dentro, y son
> **idénticas a las de `sitio`**. Cambiar de agrupador no puede cambiar las
> cifras grandes: es el mismo periodo y el mismo dinero. Lo que se retira es la
> columna **por fila**, no el total.

---

## 3 · Las tres reglas de las filas

1. **Todas las razones sociales salen, aunque sea en cero.** Mismo criterio que
   `trimestre`: un hueco se lee «faltan datos» y un cero se lee «no pasó nada»,
   que es la verdad. Y en la demostración importa: la sociedad de trámites y
   nómina no mueve dinero por el sistema y **tiene que verse que existe**.
2. **«Sin asignar» va SIEMPRE al final**, ordene el usuario lo que ordene. No es
   un competidor del ranking: es un hueco de captura. Se reconoce por la clave
   vacía —la única fila del reporte sin id— así que la regla no se activa en las
   otras cinco dimensiones. Hay prueba de las dos cosas.
3. **Abre por quien factura más** (`ingreso` descendente). No hay margen que
   ordenar.

Las **dadas de baja también se leen** (`activo = false`). No es un descuido: un
reporte de un periodo pasado puede tener renta y facturación a nombre de una
sociedad que hoy ya no se usa, y filtrarlas movería ese dinero a «Sin asignar» —
reescribir la historia según el estado de hoy. Es el error que este módulo ya
pagó con los contratos vencidos.

Los **papeles se pintan etiquetados** («Paga las rentas a los arrendadores»), no
los códigos, y la etiqueta sale de `catalogo_roles_entidad` — la **misma** fuente
que la pantalla de Razones sociales, para que el mismo papel no se llame de dos
formas según dónde salga.

---

## 4 · Dónde vive el reparto, y por qué ahí

En **`matriz()`**, en el mismo recorrido que las celdas por pantalla
(`PorEntidad`, `lib/data/reportes.ts`). No en el motor de la dimensión.

El motivo es concreto: el ingreso se prorratea **por días** y la renta **por
meses equivalentes**, con segmentos de vigencia y fracción de caras. Repetir esa
aritmética en otra función daría dos facturaciones distintas del mismo periodo el
día que una de las dos cambie. **Compartiendo el bucle no hay dos copias que
puedan divergir: hay una.**

Y la renta se atribuye **por segmento**, no por el contrato que gobierna el rango:
un relevo de contrato a mitad de año puede cambiar de razón social, y cargarle el
año entero a la última movería dinero entre sociedades sin ningún síntoma.

> [!tip] La prueba que de verdad protege esto
> `reportes.entidad.test.ts` exige que **el ingreso total sea EXACTAMENTE el de
> `sitio`**, y que las filas sumen el total. Si no, habría dos reportes dando dos
> facturaciones distintas del mismo periodo — y nada fallaría.

---

## 5 · Aislamiento (R2)

Las dos consultas nuevas usan **`q()`** y llevan **`tenant_id = $1` explícito**.
El guard `reportes-repo.aislamiento.test.ts` ve ahora **8 consultas** y las
comprueba todas.

**Comprobado por mutación el 18/09**: quitando el `where e.tenant_id = $1` de la
consulta de entidades, el guard se pone **rojo**. No es un guard vacuo.

`catalogo_roles_entidad` **no lleva `tenant_id`** —es un catálogo del producto,
los cinco papeles son iguales para toda la flota— así que su `join` no necesita
filtro. El de `entidad_roles` **sí lo lleva**.

---

## 6 · Los dos defectos que encontró el navegador, no las pruebas

Con **1691 unitarias en verde**, la pantalla decía dos cosas falsas. Las dos
vivían dentro de un `.tsx`, y `vitest.config.ts` **no monta jsdom a propósito**:
una decisión escrita en un componente no la prueba nadie.

| Decía | Por qué era falso |
|---|---|
| «Vende publicidad · **sin contrato**» | Una sociedad que solo comercializa **no tiene por qué** tener contrato de arrendamiento. Señalaba un problema inexistente debajo del nombre de la empresa |
| «**4** razones sociales **con movimiento**» | Una estaba en cero —a propósito— y además contaba «Sin asignar» como una sociedad más del cliente |

Las dos salieron a `tabla.ts` como `notaDeArrendador()` y `subtituloDeConteo()`,
**con sus pruebas**. Es el mismo remedio que ya se aplicó al tono de los avisos,
y por el mismo motivo.

> **La lección, y van varias en este módulo:** lo que las pruebas no ven, un
> navegador sí. Abrir la pantalla es parte de terminar.

## Relacionadas
[[_indice]] · [[finanzas-y-cobranza]] · [[arrendadores-y-contratos]] ·
[[multi-tenancy-y-rls]] · [[04-Datos/esquema]] · [[07-Agentes/diario/2026-09-18]]

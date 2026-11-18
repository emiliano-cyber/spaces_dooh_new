---
tipo: contrato
estado: verificado
actualizado: 2026-11-17
tags: [backend, propuestas, campanas, vendedores, dashboard, r2, sesion]
archivos:
  - apps/web/lib/propuestas-por-dia.ts
  - apps/web/lib/server/propuestas-resumen-repo.ts
  - apps/web/lib/server/propuestas-conteo-controller.ts
  - apps/web/app/api/propuestas/conteo-diario/route.ts
  - apps/web/lib/test/conteo-diario.e2e.test.ts
  - apps/web/lib/server/propuestas-resumen-controller.ts
  - apps/web/app/api/propuestas/resumen/route.ts
  - apps/web/components/demo/inicio/ConteoDiario.tsx
  - docs/Plan_Conteo_Campanas_Por_Dia.md
---

# Conteo de campañas por día, por vendedor (CONTEO-DIA)

`GET /api/propuestas/conteo-diario/?desde=&hasta=`: cuántas campañas **creó**
y cuántas le **aprobaron** a cada vendedor, **día por día**. Pedido del dueño
el 2026-11-17 («para cada vendedor y usuario grande», «las que se crearon y
las que se aprueban»). Plan: `docs/Plan_Conteo_Campanas_Por_Dia.md`.

## Por qué se cuenta sobre propuestas y no sobre `campanas`

Una campaña **nace ya CONFIRMADA** en el momento en que se aprueba su propuesta
(`generarCampanaDesdePropuesta`, `apps/web/lib/server/campanas-repo.ts:645`).
Lo que el vendedor «crea» antes es la propuesta de esa campaña, y el vendedor
vive en la propuesta (`propuestas.usuario_id`, ver [[vendedor-en-propuesta]]),
no en la campaña. Por eso:

| Serie | Fecha | Regla |
|---|---|---|
| **Creadas** | `propuestas.creado_en` | todas, acaben como acaben |
| **Aprobadas** | `propuestas.aprobada_en` | solo si **siguen** aprobadas — la regla de PROP-PER (`lib/propuestas-periodo.ts`): una aprobada que después se rechazó es una rechazada |

Las campañas **sin propuesta** (las de «Reservar») no entran: no tienen
vendedor ni fecha de aprobación. Contarlas pediría migración.

## Quién ve qué

`soloVendedorDe()` (`lib/server/propuestas-conteo-controller.ts`): quien tiene
`comercial.aprobar` —Dueño, Administrador, Director comercial, Gerente de
ventas ([[roles-de-venta]])— ve a todos, con «sin vendedor» y el total; quien no
(el vendedor), **solo lo suyo**. Es la regla de `soloDe()` de [[captacion]],
con el permiso de Comercial. **El tablero de propuestas por periodo
(`/api/propuestas/resumen`) sigue la misma regla desde el 17/11** (decisión
del dueño): antes le enseñaba al vendedor las cifras de todo el equipo. El filtro sale de la **sesión**: ningún parámetro
de la URL lo cambia, y la e2e lo intenta con tres nombres distintos.

## El día, en la zona del negocio

`filasConteoDiario()` corta el día con `(creado_en at time zone $zona)::date`,
con `zonaDelNegocio()`. El `to_char(p.creado_en, …)` del tablero por periodo
usa la zona de la **conexión**: por mes da igual, por día son seis horas de cada
día. La e2e lo mide con la base en UTC: lo creado a las 23:30 de Ciudad de
México cuenta en **ese** día.

## Límites

- Sin fechas: los últimos **30** días del negocio (el bloque del Dashboard).
- Como máximo **92** días; un rango al revés, o un día que no existe
  (`2026-02-31`, que `Date.parse` de V8 acepta corrido a marzo), dan **400**.
- Los días sin movimiento salen en **0**, no desaparecen.

## Pruebas

- `lib/propuestas-por-dia.test.ts` — la cuenta, en puro.
- `lib/test/conteo-diario.e2e.test.ts` — 15 casos (13 del conteo y 2 del tablero por periodo) contra Postgres con el rol de
  la aplicación; los negativos: la vendedora no ve a otro (ni forzando la URL),
  no ve «sin vendedor», y nada de otra organización entra en la cuenta.

## En pantalla

El bloque **Campañas por día** del Dashboard: ver [[03-Frontend/dashboard-inicio]],
sección «Campañas por día (CONTEO-DIA, 17/11)».

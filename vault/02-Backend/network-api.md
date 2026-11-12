---
tipo: contrato
estado: verificado
actualizado: 2026-11-11
tags: [backend, network, api, token, rls, disponibilidad, rojo]
archivos:
  - apps/web/app/api/network/espacios/route.ts
  - apps/web/app/api/network/espacios/[id]/foto/route.ts
  - apps/web/lib/server/network-repo.ts
  - apps/web/lib/server/network-disponibilidad.ts
  - apps/web/lib/server/network-token.ts
  - apps/web/lib/test/network-espacios.e2e.test.ts
  - infra/env/app.env.example
---

# La API de Network — lo que la nueva app sincroniza

> [!important] Decidido por el dueño el 2026-11-11
> «Que una vez tengamos la nueva app se puedan sincronizar los espacios
> disponibles, y que el switch de Network ponga la pantalla accesible para la
> app». Respuestas al preguntarle: **la app consulta** (la instancia no empuja
> nada) y recibe **ficha pública + días libres**.

El switch «En la Network» de cada pantalla (`sitios.en_network`, pantalla
**Network**, `app/(app)/(shell)/network/page.tsx`) existía desde junio pero
**nadie de fuera lo leía**. Desde hoy es la puerta: con el switch encendido la
pantalla sale en esta API; apagado, **no existe** para la app en la siguiente
consulta. No hay nada que sincronizar a mano.

## Las dos rutas

| Método | Path | Credencial | Devuelve |
|---|---|---|---|
| GET | `/api/network/espacios?desde=&hasta=` | `x-network-token` = `NETWORK_TOKEN` | `{ generadoEn, desde, hasta, espacios[] }`. Rango por omisión hoy → +90 días; **máximo 366**; fechas `YYYY-MM-DD` o **400** |
| GET | `/api/network/espacios/[id]/foto` | la misma | Los **bytes** de la foto promocional (o la primera de la galería). Inexistente, switch apagado o sin foto → **404** los tres, para no confirmar ids |

Sin token o con uno equivocado → **401**. Sin `NETWORK_TOKEN` en el entorno la
ruta está **cerrada para todos** — lo de fábrica, igual que `FLOTA_TOKEN`.

> [!note] Por qué un token propio y no `FLOTA_TOKEN`
> El panel de flota es de AS OOH y solo ve versiones; la app de Network ve el
> inventario comercial. Son terceros distintos y cada uno tiene que poder
> revocarse sin cortar al otro. La comparación en tiempo constante es la de
> `lib/server/flota.ts` (`tokenCoincide`), **importada**, no copiada.

## Qué trae cada espacio — y qué NO

Ficha pública: `id`, `organizacionId`, `codigo` (clave interna), `nombre`,
`tipoMedio`, `direccion` (la comercial si hay), `ciudad`, `estado`, `pais`,
`lat`, `lng`, `ancho`, `alto`, `caras`, `iluminado`, `orientacion`,
`resolucionPx`, `spotsPorHora`, `duracionSpotSeg`, `totalSpots`, `horario`,
`comercializacion`, `moneda` (la de la organización), `tarifaPublicada`,
`modalidades` (`unidad` + `tarifaPublicada`), `tieneFoto`, `actualizadoEn` y
`disponibilidad: { desde, hasta, libres: [{desde, hasta}] }`.

> [!danger] No salen, y la e2e afirma las claves EXACTAS
> Costo de compra, tarifa mensual/interna, impresión, precio por m², notas,
> arrendador, contrato; y de las reservas **solo las fechas** — ni campaña, ni
> cliente, ni precio. Es lo mismo que `listarSitiosRed` esconde a las otras
> organizaciones. El objeto se arma **clave a clave** en `network-repo.ts`: una
> columna nueva en `sitios` no se cuela sola, y si alguien añade una clave, la
> prueba se rompe en vez de dejarla pasar.

## Los días libres: la regla del alta, no otra

`network-disponibilidad.ts` (`periodosLibres`, puro y con unitarias) usa la
misma regla que el alta de reservas en `campanas-repo.ts`:

- **Estática** → exclusiva: cualquier reserva **no cancelada** que pise el día
  la ocupa (capacidad 1).
- **Digital** → ocupada el día en que las campañas **distintas** llegan a
  `total_spots`. Sin `total_spots` no hay tope: siempre libre (el alta tampoco
  lo pone).

> [!warning] Libre por DÍA no garantiza un tramo largo en una digital
> El alta de una digital cuenta las campañas que pisan **cualquier** día del
> rango pedido. Con tope 2, la campaña A en la primera mitad y la B en la
> segunda dejan cada día con hueco, pero el mes entero choca. Lo que se publica
> es libre por día; vender el tramo lo valida el alta. Si la app necesita
> «libre para todo el tramo», es una consulta distinta.

## RLS: por qué recorre las organizaciones (ROJO · R2)

No hay sesión ni tenant: pregunta la app. `sitios` y `reservas` son
**fail-closed**, así que un `qRaw` devolvería **cero pantallas sin un solo
error** —exactamente el modo de fallo R2—. El repo lee `tenants` (exenta) y
consulta cada organización con `qConTenant`, más `and tenant_id = $1` como
segunda capa. Lo fija `lib/test/network-espacios.e2e.test.ts` contra Postgres
real: dos organizaciones, el switch encendido y apagado, una reserva
confirmada y una cancelada, la foto y los 401.

## Lo que falta

- **La app no existe todavía.** Cuando exista: poner `NETWORK_TOKEN` en el
  `app.env` de cada instancia que quiera publicar (plantilla en
  `infra/env/app.env.example`) y dárselo a la app. El alta (`provision-instancia.sh`,
  `instalar-hijo.sh`) **no** lo genera aún: es opcional y se pone a mano.
- Si la app quiere enterarse al instante de un switch (en vez de consultar),
  sería el modo «empujar», que el dueño **no** eligió.

Ver también [[inventario-y-sitios]], [[api-endpoints]], [[multi-tenancy-y-rls]].

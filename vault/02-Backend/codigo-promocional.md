---
tipo: contrato
estado: verificado
actualizado: 2026-09-30
tags: [backend, precios, descuentos, cupones, promociones, propuestas, dinero, snapshot, rls, concurrencia, aprobacion]
archivos:
  - db/migrations/20260928_codigo_promocional.sql
  - db/migrations/20261003_codigo_aprobacion.sql
  - apps/web/lib/codigo-aprobacion.ts
  - apps/web/app/api/propuestas/[id]/codigo/decision/route.ts
  - apps/web/lib/data/codigo-aprobacion-api.ts
  - apps/web/components/demo/codigos/BloqueCodigoPropuesta.tsx
  - apps/web/lib/codigo-promocional.ts
  - apps/web/lib/descuento.ts
  - apps/web/lib/server/codigos-repo.ts
  - apps/web/lib/server/codigos-controller.ts
  - apps/web/app/api/codigos-promocionales/route.ts
  - apps/web/app/api/codigos-promocionales/[id]/route.ts
  - apps/web/app/api/propuestas/[id]/codigo/route.ts
  - apps/web/lib/server/propuestas-repo.ts
  - apps/web/lib/server/campanas-repo.ts
  - apps/web/lib/data/codigos-api.ts
  - apps/web/components/demo/codigos/GestionCodigos.tsx
---

# El código promocional

**ADR 0039, Fase 3.** «Usa este código y ten un 20 % adicional.» El escalón que va
**después** del descuento comercial y **antes** de la comisión de agencia:

```
tarifa base = f(pantalla, unidad, franja, fecha)     ← Fase 1
      ×  descuento por volumen                       ← Fase 2
      ×  descuento comercial (con su tope)
      ×  CÓDIGO PROMOCIONAL                          ← esta nota
      ×  (1 − comisión de agencia)
      =  neto
```

> [!warning] Alcance
> Esta nota describe **solo** el código. Los **paquetes cerrados** son la Fase 4 y
> **no existen**. Si un documento te habla de ellos dentro de esta fase, describe
> trabajo que no se ha hecho.

> [!danger] LA MIGRACIÓN NO ESTÁ FUSIONADA
> `20260928_codigo_promocional.sql` está escrita y probada contra bases
> desechables, pero **el dueño pidió el 2026-09-28 aprobar todo cambio de esquema
> antes de que aterrice**. Lo detenido es la fusión, no el código.

> [!important] Desde COD-03 (2026-09-30) el cupón aplicado NACE PENDIENTE
> El cliente no lo ve —ni la línea ni el total con él— hasta que lo aprueba
> alguien con `comercial.aprobar`. Lo que dicen §3–§5 sobre el canje sigue
> valiendo; lo que cambia está en **§8**, y es lo primero que hay que leer antes
> de tocar el canje, la liga pública o la aprobación de una propuesta.

---

## 1 · Lo que hace distinto a este escalón

Es **el único de los cuatro que le promete algo a alguien de fuera de la casa**.
Una escala de volumen es una regla interna: si mañana cambia, nadie fuera se
entera. Un cupón se le dice a un cliente por su nombre, y a partir de ahí el
sistema tiene que poder sostener esa frase.

De ahí salen las dos propiedades que un cupón tiene y el volumen no: **vence** y
**se agota**. Y las dos son, literalmente, **un reloj y un contador** — dos cosas
que no pueden vivir en el navegador de quien vende.

Por eso esta fase parte en dos lo que la Fase 2 tenía junto:

| Dónde | Qué |
|---|---|
| `lib/codigo-promocional.ts` | Las **reglas**. Módulo puro: no sabe qué día es ni cuántas veces se usó |
| `lib/server/codigos-repo.ts` | Los **datos** que las alimentan: `current_date` de Postgres y el `count(*)` de canjes, leídos con la fila del cupón **bloqueada** |

Si el módulo puro llamara a `new Date()`, la vigencia la decidiría el reloj de la
máquina que ejecute el código — y con `next dev` esa máquina es la de quien
desarrolla.

> Esto es consecuencia directa del hallazgo **B40** (`docs/Supervision/ABIERTOS.md`):
> la cadena de precio de la Fase 1 vive **entera en el navegador**. Esta fase **no
> arregla** aquello —es la decisión **D11**, del dueño— pero **nace del lado
> correcto**: la pantalla manda el código tecleado y nada más.

---

## 2 · El esquema

### `codigos_promocionales` — el catálogo de la organización

| Columna | Qué |
|---|---|
| `tenant_id` | Cada empresa pone los suyos (ADR 0039 §3). RLS `enable` + `force`, cerrada por los **dos** lados |
| `codigo` | El texto. Se **compara** en mayúsculas |
| `descuento_pct` | `> 0` y `<= 100`. El 0 se prohíbe en la base |
| `vigente_desde` / `vigente_hasta` | Los dos extremos **inclusivos** |
| `usos_maximos` | `NULL` = **sin tope**; el freno es la fecha. Nunca 0 |

`unique (tenant_id, upper(codigo))` — índice de **expresión**, el mismo recurso
que `usuarios_email_lower_uidx` y compatible con PostgreSQL 14. Es lo que hace que
un cupón sea **una palabra y no dos**: si `verano20` y `VERANO20` pudieran ser dos
filas con dos porcentajes, el descuento dependería de cómo lo tecleó el cliente.

### `canjes_codigo` — el registro de cada canje, **y el contador**

`(tenant_id, codigo_id, propuesta_id, usuario_id, canjeado_en)`, con las dos FK
**compuestas con el tenant** y `unique (propuesta_id)`.

> [!important] NO EXISTE NINGUNA COLUMNA `usos_consumidos`
> El número de usos es `count(*)` sobre esta tabla, y punto. Un contador *además*
> del registro serían dos respuestas a la misma pregunta, y un `on delete cascade`
> desde `propuestas` desincronizaría la columna sin que nadie lo viera — el cupón
> quedaría agotado para siempre con cero canjes vivos. Contando filas eso no puede
> pasar por construcción.

### Las cuatro columnas nuevas

`propuestas.codigo_texto`, `propuestas.codigo_descuento_pct`,
`propuestas.codigo_canjeado_en` y `reservas.codigo_descuento_pct`.

`propuestas_codigo_pareja_ck` exige que las tres viajen juntas o ninguna: un
porcentaje sin su código es un descuento que nadie puede auditar, y un código al
0 % es una promesa que se aceptó y no se cumplió.

---

## 3 · La carrera del último uso

Dos vendedores canjeando a la vez el último uso es una carrera **real**, y el
camino ingenuo —contar, comprobar, insertar— la pierde siempre: los dos leen N−1
y los dos insertan.

Se resuelve en `codigos-repo.ts:canjearCodigo`, y **el orden es todo el
mecanismo**:

1. `select … for update` sobre la **fila del cupón**. El segundo que llegue se
   queda esperando **aquí**, antes de haber contado nada.
2. Solo entonces se cuentan los canjes. En `READ COMMITTED` cada sentencia toma
   una instantánea nueva, así que cuando el primero confirma, el segundo cuenta
   **incluyendo** el canje recién insertado.
3. Y decide `motivoCanjeImposible`, que ve el conteo de verdad.

Contar *antes* de bloquear no serviría de nada: sería el mismo `select` sin lock
con un `for update` decorativo detrás.

> **Medido, no razonado.** `codigo-promocional.e2e.test.ts` lanza dos peticiones
> HTTP a la vez sobre un cupón de un solo uso y exige que **una gane y otra
> pierda**; y cinco a la vez sobre uno de dos usos, exigiendo exactamente dos. Un
> mutante que quita el `for update` **muere** en esa prueba.

El `unique (propuesta_id)` es la **segunda red**, y cubre otra cosa: el **doble
clic** sobre la misma propuesta. Contra eso no sirve ningún bloqueo de otra fila.

---

## 4 · Las tres decisiones con trampa

### ¿El canje se cuenta al APLICAR o al APROBAR? → **Al APLICAR**

Contar al aplicar hace que una cotización abandonada se coma un uso. Contar al
aprobar hace que **dos vendedores le prometan el descuento a su cliente y uno se
lo tenga que quitar al firmar**.

Se elige aplicar porque el momento en que se hace la promesa es el momento en que
se teclea el código, así que es ahí donde el sistema tiene que poder decir «sí» o
«no». **Un «sí» que después se convierte en «no» no se arregla con una nota de
crédito.**

El coste se paga y se mitiga: **quitar el código devuelve el uso**, y borrar la
propuesta también (`on delete cascade`). El uso solo queda retenido mientras la
promesa siga en pie.

### ¿El cupón cuenta contra el tope de descuento? → **NO** (COD-02, preguntado)

Vive entero en `CODIGO_CUENTA_CONTRA_TOPE` (`lib/descuento.ts`), hoy `false`.

El tope y el cupón **acotan a personas distintas**. El tope nació el 28/09 para
que ningún *comercial* regalara el 90 % por su cuenta: acota la discreción de
quien vende. El volumen sí cuenta (**VOL-02**) porque se apila debajo del vendedor
sin que él lo elija. Un cupón es lo contrario: **lo creó el dueño**, desde una
pantalla con `exigirCambioSensible`. Esa decisión *es* la autorización.

**Lo que cuesta, con todas las letras:** el descuento total de una venta puede
pasar del tope. Con volumen 15 %, comercial 20 % y cupón 20 % se regaló el 45,6 %
y el tope decía 20.

### ¿Un cupón vencido aplicado antes de vencer sigue valiendo? → **SÍ**

La vigencia gobierna **el canje**, no lo canjeado. Una cotización enviada el 30 y
firmada el 2 no puede cambiar de total sin que nadie la toque — es el invariante 3
del ADR 0039. `codigo_canjeado_en` es lo que lo deja demostrado.

Y al revés: ese mismo cupón **ya no se puede aplicar** a una cotización nueva.

---

## 5 · El congelado — dos redes

1. **Al canjear**, `canjearCodigo` copia texto, porcentaje y momento a
   `propuestas`. Igual que el ítem ya copiaba `tarifa_unitaria` y
   `descuento_volumen_pct`.
2. **Al aprobar**, `congelarSnapshotEconomico` los vuelve a congelar **sin releer
   `codigos_promocionales`** (hay una prueba que lo exige).

Es la diferencia real con la **franja**, que sí relee su catálogo para congelar su
nombre.

Consecuencia, y es el criterio que decide si esta fase está bien hecha:
**cambiar o borrar el cupón mañana no mueve una propuesta aprobada.** Probado en
unitarias y en e2e: se vende al 20 %, se aprueba, el dueño sube el cupón al 60 % y
después lo **borra**, y ni el snapshot ni la línea viva se mueven un peso.

Los campos del código se guardan **solo cuando hay código**: el snapshot de una
venta sin cupón es byte por byte el mismo JSON que producía la Fase 2.

---

## 6 · Qué NO hace

- **No arregla B40.** La `tarifa_unitaria` sigue llegando del navegador.
- **No admite más de un código por propuesta** (`unique (propuesta_id)`).
- **No limita** cuántos cupones tiene una organización.
- **No prohíbe** crear un cupón ya vencido — es legítimo capturar en octubre la
  promoción de diciembre, y el canje lo rechaza igual.
- **Borrar un cupón reinicia su cuenta de usos** si se vuelve a crear con el mismo
  código: sus canjes se van en cascada. Para apagarlo sin perder la cuenta, se le
  pone la fecha de fin en el pasado.

---

## 8 · La APROBACIÓN del cupón (COD-03, 2026-09-30)

### Las decisiones del dueño, textuales

1. «En propuesta se debe de poder poner un cupón si fue rechazada para volverla
   a activar» → aplicar un cupón a una **RECHAZADA** la pasa a **BORRADOR** en la
   **misma transacción** del canje, con la línea «Reactivó la propuesta con el
   código X» en Actividad. A BORRADOR y no a ENVIADA: el cupón aún tiene que
   aprobarse y la propuesta volver a mandarse.
2. «Si está en borrador, asignar un cupón existente» → **selector** de los
   cupones vigentes en el detalle (además de teclearlo). El bloque aparece en
   BORRADOR, ENVIADA y RECHAZADA (`admiteCupon`).
3. «Si se asigna, no se muestra al cliente hasta que un admin o gerente lo
   apruebe» → **todo cupón aplicado nace `PENDIENTE`**. Deciden quienes tienen
   `comercial.aprobar`: DUENO, ADMINISTRADOR, DIRECTOR_COMERCIAL y
   GERENTE_VENTAS («los cuatro»). El VENDEDOR aplica y **no** decide (403).
4. **Opción B**: mientras está PENDIENTE el cliente ve la propuesta **sin** el
   descuento y **puede** aceptarla así.
5. Columnas aprobadas: **tres** en `propuestas` — `codigo_estado`,
   `codigo_aprobado_por`, `codigo_aprobado_en` ([[04-Datos/esquema]]).

### Las reglas DERIVADAS (no son palabras del dueño)

Las propuso la sesión principal para que el dinero cuadre con la opción B, y se
dejan marcadas como tales por si el dueño las quiere revisar:

| Regla | Dónde |
|---|---|
| Si el **cliente acepta** con el cupón PENDIENTE, acepta el precio que vio: dentro de la transacción de la aceptación, con la fila bloqueada, se quita el cupón y se **devuelve su uso** antes de pasar a APROBADA; el snapshot se congela después y lo lee ya sin cupón. Queda en Actividad a nombre de «Cliente (liga pública): …» | `aceptarPropuestaPublica` (`propuestas-repo.ts`) + `quitarCanjeEnTx` (`codigos-repo.ts`) |
| **Aprobar por dentro** con el cupón PENDIENTE → **409** «Primero aprueba o rechaza el código promocional…» | `cambiarEstatusPropuesta`, con la condición repetida en el `where` del `update` |
| **Rechazar** el cupón lo quita y **devuelve el uso** (la misma `quitarCanjeEnTx`), con **motivo obligatorio** (3–500) escrito en Actividad | `decidirCodigo` (`codigos-repo.ts`) |

### Lo que ve quién

| Superficie | Con PENDIENTE | Con APROBADO |
|---|---|---|
| `GET /api/propuestas/publica/:token` (la consumen `/p/[id]` y `/propuesta`) | **Sin cupón**: `codigoTexto` null, monto 0, total sin él. Se filtra la **fila** con `filaParaCliente` antes de `armarPropuesta`, así que el texto no viaja en el JSON y ningún importe lo lleva | Con cupón, como antes |
| `POST /api/propuestas/publica/:token` (aceptar) | Acepta **sin** cupón; uso devuelto | Acepta **con** él |
| Detalle y lista internos (`/api/estado`) | Los importes **siguen contando** el cupón —es lo que se ofrece—; marca «Cupón pendiente» en la lista y «· cupón pendiente de aprobación» en el renglón | Etiqueta «Aprobado por X» |
| `GET /api/propuestas/:id/codigo` | `codigoEstado`, aprobador, y `puedeAprobarCodigo` calculado en el servidor con `tienePermiso(rol,'comercial','aprobar')` | ídem |

**Inventario de lo que ve el cliente, medido el 30/09:** solo la liga pública
(`app/api/propuestas/publica/[id]/route.ts` → `obtenerPropuestaPublica` y
`aceptarPropuestaPublica`). El **portal** (`/portal/[token]`) es de campañas y
no pinta precios; **no hay** PDF de propuesta (`generarPdf` es un marcador
vacío en el detalle interno) ni correo que lleve precio. Si mañana aparece uno,
tiene que leer la propuesta por `filaParaCliente` o heredar del snapshot.

### Lo que no se ve y conviene saber

- **Nadie aprueba su propio canje** al aplicarlo, ni siquiera un gerente: el
  canje SIEMPRE deja PENDIENTE. Son dos clics y Actividad dice quién dio cada uno.
- **La fila de la propuesta se bloquea** (`for no key update`) en el canje, en
  quitar, en la decisión y en la aceptación pública. Es lo que impide que una
  propuesta quede APROBADA con un cupón PENDIENTE congelado en el snapshot. Si un
  gerente aprueba el cupón *a la vez* que el cliente acepta y gana el gerente, el
  cupón se conserva: el cliente paga **menos** de lo que vio, nunca más.
- **El uso se sigue contando al APLICAR** (§4), también si queda pendiente: un
  cupón de un solo uso pendiente en una propuesta está agotado para las demás
  hasta que se apruebe —y se quede— o se rechace —y vuelva—.
- **El backfill** dejó APROBADOS, sin aprobador, los cupones aplicados antes de
  la migración: el cliente ya los veía. La etiqueta dice «Aprobado» a secas.

Pruebas: `lib/codigo-aprobacion.test.ts`, `lib/server/codigos-aprobacion.test.ts`,
`lib/server/propuestas-repo-codigo-aprobacion.test.ts` y
`lib/test/codigo-aprobacion.e2e.test.ts` (22 casos, dos organizaciones, una base
propia para el backfill). **Mutantes con un build por mutante, los seis
muertos**: quitar el filtro público, quitar el 409 de aprobar, no quitar el
cupón al aceptar, decidir con `comercial.crear`, nacer APROBADO y no reactivar
la RECHAZADA.

---

## 7 · Dónde mirar

- Reglas puras: `apps/web/lib/codigo-promocional.ts`
- Canje y bloqueo: `apps/web/lib/server/codigos-repo.ts`
- El candado del esquema de entrada: `apps/web/lib/server/codigos-controller.ts`
- Migración: `db/migrations/20260928_codigo_promocional.sql` y, para la
  aprobación, `db/migrations/20261003_codigo_aprobacion.sql`
- La aprobación (COD-03): reglas puras en `apps/web/lib/codigo-aprobacion.ts`,
  `decidirCodigo` / `quitarCanjeEnTx` en `codigos-repo.ts`, la ruta
  `app/api/propuestas/[id]/codigo/decision/route.ts` y el bloque
  `components/demo/codigos/BloqueCodigoPropuesta.tsx`
- Pruebas: `codigo-promocional.test.ts`, `descuento.codigo.test.ts`,
  `codigos-canje.test.ts`, `propuestas-snapshot-codigo.test.ts`,
  `propuestas-repo-codigo.test.ts` y `lib/test/codigo-promocional.e2e.test.ts`

Relacionadas: [[02-Backend/descuento-por-volumen]] ·
[[02-Backend/rejilla-franja-y-temporada]] ·
[[02-Backend/comercial-propuestas-campanas]] · [[04-Datos/esquema]] ·
[[04-Datos/migraciones]] · [[06-Operacion/zonas-de-riesgo]]

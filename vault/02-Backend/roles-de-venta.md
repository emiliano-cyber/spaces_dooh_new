---
tipo: contrato
estado: verificado
actualizado: 2026-09-29
tags: [backend, roles, permisos, rbac, enum, migraciones, dueno, guards, carrera]
archivos:
  - db/migrations/20260929_roles_de_venta_enum.sql
  - db/migrations/20260929_roles_de_venta_matriz.sql
  - apps/web/lib/roles.ts
  - apps/web/lib/guardas-usuarios.ts
  - apps/web/lib/server/usuarios-repo.ts
  - apps/web/lib/server/usuarios-controller.ts
  - apps/web/app/api/usuarios/[id]/route.ts
  - apps/web/app/api/organizacion/route.ts
  - apps/web/lib/modulos.ts
  - apps/web/components/demo/shell/nav.ts
---

# Los cuatro roles de venta, y los dos guards del Dueño

**ADR 0040**, primer tramo. Lo que hay aquí son **los roles, su matriz y los dos
guards**. Los techos de descuento por rol, la autorización al aprobar y los
descuentos preaprobados **no están construidos**: son los tramos siguientes.

## Qué entró

| | Antes | Ahora |
|---|---|---|
| Valores de `rol_demo` | 6 | **10** |
| Roles CON permisos | 5 | **8** |
| Filas de `rol_permisos` | 41 | **86** |
| Módulos | 9 | **10** (entra `precios`) |
| `DUENO` | 24 filas | **26** |
| `COMERCIAL` | 5 filas | **0** |
| `usuarios.rol` default | `'COMERCIAL'` | **`'VENDEDOR'`** |

Los cuatro nuevos: **`ADMINISTRADOR`**, **`DIRECTOR_COMERCIAL`**,
**`GERENTE_VENTAS`**, **`VENDEDOR`**.

## Por qué son DOS migraciones y no una

> [!danger] Un valor de enum recién añadido NO se puede usar en la transacción que lo añadió
> Medido el 2026-09-29 contra **PostgreSQL 14.24** —lo que corre g500, la única
> instancia con datos de cliente— y no razonado:
>
> ```
> begin;
> alter type rol_demo add value if not exists 'VENDEDOR';
> alter table usuarios alter column rol set default 'VENDEDOR';
> commit;
>
> ERROR:  unsafe use of new value "VENDEDOR" of enum type rol_demo
> HINT:   New enum values must be committed before they can be used.
> ```
>
> Las migraciones de este repositorio traen su propio `begin; … commit;`, así
> que **una sola migración que añada los valores y los use MUERE**, y muere en
> el droplet.

La partición funciona porque **el runner aplica cada archivo con su propia
`cli.query()`** (`scripts/migrar.mjs`), y cada archivo trae su transacción: dos
archivos son **dos transacciones sobre la misma conexión**.
`apps/web/lib/test/db-e2e.ts` hace lo mismo con `p.query()` por archivo.
Comprobado contra el mismo PostgreSQL 14.24, en una sola sesión, y pasa.

El orden sale hoy del lexicográfico (`…_enum` < `…_matriz`). **No se añade una
entrada a `ANTES_DE`** —ese mapa es para las excepciones reales— pero el orden se
fija por dos vías: una prueba en `scripts/migrar.test.ts` y un **guard dentro de
la segunda migración**, que se niega a correr si los cuatro valores no existen ya.

## `COMERCIAL` se retira DE USO, no del esquema

Un valor de enum **no se puede quitar** sin recrear el tipo entero, y sobre una
tabla con datos eso no compra nada. Así que son tres cosas y ninguna es opcional:

1. **Se le quitan sus filas de `rol_permisos`.** `permisosDeRol` y `tienePermiso`
   (`apps/web/lib/server/auth.ts`) son consultas directas a esa tabla, sin
   excepción para ningún rol, y `exigir()` es fail-closed: sin filas, el valor
   existe y no autoriza nada.
2. **Sus usuarios pasan a `VENDEDOR`.** Decidido por el dueño el 29/09.
3. **Cambia el DEFAULT de la columna.** Si no, cada usuario nuevo sin rol
   explícito nacería con un rol que no puede hacer nada, y el síntoma —«entro y
   no veo ninguna pantalla»— no señala la causa.

> [!warning] Había un SEGUNDO default, en el código
> `usuarios-repo.ts` tenía `input.rol ?? 'COMERCIAL'` escrito a mano. Cambiar
> solo el de la columna habría dejado **el alta real** —la que usa el producto—
> creando COMERCIALes sin permisos, con el default de la base ya corregido y sin
> que nada fallara. Ahora sale de `ROL_POR_OMISION` (`lib/roles.ts`).

## El módulo `precios`, y por qué hubo que crearlo

El ADR pide que el vendedor **cotice** y **aplique** códigos pero **no los cree**.
Eso era **imposible de expresar**: desde la mañana del 29/09 los diez `route.ts`
del catálogo de precio exigían `comercial.crear`, que es el mismo permiso con el
que se crea una propuesta.

Así que el catálogo de precio —franjas, temporadas, escalas de volumen, códigos y
paquetes— pasa a su propio módulo, **`precios`**, y **los 19 guards** con él. No
es una vuelta atrás del cambio de la mañana: aquél movió las pantallas de
Inventario a Comercial (**de quién es el trabajo**), éste separa **quién puede
escribirlo**.

`/api/sitios/:id/rejilla` **no se movió**: es la captura de tarifas desde la ficha
de una pantalla, y sigue siendo inventario.

## La matriz

| | administracion | arrendadores | comercial | dashboard | finanzas | imprenta | inventario | network | operaciones | precios |
|---|---|---|---|---|---|---|---|---|---|---|
| **DUENO** | v c a | v c a | v c a | v | v c f | v c a | v c a | v c | v c a | v c |
| **ADMINISTRADOR** | v c a | v c a | v c a | v | v c f | v c a | v c a | v c | v c a | v c |
| **DIRECTOR_COMERCIAL** | — | — | v c a | v | — | — | v | v | — | v c |
| **GERENTE_VENTAS** | — | — | v c a | v | — | — | v | v | — | v c |
| **VENDEDOR** | — | — | v c | v | — | — | v | v | — | **v** |
| **COMERCIAL** | — | — | — | — | — | — | — | — | — | — |

`v` = ver · `c` = crear · `a` = aprobar · `f` = facturar.

> [!note] Hoy el director y el gerente tienen la MISMA matriz, y se dice en voz alta
> Las tres diferencias que el ADR les pone —el techo por rol, quién autoriza al
> aprobar y los preaprobados— son justo lo que este tramo no construye, y
> **ninguna de las tres es un par (módulo, acción)**. Cuando lleguen, se separan
> ahí.

> [!warning] Lo que la matriz NO puede decir, y queda como pregunta
> El ADR quiere que el gerente cree **paquetes sin autorización** y **códigos
> pidiéndola**. Las dos cosas son `precios.crear`: el vocabulario de acciones no
> las distingue. Aquí el gerente recibe `precios.crear` entero — **también crea
> códigos**. Separarlo de verdad sería un módulo más.

## Los cuatro sitios donde `DUENO` está escrito A MANO

Copiarle al administrador las filas de `rol_permisos` **no le da ninguno**:

| Dónde | Qué guarda | Decisión del 29/09 |
|---|---|---|
| `lib/server/tenant.ts` · `puedeCambiarCrm()` | cambiar de organización | **NO se toca.** Es de flota, no de empresa |
| `lib/server/tenant.ts` · el override por cookie | el mismo salto, por otra vía | **NO se toca** |
| `app/api/organizacion/route.ts` + `configuracion/page.tsx` | editar los datos de la empresa | **SÍ**, abierto |
| `app/(app)/(shell)/inventario/page.tsx` | la pantalla entera | **SÍ**, abierto |

Los dos que se abren se abrieron **a la vez, servidor y pantalla**. Abrir solo la
pantalla habría dejado al administrador con un formulario que contesta 403 al
guardar: el «encierro» que este repositorio ya documentó dos veces.

## Los dos guards, y dónde viven

> **Esconder un botón no es una regla: si solo está en la pantalla, un `curl` se
> lo salta.** Los dos van en el servidor.

1. **Un ADMINISTRADOR no puede desactivar, degradar NI ELIMINAR a ningún usuario
   con rol `DUENO`.** El borrado entra aunque el dictado dijera «desactivar ni
   degradar»: si se quedara fuera, el mismo actor conseguiría el mismo resultado
   con `DELETE` en vez de `PATCH`. → **403**
2. **Nadie puede dejar la organización sin ningún Dueño activo.** Aplica a todos.
   → **409**, porque no es falta de permiso sino un conflicto con el estado: el
   Dueño que lo intenta sí puede hacerlo en cuanto nombre a otro.

La **decisión** es pura y vive en `lib/guardas-usuarios.ts` (`rechazoDelCambio`);
los **datos** que la alimentan —el conteo de Dueños activos— los lee
`usuarios-repo.ts` con las filas **bloqueadas**. Es la misma separación que hizo
la Fase 3 del ADR 0039 con `lib/codigo-promocional.ts`.

### La carrera, y cómo se resuelve

Dos peticiones simultáneas desactivando a los dos últimos Dueños **pasan las dos
comprobaciones** si el conteo no va detrás de un bloqueo: las dos leen «hay 2», y
la organización se queda con **cero**.

```sql
select id, rol::text as rol, activo
  from usuarios
 where tenant_id = $1 and (id = $2 or (rol = 'DUENO' and activo))
 order by id
 for update
```

**Una sola sentencia**, y eso importa: bloquear primero al objetivo y luego el
conjunto haría que dos peticiones con objetivos cruzados tomaran los mismos dos
candados en orden opuesto — **deadlock**. Con `order by id`, el orden de los
candados es el mismo para todas.

Y el orden ES el mecanismo: se bloquea **antes** de contar. Contar antes sería el
mismo `select` sin lock con un `for update` decorativo detrás.

**Medido, no razonado:** la e2e lanza dos `PATCH` a la vez sobre los dos últimos
Dueños y exige que gane exactamente una y quede uno. El mutante que quita el
`for update` **muere ahí**, con dos ganadores.

### Un solo camino de escritura

`actualizarUsuario` y `borrarUsuario` pasan los dos por `conGuardasDeDueno`, y
`restablecerPasswordCtrl` también —aunque ahí los guards nunca salten—. Tener dos
caminos de escritura sobre `usuarios` es exactamente como se cuela mañana uno que
sí cambie el rol sin pasar por el guard.

El `actorRol` es **obligatorio y sin valor por omisión**, a propósito: viene de la
sesión del servidor, nunca del cuerpo, y que el compilador lo pida es lo único que
obliga a pensarlo a quien añada un tercer camino.

## El guard de RLS de la migración

`usuarios` es fail-closed + FORCE. Si el rol que aplica la migración no saltara la
RLS, el `update` **no fallaría**: afectaría a cero filas **en silencio**, y los
COMERCIAL se quedarían sin permisos y sin rol nuevo. Es el modo de fallo de la
zona **R2**. Por eso la migración empieza comprobando `rolsuper or rolbypassrls` y
**se niega a empezar** si no. Comprobado: corrida como `spaces_app` sale con
código 3 y la frase que dice qué hacer.

## Lo que sigue abierto

- **¿Un vendedor puede aprobar una propuesta sin descuento?** El ADR lo deja como
  pregunta 8. Aquí el vendedor **no** tiene `comercial.aprobar` — fail-closed.
- **¿El administrador puede PROMOVER a alguien a Dueño?** Hoy sí, con
  `administracion.crear`. No se prohibió porque no se pidió.
- **`ControlCambiosPanel.tsx`** sigue comprobando `rol === 'DUENO'` a mano: el
  administrador **no** ve el panel del candado de cambios. No estaba en la lista
  de cuatro del ADR.

## Enlaces

[[autenticacion-y-sesion]] · [[multi-tenancy-y-rls]] · [[codigo-promocional]] ·
[[paquete-cerrado]] · [[04-Datos/esquema]] · [[04-Datos/migraciones]] ·
[[06-Operacion/zonas-de-riesgo]]

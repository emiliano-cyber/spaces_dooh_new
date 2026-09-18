---
tipo: modulo
estado: verificado
actualizado: 2026-09-18
tags: [backend, frontend, entidades, fiscal, administracion, tenant, rojo, r2, r4]
archivos:
  - db/migrations/20260918_entidad_tenant_compuesto.sql
  - apps/web/app/(app)/(shell)/razones-sociales/page.tsx
  - apps/web/components/demo/razones-sociales/gestion.ts
  - apps/web/components/demo/razones-sociales/asignacion.ts
  - apps/web/components/demo/razones-sociales/GestionEntidadesFiscales.tsx
  - apps/web/components/demo/shell/nav.ts
  - apps/web/lib/modulos.ts
  - apps/web/lib/server/entidades-repo.ts
  - apps/web/lib/server/entidades-controller.ts
  - apps/web/lib/server/arrendadores-repo.ts
  - apps/web/lib/server/arrendadores-controller.ts
  - apps/web/lib/server/finanzas-repo.ts
  - apps/web/lib/server/finanzas-controller.ts
  - apps/web/app/api/entidades/route.ts
  - apps/web/app/api/estado/route.ts
  - apps/web/lib/test/entidad-tenant-compuesto.e2e.test.ts
  - apps/web/lib/test/entidad-en-documentos.e2e.test.ts
---

# Multi-entidad EN USO

[[02-Backend/entidades-fiscales]] construyó el backend el **17/09** y
[[02-Backend/cuestionario-bienvenida]] el alta el **18/09**. Las dos notas
terminan diciendo lo mismo: *no tiene pantalla* y *ningún endpoint escribe la
entidad en un contrato ni en una factura*. Esta nota es el día en que las dos
frases dejaron de ser ciertas.

> [!important] La decisión del dueño, 2026-09-18
> Se le preguntó si multi-entidad se enseña el **14 de octubre** y eligió:
> **«Sí, completo: pantalla y asignación»**. El motivo no fue la demo: la
> pantalla de bienvenida **ya le decía al usuario que fuera a Administración a
> gestionarlas**, y en Administración no había nada. Una promesa escrita que el
> producto no cumplía.

---

## 1 · Lo primero fue cerrar un agujero, y no era un extra

> [!danger] Las claves ajenas NO pasan por RLS. MEDIDO, no deducido
> Ejecutado el 18/09 con el rol `spaces_app`, dentro de una transacción que se
> deshizo, con `app.tenant_id = B`:
>
> ```
> select razon_social from entidades_fiscales;   → solo las de B   (la RLS lee bien)
> insert into entidad_roles (entidad_id, rol, tenant_id)
>   values (<entidad de A>, 'VENTAS', <B>);      → INSERT 0 1      ← PASABA
> ```
>
> **La RLS no lo ve porque la fila que se escribe LLEVA el tenant correcto** (B).
> Lo que apunta a otra organización es `entidad_id`, y de eso responde la clave
> ajena — que en PostgreSQL se comprueba **con los privilegios del dueño de la
> tabla referenciada** y por tanto **elude la política**. Siendo plana contra
> `(id)`, solo exigía que la fila existiera *en algún sitio*.
>
> Es el molde exacto de un fallo **R2**: **no da error**. Roles fiscales,
> contratos y comprobantes de una organización colgados de la razón social de
> otra, en silencio.

Hoy no se alcanzaba desde la aplicación porque `entidades-repo.ts` valida el
tenant antes de escribir. **Se volvía alcanzable justo al cablear el selector**,
que es lo que se iba a hacer. Por eso se cerró **antes** de tocar nada más.

`db/migrations/20260918_entidad_tenant_compuesto.sql` añade
`unique (id, tenant_id)` en `entidades_fiscales` —la pieza que faltaba, y por la
que las tres FK nacieron planas: PostgreSQL exige clave única en el destino— y
repunta las tres:

| Tabla | Antes | Ahora |
|---|---|---|
| `entidad_roles` | `(entidad_id) → (id)` cascade | `(entidad_id, tenant_id) → (id, tenant_id)` cascade |
| `contratos_arrendamiento` | `(entidad_id) → (id)` set null | `(entidad_id, tenant_id) → (id, tenant_id)` set null **(entidad_id)** |
| `facturas` | `(entidad_emisora_id) → (id)` set null | `(entidad_emisora_id, tenant_id) → (id, tenant_id)` set null **(entidad_emisora_id)** |

### Dos detalles que no se ven leyendo y que no hay que romper

1. **`MATCH SIMPLE`** —el de omisión, y aquí el correcto— no comprueba la FK
   cuando **alguna** de sus columnas es `NULL`. Como `entidad_id` es nullable y
   `tenant_id` es `not null`, **«sin asignar» sigue entrando sin tocar**. Con
   `MATCH FULL`, toda fila quedaría obligada a tener entidad y el módulo sería
   inservible hacia atrás — justo lo que la migración del 17/09 evitó.
2. **`on delete set null` exige LISTA DE COLUMNAS** aquí, y eso es
   **PostgreSQL 15+** (medido: el 5433 corre **16.14**). Sin ella el `set null`
   intentaría anular también `tenant_id`, que es `not null`, y borrar una
   entidad **fallaría** en vez de dejar el documento «sin asignar».

> [!tip] Se cierra en el ESQUEMA y no en el código, a propósito
> La validación del repo es algo que alguien puede olvidar en la siguiente ruta.
> Con la FK compuesta, olvidarla deja de ser posible: la base rechaza. La
> validación explícita **se conserva igual**, porque lo que llega por la FK es un
> `23503` que el usuario ve como un **500** sin nada que corregir. **La FK es la
> red; la validación es la puerta.**

**Prueba:** `apps/web/lib/test/entidad-tenant-compuesto.e2e.test.ts`, **11
casos**, con `poolApp()` vía `comoTenant` y **nunca** el pool de administración
—el rol `spaces` es superusuario y se salta la RLS aunque la tabla tenga FORCE—.
El rojo previo fue **7 de 11**, y los tres negativos clave fallaban con
`promise resolved [] instead of rejecting`. El bloque 4 es el **control
positivo**: sin él, el verde se podría conseguir rompiendo la escritura entera,
y lo que la FK tiene que discriminar es **de quién** es la entidad.

---

## 2 · La pantalla

**`/razones-sociales`**, bajo el shell, área `razones-sociales` del módulo
**`administracion`** (`lib/modulos.ts`). Lista, alta, edición, **baja lógica** y
**reactivación**. Los endpoints CRUD del 17/09 **no se rehicieron**: se usaron.

### La entrada de menú ya existía, y mentía

`components/demo/shell/nav.ts` tenía «Razones sociales» apuntando a
**`/bienvenida`** — el cuestionario, que **contestado responde 409** y solo
enseña lo que se contestó. Un menú que lleva ahí manda a una pantalla que ya no
hace nada. Ahora apunta a la gestión, y el cuestionario enlaza aquí en vez de
mandar a Administración.

> [!warning] Actividad y Administración son SIEMPRE los dos últimos
> `nav.test.ts` lo exige y lo pidieron expresamente. La entrada va **antes de
> Actividad** y **la aserción no se tocó**.

### Los CINCO papeles son fijos — y eso NO significa quemados

> [!danger] No crees la segunda lista
> **Decisión de Jochelo del 2026-09-18: los roles se quedan fijos los cinco**
> (`ARRENDAMIENTOS · ACTIVOS · LICENCIAS · OPERACION · VENTAS`). El esquema ya
> implementaba exactamente eso: `catalogo_roles_entidad` es **global, sin
> `tenant_id`**, y `entidad_roles.rol` es una FK contra él. La decisión
> **confirma el diseño, no lo cambia**.
>
> **La tentación es borrar la tabla y meter los cinco en un array de
> TypeScript. No se hace.** La tabla vale por lo que no se ve: corregir una
> etiqueta mal redactada, cambiar el orden o añadir un sexto es un `insert` o un
> `update`, **no reconstruir la imagen y actualizar cada instancia de la flota**.
> Y la FK es lo que impide que entre un rol inventado.
>
> Este repositorio ya pagó esa lección **dos veces**: hubo **DOS catálogos de
> permisos** —uno en una migración y otro en el guion de aprovisionamiento— y
> ganaba el que corriera último, **sin error y sin aviso**; en un ensayo el Dueño
> pasó de 19 a 24 permisos solo por el orden. **Lo que impide que dos listas
> divergan no es que hoy coincidan, es que solo exista una.**
>
> Consecuencia práctica: **la pantalla no ofrece crear, renombrar ni borrar
> papeles**, y los lee del catálogo con su `etiqueta` y su `orden`. Ampliarlos es
> un `insert`, no un despliegue.

`GET /api/entidades` devuelve ahora `{ entidades, catalogo }` — el catálogo con
etiqueta, reutilizando `catalogoRolesConEtiqueta` de `bienvenida-repo.ts` en vez
de escribir la consulta otra vez, por el motivo de arriba.

### Lo que se PINTA aunque incomode

| Aviso | Qué significa | Por qué importa |
|---|---|---|
| **Papel sin dueño** | Ninguna entidad **activa** lo tiene | Ningún documento de ese tipo se preasigna. Se nota semanas después y en otra pantalla |
| **Papel compartido** | Lo tienen **dos o más** activas | El selector **no propone nada**, y hay que elegir a mano cada vez |

El caso que muerde es **dar de baja la única que vendía**: el papel queda
huérfano y nada avisa. Por eso una dada de baja **no cuenta** como dueña de su
papel.

### La reactivación, que no existía

El `DELETE` da de baja lógica y **no había vuelta**: la única salida era capturar
otra con el mismo nombre, que es **el duplicado que este módulo existe para
evitar**. Se añadió `activo` al parche (`entidades-controller.ts`,
`entidades-repo.ts`), por el **mismo** `update`, así que sigue acotado por
`and tenant_id = $n`.

> `z.boolean()` y **no** `z.coerce.boolean()`: la cadena `"false"` coaccionada es
> **verdadera**, así que un cliente que mandara texto reactivaría creyendo que
> apaga. Mismo motivo que las preguntas de sí/no del cuestionario.

---

## 3 · La asignación, que es lo que lo pone en uso

`contratos_arrendamiento.entidad_id` (**quién PAGA**) y
`facturas.entidad_emisora_id` (**quién EMITE**) existían desde el 17/09 y
**ningún endpoint las escribía**. Ahora sí:

| Documento | Endpoint | Campo |
|---|---|---|
| Contrato | `PATCH /api/contratos/[id]` | `entidadId` |
| Comprobante | `POST /api/campanas/[id]/facturar` | `entidadEmisoraId` |

### Los defaults se DERIVAN, y no se guardan

Una sola entidad con `ARRENDAMIENTOS` viene preseleccionada en el contrato; una
sola con `VENTAS`, en el comprobante. **Con dos, NINGUNA.** Se **reutiliza**
`emisorPorOmision` (`lib/cuestionario-entidades.ts`) en vez de reescribir la
regla: dos copias divergen, y divergir ahí es un comprobante a nombre de la
sociedad equivocada. **Ninguna columna de configuración nueva.**

Y **lo guardado manda sobre la omisión**. Si el documento ya tiene entidad, ésa
se pinta, aunque esté dada de baja: el formulario guarda lo que tiene en
pantalla, así que sobrescribir al abrir **borraría una decisión sin avisar**.

### «Sin asignar» se pinta, no se esconde

Las filas anteriores al 17/09 están así y **no se sabe de quién son**. Se pinta
en la ficha del contrato («La paga») y bajo el folio fiscal de cada factura
(«Emite»). Un id que el store todavía no hidrató dice **«Razon social no
disponible»** y *no* «sin asignar»: eso sería afirmar algo falso del documento.

### El selector ofrece TODAS las activas, no solo las del papel

El papel decide la **sugerencia**, no lo que está permitido. Filtrar obligaría a
cambiar los roles para poder asignar, que es otra cosa y con otras consecuencias.
La que el documento **ya tiene** se ofrece aunque esté de baja, o el selector
pintaría «sin asignar» sobre un documento que sí la tiene y el primer guardado la
borraría.

### NI UN IMPORTE

> [!danger] R4 · emitir es dinero irreversible
> `subtotal`, `igv` y `monto` se siguen derivando en el servidor del presupuesto
> de la campaña y de la tasa del cliente. `entidadEmisoraId` **solo viaja al
> INSERT** y no participa en ningún cálculo.
>
> Y el schema de facturar gana **`.strict()`**, que es un endurecimiento
> deliberado: antes un campo desconocido —un `monto` colado en el cuerpo— se
> **ignoraba en silencio** y quien lo mandara creería que se aplicó. Ahora es un
> **400**. Hay cinco casos que lo fijan
> (`finanzas-controller.entidad-emisora.test.ts` §3).

### `undefined` no toca, `null` desasigna

Sin esa distinción, **editar el importe de la renta borraría la razón social que
la paga, en silencio**. Hay una e2e que lo fija
(`entidad-en-documentos.e2e.test.ts`, «editar OTRA cosa no borra la entidad»).

---

## 4 · Tres huecos que SOLO se vieron abriendo la pantalla

Ninguno se veía leyendo el código, y los tres dejaban la función a medias.

1. **El selector del contrato vivía solo dentro de «Completar información»**, y
   ese formulario **solo aparece si el contrato está INCOMPLETO**. Un contrato
   VIGENTE —la inmensa mayoría— **no tenía ninguna forma** de asignar su razón
   social. Se añadió un «Cambiar» junto a «La paga», con un modal de un solo
   campo.
2. **El diálogo de «Generar factura» montaba con la página** —vive fuera del
   `&&` y solo devuelve `null` sin campaña—, así que su estado inicial se
   calculaba **antes de que el store hidratara**: `entidades` llegaba vacío y la
   emisora salía «sin asignar» **aunque hubiera una sola que vende**. El selector
   marcaba la recomendada en la lista y **no la preseleccionaba**. Arreglado con
   `key` por campaña, que fuerza el remontaje. *Recalcular en cada render era la
   alternativa mala: sobrescribiría lo elegido a mano.*
3. **«Emite:» solo se pintaba en la fila AGRUPADA**, y una factura de cuota
   única —el caso normal— **no se agrupa**.

> [!tip] La lección, y ya van varias en este repo
> Los tres pasaron typecheck, 1542 unitarias y 409 e2e. **Lo que los encontró fue
> abrir la aplicación y mirarla.**

---

## 5 · La lógica va FUERA de los `.tsx`

`vitest.config.ts` **no monta jsdom** y lo dice en su propia cabecera: un `.tsx`
no se puede probar en este repositorio, y **una decisión escrita dentro de una
pantalla no la prueba nadie**. Aquí las decisiones son de identidad fiscal, y
equivocarse **no da error**: da rentas pagadas y comprobantes emitidos a nombre
de quien no era. Mismo molde que `components/demo/reportes/*.ts`.

| Módulo puro | Qué decide |
|---|---|
| `components/demo/razones-sociales/gestion.ts` | Qué impide guardar, el orden del listado, los papeles huérfanos y los compartidos |
| `components/demo/razones-sociales/asignacion.ts` | La preselección, las opciones del selector y el texto de «sin asignar» |

El duplicado se busca por **`claveRazonSocial`**, la **misma** función del
cuestionario —una copia aquí divergiría de la que agrupa en el alta, y entonces
lo que allí es una sola sociedad aquí serían dos—. Ignora mayúsculas, acentos,
puntos y comas: **«ACME, S.A. de C.V.» y «Acme SA de CV» son la misma empresa
tecleada dos veces**, y el duplicado se rechaza **también contra una dada de
baja**.

---

## 6 · Lo que está probado, y a qué nivel

| Nivel | Archivo | Casos | Qué demuestra |
|---|---|---|---|
| Unitaria | `razones-sociales/gestion.test.ts` | 18 | El duplicado, el RFC, el rol fuera del catálogo, los huérfanos |
| Unitaria | `razones-sociales/asignacion.test.ts` | 19 | Las dos reglas negativas: con dos no se propone; lo guardado manda |
| Unitaria | `arrendadores-repo.entidad-contrato.test.ts` | 7 | Se valida ANTES del UPDATE; `null` desasigna; `undefined` no toca |
| Unitaria | `finanzas-controller.entidad-emisora.test.ts` | 10 | El 404 de la ajena, y que NI UN IMPORTE entra por el cuerpo |
| Integración | `entidad-tenant-compuesto.e2e.test.ts` | 11 | El agujero de las FK, con el rol de la app |
| Integración | `entidad-en-documentos.e2e.test.ts` | 8 | La escritura POR HTTP, con guard y RLS de por medio |

> [!warning] No copies de aquí un recuento — mídelo
> Al **2026-09-18** en el worktree `ola4/multientidad`: **1542 unitarias en 126
> archivos** y **409 e2e en 38 archivos** (1 saltada), las dos en verde, con
> `typecheck` limpio. Caduca al siguiente commit, y **cada worktree da un
> recuento distinto**: mídelo donde vayas a trabajar.
> `cd apps/web && npm run build && npm run test:e2e`.

---

## 7 · Lo que NO se hizo, y por qué

- **No se tocó ningún importe.** Ni `subtotal`, ni `igv`, ni `monto`, ni
  `monto_renta`. Verificado en la base después de asignar: la renta de Tlalpan
  G500 sigue en `28000.00`.
- **No se separó el guard del contrato.** Asignar la razón social que paga es un
  dato **fiscal**, no un importe, pero viaja por el mismo endpoint que el monto
  de la renta y **hereda su guard de cambio sensible**: pide volver a teclear la
  contraseña. Separarlo sería abrir **una ruta nueva de escritura sobre un
  contrato**, y eso es R4. Se deja constatado, no corregido.
- **No se añadió el selector al alta de contrato** (`ContratoWizard`,
  `POST /api/contratos`). Los contratos de este producto **nacen INCOMPLETO** por
  el sistema y se completan por el PATCH, que es el camino cableado. El alta
  directa queda para otra tarea.
- **No hay reasignación de la emisora de una factura ya emitida.** No existe
  `PATCH /api/facturas/[id]` y crearlo es abrir una ruta de escritura sobre un
  comprobante emitido — R4. Se asigna al emitir; lo anterior queda «sin asignar»
  y se pinta.
- **No se tocó** `docs/Registro_Cambios.md`, `vault/07-Agentes/tablero.md`,
  `vault/02-Backend/_indice.md`, `vault/04-Datos/esquema.md` ni
  `vault/04-Datos/migraciones.md`.

---

## Relacionadas

[[02-Backend/entidades-fiscales]] · [[02-Backend/cuestionario-bienvenida]] ·
[[02-Backend/arrendadores-y-contratos]] · [[02-Backend/finanzas-y-cobranza]] ·
[[02-Backend/multi-tenancy-y-rls]] · [[03-Frontend/shell-y-navegacion]] ·
[[06-Operacion/zonas-de-riesgo]] · [[06-Operacion/convenciones]] ·
[[04-Datos/esquema]] · [[04-Datos/migraciones]]

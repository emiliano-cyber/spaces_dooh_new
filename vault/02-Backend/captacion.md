---
tipo: contrato
estado: verificado
actualizado: 2026-09-29
tags: [backend, comercial, captacion, prospectos, bitacora, aprobacion, rls, concurrencia, permisos]
archivos:
  - db/migrations/20260930_captacion.sql
  - apps/web/lib/captacion.ts
  - apps/web/lib/server/captacion-repo.ts
  - apps/web/lib/server/captacion-controller.ts
  - apps/web/app/api/captacion/route.ts
  - apps/web/app/api/captacion/[id]/route.ts
  - apps/web/app/api/captacion/[id]/avances/route.ts
  - apps/web/app/api/captacion/[id]/decision/route.ts
  - apps/web/lib/data/captacion-api.ts
  - apps/web/components/demo/captacion/Captacion.tsx
  - apps/web/app/(app)/(shell)/captacion/page.tsx
  - apps/web/lib/test/captacion.e2e.test.ts
---

# Captación — la bitácora de cómo va cada venta (CAP-01)

> [!warning] 2026-09-30, tarde · OCULTA del menú
> Pedido del dueño: *«elimina captación por ahora u ocúltalo»*, a favor de
> [[03-Frontend/comercial-opex]], que es la forma que prefiere para la
> prospección. **Solo se quitó la entrada de `components/demo/shell/nav.ts`**
> (la línea queda comentada ahí, para restaurarla). Las tablas `prospectos` y
> `prospecto_avances`, la API `/api/captacion/*`, la pantalla `/captacion` y el
> módulo `captacion` de permisos **siguen**: volver es una línea, sin migración.
> Una prueba de `nav.test.ts` fija que no está en el menú.

> [!important] De dónde sale
> Pedido del dueño el **2026-09-29**, recorriendo el ensayo de g500 con un perfil
> de vendedor: *«falta la bitácora para ver el avance para crear nuevas pantallas
> o predios nuevos o arrendadores nuevos; debe tener el progreso de cómo va la
> venta»*. Al preguntarle qué se capta: *«se acepta todo eso»* —clientes
> también—, y *«sube toda la información y el gerente o el administrador ya lo
> aprueban»*. Fotos y documentos, **después** del 14/10.

## Qué había antes

Nada para el vendedor. Inventario y Arrendadores eran solo de MANDO
(`components/demo/shell/nav.ts`), **Actividad** es la bitácora de *auditoría*
—quién hizo qué—, y el único rastro de un proceso de venta era
`predios.estado` con `PROSPECTO` y `EN_NEGOCIACION`: una etiqueta sin historia,
sin nota, sin siguiente paso y sin quién.

## El modelo

| Tabla | Qué es |
|---|---|
| `prospectos` | Lo que se intenta captar: `CLIENTE` · `ARRENDADOR` · `PREDIO` · `PANTALLA`, con su etapa, su contacto, sus datos por tipo y su siguiente paso |
| `prospecto_avances` | La bitácora. **Solo se añade**: el rol de la aplicación tiene `select, insert` y nada más |

**Etapas:** `PROSPECTO → CONTACTADO → VISITA → NEGOCIACION → EN_REVISION →
APROBADO`, más `RECHAZADO` (vuelve al vendedor) y `PERDIDO` (final). Son `text` +
CHECK y **no enum**: un valor de enum no se quita nunca (zona A5), y una lista de
etapas de venta es lo primero que el negocio querrá retocar.

La regla de quién mueve qué vive UNA vez, en `apps/web/lib/captacion.ts`
(`motivoAvanceInvalido`, `motivoDecisionInvalida`, `faltantesParaRevision`). La
usa la pantalla para no ofrecer lo que el servidor negaría, y el servidor la
vuelve a aplicar **con la fila bloqueada**.

## Quién ve qué — por PERMISO, no por rol

Módulo propio, `captacion` (14 filas en `rol_permisos`). Lo decisivo es
`captacion.aprobar`:

- **Sin `aprobar`** (el VENDEDOR): ve y toca **solo lo suyo**. Un prospecto de
  otro contesta **404, no 403** — decir «existe pero no es tuyo» ya cuenta algo.
- **Con `aprobar`** (gerente, director, administrador, Dueño): ve a todo el
  equipo y decide.

Se decide por permiso y no por el nombre del rol para que la matriz de
Administración siga siendo la única que manda. Y es módulo propio y no
`comercial` porque con `comercial.aprobar` aprobar una propuesta y aprobar una
captación serían el mismo permiso.

**El vendedor no se aprueba solo, por tres lados:** la ruta de decisión pide
`aprobar` (403); un avance a `APROBADO` o `RECHAZADO` lo niega la regla (409); y
los esquemas son `.strict()`, así que `etapa`, `usuarioId`, `decididoPor` o
`registroId` en el cuerpo son un 400 y no un campo que se ignora.

La lista se filtra y se cuenta **en el servidor**: `?etapas=` recibe el grupo de
etapas de una pestaña y la respuesta trae `porEtapa`, un `group by` con los
mismos filtros de vendedor y tipo.

## Aprobar crea el registro real — en DOS pasos, y por qué

| Tipo | Al aprobar |
|---|---|
| CLIENTE | `crearCliente` |
| ARRENDADOR | `crearArrendador` |
| PREDIO | `crearPredio`; si no trae `arrendadorId`, el contacto es el dueño y se da de alta como arrendador antes |
| PANTALLA | Nada todavía: queda aprobada y la da de alta quien administra, desde Inventario (necesita medidas, tarifas y contrato) |

Las tres funciones son de **otros módulos** y abren su propia transacción, y
reescribir aquí su SQL duplicaría sus avisos de duplicado. Así que:

1. **`reclamarAprobacion`** pasa el prospecto a `APROBADO` con la fila bloqueada
   **y** con `and etapa='EN_REVISION'` en el `update`. Solo una petición gana.
2. Se crea el registro. **Si falla** —p. ej. «Ya existe un arrendador llamado…»—
   `devolverARevision` deshace el reclamo y el 409 llega entero a quien aprueba,
   que puede confirmar que es otro (`confirmaNombreRepetido`) y repetir.
3. **`fijarRegistro`** enlaza `registro_id` y escribe la línea «Aprobado» en la
   bitácora. No antes: la bitácora no se borra, así que no se escribe
   «aprobado» hasta que el registro existe.

> [!warning] Lo que NO es atómico, dicho con todas las letras
> - En un PREDIO sin `arrendadorId`, si el arrendador se crea y el predio falla,
>   el arrendador se queda. El prospecto vuelve a revisión; al repetir, el aviso
>   de nombre repetido lo enseña.
> - Si `fijarRegistro` falla DESPUÉS de crear el registro, el prospecto queda
>   `APROBADO` sin enlace ni línea de bitácora; reintentar da 409. El registro
>   existe. Es visible —sale aprobado sin «ya existe en el sistema»—, no
>   silencioso.

## Lo que se midió, no se supuso

- La migración aplica en **PostgreSQL 16** (copia de g500 del 29/09, dos
  corridas: 1 aplicada, luego 0) y en **PostgreSQL 14.24** (el motor de g500).
  Sin `@pg-min`.
- `apps/web/lib/test/captacion.e2e.test.ts`: **33 pruebas**, sobre todo de lo que
  se **impide**. Corridas contra una base propia (`spaces_capt_e2e`, puerto 3431)
  para no pisar a otra sesión.
- **Mutantes, con un build por mutante** (la regla de `CLAUDE.md`): quitar el
  filtro de «lo suyo» → caen 3; quitar el `revoke` de la bitácora → cae 1; que
  aprobar pida `crear` → caen 3; quitar el `for update` **y** la condición de
  etapa → la carrera cae **5 de 5**.

> [!danger] La primera prueba de la carrera NO mordía
> Usaba un ARRENDADOR nuevo y seguía en verde **sin el bloqueo**: la segunda
> aprobación chocaba con el aviso de nombre repetido, no con el candado. Ahora
> usa un PREDIO ligado a un arrendador existente —sin red de duplicados— y
> **seis** aprobaciones a la vez: con dos, el defecto se escapaba en 2 de cada 3
> corridas.

> [!warning] Dos defectos que salieron en la REVISIÓN del diff, no en las pruebas
> 1. **La pantalla filtraba las pestañas en el navegador** sobre una sola página
>    de 50: con más prospectos, «Por aprobar» podía salir vacía con uno
>    esperando. Ahora filtra y cuenta el servidor. Prueba 12.
> 2. **El filtro `?tipo=` nació roto**: una edición hecha por el shell se comió el
>    signo de dólar del placeholder (`p.tipo = 2` en vez de `p.tipo = $2`), y
>    ninguna prueba lo pedía. Daba 500. Prueba 13.

## Lo que queda para después del 14/10

Fotos y documentos adjuntos · convertir una PANTALLA aprobada en sitio ·
tablero tipo kanban · recordatorios del siguiente paso · reporte del embudo por
vendedor · equipos (gerente → sus vendedores; hoy el gerente ve a toda la
organización).

Ver también [[02-Backend/roles-de-venta]] · [[02-Backend/arrendadores-y-contratos]]
· [[02-Backend/comercial-propuestas-campanas]] · [[04-Datos/esquema]].

---
tipo: modulo
estado: verificado
actualizado: 2026-11-20
tags: [backend, operaciones, ot, imprenta, amarillo, almacen, checklist]
archivos:
  - apps/web/lib/server/ot-repo.ts
  - apps/web/lib/server/ot-controller.ts
  - apps/web/lib/server/impresion-repo.ts
  - apps/web/lib/pendientes-creativo.ts
  - apps/web/lib/server/pendientes-creativo-repo.ts
  - apps/web/lib/server/pendientes-creativo-controller.ts
  - apps/web/lib/album-evidencias.ts
  - apps/web/components/operaciones/PendientesCreativo.tsx
  - apps/web/components/demo/campanas/DescargarAlbum.tsx
  - db/migrations/20261120_impresion_fecha_especial.sql
  - db/migrations/20261120_z_creatividades_origen.sql
  - apps/web/lib/origen-creativo.ts
  - apps/web/lib/server/operaciones-eventos.ts
  - apps/web/lib/server/almacen-repo.ts
  - apps/web/lib/server/almacen-controller.ts
  - apps/web/lib/almacen-tipos.ts
  - apps/web/app/(app)/(shell)/almacen/page.tsx
  - apps/web/lib/tipos-ot.ts
  - apps/web/lib/costos-ot.ts
  - apps/web/lib/costos-ot-payload.ts
  - apps/web/app/(app)/(shell)/administracion/page.tsx
  - db/migrations/20260917_costos_ot_por_tipo.sql
  - db/migrations/20260929_costo_real_ot.sql
  - apps/web/app/api/ot/[id]/checklist/route.ts
  - apps/web/lib/checklist-autoguardado.ts
  - apps/web/components/operaciones/OTVista.tsx
  - apps/web/app/(app)/(shell)/operaciones/page.tsx
  - apps/web/app/(app)/(shell)/imprenta/page.tsx
  - apps/web/lib/prioridad-imprenta.ts
  - apps/web/lib/proporcion-pantalla.ts
  - apps/web/components/operaciones/ArteEnSitio.tsx
  - apps/web/components/operaciones/ValoracionArte.tsx
  - apps/web/lib/valoracion-arte.ts
  - apps/web/lib/arte-impresion.ts
  - apps/web/lib/requisitos-impresion.ts
  - apps/web/lib/server/imprentas-repo.ts
  - apps/web/lib/server/imprentas-controller.ts
  - apps/web/app/api/imprentas/route.ts
  - apps/web/app/api/imprentas/[id]/route.ts
  - apps/web/app/api/impresion/[id]/imprenta/route.ts
  - apps/web/components/operaciones/Imprentas.tsx
  - db/migrations/20261118_imprentas_y_requisitos.sql
  - apps/web/components/demo/campanas/AgregarCreativo.tsx
  - infra/nginx/instancia.conf.tpl
  - apps/web/app/api/creativos/[id]/arte/route.ts
  - apps/web/lib/server/creativos-repo.ts
  - apps/web/lib/data/derive.ts
  - apps/web/lib/server/storage.ts
---

# Operaciones, OT e imprenta

## Órdenes de trabajo

Una **OT** es una tarea de campo: montaje de lona, montaje digital, desmontaje,
mantenimiento, herrería, eléctrico, inspección (`tipo_ot`, `db/schema.sql:53`).

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `ot-repo.ts` | 377 | OT + evidencias, cierre, checklist punto a punto, costo real, notificaciones |
| `ot-controller.ts` | 99 | Validación (alta, costo, punto del checklist) |
| `impresion-repo.ts` | 196 | Órdenes de impresión (con fecha, medida y arte de su campaña) y OC |
| `operaciones-eventos.ts` | 86 | OT automáticas desde Arrendadores |
| `almacen-repo.ts` | 141 | Activos y traslados; filtro por tipo |
| `almacen-controller.ts` | 100 | Validación zod del alta y del `?tipo=` (desde el 30/09) |

> [!warning] No existe forma de reasignar una OT ya creada
> Las rutas son `GET·POST /api/ot`, `GET /api/ot/[id]`,
> `POST /api/ot/[id]/cerrar`, —desde el **2026-09-29**—
> `PATCH /api/ot/[id]/costo` ([[02-Backend/costo-real-de-ot]]) y —desde el
> **2026-09-30**— `PATCH /api/ot/[id]/checklist` (ver abajo).
>
> **Esos `PATCH` son de un solo campo cada uno**, y no abren la puerta a editar
> lo demás: el de costo lleva el candado de dinero y el del checklist solo
> cambia `checklist[i].hecho`. Ninguno es un editor general de la OT. `asignado_a` sigue sin poder cambiarse. Se escribe en dos momentos: al **crear**
> la OT (`crearOTCtrl`, campo `asignadoA`) y al **cerrarla**, donde
> `ot-repo.ts:301` (dentro de `cerrarOT`, `:278`) hace `asignado_a = coalesce(asignado_a, $3)` para estampar a
> quien cierra. Cambiar el responsable de una OT existente exige un script de
> datos — o un endpoint nuevo.
>
> **Desde el 08/10 (v0.11.2) el responsable SE VE.** Hasta entonces todas las
> OT decían «Sin asignar» aunque la base lo tuviera: la pantalla buscaba el
> nombre en una lista que `/api/estado` nunca mandaba. Ahora `/api/estado` trae
> `usuarios` con `listarNombresDeUsuarios()` (`usuarios-repo.ts`): mínima a
> propósito —id, nombre, rol y activo, sin correo—, porque la ve cualquiera con
> permiso de Operaciones, e incluye a los inactivos para que una OT vieja
> conserve su nombre. Y **la OT nueva nace con la fecha de hoy** en la hora del
> navegador (`fechaLocalISO()`, `lib/fecha-local.ts`): `toISOString()` daba el
> día en UTC, que en México a partir de las 18:00 ya es mañana. Prueba:
> `lib/test/ot-responsable.e2e.test.ts`.

## El checklist se guarda punto a punto (OT-CHECK-01, 2026-09-30)

**Antes del 30/09** el checklist (`ordenes_trabajo.checklist`, `jsonb` de
`{label, hecho}`, `db/schema.sql:481`) **solo se escribía dos veces**: al crear
la OT (`crearOT`) y al cerrarla, cuando `cerrarOT` lo ponía **todo** en
`hecho: true`. Lo que la cuadrilla tachaba vivía en un `useState` de
`OTVista.tsx` (`setChecks` en el `onClick`) y **se perdía al recargar** o al
cerrar la pestaña. Pedido del dueño: «que se guarde cada vez que se tacha algo».

**Hoy**, cada clic manda `PATCH /api/ot/[id]/checklist` con
`{ indice, label, hecho }` → `marcarPuntoChecklistCtrl` (zod estricto,
`ot-controller.ts:96`) → `marcarPuntoChecklist` (`ot-repo.ts:169`). Sin
migración: la columna ya existía.

| Decisión | Por qué |
|---|---|
| **Un punto por petición, no el checklist entero** | Con el estado completo, dos clics casi simultáneos llegan cada uno con su foto y el segundo deshace el primero. Un punto es idempotente |
| **Un solo `update … jsonb_set(checklist, …)`**, sin `select` previo | El `update` bloquea la fila y cambia solo `checklist[i].hecho`: no hay carrera de «leer, cambiar, escribir». La e2e lanza dos marcas a la vez y comprueba que sobreviven las dos |
| **`and tenant_id = $2`** además de la RLS | Convención; guard de fuente en `ot-repo.checklist-aislamiento.test.ts` |
| **El `label` tiene que cuadrar** con el del punto guardado | Un índice viejo no tacha otra tarea si el checklist cambió → **409** |
| **OT `COMPLETADA`/`CANCELADA` → 409** | El cierre ya la dejó toda en hecho |
| **No toca `estatus`, fechas, `asignado_a` ni `costo_real`** | Tachar el último punto **no cierra la OT**: el cierre sigue exigiendo foto + ubicación en `cerrarOT`, que es lo que destraba la facturación. Guard de fuente + e2e |
| **Permiso `operaciones.crear`**, el mismo que cerrar | FINANZAS e IMPRENTA tienen `ver` y no marcan (403). `GET /api/ot/[id]` devuelve `puedeEditar` con ese mismo permiso para pintarlo de solo lectura — va en la respuesta y no en `usePuede` porque `/m/ot/[id]` vive fuera del shell y no tiene `SesionProvider` |
| **Sin candado de cambios ni bitácora por clic** | No es dinero; y una fila de `acciones` por casilla sería ruido. El cierre sigue registrándose |

**En la pantalla**, los clics no van directo a `fetch`: pasan por la cola de
`lib/checklist-autoguardado.ts`, que manda **una petición a la vez**, fusiona
los clics repetidos sobre el mismo punto y, si una falla, **se para y conserva
el cambio** (probado en `checklist-autoguardado.test.ts`). `OTVista` muestra
«Guardando… / Guardado», un aviso rojo con **Reintentar** si falla, avisa con
`beforeunload` mientras hay algo sin confirmar, y deshabilita «Cerrar OT»
mientras un punto viaja. Al recargar, lo que la cola no ha confirmado se
superpone a lo que trae el servidor, para no repintar un punto con su valor
viejo.

> [!warning] Lo que NO se verificó
> El recorrido en navegador (clics reales, pérdida de red, `beforeunload`) no
> se ha hecho: `vitest.config.ts` no monta jsdom y el `.tsx` no tiene prueba.
> La lógica de la cola y la ruta sí están cubiertas.

## El cierre de OT es lo que destraba la facturación

`ot-repo.ts:10-14` (cabecera del archivo): cerrar una OT con foto guarda la evidencia, completa la OT
y, **si está ligada a una campaña, enciende `fotos_comprobatorias` y
`reporte_publicacion`** — dos de los tres candados de [[finanzas-y-cobranza]].

> [!warning] Tocar el cierre de OT toca la facturación
> No es un módulo aislado: es el disparador del dinero.

## Evidencias

`evidencias_ot` guarda foto (base64 legado **o** key en DigitalOcean Spaces),
GPS (`lat`, `lng`, `precision_m`), y **dos fechas distintas**:

| Columna | Significado |
|---|---|
| `tomada_en` | Cuándo se hizo la foto (EXIF del archivo) |
| `timestamp` | Cuándo se subió |

La distinción importa: probar que la lona se instaló **el día que se cobró**
depende de `tomada_en`, no de cuándo alguien subió el archivo.

El almacenamiento es condicional: si `storageHabilitado()` (todas las
`DO_SPACES_*` presentes) va a S3 con URL firmada; si no, cae al data URL en base
de datos (`lib/server/storage.ts:18`). Ver [[integraciones-externas]].

## Imprenta

`ordenes_impresion`, proceso lineal:

```
ARTE_RECIBIDO → VALIDADO → EN_PRODUCCION → IMPRESO → LISTO_MONTAJE
```

Con **prueba de color** aprobable (`prueba_color_url`,
`prueba_color_aprobada`). Folio consecutivo `OI-2026-0001`
(`impresion-repo.ts:15-17`, `folioDocumento('oi')`).

### El arte y la prioridad (IMP-CREA / IMP-PRIO, 2026-11-17)

Pedido del dueño: «que en imprenta se vean los creativos, cómo se verían en las
proporciones de cada pantalla, y un mapeado de prioridad de cuáles son las más
próximas y cuáles las últimas». Sin migración ni rutas nuevas.

| Qué | Dónde | Por qué así |
|---|---|---|
| **Una campaña FIJA (OOH) ya recibe creativo** | `creativos-repo.ts` (`crearCreatividad`) | Decisión del dueño (17/11). Antes se rechazaba con «su producción es por imprenta» y la imprenta no tenía dónde ver el arte. Aprobarlo no lo mete en ninguna rotación: `autoasignarRotacion` solo toca reservas de pantallas digitales |
| **La pantalla de Creativos sigue sin campañas fijas** | `lib/creativos-digitales.ts`, sin tocar | Pedido del 30/09. El arte de una fija se **sube y se aprueba desde Imprenta** (botón «Subir arte» y el diálogo del arte) |
| **`GET /api/impresion` trae fecha, medida y arte** | `listarOrdenesImpresion` | `campanaInicio`/`campanaFin` (como texto: `::text`, para que la fecha no se corra un día en UTC-6), `tipoCampana`, `sitioNombre`/`sitioAncho`/`sitioAlto` y `creativos` (sin retirados, sin la fuente: el arte va por `/api/creativos/<id>/arte/`). Antes la pantalla los sacaba de `/api/estado`, que solo los manda a quien tiene **Comercial**: un rol IMPRENTA se quedaba sin fecha y sin arte |
| **IMPRENTA ve el arte, pero solo el que imprime** | `app/api/creativos/[id]/arte/route.ts` + `creativoTieneOrdenImpresion` | Sin `comercial.ver` pero con `imprenta.ver`, se sirve el arte **solo si su campaña tiene orden de impresión**. El de una campaña sin orden sigue en 403. Subir y aprobar arte sigue exigiendo `comercial.crear` |
| **La cola de prioridad** | `lib/prioridad-imprenta.ts` (puro, con pruebas) | Por **fecha de inicio de la campaña**, no de alta de la orden. Grupos: Atrasadas (ya arrancó y no está lista) · Esta semana (≤ 7 días) · Próximos 30 días · Más adelante · Sin fecha · Listas para montaje (al final, sin lugar en la cola). `hoy` es el día LOCAL (`diaLocal`), no el de UTC |
| **El arte en la proporción del sitio** | `lib/proporcion-pantalla.ts` + `components/operaciones/ArteEnSitio.tsx` | Manda la medida de la orden; si es 0 × 0, la del sitio; si no hay ninguna, marco punteado y sin cálculo. Se pinta **a sangre** (`object-cover`, como sale la lona) y en el diálogo también «Sin recortar» (`contain`). Cuánto se pierde se dice en texto («Se recorta 23 % por los costados»), con tolerancia del 3 % |

Pruebas: `lib/prioridad-imprenta.test.ts`, `lib/proporcion-pantalla.test.ts` y
`lib/test/imprenta-arte.e2e.test.ts` (8 casos contra Postgres y Next reales,
incluido el 403 de IMPRENTA sobre arte sin orden y el 404 entre
organizaciones). Mutantes medidos con build: volver a bloquear OOH y quitar la
condición de la orden → 6 de 8 en rojo.

> [!warning] Lo que NO se verificó
> La pantalla en un navegador real (Chrome) a la hora de cerrar este cambio:
> ver el diario del 17/11.

### La valoración del arte para la lona (IMP-VAL, 2026-11-18)

Pedido del dueño: «en la pantalla de Imprenta debemos tener cambios a la hora de
la valoración del arte a subir, ya que se debe dejar en claro y mostrar el
ejemplo de cómo se vería el arte en el tamaño de la lona». Sin migración, sin
rutas nuevas y sin tocar el servidor: las dimensiones del archivo se leen en el
navegador (`createImageBitmap`, y si no hay, `Image`).

| Qué | Dónde | Por qué así |
|---|---|---|
| **Elegir el archivo ya no lo sube** | `imprenta/page.tsx` (`onArchivo` → `ConfirmarArteDialog` → `subirArte`) | Antes «Subir arte» mandaba el archivo en cuanto se elegía. Ahora se lee (data URL y píxeles) y se abre «Revisa el arte antes de subirlo» con la lona y la valoración. Rojo **no** impide subir —el botón pasa a «Subir de todos modos»—; lo único que lo apaga es el peso, porque el servidor lo rechazaría. Quién sube (`comercial.crear`) y el flujo de estatus no cambian |
| **El arte ya subido se revisa igual** | `VerArteDialog` → `RevisionArte` | El diálogo de aprobar mide la imagen servida por `/arte/` y enseña la misma lona y la misma valoración (sin formato ni peso: el archivo original ya no existe, se guardó envuelto en HTML). Un creativo en código no se puede medir: se pinta con `ArteEnSitio` y se dice |
| **La lona a escala** | `components/operaciones/ValoracionArte.tsx` (`LonaAEscala`) | SVG cuyo `viewBox` es la lona **en metros**: cotas de ancho y alto en el idioma de quien lee, el margen de seguridad punteado y una persona de 1,70 m de pie al borde de abajo, todo a escala real. «A sangre»: lo que sobra se ve atenuado y rayado FUERA de la lona (se pierde; acotado a media lona por lado para que la lona no se vuelva una raya). «Sin recortar»: el arte entero y las franjas en blanco rayadas. **No hay modo «estirar»**: la convención de IMP-CREA es que la imprenta no deforma |
| **La valoración** | `lib/valoracion-arte.ts` (puro) | Semáforo general = el peor de cuatro criterios. **Proporción**: ≤ 3 % de recorte verde (`TOLERANCIA_AJUSTE`), ≤ 15 % ámbar con los cm que se pierden por lado, más rojo con la proporción en que pedirlo. **Resolución efectiva a tamaño real**: px ÷ m a sangre (manda el lado que más se estira) → DPI. **Formato**: PNG/JPG/WebP verde, otro ámbar. **Peso**: hasta `IMAGEN_CREATIVO_MAX_MB` verde, más rojo |

> [!important] Umbrales ORIENTATIVOS, decididos aquí (no había convención)
> - **Margen de seguridad**: 5 cm por lado (`MARGEN_SEGURIDAD_M`). Se rotula
>   como orientativo: cada imprenta tiene el suyo.
> - **Gran formato** (un lado ≥ 6 m, se ve de lejos): verde ≥ **10 DPI**, ámbar
>   ≥ 5. La guía de exterior es «72 dpi al 10 %» ≈ 7 DPI a tamaño real. Se
>   eligió 10 y no 20–30 porque el tope de subida es de **4 MB**: 20 DPI en
>   12,9 m son ~10 200 px de ancho, que no caben, y un semáforo que nunca da
>   verde enseña a no mirarlo.
> - **Lona cercana** (< 6 m, se ve a pocos metros): verde ≥ **30 DPI**, ámbar ≥ 15.
>
> Si el dueño o la imprenta dan otras cifras, se cambian en `UMBRALES_DPI`,
> `LADO_GRAN_FORMATO_M` y `MARGEN_SEGURIDAD_M`; las pruebas leen las constantes.

Pruebas: `lib/valoracion-arte.test.ts` (21, en rojo primero: el módulo no
existía) y `components/operaciones/ValoracionArte.test.ts` (6, rinde la revisión
con `renderToStaticMarkup` y lee los textos). Dos mutantes, uno en cada archivo
(invertir costados/arriba-abajo; la fórmula del recorte), muertos. Textos en
es/en/it/pt (`operaciones.imprenta.valoracion.*`).

#### Respuestas del dueño (18/11, misma tarde)

- **El arte de la ficha también pasa por la revisión.** `AgregarCreativo`
  (ficha de campaña) abre la misma lona y la misma valoración al elegir una
  imagen, contra los sitios FIJOS de la campaña con medida
  (`lonasDeCampana`, `lib/arte-impresion.ts`; manda la medida de la orden de
  impresión del sitio si la hay) y con un selector si hay varias. En una OOH
  no se pinta la vista del player (no va a pantalla); en una híbrida, las dos.
  No se tocó `campanas/[id]/page.tsx`: el componente lee sus propios hooks.
- **Tope del arte de impresión: 15 MB, solo campañas OOH** (`topeArteMb`).
  Híbridas y digitales siguen en 4 MB (comparten el arte con sus pantallas).
  Por encima de 4 MB la imagen viaja SOLA en `archivoUrl` (`cuerpoArte`), no
  envuelta: el servidor ya aceptaba 15 MB por esa vía
  (`LIMITES.creatividadImagen`, tipo real por magic bytes), así que **no se
  abrió ningún endpoint ni se tocó `creativos-controller.ts`**. `/arte/` y
  DOOHmain ya leían ese caso.
  - **Por qué 15 y no 25**: el arte vive como data URL en la base. 15 MB son
    ~20 MB por fila (y por respaldo). 25 MB serían ~33 MB solos, y envueltos
    —la envoltura guarda la imagen dos veces— ~67 MB por fila y ~250 MB de
    memoria de Node por subida. Hoy el máximo era ~10,7 MB por fila.
  - Ojo: `crearCreatividad` responde con `returning *` y devuelve el data URL
    entero; con 15 MB son ~20 MB de vuelta. Funciona, pero conviene recortarlo.
  - **nginx (R6)**: las plantillas cortan a 12M por servidor. Cada `location /`
    que hace proxy en `instancia.conf.tpl`, `demo.space-os.io.conf`,
    `padre-ip.conf` y los cuatro bloques de `space-os.io.conf` lleva ahora una
    `location ~ ^/spaces-dooh/api/creatividades/?$` anidada con
    `client_max_body_size 22M` (hereda cabeceras y tiempos; repite
    `proxy_pass`). Prueba: `lib/arte-impresion.test.ts`. **No se aplicó en
    ningún servidor.** En cada uno, una persona: copia el archivo que le toca
    a `/etc/nginx/sites-available/`, `sudo nginx -t` y, si sale bien,
    `sudo systemctl reload nginx`. En una instancia, regenerar su conf desde
    `instancia.conf.tpl` con su dominio (el mismo paso de aprovisionamiento).
    Hasta que se haga, un arte de más de ~9 MB recibe 413 de nginx.
- **Umbrales configurables (por imprenta)**: pedían migración y el dueño
  eligió la **opción B** (R3 aprobado). Hecho en IMP-REQ, ver la sección
  siguiente. Las constantes de `lib/valoracion-arte.ts` quedan como respaldo.
- **Un arte en rojo solo avisa**, como estaba.

> [!warning] Lo que NO se verificó
> El navegador (lo prueba el orquestador en Chrome), `nginx -t` (no hay nginx
> en esta máquina) ni una subida real de 15 MB contra el servidor.

### Imprentas y sus requisitos de arte (IMP-REQ, 2026-11-18/19)

Decisión del dueño: «la imprenta usada es de terceros por ahora y, como se
vende el proyecto, la imprenta puede ser de cualquiera». Así que los umbrales de
IMP-VAL dejan de ser fijos: **cada imprenta tiene los suyos, la empresa tiene
unos por omisión y, si nadie dice nada, mandan las constantes de siempre**. Un
arte en rojo **sigue solo avisando**; el tope del arte OOH sigue en **15 MB**.

| Qué | Dónde | Por qué así |
|---|---|---|
| **Migración (R3 + R2, aprobada)** | `db/migrations/20261118_imprentas_y_requisitos.sql` | Solo agrega: `config_negocio.requisitos_impresion jsonb` (`{}` = sin configurar), la tabla `imprentas` (RLS fail-closed + FORCE, nombre único por organización sin distinguir mayúsculas ni espacios) y `ordenes_impresion.imprenta_id` opcional. `proveedor` (texto) **se queda**: las órdenes de antes lo usan. La orden apunta con **FK compuesta** `(imprenta_id, tenant_id)` porque los chequeos de FK saltan la RLS. `on delete restrict` (y no `set null`, que con FK compuesta anularía `tenant_id`; `set null (col)` es PG 15 y g500 corre 14): la baja es **lógica** (`activo = false`) y el rol de la app no tiene DELETE |
| **La regla** | `lib/requisitos-impresion.ts` (puro) | `resolverRequisitos(imprenta, empresa)`: imprenta > empresa > `REQUISITOS_RESPALDO`, **campo por campo**. `sanearRequisitos` al leer y al escribir (como `costos_ot`): un valor inválido cae al siguiente nivel, **nunca a 0** (0 DPI daría todo por bueno). Un ámbar por encima de su verde se descarta. Campos: DPI verde/ámbar de gran formato y de lona cercana, corte de gran formato (m), margen (cm) y formatos aceptados |
| **La valoración** | `lib/valoracion-arte.ts` | `valorarArte(…, req)` y `valorarResolucion(…, req)` reciben los requisitos (por omisión, las constantes). Con lista de **formatos**, uno fuera de ella es rojo («esa imprenta no lo recibe»); sin lista, como antes. **Desde el 19/11** el rojo tiene su propio texto en `PanelValoracion` (`…valoracion.formato.rojo`: «Formato PNG: esta imprenta no lo recibe (acepta PDF, TIFF)»); antes caía en el del ámbar y el punto rojo decía «revísalo con la imprenta» |
| **Rutas** | `GET·POST /api/imprentas`, `PATCH /api/imprentas/[id]`, `PATCH /api/impresion/[id]/imprenta` | Capas `route.ts` → `imprentas-controller.ts` (zod `.strict()` con los mismos rangos que el saneo) → `imprentas-repo.ts` (`q` con `and tenant_id = $n`). Permisos **existentes**: ver con `imprenta.ver`, alta/edición/asignar con `imprenta.crear`. Asignar una imprenta ajena o dada de baja → 400; un id que no es uuid → 404 sin tocar la base. Los de la empresa van por `PATCH /api/config { requisitosImpresion }` (`administracion.crear`) |
| **La orden** | `impresion-repo.ts` | El alta acepta `imprentaId`; el listado trae `imprentaNombre` e `imprentaRequisitos` (saneados) con un `left join` por `tenant_id` |
| **Pantalla** | `components/operaciones/Imprentas.tsx` en `/imprenta` | Tarjeta «Imprentas»: los requisitos de la empresa y la lista de imprentas con alta, edición y baja. Cada orden tiene su selector de imprenta, y el diálogo de arte dice «Valorado con los requisitos de …». La ficha de campaña (`AgregarCreativo` → `lonasDeCampana`) valora la lona con los de la imprenta de la orden de ese sitio |

Pruebas: `lib/requisitos-impresion.test.ts` (unitarias de saneo y resolución),
`lib/arte-impresion.test.ts` (la lona trae los requisitos de su orden) y
`lib/test/imprentas.e2e.test.ts` contra Postgres y Next reales: CRUD con y sin
permiso, nombre único por organización, **aislamiento** por la API y con el rol
de la app directo (sin tenant cero filas, no inserta en otra, no borra), la FK
compuesta rechazando la imprenta ajena, y `PATCH /api/config` con basura → 400.
Textos en es/en/it/pt (`operaciones.imprenta.imprentas.*`, errores en
`errores-servidor.ts`).

> [!warning] Lo que NO se verificó
> El navegador (queda para el recorrido en Chrome) ni la migración contra una
> base con historia de producción.

### Del creativo aprobado a la cola: la «tarea 1», la fecha especial y el álbum (FLUJO-CREA, 2026-11-20)

Pedido del dueño: «se cierra venta → se recibe el creativo → tarea 1: se manda a
impresión o se programa → impresión va a la cola con prioridad → comprobante de
exhibición, se descarga álbum».

| Qué | Dónde | Por qué así |
|---|---|---|
| **El pendiente se DERIVA, sin tabla de tareas** | `lib/pendientes-creativo.ts` (puro, con pruebas) + `lib/server/pendientes-creativo-repo.ts` (lee con `q` y `tenant_id = $1` en cada tabla) | IMPRIMIR = campaña OOH/HÍBRIDA en CONFIRMADA/ACTIVA, con creativo VALIDADA no retirado, y un sitio **fijo** reservado (reserva no cancelada) **sin** orden de impresión de esa campaña y ese sitio. PROGRAMAR = campaña DOOH/HÍBRIDA viva, pantalla **digital** con un creativo aprobado asignado (`reservas.creativos`) y `campanas.enviada_dominio = false`. POR_APROBAR = envío del cliente PENDIENTE o creativo nuestro PENDIENTE. Una tabla de tareas habría que sincronizarla en cada alta, rechazo, reemplazo y baja |
| **Nada se crea solo** | — | «Mandar a impresión» es el mismo `POST /api/impresion` (`imprenta.crear`) con `sitioId` y, opcional, `fechaEspecial`; con la orden creada el pendiente se va. «Programar» lleva a la ficha (`/campanas/[id]#publicacion`), a «Enviar al dominio»: no se duplica esa lógica |
| **Quién subió el creativo** | `creatividades.origen` / `subido_por` / `subido_por_nombre` (`20261120_z_creatividades_origen.sql`, CREA-ORIGEN); se leen en `pendientes-creativo-repo.ts` | **Es un DATO desde el 20/11** (decisión del dueño: «aunque tengan el mismo nombre; lo que importa es el contenido»). Hasta entonces se DEDUCÍA de la bitácora («Aprobó creativo enviado por el cliente» con el mismo nombre ≤ 10 min tras el alta) y dos creativos llamados igual se confundían; la constante y la ventana se borraron. NULL = «Origen desconocido» (lo anterior), y viaja como `null`, no como INTERNO. Ver la sección CREA-ORIGEN abajo |
| **El sitio de la orden tiene que ser propio** | `impresion-controller.ts` (`sitioEsPropio`) | La FK `ordenes_impresion.sitio_id` es simple: sin la comprobación, una orden podía apuntar a la pantalla de otra organización. Ajeno → 400 «Sitio no encontrado» |
| **Aviso solo a Imprenta** | `avisarPendientesImpresion` (al aprobar en `PATCH /api/creatividades/[id]` y al aprobar un envío del cliente) + `tiposOcultosPara` en `notificaciones-repo.ts` | La bandeja es una por empresa. Sin columna nueva: el tipo `IMPRESION` es de `imprenta`, y quien no tiene `imprenta.ver` no lo recibe ni en `/api/estado` ni en `/api/notificaciones/nuevas`. Plantilla `notificaciones.impresion.por-mandar` en los cuatro idiomas |
| **La fecha especial** | `20261120_impresion_fecha_especial.sql`, `PATCH /api/impresion/[id]/fecha-especial`, `lib/prioridad-imprenta.ts` (`base: 'ESPECIAL' \| 'INICIO'`) | Si está puesta **manda** sobre el inicio de la campaña para el grupo y el lugar (puede adelantar o atrasar). Se lee como texto (`::text`) para que no se corra un día en UTC-6. Fecha que no existe → 400 «Fecha inválida»; id ajeno → 404 |
| **El álbum de evidencias** | `lib/album-evidencias.ts` + `components/demo/campanas/DescargarAlbum.tsx` (ficha y portal) | Reutiliza `crearZip`/`descargarBlob` de Space Eyes. Nombre «Sitio_YYYY-MM-DD.ext» (día local de la toma, si no de la subida); repetidos numerados por `nombresUnicos`. Las que no se leen (URL firmada caducada, `mock://`) se saltan y se cuentan |

Pruebas: `lib/pendientes-creativo.test.ts`, `lib/prioridad-imprenta.test.ts`
(fecha especial), `lib/album-evidencias.test.ts` y
`lib/test/flujo-creativo-impresion.e2e.test.ts` (14 casos contra Postgres y Next
reales: pendiente al aprobar el del cliente y el nuestro, la orden lo quita,
digital hasta enviar al dominio, 403 sin permiso, aislamiento entre
organizaciones, la fecha especial reordena, migración aplicada).

> [!warning] Lo que NO se verificó
> Las pantallas en un navegador real (Imprenta, Creativos, ficha y portal) al
> cerrar este cambio, ni el álbum con fotos guardadas en Spaces (URL firmada:
> depende del CORS del bucket; si falla, esas fotos se cuentan como no leídas).

### Quién subió cada creativo, como dato (CREA-ORIGEN, 2026-11-20)

Decisión del dueño (20/11): «Debemos poner quién subió cada creativo aunque
tengan el mismo nombre; lo que importa es el contenido». Sustituye a la
deducción por bitácora de FLUJO-CREA.

| Qué | Dónde | Por qué así |
|---|---|---|
| **Tres columnas en `creatividades`** | `db/migrations/20261120_z_creatividades_origen.sql` | `origen` (`CLIENTE` \| `INTERNO`, check `creatividades_origen_ck`, NULL = desconocido), `subido_por` (uuid del usuario) y `subido_por_nombre` (congelado). Sin backfill: el envío del cliente se borra al aprobarlo y la bitácora solo guarda el nombre, así que **nada** se sabe con certeza |
| **`subido_por` con FK simple, no compuesta** | misma migración | Los usuarios se borran de verdad (`borrarUsuario`). Una FK `(subido_por, tenant_id)` con `on delete set null` pondría a null también `tenant_id` y el borrado fallaría; `set null (columna)` es de PG 15 y se exige la 14. Queda `references usuarios(id) on delete set null`; el nombre congelado sobrevive. El tenant lo garantiza la aplicación: el id sale siempre de la sesión |
| **Lo fija el servidor, nunca el cuerpo** | `lib/origen-creativo.ts` (`origenInterno`, `origenCliente`, puro y con pruebas) → `crearCreatividadCtrl(body, origen)` → `crearCreatividad` | Alta interna (`POST /api/creatividades`: Creativos, ficha, «Actualizar campaña», Imprenta) → `origenInterno(g.usuario)`. Aprobar el envío del cliente (`aprobarEnvioCtrl`) → `origenCliente()`: quien aprueba **no** es quien lo subió. La liga no pide nombre, así que el nombre del cliente queda NULL |
| **Reemplazar el arte cambia el origen** | `PUT /api/creatividades/[id]` → `reemplazarCreatividad(id, arte, origenInterno(g.usuario))` | El contenido es otro: lo «subió» quien puso el arte nuevo |
| **Se devuelve en las lecturas** | `rowToCreatividad`, `listarCreatividades` (`/api/estado`), `pendientes-creativo-repo.ts` | `origen` y `subidoPorNombre`; `subido_por` (uuid) no viaja a la pantalla |
| **El texto** | `subidoPor()` en `lib/origen-creativo.ts` + `OrigenCreativoBadge` (`components/operaciones/PendientesCreativo.tsx`) | «Subido por: el cliente (Nombre)», «Subido por: el cliente», «Subido por: Ana López», o «Origen desconocido». Claves `creativos.origen.*` en es/en/it/pt (`lib/i18n/textos/operaciones2.ts`). En Creativos (tarjetas y pendientes), Imprenta («Por mandar a impresión») y la ficha de campaña |

Pruebas: `lib/origen-creativo.test.ts`, `lib/pendientes-creativo.test.ts` (el
origen viaja, NULL no se vuelve INTERNO, mismo nombre) y
`lib/test/creativo-origen.e2e.test.ts` (migración, alta interna con el usuario de
la sesión aunque el cuerpo diga otra cosa, envío aprobado → CLIENTE, mismo
nombre con orígenes distintos, reemplazo, NULL como desconocido, aislamiento).

## Cómo se ven las pantallas (rediseño del 26/10)

Solo presentación, con el lenguaje del Dashboard. Mismos datos, mismos
permisos, mismas acciones.

- **`/operaciones`**: cuatro indicadores sobre el aviso de SLA —abiertas,
  vencidas, por vencer y **sin asignar** (abiertas sin responsable)—. La lista
  dejó de ser tarjetas de ~170 px: una fila `divide-y` por OT, toda ella enlace
  a la misma URL con el mismo rastro, con tipo, `folio · sitio · campaña`,
  prioridad (solo ALTA o URGENTE), fecha compromiso, Vencida/Por vencer,
  estatus, responsable y evidencias. **Orden de presentación** (sobre la copia
  filtrada, no en el store): abiertas por fecha compromiso ascendente, luego
  cerradas de la más reciente a la más vieja; 25 a la vista y «Ver todas (N)».
  Los chips de filtro llevan su conteo. Vacío con `EmptyState` distinto con y
  sin filtro. `NuevaOTModal` no se tocó.
- **`/operaciones/ot/[id]`** (`OTVista`, SOLO la rama `embedded`): `h1` con la
  descripción y el folio en el subtítulo; una franja con tipo, prioridad,
  compromiso (+Vencida/Por vencer), responsable y la **campaña como enlace**
  (con `usePuede('comercial','ver')`); Checklist, Foto y Ubicación en tarjeta.
  Cerrada, en escritorio se ve el checklist cumplido y la fecha de cierre en vez
  de «Puedes cerrar esta ventana». **La vista móvil `/m/ot/[id]` no cambió.**
- **`/imprenta`**: cuatro indicadores (en proceso, prueba de color pendiente,
  en producción, listas para montaje) y una franja con el reparto por etapa. Cada
  orden es una fila con el progreso en una barra de un color y «Paso N de 5»
  (ya no el `Stepper` completo). El vacío trae «Nueva orden» si hay permiso.
  **Desde el 17/11** hay además una tarjeta «Prioridad de impresión» (franja
  por grupo de urgencia, cada grupo filtra la lista), la lista va agrupada y
  ordenada por esa prioridad con el lugar en la cola y «Arranca en N días», y
  bajo cada orden su arte en la proporción del sitio (ver arriba).
  **Desde el 18/11**, subir o abrir un arte enseña la lona a escala y la
  valoración para imprimir (IMP-VAL, ver arriba).

## OT automáticas

Ver [[arrendadores-y-contratos]]. Cancelar contrato → OT de retiro; alta de
pantalla fija → OT de montaje. Nacen `PENDIENTE` con nota de origen y son a
mejor esfuerzo.

## Cuánto cuesta una OT — por TIPO y desde Configuración

> [!important] Desde el 2026-09-29 esto es el RESPALDO, no la única fuente
> `ordenes_trabajo.costo_real` permite capturar **lo que de verdad costó** cada
> visita, y ese importe **SUSTITUYE** a la tarifa por tipo de aquí abajo — no se
> le suma, porque las dos miden el costo de la orden entera. La tarifa por tipo
> pasa a ser lo que siempre fue de hecho: una **estimación** para cuando el
> costo real no se ha capturado, y el reporte ahora **declara cuántas visitas
> van con cada cosa**.
>
> Todo el porqué —incluido que `0` no es lo mismo que «sin capturar», y por qué
> la captura es una ruta propia con candado de dinero— está en
> [[02-Backend/costo-real-de-ot]].

Desde el **2026-09-17** el costo de mano de obra de una orden de trabajo sale de
`config_negocio.costos_ot` (jsonb, una fila por tenant — ADR 0011) y se resuelve
por tipo en `lib/costos-ot.ts`. Lo lee todo el que calcula margen:
el Dashboard —desde el 26/10 por el motor de reportes, ya no por `dashboardMetrics`—, `margenCampana` (`derive.ts:739`, el costo en `:760`) —los dos por `costoEfectivoDeOt`, que prefiere el costo real— y los
reportes de rentabilidad ([[reportes-rentabilidad]]).

Antes era una constante en el archivo de derivados:

```ts
// lib/data/derive.ts — RETIRADA el 17/09 (en :254 queda el comentario que lo cuenta)
const COSTO_OPERATIVO_POR_OT = 1500
// Parámetro de demo; en producción vendría de ConfigNegocio o por tipo de OT.
```

> [!important] El respaldo NO se siembra en la base, y es a propósito
> `COSTOS_OT_RESPALDO` (`lib/costos-ot.ts`) tiene los **nueve** tipos del enum
> `tipo_ot` (`db/schema.sql:53`) y **todos valen 1500**, que es lo que costaba
> cualquier OT antes del cambio. El DEFAULT de la columna es `{}` —«sin
> configurar»—, no los nueve importes: sembrarlos pondría el número en dos
> sitios, y el día que el negocio lo cambie la flota seguiría con el viejo
> quemado en su fila sin que nada lo dijera.
>
> Consecuencia medible: la migración **no mueve el margen**. Una organización que
> no configure nada ve exactamente las cifras de ayer.
>
> Y cuánto cuesta una herrería frente a una inspección **no lo decide el
> código**: se captura en Configuración. El respaldo solo existe para que un
> tenant sin configurar no reviente ni cueste 0 — un costo de 0 se suma sin que
> nada falle y deja el margen inflado en pantalla.

`costoDeOt(tipo, costos)` cae al respaldo ante cualquier hueco: tenant sin fila,
columna vacía, tipo sin capturar, valor basura en el jsonb, y **tipo fuera del
enum** (cae al respaldo de `OTRO`, no a 0). El `0` configurado **sí manda**: es
un costo capturable de verdad, y confundirlo con «sin configurar» sería volver a
decidir por el usuario — el mismo hallazgo de CFG-01 con los plazos de cobranza.

Se escribe por `PATCH /api/config` con las claves como **enum cerrado**
(`app/api/config/route.ts`), y se **sanea al leer y al escribir**
(`sanearCostosOt`): la columna es jsonb y lo que entre se arrastra en cada
respaldo.

> [!success] 2026-09-21 · Ya hay pantalla — B11 cerrado
> Hasta hoy `PATCH /api/config` aceptaba `costosOt` pero solo se podía escribir
> con una petición a mano: la pantalla no existía. Ahora hay una tarjeta en
> **Administración → pestaña Configuración** (`CostosOtCard`,
> `app/(app)/(shell)/administracion/page.tsx`), con un input por cada tipo
> vigente de `TODOS_TIPOS_OT` (excluye `TIPO_OT_OBSOLETO`, o sea
> `MONTAJE_DIGITAL`: ya no se ofrece en ninguna pantalla).
>
> Qué viaja en el PATCH es la única decisión no trivial: solo los tipos que el
> usuario tocó en esta sesión, comparando el borrador contra el `costosOt` que
> trajo el último GET. Un campo vaciado desde un valor existente manda `null`
> explícito (quitar ese tipo, vuelve al respaldo); un campo que nunca se tocó
> no viaja. Vive en `lib/costos-ot-payload.ts` (`payloadCostosOt`), con su
> propia prueba — `.tsx` no se prueba con unitarias porque `vitest.config.ts`
> no monta jsdom.

## Almacén — artículos por TIPO (desde el 2026-09-30)

Pedido del dueño el 30/09: «en almacén se debe de poder añadir más elementos,
camionetas, herramientas, pantallas, cámaras, etc.».

**Lo que había antes**, medido en `main` (`17dfef6`): una tabla
`almacen_activos` (`db/migrations/20260723_almacen.sql:22-32`) con `etiqueta`,
`descripcion`, `tipo_activo text` **sin CHECK** y con default `'PANTALLA'`
(`:26`), `estado` enum `est_activo` (`:15`), `sitio_id` y `notas`; y
`almacen_movimientos` con el enum `tipo_mov_almacen` (`:19`). El catálogo de
tipos —PANTALLA / ESTRUCTURA / LONA / OTRO— vivía **solo en el `<select>` de la
pantalla**: la ruta guardaba cualquier texto que le llegara.

**Lo que cambia sin tocar la base** (el `text` sin CHECK lo permite):

- El catálogo vive en `lib/almacen-tipos.ts` (puro, lo usan servidor y
  pantalla): `VEHICULO`, `HERRAMIENTA`, `PANTALLA`, `EQUIPO`, `CAMARA`,
  `ESTRUCTURA`, `LONA`, `OTRO`.
- `almacen-controller.ts` lo **aplica en el servidor** con zod, `.strict()`:
  un tipo fuera del catálogo, o un `tenantId` en el cuerpo, da 400.
- `GET /api/almacen?tipo=X` filtra. **`OTRO` no es `= 'OTRO'`**: es «todo lo
  que no es de los demás» (`tipo_activo <> all($1::text[])`), porque las filas
  de antes pueden tener texto libre y tienen que caer en algún filtro. La
  pantalla cuenta con la MISMA regla (`tipoDeFiltro`), así que la pastilla y el
  filtro no pueden discrepar. Un `?tipo=` mal escrito da 400, no lista vacía.
- La pantalla enseña pastillas por tipo con su cuenta, y el texto libre de las
  filas viejas **tal cual** (no «Otro»): es lo único que dice qué son.
- `registrarMovimiento` gana `and tenant_id = $4` como segunda capa sobre la
  RLS: era la única operación por id del archivo sin ella.

> [!success] Los datos propios de cada tipo — migración **APROBADA por el dueño el 2026-09-30** (antes: pendiente de aprobación)
> Placas, marca, modelo, número de serie y ubicación en bodega **necesitan
> columnas nuevas**: `20261001_almacen_datos_por_tipo.sql` ([[migraciones]],
> [[esquema]]), en su **propio commit** de `feat/almacen-tipos` para que el
> catálogo pueda aterrizar sin ella (regla del 29/09: ningún cambio de base
> entra sin que él vea la forma).
>
> Qué pide cada tipo lo decide `camposDelTipo()` en `lib/almacen-tipos.ts`:
> vehículo → marca, modelo, serie (VIN) y **placas**; herramienta, pantalla,
> equipo, cámara y otro → marca, modelo y serie; estructura y lona → nada
> propio. `ubicacion` vale para todos. Un dato que el tipo no pide da 400 en
> el controller (`superRefine`), y las placas fuera de un vehículo las para
> además la base (`almacen_activos_placas_solo_vehiculo`). Las placas se
> guardan sin espacios y en mayúsculas.
>
> La columna «Ubicación» de la pantalla enseña la pantalla si está
> INSTALADO, y si no, `ubicacion` (la bodega).

Probado en `lib/almacen-tipos.test.ts`, `lib/server/almacen-controller.test.ts`
y, contra Postgres real y con dos organizaciones, en
`lib/test/almacen-tipos.e2e.test.ts`.

## Módulo móvil

`/m/ot/[id]` es una vista sin chrome para la cuadrilla en campo. Ver
[[paginas-publicas]].

> [!success] `OTMovil.tsx` se retiró el 2026-08-27 — no lo importaba nadie
> Importaba de `lib/auth-context.tsx`, el cliente JWT contra el backend
> archivado, y **eso lo hacía parecer una dependencia viva**. No lo era: la
> página real `/m/ot/[id]` renderiza `OTVista`, que está limpia. Los dos
> archivos salieron con la pista archivada. Ver [[zonas-de-riesgo]] §A6.

## Relacionadas
[[flujo-orden-de-trabajo]] · [[finanzas-y-cobranza]] · [[reportes-rentabilidad]] ·
[[arrendadores-y-contratos]] · [[integraciones-externas]] · [[MOC-Proyecto]]

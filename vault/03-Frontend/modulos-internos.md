---
tipo: modulo
estado: verificado
actualizado: 2026-09-30
tags: [frontend, modulos, pantallas, verde]
archivos:
  - apps/web/app/(app)/(shell)/
  - apps/web/components/demo/
  - apps/web/lib/modulos.ts
  - apps/web/lib/campanas-vista.ts
---

# Módulos internos (dentro del shell)

22 rutas bajo `app/(app)/(shell)/`. Todas exigen sesión y pasan por
[[shell-y-navegacion]].

| Ruta | Módulo | Backend | Componentes propios |
|---|---|---|---|
| `/inicio` | Tablero | `/api/estado` | `KPICard`, `charts` |
| `/actividad` | Bitácora | `acciones` | — |
| `/comercial` | Buscador de inventario | `/api/sitios` | `SiteFicha`, `ReservaDialog`, `AltaSitioDialog`, `SpaceEyeVision` |
| `/disponibilidad` | Calendario | `/api/sitios` | `CalendarioDisponibilidad` |
| `/inventario` | Alta y carga masiva | `/api/sitios`, `/api/sitios/import` | `InventarioTabla`, `ImportarInventarioDialog`, `NuevaPantallaForm`, `ContratoWizard`, `AgregarInventario`, `InfoAnadidaModal` |
| `/network` | Pantallas en red | `sitios.en_network` | — |
| `/arrendadores` | Arrendadores, predios, contratos | `/api/arrendadores`, `/api/contratos` | `ContratoSheet`, `PagosRentaCard`, `CompromisoRentaCard`, `ConciliacionCard`, `PanelFirmas`, `ConstanciaFirmas`, `LicenciasCard`, `GestionRazonesSociales`, `BarraDocumento`, `BajaPropietarioDialog` |
| `/clientes` | Clientes | `/api/clientes` | `ClientesBadge`, `BorrarClienteDialog` |
| `/propuestas`, `/propuestas/[id]` | Propuestas | `/api/propuestas` | `Stepper` |
| `/captacion` | Captación (CAP-01) | `/api/captacion/*` | `Captacion` — ver [[02-Backend/captacion]] |
| `/campanas`, `/campanas/[id]` | Campañas | `/api/campanas/*` | `PipelineView`, `CandadoPanel`, `ValidacionPanel`, `PlaylogsPanel`, `DatosFacturacion`, `EvidenciaGaleria`, `AgregarCreativo` |

> [!note] 2026-09-30 · la lista de Campañas se puede compactar, minimizar y ocultar
> Pedido del dueño: cada tarjeta dibujaba el pipeline entero y con muchas
> campañas la pantalla era una tira interminable. **Vista compacta** (ningún
> pipeline, una fila por campaña), **minimizar** una tarjeta y **ocultar** una
> campaña de la lista, con «Mostrar ocultas (N)».
>
> Es preferencia **de pantalla y de cada navegador**: vive en `localStorage`
> (`spaces:campanas-vista`, `apps/web/lib/campanas-vista.ts`) con el patrón de
> `lib/alertas-visibles.ts`, y **no toca el servidor**. Ocultar no archiva ni
> cancela nada. Lo que se lee de `localStorage` se valida campo a campo: una
> preferencia rota vuelve a la vista vacía en vez de tirar la pantalla
> (`lib/campanas-vista.test.ts`).
>
> Los botones viven DENTRO del enlace de la tarjeta, así que llaman a
> `preventDefault` + `stopPropagation`: sin eso, minimizar abriría la campaña.
| `/creativos` | Creativos | `/api/creatividades` | — |
| `/operaciones`, `/operaciones/ot/[id]` | Órdenes de trabajo | `/api/ot` | `OTVista` |
| `/imprenta` | Imprenta | `/api/impresion` | — |
| `/almacen` | Activos y traslados | `/api/almacen` | — |
| `/finanzas` | Facturas y cobranza | `/api/campanas/[id]/facturar`, `/api/cobranzas/*` | — |
| `/comisiones` | Comisiones | derivado | — |
| `/administracion` | Usuarios, permisos, organizaciones, actualizacion de la instancia | `/api/usuarios`, `/api/tenants`, `/api/actualizaciones` | `OrganizacionesPanel`, `ControlCambiosPanel`, `ActualizacionesPanel`, `permisos.ts` |

> [!tip] `ActualizacionesPanel` (ADR 0037) — la frase y el tono NO viven en el `.tsx`
> Igual que `payloadCostosOt` o `compuerta.ts`: `vitest.config.ts` no monta jsdom
> (ver `CLAUDE.md`), así que una decisión escrita dentro de un componente no la
> prueba nadie — es la lección de B32/B33. `textoDeEstado()` y
> `textoConfirmarInstalar()` viven en `components/demo/admin/actualizaciones-ui.ts`
> con sus 9 pruebas; el `.tsx` solo llama al endpoint y pinta lo que esas
> funciones deciden. El caso negativo que prueban: una aprobación cuyo digest ya
> no es el disponible **no se pinta como aprobada** — se pinta como que hay una
> versión más nueva, que es la mentira exacta que el ADR 0037 existe para
> impedir.

> [!tip] Un panel que no aplica **se explica**, no se esfuma
> `OrganizacionesPanel.tsx` mostraba nada cuando no eras el super-admin de
> plataforma, y eso se lee como avería. Desde `2326149` dice **por qué** no lo
> ves. Es el mismo patrón que la contraseña temporal: si el servidor niega algo,
> la pantalla tiene que decirlo.

Desde el 07/08 el alta de usuario y la de organización llevan casilla **«entra
con su cuenta de Google»**: no se teclea contraseña y el servidor genera una que
nadie ve. Ver [[flujo-acceso-con-google]].
| `/configuracion` | Config del negocio | `/api/config`, `/api/organizacion` | — |
| `/integraciones` | Estado de conectores | `/api/integraciones` | — |

## Componentes compartidos

`components/demo/ui/`: `Button`, `Card`, `Modal`, `Sheet`, `Tabs`,
`ConfirmDialog`, `InlinePanel`, `Paginacion`, `Breadcrumbs`, `IndicadorCarga`,
`SpaceOsMark`.

Más `StatusBadge`, `SlotsBadge`, `EmptyState` y `MapView` (MapLibre).

El mapa que se ve es **siempre `components/demo/MapView.tsx`**: lo montan las
cinco pantallas con mapa, incluida la propuesta pública `app/(app)/p/[id]`. Su
basemap es **OpenFreeMap `positron`, sin clave** — la rama de MapTiler existe
pero nadie la enciende, y en la flota no puede encenderse por instancia
([ADR 0030](../../docs/adr/0030-el-basemap-de-la-flota-no-lleva-clave.md)).

> [!danger] El `(0,0)` se llevaba el mapa al océano — en TODA la flota
> Diagnosticado el **2026-09-24**, y llevaba tiempo. Una pantalla sin
> coordenadas sale de la base como `NULL`, y `rowToSitio` la entregaba como
> **`0`** (`apps/web/lib/server/sitios-repo.ts:44-45`). Cero es finito, así que
> pasaba el filtro `Number.isFinite` de `MapView` y **se dibujaba en el (0,0)**,
> mar abierto en el golfo de Guinea.
>
> Lo caro no era el pin perdido: el auto-enfoque (`focoDensidad`) busca el
> cúmulo más denso, lo encontraba en el Atlántico y **encuadraba el mapa ahí**.
> Un inventario sin coordenadas no daba un mapa vacío — daba un mapa que parecía
> roto, idéntico en el PADRE y en cada instancia, porque es el mismo binario.
>
> La regla de descartar el `(0,0)` **ya existía** en
> `lib/predio-cercania.ts:92-98` y nunca había llegado al mapa. Ahora vive una
> sola vez en **`lib/coordenadas.ts`** (`puntoUtil`), con 7 pruebas, y `MapView`
> la usa en el filtro de pines y en el auto-enfoque.
>
> **Y el mapa ahora DICE lo que descarta**: una etiqueta abajo a la izquierda
> cuenta las pantallas sin ubicación. El hueco se ve; antes se lo tragaba.
>
> [!success] 2026-09-24 · y se taparon las DOS fuentes del hueco
> Quedarse en el guard habría dejado el mapa honesto y el hueco intacto. Las
> pantallas nacen por tres caminos y cada uno hacía algo distinto:
>
> | Camino | Antes | Ahora |
> |---|---|---|
> | Carga masiva CSV | default + **marca de pendiente** + aviso | igual — ya era correcto |
> | Alta manual | default al Zócalo **en silencio** | **exige latitud y longitud** |
> | `scripts/semilla-demo.mjs` | **no sembraba coordenadas** | las seis las traen |
>
> El del alta manual era el peor de los tres: `Number(lat) || 19.4326` no dejaba
> un hueco, dejaba **una pantalla en el Zócalo sin marca de pendiente**. Un dato
> inventado que parece real no lo detecta nadie nunca.
>
> **La carga masiva sigue SIN exigirlas, a propósito.** Un Excel de cien filas
> rara vez las trae y bloquearlo sería fricción sin motivo; por eso ahí el
> default se acompaña de `pendienteVerificacion`
> (`lib/inventario-import.ts:211-218`). Dando de alta UNA pantalla tienes la
> dirección delante, así que ahí sí se exige.
>
> La semilla además coloca los dos pares que comparten predio a ~60 m, dentro de
> `RADIO_PREDIO_M` (250 m): si no, generaría justo el dato que
> `pantallasFueraDelGrupo` marca como sospechoso. Lo fija una prueba.
>
> **Expediente completo —medición, qué se hizo en cada máquina y qué queda—:**
> `docs/evidencias/19-mapa-sin-puntos-20260924.md`.

> [!warning] Arreglar el encuadre NO hace aparecer puntos
> Es el otro lado de lo mismo y conviene no confundirlo: el código deja de
> mentir sobre dónde está una pantalla, pero una pantalla sin coordenadas
> sigue sin tener dónde pintarse. Que se vean pines es un arreglo de **datos**,
> uno por instancia. `lib/server/sitios-repo.ts:44-45` sigue devolviendo `0` en
> vez de `null` — el arreglo de raíz arrastra el tipo `Sitio.lat` a
> `number | null` en ~16 sitios y está anotado en `docs/Supervision/ABIERTOS.md`.

> [!warning] `components/maps/SitiosMap.tsx` no lo monta ninguna pantalla
> Sigue en el árbol y pide mosaicos a `tile.openstreetmap.org` por su cuenta, sin
> pasar por `MapView`. No es el mapa que ve nadie hoy. Si se retira, sale también
> su host del `connect-src` de `next.config.mjs`.
>
> Comprobado el **2026-09-08** (`grep -rl SitiosMap --include=*.tsx`: solo se
> encuentra a sí mismo). El resto de esta nota sigue con la fecha de su
> frontmatter: lo que se revalidó ese día fue el mapa, no la nota entera.

> [!warning] `components/demo/ui/` es de alto contacto
> Lo importa casi todo. Un cambio de API en `Button` o `Modal` toca decenas de
> pantallas. Ver [[AGENTES]].

## Catálogo de módulos y permisos

`lib/modulos.ts` es el **catálogo explícito** del ADR 0010. `components/demo/
admin/permisos.ts` y `packages/utils/src/permissions.ts` acompañan.
`lib/rbac-coherencia.test.ts` verifica que no se desincronicen.

## `DesbloqueoCambios`

`components/demo/shell/DesbloqueoCambios.tsx` es el candado de la Topbar de los
cambios sensibles. **No es decorativo**: es la salida de un `403
{requiereDesbloqueo:true}` en las rutas `SENSIBLE`. Ver [[autenticacion-y-sesion]].

> [!warning] Ese candado NO sirve para las rutas `REAUTH`
> `DesbloqueoCambios.tsx:57` hace `if (!requiere) return null`: con el
> interruptor `exigir_reautenticacion` apagado —el valor por defecto, y el de
> los cinco tenants de producción— **no se pinta**. Pero las rutas `REAUTH`
> piden la contraseña igual, ignorando ese interruptor, así que su 403 se
> quedaría sin ninguna salida a la vista.
>
> Por eso los dos borrados de catálogo (`BorrarClienteDialog` en
> `clientes/page.tsx`, `BajaPropietarioDialog` en `arrendadores/page.tsx`) piden
> la contraseña **dentro de su propio diálogo** y reintentan ahí mismo. No es
> duplicación por descuido: es el único camino que funciona con el interruptor
> apagado. Ver [[02-Backend/api-endpoints]].

### El diálogo que se olvidó de pedirla — y lo que se hizo con eso

> [!danger] 2026-09-25 · «Con cuál de tus razones sociales se paga» pedía la
> contraseña y NO pintaba dónde escribirla
> `RazonSocialQuePagaModal` (`components/demo/arrendadores/ContratoSheet.tsx`)
> llamaba a `editarContratoApi`, el PATCH de contratos pasa por
> `exigirCambioSensible` y su `catch` pintaba el 403 del servidor como un error
> rojo. **La palabra `password` no aparecía ni una vez en las 1012 líneas del
> archivo**: no era CSS ni una condición que no se cumpliera, el campo no
> existía. El camino directo estaba muerto y el único vivo era el rodeo —cerrar
> la ficha, «Cambios bloqueados», desbloquear, volver— que el manual de
> septiembre llegó a documentar como paso normal.
>
> Lo encontró la sesión que fotografió el manual, no una prueba: **ninguna lo
> veía**, porque el arnés no tiene DOM y el bailoteo estaba copiado a mano en
> cada diálogo.
>
> **Lo que cambió, y es lo que impide que vuelva.** La secuencia dejó de
> copiarse: vive en `lib/cambios-candado.ts` (`confirmarConCandado`, módulo puro
> con las dos acciones inyectadas) y el campo es un componente,
> `components/demo/ui/CampoContrasena.tsx`. `esErrorDeDesbloqueo` se movió al
> módulo puro y `lib/data/cambios-api.ts` lo **reexporta**, para que no haya dos
> copias de esa comparación.
>
> Se prueba en dos piezas, porque no hay DOM: `lib/cambios-candado.test.ts` (sin
> contraseña NO se guarda, y el orden desbloquear-antes-de-guardar) y
> `components/demo/arrendadores/candado-contrato.test.ts`, que RINDE el campo
> con `react-dom/server` y lee el fuente de `ContratoSheet.tsx` para comprobar
> que lo usa —el modal va dentro de un `Dialog.Portal` de Radix y en servidor no
> rinde nada—.
>
> **Lo que sigue sin probarse, dicho con todas las letras:** que al pulsar
> «Guardar» el campo aparezca de verdad en el navegador. Eso no lo alcanza este
> arnés. ~~Y **los otros dos diálogos del mismo archivo siguen con el
> defecto**.~~ **Cerrados esa misma tarde** — ver el recuadro de abajo.

> [!success] 2026-09-25, tarde · los otros DOS cuadros del mismo archivo, cerrados
> `CompletarContratoModal` y `PagoModal` (`ContratoSheet.tsx`) tenían el mismo
> defecto y quedaron fuera de la aprobación de la mañana. Jochelo la amplió el
> mismo día —«si arregla los dos diálogos que faltan»—, y **uno de los dos es
> zona ROJA R4: registrar un pago de renta es dinero**.
>
> Los dos usan ahora las mismas dos piezas, sin tocarlas:
> `confirmarConCandado` y `CampoContrasena`.
>
> - **«Completar contrato de arrendamiento»** guarda por `editarContratoApi` →
>   `PATCH /api/contratos/:id`, con `exigirCambioSensible`. El campo sale debajo
>   del formulario y **los cuatro datos capturados se conservan**, que era lo
>   caro del rodeo viejo: había que volver a teclearlos.
> - **«Registrar pago»** sella la renta por `registrarPagoRentaApi` →
>   `POST /api/pagos-renta/:id/pagar`, también con `exigirCambioSensible`.
>
> **El de pagos tenía un agravante que no se ve leyendo el mensaje:** el 403
> salía por `onError()`, o sea **por un toast que se desvanece**. El usuario
> perdía de vista la única frase que le decía qué hacer y el cuadro se quedaba
> abierto sin explicación. Por eso **`onError` se retiró del componente**: lo
> que este cuadro tenga que decir sobre por qué no se guardó vive dentro del
> modal, junto al campo, mientras el cuadro siga abierto. El toast se reserva
> para el «Pago registrado» del final, que sí es efímero.
>
> **Lo que NO cambió, y conviene no confundirlo:** los adjuntos de un pago ya
> sellado van por `PATCH /api/pagos-renta/:id` (`adjuntarAPagoApi`), que **no
> lleva guard**. La secuencia es la misma para los dos a propósito: si mañana se
> le pone candado a esa ruta, el cuadro ya sabe pedir la contraseña.
>
> **La prueba que importa es la negativa**, y esa sí se ejecuta de verdad:
> `candado-contrato.test.ts` §5 corre `confirmarConCandado` con el cliente real
> de `estado-api` y `fetch` espiado, y comprueba que **sin contraseña, o con la
> equivocada, no sale ni un POST a `/pagos-renta/:id/pagar`**. Lo demás de ese
> archivo lee el fuente, por la misma razón de siempre: no hay DOM.
>
> **Sigue sin probarse** que el campo aparezca en el navegador al pulsar el
> botón. Ese salto no lo da este arnés.

### El problema difícil: pedir la contraseña donde NO hay cuadro

> [!success] 2026-09-25, tarde · B38 · los TRES caminos de dinero y «Renovar»
> El barrido que dejó el arreglo anterior encontró **12 puntos de llamada en 6
> archivos** que consumen rutas con candado y no ofrecían dónde teclear. Jochelo
> aprobó cerrar **cuatro** —«si arregla el 1 y el 2»—: los tres de dinero y el
> que no decía nada.
>
> | Pantalla | Ruta | Zona |
> |---|---|---|
> | `arrendadores/PagosRentaCard.tsx` | `POST /api/pagos-renta/:id/pagar` | **R4 · dinero** |
> | `finanzas/page.tsx` · `GenerarFacturaDialog` | `POST /api/campanas/:id/facturar` | **R4 · dinero** |
> | `finanzas/page.tsx` · `PagoModal` | `POST /api/cobranzas/:id/pagar` | **R4 · dinero** |
> | `arrendadores/ContratoSheet.tsx` · «Renovar» | `POST /api/contratos/:id/renovar` | — |
>
> **Lo que hace distinto este lote, y es la decisión de diseño que documenta esta
> nota:** los tres cuadros de la mañana eran MODALES —había un sitio evidente
> donde meter el campo—. **«Registrar pago» de la tabla de rentas y «Renovar» son
> botones de UN CLIC**, sin diálogo ninguno. La regla adoptada es **una sola**:
>
> > La contraseña se pide **dentro del cuadro donde se confirma la acción**.
> > Si la acción **no tiene cuadro**, el 403 **abre uno**, atado a esa acción exacta.
>
> **Por qué no se manda a la Topbar**, que era la otra salida obvia: además del
> rodeo (salir, desbloquear, volver a buscar la fila) y de que nada conecta el
> 403 con ese botón, `DesbloqueoCambios` **abre TODO durante 15 minutos** para
> poder hacer UNA cosa. Pedirla en el sitio gasta el desbloqueo en la acción que
> se confirma y no en las otras trece rutas protegidas — menor privilegio,
> también en el tiempo.
>
> **La pieza nueva es `components/demo/ui/candado.tsx`**, y expone las dos caras
> de lo mismo para que no haya dos mecanismos:
> - `useCandado()` — el estado y la **acción pendiente**. Confirmar la REPITE
>   (`reintentar()`) en vez de armar una nueva: en «Registrar pago» de una
>   cobranza hay dos botones —liquidar todo el saldo y abonar una parte— y
>   confirmar el que no era movería otro dinero del que se pidió. Por eso, además,
>   los campos de esos dos cuadros quedan en **solo lectura** mientras se teclea.
> - `PasoContrasena` — el bloque, para un cuadro que ya existe.
> - `DialogoCandado` — ese mismo bloque dentro de un `Modal` que aparece.
>
> **NO se reescribieron `lib/cambios-candado.ts` ni `ui/CampoContrasena.tsx`**:
> dan servicio a los tres cuadros de la mañana y se usan tal cual. Sus pruebas
> siguen en verde sin tocarse.
>
> **«Renovar» tenía DOS defectos y se cerraron los dos.** Era un `await` suelto a
> `iniciarRenovacionApi` seguido de `onToast(...)`, **sin `try/catch` ninguno**:
> el 403 rechazaba la promesa, el toast nunca llegaba y no pasaba absolutamente
> nada. Lo segundo es lo que no era del candado: **cualquier** fallo de esa ruta
> —un 500, la red caída— era igual de invisible. Ahora `confirmarConCandado`
> devuelve el fallo como VALOR y `alFallar` lo enseña.
>
> **Se prueba en `components/demo/candado-dinero-y-renovar.test.ts`** (35
> afirmaciones). §7 y §8 **no leen el fuente**: corren la secuencia real con los
> clientes de `estado-api` y `fetch` espiado, y comprueban que sin contraseña —o
> con la equivocada— **no sale ni una petición** a ninguna de las tres rutas de
> dinero, y que un 500 de la renovación vuelve como valor en vez de perderse.
> Ocho mutantes, todos muertos y deshechos; uno **sobrevivió** a la primera
> versión de §6 —un `toContain('candado.reintentar()')` que se tragaba el
> `onEnter` del campo— y la afirmación se estrechó al botón.
>
> **QUEDAN OCHO, y fuera de esta aprobación:** cinco en
> `inventario/InventarioTabla.tsx` (cuatro **se tragan** el mensaje), uno en
> `inventario/ContratoWizard.tsx` y dos en `comercial/SiteFicha.tsx`.
>
> **Sigue sin probarse** que el cuadro aparezca en el navegador al pulsar el
> botón. Ese salto no lo da este arnés.

> [!success] 2026-09-25, noche · B38 · **los OCHO restantes, y B38 CERRADA**
> Inventario y las fichas de pantalla. Ninguno mueve dinero —la tabla de B38 lo
> dice—, aunque **sí tocan campos que el servidor llama sensibles**: tarifa,
> renta y arrendador. Ver el aviso del final, que es una pregunta abierta.
>
> | # | Pantalla | Ruta | Dónde va el campo |
> |---|---|---|---|
> | 5 | `InventarioTabla` · `CeldaRenta` | `PATCH /api/contratos/:id` | el 403 **abre cuadro** |
> | 6 | `InventarioTabla` · lote de rentas | `PATCH /api/contratos/:id` **×N** | el 403 **abre cuadro** |
> | 7 | `InventarioTabla` · `CeldaTarifa` | `PATCH /api/sitios/:id` | el 403 **abre cuadro** |
> | 8 | `InventarioTabla` · `CeldaPropietario` | `PATCH /api/sitios/:id` | el 403 **abre cuadro** |
> | 9 | `InventarioTabla` · lote de tarifas | `PATCH /api/sitios/:id` **×N** | el 403 **abre cuadro** |
> | 10 | `ContratoWizard` | `POST /api/contratos` | **dentro** del asistente |
> | 11 | `SiteFicha` · `EditarSitioDialog` | `PATCH /api/sitios/:id` | **dentro** del modal |
> | 12 | `SiteFicha` · eliminar | `DELETE /api/sitios/:id` | **dentro** del `ConfirmDialog` |
>
> ### Lo primero, porque la tabla de B38 se quedaba corta en cuatro
>
> Decía «se lo traga» y «toast», o sea que el mensaje se perdía. **No era eso.**
> `actualizarSitioApi` y `borrarSitioApi` (`lib/data/sitios-api.ts`) **no miraban
> `r.ok`**: un 403 se **resolvía como éxito**. La celda de tarifa cantaba
> «Tarifa de "X" actualizada» con la tarifa intacta, y «Eliminar pantalla»
> cerraba el cuadro dejando la pantalla donde estaba. **El `toast.error` escrito
> en la ficha no se disparaba nunca.** Callarse es malo; **mentir es peor**,
> porque nadie comprueba lo que la pantalla acaba de dar por hecho.
>
> Los doce puntos se habían clasificado **leyendo el `catch`**, y estos cuatro no
> tenían el defecto en el `catch`: lo tenían en el cliente de la API, una capa más
> abajo. Es la limitación que la propia entrada de B38 declaraba.
>
> ### El problema nuevo: **dos de los ocho son LOTES**
>
> «Aplicar tarifa a las seleccionadas» y «aplicar renta» mandan **N `PATCH` en
> paralelo** (`Promise.allSettled`), así que «una acción, un cuadro» no les vale
> tal cual. La política vive en **`lib/cambios-lote.ts`** (módulo puro, sin React
> ni `fetch`) y es ésta:
>
> 1. **La contraseña NO se pide de entrada.** El candado está apagado por defecto
>    en los tenants; preguntar siempre sería fricción inventada, y enseña a
>    teclearla sin que nadie la pida. Se manda el lote y decide el servidor. Como
>    las N salen contra la **misma sesión**, el candado las rechaza **todas
>    juntas**: no se aplica ninguna.
> 2. **Lo que el servidor rechazó no se aplicó; lo que pasó SE QUEDA.** No hay
>    vuelta atrás del lado del cliente y fabricarla sería tocar el servidor.
> 3. **El reintento manda SOLO las pendientes**, nunca el lote entero. Hoy los
>    valores que viajan son absolutos, así que repetirlo saldría igual — pero
>    cada reescritura deja su fila en `registrarAccion`, y el registro diría que
>    la pantalla se editó dos veces cuando se editó una. Y el día que el ajuste
>    porcentual se calcule en el servidor, repetir **compondría** el porcentaje.
> 4. **Si el lote quedó a medias, SE DICE CUÁNTAS.** `lote.frase()` produce
>    «Se aplicó en 2 de 3 pantallas; 1 sin cambiar.», y el **subtítulo** del
>    cuadro la enseña antes de pedir la clave, junto con que confirmar aplica solo
>    las que faltan. **Un lote a medias y en silencio es peor que no haber hecho
>    nada**, y era exactamente lo que hacía el `catch {}` de antes.
>
> Para que eso sea posible, `actualizarTarifasApi` y `actualizarRentasApi`
> devuelven ahora `ResultadoLote`: además de `ok`/`fallidas`, **`pendientes`** —los
> elementos que no se aplicaron— y **`requiereDesbloqueo`**. Antes cada fallo era
> un `Error('patch falló')` idéntico para todos: imposible distinguir el candado
> de un 500, e imposible saber cuáles reintentar.
>
> ### Lo demás, sin sorpresas
>
> Las **tres celdas en línea** montan `DialogoCandado` **en todas sus ramas de
> `return`**, no solo en la de edición: cuando vuelve el 403 la celda ya cerró su
> campo y se pinta como botón, así que un cuadro montado solo en la otra rama se
> desmontaría justo cuando hace falta. El **asistente** y el **modal de editar**
> llevan `PasoContrasena` dentro, y **confirmar repite la acción pendiente** en
> vez de releer el formulario. En **eliminar**, el campo va dentro del
> `ConfirmDialog` —que estrenó una prop opcional `confirmDeshabilitado`, porque
> `busy` además bloquea «Cancelar» y escribe «Procesando…»— y el cuadro **no se
> cierra** mientras el servidor pide la clave.
>
> ### Cómo se prueba
>
> `components/demo/candado-inventario-y-fichas.test.ts`, **37 afirmaciones**. Las
> **cuatro primeras secciones (20 pruebas) no leen el fuente**: corren la
> secuencia real con los clientes de `data/*-api` y `fetch` espiado y **cuentan
> peticiones** — que el reintento manda dos y no tres, que `s1` no vuelve a
> salir, que sin contraseña no sale ni una. **Trece mutantes, todos muertos**, y
> uno **sobrevivió**: cambiar `{dialogo}` por `{null}` en `CeldaTarifa` dejaba las
> 37 en verde porque el `toContain('<DialogoCandado')` casaba con la línea que lo
> **declara**. La afirmación se estrechó a contar los `{dialogo}` rendidos, uno
> por rama. Es el mismo vicio que el mutante de la mañana, en otro archivo.
>
> **Ni una línea de servidor.** `lib/cambios-candado.ts`, `ui/CampoContrasena.tsx`
> y `ui/candado.tsx` se usan tal cual; sus pruebas siguen en verde sin abrirse.
>
> **Sigue sin probarse** que el cuadro aparezca en el navegador al pulsar. Y
> tampoco se probó que un lote quede a medias **en Postgres de verdad**: el
> parcial se simula con el `fetch` espiado.
>
> > [!warning] Lo que conviene que decida una persona
> > Los ocho se cerraron con la clasificación de B38 («Dinero: no»), y es
> > defendible: ninguno mueve dinero, emite documento ni altera saldos. Pero
> > `app/api/sitios/[id]/route.ts:15-19` llama **sensibles** a `tarifaMensual`,
> > `tarifaPublicada`, `costoCompra`, `precioM2`, `tarifaImpresion`,
> > `arrendadorId` y `predioId`, y `app/api/contratos/**` está en la lista de
> > archivos de **R4** en [[06-Operacion/zonas-de-riesgo]]. O sea: **la zona roja
> > y la tabla de B38 no dicen lo mismo sobre estas rutas.** Aquí no se tocó el
> > servidor ni se debilitó ningún guard, así que el riesgo real es nulo; lo que
> > queda es la discrepancia escrita, y merece una frase del dueño.

## Dónde hay lógica de negocio en el cliente

En general está bien separada: los cálculos puros viven en `apps/web/lib/*.ts`
con tests (`finanzas-calculo`, `reparto-creativos`, `renta-periodicidad`,
`predio-cercania`, `contrato-vigencia`, `recordatorios-contratos`,
`contrato-documento`).

> [!note] Esto es un acierto, no un problema
> Son funciones **puras** compartidas entre cliente y servidor, y el servidor las
> reimporta para decidir de verdad. El riesgo sería que el cliente decidiera
> solo; no es el caso en los flujos de dinero, donde el guard está en el route
> handler.

Zona **VERDE** salvo lo que toca dinero o catálogo. Ver [[zonas-de-riesgo]].

## Relacionadas
[[shell-y-navegacion]] · [[paginas-publicas]] ·
[[comercial-propuestas-campanas]] · [[finanzas-y-cobranza]] · [[MOC-Proyecto]]

# Plan de capturas — Manual de usuario Space OS

- **Manual origen:** `vault/08-Manuales/manual-usuario-2026-08-11.md` (9 capítulos)
- **Entorno:** LOCAL — `http://localhost:3000/spaces-dooh` (Next dev desde `apps/web`)
- **Viewport:** 1440x900 fijo (excepción documentada en 05-06)
- **Salida:** `manuales/capturas/NN-MM-descripcion.png`
- **Fecha del plan:** 2026-08-11

## Cómo leer este plan

Cada captura lleva una marca de **efecto**, porque el manual está escrito por
tareas y muchas tareas son altas de registros:

| Marca | Significado |
|---|---|
| **L** | Solo lectura. Navega y fotografía. No escribe nada. |
| **F** | Abre el formulario/diálogo y fotografía **sin guardar**. No escribe nada. |
| **W** | Requiere escribir en la base local para existir. **Necesita tu visto bueno explícito.** |
| **B** | Bloqueada. No se puede tomar hoy. Motivo indicado. |

El grueso del plan es L y F: se puede ilustrar casi todo el manual sin tocar un
solo registro, porque lo que la persona necesita reconocer es la pantalla y sus
campos, no el registro concreto que quedó guardado.

---

## Capítulo 1 — Antes de empezar

| Archivo | Manual | Qué se ve | Cómo se llega | Efecto |
|---|---|---|---|---|
| `01-01-acceso-tres-opciones.png` | 1 · «Cómo entras» | Pantalla de acceso completa con las tres vías: correo/contraseña, «Continuar con Google» y «¿No tienes cuenta? Crear cuenta» | Ir a `/login/` | **L** |
| `01-02-alta-organizacion.png` | 1 · «Crear tu organización», pasos 2-4 | Formulario «Crear cuenta» con Organización, Tu nombre, Correo, Contraseña | En `/login/`, pulsar «Crear cuenta» | **F** |
| `01-03-tablero-inicio.png` | 1 · «Cómo entras», «qué debes ver» | Tablero de inicio ya dentro, vista completa | Entrar y aterrizar en `/inicio` | **L** |
| `01-04-menu-lateral-grupos.png` | 1 · «Cómo entras» / tabla de tipos de cuenta | Recorte del menú lateral con los cinco encabezados: Inventario, Vender, Entregar, Finanzas, Sistema | `locator.screenshot()` sobre el `<aside>` | **L** |
| `01-05-desbloqueo-cambios.png` | 1 · «Cuando el sistema te pide desbloquear» | Ventana «Desbloquear cambios», subtítulo «Contraseña del Dueño», botones Cancelar/Desbloquear | Botón «Cambios bloqueados» de la barra superior | **B** |

**01-05 bloqueada.** El candado solo existe si el tenant tiene
`tenants.exigir_reautenticacion = true`, y esa columna nace en `false`
(`db/migrations/20260804_reautenticacion_individual.sql`). Si el tenant local la
tiene apagada, el botón no se monta y no hay ventana que fotografiar. Encenderla
es una escritura de configuración del tenant: **no la hago sin tu visto bueno.**
Ver el desfase D-1 más abajo, que es lo de fondo.

Nota: la captura 01-01 es una de las cinco que el manual pide de forma explícita
con `> [!note] Captura:`.

---

## Capítulo 2 — Registrar lo que rentas

| Archivo | Manual | Qué se ve | Cómo se llega | Efecto |
|---|---|---|---|---|
| `02-01-inventario-lista.png` | 2 · «Dar de alta una pantalla», «qué debes ver» | Lista de inventario con sus pantallas (hay 3) | Menú → «Inventario» | **L** |
| `02-02-alta-pantalla-datos.png` | 2 · «Dar de alta una pantalla», paso 3 | Formulario de alta con clave interna, código de proveedor, caras, spots totales y máximo de clientes simultáneos | «Inventario» → crear pantalla | **F** |
| `02-03-alta-pantalla-arrendador.png` | 2 · «Dar de alta una pantalla», paso 4 | El selector de arrendador desplegado (el manual insiste en que es obligatorio) | Mismo formulario, abrir el selector | **F** |
| `02-04-carga-masiva.png` | 2 · «Cargar muchas pantallas de una vez», pasos 2-3 | Diálogo de importación con la zona de carga del Excel | «Inventario» → carga masiva | **F** |
| `02-05-ficha-pantalla.png` | 2 · «Corregir o dar de baja una pantalla», paso 2 | Ficha de una pantalla con sus datos editables | «Inventario» → entrar a una pantalla | **L** |
| `02-06-incidencia-pausa.png` | 2 · «Reportar una avería, reubicar o pausar», paso 3 | Los controles de incidencia / reubicación / pausa legal | Ficha de la pantalla | **F** |

Los pasos 1 y 5 de «Dar de alta una pantalla» (abrir Inventario, Guardar) no
llevan imagen propia: ocurren en la misma vista que 02-02 sin cambio visible.

02-01 es la segunda captura que el manual pide de forma explícita. El manual la
describe como «con una pantalla recién dada de alta»; la voy a tomar con el
inventario que ya existe. Fotografiar literalmente un alta recién hecha sería
**W** y no aporta nada distinto a la vista.

---

## Capítulo 3 — Arrendadores y contratos de renta

| Archivo | Manual | Qué se ve | Cómo se llega | Efecto |
|---|---|---|---|---|
| `03-01-arrendadores-lista.png` | 3 · «Dar de alta un arrendador», «qué debes ver» | Lista de arrendadores (hay 3) | Menú → «Arrendadores» | **L** |
| `03-02-alta-arrendador.png` | 3 · «Dar de alta un arrendador», pasos 3-4 | Formulario con nombre, RFC, Domicilio y razones sociales | «Arrendadores» → crear | **F** |
| `03-03-contrato-renta.png` | 3 · «Completar el contrato de renta», pasos 3-4 | Contrato con monto de renta, «Cada cuándo» (periodicidad) y razón social | Arrendador → contrato de la pantalla | **L** |
| `03-04-contrato-documento.png` | 3 · «Mandar el contrato a firma», paso 3 | Documento del contrato generado | `/contrato/[id]` | **L** |
| `03-05-calendario-pagos.png` | 3 · «Registrar el pago de la renta», paso 2 | Calendario de pagos de renta con sus vencimientos | Contrato → pagos de renta | **L** |
| `03-06-solicitar-firma.png` | 3 · «Mandar el contrato a firma», paso 4 | El control de solicitud de firma y la liga generada | Contrato | **B** |
| `03-07-cancelar-renovar.png` | 3 · «Cancelar o renovar un contrato», paso 3 | Las opciones de cancelar y renovar | Contrato | **B** |

**03-06 bloqueada.** Solicitar la firma **sella el documento de forma
irreversible** (el propio manual lo advierte: «ya no puedes tocar ese
documento») y emite una liga de firma. Es una escritura destructiva sobre uno de
los 3 contratos de la base local. No la ejecuto.

**03-07 bloqueada.** Cancelar un contrato **dispara una orden de retiro en
campo** según el manual. Aunque aquí no hay cuadrilla real, deja el contrato
cancelado y genera una OT. No la ejecuto. Si quieres la imagen, lo razonable es
un contrato de usar y tirar creado para eso, y eso es **W**.

**Sobre 03-05.** Depende de que alguno de los 3 contratos esté completo (monto y
periodicidad capturados). Si los 3 están incompletos, no hay calendario y pasa a
bloqueada. Lo confirmo al correr.

---

## Capítulo 4 — Vender

| Archivo | Manual | Qué se ve | Cómo se llega | Efecto |
|---|---|---|---|---|
| `04-01-clientes-lista.png` | 4 · «Registrar un cliente», «qué debes ver» | Lista de clientes (hay 3) | Menú → «Clientes» | **L** |
| `04-02-alta-cliente.png` | 4 · «Registrar un cliente», pasos 3-4 | Formulario con datos fiscales, IVA y la agencia | «Clientes» → crear | **F** |
| `04-03-comercial-mapa-filtro.png` | 4 · «Buscar pantallas», pasos 2-3 | Buscador comercial con el mapa y un filtro aplicado (tipo o disponibilidad) | Menú → «Comercial», aplicar un filtro | **L** |
| `04-04-disponibilidad-calendario.png` | 4 · «Buscar pantallas», paso 4 | Calendario de ocupación con fechas libres y comprometidas | Menú → «Disponibilidad» | **L** |
| `04-05-propuestas-lista.png` | 4 · «Armar una propuesta», paso 1 | Lista de propuestas (hay 1) | Menú → «Propuestas» | **L** |
| `04-06-propuesta-alta.png` | 4 · «Armar una propuesta», pasos 3-5 | Formulario: cliente, sitios con fechas y spots, descuento y comisión | «Propuestas» → crear | **F** |
| `04-07-propuesta-detalle-total.png` | 4 · «Armar una propuesta», «qué debes ver» | Propuesta con su folio y su «Resumen económico» / «Total c/IVA» | Entrar a la propuesta existente | **L** |
| `04-08-propuesta-liga-publica.png` | 4 · «Compartir la propuesta», pasos 3-4 | La vista pública que abre el cliente, sin usuario ni contraseña | `/p/[id]` en contexto sin sesión | **L** |
| `04-09-generar-campana.png` | 4 · «Convertir la propuesta en campaña», paso 3 | El control de generar campaña, **sin pulsarlo** | Propuesta aceptada | **F** |

**04-03 es la tercera captura explícita del manual.**

**Sobre 04-09.** Pulsar «generar campaña» crea una campaña y **reserva las
pantallas** en esas fechas. Es la única propuesta que hay en la base local. Se
fotografía el botón, no su resultado. Convertirla sería **W** y además
consumiría el único dato de prueba disponible.

---

## Capítulo 5 — Entregar la campaña

Este capítulo es el más castigado: **campañas 0, creativos 0, órdenes de trabajo
0**. Casi todo el capítulo describe operaciones sobre una campaña que no existe.

| Archivo | Manual | Estado | Motivo |
|---|---|---|---|
| `05-01-creativos-lista.png` | 5 · «Cargar los creativos», paso 1 | **L** | Sí se puede: se fotografía el módulo «Creativos» en su estado vacío («Sin creativos todavía»). Honesto, aunque no ilustra el paso 2. |
| `05-02-creativo-alta.png` | 5 · «Cargar los creativos», pasos 2-3 | **B** | El alta exige ligar la pieza a una campaña y no hay ninguna campaña. |
| `05-03-validar-repartir.png` | 5 · «Validar y repartir los creativos» | **B** | Sin campañas ni creativos. |
| `05-04-publicar-campana.png` | 5 · «Publicar la campaña» | **B — por seguridad** | Ver el aviso de abajo. No se captura ni cuando haya datos. |
| `05-05-imprenta-orden.png` | 5 · «Pedir la impresión», pasos 1-2 | **F** | El módulo «Imprenta» abre y el selector muestra «Selecciona una campaña…». Se fotografía el formulario vacío; sin campañas no se puede llegar al folio ni a la prueba de color. |
| `05-06-ot-movil-fotos.png` | 5 · «Cerrar una orden de trabajo desde el campo» | **B** | Hay 0 órdenes de trabajo, así que no existe `/m/ot/[id]` que abrir. |
| `05-07-operaciones-alta-ot.png` | 5 · «Levantar una orden de trabajo», pasos 2-4 | **F** | El formulario abre y muestra tipo, pantalla, campaña y «Asignar a (responsable)». |
| `05-08-almacen-activo.png` | 5 · «Mover activos en el almacén» | **L** | El módulo abre; hoy dice «Aún no hay activos registrados», así que ilustra el paso 1 pero no el movimiento. |
| `05-09-portal-cliente.png` | 5 · «Compartir el avance con el cliente» | **B** | El portal muestra el avance de una campaña, y no hay campañas. |

> **Aviso de seguridad sobre 05-04.** `apps/web/.env.local` tiene
> `DOOHMAIN_PUBLISH_ENABLED=1`, y `apps/web/lib/server/doohmain.ts` publica de
> verdad contra el SDK de Doohmain cuando esa bandera vale `1`. El propio manual
> advierte «El envío sale a pantallas reales». Aunque esto es el entorno local,
> la bandera de publicación está **encendida** y el destino no es local.
> **Esta captura queda excluida del plan de forma permanente**, no solo por
> falta de datos. Si algún día se quiere ilustrar, que sea con la bandera en `0`.

**05-06 y la regla del viewport.** El manual dice «Empiezas en: el teléfono». Esa
captura, si alguna vez se desbloquea, pide viewport de teléfono, no 1440x900.
Propongo la excepción explícita (390x844) y dejarla anotada al pie de la imagen,
porque forzarla a 1440 mostraría algo que la persona nunca va a ver. Es la
cuarta captura explícita del manual y hoy no se puede tomar.

---

## Capítulo 6 — Cobrar

**Facturas 0, campañas 0.** El capítulo describe facturar y cobrar algo que no
existe.

| Archivo | Manual | Estado | Motivo |
|---|---|---|---|
| `06-01-finanzas-lista.png` | 6 · «Facturar una campaña», paso 1 | **L** | El módulo «Finanzas» abre y muestra sus secciones («Listas para facturar», «Cobranza»), vacías. |
| `06-02-campana-facturada.png` | 6 · «Facturar una campaña», «qué debes ver» | **B** | No hay campaña facturable. Además el manual exige orden de compra, fotos de comprobación y reporte de publicación, y las dos últimas nacen de cerrar una OT, de las que hay cero. Es la quinta captura explícita del manual. |
| `06-03-registrar-pago.png` | 6 · «Registrar el pago del cliente», paso 3 | **B** | Sin cobranza abierta no hay dónde registrar el abono. |
| `06-04-recordatorio.png` | 6 · «Recordarle al cliente que pague» | **B** | Sin cobranza vencida. |
| `06-05-comisiones.png` | 6 · «Consultar comisiones» | **L** | Sí se puede: el módulo calcula sobre clientes y agencias, y ambos existen. |

---

## Capítulo 7 — Avisos del sistema

| Archivo | Manual | Qué se ve | Cómo se llega | Efecto |
|---|---|---|---|---|
| `07-01-notificaciones-panel.png` | 7 · pasos 1-2 | Panel «Notificaciones» desplegado con la lista y el botón de vaciarla | Campana de la barra superior (`aria-label="Notificaciones"`) | **L** |

Si el tenant local no tiene avisos, saldrá «Sin notificaciones» y el botón de
vaciado **no se pinta** (solo aparece con la lista no vacía). En ese caso la
imagen ilustra el paso 1 pero no el 2, y lo anoto en pendientes.

---

## Capítulo 8 — Cuando algo falla

**Sin capturas planeadas.** El capítulo cita mensajes de error (contrato
incompleto, factura duplicada, agencia sin validar). Reproducirlos exige
provocar el fallo, es decir escribir y chocar contra las validaciones. El propio
manual reconoce en su PENDIENTE 7 que no tiene los textos literales. Ilustrarlo
requiere decisión tuya sobre qué errores vale la pena provocar en local.

## Capítulo 9 — Relacionadas

Sin capturas: son enlaces del vault.

---

## Resumen

> **Corrección (fase 2).** La primera versión de este resumen decía «33
> planeadas, 20 tomables, 13 bloqueadas». Esa cuenta estaba mal: al sumar las
> filas de las siete tablas salen **42**, no 33. Los números correctos son los
> de abajo. El detalle por capítulo nunca cambió; lo que fallaba era la suma.

| | Cantidad |
|---|---|
| Capturas planeadas | **42** |
| Tomables (L + F) | **32** |
| Bloqueadas (B) | **10** |

Incluye ya el desbloqueo de **01-05**: el humano encendió
`exigir_reautenticacion` en el tenant `alfa`, así que la ventana «Desbloquear
cambios» se puede ilustrar y con ella el desfase D-1.

Ninguna de las 32 escribe en la base: son navegación y formularios abiertos sin
guardar.

Las 10 bloqueadas: 7 por falta de datos (05-02, 05-03, 05-06, 05-09, 06-02,
06-03, 06-04), 2 por destructivas (03-06 sellar firma, 03-07 cancelar contrato)
y 1 por seguridad de forma permanente (05-04 publicar).

De las **cinco** capturas que el manual pide de forma explícita, se logran
**tres** (01-01 acceso, 02-01 inventario, 04-03 comercial) y quedan bloqueadas
**dos** (05-06 OT en el teléfono, 06-02 campaña facturada).

---

## Enmascarado de datos sensibles

La base local trae datos que no son de un tenant de pruebas limpio: entre los 9
usuarios hay al menos un correo personal real (`emistreg@gmail.com`), y hay 3
clientes y 3 arrendadores con nombre, RFC y domicilio.

Antes de cada captura el script aplicará un `page.addStyleTag` que difumina los
portadores de dato sensible: correo, RFC, domicilio, teléfono e importes de
renta. El nombre de la organización y los rótulos se dejan legibles, porque son
justo lo que la persona tiene que reconocer.

Esto es lo mejor que se puede hacer con la base que hay. Lo correcto de fondo es
un tenant de pruebas con datos inventados; si lo quieres, dilo y lo planteo
aparte.

---

## Desfases entre el manual y la aplicación

Los encontrados al leer el código, antes de tomar una sola imagen. **No he
tocado el manual**; corregirlos es decisión tuya.

**D-1 · El desbloqueo no es incondicional, y el manual lo presenta como si lo
fuera.** El manual abre con «Las operaciones que mueven dinero o tocan contratos
no se ejecutan de corrido» y luego, en once tareas, remata los pasos con
«confirma el desbloqueo cuando el sistema te lo pida». En realidad el candado
depende de `tenants.exigir_reautenticacion`, que **nace apagado**. Con la
bandera apagada esas once instrucciones describen un paso que nunca ocurre, y la
persona se queda esperando una ventana que no va a salir. Es el desfase de mayor
alcance del manual.

**D-2 · «Archiva todos» no existe; el botón dice «Borrar todas».** El capítulo 7
dice «Márcalos como leídos uno por uno, o **archiva** todos de una vez» y remata
con «Los avisos **archivados** desaparecen de la lista activa». El control real
es un botón **«Borrar todas»** con icono de bote de basura. Archivar y borrar no
son lo mismo para quien lee, y aquí la palabra suave describe la acción
irreversible.

**D-3 · «Márcalos como leídos uno por uno» no es un control.** No hay acción de
marcar como leído. Al pulsar un aviso, este se abre y navega a su vínculo; que
quede leído es un efecto de haberlo abierto. El manual describe un botón que no
está.

**D-4 · «Avisos» contra «Notificaciones».** El capítulo 7 los llama «avisos» de
principio a fin. La interfaz los llama **«Notificaciones»**, tanto en el título
del panel como en el `aria-label` de la campana. El manual además dice «Abre la
lista de avisos» sin decir por dónde: el control es un icono de campana en la
barra superior, sin texto visible.

**D-5 · La recuperación de contraseña no está apagada en local.** El manual
afirma «La recuperación por correo está apagada hoy». En este entorno el enlace
**«¿Olvidaste tu contraseña?»** sí se pinta: se apaga con
`NEXT_PUBLIC_RECUPERAR_PASSWORD=0` y esa variable no está puesta en
`apps/web/.env` ni en `.env.local`. Habría que confirmar si en producción sí lo
está; si no, el manual describe como ausente algo que la persona ve.

**D-6 · Rótulos de los pasos contra rótulos reales.** El manual describe la
acción pero no nombra el control, y su PENDIENTE 1 lo admite. Lo que ya se puede
cerrar con lo leído: «Confirma el acceso» → botón **«Entrar»**; «Elige la opción
de dar de alta una organización» → **«Crear cuenta»**; «la periodicidad del
pago» → la etiqueta real es **«Cada cuándo»**. La ventana de desbloqueo
(PENDIENTE 3) se titula **«Desbloquear cambios»**, pide **«Contraseña del
Dueño»** y dura **15 minutos**.

**D-7 · PENDIENTE 11 tiene respuesta.** «Comisiones» muestra la comisión **de la
agencia**: la vista está construida sobre «Agencias y su comisión», «Clientes y
su agencia» y «Comisión de la agencia (%)». No hay comisión de vendedor.

**D-8 · PENDIENTE 5 tiene respuesta parcial.** Existe una ruta
`/configuracion`, pero **no está en el menú lateral**: `nav.ts` no la incluye.
Por eso la persona no la encuentra. Los ajustes que sí están en el menú viven en
«Administración».

**Lo que sí concuerda** (verificado contra `nav.ts`, que es la fuente): los cinco
encabezados del menú y **la tabla completa de tipos de cuenta**, fila por fila,
incluidos los ocho módulos de Comercial. Y la pantalla de acceso ofrece de
verdad las tres vías: `/api/auth/metodos/` responde `{"google":true}`, así que el
botón de Google se pinta.

### Observación de código, no del manual

`apps/web/components/demo/shell/DesbloqueoCambios.tsx` dice en su comentario de
cabecera «al Dueño no le sale nunca». Es **falso hoy**: la exención por rol se
retiró a propósito y así está documentado en `lib/server/cambios.ts` («NO hay
exención por rol… se retiró»), que además no la aplica. El comentario quedó
viejo y contradice al código de al lado. Aquí el manual tiene razón y el
comentario no.

---

## Condiciones para la fase 2

**Credenciales: recibidas y suficientes.** `duenio@alfa.test`, rol DUENO
(«Dueño alfa»), con ver/crear en los ocho módulos. Es el rol correcto para este
plan: la tabla de tipos de cuenta del propio manual deja claro que solo Dueño ve
Inventario, Arrendadores, Actividad y Administración, y el recorrido pasa por
todos ellos. **Ninguna captura queda bloqueada por permisos.**

Que la cuenta tenga permiso de **crear** no cambia el plan: las 7 capturas de
formulario siguen siendo **F**, se abren y se fotografían sin guardar. Poder
escribir no es motivo para escribir.

Dos condiciones técnicas que el script debe respetar:

- **`trailingSlash`.** Todas las rutas van con barra final (`/login/`,
  `/inicio/`, `/inventario/`). Sin ella responde 308 y la navegación de
  Playwright se lleva un redirect en cada paso.
- **Modo dev: la primera visita a cada ruta compila.** El login tardó 18 s la
  primera vez. Esto refuerza la regla que ya tenía el plan: esperar **siempre**
  por condición (`await expect(...).toBeVisible()`), nunca por reloj. Además
  subiré el `timeout` de navegación para la primera visita de cada ruta, porque
  el de por omisión (30 s) va justo para una compilación fría.

**Lo que sigue bloqueado no depende de credenciales:** las 13 capturas **B** lo
están por falta de datos (campañas, creativos, órdenes de trabajo y facturas en
cero), por ser operaciones destructivas (03-06, 03-07) o por seguridad (05-04).
La única que podría rescatarse es **01-05**, y solo encendiendo
`tenants.exigir_reautenticacion` en el tenant local, que es una escritura de
configuración: no la hago sin que me lo digas.

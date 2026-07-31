# ADR 0006: Un solo costo por pantalla — la renta al arrendador

- **Fecha:** 2026-07-30
- **Estado:** Aceptada

> Aprobada el 2026-07-30. Se ejecuta la **Fase 1** (cerrar la entrada); la Fase 2
> (borrar las columnas) queda pendiente de una revisión posterior de los lectores.

## Contexto

Una pantalla tiene hoy **dos** campos de costo, y son el mismo dinero:

- `sitios.costo_compra` (y `sitio_modalidades.costo_compra`, uno por modalidad).
- La renta pactada con el propietario, en `contratos_arrendamiento.monto_renta`.

No son costos distintos. El costo de una pantalla es lo que se le paga al
arrendador por el espacio; no existe una "compra" aparte. Lo confirmó el dueño del
producto: *«para todas las pantallas debe estar solo el costo de renta, no el de
compra, ya que son el mismo»*.

**El cálculo financiero ya resolvió la ambigüedad a favor de la renta.**
`margenCampana()` (`lib/data/derive.ts:449`) toma el costo del espacio de
`rentaAtribuidaPorSitio()`, que lee el contrato vigente. El comentario de
`derive.ts:938` es explícito: *«NUNCA usa costoCompra: la renta ES el costo del
espacio (un solo costo, sin doble conteo)»*. En la misma línea,
`sitios.renta_arrendador` quedó **deprecado (M1)** y `sitios-repo.ts:343` prohíbe
editarlo por la ruta de sitios: la fuente de la renta es el contrato.

Lo que **no** se alineó es la captura y una pantalla de UI:

| Punto | Archivo | Situación |
|---|---|---|
| Importación de inventario | `lib/inventario-import.ts:143` | `costo_compra` es **obligatorio**: sin él la fila se rechaza |
| Plantilla oficial | `scripts/generar-plantilla-inventario.mjs` | columna marcada `obl: true`; **no** emite `renta_arrendador` |
| Alta manual | `components/demo/inventario/NuevaPantallaForm.tsx:139` | campo de captura |
| Wizard de contrato | `components/demo/inventario/ContratoWizard.tsx:268` | campo de captura |
| Ficha comercial | `components/demo/comercial/SiteFicha.tsx:808` | editable en línea |
| **Margen de ficha** | `components/demo/comercial/SiteFicha.tsx:392` | `margen = tarifaPublicada - costoCompra` |

La consecuencia práctica es doble. Primero, se le pide al usuario un número que
después **no interviene en ningún cálculo financiero**: puede capturar cualquier
cosa y el P&L no se entera. Segundo —y más grave— `SiteFicha` calcula un margen por
sitio con `costo_compra` mientras el P&L calcula el de campaña con la renta: **dos
márgenes distintos para el mismo espacio**, sin que nada indique cuál manda.

La magnitud en la base actual (9 pantallas) antes de corregirla a mano: 8 de 9
tenían los dos números en desacuerdo, con desviaciones de hasta 111% (DIG-002:
`costo_compra` 95,000 contra renta 45,000). Los datos sintéticos agravan el ruido:
`seed.ts:135` y `mock.ts:185` inventan `costoCompra = tarifa × 0.62`, un costo que
nunca existió.

## Decisión

**`costo_compra` deja de ser un dato de entrada. El único costo capturable de una
pantalla es la renta del contrato de arrendamiento.**

Se ejecuta en dos fases para no romper a los 21 archivos que hoy leen el campo:

**Fase 1 — cerrar la entrada.**

1. En `inventario-import.ts`, `costo_compra` deja de ser obligatorio y pasa a
   leerse **como la renta**: el costo se toma del primer valor no vacío entre
   `renta_arrendador`, `costo_arrendador` y `costo_compra`, y la fila avisa cuando
   el importe salió de la columna vieja. `renta_arrendador` ocupa su lugar en la
   plantilla, que se regenera.

   > Corrección sobre la propuesta original, que decía hacer `renta_arrendador`
   > **obligatorio** e **ignorar** `costo_compra`. Ambas cosas eran un error y se
   > contradecían con las Consecuencias de este mismo ADR: exigir la columna nueva
   > rechazaría todos los archivos que los clientes ya tienen, e ignorar la vieja
   > tiraría a la basura el único costo que esos archivos traen —dejando la
   > pantalla sin costo y su contrato `INCOMPLETO`—. Leer la columna vieja como la
   > renta conserva el dato y no rompe ninguna carga existente, que es justo lo
   > que se busca: si son el mismo dinero, hay que tratarlas como el mismo dato.
2. Se quitan los campos de captura de `NuevaPantallaForm`, `ContratoWizard` y
   `SiteFicha`. La renta se captura donde ya vive: el contrato.
3. `SiteFicha:392` calcula el margen con la renta atribuida
   (`rentaAtribuidaPorSitio()`), la misma fuente que el P&L. Deja de haber dos
   márgenes.
4. `sitios.costo_compra` y `sitio_modalidades.costo_compra` se llenan como **espejo**
   de la renta del contrato, para que ningún lector actual vea un cero repentino.

**Fase 2 — quitar la columna.** Una vez migrados los lectores a la renta, se
eliminan ambas columnas y el campo `costoCompra` de `types.ts:215`.

Una migración de datos alinea lo existente: `monto_renta := costo_compra` donde
difieran, tomando `costo_compra` como el dato bueno —es el que varía por pantalla y
refleja captura real, frente a rentas planas de seed—. **Los pagos de renta ya
liquidados (`pagos_renta.estatus = 'PAGADO'`) no se reescriben**: son el registro de
lo que efectivamente se pagó. Solo se ajustan los `PENDIENTE`.

## Alternativas consideradas

**A. Dejar los dos campos y documentar que `costo_compra` es informativo.** Cero
riesgo de regresión y ningún cambio de esquema. Se descarta porque no arregla el
problema real: mientras `SiteFicha` siga calculando un margen con él, "informativo"
es una ficción: hay un número en pantalla que contradice al P&L, y el usuario no
tiene forma de saber cuál creer. Documentar una trampa no la desactiva.

**B. Conservar `costo_compra` como el costo y migrar el P&L a usarlo.** Es el
inverso: un solo costo, pero en la columna del sitio. Se descarta porque rompe la
atribución por predio: un contrato de predio se reparte entre las caras de sus
pantallas (`rentaAtribuidaPorSitio()`), cálculo que necesita el contrato y no cabe
en una columna escalar del sitio. Además reintroduciría el dato que M1 ya deprecó.

**C. Renombrar `costo_compra` a `renta_mensual` y dejarlo como está.** Barato y
mejora la lectura. Se descarta porque conserva **dos** lugares donde vive la renta
—la columna y el contrato— que pueden divergir en silencio, que es exactamente el
estado del que venimos.

## Consecuencias

**Positivas**

- Un solo número por pantalla, en un solo lugar. Deja de ser posible que el margen
  de la ficha y el del P&L discrepen.
- La captura se simplifica: una columna menos obligatoria en la plantilla y tres
  campos menos en formularios.
- El costo pasa a estar respaldado por un contrato con arrendador, fecha y
  periodicidad, en vez de por un número suelto sin trazabilidad.

**Negativas**

- **Una pantalla sin contrato completo se queda sin costo.** Hoy `costo_compra` da
  un costo aunque no haya contrato; al quitarlo, ese hueco se vuelve visible. Es el
  efecto buscado (ADR 0001), pero de entrada más pantallas aparecerán con costo
  cero hasta que se completen sus contratos. En la base actual son 8 de 9
  `INCOMPLETO`.
- El campo `costo_compra` es obligatorio en la plantilla que los clientes ya
  tienen. Aceptarlo-e-ignorarlo evita rechazar archivos, pero durante un tiempo el
  usuario capturará un dato que no se guarda; hay que avisarlo en el diálogo de
  importación o parecerá que se perdió.
- 21 archivos referencian el campo. La Fase 2 es un refactor amplio y el riesgo de
  regresión se concentra en los adaptadores (`mock.ts`) y en `types.ts`.
- Perder `costo_compra` elimina la posibilidad de registrar un costo por modalidad
  distinto del de la renta. Si alguna vez se comercializa la misma pantalla con
  costos distintos por unidad, habrá que reintroducirlo — con otro nombre y otra
  justificación.

**Implicaciones de seguridad**

- *Superficie de ataque:* se reduce. Desaparecen tres puntos de entrada de un valor
  monetario (`NuevaPantallaForm`, `ContratoWizard`, edición en línea de
  `SiteFicha`) y la columna sale del mapa de campos editables de
  `sitios-repo.ts:337`.
- *Autorización:* es la mejora principal. Hoy `costo_compra` se edita con permiso de
  **Comercial** desde la ficha, sin candado. La renta del contrato exige el candado
  en modo ESTRICTO (`sinExenciones`, ADR 0001) porque compromete dinero con un
  tercero. Al unificar, el costo del espacio queda protegido por el control más
  fuerte y deja de existir una puerta lateral para moverlo.
- *Validación:* la renta pasa por `contrato_monto_ck` (> 0) y por `rentaValida()`;
  `costo_compra` solo por una coerción a número que admite 0. Se gana validación en
  capas.
- *Aislamiento por tenant:* sin cambios. Ambas tablas ya están bajo la RLS
  fail-closed y la migración corre por `tenant_id`.
- *Auditoría:* mejora. Un cambio de renta queda registrado en el contrato, con
  arrendador y vigencia; un cambio de `costo_compra` hoy no deja rastro
  equivalente.
- *Datos sensibles:* no se almacena información nueva.

## Cómo revertir

La Fase 1 es reversible sin pérdida: las columnas siguen existiendo y quedan
pobladas como espejo de la renta, así que basta con volver a mostrar los campos y
restaurar el cálculo de `SiteFicha:392`. Lo único no recuperable es la distinción
entre el `costo_compra` original y la renta en las filas donde difieran: la
migración los iguala. **Antes de correrla hay que respaldar
`(sitio_id, costo_compra)` y `(contrato_id, monto_renta)`**; sin ese respaldo, saber
cuál era el valor previo exige restaurar un backup completo.

La Fase 2 (borrar columnas) no es reversible por sí sola: recuperar los valores
exige el respaldo anterior.

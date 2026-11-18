# Revisión · ola 6 de la versión en inglés

- **Rama:** `feat/ingles-ola6` (worktree `.claude/worktrees/ingles-ola6`), sale de `integra/ingles` en `65f76cb6`.
- **Fecha:** 2026-11-03.
- **Qué es:** lo que todavía salía en español con el inglés encendido y que la ola 5 dejó a decisión del dueño (§7 de `revision-ola5.md`), más los menores A y C del validador de la ola 5. **Nada de lo que se guarda cambia:** todo se traduce al pintarlo.

## 1 · Commits

| Commit | Qué |
|---|---|
| `1f53c886` | Los cinco papeles de una razón social, en inglés al pintarlos |
| `92824e6e` | La lista por omisión de una OT nueva, en inglés al pintarla |
| `4acfd436` | Las notificaciones de la campanita, traducidas al pintarlas |
| `3542bbf6` | El tope al editar el descuento y la agencia sin validar, en inglés |
| `3b7752cb` | Los dos 400 de acceso (menor A), en pantalla |
| `bd6e599a` | El pipeline pintaba un día antes una fecha de inicio sin hora (menor C) |

## 2 · Notificaciones de la campanita

`lib/i18n/notificaciones.ts` (`traducirNotificacion`) y `lib/i18n/textos/notificaciones.ts` (38 claves `notificaciones.*`).

**Cómo funciona.** El español de cada clave es la plantilla exacta que escribe el servidor, con huecos. De ella sale el patrón que reconoce el texto guardado. Cada título lleva la lista de plantillas que puede tener su detalle, así que la frase de una OT no se reconoce bajo el título de una propuesta. Los huecos se conservan: folio, nombre, cliente y motivo. La cifra de días elige el plural inglés y el saldo se vuelve a formatear con `formatearDineroRedondo(…, 'en')`. Lo que no casa se pinta tal cual. En español la función devuelve el aviso sin tocarlo.

**Fuentes cubiertas (11 archivos del servidor).** Una prueba exige que no aparezca una fuente nueva sin plantilla (`git grep` de `notificar({` e `insert into notificaciones (`).

| Español guardado | Inglés en pantalla |
|---|---|
| Propuesta aprobada / rechazada | Proposal approved / rejected |
| Propuesta aceptada por el cliente · «PR-7 · X — aceptada por Lucía» | Proposal accepted by the client · «PR-7 · X — accepted by Lucía» |
| Campaña generada desde propuesta | Campaign generated from proposal |
| No se pudo generar la campaña · *(error del servidor)* | Could not generate the campaign · *(el error, por `traducirError`)* |
| Campaña por validar · «X se envió al dominio y espera validación de publicación» | Campaign awaiting publication review · «X was submitted for publishing and is awaiting publication review» |
| Publicación aprobada · «X fue validada y está al aire» | Publication approved · «X was approved and is on air» |
| Publicación rechazada · «X fue rechazada: *motivo*» | Publication rejected · «X was rejected: *motivo*» (el motivo es dato) |
| Factura emitida / ODC registrada | Invoice issued / PO recorded |
| Cobranza liquidada / Abono registrado · «cobranza» (sin folio) | Paid in full / Partial payment recorded · «collection» |
| Cobranza vencida · «F1 · Cliente — vencida hace 4 día(s) · saldo $247,080» | Overdue collection · «F1 · Cliente — 4 days overdue · balance MX$247,080» |
| Recordatorio de cobro · «… vence en 1 día(s) · saldo $3,480» | Payment reminder · «… due in 1 day · balance MX$3,480» |
| OT vencida · «OT-14 · Sitio no se cerró a tiempo (sin asignar)» | Overdue work order · «OT-14 · Sitio was not closed on time (unassigned)» |
| Contrato sin capturar: X / Contrato vencido: X | Contract not entered: X / Contract expired: X |
| Contrato vence HOY: X / Contrato vence en 2 días: X | Contract expires TODAY: X / Contract expires in 2 days: X |
| «un espacio» (contrato sin predio ni pantalla) | «a space» (solo ese texto exacto; un nombre que empiece igual es dato) |
| El botón «Ver» del aviso emergente | View |

Los detalles largos de los contratos («Le falta el arrendador…», «Venció hace N días y nadie lo ha renovado…», «Si se va a renovar…») también se traducen.

**Dónde se pinta:** `ItemNotificacion.tsx` (título, detalle, su `title` y el `aria-label` de borrar) y `SondeoNotificaciones.tsx` (el aviso emergente y su botón).

**Lo que no se traduce:** factura y ODC llevan un importe sin símbolo (`toLocaleString('es-MX')`), que se escribe igual en `en-US`, así que se deja. El motivo de rechazo de una publicación es dato.

## 3 · Los cinco papeles de una razón social

`lib/i18n/papeles.ts` y 10 claves `admin.papel.*` en `textos/admin.ts`.

| Código | Etiqueta (dato) | Inglés | Código en inglés |
|---|---|---|---|
| ARRENDAMIENTOS | Paga las rentas a los arrendadores | Pays rent to landlords | RENT |
| ACTIVOS | Compra los activos y el equipo | Buys assets and equipment | ASSETS |
| LICENCIAS | Tramites y licencias con gobierno | Government permits and licenses | PERMITS |
| OPERACION | Operacion y nomina | Operations and payroll | OPERATIONS |
| VENTAS | Vende publicidad | Sells advertising | SALES |

- **La etiqueta se traduce solo si es exactamente la de la migración.** Si una instancia la renombró, su texto es dato y se pinta como está.
- **Dónde:**
  - Razones sociales y Administración: los botones del editor, los chips de cada razón social y los avisos de papeles sin dueño y compartidos.
  - La bienvenida: las etiquetas del cuestionario, incluida la del campo que junta operación y ventas, y los códigos del plan y de la pantalla de ya contestada.
  - El reporte de rentabilidad por razón social: el detalle de la fila, con los papeles unidos por « · ».
- El español de las claves es el de la migración, sin tildes, como se guardó. Una prueba lo lee de `db/migrations/20260917_entidades_fiscales.sql`.

## 4 · La lista por omisión de una OT nueva

`lib/i18n/checklist-ot.ts` y 3 claves `operaciones2.checklist.omision.*`.

| Guardado | En pantalla (inglés) |
|---|---|
| Inspección de estructura y herrajes | Structure and hardware inspection |
| Montaje / ejecución | Installation / execution |
| Foto comprobatoria con geolocalización | Proof photo with geolocation |

- Solo se traduce el texto exacto: «Montaje / ejecución » (con espacio) o lo que escriba el usuario no se toca.
- Al marcar un punto, `alternarPunto` sigue mandando el texto guardado.
- Una prueba ata la lista a `operaciones/page.tsx`, letra por letra y en orden.

## 5 · Los dos mensajes del flujo de venta

Mismo mecanismo que la ola 4: patrones en `PATRONES_ERROR` (`lib/i18n/errores-servidor.ts`), de 56 a 61. En `PATCH /api/propuestas/[id]` se pasa por `traducirError(…, idiomaDeLaPeticion())` en dos sitios: el `catch` de la edición y el 400 genérico de aprobar. En español la respuesta es la misma; el status no cambia.

| Español | Inglés |
|---|---|
| El descuento máximo que autoriza tu organización es 20 %, y se pidió 30 %. Cabe hasta 20 % comercial. Pídele a Administración que lo suba si hace falta. | The maximum discount your organization allows is 20%, and 30% was requested. The commercial discount can go up to 20%. Ask an admin to raise it in Settings if needed. |
| … es 20 %. Esta propuesta ya lleva 10 % por volumen, así que un 12.5 % comercial deja un 21.25 % en total (los descuentos se componen, no se suman). Cabe hasta 11.11 % comercial. … | … is 20%. This proposal already has a 10% volume discount, so a 12.5% commercial discount leaves 21.25% in total (discounts compound, they don’t add up). The commercial discount can go up to 11.11%. … |
| El descuento por volumen (10 %) ya supera el tope (8 %): deja el descuento comercial en 0 % o pide a Administración que suba el tope. | The volume discount (10%) is already over the cap (8%): leave the commercial discount at 0% or ask an admin to raise the cap in Settings. |
| La negociación con la agencia X no está validada; valídala antes de crear la propuesta | The negotiation with the agency X is not validated; validate it before creating the proposal |
| La negociación con la agencia X no está validada; no se puede aprobar la propuesta | The negotiation with the agency X is not validated; the proposal can’t be approved |

- Las 512 combinaciones del tope (las mismas cifras que usó el validador de la ola 4) salen idénticas en español y sin rastro de español en inglés.
- Los cinco patrones nuevos no casan con ninguna entrada del catálogo ni del diccionario.
- La frase de la ola 4 al aprobar sigue saliendo igual.
- Las dos frases de la agencia están atadas al literal de `propuestas-repo.ts`.

## 6 · Menores del validador de la ola 5

- **A.** «Cuerpo inválido» (rutas `login` y `codigo`) → «Invalid request». «Falta el enlace de restablecimiento.» (`reset`) → «The reset link is missing.». Se traducen en pantalla con `lib/i18n/errores-acceso.ts`, con dos claves `login.error.*`. Las rutas de acceso no se tocaron.
- **C. Arreglado.** El problema: `fechaInicio` llega como `2026-11-03` y `new Date()` la lee como medianoche UTC, que en México todavía es el día 2. El paso «Confirmada» del pipeline salía «02/11» en español y «Nov 2» en inglés.
  - `isoDePaso` (`lib/data/client.ts`) le pone la medianoche local a una fecha sin hora. Las marcas de tiempo con hora no cambian.
  - **Antes / después (en `America/Mexico_City`):** `2026-11-03` → «02/11» / «03/11»; `2026-12-01` → «30/11» / «01/12»; `2026-11-03T05:30:00Z` → «02/11» / «02/11» (sin cambio).
  - Es la única excepción al «español idéntico». Ningún otro estado español cambia: en las pruebas de pantallas el pipeline va simulado.
- **B** ya lo cerró la integración de la ola 5 (prueba de espera de dos cifras).

## 7 · Cómo se midió que el español no cambió

- **HTML.** Se volcó el español de las 15 pruebas de pantallas, cada una en su carpeta (`I18N_VOLCAR` / `VOLCAR_HTML`), antes de tocar nada (`65f76cb6`) y al final.
  - `diff -rq`: **0 diferencias en los 555 estados existentes.**
  - Hay 4 archivos nuevos, los estados que añade esta ola: `admin/razones_sociales_los_cinco_papeles_del_catalogo_ola_6_` y `cuenta-shell/33`, `34` y `35`. Los de cuenta y shell van **al final** de la lista porque ese volcado numera por posición.
- **Diccionario.** `DICCIONARIOS.es` antes, 5521 claves; después, 5574. **0 valores cambiados**, 0 quitados y 53 nuevos (38 `notificaciones.*`, 10 `admin.papel.*`, 3 `operaciones2.checklist.omision.*` y 2 `login.error.*`).
- **Servidor.** `traducirError(m, 'es') === m` para las 512 combinaciones del tope y las dos frases de la agencia. La ruta, con el idioma en español, responde el mismo cuerpo y el mismo status que antes; hay prueba para cada caso.
- **Instantáneas.** Las de `textos/admin` y `textos/operaciones2` cambian solo con líneas añadidas (`git diff` sin líneas quitadas).

## 8 · Pruebas y mutantes

- **Pruebas nuevas:**
  - `lib/i18n/notificaciones.test.ts`: 84 casos. Español intacto, inglés de cada plantilla, lo desconocido intacto, los recordatorios de contratos armados por su función real, cada plantilla atada a su literal del servidor y las fuentes contadas.
  - `textos/notificaciones.test.ts`: instantánea y guardias de forma.
  - `papeles.test.ts`, `checklist-ot.test.ts`, `mensajes-venta.test.ts` (patrones y la ruta) y `lib/data/pipeline-fecha.test.ts`.
- **Estados añadidos:** en `pantallas-admin`, `pantallas-cuenta-shell` (bienvenida ×2 y campanita) y `pantallas-operaciones2`, donde se exige el inglés de la lista en la ficha abierta y en la cerrada.
- **Cada prueba se vio en rojo antes de implementar:**
  - función vacía, componente sin cambiar, ruta sin `traducirError`;
  - para C, el defecto reproducido: «02/11» frente a «03/11».
- **Mutantes: 28 de 28 mueren.** Cada uno se restauró y `git status` quedó limpio. El m08 sobrevivía en la primera pasada y lo mata un caso añadido.

  | # | Mutante | Muere en |
  |---|---|---|
  | m01 | días con una sola cifra | notificaciones |
  | m02 | plural al revés | notificaciones |
  | m03 | saldo sin reformatear | notificaciones y pantallas |
  | m04 | «un espacio» sin traducir | notificaciones |
  | m05 | patrón sin `^` | notificaciones |
  | m06 | el detalle de error sin `traducirError` | notificaciones |
  | m07 | detalles de cualquier título | notificaciones |
  | m08 | hueco libre codicioso (`*`) | notificaciones (caso del motivo que repite la frase) |
  | m09 | papel sin distinguir mayúsculas | papeles |
  | m10 | código ajeno traducido | papeles |
  | m11 | punto de checklist parecido (`trim`) | checklist |
  | m12 | marcar manda el texto traducido | checklist (fuente) |
  | m13 | lista cerrada sin traducir | pantallas operaciones 2 |
  | m14 | agencia sin nombre no casa | mensajes de venta |
  | m15 | catch de la edición sin traducir | ruta |
  | m16 | 400 de aprobar sin traducir | ruta |
  | m17 | cifra entera en el patrón con volumen | 512 combinaciones |
  | m18 | «Cuerpo inválido» sin clave | errores de acceso |
  | m19 | fecha sin hora sin arreglo | pipeline-fecha |
  | m20 | el arreglo también a fechas con hora | pipeline-fecha |
  | m21 | detalle del reporte sin partir | papeles |
  | m22 | botones de papel sin traducir | pantallas admin |
  | m23 | avisos de papeles sin traducir | pantallas admin |
  | m24 | plan de la bienvenida con códigos crudos | pantallas cuenta |
  | m25 | campo fusionado sin partir | pantallas cuenta |
  | m26 | bienvenida contestada con códigos crudos | pantallas cuenta |
  | m27 | «Ver» literal en el aviso emergente | notificaciones (fuente) |
  | m28 | `aria-label` de borrar con el título crudo | pantallas cuenta |

  Quitar la salida temprana en español de `traducirNotificacion` o de `etiquetaDePapel` es un mutante **equivalente**: el español rearmado con `traducir('es', …)` es la misma plantilla con los mismos huecos. No se cuenta.
- **Cifras:**
  - `npm run typecheck`: limpio.
  - `npx vitest run --testTimeout=60000`: **6854 de 6854 en 372 archivos**.
  - `npm run build`: exit 0. Solo hay avisos `react-hooks/exhaustive-deps` que ya existían; el de `bienvenida/page.tsx:75` sale igual en la base, comprobado con `eslint` sobre el archivo de `65f76cb6`.
- **Inventario:** `node scripts/i18n-inventario.mjs` da 211 textos en 91 archivos, antes y después. No ve datos pintados crudos, que es justo lo que trata esta ola.

## 9 · Lo que se tocó fuera de `lib/i18n`

- **Pantallas:**
  - `components/demo/shell/ItemNotificacion.tsx` y `SondeoNotificaciones.tsx`;
  - `components/demo/razones-sociales/GestionEntidadesFiscales.tsx`;
  - `components/demo/bienvenida/CuestionarioRazonesSociales.tsx` y `app/(app)/bienvenida/page.tsx`;
  - `components/demo/reportes/tabla.ts` (`textoDeFila`);
  - `components/operaciones/OTVista.tsx`.
- **Datos:** `lib/data/client.ts` (`isoDePaso`; `formatFechaLocal` pasa a exportarse).
- **Ruta:** `app/api/propuestas/[id]/route.ts`, solo el texto de dos respuestas de error, como hizo la ola 4.

No se tocó nada de lo prohibido:
- `middleware.ts`, `nav.ts`, `db/schema.sql`, las migraciones;
- las rutas de acceso;
- `aislamiento.e2e.test.ts`, `servidor-e2e.ts`;
- `dinero.ts`, `contrato-documento.ts`.

Tampoco se tocaron el CSV del estado de cuenta, «MX$ 1,160.00 MXN» del comprobante, Actividad, las notas de versión ni «Vincular» de Space Eyes. No se usó `git stash` ni `git push`. No se levantó ningún servidor ni se tocó ninguna base.

## 10 · Lo que queda

- **`PaqueteImposible` al quitar un paquete** (`paquetes-repo.ts:441`). Envuelve el `e.message` del tope dentro de su propia frase («No se puede quitar el paquete "X": sin el paquete vuelve a aplicarse el descuento por volumen… Baja primero…»), y esa frase no tiene patrón. Sigue en español; necesita un patrón con un hueco que se traduzca a su vez.
- **Notificaciones ya guardadas con otra redacción.** Solo se reconocen las plantillas de hoy. Un aviso viejo, escrito antes de que cambiara la frase en el servidor, se pinta en español.
- **«El papel «X» no existe. Los que hay son: …»** (`admin.razones.falta.papel`). En inglés lista los códigos en español. No lo provoca la pantalla, que solo ofrece los cinco.

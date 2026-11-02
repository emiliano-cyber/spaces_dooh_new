# Tabla de revisión · lote de inglés «costura»

Generada el 2026-11-02, rama `feat/ingles-costura` (sale de `integra/ingles`,
`f2e0a15f`, que junta los cuatro lotes ya aprobados: propuestas, compartidos,
campañas y finanzas, comercial). Este lote **no traduce pantallas nuevas**: une
los cuatro. El inglés sigue apagado (`IDIOMA_INGLES` no se tocó).

- **español** es la copia literal de lo que ya decía el módulo. Donde el módulo
  conserva su literal (`NOMBRE_DIA`, `textoHorario`, `textoOrigenDoohmain`,
  `ETIQUETA_SIN_ASIGNAR`, `etiquetaAsignacion`), `lib/i18n/textos/compartidos.test.ts`
  exige que el diccionario diga exactamente lo mismo.
- **El español no cambió**: se volcó el HTML español de los **107 estados** de
  las cuatro pruebas de pantallas (propuestas 23, compartidos 6, campañas y
  finanzas 55, comercial 23) con las fuentes de `integra/ingles` y con las de
  esta rama, con las mismas pruebas, y `diff -rq` salió vacío. Detalle en
  «Cómo se midió», abajo.
- Ninguna cifra de dinero ni símbolo de moneda en el diccionario. `formatMonto`,
  `formatearDinero` y `dinero.ts` no se tocaron (la moneda es la rama
  `feat/moneda-por-instancia`).
- Medido comparando los diccionarios enteros (`DICCIONARIOS`) antes y después:
  claves **nuevas: 17** (todas en `compartidos.ts`), **retiradas: 6**
  (`finanzas.periodo.<tipo>`), **con el inglés cambiado: 32** y **con el español
  cambiado: 0**.

## 1 · Claves nuevas

| clave | dónde se pinta | español | inglés |
|---|---|---|---|
| `compartidos.doohmain.todo-el-dia` | `lib/doohmain-programacion.ts` · `textoHorario` → `ProgramacionDoohmain` | Todo el día (sin franja) | All day (no daypart) |
| `compartidos.doohmain.horario` | `textoHorario` | {desde} a {hasta} | {desde} to {hasta} |
| `compartidos.doohmain.las-que-quepan` | `textoReproducciones` → `ProgramacionDoohmain` | Las que quepan | As many as fit |
| `compartidos.doohmain.origen.ficha` | `textoOrigenDoohmain` → `SiteFicha` | escrita en esta ficha | entered on this profile |
| `compartidos.doohmain.origen.mapa` | `textoOrigenDoohmain` | del mapa del servidor (no está escrita en la ficha) | from the server map (not entered on the profile) |
| `compartidos.doohmain.origen.servidor` | `textoOrigenDoohmain` | la pantalla por omisión del servidor (no está escrita en la ficha) | the server’s default screen (not entered on the profile) |
| `compartidos.doohmain.origen.ninguna` | `textoOrigenDoohmain` | ninguna: al publicar, esta pantalla no recibiría nada | none: when publishing, this screen would receive nothing |
| `compartidos.dia.0` … `.6` | `textoHorario` (los días del horario propio) | dom · lun · mar · mié · jue · vie · sáb | Sun · Mon · Tue · Wed · Thu · Fri · Sat |
| `compartidos.asignacion.sin-asignar` | `razones-sociales/asignacion.ts`, `finanzas/comprobante.ts`, `finanzas/facturas-lista.ts` → Finanzas | Sin asignar | Unassigned |
| `compartidos.asignacion.baja` | `etiquetaAsignacion`, `opcionesDeAsignacion` | {nombre} (dada de baja) | {nombre} (deactivated) |
| `compartidos.asignacion.no-disponible` | `etiquetaAsignacion` | Razon social no disponible | Legal entity not available |

(«dom … sáb» son siete claves; la tabla las junta en una fila.)

## 2 · Claves retiradas (fuente duplicada)

| clave retirada | la sustituye | español (igual) | inglés (igual) |
|---|---|---|---|
| `finanzas.periodo.mes` | `compartidos.periodo.mes` | Este mes | This month |
| `finanzas.periodo.mes-anterior` | `compartidos.periodo.mes-anterior` | Mes pasado | Last month |
| `finanzas.periodo.trimestre` | `compartidos.periodo.trimestre` | Trimestre | This quarter |
| `finanzas.periodo.trimestre-anterior` | `compartidos.periodo.trimestre-anterior` | Trimestre pasado | Last quarter |
| `finanzas.periodo.anio` | `compartidos.periodo.anio` | Año | This year |
| `finanzas.periodo.rango` | `compartidos.periodo.rango` | Rango | Custom range |

`CLAVE_PERIODO` (`components/demo/finanzas/etiquetas.ts`) apunta a las
compartidas; `TableroPeriodo`, `EstadoCuenta` y `TableroPropuestas` pintan con
ella. Las dos pruebas de paridad con `OPCIONES_PERIODO` (`textos/finanzas.test.ts`
y `textos/compartidos.test.ts`) se conservan.

## 3 · Claves cuyo inglés cambió (unificación entre lotes)

| clave | antes | ahora | por qué |
|---|---|---|---|
| `propuestas.alta.renta.cada-cuando` | How often it is paid | Payment frequency | el mismo campo es «Payment frequency» en la ficha del sitio (`comercial.ficha.periodicidad`) |
| `finanzas.parcialidad.quincenal` | {n} semi-monthly installments | {n} twice-monthly installments | glosario: quincenal → twice a month |
| `finanzas.parcialidad.bimestral` | {n} installments every two months | {n} installments every 2 months | como `compartidos.periodicidad.bimestral` |
| `finanzas.parcialidad.semestral` | {n} semiannual installments | {n} installments every 6 months | como `compartidos.periodicidad.semestral` |
| `finanzas.parcialidad.anual` | {n} annual installments | {n} yearly installments | como `compartidos.periodicidad.anual` («Yearly») |
| `finanzas.listas.vacio` | … billing lock (PO + photos + report) … | … billing lock (PO + proof photos + report) … | las condiciones del candado son «Proof photos» en la ficha de campaña |
| `compartidos.calc.motivo.sin-loop` | … on the screen's page … | … on the screen’s profile … | ficha → profile (glosario de comercial) y apóstrofo |
| 23 de `propuestas.*` y 2 de `compartidos.calc.motivo.pocos-libres.*` | `can't`, `don't`, `screen's`… | `can’t`, `don’t`, `screen’s`… | apóstrofo tipográfico, como campañas, finanzas, comercial y códigos (y como las comillas “ ” de los seis) |

Las 23 de propuestas: `fila.cupon-pendiente.titulo`, `alta.subtitulo.agregar`,
`alta.subtitulo.duplicar`, `alta.error.comision-cien`, `alta.error.tarifa`,
`alta.error.renta`, `alta.error.spots`, `alta.periodo`, `alta.negociacion.texto`,
`alta.fija.titulo`, `calc.horas.horario`, `calc.horario-ilegible`,
`ficha.paquete.quitado`, `ficha.paquete.quitar.ayuda`, `ficha.paquete.ayuda`,
`codigo.pendiente.aviso`, `codigo.quitar.ayuda`, `codigo.ayuda`,
`codigo.sin-permiso`, `condiciones.terminos.ayuda`, `elegir-cliente.subtitulo`,
`publica.no-encontrada` y `documento.sin-permiso` (algunas llevan dos).
`alta.renta.cada-cuando` es la fila de arriba; las otras 23 son solo el apóstrofo.

### Lo que se midió y NO hubo que unificar

El glosario pedía revisar «Booked», «negotiation code», «Internal ref.»,
«Invoice no.», «Proof photos» y «Click». Medido sobre los seis diccionarios:
ningún «Reserved», «promo code», «coupon», «folio» en inglés, «Invoice #» ni
«Tap»/«press». Solo «Proof photos» tenía el desvío de la lista vacía de Finanzas
(fila de arriba).

### Mismo español, distinto inglés, A PROPÓSITO

`lib/i18n/textos/costura.test.ts` exige que el mismo texto español lleve el
mismo inglés en todos los lotes, **salvo** estos ocho, declarados en la prueba
con su motivo:

| español | inglés | motivo |
|---|---|---|
| Folio | Internal ref. / Invoice no. | glosario: propuestas y campañas / factura |
| Vigencia | Validity / Term | propuesta o código / contrato |
| Vencido | Overdue / Expired | pago atrasado / contrato o código caducado |
| Por vencer | Due soon / Expiring soon | cuota / contrato |
| Plazo | Payment terms / Term | cobranza / oferta de renta |
| Horario | Schedule / Operating hours | lo que se manda a DOOHmain / horario del sitio |
| Desde | From / Since | rango de fechas / la competencia está ahí desde |
| Comercial | Commercial / Sales | sección de importes de la campaña / el módulo (como el menú) |

## 4 · Funciones conectadas al idioma

| función | antes | ahora | llamador conectado |
|---|---|---|---|
| `resumenReserva` (`lib/periodos.ts`) | sin `idioma` | `(r, idioma = 'es')`, solo la unidad | `campanas/[id]/page.tsx` |
| `etiquetaFrecuencia` | ya aceptaba | — | `campanas/[id]/page.tsx` |
| `textoHorario`, `textoReproducciones`, `textoOrigenDoohmain` (`lib/doohmain-programacion.ts`) | sin `idioma` | último parámetro `idioma = 'es'` | `ProgramacionDoohmain.tsx`, `SiteFicha.tsx` |
| `etiquetaUnidad` (en lugar de `UNIDAD_LABEL`), `periodicidadLabel` | ya aceptaban | — | `SiteFicha.tsx` (tarifas por unidad, «Cada cuándo se paga», la unidad de la tarifa publicada) |
| `etiquetaPeriodo` (`lib/finanzas-periodo.ts`) | ya aceptaba | — | `TableroPeriodo.tsx`, `EstadoCuenta.tsx` |
| `etiquetaAsignacion`, `opcionesDeAsignacion` | sin `idioma` | último parámetro `idioma = 'es'` | `finanzas/page.tsx` |
| `armarComprobante`, `armarListaFacturas` | sin `idioma` | último parámetro `idioma = 'es'` | `ComprobanteDialog.tsx` (y la fecha con `formatFecha` en inglés), `finanzas/page.tsx` |
| `etiquetaEstadoCodigo`, `avisoFranja` / `AvisoFranjaCMS` | ya aceptaban | — | ya conectados por sus lotes: nada que hacer |

Los demás llamadores (Arrendadores, Inventario, el servidor, el CLI de DOOHmain)
no pasan el idioma y siguen en español: `'es'` por omisión.

## 5 · Pruebas nuevas o reforzadas

| prueba | qué fija | rojo demostrado |
|---|---|---|
| `textos/finanzas.test.ts` | `CLAVE_PERIODO` = `compartidos.periodo.*`, y ninguna `finanzas.periodo.<tipo>` | 1 roja antes del cambio |
| `textos/costura.test.ts` (nueva) | mismo español → mismo inglés entre lotes (8 excepciones declaradas), sin apóstrofo recto, periodicidades del glosario | 3 de 4 rojas antes de unificar |
| `textos/campanas.test.ts` | qué clave usa cada toast de `ValidacionPanel` y `CreativosEnDoohmain` | mutantes: M12 (retirado ↔ bajado), plural de «publicada» invertido, «pausado» ↔ «reanudado»: **mueren los tres** |
| `textos/compartidos.test.ts` | el español de `compartidos.doohmain.*`, `.dia.*` y `.asignacion.*` = el literal del módulo | roja sin el módulo |
| `doohmain-programacion.test.ts`, `periodos.contratacion.test.ts`, `asignacion.test.ts`, `comprobante.test.ts`, `facturas-lista.test.ts` | cada función en inglés, y en español lo de siempre | rojas sin el cambio |
| `pantallas-campanas-finanzas.test.ts` | barrido con el diccionario de compartidos; ya no quita el aviso de la franja ni el horario; frases inglesas de la reserva, la frecuencia, el horario, «Unassigned», la fecha del comprobante, la etiqueta del periodo; estado nuevo con un rango a mano | rojas sin el cambio |
| `pantallas-comercial.test.ts` | barrido con el diccionario de compartidos; ya no quita `textoOrigenDoohmain` ni el « (obligatorio)»; unidades, periodicidad, tarifa publicada y « client.» | 13 textos de compartidos en rojo antes; invertir `cupo.ahora` **muere** |
| `pantallas-propuestas.test.ts`, `pantallas-compartidos.test.ts` | `I18N_VOLCAR=<carpeta>` vuelca el HTML español, como la de campañas | — |

## 6 · Cómo se midió el español

1. Antes de tocar nada, con las fuentes de `integra/ingles`: volcado del HTML
   español de 106 estados (propuestas 23, compartidos 6, campañas y finanzas 54,
   comercial 23).
2. Al terminar, volcado con las fuentes de la costura (107 estados: uno nuevo en
   campañas y finanzas).
3. Con las MISMAS pruebas de la costura y las fuentes de `integra/ingles`
   (`git checkout f2e0a15f -- <las 17 fuentes que cambiaron>`), otro volcado.
4. `diff -rq` entre 2 y 3: **vacío, 107 de 107 idénticos**.
5. Entre 1 y 2: propuestas, compartidos y comercial **idénticos**; en campañas y
   finanzas cambian solo los estados cuyos datos de prueba se ampliaron — la
   ficha (la reserva lleva 12 pases al día: aparece «12 pases al día»), lo que
   se manda a DOOHmain (una fila más: «07:30 a 09:00 · lun, mar» y «Las que
   quepan») y los dos últimos, que se desplazan un número por el estado nuevo
   (`cmp` idénticos con su nuevo índice).

## 7 · Lo que sigue en español (y por qué)

- **Componentes compartidos sin traducir, y sin función que conectar:**
  `PipelineView`/`Stepper`, `KPICard`, `EmptyState`, `ConfirmDialog` (su
  «Cancelar»), `PasoContrasena`, `PagosRentaCard`, `CompromisoRentaCard`,
  `SlotsBadge`, `ClientesBadge`, `CalendarioDisponibilidad`, `FotoUploaderMock`,
  `RejillaDialog`. Traducirlos es un lote nuevo, no una costura.
- **Motivos de `lib/` que no aceptan idioma y que también usa el servidor:**
  `lib/negociacion.ts` (aviso de «en revisión / perdido», `title` de los pasos),
  `interpretarUbicacion`, `motivoHorarioInvalido` (`lib/doohmain-programacion.ts`,
  lo comparte la API) y los avisos de franja que manda el servidor. Van con los
  mensajes del servidor (I18N-05).
- **El CSV del estado de cuenta y su nombre de archivo**: es un archivo que se
  descarga, no pantalla; decidir su idioma es otra decisión.
- **El dinero** (`formatMonto`): la rama de la moneda.

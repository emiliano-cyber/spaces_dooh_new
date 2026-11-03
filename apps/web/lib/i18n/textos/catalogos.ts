// ============================================================================
//  lib/i18n/textos/catalogos.ts — LOS TEXTOS DE LOS CATALOGOS DE PRECIO
//  (paquetes cerrados, franjas y temporadas, horario de transmision, tarifas
//  por franja de una pantalla, descuentos por volumen).
// ----------------------------------------------------------------------------
//  3.ª oleada del ingles (2026-11-02), lote «operaciones, clientes y
//  catalogos». Mismas reglas que `textos/propuestas.ts`: claves en espanol,
//  espanol LITERAL, `EN_CATALOGOS` como `Record` (una clave que falte no
//  compila), ni dinero ni moneda, frases con negritas ENTERAS y con huecos.
//
//  Los titulos de las tres paginas son los del menu (`nav.paquetes`,
//  `nav.franjas-y-temporadas`, `nav.descuentos-por-volumen`): la pagina se
//  llama como la entrada que lleva a ella, en los dos idiomas.
//
//  `catalogos.motivo.*` son los motivos de rechazo de `lib/paquete.ts`,
//  `lib/rejilla.ts` y `lib/volumen.ts`. El ESPANOL sigue saliendo del literal de
//  cada modulo (el servidor los manda tal cual) y `textos/catalogos.test.ts`
//  exige que el diccionario lo reproduzca letra por letra —«numero» y «mas» sin
//  acento incluidos, que es como los escribe el modulo—.
//
//  GLOSARIO DEL LOTE: paquete cerrado → bundle · precio cerrado → fixed price ·
//  a prorrata → pro rata · reparto → split · parte del paquete → bundle share ·
//  franja → daypart · temporada → season · dar de baja / dada de baja →
//  deactivate / Deactivated (es baja LOGICA: «delete» prometeria lo que no pasa) · tramo →
//  tier · escalon → step · escala plana → flat scale · rejilla → rate grid ·
//  programar (el horario) → schedule · horario de transmision → broadcast
//  schedule · tarifa de lista → list rate. Porcentajes sin espacio («10%»).
// ============================================================================

export const ES_CATALOGOS = {
  // ── Comunes del lote ──
  'catalogos.comun.nombre': 'Nombre',
  'catalogos.comun.desde': 'Desde',
  'catalogos.comun.hasta': 'Hasta',
  'catalogos.comun.estado': 'Estado',
  'catalogos.comun.anadir': 'Añadir',
  'catalogos.comun.eliminar': 'Eliminar',
  'catalogos.comun.activa': 'Activa',
  'catalogos.comun.dada-de-baja': 'Dada de baja',
  'catalogos.comun.dar-de-baja': 'Dar de baja',
  'catalogos.comun.unidad': 'Unidad',
  'catalogos.comun.franja': 'Franja',
  'catalogos.comun.temporada': 'Temporada',
  'catalogos.comun.tarifa': 'Tarifa',
  'catalogos.comun.todo-el-dia': 'Todo el día',
  'catalogos.comun.todo-el-ano': 'Todo el año',
  'catalogos.comun.no-guardar': 'No se pudo guardar',
  'catalogos.comun.no-eliminar': 'No se pudo eliminar',

  // ── Paquetes cerrados ──
  'catalogos.paquetes.descripcion':
    'Un conjunto de pantallas con un precio del conjunto. Sustituye la suma de sus tarifas de lista; no la descuenta.',
  'catalogos.paquetes.no-leer': 'No se pudo leer el catálogo de paquetes',
  'catalogos.paquetes.no-guardar': 'No se pudo guardar el paquete',
  'catalogos.paquetes.no-cambiar': 'No se pudo cambiar el paquete',
  'catalogos.paquetes.no-eliminar': 'No se pudo eliminar el paquete',
  'catalogos.paquetes.cargando': 'Cargando los paquetes',
  'catalogos.paquetes.aviso.sustituye':
    'El precio del paquete SUSTITUYE la suma de las tarifas de lista: no la descuenta, la reemplaza.',
  'catalogos.paquetes.aviso.da-igual': 'Da igual lo que sumen las pantallas — se cobra el precio del paquete.',
  'catalogos.paquetes.aviso.volumen':
    'Por eso un paquete {negrita} (su precio ya lo lleva dentro) ni código de negociación, salvo que marques la casilla de abajo. El descuento comercial de la propuesta sí se sigue aplicando encima.',
  'catalogos.paquetes.aviso.volumen.negrita': 'no admite descuento por volumen',
  'catalogos.paquetes.aviso.quitar': 'Y {negrita}: el reparto se recalcula entre las que quedan y la propuesta lo avisa.',
  'catalogos.paquetes.aviso.quitar.negrita': 'quitar una pantalla de una propuesta ya cotizada NO baja el precio',
  'catalogos.paquetes.lista.titulo': 'Paquetes de la organización',
  'catalogos.paquetes.lista.subtitulo': 'Se reparte a prorrata de la tarifa de lista',
  'catalogos.paquetes.lista.explicacion':
    'El precio se reparte entre las pantallas {prorrata}, y la suma de las partes da el precio del paquete {peso}. Ese reparto es el ingreso que el reporte de rentabilidad le atribuye a cada pantalla.',
  'catalogos.paquetes.lista.explicacion.prorrata': 'a prorrata de su tarifa de lista',
  'catalogos.paquetes.lista.explicacion.peso': 'con exactitud',
  'catalogos.paquetes.col.paquete': 'Paquete',
  'catalogos.paquetes.col.pantallas': 'Pantallas',
  'catalogos.paquetes.col.precio': 'Precio cerrado',
  'catalogos.paquetes.col.codigos': '¿Códigos?',
  'catalogos.paquetes.col.en-uso': 'En uso',
  'catalogos.paquetes.vacio':
    'Todavía no hay ninguno. Sin paquetes, todo se vende al precio de tarifa — que es exactamente como funciona hoy.',
  'catalogos.paquetes.activo': 'Activo',
  'catalogos.paquetes.desactivado': 'Desactivado',
  'catalogos.paquetes.pantallas.uno': '{n} pantalla',
  'catalogos.paquetes.pantallas.otros': '{n} pantallas',
  'catalogos.paquetes.admite-codigo': 'Admite código',
  'catalogos.paquetes.precio-final': 'Precio final',
  'catalogos.paquetes.en-uso.title': 'Propuestas que aplican este paquete',
  'catalogos.paquetes.en-uso': 'En uso · {n}',
  'catalogos.paquetes.desactivar': 'Desactivar',
  'catalogos.paquetes.activar': 'Activar',
  'catalogos.paquetes.desactivar.title':
    'Desactivar conserva la definición y deja de poder venderse. Lo ya cotizado y lo ya aprobado no se mueven.',
  'catalogos.paquetes.eliminar.title':
    'Eliminar: ninguna venta se mueve, porque su precio ya está copiado en cada propuesta. Lo que se pierde es saber de qué paquete salió.',
  'catalogos.paquetes.nuevo': 'Nuevo paquete',
  'catalogos.paquetes.nombre.aria': 'Nombre del paquete',
  'catalogos.paquetes.nombre.placeholder': 'p. ej. Paquete Periférico',
  'catalogos.paquetes.precio': 'Precio del conjunto (cantidad entera, sin centavos)',
  'catalogos.paquetes.precio.aria': 'Precio cerrado del paquete',
  'catalogos.paquetes.precio.placeholder': 'p. ej. {ejemplo}',
  'catalogos.paquetes.admite-codigo-encima': 'Admite código de negociación encima',
  'catalogos.paquetes.pantallas-del-paquete': 'Pantallas del paquete',
  'catalogos.paquetes.minimo':
    ' (mínimo 2). Una propuesta solo puede aplicar este paquete si tiene {exactamente} estas pantallas.',
  'catalogos.paquetes.minimo.exactamente': 'exactamente',
  'catalogos.paquetes.elegidas.uno': '{n} elegida',
  'catalogos.paquetes.elegidas.otros': '{n} elegidas',
  'catalogos.paquetes.de-lista': '{monto} de lista',
  'catalogos.paquetes.resumen.lista': 'Lista {monto}',
  'catalogos.paquetes.resumen.paquete': 'Paquete {monto}',
  'catalogos.paquetes.resumen.deja-de-cobrar': 'se deja de cobrar {monto}',
  'catalogos.paquetes.resumen.por-encima': 'se cobra {monto} POR ENCIMA de la lista',
  'catalogos.paquetes.reparto.intro':
    'Así se repartiría entre las pantallas — y esto es lo que el reporte de rentabilidad le atribuirá a cada una:',
  'catalogos.paquetes.reparto.pantalla': 'Pantalla',
  'catalogos.paquetes.reparto.lista': 'Lista',
  'catalogos.paquetes.reparto.parte': 'Parte del paquete',
  'catalogos.paquetes.reparto.suma': 'Suma de las partes {cuadra}',
  'catalogos.paquetes.reparto.cuadra': '— cuadra exacto',
  'catalogos.paquetes.crear': 'Crear paquete',

  // ── Franjas y temporadas ──
  'catalogos.rejilla.descripcion':
    'Las dos dimensiones de la tarifa: la hora del día y la época del año. Se capturan una vez y valen para todo el inventario.',
  'catalogos.rejilla.no-leer': 'No se pudo leer el catálogo',
  'catalogos.rejilla.no-dar-de-baja': 'No se pudo dar de baja',
  'catalogos.rejilla.cargando': 'Cargando el catálogo',
  'catalogos.rejilla.candado.titulo': 'Confirma con tu contraseña',
  'catalogos.rejilla.candado.subtitulo':
    'Franjas y temporadas son precio: tu organización pide la contraseña para cambiarlas.',
  'catalogos.rejilla.candado.confirmar': 'Confirmar y guardar',
  'catalogos.rejilla.franjas.titulo': 'Franjas horarias',
  'catalogos.rejilla.franjas.subtitulo': 'Fin exclusivo · sin solapes',
  'catalogos.rejilla.franjas.explicacion':
    'El fin es {exclusivo}: 06:00–10:00 y 10:00–14:00 se tocan y no se pisan. Dos franjas no pueden solaparse — si pudieran, el precio de un spot a las 09:30 dependería de un desempate que nadie decidió.',
  'catalogos.rejilla.franjas.explicacion.exclusivo': 'exclusivo',
  'catalogos.rejilla.col.orden': 'Orden',
  'catalogos.rejilla.franjas.vacio':
    'Todavía no hay ninguna. Sin franjas, todo se vende con la tarifa base — que es exactamente como funciona hoy.',
  'catalogos.rejilla.dar-de-baja.title': 'Dar de baja: deja de ofrecerse, y lo ya contratado sigue en pie',
  'catalogos.rejilla.franja.nombre.aria': 'Nombre de la franja',
  'catalogos.rejilla.franja.nombre.placeholder': 'p. ej. Prime',
  'catalogos.rejilla.franja.inicio.aria': 'Hora de inicio',
  'catalogos.rejilla.franja.fin.aria': 'Hora de fin',
  'catalogos.rejilla.temporadas.titulo': 'Temporadas',
  'catalogos.rejilla.temporadas.subtitulo': 'Fechas con año · ambos extremos entran',
  'catalogos.rejilla.temporadas.explicacion':
    'Fechas {concretas}, con año: «Buen Fin 2026» y «Buen Fin 2027» son dos temporadas, porque las fechas cambian cada año. Ambos extremos entran. Tampoco pueden solaparse: si «Diciembre» y «Buen Fin» se pisan, hay que decidir qué precio manda esos días.',
  'catalogos.rejilla.temporadas.explicacion.concretas': 'concretas',
  'catalogos.rejilla.temporadas.vacio': 'Todavía no hay ninguna.',
  'catalogos.rejilla.temporada.nombre.aria': 'Nombre de la temporada',
  'catalogos.rejilla.temporada.nombre.placeholder': 'p. ej. Buen Fin 2026',
  'catalogos.rejilla.temporada.inicio.aria': 'Fecha de inicio',
  'catalogos.rejilla.temporada.fin.aria': 'Fecha de fin',

  // ── Horario de transmision (programar campañas por franja) ──
  'catalogos.programacion.no-leer': 'No se pudo leer la programación',
  'catalogos.programacion.no-programar': 'No se pudo programar',
  'catalogos.programacion.cargando': 'Cargando la programación',
  'catalogos.programacion.titulo': 'Horario de transmisión',
  'catalogos.programacion.subtitulo': 'No cambia ningún precio',
  'catalogos.programacion.explicacion':
    'En qué franja {negrita} cada campaña. No cambia ningún precio: lo vendido ya está en la campaña desde la propuesta. Puedes marcar varias campañas y programarlas de una vez; si alguna no se puede, no se programa ninguna.',
  'catalogos.programacion.explicacion.negrita': 'se transmite',
  'catalogos.programacion.sin-permiso':
    'Solo el gerente de ventas, el director comercial y la dirección pueden programar el horario. Aquí ves cómo está.',
  'catalogos.programacion.sin-franjas': 'Da de alta al menos una franja arriba para poder programar campañas en ella.',
  'catalogos.programacion.campanas.uno': '{n} campaña',
  'catalogos.programacion.campanas.otros': '{n} campañas',
  'catalogos.programacion.ninguna': 'Ninguna campaña se transmite en esta franja.',
  'catalogos.programacion.quitar.aria': 'Quitar {campana} de {franja}',
  'catalogos.programacion.quitar.title': 'Quitar de esta franja (no toca lo vendido)',
  'catalogos.programacion.programar-en': 'Programar campañas en {franja}',
  'catalogos.programacion.marcadas.uno': ' ({n} marcada)',
  'catalogos.programacion.marcadas.otros': ' ({n} marcadas)',
  'catalogos.programacion.hoy-en': '(hoy en {franja})',
  'catalogos.programacion.boton': 'Programar {n} en {franja}',
  'catalogos.programacion.boton.vacio': 'Programar  en {franja}',

  // ── Tarifas por franja y temporada de UNA pantalla ──
  'catalogos.tarifas.no-leer': 'No se pudo leer la rejilla',
  'catalogos.tarifas.guardadas': 'Tarifas por franja guardadas',
  'catalogos.tarifas.no-guardar': 'No se pudieron guardar las tarifas por franja',
  'catalogos.tarifas.titulo': 'Tarifas por franja y temporada',
  'catalogos.tarifas.guardando': 'Guardando…',
  'catalogos.tarifas.guardar': 'Guardar tarifas',
  'catalogos.tarifas.invalida':
    'Hay una tarifa en rojo que no se entiende: la coma separa miles y el punto, decimales ({ejemplo}).',
  'catalogos.tarifas.sin-catalogo':
    'Esta organización todavía no tiene franjas ni temporadas. Se declaran una sola vez en {pantalla}, y valen para todo el inventario.',
  'catalogos.tarifas.dispersa':
    'Solo hace falta capturar las combinaciones que tengan un precio distinto. Lo que no esté aquí se cobra con la tarifa por unidad de siempre — la rejilla no obliga a llenar nada.',
  'catalogos.tarifas.tarifa-de.aria': 'Tarifa de {unidad}',
  'catalogos.tarifas.conservar': 'Conservar',
  'catalogos.tarifas.quitar': 'Quitar',
  'catalogos.tarifas.nueva.unidad.aria': 'Unidad de la nueva tarifa',
  'catalogos.tarifas.nueva.unidad': 'Unidad…',
  'catalogos.tarifas.nueva.franja.aria': 'Franja de la nueva tarifa',
  'catalogos.tarifas.nueva.temporada.aria': 'Temporada de la nueva tarifa',
  'catalogos.tarifas.nueva.tarifa.aria': 'Tarifa de la nueva fila',

  // ── Descuentos por volumen ──
  'catalogos.volumen.descripcion':
    'Qué descuento gana quien compra mucho. Se captura una vez por unidad de venta y vale para todo el inventario.',
  'catalogos.volumen.no-leer': 'No se pudo leer la escala',
  'catalogos.volumen.cargando': 'Cargando la escala',
  'catalogos.volumen.aviso.todas':
    'El descuento se aplica sobre TODAS las unidades, no solo sobre las que pasan del umbral.',
  'catalogos.volumen.aviso.ejemplo':
    '«A partir de 50 spots, 10 %» quiere decir que quien compra 50 paga los 50 con el 10 % menos. Consecuencia: quien compra 49 paga más que quien compra 50, y el salto puede ser mayor que el precio de una unidad.',
  'catalogos.volumen.aviso.compone':
    'Y se {compone} con el descuento comercial: un 20 % aquí y un 20 % en la propuesta dejan al cliente pagando el {pct}, no el 60 %.',
  'catalogos.volumen.aviso.compone.negrita': 'compone',
  'catalogos.volumen.aviso.compone.pct': '64 %',
  'catalogos.volumen.tramos.titulo': 'Tramos por unidad de venta',
  'catalogos.volumen.tramos.subtitulo': 'Cada unidad tiene su propia escala',
  'catalogos.volumen.escala.title': 'El descuento del tramo alcanzado se aplica a TODAS las unidades',
  'catalogos.volumen.escala': 'Escala plana (volumen)',
  'catalogos.volumen.explicacion':
    'Cada unidad tiene su propia escala, porque 50 spots y 50 meses no son la misma compra. Los tramos tienen que {crecer}: comprar más nunca puede descontar menos.',
  'catalogos.volumen.explicacion.crecer': 'crecer',
  'catalogos.volumen.col.a-partir': 'A partir de',
  'catalogos.volumen.col.descuento': 'Descuento',
  'catalogos.volumen.vacio':
    'Todavía no hay ninguno. Sin tramos, todo se vende al precio de tarifa — que es exactamente como funciona hoy.',
  'catalogos.volumen.tramos.uno': ' · {n} tramo',
  'catalogos.volumen.tramos.otros': ' · {n} tramos',
  'catalogos.volumen.escalon': 'Escalón {n}',
  'catalogos.volumen.desde': 'desde {cantidad} {unidad}',
  'catalogos.volumen.pct': '→ {pct} %',
  'catalogos.volumen.eliminar.title':
    'Eliminar: deja de aplicarse a partir de ahora. Lo ya cotizado y lo ya aprobado no se mueven.',
  'catalogos.volumen.unidad.aria': 'Unidad de venta',
  'catalogos.volumen.cantidad.aria': 'A partir de qué cantidad',
  'catalogos.volumen.cantidad.placeholder': 'p. ej. 50',
  'catalogos.volumen.pct.aria': 'Descuento por ciento',
  'catalogos.volumen.pct.placeholder': 'p. ej. 10',
  'catalogos.volumen.anadir': 'Añadir tramo',

  // ── Motivos de rechazo (lib/paquete.ts, lib/rejilla.ts, lib/volumen.ts) ──
  'catalogos.motivo.paquete.nombre': 'El paquete necesita un nombre.',
  'catalogos.motivo.paquete.nombre-largo': 'El nombre del paquete no puede pasar de 120 caracteres.',
  'catalogos.motivo.paquete.precio-numero': 'El precio del paquete tiene que ser un numero.',
  'catalogos.motivo.paquete.precio-cero':
    'El precio de un paquete tiene que ser mayor que 0: un paquete gratis no es un paquete.',
  'catalogos.motivo.paquete.precio-entero':
    'El precio del paquete tiene que ser una cantidad entera: el reparto entre las pantallas no admite centavos.',
  'catalogos.motivo.paquete.dos-pantallas':
    'Un paquete necesita al menos 2 pantallas; con una sola, eso es una tarifa y va en la ficha de la pantalla.',
  'catalogos.motivo.paquete.repetida': 'Hay una pantalla repetida en el paquete.',
  'catalogos.motivo.franja.nombre': 'La franja necesita un nombre.',
  'catalogos.motivo.franja.hora': 'Hora no válida en "{nombre}": se escribe HH:MM en 24 horas, de 00:00 a 23:59.',
  'catalogos.motivo.franja.misma-hora': 'La franja "{nombre}" empieza y termina a la misma hora: no cubre nada.',
  'catalogos.motivo.franja.solape':
    'La franja "{nombre}" ({inicio}–{fin}) se solapa con "{otra}" ({otraInicio}–{otraFin}).',
  'catalogos.motivo.temporada.nombre': 'La temporada necesita un nombre.',
  'catalogos.motivo.temporada.fecha': 'Fecha no válida en "{nombre}": se escribe AAAA-MM-DD.',
  'catalogos.motivo.temporada.al-reves': 'La temporada "{nombre}" termina antes de empezar.',
  'catalogos.motivo.temporada.solape':
    'La temporada "{nombre}" ({desde} a {hasta}) se solapa con "{otra}" ({otraDesde} a {otraHasta}).',
  'catalogos.motivo.tramo.unidad': 'El tramo necesita una unidad de venta.',
  'catalogos.motivo.tramo.cantidad-entera': 'La cantidad desde la que aplica tiene que ser un numero entero.',
  'catalogos.motivo.tramo.sin-fracciones':
    'La cantidad desde la que aplica tiene que ser un numero entero: no se venden fracciones de unidad.',
  'catalogos.motivo.tramo.desde-dos':
    'Un tramo de volumen empieza desde 2 unidades o mas; "desde 1" seria bajar el tarifario entero.',
  'catalogos.motivo.tramo.pct-numero': 'El descuento tiene que ser un numero.',
  'catalogos.motivo.tramo.pct-cero': 'El descuento de un tramo tiene que ser mayor que 0 %: un tramo al 0 % no hace nada.',
  'catalogos.motivo.tramo.pct-cien': 'El descuento de un tramo no puede pasar del 100 %.',
  'catalogos.motivo.tramo.mismo-umbral':
    'Ya hay un tramo desde {n} para esta unidad ({pct} %). Dos tramos con el mismo umbral son dos precios para la misma compra.',
  'catalogos.motivo.tramo.mas-y-menos':
    'No se puede comprar mas y descontar menos: el tramo desde {otroDesde} ya da {otroPct} % y este, desde {n}, daria {pct} %.',
  'catalogos.motivo.tramo.menos-y-mas':
    'No se puede comprar mas y descontar menos: el tramo desde {otroDesde} da {otroPct} % y este, desde {n}, daria {pct} %.',
} as const

export type ClaveCatalogos = keyof typeof ES_CATALOGOS

export const EN_CATALOGOS: Record<ClaveCatalogos, string> = {
  // ── Comunes del lote ──
  'catalogos.comun.nombre': 'Name',
  'catalogos.comun.desde': 'From',
  'catalogos.comun.hasta': 'To',
  'catalogos.comun.estado': 'Status',
  'catalogos.comun.anadir': 'Add',
  'catalogos.comun.eliminar': 'Delete',
  'catalogos.comun.activa': 'Active',
  'catalogos.comun.dada-de-baja': 'Deactivated',
  'catalogos.comun.dar-de-baja': 'Deactivate',
  'catalogos.comun.unidad': 'Unit',
  'catalogos.comun.franja': 'Daypart',
  'catalogos.comun.temporada': 'Season',
  'catalogos.comun.tarifa': 'Rate',
  'catalogos.comun.todo-el-dia': 'All day',
  'catalogos.comun.todo-el-ano': 'All year',
  'catalogos.comun.no-guardar': 'Could not save',
  'catalogos.comun.no-eliminar': 'Could not delete',

  // ── Paquetes cerrados ──
  'catalogos.paquetes.descripcion':
    'A set of screens with a price for the whole set. It replaces the sum of their list rates; it does not discount it.',
  'catalogos.paquetes.no-leer': 'Could not load the bundle catalog',
  'catalogos.paquetes.no-guardar': 'Could not save the bundle',
  'catalogos.paquetes.no-cambiar': 'Could not change the bundle',
  'catalogos.paquetes.no-eliminar': 'Could not delete the bundle',
  'catalogos.paquetes.cargando': 'Loading bundles',
  'catalogos.paquetes.aviso.sustituye':
    'The bundle price REPLACES the sum of the list rates: it does not discount it, it replaces it.',
  'catalogos.paquetes.aviso.da-igual': 'Whatever the screens add up to, the bundle price is what gets billed.',
  'catalogos.paquetes.aviso.volumen':
    'That is why a bundle {negrita} (its price already includes it), nor a negotiation code unless you check the box below. The proposal’s commercial discount still applies on top.',
  'catalogos.paquetes.aviso.volumen.negrita': 'does not take a volume discount',
  'catalogos.paquetes.aviso.quitar':
    'And {negrita}: the split is recalculated among the remaining screens and the proposal says so.',
  'catalogos.paquetes.aviso.quitar.negrita': 'removing a screen from an already quoted proposal does NOT lower the price',
  'catalogos.paquetes.lista.titulo': 'Bundles in your organization',
  'catalogos.paquetes.lista.subtitulo': 'Split pro rata by list rate',
  'catalogos.paquetes.lista.explicacion':
    'The price is split among the screens {prorrata}, and the shares add up to the bundle price {peso}. That split is the revenue the profitability report assigns to each screen.',
  'catalogos.paquetes.lista.explicacion.prorrata': 'in proportion to their list rate',
  'catalogos.paquetes.lista.explicacion.peso': 'exactly',
  'catalogos.paquetes.col.paquete': 'Bundle',
  'catalogos.paquetes.col.pantallas': 'Screens',
  'catalogos.paquetes.col.precio': 'Fixed price',
  'catalogos.paquetes.col.codigos': 'Negotiation codes',
  'catalogos.paquetes.col.en-uso': 'In use',
  'catalogos.paquetes.vacio':
    'None yet. Without bundles, everything sells at the list rate — which is exactly how it works today.',
  'catalogos.paquetes.activo': 'Active',
  'catalogos.paquetes.desactivado': 'Deactivated',
  'catalogos.paquetes.pantallas.uno': '{n} screen',
  'catalogos.paquetes.pantallas.otros': '{n} screens',
  'catalogos.paquetes.admite-codigo': 'Takes negotiation codes',
  'catalogos.paquetes.precio-final': 'Final price',
  'catalogos.paquetes.en-uso.title': 'Proposals that use this bundle',
  'catalogos.paquetes.en-uso': 'In use · {n}',
  'catalogos.paquetes.desactivar': 'Deactivate',
  'catalogos.paquetes.activar': 'Activate',
  'catalogos.paquetes.desactivar.title':
    'Deactivating keeps the definition and stops it from being sold. What is already quoted or approved does not change.',
  'catalogos.paquetes.eliminar.title':
    'Delete: no sale changes, because its price is already copied into each proposal. What is lost is knowing which bundle it came from.',
  'catalogos.paquetes.nuevo': 'New bundle',
  'catalogos.paquetes.nombre.aria': 'Bundle name',
  'catalogos.paquetes.nombre.placeholder': 'e.g. Outer ring bundle',
  'catalogos.paquetes.precio': 'Price for the set (whole amount, no cents)',
  'catalogos.paquetes.precio.aria': 'Bundle fixed price',
  'catalogos.paquetes.precio.placeholder': 'e.g. {ejemplo}',
  'catalogos.paquetes.admite-codigo-encima': 'Takes a negotiation code on top',
  'catalogos.paquetes.pantallas-del-paquete': 'Bundle screens',
  'catalogos.paquetes.minimo':
    ' (at least 2). A proposal can only use this bundle if it has {exactamente} these screens.',
  'catalogos.paquetes.minimo.exactamente': 'exactly',
  'catalogos.paquetes.elegidas.uno': '{n} selected',
  'catalogos.paquetes.elegidas.otros': '{n} selected',
  'catalogos.paquetes.de-lista': '{monto} at list',
  'catalogos.paquetes.resumen.lista': 'List {monto}',
  'catalogos.paquetes.resumen.paquete': 'Bundle {monto}',
  'catalogos.paquetes.resumen.deja-de-cobrar': '{monto} below list',
  'catalogos.paquetes.resumen.por-encima': '{monto} ABOVE list',
  'catalogos.paquetes.reparto.intro':
    'This is how it would be split among the screens — and what the profitability report will assign to each one:',
  'catalogos.paquetes.reparto.pantalla': 'Screen',
  'catalogos.paquetes.reparto.lista': 'List',
  'catalogos.paquetes.reparto.parte': 'Bundle share',
  'catalogos.paquetes.reparto.suma': 'Sum of the shares {cuadra}',
  'catalogos.paquetes.reparto.cuadra': '— adds up exactly',
  'catalogos.paquetes.crear': 'Create bundle',

  // ── Franjas y temporadas ──
  'catalogos.rejilla.descripcion':
    'The two dimensions of the rate: the time of day and the time of year. They are entered once and apply to the whole inventory.',
  'catalogos.rejilla.no-leer': 'Could not load the catalog',
  'catalogos.rejilla.no-dar-de-baja': 'Could not deactivate',
  'catalogos.rejilla.cargando': 'Loading the catalog',
  'catalogos.rejilla.candado.titulo': 'Confirm with your password',
  'catalogos.rejilla.candado.subtitulo':
    'Dayparts and seasons are pricing: your organization requires your password to change them.',
  'catalogos.rejilla.candado.confirmar': 'Confirm and save',
  'catalogos.rejilla.franjas.titulo': 'Dayparts',
  'catalogos.rejilla.franjas.subtitulo': 'End is exclusive · no overlaps',
  'catalogos.rejilla.franjas.explicacion':
    'The end is {exclusivo}: 06:00–10:00 and 10:00–14:00 touch without overlapping. Two dayparts cannot overlap — if they could, the price of a spot at 09:30 would depend on a tie-break nobody decided.',
  'catalogos.rejilla.franjas.explicacion.exclusivo': 'exclusive',
  'catalogos.rejilla.col.orden': 'Order',
  'catalogos.rejilla.franjas.vacio':
    'None yet. Without dayparts, everything sells at the base rate — which is exactly how it works today.',
  'catalogos.rejilla.dar-de-baja.title': 'Deactivate: it is no longer offered, and what is already booked stays in place',
  'catalogos.rejilla.franja.nombre.aria': 'Daypart name',
  'catalogos.rejilla.franja.nombre.placeholder': 'e.g. Prime',
  'catalogos.rejilla.franja.inicio.aria': 'Start time',
  'catalogos.rejilla.franja.fin.aria': 'End time',
  'catalogos.rejilla.temporadas.titulo': 'Seasons',
  'catalogos.rejilla.temporadas.subtitulo': 'Dates with year · both ends included',
  'catalogos.rejilla.temporadas.explicacion':
    '{concretas} dates, with year: “Buen Fin 2026” and “Buen Fin 2027” are two seasons, because the dates change every year. Both ends are included. They cannot overlap either: if “December” and “Buen Fin” overlap, you have to decide which price applies on those days.',
  'catalogos.rejilla.temporadas.explicacion.concretas': 'Specific',
  'catalogos.rejilla.temporadas.vacio': 'None yet.',
  'catalogos.rejilla.temporada.nombre.aria': 'Season name',
  'catalogos.rejilla.temporada.nombre.placeholder': 'e.g. Buen Fin 2026',
  'catalogos.rejilla.temporada.inicio.aria': 'Start date',
  'catalogos.rejilla.temporada.fin.aria': 'End date',

  // ── Horario de transmision ──
  'catalogos.programacion.no-leer': 'Could not load the schedule',
  'catalogos.programacion.no-programar': 'Could not schedule',
  'catalogos.programacion.cargando': 'Loading the schedule',
  'catalogos.programacion.titulo': 'Broadcast schedule',
  'catalogos.programacion.subtitulo': 'No price changes',
  'catalogos.programacion.explicacion':
    'Which daypart each campaign {negrita} in. No price changes: what was sold already came into the campaign from the proposal. You can select several campaigns and schedule them at once; if any of them can’t be scheduled, none is.',
  'catalogos.programacion.explicacion.negrita': 'airs',
  'catalogos.programacion.sin-permiso':
    'Only the sales manager, the sales director and management can schedule broadcasts. You can view the current schedule here.',
  'catalogos.programacion.sin-franjas': 'Add at least one daypart above to schedule campaigns in it.',
  'catalogos.programacion.campanas.uno': '{n} campaign',
  'catalogos.programacion.campanas.otros': '{n} campaigns',
  'catalogos.programacion.ninguna': 'No campaign airs in this daypart.',
  'catalogos.programacion.quitar.aria': 'Remove {campana} from {franja}',
  'catalogos.programacion.quitar.title': 'Remove from this daypart (doesn’t affect what was sold)',
  'catalogos.programacion.programar-en': 'Schedule campaigns in {franja}',
  'catalogos.programacion.marcadas.uno': ' ({n} selected)',
  'catalogos.programacion.marcadas.otros': ' ({n} selected)',
  'catalogos.programacion.hoy-en': '(now in {franja})',
  'catalogos.programacion.boton': 'Schedule {n} in {franja}',
  'catalogos.programacion.boton.vacio': 'Schedule in {franja}',

  // ── Tarifas por franja y temporada de UNA pantalla ──
  'catalogos.tarifas.no-leer': 'Could not load the rate grid',
  'catalogos.tarifas.guardadas': 'Daypart rates saved',
  'catalogos.tarifas.no-guardar': 'Could not save the daypart rates',
  'catalogos.tarifas.titulo': 'Rates by daypart and season',
  'catalogos.tarifas.guardando': 'Saving…',
  'catalogos.tarifas.guardar': 'Save rates',
  'catalogos.tarifas.invalida':
    'A rate in red cannot be read: the comma separates thousands and the period, decimals ({ejemplo}).',
  'catalogos.tarifas.sin-catalogo':
    'This organization has no dayparts or seasons yet. They are set up once in {pantalla}, and apply to the whole inventory.',
  'catalogos.tarifas.dispersa':
    'You only need to enter the combinations that have a different price. Anything not here is billed at the usual per-unit rate — the grid doesn’t require filling anything in.',
  'catalogos.tarifas.tarifa-de.aria': 'Rate for {unidad}',
  'catalogos.tarifas.conservar': 'Keep',
  'catalogos.tarifas.quitar': 'Remove',
  'catalogos.tarifas.nueva.unidad.aria': 'Unit for the new rate',
  'catalogos.tarifas.nueva.unidad': 'Unit…',
  'catalogos.tarifas.nueva.franja.aria': 'Daypart for the new rate',
  'catalogos.tarifas.nueva.temporada.aria': 'Season for the new rate',
  'catalogos.tarifas.nueva.tarifa.aria': 'Rate for the new row',

  // ── Descuentos por volumen ──
  'catalogos.volumen.descripcion':
    'The discount a high-volume buyer gets. It is entered once per sales unit and applies to the whole inventory.',
  'catalogos.volumen.no-leer': 'Could not load the scale',
  'catalogos.volumen.cargando': 'Loading the scale',
  'catalogos.volumen.aviso.todas': 'The discount applies to ALL units, not only to those above the threshold.',
  'catalogos.volumen.aviso.ejemplo':
    '“From 50 spots, 10%” means that whoever buys 50 pays for all 50 at 10% off. Consequence: whoever buys 49 pays more than whoever buys 50, and the jump can be larger than the price of one unit.',
  'catalogos.volumen.aviso.compone':
    'And it {compone} with the commercial discount: 20% here and 20% on the proposal leave the client paying {pct}, not 60%.',
  'catalogos.volumen.aviso.compone.negrita': 'compounds',
  'catalogos.volumen.aviso.compone.pct': '64%',
  'catalogos.volumen.tramos.titulo': 'Tiers by sales unit',
  'catalogos.volumen.tramos.subtitulo': 'Each unit has its own scale',
  'catalogos.volumen.escala.title': 'The discount of the tier reached applies to ALL units',
  'catalogos.volumen.escala': 'Flat scale (volume)',
  'catalogos.volumen.explicacion':
    'Each unit has its own scale, because 50 spots and 50 months are not the same purchase. Tiers have to {crecer}: buying more can never discount less.',
  'catalogos.volumen.explicacion.crecer': 'increase',
  'catalogos.volumen.col.a-partir': 'From',
  'catalogos.volumen.col.descuento': 'Discount',
  'catalogos.volumen.vacio':
    'None yet. Without tiers, everything sells at the list rate — which is exactly how it works today.',
  'catalogos.volumen.tramos.uno': ' · {n} tier',
  'catalogos.volumen.tramos.otros': ' · {n} tiers',
  'catalogos.volumen.escalon': 'Step {n}',
  'catalogos.volumen.desde': 'from {cantidad} {unidad}',
  'catalogos.volumen.pct': '→ {pct}%',
  'catalogos.volumen.eliminar.title':
    'Delete: it stops applying from now on. What is already quoted or approved does not change.',
  'catalogos.volumen.unidad.aria': 'Sales unit',
  'catalogos.volumen.cantidad.aria': 'From what quantity',
  'catalogos.volumen.cantidad.placeholder': 'e.g. 50',
  'catalogos.volumen.pct.aria': 'Discount percentage',
  'catalogos.volumen.pct.placeholder': 'e.g. 10',
  'catalogos.volumen.anadir': 'Add tier',

  // ── Motivos de rechazo ──
  'catalogos.motivo.paquete.nombre': 'The bundle needs a name.',
  'catalogos.motivo.paquete.nombre-largo': 'The bundle name cannot be longer than 120 characters.',
  'catalogos.motivo.paquete.precio-numero': 'The bundle price has to be a number.',
  'catalogos.motivo.paquete.precio-cero': 'A bundle price has to be greater than 0: a free bundle is not a bundle.',
  'catalogos.motivo.paquete.precio-entero':
    'The bundle price has to be a whole amount: the split among the screens does not allow cents.',
  'catalogos.motivo.paquete.dos-pantallas':
    'A bundle needs at least 2 screens; with only one, that is a rate and it goes on the screen’s profile.',
  'catalogos.motivo.paquete.repetida': 'A screen is repeated in the bundle.',
  'catalogos.motivo.franja.nombre': 'The daypart needs a name.',
  'catalogos.motivo.franja.hora': 'Invalid time in “{nombre}”: use HH:MM in 24-hour format, from 00:00 to 23:59.',
  'catalogos.motivo.franja.misma-hora': 'The daypart “{nombre}” starts and ends at the same time: it covers nothing.',
  'catalogos.motivo.franja.solape': 'The daypart “{nombre}” ({inicio}–{fin}) overlaps “{otra}” ({otraInicio}–{otraFin}).',
  'catalogos.motivo.temporada.nombre': 'The season needs a name.',
  'catalogos.motivo.temporada.fecha': 'Invalid date in “{nombre}”: use YYYY-MM-DD.',
  'catalogos.motivo.temporada.al-reves': 'The season “{nombre}” ends before it starts.',
  'catalogos.motivo.temporada.solape':
    'The season “{nombre}” ({desde} to {hasta}) overlaps “{otra}” ({otraDesde} to {otraHasta}).',
  'catalogos.motivo.tramo.unidad': 'The tier needs a sales unit.',
  'catalogos.motivo.tramo.cantidad-entera': 'The quantity it applies from has to be a whole number.',
  'catalogos.motivo.tramo.sin-fracciones':
    'The quantity it applies from has to be a whole number: fractions of a unit are not sold.',
  'catalogos.motivo.tramo.desde-dos':
    'A volume tier starts at 2 units or more; “from 1” would lower the whole rate card.',
  'catalogos.motivo.tramo.pct-numero': 'The discount has to be a number.',
  'catalogos.motivo.tramo.pct-cero': 'A tier’s discount has to be greater than 0%: a tier at 0% does nothing.',
  'catalogos.motivo.tramo.pct-cien': 'A tier’s discount cannot exceed 100%.',
  'catalogos.motivo.tramo.mismo-umbral':
    'There is already a tier from {n} for this unit ({pct}%). Two tiers with the same threshold are two prices for the same purchase.',
  'catalogos.motivo.tramo.mas-y-menos':
    'Buying more cannot discount less: the tier from {otroDesde} already gives {otroPct}% and this one, from {n}, would give {pct}%.',
  'catalogos.motivo.tramo.menos-y-mas':
    'Buying more cannot discount less: the tier from {otroDesde} gives {otroPct}% and this one, from {n}, would give {pct}%.',
}

// ─── ITALIANO · ola 0 (2026-11-03) ──────────────────────────────────────────
// PARCIAL a proposito: lo rellena el lote de traduccion de este ambito
// (`vault/03-Frontend/italiano-olas.md`). Mientras falte una clave, la
// pantalla la pinta en INGLES (`diccionario.ts`, `DICCIONARIOS.it`) y la
// prueba de cobertura (`cobertura-italiano.test.ts`) la cuenta como pendiente.
// Cuando el lote termine, el tipo pasa a `Record<ClaveCatalogos, string>` y `tsc`
// vuelve a exigir cada clave, como en el ingles.
export const IT_CATALOGOS: Partial<Record<ClaveCatalogos, string>> = {}

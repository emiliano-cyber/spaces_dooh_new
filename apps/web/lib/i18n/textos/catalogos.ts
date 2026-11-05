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

// ─── ITALIANO · lote L2 «Comercial y propuestas» (2026-11-03) ──────────────
// Completo: desde este lote el tipo es `Record` y `tsc` exige cada clave, como
// en el ingles. Traducido desde el ESPANOL (el ingles solo como apoyo).
// Glosario del lote (`vault/03-Frontend/italiano-olas.md`): paquete cerrado →
// «pacchetto» · precio cerrado → «prezzo fisso» · a prorrata → «in
// proporzione» · reparto → «ripartizione» · parte del paquete → «quota del
// pacchetto» · franja → «fascia oraria» · temporada → «stagione» · dar de baja
// / dada de baja → «disattivare» / «Disattivata» (baja LOGICA, como el ingles)
// · tramo → «scaglione» · escalon → «gradino» · escala plana → «scala piatta» ·
// rejilla → «griglia tariffaria» · horario de transmision → «palinsesto» ·
// programar → «programmare» · tarifa de lista → «tariffa di listino» ·
// pantalla (de inventario) → «impianto» · «se compone» → «si applica a
// cascata». Porcentajes sin espacio («10%»).
// Los motivos (`catalogos.motivo.*`) los manda tambien el servidor: el
// catalogo de errores italiano (lote L5) tiene que decirlos IGUAL.
// El «({ejemplo})» de la tarifa ilegible llega en italiano («15.000,50»): desde
// el 04/11 (P-L2-1) la cifra se TECLEA a la italiana (`lib/captura-cifra.ts`).
export const IT_CATALOGOS: Record<ClaveCatalogos, string> = {
  // ── Comunes del lote ──
  'catalogos.comun.nombre': 'Nome',
  'catalogos.comun.desde': 'Da',
  'catalogos.comun.hasta': 'Fino a',
  'catalogos.comun.estado': 'Stato',
  'catalogos.comun.anadir': 'Aggiungi',
  'catalogos.comun.eliminar': 'Elimina',
  'catalogos.comun.activa': 'Attiva',
  'catalogos.comun.dada-de-baja': 'Disattivata',
  'catalogos.comun.dar-de-baja': 'Disattiva',
  'catalogos.comun.unidad': 'Unità',
  'catalogos.comun.franja': 'Fascia oraria',
  'catalogos.comun.temporada': 'Stagione',
  'catalogos.comun.tarifa': 'Tariffa',
  'catalogos.comun.todo-el-dia': 'Tutto il giorno',
  'catalogos.comun.todo-el-ano': 'Tutto l’anno',
  'catalogos.comun.no-guardar': 'Impossibile salvare',
  'catalogos.comun.no-eliminar': 'Impossibile eliminare',

  // ── Paquetes cerrados ──
  'catalogos.paquetes.descripcion':
    'Un insieme di impianti con un prezzo per l’insieme. Sostituisce la somma delle loro tariffe di listino; non la sconta.',
  'catalogos.paquetes.no-leer': 'Impossibile leggere il catalogo dei pacchetti',
  'catalogos.paquetes.no-guardar': 'Impossibile salvare il pacchetto',
  'catalogos.paquetes.no-cambiar': 'Impossibile modificare il pacchetto',
  'catalogos.paquetes.no-eliminar': 'Impossibile eliminare il pacchetto',
  'catalogos.paquetes.cargando': 'Caricamento dei pacchetti',
  'catalogos.paquetes.aviso.sustituye':
    'Il prezzo del pacchetto SOSTITUISCE la somma delle tariffe di listino: non la sconta, la rimpiazza.',
  'catalogos.paquetes.aviso.da-igual': 'Non importa quanto sommino gli impianti: si fattura il prezzo del pacchetto.',
  'catalogos.paquetes.aviso.volumen':
    'Per questo un pacchetto {negrita} (il suo prezzo lo include già) né codici di negoziazione, a meno che tu non spunti la casella qui sotto. Lo sconto commerciale della proposta invece continua ad applicarsi sopra.',
  'catalogos.paquetes.aviso.volumen.negrita': 'non ammette sconto per volume',
  'catalogos.paquetes.aviso.quitar':
    'E {negrita}: la ripartizione si ricalcola tra quelli che restano e la proposta lo segnala.',
  'catalogos.paquetes.aviso.quitar.negrita': 'togliere un impianto da una proposta già quotata NON abbassa il prezzo',
  'catalogos.paquetes.lista.titulo': 'Pacchetti dell’organizzazione',
  'catalogos.paquetes.lista.subtitulo': 'Si ripartisce in proporzione alla tariffa di listino',
  'catalogos.paquetes.lista.explicacion':
    'Il prezzo si ripartisce tra gli impianti {prorrata}, e la somma delle quote dà il prezzo del pacchetto {peso}. Questa ripartizione è il ricavo che il report di redditività attribuisce a ciascun impianto.',
  'catalogos.paquetes.lista.explicacion.prorrata': 'in proporzione alla loro tariffa di listino',
  'catalogos.paquetes.lista.explicacion.peso': 'esattamente',
  'catalogos.paquetes.col.paquete': 'Pacchetto',
  'catalogos.paquetes.col.pantallas': 'Impianti',
  'catalogos.paquetes.col.precio': 'Prezzo fisso',
  'catalogos.paquetes.col.codigos': 'Codici di negoziazione',
  'catalogos.paquetes.col.en-uso': 'In uso',
  'catalogos.paquetes.vacio':
    'Non ce n’è ancora nessuno. Senza pacchetti, tutto si vende alla tariffa di listino, che è esattamente come funziona oggi.',
  'catalogos.paquetes.activo': 'Attivo',
  'catalogos.paquetes.desactivado': 'Disattivato',
  'catalogos.paquetes.pantallas.uno': '{n} impianto',
  'catalogos.paquetes.pantallas.otros': '{n} impianti',
  'catalogos.paquetes.admite-codigo': 'Ammette codici',
  'catalogos.paquetes.precio-final': 'Prezzo finale',
  'catalogos.paquetes.en-uso.title': 'Proposte che applicano questo pacchetto',
  'catalogos.paquetes.en-uso': 'In uso · {n}',
  'catalogos.paquetes.desactivar': 'Disattiva',
  'catalogos.paquetes.activar': 'Attiva',
  'catalogos.paquetes.desactivar.title':
    'Disattivare conserva la definizione e il pacchetto non si può più vendere. Ciò che è già stato quotato o approvato non cambia.',
  'catalogos.paquetes.eliminar.title':
    'Elimina: nessuna vendita cambia, perché il suo prezzo è già copiato in ogni proposta. Ciò che si perde è sapere da quale pacchetto proveniva.',
  'catalogos.paquetes.nuevo': 'Nuovo pacchetto',
  'catalogos.paquetes.nombre.aria': 'Nome del pacchetto',
  'catalogos.paquetes.nombre.placeholder': 'es. Pacchetto Periferico',
  'catalogos.paquetes.precio': 'Prezzo dell’insieme (importo intero, senza centesimi)',
  'catalogos.paquetes.precio.aria': 'Prezzo fisso del pacchetto',
  'catalogos.paquetes.precio.placeholder': 'es. {ejemplo}',
  'catalogos.paquetes.admite-codigo-encima': 'Ammette un codice di negoziazione in aggiunta',
  'catalogos.paquetes.pantallas-del-paquete': 'Impianti del pacchetto',
  'catalogos.paquetes.minimo':
    ' (minimo 2). Una proposta può applicare questo pacchetto solo se ha {exactamente} questi impianti.',
  'catalogos.paquetes.minimo.exactamente': 'esattamente',
  'catalogos.paquetes.elegidas.uno': '{n} scelto',
  'catalogos.paquetes.elegidas.otros': '{n} scelti',
  'catalogos.paquetes.de-lista': '{monto} di listino',
  'catalogos.paquetes.resumen.lista': 'Listino {monto}',
  'catalogos.paquetes.resumen.paquete': 'Pacchetto {monto}',
  'catalogos.paquetes.resumen.deja-de-cobrar': 'si incassano {monto} in meno',
  'catalogos.paquetes.resumen.por-encima': 'si incassano {monto} IN PIÙ rispetto al listino',
  'catalogos.paquetes.reparto.intro':
    'Ecco come si ripartirebbe tra gli impianti, ed è ciò che il report di redditività attribuirà a ciascuno:',
  'catalogos.paquetes.reparto.pantalla': 'Impianto',
  'catalogos.paquetes.reparto.lista': 'Listino',
  'catalogos.paquetes.reparto.parte': 'Quota del pacchetto',
  'catalogos.paquetes.reparto.suma': 'Somma delle quote {cuadra}',
  'catalogos.paquetes.reparto.cuadra': '— torna esatta',
  'catalogos.paquetes.crear': 'Crea pacchetto',

  // ── Franjas y temporadas ──
  'catalogos.rejilla.descripcion':
    'Le due dimensioni della tariffa: l’ora del giorno e il periodo dell’anno. Si inseriscono una volta e valgono per tutto l’inventario.',
  'catalogos.rejilla.no-leer': 'Impossibile leggere il catalogo',
  'catalogos.rejilla.no-dar-de-baja': 'Impossibile disattivare',
  'catalogos.rejilla.cargando': 'Caricamento del catalogo',
  'catalogos.rejilla.candado.titulo': 'Conferma con la tua password',
  'catalogos.rejilla.candado.subtitulo':
    'Fasce orarie e stagioni sono prezzo: la tua organizzazione chiede la password per modificarle.',
  'catalogos.rejilla.candado.confirmar': 'Conferma e salva',
  'catalogos.rejilla.franjas.titulo': 'Fasce orarie',
  'catalogos.rejilla.franjas.subtitulo': 'Fine esclusa · senza sovrapposizioni',
  'catalogos.rejilla.franjas.explicacion':
    'La fine è {exclusivo}: 06:00–10:00 e 10:00–14:00 si toccano senza sovrapporsi. Due fasce orarie non possono sovrapporsi: se potessero, il prezzo di uno spot alle 09:30 dipenderebbe da uno spareggio che nessuno ha deciso.',
  'catalogos.rejilla.franjas.explicacion.exclusivo': 'esclusa',
  'catalogos.rejilla.col.orden': 'Ordine',
  'catalogos.rejilla.franjas.vacio':
    'Non ce n’è ancora nessuna. Senza fasce orarie, tutto si vende con la tariffa base, che è esattamente come funziona oggi.',
  'catalogos.rejilla.dar-de-baja.title': 'Disattiva: non viene più offerta, e ciò che è già stato venduto resta valido',
  'catalogos.rejilla.franja.nombre.aria': 'Nome della fascia oraria',
  'catalogos.rejilla.franja.nombre.placeholder': 'es. Prime',
  'catalogos.rejilla.franja.inicio.aria': 'Ora di inizio',
  'catalogos.rejilla.franja.fin.aria': 'Ora di fine',
  'catalogos.rejilla.temporadas.titulo': 'Stagioni',
  'catalogos.rejilla.temporadas.subtitulo': 'Date con anno · entrambi gli estremi inclusi',
  'catalogos.rejilla.temporadas.explicacion':
    'Date {concretas}, con l’anno: «Buen Fin 2026» e «Buen Fin 2027» sono due stagioni, perché le date cambiano ogni anno. Entrambi gli estremi sono inclusi. Nemmeno le stagioni possono sovrapporsi: se «Dicembre» e «Buen Fin» si sovrappongono, bisogna decidere quale prezzo vale in quei giorni.',
  'catalogos.rejilla.temporadas.explicacion.concretas': 'precise',
  'catalogos.rejilla.temporadas.vacio': 'Non ce n’è ancora nessuna.',
  'catalogos.rejilla.temporada.nombre.aria': 'Nome della stagione',
  'catalogos.rejilla.temporada.nombre.placeholder': 'es. Buen Fin 2026',
  'catalogos.rejilla.temporada.inicio.aria': 'Data di inizio',
  'catalogos.rejilla.temporada.fin.aria': 'Data di fine',

  // ── Horario de transmision ──
  'catalogos.programacion.no-leer': 'Impossibile leggere la programmazione',
  'catalogos.programacion.no-programar': 'Impossibile programmare',
  'catalogos.programacion.cargando': 'Caricamento della programmazione',
  'catalogos.programacion.titulo': 'Palinsesto',
  'catalogos.programacion.subtitulo': 'Non cambia alcun prezzo',
  'catalogos.programacion.explicacion':
    'In quale fascia oraria {negrita} ogni campagna. Non cambia alcun prezzo: ciò che è stato venduto è già nella campagna dalla proposta. Puoi selezionare più campagne e programmarle in una volta sola; se una non si può programmare, non se ne programma nessuna.',
  'catalogos.programacion.explicacion.negrita': 'va in onda',
  'catalogos.programacion.sin-permiso':
    'Solo il manager delle vendite, il direttore commerciale e la direzione possono programmare il palinsesto. Qui vedi com’è.',
  'catalogos.programacion.sin-franjas': 'Crea almeno una fascia oraria qui sopra per poterci programmare delle campagne.',
  'catalogos.programacion.campanas.uno': '{n} campagna',
  'catalogos.programacion.campanas.otros': '{n} campagne',
  'catalogos.programacion.ninguna': 'Nessuna campagna va in onda in questa fascia oraria.',
  'catalogos.programacion.quitar.aria': 'Rimuovi {campana} da {franja}',
  'catalogos.programacion.quitar.title': 'Rimuovi da questa fascia oraria (non tocca ciò che è stato venduto)',
  'catalogos.programacion.programar-en': 'Programma campagne in {franja}',
  'catalogos.programacion.marcadas.uno': ' ({n} selezionata)',
  'catalogos.programacion.marcadas.otros': ' ({n} selezionate)',
  'catalogos.programacion.hoy-en': '(oggi in {franja})',
  'catalogos.programacion.boton': 'Programma {n} in {franja}',
  'catalogos.programacion.boton.vacio': 'Programma in {franja}',

  // ── Tarifas por franja y temporada de UNA pantalla ──
  'catalogos.tarifas.no-leer': 'Impossibile leggere la griglia tariffaria',
  'catalogos.tarifas.guardadas': 'Tariffe per fascia oraria salvate',
  'catalogos.tarifas.no-guardar': 'Impossibile salvare le tariffe per fascia oraria',
  'catalogos.tarifas.titulo': 'Tariffe per fascia oraria e stagione',
  'catalogos.tarifas.guardando': 'Salvataggio…',
  'catalogos.tarifas.guardar': 'Salva tariffe',
  'catalogos.tarifas.invalida':
    'C’è una tariffa in rosso che non si capisce: il punto separa le migliaia e la virgola i decimali ({ejemplo}).',
  'catalogos.tarifas.sin-catalogo':
    'Questa organizzazione non ha ancora fasce orarie né stagioni. Si definiscono una sola volta in {pantalla} e valgono per tutto l’inventario.',
  'catalogos.tarifas.dispersa':
    'Basta inserire le combinazioni che hanno un prezzo diverso. Ciò che non è qui si fattura con la solita tariffa per unità: la griglia tariffaria non obbliga a compilare nulla.',
  'catalogos.tarifas.tarifa-de.aria': 'Tariffa di {unidad}',
  'catalogos.tarifas.conservar': 'Mantieni',
  'catalogos.tarifas.quitar': 'Rimuovi',
  'catalogos.tarifas.nueva.unidad.aria': 'Unità della nuova tariffa',
  'catalogos.tarifas.nueva.unidad': 'Unità…',
  'catalogos.tarifas.nueva.franja.aria': 'Fascia oraria della nuova tariffa',
  'catalogos.tarifas.nueva.temporada.aria': 'Stagione della nuova tariffa',
  'catalogos.tarifas.nueva.tarifa.aria': 'Tariffa della nuova riga',

  // ── Descuentos por volumen ──
  'catalogos.volumen.descripcion':
    'Quale sconto ottiene chi compra molto. Si inserisce una volta per unità di vendita e vale per tutto l’inventario.',
  'catalogos.volumen.no-leer': 'Impossibile leggere la scala',
  'catalogos.volumen.cargando': 'Caricamento della scala',
  'catalogos.volumen.aviso.todas': 'Lo sconto si applica a TUTTE le unità, non solo a quelle oltre la soglia.',
  'catalogos.volumen.aviso.ejemplo':
    '«Da 50 spot, 10%» vuol dire che chi compra 50 spot li paga tutti e 50 con il 10% in meno. Conseguenza: chi ne compra 49 paga più di chi ne compra 50, e il salto può essere maggiore del prezzo di un’unità.',
  'catalogos.volumen.aviso.compone':
    'E si applica {compone} sullo sconto commerciale: un 20% qui e un 20% nella proposta lasciano al cliente da pagare il {pct}, non il 60%.',
  'catalogos.volumen.aviso.compone.negrita': 'a cascata',
  'catalogos.volumen.aviso.compone.pct': '64%',
  'catalogos.volumen.tramos.titulo': 'Scaglioni per unità di vendita',
  'catalogos.volumen.tramos.subtitulo': 'Ogni unità ha la propria scala',
  'catalogos.volumen.escala.title': 'Lo sconto dello scaglione raggiunto si applica a TUTTE le unità',
  'catalogos.volumen.escala': 'Scala piatta (volume)',
  'catalogos.volumen.explicacion':
    'Ogni unità ha la propria scala, perché 50 spot e 50 mesi non sono lo stesso acquisto. Gli scaglioni devono {crecer}: comprare di più non può mai scontare di meno.',
  'catalogos.volumen.explicacion.crecer': 'crescere',
  'catalogos.volumen.col.a-partir': 'A partire da',
  'catalogos.volumen.col.descuento': 'Sconto',
  'catalogos.volumen.vacio':
    'Non ce n’è ancora nessuno. Senza scaglioni, tutto si vende alla tariffa di listino, che è esattamente come funziona oggi.',
  'catalogos.volumen.tramos.uno': ' · {n} scaglione',
  'catalogos.volumen.tramos.otros': ' · {n} scaglioni',
  'catalogos.volumen.escalon': 'Gradino {n}',
  'catalogos.volumen.desde': 'da {cantidad} {unidad}',
  'catalogos.volumen.pct': '→ {pct}%',
  'catalogos.volumen.eliminar.title':
    'Elimina: smette di applicarsi da ora in poi. Ciò che è già stato quotato o approvato non cambia.',
  'catalogos.volumen.unidad.aria': 'Unità di vendita',
  'catalogos.volumen.cantidad.aria': 'A partire da quale quantità',
  'catalogos.volumen.cantidad.placeholder': 'es. 50',
  'catalogos.volumen.pct.aria': 'Sconto percentuale',
  'catalogos.volumen.pct.placeholder': 'es. 10',
  'catalogos.volumen.anadir': 'Aggiungi scaglione',

  // ── Motivos de rechazo ──
  'catalogos.motivo.paquete.nombre': 'Il pacchetto ha bisogno di un nome.',
  'catalogos.motivo.paquete.nombre-largo': 'Il nome del pacchetto non può superare i 120 caratteri.',
  'catalogos.motivo.paquete.precio-numero': 'Il prezzo del pacchetto deve essere un numero.',
  'catalogos.motivo.paquete.precio-cero':
    'Il prezzo di un pacchetto deve essere maggiore di 0: un pacchetto gratuito non è un pacchetto.',
  'catalogos.motivo.paquete.precio-entero':
    'Il prezzo del pacchetto deve essere un importo intero: la ripartizione tra gli impianti non ammette centesimi.',
  'catalogos.motivo.paquete.dos-pantallas':
    'Un pacchetto ha bisogno di almeno 2 impianti; con uno solo, quella è una tariffa e va nella scheda dell’impianto.',
  'catalogos.motivo.paquete.repetida': 'C’è un impianto ripetuto nel pacchetto.',
  'catalogos.motivo.franja.nombre': 'La fascia oraria ha bisogno di un nome.',
  'catalogos.motivo.franja.hora': 'Ora non valida in «{nombre}»: si scrive HH:MM nel formato 24 ore, da 00:00 a 23:59.',
  'catalogos.motivo.franja.misma-hora': 'La fascia oraria «{nombre}» inizia e finisce alla stessa ora: non copre nulla.',
  'catalogos.motivo.franja.solape':
    'La fascia oraria «{nombre}» ({inicio}–{fin}) si sovrappone a «{otra}» ({otraInicio}–{otraFin}).',
  'catalogos.motivo.temporada.nombre': 'La stagione ha bisogno di un nome.',
  'catalogos.motivo.temporada.fecha': 'Data non valida in «{nombre}»: si scrive AAAA-MM-GG.',
  'catalogos.motivo.temporada.al-reves': 'La stagione «{nombre}» finisce prima di iniziare.',
  'catalogos.motivo.temporada.solape':
    'La stagione «{nombre}» ({desde} – {hasta}) si sovrappone a «{otra}» ({otraDesde} – {otraHasta}).',
  'catalogos.motivo.tramo.unidad': 'Lo scaglione ha bisogno di un’unità di vendita.',
  'catalogos.motivo.tramo.cantidad-entera': 'La quantità da cui si applica deve essere un numero intero.',
  'catalogos.motivo.tramo.sin-fracciones':
    'La quantità da cui si applica deve essere un numero intero: non si vendono frazioni di unità.',
  'catalogos.motivo.tramo.desde-dos':
    'Uno scaglione di volume parte da 2 unità o più; «da 1» vorrebbe dire abbassare l’intero listino.',
  'catalogos.motivo.tramo.pct-numero': 'Lo sconto deve essere un numero.',
  'catalogos.motivo.tramo.pct-cero':
    'Lo sconto di uno scaglione deve essere maggiore dello 0%: uno scaglione allo 0% non fa nulla.',
  'catalogos.motivo.tramo.pct-cien': 'Lo sconto di uno scaglione non può superare il 100%.',
  'catalogos.motivo.tramo.mismo-umbral':
    'Esiste già uno scaglione da {n} per questa unità ({pct}%). Due scaglioni con la stessa soglia sono due prezzi per lo stesso acquisto.',
  'catalogos.motivo.tramo.mas-y-menos':
    'Non si può comprare di più e scontare di meno: lo scaglione da {otroDesde} dà già il {otroPct}% e questo, da {n}, darebbe il {pct}%.',
  'catalogos.motivo.tramo.menos-y-mas':
    'Non si può comprare di più e scontare di meno: lo scaglione da {otroDesde} dà il {otroPct}% e questo, da {n}, darebbe il {pct}%.',
}

// ─── PORTUGUES (pt-BR) · lote L2 (2026-11-05) ──────────────────────────────
// Glosario del lote (ademas del comun, §2 bis de `portugues-olas.md`):
// paquete cerrado → «pacote fechado» · precio cerrado → «preço fechado» · a
// prorrata → «proporcionalmente» · reparto → «rateio» · tarifa / precio de
// lista → «preço de tabela» (la rejilla es «tabela de preços», L5) · franja →
// «faixa horária» · temporada → «temporada» · dar de baja → «desativar» ·
// tramo → «patamar» · escalon → «degrau» · escala plana → «escala não
// progressiva» · horario de transmision → «grade de programação» · se
// compone → «se aplica em cascata». Porcentaje pegado («10%», D4). Los
// `catalogos.motivo.*` los usan tambien `lib/paquete.ts`, `lib/rejilla.ts` y
// `lib/volumen.ts` con el idioma de la pantalla.
export const PT_CATALOGOS: Record<ClaveCatalogos, string> = {
  // ── Comunes del lote ──
  'catalogos.comun.nombre': 'Nome',
  'catalogos.comun.desde': 'De',
  'catalogos.comun.hasta': 'Até',
  'catalogos.comun.estado': 'Situação',
  'catalogos.comun.anadir': 'Adicionar',
  'catalogos.comun.eliminar': 'Excluir',
  'catalogos.comun.activa': 'Ativa',
  'catalogos.comun.dada-de-baja': 'Desativada',
  'catalogos.comun.dar-de-baja': 'Desativar',
  'catalogos.comun.unidad': 'Unidade',
  'catalogos.comun.franja': 'Faixa horária',
  'catalogos.comun.temporada': 'Temporada',
  'catalogos.comun.tarifa': 'Tarifa',
  'catalogos.comun.todo-el-dia': 'O dia todo',
  'catalogos.comun.todo-el-ano': 'O ano todo',
  'catalogos.comun.no-guardar': 'Não foi possível salvar',
  'catalogos.comun.no-eliminar': 'Não foi possível excluir',

  // ── Paquetes cerrados ──
  'catalogos.paquetes.descripcion':
    'Um conjunto de pontos com um preço para o conjunto. Substitui a soma das tarifas de tabela; não a desconta.',
  'catalogos.paquetes.no-leer': 'Não foi possível ler o catálogo de pacotes',
  'catalogos.paquetes.no-guardar': 'Não foi possível salvar o pacote',
  'catalogos.paquetes.no-cambiar': 'Não foi possível alterar o pacote',
  'catalogos.paquetes.no-eliminar': 'Não foi possível excluir o pacote',
  'catalogos.paquetes.cargando': 'Carregando os pacotes',
  'catalogos.paquetes.aviso.sustituye':
    'O preço do pacote SUBSTITUI a soma das tarifas de tabela: não a desconta, a substitui.',
  'catalogos.paquetes.aviso.da-igual': 'Não importa quanto os pontos somem — cobra-se o preço do pacote.',
  'catalogos.paquetes.aviso.volumen':
    'Por isso um pacote {negrita} (o preço dele já o inclui) nem código de negociação, a menos que você marque a caixa abaixo. O desconto comercial da proposta continua sendo aplicado por cima.',
  'catalogos.paquetes.aviso.volumen.negrita': 'não admite desconto por volume',
  'catalogos.paquetes.aviso.quitar': 'E {negrita}: o rateio é recalculado entre os que ficam e a proposta avisa.',
  'catalogos.paquetes.aviso.quitar.negrita': 'remover um ponto de uma proposta já cotada NÃO baixa o preço',
  'catalogos.paquetes.lista.titulo': 'Pacotes da organização',
  'catalogos.paquetes.lista.subtitulo': 'Rateado proporcionalmente ao preço de tabela',
  'catalogos.paquetes.lista.explicacion':
    'O preço é rateado entre os pontos {prorrata}, e a soma das partes dá o preço do pacote {peso}. Esse rateio é a receita que o relatório de rentabilidade atribui a cada ponto.',
  'catalogos.paquetes.lista.explicacion.prorrata': 'proporcionalmente ao preço de tabela de cada um',
  'catalogos.paquetes.lista.explicacion.peso': 'com exatidão',
  'catalogos.paquetes.col.paquete': 'Pacote',
  'catalogos.paquetes.col.pantallas': 'Pontos',
  'catalogos.paquetes.col.precio': 'Preço fechado',
  'catalogos.paquetes.col.codigos': 'Códigos?',
  'catalogos.paquetes.col.en-uso': 'Em uso',
  'catalogos.paquetes.vacio':
    'Ainda não há nenhum. Sem pacotes, tudo é vendido pelo preço de tabela — que é exatamente como funciona hoje.',
  'catalogos.paquetes.activo': 'Ativo',
  'catalogos.paquetes.desactivado': 'Desativado',
  'catalogos.paquetes.pantallas.uno': '{n} ponto',
  'catalogos.paquetes.pantallas.otros': '{n} pontos',
  'catalogos.paquetes.admite-codigo': 'Admite código',
  'catalogos.paquetes.precio-final': 'Preço final',
  'catalogos.paquetes.en-uso.title': 'Propostas que aplicam este pacote',
  'catalogos.paquetes.en-uso': 'Em uso · {n}',
  'catalogos.paquetes.desactivar': 'Desativar',
  'catalogos.paquetes.activar': 'Ativar',
  'catalogos.paquetes.desactivar.title':
    'Desativar mantém a definição e o pacote deixa de poder ser vendido. O que já foi cotado e o que já foi aprovado não muda.',
  'catalogos.paquetes.eliminar.title':
    'Excluir: nenhuma venda muda, porque o preço já está copiado em cada proposta. O que se perde é saber de qual pacote ela veio.',
  'catalogos.paquetes.nuevo': 'Novo pacote',
  'catalogos.paquetes.nombre.aria': 'Nome do pacote',
  'catalogos.paquetes.nombre.placeholder': 'ex.: Pacote Periférico',
  'catalogos.paquetes.precio': 'Preço do conjunto (valor inteiro, sem centavos)',
  'catalogos.paquetes.precio.aria': 'Preço fechado do pacote',
  'catalogos.paquetes.precio.placeholder': 'ex.: {ejemplo}',
  'catalogos.paquetes.admite-codigo-encima': 'Admite código de negociação por cima',
  'catalogos.paquetes.pantallas-del-paquete': 'Pontos do pacote',
  'catalogos.paquetes.minimo':
    ' (mínimo 2). Uma proposta só pode aplicar este pacote se tiver {exactamente} estes pontos.',
  'catalogos.paquetes.minimo.exactamente': 'exatamente',
  'catalogos.paquetes.elegidas.uno': '{n} escolhido',
  'catalogos.paquetes.elegidas.otros': '{n} escolhidos',
  'catalogos.paquetes.de-lista': '{monto} de tabela',
  'catalogos.paquetes.resumen.lista': 'Tabela {monto}',
  'catalogos.paquetes.resumen.paquete': 'Pacote {monto}',
  'catalogos.paquetes.resumen.deja-de-cobrar': 'deixa-se de cobrar {monto}',
  'catalogos.paquetes.resumen.por-encima': 'cobra-se {monto} ACIMA da tabela',
  'catalogos.paquetes.reparto.intro':
    'Assim seria o rateio entre os pontos — e é isto que o relatório de rentabilidade vai atribuir a cada um:',
  'catalogos.paquetes.reparto.pantalla': 'Ponto',
  'catalogos.paquetes.reparto.lista': 'Tabela',
  'catalogos.paquetes.reparto.parte': 'Parte do pacote',
  'catalogos.paquetes.reparto.suma': 'Soma das partes {cuadra}',
  'catalogos.paquetes.reparto.cuadra': '— bate exatamente',
  'catalogos.paquetes.crear': 'Criar pacote',

  // ── Franjas y temporadas ──
  'catalogos.rejilla.descripcion':
    'As duas dimensões da tarifa: a hora do dia e a época do ano. São cadastradas uma vez e valem para todo o inventário.',
  'catalogos.rejilla.no-leer': 'Não foi possível ler o catálogo',
  'catalogos.rejilla.no-dar-de-baja': 'Não foi possível desativar',
  'catalogos.rejilla.cargando': 'Carregando o catálogo',
  'catalogos.rejilla.candado.titulo': 'Confirme com sua senha',
  'catalogos.rejilla.candado.subtitulo':
    'Faixas horárias e temporadas são preço: sua organização pede a senha para alterá-las.',
  'catalogos.rejilla.candado.confirmar': 'Confirmar e salvar',
  'catalogos.rejilla.franjas.titulo': 'Faixas horárias',
  'catalogos.rejilla.franjas.subtitulo': 'Fim exclusivo · sem sobreposição',
  'catalogos.rejilla.franjas.explicacion':
    'O fim é {exclusivo}: 06:00–10:00 e 10:00–14:00 se tocam e não se sobrepõem. Duas faixas horárias não podem se sobrepor — se pudessem, o preço de um spot às 09:30 dependeria de um desempate que ninguém decidiu.',
  'catalogos.rejilla.franjas.explicacion.exclusivo': 'exclusivo',
  'catalogos.rejilla.col.orden': 'Ordem',
  'catalogos.rejilla.franjas.vacio':
    'Ainda não há nenhuma. Sem faixas horárias, tudo é vendido com a tarifa base — que é exatamente como funciona hoje.',
  'catalogos.rejilla.dar-de-baja.title': 'Desativar: deixa de ser oferecida, e o que já foi contratado continua valendo',
  'catalogos.rejilla.franja.nombre.aria': 'Nome da faixa horária',
  'catalogos.rejilla.franja.nombre.placeholder': 'ex.: Horário nobre',
  'catalogos.rejilla.franja.inicio.aria': 'Hora de início',
  'catalogos.rejilla.franja.fin.aria': 'Hora de término',
  'catalogos.rejilla.temporadas.titulo': 'Temporadas',
  'catalogos.rejilla.temporadas.subtitulo': 'Datas com ano · as duas pontas entram',
  'catalogos.rejilla.temporadas.explicacion':
    'Datas {concretas}, com ano: “Buen Fin 2026” e “Buen Fin 2027” são duas temporadas, porque as datas mudam a cada ano. As duas pontas entram. Também não podem se sobrepor: se “Dezembro” e “Buen Fin” se sobrepõem, é preciso decidir qual preço vale nesses dias.',
  'catalogos.rejilla.temporadas.explicacion.concretas': 'específicas',
  'catalogos.rejilla.temporadas.vacio': 'Ainda não há nenhuma.',
  'catalogos.rejilla.temporada.nombre.aria': 'Nome da temporada',
  'catalogos.rejilla.temporada.nombre.placeholder': 'ex.: Buen Fin 2026',
  'catalogos.rejilla.temporada.inicio.aria': 'Data de início',
  'catalogos.rejilla.temporada.fin.aria': 'Data de término',

  // ── Horario de transmision → grade de programação ──
  'catalogos.programacion.no-leer': 'Não foi possível ler a programação',
  'catalogos.programacion.no-programar': 'Não foi possível programar',
  'catalogos.programacion.cargando': 'Carregando a programação',
  'catalogos.programacion.titulo': 'Grade de programação',
  'catalogos.programacion.subtitulo': 'Não muda nenhum preço',
  'catalogos.programacion.explicacion':
    'Em qual faixa horária cada campanha {negrita}. Não muda nenhum preço: o que foi vendido já está na campanha desde a proposta. Você pode marcar várias campanhas e programá-las de uma vez; se alguma não puder, nenhuma é programada.',
  'catalogos.programacion.explicacion.negrita': 'é veiculada',
  'catalogos.programacion.sin-permiso':
    'Só o gerente de vendas, o diretor comercial e a diretoria podem montar a grade de programação. Aqui você vê como ela está.',
  'catalogos.programacion.sin-franjas':
    'Cadastre pelo menos uma faixa horária acima para poder programar campanhas nela.',
  'catalogos.programacion.campanas.uno': '{n} campanha',
  'catalogos.programacion.campanas.otros': '{n} campanhas',
  'catalogos.programacion.ninguna': 'Nenhuma campanha é veiculada nesta faixa horária.',
  'catalogos.programacion.quitar.aria': 'Remover {campana} de {franja}',
  'catalogos.programacion.quitar.title': 'Remover desta faixa horária (não mexe no que foi vendido)',
  'catalogos.programacion.programar-en': 'Programar campanhas em {franja}',
  'catalogos.programacion.marcadas.uno': ' ({n} marcada)',
  'catalogos.programacion.marcadas.otros': ' ({n} marcadas)',
  'catalogos.programacion.hoy-en': '(hoje em {franja})',
  'catalogos.programacion.boton': 'Programar {n} em {franja}',
  'catalogos.programacion.boton.vacio': 'Programar  em {franja}',

  // ── Tarifas por franja y temporada de UNA pantalla ──
  'catalogos.tarifas.no-leer': 'Não foi possível ler a tabela de preços',
  'catalogos.tarifas.guardadas': 'Tarifas por faixa horária salvas',
  'catalogos.tarifas.no-guardar': 'Não foi possível salvar as tarifas por faixa horária',
  'catalogos.tarifas.titulo': 'Tarifas por faixa horária e temporada',
  'catalogos.tarifas.guardando': 'Salvando…',
  'catalogos.tarifas.guardar': 'Salvar tarifas',
  // P2: a captura ainda e mexicana (ver `compartidos.cifra.*`).
  'catalogos.tarifas.invalida':
    'Há uma tarifa em vermelho que não dá para entender: a vírgula separa os milhares e o ponto, os decimais ({ejemplo}).',
  'catalogos.tarifas.sin-catalogo':
    'Esta organização ainda não tem faixas horárias nem temporadas. Elas são definidas uma única vez em {pantalla} e valem para todo o inventário.',
  'catalogos.tarifas.dispersa':
    'Só é preciso cadastrar as combinações que tenham um preço diferente. O que não estiver aqui é cobrado com a tarifa por unidade de sempre — a tabela de preços não obriga a preencher nada.',
  'catalogos.tarifas.tarifa-de.aria': 'Tarifa de {unidad}',
  'catalogos.tarifas.conservar': 'Manter',
  'catalogos.tarifas.quitar': 'Remover',
  'catalogos.tarifas.nueva.unidad.aria': 'Unidade da nova tarifa',
  'catalogos.tarifas.nueva.unidad': 'Unidade…',
  'catalogos.tarifas.nueva.franja.aria': 'Faixa horária da nova tarifa',
  'catalogos.tarifas.nueva.temporada.aria': 'Temporada da nova tarifa',
  'catalogos.tarifas.nueva.tarifa.aria': 'Tarifa da nova linha',

  // ── Descuentos por volumen ──
  'catalogos.volumen.descripcion':
    'Que desconto ganha quem compra muito. É cadastrado uma vez por unidade de venda e vale para todo o inventário.',
  'catalogos.volumen.no-leer': 'Não foi possível ler a escala',
  'catalogos.volumen.cargando': 'Carregando a escala',
  'catalogos.volumen.aviso.todas':
    'O desconto é aplicado sobre TODAS as unidades, não só sobre as que passam do patamar.',
  'catalogos.volumen.aviso.ejemplo':
    '“A partir de 50 spots, 10%” quer dizer que quem compra 50 paga os 50 com 10% a menos. Consequência: quem compra 49 paga mais do que quem compra 50, e o salto pode ser maior que o preço de uma unidade.',
  'catalogos.volumen.aviso.compone':
    'E se {compone} sobre o desconto comercial: 20% aqui e 20% na proposta deixam o cliente pagando {pct}, não 60%.',
  'catalogos.volumen.aviso.compone.negrita': 'aplica em cascata',
  'catalogos.volumen.aviso.compone.pct': '64%',
  'catalogos.volumen.tramos.titulo': 'Patamares por unidade de venda',
  'catalogos.volumen.tramos.subtitulo': 'Cada unidade tem sua própria escala',
  'catalogos.volumen.escala.title': 'O desconto do patamar atingido é aplicado a TODAS as unidades',
  'catalogos.volumen.escala': 'Escala não progressiva (volume)',
  'catalogos.volumen.explicacion':
    'Cada unidade tem sua própria escala, porque 50 spots e 50 meses não são a mesma compra. Os patamares precisam {crecer}: comprar mais nunca pode descontar menos.',
  'catalogos.volumen.explicacion.crecer': 'crescer',
  'catalogos.volumen.col.a-partir': 'A partir de',
  'catalogos.volumen.col.descuento': 'Desconto',
  'catalogos.volumen.vacio':
    'Ainda não há nenhum. Sem patamares, tudo é vendido pelo preço de tabela — que é exatamente como funciona hoje.',
  'catalogos.volumen.tramos.uno': ' · {n} patamar',
  'catalogos.volumen.tramos.otros': ' · {n} patamares',
  'catalogos.volumen.escalon': 'Degrau {n}',
  'catalogos.volumen.desde': 'a partir de {cantidad} {unidad}',
  'catalogos.volumen.pct': '→ {pct}%',
  'catalogos.volumen.eliminar.title':
    'Excluir: deixa de ser aplicado a partir de agora. O que já foi cotado e o que já foi aprovado não muda.',
  'catalogos.volumen.unidad.aria': 'Unidade de venda',
  'catalogos.volumen.cantidad.aria': 'A partir de qual quantidade',
  'catalogos.volumen.cantidad.placeholder': 'ex.: 50',
  'catalogos.volumen.pct.aria': 'Desconto percentual',
  'catalogos.volumen.pct.placeholder': 'ex.: 10',
  'catalogos.volumen.anadir': 'Adicionar patamar',

  // ── Motivos de rechazo (lib/paquete.ts, lib/rejilla.ts, lib/volumen.ts) ──
  'catalogos.motivo.paquete.nombre': 'O pacote precisa de um nome.',
  'catalogos.motivo.paquete.nombre-largo': 'O nome do pacote não pode passar de 120 caracteres.',
  'catalogos.motivo.paquete.precio-numero': 'O preço do pacote precisa ser um número.',
  'catalogos.motivo.paquete.precio-cero':
    'O preço de um pacote precisa ser maior que 0: um pacote grátis não é um pacote.',
  'catalogos.motivo.paquete.precio-entero':
    'O preço do pacote precisa ser um valor inteiro: o rateio entre os pontos não admite centavos.',
  'catalogos.motivo.paquete.dos-pantallas':
    'Um pacote precisa de pelo menos 2 pontos; com um só, isso é uma tarifa e vai na ficha do ponto.',
  'catalogos.motivo.paquete.repetida': 'Há um ponto repetido no pacote.',
  'catalogos.motivo.franja.nombre': 'A faixa horária precisa de um nome.',
  'catalogos.motivo.franja.hora': 'Hora inválida em “{nombre}”: escreve-se HH:MM em 24 horas, de 00:00 a 23:59.',
  'catalogos.motivo.franja.misma-hora': 'A faixa horária “{nombre}” começa e termina na mesma hora: não cobre nada.',
  'catalogos.motivo.franja.solape':
    'A faixa horária “{nombre}” ({inicio}–{fin}) se sobrepõe a “{otra}” ({otraInicio}–{otraFin}).',
  'catalogos.motivo.temporada.nombre': 'A temporada precisa de um nome.',
  'catalogos.motivo.temporada.fecha': 'Data inválida em “{nombre}”: escreve-se AAAA-MM-DD.',
  'catalogos.motivo.temporada.al-reves': 'A temporada “{nombre}” termina antes de começar.',
  'catalogos.motivo.temporada.solape':
    'A temporada “{nombre}” ({desde} a {hasta}) se sobrepõe a “{otra}” ({otraDesde} a {otraHasta}).',
  'catalogos.motivo.tramo.unidad': 'O patamar precisa de uma unidade de venda.',
  'catalogos.motivo.tramo.cantidad-entera': 'A quantidade a partir da qual se aplica precisa ser um número inteiro.',
  'catalogos.motivo.tramo.sin-fracciones':
    'A quantidade a partir da qual se aplica precisa ser um número inteiro: não se vendem frações de unidade.',
  'catalogos.motivo.tramo.desde-dos':
    'Um patamar de volume começa em 2 unidades ou mais; “a partir de 1” seria baixar a tabela inteira.',
  'catalogos.motivo.tramo.pct-numero': 'O desconto precisa ser um número.',
  'catalogos.motivo.tramo.pct-cero': 'O desconto de um patamar precisa ser maior que 0%: um patamar de 0% não faz nada.',
  'catalogos.motivo.tramo.pct-cien': 'O desconto de um patamar não pode passar de 100%.',
  'catalogos.motivo.tramo.mismo-umbral':
    'Já existe um patamar a partir de {n} para esta unidade ({pct}%). Dois patamares com o mesmo limite são dois preços para a mesma compra.',
  'catalogos.motivo.tramo.mas-y-menos':
    'Não dá para comprar mais e descontar menos: o patamar a partir de {otroDesde} já dá {otroPct}% e este, a partir de {n}, daria {pct}%.',
  'catalogos.motivo.tramo.menos-y-mas':
    'Não dá para comprar mais e descontar menos: o patamar a partir de {otroDesde} dá {otroPct}% e este, a partir de {n}, daria {pct}%.',
}

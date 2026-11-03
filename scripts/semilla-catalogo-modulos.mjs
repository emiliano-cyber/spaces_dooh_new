// ============================================================================
//  semilla-catalogo-modulos.mjs — lo que le faltaba al catálogo para que CADA
//  módulo de la demo tenga un ejemplo.
// ----------------------------------------------------------------------------
//  Lo usa `semilla-catalogo-demo.mjs` (no se corre solo). Nació de la auditoría
//  del 2026-11-03 sobre una base nueva con el guion y el catálogo: 40 tablas
//  seguían vacías —Comercial negociación, códigos, paquetes, franjas,
//  volumen, almacén, incidencias, abonos, extensiones, notificaciones,
//  actividad…— y muchas fichas tenían campos que ninguna semilla llenaba
//  (condiciones y vigencia de la propuesta, coordenadas del predio, costo real
//  de la OT, evidencias…).
//
//  Mismas reglas que el catálogo, y por los mismos motivos (ver su cabecera):
//   · todo lo nuevo lleva `CAT` en su clave natural y se guarda por ella
//     (`on conflict` o `not exists` filtrado por `tenant_id`);
//   · las fechas salen del «hoy» del plan (`plan.hoy`), nunca escritas a mano;
//   · las columnas que se rellenan en filas que ya existen solo se escriben si
//     estaban vacías (`coalesce`/`is null`): lo que alguien cambió en la demo
//     no se pisa en la segunda corrida;
//   · nada real: correos `.invalid`, RFC con `DMO`, teléfonos en ceros.
//
//  Ninguna integración externa. Lo que en la aplicación llena DOOHmain, Google
//  o el correo NO se siembra aquí (ver `docs/datos/20261103_base_demo_nueva.md`).
// ============================================================================
import { dataUrlDeArte } from './semilla-arte-demo.mjs'
import { dataUrlDePdf } from './semilla-pdf-demo.mjs'

function nDia(iso) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(a, m - 1, d) / 86_400_000
}
function isoDe(n) {
  const d = new Date(n * 86_400_000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
const masDias = (iso, k) => isoDe(nDia(iso) + k)

// ─── Comercial negociación (y Captación) ───────────────────────────────────
// Espacios que se están negociando para INSTALAR una pantalla (PREDIO y
// PANTALLA, lo que enseña Comercial negociación) y prospectos de cliente y de
// arrendador (Captación, hoy fuera del menú pero viva por API). Uno en cada
// etapa con sentido, con su bitácora, contactos, competencia y ofertas.
//
// [clave, tipo, nombre, etapa, direccion, lat, lng, extra]
const PROSPECTOS = [
  ['P1', 'PREDIO', 'Azotea CAT Tlalpan 1200', 'PROSPECTO', 'Calzada de Tlalpan 1200, Coyoacan, CDMX', 19.3700, -99.1420,
    { tipoEspacio: 'Azotea', visibilidad: 'LEJANA', ancho: 12, alto: 6, responsable: 1, datos: { tipoUbicacion: 'Azotea', m2: 180, rentaPedida: 28000 } }],
  ['P2', 'PREDIO', 'Terreno CAT Viaducto Rio Becerra', 'CONTACTADO', 'Viaducto Miguel Aleman 300, Benito Juarez, CDMX', 19.4010, -99.1700,
    { tipoEspacio: 'Terreno', visibilidad: 'CERCANA', ancho: 12.9, alto: 7.2, responsable: 2, datos: { tipoUbicacion: 'Terreno', m2: 400, rentaPedida: 35000 } }],
  ['P3', 'PANTALLA', 'Pantalla CAT Insurgentes Sur 1600', 'VISITA', 'Avenida Insurgentes Sur 1600, Benito Juarez, CDMX', 19.3660, -99.1820,
    { tipoEspacio: 'Fachada', visibilidad: 'CERCANA', ancho: 10, alto: 5, responsable: 3, datos: { tipoPantalla: 'DIGITAL', anchoM: 10, altoM: 5, caras: 1, rentaPedida: 60000 } }],
  ['P4', 'PREDIO', 'Plaza CAT Perisur estacionamiento', 'NEGOCIACION', 'Periferico Sur 4690, Coyoacan, CDMX', 19.3040, -99.1900,
    { tipoEspacio: 'Plaza comercial', visibilidad: 'MEDIA', ancho: 8, alto: 3, responsable: 4, presupuesto: [30000, 42000, 'Gerencia de la plaza'], datos: { tipoUbicacion: 'Plaza comercial', m2: 60, rentaPedida: 45000 } }],
  ['P5', 'PANTALLA', 'Pantalla CAT Patriotismo', 'EN_REVISION', 'Avenida Patriotismo 230, Miguel Hidalgo, CDMX', 19.4040, -99.1810,
    { tipoEspacio: 'Azotea', visibilidad: 'CERCANA', ancho: 14, alto: 7, responsable: 5, datos: { tipoPantalla: 'DIGITAL', anchoM: 14, altoM: 7, caras: 2, rentaPedida: 52000 } }],
  ['P6', 'PREDIO', 'Bardado CAT Ermita Iztapalapa', 'RECHAZADO', 'Calzada Ermita Iztapalapa 900, Iztapalapa, CDMX', 19.3570, -99.0880,
    { tipoEspacio: 'Bardado industrial', visibilidad: 'MEDIA', ancho: 15, alto: 4, responsable: 4, motivo: 'La renta pedida duplica la del corredor y el uso de suelo no permite anuncios autosoportados.', datos: { tipoUbicacion: 'Bardado', m2: 90, rentaPedida: 70000 } }],
  ['P7', 'PREDIO', 'Fachada CAT Mixcoac', 'APROBADO', 'Avenida Revolucion 1400, Alvaro Obregon, CDMX', 19.3740, -99.1880,
    { tipoEspacio: 'Fachada', visibilidad: 'CERCANA', ancho: 9, alto: 6, responsable: 5, datos: { tipoUbicacion: 'Fachada', m2: 54, rentaPedida: 26000 } }],
  ['P8', 'PANTALLA', 'Pantalla CAT Toreo', 'PERDIDO', 'Boulevard Manuel Avila Camacho 5, Naucalpan, Edo. Mex.', 19.4530, -99.2160,
    { tipoEspacio: 'Puente', visibilidad: 'LEJANA', ancho: 16, alto: 3, responsable: 3, datos: { tipoPantalla: 'DIGITAL', anchoM: 16, altoM: 3, caras: 2, rentaPedida: 90000 } }],
  // Captación: un cliente y un arrendador.
  ['P9', 'CLIENTE', 'Cadena CAT de Gimnasios', 'NEGOCIACION', null, null, null,
    { datos: { rfc: 'DMO040404G01', razonSocial: 'Cadena CAT de Gimnasios, S.A. de C.V.', giro: 'Gimnasios', presupuesto: 450000 } }],
  ['P10', 'ARRENDADOR', 'Inmobiliaria CAT Lomas', 'CONTACTADO', null, null, null,
    { datos: { rfc: 'DMO040404A02' } }],
].map(([clave, tipo, nombre, etapa, direccion, lat, lng, x], i) => ({
  clave, tipo, nombre, etapa, direccion, lat, lng, ...x,
  contacto: {
    nombre: `Contacto ${clave} CAT`,
    telefono: `55 0000 05${String(i + 1).padStart(2, '0')}`,
    email: `prospecto.${clave.toLowerCase()}@catalogo.invalid`,
  },
}))

// La bitácora de cada uno: un avance por cada etapa que ya recorrió.
const RECORRIDO = ['PROSPECTO', 'CONTACTADO', 'VISITA', 'NEGOCIACION', 'EN_REVISION']
const CANAL = { CONTACTADO: 'LLAMADA', VISITA: 'VISITA', NEGOCIACION: 'REUNION', EN_REVISION: 'CORREO', PERDIDO: 'WHATSAPP', RECHAZADO: 'CORREO' }
const NOTA_AVANCE = {
  CONTACTADO: 'Primer contacto: el dueno acepta recibir la propuesta.',
  VISITA: 'Visita al sitio: medidas tomadas, buena visibilidad desde el sentido norte.',
  NEGOCIACION: 'Se presento la oferta; piden revisar el plazo y el deposito.',
  EN_REVISION: 'Expediente completo, se manda a revision de direccion.',
  PERDIDO: 'El dueno firmo con la competencia.',
}

export function planModulos(plan) {
  const hoy = plan.hoy
  const sitio = (clave) => plan.sitios.find((s) => s.clave === clave)
  const campana = (n) => plan.campanas.find((c) => c.n === n)

  // ── Prospectos con su bitácora ──
  const prospectos = PROSPECTOS.map((p, i) => {
    const creado = masDias(hoy, -90 + i * 6)
    const hasta = p.etapa === 'APROBADO' || p.etapa === 'RECHAZADO' ? 'EN_REVISION' : p.etapa === 'PERDIDO' ? 'NEGOCIACION' : p.etapa
    const pasos = RECORRIDO.slice(1, RECORRIDO.indexOf(hasta) + 1)
    if (p.etapa === 'PERDIDO') pasos.push('PERDIDO')
    const avances = pasos.map((e, k) => ({
      anterior: k === 0 ? 'PROSPECTO' : pasos[k - 1],
      nueva: e,
      nota: NOTA_AVANCE[e],
      canal: CANAL[e],
      fecha: masDias(creado, (k + 1) * 9),
    }))
    const decidido = ['APROBADO', 'RECHAZADO'].includes(p.etapa) ? masDias(creado, (pasos.length + 1) * 9) : null
    const conNegociacion = ['PREDIO', 'PANTALLA'].includes(p.tipo)
    // Ofertas: a partir de la negociación, con una contraoferta en medio.
    const ofertas = []
    const renta = p.datos.rentaPedida
    if (conNegociacion && ['NEGOCIACION', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'PERDIDO'].includes(p.etapa)) {
      ofertas.push({ version: 1, importe: Math.round(renta * 0.75), plazo: 36, estado: 'CONTRAOFERTA', nota: 'Primera oferta; el dueno contraoferta.' })
      const final = { APROBADO: 'ACEPTADA', RECHAZADO: 'RECHAZADA', PERDIDO: 'RECHAZADA' }[p.etapa] ?? 'ENVIADA'
      ofertas.push({ version: 2, importe: Math.round(renta * 0.88), plazo: 60, estado: final, nota: 'Segunda oferta a 5 anos con incremento anual del 5%.' })
    }
    return {
      ...p,
      creado,
      siguientePaso: ['APROBADO', 'RECHAZADO', 'PERDIDO'].includes(p.etapa) ? null : 'Llamar para confirmar la visita de direccion',
      siguientePasoFecha: ['APROBADO', 'RECHAZADO', 'PERDIDO'].includes(p.etapa) ? null : masDias(hoy, 3 + i),
      decidido,
      avances,
      ofertas,
      contactos: conNegociacion
        ? [
            { nombre: p.contacto.nombre, papel: 'Dueno', telefono: p.contacto.telefono, email: p.contacto.email, legal: false },
            { nombre: `Abogada ${p.clave} CAT`, papel: 'Representante legal', telefono: `55 0000 06${String(i + 1).padStart(2, '0')}`, email: `legal.${p.clave.toLowerCase()}@catalogo.invalid`, legal: true },
          ]
        : [{ nombre: p.contacto.nombre, papel: 'Compras', telefono: p.contacto.telefono, email: p.contacto.email, legal: false }],
      competencia: conNegociacion && i % 2 === 0
        ? [{ nombre: 'Exterior CAT Competidor', nota: 'Tienen una valla a 200 m; ofrecen renta mas alta pero sin incremento.', desde: masDias(hoy, -400) }]
        : [],
      notas: [`Nota interna ${p.clave}: el acceso a la azotea es por escalera de servicio; pedir llaves con administracion.`],
    }
  })

  // ── Códigos de negociación ──
  const codigos = [
    { codigo: 'CAT-BUENFIN', pct: 12, desde: masDias(hoy, -10), hasta: masDias(hoy, 25), usos: 20 },
    { codigo: 'CAT-AGENCIA10', pct: 10, desde: masDias(hoy, -120), hasta: masDias(hoy, 240), usos: null },
    { codigo: 'CAT-VERANO', pct: 8, desde: masDias(hoy, -200), hasta: masDias(hoy, -110), usos: 5 },
  ]
  // Un canje: la propuesta ENVIADA CAT-PRO-007 lleva el código aprobado.
  const canjes = [{ codigo: 'CAT-AGENCIA10', propuesta: 'CAT-PRO-007', fecha: masDias(hoy, -20) }]

  // ── Paquetes cerrados ──
  const paquetes = [
    { nombre: 'Paquete CAT Corredor Reforma', precio: 230000, admiteCodigo: false, notas: 'Reforma completa: dos caras fijas y la LED.', sitios: ['CAT-F01', 'CAT-F02', 'CAT-D01'] },
    { nombre: 'Paquete CAT Digital Poniente', precio: 330000, admiteCodigo: true, notas: 'Las tres digitales de Santa Fe y Polanco.', sitios: ['CAT-D02', 'CAT-D04', 'CAT-D06'] },
    { nombre: 'Paquete CAT Guadalajara', precio: 130000, admiteCodigo: false, notas: 'Plaza Guadalajara: espectacular y LED de Vallarta.', sitios: ['CAT-F06', 'CAT-D05'], activo: false },
  ]

  // ── Franjas, temporadas y la rejilla de tarifas ──
  const franjas = [
    { nombre: 'CAT Manana', inicio: '06:00', fin: '10:00', orden: 1 },
    { nombre: 'CAT Mediodia', inicio: '10:00', fin: '16:00', orden: 2 },
    { nombre: 'CAT Tarde', inicio: '16:00', fin: '21:00', orden: 3 },
    { nombre: 'CAT Noche', inicio: '21:00', fin: '23:59', orden: 4 },
  ]
  const anio = Number(hoy.slice(0, 4))
  const temporadas = [
    { nombre: 'CAT Temporada decembrina', desde: `${anio}-12-01`, hasta: `${anio}-12-31` },
    { nombre: 'CAT Regreso a clases', desde: `${anio + 1}-08-01`, hasta: `${anio + 1}-08-31` },
    { nombre: 'CAT Buen Fin', desde: masDias(hoy, 10), hasta: masDias(hoy, 13) },
  ]
  // Tarifa por spot en la rejilla de dos LED: más cara en la tarde y en
  // temporada. La base es la modalidad «spot» del catálogo.
  const tarifas = []
  for (const clave of ['CAT-D01', 'CAT-D02']) {
    const s = sitio(clave)
    const base = Math.round(s.tarifa / (s.spotsPorHora * 18 * 30) * 10) * 10 || 10
    const factor = { 'CAT Manana': 0.9, 'CAT Mediodia': 1, 'CAT Tarde': 1.3, 'CAT Noche': 0.8 }
    for (const f of franjas) {
      tarifas.push({ sitio: clave, franja: f.nombre, temporada: null, tarifa: Math.round(base * factor[f.nombre]) })
      tarifas.push({ sitio: clave, franja: f.nombre, temporada: 'CAT Temporada decembrina', tarifa: Math.round(base * factor[f.nombre] * 1.25) })
    }
  }

  // ── Descuento por volumen ──
  const escalas = [
    { unidad: 'mensual', desde: 3, pct: 5 },
    { unidad: 'mensual', desde: 6, pct: 10 },
    { unidad: 'mensual', desde: 12, pct: 15 },
    { unidad: 'spot', desde: 500, pct: 5 },
    { unidad: 'spot', desde: 2000, pct: 12 },
  ]

  // ── Almacén ──
  const activos = [
    { etiqueta: 'CAT-ALM-001', tipo: 'PANTALLA', descripcion: 'Modulo LED P10 de repuesto (caja de 8)', estado: 'EN_ALMACEN', marca: 'Absen DEMO', modelo: 'P10-OUT', serie: 'CAT-SN-0001', ubicacion: 'Bodega Iztapalapa, rack A3' },
    { etiqueta: 'CAT-ALM-002', tipo: 'EQUIPO', descripcion: 'Tarjeta receptora para pantalla LED', estado: 'EN_TRASLADO', marca: 'Novastar DEMO', modelo: 'MRV-336', serie: 'CAT-SN-0002', ubicacion: 'En camino a Santa Fe', sitio: 'CAT-D09' },
    { etiqueta: 'CAT-ALM-003', tipo: 'CAMARA', descripcion: 'Camara de verificacion de transmision', estado: 'INSTALADO', marca: 'Hikvision DEMO', modelo: 'DS-2CD', serie: 'CAT-SN-0003', ubicacion: 'Instalada en Reforma', sitio: 'CAT-D01' },
    { etiqueta: 'CAT-ALM-004', tipo: 'VEHICULO', descripcion: 'Camioneta de montaje con canastilla', estado: 'EN_ALMACEN', marca: 'Nissan DEMO', modelo: 'NP300', serie: 'CAT-VIN-0004', ubicacion: 'Patio de maniobras', placas: 'DEMO-000-A' },
    { etiqueta: 'CAT-ALM-005', tipo: 'HERRAMIENTA', descripcion: 'Andamio tubular de 12 m', estado: 'EN_ALMACEN', marca: 'Andamios DEMO', modelo: 'AT-12', serie: 'CAT-SN-0005', ubicacion: 'Bodega Iztapalapa, patio' },
    { etiqueta: 'CAT-ALM-006', tipo: 'LONA', descripcion: 'Lona impresa de reposicion Reforma Sur (12.9 x 7.2)', estado: 'EN_ALMACEN', marca: 'Impresos DEMO', modelo: 'Front 13 oz', serie: 'CAT-SN-0006', ubicacion: 'Bodega Iztapalapa, rack L1' },
    { etiqueta: 'CAT-ALM-007', tipo: 'ESTRUCTURA', descripcion: 'Bastidor metalico para valla 8 x 3', estado: 'BAJA', marca: 'Herreria DEMO', modelo: 'BV-83', serie: 'CAT-SN-0007', ubicacion: 'Chatarra', notas: 'Dado de baja por corrosion.' },
    { etiqueta: 'CAT-ALM-008', tipo: 'OTRO', descripcion: 'Planta de luz portatil 5 kW', estado: 'EN_ALMACEN', marca: 'Generadores DEMO', modelo: 'G5K', serie: 'CAT-SN-0008', ubicacion: 'Bodega Iztapalapa, rack E2' },
  ]
  const movimientos = [
    { activo: 'CAT-ALM-001', tipo: 'ENTRADA', motivo: 'Compra de refacciones', fecha: masDias(hoy, -60) },
    { activo: 'CAT-ALM-002', tipo: 'ENTRADA', motivo: 'Refaccion importada recibida', fecha: masDias(hoy, -5) },
    { activo: 'CAT-ALM-002', tipo: 'TRASLADO', motivo: 'Envio a Santa Fe para la OT de la tarjeta receptora', fecha: masDias(hoy, -1), sitio: 'CAT-D09' },
    { activo: 'CAT-ALM-003', tipo: 'SALIDA', motivo: 'Instalacion en Reforma', fecha: masDias(hoy, -45), sitio: 'CAT-D01' },
    { activo: 'CAT-ALM-007', tipo: 'BAJA', motivo: 'Corrosion estructural', fecha: masDias(hoy, -30) },
  ]

  // ── Incidencias ──
  const incidencias = [
    { sitio: 'CAT-F10', tipo: 'VANDALISMO', descripcion: 'Grafiti sobre el mural y la lona rasgada en la esquina inferior.', estatus: 'EN_PROCESO', desde: masDias(hoy, -8), impacta: true },
    { sitio: 'CAT-F08', tipo: 'LEGAL', descripcion: 'La alcaldia suspendio el permiso del anuncio; sellos de clausura.', estatus: 'ABIERTA', desde: masDias(hoy, -120), impacta: true },
    { sitio: 'CAT-D09', tipo: 'MANTENIMIENTO', descripcion: 'Media pantalla en negro: falla de la tarjeta receptora.', estatus: 'ABIERTA', desde: masDias(hoy, -6), impacta: true },
    { sitio: 'CAT-F03', tipo: 'CLIMA', descripcion: 'Lluvia con granizo: se reviso la lona, sin danos.', estatus: 'CERRADA', desde: masDias(hoy, -40), resuelta: masDias(hoy, -39), impacta: false },
    { sitio: 'CAT-D02', tipo: 'SUSPENSION_OPERATIVA', descripcion: 'Corte de luz de CFE en la zona por 6 horas.', estatus: 'RESUELTA', desde: masDias(hoy, -15), resuelta: masDias(hoy, -15), impacta: true },
  ]

  // ── Evidencias y costo de las OT ──
  // Las de montaje ya completadas de las campañas al aire y por facturar: una
  // foto con el arte puesto. Y el costo real en las de mantenimiento en curso.
  const evidencias = []
  for (const o of plan.ordenes) {
    if (o.estatus !== 'COMPLETADA' || !o.campanaFolio) continue
    const c = plan.campanas.find((x) => x.folio === o.campanaFolio)
    if (!['ACTIVA', 'LISTA_FACTURAR'].includes(c.estado)) continue
    const s = sitio(o.sitio)
    evidencias.push({
      ot: o.folio,
      tipo: o.tipo === 'DESMONTAJE' ? 'DESMONTAJE' : 'INSTALACION',
      lat: s.lat,
      lng: s.lng,
      tomada: `${o.fecha}T12:40:00-06:00`,
      arte: { ancho: 320, alto: 200, fondo: '#37474F', acento: '#FFB300', texto: '#FFFFFF', lineas: ['EVIDENCIA', s.nombre.toUpperCase(), o.fecha] },
    })
  }
  const costosOt = [
    { ot: 'CAT-OT-MTO-01', costo: 7800, instrucciones: 'Cambiar el bastidor del lado poniente; llevar soldadora y andamio de 12 m.', notas: 'El cliente pidio aviso antes de bajar la lona.' },
    { ot: 'CAT-OT-MTO-02', costo: 5600, instrucciones: 'Revisar la fuente de los modulos del lado derecho.', notas: 'Se cambiaron dos fuentes; falta medir voltaje con carga.' },
    { ot: 'CAT-OT-MTO-04', costo: 9400, instrucciones: 'Reforzar las dos columnas del mural con placa de 1/4.', notas: 'Trabajo terminado, en espera de revision del supervisor.' },
  ]

  // ── Cobranza: abonos ──
  // Cada comprobante PAGADO lleva su pago como abono: desde el ADR 0046
  // Finanzas mide lo cobrado con `cobranza_abonos` y la invariante del servidor
  // es `monto_pagado = sum(abonos)`. Sin ellos, «Vencido» enseñaba 11 millones
  // de facturas pagadas (medido el 2026-11-03). Los del último año llevan su
  // comprobante en PDF. Y la 013 va AL CORRIENTE con un anticipo del 30 %.
  const abonos = []
  for (const f of plan.comprobantes) {
    if (f.cobranza === 'PAGADA') {
      const fecha = nDia(masDias(f.vence, -5)) < nDia(f.emision) ? f.emision : masDias(f.vence, -5)
      abonos.push({ factura: f.folio, monto: f.monto, fecha: nDia(fecha) > nDia(hoy) ? hoy : fecha, origen: 'registro', conComprobante: nDia(fecha) >= nDia(hoy) - 365 })
    }
    if (f.folio === 'CAT-FAC-013')
      abonos.push({ factura: f.folio, monto: Math.round(f.monto * 0.3 * 100) / 100, fecha: masDias(f.emision, 10), origen: 'registro', anticipo: true, conComprobante: true })
  }

  // ── Extensión de campaña con contrato ──
  // La 015 se extendió un mes: su fin actual es el nuevo, y el anterior quedó
  // en la bitácora con el contrato que lo cubre.
  const c015 = campana('015')
  const extensiones = [{
    campana: c015.folio,
    anterior: isoDe(Date.UTC(Number(c015.hasta.slice(0, 4)), Number(c015.hasta.slice(5, 7)) - 1, 0) / 86_400_000),
    nueva: c015.hasta,
  }]

  // ── Órdenes de compra del cliente ──
  const ordenesCompra = plan.campanas
    .filter((c) => ['ACTIVA', 'LISTA_FACTURAR', 'CONFIRMADA'].includes(c.estado))
    .map((c) => ({
      folio: `CAT-OC-${c.n}`,
      numero: `OC-${c.cliente}-${c.n}${c.desde.slice(2, 4)}`,
      campana: c.folio,
      monto: Math.round(c.neto * 1.16 * 100) / 100,
      fecha: masDias(c.desde, -15),
      estatus: c.estado === 'CONFIRMADA' && c.n === '019' ? 'PENDIENTE' : 'RECIBIDA',
    }))

  // ── Notificaciones ──
  const notificaciones = [
    { tipo: 'COBRANZA', nivel: 'warning', titulo: 'Cobranza vencida: CAT-FAC-014', detalle: 'Telefonia DEMO Movil lleva 12 dias de atraso.', link: '/finanzas', dias: -1, leidaPor: null },
    { tipo: 'PROPUESTA', nivel: 'success', titulo: 'Propuesta aceptada: CAT-PRO-004', detalle: 'Refresquera DEMO del Norte acepto por la liga.', link: '/propuestas', dias: -3, leidaPor: 'dueno@catalogo.invalid' },
    { tipo: 'CONTRATO', nivel: 'warning', titulo: 'Contrato por vencer: Predio CAT Satelite', detalle: 'Vence en menos de 60 dias; renta con 2 pagos atrasados.', link: '/arrendadores', dias: -2, leidaPor: null },
    { tipo: 'CREATIVO', nivel: 'info', titulo: 'Creativo por aprobar: CAT-CMP-014 spot B', detalle: 'Version de temporada decembrina pendiente de validacion.', link: '/creativos', dias: 0, leidaPor: null },
    { tipo: 'OT', nivel: 'error', titulo: 'OT bloqueada: CAT-OT-MTO-03', detalle: 'Reemplazo de tarjeta receptora en espera de refaccion.', link: '/operaciones', dias: -4, leidaPor: 'operaciones@catalogo.invalid' },
    { tipo: 'CAMPANA', nivel: 'info', titulo: 'Campana generada: CAT-CMP-019', detalle: 'Desde la propuesta CAT-PRO-004.', link: '/campanas', dias: -6, leidaPor: 'dueno@catalogo.invalid' },
  ]

  // ── Actividad ──
  const acciones = [
    ['Creo la propuesta CAT-PRO-008', 'Propuesta', 'vendedor@catalogo.invalid', -9],
    ['Envio la propuesta CAT-PRO-007 al cliente', 'Propuesta', 'vendedor@catalogo.invalid', -8],
    ['Aprobo el codigo CAT-AGENCIA10 en CAT-PRO-007', 'Propuesta', 'gerente.ventas@catalogo.invalid', -8],
    ['Genero la campana CAT-CMP-019', 'Campana', 'director.comercial@catalogo.invalid', -6],
    ['Aprobo el creativo CAT-CMP-013 spot B', 'Creativo', 'director.comercial@catalogo.invalid', -5],
    ['Rechazo el creativo CAT-CMP-013 spot C', 'Creativo', 'director.comercial@catalogo.invalid', -5],
    ['Registro un abono en CAT-FAC-013', 'Cobranza', 'finanzas@catalogo.invalid', -4],
    ['Asigno la OT CAT-OT-MTO-02', 'Orden de trabajo', 'operaciones@catalogo.invalid', -3],
    ['Valido la prueba de color CAT-OI-018-F04', 'Imprenta', 'imprenta@catalogo.invalid', -2],
    ['Extendio la campana CAT-CMP-015 con contrato', 'Campana', 'administrador@catalogo.invalid', -2],
    ['Registro el recibo de luz de Predio CAT Reforma', 'Energia', 'operaciones@catalogo.invalid', -1],
    ['Movio el prospecto Pantalla CAT Patriotismo a revision', 'Prospecto', 'gerente.ventas@catalogo.invalid', -1],
  ].map(([accion, entidad, email, dias], i) => ({ accion, entidad, email, cuando: `${masDias(hoy, dias)}T${String(9 + i % 8).padStart(2, '0')}:15:00-06:00` }))

  // ── Tickets de soporte ──
  const tickets = [
    { folio: 'CAT-TKT-001', asunto: 'No puedo descargar el PDF de una propuesta', cuerpo: 'Al dar clic en Generar PDF se abre una pestana en blanco (Safari).', estado: 'RESUELTO', prioridad: 'NORMAL', respuesta: 'Resuelto: el navegador bloqueaba la ventana emergente. Permitir ventanas para el dominio.', dias: -20 },
    { folio: 'CAT-TKT-002', asunto: 'Agregar un tipo de estructura nuevo', cuerpo: 'Necesitamos dar de alta "Muro verde" como tipo de estructura.', estado: 'ABIERTO', prioridad: 'BAJA', respuesta: null, dias: -2 },
  ]

  // ── Campos de fichas que ninguna semilla llenaba ──
  const condiciones = [
    '1. Precios en pesos mexicanos mas IVA.',
    '2. La reserva se confirma con la orden de compra firmada.',
    '3. El arte se entrega 10 dias habiles antes del inicio; la impresion corre por cuenta del cliente salvo acuerdo.',
    '4. Las pantallas digitales exhiben spots de 20 s en rotacion de 12 anunciantes.',
    '5. Cancelaciones con menos de 30 dias de anticipacion causan el 50% del importe.',
  ].join('\n')

  const sitiosExtra = plan.sitios.map((s, i) => ({
    clave: s.clave,
    orientacion: ['Norte', 'Sur', 'Oriente', 'Poniente'][i % 4],
    vista: ['N-S', 'S-N', 'E-O', 'O-E'][i % 4],
    tramo: `${s.direccion.split(',')[0]}, tramo ${['norte', 'centro', 'sur'][i % 3]}`,
    costoCompra: Math.round(s.tarifa * 0.35 / 100) * 100,
    precioM2: s.digital ? null : Math.round(s.tarifa / (s.ancho * s.alto)),
    tarifaImpresion: s.digital ? null : Math.round(s.ancho * s.alto * 95),
    maxClientes: s.digital ? 12 : 1,
    // Imagen promocional: solo en las que se venden hoy (no en bajas).
    imagen: ['BAJA'].includes(s.comercial) ? null : {
      ancho: 320, alto: 200, fondo: s.digital ? '#0D47A1' : '#1B5E20', acento: '#FFFFFF', texto: '#FFFFFF',
      lineas: [s.nombre.toUpperCase(), `${s.ancho} X ${s.alto} M`, s.ciudad.toUpperCase()],
    },
  }))

  const arrendadoresExtra = plan.arrendadores.map((a, i) => ({
    nombre: a.nombre,
    cuenta: `CLABE 0021 8000 0000 00${String(i + 1).padStart(4, '0')}`,
    notas: `CAT · paga por ${a.formaPago.toLowerCase()} los dias 5; facturas al correo del arrendador.`,
    nacionalidad: 'Mexicana',
    razon: i < 2 ? { razon: `${a.nombre.replace(' DEMO', ' DEMO,')} S.A. de C.V.`.replace(',,', ','), rfc: a.rfc, regimen: '601 - General de Ley Personas Morales' } : null,
  }))

  const recientes = plan.propuestas.filter((p) => p.estatus === 'APROBADA').sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  const aprobacionReciente = { folio: recientes[0].folio, fecha: nDia(masDias(hoy, -2)) >= nDia(recientes[0].fecha) ? masDias(hoy, -2) : recientes[0].fecha }

  const organizacion = {
    razonSocial: 'Space OS Demo Publicidad Exterior, S.A. de C.V.',
    nombreComercial: 'Space OS Demo',
    rfc: 'DMO050505SO1',
    domicilio: 'Avenida DEMO 000, Col. Centro, Cuauhtemoc, CDMX, CP 00000',
    representante: 'Representante Legal DEMO',
    constitucion: 'Escritura publica DEMO 0000, Notaria DEMO 00 de la Ciudad de Mexico',
    remitente: 'avisos@demo.invalid',
    logo: { ancho: 240, alto: 80, fondo: '#111827', acento: '#F59E0B', texto: '#FFFFFF', lineas: ['SPACE OS DEMO'] },
  }
  const negociacionAgencia = 'Comision del 15% sobre neto; 30 dias de credito. Validada por direccion comercial.'

  return {
    aprobacionReciente, organizacion, negociacionAgencia,
    prospectos, codigos, canjes, paquetes, franjas, temporadas, tarifas, escalas,
    activos, movimientos, incidencias, evidencias, costosOt, abonos, extensiones,
    ordenesCompra, notificaciones, acciones, tickets, condiciones, sitiosExtra, arrendadoresExtra,
  }
}

// ─── El SQL ────────────────────────────────────────────────────────────────

export function sentenciasModulos(plan, T) {
  const m = plan.modulos
  const out = []
  const add = (etiqueta, sql, valores, extra = {}) => out.push({ etiqueta, sql, valores, ...extra })
  const usuario = (email) => `(select u.id from usuarios u where u.tenant_id = $1::uuid and lower(u.email) = lower('${email.replace(/'/g, '')}'))`
  const vendedor = plan.usuarios.find((u) => u.rol === 'VENDEDOR')

  // ── Prospectos ──
  for (const p of m.prospectos) {
    add(
      `prospecto ${p.nombre} (${p.etapa})`,
      `insert into prospectos (tenant_id, tipo, nombre, contacto, direccion, lat, lng, datos, etapa,
                               siguiente_paso, siguiente_paso_fecha, usuario_id, decidido_por, decidido_en,
                               motivo_rechazo, creado_en, tipo_espacio, etapa_responsable, visibilidad,
                               ancho_m, alto_m, superficie_m2, presupuesto_min, presupuesto_max, presupuesto_autoriza,
                               ubicacion_origen, ubicacion_precision_m)
       select $1::uuid, $2::text, $3::text, $4::jsonb, $5::text, $6::numeric, $7::numeric, $8::jsonb, $9::text,
              $10::text, $11::date, ${usuario(vendedor.email)},
              case when $12::date is not null then ${usuario('director.comercial@catalogo.invalid')} end,
              ($12::date + time '17:00')::timestamptz, $13::text, ($14::date + time '10:00')::timestamptz,
              $15::text, $16::smallint, $17::text, $18::numeric, $19::numeric, $20::numeric,
              $21::numeric, $22::numeric, $23::text,
              case when $6::numeric is not null then 'PIN' end, case when $6::numeric is not null then 15 end
        where not exists (select 1 from prospectos x where x.tenant_id = $1::uuid and x.nombre = $3::text)`,
      [T, p.tipo, p.nombre, JSON.stringify(p.contacto), p.direccion, p.lat, p.lng, JSON.stringify(p.datos), p.etapa,
        p.siguientePaso, p.siguientePasoFecha, p.decidido, p.motivo ?? null, p.creado,
        p.tipoEspacio ?? null, p.responsable ?? null, p.visibilidad ?? null, p.ancho ?? null, p.alto ?? null,
        p.ancho && p.alto ? Math.round(p.ancho * p.alto * 100) / 100 : null,
        p.presupuesto?.[0] ?? null, p.presupuesto?.[1] ?? null, p.presupuesto?.[2] ?? null],
    )
    const de = `from prospectos p where p.tenant_id = $1::uuid and p.nombre = $2::text`
    p.avances.forEach((a) => {
      add(
        `avance ${p.nombre} → ${a.nueva}`,
        `insert into prospecto_avances (tenant_id, prospecto_id, usuario_id, etapa_anterior, etapa_nueva, nota, creado_en, canal, contacto_nombre)
         select $1::uuid, p.id, ${usuario(vendedor.email)}, $3::text, $4::text, $5::text, ($6::date + time '12:00')::timestamptz, $7::text, $8::text
           ${de}
            and not exists (select 1 from prospecto_avances x where x.tenant_id = $1::uuid and x.prospecto_id = p.id and x.etapa_nueva = $4::text)`,
        [T, p.nombre, a.anterior, a.nueva, a.nota, a.fecha, a.canal, p.contacto.nombre],
        { silencioso: true },
      )
    })
    for (const c of p.contactos)
      add(
        `contacto ${p.nombre} · ${c.nombre}`,
        `insert into prospecto_contactos (tenant_id, prospecto_id, nombre, papel, telefono, email, es_legal, creado_por)
         select $1::uuid, p.id, $3::text, $4::text, $5::text, $6::text, $7::boolean, ${usuario(vendedor.email)}
           ${de}
            and not exists (select 1 from prospecto_contactos x where x.tenant_id = $1::uuid and x.prospecto_id = p.id and x.nombre = $3::text)`,
        [T, p.nombre, c.nombre, c.papel, c.telefono, c.email, c.legal],
        { silencioso: true },
      )
    for (const c of p.competencia)
      add(
        `competencia ${p.nombre}`,
        `insert into prospecto_competencia (tenant_id, prospecto_id, nombre, nota, desde, creado_por)
         select $1::uuid, p.id, $3::text, $4::text, $5::date, ${usuario(vendedor.email)}
           ${de}
            and not exists (select 1 from prospecto_competencia x where x.tenant_id = $1::uuid and x.prospecto_id = p.id and x.nombre = $3::text)`,
        [T, p.nombre, c.nombre, c.nota, c.desde],
        { silencioso: true },
      )
    for (const o of p.ofertas)
      add(
        `oferta ${p.nombre} v${o.version}`,
        `insert into prospecto_ofertas (tenant_id, prospecto_id, version, fecha, importe_mensual, plazo_meses, estado, notas, creado_por)
         select $1::uuid, p.id, $3::integer, $4::date, $5::numeric, $6::integer, $7::text, $8::text, ${usuario(vendedor.email)}
           ${de}
            and not exists (select 1 from prospecto_ofertas x where x.tenant_id = $1::uuid and x.prospecto_id = p.id and x.version = $3::integer)`,
        [T, p.nombre, o.version, masDias(p.creado, 30 + o.version * 7), o.importe, o.plazo, o.estado, o.nota],
        { silencioso: true },
      )
    for (const n of p.notas)
      add(
        `nota ${p.nombre}`,
        `insert into prospecto_notas (tenant_id, prospecto_id, usuario_id, texto, creado_en)
         select $1::uuid, p.id, ${usuario(vendedor.email)}, $3::text, ($4::date + time '18:00')::timestamptz
           ${de}
            and not exists (select 1 from prospecto_notas x where x.tenant_id = $1::uuid and x.prospecto_id = p.id and x.texto = $3::text)`,
        [T, p.nombre, n, masDias(p.creado, 2)],
        { silencioso: true },
      )
  }

  // ── Códigos y su canje ──
  for (const c of m.codigos)
    add(
      `codigo ${c.codigo}`,
      `insert into codigos_promocionales (tenant_id, codigo, descuento_pct, vigente_desde, vigente_hasta, usos_maximos)
       select $1::uuid, $2::text, $3::numeric, $4::date, $5::date, $6::integer
        where not exists (select 1 from codigos_promocionales x where x.tenant_id = $1::uuid and upper(x.codigo) = upper($2::text))`,
      [T, c.codigo, c.pct, c.desde, c.hasta, c.usos],
    )
  for (const k of m.canjes) {
    const c = m.codigos.find((x) => x.codigo === k.codigo)
    add(
      `canje ${k.codigo} en ${k.propuesta}`,
      `insert into canjes_codigo (tenant_id, codigo_id, propuesta_id, usuario_id, canjeado_en)
       select $1::uuid, c.id, p.id, ${usuario(vendedor.email)}, ($4::date + time '11:00')::timestamptz
         from codigos_promocionales c
         join propuestas p on p.tenant_id = $1::uuid and p.folio = $3::text
        where c.tenant_id = $1::uuid and c.codigo = $2::text
          and not exists (select 1 from canjes_codigo x where x.tenant_id = $1::uuid and x.codigo_id = c.id and x.propuesta_id = p.id)`,
      [T, k.codigo, k.propuesta, k.fecha],
    )
    add(
      `codigo aplicado en ${k.propuesta}`,
      `update propuestas set codigo_texto = $3::text, codigo_estado = 'APROBADO', codigo_descuento_pct = $4::numeric,
              codigo_canjeado_en = ($5::date + time '11:00')::timestamptz,
              codigo_aprobado_por = ${usuario('gerente.ventas@catalogo.invalid')},
              codigo_aprobado_en = ($5::date + time '13:00')::timestamptz
        where tenant_id = $1::uuid and folio = $2::text and codigo_texto is null`,
      [T, k.propuesta, k.codigo, c.pct, k.fecha],
    )
  }

  // ── Paquetes ──
  for (const p of m.paquetes) {
    add(
      `paquete ${p.nombre}`,
      `insert into paquetes (tenant_id, nombre, precio_cerrado, admite_codigo, activo, notas)
       select $1::uuid, $2::text, $3::numeric, $4::boolean, $5::boolean, $6::text
        where not exists (select 1 from paquetes x where x.tenant_id = $1::uuid and x.nombre = $2::text)`,
      [T, p.nombre, p.precio, p.admiteCodigo, p.activo ?? true, p.notas],
    )
    for (const s of p.sitios)
      add(
        `paquete ${p.nombre} · ${s}`,
        `insert into paquete_sitios (tenant_id, paquete_id, sitio_id)
         select $1::uuid, p.id, s.id from paquetes p
           join sitios s on s.tenant_id = $1::uuid and s.clave_interna = $3::text
          where p.tenant_id = $1::uuid and p.nombre = $2::text
            and not exists (select 1 from paquete_sitios x where x.tenant_id = $1::uuid and x.paquete_id = p.id and x.sitio_id = s.id)`,
        [T, p.nombre, s],
        { silencioso: true },
      )
  }

  // ── Franjas, temporadas, rejilla, volumen ──
  for (const f of m.franjas)
    add(
      `franja ${f.nombre}`,
      `insert into franjas_horarias (tenant_id, nombre, hora_inicio, hora_fin, orden)
       select $1::uuid, $2::text, $3::text, $4::text, $5::integer
        where not exists (select 1 from franjas_horarias x where x.tenant_id = $1::uuid and x.nombre = $2::text)`,
      [T, f.nombre, f.inicio, f.fin, f.orden],
    )
  for (const t of m.temporadas)
    add(
      `temporada ${t.nombre}`,
      `insert into temporadas (tenant_id, nombre, desde, hasta)
       select $1::uuid, $2::text, $3::date, $4::date
        where not exists (select 1 from temporadas x where x.tenant_id = $1::uuid and x.nombre = $2::text)`,
      [T, t.nombre, t.desde, t.hasta],
    )
  for (const r of m.tarifas)
    add(
      `rejilla ${r.sitio} ${r.franja} ${r.temporada ?? 'base'}`,
      `insert into sitio_tarifas (tenant_id, sitio_id, unidad, franja_id, temporada_id, tarifa_publicada)
       select $1::uuid, s.id, 'spot', f.id, t.id, $5::numeric
         from sitios s
         join franjas_horarias f on f.tenant_id = $1::uuid and f.nombre = $3::text
         left join temporadas t on t.tenant_id = $1::uuid and t.nombre = $4::text
        where s.tenant_id = $1::uuid and s.clave_interna = $2::text
          and ($4::text is null or t.id is not null)
          and not exists (select 1 from sitio_tarifas x where x.tenant_id = $1::uuid and x.sitio_id = s.id
                            and x.unidad = 'spot' and x.franja_id = f.id
                            and x.temporada_id is not distinct from t.id)`,
      [T, r.sitio, r.franja, r.temporada, r.tarifa],
      { silencioso: true },
    )
  for (const e of m.escalas)
    add(
      `volumen ${e.unidad} desde ${e.desde}`,
      `insert into escalas_volumen (tenant_id, unidad, desde_cantidad, descuento_pct)
       select $1::uuid, $2::text, $3::integer, $4::numeric
        where not exists (select 1 from escalas_volumen x where x.tenant_id = $1::uuid and x.unidad = $2::text and x.desde_cantidad = $3::integer)`,
      [T, e.unidad, e.desde, e.pct],
    )

  // ── Almacén ──
  for (const a of m.activos)
    add(
      `activo ${a.etiqueta} (${a.estado})`,
      `insert into almacen_activos (tenant_id, etiqueta, descripcion, tipo_activo, estado, sitio_id, notas, marca, modelo, numero_serie, placas, ubicacion)
       select $1::uuid, $2::text, $3::text, $4::text, $5::est_activo,
              (select s.id from sitios s where s.tenant_id = $1::uuid and s.clave_interna = $6::text),
              $7::text, $8::text, $9::text, $10::text, $11::text, $12::text
        where not exists (select 1 from almacen_activos x where x.tenant_id = $1::uuid and x.etiqueta = $2::text)`,
      [T, a.etiqueta, a.descripcion, a.tipo, a.estado, a.sitio ?? null, a.notas ?? null, a.marca, a.modelo, a.serie, a.placas ?? null, a.ubicacion],
    )
  for (const v of m.movimientos)
    add(
      `movimiento ${v.activo} ${v.tipo}`,
      `insert into almacen_movimientos (tenant_id, activo_id, tipo, motivo, sitio_id, usuario_id, fecha)
       select $1::uuid, a.id, $3::tipo_mov_almacen, $4::text,
              (select s.id from sitios s where s.tenant_id = $1::uuid and s.clave_interna = $5::text),
              ${usuario('operaciones@catalogo.invalid')}, ($6::date + time '10:30')::timestamptz
         from almacen_activos a
        where a.tenant_id = $1::uuid and a.etiqueta = $2::text
          and not exists (select 1 from almacen_movimientos x where x.tenant_id = $1::uuid and x.activo_id = a.id
                            and x.tipo = $3::tipo_mov_almacen and x.motivo = $4::text)`,
      [T, v.activo, v.tipo, v.motivo, v.sitio ?? null, v.fecha],
    )

  // ── Incidencias ──
  for (const i of m.incidencias)
    add(
      `incidencia ${i.sitio} ${i.tipo}`,
      `insert into incidencias (tenant_id, sitio_id, tipo, descripcion, fecha_inicio, fecha_resolucion, impacta_comercial, estatus,
                                reportado_por_usuario, notas)
       select $1::uuid, s.id, $3::tipo_incidencia, $4::text, ($5::date + time '08:00')::timestamptz,
              ($6::date + time '18:00')::timestamptz, $7::boolean, $8::est_incidencia,
              ${usuario('operaciones@catalogo.invalid')}, 'CAT · incidencia de demostracion.'
         from sitios s
        where s.tenant_id = $1::uuid and s.clave_interna = $2::text
          and not exists (select 1 from incidencias x where x.tenant_id = $1::uuid and x.sitio_id = s.id and x.descripcion = $4::text)`,
      [T, i.sitio, i.tipo, i.descripcion, i.desde, i.resuelta ?? null, i.impacta, i.estatus],
    )

  // ── Evidencias y costo de las OT ──
  for (const e of m.evidencias)
    add(
      `evidencia ${e.ot}`,
      `insert into evidencias_ot (tenant_id, ot_id, foto_url, formato, lat, lng, precision_m, tipo, uploaded_by, tomada_en, timestamp)
       select $1::uuid, o.id, $3::text, 'image/png', $4::numeric, $5::numeric, 8, $6::text,
              ${usuario('operaciones@catalogo.invalid')}, $7::timestamptz, $7::timestamptz + interval '20 minutes'
         from ordenes_trabajo o
        where o.tenant_id = $1::uuid and o.folio = $2::text
          and not exists (select 1 from evidencias_ot x where x.tenant_id = $1::uuid and x.ot_id = o.id)`,
      [T, e.ot, dataUrlDeArte(e.arte), e.lat, e.lng, e.tipo, e.tomada],
      { silencioso: true },
    )
  for (const c of m.costosOt)
    add(
      `costo ${c.ot}`,
      `update ordenes_trabajo set costo_real = coalesce(costo_real, $3::numeric),
              instrucciones = coalesce(instrucciones, $4::text), notas = coalesce(notas, $5::text),
              supervisor = coalesce(supervisor, ${usuario('administrador@catalogo.invalid')})
        where tenant_id = $1::uuid and folio = $2::text and costo_real is null`,
      [T, c.ot, c.costo, c.instrucciones, c.notas],
    )

  // ── Cobranza: abonos ──
  for (const a of m.abonos)
    add(
      `abono ${a.factura}`,
      `insert into cobranza_abonos (tenant_id, cobranza_id, monto, fecha, origen, usuario_id, comprobante_url)
       select $1::uuid, co.id, $3::numeric, $4::date, $5::text, ${usuario('finanzas@catalogo.invalid')}, $6::text
         from cobranzas co
         join facturas f on f.id = co.factura_id and f.tenant_id = $1::uuid and f.folio = $2::text
        where co.tenant_id = $1::uuid
          and not exists (select 1 from cobranza_abonos x where x.tenant_id = $1::uuid and x.cobranza_id = co.id)`,
      [T, a.factura, a.monto, a.fecha, a.origen,
        a.conComprobante ? dataUrlDePdf('Comprobante de pago', [`Factura ${a.factura}`, `Importe: $${a.monto.toLocaleString('en-US')} MXN`, `Fecha: ${a.fecha}`, a.anticipo ? 'Anticipo del 30%' : 'Pago total', 'Transferencia SPEI de demostracion']) : null],
    )
  // El anticipo de la 013 se refleja en lo pagado de su cobranza.
  for (const a of m.abonos.filter((x) => x.anticipo))
    add(
      `pagado ${a.factura}`,
      `update cobranzas co set monto_pagado = $3::numeric
         from facturas f
        where f.id = co.factura_id and f.tenant_id = $1::uuid and f.folio = $2::text
          and co.tenant_id = $1::uuid and co.monto_pagado = 0`,
      [T, a.factura, a.monto],
    )

  // ── Extensión con contrato ──
  for (const x of m.extensiones)
    add(
      `extension ${x.campana}`,
      `insert into campana_extensiones (tenant_id, campana_id, folio, fecha_fin_anterior, fecha_fin_nueva, contrato_url, usuario_id, usuario_nombre)
       select $1::uuid, c.id, c.folio, $3::date, $4::date, $5::text, ${usuario('administrador@catalogo.invalid')}, 'Administradora DEMO'
         from campanas c
        where c.tenant_id = $1::uuid and c.folio = $2::text
          and not exists (select 1 from campana_extensiones e where e.tenant_id = $1::uuid and e.campana_id = c.id)`,
      [T, x.campana, x.anterior, x.nueva,
        dataUrlDePdf('Convenio de extension de campana', [`Campana ${x.campana}`, `Fin anterior: ${x.anterior}`, `Fin nuevo: ${x.nueva}`, 'Mismas pantallas y tarifa mensual.'])],
    )

  // ── Órdenes de compra ──
  for (const o of m.ordenesCompra)
    add(
      `orden de compra ${o.folio}`,
      `insert into ordenes_compra (tenant_id, folio, numero_oc, campana_id, monto, fecha, estatus, documento_url, notas)
       select $1::uuid, $2::text, $3::text, c.id, $4::numeric, $5::date, $6::est_odc, $7::text, 'CAT · orden de compra del cliente.'
         from campanas c where c.tenant_id = $1::uuid and c.folio = $8::text
       on conflict (folio) do nothing`,
      [T, o.folio, o.numero, o.monto, o.fecha, o.estatus,
        o.estatus === 'RECIBIDA' ? dataUrlDePdf('Orden de compra', [`OC ${o.numero}`, `Campana ${o.campana}`, `Importe con IVA: $${o.monto.toLocaleString('en-US')} MXN`]) : null,
        o.campana],
    )

  // ── Notificaciones (las de la organización) y quién las leyó ──
  for (const n of m.notificaciones) {
    add(
      `notificacion ${n.titulo}`,
      `insert into notificaciones (tenant_id, tipo, nivel, titulo, detalle, link, leida, creado_en)
       select $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, false, ($7::date + time '09:00')::timestamptz
        where not exists (select 1 from notificaciones x where x.tenant_id = $1::uuid and x.titulo = $4::text)`,
      [T, n.tipo, n.nivel, n.titulo, n.detalle, n.link, masDias(plan.hoy, n.dias)],
    )
    if (n.leidaPor)
      add(
        `notificacion leida ${n.titulo}`,
        `insert into notificaciones_usuario (tenant_id, notificacion_id, usuario_id, leida_en)
         select $1::uuid, n.id, u.id, now()
           from notificaciones n
           join usuarios u on u.tenant_id = $1::uuid and lower(u.email) = lower($3::text)
          where n.tenant_id = $1::uuid and n.titulo = $2::text
            and not exists (select 1 from notificaciones_usuario x where x.tenant_id = $1::uuid and x.notificacion_id = n.id and x.usuario_id = u.id)`,
        [T, n.titulo, n.leidaPor],
      )
  }

  // ── Actividad ──
  // La bitácora es APPEND-ONLY por trigger (`20260629_bitacora_append_only.sql`):
  // ni UPDATE ni DELETE, ni siquiera el superusuario. Dos consecuencias:
  //  · estas entradas NO se pueden deshacer, y se quedan (lo dice el informe);
  //  · van con `usuario_id` NULL y el nombre en texto. Con el id, borrar al
  //    usuario demo haría un `on delete set null` sobre la bitácora —un
  //    UPDATE— y el trigger tumbaría el --deshacer entero (pasó el 2026-11-03).
  for (const a of m.acciones)
    add(
      `actividad ${a.accion}`,
      `insert into acciones (tenant_id, accion, entidad, usuario_id, usuario_nombre, timestamp)
       select $1::uuid, $2::text, $3::text, null, coalesce(u.nombre, 'Sistema'), $5::timestamptz
         from (select 1) x left join usuarios u on u.tenant_id = $1::uuid and lower(u.email) = lower($4::text)
        where not exists (select 1 from acciones y where y.tenant_id = $1::uuid and y.accion = $2::text)`,
      [T, a.accion, a.entidad, a.email, a.cuando],
      { silencioso: true },
    )

  // ── Tickets ──
  for (const t of m.tickets)
    add(
      `ticket ${t.folio}`,
      `insert into tickets (tenant_id, folio, asunto, cuerpo, estado, prioridad, creado_por_usuario, creado_en, respuesta, respondido_en)
       select $1::uuid, $2::text, $3::text, $4::text, $5::est_ticket, $6::prioridad, ${usuario('administrador@catalogo.invalid')},
              ($7::date + time '10:00')::timestamptz, $8::text,
              case when $8::text is not null then ($7::date + time '16:00')::timestamptz end
        where not exists (select 1 from tickets x where x.tenant_id = $1::uuid and x.folio = $2::text)`,
      [T, t.folio, t.asunto, t.cuerpo, t.estado, t.prioridad, masDias(plan.hoy, t.dias), t.respuesta],
    )

  // ── Campos vacíos de filas del catálogo (solo si siguen vacíos) ──
  for (const p of plan.propuestas) {
    const enviada = ['ENVIADA', 'APROBADA', 'RECHAZADA'].includes(p.estatus)
    add(
      `ficha propuesta ${p.folio}`,
      `update propuestas set condiciones = coalesce(condiciones, $3::text),
              vendedor_nombre = coalesce(vendedor_nombre, $4::text),
              vigente_hasta = coalesce(vigente_hasta, case when $5::boolean then $6::date + 30 end),
              aprobada_en = coalesce(aprobada_en, case when estatus = 'APROBADA' then aceptado_en end),
              rechazada_en = coalesce(rechazada_en, case when estatus = 'RECHAZADA' then ($6::date + 7)::timestamptz end)
        where tenant_id = $1::uuid and folio = $2::text and condiciones is null`,
      [T, p.folio, m.condiciones, vendedor.nombre, enviada, p.fecha],
      { silencioso: true },
    )
  }
  for (const c of plan.campanas) {
    const cliente = plan.clientes.find((x) => x.clave === c.cliente)
    // Horario propio en DOOHmain solo en la 015 (todas las tardes entre semana):
    // es el caso que enseña la ficha. Se guarda como dato; no se publica nada.
    const horario = c.n === '015'
    add(
      `ficha campana ${c.folio}`,
      `update campanas set marca = coalesce(marca, $3::text),
              doohmain_hora_inicio = case when $4::boolean and doohmain_hora_inicio is null then '16:00' else doohmain_hora_inicio end,
              doohmain_hora_fin = case when $4::boolean and doohmain_hora_fin is null then '22:00' else doohmain_hora_fin end,
              doohmain_dias = case when $4::boolean and doohmain_dias is null then array[1,2,3,4,5]::smallint[] else doohmain_dias end,
              contrato_url = coalesce(contrato_url, case when $5::boolean then $6::text end)
        where tenant_id = $1::uuid and folio = $2::text and marca is null`,
      [T, c.folio, cliente.nombre.replace(' DEMO', '').split(' ')[0], horario,
        ['ACTIVA', 'CONFIRMADA', 'LISTA_FACTURAR'].includes(c.estado),
        dataUrlDePdf('Contrato de publicidad exterior', [`Campana ${c.folio}`, `Cliente: ${cliente.razonSocial}`, `Vigencia: ${c.desde} a ${c.hasta}`, `Importe neto: $${c.neto.toLocaleString('en-US')} MXN mas IVA`])],
      { silencioso: true },
    )
  }
  for (const s of m.sitiosExtra)
    add(
      `ficha pantalla ${s.clave}`,
      `update sitios set orientacion = coalesce(orientacion, $3::text), vista = coalesce(vista, $4::text),
              tramo = coalesce(tramo, $5::text), costo_compra = coalesce(costo_compra, $6::numeric),
              precio_m2 = coalesce(precio_m2, $7::numeric), tarifa_impresion = coalesce(tarifa_impresion, $8::numeric),
              max_clientes = coalesce(max_clientes, $9::integer), imagen_promocional = coalesce(imagen_promocional, $10::text)
        where tenant_id = $1::uuid and clave_interna = $2::text and orientacion is null`,
      [T, s.clave, s.orientacion, s.vista, s.tramo, s.costoCompra, s.precioM2, s.tarifaImpresion, s.maxClientes,
        s.imagen ? dataUrlDeArte(s.imagen) : null],
      { silencioso: true },
    )
  for (const p of plan.predios) {
    const s = plan.sitios.find((x) => x.predio === p.clave)
    add(
      `coordenadas ${p.nombre}`,
      `update predios set lat = $3::numeric, lng = $4::numeric
        where tenant_id = $1::uuid and nombre = $2::text and lat is null`,
      [T, p.nombre, s.lat, s.lng],
      { silencioso: true },
    )
  }
  for (const a of m.arrendadoresExtra) {
    add(
      `ficha arrendador ${a.nombre}`,
      `update arrendadores set cuenta_bancaria = coalesce(cuenta_bancaria, $3::text), notas = coalesce(notas, $4::text),
              nacionalidad = coalesce(nacionalidad, $5::text)
        where tenant_id = $1::uuid and nombre = $2::text and cuenta_bancaria is null`,
      [T, a.nombre, a.cuenta, a.notas, a.nacionalidad],
      { silencioso: true },
    )
    if (a.razon)
      add(
        `razon social de ${a.nombre}`,
        `insert into arrendador_razon_social (tenant_id, arrendador_id, razon_social, rfc, regimen)
         select $1::uuid, a.id, $3::text, $4::text, $5::text from arrendadores a
          where a.tenant_id = $1::uuid and a.nombre = $2::text
            and not exists (select 1 from arrendador_razon_social x where x.tenant_id = $1::uuid and x.arrendador_id = a.id)`,
        [T, a.nombre, a.razon.razon, a.razon.rfc, a.razon.regimen],
      )
  }
  // Rentas pagadas del último año con su comprobante.
  for (const pg of plan.pagos.filter((x) => x.estatus === 'PAGADO' && nDia(x.periodo) >= nDia(plan.hoy) - 365)) {
    const k = plan.contratos.find((x) => x.clave === pg.contrato)
    const predio = plan.predios.find((x) => x.clave === k.predio).nombre
    add(
      `comprobante renta ${k.clave} ${pg.periodo}`,
      `update pagos_renta pr set comprobante_url = $5::text
         from contratos_arrendamiento c
         join predios p on p.id = c.predio_id and p.tenant_id = $1::uuid and p.nombre = $2::text
        where pr.contrato_id = c.id and c.tenant_id = $1::uuid and c.fecha_inicio = $3::date
          and pr.tenant_id = $1::uuid and pr.periodo = $4::text and pr.comprobante_url is null`,
      [T, predio, k.inicio, pg.periodo,
        dataUrlDePdf('Comprobante de pago de renta', [`Predio: ${predio}`, `Periodo: ${pg.periodo}`, `Importe: $${pg.monto.toLocaleString('en-US')} MXN`, 'Transferencia de demostracion'])],
      { silencioso: true },
    )
  }
  // Documento de los contratos vigentes.
  for (const k of plan.contratos.filter((x) => ['VIGENTE', 'RENOVADO', 'POR_VENCER'].includes(x.estatus))) {
    const predio = plan.predios.find((x) => x.clave === k.predio).nombre
    add(
      `documento contrato ${k.clave}`,
      `update contratos_arrendamiento c set documento_url = $4::text
         from predios p
        where p.id = c.predio_id and p.tenant_id = $1::uuid and p.nombre = $2::text
          and c.tenant_id = $1::uuid and c.fecha_inicio = $3::date and c.documento_url is null`,
      [T, predio, k.inicio,
        dataUrlDePdf('Contrato de arrendamiento', [`Predio: ${predio}`, `Inicio: ${k.inicio}  Fin: ${k.fin}`, `Renta: $${k.renta.toLocaleString('en-US')} MXN ${k.per.toLowerCase()}`, 'Uso permitido: publicidad exterior'])],
      { silencioso: true },
    )
  }

  // ── Comisiones: la agencia del catálogo con su negociación validada ──
  const agencia = plan.clientes.find((c) => c.tipo === 'AGENCIA')
  add(
    `negociacion de ${agencia.nombre}`,
    `update clientes set tiene_negociacion = true, negociacion_validada = true, negociacion_nota = $3::text
      where tenant_id = $1::uuid and rfc = $2::text and negociacion_nota is null`,
    [T, agencia.rfc, m.negociacionAgencia],
  )

  // ── Franjas: una campaña digital programada en la de la mañana ──
  // La 016, que es toda digital y no lleva horario propio de DOOHmain (la 015
  // enseña ese: la pantalla no admite las dos cosas a la vez).
  add(
    'franja programada de CAT-CMP-016',
    `update campanas set franja_programada_id = f.id
       from franjas_horarias f
      where f.tenant_id = $1::uuid and f.nombre = 'CAT Manana'
        and campanas.tenant_id = $1::uuid and campanas.folio = 'CAT-CMP-016' and campanas.franja_programada_id is null`,
    [T],
  )

  // ── Ganado del mes: la última aprobación cae en este mes ──
  // El Dashboard enseña «Ganado en <mes>»; con todas las aprobaciones en meses
  // pasados salía en cero. La más reciente se acepta dos días antes de hoy.
  add(
    `aprobacion reciente ${m.aprobacionReciente.folio}`,
    `update propuestas set aceptado_en = ($3::date + time '12:30')::timestamptz, aprobada_en = ($3::date + time '12:30')::timestamptz
      where tenant_id = $1::uuid and folio = $2::text and estatus = 'APROBADA' and fecha <= $3::date
        and aceptado_en < ($3::date)::timestamptz`,
    [T, m.aprobacionReciente.folio, m.aprobacionReciente.fecha],
  )

  // ── La organización: identidad, logotipo y condiciones de propuesta ──
  // Solo si siguen vacías: si la persona que da la demo ya puso las suyas, no
  // se tocan. El token del logotipo ya lo pone la base al crear la fila.
  const o = m.organizacion
  add(
    'identidad de la organizacion',
    `update tenants set razon_social = coalesce(razon_social, $2::text), nombre_comercial = coalesce(nombre_comercial, $3::text),
            rfc = coalesce(rfc, $4::text), domicilio_fiscal = coalesce(domicilio_fiscal, $5::text),
            representante_legal = coalesce(representante_legal, $6::text), datos_constitucion = coalesce(datos_constitucion, $7::text)
      where id = $1::uuid and razon_social is null`,
    [T, o.razonSocial, o.nombreComercial, o.rfc, o.domicilio, o.representante, o.constitucion],
  )
  add(
    'logotipo de la organizacion',
    `update config_negocio set logo_url = $2::text,
            email_remitente = coalesce(email_remitente, $3::text)
      where tenant_id = $1::uuid and logo_url is null`,
    [T, dataUrlDeArte(o.logo), o.remitente],
  )

  // ── La organización: condiciones de propuesta ──
  add(
    'condiciones de propuesta de la organizacion',
    `update config_negocio set condiciones_propuesta = $2::text
      where tenant_id = $1::uuid and condiciones_propuesta is null`,
    [T, m.condiciones],
  )
  return out
}

// ─── La vuelta atrás de lo de aquí ─────────────────────────────────────────
// Va ANTES que la del catálogo: varias de estas filas cuelgan de las suyas.
// Las columnas rellenadas en filas del catálogo se van con sus filas; las de
// la organización se devuelven a vacío solo si siguen con el valor sembrado.
export function deshacerModulos(plan, T) {
  const m = plan.modulos
  const q = (etiqueta, sql, valores = [T]) => ({ etiqueta, sql, valores })
  const nombres = m.prospectos.map((p) => p.nombre)
  const deProspecto = (tabla) => q(tabla, `delete from ${tabla} where tenant_id = $1::uuid and prospecto_id in
        (select id from prospectos where tenant_id = $1::uuid and nombre = any($2::text[]))`, [T, nombres])
  return [
    deProspecto('prospecto_avances'),
    deProspecto('prospecto_contactos'),
    deProspecto('prospecto_competencia'),
    deProspecto('prospecto_ofertas'),
    deProspecto('prospecto_notas'),
    q('prospectos', `delete from prospectos where tenant_id = $1::uuid and nombre = any($2::text[])`, [T, nombres]),
    q('canjes_codigo', `delete from canjes_codigo where tenant_id = $1::uuid and codigo_id in
        (select id from codigos_promocionales where tenant_id = $1::uuid and codigo like 'CAT-%')`),
    q('codigos_promocionales', `delete from codigos_promocionales where tenant_id = $1::uuid and codigo like 'CAT-%'`),
    q('paquete_sitios', `delete from paquete_sitios where tenant_id = $1::uuid and paquete_id in
        (select id from paquetes where tenant_id = $1::uuid and nombre like 'Paquete CAT %')`),
    q('paquetes', `delete from paquetes where tenant_id = $1::uuid and nombre like 'Paquete CAT %'`),
    // La campaña programada en una franja CAT la referencia: se suelta antes.
    q('campanas', `update campanas set franja_programada_id = null
      where tenant_id = $1::uuid and folio like 'CAT-CMP-%' and franja_programada_id in
        (select id from franjas_horarias where tenant_id = $1::uuid and nombre like 'CAT %')`),
    q('sitio_tarifas', `delete from sitio_tarifas where tenant_id = $1::uuid and franja_id in
        (select id from franjas_horarias where tenant_id = $1::uuid and nombre like 'CAT %')`),
    q('franjas_horarias', `delete from franjas_horarias where tenant_id = $1::uuid and nombre like 'CAT %'`),
    q('temporadas', `delete from temporadas where tenant_id = $1::uuid and nombre like 'CAT %'`),
    q('escalas_volumen', `delete from escalas_volumen where tenant_id = $1::uuid and (unidad, desde_cantidad) in
        (select * from unnest($2::text[], $3::int[]))`, [T, m.escalas.map((e) => e.unidad), m.escalas.map((e) => e.desde)]),
    q('almacen_movimientos', `delete from almacen_movimientos where tenant_id = $1::uuid and activo_id in
        (select id from almacen_activos where tenant_id = $1::uuid and etiqueta like 'CAT-ALM-%')`),
    q('almacen_activos', `delete from almacen_activos where tenant_id = $1::uuid and etiqueta like 'CAT-ALM-%'`),
    q('incidencias', `delete from incidencias where tenant_id = $1::uuid and notas = 'CAT · incidencia de demostracion.'`),
    q('evidencias_ot', `delete from evidencias_ot where tenant_id = $1::uuid and ot_id in
        (select id from ordenes_trabajo where tenant_id = $1::uuid and folio like 'CAT-OT-%')`),
    q('cobranza_abonos', `delete from cobranza_abonos where tenant_id = $1::uuid and cobranza_id in
        (select co.id from cobranzas co join facturas f on f.id = co.factura_id
          where co.tenant_id = $1::uuid and f.tenant_id = $1::uuid and f.folio like 'CAT-FAC-%')`),
    q('campana_extensiones', `delete from campana_extensiones where tenant_id = $1::uuid and folio like 'CAT-CMP-%'`),
    q('ordenes_compra', `delete from ordenes_compra where tenant_id = $1::uuid and folio like 'CAT-OC-%'`),
    q('notificaciones_usuario', `delete from notificaciones_usuario where tenant_id = $1::uuid and notificacion_id in
        (select id from notificaciones where tenant_id = $1::uuid and titulo = any($2::text[]))`, [T, m.notificaciones.map((n) => n.titulo)]),
    q('notificaciones', `delete from notificaciones where tenant_id = $1::uuid and titulo = any($2::text[])`, [T, m.notificaciones.map((n) => n.titulo)]),
    // `acciones` NO está aquí a propósito: la bitácora es append-only (ver
    // `sentenciasModulos`) y sus entradas de ejemplo se quedan.
    q('tickets', `delete from tickets where tenant_id = $1::uuid and folio like 'CAT-TKT-%'`),
    q('arrendador_razon_social', `delete from arrendador_razon_social where tenant_id = $1::uuid and arrendador_id in
        (select id from arrendadores where tenant_id = $1::uuid and nombre = any($2::text[]))`, [T, plan.arrendadores.map((a) => a.nombre)]),
    q('tenants', `update tenants set razon_social = null, nombre_comercial = null, rfc = null, domicilio_fiscal = null,
            representante_legal = null, datos_constitucion = null
      where id = $1::uuid and razon_social = $2::text`, [T, m.organizacion.razonSocial]),
    q('config_negocio', `update config_negocio set logo_url = null, email_remitente = null
      where tenant_id = $1::uuid and email_remitente = $2::text`, [T, m.organizacion.remitente]),
    q('config_negocio', `update config_negocio set condiciones_propuesta = null
      where tenant_id = $1::uuid and condiciones_propuesta = $2::text`, [T, m.condiciones]),
  ]
}

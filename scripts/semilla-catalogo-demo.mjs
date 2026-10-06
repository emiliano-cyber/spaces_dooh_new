#!/usr/bin/env node
// ============================================================================
//  semilla-catalogo-demo.mjs — el CATÁLOGO de la demostración: un negocio
//  entero, con historia desde 2024 y contratos hasta 2028.
// ----------------------------------------------------------------------------
//  Uso:
//    DATABASE_URL=postgresql://usuario:clave@host:puerto/base \
//    SEMILLA_CLAVE='<contraseña de los usuarios demo>' \
//      node scripts/semilla-catalogo-demo.mjs --org=demo-rentabilidad
//
//    ... --resumen        imprime lo que sembraría. NO toca ninguna base
//    ... --ancla=AAAA-MM-DD  el «hoy» con el que se decide qué renta está
//                            pagada y cuál vencida (por omisión hoy)
//    ... --org-nombre='...'  nombre visible si la organización hay que crearla
//    ... --deshacer       vuelta atrás: borra SOLO lo sembrado aquí (lo `CAT-`)
//                         de esa organización. No pide SEMILLA_CLAVE
//
//  ─── Por qué existe, y por qué NO es `semilla-demo.mjs` ────────────────────
//  `semilla-demo.mjs` es un GUION: dos pantallas comparables y una diferencia
//  puesta a propósito en la operación, para que el reporte de rentabilidad
//  cuente UNA frase. Está afinado al peso y su prueba fija las cifras. Meterle
//  veinte pantallas más movería los totales que el dueño ya validó.
//
//  Esto es lo otro que pide una demostración: que CADA pantalla del producto
//  tenga algo que enseñar. Pantallas digitales y fijas en cada uno de los seis
//  estados comerciales —y los estados legales y operativos repartidos entre
//  ellas—, propuestas en los cuatro estados, campañas en los siete, contratos de
//  arrendamiento vigentes, por vencer, vencidos, renovados, cancelados e
//  incompletos, su calendario de pagos, recibos de luz mes a mes y un usuario
//  por cada rol asignable. Las dos semillas conviven en la misma organización:
//  todo lo de aquí lleva el prefijo `CAT-` y lo del guion `DEMO-`, así que
//  ninguna toca las filas de la otra.
//
//  ─── Coherencia, que es lo que se mira en una demo ──────────────────────────
//  Un estado que no cuadra con los datos se ve enseguida delante de gente: una
//  pantalla OCUPADA sin campaña activa, una campaña COMPLETADA sin comprobante,
//  una propuesta APROBADA sin campaña. Por eso el estado de cada pantalla sale
//  de sus reservas y no al revés: las OCUPADAS tienen campaña ACTIVA hoy, las
//  RESERVADAS tienen campañas confirmadas o en cotización por delante, y las
//  DISPONIBLES solo tienen historia. `--resumen` lo comprueba antes de tocar
//  nada (ver `comprobarCoherencia`).
//
//  ─── Idempotente, con las mismas reglas que la semilla del guion ───────────
//  Cada `insert` va guardado por su clave natural: `on conflict` donde hay
//  índice único (folios, `clave_interna`, el correo del usuario) y
//  `not exists` filtrado por `tenant_id` donde no. Correrla dos veces no
//  duplica nada: una reserva repetida sería ingreso doble en el reporte sin dar
//  error, que es el fallo que este repositorio persigue.
//
//  ─── Los usuarios, y su contraseña ─────────────────────────────────────────
//  Uno por rol de `ROLES_ASIGNABLES` (`apps/web/lib/roles.ts`). Quedan fuera
//  `CLIENTE` (ADR 0010) y `COMERCIAL` (ADR 0040): no tienen filas en
//  `rol_permisos`, entrarían y recibirían 403 en todo.
//
//  La contraseña NO está en este archivo: entra por `SEMILLA_CLAVE`. Un archivo
//  versionado con la clave de ocho cuentas —una de ellas DUENO— es una clave
//  publicada. Se cifra en la base con `crypt(…, gen_salt('bf', 10))` de
//  pgcrypto, que produce el mismo `$2a$` que `bcryptjs` sabe comparar
//  (`lib/server/auth.ts`), y así el script no necesita más dependencia que `pg`.
//  Un usuario que ya existe NO se toca: su contraseña se queda como esté.
//
//  ─── No viaja en la imagen ─────────────────────────────────────────────────
//  Igual que `semilla-demo.mjs`: el `Dockerfile` copia `scripts/` por lista
//  blanca y este archivo no está en ella. Una instancia de cliente no puede
//  nacer con las pantallas de una demostración dentro.
//
//  ─── Nada real ─────────────────────────────────────────────────────────────
//  Correos en `.invalid` (RFC 2606), RFC que empiezan por `DMO`, teléfonos en
//  ceros y nombres con «DEMO». Las coordenadas son de avenidas públicas, para
//  que el mapa pinte algo con sentido.
// ============================================================================
import pg from 'pg'

// ─── Fechas de CALENDARIO, sin zona horaria ────────────────────────────────
// La misma técnica que `semilla-demo.mjs`: `new Date('2026-07-01')` es
// medianoche UTC y en México cae al día anterior. Todo aquí es aritmética de
// día absoluto.

function nDia(iso) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(a, m - 1, d) / 86_400_000
}

function isoDe(n) {
  const d = new Date(n * 86_400_000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function masDias(iso, k) {
  return isoDe(nDia(iso) + k)
}

function hoyIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Meses comerciales de un rango, redondeados y nunca menos de uno. */
export function mesesDe(desde, hasta) {
  return Math.max(1, Math.round((nDia(hasta) - nDia(desde) + 1) / 30.4))
}

const MESES_POR_PERIODO = { MENSUAL: 1, BIMESTRAL: 2, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 }

/**
 * El vencimiento k-ésimo de un contrato. Reproduce `periodoDeIndice`
 * (`apps/web/lib/renta-periodicidad.ts`): se ancla al día de inicio y se recorta
 * al último día del mes cuando ese día no existe. Si aquí se calculara de otra
 * forma, el calendario sembrado y el que genera la app al editar el contrato
 * tendrían periodos distintos, y el índice único `(contrato_id, periodo)`
 * dejaría entrar los dos.
 */
export function vencimiento(inicio, k, periodicidad) {
  const meses = MESES_POR_PERIODO[periodicidad] ?? 1
  const [a, m, d] = inicio.split('-').map(Number)
  const destino = new Date(Date.UTC(a, m - 1 + k * meses, 1))
  const ultimo = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate()
  destino.setUTCDate(Math.min(d, ultimo))
  return isoDe(destino.getTime() / 86_400_000)
}

// ─── El catálogo, como dato ────────────────────────────────────────────────

const ARRENDADORES = [
  { clave: 'A1', nombre: 'Inmobiliaria DEMO Reforma', rfc: 'DMO020202AR1', formaPago: 'TRANSFERENCIA' },
  { clave: 'A2', nombre: 'Familia DEMO Hernandez', rfc: 'DMO020202AR2', formaPago: 'TRANSFERENCIA' },
  { clave: 'A3', nombre: 'Plaza DEMO Satelite', rfc: 'DMO020202AR3', formaPago: 'TRANSFERENCIA' },
  { clave: 'A4', nombre: 'Grupo DEMO Occidente', rfc: 'DMO020202AR4', formaPago: 'CHEQUE' },
  { clave: 'A5', nombre: 'Edificio DEMO Polanco', rfc: 'DMO020202AR5', formaPago: 'EFECTIVO' },
].map((a, i) => ({
  ...a,
  telefono: `55 0000 01${String(i + 1).padStart(2, '0')}`,
  email: `arrendador.${a.clave.toLowerCase()}@catalogo.invalid`,
  direccion: `Domicilio DEMO ${a.clave}, Ciudad de Mexico`,
}))

// `estado` del predio cuenta su historia: Coyoacán está en problema legal y por
// eso su contrato se canceló; los demás están ocupados por una pantalla nuestra.
const PREDIOS = [
  { clave: 'REF', arr: 'A1', nombre: 'Predio CAT Reforma', direccion: 'Paseo de la Reforma DEMO 000, Cuauhtemoc, CDMX', tipo: 'Azotea', estado: 'OCUPADO' },
  { clave: 'PER', arr: 'A2', nombre: 'Predio CAT Periferico', direccion: 'Anillo Periferico DEMO 000, Miguel Hidalgo, CDMX', tipo: 'Terreno', estado: 'OCUPADO' },
  { clave: 'SAT', arr: 'A3', nombre: 'Predio CAT Satelite', direccion: 'Circuito DEMO Satelite 000, Naucalpan, Edo. Mex.', tipo: 'Plaza comercial', estado: 'OCUPADO' },
  { clave: 'INN', arr: 'A2', nombre: 'Predio CAT Insurgentes Norte', direccion: 'Insurgentes Norte DEMO 000, Gustavo A. Madero, CDMX', tipo: 'Bardado industrial', estado: 'OCUPADO' },
  { clave: 'GDL', arr: 'A4', nombre: 'Predio CAT Vallarta', direccion: 'Avenida Vallarta DEMO 000, Zapopan, Jalisco', tipo: 'Terreno', estado: 'OCUPADO' },
  { clave: 'POL', arr: 'A5', nombre: 'Predio CAT Polanco', direccion: 'Presidente Masaryk DEMO 000, Polanco, CDMX', tipo: 'Fachada', estado: 'OCUPADO' },
  { clave: 'COY', arr: 'A1', nombre: 'Predio CAT Coyoacan', direccion: 'Avenida Universidad DEMO 000, Coyoacan, CDMX', tipo: 'Azotea', estado: 'PROBLEMA_LEGAL' },
  { clave: 'SFE', arr: 'A4', nombre: 'Predio CAT Santa Fe', direccion: 'Vasco de Quiroga DEMO 000, Cuajimalpa, CDMX', tipo: 'Edificio corporativo', estado: 'OCUPADO' },
]

const CIUDAD = {
  REF: { alcaldia: 'Cuauhtemoc', plaza: 'Ciudad de Mexico', ciudad: 'Ciudad de Mexico', estado: 'Ciudad de Mexico', lat: 19.4270, lng: -99.1677 },
  PER: { alcaldia: 'Miguel Hidalgo', plaza: 'Ciudad de Mexico', ciudad: 'Ciudad de Mexico', estado: 'Ciudad de Mexico', lat: 19.4206, lng: -99.2105 },
  SAT: { alcaldia: 'Naucalpan', plaza: 'Zona Metropolitana', ciudad: 'Naucalpan', estado: 'Estado de Mexico', lat: 19.5100, lng: -99.2333 },
  INN: { alcaldia: 'Gustavo A. Madero', plaza: 'Ciudad de Mexico', ciudad: 'Ciudad de Mexico', estado: 'Ciudad de Mexico', lat: 19.4870, lng: -99.1430 },
  GDL: { alcaldia: 'Zapopan', plaza: 'Guadalajara', ciudad: 'Zapopan', estado: 'Jalisco', lat: 20.6767, lng: -103.4170 },
  POL: { alcaldia: 'Miguel Hidalgo', plaza: 'Ciudad de Mexico', ciudad: 'Ciudad de Mexico', estado: 'Ciudad de Mexico', lat: 19.4318, lng: -99.1950 },
  COY: { alcaldia: 'Coyoacan', plaza: 'Ciudad de Mexico', ciudad: 'Ciudad de Mexico', estado: 'Ciudad de Mexico', lat: 19.3467, lng: -99.1617 },
  SFE: { alcaldia: 'Cuajimalpa', plaza: 'Ciudad de Mexico', ciudad: 'Ciudad de Mexico', estado: 'Ciudad de Mexico', lat: 19.3590, lng: -99.2590 },
}

// ─── Las pantallas ─────────────────────────────────────────────────────────
//
// Doce fijas y doce digitales, DOS de cada clase en cada uno de los seis
// estados comerciales. Los estados legal y operativo se reparten de forma que
// cada valor de los dos enums aparezca al menos dos veces, y siempre con
// sentido: una pantalla en mantenimiento comercial está en mantenimiento o
// dañada en operación; una bloqueada tiene el permiso vencido, en trámite o
// suspendido; una de baja está apagada o dada de baja.
//
// `pausa` marca la pausa legal (`sitios.pausa_legal`), que es lo que de verdad
// impide reservarla. Va solo en bloqueadas por permiso, que es su caso real.
//
// [clave, nombre, tipo_medio, predio, ancho, alto, caras, tarifa, comercial, legal, operativo, pausa]
const FIJAS = [
  ['F01', 'Espectacular Reforma Norte', 'ESPECTACULAR', 'REF', 12.9, 7.2, 1, 85000, 'OCUPADO', 'EN_ORDEN', 'ACTIVO', false],
  ['F02', 'Espectacular Reforma Sur', 'ESPECTACULAR', 'REF', 12.9, 7.2, 2, 80000, 'OCUPADO', 'EN_ORDEN', 'ACTIVO', false],
  ['F03', 'Muro Periferico Sur', 'MURAL', 'PER', 20, 8, 1, 60000, 'RESERVADO', 'EN_ORDEN', 'ACTIVO', false],
  ['F04', 'Valla Satelite', 'VALLA', 'SAT', 8, 3, 1, 22000, 'RESERVADO', 'EN_TRAMITE', 'ACTIVO', false],
  ['F05', 'Puente peatonal Insurgentes Norte', 'PUENTE_PEATONAL', 'INN', 15, 2, 2, 35000, 'DISPONIBLE', 'EN_ORDEN', 'ACTIVO', false],
  ['F06', 'Espectacular Vallarta', 'ESPECTACULAR', 'GDL', 12.9, 7.2, 1, 55000, 'DISPONIBLE', 'EN_ORDEN', 'ACTIVO', false],
  ['F07', 'Parabus Polanco', 'MOBILIARIO_URBANO', 'POL', 1.2, 1.8, 2, 9000, 'BLOQUEADO', 'PERMISO_VENCIDO', 'APAGADO', true],
  ['F08', 'Espectacular Coyoacan', 'ESPECTACULAR', 'COY', 12.9, 7.2, 1, 48000, 'BLOQUEADO', 'SUSPENDIDO', 'ACTIVO', true],
  ['F09', 'Espectacular Periferico Norte', 'ESPECTACULAR', 'PER', 12.9, 7.2, 1, 58000, 'EN_MANTENIMIENTO', 'EN_ORDEN', 'EN_MANTENIMIENTO', false],
  ['F10', 'Mural Satelite', 'MURAL', 'SAT', 15, 6, 1, 30000, 'EN_MANTENIMIENTO', 'EN_ORDEN', 'DANADO', false],
  ['F11', 'Valla Insurgentes Norte', 'VALLA', 'INN', 8, 3, 1, 15000, 'BAJA', 'SIN_PERMISO', 'BAJA', false],
  ['F12', 'Espectacular Coyoacan Poniente', 'ESPECTACULAR', 'COY', 10, 5, 1, 40000, 'BAJA', 'EN_ORDEN', 'APAGADO', false],
]

// Las digitales llevan la estructura física en `tipo_estructura`, que es donde
// la deja el importador desde el 29/09 (`valoresDe`, sitios-repo.ts): el
// booking mira SOLO `tipo_medio = 'PANTALLA_DIGITAL'`, y una digital con su
// estructura en `tipo_medio` se reservaría como fija (migración del 04/10).
//
// [clave, nombre, estructura, predio, ancho, alto, caras, tarifa, comercial, legal, operativo, pausa, cms, programatico]
const DIGITALES = [
  ['D01', 'Pantalla LED Reforma', 'Pantalla LED', 'REF', 10, 5, 1, 120000, 'OCUPADO', 'EN_ORDEN', 'ACTIVO', false, 'DOOHMAIN', false],
  ['D02', 'Pantalla LED Santa Fe Torre', 'Pantalla LED', 'SFE', 14, 7, 1, 140000, 'OCUPADO', 'EN_ORDEN', 'ACTIVO', false, 'BROADSIGN', true],
  ['D03', 'Puente digital Periferico', 'Puente digital', 'PER', 16, 3, 2, 95000, 'RESERVADO', 'EN_ORDEN', 'ACTIVO', false, 'DOOHMAIN', false],
  ['D04', 'Mupi digital Santa Fe', 'Mupi digital', 'SFE', 1.2, 1.8, 2, 18000, 'RESERVADO', 'EN_ORDEN', 'ACTIVO', false, 'INVIDIS', false],
  ['D05', 'Pantalla LED Vallarta', 'Pantalla LED', 'GDL', 10, 5, 1, 90000, 'DISPONIBLE', 'EN_ORDEN', 'ACTIVO', false, 'DOOHMAIN', true],
  ['D06', 'Pantalla LED Polanco Masaryk', 'Pantalla LED', 'POL', 8, 4, 1, 110000, 'DISPONIBLE', 'EN_ORDEN', 'ACTIVO', false, 'BROADSIGN', false],
  ['D07', 'Pantalla LED Satelite', 'Pantalla LED', 'SAT', 10, 5, 1, 70000, 'BLOQUEADO', 'EN_TRAMITE', 'ACTIVO', false, 'DOOHMAIN', false],
  ['D08', 'Mupi digital Polanco', 'Mupi digital', 'POL', 1.2, 1.8, 2, 16000, 'BLOQUEADO', 'PERMISO_VENCIDO', 'APAGADO', true, 'INVIDIS', false],
  ['D09', 'Pantalla LED Santa Fe Vasco', 'Pantalla LED', 'SFE', 12, 6, 1, 100000, 'EN_MANTENIMIENTO', 'EN_ORDEN', 'DANADO', false, 'BROADSIGN', false],
  ['D10', 'Pantalla LED Insurgentes Norte', 'Pantalla LED', 'INN', 10, 5, 1, 80000, 'EN_MANTENIMIENTO', 'EN_ORDEN', 'EN_MANTENIMIENTO', false, 'DOOHMAIN', false],
  ['D11', 'Pantalla LED Coyoacan', 'Pantalla LED', 'COY', 10, 5, 1, 60000, 'BAJA', 'SUSPENDIDO', 'BAJA', false, 'OTRO', false],
  ['D12', 'Pantalla LED Americas', 'Pantalla LED', 'GDL', 8, 4, 1, 75000, 'BAJA', 'SIN_PERMISO', 'APAGADO', false, 'DOOHMAIN', false],
]

function sitioDe(fila, digital) {
  const [clave, nombre, tipoOEstructura, predio, ancho, alto, caras, tarifa, comercial, legal, operativo, pausa, cms, programatico] = fila
  const c = CIUDAD[predio]
  // Desplazamiento pequeño y estable por pantalla: si todas las de un predio
  // compartieran coordenada, el mapa pintaría un solo punto.
  const n = Number(clave.slice(1))
  const off = ((n * 7) % 11 - 5) * 0.0006
  return {
    clave: `CAT-${clave}`,
    codigoProveedor: `CAT-PROV-${clave}`,
    corto: clave,
    nombre,
    digital,
    tipoMedio: digital ? 'PANTALLA_DIGITAL' : tipoOEstructura,
    tipoEstructura: digital ? tipoOEstructura : null,
    predio,
    direccion: `${PREDIOS.find((p) => p.clave === predio).direccion.split(',')[0]}, ${digital ? 'pantalla' : 'cara'} ${clave}`,
    ...c,
    lat: Number((c.lat + off).toFixed(6)),
    lng: Number((c.lng - off).toFixed(6)),
    ancho,
    alto,
    caras,
    tarifa,
    comercial,
    legal,
    operativo,
    pausa,
    iluminado: digital || tipoOEstructura === 'ESPECTACULAR',
    exhibicion: digital ? 'rotativo' : 'fijo',
    unidad: 'mensual',
    cms: digital ? cms : null,
    comercializacion: digital && programatico ? 'PROGRAMATICO' : 'TRADICIONAL',
    enNetwork: digital && programatico,
    // La regla del importador para toda digital: 12 slots, 6 spots por hora de
    // 20 s, de 06:00 a 24:00. Si la semilla inventara otra cifra, la
    // calculadora de spots daría precios que nadie puede reproducir dando de
    // alta una pantalla igual.
    spotsPorHora: digital ? 6 : null,
    duracionSpot: digital ? 20 : null,
    totalSpots: digital ? 12 : null,
    horario: digital ? '06:00-24:00' : null,
    resolucion: digital ? (ancho < 2 ? '1080x1920' : '1920x1080') : null,
    tipoContenido: digital ? 'VIDEO' : null,
    notas: `CAT · ${digital ? 'digital' : 'fija'} en estado ${comercial}${pausa ? ' con pausa legal' : ''}.`,
  }
}

const SITIOS = [...FIJAS.map((f) => sitioDe(f, false)), ...DIGITALES.map((f) => sitioDe(f, true))]

// ─── Los contratos de arrendamiento ────────────────────────────────────────
//
// Uno por cada estado de `est_contrato`, con historia: Insurgentes Norte y
// Santa Fe tienen un contrato VENCIDO y el que lo sustituyó; Coyoacán tiene el
// CANCELADO por la suspensión municipal y uno nuevo INCOMPLETO, a medio
// capturar. Los vigentes llegan hasta 2028.
//
// El índice `contratos_predio_activo_uq` admite UN contrato activo
// (VIGENTE/POR_VENCER/RENOVADO) por predio, así que cada predio tiene a lo sumo
// uno; los vencidos y cancelados son historia y no cuentan.
//
// `morosos`: cuántos de los últimos vencimientos YA PASADOS quedan sin pagar.
// Sin alguno, la pantalla de pagos de renta no tendría nada en rojo.
const CONTRATOS = [
  { clave: 'REF-1', predio: 'REF', ancla: 'F01', inicio: '2024-01-01', fin: '2028-12-31', renta: 45000, per: 'MENSUAL', estatus: 'VIGENTE', incremento: 5, autoRenovable: true, diaPago: 5 },
  { clave: 'PER-1', predio: 'PER', ancla: 'F03', inicio: '2024-03-01', fin: '2027-02-28', renta: 32000, per: 'MENSUAL', estatus: 'VIGENTE', incremento: 4, morosos: 1, diaPago: 10 },
  { clave: 'SAT-1', predio: 'SAT', ancla: 'F04', inicio: '2024-01-15', fin: '2026-12-14', renta: 26000, per: 'MENSUAL', estatus: 'POR_VENCER', morosos: 2, diaPago: 15 },
  { clave: 'INN-1', predio: 'INN', ancla: 'F05', inicio: '2024-02-01', fin: '2025-01-31', renta: 18000, per: 'MENSUAL', estatus: 'VENCIDO' },
  { clave: 'INN-2', predio: 'INN', ancla: 'F05', inicio: '2025-02-01', fin: '2027-01-31', renta: 20000, per: 'MENSUAL', estatus: 'RENOVADO', incremento: 4 },
  { clave: 'GDL-1', predio: 'GDL', ancla: 'F06', inicio: '2025-04-01', fin: '2028-03-31', renta: 300000, per: 'ANUAL', estatus: 'VIGENTE', incremento: 5 },
  { clave: 'POL-1', predio: 'POL', ancla: 'D06', inicio: '2024-07-01', fin: '2028-06-30', renta: 96000, per: 'TRIMESTRAL', estatus: 'VIGENTE', incremento: 5 },
  { clave: 'COY-1', predio: 'COY', ancla: 'F08', inicio: '2024-05-01', fin: '2026-04-30', renta: 30000, per: 'MENSUAL', estatus: 'CANCELADO', canceladoEn: '2025-06-30', motivo: 'Suspension municipal del predio: la alcaldia retiro el permiso de anuncios.' },
  { clave: 'COY-2', predio: 'COY', ancla: 'F12', inicio: '2026-11-01', fin: null, renta: null, per: null, estatus: 'INCOMPLETO' },
  { clave: 'SFE-1', predio: 'SFE', ancla: 'D02', inicio: '2024-01-01', fin: '2024-12-31', renta: 40000, per: 'MENSUAL', estatus: 'VENCIDO' },
  { clave: 'SFE-2', predio: 'SFE', ancla: 'D02', inicio: '2025-01-01', fin: '2028-12-31', renta: 52000, per: 'MENSUAL', estatus: 'VIGENTE', incremento: 5, autoRenovable: true },
]

// ─── Los recibos de luz ────────────────────────────────────────────────────
// Por predio y por mes, igual que en el guion: el medidor es del predio. Los
// predios con digitales consumen un múltiplo —una LED de 50 m² encendida 18 h
// gasta lo que diez espectaculares con reflectores—, y la tarifa por kWh varía
// entre predios para que la columna de costo por kWh compare algo. Dos huecos
// por predio, para que el aviso de «falta el recibo» tenga qué enseñar.
const LUZ = {
  REF: { kwh: 2900, paso: 60, tarifa: 6.8, huecos: [7, 22] },
  PER: { kwh: 1700, paso: 40, tarifa: 6.4, huecos: [3, 18] },
  SAT: { kwh: 1500, paso: 30, tarifa: 6.1, huecos: [10, 25] },
  INN: { kwh: 1400, paso: 30, tarifa: 6.2, huecos: [5, 20] },
  GDL: { kwh: 2100, paso: 50, tarifa: 5.9, huecos: [2, 14] },
  POL: { kwh: 1800, paso: 40, tarifa: 7.1, huecos: [8, 21] },
  COY: { kwh: 1200, paso: 30, tarifa: 6.3, huecos: [4] },
  SFE: { kwh: 3600, paso: 80, tarifa: 7.4, huecos: [11, 26] },
}
const LUZ_DESDE = '2024-01-01'

// ─── Los clientes ──────────────────────────────────────────────────────────
// Directos y una agencia con dos clientes suyos (`agencia_id`), que es lo que
// enseña la comisión de agencia en propuestas y comprobantes.
const CLIENTES = [
  { clave: 'C1', nombre: 'Refresquera DEMO del Norte', tipo: 'DIRECTO' },
  { clave: 'C2', nombre: 'Banco DEMO Nacional', tipo: 'DIRECTO' },
  { clave: 'C3', nombre: 'Agencia DEMO Medios Creativos', tipo: 'AGENCIA', comision: 15 },
  { clave: 'C4', nombre: 'Automotriz DEMO del Bajio', tipo: 'DIRECTO', agencia: 'C3' },
  { clave: 'C5', nombre: 'Telefonia DEMO Movil', tipo: 'DIRECTO' },
  { clave: 'C6', nombre: 'Cadena DEMO de Cines', tipo: 'DIRECTO' },
  { clave: 'C7', nombre: 'Aseguradora DEMO Confianza', tipo: 'DIRECTO', agencia: 'C3' },
  { clave: 'C8', nombre: 'Universidad DEMO Metropolitana', tipo: 'DIRECTO' },
].map((c, i) => ({
  ...c,
  rfc: `DMO030303C${String(i + 1).padStart(2, '0')}`,
  razonSocial: `${c.nombre.replace(' DEMO', ' DEMO,')} S.A. de C.V.`.replace(',,', ','),
  regimen: '601 - General de Ley Personas Morales',
  comision: c.comision ?? 0,
  contacto: {
    nombre: `Contacto ${c.clave} DEMO`,
    email: `contacto.${c.clave.toLowerCase()}@catalogo.invalid`,
    telefono: `55 0000 03${String(i + 1).padStart(2, '0')}`,
  },
}))

// ─── Las campañas ──────────────────────────────────────────────────────────
//
// Al menos dos por cada uno de los siete estados, de 2024 a 2028. El reparto
// de pantallas no es libre: una FIJA no admite dos campañas a la vez (una lona
// es de un solo cliente), así que las fechas de cada fija no se pisan entre
// campañas vivas — `comprobarCoherencia` lo verifica. Las digitales sí se
// comparten: tienen 12 slots.
//
// [folio, cliente, estado, desde, hasta, pantallas, descuento %]
const CAMPANAS = [
  // Historia: 2024 y 2025, completadas y cobradas.
  ['001', 'C1', 'COMPLETADA', '2024-01-08', '2024-03-31', ['F01', 'F02', 'F11', 'D01'], 0],
  ['002', 'C2', 'COMPLETADA', '2024-04-01', '2024-06-30', ['F03', 'F06', 'F08', 'D03'], 10],
  ['003', 'C4', 'COMPLETADA', '2024-07-01', '2024-09-30', ['F05', 'F07', 'F09', 'D05'], 0],
  ['004', 'C6', 'COMPLETADA', '2024-10-01', '2024-12-31', ['F01', 'F12', 'D02', 'D06'], 5],
  ['005', 'C5', 'COMPLETADA', '2025-01-06', '2025-03-31', ['F02', 'D01', 'D08', 'D09'], 0],
  ['006', 'C7', 'COMPLETADA', '2025-04-01', '2025-06-30', ['F06', 'F10', 'D05', 'D12'], 10],
  ['007', 'C8', 'COMPLETADA', '2025-07-01', '2025-09-30', ['F03', 'F04', 'D03', 'D07'], 0],
  ['008', 'C1', 'COMPLETADA', '2025-10-01', '2025-12-31', ['F01', 'F02', 'D01', 'D02', 'D11'], 8],
  // Cancelada con reservas canceladas, y otra cancelada a medio camino.
  ['009', 'C4', 'CANCELADA', '2025-11-01', '2025-12-31', ['F06', 'D06'], 0],
  ['010', 'C2', 'CANCELADA', '2026-05-01', '2026-06-30', ['F05'], 0],
  // Terminadas y SIN comprobante: es lo que «lista para facturar» significa.
  ['011', 'C2', 'LISTA_FACTURAR', '2026-06-01', '2026-08-31', ['F03', 'D04'], 0],
  ['012', 'C4', 'LISTA_FACTURAR', '2026-07-01', '2026-09-30', ['F06', 'D10'], 5],
  // Al aire hoy: son las que hacen OCUPADAS a F01, F02, D01 y D02.
  ['013', 'C1', 'ACTIVA', '2026-09-01', '2026-12-31', ['F01', 'D01'], 0],
  ['014', 'C5', 'ACTIVA', '2026-08-01', '2027-01-31', ['F02', 'D02'], 10],
  ['015', 'C6', 'ACTIVA', '2026-10-01', '2026-12-31', ['D01', 'D02'], 0],
  ['016', 'C7', 'ACTIVA', '2026-09-01', '2026-11-30', ['D01'], 0],
  // Confirmadas por delante, hasta 2028: hacen RESERVADAS a F03, F04, D03, D04.
  ['017', 'C2', 'CONFIRMADA', '2027-01-01', '2027-12-31', ['F03', 'D03'], 12],
  ['018', 'C4', 'CONFIRMADA', '2027-06-01', '2028-05-31', ['F04', 'D04'], 15],
  ['019', 'C1', 'CONFIRMADA', '2028-01-01', '2028-12-31', ['F01', 'D01'], 15],
  // En cotización: reservas TENTATIVAS que caducan.
  ['020', 'C7', 'COTIZACION', '2026-11-01', '2027-01-31', ['F04', 'D03'], 0],
  ['021', 'C8', 'COTIZACION', '2027-02-01', '2027-04-30', ['F04', 'D04'], 5],
  // Borradores: sin reservas todavía.
  ['022', 'C5', 'DRAFT', '2027-03-01', '2027-05-31', ['F05', 'D05'], 0],
  ['023', 'C6', 'DRAFT', '2027-07-01', '2027-08-31', ['D06'], 0],
].map(
  /**
   * @param {any[]} fila
   * @returns {{ folio: string, n: string, cliente: string, estado: string, desde: string, hasta: string, pantallas: string[], descuento: number }}
   */
  ([n, cliente, estado, desde, hasta, pantallas, descuento]) => ({
  folio: `CAT-CMP-${n}`,
  n,
  cliente,
  estado,
  desde,
  hasta,
  pantallas,
  descuento,
}),
)

const ESTATUS_RESERVA = {
  COMPLETADA: 'CONFIRMADA',
  LISTA_FACTURAR: 'CONFIRMADA',
  ACTIVA: 'CONFIRMADA',
  CONFIRMADA: 'CONFIRMADA',
  COTIZACION: 'TENTATIVA',
  CANCELADA: 'CANCELADA',
  DRAFT: null,
}

// ─── Las propuestas ────────────────────────────────────────────────────────
//
// Las APROBADAS son el origen de una campaña (`campanas.propuesta_id`), y su
// campaña es la de la misma lista de pantallas: una propuesta aprobada cuyo
// contenido no se parece a la campaña que generó es lo primero que alguien
// abre en una demo. Las ENVIADAS de las cotizaciones igual.
//
// [folio, cliente, estatus, fecha, campaña de origen | null, pantallas, desde, hasta, nota]
const PROPUESTAS = [
  ['001', 'C1', 'APROBADA', '2025-09-10', '008', null, null, null, null],
  ['002', 'C1', 'APROBADA', '2026-08-15', '013', null, null, null, null],
  ['003', 'C2', 'APROBADA', '2026-09-20', '017', null, null, null, null],
  ['004', 'C1', 'APROBADA', '2026-09-28', '019', null, null, null, null],
  ['005', 'C7', 'ENVIADA', '2026-09-30', '020', null, null, null, null],
  ['006', 'C8', 'ENVIADA', '2026-10-02', '021', null, null, null, null],
  ['007', 'C4', 'ENVIADA', '2026-10-03', null, ['F06', 'D05', 'D06'], '2027-01-01', '2027-03-31', null],
  ['008', 'C5', 'BORRADOR', '2026-10-04', null, ['F05', 'D05'], '2027-03-01', '2027-05-31', null],
  ['009', 'C8', 'BORRADOR', '2026-10-05', null, ['D06'], '2027-08-01', '2027-08-31', null],
  ['010', 'C6', 'BORRADOR', '2026-10-06', null, ['F06', 'D09'], '2027-11-01', '2027-12-31', null],
  ['011', 'C4', 'RECHAZADA', '2024-05-20', null, ['F01', 'D01'], '2024-07-01', '2024-09-30', 'Rechazada por el cliente: presupuesto fuera de rango para el trimestre.'],
  ['012', 'C7', 'RECHAZADA', '2025-02-14', null, ['F03', 'D03'], '2025-04-01', '2025-06-30', 'Rechazada: el cliente eligio otro proveedor en la zona.'],
  ['013', 'C8', 'RECHAZADA', '2026-03-03', null, ['F06', 'D05'], '2026-05-01', '2026-06-30', 'Rechazada: el cliente pospone la campana al siguiente ciclo escolar.'],
].map(
  /**
   * @param {any[]} fila
   * @returns {{ folio: string, cliente: string, estatus: string, fecha: string, campanaFolio: string | null, pantallas: string[], desde: string, hasta: string, descuento: number, nota: string | null }}
   */
  ([n, cliente, estatus, fecha, campana, pantallas, desde, hasta, nota]) => {
  const c = campana ? CAMPANAS.find((x) => x.n === campana) : null
  return {
    folio: `CAT-PRO-${n}`,
    cliente,
    estatus,
    fecha,
    campanaFolio: c ? c.folio : null,
    pantallas: c ? c.pantallas : pantallas,
    desde: c ? c.desde : desde,
    hasta: c ? c.hasta : hasta,
    descuento: c ? c.descuento : 0,
    nota,
  }
  },
)

// ─── Los usuarios ──────────────────────────────────────────────────────────
// Uno por rol de `ROLES_ASIGNABLES`. Ver la cabecera: CLIENTE y COMERCIAL no.
export const USUARIOS = [
  { rol: 'DUENO', nombre: 'Dueno DEMO', cargo: 'Direccion general', email: 'dueno@catalogo.invalid' },
  { rol: 'ADMINISTRADOR', nombre: 'Administradora DEMO', cargo: 'Administracion', email: 'administrador@catalogo.invalid' },
  { rol: 'DIRECTOR_COMERCIAL', nombre: 'Director Comercial DEMO', cargo: 'Direccion comercial', email: 'director.comercial@catalogo.invalid' },
  { rol: 'GERENTE_VENTAS', nombre: 'Gerente de Ventas DEMO', cargo: 'Gerencia de ventas', email: 'gerente.ventas@catalogo.invalid' },
  { rol: 'VENDEDOR', nombre: 'Vendedora DEMO', cargo: 'Ejecutiva de cuenta', email: 'vendedor@catalogo.invalid' },
  { rol: 'OPERACIONES', nombre: 'Operaciones DEMO', cargo: 'Coordinacion de operaciones', email: 'operaciones@catalogo.invalid' },
  { rol: 'IMPRENTA', nombre: 'Imprenta DEMO', cargo: 'Produccion e impresion', email: 'imprenta@catalogo.invalid' },
  { rol: 'FINANZAS', nombre: 'Finanzas DEMO', cargo: 'Cuentas por cobrar', email: 'finanzas@catalogo.invalid' },
]

// ─── El plan ───────────────────────────────────────────────────────────────

const sitio = (corto) => SITIOS.find((s) => s.corto === corto)
const solapan = (a1, a2, b1, b2) => nDia(a1) <= nDia(b2) && nDia(b1) <= nDia(a2)

/** Precio de una pantalla en un rango: tarifa mensual por meses, con descuento. */
function precioDe(corto, desde, hasta, descuento) {
  return Math.round(sitio(corto).tarifa * mesesDe(desde, hasta) * (1 - descuento / 100))
}

/**
 * El plan entero como DATO puro: sin conexión y sin azar. La segunda corrida
 * produce las mismas claves naturales que la primera, que es lo que permite
 * reconocer lo ya sembrado.
 */
export function planCatalogo(opciones = {}) {
  const hoy = (opciones.ancla ?? hoyIso()).slice(0, 10)
  const slug = opciones.slug ?? 'demo-rentabilidad'
  const nombreOrg = opciones.nombreOrg ?? 'Organizacion DEMO Rentabilidad'

  const reservas = []
  for (const c of CAMPANAS) {
    const estatus = ESTATUS_RESERVA[c.estado]
    if (!estatus) continue
    for (const p of c.pantallas) {
      const s = sitio(p)
      reservas.push({
        campanaFolio: c.folio,
        sitio: s.clave,
        corto: p,
        digital: s.digital,
        desde: c.desde,
        hasta: c.hasta,
        precio: precioDe(p, c.desde, c.hasta, c.descuento),
        cantidad: mesesDe(c.desde, c.hasta),
        tarifa: s.tarifa,
        // Dos slots de los doce: deja sitio a que otra campaña comparta la
        // pantalla, que es justo lo que enseña la 015 sobre D01 y D02.
        spots: s.digital ? 2 : null,
        estatus,
        // Una tentativa caduca; la de una cotización vive dos semanas desde hoy.
        expiraEn: estatus === 'TENTATIVA' ? `${masDias(hoy, 14)}T23:59:00` : null,
      })
    }
  }

  const campanas = CAMPANAS.map((c) => {
    const digitales = c.pantallas.filter((p) => sitio(p).digital).length
    const bruto = c.pantallas.reduce((a, p) => a + precioDe(p, c.desde, c.hasta, 0), 0)
    const neto = c.pantallas.reduce((a, p) => a + precioDe(p, c.desde, c.hasta, c.descuento), 0)
    const cliente = CLIENTES.find((x) => x.clave === c.cliente)
    const propuesta = PROPUESTAS.find((p) => p.campanaFolio === c.folio)
    return {
      ...c,
      nombre: `${cliente.nombre.replace(' DEMO', '')} · ${c.desde.slice(0, 7)}`,
      tipo: digitales === 0 ? 'OOH' : digitales === c.pantallas.length ? 'DOOH' : 'HIBRIDA',
      bruto,
      neto,
      clienteRfc: cliente.rfc,
      agencia: cliente.agencia ? CLIENTES.find((x) => x.clave === cliente.agencia).nombre : null,
      propuestaFolio: propuesta?.folio ?? null,
      // Las campañas que ya pasaron por imprenta y validación lo dicen, para que
      // las casillas del expediente no salgan vacías en una completada.
      cerrada: ['COMPLETADA', 'LISTA_FACTURAR'].includes(c.estado),
    }
  })

  const propuestas = PROPUESTAS.map((p) => {
    const cliente = CLIENTES.find((x) => x.clave === p.cliente)
    return {
      ...p,
      clienteRfc: cliente.rfc,
      agenciaRfc: cliente.agencia ? CLIENTES.find((x) => x.clave === cliente.agencia).rfc : null,
      comision: cliente.agencia ? CLIENTES.find((x) => x.clave === cliente.agencia).comision : 0,
      nombre: `Propuesta ${cliente.nombre.replace(' DEMO', '')} ${p.desde.slice(0, 7)}`,
      items: p.pantallas.map((corto) => {
        const s = sitio(corto)
        return {
          sitio: s.clave,
          desde: p.desde,
          hasta: p.hasta,
          precio: precioDe(corto, p.desde, p.hasta, 0),
          cantidad: mesesDe(p.desde, p.hasta),
          tarifa: s.tarifa,
          espacios: s.digital ? 2 : null,
          aprobado: p.estatus === 'APROBADA',
        }
      }),
    }
  })

  // ─── Comprobantes y cobranza ──────────────────────────────────────────────
  // Completadas: cobradas. Activas: emitidas, cada una en un punto distinto de
  // la cobranza (al corriente, por vencer, vencida y una ya pagada). Una de las
  // canceladas se facturó y se ANULÓ, que es el tercer estado de `est_factura`.
  // Las LISTA_FACTURAR no llevan comprobante: es exactamente lo que les falta.
  const COBRO_ACTIVAS = {
    '013': { cobranza: 'AL_CORRIENTE', plazo: 60 },
    '014': { cobranza: 'VENCIDA', plazo: 30 },
    '015': { cobranza: 'POR_VENCER', plazo: 15 },
    '016': { cobranza: 'PAGADA', plazo: 30 },
  }
  const comprobantes = []
  for (const c of campanas) {
    let estatus
    let cobranza
    let plazo = 30
    let emision
    if (c.estado === 'COMPLETADA') {
      estatus = 'PAGADA'; cobranza = 'PAGADA'; emision = c.hasta
    } else if (c.estado === 'ACTIVA') {
      const x = COBRO_ACTIVAS[c.n]
      estatus = x.cobranza === 'PAGADA' ? 'PAGADA' : 'EMITIDA'
      cobranza = x.cobranza; plazo = x.plazo; emision = c.desde
    } else if (c.n === '009') {
      estatus = 'ANULADA'; cobranza = 'AL_CORRIENTE'; emision = c.desde
    } else continue
    const cliente = CLIENTES.find((x) => x.clave === c.cliente)
    const subtotal = c.neto
    const iva = Math.round(subtotal * 0.16 * 100) / 100
    const monto = Math.round((subtotal + iva) * 100) / 100
    // Que la vencida lo esté de verdad y la por vencer también, respecto a hoy:
    // un «VENCIDA» con fecha de vencimiento en el futuro no se sostiene.
    let vence = masDias(emision, plazo)
    if (cobranza === 'VENCIDA' && nDia(vence) >= nDia(hoy)) vence = masDias(hoy, -12)
    if (cobranza === 'POR_VENCER') vence = masDias(hoy, 6)
    if (cobranza === 'AL_CORRIENTE' && estatus !== 'ANULADA' && nDia(vence) <= nDia(hoy)) vence = masDias(hoy, 40)
    comprobantes.push({
      folio: `CAT-FAC-${c.n}`,
      campanaFolio: c.folio,
      clienteRfc: cliente.rfc,
      subtotal,
      iva,
      monto,
      emision,
      estatus,
      cobranza,
      plazo,
      vence,
      pagado: cobranza === 'PAGADA' ? monto : 0,
      folioFiscal: `CAT-FOLIO-FISCAL-${c.n}`,
    })
  }

  // ─── Calendario de rentas ─────────────────────────────────────────────────
  const pagos = []
  for (const k of CONTRATOS) {
    if (!k.fin || !k.renta) continue
    const fin = k.canceladoEn ?? k.fin
    const periodos = []
    for (let i = 0; ; i++) {
      const v = vencimiento(k.inicio, i, k.per)
      if (nDia(v) > nDia(fin)) break
      periodos.push(v)
    }
    const pasados = periodos.filter((v) => nDia(v) < nDia(hoy))
    const morosos = new Set(pasados.slice(pasados.length - (k.morosos ?? 0)))
    periodos.forEach((v, i) => {
      // El incremento anual se aplica en cada aniversario del contrato: un
      // calendario de cinco años con la misma renta del primer día no se
      // parece a ningún contrato real.
      const anios = Math.floor((i * (MESES_POR_PERIODO[k.per] ?? 1)) / 12)
      const monto = Math.round(k.renta * Math.pow(1 + (k.incremento ?? 0) / 100, anios))
      const pasado = nDia(v) < nDia(hoy)
      const estatus = !pasado ? 'PENDIENTE' : morosos.has(v) ? 'VENCIDO' : 'PAGADO'
      pagos.push({
        contrato: k.clave,
        periodo: v,
        monto,
        estatus,
        fechaPago: estatus === 'PAGADO' ? masDias(v, -2) : null,
        metodo: estatus === 'PAGADO' ? 'TRANSFERENCIA' : null,
      })
    })
  }

  // ─── Recibos de luz ───────────────────────────────────────────────────────
  // Solo los meses ya cerrados, y solo mientras el predio tenía un contrato que
  // no estuviera cancelado: un recibo de un mes en que no había pantalla
  // instalada no tiene a quién cargarse.
  const ultimoMes = (() => {
    const [a, m] = hoy.split('-').map(Number)
    return isoDe(Date.UTC(a, m - 2, 1) / 86_400_000)
  })()
  const consumos = []
  for (const p of PREDIOS) {
    const luz = LUZ[p.clave]
    const suyos = CONTRATOS.filter((k) => k.predio === p.clave && k.fin)
    let i = 0
    for (let mes = LUZ_DESDE; nDia(mes) <= nDia(ultimoMes); mes = vencimiento(mes, 1, 'MENSUAL'), i++) {
      const cubierto = suyos.some((k) => solapan(k.inicio, k.canceladoEn ?? k.fin, mes, masDias(vencimiento(mes, 1, 'MENSUAL'), -1)))
      if (!cubierto || luz.huecos.includes(i)) continue
      const kwh = luz.kwh + (((i * 7) % 9) - 4) * luz.paso
      consumos.push({
        predio: p.nombre,
        periodo: mes,
        medidor: `CAT-MED-${p.clave}-001`,
        kwh,
        importe: Math.round(kwh * luz.tarifa),
      })
    }
  }

  // ─── Órdenes de trabajo ───────────────────────────────────────────────────
  // Montaje al arrancar cada campaña con reservas en firme y desmontaje de las
  // fijas al terminar. Las que caen en el futuro quedan PENDIENTES. Y una de
  // mantenimiento en cada estado de `est_ot` que el flujo de campaña no
  // produce, sobre las pantallas cuyo estado la explica.
  const ordenes = []
  for (const c of campanas) {
    if (!['COMPLETADA', 'LISTA_FACTURAR', 'ACTIVA', 'CONFIRMADA'].includes(c.estado)) continue
    for (const corto of c.pantallas) {
      const s = sitio(corto)
      const montajeHecho = nDia(c.desde) <= nDia(hoy)
      ordenes.push({
        folio: `CAT-OT-${c.n}-${corto}-M`,
        tipo: s.digital ? 'MONTAJE_DIGITAL' : 'MONTAJE_LONA',
        sitio: s.clave,
        campanaFolio: c.folio,
        descripcion: `${s.digital ? 'Carga de contenido' : 'Montaje de lona'} para ${c.nombre}`,
        prioridad: 'NORMAL',
        fecha: c.desde,
        estatus: montajeHecho ? 'COMPLETADA' : 'PENDIENTE',
        completada: montajeHecho,
      })
      if (!s.digital && nDia(c.hasta) < nDia(hoy)) {
        ordenes.push({
          folio: `CAT-OT-${c.n}-${corto}-D`,
          tipo: 'DESMONTAJE',
          sitio: s.clave,
          campanaFolio: c.folio,
          descripcion: `Desmontaje al cierre de ${c.nombre}`,
          prioridad: 'NORMAL',
          fecha: c.hasta,
          estatus: 'COMPLETADA',
          completada: true,
        })
      }
    }
  }
  const MANTENIMIENTO = [
    ['F09', 'MANTENIMIENTO_CORRECTIVO', 'EN_PROCESO', 'ALTA', 'Cambio de bastidor danado por viento.'],
    ['D10', 'ELECTRICO', 'ASIGNADA', 'ALTA', 'Falla en la alimentacion de modulos LED del lado derecho.'],
    ['D09', 'MANTENIMIENTO_CORRECTIVO', 'BLOQUEADA', 'URGENTE', 'Reemplazo de tarjeta receptora: en espera de refaccion importada.'],
    ['F10', 'HERRERIA', 'EN_REVISION', 'NORMAL', 'Refuerzo de estructura del mural: trabajo terminado, falta revision.'],
    ['F07', 'INSPECCION', 'RECHAZADA', 'BAJA', 'Inspeccion para renovar permiso: evidencia rechazada por fotos incompletas.'],
    ['D11', 'DESMONTAJE', 'CANCELADA', 'NORMAL', 'Retiro de pantalla de Coyoacan: cancelado mientras se resuelve el litigio.'],
    ['F05', 'MANTENIMIENTO_PREVENTIVO', 'PENDIENTE', 'NORMAL', 'Mantenimiento preventivo semestral del puente.'],
  ]
  MANTENIMIENTO.forEach(([corto, tipo, estatus, prioridad, descripcion], i) => {
    ordenes.push({
      folio: `CAT-OT-MTO-${String(i + 1).padStart(2, '0')}`,
      tipo,
      sitio: sitio(corto).clave,
      campanaFolio: null,
      descripcion,
      prioridad,
      fecha: masDias(hoy, i - 3),
      estatus,
      completada: false,
    })
  })

  return {
    organizacion: { slug, nombre: nombreOrg },
    hoy,
    arrendadores: ARRENDADORES,
    predios: PREDIOS,
    sitios: SITIOS,
    contratos: CONTRATOS,
    clientes: CLIENTES,
    propuestas,
    campanas,
    reservas,
    comprobantes,
    pagos,
    consumos,
    ordenes,
    usuarios: USUARIOS,
  }
}

/**
 * Lo que una demo deja ver mal en el primer clic, comprobado SOBRE EL PLAN y
 * antes de abrir la base. Devuelve la lista de incoherencias; vacía es bien.
 */
export function comprobarCoherencia(plan) {
  const malos = []
  const hoy = plan.hoy
  const vivas = plan.reservas.filter((r) => r.estatus !== 'CANCELADA')

  // Una fija no admite dos reservas vivas que se pisen.
  for (const s of plan.sitios.filter((x) => !x.digital)) {
    const suyas = vivas.filter((r) => r.sitio === s.clave)
    for (let i = 0; i < suyas.length; i++)
      for (let j = i + 1; j < suyas.length; j++)
        if (solapan(suyas[i].desde, suyas[i].hasta, suyas[j].desde, suyas[j].hasta))
          malos.push(`${s.clave}: ${suyas[i].campanaFolio} y ${suyas[j].campanaFolio} se pisan`)
  }

  // El estado comercial tiene que salir de las reservas.
  for (const s of plan.sitios) {
    const suyas = vivas.filter((r) => r.sitio === s.clave)
    const alAire = suyas.some((r) => r.estatus === 'CONFIRMADA' && solapan(r.desde, r.hasta, hoy, hoy))
    const porDelante = suyas.some((r) => nDia(r.desde) > nDia(hoy))
    if (s.comercial === 'OCUPADO' && !alAire) malos.push(`${s.clave} OCUPADO sin campana al aire hoy`)
    if (s.comercial !== 'OCUPADO' && alAire) malos.push(`${s.clave} tiene campana al aire y esta ${s.comercial}`)
    if (s.comercial === 'RESERVADO' && !porDelante) malos.push(`${s.clave} RESERVADO sin reservas por delante`)
    if (s.comercial === 'DISPONIBLE' && porDelante) malos.push(`${s.clave} DISPONIBLE con reservas por delante`)
  }

  // Las campañas ACTIVAS cubren hoy; las COMPLETADAS ya pasaron; las futuras lo son.
  for (const c of plan.campanas) {
    if (c.estado === 'ACTIVA' && !solapan(c.desde, c.hasta, hoy, hoy)) malos.push(`${c.folio} ACTIVA fuera de fecha`)
    if (['COMPLETADA', 'LISTA_FACTURAR'].includes(c.estado) && nDia(c.hasta) >= nDia(hoy)) malos.push(`${c.folio} ${c.estado} sin haber terminado`)
    if (['CONFIRMADA', 'COTIZACION', 'DRAFT'].includes(c.estado) && nDia(c.desde) <= nDia(hoy)) malos.push(`${c.folio} ${c.estado} ya empezada`)
  }

  // Cobertura: dos de cada estado que la demo tiene que poder enseñar.
  const cuenta = (lista, campo) => lista.reduce((m, x) => ((m[x[campo]] = (m[x[campo]] ?? 0) + 1), m), {})
  for (const digital of [false, true]) {
    const porEstado = cuenta(plan.sitios.filter((s) => s.digital === digital), 'comercial')
    for (const e of ['DISPONIBLE', 'RESERVADO', 'OCUPADO', 'BLOQUEADO', 'EN_MANTENIMIENTO', 'BAJA'])
      if ((porEstado[e] ?? 0) < 2) malos.push(`menos de dos ${digital ? 'digitales' : 'fijas'} en ${e}`)
  }
  const porLegal = cuenta(plan.sitios, 'legal')
  for (const e of ['EN_ORDEN', 'PERMISO_VENCIDO', 'EN_TRAMITE', 'SUSPENDIDO', 'SIN_PERMISO'])
    if ((porLegal[e] ?? 0) < 2) malos.push(`menos de dos pantallas con estado legal ${e}`)
  const porOperativo = cuenta(plan.sitios, 'operativo')
  for (const e of ['ACTIVO', 'EN_MANTENIMIENTO', 'APAGADO', 'DANADO', 'BAJA'])
    if ((porOperativo[e] ?? 0) < 2) malos.push(`menos de dos pantallas con estado operativo ${e}`)
  const porCampana = cuenta(plan.campanas, 'estado')
  for (const e of ['DRAFT', 'COTIZACION', 'CONFIRMADA', 'ACTIVA', 'COMPLETADA', 'CANCELADA', 'LISTA_FACTURAR'])
    if ((porCampana[e] ?? 0) < 2) malos.push(`menos de dos campanas en ${e}`)
  const porPropuesta = cuenta(plan.propuestas, 'estatus')
  for (const e of ['BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA'])
    if ((porPropuesta[e] ?? 0) < 2) malos.push(`menos de dos propuestas en ${e}`)

  return malos
}

// ─── El SQL ────────────────────────────────────────────────────────────────
//
// Mismas reglas que `semilla-demo.mjs` (ver su sección «El SQL»): guard por
// clave natural en cada `insert`, claves ajenas resueltas dentro del SQL y
// filtradas por `tenant_id`, y CAST explícito en cada parámetro.

export function sentenciasDelCatalogo(plan, T, clave) {
  const out = []
  const add = (etiqueta, sql, valores, extra = {}) => out.push({ etiqueta, sql, valores, ...extra })
  const predioDe = (c) => plan.predios.find((p) => p.clave === c).nombre

  // ─── Usuarios ────────────────────────────────────────────────────────────
  // `on conflict ((lower(email)))` reproduce el índice `usuarios_email_lower_uidx`:
  // el correo es único en TODA la instancia, no por organización. Si ya existe
  // —aquí o en otra organización— no se toca, y `main` lo avisa al final.
  for (const u of plan.usuarios) {
    add(
      `usuario ${u.rol} <${u.email}>`,
      `insert into usuarios (tenant_id, nombre, email, cargo, rol, password_hash, activo, debe_cambiar_password)
       values ($1::uuid, $2::text, $3::text, $4::text, $5::rol_demo, crypt($6::text, gen_salt('bf', 10)), true, false)
       on conflict ((lower(email))) do nothing`,
      [T, u.nombre, u.email, u.cargo, u.rol, clave],
    )
  }

  for (const a of plan.arrendadores) {
    add(
      `arrendador ${a.nombre}`,
      `insert into arrendadores (tenant_id, nombre, rfc, telefono, email, direccion, forma_pago, activo)
       select $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, true
        where not exists (select 1 from arrendadores x where x.tenant_id = $1::uuid and x.nombre = $2::text)`,
      [T, a.nombre, a.rfc, a.telefono, a.email, a.direccion, a.formaPago],
    )
  }

  for (const p of plan.predios) {
    const arr = plan.arrendadores.find((a) => a.clave === p.arr)
    add(
      `predio ${p.nombre}`,
      `insert into predios (tenant_id, arrendador_id, nombre, direccion, tipo_ubicacion, estado)
       select $1::uuid, a.id, $2::text, $3::text, $4::text, $5::estado_predio
         from arrendadores a
        where a.tenant_id = $1::uuid and a.nombre = $6::text
          and not exists (select 1 from predios x where x.tenant_id = $1::uuid and x.nombre = $2::text)`,
      [T, p.nombre, p.direccion, p.tipo, p.estado, arr.nombre],
    )
  }

  for (const s of plan.sitios) {
    add(
      `pantalla ${s.clave} (${s.nombre})`,
      `insert into sitios (
         tenant_id, clave_interna, codigo_proveedor, nombre, tipo_medio, tipo_estructura,
         direccion, direccion_predio, direccion_comercial, alcaldia, plaza_ciudad, ciudad, estado, pais,
         lat, lng, ancho, alto, caras, iluminado, exhibicion, es_rotativo, unidad,
         resolucion_px, tipo_contenido, spots_por_hora, duracion_spot_seg, total_spots, spots_disponibles,
         horario, tarifa_mensual, tarifa_publicada, comercializacion, en_network, cms,
         predio_id, arrendador_id, estatus_comercial, estatus_legal, estatus_operativo,
         pausa_legal, motivo_pausa_legal, pausa_legal_en, notas)
       select $1::uuid, $2::text, $3::text, $4::text, $5::tipo_medio, $6::text,
              $7::text, $7::text, $7::text, $8::text, $9::text, $10::text, $11::text, 'MX',
              $12::numeric, $13::numeric, $14::numeric, $15::numeric, $16::integer, $17::boolean,
              $18::text, $19::boolean, 'mensual',
              $20::text, $21::tipo_contenido, $22::integer, $23::integer, $24::integer, $24::integer,
              $25::text, $26::numeric, $26::numeric, $27::comercializacion, $28::boolean, $29::cms,
              p.id, p.arrendador_id, $30::est_comercial, $31::est_legal, $32::est_operativo,
              $33::boolean, case when $33::boolean then $34::text end,
              case when $33::boolean then now() end, $35::text
         from predios p
        where p.tenant_id = $1::uuid and p.nombre = $36::text
       on conflict (clave_interna) do nothing`,
      [
        T, s.clave, s.codigoProveedor, s.nombre, s.tipoMedio, s.tipoEstructura,
        s.direccion, s.alcaldia, s.plaza, s.ciudad, s.estado,
        s.lat, s.lng, s.ancho, s.alto, s.caras, s.iluminado,
        s.exhibicion, s.digital,
        s.resolucion, s.tipoContenido, s.spotsPorHora, s.duracionSpot, s.totalSpots,
        s.horario, s.tarifa, s.comercializacion, s.enNetwork, s.cms,
        s.comercial, s.legal, s.operativo,
        s.pausa, `Permiso ${s.legal === 'SUSPENDIDO' ? 'suspendido por la alcaldia' : 'vencido, en renovacion'}.`,
        s.notas, predioDe(s.predio),
      ],
    )
    // Las modalidades de venta: las fijas por mes y por catorcena, las
    // digitales por mes y por spot (la que usa la calculadora). El precio del
    // spot sale de la tarifa mensual entre los spots de un mes de un slot.
    const modalidades = s.digital
      ? [['mensual', s.tarifa], ['spot', Math.round(s.tarifa / (s.spotsPorHora * 18 * 30) * 10) * 10 || 10]]
      : [['mensual', s.tarifa], ['catorcenal', Math.round((s.tarifa * 14) / 30 / 100) * 100]]
    for (const [unidad, tarifa] of modalidades) {
      add(
        `modalidad ${s.clave} ${unidad}`,
        `insert into sitio_modalidades (tenant_id, sitio_id, unidad, tarifa_publicada, costo_compra)
         select $1::uuid, s.id, $2::text, $3::numeric, 0
           from sitios s
          where s.tenant_id = $1::uuid and s.clave_interna = $4::text
            and not exists (select 1 from sitio_modalidades x
                             where x.tenant_id = $1::uuid and x.sitio_id = s.id and x.unidad = $2::text)`,
        [T, unidad, tarifa, s.clave],
      )
    }
  }

  // ─── Contratos ───────────────────────────────────────────────────────────
  // Guard por (predio, fecha de inicio): un predio puede tener varios contratos
  // en su historia, pero nunca dos que empiecen el mismo día. El estado entra
  // tal cual: el CHECK `contrato_completo_ck` deja al INCOMPLETO sin importe.
  for (const k of plan.contratos) {
    add(
      `contrato ${k.clave} (${k.estatus})`,
      `insert into contratos_arrendamiento (
         tenant_id, sitio_id, arrendador_id, predio_id, fecha_inicio, fecha_fin,
         monto_renta, periodicidad, moneda, deposito, estatus, auto_renovable,
         incremento_anual_pct, dia_pago, motivo_cancelacion, ciudad_firma, uso_permitido)
       select $1::uuid, s.id, p.arrendador_id, p.id, $2::date, $3::date,
              $4::numeric, $5::periodicidad_pago, 'MXN', $4::numeric * 2, $6::est_contrato, $7::boolean,
              $8::numeric, $9::integer, $10::text, 'Ciudad de Mexico', 'Publicidad exterior'
         from predios p
         join sitios s on s.tenant_id = $1::uuid and s.clave_interna = $11::text
        where p.tenant_id = $1::uuid and p.nombre = $12::text
          and not exists (select 1 from contratos_arrendamiento x
                           where x.tenant_id = $1::uuid and x.predio_id = p.id
                             and x.fecha_inicio = $2::date)`,
      [
        T, k.inicio, k.fin, k.renta, k.per, k.estatus, k.autoRenovable ?? false,
        k.incremento ?? null, k.diaPago ?? null, k.motivo ?? null,
        `CAT-${k.ancla}`, predioDe(k.predio),
      ],
    )
  }

  for (const pg of plan.pagos) {
    const k = plan.contratos.find((x) => x.clave === pg.contrato)
    add(
      `renta ${k.clave} ${pg.periodo}`,
      `insert into pagos_renta (tenant_id, contrato_id, periodo, monto, estatus, fecha_pago, metodo_pago)
       select $1::uuid, c.id, $2::text, $3::numeric, $4::est_pago_renta, $5::date, $6::text
         from contratos_arrendamiento c
         join predios p on p.id = c.predio_id and p.tenant_id = $1::uuid and p.nombre = $7::text
        where c.tenant_id = $1::uuid and c.fecha_inicio = $8::date
       on conflict (contrato_id, periodo) do nothing`,
      [T, pg.periodo, pg.monto, pg.estatus, pg.fechaPago, pg.metodo, predioDe(k.predio), k.inicio],
      { silencioso: true },
    )
  }

  for (const c of plan.consumos) {
    add(
      `luz ${c.predio} ${c.periodo.slice(0, 7)}`,
      `insert into consumos_energia (tenant_id, predio_id, periodo, medidor, kwh, importe, notas)
       select $1::uuid, p.id, $2::date, $3::text, $4::numeric, $5::numeric, 'CAT · recibo de luz de demostracion.'
         from predios p
        where p.tenant_id = $1::uuid and p.nombre = $6::text
          and not exists (select 1 from consumos_energia x
                           where x.tenant_id = $1::uuid and x.predio_id = p.id and x.periodo = $2::date
                             and coalesce(x.medidor, '') = coalesce($3::text, ''))`,
      [T, c.periodo, c.medidor, c.kwh, c.importe, c.predio],
      { silencioso: true },
    )
  }

  // ─── Clientes (la agencia primero: los suyos la referencian) ─────────────
  const ordenClientes = [...plan.clientes].sort((a, b) => (a.agencia ? 1 : 0) - (b.agencia ? 1 : 0))
  for (const cl of ordenClientes) {
    const agencia = cl.agencia ? plan.clientes.find((x) => x.clave === cl.agencia) : null
    add(
      `cliente ${cl.nombre}`,
      `insert into clientes (tenant_id, nombre, rfc, razon_social, regimen_fiscal, cp_fiscal, uso_cfdi,
                             tipo, iva_pct, comision_agencia_pct, contacto, agencia_id, activo)
       select $1::uuid, $2::text, $3::text, $4::text, $5::text, '00000', 'G03',
              $6::text, 16, $7::numeric, $8::jsonb,
              (select a.id from clientes a where a.tenant_id = $1::uuid and a.rfc = $9::text), true
        where not exists (select 1 from clientes x where x.tenant_id = $1::uuid and x.rfc = $3::text)`,
      [T, cl.nombre, cl.rfc, cl.razonSocial, cl.regimen, cl.tipo, cl.comision, JSON.stringify(cl.contacto), agencia?.rfc ?? null],
    )
  }

  // ─── Propuestas y sus partidas ───────────────────────────────────────────
  // El vendedor de cada propuesta es el usuario VENDEDOR de la semilla
  // (`propuestas.usuario_id`), así la columna «vendedor» no sale vacía.
  const vendedor = plan.usuarios.find((u) => u.rol === 'VENDEDOR').email
  for (const p of plan.propuestas) {
    const aprobada = p.estatus === 'APROBADA'
    add(
      `propuesta ${p.folio} (${p.estatus})`,
      `insert into propuestas (tenant_id, folio, cliente_id, agencia_id, nombre, fecha, estatus,
                               comision_pct, descuento_pct, notas, aceptado_en, aceptado_por, usuario_id)
       select $1::uuid, $2::text, cl.id,
              (select a.id from clientes a where a.tenant_id = $1::uuid and a.rfc = $3::text),
              $4::text, $5::date, $6::est_propuesta, $7::numeric, $8::numeric, $9::text,
              case when $10::boolean then ($5::date + 2)::timestamptz end,
              case when $10::boolean then cl.contacto ->> 'nombre' end,
              (select u.id from usuarios u where lower(u.email) = lower($11::text) and u.tenant_id = $1::uuid)
         from clientes cl
        where cl.tenant_id = $1::uuid and cl.rfc = $12::text
       on conflict (folio) do nothing`,
      [T, p.folio, p.agenciaRfc, p.nombre, p.fecha, p.estatus, p.comision, p.descuento,
        p.nota, aprobada, vendedor, p.clienteRfc],
    )
    for (const it of p.items) {
      add(
        `partida ${p.folio} · ${it.sitio}`,
        `insert into propuesta_items (tenant_id, propuesta_id, sitio_id, fecha_inicio, fecha_fin, precio,
                                      aprobado, unidad, cantidad, tarifa_unitaria, espacios_comprados)
         select $1::uuid, pr.id, s.id, $2::date, $3::date, $4::numeric, $5::boolean, 'mensual',
                $6::numeric, $7::numeric, $8::integer
           from propuestas pr
           join sitios s on s.tenant_id = $1::uuid and s.clave_interna = $9::text
          where pr.tenant_id = $1::uuid and pr.folio = $10::text
            and not exists (select 1 from propuesta_items x
                             where x.tenant_id = $1::uuid and x.propuesta_id = pr.id and x.sitio_id = s.id)`,
        [T, it.desde, it.hasta, it.precio, it.aprobado, it.cantidad, it.tarifa, it.espacios, it.sitio, p.folio],
      )
    }
  }

  // ─── Campañas, reservas, comprobantes y cobranza ─────────────────────────
  for (const c of plan.campanas) {
    add(
      `campana ${c.folio} (${c.estado})`,
      `insert into campanas (tenant_id, folio, nombre, cliente_id, agencia, tipo_campana,
                             fecha_inicio, fecha_fin, presupuesto_bruto, presupuesto_neto, moneda,
                             estado_comercial, propuesta_id, oc_recibida, fotos_comprobatorias,
                             reporte_publicacion, notas)
       select $1::uuid, $2::text, $3::text, cl.id, $4::text, $5::tipo_campana,
              $6::date, $7::date, $8::numeric, $9::numeric, 'MXN',
              $10::est_comercial_campana,
              (select pr.id from propuestas pr where pr.tenant_id = $1::uuid and pr.folio = $11::text),
              $12::boolean, $12::boolean, $12::boolean, $13::text
         from clientes cl
        where cl.tenant_id = $1::uuid and cl.rfc = $14::text
       on conflict (folio) do nothing`,
      [T, c.folio, c.nombre, c.agencia, c.tipo, c.desde, c.hasta, c.bruto, c.neto, c.estado,
        c.propuestaFolio, c.cerrada || c.estado === 'ACTIVA', `CAT · campana ${c.estado.toLowerCase()}.`, c.clienteRfc],
    )
  }

  for (const r of plan.reservas) {
    add(
      `reserva ${r.campanaFolio} · ${r.sitio}`,
      `insert into reservas (tenant_id, campana_id, sitio_id, fecha_inicio, fecha_fin, precio, tipo_venta,
                             estatus, spots_reservados, expira_en, unidad, cantidad, tarifa_unitaria)
       select $1::uuid, c.id, s.id, $2::date, $3::date, $4::numeric, 'FIXED_PKG',
              $5::est_reserva, $6::integer, $7::timestamptz, 'mensual', $8::numeric, $9::numeric
         from campanas c
         join sitios s on s.tenant_id = $1::uuid and s.clave_interna = $10::text
        where c.tenant_id = $1::uuid and c.folio = $11::text
          and not exists (select 1 from reservas x
                           where x.tenant_id = $1::uuid and x.campana_id = c.id and x.sitio_id = s.id)`,
      [T, r.desde, r.hasta, r.precio, r.estatus, r.spots, r.expiraEn, r.cantidad, r.tarifa, r.sitio, r.campanaFolio],
    )
  }

  // La emisora es la razón social con el papel VENTAS si la organización la
  // tiene (la siembra `semilla-demo.mjs`); si no, el comprobante sale sin
  // emisora, que es un estado que el producto sabe pintar.
  for (const f of plan.comprobantes) {
    add(
      `comprobante ${f.folio} (${f.estatus})`,
      `insert into facturas (tenant_id, folio, campana_id, cliente_id, subtotal, igv, monto, moneda,
                             fecha_emision, estatus, serie, folio_fiscal, rfc, razon_social, uso_cfdi,
                             entidad_emisora_id)
       select $1::uuid, $2::text, c.id, cl.id, $3::numeric, $4::numeric, $5::numeric, 'MXN',
              $6::date, $7::est_factura, e.serie_folios, $8::text, cl.rfc, cl.razon_social,
              'G03 - Gastos en general', e.id
         from campanas c
         join clientes cl on cl.tenant_id = $1::uuid and cl.id = c.cliente_id
         left join lateral (
           select ef.id, ef.serie_folios from entidades_fiscales ef
             join entidad_roles er on er.tenant_id = $1::uuid and er.entidad_id = ef.id and er.rol = 'VENTAS'
            where ef.tenant_id = $1::uuid
            order by ef.razon_social limit 1) e on true
        where c.tenant_id = $1::uuid and c.folio = $9::text
       on conflict do nothing`,
      [T, f.folio, f.subtotal, f.iva, f.monto, f.emision, f.estatus, f.folioFiscal, f.campanaFolio],
    )
    add(
      `cobranza ${f.folio} (${f.cobranza})`,
      `insert into cobranzas (tenant_id, factura_id, plazo_dias, fecha_vencimiento, estatus, monto_pagado)
       select $1::uuid, fa.id, $2::integer, $3::date, $4::est_cobranza, $5::numeric
         from facturas fa
        where fa.tenant_id = $1::uuid and fa.folio = $6::text
          and not exists (select 1 from cobranzas x where x.tenant_id = $1::uuid and x.factura_id = fa.id)`,
      [T, f.plazo, f.vence, f.cobranza, f.pagado, f.folio],
    )
  }

  // ─── Órdenes de trabajo ──────────────────────────────────────────────────
  // Asignadas al usuario de OPERACIONES de la semilla. La hora de inicio y
  // cierre va dentro del mismo día para que el reporte por operación tenga
  // horas que sumar y la fecha no cambie de día con la zona horaria.
  const operaciones = plan.usuarios.find((u) => u.rol === 'OPERACIONES').email
  for (const o of plan.ordenes) {
    const enCurso = ['EN_PROCESO', 'EN_REVISION', 'BLOQUEADA'].includes(o.estatus)
    add(
      `OT ${o.folio} (${o.estatus})`,
      `insert into ordenes_trabajo (tenant_id, folio, tipo, sitio_id, campana_id, descripcion, prioridad,
                                    asignado_a, fecha_programada, fecha_inicio, fecha_completada, estatus)
       select $1::uuid, $2::text, $3::tipo_ot, s.id, c.id, $4::text, $5::prioridad,
              case when $6::text <> 'PENDIENTE'
                   then (select u.id from usuarios u where lower(u.email) = lower($7::text) and u.tenant_id = $1::uuid) end,
              ($8::date + time '09:00')::timestamptz,
              case when $9::boolean or $10::boolean then ($8::date + time '09:00')::timestamptz end,
              case when $9::boolean then ($8::date + time '13:30')::timestamptz end,
              $6::est_ot
         from sitios s
         left join campanas c on c.tenant_id = $1::uuid and c.folio = $11::text
        where s.tenant_id = $1::uuid and s.clave_interna = $12::text
       on conflict (folio) do nothing`,
      [T, o.folio, o.tipo, o.descripcion, o.prioridad, o.estatus, operaciones, o.fecha,
        o.completada, enCurso, o.campanaFolio, o.sitio],
      { silencioso: true },
    )
  }

  return out
}

// ─── La vuelta atrás ───────────────────────────────────────────────────────
//
// Borra SOLO lo que siembra este archivo, de UNA organización, en orden inverso
// de dependencia y en una sola transacción. Existe porque restaurar un
// `pg_dump` entero no sirve en el PADRE: `--clean` emite
// `DROP EXTENSION pgcrypto`, que es de `postgres` y no de `spaces_migrador`
// (diario del 01/10), y la restauración muere entera.
//
// Sin `cascade` a propósito (R5): si la demo ya generó filas que cuelgan de
// las del catálogo —una evidencia, una orden de impresión—, la clave ajena
// para el borrado y la transacción vuelve atrás, en vez de llevarse por
// delante algo que nadie listó aquí.
export function sentenciasDeshacer(plan, T) {
  const rfcs = plan.clientes.map((c) => c.rfc)
  const predios = plan.predios.map((p) => p.nombre)
  const arrendadores = plan.arrendadores.map((a) => a.nombre)
  const correos = plan.usuarios.map((u) => u.email.toLowerCase())
  const q = (etiqueta, sql, valores = [T]) => ({ etiqueta, sql, valores })
  return [
    q('cobranzas', `delete from cobranzas where tenant_id = $1::uuid and factura_id in
        (select id from facturas where tenant_id = $1::uuid and folio like 'CAT-FAC-%')`),
    q('facturas', `delete from facturas where tenant_id = $1::uuid and folio like 'CAT-FAC-%'`),
    q('ordenes_trabajo', `delete from ordenes_trabajo where tenant_id = $1::uuid and folio like 'CAT-OT-%'`),
    q('reservas', `delete from reservas where tenant_id = $1::uuid and campana_id in
        (select id from campanas where tenant_id = $1::uuid and folio like 'CAT-CMP-%')`),
    q('campanas', `delete from campanas where tenant_id = $1::uuid and folio like 'CAT-CMP-%'`),
    q('propuesta_items', `delete from propuesta_items where tenant_id = $1::uuid and propuesta_id in
        (select id from propuestas where tenant_id = $1::uuid and folio like 'CAT-PRO-%')`),
    q('propuestas', `delete from propuestas where tenant_id = $1::uuid and folio like 'CAT-PRO-%'`),
    q('pagos_renta', `delete from pagos_renta where tenant_id = $1::uuid and contrato_id in
        (select c.id from contratos_arrendamiento c join predios p on p.id = c.predio_id
          where c.tenant_id = $1::uuid and p.tenant_id = $1::uuid and p.nombre = any($2::text[]))`, [T, predios]),
    q('consumos_energia', `delete from consumos_energia where tenant_id = $1::uuid and predio_id in
        (select id from predios where tenant_id = $1::uuid and nombre = any($2::text[]))`, [T, predios]),
    q('contratos', `delete from contratos_arrendamiento where tenant_id = $1::uuid and predio_id in
        (select id from predios where tenant_id = $1::uuid and nombre = any($2::text[]))`, [T, predios]),
    q('sitio_modalidades', `delete from sitio_modalidades where tenant_id = $1::uuid and sitio_id in
        (select id from sitios where tenant_id = $1::uuid and clave_interna like 'CAT-%')`),
    q('sitios', `delete from sitios where tenant_id = $1::uuid and clave_interna like 'CAT-%'`),
    q('predios', `delete from predios where tenant_id = $1::uuid and nombre = any($2::text[])`, [T, predios]),
    q('arrendadores', `delete from arrendadores where tenant_id = $1::uuid and nombre = any($2::text[])`, [T, arrendadores]),
    // Los clientes de la agencia antes que la agencia: la referencian.
    q('clientes', `delete from clientes where tenant_id = $1::uuid and rfc = any($2::text[]) and agencia_id is not null`, [T, rfcs]),
    q('clientes', `delete from clientes where tenant_id = $1::uuid and rfc = any($2::text[])`, [T, rfcs]),
    q('usuarios', `delete from usuarios where tenant_id = $1::uuid and lower(email) = any($2::text[])`, [T, correos]),
  ]
}

// ─── Línea de órdenes ──────────────────────────────────────────────────────

const USO = `uso:
  DATABASE_URL=postgresql://usuario:clave@host:puerto/base \\
  SEMILLA_CLAVE='<contrasena de los usuarios demo>' \\
    node scripts/semilla-catalogo-demo.mjs [opciones]

  --org=<slug>            organizacion a crear/reusar (por omision demo-rentabilidad)
  --org-nombre=<texto>    su nombre visible si hay que crearla
  --ancla=AAAA-MM-DD      el «hoy» de la semilla (por omision hoy)
  --resumen               imprime lo que sembraria y NO toca ninguna base
  --deshacer              borra lo sembrado por este script (lo CAT-) de esa organizacion`

const BASES_PROHIBIDAS = ['spaces_e2e']

function opcionesDeArgv(args) {
  const o = { resumen: false, deshacer: false }
  for (const a of args) {
    if (a === '--resumen') { o.resumen = true; continue }
    if (a === '--deshacer') { o.deshacer = true; continue }
    const m = /^--([a-z-]+)=(.*)$/.exec(a)
    if (!m) throw new Error(`argumento desconocido: ${a}\n\n${USO}`)
    const [, k, v] = m
    if (k === 'org') o.slug = v
    else if (k === 'org-nombre') o.nombreOrg = v
    else if (k === 'ancla') o.ancla = v
    else throw new Error(`opcion desconocida: --${k}\n\n${USO}`)
  }
  return o
}

function imprimirResumen(plan) {
  const cuenta = (lista, f) => Object.entries(lista.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {}))
    .map(([k, n]) => `${k} ${n}`).join(' · ')
  console.log(`\nCATALOGO DE LA DEMO — organizacion '${plan.organizacion.slug}', hoy = ${plan.hoy}`)
  console.log(`  pantallas    ${plan.sitios.length}: ${cuenta(plan.sitios, (s) => (s.digital ? 'digital' : 'fija'))}`)
  console.log(`    fijas      ${cuenta(plan.sitios.filter((s) => !s.digital), (s) => s.comercial)}`)
  console.log(`    digitales  ${cuenta(plan.sitios.filter((s) => s.digital), (s) => s.comercial)}`)
  console.log(`    legal      ${cuenta(plan.sitios, (s) => s.legal)}`)
  console.log(`    operativo  ${cuenta(plan.sitios, (s) => s.operativo)}`)
  console.log(`  arrendadores ${plan.arrendadores.length} · predios ${plan.predios.length} · contratos ${plan.contratos.length}: ${cuenta(plan.contratos, (k) => k.estatus)}`)
  console.log(`  rentas       ${plan.pagos.length}: ${cuenta(plan.pagos, (p) => p.estatus)} (${plan.pagos[0]?.periodo} → ${plan.pagos.map((p) => p.periodo).sort().at(-1)})`)
  console.log(`  luz          ${plan.consumos.length} recibos (${plan.consumos.map((c) => c.periodo).sort()[0]} → ${plan.consumos.map((c) => c.periodo).sort().at(-1)})`)
  console.log(`  clientes     ${plan.clientes.length}`)
  console.log(`  propuestas   ${plan.propuestas.length}: ${cuenta(plan.propuestas, (p) => p.estatus)}`)
  console.log(`  campanas     ${plan.campanas.length}: ${cuenta(plan.campanas, (c) => c.estado)}`)
  console.log(`    de ${plan.campanas.map((c) => c.desde).sort()[0]} a ${plan.campanas.map((c) => c.hasta).sort().at(-1)}`)
  console.log(`  reservas     ${plan.reservas.length}: ${cuenta(plan.reservas, (r) => r.estatus)}`)
  console.log(`  comprobantes ${plan.comprobantes.length}: ${cuenta(plan.comprobantes, (f) => `${f.estatus}/${f.cobranza}`)}`)
  console.log(`  ordenes      ${plan.ordenes.length}: ${cuenta(plan.ordenes, (o) => o.estatus)}`)
  console.log(`  usuarios     ${plan.usuarios.map((u) => `${u.rol} <${u.email}>`).join('\n               ')}`)
  console.log('')
}

export async function main(argv = process.argv) {
  let o
  let plan
  try {
    o = opcionesDeArgv(argv.slice(2))
    plan = planCatalogo(o)
  } catch (e) {
    console.error(`ERROR semilla-catalogo-demo: ${e.message}`)
    return 1
  }

  if (o.deshacer) return deshacer(plan)

  imprimirResumen(plan)
  const malos = comprobarCoherencia(plan)
  if (malos.length) {
    // Con «hoy» movido lo bastante, una campaña ACTIVA deja de estarlo y una
    // pantalla OCUPADA se queda sin campaña. Mejor no sembrar que sembrar una
    // demo que se contradice delante de gente.
    console.error('ERROR semilla-catalogo-demo: el catalogo no es coherente con esta fecha:')
    for (const m of malos) console.error(`  - ${m}`)
    return 1
  }
  console.log('coherencia: estados, fechas y cobertura comprobados sobre el plan.')
  if (o.resumen) {
    console.log('--resumen: no se toco ninguna base.')
    return 0
  }

  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(`ERROR semilla-catalogo-demo: falta DATABASE_URL.\n\n${USO}`)
    return 1
  }
  let base = ''
  try { base = new URL(url).pathname.replace(/^\//, '') } catch {}
  if (BASES_PROHIBIDAS.includes(base)) {
    console.error(`ERROR semilla-catalogo-demo: me niego a sembrar '${base}', que es la base del arnes de integracion.`)
    return 1
  }
  const clave = process.env.SEMILLA_CLAVE ?? ''
  if (clave.length < 10) {
    console.error('ERROR semilla-catalogo-demo: falta SEMILLA_CLAVE (10 caracteres o mas): es la contrasena de los usuarios demo.')
    return 1
  }

  const cli = new pg.Client({ connectionString: url })
  await cli.connect()
  let salida = 0
  try {
    await cli.query('begin')
    await cli.query(
      `insert into tenants (nombre, slug, moneda) values ($1::text, $2::text, 'MXN') on conflict (slug) do nothing`,
      [plan.organizacion.nombre, plan.organizacion.slug],
    )
    const { rows } = await cli.query('select id from tenants where slug = $1::text', [plan.organizacion.slug])
    if (!rows.length) throw new Error(`no se pudo resolver la organizacion '${plan.organizacion.slug}'`)
    const T = rows[0].id
    console.log(`organizacion '${plan.organizacion.slug}' → ${T}`)
    // Contexto de tenant transaction-local, como `q()` (`lib/server/db.ts`):
    // con un rol sujeto a RLS, sin él los guards `not exists` no verían nada.
    await cli.query('select set_config($1, $2, true)', ['app.tenant_id', T])

    let nuevas = 0
    let ya = 0
    const porTabla = {}
    for (const s of sentenciasDelCatalogo(plan, T, clave)) {
      const r = await cli.query(s.sql, s.valores)
      const tabla = s.etiqueta.split(' ')[0]
      if (r.rowCount > 0) {
        nuevas += r.rowCount
        porTabla[tabla] = (porTabla[tabla] ?? 0) + r.rowCount
        if (!s.silencioso) console.log(`  + ${s.etiqueta}`)
      } else ya += 1
    }

    // Un correo que ya existía se saltó en silencio. Si es de OTRA organización,
    // esa persona no va a ver nada de esta demo al entrar: se dice.
    const ajenos = await cli.query(
      `select u.email, t.slug from usuarios u join tenants t on t.id = u.tenant_id
        where lower(u.email) = any($1::text[]) and u.tenant_id <> $2::uuid`,
      [plan.usuarios.map((u) => u.email.toLowerCase()), T],
    )
    await cli.query('commit')

    console.log(`\nfilas nuevas: ${nuevas} · ya sembradas: ${ya}`)
    console.log(`  por tipo: ${Object.entries(porTabla).map(([k, n]) => `${k} ${n}`).join(' · ') || 'ninguna'}`)
    if (nuevas === 0) console.log('nada que hacer: el catalogo ya estaba completo (idempotente).')
    for (const a of ajenos.rows)
      console.log(`AVISO: ${a.email} ya existia en la organizacion '${a.slug}', no en esta. No se toco.`)
  } catch (e) {
    await cli.query('rollback').catch(() => {})
    console.error(`\nERROR semilla-catalogo-demo: ${e.message}`)
    salida = 2
  } finally {
    await cli.end()
  }
  return salida
}

async function deshacer(plan) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(`ERROR semilla-catalogo-demo: falta DATABASE_URL.

${USO}`)
    return 1
  }
  const cli = new pg.Client({ connectionString: url })
  await cli.connect()
  try {
    const { rows } = await cli.query('select id from tenants where slug = $1::text', [plan.organizacion.slug])
    if (!rows.length) {
      console.log(`no existe la organizacion '${plan.organizacion.slug}': nada que deshacer.`)
      return 0
    }
    const T = rows[0].id
    await cli.query('begin')
    await cli.query('select set_config($1, $2, true)', ['app.tenant_id', T])
    const borradas = []
    for (const s of sentenciasDeshacer(plan, T)) {
      const r = await cli.query(s.sql, s.valores)
      if (r.rowCount) borradas.push(`${s.etiqueta} ${r.rowCount}`)
    }
    await cli.query('commit')
    console.log(`deshecho en '${plan.organizacion.slug}': ${borradas.join(' · ') || 'no habia nada del catalogo'}`)
    return 0
  } catch (e) {
    await cli.query('rollback').catch(() => {})
    console.error(`
ERROR semilla-catalogo-demo --deshacer: ${e.message}
No se borro nada: la transaccion volvio atras entera.`)
    return 2
  } finally {
    await cli.end()
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/semilla-catalogo-demo.mjs')) {
  main().then((c) => process.exit(c))
}

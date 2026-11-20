// ============================================================================
//  lib/space-eyes-reporte-campanas.ts — El Excel de las campañas que Space Eye
//  DETECTÓ al aire (Space Eyes → Campañas, pedido del dueño del 19/11/2026).
// ----------------------------------------------------------------------------
//  QUÉ ES UNA DETECCIÓN. Una foto de Space Eye con `source = 'campana'` y su
//  `campaign_id`: el equipo reconoció el arte de esa campaña en su pantalla y
//  subió la prueba (`space-eye/backend/src/controllers/dashboard.controller.ts`,
//  `listPhotos`). No hay «duración» en Space Eye —una foto es un instante—, así
//  que el reporte no la inventa: da la hora de cada detección y, en el resumen,
//  la primera, la última y cuántas.
//
//  LA HORA. Space Eye la entrega en UTC (`config/database.ts`, `timezone: 'Z'`)
//  y ya corregida por el desfase del reloj del equipo. Quien lee el reporte
//  vive en la zona del NEGOCIO (`zonaDelNegocio()`, México por omisión): a las
//  18:00 de México el día UTC ya es el siguiente, y una prueba de las 18:30 del
//  lunes saldría como del martes. Por eso todo se pasa a hora local AQUÍ, una
//  sola vez, y a número de serie de Excel: una fecha en texto no se puede
//  ordenar ni filtrar, que es para lo que se baja un Excel.
//
//  EL RANGO. El día que elige el usuario es el de SU zona: «del 3 al 5» es de
//  las 00:00 del 3 a las 23:59:59 del 5 en México, que en UTC es de las 06:00
//  del 3 a las 05:59:59 del 6. Así se le pide a Space Eye (`limitesUTC`).
//
//  LA LIBRERÍA. `xlsx` (SheetJS 0.18.5), la que ya usan los exports de
//  inventario y contratos; no entra ninguna dependencia nueva. Su hallazgo de
//  seguridad abierto (13/11, H2: sin parche en npm) es de LEER archivos ajenos
//  (prototype pollution y ReDoS al parsear); aquí solo se ESCRIBE un libro con
//  datos propios. Y como en un .xlsx una celda de texto nunca es fórmula, un
//  nombre de campaña que empiece por «=» no se ejecuta (la defensa de
//  `contratos-export.ts` es para el CSV).
//
//  Es PURO a propósito —sin `fetch`, sin `Date.now()` escondido— para que la
//  hora, el rango y las celdas se prueben sin servidor
//  (`space-eyes-reporte-campanas.test.ts`).
// ============================================================================

import * as XLSX from 'xlsx'
import { traducir, type ClaveTexto } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'
import { localeDe } from '@/lib/i18n/formato-idioma'

// ─── Lo que llega de Space Eye ──────────────────────────────────────────────

/** Una fila de `GET /api/photos` (solo lo que el reporte usa). */
export interface FotoDeteccionSE {
  id: number
  device_id: number
  campaign_id: number | null
  /** ISO en UTC, ya corregido por el desfase del reloj del equipo. */
  taken_at: string
  device_name: string | null
  campaign_name: string | null
  verification_status: string | null
  is_correct: number | boolean | null
}

export interface CampanaReporteSE {
  id: number
  name: string
  advertiser: string | null
  /** 'spaceos:<empresa>' si llegó sola de Operaciones. */
  origen?: string | null
}

export interface EquipoReporteSE {
  id: number
  name: string
  billboard_code: string | null
}

// ─── Fechas y zona ──────────────────────────────────────────────────────────

const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/
/** El rango más largo que se acepta: un año. Más que eso es pedirle a Space Eye la flota entera. */
const MAX_DIAS = 366

function esDiaValido(s: string): boolean {
  const m = RE_DIA.exec(s)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}

interface PartesLocales {
  dia: string // YYYY-MM-DD
  hora: string // HH:MM:SS
}

const formateadores = new Map<string, Intl.DateTimeFormat>()
function partesEnZona(instante: Date, zona: string): PartesLocales {
  let f = formateadores.get(zona)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formateadores.set(zona, f)
  }
  const p: Record<string, string> = {}
  for (const x of f.formatToParts(instante)) p[x.type] = x.value
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}:${p.second}` }
}

/** Milisegundos «de pared» (la hora local leída como si fuera UTC). */
function msDePared(dia: string, hora = '00:00:00'): number {
  const [a, m, d] = dia.split('-').map(Number)
  const [h, mi, s] = hora.split(':').map(Number)
  return Date.UTC(a, m - 1, d, h, mi, s)
}

/** El instante UTC en que empieza `dia` en `zona` (con un reajuste por si cae en un cambio de horario). */
function inicioDelDia(dia: string, zona: string): Date {
  const objetivo = msDePared(dia)
  let t = objetivo
  for (let i = 0; i < 2; i++) {
    const p = partesEnZona(new Date(t), zona)
    t += objetivo - msDePared(p.dia, p.hora)
  }
  return new Date(t)
}

function sumarDias(dia: string, n: number): string {
  return new Date(msDePared(dia) + n * 86_400_000).toISOString().slice(0, 10)
}

const sqlUTC = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')

/** Número de serie de Excel (días desde 1899-12-30) de una fecha y hora LOCALES. */
export function serialExcel(dia: string, hora = '00:00:00'): number {
  return msDePared(dia, hora) / 86_400_000 + 25569
}

// ─── El rango ───────────────────────────────────────────────────────────────

export interface Rango {
  desde: string
  hasta: string
}

export type RangoResuelto = { ok: true; desde: string; hasta: string; porOmision: boolean } | { ok: false; error: string }

/**
 * El rango del reporte. Sin fechas, el mes en curso EN LA ZONA del negocio (y
 * `porOmision` para que la hoja lo diga). Con una sola, el rango es ese día.
 */
export function rangoDelReporte(
  pedido: { desde?: string | null; hasta?: string | null },
  ahora: Date,
  zona: string,
): RangoResuelto {
  const desde = pedido.desde?.trim() || ''
  const hasta = pedido.hasta?.trim() || ''
  if (!desde && !hasta) {
    const hoy = partesEnZona(ahora, zona).dia
    const [a, m] = hoy.split('-').map(Number)
    const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
    const mes = String(m).padStart(2, '0')
    return { ok: true, desde: `${a}-${mes}-01`, hasta: `${a}-${mes}-${String(ultimo).padStart(2, '0')}`, porOmision: true }
  }
  const d = desde || hasta
  const h = hasta || desde
  if (!esDiaValido(d) || !esDiaValido(h)) return { ok: false, error: 'Las fechas van como AAAA-MM-DD' }
  if (h < d) return { ok: false, error: 'La fecha final es anterior a la inicial' }
  if ((msDePared(h) - msDePared(d)) / 86_400_000 + 1 > MAX_DIAS) {
    return { ok: false, error: `El rango no puede pasar de ${MAX_DIAS} días` }
  }
  return { ok: true, desde: d, hasta: h, porOmision: false }
}

/** Los límites que se le piden a Space Eye, en UTC y con el formato que compara MySQL. */
export function limitesUTC(rango: Rango, zona: string): { desde: string; hasta: string } {
  const ini = inicioDelDia(rango.desde, zona)
  const fin = new Date(inicioDelDia(sumarDias(rango.hasta, 1), zona).getTime() - 1000)
  return { desde: sqlUTC(ini), hasta: sqlUTC(fin) }
}

// ─── Las filas ──────────────────────────────────────────────────────────────

export interface FilaDeteccion {
  id: number
  /** El instante tal como vino (UTC). */
  cuando: string
  fechaLocal: string
  horaLocal: string
  campanaId: number
  campana: string
  cliente: string
  equipoId: number
  equipo: string
  codigo: string
  sitio: string
  verificacion: string | null
  correcta: boolean | null
  deOperaciones: boolean
}

export function armarDetecciones(
  fotos: FotoDeteccionSE[],
  ctx: {
    campanas: CampanaReporteSE[]
    equipos: EquipoReporteSE[]
    /** Nombre del sitio por código de pantalla, en minúsculas (`sitios.codigo_proveedor`). */
    sitiosPorCodigo: Map<string, string>
    zona: string
  },
): FilaDeteccion[] {
  const campanas = new Map(ctx.campanas.map((c) => [c.id, c]))
  const equipos = new Map(ctx.equipos.map((e) => [e.id, e]))
  const filas: FilaDeteccion[] = []
  for (const f of fotos) {
    // Una foto sin campaña no es una detección de campaña: no se inventa a cuál.
    if (f.campaign_id == null) continue
    const instante = new Date(f.taken_at)
    if (Number.isNaN(instante.getTime())) continue
    const c = campanas.get(f.campaign_id)
    const e = equipos.get(f.device_id)
    const codigo = (e?.billboard_code ?? '').trim()
    const local = partesEnZona(instante, ctx.zona)
    filas.push({
      id: f.id,
      cuando: f.taken_at,
      fechaLocal: local.dia,
      horaLocal: local.hora,
      campanaId: f.campaign_id,
      campana: f.campaign_name ?? c?.name ?? '',
      cliente: c?.advertiser?.trim() ?? '',
      equipoId: f.device_id,
      equipo: f.device_name ?? e?.name ?? '',
      codigo,
      sitio: codigo ? (ctx.sitiosPorCodigo.get(codigo.toLowerCase()) ?? '') : '',
      verificacion: f.verification_status ?? null,
      correcta: f.is_correct == null ? null : Boolean(Number(f.is_correct)),
      deOperaciones: Boolean(c?.origen),
    })
  }
  return filas.sort((a, b) => new Date(a.cuando).getTime() - new Date(b.cuando).getTime() || a.id - b.id)
}

export interface FilaResumen {
  campana: string
  cliente: string
  equipo: string
  codigo: string
  sitio: string
  primera: FilaDeteccion
  ultima: FilaDeteccion
  detecciones: number
}

/** Una fila por campaña y equipo. Espera las filas YA ordenadas (como salen de `armarDetecciones`). */
export function resumirDetecciones(filas: FilaDeteccion[]): FilaResumen[] {
  const grupos = new Map<string, FilaResumen>()
  for (const f of filas) {
    const k = `${f.campanaId}:${f.equipoId}`
    const g = grupos.get(k)
    if (!g) {
      grupos.set(k, { campana: f.campana, cliente: f.cliente, equipo: f.equipo, codigo: f.codigo, sitio: f.sitio, primera: f, ultima: f, detecciones: 1 })
    } else {
      g.ultima = f
      g.detecciones++
    }
  }
  return [...grupos.values()].sort((a, b) => a.campana.localeCompare(b.campana) || a.equipo.localeCompare(b.equipo))
}

// ─── El libro ───────────────────────────────────────────────────────────────

const VERIFICACION: Record<string, ClaveTexto> = {
  pending: 'spaceeyes.galeria.verif.pending',
  queued: 'spaceeyes.galeria.verif.queued',
  running: 'spaceeyes.galeria.verif.running',
  verified: 'spaceeyes.galeria.verif.verified',
  failed: 'spaceeyes.galeria.verif.failed',
  skipped: 'spaceeyes.galeria.verif.skipped',
}

// En inglés el mes va primero: «02/11» un lector de EE. UU. lo lee como 11 de
// febrero (el mismo criterio que `periodo()` en CampanasEyes).
const formatoFecha = (idioma: Idioma) => (idioma === 'en' ? 'mm/dd/yyyy' : 'dd/mm/yyyy')

function textoDia(dia: string, idioma: Idioma): string {
  const [a, m, d] = dia.split('-')
  return idioma === 'en' ? `${m}/${d}/${a}` : `${d}/${m}/${a}`
}

export interface OpcionesLibro {
  filas: FilaDeteccion[]
  rango: Rango & { porOmision: boolean }
  ahora: Date
  zona: string
  idioma: Idioma
  /** Datos de ejemplo: la hoja lo dice arriba, en mayúsculas. */
  demostracion: boolean
  /** Space Eye tenía más de lo que se trajo. */
  truncado: boolean
  /** Cuántas se trajeron como máximo (para el aviso de `truncado`). */
  maximo?: number
  /** Los nombres de lo que se filtró, para escribirlo. */
  filtros: { equipo?: string; campana?: string }
}

type Celda = XLSX.CellObject

const texto = (v: string): Celda => ({ t: 's', v })
const numero = (v: number, z?: string): Celda => (z ? { t: 'n', v, z } : { t: 'n', v })

function cabecera(o: OpcionesLibro): string[] {
  const t = (k: ClaveTexto, v?: Record<string, string | number>) => traducir(o.idioma, k, v)
  let periodo = t('spaceeyes.reporte.periodo', { desde: textoDia(o.rango.desde, o.idioma), hasta: textoDia(o.rango.hasta, o.idioma) })
  if (o.rango.porOmision) periodo += ` (${t('spaceeyes.reporte.omision')})`
  const generado = new Intl.DateTimeFormat(localeDe(o.idioma), {
    timeZone: o.zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(o.ahora)
  const p: Record<string, string> = {}
  for (const x of generado) p[x.type] = x.value
  const cuando = `${textoDia(`${p.year}-${p.month}-${p.day}`, o.idioma)} ${p.hour}:${p.minute}`
  const lista = [
    o.filtros.equipo ? t('spaceeyes.reporte.filtro.equipo', { nombre: o.filtros.equipo }) : null,
    o.filtros.campana ? t('spaceeyes.reporte.filtro.campana', { nombre: o.filtros.campana }) : null,
  ].filter(Boolean) as string[]
  const lineas = [
    t('spaceeyes.reporte.titulo'),
    periodo,
    t('spaceeyes.reporte.generado', { fecha: cuando, zona: o.zona }),
    lista.length ? t('spaceeyes.reporte.filtros', { lista: lista.join(' · ') }) : t('spaceeyes.reporte.filtros.ninguno'),
  ]
  if (o.demostracion) lineas.push(t('spaceeyes.reporte.demostracion'))
  if (o.truncado) lineas.push(t('spaceeyes.reporte.truncado', { n: o.maximo ?? o.filas.length }))
  return lineas
}

function hoja(lineas: string[], columnas: string[], cuerpo: Celda[][], vacio: string, anchos: number[]): XLSX.WorkSheet {
  const matriz: Celda[][] = lineas.map((l) => [texto(l)])
  matriz.push([])
  matriz.push(columnas.map(texto))
  if (cuerpo.length) matriz.push(...cuerpo)
  else matriz.push([texto(vacio)])
  const h: XLSX.WorkSheet = {}
  let maxC = 0
  matriz.forEach((fila, r) => {
    fila.forEach((c, col) => {
      h[XLSX.utils.encode_cell({ r, c: col })] = c
      if (col > maxC) maxC = col
    })
  })
  h['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: matriz.length - 1, c: Math.max(maxC, columnas.length - 1) } })
  h['!cols'] = anchos.map((wch) => ({ wch }))
  return h
}

/** El libro listo para descargar (bytes de un .xlsx). */
export function construirLibroDetecciones(o: OpcionesLibro): Uint8Array {
  const t = (k: ClaveTexto) => traducir(o.idioma, k)
  const lineas = cabecera(o)
  const fFecha = formatoFecha(o.idioma)
  const fFechaHora = `${fFecha} hh:mm`

  const resultado = (c: boolean | null) =>
    c == null ? t('spaceeyes.reporte.res.sin') : c ? t('spaceeyes.reporte.res.correcta') : t('spaceeyes.reporte.res.incorrecta')
  const verificacion = (v: string | null) => (v && VERIFICACION[v] ? t(VERIFICACION[v]) : (v ?? ''))

  const detalle = hoja(
    lineas,
    [
      t('spaceeyes.reporte.col.fecha'),
      t('spaceeyes.reporte.col.hora'),
      t('spaceeyes.reporte.col.campana'),
      t('spaceeyes.reporte.col.cliente'),
      t('spaceeyes.reporte.col.equipo'),
      t('spaceeyes.reporte.col.codigo'),
      t('spaceeyes.reporte.col.sitio'),
      t('spaceeyes.reporte.col.verificacion'),
      t('spaceeyes.reporte.col.resultado'),
      t('spaceeyes.reporte.col.origen'),
    ],
    o.filas.map((f) => {
      const serial = serialExcel(f.fechaLocal, f.horaLocal)
      const dia = Math.floor(serial)
      return [
        numero(dia, fFecha),
        numero(serial - dia, 'hh:mm:ss'),
        texto(f.campana),
        texto(f.cliente),
        texto(f.equipo),
        texto(f.codigo),
        texto(f.sitio),
        texto(verificacion(f.verificacion)),
        texto(resultado(f.correcta)),
        texto(f.deOperaciones ? t('spaceeyes.reporte.origen.operaciones') : t('spaceeyes.reporte.origen.manual')),
      ]
    }),
    t('spaceeyes.reporte.vacio'),
    [12, 10, 30, 24, 28, 16, 28, 20, 14, 20],
  )

  const resumen = hoja(
    lineas,
    [
      t('spaceeyes.reporte.col.campana'),
      t('spaceeyes.reporte.col.cliente'),
      t('spaceeyes.reporte.col.equipo'),
      t('spaceeyes.reporte.col.codigo'),
      t('spaceeyes.reporte.col.sitio'),
      t('spaceeyes.reporte.col.primera'),
      t('spaceeyes.reporte.col.ultima'),
      t('spaceeyes.reporte.col.detecciones'),
    ],
    resumirDetecciones(o.filas).map((g) => [
      texto(g.campana),
      texto(g.cliente),
      texto(g.equipo),
      texto(g.codigo),
      texto(g.sitio),
      numero(serialExcel(g.primera.fechaLocal, g.primera.horaLocal), fFechaHora),
      numero(serialExcel(g.ultima.fechaLocal, g.ultima.horaLocal), fFechaHora),
      numero(g.detecciones),
    ]),
    t('spaceeyes.reporte.vacio'),
    [30, 24, 28, 16, 28, 18, 18, 12],
  )

  const libro = XLSX.utils.book_new()
  // Excel no admite más de 31 caracteres en el nombre de una hoja.
  XLSX.utils.book_append_sheet(libro, detalle, t('spaceeyes.reporte.hoja.detecciones').slice(0, 31))
  XLSX.utils.book_append_sheet(libro, resumen, t('spaceeyes.reporte.hoja.resumen').slice(0, 31))
  const salida = XLSX.write(libro, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer
  return new Uint8Array(salida)
}

export function nombreArchivoReporte(rango: Rango, demostracion: boolean): string {
  return `space-eyes-campanas-detectadas-${rango.desde}-a-${rango.hasta}${demostracion ? '-demostracion' : ''}.xlsx`
}

// ─── La demostración ────────────────────────────────────────────────────────
//
// Para una instancia sin Space Eye (`estadoDelModulo() === 'no_contratado'`):
// la misma forma que devolvería Space Eye, con los TRES equipos de ejemplo de
// `DemoSpaceEyes` (mismos nombres, en el idioma de quien lo pide) y tres
// campañas inventadas. Determinista —nada de azar—, para que la demo y sus
// pruebas den siempre lo mismo, y nunca en el futuro: un reporte de «lo que se
// detectó» con detecciones de mañana sería mentir dos veces.

const DEMO_EQUIPOS: { id: number; nombre: ClaveTexto; codigo: string }[] = [
  { id: 9001, nombre: 'spaceeyes.demo.equipo.a', codigo: 'DEMO-01' },
  { id: 9002, nombre: 'spaceeyes.demo.equipo.b', codigo: 'DEMO-02' },
  { id: 9003, nombre: 'spaceeyes.demo.equipo.c', codigo: 'DEMO-03' },
]
const DEMO_CAMPANAS: { id: number; nombre: ClaveTexto; cliente: ClaveTexto; deOperaciones: boolean }[] = [
  { id: 9101, nombre: 'spaceeyes.reporte.demo.campana.a', cliente: 'spaceeyes.reporte.demo.cliente.a', deOperaciones: true },
  { id: 9102, nombre: 'spaceeyes.reporte.demo.campana.b', cliente: 'spaceeyes.reporte.demo.cliente.b', deOperaciones: true },
  { id: 9103, nombre: 'spaceeyes.reporte.demo.campana.c', cliente: 'spaceeyes.reporte.demo.cliente.c', deOperaciones: false },
]
// Qué campaña va en qué equipo, y a qué horas (locales) la reconoce cada día.
const DEMO_PARES: { equipo: number; campana: number; horas: string[]; cadaDias: number }[] = [
  { equipo: 9001, campana: 9101, horas: ['09:14:22', '13:41:05', '19:02:48'], cadaDias: 1 },
  { equipo: 9002, campana: 9101, horas: ['10:05:37', '18:27:10'], cadaDias: 1 },
  { equipo: 9002, campana: 9102, horas: ['12:33:51'], cadaDias: 1 },
  // El equipo C es el que en la demostración está fuera de línea: detecta menos.
  { equipo: 9003, campana: 9103, horas: ['08:48:19'], cadaDias: 3 },
]

export function deteccionesDeDemostracion(
  rango: Rango,
  zona: string,
  idioma: Idioma,
  ahora: Date,
  filtro: { equipo?: number | null; campana?: number | null } = {},
): { fotos: FotoDeteccionSE[]; campanas: CampanaReporteSE[]; equipos: EquipoReporteSE[] } {
  const t = (k: ClaveTexto) => traducir(idioma, k)
  const equipos = DEMO_EQUIPOS.map((e) => ({ id: e.id, name: t(e.nombre), billboard_code: e.codigo }))
  const campanas = DEMO_CAMPANAS.map((c) => ({
    id: c.id,
    name: t(c.nombre),
    advertiser: t(c.cliente),
    origen: c.deOperaciones ? 'spaceos:demostracion' : null,
  }))
  const nombreEquipo = new Map(equipos.map((e) => [e.id, e.name]))
  const nombreCampana = new Map(campanas.map((c) => [c.id, c.name]))
  const fotos: FotoDeteccionSE[] = []
  let id = 1
  const limite = ahora.getTime()
  for (let dia = rango.desde, n = 0; dia <= rango.hasta && n <= MAX_DIAS; dia = sumarDias(dia, 1), n++) {
    const ordinal = Math.round(msDePared(dia) / 86_400_000)
    for (const par of DEMO_PARES) {
      if (filtro.equipo && par.equipo !== filtro.equipo) continue
      if (filtro.campana && par.campana !== filtro.campana) continue
      if (ordinal % par.cadaDias !== 0) continue
      par.horas.forEach((hora, i) => {
        const instante = inicioDelDia(dia, zona).getTime() + (msDePared(dia, hora) - msDePared(dia))
        if (instante > limite) return
        // Una de cada siete sin verificar, para que la columna enseñe los dos casos.
        const verificada = (ordinal + i) % 7 !== 0
        fotos.push({
          id: id++,
          device_id: par.equipo,
          campaign_id: par.campana,
          taken_at: new Date(instante).toISOString(),
          device_name: nombreEquipo.get(par.equipo) ?? null,
          campaign_name: nombreCampana.get(par.campana) ?? null,
          verification_status: verificada ? 'verified' : 'pending',
          is_correct: verificada ? 1 : null,
        })
      })
    }
  }
  return { fotos, campanas, equipos }
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { MONEDAS, fijarMonedaInstancia } from './dinero'
import { leerDinero } from './simbolo-en-pantalla'
import { huellasEnItaliano } from './guardias-italiano'

// ============================================================================
//  I18N · CONSUMO DE LUZ (`/energia`), RENDIDO EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  Mismo arnes que `pantallas-inicio.test.ts`: componente REAL, proveedor de
//  idioma y `useState` forzado por valor inicial y por PILA (el tablero llega
//  por un `fetch` en un efecto, que en el servidor no corre). Cada estado
//  importa su componente PRIMERO y fuerza DESPUES (leccion del validador de
//  clientes). Con `I18N_VOLCAR=<carpeta>` vuelca el HTML espanol.
//
//  SOLO LA INTERFAZ: la lectura de los recibos de CFE y sus cifras no se
//  tocan. LO QUE NO VE: los avisos que manda el SERVIDOR sobre cada PDF
//  (`p.avisos`, `lectura.avisos`), que siguen en espanol (I18N-05).
// ============================================================================

type Forzado = { si: (inicial: unknown, pila: string) => boolean; valor: unknown }
const forzado = vi.hoisted(() => ({ cola: [] as Forzado[] }))

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>()
  function useState(inicial?: unknown) {
    const valorInicial = typeof inicial === 'function' ? undefined : inicial
    const cabeza = forzado.cola[0]
    if (cabeza && cabeza.si(valorInicial, new Error().stack ?? '')) {
      forzado.cola.shift()
      return real.useState(cabeza.valor)
    }
    return real.useState(inicial)
  }
  return { ...real, default: { ...real, useState }, useState }
})
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/energia',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('@/components/demo/ui/ConfirmDialog', () => ({
  ConfirmDialog: (p: { open: boolean; title: string; confirmLabel?: string; children: unknown }) =>
    p.open ? createElement('div', null, createElement('h2', null, p.title), p.children as never,
      createElement('button', null, p.confirmLabel ?? 'Confirmar')) : null,
}))
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; subtitulo?: unknown; resumen?: unknown; accion?: unknown; children?: unknown }) =>
    createElement('section', null, createElement('h3', null, p.titulo), p.subtitulo as never, p.resumen as never,
      p.accion as never, p.children as never),
}))

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 1, 15, 12))
})
afterEach(() => {
  vi.useRealTimers()
})

function pintar(idioma: Idioma, el: ReactElement): string {
  return renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, el))
}
function texto(html: string): string {
  return html
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}
function enesimo(componente: string, pred: (v: unknown) => boolean, n = 1) {
  let vistos = 0
  return (v: unknown, pila: string) => {
    if (!pila.includes(componente) || !pred(v)) return false
    vistos += 1
    return vistos === n
  }
}
const forzar = (si: Forzado['si'], valor: unknown) => forzado.cola.push({ si, valor })
const esNull = (v: unknown) => v === null
const esIndefinido = (v: unknown) => v === undefined
const esObjeto = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v)

// ─── Datos ──────────────────────────────────────────────────────────────────
const recibo = (id: string, periodo: string, medidor: string | null, kwh: number, importe: number) => ({
  id, predioId: 'pr1', sitioId: null, periodo, medidor, kwh, importe, notas: null, creadoEn: '2026-01-05',
})
const PUNTOS = [
  { clave: 'P:pr1', tipo: 'predio', id: 'pr1', nombre: 'Predio Reforma', pantallas: 2 },
  { clave: 'P:pr2', tipo: 'predio', id: 'pr2', nombre: 'Predio Sur', pantallas: 1 },
  { clave: 'S:s9', tipo: 'pantalla', id: 's9', nombre: 'Pantalla Aeropuerto', pantallas: 1 },
]
const TABLERO = {
  desde: '2026-01-01', hasta: '2026-02-28', meses: ['2026-01-01', '2026-02-01'], puntos: PUNTOS,
  celdas: [
    { punto: 'P:pr1', mes: '2026-01', recibos: [recibo('r1', '2026-01-01', 'M-1', 1200, 3400.5), recibo('r2', '2026-01-01', null, 100, 200)] },
    { punto: 'P:pr2', mes: '2026-02', recibos: [recibo('r3', '2026-02-01', 'M-2', 300, 900)] },
  ],
  esperados: 6, faltantes: 3, huerfanos: [recibo('r9', '2026-01-01', 'X', 10, 50)],
}
const TABLERO_COMPLETO = { ...TABLERO, faltantes: 0, huerfanos: [] }
const TABLERO_VACIO = { ...TABLERO, puntos: [], celdas: [], esperados: 0, faltantes: 0, huerfanos: [] }
const LECTURA = {
  esRecibo: true, numeroServicio: '123456789012', medidorFisico: 'AB12', tarifa: 'PDBT', desde: '2025-11-10', hasta: '2026-01-09',
  kwh: null, kwhLeido: 1500, facturacionPeriodo: 4000, alumbradoPublico: 200, importe: 4200, importeLeido: 4200,
  totalDelRecibo: 9000, conceptos: [], avisos: [],
}
const propuestaRecibo = (archivo: string, coincide: boolean | null, ya: boolean) => ({
  archivo, esRecibo: true, lectura: LECTURA, predioId: ya ? 'pr1' : null, sitioId: null, emparejamiento: 'historial',
  medidor: '123456789012', notas: null, mesesEsperados: 1, mesesDelPdf: 3, coincideMeses: coincide, avisos: [],
  renglones: [{ periodo: '2026-01-01', kwh: ya ? 500 : null, importe: ya ? 1400 : null, dias: 30,
    yaCapturado: ya ? { id: 'r1', periodo: '2026-01-01', medidor: 'M-1', kwh: 1200, importe: 3400.5 } : null }],
})
const RESPUESTA = {
  propuestas: [propuestaRecibo('a.pdf', false, true), propuestaRecibo('b.pdf', false, false),
    { ...propuestaRecibo('c.pdf', null, false), esRecibo: false, renglones: [] }],
  leidos: 2, total: 3, mesesEsperados: 1,
}
const RESPUESTA_OK = {
  propuestas: [propuestaRecibo('a.pdf', true, false)].map((p) => ({ ...p, predioId: 'pr1', renglones: [{ ...p.renglones[0], kwh: 5, importe: 9 }] })),
  leidos: 1, total: 1, mesesEsperados: 3,
}

const energia = async () => (await import('../../app/(app)/(shell)/energia/page')).default
const subir = async () => (await import('../../components/demo/energia/SubirRecibos')).SubirRecibos
const filasDe = async (r: { propuestas: unknown[] }) =>
  (await import('../../components/demo/energia/recibos')).filasDeConfirmacion(r.propuestas as never)

type Estado = {
  nombre: string
  pintar: (idioma: Idioma) => Promise<string>
  espanol: string[]
  ingles: string[]
  /** Lote L1 del italiano (2026-11-03): lo que TIENE que salir en `it`. */
  italiano: string[]
  dinero?: boolean
}

export const ESTADOS: Estado[] = [
  {
    nombre: 'energia · rejilla con huecos y huerfanos',
    dinero: true,
    pintar: async (idioma) => {
      const Pagina = await energia()
      forzar(enesimo('EnergiaPage', esNull), TABLERO)
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Consumo de luz', 'Un recibo por predio y por mes. Se reparte entre sus pantallas igual que la renta.',
      'Recibos capturados', '3 de 6', 'del periodo', '>Faltan<', 'el reporte enseña menos luz de la real',
      'Importe del periodo', 'solo lo capturado · 1 recibo sin pantalla', 'kWh del periodo', 'solo lo capturado',
      '>Periodo<', '>Desde<', '>Hasta<', 'Capturar un recibo', 'Predio o pantalla', 'Predio Reforma · 2 pantallas',
      'Predio Sur · 1 pantalla', 'Pantalla Aeropuerto · pantalla suelta', 'Mes del recibo', 'Medidor', '>Importe<', 'Guardar recibo',
      '1 · ¿Cuántos meses de calendario cubre cada recibo de esta tanda?', '— elige antes de subir —',
      '1 mes de calendario — un periodo corto, dentro de un solo mes', '2 meses de calendario — lo normal en un recibo MENSUAL',
      '3 meses de calendario — lo normal en un recibo BIMESTRAL', '4 meses de calendario — un periodo largo o atrasado',
      'Se cuentan los meses de calendario que <strong>toca</strong> el periodo, no lo que dura. Un recibo mensual empieza a mitad de mes, así que casi siempre toca <strong>dos</strong>; uno bimestral, <strong>tres</strong>. Si mezclas mensuales y bimestrales en la misma tanda, muchos saldrán marcados: súbelos por separado.',
      '2 · Subir PDF del recibo', 'Se leen en el servidor y no se guarda nada: revisa cada renglón contra el recibo y confírmalo.',
      'Qué está capturado y qué falta', '2 meses · 3 puntos',
      'Faltan 3 de 6 recibos del periodo. Mientras falten, el reporte de rentabilidad suma solo lo capturado y enseña un costo de luz MENOR del real, sin avisar de nada: un mes sin recibo no es un mes sin consumo.',
      '1 recibo capturado por $50.00 no llega a ninguna pantalla, porque su predio no tiene ninguna dada de alta. Ese dinero no aparece en el reporte de rentabilidad.',
      'ene 2026', 'feb 2026', 'Pantalla suelta', '>2 pantallas<', 'title="Sin recibo capturado: no es un consumo de cero, es un dato que falta"',
      'aria-label="Borrar el recibo del medidor sin número"', 'title="Borrar este recibo"', 'sin número</button>',
    ],
    ingles: [
      'Power usage', 'One bill per property per month. It is split among its screens the same way as the rent.',
      'Bills entered', '3 of 6', 'in the period', '>Missing<', 'the report shows less electricity than the real figure',
      'Period amount', 'entered only · 1 bill with no screen', 'Period kWh', '>Period<', '>From<', '>To<', 'Enter a bill',
      'Property or screen', 'Predio Reforma · 2 screens', 'Predio Sur · 1 screen', 'Pantalla Aeropuerto · standalone screen',
      'Bill month', 'Meter', '>Amount<', 'Save bill', '1 · How many calendar months does each bill in this batch cover?',
      '— choose before uploading —', '3 calendar months — the usual for a bill issued EVERY TWO MONTHS',
      'Count the calendar months the period <strong>touches</strong>, not how long it lasts.',
      '2 · Upload the bill PDF', 'What’s entered and what’s missing', '2 months · 3 metering points',
      '3 of 6 bills for the period are missing.', '1 entered bill for MX$50.00 doesn’t reach any screen',
      'Jan 2026', 'Feb 2026', 'Standalone screen', '>2 screens<', 'aria-label="Delete the bill for meter (no number)"',
      'title="Delete this bill"', '(no number)</button>',
    ],
    italiano: [
      'Una bolletta per immobile e per mese. Si ripartisce tra i suoi impianti come l’affitto.',
      'Bollette registrate', '3 di 6', 'del periodo', '>Mancanti<', 'il report mostra meno elettricità di quella reale',
      'Importo del periodo', 'solo il registrato · 1 bolletta senza impianto', 'kWh del periodo', 'Registra una bolletta',
      'Immobile o impianto', 'Predio Reforma · 2 impianti', 'Predio Sur · 1 impianto', 'Pantalla Aeropuerto · impianto isolato',
      'Mese della bolletta', 'Contatore', '>Importo<', 'Salva bolletta', '1 · Quanti mesi di calendario copre ogni bolletta di questo lotto?',
      '— scegli prima di caricare —', '1 mese di calendario — un periodo breve, dentro un solo mese',
      '2 mesi di calendario — il caso normale per una bolletta MENSILE', '3 mesi di calendario — il caso normale per una bolletta emessa OGNI DUE MESI',
      '4 mesi di calendario — un periodo lungo o arretrato',
      'Si contano i mesi di calendario che il periodo <strong>tocca</strong>, non quanto dura. Una bolletta mensile inizia a metà mese, quindi quasi sempre ne tocca <strong>due</strong>; una emessa ogni due mesi, <strong>tre</strong>.',
      '2 · Carica il PDF della bolletta', 'Vengono letti sul server e non si salva nulla: controlla ogni riga con la bolletta e confermala.',
      'Cosa è registrato e cosa manca', '2 mesi · 3 punti di prelievo',
      'Bollette mancanti nel periodo: 3 su 6. Finché mancano, il report di redditività somma solo il registrato e mostra un costo della luce MINORE di quello reale, senza nessun avviso: un mese senza bolletta non è un mese senza consumo.',
      '1 bolletta registrata per MX$ 50,00 non arriva a nessun impianto, perché il suo immobile non ne ha nessuno registrato. Quel denaro non compare nel report di redditività.',
      'gen 2026', 'feb 2026', 'Impianto isolato', '>2 impianti<',
      'title="Nessuna bolletta registrata: non è un consumo pari a zero, è un dato mancante"',
      'aria-label="Elimina la bolletta del contatore (senza numero)"', 'title="Elimina questa bolletta"', '(senza numero)</button>',
    ],
  },
  {
    nombre: 'energia · captura completa',
    pintar: async (idioma) => {
      const Pagina = await energia()
      forzar(enesimo('EnergiaPage', esNull), TABLERO_COMPLETO)
      forzar(enesimo('SubirRecibos', (v) => v === '3'), '')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['captura completa', 'Captura completa: están los 6 recibos del periodo.', 'Elige arriba cuántos meses esperas antes de subir los archivos.'],
    ingles: ['all entered', 'All entered: all 6 bills for the period are in.', 'Choose above how many months you expect before uploading the files.'],
    italiano: ['registrazione completa', 'Registrazione completa: ci sono tutte le 6 bollette del periodo.', 'Scegli qui sopra quanti mesi ti aspetti prima di caricare i file.'],
  },
  {
    nombre: 'energia · sin puntos de medicion',
    pintar: async (idioma) => {
      const Pagina = await energia()
      forzar(enesimo('EnergiaPage', esNull), TABLERO_VACIO)
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'No hay dónde capturar todavía: el motivo está abajo.', 'Todavía no hay dónde capturar',
      'Todavía no hay dónde capturar recibos: hace falta al menos un predio con pantallas, o una pantalla sin predio.',
      'Un recibo de luz cuelga de un predio con pantallas, o de una pantalla sin predio. Da de alta el inventario y esta pantalla se llena sola.',
    ],
    ingles: ['There is nowhere to enter bills yet: the reason is below.', 'Nowhere to enter bills yet',
      'There is nowhere to enter bills yet: you need at least one property with screens', 'An electricity bill belongs to a property with screens'],
    italiano: [
      'Non c’è ancora dove registrare bollette: il motivo è qui sotto.', 'Non c’è ancora dove registrare bollette',
      'Non c’è ancora dove registrare bollette: serve almeno un immobile con impianti, o un impianto senza immobile.',
      'Una bolletta della luce appartiene a un immobile con impianti, o a un impianto senza immobile. Registra l’inventario e questa pagina si riempie da sola.',
    ],
  },
  {
    nombre: 'energia · cargando',
    pintar: async (idioma) => {
      const Pagina = await energia()
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Cargando los puntos de medición…'],
    ingles: ['Loading the metering points…'],
    italiano: ['Caricamento dei punti di prelievo (POD)…'],
  },
  {
    nombre: 'energia · error de carga y de borrado',
    pintar: async (idioma) => {
      const Pagina = await energia()
      forzar(enesimo('EnergiaPage', esNull, 2), 'error-del-servidor') // errorCarga
      forzar(enesimo('EnergiaPage', esNull, 1), 'error-al-borrar') // errorBorrado
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['No se pudo cargar la captura', '>no se pudo cargar<', 'error-al-borrar'],
    ingles: ['Could not load the entries', '>could not be loaded<'],
    italiano: ['Impossibile caricare le registrazioni', '>impossibile caricare<'],
  },
  {
    nombre: 'energia · periodo invertido',
    pintar: async (idioma) => {
      const Pagina = await energia()
      forzar(enesimo('EnergiaPage', esIndefinido), { desde: '2026-05-01', hasta: '2026-01-31' })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Revisa el periodo', 'El mes de fin no puede ser anterior al de inicio'],
    ingles: ['Check the period', 'The end month cannot be before the start month'],
    italiano: ['Controlla il periodo', 'Il mese di fine non può essere precedente a quello di inizio'],
  },
  {
    nombre: 'energia · periodo sin inicio',
    pintar: async (idioma) => {
      const Pagina = await energia()
      forzar(enesimo('EnergiaPage', esIndefinido), { desde: '', hasta: '2026-01-31' })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Falta el mes de inicio'],
    ingles: ['The start month is missing'],
    italiano: ['Manca il mese di inizio'],
  },
  {
    nombre: 'energia · confirmar el borrado de un recibo',
    dinero: true,
    pintar: async (idioma) => {
      const { RejillaCaptura } = await import('../../components/demo/energia/RejillaCaptura')
      forzar(enesimo('RejillaCaptura', esNull), recibo('r1', '2026-01-01', 'M-1', 1200, 3400.5))
      return pintar(idioma, createElement(RejillaCaptura, { tablero: TABLERO as never, onBorrar: async () => {} }))
    },
    espanol: ['Borrar el recibo', 'Se borra el recibo del medidor M-1, de ene 2026, por $3,400.50. No se puede deshacer: ese mes vuelve a contar como un hueco, y hasta que lo captures otra vez el reporte de rentabilidad enseñará un costo de luz menor del real.'],
    ingles: ['Delete the bill', 'This deletes the bill for meter M-1, for Jan 2026, for MX$3,400.50. It cannot be undone'],
    italiano: ['Elimina la bolletta', 'Verrà eliminata la bolletta del contatore M-1, di gen 2026, per MX$ 3.400,50. Non si può annullare: quel mese torna a contare come un buco, e finché non la registri di nuovo il report di redditività mostrerà un costo della luce minore di quello reale.'],
  },
  {
    nombre: 'energia · recibos leidos con pegas',
    dinero: true,
    pintar: async (idioma) => {
      const SubirRecibos = await subir()
      const filas = await filasDe(RESPUESTA)
      forzar(enesimo('SubirRecibos', esNull), RESPUESTA)
      forzar(enesimo('SubirRecibos', (v) => Array.isArray(v)), filas)
      return pintar(idioma, createElement(SubirRecibos, { puntos: PUNTOS as never, onGuardado: () => {} }))
    },
    espanol: [
      'Se leyeron 2 de 3 archivos y salen 2 renglones. Revisa antes de confirmar: 1 archivo no es un recibo de CFE; 2 no coinciden con los 1 meses que declaraste: los 2 cubren 3 meses de calendario; 1 sin predio: eligelo tú; 1 con una cifra que no se pudo leer; 1 ya capturados: volver a guardarlos DUPLICA el costo.',
      '>Mes<', '>Días<', '— elige —', 'placeholder="escríbelo"',
      'servicio 123456789012 · medidor AB12 · PDBT · periodo 2025-11-10 → 2026-01-09 · el PDF dice 1,500 kWh · facturación $ 4,000.00 · alumbrado $ 200.00 · Total del recibo $ 9,000.00 (incluye adeudos y pagos)',
      'Declaraste 1 mes y este recibo cubre 3. Se repartió según el PDF.',
      'Ya hay uno capturado en 2026-01: 1,200 kWh por $ 3,400.50. Guardar otra vez DUPLICA el costo de ese mes.',
      'Elige a qué predio o pantalla corresponde este recibo',
    ],
    ingles: [
      'Files read: 2 of 3; rows: 2. Check before confirming: 1 file is not a CFE bill; 2 don’t match the number of months you declared (1): the number of calendar months covered by those 2 is 3; 1 with no property: choose it yourself; 1 with a figure that could not be read; 1 already entered: saving them again DOUBLES the cost.',
      '>Month<', '>Days<', '— choose —', 'placeholder="type it"',
      'service 123456789012 · meter AB12 · PDBT · period 2025-11-10 → 2026-01-09 · the PDF says 1,500 kWh · period charges MX$ 4,000.00 · street lighting MX$ 200.00 · Bill total MX$ 9,000.00 (includes past-due balances and payments)',
      'You declared 1 month and this bill covers 3. It was split according to the PDF.',
      'One is already entered for 2026-01: 1,200 kWh for MX$ 3,400.50. Saving again DOUBLES that month’s cost.',
      'Choose which property or screen this bill belongs to',
    ],
    italiano: [
      'File letti: 2 su 3; righe: 2. Controlla prima di confermare: 1 file non è una bolletta CFE; 2 non corrispondono al numero di mesi che hai dichiarato (1): i mesi di calendario coperti da quei 2 sono 3; 1 senza immobile: sceglilo tu; 1 con una cifra che non è stato possibile leggere; 1 con il mese già registrato: salvare di nuovo RADDOPPIA il costo.',
      '>Mese<', '>Giorni<', '— scegli —', 'placeholder="scrivilo"',
      'servizio 123456789012 · contatore AB12 · PDBT · periodo 2025-11-10 → 2026-01-09 · il PDF indica 1.500 kWh · fatturazione MX$ 4.000,00 · illuminazione pubblica MX$ 200,00 · Totale della bolletta MX$ 9.000,00 (include arretrati e pagamenti)',
      'Hai dichiarato 1 mese e questa bolletta ne copre 3. È stata ripartita secondo il PDF.',
      'Ce n’è già una registrata per 2026-01: 1.200 kWh per MX$ 3.400,50. Salvarla di nuovo RADDOPPIA il costo di quel mese.',
      'Scegli a quale immobile o impianto corrisponde questa bolletta',
    ],
  },
  {
    nombre: 'energia · recibos leidos sin pegas, uno guardado',
    pintar: async (idioma) => {
      const SubirRecibos = await subir()
      const filas = await filasDe(RESPUESTA_OK)
      forzar(enesimo('SubirRecibos', esNull), RESPUESTA_OK)
      forzar(enesimo('SubirRecibos', (v) => Array.isArray(v)), filas)
      forzar(enesimo('SubirRecibos', esObjeto), { [filas[0].clave]: 'ok' })
      return pintar(idioma, createElement(SubirRecibos, { puntos: PUNTOS as never, onGuardado: () => {} }))
    },
    espanol: ['Se leyeron los 1 archivo y salen 1 renglón. Míralos contra el recibo y confírmalos: nada se guarda hasta que le des a guardar.', ' Guardado</span>'],
    // Ola 5: con un renglon «Check them» no concordaba (validacion operaciones-2).
    ingles: ['1 file was read and it produces 1 row. Check each row against the bill and confirm it: nothing is saved until you click save.', ' Saved</span>'],
    italiano: ['È stato letto 1 file e contiene 1 riga. Controlla ogni riga con la bolletta e confermala: non si salva nulla finché non clicchi salva.', ' Salvato</span>'],
  },
  {
    nombre: 'energia · leyendo, sin renglones, un error y un renglon guardando',
    pintar: async (idioma) => {
      const SubirRecibos = await subir()
      const filas = await filasDe(RESPUESTA_OK)
      forzar(enesimo('SubirRecibos', (v) => v === 'quieto'), 'leyendo')
      forzar(enesimo('SubirRecibos', esNull), { ...RESPUESTA_OK, propuestas: [], leidos: 0, total: 0 })
      forzar(enesimo('SubirRecibos', (v) => Array.isArray(v)), filas)
      forzar(enesimo('SubirRecibos', esNull), 'error-del-servidor')
      forzar(enesimo('SubirRecibos', esObjeto), { [filas[0].clave]: 'guardando' })
      return pintar(idioma, createElement(SubirRecibos, { puntos: PUNTOS as never, onGuardado: () => {} }))
    },
    espanol: ['Leyendo…', 'No salió ningún renglón de estos archivos.', 'Guardando…', 'error-del-servidor'],
    ingles: ['Reading…', 'These files produced no rows.', 'Saving…'],
    italiano: ['Lettura…', 'Da questi file non è uscita nessuna riga.', 'Salvataggio…'],
  },
]

describe('ENERGIA · en ESPANOL sale el texto de siempre', () => {
  ESTADOS.forEach((p, i) => {
    it(p.nombre, async () => {
      const crudo = await p.pintar('es')
      const dir = process.env.I18N_VOLCAR
      if (dir) {
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, `energia-${String(i).padStart(2, '0')}-es.html`), crudo)
      }
      const html = texto(crudo)
      expect(p.espanol.filter((f) => !html.includes(f))).toEqual([])
    })
  })
})

// Iguales en ingles a proposito: lo que manda el servidor.
const COMUNES = new Set<string>(['error-al-borrar', 'error-del-servidor'])

describe('ENERGIA · en INGLES no queda ninguna frase espanola', () => {
  for (const p of ESTADOS) {
    it(p.nombre, async () => {
      const html = texto(await p.pintar('en'))
      expect(p.espanol.filter((f) => html.includes(f) && !COMUNES.has(f))).toEqual([])
      expect(p.ingles.filter((f) => !html.includes(f))).toEqual([])
    })
  }
})

describe('ENERGIA · el dinero lleva el simbolo de la instancia', () => {
  afterEach(() => fijarMonedaInstancia('MXN'))
  for (const moneda of MONEDAS) {
    for (const p of ESTADOS.filter((e) => e.dinero)) {
      for (const idioma of ['es', 'en'] as const) {
        it(`${p.nombre} · ${moneda} · ${idioma}`, async () => {
          fijarMonedaInstancia(moneda)
          const { importes, ajenos } = leerDinero(texto(await p.pintar(idioma)), idioma, moneda)
          expect(importes).toBeGreaterThan(0)
          expect(ajenos).toEqual([])
        })
      }
    }
  }
})

describe('ENERGIA · barrido con el diccionario entero', () => {
  it('ninguna frase espanola del diccionario de energia aparece en las pantallas en ingles', async () => {
    const { ES_ENERGIA, EN_ENERGIA } = await import('./textos/energia')
    let html = ''
    for (const p of ESTADOS) {
      forzado.cola = []
      const crudo = await p.pintar('en')
      const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
      html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
    }
    for (const a of ['Predio Reforma', 'Predio Sur', 'Pantalla Aeropuerto', 'error-al-borrar', 'error-del-servidor']) html = html.split(a).join('\n')
    const culpables: string[] = []
    for (const [clave, frase] of Object.entries(ES_ENERGIA)) {
      for (const trozo of frase.split(/\{\w+\}/)) {
        const t = trozo.trim()
        if (t.length < 6 || EN_ENERGIA[clave as keyof typeof EN_ENERGIA].includes(t)) continue
        if (html.includes(t)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })
})

// ─── ITALIANO · lote L1 (2026-11-03) ────────────────────────────────────────
// Las mismas pantallas, rendidas en `it`. Tres comprobaciones:
//   (a) sale el italiano esperado (`italiano`), y ninguna frase espanola;
//   (b) ninguna frase del diccionario de energia sale en ESPANOL ni cae al
//       INGLES (`DICCIONARIOS.it` cae al ingles mientras falte una clave: es
//       comodo y no da error, por eso se barre);
//   (c) ningun formato espanol ni ingles (fecha, cifra, dinero): la guardia de
//       la ola 0 (`guardias-italiano.ts`).
// Lo que no es de este ambito (`compartidos`, `comun.*`: el selector de
// periodo, «Desde/Hasta») es del lote L5 y aqui no se exige.
const COMUNES_IT = new Set<string>([
  ...COMUNES,
  'kWh del periodo', // se dice igual en italiano
  'del periodo',
  'feb 2026', // el mes corto se escribe igual en italiano
])

describe('ENERGIA · en ITALIANO sale el italiano y nada en espanol', () => {
  for (const p of ESTADOS) {
    it(p.nombre, async () => {
      const html = texto(await p.pintar('it'))
      expect(p.espanol.filter((f) => html.includes(f) && !COMUNES_IT.has(f))).toEqual([])
      expect(p.italiano.filter((f) => !html.includes(f))).toEqual([])
    })
  }
})

describe('ENERGIA · en ITALIANO ningun formato espanol ni ingles', () => {
  for (const p of ESTADOS) {
    it(p.nombre, async () => {
      expect(huellasEnItaliano(await p.pintar('it'))).toEqual([])
    })
  }
})

describe('ENERGIA · el dinero lleva el simbolo de la instancia, tambien en italiano', () => {
  afterEach(() => fijarMonedaInstancia('MXN'))
  for (const moneda of MONEDAS) {
    for (const p of ESTADOS.filter((e) => e.dinero)) {
      it(`${p.nombre} · ${moneda} · it`, async () => {
        fijarMonedaInstancia(moneda)
        const { importes, ajenos } = leerDinero(texto(await p.pintar('it')), 'it', moneda)
        expect(importes).toBeGreaterThan(0)
        expect(ajenos).toEqual([])
      })
    }
  }
})

describe('ENERGIA · barrido italiano con el diccionario entero', () => {
  it('ninguna frase del diccionario de energia sale en espanol ni en ingles en las pantallas italianas', async () => {
    const { ES_ENERGIA, EN_ENERGIA, IT_ENERGIA } = await import('./textos/energia')
    let html = ''
    for (const p of ESTADOS) {
      forzado.cola = []
      const crudo = await p.pintar('it')
      const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
      html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
    }
    for (const a of ['Predio Reforma', 'Predio Sur', 'Pantalla Aeropuerto', 'error-al-borrar', 'error-del-servidor']) html = html.split(a).join('\n')
    const it = IT_ENERGIA as Partial<Record<string, string>>
    const culpables: string[] = []
    for (const [clave, es] of Object.entries(ES_ENERGIA)) {
      const italiano = it[clave] ?? ''
      for (const [idioma, frase] of [['es', es], ['en', EN_ENERGIA[clave as keyof typeof EN_ENERGIA]]] as const) {
        for (const trozo of frase.split(/\{\w+\}/)) {
          const t = trozo.trim()
          if (t.length < 6 || italiano.includes(t)) continue
          if (html.includes(t)) culpables.push(`${idioma} · ${clave} · «${t}»`)
        }
      }
    }
    expect(culpables).toEqual([])
  })
})

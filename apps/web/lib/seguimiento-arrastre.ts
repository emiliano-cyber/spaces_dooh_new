import { ETAPAS_ABIERTAS, etapaOportunidadCerrada, problemaCambioEtapa, type EtapaOportunidad } from './crm'

// ============================================================================
//  lib/seguimiento-arrastre.ts — Lo que DECIDE el arrastre de Seguimiento.
// ----------------------------------------------------------------------------
//  18/11, pedido del dueño: «que se pueda mover y se vea la animación
//  arrastrando entre cada columna, y solo al terminar de moverlo abrir un
//  modal con los campos para llenar el cambio».
//
//  Aquí no hay DOM: qué se arrastra, qué columna acepta, qué pide cada etapa y
//  qué se le manda a `POST /api/oportunidades/[id]/etapa`. La pantalla
//  (`components/demo/crm/Seguimiento.tsx`) solo pinta y mueve. Así se prueba
//  sin navegador (`seguimiento-arrastre.test.ts`) y, sobre todo, se prueba lo
//  que NO debe pasar: cancelar o soltar donde no toca no llama a la API.
//
//  Las reglas son las del servidor (`problemaCambioEtapa`, `lib/crm.ts`), no
//  otras: mientras está abierta se va y se vuelve; cerrada no se mueve; perder
//  exige el motivo. La pantalla las adelanta para que la columna se vea «no
//  aceptable» durante el arrastre; el servidor las vuelve a aplicar con la fila
//  bloqueada, y si discrepa (otra persona la cerró mientras tanto) su 409 se
//  enseña tal cual.
// ============================================================================

export type Arrastrable =
  | { tipo: 'oportunidad'; id: string; etapa: EtapaOportunidad }
  // Un prospecto suelto vive en Contacto (todavía no es oportunidad).
  | { tipo: 'prospecto'; id: string }

/** Con ratón: lo que hay que mover para que deje de ser un clic. */
export const UMBRAL_ARRASTRE_PX = 6
/** Con dedo: lo que hay que mantener pulsado. Antes de eso, el dedo desplaza. */
export const PULSACION_LARGA_MS = 350
/** Con dedo: si se mueve más que esto antes de la pulsación larga, es scroll. */
export const TOLERANCIA_PULSACION_PX = 10

const origen = (a: Arrastrable): EtapaOportunidad => (a.tipo === 'oportunidad' ? a.etapa : 'CONTACTO')

/** Quién puede arrastrar: con `comercial.crear` y si no está cerrada. */
export function sePuedeArrastrar(a: Arrastrable, puedeCrear: boolean): boolean {
  if (!puedeCrear) return false
  return a.tipo === 'prospecto' || !etapaOportunidadCerrada(a.etapa)
}

export function esArrastre(dx: number, dy: number, umbral = UMBRAL_ARRASTRE_PX): boolean {
  return Math.hypot(dx, dy) >= umbral
}

/**
 * Si la columna `destino` puede recibir lo que se arrastra. La propia columna
 * no «acepta» (soltar ahí no hace nada). Un prospecto solo va a las ABIERTAS:
 * el alta nace en Contacto y luego se mueve, y ni ganar sin oportunidad ni
 * perder sin motivo tienen sentido desde el formulario de alta.
 */
export function aceptaColumna(a: Arrastrable, destino: EtapaOportunidad): boolean {
  if (destino === origen(a)) return false
  if (a.tipo === 'prospecto') return (ETAPAS_ABIERTAS as readonly string[]).includes(destino)
  // Motivo ficticio: aquí solo se pregunta por la etapa; el motivo lo pide el modal.
  return problemaCambioEtapa(a.etapa, destino, 'x') === null
}

export type ResultadoSoltar = 'nada' | 'rechazada' | 'cambio-etapa' | 'crear-oportunidad'

export function resultadoAlSoltar(a: Arrastrable, destino: EtapaOportunidad | null): ResultadoSoltar {
  if (destino == null || destino === origen(a)) return 'nada'
  if (!aceptaColumna(a, destino)) return 'rechazada'
  return a.tipo === 'oportunidad' ? 'cambio-etapa' : 'crear-oportunidad'
}

export interface CamposEtapa {
  /** El motivo de la pérdida, obligatorio (el servidor da 400 sin él). */
  motivo: boolean
  /** Ganar se confirma: después ya no se mueve. */
  confirmar: boolean
  /** Ganada o perdida: la oportunidad se cierra y ya no se mueve ni se edita. */
  cierra: boolean
}

/** La nota va siempre (opcional); lo demás según la etapa destino. */
export function camposDeEtapa(destino: EtapaOportunidad): CamposEtapa {
  return { motivo: destino === 'PERDIDA', confirmar: destino === 'GANADA', cierra: etapaOportunidadCerrada(destino) }
}

export interface ValoresCambio {
  nota: string
  motivo: string
  confirmado: boolean
}

export function faltaParaGuardar(destino: EtapaOportunidad, v: ValoresCambio): 'motivo' | 'confirmar' | null {
  const c = camposDeEtapa(destino)
  if (c.motivo && !v.motivo.trim()) return 'motivo'
  if (c.confirmar && !v.confirmado) return 'confirmar'
  return null
}

export interface CuerpoEtapa {
  etapa: EtapaOportunidad
  nota: string | null
  motivoPerdida: string | null
}

/** Lo que acepta el esquema `.strict()` de `cambiarEtapaCtrl`, y nada más. */
export function cuerpoCambioEtapa(destino: EtapaOportunidad, v: ValoresCambio): CuerpoEtapa {
  return {
    etapa: destino,
    nota: v.nota.trim() || null,
    motivoPerdida: destino === 'PERDIDA' ? v.motivo.trim() || null : null,
  }
}

type ApiEtapa<F> = (id: string, cuerpo: CuerpoEtapa) => Promise<F>

export type ResultadoGuardar<F> =
  | { ok: true; ficha: F }
  | { ok: false; falta: 'motivo' | 'confirmar' }
  | { ok: false; error: string; status?: number }

/**
 * «Guardar» del modal. Sin lo obligatorio NO llama a la API (el botón ya va
 * deshabilitado; esto es la segunda capa). El error del servidor vuelve con
 * su texto —ya traducido por el servidor— y su status.
 */
export async function guardarCambioEtapa<F>(
  id: string,
  destino: EtapaOportunidad,
  v: ValoresCambio,
  api: ApiEtapa<F>,
): Promise<ResultadoGuardar<F>> {
  const falta = faltaParaGuardar(destino, v)
  if (falta) return { ok: false, falta }
  try {
    return { ok: true, ficha: await api(id, cuerpoCambioEtapa(destino, v)) }
  } catch (e) {
    const status = (e as { status?: unknown })?.status
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      ...(typeof status === 'number' ? { status } : {}),
    }
  }
}

/**
 * Un prospecto soltado en otra columna: `POST /api/oportunidades` no acepta la
 * etapa (la oportunidad nace en Contacto, a propósito: «la etapa solo cambia
 * por su ruta»), así que justo después de crearla se mueve con `…/etapa`. Si
 * eso falla, la oportunidad YA existe en Contacto y se dice.
 */
export async function moverTrasCrear(
  id: string,
  destino: EtapaOportunidad,
  api: ApiEtapa<unknown>,
): Promise<{ ok: true; movida: boolean } | { ok: false; error: string }> {
  if (destino === 'CONTACTO') return { ok: true, movida: false }
  try {
    await api(id, { etapa: destino, nota: null, motivoPerdida: null })
    return { ok: true, movida: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Lo que se pinta mientras el modal está abierto: la tarjeta ya en la columna
 * destino, «pendiente». No toca la lista original, así que cancelar es pintar
 * sin pendiente y la tarjeta vuelve sola.
 */
export function aplicarPendiente<T extends { id: string; etapa: EtapaOportunidad }>(
  ops: T[],
  pendiente: { id: string; destino: EtapaOportunidad } | null,
): T[] {
  if (!pendiente) return ops
  return ops.map((o) => (o.id === pendiente.id ? { ...o, etapa: pendiente.destino } : o))
}

/**
 * Píxeles por cuadro para desplazar el tablero cuando el puntero llega a su
 * borde (en celular las columnas no caben y hay que poder llegar a la última).
 * Negativo = a la izquierda.
 */
export function velocidadAutoScroll(x: number, izq: number, der: number, margen = 48, maximo = 18): number {
  if (x < izq + margen) return -Math.ceil(maximo * Math.min(1, (izq + margen - x) / margen))
  if (x > der - margen) return Math.ceil(maximo * Math.min(1, (x - (der - margen)) / margen))
  return 0
}

// ============================================================================
//  lib/vallas/plano.ts — EL PLANO DE LAS VALLAS (pedido del dueño, 20/11).
// ----------------------------------------------------------------------------
//  «Tiene que estar un mapa del plano de las vallas.» Un dibujo POR SITIO con
//  sus cuadros numerados en su lugar, a escala de su medida, con los grupos
//  marcados y si están libres u ocupados en unas fechas. Puro: sin servidor ni
//  React (lo pinta `components/vallas/PlanoVallas.tsx`).
//
//  Forma: sitio → filas (una por CARA; las sin cara, al final) → bloques (un
//  tramo de un grupo, o una valla suelta) → cuadros.
//
//  EL ORDEN. `posicion` la escribe `fijarMiembros` (`vallas-repo.ts`) y es el
//  orden DENTRO del grupo (1, 2, 3…); una valla suelta la tiene siempre nula.
//  Ordenar la fila entera por `posicion` intercalaría dos grupos (A1, B1, A2,
//  B2) y mandaría las sueltas al final. Por eso: dentro del grupo manda la
//  posición (nulos al final, luego número), y el grupo entero va donde cae su
//  número más bajo entre las sueltas. Así los miembros quedan juntos y el
//  corchete del grupo abarca exactamente sus cuadros.
//
//  LAS ESQUINAS (dueño, 20/11: «hay vallas que están en esquinas y doblan a
//  la derecha o izquierda, para que se muestre»). Una valla con `dobla` parte
//  su cara en TRAMOS: lo que sigue después de ella va en un tramo nuevo,
//  marcado con la dirección del quiebre (`gira`). Se parte DESPUÉS de ordenar
//  la fila, así que el orden de siempre manda; un grupo que cruza la esquina
//  sale en los dos tramos (`cortadoAntes`/`cortadoDespues`) para que su
//  corchete lo siga abarcando entero. Si la que dobla es la última de la cara,
//  no hay tramo vacío: queda `esquinaFinal`. `bloques` sigue siendo la fila
//  entera, sin partir.
//
//  LA OCUPACIÓN. Las reservas hoy son POR SITIO: una reserva viva ocupa TODAS
//  las vallas del sitio (la misma aproximación que `contextoParaVerificar`).
//  Cuando la reserva sepa en qué cuadro cae, aquí se filtra por valla.
// ============================================================================

import type { Valla, GrupoVallas, ModoGrupo, Dobla } from './tipos'

/** Una reserva viva en un sitio en las fechas pedidas (`GET /api/vallas/ocupacion`). */
export type OcupacionSitio = {
  sitioId: string
  /** La marca de la campaña; si está vacía, la del cliente; puede faltar. */
  marca: string | null
  campanaId: string
  campanaNombre: string
  /** 'YYYY-MM-DD', inclusivas. */
  inicio: string
  fin: string
}

export type Ocupante = { campanaId: string; etiqueta: string }

export type CuadroPlano = {
  id: string
  numero: string
  ancho: number
  alto: number
  /** Ancho relativo a la fila más ancha del sitio (0..1), con un mínimo legible. */
  anchoRel: number
  /** Alto relativo a la valla más alta del sitio (0..1), con un mínimo legible. */
  altoRel: number
  estado: 'libre' | 'ocupada'
  ocupantes: Ocupante[]
  /** Después de este cuadro la pared dobla (esquina); null = sigue recta. */
  dobla: Dobla | null
}

export type GrupoPlano = {
  id: string
  numero: string
  nombre: string | null
  modo: ModoGrupo
  /** Tiene vallas en otro sitio: el corchete lo dice. */
  cruzaSitio: boolean
}

export type BloquePlano = {
  grupo: GrupoPlano | null
  cuadros: CuadroPlano[]
  /** Suma de anchos en metros. */
  ancho: number
  /** En un tramo: el bloque viene de ANTES de una esquina (es su continuación). */
  cortadoAntes: boolean
  /** En un tramo: el bloque sigue DESPUÉS de una esquina. */
  cortadoDespues: boolean
}

/** Un tramo recto de pared, entre esquinas. */
export type TramoPlano = {
  /** Hacia dónde dobló la pared ANTES de este tramo; null en el primero. */
  gira: Dobla | null
  /** Los bloques (o los pedazos de bloque, si un grupo cruza la esquina). */
  bloques: BloquePlano[]
  /** Metros del tramo. */
  ancho: number
}

export type FilaPlano = {
  cara: number | null
  /** La fila entera, sin partir en esquinas. */
  bloques: BloquePlano[]
  /** La misma fila partida en cada esquina; sin esquinas, un solo tramo. */
  tramos: TramoPlano[]
  /** La última valla de la fila dobla: la esquina queda al final, sin tramo. */
  esquinaFinal: Dobla | null
  /** Metros totales de la fila respecto de la más ancha del sitio (0..1). */
  anchoRel: number
}

export type SitioPlano = {
  sitioId: string
  /** null si el sitio no vino en la lista (p. ej. aún cargando). */
  nombre: string | null
  filas: FilaPlano[]
}

/** Un cuadro no se dibuja más angosto que esto (de la fila más ancha). */
export const ANCHO_MINIMO_REL = 0.08
/** Ni más bajo que esto (de la valla más alta), para que quepa el texto. */
export const ALTO_MINIMO_REL = 0.35

const comparaNumero = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
const redondea = (x: number) => Math.round(x * 10000) / 10000

export function armarPlano(entrada: {
  vallas: Valla[]
  grupos: GrupoVallas[]
  sitios: { id: string; nombre: string }[]
  ocupaciones: OcupacionSitio[]
  /**
   * Solo estos sitios («Dibujar plano» de una propuesta, 20/11 noche). Sin él,
   * todos (la pantalla de Vallas). Vacío → plano vacío.
   */
  sitioIds?: readonly string[]
}): SitioPlano[] {
  const activas = entrada.vallas.filter((v) => v.activo)
  const soloSitios = entrada.sitioIds ? new Set(entrada.sitioIds) : null
  const grupos = new Map(entrada.grupos.map((g) => [g.id, g]))
  const nombres = new Map(entrada.sitios.map((s) => [s.id, s.nombre]))

  // Sitios de cada grupo, para saber si cruza. Se cuenta con TODAS las
  // activas, no solo las de los sitios pedidos: un grupo que sigue en un sitio
  // que no es de la propuesta sigue cruzando, y el corchete lo tiene que decir.
  const sitiosDeGrupo = new Map<string, Set<string>>()
  for (const v of activas) {
    if (!v.grupoId || !grupos.has(v.grupoId)) continue
    if (!sitiosDeGrupo.has(v.grupoId)) sitiosDeGrupo.set(v.grupoId, new Set())
    sitiosDeGrupo.get(v.grupoId)!.add(v.sitioId)
  }

  // Ocupantes por sitio: uno por campaña, en el orden en que llegan.
  const ocupantes = new Map<string, Ocupante[]>()
  for (const o of entrada.ocupaciones) {
    const lista = ocupantes.get(o.sitioId) ?? []
    if (lista.some((x) => x.campanaId === o.campanaId)) continue
    lista.push({ campanaId: o.campanaId, etiqueta: o.marca?.trim() || o.campanaNombre })
    ocupantes.set(o.sitioId, lista)
  }

  const porSitio = new Map<string, Valla[]>()
  for (const v of activas) {
    if (soloSitios && !soloSitios.has(v.sitioId)) continue
    if (!porSitio.has(v.sitioId)) porSitio.set(v.sitioId, [])
    porSitio.get(v.sitioId)!.push(v)
  }

  const plano: SitioPlano[] = []
  for (const [sitioId, vs] of porSitio) {
    const ocup = ocupantes.get(sitioId) ?? []
    const caras = [...new Set(vs.map((v) => v.cara))].sort((a, b) => (a ?? Infinity) - (b ?? Infinity))
    const filasCrudas = caras.map((cara) => ({ cara, bloques: bloquesDeFila(vs.filter((v) => v.cara === cara), grupos, sitiosDeGrupo) }))

    const metrosFila = (f: { bloques: { ancho: number }[] }) => f.bloques.reduce((s, b) => s + b.ancho, 0)
    const masAncha = Math.max(...filasCrudas.map(metrosFila))
    const masAlta = Math.max(...vs.map((v) => v.alto))

    const filas: FilaPlano[] = filasCrudas.map((f) => {
      const bloques: BloquePlano[] = f.bloques.map((b) => ({
        grupo: b.grupo,
        ancho: b.ancho,
        cortadoAntes: false,
        cortadoDespues: false,
        cuadros: b.vallas.map((v) => ({
          id: v.id,
          numero: v.numero,
          ancho: v.ancho,
          alto: v.alto,
          anchoRel: Math.max(ANCHO_MINIMO_REL, redondea(v.ancho / masAncha)),
          altoRel: Math.max(ALTO_MINIMO_REL, redondea(v.alto / masAlta)),
          estado: ocup.length ? 'ocupada' : 'libre',
          ocupantes: ocup,
          dobla: v.dobla ?? null,
        })),
      }))
      return { cara: f.cara, anchoRel: redondea(metrosFila(f) / masAncha), bloques, ...partirEnEsquinas(bloques) }
    })
    plano.push({ sitioId, nombre: nombres.get(sitioId) ?? null, filas })
  }

  // Por nombre; los que no tienen nombre, al final.
  return plano.sort((a, b) =>
    a.nombre == null ? (b.nombre == null ? 0 : 1) : b.nombre == null ? -1 : a.nombre.localeCompare(b.nombre, 'es'),
  )
}

function bloquesDeFila(
  vallas: Valla[],
  grupos: Map<string, GrupoVallas>,
  sitiosDeGrupo: Map<string, Set<string>>,
): { grupo: GrupoPlano | null; vallas: Valla[]; ancho: number }[] {
  const sueltas: Valla[] = []
  const miembros = new Map<string, Valla[]>()
  for (const v of vallas) {
    if (v.grupoId && grupos.has(v.grupoId)) {
      if (!miembros.has(v.grupoId)) miembros.set(v.grupoId, [])
      miembros.get(v.grupoId)!.push(v)
    } else sueltas.push(v)
  }

  type Crudo = { clave: string; grupo: GrupoPlano | null; vallas: Valla[] }
  const crudos: Crudo[] = sueltas.map((v) => ({ clave: v.numero, grupo: null, vallas: [v] }))
  for (const [gid, ms] of miembros) {
    const g = grupos.get(gid)!
    const orden = [...ms].sort(
      (a, b) => (a.posicion ?? Infinity) - (b.posicion ?? Infinity) || comparaNumero(a.numero, b.numero),
    )
    crudos.push({
      clave: [...ms].map((v) => v.numero).sort(comparaNumero)[0],
      grupo: { id: g.id, numero: g.numero, nombre: g.nombre, modo: g.modo, cruzaSitio: (sitiosDeGrupo.get(gid)?.size ?? 1) > 1 },
      vallas: orden,
    })
  }
  return crudos
    .sort((a, b) => comparaNumero(a.clave, b.clave))
    .map((c) => ({ grupo: c.grupo, vallas: c.vallas, ancho: c.vallas.reduce((s, v) => s + v.ancho, 0) }))
}

/**
 * Parte una fila ya ordenada en tramos rectos: corta DESPUÉS de cada cuadro con
 * `dobla`, salvo el último de la fila (esa esquina queda en `esquinaFinal`).
 * Un bloque cortado aparece en los dos tramos con los cuadros de cada lado.
 */
export function partirEnEsquinas(bloques: BloquePlano[]): { tramos: TramoPlano[]; esquinaFinal: Dobla | null } {
  const total = bloques.reduce((s, b) => s + b.cuadros.length, 0)
  const tramos: TramoPlano[] = []
  let actual: TramoPlano = { gira: null, bloques: [], ancho: 0 }
  let vistos = 0
  let esquinaFinal: Dobla | null = null

  for (const b of bloques) {
    let pedazo: BloquePlano = { ...b, cuadros: [], ancho: 0, cortadoAntes: false, cortadoDespues: false }
    b.cuadros.forEach((c, i) => {
      pedazo.cuadros.push(c)
      pedazo.ancho += c.ancho
      actual.ancho += c.ancho
      vistos += 1
      if (!c.dobla) return
      if (vistos === total) {
        esquinaFinal = c.dobla
        return
      }
      const quedan = i < b.cuadros.length - 1
      pedazo.cortadoDespues = quedan
      actual.bloques.push(pedazo)
      tramos.push(actual)
      actual = { gira: c.dobla, bloques: [], ancho: 0 }
      pedazo = { ...b, cuadros: [], ancho: 0, cortadoAntes: quedan, cortadoDespues: false }
    })
    if (pedazo.cuadros.length) actual.bloques.push(pedazo)
  }
  if (actual.bloques.length) tramos.push(actual)
  return { tramos, esquinaFinal }
}

const dosDigitos = (n: number) => String(n).padStart(2, '0')
const isoLocal = (d: Date) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`

/** Las fechas por omisión del plano: hoy (del navegador) → 30 días después. */
export function rangoPorOmision(ahora: Date = new Date()): { desde: string; hasta: string } {
  const fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 30)
  return { desde: isoLocal(ahora), hasta: isoLocal(fin) }
}

// ============================================================================
//  lib/arrendadores-filtro.ts — Filtro compartido del módulo Arrendadores.
//
//  El módulo muestra TRES listas de la misma realidad: los arrendadores, sus
//  contratos y los pagos de renta de esos contratos. Buscar en una sola no
//  sirve de mucho: la pregunta real casi siempre es «enséñame todo lo de este
//  arrendador», y responderla obligaba a rastrear el nombre a ojo en tres
//  tablas distintas.
//
//  Por eso el filtro es UNO y las tres lo obedecen. Vive aquí, puro y sin React,
//  porque decidir qué entra y qué no en una lista de dinero merece pruebas
//  propias — y porque el mismo criterio tiene que aplicarse igual en las tres,
//  que es justo lo que se rompe cuando cada tabla filtra por su cuenta.
// ============================================================================

export interface FiltroArrendadores {
  // Texto libre: nombre del arrendador, de la pantalla, o RFC.
  texto: string
  // '' = todos.
  arrendadorId: string
  // '' = todos. Estatus del contrato (VIGENTE, INCOMPLETO, …).
  estatus: string
}

export const FILTRO_VACIO: FiltroArrendadores = { texto: '', arrendadorId: '', estatus: '' }

export function hayFiltro(f: FiltroArrendadores): boolean {
  return !!f.texto.trim() || !!f.arrendadorId || !!f.estatus
}

// Normaliza para comparar: minúsculas y sin acentos. Sin esto, buscar "mexico"
// no encuentra "México", que es exactamente lo que la gente teclea.
export function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // marcas diacriticas que deja NFD
    .toLowerCase()
    .trim()
}

// ¿Alguno de los campos contiene el texto buscado?
function coincide(texto: string, campos: unknown[]): boolean {
  const t = norm(texto)
  if (!t) return true
  return campos.some((c) => norm(c).includes(t))
}

export interface ArrendadorLike {
  id: string
  nombre: string
  rfc?: string | null
  email?: string | null
}

export interface ContratoLike {
  id: string
  arrendadorId?: string | null
  estatus: string
  sitioNombre?: string | null
  sitioId?: string
}

export interface PagoLike {
  contratoId: string
  sitioNombre?: string | null
  estatus: string
}

// ─── Arrendadores ───────────────────────────────────────────────────────────
// El selector de arrendador filtra la lista a ese mismo arrendador: si estás
// mirando a uno, la tarjeta de arriba no debería seguir mostrando los otros.
//
// `contratosVisibles` es lo que mantiene coherentes las tres listas. Buscar el
// nombre de una PANTALLA hacía desaparecer a todos los arrendadores —ninguno se
// llama así— mientras la tabla de contratos seguía mostrando los de su dueño:
// dos tarjetas contradiciéndose en la misma pantalla. Un arrendador entra si
// coincide él mismo O si alguno de sus contratos sobrevivió al filtro.
export function filtrarArrendadores<T extends ArrendadorLike>(
  arrendadores: T[],
  f: FiltroArrendadores,
  contratosVisibles?: ContratoLike[],
): T[] {
  const conContratoVisible = new Set(
    (contratosVisibles ?? []).map((c) => c.arrendadorId).filter(Boolean) as string[],
  )
  return arrendadores.filter((a) => {
    if (f.arrendadorId && a.id !== f.arrendadorId) return false
    return coincide(f.texto, [a.nombre, a.rfc, a.email]) || conContratoVisible.has(a.id)
  })
}

// ─── Contratos ──────────────────────────────────────────────────────────────
// El texto busca por arrendador Y por pantalla a propósito: un contrato se
// identifica por cualquiera de los dos según lo que uno tenga en la cabeza.
export function filtrarContratos<T extends ContratoLike>(
  contratos: T[],
  f: FiltroArrendadores,
  nombreArrendador: (id: string) => string,
): T[] {
  return contratos.filter((c) => {
    if (f.arrendadorId && c.arrendadorId !== f.arrendadorId) return false
    if (f.estatus && c.estatus !== f.estatus) return false
    const arr = c.arrendadorId ? nombreArrendador(c.arrendadorId) : ''
    return coincide(f.texto, [arr, c.sitioNombre])
  })
}

// ─── Pagos ──────────────────────────────────────────────────────────────────
// Un pago no conoce a su arrendador: cuelga del CONTRATO. Se filtra por los
// contratos que sobrevivieron al filtro, así los tres listados cuentan siempre
// la misma historia.
//
// El estatus del filtro es el del CONTRATO, no el del pago: filtrar pagos por
// «VIGENTE» no tendría sentido (un pago es PAGADO/PENDIENTE/VENCIDO). Al pasar
// por los contratos, la coherencia sale sola.
export function filtrarPagos<T extends PagoLike>(
  pagos: T[],
  contratosVisibles: ContratoLike[],
  f: FiltroArrendadores,
): T[] {
  if (!hayFiltro(f)) return pagos
  const ids = new Set(contratosVisibles.map((c) => c.id))
  return pagos.filter((p) => ids.has(p.contratoId))
}

// ─── Pantallas que cubren unos contratos ────────────────────────────────────
// La tarjeta de rentabilidad se lista por PANTALLA, no por contrato, así que
// para filtrarla hay que traducir «estos contratos» a «estas pantallas».
//
// Se usan los dos anclajes de siempre: un contrato de PREDIO cubre todas las
// caras de ese predio; uno suelto cubre solo su pantalla. Resolverlo únicamente
// por `sitioId` dejaría fuera a las hermanas de un predio —que sí están
// arrendadas por ese contrato— y la tarjeta mostraría menos de lo que el filtro
// dice incluir.
export function sitiosDeContratos(
  contratos: { sitioId?: string | null; predioId?: string | null }[],
  sitios: { id: string; predioId?: string | null }[],
): Set<string> {
  const predios = new Set<string>()
  const sueltos = new Set<string>()
  for (const c of contratos) {
    if (c.predioId) predios.add(c.predioId)
    else if (c.sitioId) sueltos.add(c.sitioId)
  }
  const out = new Set<string>(sueltos)
  for (const s of sitios) if (s.predioId && predios.has(s.predioId)) out.add(s.id)
  return out
}

// ============================================================================
//  Qué contrato enseña la ficha lateral de /arrendadores.
// ----------------------------------------------------------------------------
//  La página guardaba en su estado el OBJETO del contrato al hacer clic en la
//  fila. Guardar desde la ficha (por ejemplo, «La paga» → «Cambiar») refresca
//  el estado global, pero la ficha seguía pintando aquella copia: decía «Sin
//  asignar» justo después de «Razón social asignada al contrato», hasta que se
//  cerraba y se volvía a abrir. Se vio recorriendo el manual el 2026-09-24.
//
//  Por eso la página guarda solo el ID, y la ficha se resuelve aquí contra la
//  lista VIGENTE en cada render. Si el contrato ya no está (se borró, o cambió
//  de organización), no hay ficha: mejor cerrarla que enseñar uno fantasma.
// ============================================================================

export function contratoSeleccionado<T extends { id: string }>(
  contratos: readonly T[] | null | undefined,
  id: string | null,
): T | null {
  if (!id || !contratos) return null
  return contratos.find((c) => c.id === id) ?? null
}

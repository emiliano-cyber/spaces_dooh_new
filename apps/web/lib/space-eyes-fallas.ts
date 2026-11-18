// ============================================================================
//  lib/space-eyes-fallas.ts — Cómo se dice una falla, en un solo sitio.
// ----------------------------------------------------------------------------
//  Dónde falló la pantalla, dicho como lo diría una persona. Lo usan la
//  pantalla de Fallas y el aviso de la ficha del equipo, y por eso vive aquí:
//  cuando el mismo texto se escribe dos veces, los dos sitios acaban diciendo
//  cosas distintas de la MISMA falla, y quien las compare va a pensar que son
//  dos problemas.
//
//  Queda una tercera copia en `lib/server/space-eye.ts` (`dondeDeFalla`), la
//  que arma el texto para la lista de equipos antes de mandarla al navegador.
//  NO se unificó con esta a propósito y no es un olvido: aquélla recorta la
//  lista de gabinetes a doce y no tiene los casos de `camara_movida` ni
//  `sin_imagen`, así que juntarlas cambiaría el texto de dos pantallas que
//  nadie pidió cambiar —y el volcado de `pantallas-spaceeyes.test.ts` lo
//  cazaría, que es justo la prueba de que se vería—. Si algún día se unifican,
//  se unifican a propósito y con ese volcado delante.
// ============================================================================

export type FallaUbicable = {
  tipo: string
  fila: number | null
  columna: number | null
  gabinete: number | null
  detalle: { gabinetes?: number[]; total?: number } | null
}

/** Dónde falló, como lo diría una persona. Igual que Pantalla.donde de Space Eye. */
export function dondeFallo(f: FallaUbicable): string {
  if (f.gabinete) return `Gabinete ${f.gabinete} (fila ${(f.fila ?? 0) + 1}, columna ${(f.columna ?? 0) + 1})`
  const g = f.detalle?.gabinetes
  if (g && g.length) return `Gabinetes ${g.join(', ')}` + (f.detalle?.total ? ` (${g.length} de ${f.detalle.total})` : '')
  if (f.tipo === 'camara_movida') return 'Cámara (hay que volver a marcar la pantalla)'
  if (f.tipo === 'sin_imagen') return 'Lente tapada, o pantalla apagada de noche'
  // La abre el SERVIDOR al ver que la pantalla sigue siendo la de antes con
  // algo encima, asi que no tiene fila ni columna: sin este caso diria
  // «Toda la pantalla», que es justo lo que NO es.
  if (f.tipo === 'obstruccion_vehiculo') return 'Algo delante de la pantalla, no en ella'
  return 'Toda la pantalla'
}

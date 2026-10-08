'use client'

import { AjustarTexto } from '@/components/demo/space-eyes/AjustarTexto'

// Pantalla «Ajustar texto»: cómo se ve la marca (nombre · fecha · hora) que
// Space Eye graba en las fotos de cada equipo. Mirar pide `inventario.ver` y
// guardar `inventario.crear`; lo exige el BFF, no esta página.
export default function AjustarTextoPage() {
  return <AjustarTexto />
}

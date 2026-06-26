'use client'

import { OTVista } from '@/components/operaciones/OTVista'

// Vista de OT dentro del shell (escritorio): conserva el menú izquierdo y queda
// bajo /demo/operaciones, así el sidebar marca "Operaciones" como sección activa.
export default function OTEnShellPage({ params }: { params: { id: string } }) {
  return <OTVista id={params.id} embedded />
}

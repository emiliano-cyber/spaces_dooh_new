'use client'

import { OTVista } from '@/components/operaciones/OTVista'

// Vista móvil standalone (cuadrilla en campo): sin chrome del shell.
export default function OTMovilPage({ params }: { params: { id: string } }) {
  return <OTVista id={params.id} />
}

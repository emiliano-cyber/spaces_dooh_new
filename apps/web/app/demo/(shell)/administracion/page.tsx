'use client'

import { Settings } from 'lucide-react'
import { ModuloPlaceholder } from '@/components/demo/shell/ModuloPlaceholder'

export default function AdministracionPage() {
  return (
    <ModuloPlaceholder
      titulo="Administración"
      subtitulo="Usuarios y roles"
      icon={Settings}
      fase="Fase E"
    />
  )
}

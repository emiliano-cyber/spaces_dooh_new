export interface ChecklistItem {
  id: string
  texto: string
  completado: boolean
  completadoEn?: string | null
  completadoPorUserId?: string | null
  notaRealizado?: string | null
  notaPendiente?: string | null
}

export interface CreateOTData {
  tipo: string
  sitioId?: string
  descripcion: string
  instrucciones?: string
  checklist?: Array<{ texto: string }>
  prioridad?: string
  asignadoAUserId?: string
  supervisorUserId?: string
  fechaProgramada?: string
  campanaId?: string
  requiereRevision?: boolean
}

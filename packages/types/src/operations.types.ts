export interface ChecklistItem {
  id: string
  texto: string
  completado: boolean
  completadoEn?: string
}

export interface CreateOTData {
  tipo: string
  sitioId?: string
  descripcion: string
  instrucciones?: string
  checklist?: Array<{ texto: string }>
  prioridad?: string
  asignadoAUserId?: string
  fechaProgramada?: string
  campanaId?: string
}

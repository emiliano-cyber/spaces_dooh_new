export type TipoMedio =
  | 'ESPECTACULAR'
  | 'MURAL'
  | 'PUENTE'
  | 'TOTEM'
  | 'PANTALLA_DIGITAL'
  | 'PANTALLA_LED'
  | 'INTERIOR'
  | 'OTRO'

export type EstatusComercial = 'DISPONIBLE' | 'OCUPADO' | 'RESERVADO' | 'NO_DISPONIBLE'
export type EstatusOperativo = 'ACTIVO' | 'INACTIVO' | 'EN_MANTENIMIENTO'
export type EstatusLegal = 'EN_ORDEN' | 'IRREGULAR' | 'EN_TRAMITE'

export interface Sitio {
  id: string
  claveInterna: string
  nombre: string
  tipoMedio: TipoMedio
  lat: number
  lng: number
  direccion: string
  ciudad: string
  estado: string
  referencias?: string
  iluminado: boolean
  nivelTrafico?: string
  impactosSemana?: number
  estatusComercial: EstatusComercial
  estatusOperativo: EstatusOperativo
  estatusLegal: EstatusLegal
  fotos: string[]
  creadoEn: string
  actualizadoEn: string
}

export interface SitioGeoJSONFeature {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: {
    id: string
    nombre: string
    claveInterna: string
    tipoMedio: TipoMedio
    ciudad: string
    estatusComercial: EstatusComercial
    disponible: boolean
    tieneIncidencia: boolean
    lat: number
    lng: number
  }
}

export interface CreateSitioInput {
  claveInterna: string
  nombre: string
  tipoMedio: TipoMedio
  lat: number
  lng: number
  direccion: string
  ciudad: string
  estado: string
  referencias?: string
  iluminado?: boolean
  nivelTrafico?: string
  impactosSemana?: number
  estatusComercial?: EstatusComercial
  estatusOperativo?: EstatusOperativo
}

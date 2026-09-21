import type { EstadoActualizacion } from '@/lib/data/actualizaciones-api'

export type TonoEstado = 'ok' | 'alerta' | 'info'

export function textoDeEstado(_e: EstadoActualizacion): { tono: TonoEstado; texto: string } {
  throw new Error('sin implementar')
}

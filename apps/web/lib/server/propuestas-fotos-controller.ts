import 'server-only'
import { AppError } from './errores'
import { leerFotosDeSitiosDePropuesta } from './propuestas-fotos-repo'
import { fotosMostrables } from '@/lib/fotos-sitio'

// ============================================================================
//  lib/server/propuestas-fotos-controller.ts — CONTROLLER de «Fotos de las
//  pantallas» en la ficha interna de la propuesta (dueño, 20/11). El permiso
//  (`comercial.ver`) y la regla del vendedor (ADR 0051) los revisa la ruta;
//  aquí se arma la respuesta con LISTA BLANCA y se filtra cada foto con
//  `fotosMostrables`, el mismo filtro que la liga del cliente: lo que llega a
//  un `src` es una imagen y nada más, con el mismo tope por pantalla.
// ============================================================================

export interface FotosDeSitio {
  sitioId: string
  nombre: string
  fotos: string[]
}

export async function fotosDePropuestaCtrl(propuestaId: string): Promise<{ sitios: FotosDeSitio[] }> {
  const filas = await leerFotosDeSitiosDePropuesta(propuestaId)
  if (!filas) throw new AppError('Propuesta no encontrada', 404)
  return {
    sitios: filas.map((f) => ({ sitioId: f.sitioId, nombre: f.nombre, fotos: fotosMostrables(f.fotos) })),
  }
}

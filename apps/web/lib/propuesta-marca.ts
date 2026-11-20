import { z } from 'zod'

// ============================================================================
//  lib/propuesta-marca.ts — LA FORMA DE LA MARCA DE UNA PROPUESTA (PROP-MARCA,
//  20/11). Recortada, hasta 120 caracteres (lo mismo que acepta «Verificar una
//  marca» en Vallas) y vacía → null, que es «cuenta el cliente».
//
//  Vive aparte y sin dependencias de servidor porque la usan el alta
//  (`propuestas-controller.ts`) y la edición (`app/api/propuestas/[id]/route.ts`),
//  y esa ruta no debe arrastrar los repos de tarifas solo por un campo de texto.
//
//  OJO: `nullish().transform` convierte también «ausente» en null. En una
//  EDICIÓN eso borraría la marca al tocar otro campo; quien edita tiene que
//  mirar antes si la marca vino en el cuerpo.
// ============================================================================

export const MARCA_MAX = 120

export const marcaPropuesta = z
  .string()
  .trim()
  .max(MARCA_MAX, 'La marca no puede pasar de 120 caracteres')
  .nullish()
  .transform((m) => m || null)

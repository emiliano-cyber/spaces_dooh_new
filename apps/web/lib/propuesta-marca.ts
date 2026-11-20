import { z } from 'zod'
import { normalizarMarca } from './vallas/reglas/competencia-marcas'

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

// ============================================================================
//  ¿LA MARCA «SE PARECE» AL CLIENTE? (decisión del dueño, 20/11)
//
//  Si la propuesta lleva una marca escrita y no se parece al nombre del
//  cliente, la pantalla avisa —informativo, no bloquea—: puede ser legítimo
//  (una agencia que compra para Pepsi) o un error de captura que acabaría en
//  `campanas.marca` y en la competencia de Vallas.
//
//  La normalización es LA de la competencia (`normalizarMarca`: sin acentos,
//  minúsculas, sin signos ni espacios), importada y no copiada, para que
//  «coincide» signifique aquí lo mismo que en la regla. Coinciden si una
//  normalizada CONTIENE a la otra: «Coca-Cola» / «Coca Cola FEMSA» sí;
//  «Pepsi» / «Publicis México» no. Sin marca, sin cliente, o con una marca que
//  normalizada queda vacía («***»), no hay nada que comparar: no se avisa.
// ============================================================================

export function marcaCoincideConCliente(marca: string, cliente: string): boolean {
  const a = normalizarMarca(marca)
  const b = normalizarMarca(cliente)
  return a.includes(b) || b.includes(a)
}

/** ¿Se avisa? Solo con marca Y cliente, comparables, que no coinciden. */
export function marcaNoCoincideConCliente(marca?: string | null, cliente?: string | null): boolean {
  if (!marca?.trim() || !cliente?.trim()) return false
  if (!normalizarMarca(marca) || !normalizarMarca(cliente)) return false
  return !marcaCoincideConCliente(marca, cliente)
}

/**
 * Lo que la ficha manda al guardar la marca: `null` si no cambió nada (solo
 * espacios alrededor), `{ marca: null }` si se vació —vuelve a contar el
 * cliente— y si no, la escrita recortada. Solo `marca`: el PATCH no toca lo
 * que no viene.
 */
export function cambioDeMarca(escrita: string, guardada: string | null | undefined): { marca: string | null } | null {
  const nueva = escrita.trim() || null
  const actual = guardada?.trim() || null
  return nueva === actual ? null : { marca: nueva }
}

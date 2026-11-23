// ============================================================================
//  lib/origen-creativo.ts — Quién subió cada creativo (CREA-ORIGEN, 20/11).
// ----------------------------------------------------------------------------
//  Decisión del dueño (20/11): «Debemos poner quién subió cada creativo aunque
//  tengan el mismo nombre; lo que importa es el contenido».
//
//  Hasta ese día el origen se DEDUCÍA de la bitácora (la acción «Aprobó
//  creativo enviado por el cliente» con el mismo NOMBRE en los 10 minutos tras
//  el alta) y dos creativos llamados igual se confundían. Ahora es un dato de
//  `creatividades` (`20261120_z_creatividades_origen.sql`) que fija el SERVIDOR
//  al crear: nunca llega del cuerpo de la petición.
//
//  Puro: lo usan el servidor (qué se guarda) y las pantallas (qué se lee).
// ============================================================================

export type OrigenCreativo = 'CLIENTE' | 'INTERNO'

/** Lo que se guarda en las tres columnas al crear (o reemplazar) un creativo. */
export interface DatosOrigen {
  origen: OrigenCreativo
  /** Usuario interno de la SESIÓN; null en lo del cliente. */
  subidoPor: string | null
  /** Nombre CONGELADO: sobrevive a que la persona cambie de nombre o se borre. */
  subidoPorNombre: string | null
}

const limpio = (s: string | null | undefined): string | null => {
  const t = (s ?? '').trim()
  return t ? t : null
}

/** Lo subió alguien de la organización: el usuario de la sesión. */
export function origenInterno(usuario: { id: string; nombre?: string | null } | null | undefined): DatosOrigen {
  return { origen: 'INTERNO', subidoPor: usuario?.id ?? null, subidoPorNombre: limpio(usuario?.nombre) }
}

/**
 * Lo mandó el cliente por la liga y alguien lo aprobó. Quien APRUEBA no es
 * quien lo subió, así que no hay usuario interno. `nombre` es el que diera el
 * cliente en la liga: hoy la liga no lo pide, así que llega vacío.
 */
export function origenCliente(nombre?: string | null): DatosOrigen {
  return { origen: 'CLIENTE', subidoPor: null, subidoPorNombre: limpio(nombre) }
}

export type ClaveSubidoPor =
  | 'operaciones2.creativos.origen.cliente-nombre'
  | 'operaciones2.creativos.origen.cliente'
  | 'operaciones2.creativos.origen.interno-nombre'
  | 'operaciones2.creativos.origen.interno'
  | 'operaciones2.creativos.origen.desconocido'

/**
 * El texto «Subido por: …» como clave de traducción y sus variables. Sin
 * origen (lo creado antes del 20/11) es «Origen desconocido» AUNQUE traiga un
 * nombre: sin saber si fue el cliente o el equipo, no se adivina.
 */
export function subidoPor(o: {
  origen?: OrigenCreativo | null
  subidoPorNombre?: string | null
}): { clave: ClaveSubidoPor; vars: { nombre?: string } } {
  const nombre = limpio(o.subidoPorNombre)
  if (o.origen === 'CLIENTE') {
    return nombre ? { clave: 'operaciones2.creativos.origen.cliente-nombre', vars: { nombre } } : { clave: 'operaciones2.creativos.origen.cliente', vars: {} }
  }
  if (o.origen === 'INTERNO') {
    return nombre ? { clave: 'operaciones2.creativos.origen.interno-nombre', vars: { nombre } } : { clave: 'operaciones2.creativos.origen.interno', vars: {} }
  }
  return { clave: 'operaciones2.creativos.origen.desconocido', vars: {} }
}

// ============================================================================
//  lib/propuestas-por-dia.ts — Las campañas de cada vendedor, DÍA POR DÍA
//  (CONTEO-DIA, 17/11). PURO: lo usan la ruta, el bloque del Dashboard y las
//  pruebas, para que cuenten igual.
// ----------------------------------------------------------------------------
//  Pedido del dueño: «el conteo de campañas por día, para cada vendedor y
//  usuario grande», y «las que se crearon y las que se aprueban».
//
//  Se cuenta sobre PROPUESTAS y no sobre `campanas` por una razón del modelo:
//  una campaña nace ya CONFIRMADA en el momento en que se aprueba su propuesta
//  (`campanas-repo.ts`, `generarCampanaDesdePropuesta`). Lo que el vendedor
//  «crea» antes de eso es la propuesta de la campaña. Y el vendedor vive en la
//  propuesta (`propuestas.usuario_id`, VEND-01), no en la campaña.
//
//  · CREADAS: por `creado_en`, acaben como acaben.
//  · APROBADAS: por `aprobada_en`, y solo si SIGUEN aprobadas. Es la regla de
//    `propuestas-periodo.ts` (PROP-PER): una que se aprobó y luego se rechazó
//    es una rechazada, no las dos cosas.
//
//  Las fechas llegan YA en el día del negocio (AAAA-MM-DD): convertir la hora
//  es trabajo de la consulta, que conoce la zona. Aquí solo se compara texto.
// ============================================================================

export interface FilaConteo {
  /** AAAA-MM-DD, en la zona del negocio. */
  creada: string
  /** AAAA-MM-DD, en la zona del negocio. null = nunca se aprobó. */
  aprobada: string | null
  estatus: 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA'
  /** null = propuesta histórica sin vendedor. `baja:<nombre>` = se borró (P19). */
  vendedorId: string | null
  vendedor: string | null
}

export interface SerieConteo {
  creadas: number[]
  aprobadas: number[]
  totalCreadas: number
  totalAprobadas: number
}

export interface ConteoVendedor extends SerieConteo {
  /** null = «sin vendedor»: el nombre lo pone la pantalla, en su idioma. */
  id: string | null
  nombre: string | null
}

export interface ConteoDiario {
  dias: string[]
  porVendedor: ConteoVendedor[]
  total: SerieConteo
}

// Aritmética de calendario en UTC a propósito: aquí un día es una ETIQUETA,
// no un instante. Con la hora local de la máquina, el cambio de horario haría
// que un día durara 23 h y `diasEntre` repitiera o saltara uno.
const aFecha = (d: string) => new Date(`${d}T00:00:00Z`)
const aTexto = (d: Date) => d.toISOString().slice(0, 10)
const DIA_MS = 86_400_000

/** Los días de `desde` a `hasta`, los dos incluidos. */
export function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  for (let t = aFecha(desde).getTime(), fin = aFecha(hasta).getTime(); t <= fin; t += DIA_MS) {
    out.push(aTexto(new Date(t)))
  }
  return out
}

/** Los últimos `n` días que terminan en `hoy`. */
export function ventanaDeDias(hoy: string, n: number): { desde: string; hasta: string } {
  return { desde: aTexto(new Date(aFecha(hoy).getTime() - (n - 1) * DIA_MS)), hasta: hoy }
}

const serieVacia = (n: number): SerieConteo => ({
  creadas: new Array<number>(n).fill(0),
  aprobadas: new Array<number>(n).fill(0),
  totalCreadas: 0,
  totalAprobadas: 0,
})

export function conteoPorDia(filas: readonly FilaConteo[], desde: string, hasta: string): ConteoDiario {
  const dias = diasEntre(desde, hasta)
  const indice = new Map(dias.map((d, i) => [d, i]))
  const total = serieVacia(dias.length)
  // La clave '' es «sin vendedor»: ningún id real es la cadena vacía.
  const porId = new Map<string, ConteoVendedor>()

  const de = (f: FilaConteo): ConteoVendedor => {
    const clave = f.vendedorId ?? ''
    let v = porId.get(clave)
    if (!v) {
      v = { id: f.vendedorId, nombre: f.vendedorId ? f.vendedor : null, ...serieVacia(dias.length) }
      porId.set(clave, v)
    }
    return v
  }

  for (const f of filas) {
    const iC = indice.get(f.creada)
    if (iC !== undefined) {
      const v = de(f)
      v.creadas[iC]!++
      v.totalCreadas++
      total.creadas[iC]!++
      total.totalCreadas++
    }
    const iA = f.estatus === 'APROBADA' && f.aprobada ? indice.get(f.aprobada) : undefined
    if (iA !== undefined) {
      const v = de(f)
      v.aprobadas[iA]!++
      v.totalAprobadas++
      total.aprobadas[iA]!++
      total.totalAprobadas++
    }
  }

  // Primero quien más campañas cerró, luego quien más armó; «sin vendedor»
  // siempre al final, porque no es una persona con la que comparar a nadie.
  const porVendedor = [...porId.values()].sort(
    (a, b) =>
      Number(a.id === null) - Number(b.id === null) ||
      b.totalAprobadas - a.totalAprobadas ||
      b.totalCreadas - a.totalCreadas ||
      (a.nombre ?? '').localeCompare(b.nombre ?? ''),
  )

  return { dias, porVendedor, total }
}

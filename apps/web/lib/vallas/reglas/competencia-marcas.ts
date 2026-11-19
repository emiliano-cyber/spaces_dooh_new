import type { Regla, Hallazgo, ContextoVallas } from './tipos'
import type { ConfigCompetencia } from './configuracion'
import type { Valla } from '../tipos'

// ============================================================================
//  REGLA · EXCLUSIÓN DE COMPETENCIA DE MARCAS (19/11).
// ----------------------------------------------------------------------------
//  «No poner en las mismas vallas marcas que compiten» (Coca-Cola vs Pepsi,
//  Palacio de Hierro vs Liverpool). Dos marcas compiten si comparten una
//  categoría ACTIVA de `competencia_categorias`. Chocan si están en la zona de
//  la valla (según `alcance`) con fechas que se solapan (inclusivas).
//
//  La marca se compara normalizada (sin mayúsculas, acentos, espacios ni
//  signos): «Coca-Cola» = «coca cola». La misma marca nunca compite consigo
//  misma, y una marca fuera del catálogo no compite con nadie.
// ============================================================================

export function normalizarMarca(m: string): string {
  return m
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function seSolapan(a: { inicio: string; fin: string }, b: { inicio: string; fin: string }): boolean {
  return a.inicio <= b.fin && b.inicio <= a.fin
}

/** Las vallas cuyas ocupaciones cuentan para `v`, según el alcance. */
function zonaDe(v: Valla, ctx: ContextoVallas, cfg: ConfigCompetencia): Map<string, string | null> {
  // vallaId → grupoId por el que entró (null si es la misma o por sitio)
  const zona = new Map<string, string | null>([[v.id, null]])
  if (cfg.alcance === 'valla') return zona
  if (cfg.alcance === 'sitio') {
    for (const o of ctx.vallas) if (o.sitioId === v.sitioId && !zona.has(o.id)) zona.set(o.id, null)
    return zona
  }
  const g = v.grupoId ? ctx.grupos.find((x) => x.id === v.grupoId && x.activo) : undefined
  if (!g) return zona
  if (cfg.alcance === 'grupo_imagen' && g.modo !== 'una_imagen') return zona
  for (const o of ctx.vallas) if (o.grupoId === g.id && !zona.has(o.id)) zona.set(o.id, g.id)
  return zona
}

export function crearReglaCompetencia(cfg: ConfigCompetencia): Regla {
  return {
    id: 'competencia-marcas',
    descripcion: 'Marcas de la misma categoría no comparten valla (ni grupo) en las mismas fechas',
    evaluar(ctx) {
      const c = ctx.candidata
      const propia = normalizarMarca(c.marca)
      if (!propia) return []
      const categorias = ctx.categorias.filter((k) => k.activo && k.marcas.some((m) => normalizarMarca(m) === propia))
      if (!categorias.length) return []

      const hallazgos: Hallazgo[] = []
      const vistos = new Set<string>()
      for (const vallaId of c.vallaIds) {
        const v = ctx.vallas.find((x) => x.id === vallaId)
        if (!v) continue
        const zona = zonaDe(v, ctx, cfg)
        for (const o of ctx.ocupaciones) {
          if (!zona.has(o.vallaId)) continue
          if (c.excluirCampanaId && o.campanaId === c.excluirCampanaId) continue
          if (!seSolapan(c, o)) continue
          const otra = normalizarMarca(o.marca)
          if (!otra || otra === propia) continue
          const cat = categorias.find((k) => k.marcas.some((m) => normalizarMarca(m) === otra))
          if (!cat) continue
          const clave = `${v.id}|${o.vallaId}|${o.campanaId}|${otra}`
          if (vistos.has(clave)) continue
          vistos.add(clave)
          const ocupada = ctx.vallas.find((x) => x.id === o.vallaId)
          const donde = o.vallaId === v.id ? `la valla ${v.numero}` : `la valla ${ocupada?.numero ?? o.vallaId}, junto a la ${v.numero}`
          hallazgos.push({
            regla: 'competencia-marcas',
            nivel: cfg.nivel,
            mensaje: `${c.marca} compite con ${o.marca} (${cat.nombre}), que ya está en ${donde} del ${o.inicio} al ${o.fin}`,
            datos: {
              vallaId: v.id,
              vallaOcupada: o.vallaId,
              grupoId: zona.get(o.vallaId) ?? null,
              marca: c.marca,
              marcaExistente: o.marca,
              categoria: cat.nombre,
              campanaId: o.campanaId,
              campanaNombre: o.campanaNombre,
              inicio: o.inicio,
              fin: o.fin,
            },
          })
        }
      }
      return hallazgos
    },
  }
}

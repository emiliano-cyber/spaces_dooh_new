import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { AREAS, MODULOS, areasDeModulo } from './modulos'
import { CAPACIDADES } from '@/components/demo/admin/permisos'

// ============================================================================
//  ADR 0010 · Coherencia entre lo que la API EXIGE y lo que el producto declara.
// ----------------------------------------------------------------------------
//  El rol CLIENTE vivió meses en el enum de `usuarios-controller` sin una sola
//  fila en `rol_permisos`. Como `tienePermiso` es fail-closed, un usuario así
//  entraba y recibía 403 en todo — se podía crear, no servía para nada, y nada
//  avisaba hasta que lo encontró una auditoría.
//
//  Esta prueba es el guard que faltaba: lee los `exigir(...)` REALES del código
//  de rutas y comprueba que cada módulo que la API exige está declarado. No
//  toca la base de datos, así que corre en CI sin Postgres; lo que valida es la
//  mitad que vive en el repo. La otra mitad (que `rol_permisos` tenga filas para
//  esos módulos) la verifica la migración con su bloque de comprobación.
// ============================================================================

const RAIZ_API = join(__dirname, '..', 'app', 'api')

function rutasTs(dir: string): string[] {
  const salida: string[] = []
  for (const entrada of readdirSync(dir)) {
    const p = join(dir, entrada)
    if (statSync(p).isDirectory()) salida.push(...rutasTs(p))
    else if (entrada.endsWith('.ts')) salida.push(p)
  }
  return salida
}

// Pares (modulo, accion) que el código de rutas exige de verdad.
function paresExigidos(): { modulo: string; accion: string; archivo: string }[] {
  const re = /exigir(?:CambioSensible)?\(\s*'([a-z_]+)'\s*,\s*'([a-z_]+)'\s*\)/g
  const out: { modulo: string; accion: string; archivo: string }[] = []
  for (const archivo of rutasTs(RAIZ_API)) {
    const src = readFileSync(archivo, 'utf8')
    for (const m of src.matchAll(re)) {
      out.push({ modulo: m[1], accion: m[2], archivo: archivo.replace(RAIZ_API, 'app/api') })
    }
  }
  return out
}

describe('coherencia RBAC', () => {
  it('encuentra los guards de las rutas (si esto falla, el regex dejó de casar)', () => {
    // Sin esta comprobación, un cambio de formato en las llamadas volvería la
    // prueba de abajo trivialmente verde sobre una lista vacía.
    expect(paresExigidos().length).toBeGreaterThan(40)
  })

  it('todo módulo que la API exige está declarado en el catálogo', () => {
    const declarados = new Set(MODULOS)
    const huerfanos = paresExigidos()
      .filter((p) => !declarados.has(p.modulo))
      .map((p) => `${p.modulo}.${p.accion} en ${p.archivo}`)
    // Un módulo no declarado es fail-closed: nadie podría usar esa ruta y el
    // síntoma sería un 403 inexplicable en producción.
    expect(huerfanos).toEqual([])
  })

  it('toda ACCIÓN que la API exige se puede ver en la matriz de Administración', () => {
    // ⚠️ El agujero que este caso cierra, y apareció al añadir `costear` el
    // 2026-09-29: la pantalla de Administración pinta las celdas con
    // `CAPACIDADES.filter(...)` (`administracion/page.tsx`). Una acción que la
    // API exija y que NO esté en esa lista **no aparece en ningún sitio**: el
    // Dueño ve `operaciones: V C A`, no hay rastro de la quinta, y no tiene
    // forma de saber que la está concediendo ni de quitarla.
    //
    // Es la trampa del ADR 0010 con el signo cambiado —allí el rol existía y no
    // tenía permisos; aquí el permiso existe y no se puede administrar— y las
    // dos se descubren igual de tarde: cuando alguien pregunta por qué.
    const conocidas = new Set<string>(CAPACIDADES)
    const invisibles = [...new Set(paresExigidos().map((p) => p.accion))]
      .filter((a) => !conocidas.has(a))
    expect(invisibles).toEqual([])
  })

  it('y al revés: la matriz no ofrece acciones que nadie exige', () => {
    // Una capacidad de más es una casilla que se puede marcar y no hace nada.
    // `facturar` la exige `campanas/[id]/facturar`; si alguna dejara de usarse,
    // esto lo dice en vez de que la matriz siga ofreciéndola para siempre.
    const exigidas = new Set(paresExigidos().map((p) => p.accion))
    expect(CAPACIDADES.filter((c) => !exigidas.has(c))).toEqual([])
  })

  it('`operaciones.costear` NO es `operaciones.crear` (2026-09-29)', () => {
    // La ruta del costo de una OT tiene que exigir la acción acotada. Si alguien
    // la devolviera a `crear`, Finanzas dejaría de poder capturar el costo —y la
    // salida fácil sería darles `operaciones.crear`, que es crear y CERRAR
    // órdenes de trabajo. Esta línea es lo que impide ese camino.
    const costo = paresExigidos().filter((p) => p.archivo.includes('costo'))
    expect(costo.map((p) => `${p.modulo}.${p.accion}`)).toEqual(['operaciones.costear'])
  })

  it('todo módulo del catálogo gobierna al menos un área', () => {
    const sinArea = MODULOS.filter((m) => areasDeModulo(m).length === 0)
    expect(sinArea).toEqual([])
  })

  it('las áreas sin API propia se apoyan en un módulo que sí la tiene', () => {
    // Una de estas áreas no se protege ocultando su menú: la protege el permiso
    // con el que /api/estado filtra. Si su módulo no gobernara ningún área con
    // API, no habría nada aplicando ese permiso en el servidor.
    for (const area of AREAS.filter((a) => !a.apiPropia && a.modulo !== 'dashboard')) {
      const hermanasConApi = areasDeModulo(area.modulo).filter((a) => a.apiPropia)
      expect(hermanasConApi.length, `${area.clave} (${area.modulo})`).toBeGreaterThan(0)
    }
  })

  it('el catálogo de PRECIO va bajo `precios`, y no bajo `comercial` (ADR 0040)', () => {
    // La separación que introdujo el ADR 0040, y el motivo por el que existe:
    // con estas cuatro bajo `comercial`, crear una propuesta y crear un cupón
    // eran el MISMO permiso (`comercial.crear`). El ADR pide que el VENDEDOR
    // haga lo primero y NO lo segundo, y eso era literalmente inexpresable.
    //
    // Se comprueba área por área y no «que exista el módulo `precios`»: el
    // mutante que devolvió UNA sola de las cuatro a `comercial` sobrevivió a
    // todo lo demás de este archivo, porque las otras tres mantenían el módulo
    // vivo. Una sola bastaría para que el vendedor pudiera crear cupones.
    const DEL_CATALOGO_DE_PRECIO = [
      'franjas-y-temporadas',
      'descuentos-por-volumen',
      'codigos-promocionales',
      'paquetes',
    ]
    const mal = AREAS.filter((a) => DEL_CATALOGO_DE_PRECIO.includes(a.clave) && a.modulo !== 'precios')
      .map((a) => `${a.clave} declara «${a.modulo}»`)
    expect(mal).toEqual([])
    // Y al revés: `precios` no gobierna nada más. Si alguien colgara de aquí una
    // pantalla que no es del catálogo de precio, se la estaría abriendo a los
    // dos jefes de venta sin decírselo a nadie.
    expect(areasDeModulo('precios').map((a) => a.clave).sort()).toEqual(
      [...DEL_CATALOGO_DE_PRECIO].sort(),
    )
  })

  it('los guards de esas rutas exigen `precios`, no `comercial`', () => {
    // La otra mitad: `lib/modulos.ts` puede decir `precios` y el `route.ts`
    // seguir exigiendo `comercial`. Entonces la matriz de permisos diría una
    // cosa y el servidor haría otra — «declarar una mentira», que es la frase
    // con la que este repositorio lleva tres ADR justificando dónde va cada
    // módulo. Se lee de los `exigir(...)` REALES.
    //
    // `/api/sitios/:id/rejilla` queda FUERA a propósito, y no es una excepción
    // cómoda: esa es la captura de tarifas DESDE LA FICHA de una pantalla, se
    // hace sobre una pantalla concreta y sigue siendo inventario. Las dos
    // superficies estaban bien separadas de origen y ni el 0039 ni el 0040 las
    // juntaron.
    const RUTAS = ['codigos-promocionales', 'paquetes', 'rejilla', 'volumen']
    const desalineados = paresExigidos()
      .filter((p) => !p.archivo.includes('sitios'))
      .filter((p) => RUTAS.some((r) => p.archivo.includes(r)) && p.modulo !== 'precios')
      .map((p) => `${p.archivo} exige ${p.modulo}.${p.accion}`)
    expect(desalineados).toEqual([])
    // Y que el regex siga encontrando algo: sin esto, un cambio de forma en las
    // llamadas volvería esta prueba trivialmente verde sobre una lista vacía.
    expect(
      paresExigidos().filter((p) => !p.archivo.includes('sitios') && p.modulo === 'precios').length,
    ).toBe(19)
  })

  it('el catálogo de pantallas NO va bajo comercial (ADR 0010)', () => {
    // La separación que introdujo el ADR: si alguien devolviera las rutas de
    // sitios a `comercial.crear`, un vendedor volvería a poder reestructurar el
    // inventario y nadie se enteraría.
    const escrituraSitios = paresExigidos().filter(
      (p) => p.archivo.includes('sitios') && p.accion === 'crear' && p.modulo === 'comercial',
    )
    expect(escrituraSitios).toEqual([])
  })
})

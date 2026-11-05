import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ES_CUENTA, EN_CUENTA } from './cuenta'
import { ES_SHELL, EN_SHELL } from './shell'

// ============================================================================
//  LOS DICCIONARIOS DE CUENTA Y SHELL, CONGELADOS — y los avisos que no se
//  rinden, atados a su clave.
// ----------------------------------------------------------------------------
//  Mismo patron que `admin.test.ts`: instantanea de los dos idiomas, las
//  guardias de forma y, leyendo el FUENTE, que cada toast o error que ningun
//  estado de `pantallas-cuenta-shell.test.ts` pinta usa SU clave.
// ============================================================================

const raiz = path.join(__dirname, '../../..')
const leer = (f: string) => readFileSync(path.join(raiz, f), 'utf8')

const LOTES: [string, Record<string, string>, Record<string, string>, Set<string>][] = [
  // Iguales a proposito: «No» es ingles tambien.
  ['cuenta', ES_CUENTA, EN_CUENTA, new Set(['cuenta.cuestionario.no'])],
  // «Error 404» (lote L5 del italiano): el literal de `app/not-found.tsx`, que
  // en ingles se dice igual y en italiano no («Errore 404»).
  ['shell', ES_SHELL, EN_SHELL, new Set<string>(['shell.404.codigo'])],
]

describe('diccionarios de cuenta y shell · instantanea', () => {
  it('cuenta: el ESPANOL y el INGLES no cambian sin que se vea', () => {
    expect(ES_CUENTA).toMatchSnapshot()
    expect(EN_CUENTA).toMatchSnapshot()
  })
  it('shell: el ESPANOL y el INGLES no cambian sin que se vea', () => {
    expect(ES_SHELL).toMatchSnapshot()
    expect(EN_SHELL).toMatchSnapshot()
  })
})

describe('diccionarios de cuenta y shell · el ingles no esta en espanol', () => {
  for (const [nombre, es, en, iguales] of LOTES) {
    it(`${nombre}: ninguna inglesa igual a la espanola (salvo las declaradas)`, () => {
      expect(Object.keys(es).filter((k) => es[k] === en[k] && !iguales.has(k))).toEqual([])
    })
    it(`${nombre}: sin acentos, ñ ni signos de apertura en ingles`, () => {
      expect(Object.entries(en).filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)).map(([k]) => k)).toEqual([])
    })
    it(`${nombre}: los huecos son los mismos en los dos idiomas`, () => {
      const h = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join()
      expect(Object.keys(es).filter((k) => h(es[k]) !== h(en[k]))).toEqual([])
    })
    it(`${nombre}: sin espacio antes de «%», sin «Tap» ni «press»`, () => {
      expect(Object.entries(en).filter(([, v]) => /\S %|\btap\b|\bpress\b/i.test(v)).map(([k]) => k)).toEqual([])
    })
    it(`${nombre}: los plurales vienen en pareja (.uno / .otros)`, () => {
      const c = Object.keys(es)
      const sueltas = c.filter(
        (k) => (k.endsWith('.uno') && !c.includes(k.replace(/\.uno$/, '.otros'))) ||
          (k.endsWith('.otros') && !c.includes(k.replace(/\.otros$/, '.uno'))),
      )
      expect(sueltas).toEqual([])
    })
  }
})

describe('cuenta y shell · los avisos que no se rinden usan su clave', () => {
  it('codigos de recuperacion', () => {
    const s = leer('app/(app)/(shell)/codigos-recuperacion/page.tsx')
    expect(s).toContain("() => toast.success(t('cuenta.codigos.copiados')),")
    expect(s).toContain("() => toast.error(t('cuenta.codigos.no-copiados')),")
    expect(s).toContain("d?.error ?? t('cuenta.codigos.error.generar')")
    expect(s).toContain("d?.error ?? t('cuenta.codigos.error.verificar')")
    expect(s).toContain("throw new Error(t('cuenta.codigos.error.confirmar'))")
  })
  it('recuperar la contrasena', () => {
    const s = leer('app/(app)/recuperar/[token]/page.tsx')
    expect(s).toContain("setError(t('cuenta.comun.no-coinciden'))")
    expect(s).toContain("mensajeDeAcceso(e.message, idioma) : t('cuenta.recuperar.error')")
    // La regla de `validarPassword` se pinta por su clave `password.*`.
    expect(s).toContain("const k = claveDeRegla(regla); setError(k ? t(k) : regla)")
  })
  it('el cuestionario de bienvenida', () => {
    const s = leer('components/demo/bienvenida/CuestionarioRazonesSociales.tsx')
    expect(s).toContain("plan.error : t('cuenta.cuestionario.contesta')")
    expect(s).toContain("d?.error ?? t('cuenta.cuestionario.error.guardar')")
    expect(s).toContain("toast.success(t('cuenta.cuestionario.listo', { resumen: resumenParaBitacora(plan.entidades) }))")
  })
  it('la propuesta publica', () => {
    const s = leer('app/(app)/p/[id]/page.tsx')
    expect(s).toContain("setErrorAcep(t('cuenta.publica.error.nombre'))")
    expect(s).toContain("j.error ?? t('cuenta.publica.error.aceptar')")
  })
  it('el candado de cambios', () => {
    const s = leer('components/demo/shell/DesbloqueoCambios.tsx')
    expect(s).toContain("e.message : t('shell.candado.error')")
  })
})

describe('cuenta · la regla de la contrasena se traduce por su clave', () => {
  it('cada texto de `validarPassword` es el de una clave `password.*`', async () => {
    const { validarPassword } = await import('../../password')
    const { DICCIONARIOS } = await import('../diccionario')
    const es = DICCIONARIOS.es as Record<string, string>
    for (const p of ['corta1', 'sololetras', '12345678', 'con espacio 1']) {
      const r = validarPassword(p)
      expect(r).toBeTruthy()
      expect(Object.keys(es).some((k) => k.startsWith('password.') && es[k] === r)).toBe(true)
    }
  })
})

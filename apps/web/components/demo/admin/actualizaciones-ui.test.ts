import { describe, it, expect } from 'vitest'
import { textoDeEstado, textoConfirmarInstalar, tituloNotasDisponibles, avisoSinNotas } from './actualizaciones-ui'

const AL_DIA = {
  modo: 'aprobacion' as const,
  versionInstalada: 'v0.4.1',
  versionDisponible: 'v0.4.1',
  digestDisponible: 'sha256:a',
  migracionesPendientes: 0,
  comprobadoEn: '2026-09-22T10:00:00.000Z',
  aprobadoDigest: null,
  hayNovedad: false,
  notasDisponibles: null,
}
const CON_NOVEDAD = {
  ...AL_DIA, versionDisponible: 'v0.4.2', digestDisponible: 'sha256:b',
  migracionesPendientes: 3, hayNovedad: true,
}

describe('textoDeEstado', () => {
  it('al dia se dice, y en verde', () => {
    const r = textoDeEstado(AL_DIA)
    expect(r.tono).toBe('ok')
    expect(r.texto).toContain('v0.4.1')
  })

  it('con novedad y esperando aprobacion: avisa y NOMBRA la version', () => {
    // Sin el numero de version el aviso no deja decidir nada.
    const r = textoDeEstado(CON_NOVEDAD)
    expect(r.tono).toBe('alerta')
    expect(r.texto).toContain('v0.4.2')
  })

  it('con novedad y en automatica: dice CUANDO entra, no "pronto"', () => {
    const r = textoDeEstado({ ...CON_NOVEDAD, modo: 'automatica' })
    expect(r.tono).toBe('info')
    expect(r.texto).toMatch(/madrugada/i)
  })

  it('NEGATIVO: una aprobacion CADUCA no se pinta como aprobada', () => {
    // El dueno aprobo `sha256:viejo` y desde entonces salio otra. Pintarlo como
    // "ya aprobaste, tranquilo" es la mentira exacta que el ADR 0037 existe
    // para impedir: se quedaria esperando algo que no va a pasar nunca.
    const r = textoDeEstado({ ...CON_NOVEDAD, aprobadoDigest: 'sha256:viejo' })
    expect(r.tono).toBe('alerta')
    expect(r.texto).toMatch(/más nueva|otra versión/i)
  })

  it('si nunca se ha comprobado, se dice: no se finge que esta al dia', () => {
    const r = textoDeEstado({ ...AL_DIA, comprobadoEn: null, digestDisponible: null })
    expect(r.tono).toBe('info')
    expect(r.texto).toMatch(/sin comprobar|no se ha comprobado/i)
  })

  it('aprobacion VIGENTE: se dice que ya esta pedida, sin volver a pedirla', () => {
    // El sexto estado, que no tenia prueba: el dueno ya aprobo EXACTAMENTE lo
    // disponible y solo falta que el cron lo aplique. Es lo contrario del caso
    // de arriba, y sin este caso nada impedia que los dos dijeran lo mismo.
    const r = textoDeEstado({ ...CON_NOVEDAD, aprobadoDigest: CON_NOVEDAD.digestDisponible })
    expect(r.tono).toBe('info')
    expect(r.texto).toContain('v0.4.2')
    expect(r.texto).toMatch(/aprobaste/i)
    expect(r.texto).not.toMatch(/esperando tu aprobación/i)
  })

  it('NEGATIVO: comprobado y SIN digest disponible no se pinta en verde', () => {
    // Imagen sin `RepoDigest` (ADR 0037, "Dos casos que NO son espera"). La
    // sonda escribe `comprobado_en` y deja `digest_disponible` en null, asi que
    // `hayNovedad` sale false y hasta la revision final de la rama esto caia en
    // la rama "Al dia" — la unica en verde — mientras `update.sh --comprobar`
    // salia con 1 noventa y seis veces al dia. La pantalla tranquilizaba justo
    // en el estado que el ADR llama bloqueo sin salida.
    const r = textoDeEstado({ ...AL_DIA, digestDisponible: null })
    expect(r.tono).toBe('alerta')
    expect(r.tono).not.toBe('ok')
    expect(r.texto).toMatch(/digest/i)
    expect(r.texto).not.toMatch(/al día/i)
  })
})

// El texto del ConfirmDialog de "instalar": no son casos del brief, pero la
// misma regla de vitest.config.ts (sin jsdom) aplica, así que la frase se
// prueba aquí y no dentro del .tsx (B32/B33).
describe('textoConfirmarInstalar', () => {
  it('nombra la version y dice cuantas migraciones trae, en plural', () => {
    const t = textoConfirmarInstalar(CON_NOVEDAD)
    expect(t).toContain('v0.4.2')
    expect(t).toMatch(/3 migraciones/)
  })

  it('con una sola migracion, en singular', () => {
    const t = textoConfirmarInstalar({ ...CON_NOVEDAD, migracionesPendientes: 1 })
    expect(t).toMatch(/1 migración\b/)
    expect(t).not.toMatch(/1 migraciones/)
  })

  it('con cero migraciones lo dice, y NO finge que no hay corte', () => {
    const t = textoConfirmarInstalar({ ...CON_NOVEDAD, migracionesPendientes: 0 })
    expect(t).toMatch(/sin migraciones|no trae migraciones|0 migraciones/i)
    expect(t).toMatch(/corta|corte/i)
  })

  it('NEGATIVO: null NO es cero — "no se pudo contar" no es "no hay ninguna"', () => {
    // El `?? 0` de antes hacia que el dialogo previo a un CORTE DE SERVICIO
    // dijera "No trae migraciones pendientes" cuando la sonda no habia llegado
    // a contarlas. Es la frase que hace pulsar sin pensarlo.
    const t = textoConfirmarInstalar({ ...CON_NOVEDAD, migracionesPendientes: null })
    expect(t).toMatch(/no se pudo contar/i)
    expect(t).not.toMatch(/no trae migraciones/i)
    expect(t).toMatch(/corta|corte/i)
  })

  it('siempre avisa del corte de servicio, que es lo que justifica el dialogo', () => {
    const t = textoConfirmarInstalar(CON_NOVEDAD)
    expect(t).toMatch(/corta|corte/i)
  })
})

describe('tituloNotasDisponibles', () => {
  it('nombra la version disponible', () => {
    expect(tituloNotasDisponibles(CON_NOVEDAD)).toBe('Qué trae v0.4.2')
  })

  it('sin nombre de version, no inventa uno', () => {
    expect(tituloNotasDisponibles({ ...CON_NOVEDAD, versionDisponible: null })).toBe('Qué trae la versión disponible')
  })
})

// ── Sin notas de la versión disponible (08/10) ──────────────────────────────
//  `release.yml` no publica ninguna versión sin su entrada en `novedades.json`,
//  así que una versión disponible SIN notas no es «una versión que no trae
//  notas»: es que el actualizador del servidor no las anotó. Pasó en g500, con
//  un `update.sh` del 23/09 anterior a las notas, y la tarjeta decía «Esta
//  versión no trae notas» desde el 05/10 sin que nadie lo viera.
const NOTAS = { version: 'v0.4.2', fecha: '2026-10-08', items: [{ tipo: 'NUEVO' as const, texto: 'Algo' }] }

describe('avisoSinNotas', () => {
  it('con novedad y SIN notas: avisa, nombra la versión y dice que se avise a soporte antes de aprobar', () => {
    const t = avisoSinNotas(CON_NOVEDAD)
    expect(t).toContain('v0.4.2')
    expect(t).toMatch(/no llegaron/i)
    expect(t).toMatch(/soporte/i)
    expect(t).toMatch(/antes de aprobar/i)
  })

  it('NEGATIVO: no dice «no trae notas» — eso culparía a la versión de un fallo del servidor', () => {
    expect(avisoSinNotas(CON_NOVEDAD)).not.toMatch(/no trae notas/i)
  })

  it('con notas no hay aviso', () => {
    expect(avisoSinNotas({ ...CON_NOVEDAD, notasDisponibles: NOTAS })).toBeNull()
  })

  it('sin novedad no hay aviso, aunque falten notas', () => {
    expect(avisoSinNotas(AL_DIA)).toBeNull()
  })
})

describe('textoConfirmarInstalar sin notas', () => {
  it('el diálogo de instalar también lo dice: es el último momento para enterarse', () => {
    expect(textoConfirmarInstalar(CON_NOVEDAD)).toMatch(/no llegaron sus notas/i)
  })

  it('con notas no lo menciona', () => {
    expect(textoConfirmarInstalar({ ...CON_NOVEDAD, notasDisponibles: NOTAS })).not.toMatch(/notas/i)
  })
})

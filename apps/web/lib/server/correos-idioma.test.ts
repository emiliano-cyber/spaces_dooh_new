import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'

// ============================================================================
//  ADR 0049 (segunda vuelta) · los CORREOS salen en el idioma de la instancia.
//
//  Decision del dueno (03/11): «todo debe salir en el idioma que se configuro
//  el programa». Lo que protege este archivo:
//
//   1. En espanol, cada correo sale BYTE A BYTE como antes. Los hashes se
//      midieron sobre el codigo anterior (el de la plantilla de recordatorios,
//      tras sacarla tal cual de su `route.ts`).
//   2. En ingles e italiano no queda ni una frase de la plantilla espanola.
//   3. Las claves del diccionario en espanol son el MISMO texto que la
//      plantilla literal: si alguien cambia una y no la otra, se ve aqui.
// ============================================================================

vi.mock('server-only', () => ({}))

const { htmlCorreoInvitacion, asuntoCorreoInvitacion } = await import('./email')
const { asuntoCorreoPropuesta, htmlCorreoPropuesta } = await import('./propuesta-correo')
const { htmlRecordatorios, asuntoRecordatorios } = await import('./correo-recordatorios')
const { recordatoriosDeContratos } = await import('@/lib/recordatorios-contratos')
const { traducir } = await import('@/lib/i18n/diccionario')

const h = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

const D = {
  orgNombre: 'Medios <SA>',
  logoUrl: 'https://x/api/logo/abc',
  propuestaNombre: 'Campaña "Navidad"',
  folio: 'P-001',
  liga: 'https://x/p/tok?a=1&b=2',
  vigenteHasta: '31/12/2026',
  mensaje: 'Hola\nqué tal',
  remitenteNombre: 'Ana López',
}
const MINIMA = { ...D, logoUrl: null, vigenteHasta: null, mensaje: null, remitenteNombre: null }
const AVISOS = recordatoriosDeContratos(
  [
    { id: 'a', estatus: 'VIGENTE', fechaFin: '2026-10-01', arrendadorNombre: 'Don Pepe', sitioNombre: 'Reforma <222>' },
    { id: 'b', estatus: 'VIGENTE', fechaFin: '2026-11-04', sitioNombre: 'Unipolar' },
    { id: 'c', estatus: 'VIGENTE', fechaFin: '2026-11-03', predioNombre: 'Predio' },
    { id: 'd', estatus: 'INCOMPLETO', fechaFin: null },
  ],
  new Date(2026, 10, 3),
)
const ORG = { nombreOrg: 'Medios <SA>', replyTo: null, logoUrl: 'https://x/l' }

// Medidos ANTES del cambio. No se recalculan.
const HASH_ES = {
  invitacion: '54ca1167276642ad56dff2f1adb064ed1f19657258d20be130312810ff66c4c9',
  propuestaCompleta: '9265cb5e5d060bee3f8965f104e22029173983228a54fe1f3b7aed77266d78e6',
  propuestaMinima: '16c0222a40f94b06f4ec0d1f3274ed80b12364320be6691a81f22a1acb5cbcea',
  asunto: '5d6b7478f2928e0229b5cb4eaf5c313371f27666cb8ae3096a3daaa45e10a7fb',
  recordatorios: '031208fece4b8fcd2fab8e457ab8229d3cc13bb476958f86c74735cea884341b',
  asuntoRecordatorios: 'c6565c5b9ccab49de2b3cbdb780d05bd9ac77c82bffcf115b946fc61accd4878',
}

describe('en ESPANOL cada correo sale byte a byte como antes', () => {
  it.each([undefined, 'es'] as const)('idioma %s', (idioma) => {
    expect(h(htmlCorreoInvitacion('Ana <b>', 'https://x/b?t=1&u=2', idioma))).toBe(HASH_ES.invitacion)
    expect(h(htmlCorreoPropuesta(D, idioma))).toBe(HASH_ES.propuestaCompleta)
    expect(h(htmlCorreoPropuesta(MINIMA, idioma))).toBe(HASH_ES.propuestaMinima)
    expect(h(asuntoCorreoPropuesta({ orgNombre: 'Medios\nSA', propuestaNombre: 'Navidad' }, idioma))).toBe(HASH_ES.asunto)
    expect(h(htmlRecordatorios(AVISOS, ORG, idioma))).toBe(HASH_ES.recordatorios)
    expect(h(asuntoRecordatorios(AVISOS, idioma))).toBe(HASH_ES.asuntoRecordatorios)
    expect(asuntoCorreoInvitacion(idioma)).toBe('Te dieron acceso a Space OS · elige tu contraseña')
  })
})

// Lo que delataria un correo a medio traducir. Son de la PLANTILLA, no datos.
const ESPANOL = [
  'Hola', 'contraseña', 'Haz clic', 'enlace', 'Te compartimos', 'Ver la propuesta', 'Folio ', 'Puedes aceptarla',
  'copia', 'Contratos que necesitan', 'este aviso', 'Contrato vencido', 'vence', 'sin capturar', 'Propuesta comercial',
]

describe.each(['en', 'it'] as const)('en %s no queda nada de la plantilla espanola', (idioma) => {
  const salidas = () => ({
    invitacion: htmlCorreoInvitacion('Ana <b>', 'https://x/b?t=1&u=2', idioma),
    asuntoInvitacion: asuntoCorreoInvitacion(idioma),
    propuesta: htmlCorreoPropuesta(D, idioma),
    asunto: asuntoCorreoPropuesta(D, idioma),
    recordatorios: htmlRecordatorios(AVISOS, ORG, idioma),
    asuntoRecordatorios: asuntoRecordatorios(AVISOS, idioma),
  })

  it('ninguna frase espanola', () => {
    for (const [k, v] of Object.entries(salidas())) {
      // El mensaje del vendedor es DATO («Hola, qué tal»): se quita antes de mirar.
      const plantilla = v.replace('Hola' + String.fromCharCode(10) + 'qué tal', '')
      // «copia» es tambien italiano («copia e incolla»): en `it` no delata nada.
      for (const p of ESPANOL) {
        if (idioma === 'it' && p === 'copia') continue
        expect(plantilla, `${k}: «${p}»`).not.toContain(p)
      }
    }
  })

  it('los datos van tal cual, y escapados', () => {
    const s = salidas()
    expect(s.propuesta).toContain('Medios &lt;SA&gt;')
    expect(s.propuesta).toContain('https://x/p/tok?a=1&amp;b=2')
    // Ni en el boton ni en la direccion en claro: ningun `&` crudo.
    expect(s.propuesta).not.toContain('a=1&b=2')
    expect(s.invitacion).not.toContain('t=1&u=2')
    expect(s.invitacion).toContain('Ana &lt;b&gt;')
    expect(s.propuesta).toContain('Hola\nqué tal'.replace('Hola', 'Hola')) // el mensaje del vendedor es DATO
    expect(s.recordatorios).toContain('Reforma &lt;222&gt;')
    expect(s.invitacion).not.toContain('<b>')
  })

  it('el texto sale de las claves del diccionario', () => {
    const s = salidas()
    expect(s.propuesta).toContain(traducir(idioma, 'propuestas.correo.boton'))
    expect(s.invitacion).toContain(traducir(idioma, 'cuenta.correo.invitacion.boton'))
    expect(s.recordatorios).toContain(traducir(idioma, 'notificaciones.correo.contratos.titulo'))
  })
})

describe('en ingles, el texto que se espera', () => {
  it('propuesta, invitacion y recordatorios', () => {
    expect(asuntoCorreoPropuesta(D, 'en')).toBe('Commercial proposal: Campaña "Navidad" · Medios <SA>')
    expect(htmlCorreoPropuesta(D, 'en')).toContain('View the proposal')
    expect(asuntoCorreoInvitacion('en')).toBe('You’ve been given access to Space OS · choose your password')
    expect(asuntoRecordatorios(AVISOS, 'en')).toBe('Contracts that need attention: 1 expired · 2 due soon · 1 not entered')
    // Los avisos, con la traduccion de las notificaciones (ola 6 del ingles).
    expect(htmlRecordatorios(AVISOS, ORG, 'en')).toContain('Contract expired: Reforma &lt;222&gt; · Don Pepe')
  })
})

// B67 · al integrar con el italiano (2026-11-04): una instancia `it` manda
// los correos en italiano, no en ingles.
describe('en italiano, el texto que se espera', () => {
  it('propuesta, invitacion y recordatorios', () => {
    expect(asuntoCorreoPropuesta(D, 'it')).toBe('Proposta commerciale: Campaña "Navidad" · Medios <SA>')
    expect(htmlCorreoPropuesta(D, 'it')).toContain('Vedi la proposta')
    expect(asuntoCorreoInvitacion('it')).toBe('Ti è stato dato accesso a Space OS · scegli la tua password')
    expect(asuntoRecordatorios(AVISOS, 'it')).toBe('Contratti che richiedono attenzione: 1 scaduto · 2 in scadenza · 1 da inserire')
    for (const v of [htmlCorreoPropuesta(D, 'it'), htmlCorreoInvitacion('Ana', 'https://x/b', 'it'), htmlRecordatorios(AVISOS, ORG, 'it')]) {
      for (const en of ['View the proposal', 'Choose my password', 'Contracts that need attention', 'If the button']) {
        expect(v).not.toContain(en)
      }
    }
  })
})

describe('las claves espanolas son el mismo texto que la plantilla literal', () => {
  const plano = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/ ([.,:])/g, '$1')
  it('propuesta', () => {
    const es = plano(htmlCorreoPropuesta(D))
    for (const k of ['propuestas.correo.cuerpo', 'propuestas.correo.boton', 'propuestas.correo.copiar'] as const) {
      expect(es).toContain(traducir('es', k))
    }
    expect(es).toContain(plano(traducir('es', 'propuestas.correo.vigencia', { fecha: '31/12/2026' })))
    expect(asuntoCorreoPropuesta(D)).toBe(traducir('es', 'propuestas.correo.asunto', { nombre: D.propuestaNombre, org: D.orgNombre }))
  })
  it('invitacion', () => {
    const es = plano(htmlCorreoInvitacion('Ana', 'https://x/b'))
    for (const k of ['cuenta.correo.invitacion.titulo', 'cuenta.correo.invitacion.boton', 'cuenta.correo.invitacion.pie'] as const) {
      expect(es).toContain(traducir('es', k))
    }
    expect(es).toContain(traducir('es', 'cuenta.correo.invitacion.cuerpo', { nombre: 'Ana' }))
    expect(asuntoCorreoInvitacion()).toBe(traducir('es', 'cuenta.correo.invitacion.asunto'))
  })
  it('recordatorios', () => {
    const es = plano(htmlRecordatorios(AVISOS, { ...ORG, nombreOrg: 'Medios' }))
    expect(es).toContain(traducir('es', 'notificaciones.correo.contratos.titulo'))
    expect(es).toContain(traducir('es', 'notificaciones.correo.contratos.pie', { org: 'Medios' }))
    expect(asuntoRecordatorios(AVISOS)).toBe(
      traducir('es', 'notificaciones.correo.contratos.asunto', { resumen: '1 vencido · 2 por vencer · 1 sin capturar' }),
    )
  })
})

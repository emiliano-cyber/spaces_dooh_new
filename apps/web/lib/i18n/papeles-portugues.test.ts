import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AMBITOS_PORTUGUES, DICCIONARIOS, PT_PARCIAL, traducir, type ClaveTexto } from './diccionario'
import { ConstanciaFirmas } from '@/components/demo/arrendadores/ConstanciaFirmas'
import { asuntoCorreoReset, htmlCorreoReset, asuntoCorreoInvitacion, htmlCorreoInvitacion } from '@/lib/server/email'
import { asuntoCorreoPropuesta, htmlCorreoPropuesta } from '@/lib/server/propuesta-correo'
import { importeDeRevision } from '@/components/demo/arrendadores/PanelFirmas'
import { generarContrato, documentoATexto } from '@/lib/contrato-documento'
import { completo } from '@/lib/contrato-documento.datos-prueba'

// ============================================================================
//  P3 del portugues (05/11) · LOS PAPELES EN PORTUGUES.
//
//  En una instancia con documentos en `pt` (ADR 0049), los papeles salen en
//  portugues: constancia de firmas, propuesta imprimible, `/p`, portal,
//  comprobante y correos. P3 escribio sus claves aparte, en
//  `textos/papeles-portugues.ts`, mientras los lotes traducian en paralelo; la
//  costura (05/11) vio las 151 en su `PT_<AMBITO>` (gana el lote, con el
//  glosario comun) y retiro ese archivo.
//
//  Lo que se protege:
//   · que TODA clave de papel tenga portugues escrito (la caida al espanol del
//     portugues no se nota a simple vista: aqui si), y en SU `PT_<AMBITO>`;
//   · el folio: «Nº» en lo que ve el CLIENTE, «Ref. interna» dentro de la app
//     (decision del dueno, 05/11);
//   · que es/en/it no cambien: ninguna clave de papel toca esos diccionarios.
// ============================================================================

const ES = DICCIONARIOS.es as Record<string, string>
const PT = DICCIONARIOS.pt as Record<string, string>

// Las claves de cada papel. Si un papel gana una clave, va aqui.
const PAPELES: Array<[string, RegExp]> = [
  ['constancia de firmas', /^arrendadores\.constancia\./],
  ['propuesta imprimible', /^propuestas\.documento\.(qr\.|encabezado|para|periodo|vigencia|aceptada|vencio|valida-hasta|se-fija|pantallas|col\.|sin-foto|franja|ubicacion|sin-coords|importe|descuento|comision|terminos|acepta-cliente|firma)/],
  ['liga publica /p', /^cuenta\.publica\./],
  ['portal del cliente', /^cuenta\.portal\./],
  ['comprobante', /^finanzas\.comprobante\.(titulo|la-recibe|uso|serie|fecha|subtotal|iva|no-cuadra|aviso)$/],
  ['correo de la propuesta', /^propuestas\.correo\./],
  ['correos de invitacion y reset', /^cuenta\.correo\./],
  ['correo diario de contratos', /^notificaciones\.(correo\.|contrato\.)/],
  ['etapas del portal', /^campanas\.etapa\./],
]

// Lo que un papel pinta y vive en una clave compartida con la interfaz (los
// totales, el tipo de medio, la galeria del portal, el folio fiscal…). Es la
// lista de P3 (`papeles-portugues.ts`) que no cae en ningun patron de arriba.
const COMPARTIDAS_CON_PAPEL = [
  'propuestas.comun.sin-cliente', 'propuestas.comun.agencia', 'propuestas.comun.via', 'propuestas.comun.iva',
  'propuestas.comun.neto', 'propuestas.comun.total', 'propuestas.comun.bruto-lista', 'propuestas.comun.paquete-conjunto',
  'propuestas.comun.descuento-volumen', 'propuestas.comun.codigo-pct', 'propuestas.ficha.meta.fechas',
  'propuestas.ficha.meta.anunciante', 'propuestas.ficha.meta.directa', 'propuestas.ficha.meta.comision',
  'propuestas.ficha.resumen', 'propuestas.ficha.kpi.total', 'propuestas.ficha.total', 'propuestas.ficha.sitios.vacia',
  'propuestas.ficha.mapa', 'propuestas.condiciones.terminos', 'cuenta.comun.enlace-invalido', 'campanas.evidencia.vacia',
  'campanas.evidencia.vacia.texto', 'campanas.evidencia.alt', 'campanas.evidencia.foto', 'campanas.evidencia.tomada',
  'campanas.evidencia.subida', 'comercial.tipo-medio.espectacular', 'comercial.tipo-medio.pantalla-digital',
  'comercial.tipo-medio.puente-peatonal', 'comercial.tipo-medio.mobiliario-urbano', 'comercial.tipo-medio.mural',
  'comercial.tipo-medio.valla', 'comercial.tipo-medio.otro', 'finanzas.comun.folio', 'finanzas.comun.folio-fiscal',
  'finanzas.comun.campana', 'finanzas.comun.la-emite', 'finanzas.comun.total',
]

/** Todas las claves que pinta un papel: las 151 de P3 y las que sus patrones cubren (169). */
const CLAVES_DE_PAPEL: string[] = [
  ...Object.keys(ES).filter((k) => PAPELES.some(([, p]) => p.test(k))),
  ...COMPARTIDAS_CON_PAPEL,
]
const PAPEL_PT = (): Array<[string, string]> => CLAVES_DE_PAPEL.map((k) => [k, (PT_PARCIAL as Record<string, string>)[k]])

describe('P3 · toda clave de papel tiene portugues escrito', () => {
  it.each(PAPELES)('%s', (_n, patron) => {
    const claves = Object.keys(ES).filter((k) => patron.test(k))
    expect(claves.length).toBeGreaterThan(0)
    const faltan = claves.filter((k) => !(PT_PARCIAL as Record<string, string>)[k])
    expect(faltan).toEqual([])
  })

  it('NEGATIVO · lo que se lee del papel ya no es el espanol (muestras)', () => {
    for (const k of [
      'arrendadores.constancia.titulo',
      'propuestas.documento.encabezado',
      'propuestas.documento.acepta-cliente',
      'cuenta.publica.aceptar',
      'cuenta.portal.subtitulo',
      'finanzas.comprobante.aviso',
      'cuenta.correo.reset.asunto',
      'notificaciones.correo.contratos.titulo',
    ] as ClaveTexto[]) {
      expect(PT[k], k).not.toBe(ES[k])
    }
  })

  it('H4 (validacion de P3) · «certificado de conservação NOM-151», no «constância»', () => {
    expect(PT['arrendadores.constancia.nota']).toContain('certificado de conservação NOM-151')
    expect(PT['arrendadores.constancia.nota']).not.toContain('constância')
  })

  it('el rol «Dueño» se dice «Titular» (dueno, 05/11): ningun papel dice «Proprietário» por el rol', () => {
    // El contrato dice «proprietário ou possuidor» del INMUEBLE (derecho
    // civil), no el rol de la aplicacion: ese no es el caso.
    for (const [k, v] of PAPEL_PT()) expect(v, k).not.toMatch(/propriet[aá]ri/i)
  })

  it('las partes de la constancia son las del contrato en portugues', () => {
    expect(PT['arrendadores.constancia.parte.arrendador']).toBe('O LOCADOR')
    expect(PT['arrendadores.constancia.parte.arrendatario']).toBe('O LOCATÁRIO')
  })

  it('cada clave de papel existe en espanol y lleva sus mismos huecos', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const [k, v] of PAPEL_PT()) {
      expect(ES[k], k).toBeDefined()
      const esperados = k.endsWith('.cero') ? huecos(ES[k]).filter((x) => x !== 'n') : huecos(ES[k])
      expect(huecos(v!).filter((x) => !k.endsWith('.cero') || x !== 'n'), k).toEqual(esperados)
    }
  })
})

describe('P3 · la costura con los lotes (05/11)', () => {
  // Hasta la costura, P3 y los lotes escribian estas claves en dos sitios y
  // una prueba exigia que dijeran lo mismo. Con `papeles-portugues.ts`
  // retirado, la regla es mas simple y mas fuerte: cada clave de papel esta
  // en el `PT_<AMBITO>` de su ambito, y en ningun otro sitio.
  it('cada clave de papel vive en el PT_<AMBITO> de su ambito', () => {
    const porAmbito = new Map(AMBITOS_PORTUGUES.map((a) => [a.ambito, a.pt as Partial<Record<string, string>>]))
    const fuera = CLAVES_DE_PAPEL.filter((k) => !porAmbito.get(k.split('.')[0])?.[k])
    expect(fuera).toEqual([])
    // 171 desde AVISOS-CANAL (12/11): el boton y el pie del correo de un aviso.
    expect(CLAVES_DE_PAPEL.length).toBe(171)
  })

  // Decision del dueno (05/11): en lo que ve el CLIENTE el folio es «Nº»
  // («Proposta Nº P-1»); dentro de la app sigue «Ref. interna».
  it('el folio: «Nº» en los papeles del cliente, «Ref. interna» dentro de la app', () => {
    expect(PT['propuestas.correo.folio']).toBe('Nº {folio}')
    expect(PT['finanzas.comprobante.titulo']).toBe('Comprovante Nº {folio}')
    expect(PAPEL_PT().filter(([, v]) => /Ref. interna/.test(v)).map(([k]) => k)).toEqual([])
    expect(PT['propuestas.ficha.folio']).toBe('Ref. interna:')
    expect(PT['propuestas.tablero.col.folio']).toBe('Ref. interna')
  })
})

describe('P3 · es/en/it no se tocan', () => {
  // Que los diccionarios es/en/it no cambiaron lo mide el volcado HTML de toda
  // la suite antes/despues (diario del 05/11); aqui, que los papeles solo
  // entran en el PORTUGUES: el espanol, el ingles y el italiano de una clave de
  // papel siguen siendo los de su `textos/<ambito>.ts`.
  it('ninguna clave de papel escrita en pt aparece en es/en/it salvo donde la palabra es la misma', () => {
    const iguales = CLAVES_DE_PAPEL.filter((k) => traducir('es', k as ClaveTexto) === PT[k])
    // Palabras que el portugues escribe igual que el espanol («Total», «IVA»,
    // «Reservada»…): no son una caida, son la misma palabra.
    for (const k of iguales) expect(PT[k], k).toMatch(/^(Total|IVA|Subtotal|Mural|Reservada|Confirmada|Publicada|Anunciante|Para|foto|Navegador: \{navegador\}|Uso: \{uso\}|Total|Contrato vencido: \{contrato\}|\{n\} vencidos?|Código \{codigo\} \(\{pct\}%\)|IVA \{pct\}%)$/)
    expect(DICCIONARIOS.es['arrendadores.constancia.titulo']).toBe('Constancia de firma electrónica')
    expect(DICCIONARIOS.en['arrendadores.constancia.titulo']).toBe('Electronic signature certificate')
  })
})

describe('P3 · los papeles pintados en portugues', () => {
  const FIRMA = {
    parte: 'ARRENDADOR' as const,
    estatus: 'FIRMADA' as const,
    nombreFirmante: 'Juan Pérez',
    firmadoEn: '2026-11-05T15:00:00Z',
    ip: '10.0.0.1',
    userAgent: null,
    documentoHash: 'abc',
    invalidada: true,
  }

  it('la constancia de firmas, en portugues, con la fecha a la brasileña', () => {
    const html = renderToStaticMarkup(
      h(ConstanciaFirmas, { estado: { firmas: [FIRMA], hashCongelado: 'abc', congeladoEn: '2026-11-05T15:00:00Z' } as never, idioma: 'pt' }),
    )
    expect(html).toContain('Comprovante de assinatura eletrônica')
    expect(html).toContain('O LOCADOR')
    expect(html).toContain('ASSINATURA INVALIDADA')
    expect(html).toContain('não registrado')
    expect(html).toContain('de novembro de 2026')
    expect(html).not.toContain('Constancia de firma')
  })

  it('el correo de restablecer contrasena, en portugues', () => {
    expect(asuntoCorreoReset('pt')).toBe('Redefina sua senha · Space OS')
    const html = htmlCorreoReset('Ana', 'https://x.test/r/1', 'pt')
    expect(html).toContain('Olá, Ana')
    expect(html).toContain('Redefinir senha')
    expect(html).not.toContain('Restablece')
  })

  it('el correo de invitacion, en portugues', () => {
    expect(asuntoCorreoInvitacion('pt')).toBe('Você recebeu acesso ao Space OS · escolha sua senha')
    expect(htmlCorreoInvitacion('Ana', 'https://x.test/i/1', 'pt')).toContain('Escolher minha senha')
  })

  it('el correo de la propuesta, en portugues', () => {
    expect(asuntoCorreoPropuesta({ orgNombre: 'Org', propuestaNombre: 'Natal' }, 'pt')).toBe(
      'Proposta comercial: Natal · Org',
    )
    const html = htmlCorreoPropuesta(
      {
        orgNombre: 'Org', logoUrl: null, propuestaNombre: 'Natal', folio: 'P-1', liga: 'https://x.test/p/1',
        vigenteHasta: null, mensaje: null, remitenteNombre: null,
      } as never,
      'pt',
    )
    expect(html).toContain('Ver a proposta')
    expect(html).toContain('Nº P-1')
    expect(html).not.toContain('Ref. interna')
  })

  it('NEGATIVO · en una instancia espanola los correos siguen siendo los literales de siempre', () => {
    expect(asuntoCorreoReset('es')).toBe('Restablece tu contraseña · Space OS')
    expect(asuntoCorreoReset()).toBe('Restablece tu contraseña · Space OS')
  })
})

// H1 de la validacion de P3 (05/11): la revision previa a enviar a firma
// muestra el importe «como lo recita el contrato». Con la interfaz en
// portugues salia el formato mexicano («$1,234,567.89»), que en Brasil se lee
// al reves. El mismo arreglo que el italiano del 04/11.
describe('P3 · H1 · la revision previa a la firma, con el importe del contrato pt', () => {
  it('pt: «1.234.567,89 MXN», exactamente como lo dice el contrato en portugues', () => {
    expect(importeDeRevision(1234567.89, 'MXN', 'pt')).toBe('1.234.567,89 MXN')
    expect(importeDeRevision(6000, 'USD', 'pt')).toBe('6.000,00 USD')
    const texto = documentoATexto(generarContrato({ ...completo, idioma: 'pt' }))
    expect(texto).toContain(`${importeDeRevision(1234567.89, 'MXN', 'pt')} (`)
  })
  it('NEGATIVO · es/en/it como siempre, y sin importe no hay nada', () => {
    expect(importeDeRevision(6000, 'MXN', 'es')).toBe('$6,000.00 MXN')
    expect(importeDeRevision(6000, 'MXN', 'en')).toBe('$6,000.00 MXN')
    expect(importeDeRevision(6000, 'MXN', 'it')).toBe('6.000,00 MXN')
    expect(importeDeRevision(null, 'MXN', 'pt')).toBeNull()
  })
})

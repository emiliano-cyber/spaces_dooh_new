import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { ES_ARRENDADORES, EN_ARRENDADORES } from './arrendadores'
import { traducir, type ClaveTexto } from '../diccionario'
import { textoVencimiento } from '@/lib/renta-periodicidad'
import { faltaEnContratos, LICENCIA_LABEL } from '@/lib/data/derive'
import {
  CLAVE_CAMPO_CONTRATO,
  CLAVE_DONDE_DOC,
  CLAVE_FALTANTE_DOC,
  CLAVE_LICENCIA,
  textoFaltaEnContratos,
  textoVencimientoRel,
} from '@/components/demo/arrendadores/etiquetas'

// ============================================================================
//  EL DICCIONARIO DE ARRENDADORES ENTERO, CONGELADO — y atado a sus fuentes.
//  Mismo porque que `textos/inventario.test.ts`.
// ============================================================================

const leer = (archivo: string) =>
  readFileSync(path.join(__dirname, '../../..', archivo), 'utf8').replace(/\r\n/g, '\n')

describe('diccionario de arrendadores · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_ARRENDADORES).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_ARRENDADORES).toMatchSnapshot()
  })
})

describe('diccionario de arrendadores · el ingles no esta en espanol', () => {
  const IGUALES = new Set([
    'arrendadores.revision.fila', // «{campo}: {valor}», sin texto que traducir
  ])

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    const iguales = Object.keys(ES_ARRENDADORES).filter(
      (k) => ES_ARRENDADORES[k as keyof typeof ES_ARRENDADORES] === EN_ARRENDADORES[k as keyof typeof EN_ARRENDADORES],
    )
    expect(iguales.filter((k) => !IGUALES.has(k))).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    expect(Object.entries(EN_ARRENDADORES).filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    const distintos = Object.keys(ES_ARRENDADORES).filter(
      (k) =>
        huecos(ES_ARRENDADORES[k as keyof typeof ES_ARRENDADORES]) !== huecos(EN_ARRENDADORES[k as keyof typeof EN_ARRENDADORES]),
    )
    expect(distintos).toEqual([])
  })

  it('ningun porcentaje ingles lleva espacio antes del «%»', () => {
    expect(Object.entries(EN_ARRENDADORES).filter(([, v]) => /\S %/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('ni comillas rectas ni apostrofos rectos en ingles', () => {
    expect(Object.entries(EN_ARRENDADORES).filter(([, v]) => /"|[A-Za-z]'[A-Za-z]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('ni «Tap» ni «press»: siempre «click»', () => {
    expect(Object.entries(EN_ARRENDADORES).filter(([, v]) => /\b(tap|press)\b/i.test(v)).map(([k]) => k)).toEqual([])
  })
})

describe('diccionario de arrendadores · el espanol reproduce EXACTAMENTE su modulo', () => {
  const t = (clave: ClaveTexto, valores?: Record<string, string | number>) => traducir('es', clave, valores)

  it('textoVencimientoRel dice lo mismo que `textoVencimiento`', () => {
    for (const dias of [-30, -2, -1, 0, 1, 2, 45]) expect(textoVencimientoRel(dias, t)).toBe(textoVencimiento(dias))
  })

  it('textoFaltaEnContratos dice lo mismo que `faltaEnContratos`, combinacion por combinacion', () => {
    const lleno = { arrendadorId: 'a', fechaFin: '2027-01-01', montoRenta: 1, periodicidad: 'MENSUAL' }
    const casos = [
      [],
      [lleno],
      [{ ...lleno, arrendadorId: null }],
      [{ ...lleno, fechaFin: null }, { ...lleno, periodicidad: null }],
      [{ ...lleno, arrendadorId: null, montoRenta: null }, { ...lleno, fechaFin: null, periodicidad: null }],
    ] as Parameters<typeof faltaEnContratos>[0][]
    for (const c of casos) expect(textoFaltaEnContratos(c, t)).toBe(faltaEnContratos(c))
  })

  it('las licencias dicen lo mismo que `LICENCIA_LABEL`', () => {
    expect(Object.keys(CLAVE_LICENCIA).sort()).toEqual(Object.keys(LICENCIA_LABEL).sort())
    for (const [k, v] of Object.entries(LICENCIA_LABEL)) expect(t(CLAVE_LICENCIA[k])).toBe(v)
  })

  it('la etiqueta de cada campo del historial dice lo mismo que `CAMPOS` (lib/contrato-cambios.ts)', () => {
    const fuente = leer('lib/contrato-cambios.ts')
    const campos = [...fuente.matchAll(/\{ campo: '(\w+)', columna: '\w+', etiqueta: '([^']+)'/g)]
    expect(campos.map((m) => m[1]).sort()).toEqual(Object.keys(CLAVE_CAMPO_CONTRATO).sort())
    for (const [, campo, etiqueta] of campos) expect(t(CLAVE_CAMPO_CONTRATO[campo])).toBe(etiqueta)
  })

  it('lo que falta y donde, como lo redacta `lib/contrato-documento.ts`', () => {
    const doc = leer('lib/contrato-documento.ts')
    for (const [es, clave] of Object.entries({ ...CLAVE_FALTANTE_DOC, ...CLAVE_DONDE_DOC })) {
      expect(t(clave)).toBe(es)
      expect(doc).toContain(`'${es}'`)
    }
  })

  it('el grupo sin arrendador del cuadre se llama como en `conciliacionRenta`', () => {
    expect(leer('lib/data/derive.ts')).toContain(`'${t('arrendadores.cuadre.sin-arrendador')}'`)
  })
})

// ============================================================================
//  QUE CLAVE usa cada aviso que NO se rinde. Se lee el fuente.
// ============================================================================
describe('arrendadores · los avisos que no se rinden usan su clave', () => {
  const pagina = leer('app/(app)/(shell)/arrendadores/page.tsx')
  const ficha = leer('components/demo/arrendadores/ContratoSheet.tsx')
  const cambios = leer('components/demo/arrendadores/CambiosContrato.tsx')
  const panel = leer('components/demo/arrendadores/PanelFirmas.tsx')
  const razones = leer('components/demo/arrendadores/GestionRazonesSociales.tsx')
  const licencias = leer('components/demo/arrendadores/LicenciasCard.tsx')
  const pagos = leer('components/demo/arrendadores/PagosRentaCard.tsx')

  it('la pagina: alta, razon social que fallo, edicion y baja', () => {
    expect(pagina).toMatch(/onToast\(t\('arrendadores\.alta\.agregado'\)\)/)
    expect(pagina).toMatch(/t\('arrendadores\.alta\.razon-fallo'/)
    expect(pagina).toMatch(/onToast\(t\('arrendadores\.lista\.actualizado'\)\)/)
    expect(pagina).toMatch(/onToast\(t\('arrendadores\.baja\.hecha'\)\)/)
    expect(pagina).toMatch(/\? t\('arrendadores\.descarga\.ninguno'\)\s*\n\s*: t\(n === 1 \? 'arrendadores\.descarga\.hecha\.uno' : 'arrendadores\.descarga\.hecha\.otros'/)
  })

  it('la ficha: renovar, pagar o adjuntar, y quien paga', () => {
    expect(ficha).toMatch(/alLograr: \(\) => onToast\(t\('arrendadores\.ficha\.renovacion-iniciada'\)\)/)
    expect(ficha).toMatch(/onHecho\(yaPagado \? t\('arrendadores\.pago\.adjuntos-guardados'\) : t\('arrendadores\.pago\.registrado'\)\)/)
    expect(ficha).toMatch(/elegida\s*\n\s*\? t\('arrendadores\.pagadora\.asignada'\)\s*\n\s*: t\('arrendadores\.pagadora\.sin'\)/)
    expect(ficha).toMatch(/onHecho\(t\('arrendadores\.completar\.hecho'\)\)/)
    expect(ficha).toMatch(/onToast\(t\('arrendadores\.ficha\.incidencia-reportada'/)
  })

  it('editar terminos: firmado, enviado o solo historial, en ese orden', () => {
    expect(cambios).toMatch(
      /firmado\s*\n\s*\? t\('arrendadores\.editar\.hecho-firmado'\)\s*\n\s*: enviado\s*\n\s*\? t\('arrendadores\.editar\.hecho-enviado'\)\s*\n\s*: t\('arrendadores\.editar\.hecho'\)/,
    )
    // El deposito negativo dice «negativo» y el ilegible «no se entiende».
    expect(cambios).toMatch(
      /depositoIlegible\s*\n\s*\? t\('inventario\.wizard\.cifra'\)\s*\n\s*: depositoNegativo\s*\n\s*\? t\('arrendadores\.editar\.negativo'\)/,
    )
  })

  it('el panel de firmas: enviar avisa «enviado», firmar avisa «firmado»', () => {
    expect(panel).toMatch(/toast\.success\(accion === 'enviar' \? t\('arrendadores\.firmas\.enviado'\) : t\('arrendadores\.firmas\.firmado'\)\)/)
    expect(panel).toMatch(/toast\.success\(t\('arrendadores\.firmas\.copiado'\)\)/)
  })

  it('razones sociales, licencias y pagos de renta', () => {
    expect(razones).toMatch(/toast\.success\(t\('arrendadores\.razones\.actualizada'\)\)/)
    expect(razones).toMatch(/toast\.success\(t\('arrendadores\.razones\.eliminada'\)\)/)
    expect(licencias).toMatch(/onToast\(t\('arrendadores\.licencias\.borrada'\)\)/)
    expect(licencias).toMatch(/onToast\(t\('arrendadores\.licencias\.registrada'\)\)/)
    expect(pagos).toMatch(/alLograr: \(\) => onToast\?\.\(t\('arrendadores\.pago\.registrado'\)\)/)
  })

  it('el id de la tarjeta de pagos de renta NO cambia con el idioma', () => {
    // Es la clave donde se guarda si esta plegada: con el titulo traducido,
    // plegarla en ingles no valdria en espanol.
    expect(pagos).toMatch(/const TITULO_POR_OMISION = 'Pagos de renta'/)
    expect(pagos).toMatch(/id=\{`renta\.\$\{titulo\}`\}/)
  })
})

// ============================================================================
//  EL CONTRATO NO SE TRADUCE. Ni su redactor ni lo que se imprime con el.
// ============================================================================
describe('arrendadores · el documento del contrato sigue en espanol', () => {
  it('el redactor (`lib/contrato-documento.ts`) no usa el diccionario', () => {
    const doc = leer('lib/contrato-documento.ts')
    expect(doc).not.toMatch(/i18n/)
  })

  it('el redactor sigue INTACTO: el mismo contenido que en ec427a66, byte a byte', () => {
    // Su texto, la cantidad con letra y lo que entra en el hash de las firmas
    // viven aqui. Cambiar este archivo es cambiar lo que se firma: si alguien lo
    // edita a proposito, esta huella se actualiza en el mismo commit y se ve.
    const huella = createHash('sha256').update(leer('lib/contrato-documento.ts')).digest('hex')
    expect(huella).toBe('662e1799f5af778c73462ef6d858fce09adc8b7270339e99cde5595c4a3cbcc4')
  })

  it('el hash de las firmas es el del documento, no el de la constancia', () => {
    const repo = leer('lib/server/firmas-repo.ts')
    expect(repo).toMatch(/hashDocumento\(documentoATexto\(generarContrato\(/)
    expect(repo).not.toMatch(/ConstanciaFirmas|constancia/i)
  })

  it('la constancia (decision del dueño, 2026-11-02) se pinta en el idioma configurado', () => {
    const constancia = leer('components/demo/arrendadores/ConstanciaFirmas.tsx')
    // Por clave, con el idioma que llega como prop desde la pagina…
    expect(constancia).toMatch(/traducir\(idioma, clave, valores\)/)
    expect(constancia).not.toMatch(/>\s*Constancia de firma electrónica\s*</)
    expect(leer('app/(app)/contrato/[id]/page.tsx')).toMatch(/<ConstanciaFirmas estado=\{estadoFirmas\} idioma=\{idiomaDeLaPeticion\(\)\} \/>/)
    // …y en espanol dice lo de siempre.
    expect(traducir('es', 'arrendadores.constancia.titulo')).toBe('Constancia de firma electrónica')
  })

  it('el documento y su bloque de firmas siguen en espanol', () => {
    const pagina = leer('app/(app)/contrato/[id]/page.tsx')
    expect(pagina).toContain(`'FIRMADO ELECTRÓNICAMENTE'`)
    expect(pagina).toContain('<h2 className="doc-h2">DECLARACIONES</h2>')
    expect(pagina).toContain('Es un BORRADOR basado en cláusulas de uso común')
  })

  it('la firma publica pinta el documento congelado tal cual', () => {
    expect(leer('components/demo/arrendadores/FirmaPublica.tsx')).toMatch(/<pre className="doc-congelado">\{documento\}<\/pre>/)
  })
})

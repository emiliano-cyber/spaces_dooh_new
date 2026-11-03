import { describe, it, expect } from 'vitest'
import { ES_OPERACIONES, EN_OPERACIONES, IT_OPERACIONES } from './operaciones'
import { ES_OPERACIONES2, EN_OPERACIONES2, IT_OPERACIONES2 } from './operaciones2'
import { ES_INVENTARIO, EN_INVENTARIO, IT_INVENTARIO } from './inventario'
import { ES_ARRENDADORES, EN_ARRENDADORES, IT_ARRENDADORES } from './arrendadores'

// ============================================================================
//  ITALIANO · lote L3 · LA PRUEBA ESTATICA DEL DICCIONARIO.
// ----------------------------------------------------------------------------
//  Validacion del lote (H7): el barrido de las pruebas de pantallas solo ve las
//  claves que algun estado RINDE, y 203 de 1173 no salen en ninguno (toasts,
//  errores, la rama `.uno` de un plural). Una de esas en ingles o en espanol no
//  la cazaba nada. Aqui se mira el diccionario entero, clave por clave:
//
//    · el italiano no es IGUAL al ingles ni al espanol, salvo los cognados
//      declarados abajo (palabras que en italiano se escriben igual, siglas,
//      huecos sueltos);
//    · el singular de un plural no es igual a su plural, salvo los declarados
//      (sustantivos invariables en italiano).
// ============================================================================

const AMBITOS = [
  ['operaciones', ES_OPERACIONES, EN_OPERACIONES, IT_OPERACIONES],
  ['operaciones2', ES_OPERACIONES2, EN_OPERACIONES2, IT_OPERACIONES2],
  ['inventario', ES_INVENTARIO, EN_INVENTARIO, IT_INVENTARIO],
  ['arrendadores', ES_ARRENDADORES, EN_ARRENDADORES, IT_ARRENDADORES],
] as const

// Iguales al ingles o al espanol A PROPOSITO: se escriben asi en italiano.
const COGNADOS = new Set<string>([
  'operaciones.disponibilidad.kpi.en-periodo', // in {periodo}
  'operaciones.disponibilidad.vista', // Vista
  'operaciones.almacen.campo.marca', // Marca
  'operaciones.almacen.col.tipo', // Tipo
  'operaciones.almacen.alta.tipo', // Tipo
  'operaciones.almacen.mover.motivo', // Motivo / nota
  'inventario.titulo', // Inventario
  'inventario.tabla.col.tipo', // Tipo
  'inventario.tabla.doohmain-servidor', //  · server
  'inventario.tipo.muro', // Muro
  'inventario.wizard.rfc', // RFC (no se traduce)
  'inventario.wizard.correo', // Email
  'inventario.alta.tab.ia', // IA/Vision
  'inventario.alta.admobilize-id', // ID del dispositivo AdMobilize
  'inventario.carga.costo-uno', // uno solo
  'inventario.carga.archivo', // File
  'inventario.carga.formatos', // .xlsx o .csv
  'arrendadores.comun.domicilio', // Domicilio
  'arrendadores.comun.motivo', // «{motivo}»
  'arrendadores.contratos.vendida-item', // «{nombre}»
  'arrendadores.razones.regimen', // Regime:
  'arrendadores.incidencia.vandalismo', // Vandalismo
  'arrendadores.ficha.ruc', // RUC
  'arrendadores.ficha.correo', // Email
  'arrendadores.completar.falta-rfc', // RFC
  'arrendadores.incidencia.tipo', // Tipo
  'arrendadores.editar.motivo', // Motivo
  'arrendadores.compromiso.equivale', // Equivale a
  'arrendadores.firmas.congela', // congela
  'arrendadores.firmas.ip', // IP: {ip} · Browser: {navegador}
  'arrendadores.revision.fila', // {campo}: {valor}
  'arrendadores.barra.en', // In {donde}:
  'operaciones2.comun.tipo', // Tipo
  'operaciones2.prioridad.alta', // Alta
  'operaciones2.prioridad.urgente', // Urgente
  'operaciones2.ficha.checklist', // Checklist
])

// Singular igual al plural A PROPOSITO: el sustantivo es invariable en italiano.
const PLURALES_INVARIABLES = new Set<string>([
  'inventario.info.modalidades.uno', // {n} modalità
  'operaciones2.ot.banner.vencidas.uno', // {n} OdL in ritardo
])

describe('italiano L3 · el diccionario entero, sin depender de lo que se rinde', () => {
  for (const [ambito, es, en, itDic] of AMBITOS) {
    const IT = itDic as Partial<Record<string, string>>
    const ES = es as Record<string, string>
    const EN = en as Record<string, string>
    const claves = Object.keys(ES).filter((k) => !k.startsWith('arrendadores.constancia.'))

    it(`${ambito} · ninguna clave igual al ingles ni al espanol (salvo cognados declarados)`, () => {
      const copias = claves.filter((k) => !COGNADOS.has(k) && (IT[k] === EN[k] || IT[k] === ES[k]))
      expect(copias).toEqual([])
    })

    it(`${ambito} · cada singular dice algo distinto de su plural (salvo invariables declarados)`, () => {
      const iguales = claves
        .filter((k) => k.endsWith('.uno') && !PLURALES_INVARIABLES.has(k))
        .filter((k) => IT[k] === IT[k.replace(/\.uno$/, '.otros')])
      expect(iguales).toEqual([])
    })
  }

  it('los declarados siguen existiendo y siguen siendo iguales (si uno se traduce, se quita)', () => {
    const todo = Object.assign({}, ...AMBITOS.map(([, es, en, itDic]) => ({ es, en, it: itDic })).map((a) =>
      Object.fromEntries(Object.keys(a.es).map((k) => [k, [(a.es as Record<string, string>)[k], (a.en as Record<string, string>)[k], (a.it as Partial<Record<string, string>>)[k]]]))))
    expect([...COGNADOS].filter((k) => !todo[k] || (todo[k][2] !== todo[k][0] && todo[k][2] !== todo[k][1]))).toEqual([])
    expect([...PLURALES_INVARIABLES].filter((k) => !todo[k] || todo[k][2] !== todo[k.replace(/\.uno$/, '.otros')]?.[2])).toEqual([])
  })
})

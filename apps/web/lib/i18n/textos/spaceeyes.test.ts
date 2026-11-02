import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ES_SPACEEYES, EN_SPACEEYES } from './spaceeyes'

// ============================================================================
//  EL DICCIONARIO DE SPACE EYES, CONGELADO.
// ----------------------------------------------------------------------------
//  Mismo patron que los demas archivos de `textos/`: una instantanea de los dos
//  idiomas (ni el espanol —copia literal— ni el ingles cambian sin que el diff
//  de `__snapshots__/` lo enseñe) y las guardias de forma de la casa.
//
//  Y la gemela de `finanzas.test.ts` / `campanas.test.ts`: los avisos que NO se
//  rinden en `renderToStaticMarkup` (toasts, `window.confirm`, los mensajes que
//  pone un manejador) se fijan LEYENDO EL FUENTE, rama por rama.
// ============================================================================

describe('diccionario de Space Eyes · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_SPACEEYES).toMatchSnapshot()
  })

  it('el INGLES tampoco', () => {
    expect(EN_SPACEEYES).toMatchSnapshot()
  })
})

describe('diccionario de Space Eyes · forma', () => {
  // Iguales en los dos idiomas a proposito: cifras con unidad, nombres de
  // producto y palabras que tambien son ingles.
  const IGUALES = new Set([
    'spaceeyes.demo.estado.temperatura.v', // «38 °C»
    'spaceeyes.demo.estado.datos.v', // «312 MB»
    'spaceeyes.galeria.origen.manual', // «Manual»
    'spaceeyes.verif.no', // «No»
    'spaceeyes.graficas.total', // «Total»
    'spaceeyes.texto.normal', // «Normal»
    'spaceeyes.alta.tipo.raspberry', // «Raspberry Pi», nombre de producto
    'spaceeyes.alta.nombre.raspberry', // «Raspberry»
    'spaceeyes.alta.nombre.pc', // «PC»
    'spaceeyes.alta.pi.1.no', // el boton «No» del Raspberry Pi Imager
  ])
  const en = Object.entries(EN_SPACEEYES)

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    const iguales = Object.keys(ES_SPACEEYES).filter(
      (k) => ES_SPACEEYES[k as keyof typeof ES_SPACEEYES] === EN_SPACEEYES[k as keyof typeof EN_SPACEEYES],
    )
    expect(iguales.filter((k) => !IGUALES.has(k))).toEqual([])
    // Y la lista no guarda muertos: si una se traduce, se quita de aqui.
    expect([...IGUALES].filter((k) => !iguales.includes(k))).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    // «Juárez» es el nombre de una avenida de ejemplo (un placeholder), no texto.
    expect(en.filter(([k, v]) => k !== 'spaceeyes.alta.pi.nombre.ej' && /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    const distintos = Object.keys(ES_SPACEEYES).filter(
      (k) => huecos(ES_SPACEEYES[k as keyof typeof ES_SPACEEYES]) !== huecos(EN_SPACEEYES[k as keyof typeof EN_SPACEEYES]),
    )
    expect(distintos).toEqual([])
  })

  it('en ingles ningun porcentaje lleva espacio antes del «%»', () => {
    expect(en.filter(([, v]) => /\S %/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('el apostrofo y las comillas inglesas son los tipograficos', () => {
    expect(en.filter(([, v]) => /[A-Za-z]'[A-Za-z]/.test(v) || /(^|[\s(])"/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('siempre «Click», nunca «Tap» ni «press» (la casa); el telefono «confirma»', () => {
    expect(en.filter(([, v]) => /\btap\b|\btapping\b|\bpress\b/i.test(v)).map(([k]) => k)).toEqual([])
  })

  it('las frecuencias van en letra: «every two hours», nunca «every 2»', () => {
    expect(en.filter(([, v]) => /\bevery \d/i.test(v)).map(([k]) => k)).toEqual([])
  })

  it('los plurales con contador vienen en pareja .uno/.otros', () => {
    const claves = Object.keys(ES_SPACEEYES)
    const sueltos = claves.filter(
      (k) =>
        (k.endsWith('.uno') && !claves.includes(k.replace(/\.uno$/, '.otros'))) ||
        (k.endsWith('.otros') && !claves.includes(k.replace(/\.otros$/, '.uno'))),
    )
    expect(sueltos).toEqual([])
  })
})

// ============================================================================
//  QUE CLAVE usa cada aviso que NO se rinde.
// ============================================================================
describe('spaceeyes · los avisos que no se rinden usan su clave', () => {
  const leer = (archivo: string) =>
    readFileSync(path.join(__dirname, '../../../components/demo/space-eyes', archivo), 'utf8').replace(/\r\n/g, '\n')

  it('Programación: cada validación, éxito y fallo avisa el suyo', () => {
    const f = leer('Programacion.tsx')
    const casos: [RegExp, string][] = [
      [/!f\.name\.trim\(\)\) return void toast\.error\(t\('spaceeyes\.prog\.toast\.nombre'\)\)/, 'nombre'],
      [/f\.destino === 'device' && !f\.device_id\) return void toast\.error\(t\('spaceeyes\.prog\.toast\.equipo'\)\)/, 'equipo'],
      [/f\.destino === 'campaign' && !f\.campaign_id\) return void toast\.error\(t\('spaceeyes\.prog\.toast\.campana'\)\)/, 'campaña'],
      [/!f\.windows\.length\) return void toast\.error\(t\('spaceeyes\.prog\.toast\.franja'\)\)/, 'sin franjas'],
      [/v\.ini === v\.fin\)\) \{\s*\n\s*return void toast\.error\(t\('spaceeyes\.prog\.toast\.franja-mal'\)\)/, 'franja mal'],
      [/filter\(Boolean\)\.length\) \{\s*\n\s*return void toast\.error\(t\('spaceeyes\.prog\.error\.horas'\)\)/, 'sin horas'],
      [/f\.interval_minutes < 5\)\) \{\s*\n\s*return void toast\.error\(t\('spaceeyes\.prog\.toast\.intervalo'\)\)/, 'intervalo'],
      [/method: 'PUT', body: cuerpo \}\)\s*\n\s*toast\.success\(t\('spaceeyes\.prog\.toast\.actualizada'\)\)/, 'actualizada'],
      [/method: 'POST', body: cuerpo \}\)\s*\n\s*toast\.success\(t\('spaceeyes\.prog\.toast\.creada'\)\)/, 'creada'],
      [/toast\.success\(s\.active \? t\('spaceeyes\.prog\.toast\.pausada'\) : t\('spaceeyes\.prog\.toast\.activada'\)\)/, 'pausar/activar'],
      [/method: 'DELETE' \}\)\s*\n\s*toast\.success\(t\('spaceeyes\.prog\.toast\.eliminada'\)\)/, 'eliminada'],
      [/mensajeDeError\(e, t\('spaceeyes\.prog\.toast\.no-guardar'\), idioma\)/, 'no guardar'],
      [/mensajeDeError\(e, t\('spaceeyes\.prog\.toast\.no-estado'\), idioma\)/, 'no estado'],
      [/mensajeDeError\(e, t\('spaceeyes\.prog\.toast\.no-eliminar'\), idioma\)/, 'no eliminar'],
    ]
    expect(casos.filter(([re]) => !re.test(f)).map(([, n]) => n)).toEqual([])
  })

  it('Vista en vivo: fijar, enfocar, orientar y pedir foto avisan cada uno el suyo', () => {
    const f = leer('VistaEnVivo.tsx')
    const casos: [RegExp, string][] = [
      [/toast\.success\(t\('spaceeyes\.vivo\.encuadre-fijado'\)\)/, 'encuadre fijado'],
      [/motivoDe\(e, t\('spaceeyes\.vivo\.no-encuadre'\), idioma\)/, 'no encuadre'],
      [/toast\.success\(fijo \? t\('spaceeyes\.vivo\.enfoque\.fijado'\) : t\('spaceeyes\.vivo\.enfoque\.libre'\)\)/, 'enfoque fijo/libre'],
      [/motivoDe\(e, t\('spaceeyes\.vivo\.enfoque\.no-guardar'\), idioma\)/, 'no enfoque'],
      [/toast\.success\(t\('spaceeyes\.vivo\.orientacion\.fijada'\)\)/, 'orientación'],
      [/motivoDe\(e, t\('spaceeyes\.vivo\.orientacion\.no-fijar'\), idioma\)/, 'no orientación'],
      [/toast\.success\(t\('spaceeyes\.vivo\.foto\.pedida'\)\)/, 'foto pedida'],
      [/motivoDe\(e, t\('spaceeyes\.comun\.no-pedir-foto'\), idioma\)/, 'no foto'],
      [/toast\.info\(cambioLente \? t\('spaceeyes\.vivo\.ver-asi\.lente'\) : t\('spaceeyes\.vivo\.ver-asi\.nitido'\)\)/, 'ver así'],
      [/toast\.info\(t\('spaceeyes\.vivo\.ver-asi\.compartida'/, 'ver así compartida'],
      [/toast\.info\(t\('spaceeyes\.vivo\.compartida'/, 'compartida'],
      [/toast\.info\(t\('spaceeyes\.vivo\.corte-auto'\)\)/, 'corte a los 3 min'],
      [/if \(bytes === 0\) perdida\(t\('spaceeyes\.vivo\.sin-imagen'\)\)/, 'sin imagen'],
    ]
    expect(casos.filter(([re]) => !re.test(f)).map(([, n]) => n)).toEqual([])
  })

  it('Fallas: descartar avisa «descartada» y arreglar «arreglada», no al revés', () => {
    const f = leer('FallasFlota.tsx')
    expect(f).toMatch(/texto: descartar \? t\('spaceeyes\.fallas\.descartada'\) : t\('spaceeyes\.fallas\.arreglada'\)/)
    expect(f).toMatch(/e\.status === 403\s*\n\s*\? t\('spaceeyes\.fallas\.sin-permiso'\)\s*\n\s*: e instanceof ErrorSE && e\.status === 404\s*\n\s*\? t\('spaceeyes\.fallas\.ya-cerrada'\)/)
    expect(f).toMatch(/texto: t\('spaceeyes\.fallas\.no-cerrar', \{ motivo: msg \}\)/)
  })

  it('Galería: eliminar, el álbum (singular y plural) y descargar avisan el suyo', () => {
    const f = leer('Galeria.tsx')
    expect(f).toMatch(/avisar\(t\('spaceeyes\.galeria\.eliminada'\), 'exito'\)/)
    expect(f).toMatch(/fallidas === 1 \? 'spaceeyes\.galeria\.album\.parcial\.uno' : 'spaceeyes\.galeria\.album\.parcial\.otros'/)
    expect(f).toMatch(/: t\('spaceeyes\.galeria\.album\.listo'\)/)
    expect(f).toMatch(/avisar\(t\('spaceeyes\.galeria\.album\.vacio'\), 'info'\)/)
    expect(f).toMatch(/avisar\(t\('spaceeyes\.galeria\.album\.ninguna'\), 'error'\)/)
    expect(f).toMatch(/avisar\(t\('spaceeyes\.galeria\.descargando-foto'\), 'exito'\)/)
  })

  it('Ajustar texto: capturada, no llegó, permisos y guardar; y el confirm de descartar', () => {
    const f = leer('AjustarTexto.tsx')
    expect(f).toMatch(/!window\.confirm\(t\('spaceeyes\.texto\.confirmar-descartar'\)\)/)
    expect(f).toMatch(/avisar\('ok', t\('spaceeyes\.texto\.capturada'\)\)/)
    expect(f).toMatch(/avisar\('error', t\('spaceeyes\.texto\.no-llego'\)\)/)
    expect(f).toMatch(/e\.status === 403 \? t\('spaceeyes\.texto\.sin-permiso-foto'\) : t\('spaceeyes\.texto\.no-orden'\)/)
    expect(f).toMatch(/avisar\('ok', t\('spaceeyes\.texto\.guardada'\)\)/)
    expect(f).toMatch(/e\.status === 403 \? t\('spaceeyes\.texto\.sin-permiso-marca'\) : t\('spaceeyes\.texto\.no-guardar'\)/)
  })

  it('El equipo: cada orden avisa la suya, y un motivo conocido gana al genérico', () => {
    const f = leer('EquipoAdmin.tsx')
    expect(f).toMatch(
      /tipo === 'reiniciar'\s*\n\s*\? t\('spaceeyes\.admin\.orden\.reiniciar'\)\s*\n\s*: tipo === 'equipo'\s*\n\s*\? t\('spaceeyes\.admin\.orden\.equipo'\)\s*\n\s*: seActualizaSolo\s*\n\s*\? t\('spaceeyes\.admin\.orden\.actualizar'\)\s*\n\s*: t\('spaceeyes\.admin\.orden\.confirmar'\)/,
    )
    expect(f).toMatch(/apk_no_publicado: 'spaceeyes\.admin\.motivo\.apk'/)
    expect(f).toMatch(/agente_no_publicado: 'spaceeyes\.admin\.motivo\.pc'/)
    expect(f).toMatch(/agente_pi_no_publicado: 'spaceeyes\.admin\.motivo\.pi'/)
    expect(f).toMatch(/texto: t\('spaceeyes\.admin\.prueba\.asi'\)/)
    expect(f).toMatch(/texto: t\('spaceeyes\.admin\.prueba\.no-llego'\)/)
    expect(f).toMatch(/texto: t\('spaceeyes\.admin\.ajustes\.guardados'\)/)
  })

  it('Campañas y pantalla: crear/actualizar y reinicia/guardada no se cruzan', () => {
    expect(leer('CampanasEyes.tsx')).toMatch(
      /texto: eraNueva \? t\('spaceeyes\.campanas\.creada'\) : t\('spaceeyes\.campanas\.actualizada'\)/,
    )
    expect(leer('PantallaConfig.tsx')).toMatch(
      /texto: r\?\.reiniciado \? t\('spaceeyes\.pconfig\.guardada\.reinicia'\) : t\('spaceeyes\.pconfig\.guardada'\)/,
    )
    expect(leer('FichaEquipo.tsx')).toMatch(/const llego = t\('spaceeyes\.ficha\.llego'\)/)
  })
})

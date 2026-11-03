import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ES_SPACEEYES, EN_SPACEEYES, IT_SPACEEYES } from './spaceeyes'
import { vi } from 'vitest'

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
    'spaceeyes.alta.tel.vincular', // el boton «Vincular» de la app Android, que solo esta en español (dueño, 02/11)
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

// ============================================================================
//  Los textos de error que arma el CLIENTE (validacion, hallazgo medio n.º 1, y
//  decision del orquestador del 02/11 sobre la vista en vivo): «Space Eye
//  respondió N» y los motivos de `VisorWhep` son interfaz y van en el idioma de
//  quien los lee, con 'es' por omision (el español de siempre).
// ============================================================================
describe('spaceeyes · los errores del cliente, en los dos idiomas', () => {
  it('seApi sin motivo del servidor: «respondió N» y su ingles', async () => {
    const { seApi, textoDeError, textoRespondio } = await import('../../data/space-eyes-se')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    const e = await seApi('devices').catch((x) => x)
    expect(e.message).toBe('Space Eye respondió 500')
    expect(textoDeError(e)).toBe('Space Eye respondió 500')
    expect(textoDeError(e, 'es')).toBe('Space Eye respondió 500')
    expect(textoDeError(e, 'en')).toBe('Space Eye returned 500')
    expect(textoRespondio(404, 'en')).toBe('Space Eye returned 404')
    vi.unstubAllGlobals()
  })

  it('la flota (space-eyes-api) sin error del servidor: el respaldo en el idioma de quien lo lee', async () => {
    // Costura 2 (validacion de Space Eyes, menor): el respaldo iba fijo en
    // español. `'es'` por omision, como `textoDeError`.
    const api = await import('../../data/space-eyes-api')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })))
    expect((await api.equipoApi(7).catch((x) => x)).message).toBe('No se pudo hablar con Space Eyes')
    expect((await api.equipoApi(7, 'es').catch((x) => x)).message).toBe('No se pudo hablar con Space Eyes')
    expect((await api.equipoApi(7, 'en').catch((x) => x)).message).toBe('Could not reach Space Eyes')
    expect((await api.listarEquiposApi('en').catch((x) => x)).message).toBe('Could not reach Space Eyes')
    expect((await api.telemetriaApi(7, 24, 'en').catch((x) => x)).message).toBe('Could not reach Space Eyes')
    // Lo que manda el servidor es un dato: pasa tal cual en los dos idiomas.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Sin llave' }), { status: 502 })))
    expect((await api.fallasApi(7, 'en').catch((x) => x)).message).toBe('Sin llave')
    vi.unstubAllGlobals()
  })

  it('lo que manda Space Eye es un dato y pasa tal cual en los dos idiomas', async () => {
    const { seApi, textoDeError } = await import('../../data/space-eyes-se')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ mensaje: 'espejo de solo lectura' }), { status: 409 })))
    const e = await seApi('schedules').catch((x) => x)
    expect(textoDeError(e, 'en')).toBe('espejo de solo lectura')
    vi.unstubAllGlobals()
  })

  it('VisorWhep: sin dirección de la transmisión, el motivo en el idioma pedido', async () => {
    const { VisorWhep } = await import('../../space-eyes-whep')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    const en = await new VisorWhep(7, {} as never, () => {}, 'en').iniciar().catch((x) => x)
    expect(en.message).toBe('Space Eye did not provide the stream address')
    const es = await new VisorWhep(7, {} as never, () => {}).iniciar().catch((x) => x)
    expect(es.message).toBe('Space Eye no entregó la dirección de la transmisión')
    vi.unstubAllGlobals()
  })

  it('cada motivo de VisorWhep usa su clave (los que no se pueden provocar sin WebRTC)', () => {
    const f = readFileSync(path.join(__dirname, '../../space-eyes-whep.ts'), 'utf8')
    expect(f).toMatch(/throw new Error\(traducir\(this\.idioma, 'spaceeyes\.whep\.no-transmite'\)\)/)
    expect(f).toMatch(/traducir\(this\.idioma, 'spaceeyes\.whep\.no-conectar', \{ motivo:/)
    expect(f).toMatch(/this\.alPerderse\(traducir\(this\.idioma, 'spaceeyes\.whep\.perdida'\)\)/)
    const vivo = readFileSync(path.join(__dirname, '../../../components/demo/space-eyes/VistaEnVivo.tsx'), 'utf8')
    expect(vivo).toMatch(/new VisorWhep\(id, videoRef\.current, perdida, idioma\)/)
    const graf = readFileSync(path.join(__dirname, '../../../components/demo/space-eyes/Graficas.tsx'), 'utf8')
    expect(graf).toMatch(/if \(!r\.ok\) throw new Error\(textoRespondio\(r\.status, idioma\)\)/)
  })
})

// ============================================================================
//  EL ITALIANO DEL LOTE L1 (2026-11-03): completo, congelado y con la forma
//  de la casa italiana (`vault/03-Frontend/italiano-olas.md`).
// ============================================================================
describe('diccionario de Space Eyes · italiano', () => {
  const IT = IT_SPACEEYES as Partial<Record<string, string>>
  const it_ = Object.entries(IT) as [string, string][]
  // Iguales al espanol a proposito: cifras con unidad, nombres de producto y
  // el boton «Vincular» de la app Android, que solo esta en español.
  const IGUALES_IT = new Set([
    'spaceeyes.demo.estado.temperatura.v', // «38 °C»
    'spaceeyes.demo.estado.datos.v', // «312 MB»
    'spaceeyes.alta.tipo.raspberry', // «Raspberry Pi»
    'spaceeyes.alta.nombre.raspberry', // «Raspberry»
    'spaceeyes.alta.nombre.pc', // «PC»
    'spaceeyes.alta.pi.1.no', // el boton «No» del Raspberry Pi Imager
    'spaceeyes.alta.tel.vincular', // «Vincular»: la app Android solo esta en español (dueño, 02/11)
    'spaceeyes.verif.no', // «No»
  ])

  it('esta COMPLETO: cada clave del espanol tiene su italiano, y ninguna sobra', () => {
    expect(Object.keys(ES_SPACEEYES).filter((k) => !IT[k])).toEqual([])
    expect(Object.keys(IT).filter((k) => !(k in ES_SPACEEYES))).toEqual([])
  })

  it('no cambia sin que se vea', () => {
    expect(IT_SPACEEYES).toMatchSnapshot()
  })

  it('ninguna entrada italiana es igual a la espanola ni a la inglesa, salvo las declaradas', () => {
    const iguales = it_.filter(
      ([k, v]) => v === ES_SPACEEYES[k as keyof typeof ES_SPACEEYES] || v === EN_SPACEEYES[k as keyof typeof EN_SPACEEYES],
    ).map(([k]) => k)
    expect(iguales.filter((k) => !IGUALES_IT.has(k))).toEqual([])
  })

  it('los huecos son los mismos que en espanol', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    expect(it_.filter(([k, v]) => huecos(v) !== huecos(ES_SPACEEYES[k as keyof typeof ES_SPACEEYES])).map(([k]) => k)).toEqual([])
  })

  it('sin espacio antes del «%», apostrofo tipografico y comillas « »', () => {
    expect(it_.filter(([, v]) => /\S %|\d %/.test(v)).map(([k]) => k)).toEqual([])
    expect(it_.filter(([, v]) => /[A-Za-zÀ-ú]'[A-Za-zÀ-ú]|"/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('ni cifras con punto decimal ni signos de apertura espanoles', () => {
    expect(it_.filter(([, v]) => /\d\.\d/.test(v.replace(/\d+\.\d+\.\d+/g, '')) || /[¿¡ñ]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('las frecuencias fijas van en letra: «ogni due ore», nunca «ogni 2»', () => {
    expect(it_.filter(([, v]) => /\bogni \d/i.test(v)).map(([k]) => k)).toEqual([])
  })

  it('en la web se «clicca»: nunca «tocca»/«premi» (el telefono «conferma»)', () => {
    expect(it_.filter(([, v]) => /\btocc[ah]i?\b|\bprem[ie]\b/i.test(v)).map(([k]) => k)).toEqual([])
  })

  it('los anglicismos del sector se quedan: ni «bucle» ni «riproduzione» por loop/spot', () => {
    expect(it_.filter(([, v]) => /\bbucle\b|\bciclo di riproduzione\b/i.test(v)).map(([k]) => k)).toEqual([])
  })
})

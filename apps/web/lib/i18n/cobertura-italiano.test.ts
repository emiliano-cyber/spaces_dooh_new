import { describe, it, expect } from 'vitest'
import { CLAVES, DICCIONARIOS, AMBITOS_ITALIANO, IT_PARCIAL, conCaidaAlIngles } from './diccionario'
import { CATALOGO_ERRORES_IT, PATRONES_ERROR } from './errores-servidor'
import { coberturaItaliano, problemasItaliano, tablaCobertura, clavesBase } from './cobertura-italiano'

// ============================================================================
//  Ola 0 del italiano · LA COBERTURA. No exige que este todo traducido —eso es
//  el trabajo de los lotes—; exige que lo que falta se CUENTE y que lo escrito
//  este bien formado. La tabla sale por consola en cada corrida.
// ============================================================================

describe('cobertura del italiano', () => {
  const filas = coberturaItaliano()

  it('informa, por ambito, cuantas claves faltan', () => {
    // eslint-disable-next-line no-console
    console.log(`\nCobertura del italiano\n${tablaCobertura(filas)}\n`)
    for (const f of filas) expect(f.traducidas + f.pendientes, f.ambito).toBe(f.claves)
  })

  it('las filas de la interfaz suman TODAS las claves del diccionario, sin repetir', () => {
    const interfaz = filas.filter((f) => !f.ambito.startsWith('errores'))
    expect(interfaz.reduce((a, f) => a + f.claves, 0)).toBe(CLAVES.length)
    expect(new Set(AMBITOS_ITALIANO.map((a) => a.ambito)).size).toBe(AMBITOS_ITALIANO.length)
    expect(clavesBase()).toContain('idioma.it')
  })

  it('lo minimo de la shell ya esta: el selector de idioma', () => {
    const base = filas[0]
    expect(base.traducidas).toBeGreaterThanOrEqual(5)
    expect(DICCIONARIOS.it['idioma.cambiar']).toBe('Cambia lingua')
    expect(DICCIONARIOS.it['idioma.it']).toBe('Italiano')
  })

  it('la caida: lo escrito gana, lo vacio no cuenta', () => {
    const it_ = conCaidaAlIngles(DICCIONARIOS.en, { 'comun.o': '', 'comun.cancelar': 'Annulla' })
    expect(it_['comun.cancelar']).toBe('Annulla')
    expect(it_['comun.o']).toBe('or')
    expect(it_['comun.guardar']).toBe('Save')
  })

  it('lo que falta se pinta en INGLES, no en espanol', () => {
    // Lote L5: la base ya tiene italiano, asi que la caida se mira con una
    // tabla vacia y, sobre el diccionario real, clave por clave.
    const sinNada = conCaidaAlIngles(DICCIONARIOS.en, {})
    expect(sinNada['login.titulo.login']).toBe('Sign in')
    expect(sinNada['comun.cancelar']).toBe('Cancel')
    const it_ = IT_PARCIAL as Record<string, string | undefined>
    const mal = CLAVES.filter((k) => DICCIONARIOS.it[k] !== (it_[k] ? it_[k] : DICCIONARIOS.en[k]))
    expect(mal).toEqual([])
  })

  it('el italiano escrito esta bien formado', () => {
    expect(problemasItaliano()).toEqual([])
  })

  it('y la comprobacion MUERDE: vacio, huecos perdidos y claves inventadas', () => {
    const it_ = IT_PARCIAL as Record<string, string>
    // Lote L5: las dos claves ya tienen italiano; se guardan y se restauran.
    const antes = { demasiados: it_['login.error.demasiados'], o: it_['comun.o'] }
    const traducidasAntes = coberturaItaliano()[0].traducidas
    it_['login.error.demasiados'] = 'Troppi tentativi.'
    it_['comun.o'] = ''
    it_['no.existe'] = 'x'
    CATALOGO_ERRORES_IT['Frase que no existe'] = 'y'
    // Una variante `.cero` puede no llevar {n}, pero no perder otro hueco.
    const cero = 'notificaciones.cobranza.vence.detalle.cero'
    const ceroAntes = it_[cero]
    it_[cero] = '{cobranza} — scade oggi'
    try {
      expect(problemasItaliano().sort()).toEqual(
        [
          'huecos distintos en login.error.demasiados: es {s} · it {}',
          'vacia: comun.o',
          'clave sin espanol: no.existe',
          'errores: entrada sin espanol canonico: Frase que no existe',
          `huecos distintos en ${cero}: es {cobranza,n,saldo} · it {cobranza}`,
        ].sort(),
      )
      // Y una vacia no cuenta como traducida (`comun.o` tenia italiano).
      expect(coberturaItaliano()[0].traducidas).toBe(traducidasAntes - (antes.o ? 1 : 0))
    } finally {
      for (const [k, v] of [
        ['login.error.demasiados', antes.demasiados],
        ['comun.o', antes.o],
      ] as const) {
        if (v === undefined) delete it_[k]
        else it_[k] = v
      }
      if (ceroAntes === undefined) delete it_[cero]
      else it_[cero] = ceroAntes
      delete it_['no.existe']
      delete CATALOGO_ERRORES_IT['Frase que no existe']
    }
  })
})

// ============================================================================
//  LOTE L5 (armazon, cuenta, administracion, compartidos y servidor) · sus
//  filas, COMPLETAS. Una por ambito para que el rojo diga cual falta.
// ============================================================================
const AMBITOS_L5 = [
  'base (diccionario.ts)', 'compartidos', 'shell', 'cuenta', 'admin', 'notificaciones', 'servidor',
  'errores · catalogo', 'errores · campos', 'errores · firma', 'errores · patrones',
]

describe('lote L5 · sus ambitos sin pendientes', () => {
  const filas = coberturaItaliano()
  for (const ambito of AMBITOS_L5) {
    it(ambito, () => {
      const f = filas.find((x) => x.ambito === ambito)
      expect(f, ambito).toBeDefined()
      expect(f!.pendientes).toBe(0)
    })
  }
})

// Una clave que se queda igual que el ingles (o que el espanol) no la ve el
// barrido de pantallas —el trozo «ya esta en el italiano»—, y es justo el
// aspecto de una clave sin traducir. Las del lote que se dicen igual a
// proposito, declaradas una por una (lote L5, 2026-11-03).
describe('lote L5 · el italiano que coincide con otro idioma, solo el declarado', () => {
  const IGUAL_AL_INGLES = [
    'idioma.es', 'idioma.en', 'idioma.it', 'login.campo.correo', 'login.campo.password', 'sidebar.logo-alt',
    'nav.grupo.ojos', 'nav.dashboard', 'nav.network', 'shell.topbar.cuenta', 'shell.candado.contrasena',
    'cuenta.cuestionario.no', 'admin.modulo.dashboard', 'admin.modulo.network', 'admin.usuarios.equipo',
    'admin.usuarios.col.contrasena', 'admin.alta.correo', 'admin.alta.contrasena', 'admin.logo.campo',
    'admin.cuenta.correo', 'admin.network.no',
    // «Programmatic»: anglicismo del sector, como en Comercial (costura final, 2026-11-04).
    'admin.network.programatico',
  ]
  const IGUAL_AL_ESPANOL = [
    'comun.o', 'nav.grupo.patrimonio', 'nav.grupo.sistema', 'nav.inventario', 'compartidos.periodo.aria',
    'compartidos.dia.0', 'compartidos.dia.1', 'compartidos.dia.2', 'admin.fiscal.rfc', 'admin.tickets.prioridad.alta',
    'admin.tickets.prioridad.urgente', 'admin.integ.conector.admobilize.nombre', 'admin.integ.dispositivo',
    'admin.network.col.tipo', 'admin.razones.serie-n', 'servidor.franja.vendida',
  ]
  const delLote = () => {
    const ambitos = new Set(['compartidos', 'shell', 'cuenta', 'admin', 'notificaciones', 'servidor'])
    return [...clavesBase(), ...AMBITOS_ITALIANO.filter((a) => ambitos.has(a.ambito)).flatMap((a) => Object.keys(a.es))]
  }
  it('igual al ingles', () => {
    const it_ = IT_PARCIAL as Record<string, string>
    const en = DICCIONARIOS.en as Record<string, string>
    expect(delLote().filter((k) => it_[k] === en[k]).sort()).toEqual([...IGUAL_AL_INGLES].sort())
  })
  it('igual al espanol', () => {
    const it_ = IT_PARCIAL as Record<string, string>
    const es = DICCIONARIOS.es as Record<string, string>
    const en = DICCIONARIOS.en as Record<string, string>
    expect(delLote().filter((k) => it_[k] === es[k] && es[k] !== en[k]).sort()).toEqual([...IGUAL_AL_ESPANOL].sort())
  })
})

// ============================================================================
//  Validacion del lote L5 · las frases corregidas y las reglas comunes de
//  todo el italiano (acordadas con L1–L4).
// ============================================================================
describe('lote L5 · frases corregidas en la validacion', () => {
  const it_ = () => IT_PARCIAL as Record<string, string>
  it('las tres que se leian mal', () => {
    expect(it_()['admin.razones.de-baja']).toBe('Disattivate: {n}')
    expect(it_()['admin.act.modo.aprobacion']).toBe('Modalità cambiata: con approvazione')
    expect(it_()['admin.act.modo.automatica']).toBe('Modalità cambiata: automatica')
    expect(it_()['admin.password.no-se-ve']).toContain('e al primo accesso il sistema chiederà di cambiarla.')
    // Regla comun: «gerente» → manager.
    expect(it_()['admin.rol.gerente_ventas']).toBe('Manager vendite')
  })
  it('los retoques', () => {
    expect(it_()['compartidos.unidad.cpm']).toBe('CPM · costo per mille impression')
    expect(it_()['compartidos.doohmain.las-que-quepan']).toBe('Quanti ne stanno')
    expect(it_()['shell.fotos.alt']).toBe('prova')
    expect(it_()['cuenta.cuestionario.p1.ayuda']).toContain('aziende del settore media')
    expect(it_()['cuenta.recuperar.bienvenida']).toBe('Ti diamo il benvenuto')
    expect(it_()['shell.404.codigo']).toBe('Errore 404')
  })
})

describe('lote L5 · reglas comunes del italiano', () => {
  const textosDelLote = () => {
    const ambitos = new Set(['compartidos', 'shell', 'cuenta', 'admin', 'notificaciones', 'servidor'])
    const claves = [...clavesBase(), ...AMBITOS_ITALIANO.filter((a) => ambitos.has(a.ambito)).flatMap((a) => Object.keys(a.es))]
    const it_ = IT_PARCIAL as Record<string, string>
    return [
      ...claves.map((k) => [k, it_[k] ?? ''] as const),
      ...Object.entries(CATALOGO_ERRORES_IT).map(([k, v]) => [k, v ?? ''] as const),
      ...PATRONES_ERROR.map((p) => [p.en, p.it ?? ''] as const),
    ]
  }
  it('nunca un articulo delante de una fecha («in data {fecha}», «fino al giorno {fin}»)', () => {
    // Un hueco de fecha del diccionario, o un `$n` de un patron que no sea un porcentaje.
    const re = /\b(?:il|al|dal|del|nel|sul)\s+(?:\{(?:fecha|vence|finGracia|desde|hasta|fin|inicio)\}|\$\d(?!\d*%))/i
    expect(textosDelLote().filter(([, v]) => re.test(v)).map(([k]) => k)).toEqual([])
  })
  it('ni anomalia por incidencia mal dicha, ni gerente, ni predio en espanol', () => {
    const malas = /\b(?:responsabile o superiore|incidenza|predio|gerente)\b/i
    expect(textosDelLote().filter(([, v]) => malas.test(v)).map(([k]) => k)).toEqual([])
  })
  it('el selector de fechas no pone articulo delante de la fecha', () => {
    const it_ = IT_PARCIAL as Record<string, string>
    expect([it_['compartidos.periodo.desde'], it_['compartidos.periodo.hasta'], it_['compartidos.periodo.a']]).toEqual(['Da', 'Fino a', '–'])
  })
})
